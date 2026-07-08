const { ipcMain } = require('electron');
const {
  registerInvokeHandler,
  registerSendListener
} = require('./ipcRegistration');
const { SHOP_WINDOW_CHANNELS } = require('./shopWindowChannels');

function registerShopWindowIpc({ getController, getBrowserStorageSyncService }) {
  registerSendListener(ipcMain, SHOP_WINDOW_CHANNELS.UPDATE_WORKSPACE, (_event, payload) => {
    const controller = typeof getController === 'function' ? getController() : null;

    if (!controller) {
      return;
    }

    Promise.resolve(controller.updateWorkspace(payload || {})).catch((error) => {
      console.error('Failed to update shop workspace:', error);
    });
  });

  registerSendListener(ipcMain, SHOP_WINDOW_CHANNELS.CLOSE_BROWSER_TAB, (_event, payload) => {
    const controller = typeof getController === 'function' ? getController() : null;

    if (!controller || typeof controller.closeBrowserTab !== 'function') {
      return;
    }

    Promise.resolve(controller.closeBrowserTab(payload || {})).catch((error) => {
      console.error('Failed to close shop browser tab:', error);
    });
  });

  registerInvokeHandler(ipcMain, SHOP_WINDOW_CHANNELS.GET_BROWSER_STORAGE_SYNC_STATE, async (_event, payload) => {
    const browserStorageSyncService =
      typeof getBrowserStorageSyncService === 'function' ? getBrowserStorageSyncService() : null;

    if (!browserStorageSyncService || typeof browserStorageSyncService.getSyncState !== 'function') {
      return {
        shopId: '',
        origins: [],
        storageTypes: [],
        localSummary: null,
        cloudSummary: null
      };
    }

    return browserStorageSyncService.getSyncState(payload || {});
  });

  registerInvokeHandler(ipcMain, SHOP_WINDOW_CHANNELS.SYNC_BROWSER_STORAGE_TO_CLOUD, async (_event, payload) => {
    const browserStorageSyncService =
      typeof getBrowserStorageSyncService === 'function' ? getBrowserStorageSyncService() : null;

    if (!browserStorageSyncService || typeof browserStorageSyncService.syncToCloud !== 'function') {
      throw new Error('\u5E97\u94FA\u6D4F\u89C8\u5668\u5B58\u50A8\u4E0A\u4F20\u529F\u80FD\u6682\u672A\u5C31\u7EEA\u3002');
    }

    return browserStorageSyncService.syncToCloud(payload || {});
  });

  registerInvokeHandler(ipcMain, SHOP_WINDOW_CHANNELS.RESTORE_BROWSER_STORAGE_FROM_CLOUD, async (_event, payload) => {
    const browserStorageSyncService =
      typeof getBrowserStorageSyncService === 'function' ? getBrowserStorageSyncService() : null;

    if (!browserStorageSyncService || typeof browserStorageSyncService.restoreFromCloud !== 'function') {
      throw new Error('\u5E97\u94FA\u6D4F\u89C8\u5668\u5B58\u50A8\u6062\u590D\u529F\u80FD\u6682\u672A\u5C31\u7EEA\u3002');
    }

    return browserStorageSyncService.restoreFromCloud(payload || {});
  });

  registerInvokeHandler(ipcMain, SHOP_WINDOW_CHANNELS.PERSIST_BROWSER_SESSION_NOW, async (_event, payload) => {
    const controller = typeof getController === 'function' ? getController() : null;
    const browserStorageSyncService =
      typeof getBrowserStorageSyncService === 'function' ? getBrowserStorageSyncService() : null;

    if (!controller || typeof controller.persistBrowserSessionNow !== 'function') {
      throw new Error('\u5E97\u94FA\u4F1A\u8BDD\u4FDD\u5B58\u529F\u80FD\u6682\u672A\u5C31\u7EEA\u3002');
    }

    const persisted = await controller.persistBrowserSessionNow(payload || {});

    if (
      browserStorageSyncService
      && typeof browserStorageSyncService.syncToCloud === 'function'
      && payload
      && payload.syncToCloud !== false
    ) {
      await browserStorageSyncService.syncToCloud({
        ...(payload || {}),
        types: Array.isArray(payload && payload.types) && payload.types.length > 0
          ? payload.types
          : ['cookies', 'localStorage', 'indexedDb']
      });
    }

    return persisted;
  });

  registerInvokeHandler(ipcMain, SHOP_WINDOW_CHANNELS.OPEN_BROWSER_URL_IN_NEW_TAB, async (_event, payload) => {
    const controller = typeof getController === 'function' ? getController() : null;

    if (!controller || typeof controller.openBrowserUrlInNewTab !== 'function') {
      throw new Error('\u6D4F\u89C8\u5668\u65B0\u5EFA\u7F51\u5740\u529F\u80FD\u6682\u672A\u5C31\u7EEA\u3002');
    }

    return controller.openBrowserUrlInNewTab(payload || {});
  });

  registerInvokeHandler(ipcMain, SHOP_WINDOW_CHANNELS.RESTART_LOGIN_FLOW, async (_event, payload) => {
    const controller = typeof getController === 'function' ? getController() : null;

    if (!controller || typeof controller.restartLoginFlow !== 'function') {
      throw new Error('\u91CD\u65B0\u542F\u52A8\u767B\u5F55\u6D41\u7A0B\u529F\u80FD\u6682\u672A\u5C31\u7EEA\u3002');
    }

    return controller.restartLoginFlow(payload || {});
  });

  return SHOP_WINDOW_CHANNELS;
}

module.exports = {
  SHOP_WINDOW_CHANNELS,
  registerShopWindowIpc
};
