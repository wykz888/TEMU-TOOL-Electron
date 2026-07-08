const AUTH_CHANNELS = Object.freeze({
  LOGIN: 'auth:login',
  REGISTER: 'auth:register',
  LOGOUT: 'auth:logout',
  GET_SESSION: 'auth:get-session',
  GET_CACHED_LOGIN_ACCOUNT: 'auth:get-cached-login-account'
});

module.exports = {
  AUTH_CHANNELS
};
