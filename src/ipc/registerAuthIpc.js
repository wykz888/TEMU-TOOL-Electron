const { ipcMain } = require('electron');
const { authService } = require('../services/auth/authService');
const { AUTH_CHANNELS } = require('./authChannels');
const { registerInvokeHandler } = require('./ipcRegistration');

function registerAuthIpc({ sessionStore, loginAccountCache, onLoginSuccess, onLogout }) {
  registerInvokeHandler(ipcMain, AUTH_CHANNELS.GET_SESSION, async () => sessionStore.getSession());
  registerInvokeHandler(
    ipcMain,
    AUTH_CHANNELS.GET_CACHED_LOGIN_ACCOUNT,
    async () => loginAccountCache.getCachedAccount()
  );

  registerInvokeHandler(
    ipcMain,
    AUTH_CHANNELS.REGISTER,
    async (_event, payload) => authService.registerUser(payload)
  );

  registerInvokeHandler(ipcMain, AUTH_CHANNELS.LOGIN, async (_event, payload) => {
    const session = await authService.loginUser(payload);

    sessionStore.setSession(session);
    await loginAccountCache.setCachedAccount({
      username: session.username,
      password: payload.password,
      rememberLogin: payload.rememberLogin === true
    });

    if (typeof onLoginSuccess === 'function') {
      onLoginSuccess(session);
    }

    return session;
  });

  registerInvokeHandler(ipcMain, AUTH_CHANNELS.LOGOUT, async () => {
    sessionStore.clearSession();

    if (typeof onLogout === 'function') {
      onLogout();
    }

    return {
      success: true
    };
  });

  return AUTH_CHANNELS;
}

module.exports = {
  AUTH_CHANNELS,
  registerAuthIpc
};
