const { COS_SCOPES, SCOPE_PREFIXES } = require('./config');

function normalizeCosKey(value = '') {
  if (typeof value !== 'string') {
    throw new TypeError('COS key must be a string.');
  }

  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

function getScopePrefix(scope = COS_SCOPES.ROOT) {
  const prefix = SCOPE_PREFIXES[scope];

  if (!prefix) {
    throw new Error(`Unsupported COS scope: ${scope}`);
  }

  return prefix;
}

function buildScopedKey(key = '', scope = COS_SCOPES.ROOT) {
  const prefix = getScopePrefix(scope);
  const normalizedKey = normalizeCosKey(key);

  return normalizedKey ? `${prefix}/${normalizedKey}` : prefix;
}

function stripScopePrefix(key, scope = COS_SCOPES.ROOT) {
  const prefix = getScopePrefix(scope);
  const normalizedKey = normalizeCosKey(key);

  if (normalizedKey === prefix) {
    return '';
  }

  if (normalizedKey.startsWith(`${prefix}/`)) {
    return normalizedKey.slice(prefix.length + 1);
  }

  return normalizedKey;
}

module.exports = {
  normalizeCosKey,
  getScopePrefix,
  buildScopedKey,
  stripScopePrefix
};

