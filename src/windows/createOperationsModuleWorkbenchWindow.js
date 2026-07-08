const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow } = require('electron');
const { resolveAppIconPath } = require('./resolveAppIconPath');
const { resolveWindowTitle } = require('./resolveWindowTitle');

function createOperationsModuleWorkbenchWindow(options = {}) {
  const {
    backgroundColor = '#ffffff',
    title = '',
    mode = '',
    moduleId = '',
    rendererFileName = '',
    width = 1600,
    height = 940,
    minWidth = 1120,
    minHeight = 700
  } = options;
  const normalizedRendererFileName = String(rendererFileName || '').trim();

  if (!normalizedRendererFileName) {
    throw new Error('rendererFileName is required.');
  }

  const operationsModuleWorkbenchWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
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
    path.join(__dirname, '..', 'renderer', normalizedRendererFileName)
  );

  targetUrl.searchParams.set('mode', String(mode || '').trim());
  targetUrl.hash = String(moduleId || '').trim();
  operationsModuleWorkbenchWindow.loadURL(targetUrl.toString());

  return operationsModuleWorkbenchWindow;
}

module.exports = {
  createOperationsModuleWorkbenchWindow
};
