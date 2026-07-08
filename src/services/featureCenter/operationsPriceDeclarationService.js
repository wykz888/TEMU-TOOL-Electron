const crypto = require('node:crypto');
const { normalizeText, isShopParticipating } = require('../shopManagement/common');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');
const {
  createOperationsPriceDeclarationStore
} = require('./operationsPriceDeclarationStore');
const {
  buildCostLookupCandidates,
  normalizeCostSpecText
} = require('./operationsCostIdentity');
const {
  computeProfitRateByPrice
} = require('../../utils/operationsProfitMetrics');

const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const QUERY_ENDPOINT_PATH = '/api/kiana/magnus/mms/price-adjust/page-query';
const BATCH_REVIEW_ENDPOINT_PATH = '/api/kiana/magnus/mms/price-adjust/batch-review';
const QUERY_REQUEST_TIMEOUT_MS = 30000;
const QUERY_SETTINGS_VERSION = 1;
const QUICK_COST_PRESET_VERSION = 1;
const REVIEW_RULES_VERSION = 1;
const DEFAULT_QUERY_SETTINGS = Object.freeze({
  perShopDelaySeconds: 0,
  selectedShopIds: Object.freeze([])
});
const DEFAULT_REVIEW_RULES = Object.freeze({
  dailyRule: Object.freeze({
    metric: 'profitRate',
    threshold: ''
  }),
  activityRule: Object.freeze({
    metric: 'profitRate',
    threshold: ''
  }),
  rejectReason: ''
});
const DEFAULT_PAGE_SIZE = 200;
const MAX_CONCURRENT_SHOP_QUERIES = 3;
const MAX_MULTI_KEYWORDS = 40;
const STATUS_CODE_BY_FILTER = Object.freeze({
  declaring: 0,
  pendingSeller: 1,
  success: 2,
  failed: 3
});
const STATUS_FILTER_BY_CODE = Object.freeze({
  0: 'declaring',
  1: 'pendingSeller',
  2: 'success',
  3: 'failed'
});
const PRICE_TYPE_CODE_BY_FILTER = Object.freeze({
  daily: 0,
  activity: 1
});
const PRICE_TYPE_FILTER_BY_CODE = Object.freeze({
  0: 'daily',
  1: 'activity',
  2: 'activity'
});
const GOODS_NO_TYPE_CODE_BY_FILTER = Object.freeze({
  skc: 1,
  sku: 2
});
const CHANGE_TYPE_BY_FILTER = Object.freeze({
  raise: 'raise',
  reduce: 'reduce',
  new: 'new'
});
const REVIEW_BATCH_RESULT = Object.freeze({
  pass: 1,
  reject: 2,
  compromise: 3
});
const REVIEW_RULE_METRIC = Object.freeze({
  profitRate: 'profitRate',
  profitAmount: 'profitAmount'
});

