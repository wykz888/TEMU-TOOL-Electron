import { computed, reactive, ref } from 'vue';
import {
  AI_BASE_URL_OPTIONS,
  AI_MODEL_OPTIONS,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL
} from '../globalConfigApp/constants.js';
import {
  IMAGE_UPLOAD_MODE_OPTIONS
} from '../shared/imageUpload/useImageUploadDialog.js';

const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';
const DEFAULT_CONCURRENCY = 20;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 100;
const DEFAULT_TARGET_LENGTH = 250;
const MIN_TARGET_LENGTH = 80;
const MAX_TARGET_LENGTH = 255;
const DEFAULT_IMAGE_QUALITY = 84;
const MIN_IMAGE_QUALITY = 48;
const MAX_IMAGE_QUALITY = 95;

const AI_PLATFORM_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'volcengine',
    label: '\u706b\u5c71\u5f15\u64ce'
  })
]);

const STORAGE_PROVIDER_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'tencent-cos',
    label: '\u817e\u8baf COS'
  }),
  Object.freeze({
    value: 'cloudflare-r2',
    label: 'Cloudflare R2'
  })
]);

const OUTPUT_LANGUAGE_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'en',
    label: '\u82f1\u6587'
  }),
  Object.freeze({
    value: 'zh',
    label: '\u4e2d\u6587'
  })
]);

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeInteger(value, fallback, minValue, maxValue) {
  const parsed = Number.parseInt(value, 10);
  const initialValue = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(minValue, Math.min(maxValue, initialValue));
}

function normalizeStorageProvider(value) {
  return value === 'cloudflare-r2' ? 'cloudflare-r2' : 'tencent-cos';
}

function normalizeAiProvider() {
  return 'volcengine';
}

function normalizeImageCompression(value) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue || normalizedValue === 'smart-jpeg' || normalizedValue === 'high-quality' || normalizedValue === 'jpeg') {
    return 'jpg';
  }

  return IMAGE_UPLOAD_MODE_OPTIONS.some((item) => item.value === normalizedValue)
    ? normalizedValue
    : 'jpg';
}

function normalizeOutputLanguage(value) {
  return value === 'zh' ? 'zh' : 'en';
}

function hasOwnValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function getStorageProviderLabel(provider) {
  return provider === 'cloudflare-r2' ? 'Cloudflare R2' : '\u817e\u8baf COS';
}

function getGlobalConfigBridge() {
  return window.temuApp && window.temuApp.globalConfig
    ? window.temuApp.globalConfig
    : null;
}

function getViewBridge() {
  return window[VIEW_BRIDGE_KEY] && typeof window[VIEW_BRIDGE_KEY] === 'object'
    ? window[VIEW_BRIDGE_KEY]
    : null;
}

function showNotice(message, tone) {
  if (typeof window.showPodUploadSheetNotice === 'function') {
    window.showPodUploadSheetNotice(message, tone);
  }
}

function getVolcengineConfig(aiConfig) {
  return aiConfig
    && aiConfig.providers
    && aiConfig.providers.volcengine
    && typeof aiConfig.providers.volcengine === 'object'
      ? aiConfig.providers.volcengine
      : {};
}

function getEnabledApiKeyCount(aiConfig) {
  const volcengine = getVolcengineConfig(aiConfig);
  const apiKeys = Array.isArray(volcengine.apiKeys) ? volcengine.apiKeys : [];
  return apiKeys.filter((item) => item && item.enabled !== false && normalizeText(item.apiKey)).length;
}

function createDefaultFormState() {
  return {
    aiProvider: 'volcengine',
    apiBaseUrl: DEFAULT_AI_BASE_URL,
    model: DEFAULT_AI_MODEL,
    storageProvider: 'tencent-cos',
    imageCompression: 'jpg',
    concurrency: DEFAULT_CONCURRENCY,
    targetLength: DEFAULT_TARGET_LENGTH,
    imageQuality: DEFAULT_IMAGE_QUALITY,
    prefixText: '',
    suffixText: '',
    outputLanguage: 'en',
    useCache: true,
    extraPrompt: ''
  };
}

function createDefaultSummaryState() {
  return {
    totalCount: 0,
    retryCount: 0,
    apiKeyCount: 0,
    storageName: '',
    aiName: '',
    warning: ''
  };
}

