import { onBeforeUnmount, ref, watch } from 'vue';
import { clampConcurrency } from './psdSmartSuiteModels.js';

function noop() {
  return undefined;
}

function showMessage(messageApi, method, content) {
  if (messageApi && typeof messageApi[method] === 'function') {
    messageApi[method](content);
  }
}

function getErrorMessage(error) {
  return String(error && error.message ? error.message : error);
}

function clearTimer(timerRef) {
  if (timerRef.value) {
    clearTimeout(timerRef.value);
    timerRef.value = 0;
  }
}

export function usePsdSmartSuiteTemplateWorkspace(options = {}) {
  const bridge = options.bridge;
  const busy = options.busy;
  const config = options.config;
  const mockups = options.mockups;
  const psdImageFiles = options.psdImageFiles;
  const psdMetadataSourceFiles = options.psdMetadataSourceFiles;
  const addLog = typeof options.addLog === 'function' ? options.addLog : noop;
  const collectDirectoryFiles = typeof options.collectDirectoryFiles === 'function'
    ? options.collectDirectoryFiles
    : async () => [];
  const ensureMockups = typeof options.ensureMockups === 'function' ? options.ensureMockups : noop;
  const setMockups = typeof options.setMockups === 'function' ? options.setMockups : noop;
  const messageApi = options.messageApi || null;

  const psdTemplates = ref([]);
  const selectedTemplateId = ref('');
  const templateName = ref('');
  const deleteTemplateConfirmId = ref('');
  const deleteTemplateConfirmTimer = ref(0);
  let skipNextTemplateSelectionReset = false;

  async function loadTemplates(payload = {}) {
    try {
      const result = await bridge.getPsdSmartObjectTemplates({
        preferCloud: payload.preferCloud === true
      });
      psdTemplates.value = result && Array.isArray(result.templates)
        ? result.templates
        : [];

      return result || null;
    } catch (error) {
      addLog(getErrorMessage(error), 'error');
      return null;
    }
  }

  async function loadSelectedTemplate() {
    if (!selectedTemplateId.value || busy.value) {
      return;
    }

    const template = psdTemplates.value.find((item) => item.id === selectedTemplateId.value);

    if (!template) {
      return;
    }

    busy.value = true;

    try {
      config.psdImageDirectoryPath = template.imageDirectoryPath || '';
      config.psdMetadataSourcePath = template.metadataSourcePath || '';
      config.psdMetadataSourceDirectoryPath = template.metadataSourceDirectoryPath || '';
      config.psdEngineWindowMode = template.engineWindowMode === 'visible' ? 'visible' : 'hidden';
      config.psdEngineConcurrency = clampConcurrency(template.engineConcurrency);
      config.psdSkipExistingOutputs = template.skipExistingOutputs !== false;
      templateName.value = template.name || '';

      setMockups(template.mockups);

      psdImageFiles.value = await collectDirectoryFiles(config.psdImageDirectoryPath);
      psdMetadataSourceFiles.value = config.psdMetadataSourceDirectoryPath
        ? await collectDirectoryFiles(config.psdMetadataSourceDirectoryPath)
        : [];

      addLog(`\u5DF2\u5957\u7528\u6A21\u677F\u201C${template.name || '\u672A\u547D\u540D\u6A21\u677F'}\u201D\u3002`, 'success');
    } catch (error) {
      addLog(getErrorMessage(error), 'error');
    } finally {
      busy.value = false;
    }
  }

  async function saveTemplate() {
    if (!templateName.value.trim() || busy.value) {
      return;
    }

    busy.value = true;

    try {
      ensureMockups();

      const result = await bridge.savePsdSmartObjectTemplate({
        id: selectedTemplateId.value || undefined,
        name: templateName.value.trim(),
        imageDirectoryPath: config.psdImageDirectoryPath,
        metadataSourcePath: config.psdMetadataSourcePath,
        metadataSourceDirectoryPath: config.psdMetadataSourceDirectoryPath,
        engineConcurrency: clampConcurrency(config.psdEngineConcurrency),
        engineWindowMode: config.psdEngineWindowMode,
        skipExistingOutputs: config.psdSkipExistingOutputs,
        mockups: mockups.value
      });

      if (result && Array.isArray(result.templates)) {
        psdTemplates.value = result.templates;
      }

      if (result && result.template && result.template.id) {
        skipNextTemplateSelectionReset = selectedTemplateId.value !== result.template.id;
        selectedTemplateId.value = result.template.id;
        templateName.value = result.template.name || '';
        deleteTemplateConfirmId.value = '';
      }

      addLog('\u6A21\u677F\u5DF2\u4FDD\u5B58\u3002', 'success');
      showMessage(messageApi, 'success', '\u6A21\u677F\u5DF2\u4FDD\u5B58');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  async function syncCloudTemplates() {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const result = await loadTemplates({
        preferCloud: true
      });
      const templateCount = result && Array.isArray(result.templates)
        ? result.templates.length
        : 0;
      const source = result && result.source ? result.source : '';
      const successMessage = source === 'cloud'
        ? `\u5DF2\u4ECE\u4E91\u7AEF\u540C\u6B65 ${templateCount} \u4E2A\u6A21\u677F\u3002`
        : templateCount > 0
          ? `\u4E91\u7AEF\u6CA1\u6709\u8FD4\u56DE\u65B0\u6A21\u677F\uFF0C\u5F53\u524D\u663E\u793A ${templateCount} \u4E2A\u672C\u5730\u6A21\u677F\u3002`
          : '\u4E91\u7AEF\u548C\u672C\u5730\u90FD\u6CA1\u6709\u6A21\u677F\u6570\u636E\u3002';

      addLog(successMessage, source === 'cloud' ? 'success' : '');
      showMessage(messageApi, 'success', successMessage);
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId.value || busy.value) {
      return;
    }

    if (deleteTemplateConfirmId.value !== selectedTemplateId.value) {
      deleteTemplateConfirmId.value = selectedTemplateId.value;
      clearTimer(deleteTemplateConfirmTimer);
      deleteTemplateConfirmTimer.value = setTimeout(() => {
        deleteTemplateConfirmId.value = '';
        deleteTemplateConfirmTimer.value = 0;
      }, 5000);
      return;
    }

    busy.value = true;

    try {
      const result = await bridge.deletePsdSmartObjectTemplate({
        id: selectedTemplateId.value
      });

      psdTemplates.value = result && Array.isArray(result.templates)
        ? result.templates
        : [];
      selectedTemplateId.value = '';
      templateName.value = '';
      deleteTemplateConfirmId.value = '';
      clearTimer(deleteTemplateConfirmTimer);

      addLog('\u6A21\u677F\u5DF2\u5220\u9664\u3002', 'success');
      showMessage(messageApi, 'success', '\u6A21\u677F\u5DF2\u5220\u9664');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  watch(selectedTemplateId, () => {
    if (skipNextTemplateSelectionReset) {
      skipNextTemplateSelectionReset = false;
      deleteTemplateConfirmId.value = '';
      clearTimer(deleteTemplateConfirmTimer);
      return;
    }

    templateName.value = '';
    deleteTemplateConfirmId.value = '';
    clearTimer(deleteTemplateConfirmTimer);
  });

  onBeforeUnmount(() => {
    clearTimer(deleteTemplateConfirmTimer);
  });

  return {
    deleteTemplateConfirmId,
    handleDeleteTemplate,
    loadSelectedTemplate,
    loadTemplates,
    psdTemplates,
    saveTemplate,
    selectedTemplateId,
    syncCloudTemplates,
    templateName
  };
}
