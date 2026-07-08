const { DEFAULT_TEMU_USER_AGENT } = require('./defaultUserAgent');

const DEFAULT_LANGUAGE = 'zh-CN';
const DEFAULT_LANGUAGES = Object.freeze(['zh-CN', 'zh', 'en-US']);
const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_PLATFORM = 'Win32';
const DEFAULT_VENDOR = 'Google Inc.';
const DEFAULT_PRODUCT_SUB = '20030107';
const DEFAULT_DO_NOT_TRACK = '0';
const DEFAULT_MAX_TOUCH_POINTS = 0;
const DEFAULT_DEVICE_PIXEL_RATIO = 1;
const DEFAULT_COLOR_DEPTH = 24;

const COMMON_WEBGL_EXTENSIONS = Object.freeze([
  'ANGLE_instanced_arrays',
  'EXT_blend_minmax',
  'EXT_clip_control',
  'EXT_color_buffer_half_float',
  'EXT_depth_clamp',
  'EXT_disjoint_timer_query',
  'EXT_float_blend',
  'EXT_frag_depth',
  'EXT_polygon_offset_clamp',
  'EXT_shader_texture_lod',
  'EXT_texture_compression_bptc',
  'EXT_texture_compression_rgtc',
  'EXT_texture_filter_anisotropic',
  'EXT_sRGB',
  'KHR_parallel_shader_compile',
  'OES_element_index_uint',
  'OES_fbo_render_mipmap',
  'OES_standard_derivatives',
  'OES_texture_float',
  'OES_texture_float_linear',
  'OES_texture_half_float',
  'OES_texture_half_float_linear',
  'OES_vertex_array_object',
  'WEBGL_color_buffer_float',
  'WEBGL_compressed_texture_s3tc',
  'WEBGL_compressed_texture_s3tc_srgb',
  'WEBGL_debug_renderer_info',
  'WEBGL_debug_shaders',
  'WEBGL_depth_texture',
  'WEBGL_draw_buffers',
  'WEBGL_lose_context'
]);

const DEVICE_PROFILES = Object.freeze([
  {
    key: 'mac_apple_silicon_1440',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 1440,
      height: 900,
      taskbarHeight: 24,
      devicePixelRatio: 2,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 2
    },
    webgl: {
      vendor: 'Apple Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 1024],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'mac_intel_uhd_1920',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 1920,
      height: 1080,
      taskbarHeight: 24,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 4,
      deviceMemory: 8,
      maxTouchPoints: 2
    },
    webgl: {
      vendor: 'Apple Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) Iris Plus Graphics OpenGL Engine)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 1024],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'win10_intel_uhd_1080',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'Win32',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 1920,
      height: 1080,
      taskbarHeight: 40,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0
    },
    webgl: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 1024],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'win10_nvidia_1600',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'Win32',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 1600,
      height: 900,
      taskbarHeight: 40,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0
    },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 2047],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'win10_amd_1536',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'Win32',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 1536,
      height: 864,
      taskbarHeight: 40,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 12,
      deviceMemory: 16,
      maxTouchPoints: 0
    },
    webgl: {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 1024],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'win10_intel_hd_1366',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'Win32',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '1',
    screen: {
      width: 1366,
      height: 768,
      taskbarHeight: 40,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 4,
      deviceMemory: 8,
      maxTouchPoints: 0
    },
    webgl: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 1024],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'win10_nvidia_1440p',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'Win32',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 2560,
      height: 1440,
      taskbarHeight: 40,
      devicePixelRatio: 2,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 16,
      deviceMemory: 32,
      maxTouchPoints: 1
    },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 2047],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  },
  {
    key: 'linux_intel_1080',
    userAgent: DEFAULT_TEMU_USER_AGENT,
    platform: 'Linux x86_64',
    vendor: 'Google Inc.',
    productSub: '20030107',
    doNotTrack: '0',
    screen: {
      width: 1920,
      height: 1080,
      taskbarHeight: 28,
      devicePixelRatio: 1,
      colorDepth: 24,
      pixelDepth: 24
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0
    },
    webgl: {
      vendor: 'Intel Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (WHL GT2), OpenGL 4.6)',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
      extensions: COMMON_WEBGL_EXTENSIONS,
      parameters: {
        maxTextureSize: 16384,
        maxCubeMapTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxViewportDims: [16384, 16384],
        aliasedLineWidthRange: [1, 1],
        aliasedPointSizeRange: [1, 1024],
        maxVertexAttribs: 16,
        maxCombinedTextureImageUnits: 32,
        maxTextureImageUnits: 16,
        maxVertexTextureImageUnits: 16,
        redBits: 8,
        greenBits: 8,
        blueBits: 8,
        alphaBits: 8,
        depthBits: 24,
        stencilBits: 8
      }
    }
  }
]);

