const crypto = require('node:crypto');
const {
  normalizeText,
  isShopParticipating
} = require('../shopManagement/common');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');
const {
  createOperationsActivityManagementStore
} = require('./operationsActivityManagementStore');
const {
  normalizeCostSpecText
} = require('./operationsCostIdentity');

const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const ACTIVITY_LIST_ENDPOINT_PATH = '/api/kiana/gamblers/marketing/enroll/activity/list';
const ACTIVITY_MATCH_PRODUCTS_ENDPOINT_PATH = '/api/kiana/gamblers/marketing/enroll/semi/scroll/match';
const ACTIVITY_MATCH_PRODUCTS_SUBMIT_ENDPOINT_PATH = '/api/kiana/gamblers/marketing/enroll/semi/submit';
const QUERY_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_ACTIVITY_LIST_QUERY_CONCURRENCY = 4;
const DEFAULT_ACTIVITY_MATCH_QUERY_CONCURRENCY = 4;
const DEFAULT_ACTIVITY_MATCH_ROW_COUNT = 50;
const DEFAULT_ACTIVITY_MATCH_PAGE_SIZE = 80;
const MAX_ACTIVITY_MATCH_PAGE_SIZE = 200;
const DEFAULT_ACTIVITY_BATCH_SIGNUP_SUBMIT_SIZE = 100;
const MAX_ACTIVITY_BATCH_SIGNUP_SUBMIT_SIZE = 100;
const MAX_ACTIVITY_MATCH_CACHE_ENTRIES = 6;
const MAX_ACTIVITY_MATCH_BATCH_CACHE_ENTRIES = 4;
const ACTIVITY_MATCH_BATCH_SORT_FIELDS = new Set([
  'productId',
  'productName',
  'shopName',
  'activityName',
  'suggestActivityStock',
  'salesStock',
  'canEnrollSessionCount',
  'suggestActivityPrice',
  'dailyPrice'
]);
const FILTER_SETTINGS_VERSION = 2;
const DEFAULT_QUERY_PAYLOAD = Object.freeze({
  needSessionItem: true,
  needCanEnrollCnt: true
});
const DEFAULT_FILTER_SETTINGS = Object.freeze({
  version: FILTER_SETTINGS_VERSION,
  updatedAt: '',
  minDiscountRate: '',
  minEnrollRemainingDays: '',
  maxEnrollRemainingDays: '',
  minActivityRemainingDays: '',
  maxActivityRemainingDays: '',
  activityThemeTypes: []
});
const PRODUCT_FILTER_SETTINGS_VERSION = 1;
const DEFAULT_PRODUCT_FILTER_SETTINGS = Object.freeze({
  version: PRODUCT_FILTER_SETTINGS_VERSION,
  updatedAt: '',
  mode: 'suggestActivityPrice',
  modeValueDailyDiscount: '',
  modeValueSaleProfitRate: '',
  modeValueProfitRateDiscount: '',
  modeValueDailyReduce: '',
  modeValueCostMarkup: '',
  clampToSuggestPrice: false,
  profitFloorRate: '',
  profitFloorRelation: 'and',
  profitFloorValue: '',
  submitAtProfitFloor: false,
  submitAtProfitFloorBasis: 'profitFloorRate'
});

