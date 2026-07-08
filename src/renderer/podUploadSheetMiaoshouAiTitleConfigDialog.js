(function initPodUploadSheetMiaoshouAiTitleConfigDialog() {
  const DEFAULT_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
  const DEFAULT_MODEL = 'doubao-seed-2-0-mini-260428';
  const DEFAULT_CONCURRENCY = 20;
  const MIN_CONCURRENCY = 1;
  const MAX_CONCURRENCY = 100;
  const dialogState = {
    initialized: false,
    loading: false,
    saving: false
  };

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

  function getElement(id) {
    return document.getElementById(id);
  }

  function getFeatureCenterBridge() {
    return window.temuApp && window.temuApp.featureCenter ? window.temuApp.featureCenter : null;
  }

  function setStatus(message, tone) {
    const statusElement = getElement('podAiTitleConfigStatus');

    if (!statusElement) {
      return;
    }

    statusElement.textContent = normalizeText(message);
    statusElement.dataset.tone = normalizeText(tone);
    statusElement.hidden = !statusElement.textContent;
  }

  function setBusyState() {
    const saveButton = getElement('podAiTitleConfigSaveButton');
    const openButton = getElement('podAiTitleConfigButton');
    const modelInput = getElement('podAiTitleConfigModelInput');
    const apiBaseInput = getElement('podAiTitleConfigApiBaseInput');
    const concurrencyInput = getElement('podAiTitleConfigConcurrencyInput');
    const apiKeysInput = getElement('podAiTitleConfigKeysInput');
    const busy = dialogState.loading || dialogState.saving;

    [modelInput, apiBaseInput, concurrencyInput, apiKeysInput].forEach((element) => {
      if (element) {
        element.disabled = busy;
      }
    });

    if (saveButton) {
      saveButton.disabled = busy;
      saveButton.textContent = dialogState.saving ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58';
    }

    if (openButton) {
      openButton.disabled = dialogState.loading || dialogState.saving;
    }
  }

  function applySettingsToForm(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const modelInput = getElement('podAiTitleConfigModelInput');
    const apiBaseInput = getElement('podAiTitleConfigApiBaseInput');
    const concurrencyInput = getElement('podAiTitleConfigConcurrencyInput');
    const apiKeysInput = getElement('podAiTitleConfigKeysInput');

    if (modelInput) {
      modelInput.value = normalizeText(source.model) || DEFAULT_MODEL;
    }

    if (apiBaseInput) {
      apiBaseInput.value = normalizeText(source.apiBaseUrl) || DEFAULT_API_BASE_URL;
    }

    if (concurrencyInput) {
      concurrencyInput.value = String(normalizeConcurrency(source.concurrency));
    }

    if (apiKeysInput) {
      apiKeysInput.value = normalizeApiKeys(source.apiKeys || source.apiKey).join('\n');
    }
  }

  function collectSettingsFromForm() {
    return {
      model: normalizeText(getElement('podAiTitleConfigModelInput') && getElement('podAiTitleConfigModelInput').value),
      apiBaseUrl: normalizeText(getElement('podAiTitleConfigApiBaseInput') && getElement('podAiTitleConfigApiBaseInput').value),
      concurrency: normalizeConcurrency(getElement('podAiTitleConfigConcurrencyInput') && getElement('podAiTitleConfigConcurrencyInput').value),
      apiKeys: normalizeApiKeys(getElement('podAiTitleConfigKeysInput') && getElement('podAiTitleConfigKeysInput').value)
    };
  }

  function showNotice(message, tone) {
    if (typeof window.showPodUploadSheetNotice === 'function') {
      window.showPodUploadSheetNotice(message, tone);
    }
  }

  function closeDialog() {
    const modal = getElement('podAiTitleConfigModal');

    if (modal) {
      modal.hidden = true;
    }
  }

  async function openDialog() {
    const modal = getElement('podAiTitleConfigModal');
    const bridge = getFeatureCenterBridge();

    if (!modal) {
      return;
    }

    modal.hidden = false;
    dialogState.loading = true;
    setStatus('\u6b63\u5728\u8bfb\u53d6 AI \u914d\u7f6e...', '');
    setBusyState();

    try {
      if (!bridge || typeof bridge.getPodUploadSheetMiaoshouAiTitleConfig !== 'function') {
        throw new Error('\u5f53\u524d\u7248\u672c\u672a\u52a0\u8f7d AI \u914d\u7f6e\u63a5\u53e3\u3002');
      }

      const result = await bridge.getPodUploadSheetMiaoshouAiTitleConfig();
      applySettingsToForm(result && result.settings);
      setStatus('', '');
    } catch (error) {
      applySettingsToForm(null);
      setStatus(
        '\u8bfb\u53d6\u914d\u7f6e\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      dialogState.loading = false;
      setBusyState();
    }
  }

  async function saveDialog() {
    const bridge = getFeatureCenterBridge();
    const settings = collectSettingsFromForm();

    if (!settings.model) {
      setStatus('\u8bf7\u5148\u586b\u5199\u6a21\u578b\u540d\u79f0\u3002', 'warning');
      return;
    }

    if (!settings.apiBaseUrl) {
      setStatus('\u8bf7\u5148\u586b\u5199 API Base URL\u3002', 'warning');
      return;
    }

    if (!settings.apiKeys.length) {
      setStatus('\u8bf7\u81f3\u5c11\u586b\u5199\u4e00\u4e2a KEY\u3002', 'warning');
      return;
    }

    dialogState.saving = true;
    setStatus('\u6b63\u5728\u4fdd\u5b58\u5e76\u540c\u6b65\u4e91\u7aef...', '');
    setBusyState();

    try {
      if (!bridge || typeof bridge.savePodUploadSheetMiaoshouAiTitleConfig !== 'function') {
        throw new Error('\u5f53\u524d\u7248\u672c\u672a\u52a0\u8f7d AI \u914d\u7f6e\u63a5\u53e3\u3002');
      }

      const result = await bridge.savePodUploadSheetMiaoshouAiTitleConfig(settings);
      const warning = normalizeText(result && result.warning);

      closeDialog();
      showNotice(
        result && result.cloudSynced === false
          ? ('AI \u914d\u7f6e\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4e91\u7aef\u540c\u6b65\u5931\u8d25' + (warning ? '\uff1a' + warning : ''))
          : 'AI \u914d\u7f6e\u5df2\u4fdd\u5b58\u5e76\u540c\u6b65\u3002',
        result && result.cloudSynced === false ? 'warning' : 'success'
      );
    } catch (error) {
      setStatus(
        '\u4fdd\u5b58\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      dialogState.saving = false;
      setBusyState();
    }
  }

  function bindDialogEvents() {
    if (dialogState.initialized) {
      return;
    }

    dialogState.initialized = true;

    const openButton = getElement('podAiTitleConfigButton');
    const modal = getElement('podAiTitleConfigModal');
    const cancelButton = getElement('podAiTitleConfigCancelButton');
    const saveButton = getElement('podAiTitleConfigSaveButton');

    if (openButton) {
      openButton.addEventListener('click', () => {
        void openDialog();
      });
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', closeDialog);
    }

    if (saveButton) {
      saveButton.addEventListener('click', () => {
        void saveDialog();
      });
    }

    if (modal) {
      modal.addEventListener('click', (event) => {
        const closeTrigger = event.target instanceof Element
          ? event.target.closest('[data-pod-ai-title-config-close]')
          : null;

        if (closeTrigger && !dialogState.saving) {
          closeDialog();
        }
      });
    }
  }

  window.podUploadSheetMiaoshouAiTitleConfigDialog = {
    bind: bindDialogEvents,
    open: openDialog
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDialogEvents, { once: true });
  } else {
    bindDialogEvents();
  }
})();
