const path = require('node:path');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const { jimengImageFeature } = require('../features/creationCenter/jimengImage');

function createJimengImageWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = jimengImageFeature.title
  } = options;
  const jimengImageWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1180,
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

  jimengImageWindow.loadFile(path.join(__dirname, '..', 'renderer', 'jimengImage.html'));

  return jimengImageWindow;
}

module.exports = {
  createJimengImageWindow
};