const LOCALE_PROFILES = Object.freeze([
  {
    key: 'zh_cn_mainland',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en-US'],
    timezone: 'Asia/Shanghai',
    fonts: ['Microsoft YaHei UI', 'Microsoft YaHei', 'SimSun', 'Segoe UI', 'Arial'],
    voices: [
      { voiceURI: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN', localService: true, default: true },
      { voiceURI: 'Microsoft Yunxi Online (Natural) - Chinese (Mainland)', name: 'Microsoft Yunxi Online (Natural)', lang: 'zh-CN', localService: true, default: false }
    ]
  },
  {
    key: 'zh_hk',
    language: 'zh-HK',
    languages: ['zh-HK', 'zh-TW', 'zh', 'en-US'],
    timezone: 'Asia/Hong_Kong',
    fonts: ['Microsoft JhengHei UI', 'Microsoft JhengHei', 'PMingLiU', 'Segoe UI', 'Arial'],
    voices: [
      { voiceURI: 'Microsoft Tracy Online (Natural) - Chinese (Hong Kong SAR)', name: 'Microsoft Tracy Online (Natural)', lang: 'zh-HK', localService: true, default: true },
      { voiceURI: 'Microsoft Yan Online (Natural) - Chinese (Hong Kong SAR)', name: 'Microsoft Yan Online (Natural)', lang: 'zh-HK', localService: true, default: false }
    ]
  },
  {
    key: 'en_us_west',
    language: 'en-US',
    languages: ['en-US', 'en'],
    timezone: 'America/Los_Angeles',
    fonts: ['Segoe UI', 'Arial', 'Calibri', 'Times New Roman', 'Courier New'],
    voices: [
      { voiceURI: 'Microsoft Aria Online (Natural) - English (United States)', name: 'Microsoft Aria Online (Natural)', lang: 'en-US', localService: true, default: true },
      { voiceURI: 'Microsoft Guy Online (Natural) - English (United States)', name: 'Microsoft Guy Online (Natural)', lang: 'en-US', localService: true, default: false }
    ]
  },
  {
    key: 'en_gb',
    language: 'en-GB',
    languages: ['en-GB', 'en', 'zh-CN'],
    timezone: 'Europe/London',
    fonts: ['Segoe UI', 'Arial', 'Calibri', 'Times New Roman', 'Courier New'],
    voices: [
      { voiceURI: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB', localService: true, default: true },
      { voiceURI: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', name: 'Microsoft Ryan Online (Natural)', lang: 'en-GB', localService: true, default: false }
    ]
  },
  {
    key: 'en_sg',
    language: 'en-SG',
    languages: ['en-SG', 'en-US', 'en', 'zh-CN'],
    timezone: 'Asia/Singapore',
    fonts: ['Segoe UI', 'Arial', 'Calibri', 'Microsoft YaHei UI'],
    voices: [
      { voiceURI: 'Microsoft Luna Online (Natural) - English (Singapore)', name: 'Microsoft Luna Online (Natural)', lang: 'en-SG', localService: true, default: true }
    ]
  },
  {
    key: 'ja_jp',
    language: 'ja-JP',
    languages: ['ja-JP', 'ja', 'en-US'],
    timezone: 'Asia/Tokyo',
    fonts: ['Yu Gothic UI', 'Yu Gothic', 'Meiryo', 'Segoe UI', 'Arial'],
    voices: [
      { voiceURI: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', name: 'Microsoft Nanami Online (Natural)', lang: 'ja-JP', localService: true, default: true },
      { voiceURI: 'Microsoft Keita Online (Natural) - Japanese (Japan)', name: 'Microsoft Keita Online (Natural)', lang: 'ja-JP', localService: true, default: false }
    ]
  }
]);

const NETWORK_PROFILES = Object.freeze([
  {
    key: 'wifi_fast',
    effectiveType: '4g',
    downlink: 9.7,
    rtt: 40,
    saveData: false
  },
  {
    key: 'wifi_standard',
    effectiveType: '4g',
    downlink: 5.6,
    rtt: 75,
    saveData: false
  },
  {
    key: 'ethernet_desktop',
    effectiveType: '4g',
    downlink: 10,
    rtt: 25,
    saveData: false
  },
  {
    key: 'conservative',
    effectiveType: '3g',
    downlink: 2.4,
    rtt: 180,
    saveData: false
  }
]);

const PLUGIN_TEMPLATES = Object.freeze([
  {
    name: 'PDF Viewer',
    filename: 'internal-pdf-viewer',
    description: 'Portable Document Format',
    mimeTypes: [
      {
        type: 'application/pdf',
        suffixes: 'pdf',
        description: 'Portable Document Format'
      }
    ]
  },
  {
    name: 'Chrome PDF Viewer',
    filename: 'internal-chrome-pdf-viewer',
    description: 'Portable Document Format',
    mimeTypes: [
      {
        type: 'application/x-google-chrome-pdf',
        suffixes: 'pdf',
        description: 'Portable Document Format'
      }
    ]
  },
  {
    name: 'Chromium PDF Viewer',
    filename: 'internal-chromium-pdf-viewer',
    description: 'Portable Document Format',
    mimeTypes: []
  }
]);

const PERMISSION_PRESETS = Object.freeze([
  {
    key: 'standard',
    geolocation: 'denied',
    notifications: 'prompt',
    camera: 'denied',
    microphone: 'denied',
    midi: 'denied',
    clipboardRead: 'prompt',
    clipboardWrite: 'granted'
  },
  {
    key: 'strict',
    geolocation: 'denied',
    notifications: 'denied',
    camera: 'denied',
    microphone: 'denied',
    midi: 'denied',
    clipboardRead: 'prompt',
    clipboardWrite: 'granted'
  }
]);

module.exports = {
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
};
