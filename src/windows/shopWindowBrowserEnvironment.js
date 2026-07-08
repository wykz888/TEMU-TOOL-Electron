const path = require('node:path');
const { app, session } = require('electron');
const {
  PROXY_TYPES,
  normalizeProxyType,
  normalizeText,
  resolveAccountIdentity
} = require('../services/shopManagement/common');
const {
  DEFAULT_PROXY_BYPASS_RULES,
  mergeProxyBypassRules,
  normalizeProxyBypassRules,
  normalizeProxyDirectResourceTypes,
  hasEnabledProxyDirectResourceTypes
} = require('../services/shopManagement/proxyRouting');
const {
  FINGERPRINT_MODES,
  normalizeFingerprintConfig
} = require('../services/shopManagement/fingerprintProfile');
const { DEFAULT_TEMU_USER_AGENT } = require('../services/shopManagement/defaultUserAgent');
const { getRuntimeFingerprintContext } = require('../services/shopManagement/runtimeFingerprintContext');
const {
  buildAcceptLanguageHeader,
  buildUserAgentHeaders
} = require('./fingerprintRuntimeUtils');
const { ensureSocks5ProxyBridge } = require('./shopWindowProxyBridge');

const FINGERPRINT_ARGUMENT_PREFIX = '--temu-shop-fingerprint=';
const AUTH_ARGUMENT_PREFIX = '--temu-shop-auth=';
const FINGERPRINT_PRELOAD_PATH = path.join(__dirname, 'shopFingerprintPreload.js');
const SHOP_VIP_INFO_OVERRIDE_PRELOAD_PATH = path.join(__dirname, 'shopVipInfoOverridePreload.js');
const configuredSessions = new WeakSet();
const partitionRuntimeState = new Map();
const DIRECT_FETCH_PARTITION = 'temu-shop-direct-fetch-shared';
let directFetchSessionPromise = null;
const DIRECT_RESOURCE_EXTENSION_MAP = Object.freeze({
  '.js': 'script',
  '.mjs': 'script',
  '.cjs': 'script',
  '.css': 'style',
  '.woff': 'font',
  '.woff2': 'font',
  '.ttf': 'font',
  '.otf': 'font',
  '.eot': 'font',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.avif': 'image',
  '.ico': 'image',
  '.bmp': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.m4v': 'video',
  '.m3u8': 'video',
  '.ts': 'video',
  '.ogv': 'video'
});

function normalizeProxyConfig(proxyConfig) {
  const type = normalizeProxyType(proxyConfig && proxyConfig.type);

  return {
    type,
    host: normalizeText(proxyConfig && proxyConfig.host),
    port: normalizeText(proxyConfig && proxyConfig.port),
    username: normalizeText(proxyConfig && proxyConfig.username),
    password: normalizeText(proxyConfig && proxyConfig.password),
    bypassRules: normalizeProxyBypassRules(proxyConfig && proxyConfig.bypassRules),
    directResourceTypes: normalizeProxyDirectResourceTypes(
      proxyConfig && proxyConfig.directResourceTypes
    )
  };
}

async function resolveProxyRules(proxyConfig) {
  if (proxyConfig.type === PROXY_TYPES.local || !proxyConfig.host || !proxyConfig.port) {
    return '';
  }

  if (proxyConfig.type === PROXY_TYPES.socks5) {
    if (proxyConfig.username || proxyConfig.password) {
      return ensureSocks5ProxyBridge(proxyConfig);
    }

    return `socks5://${proxyConfig.host}:${proxyConfig.port}`;
  }

  const scheme = proxyConfig.type === PROXY_TYPES.https ? 'https' : 'http';
  return `${scheme}://${proxyConfig.host}:${proxyConfig.port}`;
}

function buildProxyBypassRulesText(proxyConfig) {
  return mergeProxyBypassRules(DEFAULT_PROXY_BYPASS_RULES, proxyConfig && proxyConfig.bypassRules)
    .join(';');
}