function createOperationsPriceDeclarationService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  operationsSharedCostService,
  getShopWindowBrowserController,
  emitProgress,
  runtimeLogger
}) {
  const store = createOperationsPriceDeclarationStore({
    sessionStore,
    featureCenterProfileService
  });
  const latestQueryProgressByOwner = new Map();
  const activeQueryJobsByOwnerKey = new Map();
  const activeQueryJobsByRequesterKey = new Map();
  const activeQueryJobsByRunId = new Map();

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
    scope: 'operations-price-declaration'
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeScalarText(value) {
    return value === null || value === undefined
      ? ''
      : String(value).trim();
  }

  function pickFirstDefined(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }

    return undefined;
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || null));
  }

  function normalizeIntegerValue(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function normalizeDecimalValue(value, fallback = 0) {
    if (value === '' || value === null || value === undefined) {
      return fallback;
    }

    const matchedNumber = String(value).match(/-?\d+(?:\.\d+)?/);
    const parsedValue = matchedNumber
      ? Number.parseFloat(matchedNumber[0])
      : Number.NaN;
    return Number.isFinite(parsedValue) ? Number(parsedValue) : fallback;
  }

  function normalizePositiveDecimalValue(value, fallback = 0) {
    const parsedValue = normalizeDecimalValue(value, fallback);
    return parsedValue >= 0 ? parsedValue : fallback;
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    return Array.from(new Set(
      (Array.isArray(selectedShopIds) ? selectedShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function normalizeSelectedStationIds(stationIds) {
    return Array.from(new Set(
      (Array.isArray(stationIds) ? stationIds : [])
        .map((stationId) => normalizeText(stationId))
        .filter(Boolean)
    ));
  }

  function parseKeywordList(value) {
    return Array.from(new Set(
      normalizeText(value)
        .split(/[\s,\uff0c;\uff1b]+/)
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )).slice(0, MAX_MULTI_KEYWORDS);
  }

  function parseDateTimestamp(value, options = {}) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return Number.NaN;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
      const suffix = options.endOfDay === true
        ? 'T23:59:59.999'
        : 'T00:00:00.000';
      return Date.parse(`${normalizedValue}${suffix}`);
    }

    return Date.parse(normalizedValue);
  }

  function getOwnerKey(owner) {
    return normalizeText(owner && owner.userKey) || 'anonymous';
  }

  function createQueryCanceledError(message = '\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u5df2\u505c\u6b62') {
    const error = new Error(message);
    error.code = 'OPERATIONS_PRICE_DECLARATION_QUERY_CANCELED';
    return error;
  }

  function isQueryCanceledError(error) {
    return Boolean(
      error
      && (
        error.code === 'OPERATIONS_PRICE_DECLARATION_QUERY_CANCELED'
        || error.name === 'AbortError'
      )
    );
  }

  function createQueryJob(owner, payload = {}, options = {}) {
    const normalizedOwner = owner || store.getOwner();
    const ownerKey = getOwnerKey(normalizedOwner);
    const requesterKey = normalizeText(options && options.requesterKey);
    const runId = normalizeText(payload && payload.runId) || `query_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const existingJob = requesterKey
      ? activeQueryJobsByRequesterKey.get(requesterKey)
      : activeQueryJobsByOwnerKey.get(ownerKey);

    if (existingJob && existingJob.canceled !== true) {
      throw new Error('\u5f53\u524d\u5df2\u6709\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u4efb\u52a1\u5728\u8fdb\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u6216\u7b49\u5f85\u5b8c\u6210');
    }

    const job = {
      ownerKey,
      requesterKey,
      runId,
      canceled: false,
      activeControllers: new Set(),
      activeDelayCancels: new Set()
    };

    if (requesterKey) {
      activeQueryJobsByRequesterKey.set(requesterKey, job);
    } else {
      activeQueryJobsByOwnerKey.set(ownerKey, job);
    }
    activeQueryJobsByRunId.set(runId, job);
    return job;
  }

  function getQueryJob(payload = {}, options = {}) {
    const runId = normalizeText(payload && payload.runId);
    const owner = payload && payload.owner ? payload.owner : store.getOwner();
    const ownerKey = getOwnerKey(owner);
    const requesterKey = normalizeText(
      options && options.requesterKey
      || payload && payload.requesterKey
    );

    if (runId && activeQueryJobsByRunId.has(runId)) {
      return activeQueryJobsByRunId.get(runId) || null;
    }

    if (requesterKey && activeQueryJobsByRequesterKey.has(requesterKey)) {
      return activeQueryJobsByRequesterKey.get(requesterKey) || null;
    }

    return activeQueryJobsByOwnerKey.get(ownerKey) || null;
  }

  function clearQueryJob(job) {
    if (!job) {
      return;
    }

    if (job.ownerKey && activeQueryJobsByOwnerKey.get(job.ownerKey) === job) {
      activeQueryJobsByOwnerKey.delete(job.ownerKey);
    }

    if (job.requesterKey && activeQueryJobsByRequesterKey.get(job.requesterKey) === job) {
      activeQueryJobsByRequesterKey.delete(job.requesterKey);
    }

    if (job.runId && activeQueryJobsByRunId.get(job.runId) === job) {
      activeQueryJobsByRunId.delete(job.runId);
    }
  }

  function cancelQueryJobInternally(job) {
    if (!job || job.canceled === true) {
      return false;
    }

    job.canceled = true;

    Array.from(job.activeControllers).forEach((controller) => {
      try {
        controller.abort();
      } catch (_error) {
        // ignore abort failures
      }
    });

    Array.from(job.activeDelayCancels).forEach((cancelDelay) => {
      try {
        cancelDelay();
      } catch (_error) {
        // ignore delay cancel failures
      }
    });

    return true;
  }

  function assertQueryJobActive(job) {
    if (job && job.canceled === true) {
      throw createQueryCanceledError();
    }
  }

  function getOwnerProgressBucket(owner) {
    const ownerKey = getOwnerKey(owner || store.getOwner());

    if (!latestQueryProgressByOwner.has(ownerKey)) {
      latestQueryProgressByOwner.set(ownerKey, {
        latest: null
      });
    }

    return latestQueryProgressByOwner.get(ownerKey);
  }

  function emitQueryProgress(progressContext = {}, payload = {}, progressEmitter) {
    const effectiveEmitProgress = typeof progressEmitter === 'function'
      ? progressEmitter
      : emitProgress;

    if (typeof effectiveEmitProgress !== 'function') {
      return;
    }

    try {
      const nextPayload = {
        source: 'operations-price-declaration',
        runId: normalizeText(progressContext && progressContext.runId),
        shopId: normalizeText(progressContext && progressContext.shopId),
        shopName: normalizeText(progressContext && progressContext.shopName),
        updatedAt: nowIso(),
        ...payload
      };
      const progressBucket = getOwnerProgressBucket(progressContext && progressContext.owner);

      progressBucket.latest = cloneJson(nextPayload);
      effectiveEmitProgress(nextPayload);
    } catch (error) {
      logError('operations_price_declaration_progress_emit_failed', error, {
        runId: normalizeText(progressContext && progressContext.runId),
        shopId: normalizeText(progressContext && progressContext.shopId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  function sleep(delayMs, queryJob) {
    const normalizedDelayMs = Math.max(0, delayMs);

    if (normalizedDelayMs <= 0) {
      assertQueryJobActive(queryJob);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      let cancelDelay = null;
      const finalize = (callback) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = 0;
        }

        if (queryJob && cancelDelay && queryJob.activeDelayCancels.has(cancelDelay)) {
          queryJob.activeDelayCancels.delete(cancelDelay);
        }

        callback();
      };

      cancelDelay = () => {
        finalize(() => {
          reject(createQueryCanceledError());
        });
      };

      if (queryJob) {
        queryJob.activeDelayCancels.add(cancelDelay);

        if (queryJob.canceled === true) {
          cancelDelay();
          return;
        }
      }

      timeoutId = setTimeout(() => {
        finalize(resolve);
      }, normalizedDelayMs);
    });
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  function buildPartitionIdentity(payload) {
    const phoneNumber = normalizeText(payload && payload.phoneNumber).toLowerCase();
    const shopId = normalizeText(payload && payload.shopId).toLowerCase();

    return phoneNumber || shopId || 'default-shop';
  }

  function buildShopPartition(payload) {
    const partitionHash = crypto
      .createHash('sha256')
      .update(buildPartitionIdentity(payload))
      .digest('hex')
      .slice(0, 16);

    return `persist:temu-toolbox-shop-${partitionHash}`;
  }

  async function listAllShopSummaries() {
    if (!shopManagementService) {
      return [];
    }

    let state = null;

    if (typeof shopManagementService.getLocalState === 'function') {
      state = await shopManagementService.getLocalState().catch(() => null);
    }

    if (
      (!state || state.localStateAvailable !== true)
      && typeof shopManagementService.getState === 'function'
    ) {
      state = await shopManagementService.getState();
    }

    return Array.isArray(state && state.shops)
      ? state.shops
        .map((shop) => ({
          shopId: normalizeText(shop && shop.id),
          shopName: normalizeText(shop && shop.shopName),
          shopGroupId: normalizeText(shop && shop.groupId),
          shopGroupName: normalizeText(shop && shop.groupName),
          updatedAt: normalizeText(shop && shop.updatedAt),
          isVisible: isShopParticipating(shop)
        }))
        .filter((shop) => shop.shopId)
      : [];
  }

  async function resolveShopSummaries(preferredShopIds = []) {
    const allShops = await listAllShopSummaries();
    const preferredIds = normalizeSelectedShopIds(preferredShopIds);

    if (preferredIds.length > 0) {
      return preferredIds
        .map((shopId) => allShops.find((shop) => shop.shopId === shopId) || null)
        .filter((shop) => isShopParticipating(shop));
    }

    return allShops.filter((shop) => isShopParticipating(shop));
  }

  async function resolveShopSessionContext(shopDescriptor) {
    const normalizedShopId = normalizeText(
      shopDescriptor && typeof shopDescriptor === 'object'
        ? shopDescriptor.shopId
        : shopDescriptor
    );
    const normalizedShopUpdatedAt = normalizeText(
      shopDescriptor && typeof shopDescriptor === 'object'
        ? shopDescriptor.updatedAt || shopDescriptor.shopUpdatedAt
        : ''
    );

    if (!normalizedShopId) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u3002');
    }

    const controller = getController();

    if (controller && typeof controller.resolveShopSessionContext === 'function') {
      const sessionContext = await controller.resolveShopSessionContext({
        shopId: normalizedShopId,
        shopUpdatedAt: normalizedShopUpdatedAt
      });

      if (sessionContext && normalizeText(sessionContext.partition)) {
        return sessionContext;
      }
    }

    if (!shopManagementService || typeof shopManagementService.getShopRuntimeProfile !== 'function') {
      throw new Error('\u5e97\u94fa\u4f1a\u8bdd\u73af\u5883\u672a\u5c31\u7eea\u3002');
    }

    const runtimeProfile = await shopManagementService.getShopRuntimeProfile({
      shopId: normalizedShopId
    });

    return {
      shopId: normalizedShopId,
      partition: buildShopPartition(runtimeProfile),
      sellerSession: {
        origin: DEFAULT_SELLER_ORIGIN,
        hostname: 'agentseller.temu.com',
        status: '',
        mallId: ''
      }
    };
  }

  function resolveSellerOrigin(sessionContext) {
    const origin = normalizeText(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.origin
    );

    return /^https?:\/\/[^/]+$/i.test(origin)
      ? origin.replace(/\/+$/, '')
      : DEFAULT_SELLER_ORIGIN;
  }

  function resolveSessionPolicyDetails(sessionContext, requestUrl, message) {
    return {
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      partition: normalizeText(sessionContext && sessionContext.partition),
      origin: resolveSellerOrigin(sessionContext),
      requestUrl: normalizeText(requestUrl),
      message
    };
  }

  function resolveShopScopedFetchSession(sessionContext, requestUrl, message) {
    return shopScopedSessionPolicy.resolveSessionForFetch(
      normalizeText(sessionContext && sessionContext.partition),
      resolveSessionPolicyDetails(sessionContext, requestUrl, message)
    );
  }

  function resolveShopScopedCookieSession(sessionContext, requestUrl, message) {
    return shopScopedSessionPolicy.resolveSessionForCookies(
      normalizeText(sessionContext && sessionContext.partition),
      resolveSessionPolicyDetails(sessionContext, requestUrl, message)
    );
  }

  async function warmupSellerSessionContext(sessionContext, payload = {}) {
    const controller = getController();
    const normalizedSessionContext = {
      ...sessionContext,
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      partition: normalizeText(sessionContext && sessionContext.partition)
    };

    if (
      !controller
      || typeof controller.ensureBackgroundSellerCenterGlobalSession !== 'function'
      || !normalizedSessionContext.shopId
    ) {
      return normalizedSessionContext;
    }

    const warmupResult = await controller.ensureBackgroundSellerCenterGlobalSession({
      shopId: normalizedSessionContext.shopId,
      timeoutMs: payload && payload.timeoutMs
    });
    const warmedSessionContext =
      warmupResult && warmupResult.sessionContext && typeof warmupResult.sessionContext === 'object'
        ? warmupResult.sessionContext
        : normalizedSessionContext;

    return {
      ...normalizedSessionContext,
      ...warmedSessionContext,
      shopId: normalizeText(warmedSessionContext && warmedSessionContext.shopId) || normalizedSessionContext.shopId,
      shopName: normalizeText(warmedSessionContext && warmedSessionContext.shopName) || normalizedSessionContext.shopName,
      partition: normalizeText(warmedSessionContext && warmedSessionContext.partition) || normalizedSessionContext.partition,
      sellerSession:
        warmedSessionContext && warmedSessionContext.sellerSession && typeof warmedSessionContext.sellerSession === 'object'
          ? {
            ...(normalizedSessionContext.sellerSession || {}),
            ...warmedSessionContext.sellerSession
          }
          : (normalizedSessionContext.sellerSession || {})
    };
  }

  async function resolveMallIdFromCookie(sessionContext) {
    const origin = resolveSellerOrigin(sessionContext);
    const targetSession = resolveShopScopedCookieSession(
      sessionContext,
      `${origin}/`,
      '\u4ef7\u683c\u7533\u62a5 Cookies \u8bfb\u53d6\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );

    try {
      const cookies = await targetSession.cookies.get({
        url: `${origin}/`
      });
      const matchedCookie = (Array.isArray(cookies) ? cookies : []).find((cookie) => {
        return normalizeText(cookie && cookie.name).toLowerCase() === 'mallid';
      });

      return normalizeText(matchedCookie && matchedCookie.value);
    } catch (error) {
      logError('operations_price_declaration_cookie_mallid_read_failed', error, {
        shopId: normalizeText(sessionContext && sessionContext.shopId),
        partition: normalizeText(sessionContext && sessionContext.partition),
        origin
      });
      return '';
    }
  }

  async function ensureMallId(sessionContext) {
    const directMallId = normalizeText(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.mallId
    );

    if (directMallId) {
      return directMallId;
    }

    const cookieMallId = await resolveMallIdFromCookie(sessionContext);

    if (cookieMallId) {
      if (sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object') {
        sessionContext.sellerSession.mallId = cookieMallId;
      }

      return cookieMallId;
    }

    return '';
  }

  async function executeFetchWithTimeout(
    targetSession,
    requestUrl,
    requestInit,
    timeoutMs = QUERY_REQUEST_TIMEOUT_MS,
    queryJob
  ) {
    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    let timeoutId = 0;

    assertQueryJobActive(queryJob);

    if (queryJob && controller) {
      queryJob.activeControllers.add(controller);

      if (queryJob.canceled === true) {
        try {
          controller.abort();
        } catch (_error) {
          // ignore abort failures
        }
      }
    }

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (controller) {
          try {
            controller.abort();
          } catch (_error) {
            // ignore abort failures
          }
        }

        const timeoutError = new Error('\u4ef7\u683c\u7533\u62a5\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
        timeoutError.timeout = true;
        reject(timeoutError);
      }, Math.max(1000, Number(timeoutMs) || QUERY_REQUEST_TIMEOUT_MS));
    });

    const fetchPromise = (async () => {
      return targetSession.fetch(requestUrl, {
        ...requestInit,
        ...(controller ? { signal: controller.signal } : {})
      });
    })();

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (queryJob && controller && queryJob.activeControllers.has(controller)) {
        queryJob.activeControllers.delete(controller);
      }
    }
  }

  async function executeJsonRequest(sessionContext, endpointPath, payload, options = {}) {
    assertQueryJobActive(options && options.queryJob);
    const origin = resolveSellerOrigin(sessionContext);
    const mallId = await ensureMallId(sessionContext);
    const requestUrl = new URL(endpointPath, origin).toString();
    const targetSession = resolveShopScopedFetchSession(
      sessionContext,
      requestUrl,
      '\u4ef7\u683c\u7533\u62a5\u63a5\u53e3\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );
    const response = await executeFetchWithTimeout(targetSession, requestUrl, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        ...(mallId ? { mallid: mallId } : {}),
        origin,
        pragma: 'no-cache',
        referer: `${origin}${normalizeText(options && options.refererPath) || '/'}`,
        priority: 'u=1, i'
      },
      body: JSON.stringify(payload || {}),
      cache: 'no-store',
      credentials: 'include'
    }, options && options.timeoutMs, options && options.queryJob);
    const responseText = await response.text();
    let parsedPayload = null;

    try {
      parsedPayload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      parsedPayload = null;
    }

    if (
      !parsedPayload
      || typeof parsedPayload !== 'object'
      || parsedPayload.success !== true
      || (
        Object.prototype.hasOwnProperty.call(parsedPayload, 'errorCode')
        && Number(parsedPayload.errorCode) !== 1000000
      )
    ) {
      const message = normalizeText(
        parsedPayload
        && (
          parsedPayload.errorMsg
          || parsedPayload.message
          || parsedPayload.msg
        )
      );
      const error = new Error(
        message || '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38\u3002'
      );

      error.httpStatus = Number(response && response.status) || 0;
      throw error;
    }

    return parsedPayload;
  }

  function buildDefaultQuerySettings(owner) {
    return {
      version: QUERY_SETTINGS_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      perShopDelaySeconds: DEFAULT_QUERY_SETTINGS.perShopDelaySeconds,
      selectedShopIds: DEFAULT_QUERY_SETTINGS.selectedShopIds.slice()
    };
  }

  function buildDefaultQuickCostPresetPayload(owner) {
    return {
      version: QUICK_COST_PRESET_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      entries: []
    };
  }

  function buildDefaultReviewRulesPayload(owner) {
    return {
      version: REVIEW_RULES_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      dailyRule: {
        metric: DEFAULT_REVIEW_RULES.dailyRule.metric,
        threshold: DEFAULT_REVIEW_RULES.dailyRule.threshold
      },
      activityRule: {
        metric: DEFAULT_REVIEW_RULES.activityRule.metric,
        threshold: DEFAULT_REVIEW_RULES.activityRule.threshold
      },
      rejectReason: DEFAULT_REVIEW_RULES.rejectReason
    };
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(
      payload && typeof payload === 'object' && payload.updatedAt
        ? payload.updatedAt
        : ''
    );

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? { source: 'cloud', payload: cloudPayload }
        : { source: 'local', payload: localPayload };
    }

    if (cloudPayload) {
      return { source: 'cloud', payload: cloudPayload };
    }

    if (localPayload) {
      return { source: 'local', payload: localPayload };
    }

    return { source: 'default', payload: null };
  }

  function normalizeQuerySettingsPayload(payload, owner) {
    const baseSettings = buildDefaultQuerySettings(owner);
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};

    return {
      ...baseSettings,
      updatedAt: normalizeText(input && input.updatedAt),
      perShopDelaySeconds: Number(
        normalizePositiveDecimalValue(
          input && input.perShopDelaySeconds,
          DEFAULT_QUERY_SETTINGS.perShopDelaySeconds
        ).toFixed(2)
      ),
      selectedShopIds: normalizeSelectedShopIds(input && input.selectedShopIds)
    };
  }

  function resolveStationIdentityValue(source = {}) {
    const normalizedStationIds = normalizeSelectedStationIds(
      []
        .concat(Array.isArray(source && source.stationIds) ? source.stationIds : [])
        .concat(Array.isArray(source && source.siteIds) ? source.siteIds : [])
    );

    return normalizeText(
      source && (
        source.station
        || source.siteId
        || source.stationId
        || normalizedStationIds[0]
        || source.stationLabel
      )
    );
  }

  function buildQuickCostPresetLegacyKey(shopId, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedSpec = normalizeCostSpecText(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildQuickCostPresetKey(shopId, station, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedSpec = normalizeCostSpecText(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return normalizedStation
      ? `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedSpec}`.toLowerCase()
      : buildQuickCostPresetLegacyKey(normalizedShopId, normalizedSpec);
  }

  function buildQuickCostPresetLookupKeys(shopId, station, spec) {
    return Array.from(new Set([
      buildQuickCostPresetKey(shopId, station, spec),
      buildQuickCostPresetLegacyKey(shopId, spec)
    ].filter(Boolean)));
  }

  function normalizeQuickCostPresetEntry(entry) {
    const shopId = normalizeText(entry && entry.shopId);
    const shopName = normalizeText(entry && entry.shopName);
    const station = resolveStationIdentityValue(entry);
    const stationLabel = normalizeText(entry && entry.stationLabel);
    const spec = normalizeText(entry && entry.spec);
    const costPrice = Number(
      normalizePositiveDecimalValue(entry && entry.costPrice, 0).toFixed(2)
    );
    const key = buildQuickCostPresetKey(shopId, station, spec);

    if (!key || !Number.isFinite(costPrice) || costPrice <= 0) {
      return null;
    }

    return {
      key,
      shopId,
      shopName,
      station,
      stationLabel,
      spec,
      costPrice,
      updatedAt: normalizeText(entry && entry.updatedAt)
    };
  }

  function normalizeQuickCostPresetPayload(payload, owner) {
    const basePayload = buildDefaultQuickCostPresetPayload(owner);
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const entryMap = new Map();

    (Array.isArray(input && input.entries) ? input.entries : []).forEach((entry) => {
      const normalizedEntry = normalizeQuickCostPresetEntry(entry);

      if (!normalizedEntry) {
        return;
      }

      entryMap.set(normalizedEntry.key, normalizedEntry);
    });

    return {
      ...basePayload,
      updatedAt: normalizeText(input && input.updatedAt),
      entries: Array.from(entryMap.values()).sort((left, right) => {
        const leftShopName = normalizeText(left && left.shopName) || normalizeText(left && left.shopId);
        const rightShopName = normalizeText(right && right.shopName) || normalizeText(right && right.shopId);
        const shopCompare = leftShopName.localeCompare(rightShopName, 'zh-CN');

        if (shopCompare !== 0) {
          return shopCompare;
        }

        const shopIdCompare = normalizeText(left && left.shopId).localeCompare(
          normalizeText(right && right.shopId),
          'en'
        );

        if (shopIdCompare !== 0) {
          return shopIdCompare;
        }

        const stationCompare = resolveStationIdentityValue(left).localeCompare(
          resolveStationIdentityValue(right),
          'zh-CN'
        );

        if (stationCompare !== 0) {
          return stationCompare;
        }

        return normalizeText(left && left.spec).localeCompare(
          normalizeText(right && right.spec),
          'zh-CN'
        );
      })
    };
  }

  function normalizeReviewRuleMetric(value) {
    const metric = normalizeText(value);
    return REVIEW_RULE_METRIC[metric] || REVIEW_RULE_METRIC.profitRate;
  }

  function normalizeReviewRuleThreshold(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const numericValue = normalizePositiveDecimalValue(normalizedValue, Number.NaN);
    return Number.isFinite(numericValue)
      ? Number(numericValue.toFixed(2))
      : '';
  }

  function normalizeReviewRulePayload(rule) {
    const input = rule && typeof rule === 'object' && !Array.isArray(rule)
      ? rule
      : {};

    return {
      metric: normalizeReviewRuleMetric(input.metric),
      threshold: normalizeReviewRuleThreshold(input.threshold)
    };
  }

  function normalizeReviewRulesPayload(payload, owner) {
    const basePayload = buildDefaultReviewRulesPayload(owner);
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};

    return {
      ...basePayload,
      updatedAt: normalizeText(input && input.updatedAt),
      dailyRule: normalizeReviewRulePayload(input && input.dailyRule),
      activityRule: normalizeReviewRulePayload(input && input.activityRule),
      rejectReason: normalizeText(input && input.rejectReason).slice(0, 100)
    };
  }

  function filterQuickCostPresetEntries(entries, payload = {}) {
    const requestedShopIds = new Set(
      normalizeSelectedShopIds(payload && payload.shopIds)
    );
    const requestedKeys = new Set(
      (Array.isArray(payload && payload.entries) ? payload.entries : [])
        .flatMap((entry) => buildQuickCostPresetLookupKeys(
          entry && entry.shopId,
          resolveStationIdentityValue(entry),
          entry && entry.spec
        ))
    );

    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const entryShopId = normalizeText(entry && entry.shopId);
      const entryKeys = buildQuickCostPresetLookupKeys(
        entry && entry.shopId,
        resolveStationIdentityValue(entry),
        entry && entry.spec
      );

      if (requestedShopIds.size > 0 && !requestedShopIds.has(entryShopId)) {
        return false;
      }

      if (requestedKeys.size > 0 && !entryKeys.some((entryKey) => requestedKeys.has(entryKey))) {
        return false;
      }

      return true;
    });
  }

  async function getQuerySettings() {
    const configResult = await store.readUserConfig('querySettings');
    const owner = configResult.owner || store.getOwner();
    const newerPayload = pickNewerPayload(configResult.localConfig, configResult.cloudConfig);
    const settings = normalizeQuerySettingsPayload(newerPayload.payload, owner);

    return {
      settings,
      source: newerPayload.source
    };
  }

  async function saveQuerySettings(payload = {}) {
    const owner = store.getOwner();
    const currentSettingsResult = await getQuerySettings();
    const nextSettings = normalizeQuerySettingsPayload({
      ...(currentSettingsResult && currentSettingsResult.settings || {}),
      ...(payload || {}),
      updatedAt: nowIso()
    }, owner);
    const persistResult = await store.writeUserConfig('querySettings', nextSettings);

    return {
      settings: nextSettings,
      source: 'local',
      cloudSynced: persistResult.cloudSynced,
      warning: persistResult.warning || ''
    };
  }

  async function getQuickCostPresetSnapshot(payload = {}) {
    if (
      operationsSharedCostService
      && typeof operationsSharedCostService.getCostSnapshot === 'function'
    ) {
      const response = await operationsSharedCostService.getCostSnapshot({
        shopIds: normalizeSelectedShopIds(payload && payload.shopIds),
        entries: (Array.isArray(payload && payload.entries) ? payload.entries : []).map((entry) => ({
          shopId: entry && entry.shopId,
          station: resolveStationIdentityValue(entry),
          stationLabel: entry && entry.stationLabel,
          spec: entry && entry.spec
        }))
      });

      return {
        version: QUICK_COST_PRESET_VERSION,
        owner: store.getOwner(),
        updatedAt: normalizeText(response && response.updatedAt),
        source: normalizeText(response && response.source) || 'shared-cost',
        entryCount: Math.max(0, normalizeIntegerValue(response && response.entryCount, 0)),
        entries: (Array.isArray(response && response.entries) ? response.entries : []).map((entry) => ({
          shopId: normalizeText(entry && entry.shopId),
          shopName: normalizeText(entry && entry.shopName),
          station: resolveStationIdentityValue(entry),
          stationLabel: normalizeText(entry && entry.stationLabel),
          skuId: normalizeText(entry && entry.skuId),
          skuCode: normalizeText(entry && entry.skuCode),
          skcId: normalizeText(entry && entry.skcId),
          skcCode: normalizeText(entry && entry.skcCode),
          spec: normalizeText(entry && entry.spec),
          costPrice: Number(entry && entry.costPrice) || 0,
          updatedAt: normalizeText(entry && entry.updatedAt)
        }))
      };
    }

    const configResult = await store.readUserConfig('quickCostPresets');
    const owner = configResult.owner || store.getOwner();
    const newerPayload = pickNewerPayload(configResult.localConfig, configResult.cloudConfig);
    const presetPayload = normalizeQuickCostPresetPayload(newerPayload.payload, owner);
    const filteredEntries = filterQuickCostPresetEntries(presetPayload.entries, payload);

    return {
      version: presetPayload.version,
      owner: presetPayload.owner,
      updatedAt: presetPayload.updatedAt,
      source: newerPayload.source,
      entryCount: filteredEntries.length,
        entries: filteredEntries.map((entry) => ({
          shopId: entry.shopId,
          shopName: entry.shopName,
          station: resolveStationIdentityValue(entry),
          stationLabel: normalizeText(entry && entry.stationLabel),
          spec: entry.spec,
          costPrice: entry.costPrice,
          updatedAt: entry.updatedAt
      }))
    };
  }

  async function getReviewRules() {
    const configResult = await store.readUserConfig('reviewRules');
    const owner = configResult.owner || store.getOwner();
    const newerPayload = pickNewerPayload(configResult.localConfig, configResult.cloudConfig);
    const rules = normalizeReviewRulesPayload(newerPayload.payload, owner);

    return {
      rules,
      source: newerPayload.source
    };
  }

  async function saveReviewRules(payload = {}) {
    const owner = store.getOwner();
    const currentRulesResult = await getReviewRules();
    const nextRules = normalizeReviewRulesPayload({
      ...(currentRulesResult && currentRulesResult.rules || {}),
      ...(payload || {}),
      updatedAt: nowIso()
    }, owner);
    const persistResult = await store.writeUserConfig('reviewRules', nextRules);

    return {
      rules: nextRules,
      source: 'local',
      cloudSynced: persistResult.cloudSynced,
      warning: persistResult.warning || ''
    };
  }

  async function saveQuickCostPresetBatch(payload = {}) {
    if (
      operationsSharedCostService
      && typeof operationsSharedCostService.saveCostEntries === 'function'
    ) {
      const normalizedEntries = (Array.isArray(payload && payload.entries) ? payload.entries : [])
        .map((entry) => {
          const shopId = normalizeText(entry && entry.shopId);
          const shopName = normalizeText(entry && entry.shopName);
          const station = resolveStationIdentityValue(entry);
          const stationLabel = normalizeText(entry && entry.stationLabel);
          const spec = normalizeText(entry && entry.spec);
          const rawCostPrice = normalizeText(entry && entry.costPrice);
          const nextCostPrice = rawCostPrice
            ? Number(normalizePositiveDecimalValue(rawCostPrice, 0).toFixed(2))
            : 0;

          return {
            shopId,
            shopName,
            station,
            stationLabel,
            spec,
            costPrice: nextCostPrice > 0 ? nextCostPrice : 0
          };
        })
        .filter((entry) => buildQuickCostPresetKey(entry.shopId, entry.station, entry.spec));
      const persistResult = await operationsSharedCostService.saveCostEntries({
        entries: normalizedEntries.map((entry) => ({
          shopId: entry.shopId,
          shopName: entry.shopName,
          station: entry.station,
          stationLabel: entry.stationLabel,
          spec: entry.spec,
          costPrice: entry.costPrice > 0 ? entry.costPrice : ''
        }))
      });

      return {
        updatedAt: normalizeText(persistResult && persistResult.updatedAt) || nowIso(),
        entryCount: normalizedEntries.length,
        entries: normalizedEntries.map((entry) => ({
          shopId: entry.shopId,
          shopName: entry.shopName,
          station: entry.station,
          stationLabel: entry.stationLabel,
          spec: entry.spec,
          costPrice: entry.costPrice > 0 ? entry.costPrice : ''
        })),
        updatedRowCount: 0,
        updatedShopCount: Math.max(0, normalizeIntegerValue(persistResult && persistResult.updatedShopCount, 0)),
        cloudSynced: persistResult && persistResult.cloudSynced === true,
        warning: normalizeText(persistResult && persistResult.warning)
      };
    }

    const owner = store.getOwner();
    const currentSnapshot = await getQuickCostPresetSnapshot();
    const currentPayload = normalizeQuickCostPresetPayload({
      updatedAt: currentSnapshot && currentSnapshot.updatedAt,
      entries: currentSnapshot && currentSnapshot.entries
    }, owner);
    const nextEntryMap = new Map(
      currentPayload.entries.map((entry) => [buildQuickCostPresetKey(entry.shopId, entry.station, entry.spec), entry])
    );
    const normalizedEntries = (Array.isArray(payload && payload.entries) ? payload.entries : [])
      .map((entry) => {
        const shopId = normalizeText(entry && entry.shopId);
        const shopName = normalizeText(entry && entry.shopName);
        const station = resolveStationIdentityValue(entry);
        const stationLabel = normalizeText(entry && entry.stationLabel);
        const spec = normalizeText(entry && entry.spec);
        const rawCostPrice = normalizeText(entry && entry.costPrice);
        const nextCostPrice = rawCostPrice
          ? Number(normalizePositiveDecimalValue(rawCostPrice, 0).toFixed(2))
          : 0;

        return {
          shopId,
          shopName,
          station,
          stationLabel,
          spec,
          costPrice: nextCostPrice > 0 ? nextCostPrice : 0
        };
      })
      .filter((entry) => {
        return buildQuickCostPresetKey(entry.shopId, entry.station, entry.spec);
      });

    normalizedEntries.forEach((entry) => {
      const entryKey = buildQuickCostPresetKey(entry.shopId, entry.station, entry.spec);

      if (!entryKey) {
        return;
      }

      if (!Number.isFinite(entry.costPrice) || entry.costPrice <= 0) {
        nextEntryMap.delete(entryKey);
        return;
      }

        nextEntryMap.set(entryKey, {
          key: entryKey,
          shopId: entry.shopId,
          shopName: entry.shopName,
          station: entry.station,
          stationLabel: entry.stationLabel,
          spec: entry.spec,
          costPrice: entry.costPrice,
          updatedAt: nowIso()
      });
    });

    const nextPayload = normalizeQuickCostPresetPayload({
      ...currentPayload,
      updatedAt: nowIso(),
      entries: Array.from(nextEntryMap.values())
    }, owner);
    const persistResult = await store.writeUserConfig('quickCostPresets', nextPayload);
    const warnings = [];

    if (persistResult.warning) {
      warnings.push(persistResult.warning);
    }

    return {
      updatedAt: nextPayload.updatedAt,
      entryCount: normalizedEntries.length,
      entries: normalizedEntries.map((entry) => ({
        shopId: entry.shopId,
        shopName: entry.shopName,
        station: entry.station,
        stationLabel: entry.stationLabel,
        spec: entry.spec,
        costPrice: entry.costPrice > 0 ? entry.costPrice : ''
      })),
      updatedRowCount: 0,
      updatedShopCount: 0,
      cloudSynced: persistResult.cloudSynced === true,
      warning: warnings.filter(Boolean).join('\n')
    };
  }

  function normalizeFilters(source = {}) {
    const filters = source && typeof source === 'object' && !Array.isArray(source)
      ? source
      : {};

    return {
      selectedShopIds: normalizeSelectedShopIds(
        filters.selectedShopIds || filters.shopIds
      ),
      stationIds: normalizeSelectedStationIds(
        filters.stationIds
        || (filters.station ? [filters.station] : [])
      ),
      productSource: normalizeText(filters.productSource),
      declarationPriceType: normalizeText(filters.declarationPriceType),
      costState: normalizeText(filters.costState),
      orderNoKeywords: normalizeText(filters.orderNoKeywords),
      productName: normalizeText(filters.productName),
      skcIdKeywords: normalizeText(filters.skcIdKeywords),
      createdDateStart: normalizeText(filters.createdDateStart),
      createdDateEnd: normalizeText(filters.createdDateEnd),
      customizedProduct: normalizeText(filters.customizedProduct),
      goodsNoType: normalizeText(filters.goodsNoType) || 'skc',
      goodsNoKeywords: normalizeText(filters.goodsNoKeywords)
    };
  }

  function buildQueryRequestPayload(filters, pageNo) {
    const normalizedFilters = normalizeFilters(filters);
    const stationIds = normalizeSelectedStationIds(normalizedFilters.stationIds);
    const orderNos = parseKeywordList(normalizedFilters.orderNoKeywords);
    const skcIds = parseKeywordList(normalizedFilters.skcIdKeywords);
    const extCodes = parseKeywordList(normalizedFilters.goodsNoKeywords);
    const createdAtBegin = parseDateTimestamp(normalizedFilters.createdDateStart);
    const createdAtEnd = parseDateTimestamp(normalizedFilters.createdDateEnd, {
      endOfDay: true
    });
    const payload = {
      pageInfo: {
        pageSize: DEFAULT_PAGE_SIZE,
        pageNo: Math.max(1, normalizeIntegerValue(pageNo, 1))
      },
      skcId: skcIds,
      semiOrderSiteIdList: stationIds
        .map((stationId) => normalizeIntegerValue(stationId, Number.NaN))
        .filter((stationId) => Number.isFinite(stationId)),
      priceOrderSn: orderNos
    };
    const statusCode = STATUS_CODE_BY_FILTER[normalizedFilters.productSource];
    const priceTypeCode = PRICE_TYPE_CODE_BY_FILTER[normalizedFilters.declarationPriceType];
    const extCodeType = GOODS_NO_TYPE_CODE_BY_FILTER[normalizedFilters.goodsNoType];

    if (Number.isInteger(statusCode)) {
      payload.status = statusCode;
    }

    if (Number.isInteger(priceTypeCode)) {
      payload.priceType = priceTypeCode;
    }

    if (normalizeText(normalizedFilters.productName)) {
      payload.productName = normalizeText(normalizedFilters.productName);
    }

    if (Number.isFinite(createdAtBegin)) {
      payload.createdAtBegin = createdAtBegin;
    }

    if (Number.isFinite(createdAtEnd)) {
      payload.createdAtEnd = createdAtEnd;
    }

    if (Number.isInteger(extCodeType) && extCodes.length > 0) {
      payload.extCodeType = extCodeType;
      payload.extCodes = extCodes;
    }

    if (normalizedFilters.customizedProduct === 'yes') {
      payload.supportPersonal = 1;
    } else if (normalizedFilters.customizedProduct === 'no') {
      payload.supportPersonal = 0;
    }

    return payload;
  }

  function normalizeMoneyFromApi(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return Number.isInteger(numericValue) || Math.abs(numericValue) >= 1000
      ? Number((numericValue / 100).toFixed(2))
      : Number(numericValue.toFixed(2));
  }

  function resolvePriceTypeFilter(value, fallbackValue = '') {
    const directValue = normalizeScalarText(value);

    if (PRICE_TYPE_CODE_BY_FILTER[directValue] !== undefined) {
      return directValue;
    }

    if (Object.prototype.hasOwnProperty.call(PRICE_TYPE_FILTER_BY_CODE, directValue)) {
      return PRICE_TYPE_FILTER_BY_CODE[directValue];
    }

    if (directValue === '\u65e5\u5e38\u4ef7\u683c') {
      return 'daily';
    }

    if (directValue === '\u6d3b\u52a8\u4ef7\u683c') {
      return 'activity';
    }

    return normalizeText(fallbackValue);
  }

  function resolvePriceTypeLabel(value, fallbackValue = '') {
    const normalizedType = resolvePriceTypeFilter(value, fallbackValue);

    if (normalizedType === 'daily') {
      return '\u65e5\u5e38\u4ef7\u683c';
    }

    if (normalizedType === 'activity') {
      return '\u6d3b\u52a8\u4ef7\u683c';
    }

    const directValue = normalizeScalarText(value);

    if (directValue === '0') {
      return '\u65e5\u5e38\u4ef7\u683c';
    }

    if (directValue === '1' || directValue === '2') {
      return '\u6d3b\u52a8\u4ef7\u683c';
    }

    return '';
  }

  function resolveOperationStatusFilter(value, fallbackValue = '') {
    const directValue = normalizeScalarText(value);

    if (STATUS_CODE_BY_FILTER[directValue] !== undefined) {
      return directValue;
    }

    if (Object.prototype.hasOwnProperty.call(STATUS_FILTER_BY_CODE, directValue)) {
      return STATUS_FILTER_BY_CODE[directValue];
    }

    if (directValue === '\u4ef7\u683c\u7533\u62a5\u4e2d') {
      return 'declaring';
    }

    if (directValue === '\u5f85\u5356\u5bb6\u786e\u8ba4') {
      return 'pendingSeller';
    }

    if (directValue === '\u6210\u529f') {
      return 'success';
    }

    if (directValue === '\u5931\u8d25') {
      return 'failed';
    }

    return normalizeText(fallbackValue);
  }

  function resolveChangeType(originalDeclaredPrice, adjustedDeclaredPrice) {
    if (!Number.isFinite(originalDeclaredPrice) && Number.isFinite(adjustedDeclaredPrice)) {
      return CHANGE_TYPE_BY_FILTER.new;
    }

    if (!Number.isFinite(originalDeclaredPrice) || !Number.isFinite(adjustedDeclaredPrice)) {
      return '';
    }

    if (adjustedDeclaredPrice > originalDeclaredPrice) {
      return CHANGE_TYPE_BY_FILTER.raise;
    }

    if (adjustedDeclaredPrice < originalDeclaredPrice) {
      return CHANGE_TYPE_BY_FILTER.reduce;
    }

    return '';
  }

  function joinTextList(values) {
    return (Array.isArray(values) ? values : [])
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .join(' / ');
  }

  function resolveCostPrice(record, skuItem) {
    const candidates = [
      skuItem && skuItem.supplyPriceCNY,
      record && record.syncPurchasePrice,
      record && record.supplyPriceCNY,
      skuItem && skuItem.suggestSupplyPrice,
      record && record.suggestSupplyPrice
    ];

    for (const candidate of candidates) {
      const normalizedValue = normalizeMoneyFromApi(candidate);

      if (Number.isFinite(normalizedValue) && normalizedValue > 0) {
        return normalizedValue;
      }
    }

    return null;
  }

  function computeProfitRate(row) {
    const adjustedDeclaredPrice = Number(row && row.adjustedDeclaredPrice);

    if (!Number.isFinite(adjustedDeclaredPrice) || adjustedDeclaredPrice <= 0) {
      return null;
    }

    if (!hasCostConfigured(row)) {
      return null;
    }

    const costPrice = Number(row && row.costPrice);

    if (!Number.isFinite(costPrice)) {
      return null;
    }

    const profitRate = computeProfitRateByPrice(adjustedDeclaredPrice, costPrice);
    return Number.isFinite(profitRate)
      ? Number(profitRate.toFixed(2))
      : null;
  }

  function computeProfitAmount(row) {
    const adjustedDeclaredPrice = Number(row && row.adjustedDeclaredPrice);

    if (!Number.isFinite(adjustedDeclaredPrice)) {
      return null;
    }

    if (!hasCostConfigured(row)) {
      return null;
    }

    const costPrice = Number(row && row.costPrice);

    if (!Number.isFinite(costPrice)) {
      return null;
    }

    return Number((adjustedDeclaredPrice - costPrice).toFixed(2));
  }

  function hasCostConfigured(row) {
    if (!row || row.costPrice === '' || row.costPrice === null || row.costPrice === undefined) {
      return false;
    }

    const costPrice = Number(row.costPrice);

    return Number.isFinite(costPrice) && costPrice > 0;
  }

  function resolveReviewMetricValue(row, metric) {
    if (normalizeReviewRuleMetric(metric) === REVIEW_RULE_METRIC.profitAmount) {
      return computeProfitAmount(row);
    }

    const profitRate = Number(row && row.profitRate);
    return Number.isFinite(profitRate) ? profitRate : null;
  }

  function resolveReviewRuleForRow(row, rules) {
    const priceType = resolvePriceTypeFilter(row && row.declarationPriceType);

    if (priceType === 'daily') {
      return normalizeReviewRulePayload(rules && rules.dailyRule);
    }

    if (priceType === 'activity') {
      return normalizeReviewRulePayload(rules && rules.activityRule);
    }

    return null;
  }

  function evaluateReviewDecision(row, rules) {
    const rule = resolveReviewRuleForRow(row, rules);
    const threshold = rule ? normalizeReviewRuleThreshold(rule.threshold) : '';

    if (!rule || threshold === '') {
      return {
        decision: 'skip',
        reason: 'rule-not-configured',
        metric: rule ? rule.metric : '',
        threshold
      };
    }

    const metricValue = resolveReviewMetricValue(row, rule.metric);

    if (!Number.isFinite(metricValue)) {
      return {
        decision: 'reject',
        reason: 'metric-unavailable',
        metric: rule.metric,
        metricValue: null,
        threshold
      };
    }

    return {
      decision: metricValue >= threshold ? 'pass' : 'reject',
      reason: metricValue >= threshold ? 'matched' : 'below-threshold',
      metric: rule.metric,
      metricValue: Number(metricValue),
      threshold
    };
  }

  function normalizeLocalCostPrice(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const costPrice = normalizeDecimalValue(value, Number.NaN);

    return Number.isFinite(costPrice) && costPrice > 0
      ? Number(costPrice.toFixed(2))
      : null;
  }

  function createCostLookupKey(parts) {
    const normalizedParts = (Array.isArray(parts) ? parts : [])
      .map((part) => normalizeText(part).toLowerCase());

    if (normalizedParts.length <= 0 || normalizedParts.some((part) => !part)) {
      return '';
    }

    return normalizedParts.join('\x1f');
  }

  function setCostLookupValue(lookup, parts, costPrice) {
    if (!lookup || typeof lookup.set !== 'function' || !Number.isFinite(costPrice) || costPrice <= 0) {
      return;
    }

    const key = createCostLookupKey(parts);

    if (!key || lookup.has(key)) {
      return;
    }

    lookup.set(key, costPrice);
  }

  function getCostLookupValue(lookup, parts) {
    if (!lookup || typeof lookup.get !== 'function') {
      return null;
    }

    const key = createCostLookupKey(parts);

    if (!key || !lookup.has(key)) {
      return null;
    }

    const costPrice = Number(lookup.get(key));

    return Number.isFinite(costPrice) && costPrice > 0 ? costPrice : null;
  }

  function setCostLookupValueByKey(lookup, key, costPrice) {
    if (!lookup || typeof lookup.set !== 'function' || !Number.isFinite(costPrice) || costPrice <= 0) {
      return;
    }

    const normalizedKey = normalizeText(key);

    if (!normalizedKey || lookup.has(normalizedKey)) {
      return;
    }

    lookup.set(normalizedKey, costPrice);
  }

  function addCostLookupEntry(lookup, entry, costPrice) {
    buildCostLookupCandidates(entry).forEach((candidateKey) => {
      setCostLookupValueByKey(lookup, candidateKey, costPrice);
    });
  }

  function resolveCostLookupByEntry(lookup, entry) {
    for (const candidateKey of buildCostLookupCandidates(entry)) {
      const costPrice = Number(lookup && typeof lookup.get === 'function' ? lookup.get(candidateKey) : Number.NaN);

      if (Number.isFinite(costPrice) && costPrice > 0) {
        return costPrice;
      }
    }

    return null;
  }

  function addSharedCostEntryToLookup(lookup, entry) {
    const costPrice = normalizeLocalCostPrice(entry && entry.costPrice);
    const shopId = normalizeText(entry && entry.shopId);

    if (!shopId || !Number.isFinite(costPrice)) {
      return;
    }

    addCostLookupEntry(lookup, {
      shopId,
      station: resolveStationIdentityValue(entry),
      stationLabel: normalizeText(entry && entry.stationLabel),
      stationIds: Array.isArray(entry && entry.stationIds) ? entry.stationIds : [],
      skuId: entry && entry.skuId,
      skuCode: entry && entry.skuCode,
      skcId: entry && entry.skcId,
      skcCode: entry && entry.skcCode,
      spec: entry && entry.spec
    }, costPrice);
  }

  async function buildLocalProductCostLookup(shopSummaries) {
    const lookup = new Map();
    const shopIds = (Array.isArray(shopSummaries) ? shopSummaries : [])
      .map((shopSummary) => normalizeText(shopSummary && shopSummary.shopId))
      .filter(Boolean);

    if (shopIds.length <= 0) {
      return lookup;
    }

    if (
      operationsSharedCostService
      && typeof operationsSharedCostService.getCostSnapshot === 'function'
    ) {
      try {
        const sharedCostSnapshot = await operationsSharedCostService.getCostSnapshot({
          shopIds
        });

        (Array.isArray(sharedCostSnapshot && sharedCostSnapshot.entries) ? sharedCostSnapshot.entries : []).forEach((entry) => {
          addSharedCostEntryToLookup(lookup, entry);
        });
      } catch (error) {
        logError('operations_price_declaration_shared_cost_lookup_failed', error, {
          shopCount: shopIds.length
        });
      }
    } else {
      try {
        const presetSnapshot = await getQuickCostPresetSnapshot({
          shopIds
        });

        (Array.isArray(presetSnapshot && presetSnapshot.entries) ? presetSnapshot.entries : []).forEach((entry) => {
          addSharedCostEntryToLookup(lookup, entry);
        });
      } catch (error) {
        logError('operations_price_declaration_quick_cost_preset_lookup_failed', error, {
          shopCount: shopIds.length
        });
      }
    }

    return lookup;
  }

  function resolveLocalCostPrice(row, costLookup) {
    return resolveCostLookupByEntry(costLookup, {
      shopId: normalizeText(row && row.shopId),
      station: resolveStationIdentityValue(row),
      stationLabel: normalizeText(row && row.stationLabel),
      stationIds: Array.isArray(row && row.stationIds) ? row.stationIds : [],
      skuId: normalizeText(row && row.productSkuId) || normalizeText(row && row.goodsSkuId),
      skuCode: normalizeText(row && row.skuExtCode) || normalizeText(row && row.skuId),
      skcId: normalizeText(row && row.skcId),
      skcCode: normalizeText(row && row.skcCode),
      spec: normalizeText(row && row.skuAttributeSet)
    });
  }

  function matchesCostStateFilter(row, filters) {
    const costState = normalizeText(filters && filters.costState);

    if (!costState) {
      return true;
    }

    return normalizeText(row && row.costState) === costState;
  }

  function createRowsFromRecord(record, shopSummary, filters = {}, costLookup) {
    const normalizedFilters = normalizeFilters(filters);
    const skuItems = Array.isArray(record && record.skuInfoItemList) && record.skuInfoItemList.length > 0
      ? record.skuInfoItemList
      : [null];
    const stationLabel = joinTextList(
      record && record.siteNameList
    ) || joinTextList(
      record && record.semiHostedBindSiteNameList
    ) || joinTextList(
      record && record.siteIds
    ) || joinTextList(
      record && record.semiHostedBindSiteIdList
    );
    const createdAt = normalizeIntegerValue(
      record && (
        record.orderCreateTime
        || record.operateTime
        || record.gmpOperateTime
      ),
      0
    );

    return skuItems.map((skuItem, index) => {
      const rawPriceType = normalizeScalarText(record && record.priceType);
      const declarationPriceType = resolvePriceTypeFilter(
        rawPriceType,
        normalizedFilters.declarationPriceType
      );
      const originalDeclaredPrice = normalizeMoneyFromApi(
        skuItem && skuItem.priceBeforeExchange !== undefined
          ? skuItem.priceBeforeExchange
          : record && record.priceBeforeExchange
      );
      const adjustedDeclaredPrice = normalizeMoneyFromApi(
        record && record.newSupplyPrice !== undefined
          ? record.newSupplyPrice
          : (
            skuItem && skuItem.price !== undefined
              ? skuItem.price
              : record && record.priceBeforeExchange
          )
      );
      const costPrice = resolveCostPrice(record, skuItem);
      const row = {
        id: [
          normalizeText(shopSummary && shopSummary.shopId),
          normalizeText(record && record.id),
          normalizeText(skuItem && (skuItem.productSkuId || skuItem.goodsSkuId || skuItem.skuExtCode)),
          index
        ].filter(Boolean).join(':'),
        reviewOrderId: normalizeText(record && record.id),
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        orderNo: normalizeText(record && record.priceOrderSn),
        productName: normalizeText(record && record.productName),
        productSourceName: normalizeText(
          record && (
            record.source
            || record.operationSource
            || record.semiManagerSource
          )
        ),
        imageUrl: normalizeText(
          skuItem && skuItem.thumbUrl
          || record && record.image
          || (Array.isArray(record && record.imageList) ? record.imageList[0] : '')
        ),
        skcId: normalizeText(
          record && (
            record.skcId
            || record.goodsSkcId
          )
        ),
        skcCode: normalizeText(record && record.skcExtCode),
        productSkuId: normalizeText(skuItem && skuItem.productSkuId),
        goodsSkuId: normalizeText(skuItem && skuItem.goodsSkuId),
        skuExtCode: normalizeText(skuItem && skuItem.skuExtCode),
        skuId: normalizeText(
          skuItem && (
            skuItem.skuExtCode
            || skuItem.goodsSkuId
            || skuItem.productSkuId
          )
        ),
        skuAttributeSet: normalizeText(
          skuItem && (
            skuItem.spec
            || skuItem.exchangeDesc
          )
        ) || joinTextList(record && record.propertyVOList),
        stationLabel,
        stationIds: Array.isArray(record && record.siteIds)
          ? record.siteIds.map((siteId) => normalizeText(siteId)).filter(Boolean)
          : [],
        priceType: rawPriceType,
        declarationPriceType,
        priceTypeLabel: resolvePriceTypeLabel(rawPriceType, declarationPriceType),
        originalDeclaredPrice,
        adjustedDeclaredPrice,
        currency: normalizeText(
          skuItem && (skuItem.currencyName || skuItem.priceCurrency)
          || record && (record.currencyName || record.priceCurrency)
        ),
        changeType: resolveChangeType(originalDeclaredPrice, adjustedDeclaredPrice),
        reason: normalizeText(record && record.adjustReason),
        failedReason: normalizeText(
          record && (
            record.rejectReason
            || record.failedReason
          )
        ),
        operationStatus: resolveOperationStatusFilter(
          pickFirstDefined(
            record && record.status,
            record && record.orderStatus,
            record && record.operationStatus,
            record && record.priceAdjustStatus
          ),
          normalizedFilters.productSource
        ),
        customizedProduct: record && record.supportPersonal === 1
          ? 'yes'
          : (
            record && record.supportPersonal === 0
              ? 'no'
              : ''
          ),
        createdAt,
        costPrice,
        costState: hasCostConfigured({ costPrice }) ? 'set' : 'unset',
        profitRate: null
      };

      if (!hasCostConfigured(row)) {
        const localCostPrice = resolveLocalCostPrice(row, costLookup);

        if (Number.isFinite(localCostPrice)) {
          row.costPrice = localCostPrice;
        }
      }

      row.costState = hasCostConfigured(row) ? 'set' : 'unset';
      row.profitRate = computeProfitRate(row);
      return row;
    });
  }

  function extractResponseResultPayload(response) {
    if (!response || typeof response !== 'object') {
      return {};
    }

    if (response.result && typeof response.result === 'object') {
      return response.result;
    }

    if (response.res && typeof response.res === 'object') {
      return response.res;
    }

    return {};
  }

  function createBatchRejectOrderKey(shopId, reviewOrderId) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedReviewOrderId = normalizeText(reviewOrderId);

    if (!normalizedShopId || !normalizedReviewOrderId) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedReviewOrderId}`;
  }

  function normalizeBatchRejectRow(row) {
    const adjustedDeclaredPrice = Number(row && row.adjustedDeclaredPrice);
    const costPrice = Number(row && row.costPrice);
    const profitRate = Number(row && row.profitRate);

    return {
      reviewOrderId: normalizeText(
        row && (
          row.reviewOrderId
          || row.recordId
          || row.id
        )
      ),
      orderNo: normalizeText(row && (row.orderNo || row.priceOrderSn)),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      declarationPriceType: normalizeText(row && row.declarationPriceType),
      operationStatus: normalizeText(row && row.operationStatus),
      adjustedDeclaredPrice: Number.isFinite(adjustedDeclaredPrice) ? adjustedDeclaredPrice : null,
      costPrice: Number.isFinite(costPrice) && costPrice > 0 ? costPrice : null,
      profitRate: Number.isFinite(profitRate) ? profitRate : null
    };
  }

  function groupBatchRejectOrders(rows) {
    const orderMap = new Map();
    let invalidRowCount = 0;

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const normalizedRow = normalizeBatchRejectRow(row);
      const orderKey = createBatchRejectOrderKey(
        normalizedRow.shopId,
        normalizedRow.reviewOrderId
      );

      if (!orderKey || !normalizedRow.orderNo) {
        invalidRowCount += 1;
        return;
      }

      if (!orderMap.has(orderKey)) {
        orderMap.set(orderKey, {
          reviewOrderId: normalizedRow.reviewOrderId,
          orderNo: normalizedRow.orderNo,
          shopId: normalizedRow.shopId,
          shopName: normalizedRow.shopName,
          rows: []
        });
      }

      orderMap.get(orderKey).rows.push(normalizedRow);
    });

    return {
      invalidRowCount,
      orders: Array.from(orderMap.values())
    };
  }

  function evaluateBatchRejectOrder(orderEntry, rules) {
    const rows = Array.isArray(orderEntry && orderEntry.rows)
      ? orderEntry.rows
      : [];

    if (
      rows.length <= 0
      || rows.every((row) => normalizeText(row && row.operationStatus) !== 'pendingSeller')
    ) {
      return {
        ...orderEntry,
        decision: 'skip',
        reason: 'status-not-supported'
      };
    }

    const evaluations = rows.map((row) => evaluateReviewDecision(row, rules));

    if (evaluations.some((evaluation) => evaluation && evaluation.decision === 'reject')) {
      return {
        ...orderEntry,
        decision: 'reject',
        reason: 'rule-rejected'
      };
    }

    if (evaluations.some((evaluation) => evaluation && evaluation.decision === 'pass')) {
      return {
        ...orderEntry,
        decision: 'pass',
        reason: 'rule-passed'
      };
    }

    return {
      ...orderEntry,
      decision: 'skip',
      reason: 'rule-not-configured'
    };
  }

  function groupReviewedOrdersByShop(orderEntries, options = {}) {
    const groupMap = new Map();
    const shouldAttachRejectReasons = options && options.attachRejectReasons === true;
    const rejectReason = normalizeText(options && options.rejectReason);

    (Array.isArray(orderEntries) ? orderEntries : []).forEach((orderEntry) => {
      const shopId = normalizeText(orderEntry && orderEntry.shopId);
      const reviewOrderId = normalizeText(orderEntry && orderEntry.reviewOrderId);
      const orderNo = normalizeText(orderEntry && orderEntry.orderNo);

      if (!shopId || !reviewOrderId || !orderNo) {
        return;
      }

      if (!groupMap.has(shopId)) {
        groupMap.set(shopId, {
          shopId,
          shopName: normalizeText(orderEntry && orderEntry.shopName),
          submitOrders: [],
          rejectReasons: {},
          orders: []
        });
      }

      const group = groupMap.get(shopId);

      group.submitOrders.push(reviewOrderId);
      if (shouldAttachRejectReasons && rejectReason) {
        group.rejectReasons[reviewOrderId] = rejectReason;
      }
      group.orders.push({
        reviewOrderId,
        orderNo
      });
    });

    return Array.from(groupMap.values());
  }

  async function submitBatchReviewGroups(orderEntries, options = {}) {
    const requestGroups = groupReviewedOrdersByShop(orderEntries, {
      attachRejectReasons: options && options.attachRejectReasons === true,
      rejectReason: options && options.rejectReason
    });
    const succeededOrderNos = [];
    const succeededReviewOrderIds = [];
    const failedOrders = [];
    const action = normalizeText(options && options.action) || 'reject';
    const batchResult = Number(options && options.batchResult) || REVIEW_BATCH_RESULT.reject;
    const logEventName = normalizeText(options && options.logEventName)
      || 'operations_price_declaration_batch_review_shop_failed';
    const submitFailedMessage = normalizeText(options && options.submitFailedMessage)
      || '\u6279\u91cf\u5ba1\u6838\u63d0\u4ea4\u5931\u8d25';

    for (const requestGroup of requestGroups) {
      const shopSummary = {
        shopId: normalizeText(requestGroup && requestGroup.shopId),
        shopName: normalizeText(requestGroup && requestGroup.shopName)
      };

      try {
        const sessionContext = await resolveShopSessionContext(shopSummary);
        const warmedSessionContext = await warmupSellerSessionContext(sessionContext, {
          timeoutMs: 60000
        });
        const requestPayload = {
          batchResult,
          submitOrders: Array.isArray(requestGroup && requestGroup.submitOrders)
            ? requestGroup.submitOrders
            : []
        };

        if (options && options.attachRejectReasons === true) {
          requestPayload.rejectReasons = requestGroup && requestGroup.rejectReasons
            ? requestGroup.rejectReasons
            : {};
        }

        const response = await executeJsonRequest(
          warmedSessionContext,
          BATCH_REVIEW_ENDPOINT_PATH,
          requestPayload,
          {
            timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
            refererPath: '/'
          }
        );
        const result = extractResponseResultPayload(response);
        const failedOrderMap = result && typeof result.failedOrders === 'object'
          ? result.failedOrders
          : {};

        (Array.isArray(requestGroup && requestGroup.orders) ? requestGroup.orders : []).forEach((orderEntry) => {
          const normalizedOrderNo = normalizeText(orderEntry && orderEntry.orderNo);
          const normalizedReviewOrderId = normalizeText(orderEntry && orderEntry.reviewOrderId);
          const failedByOrderNo = normalizedOrderNo && Object.prototype.hasOwnProperty.call(
            failedOrderMap,
            normalizedOrderNo
          );
          const failedByReviewOrderId = normalizedReviewOrderId && Object.prototype.hasOwnProperty.call(
            failedOrderMap,
            normalizedReviewOrderId
          );
          const failedReason = failedByOrderNo
            ? normalizeText(failedOrderMap[normalizedOrderNo])
            : (
              failedByReviewOrderId
                ? normalizeText(failedOrderMap[normalizedReviewOrderId])
                : ''
            );

          if (!normalizedOrderNo || !normalizedReviewOrderId) {
            return;
          }

          if (failedByOrderNo || failedByReviewOrderId) {
            failedOrders.push({
              action,
              shopId: normalizeText(requestGroup && requestGroup.shopId),
              shopName: normalizeText(requestGroup && requestGroup.shopName),
              reviewOrderId: normalizedReviewOrderId,
              orderNo: normalizedOrderNo,
              reason: failedReason || submitFailedMessage
            });
            return;
          }

          succeededOrderNos.push(normalizedOrderNo);
          succeededReviewOrderIds.push(normalizedReviewOrderId);
        });
      } catch (error) {
        const errorMessage = normalizeText(error && error.message) || submitFailedMessage;

        logError(logEventName, error, {
          shopId: normalizeText(requestGroup && requestGroup.shopId),
          requestedOrderCount: Array.isArray(requestGroup && requestGroup.submitOrders)
            ? requestGroup.submitOrders.length
            : 0,
          action
        });

        (Array.isArray(requestGroup && requestGroup.orders) ? requestGroup.orders : []).forEach((orderEntry) => {
          failedOrders.push({
            action,
            shopId: normalizeText(requestGroup && requestGroup.shopId),
            shopName: normalizeText(requestGroup && requestGroup.shopName),
            reviewOrderId: normalizeText(orderEntry && orderEntry.reviewOrderId),
            orderNo: normalizeText(orderEntry && orderEntry.orderNo),
            reason: errorMessage
          });
        });
      }
    }

    return {
      requestGroups,
      succeededOrderNos: Array.from(new Set(succeededOrderNos)),
      succeededReviewOrderIds: Array.from(new Set(succeededReviewOrderIds)),
      failedOrders
    };
  }

  async function querySingleShopRecords(payload = {}, options = {}) {
    const filters = normalizeFilters(payload && payload.filters);
    const shopSummary = payload && payload.shopSummary
      ? payload.shopSummary
      : {
        shopId: normalizeText(payload && payload.shopId),
        shopName: normalizeText(payload && payload.shopName),
        shopGroupId: '',
        shopGroupName: '',
        updatedAt: normalizeText(payload && payload.shopUpdatedAt)
      };
    const queryJob = options && options.queryJob;
    const perShopDelayMs = Math.max(
      0,
      Math.round(normalizePositiveDecimalValue(options && options.perShopDelaySeconds, 0) * 1000)
    );
    const progressContext = {
      owner: options && options.owner,
      runId: normalizeText(options && options.runId),
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName)
    };
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : emitProgress;
    const rows = [];
    let total = 0;
    let totalPages = 0;
    let currentPage = 1;
    let sessionContext = await resolveShopSessionContext(shopSummary);

    sessionContext = {
      ...sessionContext,
      shopId: normalizeText(sessionContext && sessionContext.shopId) || normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName) || normalizeText(shopSummary && shopSummary.shopName)
    };

    emitQueryProgress(progressContext, {
      phase: 'warming-session',
      totalShops: 1,
      completedShops: 0,
      failedShops: 0,
      canceledShops: 0,
      activeShops: 1,
      currentShopId: progressContext.shopId,
      currentShopName: progressContext.shopName,
      message: '\u6b63\u5728\u68c0\u67e5\u5e97\u94fa\u767b\u5f55\u4f1a\u8bdd...'
    }, progressEmitter);

    const warmedSessionContext = await warmupSellerSessionContext(sessionContext, {
      timeoutMs: 60000
    });

    while (true) {
      assertQueryJobActive(queryJob);

      emitQueryProgress(progressContext, {
        phase: 'requesting-page',
        pageNum: currentPage,
        totalPages: Math.max(totalPages, currentPage),
        pageSize: DEFAULT_PAGE_SIZE,
        fetchedItemCount: 0,
        accumulatedItemCount: rows.length,
        estimatedTotal: total,
        rowCount: rows.length,
        totalShops: 1,
        completedShops: 0,
        failedShops: 0,
        canceledShops: 0,
        activeShops: 1,
        currentShopId: progressContext.shopId,
        currentShopName: progressContext.shopName,
        message: `\u6b63\u5728\u67e5\u8be2\u7b2c ${currentPage} \u9875`
      }, progressEmitter);

      const response = await executeJsonRequest(
        warmedSessionContext,
        QUERY_ENDPOINT_PATH,
        buildQueryRequestPayload(filters, currentPage),
        {
          timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
          refererPath: '/',
          queryJob
        }
      );
      const result = response && response.result && typeof response.result === 'object'
        ? response.result
        : {};
      const pageRecords = Array.isArray(result.list) ? result.list : [];
      const pageRows = pageRecords
        .flatMap((record) => createRowsFromRecord(record, shopSummary, filters, options && options.costLookup))
        .filter((row) => matchesCostStateFilter(row, filters));

      total = Math.max(0, normalizeIntegerValue(result.total, pageRecords.length));
      totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
      rows.push(...pageRows);

      if (typeof options.onPageRows === 'function' && pageRows.length > 0) {
        options.onPageRows(pageRows, {
          shopId: progressContext.shopId,
          shopName: progressContext.shopName,
          pageNum: currentPage,
          totalPages,
          total
        });
      }

      emitQueryProgress(progressContext, {
        phase: 'page-fetched',
        pageNum: currentPage,
        totalPages,
        pageSize: DEFAULT_PAGE_SIZE,
        fetchedItemCount: pageRows.length,
        accumulatedItemCount: rows.length,
        estimatedTotal: total,
        rowCount: rows.length,
        totalShops: 1,
        completedShops: 0,
        failedShops: 0,
        canceledShops: 0,
        activeShops: 1,
        currentShopId: progressContext.shopId,
        currentShopName: progressContext.shopName,
        message: `\u5df2\u83b7\u53d6 ${rows.length} \u6761SKU\u8bb0\u5f55`
      }, progressEmitter);

      if (currentPage >= totalPages) {
        break;
      }

      if (perShopDelayMs > 0) {
        emitQueryProgress(progressContext, {
          phase: 'delaying',
          pageNum: currentPage,
          totalPages,
          pageSize: DEFAULT_PAGE_SIZE,
          fetchedItemCount: pageRows.length,
          accumulatedItemCount: rows.length,
          estimatedTotal: total,
          rowCount: rows.length,
          delayMs: perShopDelayMs,
          delaySeconds: Number((perShopDelayMs / 1000).toFixed(2)),
          totalShops: 1,
          completedShops: 0,
          failedShops: 0,
          canceledShops: 0,
          activeShops: 1,
          currentShopId: progressContext.shopId,
          currentShopName: progressContext.shopName
        }, progressEmitter);
        await sleep(perShopDelayMs, queryJob);
      }

      currentPage += 1;
    }

    emitQueryProgress(progressContext, {
      phase: 'completed',
      pageNum: totalPages,
      totalPages,
      pageSize: DEFAULT_PAGE_SIZE,
      fetchedItemCount: 0,
      accumulatedItemCount: rows.length,
      estimatedTotal: total,
      rowCount: rows.length,
      totalShops: 1,
      completedShops: 1,
      failedShops: 0,
      canceledShops: 0,
      activeShops: 0,
      currentShopId: progressContext.shopId,
      currentShopName: progressContext.shopName
    }, progressEmitter);

    return {
      shopId: progressContext.shopId,
      shopName: progressContext.shopName,
      total,
      rowCount: rows.length,
      rows
    };
  }

  function buildMultiShopScopeName(shopSummaries) {
    const normalizedShopSummaries = Array.isArray(shopSummaries) ? shopSummaries : [];

    if (normalizedShopSummaries.length === 1) {
      return normalizeText(normalizedShopSummaries[0] && normalizedShopSummaries[0].shopName)
        || normalizeText(normalizedShopSummaries[0] && normalizedShopSummaries[0].shopId);
    }

    return `\u5df2\u9009 ${normalizedShopSummaries.length} \u5bb6\u5e97\u94fa`;
  }

  function buildAggregateProgressPayload(progressContext, aggregate, payload = {}) {
    const sourcePayload = payload && typeof payload === 'object' ? payload : {};

    return {
      phase: normalizeText(sourcePayload.phase),
      pageNum: Math.max(0, normalizeIntegerValue(sourcePayload.pageNum, 0)),
      totalPages: Math.max(0, normalizeIntegerValue(sourcePayload.totalPages, 0)),
      pageSize: Math.max(0, normalizeIntegerValue(sourcePayload.pageSize, 0)),
      fetchedItemCount: Math.max(0, normalizeIntegerValue(sourcePayload.fetchedItemCount, 0)),
      accumulatedItemCount: Math.max(0, normalizeIntegerValue(sourcePayload.accumulatedItemCount, 0)),
      estimatedTotal: Math.max(0, normalizeIntegerValue(sourcePayload.estimatedTotal, 0)),
      rowCount: Math.max(0, normalizeIntegerValue(sourcePayload.rowCount, aggregate && aggregate.rowCount)),
      totalShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.totalShops, 0)),
      completedShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.completedShops, 0)),
      failedShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.failedShops, 0)),
      canceledShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.canceledShops, 0)),
      activeShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.activeShops, 0)),
      delaySeconds: Math.max(0, normalizePositiveDecimalValue(sourcePayload.delaySeconds, 0)),
      delayMs: Math.max(0, normalizeIntegerValue(sourcePayload.delayMs, 0)),
      currentShopId: normalizeText(sourcePayload.currentShopId) || normalizeText(aggregate && aggregate.currentShopId),
      currentShopName: normalizeText(sourcePayload.currentShopName) || normalizeText(aggregate && aggregate.currentShopName),
      message: normalizeText(sourcePayload.message),
      shopId: '',
      shopName: normalizeText(progressContext && progressContext.shopName)
    };
  }

  async function queryRows(payload = {}, options = {}) {
    const runId = normalizeText(payload && payload.runId) || `query_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const owner = store.getOwner();
    const filters = normalizeFilters(payload && payload.filters);
    const queryFilters = {
      ...filters,
      costState: ''
    };
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : emitProgress;
    const queryJob = createQueryJob(owner, {
      runId
    }, {
      requesterKey: options && options.requesterKey
    });

    try {
      const querySettingsResult = await getQuerySettings();
      const perShopDelaySeconds = normalizePositiveDecimalValue(
        payload && payload.perShopDelaySeconds,
        querySettingsResult && querySettingsResult.settings
          ? querySettingsResult.settings.perShopDelaySeconds
          : DEFAULT_QUERY_SETTINGS.perShopDelaySeconds
      );
      const shopSummaries = await resolveShopSummaries(
        normalizeSelectedShopIds(payload && payload.shopIds || queryFilters.selectedShopIds)
      );
      const normalizedShopSummaries = shopSummaries.filter((shopSummary) => {
        return normalizeText(shopSummary && shopSummary.shopId);
      });

      if (normalizedShopSummaries.length <= 0) {
        throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u67e5\u8be2\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u3002');
      }

      const localCostLookup = await buildLocalProductCostLookup(normalizedShopSummaries);
      const progressContext = {
        owner,
        runId,
        shopId: '',
        shopName: buildMultiShopScopeName(normalizedShopSummaries)
      };
      const aggregate = {
        totalShops: normalizedShopSummaries.length,
        completedShops: 0,
        failedShops: 0,
        canceledShops: 0,
        activeShops: 0,
        currentShopId: '',
        currentShopName: '',
        rowCount: 0,
        total: 0,
        failedShopNames: [],
        failedShopReasons: []
      };
      const aggregateRows = [];
      let nextShopIndex = 0;

      emitQueryProgress(progressContext, buildAggregateProgressPayload(progressContext, aggregate, {
        phase: 'preparing',
        message: `\u5df2\u9009 ${aggregate.totalShops} \u5bb6\u5e97\u94fa\uff0c\u6b63\u5728\u51c6\u5907\u67e5\u8be2`
      }), progressEmitter);

      const emitAggregateProgress = (payloadOverrides = {}) => {
        emitQueryProgress(
          progressContext,
          buildAggregateProgressPayload(progressContext, aggregate, payloadOverrides),
          progressEmitter
        );
      };

      const runSingleShopWorker = async () => {
        while (nextShopIndex < normalizedShopSummaries.length) {
          assertQueryJobActive(queryJob);
          const currentIndex = nextShopIndex;
          const shopSummary = normalizedShopSummaries[currentIndex];

          nextShopIndex += 1;

          if (!shopSummary) {
            return;
          }

          aggregate.activeShops += 1;
          aggregate.currentShopId = normalizeText(shopSummary.shopId);
          aggregate.currentShopName = normalizeText(shopSummary.shopName);

          emitAggregateProgress({
            phase: 'starting',
            currentShopId: shopSummary.shopId,
            currentShopName: shopSummary.shopName,
            message: `\u6b63\u5728\u67e5\u8be2 ${normalizeText(shopSummary.shopName) || normalizeText(shopSummary.shopId)}`
          });

          try {
            const response = await querySingleShopRecords({
              shopSummary,
              filters: queryFilters
            }, {
              owner,
              runId,
              queryJob,
              perShopDelaySeconds,
              costLookup: localCostLookup,
              emitProgress(shopProgress) {
                const normalizedShopProgress = shopProgress && typeof shopProgress === 'object'
                  ? shopProgress
                  : null;

                if (
                  !normalizedShopProgress
                  || normalizeText(normalizedShopProgress.phase) === 'completed'
                  || normalizeText(normalizedShopProgress.phase) === 'failed'
                  || normalizeText(normalizedShopProgress.phase) === 'canceled'
                ) {
                  return;
                }

                emitAggregateProgress({
                  phase: normalizeText(normalizedShopProgress.phase),
                  pageNum: normalizedShopProgress.pageNum,
                  totalPages: normalizedShopProgress.totalPages,
                  pageSize: normalizedShopProgress.pageSize,
                  fetchedItemCount: normalizedShopProgress.fetchedItemCount,
                  accumulatedItemCount: normalizedShopProgress.accumulatedItemCount,
                  estimatedTotal: normalizedShopProgress.estimatedTotal,
                  rowCount: aggregateRows.length,
                  delaySeconds: normalizedShopProgress.delaySeconds,
                  delayMs: normalizedShopProgress.delayMs,
                  currentShopId: shopSummary.shopId,
                  currentShopName: shopSummary.shopName,
                  message: normalizeText(normalizedShopProgress.message)
                });
              },
              onPageRows(pageRows) {
                if (Array.isArray(pageRows) && pageRows.length > 0) {
                  aggregateRows.push(...pageRows);
                  aggregate.rowCount = aggregateRows.length;
                }
              }
            });

            aggregate.completedShops += 1;
            aggregate.total += normalizeIntegerValue(response && response.total, 0);
            aggregate.rowCount = aggregateRows.length;

            if (aggregate.completedShops < aggregate.totalShops && queryJob.canceled !== true) {
              emitAggregateProgress({
                phase: 'starting',
                rowCount: aggregateRows.length,
                currentShopId: shopSummary.shopId,
                currentShopName: shopSummary.shopName,
                message: `${normalizeText(shopSummary.shopName) || normalizeText(shopSummary.shopId)} \u67e5\u8be2\u5b8c\u6210\uff0c\u7ee7\u7eed\u5904\u7406\u5176\u4ed6\u5e97\u94fa`
              });
            }
          } catch (error) {
            if (isQueryCanceledError(error)) {
              return;
            }

            aggregate.failedShops += 1;
            aggregate.failedShopNames.push(
              normalizeText(shopSummary.shopName) || normalizeText(shopSummary.shopId)
            );
            aggregate.failedShopReasons.push(
              normalizeText(error && error.message) || '\u672a\u77e5\u9519\u8bef'
            );

            if ((aggregate.completedShops + aggregate.failedShops) < aggregate.totalShops) {
              emitAggregateProgress({
                phase: 'starting',
                rowCount: aggregateRows.length,
                currentShopId: shopSummary.shopId,
                currentShopName: shopSummary.shopName,
                message: `${normalizeText(shopSummary.shopName) || normalizeText(shopSummary.shopId)} \u67e5\u8be2\u5931\u8d25\uff0c\u7ee7\u7eed\u5904\u7406\u5176\u4ed6\u5e97\u94fa`
              });
            }
          } finally {
            aggregate.activeShops = Math.max(0, aggregate.activeShops - 1);
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENT_SHOP_QUERIES, normalizedShopSummaries.length) },
          () => runSingleShopWorker()
        )
      );

      const sortedRows = aggregateRows.sort((left, right) => {
        return normalizeIntegerValue(right && right.createdAt, 0) - normalizeIntegerValue(left && left.createdAt, 0);
      });

      if (queryJob.canceled === true) {
        aggregate.canceledShops = Math.max(
          0,
          aggregate.totalShops - aggregate.completedShops - aggregate.failedShops
        );

        emitAggregateProgress({
          phase: 'canceled',
          rowCount: sortedRows.length,
          message: '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u5df2\u505c\u6b62'
        });

        return {
          updatedAt: nowIso(),
          runId,
          rows: sortedRows,
          rowCount: sortedRows.length,
          total: aggregate.total,
          totalShops: aggregate.totalShops,
          completedShops: aggregate.completedShops,
          failedShops: aggregate.failedShops,
          canceledShops: aggregate.canceledShops,
          canceled: true,
          warning: '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u5df2\u505c\u6b62'
        };
      }

      if (aggregate.completedShops <= 0 && aggregate.failedShops > 0 && sortedRows.length <= 0) {
        const error = new Error(
          aggregate.failedShopNames.length > 0
            ? `\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u5931\u8d25\uff1a${aggregate.failedShopNames.map((name, idx) => {
                const reason = normalizeText(aggregate.failedShopReasons && aggregate.failedShopReasons[idx]);
                return reason ? `${name}(${reason})` : name;
              }).join('\u3001')}`
            : '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u5931\u8d25'
        );
        throw error;
      }

      const warning = aggregate.failedShopNames.length > 0
        ? `\u4ee5\u4e0b\u5e97\u94fa\u67e5\u8be2\u5931\u8d25\uff1a${aggregate.failedShopNames.join('\u3001')}`
        : '';

      emitAggregateProgress({
        phase: 'completed',
        rowCount: sortedRows.length,
        message: warning
          ? `\u67e5\u8be2\u5b8c\u6210\uff0c${aggregate.failedShopNames.length} \u5bb6\u5e97\u94fa\u5931\u8d25`
          : '\u67e5\u8be2\u5b8c\u6210'
      });

      log('operations_price_declaration_query_succeeded', {
        runId,
        totalShops: aggregate.totalShops,
        completedShops: aggregate.completedShops,
        failedShops: aggregate.failedShops,
        rowCount: sortedRows.length,
        total: aggregate.total,
        perShopDelaySeconds,
        firstRowPriceTypeSample: sortedRows[0]
          ? {
            priceType: normalizeScalarText(sortedRows[0].priceType),
            declarationPriceType: normalizeScalarText(sortedRows[0].declarationPriceType),
            priceTypeLabel: normalizeScalarText(sortedRows[0].priceTypeLabel),
            orderNo: normalizeText(sortedRows[0].orderNo)
          }
          : null
      });

      return {
        updatedAt: nowIso(),
        runId,
        rows: sortedRows,
        rowCount: sortedRows.length,
        total: aggregate.total,
        totalShops: aggregate.totalShops,
        completedShops: aggregate.completedShops,
        failedShops: aggregate.failedShops,
        canceledShops: 0,
        canceled: false,
        warning
      };
    } catch (error) {
      if (!isQueryCanceledError(error)) {
        logError('operations_price_declaration_query_failed', error, {
          runId,
          shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0
        });
      }

      throw error;
    } finally {
      clearQueryJob(queryJob);
    }
  }

  async function getQueryProgressSnapshot(payload = {}) {
    const owner = payload && payload.owner ? payload.owner : store.getOwner();
    const progressBucket = getOwnerProgressBucket(owner);
    const runId = normalizeText(payload && payload.runId);
    const latest = progressBucket && progressBucket.latest
      ? cloneJson(progressBucket.latest)
      : null;

    if (runId && normalizeText(latest && latest.runId) && normalizeText(latest && latest.runId) !== runId) {
      return {
        progress: null,
        source: 'memory',
        updatedAt: ''
      };
    }

    return {
      progress: latest,
      source: latest ? 'memory' : 'default',
      updatedAt: normalizeText(latest && latest.updatedAt)
    };
  }

  async function cancelQueryJob(payload = {}, options = {}) {
    const job = getQueryJob({
      runId: payload && payload.runId,
      owner: payload && payload.owner,
      requesterKey: payload && payload.requesterKey
    }, {
      requesterKey: options && options.requesterKey
    });

    if (!job) {
      return {
        canceled: false,
        runId: normalizeText(payload && payload.runId)
      };
    }

    return {
      canceled: cancelQueryJobInternally(job),
      runId: normalizeText(job && job.runId)
    };
  }

  async function batchRejectRows(payload = {}) {
    const owner = store.getOwner();
    const currentRulesResult = await getReviewRules();
    const rules = normalizeReviewRulesPayload({
      ...(currentRulesResult && currentRulesResult.rules || {}),
      ...(payload && payload.rules || {}),
      rejectReason: normalizeText(
        payload && (
          payload.rejectReason
          || payload.reason
        )
      ) || normalizeText(
        currentRulesResult
        && currentRulesResult.rules
        && currentRulesResult.rules.rejectReason
      )
    }, owner);
    const rejectReason = normalizeText(rules && rules.rejectReason);
    const groupedRows = groupBatchRejectOrders(payload && payload.rows);
    const orderEvaluations = groupedRows.orders.map((orderEntry) => {
      return evaluateBatchRejectOrder(orderEntry, rules);
    });
    const passOrders = orderEvaluations.filter((orderEntry) => orderEntry.decision === 'pass');
    const rejectedOrders = orderEvaluations.filter((orderEntry) => orderEntry.decision === 'reject');
    const skippedOrders = orderEvaluations.filter((orderEntry) => orderEntry.decision === 'skip');

    if (rejectedOrders.length > 0 && !rejectReason) {
      throw new Error('\u8bf7\u5148\u8bbe\u7f6e\u62d2\u7edd\u8bf4\u660e\u540e\u518d\u6267\u884c\u6279\u91cf\u62d2\u7edd\u3002');
    }

    if (rejectReason && rejectReason.length > 100) {
      throw new Error('\u62d2\u7edd\u8bf4\u660e\u6700\u591a100\u4e2a\u5b57\u7b26\u3002');
    }

    if (groupedRows.orders.length <= 0) {
      throw new Error('\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u7684\u4ef7\u683c\u7533\u62a5\u8bb0\u5f55\u3002');
    }

    const approveResult = await submitBatchReviewGroups(passOrders, {
      action: 'approve',
      batchResult: REVIEW_BATCH_RESULT.pass,
      logEventName: 'operations_price_declaration_batch_approve_shop_failed',
      submitFailedMessage: '\u540c\u610f\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25'
    });
    const rejectResult = await submitBatchReviewGroups(rejectedOrders, {
      action: 'reject',
      batchResult: REVIEW_BATCH_RESULT.reject,
      attachRejectReasons: true,
      rejectReason,
      logEventName: 'operations_price_declaration_batch_reject_shop_failed',
      submitFailedMessage: '\u6279\u91cf\u62d2\u7edd\u5931\u8d25'
    });
    const failedOrders = [
      ...approveResult.failedOrders,
      ...rejectResult.failedOrders
    ];
    const warningParts = [];

    if (skippedOrders.length > 0) {
      warningParts.push(`\u5df2\u8df3\u8fc7 ${skippedOrders.length} \u6761\u4e0d\u5728\u5f85\u5356\u5bb6\u786e\u8ba4\u6216\u672a\u914d\u7f6e\u89c4\u5219\u7684\u8bb0\u5f55`);
    }

    if (groupedRows.invalidRowCount > 0) {
      warningParts.push(`\u5df2\u5ffd\u7565 ${groupedRows.invalidRowCount} \u6761\u7f3a\u5c11\u5355\u53f7\u6216\u8bb0\u5f55ID\u7684\u8bb0\u5f55`);
    }

    const failedApproveOrderCount = approveResult.failedOrders.length;
    const failedRejectOrderCount = rejectResult.failedOrders.length;

    if (failedApproveOrderCount > 0) {
      warningParts.push(`\u5171 ${failedApproveOrderCount} \u6761\u540c\u610f\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25`);
    }

    if (failedRejectOrderCount > 0) {
      warningParts.push(`\u5171 ${failedRejectOrderCount} \u6761\u62d2\u7edd\u63d0\u4ea4\u5931\u8d25`);
    }

    log('operations_price_declaration_batch_reject_completed', {
      totalRowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      passOrderCount: passOrders.length,
      skippedOrderCount: skippedOrders.length,
      requestedPassOrderCount: passOrders.length,
      approvedOrderCount: approveResult.succeededReviewOrderIds.length,
      requestedRejectOrderCount: rejectedOrders.length,
      rejectedOrderCount: rejectResult.succeededReviewOrderIds.length,
      failedApproveOrderCount,
      failedRejectOrderCount
    });

    return {
      updatedAt: nowIso(),
      rules,
      rejectReason,
      totalRowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      eligibleOrderCount: passOrders.length + rejectedOrders.length,
      passOrderCount: passOrders.length,
      skippedOrderCount: skippedOrders.length,
      invalidRowCount: groupedRows.invalidRowCount,
      requestedPassOrderCount: passOrders.length,
      approvedOrderCount: approveResult.succeededReviewOrderIds.length,
      succeededApprovedReviewOrderIds: approveResult.succeededReviewOrderIds,
      succeededApprovedOrderNos: approveResult.succeededOrderNos,
      failedApproveOrderCount,
      requestedRejectOrderCount: rejectedOrders.length,
      rejectedOrderCount: rejectResult.succeededReviewOrderIds.length,
      succeededRejectedReviewOrderIds: rejectResult.succeededReviewOrderIds,
      succeededRejectedOrderNos: rejectResult.succeededOrderNos,
      succeededReviewOrderIds: rejectResult.succeededReviewOrderIds,
      failedRejectOrderCount,
      succeededOrderNos: rejectResult.succeededOrderNos,
      failedOrders,
      warning: warningParts.join('\uff1b')
    };
  }

  return {
    async getQuerySettings() {
      return getQuerySettings();
    },
    async saveQuerySettings(payload = {}) {
      return saveQuerySettings(payload);
    },
    async getQuickCostPresetSnapshot(payload = {}) {
      return getQuickCostPresetSnapshot(payload);
    },
    async saveQuickCostPresetBatch(payload = {}) {
      return saveQuickCostPresetBatch(payload);
    },
    async getReviewRules() {
      return getReviewRules();
    },
    async saveReviewRules(payload = {}) {
      return saveReviewRules(payload);
    },
    async batchRejectRows(payload = {}) {
      return batchRejectRows(payload);
    },
    async queryRows(payload = {}, options = {}) {
      return queryRows(payload, options);
    },
    async cancelQueryJob(payload = {}, options = {}) {
      return cancelQueryJob(payload, options);
    },
    async getQueryProgressSnapshot(payload = {}) {
      return getQueryProgressSnapshot(payload);
    }
  };
}

module.exports = {
  createOperationsPriceDeclarationService
};
