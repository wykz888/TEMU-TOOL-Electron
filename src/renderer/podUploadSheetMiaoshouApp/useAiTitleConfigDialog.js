import { computed, reactive, ref } from 'vue';
import {
  AI_BASE_URL_OPTIONS,
  AI_MODEL_OPTIONS,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL
} from '../globalConfigApp/constants.js';

const DEFAULT_CONCURRENCY = 20;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 50;
const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeApiKeys(value) {
  const sourceValues = Array.isArray(value)
    ? value
    : String(value || '').replace(/\r\n/g, '\n').split('\n');
  const seenKeys = new Set();

  return sourceValues.reduce((result, item) => {
    const key = normalizeText(item);

    if (!key || seenKeys.has(key)) {
      return result;
    }

    seenKeys.add(key);
    result.push(key);
    return result;
  }, []);
}

function normalizeConcurrency(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONCURRENCY;
  }

  return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, parsed));
}

function getFeatureCenterBridge() {
  return window.temuApp && window.temuApp.featureCenter
    ? window.temuApp.featureCenter
    : null;
}

function showNotice(message, tone) {
  if (typeof window.showPodUploadSheetNotice === 'function') {
    window.showPodUploadSheetNotice(message, tone);
  }
}

function createDefaultFormState() {
  return {
    model: DEFAULT_AI_MODEL,
    apiBaseUrl: DEFAULT_AI_BASE_URL,
    concurrency: DEFAULT_CONCURRENCY,
    apiKeysText: ''
  };
}

export function useAiTitleConfigDialog() {
  const visible = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const form = reactive(createDefaultFormState());
  const status = reactive({
    message: '',
    tone: ''
  });

  const busy = computed(() => loading.value || saving.value);

  function setStatus(message, tone = '') {
    status.message = normalizeText(message);
    status.tone = normalizeText(tone);
  }

  function applySettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};

    form.model = normalizeText(source.model) || DEFAULT_AI_MODEL;
    form.apiBaseUrl = normalizeText(source.apiBaseUrl) || DEFAULT_AI_BASE_URL;
    form.concurrency = normalizeConcurrency(source.concurrency);
    form.apiKeysText = normalizeApiKeys(source.apiKeys || source.apiKey).join('\n');
  }

  function collectPayload() {
    return {
      model: normalizeText(form.model),
      apiBaseUrl: normalizeText(form.apiBaseUrl),
      concurrency: normalizeConcurrency(form.concurrency),
      apiKeys: normalizeApiKeys(form.apiKeysText)
    };
  }

  async function openDialog() {
    const bridge = getFeatureCenterBridge();

    visible.value = true;
    loading.value = true;
    setStatus('\u6b63\u5728\u8bfb\u53d6 AI \u914d\u7f6e...');

    try {
      if (!bridge || typeof bridge.getPodUploadSheetMiaoshouAiTitleConfig !== 'function') {
        throw new Error('\u5f53\u524d\u7248\u672c\u672a\u52a0\u8f7d AI \u914d\u7f6e\u63a5\u53e3\u3002');
      }

      const result = await bridge.getPodUploadSheetMiaoshouAiTitleConfig();
      applySettings(result && result.settings);
      setStatus('');
    } catch (error) {
      applySettings(null);
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
    if (saving.value) {
      return;
    }

    visible.value = false;
    setStatus('');
  }

  async function saveDialog() {
    const bridge = getFeatureCenterBridge();
    const payload = collectPayload();

    if (!payload.model) {
      setStatus('\u8bf7\u5148\u9009\u62e9\u6216\u586b\u5199\u6a21\u578b\u540d\u79f0\u3002', 'warning');
      return;
    }

    if (!payload.apiBaseUrl) {
      setStatus('\u8bf7\u5148\u9009\u62e9\u6216\u586b\u5199 API Base URL\u3002', 'warning');
      return;
    }

    if (!payload.apiKeys.length) {
      setStatus('\u8bf7\u81f3\u5c11\u586b\u5199\u4e00\u4e2a KEY\u3002', 'warning');
      return;
    }

    saving.value = true;
    setStatus('\u6b63\u5728\u4fdd\u5b58\u5e76\u540c\u6b65\u4e91\u7aef...');

    try {
      if (!bridge || typeof bridge.savePodUploadSheetMiaoshouAiTitleConfig !== 'function') {
        throw new Error('\u5f53\u524d\u7248\u672c\u672a\u52a0\u8f7d AI \u914d\u7f6e\u63a5\u53e3\u3002');
      }

      const result = await bridge.savePodUploadSheetMiaoshouAiTitleConfig(payload);
      const warning = normalizeText(result && result.warning);

      visible.value = false;
      setStatus('');
      showNotice(
        result && result.cloudSynced === false
          ? ('AI \u914d\u7f6e\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4e91\u7aef\u540c\u6b65\u5931\u8d25'
            + (warning ? '\uff1a' + warning : ''))
          : 'AI \u914d\u7f6e\u5df2\u4fdd\u5b58\u5e76\u540c\u6b65\u3002',
        result && result.cloudSynced === false ? 'warning' : 'success'
      );
    } catch (error) {
      setStatus(
        '\u4fdd\u5b58\u5931\u8d25\uff1a'
          + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      saving.value = false;
    }
  }

  function installGlobalBridge() {
    const existingBridge = window[VIEW_BRIDGE_KEY] && typeof window[VIEW_BRIDGE_KEY] === 'object'
      ? window[VIEW_BRIDGE_KEY]
      : {};
    const bridge = {
      ...existingBridge,
      openAiTitleConfigModal() {
        return openDialog();
      }
    };

    window[VIEW_BRIDGE_KEY] = bridge;

    return function cleanupGlobalBridge() {
      if (window[VIEW_BRIDGE_KEY] !== bridge) {
        return;
      }

      const nextBridge = { ...bridge };
      delete nextBridge.openAiTitleConfigModal;

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
    saving,
    busy,
    form,
    status,
    modelOptions: AI_MODEL_OPTIONS,
    apiBaseOptions: AI_BASE_URL_OPTIONS,
    minConcurrency: MIN_CONCURRENCY,
    maxConcurrency: MAX_CONCURRENCY,
    openDialog,
    closeDialog,
    saveDialog,
    installGlobalBridge
  };
}
