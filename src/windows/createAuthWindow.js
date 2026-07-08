const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');

function createAuthWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = '\u767b\u5f55\u4e0e\u6ce8\u518c'
  } = options;
  const authWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 420,
    minHeight: 680,
    resizable: false,
    backgroundColor,
    autoHideMenuBar: true,
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'appPreload.js'),
      contextIsolation: true,
      sandbox: false
    },
    title: resolveWindowTitle(title)
  });

  authWindow.loadFile(path.join(__dirname, '..', 'renderer', 'auth.html'));

  return authWindow;
}

module.exports = {
  createAuthWindow
};
