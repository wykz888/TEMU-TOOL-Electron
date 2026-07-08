(function initPodSuiteTool() {
  const state = {
    activeMode: 'white-mockup',
    whiteMockupPath: '',
    imageDirectoryPath: '',
    outputDirectoryPath: '',
    imageFiles: [],
    previewDesignPath: '',
    whiteMockupPreviewDataUrl: '',
    whiteMockupPreviewStale: false,
    whiteMockupTemplate: null,
    whiteMockupTemplateDirty: false,
    whiteMockupTemplateIsDefault: true,
    whiteMockupImageNaturalSize: {
      width: 0,
      height: 0
    },
    whiteMockupActiveRegionIndex: 0,
    whiteMockupDragPointIndex: -1,
    whiteMockupDragWarpControlIndex: -1,
    psdMockups: [],
    psdTemplates: [],
    psdSelectedTemplateId: '',
    psdTemplateName: '',
    psdDeleteTemplateConfirmId: '',
    psdDeleteTemplateConfirmUntil: 0,
    psdEngineWindowMode: 'hidden',
    psdEngineConcurrency: 2,
    psdExportMode: 'original',
    psdOutputFormat: 'png',
    psdImageQuality: 100,
    psdSkipExistingOutputs: true,
    psdMetadataSourcePath: '',
    psdMetadataSourceDirectoryPath: '',
    psdMetadataSourceFiles: [],
    psdImageDirectoryPath: '',
    psdOutputDirectoryPath: '',
    psdImageFiles: [],
    psdSmartObjectRunning: false,
    psdSmartObjectCanceling: false,
    psdProgressStartedAt: 0,
    psdLastProgress: null,
    psdLastProgressLogKey: '',
    psdProgressSummary: null,
    unsubscribePsdProgress: null,
    busy: false
  };

  const SETTINGS_STORAGE_KEY = 'pod-suite-tool-settings-v1';
  const MAX_PSD_ACTIVE_ENGINE_COUNT = 24;
  const WINDOW_RUN_ID = createEntityId('pod_suite_window');
  const elements = {};
  const templateRegions = window.podSuiteTemplateRegions || {};
  const DEFAULT_WHITE_MOCKUP_TEMPLATE_SIZE = templateRegions.DEFAULT_TEMPLATE_SIZE || Object.freeze({
    width: 934,
    height: 933
  });
  const DEFAULT_WHITE_MOCKUP_TEMPLATE = templateRegions.DEFAULT_TEMPLATE || Object.freeze({
    id: 'tablecloth-flat-main',
    title: '\u684c\u5e03\u591a\u533a\u57df',
    maskImagePath: '',
    textureImagePath: '',
    regions: Object.freeze([
      Object.freeze({
        name: '\u684c\u9762',
        points: Object.freeze([
          Object.freeze([31, 264]),
          Object.freeze([404, 166]),
          Object.freeze([898, 465]),
          Object.freeze([492, 644])
        ]),
        strength: 0.84,
        feather: 15,
        bleed: 0
      })
    ])
  });
  const WHITE_MOCKUP_POINT_LABELS = templateRegions.POINT_LABELS || Object.freeze([
    '\u5de6\u4e0a',
    '\u53f3\u4e0a',
    '\u53f3\u4e0b',
    '\u5de6\u4e0b'
  ]);
  const MASK_SHAPE_REGION_TYPE = templateRegions.MASK_SHAPE_REGION_TYPE || 'mask-shape';
  const MODE_STATUS_TEXT = Object.freeze({
    'white-mockup': '\u5f85\u9009\u62e9\u767d\u819c',
    'psd-smart-object': 'PSD\u667a\u80fd\u5957\u56fe'
  });
  const PSD_EXPORT_MODE_LABELS = Object.freeze({
    original: '\u6574\u56fe\u5bfc\u51fa',
    guides: '\u6309\u53c2\u8003\u7ebf\u5207\u7247',
    slices: '\u6309PSD\u5207\u7247\u6807\u8bb0'
  });
  const PSD_REPLACEMENT_MODE_LABELS = Object.freeze({
    'cover-canvas': '\u94fa\u6ee1\u753b\u5e03(\u7b49\u6bd4\u88c1\u8fb9)',
    'contain-canvas': '\u5339\u914d\u753b\u5e03\u5c3a\u5bf8',
    'layer-bounds-transform': '\u6309\u539f\u56fe\u5c42\u8fb9\u754c(\u62c9\u4f38)'
  });
  const PSD_SOURCE_ROTATION_LABELS = Object.freeze({
    none: '\u4e0d\u65cb\u8f6c',
    left: '\u5411\u5de6\u65cb\u8f6c90\u00b0',
    right: '\u5411\u53f3\u65cb\u8f6c90\u00b0'
  });
  const PSD_PROGRESS_PHASE_LABELS = Object.freeze({
    start: '\u4efb\u52a1\u542f\u52a8',
    'collect-sources': '\u6b63\u5728\u8bfb\u53d6\u7d20\u6750\u76ee\u5f55',
    'sources-ready': '\u7d20\u6750\u5df2\u8bfb\u53d6',
    'mockup-start': '\u6837\u673a\u5f00\u59cb\u5904\u7406',
    'mockup-prepare': '\u6b63\u5728\u51c6\u5907\u6837\u673a',
    'mockup-local-parse': '\u6b63\u5728\u8bc6\u522bPSD\u56fe\u5c42',
    'engine-start-wait': '\u7b49\u5f85\u5f15\u64ce\u542f\u52a8',
    'engine-start': '\u5f15\u64ce\u5f00\u59cb\u542f\u52a8',
    'mockup-loading': '\u6b63\u5728\u6253\u5f00PSD',
    'mockup-retry': '\u6b63\u5728\u91cd\u65b0\u6253\u5f00PSD',
    'mockup-ready': 'PSD\u5df2\u8f7d\u5165',
    'item-start': '\u7d20\u6750\u5f00\u59cb\u5904\u7406',
    'smart-open': '\u6b63\u5728\u6253\u5f00\u667a\u80fd\u5bf9\u8c61',
    replace: '\u6b63\u5728\u66ff\u6362\u7d20\u6750',
    export: '\u6b63\u5728\u5bfc\u51fa\u6837\u673a',
    'post-process-wait': '\u7b49\u5f85\u540e\u5904\u7406\u961f\u5217',
    'post-process': '\u6b63\u5728\u5904\u7406\u5bfc\u51fa\u56fe',
    'post-process-drain': '\u6b63\u5728\u7b49\u5f85\u5207\u7247\u4fdd\u5b58\u5b8c\u6210',
    slice: '\u6b63\u5728\u5207\u7247',
    'write-output': '\u6b63\u5728\u5199\u5165\u6587\u4ef6',
    'item-skipped': '\u5df2\u5b58\u5728\uff0c\u8df3\u8fc7',
    cleanup: '\u6b63\u5728\u6e05\u7406\u5f15\u64ce\u7f13\u5b58',
    'item-retry': '\u7d20\u6750\u8d85\u65f6\u91cd\u8bd5',
    'item-done': '\u7d20\u6750\u5df2\u5b8c\u6210',
    'item-failed': '\u7d20\u6750\u5931\u8d25',
    'mockup-done': '\u6837\u673a\u5df2\u5b8c\u6210',
    'mockup-failed': '\u6837\u673a\u5931\u8d25',
    complete: '\u4efb\u52a1\u5b8c\u6210'
  });

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createEntityId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizePsdReplacementMode(value) {
    const mode = normalizeText(value);
    return ['cover-canvas', 'contain-canvas', 'layer-bounds-transform'].includes(mode)
      ? mode
      : 'cover-canvas';
  }

  function normalizePsdSourceRotation(value) {
    const mode = normalizeText(value);
    return ['left', 'right'].includes(mode) ? mode : 'none';
  }

  function normalizePsdExportMode(value) {
    const mode = normalizeText(value);
    return ['original', 'guides', 'slices'].includes(mode) ? mode : 'original';
  }

  function normalizePsdOutputFormat(value) {
    const format = normalizeText(value).toLowerCase();
    return ['png', 'jpg', 'webp'].includes(format) ? format : 'png';
  }

  function normalizePsdImageQuality(value) {
    const quality = Math.round(Number(value) || 100);
    return Math.max(60, Math.min(100, quality));
  }

  function normalizePsdEngineWindowMode(value) {
    const mode = normalizeText(value);
    return mode === 'visible' ? 'visible' : 'hidden';
  }

  function normalizePsdEngineConcurrency(value) {
    const count = Math.round(Number(value) || 2);
    return Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, count));
  }

  function getPsdEngineWorkerMultiplier(value) {
    const normalizedValue = normalizePsdEngineConcurrency(value);
    return normalizedValue <= 1 ? 0 : normalizedValue - 1;
  }

  function getPsdEngineConcurrencyLabel(value) {
    const multiplier = getPsdEngineWorkerMultiplier(value);
    return multiplier > 0
      ? `\u6837\u673a\u6570\u5e76\u53d1\u00d7${multiplier}`
      : '\u5355\u7ebf\u7a0b\u987a\u5e8f\u6267\u884c';
  }

  function getEstimatedPsdEngineCount(mockupCount, value) {
    const multiplier = getPsdEngineWorkerMultiplier(value);
    return multiplier > 0 ? Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, mockupCount * multiplier)) : 1;
  }

  function isPsdSliceExportMode(value) {
    return ['guides', 'slices'].includes(normalizePsdExportMode(value));
  }

  function createDefaultPsdMockup(index = 0) {
    return {
      id: createEntityId('psd_mockup'),
      psdPath: '',
      smartObjectName: '\u63d2\u56fe#',
      sourceRotation: 'none',
      replacementMode: 'cover-canvas',
      outputSubdirName: `PSD\u5957\u56fe${index > 0 ? index + 1 : ''}`,
      outputDirectoryPath: normalizeText(state.psdOutputDirectoryPath),
      exportMode: normalizePsdExportMode(state.psdExportMode),
      outputFormat: normalizePsdOutputFormat(state.psdOutputFormat),
      imageQuality: normalizePsdImageQuality(state.psdImageQuality)
    };
  }

  function normalizePsdMockup(value, index = 0, defaults = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const defaultSource = defaults && typeof defaults === 'object' ? defaults : {};
    const fallback = createDefaultPsdMockup(index);
    const hasOutputDirectoryPath = Object.prototype.hasOwnProperty.call(source, 'outputDirectoryPath');
    const hasExportMode = Object.prototype.hasOwnProperty.call(source, 'exportMode') || Object.prototype.hasOwnProperty.call(source, 'sliceMode');
    const hasOutputFormat = Object.prototype.hasOwnProperty.call(source, 'outputFormat');
    const hasImageQuality = Object.prototype.hasOwnProperty.call(source, 'imageQuality');

    return {
      id: normalizeText(source.id) || fallback.id,
      psdPath: normalizeText(source.psdPath),
      smartObjectName: normalizeText(source.smartObjectName) || fallback.smartObjectName,
      sourceRotation: normalizePsdSourceRotation(source.sourceRotation),
      replacementMode: normalizePsdReplacementMode(source.replacementMode),
      outputSubdirName: normalizeText(source.outputSubdirName) || fallback.outputSubdirName,
      outputDirectoryPath: hasOutputDirectoryPath
        ? normalizeText(source.outputDirectoryPath)
        : normalizeText(defaultSource.outputDirectoryPath) || fallback.outputDirectoryPath,
      exportMode: hasExportMode
        ? normalizePsdExportMode(source.exportMode || source.sliceMode)
        : normalizePsdExportMode(defaultSource.exportMode || defaultSource.sliceMode || fallback.exportMode),
      outputFormat: hasOutputFormat
        ? normalizePsdOutputFormat(source.outputFormat)
        : normalizePsdOutputFormat(defaultSource.outputFormat || fallback.outputFormat),
      imageQuality: hasImageQuality
        ? normalizePsdImageQuality(source.imageQuality)
        : normalizePsdImageQuality(defaultSource.imageQuality || fallback.imageQuality)
    };
  }

  function getPsdLegacyExportDefaults() {
    const firstMockup = Array.isArray(state.psdMockups) && state.psdMockups.length
      ? normalizePsdMockup(state.psdMockups[0], 0)
      : createDefaultPsdMockup(0);

    return {
      outputDirectoryPath: normalizeText(firstMockup.outputDirectoryPath),
      exportMode: normalizePsdExportMode(firstMockup.exportMode),
      outputFormat: normalizePsdOutputFormat(firstMockup.outputFormat),
      imageQuality: normalizePsdImageQuality(firstMockup.imageQuality)
    };
  }

  function ensurePsdMockups() {
    if (!Array.isArray(state.psdMockups) || !state.psdMockups.length) {
      state.psdMockups = [createDefaultPsdMockup(0)];
    }
  }

  function getRunnablePsdMockups() {
    ensurePsdMockups();

    return state.psdMockups
      .map((mockup, index) => normalizePsdMockup(mockup, index))
      .filter((mockup) => {
        return normalizeText(mockup.psdPath)
          && normalizeText(mockup.smartObjectName)
          && normalizeText(mockup.outputSubdirName)
          && normalizeText(mockup.outputDirectoryPath);
      });
  }

  function getPsdMockupById(mockupId) {
    ensurePsdMockups();
    return state.psdMockups.find((mockup) => mockup.id === mockupId) || null;
  }

  function updatePsdMockup(mockupId, patch, options = {}) {
    ensurePsdMockups();
    if (patch && typeof patch === 'object') {
      if (Object.prototype.hasOwnProperty.call(patch, 'outputDirectoryPath')) {
        state.psdOutputDirectoryPath = normalizeText(patch.outputDirectoryPath);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'exportMode')) {
        state.psdExportMode = normalizePsdExportMode(patch.exportMode);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'outputFormat')) {
        state.psdOutputFormat = normalizePsdOutputFormat(patch.outputFormat);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'imageQuality')) {
        state.psdImageQuality = normalizePsdImageQuality(patch.imageQuality);
      }
    }
    state.psdMockups = state.psdMockups.map((mockup, index) => {
      if (mockup.id !== mockupId) {
        return normalizePsdMockup(mockup, index);
      }

      return normalizePsdMockup({
        ...mockup,
        ...(patch && typeof patch === 'object' ? patch : {})
      }, index);
    });
    cacheCurrentPsdSettings();
    if (options.render !== false) {
      updatePsdSmartObjectState();
    } else {
      updateButtons();
    }
  }

  function getPsdTemplatePayload() {
    ensurePsdMockups();
    const legacyExportDefaults = getPsdLegacyExportDefaults();

    return {
      id: normalizeText(state.psdSelectedTemplateId),
      name: '',
      imageDirectoryPath: state.psdImageDirectoryPath,
      outputDirectoryPath: legacyExportDefaults.outputDirectoryPath,
      exportMode: legacyExportDefaults.exportMode,
      outputFormat: legacyExportDefaults.outputFormat,
      imageQuality: legacyExportDefaults.imageQuality,
      engineConcurrency: state.psdEngineConcurrency,
      skipExistingOutputs: state.psdSkipExistingOutputs,
      metadataSourcePath: state.psdMetadataSourcePath,
      metadataSourceDirectoryPath: state.psdMetadataSourceDirectoryPath,
      mockups: state.psdMockups.map((mockup, index) => normalizePsdMockup(mockup, index))
    };
  }

  function readCachedSettings() {
    try {
      const rawText = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = rawText ? JSON.parse(rawText) : null;

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeCachedSettings(patch) {
    try {
      const currentSettings = readCachedSettings();
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...currentSettings,
        ...(patch && typeof patch === 'object' ? patch : {})
      }));
    } catch (_error) {
      // Ignore local cache failures.
    }
  }

  function restoreCachedSettings() {
    const settings = readCachedSettings();
    const cachedPsdExportMode = normalizeText(settings.psdExportMode || settings.psdSliceMode);
    const cachedPsdOutputFormat = normalizeText(settings.psdOutputFormat);
    const cachedPsdImageQuality = normalizePsdImageQuality(settings.psdImageQuality);
    const psdMockupDefaults = {
      outputDirectoryPath: normalizeText(settings.psdOutputDirectoryPath),
      exportMode: ['original', 'guides', 'slices'].includes(cachedPsdExportMode) ? cachedPsdExportMode : state.psdExportMode,
      outputFormat: ['png', 'jpg', 'webp'].includes(cachedPsdOutputFormat) ? cachedPsdOutputFormat : state.psdOutputFormat,
      imageQuality: cachedPsdImageQuality
    };
    const pathFields = [
      'whiteMockupPath',
      'imageDirectoryPath',
      'outputDirectoryPath',
      'previewDesignPath',
      'psdImageDirectoryPath',
      'psdOutputDirectoryPath',
      'psdMetadataSourcePath',
      'psdMetadataSourceDirectoryPath'
    ];

    pathFields.forEach((fieldName) => {
      const value = normalizeText(settings[fieldName]);

      if (value) {
        state[fieldName] = value;
      }
    });

    if (Array.isArray(settings.psdMockups) && settings.psdMockups.length) {
      state.psdMockups = settings.psdMockups.map((mockup, index) => normalizePsdMockup(mockup, index, psdMockupDefaults));
    } else {
      state.psdMockups = [normalizePsdMockup({
        psdPath: normalizeText(settings.psdMockupPath),
        smartObjectName: normalizeText(settings.psdSmartObjectName),
        replacementMode: normalizeText(settings.psdReplacementMode),
        outputSubdirName: normalizeText(settings.psdOutputSubdirName),
        outputDirectoryPath: psdMockupDefaults.outputDirectoryPath,
        exportMode: psdMockupDefaults.exportMode,
        outputFormat: psdMockupDefaults.outputFormat,
        imageQuality: psdMockupDefaults.imageQuality
      }, 0, psdMockupDefaults)];
    }
    if (['original', 'guides', 'slices'].includes(cachedPsdExportMode)) {
      state.psdExportMode = cachedPsdExportMode;
    }
    if (['png', 'jpg', 'webp'].includes(cachedPsdOutputFormat)) {
      state.psdOutputFormat = cachedPsdOutputFormat;
    }
    state.psdImageQuality = cachedPsdImageQuality;
    state.psdSelectedTemplateId = normalizeText(settings.psdSelectedTemplateId);
    state.psdTemplateName = normalizeText(settings.psdTemplateName);
    state.psdEngineWindowMode = normalizePsdEngineWindowMode(settings.psdEngineWindowMode);
    state.psdEngineConcurrency = normalizePsdEngineConcurrency(settings.psdEngineConcurrency);
    state.psdSkipExistingOutputs = Object.prototype.hasOwnProperty.call(settings, 'psdSkipExistingOutputs')
      ? settings.psdSkipExistingOutputs === true
      : true;
    if (normalizeText(settings.outputFormat) && elements.outputFormat) {
      elements.outputFormat.value = normalizeText(settings.outputFormat);
    }
    if (normalizeText(settings.jpegQuality) && elements.jpegQuality) {
      elements.jpegQuality.value = normalizeText(settings.jpegQuality);
    }
    ensurePsdMockups();
  }

  function cacheCurrentWhiteMockupSettings() {
    writeCachedSettings({
      whiteMockupPath: state.whiteMockupPath,
      imageDirectoryPath: state.imageDirectoryPath,
      outputDirectoryPath: state.outputDirectoryPath,
      previewDesignPath: state.previewDesignPath,
      outputFormat: elements.outputFormat ? elements.outputFormat.value : '',
      jpegQuality: elements.jpegQuality ? elements.jpegQuality.value : ''
    });
  }

  function cacheCurrentPsdSettings() {
    ensurePsdMockups();
    const legacyExportDefaults = getPsdLegacyExportDefaults();
    writeCachedSettings({
      psdMockups: state.psdMockups.map((mockup, index) => normalizePsdMockup(mockup, index)),
      psdImageDirectoryPath: state.psdImageDirectoryPath,
      psdOutputDirectoryPath: legacyExportDefaults.outputDirectoryPath,
      psdExportMode: legacyExportDefaults.exportMode,
      psdOutputFormat: legacyExportDefaults.outputFormat,
      psdImageQuality: legacyExportDefaults.imageQuality,
      psdMetadataSourcePath: state.psdMetadataSourcePath,
      psdMetadataSourceDirectoryPath: state.psdMetadataSourceDirectoryPath,
      psdSelectedTemplateId: state.psdSelectedTemplateId,
      psdTemplateName: state.psdTemplateName,
      psdEngineWindowMode: state.psdEngineWindowMode,
      psdEngineConcurrency: state.psdEngineConcurrency,
      psdSkipExistingOutputs: state.psdSkipExistingOutputs,
      psdSliceCount: undefined,
      psdSlicePositions: undefined
    });
  }

  async function refreshCachedImageDirectoryFiles(fieldName, targetFieldName) {
    const directoryPath = normalizeText(state[fieldName]);

    if (!directoryPath) {
      state[targetFieldName] = [];
      return;
    }

    try {
      const result = await getBridge().collectImageFiles({
        directoryPath
      });

      state[targetFieldName] = result && result.success === true && Array.isArray(result.files)
        ? result.files
        : [];
    } catch (_error) {
      state[targetFieldName] = [];
    }
  }

  async function restoreCachedRuntimeState() {
    restoreCachedSettings();
    await Promise.all([
      refreshCachedImageDirectoryFiles('imageDirectoryPath', 'imageFiles'),
      refreshCachedImageDirectoryFiles('psdImageDirectoryPath', 'psdImageFiles'),
      refreshCachedImageDirectoryFiles('psdMetadataSourceDirectoryPath', 'psdMetadataSourceFiles')
    ]);

    if (!state.previewDesignPath && state.imageFiles.length && state.imageFiles[0].filePath) {
      state.previewDesignPath = state.imageFiles[0].filePath;
      cacheCurrentWhiteMockupSettings();
    }

    if (state.whiteMockupPath) {
      await loadWhiteMockupTemplate();
    }
  }

  function syncWhiteMockupOutputSettings() {
    cacheCurrentWhiteMockupSettings();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getBridge() {
    if (window.temuApp && window.temuApp.podSuiteTool) {
      return window.temuApp.podSuiteTool;
    }

    throw new Error('\u5957\u56fe\u5de5\u5177\u901a\u4fe1\u521d\u59cb\u5316\u5931\u8d25\u3002');
  }

  function selectImagePathWithFileInput() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      let settled = false;
      input.type = 'file';
      input.accept = 'image/*,.jpg,.jpeg,.png,.webp,.tif,.tiff,.heic,.heif';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '-9999px';

      const cleanup = () => {
        input.removeEventListener('change', handleChange);
        window.removeEventListener('focus', handleFocus);
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };
      const finish = (filePath) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(normalizeText(filePath));
      };
      const handleChange = () => {
        const file = input.files && input.files[0] ? input.files[0] : null;
        const filePath = file && window.temuApp && window.temuApp.files && typeof window.temuApp.files.getPathForFile === 'function'
          ? normalizeText(window.temuApp.files.getPathForFile(file))
          : '';

        finish(filePath);
      };
      const handleFocus = () => {
        setTimeout(() => {
          if (!settled && (!input.files || !input.files.length)) {
            finish('');
          }
        }, 250);
      };

      input.addEventListener('change', handleChange);
      window.addEventListener('focus', handleFocus);
      document.body.appendChild(input);
      input.click();
    });
  }

  function setPsdMetadataSourcePath(filePath) {
    state.psdMetadataSourcePath = normalizeText(filePath);
    state.psdMetadataSourceDirectoryPath = '';
    state.psdMetadataSourceFiles = [];
    if (elements.psdMetadataSourcePathInput) {
      elements.psdMetadataSourcePathInput.value = state.psdMetadataSourcePath;
    }
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
  }

  function setPsdMetadataSourceDirectoryPath(directoryPath, files) {
    state.psdMetadataSourceDirectoryPath = normalizeText(directoryPath);
    state.psdMetadataSourcePath = '';
    state.psdMetadataSourceFiles = Array.isArray(files) ? files : [];
    if (elements.psdMetadataSourcePathInput) {
      elements.psdMetadataSourcePathInput.value = state.psdMetadataSourceDirectoryPath;
    }
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
  }

  function makeFileUrl(filePath) {
    const normalizedPath = normalizeText(filePath).replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalizedPath) {
      return '';
    }

    const encodedPath = normalizedPath
      .split('/')
      .map((segment, index) => (index === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)))
      .join('/');

    return `file:///${encodedPath}`;
  }

  function getBaseName(filePath) {
    const normalizedPath = normalizeText(filePath).replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);

    return parts.length ? parts[parts.length - 1] : '';
  }

  function getWhiteMockupPreviewImageSrc() {
    return state.whiteMockupPreviewDataUrl || makeFileUrl(state.whiteMockupPath);
  }

  function markWhiteMockupPreviewStale() {
    if (!state.whiteMockupPreviewDataUrl) {
      return;
    }

    state.whiteMockupPreviewStale = true;
  }

  function clearWhiteMockupPreviewData() {
    state.whiteMockupPreviewDataUrl = '';
    state.whiteMockupPreviewStale = false;
  }

  function getWhiteMockupTemplateSize() {
    const naturalSize = state.whiteMockupImageNaturalSize || {};
    const width = Number(naturalSize.width);
    const height = Number(naturalSize.height);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return {
        width: Math.round(width),
        height: Math.round(height)
      };
    }

    return {
      ...DEFAULT_WHITE_MOCKUP_TEMPLATE_SIZE
    };
  }

  function normalizeWhiteMockupTemplate(template) {
    if (typeof templateRegions.normalizeTemplate === 'function') {
      return templateRegions.normalizeTemplate(template, getWhiteMockupTemplateSize());
    }

    return clonePlain(template || DEFAULT_WHITE_MOCKUP_TEMPLATE);
  }

  function scaleWhiteMockupTemplate(template, fromSize, toSize) {
    if (typeof templateRegions.scaleTemplate === 'function') {
      return templateRegions.scaleTemplate(template, fromSize, toSize);
    }

    return normalizeWhiteMockupTemplate(template);
  }

  function createDefaultWhiteMockupTemplate() {
    if (typeof templateRegions.createDefaultTemplate === 'function') {
      return templateRegions.createDefaultTemplate(getWhiteMockupTemplateSize());
    }

    return scaleWhiteMockupTemplate(
      clonePlain(DEFAULT_WHITE_MOCKUP_TEMPLATE),
      DEFAULT_WHITE_MOCKUP_TEMPLATE_SIZE,
      getWhiteMockupTemplateSize()
    );
  }

  function setWhiteMockupTemplate(template, options = {}) {
    const nextTemplate = template || createDefaultWhiteMockupTemplate();
    state.whiteMockupTemplate = options.raw ? clonePlain(nextTemplate) : normalizeWhiteMockupTemplate(nextTemplate);
    const regions = Array.isArray(state.whiteMockupTemplate.regions) ? state.whiteMockupTemplate.regions : [];
    state.whiteMockupActiveRegionIndex = clamp(
      Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );
    state.whiteMockupTemplateDirty = Boolean(options.dirty);
    state.whiteMockupTemplateIsDefault = Boolean(options.isDefault);
    if (state.whiteMockupTemplateDirty) {
      markWhiteMockupPreviewStale();
    }
  }

  function getWhiteMockupRegions() {
    const template = normalizeWhiteMockupTemplate(state.whiteMockupTemplate || createDefaultWhiteMockupTemplate());
    return Array.isArray(template.regions) && template.regions.length
      ? template.regions
      : createDefaultWhiteMockupTemplate().regions;
  }

  function getWhiteMockupRegion() {
    const regions = getWhiteMockupRegions();
    const regionIndex = clamp(
      Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );

    return regions[regionIndex] || regions[0] || DEFAULT_WHITE_MOCKUP_TEMPLATE.regions[0];
  }

  function getWhiteMockupTemplatePayload() {
    return normalizeWhiteMockupTemplate(state.whiteMockupTemplate || createDefaultWhiteMockupTemplate());
  }

  function getWhiteMockupMaskImagePath() {
    const template = getWhiteMockupTemplatePayload();
    return normalizeText(template.maskImagePath);
  }

  function getWhiteMockupTextureImagePath() {
    const template = getWhiteMockupTemplatePayload();
    return normalizeText(template.textureImagePath);
  }

  function isWhiteMockupMaskShapeRegion(region) {
    if (typeof templateRegions.isMaskShapeRegion === 'function') {
      return templateRegions.isMaskShapeRegion(region);
    }

    return normalizeText(region && (region.type || region.mode)) === MASK_SHAPE_REGION_TYPE;
  }

  function getWhiteMockupAssetStateSuffix() {
    const parts = [];

    if (getWhiteMockupMaskImagePath()) {
      parts.push('\u5df2\u9009\u8499\u7248');
    }
    if (getWhiteMockupTextureImagePath()) {
      parts.push('\u5df2\u9009\u7eb9\u7406\u56fe');
    }

    return parts.length ? `\uff0c${parts.join('\uff0c')}` : '';
  }

  function updateWhiteMockupTemplatePatch(patch, options = {}) {
    const template = getWhiteMockupTemplatePayload();
    setWhiteMockupTemplate({
      ...template,
      ...(patch && typeof patch === 'object' ? patch : {})
    }, {
      dirty: options.dirty !== false,
      isDefault: false
    });
    updateInputs();
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function setActiveMode(mode) {
    const nextMode = mode === 'psd-smart-object' ? mode : 'white-mockup';
    state.activeMode = nextMode;

    if (Array.isArray(elements.modeTabs)) {
      elements.modeTabs.forEach((button) => {
        const active = button.dataset.podSuiteMode === nextMode;
        button.classList.toggle('is-active', active);
      });
    }

    if (Array.isArray(elements.modePages)) {
      elements.modePages.forEach((page) => {
        const active = page.dataset.podSuitePage === nextMode;
        page.classList.toggle('is-active', active);
        page.hidden = !active;
      });
    }

    setStatus(MODE_STATUS_TEXT[nextMode] || '');
    if (nextMode === 'white-mockup') {
      updateInputs();
    }
  }

  function handleModeTabClick(event) {
    const button = event.target.closest('[data-pod-suite-mode]');
    if (!button) {
      return;
    }

    setActiveMode(button.dataset.podSuiteMode);
  }

  function addLog(message, tone) {
    const row = document.createElement('div');
    row.className = `pod-suite-log-row${tone ? ` is-${tone}` : ''}`;
    row.textContent = message;
    elements.log.prepend(row);
    while (elements.log.children.length > 30) {
      elements.log.removeChild(elements.log.lastElementChild);
    }
  }

  function addPsdLog(message, tone) {
    const target = elements.psdLog || elements.log;
    const row = document.createElement('div');
    row.className = `pod-suite-log-row${tone ? ` is-${tone}` : ''}`;
    row.textContent = message;
    target.prepend(row);
    while (target.children.length > 30) {
      target.removeChild(target.lastElementChild);
    }
  }

  function getPsdProgressPhaseText(phase) {
    return PSD_PROGRESS_PHASE_LABELS[normalizeText(phase)] || normalizeText(phase) || 'PSD\u5957\u56fe\u4e2d';
  }

  function getPsdProgressElapsedSeconds(progress) {
    const sourceStartedAt = Number(progress && progress.startedAt) || state.psdProgressStartedAt || 0;
    return sourceStartedAt
      ? Math.max(0, Math.round((Date.now() - sourceStartedAt) / 1000))
      : 0;
  }

  function createPsdProgressSummary(progress) {
    const source = progress && typeof progress === 'object' ? progress : {};
    const totalInputCount = Number(source.totalInputCount || source.sourceCount) || 0;

    return {
      mockupCount: Number(source.mockupCount) || 0,
      totalInputCount,
      totalWorkCount: (Number(source.mockupCount) || 0) * totalInputCount,
      completedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      generatedCount: 0,
      sliceGeneratedCount: 0,
      itemProgressKeys: new Set()
    };
  }

  function updatePsdProgressSummary(progress) {
    const source = progress && typeof progress === 'object' ? progress : {};
    const phase = normalizeText(source.phase);
    if (!state.psdProgressSummary || phase === 'start' || phase === 'sources-ready') {
      state.psdProgressSummary = createPsdProgressSummary(source);
    }

    const summary = state.psdProgressSummary || createPsdProgressSummary(source);
    if (Number(source.mockupCount) > 0) {
      summary.mockupCount = Number(source.mockupCount) || summary.mockupCount;
    }
    if (Number(source.totalInputCount || source.sourceCount) > 0) {
      summary.totalInputCount = Number(source.totalInputCount || source.sourceCount) || summary.totalInputCount;
    }
    if (summary.mockupCount && summary.totalInputCount) {
      summary.totalWorkCount = summary.mockupCount * summary.totalInputCount;
    }

    if (!(summary.itemProgressKeys instanceof Set)) {
      summary.itemProgressKeys = new Set();
    }

    if (phase === 'item-done' || phase === 'item-skipped' || phase === 'item-failed') {
      const progressKey = [
        phase,
        normalizeText(source.mockupIndex),
        normalizeText(source.workerIndex),
        normalizeText(source.sourceIndex),
        normalizeText(source.sourcePath),
        normalizeText(source.message)
      ].join('|');
      if (summary.itemProgressKeys.has(progressKey)) {
        return summary;
      }
      summary.itemProgressKeys.add(progressKey);
      summary.completedCount += 1;
    }
    if (phase === 'item-skipped') {
      summary.skippedCount += 1;
    }
    if (phase === 'item-failed') {
      summary.failedCount += 1;
    }
    if (phase === 'complete') {
      summary.generatedCount = Number(source.generatedCount) || 0;
      summary.sliceGeneratedCount = Number(source.sliceGeneratedCount) || 0;
      summary.skippedCount = Number(source.skippedCount) || summary.skippedCount;
      summary.failedCount = Number(source.failedCount) || summary.failedCount;
      summary.completedCount = summary.totalWorkCount || summary.completedCount;
    }

    return summary;
  }

  function formatPsdSummaryStatus(progress) {
    const source = progress && typeof progress === 'object' ? progress : {};
    const summary = updatePsdProgressSummary(source);
    const phase = normalizeText(source.phase);
    const elapsedSeconds = getPsdProgressElapsedSeconds(source);
    const pieces = ['PSD\u5957\u56fe\u4e2d'];
    const totalWorkCount = Number(summary.totalWorkCount) || 0;
    const completedCount = totalWorkCount
      ? Math.min(totalWorkCount, Number(summary.completedCount) || 0)
      : Number(summary.completedCount) || 0;

    if (totalWorkCount) {
      pieces.push(`\u603b\u8fdb\u5ea6 ${completedCount}/${totalWorkCount}`);
    }
    if (summary.mockupCount) {
      pieces.push(`\u6837\u673a ${summary.mockupCount} \u4e2a`);
    }
    if (summary.totalInputCount) {
      pieces.push(`\u7d20\u6750 ${summary.totalInputCount} \u5f20`);
    }
    if (summary.skippedCount || summary.failedCount) {
      pieces.push(`\u8df3\u8fc7 ${summary.skippedCount || 0}\uff0c\u5931\u8d25 ${summary.failedCount || 0}`);
    }
    if (phase === 'complete') {
      pieces[0] = 'PSD\u5957\u56fe\u5b8c\u6210';
      pieces.push(`\u6574\u56fe ${summary.generatedCount || 0}\uff0c\u5207\u7247 ${summary.sliceGeneratedCount || 0}`);
    }
    if (elapsedSeconds) {
      pieces.push(`\u7528\u65f6 ${elapsedSeconds} \u79d2`);
    }

    return pieces.join(' \u00b7 ');
  }

  function formatPsdProgressStatus(progress) {
    const source = progress && typeof progress === 'object' ? progress : {};
    const pieces = ['PSD\u5957\u56fe\u4e2d'];
    const mockupIndex = Number(source.mockupIndex) || 0;
    const mockupCount = Number(source.mockupCount) || 0;
    const sourceIndex = Number(source.sourceIndex) || 0;
    const sourceCount = Number(source.sourceCount || source.totalInputCount) || 0;
    const workerIndex = Number(source.workerIndex) || 0;
    const workerCount = Number(source.workerCount) || 0;
    const elapsedSeconds = getPsdProgressElapsedSeconds(source);

    if (mockupIndex && mockupCount) {
      pieces.push(`\u6837\u673a ${mockupIndex}/${mockupCount}${source.mockupName ? ` ${source.mockupName}` : ''}`);
    } else if (mockupCount) {
      pieces.push(`\u6837\u673a ${mockupCount} \u4e2a`);
    }
    if (workerIndex && workerCount > 1) {
      pieces.push(`\u5206\u7247 ${workerIndex}/${workerCount}`);
    }
    if (sourceIndex && sourceCount) {
      pieces.push(`\u7d20\u6750 ${sourceIndex}/${sourceCount}${source.sourceName ? ` ${source.sourceName}` : ''}`);
    } else if (sourceCount) {
      pieces.push(`\u7d20\u6750 ${sourceCount} \u5f20`);
    }
    pieces.push(getPsdProgressPhaseText(source.phase));
    if (elapsedSeconds) {
      pieces.push(`\u5df2\u7b49\u5f85 ${elapsedSeconds} \u79d2`);
    }

    return pieces.join(' \u00b7 ');
  }

  function shouldLogPsdProgress(progress) {
    const phase = normalizeText(progress && progress.phase);
    return [
      'start',
      'collect-sources',
      'sources-ready',
      'mockup-start',
      'mockup-prepare',
      'mockup-local-parse',
      'mockup-loading',
      'mockup-retry',
      'mockup-ready',
      'item-start',
      'smart-open',
      'replace',
      'export',
      'post-process-wait',
      'post-process',
      'slice',
      'write-output',
      'post-process-drain',
      'item-done',
      'item-skipped',
      'item-retry',
      'mockup-done',
      'mockup-failed',
      'item-failed',
      'complete'
    ].includes(phase);
  }

  function getPsdProgressLogMessage(progress) {
    const source = progress && typeof progress === 'object' ? progress : {};
    const phase = normalizeText(source.phase);
    const phaseText = getPsdProgressPhaseText(phase);
    const mockupIndex = Number(source.mockupIndex) || 0;
    const mockupCount = Number(source.mockupCount) || 0;
    const sourceIndex = Number(source.sourceIndex) || 0;
    const sourceCount = Number(source.sourceCount || source.totalInputCount) || 0;
    const prefix = mockupIndex && mockupCount
      ? `\u6837\u673a ${mockupIndex}/${mockupCount}${source.mockupName ? ` ${source.mockupName}` : ''}`
      : '';
    const sourceText = sourceIndex && sourceCount
      ? `\u7d20\u6750 ${sourceIndex}/${sourceCount}${source.sourceName ? ` ${source.sourceName}` : ''}`
      : '';
    const workerText = Number(source.workerIndex) && Number(source.workerCount) > 1
      ? `\u5206\u7247 ${Number(source.workerIndex)}/${Number(source.workerCount)}`
      : '';

    if (phase === 'complete') {
      const generatedCount = Number(source.generatedCount) || 0;
      const sliceGeneratedCount = Number(source.sliceGeneratedCount) || 0;
      const skippedCount = Number(source.skippedCount) || 0;
      const failedCount = Number(source.failedCount) || 0;
      return `PSD\u8fdb\u5ea6\uff1a\u4efb\u52a1\u5b8c\u6210\uff0c\u6574\u56fe ${generatedCount} \u5f20\uff0c\u5207\u7247 ${sliceGeneratedCount} \u5f20\uff0c\u8df3\u8fc7 ${skippedCount} \u5f20\uff0c\u5931\u8d25 ${failedCount} \u5f20\u3002`;
    }
    if (phase === 'item-skipped') {
      return `PSD\u8fdb\u5ea6\uff1a${[prefix, workerText, sourceText, phaseText].filter(Boolean).join(' \u00b7 ')}${source.message ? `\uff1a${source.message}` : ''}`;
    }
    if (phase === 'mockup-retry') {
      return `PSD\u8fdb\u5ea6\uff1a${[prefix, workerText, phaseText].filter(Boolean).join(' \u00b7 ')}${source.message ? `\uff1a${source.message}` : ''}`;
    }
    if (phase === 'item-retry') {
      const itemRetryAttempt = Number(source.itemRetryAttempt) || 0;
      const maxItemRetryAttempts = Number(source.maxItemRetryAttempts) || 0;
      const retryText = itemRetryAttempt && maxItemRetryAttempts
        ? `${phaseText} ${itemRetryAttempt}/${maxItemRetryAttempts}`
        : phaseText;
      return `PSD\u8fdb\u5ea6\uff1a${[prefix, workerText, sourceText, retryText].filter(Boolean).join(' \u00b7 ')}${source.message ? `\uff1a${source.message}` : ''}`;
    }
    if (phase === 'item-failed' || phase === 'mockup-failed') {
      return `PSD\u8fdb\u5ea6\uff1a${[prefix, workerText, sourceText, phaseText].filter(Boolean).join(' \u00b7 ')}${source.message ? `\uff1a${source.message}` : ''}`;
    }

    return `PSD\u8fdb\u5ea6\uff1a${[prefix, workerText, sourceText, phaseText].filter(Boolean).join(' \u00b7 ') || phaseText}`;
  }

  function handlePsdSmartObjectProgress(progress) {
    if (!progress || progress.runId !== WINDOW_RUN_ID) {
      return;
    }

    state.psdLastProgress = progress;
    setStatus(formatPsdSummaryStatus(progress));

    if (!shouldLogPsdProgress(progress)) {
      return;
    }

    const logMessage = getPsdProgressLogMessage(progress);
    const logKey = [
      normalizeText(progress.phase),
      normalizeText(progress.mockupIndex),
      normalizeText(progress.workerIndex),
      normalizeText(progress.sourceIndex),
      normalizeText(progress.message),
      normalizeText(progress.itemRetryAttempt),
      normalizeText(progress.maxItemRetryAttempts),
      normalizeText(progress.generatedCount),
      normalizeText(progress.sliceGeneratedCount),
      normalizeText(progress.skippedCount),
      normalizeText(progress.failedCount)
    ].join('|');

    if (logMessage && state.psdLastProgressLogKey !== logKey) {
      state.psdLastProgressLogKey = logKey;
      const tone = ['complete', 'mockup-done', 'item-done', 'item-skipped'].includes(normalizeText(progress.phase))
        ? 'success'
        : ['item-failed', 'mockup-failed'].includes(normalizeText(progress.phase))
          ? 'error'
          : '';
      addPsdLog(logMessage, tone);
    }
  }

  function renderPsdTemplateOptions() {
    if (!elements.psdTemplateSelect) {
      return;
    }

    const templates = Array.isArray(state.psdTemplates) ? state.psdTemplates : [];
    if (templates.length && state.psdSelectedTemplateId && !templates.some((template) => template.id === state.psdSelectedTemplateId)) {
      state.psdSelectedTemplateId = '';
    }

    const options = [`<option value=""${state.psdSelectedTemplateId ? '' : ' selected'}>\u65b0\u5efa\u6a21\u677f</option>`];
    templates.forEach((template) => {
      const selected = template.id === state.psdSelectedTemplateId ? ' selected' : '';
      options.push(`<option value="${escapeHtml(template.id)}"${selected}>${escapeHtml(template.name || '\u672a\u547d\u540d\u6a21\u677f')}</option>`);
    });
    elements.psdTemplateSelect.innerHTML = options.join('');
  }

  function renderPsdMockupCards() {
    if (!elements.psdMockupList) {
      return;
    }

    ensurePsdMockups();
    elements.psdMockupList.innerHTML = state.psdMockups.map((mockup, index) => {
      const normalizedMockup = normalizePsdMockup(mockup, index);
      const canRemove = state.psdMockups.length > 1;
      const disabled = state.busy ? ' disabled' : '';
      const openDisabled = normalizedMockup.outputDirectoryPath ? '' : ' disabled';

      return `
        <section class="pod-suite-psd-mockup-card" data-psd-mockup-id="${escapeHtml(normalizedMockup.id)}">
          <div class="pod-suite-psd-mockup-card-head">
            <strong>PSD\u6837\u673a ${index + 1}</strong>
            <div class="pod-suite-psd-mockup-actions">
              <button class="pod-suite-secondary-button" type="button" data-psd-action="add"${disabled}>
                \u6dfb\u52a0\u6837\u673a
              </button>
              <button class="pod-suite-secondary-button" type="button" data-psd-action="remove" ${canRemove ? disabled : 'disabled'}>
                \u5220\u9664
              </button>
            </div>
          </div>
          <div class="pod-suite-psd-mockup-fields">
            <label class="pod-suite-field">
              <span class="pod-suite-field-label">
                PSD\u9009\u62e9
                <span class="pod-suite-help" title="\u9009\u62e9\u5305\u542b\u667a\u80fd\u5bf9\u8c61\u7684 PSD \u6837\u673a\u6587\u4ef6\u3002">?</span>
              </span>
              <div class="pod-suite-picker-row">
                <input type="text" readonly data-psd-field="psdPath" value="${escapeHtml(normalizedMockup.psdPath)}" />
                <button class="pod-suite-secondary-button" type="button" data-psd-action="select"${disabled}>
                  \u9009\u62e9
                </button>
              </div>
            </label>
            <label class="pod-suite-field">
              <span class="pod-suite-field-label">
                \u667a\u80fd\u5bf9\u8c61\u540d\u79f0
                <span class="pod-suite-help" title="\u9700\u8981\u66ff\u6362\u7684\u667a\u80fd\u5bf9\u8c61\u56fe\u5c42\u540d\uff0c\u4F8B\u5982\uff1A\u63d2\u56fe#\u3002">?</span>
              </span>
              <input type="text" data-psd-field="smartObjectName" value="${escapeHtml(normalizedMockup.smartObjectName)}"${disabled} />
            </label>
            <label class="pod-suite-field">
              <span class="pod-suite-field-label">
                \u7d20\u6750\u65cb\u8f6c
                <span class="pod-suite-help" title="\u5148\u628a\u7d20\u6750\u56fe\u7247\u5411\u5de6\u6216\u5411\u53f3\u65cb\u8f6c90\u00b0\uff0c\u518d\u6309\u4e0b\u65b9\u7684\u7d20\u6750\u653e\u7f6e\u65b9\u5f0f\u8fdb\u884c\u5957\u56fe\u3002">?</span>
              </span>
              <select data-psd-field="sourceRotation" title="\u65cb\u8f6c\u4f1a\u5728\u7d20\u6750\u653e\u7f6e\u65b9\u5f0f\u4e4b\u524d\u751f\u6548\u3002"${disabled}>
                <option value="none"${normalizedMockup.sourceRotation === 'none' ? ' selected' : ''}>${PSD_SOURCE_ROTATION_LABELS.none}</option>
                <option value="left"${normalizedMockup.sourceRotation === 'left' ? ' selected' : ''}>${PSD_SOURCE_ROTATION_LABELS.left}</option>
                <option value="right"${normalizedMockup.sourceRotation === 'right' ? ' selected' : ''}>${PSD_SOURCE_ROTATION_LABELS.right}</option>
              </select>
            </label>
            <label class="pod-suite-field">
              <span class="pod-suite-field-label">
                \u7d20\u6750\u653e\u7f6e\u65b9\u5f0f
                <span class="pod-suite-help" title="\u94fa\u6ee1\u753b\u5e03(\u7b49\u6bd4\u88c1\u8fb9)\uff1a\u4fdd\u6301\u6bd4\u4f8b\u94fa\u6ee1\u667a\u80fd\u5bf9\u8c61\u753b\u5e03\uff0c\u8d85\u51fa\u7684\u8fb9\u4f1a\u88ab\u88c1\u6389\u3002\u5339\u914d\u753b\u5e03\u5c3a\u5bf8\uff1a\u5148\u628a\u7d20\u6750\u91cd\u91c7\u6837\u5230\u667a\u80fd\u5bf9\u8c61\u539f\u753b\u5e03\u5bbd\u9ad8\uff0c\u9002\u5408\u6bd4\u4f8b\u4e00\u81f4\u7684\u6a21\u677f\u3002\u6309\u539f\u56fe\u5c42\u8fb9\u754c(\u62c9\u4f38)\uff1a\u6309\u667a\u80fd\u5bf9\u8c61\u5185\u539f\u53ef\u89c1\u56fe\u5c42\u8fb9\u754c\u62c9\u4f38\u7d20\u6750\u3002">?</span>
              </span>
              <select data-psd-field="replacementMode" title="\u94fa\u6ee1\u9002\u5408\u9700\u8981\u88c1\u8fb9\u7684\u6548\u679c\uff1b\u5339\u914d\u753b\u5e03\u9002\u5408\u667a\u80fd\u5bf9\u8c61\u539f\u5c3a\u5bf8\u66ff\u6362\uff1b\u6309\u539f\u56fe\u5c42\u8fb9\u754c\u9002\u5408\u539f\u56fe\u5c42\u4e0d\u662f\u6ee1\u753b\u5e03\u7684 PSD\u3002"${disabled}>
                <option value="cover-canvas"${normalizedMockup.replacementMode === 'cover-canvas' ? ' selected' : ''}>${PSD_REPLACEMENT_MODE_LABELS['cover-canvas']}</option>
                <option value="contain-canvas"${normalizedMockup.replacementMode === 'contain-canvas' ? ' selected' : ''}>${PSD_REPLACEMENT_MODE_LABELS['contain-canvas']}</option>
                <option value="layer-bounds-transform"${normalizedMockup.replacementMode === 'layer-bounds-transform' ? ' selected' : ''}>${PSD_REPLACEMENT_MODE_LABELS['layer-bounds-transform']}</option>
              </select>
            </label>
            <label class="pod-suite-field">
              <span class="pod-suite-field-label">
                \u5bfc\u51fa\u65b9\u5f0f
                <span class="pod-suite-help" title="\u6574\u56fe\u5bfc\u51fa\uff1a\u6bcf\u5f20\u7d20\u6750\u8f93\u51fa\u4e00\u5f20\u5b8c\u6574\u6837\u673a\uff1b\u6309\u53c2\u8003\u7ebf\u5207\u7247\uff1a\u6309 PSD \u6c34\u5e73\u53c2\u8003\u7ebf\u5206\u56fe\uff1b\u6309 PSD \u5207\u7247\u6807\u8bb0\uff1a\u6309 PSD \u5185\u5207\u7247\u77e9\u5f62\u5206\u56fe\u3002\u5207\u7247\u6a21\u5f0f\u53ea\u4fdd\u7559\u5207\u7247\u6587\u4ef6\u3002">?</span>
              </span>
              <select data-psd-field="exportMode" title="\u6574\u56fe\u5bfc\u51fa\u4fdd\u7559\u5b8c\u6574\u6837\u673a\uff1b\u4e24\u79cd\u5207\u7247\u6a21\u5f0f\u4f1a\u6309\u7d20\u6750\u540d\u65b0\u5efa\u6587\u4ef6\u5939\uff0c\u53ea\u4fdd\u7559\u5207\u7247\u56fe\u3002"${disabled}>
                <option value="original"${normalizedMockup.exportMode === 'original' ? ' selected' : ''}>${PSD_EXPORT_MODE_LABELS.original}</option>
                <option value="guides"${normalizedMockup.exportMode === 'guides' ? ' selected' : ''}>${PSD_EXPORT_MODE_LABELS.guides}</option>
                <option value="slices"${normalizedMockup.exportMode === 'slices' ? ' selected' : ''}>${PSD_EXPORT_MODE_LABELS.slices}</option>
              </select>
            </label>
            <label class="pod-suite-field pod-suite-psd-mockup-output-path">
              <span class="pod-suite-field-label">
                \u5bfc\u51fa\u4e3b\u76ee\u5f55
                <span class="pod-suite-help" title="\u8fd9\u4e2a PSD \u6837\u673a\u4f1a\u5bfc\u51fa\u5230\u6b64\u76ee\u5f55\u4e0b\u7684\u5b50\u76ee\u5f55\u4e2d\u3002">?</span>
              </span>
              <div class="pod-suite-picker-row pod-suite-picker-row-with-clear">
                <input type="text" readonly data-psd-field="outputDirectoryPath" value="${escapeHtml(normalizedMockup.outputDirectoryPath)}" />
                <button class="pod-suite-secondary-button" type="button" data-psd-action="select-output"${disabled}>
                  \u9009\u62e9
                </button>
                <button class="pod-suite-secondary-button" type="button" data-psd-action="open-output"${openDisabled}>
                  \u6253\u5f00
                </button>
              </div>
            </label>
            <label class="pod-suite-field">
              <span class="pod-suite-field-label">
                \u5b50\u76ee\u5f55\u540d\u79f0
                <span class="pod-suite-help" title="\u8fd9\u4e2a PSD \u6837\u673a\u7684\u7ed3\u679c\u4f1a\u5bfc\u51fa\u5230\u4e3b\u76ee\u5f55\u4e0b\u7684\u8fd9\u4e2a\u6587\u4ef6\u5939\u3002">?</span>
              </span>
              <input type="text" data-psd-field="outputSubdirName" value="${escapeHtml(normalizedMockup.outputSubdirName)}"${disabled} />
            </label>
            <label class="pod-suite-field pod-suite-psd-output-format-field">
              <span class="pod-suite-field-label">
                \u5bfc\u51fa\u683c\u5f0f
                <span class="pod-suite-help" title="\u8fd9\u4e2a PSD \u6837\u673a\u751f\u6210\u56fe\u7247\u7684\u6587\u4ef6\u683c\u5f0f\u3002">?</span>
              </span>
              <select data-psd-field="outputFormat"${disabled}>
                <option value="png"${normalizedMockup.outputFormat === 'png' ? ' selected' : ''}>PNG</option>
                <option value="jpg"${normalizedMockup.outputFormat === 'jpg' ? ' selected' : ''}>JPG</option>
                <option value="webp"${normalizedMockup.outputFormat === 'webp' ? ' selected' : ''}>WEBP</option>
              </select>
            </label>
            <label class="pod-suite-field pod-suite-psd-image-quality-field">
              <span class="pod-suite-field-label">
                \u56fe\u7247\u8d28\u91cf
                <span class="pod-suite-help" title="\u6574\u56fe\u5bfc\u51fa\u65f6\u7528\u4e8e\u6700\u7ec8\u56fe\uff1b\u5207\u7247\u65f6\u4e2d\u95f4\u957f\u56fe\u4fdd\u6301\u65e0\u635f\uff0c\u8fd9\u91cc\u53ea\u5f71\u54cd\u5207\u7247\u6587\u4ef6\u3002">?</span>
              </span>
              <input type="number" min="60" max="100" step="1" data-psd-field="imageQuality" value="${escapeHtml(normalizedMockup.imageQuality)}"${disabled} />
            </label>
          </div>
        </section>
      `;
    }).join('');
  }

  function updatePsdMockupCardControlsDisabled() {
    if (!elements.psdMockupList) {
      return;
    }

    elements.psdMockupList
      .querySelectorAll('input, select, button')
      .forEach((control) => {
        const isRemoveButton = control.matches('[data-psd-action="remove"]');
        const isOpenOutputButton = control.matches('[data-psd-action="open-output"]');
        const hasMultipleMockups = state.psdMockups.length > 1;
        const card = control.closest('[data-psd-mockup-id]');
        const mockup = card ? getPsdMockupById(card.dataset.psdMockupId) : null;
        control.disabled = isOpenOutputButton
          ? !normalizeText(mockup && mockup.outputDirectoryPath)
          : state.busy || (isRemoveButton && !hasMultipleMockups);
      });
  }

  function canGenerate() {
    return Boolean(
      state.whiteMockupPath
      && state.imageDirectoryPath
      && state.outputDirectoryPath
    );
  }

  function canRunPsdSmartObject() {
    const runnableMockups = getRunnablePsdMockups();
    return Boolean(
      runnableMockups.length
      && runnableMockups.length === state.psdMockups.length
      && state.psdImageDirectoryPath
    );
  }

  function updateButtons() {
    elements.generateButton.disabled = state.busy || !canGenerate();
    if (elements.selectTextureImageButton) {
      elements.selectTextureImageButton.disabled = state.busy || !state.whiteMockupPath;
    }
    if (elements.selectMaskImageButton) {
      elements.selectMaskImageButton.disabled = state.busy || !state.whiteMockupPath;
    }
    if (elements.clearTextureImageButton) {
      elements.clearTextureImageButton.disabled = state.busy || !getWhiteMockupTextureImagePath();
    }
    if (elements.clearMaskImageButton) {
      elements.clearMaskImageButton.disabled = state.busy || !getWhiteMockupMaskImagePath();
    }
    if (elements.saveWhiteMockupTemplateButton) {
      elements.saveWhiteMockupTemplateButton.disabled = state.busy || !state.whiteMockupPath || !state.whiteMockupTemplateDirty;
    }
    if (elements.resetWhiteMockupTemplateButton) {
      elements.resetWhiteMockupTemplateButton.disabled = state.busy || !state.whiteMockupPath;
    }
    if (elements.addWhiteMockupRegionButton) {
      elements.addWhiteMockupRegionButton.disabled = state.busy || !state.whiteMockupPath;
    }
    if (elements.duplicateWhiteMockupRegionButton) {
      elements.duplicateWhiteMockupRegionButton.disabled = state.busy || !state.whiteMockupPath;
    }
    if (elements.deleteWhiteMockupRegionButton) {
      elements.deleteWhiteMockupRegionButton.disabled = state.busy || !state.whiteMockupPath || getWhiteMockupRegions().length <= 1;
    }
    if (elements.autoWhiteMockupRegionButton) {
      elements.autoWhiteMockupRegionButton.disabled = state.busy || !state.whiteMockupPath || !getWhiteMockupMaskImagePath();
    }
    if (elements.selectPreviewDesignButton) {
      elements.selectPreviewDesignButton.disabled = state.busy || !state.whiteMockupPath;
    }
    if (elements.renderWhiteMockupPreviewButton) {
      elements.renderWhiteMockupPreviewButton.disabled = state.busy || !state.whiteMockupPath || !state.previewDesignPath;
    }
    if (elements.clearWhiteMockupPreviewButton) {
      elements.clearWhiteMockupPreviewButton.disabled = state.busy || (!state.previewDesignPath && !state.whiteMockupPreviewDataUrl);
    }
    if (elements.selectPsdImageDirectoryButton) {
      elements.selectPsdImageDirectoryButton.disabled = state.busy;
    }
    if (elements.selectPsdMetadataSourceButton) {
      elements.selectPsdMetadataSourceButton.disabled = state.busy;
    }
    if (elements.selectPsdMetadataSourceDirectoryButton) {
      elements.selectPsdMetadataSourceDirectoryButton.disabled = state.busy;
    }
    if (elements.clearPsdMetadataSourceButton) {
      elements.clearPsdMetadataSourceButton.disabled = state.busy || (!state.psdMetadataSourcePath && !state.psdMetadataSourceDirectoryPath);
    }
    if (elements.psdSkipExistingOutputsCheckbox) {
      elements.psdSkipExistingOutputsCheckbox.disabled = state.busy;
    }
    if (elements.psdEngineWindowModeSelect) {
      elements.psdEngineWindowModeSelect.disabled = false;
    }
    if (elements.loadPsdTemplateButton) {
      elements.loadPsdTemplateButton.disabled = state.busy;
    }
    if (elements.syncPsdTemplateButton) {
      elements.syncPsdTemplateButton.disabled = state.busy;
    }
    if (elements.savePsdTemplateButton) {
      elements.savePsdTemplateButton.disabled = state.busy;
    }
    if (elements.deletePsdTemplateButton) {
      const confirmActive = state.psdSelectedTemplateId
        && state.psdDeleteTemplateConfirmId === state.psdSelectedTemplateId
        && Date.now() < state.psdDeleteTemplateConfirmUntil;
      elements.deletePsdTemplateButton.disabled = state.busy || !state.psdSelectedTemplateId;
      elements.deletePsdTemplateButton.textContent = confirmActive ? '\u786e\u8ba4\u5220\u9664' : '\u5220\u9664\u6a21\u677f';
    }
    if (elements.runPsdSmartObjectButton) {
      const isPsdRunning = state.psdSmartObjectRunning;
      elements.runPsdSmartObjectButton.disabled = state.psdSmartObjectCanceling || (!isPsdRunning && (state.busy || !canRunPsdSmartObject()));
      elements.runPsdSmartObjectButton.textContent = isPsdRunning ? '\u505c\u6b62PSD\u5957\u56fe' : '\u5f00\u59cbPSD\u5957\u56fe';
    }
    updatePsdMockupCardControlsDisabled();
  }

  function setBusy(busy) {
    state.busy = busy;
    elements.selectWhiteMockupButton.disabled = busy;
    elements.selectImageDirectoryButton.disabled = busy;
    elements.selectOutputDirectoryButton.disabled = busy;
    updateButtons();
  }

  function updateMetrics() {
    elements.baseMetricLabel.textContent = '\u767d\u819c';
    elements.targetMetricLabel.textContent = '\u6a21\u677f';
    elements.baseMetric.textContent = state.whiteMockupPath ? '\u5df2\u9009\u62e9' : '-';
    if (!state.whiteMockupPath) {
      elements.templateMetric.textContent = '0';
    } else {
      const parts = ['1'];
      if (getWhiteMockupMaskImagePath()) {
        parts.push('\u8499\u7248');
      }
      if (getWhiteMockupTextureImagePath()) {
        parts.push('\u7eb9\u7406');
      }
      elements.templateMetric.textContent = parts.join('+');
    }
    elements.imageMetric.textContent = String(state.imageFiles.length || 0);
    elements.regionMetric.textContent = state.whiteMockupPath ? String(getWhiteMockupRegions().length || 0) : '0';
  }

  function getWhiteMockupPreviewGeometry() {
    if (!elements.whiteMockupPreviewImage || !elements.whiteMockupPreviewOverlay) {
      return null;
    }

    const imageRect = elements.whiteMockupPreviewImage.getBoundingClientRect();
    const overlayRect = elements.whiteMockupPreviewOverlay.getBoundingClientRect();
    const naturalSize = getWhiteMockupTemplateSize();

    if (!imageRect.width || !imageRect.height || !naturalSize.width || !naturalSize.height) {
      return null;
    }

    return {
      offsetX: imageRect.left - overlayRect.left,
      offsetY: imageRect.top - overlayRect.top,
      scaleX: imageRect.width / naturalSize.width,
      scaleY: imageRect.height / naturalSize.height
    };
  }

  function renderWhiteMockupTemplateOverlay() {
    if (!elements.whiteMockupOverlaySvg) {
      return;
    }

    const geometry = getWhiteMockupPreviewGeometry();
    const regions = getWhiteMockupRegions();

    if (!geometry || !regions.length) {
      elements.whiteMockupOverlaySvg.innerHTML = '';
      return;
    }

    const activeIndex = clamp(
      Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );
    const regionElements = regions.map((region, regionIndex) => {
      const points = Array.isArray(region.points) ? region.points : [];
      const isMaskShape = isWhiteMockupMaskShapeRegion(region);
      const shapePoints = isMaskShape && region.shape && Array.isArray(region.shape.outlinePoints)
        ? region.shape.outlinePoints
        : [];
      const previewPoints = shapePoints.length >= 3 ? shapePoints : points;

      if (previewPoints.length < 3) {
        return '';
      }

      const scaledPoints = previewPoints.map((point) => ({
        x: geometry.offsetX + (Number(point[0]) * geometry.scaleX),
        y: geometry.offsetY + (Number(point[1]) * geometry.scaleY)
      }));
      const polygonPoints = scaledPoints.map((point) => `${point.x},${point.y}`).join(' ');
      const isActive = regionIndex === activeIndex;
      const handlePoints = points.slice(0, 4).map((point) => ({
        x: geometry.offsetX + (Number(point[0]) * geometry.scaleX),
        y: geometry.offsetY + (Number(point[1]) * geometry.scaleY)
      }));
      const handles = isActive && !isMaskShape
        ? handlePoints.map((point, pointIndex) => `
          <g class="pod-suite-template-handle" data-region-index="${regionIndex}" data-point-index="${pointIndex}">
            <circle cx="${point.x}" cy="${point.y}" r="8"></circle>
            <text x="${point.x}" y="${point.y - 12}">${pointIndex + 1}</text>
          </g>
        `).join('')
        : '';
      const warpControls = isMaskShape && isActive && region.shape && Array.isArray(region.shape.warpControls)
        ? region.shape.warpControls
        : [];
      const warpControlPoints = warpControls.map((control) => {
        const anchor = Array.isArray(control.anchor) ? control.anchor : [];
        const handle = Array.isArray(control.handle) ? control.handle : anchor;

        return {
          anchorPoint: {
            x: geometry.offsetX + (Number(anchor[0]) * geometry.scaleX),
            y: geometry.offsetY + (Number(anchor[1]) * geometry.scaleY)
          },
          handlePoint: {
            x: geometry.offsetX + (Number(handle[0]) * geometry.scaleX),
            y: geometry.offsetY + (Number(handle[1]) * geometry.scaleY)
          }
        };
      });
      const warpOutline = warpControlPoints.length >= 3
        ? `<polyline class="pod-suite-template-warp-outline" points="${warpControlPoints.map((point) => `${point.handlePoint.x},${point.handlePoint.y}`).join(' ')} ${warpControlPoints[0].handlePoint.x},${warpControlPoints[0].handlePoint.y}"></polyline>`
        : '';
      const warpControlElements = warpControlPoints.map((point, controlIndex) => {
        const { anchorPoint, handlePoint } = point;

        return `
          <g class="pod-suite-template-warp-control" data-region-index="${regionIndex}" data-warp-control-index="${controlIndex}">
            <line x1="${anchorPoint.x}" y1="${anchorPoint.y}" x2="${handlePoint.x}" y2="${handlePoint.y}"></line>
            <circle class="pod-suite-template-warp-anchor" cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="4"></circle>
            <circle class="pod-suite-template-warp-handle" cx="${handlePoint.x}" cy="${handlePoint.y}" r="8"></circle>
            <text x="${handlePoint.x}" y="${handlePoint.y - 12}">${controlIndex + 1}</text>
          </g>
        `;
      }).join('');

      return `
        <g class="pod-suite-template-region${isActive ? ' is-active' : ''}${isMaskShape ? ' is-mask-shape' : ''}" data-region-index="${regionIndex}">
          <polygon class="pod-suite-template-polygon" points="${polygonPoints}"></polygon>
          <polyline class="pod-suite-template-outline" points="${polygonPoints} ${scaledPoints[0].x},${scaledPoints[0].y}"></polyline>
          ${handles}
          ${warpOutline}
          ${warpControlElements}
        </g>
      `;
    }).join('');

    elements.whiteMockupOverlaySvg.innerHTML = `
      ${regionElements}
    `;
  }

  function renderWhiteMockupRegionList() {
    if (!elements.whiteMockupRegionList) {
      return;
    }

    const regions = getWhiteMockupRegions();
    const activeIndex = clamp(
      Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );

    elements.whiteMockupRegionList.innerHTML = regions.map((region, index) => `
      <button class="pod-suite-region-tab${index === activeIndex ? ' is-active' : ''}" type="button" data-region-index="${index}">
        <span>${index + 1}</span>
        <strong>${escapeHtml(normalizeText(region.name) || `\u533a\u57df${index + 1}`)}</strong>
      </button>
    `).join('');
  }

  function renderWhiteMockupPointList() {
    if (!elements.whiteMockupPointList) {
      return;
    }

    const region = getWhiteMockupRegion();
    const points = Array.isArray(region.points) ? region.points : [];
    if (isWhiteMockupMaskShapeRegion(region)) {
      const shape = region.shape && typeof region.shape === 'object' ? region.shape : {};
      const bounds = shape.bounds && typeof shape.bounds === 'object' ? shape.bounds : {};
      const warpCount = Array.isArray(shape.warpControls) ? shape.warpControls.length : 0;
      elements.whiteMockupPointList.innerHTML = `
        <div class="pod-suite-template-point-row is-wide">
          <span>\u8499\u7248\u5f62\u72b6</span>
          <strong>${Math.round(Number(bounds.width) || 0)} x ${Math.round(Number(bounds.height) || 0)}</strong>
        </div>
        <div class="pod-suite-template-point-row is-wide">
          <span>\u5c40\u90e8\u8c03\u6574\u70b9</span>
          <strong>${warpCount}</strong>
        </div>
      `;
      return;
    }

    elements.whiteMockupPointList.innerHTML = points.slice(0, 4).map((point, index) => `
      <div class="pod-suite-template-point-row">
        <span>${index + 1}. ${escapeHtml(WHITE_MOCKUP_POINT_LABELS[index] || '')}</span>
        <strong>${Math.round(Number(point[0]) || 0)}, ${Math.round(Number(point[1]) || 0)}</strong>
      </div>
    `).join('');
  }

  function updateWhiteMockupPreviewState() {
    if (elements.previewDesignPathInput) {
      elements.previewDesignPathInput.value = state.previewDesignPath;
    }

    if (elements.whiteMockupPreviewImage) {
      const nextSrc = getWhiteMockupPreviewImageSrc();
      if (elements.whiteMockupPreviewImage.getAttribute('src') !== nextSrc) {
        elements.whiteMockupPreviewImage.setAttribute('src', nextSrc);
      }
    }
  }

  function updateWhiteMockupTemplateState() {
    const previewSuffix = state.whiteMockupPreviewDataUrl
      ? state.whiteMockupPreviewStale
        ? '\uff0c\u9884\u89c8\u9700\u5237\u65b0'
        : `\uff0c\u9884\u89c8\uff1a${getBaseName(state.previewDesignPath) || '\u5df2\u751f\u6210'}`
      : '';

    if (elements.whiteMockupTemplateState) {
      if (!state.whiteMockupPath) {
        elements.whiteMockupTemplateState.textContent = '\u672a\u9009\u62e9\u767d\u819c\u56fe\u7247';
      } else if (state.whiteMockupTemplateDirty) {
        elements.whiteMockupTemplateState.textContent = `\u6709\u672a\u4fdd\u5b58\u8c03\u6574\uff0c${getWhiteMockupRegions().length}\u4e2a\u533a\u57df${getWhiteMockupAssetStateSuffix()}${previewSuffix}`;
      } else if (state.whiteMockupTemplateIsDefault) {
        elements.whiteMockupTemplateState.textContent = `\u9ed8\u8ba4\u533a\u57df\uff0c${getWhiteMockupRegions().length}\u4e2a\u533a\u57df${getWhiteMockupAssetStateSuffix()}${previewSuffix}`;
      } else {
        elements.whiteMockupTemplateState.textContent = `\u5df2\u4fdd\u5b58${getWhiteMockupRegions().length}\u4e2a\u533a\u57df${getWhiteMockupAssetStateSuffix()}${previewSuffix}`;
      }
    }

    if (state.activeMode === 'white-mockup') {
      if (!state.whiteMockupPath) {
        setStatus(MODE_STATUS_TEXT['white-mockup']);
      } else if (state.busy) {
        setStatus(elements.status.textContent || MODE_STATUS_TEXT['white-mockup']);
      }
    }

    updateWhiteMockupPreviewState();
    renderWhiteMockupTemplateOverlay();
    renderWhiteMockupRegionList();
    renderWhiteMockupPointList();
    updateButtons();
  }

  function updatePsdSmartObjectState() {
    ensurePsdMockups();
    renderPsdTemplateOptions();
    renderPsdMockupCards();
    if (elements.psdImageDirectoryPathInput) {
      elements.psdImageDirectoryPathInput.value = state.psdImageDirectoryPath;
    }
    if (elements.psdMetadataSourcePathInput) {
      elements.psdMetadataSourcePathInput.value = state.psdMetadataSourceDirectoryPath || state.psdMetadataSourcePath;
    }
    if (elements.psdTemplateNameInput && elements.psdTemplateNameInput.value !== state.psdTemplateName) {
      elements.psdTemplateNameInput.value = state.psdTemplateName;
    }
    if (elements.psdEngineWindowModeSelect && elements.psdEngineWindowModeSelect.value !== state.psdEngineWindowMode) {
      elements.psdEngineWindowModeSelect.value = state.psdEngineWindowMode;
    }
    if (elements.psdEngineConcurrencySelect && elements.psdEngineConcurrencySelect.value !== String(state.psdEngineConcurrency)) {
      elements.psdEngineConcurrencySelect.value = String(state.psdEngineConcurrency);
    }
    if (elements.psdSkipExistingOutputsCheckbox) {
      elements.psdSkipExistingOutputsCheckbox.checked = state.psdSkipExistingOutputs === true;
      elements.psdSkipExistingOutputsCheckbox.disabled = state.busy;
    }
    if (elements.psdCompactSummary) {
      const runnableCount = getRunnablePsdMockups().length;
      const imageCount = state.psdImageFiles.length || 0;
      const outputReadyCount = state.psdMockups.filter((mockup, index) => normalizeText(normalizePsdMockup(mockup, index).outputDirectoryPath)).length;
      const outputText = outputReadyCount === state.psdMockups.length
        ? '\u5bfc\u51fa\u5df2\u9009'
        : `\u5bfc\u51fa ${outputReadyCount}/${state.psdMockups.length || 0}`;
      const metadataText = state.psdMetadataSourceDirectoryPath
        ? `\u968f\u673a\u590d\u7528\u771f\u5b9e\u539f\u56fe ${state.psdMetadataSourceFiles.length || 0} \u5f20`
        : state.psdMetadataSourcePath
          ? '\u590d\u7528\u5355\u5f20\u539f\u56fe\u5143\u6570\u636e'
          : '\u4e0d\u590d\u7528\u5143\u6570\u636e';
      const modeCount = new Set(state.psdMockups.map((mockup, index) => normalizePsdMockup(mockup, index).exportMode)).size;
      const formatCount = new Set(state.psdMockups.map((mockup, index) => normalizePsdMockup(mockup, index).outputFormat)).size;
      const outputModeText = modeCount > 1 || formatCount > 1
        ? '\u6837\u673a\u72ec\u7acb\u5bfc\u51fa\u8bbe\u7f6e'
        : `${PSD_EXPORT_MODE_LABELS[normalizePsdMockup(state.psdMockups[0], 0).exportMode] || PSD_EXPORT_MODE_LABELS.original}/${String(normalizePsdMockup(state.psdMockups[0], 0).outputFormat || 'png').toUpperCase()}`;
      const skipText = state.psdSkipExistingOutputs ? '\u5df2\u5b58\u5728\u8df3\u8fc7' : '\u8986\u76d6\u5bfc\u51fa';
      const engineText = `${getPsdEngineConcurrencyLabel(state.psdEngineConcurrency)}\uff0c\u6700\u591a ${getEstimatedPsdEngineCount(runnableCount, state.psdEngineConcurrency)} \u4e2a\u5f15\u64ce`;
      elements.psdCompactSummary.textContent = `\u6837\u673a ${runnableCount}/${state.psdMockups.length || 0} \u00b7 \u7d20\u6750 ${imageCount} \u5f20 \u00b7 ${outputText} \u00b7 ${metadataText} \u00b7 ${outputModeText} \u00b7 ${skipText} \u00b7 ${engineText}`;
    }
    updateButtons();
  }

  function updateWhiteMockupPoint(pointIndex, x, y) {
    if (pointIndex < 0 || pointIndex > 3) {
      return;
    }

    const size = getWhiteMockupTemplateSize();
    const template = getWhiteMockupTemplatePayload();
    const regions = Array.isArray(template.regions) && template.regions.length
      ? template.regions.slice()
      : createDefaultWhiteMockupTemplate().regions.slice();
    const regionIndex = clamp(
      Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );
    const region = regions[regionIndex] || {};
    const points = Array.isArray(region.points) ? region.points.slice(0, 4) : [];
    const fallbackPoints = Array.isArray(DEFAULT_WHITE_MOCKUP_TEMPLATE.regions[0].points)
      ? DEFAULT_WHITE_MOCKUP_TEMPLATE.regions[0].points
      : [[0, 0], [size.width, 0], [size.width, size.height], [0, size.height]];

    while (points.length < 4) {
      points.push(fallbackPoints[points.length].slice());
    }

    points[pointIndex] = [
      Math.round(clamp(x, -size.width * 0.5, size.width * 1.5)),
      Math.round(clamp(y, -size.height * 0.5, size.height * 1.5))
    ];
    const nextRegion = {
      ...region,
      points
    };

    if (isWhiteMockupMaskShapeRegion(region)) {
      const xValues = points.map((point) => Math.round(Number(point[0]) || 0));
      const yValues = points.map((point) => Math.round(Number(point[1]) || 0));
      const left = Math.min(...xValues);
      const top = Math.min(...yValues);
      const right = Math.max(...xValues);
      const bottom = Math.max(...yValues);

      nextRegion.shape = {
        ...(region.shape && typeof region.shape === 'object' ? region.shape : {}),
        mappingBounds: {
          left,
          top,
          right,
          bottom,
          width: Math.max(1, right - left + 1),
          height: Math.max(1, bottom - top + 1),
          count: Number(region.shape && region.shape.bounds && region.shape.bounds.count) || 0,
          points
        }
      };
    }

    regions[regionIndex] = nextRegion;
    setWhiteMockupTemplate({
      ...template,
      regions
    }, {
      dirty: true,
      isDefault: false
    });
    updateWhiteMockupTemplateState();
  }

  function updateMaskShapeWarpControl(controlIndex, x, y) {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    const template = getWhiteMockupTemplatePayload();
    const regions = Array.isArray(template.regions) && template.regions.length
      ? template.regions.slice()
      : createDefaultWhiteMockupTemplate().regions.slice();
    const regionIndex = clamp(
      Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );
    const region = regions[regionIndex] || {};

    if (!isWhiteMockupMaskShapeRegion(region)) {
      return;
    }

    const shape = region.shape && typeof region.shape === 'object' ? region.shape : {};
    const warpControls = Array.isArray(shape.warpControls) ? shape.warpControls.slice() : [];

    if (controlIndex < 0 || controlIndex >= warpControls.length) {
      return;
    }

    const size = getWhiteMockupTemplateSize();
    const control = warpControls[controlIndex] || {};
    const anchor = Array.isArray(control.anchor) ? control.anchor : [x, y];

    warpControls[controlIndex] = {
      ...control,
      anchor,
      handle: [
        Math.round(clamp(x, -size.width * 0.5, size.width * 1.5)),
        Math.round(clamp(y, -size.height * 0.5, size.height * 1.5))
      ]
    };
    regions[regionIndex] = {
      ...region,
      shape: {
        ...shape,
        warpControls
      }
    };
    setWhiteMockupTemplate({
      ...template,
      regions
    }, {
      dirty: true,
      isDefault: false
    });
    updateInputs();
  }

  function handleWhiteMockupPointerMove(event) {
    if (state.whiteMockupDragPointIndex < 0 && state.whiteMockupDragWarpControlIndex < 0) {
      return;
    }

    const geometry = getWhiteMockupPreviewGeometry();
    if (!geometry || !elements.whiteMockupPreviewImage) {
      return;
    }

    const imageRect = elements.whiteMockupPreviewImage.getBoundingClientRect();
    const imageX = (event.clientX - imageRect.left) / geometry.scaleX;
    const imageY = (event.clientY - imageRect.top) / geometry.scaleY;

    if (state.whiteMockupDragWarpControlIndex >= 0) {
      updateMaskShapeWarpControl(state.whiteMockupDragWarpControlIndex, imageX, imageY);
    } else {
      updateWhiteMockupPoint(state.whiteMockupDragPointIndex, imageX, imageY);
    }
  }

  function stopWhiteMockupDrag() {
    state.whiteMockupDragPointIndex = -1;
    state.whiteMockupDragWarpControlIndex = -1;
    window.removeEventListener('pointermove', handleWhiteMockupPointerMove);
    window.removeEventListener('pointerup', stopWhiteMockupDrag);
    window.removeEventListener('pointercancel', stopWhiteMockupDrag);
  }

  function startWhiteMockupDrag(event) {
    const warpControl = event.target.closest('[data-warp-control-index]');
    if (warpControl) {
      event.preventDefault();
      const regionIndex = Number(warpControl.dataset.regionIndex);
      if (Number.isInteger(regionIndex)) {
        state.whiteMockupActiveRegionIndex = regionIndex;
      }
      state.whiteMockupDragPointIndex = -1;
      state.whiteMockupDragWarpControlIndex = Number(warpControl.dataset.warpControlIndex);
      handleWhiteMockupPointerMove(event);
      window.addEventListener('pointermove', handleWhiteMockupPointerMove);
      window.addEventListener('pointerup', stopWhiteMockupDrag);
      window.addEventListener('pointercancel', stopWhiteMockupDrag);
      return;
    }

    const handle = event.target.closest('[data-point-index]');
    if (!handle) {
      const region = event.target.closest('[data-region-index]');
      if (region) {
        const regionIndex = Number(region.dataset.regionIndex);
        setWhiteMockupActiveRegion(regionIndex);
      }
      return;
    }

    const pointIndex = Number(handle.dataset.pointIndex);
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex > 3) {
      return;
    }

    event.preventDefault();
    const regionIndex = Number(handle.dataset.regionIndex);
    if (Number.isInteger(regionIndex)) {
      state.whiteMockupActiveRegionIndex = regionIndex;
    }
    state.whiteMockupDragPointIndex = pointIndex;
    state.whiteMockupDragWarpControlIndex = -1;
    handleWhiteMockupPointerMove(event);
    window.addEventListener('pointermove', handleWhiteMockupPointerMove);
    window.addEventListener('pointerup', stopWhiteMockupDrag);
    window.addEventListener('pointercancel', stopWhiteMockupDrag);
  }

  function setWhiteMockupActiveRegion(regionIndex) {
    const regions = getWhiteMockupRegions();
    const nextIndex = clamp(
      Math.round(Number(regionIndex) || 0),
      0,
      Math.max(0, regions.length - 1)
    );

    if (state.whiteMockupActiveRegionIndex === nextIndex) {
      return;
    }

    state.whiteMockupActiveRegionIndex = nextIndex;
    updateWhiteMockupTemplateState();
  }

  function addWhiteMockupRegion() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    const template = getWhiteMockupTemplatePayload();
    const regions = Array.isArray(template.regions) && template.regions.length
      ? template.regions.slice()
      : createDefaultWhiteMockupTemplate().regions.slice();
    const sourceRegion = regions[state.whiteMockupActiveRegionIndex] || regions[regions.length - 1] || DEFAULT_WHITE_MOCKUP_TEMPLATE.regions[0];
    const nextRegion = typeof templateRegions.createRegionFrom === 'function'
      ? templateRegions.createRegionFrom(sourceRegion, regions.length, getWhiteMockupTemplateSize())
      : clonePlain(sourceRegion);

    regions.push(nextRegion);
    state.whiteMockupActiveRegionIndex = regions.length - 1;
    setWhiteMockupTemplate({
      ...template,
      regions
    }, {
      dirty: true,
      isDefault: false
    });
    updateInputs();
    addLog('\u5df2\u65b0\u589e\u4e00\u4e2a\u8bbe\u8ba1\u533a\u57df\u3002');
  }

  function duplicateWhiteMockupRegion() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    const template = getWhiteMockupTemplatePayload();
    const regions = Array.isArray(template.regions) && template.regions.length
      ? template.regions.slice()
      : createDefaultWhiteMockupTemplate().regions.slice();
    const sourceRegion = regions[state.whiteMockupActiveRegionIndex] || regions[0] || DEFAULT_WHITE_MOCKUP_TEMPLATE.regions[0];
    const nextRegion = typeof templateRegions.createRegionFrom === 'function'
      ? templateRegions.createRegionFrom(sourceRegion, regions.length, getWhiteMockupTemplateSize())
      : clonePlain(sourceRegion);

    regions.splice(state.whiteMockupActiveRegionIndex + 1, 0, nextRegion);
    state.whiteMockupActiveRegionIndex += 1;
    setWhiteMockupTemplate({
      ...template,
      regions
    }, {
      dirty: true,
      isDefault: false
    });
    updateInputs();
    addLog('\u5df2\u590d\u5236\u5f53\u524d\u8bbe\u8ba1\u533a\u57df\u3002');
  }

  function deleteWhiteMockupRegion() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    const template = getWhiteMockupTemplatePayload();
    const regions = Array.isArray(template.regions) && template.regions.length
      ? template.regions.slice()
      : [];

    if (regions.length <= 1) {
      return;
    }

    regions.splice(state.whiteMockupActiveRegionIndex, 1);
    state.whiteMockupActiveRegionIndex = clamp(
      state.whiteMockupActiveRegionIndex,
      0,
      Math.max(0, regions.length - 1)
    );
    setWhiteMockupTemplate({
      ...template,
      regions
    }, {
      dirty: true,
      isDefault: false
    });
    updateInputs();
    addLog('\u5df2\u5220\u9664\u5f53\u524d\u8bbe\u8ba1\u533a\u57df\u3002');
  }

  async function createWhiteMockupRegionFromMask() {
    if (!state.whiteMockupPath || state.busy || !getWhiteMockupMaskImagePath()) {
      return;
    }

    setBusy(true);
    try {
      const result = await getBridge().createWhiteMockupRegionFromMask({
        mockupPath: state.whiteMockupPath,
        maskImagePath: getWhiteMockupMaskImagePath()
      });

      if (!result || result.success !== true || !result.region) {
        throw new Error(result && result.message ? result.message : '\u5370\u82b1\u8499\u7248\u533a\u57df\u8bc6\u522b\u5931\u8d25\u3002');
      }

      const template = getWhiteMockupTemplatePayload();
      const regions = Array.isArray(template.regions) && template.regions.length
        ? template.regions.slice()
        : createDefaultWhiteMockupTemplate().regions.slice();
      const regionIndex = clamp(
        Math.round(Number(state.whiteMockupActiveRegionIndex) || 0),
        0,
        Math.max(0, regions.length - 1)
      );

      regions[regionIndex] = {
        ...regions[regionIndex],
        ...result.region,
        name: normalizeText(regions[regionIndex] && regions[regionIndex].name) || normalizeText(result.region.name)
      };
      setWhiteMockupTemplate({
        ...template,
        regions
      }, {
        dirty: true,
        isDefault: false
      });
      updateInputs();
      addLog(result.source === 'mask-shape'
        ? '\u5df2\u6309\u8499\u7248\u900f\u660e\u8fb9\u7f18\u751f\u6210\u5f62\u72b6\u533a\u57df\u3002'
        : '\u5df2\u6309\u5370\u82b1\u8499\u7248\u81ea\u52a8\u6846\u9009\u5f53\u524d\u533a\u57df\uff0c\u53ef\u7ee7\u7eed\u62d6\u52a8\u5fae\u8c03\u3002');
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectPreviewDesignFile() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    setBusy(true);
    try {
      const result = await getBridge().selectPreviewDesignFile({
        defaultPath: state.previewDesignPath || state.imageDirectoryPath || state.whiteMockupPath
      });

      if (!result || result.canceled === true || !result.filePath) {
        return;
      }

      state.previewDesignPath = result.filePath;
      clearWhiteMockupPreviewData();
      cacheCurrentWhiteMockupSettings();
      updateInputs();
      addLog('\u5df2\u9009\u62e9\u9884\u89c8\u7d20\u6750\u56fe\u3002');
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }

    await renderWhiteMockupPreview();
  }

  async function renderWhiteMockupPreview() {
    if (!state.whiteMockupPath || !state.previewDesignPath || state.busy) {
      return;
    }

    setBusy(true);
    setStatus('\u6b63\u5728\u751f\u6210\u9884\u89c8');
    try {
      const result = await getBridge().renderWhiteMockupPreview({
        mockupPath: state.whiteMockupPath,
        designPath: state.previewDesignPath,
        template: getWhiteMockupTemplatePayload()
      });

      if (!result || result.success !== true || !result.dataUrl) {
        throw new Error(result && result.message ? result.message : '\u9884\u89c8\u751f\u6210\u5931\u8d25\u3002');
      }

      state.whiteMockupPreviewDataUrl = result.dataUrl;
      state.whiteMockupPreviewStale = false;
      updateInputs();
      setStatus('\u9884\u89c8\u5df2\u66f4\u65b0');
      addLog('\u9884\u89c8\u5df2\u66f4\u65b0\uff0c\u8fd9\u5f20\u56fe\u548c\u6279\u91cf\u5957\u56fe\u4f7f\u7528\u540c\u4e00\u5957\u6bd4\u4f8b\u3002', 'success');
    } catch (error) {
      setStatus('\u9884\u89c8\u5931\u8d25');
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  function clearWhiteMockupPreview() {
    if (state.busy) {
      return;
    }

    state.previewDesignPath = '';
    clearWhiteMockupPreviewData();
    cacheCurrentWhiteMockupSettings();
    updateInputs();
    addLog('\u5df2\u6e05\u7a7a\u9884\u89c8\u7d20\u6750\u56fe\u3002');
  }

  async function selectPsdMockupFile(mockupId) {
    setBusy(true);
    try {
      const mockup = getPsdMockupById(mockupId);
      const result = await getBridge().selectPsdMockupFile({
        defaultPath: mockup && mockup.psdPath
      });

      if (!result || result.canceled === true || !result.filePath) {
        return;
      }

      updatePsdMockup(mockupId, {
        psdPath: result.filePath
      });
      setStatus('PSD\u6837\u673a\u5df2\u9009\u62e9');
      addPsdLog('PSD\u6837\u673a\u5df2\u9009\u62e9\u3002');
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  function addPsdMockup() {
    if (state.busy) {
      return;
    }

    ensurePsdMockups();
    state.psdMockups.push(createDefaultPsdMockup(state.psdMockups.length));
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
    addPsdLog('\u5df2\u6dfb\u52a0PSD\u6837\u673a\u5361\u7247\u3002');
  }

  function removePsdMockup(mockupId) {
    if (state.busy || state.psdMockups.length <= 1) {
      return;
    }

    state.psdMockups = state.psdMockups.filter((mockup) => mockup.id !== mockupId);
    ensurePsdMockups();
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
    addPsdLog('\u5df2\u5220\u9664PSD\u6837\u673a\u5361\u7247\u3002');
  }

  async function selectPsdImageDirectory() {
    setBusy(true);
    try {
      const result = await getBridge().selectPsdImageDirectory({
        defaultPath: state.psdImageDirectoryPath
      });

      if (!result || result.canceled === true || !result.directoryPath) {
        return;
      }

      state.psdImageDirectoryPath = result.directoryPath;
      state.psdImageFiles = Array.isArray(result.files) ? result.files : [];
      cacheCurrentPsdSettings();
      updatePsdSmartObjectState();
      setStatus('PSD\u7d20\u6750\u76ee\u5f55\u5df2\u9009\u62e9');
      addPsdLog(`PSD\u7d20\u6750\u76ee\u5f55\u5df2\u9009\u62e9\uff0c\u8bc6\u522b ${state.psdImageFiles.length} \u5f20\u56fe\u7247\u3002`);
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectPsdMockupOutputDirectory(mockupId) {
    const mockup = getPsdMockupById(mockupId);
    if (!mockup || state.busy) {
      return;
    }

    setBusy(true);
    try {
      const result = await getBridge().selectPsdOutputDirectory({
        defaultPath: normalizeText(mockup.outputDirectoryPath) || state.psdOutputDirectoryPath
      });

      if (!result || result.canceled === true || !result.directoryPath) {
        return;
      }

      updatePsdMockup(mockupId, {
        outputDirectoryPath: result.directoryPath
      });
      setStatus('\u6837\u673a\u5bfc\u51fa\u76ee\u5f55\u5df2\u9009\u62e9');
      addPsdLog(`PSD\u6837\u673a\u5bfc\u51fa\u76ee\u5f55\u5df2\u9009\u62e9\uff1a${result.directoryPath}`);
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectPsdMetadataSourceFile() {
    setBusy(true);
    try {
      const bridge = getBridge();
      const result = typeof bridge.selectPsdMetadataSourceFile === 'function'
        ? await bridge.selectPsdMetadataSourceFile({
          defaultPath: state.psdMetadataSourcePath || state.psdMetadataSourceDirectoryPath
        })
        : {
          canceled: false,
          filePath: await selectImagePathWithFileInput()
        };

      if (!result || result.canceled === true || !result.filePath) {
        return;
      }

      setPsdMetadataSourcePath(result.filePath);
      addPsdLog(`\u5143\u6570\u636e\u6765\u6e90\u56fe\u5df2\u9009\u62e9\uff1a${result.filePath}`);
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectPsdMetadataSourceDirectory() {
    setBusy(true);
    try {
      const bridge = getBridge();
      if (!bridge || typeof bridge.selectPsdMetadataSourceDirectory !== 'function') {
        throw new Error('\u5143\u6570\u636e\u539f\u56fe\u76ee\u5f55\u9009\u62e9\u529f\u80fd\u672a\u5c31\u7eea\u3002');
      }

      const result = await bridge.selectPsdMetadataSourceDirectory({
        defaultPath: state.psdMetadataSourceDirectoryPath || state.psdMetadataSourcePath
      });

      if (!result || result.canceled === true || !result.directoryPath) {
        return;
      }

      setPsdMetadataSourceDirectoryPath(result.directoryPath, result.files);
      addPsdLog(`\u5143\u6570\u636e\u539f\u56fe\u76ee\u5f55\u5df2\u9009\u62e9\uff0c\u8bc6\u522b ${state.psdMetadataSourceFiles.length || 0} \u5f20\u56fe\u7247\u3002`);
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  function clearPsdMetadataSourceFile() {
    if (state.busy) {
      return;
    }

    state.psdMetadataSourcePath = '';
    setPsdMetadataSourcePath('');
    addPsdLog('\u5df2\u6e05\u7a7a\u5143\u6570\u636e\u6765\u6e90\u3002');
  }

  async function openPsdMockupOutputDirectory(mockupId) {
    const mockup = getPsdMockupById(mockupId);
    const outputDirectoryPath = normalizeText(mockup && mockup.outputDirectoryPath);
    if (!outputDirectoryPath) {
      return;
    }

    try {
      const result = await getBridge().openDirectory({
        directoryPath: outputDirectoryPath
      });

      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : '\u6253\u5f00\u76ee\u5f55\u5931\u8d25\u3002');
      }

      addPsdLog('\u5df2\u6253\u5f00PSD\u6837\u673a\u5bfc\u51fa\u76ee\u5f55\u3002');
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    }
  }

  async function syncPsdEngineWindowMode() {
    state.psdEngineWindowMode = normalizePsdEngineWindowMode(elements.psdEngineWindowModeSelect && elements.psdEngineWindowModeSelect.value);
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
    if (!state.psdSmartObjectRunning) {
      return;
    }

    try {
      const bridge = getBridge();
      if (!bridge || typeof bridge.setPsdEngineWindowVisible !== 'function') {
        return;
      }
      const result = await bridge.setPsdEngineWindowVisible({
        runId: WINDOW_RUN_ID,
        mode: state.psdEngineWindowMode,
        visible: state.psdEngineWindowMode === 'visible'
      });
      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : 'PSD\u5f15\u64ce\u7a97\u53e3\u5207\u6362\u5931\u8d25\u3002');
      }
      addPsdLog(state.psdEngineWindowMode === 'visible'
        ? 'PSD\u5f15\u64ce\u7a97\u53e3\u5df2\u663e\u793a\u3002'
        : 'PSD\u5f15\u64ce\u7a97\u53e3\u5df2\u9690\u85cf\u3002');
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    }
  }

  function syncPsdEngineConcurrency() {
    state.psdEngineConcurrency = normalizePsdEngineConcurrency(elements.psdEngineConcurrencySelect && elements.psdEngineConcurrencySelect.value);
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
  }

  function syncPsdSkipExistingOutputs() {
    state.psdSkipExistingOutputs = Boolean(elements.psdSkipExistingOutputsCheckbox && elements.psdSkipExistingOutputsCheckbox.checked);
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
  }

  function handlePsdMockupListClick(event) {
    const button = event.target.closest('[data-psd-action]');
    if (!button) {
      return;
    }

    const card = button.closest('[data-psd-mockup-id]');
    const mockupId = card ? card.dataset.psdMockupId : '';
    const action = button.dataset.psdAction;

    if (action === 'select') {
      void selectPsdMockupFile(mockupId);
    } else if (action === 'select-output') {
      void selectPsdMockupOutputDirectory(mockupId);
    } else if (action === 'open-output') {
      void openPsdMockupOutputDirectory(mockupId);
    } else if (action === 'add') {
      addPsdMockup();
    } else if (action === 'remove') {
      removePsdMockup(mockupId);
    }
  }

  function handlePsdMockupListInput(event) {
    const field = event.target.closest('[data-psd-field]');
    if (!field || field.readOnly) {
      return;
    }

    const card = field.closest('[data-psd-mockup-id]');
    const mockupId = card ? card.dataset.psdMockupId : '';
    const fieldName = field.dataset.psdField;
    if (!mockupId || !['smartObjectName', 'sourceRotation', 'replacementMode', 'outputSubdirName', 'exportMode', 'outputFormat', 'imageQuality'].includes(fieldName)) {
      return;
    }

    updatePsdMockup(mockupId, {
      [fieldName]: fieldName === 'imageQuality' ? normalizePsdImageQuality(field.value) : field.value
    }, {
      render: ['exportMode', 'outputFormat'].includes(fieldName)
    });
  }

  function applyPsdTemplate(template) {
    if (!template || typeof template !== 'object') {
      return;
    }

    const templateOutputDirectoryPath = normalizeText(template.outputDirectoryPath);
    const templateExportMode = normalizePsdExportMode(template.exportMode);
    const templateOutputFormat = normalizePsdOutputFormat(template.outputFormat);
    const templateImageQuality = normalizePsdImageQuality(template.imageQuality);
    state.psdSelectedTemplateId = normalizeText(template.id);
    state.psdTemplateName = normalizeText(template.name);
    state.psdDeleteTemplateConfirmId = '';
    state.psdDeleteTemplateConfirmUntil = 0;
    state.psdImageDirectoryPath = normalizeText(template.imageDirectoryPath);
    state.psdOutputDirectoryPath = templateOutputDirectoryPath;
    state.psdExportMode = templateExportMode;
    state.psdOutputFormat = templateOutputFormat;
    state.psdEngineConcurrency = normalizePsdEngineConcurrency(template.engineConcurrency || template.psdEngineConcurrency);
    state.psdSkipExistingOutputs = template.skipExistingOutputs === true || template.psdSkipExistingOutputs === true;
    state.psdMetadataSourcePath = normalizeText(template.metadataSourcePath);
    state.psdMetadataSourceDirectoryPath = normalizeText(template.metadataSourceDirectoryPath);
    state.psdMetadataSourceFiles = [];
    state.psdMockups = Array.isArray(template.mockups) && template.mockups.length
      ? template.mockups.map((mockup, index) => normalizePsdMockup(mockup, index, {
        outputDirectoryPath: templateOutputDirectoryPath,
        exportMode: templateExportMode,
        outputFormat: templateOutputFormat,
        imageQuality: templateImageQuality
      }))
      : [normalizePsdMockup({
        ...createDefaultPsdMockup(0),
        outputDirectoryPath: templateOutputDirectoryPath,
        exportMode: templateExportMode,
        outputFormat: templateOutputFormat,
        imageQuality: templateImageQuality
      }, 0, {
        outputDirectoryPath: templateOutputDirectoryPath,
        exportMode: templateExportMode,
        outputFormat: templateOutputFormat,
        imageQuality: templateImageQuality
      })];
    cacheCurrentPsdSettings();
    updatePsdSmartObjectState();
  }

  async function loadPsdTemplates(preferCloud) {
    try {
      const result = await getBridge().getPsdSmartObjectTemplates({
        preferCloud: Boolean(preferCloud)
      });
      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : 'PSD\u6a21\u677f\u8bfb\u53d6\u5931\u8d25\u3002');
      }

      state.psdTemplates = Array.isArray(result.templates) ? result.templates : [];
      const selectedTemplate = state.psdSelectedTemplateId
        ? state.psdTemplates.find((template) => template.id === state.psdSelectedTemplateId)
        : null;
      if (selectedTemplate && !state.psdTemplateName) {
        state.psdTemplateName = normalizeText(selectedTemplate.name);
      }
      updatePsdSmartObjectState();
      if (preferCloud) {
        addPsdLog(result.cloudSynced ? '\u5df2\u4ece\u4e91\u7aef\u540c\u6b65PSD\u6a21\u677f\u3002' : (result.warning || '\u4e91\u7aef\u6682\u65e0PSD\u6a21\u677f\u3002'));
      }
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    }
  }

  async function loadSelectedPsdTemplate() {
    const templateId = normalizeText(elements.psdTemplateSelect && elements.psdTemplateSelect.value);
    const template = (Array.isArray(state.psdTemplates) ? state.psdTemplates : [])
      .find((item) => item.id === templateId);

    if (!template) {
      addPsdLog('\u8bf7\u5148\u9009\u62e9PSD\u6a21\u677f\u3002', 'error');
      return;
    }

    applyPsdTemplate(template);
    if (state.psdMetadataSourceDirectoryPath) {
      await refreshCachedImageDirectoryFiles('psdMetadataSourceDirectoryPath', 'psdMetadataSourceFiles');
      updatePsdSmartObjectState();
    }
    addPsdLog(`\u5df2\u8bfb\u53d6PSD\u6a21\u677f\uff1a${template.name || ''}`, 'success');
  }

  function handlePsdTemplateSelectChange() {
    const templateId = normalizeText(elements.psdTemplateSelect && elements.psdTemplateSelect.value);
    if (!templateId) {
      state.psdSelectedTemplateId = '';
      state.psdTemplateName = '';
      state.psdDeleteTemplateConfirmId = '';
      state.psdDeleteTemplateConfirmUntil = 0;
      cacheCurrentPsdSettings();
      updatePsdSmartObjectState();
      return;
    }

    void loadSelectedPsdTemplate();
  }

  function syncPsdTemplateName() {
    state.psdTemplateName = normalizeText(elements.psdTemplateNameInput && elements.psdTemplateNameInput.value);
    cacheCurrentPsdSettings();
    updateButtons();
  }

  async function savePsdTemplate() {
    try {
      const currentTemplate = state.psdSelectedTemplateId
        ? ((state.psdTemplates || []).find((item) => item.id === state.psdSelectedTemplateId) || null)
        : null;
      const templateName = normalizeText(state.psdTemplateName)
        || normalizeText(currentTemplate && currentTemplate.name)
        || 'PSD\u667a\u80fd\u5957\u56fe\u6a21\u677f';
      state.psdTemplateName = templateName;

      const result = await getBridge().savePsdSmartObjectTemplate({
        template: {
          ...getPsdTemplatePayload(),
          name: templateName
        }
      });
      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : 'PSD\u6a21\u677f\u4fdd\u5b58\u5931\u8d25\u3002');
      }

      state.psdSelectedTemplateId = result.template && result.template.id ? result.template.id : state.psdSelectedTemplateId;
      state.psdTemplateName = normalizeText(result.template && result.template.name) || templateName;
      state.psdTemplates = Array.isArray(result.templates) ? result.templates : state.psdTemplates;
      state.psdDeleteTemplateConfirmId = '';
      state.psdDeleteTemplateConfirmUntil = 0;
      cacheCurrentPsdSettings();
      updatePsdSmartObjectState();
      addPsdLog(result.cloudSynced ? '\u6a21\u677f\u5df2\u4fdd\u5b58\u5e76\u540c\u6b65\u4e91\u7aef\u3002' : (result.warning || '\u6a21\u677f\u5df2\u4fdd\u5b58\u672c\u5730\u3002'), result.cloudSynced ? 'success' : '');
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    }
  }

  async function deleteSelectedPsdTemplate() {
    if (state.busy || !state.psdSelectedTemplateId) {
      return;
    }

    const now = Date.now();
    if (state.psdDeleteTemplateConfirmId !== state.psdSelectedTemplateId || now >= state.psdDeleteTemplateConfirmUntil) {
      state.psdDeleteTemplateConfirmId = state.psdSelectedTemplateId;
      state.psdDeleteTemplateConfirmUntil = now + 5000;
      updateButtons();
      addPsdLog('\u518d\u6b21\u70b9\u51fb\u5220\u9664\u6a21\u677f\u4ee5\u786e\u8ba4\u3002');
      return;
    }

    try {
      const deletingName = state.psdTemplateName;
      const result = await getBridge().deletePsdSmartObjectTemplate({
        templateId: state.psdSelectedTemplateId
      });
      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : 'PSD\u6a21\u677f\u5220\u9664\u5931\u8d25\u3002');
      }

      state.psdTemplates = Array.isArray(result.templates) ? result.templates : [];
      state.psdSelectedTemplateId = '';
      state.psdTemplateName = '';
      state.psdDeleteTemplateConfirmId = '';
      state.psdDeleteTemplateConfirmUntil = 0;
      cacheCurrentPsdSettings();
      updatePsdSmartObjectState();
      addPsdLog(`\u5df2\u5220\u9664PSD\u6a21\u677f\uff1a${deletingName || ''}`, 'success');
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    }
  }

  async function cancelPsdSmartObjectMockups() {
    if (!state.psdSmartObjectRunning || state.psdSmartObjectCanceling) {
      return;
    }

    state.psdSmartObjectCanceling = true;
    updateButtons();
    setStatus('PSD\u5957\u56fe\u6b63\u5728\u505c\u6b62');
    addPsdLog('PSD\u5957\u56fe\u6b63\u5728\u505c\u6b62\u3002');

    try {
      const result = await getBridge().cancelPsdSmartObjectMockups({
        runId: WINDOW_RUN_ID
      });
      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : 'PSD\u5957\u56fe\u505c\u6b62\u5931\u8d25\u3002');
      }

      addPsdLog(result.message || 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002');
    } catch (error) {
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      state.psdSmartObjectCanceling = false;
      updateButtons();
    }
  }

  function cancelRunningPsdTaskBeforeUnload() {
    if (!state.psdSmartObjectRunning) {
      return;
    }

    try {
      void getBridge().cancelPsdSmartObjectMockups({
        runId: WINDOW_RUN_ID
      });
    } catch (_error) {
      // Closing the window must not be blocked by best-effort cleanup.
    }
  }

  async function runPsdSmartObjectMockups() {
    if (state.psdSmartObjectRunning) {
      await cancelPsdSmartObjectMockups();
      return;
    }

    if (!canRunPsdSmartObject()) {
      return;
    }

    state.psdSmartObjectRunning = true;
    state.psdSmartObjectCanceling = false;
    state.psdProgressStartedAt = Date.now();
    state.psdLastProgress = null;
    state.psdLastProgressLogKey = '';
    state.psdProgressSummary = null;
    setBusy(true);
    setStatus('PSD\u5957\u56fe\u4e2d');
    const runnableMockups = getRunnablePsdMockups();
    const legacyExportDefaults = getPsdLegacyExportDefaults();
    const exportModeCount = new Set(runnableMockups.map((mockup) => mockup.exportMode)).size;
    const outputFormatCount = new Set(runnableMockups.map((mockup) => mockup.outputFormat)).size;
    const startExportModeText = exportModeCount > 1 || outputFormatCount > 1
      ? '\u6837\u673a\u72ec\u7acb\u5bfc\u51fa\u8bbe\u7f6e'
      : `${PSD_EXPORT_MODE_LABELS[runnableMockups[0] && runnableMockups[0].exportMode] || PSD_EXPORT_MODE_LABELS.original}/${String(runnableMockups[0] && runnableMockups[0].outputFormat || 'png').toUpperCase()}`;
    const engineWindowText = state.psdEngineWindowMode === 'visible'
      ? '\u663e\u793a\u5f15\u64ce\u7a97\u53e3'
      : '\u9690\u85cf\u5f15\u64ce\u7a97\u53e3';
    const skipExistingText = state.psdSkipExistingOutputs ? '\u5df2\u5b58\u5728\u8df3\u8fc7' : '\u8986\u76d6\u5bfc\u51fa';
    const runnableMockupCount = runnableMockups.length;
    const engineConcurrencyText = `${getPsdEngineConcurrencyLabel(state.psdEngineConcurrency)}\uff0c\u6700\u591a ${getEstimatedPsdEngineCount(runnableMockupCount, state.psdEngineConcurrency)} \u4e2a\u5f15\u64ce`;
    addPsdLog(`PSD\u667a\u80fd\u5957\u56fe\u5f00\u59cb\uff0c${runnableMockupCount}\u4e2a\u6837\u673a\uff0c${engineConcurrencyText}\uff0c${startExportModeText}\uff0c${skipExistingText}\uff0c${engineWindowText}\u3002`);
    const startedAt = state.psdProgressStartedAt;
    const waitingTimer = setInterval(() => {
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

      if (state.psdLastProgress) {
        setStatus(formatPsdSummaryStatus(state.psdLastProgress));
      } else {
        setStatus(`PSD\u5957\u56fe\u4e2d \u00b7 \u5df2\u7b49\u5f85 ${elapsedSeconds} \u79d2`);
      }
      if (!state.psdLastProgress && elapsedSeconds > 0 && elapsedSeconds % 30 === 0) {
        addPsdLog(`PSD\u6837\u673a\u6b63\u5728\u89e3\u6790\uff0c\u5df2\u7b49\u5f85 ${elapsedSeconds} \u79d2\u3002\u53ef\u5728\u5f39\u51fa\u7684\u5f15\u64ce\u7a97\u53e3\u67e5\u770b\u52a0\u8f7d\u72b6\u6001\u3002`);
      }
    }, 1000);

    try {
      const result = await getBridge().generatePsdSmartObjectMockups({
        runId: WINDOW_RUN_ID,
        psdMockups: runnableMockups,
        imageDirectoryPath: state.psdImageDirectoryPath,
        outputDirectoryPath: legacyExportDefaults.outputDirectoryPath,
        outputFormat: legacyExportDefaults.outputFormat,
        imageQuality: legacyExportDefaults.imageQuality,
        metadataSourcePath: state.psdMetadataSourcePath,
        metadataSourceDirectoryPath: state.psdMetadataSourceDirectoryPath,
        engineConcurrency: state.psdEngineConcurrency,
        skipExistingOutputs: state.psdSkipExistingOutputs,
        showEngineWindow: state.psdEngineWindowMode === 'visible',
        sliceOptions: {
          mode: legacyExportDefaults.exportMode
        }
      });

      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : 'PSD\u667a\u80fd\u5957\u56fe\u5931\u8d25\u3002');
      }

      setStatus('PSD\u5957\u56fe\u5b8c\u6210');
      const outputCountText = `\u6574\u56fe ${result.generatedCount || 0} \u5f20\uff0c\u5207\u7247 ${result.sliceGeneratedCount || 0} \u5f20`;
      addPsdLog(`PSD\u5957\u56fe\u5b8c\u6210\uff1a\u6837\u673a ${result.mockupCount || 0} \u4e2a\uff0c\u8f93\u5165 ${result.totalInputCount || 0} \u5f20\uff0c${outputCountText}\uff0c\u8df3\u8fc7 ${result.skippedCount || 0} \u5f20\uff0c\u5931\u8d25 ${result.failedCount || 0} \u5f20\u3002`, result.failedCount ? '' : 'success');

      (Array.isArray(result.failures) ? result.failures : []).slice(0, 5).forEach((failure) => {
        addPsdLog(`${failure.sourcePath || ''} ${failure.message || ''}`, 'error');
      });
    } catch (error) {
      setStatus('PSD\u5957\u56fe\u5931\u8d25');
      addPsdLog(String(error && error.message || error || ''), 'error');
    } finally {
      clearInterval(waitingTimer);
      state.psdSmartObjectRunning = false;
      state.psdSmartObjectCanceling = false;
      setBusy(false);
    }
  }

  function handleWhiteMockupRegionListClick(event) {
    const button = event.target.closest('[data-region-index]');
    if (!button) {
      return;
    }

    setWhiteMockupActiveRegion(Number(button.dataset.regionIndex));
  }

  function handleWhiteMockupImageLoaded() {
    if (!elements.whiteMockupPreviewImage) {
      return;
    }

    const width = Number(elements.whiteMockupPreviewImage.naturalWidth);
    const height = Number(elements.whiteMockupPreviewImage.naturalHeight);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      const previousSize = getWhiteMockupTemplateSize();
      state.whiteMockupImageNaturalSize = {
        width: Math.round(width),
        height: Math.round(height)
      };

      if (state.whiteMockupTemplateIsDefault) {
        setWhiteMockupTemplate(
          scaleWhiteMockupTemplate(
            state.whiteMockupTemplate || DEFAULT_WHITE_MOCKUP_TEMPLATE,
            previousSize,
            state.whiteMockupImageNaturalSize
          ),
          {
            dirty: state.whiteMockupTemplateDirty,
            isDefault: true
          }
        );
      } else {
        setWhiteMockupTemplate(state.whiteMockupTemplate, {
          raw: true,
          dirty: state.whiteMockupTemplateDirty,
          isDefault: false
        });
      }
    }

    updateWhiteMockupTemplateState();
  }

  function bindWhiteMockupTemplateEditorElements() {
    elements.whiteMockupPreview = document.getElementById('podSuiteWhiteMockupPreview');
    elements.whiteMockupPreviewImage = document.getElementById('podSuiteWhiteMockupPreviewImage');
    elements.whiteMockupPreviewOverlay = document.getElementById('podSuiteWhiteMockupPreviewOverlay');
    elements.whiteMockupOverlaySvg = document.getElementById('podSuiteWhiteMockupOverlaySvg');
    elements.whiteMockupRegionList = document.getElementById('podSuiteWhiteMockupRegionList');
    elements.whiteMockupPointList = document.getElementById('podSuiteWhiteMockupPointList');
    elements.whiteMockupTemplateState = document.getElementById('podSuiteWhiteMockupTemplateState');
    elements.previewDesignPathInput = document.getElementById('podSuitePreviewDesignPath');
    elements.selectPreviewDesignButton = document.getElementById('podSuiteSelectPreviewDesignButton');
    elements.renderWhiteMockupPreviewButton = document.getElementById('podSuiteRenderWhiteMockupPreviewButton');
    elements.clearWhiteMockupPreviewButton = document.getElementById('podSuiteClearWhiteMockupPreviewButton');
    elements.addWhiteMockupRegionButton = document.getElementById('podSuiteAddWhiteMockupRegionButton');
    elements.duplicateWhiteMockupRegionButton = document.getElementById('podSuiteDuplicateWhiteMockupRegionButton');
    elements.deleteWhiteMockupRegionButton = document.getElementById('podSuiteDeleteWhiteMockupRegionButton');
    elements.autoWhiteMockupRegionButton = document.getElementById('podSuiteAutoWhiteMockupRegionButton');
    elements.saveWhiteMockupTemplateButton = document.getElementById('podSuiteSaveWhiteMockupTemplateButton');
    elements.resetWhiteMockupTemplateButton = document.getElementById('podSuiteResetWhiteMockupTemplateButton');

    if (elements.whiteMockupPreviewImage) {
      elements.whiteMockupPreviewImage.addEventListener('load', handleWhiteMockupImageLoaded);
      if (elements.whiteMockupPreviewImage.complete) {
        handleWhiteMockupImageLoaded();
      }
    }

    if (elements.whiteMockupOverlaySvg) {
      elements.whiteMockupOverlaySvg.addEventListener('pointerdown', startWhiteMockupDrag);
    }

    if (elements.whiteMockupRegionList) {
      elements.whiteMockupRegionList.addEventListener('click', handleWhiteMockupRegionListClick);
    }

    if (elements.selectPreviewDesignButton) {
      elements.selectPreviewDesignButton.addEventListener('click', selectPreviewDesignFile);
    }

    if (elements.renderWhiteMockupPreviewButton) {
      elements.renderWhiteMockupPreviewButton.addEventListener('click', renderWhiteMockupPreview);
    }

    if (elements.clearWhiteMockupPreviewButton) {
      elements.clearWhiteMockupPreviewButton.addEventListener('click', clearWhiteMockupPreview);
    }

    if (elements.addWhiteMockupRegionButton) {
      elements.addWhiteMockupRegionButton.addEventListener('click', addWhiteMockupRegion);
    }

    if (elements.duplicateWhiteMockupRegionButton) {
      elements.duplicateWhiteMockupRegionButton.addEventListener('click', duplicateWhiteMockupRegion);
    }

    if (elements.deleteWhiteMockupRegionButton) {
      elements.deleteWhiteMockupRegionButton.addEventListener('click', deleteWhiteMockupRegion);
    }

    if (elements.autoWhiteMockupRegionButton) {
      elements.autoWhiteMockupRegionButton.addEventListener('click', createWhiteMockupRegionFromMask);
    }

    if (elements.saveWhiteMockupTemplateButton) {
      elements.saveWhiteMockupTemplateButton.addEventListener('click', saveWhiteMockupTemplate);
    }

    if (elements.resetWhiteMockupTemplateButton) {
      elements.resetWhiteMockupTemplateButton.addEventListener('click', resetWhiteMockupTemplate);
    }
  }

  function clearWhiteMockupTemplateEditorElements() {
    elements.whiteMockupPreview = null;
    elements.whiteMockupPreviewImage = null;
    elements.whiteMockupPreviewOverlay = null;
    elements.whiteMockupOverlaySvg = null;
    elements.whiteMockupRegionList = null;
    elements.whiteMockupPointList = null;
    elements.whiteMockupTemplateState = null;
    elements.previewDesignPathInput = null;
    elements.selectPreviewDesignButton = null;
    elements.renderWhiteMockupPreviewButton = null;
    elements.clearWhiteMockupPreviewButton = null;
    elements.addWhiteMockupRegionButton = null;
    elements.duplicateWhiteMockupRegionButton = null;
    elements.deleteWhiteMockupRegionButton = null;
    elements.autoWhiteMockupRegionButton = null;
    elements.saveWhiteMockupTemplateButton = null;
    elements.resetWhiteMockupTemplateButton = null;
  }

  function renderTargets() {
    if (!state.whiteMockupPath) {
      clearWhiteMockupTemplateEditorElements();
      elements.targetList.innerHTML = `
        <div class="pod-suite-empty">\u9009\u62e9\u767d\u819c\u56fe\u7247\u540e\u7f16\u8f91\u8bbe\u8ba1\u533a\u57df</div>
      `;
      return;
    }

    elements.targetList.innerHTML = `
      <div class="pod-suite-template-editor">
        <div class="pod-suite-template-preview" id="podSuiteWhiteMockupPreview">
          <img id="podSuiteWhiteMockupPreviewImage" src="${escapeHtml(getWhiteMockupPreviewImageSrc())}" alt="" />
          <div class="pod-suite-template-overlay" id="podSuiteWhiteMockupPreviewOverlay">
            <svg id="podSuiteWhiteMockupOverlaySvg" aria-hidden="true"></svg>
          </div>
        </div>
        <label class="pod-suite-field pod-suite-template-preview-source">
          <span>\u9884\u89c8\u7d20\u6750\u56fe</span>
          <div class="pod-suite-picker-row pod-suite-picker-row-preview">
            <input id="podSuitePreviewDesignPath" type="text" readonly />
            <button id="podSuiteSelectPreviewDesignButton" class="pod-suite-secondary-button" type="button">
              \u9009\u62e9
            </button>
            <button id="podSuiteRenderWhiteMockupPreviewButton" class="pod-suite-secondary-button" type="button">
              \u5237\u65b0\u9884\u89c8
            </button>
            <button id="podSuiteClearWhiteMockupPreviewButton" class="pod-suite-secondary-button" type="button">
              \u6e05\u7a7a
            </button>
          </div>
        </label>
        <div class="pod-suite-template-toolbar">
          <div class="pod-suite-template-state" id="podSuiteWhiteMockupTemplateState">\u672a\u9009\u62e9\u767d\u819c\u56fe\u7247</div>
          <div class="pod-suite-template-actions">
            <button id="podSuiteAddWhiteMockupRegionButton" class="pod-suite-secondary-button" type="button">
              \u65b0\u589e\u533a\u57df
            </button>
            <button id="podSuiteDuplicateWhiteMockupRegionButton" class="pod-suite-secondary-button" type="button">
              \u590d\u5236\u533a\u57df
            </button>
            <button id="podSuiteDeleteWhiteMockupRegionButton" class="pod-suite-secondary-button" type="button">
              \u5220\u9664\u533a\u57df
            </button>
            <button id="podSuiteAutoWhiteMockupRegionButton" class="pod-suite-secondary-button" type="button">
              \u7528\u8499\u7248\u5f62\u72b6
            </button>
            <button id="podSuiteResetWhiteMockupTemplateButton" class="pod-suite-secondary-button" type="button">
              \u91cd\u7f6e
            </button>
            <button id="podSuiteSaveWhiteMockupTemplateButton" class="pod-suite-secondary-button" type="button">
              \u4fdd\u5b58\u6a21\u677f
            </button>
          </div>
        </div>
        <div class="pod-suite-template-region-list" id="podSuiteWhiteMockupRegionList"></div>
        <div class="pod-suite-template-point-list" id="podSuiteWhiteMockupPointList"></div>
      </div>
    `;
    bindWhiteMockupTemplateEditorElements();
    updateWhiteMockupTemplateState();
  }

  function updateInputs() {
    elements.whiteMockupPathInput.value = state.whiteMockupPath;
    elements.maskImagePathInput.value = getWhiteMockupMaskImagePath();
    elements.textureImagePathInput.value = getWhiteMockupTextureImagePath();
    elements.imageDirectoryPathInput.value = state.imageDirectoryPath;
    elements.outputDirectoryPathInput.value = state.outputDirectoryPath;
    updateMetrics();
    updateButtons();
    updateWhiteMockupTemplateState();
  }

  async function loadWhiteMockupTemplate() {
    if (!state.whiteMockupPath) {
      state.whiteMockupActiveRegionIndex = 0;
      setWhiteMockupTemplate(createDefaultWhiteMockupTemplate(), {
        dirty: false,
        isDefault: true
      });
      return;
    }

    try {
      const result = await getBridge().getWhiteMockupTemplate({
        mockupPath: state.whiteMockupPath
      });

      if (!result || result.success !== true || !result.template) {
        throw new Error(result && result.message ? result.message : '\u8bfb\u53d6\u767d\u819c\u533a\u57df\u5931\u8d25\u3002');
      }

      state.whiteMockupActiveRegionIndex = 0;
      setWhiteMockupTemplate(result.template, {
        raw: true,
        dirty: false,
        isDefault: result.isDefault === true
      });
      renderTargets();
      updateInputs();
      addLog(result.isDefault === true ? '\u5df2\u4f7f\u7528\u9ed8\u8ba4\u767d\u819c\u533a\u57df\u3002' : '\u5df2\u8bfb\u53d6\u8fd9\u5f20\u767d\u819c\u7684\u4fdd\u5b58\u533a\u57df\u3002');
    } catch (error) {
      state.whiteMockupActiveRegionIndex = 0;
      setWhiteMockupTemplate(createDefaultWhiteMockupTemplate(), {
        dirty: false,
        isDefault: true
      });
      renderTargets();
      updateInputs();
      addLog(String(error && error.message || error || ''), 'error');
    }
  }

  async function selectWhiteMockup() {
    setBusy(true);
    try {
      const result = await getBridge().selectWhiteMockupFile({
        defaultPath: state.whiteMockupPath
      });

      if (!result || result.canceled === true || !result.filePath) {
        return;
      }

      state.whiteMockupPath = result.filePath;
      clearWhiteMockupPreviewData();
      state.whiteMockupImageNaturalSize = {
        width: 0,
        height: 0
      };
      state.whiteMockupActiveRegionIndex = 0;
      cacheCurrentWhiteMockupSettings();
      setWhiteMockupTemplate(createDefaultWhiteMockupTemplate(), {
        dirty: false,
        isDefault: true
      });
      addLog('\u5df2\u9009\u62e9\u767d\u819c\u56fe\u7247\u3002');
      await loadWhiteMockupTemplate();
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectTextureImage() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    setBusy(true);
    try {
      const result = await getBridge().selectTextureImageFile({
        defaultPath: getWhiteMockupTextureImagePath() || state.whiteMockupPath
      });

      if (!result || result.canceled === true || !result.filePath) {
        return;
      }

      updateWhiteMockupTemplatePatch({
        textureImagePath: result.filePath
      });
      addLog('\u5df2\u9009\u62e9\u7eb9\u7406/\u906e\u6321\u56fe\uff0c\u4fdd\u5b58\u540e\u4f1a\u8ddf\u8fd9\u5f20\u767d\u819c\u7ed1\u5b9a\u3002');
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectMaskImage() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    setBusy(true);
    try {
      const result = await getBridge().selectMaskImageFile({
        defaultPath: getWhiteMockupMaskImagePath() || state.whiteMockupPath
      });

      if (!result || result.canceled === true || !result.filePath) {
        return;
      }

      updateWhiteMockupTemplatePatch({
        maskImagePath: result.filePath
      });
      addLog('\u5df2\u9009\u62e9\u5370\u82b1\u8499\u7248\u56fe\uff0c\u4fdd\u5b58\u540e\u4f1a\u8ddf\u8fd9\u5f20\u767d\u819c\u7ed1\u5b9a\u3002');
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  function clearTextureImage() {
    if (state.busy || !getWhiteMockupTextureImagePath()) {
      return;
    }

    updateWhiteMockupTemplatePatch({
      textureImagePath: ''
    });
    addLog('\u5df2\u6e05\u7a7a\u7eb9\u7406/\u906e\u6321\u56fe\uff0c\u4fdd\u5b58\u540e\u751f\u6548\u3002');
  }

  function clearMaskImage() {
    if (state.busy || !getWhiteMockupMaskImagePath()) {
      return;
    }

    updateWhiteMockupTemplatePatch({
      maskImagePath: ''
    });
    addLog('\u5df2\u6e05\u7a7a\u5370\u82b1\u8499\u7248\u56fe\uff0c\u4fdd\u5b58\u540e\u751f\u6548\u3002');
  }

  async function selectImageDirectory() {
    setBusy(true);
    try {
      const result = await getBridge().selectImageDirectory({
        defaultPath: state.imageDirectoryPath
      });

      if (!result || result.canceled === true || !result.directoryPath) {
        return;
      }

      state.imageDirectoryPath = result.directoryPath;
      state.imageFiles = Array.isArray(result.files) ? result.files : [];
      if (!state.previewDesignPath && state.imageFiles.length && state.imageFiles[0].filePath) {
        state.previewDesignPath = state.imageFiles[0].filePath;
        clearWhiteMockupPreviewData();
      }
      cacheCurrentWhiteMockupSettings();
      updateInputs();
      addLog(`\u5df2\u9009\u62e9\u56fe\u7247\u76ee\u5f55\uff0c\u8bc6\u522b ${state.imageFiles.length} \u5f20\u56fe\u7247\u3002`);
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function selectOutputDirectory() {
    setBusy(true);
    try {
      const result = await getBridge().selectOutputDirectory({
        defaultPath: state.outputDirectoryPath
      });

      if (!result || result.canceled === true || !result.directoryPath) {
        return;
      }

      state.outputDirectoryPath = result.directoryPath;
      cacheCurrentWhiteMockupSettings();
      updateInputs();
      addLog('\u5df2\u9009\u62e9\u5bfc\u51fa\u76ee\u5f55\u3002');
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveWhiteMockupTemplate() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    setBusy(true);
    try {
      const result = await getBridge().saveWhiteMockupTemplate({
        mockupPath: state.whiteMockupPath,
        template: getWhiteMockupTemplatePayload()
      });

      if (!result || result.success !== true || !result.template) {
        throw new Error(result && result.message ? result.message : '\u4fdd\u5b58\u767d\u819c\u6a21\u677f\u5931\u8d25\u3002');
      }

      setWhiteMockupTemplate(result.template, {
        raw: true,
        dirty: false,
        isDefault: false
      });
      updateInputs();
      addLog('\u767d\u819c\u6a21\u677f\u5df2\u4fdd\u5b58\u3002', 'success');
    } catch (error) {
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  function resetWhiteMockupTemplate() {
    if (!state.whiteMockupPath || state.busy) {
      return;
    }

    setWhiteMockupTemplate(createDefaultWhiteMockupTemplate(), {
      dirty: true,
      isDefault: true
    });
    state.whiteMockupActiveRegionIndex = 0;
    updateInputs();
    addLog('\u5df2\u91cd\u7f6e\u4e3a\u9ed8\u8ba4\u8bbe\u8ba1\u533a\u57df\uff0c\u4fdd\u5b58\u540e\u751f\u6548\u3002');
  }

  async function generateWhiteMockups() {
    if (!canGenerate()) {
      return;
    }

    setBusy(true);
    setStatus('\u6b63\u5728\u5957\u56fe');
    addLog('\u5f00\u59cb\u767d\u819c\u6279\u91cf\u5957\u56fe\u3002');

    try {
      const result = await getBridge().generateWhiteMockups({
        mockupPath: state.whiteMockupPath,
        imageDirectoryPath: state.imageDirectoryPath,
        outputDirectoryPath: state.outputDirectoryPath,
        outputFormat: elements.outputFormat.value,
        jpegQuality: elements.jpegQuality.value,
        template: getWhiteMockupTemplatePayload()
      });

      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : '\u5957\u56fe\u5931\u8d25\u3002');
      }

      setStatus('\u5957\u56fe\u5b8c\u6210');
      addLog(`\u5957\u56fe\u5b8c\u6210\uff1a\u8f93\u5165 ${result.totalInputCount || 0} \u5f20\uff0c\u5bfc\u51fa ${result.generatedCount || 0} \u5f20\uff0c\u5931\u8d25 ${result.failedCount || 0} \u5f20\u3002`, result.failedCount ? '' : 'success');

      (Array.isArray(result.failures) ? result.failures : []).slice(0, 5).forEach((failure) => {
        addLog(`${failure.sourcePath || ''} ${failure.message || ''}`, 'error');
      });
    } catch (error) {
      setStatus('\u5957\u56fe\u5931\u8d25');
      addLog(String(error && error.message || error || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  function handleWindowResize() {
    renderWhiteMockupTemplateOverlay();
  }

  function initElements() {
    elements.status = document.getElementById('podSuiteStatus');
    elements.modeTabs = Array.from(document.querySelectorAll('[data-pod-suite-mode]'));
    elements.modePages = Array.from(document.querySelectorAll('[data-pod-suite-page]'));
    elements.whiteMockupPathInput = document.getElementById('podSuiteWhiteMockupPath');
    elements.maskImagePathInput = document.getElementById('podSuiteMaskImagePath');
    elements.textureImagePathInput = document.getElementById('podSuiteTextureImagePath');
    elements.imageDirectoryPathInput = document.getElementById('podSuiteImageDirectoryPath');
    elements.outputDirectoryPathInput = document.getElementById('podSuiteOutputDirectoryPath');
    elements.selectWhiteMockupButton = document.getElementById('podSuiteSelectWhiteMockupButton');
    elements.selectMaskImageButton = document.getElementById('podSuiteSelectMaskImageButton');
    elements.clearMaskImageButton = document.getElementById('podSuiteClearMaskImageButton');
    elements.selectTextureImageButton = document.getElementById('podSuiteSelectTextureImageButton');
    elements.clearTextureImageButton = document.getElementById('podSuiteClearTextureImageButton');
    elements.selectImageDirectoryButton = document.getElementById('podSuiteSelectImageDirectoryButton');
    elements.selectOutputDirectoryButton = document.getElementById('podSuiteSelectOutputDirectoryButton');
    elements.generateButton = document.getElementById('podSuiteGenerateButton');
    elements.outputFormat = document.getElementById('podSuiteOutputFormat');
    elements.jpegQuality = document.getElementById('podSuiteJpegQuality');
    elements.targetList = document.getElementById('podSuiteTargetList');
    elements.baseMetricLabel = document.getElementById('podSuiteBaseMetricLabel');
    elements.targetMetricLabel = document.getElementById('podSuiteTargetMetricLabel');
    elements.baseMetric = document.getElementById('podSuiteBaseMetric');
    elements.templateMetric = document.getElementById('podSuiteTemplateMetric');
    elements.imageMetric = document.getElementById('podSuiteImageMetric');
    elements.regionMetric = document.getElementById('podSuiteRegionMetric');
    elements.psdTemplateSelect = document.getElementById('podSuitePsdTemplateSelect');
    elements.psdTemplateNameInput = document.getElementById('podSuitePsdTemplateName');
    elements.loadPsdTemplateButton = document.getElementById('podSuiteLoadPsdTemplateButton');
    elements.syncPsdTemplateButton = document.getElementById('podSuiteSyncPsdTemplateButton');
    elements.savePsdTemplateButton = document.getElementById('podSuiteSavePsdTemplateButton');
    elements.deletePsdTemplateButton = document.getElementById('podSuiteDeletePsdTemplateButton');
    elements.psdMockupList = document.getElementById('podSuitePsdMockupList');
    elements.psdImageDirectoryPathInput = document.getElementById('podSuitePsdImageDirectoryPath');
    elements.selectPsdImageDirectoryButton = document.getElementById('podSuiteSelectPsdImageDirectoryButton');
    elements.psdMetadataSourcePathInput = document.getElementById('podSuitePsdMetadataSourcePath');
    elements.selectPsdMetadataSourceButton = document.getElementById('podSuiteSelectPsdMetadataSourceButton');
    elements.selectPsdMetadataSourceDirectoryButton = document.getElementById('podSuiteSelectPsdMetadataSourceDirectoryButton');
    elements.clearPsdMetadataSourceButton = document.getElementById('podSuiteClearPsdMetadataSourceButton');
    elements.psdEngineWindowModeSelect = document.getElementById('podSuitePsdEngineWindowMode');
    elements.psdEngineConcurrencySelect = document.getElementById('podSuitePsdEngineConcurrency');
    elements.psdSkipExistingOutputsCheckbox = document.getElementById('podSuitePsdSkipExistingOutputs');
    elements.runPsdSmartObjectButton = document.getElementById('podSuiteRunPsdSmartObjectButton');
    elements.psdCompactSummary = document.getElementById('podSuitePsdCompactSummary');
    elements.log = document.getElementById('podSuiteLog');
    elements.psdLog = document.getElementById('podSuitePsdLog');
  }

  async function init() {
    initElements();
    if (Array.isArray(elements.modeTabs)) {
      elements.modeTabs.forEach((button) => {
        button.addEventListener('click', handleModeTabClick);
      });
    }
    elements.selectWhiteMockupButton.addEventListener('click', selectWhiteMockup);
    elements.selectMaskImageButton.addEventListener('click', selectMaskImage);
    elements.clearMaskImageButton.addEventListener('click', clearMaskImage);
    elements.selectTextureImageButton.addEventListener('click', selectTextureImage);
    elements.clearTextureImageButton.addEventListener('click', clearTextureImage);
    elements.selectImageDirectoryButton.addEventListener('click', selectImageDirectory);
    elements.selectOutputDirectoryButton.addEventListener('click', selectOutputDirectory);
    elements.generateButton.addEventListener('click', generateWhiteMockups);
    if (elements.outputFormat) {
      elements.outputFormat.addEventListener('change', syncWhiteMockupOutputSettings);
    }
    if (elements.jpegQuality) {
      elements.jpegQuality.addEventListener('input', syncWhiteMockupOutputSettings);
      elements.jpegQuality.addEventListener('change', syncWhiteMockupOutputSettings);
    }
    if (elements.loadPsdTemplateButton) {
      elements.loadPsdTemplateButton.addEventListener('click', () => {
        void loadSelectedPsdTemplate();
      });
    }
    if (elements.psdTemplateSelect) {
      elements.psdTemplateSelect.addEventListener('change', handlePsdTemplateSelectChange);
    }
    if (elements.psdTemplateNameInput) {
      elements.psdTemplateNameInput.addEventListener('input', syncPsdTemplateName);
      elements.psdTemplateNameInput.addEventListener('change', syncPsdTemplateName);
    }
    if (elements.syncPsdTemplateButton) {
      elements.syncPsdTemplateButton.addEventListener('click', () => loadPsdTemplates(true));
    }
    if (elements.savePsdTemplateButton) {
      elements.savePsdTemplateButton.addEventListener('click', savePsdTemplate);
    }
    if (elements.deletePsdTemplateButton) {
      elements.deletePsdTemplateButton.addEventListener('click', deleteSelectedPsdTemplate);
    }
    if (elements.psdMockupList) {
      elements.psdMockupList.addEventListener('click', handlePsdMockupListClick);
      elements.psdMockupList.addEventListener('input', handlePsdMockupListInput);
      elements.psdMockupList.addEventListener('change', handlePsdMockupListInput);
    }
    if (elements.selectPsdImageDirectoryButton) {
      elements.selectPsdImageDirectoryButton.addEventListener('click', selectPsdImageDirectory);
    }
    if (elements.selectPsdMetadataSourceButton) {
      elements.selectPsdMetadataSourceButton.addEventListener('click', selectPsdMetadataSourceFile);
    }
    if (elements.selectPsdMetadataSourceDirectoryButton) {
      elements.selectPsdMetadataSourceDirectoryButton.addEventListener('click', selectPsdMetadataSourceDirectory);
    }
    if (elements.clearPsdMetadataSourceButton) {
      elements.clearPsdMetadataSourceButton.addEventListener('click', clearPsdMetadataSourceFile);
    }
    if (elements.psdEngineWindowModeSelect) {
      elements.psdEngineWindowModeSelect.addEventListener('change', syncPsdEngineWindowMode);
    }
    if (elements.psdEngineConcurrencySelect) {
      elements.psdEngineConcurrencySelect.addEventListener('change', syncPsdEngineConcurrency);
    }
    if (elements.psdSkipExistingOutputsCheckbox) {
      elements.psdSkipExistingOutputsCheckbox.addEventListener('change', syncPsdSkipExistingOutputs);
    }
    if (elements.runPsdSmartObjectButton) {
      elements.runPsdSmartObjectButton.addEventListener('click', runPsdSmartObjectMockups);
    }
    const bridge = getBridge();
    if (bridge && typeof bridge.onPsdSmartObjectProgress === 'function') {
      state.unsubscribePsdProgress = bridge.onPsdSmartObjectProgress(handlePsdSmartObjectProgress);
    }
    window.addEventListener('beforeunload', () => {
      if (typeof state.unsubscribePsdProgress === 'function') {
        state.unsubscribePsdProgress();
        state.unsubscribePsdProgress = null;
      }
      cancelRunningPsdTaskBeforeUnload();
    });
    window.addEventListener('resize', handleWindowResize);
    setWhiteMockupTemplate(createDefaultWhiteMockupTemplate(), {
      dirty: false,
      isDefault: true
    });
    setActiveMode('white-mockup');
    renderTargets();
    updateInputs();
    updatePsdSmartObjectState();
    await restoreCachedRuntimeState();
    await loadPsdTemplates(false);
    updateInputs();
    updatePsdSmartObjectState();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
