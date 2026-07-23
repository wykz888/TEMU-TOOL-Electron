const {
  normalizeProxyType,
  normalizeText
} = require('./common');
const {
  normalizeProxyBypassRules,
  normalizeProxyDirectResourceTypes
} = require('./proxyRouting');

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOwn(source, key) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
}

function readProxyField(source, fallback, key) {
  if (hasOwn(source, key)) {
    return source[key];
  }

  return fallback && fallback[key];
}

function resolveShopDetailProxyConfig(sourceProxyConfig, fallbackProxyConfig) {
  const source = isPlainObject(sourceProxyConfig) ? sourceProxyConfig : {};
  const fallback = isPlainObject(fallbackProxyConfig) ? fallbackProxyConfig : {};

  return {
    type: normalizeProxyType(readProxyField(source, fallback, 'type')),
    host: normalizeText(readProxyField(source, fallback, 'host')),
    port: normalizeText(readProxyField(source, fallback, 'port')),
    username: normalizeText(readProxyField(source, fallback, 'username')),
    password: normalizeText(readProxyField(source, fallback, 'password')),
    bypassRules: normalizeProxyBypassRules(
      readProxyField(source, fallback, 'bypassRules')
    ),
    directResourceTypes: normalizeProxyDirectResourceTypes(
      readProxyField(source, fallback, 'directResourceTypes')
    )
  };
}

function buildFingerprintProxyContext(proxyConfig) {
  return {
    type: normalizeProxyType(proxyConfig && proxyConfig.type),
    host: normalizeText(proxyConfig && proxyConfig.host),
    username: normalizeText(proxyConfig && proxyConfig.username)
  };
}

module.exports = {
  buildFingerprintProxyContext,
  resolveShopDetailProxyConfig
};