async function getDirectFetchSession() {
  if (!directFetchSessionPromise) {
    const helperSession = session.fromPartition(DIRECT_FETCH_PARTITION);
    directFetchSessionPromise = helperSession.setProxy({ mode: 'direct' })
      .then(async () => {
        if (typeof helperSession.closeAllConnections === 'function') {
          await helperSession.closeAllConnections().catch(() => {});
        }

        return helperSession;
      })
      .catch((error) => {
        directFetchSessionPromise = null;
        throw error;
      });
  }

  return directFetchSessionPromise;
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }

  return String(value || '');
}

function getRequestHeaderValue(headers, headerName) {
  const normalizedHeaderName = normalizeText(headerName).toLowerCase();

  return Object.entries(headers || {}).reduce((foundValue, [key, value]) => {
    if (foundValue) {
      return foundValue;
    }

    return normalizeText(key).toLowerCase() === normalizedHeaderName
      ? normalizeHeaderValue(value)
      : '';
  }, '');
}

function sanitizeRequestHeaders(headers, { stripCookies = false } = {}) {
  const nextHeaders = {};

  Object.entries(headers || {}).forEach(([headerName, headerValue]) => {
    const normalizedHeaderName = normalizeText(headerName).toLowerCase();

    if (
      normalizedHeaderName === 'host'
      || normalizedHeaderName === 'content-length'
      || (stripCookies && (normalizedHeaderName === 'cookie' || normalizedHeaderName === 'cookie2'))
    ) {
      return;
    }

    nextHeaders[headerName] = normalizeHeaderValue(headerValue);
  });

  return nextHeaders;
}

function getRequestMethod(request) {
  return normalizeText(request && request.method).toUpperCase();
}

function getRequestDestination(request) {
  return normalizeText(
    (request && request.destination)
    || getRequestHeaderValue(request && request.headers, 'sec-fetch-dest')
  ).toLowerCase();
}

function resolveRequestDirectResourceType(request) {
  const requestDestination = getRequestDestination(request);

  if (requestDestination === 'script') {
    return 'script';
  }

  if (requestDestination === 'style' || requestDestination === 'stylesheet') {
    return 'style';
  }

  if (requestDestination === 'font') {
    return 'font';
  }

  if (requestDestination === 'image') {
    return 'image';
  }

  if (requestDestination === 'video' || requestDestination === 'media') {
    return 'video';
  }

  if (requestDestination) {
    return '';
  }

  try {
    const requestPathname = new URL(normalizeText(request && request.url)).pathname.toLowerCase();
    const extensionIndex = requestPathname.lastIndexOf('.');

    if (extensionIndex === -1) {
      return '';
    }

    return DIRECT_RESOURCE_EXTENSION_MAP[requestPathname.slice(extensionIndex)] || '';
  } catch (_error) {
    return '';
  }
}

function shouldRouteRequestViaLocalFetch(request, partitionState) {
  if (!partitionState || partitionState.directResourceRoutingEnabled !== true) {
    return false;
  }

  const requestMethod = getRequestMethod(request);

  if (requestMethod !== 'GET' && requestMethod !== 'HEAD') {
    return false;
  }

  const directResourceType = resolveRequestDirectResourceType(request);

  return Boolean(
    directResourceType
    && partitionState.proxyConfig
    && partitionState.proxyConfig.directResourceTypes
    && partitionState.proxyConfig.directResourceTypes[directResourceType] === true
  );
}

async function forwardRequestViaLocalFetch(partition, request) {
  const directFetchSession = await getDirectFetchSession();

  return directFetchSession.fetch(normalizeText(request && request.url), {
    method: getRequestMethod(request) || 'GET',
    headers: sanitizeRequestHeaders(request && request.headers, {
      stripCookies: true
    }),
    bypassCustomProtocolHandlers: true
  });
}

