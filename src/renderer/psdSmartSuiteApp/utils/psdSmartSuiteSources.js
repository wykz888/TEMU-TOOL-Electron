import { computed, ref } from 'vue';

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

export function usePsdSmartSuiteSources(options = {}) {
  const bridge = options.bridge;
  const busy = options.busy;
  const config = options.config;
  const addLog = typeof options.addLog === 'function' ? options.addLog : noop;
  const messageApi = options.messageApi || null;

  const psdImageFiles = ref([]);
  const psdMetadataSourceFiles = ref([]);
  const metadataSourceDisplay = computed(() => (
    config.psdMetadataSourcePath || config.psdMetadataSourceDirectoryPath || ''
  ));
  const metadataSourceSummary = computed(() => {
    if (config.psdMetadataSourcePath) {
      return '\u5355\u56FE';
    }

    if (config.psdMetadataSourceDirectoryPath) {
      return `\u76EE\u5F55 ${psdMetadataSourceFiles.value.length} \u5F20`;
    }

    return '\u672A\u8BBE\u7F6E';
  });

  async function collectDirectoryFiles(directoryPath) {
    if (!directoryPath) {
      return [];
    }

    const result = await bridge.collectImageFiles({ directoryPath });
    return result && Array.isArray(result.files) ? result.files : [];
  }

  async function selectImageDirectory() {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const result = await bridge.selectPsdImageDirectory({
        defaultPath: config.psdImageDirectoryPath
      });

      if (!result || result.canceled) {
        return;
      }

      config.psdImageDirectoryPath = result.directoryPath || '';
      psdImageFiles.value = Array.isArray(result.files) ? result.files : [];
      addLog(`\u5DF2\u9009\u62E9\u7D20\u6750\u76EE\u5F55\uFF0C\u5171\u8BC6\u522B ${psdImageFiles.value.length} \u5F20\u56FE\u7247\u3002`, 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  async function selectMetadataFile() {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const result = await bridge.selectPsdMetadataSourceFile({
        defaultPath: config.psdMetadataSourcePath
      });

      if (!result || result.canceled) {
        return;
      }

      config.psdMetadataSourcePath = result.filePath || '';
      config.psdMetadataSourceDirectoryPath = '';
      psdMetadataSourceFiles.value = [];
      addLog(`\u5DF2\u9009\u62E9\u5143\u6570\u636E\u6765\u6E90\u56FE\u7247\uFF1A${config.psdMetadataSourcePath}`, 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  async function selectMetadataDirectory() {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const result = await bridge.selectPsdMetadataSourceDirectory({
        defaultPath: config.psdMetadataSourceDirectoryPath
      });

      if (!result || result.canceled) {
        return;
      }

      config.psdMetadataSourceDirectoryPath = result.directoryPath || '';
      config.psdMetadataSourcePath = '';
      psdMetadataSourceFiles.value = Array.isArray(result.files) ? result.files : [];
      addLog(`\u5DF2\u9009\u62E9\u5143\u6570\u636E\u6765\u6E90\u76EE\u5F55\uFF0C\u5171 ${psdMetadataSourceFiles.value.length} \u5F20\u56FE\u7247\u3002`, 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  function clearMetadataSource() {
    config.psdMetadataSourcePath = '';
    config.psdMetadataSourceDirectoryPath = '';
    psdMetadataSourceFiles.value = [];
  }

  async function refreshSourceFiles() {
    if (config.psdImageDirectoryPath) {
      try {
        psdImageFiles.value = await collectDirectoryFiles(config.psdImageDirectoryPath);
      } catch (_) {
        psdImageFiles.value = [];
      }
    }

    if (config.psdMetadataSourceDirectoryPath) {
      try {
        psdMetadataSourceFiles.value = await collectDirectoryFiles(config.psdMetadataSourceDirectoryPath);
      } catch (_) {
        psdMetadataSourceFiles.value = [];
      }
    }
  }

  return {
    clearMetadataSource,
    collectDirectoryFiles,
    metadataSourceDisplay,
    metadataSourceSummary,
    psdImageFiles,
    psdMetadataSourceFiles,
    refreshSourceFiles,
    selectImageDirectory,
    selectMetadataDirectory,
    selectMetadataFile
  };
}
