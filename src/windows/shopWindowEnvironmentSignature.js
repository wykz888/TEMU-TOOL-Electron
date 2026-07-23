const { normalizeText } = require('../services/shopManagement/common');

function normalizeComparableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparableValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      const normalizedValue = normalizeComparableValue(value[key]);

      if (normalizedValue !== undefined) {
        result[key] = normalizedValue;
      }

      return result;
    }, {});
  }

  if (value === undefined || typeof value === 'function') {
    return undefined;
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  return normalizeText(value);
}

function stringifyComparableValue(value) {
  try {
    return JSON.stringify(normalizeComparableValue(value));
  } catch (_error) {
    return '';
  }
}

function buildProxyComparableConfig(source) {
  const proxyConfig = source && source.proxyConfig ? source.proxyConfig : {};

  return {
    type: normalizeText(proxyConfig.type).toLowerCase(),
    host: normalizeText(proxyConfig.host),
    port: normalizeText(proxyConfig.port),
    username: normalizeText(proxyConfig.username),
    bypassRules: normalizeText(proxyConfig.bypassRules),
    directResourceTypes: normalizeComparableValue(proxyConfig.directResourceTypes || {})
  };
}

function buildFingerprintComparableConfig(source) {
  const fingerprintConfig = source && source.fingerprintConfig ? source.fingerprintConfig : {};
  const screen = fingerprintConfig.screen && typeof fingerprintConfig.screen === 'object'
    ? fingerprintConfig.screen
    : {};

  return {
    mode: normalizeText(fingerprintConfig.mode),
    fingerprintSeed: normalizeText(fingerprintConfig.fingerprintSeed),
    profileKey: normalizeText(fingerprintConfig.profileKey),
    userAgent: normalizeText(fingerprintConfig.userAgent),
    platform: normalizeText(fingerprintConfig.platform),
    language: normalizeText(fingerprintConfig.language),
    languages: Array.isArray(fingerprintConfig.languages)
      ? fingerprintConfig.languages.map((item) => normalizeText(item))
      : [],
    timezone: normalizeText(fingerprintConfig.timezone),
    screen: {
      width: Number(screen.width) || 0,
      height: Number(screen.height) || 0,
      availWidth: Number(screen.availWidth) || 0,
      availHeight: Number(screen.availHeight) || 0,
      colorDepth: Number(screen.colorDepth) || 0,
      pixelDepth: Number(screen.pixelDepth) || 0
    },
    hardwareConcurrency: Number(fingerprintConfig.hardwareConcurrency) || 0,
    deviceMemory: Number(fingerprintConfig.deviceMemory) || 0,
    devicePixelRatio: Number(fingerprintConfig.devicePixelRatio) || 0,
    vendor: normalizeText(fingerprintConfig.vendor),
    productSub: normalizeText(fingerprintConfig.productSub),
    doNotTrack: normalizeText(fingerprintConfig.doNotTrack),
    maxTouchPoints: Number(fingerprintConfig.maxTouchPoints) || 0,
    webglVendor: normalizeText(fingerprintConfig.webglVendor),
    webglRenderer: normalizeText(fingerprintConfig.webglRenderer)
  };
}

function buildRuntimeEnvironmentComparableKey(source) {
  return stringifyComparableValue({
    proxyConfig: buildProxyComparableConfig(source),
    fingerprintConfig: buildFingerprintComparableConfig(source)
  });
}

function resolveWorkspaceEnvironmentKey(payload) {
  return (
    normalizeText(payload && payload.workspaceEnvironmentKey)
    || buildRuntimeEnvironmentComparableKey(payload || {})
  );
}

function hasRuntimeEnvironmentPayload(payload) {
  return Boolean(
    payload
    && (
      Object.prototype.hasOwnProperty.call(payload, 'proxyConfig')
      || Object.prototype.hasOwnProperty.call(payload, 'fingerprintConfig')
    )
  );
}

function isRuntimeEnvironmentPayloadChanged(shopEntry, payload) {
  if (
    !hasRuntimeEnvironmentPayload(payload)
    || !shopEntry
    || !shopEntry.runtimeProfile
  ) {
    return false;
  }

  const currentKey = buildRuntimeEnvironmentComparableKey(shopEntry.runtimeProfile);
  const nextKey = buildRuntimeEnvironmentComparableKey(payload);

  return Boolean(currentKey && nextKey && currentKey !== nextKey);
}

module.exports = {
  buildRuntimeEnvironmentComparableKey,
  hasRuntimeEnvironmentPayload,
  isRuntimeEnvironmentPayloadChanged,
  resolveWorkspaceEnvironmentKey
};
