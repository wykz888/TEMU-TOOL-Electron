const SHOP_WINDOW_CHANNELS = Object.freeze({
  UPDATE_WORKSPACE: 'shop-window:update-workspace',
  REQUEST_WORKSPACE_SYNC: 'shop-window:request-workspace-sync',
  CLOSE_BROWSER_TAB: 'shop-window:close-browser-tab',
  GET_BROWSER_STORAGE_SYNC_STATE: 'shop-window:get-browser-storage-sync-state',
  SYNC_BROWSER_STORAGE_TO_CLOUD: 'shop-window:sync-browser-storage-to-cloud',
  RESTORE_BROWSER_STORAGE_FROM_CLOUD: 'shop-window:restore-browser-storage-from-cloud',
  PERSIST_BROWSER_SESSION_NOW: 'shop-window:persist-browser-session-now',
  OPEN_BROWSER_URL_IN_NEW_TAB: 'shop-window:open-browser-url-in-new-tab',
  RESTART_LOGIN_FLOW: 'shop-window:restart-login-flow',
  BROWSER_TAB_CREATED: 'shop-window:browser-tab-created',
  BROWSER_TAB_CLOSED: 'shop-window:browser-tab-closed',
  BROWSER_TAB_UPDATED: 'shop-window:browser-tab-updated',
  BROWSER_TAB_RESET: 'shop-window:browser-tab-reset',
  BROWSER_TAB_MESSAGE: 'shop-window:browser-tab-message',
  REQUEST_BROWSER_URL_INPUT: 'shop-window:request-browser-url-input'
});

module.exports = {
  SHOP_WINDOW_CHANNELS
};
