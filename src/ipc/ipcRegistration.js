function registerInvokeHandler(ipcMain, channel, handler) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function registerInvokeHandlers(ipcMain, handlerMap) {
  Object.entries(handlerMap || {}).forEach(([channel, handler]) => {
    if (typeof handler === 'function') {
      registerInvokeHandler(ipcMain, channel, handler);
    }
  });
}

function registerSendListener(ipcMain, channel, listener) {
  ipcMain.removeAllListeners(channel);
  ipcMain.on(channel, listener);
}

function registerSendListeners(ipcMain, listenerMap) {
  Object.entries(listenerMap || {}).forEach(([channel, listener]) => {
    if (typeof listener === 'function') {
      registerSendListener(ipcMain, channel, listener);
    }
  });
}

module.exports = {
  registerInvokeHandler,
  registerInvokeHandlers,
  registerSendListener,
  registerSendListeners
};
