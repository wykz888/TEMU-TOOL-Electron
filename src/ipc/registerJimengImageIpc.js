const { ipcMain } = require('electron');
const { registerInvokeHandler } = require('./ipcRegistration');
const { JIMENG_IMAGE_CHANNELS } = require('./jimengImageChannels');

function resolveController(getController) {
  return typeof getController === 'function' ? getController() : null;
}

function registerJimengImageIpc({
  getController,
  getSettings,
  saveSettings,
  selectSaveDirectory
}) {
  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.UPDATE_WORKSPACE, async (_event, payload) => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.updateWorkspace !== 'function') {
      return {
        visible: false
      };
    }

    return controller.updateWorkspace(payload);
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.RELOAD_BROWSER, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.reloadBrowser !== 'function') {
      return {
        success: false
      };
    }

    return controller.reloadBrowser();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.NAVIGATE_HOME, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.navigateHome !== 'function') {
      return {
        success: false
      };
    }

    return controller.navigateHome();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.OPEN_CURRENT_URL_EXTERNAL, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.openCurrentUrlExternal !== 'function') {
      return {
        opened: false,
        url: ''
      };
    }

    return controller.openCurrentUrlExternal();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.GET_SETTINGS, async () => {
    if (typeof getSettings !== 'function') {
      return {
        settings: {
          version: 1,
          owner: null,
          updatedAt: '',
          promptPrefix: '',
          promptSuffix: '',
          saveDirectoryPath: '',
          createDateSubdirectory: false,
          filterDuplicateTasks: false,
          queueTaskLimit: 1,
          startTaskOffset: 0
        },
        source: 'unavailable'
      };
    }

    return getSettings();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.SAVE_SETTINGS, async (_event, payload) => {
    if (typeof saveSettings !== 'function') {
      return {
        settings: {
          version: 1,
          owner: null,
          updatedAt: '',
          promptPrefix: '',
          promptSuffix: '',
          saveDirectoryPath: '',
          createDateSubdirectory: false,
          filterDuplicateTasks: false,
          queueTaskLimit: 1,
          startTaskOffset: 0
        },
        source: 'unavailable'
      };
    }

    return saveSettings(payload);
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.SELECT_SAVE_DIRECTORY, async (_event, payload) => {
    if (typeof selectSaveDirectory !== 'function') {
      return {
        canceled: true,
        directoryPath: ''
      };
    }

    return selectSaveDirectory(payload);
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.GET_BATCH_STATE, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.getBatchState !== 'function') {
      return {
        success: true,
        state: {
          runId: '',
          status: 'idle',
          mode: '',
          taskCount: 0,
          currentTaskIndex: 0,
          currentTaskLabel: '',
          completedTaskCount: 0,
          submittedTaskCount: 0,
          pendingTaskCount: 0,
          activeTaskCount: 0,
          savedCount: 0,
          saveDirectoryPath: '',
          effectiveSaveDirectoryPath: '',
          createDateSubdirectory: false,
          queueTaskLimit: 1,
          startedAt: '',
          endedAt: '',
          canStart: true,
          canPause: false,
          canResume: false,
          canStop: false
        }
      };
    }

    return controller.getBatchState();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.START_BATCH_GENERATION, async (_event, payload) => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.startBatchGeneration !== 'function') {
      return {
        success: false,
        message: '\u5373\u68A6\u751F\u56FE\u5DE5\u4F5C\u533A\u672A\u5C31\u7EEA\u3002'
      };
    }

    return controller.startBatchGeneration(payload);
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.PAUSE_BATCH_GENERATION, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.pauseBatchGeneration !== 'function') {
      return {
        success: false,
        message: '\u6682\u505C\u529F\u80FD\u4E0D\u53EF\u7528\u3002'
      };
    }

    return controller.pauseBatchGeneration();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.RESUME_BATCH_GENERATION, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.resumeBatchGeneration !== 'function') {
      return {
        success: false,
        message: '\u7EE7\u7EED\u529F\u80FD\u4E0D\u53EF\u7528\u3002'
      };
    }

    return controller.resumeBatchGeneration();
  });

  registerInvokeHandler(ipcMain, JIMENG_IMAGE_CHANNELS.STOP_BATCH_GENERATION, async () => {
    const controller = resolveController(getController);

    if (!controller || typeof controller.stopBatchGeneration !== 'function') {
      return {
        success: false,
        message: '\u505C\u6B62\u529F\u80FD\u4E0D\u53EF\u7528\u3002'
      };
    }

    return controller.stopBatchGeneration();
  });

  return JIMENG_IMAGE_CHANNELS;
}

module.exports = {
  JIMENG_IMAGE_CHANNELS,
  registerJimengImageIpc
};
