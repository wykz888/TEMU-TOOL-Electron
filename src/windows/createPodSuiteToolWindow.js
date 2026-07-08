const path = require('node:path');
const { BrowserWindow } = require('electron');
const { podSuiteToolFeature } = require('../features/creationCenter/podSuiteTool');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');

function createPodSuiteToolWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = podSuiteToolFeature.title
  } = options;
  const podSuiteToolWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 960,
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

  podSuiteToolWindow.loadFile(path.join(__dirname, '..', 'renderer', 'psdSmartSuite.html'));

  return podSuiteToolWindow;
}

module.exports = {
  createPodSuiteToolWindow
};
