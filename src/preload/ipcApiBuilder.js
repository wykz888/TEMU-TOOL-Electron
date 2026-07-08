function createInvokeApi(ipcRenderer, methodChannels) {
  return Object.fromEntries(
    Object.entries(methodChannels || {}).map(([methodName, channel]) => [
      methodName,
      (payload) => ipcRenderer.invoke(channel, payload)
    ])
  );
}

function createSendApi(ipcRenderer, methodChannels) {
  return Object.fromEntries(
    Object.entries(methodChannels || {}).map(([methodName, channel]) => [
      methodName,
      (payload) => {
        ipcRenderer.send(channel, payload);
      }
    ])
  );
}

module.exports = {
  createInvokeApi,
  createSendApi
};
