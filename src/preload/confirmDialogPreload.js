const { contextBridge, ipcRenderer } = require('electron');
const { DIALOG_CHANNELS } = require('../ipc/dialogChannels');

const CONFIRM_DIALOG_PAYLOAD_ARGUMENT_PREFIX = '--temu-confirm-dialog-payload=';

function readConfirmDialogPayload() {
  const rawArgument = Array.isArray(process.argv)
    ? process.argv.find((item) => String(item || '').startsWith(CONFIRM_DIALOG_PAYLOAD_ARGUMENT_PREFIX))
    : '';

  if (!rawArgument) {
    return {};
  }

  try {
    const encodedPayload = rawArgument.slice(CONFIRM_DIALOG_PAYLOAD_ARGUMENT_PREFIX.length);
    return JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
  } catch (_error) {
    return {};
  }
}

const confirmDialogPayload = Object.freeze(readConfirmDialogPayload());

contextBridge.exposeInMainWorld('temuConfirmDialog', {
  getPayload() {
    return confirmDialogPayload;
  },
  resolve(payload) {
    ipcRenderer.send(DIALOG_CHANNELS.COMPLETE_CONFIRM_DIALOG, {
      requestId: String(confirmDialogPayload && confirmDialogPayload.requestId || '').trim(),
      confirmed: Boolean(payload && payload.confirmed)
    });
  }
});
