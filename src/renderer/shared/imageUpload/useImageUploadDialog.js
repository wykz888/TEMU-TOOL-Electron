import { computed, reactive, ref } from 'vue';

const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';
const DEFAULT_CONCURRENCY = 8;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 32;
const DEFAULT_IMAGE_QUALITY = 90;
const MIN_IMAGE_QUALITY = 48;
const MAX_IMAGE_QUALITY = 100;

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

const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'original',
    label: '\u539f\u6587\u4ef6'
  }),
  Object.freeze({
    value: 'png',
    label: 'PNG'
  }),
  Object.freeze({
    value: 'jpg',
    label: 'JPG'
  }),
  Object.freeze({
    value: 'webp',
    label: 'WEBP'
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

function normalizeImageUploadMode(value) {
  const normalizedValue = normalizeText(value).toLowerCase();
  return IMAGE_UPLOAD_MODE_OPTIONS.some((item) => item.value === normalizedValue)
    ? normalizedValue
    : 'original';
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

function getStorageProviderLabel(provider) {
  return provider === 'cloudflare-r2' ? 'Cloudflare R2' : '\u817e\u8baf COS';
}

function isStorageProviderConfigured(storageConfig, provider) {
  const providers = storageConfig && storageConfig.providers && typeof storageConfig.providers === 'object'
    ? storageConfig.providers
    : {};

  if (provider === 'cloudflare-r2') {
    const r2 = providers.cloudflareR2 && typeof providers.cloudflareR2 === 'object' ? providers.cloudflareR2 : {};
    return r2.enabled !== false
      && normalizeText(r2.accountId)
      && normalizeText(r2.accessKeyId)
      && normalizeText(r2.secretAccessKey)
      && normalizeText(r2.bucket)
      && normalizeText(r2.publicBaseUrl);
  }

  const cos = providers.tencentCos && typeof providers.tencentCos === 'object' ? providers.tencentCos : {};
  return cos.enabled !== false
    && normalizeText(cos.secretId)
    && normalizeText(cos.secretKey)
    && normalizeText(cos.bucket)
    && normalizeText(cos.region);
}

function createDefaultFormState() {
  return {
    storageProvider: 'tencent-cos',
    imageUploadMode: 'original',
    concurrency: DEFAULT_CONCURRENCY,
    imageQuality: DEFAULT_IMAGE_QUALITY
  };
}

function createDefaultSummaryState() {
  return {
    totalCount: 0,
    retryCount: 0,
    storageName: '',
    warning: '',
    retryFilePaths: []
  };
}

export function useImageUploadDialog(options = {}) {
  const startUpload = typeof options.startUpload === 'function'
    ? options.startUpload
    : null;
  const visible = ref(false);
  const loading = ref(false);
  const starting = ref(false);
  const form = reactive(createDefaultFormState());
  const summary = reactive(createDefaultSummaryState());
  const status = reactive({
    message: '',
    tone: ''
  });
  let lastStorageConfig = null;

  const busy = computed(() => loading.value || starting.value);

  function setStatus(message, tone = '') {
    status.message = normalizeText(message);
    status.tone = normalizeText(tone);
  }

  function applySnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};

    summary.totalCount = Math.max(0, Number(source.totalCount) || 0);
    summary.retryCount = Math.max(0, Number(source.retryCount) || 0);
    summary.retryFilePaths = Array.isArray(source.retryFilePaths)
      ? source.retryFilePaths.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    form.imageUploadMode = normalizeImageUploadMode(source.imageUploadMode || form.imageUploadMode);
    form.concurrency = normalizeInteger(
      source.concurrency,
      form.concurrency || DEFAULT_CONCURRENCY,
      MIN_CONCURRENCY,
      MAX_CONCURRENCY
    );
    form.imageQuality = normalizeInteger(
      source.imageQuality,
      form.imageQuality || DEFAULT_IMAGE_QUALITY,
      MIN_IMAGE_QUALITY,
      MAX_IMAGE_QUALITY
    );
  }

  function updateStorageWarning() {
    const provider = normalizeStorageProvider(form.storageProvider);
    summary.storageName = getStorageProviderLabel(provider);

    if (!lastStorageConfig) {
      summary.warning = '';
      return;
    }

    summary.warning = isStorageProviderConfigured(lastStorageConfig, provider)
      ? ''
      : `${summary.storageName} \u5b58\u50a8\u6e20\u9053\u672a\u914d\u7f6e\u5b8c\u6574\uff0c\u8bf7\u5148\u5230\u5168\u5c40\u914d\u7f6e\u68c0\u67e5\u3002`;
  }

  function applyGlobalConfig(storageConfig) {
    lastStorageConfig = storageConfig && typeof storageConfig === 'object' ? storageConfig : null;
    form.storageProvider = normalizeStorageProvider(storageConfig && storageConfig.activeProvider);
    updateStorageWarning();
  }

  async function loadGlobalConfig() {
    const bridge = getGlobalConfigBridge();

    if (!bridge || typeof bridge.getStorageSelection !== 'function') {
      throw new Error('\u5168\u5c40\u5b58\u50a8\u914d\u7f6e\u63a5\u53e3\u672a\u52a0\u8f7d\u3002');
    }

    applyGlobalConfig(await bridge.getStorageSelection());
  }

  async function openDialog(snapshot = null) {
    visible.value = true;
    loading.value = true;
    setStatus('\u6b63\u5728\u8bfb\u53d6\u5168\u5c40\u5b58\u50a8\u914d\u7f6e...');
    applySnapshot(snapshot);

    try {
      await loadGlobalConfig();
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
    const shouldRetryFailed = retryFailedOnly === true;

    return {
      storageProvider: normalizeStorageProvider(form.storageProvider),
      imageUploadMode: normalizeImageUploadMode(form.imageUploadMode),
      concurrency: normalizeInteger(form.concurrency, DEFAULT_CONCURRENCY, MIN_CONCURRENCY, MAX_CONCURRENCY),
      imageQuality: normalizeInteger(form.imageQuality, DEFAULT_IMAGE_QUALITY, MIN_IMAGE_QUALITY, MAX_IMAGE_QUALITY),
      retryFailedOnly: shouldRetryFailed,
      retryFilePaths: shouldRetryFailed ? summary.retryFilePaths.slice() : []
    };
  }

  async function startUploadFromDialog(retryFailedOnly = false) {
    const payload = collectPayload(retryFailedOnly);

    updateStorageWarning();

    if (summary.warning) {
      setStatus(summary.warning, 'warning');
      return;
    }

    if (retryFailedOnly && !summary.retryCount) {
      setStatus('\u5f53\u524d\u6ca1\u6709\u53ef\u91cd\u8bd5\u7684\u5931\u8d25\u56fe\u7247\u3002', 'warning');
      return;
    }

    if (!retryFailedOnly && !summary.totalCount) {
      setStatus('\u6ca1\u6709\u53ef\u4e0a\u4f20\u7684\u56fe\u7247\u3002', 'warning');
      return;
    }

    if (!startUpload) {
      setStatus('\u56fe\u7247\u4e0a\u4f20\u63a5\u53e3\u672a\u52a0\u8f7d\u3002', 'danger');
      return;
    }

    starting.value = true;
    setStatus('\u6b63\u5728\u542f\u52a8\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1...');

    try {
      visible.value = false;
      setStatus('');
      await startUpload(payload);
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

  function handleStorageProviderChange() {
    form.storageProvider = normalizeStorageProvider(form.storageProvider);
    updateStorageWarning();
  }

  function installGlobalBridge() {
    const existingBridge = getViewBridge() || {};
    const bridge = {
      ...existingBridge,
      openImageUploadModal(snapshot) {
        return openDialog(snapshot);
      }
    };

    window[VIEW_BRIDGE_KEY] = bridge;

    return function cleanupGlobalBridge() {
      if (window[VIEW_BRIDGE_KEY] !== bridge) {
        return;
      }

      const nextBridge = { ...bridge };
      delete nextBridge.openImageUploadModal;

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
    storageProviderOptions: STORAGE_PROVIDER_OPTIONS,
    imageUploadModeOptions: IMAGE_UPLOAD_MODE_OPTIONS,
    minConcurrency: MIN_CONCURRENCY,
    maxConcurrency: MAX_CONCURRENCY,
    minImageQuality: MIN_IMAGE_QUALITY,
    maxImageQuality: MAX_IMAGE_QUALITY,
    openDialog,
    closeDialog,
    collectPayload,
    startUploadFromDialog,
    handleStorageProviderChange,
    installGlobalBridge
  };
}
