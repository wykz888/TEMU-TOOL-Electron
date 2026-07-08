const path = require('node:path');
const { BrowserWindow } = require('electron');
const { getAdaptiveMainWindowBounds } = require('./getAdaptiveMainWindowBounds');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');

function createMainWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = 'TEMU \u5de5\u5177\u7bb1'
  } = options;
  const { width, height } = getAdaptiveMainWindowBounds();

  const mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 700,
    minHeight: 560,
    backgroundColor,
    autoHideMenuBar: true,
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'appPreload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: false
    },
    title: resolveWindowTitle(title)
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  return mainWindow;
}

module.exports = {
  createMainWindow
};
