const { BrowserWindow, ipcMain } = require('electron');
const { DIALOG_CHANNELS } = require('./dialogChannels');
const { registerInvokeHandler } = require('./ipcRegistration');

function registerDialogIpc({ showConfirmDialog }) {
  registerInvokeHandler(ipcMain, DIALOG_CHANNELS.SHOW_CONFIRM_DIALOG, async (event, payload) => {
    if (typeof showConfirmDialog !== 'function') {
      return false;
    }

    const parentWindow = event && event.sender
      ? BrowserWindow.fromWebContents(event.sender)
      : null;

    return showConfirmDialog({
      ...(payload || {}),
      parentWindow
    });
  });

  return DIALOG_CHANNELS;
}

module.exports = {
  DIALOG_CHANNELS,
  registerDialogIpc
};