async function handleProtocolRequest(targetSession, partition, request) {
  const partitionState = getPartitionState(partition);

  if (shouldRouteRequestViaLocalFetch(request, partitionState)) {
    try {
      return await forwardRequestViaLocalFetch(partition, request);
    } catch (error) {
      console.warn('Failed to fetch resource through local-bypass session, fallback to default session flow:', error);
    }
  }

  return targetSession.fetch(request, {
    bypassCustomProtocolHandlers: true
  });
}

function serializeFingerprintConfig(fingerprintConfig) {
  return Buffer.from(JSON.stringify(fingerprintConfig), 'utf8').toString('base64');
}

function serializeAuthConfig(authConfig) {
  return Buffer.from(JSON.stringify(authConfig), 'utf8').toString('base64');
}

function isFingerprintEnabled(fingerprintConfig) {
  return Boolean(
    fingerprintConfig
    && fingerprintConfig.mode !== FINGERPRINT_MODES.off
  );
}

function normalizeAuthConfig(authConfig) {
  const accountIdentity = resolveAccountIdentity({
    phoneNumber: authConfig && authConfig.phoneNumber,
    email: authConfig && authConfig.email,
    accountValue: authConfig && authConfig.accountValue
  });

  return {
    phoneNumber: accountIdentity.phoneNumber,
    email: accountIdentity.email,
    accountValue: accountIdentity.accountValue,
    accountType: accountIdentity.accountType,
    loginPassword: normalizeText(authConfig && authConfig.loginPassword)
  };
}

function hasAuthAutofill(authConfig) {
  return Boolean(
    authConfig
    && (authConfig.phoneNumber || authConfig.email || authConfig.accountValue)
    && authConfig.loginPassword
  );
}

function getDefaultUserAgent() {
  return DEFAULT_TEMU_USER_AGENT;
}

function getPartitionState(partition) {
  const normalizedPartition = normalizeText(partition);

  if (!partitionRuntimeState.has(normalizedPartition)) {
    partitionRuntimeState.set(normalizedPartition, {
      headers: null,
      headerEntries: [],
      permissions: null,
      proxyConfig: normalizeProxyConfig(null),
      directResourceRoutingEnabled: false,
      protocolInterceptionEnabled: false
    });
  }

  return partitionRuntimeState.get(normalizedPartition);
}

function resolvePermissionState(permissionProfile, permission, details) {
  const normalizedPermission = normalizeText(permission).toLowerCase();
  const mediaTypes = Array.isArray(details && details.mediaTypes)
    ? details.mediaTypes.map((item) => normalizeText(item).toLowerCase())
    : [];

  if (normalizedPermission === 'geolocation') {
    return normalizeText(permissionProfile && permissionProfile.geolocation) || 'denied';
  }

  if (normalizedPermission === 'notifications') {
    return normalizeText(permissionProfile && permissionProfile.notifications) || 'denied';
  }

  if (normalizedPermission === 'media' || normalizedPermission === 'display-capture') {
    const wantsVideo =
      mediaTypes.includes('video')
      || mediaTypes.includes('display')
      || normalizedPermission === 'display-capture';
    const wantsAudio = mediaTypes.includes('audio');

    if (wantsVideo) {
      return normalizeText(permissionProfile && permissionProfile.camera) || 'denied';
    }

    if (wantsAudio) {
      return normalizeText(permissionProfile && permissionProfile.microphone) || 'denied';
    }

    return 'denied';
  }

  if (normalizedPermission === 'midi' || normalizedPermission === 'midisysex') {
    return normalizeText(permissionProfile && permissionProfile.midi) || 'denied';
  }

  if (normalizedPermission === 'clipboard-read') {
    return normalizeText(permissionProfile && permissionProfile.clipboardRead) || 'prompt';
  }

  if (
    normalizedPermission === 'clipboard-write'
    || normalizedPermission === 'clipboard-sanitized-write'
  ) {
    return normalizeText(permissionProfile && permissionProfile.clipboardWrite) || 'granted';
  }

  if (normalizedPermission === 'fullscreen' || normalizedPermission === 'pointerlock') {
    return 'granted';
  }

  return 'denied';
}

