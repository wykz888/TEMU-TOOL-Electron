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

export function usePsdSmartSuiteMockupFileActions(options = {}) {
  const bridge = options.bridge;
  const busy = options.busy;
  const mockups = options.mockups;
  const addLog = typeof options.addLog === 'function' ? options.addLog : noop;
  const updateMockupField = typeof options.updateMockupField === 'function'
    ? options.updateMockupField
    : noop;
  const messageApi = options.messageApi || null;

  async function selectMockupPsd(mockupId) {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const currentMockup = mockups.value.find((item) => item.id === mockupId);
      const result = await bridge.selectPsdMockupFile({
        defaultPath: currentMockup ? currentMockup.psdPath : ''
      });

      if (!result || result.canceled) {
        return;
      }

      updateMockupField(mockupId, 'psdPath', result.filePath || '');
      addLog(`\u5DF2\u9009\u62E9 PSD \u6837\u673A\uFF1A${result.filePath}`, 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  async function selectMockupOutputDirectory(mockupId) {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const currentMockup = mockups.value.find((item) => item.id === mockupId);
      const result = await bridge.selectPsdOutputDirectory({
        defaultPath: currentMockup ? currentMockup.outputDirectoryPath : ''
      });

      if (!result || result.canceled) {
        return;
      }

      updateMockupField(mockupId, 'outputDirectoryPath', result.directoryPath || '');
      addLog(`\u5DF2\u9009\u62E9\u5BFC\u51FA\u76EE\u5F55\uFF1A${result.directoryPath}`, 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      busy.value = false;
    }
  }

  async function openMockupOutputDirectory(mockupId) {
    const currentMockup = mockups.value.find((item) => item.id === mockupId);

    if (!currentMockup || !currentMockup.outputDirectoryPath) {
      return;
    }

    try {
      await bridge.openDirectory({
        directoryPath: currentMockup.outputDirectoryPath
      });
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    }
  }

  return {
    openMockupOutputDirectory,
    selectMockupOutputDirectory,
    selectMockupPsd
  };
}