function createOperationsActivityManagementService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  getShopWindowBrowserController,
  runtimeLogger
}) {
  const store = createOperationsActivityManagementStore({
    sessionStore,
    featureCenterProfileService
  });
  const activityMatchProductCacheByKey = new Map();
  const activityMatchProductCacheOrder = [];
  const activityMatchBatchCacheByKey = new Map();
  const activityMatchBatchCacheOrder = [];
  const activeBatchQueryJobsByRequestId = new Map();
  const activeBatchSignupJobsByRequestId = new Map();

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
    scope: 'operations-activity-management'
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(normalizeText(payload && payload.updatedAt));
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? { source: 'cloud', payload: cloudPayload }
        : { source: 'local', payload: localPayload };
    }

    if (localPayload) {
      return { source: 'local', payload: localPayload };
    }

    if (cloudPayload) {
      return { source: 'cloud', payload: cloudPayload };
    }

    return { source: 'default', payload: null };
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    return Array.from(new Set(
      (Array.isArray(selectedShopIds) ? selectedShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function normalizeActivityThemeTypeFilterValues(values) {
    return Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    ));
  }

  function normalizeOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function normalizeBooleanSetting(value, fallback = false) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue) {
      return fallback;
    }

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return fallback;
  }

  function normalizeNonNegativeInteger(value, fallback = 0) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return fallback;
    }

    return Math.trunc(numericValue);
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
        normalizeNonNegativeInteger(concurrency, 1) || 1
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

  function formatOptionalFilterNumber(value, options = {}) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return '';
    }

    if (options.integer === true) {
      return Math.trunc(parsedValue);
    }

    const fractionDigits = Number.isFinite(Number(options.fractionDigits))
      ? Math.max(0, Number(options.fractionDigits))
      : 2;
    return Number(parsedValue.toFixed(fractionDigits));
  }

  function normalizeIntegerFilterRange(minValue, maxValue) {
    const normalizedMinValue = formatOptionalFilterNumber(minValue, { integer: true });
    const normalizedMaxValue = formatOptionalFilterNumber(maxValue, { integer: true });

    if (
      normalizedMinValue !== ''
      && normalizedMaxValue !== ''
      && normalizedMinValue > normalizedMaxValue
    ) {
      return {
        minValue: normalizedMaxValue,
        maxValue: normalizedMinValue
      };
    }

    return {
      minValue: normalizedMinValue,
      maxValue: normalizedMaxValue
    };
  }

  function normalizeFilterSettingsPayload(payload = {}) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const savedVersion = normalizeNonNegativeInteger(source.version, 0);
    const useLegacyActivityRemainingDaysValue = (
      savedVersion > 0
      && savedVersion < FILTER_SETTINGS_VERSION
      && (source.minActivityRemainingDays === undefined || source.minActivityRemainingDays === null || source.minActivityRemainingDays === '')
      && source.maxActivityRemainingDays !== undefined
      && source.maxActivityRemainingDays !== null
      && source.maxActivityRemainingDays !== ''
    );
    const enrollRemainingRange = normalizeIntegerFilterRange(
      source.minEnrollRemainingDays,
      source.maxEnrollRemainingDays
    );
    const activityRemainingRange = normalizeIntegerFilterRange(
      useLegacyActivityRemainingDaysValue ? source.maxActivityRemainingDays : source.minActivityRemainingDays,
      useLegacyActivityRemainingDaysValue ? '' : source.maxActivityRemainingDays
    );

    return {
      version: FILTER_SETTINGS_VERSION,
      updatedAt: normalizeText(source.updatedAt) || nowIso(),
      minDiscountRate: formatOptionalFilterNumber(source.minDiscountRate, { fractionDigits: 2 }),
      minEnrollRemainingDays: enrollRemainingRange.minValue,
      maxEnrollRemainingDays: enrollRemainingRange.maxValue,
      minActivityRemainingDays: activityRemainingRange.minValue,
      maxActivityRemainingDays: activityRemainingRange.maxValue,
      activityThemeTypes: normalizeActivityThemeTypeFilterValues(source.activityThemeTypes)
    };
  }

  function createActivityMatchBatchQueryCanceledError(message = '\u6d3b\u52a8\u5546\u54c1\u6279\u91cf\u67e5\u8be2\u5df2\u505c\u6b62') {
    const error = new Error(message);
    error.code = 'OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_QUERY_CANCELED';
    return error;
  }

  function isActivityMatchBatchQueryCanceledError(error) {
    return Boolean(error && error.code === 'OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_QUERY_CANCELED');
  }

  function createActivityMatchBatchQueryJob(requestId) {
    const normalizedRequestId = normalizeText(requestId) || `activity_batch_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const job = {
      requestId: normalizedRequestId,
      canceled: false,
      cacheKey: ''
    };

    activeBatchQueryJobsByRequestId.set(normalizedRequestId, job);
    return job;
  }

  function getActivityMatchBatchQueryJob(payload = {}) {
    const requestId = normalizeText(payload && payload.requestId);
    return requestId && activeBatchQueryJobsByRequestId.has(requestId)
      ? (activeBatchQueryJobsByRequestId.get(requestId) || null)
      : null;
  }

  function clearActivityMatchBatchQueryJob(job) {
    if (!job) {
      return;
    }

    if (job.requestId && activeBatchQueryJobsByRequestId.get(job.requestId) === job) {
      activeBatchQueryJobsByRequestId.delete(job.requestId);
    }
  }

  function cancelActivityMatchBatchQueryJob(job) {
    if (!job || job.canceled === true) {
      return false;
    }

    job.canceled = true;
    return true;
  }

  function assertActivityMatchBatchQueryJobActive(job) {
    if (job && job.canceled === true) {
      throw createActivityMatchBatchQueryCanceledError();
    }
  }

  function createActivityBatchSignupCanceledError(message = '\u6d3b\u52a8\u6279\u91cf\u62a5\u540d\u5df2\u505c\u6b62') {
    const error = new Error(message);
    error.code = 'OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_SIGNUP_CANCELED';
    return error;
  }

  function isActivityBatchSignupCanceledError(error) {
    return Boolean(
      error
      && (
        error.code === 'OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_SIGNUP_CANCELED'
        || error.name === 'AbortError'
      )
    );
  }

  function createActivityBatchSignupJob(requestId) {
    const normalizedRequestId = normalizeText(requestId) || `activity_signup_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const job = {
      requestId: normalizedRequestId,
      canceled: false,
      activeControllers: new Set()
    };

    activeBatchSignupJobsByRequestId.set(normalizedRequestId, job);
    return job;
  }

  function getActivityBatchSignupJob(payload = {}) {
    const requestId = normalizeText(payload && payload.requestId);
    return requestId && activeBatchSignupJobsByRequestId.has(requestId)
      ? (activeBatchSignupJobsByRequestId.get(requestId) || null)
      : null;
  }

  function clearActivityBatchSignupJob(job) {
    if (!job) {
      return;
    }

    if (job.requestId && activeBatchSignupJobsByRequestId.get(job.requestId) === job) {
      activeBatchSignupJobsByRequestId.delete(job.requestId);
    }
  }

  function registerActivityBatchSignupJobController(job, controller) {
    if (!job || !controller) {
      return;
    }

    job.activeControllers.add(controller);

    if (job.canceled === true) {
      try {
        controller.abort();
      } catch (_error) {
        // ignore abort failure
      }
    }
  }

  function unregisterActivityBatchSignupJobController(job, controller) {
    if (!job || !controller || !job.activeControllers.has(controller)) {
      return;
    }

    job.activeControllers.delete(controller);
  }

  function cancelActivityBatchSignupJob(job) {
    if (!job || job.canceled === true) {
      return false;
    }

    job.canceled = true;

    Array.from(job.activeControllers).forEach((controller) => {
      try {
        controller.abort();
      } catch (_error) {
        // ignore abort failure
      }
    });

    return true;
  }

  function assertActivityBatchSignupJobActive(job) {
    if (job && job.canceled === true) {
      throw createActivityBatchSignupCanceledError();
    }
  }

  function normalizeActivityProductFilterMode(value) {
    const normalizedValue = normalizeText(value);
    return ['suggestActivityPrice', 'dailyDiscount', 'dailyReduce', 'costMarkup', 'profitRateDiscount', 'saleProfitRate'].includes(normalizedValue)
      ? normalizedValue
      : 'suggestActivityPrice';
  }

  function normalizeActivityProductProfitFloorRelation(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return ['and', 'or'].includes(normalizedValue) ? normalizedValue : 'and';
  }

  function normalizeActivityProductSubmitFloorBasis(value) {
    const normalizedValue = normalizeText(value);
    return ['profitFloorRate', 'profitFloorValue'].includes(normalizedValue)
      ? normalizedValue
      : 'profitFloorRate';
  }

  function resolveActivityProductFilterModeValue(settings, mode) {
    const normalizedSettings = settings && typeof settings === 'object' ? settings : {};
    const normalizedMode = normalizeActivityProductFilterMode(mode || normalizedSettings.mode);

    if (normalizedMode === 'dailyDiscount') {
      return formatOptionalFilterNumber(normalizedSettings.modeValueDailyDiscount, { fractionDigits: 2 });
    }

    if (normalizedMode === 'saleProfitRate') {
      return formatOptionalFilterNumber(normalizedSettings.modeValueSaleProfitRate, { fractionDigits: 2 });
    }

    if (normalizedMode === 'profitRateDiscount') {
      return formatOptionalFilterNumber(normalizedSettings.modeValueProfitRateDiscount, { fractionDigits: 2 });
    }

    if (normalizedMode === 'dailyReduce') {
      return formatOptionalFilterNumber(normalizedSettings.modeValueDailyReduce, { fractionDigits: 2 });
    }

    if (normalizedMode === 'costMarkup') {
      return formatOptionalFilterNumber(normalizedSettings.modeValueCostMarkup, { fractionDigits: 2 });
    }

    return '';
  }

  function normalizeActivityProductFilterSettingsPayload(payload = {}) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const mode = normalizeActivityProductFilterMode(source.mode);
    const legacyModeValue = formatOptionalFilterNumber(source.modeValue, { fractionDigits: 2 });
    let modeValueDailyDiscount = formatOptionalFilterNumber(source.modeValueDailyDiscount, { fractionDigits: 2 });
    let modeValueSaleProfitRate = formatOptionalFilterNumber(source.modeValueSaleProfitRate, { fractionDigits: 2 });
    let modeValueProfitRateDiscount = formatOptionalFilterNumber(source.modeValueProfitRateDiscount, { fractionDigits: 2 });
    let modeValueDailyReduce = formatOptionalFilterNumber(source.modeValueDailyReduce, { fractionDigits: 2 });
    let modeValueCostMarkup = formatOptionalFilterNumber(source.modeValueCostMarkup, { fractionDigits: 2 });

    if (modeValueDailyDiscount === '' && mode === 'dailyDiscount' && legacyModeValue !== '') {
      modeValueDailyDiscount = legacyModeValue;
    }

    if (modeValueSaleProfitRate === '' && mode === 'saleProfitRate' && legacyModeValue !== '') {
      modeValueSaleProfitRate = legacyModeValue;
    }

    if (modeValueProfitRateDiscount === '' && mode === 'profitRateDiscount' && legacyModeValue !== '') {
      modeValueProfitRateDiscount = legacyModeValue;
    }

    if (modeValueDailyReduce === '' && mode === 'dailyReduce' && legacyModeValue !== '') {
      modeValueDailyReduce = legacyModeValue;
    }

    if (modeValueCostMarkup === '' && mode === 'costMarkup' && legacyModeValue !== '') {
      modeValueCostMarkup = legacyModeValue;
    }

    const normalizedSettings = {
      version: PRODUCT_FILTER_SETTINGS_VERSION,
      updatedAt: normalizeText(source.updatedAt) || nowIso(),
      mode,
      modeValueDailyDiscount,
      modeValueSaleProfitRate,
      modeValueProfitRateDiscount,
      modeValueDailyReduce,
      modeValueCostMarkup,
      clampToSuggestPrice: normalizeBooleanSetting(source.clampToSuggestPrice, false),
      profitFloorRate: formatOptionalFilterNumber(source.profitFloorRate, { fractionDigits: 2 }),
      profitFloorRelation: normalizeActivityProductProfitFloorRelation(source.profitFloorRelation),
      profitFloorValue: formatOptionalFilterNumber(source.profitFloorValue, { fractionDigits: 2 }),
      submitAtProfitFloor: normalizeBooleanSetting(source.submitAtProfitFloor, false),
      submitAtProfitFloorBasis: normalizeActivityProductSubmitFloorBasis(source.submitAtProfitFloorBasis)
    };

    normalizedSettings.modeValue = resolveActivityProductFilterModeValue(normalizedSettings, mode);
    return normalizedSettings;
  }

  function normalizeTextArray(input) {
    const source = Array.isArray(input)
      ? input
      : (input === null || input === undefined ? [] : [input]);

    return Array.from(new Set(
      source
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    ));
  }

  function normalizeLabelList(input) {
    const source = Array.isArray(input) ? input : [];
    const seen = new Set();
    const result = [];

    source.forEach((entry) => {
      const normalizedEntry = entry && typeof entry === 'object'
        ? {
          key: normalizeText(entry.key),
          value: normalizeText(entry.value)
        }
        : {
          key: '',
          value: normalizeText(entry)
        };

      if (!normalizedEntry.key && !normalizedEntry.value) {
        return;
      }

      const dedupKey = `${normalizedEntry.key}\x1f${normalizedEntry.value}`;

      if (seen.has(dedupKey)) {
        return;
      }

      seen.add(dedupKey);
      result.push(normalizedEntry);
    });

    return result;
  }

  function normalizeSiteEntries(activity) {
    const siteMap = new Map();
    const source = activity && typeof activity === 'object' ? activity : {};

    function addSite(siteId, siteName) {
      const normalizedSiteId = normalizeText(siteId);
      const normalizedSiteName = normalizeText(siteName);
      const mapKey = normalizedSiteId || normalizedSiteName;

      if (!mapKey) {
        return;
      }

      if (!siteMap.has(mapKey)) {
        siteMap.set(mapKey, {
          siteId: normalizedSiteId,
          siteName: normalizedSiteName
        });
      } else {
        const existing = siteMap.get(mapKey);
        if (!existing.siteId && normalizedSiteId) {
          existing.siteId = normalizedSiteId;
        }
        if (!existing.siteName && normalizedSiteName) {
          existing.siteName = normalizedSiteName;
        }
      }
    }

    (Array.isArray(source.sites) ? source.sites : []).forEach((site) => {
      addSite(site && site.siteId, site && site.siteName);
    });

    (Array.isArray(source.sessionList) ? source.sessionList : []).forEach((sessionItem) => {
      addSite(sessionItem && sessionItem.siteId, sessionItem && sessionItem.siteName);
    });

    (Array.isArray(source.sessionAggList) ? source.sessionAggList : []).forEach((sessionItem) => {
      addSite(sessionItem && sessionItem.siteId, sessionItem && sessionItem.siteName);
    });

    const siteEntries = Array.from(siteMap.values());

    return {
      siteIds: normalizeTextArray(siteEntries.map((entry) => entry.siteId)),
      siteNames: normalizeTextArray(siteEntries.map((entry) => entry.siteName))
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
    if (!shopManagementService || typeof shopManagementService.getState !== 'function') {
      return [];
    }

    const state = await shopManagementService.getState();
    const sourceShops = Array.isArray(state && state.shops) ? state.shops : [];

    return sourceShops
      .map((shop) => ({
        shopId: normalizeText(shop && shop.id),
        shopName: normalizeText(shop && shop.shopName),
        platformShopId: normalizeText(shop && shop.platformShopId),
        updatedAt: normalizeText(shop && shop.updatedAt),
        isParticipating: isShopParticipating(shop)
      }))
      .filter((shop) => shop.shopId);
  }

  async function resolveSelectedShops(selectedShopIds) {
    const allShops = await listAllShopSummaries();
    const allShopMap = new Map(allShops.map((shop) => [shop.shopId, shop]));
    const resolvedShops = [];
    const unresolved = [];

    selectedShopIds.forEach((shopId) => {
      const shop = allShopMap.get(shopId);

      if (!shop) {
        unresolved.push({
          shopId,
          shopName: shopId,
          message: '\u5e97\u94fa\u4e0d\u5b58\u5728\u6216\u5df2\u5220\u9664'
        });
        return;
      }

      if (shop.isParticipating !== true) {
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
      throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa');
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
      throw new Error('\u5e97\u94fa\u4f1a\u8bdd\u73af\u5883\u672a\u5c31\u7eea');
    }

    const runtimeProfile = await shopManagementService.getShopRuntimeProfile({
      shopId: normalizedShopId
    });

    return {
      shopId: normalizedShopId,
      shopName: normalizeText(shopSummary && shopSummary.shopName) || normalizeText(runtimeProfile && runtimeProfile.shopName),
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
      '\u6d3b\u52a8 Cookies \u8bfb\u53d6\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );

    try {
      const cookies = await targetSession.cookies.get({
        url: `${origin}/`
      });
      const matchedCookie = (Array.isArray(cookies) ? cookies : []).find((cookie) => (
        normalizeText(cookie && cookie.name).toLowerCase() === 'mallid'
      ));

      return normalizeText(matchedCookie && matchedCookie.value);
    } catch (error) {
      logError('operations_activity_management_cookie_mallid_read_failed', error, {
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
      && (
        sessionContext.mallId
        || (
          sessionContext.sellerSession
          && sessionContext.sellerSession.mallId
        )
      )
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

      return cookieMallId;
    }

    return '';
  }

  async function executeFetchWithTimeout(
    targetSession,
    requestUrl,
    requestInit,
    timeoutMs = QUERY_REQUEST_TIMEOUT_MS,
    options = {}
  ) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const externalSignal = normalizedOptions.signal
      && typeof normalizedOptions.signal === 'object'
      && typeof normalizedOptions.signal.aborted === 'boolean'
      ? normalizedOptions.signal
      : null;
    const abortErrorFactory = typeof normalizedOptions.abortErrorFactory === 'function'
      ? normalizedOptions.abortErrorFactory
      : null;
    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    let timeoutId = 0;
    let removeAbortListener = null;

    if (controller && externalSignal) {
      const abortByExternalSignal = () => {
        try {
          controller.abort();
        } catch (_error) {
          // ignore abort failure
        }
      };

      if (externalSignal.aborted === true) {
        abortByExternalSignal();
      } else if (typeof externalSignal.addEventListener === 'function') {
        externalSignal.addEventListener('abort', abortByExternalSignal, { once: true });
        removeAbortListener = () => {
          try {
            externalSignal.removeEventListener('abort', abortByExternalSignal);
          } catch (_error) {
            // ignore listener cleanup failure
          }
        };
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

        const timeoutError = new Error('\u6d3b\u52a8\u67e5\u8be2\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
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
    } catch (error) {
      if (externalSignal && externalSignal.aborted === true && abortErrorFactory) {
        throw abortErrorFactory();
      }

      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (typeof removeAbortListener === 'function') {
        removeAbortListener();
      }
    }
  }

  async function executeJsonRequest(sessionContext, endpointPath, payload, options = {}) {
    const origin = resolveSellerOrigin(sessionContext);
    const mallId = normalizeText(options && options.mallIdOverride) || await ensureMallId(sessionContext);

    if (!mallId) {
      throw new Error('\u5f53\u524d\u5e97\u94fa\u672a\u83b7\u53d6\u5230 Mallid\uff0c\u8bf7\u5148\u786e\u8ba4 Seller Central \u767b\u5f55\u72b6\u6001');
    }

    const requestUrl = new URL(endpointPath, origin).toString();
    const targetSession = resolveShopScopedFetchSession(
      sessionContext,
      requestUrl,
      '\u6d3b\u52a8\u63a5\u53e3\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
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
    }, options && options.timeoutMs, {
      signal: options && options.signal,
      abortErrorFactory: options && options.abortErrorFactory
    });
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
      const error = new Error(message || '\u6d3b\u52a8\u67e5\u8be2\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38');
      error.httpStatus = Number(response && response.status) || 0;
      error.responsePayload = parsedPayload;
      error.responseText = responseText;
      throw error;
    }

    return parsedPayload;
  }

  function buildActivityThematicIdRequestValue(activityThematicId) {
    const normalizedValue = normalizeText(activityThematicId);

    if (!normalizedValue) {
      return '';
    }

    if (!/^\d+$/.test(normalizedValue)) {
      return normalizedValue;
    }

    const numericValue = Number(normalizedValue);
    return Number.isSafeInteger(numericValue) ? numericValue : normalizedValue;
  }

  function mergeTextArray(left, right) {
    return Array.from(new Set([
      ...normalizeTextArray(left),
      ...normalizeTextArray(right)
    ]));
  }

  function buildActivityMatchBatchProgressMessage(payload = {}) {
    const parts = [];
    const phase = normalizeText(payload.phase);
    const currentActivityIndex = normalizeNonNegativeInteger(payload.currentActivityIndex, 0);
    const totalActivityCount = normalizeNonNegativeInteger(payload.totalActivityCount, 0);
    const currentActivityName = normalizeText(payload.currentActivityName);
    const currentShopIndex = normalizeNonNegativeInteger(payload.currentShopIndex, 0);
    const totalShopCount = normalizeNonNegativeInteger(payload.totalShopCount, 0);
    const currentShopName = normalizeText(payload.currentShopName);
    const currentPageIndex = normalizeNonNegativeInteger(payload.currentPageIndex, 0);
    const currentPageCount = normalizeNonNegativeInteger(payload.currentPageCount, 0);
    const currentActivityRawProductCount = normalizeNonNegativeInteger(payload.currentActivityRawProductCount, 0);
    const currentActivityUniqueProductCount = normalizeNonNegativeInteger(payload.currentActivityUniqueProductCount, 0);
    const totalRawProductCount = normalizeNonNegativeInteger(payload.totalRawProductCount, 0);
    const totalUniqueProductCount = normalizeNonNegativeInteger(payload.totalUniqueProductCount, 0);
    const currentActivityDoneCount = normalizeNonNegativeInteger(payload.currentActivityDoneCount, 0);
    const totalActivitySuccessCount = normalizeNonNegativeInteger(payload.totalActivitySuccessCount, 0);
    const totalActivityFailedCount = normalizeNonNegativeInteger(payload.totalActivityFailedCount, 0);

    if (totalActivityCount > 0 && currentActivityIndex > 0) {
      parts.push(`\u6d3b\u52a8 ${currentActivityIndex}/${totalActivityCount}`);
    } else if (totalActivityCount > 0) {
      parts.push(`\u5171 ${totalActivityCount} \u4e2a\u6d3b\u52a8`);
    }

    if (currentActivityName) {
      parts.push(`\u201c${currentActivityName}\u201d`);
    }

    if (totalShopCount > 0 && currentShopIndex > 0) {
      const shopLabel = currentShopName ? ` \u201c${currentShopName}\u201d` : '';
      parts.push(`\u5e97\u94fa ${currentShopIndex}/${totalShopCount}${shopLabel}`);
    } else if (totalShopCount > 0 && (phase === 'batch-start' || phase === 'activity-start')) {
      parts.push(`\u5171 ${totalShopCount} \u5bb6\u5e97\u94fa`);
    }

    if (currentPageCount > 0 && currentPageIndex > 0) {
      parts.push(`\u7b2c ${currentPageIndex}/${currentPageCount} \u9875`);
    } else if (currentPageIndex > 0) {
      parts.push(`\u7b2c ${currentPageIndex} \u9875`);
    }

    if (currentActivityRawProductCount > 0 || currentActivityUniqueProductCount > 0) {
      parts.push(`\u5f53\u524d\u6d3b\u52a8 ${currentActivityRawProductCount}\u6761/\u6d3b\u52a8\u5546\u54c1 ${currentActivityUniqueProductCount}\u6761`);
    }

    if (totalRawProductCount > 0 || totalUniqueProductCount > 0) {
      parts.push(`\u7d2f\u8ba1 ${totalRawProductCount}\u6761/\u6d3b\u52a8\u5546\u54c1 ${totalUniqueProductCount}\u6761`);
    }

    if (currentActivityDoneCount > 0 && (totalActivitySuccessCount > 0 || totalActivityFailedCount > 0)) {
      parts.push(`\u5df2\u5b8c\u6210 ${currentActivityDoneCount} \u4e2a`);
    }

    if (totalActivitySuccessCount > 0 || totalActivityFailedCount > 0) {
      parts.push(`\u6210\u529f ${totalActivitySuccessCount} \u4e2a / \u5931\u8d25 ${totalActivityFailedCount} \u4e2a`);
    }

    if (phase === 'activity-start') {
      parts.unshift('\u6b63\u5728\u67e5\u8be2\u4e2d');
    } else if (phase === 'activity-page') {
      parts.unshift('\u6b63\u5728\u89e3\u6790\u5206\u9875');
    } else if (phase === 'activity-done') {
      parts.unshift('\u5f53\u524d\u6d3b\u52a8\u5df2\u5b8c\u6210');
    } else if (phase === 'batch-done') {
      parts.unshift('\u6279\u91cf\u67e5\u8be2\u5b8c\u6210');
    } else if (phase === 'batch-start') {
      parts.unshift('\u6b63\u5728\u9010\u4e2a\u6d3b\u52a8\u67e5\u8be2\u5546\u54c1');
    }

    return parts.join(' \u3001 ') || '\u6b63\u5728\u67e5\u8be2\u6d3b\u52a8\u5546\u54c1...';
  }

  function buildActivityMatchBatchProgressPayload(progressContext, payload = {}) {
    const context = progressContext && typeof progressContext === 'object' ? progressContext : {};
    const source = payload && typeof payload === 'object' ? payload : {};

    return {
      success: true,
      updatedAt: nowIso(),
      requestId: normalizeText(source.requestId || context.requestId),
      phase: normalizeText(source.phase) || 'progress',
      totalActivityCount: normalizeNonNegativeInteger(source.totalActivityCount, normalizeNonNegativeInteger(context.totalActivityCount, 0)),
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, normalizeNonNegativeInteger(context.totalShopCount, 0)),
      currentActivityIndex: normalizeNonNegativeInteger(source.currentActivityIndex, normalizeNonNegativeInteger(context.currentActivityIndex, 0)),
      currentActivityName: normalizeText(source.currentActivityName || context.currentActivityName),
      currentActivityKey: normalizeText(source.currentActivityKey || context.currentActivityKey),
      currentShopIndex: normalizeNonNegativeInteger(source.currentShopIndex, normalizeNonNegativeInteger(context.currentShopIndex, 0)),
      currentShopName: normalizeText(source.currentShopName || context.currentShopName),
      currentPageIndex: normalizeNonNegativeInteger(source.currentPageIndex, normalizeNonNegativeInteger(context.currentPageIndex, 0)),
      currentPageCount: normalizeNonNegativeInteger(source.currentPageCount, normalizeNonNegativeInteger(context.currentPageCount, 0)),
      currentActivityRawProductCount: normalizeNonNegativeInteger(source.currentActivityRawProductCount, normalizeNonNegativeInteger(context.currentActivityRawProductCount, 0)),
      currentActivityUniqueProductCount: normalizeNonNegativeInteger(source.currentActivityUniqueProductCount, normalizeNonNegativeInteger(context.currentActivityUniqueProductCount, 0)),
      totalRawProductCount: normalizeNonNegativeInteger(source.totalRawProductCount, normalizeNonNegativeInteger(context.totalRawProductCount, 0)),
      totalUniqueProductCount: normalizeNonNegativeInteger(source.totalUniqueProductCount, normalizeNonNegativeInteger(context.totalUniqueProductCount, 0)),
      currentActivityDoneCount: normalizeNonNegativeInteger(source.currentActivityDoneCount, normalizeNonNegativeInteger(context.currentActivityDoneCount, 0)),
      totalActivitySuccessCount: normalizeNonNegativeInteger(source.totalActivitySuccessCount, normalizeNonNegativeInteger(context.totalActivitySuccessCount, 0)),
      totalActivityFailedCount: normalizeNonNegativeInteger(source.totalActivityFailedCount, normalizeNonNegativeInteger(context.totalActivityFailedCount, 0)),
      message: normalizeText(source.message) || buildActivityMatchBatchProgressMessage({
        ...context,
        ...source
      })
    };
  }

  function emitActivityMatchBatchProgress(progressEmitter, progressContext, payload = {}) {
    if (typeof progressEmitter !== 'function') {
      return;
    }

    try {
      progressEmitter(buildActivityMatchBatchProgressPayload(progressContext, payload));
    } catch (error) {
      logError('operations_activity_management_batch_progress_emit_failed', error, {
        requestId: normalizeText(progressContext && progressContext.requestId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  function buildActivityBatchSignupProgressMessage(payload = {}) {
    const parts = [];
    const phase = normalizeText(payload.phase);
    const totalShopCount = normalizeNonNegativeInteger(payload.totalShopCount, 0);
    const currentShopIndex = normalizeNonNegativeInteger(payload.currentShopIndex, 0);
    const currentShopName = normalizeText(payload.currentShopName);
    const completedShopCount = normalizeNonNegativeInteger(payload.completedShopCount, 0);
    const failedShopCount = normalizeNonNegativeInteger(payload.failedShopCount, 0);
    const totalGroupCount = normalizeNonNegativeInteger(payload.totalGroupCount, 0);
    const currentGroupIndex = normalizeNonNegativeInteger(payload.currentGroupIndex, 0);
    const currentGroupCount = normalizeNonNegativeInteger(payload.currentGroupCount, 0);
    const currentActivityName = normalizeText(payload.currentActivityName);
    const totalRequestCount = normalizeNonNegativeInteger(payload.totalRequestCount, 0);
    const completedRequestCount = normalizeNonNegativeInteger(payload.completedRequestCount, 0);
    const failedRequestCount = normalizeNonNegativeInteger(payload.failedRequestCount, 0);
    const currentChunkIndex = normalizeNonNegativeInteger(payload.currentChunkIndex, 0);
    const currentChunkCount = normalizeNonNegativeInteger(payload.currentChunkCount, 0);
    const currentChunkRowCount = normalizeNonNegativeInteger(payload.currentChunkRowCount, 0);
    const successRowCount = normalizeNonNegativeInteger(payload.successRowCount, 0);
    const failedRowCount = normalizeNonNegativeInteger(payload.failedRowCount, 0);
    const skippedRowCount = normalizeNonNegativeInteger(payload.skippedRowCount, 0);

    if (totalShopCount > 0 && currentShopIndex > 0) {
      const shopLabel = currentShopName ? ` \u201c${currentShopName}\u201d` : '';
      parts.push(`\u5e97\u94fa ${currentShopIndex}/${totalShopCount}${shopLabel}`);
    } else if (totalShopCount > 0) {
      parts.push(`\u5171 ${totalShopCount} \u5bb6\u5e97\u94fa`);
    }

    if (currentGroupCount > 0 && currentGroupIndex > 0) {
      parts.push(`\u6d3b\u52a8\u7ec4 ${currentGroupIndex}/${currentGroupCount}`);
    } else if (totalGroupCount > 0 && currentGroupIndex > 0) {
      parts.push(`\u6d3b\u52a8\u7ec4 ${currentGroupIndex}/${totalGroupCount}`);
    } else if (totalGroupCount > 0 && phase === 'signup-start') {
      parts.push(`\u5171 ${totalGroupCount} \u4e2a\u6d3b\u52a8\u7ec4`);
    }

    if (currentActivityName) {
      parts.push(`\u201c${currentActivityName}\u201d`);
    }

    if (currentChunkCount > 0 && currentChunkIndex > 0) {
      parts.push(`\u6279\u6b21 ${currentChunkIndex}/${currentChunkCount}`);
    }

    if (currentChunkRowCount > 0) {
      parts.push(`${currentChunkRowCount} \u4e2a\u5546\u54c1`);
    }

    if (totalRequestCount > 0) {
      parts.push(`\u8bf7\u6c42 ${completedRequestCount}/${totalRequestCount}`);
    }

    if (completedShopCount > 0 || failedShopCount > 0) {
      parts.push(`\u5df2\u5b8c\u6210\u5e97\u94fa ${completedShopCount}/${totalShopCount}`);
    }

    if (successRowCount > 0 || failedRowCount > 0) {
      parts.push(`\u6210\u529f ${successRowCount} / \u5931\u8d25 ${failedRowCount}`);
    }

    if (skippedRowCount > 0) {
      parts.push(`\u8df3\u8fc7 ${skippedRowCount}`);
    }

    if (failedRequestCount > 0) {
      parts.push(`\u5931\u8d25\u8bf7\u6c42 ${failedRequestCount}`);
    }

    if (phase === 'signup-start') {
      parts.unshift('\u6b63\u5728\u51c6\u5907\u6279\u91cf\u63d0\u4ea4');
    } else if (phase === 'signup-shop-start') {
      parts.unshift('\u6b63\u5728\u63d0\u4ea4\u5e97\u94fa');
    } else if (phase === 'signup-chunk-submit') {
      parts.unshift('\u6b63\u5728\u63d0\u4ea4\u6279\u6b21');
    } else if (phase === 'signup-chunk-done') {
      parts.unshift('\u5f53\u524d\u6279\u6b21\u5df2\u5b8c\u6210');
    } else if (phase === 'signup-chunk-failed') {
      parts.unshift('\u5f53\u524d\u6279\u6b21\u63d0\u4ea4\u5931\u8d25');
    } else if (phase === 'signup-shop-done') {
      parts.unshift('\u5f53\u524d\u5e97\u94fa\u5df2\u5b8c\u6210');
    } else if (phase === 'signup-shop-failed') {
      parts.unshift('\u5f53\u524d\u5e97\u94fa\u63d0\u4ea4\u5931\u8d25');
    } else if (phase === 'signup-done') {
      parts.unshift('\u6279\u91cf\u63d0\u4ea4\u5df2\u5b8c\u6210');
    } else if (phase === 'signup-canceled') {
      parts.unshift('\u6279\u91cf\u63d0\u4ea4\u5df2\u505c\u6b62');
    }

    return parts.join(' \u3001 ') || '\u6b63\u5728\u6279\u91cf\u63d0\u4ea4\u6d3b\u52a8...';
  }

  function buildActivityBatchSignupProgressPayload(progressContext, payload = {}) {
    const context = progressContext && typeof progressContext === 'object' ? progressContext : {};
    const source = payload && typeof payload === 'object' ? payload : {};

    return {
      success: true,
      updatedAt: nowIso(),
      taskType: 'submit',
      requestId: normalizeText(source.requestId || context.requestId),
      phase: normalizeText(source.phase) || 'signup-progress',
      totalInputRowCount: normalizeNonNegativeInteger(source.totalInputRowCount, normalizeNonNegativeInteger(context.totalInputRowCount, 0)),
      submittedRowCount: normalizeNonNegativeInteger(source.submittedRowCount, normalizeNonNegativeInteger(context.submittedRowCount, 0)),
      skippedRowCount: normalizeNonNegativeInteger(source.skippedRowCount, normalizeNonNegativeInteger(context.skippedRowCount, 0)),
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, normalizeNonNegativeInteger(context.totalShopCount, 0)),
      completedShopCount: normalizeNonNegativeInteger(source.completedShopCount, normalizeNonNegativeInteger(context.completedShopCount, 0)),
      failedShopCount: normalizeNonNegativeInteger(source.failedShopCount, normalizeNonNegativeInteger(context.failedShopCount, 0)),
      currentShopIndex: normalizeNonNegativeInteger(source.currentShopIndex, normalizeNonNegativeInteger(context.currentShopIndex, 0)),
      currentShopName: normalizeText(source.currentShopName || context.currentShopName),
      totalGroupCount: normalizeNonNegativeInteger(source.totalGroupCount, normalizeNonNegativeInteger(context.totalGroupCount, 0)),
      currentGroupIndex: normalizeNonNegativeInteger(source.currentGroupIndex, normalizeNonNegativeInteger(context.currentGroupIndex, 0)),
      currentGroupCount: normalizeNonNegativeInteger(source.currentGroupCount, normalizeNonNegativeInteger(context.currentGroupCount, 0)),
      currentActivityName: normalizeText(source.currentActivityName || context.currentActivityName),
      currentActivityKey: normalizeText(source.currentActivityKey || context.currentActivityKey),
      totalRequestCount: normalizeNonNegativeInteger(source.totalRequestCount, normalizeNonNegativeInteger(context.totalRequestCount, 0)),
      completedRequestCount: normalizeNonNegativeInteger(source.completedRequestCount, normalizeNonNegativeInteger(context.completedRequestCount, 0)),
      failedRequestCount: normalizeNonNegativeInteger(source.failedRequestCount, normalizeNonNegativeInteger(context.failedRequestCount, 0)),
      currentChunkIndex: normalizeNonNegativeInteger(source.currentChunkIndex, normalizeNonNegativeInteger(context.currentChunkIndex, 0)),
      currentChunkCount: normalizeNonNegativeInteger(source.currentChunkCount, normalizeNonNegativeInteger(context.currentChunkCount, 0)),
      currentChunkRowCount: normalizeNonNegativeInteger(source.currentChunkRowCount, normalizeNonNegativeInteger(context.currentChunkRowCount, 0)),
      successRowCount: normalizeNonNegativeInteger(source.successRowCount, normalizeNonNegativeInteger(context.successRowCount, 0)),
      failedRowCount: normalizeNonNegativeInteger(source.failedRowCount, normalizeNonNegativeInteger(context.failedRowCount, 0)),
      message: normalizeText(source.message) || buildActivityBatchSignupProgressMessage({
        ...context,
        ...source
      })
    };
  }

  function emitActivityBatchSignupProgress(progressEmitter, progressContext, payload = {}) {
    if (typeof progressEmitter !== 'function') {
      return;
    }

    try {
      progressEmitter(buildActivityBatchSignupProgressPayload(progressContext, payload));
    } catch (error) {
      logError('operations_activity_management_batch_signup_progress_emit_failed', error, {
        requestId: normalizeText(progressContext && progressContext.requestId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  function normalizeProductShopScopeList(input) {
    const source = Array.isArray(input) ? input : [];
    const scopeMap = new Map();

    source.forEach((item) => {
      const normalizedShopId = normalizeText(item && item.shopId);
      const normalizedShopName = normalizeText(item && item.shopName) || normalizedShopId;
      const scopeKey = normalizedShopId || normalizedShopName;

      if (!scopeKey) {
        return;
      }

      const nextScope = {
        shopId: normalizedShopId,
        shopName: normalizedShopName,
        siteIds: normalizeTextArray(item && item.siteIds),
        siteNames: normalizeTextArray(item && item.siteNames),
        suggestEnrollSessionIdList: normalizeTextArray(item && item.suggestEnrollSessionIdList),
        enrollSessionIdList: normalizeTextArray(item && item.enrollSessionIdList)
      };

      if (!scopeMap.has(scopeKey)) {
        scopeMap.set(scopeKey, nextScope);
        return;
      }

      const currentScope = scopeMap.get(scopeKey);

      currentScope.shopId = currentScope.shopId || nextScope.shopId;
      currentScope.shopName = currentScope.shopName || nextScope.shopName;
      currentScope.siteIds = mergeTextArray(currentScope.siteIds, nextScope.siteIds);
      currentScope.siteNames = mergeTextArray(currentScope.siteNames, nextScope.siteNames);
      currentScope.suggestEnrollSessionIdList = mergeTextArray(
        currentScope.suggestEnrollSessionIdList,
        nextScope.suggestEnrollSessionIdList
      );
      currentScope.enrollSessionIdList = mergeTextArray(
        currentScope.enrollSessionIdList,
        nextScope.enrollSessionIdList
      );
    });

    return Array.from(scopeMap.values());
  }

  function mergeProductShopScopeList(left, right) {
    return normalizeProductShopScopeList([
      ...(Array.isArray(left) ? left : []),
      ...(Array.isArray(right) ? right : [])
    ]);
  }

  function normalizeProductActivityScopeList(input) {
    const source = Array.isArray(input) ? input : [];
    const scopeMap = new Map();

    source.forEach((item) => {
      const activityKey = normalizeText(item && item.activityKey);
      const activityType = normalizeOptionalNumber(item && item.activityType);
      const activityThematicId = normalizeText(item && item.activityThematicId);
      const activityName = normalizeText(item && item.activityName);
      const shopId = normalizeText(item && item.shopId);
      const shopName = normalizeText(item && item.shopName) || shopId;
      const scopeKey = [
        activityKey,
        activityType === null ? '' : String(activityType),
        activityThematicId,
        shopId || shopName
      ].join('\x1f');

      if (!activityKey || !(shopId || shopName)) {
        return;
      }

      const nextScope = {
        activityKey,
        activityType,
        activityThematicId,
        activityName,
        shopId,
        shopName,
        siteIds: normalizeTextArray(item && item.siteIds),
        siteNames: normalizeTextArray(item && item.siteNames),
        suggestEnrollSessionIdList: normalizeTextArray(item && item.suggestEnrollSessionIdList),
        enrollSessionIdList: normalizeTextArray(item && item.enrollSessionIdList)
      };

      if (!scopeMap.has(scopeKey)) {
        scopeMap.set(scopeKey, nextScope);
        return;
      }

      const currentScope = scopeMap.get(scopeKey);

      currentScope.activityType = currentScope.activityType === null ? nextScope.activityType : currentScope.activityType;
      currentScope.activityThematicId = currentScope.activityThematicId || nextScope.activityThematicId;
      currentScope.activityName = currentScope.activityName || nextScope.activityName;
      currentScope.shopId = currentScope.shopId || nextScope.shopId;
      currentScope.shopName = currentScope.shopName || nextScope.shopName;
      currentScope.siteIds = mergeTextArray(currentScope.siteIds, nextScope.siteIds);
      currentScope.siteNames = mergeTextArray(currentScope.siteNames, nextScope.siteNames);
      currentScope.suggestEnrollSessionIdList = mergeTextArray(
        currentScope.suggestEnrollSessionIdList,
        nextScope.suggestEnrollSessionIdList
      );
      currentScope.enrollSessionIdList = mergeTextArray(
        currentScope.enrollSessionIdList,
        nextScope.enrollSessionIdList
      );
    });

    return Array.from(scopeMap.values());
  }

  function mergeProductActivityScopeList(left, right) {
    return normalizeProductActivityScopeList([
      ...(Array.isArray(left) ? left : []),
      ...(Array.isArray(right) ? right : [])
    ]);
  }

  function buildFallbackProductShopScopeList(row) {
    const normalizedRow = row && typeof row === 'object' ? row : {};
    const shopIds = normalizeTextArray(normalizedRow.availableShopIds);
    const shopNames = normalizeTextArray(normalizedRow.availableShopNames);
    const maxCount = Math.max(shopIds.length, shopNames.length);
    const fallbackScopes = [];

    for (let index = 0; index < maxCount; index += 1) {
      const shopId = normalizeText(shopIds[index]);
      const shopName = normalizeText(shopNames[index]) || shopId;
      const scopeKey = shopId || shopName;

      if (!scopeKey) {
        continue;
      }

      fallbackScopes.push({
        shopId,
        shopName,
        siteIds: normalizeTextArray(normalizedRow.siteIds),
        siteNames: normalizeTextArray(normalizedRow.siteNames),
        suggestEnrollSessionIdList: normalizeTextArray(normalizedRow.suggestEnrollSessionIdList),
        enrollSessionIdList: normalizeTextArray(normalizedRow.enrollSessionIdList)
      });
    }

    return normalizeProductShopScopeList(fallbackScopes);
  }

  function buildProductActivityScopeList(row, activityMeta) {
    const activityKey = normalizeText(activityMeta && activityMeta.activityKey);

    if (!activityKey) {
      return [];
    }

    const activityType = normalizeOptionalNumber(activityMeta && activityMeta.activityType);
    const activityThematicId = normalizeText(activityMeta && activityMeta.activityThematicId);
    const activityName = buildActivityMatchDisplayName(activityMeta);
    const normalizedShopScopes = normalizeProductShopScopeList(row && row.shopScopes);
    const sourceShopScopes = normalizedShopScopes.length > 0
      ? normalizedShopScopes
      : buildFallbackProductShopScopeList(row);

    return normalizeProductActivityScopeList(
      sourceShopScopes.map((scopeItem) => ({
        activityKey,
        activityType,
        activityThematicId,
        activityName,
        shopId: normalizeText(scopeItem && scopeItem.shopId),
        shopName: normalizeText(scopeItem && scopeItem.shopName),
        siteIds: normalizeTextArray(scopeItem && scopeItem.siteIds),
        siteNames: normalizeTextArray(scopeItem && scopeItem.siteNames),
        suggestEnrollSessionIdList: normalizeTextArray(scopeItem && scopeItem.suggestEnrollSessionIdList),
        enrollSessionIdList: normalizeTextArray(scopeItem && scopeItem.enrollSessionIdList)
      }))
    );
  }

  function mergeLabelList(left, right) {
    return normalizeLabelList([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]);
  }

  function normalizeActivityAvailableShopEntryList(input) {
    const source = Array.isArray(input) ? input : [];
    const entryMap = new Map();

    source.forEach((item) => {
      const shopId = normalizeText(item && item.shopId);
      const shopName = normalizeText(item && item.shopName) || shopId;
      const entryKey = shopId || shopName;

      if (!entryKey) {
        return;
      }

      const nextEntry = {
        shopId,
        shopName,
        enrolledCount: pickFirstNumberValue(item && item.enrolledCount)
      };

      if (!entryMap.has(entryKey)) {
        entryMap.set(entryKey, nextEntry);
        return;
      }

      const currentEntry = entryMap.get(entryKey);

      currentEntry.shopId = currentEntry.shopId || nextEntry.shopId;
      currentEntry.shopName = currentEntry.shopName || nextEntry.shopName;

      if (currentEntry.enrolledCount === null || currentEntry.enrolledCount === undefined) {
        currentEntry.enrolledCount = nextEntry.enrolledCount;
      } else if (nextEntry.enrolledCount !== null && nextEntry.enrolledCount !== undefined) {
        currentEntry.enrolledCount = Math.max(
          normalizeNonNegativeInteger(currentEntry.enrolledCount, 0),
          normalizeNonNegativeInteger(nextEntry.enrolledCount, 0)
        );
      }
    });

    return Array.from(entryMap.values());
  }

  function buildActivityAvailableShopFields(input) {
    const availableShopEntries = normalizeActivityAvailableShopEntryList(input);

    return {
      availableShopEntries,
      availableShopIds: availableShopEntries
        .map((entry) => normalizeText(entry && entry.shopId))
        .filter(Boolean),
      availableShopNames: availableShopEntries
        .map((entry) => normalizeText(entry && entry.shopName) || normalizeText(entry && entry.shopId))
        .filter(Boolean)
    };
  }

  function buildThemeTypeMap(themeTypeMapping) {
    const map = new Map();

    (Array.isArray(themeTypeMapping) ? themeTypeMapping : []).forEach((entry) => {
      const key = normalizeText(entry && entry.key);
      const value = normalizeText(entry && entry.value);

      if (!key || !value) {
        return;
      }

      map.set(key, value);
    });

    return map;
  }

  function pickFirstTextValue(...values) {
    for (const value of values) {
      const normalized = normalizeText(value);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  function pickFirstNumberValue(...values) {
    for (const value of values) {
      const normalized = normalizeOptionalNumber(value);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  function buildActivityRowKey(row) {
    const thematicId = normalizeText(row && row.activityThematicId);

    if (thematicId) {
      return `thematic:${thematicId}`;
    }

    const activityType = normalizeText(row && row.activityType);
    const activityThematicName = normalizeText(row && row.activityThematicName);
    const activityName = normalizeText(row && row.activityName);

    if (activityType && activityThematicName) {
      return `fallback:${activityType}:${activityThematicName}`;
    }

    if (activityType && activityName) {
      return `fallback:${activityType}:${activityName}`;
    }

    return `fallback:${activityType || 'unknown'}:${activityThematicName || activityName || 'unknown'}`;
  }

  function normalizeActivityRow(activity, sourceShop, themeTypeMap) {
    const source = activity && typeof activity === 'object' ? activity : {};
    const normalizedThemeType = pickFirstNumberValue(source.activityThemeType);
    const themeTypeKey = normalizeText(normalizedThemeType);
    const themeTypeLabel = pickFirstTextValue(
      source.activityThemeTypeLabel,
      source.themeTypeLabel,
      source.activityThemeTypeName,
      source.themeTypeName
    ) || (themeTypeKey ? normalizeText(themeTypeMap.get(themeTypeKey)) : '');
    const normalizedSiteEntries = normalizeSiteEntries(source);
    const normalizedShopId = normalizeText(sourceShop && sourceShop.shopId);
    const normalizedShopName = normalizeText(sourceShop && sourceShop.shopName) || normalizedShopId;
    const availableShopFields = buildActivityAvailableShopFields([{
      shopId: normalizedShopId,
      shopName: normalizedShopName,
      enrolledCount: pickFirstNumberValue(source.enrolledCount)
    }]);
    const normalizedRow = {
      activityKey: '',
      activityThematicId: pickFirstTextValue(source.activityThematicId),
      activityThematicName: pickFirstTextValue(source.activityThematicName, source.activityName),
      activityName: pickFirstTextValue(source.activityName),
      activityType: pickFirstNumberValue(source.activityType),
      activityThemeType: normalizedThemeType,
      activityThemeTypeLabel: themeTypeLabel,
      activityContent: pickFirstTextValue(source.activityContent),
      activityThematicContent: pickFirstTextValue(source.activityThematicContent),
      activityLabelDesc: pickFirstTextValue(source.activityLabelDesc),
      activityLabelTag: pickFirstTextValue(source.activityLabelTag),
      activityLabelList: normalizeLabelList(source.activityLabelList),
      benefitLabelName: normalizeTextArray(source.benefitLabelName),
      discountThreshold: pickFirstNumberValue(source.discountThreshold),
      stockThreshold: pickFirstNumberValue(source.stockThreshold),
      durationDays: pickFirstNumberValue(source.durationDays),
      priority: pickFirstNumberValue(source.priority),
      enrollStartAt: pickFirstNumberValue(source.enrollStartAt),
      startTime: pickFirstNumberValue(source.startTime, source.sessionStartTime),
      endTime: pickFirstNumberValue(source.endTime, source.sessionEndTime),
      enrollDeadLine: pickFirstNumberValue(source.enrollDeadLine),
      enrolledCount: pickFirstNumberValue(source.enrolledCount),
      sessionAssignType: pickFirstNumberValue(source.sessionAssignType),
      sessionCount: Math.max(
        Array.isArray(source.sessionList) ? source.sessionList.length : 0,
        Array.isArray(source.sessionAggList) ? source.sessionAggList.length : 0
      ),
      siteIds: normalizedSiteEntries.siteIds,
      siteNames: normalizedSiteEntries.siteNames,
      availableShopEntries: availableShopFields.availableShopEntries,
      availableShopIds: availableShopFields.availableShopIds,
      availableShopNames: availableShopFields.availableShopNames,
      sourceShopCount: availableShopFields.availableShopEntries.length
    };

    normalizedRow.activityKey = buildActivityRowKey(normalizedRow);
    return normalizedRow;
  }

  function mergeActivityRows(left, right) {
    const merged = {
      ...left
    };
    const availableShopFields = buildActivityAvailableShopFields([
      ...(Array.isArray(left && left.availableShopEntries) ? left.availableShopEntries : []),
      ...(Array.isArray(right && right.availableShopEntries) ? right.availableShopEntries : [])
    ]);

    [
      'activityThematicId',
      'activityThematicName',
      'activityName',
      'activityThemeTypeLabel',
      'activityContent',
      'activityThematicContent',
      'activityLabelDesc',
      'activityLabelTag'
    ].forEach((fieldName) => {
      if (!normalizeText(merged[fieldName])) {
        merged[fieldName] = normalizeText(right && right[fieldName]);
      }
    });

    [
      'activityType',
      'activityThemeType',
      'discountThreshold',
      'stockThreshold',
      'durationDays',
      'priority',
      'enrollStartAt',
      'startTime',
      'endTime',
      'enrollDeadLine',
      'enrolledCount',
      'sessionAssignType'
    ].forEach((fieldName) => {
      if (merged[fieldName] === null || merged[fieldName] === undefined) {
        merged[fieldName] = normalizeOptionalNumber(right && right[fieldName]);
      }
    });

    merged.sessionCount = Math.max(
      Number(merged.sessionCount) || 0,
      Number(right && right.sessionCount) || 0
    );
    merged.siteIds = mergeTextArray(merged.siteIds, right && right.siteIds);
    merged.siteNames = mergeTextArray(merged.siteNames, right && right.siteNames);
    merged.availableShopEntries = availableShopFields.availableShopEntries;
    merged.availableShopIds = availableShopFields.availableShopIds.length > 0
      ? availableShopFields.availableShopIds
      : mergeTextArray(merged.availableShopIds, right && right.availableShopIds);
    merged.availableShopNames = availableShopFields.availableShopNames.length > 0
      ? availableShopFields.availableShopNames
      : mergeTextArray(merged.availableShopNames, right && right.availableShopNames);
    merged.activityLabelList = mergeLabelList(merged.activityLabelList, right && right.activityLabelList);
    merged.benefitLabelName = mergeTextArray(merged.benefitLabelName, right && right.benefitLabelName);
    merged.sourceShopCount = Math.max(
      merged.availableShopEntries.length,
      merged.availableShopIds.length,
      Number(merged.sourceShopCount) || 0
    );

    return merged;
  }

  function flattenActivityRows(activityList, sourceShop, themeTypeMap) {
    const rows = [];

    (Array.isArray(activityList) ? activityList : []).forEach((activityItem) => {
      const parentItem = activityItem && typeof activityItem === 'object' ? activityItem : {};
      const thematicList = Array.isArray(parentItem.thematicList) ? parentItem.thematicList : [];
      const sourceRows = thematicList.length > 0 ? thematicList : [parentItem];

      sourceRows.forEach((rowItem) => {
        const mergedSource = {
          ...parentItem,
          ...(rowItem && typeof rowItem === 'object' ? rowItem : {})
        };
        rows.push(normalizeActivityRow(mergedSource, sourceShop, themeTypeMap));
      });
    });

    return rows;
  }

  function sortActivityRows(rows) {
    return rows.sort((left, right) => {
      const leftPriority = Number(left && left.priority) || 0;
      const rightPriority = Number(right && right.priority) || 0;

      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority;
      }

      const leftStartTime = Number(left && left.startTime) || 0;
      const rightStartTime = Number(right && right.startTime) || 0;

      if (leftStartTime !== rightStartTime) {
        return leftStartTime - rightStartTime;
      }

      const leftName = normalizeText(left && left.activityThematicName) || normalizeText(left && left.activityName);
      const rightName = normalizeText(right && right.activityThematicName) || normalizeText(right && right.activityName);
      const nameCompare = leftName.localeCompare(rightName, 'zh-CN');

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return normalizeText(left && left.activityKey).localeCompare(normalizeText(right && right.activityKey));
    });
  }

  function buildWarningMessage(summary, shopResults) {
    const failedResults = (Array.isArray(shopResults) ? shopResults : []).filter((entry) => entry && entry.success !== true);
    const failedShopCount = Number(summary && summary.failedShopCount) || 0;
    const successShopCount = Number(summary && summary.successShopCount) || 0;
    const uniqueActivityCount = Number(summary && summary.uniqueActivityCount) || 0;

    if (failedShopCount > 0 && successShopCount > 0) {
      const failedShopPreview = failedResults
        .slice(0, 3)
        .map((entry) => normalizeText(entry && entry.shopName) || normalizeText(entry && entry.shopId))
        .filter(Boolean)
        .join('\u3001');
      const moreText = failedResults.length > 3 ? ` +${failedResults.length - 3}` : '';

      return `\u5df2\u5b8c\u6210 ${successShopCount} \u5bb6\u5e97\u94fa\u67e5\u8be2\uff0c${failedShopCount} \u5bb6\u5931\u8d25${failedShopPreview ? `\uff08${failedShopPreview}${moreText}\uff09` : ''}`;
    }

    if (failedShopCount > 0 && successShopCount <= 0) {
      const firstFailureMessage = normalizeText(failedResults[0] && failedResults[0].message);
      return firstFailureMessage
        ? `\u6240\u9009\u5e97\u94fa\u67e5\u8be2\u5168\u90e8\u5931\u8d25\uff1a${firstFailureMessage}`
        : '\u6240\u9009\u5e97\u94fa\u67e5\u8be2\u5168\u90e8\u5931\u8d25';
    }

    if (uniqueActivityCount <= 0 && successShopCount > 0) {
      return '\u5f53\u524d\u6240\u9009\u5e97\u94fa\u6682\u65e0\u53ef\u62a5\u6d3b\u52a8';
    }

    return '';
  }

  function normalizeActivityMatchRequest(payload = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const cursorSource = source.shopCursorById && typeof source.shopCursorById === 'object'
      ? source.shopCursorById
      : {};
    const normalizedShopCursorById = {};

    Object.keys(cursorSource).forEach((shopId) => {
      const normalizedShopId = normalizeText(shopId);
      const normalizedCursor = normalizeText(cursorSource[shopId]);

      if (normalizedShopId && normalizedCursor) {
        normalizedShopCursorById[normalizedShopId] = normalizedCursor;
      }
    });

    const normalizedPageSize = (() => {
      const numericValue = normalizeNonNegativeInteger(source.pageSize, DEFAULT_ACTIVITY_MATCH_PAGE_SIZE);

      if (numericValue <= 0) {
        return DEFAULT_ACTIVITY_MATCH_PAGE_SIZE;
      }

      return Math.min(MAX_ACTIVITY_MATCH_PAGE_SIZE, numericValue);
    })();

    return {
      shopIds: normalizeSelectedShopIds(source.shopIds),
      activityKey: normalizeText(source.activityKey),
      activityType: normalizeOptionalNumber(source.activityType),
      activityThematicId: normalizeText(source.activityThematicId),
      rowCount: Math.max(1, Number(source.rowCount) || DEFAULT_ACTIVITY_MATCH_ROW_COUNT),
      addSite: source.addSite !== false,
      searchScrollContext: normalizeText(source.searchScrollContext),
      shopCursorById: normalizedShopCursorById,
      cacheKey: normalizeText(source.cacheKey),
      pageIndex: Math.max(1, normalizeNonNegativeInteger(source.pageIndex, 1)),
      pageSize: normalizedPageSize
    };
  }

  function normalizeActivityMatchBatchRequest(payload = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const activities = Array.isArray(source.activities) ? source.activities : [];
    const normalizedPageSize = (() => {
      const numericValue = normalizeNonNegativeInteger(source.pageSize, DEFAULT_ACTIVITY_MATCH_PAGE_SIZE);

      if (numericValue <= 0) {
        return DEFAULT_ACTIVITY_MATCH_PAGE_SIZE;
      }

      return Math.min(MAX_ACTIVITY_MATCH_PAGE_SIZE, numericValue);
    })();

    return {
      shopIds: normalizeSelectedShopIds(source.shopIds),
      rowCount: Math.max(1, Number(source.rowCount) || DEFAULT_ACTIVITY_MATCH_ROW_COUNT),
      pageIndex: Math.max(1, normalizeNonNegativeInteger(source.pageIndex, 1)),
      pageSize: normalizedPageSize,
      cacheKey: normalizeText(source.cacheKey),
      requestId: normalizeText(source.requestId),
      filterShopId: normalizeText(source.filterShopId),
      filterActivityKey: normalizeText(source.filterActivityKey),
      sortField: ACTIVITY_MATCH_BATCH_SORT_FIELDS.has(normalizeText(source.sortField))
        ? normalizeText(source.sortField)
        : '',
      sortDirection: normalizeText(source.sortDirection).toLowerCase() === 'desc'
        ? 'desc'
        : (normalizeText(source.sortDirection).toLowerCase() === 'asc' ? 'asc' : ''),
      activities: activities
        .map((activity) => {
          const normalizedActivity = activity && typeof activity === 'object' ? activity : {};

          return {
            activityKey: normalizeText(normalizedActivity.activityKey),
            activityType: normalizeOptionalNumber(normalizedActivity.activityType),
            activityThematicId: normalizeText(normalizedActivity.activityThematicId),
            activityThematicName: normalizeText(normalizedActivity.activityThematicName),
            activityName: normalizeText(normalizedActivity.activityName),
            shopIds: normalizeSelectedShopIds(normalizedActivity.shopIds)
          };
        })
        .filter((activity) => activity.activityKey && activity.activityType !== null)
    };
  }

  function normalizeSortableNumberValue(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function compareSortableTextValue(left, right, sortDirection = 'asc') {
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);

    if (!leftText && !rightText) {
      return 0;
    }

    if (!leftText) {
      return 1;
    }

    if (!rightText) {
      return -1;
    }

    const compareResult = leftText.localeCompare(rightText, 'zh-CN');
    return sortDirection === 'desc' ? compareResult * -1 : compareResult;
  }

  function compareSortableNumberValue(left, right, sortDirection = 'asc') {
    const leftNumber = normalizeSortableNumberValue(left);
    const rightNumber = normalizeSortableNumberValue(right);

    if (leftNumber === null && rightNumber === null) {
      return 0;
    }

    if (leftNumber === null) {
      return 1;
    }

    if (rightNumber === null) {
      return -1;
    }

    const compareResult = leftNumber - rightNumber;
    return sortDirection === 'desc' ? compareResult * -1 : compareResult;
  }

  function getActivityMatchBatchRowSortValue(row, sortField) {
    const normalizedSortField = ACTIVITY_MATCH_BATCH_SORT_FIELDS.has(normalizeText(sortField))
      ? normalizeText(sortField)
      : '';

    if (!normalizedSortField) {
      return '';
    }

    if (normalizedSortField === 'productId') {
      return normalizeText(row && row.productId);
    }

    if (normalizedSortField === 'productName') {
      return normalizeText(row && row.productName);
    }

    if (normalizedSortField === 'shopName') {
      return normalizeText(
        Array.isArray(row && row.availableShopNames) && row.availableShopNames.length > 0
          ? row.availableShopNames[0]
          : ''
      );
    }

    if (normalizedSortField === 'activityName') {
      return normalizeText(
        Array.isArray(row && row.activityNames) && row.activityNames.length > 0
          ? row.activityNames[0]
          : ''
      );
    }

    if (normalizedSortField === 'suggestActivityStock') {
      return normalizeOptionalNumber(row && row.suggestActivityStock);
    }

    if (normalizedSortField === 'salesStock') {
      return normalizeOptionalNumber(row && row.salesStock);
    }

    if (normalizedSortField === 'canEnrollSessionCount') {
      return normalizeOptionalNumber(row && row.canEnrollSessionCount);
    }

    if (normalizedSortField === 'suggestActivityPrice') {
      return normalizeOptionalNumber(row && row.suggestActivityPriceMin);
    }

    if (normalizedSortField === 'dailyPrice') {
      return normalizeOptionalNumber(row && row.dailyPriceMin);
    }

    return '';
  }

  function compareActivityMatchBatchRows(leftRow, rightRow, sortField, sortDirection) {
    const normalizedSortField = ACTIVITY_MATCH_BATCH_SORT_FIELDS.has(normalizeText(sortField))
      ? normalizeText(sortField)
      : '';
    const normalizedSortDirection = normalizeText(sortDirection).toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (!normalizedSortField) {
      return 0;
    }

    const leftValue = getActivityMatchBatchRowSortValue(leftRow, normalizedSortField);
    const rightValue = getActivityMatchBatchRowSortValue(rightRow, normalizedSortField);

    if (
      normalizedSortField === 'suggestActivityStock'
      || normalizedSortField === 'salesStock'
      || normalizedSortField === 'canEnrollSessionCount'
      || normalizedSortField === 'suggestActivityPrice'
      || normalizedSortField === 'dailyPrice'
    ) {
      return compareSortableNumberValue(leftValue, rightValue, normalizedSortDirection);
    }

    return compareSortableTextValue(leftValue, rightValue, normalizedSortDirection);
  }

  function normalizeProductSkuEntries(input) {
    const source = Array.isArray(input) ? input : [];
    return source
      .map((item) => item && typeof item === 'object' ? item : null)
      .filter(Boolean);
  }

  function normalizeSkuPropertyValueText(value) {
    if (Array.isArray(value)) {
      const normalizedItems = value
        .map((entry) => normalizeText(entry))
        .filter(Boolean);
      return normalizedItems.join('|');
    }

    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return '';
      }
    }

    return normalizeText(value);
  }

  function buildSkuPropertiesText(properties) {
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return '';
    }

    return Object.keys(properties)
      .map((key) => {
        const normalizedKey = normalizeText(key);
        const normalizedValue = normalizeSkuPropertyValueText(properties[key]);

        if (!normalizedKey && !normalizedValue) {
          return '';
        }

        if (!normalizedKey) {
          return normalizedValue;
        }

        if (!normalizedValue) {
          return normalizedKey;
        }

        return `${normalizedKey}:${normalizedValue}`;
      })
      .filter(Boolean)
      .join(' | ');
  }

  function buildProductSkuDetailKey(detail) {
    const source = detail && typeof detail === 'object' ? detail : {};
    const suggestActivityPrice = normalizeOptionalNumber(source.suggestActivityPrice);
    const dailyPrice = normalizeOptionalNumber(source.dailyPrice);
    const activityPrice = normalizeOptionalNumber(source.activityPrice);
    const suggestActivityDiscount = normalizeOptionalNumber(source.suggestActivityDiscount);
    const skuId = normalizeText(source.skuId);
    const skcId = normalizeText(source.skcId);
    const skuPropertiesText = normalizeText(source.skuPropertiesText);
    const skcPropertiesText = normalizeText(source.skcPropertiesText);

    if (!skuId && !skcId && !skuPropertiesText && !skcPropertiesText) {
      return '';
    }

    return [
      skuId || '-',
      skcId || '-',
      skuPropertiesText || '-',
      skcPropertiesText || '-',
      normalizeText(source.siteId) || normalizeText(source.siteName) || '-',
      normalizeText(source.currency) || '-',
      suggestActivityPrice === null ? '' : String(suggestActivityPrice),
      dailyPrice === null ? '' : String(dailyPrice),
      activityPrice === null ? '' : String(activityPrice),
      suggestActivityDiscount === null ? '' : String(suggestActivityDiscount)
    ].join('\x1f');
  }

  function normalizeProductSkuDetailRecord(record) {
    const source = record && typeof record === 'object' ? record : {};

    return {
      siteId: pickFirstTextValue(source.siteId),
      siteName: pickFirstTextValue(source.siteName),
      skcId: pickFirstTextValue(source.skcId),
      skcExtCode: pickFirstTextValue(source.skcExtCode),
      skcPropertiesText: pickFirstTextValue(source.skcPropertiesText),
      skuId: pickFirstTextValue(source.skuId),
      skuExtCode: pickFirstTextValue(source.skuExtCode),
      skuPropertiesText: pickFirstTextValue(source.skuPropertiesText),
      currency: pickFirstTextValue(source.currency),
      suggestActivityPrice: pickFirstNumberValue(source.suggestActivityPrice),
      dailyPrice: pickFirstNumberValue(source.dailyPrice),
      activityPrice: pickFirstNumberValue(source.activityPrice),
      suggestActivityDiscount: pickFirstNumberValue(source.suggestActivityDiscount)
    };
  }

  function normalizeProductSkuDetailList(input) {
    const source = Array.isArray(input) ? input : [];
    const detailMap = new Map();

    source.forEach((record) => {
      const normalizedRecord = normalizeProductSkuDetailRecord(record);
      const detailKey = buildProductSkuDetailKey(normalizedRecord);

      if (!detailKey) {
        return;
      }

      if (!detailMap.has(detailKey)) {
        detailMap.set(detailKey, normalizedRecord);
        return;
      }

      const current = detailMap.get(detailKey);

      ['siteId', 'siteName', 'skcId', 'skcExtCode', 'skcPropertiesText', 'skuId', 'skuExtCode', 'skuPropertiesText', 'currency'].forEach((fieldName) => {
        if (!normalizeText(current[fieldName])) {
          current[fieldName] = normalizeText(normalizedRecord[fieldName]);
        }
      });

      ['suggestActivityPrice', 'dailyPrice', 'activityPrice', 'suggestActivityDiscount'].forEach((fieldName) => {
        if (normalizeOptionalNumber(current[fieldName]) === null) {
          current[fieldName] = normalizeOptionalNumber(normalizedRecord[fieldName]);
        }
      });
    });

    return Array.from(detailMap.values()).sort((left, right) => {
      const leftSite = normalizeText(left && left.siteName) || normalizeText(left && left.siteId);
      const rightSite = normalizeText(right && right.siteName) || normalizeText(right && right.siteId);

      if (leftSite !== rightSite) {
        return leftSite.localeCompare(rightSite, 'zh-CN');
      }

      const leftSkc = normalizeText(left && left.skcId);
      const rightSkc = normalizeText(right && right.skcId);

      if (leftSkc !== rightSkc) {
        return leftSkc.localeCompare(rightSkc, 'zh-CN');
      }

      const leftSku = normalizeText(left && left.skuId);
      const rightSku = normalizeText(right && right.skuId);

      if (leftSku !== rightSku) {
        return leftSku.localeCompare(rightSku, 'zh-CN');
      }

      const leftSuggestActivityPrice = normalizeOptionalNumber(left && left.suggestActivityPrice);
      const rightSuggestActivityPrice = normalizeOptionalNumber(right && right.suggestActivityPrice);

      if (leftSuggestActivityPrice !== rightSuggestActivityPrice) {
        if (leftSuggestActivityPrice === null) {
          return 1;
        }

        if (rightSuggestActivityPrice === null) {
          return -1;
        }

        return leftSuggestActivityPrice - rightSuggestActivityPrice;
      }

      const leftDailyPrice = normalizeOptionalNumber(left && left.dailyPrice);
      const rightDailyPrice = normalizeOptionalNumber(right && right.dailyPrice);

      if (leftDailyPrice !== rightDailyPrice) {
        if (leftDailyPrice === null) {
          return 1;
        }

        if (rightDailyPrice === null) {
          return -1;
        }

        return leftDailyPrice - rightDailyPrice;
      }

      return normalizeText(left && left.skuPropertiesText).localeCompare(normalizeText(right && right.skuPropertiesText), 'zh-CN');
    });
  }

  function mergeProductSkuDetailList(left, right) {
    return normalizeProductSkuDetailList([
      ...(Array.isArray(left) ? left : []),
      ...(Array.isArray(right) ? right : [])
    ]);
  }

  function buildNumberRange(values) {
    const normalizedValues = (Array.isArray(values) ? values : [])
      .map((value) => normalizeOptionalNumber(value))
      .filter((value) => value !== null);

    if (normalizedValues.length <= 0) {
      return { min: null, max: null };
    }

    return {
      min: Math.min(...normalizedValues),
      max: Math.max(...normalizedValues)
    };
  }

  function normalizeActivityMatchProductRow(row, shopContext) {
    const source = row && typeof row === 'object' ? row : {};
    const siteEntries = normalizeSiteEntries(source);
    const activitySiteInfoList = Array.isArray(source.activitySiteInfoList) ? source.activitySiteInfoList : [];
    const firstSiteEntry = Array.isArray(source.sites) && source.sites[0] && typeof source.sites[0] === 'object'
      ? source.sites[0]
      : null;
    const siteName = normalizeText(source.siteName) || normalizeText(firstSiteEntry && firstSiteEntry.siteName);
    const siteId = normalizeText(source.siteId) || normalizeText(firstSiteEntry && firstSiteEntry.siteId);
    const skcList = [];
    const skuList = [];
    const skuDetails = [];
    const availableShopIds = normalizeText(shopContext && shopContext.shopId)
      ? [normalizeText(shopContext && shopContext.shopId)]
      : [];
    const availableShopNames = normalizeText(shopContext && shopContext.shopName)
      ? [normalizeText(shopContext && shopContext.shopName)]
      : [];
    const suggestEnrollSessionIdList = normalizeTextArray(source.suggestEnrollSessionIdList);
    const enrollSessionIdList = normalizeTextArray(source.enrollSessionIdList);
    const shopScopes = normalizeProductShopScopeList([
      {
        shopId: normalizeText(shopContext && shopContext.shopId),
        shopName: normalizeText(shopContext && shopContext.shopName),
        siteIds: mergeTextArray(siteEntries.siteIds, [siteId]),
        siteNames: mergeTextArray(siteEntries.siteNames, [siteName]),
        suggestEnrollSessionIdList,
        enrollSessionIdList
      }
    ]);

    activitySiteInfoList.forEach((siteInfo) => {
      const siteSkcList = Array.isArray(siteInfo && siteInfo.skcList) ? siteInfo.skcList : [];
      siteSkcList.forEach((skcItem) => {
        if (skcItem && typeof skcItem === 'object') {
          skcList.push(skcItem);
          normalizeProductSkuEntries(skcItem.skuList).forEach((skuItem) => {
            skuList.push(skuItem);
            skuDetails.push({
              siteId: pickFirstTextValue(siteInfo && siteInfo.siteId, siteId),
              siteName: pickFirstTextValue(siteInfo && siteInfo.siteName, siteName),
              skcId: pickFirstTextValue(skcItem && skcItem.skcId),
              skcExtCode: pickFirstTextValue(skcItem && skcItem.extCode),
              skcPropertiesText: buildSkuPropertiesText(skcItem && skcItem.properties),
              skuId: pickFirstTextValue(skuItem && skuItem.skuId),
              skuExtCode: pickFirstTextValue(skuItem && skuItem.extCode),
              skuPropertiesText: buildSkuPropertiesText(skuItem && skuItem.properties),
              currency: pickFirstTextValue(
                skuItem && skuItem.currency,
                skcItem && skcItem.currency,
                source.currency,
                source.goodsExtAttr && source.goodsExtAttr.currency
              ),
              suggestActivityPrice: pickFirstNumberValue(skuItem && skuItem.suggestActivityPrice, skcItem && skcItem.suggestActivityPrice),
              dailyPrice: pickFirstNumberValue(skuItem && skuItem.dailyPrice, skcItem && skcItem.dailyPrice),
              activityPrice: pickFirstNumberValue(skuItem && skuItem.activityPrice, skcItem && skcItem.activityPrice),
              suggestActivityDiscount: pickFirstNumberValue(skuItem && skuItem.suggestActivityDiscount, skcItem && skcItem.suggestActivityDiscount)
            });
          });
        }
      });
    });

    const suggestActivityPriceValues = skuList
      .map((skuItem) => normalizeOptionalNumber(skuItem && skuItem.suggestActivityPrice))
      .filter((value) => value !== null);
    const dailyPriceValues = skuList
      .map((skuItem) => normalizeOptionalNumber(skuItem && skuItem.dailyPrice))
      .filter((value) => value !== null);
    const discountValues = skuList
      .map((skuItem) => normalizeOptionalNumber(skuItem && skuItem.suggestActivityDiscount))
      .filter((value) => value !== null);
    const suggestActivityPriceRange = buildNumberRange(suggestActivityPriceValues);
    const dailyPriceRange = buildNumberRange(dailyPriceValues);
    const activityDiscountRange = buildNumberRange(discountValues);

    return {
      productId: pickFirstTextValue(source.productId),
      productName: pickFirstTextValue(source.productName),
      pictureUrl: pickFirstTextValue(source.pictureUrl),
      currency: pickFirstTextValue(source.currency, source.goodsExtAttr && source.goodsExtAttr.currency),
      semiDrCode: pickFirstTextValue(source.goodsExtAttr && source.goodsExtAttr.semiDrCode),
      targetActivityStock: pickFirstNumberValue(source.targetActivityStock),
      suggestActivityStock: pickFirstNumberValue(source.suggestActivityStock),
      salesStock: pickFirstNumberValue(source.salesStock),
      canEnrollSessionCount: pickFirstNumberValue(source.canEnrollSessionCount),
      siteIds: mergeTextArray(siteEntries.siteIds, [siteId]),
      siteNames: mergeTextArray(siteEntries.siteNames, [siteName]),
      availableShopIds: Array.from(new Set(availableShopIds.filter(Boolean))),
      availableShopNames: Array.from(new Set(availableShopNames.filter(Boolean))),
      shopScopes,
      suggestEnrollSessionIdList,
      enrollSessionIdList,
      skcCount: skcList.length,
      skuCount: skuList.length,
      suggestActivityPriceMin: suggestActivityPriceRange.min,
      suggestActivityPriceMax: suggestActivityPriceRange.max,
      dailyPriceMin: dailyPriceRange.min,
      dailyPriceMax: dailyPriceRange.max,
      activityDiscountMin: activityDiscountRange.min,
      activityDiscountMax: activityDiscountRange.max,
      skuDetails: normalizeProductSkuDetailList(skuDetails),
      activitySiteInfoList: activitySiteInfoList.map((siteInfo) => ({
        siteId: pickFirstTextValue(siteInfo && siteInfo.siteId),
        siteName: pickFirstTextValue(siteInfo && siteInfo.siteName),
        mustPrivilege: Boolean(siteInfo && siteInfo.mustPrivilege)
      }))
    };
  }

  function mergeActivityMatchProductRows(left, right) {
    const merged = {
      ...left
    };

    ['productName', 'pictureUrl', 'currency', 'semiDrCode'].forEach((fieldName) => {
      if (!normalizeText(merged[fieldName])) {
        merged[fieldName] = normalizeText(right && right[fieldName]);
      }
    });

    ['targetActivityStock', 'suggestActivityStock', 'salesStock', 'canEnrollSessionCount', 'skcCount', 'skuCount'].forEach((fieldName) => {
      if (merged[fieldName] === null || merged[fieldName] === undefined) {
        merged[fieldName] = normalizeOptionalNumber(right && right[fieldName]);
      }
    });

    merged.siteIds = mergeTextArray(merged.siteIds, right && right.siteIds);
    merged.siteNames = mergeTextArray(merged.siteNames, right && right.siteNames);
    merged.availableShopIds = mergeTextArray(merged.availableShopIds, right && right.availableShopIds);
    merged.availableShopNames = mergeTextArray(merged.availableShopNames, right && right.availableShopNames);
    merged.shopScopes = mergeProductShopScopeList(merged.shopScopes, right && right.shopScopes);
    merged.suggestEnrollSessionIdList = mergeTextArray(merged.suggestEnrollSessionIdList, right && right.suggestEnrollSessionIdList);
    merged.enrollSessionIdList = mergeTextArray(merged.enrollSessionIdList, right && right.enrollSessionIdList);
    merged.skuDetails = mergeProductSkuDetailList(merged.skuDetails, right && right.skuDetails);

    if (Array.isArray(merged.shopScopes) && merged.shopScopes.length > 0) {
      merged.availableShopIds = mergeTextArray(
        merged.availableShopIds,
        merged.shopScopes.map((scopeItem) => normalizeText(scopeItem && scopeItem.shopId))
      );
      merged.availableShopNames = mergeTextArray(
        merged.availableShopNames,
        merged.shopScopes.map((scopeItem) => normalizeText(scopeItem && scopeItem.shopName))
      );
    }

    ['suggestActivityPriceMin', 'dailyPriceMin', 'activityDiscountMin'].forEach((fieldName) => {
      const leftValue = normalizeOptionalNumber(merged[fieldName]);
      const rightValue = normalizeOptionalNumber(right && right[fieldName]);

      if (leftValue === null) {
        merged[fieldName] = rightValue;
        return;
      }

      if (rightValue === null) {
        merged[fieldName] = leftValue;
        return;
      }

      merged[fieldName] = Math.min(leftValue, rightValue);
    });

    ['suggestActivityPriceMax', 'dailyPriceMax', 'activityDiscountMax'].forEach((fieldName) => {
      const leftValue = normalizeOptionalNumber(merged[fieldName]);
      const rightValue = normalizeOptionalNumber(right && right[fieldName]);

      if (leftValue === null) {
        merged[fieldName] = rightValue;
        return;
      }

      if (rightValue === null) {
        merged[fieldName] = leftValue;
        return;
      }

      merged[fieldName] = Math.max(leftValue, rightValue);
    });

    merged.skcCount = Math.max(Number(merged.skcCount) || 0, Number(right && right.skcCount) || 0);
    merged.skuCount = Math.max(Number(merged.skuCount) || 0, Number(right && right.skuCount) || 0);

    if (Array.isArray(merged.skuDetails) && merged.skuDetails.length > 0) {
      merged.skuCount = Math.max(Number(merged.skuCount) || 0, merged.skuDetails.length);
      merged.skcCount = Math.max(
        Number(merged.skcCount) || 0,
        new Set(merged.skuDetails.map((detail) => normalizeText(detail && detail.skcId)).filter(Boolean)).size
      );
    }

    return merged;
  }

  function buildActivityMatchDisplayName(activity) {
    return pickFirstTextValue(
      activity && activity.activityThematicName,
      activity && activity.activityName,
      activity && activity.activityKey
    );
  }

  function sortActivityMatchProductRows(rows) {
    return rows.sort((left, right) => {
      const leftScore = Number(left && left.suggestActivityStock) || 0;
      const rightScore = Number(right && right.suggestActivityStock) || 0;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      const leftSales = Number(left && left.salesStock) || 0;
      const rightSales = Number(right && right.salesStock) || 0;

      if (rightSales !== leftSales) {
        return rightSales - leftSales;
      }

      return normalizeText(left && left.productName).localeCompare(normalizeText(right && right.productName), 'zh-CN');
    });
  }

  function buildActivityMatchQuickCostSpecParts(detail) {
    const parts = [];
    const seen = new Set();
    const normalizeQuickCostSpecPart = (value) => normalizeText(value)
      .replace(/\s+/g, ' ')
      .replace(/[：锛歖]/g, ':')
      .replace(/(\d+)\s*pcs?\b/gi, '$1pc')
      .replace(/\s*:\s*/g, ':');

    [
      normalizeText(detail && detail.skcPropertiesText),
      normalizeText(detail && detail.skuPropertiesText)
    ].forEach((textValue) => {
      normalizeTextArray(textValue ? textValue.split('|') : []).forEach((part) => {
        const normalizedPart = normalizeQuickCostSpecPart(part);
        const partKey = normalizedPart.toLowerCase();

        if (!partKey || seen.has(partKey)) {
          return;
        }

        seen.add(partKey);
        parts.push(normalizedPart);
      });
    });

    return parts;
  }

  function buildActivityMatchQuickCostSpecText(detail) {
    return buildActivityMatchQuickCostSpecParts(detail).join(' | ');
  }

  function buildActivityMatchQuickCostSpecAliases(_detail) {
    return [];
  }

  function buildActivityMatchQuickCostEntryKey(shopId, station, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedSpec = normalizeCostSpecText(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return [normalizedShopId, normalizedStation || '-', normalizedSpec]
      .join('\x1f')
      .toLowerCase();
  }

  function buildActivityMatchBatchQuickCostEntries(rows) {
    const entryMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const shopScopes = Array.isArray(row && row.shopScopes) && row.shopScopes.length > 0
        ? row.shopScopes
        : [{
          shopId: pickFirstTextValue(
            row && row.shopId,
            Array.isArray(row && row.availableShopIds) ? row.availableShopIds[0] : ''
          ),
          shopName: pickFirstTextValue(
            row && row.shopName,
            Array.isArray(row && row.availableShopNames) ? row.availableShopNames[0] : ''
          )
        }];
      const fallbackStation = pickFirstTextValue(
        Array.isArray(row && row.siteIds) ? row.siteIds[0] : '',
        Array.isArray(row && row.siteNames) ? row.siteNames[0] : ''
      );
      const fallbackStationLabel = pickFirstTextValue(
        Array.isArray(row && row.siteNames) ? row.siteNames[0] : '',
        Array.isArray(row && row.siteIds) ? row.siteIds[0] : ''
      );
      const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];

      shopScopes.forEach((shopScope) => {
        const shopId = pickFirstTextValue(shopScope && shopScope.shopId);
        const shopName = pickFirstTextValue(shopScope && shopScope.shopName);

        if (!shopId) {
          return;
        }

        skuDetails.forEach((skuDetail) => {
          const station = pickFirstTextValue(
            skuDetail && skuDetail.siteId,
            skuDetail && skuDetail.siteName,
            fallbackStation
          );
          const stationLabel = pickFirstTextValue(
            skuDetail && skuDetail.siteName,
            fallbackStationLabel,
            station
          );
          const spec = buildActivityMatchQuickCostSpecText(skuDetail);
          const specAliases = buildActivityMatchQuickCostSpecAliases(skuDetail);
          const key = buildActivityMatchQuickCostEntryKey(shopId, station, spec);

          if (!key) {
            return;
          }

          if (!entryMap.has(key)) {
            entryMap.set(key, {
              key,
              shopId,
              shopName,
              station,
              stationLabel,
              spec,
              legacySpec: specAliases[0] || '',
              specAliases
            });
            return;
          }

          const existingEntry = entryMap.get(key);

          if (!normalizeText(existingEntry && existingEntry.shopName) && shopName) {
            existingEntry.shopName = shopName;
          }

          if (!normalizeText(existingEntry && existingEntry.stationLabel) && stationLabel) {
            existingEntry.stationLabel = stationLabel;
          }

          if (!normalizeText(existingEntry && existingEntry.legacySpec) && specAliases[0]) {
            existingEntry.legacySpec = specAliases[0];
          }

          if (specAliases.length > 0) {
            existingEntry.specAliases = normalizeTextArray(
              []
                .concat(Array.isArray(existingEntry && existingEntry.specAliases) ? existingEntry.specAliases : [])
                .concat(specAliases)
            );
          }
        });
      });
    });

    return Array.from(entryMap.values()).sort((left, right) => {
      const leftShopName = normalizeText(left && left.shopName) || normalizeText(left && left.shopId);
      const rightShopName = normalizeText(right && right.shopName) || normalizeText(right && right.shopId);
      const shopCompare = leftShopName.localeCompare(rightShopName, 'zh-CN');

      if (shopCompare !== 0) {
        return shopCompare;
      }

      const leftStation = normalizeText(left && left.stationLabel) || normalizeText(left && left.station);
      const rightStation = normalizeText(right && right.stationLabel) || normalizeText(right && right.station);
      const stationCompare = leftStation.localeCompare(rightStation, 'zh-CN');

      if (stationCompare !== 0) {
        return stationCompare;
      }

      return normalizeText(left && left.spec).localeCompare(normalizeText(right && right.spec), 'zh-CN');
    });
  }

  function buildActivityMatchCacheKey(request) {
    const signature = JSON.stringify({
      activityKey: normalizeText(request && request.activityKey),
      activityType: normalizeOptionalNumber(request && request.activityType),
      activityThematicId: normalizeText(request && request.activityThematicId),
      shopIds: normalizeSelectedShopIds(request && request.shopIds).sort()
    });
    const hash = crypto
      .createHash('sha256')
      .update(signature)
      .digest('hex')
      .slice(0, 24);

    return `activity-match:${hash}`;
  }

  function buildActivityMatchBatchCacheKey(request) {
    const signature = JSON.stringify({
      shopIds: normalizeSelectedShopIds(request && request.shopIds).sort(),
      activities: (Array.isArray(request && request.activities) ? request.activities : [])
        .map((activity) => ({
          activityKey: normalizeText(activity && activity.activityKey),
          activityType: normalizeOptionalNumber(activity && activity.activityType),
          activityThematicId: normalizeText(activity && activity.activityThematicId),
          shopIds: normalizeSelectedShopIds(activity && activity.shopIds).sort()
        }))
        .sort((left, right) => (
          `${left.activityKey}\x1f${left.activityType}\x1f${left.activityThematicId}\x1f${left.shopIds.join(',')}`.localeCompare(
            `${right.activityKey}\x1f${right.activityType}\x1f${right.activityThematicId}\x1f${right.shopIds.join(',')}`
          )
        ))
    });
    const hash = crypto
      .createHash('sha256')
      .update(signature)
      .digest('hex')
      .slice(0, 24);

    return `activity-match-batch:${hash}`;
  }

  function buildActivityMatchProductCacheEntry(request, overrides = {}) {
    const requestedShopIds = normalizeSelectedShopIds(request && request.shopIds);
    const rows = Array.isArray(overrides.rows) ? overrides.rows : [];
    const successShopCount = normalizeNonNegativeInteger(overrides.successShopCount, 0);
    const failedShopCount = normalizeNonNegativeInteger(overrides.failedShopCount, 0);

    return {
      success: Object.prototype.hasOwnProperty.call(overrides, 'success')
        ? overrides.success === true
        : (successShopCount > 0 || rows.length > 0),
      updatedAt: normalizeText(overrides.updatedAt) || nowIso(),
      cacheKey: normalizeText(overrides.cacheKey) || buildActivityMatchCacheKey(request),
      activityKey: normalizeText(overrides.activityKey) || normalizeText(request && request.activityKey),
      activityType: normalizeOptionalNumber(
        Object.prototype.hasOwnProperty.call(overrides, 'activityType')
          ? overrides.activityType
          : (request && request.activityType)
      ),
      activityThematicId: normalizeText(overrides.activityThematicId) || normalizeText(request && request.activityThematicId),
      totalShopCount: requestedShopIds.length,
      successShopCount,
      failedShopCount,
      rawProductCount: normalizeNonNegativeInteger(overrides.rawProductCount, 0),
      uniqueProductCount: normalizeNonNegativeInteger(overrides.uniqueProductCount, rows.length),
      stillCount: normalizeNonNegativeInteger(overrides.stillCount, 0),
      rows,
      shopResults: Array.isArray(overrides.shopResults) ? overrides.shopResults : [],
      warning: normalizeText(overrides.warning)
    };
  }

  function buildActivityMatchBatchCacheEntry(request, overrides = {}) {
    const rows = Array.isArray(overrides.rows) ? overrides.rows : [];
    const activityResults = Array.isArray(overrides.activityResults) ? overrides.activityResults : [];
    const successActivityCount = normalizeNonNegativeInteger(overrides.successActivityCount, 0);
    const failedActivityCount = normalizeNonNegativeInteger(overrides.failedActivityCount, 0);

    return {
      success: Object.prototype.hasOwnProperty.call(overrides, 'success')
        ? overrides.success === true
        : (successActivityCount > 0 || rows.length > 0),
      updatedAt: normalizeText(overrides.updatedAt) || nowIso(),
      cacheKey: normalizeText(overrides.cacheKey) || buildActivityMatchBatchCacheKey(request),
      requestId: normalizeText(overrides.requestId) || normalizeText(request && request.requestId),
      totalShopCount: normalizeSelectedShopIds(request && request.shopIds).length,
      totalActivityCount: Array.isArray(request && request.activities) ? request.activities.length : 0,
      successActivityCount,
      failedActivityCount,
      uniqueProductCount: normalizeNonNegativeInteger(overrides.uniqueProductCount, rows.length),
      rows,
      quickCostEntries: Array.isArray(overrides.quickCostEntries)
        ? overrides.quickCostEntries
        : buildActivityMatchBatchQuickCostEntries(rows),
      activityResults,
      warning: normalizeText(overrides.warning)
    };
  }

  function buildBatchZeroProductWarning(activityResults) {
    const source = (Array.isArray(activityResults) ? activityResults : [])
      .map((entry) => entry && typeof entry === 'object' ? entry : {})
      .filter((entry) => normalizeText(entry.activityKey));

    if (source.length <= 0) {
      return '\u5f53\u524d\u52fe\u9009\u6d3b\u52a8\u6682\u65e0\u53ef\u62a5\u5546\u54c1';
    }

    const previewText = source
      .slice(0, 5)
      .map((entry) => {
        const activityName = pickFirstTextValue(entry.activityName, entry.activityKey);
        const productCount = normalizeNonNegativeInteger(entry.uniqueProductCount, 0);
        return `${activityName}:${productCount}`;
      })
      .filter(Boolean)
      .join('\u3001');
    const summaryText = source.length > 5
      ? `\u5df2\u67e5 ${source.length} \u4e2a\u6d3b\u52a8`
      : `\u5df2\u67e5 ${source.length} \u4e2a\u6d3b\u52a8`;

    return `${summaryText}\uff0c\u53ef\u62a5\u5546\u54c1\u4ecd\u4e3a 0${previewText ? `\uff08${previewText}\uff09` : ''}`;
  }

  function touchActivityMatchProductCache(cacheKey) {
    const normalizedCacheKey = normalizeText(cacheKey);

    if (!normalizedCacheKey) {
      return;
    }

    const existingIndex = activityMatchProductCacheOrder.findIndex((entryKey) => entryKey === normalizedCacheKey);

    if (existingIndex >= 0) {
      activityMatchProductCacheOrder.splice(existingIndex, 1);
    }

    activityMatchProductCacheOrder.push(normalizedCacheKey);

    while (activityMatchProductCacheOrder.length > MAX_ACTIVITY_MATCH_CACHE_ENTRIES) {
      const evictedCacheKey = normalizeText(activityMatchProductCacheOrder.shift());

      if (evictedCacheKey) {
        activityMatchProductCacheByKey.delete(evictedCacheKey);
      }
    }
  }

  function setActivityMatchProductCacheEntry(cacheKey, cacheEntry) {
    const normalizedCacheKey = normalizeText(cacheKey);

    if (!normalizedCacheKey || !cacheEntry || typeof cacheEntry !== 'object') {
      return;
    }

    activityMatchProductCacheByKey.set(normalizedCacheKey, {
      ...cacheEntry,
      cacheKey: normalizedCacheKey
    });
    touchActivityMatchProductCache(normalizedCacheKey);
  }

  function getActivityMatchProductCacheEntry(cacheKey) {
    const normalizedCacheKey = normalizeText(cacheKey);

    if (!normalizedCacheKey || !activityMatchProductCacheByKey.has(normalizedCacheKey)) {
      return null;
    }

    const cacheEntry = activityMatchProductCacheByKey.get(normalizedCacheKey);
    touchActivityMatchProductCache(normalizedCacheKey);
    return cacheEntry;
  }

  function touchActivityMatchBatchCache(cacheKey) {
    const normalizedCacheKey = normalizeText(cacheKey);

    if (!normalizedCacheKey) {
      return;
    }

    const existingIndex = activityMatchBatchCacheOrder.findIndex((entryKey) => entryKey === normalizedCacheKey);

    if (existingIndex >= 0) {
      activityMatchBatchCacheOrder.splice(existingIndex, 1);
    }

    activityMatchBatchCacheOrder.push(normalizedCacheKey);

    while (activityMatchBatchCacheOrder.length > MAX_ACTIVITY_MATCH_BATCH_CACHE_ENTRIES) {
      const evictedCacheKey = normalizeText(activityMatchBatchCacheOrder.shift());

      if (evictedCacheKey) {
        activityMatchBatchCacheByKey.delete(evictedCacheKey);
      }
    }
  }

  function setActivityMatchBatchCacheEntry(cacheKey, cacheEntry) {
    const normalizedCacheKey = normalizeText(cacheKey);

    if (!normalizedCacheKey || !cacheEntry || typeof cacheEntry !== 'object') {
      return;
    }

    activityMatchBatchCacheByKey.set(normalizedCacheKey, {
      ...cacheEntry,
      cacheKey: normalizedCacheKey
    });
    touchActivityMatchBatchCache(normalizedCacheKey);
  }

  function getActivityMatchBatchCacheEntry(cacheKey) {
    const normalizedCacheKey = normalizeText(cacheKey);

    if (!normalizedCacheKey || !activityMatchBatchCacheByKey.has(normalizedCacheKey)) {
      return null;
    }

    const cacheEntry = activityMatchBatchCacheByKey.get(normalizedCacheKey);
    touchActivityMatchBatchCache(normalizedCacheKey);
    return cacheEntry;
  }

  function buildActivityMatchEmptyResponse(request, overrides = {}) {
    const normalizedRequest = request && typeof request === 'object' ? request : {};
    const pageIndex = Math.max(1, normalizeNonNegativeInteger(
      Object.prototype.hasOwnProperty.call(overrides, 'pageIndex') ? overrides.pageIndex : normalizedRequest.pageIndex,
      1
    ));
    const pageSizeCandidate = Object.prototype.hasOwnProperty.call(overrides, 'pageSize')
      ? overrides.pageSize
      : normalizedRequest.pageSize;
    const pageSize = Math.min(
      MAX_ACTIVITY_MATCH_PAGE_SIZE,
      Math.max(1, normalizeNonNegativeInteger(pageSizeCandidate, DEFAULT_ACTIVITY_MATCH_PAGE_SIZE))
    );

    return {
      success: false,
      updatedAt: nowIso(),
      cacheKey: '',
      activityKey: normalizeText(normalizedRequest.activityKey),
      activityType: normalizeOptionalNumber(normalizedRequest.activityType),
      activityThematicId: normalizeText(normalizedRequest.activityThematicId),
      totalShopCount: 0,
      successShopCount: 0,
      failedShopCount: 0,
      rawProductCount: 0,
      uniqueProductCount: 0,
      cachedRowCount: 0,
      stillCount: 0,
      hasMore: false,
      searchScrollContext: '',
      pageIndex,
      pageSize,
      pageCount: 1,
      rows: [],
      shopResults: [],
      warning: '',
      ...overrides
    };
  }

  function buildActivityMatchProductPageSlice(rows, pageIndex, pageSize) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const normalizedPageSize = Math.min(
      MAX_ACTIVITY_MATCH_PAGE_SIZE,
      Math.max(1, normalizeNonNegativeInteger(pageSize, DEFAULT_ACTIVITY_MATCH_PAGE_SIZE))
    );
    const totalRows = sourceRows.length;
    const pageCount = Math.max(1, Math.ceil(totalRows / normalizedPageSize));
    const normalizedPageIndex = Math.min(
      pageCount,
      Math.max(1, normalizeNonNegativeInteger(pageIndex, 1))
    );
    const startIndex = (normalizedPageIndex - 1) * normalizedPageSize;
    const endIndex = startIndex + normalizedPageSize;

    return {
      cachedRowCount: totalRows,
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      pageCount,
      rows: sourceRows.slice(startIndex, endIndex)
    };
  }

  function buildActivityMatchProductResponse(cacheEntry, options = {}) {
    const entry = cacheEntry && typeof cacheEntry === 'object' ? cacheEntry : {};
    const pageSlice = buildActivityMatchProductPageSlice(
      entry.rows,
      options && options.pageIndex,
      options && options.pageSize
    );

    return {
      success: entry.success === true,
      updatedAt: normalizeText(entry.updatedAt) || nowIso(),
      cacheKey: normalizeText(entry.cacheKey),
      activityKey: normalizeText(entry.activityKey),
      activityType: normalizeOptionalNumber(entry.activityType),
      activityThematicId: normalizeText(entry.activityThematicId),
      totalShopCount: normalizeNonNegativeInteger(entry.totalShopCount, 0),
      successShopCount: normalizeNonNegativeInteger(entry.successShopCount, 0),
      failedShopCount: normalizeNonNegativeInteger(entry.failedShopCount, 0),
      rawProductCount: normalizeNonNegativeInteger(entry.rawProductCount, 0),
      uniqueProductCount: normalizeNonNegativeInteger(entry.uniqueProductCount, pageSlice.cachedRowCount),
      cachedRowCount: pageSlice.cachedRowCount,
      stillCount: normalizeNonNegativeInteger(entry.stillCount, 0),
      hasMore: false,
      searchScrollContext: '',
      pageIndex: pageSlice.pageIndex,
      pageSize: pageSlice.pageSize,
      pageCount: pageSlice.pageCount,
      rows: pageSlice.rows,
      shopResults: Array.isArray(entry.shopResults) ? entry.shopResults : [],
      warning: normalizeText(
        Object.prototype.hasOwnProperty.call(options || {}, 'warning')
          ? options.warning
          : entry.warning
      )
    };
  }

  function mergeActivityMatchBatchProductRows(left, right, activityMeta) {
    const merged = left
      ? mergeActivityMatchProductRows(left, right)
      : { ...right };
    const activityKey = normalizeText(activityMeta && activityMeta.activityKey);
    const activityName = buildActivityMatchDisplayName(activityMeta);

    merged.activityKeys = mergeTextArray(merged.activityKeys, [activityKey]);
    merged.activityNames = mergeTextArray(merged.activityNames, [activityName]);
    merged.activityCount = merged.activityKeys.length;
    merged.activityScopes = mergeProductActivityScopeList(
      merged.activityScopes,
      buildProductActivityScopeList(right, activityMeta)
    );
    merged.activityScopeCount = Array.isArray(merged.activityScopes) ? merged.activityScopes.length : 0;

    return merged;
  }

  function mergeActivityRowsIntoBatchAggregate(aggregatedMap, activityRows, activityMeta) {
    const normalizedRows = Array.isArray(activityRows) ? activityRows : [];

    normalizedRows.forEach((row) => {
      const productId = normalizeText(row && row.productId);
      const activityKey = normalizeText(activityMeta && activityMeta.activityKey);
      const batchRowKey = [activityKey, productId].join('\x1f');

      if (!productId || !activityKey) {
        return;
      }

      const batchRow = {
        ...row,
        activityKeys: [activityKey],
        activityNames: [buildActivityMatchDisplayName(activityMeta)],
        activityCount: 1,
        activityScopes: buildProductActivityScopeList(row, activityMeta),
        activityScopeCount: 0
      };

      batchRow.activityScopeCount = Array.isArray(batchRow.activityScopes)
        ? batchRow.activityScopes.length
        : 0;

      if (aggregatedMap.has(batchRowKey)) {
        aggregatedMap.set(
          batchRowKey,
          mergeActivityMatchBatchProductRows(aggregatedMap.get(batchRowKey), batchRow, activityMeta)
        );
      } else {
        aggregatedMap.set(batchRowKey, batchRow);
      }
    });
  }

  function rowMatchesActivityMatchBatchShopFilter(row, filterShopId) {
    const normalizedFilterShopId = normalizeText(filterShopId);

    if (!normalizedFilterShopId) {
      return true;
    }

    const availableShopIds = normalizeTextArray(row && row.availableShopIds);

    if (availableShopIds.includes(normalizedFilterShopId)) {
      return true;
    }

    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    return activityScopes.some((scopeItem) => normalizeText(scopeItem && scopeItem.shopId) === normalizedFilterShopId);
  }

  function rowMatchesActivityMatchBatchActivityFilter(row, filterActivityKey) {
    const normalizedFilterActivityKey = normalizeText(filterActivityKey);

    if (!normalizedFilterActivityKey) {
      return true;
    }

    const activityKeys = normalizeTextArray(row && row.activityKeys);

    if (activityKeys.includes(normalizedFilterActivityKey)) {
      return true;
    }

    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    return activityScopes.some((scopeItem) => normalizeText(scopeItem && scopeItem.activityKey) === normalizedFilterActivityKey);
  }

  function buildActivityMatchBatchViewRows(rows, request = {}) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const filteredRows = sourceRows.filter((row) => (
      rowMatchesActivityMatchBatchShopFilter(row, request && request.filterShopId)
      && rowMatchesActivityMatchBatchActivityFilter(row, request && request.filterActivityKey)
    ));
    const normalizedSortField = ACTIVITY_MATCH_BATCH_SORT_FIELDS.has(normalizeText(request && request.sortField))
      ? normalizeText(request && request.sortField)
      : '';
    const normalizedSortDirection = normalizeText(request && request.sortDirection).toLowerCase();

    if (!normalizedSortField || (normalizedSortDirection !== 'asc' && normalizedSortDirection !== 'desc')) {
      return filteredRows;
    }

    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const compareResult = compareActivityMatchBatchRows(
          left.row,
          right.row,
          normalizedSortField,
          normalizedSortDirection
        );

        if (compareResult !== 0) {
          return compareResult;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.row);
  }

  function hasActivityMatchBatchViewControls(request = {}) {
    return Boolean(
      normalizeText(request && request.filterShopId)
      || normalizeText(request && request.filterActivityKey)
      || normalizeText(request && request.sortField)
      || normalizeText(request && request.sortDirection)
    );
  }

  function buildActivityMatchBatchEmptyResponse(request, overrides = {}) {
    const normalizedRequest = request && typeof request === 'object' ? request : {};
    const pageIndex = Math.max(1, normalizeNonNegativeInteger(
      Object.prototype.hasOwnProperty.call(overrides, 'pageIndex') ? overrides.pageIndex : normalizedRequest.pageIndex,
      1
    ));
    const pageSize = Math.min(
      MAX_ACTIVITY_MATCH_PAGE_SIZE,
      Math.max(1, normalizeNonNegativeInteger(
        Object.prototype.hasOwnProperty.call(overrides, 'pageSize') ? overrides.pageSize : normalizedRequest.pageSize,
        DEFAULT_ACTIVITY_MATCH_PAGE_SIZE
      ))
    );

    return {
      success: false,
      updatedAt: nowIso(),
      cacheKey: '',
      requestId: normalizeText(normalizedRequest.requestId),
      totalShopCount: normalizeSelectedShopIds(normalizedRequest.shopIds).length,
      totalActivityCount: Array.isArray(normalizedRequest.activities) ? normalizedRequest.activities.length : 0,
      successActivityCount: 0,
      failedActivityCount: 0,
      uniqueProductCount: 0,
      cachedRowCount: 0,
      pageIndex,
      pageSize,
      pageCount: 1,
      rows: [],
      quickCostEntries: [],
      activityResults: [],
      warning: '',
      ...overrides
    };
  }

  function buildActivityMatchBatchPageResponse(cacheEntry, options = {}) {
    const entry = cacheEntry && typeof cacheEntry === 'object' ? cacheEntry : {};
    const request = options && typeof options.request === 'object' ? options.request : {};
    const viewRows = buildActivityMatchBatchViewRows(entry.rows, request);
    const pageSlice = buildActivityMatchProductPageSlice(
      viewRows,
      options && options.pageIndex,
      options && options.pageSize
    );
    const warning = (() => {
      if (Object.prototype.hasOwnProperty.call(options || {}, 'warning')) {
        return normalizeText(options && options.warning);
      }

      if (pageSlice.cachedRowCount <= 0 && Array.isArray(entry.rows) && entry.rows.length > 0 && hasActivityMatchBatchViewControls(request)) {
        return '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6682\u65e0\u6d3b\u52a8\u5546\u54c1';
      }

      return normalizeText(entry.warning);
    })();

    return {
      success: entry.success === true,
      updatedAt: normalizeText(entry.updatedAt) || nowIso(),
      cacheKey: normalizeText(entry.cacheKey),
      requestId: normalizeText(entry.requestId),
      totalShopCount: normalizeNonNegativeInteger(entry.totalShopCount, 0),
      totalActivityCount: normalizeNonNegativeInteger(entry.totalActivityCount, 0),
      successActivityCount: normalizeNonNegativeInteger(entry.successActivityCount, 0),
      failedActivityCount: normalizeNonNegativeInteger(entry.failedActivityCount, 0),
      uniqueProductCount: normalizeNonNegativeInteger(entry.uniqueProductCount, pageSlice.cachedRowCount),
      cachedRowCount: pageSlice.cachedRowCount,
      pageIndex: pageSlice.pageIndex,
      pageSize: pageSlice.pageSize,
      pageCount: pageSlice.pageCount,
      rows: pageSlice.rows,
      quickCostEntries: Array.isArray(entry.quickCostEntries) ? entry.quickCostEntries : [],
      activityResults: Array.isArray(entry.activityResults) ? entry.activityResults : [],
      warning,
      filterShopId: normalizeText(request.filterShopId),
      filterActivityKey: normalizeText(request.filterActivityKey),
      sortField: ACTIVITY_MATCH_BATCH_SORT_FIELDS.has(normalizeText(request.sortField))
        ? normalizeText(request.sortField)
        : '',
      sortDirection: normalizeText(request.sortDirection).toLowerCase() === 'desc'
        ? 'desc'
        : (normalizeText(request.sortDirection).toLowerCase() === 'asc' ? 'asc' : '')
    };
  }

  async function queryActivityMatchProducts(payload = {}, options = {}) {
    const request = normalizeActivityMatchRequest(payload);
    const requestedShopIds = request.shopIds;
    const activityCacheKey = buildActivityMatchCacheKey(request);
    const queryJob = options && options.queryJob ? options.queryJob : null;
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const progressContext = options && typeof options.progressContext === 'object' && options.progressContext !== null
      ? { ...options.progressContext }
      : {};

    if (requestedShopIds.length <= 0) {
      return buildActivityMatchEmptyResponse(request, {
        warning: '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa'
      });
    }

    if (request.activityType === null) {
      return buildActivityMatchEmptyResponse(request, {
        totalShopCount: requestedShopIds.length,
        failedShopCount: requestedShopIds.length,
        warning: '\u6d3b\u52a8\u7c7b\u578b\u7f3a\u5931'
      });
    }

    assertActivityMatchBatchQueryJobActive(queryJob);
    const { resolvedShops, unresolved } = await resolveSelectedShops(requestedShopIds);
    assertActivityMatchBatchQueryJobActive(queryJob);
    const aggregatedMap = new Map();
    const shopResults = [];
    const resolvedShopProgressResults = [];
    let rawProductCount = 0;
    let totalStillCount = 0;
    const totalShopCount = requestedShopIds.length;
    const persistActivityMatchCache = (options = {}) => {
      const shopResultsSnapshot = Array.isArray(options.shopResults)
        ? options.shopResults
        : shopResults.concat(resolvedShopProgressResults.filter(Boolean));
      const rows = Array.isArray(options.rows) ? options.rows : Array.from(aggregatedMap.values());
      const successShopCount = normalizeNonNegativeInteger(
        Object.prototype.hasOwnProperty.call(options, 'successShopCount')
          ? options.successShopCount
          : shopResultsSnapshot.filter((entry) => entry && entry.success === true).length,
        0
      );
      const failedShopCount = normalizeNonNegativeInteger(
        Object.prototype.hasOwnProperty.call(options, 'failedShopCount')
          ? options.failedShopCount
          : (shopResultsSnapshot.length - successShopCount),
        0
      );
      const warning = (() => {
        if (Object.prototype.hasOwnProperty.call(options, 'warning')) {
          return normalizeText(options.warning);
        }

        if (failedShopCount > 0) {
          return buildWarningMessage({
            successShopCount,
            failedShopCount,
            uniqueActivityCount: rows.length
          }, shopResultsSnapshot);
        }

        return rows.length > 0 ? '' : '\u5f53\u524d\u6d3b\u52a8\u6682\u65e0\u53ef\u62a5\u5546\u54c1';
      })();
      const cacheEntry = buildActivityMatchProductCacheEntry(request, {
        cacheKey: activityCacheKey,
        success: Object.prototype.hasOwnProperty.call(options, 'success')
          ? options.success === true
          : (successShopCount > 0 || rows.length > 0),
        successShopCount,
        failedShopCount,
        rawProductCount,
        uniqueProductCount: rows.length,
        stillCount: totalStillCount,
        rows,
        shopResults: shopResultsSnapshot.slice(),
        warning
      });

      setActivityMatchProductCacheEntry(activityCacheKey, cacheEntry);
      return cacheEntry;
    };

    progressContext.requestId = normalizeText(progressContext.requestId || request.requestId);
    progressContext.totalActivityCount = normalizeNonNegativeInteger(progressContext.totalActivityCount, 0);
    progressContext.totalShopCount = totalShopCount;
    progressContext.currentActivityRawProductCount = 0;
    progressContext.currentActivityUniqueProductCount = 0;
    progressContext.totalRawProductCount = 0;
    progressContext.totalUniqueProductCount = 0;
    progressContext.currentActivityDoneCount = normalizeNonNegativeInteger(progressContext.currentActivityDoneCount, 0);
    progressContext.totalActivitySuccessCount = normalizeNonNegativeInteger(progressContext.totalActivitySuccessCount, 0);
    progressContext.totalActivityFailedCount = normalizeNonNegativeInteger(progressContext.totalActivityFailedCount, 0);
    progressContext.phase = 'activity-start';

    emitActivityMatchBatchProgress(progressEmitter, progressContext, {
      phase: 'activity-start',
      currentActivityIndex: normalizeNonNegativeInteger(progressContext.currentActivityIndex, 0),
      currentActivityName: normalizeText(progressContext.currentActivityName),
      currentActivityKey: normalizeText(progressContext.currentActivityKey),
      currentShopIndex: 0,
      currentShopName: '',
      currentPageIndex: 0,
      currentPageCount: 0,
      currentActivityRawProductCount: 0,
      currentActivityUniqueProductCount: 0,
      totalRawProductCount: 0,
      totalUniqueProductCount: 0
    });

    unresolved.forEach((entry) => {
      shopResults.push({
        shopId: normalizeText(entry && entry.shopId),
        shopName: normalizeText(entry && entry.shopName),
        success: false,
        productCount: 0,
        stillCount: 0,
        hasMore: false,
        searchScrollContext: '',
        message: normalizeText(entry && entry.message)
      });
    });

    const resolvedShopResults = await mapWithConcurrency(
      resolvedShops,
      DEFAULT_ACTIVITY_MATCH_QUERY_CONCURRENCY,
      async (shop, shopIndex) => {
        assertActivityMatchBatchQueryJobActive(queryJob);
        const shopId = normalizeText(shop && shop.shopId);
        const shopName = normalizeText(shop && shop.shopName) || shopId;
        const currentShopIndex = shopIndex + 1;

        try {
          progressContext.currentShopIndex = currentShopIndex;
          progressContext.currentShopName = shopName;
          progressContext.currentPageIndex = 0;
          progressContext.currentPageCount = 0;
          progressContext.phase = 'activity-start';
          emitActivityMatchBatchProgress(progressEmitter, progressContext, {
            phase: 'activity-start',
            currentShopIndex,
            currentShopName: shopName,
            currentPageIndex: 0,
            currentPageCount: 0,
            currentActivityRawProductCount: rawProductCount,
            currentActivityUniqueProductCount: aggregatedMap.size,
            totalRawProductCount: rawProductCount,
            totalUniqueProductCount: aggregatedMap.size
          });

          let sessionContext = await resolveShopSessionContext(shop);
          sessionContext = await warmupSellerSessionContext(sessionContext, {
            timeoutMs: 60000
          });
          sessionContext = applyKnownMallIdToSessionContext(sessionContext, shop);
          const mallId = await ensureMallId(sessionContext);

          let searchScrollContext = '';
          let shopHasMore = false;
          let shopStillCount = 0;
          let shopProductCount = 0;
          let shopPageCount = 0;

          while (true) {
            assertActivityMatchBatchQueryJobActive(queryJob);
            shopPageCount += 1;
            progressContext.currentPageIndex = shopPageCount;

            if (shopPageCount > 10000) {
              throw new Error('\u6d3b\u52a8\u5546\u54c1\u5206\u9875\u8fc7\u591a\uff0c\u8bf7\u7f29\u5c0f\u67e5\u8be2\u8303\u56f4\u540e\u91cd\u8bd5');
            }

            const requestPayload = {
              activityType: request.activityType,
              rowCount: request.rowCount,
              addSite: request.addSite
            };

            if (request.activityThematicId) {
              requestPayload.activityThematicId = buildActivityThematicIdRequestValue(request.activityThematicId);
            }

            if (searchScrollContext) {
              requestPayload.searchScrollContext = searchScrollContext;
            }

            log('operations_activity_management_match_products_shop_request', {
              shopId,
              shopName,
              mallId,
              activityKey: request.activityKey,
              activityName: normalizeText(request.activityName),
              activityType: request.activityType,
              activityThematicId: request.activityThematicId,
              pageIndex: shopPageCount,
              hasSearchScrollContext: Boolean(searchScrollContext)
            });

            const responsePayload = await executeJsonRequest(
              sessionContext,
              ACTIVITY_MATCH_PRODUCTS_ENDPOINT_PATH,
              requestPayload,
              {
                refererPath: '/',
                timeoutMs: QUERY_REQUEST_TIMEOUT_MS
              }
            );
            assertActivityMatchBatchQueryJobActive(queryJob);
            const resultPayload = responsePayload && typeof responsePayload === 'object'
              ? responsePayload.result
              : null;
            const matchList = Array.isArray(resultPayload && resultPayload.matchList) ? resultPayload.matchList : [];
            const nextSearchScrollContext = normalizeText(resultPayload && resultPayload.searchScrollContext);

            shopHasMore = Boolean(resultPayload && resultPayload.hasMore);
            shopStillCount = normalizeNonNegativeInteger(resultPayload && resultPayload.stillCount, 0);

            log('operations_activity_management_match_products_shop_response', {
              shopId,
              shopName,
              mallId,
              activityKey: request.activityKey,
              activityName: normalizeText(request.activityName),
              activityType: request.activityType,
              activityThematicId: request.activityThematicId,
              pageIndex: shopPageCount,
              matchCount: matchList.length,
              hasMore: shopHasMore,
              stillCount: shopStillCount
            });

            const normalizedRows = matchList.map((row) => normalizeActivityMatchProductRow(row, {
              shopId,
              shopName
            }));

            rawProductCount += normalizedRows.length;
            shopProductCount += normalizedRows.length;

            normalizedRows.forEach((row) => {
              const rowKey = normalizeText(row && row.productId);

              if (!rowKey) {
                return;
              }

              if (aggregatedMap.has(rowKey)) {
                aggregatedMap.set(rowKey, mergeActivityMatchProductRows(aggregatedMap.get(rowKey), row));
              } else {
                aggregatedMap.set(rowKey, row);
              }
            });
            persistActivityMatchCache({
              rows: Array.from(aggregatedMap.values()),
              warning: ''
            });

            progressContext.currentPageCount = shopPageCount;
            progressContext.currentActivityRawProductCount = rawProductCount;
            progressContext.currentActivityUniqueProductCount = aggregatedMap.size;
            progressContext.totalRawProductCount = rawProductCount;
            progressContext.totalUniqueProductCount = aggregatedMap.size;
            progressContext.phase = 'activity-page';
            emitActivityMatchBatchProgress(progressEmitter, progressContext, {
              phase: 'activity-page',
              currentActivityIndex: normalizeNonNegativeInteger(progressContext.currentActivityIndex, 0),
              currentActivityName: normalizeText(progressContext.currentActivityName),
              currentActivityKey: normalizeText(progressContext.currentActivityKey),
              currentShopIndex,
              currentShopName: shopName,
              currentPageIndex: shopPageCount,
              currentPageCount: shopHasMore ? shopPageCount + 1 : shopPageCount,
              currentActivityRawProductCount: rawProductCount,
              currentActivityUniqueProductCount: aggregatedMap.size,
              totalRawProductCount: rawProductCount,
              totalUniqueProductCount: aggregatedMap.size
            });

            if (shopHasMore !== true) {
              break;
            }

            if (!nextSearchScrollContext) {
              throw new Error('\u6d3b\u52a8\u5546\u54c1\u5206\u9875\u4e0a\u4e0b\u6587\u7f3a\u5931\uff0c\u8bf7\u91cd\u8bd5');
            }

            if (nextSearchScrollContext === searchScrollContext) {
              throw new Error('\u6d3b\u52a8\u5546\u54c1\u5206\u9875\u4e0a\u4e0b\u6587\u672a\u66f4\u65b0\uff0c\u8bf7\u91cd\u8bd5');
            }

            searchScrollContext = nextSearchScrollContext;
          }

          totalStillCount += shopStillCount;
          progressContext.currentActivityRawProductCount = rawProductCount;
          progressContext.currentActivityUniqueProductCount = aggregatedMap.size;
          progressContext.totalRawProductCount = rawProductCount;
          progressContext.totalUniqueProductCount = aggregatedMap.size;
          progressContext.phase = 'activity-shop-done';
          emitActivityMatchBatchProgress(progressEmitter, progressContext, {
            phase: 'activity-shop-done',
            currentActivityIndex: normalizeNonNegativeInteger(progressContext.currentActivityIndex, 0),
            currentActivityName: normalizeText(progressContext.currentActivityName),
            currentActivityKey: normalizeText(progressContext.currentActivityKey),
            currentShopIndex,
            currentShopName: shopName,
            currentPageIndex: shopPageCount,
            currentPageCount: shopPageCount,
            currentActivityRawProductCount: rawProductCount,
            currentActivityUniqueProductCount: aggregatedMap.size,
            totalRawProductCount: rawProductCount,
            totalUniqueProductCount: aggregatedMap.size
          });

          const shopResult = {
            shopId,
            shopName,
            success: true,
            productCount: shopProductCount,
            stillCount: shopStillCount,
            hasMore: shopHasMore,
            searchScrollContext: '',
            message: ''
          };

          resolvedShopProgressResults[shopIndex] = shopResult;
          persistActivityMatchCache({
            rows: Array.from(aggregatedMap.values()),
            warning: ''
          });
          return shopResult;
        } catch (error) {
          if (isActivityMatchBatchQueryCanceledError(error)) {
            throw error;
          }
          const message = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u5931\u8d25';

          logError('operations_activity_management_match_products_shop_failed', error, {
            shopId,
            shopName,
            activityKey: request.activityKey,
            activityType: request.activityType
          });
          const shopResult = {
            shopId,
            shopName,
            success: false,
            productCount: 0,
            stillCount: 0,
            hasMore: false,
            searchScrollContext: '',
            message
          };

          resolvedShopProgressResults[shopIndex] = shopResult;
          persistActivityMatchCache({
            rows: Array.from(aggregatedMap.values())
          });
          progressContext.phase = 'activity-shop-failed';
          emitActivityMatchBatchProgress(progressEmitter, progressContext, {
            phase: 'activity-shop-failed',
            currentActivityIndex: normalizeNonNegativeInteger(progressContext.currentActivityIndex, 0),
            currentActivityName: normalizeText(progressContext.currentActivityName),
            currentActivityKey: normalizeText(progressContext.currentActivityKey),
            currentShopIndex,
            currentShopName: shopName,
            currentPageIndex: 0,
            currentPageCount: 0,
            currentActivityRawProductCount: rawProductCount,
            currentActivityUniqueProductCount: aggregatedMap.size,
            totalRawProductCount: rawProductCount,
            totalUniqueProductCount: aggregatedMap.size,
            message
          });
          return shopResult;
        }
      }
    );

    resolvedShopResults.forEach((shopResult) => {
      if (shopResult) {
        shopResults.push(shopResult);
      }
    });

    const rows = sortActivityMatchProductRows(Array.from(aggregatedMap.values()));
    const successShopCount = shopResults.filter((entry) => entry && entry.success === true).length;
    const failedShopCount = shopResults.length - successShopCount;
    const warning = failedShopCount > 0
      ? buildWarningMessage({
        successShopCount,
        failedShopCount,
        uniqueActivityCount: rows.length
      }, shopResults)
      : '';

    if (successShopCount <= 0) {
      return buildActivityMatchEmptyResponse(request, {
        totalShopCount: requestedShopIds.length,
        failedShopCount,
        shopResults,
        warning: warning || '\u6240\u9009\u5e97\u94fa\u67e5\u8be2\u5168\u90e8\u5931\u8d25'
      });
    }

    const cacheEntry = buildActivityMatchProductCacheEntry(request, {
      cacheKey: activityCacheKey,
      success: true,
      successShopCount,
      failedShopCount,
      rawProductCount,
      uniqueProductCount: rows.length,
      stillCount: totalStillCount,
      rows,
      shopResults,
      warning: warning || (rows.length > 0 ? '' : '\u5f53\u524d\u6d3b\u52a8\u6682\u65e0\u53ef\u62a5\u5546\u54c1')
    });

    setActivityMatchProductCacheEntry(activityCacheKey, cacheEntry);

    return buildActivityMatchProductResponse(cacheEntry, {
      pageIndex: request.pageIndex,
      pageSize: request.pageSize
    });
  }

  async function getActivityMatchProductsPage(payload = {}) {
    const request = normalizeActivityMatchRequest(payload);
    const cacheKey = normalizeText(request.cacheKey);

    if (!cacheKey) {
      return buildActivityMatchEmptyResponse(request, {
        warning: '\u6d3b\u52a8\u5546\u54c1\u7f13\u5b58\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u67e5\u8be2'
      });
    }

    const cacheEntry = getActivityMatchProductCacheEntry(cacheKey);

    if (!cacheEntry) {
      return buildActivityMatchEmptyResponse(request, {
        warning: '\u6d3b\u52a8\u5546\u54c1\u7f13\u5b58\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u67e5\u8be2'
      });
    }

    return buildActivityMatchProductResponse(cacheEntry, {
      pageIndex: request.pageIndex,
      pageSize: request.pageSize
    });
  }

  async function queryActivityMatchProductsBatch(payload = {}, options = {}) {
    const request = normalizeActivityMatchBatchRequest(payload);
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const progressContext = options && typeof options.progressContext === 'object' && options.progressContext !== null
      ? { ...options.progressContext }
      : {};

    if (request.shopIds.length <= 0) {
      return buildActivityMatchBatchEmptyResponse(request, {
        warning: '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa'
      });
    }

    if (request.activities.length <= 0) {
      return buildActivityMatchBatchEmptyResponse(request, {
        warning: '\u8bf7\u5148\u52fe\u9009\u6d3b\u52a8'
      });
    }

    const batchCacheKey = buildActivityMatchBatchCacheKey(request);
    const queryJob = createActivityMatchBatchQueryJob(request.requestId);
    queryJob.cacheKey = batchCacheKey;

    log('operations_activity_management_match_products_batch_request_payload', {
      requestId: normalizeText(request.requestId),
      shopIds: request.shopIds,
      activityCount: request.activities.length,
      activities: request.activities.slice(0, 20).map((activity) => ({
        activityKey: normalizeText(activity && activity.activityKey),
        activityType: normalizeOptionalNumber(activity && activity.activityType),
        activityThematicId: normalizeText(activity && activity.activityThematicId),
        activityName: buildActivityMatchDisplayName(activity),
        shopIds: normalizeSelectedShopIds(activity && activity.shopIds)
      }))
    });

    const aggregatedMap = new Map();
    const activityResults = [];
    let totalRawProductCount = 0;
    let totalUniqueProductCount = 0;
    let currentActivity = null;
    let currentActivityName = '';
    let currentActivityShopIds = [];
    const persistActivityMatchBatchCache = (options = {}) => {
      const rows = Array.isArray(options.rows)
        ? options.rows
        : sortActivityMatchProductRows(Array.from(aggregatedMap.values()));
      const activityResultsSnapshot = Array.isArray(options.activityResults)
        ? options.activityResults
        : activityResults.slice();
      const successActivityCount = normalizeNonNegativeInteger(
        Object.prototype.hasOwnProperty.call(options, 'successActivityCount')
          ? options.successActivityCount
          : activityResultsSnapshot.filter((entry) => entry && entry.success === true).length,
        0
      );
      const failedActivityCount = normalizeNonNegativeInteger(
        Object.prototype.hasOwnProperty.call(options, 'failedActivityCount')
          ? options.failedActivityCount
          : (activityResultsSnapshot.length - successActivityCount),
        0
      );
      const warning = (() => {
        if (Object.prototype.hasOwnProperty.call(options, 'warning')) {
          return normalizeText(options.warning);
        }

        if (failedActivityCount > 0) {
          return `\u5df2\u5b8c\u6210 ${successActivityCount} \u4e2a\u6d3b\u52a8\uff0c${failedActivityCount} \u4e2a\u5931\u8d25`;
        }

        return rows.length > 0 ? '' : buildBatchZeroProductWarning(activityResultsSnapshot);
      })();
      const cacheEntry = buildActivityMatchBatchCacheEntry(request, {
        cacheKey: batchCacheKey,
        success: Object.prototype.hasOwnProperty.call(options, 'success')
          ? options.success === true
          : (successActivityCount > 0 || rows.length > 0),
        successActivityCount,
        failedActivityCount,
        uniqueProductCount: rows.length,
        rows,
        quickCostEntries: Array.isArray(options.quickCostEntries)
          ? options.quickCostEntries
          : buildActivityMatchBatchQuickCostEntries(rows),
        activityResults: activityResultsSnapshot,
        warning
      });

      setActivityMatchBatchCacheEntry(batchCacheKey, cacheEntry);
      return cacheEntry;
    };

    persistActivityMatchBatchCache({
      rows: [],
      quickCostEntries: [],
      activityResults: [],
      warning: '',
      success: false
    });

    progressContext.requestId = normalizeText(progressContext.requestId || request.requestId);
    progressContext.totalActivityCount = request.activities.length;
    progressContext.totalShopCount = request.shopIds.length;
    progressContext.currentActivityDoneCount = 0;
    progressContext.totalActivitySuccessCount = 0;
    progressContext.totalActivityFailedCount = 0;
    progressContext.totalRawProductCount = 0;
    progressContext.totalUniqueProductCount = 0;

    emitActivityMatchBatchProgress(progressEmitter, progressContext, {
      phase: 'batch-start',
      totalActivityCount: request.activities.length,
      totalShopCount: request.shopIds.length,
      currentActivityDoneCount: 0,
      totalActivitySuccessCount: 0,
      totalActivityFailedCount: 0,
      totalRawProductCount: 0,
      totalUniqueProductCount: 0
    });

    try {
      for (let activityIndex = 0; activityIndex < request.activities.length; activityIndex += 1) {
        assertActivityMatchBatchQueryJobActive(queryJob);
      const activity = request.activities[activityIndex];
      const currentActivityIndex = activityIndex + 1;
      const activityName = buildActivityMatchDisplayName(activity);
      const activityShopIds = Array.isArray(activity && activity.shopIds) && activity.shopIds.length > 0
        ? activity.shopIds
        : request.shopIds;
      currentActivity = activity;
      currentActivityName = activityName;
      currentActivityShopIds = activityShopIds;

      try {
        progressContext.currentActivityIndex = currentActivityIndex;
        progressContext.currentActivityName = activityName;
        progressContext.currentActivityKey = activity.activityKey;
        progressContext.currentActivityRawProductCount = 0;
        progressContext.currentActivityUniqueProductCount = 0;
        progressContext.currentPageIndex = 0;
        progressContext.currentPageCount = 0;
        emitActivityMatchBatchProgress(progressEmitter, progressContext, {
          phase: 'activity-start',
          currentActivityIndex,
          currentActivityName: activityName,
          currentActivityKey: activity.activityKey,
          currentActivityRawProductCount: totalRawProductCount,
          currentActivityUniqueProductCount: totalUniqueProductCount,
          totalRawProductCount,
          totalUniqueProductCount,
          currentActivityDoneCount: activityIndex,
          totalActivitySuccessCount: progressContext.totalActivitySuccessCount,
          totalActivityFailedCount: progressContext.totalActivityFailedCount
        });

        const activityResponse = await queryActivityMatchProducts({
          shopIds: activityShopIds,
          activityKey: activity.activityKey,
          activityName: activityName,
          activityType: activity.activityType,
          activityThematicId: activity.activityThematicId,
          rowCount: request.rowCount,
          pageIndex: 1,
          pageSize: request.pageSize,
          addSite: true
        }, {
          emitProgress: progressEmitter,
          queryJob,
          progressContext: {
            ...progressContext,
            currentActivityIndex,
            currentActivityName: activityName,
            currentActivityKey: activity.activityKey,
            totalRawProductCount,
            totalUniqueProductCount
          }
        });
        assertActivityMatchBatchQueryJobActive(queryJob);
        const activityCacheKey = normalizeText(activityResponse && activityResponse.cacheKey);
        const activityCacheEntry = activityCacheKey
          ? getActivityMatchProductCacheEntry(activityCacheKey)
          : null;
        const activityRows = Array.isArray(activityCacheEntry && activityCacheEntry.rows)
          ? activityCacheEntry.rows
          : [];

        mergeActivityRowsIntoBatchAggregate(aggregatedMap, activityRows, activity);

        totalRawProductCount += normalizeNonNegativeInteger(activityResponse && activityResponse.rawProductCount, activityRows.length);
        totalUniqueProductCount = aggregatedMap.size;
        progressContext.currentActivityRawProductCount = normalizeNonNegativeInteger(activityResponse && activityResponse.rawProductCount, activityRows.length);
        progressContext.currentActivityUniqueProductCount = activityRows.length;
        progressContext.totalRawProductCount = totalRawProductCount;
        progressContext.totalUniqueProductCount = totalUniqueProductCount;
        progressContext.currentActivityDoneCount = activityIndex + 1;
        if (activityResponse && activityResponse.success === true) {
          progressContext.totalActivitySuccessCount += 1;
        } else {
          progressContext.totalActivityFailedCount += 1;
        }
        emitActivityMatchBatchProgress(progressEmitter, progressContext, {
          phase: 'activity-done',
          currentActivityIndex,
          currentActivityName: activityName,
          currentActivityKey: activity.activityKey,
          currentActivityRawProductCount: progressContext.currentActivityRawProductCount,
          currentActivityUniqueProductCount: activityRows.length,
          totalRawProductCount,
          totalUniqueProductCount,
          currentActivityDoneCount: activityIndex + 1,
          totalActivitySuccessCount: progressContext.totalActivitySuccessCount,
          totalActivityFailedCount: progressContext.totalActivityFailedCount
        });

        activityResults.push({
          activityKey: activity.activityKey,
          activityType: activity.activityType,
          activityThematicId: activity.activityThematicId,
          activityName,
          cacheKey: activityCacheKey,
          success: activityResponse && activityResponse.success === true,
          uniqueProductCount: normalizeNonNegativeInteger(activityResponse && activityResponse.uniqueProductCount, activityRows.length),
          message: normalizeText(activityResponse && activityResponse.warning)
        });
        persistActivityMatchBatchCache();
        currentActivity = null;
        currentActivityName = '';
        currentActivityShopIds = [];
      } catch (error) {
        if (isActivityMatchBatchQueryCanceledError(error)) {
          throw error;
        }
        const message = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u5931\u8d25';

        logError('operations_activity_management_match_products_batch_activity_failed', error, {
          activityKey: activity.activityKey,
          activityType: activity.activityType,
          activityThematicId: activity.activityThematicId
        });
        activityResults.push({
          activityKey: activity.activityKey,
          activityType: activity.activityType,
          activityThematicId: activity.activityThematicId,
          activityName,
          cacheKey: '',
          success: false,
          uniqueProductCount: 0,
          message
        });
        persistActivityMatchBatchCache();
        currentActivity = null;
        currentActivityName = '';
        currentActivityShopIds = [];
        progressContext.currentActivityDoneCount = activityIndex + 1;
        progressContext.totalActivityFailedCount += 1;
        emitActivityMatchBatchProgress(progressEmitter, progressContext, {
          phase: 'activity-failed',
          currentActivityIndex,
          currentActivityName: activityName,
          currentActivityKey: activity.activityKey,
          currentActivityRawProductCount: progressContext.currentActivityRawProductCount,
          currentActivityUniqueProductCount: progressContext.currentActivityUniqueProductCount,
          totalRawProductCount,
          totalUniqueProductCount,
          currentActivityDoneCount: activityIndex + 1,
          totalActivitySuccessCount: progressContext.totalActivitySuccessCount,
          totalActivityFailedCount: progressContext.totalActivityFailedCount,
          message
        });
      }
      }
    } catch (error) {
      if (isActivityMatchBatchQueryCanceledError(error)) {
        if (currentActivity) {
          const partialActivityCacheEntry = getActivityMatchProductCacheEntry(buildActivityMatchCacheKey({
            shopIds: currentActivityShopIds,
            activityKey: currentActivity.activityKey,
            activityType: currentActivity.activityType,
            activityThematicId: currentActivity.activityThematicId
          }));
          const partialActivityRows = Array.isArray(partialActivityCacheEntry && partialActivityCacheEntry.rows)
            ? partialActivityCacheEntry.rows
            : [];
          const hasActivityResult = activityResults.some((entry) => (
            normalizeText(entry && entry.activityKey) === normalizeText(currentActivity && currentActivity.activityKey)
            && normalizeText(entry && entry.activityThematicId) === normalizeText(currentActivity && currentActivity.activityThematicId)
          ));

          mergeActivityRowsIntoBatchAggregate(aggregatedMap, partialActivityRows, currentActivity);

          if (!hasActivityResult) {
            activityResults.push({
              activityKey: currentActivity.activityKey,
              activityType: currentActivity.activityType,
              activityThematicId: currentActivity.activityThematicId,
              activityName: currentActivityName || buildActivityMatchDisplayName(currentActivity),
              cacheKey: normalizeText(partialActivityCacheEntry && partialActivityCacheEntry.cacheKey),
              success: partialActivityRows.length > 0,
              uniqueProductCount: partialActivityRows.length,
              message: partialActivityRows.length > 0
                ? '\u5df2\u505c\u6b62\u67e5\u8be2\uff0c\u4fdd\u7559\u5f53\u524d\u5df2\u67e5\u5230\u7684\u5546\u54c1'
                : '\u5df2\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2'
            });
          }
        }

        totalUniqueProductCount = aggregatedMap.size;
        progressContext.totalUniqueProductCount = totalUniqueProductCount;
        const canceledRows = sortActivityMatchProductRows(Array.from(aggregatedMap.values()));
        const canceledCacheEntry = persistActivityMatchBatchCache({
          rows: canceledRows,
          warning: canceledRows.length > 0
            ? '\u5df2\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\uff0c\u4fdd\u7559\u5df2\u67e5\u8be2\u5230\u7684\u5546\u54c1'
            : '\u5df2\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2'
        });

        return {
          ...buildActivityMatchBatchPageResponse(canceledCacheEntry, {
            pageIndex: request.pageIndex,
            pageSize: request.pageSize,
            request,
            warning: normalizeText(canceledCacheEntry && canceledCacheEntry.warning)
          }),
          canceled: true
        };
      }

      throw error;
    } finally {
      clearActivityMatchBatchQueryJob(queryJob);
    }

    const rows = sortActivityMatchProductRows(Array.from(aggregatedMap.values()));
    const quickCostEntries = buildActivityMatchBatchQuickCostEntries(rows);
    const successActivityCount = activityResults.filter((entry) => entry && entry.success === true).length;
    const failedActivityCount = activityResults.length - successActivityCount;

    if (successActivityCount <= 0) {
      return buildActivityMatchBatchEmptyResponse(request, {
        totalActivityCount: request.activities.length,
        failedActivityCount,
        activityResults,
        warning: '\u52fe\u9009\u6d3b\u52a8\u5168\u90e8\u67e5\u8be2\u5931\u8d25'
      });
    }

    const cacheEntry = buildActivityMatchBatchCacheEntry(request, {
      cacheKey: batchCacheKey,
      success: true,
      successActivityCount,
      failedActivityCount,
      uniqueProductCount: rows.length,
      rows,
      quickCostEntries,
      activityResults,
      warning: failedActivityCount > 0
        ? `\u5df2\u5b8c\u6210 ${successActivityCount} \u4e2a\u6d3b\u52a8\uff0c${failedActivityCount} \u4e2a\u5931\u8d25`
        : (rows.length > 0 ? '' : buildBatchZeroProductWarning(activityResults))
    });

    setActivityMatchBatchCacheEntry(batchCacheKey, cacheEntry);

    emitActivityMatchBatchProgress(progressEmitter, progressContext, {
      phase: 'batch-done',
      currentActivityIndex: request.activities.length,
      currentActivityName: request.activities.length > 0 ? buildActivityMatchDisplayName(request.activities[request.activities.length - 1]) : '',
      totalActivityCount: request.activities.length,
      totalShopCount: request.shopIds.length,
      currentActivityDoneCount: request.activities.length,
      totalActivitySuccessCount: successActivityCount,
      totalActivityFailedCount: failedActivityCount,
      totalRawProductCount: totalRawProductCount,
      totalUniqueProductCount: rows.length
    });

    return buildActivityMatchBatchPageResponse(cacheEntry, {
      pageIndex: request.pageIndex,
      pageSize: request.pageSize,
      request
    });
  }

  async function getActivityMatchProductsBatchPage(payload = {}) {
    const request = normalizeActivityMatchBatchRequest(payload);
    const cacheKey = normalizeText(request.cacheKey);

    if (!cacheKey) {
      return buildActivityMatchBatchEmptyResponse(request, {
        warning: '\u5546\u54c1\u5217\u8868\u7f13\u5b58\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u63d0\u4ea4'
      });
    }

    const cacheEntry = getActivityMatchBatchCacheEntry(cacheKey);

    if (!cacheEntry) {
      return buildActivityMatchBatchEmptyResponse(request, {
        warning: '\u5546\u54c1\u5217\u8868\u7f13\u5b58\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u63d0\u4ea4'
      });
    }

    return buildActivityMatchBatchPageResponse(cacheEntry, {
      pageIndex: request.pageIndex,
      pageSize: request.pageSize,
      request
    });
  }

  function toActivitySubmitRequestValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    if (!/^\d+$/.test(normalizedValue)) {
      return normalizedValue;
    }

    const numericValue = Number(normalizedValue);
    return Number.isSafeInteger(numericValue) ? numericValue : normalizedValue;
  }

  function normalizeActivityBatchSignupSubmitProductPayload(record) {
    const source = record && typeof record === 'object' ? record : {};
    const productIdText = normalizeText(source.productId);
    const activityStock = normalizeNonNegativeInteger(source.activityStock, 0);
    const sessionIds = Array.from(new Set(
      (Array.isArray(source.sessionIds) ? source.sessionIds : [])
        .map((value) => toActivitySubmitRequestValue(value))
        .filter((value) => value !== '')
    ));
    const siteMap = new Map();

    (Array.isArray(source.siteInfoList) ? source.siteInfoList : []).forEach((siteInfo) => {
      const siteId = toActivitySubmitRequestValue(siteInfo && siteInfo.siteId);
      const siteKey = normalizeText(siteId);

      if (!siteKey) {
        return;
      }

      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, {
          siteId,
          skcMap: new Map()
        });
      }

      const siteEntry = siteMap.get(siteKey);

      (Array.isArray(siteInfo && siteInfo.skcList) ? siteInfo.skcList : []).forEach((skcItem) => {
        const skcId = toActivitySubmitRequestValue(skcItem && skcItem.skcId);
        const skcKey = normalizeText(skcId);

        if (!skcKey) {
          return;
        }

        if (!siteEntry.skcMap.has(skcKey)) {
          siteEntry.skcMap.set(skcKey, {
            skcId,
            skuMap: new Map()
          });
        }

        const skcEntry = siteEntry.skcMap.get(skcKey);

        (Array.isArray(skcItem && skcItem.skuList) ? skcItem.skuList : []).forEach((skuItem) => {
          const skuId = toActivitySubmitRequestValue(skuItem && skuItem.skuId);
          const skuKey = normalizeText(skuId);
          const activityPriceValue = Number(skuItem && skuItem.activityPrice);

          if (!skuKey || !Number.isFinite(activityPriceValue) || activityPriceValue <= 0) {
            return;
          }

          if (!skcEntry.skuMap.has(skuKey)) {
            skcEntry.skuMap.set(skuKey, {
              skuId,
              activityPrice: Math.max(1, Math.round(activityPriceValue))
            });
          }
        });
      });
    });

    const siteInfoList = Array.from(siteMap.values())
      .map((siteEntry) => ({
        siteId: siteEntry.siteId,
        skcList: Array.from(siteEntry.skcMap.values())
          .map((skcEntry) => ({
            skcId: skcEntry.skcId,
            skuList: Array.from(skcEntry.skuMap.values())
          }))
          .filter((skcEntry) => skcEntry.skuList.length > 0)
      }))
      .filter((siteEntry) => siteEntry.skcList.length > 0);

    return {
      productId: toActivitySubmitRequestValue(productIdText),
      productIdText,
      activityStock,
      sessionIds,
      siteInfoList
    };
  }

  function normalizeActivityBatchSignupSubmitRow(record) {
    const source = record && typeof record === 'object' ? record : {};
    const normalizedProductPayload = normalizeActivityBatchSignupSubmitProductPayload(source.productPayload);
    const productId = normalizeText(source.productId) || normalizedProductPayload.productIdText;
    const shopId = normalizeText(source.shopId);
    const activityKey = normalizeText(source.activityKey);
    const activityType = normalizeOptionalNumber(source.activityType);
    const activityThematicId = normalizeText(source.activityThematicId);
    const siteIds = Array.from(new Set([
      ...(Array.isArray(source.siteIds) ? source.siteIds : []).map((value) => normalizeText(value)),
      ...(
        Array.isArray(normalizedProductPayload && normalizedProductPayload.siteInfoList)
          ? normalizedProductPayload.siteInfoList.map((item) => normalizeText(item && item.siteId))
          : []
      )
    ].filter(Boolean)));
    const siteNames = Array.from(new Set(
      (Array.isArray(source.siteNames) ? source.siteNames : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    ));

    return {
      rowKey: normalizeText(source.rowKey) || [activityKey, productId].filter(Boolean).join('\x1f'),
      submitScopeKey: normalizeText(source.submitScopeKey),
      productId,
      productName: normalizeText(source.productName),
      shopId,
      shopName: normalizeText(source.shopName) || shopId,
      activityKey,
      activityType,
      activityThematicId,
      activityName: normalizeText(source.activityName),
      siteIds,
      siteNames,
      productPayload: normalizedProductPayload
    };
  }

  function buildActivityBatchSignupInvalidRowMessage(row) {
    if (!normalizeText(row && row.shopId)) {
      return '\u5546\u54c1\u672a\u5339\u914d\u5230\u5e97\u94fa';
    }

    if (normalizeOptionalNumber(row && row.activityType) === null) {
      return '\u6d3b\u52a8\u7c7b\u578b\u7f3a\u5931';
    }

    if (!normalizeText(row && row.productId)) {
      return '\u5546\u54c1ID\u7f3a\u5931';
    }

    if (normalizeNonNegativeInteger(row && row.productPayload && row.productPayload.activityStock, 0) <= 0) {
      return '\u5efa\u8bae\u6d3b\u52a8\u5e93\u5b58\u7f3a\u5931';
    }

    if (!Array.isArray(row && row.productPayload && row.productPayload.sessionIds) || row.productPayload.sessionIds.length <= 0) {
      return '\u53ef\u62a5\u573a\u6b21\u7f3a\u5931';
    }

    if (!Array.isArray(row && row.productPayload && row.productPayload.siteInfoList) || row.productPayload.siteInfoList.length <= 0) {
      return '\u53ef\u62a5\u7ad9\u70b9SKU\u7f3a\u5931';
    }

    return '';
  }

  function normalizeActivityBatchSignupSubmitRequest(payload = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const batchSize = Math.min(
      MAX_ACTIVITY_BATCH_SIGNUP_SUBMIT_SIZE,
      Math.max(1, normalizeNonNegativeInteger(source.batchSize, DEFAULT_ACTIVITY_BATCH_SIGNUP_SUBMIT_SIZE))
    );
    const rows = [];
    const invalidRows = [];

    (Array.isArray(source.rows) ? source.rows : []).forEach((record) => {
      const normalizedRow = normalizeActivityBatchSignupSubmitRow(record);
      const invalidMessage = buildActivityBatchSignupInvalidRowMessage(normalizedRow);

      if (invalidMessage) {
        invalidRows.push(buildActivityBatchSignupSkippedRowResult(normalizedRow, {
          message: invalidMessage
        }));
        return;
      }

      rows.push(normalizedRow);
    });

    return {
      requestId: normalizeText(source.requestId),
      batchSize,
      rows,
      invalidRows
    };
  }

  function buildActivityBatchSignupGroupKey(row) {
    return [
      normalizeText(row && row.shopId),
      normalizeText(row && row.activityKey),
      normalizeOptionalNumber(row && row.activityType) === null ? '' : String(normalizeOptionalNumber(row && row.activityType)),
      normalizeText(row && row.activityThematicId)
    ].join('\x1f');
  }

  function buildActivityBatchSignupRowResult(row, overrides = {}) {
    const success = overrides && overrides.success === true;

    return {
      rowKey: normalizeText(row && row.rowKey),
      submitScopeKey: normalizeText(row && row.submitScopeKey),
      productId: normalizeText(row && row.productId),
      productName: normalizeText(row && row.productName),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      activityKey: normalizeText(row && row.activityKey),
      activityType: normalizeOptionalNumber(row && row.activityType),
      activityThematicId: normalizeText(row && row.activityThematicId),
      activityName: normalizeText(row && row.activityName),
      siteIds: Array.isArray(row && row.siteIds)
        ? row.siteIds.map((value) => normalizeText(value)).filter(Boolean)
        : [],
      siteNames: Array.isArray(row && row.siteNames)
        ? row.siteNames.map((value) => normalizeText(value)).filter(Boolean)
        : [],
      success,
      statusText: success ? '\u5df2\u62a5\u540d' : '\u63d0\u4ea4\u5931\u8d25',
      enrollId: normalizeText(overrides && overrides.enrollId),
      message: normalizeText(overrides && overrides.message)
    };
  }

  function buildActivityBatchSignupSkippedRowResult(row, overrides = {}) {
    return {
      rowKey: normalizeText(row && row.rowKey),
      submitScopeKey: normalizeText(row && row.submitScopeKey),
      productId: normalizeText(row && row.productId),
      productName: normalizeText(row && row.productName),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      activityKey: normalizeText(row && row.activityKey),
      activityType: normalizeOptionalNumber(row && row.activityType),
      activityThematicId: normalizeText(row && row.activityThematicId),
      activityName: normalizeText(row && row.activityName),
      siteIds: Array.isArray(row && row.siteIds)
        ? row.siteIds.map((value) => normalizeText(value)).filter(Boolean)
        : [],
      siteNames: Array.isArray(row && row.siteNames)
        ? row.siteNames.map((value) => normalizeText(value)).filter(Boolean)
        : [],
      message: normalizeText(overrides && overrides.message)
    };
  }

  function buildActivityBatchSignupFailMessageMap(failList) {
    const failMessageMap = new Map();

    (Array.isArray(failList) ? failList : []).forEach((item) => {
      const productId = pickFirstTextValue(
        item && item.productId,
        item && item.productID,
        item && item.semiProductId
      );
      const message = pickFirstTextValue(
        item && item.errorMsg,
        item && item.message,
        item && item.msg,
        item && item.failMsg,
        item && item.reason
      ) || '\u63d0\u4ea4\u5931\u8d25';

      if (productId && !failMessageMap.has(productId)) {
        failMessageMap.set(productId, message);
      }
    });

    return failMessageMap;
  }

  function resolveActivityBatchSignupResultPayload(payload) {
    if (payload && typeof payload === 'object' && payload.result && typeof payload.result === 'object') {
      return payload.result;
    }

    return payload && typeof payload === 'object' ? payload : null;
  }

  function resolveActivityBatchSignupSiteResultSuccess(record, enrollId = '') {
    if (enrollId) {
      return true;
    }

    if (!record || typeof record !== 'object') {
      return null;
    }

    const booleanFields = ['success', 'isSuccess', 'enrollSuccess', 'submitSuccess'];

    for (const fieldName of booleanFields) {
      if (typeof record[fieldName] === 'boolean') {
        return record[fieldName];
      }
    }

    const errorCode = normalizeOptionalNumber(record.errorCode);

    if (errorCode !== null) {
      return Number(errorCode) === 1000000 || Number(errorCode) === 0;
    }

    const codeText = normalizeText(record.code);

    if (codeText) {
      if (/^\d+$/.test(codeText)) {
        return Number(codeText) === 1000000 || Number(codeText) === 0;
      }

      const normalizedCodeText = codeText.toLowerCase();

      if (['success', 'succeeded', 'ok', 'pass', 'passed', 'done'].includes(normalizedCodeText)) {
        return true;
      }

      if (['fail', 'failed', 'error', 'reject', 'rejected', 'deny', 'denied', 'invalid', 'skip', 'skipped'].includes(normalizedCodeText)) {
        return false;
      }
    }

    const statusText = pickFirstTextValue(
      record.status,
      record.resultStatus,
      record.state,
      record.enrollStatus,
      record.submitStatus
    ).toLowerCase();

    if (statusText) {
      if (['success', 'succeeded', 'ok', 'pass', 'passed', 'done'].includes(statusText)) {
        return true;
      }

      if (['fail', 'failed', 'error', 'reject', 'rejected', 'deny', 'denied', 'invalid', 'skip', 'skipped'].includes(statusText)) {
        return false;
      }
    }

    return null;
  }

  function resolveActivityBatchSignupSiteFailMessage(record, resolvedSuccess = null) {
    if (!record || typeof record !== 'object') {
      return '';
    }

    const explicitMessage = pickFirstTextValue(
      record.errorMsg,
      record.errorMessage,
      record.failMsg,
      record.failMessage,
      record.reason,
      record.failReason,
      record.rejectReason,
      record.rejectMsg,
      record.denyReason,
      record.tipMsg
    );

    if (explicitMessage) {
      return explicitMessage;
    }

    if (resolvedSuccess === true) {
      return '';
    }

    const fallbackMessage = pickFirstTextValue(
      record.message,
      record.msg,
      record.desc,
      record.tip
    );

    if (fallbackMessage && resolvedSuccess === false) {
      return fallbackMessage;
    }

    return '';
  }

  function collectActivityBatchSignupSiteResultEntries(source, fallbackSiteId = '', depth = 0) {
    if (depth > 5 || !source) {
      return [];
    }

    if (Array.isArray(source)) {
      return source.flatMap((item) => collectActivityBatchSignupSiteResultEntries(item, fallbackSiteId, depth + 1));
    }

    if (typeof source !== 'object') {
      return [];
    }

    const directSiteId = pickFirstTextValue(
      source.siteId,
      source.siteID,
      source.stationId,
      fallbackSiteId
    );
    const directSiteName = pickFirstTextValue(
      source.siteName,
      source.siteLabel,
      source.stationName,
      source.stationLabel
    );
    const enrollId = pickFirstTextValue(
      source.enrollId,
      source.activityEnrollId,
      source.signupId,
      source.enrollID,
      source.activityEnrollID
    );
    const resolvedSuccess = resolveActivityBatchSignupSiteResultSuccess(source, enrollId);
    const failMessage = resolveActivityBatchSignupSiteFailMessage(source, resolvedSuccess);
    const directEntries = [];

    if (enrollId || failMessage || resolvedSuccess !== null) {
      directEntries.push({
        siteId: directSiteId,
        siteName: directSiteName,
        enrollId,
        success: resolvedSuccess,
        message: failMessage
      });
    }

    const knownNestedKeys = [
      'siteEnrollResult',
      'siteEnrollResults',
      'siteResult',
      'siteResults',
      'siteResultList',
      'enrollResult',
      'enrollResults',
      'result',
      'results',
      'resultList',
      'siteInfoList',
      'siteList'
    ];

    const nestedEntries = knownNestedKeys.flatMap((fieldName) => (
      collectActivityBatchSignupSiteResultEntries(
        source[fieldName],
        directSiteId || fallbackSiteId,
        depth + 1
      )
    ));

    if (directEntries.length > 0 || nestedEntries.length > 0) {
      return directEntries.concat(nestedEntries);
    }

    return Object.keys(source).flatMap((fieldName) => {
      if (knownNestedKeys.includes(fieldName)) {
        return [];
      }

      const fieldValue = source[fieldName];

      if (!fieldValue || (typeof fieldValue !== 'object' && !Array.isArray(fieldValue))) {
        return [];
      }

      const fallbackChildSiteId = /^\d+$/.test(normalizeText(fieldName))
        ? normalizeText(fieldName)
        : (directSiteId || fallbackSiteId);

      return collectActivityBatchSignupSiteResultEntries(fieldValue, fallbackChildSiteId, depth + 1);
    });
  }

  function buildActivityBatchSignupSiteLabel(siteId, siteName) {
    const normalizedSiteName = normalizeText(siteName);

    if (normalizedSiteName) {
      return normalizedSiteName;
    }

    const normalizedSiteId = normalizeText(siteId);
    return normalizedSiteId ? `\u7ad9\u70b9ID ${normalizedSiteId}` : '';
  }

  function buildActivityBatchSignupSiteResultMaps(product2SiteEnrollResultMap) {
    const enrollIdMap = new Map();
    const failMessageMap = new Map();

    if (!product2SiteEnrollResultMap || typeof product2SiteEnrollResultMap !== 'object') {
      return {
        enrollIdMap,
        failMessageMap
      };
    }

    Object.keys(product2SiteEnrollResultMap).forEach((productIdKey) => {
      const productId = normalizeText(productIdKey);

      if (!productId) {
        return;
      }

      const siteResultSource = product2SiteEnrollResultMap[productIdKey];
      const siteResultEntries = collectActivityBatchSignupSiteResultEntries(siteResultSource);
      const messageParts = [];
      const seenMessages = new Set();

      siteResultEntries.forEach((entry) => {
        const entryEnrollId = normalizeText(entry && entry.enrollId);
        const entryMessage = normalizeText(entry && entry.message);

        if (entryEnrollId && !enrollIdMap.has(productId)) {
          enrollIdMap.set(productId, entryEnrollId);
        }

        if (!entryMessage) {
          return;
        }

        const siteLabel = buildActivityBatchSignupSiteLabel(entry && entry.siteId, entry && entry.siteName);
        const messageText = siteLabel ? `${siteLabel}\uff1a${entryMessage}` : entryMessage;

        if (messageText && !seenMessages.has(messageText)) {
          seenMessages.add(messageText);
          messageParts.push(messageText);
        }
      });

      if (messageParts.length > 0) {
        failMessageMap.set(productId, messageParts.join('\uff1b'));
        return;
      }

      const fallbackMessage = typeof siteResultSource === 'string' || typeof siteResultSource === 'number'
        ? normalizeText(siteResultSource)
        : '';

      if (fallbackMessage) {
        failMessageMap.set(productId, fallbackMessage);
      }
    });

    return {
      enrollIdMap,
      failMessageMap
    };
  }

  function buildActivityBatchSignupEnrollIdMap(productId2EnrollIdMap) {
    const enrollIdMap = new Map();

    if (!productId2EnrollIdMap || typeof productId2EnrollIdMap !== 'object') {
      return enrollIdMap;
    }

    Object.keys(productId2EnrollIdMap).forEach((productId) => {
      const normalizedProductId = normalizeText(productId);

      if (!normalizedProductId) {
        return;
      }

      enrollIdMap.set(normalizedProductId, normalizeText(productId2EnrollIdMap[productId]));
    });

    return enrollIdMap;
  }

  function buildActivityBatchSignupRequestPayload(group, rows) {
    const requestPayload = {
      activityType: normalizeOptionalNumber(group && group.activityType),
      productList: (Array.isArray(rows) ? rows : []).map((row) => ({
        productId: row.productPayload.productId,
        activityStock: row.productPayload.activityStock,
        siteInfoList: row.productPayload.siteInfoList,
        sessionIds: row.productPayload.sessionIds
      }))
    };

    if (normalizeText(group && group.activityThematicId)) {
      requestPayload.activityThematicId = buildActivityThematicIdRequestValue(group.activityThematicId);
    }

    return requestPayload;
  }

  function chunkActivityBatchSignupRows(rows, batchSize) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const normalizedBatchSize = Math.max(1, normalizeNonNegativeInteger(batchSize, DEFAULT_ACTIVITY_BATCH_SIGNUP_SUBMIT_SIZE));
    const chunks = [];

    for (let index = 0; index < sourceRows.length; index += normalizedBatchSize) {
      chunks.push(sourceRows.slice(index, index + normalizedBatchSize));
    }

    return chunks;
  }

  async function submitActivityMatchProductsBatch(payload = {}, options = {}) {
    const request = normalizeActivityBatchSignupSubmitRequest(payload);
    const totalInputRowCount = Array.isArray(payload && payload.rows) ? payload.rows.length : 0;
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const progressContext = options && typeof options.progressContext === 'object' && options.progressContext !== null
      ? { ...options.progressContext }
      : {};

    if (request.rows.length <= 0) {
      return {
        success: false,
        updatedAt: nowIso(),
        batchSize: request.batchSize,
        totalInputRowCount,
        submittedRowCount: 0,
        skippedRowCount: request.invalidRows.length,
        successRowCount: 0,
        failedRowCount: 0,
        totalShopCount: 0,
        completedShopCount: 0,
        failedShopCount: 0,
        totalGroupCount: 0,
        totalRequestCount: 0,
        completedRequestCount: 0,
        failedRequestCount: 0,
        rowResults: [],
        skippedRows: request.invalidRows,
        canceled: false,
        warning: request.invalidRows.length > 0
          ? '\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u6d3b\u52a8\u5546\u54c1'
          : '\u8bf7\u5148\u7b5b\u9009\u53ef\u62a5\u540d\u5546\u54c1'
      };
    }

    const submitJob = createActivityBatchSignupJob(request.requestId);

    try {
      const groupMap = new Map();

      request.rows.forEach((row) => {
        const groupKey = buildActivityBatchSignupGroupKey(row);

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            shopId: normalizeText(row.shopId),
            shopName: normalizeText(row.shopName),
            activityKey: normalizeText(row.activityKey),
            activityType: normalizeOptionalNumber(row.activityType),
            activityThematicId: normalizeText(row.activityThematicId),
            activityName: normalizeText(row.activityName),
            rows: []
          });
        }

        groupMap.get(groupKey).rows.push(row);
      });

      const shopBucketMap = new Map();

      Array.from(groupMap.values()).forEach((group) => {
        const shopId = normalizeText(group && group.shopId);
        const shopName = normalizeText(group && group.shopName) || shopId;

        if (!shopBucketMap.has(shopId)) {
          shopBucketMap.set(shopId, {
            shopId,
            shopName,
            groups: [],
            rowCount: 0
          });
        }

        const shopBucket = shopBucketMap.get(shopId);
        const chunkRows = chunkActivityBatchSignupRows(group.rows, request.batchSize);

        shopBucket.groups.push({
          ...group,
          rowChunks: chunkRows
        });
        shopBucket.rowCount += group.rows.length;
      });

      const shopBuckets = Array.from(shopBucketMap.values()).map((bucket, index) => ({
        ...bucket,
        shopIndex: index + 1
      }));
      const uniqueShopIds = shopBuckets.map((bucket) => normalizeText(bucket && bucket.shopId)).filter(Boolean);
      const { resolvedShops, unresolved } = await resolveSelectedShops(uniqueShopIds);
      const resolvedShopMap = new Map();
      const unresolvedShopMap = new Map();
      const rowResults = [];
      const skippedRows = Array.isArray(request.invalidRows) ? request.invalidRows.slice() : [];
      const processedRowKeySet = new Set();
      const sessionContextByShopId = new Map();

      skippedRows.forEach((row) => {
        const processedKey = normalizeText(row && row.submitScopeKey) || normalizeText(row && row.rowKey);

        if (processedKey) {
          processedRowKeySet.add(processedKey);
        }
      });

      resolvedShops.forEach((shop) => {
        const shopId = normalizeText(shop && shop.shopId);

        if (shopId) {
          resolvedShopMap.set(shopId, shop);
        }
      });

      unresolved.forEach((item) => {
        const shopId = normalizeText(item && item.shopId);

        if (shopId) {
          unresolvedShopMap.set(shopId, normalizeText(item && item.message) || '\u5e97\u94fa\u4e0d\u53ef\u7528');
        }
      });

      let successRowCount = 0;
      let failedRowCount = 0;
      let completedShopCount = 0;
      let failedShopCount = 0;
      let completedRequestCount = 0;
      let failedRequestCount = 0;
      let canceled = false;
      const totalRequestCount = shopBuckets.reduce((count, bucket) => (
        count + bucket.groups.reduce((groupCount, group) => groupCount + group.rowChunks.length, 0)
      ), 0);

      const rememberProcessedRow = (row) => {
        const processedKey = normalizeText(row && row.submitScopeKey) || normalizeText(row && row.rowKey);

        if (processedKey) {
          processedRowKeySet.add(processedKey);
        }
      };

      const pushRowResult = (row, overrides = {}) => {
        const result = buildActivityBatchSignupRowResult(row, overrides);
        rowResults.push(result);
        rememberProcessedRow(result);
      };

      const pushSkippedRows = (rows, message) => {
        const normalizedMessage = normalizeText(message) || '\u5df2\u505c\u6b62\uff0c\u672a\u7ee7\u7eed\u63d0\u4ea4';

        rows.forEach((row) => {
          const skippedRow = buildActivityBatchSignupSkippedRowResult(row, {
            message: normalizedMessage
          });
          skippedRows.push(skippedRow);
          rememberProcessedRow(skippedRow);
        });
      };

      progressContext.requestId = normalizeText(progressContext.requestId || submitJob.requestId);
      progressContext.totalInputRowCount = totalInputRowCount;
      progressContext.submittedRowCount = request.rows.length;
      progressContext.skippedRowCount = skippedRows.length;
      progressContext.totalShopCount = shopBuckets.length;
      progressContext.completedShopCount = 0;
      progressContext.failedShopCount = 0;
      progressContext.totalGroupCount = groupMap.size;
      progressContext.totalRequestCount = totalRequestCount;
      progressContext.completedRequestCount = 0;
      progressContext.failedRequestCount = 0;
      progressContext.successRowCount = 0;
      progressContext.failedRowCount = 0;

      emitActivityBatchSignupProgress(progressEmitter, progressContext, {
        phase: 'signup-start',
        totalInputRowCount,
        submittedRowCount: request.rows.length,
        skippedRowCount: skippedRows.length,
        totalShopCount: shopBuckets.length,
        totalGroupCount: groupMap.size,
        totalRequestCount,
        completedRequestCount: 0,
        failedRequestCount: 0,
        successRowCount: 0,
        failedRowCount: 0
      });

      const pushFailedRows = (rows, message) => {
        const normalizedMessage = normalizeText(message) || '\u6d3b\u52a8\u62a5\u540d\u63d0\u4ea4\u5931\u8d25';

        rows.forEach((row) => {
          failedRowCount += 1;
          pushRowResult(row, {
            success: false,
            message: normalizedMessage
          });
        });
      };

      const processShopBucket = async (shopBucket) => {
        assertActivityBatchSignupJobActive(submitJob);

        const shopId = normalizeText(shopBucket && shopBucket.shopId);
        const shopName = normalizeText(shopBucket && shopBucket.shopName) || shopId;
        const groups = Array.isArray(shopBucket && shopBucket.groups) ? shopBucket.groups : [];
        const currentShopIndex = normalizeNonNegativeInteger(shopBucket && shopBucket.shopIndex, 0);
        let shopFailed = false;
        const markShopRequestSlotsFailed = () => {
          const skippedRequestCount = groups.reduce((count, group) => (
            count + (Array.isArray(group && group.rowChunks) ? group.rowChunks.length : 0)
          ), 0);

          completedRequestCount += skippedRequestCount;
          failedRequestCount += skippedRequestCount;
          progressContext.completedRequestCount = completedRequestCount;
          progressContext.failedRequestCount = failedRequestCount;
        };

        emitActivityBatchSignupProgress(progressEmitter, progressContext, {
          phase: 'signup-shop-start',
          currentShopIndex,
          currentShopName: shopName,
          completedShopCount,
          failedShopCount,
          currentGroupIndex: 0,
          currentGroupCount: groups.length,
          currentChunkIndex: 0,
          currentChunkCount: 0,
          currentChunkRowCount: 0,
          successRowCount,
          failedRowCount,
          completedRequestCount,
          failedRequestCount,
          skippedRowCount: skippedRows.length
        });

        const unresolvedMessage = unresolvedShopMap.get(shopId);

        if (unresolvedMessage) {
          shopFailed = true;
          markShopRequestSlotsFailed();
          groups.forEach((group) => {
            pushFailedRows(group.rows, unresolvedMessage);
          });
        } else {
          const shop = resolvedShopMap.get(shopId);

          if (!shop) {
            shopFailed = true;
            markShopRequestSlotsFailed();
            groups.forEach((group) => {
              pushFailedRows(group.rows, '\u5f53\u524d\u5e97\u94fa\u4e0d\u5b58\u5728');
            });
          } else {
            let sessionContext = sessionContextByShopId.get(shopId) || null;

            try {
              if (!sessionContext) {
                sessionContext = await resolveShopSessionContext(shop);
                sessionContext = await warmupSellerSessionContext(sessionContext, {
                  timeoutMs: 60000
                });
                sessionContext = applyKnownMallIdToSessionContext(sessionContext, shop);
                sessionContextByShopId.set(shopId, sessionContext);
              }
            } catch (error) {
              const message = normalizeText(error && error.message) || '\u5e97\u94fa\u767b\u5f55\u4f1a\u8bdd\u5931\u6548';

              shopFailed = true;
              markShopRequestSlotsFailed();
              logError('operations_activity_management_batch_signup_session_failed', error, {
                shopId,
                shopName
              });
              groups.forEach((group) => {
                pushFailedRows(group.rows, message);
              });
            }

            if (sessionContext) {
              for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
                assertActivityBatchSignupJobActive(submitJob);

                const group = groups[groupIndex];
                const rowChunks = Array.isArray(group && group.rowChunks) ? group.rowChunks : [];

                for (let chunkIndex = 0; chunkIndex < rowChunks.length; chunkIndex += 1) {
                  assertActivityBatchSignupJobActive(submitJob);

                  const chunkRows = rowChunks[chunkIndex];
                  const requestPayload = buildActivityBatchSignupRequestPayload(group, chunkRows);

                  emitActivityBatchSignupProgress(progressEmitter, progressContext, {
                    phase: 'signup-chunk-submit',
                    currentShopIndex,
                    currentShopName: shopName,
                    completedShopCount,
                    failedShopCount,
                    currentGroupIndex: groupIndex + 1,
                    currentGroupCount: groups.length,
                    currentActivityName: normalizeText(group && group.activityName),
                    currentActivityKey: normalizeText(group && group.activityKey),
                    currentChunkIndex: chunkIndex + 1,
                    currentChunkCount: rowChunks.length,
                    currentChunkRowCount: chunkRows.length,
                    successRowCount,
                    failedRowCount,
                    completedRequestCount,
                    failedRequestCount,
                    skippedRowCount: skippedRows.length
                  });

                  log('operations_activity_management_batch_signup_request', {
                    shopId,
                    shopName,
                    activityKey: normalizeText(group.activityKey),
                    activityType: normalizeOptionalNumber(group.activityType),
                    activityThematicId: normalizeText(group.activityThematicId),
                    chunkIndex: chunkIndex + 1,
                    chunkCount: rowChunks.length,
                    productCount: chunkRows.length
                  });

                  let chunkPhase = 'signup-chunk-done';
                  let chunkMessage = '';
                  let canceledError = null;
                  const requestController = typeof AbortController === 'function'
                    ? new AbortController()
                    : null;

                  registerActivityBatchSignupJobController(submitJob, requestController);

                  try {
                    const responsePayload = await executeJsonRequest(
                      sessionContext,
                      ACTIVITY_MATCH_PRODUCTS_SUBMIT_ENDPOINT_PATH,
                      requestPayload,
                      {
                        refererPath: '/',
                        timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
                        signal: requestController ? requestController.signal : null,
                        abortErrorFactory: createActivityBatchSignupCanceledError
                      }
                    );
                    const resultPayload = resolveActivityBatchSignupResultPayload(responsePayload);
                    const siteResultMaps = buildActivityBatchSignupSiteResultMaps(
                      resultPayload && resultPayload.product2SiteEnrollResultMap
                    );
                    const enrollIdMap = buildActivityBatchSignupEnrollIdMap(resultPayload && resultPayload.productId2EnrollIdMap);
                    const failMessageMap = buildActivityBatchSignupFailMessageMap(resultPayload && resultPayload.failList);

                    siteResultMaps.enrollIdMap.forEach((enrollId, productId) => {
                      if (productId && enrollId && !enrollIdMap.has(productId)) {
                        enrollIdMap.set(productId, enrollId);
                      }
                    });
                    siteResultMaps.failMessageMap.forEach((message, productId) => {
                      if (productId && message) {
                        failMessageMap.set(productId, message);
                      }
                    });

                    const fallbackAllSuccess = normalizeNonNegativeInteger(resultPayload && resultPayload.failCount, 0) <= 0
                      && normalizeNonNegativeInteger(resultPayload && resultPayload.successCount, 0) >= chunkRows.length;

                    chunkRows.forEach((row) => {
                      const productId = normalizeText(row && row.productId);
                      const enrollId = enrollIdMap.get(productId);
                      const failMessage = failMessageMap.get(productId);

                      if (enrollId || (fallbackAllSuccess && !failMessage)) {
                        successRowCount += 1;
                        pushRowResult(row, {
                          success: true,
                          enrollId,
                          message: enrollId ? `\u62a5\u540dID ${enrollId}` : '\u62a5\u540d\u6210\u529f'
                        });
                        return;
                      }

                      shopFailed = true;
                      failedRowCount += 1;
                      pushRowResult(row, {
                        success: false,
                        message: failMessage || '\u672a\u83b7\u53d6\u5230\u62a5\u540d\u6210\u529f\u56de\u6267'
                      });
                    });
                  } catch (error) {
                    if (isActivityBatchSignupCanceledError(error) || submitJob.canceled === true) {
                      canceled = true;
                      chunkPhase = 'signup-canceled';
                      chunkMessage = '\u6d3b\u52a8\u6279\u91cf\u62a5\u540d\u5df2\u505c\u6b62';
                      canceledError = createActivityBatchSignupCanceledError();
                    } else {
                      const message = normalizeText(error && error.message) || '\u6d3b\u52a8\u62a5\u540d\u63d0\u4ea4\u5931\u8d25';
                      const errorResultPayload = resolveActivityBatchSignupResultPayload(error && error.responsePayload);
                      const errorSiteResultMaps = buildActivityBatchSignupSiteResultMaps(
                        errorResultPayload && errorResultPayload.product2SiteEnrollResultMap
                      );
                      const errorEnrollIdMap = buildActivityBatchSignupEnrollIdMap(
                        errorResultPayload && errorResultPayload.productId2EnrollIdMap
                      );
                      const errorFailMessageMap = buildActivityBatchSignupFailMessageMap(
                        errorResultPayload && errorResultPayload.failList
                      );

                      shopFailed = true;
                      chunkPhase = 'signup-chunk-failed';
                      chunkMessage = message;
                      failedRequestCount += 1;
                      logError('operations_activity_management_batch_signup_request_failed', error, {
                        shopId,
                        shopName,
                        activityKey: normalizeText(group.activityKey),
                        activityType: normalizeOptionalNumber(group.activityType),
                        activityThematicId: normalizeText(group.activityThematicId),
                        chunkIndex: chunkIndex + 1,
                        chunkCount: rowChunks.length,
                        productCount: chunkRows.length
                      });

                      errorSiteResultMaps.enrollIdMap.forEach((enrollId, productId) => {
                        if (productId && enrollId && !errorEnrollIdMap.has(productId)) {
                          errorEnrollIdMap.set(productId, enrollId);
                        }
                      });
                      errorSiteResultMaps.failMessageMap.forEach((detailMessage, productId) => {
                        if (productId && detailMessage) {
                          errorFailMessageMap.set(productId, detailMessage);
                        }
                      });

                      if (errorEnrollIdMap.size > 0 || errorFailMessageMap.size > 0) {
                        chunkRows.forEach((row) => {
                          const productId = normalizeText(row && row.productId);
                          const enrollId = errorEnrollIdMap.get(productId);
                          const failMessage = errorFailMessageMap.get(productId);

                          if (enrollId) {
                            successRowCount += 1;
                            pushRowResult(row, {
                              success: true,
                              enrollId,
                              message: `\u62a5\u540dID ${enrollId}`
                            });
                            return;
                          }

                          failedRowCount += 1;
                          pushRowResult(row, {
                            success: false,
                            message: failMessage || message
                          });
                        });
                      } else {
                        pushFailedRows(chunkRows, message);
                      }
                    }
                  } finally {
                    unregisterActivityBatchSignupJobController(submitJob, requestController);
                    completedRequestCount += 1;
                    progressContext.completedRequestCount = completedRequestCount;
                    progressContext.failedRequestCount = failedRequestCount;
                    progressContext.successRowCount = successRowCount;
                    progressContext.failedRowCount = failedRowCount;
                    progressContext.skippedRowCount = skippedRows.length;
                  }

                  emitActivityBatchSignupProgress(progressEmitter, progressContext, {
                    phase: chunkPhase,
                    currentShopIndex,
                    currentShopName: shopName,
                    completedShopCount,
                    failedShopCount,
                    currentGroupIndex: groupIndex + 1,
                    currentGroupCount: groups.length,
                    currentActivityName: normalizeText(group && group.activityName),
                    currentActivityKey: normalizeText(group && group.activityKey),
                    currentChunkIndex: chunkIndex + 1,
                    currentChunkCount: rowChunks.length,
                    currentChunkRowCount: chunkRows.length,
                    successRowCount,
                    failedRowCount,
                    completedRequestCount,
                    failedRequestCount,
                    skippedRowCount: skippedRows.length,
                    message: chunkMessage
                  });

                  if (canceledError) {
                    throw canceledError;
                  }
                }
              }
            }
          }
        }

        completedShopCount += 1;
        if (shopFailed) {
          failedShopCount += 1;
        }
        progressContext.completedShopCount = completedShopCount;
        progressContext.failedShopCount = failedShopCount;
        progressContext.successRowCount = successRowCount;
        progressContext.failedRowCount = failedRowCount;
        progressContext.skippedRowCount = skippedRows.length;

        emitActivityBatchSignupProgress(progressEmitter, progressContext, {
          phase: shopFailed ? 'signup-shop-failed' : 'signup-shop-done',
          currentShopIndex,
          currentShopName: shopName,
          completedShopCount,
          failedShopCount,
          currentGroupIndex: groups.length,
          currentGroupCount: groups.length,
          currentChunkIndex: 0,
          currentChunkCount: 0,
          currentChunkRowCount: 0,
          successRowCount,
          failedRowCount,
          completedRequestCount,
          failedRequestCount,
          skippedRowCount: skippedRows.length
        });
      };

      const settledResults = await Promise.allSettled(
        shopBuckets.map((shopBucket) => processShopBucket(shopBucket))
      );
      const unexpectedRejected = settledResults.find((result) => (
        result.status === 'rejected'
        && !isActivityBatchSignupCanceledError(result.reason)
      ));

      if (unexpectedRejected && unexpectedRejected.status === 'rejected') {
        throw unexpectedRejected.reason;
      }

      canceled = canceled || settledResults.some((result) => (
        result.status === 'rejected'
        && isActivityBatchSignupCanceledError(result.reason)
      ));

      if (canceled) {
        const remainingRows = [];

        request.rows.forEach((row) => {
          const processedKey = normalizeText(row && row.submitScopeKey) || normalizeText(row && row.rowKey);

          if (processedKey && processedRowKeySet.has(processedKey)) {
            return;
          }

          remainingRows.push(row);
        });

        pushSkippedRows(remainingRows, '\u5df2\u505c\u6b62\uff0c\u672a\u7ee7\u7eed\u63d0\u4ea4');
      }

      const submittedRowCount = successRowCount + failedRowCount;
      const skippedRowCount = skippedRows.length;

      emitActivityBatchSignupProgress(progressEmitter, progressContext, {
        phase: canceled ? 'signup-canceled' : 'signup-done',
        completedShopCount,
        failedShopCount,
        successRowCount,
        failedRowCount,
        completedRequestCount,
        failedRequestCount,
        skippedRowCount,
        currentShopIndex: 0,
        currentShopName: '',
        currentGroupIndex: 0,
        currentGroupCount: 0,
        currentActivityName: '',
        currentActivityKey: '',
        currentChunkIndex: 0,
        currentChunkCount: 0,
        currentChunkRowCount: 0
      });

      const warning = canceled
        ? `\u4efb\u52a1\u5df2\u505c\u6b62\uff0c\u6210\u529f ${successRowCount} \u4e2a\u5546\u54c1\uff0c\u5931\u8d25 ${failedRowCount} \u4e2a\uff0c\u672a\u63d0\u4ea4 ${skippedRowCount} \u4e2a`
        : failedRowCount > 0
          ? `\u5df2\u62a5\u540d ${successRowCount} \u4e2a\u5546\u54c1\uff0c${failedRowCount} \u4e2a\u5931\u8d25`
          : (skippedRowCount > 0
            ? `\u5df2\u8df3\u8fc7 ${skippedRowCount} \u4e2a\u4e0d\u53ef\u63d0\u4ea4\u5546\u54c1`
            : '');

      return {
        success: canceled !== true && failedRowCount <= 0 && successRowCount > 0,
        updatedAt: nowIso(),
        batchSize: request.batchSize,
        totalInputRowCount,
        submittedRowCount,
        skippedRowCount,
        successRowCount,
        failedRowCount,
        totalShopCount: shopBuckets.length,
        completedShopCount,
        failedShopCount,
        totalGroupCount: groupMap.size,
        totalRequestCount,
        completedRequestCount,
        failedRequestCount,
        rowResults,
        skippedRows,
        canceled,
        warning
      };
    } finally {
      clearActivityBatchSignupJob(submitJob);
    }
  }

  async function queryActivityListByShops(payload = {}) {
    const requestedShopIds = normalizeSelectedShopIds(payload && payload.shopIds);

    if (requestedShopIds.length <= 0) {
      return {
        success: false,
        updatedAt: nowIso(),
        totalShopCount: 0,
        successShopCount: 0,
        failedShopCount: 0,
        rawActivityCount: 0,
        uniqueActivityCount: 0,
        rows: [],
        shopResults: [],
        themeTypeMapping: [],
        warning: '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa'
      };
    }

    const { resolvedShops, unresolved } = await resolveSelectedShops(requestedShopIds);
    const aggregatedMap = new Map();
    const themeTypeMap = new Map();
    const shopResults = [];
    let rawActivityCount = 0;

    unresolved.forEach((entry) => {
      shopResults.push({
        shopId: normalizeText(entry && entry.shopId),
        shopName: normalizeText(entry && entry.shopName),
        success: false,
        activityCount: 0,
        message: normalizeText(entry && entry.message)
      });
    });

    const resolvedShopResults = await mapWithConcurrency(
      resolvedShops,
      DEFAULT_ACTIVITY_LIST_QUERY_CONCURRENCY,
      async (shop) => {
      const shopId = normalizeText(shop && shop.shopId);
      const shopName = normalizeText(shop && shop.shopName) || shopId;

      try {
        let sessionContext = await resolveShopSessionContext(shop);
        sessionContext = await warmupSellerSessionContext(sessionContext, {
          timeoutMs: 60000
        });
        sessionContext = applyKnownMallIdToSessionContext(sessionContext, shop);
        const mallId = await ensureMallId(sessionContext);

        const responsePayload = await executeJsonRequest(
          sessionContext,
          ACTIVITY_LIST_ENDPOINT_PATH,
          DEFAULT_QUERY_PAYLOAD,
          {
            refererPath: '/',
            mallIdOverride: mallId,
            timeoutMs: QUERY_REQUEST_TIMEOUT_MS
          }
        );
        const resultPayload = responsePayload && typeof responsePayload === 'object'
          ? responsePayload.result
          : null;
        const responseThemeTypeMap = buildThemeTypeMap(resultPayload && resultPayload.themeTypeMapping);

        const activityRows = flattenActivityRows(
          resultPayload && resultPayload.activityList,
          {
            shopId,
            shopName
          },
          responseThemeTypeMap
        );

        return {
          shopId,
          shopName,
          success: true,
          activityRows,
          themeTypeEntries: Array.from(responseThemeTypeMap.entries()),
          shopResult: {
            shopId,
            shopName,
            success: true,
            activityCount: activityRows.length,
            message: ''
          }
        };
      } catch (error) {
        const message = normalizeText(error && error.message) || '\u6d3b\u52a8\u67e5\u8be2\u5931\u8d25';

        logError('operations_activity_management_shop_query_failed', error, {
          shopId,
          shopName
        });

        return {
          shopId,
          shopName,
          success: false,
          activityRows: [],
          themeTypeEntries: [],
          shopResult: {
            shopId,
            shopName,
            success: false,
            activityCount: 0,
            message
          }
        };
      }
      }
    );

    resolvedShopResults.forEach((entry) => {
      if (!entry) {
        return;
      }

      (Array.isArray(entry.themeTypeEntries) ? entry.themeTypeEntries : []).forEach(([key, value]) => {
        if (!themeTypeMap.has(key)) {
          themeTypeMap.set(key, value);
        }
      });

      const activityRows = Array.isArray(entry.activityRows) ? entry.activityRows : [];

      rawActivityCount += activityRows.length;
      activityRows.forEach((row) => {
        const rowKey = normalizeText(row && row.activityKey);

        if (!rowKey) {
          return;
        }

        if (aggregatedMap.has(rowKey)) {
          aggregatedMap.set(rowKey, mergeActivityRows(aggregatedMap.get(rowKey), row));
        } else {
          aggregatedMap.set(rowKey, row);
        }
      });

      if (entry.shopResult) {
        shopResults.push(entry.shopResult);
      }
    });

    const rows = sortActivityRows(Array.from(aggregatedMap.values())).map((row) => {
      const normalizedThemeType = normalizeOptionalNumber(row && row.activityThemeType);
      const themeTypeLabel = normalizeText(
        row && row.activityThemeTypeLabel
      ) || normalizeText(themeTypeMap.get(normalizeText(normalizedThemeType)));

      return {
        ...row,
        activityThemeType: normalizedThemeType,
        activityThemeTypeLabel: themeTypeLabel
      };
    });
    const successShopCount = shopResults.filter((entry) => entry && entry.success === true).length;
    const failedShopCount = shopResults.length - successShopCount;
    const summary = {
      totalShopCount: requestedShopIds.length,
      successShopCount,
      failedShopCount,
      rawActivityCount,
      uniqueActivityCount: rows.length
    };
    const warningMessage = buildWarningMessage(summary, shopResults);
    const response = {
      success: successShopCount > 0,
      updatedAt: nowIso(),
      ...summary,
      rows,
      shopResults,
      themeTypeMapping: Array.from(themeTypeMap.entries()).map(([key, value]) => ({
        key: normalizeOptionalNumber(key) !== null ? normalizeOptionalNumber(key) : key,
        value
      })),
      warning: warningMessage
    };

    log('operations_activity_management_query_completed', {
      totalShopCount: response.totalShopCount,
      successShopCount: response.successShopCount,
      failedShopCount: response.failedShopCount,
      rawActivityCount: response.rawActivityCount,
      uniqueActivityCount: response.uniqueActivityCount
    });

    return response;
  }

  async function getFilterSettings() {
    try {
      const configResult = await store.readUserConfig('filterSettings');
      const newerPayload = pickNewerPayload(
        configResult && configResult.localConfig,
        configResult && configResult.cloudConfig
      );
      const savedSettings = newerPayload && newerPayload.payload && typeof newerPayload.payload === 'object'
        ? newerPayload.payload
        : DEFAULT_FILTER_SETTINGS;

      return {
        settings: normalizeFilterSettingsPayload({
          ...DEFAULT_FILTER_SETTINGS,
          ...savedSettings
        }),
        source: newerPayload && newerPayload.source ? newerPayload.source : 'default',
        warning: ''
      };
    } catch (error) {
      logError('operations_activity_management_get_filter_settings_failed', error, {});

      return {
        settings: normalizeFilterSettingsPayload(DEFAULT_FILTER_SETTINGS),
        source: 'default',
        warning: normalizeText(error && error.message) || '\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25'
      };
    }
  }

  async function saveFilterSettings(payload = {}) {
    const nextSettings = normalizeFilterSettingsPayload({
      ...DEFAULT_FILTER_SETTINGS,
      ...(payload && typeof payload === 'object' ? payload : {})
    });
    const writeResult = await store.writeUserConfig('filterSettings', nextSettings);

    return {
      settings: nextSettings,
      source: writeResult && writeResult.localSaved === true ? 'local' : 'default',
      localSaved: Boolean(writeResult && writeResult.localSaved),
      cloudSynced: Boolean(writeResult && writeResult.cloudSynced),
      warning: normalizeText(writeResult && writeResult.warning)
    };
  }

  async function cancelActivityMatchProductsBatchQuery(payload = {}) {
    const job = getActivityMatchBatchQueryJob({
      requestId: payload && payload.requestId
    });

    if (!job) {
      return {
        canceled: false,
        requestId: normalizeText(payload && payload.requestId),
        cacheKey: ''
      };
    }

    return {
      canceled: cancelActivityMatchBatchQueryJob(job),
      requestId: normalizeText(job.requestId),
      cacheKey: normalizeText(job.cacheKey)
    };
  }

  async function cancelActivityMatchProductsBatchSubmit(payload = {}) {
    const job = getActivityBatchSignupJob({
      requestId: payload && payload.requestId
    });

    if (!job) {
      return {
        canceled: false,
        requestId: normalizeText(payload && payload.requestId)
      };
    }

    return {
      canceled: cancelActivityBatchSignupJob(job),
      requestId: normalizeText(job.requestId)
    };
  }

  async function getProductFilterSettings() {
    try {
      const [modeResult, modeValuesResult, profitFloorResult] = await Promise.all([
        store.readUserConfig('productFilterMode'),
        store.readUserConfig('productFilterModeValues'),
        store.readUserConfig('productFilterProfitFloorRate')
      ]);
      const modePayload = pickNewerPayload(
        modeResult && modeResult.localConfig,
        modeResult && modeResult.cloudConfig
      ).payload;
      const modeValuesPayload = pickNewerPayload(
        modeValuesResult && modeValuesResult.localConfig,
        modeValuesResult && modeValuesResult.cloudConfig
      ).payload;
      const profitFloorPayload = pickNewerPayload(
        profitFloorResult && profitFloorResult.localConfig,
        profitFloorResult && profitFloorResult.cloudConfig
      ).payload;

      return {
        settings: normalizeActivityProductFilterSettingsPayload({
          ...DEFAULT_PRODUCT_FILTER_SETTINGS,
          ...modePayload,
          ...modeValuesPayload,
          ...profitFloorPayload
        }),
        source: 'mixed',
        warning: ''
      };
    } catch (error) {
      logError('operations_activity_management_get_product_filter_settings_failed', error, {});

      return {
        settings: normalizeActivityProductFilterSettingsPayload(DEFAULT_PRODUCT_FILTER_SETTINGS),
        source: 'default',
        warning: normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25'
      };
    }
  }

  async function saveProductFilterSettings(payload = {}) {
    const nextSettings = normalizeActivityProductFilterSettingsPayload({
      ...DEFAULT_PRODUCT_FILTER_SETTINGS,
      ...(payload && typeof payload === 'object' ? payload : {})
    });
    const updatedAt = normalizeText(nextSettings.updatedAt) || nowIso();
    const modePayload = {
      version: PRODUCT_FILTER_SETTINGS_VERSION,
      updatedAt,
      mode: nextSettings.mode
    };
    const modeValuesPayload = {
      version: PRODUCT_FILTER_SETTINGS_VERSION,
      updatedAt,
      modeValueDailyDiscount: nextSettings.modeValueDailyDiscount,
      modeValueSaleProfitRate: nextSettings.modeValueSaleProfitRate,
      modeValueProfitRateDiscount: nextSettings.modeValueProfitRateDiscount,
      modeValueDailyReduce: nextSettings.modeValueDailyReduce,
      modeValueCostMarkup: nextSettings.modeValueCostMarkup,
      clampToSuggestPrice: nextSettings.clampToSuggestPrice === true
    };
    const profitFloorPayload = {
      version: PRODUCT_FILTER_SETTINGS_VERSION,
      updatedAt,
      profitFloorRate: nextSettings.profitFloorRate,
      profitFloorRelation: nextSettings.profitFloorRelation,
      profitFloorValue: nextSettings.profitFloorValue,
      submitAtProfitFloor: nextSettings.submitAtProfitFloor === true,
      submitAtProfitFloorBasis: normalizeActivityProductSubmitFloorBasis(nextSettings.submitAtProfitFloorBasis)
    };
    const writeResults = await Promise.all([
      store.writeUserConfig('productFilterMode', modePayload, { setting_field: 'mode' }),
      store.writeUserConfig('productFilterModeValues', modeValuesPayload, { setting_field: 'modeValues' }),
      store.writeUserConfig('productFilterProfitFloorRate', profitFloorPayload, { setting_field: 'profitFloorRate' })
    ]);
    const warnings = writeResults
      .map((result) => normalizeText(result && result.warning))
      .filter(Boolean);

    return {
      settings: nextSettings,
      source: 'local',
      localSaved: writeResults.every((result) => result && result.localSaved === true),
      cloudSynced: writeResults.every((result) => result && result.cloudSynced === true),
      warning: warnings.join('\n')
    };
  }

  return {
    async queryActivityListByShops(payload = {}) {
      try {
        return await queryActivityListByShops(payload);
      } catch (error) {
        logError('operations_activity_management_query_failed', error, {
          shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0
        });
        throw error;
      }
    },
    async queryActivityMatchProducts(payload = {}) {
      try {
        return await queryActivityMatchProducts(payload);
      } catch (error) {
        logError('operations_activity_management_match_products_failed', error, {
          shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
          activityKey: normalizeText(payload && payload.activityKey),
          activityType: normalizeText(payload && payload.activityType)
        });
        throw error;
      }
    },
    async getActivityMatchProductsPage(payload = {}) {
      try {
        return await getActivityMatchProductsPage(payload);
      } catch (error) {
        logError('operations_activity_management_match_products_page_failed', error, {
          cacheKey: normalizeText(payload && payload.cacheKey),
          activityKey: normalizeText(payload && payload.activityKey)
        });
        throw error;
      }
    },
    async queryActivityMatchProductsBatch(payload = {}, options = {}) {
      try {
        return await queryActivityMatchProductsBatch(payload, options);
      } catch (error) {
        logError('operations_activity_management_match_products_batch_failed', error, {
          shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
          activityCount: Array.isArray(payload && payload.activities) ? payload.activities.length : 0
        });
        throw error;
      }
    },
    async cancelActivityMatchProductsBatchQuery(payload = {}) {
      return cancelActivityMatchProductsBatchQuery(payload);
    },
    async cancelActivityMatchProductsBatchSubmit(payload = {}) {
      return cancelActivityMatchProductsBatchSubmit(payload);
    },
    async getActivityMatchProductsBatchPage(payload = {}) {
      try {
        return await getActivityMatchProductsBatchPage(payload);
      } catch (error) {
        logError('operations_activity_management_match_products_batch_page_failed', error, {
          cacheKey: normalizeText(payload && payload.cacheKey)
        });
        throw error;
      }
    },
    async submitActivityMatchProductsBatch(payload = {}, options = {}) {
      try {
        return await submitActivityMatchProductsBatch(payload, options);
      } catch (error) {
        logError('operations_activity_management_batch_signup_submit_failed', error, {
          rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
          batchSize: normalizeNonNegativeInteger(payload && payload.batchSize, DEFAULT_ACTIVITY_BATCH_SIGNUP_SUBMIT_SIZE)
        });
        throw error;
      }
    },
    async getFilterSettings() {
      return getFilterSettings();
    },
    async saveFilterSettings(payload = {}) {
      return saveFilterSettings(payload);
    },
    async getProductFilterSettings() {
      return getProductFilterSettings();
    },
    async saveProductFilterSettings(payload = {}) {
      return saveProductFilterSettings(payload);
    }
  };
}

module.exports = {
  createOperationsActivityManagementService
};

