const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { net } = require('electron');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  normalizeText
} = require('../shopManagement/common');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');

const FEATURE_ID = 'promotion-master';
const ADS_COOKIE_URL = 'https://ads.temu.com';
const ADS_HOME_URL = 'https://ads.temu.com/';
const ADS_LIST_PAGE_URL = 'https://ads.temu.com/ad-list.html';
const ADS_DEPLOYMENT_SWITCH_URL = 'https://ads.temu.com/api/v1/coconut/account/deployment_switch';
const ADS_REPORTS_QUERY_URL = 'https://ads.temu.com/api/v1/coconut/reports/queryReports';
const ADS_DETAIL_URL = 'https://ads.temu.com/api/v1/coconut/ad/ads_detail';
const LOGIN_WAIT_TIMEOUT_MS = 120000;
const LOGIN_WAIT_STEP_MS = 1500;
const COOKIE_CACHE_VERSION = 2;
const COOKIE_CACHE_DIRECTORY = 'region-cookies';

const PROMOTION_MASTER_REGION_ENTRIES = Object.freeze([
  { id: 'us', label: '美区', source: 1 },
  { id: 'global', label: '全球', source: 2 },
  { id: 'eu', label: '欧区', source: 3 }
]);

const PROMOTION_MASTER_REGION_IDS_IN_SWITCH_ORDER = Object.freeze([
  'global',
  'eu',
  'us'
]);

function getPromotionMasterRegionEntriesInSwitchOrder() {
  return PROMOTION_MASTER_REGION_IDS_IN_SWITCH_ORDER
    .map((regionId) => PROMOTION_MASTER_REGION_ENTRIES.find((region) => region.id === regionId))
    .filter(Boolean);
}

function resolvePromotionMasterRegionEntries(regionIds) {
  const regionEntries = getPromotionMasterRegionEntriesInSwitchOrder();

  if (!Array.isArray(regionIds)) {
    return regionEntries;
  }

  const selectedRegionIds = new Set(
    regionIds
      .map((regionId) => normalizeText(regionId))
      .filter((regionId) => PROMOTION_MASTER_REGION_ENTRIES.some((region) => region.id === regionId))
  );

  return regionEntries.filter((region) => selectedRegionIds.has(region.id));
}

function isContainerValue(value) {
  return Boolean(value && typeof value === 'object');
}

function buildCombinedSummaryContainer(sources) {
  const sourceEntries = Array.isArray(sources) ? sources : [];
  const combined = {};

  sourceEntries.forEach((entry) => {
    if (!entry || !isContainerValue(entry.value)) {
      return;
    }

    combined[entry.key] = entry.value;
  });

  return combined;
}

function getNestedValue(source, pathSegments) {
  return (Array.isArray(pathSegments) ? pathSegments : []).reduce((result, segment) => {
    if (!isContainerValue(result) || !Object.prototype.hasOwnProperty.call(result, segment)) {
      return null;
    }

    return result[segment];
  }, source);
}

function extractAssignedExpression(scriptContent, assignmentTarget) {
  const content = typeof scriptContent === 'string' ? scriptContent : '';
  const target = normalizeText(assignmentTarget);

  if (!content || !target) {
    return '';
  }

  const assignmentPattern = new RegExp(`${target.replace(/\./g, '\\.')}\\s*=\\s*`, 'm');
  const match = assignmentPattern.exec(content);

  if (!match) {
    return '';
  }

  let index = match.index + match[0].length;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let stringQuote = '';
  let isEscaped = false;

  for (let cursor = index; cursor < content.length; cursor += 1) {
    const character = content[cursor];
    const nextCharacter = content[cursor + 1] || '';

    if (stringQuote) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === '\\') {
        isEscaped = true;
        continue;
      }

      if (character === stringQuote) {
        stringQuote = '';
      }

      continue;
    }

    if (character === '"' || character === '\'' || character === '`') {
      stringQuote = character;
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      const lineBreakIndex = content.indexOf('\n', cursor + 2);

      if (lineBreakIndex < 0) {
        return content.slice(index, cursor).trim();
      }

      cursor = lineBreakIndex;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      const commentEndIndex = content.indexOf('*/', cursor + 2);

      if (commentEndIndex < 0) {
        return content.slice(index, cursor).trim();
      }

      cursor = commentEndIndex + 1;
      continue;
    }

    if (character === '{') {
      braceDepth += 1;
      continue;
    }

    if (character === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (character === '[') {
      bracketDepth += 1;
      continue;
    }

    if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === '(') {
      parenDepth += 1;
      continue;
    }

    if (character === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (character === ';' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      return content.slice(index, cursor).trim();
    }
  }

  return content.slice(index).trim();
}

function evaluateRawDataExpression(expression) {
  const source = normalizeText(expression).replace(/;+\s*$/, '');

  if (!source) {
    return null;
  }

  const sandbox = {
    JSON,
    window: {}
  };

  sandbox.self = sandbox.window;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(`window.rawData = (${source});`, sandbox, {
    timeout: 300
  });

  return isContainerValue(sandbox.window.rawData) ? sandbox.window.rawData : null;
}

function extractRawDataFromHtml(htmlText) {
  const html = typeof htmlText === 'string' ? htmlText : '';

  if (!html) {
    return null;
  }

  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch = null;

  while ((scriptMatch = scriptPattern.exec(html))) {
    const scriptContent = scriptMatch[1];

    if (!/window\.rawData\b/.test(scriptContent)) {
      continue;
    }

    const expression = extractAssignedExpression(scriptContent, 'window.rawData');

    if (!expression) {
      continue;
    }

    try {
      const rawData = evaluateRawDataExpression(expression);

      if (rawData) {
        return rawData;
      }
    } catch (_error) {
      // Ignore parse failures and continue probing the next candidate script block.
    }
  }

  return null;
}