export function useBatchAiTitleDialog() {
  const visible = ref(false);
  const loading = ref(false);
  const starting = ref(false);
  const form = reactive(createDefaultFormState());
  const summary = reactive(createDefaultSummaryState());
  const status = reactive({
    message: '',
    tone: ''
  });

  const busy = computed(() => loading.value || starting.value);

  function setStatus(message, tone = '') {
    status.message = normalizeText(message);
    status.tone = normalizeText(tone);
  }

  function applySnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};

    summary.totalCount = Math.max(0, Number(source.totalCount) || 0);
    summary.retryCount = Math.max(0, Number(source.retryCount) || 0);
    applyPreferences(source);
  }

  function applyPreferences(preferences) {
    const source = preferences && typeof preferences === 'object' ? preferences : {};

    form.aiProvider = normalizeAiProvider(hasOwnValue(source, 'aiProvider') ? source.aiProvider : form.aiProvider);
    form.apiBaseUrl = normalizeText(hasOwnValue(source, 'apiBaseUrl') ? source.apiBaseUrl : form.apiBaseUrl)
      || normalizeText(form.apiBaseUrl)
      || DEFAULT_AI_BASE_URL;
    form.model = normalizeText(hasOwnValue(source, 'model') ? source.model : form.model)
      || normalizeText(form.model)
      || DEFAULT_AI_MODEL;
    form.storageProvider = normalizeStorageProvider(
      hasOwnValue(source, 'storageProvider') ? source.storageProvider || form.storageProvider : form.storageProvider
    );
    form.imageCompression = normalizeImageCompression(
      hasOwnValue(source, 'imageCompression') ? source.imageCompression || form.imageCompression : form.imageCompression
    );
    form.concurrency = normalizeInteger(
      hasOwnValue(source, 'concurrency') ? source.concurrency : form.concurrency,
      form.concurrency || DEFAULT_CONCURRENCY,
      MIN_CONCURRENCY,
      MAX_CONCURRENCY
    );
    form.targetLength = normalizeInteger(
      hasOwnValue(source, 'targetLength') ? source.targetLength : form.targetLength,
      form.targetLength || DEFAULT_TARGET_LENGTH,
      MIN_TARGET_LENGTH,
      MAX_TARGET_LENGTH
    );
    form.imageQuality = normalizeInteger(
      hasOwnValue(source, 'imageQuality') ? source.imageQuality : form.imageQuality,
      form.imageQuality || DEFAULT_IMAGE_QUALITY,
      MIN_IMAGE_QUALITY,
      MAX_IMAGE_QUALITY
    );
    form.prefixText = hasOwnValue(source, 'prefixText') ? normalizeText(source.prefixText) : form.prefixText;
    form.suffixText = hasOwnValue(source, 'suffixText') ? normalizeText(source.suffixText) : form.suffixText;
    form.outputLanguage = normalizeOutputLanguage(
      hasOwnValue(source, 'outputLanguage') ? source.outputLanguage || form.outputLanguage : form.outputLanguage
    );
    form.useCache = hasOwnValue(source, 'useCache') ? source.useCache === true : form.useCache === true;
    form.extraPrompt = hasOwnValue(source, 'extraPrompt') ? normalizeText(source.extraPrompt) : form.extraPrompt;
    summary.storageName = getStorageProviderLabel(form.storageProvider);
  }

  function applyGlobalConfig(storageConfig, aiConfig) {
    const storageProvider = normalizeStorageProvider(storageConfig && storageConfig.activeProvider);
    const volcengine = getVolcengineConfig(aiConfig);
    const apiKeyCount = getEnabledApiKeyCount(aiConfig);

    form.storageProvider = storageProvider;
    form.aiProvider = normalizeAiProvider(aiConfig && aiConfig.activeProvider);
    form.apiBaseUrl = normalizeText(volcengine.apiBaseUrl) || DEFAULT_AI_BASE_URL;
    form.model = normalizeText(volcengine.model) || DEFAULT_AI_MODEL;
    form.concurrency = normalizeInteger(
      volcengine.concurrency,
      DEFAULT_CONCURRENCY,
      MIN_CONCURRENCY,
      MAX_CONCURRENCY
    );
    summary.apiKeyCount = apiKeyCount;
    summary.storageName = getStorageProviderLabel(storageProvider);
    summary.aiName = '\u706b\u5c71\u5f15\u64ce';
    summary.warning = apiKeyCount ? '' : 'AI KEY \u672a\u914d\u7f6e\uff0c\u8bf7\u5148\u5230\u5168\u5c40\u914d\u7f6e\u586b\u5199\u3002';
  }

  async function loadGlobalConfig() {
    const bridge = getGlobalConfigBridge();

    if (!bridge || typeof bridge.getStorageSelection !== 'function' || typeof bridge.getAiConfig !== 'function') {
      throw new Error('\u5168\u5c40\u914d\u7f6e\u63a5\u53e3\u672a\u52a0\u8f7d\u3002');
    }

    const [storageConfig, aiConfig] = await Promise.all([
      bridge.getStorageSelection(),
      bridge.getAiConfig()
    ]);

    applyGlobalConfig(storageConfig, aiConfig);
  }

  async function openDialog(snapshot = null) {
    visible.value = true;
    loading.value = true;
    setStatus('\u6b63\u5728\u8bfb\u53d6\u5168\u5c40\u914d\u7f6e...');
    applySnapshot(snapshot);

    try {
      await loadGlobalConfig();
      applySnapshot(snapshot);
      setStatus('');
    } catch (error) {
      setStatus(
        '\u8bfb\u53d6\u914d\u7f6e\u5931\u8d25\uff1a'
          + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      loading.value = false;
    }
  }

  function closeDialog() {
    if (starting.value) {
      return;
    }

    visible.value = false;
    setStatus('');
  }

  function collectPayload(retryFailedOnly = false) {
    return {
      aiProvider: normalizeAiProvider(form.aiProvider),
      apiBaseUrl: normalizeText(form.apiBaseUrl),
      model: normalizeText(form.model),
      storageProvider: normalizeStorageProvider(form.storageProvider),
      imageCompression: normalizeImageCompression(form.imageCompression),
      concurrency: normalizeInteger(form.concurrency, DEFAULT_CONCURRENCY, MIN_CONCURRENCY, MAX_CONCURRENCY),
      targetLength: normalizeInteger(form.targetLength, DEFAULT_TARGET_LENGTH, MIN_TARGET_LENGTH, MAX_TARGET_LENGTH),
      imageQuality: normalizeInteger(form.imageQuality, DEFAULT_IMAGE_QUALITY, MIN_IMAGE_QUALITY, MAX_IMAGE_QUALITY),
      prefixText: normalizeText(form.prefixText),
      suffixText: normalizeText(form.suffixText),
      outputLanguage: normalizeOutputLanguage(form.outputLanguage),
      useCache: form.useCache === true,
      extraPrompt: normalizeText(form.extraPrompt),
      retryFailedOnly: retryFailedOnly === true
    };
  }

  async function startGeneration(retryFailedOnly = false) {
    const bridge = getViewBridge();
    const payload = collectPayload(retryFailedOnly);

    if (!summary.apiKeyCount) {
      setStatus('AI KEY \u672a\u914d\u7f6e\uff0c\u8bf7\u5148\u5230\u5168\u5c40\u914d\u7f6e\u586b\u5199\u3002', 'warning');
      return;
    }

    if (retryFailedOnly && !summary.retryCount) {
      setStatus('\u5f53\u524d\u6ca1\u6709\u53ef\u91cd\u8bd5\u7684\u5931\u8d25\u5546\u54c1\u3002', 'warning');
      return;
    }

    if (!retryFailedOnly && !summary.totalCount) {
      setStatus('\u6ca1\u6709\u53ef\u751f\u6210\u6807\u9898\u7684\u5546\u54c1\u3002', 'warning');
      return;
    }

    if (!bridge || typeof bridge.startBatchAiTitleGeneration !== 'function') {
      setStatus('\u6807\u9898\u751f\u6210\u63a5\u53e3\u672a\u52a0\u8f7d\u3002', 'danger');
      return;
    }

    starting.value = true;
    setStatus('\u6b63\u5728\u542f\u52a8 AI \u6807\u9898\u4efb\u52a1...');

    try {
      visible.value = false;
      setStatus('');
      await bridge.startBatchAiTitleGeneration(payload);
    } catch (error) {
      visible.value = true;
      setStatus(
        '\u542f\u52a8\u5931\u8d25\uff1a'
          + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      starting.value = false;
    }
  }

  function installGlobalBridge() {
    const existingBridge = getViewBridge() || {};
    const bridge = {
      ...existingBridge,
      openBatchAiTitleModal(snapshot) {
        return openDialog(snapshot);
      }
    };

    window[VIEW_BRIDGE_KEY] = bridge;

    return function cleanupGlobalBridge() {
      if (window[VIEW_BRIDGE_KEY] !== bridge) {
        return;
      }

      const nextBridge = { ...bridge };
      delete nextBridge.openBatchAiTitleModal;

      if (Object.keys(nextBridge).length) {
        window[VIEW_BRIDGE_KEY] = nextBridge;
        return;
      }

      delete window[VIEW_BRIDGE_KEY];
    };
  }

  return {
    visible,
    loading,
    starting,
    busy,
    form,
    summary,
    status,
    aiPlatformOptions: AI_PLATFORM_OPTIONS,
    storageProviderOptions: STORAGE_PROVIDER_OPTIONS,
    imageCompressionOptions: IMAGE_UPLOAD_MODE_OPTIONS,
    outputLanguageOptions: OUTPUT_LANGUAGE_OPTIONS,
    modelOptions: AI_MODEL_OPTIONS,
    apiBaseOptions: AI_BASE_URL_OPTIONS,
    minConcurrency: MIN_CONCURRENCY,
    maxConcurrency: MAX_CONCURRENCY,
    minTargetLength: MIN_TARGET_LENGTH,
    maxTargetLength: MAX_TARGET_LENGTH,
    minImageQuality: MIN_IMAGE_QUALITY,
    maxImageQuality: MAX_IMAGE_QUALITY,
    openDialog,
    closeDialog,
    collectPayload,
    applyPreferences,
    startGeneration,
    installGlobalBridge
  };
}