async function syncProtocolInterception(targetSession, partition, enabled) {
  const partitionState = getPartitionState(partition);
  const nextEnabled = enabled === true;

  if (
    !targetSession.protocol
    || typeof targetSession.protocol.handle !== 'function'
    || typeof targetSession.protocol.unhandle !== 'function'
  ) {
    partitionState.protocolInterceptionEnabled = false;
    return;
  }

  if (partitionState.protocolInterceptionEnabled === nextEnabled) {
    return;
  }

  if (nextEnabled) {
    targetSession.protocol.handle('http', (request) => handleProtocolRequest(targetSession, partition, request));
    targetSession.protocol.handle('https', (request) => handleProtocolRequest(targetSession, partition, request));
    partitionState.protocolInterceptionEnabled = true;
    return;
  }

  targetSession.protocol.unhandle('http');
  targetSession.protocol.unhandle('https');
  partitionState.protocolInterceptionEnabled = false;
}

function configureSessionRuntime(targetSession, partition) {
  if (configuredSessions.has(targetSession)) {
    return;
  }

  configuredSessions.add(targetSession);
  targetSession.registerPreloadScript({
    type: 'frame',
    filePath: SHOP_VIP_INFO_OVERRIDE_PRELOAD_PATH
  });
  targetSession.registerPreloadScript({
    type: 'service-worker',
    filePath: SHOP_VIP_INFO_OVERRIDE_PRELOAD_PATH
  });

  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = details && details.requestHeaders ? details.requestHeaders : {};
    const partitionState = getPartitionState(partition);
    const headerEntries = partitionState && Array.isArray(partitionState.headerEntries)
      ? partitionState.headerEntries
      : [];

    if (
      headerEntries.length === 0
      || !/^https?:\/\//i.test(String(details && details.url || ''))
    ) {
      callback({
        requestHeaders
      });
      return;
    }

    const nextHeaders = {
      ...requestHeaders
    };

    headerEntries.forEach(([headerName, headerValue]) => {
      nextHeaders[headerName] = headerValue;
    });

    callback({
      requestHeaders: nextHeaders
    });
  });

  targetSession.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, details) => {
    const partitionState = getPartitionState(partition);
    return resolvePermissionState(partitionState && partitionState.permissions, permission, details) === 'granted';
  });

  targetSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const partitionState = getPartitionState(partition);
    const permissionState = resolvePermissionState(
      partitionState && partitionState.permissions,
      permission,
      details
    );
    callback(permissionState === 'granted');
  });
}

async function buildShopBrowserEnvironment(payload) {
  const runtimeFingerprintContext = await getRuntimeFingerprintContext(app).catch(() => ({}));

  return {
    proxyConfig: normalizeProxyConfig(payload && payload.proxyConfig),
    fingerprintConfig: normalizeFingerprintConfig(payload && payload.fingerprintConfig, {
      shopId: payload && payload.shopId,
      phoneNumber: payload && payload.phoneNumber,
      shopName: payload && payload.shopName
    }, {
      ...runtimeFingerprintContext,
      proxyConfig: normalizeProxyConfig(payload && payload.proxyConfig)
    }),
    authConfig: normalizeAuthConfig(
      payload && payload.authConfig
        ? payload.authConfig
        : {
          phoneNumber: payload && payload.phoneNumber,
          email: payload && payload.email,
          loginPassword: payload && payload.loginPassword
        }
    )
  };
}

function buildEnvironmentSignature(environment) {
  return JSON.stringify(environment);
}

