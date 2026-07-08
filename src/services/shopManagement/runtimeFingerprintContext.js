const os = require('node:os');
const { screen } = require('electron');
const {
  DEFAULT_COLOR_DEPTH,
  DEFAULT_DEVICE_PIXEL_RATIO,
  DEFAULT_DO_NOT_TRACK,
  DEFAULT_PLATFORM,
  DEFAULT_PRODUCT_SUB,
  DEFAULT_VENDOR,
  DEVICE_PROFILES
} = require('./fingerprintCatalog');
const { DEFAULT_TEMU_USER_AGENT } = require('./defaultUserAgent');

let cachedRuntimeContextPromise = null;
let displayChangeHandlerAttached = false;
let hotplugPromise = null;

function normalizeText(value) {
  return String(value || '').trim();
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

function parseChromeMajorVersion(userAgent) {
  const match = /Chrome\/(\d+)/i.exec(normalizeText(userAgent));
  return Number(match && match[1]) || 0;
}

function detectPlatform(userAgent) {
  const normalizedUserAgent = normalizeText(userAgent);

  if (/windows/i.test(normalizedUserAgent)) {
    return 'Win32';
  }

  if (/macintosh|mac os x/i.test(normalizedUserAgent)) {
    return 'MacIntel';
  }

  if (/linux/i.test(normalizedUserAgent)) {
    return /arm|aarch64/i.test(normalizedUserAgent) ? 'Linux armv8l' : 'Linux x86_64';
  }

  return DEFAULT_PLATFORM;
}

function normalizeDisplayMetrics(display) {
  const size = display && display.size ? display.size : {};
  const workAreaSize = display && display.workAreaSize ? display.workAreaSize : {};
  const width = clampNumber(size.width, 1920, 1024, 7680);
  const height = clampNumber(size.height, 1080, 600, 4320);
  const availWidth = clampNumber(workAreaSize.width, width, 800, 7680);
  const availHeight = clampNumber(workAreaSize.height, Math.max(height - 40, 560), 560, 4320);
  const taskbarHeight = Math.max(20, Math.min(120, height - availHeight || 40));

  return {
    width,
    height,
    availWidth: Math.min(availWidth, width),
    availHeight: Math.min(availHeight, height),
    taskbarHeight,
    devicePixelRatio: clampNumber(
      display && display.scaleFactor,
      DEFAULT_DEVICE_PIXEL_RATIO,
      1,
      4,
      2
    ),
    colorDepth: clampNumber(display && display.colorDepth, DEFAULT_COLOR_DEPTH, 16, 32),
    pixelDepth: clampNumber(display && display.colorDepth, DEFAULT_COLOR_DEPTH, 16, 32)
  };
}

function normalizeHardwareProfile() {
  const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 0;
  const memoryGb = os.totalmem() / (1024 ** 3);

  return {
    hardwareConcurrency: clampNumber(cpuCount, 8, 2, 64),
    deviceMemory: clampNumber(memoryGb, 8, 2, 128),
    maxTouchPoints: 0
  };
}

function detectGpuFamily(text) {
  const normalizedText = normalizeText(text).toLowerCase();

  if (!normalizedText) {
    return '';
  }

  if (normalizedText.includes('nvidia')) {
    return 'NVIDIA';
  }

  if (normalizedText.includes('intel')) {
    return 'Intel';
  }

  if (normalizedText.includes('amd') || normalizedText.includes('radeon')) {
    return 'AMD';
  }

  return '';
}

function pickClosestCatalogProfile(userAgent, displayMetrics, gpuInfo) {
  const platform = detectPlatform(userAgent);
  const chromeMajorVersion = parseChromeMajorVersion(userAgent);
  const gpuHint = [
    normalizeText(gpuInfo && gpuInfo.vendor),
    normalizeText(gpuInfo && gpuInfo.renderer)
  ]
    .filter(Boolean)
    .join(' ');
  const gpuFamily = detectGpuFamily(gpuHint);

  const scoredProfiles = DEVICE_PROFILES.map((profile) => {
    let score = 0;

    if (detectPlatform(profile.userAgent) === platform) {
      score += 60;
    }

    if (gpuFamily) {
      if (detectGpuFamily(profile.webgl && profile.webgl.renderer) === gpuFamily) {
        score += 45;
      }

      if (detectGpuFamily(profile.webgl && profile.webgl.vendor) === gpuFamily) {
        score += 30;
      }
    }

    const profileChromeMajorVersion = parseChromeMajorVersion(profile.userAgent);
    score -= Math.abs(profileChromeMajorVersion - chromeMajorVersion) * 4;
    score -= Math.abs((profile.screen && profile.screen.width) - displayMetrics.width) / 24;
    score -= Math.abs((profile.screen && profile.screen.height) - displayMetrics.height) / 24;

    return {
      profile,
      score
    };
  }).sort((left, right) => right.score - left.score);

  return scoredProfiles[0] ? scoredProfiles[0].profile : DEVICE_PROFILES[0];
}

function normalizeGpuSnapshot(gpuInfo, templateProfile) {
  const auxAttributes = gpuInfo && typeof gpuInfo === 'object' ? (gpuInfo.auxAttributes || {}) : {};
  const gpuDevices = Array.isArray(gpuInfo && gpuInfo.gpuDevice) ? gpuInfo.gpuDevice : [];
  const activeGpuDevice = gpuDevices.find((device) => device && device.active) || gpuDevices[0] || {};
  const rawVendor = normalizeText(auxAttributes.glVendor || activeGpuDevice.vendorString);
  const rawRenderer = normalizeText(auxAttributes.glRenderer || activeGpuDevice.deviceString);
  const gpuFamily = detectGpuFamily(`${rawVendor} ${rawRenderer}`);
  const familyLabel = gpuFamily || detectGpuFamily(templateProfile && templateProfile.webgl && templateProfile.webgl.renderer) || 'Intel';
  const normalizedVendor = rawVendor || `${DEFAULT_VENDOR} (${familyLabel})`;
  const normalizedRenderer = rawRenderer
    ? (rawRenderer.startsWith('ANGLE ') || rawRenderer.startsWith('ANGLE(') ? rawRenderer : `ANGLE (${familyLabel}, ${rawRenderer}, D3D11)`)
    : normalizeText(templateProfile && templateProfile.webgl && templateProfile.webgl.renderer);
  const normalizedExtensions = normalizeText(auxAttributes.glExtensions)
    .split(/\s+/)
    .map(normalizeText)
    .filter(Boolean);

  return {
    vendor: normalizedVendor,
    renderer: normalizedRenderer,
    version: normalizeText(auxAttributes.glVersion) || normalizeText(templateProfile && templateProfile.webgl && templateProfile.webgl.version),
    extensions: normalizedExtensions
  };
}

function buildRuntimeDeviceProfile(userAgent, display, gpuInfo) {
  const displayMetrics = normalizeDisplayMetrics(display);
  const templateProfile = pickClosestCatalogProfile(userAgent, displayMetrics, gpuInfo);
  const hardwareProfile = normalizeHardwareProfile();
  const gpuSnapshot = normalizeGpuSnapshot(gpuInfo, templateProfile);

  return {
    key: `runtime_${detectPlatform(userAgent).toLowerCase()}_${detectGpuFamily(gpuSnapshot.renderer).toLowerCase() || 'default'}`,
    userAgent: normalizeText(userAgent) || normalizeText(templateProfile && templateProfile.userAgent),
    platform: detectPlatform(userAgent),
    vendor: DEFAULT_VENDOR,
    productSub: DEFAULT_PRODUCT_SUB,
    doNotTrack: DEFAULT_DO_NOT_TRACK,
    screen: {
      width: displayMetrics.width,
      height: displayMetrics.height,
      taskbarHeight: displayMetrics.taskbarHeight,
      devicePixelRatio: displayMetrics.devicePixelRatio,
      colorDepth: displayMetrics.colorDepth,
      pixelDepth: displayMetrics.pixelDepth
    },
    hardware: hardwareProfile,
    webgl: {
      ...(templateProfile && templateProfile.webgl ? templateProfile.webgl : {}),
      vendor: gpuSnapshot.vendor || normalizeText(templateProfile && templateProfile.webgl && templateProfile.webgl.vendor),
      renderer: gpuSnapshot.renderer || normalizeText(templateProfile && templateProfile.webgl && templateProfile.webgl.renderer),
      version: gpuSnapshot.version || normalizeText(templateProfile && templateProfile.webgl && templateProfile.webgl.version),
      extensions:
        gpuSnapshot.extensions && gpuSnapshot.extensions.length > 0
          ? gpuSnapshot.extensions
          : (templateProfile && templateProfile.webgl && templateProfile.webgl.extensions
            ? templateProfile.webgl.extensions.slice()
            : [])
    }
  };
}

async function buildRuntimeFingerprintContext(appInstance) {
  const primaryDisplay = screen.getPrimaryDisplay();
  let gpuInfo = null;

  if (appInstance && typeof appInstance.getGPUInfo === 'function') {
    try {
      gpuInfo = await appInstance.getGPUInfo('complete');
    } catch (_error) {
      gpuInfo = null;
    }
  }

  return {
    deviceProfile: buildRuntimeDeviceProfile(DEFAULT_TEMU_USER_AGENT, primaryDisplay, gpuInfo)
  };
}

async function fastBuildRuntimeFingerprintContext(appInstance) {
  const primaryDisplay = screen.getPrimaryDisplay();

  if (appInstance && typeof appInstance.getGPUInfo === 'function') {
    const gpuPromise = appInstance.getGPUInfo('complete').catch(() => null);
    const resolvedGpuInfo = await Promise.race([
      gpuPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), 200))
    ]);

    if (resolvedGpuInfo) {
      return {
        deviceProfile: buildRuntimeDeviceProfile(DEFAULT_TEMU_USER_AGENT, primaryDisplay, resolvedGpuInfo)
      };
    }

    gpuPromise.then((gpuInfo) => {
      if (gpuInfo && cachedRuntimeContextPromise) {
        cachedRuntimeContextPromise = Promise.resolve({
          deviceProfile: buildRuntimeDeviceProfile(DEFAULT_TEMU_USER_AGENT, primaryDisplay, gpuInfo)
        });
      }
    });
  }

  return {
    deviceProfile: buildRuntimeDeviceProfile(DEFAULT_TEMU_USER_AGENT, primaryDisplay, null)
  };
}

