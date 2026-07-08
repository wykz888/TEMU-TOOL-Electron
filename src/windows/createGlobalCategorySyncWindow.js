const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const { globalCategorySyncFeature } = require('../features/featureCenter/globalCategorySync');

function createGlobalCategorySyncWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = globalCategorySyncFeature.title
  } = options;
  const globalCategorySyncWindow = new BrowserWindow({
    width: 1160,
    height: 840,
    minWidth: 920,
    minHeight: 620,
    backgroundColor,
    autoHideMenuBar: true,
    skipTaskbar: false,
    minimizable: true,
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'appPreload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: false
    },
    title: resolveWindowTitle(title)
  });

  globalCategorySyncWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'globalCategorySyncWindow.html')
  );

  return globalCategorySyncWindow;
}

module.exports = {
  createGlobalCategorySyncWindow
};