function createPromotionMasterSessionService({
  sessionStore,
  shopManagementService,
  featureCenterProfileService,
  getShopWindowBrowserController,
  runtimeLogger
}) {
  let loadedOwnerKey = '';
  const shopRuntimeCache = new Map();

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  const shopScopedSessionPolicy = createShopScopedSessionPolicy({
    runtimeLogger,
    scope: 'promotion-master'
  });

  function getOwner() {
    if (!sessionStore || typeof sessionStore.getSession !== 'function') {
      return null;
    }

    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getFeatureById === 'function'
        ? featureCenterProfileService.getFeatureById(FEATURE_ID)
        : null;

    if (!featureEntry) {
      throw new Error('promotion-master feature entry is not registered');
    }

    return featureEntry;
  }

  function ensureOwnerScope() {
    const owner = getOwner();
    const nextOwnerKey = normalizeText(owner && owner.userKey);

    if (nextOwnerKey !== loadedOwnerKey) {
      shopRuntimeCache.clear();
      loadedOwnerKey = nextOwnerKey;
    }

    return owner;
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  async function buildShopControllerPayload(shopId) {
    const payload = {
      shopId: normalizeText(shopId)
    };

    if (
      !shopManagementService
      || typeof shopManagementService.getLocalState !== 'function'
    ) {
      return payload;
    }

    try {
      const state = await shopManagementService.getLocalState();
      const matchedShop = Array.isArray(state && state.shops)
        ? state.shops.find((shop) => normalizeText(shop && shop.id) === payload.shopId)
        : null;

      if (matchedShop) {
        payload.shopUpdatedAt = normalizeText(matchedShop.updatedAt);
      }
    } catch (_error) {
      // Ignore lookup failures and fall back to shop id only.
    }

    return payload;
  }

  function buildSafeShopKeySegment(shopId) {
    return (normalizeText(shopId) || 'shop').replace(/[^a-z0-9_-]/gi, '_');
  }

  function getCookieStoragePaths(owner, shopId) {
    const featureEntry = getFeatureEntry();
    const shopKey = buildSafeShopKeySegment(shopId);

    return {
      localCacheFilePath: path.join(
        featureEntry.storageProfile.localRootDir,
        'users',
        owner.userKey,
        'cache',
        COOKIE_CACHE_DIRECTORY,
        `${shopKey}.json`
      ),
      cloudCacheKey: `${featureEntry.storageKey}/users/${owner.userKey}/cache/${COOKIE_CACHE_DIRECTORY}/${shopKey}.json`
    };
  }

  async function readJsonFile(filePath) {
    try {
      const rawText = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, filePath);
  }

  async function readCloudCookieSnapshot(owner, shopId) {
    const { cloudCacheKey } = getCookieStoragePaths(owner, shopId);
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key: cloudCacheKey
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key: cloudCacheKey
    });

    return result.data;
  }

  async function writeCloudCookieSnapshot(owner, shopId, payload) {
    const { cloudCacheKey } = getCookieStoragePaths(owner, shopId);

    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key: cloudCacheKey,
      data: payload,
      metadata: {
        record_type: 'promotion-master-region-cookie-cache',
        owner_user_key: owner.userKey,
        owner_username: owner.username,
        shop_id: normalizeText(shopId)
      }
    });
  }

  function normalizePersistedCookieSnapshot(shopId, payload) {
    const source = payload && typeof payload === 'object' ? payload : {};

    return {
      version: COOKIE_CACHE_VERSION,
      shopId: normalizeText(shopId),
      partition: normalizeText(source.partition),
      updatedAt: normalizeText(source.updatedAt) || new Date().toISOString(),
      byRegion: PROMOTION_MASTER_REGION_ENTRIES.reduce((result, region) => {
        const regionCache = source.byRegion && source.byRegion[region.id]
          ? source.byRegion[region.id]
          : null;

        result[region.id] = {
          regionId: region.id,
          label: region.label,
          source: region.source,
          cookieHeader: normalizeText(regionCache && regionCache.cookieHeader),
          capturedAt: normalizeText(regionCache && regionCache.capturedAt)
        };
        return result;
      }, {})
    };
  }

  function getShopRuntimeEntry(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return null;
    }

    ensureOwnerScope();

    if (!shopRuntimeCache.has(normalizedShopId)) {
      shopRuntimeCache.set(normalizedShopId, {
        shopId: normalizedShopId,
        partition: '',
        cookieCacheUpdatedAt: '',
        cookieCacheByRegion: {},
        cookieCacheLoaded: false,
        cookieCacheLoadPromise: null,
        cookieCachePersistPromise: null,
        cookieRefreshPromise: null,
        lastSessionProxyLogSignature: ''
      });
    }

    return shopRuntimeCache.get(normalizedShopId);
  }

  function withShopTask(shopEntry, key, taskFactory) {
    if (!shopEntry) {
      return Promise.reject(new Error('店铺运行态不可用。'));
    }

    if (shopEntry[key]) {
      return shopEntry[key];
    }

    const taskPromise = Promise.resolve()
      .then(taskFactory)
      .finally(() => {
        if (shopEntry[key] === taskPromise) {
          shopEntry[key] = null;
        }
      });

    shopEntry[key] = taskPromise;
    return taskPromise;
  }

  function sleep(delayMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
    });
  }

  function buildSessionPolicyDetails(options = {}) {
    return {
      shopId: normalizeText(options.shopId),
      shopName: normalizeText(options.shopName),
      partition: normalizeText(options.partition),
      origin: normalizeText(options.origin),
      requestUrl: normalizeText(options.requestUrl),
      message: normalizeText(options.message)
    };
  }

  function resolveUrlHostname(requestUrl) {
    const normalizedRequestUrl = normalizeText(requestUrl);

    if (!normalizedRequestUrl) {
      return '';
    }

    try {
      return normalizeText(new URL(normalizedRequestUrl).hostname);
    } catch (_error) {
      return '';
    }
  }

  async function resolveSessionProxyRoute(targetSession, requestUrl) {
    const normalizedRequestUrl = normalizeText(requestUrl);

    if (
      !normalizedRequestUrl
      || !targetSession
      || typeof targetSession.resolveProxy !== 'function'
    ) {
      return '';
    }

    try {
      return normalizeText(await targetSession.resolveProxy(normalizedRequestUrl));
    } catch (error) {
      logError('promotion_master_session_proxy_resolve_failed', error, {
        requestUrl: normalizedRequestUrl
      });
      return '';
    }
  }

  async function logSessionProxyRouteIfNeeded(shopEntry, targetSession, requestUrl, details = {}) {
    const normalizedRequestUrl = normalizeText(requestUrl);
    const normalizedPartition = normalizeText(shopEntry && shopEntry.partition);

    if (!shopEntry || !normalizedRequestUrl || !normalizedPartition) {
      return;
    }

    const proxyRoute = await resolveSessionProxyRoute(targetSession, normalizedRequestUrl);
    const requestHost = resolveUrlHostname(normalizedRequestUrl);
    const signature = [
      normalizedPartition,
      requestHost,
      normalizeText(proxyRoute) || 'unavailable'
    ].join('|');

    if (!signature || shopEntry.lastSessionProxyLogSignature === signature) {
      return;
    }

    shopEntry.lastSessionProxyLogSignature = signature;
    log('promotion_master_session_proxy_resolved', {
      shopId: normalizeText(shopEntry.shopId),
      partition: normalizedPartition,
      requestUrl: normalizedRequestUrl,
      requestHost,
      proxyRoute: normalizeText(proxyRoute) || 'unavailable',
      origin: normalizeText(details.origin),
      source: normalizeText(details.source),
      reason: normalizeText(details.reason),
      proxyType: normalizeText(details.proxyType)
    });
  }

  async function ensureShopPartitionEnvironmentReady(shopId, partition, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedPartition = normalizeText(partition);

    if (!normalizedShopId) {
      throw new Error('Promotion monitor shop id is required before session fetch.');
    }

    if (!normalizedPartition) {
      throw new Error('Promotion monitor shop partition is required before session fetch.');
    }

    const controller = getController();

    if (!controller || typeof controller.ensureShopEnvironmentReady !== 'function') {
      throw new Error('Promotion monitor shop session environment helper is unavailable.');
    }

    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(normalizedShopId);
    const sessionContext = await controller.ensureShopEnvironmentReady({
      ...controllerPayload,
      shopId: normalizedShopId
    });
    const ensuredPartition =
      normalizeText(sessionContext && sessionContext.partition)
      || normalizeText(sessionContext && sessionContext.shopEntry && sessionContext.shopEntry.partition)
      || normalizedPartition;
    const shopEntry = getShopRuntimeEntry(normalizedShopId);
    const proxyType = normalizeText(
      sessionContext
      && sessionContext.proxyConfig
      && sessionContext.proxyConfig.type
    );

    if (shopEntry) {
      shopEntry.partition = ensuredPartition;
    }

    if (ensuredPartition !== normalizedPartition) {
      log('promotion_master_partition_reconciled', {
        shopId: normalizedShopId,
        previousPartition: normalizedPartition,
        nextPartition: ensuredPartition,
        source: normalizeText(options.source),
        reason: normalizeText(options.reason)
      });
    }

    const targetSession = resolveShopScopedFetchSession(ensuredPartition, {
      shopId: normalizedShopId,
      partition: ensuredPartition,
      origin: normalizeText(options.origin),
      requestUrl: normalizeText(options.requestUrl)
    });

    await logSessionProxyRouteIfNeeded(
      shopEntry,
      targetSession,
      normalizeText(options.requestUrl),
      {
        origin: normalizeText(options.origin),
        source: normalizeText(options.source),
        reason: normalizeText(options.reason),
        proxyType
      }
    );

    return {
      partition: ensuredPartition,
      proxyConfig:
        sessionContext
        && sessionContext.proxyConfig
        && typeof sessionContext.proxyConfig === 'object'
          ? { ...sessionContext.proxyConfig }
          : null
    };
  }

  function buildSessionTransportError(error, options = {}) {
    const rawMessage = normalizeText(error && error.message);
    const requestUrl = normalizeText(options.requestUrl);
    const proxyConfig =
      options.proxyConfig && typeof options.proxyConfig === 'object'
        ? options.proxyConfig
        : null;
    const hasProxyCredentials = Boolean(
      normalizeText(proxyConfig && proxyConfig.username)
      || normalizeText(proxyConfig && proxyConfig.password)
    );
    let nextMessage = rawMessage || '推广后台请求失败。';

    if (/ERR_TUNNEL_CONNECTION_FAILED/i.test(rawMessage)) {
      nextMessage = hasProxyCredentials
        ? '\u5E97\u94FA\u4EE3\u7406\u8FDE\u63A5\u5931\u8D25\u6216\u4EE3\u7406\u9274\u6743\u672A\u901A\u8FC7\uFF0C\u8BF7\u68C0\u67E5\u4EE3\u7406\u5730\u5740\u3001\u7AEF\u53E3\u3001\u8D26\u53F7\u5BC6\u7801\u3002'
        : '\u5E97\u94FA\u4EE3\u7406\u96A7\u9053\u5EFA\u7ACB\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u4EE3\u7406\u5730\u5740\u4E0E\u7AEF\u53E3\u662F\u5426\u53EF\u7528\u3002';
    } else if (
      /ERR_PROXY_CONNECTION_FAILED/i.test(rawMessage)
      || /ERR_NO_SUPPORTED_PROXIES/i.test(rawMessage)
    ) {
      nextMessage = '\u5E97\u94FA\u4EE3\u7406\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u4EE3\u7406\u914D\u7F6E\u3002';
    }

    const transportError = new Error(nextMessage);
    transportError.code = normalizeText(error && error.code) || 'PROMOTION_MASTER_TRANSPORT_ERROR';
    transportError.cause = error;
    transportError.requestUrl = requestUrl;
    transportError.proxyType = normalizeText(proxyConfig && proxyConfig.type);
    transportError.proxyHost = normalizeText(proxyConfig && proxyConfig.host);
    transportError.proxyPort = normalizeText(proxyConfig && proxyConfig.port);
    transportError.proxyAuthenticated = hasProxyCredentials;
    return transportError;
  }

  async function executeNetRequestWithSession(targetSession, url, requestInit = {}, options = {}) {
    const normalizedUrl = normalizeText(url);
    const proxyConfig =
      options.proxyConfig && typeof options.proxyConfig === 'object'
        ? options.proxyConfig
        : null;
    const shopId = normalizeText(options.shopId);
    const partition = normalizeText(options.partition);
    const requestHeaders =
      requestInit.headers && typeof requestInit.headers === 'object'
        ? { ...requestInit.headers }
        : {};
    const requestBody = requestInit.body;

    return new Promise((resolve, reject) => {
      let finalUrl = normalizedUrl;
      let settled = false;
      const request = net.request({
        method: normalizeText(requestInit.method) || 'GET',
        url: normalizedUrl,
        session: targetSession,
        headers: requestHeaders,
        redirect: 'follow'
      });

      function finishWithError(error) {
        if (settled) {
          return;
        }

        settled = true;
        reject(buildSessionTransportError(error, {
          requestUrl: normalizedUrl,
          proxyConfig
        }));
      }

      request.on('redirect', (_statusCode, _method, redirectUrl) => {
        finalUrl = normalizeText(redirectUrl) || finalUrl;
        request.followRedirect();
      });

      request.on('login', (authInfo, callback) => {
        if (
          authInfo
          && authInfo.isProxy === true
          && proxyConfig
          && (
            normalizeText(proxyConfig.username)
            || normalizeText(proxyConfig.password)
          )
        ) {
          log('promotion_master_proxy_auth_supplied', {
            shopId,
            partition,
            requestUrl: normalizedUrl,
            proxyType: normalizeText(proxyConfig.username || proxyConfig.password ? proxyConfig.type : '')
          });
          callback(
            normalizeText(proxyConfig.username),
            normalizeText(proxyConfig.password)
          );
          return;
        }

        if (authInfo && authInfo.isProxy === true) {
          log('promotion_master_proxy_auth_missing', {
            shopId,
            partition,
            requestUrl: normalizedUrl,
            proxyType: normalizeText(proxyConfig && proxyConfig.type),
            hasProxyConfig: Boolean(proxyConfig)
          });
        }

        callback();
      });

      request.on('response', (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('error', finishWithError);
        response.on('end', () => {
          if (settled) {
            return;
          }

          settled = true;
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const status = Number(response && response.statusCode) || 0;

          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: normalizeText(response && response.statusMessage),
            headers: response && response.headers ? response.headers : {},
            url: finalUrl || normalizedUrl,
            text: async () => responseBody
          });
        });
      });

      request.on('error', finishWithError);

      if (requestBody !== undefined && requestBody !== null && requestBody !== '') {
        request.write(requestBody);
      }

      request.end();
    });
  }

  function resolveShopScopedFetchSession(partition, options = {}) {
    return shopScopedSessionPolicy.resolveSessionForFetch(
      normalizeText(partition),
      buildSessionPolicyDetails({
        ...options,
        partition
      })
    );
  }

  function resolveShopScopedCookieSession(partition, options = {}) {
    return shopScopedSessionPolicy.resolveSessionForCookies(
      normalizeText(partition),
      buildSessionPolicyDetails({
        ...options,
        partition
      })
    );
  }

  function mergeCookieSyncMode(currentMode, nextMode) {
    const rankMap = {
      cache: 1,
      cloud: 2,
      'browser-refresh': 3
    };
    const currentRank = rankMap[normalizeText(currentMode)] || 0;
    const nextRank = rankMap[normalizeText(nextMode)] || 0;

    return nextRank >= currentRank ? normalizeText(nextMode) || normalizeText(currentMode) : normalizeText(currentMode);
  }

  function buildRetryError(message, options = {}) {
    const error = new Error(normalizeText(message) || '推广会话请求失败');

    error.authRequired = options.authRequired === true;
    error.loginPending = options.loginPending === true;
    return error;
  }

  function buildCookieHeader(cookies) {
    return (Array.isArray(cookies) ? cookies : [])
      .map((cookie) => {
        const name = normalizeText(cookie && cookie.name);
        const value = cookie && Object.prototype.hasOwnProperty.call(cookie, 'value')
          ? String(cookie.value)
          : '';

        return name ? `${name}=${value}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }

  function buildCookieSnapshot(shopEntry) {
    return {
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      partition: normalizeText(shopEntry && shopEntry.partition),
      updatedAt: normalizeText(shopEntry && shopEntry.cookieCacheUpdatedAt),
      byRegion: PROMOTION_MASTER_REGION_ENTRIES.reduce((result, region) => {
        const regionCache = shopEntry && shopEntry.cookieCacheByRegion
          ? shopEntry.cookieCacheByRegion[region.id]
          : null;

        result[region.id] = regionCache
          ? {
            regionId: region.id,
            label: region.label,
            source: region.source,
            cookieHeader: normalizeText(regionCache.cookieHeader),
            capturedAt: normalizeText(regionCache.capturedAt)
          }
          : {
            regionId: region.id,
            label: region.label,
            source: region.source,
            cookieHeader: '',
            capturedAt: ''
          };
        return result;
      }, {})
    };
  }

  function applyCookieSnapshotToEntry(shopEntry, payload) {
    const normalizedPayload = normalizePersistedCookieSnapshot(
      shopEntry && shopEntry.shopId,
      payload
    );

    shopEntry.partition = normalizeText(normalizedPayload.partition);
    shopEntry.cookieCacheUpdatedAt = normalizeText(normalizedPayload.updatedAt);
    shopEntry.cookieCacheByRegion = PROMOTION_MASTER_REGION_ENTRIES.reduce((result, region) => {
      const regionCache = normalizedPayload.byRegion[region.id];

      if (normalizeText(regionCache && regionCache.cookieHeader)) {
        result[region.id] = {
          regionId: region.id,
          label: region.label,
          source: region.source,
          cookieHeader: normalizeText(regionCache.cookieHeader),
          capturedAt: normalizeText(regionCache.capturedAt)
        };
      }

      return result;
    }, {});
  }

  function buildPersistableCookieSnapshot(shopEntry) {
    return normalizePersistedCookieSnapshot(
      shopEntry && shopEntry.shopId,
      {
        partition: normalizeText(shopEntry && shopEntry.partition),
        updatedAt: new Date().toISOString(),
        byRegion: PROMOTION_MASTER_REGION_ENTRIES.reduce((result, region) => {
          const regionCache = shopEntry && shopEntry.cookieCacheByRegion
            ? shopEntry.cookieCacheByRegion[region.id]
            : null;

          result[region.id] = {
            regionId: region.id,
            label: region.label,
            source: region.source,
            cookieHeader: normalizeText(regionCache && regionCache.cookieHeader),
            capturedAt: normalizeText(regionCache && regionCache.capturedAt)
          };
          return result;
        }, {})
      }
    );
  }

  async function loadPreferredPersistedCookieSnapshot(owner, shopId) {
    const { localCacheFilePath } = getCookieStoragePaths(owner, shopId);
    let localSnapshot = null;

    try {
      const rawLocalSnapshot = await readJsonFile(localCacheFilePath);

      if (rawLocalSnapshot) {
        localSnapshot = normalizePersistedCookieSnapshot(shopId, rawLocalSnapshot);
      }
    } catch (error) {
      logError('promotion_master_cookie_cache_local_read_failed', error, {
        shopId
      });
    }

    if (localSnapshot) {
      return localSnapshot;
    }

    try {
      const rawCloudSnapshot = await readCloudCookieSnapshot(owner, shopId);
      const cloudSnapshot = rawCloudSnapshot
        ? normalizePersistedCookieSnapshot(shopId, rawCloudSnapshot)
        : null;

      if (cloudSnapshot) {
        await writeJsonFile(localCacheFilePath, cloudSnapshot).catch((error) => {
          logError('promotion_master_cookie_cache_local_write_failed', error, {
            shopId
          });
        });
      }

      return cloudSnapshot;
    } catch (error) {
      logError('promotion_master_cookie_cache_cloud_read_failed', error, {
        shopId
      });
      return null;
    }
  }

  async function ensurePersistedCookieCacheLoaded(shopId, options = {}) {
    const owner = ensureOwnerScope();
    const shopEntry = getShopRuntimeEntry(shopId);

    if (
      !owner
      || !shopEntry
      || (shopEntry.cookieCacheLoaded === true && options.forceReload !== true)
    ) {
      return shopEntry;
    }

    return withShopTask(shopEntry, 'cookieCacheLoadPromise', async () => {
      const persistedSnapshot = await loadPreferredPersistedCookieSnapshot(owner, shopEntry.shopId);

      if (persistedSnapshot) {
        applyCookieSnapshotToEntry(shopEntry, persistedSnapshot);
      }

      shopEntry.cookieCacheLoaded = true;
      return shopEntry;
    });
  }

  async function persistCookieCache(shopEntry) {
    const owner = ensureOwnerScope();

    if (!owner || !shopEntry) {
      return null;
    }

    return withShopTask(shopEntry, 'cookieCachePersistPromise', async () => {
      const persistableSnapshot = buildPersistableCookieSnapshot(shopEntry);
      const { localCacheFilePath } = getCookieStoragePaths(owner, shopEntry.shopId);

      shopEntry.cookieCacheUpdatedAt = normalizeText(persistableSnapshot.updatedAt);
      await writeJsonFile(localCacheFilePath, persistableSnapshot);

      try {
        await writeCloudCookieSnapshot(owner, shopEntry.shopId, persistableSnapshot);
      } catch (error) {
        logError('promotion_master_cookie_cache_cloud_write_failed', error, {
          shopId: shopEntry.shopId
        });
      }

      return persistableSnapshot;
    });
  }

  function hasCompleteCookieCache(shopEntry, regionIds) {
    return resolvePromotionMasterRegionEntries(regionIds).every((region) => {
      const regionCache = shopEntry && shopEntry.cookieCacheByRegion
        ? shopEntry.cookieCacheByRegion[region.id]
        : null;

      return Boolean(normalizeText(regionCache && regionCache.cookieHeader));
    });
  }

  function parseApiPayload(response, responseText) {
    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      data = null;
    }

    const responseStatus = Number(response && response.status) || 0;
    const statusText = normalizeText(response && response.statusText);
    const errorCode = data && Object.prototype.hasOwnProperty.call(data, 'errorCode')
      ? Number(data.errorCode)
      : null;
    const responsePreview = normalizeText(
      String(responseText || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
    ).slice(0, 160);
    let message = normalizeText(
      data && (
        data.message
        || data.msg
        || data.errorMsg
        || data.error_message
        || data.errorMessage
      )
    );

    if (!message) {
      if (responseStatus >= 400) {
        message = `HTTP ${responseStatus}${statusText ? ` ${statusText}` : ''}`;
      } else if (Number.isFinite(errorCode) && errorCode !== 0) {
        message = `errorCode ${errorCode}`;
      } else if (responsePreview) {
        message = responsePreview;
      }
    }

    const hasAuthKeyword = /login|logout|expired|offline|unauthorized|forbidden|signin|sign in|relogin|auth/i.test(
      message
    );
    const authRequired =
      responseStatus === 401
      || responseStatus === 403
      || hasAuthKeyword
      || (
        data
        && data.success === false
        && (
          errorCode === 401
          || errorCode === 403
          || hasAuthKeyword
        )
      );

    return {
      ok: response.ok && authRequired !== true,
      authRequired,
      httpStatus: responseStatus,
      statusText,
      message,
      success: data && Object.prototype.hasOwnProperty.call(data, 'success')
        ? Boolean(data.success)
        : null,
      errorCode,
      data,
      responseTextPreview: responsePreview.slice(0, 240)
    };
  }

  function parseHtmlPayload(response, responseText) {
    const htmlText = typeof responseText === 'string' ? responseText : '';
    const finalUrl = normalizeText(response && response.url);
    const authRequired =
      Number(response && response.status) === 401
      || Number(response && response.status) === 403
      || /\/login(?:\.html)?(?:[?#]|$)/i.test(finalUrl)
      || /login\.html\?redirectUrl=/i.test(htmlText);

    return {
      ok: Boolean(response && response.ok) && authRequired !== true,
      authRequired,
      httpStatus: Number(response && response.status) || 0,
      message: authRequired ? 'ads page auth required' : '',
      success: Boolean(response && response.ok) && authRequired !== true,
      errorCode: null,
      data: null,
      html: htmlText,
      finalUrl,
      responseTextPreview: normalizeText(htmlText).slice(0, 240)
    };
  }

  function buildBrowserFetchScript(url, payload) {
    const runtimePayload = JSON.stringify({
      url,
      payload
    });

    return `
      (() => {
        const runtimePayload = ${runtimePayload};

        return window.fetch(runtimePayload.url, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(runtimePayload.payload || {})
        })
          .then(async (response) => {
            const responseText = await response.text();
            return {
              ok: response.ok,
              status: response.status,
              responseText
            };
          })
          .catch((error) => ({
            ok: false,
            status: 0,
            responseText: '',
            transportError: String(error && error.message || '')
          }));
      })();
    `;
  }

  async function executeBrowserFetch(view, url, payload) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      throw new Error('商品推广后台浏览器不可用。');
    }

    const rawResult = await view.webContents.executeJavaScript(
      buildBrowserFetchScript(url, payload),
      true
    );

    if (normalizeText(rawResult && rawResult.transportError)) {
      return {
        ok: false,
        authRequired: false,
        httpStatus: Number(rawResult && rawResult.status) || 0,
        message: normalizeText(rawResult && rawResult.transportError),
        success: false,
        errorCode: null,
        data: null,
        responseTextPreview: ''
      };
    }

    return parseApiPayload(
      {
        ok: rawResult && rawResult.ok === true,
        status: Number(rawResult && rawResult.status) || 0
      },
      normalizeText(rawResult && rawResult.responseText)
    );
  }

  async function executeSessionFetch(partition, url, payload, cookieHeader, options = {}) {
    const sessionContext = await ensureShopPartitionEnvironmentReady(options.shopId, partition, {
      controllerPayload: options.controllerPayload,
      requestUrl: url,
      origin: normalizeText(options.origin),
      source: 'promotion-master-session-fetch',
      reason: normalizeText(options.reason) || 'promotion-master-session-fetch'
    });
    const targetSession = resolveShopScopedFetchSession(sessionContext.partition, {
      shopId: normalizeText(options.shopId),
      shopName: normalizeText(options.shopName),
      origin: normalizeText(options.origin),
      requestUrl: url,
      message: normalizeText(options.message)
        || '\u63a8\u5e7f\u540e\u53f0\u63a5\u53e3\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    });
    const requestInit = {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        cookie: normalizeText(cookieHeader)
      },
      body: JSON.stringify(payload || {}),
      cache: 'no-store',
      credentials: 'omit'
    };

    let response;

    if (targetSession) {
      response = await executeNetRequestWithSession(targetSession, url, requestInit, {
        proxyConfig: sessionContext.proxyConfig,
        shopId: normalizeText(options.shopId),
        partition: normalizeText(sessionContext.partition)
      });
    } else {
      throw new Error('当前环境不支持后台接口请求。');
    }

    const responseText = await response.text();
    return parseApiPayload(response, responseText);
  }

  async function executeSessionHtmlFetch(partition, url, cookieHeader, options = {}) {
    const sessionContext = await ensureShopPartitionEnvironmentReady(options.shopId, partition, {
      controllerPayload: options.controllerPayload,
      requestUrl: url,
      origin: normalizeText(options.origin),
      source: 'promotion-master-session-html-fetch',
      reason: normalizeText(options.reason) || 'promotion-master-session-html-fetch'
    });
    const targetSession = resolveShopScopedFetchSession(sessionContext.partition, {
      shopId: normalizeText(options.shopId),
      shopName: normalizeText(options.shopName),
      origin: normalizeText(options.origin),
      requestUrl: url,
      message: normalizeText(options.message)
        || '\u63a8\u5e7f\u540e\u53f0\u9875\u9762\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    });
    const requestInit = {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        cookie: normalizeText(cookieHeader)
      },
      cache: 'no-store',
      credentials: 'omit'
    };

    let response;

    if (targetSession) {
      response = await executeNetRequestWithSession(targetSession, url, requestInit, {
        proxyConfig: sessionContext.proxyConfig,
        shopId: normalizeText(options.shopId),
        partition: normalizeText(sessionContext.partition)
      });
    } else {
      throw new Error('当前环境不支持后台页面请求。');
    }

    const responseText = await response.text();
    return parseHtmlPayload(response, responseText);
  }

  async function triggerBackgroundRelogin(controllerPayload, reason, message = '') {
    const controller = getController();

    if (
      !controller
      || typeof controller.beginBackgroundProductPromotionMonitorRelogin !== 'function'
    ) {
      return;
    }

    await controller.beginBackgroundProductPromotionMonitorRelogin({
      ...(controllerPayload || {}),
      reason: normalizeText(reason) || 'promotion-master-auth-expired',
      message: normalizeText(message)
    });
  }

  async function waitForWorkspaceReady(shopId, options = {}) {
    ensureOwnerScope();

    const controller = getController();
    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(shopId);

    if (!controller || typeof controller.ensureBackgroundProductPromotionMonitorSession !== 'function') {
      throw new Error('商品推广浏览器控制器不可用。');
    }

    let sessionContext = await controller.ensureBackgroundProductPromotionMonitorSession(controllerPayload);
    let snapshot = sessionContext.snapshot;

    if (!snapshot.currentUrl) {
      if (typeof controller.loadBackgroundProductPromotionMonitorHome === 'function') {
        await controller.loadBackgroundProductPromotionMonitorHome(controllerPayload);
      }
    } else if (
      options.forceRelogin === true
      || snapshot.isManagedLoginEntry
      || snapshot.isLoginPage
      || snapshot.isRelatedUrl === false
    ) {
      await triggerBackgroundRelogin(
        controllerPayload,
        options.reason || 'promotion-master-ensure-workspace-ready'
      );
    }

    const deadline = Date.now() + LOGIN_WAIT_TIMEOUT_MS;

    while (Date.now() <= deadline) {
      sessionContext = await controller.ensureBackgroundProductPromotionMonitorSession(controllerPayload);
      snapshot = sessionContext.snapshot;

      if (snapshot.isWorkspaceReady) {
        const shopEntry = getShopRuntimeEntry(shopId);

        if (shopEntry) {
          shopEntry.partition = normalizeText(sessionContext.shopEntry && sessionContext.shopEntry.partition);
        }

        return sessionContext;
      }

      await sleep(LOGIN_WAIT_STEP_MS);
    }

    throw buildRetryError('商品推广登录尚未完成，稍后自动重试。', {
      authRequired: true,
      loginPending: true
    });
  }

  async function resolveShopPartition(shopId, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shopEntry = getShopRuntimeEntry(normalizedShopId);
    const cachedPartition = normalizeText(
      options.partition
      || (shopEntry && shopEntry.partition)
    );

    if (cachedPartition) {
      return cachedPartition;
    }

    const sessionContext = options.sessionContext || await waitForWorkspaceReady(normalizedShopId, {
      controllerPayload: options.controllerPayload,
      reason: options.reason || 'promotion-master-resolve-partition'
    });
    const resolvedPartition = normalizeText(sessionContext && sessionContext.shopEntry && sessionContext.shopEntry.partition);

    resolveShopScopedCookieSession(resolvedPartition, {
      shopId: normalizedShopId,
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      origin: ADS_HOME_URL,
      requestUrl: ADS_HOME_URL,
      message: '\u63a8\u5e7f\u4f1a\u8bdd\u5206\u533a\u7f3a\u5931\uff0c\u5df2\u963b\u6b62\u4f7f\u7528 defaultSession\u3002'
    });

    if (shopEntry) {
      shopEntry.partition = resolvedPartition;
    }

    return resolvedPartition;
  }

  async function ensureCookieSnapshotPartition(shopId, cookieSnapshot, options = {}) {
    const normalizedPartition = normalizeText(cookieSnapshot && cookieSnapshot.partition);

    if (normalizedPartition) {
      return {
        ...(cookieSnapshot && typeof cookieSnapshot === 'object' ? cookieSnapshot : {}),
        partition: normalizedPartition
      };
    }

    const normalizedShopId = normalizeText(shopId);
    const resolvedPartition = await resolveShopPartition(normalizedShopId, options);
    const shopEntry = getShopRuntimeEntry(normalizedShopId);

    if (shopEntry) {
      shopEntry.partition = resolvedPartition;

      await persistCookieCache(shopEntry).catch((error) => {
        logError('promotion_master_cookie_cache_local_write_failed', error, {
          shopId: normalizedShopId
        });
      });
    }

    return {
      ...(cookieSnapshot && typeof cookieSnapshot === 'object' ? cookieSnapshot : {}),
      shopId: normalizeText(
        cookieSnapshot && cookieSnapshot.shopId
      ) || normalizedShopId,
      partition: resolvedPartition
    };
  }

  async function refreshRegionCookieCache(shopId, options = {}) {
    ensureOwnerScope();

    const shopEntry = getShopRuntimeEntry(shopId);
    const targetRegions = resolvePromotionMasterRegionEntries(options.regionIds);

    if (!shopEntry) {
      throw new Error('店铺运行态不可用。');
    }

    if (targetRegions.length === 0) {
      return buildCookieSnapshot(shopEntry);
    }

    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(shopId);

    return withShopTask(shopEntry, 'cookieRefreshPromise', async () => {
      const sessionContext = await waitForWorkspaceReady(shopId, {
        controllerPayload,
        reason: options.reason || 'promotion-master-refresh-cookies'
      });
      const resolvedPartition = normalizeText(sessionContext.shopEntry && sessionContext.shopEntry.partition);
      const targetSession = resolveShopScopedCookieSession(resolvedPartition, {
        shopId: normalizeText(shopId),
        shopName: normalizeText(sessionContext && sessionContext.shopName),
        origin: ADS_COOKIE_URL,
        requestUrl: ADS_COOKIE_URL,
        message: '\u63a8\u5e7f Cookies \u5237\u65b0\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u4f7f\u7528 defaultSession\u3002'
      });

      shopEntry.partition = resolvedPartition;

      for (const region of targetRegions) {
        const switchResult = await executeBrowserFetch(
          sessionContext.view,
          `${ADS_DEPLOYMENT_SWITCH_URL}?source=${region.source}`,
          { source: region.source }
        );

        if (switchResult.authRequired === true) {
          await triggerBackgroundRelogin(
            controllerPayload,
            `${region.id}-cookie-refresh-auth-expired`
          );
          throw buildRetryError(`${region.label} Cookies 已失效，正在重新登录。`, {
            authRequired: true
          });
        }

        if (switchResult.ok !== true) {
          throw new Error(
            normalizeText(switchResult.message)
            || `${region.label} 切区失败`
          );
        }

        const cookies = await targetSession.cookies.get({
          url: ADS_COOKIE_URL
        });

        shopEntry.cookieCacheByRegion[region.id] = {
          regionId: region.id,
          label: region.label,
          source: region.source,
          cookieHeader: buildCookieHeader(cookies),
          capturedAt: new Date().toISOString()
        };
      }

      log('promotion_master_region_cookies_refreshed', {
        shopId: normalizeText(shopId),
        regions: targetRegions.map((region) => region.id)
      });

      await persistCookieCache(shopEntry);
      return buildCookieSnapshot(shopEntry);
    });
  }

  async function ensureRegionCookieCache(shopId, options = {}) {
    ensureOwnerScope();

    const shopEntry = getShopRuntimeEntry(shopId);
    await ensurePersistedCookieCacheLoaded(shopId);

    if (!shopEntry) {
      throw new Error('缺少店铺标识，无法读取推广 Cookies。');
    }

    if (options.forceRefresh === true || !hasCompleteCookieCache(shopEntry, options.regionIds)) {
      return refreshRegionCookieCache(shopId, options);
    }

    return buildCookieSnapshot(shopEntry);
  }

  async function executeRegionCookieRequest(shopId, regionId, requestExecutor, options = {}) {
    const owner = ensureOwnerScope();
    const normalizedShopId = normalizeText(shopId);
    const normalizedRegionId = normalizeText(regionId);
    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(normalizedShopId);
    const refreshRegionIds = Array.isArray(options.allRegionIds) && options.allRegionIds.length > 0
      ? options.allRegionIds
      : [normalizedRegionId];
    let cookieSyncMode = normalizeText(options.initialCookieSyncMode) || 'cache';
    let cookieSnapshot = (
      options.cookieSnapshot
      && typeof options.cookieSnapshot === 'object'
      && normalizeText(options.cookieSnapshot.partition)
    )
      ? options.cookieSnapshot
      : await ensureRegionCookieCache(normalizedShopId, {
        controllerPayload,
        regionIds: refreshRegionIds,
        forceRefresh: options.forceCookieRefresh === true,
        reason: options.reason || `${normalizedRegionId}-ensure-cookies`
      });
    cookieSnapshot = await ensureCookieSnapshotPartition(normalizedShopId, cookieSnapshot, {
      controllerPayload,
      reason: `${normalizedRegionId}-ensure-partition`
    });
    let regionCookie = cookieSnapshot.byRegion && cookieSnapshot.byRegion[normalizedRegionId]
      ? cookieSnapshot.byRegion[normalizedRegionId]
      : null;

    if (!normalizeText(regionCookie && regionCookie.cookieHeader)) {
      cookieSyncMode = 'browser-refresh';
      cookieSnapshot = await refreshRegionCookieCache(normalizedShopId, {
        controllerPayload,
        regionIds: refreshRegionIds,
        reason: `${normalizedRegionId}-missing-cookie-cache`
      });
      cookieSnapshot = await ensureCookieSnapshotPartition(normalizedShopId, cookieSnapshot, {
        controllerPayload,
        reason: `${normalizedRegionId}-missing-cookie-cache-partition`
      });
      regionCookie = cookieSnapshot.byRegion && cookieSnapshot.byRegion[normalizedRegionId]
        ? cookieSnapshot.byRegion[normalizedRegionId]
        : null;
    }

    const firstResult = await requestExecutor(
      cookieSnapshot.partition,
      normalizeText(regionCookie && regionCookie.cookieHeader)
    );

    if (firstResult.authRequired !== true) {
      return {
        result: firstResult,
        cookieSnapshot,
        refreshedCookies: cookieSyncMode === 'browser-refresh',
        cookieSyncMode
      };
    }

    cookieSyncMode = 'browser-refresh';
    cookieSnapshot = await refreshRegionCookieCache(normalizedShopId, {
      controllerPayload,
      regionIds: refreshRegionIds,
      reason: `${normalizedRegionId}-auth-refresh`
    });
    cookieSnapshot = await ensureCookieSnapshotPartition(normalizedShopId, cookieSnapshot, {
      controllerPayload,
      reason: `${normalizedRegionId}-auth-refresh-partition`
    });
    regionCookie = cookieSnapshot.byRegion && cookieSnapshot.byRegion[normalizedRegionId]
      ? cookieSnapshot.byRegion[normalizedRegionId]
      : null;

    const retryResult = await requestExecutor(
      cookieSnapshot.partition,
      normalizeText(regionCookie && regionCookie.cookieHeader)
    );

    if (retryResult.authRequired === true) {
      await triggerBackgroundRelogin(
        controllerPayload,
        `${normalizedRegionId}-cached-cookie-auth-expired`
      );
      throw buildRetryError(`${normalizeText(regionCookie && regionCookie.label) || normalizedRegionId} 登录已失效，正在重新登录。`, {
        authRequired: true
      });
    }

    return {
      result: retryResult,
      cookieSnapshot,
      refreshedCookies: true,
      cookieSyncMode
    };
  }

  async function fetchWithRegionCookie(shopId, regionId, url, payload, options = {}) {
    const owner = ensureOwnerScope();

    const normalizedShopId = normalizeText(shopId);
    const normalizedRegionId = normalizeText(regionId);
    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(normalizedShopId);
    const refreshRegionIds = Array.isArray(options.allRegionIds) && options.allRegionIds.length > 0
      ? options.allRegionIds
      : [normalizedRegionId];
    let cookieSyncMode = normalizeText(options.initialCookieSyncMode) || 'cache';
    let cookieSnapshot = (
      options.cookieSnapshot
      && typeof options.cookieSnapshot === 'object'
      && normalizeText(options.cookieSnapshot.partition)
    )
      ? options.cookieSnapshot
      : await ensureRegionCookieCache(normalizedShopId, {
        controllerPayload,
        regionIds: refreshRegionIds,
        forceRefresh: options.forceCookieRefresh === true,
        reason: options.reason || `${normalizedRegionId}-ensure-cookies`
      });
    cookieSnapshot = await ensureCookieSnapshotPartition(normalizedShopId, cookieSnapshot, {
      controllerPayload,
      reason: `${normalizedRegionId}-ensure-partition`
    });
    let regionCookie = cookieSnapshot.byRegion && cookieSnapshot.byRegion[normalizedRegionId]
      ? cookieSnapshot.byRegion[normalizedRegionId]
      : null;

    if (!normalizeText(regionCookie && regionCookie.cookieHeader)) {
      cookieSyncMode = 'browser-refresh';
      cookieSnapshot = await refreshRegionCookieCache(normalizedShopId, {
        controllerPayload,
        regionIds: refreshRegionIds,
        reason: `${normalizedRegionId}-missing-cookie-cache`
      });
      cookieSnapshot = await ensureCookieSnapshotPartition(normalizedShopId, cookieSnapshot, {
        controllerPayload,
        reason: `${normalizedRegionId}-missing-cookie-cache-partition`
      });
      regionCookie = cookieSnapshot.byRegion && cookieSnapshot.byRegion[normalizedRegionId]
        ? cookieSnapshot.byRegion[normalizedRegionId]
        : null;
    }

    const firstResult = await executeSessionFetch(
      cookieSnapshot.partition,
      url,
      payload,
      normalizeText(regionCookie && regionCookie.cookieHeader),
      {
        shopId: normalizedShopId,
        origin: url
      }
    );

    if (firstResult.authRequired !== true) {
      return {
        result: firstResult,
        cookieSnapshot,
        refreshedCookies: cookieSyncMode === 'browser-refresh',
        cookieSyncMode
      };
    }

    cookieSyncMode = 'browser-refresh';
    cookieSnapshot = await refreshRegionCookieCache(normalizedShopId, {
      controllerPayload,
      regionIds: refreshRegionIds,
      reason: `${normalizedRegionId}-auth-refresh`
    });
    cookieSnapshot = await ensureCookieSnapshotPartition(normalizedShopId, cookieSnapshot, {
      controllerPayload,
      reason: `${normalizedRegionId}-auth-refresh-partition`
    });
    regionCookie = cookieSnapshot.byRegion && cookieSnapshot.byRegion[normalizedRegionId]
      ? cookieSnapshot.byRegion[normalizedRegionId]
      : null;

    const retryResult = await executeSessionFetch(
      cookieSnapshot.partition,
      url,
      payload,
      normalizeText(regionCookie && regionCookie.cookieHeader),
      {
        shopId: normalizedShopId,
        origin: url
      }
    );

    if (retryResult.authRequired === true) {
      await triggerBackgroundRelogin(
        controllerPayload,
        `${normalizedRegionId}-cached-cookie-auth-expired`
      );
      throw buildRetryError(`${normalizeText(regionCookie && regionCookie.label) || normalizedRegionId} 登录已失效，正在重新登录。`, {
        authRequired: true
      });
    }

    return {
      result: retryResult,
      cookieSnapshot,
      refreshedCookies: true,
      cookieSyncMode
    };
  }

  async function fetchPageWithRegionCookie(shopId, regionId, url, options = {}) {
    return executeRegionCookieRequest(
      shopId,
      regionId,
      (partition, cookieHeader) => executeSessionHtmlFetch(partition, url, cookieHeader, {
        shopId: normalizeText(shopId),
        origin: url
      }),
      options
    );
  }

  function buildDefaultReportsQueryPayload(now = new Date()) {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      start_ts: startOfDay.getTime(),
      end_ts: now.getTime(),
      source: 0,
      sort_type: 0,
      query_type: 0,
      need_query_last_cycle: false,
      asc_order: true,
      columns_type: 10
    };
  }

  async function fetchAdListSummaries(shopId, options = {}) {
    ensureOwnerScope();

    const normalizedShopId = normalizeText(shopId);
    const targetRegions = resolvePromotionMasterRegionEntries(options.regionIds);
    const onRegionStatus = typeof options.onRegionStatus === 'function'
      ? options.onRegionStatus
      : null;
    const buildPayload = typeof options.buildPayload === 'function'
      ? options.buildPayload
      : () => buildDefaultReportsQueryPayload();
    const regions = {};
    let cookieSnapshot = null;
    let refreshedCookies = false;
    let cookieSyncMode = 'cache';
    const targetRegionIds = targetRegions.map((region) => region.id);
    const shopEntry = getShopRuntimeEntry(normalizedShopId);
    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(normalizedShopId);

    await ensurePersistedCookieCacheLoaded(normalizedShopId);

    if (shopEntry && (
      options.forceCookieRefresh === true
      || !hasCompleteCookieCache(shopEntry, targetRegionIds)
    )) {
      cookieSyncMode = 'browser-refresh';
      cookieSnapshot = await refreshRegionCookieCache(normalizedShopId, {
        controllerPayload,
        regionIds: targetRegionIds,
        reason: 'reports-query-prefetch-cookies'
      });
      refreshedCookies = true;
    } else if (shopEntry) {
      cookieSnapshot = buildCookieSnapshot(shopEntry);
    }

    const regionResults = await Promise.all(targetRegions.map(async (region) => {
      if (onRegionStatus) {
        onRegionStatus({
          shopId: normalizedShopId,
          regionId: region.id,
          regionLabel: region.label,
          stage: 'start'
        });
      }

      const fetchResult = await fetchWithRegionCookie(
        normalizedShopId,
        region.id,
        ADS_REPORTS_QUERY_URL,
        buildPayload(region),
        {
          cookieSnapshot,
          allRegionIds: targetRegionIds,
          controllerPayload,
          forceCookieRefresh: false,
          initialCookieSyncMode: cookieSyncMode,
          reason: `${region.id}-reports-query`
        }
      );
      const responsePayload = fetchResult.result && typeof fetchResult.result === 'object'
        ? fetchResult.result
        : {};
      const responseData = responsePayload.data && typeof responsePayload.data === 'object'
        ? responsePayload.data
        : {};
      const resultData = responseData.result && typeof responseData.result === 'object'
        ? responseData.result
        : {};
      const summary = buildCombinedSummaryContainer([
        { key: 'resultSummary', value: resultData.summary },
        { key: 'resultReportsSummary', value: resultData.reports_summary },
        { key: 'responseSummary', value: responseData.summary },
        { key: 'responseReportsSummary', value: responseData.reports_summary }
      ]);

      if (onRegionStatus) {
        onRegionStatus({
          shopId: normalizedShopId,
          regionId: region.id,
          regionLabel: region.label,
          stage: 'done',
          cookieSyncMode: fetchResult.cookieSyncMode,
          response: responsePayload,
          summary
        });
      }

      return {
        regionId: region.id,
        fetchResult,
        regionPayload: {
          regionId: region.id,
          label: region.label,
          source: region.source,
          fetchedAt: new Date().toISOString(),
          response: responsePayload,
          rawData: isContainerValue(responseData) ? responseData : {},
          reportInfo: isContainerValue(resultData) ? resultData : {},
          summary: isContainerValue(summary) ? summary : {}
        }
      };
    }));

    regionResults.forEach((entry) => {
      cookieSnapshot = entry.fetchResult.cookieSnapshot || cookieSnapshot;
      refreshedCookies = refreshedCookies || entry.fetchResult.refreshedCookies === true;
      cookieSyncMode = mergeCookieSyncMode(cookieSyncMode, entry.fetchResult.cookieSyncMode);
      regions[entry.regionId] = entry.regionPayload;
    });

    return {
      shopId: normalizedShopId,
      regionIds: targetRegionIds,
      cookieSnapshot: cookieSnapshot || buildCookieSnapshot(getShopRuntimeEntry(normalizedShopId)),
      refreshedCookies,
      cookieSyncMode,
      regions
    };
  }

  async function fetchAdsDetailSummaries(shopId, options = {}) {
    ensureOwnerScope();

    const normalizedShopId = normalizeText(shopId);
    const targetRegions = resolvePromotionMasterRegionEntries(options.regionIds);
    const buildPayload = typeof options.buildPayload === 'function'
      ? options.buildPayload
      : () => ({});
    const onRegionStatus = typeof options.onRegionStatus === 'function'
      ? options.onRegionStatus
      : null;
    const regions = {};
    let cookieSnapshot = null;
    let refreshedCookies = false;
    let cookieSyncMode = 'cache';
    const targetRegionIds = targetRegions.map((region) => region.id);
    const shopEntry = getShopRuntimeEntry(normalizedShopId);
    const controllerPayload = options.controllerPayload || await buildShopControllerPayload(normalizedShopId);

    await ensurePersistedCookieCacheLoaded(normalizedShopId);

    if (shopEntry && (
      options.forceCookieRefresh === true
      || !hasCompleteCookieCache(shopEntry, targetRegionIds)
    )) {
      cookieSyncMode = 'browser-refresh';
      cookieSnapshot = await refreshRegionCookieCache(normalizedShopId, {
        controllerPayload,
        regionIds: targetRegionIds,
        reason: 'ads-detail-prefetch-cookies'
      });
      refreshedCookies = true;
    } else if (shopEntry) {
      cookieSnapshot = buildCookieSnapshot(shopEntry);
    }

    const regionResults = await Promise.all(targetRegions.map(async (region) => {
      if (onRegionStatus) {
        onRegionStatus({
          shopId: normalizedShopId,
          regionId: region.id,
          regionLabel: region.label,
          stage: 'start'
        });
      }

      const fetchResult = await fetchWithRegionCookie(
        normalizedShopId,
        region.id,
        ADS_DETAIL_URL,
        buildPayload(region),
        {
          cookieSnapshot,
          allRegionIds: targetRegionIds,
          controllerPayload,
          forceCookieRefresh: false,
          initialCookieSyncMode: cookieSyncMode,
          reason: `${region.id}-ads-detail`
        }
      );
      const responseData = fetchResult.result && fetchResult.result.data && typeof fetchResult.result.data === 'object'
        ? fetchResult.result.data
        : {};
      const resultData = responseData && responseData.result && typeof responseData.result === 'object'
        ? responseData.result
        : {};

      if (onRegionStatus) {
        onRegionStatus({
          shopId: normalizedShopId,
          regionId: region.id,
          regionLabel: region.label,
          stage: 'done',
          cookieSyncMode: fetchResult.cookieSyncMode,
          response: fetchResult.result
        });
      }

      return {
        regionId: region.id,
        fetchResult,
        regionPayload: {
          regionId: region.id,
          label: region.label,
          source: region.source,
          fetchedAt: new Date().toISOString(),
          response: fetchResult.result,
          summary: buildCombinedSummaryContainer([
            { key: 'resultSummary', value: resultData.summary },
            { key: 'resultReportsSummary', value: resultData.reports_summary },
            { key: 'responseSummary', value: responseData.summary },
            { key: 'responseReportsSummary', value: responseData.reports_summary }
          ])
        }
      };
    }));

    regionResults.forEach((entry) => {
      cookieSnapshot = entry.fetchResult.cookieSnapshot || cookieSnapshot;
      refreshedCookies = refreshedCookies || entry.fetchResult.refreshedCookies === true;
      cookieSyncMode = mergeCookieSyncMode(cookieSyncMode, entry.fetchResult.cookieSyncMode);
      regions[entry.regionId] = entry.regionPayload;
    });

    return {
      shopId: normalizedShopId,
      regionIds: targetRegions.map((region) => region.id),
      cookieSnapshot: cookieSnapshot || buildCookieSnapshot(getShopRuntimeEntry(normalizedShopId)),
      refreshedCookies,
      cookieSyncMode,
      regions
    };
  }

  async function postWithRegionCookie(shopId, regionId, url, payload, options = {}) {
    ensureOwnerScope();

    const normalizedShopId = normalizeText(shopId);
    const normalizedRegionId = normalizeText(regionId);
    const fetchResult = await fetchWithRegionCookie(
      normalizedShopId,
      normalizedRegionId,
      url,
      payload,
      options
    );

    return {
      shopId: normalizedShopId,
      regionId: normalizedRegionId,
      cookieSnapshot: fetchResult.cookieSnapshot,
      refreshedCookies: fetchResult.refreshedCookies === true,
      cookieSyncMode: fetchResult.cookieSyncMode,
      response: fetchResult.result
    };
  }

  return {
    async ensureRegionCookieCache(shopId, options = {}) {
      return ensureRegionCookieCache(shopId, options);
    },

    async getCachedRegionCookieSnapshot(shopId) {
      ensureOwnerScope();

      const shopEntry = getShopRuntimeEntry(shopId);

      await ensurePersistedCookieCacheLoaded(shopId);
      return shopEntry ? buildCookieSnapshot(shopEntry) : null;
    },

    async fetchAdsDetailSummaries(shopId, options = {}) {
      return fetchAdsDetailSummaries(shopId, options);
    },

    async fetchAdListSummaries(shopId, options = {}) {
      return fetchAdListSummaries(shopId, options);
    },

    async postWithRegionCookie(shopId, regionId, url, payload, options = {}) {
      return postWithRegionCookie(shopId, regionId, url, payload, options);
    },

    invalidateShopCache(shopId) {
      const normalizedShopId = normalizeText(shopId);

      if (!normalizedShopId) {
        return;
      }

      shopRuntimeCache.delete(normalizedShopId);
    },

    shutdown() {
      shopRuntimeCache.clear();
      loadedOwnerKey = '';
    }
  };
}

module.exports = {
  ADS_LIST_PAGE_URL,
  ADS_DETAIL_URL,
  PROMOTION_MASTER_REGION_ENTRIES,
  createPromotionMasterSessionService
};
