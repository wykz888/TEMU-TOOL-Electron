const crypto = require('node:crypto');
const {
  normalizeText,
  isShopParticipating
} = require('../shopManagement/common');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');
const {
  normalizeCostSpecText
} = require('./operationsCostIdentity');
const {
  createMarketingToolsSingleProductCouponStore
} = require('./marketingToolsSingleProductCouponStore');

const FEATURE_ENTRY_ID = 'marketing-tools-single-product-coupon';
const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const COUPON_GOODS_SCROLL_ENDPOINT_PATH = '/api/kiana/gamblers/marketing/coupon/scrollCouponGoods';
const COUPON_AGREEMENT_INFO_ENDPOINT_PATH = '/api/kiana/gamblers/marketing/coupon/agree/info';
const COUPON_BATCH_CREATE_ENDPOINT_PATH = '/api/kiana/gamblers/marketing/coupon/batch/create';
const QUERY_REQUEST_TIMEOUT_MS = 30000;
const CREATE_REQUEST_TIMEOUT_MS = 30000;
const MAX_CONCURRENT_SHOP_QUERIES = 5;
const DEFAULT_COUPON_AGREEMENT_ID = 13092187623577;
const DEFAULT_ROW_COUNT = 50;
const QUERY_CANCELED_ERROR_CODE = 'MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_QUERY_CANCELED';
const MAX_PRODUCT_ID_COUNT = 200;
const SKU_PREVIEW_LIMIT = 12;
const BATCH_COUPON_SETTINGS_VERSION = 1;
const COUPON_BATCH_CREATE_CHUNK_SIZE = 100;
const PRODUCT_ID_FIELD_BY_TYPE = Object.freeze({
  spu: 'productIds',
  skc: 'productSkcIds',
  sku: 'productSkuIds'
});

