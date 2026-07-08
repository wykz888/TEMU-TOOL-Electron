(function initPodUploadSheetMiaoshouUniversalWindow() {
  const TITLE_MAX_LENGTH = 255;
  const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
  const UNIVERSAL_TEMPLATE_ID = 'universal';
  const COS_UPLOAD_STOP_GUARD_MS = 1000;
  const COS_UPLOAD_PROGRESS_POLL_MS = 700;
  const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze(['original', 'jpg', 'webp']);

  const MATERIAL_SECTIONS = Object.freeze([
    { id: 'carousel', title: '\u4e3b\u56fe' },
    { id: 'assets', title: '\u8be6\u60c5\u56fe' },
    { id: 'preview', title: '\u5c3a\u5bf8\u56fe\u8868' }
  ]);

  const DEFAULT_PRODUCT_FIELDS = Object.freeze({
    localName: '',
    mainNumber: '',
    sourceFolder: '',
    sourceCategory: '',
    customAttributes: '',
    mainVideo: '',
    certificate: '',
    sizeChart: '',
    description: '',
    descriptionImageOrders: '',
    title: '',
    specValueOne: '',
    specValueTwo: '',
    declaredPrice: '',
    skuImage: '',
    platformSku: '',
    stock: '',
    skuWeightKg: '',
    skuSize: '',
    aiTitlePrefix: '',
    aiTitleSuffix: '',
    aiTitleLanguage: 'zh',
    aiTitleZh: '',
    aiTitleEn: '',
    aiTitleStatus: '',
    aiTitleError: '',
    aiTitlePatternSummary: '',
    aiTitleUpdatedAt: ''
  });

  const GLOBAL_PRODUCT_FIELD_NAMES = Object.freeze([
    'sourceCategory',
    'customAttributes',
    'mainVideo',
    'certificate',
    'sizeChart',
    'description',
    'aiTitlePrefix',
    'aiTitleSuffix',
    'aiTitleLanguage',
    'specValueOne',
    'specValueTwo'
  ]);

  const DEFAULT_GLOBAL_PRODUCT_SETTINGS = Object.freeze(
    GLOBAL_PRODUCT_FIELD_NAMES.reduce((settings, fieldName) => {
      settings[fieldName] = DEFAULT_PRODUCT_FIELDS[fieldName];
      return settings;
    }, {})
  );

  const FORM_TEMPLATE_FIELD_NAMES = Object.freeze([
    ...GLOBAL_PRODUCT_FIELD_NAMES,
    'aiTitleExtraPrompt',
    'aiTitleMaxLength'
  ]);

  const SKU_CONFIG_FIELD_NAMES = Object.freeze([
    'declaredPrice',
    'skuImage',
    'platformSku',
    'stock',
    'skuWeightKg',
    'skuSize'
  ]);

  const state = {
    snapshot: {
      updatedAt: '',
      templates: []
    },
    loadingSnapshot: false,
    formTemplateSnapshot: {
      updatedAt: '',
      templates: []
    },
    loadingFormTemplateSnapshot: false,
    savingFormTemplate: false,
    deletingFormTemplate: false,
    selectedFormTemplateId: '',
    formTemplateDropdownOpen: false,
    workspaceStateHydrated: false,
    loadingWorkspaceState: false,
    savingWorkspaceState: false,
    workspaceStateSaveTimer: 0,
    workspaceStateSavePromise: null,
    lastImportDirectoryPath: '',
    imageUploadMode: 'original',
    aiTitlePrefix: '',
    aiTitleSuffix: '',
    aiTitleExtraPrompt: '',
    aiTitleMaxLength: '',
    aiTitleLanguage: 'zh',
    generatingAiTitles: false,
    stoppingAiTitles: false,
    retryingFailedAiTitles: false,
    aiTitleRunId: '',
    aiTitleProgress: createAiTitleProgressSnapshot(),
    removeAiTitleProgressListener: null,
    globalProductSettings: {
      ...DEFAULT_GLOBAL_PRODUCT_SETTINGS,
      skuConfigMap: {}
    },
    products: [],
    activeProductId: '',
    carouselPresetModalOpen: false,
    carouselPresetMode: 'selected',
    carouselPresetSelectionDraft: [],
    carouselPresetRandomOrdersDraft: '',
    carouselPresetCachedMode: 'selected',
    carouselPresetCachedSelection: [],
    carouselPresetCachedRandomOrders: '',
    descriptionPresetModalOpen: false,
    descriptionPresetSelectionDraft: [],
    descriptionPresetCachedSelection: [],
    uploadingCosImages: false,
    stoppingCosImages: false,
    cosUploadRunId: '',
    cosUploadStopGuardUntil: 0,
    cosUploadStopGuardTimer: 0,
    cosUploadProgressPollTimer: 0,
    exportingTable: false,
    cosUploadSnapshot: createCosUploadProgressSnapshot(),
    windowNoticeTimer: 0,
    eventsBound: false,
    lastCosUploadButtonEventStamp: 0,
    lastAiTitleButtonEventStamp: 0
  };

  function createAiTitleProgressSnapshot(overrides = {}) {
    return {
      runId: normalizeText(overrides.runId),
      runState: normalizeText(overrides.runState),
      updatedAt: normalizeText(overrides.updatedAt),
      totalCount: Math.max(0, Number(overrides.totalCount) || 0),
      completedCount: Math.max(0, Number(overrides.completedCount) || 0),
      successCount: Math.max(0, Number(overrides.successCount) || 0),
      failedCount: Math.max(0, Number(overrides.failedCount) || 0),
      canceledCount: Math.max(0, Number(overrides.canceledCount) || 0),
      productId: normalizeText(overrides.productId),
      label: normalizeText(overrides.label)
    };
  }

  function createCosUploadProgressSnapshot(overrides = {}) {
    return {
      runState: normalizeText(overrides.runState) || 'idle',
      updatedAt: normalizeText(overrides.updatedAt),
      totalCount: Math.max(0, Number(overrides.totalCount) || 0),
      completedCount: Math.max(0, Number(overrides.completedCount) || 0),
      successCount: Math.max(0, Number(overrides.successCount) || 0),
      uploadedCount: Math.max(0, Number(overrides.uploadedCount) || 0),
      cachedCount: Math.max(0, Number(overrides.cachedCount) || 0),
      failedCount: Math.max(0, Number(overrides.failedCount) || 0),
      canceledCount: Math.max(0, Number(overrides.canceledCount) || 0),
      canceled: Boolean(overrides.canceled),
      label: normalizeText(overrides.label)
    };
  }

  function getFeatureCenterBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouUniversalTemplateSnapshot === 'function'
      && typeof window.temuApp.featureCenter.syncPodUploadSheetMiaoshouUniversalTemplates === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouUniversalFormTemplates === 'function'
      && typeof window.temuApp.featureCenter.savePodUploadSheetMiaoshouUniversalFormTemplate === 'function'
      && typeof window.temuApp.featureCenter.deletePodUploadSheetMiaoshouUniversalFormTemplate === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouUniversalWorkspaceState === 'function'
      && typeof window.temuApp.featureCenter.savePodUploadSheetMiaoshouUniversalWorkspaceState === 'function'
      && typeof window.temuApp.featureCenter.selectPodUploadSheetMiaoshouUniversalImportDirectory === 'function'
      && typeof window.temuApp.featureCenter.exportPodUploadSheetMiaoshouUniversalTable === 'function'
      && typeof window.temuApp.featureCenter.uploadPodUploadSheetMiaoshouUniversalCosImages === 'function'
      && typeof window.temuApp.featureCenter.cancelPodUploadSheetMiaoshouUniversalCosImages === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouAiTitleConfig === 'function'
      && typeof window.temuApp.featureCenter.savePodUploadSheetMiaoshouAiTitleConfig === 'function'
      && typeof window.temuApp.featureCenter.generatePodUploadSheetMiaoshouAiTitles === 'function'
      && typeof window.temuApp.featureCenter.cancelPodUploadSheetMiaoshouAiTitles === 'function'
      && typeof window.temuApp.featureCenter.onPodUploadSheetMiaoshouAiTitleProgress === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    throw new Error('\u672a\u627e\u5230 POD \u4e0a\u8d27\u8868\u683c\uff08\u5999\u624b\u901a\u7528\u7248\uff09\u7684\u6e32\u67d3\u8fdb\u7a0b\u6865\u63a5\u63a5\u53e3');
  }

  function getFeatureCenterCosUploadBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.uploadPodUploadSheetMiaoshouUniversalCosImages === 'function'
      && typeof window.temuApp.featureCenter.cancelPodUploadSheetMiaoshouUniversalCosImages === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    throw new Error('\u672a\u627e\u5230 POD \u4e0a\u8d27\u8868\u683c\uff08\u5999\u624b\u901a\u7528\u7248\uff09\u7684\u56fe\u7247\u4e0a\u4f20\u6865\u63a5\u63a5\u53e3');
  }

  function getDialogBridge() {
    if (
      window.temuApp
      && window.temuApp.dialogs
      && typeof window.temuApp.dialogs.confirm === 'function'
    ) {
      return window.temuApp.dialogs;
    }

    throw new Error('\u672a\u627e\u5230\u901a\u7528\u786e\u8ba4\u5f39\u7a97\u6865\u63a5\u63a5\u53e3');
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function trimTitleTail(value) {
    let result = normalizeText(value).replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '');
    const tailMatch = result.match(/([A-Za-z]{1,2})$/u);
    const previousCharacter = tailMatch ? result.slice(0, -tailMatch[1].length).slice(-1) : '';

    if (tailMatch && /[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]/u.test(previousCharacter)) {
      result = result.slice(0, -tailMatch[1].length)
        .replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '');
    }

    return result.trim();
  }

  function normalizeAiTitleLengthInput(value) {
    const text = normalizeText(value);

    if (!text) {
      return '';
    }

    const parsedValue = Number.parseInt(text, 10);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return '';
    }

    return String(Math.min(TITLE_MAX_LENGTH, parsedValue));
  }

  function getExplicitAiTitleLengthLimit() {
    const normalizedValue = normalizeAiTitleLengthInput(state.aiTitleMaxLength);

    if (!normalizedValue) {
      return null;
    }

    return Number.parseInt(normalizedValue, 10) || null;
  }

  function normalizeTitleFieldValue(value, maxLength = TITLE_MAX_LENGTH) {
    const normalizedValue = normalizeText(value);
    const safeMaxLength = Math.max(0, Math.min(Number(maxLength) || 0, TITLE_MAX_LENGTH));

    if (!normalizedValue || safeMaxLength <= 0) {
      return '';
    }

    const characters = Array.from(normalizedValue);

    if (characters.length <= safeMaxLength) {
      return normalizedValue;
    }

    return trimTitleTail(characters.slice(0, safeMaxLength).join(''));
  }

  function getTitleCharacterCount(value, maxLength = TITLE_MAX_LENGTH) {
    return Array.from(normalizeTitleFieldValue(value, maxLength)).length;
  }

  function formatTitleCharacterCount(value, maxLength = TITLE_MAX_LENGTH) {
    const safeMaxLength = Math.max(0, Math.min(Number(maxLength) || 0, TITLE_MAX_LENGTH));
    return `${getTitleCharacterCount(value, safeMaxLength)} / ${safeMaxLength}`;
  }

  function normalizePositiveIntegerString(value) {
    const text = normalizeText(value);

    if (!text || !/^\d+$/.test(text)) {
      return '';
    }

    const numericValue = Number.parseInt(text, 10);
    return numericValue > 0 ? String(numericValue) : '';
  }

  function normalizeSkuMultilineValue(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[,\uFF0C\u3001]+/g, '\n')
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('\n');
  }

  function normalizeSequenceSelection(value) {
    const values = String(value || '')
      .replace(/\r\n/g, '\n')
      .split(/[\n,;\uFF0C\u3001\uFF1B\s]+/)
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return Array.from(new Set(values)).join(',');
  }

  function parseSequenceSelectionNumbers(value) {
    return normalizeSequenceSelection(value)
      .split(',')
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  function normalizeGlobalProductFieldValue(fieldName, value) {
    if (fieldName === 'aiTitleLanguage') {
      return normalizeText(value) === 'en' ? 'en' : 'zh';
    }

    if (['specValueOne', 'specValueTwo'].includes(fieldName)) {
      return normalizeSkuMultilineValue(value);
    }

    return normalizeText(value);
  }

  function normalizeSkuConfigFieldValue(fieldName, value) {
    return fieldName === 'skuImage'
      ? normalizePositiveIntegerString(value)
      : normalizeText(value);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`\u7f3a\u5c11\u754c\u9762\u8282\u70b9\uff1a${id}`);
    }

    return element;
  }

  function createProductId() {
    return `pod-universal-product-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createCosUploadRunId() {
    return `pod-universal-cos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createAiTitleRunId() {
    return `pod-universal-ai-title-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clearCosUploadStopGuardTimer() {
    if (state.cosUploadStopGuardTimer) {
      window.clearTimeout(state.cosUploadStopGuardTimer);
      state.cosUploadStopGuardTimer = 0;
    }
  }

  function isCosUploadStopGuardActive() {
    return state.uploadingCosImages && Number(state.cosUploadStopGuardUntil) > Date.now();
  }

  function scheduleCosUploadStopGuardTimer() {
    clearCosUploadStopGuardTimer();

    if (!isCosUploadStopGuardActive()) {
      return;
    }

    state.cosUploadStopGuardTimer = window.setTimeout(() => {
      state.cosUploadStopGuardTimer = 0;
      renderActionButtonStates();
    }, Math.max(0, Number(state.cosUploadStopGuardUntil) - Date.now()));
  }

  function startCosUploadStopGuard() {
    state.cosUploadStopGuardUntil = Date.now() + COS_UPLOAD_STOP_GUARD_MS;
    scheduleCosUploadStopGuardTimer();
  }

  function resetCosUploadStopGuard() {
    state.cosUploadStopGuardUntil = 0;
    clearCosUploadStopGuardTimer();
  }

  function clearCosUploadProgressPollTimer() {
    if (state.cosUploadProgressPollTimer) {
      window.clearTimeout(state.cosUploadProgressPollTimer);
      state.cosUploadProgressPollTimer = 0;
    }
  }

  function getCosUploadProgressText() {
    const snapshot = createCosUploadProgressSnapshot(state.cosUploadSnapshot || {});
    const totalCount = Math.max(0, Number(snapshot.totalCount) || 0);
    const completedCount = Math.min(totalCount, Math.max(0, Number(snapshot.completedCount) || 0));
    const successCount = Math.max(0, Number(snapshot.successCount) || 0);
    const failedCount = Math.max(0, Number(snapshot.failedCount) || 0);
    const canceledCount = Math.max(0, Number(snapshot.canceledCount) || 0);

    if (state.uploadingCosImages) {
      const prefix = state.stoppingCosImages || snapshot.runState === 'stopping'
        ? '\u505c\u6b62\u4e0a\u4f20\u4e2d'
        : '\u56fe\u7247\u4e0a\u4f20\u4e2d';

      if (!totalCount) {
        return prefix;
      }

      let text = `${prefix} ${completedCount}/${totalCount}`;

      if (successCount || failedCount || canceledCount) {
        const detailParts = [`\u6210\u529f ${successCount}`];

        if (failedCount > 0) {
          detailParts.push(`\u5931\u8d25 ${failedCount}`);
        }

        if (canceledCount > 0) {
          detailParts.push(`\u505c\u6b62 ${canceledCount}`);
        }

        text += `\uff0c${detailParts.join('\uff0c')}`;
      }

      return text;
    }

    if (!totalCount) {
      return '';
    }

    const prefix = snapshot.canceled || snapshot.runState === 'canceled'
      ? '\u4e0a\u6b21\u5df2\u505c\u6b62'
      : '\u4e0a\u6b21\u4e0a\u4f20\u7ed3\u679c';
    const detailParts = [
      `\u6210\u529f ${successCount}`,
      `\u65b0\u4f20 ${Math.max(0, Number(snapshot.uploadedCount) || 0)}`,
      `\u7f13\u5b58 ${Math.max(0, Number(snapshot.cachedCount) || 0)}`
    ];

    if (failedCount > 0) {
      detailParts.push(`\u5931\u8d25 ${failedCount}`);
    }

    if (canceledCount > 0) {
      detailParts.push(`\u505c\u6b62 ${canceledCount}`);
    }

    return `${prefix}\uff1a${detailParts.join('\uff0c')}`;
  }

  function renderCosUploadProgressText() {
    const progressText = getElement('podCosUploadProgressText');
    const text = getCosUploadProgressText();
    const snapshot = createCosUploadProgressSnapshot(state.cosUploadSnapshot || {});

    progressText.textContent = text;
    progressText.hidden = !text;
    progressText.title = snapshot.label || '';
  }

  function scheduleCosUploadProgressPoll(delayMs = COS_UPLOAD_PROGRESS_POLL_MS) {
    clearCosUploadProgressPollTimer();

    if (!state.uploadingCosImages) {
      return;
    }

    state.cosUploadProgressPollTimer = window.setTimeout(() => {
      state.cosUploadProgressPollTimer = 0;
      void refreshCosUploadProgressSnapshot();
    }, Math.max(0, Number(delayMs) || 0));
  }

  async function refreshCosUploadProgressSnapshot() {
    if (!state.uploadingCosImages) {
      return;
    }

    const runId = normalizeText(state.cosUploadRunId);

    if (!runId) {
      return;
    }

    try {
      const result = await getFeatureCenterCosUploadBridge().getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot({ runId });
      const progress = result && result.progress && typeof result.progress === 'object'
        ? result.progress
        : null;

      if (progress) {
        state.cosUploadSnapshot = createCosUploadProgressSnapshot({
          ...state.cosUploadSnapshot,
          ...progress
        });
        renderActionButtonStates();
      }
    } catch (_error) {
    } finally {
      if (state.uploadingCosImages) {
        scheduleCosUploadProgressPoll();
      }
    }
  }

  function startCosUploadProgressPolling() {
    scheduleCosUploadProgressPoll(0);
  }

  function stopCosUploadProgressPolling() {
    clearCosUploadProgressPollTimer();
  }

  function isDuplicateButtonEvent(stampKey, event) {
    const nextStamp = Number(event && event.timeStamp) || Date.now();

    if (Number(state[stampKey]) === nextStamp) {
      return true;
    }

    state[stampKey] = nextStamp;
    return false;
  }

  function createEmptyMaterialPathMap() {
    return {
      carousel: {},
      assets: {},
      preview: {}
    };
  }

  function getMaterialNameHelper() {
    return window.podUploadSheetMiaoshouImageName || null;
  }

  function getMaterialNameKey(value) {
    const helper = getMaterialNameHelper();

    if (helper && typeof helper.normalizeMaterialNameKey === 'function') {
      return helper.normalizeMaterialNameKey(value);
    }

    return normalizeText(value).toLowerCase();
  }

  function getLegacyMaterialNameKey(value) {
    return normalizeText(getReferenceBaseName(value))
      .replace(/\.[^.]+$/, '')
      .toLowerCase();
  }

  function normalizeImportedMaterialName(fileName, context = {}) {
    const helper = getMaterialNameHelper();

    if (helper && typeof helper.normalizeMaterialDisplayName === 'function') {
      return helper.normalizeMaterialDisplayName(fileName, context);
    }

    return normalizeText(fileName);
  }

  function normalizeMaterialPathMap(source) {
    const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};

    return MATERIAL_SECTIONS.reduce((result, section) => {
      const sectionSource =
        input[section.id] && typeof input[section.id] === 'object' && !Array.isArray(input[section.id])
          ? input[section.id]
          : {};

      result[section.id] = Object.entries(sectionSource).reduce((map, [key, value]) => {
        const normalizedKey = normalizeText(key);
        const normalizedValue = normalizeText(value);

        if (normalizedKey && normalizedValue) {
          map[normalizedKey] = normalizedValue;
        }

        return map;
      }, {});

      return result;
    }, createEmptyMaterialPathMap());
  }

  function createSkuConfigEntry(overrides = {}) {
    return SKU_CONFIG_FIELD_NAMES.reduce((entry, fieldName) => {
      entry[fieldName] = normalizeSkuConfigFieldValue(fieldName, overrides[fieldName]);
      return entry;
    }, {});
  }

  function normalizeSkuConfigMap(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return {};
    }

    return Object.entries(source).reduce((result, [key, value]) => {
      const normalizedKey = normalizeText(key);

      if (!normalizedKey) {
        return result;
      }

      result[normalizedKey] = createSkuConfigEntry(value);
      return result;
    }, {});
  }

  function cloneSkuConfigMap(source) {
    return normalizeSkuConfigMap(source);
  }

  function createEmptyProduct(overrides = {}) {
    const materials = overrides.materials && typeof overrides.materials === 'object'
      ? overrides.materials
      : {};

    return {
      id: createProductId(),
      ...DEFAULT_PRODUCT_FIELDS,
      ...overrides,
      title: normalizeTitleFieldValue(overrides.title),
      mainNumber: normalizeText(overrides.mainNumber),
      materials: {
        carousel: Array.isArray(materials.carousel) ? materials.carousel.slice() : [],
        assets: Array.isArray(materials.assets) ? materials.assets.slice() : [],
        preview: Array.isArray(materials.preview) ? materials.preview.slice() : []
      },
      materialPathMap: normalizeMaterialPathMap(overrides.materialPathMap),
      skuConfigMap: normalizeSkuConfigMap(overrides.skuConfigMap)
    };
  }

  function getActiveProduct() {
    return state.products.find((product) => product.id === state.activeProductId) || null;
  }

  function getMaterialItems(product, sectionId) {
    return product && product.materials && Array.isArray(product.materials[sectionId])
      ? product.materials[sectionId].map((item) => normalizeText(item)).filter(Boolean)
      : [];
  }

  function getCarouselItems(product) {
    return getMaterialItems(product, 'carousel');
  }

  function getAllMaterialItems(product) {
    const seenKeys = new Set();
    const result = [];

    MATERIAL_SECTIONS.forEach((section) => {
      getMaterialItems(product, section.id).forEach((itemName) => {
        const key = getMaterialNameKey(itemName);

        if (!key || seenKeys.has(key)) {
          return;
        }

        seenKeys.add(key);
        result.push(itemName);
      });
    });

    return result;
  }

  function getMaterialPathByName(product, sectionId, itemName) {
    const materialPathMap = normalizeMaterialPathMap(product && product.materialPathMap);
    const normalizedSectionId = normalizeText(sectionId);
    const itemKey = getMaterialNameKey(itemName);
    const legacyItemKey = getLegacyMaterialNameKey(itemName);

    if (!itemKey) {
      return '';
    }

    const directPath = normalizeText(
      materialPathMap[normalizedSectionId] && materialPathMap[normalizedSectionId][itemKey]
    );

    if (directPath) {
      return directPath;
    }

    if (legacyItemKey && legacyItemKey !== itemKey) {
      const legacyPath = normalizeText(
        materialPathMap[normalizedSectionId] && materialPathMap[normalizedSectionId][legacyItemKey]
      );

      if (legacyPath) {
        return legacyPath;
      }
    }

    for (const section of MATERIAL_SECTIONS) {
      const fallbackPath = normalizeText(
        materialPathMap[section.id] && materialPathMap[section.id][itemKey]
      );

      if (fallbackPath) {
        return fallbackPath;
      }

      if (legacyItemKey && legacyItemKey !== itemKey) {
        const legacyFallbackPath = normalizeText(
          materialPathMap[section.id] && materialPathMap[section.id][legacyItemKey]
        );

        if (legacyFallbackPath) {
          return legacyFallbackPath;
        }
      }
    }

    return '';
  }

  function buildSectionMaterialPathMapByItems(product, sectionId, itemNames) {
    return (Array.isArray(itemNames) ? itemNames : []).reduce((result, itemName) => {
      const itemKey = getMaterialNameKey(itemName);
      const itemPath = getMaterialPathByName(product, sectionId, itemName);

      if (itemKey && itemPath && !result[itemKey]) {
        result[itemKey] = itemPath;
      }

      return result;
    }, {});
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(normalizeText(value));
  }

  function looksLikeLocalFilePath(value) {
    const text = normalizeText(value);

    if (!text) {
      return false;
    }

    if (/^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text)) {
      return true;
    }

    return /[\\/]/.test(text) && /[.][a-z0-9]{1,10}$/i.test(text);
  }

  function normalizeLocalFilePathKey(filePath) {
    const text = normalizeText(filePath);

    if (!text) {
      return '';
    }

    return text.replace(/\//g, '\\').toLowerCase();
  }

  function getLocalFilePath(file) {
    const directPath = normalizeText(file && file.path);

    if (directPath) {
      return directPath;
    }

    if (
      window.temuApp
      && window.temuApp.files
      && typeof window.temuApp.files.getPathForFile === 'function'
    ) {
      try {
        return normalizeText(window.temuApp.files.getPathForFile(file));
      } catch (_error) {
        return '';
      }
    }

    return '';
  }

  function getReferenceBaseName(value) {
    const text = normalizeText(value);

    if (!text) {
      return '';
    }

    const segments = text.split(/[\\/]+/).filter(Boolean);
    return normalizeText(segments[segments.length - 1] || text);
  }

  function getMaterialDisplayName(product, sectionId, itemName) {
    const itemPath = getMaterialPathByName(product, sectionId, itemName);
    return getReferenceBaseName(itemPath) || normalizeText(itemName);
  }

  function getCarouselItemDisplayName(product, itemName) {
    return getMaterialDisplayName(product, 'carousel', itemName);
  }

  function getMaterialPathCandidatesByReference(product, referenceText) {
    const normalizedReference = normalizeText(referenceText);
    const candidateMap = new Map();

    if (!normalizedReference) {
      return [];
    }

    if (looksLikeLocalFilePath(normalizedReference)) {
      const normalizedPathKey = normalizeLocalFilePathKey(normalizedReference);

      if (normalizedPathKey) {
        candidateMap.set(normalizedPathKey, {
          filePath: normalizedReference,
          fileName: getReferenceBaseName(normalizedReference)
        });
      }
    }

    const referenceName = getReferenceBaseName(normalizedReference) || normalizedReference;
    const displayReferenceName = normalizeImportedMaterialName(referenceName, {
      productKey: product && product.localName,
      sourceFolder: product && product.sourceFolder
    }) || referenceName;

    MATERIAL_SECTIONS.forEach((section) => {
      const localPath = getMaterialPathByName(product, section.id, referenceName);
      const normalizedPathKey = normalizeLocalFilePathKey(localPath);

      if (!normalizedPathKey || candidateMap.has(normalizedPathKey)) {
        return;
      }

      candidateMap.set(normalizedPathKey, {
        filePath: localPath,
        fileName: displayReferenceName
      });
    });

    return Array.from(candidateMap.values());
  }

  function appendUploadableEntry(entryMap, filePath, fileName) {
    const normalizedPathKey = normalizeLocalFilePathKey(filePath);

    if (!normalizedPathKey) {
      return;
    }

    if (!entryMap.has(normalizedPathKey)) {
      entryMap.set(normalizedPathKey, {
        filePath: normalizeText(filePath),
        fileName: normalizeText(fileName) || getReferenceBaseName(filePath)
      });
    }
  }

  function getProductUploadableImageEntries(product) {
    const entryMap = new Map();

    MATERIAL_SECTIONS.forEach((section) => {
      getMaterialItems(product, section.id).forEach((itemName) => {
        if (isHttpUrl(itemName)) {
          return;
        }

        appendUploadableEntry(
          entryMap,
          getMaterialPathByName(product, section.id, itemName),
          itemName
        );
      });
    });

    return Array.from(entryMap.values());
  }

  function getUploadableImageEntries() {
    const entryMap = new Map();

    state.products.forEach((product) => {
      getProductUploadableImageEntries(product).forEach((entry) => {
        appendUploadableEntry(entryMap, entry.filePath, entry.fileName);
      });
    });

    return Array.from(entryMap.values());
  }

  function hasLocalMaterialItems(products = state.products) {
    return (Array.isArray(products) ? products : []).some((product) => {
      const hasLocalSectionItems = MATERIAL_SECTIONS.some((section) => {
        return getMaterialItems(product, section.id).some((itemName) => !isHttpUrl(itemName));
      });

      if (hasLocalSectionItems) {
        return true;
      }

      return false;
    });
  }

  function getSkuValueItems(value) {
    return normalizeSkuMultilineValue(value)
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function buildSkuRowKey(specValueOne, specValueTwo) {
    return `${normalizeText(specValueOne)}${SKU_ROW_KEY_SEPARATOR}${normalizeText(specValueTwo)}`;
  }

  function getSkuCombinationRows(source = state.globalProductSettings) {
    const specValueOneItems = getSkuValueItems(source && source.specValueOne);
    const specValueTwoItems = getSkuValueItems(source && source.specValueTwo);

    if (!specValueOneItems.length && !specValueTwoItems.length) {
      return [{
        key: buildSkuRowKey('', ''),
        specValueOne: '',
        specValueTwo: ''
      }];
    }

    const leftItems = specValueOneItems.length ? specValueOneItems : [''];
    const rightItems = specValueTwoItems.length ? specValueTwoItems : [''];

    return leftItems.flatMap((leftValue) => {
      return rightItems.map((rightValue) => {
        return {
          key: buildSkuRowKey(leftValue, rightValue),
          specValueOne: leftValue,
          specValueTwo: rightValue
        };
      });
    });
  }

  function buildDefaultSkuConfig(source = state.globalProductSettings) {
    return createSkuConfigEntry({
      declaredPrice: normalizeText(source && source.declaredPrice),
      stock: normalizeText(source && source.stock),
      skuWeightKg: normalizeText(source && source.skuWeightKg),
      skuSize: normalizeText(source && source.skuSize),
      platformSku: normalizeText(source && source.platformSku)
    });
  }

  function syncSkuConfigMapWithCurrentSpecs(source = state.globalProductSettings) {
    const existingMap = normalizeSkuConfigMap(source && source.skuConfigMap);
    const defaultConfig = buildDefaultSkuConfig(source);
    const nextMap = {};

    getSkuCombinationRows(source).forEach((row) => {
      nextMap[row.key] = createSkuConfigEntry({
        ...defaultConfig,
        ...(existingMap[row.key] || {})
      });
    });

    source.skuConfigMap = nextMap;
    return nextMap;
  }

  function getSkuEditorRows(source = state.globalProductSettings) {
    const nextMap = syncSkuConfigMapWithCurrentSpecs(source);

    return getSkuCombinationRows(source).map((row) => {
      return {
        ...row,
        ...createSkuConfigEntry(nextMap[row.key])
      };
    });
  }

  function getSkuImageOptionItems(skuRows, product = getActiveProduct()) {
    const optionMap = new Map();

    getCarouselItems(product).forEach((itemName, index) => {
      const orderText = String(index + 1);
      const normalizedItemName = normalizeText(itemName);
      optionMap.set(
        orderText,
        normalizedItemName ? `\u7b2c${orderText}\u5f20 (${normalizedItemName})` : `\u7b2c${orderText}\u5f20`
      );
    });

    (Array.isArray(skuRows) ? skuRows : []).forEach((row) => {
      const orderText = normalizePositiveIntegerString(row && row.skuImage);

      if (orderText && !optionMap.has(orderText)) {
        optionMap.set(orderText, `\u7b2c${orderText}\u5f20`);
      }
    });

    return Array.from(optionMap.entries())
      .sort((left, right) => Number.parseInt(left[0], 10) - Number.parseInt(right[0], 10))
      .map(([value, label]) => ({ value, label }));
  }

  function normalizeFormTemplateFieldValue(fieldName, value) {
    if (fieldName === 'aiTitleMaxLength') {
      return normalizeAiTitleLengthInput(value);
    }

    return GLOBAL_PRODUCT_FIELD_NAMES.includes(fieldName)
      ? normalizeGlobalProductFieldValue(fieldName, value)
      : normalizeText(value);
  }

  function normalizeFormTemplateRecord(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }

    const templateId = normalizeText(record.id);
    const templateName = normalizeText(record.name);

    if (!templateId || !templateName) {
      return null;
    }

    const fields = FORM_TEMPLATE_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = normalizeFormTemplateFieldValue(
        fieldName,
        record.fields && record.fields[fieldName]
      );
      return result;
    }, {});

    return {
      id: templateId,
      name: templateName,
      createdAt: normalizeText(record.createdAt),
      updatedAt: normalizeText(record.updatedAt),
      fields,
      skuConfigMap: cloneSkuConfigMap(record.skuConfigMap),
      batchPreset: Object.prototype.hasOwnProperty.call(record, 'batchPreset')
        ? normalizeFormTemplateBatchPreset(record.batchPreset)
        : null
    };
  }

  function normalizeFormTemplateSnapshot(snapshot) {
    const templates = Array.isArray(snapshot && snapshot.templates)
      ? snapshot.templates.map(normalizeFormTemplateRecord).filter(Boolean)
      : [];

    return {
      updatedAt: normalizeText(snapshot && snapshot.updatedAt),
      templates
    };
  }

  function normalizeWorkspaceStateSnapshot(snapshot) {
    const workspaceSource =
      snapshot && snapshot.workspace && typeof snapshot.workspace === 'object' && !Array.isArray(snapshot.workspace)
        ? snapshot.workspace
        : {};

    return {
      updatedAt: normalizeText(snapshot && snapshot.updatedAt),
      lastImportDirectoryPath: normalizeText(
        workspaceSource.lastImportDirectoryPath
        || workspaceSource.lastImportPath
        || workspaceSource.importDirectoryPath
      ),
      imageUploadMode: normalizeImageUploadMode(
        workspaceSource.imageUploadMode
        || workspaceSource.uploadImageMode
      ),
      carouselPresetMode: normalizeCachedCarouselPresetMode(
        workspaceSource.carouselPresetMode
        || workspaceSource.cachedCarouselPresetMode
      ),
      carouselPresetRandomOrders: normalizeSequenceSelection(
        workspaceSource.carouselPresetRandomOrders
        || workspaceSource.cachedCarouselPresetRandomOrders
      ),
      carouselPresetSelection: normalizeCachedPresetSelection(
        workspaceSource.carouselPresetSelection
        || workspaceSource.cachedCarouselPresetSelection
      ),
      descriptionPresetSelection: normalizeCachedPresetSelection(
        workspaceSource.descriptionPresetSelection
        || workspaceSource.cachedDescriptionPresetSelection
      )
    };
  }

  function normalizeImageUploadMode(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return IMAGE_UPLOAD_MODE_OPTIONS.includes(normalizedValue) ? normalizedValue : 'original';
  }

  function normalizeCachedCarouselPresetMode(value) {
    return normalizeText(value) === 'random-first' ? 'random-first' : 'selected';
  }

  function normalizeCachedPresetSelection(value) {
    return (Array.isArray(value) ? value : [])
      .map((item) => getMaterialNameKey(item))
      .filter((item, index, items) => item && items.indexOf(item) === index);
  }

  function getPreferredPresetSelection(candidates, cachedSelection, seedSelection) {
    const candidateMap = getDescriptionPresetCandidateMap(candidates);
    const preferredSelection = normalizeCachedPresetSelection(cachedSelection)
      .filter((key) => candidateMap.has(key));

    if (preferredSelection.length) {
      return preferredSelection;
    }

    return normalizeCachedPresetSelection(seedSelection)
      .filter((key) => candidateMap.has(key));
  }

  function buildWorkspaceStatePayload() {
    return {
      lastImportDirectoryPath: normalizeText(state.lastImportDirectoryPath),
      imageUploadMode: normalizeImageUploadMode(state.imageUploadMode),
      carouselPresetMode: normalizeCachedCarouselPresetMode(state.carouselPresetCachedMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(state.carouselPresetCachedRandomOrders),
      carouselPresetSelection: normalizeCachedPresetSelection(state.carouselPresetCachedSelection),
      descriptionPresetSelection: normalizeCachedPresetSelection(state.descriptionPresetCachedSelection)
    };
  }

  function buildCurrentFormTemplateBatchPreset() {
    if (state.carouselPresetModalOpen) {
      return {
        carouselPresetMode: normalizeCachedCarouselPresetMode(state.carouselPresetMode),
        carouselPresetRandomOrders: normalizeSequenceSelection(state.carouselPresetRandomOrdersDraft),
        carouselPresetSelection: normalizeCachedPresetSelection(state.carouselPresetSelectionDraft),
        descriptionPresetSelection: normalizeCachedPresetSelection(state.descriptionPresetCachedSelection)
      };
    }

    return {
      carouselPresetMode: normalizeCachedCarouselPresetMode(state.carouselPresetCachedMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(state.carouselPresetCachedRandomOrders),
      carouselPresetSelection: normalizeCachedPresetSelection(state.carouselPresetCachedSelection),
      descriptionPresetSelection: normalizeCachedPresetSelection(state.descriptionPresetCachedSelection)
    };
  }

  function normalizeFormTemplateBatchPreset(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

    return {
      carouselPresetMode: normalizeCachedCarouselPresetMode(source.carouselPresetMode || source.cachedCarouselPresetMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(source.carouselPresetRandomOrders || source.cachedCarouselPresetRandomOrders),
      carouselPresetSelection: normalizeCachedPresetSelection(source.carouselPresetSelection || source.cachedCarouselPresetSelection),
      descriptionPresetSelection: normalizeCachedPresetSelection(source.descriptionPresetSelection || source.cachedDescriptionPresetSelection)
    };
  }

  function applyFormTemplateBatchPreset(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }

    const batchPreset = normalizeFormTemplateBatchPreset(value);

    state.carouselPresetCachedMode = batchPreset.carouselPresetMode;
    state.carouselPresetCachedRandomOrders = batchPreset.carouselPresetRandomOrders;
    state.carouselPresetCachedSelection = batchPreset.carouselPresetSelection;
    state.descriptionPresetCachedSelection = batchPreset.descriptionPresetSelection;
    scheduleWorkspaceStateSave();
  }

  function persistCachedCarouselPresetState(options = {}) {
    state.carouselPresetCachedMode = normalizeCachedCarouselPresetMode(state.carouselPresetMode);
    state.carouselPresetCachedSelection = normalizeCachedPresetSelection(state.carouselPresetSelectionDraft);
    state.carouselPresetCachedRandomOrders = normalizeSequenceSelection(state.carouselPresetRandomOrdersDraft);
    scheduleWorkspaceStateSave(options);
  }

  function persistCachedDescriptionPresetSelection(value, options = {}) {
    state.descriptionPresetCachedSelection = normalizeCachedPresetSelection(value);
    scheduleWorkspaceStateSave(options);
  }

  async function saveWorkspaceState(options = {}) {
    const { showErrorNotice = false } = options;

    if (!state.workspaceStateHydrated) {
      return null;
    }

    state.workspaceStateSavePromise = (state.workspaceStateSavePromise || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        state.savingWorkspaceState = true;

        try {
          return await getFeatureCenterBridge().savePodUploadSheetMiaoshouUniversalWorkspaceState({
            workspace: buildWorkspaceStatePayload()
          });
        } catch (error) {
          if (showErrorNotice) {
            showWindowNotice(
              `\u5de5\u4f5c\u533a\u7f13\u5b58\u4fdd\u5b58\u5931\u8d25\uff1a${normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`,
              'warning'
            );
          }
          return null;
        } finally {
          state.savingWorkspaceState = false;
        }
      });

    return state.workspaceStateSavePromise;
  }

  function scheduleWorkspaceStateSave(options = {}) {
    const { immediate = false, showErrorNotice = false } = options;

    if (!state.workspaceStateHydrated) {
      return;
    }

    window.clearTimeout(state.workspaceStateSaveTimer);
    state.workspaceStateSaveTimer = 0;

    if (immediate) {
      void saveWorkspaceState({ showErrorNotice });
      return;
    }

    state.workspaceStateSaveTimer = window.setTimeout(() => {
      state.workspaceStateSaveTimer = 0;
      void saveWorkspaceState({ showErrorNotice });
    }, 400);
  }

  async function loadWorkspaceState(options = {}) {
    const { showErrorNotice = false } = options;

    state.loadingWorkspaceState = true;

    try {
      const snapshot = normalizeWorkspaceStateSnapshot(
        await getFeatureCenterBridge().getPodUploadSheetMiaoshouUniversalWorkspaceState()
      );

      state.lastImportDirectoryPath = snapshot.lastImportDirectoryPath;
      state.imageUploadMode = snapshot.imageUploadMode;
      state.carouselPresetCachedMode = snapshot.carouselPresetMode;
      state.carouselPresetCachedSelection = snapshot.carouselPresetSelection;
      state.carouselPresetCachedRandomOrders = snapshot.carouselPresetRandomOrders;
      state.descriptionPresetCachedSelection = snapshot.descriptionPresetSelection;
      renderAll();
    } catch (error) {
      if (showErrorNotice) {
        showWindowNotice(
          `\u5de5\u4f5c\u533a\u7f13\u5b58\u8bfb\u53d6\u5931\u8d25\uff1a${normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`,
          'warning'
        );
      }
    } finally {
      state.loadingWorkspaceState = false;
      state.workspaceStateHydrated = true;
    }
  }

  function buildCurrentFormTemplateFields() {
    return FORM_TEMPLATE_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = normalizeFormTemplateFieldValue(
        fieldName,
        GLOBAL_PRODUCT_FIELD_NAMES.includes(fieldName)
          ? state.globalProductSettings[fieldName]
          : state[fieldName]
      );
      return result;
    }, {});
  }

  function areFieldSetsEqual(leftFields, rightFields) {
    return FORM_TEMPLATE_FIELD_NAMES.every((fieldName) => {
      return normalizeFormTemplateFieldValue(fieldName, leftFields && leftFields[fieldName])
        === normalizeFormTemplateFieldValue(fieldName, rightFields && rightFields[fieldName]);
    });
  }

  function areSkuConfigMapsEqual(leftMap, rightMap) {
    const normalizedLeftMap = normalizeSkuConfigMap(leftMap);
    const normalizedRightMap = normalizeSkuConfigMap(rightMap);
    const leftKeys = Object.keys(normalizedLeftMap).sort();
    const rightKeys = Object.keys(normalizedRightMap).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every((key, index) => {
      if (key !== rightKeys[index]) {
        return false;
      }

      return SKU_CONFIG_FIELD_NAMES.every((fieldName) => {
        return normalizeText(normalizedLeftMap[key] && normalizedLeftMap[key][fieldName])
          === normalizeText(normalizedRightMap[key] && normalizedRightMap[key][fieldName]);
      });
    });
  }

  function hasNonDefaultFormTemplateContent() {
    return (
      !areFieldSetsEqual(buildCurrentFormTemplateFields(), DEFAULT_GLOBAL_PRODUCT_SETTINGS)
      || !areSkuConfigMapsEqual(state.globalProductSettings.skuConfigMap, {})
    );
  }

  function shouldConfirmBeforeApplyingFormTemplate(template) {
    if (!template || !hasNonDefaultFormTemplateContent()) {
      return false;
    }

    return (
      !areFieldSetsEqual(buildCurrentFormTemplateFields(), template.fields)
      || !areSkuConfigMapsEqual(state.globalProductSettings.skuConfigMap, template.skuConfigMap)
    );
  }

  function applyGlobalProductSettingsToProduct(product) {
    if (!product || typeof product !== 'object') {
      return product;
    }

    syncSkuConfigMapWithCurrentSpecs(state.globalProductSettings);

    GLOBAL_PRODUCT_FIELD_NAMES.forEach((fieldName) => {
      product[fieldName] = state.globalProductSettings[fieldName];
    });

    product.skuConfigMap = cloneSkuConfigMap(state.globalProductSettings.skuConfigMap);
    return product;
  }

  function syncGlobalProductSettingsToProducts(products = state.products) {
    const targetProducts = Array.isArray(products) ? products : [];
    targetProducts.forEach((product) => {
      applyGlobalProductSettingsToProduct(product);
    });
  }

  function syncSkuConfigMapToProducts(products = state.products) {
    const targetProducts = Array.isArray(products) ? products : [];
    targetProducts.forEach((product) => {
      if (product && typeof product === 'object') {
        product.skuConfigMap = cloneSkuConfigMap(state.globalProductSettings.skuConfigMap);
      }
    });
  }

  function syncGlobalProductFieldToProducts(fieldName, products = state.products) {
    const normalizedFieldName = normalizeText(fieldName);

    if (!GLOBAL_PRODUCT_FIELD_NAMES.includes(normalizedFieldName)) {
      return;
    }

    const targetProducts = Array.isArray(products) ? products : [];
    targetProducts.forEach((product) => {
      if (product && typeof product === 'object') {
        product[normalizedFieldName] = state.globalProductSettings[normalizedFieldName];
      }
    });

    if (['specValueOne', 'specValueTwo'].includes(normalizedFieldName)) {
      syncSkuConfigMapToProducts(targetProducts);
    }
  }

  function getFileNameWithoutExtension(fileName) {
    return normalizeText(fileName).replace(/\.[^.]+$/, '');
  }

  function buildFolderMainNumber(sourceFolder, fallbackName) {
    const segments = normalizeText(sourceFolder)
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => normalizeText(segment))
      .filter(Boolean);

    if (segments.length >= 2) {
      return segments.slice(-2).join('-');
    }

    if (segments.length === 1) {
      return segments[0];
    }

    return normalizeText(fallbackName);
  }

  function getProductMainNumber(product) {
    return buildFolderMainNumber(product && product.sourceFolder, product && (product.mainNumber || product.localName));
  }

  function getSourceMappedFolderParts(product) {
    const sourceFolder = normalizeText(product && product.sourceFolder).replace(/\\/g, '/');
    const segments = sourceFolder
      .split('/')
      .map((segment) => normalizeText(segment))
      .filter(Boolean);

    return {
      mainFolderName: normalizeText(segments[0] || product && product.localName),
      detailFolderName: normalizeText(segments.length > 1 ? segments[segments.length - 1] : '')
    };
  }

  function getSourceMappedImageName(product) {
    for (const sectionId of ['carousel', 'assets', 'preview']) {
      const imageName = getFileNameWithoutExtension(getMaterialItems(product, sectionId)[0]);

      if (imageName) {
        return imageName;
      }
    }

    return '';
  }

  function getSourceMappedFieldValue(product) {
    const { mainFolderName, detailFolderName } = getSourceMappedFolderParts(product);
    const imageName = getSourceMappedImageName(product);
    const folderName = detailFolderName || mainFolderName;

    if (mainFolderName && detailFolderName) {
      if (imageName) {
        return `${mainFolderName}-${imageName}`;
      }

      return detailFolderName === mainFolderName
        ? mainFolderName
        : `${mainFolderName}-${detailFolderName}`;
    }

    if (folderName && imageName) {
      return `${folderName}-${imageName}`;
    }

    return folderName || imageName;
  }

  function applyImportedSourceMappingsToProduct(product) {
    if (!product || typeof product !== 'object') {
      return product;
    }

    const sourceMappedValue = getSourceMappedFieldValue(product);

    if (!sourceMappedValue) {
      return product;
    }

    product.mainNumber = getProductMainNumber(product) || sourceMappedValue;

    if (!normalizeText(product.title)) {
      product.title = normalizeTitleFieldValue(product.mainNumber || product.localName);
    }

    return product;
  }

  function getPrimaryProductImage(product) {
    if (!product) {
      return null;
    }

    for (const sectionId of ['carousel', 'assets', 'preview']) {
      const items = getMaterialItems(product, sectionId);

      for (let index = 0; index < items.length; index += 1) {
        const itemName = normalizeText(items[index]);
        const itemPath = getMaterialPathByName(product, sectionId, itemName);

        if (itemName && itemPath) {
          return {
            sectionId,
            name: itemName,
            path: itemPath,
            order: index + 1
          };
        }
      }
    }

    return null;
  }

  function formatTime(value) {
    const timestamp = normalizeText(value);

    if (!timestamp) {
      return '\u672a\u540c\u6b65';
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }

    return date.toLocaleString('zh-CN', { hour12: false });
  }

  function getTemplateSnapshotById(templateId) {
    return (Array.isArray(state.snapshot.templates) ? state.snapshot.templates : []).find((item) => item.id === templateId) || null;
  }

  function getTotalMaterialCount(product) {
    return MATERIAL_SECTIONS.reduce((total, section) => {
      return total + getMaterialItems(product, section.id).length;
    }, 0);
  }

  function getSelectedCarouselItemsByOrders(product, value) {
    const carouselItems = getCarouselItems(product);
    const selectedOrders = normalizeSequenceSelection(value)
      .split(',')
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return selectedOrders.reduce((result, orderText) => {
      const index = Number.parseInt(orderText, 10) - 1;
      const itemName = carouselItems[index];

      if (!itemName) {
        return result;
      }

      result.push({
        order: orderText,
        name: normalizeText(itemName),
        displayName: getCarouselItemDisplayName(product, itemName)
      });
      return result;
    }, []);
  }

  function getCarouselOrdersByItemNames(carouselItems, itemNames) {
    const normalizedCarouselItems = Array.from(new Set(
      (Array.isArray(carouselItems) ? carouselItems : []).map((item) => normalizeText(item)).filter(Boolean)
    ));

    return Array.from(new Set(
      (Array.isArray(itemNames) ? itemNames : []).reduce((result, itemName) => {
        const key = getMaterialNameKey(itemName);
        const matchIndex = normalizedCarouselItems.findIndex((candidate) => getMaterialNameKey(candidate) === key);

        if (matchIndex >= 0) {
          result.push(String(matchIndex + 1));
        }

        return result;
      }, [])
    )).join(',');
  }

  function mergeMaterialItemsWithPriority(priorityItems, fallbackItems) {
    return Array.from(new Set(
      [
        ...(Array.isArray(priorityItems) ? priorityItems : []),
        ...(Array.isArray(fallbackItems) ? fallbackItems : [])
      ].map((item) => normalizeText(item)).filter(Boolean)
    ));
  }

  function getDescriptionImagePreviewText(product) {
    const selectedItems = getSelectedCarouselItemsByOrders(product, product && product.descriptionImageOrders);

    if (selectedItems.length) {
      return [
        `\u5df2\u9009 ${selectedItems.length} \u5f20`,
        ...selectedItems.map((item) => `\u7b2c${item.order}\u5f20 ${item.displayName || item.name}`)
      ].join('\n');
    }

    const assetsCount = getMaterialItems(product, 'assets').length;
    const previewCount = getMaterialItems(product, 'preview').length;

    if (assetsCount || previewCount) {
      return `\u7d20\u6750 ${assetsCount + previewCount} \u5f20`;
    }

    return '\u5171 0 \u5f20';
  }

  function getCarouselPreviewText(product) {
    const carouselItems = getCarouselItems(product);

    if (!carouselItems.length) {
      return '\u5171 0 \u5f20';
    }

    return [
      `\u5171 ${carouselItems.length} \u5f20`,
      ...carouselItems.map((itemName, index) => `\u7b2c${index + 1}\u5f20 ${getCarouselItemDisplayName(product, itemName) || normalizeText(itemName)}`)
    ].join('\n');
  }

  function getAiTitleTargetItems(options = {}) {
    const { retryFailedOnly = false } = options;

    return state.products.reduce((result, product) => {
      if (retryFailedOnly && normalizeText(product.aiTitleStatus) !== 'failed') {
        return result;
      }

      const primaryImage = getPrimaryProductImage(product);

      if (!primaryImage) {
        return result;
      }

      result.push({
        product,
        primaryImage
      });
      return result;
    }, []);
  }

  function resetAiTitleProgress() {
    state.aiTitleProgress = createAiTitleProgressSnapshot();
  }

  function getAiTitleProgressText() {
    if (!state.generatingAiTitles) {
      return '';
    }

    const totalCount = Math.max(0, Number(state.aiTitleProgress.totalCount) || 0);
    const completedCount = Math.min(
      totalCount,
      Math.max(0, Number(state.aiTitleProgress.completedCount) || 0)
    );
    const prefix = state.stoppingAiTitles ? '\u505c\u6b62\u4e2d' : 'AI\u751f\u6210\u4e2d';

    if (!totalCount) {
      return prefix;
    }

    return `${prefix} ${completedCount}/${totalCount}`;
  }

  function syncPreferredAiTitleToProduct(product) {
    if (!product || typeof product !== 'object') {
      return;
    }

    const preferredLimit = getExplicitAiTitleLengthLimit() || TITLE_MAX_LENGTH;
    const zhTitle = normalizeTitleFieldValue(product.aiTitleZh);
    const enTitle = normalizeTitleFieldValue(product.aiTitleEn);
    const preferredTitle = state.aiTitleLanguage === 'en'
      ? normalizeTitleFieldValue(enTitle || zhTitle, preferredLimit)
      : normalizeTitleFieldValue(zhTitle || enTitle, preferredLimit);

    if (preferredTitle) {
      product.title = preferredTitle;
    }
  }

  function syncPreferredAiTitlesToProducts(products = state.products) {
    const targetProducts = Array.isArray(products) ? products : [];

    targetProducts.forEach((product) => {
      syncPreferredAiTitleToProduct(product);
    });
  }

  function applyAiTitleResultToProduct(product, item, updatedAt, taskCanceled = false) {
    if (!product) {
      return;
    }

    if (!item) {
      product.aiTitleStatus = taskCanceled ? 'canceled' : 'failed';
      product.aiTitleError = taskCanceled
        ? '\u4efb\u52a1\u5df2\u505c\u6b62\u3002'
        : 'AI \u8fd4\u56de\u7ed3\u679c\u7f3a\u5c11\u5f53\u524d\u5546\u54c1\u3002';
      product.aiTitlePatternSummary = '';
      product.aiTitleUpdatedAt = updatedAt;
      return;
    }

    if (normalizeText(item.status) === 'success') {
      const preferredLimit = getExplicitAiTitleLengthLimit() || TITLE_MAX_LENGTH;

      product.aiTitleZh = normalizeTitleFieldValue(
        item.zhTitle,
        state.aiTitleLanguage === 'zh' ? preferredLimit : TITLE_MAX_LENGTH
      );
      product.aiTitleEn = normalizeTitleFieldValue(
        item.enTitle,
        state.aiTitleLanguage === 'en' ? preferredLimit : TITLE_MAX_LENGTH
      );
      syncPreferredAiTitleToProduct(product);
      product.aiTitleStatus = 'success';
      product.aiTitleError = '';
      product.aiTitlePatternSummary = normalizeText(item.patternSummary);
      product.aiTitleUpdatedAt = updatedAt;
      return;
    }

    if (normalizeText(item.status) === 'canceled') {
      product.aiTitleStatus = 'canceled';
      product.aiTitleError = normalizeText(item.error) || '\u4efb\u52a1\u5df2\u505c\u6b62\u3002';
      product.aiTitlePatternSummary = '';
      product.aiTitleUpdatedAt = updatedAt;
      return;
    }

    product.aiTitleStatus = 'failed';
    product.aiTitleError = normalizeText(item.error) || '\u6807\u9898\u751f\u6210\u5931\u8d25\u3002';
    product.aiTitlePatternSummary = '';
    product.aiTitleUpdatedAt = updatedAt;
  }

  function handleAiTitleProgressEvent(payload) {
    if (!state.generatingAiTitles) {
      return;
    }

    const incomingRunId = normalizeText(payload && payload.runId);

    if (incomingRunId && incomingRunId !== normalizeText(state.aiTitleRunId)) {
      return;
    }

    const nextProgress = createAiTitleProgressSnapshot({
      ...state.aiTitleProgress,
      ...payload,
      label: normalizeText(payload && payload.localName) || normalizeText(payload && payload.imageName)
    });
    const item = payload && payload.item && typeof payload.item === 'object' ? payload.item : null;
    const productId = normalizeText(item && item.id) || nextProgress.productId;

    state.aiTitleProgress = nextProgress;

    if (productId && item) {
      const product = state.products.find((entry) => entry.id === productId);

      if (product) {
        applyAiTitleResultToProduct(product, item, nextProgress.updatedAt, false);
        syncProductRowStatus(productId);
      }
    }

    renderAiTitleControls();
  }

  function renderAiTitleControls() {
    const prefixInput = getElement('podAiTitlePrefixInput');
    const suffixInput = getElement('podAiTitleSuffixInput');
    const languageSelect = getElement('podAiTitleLanguageSelect');
    const generateButton = getElement('podBatchAiTitleButton');
    const retryButton = getElement('podRetryFailedAiTitleButton');
    const progressText = getElement('podAiTitleProgressText');
    const eligibleCount = getAiTitleTargetItems().length;
    const retryTargetCount = getAiTitleTargetItems({ retryFailedOnly: true }).length;

    if (prefixInput.value !== state.aiTitlePrefix) {
      prefixInput.value = state.aiTitlePrefix;
    }

    if (suffixInput.value !== state.aiTitleSuffix) {
      suffixInput.value = state.aiTitleSuffix;
    }

    const extraPromptInput = getElement('podAiTitleExtraPromptInput');
    if (extraPromptInput.value !== state.aiTitleExtraPrompt) {
      extraPromptInput.value = state.aiTitleExtraPrompt;
    }

    const maxLengthInput = getElement('podAiTitleMaxLengthInput');
    maxLengthInput.min = '1';
    maxLengthInput.max = String(TITLE_MAX_LENGTH);
    maxLengthInput.placeholder = '250';
    if (maxLengthInput.value !== state.aiTitleMaxLength) {
      maxLengthInput.value = state.aiTitleMaxLength;
    }

    if (languageSelect.value !== state.aiTitleLanguage) {
      languageSelect.value = state.aiTitleLanguage;
    }

    if (!generateButton.dataset.defaultLabel) {
      generateButton.dataset.defaultLabel = generateButton.textContent || '\u6279\u91cfAI\u751f\u6210\u6807\u9898';
    }

    generateButton.textContent = state.generatingAiTitles
      ? (state.stoppingAiTitles ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u4efb\u52a1')
      : (generateButton.dataset.defaultLabel || '\u6279\u91cfAI\u751f\u6210\u6807\u9898');
    generateButton.disabled = state.generatingAiTitles ? state.stoppingAiTitles : !eligibleCount;
    toggleButtonBusy(
      retryButton,
      state.generatingAiTitles && state.retryingFailedAiTitles && !state.stoppingAiTitles,
      '\u91cd\u8bd5\u4e2d...'
    );
    retryButton.disabled = state.generatingAiTitles || state.stoppingAiTitles || !retryTargetCount;
    progressText.textContent = getAiTitleProgressText();
    progressText.hidden = !progressText.textContent;
    progressText.title = state.aiTitleProgress.label || '';
  }

  function getProductStatus(product) {
    if (normalizeText(product && product.aiTitleStatus) === 'processing') {
      return {
        label: 'AI\u751f\u6210\u4e2d',
        tone: 'working'
      };
    }

    if (normalizeText(product && product.aiTitleStatus) === 'canceled') {
      return {
        label: '\u5df2\u505c\u6b62',
        tone: 'pending'
      };
    }

    if (normalizeText(product && product.aiTitleStatus) === 'failed') {
      return {
        label: 'AI\u5931\u8d25',
        tone: 'danger'
      };
    }

    if (getTotalMaterialCount(product) <= 0) {
      return {
        label: '\u5f85\u8865\u56fe\u7247',
        tone: 'empty'
      };
    }

    if (!normalizeText(getProductMainNumber(product))) {
      return {
        label: '\u5f85\u8865\u4e3b\u7f16\u53f7',
        tone: 'pending'
      };
    }

    if (!normalizeText(product && product.title)) {
      return {
        label: '\u5f85\u8865\u4ea7\u54c1\u540d',
        tone: 'pending'
      };
    }

    const skuRows = getSkuEditorRows(product);
    const missingPrice = skuRows.length && skuRows.some((row) => !normalizeText(row.declaredPrice));

    if (missingPrice) {
      return {
        label: '\u5f85\u8865SKU\u552e\u4ef7',
        tone: 'pending'
      };
    }

    return {
      label: '\u53ef\u5bfc\u51fa',
      tone: 'ready'
    };
  }

  function showWindowNotice(message, tone) {
    const notice = getElement('podWindowNotice');

    window.clearTimeout(state.windowNoticeTimer);
    notice.textContent = normalizeText(message) || '\u64cd\u4f5c\u5b8c\u6210';
    notice.className = 'pod-window-notice is-visible';

    if (tone) {
      notice.classList.add(`is-${tone}`);
    }

    notice.hidden = false;
    state.windowNoticeTimer = window.setTimeout(() => {
      notice.classList.remove('is-visible');
      state.windowNoticeTimer = window.setTimeout(() => {
        notice.hidden = true;
      }, 180);
    }, 2200);
  }

  window.showPodUploadSheetNotice = showWindowNotice;

  function toggleButtonBusy(button, isBusy, busyText) {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent || '';
    }

    button.disabled = Boolean(isBusy);
    button.textContent = isBusy ? busyText : button.dataset.defaultLabel;
  }

  function renderTemplateStatus() {
    const statusElement = getElement('podUniversalTemplateStatus');
    const templateItem = getTemplateSnapshotById(UNIVERSAL_TEMPLATE_ID);

    statusElement.className = 'pod-summary-pill';

    if (state.loadingSnapshot) {
      statusElement.textContent = '\u6a21\u677f\u540c\u6b65\u4e2d';
      statusElement.classList.add('is-warning');
      return;
    }

    if (templateItem && templateItem.exists) {
      statusElement.textContent = '\u6a21\u677f\u5df2\u5c31\u7eea';
      statusElement.classList.add('is-success');
      return;
    }

    statusElement.textContent = '\u6a21\u677f\u672a\u5c31\u7eea';
    statusElement.classList.add('is-danger');
  }

  function getSelectedFormTemplate() {
    return (Array.isArray(state.formTemplateSnapshot.templates) ? state.formTemplateSnapshot.templates : [])
      .find((item) => item.id === state.selectedFormTemplateId) || null;
  }

  async function selectAndApplyFormTemplate(templateId, options = {}) {
    const normalizedTemplateId = normalizeText(templateId);
    const selectedTemplate = (
      Array.isArray(state.formTemplateSnapshot.templates)
        ? state.formTemplateSnapshot.templates
        : []
    ).find((item) => item.id === normalizedTemplateId) || null;

    if (!selectedTemplate) {
      state.selectedFormTemplateId = '';
      getElement('podFormTemplateNameInput').value = '';
      renderFormTemplateSelect();
      return;
    }

    if (!options.skipConfirm && shouldConfirmBeforeApplyingFormTemplate(selectedTemplate)) {
      const confirmed = await getDialogBridge().confirm({
        tone: 'warning',
        title: '\u5207\u6362\u586b\u5199\u6a21\u677f',
        badgeText: '\u8986\u76d6\u5f53\u524d\u586b\u5199',
        message: `\u8981\u5e94\u7528\u6a21\u677f\u201c${selectedTemplate.name}\u201d\u5417\uff1f`,
        detail: '\u5f53\u524d\u9875\u9762\u91cc\u7684\u901a\u7528\u5b57\u6bb5\u548c SKU \u884c\u8bbe\u7f6e\u4f1a\u88ab\u8fd9\u4e2a\u6a21\u677f\u8986\u76d6\u3002',
        confirmText: '\u5e94\u7528\u6a21\u677f',
        cancelText: '\u53d6\u6d88'
      });

      if (!confirmed) {
        renderFormTemplateSelect();
        return;
      }
    }

    state.selectedFormTemplateId = selectedTemplate.id;
    getElement('podFormTemplateNameInput').value = selectedTemplate.name;
    applyFormTemplate(selectedTemplate);
    state.formTemplateDropdownOpen = false;
    renderFormTemplateSelect();
  }

  function renderFormTemplateSummary() {}

  function renderFormTemplateSelect() {
    const select = getElement('podFormTemplateSelect');
    const pickerButton = getElement('podFormTemplatePickerButton');
    const pickerLabel = getElement('podFormTemplatePickerLabel');
    const deleteButton = getElement('podDeleteFormTemplateButton');
    const templates = Array.isArray(state.formTemplateSnapshot.templates)
      ? state.formTemplateSnapshot.templates
      : [];

    if (!templates.some((item) => item.id === state.selectedFormTemplateId)) {
      state.selectedFormTemplateId = '';
    }

    select.replaceChildren();

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '\u9009\u62e9\u5df2\u4fdd\u5b58\u6a21\u677f';
    select.appendChild(defaultOption);

    templates.forEach((template) => {
      const option = document.createElement('option');
      option.value = normalizeText(template.id);
      option.textContent = normalizeText(template.name);
      select.appendChild(option);
    });

    select.value = state.selectedFormTemplateId || '';
    pickerLabel.textContent = state.selectedFormTemplateId && getSelectedFormTemplate()
      ? getSelectedFormTemplate().name
      : '\u9009\u62e9\u5df2\u4fdd\u5b58\u6a21\u677f';
    pickerButton.setAttribute('aria-expanded', state.formTemplateDropdownOpen ? 'true' : 'false');
    pickerButton.disabled = false;
    deleteButton.disabled = !state.selectedFormTemplateId || state.deletingFormTemplate;
    renderFormTemplatePickerModal();
  }

  function renderFormTemplatePickerModal() {
    const modal = getElement('podFormTemplateModal');
    const summaryElement = getElement('podFormTemplateModalSummary');
    const listElement = getElement('podFormTemplateModalList');
    const templates = Array.isArray(state.formTemplateSnapshot.templates)
      ? state.formTemplateSnapshot.templates
      : [];

    if (!state.formTemplateDropdownOpen) {
      modal.hidden = true;
      summaryElement.textContent = '';
      listElement.innerHTML = '';
      return;
    }

    modal.hidden = false;

    if (state.loadingFormTemplateSnapshot) {
      summaryElement.textContent = '\u6b63\u5728\u8bfb\u53d6\u6a21\u677f...';
      listElement.innerHTML = '<div class="pod-empty-state">\u6b63\u5728\u8bfb\u53d6\u5df2\u4fdd\u5b58\u6a21\u677f...</div>';
      return;
    }

    summaryElement.textContent = templates.length
      ? `\u5df2\u4fdd\u5b58 ${templates.length} \u4e2a\u586b\u5199\u6a21\u677f`
      : '\u6682\u65e0\u5df2\u4fdd\u5b58\u6a21\u677f';

    if (!templates.length) {
      listElement.innerHTML = '<div class="pod-empty-state">\u8fd8\u6ca1\u6709\u5df2\u4fdd\u5b58\u7684\u586b\u5199\u6a21\u677f</div>';
      return;
    }

    listElement.innerHTML = templates.map((template) => {
      const templateId = normalizeText(template.id);
      const templateName = normalizeText(template.name) || '\u672a\u547d\u540d\u6a21\u677f';
      const updatedText = normalizeText(template.updatedAt)
        ? `\u6700\u8fd1\u66f4\u65b0\uff1a${formatTime(template.updatedAt)}`
        : '\u672a\u8bb0\u5f55\u66f4\u65b0\u65f6\u95f4';
      const isActive = templateId === state.selectedFormTemplateId;

      return `
        <button
          class="pod-form-template-option${isActive ? ' is-active' : ''}"
          type="button"
          data-form-template-id="${escapeHtml(templateId)}"
          role="option"
          aria-selected="${isActive ? 'true' : 'false'}"
        >
          <span class="pod-form-template-option-name">${escapeHtml(templateName)}</span>
          <span class="pod-form-template-option-meta">${escapeHtml(updatedText)}</span>
        </button>
      `;
    }).join('');
  }

  function fillEditorFields() {
    document.querySelectorAll('[data-global-product-field]').forEach((element) => {
      const fieldName = normalizeText(element.getAttribute('data-global-product-field'));

      if (!fieldName) {
        return;
      }

      element.value = normalizeGlobalProductFieldValue(fieldName, state.globalProductSettings[fieldName]);
    });

    getElement('podAiTitlePrefixInput').value = state.aiTitlePrefix;
    getElement('podAiTitleSuffixInput').value = state.aiTitleSuffix;
    getElement('podAiTitleExtraPromptInput').value = state.aiTitleExtraPrompt;
    getElement('podAiTitleMaxLengthInput').value = state.aiTitleMaxLength;
    getElement('podAiTitleLanguageSelect').value = state.aiTitleLanguage;
  }

  function renderSkuImageSelect(row, optionItems) {
    const currentValue = normalizePositiveIntegerString(row && row.skuImage);
    const options = [
      '<option value="">\u672a\u9009\u62e9</option>',
      ...optionItems.map((item) => {
        const selected = item.value === currentValue ? ' selected' : '';
        return `<option value="${escapeHtml(item.value)}"${selected}>${escapeHtml(item.label)}</option>`;
      })
    ];

    return `
      <select class="pod-sku-table-input pod-sku-table-select" data-sku-config-field="skuImage" data-sku-row-key="${escapeHtml(row.key)}">
        ${options.join('')}
      </select>
    `;
  }

  function renderSkuEditor() {
    const summaryElement = getElement('podSkuEditorSummary');
    const container = getElement('podSkuTableBody');
    const skuRows = getSkuEditorRows(state.globalProductSettings);
    const skuImageOptionItems = getSkuImageOptionItems(skuRows);

    if (!skuRows.length) {
      summaryElement.textContent = '\u5df2\u751f\u6210 1 \u884c\u9ed8\u8ba4 SKU\uff0c\u53ef\u76f4\u63a5\u914d\u7f6e\u552e\u4ef7\u3001\u5e93\u5b58\u3001\u91cd\u91cf\u548c\u5c3a\u5bf8\u3002';
      container.innerHTML = `
        <div class="pod-empty-state">
          \u6b63\u5728\u51c6\u5907 SKU \u884c\u3002
        </div>
      `;
      return;
    }

    summaryElement.textContent = `\u5df2\u751f\u6210 ${skuRows.length} \u884c SKU \u7ec4\u5408\uff0c\u914d\u7f6e\u4f1a\u6309\u884c\u5206\u522b\u4fdd\u5b58\u3002`;
    container.innerHTML = skuRows.map((row) => {
      return `
        <div class="pod-sku-table-row pod-universal-sku-table-row" data-sku-row-key="${escapeHtml(row.key)}">
          <span class="pod-sku-table-value">${escapeHtml(row.specValueOne || '-')}</span>
          <span class="pod-sku-table-value">${escapeHtml(row.specValueTwo || '-')}</span>
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.declaredPrice)}" data-sku-config-field="declaredPrice" data-sku-row-key="${escapeHtml(row.key)}" />
          ${renderSkuImageSelect(row, skuImageOptionItems)}
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.platformSku)}" data-sku-config-field="platformSku" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.stock)}" data-sku-config-field="stock" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.skuWeightKg)}" data-sku-config-field="skuWeightKg" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.skuSize)}" data-sku-config-field="skuSize" data-sku-row-key="${escapeHtml(row.key)}" />
        </div>
      `;
    }).join('');
  }

  function renderProductStatusBadge(status) {
    return `<span class="pod-product-status is-${escapeHtml(status.tone)}" data-product-row-status>${escapeHtml(status.label)}</span>`;
  }

  function syncProductListActiveState() {
    document.querySelectorAll('[data-product-row-id]').forEach((element) => {
      const productId = normalizeText(element.getAttribute('data-product-row-id'));
      element.classList.toggle('is-active', productId === state.activeProductId);
    });
  }

  function syncProductRowStatus(productId) {
    const product = state.products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    const row = Array.from(document.querySelectorAll('[data-product-row-id]')).find((element) => {
      return normalizeText(element.getAttribute('data-product-row-id')) === productId;
    });

    if (!(row instanceof HTMLElement)) {
      return;
    }

    const statusElement = row.querySelector('[data-product-row-status]');

    if (!(statusElement instanceof HTMLElement)) {
      return;
    }

    const status = getProductStatus(product);
    statusElement.className = `pod-product-status is-${status.tone}`;
    statusElement.textContent = status.label;
  }

  function activateProductFromList(productId) {
    if (!state.products.some((product) => product.id === productId)) {
      return;
    }

    if (state.activeProductId === productId) {
      return;
    }

    state.activeProductId = productId;
    syncProductListActiveState();
    renderSkuEditor();
  }

  function renderProductList() {
    const container = getElement('podProductTableBody');
    const products = state.products.slice();

    if (!products.length) {
      container.innerHTML = `
        <div class="pod-empty-state">
          \u8fd8\u6ca1\u6709\u672c\u5730\u5546\u54c1\u6570\u636e\uff0c\u70b9\u51fb\u201c\u5bfc\u5165\u672c\u5730\u5546\u54c1\u201d\u540e\u5373\u53ef\u8f7d\u5165\u3002
        </div>
      `;
      return;
    }

    container.innerHTML = products.map((product) => {
      const status = getProductStatus(product);
      const sourceText = normalizeText(product.sourceFolder) || '\u624b\u52a8\u65b0\u5efa';
      const mainNumberText = getProductMainNumber(product);
      const descriptionImageOrders = normalizeSequenceSelection(product.descriptionImageOrders);
      const descriptionPreviewText = getDescriptionImagePreviewText(product);
      const carouselPreviewText = getCarouselPreviewText(product);
      const titleLengthText = formatTitleCharacterCount(product.title);

      return `
        <article
          class="pod-product-table-row pod-universal-product-table-row ${product.id === state.activeProductId ? 'is-active' : ''}"
          data-product-row-id="${escapeHtml(product.id)}"
        >
          <span class="pod-product-cell pod-product-cell-main">
            <span class="pod-product-name">${escapeHtml(product.localName || '\u672a\u547d\u540d\u5546\u54c1')}</span>
            <span class="pod-product-note">\u6765\u6e90\uff1a${escapeHtml(sourceText)}</span>
          </span>
          <label class="pod-product-cell pod-product-cell-editor">
            <textarea
              class="pod-product-inline-input"
              rows="3"
              placeholder="\u4ea7\u54c1\u540d\u79f0"
              maxlength="255"
              data-product-list-field="title"
              data-product-list-row-id="${escapeHtml(product.id)}"
            >${escapeHtml(product.title)}</textarea>
            <span class="pod-product-input-meta">
              <span class="pod-product-note pod-product-title-count" data-product-title-count>${escapeHtml(titleLengthText)}</span>
            </span>
          </label>
          <span class="pod-product-cell">
            <span class="pod-product-note pod-product-preview-note">${escapeHtml(mainNumberText || '-')}</span>
          </span>
          <span class="pod-product-cell">
            <span class="pod-product-note pod-product-preview-note">${escapeHtml(carouselPreviewText)}</span>
          </span>
          <label class="pod-product-cell pod-product-cell-editor">
            <textarea
              class="pod-product-inline-input"
              rows="3"
              placeholder="\u8be6\u60c5\u56fe\u987a\u5e8f"
              data-product-list-field="descriptionImageOrders"
              data-product-list-row-id="${escapeHtml(product.id)}"
            >${escapeHtml(descriptionImageOrders)}</textarea>
            <span class="pod-product-note pod-product-preview-note" data-product-description-preview>${escapeHtml(descriptionPreviewText)}</span>
          </label>
          <span class="pod-product-cell">
            ${renderProductStatusBadge(status)}
          </span>
        </article>
      `;
    }).join('');
  }

  function renderActionButtonStates() {
    const importButton = getElement('podImportProductsButton');
    const uploadModeSelect = getElement('podImageUploadModeSelect');
    const uploadButton = getElement('podBatchUploadCosButton');
    const exportButton = getElement('podExportTableButton');
    const batchPresetCarouselButton = getElement('podBatchPresetCarouselButton');
    const batchPresetDescriptionButton = getElement('podBatchPresetDescriptionButton');
    const clearButton = getElement('podClearProductsButton');
    const stopGuardActive = isCosUploadStopGuardActive();
    const uploadDefaultLabel = '\u6279\u91cf\u4e0a\u4f20\u56fe\u7247';
    const uploadStoppingLabel = '\u505c\u6b62\u4e0a\u4f20';
    const uploadStoppingBusyLabel = '\u505c\u6b62\u4e2d...';
    const uploadStartingLabel = '\u4e0a\u4f20\u542f\u52a8\u4e2d...';
    const exportDefaultLabel = '\u5bfc\u51fa\u8868\u683c';

    importButton.title = normalizeText(state.lastImportDirectoryPath)
      ? `\u4e0a\u6b21\u5bfc\u5165\u76ee\u5f55\uff1a${state.lastImportDirectoryPath}`
      : '';

    uploadModeSelect.value = normalizeImageUploadMode(state.imageUploadMode);
    uploadModeSelect.disabled = state.uploadingCosImages || state.stoppingCosImages;
    uploadButton.dataset.defaultLabel = uploadDefaultLabel;
    uploadButton.textContent = state.uploadingCosImages
      ? (state.stoppingCosImages ? uploadStoppingBusyLabel : (stopGuardActive ? uploadStartingLabel : uploadStoppingLabel))
      : uploadDefaultLabel;
    exportButton.textContent = exportDefaultLabel;
    uploadButton.disabled = state.uploadingCosImages ? (state.stoppingCosImages || stopGuardActive) : false;
    exportButton.disabled = state.exportingTable || state.uploadingCosImages || state.stoppingCosImages || !state.products.length;
    importButton.disabled = state.uploadingCosImages || state.stoppingCosImages;
    clearButton.disabled = state.uploadingCosImages || state.stoppingCosImages || !state.products.length;
    batchPresetCarouselButton.disabled = state.uploadingCosImages || state.stoppingCosImages || !state.products.length;
    batchPresetDescriptionButton.disabled = state.uploadingCosImages || state.stoppingCosImages || !state.products.length || !getDescriptionPresetCandidates().length;
    renderCosUploadProgressText();
    renderAiTitleControls();
  }

  function renderAll() {
    renderTemplateStatus();
    renderFormTemplateSummary();
    renderFormTemplateSelect();
    renderProductList();
    fillEditorFields();
    renderSkuEditor();
    renderActionButtonStates();
    renderCarouselPresetDialog();
    renderDescriptionPresetDialog();
  }

  function addProducts(products) {
    const nextProducts = Array.isArray(products) ? products.filter(Boolean) : [];

    if (!nextProducts.length) {
      return;
    }

    syncGlobalProductSettingsToProducts(nextProducts);
    nextProducts.forEach((product) => {
      applyImportedSourceMappingsToProduct(product);
    });
    state.products.push(...nextProducts);

    if (!getActiveProduct()) {
      state.activeProductId = nextProducts[0].id;
    }
  }

  async function handleClearProducts() {
    if (!state.products.length) {
      return;
    }

    if (!(await getDialogBridge().confirm({
      tone: 'danger',
      title: '\u6e05\u7a7a\u5546\u54c1\u5217\u8868',
      badgeText: '\u4e0d\u53ef\u64a4\u9500',
      message: '\u786e\u8ba4\u6e05\u7a7a\u5f53\u524d\u672c\u5730\u5546\u54c1\u5217\u8868\u5417\uff1f',
      detail: '\u6e05\u7a7a\u540e\uff0c\u5f53\u524d\u7a97\u53e3\u91cc\u7684\u672c\u5730\u5546\u54c1\u548c SKU \u884c\u8bbe\u7f6e\u4f1a\u88ab\u79fb\u9664\u3002',
      confirmText: '\u786e\u8ba4\u6e05\u7a7a',
      cancelText: '\u53d6\u6d88'
    }))) {
      return;
    }

    state.products = [];
    state.activeProductId = '';
    renderAll();
    showWindowNotice('\u672c\u5730\u5546\u54c1\u5217\u8868\u5df2\u6e05\u7a7a\u3002', 'warning');
  }

  function classifyExplicitSection(fileName, relativePath) {
    const text = `${normalizeText(fileName)} ${normalizeText(relativePath)}`.toLowerCase();

    if (/(preview|mockup)/.test(text)) {
      return 'preview';
    }

    if (/(detail|asset|size)/.test(text)) {
      return 'assets';
    }

    if (/(carousel|banner|main)/.test(text)) {
      return 'carousel';
    }

    return '';
  }

  function getImportedProductGroup(file) {
    const relativePath = normalizeText(file && file.webkitRelativePath);
    const segments = relativePath.split('/').filter(Boolean);

    if (segments.length >= 3) {
      const folderSegments = segments.slice(0, -1);
      const productFolderSegments = folderSegments.slice(-2);
      const productKey = normalizeText(productFolderSegments[productFolderSegments.length - 1]);

      return {
        productKey: productKey || '\u672a\u547d\u540d\u5546\u54c1',
        sourceFolder: folderSegments.join('/')
      };
    }

    if (segments.length === 2) {
      return {
        productKey: normalizeText(segments[0]) || '\u672a\u547d\u540d\u5546\u54c1',
        sourceFolder: segments[0]
      };
    }

    return {
      productKey: '\u6839\u76ee\u5f55\u5546\u54c1',
      sourceFolder: ''
    };
  }

  function buildProductsFromImportedFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    const groupedProducts = new Map();

    files.forEach((file) => {
      const groupInfo = getImportedProductGroup(file);
      const groupKey = `${groupInfo.sourceFolder}__${groupInfo.productKey}`;
      const filePath = getLocalFilePath(file);

      if (!groupedProducts.has(groupKey)) {
        groupedProducts.set(groupKey, {
          localName: groupInfo.productKey,
          sourceFolder: groupInfo.sourceFolder,
          materials: {
            carousel: [],
            assets: [],
            preview: []
          },
          materialPathMap: createEmptyMaterialPathMap(),
          pendingItems: [],
          pendingPathMap: {}
        });
      }

      const group = groupedProducts.get(groupKey);
      const fileName = normalizeImportedMaterialName(file && file.name, {
        productKey: groupInfo.productKey,
        sourceFolder: groupInfo.sourceFolder,
        relativePath: file && file.webkitRelativePath
      }) || '\u672a\u547d\u540d\u56fe\u7247';
      const explicitSection = classifyExplicitSection(fileName, file && file.webkitRelativePath);
      const fileKey = getMaterialNameKey(fileName);

      if (explicitSection) {
        group.materials[explicitSection].push(fileName);

        if (fileKey && filePath && !group.materialPathMap[explicitSection][fileKey]) {
          group.materialPathMap[explicitSection][fileKey] = filePath;
        }
      } else {
        group.pendingItems.push(fileName);

        if (fileKey && filePath && !group.pendingPathMap[fileKey]) {
          group.pendingPathMap[fileKey] = filePath;
        }
      }
    });

    return Array.from(groupedProducts.values()).map((group) => {
      const pendingItems = group.pendingItems.slice();
      const carouselItems = group.materials.carousel.slice();
      const assetsItems = group.materials.assets.slice();
      const carouselPathMap = {
        ...normalizeMaterialPathMap(group.materialPathMap).carousel
      };
      const assetsPathMap = {
        ...normalizeMaterialPathMap(group.materialPathMap).assets
      };
      const previewPathMap = {
        ...normalizeMaterialPathMap(group.materialPathMap).preview
      };

      while (pendingItems.length) {
        const nextItemName = pendingItems.shift();
        const nextItemKey = getMaterialNameKey(nextItemName);

        carouselItems.push(nextItemName);

        if (nextItemKey && group.pendingPathMap[nextItemKey] && !carouselPathMap[nextItemKey]) {
          carouselPathMap[nextItemKey] = group.pendingPathMap[nextItemKey];
        }
      }

      assetsItems.push(...pendingItems);
      pendingItems.forEach((itemName) => {
        const itemKey = getMaterialNameKey(itemName);

        if (itemKey && group.pendingPathMap[itemKey] && !assetsPathMap[itemKey]) {
          assetsPathMap[itemKey] = group.pendingPathMap[itemKey];
        }
      });

      return createEmptyProduct({
        localName: group.localName,
        sourceFolder: group.sourceFolder,
        materials: {
          carousel: carouselItems,
          assets: assetsItems,
          preview: group.materials.preview.slice()
        },
        materialPathMap: {
          carousel: carouselPathMap,
          assets: assetsPathMap,
          preview: previewPathMap
        }
      });
    });
  }

  function handleImportProducts(fileList, options = {}) {
    const explicitDirectoryPath = normalizeText(options && options.directoryPath);
    const products = buildProductsFromImportedFiles(fileList);

    if (!products.length) {
      if (explicitDirectoryPath) {
        state.lastImportDirectoryPath = explicitDirectoryPath;
        scheduleWorkspaceStateSave({
          immediate: true,
          showErrorNotice: true
        });
      }

      showWindowNotice('\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u5bfc\u5165\u7684\u672c\u5730\u5546\u54c1\u56fe\u7247\u3002', 'warning');
      return;
    }

    addProducts(products);
    state.lastImportDirectoryPath = explicitDirectoryPath || state.lastImportDirectoryPath;
    state.activeProductId = products[0].id;
    renderAll();
    scheduleWorkspaceStateSave({
      immediate: true,
      showErrorNotice: true
    });
    showWindowNotice(
      `\u5df2\u4ece\u672c\u5730\u76ee\u5f55\u8f7d\u5165 ${products.length} \u5957\u5546\u54c1\uff0c\u5e76\u5df2\u751f\u6210\u4ea7\u54c1\u4e3b\u7f16\u53f7\u548c\u4ea7\u54c1\u540d\u79f0\u3002`,
      'success'
    );
  }

  async function openImportProductsDialog() {
    try {
      const result = await getFeatureCenterBridge().selectPodUploadSheetMiaoshouUniversalImportDirectory({
        defaultPath: state.lastImportDirectoryPath
      });

      if (!result || result.canceled) {
        return;
      }

      handleImportProducts(result.files, {
        directoryPath: normalizeText(result.directoryPath)
      });
    } catch (error) {
      showWindowNotice(
        '\u9009\u62e9\u672c\u5730\u5546\u54c1\u76ee\u5f55\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    }
  }

  async function loadTemplateSnapshot(options = {}) {
    const { showErrorNotice = false, syncLatest = false } = options;

    state.loadingSnapshot = true;
    renderTemplateStatus();

    try {
      state.snapshot = syncLatest
        ? await getFeatureCenterBridge().syncPodUploadSheetMiaoshouUniversalTemplates()
        : await getFeatureCenterBridge().getPodUploadSheetMiaoshouUniversalTemplateSnapshot();
    } catch (error) {
      if (syncLatest) {
        try {
          state.snapshot = await getFeatureCenterBridge().getPodUploadSheetMiaoshouUniversalTemplateSnapshot();
        } catch (snapshotError) {
          if (showErrorNotice) {
            showWindowNotice(
              '\u6a21\u677f\u72b6\u6001\u8bfb\u53d6\u5931\u8d25\uff1a' + (normalizeText(snapshotError && snapshotError.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
              'danger'
            );
          }
        }
      } else if (showErrorNotice) {
        showWindowNotice(
          '\u6a21\u677f\u72b6\u6001\u8bfb\u53d6\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
          'danger'
        );
      }
    } finally {
      state.loadingSnapshot = false;
      renderTemplateStatus();
    }
  }

  async function exportTable(button) {
    if (state.exportingTable) {
      return;
    }

    if (state.uploadingCosImages || state.stoppingCosImages) {
      showWindowNotice('\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1\u8fdb\u884c\u4e2d\uff0c\u8bf7\u5148\u7b49\u5f85\u5b8c\u6210\u6216\u505c\u6b62\u540e\u518d\u5bfc\u51fa\u3002', 'warning');
      return;
    }

    if (!state.products.length) {
      showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u5546\u54c1\u6570\u636e\u3002', 'warning');
      return;
    }

    state.exportingTable = true;
    toggleButtonBusy(button, true, '\u5bfc\u51fa\u4e2d...');
    renderActionButtonStates();

    try {
      const result = await getFeatureCenterBridge().exportPodUploadSheetMiaoshouUniversalTable({
        templateId: UNIVERSAL_TEMPLATE_ID,
        products: state.products
      });

      if (result && result.canceled) {
        showWindowNotice('\u5df2\u53d6\u6d88\u5bfc\u51fa\u3002', 'warning');
        return;
      }

      showWindowNotice(
        `\u5df2\u5bfc\u51fa ${Number.parseInt(result && result.rowCount, 10) || 0} \u884c\u5230 ${normalizeText(result && result.filePath) || '\u76ee\u6807\u6587\u4ef6'}`,
        'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u5bfc\u51fa\u8868\u683c\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.exportingTable = false;
      toggleButtonBusy(button, false, '');
      renderActionButtonStates();
    }
  }

  async function loadFormTemplateSnapshot(options = {}) {
    const { showErrorNotice = false } = options;

    state.loadingFormTemplateSnapshot = true;
    renderFormTemplateSummary();
    renderFormTemplateSelect();

    try {
      state.formTemplateSnapshot = normalizeFormTemplateSnapshot(
        await getFeatureCenterBridge().getPodUploadSheetMiaoshouUniversalFormTemplates()
      );
    } catch (error) {
      if (showErrorNotice) {
        showWindowNotice(
          '\u5df2\u4fdd\u5b58\u6a21\u677f\u5217\u8868\u8bfb\u53d6\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
          'danger'
        );
      }
    } finally {
      state.loadingFormTemplateSnapshot = false;
      renderFormTemplateSummary();
      renderFormTemplateSelect();
    }
  }

  function applyFormTemplate(template) {
    if (!template) {
      return;
    }

    const normalizedFields = FORM_TEMPLATE_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = normalizeFormTemplateFieldValue(fieldName, template.fields && template.fields[fieldName]);
      return result;
    }, {});

    state.aiTitlePrefix = normalizeText(normalizedFields.aiTitlePrefix);
    state.aiTitleSuffix = normalizeText(normalizedFields.aiTitleSuffix);
    state.aiTitleExtraPrompt = normalizeText(normalizedFields.aiTitleExtraPrompt);
    state.aiTitleMaxLength = normalizeAiTitleLengthInput(normalizedFields.aiTitleMaxLength);
    state.aiTitleLanguage = normalizeGlobalProductFieldValue('aiTitleLanguage', normalizedFields.aiTitleLanguage);

    state.globalProductSettings = {
      ...DEFAULT_GLOBAL_PRODUCT_SETTINGS,
      ...normalizedFields,
      skuConfigMap: cloneSkuConfigMap(template.skuConfigMap)
    };

    applyFormTemplateBatchPreset(template.batchPreset);
    syncSkuConfigMapWithCurrentSpecs(state.globalProductSettings);
    syncGlobalProductSettingsToProducts();
    renderAll();
  }

  async function saveCurrentFormTemplate(button) {
    if (state.savingFormTemplate) {
      return;
    }

    const nameInput = getElement('podFormTemplateNameInput');
    const selectedTemplate = getSelectedFormTemplate();
    const templateName = normalizeText(nameInput.value) || normalizeText(selectedTemplate && selectedTemplate.name);
    const targetTemplateId = selectedTemplate && templateName === normalizeText(selectedTemplate.name)
      ? selectedTemplate.id
      : '';

    if (!templateName) {
      showWindowNotice('\u8bf7\u5148\u586b\u5199\u6a21\u677f\u540d\u79f0\uff0c\u518d\u4fdd\u5b58\u5f53\u524d\u586b\u5199\u5185\u5bb9\u3002', 'warning');
      nameInput.focus();
      return;
    }

    state.savingFormTemplate = true;
    toggleButtonBusy(button, true, '\u4fdd\u5b58\u4e2d...');

    try {
      const result = await getFeatureCenterBridge().savePodUploadSheetMiaoshouUniversalFormTemplate({
        templateId: targetTemplateId,
        templateName,
        fields: {
          ...buildCurrentFormTemplateFields(),
          aiTitlePrefix: state.aiTitlePrefix,
          aiTitleSuffix: state.aiTitleSuffix,
          aiTitleExtraPrompt: state.aiTitleExtraPrompt,
          aiTitleMaxLength: state.aiTitleMaxLength,
          aiTitleLanguage: state.aiTitleLanguage
        },
        skuConfigMap: cloneSkuConfigMap(state.globalProductSettings.skuConfigMap),
        batchPreset: buildCurrentFormTemplateBatchPreset()
      });

      state.formTemplateSnapshot = normalizeFormTemplateSnapshot(result);
      state.selectedFormTemplateId = normalizeText(result && result.templateId);
      nameInput.value = templateName;
      renderFormTemplateSummary();
      renderFormTemplateSelect();
      showWindowNotice(
        result && result.cloudSynced === false
          ? ('\u6a21\u677f\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u5931\u8d25' + (normalizeText(result.warning) ? '\uff1a' + normalizeText(result.warning) : ''))
          : `\u5df2\u4fdd\u5b58\u586b\u5199\u6a21\u677f\uff1a${templateName}`,
        result && result.cloudSynced === false ? 'warning' : 'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u4fdd\u5b58\u586b\u5199\u6a21\u677f\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.savingFormTemplate = false;
      toggleButtonBusy(button, false, '');
      renderFormTemplateSelect();
    }
  }

  async function deleteSelectedFormTemplate(button) {
    const selectedTemplate = getSelectedFormTemplate();

    if (!selectedTemplate) {
      showWindowNotice('\u8bf7\u5148\u9009\u62e9\u8981\u5220\u9664\u7684\u586b\u5199\u6a21\u677f\u3002', 'warning');
      return;
    }

    if (!(await getDialogBridge().confirm({
      tone: 'danger',
      title: '\u5220\u9664\u586b\u5199\u6a21\u677f',
      badgeText: '\u4e0d\u53ef\u64a4\u9500',
      message: `\u786e\u8ba4\u5220\u9664\u6a21\u677f\u201c${selectedTemplate.name}\u201d\u5417\uff1f`,
      detail: '\u5220\u9664\u540e\uff0c\u8fd9\u4e2a\u6a21\u677f\u5c06\u4e0d\u518d\u51fa\u73b0\u5728\u540e\u7eed\u7684\u6a21\u677f\u9009\u62e9\u5217\u8868\u4e2d\u3002',
      confirmText: '\u5220\u9664\u6a21\u677f',
      cancelText: '\u53d6\u6d88'
    }))) {
      return;
    }

    state.deletingFormTemplate = true;
    toggleButtonBusy(button, true, '\u5220\u9664\u4e2d...');
    renderFormTemplateSelect();

    try {
      const result = await getFeatureCenterBridge().deletePodUploadSheetMiaoshouUniversalFormTemplate({
        templateId: selectedTemplate.id
      });

      state.formTemplateSnapshot = normalizeFormTemplateSnapshot(result);
      state.selectedFormTemplateId = '';
      getElement('podFormTemplateNameInput').value = '';
      renderFormTemplateSummary();
      renderFormTemplateSelect();
      showWindowNotice(
        result && result.cloudSynced === false
          ? ('\u6a21\u677f\u5df2\u4ece\u672c\u5730\u5220\u9664\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u5931\u8d25' + (normalizeText(result.warning) ? '\uff1a' + normalizeText(result.warning) : ''))
          : `\u5df2\u5220\u9664\u586b\u5199\u6a21\u677f\uff1a${selectedTemplate.name}`,
        result && result.cloudSynced === false ? 'warning' : 'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u5220\u9664\u586b\u5199\u6a21\u677f\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.deletingFormTemplate = false;
      toggleButtonBusy(button, false, '');
      renderFormTemplateSelect();
    }
  }

  async function handleStopCosImageUpload() {
    if (!state.uploadingCosImages || state.stoppingCosImages) {
      return;
    }

    if (isCosUploadStopGuardActive()) {
      return;
    }

    const runId = normalizeText(state.cosUploadRunId);

    if (!runId) {
      state.uploadingCosImages = false;
      state.stoppingCosImages = false;
      renderActionButtonStates();
      showWindowNotice('\u5f53\u524d\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1\u72b6\u6001\u5df2\u91cd\u7f6e\uff0c\u8bf7\u91cd\u65b0\u5f00\u59cb\u4e0a\u4f20\u3002', 'warning');
      return;
    }

    state.stoppingCosImages = true;
    state.cosUploadSnapshot = createCosUploadProgressSnapshot({
      ...state.cosUploadSnapshot,
      runState: 'stopping'
    });
    renderActionButtonStates();

    try {
      const result = await getFeatureCenterCosUploadBridge().cancelPodUploadSheetMiaoshouUniversalCosImages({ runId });

      if (!result || !result.canceled) {
        state.stoppingCosImages = false;
        renderActionButtonStates();
        showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u505c\u6b62\u7684\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1\u3002', 'warning');
        return;
      }

      showWindowNotice('\u5df2\u53d1\u9001\u505c\u6b62\u4e0a\u4f20\u8bf7\u6c42\uff0c\u6b63\u5728\u7b49\u5f85\u5f53\u524d\u4efb\u52a1\u7ed3\u675f\u3002', 'warning');
    } catch (error) {
      state.stoppingCosImages = false;
      renderActionButtonStates();
      showWindowNotice(
        '\u505c\u6b62\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    }
  }

  async function handleUploadCosImages() {
    if (state.uploadingCosImages || state.stoppingCosImages) {
      return;
    }

    const uploadableEntries = getUploadableImageEntries();

    if (!uploadableEntries.length) {
      showWindowNotice(
        hasLocalMaterialItems()
          ? '\u5df2\u68c0\u6d4b\u5230\u672c\u5730\u5546\u54c1\u56fe\u7247\uff0c\u4f46\u672a\u8bfb\u53d6\u5230\u6587\u4ef6\u8def\u5f84\uff0c\u8bf7\u5173\u95ed\u91cd\u5f00\u7a97\u53e3\u540e\u91cd\u65b0\u5bfc\u5165\u3002'
          : '\u5f53\u524d\u6ca1\u6709\u53ef\u4e0a\u4f20\u7684\u672c\u5730\u56fe\u7247\u3002',
        'warning'
      );
      return;
    }

    state.uploadingCosImages = true;
    state.stoppingCosImages = false;
    state.cosUploadRunId = createCosUploadRunId();
    state.cosUploadSnapshot = createCosUploadProgressSnapshot({
      runState: 'running',
      totalCount: 0,
      completedCount: 0,
      successCount: 0,
      uploadedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      canceledCount: 0,
      canceled: false,
      label: ''
    });
    startCosUploadStopGuard();
    renderActionButtonStates();

    try {
      const uploadPromise = getFeatureCenterCosUploadBridge().uploadPodUploadSheetMiaoshouUniversalCosImages({
        runId: state.cosUploadRunId,
        products: state.products,
        imageUploadMode: normalizeImageUploadMode(state.imageUploadMode)
      });
      startCosUploadProgressPolling();
      const result = await uploadPromise;
      const successCount = Number(result && result.successCount) || 0;
      const uploadedCount = Number(result && result.uploadedCount) || 0;
      const cachedCount = Number(result && result.cachedCount) || 0;
      const failedCount = Number(result && result.failedCount) || 0;
      const canceledCount = Number(result && result.canceledCount) || 0;

      state.cosUploadSnapshot = createCosUploadProgressSnapshot({
        updatedAt: normalizeText(result && result.updatedAt),
        runState: result && result.canceled ? 'canceled' : 'completed',
        canceled: Boolean(result && result.canceled),
        totalCount: Number(result && result.totalCount) || 0,
        completedCount: Number(result && result.totalCount) || 0,
        successCount,
        uploadedCount,
        cachedCount,
        failedCount,
        canceledCount,
        label: ''
      });
      renderActionButtonStates();

      if (result && result.canceled) {
        const canceledSummaryParts = [
          `\u56fe\u7247\u4e0a\u4f20\u5df2\u505c\u6b62\uff0c\u6210\u529f ${successCount} \u5f20`,
          `\u65b0\u4f20 ${uploadedCount} \u5f20`,
          `\u7f13\u5b58 ${cachedCount} \u5f20`,
          `\u505c\u6b62 ${canceledCount} \u5f20`
        ];

        if (failedCount > 0) {
          canceledSummaryParts.push(`\u5176\u4e2d\u5931\u8d25 ${failedCount} \u5f20`);
        }

        showWindowNotice(
          `${canceledSummaryParts.join('\uff0c')}\u3002`,
          'warning'
        );
        return;
      }

      showWindowNotice(
        `\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210\uff0c\u6210\u529f ${successCount} \u5f20\uff0c\u65b0\u4f20 ${uploadedCount} \u5f20\uff0c\u7f13\u5b58 ${cachedCount} \u5f20\uff0c\u5931\u8d25 ${failedCount} \u5f20\u3002`,
        failedCount > 0 ? 'warning' : 'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      stopCosUploadProgressPolling();
      state.uploadingCosImages = false;
      state.stoppingCosImages = false;
      state.cosUploadRunId = '';
      resetCosUploadStopGuard();
      renderActionButtonStates();
    }
  }

  async function handleStopAiTitles() {
    if (!state.generatingAiTitles || state.stoppingAiTitles) {
      return;
    }

    state.stoppingAiTitles = true;
    renderAiTitleControls();

    try {
      const result = await getFeatureCenterBridge().cancelPodUploadSheetMiaoshouAiTitles({
        runId: state.aiTitleRunId
      });

      if (!result || !result.canceled) {
        state.stoppingAiTitles = false;
        renderAiTitleControls();
        showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u505c\u6b62\u7684 AI \u6807\u9898\u4efb\u52a1\u3002', 'warning');
        return;
      }

      showWindowNotice('\u5df2\u53d1\u9001\u505c\u6b62\u8bf7\u6c42\uff0c\u6b63\u5728\u7b49\u5f85\u5f53\u524d\u4efb\u52a1\u7ed3\u675f\u3002', 'warning');
    } catch (error) {
      state.stoppingAiTitles = false;
      renderAiTitleControls();
      showWindowNotice(
        '\u505c\u6b62 AI \u6807\u9898\u4efb\u52a1\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    }
  }

  async function handleGenerateAiTitles(options = {}) {
    const { retryFailedOnly = false } = options;
    const targetItems = getAiTitleTargetItems({
      retryFailedOnly
    });

    if (!targetItems.length) {
      showWindowNotice(
        retryFailedOnly
          ? '\u6ca1\u6709\u53ef\u91cd\u8bd5\u7684\u5931\u8d25\u5546\u54c1\uff0c\u6216\u8fd9\u4e9b\u5546\u54c1\u7f3a\u5c11\u9ed8\u8ba4\u7b2c\u4e00\u5f20\u56fe\u7247\u3002'
          : '\u6ca1\u6709\u53ef\u751f\u6210\u6807\u9898\u7684\u5546\u54c1\uff0c\u8bf7\u5148\u5bfc\u5165\u5e26\u56fe\u7247\u8def\u5f84\u7684\u672c\u5730\u5546\u54c1\u3002',
        'warning'
      );
      return;
    }

    state.generatingAiTitles = true;
    state.stoppingAiTitles = false;
    state.retryingFailedAiTitles = retryFailedOnly;
    state.aiTitleRunId = createAiTitleRunId();
    state.aiTitleProgress = createAiTitleProgressSnapshot({
      runState: 'started',
      totalCount: targetItems.length,
      completedCount: 0,
      successCount: 0,
      failedCount: 0,
      canceledCount: 0
    });
    targetItems.forEach(({ product }) => {
      product.aiTitleStatus = 'processing';
      product.aiTitleError = '';
    });
    renderAll();

    try {
      const result = await getFeatureCenterBridge().generatePodUploadSheetMiaoshouAiTitles({
        runId: state.aiTitleRunId,
        entryId: 'pod-upload-sheet-miaoshou-universal-table',
        prefixText: state.aiTitlePrefix,
        suffixText: state.aiTitleSuffix,
        extraPrompt: state.aiTitleExtraPrompt,
        targetLength: state.aiTitleMaxLength,
        outputLanguage: state.aiTitleLanguage,
        products: targetItems.map(({ product, primaryImage }) => {
          return {
            id: product.id,
            localName: product.localName,
            sourceFolder: product.sourceFolder,
            mainNumber: getProductMainNumber(product),
            categoryId: '',
            categoryLabel: '',
            imageName: primaryImage.name,
            imagePath: primaryImage.path
          };
        })
      });

      const resultItems = Array.isArray(result && result.items) ? result.items : [];
      const resultMap = new Map(resultItems.map((item) => [normalizeText(item && item.id), item]));
      const updatedAt = normalizeText(result && result.updatedAt);
      const successCount = Number(result && result.successCount) || 0;
      const failedCount = Number(result && result.failedCount) || 0;
      const canceledCount = Number(result && result.canceledCount) || 0;
      const taskCanceled = Boolean(result && result.canceled);

      state.aiTitleProgress = createAiTitleProgressSnapshot({
        runState: taskCanceled ? 'canceled' : 'completed',
        totalCount: targetItems.length,
        completedCount: targetItems.length,
        successCount,
        failedCount,
        canceledCount,
        updatedAt
      });

      targetItems.forEach(({ product }) => {
        const item = resultMap.get(product.id);
        applyAiTitleResultToProduct(product, item, updatedAt, taskCanceled);
      });

      renderAll();

      if (taskCanceled) {
        showWindowNotice(
          `AI \u6807\u9898\u4efb\u52a1\u5df2\u505c\u6b62\uff0c\u6210\u529f ${successCount} \u4e2a\uff0c\u5931\u8d25 ${failedCount} \u4e2a\uff0c\u505c\u6b62 ${canceledCount} \u4e2a\u3002`,
          'warning'
        );
      } else {
        showWindowNotice(
          `AI \u6807\u9898\u5904\u7406\u5b8c\u6210\uff0c\u6210\u529f ${successCount} \u4e2a\uff0c\u5931\u8d25 ${failedCount} \u4e2a\u3002`,
          failedCount > 0 ? 'warning' : 'success'
        );
      }
    } catch (error) {
      targetItems.forEach(({ product }) => {
        product.aiTitleStatus = 'failed';
        product.aiTitleError = normalizeText(error && error.message) || '\u6807\u9898\u751f\u6210\u5931\u8d25\u3002';
      });
      renderAll();
      showWindowNotice(
        'AI \u6807\u9898\u5904\u7406\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.generatingAiTitles = false;
      state.stoppingAiTitles = false;
      state.retryingFailedAiTitles = false;
      state.aiTitleRunId = '';
      resetAiTitleProgress();
      renderAll();
    }
  }

  function getCarouselPresetCandidates() {
    const candidateMap = new Map();

    state.products.forEach((product) => {
      const matchedKeys = new Set();

      getAllMaterialItems(product).forEach((itemName) => {
        const key = getMaterialNameKey(itemName);
        const displayName = getCarouselItemDisplayName(product, itemName) || itemName;

        if (!key) {
          return;
        }

        if (!candidateMap.has(key)) {
          candidateMap.set(key, {
            key,
            label: displayName,
            displayNames: [displayName],
            productCount: 0
          });
        } else {
          const candidate = candidateMap.get(key);

          if (candidate.displayNames.indexOf(displayName) < 0) {
            candidate.displayNames.push(displayName);
          }
        }

        if (!matchedKeys.has(key)) {
          matchedKeys.add(key);
          candidateMap.get(key).productCount += 1;
        }
      });
    });

    return Array.from(candidateMap.values()).sort((left, right) => {
      return left.label.localeCompare(right.label, 'zh-CN', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  function getCarouselPresetCandidateMap(candidates = getCarouselPresetCandidates()) {
    return (Array.isArray(candidates) ? candidates : []).reduce((result, candidate) => {
      result.set(candidate.key, candidate);
      return result;
    }, new Map());
  }

  function getCarouselPresetSeedKeys(candidates = getCarouselPresetCandidates()) {
    const availableKeys = new Set((Array.isArray(candidates) ? candidates : []).map((item) => item.key));

    for (const product of state.products) {
      const seedKeys = getCarouselItems(product)
        .map((itemName) => getMaterialNameKey(itemName))
        .filter((key, index, items) => key && availableKeys.has(key) && items.indexOf(key) === index);

      if (seedKeys.length) {
        return seedKeys;
      }
    }

    return [];
  }

  function applyCarouselPresetToProduct(product, selectedKeys) {
    if (!product || typeof product !== 'object') {
      return {
        matched: false,
        updated: false
      };
    }

    const previousMaterials = {
      carousel: mergeMaterialItemsWithPriority(getMaterialItems(product, 'carousel'), []),
      assets: mergeMaterialItemsWithPriority(getMaterialItems(product, 'assets'), []),
      preview: mergeMaterialItemsWithPriority(getMaterialItems(product, 'preview'), [])
    };
    const previousDescriptionImageOrders = normalizeText(product.descriptionImageOrders);
    const previousDescriptionItems = getSelectedCarouselItemsByOrders(product, previousDescriptionImageOrders)
      .map((item) => normalizeText(item && item.name))
      .filter(Boolean);
    const previousSkuConfigMap = cloneSkuConfigMap(product.skuConfigMap);
    const previousSkuImageNameMap = Object.entries(previousSkuConfigMap).reduce((result, [rowKey, entry]) => {
      const orderText = normalizePositiveIntegerString(entry && entry.skuImage);
      const imageName = orderText ? previousMaterials.carousel[Number.parseInt(orderText, 10) - 1] || '' : '';
      result[rowKey] = normalizeText(imageName);
      return result;
    }, {});
    const previousSnapshot = JSON.stringify({
      materials: previousMaterials,
      descriptionImageOrders: previousDescriptionImageOrders,
      skuConfigMap: previousSkuConfigMap
    });
    const selectedItems = (Array.isArray(selectedKeys) ? selectedKeys : []).reduce((result, key) => {
      const match = getAllMaterialItems(product).find((itemName) => getMaterialNameKey(itemName) === key);

      if (match) {
        result.push(match);
      }

      return result;
    }, []);
    const selectedKeySet = new Set(selectedItems.map((itemName) => getMaterialNameKey(itemName)).filter(Boolean));
    const removedCarouselItems = previousMaterials.carousel.filter((itemName) => {
      return !selectedKeySet.has(getMaterialNameKey(itemName));
    });
    const nextCarousel = mergeMaterialItemsWithPriority(selectedItems, []);
    const nextAssets = mergeMaterialItemsWithPriority(
      removedCarouselItems,
      previousMaterials.assets.filter((itemName) => !selectedKeySet.has(getMaterialNameKey(itemName)))
    );
    const nextPreview = mergeMaterialItemsWithPriority(
      previousMaterials.preview.filter((itemName) => !selectedKeySet.has(getMaterialNameKey(itemName))),
      []
    );

    product.materials.carousel = nextCarousel;
    product.materials.assets = nextAssets;
    product.materials.preview = nextPreview;
    product.materialPathMap = {
      carousel: buildSectionMaterialPathMapByItems(product, 'carousel', nextCarousel),
      assets: buildSectionMaterialPathMapByItems(product, 'assets', nextAssets),
      preview: buildSectionMaterialPathMapByItems(product, 'preview', nextPreview)
    };
    product.descriptionImageOrders = getCarouselOrdersByItemNames(nextCarousel, previousDescriptionItems);

    const nextSkuConfigMap = cloneSkuConfigMap(previousSkuConfigMap);
    Object.entries(nextSkuConfigMap).forEach(([rowKey, entry]) => {
      entry.skuImage = getCarouselOrdersByItemNames(nextCarousel, [previousSkuImageNameMap[rowKey]]);
    });
    product.skuConfigMap = nextSkuConfigMap;

    const nextSnapshot = JSON.stringify({
      materials: {
        carousel: mergeMaterialItemsWithPriority(getMaterialItems(product, 'carousel'), []),
        assets: mergeMaterialItemsWithPriority(getMaterialItems(product, 'assets'), []),
        preview: mergeMaterialItemsWithPriority(getMaterialItems(product, 'preview'), [])
      },
      descriptionImageOrders: normalizeText(product.descriptionImageOrders),
      skuConfigMap: cloneSkuConfigMap(product.skuConfigMap)
    });

    return {
      matched: selectedItems.length > 0,
      updated: previousSnapshot !== nextSnapshot
    };
  }

  function applyRandomFirstCarouselPresetToProduct(product, selectedOrders) {
    if (!product || typeof product !== 'object') {
      return {
        matched: false,
        updated: false
      };
    }

    const carouselItems = getCarouselItems(product);
    const validIndexes = (Array.isArray(selectedOrders) ? selectedOrders : [])
      .map((order) => Number.parseInt(order, 10) - 1)
      .filter((index, itemIndex, indexes) => {
        return Number.isInteger(index)
          && index >= 0
          && index < carouselItems.length
          && indexes.indexOf(index) === itemIndex;
      });

    if (validIndexes.length < 2) {
      return {
        matched: false,
        updated: false
      };
    }

    const previousSnapshot = JSON.stringify({
      materials: product.materials,
      descriptionImageOrders: product.descriptionImageOrders,
      skuConfigMap: product.skuConfigMap
    });
    const nextCarousel = carouselItems.slice();
    const shuffledItems = validIndexes.map((index) => carouselItems[index]);

    for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const item = shuffledItems[index];
      shuffledItems[index] = shuffledItems[swapIndex];
      shuffledItems[swapIndex] = item;
    }

    if (
      shuffledItems.length > 1
      && shuffledItems.every((itemName, index) => itemName === carouselItems[validIndexes[index]])
    ) {
      shuffledItems.push(shuffledItems.shift());
    }

    validIndexes.forEach((carouselIndex, selectedIndex) => {
      nextCarousel[carouselIndex] = shuffledItems[selectedIndex];
    });

    product.materials.carousel = nextCarousel;
    product.materialPathMap = {
      ...normalizeMaterialPathMap(product.materialPathMap),
      carousel: buildSectionMaterialPathMapByItems(product, 'carousel', nextCarousel)
    };

    const nextSnapshot = JSON.stringify({
      materials: product.materials,
      descriptionImageOrders: product.descriptionImageOrders,
      skuConfigMap: product.skuConfigMap
    });

    return {
      matched: true,
      updated: previousSnapshot !== nextSnapshot
    };
  }

  function renderPresetCandidateList(candidates, selectedKeys, attrName) {
    const selectedSet = new Set(selectedKeys);

    if (!candidates.length) {
      return '<div class="pod-empty-state">\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u9884\u8bbe\u7684\u56fe\u7247\u6587\u4ef6\u540d\u3002</div>';
    }

    return candidates.map((candidate) => {
      const selectedIndex = selectedKeys.indexOf(candidate.key);
      const isSelected = selectedSet.has(candidate.key);
      const displayNames = Array.isArray(candidate.displayNames) && candidate.displayNames.length
        ? candidate.displayNames
        : [candidate.label];

      return `
        <article class="pod-description-preset-candidate-item ${isSelected ? 'is-selected' : ''}" title="${escapeHtml(displayNames.join('\n'))}">
          <label class="pod-description-preset-candidate-toggle">
            <span class="pod-description-preset-candidate-copy">
              <span class="pod-description-preset-candidate-title">${escapeHtml(candidate.label)}</span>
              <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(candidate.productCount))} \u4e2a\u5546\u54c1</span>
            </span>
            <span class="pod-description-preset-candidate-meta">
              ${isSelected ? `<span class="pod-carousel-order-index">\u7b2c ${escapeHtml(String(selectedIndex + 1))} \u4f4d</span>` : ''}
              <input
                class="pod-description-preset-checkbox"
                type="checkbox"
                ${attrName}="${escapeHtml(candidate.key)}"
                ${isSelected ? 'checked' : ''}
              />
            </span>
          </label>
        </article>
      `;
    }).join('');
  }

  function renderPresetSelectedList(selectedKeys, candidateMap, actionAttrName, indexAttrName, emptyText) {
    if (!selectedKeys.length) {
      return `<div class="pod-empty-state">${escapeHtml(emptyText)}</div>`;
    }

    return selectedKeys.map((key, index) => {
      const candidate = candidateMap.get(key);

      if (!candidate) {
        return '';
      }

      const displayNames = Array.isArray(candidate.displayNames) && candidate.displayNames.length
        ? candidate.displayNames
        : [candidate.label];

      return `
        <article class="pod-carousel-order-item pod-description-preset-selected-item" title="${escapeHtml(displayNames.join('\n'))}">
          <span class="pod-carousel-order-index">${escapeHtml(String(index + 1))}</span>
          <span class="pod-description-preset-candidate-copy">
            <span class="pod-carousel-order-name">${escapeHtml(candidate.label)}</span>
            <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(candidate.productCount))} \u4e2a\u5546\u54c1</span>
          </span>
          <div class="pod-inline-actions">
            <button class="pod-material-action" type="button" ${actionAttrName}="up" ${indexAttrName}="${escapeHtml(String(index))}" ${index === 0 ? 'disabled' : ''}>\u4e0a\u79fb</button>
            <button class="pod-material-action" type="button" ${actionAttrName}="down" ${indexAttrName}="${escapeHtml(String(index))}" ${index === selectedKeys.length - 1 ? 'disabled' : ''}>\u4e0b\u79fb</button>
            <button class="pod-material-action" type="button" ${actionAttrName}="remove" ${indexAttrName}="${escapeHtml(String(index))}">\u79fb\u9664</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function getCarouselPresetRandomOrderImageNames(order) {
    const normalizedOrder = Number.parseInt(order, 10);
    const seenKeys = new Set();

    if (!Number.isInteger(normalizedOrder) || normalizedOrder <= 0) {
      return [];
    }

    return state.products.reduce((result, product) => {
      const itemName = normalizeText(getCarouselItems(product)[normalizedOrder - 1]);
      const key = getMaterialNameKey(itemName);
      const displayName = getCarouselItemDisplayName(product, itemName) || itemName;

      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        result.push(displayName);
      }

      return result;
    }, []);
  }

  function renderCarouselPresetRandomFileNames(itemNames) {
    const normalizedNames = (Array.isArray(itemNames) ? itemNames : [])
      .map((itemName) => normalizeText(itemName))
      .filter(Boolean);

    if (!normalizedNames.length) {
      return '<span class="pod-carousel-preset-random-file-empty">\u6ca1\u6709\u5339\u914d\u5230\u8fd9\u4e2a\u5e8f\u53f7\u7684\u56fe\u7247</span>';
    }

    const visibleNames = normalizedNames.slice(0, 6);
    const remainingCount = Math.max(0, normalizedNames.length - visibleNames.length);

    return `
      <span class="pod-carousel-preset-random-file-list" title="${escapeHtml(normalizedNames.join('\n'))}">
        ${visibleNames.map((itemName) => `
          <span class="pod-carousel-preset-random-file-name">${escapeHtml(itemName)}</span>
        `).join('')}
        ${remainingCount > 0 ? `<span class="pod-carousel-preset-random-file-more">\u8fd8\u6709 ${escapeHtml(String(remainingCount))} \u4e2a\u6587\u4ef6</span>` : ''}
      </span>
    `;
  }

  function renderCarouselPresetRandomOrderList(selectedOrders) {
    if (!selectedOrders.length) {
      return '<div class="pod-empty-state">\u8f93\u5165\u9700\u8981\u968f\u673a\u4e92\u6362\u7684\u4e3b\u56fe\u5e8f\u53f7\u3002</div>';
    }

    return selectedOrders.map((order) => {
      const matchedCount = state.products.reduce((count, product) => {
        return getCarouselItems(product).length >= order ? count + 1 : count;
      }, 0);
      const imageNames = getCarouselPresetRandomOrderImageNames(order);

      return `
        <article class="pod-carousel-order-item pod-description-preset-selected-item pod-carousel-preset-random-order-item">
          <span class="pod-carousel-order-index">${escapeHtml(String(order))}</span>
          <span class="pod-description-preset-candidate-copy">
            <span class="pod-carousel-order-name">\u7b2c ${escapeHtml(String(order))} \u5f20</span>
            <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(matchedCount))} \u4e2a\u5546\u54c1</span>
            ${renderCarouselPresetRandomFileNames(imageNames)}
          </span>
          <div class="pod-inline-actions">
            <button
              class="pod-material-action"
              type="button"
              data-pod-carousel-random-order-remove="${escapeHtml(String(order))}"
            >\u79fb\u9664</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function getCarouselPresetRandomOrderCandidates() {
    const maxOrder = state.products.reduce((maxValue, product) => {
      return Math.max(maxValue, getCarouselItems(product).length);
    }, 0);

    return Array.from({ length: maxOrder }, (unused, index) => index + 1);
  }

  function renderCarouselPresetRandomCandidateList(selectedOrders) {
    const orders = getCarouselPresetRandomOrderCandidates();
    const selectedSet = new Set(selectedOrders);

    if (!orders.length) {
      return '';
    }

    return orders.map((order) => {
      const matchedCount = state.products.reduce((count, product) => {
        return getCarouselItems(product).length >= order ? count + 1 : count;
      }, 0);
      const imageNames = getCarouselPresetRandomOrderImageNames(order);
      const isSelected = selectedSet.has(order);

      return `
        <label
          class="pod-carousel-preset-random-candidate ${isSelected ? 'is-selected' : ''}"
          title="${escapeHtml(imageNames.join('\n'))}"
        >
          <input
            type="checkbox"
            data-pod-carousel-random-order="${escapeHtml(String(order))}"
            ${isSelected ? 'checked' : ''}
          />
          <span>\u7b2c ${escapeHtml(String(order))} \u5f20</span>
          <small>${escapeHtml(String(matchedCount))}/${escapeHtml(String(state.products.length))}</small>
        </label>
      `;
    }).join('');
  }

  function setCarouselPresetRandomOrder(order, checked) {
    const normalizedOrder = Number.parseInt(order, 10);

    if (!Number.isInteger(normalizedOrder) || normalizedOrder <= 0) {
      return;
    }

    const selectedOrders = parseSequenceSelectionNumbers(state.carouselPresetRandomOrdersDraft);
    const existingIndex = selectedOrders.indexOf(normalizedOrder);

    if (checked && existingIndex < 0) {
      selectedOrders.push(normalizedOrder);
    }

    if (!checked && existingIndex >= 0) {
      selectedOrders.splice(existingIndex, 1);
    }

    state.carouselPresetRandomOrdersDraft = selectedOrders.sort((left, right) => left - right).join(',');
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function renderCarouselPresetDialog() {
    const modal = getElement('podCarouselPresetModal');
    const summaryElement = getElement('podCarouselPresetSummary');
    const selectedModeInput = getElement('podCarouselPresetModeSelected');
    const randomFirstModeInput = getElement('podCarouselPresetModeRandomFirst');
    const randomOrdersField = getElement('podCarouselPresetRandomOrdersField');
    const randomOrdersInput = getElement('podCarouselPresetRandomOrdersInput');
    const randomCandidateListElement = getElement('podCarouselPresetRandomCandidateList');
    const randomOrderListElement = getElement('podCarouselPresetRandomOrderList');
    const imageNameLayoutElement = getElement('podCarouselPresetImageNameLayout');
    const candidateListElement = getElement('podCarouselPresetCandidateList');
    const selectedListElement = getElement('podCarouselPresetSelectedList');
    const selectedCountElement = getElement('podCarouselPresetSelectedCount');
    const selectAllButton = getElement('podCarouselPresetSelectAllButton');
    const clearButton = getElement('podCarouselPresetClearButton');
    const saveButton = getElement('podCarouselPresetSaveButton');
    const candidates = getCarouselPresetCandidates();
    const candidateMap = getCarouselPresetCandidateMap(candidates);
    const mode = state.carouselPresetMode === 'random-first' ? 'random-first' : 'selected';

    if (!state.carouselPresetModalOpen) {
      modal.hidden = true;
      summaryElement.textContent = '';
      selectedModeInput.checked = mode === 'selected';
      randomFirstModeInput.checked = mode === 'random-first';
      randomOrdersField.hidden = true;
      randomOrdersInput.value = '';
      randomCandidateListElement.innerHTML = '';
      randomOrderListElement.innerHTML = '';
      imageNameLayoutElement.hidden = false;
      candidateListElement.innerHTML = '';
      selectedListElement.innerHTML = '';
      selectedCountElement.textContent = '0';
      selectAllButton.disabled = true;
      clearButton.disabled = true;
      saveButton.disabled = true;
      return;
    }

    const selectedKeys = (Array.isArray(state.carouselPresetSelectionDraft) ? state.carouselPresetSelectionDraft : [])
      .filter((key, index, items) => key && candidateMap.has(key) && items.indexOf(key) === index);

    state.carouselPresetSelectionDraft = selectedKeys;
    modal.hidden = false;
    selectedModeInput.checked = mode === 'selected';
    randomFirstModeInput.checked = mode === 'random-first';
    randomOrdersField.hidden = mode !== 'random-first';
    imageNameLayoutElement.hidden = mode === 'random-first';

    const normalizedOrdersValue = normalizeSequenceSelection(state.carouselPresetRandomOrdersDraft);
    const selectedOrders = parseSequenceSelectionNumbers(normalizedOrdersValue);

    randomOrdersInput.value = state.carouselPresetRandomOrdersDraft;
    randomCandidateListElement.innerHTML = renderCarouselPresetRandomCandidateList(selectedOrders);
    randomOrderListElement.innerHTML = renderCarouselPresetRandomOrderList(selectedOrders);
    summaryElement.textContent = mode === 'random-first'
      ? `\u5c06\u5728\u5df2\u52fe\u9009\u7684\u4e3b\u56fe\u5e8f\u53f7\u4e4b\u95f4\uff0c\u4e3a ${state.products.length} \u4e2a\u5546\u54c1\u968f\u673a\u4e92\u6362\u56fe\u7247\uff0c\u672a\u52fe\u9009\u5e8f\u53f7\u4fdd\u6301\u539f\u4f4d\u3002`
      : `\u5c06\u9009\u4e2d\u7684\u56fe\u7247\u6279\u91cf\u653e\u5230 ${state.products.length} \u4e2a\u5546\u54c1\u7684\u4e3b\u56fe\u4f4d\u7f6e\u3002`;
    selectedCountElement.textContent = String(selectedKeys.length);
    selectAllButton.disabled = mode !== 'selected';
    clearButton.disabled = mode === 'random-first' ? !selectedOrders.length : !selectedKeys.length;
    saveButton.disabled = !state.products.length || (mode === 'random-first' ? !selectedOrders.length : !selectedKeys.length);
    candidateListElement.innerHTML = renderPresetCandidateList(candidates, selectedKeys, 'data-pod-carousel-preset-candidate');
    selectedListElement.innerHTML = renderPresetSelectedList(
      selectedKeys,
      candidateMap,
      'data-pod-carousel-preset-action',
      'data-pod-carousel-preset-index',
      '\u52fe\u9009\u5de6\u4fa7\u56fe\u7247\u540d\u540e\uff0c\u53ef\u5728\u8fd9\u91cc\u8c03\u6574\u987a\u5e8f\u3002'
    );
  }

  function closeCarouselPresetDialog() {
    state.carouselPresetModalOpen = false;
    state.carouselPresetMode = 'selected';
    state.carouselPresetSelectionDraft = [];
    state.carouselPresetRandomOrdersDraft = '';
    renderCarouselPresetDialog();
  }

  function openCarouselPresetDialog() {
    const candidates = getCarouselPresetCandidates();

    if (!state.products.length) {
      showWindowNotice('\u8bf7\u5148\u5bfc\u5165\u672c\u5730\u5546\u54c1\uff0c\u518d\u6279\u91cf\u9884\u8bbe\u4e3b\u56fe\u3002', 'warning');
      return;
    }

    if (!candidates.length) {
      showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u4e3b\u56fe\u9884\u8bbe\u7684\u56fe\u7247\u6587\u4ef6\u540d\u3002', 'warning');
      return;
    }

    state.carouselPresetModalOpen = true;
    state.carouselPresetMode = normalizeCachedCarouselPresetMode(state.carouselPresetCachedMode);
    state.carouselPresetSelectionDraft = getPreferredPresetSelection(
      candidates,
      state.carouselPresetCachedSelection,
      getCarouselPresetSeedKeys(candidates)
    );
    state.carouselPresetRandomOrdersDraft = normalizeSequenceSelection(state.carouselPresetCachedRandomOrders);
    renderCarouselPresetDialog();
  }

  function setCarouselPresetMode(mode) {
    state.carouselPresetMode = mode === 'random-first' ? 'random-first' : 'selected';
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function toggleCarouselPresetCandidate(candidateKey, checked) {
    const normalizedKey = getMaterialNameKey(candidateKey);
    const selectedKeys = Array.isArray(state.carouselPresetSelectionDraft)
      ? state.carouselPresetSelectionDraft.slice()
      : [];
    const existingIndex = selectedKeys.indexOf(normalizedKey);

    if (checked && existingIndex < 0) {
      selectedKeys.push(normalizedKey);
    }

    if (!checked && existingIndex >= 0) {
      selectedKeys.splice(existingIndex, 1);
    }

    state.carouselPresetSelectionDraft = selectedKeys;
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function movePresetSelection(sourceName, direction, itemIndex) {
    const currentIndex = Number.parseInt(itemIndex, 10);
    const fieldName = sourceName === 'carousel'
      ? 'carouselPresetSelectionDraft'
      : 'descriptionPresetSelectionDraft';
    const selectedKeys = Array.isArray(state[fieldName]) ? state[fieldName].slice() : [];

    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= selectedKeys.length) {
      return;
    }

    if (direction === 'remove') {
      selectedKeys.splice(currentIndex, 1);
      state[fieldName] = selectedKeys;
      if (sourceName === 'carousel') {
        persistCachedCarouselPresetState();
      } else {
        persistCachedDescriptionPresetSelection(selectedKeys);
      }
      sourceName === 'carousel' ? renderCarouselPresetDialog() : renderDescriptionPresetDialog();
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= selectedKeys.length) {
      return;
    }

    [selectedKeys[currentIndex], selectedKeys[targetIndex]] = [selectedKeys[targetIndex], selectedKeys[currentIndex]];
    state[fieldName] = selectedKeys;
    if (sourceName === 'carousel') {
      persistCachedCarouselPresetState();
    } else {
      persistCachedDescriptionPresetSelection(selectedKeys);
    }
    sourceName === 'carousel' ? renderCarouselPresetDialog() : renderDescriptionPresetDialog();
  }

  function saveCarouselPresetDialog() {
    if (state.carouselPresetMode === 'random-first') {
      const selectedOrders = parseSequenceSelectionNumbers(state.carouselPresetRandomOrdersDraft);

      if (selectedOrders.length < 2) {
        showWindowNotice('\u8bf7\u81f3\u5c11\u8f93\u5165 2 \u4e2a\u9700\u8981\u968f\u673a\u4e92\u6362\u7684\u4e3b\u56fe\u5e8f\u53f7\u3002', 'warning');
        return;
      }

      state.carouselPresetRandomOrdersDraft = selectedOrders.join(',');
      persistCachedCarouselPresetState({
        immediate: true
      });

      let matchedCount = 0;
      let updatedCount = 0;

      state.products.forEach((product) => {
        const applyResult = applyRandomFirstCarouselPresetToProduct(product, selectedOrders);

        if (applyResult.matched) {
          matchedCount += 1;
        }

        if (applyResult.updated) {
          updatedCount += 1;
        }
      });

      closeCarouselPresetDialog();
      renderAll();
      showWindowNotice(
        `\u5df2\u6309\u5e8f\u53f7\u968f\u673a\u4e92\u6362\u4e3b\u56fe\uff0c\u5339\u914d ${matchedCount}/${state.products.length} \u4e2a\u5546\u54c1\uff0c\u66f4\u65b0 ${updatedCount} \u4e2a\u5546\u54c1\u3002`,
        matchedCount === state.products.length ? 'success' : 'warning'
      );
      return;
    }

    const selectedKeys = Array.isArray(state.carouselPresetSelectionDraft)
      ? state.carouselPresetSelectionDraft.slice()
      : [];

    if (!selectedKeys.length) {
      showWindowNotice('\u8bf7\u5148\u9009\u62e9\u9700\u8981\u6279\u91cf\u9884\u8bbe\u7684\u4e3b\u56fe\u56fe\u7247\u540d\u3002', 'warning');
      return;
    }

    persistCachedCarouselPresetState({
      immediate: true
    });

    let matchedCount = 0;
    let updatedCount = 0;

    state.products.forEach((product) => {
      const applyResult = applyCarouselPresetToProduct(product, selectedKeys);

      if (applyResult.matched) {
        matchedCount += 1;
      }

      if (applyResult.updated) {
        updatedCount += 1;
      }
    });

    closeCarouselPresetDialog();
    renderAll();
    showWindowNotice(
      `\u5df2\u6279\u91cf\u9884\u8bbe\u4e3b\u56fe\uff0c\u5339\u914d ${matchedCount}/${state.products.length} \u4e2a\u5546\u54c1\uff0c\u66f4\u65b0 ${updatedCount} \u4e2a\u5546\u54c1\u3002`,
      matchedCount === state.products.length ? 'success' : 'warning'
    );
  }

  function getDescriptionPresetCandidates() {
    const candidateMap = new Map();

    state.products.forEach((product) => {
      const matchedKeys = new Set();

      getCarouselItems(product).forEach((itemName) => {
        const key = getMaterialNameKey(itemName);
        const displayName = getCarouselItemDisplayName(product, itemName) || itemName;

        if (!key) {
          return;
        }

        if (!candidateMap.has(key)) {
          candidateMap.set(key, {
            key,
            label: displayName,
            displayNames: [displayName],
            productCount: 0
          });
        } else {
          const candidate = candidateMap.get(key);

          if (candidate.displayNames.indexOf(displayName) < 0) {
            candidate.displayNames.push(displayName);
          }
        }

        if (!matchedKeys.has(key)) {
          matchedKeys.add(key);
          candidateMap.get(key).productCount += 1;
        }
      });
    });

    return Array.from(candidateMap.values()).sort((left, right) => {
      return left.label.localeCompare(right.label, 'zh-CN', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  function getDescriptionPresetCandidateMap(candidates = getDescriptionPresetCandidates()) {
    return (Array.isArray(candidates) ? candidates : []).reduce((result, candidate) => {
      result.set(candidate.key, candidate);
      return result;
    }, new Map());
  }

  function getDescriptionPresetSeedKeys(candidates = getDescriptionPresetCandidates()) {
    const availableKeys = new Set((Array.isArray(candidates) ? candidates : []).map((item) => item.key));

    for (const product of state.products) {
      const seedKeys = getSelectedCarouselItemsByOrders(product, product && product.descriptionImageOrders)
        .map((item) => getMaterialNameKey(item && item.name))
        .filter((key, index, items) => key && availableKeys.has(key) && items.indexOf(key) === index);

      if (seedKeys.length) {
        return seedKeys;
      }
    }

    return [];
  }

  function getDescriptionPresetOrdersForProduct(product, selectedKeys) {
    const carouselItems = getCarouselItems(product);

    return (Array.isArray(selectedKeys) ? selectedKeys : []).reduce((result, key) => {
      const matchIndex = carouselItems.findIndex((itemName) => getMaterialNameKey(itemName) === key);

      if (matchIndex < 0) {
        return result;
      }

      result.push(String(matchIndex + 1));
      return result;
    }, []).join(',');
  }

  function renderDescriptionPresetDialog() {
    const modal = getElement('podDescriptionPresetModal');
    const summaryElement = getElement('podDescriptionPresetSummary');
    const candidateListElement = getElement('podDescriptionPresetCandidateList');
    const selectedListElement = getElement('podDescriptionPresetSelectedList');
    const selectedCountElement = getElement('podDescriptionPresetSelectedCount');
    const clearButton = getElement('podDescriptionPresetClearButton');
    const saveButton = getElement('podDescriptionPresetSaveButton');
    const candidates = getDescriptionPresetCandidates();
    const candidateMap = getDescriptionPresetCandidateMap(candidates);

    if (!state.descriptionPresetModalOpen) {
      modal.hidden = true;
      summaryElement.textContent = '';
      candidateListElement.innerHTML = '';
      selectedListElement.innerHTML = '';
      selectedCountElement.textContent = '0';
      clearButton.disabled = true;
      saveButton.disabled = false;
      return;
    }

    const selectedKeys = (Array.isArray(state.descriptionPresetSelectionDraft) ? state.descriptionPresetSelectionDraft : [])
      .filter((key, index, items) => key && candidateMap.has(key) && items.indexOf(key) === index);

    state.descriptionPresetSelectionDraft = selectedKeys;
    modal.hidden = false;
    summaryElement.textContent = `\u5c06\u9009\u4e2d\u7684\u4e3b\u56fe\u6279\u91cf\u5199\u5165 ${state.products.length} \u4e2a\u5546\u54c1\u7684\u8be6\u60c5\u56fe\u5b57\u6bb5\u3002`;
    selectedCountElement.textContent = String(selectedKeys.length);
    clearButton.disabled = !selectedKeys.length;
    saveButton.disabled = !state.products.length;
    candidateListElement.innerHTML = renderPresetCandidateList(candidates, selectedKeys, 'data-pod-description-preset-candidate');
    selectedListElement.innerHTML = renderPresetSelectedList(
      selectedKeys,
      candidateMap,
      'data-pod-description-preset-action',
      'data-pod-description-preset-index',
      '\u52fe\u9009\u5de6\u4fa7\u56fe\u7247\u540d\u540e\uff0c\u53ef\u5728\u8fd9\u91cc\u8c03\u6574\u987a\u5e8f\u3002'
    );
  }

  function closeDescriptionPresetDialog() {
    state.descriptionPresetModalOpen = false;
    state.descriptionPresetSelectionDraft = [];
    renderDescriptionPresetDialog();
  }

  function openDescriptionPresetDialog() {
    const candidates = getDescriptionPresetCandidates();

    if (!state.products.length) {
      showWindowNotice('\u8bf7\u5148\u5bfc\u5165\u672c\u5730\u5546\u54c1\uff0c\u518d\u6279\u91cf\u9884\u8bbe\u8be6\u60c5\u56fe\u3002', 'warning');
      return;
    }

    if (!candidates.length) {
      showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u8be6\u60c5\u56fe\u9884\u8bbe\u7684\u4e3b\u56fe\u6587\u4ef6\u540d\u3002', 'warning');
      return;
    }

    state.descriptionPresetModalOpen = true;
    state.descriptionPresetSelectionDraft = getPreferredPresetSelection(
      candidates,
      state.descriptionPresetCachedSelection,
      getDescriptionPresetSeedKeys(candidates)
    );
    renderDescriptionPresetDialog();
  }

  function toggleDescriptionPresetCandidate(candidateKey, checked) {
    const normalizedKey = getMaterialNameKey(candidateKey);
    const selectedKeys = Array.isArray(state.descriptionPresetSelectionDraft)
      ? state.descriptionPresetSelectionDraft.slice()
      : [];
    const existingIndex = selectedKeys.indexOf(normalizedKey);

    if (checked && existingIndex < 0) {
      selectedKeys.push(normalizedKey);
    }

    if (!checked && existingIndex >= 0) {
      selectedKeys.splice(existingIndex, 1);
    }

    state.descriptionPresetSelectionDraft = selectedKeys;
    persistCachedDescriptionPresetSelection(selectedKeys);
    renderDescriptionPresetDialog();
  }

  function saveDescriptionPresetDialog() {
    const selectedKeys = Array.isArray(state.descriptionPresetSelectionDraft)
      ? state.descriptionPresetSelectionDraft.slice()
      : [];

    persistCachedDescriptionPresetSelection(selectedKeys, {
      immediate: true
    });

    if (!state.products.length) {
      closeDescriptionPresetDialog();
      return;
    }

    if (!selectedKeys.length) {
      let clearedCount = 0;

      state.products.forEach((product) => {
        if (normalizeText(product && product.descriptionImageOrders)) {
          clearedCount += 1;
        }

        product.descriptionImageOrders = '';
      });

      closeDescriptionPresetDialog();
      renderAll();
      showWindowNotice(
        clearedCount
          ? `\u5df2\u6e05\u7a7a ${clearedCount} \u4e2a\u5546\u54c1\u7684\u8be6\u60c5\u56fe\u9884\u8bbe\u3002`
          : '\u5df2\u6e05\u7a7a\u8be6\u60c5\u56fe\u9884\u8bbe\u3002',
        'success'
      );
      return;
    }

    let matchedCount = 0;
    let updatedCount = 0;

    state.products.forEach((product) => {
      const nextOrders = getDescriptionPresetOrdersForProduct(product, selectedKeys);

      if (nextOrders) {
        matchedCount += 1;
      }

      if (normalizeText(product && product.descriptionImageOrders) !== nextOrders) {
        updatedCount += 1;
      }

      product.descriptionImageOrders = nextOrders;
    });

    closeDescriptionPresetDialog();
    renderAll();
    showWindowNotice(
      `\u5df2\u6279\u91cf\u9884\u8bbe\u8be6\u60c5\u56fe\uff0c\u5339\u914d ${matchedCount}/${state.products.length} \u4e2a\u5546\u54c1\uff0c\u66f4\u65b0 ${updatedCount} \u4e2a\u5546\u54c1\u3002`,
      matchedCount === state.products.length ? 'success' : 'warning'
    );
  }

  function bindProductFieldEvents() {
    document.querySelectorAll('[data-global-product-field]').forEach((element) => {
      const updateField = (options = {}) => {
        const { normalizeValue = true, renderDependentViews = true, syncSkuRows = true } = options;
        const fieldName = normalizeText(element.getAttribute('data-global-product-field'));

        if (!fieldName) {
          return;
        }

        const normalizedValue = normalizeValue
          ? normalizeGlobalProductFieldValue(fieldName, element.value)
          : String(element.value || '').replace(/\r\n/g, '\n');
        state.globalProductSettings[fieldName] = normalizedValue;

        if (normalizeValue && element.value !== normalizedValue) {
          element.value = normalizedValue;
        }

        if (syncSkuRows) {
          syncSkuConfigMapWithCurrentSpecs(state.globalProductSettings);
        }

        syncGlobalProductFieldToProducts(fieldName);

        if (renderDependentViews) {
          renderSkuEditor();
          renderProductList();
        }
      };

      element.addEventListener('input', () => {
        const fieldName = normalizeText(element.getAttribute('data-global-product-field'));
        const isSkuSpecField = ['specValueOne', 'specValueTwo'].includes(fieldName);
        updateField({
          normalizeValue: !isSkuSpecField,
          renderDependentViews: !isSkuSpecField,
          syncSkuRows: !isSkuSpecField
        });
      });
      element.addEventListener('change', () => {
        updateField({
          normalizeValue: true,
          renderDependentViews: true
        });
      });
    });
  }

  function bindEvents() {
    if (state.eventsBound) {
      return;
    }

    state.eventsBound = true;

    if (typeof state.removeAiTitleProgressListener !== 'function') {
      state.removeAiTitleProgressListener = getFeatureCenterBridge().onPodUploadSheetMiaoshouAiTitleProgress((payload) => {
        handleAiTitleProgressEvent(payload);
      });

      window.addEventListener('beforeunload', () => {
        if (typeof state.removeAiTitleProgressListener === 'function') {
          state.removeAiTitleProgressListener();
          state.removeAiTitleProgressListener = null;
        }

        stopCosUploadProgressPolling();
      }, { once: true });
    }

    getElement('podExportTableButton').addEventListener('click', (event) => {
      void exportTable(event.currentTarget);
    });

    getElement('podBatchUploadCosButton').addEventListener('click', (event) => {
      if (isDuplicateButtonEvent('lastCosUploadButtonEventStamp', event)) {
        return;
      }

      if (state.uploadingCosImages) {
        void handleStopCosImageUpload();
        return;
      }

      void handleUploadCosImages();
    });

    getElement('podImageUploadModeSelect').addEventListener('change', (event) => {
      state.imageUploadMode = normalizeImageUploadMode(event.target && event.target.value);
      renderActionButtonStates();
      scheduleWorkspaceStateSave({
        immediate: true,
        showErrorNotice: true
      });
    });

    getElement('podBatchAiTitleButton').addEventListener('click', (event) => {
      if (isDuplicateButtonEvent('lastAiTitleButtonEventStamp', event)) {
        return;
      }

      if (state.generatingAiTitles) {
        void handleStopAiTitles();
        return;
      }

      void handleGenerateAiTitles();
    });

    getElement('podRetryFailedAiTitleButton').addEventListener('click', () => {
      void handleGenerateAiTitles({
        retryFailedOnly: true
      });
    });

    getElement('podAiTitlePrefixInput').addEventListener('input', (event) => {
      state.aiTitlePrefix = normalizeText(event.target && event.target.value);
      state.globalProductSettings.aiTitlePrefix = state.aiTitlePrefix;
      renderAiTitleControls();
    });

    getElement('podAiTitleSuffixInput').addEventListener('input', (event) => {
      state.aiTitleSuffix = normalizeText(event.target && event.target.value);
      state.globalProductSettings.aiTitleSuffix = state.aiTitleSuffix;
      renderAiTitleControls();
    });

    getElement('podAiTitleExtraPromptInput').addEventListener('input', (event) => {
      state.aiTitleExtraPrompt = normalizeText(event.target && event.target.value);
      renderAiTitleControls();
    });

    getElement('podAiTitleMaxLengthInput').addEventListener('input', (event) => {
      state.aiTitleMaxLength = normalizeAiTitleLengthInput(event.target && event.target.value);
      if (event.target && event.target.value !== state.aiTitleMaxLength) {
        event.target.value = state.aiTitleMaxLength;
      }
      syncPreferredAiTitlesToProducts();
      renderProductList();
      syncProductListActiveState();
      renderAiTitleControls();
    });

    getElement('podAiTitleLanguageSelect').addEventListener('change', (event) => {
      state.aiTitleLanguage = normalizeGlobalProductFieldValue('aiTitleLanguage', event.target && event.target.value);
      state.globalProductSettings.aiTitleLanguage = state.aiTitleLanguage;
      syncPreferredAiTitlesToProducts();
      renderProductList();
      syncProductListActiveState();
      renderAiTitleControls();
    });

    getElement('podFormTemplateSelect').addEventListener('change', (event) => {
      void selectAndApplyFormTemplate(event.target.value);
    });

    getElement('podFormTemplatePickerButton').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.formTemplateDropdownOpen = true;
      renderFormTemplateSelect();
    });

    getElement('podFormTemplateModal').addEventListener('click', (event) => {
      const closeTrigger = event.target instanceof Element
        ? event.target.closest('[data-pod-form-template-close]')
        : null;

      if (closeTrigger) {
        state.formTemplateDropdownOpen = false;
        renderFormTemplateSelect();
        return;
      }

      const optionButton = event.target instanceof Element
        ? event.target.closest('[data-form-template-id]')
        : null;

      if (!(optionButton instanceof HTMLButtonElement)) {
        return;
      }

      void selectAndApplyFormTemplate(optionButton.getAttribute('data-form-template-id'));
    });

    getElement('podSaveFormTemplateButton').addEventListener('click', (event) => {
      void saveCurrentFormTemplate(event.currentTarget);
    });

    getElement('podDeleteFormTemplateButton').addEventListener('click', (event) => {
      void deleteSelectedFormTemplate(event.currentTarget);
    });

    getElement('podImportProductsButton').addEventListener('click', () => {
      void openImportProductsDialog();
    });

    getElement('podBatchPresetCarouselButton').addEventListener('click', () => {
      openCarouselPresetDialog();
    });

    getElement('podBatchPresetDescriptionButton').addEventListener('click', () => {
      openDescriptionPresetDialog();
    });

    getElement('podClearProductsButton').addEventListener('click', () => {
      void handleClearProducts();
    });

    getElement('podDescriptionPresetCancelButton').addEventListener('click', () => {
      closeDescriptionPresetDialog();
    });

    getElement('podDescriptionPresetSaveButton').addEventListener('click', () => {
      saveDescriptionPresetDialog();
    });

    getElement('podDescriptionPresetSelectAllButton').addEventListener('click', () => {
      state.descriptionPresetSelectionDraft = getDescriptionPresetCandidates().map((candidate) => candidate.key);
      persistCachedDescriptionPresetSelection(state.descriptionPresetSelectionDraft);
      renderDescriptionPresetDialog();
    });

    getElement('podDescriptionPresetClearButton').addEventListener('click', () => {
      state.descriptionPresetSelectionDraft = [];
      persistCachedDescriptionPresetSelection(state.descriptionPresetSelectionDraft);
      renderDescriptionPresetDialog();
    });

    getElement('podCarouselPresetCancelButton').addEventListener('click', () => {
      closeCarouselPresetDialog();
    });

    getElement('podCarouselPresetSaveButton').addEventListener('click', () => {
      saveCarouselPresetDialog();
    });

    document.querySelectorAll('input[name="podCarouselPresetMode"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        const field = event.currentTarget;

        if (!(field instanceof HTMLInputElement) || !field.checked) {
          return;
        }

        setCarouselPresetMode(field.value);
      });
    });

    getElement('podCarouselPresetRandomOrdersInput').addEventListener('input', (event) => {
      const field = event.currentTarget;

      if (!(field instanceof HTMLInputElement)) {
        return;
      }

      state.carouselPresetRandomOrdersDraft = field.value;
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
    });

    getElement('podCarouselPresetRandomOrdersInput').addEventListener('change', (event) => {
      const field = event.currentTarget;

      if (!(field instanceof HTMLInputElement)) {
        return;
      }

      state.carouselPresetRandomOrdersDraft = normalizeSequenceSelection(field.value);
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
    });

    getElement('podCarouselPresetRandomCandidateList').addEventListener('change', (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-random-order]')
        : null;

      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      setCarouselPresetRandomOrder(
        checkbox.getAttribute('data-pod-carousel-random-order'),
        checkbox.checked
      );
    });

    getElement('podCarouselPresetRandomOrderList').addEventListener('click', (event) => {
      const removeButton = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-random-order-remove]')
        : null;

      if (!(removeButton instanceof HTMLButtonElement)) {
        return;
      }

      setCarouselPresetRandomOrder(
        removeButton.getAttribute('data-pod-carousel-random-order-remove'),
        false
      );
    });

    getElement('podCarouselPresetSelectAllButton').addEventListener('click', () => {
      state.carouselPresetSelectionDraft = getCarouselPresetCandidates().map((candidate) => candidate.key);
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
    });

    getElement('podCarouselPresetClearButton').addEventListener('click', () => {
      if (state.carouselPresetMode === 'random-first') {
        state.carouselPresetRandomOrdersDraft = '';
      } else {
        state.carouselPresetSelectionDraft = [];
      }
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
    });

    getElement('podDescriptionPresetModal').addEventListener('click', (event) => {
      const closeTrigger = event.target instanceof Element
        ? event.target.closest('[data-pod-description-preset-close]')
        : null;

      if (closeTrigger) {
        closeDescriptionPresetDialog();
      }
    });

    getElement('podCarouselPresetModal').addEventListener('click', (event) => {
      const closeTrigger = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-preset-close]')
        : null;

      if (closeTrigger) {
        closeCarouselPresetDialog();
      }
    });

    getElement('podDescriptionPresetCandidateList').addEventListener('change', (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest('[data-pod-description-preset-candidate]')
        : null;

      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      toggleDescriptionPresetCandidate(
        checkbox.getAttribute('data-pod-description-preset-candidate'),
        checkbox.checked
      );
    });

    getElement('podDescriptionPresetSelectedList').addEventListener('click', (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest('[data-pod-description-preset-action]')
        : null;

      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      movePresetSelection(
        'description',
        normalizeText(actionButton.getAttribute('data-pod-description-preset-action')),
        actionButton.getAttribute('data-pod-description-preset-index')
      );
    });

    getElement('podCarouselPresetCandidateList').addEventListener('change', (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-preset-candidate]')
        : null;

      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      toggleCarouselPresetCandidate(
        checkbox.getAttribute('data-pod-carousel-preset-candidate'),
        checkbox.checked
      );
    });

    getElement('podCarouselPresetSelectedList').addEventListener('click', (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-preset-action]')
        : null;

      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      movePresetSelection(
        'carousel',
        normalizeText(actionButton.getAttribute('data-pod-carousel-preset-action')),
        actionButton.getAttribute('data-pod-carousel-preset-index')
      );
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.formTemplateDropdownOpen) {
        state.formTemplateDropdownOpen = false;
        renderFormTemplateSelect();
        return;
      }

      if (event.key === 'Escape' && state.carouselPresetModalOpen) {
        closeCarouselPresetDialog();
        return;
      }

      if (event.key === 'Escape' && state.descriptionPresetModalOpen) {
        closeDescriptionPresetDialog();
      }
    });

    const updateSkuConfigField = (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-sku-config-field]') : null;

      if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
        return;
      }

      const rowKey = normalizeText(field.getAttribute('data-sku-row-key'));
      const fieldName = normalizeText(field.getAttribute('data-sku-config-field'));

      if (!rowKey || !SKU_CONFIG_FIELD_NAMES.includes(fieldName)) {
        return;
      }

      const nextMap = cloneSkuConfigMap(state.globalProductSettings.skuConfigMap);
      const nextEntry = createSkuConfigEntry(nextMap[rowKey]);
      nextEntry[fieldName] = normalizeSkuConfigFieldValue(fieldName, field.value);
      nextMap[rowKey] = nextEntry;
      state.globalProductSettings.skuConfigMap = nextMap;
      syncSkuConfigMapToProducts();
      renderProductList();
    };

    getElement('podSkuTableBody').addEventListener('input', updateSkuConfigField);
    getElement('podSkuTableBody').addEventListener('change', updateSkuConfigField);

    getElement('podImportProductsInput').addEventListener('change', (event) => {
      handleImportProducts(event.target.files);
      event.target.value = '';
    });

    getElement('podProductTableBody').addEventListener('focusin', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      activateProductFromList(normalizeText(field.getAttribute('data-product-list-row-id')));
    });

    getElement('podProductTableBody').addEventListener('input', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      const rowId = normalizeText(field.getAttribute('data-product-list-row-id'));
      const fieldName = normalizeText(field.getAttribute('data-product-list-field'));
      const product = state.products.find((item) => item.id === rowId);

      if (!product || !['title', 'descriptionImageOrders'].includes(fieldName)) {
        return;
      }

      if (fieldName === 'descriptionImageOrders') {
        product[fieldName] = normalizeSequenceSelection(field.value);
        const previewElement = field.parentElement
          ? field.parentElement.querySelector('[data-product-description-preview]')
          : null;

        field.value = product.descriptionImageOrders;

        if (previewElement instanceof HTMLElement) {
          previewElement.textContent = getDescriptionImagePreviewText(product);
        }
      } else if (fieldName === 'title') {
        product[fieldName] = normalizeTitleFieldValue(field.value);
        const countElement = field.parentElement
          ? field.parentElement.querySelector('[data-product-title-count]')
          : null;

        if (countElement instanceof HTMLElement) {
          countElement.textContent = formatTitleCharacterCount(product.title);
        }
      } else {
        product[fieldName] = normalizeText(field.value);
      }

      activateProductFromList(rowId);
      syncProductRowStatus(rowId);
    });

    getElement('podProductTableBody').addEventListener('change', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      const rowId = normalizeText(field.getAttribute('data-product-list-row-id'));
      const product = state.products.find((item) => item.id === rowId);

      if (!product) {
        return;
      }

      product.title = normalizeTitleFieldValue(product.title);
      product.mainNumber = getProductMainNumber(product);
      product.descriptionImageOrders = normalizeSequenceSelection(product.descriptionImageOrders);
      renderProductList();
      renderSkuEditor();
    });

    getElement('podProductTableBody').addEventListener('click', (event) => {
      const clickedField = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (clickedField) {
        return;
      }

      const row = event.target instanceof Element ? event.target.closest('[data-product-row-id]') : null;

      if (!(row instanceof HTMLElement)) {
        return;
      }

      const productId = normalizeText(row.getAttribute('data-product-row-id'));

      if (!state.products.some((product) => product.id === productId)) {
        return;
      }

      state.activeProductId = productId;
      renderAll();
    });

    bindProductFieldEvents();
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    bindEvents();
    void loadTemplateSnapshot({
      showErrorNotice: true,
      syncLatest: true
    });
    void loadFormTemplateSnapshot({
      showErrorNotice: true
    });
    void loadWorkspaceState({
      showErrorNotice: true
    });
  });
})();
