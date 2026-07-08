const { contextBridge, ipcRenderer } = require('electron');
const { AUTH_CHANNELS } = require('../ipc/authChannels');
const { DIALOG_CHANNELS } = require('../ipc/dialogChannels');
const { THEME_CHANNELS } = require('../ipc/themeChannels');
const { createInvokeApi } = require('./ipcApiBuilder');

function subscribe(channel, listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  const wrappedListener = (_event, payload) => {
    listener(payload);
  };

  ipcRenderer.on(channel, wrappedListener);

  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
  };
}

contextBridge.exposeInMainWorld('temuApp', {
  auth: createInvokeApi(ipcRenderer, {
    login: AUTH_CHANNELS.LOGIN,
    register: AUTH_CHANNELS.REGISTER,
    logout: AUTH_CHANNELS.LOGOUT,
    getSession: AUTH_CHANNELS.GET_SESSION,
    getCachedLoginAccount: AUTH_CHANNELS.GET_CACHED_LOGIN_ACCOUNT
  }),
  theme: {
    ...createInvokeApi(ipcRenderer, {
      getTheme: THEME_CHANNELS.GET_THEME,
      setTheme: THEME_CHANNELS.SET_THEME,
      getThemeAppearance: THEME_CHANNELS.GET_THEME_APPEARANCE,
      setThemeAppearance: THEME_CHANNELS.SET_THEME_APPEARANCE
    }),
    onThemeChanged(listener) {
      return subscribe(THEME_CHANNELS.CHANGED, listener);
    }
  },
  dialogs: createInvokeApi(ipcRenderer, {
    confirm: DIALOG_CHANNELS.SHOW_CONFIRM_DIALOG
  })
});
