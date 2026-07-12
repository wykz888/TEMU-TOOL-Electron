const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const {
  podUploadSheetMiaoshouUniversalFeature
} = require('../features/featureCenter/podUploadSheetMiaoshouUniversal');

const POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_ASSET_VERSION = '20260712-pod-dialog-fix-1';

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
    path.join(__dirname, '..', 'renderer', 'podUploadSheetMiaoshouUniversal.html'),
    {
      query: {
        v: POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_ASSET_VERSION
      }
    }
  );

  return podUploadSheetUniversalWindow;
}

module.exports = {
  createPodUploadSheetMiaoshouUniversalWindow
};