function attachDisplayChangeHandler(appInstance) {
  if (displayChangeHandlerAttached) {
    return;
  }

  displayChangeHandlerAttached = true;

  try {
    screen.on('display-metrics-changed', () => {
      if (!hotplugPromise) {
        hotplugPromise = Promise.resolve().then(() => {
          hotplugPromise = null;
          cachedRuntimeContextPromise = fastBuildRuntimeFingerprintContext(appInstance);
          return cachedRuntimeContextPromise;
        });
      }
    });
  } catch (_error) {
    // Ignore display listener attachment failures.
  }
}

async function getRuntimeFingerprintContext(appInstance) {
  attachDisplayChangeHandler(appInstance);

  if (!cachedRuntimeContextPromise) {
    cachedRuntimeContextPromise = fastBuildRuntimeFingerprintContext(appInstance).catch((error) => {
      cachedRuntimeContextPromise = null;
      throw error;
    });
  }

  const context = await cachedRuntimeContextPromise;

  return {
    ...(context || {}),
    deviceProfile:
      context && context.deviceProfile
        ? {
          ...context.deviceProfile,
          screen: context.deviceProfile.screen ? { ...context.deviceProfile.screen } : {},
          hardware: context.deviceProfile.hardware ? { ...context.deviceProfile.hardware } : {},
          webgl: context.deviceProfile.webgl
            ? {
              ...context.deviceProfile.webgl,
              parameters: context.deviceProfile.webgl.parameters
                ? { ...context.deviceProfile.webgl.parameters }
                : {},
              extensions: Array.isArray(context.deviceProfile.webgl.extensions)
                ? context.deviceProfile.webgl.extensions.slice()
                : []
            }
            : {}
        }
        : null
  };
}

module.exports = {
  getRuntimeFingerprintContext
};
