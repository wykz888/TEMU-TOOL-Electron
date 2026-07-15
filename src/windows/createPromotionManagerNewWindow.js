const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const {
  promotionMasterNewFeature
} = require('../features/featureCenter/promotionMasterNew');

function createPromotionManagerNewWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = promotionMasterNewFeature.title
  } = options;
  const promotionManagerNewWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 640,
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

  promotionManagerNewWindow.loadFile(path.join(__dirname, '..', 'renderer', 'promotionManagerNew.html'));

  return promotionManagerNewWindow;
}

module.exports = {
  createPromotionManagerNewWindow
};
