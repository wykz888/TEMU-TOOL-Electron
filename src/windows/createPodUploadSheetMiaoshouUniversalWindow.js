const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const {
  podUploadSheetMiaoshouUniversalFeature
} = require('../features/featureCenter/podUploadSheetMiaoshouUniversal');

function createPodUploadSheetMiaoshouUniversalWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = podUploadSheetMiaoshouUniversalFeature.title
  } = options;
  const podUploadSheetUniversalWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1180,
    minHeight: 740,
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

  podUploadSheetUniversalWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'podUploadSheetMiaoshouUniversal.html')
  );

  return podUploadSheetUniversalWindow;
}

module.exports = {
  createPodUploadSheetMiaoshouUniversalWindow
};
