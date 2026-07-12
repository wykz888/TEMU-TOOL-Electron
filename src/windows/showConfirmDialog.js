const path = require('node:path');
const crypto = require('node:crypto');
const { BrowserWindow, ipcMain } = require('electron');
const { DIALOG_CHANNELS } = require('../ipc/dialogChannels');
const {
  normalizeThemeAppearance
} = require('../services/theme/themePreferenceService');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');

const CONFIRM_DIALOG_PAYLOAD_ARGUMENT_PREFIX = '--temu-confirm-dialog-payload=';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeTone(value) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === 'danger' || normalizedValue === 'warning') {
    return normalizedValue;
  }

  return 'primary';
}

function normalizeTheme(value) {
  return normalizeText(value).toLowerCase() === 'dark' ? 'dark' : 'light';
}

function buildConfirmDialogPayload(payload = {}) {
  const tone = normalizeTone(payload.tone);

  return {
    requestId: crypto.randomUUID(),
    title: normalizeText(payload.title) || '\u64cd\u4f5c\u786e\u8ba4',
    badgeText:
      normalizeText(payload.badgeText)
      || (tone === 'danger' ? '\u91cd\u8981\u63d0\u793a' : '\u64cd\u4f5c\u786e\u8ba4'),
    message: normalizeText(payload.message) || '\u8bf7\u786e\u8ba4\u662f\u5426\u7ee7\u7eed\u3002',
    detail: normalizeText(payload.detail),
    confirmText: normalizeText(payload.confirmText) || '\u786e\u8ba4',
    cancelText: normalizeText(payload.cancelText) || '\u53d6\u6d88',
    tone,
    theme: normalizeTheme(payload.theme),
    appearance: normalizeThemeAppearance(payload.appearance)
  };
}

function encodeConfirmDialogPayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function showConfirmDialog(payload = {}) {
  const normalizedPayload = buildConfirmDialogPayload(payload);
  const parentWindow =
    payload && payload.parentWindow && !payload.parentWindow.isDestroyed()
      ? payload.parentWindow
      : null;

  return new Promise((resolve) => {
    let settled = false;
    let confirmWindow = null;

    const finish = (confirmed) => {
      if (settled) {
        return;
      }

      settled = true;
      ipcMain.removeListener(DIALOG_CHANNELS.COMPLETE_CONFIRM_DIALOG, handleDialogCompleted);

      if (confirmWindow && !confirmWindow.isDestroyed()) {
        confirmWindow.destroy();
      }

      confirmWindow = null;
      resolve(confirmed === true);
    };

    const handleDialogCompleted = (_event, response) => {
      if (normalizeText(response && response.requestId) !== normalizedPayload.requestId) {
        return;
      }

      finish(response && response.confirmed === true);
    };

    ipcMain.on(DIALOG_CHANNELS.COMPLETE_CONFIRM_DIALOG, handleDialogCompleted);

    confirmWindow = new BrowserWindow({
      width: 468,
      height: normalizedPayload.detail ? 372 : 332,
      minWidth: 468,
      minHeight: normalizedPayload.detail ? 372 : 332,
      maxWidth: 560,
      maxHeight: 420,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      show: false,
      modal: Boolean(parentWindow),
      parent: parentWindow || undefined,
      frame: false,
      transparent: true,
      hasShadow: false,
      movable: true,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      icon: resolveAppIconPath(),
      title: resolveWindowTitle(normalizedPayload.title),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'confirmDialogPreload.js'),
        contextIsolation: true,
        sandbox: false,
        additionalArguments: [
          `${CONFIRM_DIALOG_PAYLOAD_ARGUMENT_PREFIX}${encodeConfirmDialogPayload(normalizedPayload)}`
        ]
      }
    });

    confirmWindow.once('ready-to-show', () => {
      if (!confirmWindow || confirmWindow.isDestroyed()) {
        return;
      }

      confirmWindow.show();
      confirmWindow.focus();
    });

    confirmWindow.on('closed', () => {
      finish(false);
    });

    confirmWindow.loadFile(path.join(__dirname, '..', 'renderer', 'confirmDialog.html'))
      .catch(() => {
        finish(false);
      });
  });
}

module.exports = {
  showConfirmDialog
};