function createMarketingToolsSingleProductCouponService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  getShopWindowBrowserController,
  runtimeLogger
}) {
  const shopScopedSessionPolicy = createShopScopedSessionPolicy({
    runtimeLogger,
    scope: FEATURE_ENTRY_ID
  });
  const store = createMarketingToolsSingleProductCouponStore({
    sessionStore,
    featureCenterProfileService
  });
  const activeQueryJobsByRunId = new Map();
  const activeQueryJobsByRequesterKey = new Map();
  const featureEntry =
    featureCenterProfileService
    && typeof featureCenterProfileService.getEntryById === 'function'
      ? featureCenterProfileService.getEntryById(FEATURE_ENTRY_ID)
      : null;

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

  function nowIso() {
    return new Date().toISOString();
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    const localUpdatedAt = Date.parse(localPayload && localPayload.updatedAt || '');
    const cloudUpdatedAt = Date.parse(cloudPayload && cloudPayload.updatedAt || '');
    const normalizedLocalUpdatedAt = Number.isFinite(localUpdatedAt) ? localUpdatedAt : 0;
    const normalizedCloudUpdatedAt = Number.isFinite(cloudUpdatedAt) ? cloudUpdatedAt : 0;

    if (localPayload && cloudPayload) {
      return normalizedCloudUpdatedAt > normalizedLocalUpdatedAt
        ? { source: 'cloud', payload: cloudPayload }
        : { source: 'local', payload: localPayload };
    }

    if (cloudPayload) {
      return {
        source: 'cloud',
        payload: cloudPayload
      };
    }

    if (localPayload) {
      return {
        source: 'local',
        payload: localPayload
      };
    }

    return {
      source: 'default',
      payload: null
    };
  }

  function ensureFeatureEntryRegistered() {
    if (!featureEntry) {
      throw new Error('\u5355\u54c1\u4f18\u60e0\u5238\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u6267\u884c\u67e5\u8be2\u3002');
    }

    return featureEntry;
  }

  function pickFirstTextValue(...values) {
    for (const value of values) {
      const normalizedValue = normalizeText(value);

      if (normalizedValue) {
        return normalizedValue;
      }
    }

    return '';
  }

  function normalizeIntegerValue(value, fallback = 0) {
    const numericValue = Number.parseInt(value, 10);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  function normalizePositiveIntegerValue(value, fallback = 0) {
    const normalizedValue = normalizeIntegerValue(value, fallback);
    return normalizedValue >= 0 ? normalizedValue : fallback;
  }

  async function mapWithConcurrency(items, concurrency, worker) {
    const targetItems = Array.isArray(items) ? items : [];

    if (targetItems.length <= 0) {
      return [];
    }

    const workerCount = Math.max(
      1,
      Math.min(
        targetItems.length,
        normalizePositiveIntegerValue(concurrency, 1) || 1
      )
    );
    const results = new Array(targetItems.length);
    let cursor = 0;

    async function consume() {
      while (true) {
        const currentIndex = cursor;

        if (currentIndex >= targetItems.length) {
          return;
        }

        cursor += 1;
        results[currentIndex] = await worker(targetItems[currentIndex], currentIndex);
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => consume()));
    return results;
  }

  function normalizeBatchCouponTypes(values) {
    const normalizedValues = Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter((value) => value === '1' || value === '2')
    ));

    return normalizedValues.length > 0
      ? normalizedValues
      : ['1', '2'];
  }

  function normalizeBatchCouponAmountMode(value) {
    const normalizedValue = normalizeText(value);
    const allowedValues = new Set([
      'min-eligible-price',
      'max-eligible-price',
      'suggested-amount',
      'fixed-discount',
      'cost-profit-rate',
      'sale-profit-rate'
    ]);

    return allowedValues.has(normalizedValue)
      ? normalizedValue
      : 'suggested-amount';
  }

  function normalizeBatchCouponProfitFloorLogic(value) {
    return normalizeText(value).toLowerCase() === 'or'
      ? 'or'
      : 'and';
  }

  function normalizeBatchCouponRateValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue)) {
      return '';
    }

    return String(Number(numericValue.toFixed(2)));
  }

  function formatBatchCouponDateTimeValue(value) {
    const timestamp = Date.parse(normalizeText(value));

    if (!Number.isFinite(timestamp)) {
      return '';
    }

    const date = new Date(timestamp);
    const pad = (number) => String(number).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function buildDefaultBatchCouponSettingsPayload(owner) {
    const baseDate = new Date();
    const startDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0
    );
    const endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 89);
    endDate.setHours(23, 59, 0, 0);

    return {
      version: BATCH_COUPON_SETTINGS_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      couponTypes: ['1', '2'],
      couponName: '',
      couponQuantity: '200',
      startTime: formatBatchCouponDateTimeValue(startDate.toISOString()),
      endTime: formatBatchCouponDateTimeValue(endDate.toISOString()),
      amountMode: 'suggested-amount',
      amountFixedDiscount: '',
      amountCostProfitRate: '',
      amountSaleProfitRate: '',
      profitFloorLogic: 'and',
      profitFloorRate: '',
      profitFloorValue: ''
    };
  }

  function normalizeBatchCouponSettingsPayload(payload, owner) {
    const basePayload = buildDefaultBatchCouponSettingsPayload(owner);
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};

    return {
      ...basePayload,
      updatedAt: normalizeText(input && input.updatedAt),
      couponTypes: normalizeBatchCouponTypes(input && input.couponTypes),
      couponName: normalizeText(input && input.couponName),
      couponQuantity: normalizeText(input && input.couponQuantity) || basePayload.couponQuantity,
      startTime: formatBatchCouponDateTimeValue(input && input.startTime) || basePayload.startTime,
      endTime: formatBatchCouponDateTimeValue(input && input.endTime) || basePayload.endTime,
      amountMode: normalizeBatchCouponAmountMode(input && input.amountMode),
      amountFixedDiscount: normalizeBatchCouponRateValue(input && input.amountFixedDiscount),
      amountCostProfitRate: normalizeBatchCouponRateValue(input && input.amountCostProfitRate),
      amountSaleProfitRate: normalizeBatchCouponRateValue(input && input.amountSaleProfitRate),
      profitFloorLogic: normalizeBatchCouponProfitFloorLogic(input && input.profitFloorLogic),
      profitFloorRate: normalizeBatchCouponRateValue(input && input.profitFloorRate),
      profitFloorValue: normalizeBatchCouponRateValue(input && input.profitFloorValue)
    };
  }

  function normalizeProductIdType(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return PRODUCT_ID_FIELD_BY_TYPE[normalizedValue]
      ? normalizedValue
      : 'spu';
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    return Array.from(new Set(
      (Array.isArray(selectedShopIds) ? selectedShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function parseKeywordList(value) {
    return Array.from(new Set(
      normalizeText(value)
        .split(/[\s,\uff0c;\uff1b]+/)
        .map((item) => normalizeText(item))
        .filter(Boolean)
    ));
  }

  function parseIntegerKeywordList(value, fieldLabel) {
    const keywords = parseKeywordList(value);

    if (keywords.length <= 0) {
      return [];
    }

    const invalidKeywords = keywords.filter((keyword) => !/^\d+$/.test(keyword));

    if (invalidKeywords.length > 0) {
      throw new Error(
        `${fieldLabel}\u4ec5\u652f\u6301\u6570\u5b57\uff0c\u8bf7\u68c0\u67e5\uff1a${invalidKeywords.slice(0, 5).join('\u3001')}`
      );
    }

    return keywords
      .slice(0, MAX_PRODUCT_ID_COUNT)
      .map((keyword) => Number.parseInt(keyword, 10))
      .filter((keyword) => Number.isFinite(keyword) && keyword > 0);
  }

  function normalizeIdArray(values) {
    return Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    ));
  }

  function normalizePriceCentValue(value, fieldLabel) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return null;
    }

    const numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error(`${fieldLabel}\u4ec5\u652f\u6301\u5927\u4e8e\u6216\u7b49\u4e8e0\u7684\u6570\u5b57\u3002`);
    }

    return Math.round(numericValue * 100);
  }

  function normalizeQueryRequest(payload = {}) {
    const shopIds = normalizeSelectedShopIds(payload && payload.shopIds);

    if (shopIds.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u67e5\u8be2\u3002');
    }

    const productIdType = normalizeProductIdType(payload && payload.productIdType);
    const productIds = parseIntegerKeywordList(
      payload && payload.productIdKeywords,
      '\u5546\u54c1ID'
    );
    const categoryIds = normalizeIdArray(payload && payload.categoryIds);
    const minDailyPrice = normalizePriceCentValue(
      payload && payload.dailyPriceMin,
      '\u65e5\u5e38\u7533\u62a5\u4ef7\u6700\u5c0f\u503c'
    );
    const maxDailyPrice = normalizePriceCentValue(
      payload && payload.dailyPriceMax,
      '\u65e5\u5e38\u7533\u62a5\u4ef7\u6700\u5927\u503c'
    );

    if (
      minDailyPrice !== null
      && maxDailyPrice !== null
      && minDailyPrice > maxDailyPrice
    ) {
      throw new Error('\u65e5\u5e38\u7533\u62a5\u4ef7\u6700\u5c0f\u503c\u4e0d\u80fd\u5927\u4e8e\u6700\u5927\u503c\u3002');
    }

    return {
      runId: normalizeText(payload && payload.runId) || `marketing_coupon_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      shopIds,
      productIdType,
      productIds,
      categoryIds,
      minDailyPrice,
      maxDailyPrice,
      rowCount: DEFAULT_ROW_COUNT
    };
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

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
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
          platformShopId: normalizeText(shop && shop.platformShopId),
          updatedAt: normalizeText(shop && shop.updatedAt),
          isVisible: isShopParticipating(shop)
        }))
        .filter((shop) => shop.shopId)
      : [];
  }

  async function resolveSelectedShops(selectedShopIds) {
    const allShops = await listAllShopSummaries();
    const shopMap = new Map(allShops.map((shop) => [shop.shopId, shop]));
    const resolvedShops = [];
    const unresolved = [];

    selectedShopIds.forEach((shopId) => {
      const shop = shopMap.get(shopId);

      if (!shop) {
        unresolved.push({
          shopId,
          shopName: shopId,
          message: '\u5e97\u94fa\u4e0d\u5b58\u5728\u6216\u5df2\u5220\u9664'
        });
        return;
      }

      if (shop.isVisible !== true) {
        unresolved.push({
          shopId: shop.shopId,
          shopName: shop.shopName || shop.shopId,
          message: '\u5f53\u524d\u5e97\u94fa\u5df2\u5173\u95ed'
        });
        return;
      }

      resolvedShops.push(shop);
    });

    return {
      resolvedShops,
      unresolved
    };
  }

  async function resolveShopSessionContext(shopSummary) {
    const normalizedShopId = normalizeText(shopSummary && shopSummary.shopId);
    const normalizedShopUpdatedAt = normalizeText(shopSummary && shopSummary.updatedAt);

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
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      partition: buildShopPartition(runtimeProfile),
      sellerSession: {
        origin: DEFAULT_SELLER_ORIGIN,
        hostname: 'agentseller.temu.com',
        status: '',
        mallId: pickFirstTextValue(
          shopSummary && shopSummary.platformShopId,
          runtimeProfile && runtimeProfile.platformShopId
        )
      }
    };
  }

  function applyKnownMallIdToSessionContext(sessionContext, shopSummary) {
    const knownMallId = pickFirstTextValue(
      shopSummary && shopSummary.platformShopId,
      sessionContext && sessionContext.mallId,
      sessionContext && sessionContext.sellerSession && sessionContext.sellerSession.mallId
    );

    if (!knownMallId || !sessionContext || typeof sessionContext !== 'object') {
      return sessionContext;
    }

    sessionContext.mallId = normalizeText(sessionContext.mallId) || knownMallId;

    if (!sessionContext.sellerSession || typeof sessionContext.sellerSession !== 'object') {
      sessionContext.sellerSession = {};
    }

    sessionContext.sellerSession.mallId = normalizeText(sessionContext.sellerSession.mallId) || knownMallId;
    return sessionContext;
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
      warmupResult && warmedSessionContextIsObject(warmupResult.sessionContext)
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

  function warmedSessionContextIsObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  async function resolveMallIdFromCookie(sessionContext) {
    const origin = resolveSellerOrigin(sessionContext);
    const targetSession = resolveShopScopedCookieSession(
      sessionContext,
      `${origin}/`,
      '\u5355\u54c1\u4f18\u60e0\u5238 Cookies \u8bfb\u53d6\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );

    try {
      const cookies = await targetSession.cookies.get({
        url: `${origin}/`
      });
      const mallIdCookie = (Array.isArray(cookies) ? cookies : []).find((cookie) => {
        return normalizeText(cookie && cookie.name).toLowerCase() === 'mallid';
      });

      return normalizeText(mallIdCookie && mallIdCookie.value);
    } catch (error) {
      logError('marketing_tools_single_product_coupon_cookie_mallid_read_failed', error, {
        shopId: normalizeText(sessionContext && sessionContext.shopId),
        partition: normalizeText(sessionContext && sessionContext.partition),
        origin
      });
      return '';
    }
  }

  async function ensureMallId(sessionContext) {
    const directMallId = pickFirstTextValue(
      sessionContext && sessionContext.mallId,
      sessionContext && sessionContext.sellerSession && sessionContext.sellerSession.mallId
    );

    if (directMallId) {
      if (sessionContext && typeof sessionContext === 'object') {
        sessionContext.mallId = directMallId;
      }

      if (sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object') {
        sessionContext.sellerSession.mallId = directMallId;
      }

      return directMallId;
    }

    const cookieMallId = await resolveMallIdFromCookie(sessionContext);

    if (cookieMallId) {
      if (sessionContext && typeof sessionContext === 'object') {
        sessionContext.mallId = cookieMallId;
      }

      if (sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object') {
        sessionContext.sellerSession.mallId = cookieMallId;
      }
    }

    return cookieMallId;
  }

  function createQueryCanceledError(message = '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5df2\u505c\u6b62') {
    const error = new Error(message);
    error.code = QUERY_CANCELED_ERROR_CODE;
    return error;
  }

  function isQueryCanceledError(error) {
    return Boolean(
      error
      && (
        error.code === QUERY_CANCELED_ERROR_CODE
        || error.name === 'AbortError'
      )
    );
  }

  function createQueryJob(payload = {}, options = {}) {
    const runId = normalizeText(payload && payload.runId) || `marketing_coupon_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const requesterKey = normalizeText(options && options.requesterKey);
    const existingJob = requesterKey
      ? activeQueryJobsByRequesterKey.get(requesterKey)
      : null;

    if (existingJob && existingJob.canceled !== true) {
      throw new Error('\u5f53\u524d\u5df2\u6709\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u4efb\u52a1\u5728\u8fdb\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u6216\u7b49\u5f85\u5b8c\u6210\u3002');
    }

    const job = {
      runId,
      requesterKey,
      canceled: false,
      activeControllers: new Set()
    };

    activeQueryJobsByRunId.set(runId, job);

    if (requesterKey) {
      activeQueryJobsByRequesterKey.set(requesterKey, job);
    }

    return job;
  }

  function getQueryJob(payload = {}, options = {}) {
    const runId = normalizeText(payload && payload.runId);
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

    return null;
  }

  function clearQueryJob(job) {
    if (!job) {
      return;
    }

    if (job.runId && activeQueryJobsByRunId.get(job.runId) === job) {
      activeQueryJobsByRunId.delete(job.runId);
    }

    if (job.requesterKey && activeQueryJobsByRequesterKey.get(job.requesterKey) === job) {
      activeQueryJobsByRequesterKey.delete(job.requesterKey);
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

    return true;
  }

  function assertQueryJobActive(job) {
    if (job && job.canceled === true) {
      throw createQueryCanceledError();
    }
  }

  function emitProgress(progressEmitter, payload = {}) {
    if (typeof progressEmitter !== 'function') {
      return;
    }

    try {
      progressEmitter({
        source: FEATURE_ENTRY_ID,
        updatedAt: nowIso(),
        ...payload
      });
    } catch (error) {
      logError('marketing_tools_single_product_coupon_progress_emit_failed', error, {
        runId: normalizeText(payload && payload.runId),
        phase: normalizeText(payload && payload.phase),
        shopId: normalizeText(payload && payload.currentShopId)
      });
    }
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
          // ignore abort failure
        }
      }
    }

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (controller) {
          try {
            controller.abort();
          } catch (_error) {
            // ignore abort failure
          }
        }

        const timeoutError = new Error('\u5355\u54c1\u4f18\u60e0\u5238\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
        timeoutError.timeout = true;
        reject(timeoutError);
      }, Math.max(1000, Number(timeoutMs) || QUERY_REQUEST_TIMEOUT_MS));
    });

    const fetchPromise = targetSession.fetch(requestUrl, {
      ...requestInit,
      ...(controller ? { signal: controller.signal } : {})
    });

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      if (queryJob && queryJob.canceled === true) {
        throw createQueryCanceledError();
      }

      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (queryJob && controller && queryJob.activeControllers.has(controller)) {
        queryJob.activeControllers.delete(controller);
      }
    }
  }

  function buildResponsePreview(text, maxLength = 260) {
    const normalizedText = normalizeText(text);

    if (!normalizedText || normalizedText.length <= maxLength) {
      return normalizedText;
    }

    return `${normalizedText.slice(0, Math.max(0, maxLength - 1))}\u2026`;
  }

  async function executeJsonRequest(sessionContext, endpointPath, payload, options = {}) {
    assertQueryJobActive(options && options.queryJob);
    const origin = resolveSellerOrigin(sessionContext);
    const mallId = await ensureMallId(sessionContext);

    if (!mallId) {
      throw new Error('\u5f53\u524d\u5e97\u94fa\u672a\u83b7\u53d6\u5230 Mallid\uff0c\u8bf7\u5148\u786e\u8ba4 Seller Central \u767b\u5f55\u72b6\u6001\u3002');
    }

    const requestUrl = new URL(endpointPath, origin).toString();
    const targetSession = resolveShopScopedFetchSession(
      sessionContext,
      requestUrl,
      '\u5355\u54c1\u4f18\u60e0\u5238\u63a5\u53e3\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );
    const response = await executeFetchWithTimeout(targetSession, requestUrl, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        mallid: mallId,
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
      const parseError = new Error(
        buildResponsePreview(responseText) || '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u8fd4\u56de\u4e86\u65e0\u6cd5\u89e3\u6790\u7684\u54cd\u5e94\u3002'
      );
      parseError.responseTextPreview = buildResponsePreview(responseText);
      throw parseError;
    }

    if (!response.ok) {
      const httpError = new Error(
        pickFirstTextValue(
          parsedPayload && parsedPayload.errorMsg,
          parsedPayload && parsedPayload.message,
          parsedPayload && parsedPayload.msg
        ) || `\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u8bf7\u6c42\u5931\u8d25\uff08HTTP ${response.status}\uff09`
      );
      httpError.status = response.status;
      httpError.responseTextPreview = buildResponsePreview(responseText);
      throw httpError;
    }

    const numericErrorCode = Number(parsedPayload && parsedPayload.errorCode);
    const success =
      parsedPayload
      && (
        parsedPayload.success === true
        || numericErrorCode === 1000000
      );

    if (!success) {
      const apiError = new Error(
        pickFirstTextValue(
          parsedPayload && parsedPayload.errorMsg,
          parsedPayload && parsedPayload.message,
          parsedPayload && parsedPayload.msg
        ) || '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5931\u8d25'
      );
      apiError.responseTextPreview = buildResponsePreview(responseText);
      throw apiError;
    }

    return parsedPayload;
  }

  function buildQueryBody(request, searchScrollContext) {
    const payload = {
      rowCount: request.rowCount,
      couponType: 1,
      searchScrollContext: searchScrollContext || null
    };

    if (request.categoryIds.length > 0) {
      payload.catIds = request.categoryIds;
    }

    if (request.minDailyPrice !== null) {
      payload.minDailyPrice = request.minDailyPrice;
    }

    if (request.maxDailyPrice !== null) {
      payload.maxDailyPrice = request.maxDailyPrice;
    }

    if (request.productIds.length > 0) {
      payload[PRODUCT_ID_FIELD_BY_TYPE[request.productIdType]] = request.productIds;
    }

    return payload;
  }

  function normalizeAmount(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.trunc(numericValue) : null;
  }

  function normalizeMoneyYuanValue(value, unit = 'auto') {
    const normalizedValueText = normalizeText(value);

    if (!normalizedValueText) {
      return null;
    }

    const numericValue = Number(normalizedValueText);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    if (unit === 'cent') {
      return Number((numericValue / 100).toFixed(2));
    }

    if (unit === 'yuan') {
      return Number(numericValue.toFixed(2));
    }

    return normalizedValueText.includes('.')
      ? Number(numericValue.toFixed(2))
      : (Math.abs(numericValue) >= 1000
        ? Number((numericValue / 100).toFixed(2))
        : Number(numericValue.toFixed(2)));
  }

  function normalizeMoneyCentValueFromYuan(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return Math.max(0, Math.round(numericValue * 100));
  }

  function resolveFirstPositiveMoneyValue(candidates) {
    for (const candidate of (Array.isArray(candidates) ? candidates : [])) {
      const normalizedValue = normalizeMoneyYuanValue(
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
          ? candidate.value
          : candidate,
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
          ? candidate.unit
          : 'auto'
      );

      if (Number.isFinite(normalizedValue) && normalizedValue > 0) {
        return normalizedValue;
      }
    }

    return null;
  }

  function resolveCouponGoodsSitePriceEntry(sitePriceList, station, stationLabel) {
    const entries = Array.isArray(sitePriceList) ? sitePriceList : [];
    const normalizedStation = normalizeText(station);
    const normalizedStationLabel = normalizeText(stationLabel);

    if (entries.length <= 0) {
      return null;
    }

    const matchedEntry = entries.find((entry) => {
      const siteId = normalizeText(entry && (entry.siteId || entry.site || entry.station));
      const siteName = normalizeText(entry && (entry.siteName || entry.stationLabel));

      return (normalizedStation && siteId === normalizedStation)
        || (normalizedStationLabel && siteName === normalizedStationLabel);
    });

    return matchedEntry || entries[0];
  }

  function resolveCouponGoodsCostPrice(rawRow, skc, sku, siteEntry) {
    const station = normalizeText(siteEntry && siteEntry.siteId);
    const stationLabel = normalizeText(siteEntry && siteEntry.siteName) || station;
    const skuSitePriceEntry = resolveCouponGoodsSitePriceEntry(
      sku && sku.siteSupplierPriceList,
      station,
      stationLabel
    );
    const skcSitePriceEntry = resolveCouponGoodsSitePriceEntry(
      skc && skc.siteSupplierPriceList,
      station,
      stationLabel
    );
    const rowSitePriceEntry = resolveCouponGoodsSitePriceEntry(
      rawRow && rawRow.siteSupplierPriceList,
      station,
      stationLabel
    );

    return resolveFirstPositiveMoneyValue([
      { value: skuSitePriceEntry && skuSitePriceEntry.costPrice, unit: 'yuan' },
      { value: skuSitePriceEntry && skuSitePriceEntry.purchasePrice, unit: 'yuan' },
      { value: skuSitePriceEntry && skuSitePriceEntry.supplierPriceValue, unit: 'cent' },
      { value: skuSitePriceEntry && skuSitePriceEntry.supplierPrice, unit: 'auto' },
      { value: sku && sku.costPrice, unit: 'yuan' },
      { value: sku && sku.purchasePrice, unit: 'yuan' },
      { value: sku && sku.syncPurchasePrice, unit: 'yuan' },
      { value: sku && sku.supplyPriceCNY, unit: 'auto' },
      { value: sku && sku.suggestSupplyPrice, unit: 'auto' },
      { value: sku && sku.supplierPriceValue, unit: 'cent' },
      { value: sku && sku.supplierPrice, unit: 'auto' },
      { value: skcSitePriceEntry && skcSitePriceEntry.costPrice, unit: 'yuan' },
      { value: skcSitePriceEntry && skcSitePriceEntry.purchasePrice, unit: 'yuan' },
      { value: skcSitePriceEntry && skcSitePriceEntry.supplierPriceValue, unit: 'cent' },
      { value: skcSitePriceEntry && skcSitePriceEntry.supplierPrice, unit: 'auto' },
      { value: skc && skc.costPrice, unit: 'yuan' },
      { value: skc && skc.purchasePrice, unit: 'yuan' },
      { value: skc && skc.syncPurchasePrice, unit: 'yuan' },
      { value: skc && skc.supplyPriceCNY, unit: 'auto' },
      { value: skc && skc.suggestSupplyPrice, unit: 'auto' },
      { value: skc && skc.supplierPriceValue, unit: 'cent' },
      { value: skc && skc.supplierPrice, unit: 'auto' },
      { value: rowSitePriceEntry && rowSitePriceEntry.costPrice, unit: 'yuan' },
      { value: rowSitePriceEntry && rowSitePriceEntry.purchasePrice, unit: 'yuan' },
      { value: rowSitePriceEntry && rowSitePriceEntry.supplierPriceValue, unit: 'cent' },
      { value: rowSitePriceEntry && rowSitePriceEntry.supplierPrice, unit: 'auto' },
      { value: rawRow && rawRow.costPrice, unit: 'yuan' },
      { value: rawRow && rawRow.purchasePrice, unit: 'yuan' },
      { value: rawRow && rawRow.syncPurchasePrice, unit: 'yuan' },
      { value: rawRow && rawRow.supplyPriceCNY, unit: 'auto' },
      { value: rawRow && rawRow.suggestSupplyPrice, unit: 'auto' },
      { value: rawRow && rawRow.supplierPriceValue, unit: 'cent' },
      { value: rawRow && rawRow.supplierPrice, unit: 'auto' }
    ]);
  }

  function formatCurrencyAmount(amount, currency = 'CNY') {
    const normalizedAmount = normalizeAmount(amount);

    if (normalizedAmount === null) {
      return '';
    }

    const currencyPrefix = normalizeText(currency).toUpperCase() === 'CNY'
      ? '\u00a5'
      : `${normalizeText(currency).toUpperCase()} `;
    const sign = normalizedAmount < 0 ? '-' : '';
    const absoluteValue = Math.abs(normalizedAmount) / 100;

    return `${sign}${currencyPrefix}${absoluteValue.toFixed(2)}`;
  }

  function formatCurrencyRange(minAmount, maxAmount, currency = 'CNY') {
    const normalizedMinAmount = normalizeAmount(minAmount);
    const normalizedMaxAmount = normalizeAmount(maxAmount);

    if (normalizedMinAmount === null && normalizedMaxAmount === null) {
      return '';
    }

    if (normalizedMinAmount !== null && normalizedMaxAmount !== null) {
      return normalizedMinAmount === normalizedMaxAmount
        ? formatCurrencyAmount(normalizedMinAmount, currency)
        : `${formatCurrencyAmount(normalizedMinAmount, currency)}~${formatCurrencyAmount(normalizedMaxAmount, currency)}`;
    }

    return formatCurrencyAmount(
      normalizedMinAmount !== null ? normalizedMinAmount : normalizedMaxAmount,
      currency
    );
  }

  function normalizeSiteSummary(siteList) {
    const siteMap = new Map();

    (Array.isArray(siteList) ? siteList : []).forEach((site) => {
      const siteId = normalizeText(site && site.siteId);
      const siteName = normalizeText(site && site.siteName);
      const dedupeKey = siteId || siteName;

      if (!dedupeKey || siteMap.has(dedupeKey)) {
        return;
      }

      siteMap.set(dedupeKey, {
        siteId,
        siteName
      });
    });

    const siteEntries = Array.from(siteMap.values());

    return {
      siteIds: siteEntries.map((entry) => entry.siteId).filter(Boolean),
      siteNames: siteEntries.map((entry) => entry.siteName).filter(Boolean),
      siteText: siteEntries
        .map((entry) => entry.siteName || entry.siteId)
        .filter(Boolean)
        .join(' / ')
    };
  }

  function normalizeCategorySummary(rawRow) {
    const categoryEntries = [
      rawRow && rawRow.leafCat,
      rawRow && rawRow.cat10,
      rawRow && rawRow.cat9,
      rawRow && rawRow.cat8,
      rawRow && rawRow.cat7,
      rawRow && rawRow.cat6,
      rawRow && rawRow.cat5,
      rawRow && rawRow.cat4,
      rawRow && rawRow.cat3,
      rawRow && rawRow.cat2,
      rawRow && rawRow.cat1
    ];

    for (const categoryEntry of categoryEntries) {
      const categoryId = normalizeText(categoryEntry && categoryEntry.catId);
      const categoryName = normalizeText(categoryEntry && categoryEntry.catName);

      if (categoryId || categoryName) {
        return {
          categoryId,
          categoryName
        };
      }
    }

    return {
      categoryId: '',
      categoryName: ''
    };
  }

  function buildCategoryTrailText(rawRow) {
    const categoryNames = [];

    [
      rawRow && rawRow.cat1,
      rawRow && rawRow.cat2,
      rawRow && rawRow.cat3,
      rawRow && rawRow.cat4,
      rawRow && rawRow.cat5,
      rawRow && rawRow.cat6,
      rawRow && rawRow.cat7,
      rawRow && rawRow.cat8,
      rawRow && rawRow.cat9,
      rawRow && rawRow.cat10,
      rawRow && rawRow.leafCat
    ].forEach((categoryEntry) => {
      const categoryName = normalizeText(categoryEntry && categoryEntry.catName);

      if (categoryName && !categoryNames.includes(categoryName)) {
        categoryNames.push(categoryName);
      }
    });

    return categoryNames.join(' / ');
  }

  function formatPropertiesText(properties) {
    const entries = Object.entries(
      properties && typeof properties === 'object' && !Array.isArray(properties)
        ? properties
        : {}
    )
      .map(([key, value]) => {
        const normalizedKey = normalizeText(key);
        const normalizedValue = normalizeText(value);

        if (normalizedKey && normalizedValue) {
          return `${normalizedKey}:${normalizedValue}`;
        }

        return normalizedValue || normalizedKey;
      })
      .filter(Boolean);

    return entries.join(', ');
  }

  function buildSkuPreview(skcList, currency) {
    const skuInfoLines = [];
    let totalLineCount = 0;
    let skuCount = 0;
    let skcCount = 0;

    (Array.isArray(skcList) ? skcList : []).forEach((skc) => {
      const skcId = normalizeText(skc && skc.skcId);
      const skuList = Array.isArray(skc && skc.skuList) ? skc.skuList : [];

      if (skcId) {
        skcCount += 1;
      }

      if (skuList.length <= 0) {
        const skcPropertiesText = formatPropertiesText(skc && skc.properties);
        const skcDailyPriceText = formatCurrencyAmount(
          skc && skc.dailyPrice,
          normalizeText(skc && skc.currency) || currency
        );
        const lineParts = [];

        if (skcId) {
          lineParts.push(`SKC ${skcId}`);
        }

        if (skcPropertiesText) {
          lineParts.push(skcPropertiesText);
        }

        if (skcDailyPriceText) {
          lineParts.push(`\u65e5\u5e38\u7533\u62a5\u4ef7 ${skcDailyPriceText}`);
        }

        if (lineParts.length > 0) {
          totalLineCount += 1;

          if (skuInfoLines.length < SKU_PREVIEW_LIMIT) {
            skuInfoLines.push(lineParts.join(' / '));
          }
        }

        return;
      }

      skuList.forEach((sku) => {
        skuCount += 1;
        totalLineCount += 1;

        if (skuInfoLines.length >= SKU_PREVIEW_LIMIT) {
          return;
        }

        const lineParts = [];
        const skuId = normalizeText(sku && sku.skuId);
        const skuPropertiesText = formatPropertiesText(sku && sku.properties);
        const skuDailyPriceText = formatCurrencyAmount(
          sku && sku.dailyPrice,
          normalizeText(sku && sku.currency) || currency
        );
        const salesStock = normalizePositiveIntegerValue(sku && sku.salesStock, Number.NaN);

        if (skcId) {
          lineParts.push(`SKC ${skcId}`);
        }

        if (skuId) {
          lineParts.push(`SKU ${skuId}`);
        }

        if (skuPropertiesText) {
          lineParts.push(skuPropertiesText);
        }

        if (skuDailyPriceText) {
          lineParts.push(`\u65e5\u5e38\u7533\u62a5\u4ef7 ${skuDailyPriceText}`);
        }

        if (Number.isFinite(salesStock)) {
          lineParts.push(`\u5e93\u5b58 ${salesStock}`);
        }

        skuInfoLines.push(lineParts.join(' / '));
      });
    });

    return {
      skcCount,
      skuCount,
      skuInfoLines,
      hiddenSkuLineCount: Math.max(0, totalLineCount - skuInfoLines.length)
    };
  }

  function buildQuickCostHintEntries(rawRow, shopSummary, siteSummary, categorySummary) {
    const shopId = normalizeText(shopSummary && shopSummary.shopId);
    const shopName = normalizeText(shopSummary && shopSummary.shopName);

    if (!shopId) {
      return [];
    }

    const category = normalizeText(categorySummary && categorySummary.categoryId)
      || normalizeText(categorySummary && categorySummary.categoryName);
    const categoryLabel = normalizeText(categorySummary && categorySummary.categoryName);
    const categoryTrail = buildCategoryTrailText(rawRow) || categoryLabel;
    const siteEntries = [];
    const siteEntryKeys = new Set();
    const pushSiteEntry = (siteId, siteName) => {
      const normalizedSiteId = normalizeText(siteId);
      const normalizedSiteName = normalizeText(siteName);
      const siteKey = `${normalizedSiteId || '-'}\x1f${normalizedSiteName || '-'}`;

      if (siteEntryKeys.has(siteKey)) {
        return;
      }

      siteEntryKeys.add(siteKey);
      siteEntries.push({
        siteId: normalizedSiteId,
        siteName: normalizedSiteName
      });
    };
    const siteIdList = Array.isArray(siteSummary && siteSummary.siteIds)
      ? siteSummary.siteIds
      : [];
    const siteNameList = Array.isArray(siteSummary && siteSummary.siteNames)
      ? siteSummary.siteNames
      : [];
    const siteCount = Math.max(siteIdList.length, siteNameList.length);
    const entryMap = new Map();
    const buildQuickCostHintEntryKey = (station, stationLabel, specText) => {
      const normalizedSpec = normalizeCostSpecText(specText);

      if (!normalizedSpec) {
        return '';
      }

      return [
        shopId,
        normalizeText(station) || normalizeText(stationLabel) || '-',
        normalizedSpec.toLowerCase()
      ].join('\x1f');
    };

    for (let index = 0; index < siteCount; index += 1) {
      pushSiteEntry(siteIdList[index], siteNameList[index]);
    }

    if (siteEntries.length <= 0) {
      pushSiteEntry('', normalizeText(siteSummary && siteSummary.siteText));
    }

    (Array.isArray(rawRow && rawRow.skcList) ? rawRow.skcList : []).forEach((skc) => {
      const skcId = normalizeText(skc && skc.skcId);
      const skcSpecText = formatPropertiesText(skc && skc.properties);
      const skuList = Array.isArray(skc && skc.skuList) ? skc.skuList : [];

      if (skuList.length <= 0) {
        const skcSpec = skcSpecText || (skcId ? `SKC ${skcId}` : '');

        if (!skcSpec) {
          return;
        }

        siteEntries.forEach((siteEntry) => {
          const station = normalizeText(siteEntry && siteEntry.siteId);
          const stationLabel = normalizeText(siteEntry && siteEntry.siteName)
            || station
            || normalizeText(siteSummary && siteSummary.siteText);
          const entryKey = buildQuickCostHintEntryKey(station, stationLabel, skcSpec);

          if (entryMap.has(entryKey)) {
            return;
          }

          const costPrice = resolveCouponGoodsCostPrice(rawRow, skc, null, siteEntry);

          entryMap.set(entryKey, {
            shopId,
            shopName,
            station,
            stationLabel,
            siteId: station,
            siteName: normalizeText(siteEntry && siteEntry.siteName),
            siteIds: station ? [station] : [],
            category,
            categoryLabel,
            categoryTrail,
            skcId,
            spec: skcSpec,
            specAliases: [],
            costPrice
          });
        });

        return;
      }

      skuList.forEach((sku) => {
        const skuId = normalizeText(sku && sku.skuId);
        const skuSpecText = formatPropertiesText(sku && sku.properties);
        const spec = skuSpecText || skcSpecText || (skuId ? `SKU ${skuId}` : (skcId ? `SKC ${skcId}` : ''));

        if (!spec) {
          return;
        }

        const specAliases = Array.from(new Set(
          [skcSpecText]
            .map((specAlias) => normalizeText(specAlias))
            .filter((specAlias) => specAlias && specAlias.toLowerCase() !== spec.toLowerCase())
        ));

        siteEntries.forEach((siteEntry) => {
          const station = normalizeText(siteEntry && siteEntry.siteId);
          const stationLabel = normalizeText(siteEntry && siteEntry.siteName)
            || station
            || normalizeText(siteSummary && siteSummary.siteText);
          const entryKey = buildQuickCostHintEntryKey(station, stationLabel, spec);

          if (entryMap.has(entryKey)) {
            return;
          }

          const costPrice = resolveCouponGoodsCostPrice(rawRow, skc, sku, siteEntry);

          entryMap.set(entryKey, {
            shopId,
            shopName,
            station,
            stationLabel,
            siteId: station,
            siteName: normalizeText(siteEntry && siteEntry.siteName),
            siteIds: station ? [station] : [],
            category,
            categoryLabel,
            categoryTrail,
            skcId,
            skuId,
            spec,
            specAliases,
            costPrice
          });
        });
      });
    });

    return Array.from(entryMap.values());
  }

  function resolveCurrentDailyAmountRange(rawRow) {
    const directMinAmount = normalizeAmount(rawRow && rawRow.minDailyAmount);
    const directMaxAmount = normalizeAmount(rawRow && rawRow.maxDailyAmount);

    if (directMinAmount !== null || directMaxAmount !== null) {
      return {
        minAmount: directMinAmount,
        maxAmount: directMaxAmount
      };
    }

    const dailyAmounts = [];

    (Array.isArray(rawRow && rawRow.skcList) ? rawRow.skcList : []).forEach((skc) => {
      (Array.isArray(skc && skc.skuList) ? skc.skuList : []).forEach((sku) => {
        const dailyPrice = normalizeAmount(sku && sku.dailyPrice);

        if (dailyPrice !== null) {
          dailyAmounts.push(dailyPrice);
        }
      });
    });

    if (dailyAmounts.length <= 0) {
      return {
        minAmount: null,
        maxAmount: null
      };
    }

    return {
      minAmount: Math.min(...dailyAmounts),
      maxAmount: Math.max(...dailyAmounts)
    };
  }

  function buildFilterReasonText(rawRow) {
    const filterOutReason = normalizeText(rawRow && rawRow.filterOutReason);

    if (filterOutReason) {
      return filterOutReason;
    }

    const reasonTexts = (Array.isArray(rawRow && rawRow.filterReasonVOList) ? rawRow.filterReasonVOList : [])
      .map((reasonEntry) => {
        return pickFirstTextValue(
          reasonEntry && reasonEntry.reason,
          reasonEntry && reasonEntry.label,
          reasonEntry && reasonEntry.message,
          reasonEntry && reasonEntry.filterReason,
          reasonEntry && reasonEntry.content
        );
      })
      .filter(Boolean);

    return Array.from(new Set(reasonTexts)).join('\uff1b');
  }

  function hasConfiguredEffectiveCoupons(rawRow) {
    return Array.isArray(rawRow && rawRow.effectiveCouponList)
      && rawRow.effectiveCouponList.length > 0;
  }

  function mapCouponGoodsRow(rawRow, shopSummary) {
    const productId = normalizeText(rawRow && rawRow.productId);
    const goodsId = normalizeText(rawRow && rawRow.goodsId);

    if (!productId && !goodsId) {
      return null;
    }

    const couponCurrency = normalizeText(rawRow && rawRow.couponCurrency) || 'CNY';
    const agreementId = pickFirstTextValue(
      rawRow && rawRow.agreementId,
      rawRow && rawRow.supplierAgreementId,
      rawRow && rawRow.defaultAgreementId,
      rawRow && rawRow.purchaseAgreementId,
      shopSummary && shopSummary.couponAgreementId,
      DEFAULT_COUPON_AGREEMENT_ID
    );
    const currentDailyAmountRange = resolveCurrentDailyAmountRange(rawRow);
    const siteSummary = normalizeSiteSummary(rawRow && rawRow.siteList);
    const categorySummary = normalizeCategorySummary(rawRow);
    const categoryTrail = buildCategoryTrailText(rawRow);
    const skuPreview = buildSkuPreview(rawRow && rawRow.skcList, couponCurrency);
    const quickCostHintEntries = buildQuickCostHintEntries(
      rawRow,
      shopSummary,
      siteSummary,
      categorySummary
    );

    return {
      rowKey: `${normalizeText(shopSummary && shopSummary.shopId)}:${productId || goodsId}`,
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      productId,
      goodsId,
      agreementId,
      productName: normalizeText(rawRow && rawRow.productName),
      materialImgUrl: normalizeText(rawRow && rawRow.materialImgUrl),
      categoryId: categorySummary.categoryId,
      categoryName: categorySummary.categoryName,
      categoryTrail,
      siteIds: siteSummary.siteIds,
      siteNames: siteSummary.siteNames,
      siteText: siteSummary.siteText,
      currentDailyPriceMin: currentDailyAmountRange.minAmount,
      currentDailyPriceMax: currentDailyAmountRange.maxAmount,
      currentDailyPriceText: formatCurrencyRange(
        currentDailyAmountRange.minAmount,
        currentDailyAmountRange.maxAmount,
        couponCurrency
      ),
      suggestCouponAmount: normalizeAmount(rawRow && rawRow.suggestCouponAmount),
      suggestCouponAmountText: formatCurrencyAmount(rawRow && rawRow.suggestCouponAmount, couponCurrency),
      couponAmountMin: normalizeAmount(rawRow && rawRow.couponAmountMin),
      couponAmountMax: normalizeAmount(rawRow && rawRow.couponAmountMax),
      couponRangeText: formatCurrencyRange(
        rawRow && rawRow.couponAmountMin,
        rawRow && rawRow.couponAmountMax,
        couponCurrency
      ),
      suggestPunishCount: normalizePositiveIntegerValue(rawRow && rawRow.suggestPunishCount, 0),
      suggestPunishCountText: String(normalizePositiveIntegerValue(rawRow && rawRow.suggestPunishCount, 0)),
      couponCurrency,
      shouldFilterOut: rawRow && rawRow.shouldFilterOut === true,
      filterReasonText: buildFilterReasonText(rawRow),
      skcCount: skuPreview.skcCount,
      skuCount: skuPreview.skuCount,
      skuInfoLines: skuPreview.skuInfoLines,
      hiddenSkuLineCount: skuPreview.hiddenSkuLineCount,
      quickCostHintEntries
    };
  }

  function normalizeCreateCouponTypes(values) {
    return normalizeBatchCouponTypes(values)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => value === 1 || value === 2);
  }

  function normalizeCreateCouponTimeValue(value, options = {}) {
    const normalizedValue = normalizeText(value);
    const timestamp = Date.parse(normalizedValue);

    if (!Number.isFinite(timestamp)) {
      return null;
    }

    if (options && options.endOfMinute === true && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedValue)) {
      return timestamp + 59000;
    }

    return timestamp;
  }

  function chunkArray(items, chunkSize) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedChunkSize = Math.max(1, Number.parseInt(chunkSize, 10) || 1);
    const chunks = [];

    for (let index = 0; index < normalizedItems.length; index += normalizedChunkSize) {
      chunks.push(normalizedItems.slice(index, index + normalizedChunkSize));
    }

    return chunks;
  }

  function resolveBatchCreateCouponAmountYuan(row, settings) {
    if (!row || typeof row !== 'object') {
      return null;
    }

    const amountMode = normalizeBatchCouponAmountMode(settings && settings.amountMode);
    const currentDailyPriceYuan = normalizeMoneyYuanValue(row.currentDailyPriceMin, 'cent');
    const couponAmountMinYuan = normalizeMoneyYuanValue(row.couponAmountMin, 'cent');
    const couponAmountMaxYuan = normalizeMoneyYuanValue(row.couponAmountMax, 'cent');
    const suggestedCouponAmountYuan = normalizeMoneyYuanValue(row.suggestCouponAmount, 'cent');
    const fixedDiscountYuan = normalizeMoneyYuanValue(settings && settings.amountFixedDiscount, 'yuan');
    const costProfitRate = Number(normalizeText(settings && settings.amountCostProfitRate));
    const saleProfitRate = Number(normalizeText(settings && settings.amountSaleProfitRate));
    let couponAmountYuan = null;

    if (amountMode === 'min-eligible-price') {
      couponAmountYuan = couponAmountMinYuan;
    } else if (amountMode === 'max-eligible-price') {
      couponAmountYuan = couponAmountMaxYuan;
    } else if (amountMode === 'suggested-amount') {
      couponAmountYuan = suggestedCouponAmountYuan;
    } else if (amountMode === 'fixed-discount') {
      couponAmountYuan = fixedDiscountYuan;
    } else if (amountMode === 'cost-profit-rate') {
      const costPriceYuan = normalizeMoneyYuanValue(row.costPrice, 'yuan');

      if (!(Number.isFinite(costPriceYuan) && costPriceYuan > 0 && Number.isFinite(costProfitRate) && costProfitRate > 0)) {
        return null;
      }

      couponAmountYuan = Number(((costPriceYuan * costProfitRate) / 100).toFixed(2));
    } else if (amountMode === 'sale-profit-rate') {
      if (!(Number.isFinite(currentDailyPriceYuan) && currentDailyPriceYuan > 0 && Number.isFinite(saleProfitRate) && saleProfitRate > 0)) {
        return null;
      }

      couponAmountYuan = Number(((currentDailyPriceYuan * saleProfitRate) / 100).toFixed(2));
    }

    if (!(Number.isFinite(couponAmountYuan) && couponAmountYuan > 0)) {
      return null;
    }

    let clampedCouponAmountYuan = couponAmountYuan;

    if (Number.isFinite(couponAmountMinYuan)) {
      clampedCouponAmountYuan = Math.max(couponAmountMinYuan, clampedCouponAmountYuan);
    }

    if (Number.isFinite(couponAmountMaxYuan)) {
      clampedCouponAmountYuan = Math.min(couponAmountMaxYuan, clampedCouponAmountYuan);
    }

    return Number.isFinite(clampedCouponAmountYuan) && clampedCouponAmountYuan > 0
      ? Number(clampedCouponAmountYuan.toFixed(2))
      : null;
  }

  function validateCreateCouponRequest(payload = {}) {
    const normalizedPayload = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const settings = normalizeBatchCouponSettingsPayload(normalizedPayload.settings, store.getOwner());
    const rows = Array.isArray(normalizedPayload.rows)
      ? normalizedPayload.rows.filter((row) => row && typeof row === 'object')
      : [];
    const couponTypes = normalizeCreateCouponTypes(normalizedPayload.couponTypes || settings.couponTypes);
    const beginTime = normalizeCreateCouponTimeValue(settings.startTime);
    const endTime = normalizeCreateCouponTimeValue(settings.endTime, {
      endOfMinute: true
    });
    const couponQuantity = normalizePositiveIntegerValue(settings.couponQuantity, 0);
    const title = normalizeText(settings.couponName);

    if (!title) {
      throw new Error('\u8bf7\u5148\u586b\u5199\u5238\u540d\u79f0\u540e\u518d\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238');
    }

    if (!Number.isFinite(beginTime) || !Number.isFinite(endTime)) {
      throw new Error('\u8bf7\u5148\u8bbe\u7f6e\u5b8c\u6574\u7684\u53d1\u5238\u65f6\u95f4');
    }

    if (beginTime > endTime) {
      throw new Error('\u53d1\u5238\u7ed3\u675f\u65f6\u95f4\u4e0d\u80fd\u65e9\u4e8e\u5f00\u59cb\u65f6\u95f4');
    }

    if (couponQuantity <= 0) {
      throw new Error('\u8bf7\u5148\u586b\u5199\u6709\u6548\u7684\u53d1\u5238\u6570\u91cf');
    }

    if (couponTypes.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u8981\u521b\u5efa\u7684\u4f18\u60e0\u5238\u7c7b\u578b');
    }

    if (rows.length <= 0) {
      throw new Error('\u5f53\u524d\u6ca1\u6709\u53ef\u521b\u5efa\u7684\u4f18\u60e0\u5238\u5546\u54c1');
    }

    return {
      settings,
      rows,
      couponTypes,
      beginTime,
      endTime,
      couponQuantity,
      title
    };
  }

  function mapCreateCouponPreparedRows(rows, settings, couponQuantity) {
    const preparedRows = [];
    const skippedRows = [];

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const rowKey = normalizeText(row && row.rowKey);
      const shopId = normalizeText(row && row.shopId);
      const productId = Number.parseInt(normalizeText(row && row.productId), 10);
      const goodsId = Number.parseInt(normalizeText(row && row.goodsId), 10);
      const agreementId = Number.parseInt(normalizeText(row && row.agreementId), 10);
      const couponCurrency = normalizeText(row && row.couponCurrency) || 'CNY';
      const directCouponAmountYuan = normalizeMoneyYuanValue(row && row.couponAmountYuan, 'yuan');
      const couponAmountYuan = Number.isFinite(directCouponAmountYuan) && directCouponAmountYuan > 0
        ? directCouponAmountYuan
        : resolveBatchCreateCouponAmountYuan(row, settings);
      const couponAmount = normalizeMoneyCentValueFromYuan(couponAmountYuan);

      if (!shopId || !Number.isFinite(productId) || productId <= 0 || !Number.isFinite(goodsId) || goodsId <= 0) {
        skippedRows.push({
          rowKey,
          shopId,
          shopName: normalizeText(row && row.shopName),
          productId: normalizeText(row && row.productId),
          goodsId: normalizeText(row && row.goodsId),
          reason: '\u7f3a\u5c11\u5546\u54c1\u521b\u5efa\u6240\u9700\u7684 productId \u6216 goodsId'
        });
        return;
      }

      if (!Number.isFinite(agreementId) || agreementId <= 0) {
        skippedRows.push({
          rowKey,
          shopId,
          shopName: normalizeText(row && row.shopName),
          productId: String(productId),
          goodsId: String(goodsId),
          reason: '\u7f3a\u5c11 agreementId\uff0c\u6682\u65f6\u65e0\u6cd5\u521b\u5efa'
        });
        return;
      }

      if (!Number.isFinite(couponAmount) || couponAmount <= 0) {
        skippedRows.push({
          rowKey,
          shopId,
          shopName: normalizeText(row && row.shopName),
          productId: String(productId),
          goodsId: String(goodsId),
          reason: '\u5238\u989d\u8ba1\u7b97\u65e0\u6548'
        });
        return;
      }

      preparedRows.push({
        rowKey: normalizeText(row && row.rowKey),
        shopId,
        shopName: normalizeText(row && row.shopName),
        productId,
        goodsId,
        agreementId,
        couponCurrency,
        punishCount: couponQuantity,
        couponAmount
      });
    });

    return {
      preparedRows,
      skippedRows
    };
  }

  function buildCreateCouponSubmitGroups(preparedRows = [], couponTypes = []) {
    const shopMap = new Map();

    preparedRows.forEach((row) => {
      const shopId = normalizeText(row && row.shopId);
      const agreementId = Number.parseInt(row && row.agreementId, 10);

      if (!shopId || !(Number.isFinite(agreementId) && agreementId > 0)) {
        return;
      }

      const groupKey = `${shopId}\x1f${agreementId}`;

      if (!shopMap.has(groupKey)) {
        shopMap.set(groupKey, {
          shopId,
          shopName: normalizeText(row && row.shopName),
          agreementId,
          rows: []
        });
      }

      shopMap.get(groupKey).rows.push(row);
    });

    const groups = [];

    shopMap.forEach((shopGroup) => {
      couponTypes.forEach((couponType) => {
        chunkArray(shopGroup.rows, COUPON_BATCH_CREATE_CHUNK_SIZE).forEach((chunkRows, chunkIndex) => {
          if (chunkRows.length <= 0) {
            return;
          }

          groups.push({
            shopId: shopGroup.shopId,
            shopName: shopGroup.shopName,
            agreementId: shopGroup.agreementId,
            couponType,
            chunkIndex: chunkIndex + 1,
            totalRowCount: shopGroup.rows.length,
            rows: chunkRows
          });
        });
      });
    });

    return groups;
  }

  function buildCreateCouponTypeLabel(couponType) {
    return Number.parseInt(couponType, 10) === 2 ? '\u60ca\u559c\u5238' : '\u7acb\u51cf\u5238';
  }

  async function resolveCouponAgreementId(sessionContext) {
    const sessionAgreementId = pickFirstTextValue(
      sessionContext && sessionContext.couponAgreementId,
      sessionContext && sessionContext.sellerSession && sessionContext.sellerSession.couponAgreementId
    );

    if (sessionAgreementId) {
      return sessionAgreementId;
    }

    try {
      const responsePayload = await executeJsonRequest(
        sessionContext,
        COUPON_AGREEMENT_INFO_ENDPOINT_PATH,
        {},
        {
          timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
          refererPath: '/'
        }
      );
      const resolvedAgreementId = pickFirstTextValue(
        responsePayload && responsePayload.result && responsePayload.result.agreementId,
        responsePayload && responsePayload.result && responsePayload.result.defaultAgreementId,
        responsePayload && responsePayload.agreementId
      ) || String(DEFAULT_COUPON_AGREEMENT_ID);

      if (sessionContext && typeof sessionContext === 'object') {
        sessionContext.couponAgreementId = resolvedAgreementId;
      }

      if (sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object') {
        sessionContext.sellerSession.couponAgreementId = resolvedAgreementId;
      }

      return resolvedAgreementId;
    } catch (error) {
      logError('marketing_tools_single_product_coupon_agreement_info_failed', error, {
        shopId: normalizeText(sessionContext && sessionContext.shopId),
        shopName: normalizeText(sessionContext && sessionContext.shopName),
        partition: normalizeText(sessionContext && sessionContext.partition)
      });
      return String(DEFAULT_COUPON_AGREEMENT_ID);
    }
  }

  function buildCreateCouponRowProgressItems(rows, options = {}) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const status = normalizeText(options.status);
    const reason = normalizeText(options.reason);
    const couponType = Number.parseInt(options.couponType, 10) === 2 ? 2 : 1;

    return normalizedRows.map((row) => ({
      rowKey: normalizeText(row && row.rowKey),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      productId: normalizeText(row && row.productId),
      goodsId: normalizeText(row && row.goodsId),
      couponType: Number.parseInt(row && row.couponType, 10) === 2
        ? 2
        : couponType,
      status,
      reason: reason || normalizeText(row && row.reason)
    }));
  }

  function emitCreateCouponProgress(progressEmitter, payload = {}) {
    emitProgress(progressEmitter, {
      phase: normalizeText(payload && payload.phase) || 'create-progress',
      runId: normalizeText(payload && payload.runId),
      totalRowCount: Math.max(0, Number.parseInt(payload && payload.totalRowCount, 10) || 0),
      preparedRowCount: Math.max(0, Number.parseInt(payload && payload.preparedRowCount, 10) || 0),
      skippedRowCount: Math.max(0, Number.parseInt(payload && payload.skippedRowCount, 10) || 0),
      successCount: Math.max(0, Number.parseInt(payload && payload.successCount, 10) || 0),
      failCount: Math.max(0, Number.parseInt(payload && payload.failCount, 10) || 0),
      completedChunkCount: Math.max(0, Number.parseInt(payload && payload.completedChunkCount, 10) || 0),
      totalChunkCount: Math.max(0, Number.parseInt(payload && payload.totalChunkCount, 10) || 0),
      currentShopId: normalizeText(payload && payload.currentShopId),
      currentShopName: normalizeText(payload && payload.currentShopName),
      couponType: Number.parseInt(payload && payload.couponType, 10) === 2 ? 2 : 1,
      message: normalizeText(payload && payload.message),
      rowProgressItems: Array.isArray(payload && payload.rowProgressItems)
        ? payload.rowProgressItems.map((item) => ({
          rowKey: normalizeText(item && item.rowKey),
          shopId: normalizeText(item && item.shopId),
          shopName: normalizeText(item && item.shopName),
          productId: normalizeText(item && item.productId),
          goodsId: normalizeText(item && item.goodsId),
          couponType: Number.parseInt(item && item.couponType, 10) === 2 ? 2 : 1,
          status: normalizeText(item && item.status),
          reason: normalizeText(item && item.reason)
        })).filter((item) => item.rowKey || (item.productId && item.goodsId))
        : []
    });
  }

  async function createBatchCoupons(payload = {}) {
    const request = validateCreateCouponRequest(payload);
    const progressEmitter = typeof payload.emitProgress === 'function'
      ? payload.emitProgress
      : null;
    const runId = normalizeText(payload && payload.runId);
    const { preparedRows, skippedRows } = mapCreateCouponPreparedRows(
      request.rows,
      request.settings,
      request.couponQuantity
    );

    if (preparedRows.length <= 0) {
      throw new Error(skippedRows[0] && skippedRows[0].reason
        ? skippedRows[0].reason
        : '\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u521b\u5efa\u7684\u5546\u54c1');
    }

    const submitGroups = buildCreateCouponSubmitGroups(preparedRows, request.couponTypes);

    if (submitGroups.length <= 0) {
      throw new Error('\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u521b\u5efa\u6279\u6b21');
    }

    const { resolvedShops } = await resolveSelectedShops(
      Array.from(new Set(submitGroups.map((group) => normalizeText(group && group.shopId)).filter(Boolean)))
    );
    const shopSummaryMap = new Map(
      resolvedShops.map((shop) => [normalizeText(shop && shop.shopId), shop])
    );
    const sessionContextMap = new Map();
    const results = [];
    let totalSuccessCount = 0;
    let totalFailCount = 0;
    let completedChunkCount = 0;

    emitCreateCouponProgress(progressEmitter, {
      phase: 'create-start',
      runId,
      totalRowCount: request.rows.length,
      preparedRowCount: preparedRows.length,
      skippedRowCount: skippedRows.length,
      totalChunkCount: submitGroups.length,
      message: `\u6b63\u5728\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238\uff0c\u5f85\u63d0\u4ea4 ${preparedRows.length} \u4e2a\u5546\u54c1`,
      rowProgressItems: request.couponTypes.flatMap((couponType) => (
        buildCreateCouponRowProgressItems(skippedRows, {
          couponType,
          status: 'skipped'
        })
      ))
    });

    for (const group of submitGroups) {
      const shopId = normalizeText(group && group.shopId);
      const shopSummary = shopSummaryMap.get(shopId);
      const couponTypeLabel = buildCreateCouponTypeLabel(group && group.couponType);

      emitCreateCouponProgress(progressEmitter, {
        phase: 'create-chunk-start',
        runId,
        totalRowCount: request.rows.length,
        preparedRowCount: preparedRows.length,
        skippedRowCount: skippedRows.length,
        successCount: totalSuccessCount,
        failCount: totalFailCount,
        completedChunkCount,
        totalChunkCount: submitGroups.length,
        currentShopId: shopId,
        currentShopName: normalizeText(group && group.shopName),
        couponType: group.couponType,
        message: `\u6b63\u5728\u63d0\u4ea4 ${normalizeText(group && group.shopName) || shopId} \u7684${couponTypeLabel}\uff0c\u7b2c ${group.chunkIndex} \u6279`,
        rowProgressItems: buildCreateCouponRowProgressItems(group.rows, {
          couponType: group.couponType,
          status: 'running'
        })
      });

      if (!shopSummary) {
        totalFailCount += group.rows.length;
        completedChunkCount += 1;
        results.push({
          shopId,
          shopName: normalizeText(group && group.shopName),
          couponType: group.couponType,
          chunkIndex: group.chunkIndex,
          success: false,
          successCount: 0,
          failCount: group.rows.length,
          failList: group.rows.map((row) => ({
            productId: row.productId,
            goodsId: row.goodsId,
            reason: '\u5e97\u94fa\u4f1a\u8bdd\u672a\u5c31\u7eea'
          })),
          message: '\u5e97\u94fa\u4f1a\u8bdd\u672a\u5c31\u7eea'
        });
        emitCreateCouponProgress(progressEmitter, {
          phase: 'create-chunk-finished',
          runId,
          totalRowCount: request.rows.length,
          preparedRowCount: preparedRows.length,
          skippedRowCount: skippedRows.length,
          successCount: totalSuccessCount,
          failCount: totalFailCount,
          completedChunkCount,
          totalChunkCount: submitGroups.length,
          currentShopId: shopId,
          currentShopName: normalizeText(group && group.shopName),
          couponType: group.couponType,
          message: `${normalizeText(group && group.shopName) || shopId} \u7684${couponTypeLabel}\u63d0\u4ea4\u5931\u8d25\uff1a\u5e97\u94fa\u4f1a\u8bdd\u672a\u5c31\u7eea`,
          rowProgressItems: buildCreateCouponRowProgressItems(group.rows, {
            couponType: group.couponType,
            status: 'failed',
            reason: '\u5e97\u94fa\u4f1a\u8bdd\u672a\u5c31\u7eea'
          })
        });
        continue;
      }

      try {
        let sessionContext = sessionContextMap.get(shopId);

        if (!sessionContext) {
          sessionContext = await resolveShopSessionContext(shopSummary);
          sessionContext = applyKnownMallIdToSessionContext(sessionContext, shopSummary);
          sessionContext = await warmupSellerSessionContext(sessionContext, {
            timeoutMs: 60000
          });
          sessionContext = applyKnownMallIdToSessionContext(sessionContext, shopSummary);
          await ensureMallId(sessionContext);
          sessionContext.couponAgreementId = await resolveCouponAgreementId(sessionContext);
          sessionContextMap.set(shopId, sessionContext);
        }

        const responsePayload = await executeJsonRequest(
          sessionContext,
          COUPON_BATCH_CREATE_ENDPOINT_PATH,
          {
            title: request.title,
            beginTime: request.beginTime,
            endTime: request.endTime,
            agreementId: group.agreementId,
            couponType: group.couponType,
            goodsCoupons: group.rows.map((row) => ({
              punishCount: row.punishCount,
              couponAmount: row.couponAmount,
              productId: row.productId,
              goodsId: row.goodsId,
              couponCurrency: row.couponCurrency
            }))
          },
          {
            timeoutMs: CREATE_REQUEST_TIMEOUT_MS,
            refererPath: '/',
            queryJob: null
          }
        );
        const resultPayload = responsePayload && typeof responsePayload === 'object'
          ? responsePayload.result
          : null;
        const failCount = normalizePositiveIntegerValue(resultPayload && resultPayload.failCount, 0);
        const successCount = normalizePositiveIntegerValue(
          resultPayload && resultPayload.successCount,
          failCount <= 0 ? group.rows.length : 0
        );
        const failList = Array.isArray(resultPayload && resultPayload.failList)
          ? resultPayload.failList.map((item) => ({
            productId: normalizeText(item && item.productId),
            goodsId: normalizeText(item && item.goodsId),
            reason: pickFirstTextValue(
              item && item.failReason,
              item && item.errorMsg,
              item && item.message,
              item && item.msg
            ) || '\u521b\u5efa\u5931\u8d25'
          }))
          : [];
        const failReasonMap = new Map(
          failList.map((item) => [`${normalizeText(item && item.productId)}\x1f${normalizeText(item && item.goodsId)}`, normalizeText(item && item.reason)])
        );
        const rowProgressItems = group.rows.map((row) => {
          const failReason = failReasonMap.get(`${normalizeText(row && row.productId)}\x1f${normalizeText(row && row.goodsId)}`);

          return {
            rowKey: normalizeText(row && row.rowKey),
            shopId: normalizeText(row && row.shopId),
            shopName: normalizeText(row && row.shopName),
            productId: normalizeText(row && row.productId),
            goodsId: normalizeText(row && row.goodsId),
            couponType: Number.parseInt(group && group.couponType, 10) === 2 ? 2 : 1,
            status: failReason ? 'failed' : 'success',
            reason: failReason
          };
        });

        totalSuccessCount += successCount;
        totalFailCount += failCount;
        completedChunkCount += 1;
        results.push({
          shopId,
          shopName: normalizeText(group && group.shopName),
          couponType: group.couponType,
          chunkIndex: group.chunkIndex,
          success: failCount <= 0,
          successCount,
          failCount,
          failList,
          message: ''
        });
        emitCreateCouponProgress(progressEmitter, {
          phase: 'create-chunk-finished',
          runId,
          totalRowCount: request.rows.length,
          preparedRowCount: preparedRows.length,
          skippedRowCount: skippedRows.length,
          successCount: totalSuccessCount,
          failCount: totalFailCount,
          completedChunkCount,
          totalChunkCount: submitGroups.length,
          currentShopId: shopId,
          currentShopName: normalizeText(group && group.shopName),
          couponType: group.couponType,
          message: `${normalizeText(group && group.shopName) || shopId} \u7684${couponTypeLabel}\u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${successCount} \u4e2a\uff0c\u5931\u8d25 ${failCount} \u4e2a`,
          rowProgressItems
        });
      } catch (error) {
        totalFailCount += group.rows.length;
        completedChunkCount += 1;
        results.push({
          shopId,
          shopName: normalizeText(group && group.shopName),
          couponType: group.couponType,
          chunkIndex: group.chunkIndex,
          success: false,
          successCount: 0,
          failCount: group.rows.length,
          failList: group.rows.map((row) => ({
            productId: row.productId,
            goodsId: row.goodsId,
            reason: normalizeText(error && error.message) || '\u521b\u5efa\u5931\u8d25'
          })),
          message: normalizeText(error && error.message) || '\u521b\u5efa\u5931\u8d25'
        });
        emitCreateCouponProgress(progressEmitter, {
          phase: 'create-chunk-finished',
          runId,
          totalRowCount: request.rows.length,
          preparedRowCount: preparedRows.length,
          skippedRowCount: skippedRows.length,
          successCount: totalSuccessCount,
          failCount: totalFailCount,
          completedChunkCount,
          totalChunkCount: submitGroups.length,
          currentShopId: shopId,
          currentShopName: normalizeText(group && group.shopName),
          couponType: group.couponType,
          message: `${normalizeText(group && group.shopName) || shopId} \u7684${couponTypeLabel}\u63d0\u4ea4\u5931\u8d25`,
          rowProgressItems: buildCreateCouponRowProgressItems(group.rows, {
            couponType: group.couponType,
            status: 'failed',
            reason: normalizeText(error && error.message) || '\u521b\u5efa\u5931\u8d25'
          })
        });
      }
    }

    const response = {
      success: totalFailCount <= 0 && skippedRows.length <= 0,
      title: request.title,
      beginTime: request.beginTime,
      endTime: request.endTime,
      couponTypes: request.couponTypes,
      requestedRowCount: request.rows.length,
      preparedRowCount: preparedRows.length,
      skippedRowCount: skippedRows.length,
      skippedRows,
      chunkCount: submitGroups.length,
      successCount: totalSuccessCount,
      failCount: totalFailCount,
      results
    };

    emitCreateCouponProgress(progressEmitter, {
      phase: 'create-finished',
      runId,
      totalRowCount: request.rows.length,
      preparedRowCount: preparedRows.length,
      skippedRowCount: skippedRows.length,
      successCount: totalSuccessCount,
      failCount: totalFailCount,
      completedChunkCount,
      totalChunkCount: submitGroups.length,
      message: totalFailCount <= 0
        ? `\u4f18\u60e0\u5238\u6279\u91cf\u521b\u5efa\u5b8c\u6210\uff0c\u6210\u529f ${totalSuccessCount} \u4e2a`
        : `\u4f18\u60e0\u5238\u6279\u91cf\u521b\u5efa\u5b8c\u6210\uff0c\u6210\u529f ${totalSuccessCount} \u4e2a\uff0c\u5931\u8d25 ${totalFailCount} \u4e2a`
    });

    return response;
  }

  function sortMappedRows(rows) {
    return (Array.isArray(rows) ? rows : []).slice().sort((left, right) => {
      const leftShopName = normalizeText(left && left.shopName);
      const rightShopName = normalizeText(right && right.shopName);

      if (leftShopName !== rightShopName) {
        return leftShopName.localeCompare(rightShopName, 'zh-CN');
      }

      const rightSuggestAmount = normalizeAmount(right && right.suggestCouponAmount) || 0;
      const leftSuggestAmount = normalizeAmount(left && left.suggestCouponAmount) || 0;

      if (rightSuggestAmount !== leftSuggestAmount) {
        return rightSuggestAmount - leftSuggestAmount;
      }

      return normalizeText(left && left.productId).localeCompare(normalizeText(right && right.productId), 'en');
    });
  }

  function buildFailureMessage(failedShopResults) {
    const normalizedResults = Array.isArray(failedShopResults) ? failedShopResults : [];

    if (normalizedResults.length <= 0) {
      return '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5931\u8d25';
    }

    return `\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5931\u8d25\uff1a${normalizedResults.map((shopResult) => {
      const shopName = normalizeText(shopResult && shopResult.shopName) || normalizeText(shopResult && shopResult.shopId);
      const message = normalizeText(shopResult && shopResult.message);
      return message ? `${shopName}(${message})` : shopName;
    }).join('\u3001')}`;
  }

  function buildWarningMessage(summary = {}, shopResults = []) {
    const warningParts = [];
    const canceled = summary && summary.canceled === true;
    const failedShops = (Array.isArray(shopResults) ? shopResults : []).filter((shopResult) => {
      return shopResult && shopResult.success !== true;
    });

    if (canceled) {
      warningParts.push('\u67e5\u8be2\u5df2\u505c\u6b62\uff0c\u5f53\u524d\u5c55\u793a\u5df2\u83b7\u53d6\u7684\u53ef\u914d\u5546\u54c1');
    }

    if (failedShops.length > 0) {
      warningParts.push(`\u4ee5\u4e0b\u5e97\u94fa\u67e5\u8be2\u5931\u8d25\uff1a${failedShops.map((shopResult) => {
        return normalizeText(shopResult.shopName) || normalizeText(shopResult.shopId);
      }).filter(Boolean).join('\u3001')}`);
    }

    return warningParts.join('\uff1b');
  }

  async function queryRows(payload = {}, options = {}) {
    ensureFeatureEntryRegistered();
    const request = normalizeQueryRequest(payload);
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const queryJob = createQueryJob({
      runId: request.runId
    }, {
      requesterKey: options && options.requesterKey
    });

    try {
      const { resolvedShops, unresolved } = await resolveSelectedShops(request.shopIds);

      if (resolvedShops.length <= 0) {
        throw new Error(buildFailureMessage(unresolved));
      }

      const rows = [];
      const shopResults = [];
      let rawRowCount = 0;
      let filteredConfiguredCount = 0;
      let completedShopCount = 0;
      let failedShopCount = 0;
      let canceled = false;

      unresolved.forEach((shopResult) => {
        shopResults.push({
          shopId: normalizeText(shopResult && shopResult.shopId),
          shopName: normalizeText(shopResult && shopResult.shopName),
          success: false,
          rawRowCount: 0,
          rowCount: 0,
          filteredConfiguredCount: 0,
          pageCount: 0,
          message: normalizeText(shopResult && shopResult.message)
        });
        failedShopCount += 1;
      });

      emitProgress(progressEmitter, {
        runId: request.runId,
        phase: 'preparing',
        totalShopCount: request.shopIds.length,
        completedShopCount,
        failedShopCount,
        rawRowCount,
        rowCount: rows.length,
        filteredConfiguredCount,
        message: `\u5df2\u9009 ${request.shopIds.length} \u5bb6\u5e97\u94fa\uff0c\u6b63\u5728\u51c6\u5907\u67e5\u8be2`
      });

      const aggregate = {
        rawRowCount,
        filteredConfiguredCount,
        completedShopCount,
        failedShopCount
      };
      let aggregateWriteChain = Promise.resolve();

      async function withAggregateWrite(callback) {
        aggregateWriteChain = aggregateWriteChain.then(() => callback());
        return aggregateWriteChain;
      }

      await mapWithConcurrency(
        resolvedShops,
        MAX_CONCURRENT_SHOP_QUERIES,
        async (shop, shopIndex) => {
          const shopId = normalizeText(shop && shop.shopId);
          const shopName = normalizeText(shop && shop.shopName) || shopId;

          assertQueryJobActive(queryJob);

          emitProgress(progressEmitter, {
            runId: request.runId,
            phase: 'shop-start',
            totalShopCount: request.shopIds.length,
            completedShopCount: aggregate.completedShopCount,
            failedShopCount: aggregate.failedShopCount,
            currentShopIndex: shopIndex + 1,
            currentShopId: shopId,
            currentShopName: shopName,
            rawRowCount: aggregate.rawRowCount,
            rowCount: rows.length,
            filteredConfiguredCount: aggregate.filteredConfiguredCount,
            message: `\u6b63\u5728\u67e5\u8be2 ${shopName}`
          });

          try {
            let sessionContext = await resolveShopSessionContext(shop);

            sessionContext = applyKnownMallIdToSessionContext(sessionContext, shop);
            sessionContext = await warmupSellerSessionContext(sessionContext, {
              timeoutMs: 60000
            });
            sessionContext = applyKnownMallIdToSessionContext(sessionContext, shop);

            const ensuredMallId = await ensureMallId(sessionContext);
            const couponAgreementId = await resolveCouponAgreementId(sessionContext);

            if (!ensuredMallId) {
              throw new Error('\u672a\u80fd\u83b7\u53d6 Mallid\uff0c\u8bf7\u5148\u786e\u8ba4\u5bf9\u5e94\u5e97\u94fa\u5df2\u8fdb\u5165 Seller Central\u3002');
            }

            const mappedShopSummary = {
              ...shop,
              couponAgreementId
            };

            let searchScrollContext = null;
            let pageIndex = 0;
            let shopRawRowCount = 0;
            let shopFilteredConfiguredCount = 0;
            let shopEligibleRowCount = 0;

            while (true) {
              assertQueryJobActive(queryJob);
              pageIndex += 1;

              const responsePayload = await executeJsonRequest(
                sessionContext,
                COUPON_GOODS_SCROLL_ENDPOINT_PATH,
                buildQueryBody(request, searchScrollContext),
                {
                  queryJob,
                  timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
                  refererPath: '/'
                }
              );
              const resultPayload = responsePayload && typeof responsePayload === 'object'
                ? responsePayload.result
                : null;
              const list = Array.isArray(resultPayload && resultPayload.list)
                ? resultPayload.list
                : [];
              const nextSearchScrollContext = normalizeText(resultPayload && resultPayload.searchScrollContext);
              const hasMore = resultPayload && resultPayload.hasMore === true && Boolean(nextSearchScrollContext);
              const pageRows = [];
              let currentPageEligibleCount = 0;
              let currentPageFilteredConfiguredCount = 0;

              list.forEach((rawRow) => {
                shopRawRowCount += 1;

                if (hasConfiguredEffectiveCoupons(rawRow)) {
                  shopFilteredConfiguredCount += 1;
                  currentPageFilteredConfiguredCount += 1;
                  return;
                }

                const mappedRow = mapCouponGoodsRow(rawRow, mappedShopSummary);

                if (!mappedRow) {
                  return;
                }

                pageRows.push(mappedRow);
                shopEligibleRowCount += 1;
                currentPageEligibleCount += 1;
              });

              await withAggregateWrite(() => {
                aggregate.rawRowCount += list.length;
                aggregate.filteredConfiguredCount += currentPageFilteredConfiguredCount;
                rows.push(...pageRows);
              });

              emitProgress(progressEmitter, {
                runId: request.runId,
                phase: 'page-completed',
                totalShopCount: request.shopIds.length,
                completedShopCount: aggregate.completedShopCount,
                failedShopCount: aggregate.failedShopCount,
                currentShopIndex: shopIndex + 1,
                currentShopId: shopId,
                currentShopName: shopName,
                currentPageIndex: pageIndex,
                currentPageRawCount: list.length,
                currentPageEligibleCount,
                rawRowCount: aggregate.rawRowCount,
                rowCount: rows.length,
                filteredConfiguredCount: aggregate.filteredConfiguredCount,
                hasMore,
                message: `\u5df2\u5b8c\u6210 ${shopName} \u7b2c ${pageIndex} \u9875\uff0c\u65b0\u589e ${currentPageEligibleCount} \u4e2a\u53ef\u914d\u5546\u54c1`
              });

              if (!hasMore || list.length <= 0) {
                break;
              }

              searchScrollContext = nextSearchScrollContext;
            }

            await withAggregateWrite(() => {
              aggregate.completedShopCount += 1;
              shopResults.push({
                shopId,
                shopName,
                success: true,
                rawRowCount: shopRawRowCount,
                rowCount: shopEligibleRowCount,
                filteredConfiguredCount: shopFilteredConfiguredCount,
                pageCount: pageIndex,
                message: ''
              });
            });

            emitProgress(progressEmitter, {
              runId: request.runId,
              phase: 'shop-completed',
              totalShopCount: request.shopIds.length,
              completedShopCount: aggregate.completedShopCount,
              failedShopCount: aggregate.failedShopCount,
              currentShopIndex: shopIndex + 1,
              currentShopId: shopId,
              currentShopName: shopName,
              rawRowCount: aggregate.rawRowCount,
              rowCount: rows.length,
              filteredConfiguredCount: aggregate.filteredConfiguredCount,
              message: `${shopName} \u67e5\u8be2\u5b8c\u6210\uff0c\u53ef\u914d ${shopEligibleRowCount} \u4e2a`
            });
          } catch (error) {
            if (isQueryCanceledError(error)) {
              canceled = true;
              throw error;
            }

            await withAggregateWrite(() => {
              aggregate.failedShopCount += 1;
              shopResults.push({
                shopId,
                shopName,
                success: false,
                rawRowCount: 0,
                rowCount: 0,
                filteredConfiguredCount: 0,
                pageCount: 0,
                message: normalizeText(error && error.message) || '\u67e5\u8be2\u5931\u8d25'
              });
            });

            emitProgress(progressEmitter, {
              runId: request.runId,
              phase: 'shop-failed',
              totalShopCount: request.shopIds.length,
              completedShopCount: aggregate.completedShopCount,
              failedShopCount: aggregate.failedShopCount,
              currentShopIndex: shopIndex + 1,
              currentShopId: shopId,
              currentShopName: shopName,
              rawRowCount: aggregate.rawRowCount,
              rowCount: rows.length,
              filteredConfiguredCount: aggregate.filteredConfiguredCount,
              message: `${shopName} \u67e5\u8be2\u5931\u8d25\uff1a${normalizeText(error && error.message) || '\u672a\u77e5\u9519\u8bef'}`
            });
          }
        }
      );

      rawRowCount = aggregate.rawRowCount;
      filteredConfiguredCount = aggregate.filteredConfiguredCount;
      completedShopCount = aggregate.completedShopCount;
      failedShopCount = aggregate.failedShopCount;

      if (queryJob.canceled === true) {
        canceled = true;
      }

      const sortedRows = sortMappedRows(rows);
      const canceledShopCount = canceled
        ? Math.max(0, request.shopIds.length - completedShopCount - failedShopCount)
        : 0;
      const warning = buildWarningMessage({
        canceled
      }, shopResults);

      if (completedShopCount <= 0 && sortedRows.length <= 0) {
        throw new Error(buildFailureMessage(shopResults.filter((shopResult) => {
          return shopResult && shopResult.success !== true;
        })));
      }

      const result = {
        success: completedShopCount > 0 && canceled !== true,
        updatedAt: nowIso(),
        runId: request.runId,
        rows: sortedRows,
        rowCount: sortedRows.length,
        rawRowCount,
        filteredConfiguredCount,
        totalShopCount: request.shopIds.length,
        completedShopCount,
        failedShopCount,
        canceledShopCount,
        canceled,
        shopResults,
        warning
      };

      emitProgress(progressEmitter, {
        runId: request.runId,
        phase: canceled ? 'canceled' : 'completed',
        totalShopCount: result.totalShopCount,
        completedShopCount: result.completedShopCount,
        failedShopCount: result.failedShopCount,
        canceledShopCount: result.canceledShopCount,
        rawRowCount: result.rawRowCount,
        rowCount: result.rowCount,
        filteredConfiguredCount: result.filteredConfiguredCount,
        message: canceled
          ? '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5df2\u505c\u6b62'
          : '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5b8c\u6210'
      });

      log('marketing_tools_single_product_coupon_query_completed', {
        runId: result.runId,
        totalShopCount: result.totalShopCount,
        completedShopCount: result.completedShopCount,
        failedShopCount: result.failedShopCount,
        rowCount: result.rowCount,
        rawRowCount: result.rawRowCount,
        filteredConfiguredCount: result.filteredConfiguredCount,
        canceled: result.canceled
      });

      return result;
    } catch (error) {
      if (!isQueryCanceledError(error)) {
        logError('marketing_tools_single_product_coupon_query_failed', error, {
          runId: normalizeText(request && request.runId),
          shopCount: Array.isArray(request && request.shopIds) ? request.shopIds.length : 0
        });
      }

      throw error;
    } finally {
      clearQueryJob(queryJob);
    }
  }

  async function cancelQuery(payload = {}, options = {}) {
    const job = getQueryJob({
      runId: payload && payload.runId,
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

  async function getBatchCouponSettings() {
    const configResult = await store.readUserConfig('batchCouponSettings');
    const owner = configResult.owner || store.getOwner();
    const newerPayload = pickNewerPayload(configResult.localConfig, configResult.cloudConfig);
    const settings = normalizeBatchCouponSettingsPayload(newerPayload.payload, owner);

    return {
      settings,
      source: newerPayload.source
    };
  }

  async function saveBatchCouponSettings(payload = {}) {
    const owner = store.getOwner();
    const currentSettingsResult = await getBatchCouponSettings();
    const nextSettings = normalizeBatchCouponSettingsPayload({
      ...(currentSettingsResult && currentSettingsResult.settings ? currentSettingsResult.settings : {}),
      ...(payload && typeof payload === 'object' ? payload : {}),
      updatedAt: nowIso()
    }, owner);
    const persistResult = await store.writeUserConfig('batchCouponSettings', nextSettings);

    return {
      settings: nextSettings,
      source: 'local',
      cloudSynced: persistResult && persistResult.cloudSynced === true,
      warning: normalizeText(persistResult && persistResult.warning)
    };
  }

  return {
    async queryRows(payload = {}, options = {}) {
      return queryRows(payload, options);
    },
    async cancelQuery(payload = {}, options = {}) {
      return cancelQuery(payload, options);
    },
    async getBatchCouponSettings() {
      return getBatchCouponSettings();
    },
    async saveBatchCouponSettings(payload = {}) {
      return saveBatchCouponSettings(payload);
    },
    async createBatchCoupons(payload = {}) {
      return createBatchCoupons(payload);
    }
  };
}

module.exports = {
  createMarketingToolsSingleProductCouponService
};
