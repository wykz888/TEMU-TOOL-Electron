const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const { podUploadSheetMiaoshouFeature } = require('../features/featureCenter/podUploadSheetMiaoshou');

const POD_UPLOAD_SHEET_MIAOSHOU_ASSET_VERSION = '20260711-white-bg-2';

function createPodUploadSheetMiaoshouWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = podUploadSheetMiaoshouFeature.title
  } = options;
  const podUploadSheetWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1240,
    minHeight: 760,
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

  podUploadSheetWindow.loadFile(path.join(__dirname, '..', 'renderer', 'podUploadSheetMiaoshou.html'), {
    query: {
      v: POD_UPLOAD_SHEET_MIAOSHOU_ASSET_VERSION
    }
  });

  return podUploadSheetWindow;
}

module.exports = {
  createPodUploadSheetMiaoshouWindow
};
