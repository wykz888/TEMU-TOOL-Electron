const crypto = require('node:crypto');
const {
  DEFAULT_LANGUAGE,
  DEFAULT_LANGUAGES,
  DEFAULT_TIMEZONE,
  DEFAULT_PLATFORM,
  DEFAULT_VENDOR,
  DEFAULT_PRODUCT_SUB,
  DEFAULT_DO_NOT_TRACK,
  DEFAULT_MAX_TOUCH_POINTS,
  DEFAULT_DEVICE_PIXEL_RATIO,
  DEFAULT_COLOR_DEPTH,
  DEVICE_PROFILES,
  LOCALE_PROFILES,
  NETWORK_PROFILES,
  PLUGIN_TEMPLATES,
  PERMISSION_PRESETS
} = require('./fingerprintCatalog');

const FINGERPRINT_MODES = Object.freeze({
  off: 'off',
  auto: 'auto',
  custom: 'custom'
});

function shouldUseFixedSeedMode(mode) {
  return mode !== FINGERPRINT_MODES.off;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function cloneArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function clampInteger(value, fallbackValue, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  const roundedValue = Math.round(numericValue);

  if (roundedValue < min || roundedValue > max) {
    return fallbackValue;
  }

  return roundedValue;
}

function clampNumber(value, fallbackValue, min, max, precision = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  const boundedValue = Math.min(max, Math.max(min, numericValue));

  if (precision <= 0) {
    return Math.round(boundedValue);
  }

  const factor = 10 ** precision;
  return Math.round(boundedValue * factor) / factor;
}

function normalizeFingerprintMode(value) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === FINGERPRINT_MODES.off) {
    return FINGERPRINT_MODES.off;
  }

  if (normalizedValue === FINGERPRINT_MODES.custom) {
    return FINGERPRINT_MODES.custom;
  }

  return FINGERPRINT_MODES.auto;
}

function readInputValue(input, ...keys) {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  for (const key of keys) {
    if (
      key
      && Object.prototype.hasOwnProperty.call(input, key)
      && input[key] !== undefined
    ) {
      return input[key];
    }
  }

  return undefined;
}

function normalizeFingerprintSeed(value) {
  return normalizeText(value).slice(0, 128);
}

function resolveEffectiveFingerprintMode(input, fallbackMode = FINGERPRINT_MODES.auto) {
  const mode = resolveFingerprintModeValue(input, fallbackMode);
  return shouldUseFixedSeedMode(mode) ? FINGERPRINT_MODES.custom : FINGERPRINT_MODES.off;
}

function resolveFingerprintModeValue(input, fallbackMode = FINGERPRINT_MODES.auto) {
  const rawValue = readInputValue(input, 'fingerprintMode', 'mode');

  if (rawValue === undefined) {
    return fallbackMode;
  }

  return normalizeFingerprintMode(rawValue);
}

function resolveFingerprintSeed(input, mode = resolveFingerprintModeValue(input)) {
  const explicitSeed = normalizeFingerprintSeed(readInputValue(input, 'fingerprintSeed', 'seed'));

  if (explicitSeed) {
    return explicitSeed;
  }

  if (mode === FINGERPRINT_MODES.custom) {
    return normalizeFingerprintSeed(readInputValue(input, 'profileKey'));
  }

  return '';
}

function hasExplicitFingerprintSeed(input) {
  return Boolean(normalizeFingerprintSeed(readInputValue(input, 'fingerprintSeed', 'seed')));
}

function createSeed(identity, fingerprintSeed = '') {
  const normalizedFingerprintSeed = normalizeFingerprintSeed(fingerprintSeed);
  const seedSource = [
    normalizeText(identity && identity.shopId),
    normalizeText(identity && identity.phoneNumber),
    normalizeText(identity && identity.shopName)
  ]
    .filter(Boolean)
    .join('|');

  return crypto
    .createHash('sha256')
    .update(
      normalizedFingerprintSeed
        ? `seed|${normalizedFingerprintSeed}`
        : `identity|${seedSource || 'temu-shop'}`
    )
    .digest('hex');
}

function createStableHex(seed, namespace, length = 16) {
  return crypto
    .createHash('sha256')
    .update(`${seed}|${namespace}`)
    .digest('hex')
    .slice(0, length);
}

function pickProfile(list, seed, offset) {
  const indexSeed = seed.slice(offset, offset + 8) || seed.slice(0, 8) || '0';
  const index = parseInt(indexSeed, 16) % list.length;
  return list[index];
}

function findLocaleProfileByKey(profileKey) {
  return LOCALE_PROFILES.find((profile) => profile.key === profileKey) || null;
}

