const { ipcMain } = require('electron');
const { FEATURE_CHANNELS } = require('./featureChannels');
const { registerInvokeHandler } = require('./ipcRegistration');
const { registerFeatureCenterMarketingToolsIpc } = require('./registerFeatureCenterMarketingToolsIpc');
const { registerFeatureCenterOpenIpc } = require('./registerFeatureCenterOpenIpc');
const { registerFeatureCenterOperationsIpc } = require('./registerFeatureCenterOperationsIpc');
const { registerFeatureCenterPodUploadIpc } = require('./registerFeatureCenterPodUploadIpc');
const { registerFeatureCenterPromotionIpc } = require('./registerFeatureCenterPromotionIpc');
const featureCenterFallbacks = require('./featureCenterIpcFallbacks');

function handle(channel, handler) {
  registerInvokeHandler(ipcMain, channel, handler);
}

function registerFeatureCenterIpc(options = {}) {
  const { runtimeLogger } = options;

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  const sharedOptions = {
    ...options,
    FEATURE_CHANNELS,
    fallbacks: featureCenterFallbacks,
    handle,
    log,
    logError
  };

  registerFeatureCenterOpenIpc(sharedOptions);
  registerFeatureCenterMarketingToolsIpc(sharedOptions);
  registerFeatureCenterOperationsIpc(sharedOptions);
  registerFeatureCenterPromotionIpc(sharedOptions);
  registerFeatureCenterPodUploadIpc(sharedOptions);

  return FEATURE_CHANNELS;
}

module.exports = {
  FEATURE_CHANNELS,
  registerFeatureCenterIpc
};
