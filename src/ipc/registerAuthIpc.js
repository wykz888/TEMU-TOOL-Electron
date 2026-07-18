const { ipcMain } = require('electron');
const { authService } = require('../services/auth/authService');
const { AUTH_CHANNELS } = require('./authChannels');
const { registerInvokeHandler } = require('./ipcRegistration');

function logAuthPersistenceError(runtimeLogger, eventName, error) {
  if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
    runtimeLogger.logError(eventName, error);
  }
}

async function persistLoginCache({ loginAccountCache, authSessionCache, runtimeLogger }, session, payload) {
  const rememberLogin = payload && payload.rememberLogin === true;

  try {
    await loginAccountCache.setCachedAccount({
      username: session.username,
      password: payload.password,
      rememberLogin
    });
  } catch (error) {
    logAuthPersistenceError(runtimeLogger, 'auth_login_account_cache_persist_failed', error);
  }

  if (!authSessionCache || typeof authSessionCache.setCachedSession !== 'function') {
    return;
  }

  try {
    await authSessionCache.setCachedSession(session, {
      rememberLogin
    });
  } catch (error) {
    logAuthPersistenceError(runtimeLogger, 'auth_session_cache_persist_failed', error);
  }
}

async function clearSessionCache({ authSessionCache, runtimeLogger }) {
  if (!authSessionCache || typeof authSessionCache.clearCachedSession !== 'function') {
    return;
  }

  try {
    await authSessionCache.clearCachedSession();
  } catch (error) {
    logAuthPersistenceError(runtimeLogger, 'auth_session_cache_clear_failed', error);
  }
}

function registerAuthIpc({ sessionStore, loginAccountCache, authSessionCache, runtimeLogger, onLoginSuccess, onLogout }) {
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
    await persistLoginCache({ loginAccountCache, authSessionCache, runtimeLogger }, session, payload);

    if (typeof onLoginSuccess === 'function') {
      onLoginSuccess(session);
    }

    return session;
  });

  registerInvokeHandler(ipcMain, AUTH_CHANNELS.LOGOUT, async () => {
    sessionStore.clearSession();
    await clearSessionCache({ authSessionCache, runtimeLogger });

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
