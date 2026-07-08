const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');
const { marketingToolsFeature } = require('../features/featureCenter/marketingTools');

function createMarketingToolsWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = marketingToolsFeature.title
  } = options;
  const marketingToolsWindow = new BrowserWindow({
    width: 1520,
    height: 920,
    minWidth: 1120,
    minHeight: 680,
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

  const targetUrl = pathToFileURL(
    path.join(__dirname, '..', 'renderer', 'marketingTools.html')
  );

  targetUrl.searchParams.set('mode', 'marketing-tools');
  targetUrl.hash = 'marketing-tools';
  marketingToolsWindow.loadURL(targetUrl.toString());

  return marketingToolsWindow;
}

module.exports = {
  createMarketingToolsWindow
};
