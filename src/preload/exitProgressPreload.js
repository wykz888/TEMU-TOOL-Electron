const { contextBridge, ipcRenderer } = require('electron');
const { EXIT_PROGRESS_CHANNELS } = require('../ipc/exitProgressChannels');

const EXIT_PROGRESS_PAYLOAD_ARGUMENT_PREFIX = '--temu-exit-progress-payload=';

function readExitProgressPayload() {
  const rawArgument = Array.isArray(process.argv)
    ? process.argv.find((item) => String(item || '').startsWith(EXIT_PROGRESS_PAYLOAD_ARGUMENT_PREFIX))
    : '';

  if (!rawArgument) {
    return {};
  }

  try {
    const encodedPayload = rawArgument.slice(EXIT_PROGRESS_PAYLOAD_ARGUMENT_PREFIX.length);
    return JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
  } catch (_error) {
    return {};
  }
}

const exitProgressPayload = Object.freeze(readExitProgressPayload());

contextBridge.exposeInMainWorld('temuExitProgress', {
  getPayload() {
    return exitProgressPayload;
  },
  onUpdate(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    const wrappedListener = (_event, payload) => {
      listener(payload);
    };

    ipcRenderer.on(EXIT_PROGRESS_CHANNELS.UPDATE, wrappedListener);

    return () => {
      ipcRenderer.removeListener(EXIT_PROGRESS_CHANNELS.UPDATE, wrappedListener);
    };
  }
});
