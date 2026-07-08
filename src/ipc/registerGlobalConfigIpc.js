const { ipcMain } = require('electron');
const { GLOBAL_CONFIG_CHANNELS } = require('./globalConfigChannels');
const { registerInvokeHandlers } = require('./ipcRegistration');

function registerGlobalConfigIpc({
  globalConfigService
}) {
  registerInvokeHandlers(ipcMain, {
    [GLOBAL_CONFIG_CHANNELS.GET_GENERAL_SETTINGS]: () => (
      globalConfigService.getGeneralSettings()
    ),
    [GLOBAL_CONFIG_CHANNELS.SAVE_GENERAL_SETTINGS]: (_event, payload) => (
      globalConfigService.saveGeneralSettings(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.GET_STORAGE_SELECTION]: () => (
      globalConfigService.getStorageSelection()
    ),
    [GLOBAL_CONFIG_CHANNELS.SAVE_STORAGE_SELECTION]: (_event, payload) => (
      globalConfigService.saveStorageSelection(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.LIST_TENCENT_COS_BUCKETS]: (_event, payload) => (
      globalConfigService.listTencentCosBuckets(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.LIST_TENCENT_COS_OBJECTS]: (_event, payload) => (
      globalConfigService.listTencentCosObjects(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.DELETE_TENCENT_COS_OBJECTS]: (_event, payload) => (
      globalConfigService.deleteTencentCosObjects(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.LIST_CLOUDFLARE_R2_BUCKETS]: (_event, payload) => (
      globalConfigService.listCloudflareR2Buckets(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.LIST_CLOUDFLARE_R2_PUBLIC_DOMAINS]: (_event, payload) => (
      globalConfigService.listCloudflareR2PublicDomains(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.LIST_CLOUDFLARE_R2_OBJECTS]: (_event, payload) => (
      globalConfigService.listCloudflareR2Objects(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.DELETE_CLOUDFLARE_R2_OBJECTS]: (_event, payload) => (
      globalConfigService.deleteCloudflareR2Objects(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.GET_AI_CONFIG]: () => (
      globalConfigService.getAiConfig()
    ),
    [GLOBAL_CONFIG_CHANNELS.GET_UPDATE_SETTINGS]: () => (
      globalConfigService.getUpdateSettings()
    ),
    [GLOBAL_CONFIG_CHANNELS.SAVE_UPDATE_SETTINGS]: (_event, payload) => (
      globalConfigService.saveUpdateSettings(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.SAVE_AI_CONFIG]: (_event, payload) => (
      globalConfigService.saveAiConfig(payload || {})
    ),
    [GLOBAL_CONFIG_CHANNELS.TEST_AI_API_KEY]: (_event, payload) => (
      globalConfigService.testAiApiKey(payload || {})
    )
  });
}

module.exports = {
  registerGlobalConfigIpc
};
