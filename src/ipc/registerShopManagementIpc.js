const { ipcMain } = require('electron');
const { createShopManagementService } = require('../services/shopManagement');
const { registerInvokeHandlers } = require('./ipcRegistration');
const { SHOP_CHANNELS } = require('./shopChannels');

function registerShopManagementIpc({
  app,
  sessionStore,
  shopManagementService,
  getShopWindowBrowserController
}) {
  const activeShopManagementService = shopManagementService || createShopManagementService({
    app,
    sessionStore,
    getShopWindowBrowserController
  });

  registerInvokeHandlers(ipcMain, {
    [SHOP_CHANNELS.GET_STATE]: async () => activeShopManagementService.getState(),
    [SHOP_CHANNELS.SYNC_CLOUD_STATE]: async () => activeShopManagementService.syncCloudState(),
    [SHOP_CHANNELS.GET_SHOP_DETAIL]: async (_event, payload) => activeShopManagementService.getShopDetail(payload),
    [SHOP_CHANNELS.SET_SHOP_VISIBILITY]: async (_event, payload) => activeShopManagementService.setShopVisibility(payload),
    [SHOP_CHANNELS.ADD_GROUP]: async (_event, payload) => activeShopManagementService.addGroup(payload),
    [SHOP_CHANNELS.UPDATE_GROUP]: async (_event, payload) => activeShopManagementService.updateGroup(payload),
    [SHOP_CHANNELS.DELETE_GROUP]: async (_event, payload) => activeShopManagementService.deleteGroup(payload),
    [SHOP_CHANNELS.ADD_SHOP]: async (_event, payload) => activeShopManagementService.addShop(payload),
    [SHOP_CHANNELS.UPDATE_SHOP]: async (_event, payload) => activeShopManagementService.updateShop(payload)
  });

  return activeShopManagementService;
}

module.exports = {
  SHOP_CHANNELS,
  registerShopManagementIpc
};
