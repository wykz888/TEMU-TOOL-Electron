const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { AUTH_CHANNELS } = require('../src/ipc/authChannels');
const { THEME_CHANNELS } = require('../src/ipc/themeChannels');

function registerValidationHandlers() {
  ipcMain.removeHandler(THEME_CHANNELS.GET_THEME);
  ipcMain.handle(THEME_CHANNELS.GET_THEME, async () => 'light');
  ipcMain.removeHandler(THEME_CHANNELS.GET_THEME_APPEARANCE);
  ipcMain.handle(THEME_CHANNELS.GET_THEME_APPEARANCE, async () => ({
    primaryColor: '#f7b500',
    updatedAt: ''
  }));

  ipcMain.removeHandler(AUTH_CHANNELS.GET_CACHED_LOGIN_ACCOUNT);
  ipcMain.handle(AUTH_CHANNELS.GET_CACHED_LOGIN_ACCOUNT, async () => null);
}

async function main() {
  await app.whenReady();
  registerValidationHandlers();

  const windowInstance = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'appPreload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  try {
    await windowInstance.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'auth.html'));

    const result = await windowInstance.webContents.executeJavaScript(
      `({
        hasBridge: Boolean(window.temuApp),
        hasAuth: Boolean(window.temuApp && window.temuApp.auth),
        methods: Object.keys((window.temuApp && window.temuApp.auth) || {})
      })`,
      true
    );

    console.log(JSON.stringify(result, null, 2));
  } finally {
    windowInstance.destroy();
    app.quit();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