function findLocaleProfileByLanguageAndTimezone(language, timezone) {
  const normalizedLanguage = normalizeText(language).toLowerCase();
  const normalizedTimezone = normalizeText(timezone);

  if (!normalizedLanguage && !normalizedTimezone) {
    return null;
  }

  return (
    LOCALE_PROFILES.find((profile) => (
      normalizeText(profile.timezone) === normalizedTimezone
      && normalizeText(profile.language).toLowerCase() === normalizedLanguage
    ))
    || LOCALE_PROFILES.find((profile) => (
      normalizeText(profile.language).toLowerCase() === normalizedLanguage
    ))
    || LOCALE_PROFILES.find((profile) => (
      normalizeText(profile.timezone) === normalizedTimezone
    ))
    || null
  );
}

function normalizeProxyContext(context) {
  const source = context && context.proxyConfig ? context.proxyConfig : context;

  return {
    type: normalizeText(source && (source.type || source.proxyType)).toLowerCase(),
    host: normalizeText(source && (source.host || source.proxyHost)),
    username: normalizeText(source && (source.username || source.proxyUsername)),
    password: normalizeText(source && (source.password || source.proxyPassword))
  };
}

function inferLocaleProfileFromProxy(context) {
  const proxyContext = normalizeProxyContext(context);

  if (proxyContext.type === 'local') {
    return findLocaleProfileByKey('zh_cn_mainland');
  }

  const hintText = [
    proxyContext.type,
    proxyContext.host,
    proxyContext.username,
    proxyContext.password
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase();

  if (!hintText) {
    return null;
  }

  const localeHints = [
    { key: 'zh_hk', patterns: ['hongkong', 'hong_kong', '.hk', '|hk|', '-hk', '_hk', 'hk-'] },
    { key: 'en_sg', patterns: ['singapore', '.sg', '|sg|', '-sg', '_sg', 'sg-'] },
    { key: 'en_us_west', patterns: ['unitedstates', 'united_states', 'america', '.us', '|us|', '-us', '_us', 'us-'] },
    { key: 'en_gb', patterns: ['unitedkingdom', 'united_kingdom', 'britain', 'england', '.uk', '.gb', '|uk|', '|gb|', '-uk', '_uk', '-gb', '_gb'] },
    { key: 'ja_jp', patterns: ['japan', '.jp', '|jp|', '-jp', '_jp', 'jp-'] },
    { key: 'zh_cn_mainland', patterns: ['china', 'mainland', '.cn', '|cn|', '-cn', '_cn', 'cn-'] }
  ];

  const matchedHint = localeHints.find((hint) => (
    hint.patterns.some((pattern) => hintText.includes(pattern))
  ));

  return matchedHint ? findLocaleProfileByKey(matchedHint.key) : null;
}

function normalizeLanguages(value, fallbackLanguages) {
  const normalizedValues = Array.isArray(value)
    ? value.map(normalizeText).filter(Boolean)
    : normalizeText(value)
      .split(',')
      .map(normalizeText)
      .filter(Boolean);

  return normalizedValues.length > 0 ? normalizedValues : cloneArray(fallbackLanguages);
}

function buildFontFamilies(localeProfile) {
  const fallbackFonts = ['Segoe UI', 'Arial', 'Calibri', 'Times New Roman'];
  const fontFamilies = Array.isArray(localeProfile && localeProfile.fonts)
    ? localeProfile.fonts.map(normalizeText).filter(Boolean)
    : [];

  return fontFamilies.length > 0 ? fontFamilies : fallbackFonts;
}

function buildSpeechVoices(localeProfile, language) {
  const normalizedLanguage = normalizeText(language) || DEFAULT_LANGUAGE;
  const voices = Array.isArray(localeProfile && localeProfile.voices)
    ? localeProfile.voices.map((voice) => ({
      voiceURI: normalizeText(voice && voice.voiceURI),
      name: normalizeText(voice && voice.name),
      lang: normalizeText(voice && voice.lang) || normalizedLanguage,
      localService: voice ? voice.localService !== false : true,
      default: voice ? voice.default === true : false
    }))
    : [];

  if (voices.length > 0) {
    return voices;
  }

  return [
    {
      voiceURI: `Default Voice - ${normalizedLanguage}`,
      name: 'Default Voice',
      lang: normalizedLanguage,
      localService: true,
      default: true
    }
  ];
}

function buildWindowMetrics(profileKey, screenProfile, devicePixelRatio) {
  const frameWidthSeed = parseInt(createStableHex(profileKey, 'frame-width', 4), 16);
  const frameHeightSeed = parseInt(createStableHex(profileKey, 'frame-height', 4), 16);
  const screenXSeed = parseInt(createStableHex(profileKey, 'screen-x', 4), 16);
  const screenYSeed = parseInt(createStableHex(profileKey, 'screen-y', 4), 16);

  return {
    frameWidth: 12 + (frameWidthSeed % 9),
    frameHeight: 76 + (frameHeightSeed % 33),
    screenX: screenXSeed % (Math.max(32, Math.round(screenProfile.width * 0.18)) + 1),
    screenY: screenYSeed % (Math.max(28, Math.round(screenProfile.height * 0.14)) + 1),
    visualViewportScale: 1
  };
}

function buildNetworkProfile(seed) {
  const networkProfile = pickProfile(NETWORK_PROFILES, seed, 56);

  return {
    key: normalizeText(networkProfile && networkProfile.key),
    effectiveType: normalizeText(networkProfile && networkProfile.effectiveType) || '4g',
    downlink: Number(networkProfile && networkProfile.downlink) || 8,
    rtt: Number(networkProfile && networkProfile.rtt) || 50,
    saveData: Boolean(networkProfile && networkProfile.saveData)
  };
}

function buildAudioProfile(profileKey) {
  const sampleRates = [44100, 48000];
  const index = parseInt(createStableHex(profileKey, 'audio-profile', 2), 16) % sampleRates.length;

  return {
    sampleRate: sampleRates[index]
  };
}

function buildMediaCapabilities(deviceProfile) {
  const baseVideoCodecs = ['avc1', 'vp8', 'vp9', 'av01'];
  const baseAudioCodecs = ['mp4a', 'opus', 'vorbis'];
  const performanceHint = [
    normalizeText(deviceProfile && deviceProfile.key),
    normalizeText(deviceProfile && deviceProfile.webgl && deviceProfile.webgl.vendor),
    normalizeText(deviceProfile && deviceProfile.webgl && deviceProfile.webgl.renderer)
  ]
    .join(' ')
    .toLowerCase();

  return {
    videoCodecs: baseVideoCodecs.slice(),
    audioCodecs: baseAudioCodecs.slice(),
    powerEfficient: performanceHint.includes('intel'),
    smooth: true
  };
}

function buildDomProfile(profileKey) {
  return {
    rectSeed: createStableHex(profileKey, 'dom-rect', 16),
    textSeed: createStableHex(profileKey, 'dom-text', 16)
  };
}

function resolveLocaleProfile(seed, context, preferredLanguage, preferredTimezone, fallbackProfileKey = '') {
  const explicitProfile = findLocaleProfileByLanguageAndTimezone(preferredLanguage, preferredTimezone);

  if (explicitProfile) {
    return explicitProfile;
  }

  const inferredFromProxy = inferLocaleProfileFromProxy(context);

  if (inferredFromProxy) {
    return inferredFromProxy;
  }

  const fallbackProfile = findLocaleProfileByKey(fallbackProfileKey);

  if (fallbackProfile) {
    return fallbackProfile;
  }

  return pickProfile(LOCALE_PROFILES, seed, 8);
}

function buildScreenProfile(deviceProfile) {
  const screen = deviceProfile && deviceProfile.screen ? deviceProfile.screen : {};
  const width = clampInteger(screen.width, 1920, 1024, 7680);
  const height = clampInteger(screen.height, 1080, 600, 4320);
  const taskbarHeight = clampInteger(screen.taskbarHeight, 40, 20, 120);

  return {
    width,
    height,
    availWidth: width,
    availHeight: Math.max(height - taskbarHeight, 560),
    colorDepth: clampInteger(screen.colorDepth, DEFAULT_COLOR_DEPTH, 16, 32),
    pixelDepth: clampInteger(screen.pixelDepth, DEFAULT_COLOR_DEPTH, 16, 32)
  };
}

function buildWebGlProfile(deviceProfile, overrides = {}) {
  const source = deviceProfile && deviceProfile.webgl ? deviceProfile.webgl : {};
  const parameters = source.parameters || {};

  return {
    vendor: normalizeText(overrides.vendor) || normalizeText(source.vendor),
    renderer: normalizeText(overrides.renderer) || normalizeText(source.renderer),
    version: normalizeText(source.version) || 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
    shadingLanguageVersion:
      normalizeText(source.shadingLanguageVersion)
      || 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
    extensions: Array.isArray(source.extensions) ? source.extensions.slice() : [],
    parameters: {
      maxTextureSize: clampInteger(parameters.maxTextureSize, 16384, 2048, 32768),
      maxCubeMapTextureSize: clampInteger(parameters.maxCubeMapTextureSize, 16384, 2048, 32768),
      maxRenderbufferSize: clampInteger(parameters.maxRenderbufferSize, 16384, 2048, 32768),
      maxViewportDims: Array.isArray(parameters.maxViewportDims)
        ? parameters.maxViewportDims.slice(0, 2).map((value, index) => (
          clampInteger(value, index === 0 ? 16384 : 16384, 2048, 32768)
        ))
        : [16384, 16384],
      aliasedLineWidthRange: Array.isArray(parameters.aliasedLineWidthRange)
        ? parameters.aliasedLineWidthRange.slice(0, 2).map((value, index) => (
          clampInteger(value, index === 0 ? 1 : 1, 1, 4096)
        ))
        : [1, 1],
      aliasedPointSizeRange: Array.isArray(parameters.aliasedPointSizeRange)
        ? parameters.aliasedPointSizeRange.slice(0, 2).map((value, index) => (
          clampInteger(value, index === 0 ? 1 : 1024, 1, 4096)
        ))
        : [1, 1024],
      maxVertexAttribs: clampInteger(parameters.maxVertexAttribs, 16, 8, 32),
      maxCombinedTextureImageUnits: clampInteger(
        parameters.maxCombinedTextureImageUnits,
        32,
        8,
        64
      ),
      maxTextureImageUnits: clampInteger(parameters.maxTextureImageUnits, 16, 8, 32),
      maxVertexTextureImageUnits: clampInteger(parameters.maxVertexTextureImageUnits, 16, 4, 32),
      redBits: clampInteger(parameters.redBits, 8, 4, 16),
      greenBits: clampInteger(parameters.greenBits, 8, 4, 16),
      blueBits: clampInteger(parameters.blueBits, 8, 4, 16),
      alphaBits: clampInteger(parameters.alphaBits, 8, 0, 16),
      depthBits: clampInteger(parameters.depthBits, 24, 16, 32),
      stencilBits: clampInteger(parameters.stencilBits, 8, 0, 16)
    },
    shaderPrecision: {
      rangeMin: 127,
      rangeMax: 127,
      precision: 23
    }
  };
}

function buildPermissions(seed) {
  const preset = pickProfile(PERMISSION_PRESETS, seed, 48);

  return {
    geolocation: normalizeText(preset.geolocation) || 'denied',
    notifications: normalizeText(preset.notifications) || 'prompt',
    camera: normalizeText(preset.camera) || 'denied',
    microphone: normalizeText(preset.microphone) || 'denied',
    midi: normalizeText(preset.midi) || 'denied',
    clipboardRead: normalizeText(preset.clipboardRead) || 'prompt',
    clipboardWrite: normalizeText(preset.clipboardWrite) || 'granted'
  };
}

function buildPlugins() {
  return PLUGIN_TEMPLATES.map((plugin) => ({
    name: normalizeText(plugin.name),
    filename: normalizeText(plugin.filename),
    description: normalizeText(plugin.description),
    mimeTypes: Array.isArray(plugin.mimeTypes)
      ? plugin.mimeTypes.map((mimeType) => ({
        type: normalizeText(mimeType.type),
        suffixes: normalizeText(mimeType.suffixes),
        description: normalizeText(mimeType.description)
      }))
      : []
  }));
}

function buildMimeTypes(plugins) {
  return plugins
    .flatMap((plugin) => (
      Array.isArray(plugin.mimeTypes)
        ? plugin.mimeTypes.map((mimeType) => ({
          type: normalizeText(mimeType.type),
          suffixes: normalizeText(mimeType.suffixes),
          description: normalizeText(mimeType.description),
          enabledPluginName: normalizeText(plugin.name)
        }))
        : []
    ))
    .filter((item) => item.type);
}

const CACHED_PLUGINS = Object.freeze(buildPlugins());
const CACHED_MIME_TYPES = Object.freeze(buildMimeTypes(CACHED_PLUGINS));

function buildMediaDevices(profileKey) {
  const groupAudio = `grp_${createStableHex(profileKey, 'audio-group', 10)}`;
  const groupVideo = `grp_${createStableHex(profileKey, 'video-group', 10)}`;

  return [
    {
      kind: 'audioinput',
      label: '',
      deviceId: `dev_${createStableHex(profileKey, 'audio-input', 16)}`,
      groupId: groupAudio
    },
    {
      kind: 'audiooutput',
      label: '',
      deviceId: `dev_${createStableHex(profileKey, 'audio-output', 16)}`,
      groupId: groupAudio
    },
    {
      kind: 'videoinput',
      label: '',
      deviceId: `dev_${createStableHex(profileKey, 'video-input', 16)}`,
      groupId: groupVideo
    }
  ];
}

function buildNoiseProfile(profileKey) {
  return {
    canvas: createStableHex(profileKey, 'canvas-noise', 16),
    audio: createStableHex(profileKey, 'audio-noise', 16)
  };
}

function buildDisabledFingerprintConfig(baseProfile, options = {}) {
  const baseScreen = baseProfile && baseProfile.screen ? baseProfile.screen : {};
  const fingerprintSeed = normalizeFingerprintSeed(
    readInputValue(options, 'fingerprintSeed', 'seed') || baseProfile.fingerprintSeed
  );

  return {
    ...baseProfile,
    mode: FINGERPRINT_MODES.off,
    fingerprintSeed,
    profileKey: '',
    deviceProfileKey: '',
    localeProfileKey: '',
    userAgent: '',
    platform: '',
    language: '',
    languages: [],
    timezone: '',
    screen: {
      width: normalizeText(baseScreen.width),
      height: normalizeText(baseScreen.height),
      availWidth: normalizeText(baseScreen.availWidth),
      availHeight: normalizeText(baseScreen.availHeight),
      colorDepth: normalizeText(baseScreen.colorDepth),
      pixelDepth: normalizeText(baseScreen.pixelDepth)
    },
    hardwareConcurrency: '',
    deviceMemory: '',
    devicePixelRatio: '',
    vendor: '',
    productSub: '',
    doNotTrack: '',
    maxTouchPoints: '',
    webglVendor: '',
    webglRenderer: '',
    webgl: {
      vendor: '',
      renderer: '',
      version: '',
      shadingLanguageVersion: '',
      extensions: [],
      parameters: {
        maxTextureSize: '',
        maxCubeMapTextureSize: '',
        maxRenderbufferSize: '',
        maxViewportDims: [],
        aliasedLineWidthRange: [],
        aliasedPointSizeRange: [],
        maxVertexAttribs: '',
        maxCombinedTextureImageUnits: '',
        maxTextureImageUnits: '',
        maxVertexTextureImageUnits: '',
        redBits: '',
        greenBits: '',
        blueBits: '',
        alphaBits: '',
        depthBits: '',
        stencilBits: ''
      },
      shaderPrecision: {
        rangeMin: '',
        rangeMax: '',
        precision: ''
      }
    },
    permissions: {},
    plugins: [],
    mimeTypes: [],
    fontFamilies: [],
    speechVoices: [],
    mediaDevices: [],
    noiseProfile: {
      canvas: '',
      audio: ''
    },
    domProfile: {
      rectSeed: '',
      textSeed: ''
    },
    windowMetrics: {
      frameWidth: '',
      frameHeight: '',
      screenX: '',
      screenY: '',
      visualViewportScale: ''
    },
    networkProfile: {
      key: '',
      effectiveType: '',
      downlink: '',
      rtt: '',
      saveData: ''
    },
    audioProfile: {
      sampleRate: ''
    },
    mediaCapabilities: {
      videoCodecs: [],
      audioCodecs: [],
      powerEfficient: '',
      smooth: ''
    },
    webrtcPolicy: {
      mode: '',
      blockLocalIps: '',
      filterHostCandidates: ''
    }
  };
}

function buildBaseProfile(identity, options = {}) {
  const seedInput = normalizeFingerprintSeed(readInputValue(options, 'seedInput'));
  const fingerprintSeed = normalizeFingerprintSeed(
    readInputValue(options, 'fingerprintSeed') || seedInput
  );
  const seed = createSeed(identity, seedInput);
  const preferRuntimeDeviceProfile =
    readInputValue(options, 'preferRuntimeDeviceProfile') !== false;
  const runtimeDeviceProfile =
    preferRuntimeDeviceProfile && identity && identity.context && identity.context.deviceProfile
      ? identity.context.deviceProfile
      : null;
  const deviceProfile = runtimeDeviceProfile || pickProfile(DEVICE_PROFILES, seed, 0);
  const localeProfile = resolveLocaleProfile(
    seed,
    seedInput ? null : (identity && identity.context),
    '',
    '',
    ''
  );
  const screenProfile = buildScreenProfile(deviceProfile);
  const webglProfile = buildWebGlProfile(deviceProfile);
  const profileKey = `fp_${seed.slice(0, 16)}`;
  const plugins = CACHED_PLUGINS;
  const mimeTypes = CACHED_MIME_TYPES;
  const windowMetrics = buildWindowMetrics(
    profileKey,
    screenProfile,
    clampNumber(
      deviceProfile && deviceProfile.screen && deviceProfile.screen.devicePixelRatio,
      DEFAULT_DEVICE_PIXEL_RATIO,
      1,
      4,
      2
    )
  );

  return {
    mode: FINGERPRINT_MODES.auto,
    fingerprintSeed,
    profileKey,
    deviceProfileKey: normalizeText(deviceProfile && deviceProfile.key),
    localeProfileKey: normalizeText(localeProfile && localeProfile.key),
    userAgent: normalizeText(deviceProfile && deviceProfile.userAgent),
    platform: normalizeText(deviceProfile && deviceProfile.platform) || DEFAULT_PLATFORM,
    language: normalizeText(localeProfile && localeProfile.language) || DEFAULT_LANGUAGE,
    languages: normalizeLanguages(
      localeProfile && localeProfile.languages,
      DEFAULT_LANGUAGES
    ),
    timezone: normalizeText(localeProfile && localeProfile.timezone) || DEFAULT_TIMEZONE,
    screen: screenProfile,
    hardwareConcurrency: clampInteger(
      deviceProfile && deviceProfile.hardware && deviceProfile.hardware.hardwareConcurrency,
      8,
      2,
      64
    ),
    deviceMemory: clampInteger(
      deviceProfile && deviceProfile.hardware && deviceProfile.hardware.deviceMemory,
      8,
      2,
      128
    ),
    devicePixelRatio: clampNumber(
      deviceProfile && deviceProfile.screen && deviceProfile.screen.devicePixelRatio,
      DEFAULT_DEVICE_PIXEL_RATIO,
      1,
      4,
      2
    ),
    vendor: normalizeText(deviceProfile && deviceProfile.vendor) || DEFAULT_VENDOR,
    productSub: normalizeText(deviceProfile && deviceProfile.productSub) || DEFAULT_PRODUCT_SUB,
    doNotTrack: normalizeText(deviceProfile && deviceProfile.doNotTrack) || DEFAULT_DO_NOT_TRACK,
    maxTouchPoints: clampInteger(
      deviceProfile && deviceProfile.hardware && deviceProfile.hardware.maxTouchPoints,
      DEFAULT_MAX_TOUCH_POINTS,
      0,
      16
    ),
    webglVendor: webglProfile.vendor,
    webglRenderer: webglProfile.renderer,
    webgl: webglProfile,
    permissions: buildPermissions(seed),
    plugins,
    mimeTypes,
    fontFamilies: buildFontFamilies(localeProfile),
    speechVoices: buildSpeechVoices(
      localeProfile,
      normalizeText(localeProfile && localeProfile.language) || DEFAULT_LANGUAGE
    ),
    mediaDevices: buildMediaDevices(profileKey),
    noiseProfile: buildNoiseProfile(profileKey),
    domProfile: buildDomProfile(profileKey),
    windowMetrics,
    networkProfile: buildNetworkProfile(seed),
    audioProfile: buildAudioProfile(profileKey),
    mediaCapabilities: buildMediaCapabilities(deviceProfile),
    webrtcPolicy: {
      mode: 'proxy-only',
      blockLocalIps: true,
      filterHostCandidates: true
    }
  };
}

function applyOverrides(baseProfile, overrides, context = {}) {
  const fallbackLanguages = cloneArray(baseProfile.languages);
  const nextMode = resolveFingerprintModeValue(overrides, baseProfile.mode);
  const fingerprintSeed =
    resolveFingerprintSeed(overrides, nextMode)
    || normalizeFingerprintSeed(baseProfile.fingerprintSeed);
  const preferRuntimeDeviceFields = Boolean(
    context
    && context.deviceProfile
    && nextMode === FINGERPRINT_MODES.auto
  );
  const profileKey = normalizeText(overrides && overrides.profileKey) || baseProfile.profileKey;
  const plugins = CACHED_PLUGINS;
  const mimeTypes = CACHED_MIME_TYPES;
  const seed = createStableHex(profileKey, 'fingerprint-seed', 64);
  const languages = normalizeLanguages(
    overrides && (overrides.languages || overrides.languageList),
    fallbackLanguages
  );
  const language = normalizeText(overrides && overrides.language) || languages[0] || DEFAULT_LANGUAGE;
  const screenWidth = clampInteger(
    overrides && (overrides.screenWidth || (overrides.screen && overrides.screen.width)),
    baseProfile.screen.width,
    1024,
    7680
  );
  const screenHeight = clampInteger(
    overrides && (overrides.screenHeight || (overrides.screen && overrides.screen.height)),
    baseProfile.screen.height,
    600,
    4320
  );
  const availWidth = clampInteger(
    overrides && (overrides.availWidth || (overrides.screen && overrides.screen.availWidth)),
    screenWidth,
    800,
    7680
  );
  const availHeight = clampInteger(
    overrides && (overrides.availHeight || (overrides.screen && overrides.screen.availHeight)),
    Math.max(screenHeight - 40, 600),
    560,
    4320
  );
  const localeProfile = resolveLocaleProfile(
    seed,
    context,
    language,
    normalizeText(overrides && overrides.timezone) || baseProfile.timezone,
    baseProfile.localeProfileKey
  );
  const nextProfile = {
    ...baseProfile,
    mode: nextMode,
    fingerprintSeed,
    profileKey,
    userAgent:
      preferRuntimeDeviceFields
        ? baseProfile.userAgent
        : (normalizeText(overrides && overrides.userAgent) || baseProfile.userAgent),
    platform:
      preferRuntimeDeviceFields
        ? baseProfile.platform
        : (normalizeText(overrides && overrides.platform) || baseProfile.platform),
    language,
    languages,
    timezone: normalizeText(overrides && overrides.timezone) || normalizeText(localeProfile && localeProfile.timezone) || baseProfile.timezone,
    localeProfileKey: normalizeText(localeProfile && localeProfile.key) || baseProfile.localeProfileKey,
    screen: {
      width: screenWidth,
      height: screenHeight,
      availWidth: Math.min(availWidth, screenWidth),
      availHeight: Math.min(availHeight, screenHeight),
      colorDepth: clampInteger(
        overrides && (overrides.colorDepth || (overrides.screen && overrides.screen.colorDepth)),
        baseProfile.screen.colorDepth,
        16,
        32
      ),
      pixelDepth: clampInteger(
        overrides && (overrides.pixelDepth || (overrides.screen && overrides.screen.pixelDepth)),
        baseProfile.screen.pixelDepth,
        16,
        32
      )
    },
    hardwareConcurrency: clampInteger(
      preferRuntimeDeviceFields
        ? baseProfile.hardwareConcurrency
        : (overrides && overrides.hardwareConcurrency),
      baseProfile.hardwareConcurrency,
      2,
      64
    ),
    deviceMemory: clampInteger(
      preferRuntimeDeviceFields
        ? baseProfile.deviceMemory
        : (overrides && overrides.deviceMemory),
      baseProfile.deviceMemory,
      2,
      128
    ),
    devicePixelRatio: clampNumber(
      preferRuntimeDeviceFields
        ? baseProfile.devicePixelRatio
        : (overrides && overrides.devicePixelRatio),
      baseProfile.devicePixelRatio,
      1,
      4,
      2
    ),
    vendor:
      preferRuntimeDeviceFields
        ? baseProfile.vendor
        : (normalizeText(overrides && overrides.vendor) || baseProfile.vendor),
    productSub:
      preferRuntimeDeviceFields
        ? baseProfile.productSub
        : (normalizeText(overrides && overrides.productSub) || baseProfile.productSub),
    doNotTrack:
      preferRuntimeDeviceFields
        ? baseProfile.doNotTrack
        : (normalizeText(overrides && overrides.doNotTrack) || baseProfile.doNotTrack),
    maxTouchPoints: clampInteger(
      preferRuntimeDeviceFields
        ? baseProfile.maxTouchPoints
        : (overrides && overrides.maxTouchPoints),
      baseProfile.maxTouchPoints,
      0,
      16
    ),
    webglVendor:
      preferRuntimeDeviceFields
        ? baseProfile.webglVendor
        : (normalizeText(overrides && overrides.webglVendor) || baseProfile.webglVendor),
    webglRenderer:
      preferRuntimeDeviceFields
        ? baseProfile.webglRenderer
        : (normalizeText(overrides && overrides.webglRenderer) || baseProfile.webglRenderer)
  };

  return {
    ...nextProfile,
    webgl: {
      ...buildWebGlProfile({ webgl: baseProfile.webgl }, {
        vendor: nextProfile.webglVendor,
        renderer: nextProfile.webglRenderer
      }),
      vendor: nextProfile.webglVendor,
      renderer: nextProfile.webglRenderer
    },
    permissions: {
      ...(baseProfile.permissions || buildPermissions(createStableHex(profileKey, 'permissions', 64)))
    },
    plugins,
    mimeTypes,
    fontFamilies: buildFontFamilies(localeProfile),
    speechVoices: buildSpeechVoices(localeProfile, language),
    mediaDevices: buildMediaDevices(profileKey),
    noiseProfile: buildNoiseProfile(profileKey),
    domProfile: buildDomProfile(profileKey),
    windowMetrics: buildWindowMetrics(profileKey, nextProfile.screen, nextProfile.devicePixelRatio),
    networkProfile: buildNetworkProfile(seed),
    audioProfile: buildAudioProfile(profileKey),
    mediaCapabilities: buildMediaCapabilities({
      key: baseProfile.deviceProfileKey,
      webgl: baseProfile.webgl
    }),
    webrtcPolicy: {
      mode: 'proxy-only',
      blockLocalIps: true,
      filterHostCandidates: true
    }
  };
}

function extractCustomOverrides(payload) {
  return {
    mode: resolveFingerprintModeValue(payload),
    fingerprintSeed: resolveFingerprintSeed(payload),
    profileKey: readInputValue(payload, 'profileKey'),
    userAgent: readInputValue(payload, 'fingerprintUserAgent', 'userAgent'),
    platform: readInputValue(payload, 'fingerprintPlatform', 'platform'),
    language: readInputValue(payload, 'fingerprintLanguage', 'language'),
    languages: readInputValue(payload, 'fingerprintLanguages', 'languages', 'languageList'),
    timezone: readInputValue(payload, 'fingerprintTimezone', 'timezone'),
    screenWidth:
      readInputValue(payload, 'fingerprintScreenWidth', 'screenWidth')
      ?? (payload && payload.screen && payload.screen.width),
    availWidth:
      readInputValue(payload, 'fingerprintAvailWidth', 'availWidth')
      ?? (payload && payload.screen && payload.screen.availWidth),
    screenHeight:
      readInputValue(payload, 'fingerprintScreenHeight', 'screenHeight')
      ?? (payload && payload.screen && payload.screen.height),
    availHeight:
      readInputValue(payload, 'fingerprintAvailHeight', 'availHeight')
      ?? (payload && payload.screen && payload.screen.availHeight),
    colorDepth:
      readInputValue(payload, 'fingerprintColorDepth', 'colorDepth')
      ?? (payload && payload.screen && payload.screen.colorDepth),
    pixelDepth:
      readInputValue(payload, 'fingerprintPixelDepth', 'pixelDepth')
      ?? (payload && payload.screen && payload.screen.pixelDepth),
    hardwareConcurrency: readInputValue(
      payload,
      'fingerprintHardwareConcurrency',
      'hardwareConcurrency'
    ),
    deviceMemory: readInputValue(payload, 'fingerprintDeviceMemory', 'deviceMemory'),
    devicePixelRatio: readInputValue(payload, 'fingerprintDevicePixelRatio', 'devicePixelRatio'),
    vendor: readInputValue(payload, 'fingerprintVendor', 'vendor'),
    productSub: readInputValue(payload, 'fingerprintProductSub', 'productSub'),
    doNotTrack: readInputValue(payload, 'fingerprintDoNotTrack', 'doNotTrack'),
    maxTouchPoints: readInputValue(payload, 'fingerprintMaxTouchPoints', 'maxTouchPoints'),
    webglVendor: readInputValue(payload, 'fingerprintWebglVendor', 'webglVendor'),
    webglRenderer: readInputValue(payload, 'fingerprintWebglRenderer', 'webglRenderer')
  };
}

function buildFingerprintConfig(payload, identity, context = {}) {
  const mode = resolveEffectiveFingerprintMode(payload);
  const fingerprintSeed = resolveFingerprintSeed(payload, mode);
  const baseProfile = buildBaseProfile({
    ...identity,
    context: {
      ...(shouldUseFixedSeedMode(mode) ? {} : context),
      proxyConfig: normalizeProxyContext(payload)
    }
  }, {
    seedInput: mode === FINGERPRINT_MODES.custom ? fingerprintSeed : '',
    fingerprintSeed,
    preferRuntimeDeviceProfile: !shouldUseFixedSeedMode(mode)
  });

  if (mode === FINGERPRINT_MODES.off) {
    return buildDisabledFingerprintConfig(baseProfile, {
      fingerprintSeed
    });
  }

  if (mode === FINGERPRINT_MODES.custom) {
    return applyOverrides(baseProfile, {
      ...extractCustomOverrides(payload),
      mode,
      fingerprintSeed
    }, {
      proxyConfig: normalizeProxyContext(payload),
      ...context
    });
  }

  return {
    ...baseProfile,
    mode,
    fingerprintSeed
  };
}

function normalizeFingerprintConfig(input, identity, context = {}) {
  const mode = resolveEffectiveFingerprintMode(input);
  const fingerprintSeed = resolveFingerprintSeed(input, mode);
  const baseProfile = buildBaseProfile({
    ...identity,
    context: shouldUseFixedSeedMode(mode) ? {} : context
  }, {
    seedInput: mode === FINGERPRINT_MODES.custom ? fingerprintSeed : '',
    fingerprintSeed,
    preferRuntimeDeviceProfile: !shouldUseFixedSeedMode(mode)
  });

  if (mode === FINGERPRINT_MODES.off) {
    return buildDisabledFingerprintConfig(baseProfile, {
      fingerprintSeed
    });
  }

  if (mode === FINGERPRINT_MODES.auto) {
    return {
      ...baseProfile,
      mode,
      fingerprintSeed
    };
  }

  return applyOverrides(baseProfile, {
    ...(input || {}),
    mode,
    fingerprintSeed
  }, context);
}

module.exports = {
  FINGERPRINT_MODES,
  normalizeFingerprintMode,
  buildFingerprintConfig,
  normalizeFingerprintConfig
};
