const { ipcMain } = require('electron');
const { UPDATE_CHANNELS } = require('./updateChannels');
const { registerInvokeHandlers } = require('./ipcRegistration');

function registerUpdaterIpc({
  updateService
}) {
  registerInvokeHandlers(ipcMain, {
    [UPDATE_CHANNELS.GET_STATUS]: () => (
      updateService.getStatus()
    ),
    [UPDATE_CHANNELS.CHECK]: (_event, payload) => (
      updateService.checkForUpdates(payload || {})
    ),
    [UPDATE_CHANNELS.DOWNLOAD]: () => (
      updateService.downloadUpdate()
    ),
    [UPDATE_CHANNELS.INSTALL]: () => (
      updateService.installUpdate()
    ),
    [UPDATE_CHANNELS.SKIP]: (_event, payload) => (
      updateService.skipUpdate(payload || {})
    )
  });
}

module.exports = {
  registerUpdaterIpc
};
