(() => {
  const crypto = require('node:crypto');
  const { buildUserAgentMetadata } = require('./fingerprintRuntimeUtils');

  const FINGERPRINT_ARGUMENT_PREFIX = '--temu-shop-fingerprint=';
  const AUTH_ARGUMENT_PREFIX = '--temu-shop-auth=';
  const WEBGL_VENDOR_KEY = 37445;
  const WEBGL_RENDERER_KEY = 37446;
  const WEBGL_VENDOR_NAME_KEY = 7936;
  const WEBGL_RENDERER_NAME_KEY = 7937;
  const WEBGL_VERSION_KEY = 7938;
  const WEBGL_SHADING_LANGUAGE_VERSION_KEY = 35724;
  const WEBGL_MAX_TEXTURE_SIZE_KEY = 3379;
  const WEBGL_MAX_VIEWPORT_DIMS_KEY = 3386;
  const WEBGL_ALIASED_POINT_SIZE_RANGE_KEY = 33901;
  const WEBGL_ALIASED_LINE_WIDTH_RANGE_KEY = 33902;
  const WEBGL_RED_BITS_KEY = 3410;
  const WEBGL_GREEN_BITS_KEY = 3411;
  const WEBGL_BLUE_BITS_KEY = 3412;
  const WEBGL_ALPHA_BITS_KEY = 3413;
  const WEBGL_DEPTH_BITS_KEY = 3414;
  const WEBGL_STENCIL_BITS_KEY = 3415;
  const WEBGL_MAX_RENDERBUFFER_SIZE_KEY = 34024;
  const WEBGL_MAX_CUBE_MAP_TEXTURE_SIZE_KEY = 34076;
  const WEBGL_MAX_VERTEX_ATTRIBS_KEY = 34921;
  const WEBGL_MAX_TEXTURE_IMAGE_UNITS_KEY = 34930;
  const WEBGL_MAX_VERTEX_TEXTURE_IMAGE_UNITS_KEY = 35660;
  const WEBGL_MAX_COMBINED_TEXTURE_IMAGE_UNITS_KEY = 35661;
  const MAX_CANVAS_NOISE_PIXELS = 24;
  const MAX_AUDIO_NOISE_POINTS = 12;
  const CANVAS_MAX_DIMENSION = 2048;
  const AUTOFILL_RETRY_LIMIT = 20;
  const AUTOFILL_RETRY_INTERVAL_MS = 900;
  const AUTOFILL_DEBOUNCE_MS = 120;
  const SELLER_LOGIN_AUTO_SUBMIT_MAX_ATTEMPTS = 4;
  const CAPTCHA_MAX_DIMENSION = 400;
  const SELLER_LOGIN_AUTO_SUBMIT_COOLDOWN_MS = 1400;
  const ACCOUNT_HINT_PATTERNS = [
    /phone/i,
    /mobile/i,
    /email/i,
    /mail/i,
    /account/i,
    /username/i,
    /login/i,
    /seller/i,
    /user/i,
    /\u624b\u673a/u,
    /\u90ae\u7bb1/u,
    /\u8d26\u53f7/u,
    /\u767b\u5f55/u
  ];
  const PASSWORD_HINT_PATTERNS = [
    /password/i,
    /passwd/i,
    /pwd/i,
    /\u5bc6\u7801/u
  ];
  const OTP_HINT_PATTERNS = [
    /otp/i,
    /code/i,
    /captcha/i,
    /verify/i,
    /verification/i,
    /sms/i,
    /\u9a8c\u8bc1/u,
    /\u77ed\u4fe1/u
  ];
  const LOGIN_CONTEXT_PATTERNS = [
    /login/i,
    /sign[\s-]?in/i,
    /passport/i,
    /account/i,
    /seller/i,
    /\u767b\u5f55/u,
    /\u8d26\u53f7/u,
    /\u624b\u673a/u
  ];
  const SELLER_LOGIN_HOST_PATTERNS = [
    /(^|\.)kuajingmaihuo\.com$/i
  ];
  const SELLER_LOGIN_PATH_PATTERNS = [
    /^\/settle\/seller-login$/i,
    /^\/login$/i
  ];
  const ACTIVITY_LOGIN_PATH_PATTERNS = [
    /^\/settle\/activity-login$/i
  ];
  const ACCOUNT_LOGIN_MODE_HINT_PATTERNS = [
    /account\s*password\s*login/i,
    /account\s*login/i,
    /password\s*login/i,
    /\u8d26\u53f7\u5bc6\u7801\u767b\u5f55/u,
    /\u8d26\u53f7\u767b\u5f55/u,
    /\u5bc6\u7801\u767b\u5f55/u
  ];
  const OTP_LOGIN_MODE_HINT_PATTERNS = [
    /sms\s*login/i,
    /code\s*login/i,
    /otp/i,
    /\u9a8c\u8bc1\u7801\u767b\u5f55/u,
    /\u77ed\u4fe1\u767b\u5f55/u
  ];
  const EMAIL_LOGIN_MODE_HINT_PATTERNS = [
    /email(\s*account)?\s*login/i,
    /email/i,
    /\u90AE\u7BB1(\u8d26\u53f7)?\u767B\u5F55/u,
    /\u90AE\u7BB1/u
  ];
  const SCAN_LOGIN_MODE_HINT_PATTERNS = [
    /scan\s*(qr|code)\s*login/i,
    /qr\s*login/i,
    /scan\s*login/i,
    /\u626b\u7801\u767b\u5f55/u,
    /\u626b\u7801/u
  ];
  const ACCOUNT_LOGIN_SWITCH_PATH_PATTERNS = [
    /^\/login$/i,
    /^\/settle\/activity-login$/i
  ];
  const BROWSER_SAVED_AUTH_STORAGE_KEY = 'temu_toolbox_browser_saved_auth_v1';
  const REGION_HINT_PATTERNS = [
    /country/i,
    /region/i,
    /area/i,
    /calling/i,
    /dial/i,
    /code/i,
    /prefix/i,
    /\+\s*\d{1,4}/,
    /\u533a\u53f7/u,
    /\u56fd\u5bb6/u,
    /\u5730\u533a/u
  ];
  const HONG_KONG_REGION_PATTERNS = [
    /hong\s*kong/i,
    /\bhk\b/i,
    /\+?\s*852\b/,
    /\u9999\u6e2f/u
  ];
  const MAINLAND_REGION_PATTERNS = [
    /china/i,
    /\+?\s*86\b/,
    /\u4e2d\u56fd/u,
    /\u5927\u9646/u
  ];
  const sellerLoginAutoSubmitAttempts = new Map();

  function parseArgumentPayload(prefix) {
    const argument = process.argv.find((item) => item.startsWith(prefix));

    if (!argument) {
      return null;
    }

    try {
      const encodedValue = argument.slice(prefix.length);
      const jsonText = Buffer.from(encodedValue, 'base64').toString('utf8');
      return JSON.parse(jsonText);
    } catch (_error) {
      return null;
    }
  }

  function parseFingerprintConfig() {
    return parseArgumentPayload(FINGERPRINT_ARGUMENT_PREFIX);
  }

  function parseAuthConfig() {
    return parseArgumentPayload(AUTH_ARGUMENT_PREFIX);
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeAccountValue(value) {
    return String(value || '').replace(/[\s\u200B-\u200D\uFEFF]+/g, '');
  }

  function normalizeDigits(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAccountValue(value));
  }

  function resolveAuthIdentity(authConfig) {
    const source = authConfig && typeof authConfig === 'object' ? authConfig : {};
    const explicitAccountType = normalizeText(source.accountType).toLowerCase();
    const phoneNumber = normalizeAccountValue(source.phoneNumber);
    const email = normalizeAccountValue(source.email);
    const accountValue = normalizeAccountValue(
      Object.prototype.hasOwnProperty.call(source, 'accountValue')
        ? source.accountValue
        : (email || phoneNumber)
    );

    if (explicitAccountType === 'email') {
      const explicitEmail = email || accountValue || phoneNumber;

      if (explicitEmail) {
        return {
          phoneNumber: '',
          email: explicitEmail,
          accountValue: explicitEmail,
          accountType: 'email'
        };
      }
    }

    if (explicitAccountType === 'phone') {
      const explicitPhoneNumber = phoneNumber || accountValue || email;

      if (explicitPhoneNumber) {
        return {
          phoneNumber: explicitPhoneNumber,
          email: '',
          accountValue: explicitPhoneNumber,
          accountType: 'phone'
        };
      }
    }

    const emailCandidate = [email, accountValue, phoneNumber]
      .find((value) => isEmail(value)) || '';

    if (emailCandidate) {
      return {
        phoneNumber: '',
        email: emailCandidate,
        accountValue: emailCandidate,
        accountType: 'email'
      };
    }

    const resolvedPhoneNumber = phoneNumber || accountValue;

    return {
      phoneNumber: resolvedPhoneNumber,
      email: '',
      accountValue: resolvedPhoneNumber,
      accountType: resolvedPhoneNumber ? 'phone' : ''
    };
  }

  function overrideGetter(target, propertyName, getter) {
    const targetChain = [target, Object.getPrototypeOf(target)].filter(Boolean);

    for (const currentTarget of targetChain) {
      try {
        Object.defineProperty(currentTarget, propertyName, {
          configurable: true,
          get: getter
        });
        return;
      } catch (_error) {
        // Ignore override failures and try the next target.
      }
    }
  }

  function createStableHash(seed, namespace) {
    return crypto.createHash('sha256').update(`${seed}|${namespace}`).digest('hex');
  }

  function createStableNumber(seed, namespace, min, max) {
    const hash = createStableHash(seed, namespace).slice(0, 8);
    const numericValue = parseInt(hash, 16);

    if (!Number.isFinite(numericValue) || max <= min) {
      return min;
    }

    return min + (numericValue % (max - min + 1));
  }

  function createStableDelta(seed, namespace, amplitude) {
    const rawValue = createStableNumber(seed, namespace, 0, amplitude * 2);
    return rawValue - amplitude;
  }

  function createEventTargetShim() {
    if (typeof EventTarget === 'function') {
      return new EventTarget();
    }

    return {
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      }
    };
  }

  function createPermissionStatus(state) {
    const permissionStatus = createEventTargetShim();

    Object.defineProperty(permissionStatus, 'state', {
      configurable: true,
      enumerable: true,
      get() {
        return state;
      }
    });

    Object.defineProperty(permissionStatus, 'onchange', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: null
    });

    return permissionStatus;
  }

  function createScreenOrientation() {
    const orientation = createEventTargetShim();

    Object.defineProperty(orientation, 'type', {
      configurable: true,
      enumerable: true,
      get() {
        return 'landscape-primary';
      }
    });

    Object.defineProperty(orientation, 'angle', {
      configurable: true,
      enumerable: true,
      get() {
        return 0;
      }
    });

    orientation.lock = () => Promise.resolve();
    orientation.unlock = () => {};

    return orientation;
  }

  function createArrayLike(entries, nameField) {
    const list = entries.slice();

    Object.defineProperty(list, 'item', {
      configurable: true,
      enumerable: false,
      value(index) {
        return list[index] || null;
      }
    });

    Object.defineProperty(list, 'namedItem', {
      configurable: true,
      enumerable: false,
      value(name) {
        return list.find((entry) => normalizeText(entry && entry[nameField]) === normalizeText(name)) || null;
      }
    });

    return list;
  }

  function buildPluginCollections(fingerprintConfig) {
    const mimeTypeEntries = [];
    const pluginEntries = (Array.isArray(fingerprintConfig && fingerprintConfig.plugins)
      ? fingerprintConfig.plugins
      : [])
      .map((plugin) => {
        const pluginObject = [];
        const pluginMimeTypes = Array.isArray(plugin && plugin.mimeTypes) ? plugin.mimeTypes : [];

        Object.defineProperty(pluginObject, 'name', {
          configurable: true,
          enumerable: true,
          get() {
            return normalizeText(plugin && plugin.name);
          }
        });

        Object.defineProperty(pluginObject, 'filename', {
          configurable: true,
          enumerable: true,
          get() {
            return normalizeText(plugin && plugin.filename);
          }
        });

        Object.defineProperty(pluginObject, 'description', {
          configurable: true,
          enumerable: true,
          get() {
            return normalizeText(plugin && plugin.description);
          }
        });

        pluginMimeTypes.forEach((mimeType, index) => {
          const mimeTypeObject = {
            type: normalizeText(mimeType && mimeType.type),
            suffixes: normalizeText(mimeType && mimeType.suffixes),
            description: normalizeText(mimeType && mimeType.description),
            enabledPlugin: pluginObject
          };

          pluginObject[index] = mimeTypeObject;
          mimeTypeEntries.push(mimeTypeObject);
        });

        Object.defineProperty(pluginObject, 'length', {
          configurable: true,
          enumerable: true,
          get() {
            return pluginMimeTypes.length;
          }
        });

        Object.defineProperty(pluginObject, 'item', {
          configurable: true,
          enumerable: false,
          value(index) {
            return pluginObject[index] || null;
          }
        });

        Object.defineProperty(pluginObject, 'namedItem', {
          configurable: true,
          enumerable: false,
          value(name) {
            return (
              pluginObject.find((item) => normalizeText(item && item.type) === normalizeText(name))
              || null
            );
          }
        });

        return pluginObject;
      });

    const plugins = createArrayLike(pluginEntries, 'name');
    const mimeTypes = createArrayLike(mimeTypeEntries, 'type');

    Object.defineProperty(plugins, 'refresh', {
      configurable: true,
      enumerable: false,
      value() {}
    });

    return {
      plugins,
      mimeTypes
    };
  }

  function cloneImageData(sourceImageData) {
    if (!sourceImageData || !sourceImageData.data || typeof ImageData !== 'function') {
      return null;
    }

    const nextData = new Uint8ClampedArray(sourceImageData.data);

    return new ImageData(nextData, sourceImageData.width, sourceImageData.height);
  }

  function applyCanvasNoise(imageData, fingerprintConfig, namespace) {
    const clone = cloneImageData(imageData);

    if (!clone || !clone.data || clone.data.length === 0) {
      return imageData;
    }

    const seed =
      normalizeText(fingerprintConfig && fingerprintConfig.noiseProfile && fingerprintConfig.noiseProfile.canvas)
      || normalizeText(fingerprintConfig && fingerprintConfig.profileKey)
      || 'canvas';
    const pixelCount = Math.min(MAX_CANVAS_NOISE_PIXELS, Math.max(4, Math.floor(clone.data.length / 128)));

    for (let index = 0; index < pixelCount; index += 1) {
      const pixelIndex =
        createStableNumber(seed, `${namespace}|pixel|${index}`, 0, Math.max(0, Math.floor(clone.data.length / 4) - 1))
        * 4;
      const delta = createStableDelta(seed, `${namespace}|delta|${index}`, 3);

      clone.data[pixelIndex] = Math.max(0, Math.min(255, clone.data[pixelIndex] + delta));
      clone.data[pixelIndex + 1] = Math.max(0, Math.min(255, clone.data[pixelIndex + 1] - delta));
      clone.data[pixelIndex + 2] = Math.max(0, Math.min(255, clone.data[pixelIndex + 2] + Math.sign(delta)));
    }

    return clone;
  }

  function canMutateCanvas(width, height) {
    return (
      Number.isFinite(width)
      && Number.isFinite(height)
      && width > 0
      && height > 0
      && width <= CANVAS_MAX_DIMENSION
      && height <= CANVAS_MAX_DIMENSION
    );
  }

  function patchCanvas(fingerprintConfig) {
    if (typeof HTMLCanvasElement !== 'function' || typeof CanvasRenderingContext2D !== 'function') {
      return;
    }

    const suspectedCaptchaCanvases = new WeakSet();
    const nativeDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    const nativeToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
    const nativeGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    if (typeof nativeDrawImage === 'function') {
      CanvasRenderingContext2D.prototype.drawImage = function drawImage(image) {
        if (
          image instanceof HTMLImageElement
          && this.canvas instanceof HTMLCanvasElement
          && this.canvas.width <= CAPTCHA_MAX_DIMENSION
          && this.canvas.height <= CAPTCHA_MAX_DIMENSION
        ) {
          suspectedCaptchaCanvases.add(this.canvas);
        }

        return nativeDrawImage.apply(this, arguments);
      };
    }

    function isCanvasNoiseCandidate(canvas) {
      return !(canvas instanceof HTMLCanvasElement
        && canvas.width <= CAPTCHA_MAX_DIMENSION
        && canvas.height <= CAPTCHA_MAX_DIMENSION
        && suspectedCaptchaCanvases.has(canvas));
    }

    CanvasRenderingContext2D.prototype.getImageData = function getImageData() {
      const imageData = nativeGetImageData.apply(this, arguments);

      if (!canMutateCanvas(imageData && imageData.width, imageData && imageData.height)) {
        return imageData;
      }

      if (!isCanvasNoiseCandidate(this.canvas)) {
        return imageData;
      }

      return applyCanvasNoise(imageData, fingerprintConfig, 'getImageData');
    };

    HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
      if (!canMutateCanvas(this.width, this.height)) {
        return nativeToDataURL.apply(this, arguments);
      }

      if (!isCanvasNoiseCandidate(this)) {
        return nativeToDataURL.apply(this, arguments);
      }

      try {
        const context = nativeGetContext.call(this, '2d');

        if (!context) {
          return nativeToDataURL.apply(this, arguments);
        }

        const imageData = nativeGetImageData.call(context, 0, 0, this.width, this.height);
        const noisyImageData = applyCanvasNoise(imageData, fingerprintConfig, 'toDataURL');
        const cloneCanvas = document.createElement('canvas');

        cloneCanvas.width = this.width;
        cloneCanvas.height = this.height;

        const cloneContext = nativeGetContext.call(cloneCanvas, '2d');

        if (!cloneContext) {
          return nativeToDataURL.apply(this, arguments);
        }

        cloneContext.putImageData(noisyImageData, 0, 0);
        return nativeToDataURL.apply(cloneCanvas, arguments);
      } catch (_error) {
        return nativeToDataURL.apply(this, arguments);
      }
    };

    if (typeof nativeToBlob === 'function') {
      HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type, quality) {
        if (!canMutateCanvas(this.width, this.height)) {
          return nativeToBlob.call(this, callback, type, quality);
        }

        if (!isCanvasNoiseCandidate(this)) {
          return nativeToBlob.call(this, callback, type, quality);
        }

        try {
          const context = nativeGetContext.call(this, '2d');

          if (!context) {
            return nativeToBlob.call(this, callback, type, quality);
          }

          const imageData = nativeGetImageData.call(context, 0, 0, this.width, this.height);
          const noisyImageData = applyCanvasNoise(imageData, fingerprintConfig, 'toBlob');
          const cloneCanvas = document.createElement('canvas');

          cloneCanvas.width = this.width;
          cloneCanvas.height = this.height;

          const cloneContext = nativeGetContext.call(cloneCanvas, '2d');

          if (!cloneContext) {
            return nativeToBlob.call(this, callback, type, quality);
          }

          cloneContext.putImageData(noisyImageData, 0, 0);
          return nativeToBlob.call(cloneCanvas, callback, type, quality);
        } catch (_error) {
          return nativeToBlob.call(this, callback, type, quality);
        }
      };
    }
  }

  function applyAudioNoise(arrayLike, fingerprintConfig, namespace) {
    if (!arrayLike || typeof arrayLike.length !== 'number' || arrayLike.length === 0) {
      return arrayLike;
    }

    const seed =
      normalizeText(fingerprintConfig && fingerprintConfig.noiseProfile && fingerprintConfig.noiseProfile.audio)
      || normalizeText(fingerprintConfig && fingerprintConfig.profileKey)
      || 'audio';
    const sampleCount = Math.min(MAX_AUDIO_NOISE_POINTS, Math.max(4, Math.floor(arrayLike.length / 256)));

    for (let index = 0; index < sampleCount; index += 1) {
      const sampleIndex = createStableNumber(
        seed,
        `${namespace}|sample|${index}`,
        0,
        Math.max(0, arrayLike.length - 1)
      );
      const delta = createStableDelta(seed, `${namespace}|delta|${index}`, 4) * 0.0000001;

      arrayLike[sampleIndex] += delta;
    }

    return arrayLike;
  }

  function patchAudio(fingerprintConfig) {
    const OfflineContext =
      window.OfflineAudioContext
      || window.webkitOfflineAudioContext;

    if (OfflineContext && typeof OfflineContext.prototype.startRendering === 'function') {
      const nativeStartRendering = OfflineContext.prototype.startRendering;

      OfflineContext.prototype.startRendering = function startRendering() {
        const result = nativeStartRendering.apply(this, arguments);

        if (!result || typeof result.then !== 'function') {
          return result;
        }

        return result.then((audioBuffer) => {
          try {
            if (audioBuffer && typeof audioBuffer.getChannelData === 'function') {
              applyAudioNoise(audioBuffer.getChannelData(0), fingerprintConfig, 'offline-audio');
            }
          } catch (_error) {
            // Ignore audio noise failures.
          }

          return audioBuffer;
        });
      };
    }

    if (typeof AnalyserNode === 'function' && typeof AnalyserNode.prototype.getFloatFrequencyData === 'function') {
      const nativeGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;

      AnalyserNode.prototype.getFloatFrequencyData = function getFloatFrequencyData(array) {
        nativeGetFloatFrequencyData.apply(this, arguments);
        applyAudioNoise(array, fingerprintConfig, 'analyser-frequency');
      };
    }
  }

  function buildUserAgentData(fingerprintConfig) {
    const metadata = buildUserAgentMetadata(fingerprintConfig);

    return {
      brands: metadata.brands,
      mobile: metadata.mobile,
      platform: metadata.platform,
      getHighEntropyValues(hints) {
        const result = {};
        const requestHints = Array.isArray(hints) ? hints : [];

        requestHints.forEach((hint) => {
          if (hint === 'brands') {
            result.brands = metadata.brands;
          }

          if (hint === 'fullVersionList') {
            result.fullVersionList = metadata.fullVersionList;
          }

          if (hint === 'mobile') {
            result.mobile = metadata.mobile;
          }

          if (hint === 'platform') {
            result.platform = metadata.platform;
          }

          if (hint === 'platformVersion') {
            result.platformVersion = metadata.platformVersion;
          }

          if (hint === 'architecture') {
            result.architecture = metadata.architecture;
          }

          if (hint === 'bitness') {
            result.bitness = metadata.bitness;
          }

          if (hint === 'wow64') {
            result.wow64 = metadata.wow64;
          }

          if (hint === 'model') {
            result.model = metadata.model;
          }

          if (hint === 'uaFullVersion') {
            result.uaFullVersion = metadata.uaFullVersion;
          }
        });

        return Promise.resolve(result);
      },
      toJSON() {
        return {
          brands: metadata.brands,
          mobile: metadata.mobile,
          platform: metadata.platform
        };
      }
    };
  }

  function patchNavigator(fingerprintConfig) {
    const userAgent = normalizeText(fingerprintConfig && fingerprintConfig.userAgent);
    const appVersion = userAgent.replace(/^Mozilla\//i, '');
    const userAgentData = buildUserAgentData(fingerprintConfig);
    const { plugins, mimeTypes } = buildPluginCollections(fingerprintConfig);

    overrideGetter(window.navigator, 'userAgent', () => userAgent);
    overrideGetter(window.navigator, 'appVersion', () => appVersion);
    overrideGetter(window.navigator, 'platform', () => fingerprintConfig.platform);
    overrideGetter(window.navigator, 'appCodeName', () => 'Mozilla');
    overrideGetter(window.navigator, 'appName', () => 'Netscape');
    overrideGetter(window.navigator, 'language', () => fingerprintConfig.language);
    overrideGetter(window.navigator, 'languages', () => fingerprintConfig.languages.slice());
    overrideGetter(window.navigator, 'hardwareConcurrency', () => fingerprintConfig.hardwareConcurrency);
    overrideGetter(window.navigator, 'deviceMemory', () => fingerprintConfig.deviceMemory);
    overrideGetter(window.navigator, 'vendor', () => fingerprintConfig.vendor);
    overrideGetter(window.navigator, 'vendorSub', () => '');
    overrideGetter(window.navigator, 'productSub', () => fingerprintConfig.productSub);
    overrideGetter(window.navigator, 'doNotTrack', () => fingerprintConfig.doNotTrack);
    overrideGetter(window.navigator, 'maxTouchPoints', () => fingerprintConfig.maxTouchPoints);
    overrideGetter(window.navigator, 'webdriver', () => false);
    overrideGetter(window.navigator, 'userAgentData', () => userAgentData);
    overrideGetter(window.navigator, 'plugins', () => plugins);
    overrideGetter(window.navigator, 'mimeTypes', () => mimeTypes);
    overrideGetter(window.navigator, 'pdfViewerEnabled', () => mimeTypes.length > 0);
  }

  function patchChromeRuntime() {
    const chromeObject = {
      runtime: {},
      app: {}
    };

    overrideGetter(window, 'chrome', () => chromeObject);
  }

  function patchScreen(fingerprintConfig) {
    const screenProfile = fingerprintConfig.screen || {};
    const screenOrientation = createScreenOrientation();

    overrideGetter(window.screen, 'width', () => screenProfile.width);
    overrideGetter(window.screen, 'height', () => screenProfile.height);
    overrideGetter(window.screen, 'availWidth', () => screenProfile.availWidth);
    overrideGetter(window.screen, 'availHeight', () => screenProfile.availHeight);
    overrideGetter(window.screen, 'colorDepth', () => screenProfile.colorDepth);
    overrideGetter(window.screen, 'pixelDepth', () => screenProfile.pixelDepth);
    overrideGetter(window.screen, 'orientation', () => screenOrientation);
    overrideGetter(window, 'devicePixelRatio', () => fingerprintConfig.devicePixelRatio);
  }

  function patchTimeZone(fingerprintConfig) {
    const timeZone = fingerprintConfig.timezone;
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    const nativeResolvedOptions = NativeDateTimeFormat.prototype.resolvedOptions;

    // Pre-compute a fixed timezone offset so getTimezoneOffset is O(1).
    const fixedTimezoneOffset = (() => {
      try {
        const formatter = new NativeDateTimeFormat('en-US', {
          timeZone,
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const now = new Date();
        const parts = formatter.formatToParts(now).reduce((result, part) => {
          if (part.type !== 'literal') {
            result[part.type] = part.value;
          }
          return result;
        }, {});
        return Math.round((Date.UTC(
          Number(parts.year), Number(parts.month) - 1, Number(parts.day),
          Number(parts.hour), Number(parts.minute), Number(parts.second)
        ) - now.getTime()) / 60000);
      } catch (_error) {
        return -480;
      }
    })();

    function PatchedDateTimeFormat(locales, options) {
      const nextOptions = options ? { ...options } : {};

      if (!nextOptions.timeZone) {
        nextOptions.timeZone = timeZone;
      }

      return new NativeDateTimeFormat(locales, nextOptions);
    }

    PatchedDateTimeFormat.prototype = NativeDateTimeFormat.prototype;
    Object.setPrototypeOf(PatchedDateTimeFormat, NativeDateTimeFormat);
    PatchedDateTimeFormat.supportedLocalesOf =
      NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);

    Intl.DateTimeFormat = PatchedDateTimeFormat;
    NativeDateTimeFormat.prototype.resolvedOptions = function resolvedOptions() {
      const result = nativeResolvedOptions.apply(this, arguments);
      result.timeZone = timeZone;
      return result;
    };
    Date.prototype.getTimezoneOffset = function getTimezoneOffset() {
      return fixedTimezoneOffset;
    };
  }

  function createDomRectLike(x, y, width, height) {
    if (typeof DOMRect === 'function') {
      return new DOMRect(x, y, width, height);
    }

    return {
      x,
      y,
      width,
      height,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      toJSON() {
        return {
          x,
          y,
          width,
          height,
          top: y,
          left: x,
          right: x + width,
          bottom: y + height
        };
      }
    };
  }

  function cloneClientRectList(rects) {
    const nextRects = rects.slice();

    Object.defineProperty(nextRects, 'item', {
      configurable: true,
      enumerable: false,
      value(index) {
        return nextRects[index] || null;
      }
    });

    return nextRects;
  }

  function applyRectNoise(rect, fingerprintConfig, namespace) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
      return rect;
    }

    const seed =
      normalizeText(fingerprintConfig && fingerprintConfig.domProfile && fingerprintConfig.domProfile.rectSeed)
      || normalizeText(fingerprintConfig && fingerprintConfig.profileKey)
      || 'rect';
    const offsetX = createStableDelta(seed, `${namespace}|x`, 6) / 100;
    const offsetY = createStableDelta(seed, `${namespace}|y`, 6) / 100;
    const deltaWidth = createStableDelta(seed, `${namespace}|w`, 3) / 100;
    const deltaHeight = createStableDelta(seed, `${namespace}|h`, 3) / 100;

    return createDomRectLike(
      rect.x + offsetX,
      rect.y + offsetY,
      Math.max(0, rect.width + deltaWidth),
      Math.max(0, rect.height + deltaHeight)
    );
  }

  function cloneTextMetrics(nativeMetrics, delta) {
    if (!nativeMetrics) {
      return nativeMetrics;
    }

    const clone = Object.create(Object.getPrototypeOf(nativeMetrics) || Object.prototype);
    const metricKeys = [
      'width',
      'actualBoundingBoxLeft',
      'actualBoundingBoxRight',
      'fontBoundingBoxAscent',
      'fontBoundingBoxDescent',
      'actualBoundingBoxAscent',
      'actualBoundingBoxDescent',
      'emHeightAscent',
      'emHeightDescent',
      'hangingBaseline',
      'alphabeticBaseline',
      'ideographicBaseline'
    ];

    metricKeys.forEach((metricKey, index) => {
      Object.defineProperty(clone, metricKey, {
        configurable: true,
        enumerable: true,
        get() {
          const nativeValue = nativeMetrics[metricKey];

          if (!Number.isFinite(nativeValue)) {
            return nativeValue;
          }

          if (metricKey === 'width') {
            return nativeValue + delta;
          }

          return nativeValue + (delta / Math.max(2, index + 1));
        }
      });
    });

    return clone;
  }

  function patchDomGeometryAndText(fingerprintConfig) {
    if (typeof CanvasRenderingContext2D === 'function'
      && typeof CanvasRenderingContext2D.prototype.measureText === 'function') {
      const nativeMeasureText = CanvasRenderingContext2D.prototype.measureText;

      CanvasRenderingContext2D.prototype.measureText = function measureText(text) {
        const nativeMetrics = nativeMeasureText.apply(this, arguments);
        const seed =
          normalizeText(fingerprintConfig && fingerprintConfig.domProfile && fingerprintConfig.domProfile.textSeed)
          || normalizeText(fingerprintConfig && fingerprintConfig.profileKey)
          || 'text';
        const delta = createStableDelta(
          seed,
          `${normalizeText(this && this.font)}|${String(text || '')}`,
          3
        ) / 100;

        return cloneTextMetrics(nativeMetrics, delta);
      };
    }

    function patchRectMethods(TargetClass, label) {
      if (!TargetClass || !TargetClass.prototype) {
        return;
      }

      if (typeof TargetClass.prototype.getBoundingClientRect === 'function') {
        const nativeGetBoundingClientRect = TargetClass.prototype.getBoundingClientRect;

        TargetClass.prototype.getBoundingClientRect = function getBoundingClientRect() {
          const rect = nativeGetBoundingClientRect.apply(this, arguments);
          return applyRectNoise(rect, fingerprintConfig, `${label}|single`);
        };
      }

      if (typeof TargetClass.prototype.getClientRects === 'function') {
        const nativeGetClientRects = TargetClass.prototype.getClientRects;

        TargetClass.prototype.getClientRects = function getClientRects() {
          const nativeRects = Array.from(nativeGetClientRects.apply(this, arguments) || []);
          const nextRects = nativeRects.map((rect, index) => (
            applyRectNoise(rect, fingerprintConfig, `${label}|list|${index}`)
          ));

          return cloneClientRectList(nextRects);
        };
      }
    }

    patchRectMethods(window.Element, 'element');
    patchRectMethods(window.Range, 'range');
  }

  function patchFonts(fingerprintConfig) {
    const fontFamilies = Array.isArray(fingerprintConfig && fingerprintConfig.fontFamilies)
      ? fingerprintConfig.fontFamilies.map((font) => normalizeText(font).toLowerCase()).filter(Boolean)
      : [];

    if (document.fonts && typeof document.fonts.check === 'function') {
      const nativeCheck = document.fonts.check.bind(document.fonts);

      document.fonts.check = function check(fontValue) {
        const normalizedFont = normalizeText(fontValue).toLowerCase();

        if (fontFamilies.some((fontName) => normalizedFont.includes(fontName))) {
          return true;
        }

        return nativeCheck.apply(document.fonts, arguments);
      };
    }

    if (typeof window.queryLocalFonts === 'function') {
      window.queryLocalFonts = function queryLocalFonts() {
        return Promise.resolve(
          fontFamilies.map((fontName) => ({
            family: fontName,
            fullName: fontName,
            postscriptName: fontName.replace(/\s+/g, '-')
          }))
        );
      };
    }
  }

  function patchWindowGeometry(fingerprintConfig) {
    const windowMetrics = fingerprintConfig && fingerprintConfig.windowMetrics
      ? fingerprintConfig.windowMetrics
      : {};
    const visualViewport = createEventTargetShim();

    overrideGetter(window, 'outerWidth', () => (
      window.innerWidth + (Number(windowMetrics.frameWidth) || 14)
    ));
    overrideGetter(window, 'outerHeight', () => (
      window.innerHeight + (Number(windowMetrics.frameHeight) || 84)
    ));
    overrideGetter(window, 'screenX', () => Number(windowMetrics.screenX) || 0);
    overrideGetter(window, 'screenY', () => Number(windowMetrics.screenY) || 0);
    overrideGetter(window, 'screenLeft', () => Number(windowMetrics.screenX) || 0);
    overrideGetter(window, 'screenTop', () => Number(windowMetrics.screenY) || 0);

    Object.defineProperty(visualViewport, 'width', {
      configurable: true,
      enumerable: true,
      get() {
        return window.innerWidth;
      }
    });
    Object.defineProperty(visualViewport, 'height', {
      configurable: true,
      enumerable: true,
      get() {
        return window.innerHeight;
      }
    });
    Object.defineProperty(visualViewport, 'scale', {
      configurable: true,
      enumerable: true,
      get() {
        return Number(windowMetrics.visualViewportScale) || 1;
      }
    });
    Object.defineProperty(visualViewport, 'offsetLeft', {
      configurable: true,
      enumerable: true,
      get() {
        return 0;
      }
    });
    Object.defineProperty(visualViewport, 'offsetTop', {
      configurable: true,
      enumerable: true,
      get() {
        return 0;
      }
    });
    Object.defineProperty(visualViewport, 'pageLeft', {
      configurable: true,
      enumerable: true,
      get() {
        return window.pageXOffset;
      }
    });
    Object.defineProperty(visualViewport, 'pageTop', {
      configurable: true,
      enumerable: true,
      get() {
        return window.pageYOffset;
      }
    });

    overrideGetter(window, 'visualViewport', () => visualViewport);
  }

  function patchPermissionsAndDevices(fingerprintConfig) {
    const permissionStates = {
      geolocation: normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.geolocation) || 'denied',
      notifications: normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.notifications) || 'denied',
      camera: normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.camera) || 'denied',
      microphone: normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.microphone) || 'denied',
      midi: normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.midi) || 'denied',
      'clipboard-read': normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.clipboardRead) || 'prompt',
      'clipboard-write': normalizeText(fingerprintConfig && fingerprintConfig.permissions && fingerprintConfig.permissions.clipboardWrite) || 'granted'
    };

    if (window.navigator.permissions && typeof window.navigator.permissions.query === 'function') {
      const nativeQuery = window.navigator.permissions.query.bind(window.navigator.permissions);

      window.navigator.permissions.query = function query(permissionDescriptor) {
        const permissionName = normalizeText(permissionDescriptor && permissionDescriptor.name).toLowerCase();

        if (!permissionName || !Object.prototype.hasOwnProperty.call(permissionStates, permissionName)) {
          return nativeQuery(permissionDescriptor);
        }

        return Promise.resolve(createPermissionStatus(permissionStates[permissionName]));
      };
    }

    if (typeof window.Notification === 'function') {
      overrideGetter(window.Notification, 'permission', () => {
        const state = permissionStates.notifications;

        if (state === 'granted') {
          return 'granted';
        }

        if (state === 'denied') {
          return 'denied';
        }

        return 'default';
      });
    }

    if (!window.navigator.mediaDevices) {
      return;
    }

    const deviceList = Array.isArray(fingerprintConfig && fingerprintConfig.mediaDevices)
      ? fingerprintConfig.mediaDevices.map((device) => ({
        kind: normalizeText(device && device.kind),
        label: normalizeText(device && device.label),
        deviceId: normalizeText(device && device.deviceId),
        groupId: normalizeText(device && device.groupId),
        toJSON() {
          return {
            kind: this.kind,
            label: this.label,
            deviceId: this.deviceId,
            groupId: this.groupId
          };
        }
      }))
      : [];

    if (typeof window.navigator.mediaDevices.enumerateDevices === 'function') {
      window.navigator.mediaDevices.enumerateDevices = function enumerateDevices() {
        return Promise.resolve(deviceList.slice());
      };
    }

    if (typeof window.navigator.mediaDevices.getSupportedConstraints === 'function') {
      window.navigator.mediaDevices.getSupportedConstraints = function getSupportedConstraints() {
        return {
          width: true,
          height: true,
          aspectRatio: true,
          frameRate: true,
          facingMode: true,
          resizeMode: true,
          sampleRate: true,
          sampleSize: true,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          channelCount: true,
          deviceId: true,
          groupId: true
        };
      };
    }

    if (typeof window.navigator.mediaDevices.getUserMedia === 'function') {
      window.navigator.mediaDevices.getUserMedia = function getUserMedia() {
        return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      };
    }
  }

  function patchNetworkAndMedia(fingerprintConfig) {
    const networkProfile = fingerprintConfig && fingerprintConfig.networkProfile
      ? fingerprintConfig.networkProfile
      : {};
    const audioProfile = fingerprintConfig && fingerprintConfig.audioProfile
      ? fingerprintConfig.audioProfile
      : {};
    const mediaCapabilitiesProfile = fingerprintConfig && fingerprintConfig.mediaCapabilities
      ? fingerprintConfig.mediaCapabilities
      : {};
    const connectionObject = createEventTargetShim();
    const speechVoices = Array.isArray(fingerprintConfig && fingerprintConfig.speechVoices)
      ? fingerprintConfig.speechVoices.map((voice) => ({
        voiceURI: normalizeText(voice && voice.voiceURI),
        name: normalizeText(voice && voice.name),
        lang: normalizeText(voice && voice.lang),
        localService: voice ? voice.localService !== false : true,
        default: voice ? voice.default === true : false
      }))
      : [];

    Object.defineProperty(connectionObject, 'effectiveType', {
      configurable: true,
      enumerable: true,
      get() {
        return normalizeText(networkProfile.effectiveType) || '4g';
      }
    });
    Object.defineProperty(connectionObject, 'downlink', {
      configurable: true,
      enumerable: true,
      get() {
        return Number(networkProfile.downlink) || 8;
      }
    });
    Object.defineProperty(connectionObject, 'rtt', {
      configurable: true,
      enumerable: true,
      get() {
        return Number(networkProfile.rtt) || 50;
      }
    });
    Object.defineProperty(connectionObject, 'saveData', {
      configurable: true,
      enumerable: true,
      get() {
        return Boolean(networkProfile.saveData);
      }
    });
    Object.defineProperty(connectionObject, 'type', {
      configurable: true,
      enumerable: true,
      get() {
        return 'wifi';
      }
    });

    overrideGetter(window.navigator, 'connection', () => connectionObject);
    overrideGetter(window.navigator, 'mozConnection', () => connectionObject);
    overrideGetter(window.navigator, 'webkitConnection', () => connectionObject);
    overrideGetter(window.navigator, 'onLine', () => true);

    if (typeof window.BaseAudioContext === 'function') {
      overrideGetter(window.BaseAudioContext.prototype, 'sampleRate', () => (
        Number(audioProfile.sampleRate) || 48000
      ));
    }

    if (window.navigator.mediaCapabilities) {
      const supportedVideoCodecs = Array.isArray(mediaCapabilitiesProfile.videoCodecs)
        ? mediaCapabilitiesProfile.videoCodecs.map((codec) => normalizeText(codec).toLowerCase())
        : [];
      const supportedAudioCodecs = Array.isArray(mediaCapabilitiesProfile.audioCodecs)
        ? mediaCapabilitiesProfile.audioCodecs.map((codec) => normalizeText(codec).toLowerCase())
        : [];

      function checkCodecSupport(contentType, codecs) {
        const normalizedContentType = normalizeText(contentType).toLowerCase();
        const codecList = Array.isArray(codecs)
          ? codecs.map((codec) => normalizeText(codec).toLowerCase())
          : [];

        if (supportedVideoCodecs.some((codec) => normalizedContentType.includes(codec))) {
          return true;
        }

        if (supportedAudioCodecs.some((codec) => normalizedContentType.includes(codec))) {
          return true;
        }

        return codecList.some((codec) => (
          supportedVideoCodecs.includes(codec) || supportedAudioCodecs.includes(codec)
        ));
      }

      window.navigator.mediaCapabilities.decodingInfo = function decodingInfo(configuration) {
        const mediaConfig = configuration && configuration.video
          ? configuration.video
          : (configuration && configuration.audio ? configuration.audio : {});

        return Promise.resolve({
          supported: checkCodecSupport(
            mediaConfig && mediaConfig.contentType,
            mediaConfig && mediaConfig.codecs
          ),
          smooth: mediaCapabilitiesProfile.smooth !== false,
          powerEfficient: mediaCapabilitiesProfile.powerEfficient !== false
        });
      };

      window.navigator.mediaCapabilities.encodingInfo = function encodingInfo(configuration) {
        const mediaConfig = configuration && configuration.video
          ? configuration.video
          : (configuration && configuration.audio ? configuration.audio : {});

        return Promise.resolve({
          supported: checkCodecSupport(
            mediaConfig && mediaConfig.contentType,
            mediaConfig && mediaConfig.codecs
          ),
          smooth: mediaCapabilitiesProfile.smooth !== false,
          powerEfficient: mediaCapabilitiesProfile.powerEfficient !== false
        });
      };
    }

    if (typeof window.MediaRecorder === 'function' && typeof window.MediaRecorder.isTypeSupported === 'function') {
      window.MediaRecorder.isTypeSupported = function isTypeSupported(contentType) {
        const normalizedContentType = normalizeText(contentType).toLowerCase();

        return (
          (Array.isArray(mediaCapabilitiesProfile.videoCodecs)
            && mediaCapabilitiesProfile.videoCodecs.some((codec) => normalizedContentType.includes(normalizeText(codec).toLowerCase())))
          || (Array.isArray(mediaCapabilitiesProfile.audioCodecs)
            && mediaCapabilitiesProfile.audioCodecs.some((codec) => normalizedContentType.includes(normalizeText(codec).toLowerCase())))
        );
      };
    }

    if (typeof window.HTMLMediaElement === 'function' && typeof window.HTMLMediaElement.prototype.canPlayType === 'function') {
      window.HTMLMediaElement.prototype.canPlayType = function canPlayType(contentType) {
        const normalizedContentType = normalizeText(contentType).toLowerCase();
        const isSupported =
          (Array.isArray(mediaCapabilitiesProfile.videoCodecs)
            && mediaCapabilitiesProfile.videoCodecs.some((codec) => normalizedContentType.includes(normalizeText(codec).toLowerCase())))
          || (Array.isArray(mediaCapabilitiesProfile.audioCodecs)
            && mediaCapabilitiesProfile.audioCodecs.some((codec) => normalizedContentType.includes(normalizeText(codec).toLowerCase())));

        return isSupported ? 'probably' : '';
      };
    }

    if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function') {
      window.speechSynthesis.getVoices = function getVoices() {
        return speechVoices.slice();
      };

      setTimeout(() => {
        try {
          window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
        } catch (_error) {
          // Ignore synthetic event failures.
        }
      }, 0);
    }
  }

  function patchWebGl(fingerprintConfig) {
    const webglConfig = fingerprintConfig && fingerprintConfig.webgl ? fingerprintConfig.webgl : {};
    const parameterMap = {
      [WEBGL_VENDOR_KEY]: normalizeText(fingerprintConfig && fingerprintConfig.webglVendor),
      [WEBGL_RENDERER_KEY]: normalizeText(fingerprintConfig && fingerprintConfig.webglRenderer),
      [WEBGL_VENDOR_NAME_KEY]: 'WebKit',
      [WEBGL_RENDERER_NAME_KEY]: 'WebKit WebGL',
      [WEBGL_VERSION_KEY]: normalizeText(webglConfig.version) || 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      [WEBGL_SHADING_LANGUAGE_VERSION_KEY]:
        normalizeText(webglConfig.shadingLanguageVersion)
        || 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      [WEBGL_MAX_TEXTURE_SIZE_KEY]: Number(webglConfig.parameters && webglConfig.parameters.maxTextureSize) || 16384,
      [WEBGL_MAX_CUBE_MAP_TEXTURE_SIZE_KEY]:
        Number(webglConfig.parameters && webglConfig.parameters.maxCubeMapTextureSize) || 16384,
      [WEBGL_MAX_RENDERBUFFER_SIZE_KEY]:
        Number(webglConfig.parameters && webglConfig.parameters.maxRenderbufferSize) || 16384,
      [WEBGL_MAX_VIEWPORT_DIMS_KEY]:
        new Int32Array((webglConfig.parameters && webglConfig.parameters.maxViewportDims) || [16384, 16384]),
      [WEBGL_ALIASED_LINE_WIDTH_RANGE_KEY]:
        new Float32Array((webglConfig.parameters && webglConfig.parameters.aliasedLineWidthRange) || [1, 1]),
      [WEBGL_ALIASED_POINT_SIZE_RANGE_KEY]:
        new Float32Array((webglConfig.parameters && webglConfig.parameters.aliasedPointSizeRange) || [1, 1024]),
      [WEBGL_MAX_VERTEX_ATTRIBS_KEY]:
        Number(webglConfig.parameters && webglConfig.parameters.maxVertexAttribs) || 16,
      [WEBGL_MAX_TEXTURE_IMAGE_UNITS_KEY]:
        Number(webglConfig.parameters && webglConfig.parameters.maxTextureImageUnits) || 16,
      [WEBGL_MAX_VERTEX_TEXTURE_IMAGE_UNITS_KEY]:
        Number(webglConfig.parameters && webglConfig.parameters.maxVertexTextureImageUnits) || 16,
      [WEBGL_MAX_COMBINED_TEXTURE_IMAGE_UNITS_KEY]:
        Number(webglConfig.parameters && webglConfig.parameters.maxCombinedTextureImageUnits) || 32,
      [WEBGL_RED_BITS_KEY]: Number(webglConfig.parameters && webglConfig.parameters.redBits) || 8,
      [WEBGL_GREEN_BITS_KEY]: Number(webglConfig.parameters && webglConfig.parameters.greenBits) || 8,
      [WEBGL_BLUE_BITS_KEY]: Number(webglConfig.parameters && webglConfig.parameters.blueBits) || 8,
      [WEBGL_ALPHA_BITS_KEY]: Number(webglConfig.parameters && webglConfig.parameters.alphaBits) || 8,
      [WEBGL_DEPTH_BITS_KEY]: Number(webglConfig.parameters && webglConfig.parameters.depthBits) || 24,
      [WEBGL_STENCIL_BITS_KEY]: Number(webglConfig.parameters && webglConfig.parameters.stencilBits) || 8
    };
    const fakeDebugRendererInfo = {
      UNMASKED_VENDOR_WEBGL: WEBGL_VENDOR_KEY,
      UNMASKED_RENDERER_WEBGL: WEBGL_RENDERER_KEY
    };

    function patchContext(ContextClass) {
      if (!ContextClass || !ContextClass.prototype) {
        return;
      }

      const nativeGetParameter = ContextClass.prototype.getParameter;
      const nativeGetExtension = ContextClass.prototype.getExtension;
      const nativeGetSupportedExtensions = ContextClass.prototype.getSupportedExtensions;
      const nativeGetShaderPrecisionFormat = ContextClass.prototype.getShaderPrecisionFormat;

      ContextClass.prototype.getParameter = function getParameter(parameter) {
        if (Object.prototype.hasOwnProperty.call(parameterMap, parameter)) {
          return parameterMap[parameter];
        }

        return nativeGetParameter.apply(this, arguments);
      };

      ContextClass.prototype.getExtension = function getExtension(name) {
        if (String(name || '').toLowerCase() === 'webgl_debug_renderer_info') {
          return fakeDebugRendererInfo;
        }

        return nativeGetExtension.apply(this, arguments);
      };

      if (typeof nativeGetSupportedExtensions === 'function') {
        ContextClass.prototype.getSupportedExtensions = function getSupportedExtensions() {
          if (Array.isArray(webglConfig.extensions) && webglConfig.extensions.length > 0) {
            return webglConfig.extensions.slice();
          }

          return nativeGetSupportedExtensions.apply(this, arguments);
        };
      }

      if (typeof nativeGetShaderPrecisionFormat === 'function') {
        ContextClass.prototype.getShaderPrecisionFormat = function getShaderPrecisionFormat() {
          return {
            rangeMin: Number(webglConfig.shaderPrecision && webglConfig.shaderPrecision.rangeMin) || 127,
            rangeMax: Number(webglConfig.shaderPrecision && webglConfig.shaderPrecision.rangeMax) || 127,
            precision: Number(webglConfig.shaderPrecision && webglConfig.shaderPrecision.precision) || 23
          };
        };
      }
    }

    patchContext(window.WebGLRenderingContext);
    patchContext(window.WebGL2RenderingContext);
  }

  function isPrivateIpAddress(candidateText) {
    const normalizedCandidate = String(candidateText || '').toLowerCase();

    return (
      /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(normalizedCandidate)
      || /\b127\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(normalizedCandidate)
      || /\b169\.254\.\d{1,3}\.\d{1,3}\b/.test(normalizedCandidate)
      || /\b192\.168\.\d{1,3}\.\d{1,3}\b/.test(normalizedCandidate)
      || /\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/.test(normalizedCandidate)
      || /\bfc[0-9a-f]{2}:/i.test(normalizedCandidate)
      || /\bfd[0-9a-f]{2}:/i.test(normalizedCandidate)
      || /\bfe80:/i.test(normalizedCandidate)
      || normalizedCandidate.includes('::1')
    );
  }

  function sanitizeSdp(sdp) {
    return String(sdp || '')
      .split(/\r?\n/)
      .filter((line) => {
        const normalizedLine = line.toLowerCase();

        if (!normalizedLine.startsWith('a=candidate:')) {
          return true;
        }

        if (normalizedLine.includes(' typ host ')) {
          return false;
        }

        return !isPrivateIpAddress(normalizedLine);
      })
      .join('\r\n');
  }

  function sanitizeIceCandidate(candidate) {
    const candidateText =
      typeof candidate === 'string'
        ? candidate
        : normalizeText(candidate && candidate.candidate);

    if (!candidateText) {
      return candidate;
    }

    if (candidateText.toLowerCase().includes(' typ host ') || isPrivateIpAddress(candidateText)) {
      return null;
    }

    if (typeof candidate === 'string') {
      return candidateText;
    }

    return {
      candidate: candidateText,
      sdpMid: candidate && candidate.sdpMid,
      sdpMLineIndex: candidate && candidate.sdpMLineIndex,
      usernameFragment: candidate && candidate.usernameFragment,
      toJSON() {
        return {
          candidate: candidateText,
          sdpMid: this.sdpMid,
          sdpMLineIndex: this.sdpMLineIndex,
          usernameFragment: this.usernameFragment
        };
      }
    };
  }

  function patchWebRtc() {
    if (typeof window.RTCPeerConnection !== 'function') {
      return;
    }

    const NativePeerConnection = window.RTCPeerConnection;
    const listenerMap = new WeakMap();
    const onIceCandidateHandlerSymbol = Symbol('temuOnIceCandidateHandler');

    function wrapIceListener(listener) {
      if (typeof listener !== 'function') {
        return listener;
      }

      if (listenerMap.has(listener)) {
        return listenerMap.get(listener);
      }

      const wrappedListener = function wrappedIceListener(event) {
        if (!event || !event.candidate) {
          listener.call(this, event);
          return;
        }

        const sanitizedCandidate = sanitizeIceCandidate(event.candidate);

        if (!sanitizedCandidate) {
          return;
        }

        if (sanitizedCandidate === event.candidate) {
          listener.call(this, event);
          return;
        }

        const nextEvent = new Event(event.type);

        Object.defineProperty(nextEvent, 'candidate', {
          configurable: true,
          enumerable: true,
          get() {
            return sanitizedCandidate;
          }
        });

        listener.call(this, nextEvent);
      };

      listenerMap.set(listener, wrappedListener);
      return wrappedListener;
    }

    if (typeof NativePeerConnection.prototype.addEventListener === 'function') {
      const nativeAddEventListener = NativePeerConnection.prototype.addEventListener;

      NativePeerConnection.prototype.addEventListener = function addEventListener(type, listener, options) {
        if (String(type || '').toLowerCase() === 'icecandidate') {
          return nativeAddEventListener.call(this, type, wrapIceListener(listener), options);
        }

        return nativeAddEventListener.call(this, type, listener, options);
      };
    }

    const nativeOnIceCandidateDescriptor =
      Object.getOwnPropertyDescriptor(NativePeerConnection.prototype, 'onicecandidate');

    Object.defineProperty(NativePeerConnection.prototype, 'onicecandidate', {
      configurable: true,
      enumerable: true,
      get() {
        return this[onIceCandidateHandlerSymbol] || null;
      },
      set(listener) {
        this[onIceCandidateHandlerSymbol] = listener;

        if (nativeOnIceCandidateDescriptor && typeof nativeOnIceCandidateDescriptor.set === 'function') {
          nativeOnIceCandidateDescriptor.set.call(this, wrapIceListener(listener));
        }
      }
    });

    if (typeof NativePeerConnection.prototype.createOffer === 'function') {
      const nativeCreateOffer = NativePeerConnection.prototype.createOffer;

      NativePeerConnection.prototype.createOffer = function createOffer() {
        const result = nativeCreateOffer.apply(this, arguments);

        if (!result || typeof result.then !== 'function') {
          return result;
        }

        return result.then((description) => {
          if (!description || !description.sdp) {
            return description;
          }

          return {
            ...description,
            sdp: sanitizeSdp(description.sdp)
          };
        });
      };
    }

    if (typeof NativePeerConnection.prototype.createAnswer === 'function') {
      const nativeCreateAnswer = NativePeerConnection.prototype.createAnswer;

      NativePeerConnection.prototype.createAnswer = function createAnswer() {
        const result = nativeCreateAnswer.apply(this, arguments);

        if (!result || typeof result.then !== 'function') {
          return result;
        }

        return result.then((description) => {
          if (!description || !description.sdp) {
            return description;
          }

          return {
            ...description,
            sdp: sanitizeSdp(description.sdp)
          };
        });
      };
    }

    if (typeof NativePeerConnection.prototype.setLocalDescription === 'function') {
      const nativeSetLocalDescription = NativePeerConnection.prototype.setLocalDescription;

      NativePeerConnection.prototype.setLocalDescription = function setLocalDescription(description) {
        if (description && description.sdp) {
          return nativeSetLocalDescription.call(this, {
            ...description,
            sdp: sanitizeSdp(description.sdp)
          });
        }

        return nativeSetLocalDescription.apply(this, arguments);
      };
    }
  }

  function normalizeAuthConfig(authConfig) {
    const accountIdentity = resolveAuthIdentity(authConfig);

    return {
      phoneNumber: accountIdentity.phoneNumber,
      email: accountIdentity.email,
      accountValue: accountIdentity.accountValue,
      accountType: accountIdentity.accountType,
      loginPassword: normalizeText(authConfig && authConfig.loginPassword)
    };
  }

  function hasCompleteAuthConfig(authConfig) {
    const accountIdentity = resolveAuthIdentity(authConfig);

    return Boolean(
      authConfig
      && accountIdentity.accountValue
      && normalizeText(authConfig.loginPassword)
    );
  }

  function readSavedAuthConfig() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return normalizeAuthConfig(null);
    }

    try {
      return normalizeAuthConfig(JSON.parse(
        window.localStorage.getItem(BROWSER_SAVED_AUTH_STORAGE_KEY) || '{}'
      ));
    } catch (_error) {
      return normalizeAuthConfig(null);
    }
  }

  function writeSavedAuthConfig(authConfig) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const normalizedAuthConfig = normalizeAuthConfig(authConfig);

    if (!normalizedAuthConfig.accountValue || !normalizedAuthConfig.loginPassword) {
      return;
    }

    try {
      window.localStorage.setItem(
        BROWSER_SAVED_AUTH_STORAGE_KEY,
        JSON.stringify(normalizedAuthConfig)
      );
    } catch (_error) {
      // Ignore storage quota or privacy mode failures.
    }
  }

  function canReuseSavedPassword(runtimeAuthConfig, savedAuthConfig) {
    const runtimeIdentity = resolveAuthIdentity(runtimeAuthConfig);
    const savedIdentity = resolveAuthIdentity(savedAuthConfig);

    if (!runtimeIdentity.accountValue || !savedIdentity.accountValue) {
      return false;
    }

    if (
      runtimeIdentity.accountType
      && savedIdentity.accountType
      && runtimeIdentity.accountType !== savedIdentity.accountType
    ) {
      return false;
    }

    if (runtimeIdentity.accountType === 'email' || savedIdentity.accountType === 'email') {
      return runtimeIdentity.accountValue.toLowerCase() === savedIdentity.accountValue.toLowerCase();
    }

    return runtimeIdentity.accountValue === savedIdentity.accountValue;
  }

  function resolveEffectiveAuthConfig(runtimeAuthConfig) {
    const normalizedRuntimeAuthConfig = normalizeAuthConfig(runtimeAuthConfig);
    const savedAuthConfig = readSavedAuthConfig();
    const runtimeAccountIdentity = resolveAuthIdentity(normalizedRuntimeAuthConfig);

    if (hasCompleteAuthConfig(normalizedRuntimeAuthConfig)) {
      return normalizedRuntimeAuthConfig;
    }

    if (
      normalizedRuntimeAuthConfig.accountValue
      || normalizedRuntimeAuthConfig.phoneNumber
      || normalizedRuntimeAuthConfig.email
      || normalizedRuntimeAuthConfig.loginPassword
    ) {
      const runtimeAccountValue =
        runtimeAccountIdentity.accountValue
        || normalizedRuntimeAuthConfig.accountValue
        || normalizedRuntimeAuthConfig.email
        || normalizedRuntimeAuthConfig.phoneNumber;

      return normalizeAuthConfig({
        phoneNumber: runtimeAccountIdentity.phoneNumber,
        email: runtimeAccountIdentity.email,
        accountValue: runtimeAccountValue,
        accountType: runtimeAccountIdentity.accountType,
        loginPassword:
          normalizedRuntimeAuthConfig.loginPassword
          || (canReuseSavedPassword(normalizedRuntimeAuthConfig, savedAuthConfig)
            ? savedAuthConfig.loginPassword
            : '')
      });
    }

    if (hasCompleteAuthConfig(savedAuthConfig)) {
      return savedAuthConfig;
    }

    return normalizeAuthConfig(null);
  }

  function isAutofillEnabled(authConfig) {
    return hasCompleteAuthConfig(authConfig);
  }

  function isTemuPage() {
    const hostname = normalizeText(window.location && window.location.hostname).toLowerCase();
    return Boolean(hostname) && (hostname === 'temu.com' || hostname.endsWith('.temu.com'));
  }

  function isSellerLoginPage() {
    const hostname = normalizeText(window.location && window.location.hostname).toLowerCase();
    const pathname = normalizeText(window.location && window.location.pathname).toLowerCase();

    return (
      SELLER_LOGIN_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && SELLER_LOGIN_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isActivityLoginPage() {
    const hostname = normalizeText(window.location && window.location.hostname).toLowerCase();
    const pathname = normalizeText(window.location && window.location.pathname).toLowerCase();

    return (
      SELLER_LOGIN_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && ACTIVITY_LOGIN_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isSupportedAutofillPage() {
    return isTemuPage() || isSellerLoginPage() || isActivityLoginPage();
  }

  function shouldUseHongKongRegion(phoneNumber) {
    return !isEmail(phoneNumber) && normalizeDigits(phoneNumber).length !== 11;
  }

  function normalizePhoneNumberForInput(phoneNumber) {
    const normalizedValue = normalizeText(phoneNumber);

    if (!normalizedValue) {
      return '';
    }

    if (isEmail(normalizedValue)) {
      return normalizedValue;
    }

    const digits = normalizeDigits(normalizedValue);

    if (!digits) {
      return normalizedValue;
    }

    if (shouldUseHongKongRegion(phoneNumber)) {
      if (digits.length > 8 && digits.startsWith('852')) {
        return digits.slice(3);
      }

      if (digits.length > 8) {
        return digits.slice(-8);
      }
    }

    return digits;
  }

  function isEditableInput(input) {
    return Boolean(
      input
      && input instanceof HTMLInputElement
      && input.disabled !== true
      && input.readOnly !== true
    );
  }

  function isElementVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.hidden || element.disabled || element.readOnly) {
      return false;
    }

    if (String(element.getAttribute('type') || '').toLowerCase() === 'hidden') {
      return false;
    }

    const style = window.getComputedStyle(element);

    if (!style || style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getElementHintText(element) {
    if (!(element instanceof HTMLElement)) {
      return '';
    }

    const labelText = element.labels
      ? Array.from(element.labels).map((label) => normalizeText(label && label.textContent)).join(' ')
      : '';
    const parentLabelText = normalizeText(element.closest('label') && element.closest('label').textContent);
    const container = element.closest(
      'form, [role="dialog"], .login, .signin, .sign-in, .passport, .account, .auth'
    );
    const containerText = normalizeText(container && container.textContent).slice(0, 240);

    return [
      normalizeText(element.getAttribute('placeholder')),
      normalizeText(element.getAttribute('aria-label')),
      normalizeText(element.getAttribute('autocomplete')),
      normalizeText(element.getAttribute('inputmode')),
      normalizeText(element.getAttribute('data-testid')),
      normalizeText(element.name),
      normalizeText(element.id),
      normalizeText(element.className),
      labelText,
      parentLabelText,
      containerText
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function matchesAnyPattern(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
  }

  function countMatchingPatterns(text, patterns) {
    return patterns.reduce((count, pattern) => (
      count + (pattern.test(text) ? 1 : 0)
    ), 0);
  }

  function getGenericElementHintText(element) {
    if (!(element instanceof HTMLElement)) {
      return '';
    }

    return [
      normalizeText(element.textContent),
      normalizeText(element.getAttribute('aria-label')),
      normalizeText(element.getAttribute('title')),
      normalizeText(element.getAttribute('value')),
      normalizeText(element.getAttribute('data-testid')),
      normalizeText(element.getAttribute('placeholder')),
      normalizeText(element.id),
      normalizeText(element.className)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function collectVisibleInputs() {
    return Array.from(document.querySelectorAll('input')).filter(isElementVisible);
  }

  function isAccountLoginSwitchPage() {
    const pathname = normalizeText(window.location && window.location.pathname).toLowerCase();
    return ACCOUNT_LOGIN_SWITCH_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
  }

  function getLoginModeHintText(element) {
    if (!(element instanceof HTMLElement)) {
      return '';
    }

    return [
      normalizeText(element.textContent),
      normalizeText(element.getAttribute('aria-label')),
      normalizeText(element.getAttribute('title')),
      normalizeText(element.getAttribute('data-testid')),
      normalizeText(element.getAttribute('role')),
      normalizeText(element.className),
      normalizeText(element.id)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function resolveLoginModeClickableTarget(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    return (
      element.closest('button, [role="tab"], [role="button"], [aria-selected], [aria-pressed], a, label')
      || element
    );
  }

  function hasSelectedLoginModeState(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const ariaSelected = normalizeText(element.getAttribute('aria-selected')).toLowerCase();
    const ariaCurrent = normalizeText(element.getAttribute('aria-current')).toLowerCase();
    const ariaPressed = normalizeText(element.getAttribute('aria-pressed')).toLowerCase();
    const stateText = [
      normalizeText(element.className),
      normalizeText(element.id),
      normalizeText(element.getAttribute('data-state')),
      normalizeText(element.getAttribute('data-status'))
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      ariaSelected === 'true'
      || ariaCurrent === 'page'
      || ariaPressed === 'true'
      || /\b(active|current|selected|checked|is-active|is-current|tab-active)\b/i.test(stateText)
    );
  }

  function collectLoginModeCandidates() {
    const selector = [
      'button',
      '[role="tab"]',
      '[role="button"]',
      '[aria-selected]',
      '[aria-pressed]',
      'a',
      'label',
      'div',
      'span'
    ].join(', ');
    const seen = new Set();

    return Array.from(document.querySelectorAll(selector))
      .map((element) => resolveLoginModeClickableTarget(element))
      .filter((element) => {
        if (!(element instanceof HTMLElement) || seen.has(element) || !isElementVisible(element)) {
          return false;
        }

        seen.add(element);
        const rect = element.getBoundingClientRect();

        if (rect.width <= 40 || rect.height <= 18 || rect.height >= 140) {
          return false;
        }

        if (rect.width >= Math.max(window.innerWidth * 0.95, 720) && rect.height >= 80) {
          return false;
        }

        const hintText = getLoginModeHintText(element);

        if (!hintText || hintText.length > 160) {
          return false;
        }

        return (
          matchesAnyPattern(hintText, ACCOUNT_LOGIN_MODE_HINT_PATTERNS)
          || matchesAnyPattern(hintText, OTP_LOGIN_MODE_HINT_PATTERNS)
          || matchesAnyPattern(hintText, EMAIL_LOGIN_MODE_HINT_PATTERNS)
          || matchesAnyPattern(hintText, SCAN_LOGIN_MODE_HINT_PATTERNS)
        );
      })
      .map((element) => {
        const hintText = getLoginModeHintText(element);
        const role = normalizeText(element.getAttribute('role')).toLowerCase();
        const accountMatches = countMatchingPatterns(hintText, ACCOUNT_LOGIN_MODE_HINT_PATTERNS);
        const emailMatches = countMatchingPatterns(hintText, EMAIL_LOGIN_MODE_HINT_PATTERNS);
        const otpMatches = countMatchingPatterns(hintText, OTP_LOGIN_MODE_HINT_PATTERNS);
        const scanMatches = countMatchingPatterns(hintText, SCAN_LOGIN_MODE_HINT_PATTERNS);
        const compactHintText = hintText.replace(/\s+/g, '');
        const classStateText = `${element.className} ${element.id}`;
        let score = 0;

        if (emailMatches > 0) {
          score += 220;
        }

        if (accountMatches > 0) {
          score += 180;
        }

        if (otpMatches > 0) {
          score -= 140;
        }

        if (scanMatches > 0) {
          score -= 180;
        }

        if ((accountMatches > 0 || emailMatches > 0) && (otpMatches > 0 || scanMatches > 0)) {
          score -= 220;
        }

        if (
          emailMatches > 0
          && /^(emaillogin|emailaccountlogin|\u90ae\u7bb1\u767b\u5f55|\u90ae\u7bb1\u8d26\u53f7\u767b\u5f55)$/.test(compactHintText)
        ) {
          score += 180;
        }

        if (
          accountMatches > 0
          && /^(accountpasswordlogin|accountlogin|passwordlogin|\u8d26\u53f7\u5bc6\u7801\u767b\u5f55|\u8d26\u53f7\u767b\u5f55|\u5bc6\u7801\u767b\u5f55)$/.test(compactHintText)
        ) {
          score += 140;
        }

        if (role === 'tab') {
          score += 40;
        } else if (role === 'button') {
          score += 24;
        }

        if (normalizeText(element.tagName).toLowerCase() === 'button') {
          score += 20;
        }

        if (/[._-](tab|switch|toggle|mode|card|segment|header)/i.test(classStateText)) {
          score += 18;
        }

        if (/tabitem/i.test(classStateText)) {
          score += 80;
        }

        if (/taboperate|logintab|commontab/i.test(classStateText)) {
          score -= 36;
        }

        if (hintText.length <= 28) {
          score += 24;
        } else if (hintText.length >= 56) {
          score -= 24;
        }

        if (element.childElementCount <= 2) {
          score += 14;
        } else if (element.childElementCount >= 4) {
          score -= 18;
        }

        if (hasSelectedLoginModeState(element)) {
          score += 16;
        }

        return {
          element,
          hintText,
          score,
          selected: hasSelectedLoginModeState(element)
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  function isEmailLoginModeCandidate(entry) {
    return matchesAnyPattern(normalizeText(entry && entry.hintText), EMAIL_LOGIN_MODE_HINT_PATTERNS);
  }

  function isOtpLoginModeCandidate(entry) {
    return matchesAnyPattern(normalizeText(entry && entry.hintText), OTP_LOGIN_MODE_HINT_PATTERNS);
  }

  function isScanLoginModeCandidate(entry) {
    return matchesAnyPattern(normalizeText(entry && entry.hintText), SCAN_LOGIN_MODE_HINT_PATTERNS);
  }

  function isAccountLoginModeCandidate(entry) {
    return (
      matchesAnyPattern(normalizeText(entry && entry.hintText), ACCOUNT_LOGIN_MODE_HINT_PATTERNS)
      && !isOtpLoginModeCandidate(entry)
      && !isScanLoginModeCandidate(entry)
    );
  }

  function getSelectedLoginModeCandidate(loginModeCandidates) {
    const candidates =
      Array.isArray(loginModeCandidates) && loginModeCandidates.length > 0
        ? loginModeCandidates
        : collectLoginModeCandidates();

    return candidates.find((entry) => entry && entry.selected === true) || null;
  }

  function isLikelyPhoneAccountInput(accountInput) {
    if (!(accountInput instanceof HTMLInputElement)) {
      return false;
    }

    const hintText = getElementHintText(accountInput);
    const inputType = normalizeText(accountInput.type).toLowerCase();
    const inputMode = normalizeText(accountInput.inputMode).toLowerCase();
    const autocomplete = normalizeText(accountInput.autocomplete).toLowerCase();

    return Boolean(
      /phone|mobile|\u624b\u673a/u.test(hintText)
      || matchesAnyPattern(hintText, HONG_KONG_REGION_PATTERNS)
      || matchesAnyPattern(hintText, MAINLAND_REGION_PATTERNS)
      || /area\s*code|prefix|\u533a\u53f7/u.test(hintText)
      || inputType === 'tel'
      || inputMode === 'numeric'
      || autocomplete.includes('tel')
    );
  }

  function isLikelyEmailOrAccountInput(accountInput) {
    if (!(accountInput instanceof HTMLInputElement)) {
      return false;
    }

    const hintText = getElementHintText(accountInput);
    const inputType = normalizeText(accountInput.type).toLowerCase();
    const inputMode = normalizeText(accountInput.inputMode).toLowerCase();
    const autocomplete = normalizeText(accountInput.autocomplete).toLowerCase();

    return Boolean(
      /email|mail|\u90ae\u7bb1/u.test(hintText)
      || /account|username|\u8d26\u53f7/u.test(hintText)
      || inputType === 'email'
      || inputMode === 'email'
      || autocomplete.includes('email')
      || autocomplete.includes('username')
    );
  }

  function isEmailLoginModeReady(loginModeCandidates) {
    const candidates =
      Array.isArray(loginModeCandidates) && loginModeCandidates.length > 0
        ? loginModeCandidates
        : collectLoginModeCandidates();
    const passwordInput = findPasswordInput();
    const accountInput = findAccountInput(passwordInput, {
      targetMode: 'email'
    });
    const selectedCandidate = getSelectedLoginModeCandidate(candidates);
    const hasSwitchCandidates = candidates.some((entry) => (
      isEmailLoginModeCandidate(entry) || isAccountLoginModeCandidate(entry)
    ));

    if (!(passwordInput && accountInput)) {
      return false;
    }

    if (selectedCandidate && (isOtpLoginModeCandidate(selectedCandidate) || isScanLoginModeCandidate(selectedCandidate))) {
      return false;
    }

    if (isLikelyPhoneAccountInput(accountInput)) {
      return false;
    }

    if (hasSwitchCandidates && !selectedCandidate) {
      return false;
    }

    if (selectedCandidate && isEmailLoginModeCandidate(selectedCandidate)) {
      return true;
    }

    if (selectedCandidate && isAccountLoginModeCandidate(selectedCandidate)) {
      return false;
    }

    return !hasSwitchCandidates && isLikelyEmailOrAccountInput(accountInput);
  }

  function hasCredentialInputsVisible(options) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const passwordInput = findPasswordInput();
    const accountInput = findAccountInput(passwordInput, normalizedOptions);
    return Boolean(passwordInput && accountInput);
  }

  function ensureAccountLoginMode(targetMode) {
    if (!isAccountLoginSwitchPage()) {
      return {
        ready: true,
        status: 'not-required'
      };
    }

    const normalizedTargetMode = normalizeText(targetMode).toLowerCase();
    const loginModeCandidates = collectLoginModeCandidates();

    if (normalizedTargetMode === 'email') {
      const emailCandidate = loginModeCandidates.find((entry) => isEmailLoginModeCandidate(entry));

      if (isEmailLoginModeReady(loginModeCandidates)) {
        return {
          ready: true,
          status: 'email-mode-ready'
        };
      }

      if (emailCandidate) {
        if (emailCandidate.selected === true) {
          return {
            ready: false,
            status: 'email-mode-waiting'
          };
        }

        triggerPointerClick(emailCandidate.element);
        return {
          ready: false,
          status: 'email-switch-clicked'
        };
      }

      return {
        ready: false,
        status: 'missing-email-login-mode'
      };
    }

    if (hasCredentialInputsVisible()) {
      return {
        ready: true,
        status: 'credentials-visible'
      };
    }

    const accountCandidate = loginModeCandidates.find((entry) => isAccountLoginModeCandidate(entry))
      || loginModeCandidates.find((entry) => matchesAnyPattern(entry.hintText, ACCOUNT_LOGIN_MODE_HINT_PATTERNS));

    if (!accountCandidate) {
      return {
        ready: false,
        status: 'missing-switcher'
      };
    }

    if (accountCandidate.selected === true) {
      const ready = hasCredentialInputsVisible();
      return {
        ready,
        status: ready ? 'account-mode-ready' : 'account-mode-waiting'
      };
    }

    triggerPointerClick(accountCandidate.element);
    return {
      ready: false,
      status: 'switch-clicked'
    };
  }

  function getSellerLoginPhoneRoot() {
    return document.getElementById('usernameId');
  }

  function getSellerLoginPasswordRoot() {
    return document.getElementById('passwordId');
  }

  function findSellerLoginPasswordInput() {
    const passwordRoot = getSellerLoginPasswordRoot();

    if (!passwordRoot) {
      return null;
    }

    const candidates = [
      ...(passwordRoot instanceof HTMLInputElement ? [passwordRoot] : []),
      ...Array.from(passwordRoot.querySelectorAll('input'))
    ]
      .map((input) => {
        const hintText = getElementHintText(input);
        let score = 0;

        if (String(input.type || '').toLowerCase() === 'password') {
          score += 120;
        }

        if (matchesAnyPattern(hintText, PASSWORD_HINT_PATTERNS)) {
          score += 80;
        }

        if (normalizeText(input.id) === 'passwordId') {
          score += 60;
        }

        if (isElementVisible(input)) {
          score += 40;
        }

        return {
          input,
          score
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return candidates.length > 0 ? candidates[0].input : null;
  }

  function findSellerLoginAccountInput(options) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const targetMode = normalizeText(normalizedOptions.targetMode).toLowerCase();
    const preferEmailMode = targetMode === 'email';
    const phoneRoot = getSellerLoginPhoneRoot();

    if (!phoneRoot) {
      return null;
    }

    const candidates = [
      ...(phoneRoot instanceof HTMLInputElement ? [phoneRoot] : []),
      ...Array.from(phoneRoot.querySelectorAll('input'))
    ]
      .map((input) => {
        const inputType = String(input.type || '').toLowerCase();
        const autocomplete = normalizeText(input.autocomplete).toLowerCase();
        const inputMode = normalizeText(input.inputMode).toLowerCase();
        const hintText = getElementHintText(input);
        const rect = input.getBoundingClientRect();
        const maxLength = Number(input.maxLength) || 0;
        let score = 0;

        if (!isEditableInput(input) || inputType === 'hidden' || inputType === 'password') {
          return {
            input,
            score: -1
          };
        }

        if (matchesAnyPattern(hintText, ACCOUNT_HINT_PATTERNS)) {
          score += 90;
        }

        if (preferEmailMode) {
          if (/email|mail|\u90ae\u7bb1/u.test(hintText)) {
            score += 180;
          }

          if (/account|username|\u8d26\u53f7/u.test(hintText)) {
            score += 90;
          }

          if (inputType === 'email') {
            score += 160;
          }

          if (inputMode === 'email') {
            score += 120;
          }

          if (autocomplete.includes('email')) {
            score += 140;
          }

          if (
            hintText.includes('\u624b\u673a\u53f7\u7801')
            || /phone|mobile|\u624b\u673a/u.test(hintText)
          ) {
            score -= 220;
          }
        } else if (hintText.includes('\u624b\u673a\u53f7\u7801')) {
          score += 120;
        }

        if (normalizeText(input.id) === 'usernameId') {
          score += 60;
        }

        if (autocomplete.includes('tel')) {
          score += 35;
        }

        if (inputMode === 'numeric') {
          score += 35;
        }

        if (inputType === 'tel') {
          score += 45;
        }

        if (maxLength >= 8) {
          score += 45;
        } else if (maxLength > 0 && maxLength <= 4) {
          score -= 120;
        }

        if (rect.width >= 160) {
          score += 60;
        } else if (rect.width > 0 && rect.width < 120) {
          score -= 60;
        }

        if (isElementVisible(input)) {
          score += 40;
        }

        if (
          matchesAnyPattern(hintText, HONG_KONG_REGION_PATTERNS)
          || matchesAnyPattern(hintText, MAINLAND_REGION_PATTERNS)
          || /area\s*code/i.test(hintText)
          || /prefix/i.test(hintText)
          || /\u533a\u53f7/u.test(hintText)
        ) {
          score -= 140;
        }

        if (
          preferEmailMode
          && (
            autocomplete.includes('tel')
            || inputMode === 'numeric'
            || inputType === 'tel'
          )
        ) {
          score -= 220;
        }

        if (input.closest('[class*="mobile-number-input_prefix__"]')) {
          score -= 180;
        }

        return {
          input,
          score
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return candidates.length > 0 ? candidates[0].input : null;
  }

  function getSellerLoginRegionRoot() {
    const phoneRoot = getSellerLoginPhoneRoot();

    if (!phoneRoot) {
      return null;
    }

    return (
      phoneRoot.querySelector('[class*="mobile-number-input_prefix__"]')
      || phoneRoot.querySelector('[class*="mobile-number-input_selectInputCustom__"]')
      || phoneRoot
    );
  }

  function findSellerLoginRegionSelect() {
    const regionRoot = getSellerLoginRegionRoot();

    if (!regionRoot) {
      return null;
    }

    return Array.from(regionRoot.querySelectorAll('select'))
      .find((selectElement) => isElementVisible(selectElement))
      || null;
  }

  function findSellerLoginRegionTrigger() {
    const regionRoot = getSellerLoginRegionRoot();

    if (!regionRoot) {
      return null;
    }

    const triggerSelectors = [
      '[role="combobox"]',
      '[aria-haspopup="listbox"]',
      '[aria-haspopup="menu"]',
      'button',
      '[class*="select"]',
      '[class*="dropdown"]',
      '[class*="prefix"]'
    ].join(', ');
    const candidates = Array.from(regionRoot.querySelectorAll(triggerSelectors))
      .filter((element) => isElementVisible(element));

    return candidates[0] || (isElementVisible(regionRoot) ? regionRoot : null);
  }

  function isSellerLoginHongKongRegionSelected() {
    const regionRoot = getSellerLoginRegionRoot();

    if (!regionRoot) {
      return false;
    }

    return matchesAnyPattern(getGenericElementHintText(regionRoot), HONG_KONG_REGION_PATTERNS);
  }

  function scorePasswordInput(input) {
    if (!(input instanceof HTMLInputElement)) {
      return -1;
    }

    const inputType = String(input.type || '').toLowerCase();
    const hintText = getElementHintText(input);
    let score = 0;

    if (inputType === 'password') {
      score += 100;
    }

    if (matchesAnyPattern(hintText, PASSWORD_HINT_PATTERNS)) {
      score += 50;
    }

    if (matchesAnyPattern(hintText, OTP_HINT_PATTERNS)) {
      score -= 120;
    }

    if (String(input.autocomplete || '').toLowerCase().includes('current-password')) {
      score += 35;
    }

    if (String(input.autocomplete || '').toLowerCase().includes('new-password')) {
      score -= 30;
    }

    return score;
  }

  function findPasswordInput() {
    if (isSellerLoginPage()) {
      const sellerPasswordInput = findSellerLoginPasswordInput();

      if (sellerPasswordInput) {
        return sellerPasswordInput;
      }
    }

    const passwordCandidates = collectVisibleInputs()
      .map((input) => ({
        input,
        score: scorePasswordInput(input)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return passwordCandidates.length > 0 ? passwordCandidates[0].input : null;
  }

  function scoreAccountInput(input, passwordInput, options) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const targetMode = normalizeText(normalizedOptions.targetMode).toLowerCase();
    const preferEmailMode = targetMode === 'email';

    if (!(input instanceof HTMLInputElement) || input === passwordInput || !isEditableInput(input)) {
      return -1;
    }

    const inputType = String(input.type || '').toLowerCase();

    if (
      [
        'password',
        'hidden',
        'checkbox',
        'radio',
        'file',
        'submit',
        'button',
        'image'
      ].includes(inputType)
    ) {
      return -1;
    }

    const hintText = getElementHintText(input);
    const autocomplete = String(input.autocomplete || '').toLowerCase();
    const inputMode = String(input.inputMode || '').toLowerCase();
    const rect = input.getBoundingClientRect();
    const maxLength = Number(input.maxLength) || 0;
    let score = 0;

    if (matchesAnyPattern(hintText, OTP_HINT_PATTERNS)) {
      score -= 140;
    }

    if (matchesAnyPattern(hintText, ACCOUNT_HINT_PATTERNS)) {
      score += 90;
    }

    if (preferEmailMode) {
      if (/email|mail|\u90ae\u7bb1/u.test(hintText)) {
        score += 180;
      }

      if (/account|username|\u8d26\u53f7/u.test(hintText)) {
        score += 90;
      }

      if (inputType === 'email') {
        score += 160;
      }

      if (inputMode === 'email') {
        score += 120;
      }

      if (autocomplete.includes('email')) {
        score += 140;
      }

      if (
        /phone|mobile|\u624b\u673a/u.test(hintText)
        || autocomplete.includes('tel')
        || inputMode === 'numeric'
        || inputType === 'tel'
      ) {
        score -= 220;
      }
    }

    if (
      matchesAnyPattern(hintText, HONG_KONG_REGION_PATTERNS)
      || matchesAnyPattern(hintText, MAINLAND_REGION_PATTERNS)
      || /area\s*code/i.test(hintText)
      || /prefix/i.test(hintText)
      || /\u533a\u53f7/u.test(hintText)
    ) {
      score -= 140;
    }

    if (['text', 'email', 'number', 'tel', 'search', ''].includes(inputType)) {
      score += 20;
    }

    if (
      autocomplete.includes('username')
      || autocomplete.includes('email')
    ) {
      score += 35;
    }

    if (autocomplete.includes('tel')) {
      score += 35;
    }

    if (inputMode === 'numeric') {
      score += 35;
    }

    if (inputMode === 'email') {
      score += 80;
    }

    if (inputType === 'tel') {
      score += 30;
    }

    if (maxLength >= 8) {
      score += 45;
    } else if (maxLength > 0 && maxLength <= 4) {
      score -= 120;
    }

    if (rect.width >= 160) {
      score += 60;
    } else if (rect.width > 0 && rect.width < 120) {
      score -= 60;
    }

    if (passwordInput) {
      if (input.form && passwordInput.form && input.form === passwordInput.form) {
        score += 20;
      }

      if (input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING) {
        score += 15;
      }

      if (input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_PRECEDING) {
        score -= 10;
      }
    }

    if (
      preferEmailMode
      && (
        autocomplete.includes('tel')
        || inputMode === 'numeric'
        || inputType === 'tel'
      )
    ) {
      score -= 220;
    }

    return score;
  }

  function findFallbackAccountInput(passwordInput, options) {
    if (!(passwordInput instanceof HTMLInputElement)) {
      return null;
    }

    const container =
      passwordInput.form
      || passwordInput.closest('form, [role="dialog"], .login, .signin, .sign-in, .passport, .account, .auth')
      || document;
    const precedingCandidates = Array.from(container.querySelectorAll('input'))
      .filter((input) => input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING)
      .map((input) => ({
        input,
        score: scoreAccountInput(input, passwordInput, options)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return precedingCandidates.length > 0 ? precedingCandidates[0].input : null;
  }

  function findAccountInput(passwordInput, options) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};

    if (isSellerLoginPage()) {
      const sellerAccountInput = findSellerLoginAccountInput(normalizedOptions);

      if (sellerAccountInput) {
        return sellerAccountInput;
      }
    }

    const accountCandidates = collectVisibleInputs()
      .map((input) => ({
        input,
        score: scoreAccountInput(input, passwordInput, normalizedOptions)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (accountCandidates.length > 0) {
      return accountCandidates[0].input;
    }

    return findFallbackAccountInput(passwordInput, normalizedOptions);
  }

  function isLikelyLoginContext(passwordInput, accountInput) {
    if (accountInput) {
      return true;
    }

    const container =
      (passwordInput && passwordInput.closest(
        'form, [role="dialog"], .login, .signin, .sign-in, .passport, .account, .auth'
      ))
      || document.body;
    const contextText = [
      normalizeText(document.title),
      normalizeText(window.location && window.location.pathname),
      normalizeText(window.location && window.location.hash),
      normalizeText(container && container.textContent).slice(0, 320)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return matchesAnyPattern(contextText, LOGIN_CONTEXT_PATTERNS);
  }

  function getLoginContainer(passwordInput, accountInput) {
    return (
      (accountInput && accountInput.closest(
        'form, [role="dialog"], .login, .signin, .sign-in, .passport, .account, .auth'
      ))
      || (passwordInput && passwordInput.closest(
        'form, [role="dialog"], .login, .signin, .sign-in, .passport, .account, .auth'
      ))
      || document.body
    );
  }

  function triggerPointerClick(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    try {
      element.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      element.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      element.click();
      return true;
    } catch (_error) {
      try {
        element.click();
        return true;
      } catch (__error) {
        return false;
      }
    }
  }

  function scoreRegionSelect(selectElement, accountInput) {
    if (!(selectElement instanceof HTMLSelectElement) || !isElementVisible(selectElement)) {
      return -1;
    }

    const optionText = Array.from(selectElement.options || [])
      .slice(0, 6)
      .map((option) => normalizeText(option && option.textContent))
      .join(' ')
      .toLowerCase();
    const hintText = `${getElementHintText(selectElement)} ${optionText}`.trim();
    let score = 0;

    if (matchesAnyPattern(hintText, REGION_HINT_PATTERNS)) {
      score += 90;
    }

    if (matchesAnyPattern(optionText, HONG_KONG_REGION_PATTERNS)) {
      score += 45;
    }

    if (accountInput && selectElement.form && accountInput.form && selectElement.form === accountInput.form) {
      score += 25;
    }

    if (accountInput && (selectElement.compareDocumentPosition(accountInput) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      score += 20;
    }

    return score;
  }

  function findRegionSelect(container, accountInput) {
    const candidates = Array.from(container.querySelectorAll('select'))
      .map((selectElement) => ({
        element: selectElement,
        score: scoreRegionSelect(selectElement, accountInput)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return candidates.length > 0 ? candidates[0].element : null;
  }

  function findHongKongOptionInSelect(selectElement) {
    if (!(selectElement instanceof HTMLSelectElement)) {
      return null;
    }

    const options = Array.from(selectElement.options || []);
    const matchedOption = options.find((option) => matchesAnyPattern(
      normalizeText(option && option.textContent).toLowerCase(),
      HONG_KONG_REGION_PATTERNS
    ));

    if (matchedOption) {
      return matchedOption;
    }

    return options.length > 1 ? options[1] : null;
  }

  function ensureHongKongSelectValue(selectElement) {
    const matchedOption = findHongKongOptionInSelect(selectElement);

    if (!matchedOption) {
      return true;
    }

    if (selectElement.value === matchedOption.value || selectElement.selectedIndex === matchedOption.index) {
      return true;
    }

    selectElement.selectedIndex = matchedOption.index;
    dispatchValueEvents(selectElement);
    return true;
  }

  function scoreRegionTrigger(element, accountInput) {
    if (!(element instanceof HTMLElement) || !isElementVisible(element)) {
      return -1;
    }

    const hintText = `${getGenericElementHintText(element)} ${getElementHintText(element)}`.trim();
    let score = 0;

    if (matchesAnyPattern(hintText, REGION_HINT_PATTERNS)) {
      score += 80;
    }

    if (matchesAnyPattern(hintText, HONG_KONG_REGION_PATTERNS)) {
      score += 35;
    }

    if (matchesAnyPattern(hintText, MAINLAND_REGION_PATTERNS)) {
      score += 25;
    }

    if (accountInput && (element.compareDocumentPosition(accountInput) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      score += 20;
    }

    if (accountInput && element.closest('form') && accountInput.form && element.closest('form') === accountInput.form) {
      score += 20;
    }

    if (matchesAnyPattern(hintText, LOGIN_CONTEXT_PATTERNS)) {
      score -= 40;
    }

    return score;
  }

  function findRegionTrigger(container, accountInput) {
    const selector = [
      'button',
      '[role="button"]',
      '[role="combobox"]',
      '[aria-haspopup="listbox"]',
      '[aria-haspopup="menu"]',
      '[class*="select"]',
      '[class*="dropdown"]',
      '[class*="country"]',
      '[class*="region"]',
      '[class*="code"]'
    ].join(', ');
    const candidates = Array.from(container.querySelectorAll(selector))
      .map((element) => ({
        element,
        score: scoreRegionTrigger(element, accountInput)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return candidates.length > 0 ? candidates[0].element : null;
  }

  function collectVisibleRegionOptions() {
    const selector = [
      '[role="option"]',
      '[role="menuitem"]',
      'li',
      'button',
      '[class*="option"]',
      '[class*="item"]'
    ].join(', ');
    const seen = new Set();

    return Array.from(document.querySelectorAll(selector))
      .map((node) => (
        node.closest('[role="option"], [role="menuitem"], li, button, [class*="option"], [class*="item"]')
        || node
      ))
      .filter((element) => {
        if (!(element instanceof HTMLElement) || seen.has(element) || !isElementVisible(element)) {
          return false;
        }

        seen.add(element);
        const hintText = getGenericElementHintText(element);
        return matchesAnyPattern(hintText, REGION_HINT_PATTERNS) || /^\+\s*\d{1,4}/.test(hintText);
      });
  }

  function findHongKongRegionOption() {
    const options = collectVisibleRegionOptions();
    const matchedOption = options.find((option) => matchesAnyPattern(
      getGenericElementHintText(option),
      HONG_KONG_REGION_PATTERNS
    ));

    if (matchedOption) {
      return matchedOption;
    }

    return options.length > 1 ? options[1] : null;
  }

  function ensureHongKongRegion(passwordInput, accountInput) {
    if (isSellerLoginPage()) {
      if (isSellerLoginHongKongRegionSelected()) {
        return true;
      }

      const sellerRegionSelect = findSellerLoginRegionSelect();

      if (sellerRegionSelect) {
        return ensureHongKongSelectValue(sellerRegionSelect);
      }

      const sellerHongKongOption = findHongKongRegionOption();

      if (sellerHongKongOption) {
        triggerPointerClick(sellerHongKongOption);
        return true;
      }

      const sellerRegionTrigger = findSellerLoginRegionTrigger();

      if (!sellerRegionTrigger) {
        return true;
      }

      triggerPointerClick(sellerRegionTrigger);
      return false;
    }

    const container = getLoginContainer(passwordInput, accountInput);
    const regionSelect = findRegionSelect(container, accountInput);

    if (regionSelect) {
      return ensureHongKongSelectValue(regionSelect);
    }

    const hongKongOption = findHongKongRegionOption();

    if (hongKongOption) {
      triggerPointerClick(hongKongOption);
      return true;
    }

    const regionTrigger = findRegionTrigger(container, accountInput);

    if (!regionTrigger) {
      return true;
    }

    if (matchesAnyPattern(getGenericElementHintText(regionTrigger), HONG_KONG_REGION_PATTERNS)) {
      return true;
    }

    triggerPointerClick(regionTrigger);
    return false;
  }

  function getValueSetter(element) {
    const descriptors = [];

    if (typeof HTMLInputElement === 'function' && element instanceof HTMLInputElement) {
      descriptors.push(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'));
    }

    if (typeof HTMLTextAreaElement === 'function' && element instanceof HTMLTextAreaElement) {
      descriptors.push(Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value'));
    }

    return descriptors.find((descriptor) => descriptor && typeof descriptor.set === 'function') || null;
  }

  function dispatchValueEvents(element) {
    try {
      element.focus({
        preventScroll: true
      });
    } catch (_error) {
      // Ignore focus failures on detached nodes.
    }

    ['input', 'change'].forEach((eventName) => {
      if (eventName === 'input' && typeof InputEvent === 'function') {
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: true,
          inputType: 'insertText',
          data: normalizeText(element.value)
        }));
        return;
      }

      element.dispatchEvent(new Event(eventName, {
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    });
  }

  function persistLoginDraft(accountInput, passwordInput) {
    const nextAccountValue = normalizeText(accountInput && accountInput.value);
    const nextPassword = normalizeText(passwordInput && passwordInput.value);

    if (!nextAccountValue || !nextPassword) {
      return;
    }

    const nextAccountType = isEmail(nextAccountValue) ? 'email' : 'phone';

    writeSavedAuthConfig({
      phoneNumber: nextAccountType === 'email' ? '' : nextAccountValue,
      email: nextAccountType === 'email' ? nextAccountValue : '',
      accountValue: nextAccountValue,
      accountType: nextAccountType,
      loginPassword: nextPassword
    });
  }

  function hasVisibleOtpInput() {
    return collectVisibleInputs().some((input) => matchesAnyPattern(
      getElementHintText(input),
      OTP_HINT_PATTERNS
    ));
  }

  function buildSellerLoginAutoSubmitKey(accountInput, authConfig) {
    const currentUrl = normalizeText(window.location && window.location.href);
    const accountValue = normalizeText(accountInput && accountInput.value)
      || normalizeText(authConfig && authConfig.accountValue)
      || normalizeText(authConfig && authConfig.email)
      || normalizeText(authConfig && authConfig.phoneNumber);
    const accountKey = isEmail(accountValue)
      ? accountValue.toLowerCase()
      : normalizeDigits(accountValue);

    return `${currentUrl}|${accountKey}`;
  }

  function shouldAttemptSellerLoginSubmit(attemptKey) {
    if (!attemptKey) {
      return false;
    }

    const previousAttempt = sellerLoginAutoSubmitAttempts.get(attemptKey);

    if (!previousAttempt) {
      return true;
    }

    if (previousAttempt.count >= SELLER_LOGIN_AUTO_SUBMIT_MAX_ATTEMPTS) {
      return false;
    }

    return Date.now() - previousAttempt.updatedAt >= SELLER_LOGIN_AUTO_SUBMIT_COOLDOWN_MS;
  }

  function markSellerLoginSubmitAttempt(attemptKey) {
    if (!attemptKey) {
      return;
    }

    const previousAttempt = sellerLoginAutoSubmitAttempts.get(attemptKey);
    const nextCount = previousAttempt ? previousAttempt.count + 1 : 1;

    sellerLoginAutoSubmitAttempts.set(attemptKey, {
      count: nextCount,
      updatedAt: Date.now()
    });
  }

  function getSellerLoginAgreementCheckbox() {
    const checkboxCandidates = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]'))
      .filter((element) => {
        const hintText = [
          getGenericElementHintText(element),
          getGenericElementHintText(element.parentElement),
          getGenericElementHintText(element.closest('label, div, span'))
        ]
          .filter(Boolean)
          .join(' ');

        return (
          matchesAnyPattern(hintText, [/\u9690\u79c1\u653f\u7b56/u, /\u9605\u8bfb\u5e76\u540c\u610f/u])
          || matchesAnyPattern(hintText, [/\u8d26\u53f7ID/u, /\u5e97\u94fa\u540d\u79f0/u])
        );
      });

    if (checkboxCandidates.length > 0) {
      return checkboxCandidates[0];
    }

    return document.querySelector('input[type="checkbox"], [role="checkbox"]');
  }

  function isCheckboxChecked(checkboxElement) {
    if (!checkboxElement) {
      return false;
    }

    if (checkboxElement instanceof HTMLInputElement) {
      return checkboxElement.checked === true;
    }

    const ariaChecked = normalizeText(checkboxElement.getAttribute('aria-checked')).toLowerCase();

    if (ariaChecked) {
      return ariaChecked === 'true';
    }

    const hintText = getGenericElementHintText(checkboxElement);
    return /\bchecked\b/i.test(hintText) && !/\bunchecked\b/i.test(hintText);
  }

  function ensureSellerLoginAgreementAccepted() {
    const checkboxElement = getSellerLoginAgreementCheckbox();

    if (!checkboxElement) {
      return false;
    }

    if (isCheckboxChecked(checkboxElement)) {
      return true;
    }

    const triggerElement =
      checkboxElement.closest('label')
      || checkboxElement.parentElement
      || checkboxElement;

    triggerPointerClick(triggerElement);
    return false;
  }

  function findSellerLoginSubmitButton() {
    const buttonCandidates = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter((element) => isElementVisible(element))
      .map((element) => {
        const hintText = getGenericElementHintText(element);
        let score = 0;

        if (hintText.includes('\u6388\u6743\u767b\u5f55')) {
          score += 140;
        }

        if (hintText.includes('\u767b\u5f55\u4e2d')) {
          score += 100;
        }

        if (matchesAnyPattern(hintText, LOGIN_CONTEXT_PATTERNS)) {
          score += 30;
        }

        if (Math.round(element.getBoundingClientRect().width) >= 280) {
          score += 20;
        }

        return {
          element,
          score
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return buttonCandidates.length > 0 ? buttonCandidates[0].element : null;
  }

  function isElementDisabled(element) {
    if (!(element instanceof HTMLElement)) {
      return true;
    }

    if ('disabled' in element && element.disabled === true) {
      return true;
    }

    const ariaDisabled = normalizeText(element.getAttribute('aria-disabled')).toLowerCase();

    return ariaDisabled === 'true';
  }

  function attemptSellerLoginSubmit(authConfig, accountInput, passwordInput) {
    if (!isSellerLoginPage()) {
      return;
    }

    if (!normalizeText(accountInput && accountInput.value) || !normalizeText(passwordInput && passwordInput.value)) {
      return;
    }

    if (hasVisibleOtpInput()) {
      return;
    }

    if (!ensureSellerLoginAgreementAccepted()) {
      return;
    }

    const submitButton = findSellerLoginSubmitButton();

    if (!submitButton || isElementDisabled(submitButton)) {
      return;
    }

    const buttonText = getGenericElementHintText(submitButton);

    if (buttonText.includes('\u767b\u5f55\u4e2d')) {
      return;
    }

    const attemptKey = buildSellerLoginAutoSubmitKey(accountInput, authConfig);

    if (!shouldAttemptSellerLoginSubmit(attemptKey)) {
      return;
    }

    markSellerLoginSubmitAttempt(attemptKey);
    triggerPointerClick(submitButton);
  }

  function applyAutofillValue(element, nextValue, markerKey) {
    const normalizedValue = normalizeText(nextValue);

    if (!element || !normalizedValue) {
      return false;
    }

    const currentValue = normalizeText(element.value);
    const previousAutofillValue = normalizeText(element.dataset[markerKey]);

    if (
      currentValue
      && currentValue !== normalizedValue
      && currentValue !== previousAutofillValue
    ) {
      return false;
    }

    const valueDescriptor = getValueSetter(element);

    if (valueDescriptor && typeof valueDescriptor.set === 'function') {
      valueDescriptor.set.call(element, normalizedValue);
    } else {
      element.value = normalizedValue;
    }

    element.dataset[markerKey] = normalizedValue;
    dispatchValueEvents(element);
    return true;
  }

  function attemptLoginAutofill(authConfig) {
    if (!isSupportedAutofillPage()) {
      return;
    }

    const authIdentity = resolveAuthIdentity(authConfig);
    const accountValue = normalizeText(authIdentity && authIdentity.accountValue)
      || normalizeText(authConfig && authConfig.accountValue)
      || normalizeText(authConfig && authConfig.email)
      || normalizeText(authConfig && authConfig.phoneNumber);
    const targetMode = normalizeText(authIdentity && authIdentity.accountType) === 'email'
      ? 'email'
      : '';
    const loginModeState = ensureAccountLoginMode(targetMode);

    if (!loginModeState || loginModeState.ready !== true) {
      return;
    }

    const passwordInput = findPasswordInput();

    if (!passwordInput) {
      return;
    }

    const accountInput = findAccountInput(passwordInput, {
      targetMode
    });

    if (!isLikelyLoginContext(passwordInput, accountInput)) {
      return;
    }

    if (targetMode !== 'email' && shouldUseHongKongRegion(accountValue) && !ensureHongKongRegion(passwordInput, accountInput)) {
      return;
    }

    applyAutofillValue(
      accountInput,
      normalizePhoneNumberForInput(accountValue),
      'temuAutofillPhone'
    );
    applyAutofillValue(passwordInput, authConfig.loginPassword, 'temuAutofillPassword');
    persistLoginDraft(accountInput, passwordInput);
    attemptSellerLoginSubmit(authConfig, accountInput, passwordInput);
  }

  function scheduleLoginAutofill(authConfig) {
    if (!isAutofillEnabled(authConfig) || typeof document === 'undefined') {
      return;
    }

    let debounceTimer = 0;
    let retryCount = 0;
    let intervalId = 0;
    let observer = null;

    const queueAutofill = (delay = AUTOFILL_DEBOUNCE_MS) => {
      if (debounceTimer) {
        return;
      }

      debounceTimer = window.setTimeout(() => {
        debounceTimer = 0;
        attemptLoginAutofill(authConfig);
      }, delay);
    };

    const startObserver = () => {
      if (observer || typeof MutationObserver !== 'function' || !document.documentElement) {
        return;
      }

      observer = new MutationObserver(() => {
        queueAutofill();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        startObserver();
        queueAutofill(0);
      }, {
        once: true
      });
    } else {
      startObserver();
      queueAutofill(0);
    }

    document.addEventListener('readystatechange', () => {
      queueAutofill();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        queueAutofill();
      }
    });
    window.addEventListener('focus', () => {
      queueAutofill();
    });
    window.addEventListener('load', () => {
      queueAutofill();
    });

    intervalId = window.setInterval(() => {
      retryCount += 1;
      queueAutofill();

      if (retryCount >= AUTOFILL_RETRY_LIMIT) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    }, AUTOFILL_RETRY_INTERVAL_MS);

    window.addEventListener('beforeunload', () => {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
        debounceTimer = 0;
      }

      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }

      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }, {
      once: true
    });
  }

  function scheduleLoginDraftPersistence() {
    if (typeof document === 'undefined' || !isSupportedAutofillPage()) {
      return;
    }

    let persistenceTimer = 0;
    const queuePersistence = () => {
      if (persistenceTimer) {
        window.clearTimeout(persistenceTimer);
      }

      persistenceTimer = window.setTimeout(() => {
        persistenceTimer = 0;
        const passwordInput = findPasswordInput();
        const accountInput = findAccountInput(passwordInput);

        if (!passwordInput || !accountInput || !isLikelyLoginContext(passwordInput, accountInput)) {
          return;
        }

        persistLoginDraft(accountInput, passwordInput);
      }, 180);
    };

    document.addEventListener('input', queuePersistence, true);
    document.addEventListener('change', queuePersistence, true);
    window.addEventListener('beforeunload', () => {
      if (persistenceTimer) {
        window.clearTimeout(persistenceTimer);
        persistenceTimer = 0;
      }

      const passwordInput = findPasswordInput();
      const accountInput = findAccountInput(passwordInput);

      if (!passwordInput || !accountInput || !isLikelyLoginContext(passwordInput, accountInput)) {
        return;
      }

      persistLoginDraft(accountInput, passwordInput);
    });
  }

  const fingerprintConfig = parseFingerprintConfig();
  const authConfig = resolveEffectiveAuthConfig(parseAuthConfig());

  if (!fingerprintConfig && !isAutofillEnabled(authConfig)) {
    return;
  }

  if (fingerprintConfig) {
    patchChromeRuntime();
    patchNavigator(fingerprintConfig);
    patchFonts(fingerprintConfig);
    patchScreen(fingerprintConfig);
    patchWindowGeometry(fingerprintConfig);
    patchTimeZone(fingerprintConfig);
    patchPermissionsAndDevices(fingerprintConfig);
    patchNetworkAndMedia(fingerprintConfig);
    patchDomGeometryAndText(fingerprintConfig);
    patchCanvas(fingerprintConfig);
    patchAudio(fingerprintConfig);
    patchWebGl(fingerprintConfig);
    patchWebRtc();
  }

  if (isAutofillEnabled(authConfig)) {
    scheduleLoginAutofill(authConfig);
  }

  scheduleLoginDraftPersistence();
})();
