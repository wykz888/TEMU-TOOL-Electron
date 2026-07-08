const { cosConfig, COS_SCOPES, SCOPE_PREFIXES } = require('./config');
const { cosService } = require('./cosService');
const { loginUserCosStore } = require('./loginUserStore');
const { normalizeCosKey, getScopePrefix, buildScopedKey, stripScopePrefix } = require('./keyBuilder');

module.exports = {
  cosConfig,
  COS_SCOPES,
  SCOPE_PREFIXES,
  cosService,
  loginUserCosStore,
  normalizeCosKey,
  getScopePrefix,
  buildScopedKey,
  stripScopePrefix
};

