const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { AUTH_CHANNELS } = require('../ipc/authChannels');
const { CREATION_CHANNELS } = require('../ipc/creationCenterChannels');
const { DIALOG_CHANNELS } = require('../ipc/dialogChannels');
const { FEATURE_CHANNELS } = require('../ipc/featureChannels');
const { GLOBAL_CONFIG_CHANNELS } = require('../ipc/globalConfigChannels');
const { POD_SUITE_TOOL_CHANNELS } = require('../ipc/podSuiteToolChannels');
const { UPDATE_CHANNELS } = require('../ipc/updateChannels');
const { SHOP_CHANNELS } = require('../ipc/shopChannels');
const { SHOP_WINDOW_CHANNELS } = require('../ipc/shopWindowChannels');
const { THEME_CHANNELS } = require('../ipc/themeChannels');
const { createFeatureCenterPreloadApi } = require('./featureCenterPreloadApi');
const { createInvokeApi, createSendApi } = require('./ipcApiBuilder');

function subscribe(channel, listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  const wrappedListener = (_event, payload) => {
    listener(payload);
  };

  ipcRenderer.on(channel, wrappedListener);

  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
  };
}

contextBridge.exposeInMainWorld('temuApp', {
  auth: createInvokeApi(ipcRenderer, {
    login: AUTH_CHANNELS.LOGIN,
    register: AUTH_CHANNELS.REGISTER,
    logout: AUTH_CHANNELS.LOGOUT,
    getSession: AUTH_CHANNELS.GET_SESSION,
    getCachedLoginAccount: AUTH_CHANNELS.GET_CACHED_LOGIN_ACCOUNT
  }),
  theme: {
    ...createInvokeApi(ipcRenderer, {
      getTheme: THEME_CHANNELS.GET_THEME,
      setTheme: THEME_CHANNELS.SET_THEME,
      getThemeAppearance: THEME_CHANNELS.GET_THEME_APPEARANCE,
      setThemeAppearance: THEME_CHANNELS.SET_THEME_APPEARANCE
    }),
    onThemeChanged(listener) {
      return subscribe(THEME_CHANNELS.CHANGED, listener);
    }
  },
  dialogs: createInvokeApi(ipcRenderer, {
    confirm: DIALOG_CHANNELS.SHOW_CONFIRM_DIALOG
  }),
  updater: {
    ...createInvokeApi(ipcRenderer, {
      getStatus: UPDATE_CHANNELS.GET_STATUS,
      check: UPDATE_CHANNELS.CHECK,
      download: UPDATE_CHANNELS.DOWNLOAD,
      install: UPDATE_CHANNELS.INSTALL,
      skip: UPDATE_CHANNELS.SKIP
    }),
    onStatus(listener) {
      return subscribe(UPDATE_CHANNELS.STATUS, listener);
    }
  },
  globalConfig: createInvokeApi(ipcRenderer, {
    getGeneralSettings: GLOBAL_CONFIG_CHANNELS.GET_GENERAL_SETTINGS,
    saveGeneralSettings: GLOBAL_CONFIG_CHANNELS.SAVE_GENERAL_SETTINGS,
    getStorageSelection: GLOBAL_CONFIG_CHANNELS.GET_STORAGE_SELECTION,
    saveStorageSelection: GLOBAL_CONFIG_CHANNELS.SAVE_STORAGE_SELECTION,
    listTencentCosBuckets: GLOBAL_CONFIG_CHANNELS.LIST_TENCENT_COS_BUCKETS,
    listTencentCosObjects: GLOBAL_CONFIG_CHANNELS.LIST_TENCENT_COS_OBJECTS,
    deleteTencentCosObjects: GLOBAL_CONFIG_CHANNELS.DELETE_TENCENT_COS_OBJECTS,
    listCloudflareR2Buckets: GLOBAL_CONFIG_CHANNELS.LIST_CLOUDFLARE_R2_BUCKETS,
    listCloudflareR2PublicDomains: GLOBAL_CONFIG_CHANNELS.LIST_CLOUDFLARE_R2_PUBLIC_DOMAINS,
    listCloudflareR2Objects: GLOBAL_CONFIG_CHANNELS.LIST_CLOUDFLARE_R2_OBJECTS,
    deleteCloudflareR2Objects: GLOBAL_CONFIG_CHANNELS.DELETE_CLOUDFLARE_R2_OBJECTS,
    getAiConfig: GLOBAL_CONFIG_CHANNELS.GET_AI_CONFIG,
    getUpdateSettings: GLOBAL_CONFIG_CHANNELS.GET_UPDATE_SETTINGS,
    saveUpdateSettings: GLOBAL_CONFIG_CHANNELS.SAVE_UPDATE_SETTINGS,
    saveAiConfig: GLOBAL_CONFIG_CHANNELS.SAVE_AI_CONFIG,
    testAiApiKey: GLOBAL_CONFIG_CHANNELS.TEST_AI_API_KEY
  }),
  shopManagement: createInvokeApi(ipcRenderer, {
    getState: SHOP_CHANNELS.GET_STATE,
    syncCloudState: SHOP_CHANNELS.SYNC_CLOUD_STATE,
    getShopDetail: SHOP_CHANNELS.GET_SHOP_DETAIL,
    setShopVisibility: SHOP_CHANNELS.SET_SHOP_VISIBILITY,
    addGroup: SHOP_CHANNELS.ADD_GROUP,
    updateGroup: SHOP_CHANNELS.UPDATE_GROUP,
    deleteGroup: SHOP_CHANNELS.DELETE_GROUP,
    addShop: SHOP_CHANNELS.ADD_SHOP,
    updateShop: SHOP_CHANNELS.UPDATE_SHOP
  }),
  featureCenter: createFeatureCenterPreloadApi({
    ipcRenderer,
    featureChannels: FEATURE_CHANNELS,
    subscribe
  }),
  creationCenter: {
    getCreationCatalog() {
      return ipcRenderer.invoke(CREATION_CHANNELS.GET_CREATION_CATALOG);
    },
    openPodUploadSheetMiaoshou(payload) {
      return ipcRenderer.invoke(CREATION_CHANNELS.OPEN_POD_UPLOAD_SHEET_MIAOSHOU, payload);
    },
    openPodSuiteTool(payload) {
      return ipcRenderer.invoke(CREATION_CHANNELS.OPEN_POD_SUITE_TOOL, payload);
    }
  },
  podSuiteTool: {
    ...createInvokeApi(ipcRenderer, {
      selectWhiteMockupFile: POD_SUITE_TOOL_CHANNELS.SELECT_WHITE_MOCKUP_FILE,
      selectMaskImageFile: POD_SUITE_TOOL_CHANNELS.SELECT_MASK_IMAGE_FILE,
      selectTextureImageFile: POD_SUITE_TOOL_CHANNELS.SELECT_TEXTURE_IMAGE_FILE,
      selectPreviewDesignFile: POD_SUITE_TOOL_CHANNELS.SELECT_PREVIEW_DESIGN_FILE,
      selectImageDirectory: POD_SUITE_TOOL_CHANNELS.SELECT_IMAGE_DIRECTORY,
      selectOutputDirectory: POD_SUITE_TOOL_CHANNELS.SELECT_OUTPUT_DIRECTORY,
      collectImageFiles: POD_SUITE_TOOL_CHANNELS.COLLECT_IMAGE_FILES,
      selectPsdMockupFile: POD_SUITE_TOOL_CHANNELS.SELECT_PSD_MOCKUP_FILE,
      selectPsdImageDirectory: POD_SUITE_TOOL_CHANNELS.SELECT_PSD_IMAGE_DIRECTORY,
      selectPsdOutputDirectory: POD_SUITE_TOOL_CHANNELS.SELECT_PSD_OUTPUT_DIRECTORY,
      selectPsdMetadataSourceFile: POD_SUITE_TOOL_CHANNELS.SELECT_PSD_METADATA_SOURCE_FILE,
      selectPsdMetadataSourceDirectory: POD_SUITE_TOOL_CHANNELS.SELECT_PSD_METADATA_SOURCE_DIRECTORY,
      openDirectory: POD_SUITE_TOOL_CHANNELS.OPEN_DIRECTORY,
      generateWhiteMockups: POD_SUITE_TOOL_CHANNELS.GENERATE_WHITE_MOCKUPS,
      generatePsdSmartObjectMockups: POD_SUITE_TOOL_CHANNELS.GENERATE_PSD_SMART_OBJECT_MOCKUPS,
      cancelPsdSmartObjectMockups: POD_SUITE_TOOL_CHANNELS.CANCEL_PSD_SMART_OBJECT_MOCKUPS,
      setPsdEngineWindowVisible: POD_SUITE_TOOL_CHANNELS.SET_PSD_ENGINE_WINDOW_VISIBLE,
      getPsdSmartObjectTemplates: POD_SUITE_TOOL_CHANNELS.GET_PSD_SMART_OBJECT_TEMPLATES,
      savePsdSmartObjectTemplate: POD_SUITE_TOOL_CHANNELS.SAVE_PSD_SMART_OBJECT_TEMPLATE,
      deletePsdSmartObjectTemplate: POD_SUITE_TOOL_CHANNELS.DELETE_PSD_SMART_OBJECT_TEMPLATE,
      renderWhiteMockupPreview: POD_SUITE_TOOL_CHANNELS.RENDER_WHITE_MOCKUP_PREVIEW,
      getWhiteMockupTemplate: POD_SUITE_TOOL_CHANNELS.GET_WHITE_MOCKUP_TEMPLATE,
      saveWhiteMockupTemplate: POD_SUITE_TOOL_CHANNELS.SAVE_WHITE_MOCKUP_TEMPLATE,
      createWhiteMockupRegionFromMask: POD_SUITE_TOOL_CHANNELS.CREATE_WHITE_MOCKUP_REGION_FROM_MASK
    }),
    onPsdSmartObjectProgress(listener) {
      return subscribe(POD_SUITE_TOOL_CHANNELS.PSD_SMART_OBJECT_PROGRESS, listener);
    }
  },
  files: {
    getPathForFile(file) {
      return webUtils.getPathForFile(file);
    }
  },
  shopWindow: {
    ...createSendApi(ipcRenderer, {
      updateWorkspace: SHOP_WINDOW_CHANNELS.UPDATE_WORKSPACE,
      closeBrowserTab: SHOP_WINDOW_CHANNELS.CLOSE_BROWSER_TAB
    }),
    ...createInvokeApi(ipcRenderer, {
      getBrowserStorageSyncState: SHOP_WINDOW_CHANNELS.GET_BROWSER_STORAGE_SYNC_STATE,
      syncBrowserStorageToCloud: SHOP_WINDOW_CHANNELS.SYNC_BROWSER_STORAGE_TO_CLOUD,
      restoreBrowserStorageFromCloud: SHOP_WINDOW_CHANNELS.RESTORE_BROWSER_STORAGE_FROM_CLOUD,
      persistBrowserSessionNow: SHOP_WINDOW_CHANNELS.PERSIST_BROWSER_SESSION_NOW,
      openBrowserUrlInNewTab: SHOP_WINDOW_CHANNELS.OPEN_BROWSER_URL_IN_NEW_TAB,
      restartLoginFlow: SHOP_WINDOW_CHANNELS.RESTART_LOGIN_FLOW
    }),
    onWorkspaceSyncRequested(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.REQUEST_WORKSPACE_SYNC, listener);
    },
    onBrowserTabCreated(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.BROWSER_TAB_CREATED, listener);
    },
    onBrowserTabClosed(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.BROWSER_TAB_CLOSED, listener);
    },
    onBrowserTabUpdated(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.BROWSER_TAB_UPDATED, listener);
    },
    onBrowserTabReset(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.BROWSER_TAB_RESET, listener);
    },
    onBrowserTabMessage(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, listener);
    },
    onBrowserUrlInputRequested(listener) {
      return subscribe(SHOP_WINDOW_CHANNELS.REQUEST_BROWSER_URL_INPUT, listener);
    }
  }
});
