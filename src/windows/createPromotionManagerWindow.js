const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const { promotionMasterFeature } = require('../features/featureCenter/promotionMaster');

function createPromotionManagerWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = promotionMasterFeature.title
  } = options;
  const promotionManagerWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 560,
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

  promotionManagerWindow.loadFile(path.join(__dirname, '..', 'renderer', 'promotionManager.html'));

  return promotionManagerWindow;
}

module.exports = {
  createPromotionManagerWindow
};
