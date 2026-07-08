const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');

const EXIT_PROGRESS_PAYLOAD_ARGUMENT_PREFIX = '--temu-exit-progress-payload=';

function encodeExitProgressPayload(payload) {
  return Buffer.from(JSON.stringify(payload || {}), 'utf8').toString('base64');
}

async function createExitSyncProgressWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    theme = 'light',
    title = '\u9000\u51fa\u4fdd\u5b58'
  } = options;

  const exitProgressWindow = new BrowserWindow({
    width: 560,
    height: 300,
    minWidth: 560,
    minHeight: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    frame: false,
    transparent: false,
    hasShadow: true,
    backgroundColor,
    icon: resolveAppIconPath(),
    title: resolveWindowTitle(title),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'exitProgressPreload.js'),
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [
        `${EXIT_PROGRESS_PAYLOAD_ARGUMENT_PREFIX}${encodeExitProgressPayload({ theme })}`
      ]
    }
  });

  await exitProgressWindow.loadFile(path.join(__dirname, '..', 'renderer', 'exitProgress.html'));

  return exitProgressWindow;
}

module.exports = {
  createExitSyncProgressWindow
};