function buildViewWebPreferences(partition, fingerprintConfig, authConfig) {
  const fingerprintEnabled = isFingerprintEnabled(fingerprintConfig);
  const authAutofillEnabled = hasAuthAutofill(authConfig);
  const webPreferences = {
    partition,
    backgroundThrottling: false,
    contextIsolation: true,
    sandbox: false,
    nodeIntegration: false
  };
  const additionalArguments = [];

  if (fingerprintEnabled) {
    webPreferences.preload = FINGERPRINT_PRELOAD_PATH;
  }

  if (fingerprintEnabled) {
    additionalArguments.push(
      `${FINGERPRINT_ARGUMENT_PREFIX}${serializeFingerprintConfig(fingerprintConfig)}`
    );
  }

  if (fingerprintEnabled && authAutofillEnabled) {
    additionalArguments.push(
      `${AUTH_ARGUMENT_PREFIX}${serializeAuthConfig(authConfig)}`
    );
  }

  if (additionalArguments.length === 0) {
    return webPreferences;
  }

  return {
    ...webPreferences,
    additionalArguments
  };
}

async function applyPartitionEnvironment(partition, environment) {
  const targetSession = session.fromPartition(partition);
  const proxyRules = await resolveProxyRules(environment.proxyConfig);
  const fingerprintEnabled = isFingerprintEnabled(environment.fingerprintConfig);
  const partitionState = getPartitionState(partition);

  configureSessionRuntime(targetSession, partition);
  partitionState.permissions = fingerprintEnabled
    ? { ...((environment && environment.fingerprintConfig && environment.fingerprintConfig.permissions) || {}) }
    : null;
  partitionState.proxyConfig = normalizeProxyConfig(environment && environment.proxyConfig);
  partitionState.directResourceRoutingEnabled = hasEnabledProxyDirectResourceTypes(
    partitionState.proxyConfig && partitionState.proxyConfig.directResourceTypes
  );

  if (fingerprintEnabled) {
    const acceptLanguages = buildAcceptLanguageHeader(
      environment.fingerprintConfig.languages,
      environment.fingerprintConfig.language
    );

    targetSession.setUserAgent(environment.fingerprintConfig.userAgent, acceptLanguages);
    partitionState.headers = buildUserAgentHeaders(environment.fingerprintConfig);
    partitionState.headerEntries = Object.entries(partitionState.headers)
      .filter(([, value]) => Boolean(value));
  } else {
    targetSession.setUserAgent(getDefaultUserAgent());
    partitionState.headers = null;
    partitionState.headerEntries = [];
  }

  await syncProtocolInterception(
    targetSession,
    partition,
    partitionState.directResourceRoutingEnabled === true
  );

  if (!proxyRules) {
    await targetSession.setProxy({
      mode: 'direct'
    });
    if (typeof targetSession.closeAllConnections === 'function') {
      await targetSession.closeAllConnections().catch(() => {});
    }
    return;
  }

  await targetSession.setProxy({
    proxyRules,
    proxyBypassRules: buildProxyBypassRulesText(environment && environment.proxyConfig)
  });
  if (typeof targetSession.closeAllConnections === 'function') {
    await targetSession.closeAllConnections().catch(() => {});
  }
}

function attachProxyAuthHandler(view, proxyConfig) {
  view.webContents.on('login', (event, _request, authInfo, callback) => {
    if (!authInfo || authInfo.isProxy !== true) {
      return;
    }

    if (!proxyConfig.username && !proxyConfig.password) {
      return;
    }

    event.preventDefault();
    callback(proxyConfig.username, proxyConfig.password);
  });
}

function applyViewEnvironment(view, environment) {
  if (isFingerprintEnabled(environment.fingerprintConfig)) {
    view.webContents.setUserAgent(environment.fingerprintConfig.userAgent);
  } else {
    view.webContents.setUserAgent(getDefaultUserAgent());
  }

  attachProxyAuthHandler(view, environment.proxyConfig);
}

module.exports = {
  buildShopBrowserEnvironment,
  buildEnvironmentSignature,
  buildViewWebPreferences,
  applyPartitionEnvironment,
  applyViewEnvironment
};
