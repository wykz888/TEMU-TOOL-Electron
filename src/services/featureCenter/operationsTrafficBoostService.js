const crypto = require('node:crypto');
const { net } = require('electron');
const {
  buildOwnerDescriptor,
  normalizeText,
  isShopParticipating
} = require('../shopManagement/common');
const {
  buildCostLookupCandidates,
  buildCostPrimaryKey
} = require('./operationsCostIdentity');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');
const {
  createOperationsTrafficBoostStore
} = require('./operationsTrafficBoostStore');
const {
  buildSellerRegionContextRequestScript
} = require('../../windows/shopWindowSellerRegionSwitch');
const {
  buildTrafficBoostSubmitProductKey,
  normalizeFlowPriceSubmitProductForRequest,
  normalizeFlowPriceSubmitSkuForBatchPayload,
  normalizeFlowPriceSubmitSkuForRequest,
  normalizeTrafficBoostSubmitBatchSize,
  normalizeTrafficBoostSubmitDays,
  normalizeTrafficBoostSubmitLevel,
  normalizeTrafficBoostSubmitProductItem
} = require('./operationsTrafficBoostSubmitPricing');
const {
  buildCompactWarningText,
  buildFlowPriceInfoKey,
  buildFlowPriceInfoMap,
  normalizeScalarValue
} = require('./operationsTrafficBoostFlowPriceInfo');
const {
  AUTH_REQUIRED_MESSAGE_PATTERN,
  isHotSubmitRateLimitErrorMessage,
  isRateLimitErrorMessage,
  shouldSplitFlowPriceSubmitErrorMessage
} = require('./operationsTrafficBoostSubmitErrors');

const QUERY_CANCELED_ERROR_CODE = 'OPERATIONS_TRAFFIC_BOOST_QUERY_CANCELED';
const DEFAULT_PAGE_SIZE = 100;
// Traffic-boost query needs a hidden seller-center warmup plus region-cookie refresh.
// Running multiple shops in parallel is prone to auth/session cross-talk, so keep it serial.
const MAX_CONCURRENT_SHOP_QUERIES = 1;
const QUERY_REQUEST_TIMEOUT_MS = 45000;
const REGION_COOKIE_READY_TIMEOUT_MS = 12000;
const REGION_COOKIE_READY_POLL_MS = 350;
const REGION_COOKIE_VERIFY_TIMEOUT_MS = 6000;
const FLOW_PRICE_INFO_BATCH_SIZE = 30;
const RESPONSE_TEXT_PREVIEW_LIMIT = 240;
const RATE_LIMIT_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_RETRY_BASE_DELAY_MS = 1600;
const HOT_SUBMIT_RATE_LIMIT_RETRY_MIN_MS = 8000;
const HOT_SUBMIT_RATE_LIMIT_RETRY_MAX_MS = 14000;
const PARTIAL_SUBMIT_RESULT_RETRY_DELAY_MS = 900;
const SINGLE_SHOP_PAGE_DELAY_MIN_MS = 3000;
const SINGLE_SHOP_PAGE_DELAY_MAX_MS = 5000;
const SUBMIT_BATCH_DELAY_MIN_MS = 2500;
const SUBMIT_BATCH_DELAY_MAX_MS = 3500;
const SUBMIT_SHOP_DELAY_MIN_MS = 2500;
const SUBMIT_SHOP_DELAY_MAX_MS = 3500;
const DEFAULT_MARKET_REGION = 'us';
const DEFAULT_PRODUCT_ID_TYPE = 'spu';
const DEFAULT_TRAFFIC_PRODUCT_METRIC_TYPE = 'exposure';
const DEFAULT_TRAFFIC_PAYMENT_METRIC_TYPE = 'paidPieces';
const DEFAULT_TRAFFIC_CONVERSION_METRIC_TYPE = 'exposureOrderRate';
const CUSTOM_LEVEL_FILTER_SETTINGS_VERSION = 1;
const DEFAULT_CUSTOM_LEVEL_FILTER_SETTINGS = Object.freeze({
  version: CUSTOM_LEVEL_FILTER_SETTINGS_VERSION,
  updatedAt: '',
  mode: 'dailyDiscount',
  modeValueByMode: Object.freeze({
    dailyDiscount: '',
    saleProfitRate: '',
    profitRateDiscount: '',
    dailyReduce: '',
    costMarkup: ''
  }),
  modeValueDailyDiscount: '',
  modeValueSaleProfitRate: '',
  modeValueProfitRateDiscount: '',
  modeValueDailyReduce: '',
  modeValueCostMarkup: '',
  modeValue: '',
  clampToSuggestPrice: false,
  profitFloorRate: '',
  profitFloorRelation: 'and',
  profitFloorValue: '',
  submitAtProfitFloor: false,
  submitAtProfitFloorBasis: 'profitFloorRate'
});
const MAX_MULTI_KEYWORDS = 40;
const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const SELLER_AUTH_USER_INFO_PATH = '/api/seller/auth/userInfo';
const SELLER_AUTH_OBTAIN_CODE_PATH = '/bg/swift/api/auth/obtainCode';
const SELLER_AUTH_LOGIN_BY_CODE_PATH = '/api/seller/auth/loginByCode';
const TRAFFIC_BOOST_REGION_REDIRECT_PATH = '/main/flux-analysis';
const MARKET_ORIGIN_BY_REGION = Object.freeze({
  global: 'https://agentseller.temu.com',
  us: 'https://agentseller-us.temu.com',
  eu: 'https://agentseller-eu.temu.com'
});
const MARKET_DR_BY_REGION = Object.freeze({
  global: 1,
  eu: 2,
  us: 3
});
const QUERY_URL_BY_REGION = Object.freeze({
  global: `${MARKET_ORIGIN_BY_REGION.global}/api/flow/analysis/list`,
  us: `${MARKET_ORIGIN_BY_REGION.us}/api/flow/analysis/list`,
  eu: `${MARKET_ORIGIN_BY_REGION.eu}/api/flow/analysis/list`
});
const FLOW_PRICE_INFO_URL_BY_REGION = Object.freeze({
  global: `${MARKET_ORIGIN_BY_REGION.global}/api/kiana/marvel-mms/cyborg/increase/flow/batchQueryIncreaseFlowPriceInfo`,
  us: `${MARKET_ORIGIN_BY_REGION.us}/api/kiana/marvel-mms/cyborg/increase/flow/batchQueryIncreaseFlowPriceInfo`,
  eu: `${MARKET_ORIGIN_BY_REGION.eu}/api/kiana/marvel-mms/cyborg/increase/flow/batchQueryIncreaseFlowPriceInfo`
});
const FLOW_PRICE_SUBMIT_URL_BY_REGION = Object.freeze({
  global: `${MARKET_ORIGIN_BY_REGION.global}/api/kiana/marvel-mms/cyborg/increase/flow/batchSubmitIncreaseFlowPriceInfo`,
  us: `${MARKET_ORIGIN_BY_REGION.us}/api/kiana/marvel-mms/cyborg/increase/flow/batchSubmitIncreaseFlowPriceInfo`,
  eu: `${MARKET_ORIGIN_BY_REGION.eu}/api/kiana/marvel-mms/cyborg/increase/flow/batchSubmitIncreaseFlowPriceInfo`
});
const FLOW_PRICE_SINGLE_SUBMIT_URL_BY_REGION = Object.freeze({
  global: `${MARKET_ORIGIN_BY_REGION.global}/api/kiana/marvel-mms/cyborg/increase/flow/submitIncreaseFlowPriceInfo`,
  us: `${MARKET_ORIGIN_BY_REGION.us}/api/kiana/marvel-mms/cyborg/increase/flow/submitIncreaseFlowPriceInfo`,
  eu: `${MARKET_ORIGIN_BY_REGION.eu}/api/kiana/marvel-mms/cyborg/increase/flow/submitIncreaseFlowPriceInfo`
});
const PRODUCT_ID_FIELD_BY_TYPE = Object.freeze({
  spu: 'productIdList',
  skc: 'productSkcIdList',
  sku: 'productSkuIdList'
});
const TRAFFIC_PRODUCT_RANGE_FIELD_MAP = Object.freeze({
  exposure: Object.freeze({
    minFieldName: 'minImpressionCount',
    maxFieldName: 'maxImpressionCount',
    label: '\u66dd\u5149\u91cf'
  }),
  click: Object.freeze({
    minFieldName: 'minClickCount',
    maxFieldName: 'maxClickCount',
    label: '\u70b9\u51fb\u91cf'
  }),
  visitor: Object.freeze({
    minFieldName: 'minGoodsVisitorsUserNum',
    maxFieldName: 'maxGoodsVisitorsUserNum',
    label: '\u5546\u54c1\u8bbf\u5ba2\u6570'
  })
});
const TRAFFIC_PAYMENT_RANGE_FIELD_MAP = Object.freeze({
  paidPieces: Object.freeze({
    minFieldName: 'minOrderPayGoodsNum',
    maxFieldName: 'maxOrderPayGoodsNum',
    label: '\u652f\u4ed8\u4ef6\u6570'
  }),
  paidOrders: Object.freeze({
    minFieldName: 'minOrderPayOrderNum',
    maxFieldName: 'maxOrderPayOrderNum',
    label: '\u652f\u4ed8\u8ba2\u5355\u6570'
  })
});
const TRAFFIC_CONVERSION_RANGE_FIELD_MAP = Object.freeze({
  exposureOrderRate: Object.freeze({
    minFieldName: 'minOrderPayImpressionRate',
    maxFieldName: 'maxOrderPayImpressionRate',
    label: '\u66dd\u5149\u8ba2\u5355\u8f6c\u5316\u7387'
  }),
  clickRate: Object.freeze({
    minFieldName: 'minClickImpressionRate',
    maxFieldName: 'maxClickImpressionRate',
    label: '\u70b9\u51fb\u7387'
  }),
  clickOrderRate: Object.freeze({
    minFieldName: 'minClickOrderRatio',
    maxFieldName: 'maxClickOrderRatio',
    label: '\u70b9\u51fb\u8ba2\u5355\u8f6c\u5316\u7387'
  }),
  detailPaymentRate: Object.freeze({
    minFieldName: 'minBusinessDetailPaymentUserRate',
    maxFieldName: 'maxBusinessDetailPaymentUserRate',
    label: '\u5546\u8be6\u652f\u4ed8\u8f6c\u5316\u7387'
  })
});

function normalizeHelperText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeCustomLevelModeValueCache(cache) {
  const source = cache && typeof cache === 'object' && !Array.isArray(cache)
    ? cache
    : {};
  const normalizeCacheValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return '';
    }

    return Number(parsedValue.toFixed(2));
  };

  return {
    dailyDiscount: normalizeCacheValue(source.dailyDiscount),
    saleProfitRate: normalizeCacheValue(source.saleProfitRate),
    profitRateDiscount: normalizeCacheValue(source.profitRateDiscount),
    dailyReduce: normalizeCacheValue(source.dailyReduce),
    costMarkup: normalizeCacheValue(source.costMarkup)
  };
}

function normalizeOriginUrl(value) {
  return normalizeHelperText(value).replace(/\/+$/, '');
}

function parseUrlOrNull(value) {
  const normalizedValue = normalizeHelperText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return new URL(normalizedValue);
  } catch (_error) {
    return null;
  }
}

function normalizeShopMatchText(value) {
  return normalizeHelperText(value).toLowerCase().replace(/\s+/g, '');
}

function normalizeMallRecords(malls) {
  return Array.isArray(malls)
    ? malls
      .map((mall) => ({
        mallId: normalizeHelperText(mall && (mall.mallId || mall.mallID || mall.id || mall.shopId || mall.shopID)),
        mallName: normalizeHelperText(mall && (mall.mallName || mall.shopName || mall.name || mall.mallTitle)),
        uniqueId: normalizeHelperText(
          mall && (mall.uniqueId || mall.uniqueID || mall.mallUniqueId || mall.mallUniqueID)
        )
      }))
      .filter((mall) => mall.mallId || mall.mallName || mall.uniqueId)
    : [];
}

function createOperationsTrafficBoostService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  operationsSharedCostService,
  getShopWindowBrowserController,
  emitProgress,
  runtimeLogger
}) {
  const store = createOperationsTrafficBoostStore({
    sessionStore,
    featureCenterProfileService
  });
  let loadedOwnerKey = '';
  const cookieCacheByShopId = new Map();
  const shopRuntimeProfileByShopId = new Map();
  const latestQueryProgressByOwner = new Map();
  const activeQueryJobsByOwnerKey = new Map();
  const activeQueryJobsByRequesterKey = new Map();
  const activeQueryJobsByRunId = new Map();
  const activeSubmitJobsByOwnerKey = new Map();
  const activeSubmitJobsByRequesterKey = new Map();
  const activeSubmitJobsByRequestId = new Map();

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
    scope: 'operations-traffic-boost'
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function buildSessionPolicyDetails(options = {}) {
    return {
      shopId: normalizeText(
        options.shopId
        || (options.shopSummary && options.shopSummary.shopId)
        || (options.sessionContext && options.sessionContext.shopId)
      ),
      shopName: normalizeText(
        options.shopName
        || (options.shopSummary && options.shopSummary.shopName)
        || (options.sessionContext && options.sessionContext.shopName)
      ),
      partition: normalizeText(
        options.partition
        || (options.sessionContext && options.sessionContext.partition)
      ),
      origin: normalizeOriginUrl(options.origin),
      requestUrl: normalizeText(options.requestUrl),
      message: normalizeText(options.message)
    };
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

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || null));
  }

  function getOwner() {
    if (!sessionStore || typeof sessionStore.getSession !== 'function') {
      return null;
    }

    return buildOwnerDescriptor(sessionStore.getSession());
  }

  function ensureOwnerScope() {
    const owner = getOwner();
    const nextOwnerKey = normalizeText(owner && owner.userKey);

    if (nextOwnerKey !== loadedOwnerKey) {
      cookieCacheByShopId.clear();
      shopRuntimeProfileByShopId.clear();
      latestQueryProgressByOwner.clear();
      activeQueryJobsByOwnerKey.clear();
      activeQueryJobsByRequesterKey.clear();
      activeQueryJobsByRunId.clear();
      activeSubmitJobsByOwnerKey.clear();
      activeSubmitJobsByRequesterKey.clear();
      activeSubmitJobsByRequestId.clear();
      loadedOwnerKey = nextOwnerKey;
    }

    return owner;
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

  function shouldSplitFlowPriceSubmitError(error) {
    if (isQueryCanceledError(error)) {
      return false;
    }

    return shouldSplitFlowPriceSubmitErrorMessage(error && error.message);
  }

  function createCancelableDelay(queryJob, delayMs) {
    const normalizedDelayMs = Math.max(0, normalizeIntegerValue(delayMs, 0));

    if (normalizedDelayMs <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;

      const cleanup = () => {
        if (queryJob && queryJob.activeDelayCancels) {
          queryJob.activeDelayCancels.delete(cancelDelay);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = 0;
        }
      };

      const finishResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };

      const finishReject = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const cancelDelay = () => {
        finishReject(createQueryCanceledError());
      };

      if (queryJob && queryJob.activeDelayCancels) {
        queryJob.activeDelayCancels.add(cancelDelay);
        if (queryJob.canceled === true || queryJob.stopRequested === true) {
          cancelDelay();
          return;
        }
      }

      timeoutId = setTimeout(finishResolve, normalizedDelayMs);
    });
  }

  function computeRateLimitRetryDelayMs(attemptIndex, message = '') {
    const normalizedAttemptIndex = Math.max(0, normalizeIntegerValue(attemptIndex, 0));

    if (isHotSubmitRateLimitErrorMessage(message)) {
      const retryMultiplier = Math.pow(2, normalizedAttemptIndex);
      return randomIntegerBetween(
        HOT_SUBMIT_RATE_LIMIT_RETRY_MIN_MS * retryMultiplier,
        HOT_SUBMIT_RATE_LIMIT_RETRY_MAX_MS * retryMultiplier
      );
    }

    return RATE_LIMIT_RETRY_BASE_DELAY_MS * Math.pow(2, normalizedAttemptIndex);
  }

  function randomIntegerBetween(minValue, maxValue) {
    const normalizedMin = Math.max(0, normalizeIntegerValue(minValue, 0));
    const normalizedMax = Math.max(normalizedMin, normalizeIntegerValue(maxValue, normalizedMin));

    if (normalizedMax <= normalizedMin) {
      return normalizedMin;
    }

    return normalizedMin + Math.floor(Math.random() * (normalizedMax - normalizedMin + 1));
  }

  function setSharedCostLookupValue(lookup, entry) {
    if (!(lookup instanceof Map)) {
      return;
    }

    const primaryKey = buildCostPrimaryKey(entry);
    const numericCostPrice = Number(
      normalizePositiveDecimalValue(entry && entry.costPrice, 0).toFixed(2)
    );

    if (!primaryKey || !Number.isFinite(numericCostPrice) || numericCostPrice <= 0) {
      return;
    }

    lookup.set(primaryKey, numericCostPrice);
  }

  function resolveSharedCostPrice(lookup, row) {
    if (!(lookup instanceof Map) || lookup.size <= 0) {
      return '';
    }

    const candidateKeys = buildCostLookupCandidates({
      shopId: row && row.shopId,
      station: row && row.station,
      stationLabel: row && row.stationLabel,
      skuId: row && row.skuId,
      skuCode: row && row.skuCode,
      skcId: row && row.skcId,
      skcCode: row && row.skcCode,
      spec: row && row.spec,
      legacySpec: row && row.legacySpec,
      specAliases: Array.isArray(row && row.specAliases) ? row.specAliases : []
    });

    for (const candidateKey of candidateKeys) {
      const costPrice = Number(lookup.get(candidateKey));

      if (Number.isFinite(costPrice) && costPrice > 0) {
        return String(Number(costPrice.toFixed(2)));
      }
    }

    return '';
  }

  async function buildSharedCostLookup(shopIds = []) {
    const lookup = new Map();
    const normalizedShopIds = Array.from(new Set(
      (Array.isArray(shopIds) ? shopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));

    if (
      normalizedShopIds.length <= 0
      || !operationsSharedCostService
      || typeof operationsSharedCostService.getCostSnapshot !== 'function'
    ) {
      return lookup;
    }

    try {
      const snapshot = await operationsSharedCostService.getCostSnapshot({
        shopIds: normalizedShopIds
      });

      (Array.isArray(snapshot && snapshot.entries) ? snapshot.entries : []).forEach((entry) => {
        setSharedCostLookupValue(lookup, entry);
      });
    } catch (error) {
      logError('operations_traffic_boost_shared_cost_lookup_failed', error, {
        shopCount: normalizedShopIds.length
      });
    }

    return lookup;
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

  function normalizeCustomLevelFilterMode(value) {
    const normalizedValue = normalizeText(value);
    return [
      'dailyDiscount',
      'saleProfitRate',
      'profitRateDiscount',
      'dailyReduce',
      'costMarkup'
    ].includes(normalizedValue)
      ? normalizedValue
      : 'dailyDiscount';
  }

  function normalizeCustomLevelFilterRelation(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return normalizedValue === 'or' ? 'or' : 'and';
  }

  function normalizeCustomLevelSubmitBasis(value) {
    const normalizedValue = normalizeText(value);
    return ['profitFloorRate', 'profitFloorValue'].includes(normalizedValue)
      ? normalizedValue
      : 'profitFloorRate';
  }

  function resolveCustomLevelFilterModeValue(settings, mode) {
    const normalizedSettings = settings && typeof settings === 'object' ? settings : {};
    const normalizedMode = normalizeCustomLevelFilterMode(mode || normalizedSettings.mode);
    const modeValueByMode = normalizeCustomLevelModeValueCache(normalizedSettings.modeValueByMode);

    if (normalizedMode === 'dailyDiscount') {
      return formatOptionalFilterNumber(modeValueByMode.dailyDiscount || normalizedSettings.modeValueDailyDiscount, { fractionDigits: 2 });
    }

    if (normalizedMode === 'saleProfitRate') {
      return formatOptionalFilterNumber(modeValueByMode.saleProfitRate || normalizedSettings.modeValueSaleProfitRate, { fractionDigits: 2 });
    }

    if (normalizedMode === 'profitRateDiscount') {
      return formatOptionalFilterNumber(modeValueByMode.profitRateDiscount || normalizedSettings.modeValueProfitRateDiscount, { fractionDigits: 2 });
    }

    if (normalizedMode === 'dailyReduce') {
      return formatOptionalFilterNumber(modeValueByMode.dailyReduce || normalizedSettings.modeValueDailyReduce, { fractionDigits: 2 });
    }

    if (normalizedMode === 'costMarkup') {
      return formatOptionalFilterNumber(modeValueByMode.costMarkup || normalizedSettings.modeValueCostMarkup, { fractionDigits: 2 });
    }

    return '';
  }

  function normalizeCustomLevelFilterSettingsPayload(payload = {}) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const mode = normalizeCustomLevelFilterMode(source.mode);
    const sourceModeValueByMode = normalizeCustomLevelModeValueCache(source.modeValueByMode);
    const legacyModeValue = formatOptionalFilterNumber(source.modeValue, { fractionDigits: 2 });
    let modeValueDailyDiscount = formatOptionalFilterNumber(source.modeValueDailyDiscount || sourceModeValueByMode.dailyDiscount, { fractionDigits: 2 });
    let modeValueSaleProfitRate = formatOptionalFilterNumber(source.modeValueSaleProfitRate || sourceModeValueByMode.saleProfitRate, { fractionDigits: 2 });
    let modeValueProfitRateDiscount = formatOptionalFilterNumber(source.modeValueProfitRateDiscount || sourceModeValueByMode.profitRateDiscount, { fractionDigits: 2 });
    let modeValueDailyReduce = formatOptionalFilterNumber(source.modeValueDailyReduce || sourceModeValueByMode.dailyReduce, { fractionDigits: 2 });
    let modeValueCostMarkup = formatOptionalFilterNumber(source.modeValueCostMarkup || sourceModeValueByMode.costMarkup, { fractionDigits: 2 });

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
      version: CUSTOM_LEVEL_FILTER_SETTINGS_VERSION,
      updatedAt: normalizeText(source.updatedAt) || nowIso(),
      mode,
      modeValueByMode: {
        dailyDiscount: modeValueDailyDiscount,
        saleProfitRate: modeValueSaleProfitRate,
        profitRateDiscount: modeValueProfitRateDiscount,
        dailyReduce: modeValueDailyReduce,
        costMarkup: modeValueCostMarkup
      },
      modeValueDailyDiscount,
      modeValueSaleProfitRate,
      modeValueProfitRateDiscount,
      modeValueDailyReduce,
      modeValueCostMarkup,
      clampToSuggestPrice: normalizeBooleanSetting(source.clampToSuggestPrice, false),
      profitFloorRate: formatOptionalFilterNumber(source.profitFloorRate, { fractionDigits: 2 }),
      profitFloorRelation: normalizeCustomLevelFilterRelation(source.profitFloorRelation),
      profitFloorValue: formatOptionalFilterNumber(source.profitFloorValue, { fractionDigits: 2 }),
      submitAtProfitFloor: normalizeBooleanSetting(source.submitAtProfitFloor, false),
      submitAtProfitFloorBasis: normalizeCustomLevelSubmitBasis(source.submitAtProfitFloorBasis)
    };

    normalizedSettings.modeValue = resolveCustomLevelFilterModeValue(normalizedSettings, mode);
    return normalizedSettings;
  }

  function normalizeMetricType(value, mapping, fallbackValue) {
    const normalizedValue = normalizeText(value);
    return Object.prototype.hasOwnProperty.call(mapping, normalizedValue)
      ? normalizedValue
      : fallbackValue;
  }

  function normalizeMarketRegion(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(MARKET_ORIGIN_BY_REGION, normalizedValue)
      ? normalizedValue
      : DEFAULT_MARKET_REGION;
  }

  function resolveMarketRegionFromOrigin(origin) {
    const normalizedOrigin = normalizeOriginUrl(origin);
    const matchedEntry = Object.entries(MARKET_ORIGIN_BY_REGION).find((entry) => {
      return normalizeOriginUrl(entry[1]) === normalizedOrigin;
    });

    return matchedEntry ? matchedEntry[0] : 'global';
  }

  function resolveSellerOriginFromSessionContext(sessionContext) {
    return normalizeOriginUrl(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.origin
    ) || DEFAULT_SELLER_ORIGIN;
  }

  function resolveSellerSessionRegion(sessionContext) {
    return resolveMarketRegionFromOrigin(resolveSellerOriginFromSessionContext(sessionContext));
  }

  function buildTrafficBoostRegionRedirectUrl(marketRegion) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const origin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;
    return `${origin}${TRAFFIC_BOOST_REGION_REDIRECT_PATH}`;
  }

  function buildSellerRegionAuthenticationRedirectUrl(marketRegion, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const origin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;

    if (normalizedRegion === 'global') {
      return buildTrafficBoostRegionRedirectUrl(normalizedRegion);
    }

    return options.trailingSlash === false
      ? origin
      : `${origin}/`;
  }

  function isUsableBrowserView(view) {
    return Boolean(view && view.webContents && !view.webContents.isDestroyed());
  }

  async function waitForBrowserViewReady(view, options = {}) {
    if (!isUsableBrowserView(view)) {
      throw new Error('\u6d41\u91cf\u52a0\u901f\u533a\u57df\u5207\u6362\u7684 seller \u6d4f\u89c8\u7a97\u53e3\u4e0d\u53ef\u7528\u3002');
    }

    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || QUERY_REQUEST_TIMEOUT_MS);
    const pollIntervalMs = Math.max(120, Number(options.pollIntervalMs) || 180);
    const deadline = Date.now() + timeoutMs;
    let lastReadyState = '';

    while (Date.now() < deadline) {
      if (!isUsableBrowserView(view)) {
        break;
      }

      try {
        lastReadyState = normalizeText(
          await view.webContents.executeJavaScript('document.readyState', true)
        ).toLowerCase();
      } catch (_error) {
        lastReadyState = '';
      }

      if (lastReadyState === 'complete' || lastReadyState === 'interactive') {
        return {
          readyState: lastReadyState,
          currentUrl: normalizeText(view.webContents.getURL())
        };
      }

      await new Promise((resolve) => {
        setTimeout(resolve, pollIntervalMs);
      });
    }

    throw new Error('\u6d41\u91cf\u52a0\u901f\u533a\u57df\u5207\u6362\u9875\u9762\u8f7d\u5165\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
  }

  async function ensureSellerRegionSwitchBrowserContext(sessionContext, options = {}) {
    const controller = getController();
    const shopSummary = options.shopSummary || null;
    const normalizedTargetRegion = normalizeMarketRegion(options.marketRegion);
    const normalizedSourceRegion = normalizeMarketRegion(
      options.sourceRegion || resolveSellerSessionRegion(sessionContext)
    );
    const shopId = normalizeText(
      (shopSummary && shopSummary.shopId)
      || (sessionContext && sessionContext.shopId)
    );
    const shopUpdatedAt = normalizeText(shopSummary && shopSummary.updatedAt);

    if (!controller || typeof controller.ensureBackgroundSellerCenterGlobalSession !== 'function') {
      throw new Error('\u6d41\u91cf\u52a0\u901f\u533a\u57df\u5207\u6362\u7f3a\u5c11\u53ef\u7528\u7684 seller \u540e\u53f0\u7a97\u53e3\u63a7\u5236\u5668\u3002');
    }

    if (!shopId) {
      throw new Error('\u7f3a\u5c11\u5e97\u94fa\u6807\u8bc6\uff0c\u65e0\u6cd5\u8fdb\u884c\u533a\u57df\u5207\u6362\u3002');
    }

    const result = await controller.ensureBackgroundSellerCenterGlobalSession({
      shopId,
      shopUpdatedAt,
      timeoutMs: Math.max(10000, Number(options.timeoutMs) || QUERY_REQUEST_TIMEOUT_MS),
      requireView: true,
      backgroundGroupKey: 'operations-traffic-boost-region-switch',
      entryId: `${shopId}-${normalizedSourceRegion}-to-${normalizedTargetRegion}`,
      initialUrl: buildTrafficBoostRegionRedirectUrl(normalizedSourceRegion)
    });

    if (!isUsableBrowserView(result && result.view)) {
      throw new Error('\u65e0\u6cd5\u6253\u5f00 seller \u540e\u53f0\u7a97\u53e3\uff0c\u8bf7\u5148\u786e\u8ba4\u5e97\u94fa\u767b\u5f55\u72b6\u6001\u3002');
    }

    return {
      ...result,
      sourceRegion: normalizedSourceRegion,
      targetRegion: normalizedTargetRegion,
      sourceRedirectUrl: buildTrafficBoostRegionRedirectUrl(normalizedSourceRegion),
      targetRedirectUrl: buildTrafficBoostRegionRedirectUrl(normalizedTargetRegion),
      targetAuthenticationRedirectUrl: buildSellerRegionAuthenticationRedirectUrl(normalizedTargetRegion)
    };
  }

  async function navigateSellerRegionView(view, targetUrl, options = {}) {
    if (!isUsableBrowserView(view)) {
      throw new Error('\u6d41\u91cf\u52a0\u901f seller \u7a97\u53e3\u4e0d\u53ef\u7528\uff0c\u65e0\u6cd5\u7ee7\u7eed\u3002');
    }

    const normalizedUrl = normalizeText(targetUrl);
    const httpReferrer = normalizeText(options.httpReferrer);
    const loadOptions = httpReferrer ? { httpReferrer } : undefined;

    view.webContents.loadURL(normalizedUrl, loadOptions).catch((error) => {
      if (!error || /ERR_ABORTED/i.test(normalizeText(error && error.message))) {
        return;
      }

      logError('operations_traffic_boost_region_switch_load_failed', error, {
        targetUrl: normalizedUrl,
        httpReferrer
      });
    });

    return waitForBrowserViewReady(view, options);
  }

  async function executeSellerRegionContextRequest(view, requestPayload, options = {}) {
    if (!isUsableBrowserView(view)) {
      throw new Error('\u6d41\u91cf\u52a0\u901f seller \u7a97\u53e3\u4e0d\u53ef\u7528\uff0c\u65e0\u6cd5\u53d1\u8d77\u533a\u57df\u8bf7\u6c42\u3002');
    }

    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const requestLabel = normalizeText(options.requestLabel)
      || normalizeText(requestPayload && requestPayload.requestPath)
      || '\u9875\u9762\u8bf7\u6c42';
    const requestPath = normalizeText(requestPayload && requestPayload.requestPath);
    const requestMethod = normalizeText(requestPayload && requestPayload.method).toUpperCase();
    const requestTransport = normalizeText(options.requestTransport) || 'page.fetch';

    emitQueryRequestProgress(progressContext, {
      phase: 'requesting',
      traceType: 'request-start',
      requestLabel,
      requestPath,
      requestMethod,
      requestTransport,
      message: normalizeText(options.requestStartMessage) || `\u6b63\u5728\u53d1\u8d77${requestLabel}\u3002`
    }, progressEmitter);

    try {
      const requestResult = await view.webContents.executeJavaScript(
        buildSellerRegionContextRequestScript(requestPayload),
        true
      );

      log('operations_traffic_boost_region_switch_page_request_result', {
        shopId: normalizeText(options.shopSummary && options.shopSummary.shopId),
        requestPath,
        currentUrl: normalizeText(requestResult && requestResult.currentUrl),
        origin: normalizeText(requestResult && requestResult.origin),
        status: normalizeText(requestResult && requestResult.status),
        httpStatus: Number(requestResult && requestResult.httpStatus) || 0,
        success: requestResult && Object.prototype.hasOwnProperty.call(requestResult, 'success')
          ? Boolean(requestResult.success)
          : null,
        errorCode: requestResult && Object.prototype.hasOwnProperty.call(requestResult, 'errorCode')
          ? Number(requestResult.errorCode)
          : null,
        message: normalizeText(requestResult && requestResult.message),
        errorMessage: normalizeText(requestResult && requestResult.errorMessage),
        responseTextPreview: normalizeText(requestResult && requestResult.responseTextPreview)
      });

      emitQueryRequestProgress(progressContext, {
        phase: requestResult && requestResult.ok === true ? 'request-completed' : 'request-failed',
        traceType: requestResult && requestResult.ok === true ? 'request-completed' : 'request-failed',
        requestLabel,
        requestPath,
        requestMethod,
        requestTransport,
        httpStatus: Number(requestResult && requestResult.httpStatus) || 0,
        success: requestResult && Object.prototype.hasOwnProperty.call(requestResult, 'success')
          ? Boolean(requestResult.success)
          : null,
        errorCode: requestResult && Object.prototype.hasOwnProperty.call(requestResult, 'errorCode')
          ? Number(requestResult.errorCode)
          : null,
        responseTextPreview: normalizeText(requestResult && requestResult.responseTextPreview),
        message: normalizeText(requestResult && requestResult.message) || (
          requestResult && requestResult.ok === true
            ? `\u5df2\u5b8c\u6210${requestLabel}\u3002`
            : `\u672a\u80fd\u5b8c\u6210${requestLabel}\u3002`
        ),
        currentUrl: normalizeText(requestResult && requestResult.currentUrl),
        finalUrl: normalizeText(requestResult && requestResult.finalUrl),
        sourceOrigin: normalizeText(requestResult && requestResult.origin)
      }, progressEmitter);

      return requestResult;
    } catch (error) {
      emitQueryRequestProgress(progressContext, {
        phase: 'request-failed',
        traceType: 'request-failed',
        requestLabel,
        requestPath,
        requestMethod,
        requestTransport,
        message: normalizeText(error && error.message) || `\u53d1\u8d77${requestLabel}\u5931\u8d25\u3002`,
        errorMessage: normalizeText(error && error.message)
      }, progressEmitter);
      throw error;
    }
  }

  function normalizeProductIdType(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(PRODUCT_ID_FIELD_BY_TYPE, normalizedValue)
      ? normalizedValue
      : DEFAULT_PRODUCT_ID_TYPE;
  }

  function normalizeRangeInputValue(value, fieldLabel) {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const parsedValue = normalizeDecimalValue(value, Number.NaN);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      throw new Error(`${fieldLabel}\u4ec5\u652f\u6301\u5927\u4e8e\u6216\u7b49\u4e8e0\u7684\u6570\u5b57\u3002`);
    }

    return Number(parsedValue);
  }

  function parseKeywordList(value) {
    return Array.from(new Set(
      normalizeText(value)
        .split(/[\s,\uff0c;\uff1b]+/)
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )).slice(0, MAX_MULTI_KEYWORDS);
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
      .map((keyword) => Number.parseInt(keyword, 10))
      .filter((keyword) => Number.isFinite(keyword));
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

  function normalizeCategorySelectionRecord(selection) {
    const normalizedSelection =
      selection && typeof selection === 'object'
        ? selection
        : {
          categoryId: selection
        };
    const categoryId = normalizeText(normalizedSelection && normalizedSelection.categoryId);

    if (!categoryId) {
      return null;
    }

    const categoryPathIds = Array.from(new Set(
      (Array.isArray(normalizedSelection && normalizedSelection.categoryPathIds)
        ? normalizedSelection.categoryPathIds
        : [])
        .map((categoryPathId) => normalizeText(categoryPathId))
        .filter(Boolean)
    ));

    if (
      categoryPathIds.length <= 0
      || categoryPathIds[categoryPathIds.length - 1] !== categoryId
    ) {
      categoryPathIds.push(categoryId);
    }

    return {
      categoryId,
      categoryPathIds
    };
  }

  function normalizeCategorySelections(categorySelections) {
    const selectionMap = new Map();

    (Array.isArray(categorySelections) ? categorySelections : []).forEach((selection) => {
      const normalizedSelection = normalizeCategorySelectionRecord(selection);

      if (!normalizedSelection) {
        return;
      }

      const selectionKey = normalizedSelection.categoryPathIds.join('/') || normalizedSelection.categoryId;

      if (!selectionKey || selectionMap.has(selectionKey)) {
        return;
      }

      selectionMap.set(selectionKey, normalizedSelection);
    });

    return Array.from(selectionMap.values());
  }

  function isCategorySelectionAncestorOf(ancestorSelection, descendantSelection) {
    const ancestorPathIds = Array.isArray(ancestorSelection && ancestorSelection.categoryPathIds)
      ? ancestorSelection.categoryPathIds
      : [];
    const descendantPathIds = Array.isArray(descendantSelection && descendantSelection.categoryPathIds)
      ? descendantSelection.categoryPathIds
      : [];

    if (
      ancestorPathIds.length <= 0
      || descendantPathIds.length <= ancestorPathIds.length
    ) {
      return false;
    }

    return ancestorPathIds.every((categoryId, index) => {
      return categoryId === descendantPathIds[index];
    });
  }

  function buildSmallestSelectedCategoryIdList(categorySelections) {
    const normalizedSelections = normalizeCategorySelections(categorySelections);

    return Array.from(new Set(
      normalizedSelections
        .filter((selection, selectionIndex) => {
          return !normalizedSelections.some((candidateSelection, candidateIndex) => {
            return candidateIndex !== selectionIndex
              && isCategorySelectionAncestorOf(selection, candidateSelection);
          });
        })
        .map((selection) => Number.parseInt(selection && selection.categoryId, 10))
        .filter((categoryId) => Number.isFinite(categoryId))
    ));
  }

  function normalizeFilters(source = {}) {
    const filters = source && typeof source === 'object' && !Array.isArray(source)
      ? source
      : {};

    return {
      selectedShopIds: normalizeSelectedShopIds(filters.selectedShopIds || filters.shopIds),
      marketRegion: normalizeMarketRegion(filters.marketRegion),
      stationIds: normalizeSelectedStationIds(filters.stationIds || filters.siteIdList),
      categorySelections: normalizeCategorySelections(filters.categorySelections),
      productIdType: normalizeProductIdType(filters.productIdType),
      productIdKeywords: normalizeText(filters.productIdKeywords),
      productName: normalizeText(filters.productName),
      joinedStartDate: normalizeText(filters.joinedStartDate || filters.startDate),
      joinedEndDate: normalizeText(filters.joinedEndDate || filters.endDate),
      trafficProductMetricType: normalizeMetricType(
        filters.trafficProductMetricType,
        TRAFFIC_PRODUCT_RANGE_FIELD_MAP,
        DEFAULT_TRAFFIC_PRODUCT_METRIC_TYPE
      ),
      trafficProductMinValue: filters.trafficProductMinValue,
      trafficProductMaxValue: filters.trafficProductMaxValue,
      trafficPaymentMetricType: normalizeMetricType(
        filters.trafficPaymentMetricType,
        TRAFFIC_PAYMENT_RANGE_FIELD_MAP,
        DEFAULT_TRAFFIC_PAYMENT_METRIC_TYPE
      ),
      trafficPaymentMinValue: filters.trafficPaymentMinValue,
      trafficPaymentMaxValue: filters.trafficPaymentMaxValue,
      trafficConversionMetricType: normalizeMetricType(
        filters.trafficConversionMetricType,
        TRAFFIC_CONVERSION_RANGE_FIELD_MAP,
        DEFAULT_TRAFFIC_CONVERSION_METRIC_TYPE
      ),
      trafficConversionMinValue: filters.trafficConversionMinValue,
      trafficConversionMaxValue: filters.trafficConversionMaxValue
    };
  }

  function chunkList(items, chunkSize) {
    const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const normalizedChunkSize = Math.max(1, normalizeIntegerValue(chunkSize, 1));
    const chunks = [];

    for (let startIndex = 0; startIndex < normalizedItems.length; startIndex += normalizedChunkSize) {
      chunks.push(normalizedItems.slice(startIndex, startIndex + normalizedChunkSize));
    }

    return chunks;
  }

  function normalizeTrafficBoostSubmitRequest(payload = {}) {
    const normalizedProducts = Array.from(new Map(
      (Array.isArray(payload && payload.products) ? payload.products : [])
        .map((item) => normalizeTrafficBoostSubmitProductItem(item))
        .filter(Boolean)
        .map((productItem) => [
          `${productItem.shopId}::${buildTrafficBoostSubmitProductKey(productItem.productId, productItem.siteId)}`,
          productItem
        ])
    ).values());
    const groupMap = new Map();

    normalizedProducts.forEach((productItem) => {
      const groupKey = `${productItem.shopId}::${productItem.marketRegion}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          shopId: productItem.shopId,
          shopName: productItem.shopName,
          marketRegion: productItem.marketRegion,
          products: []
        });
      }

      groupMap.get(groupKey).products.push(productItem);
    });

    return {
      requestId: normalizeText(payload && payload.requestId) || `traffic_submit_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      submitBatchSize: normalizeTrafficBoostSubmitBatchSize(payload && payload.submitBatchSize),
      submitShopConcurrency: 1,
      products: normalizedProducts,
      shopSubmissions: Array.from(groupMap.values())
    };
  }

  function applyMetricRange(payload, mapping, metricType, minValue, maxValue) {
    const rangeEntry = mapping[metricType];

    if (!rangeEntry) {
      return;
    }

    const normalizedMinValue = normalizeRangeInputValue(
      minValue,
      `${rangeEntry.label}\u6700\u5c0f\u503c`
    );
    const normalizedMaxValue = normalizeRangeInputValue(
      maxValue,
      `${rangeEntry.label}\u6700\u5927\u503c`
    );

    if (
      normalizedMinValue !== ''
      && normalizedMaxValue !== ''
      && normalizedMinValue > normalizedMaxValue
    ) {
      throw new Error(`${rangeEntry.label}\u6700\u5c0f\u503c\u4e0d\u80fd\u5927\u4e8e\u6700\u5927\u503c\u3002`);
    }

    if (normalizedMinValue !== '') {
      payload[rangeEntry.minFieldName] = normalizedMinValue;
    }

    if (normalizedMaxValue !== '') {
      payload[rangeEntry.maxFieldName] = normalizedMaxValue;
    }
  }

  function buildQueryRequestPayload(filters, pageNumber) {
    const normalizedFilters = normalizeFilters(filters);
    const productIdFieldName = PRODUCT_ID_FIELD_BY_TYPE[normalizedFilters.productIdType];
    const productIdList = parseIntegerKeywordList(
      normalizedFilters.productIdKeywords,
      '\u5546\u54c1ID'
    );
    const siteIdList = normalizedFilters.stationIds
      .map((stationId) => Number.parseInt(stationId, 10))
      .filter((stationId) => Number.isFinite(stationId));
    const catIdList = buildSmallestSelectedCategoryIdList(normalizedFilters.categorySelections);
    const requestPayload = {
      pageSize: DEFAULT_PAGE_SIZE,
      pageNumber: Math.max(1, normalizeIntegerValue(pageNumber, 1)),
      timeDimension: 1,
      flowGrowStatus: 0,
      canToGrow: 1,
      siteIdList,
      catIdList,
      productName: normalizedFilters.productName,
      [productIdFieldName]: productIdList
    };
    const startTimestamp = parseDateTimestamp(normalizedFilters.joinedStartDate);
    const endTimestamp = parseDateTimestamp(normalizedFilters.joinedEndDate, {
      endOfDay: true
    });

    if (Number.isFinite(startTimestamp)) {
      requestPayload.firstBindSiteStartTime = startTimestamp;
    }

    if (Number.isFinite(endTimestamp)) {
      requestPayload.firstBindSiteEndTime = endTimestamp;
    }

    applyMetricRange(
      requestPayload,
      TRAFFIC_PRODUCT_RANGE_FIELD_MAP,
      normalizedFilters.trafficProductMetricType,
      normalizedFilters.trafficProductMinValue,
      normalizedFilters.trafficProductMaxValue
    );
    applyMetricRange(
      requestPayload,
      TRAFFIC_PAYMENT_RANGE_FIELD_MAP,
      normalizedFilters.trafficPaymentMetricType,
      normalizedFilters.trafficPaymentMinValue,
      normalizedFilters.trafficPaymentMaxValue
    );
    applyMetricRange(
      requestPayload,
      TRAFFIC_CONVERSION_RANGE_FIELD_MAP,
      normalizedFilters.trafficConversionMetricType,
      normalizedFilters.trafficConversionMinValue,
      normalizedFilters.trafficConversionMaxValue
    );

    return requestPayload;
  }

  function createQueryCanceledError(message = '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u5df2\u505c\u6b62') {
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

  function createQueryJob(owner, payload = {}, options = {}) {
    const normalizedOwner = owner || ensureOwnerScope();
    const ownerKey = normalizeText(normalizedOwner && normalizedOwner.userKey) || 'anonymous';
    const requesterKey = normalizeText(options && options.requesterKey);
    const runId = normalizeText(payload && payload.runId) || `traffic_query_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const existingJob = requesterKey
      ? activeQueryJobsByRequesterKey.get(requesterKey)
      : activeQueryJobsByOwnerKey.get(ownerKey);

    if (existingJob && existingJob.canceled !== true) {
      throw new Error('\u5f53\u524d\u5df2\u6709\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u4efb\u52a1\u5728\u8fdb\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u6216\u7b49\u5f85\u5b8c\u6210');
    }

    const job = {
      ownerKey,
      requesterKey,
      runId,
      canceled: false,
      stopRequested: false,
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

  function createSubmitJob(owner, payload = {}, options = {}) {
    const normalizedOwner = owner || ensureOwnerScope();
    const ownerKey = normalizeText(normalizedOwner && normalizedOwner.userKey) || 'anonymous';
    const requesterKey = normalizeText(options && options.requesterKey);
    const requestId = normalizeText(payload && payload.requestId) || `traffic_submit_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const existingJob = requesterKey
      ? activeSubmitJobsByRequesterKey.get(requesterKey)
      : activeSubmitJobsByOwnerKey.get(ownerKey);

    if (existingJob && existingJob.canceled !== true) {
      throw new Error('\u5f53\u524d\u5df2\u6709\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u4efb\u52a1\u5728\u8fdb\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u6216\u7b49\u5f85\u5b8c\u6210');
    }

    const job = {
      ownerKey,
      requesterKey,
      requestId,
      runId: requestId,
      canceled: false,
      stopRequested: false,
      activeControllers: new Set(),
      activeDelayCancels: new Set()
    };

    if (requesterKey) {
      activeSubmitJobsByRequesterKey.set(requesterKey, job);
    } else {
      activeSubmitJobsByOwnerKey.set(ownerKey, job);
    }
    activeSubmitJobsByRequestId.set(requestId, job);
    return job;
  }

  function getSubmitJob(payload = {}, options = {}) {
    const requestId = normalizeText(payload && payload.requestId);
    const owner = payload && payload.owner ? payload.owner : ensureOwnerScope();
    const ownerKey = normalizeText(owner && owner.userKey) || 'anonymous';
    const requesterKey = normalizeText(
      options && options.requesterKey
      || payload && payload.requesterKey
    );

    if (requestId && activeSubmitJobsByRequestId.has(requestId)) {
      return activeSubmitJobsByRequestId.get(requestId) || null;
    }

    if (requesterKey && activeSubmitJobsByRequesterKey.has(requesterKey)) {
      return activeSubmitJobsByRequesterKey.get(requesterKey) || null;
    }

    return activeSubmitJobsByOwnerKey.get(ownerKey) || null;
  }

  function clearSubmitJob(job) {
    if (!job) {
      return;
    }

    if (job.ownerKey && activeSubmitJobsByOwnerKey.get(job.ownerKey) === job) {
      activeSubmitJobsByOwnerKey.delete(job.ownerKey);
    }

    if (job.requesterKey && activeSubmitJobsByRequesterKey.get(job.requesterKey) === job) {
      activeSubmitJobsByRequesterKey.delete(job.requesterKey);
    }

    if (job.requestId && activeSubmitJobsByRequestId.get(job.requestId) === job) {
      activeSubmitJobsByRequestId.delete(job.requestId);
    }
  }

  function cancelSubmitJobInternally(job) {
    if (!job || job.canceled === true || job.stopRequested === true) {
      return false;
    }

    job.stopRequested = true;

    Array.from(job.activeDelayCancels || []).forEach((cancelDelay) => {
      try {
        cancelDelay();
      } catch (_error) {
        // ignore delay cancel failures
      }
    });
    Array.from(job.activeControllers || []).forEach((controller) => {
      try {
        controller.abort();
      } catch (_error) {
        // ignore abort failures
      }
    });
    return true;
  }

  function shouldStopSubmitAfterCurrentStep(job) {
    return Boolean(job && (job.canceled === true || job.stopRequested === true));
  }

  function getQueryJob(payload = {}, options = {}) {
    const runId = normalizeText(payload && payload.runId);
    const owner = payload && payload.owner ? payload.owner : ensureOwnerScope();
    const ownerKey = normalizeText(owner && owner.userKey) || 'anonymous';
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
    if (!job || job.canceled === true || job.stopRequested === true) {
      return false;
    }

    job.stopRequested = true;

    Array.from(job.activeDelayCancels).forEach((cancelDelay) => {
      try {
        cancelDelay();
      } catch (_error) {
        // ignore delay cancel failures
      }
    });
    Array.from(job.activeControllers || []).forEach((controller) => {
      try {
        controller.abort();
      } catch (_error) {
        // ignore abort failures
      }
    });

    return true;
  }

  function assertQueryJobActive(job) {
    if (job && (job.canceled === true || job.stopRequested === true)) {
      throw createQueryCanceledError();
    }
  }

  function shouldStopQueryAfterCurrentStep(job) {
    return Boolean(job && (job.canceled === true || job.stopRequested === true));
  }

  function getOwnerProgressBucket(owner) {
    const normalizedOwner = owner || ensureOwnerScope();
    const ownerKey = normalizeText(normalizedOwner && normalizedOwner.userKey) || 'anonymous';

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
        source: 'operations-traffic-boost',
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
      logError('operations_traffic_boost_progress_emit_failed', error, {
        runId: normalizeText(progressContext && progressContext.runId),
        shopId: normalizeText(progressContext && progressContext.shopId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  function emitQueryRequestProgress(progressContext = {}, payload = {}, progressEmitter) {
    emitQueryProgress(progressContext, {
      phase: normalizeText(payload && payload.phase) || 'requesting',
      traceType: normalizeText(payload && payload.traceType) || 'request',
      requestLabel: normalizeText(payload && payload.requestLabel),
      requestPath: normalizeText(payload && payload.requestPath),
      requestUrl: normalizeText(payload && payload.requestUrl),
      requestMethod: normalizeText(payload && payload.requestMethod).toUpperCase(),
      requestTransport: normalizeText(payload && payload.requestTransport),
      httpStatus: Math.max(0, Number(payload && payload.httpStatus) || 0),
      errorCode: Math.max(0, Number(payload && payload.errorCode) || 0),
      success: payload && Object.prototype.hasOwnProperty.call(payload, 'success')
        ? payload.success
        : undefined,
      authRequired: payload && payload.authRequired === true,
      responseTextPreview: normalizeText(payload && payload.responseTextPreview),
      errorMessage: normalizeText(payload && payload.errorMessage),
      message: normalizeText(payload && payload.message),
      currentUrl: normalizeText(payload && payload.currentUrl),
      finalUrl: normalizeText(payload && payload.finalUrl),
      sourceOrigin: normalizeText(payload && payload.sourceOrigin),
      targetOrigin: normalizeText(payload && payload.targetOrigin),
      loginCodeSource: normalizeText(payload && payload.loginCodeSource),
      hasLoginCode: payload && payload.hasLoginCode === true
    }, progressEmitter);
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  async function persistResolvedPlatformShopIdentity(shopSummary, matchedMall) {
    if (
      !shopManagementService
      || typeof shopManagementService.updateResolvedPlatformShopId !== 'function'
    ) {
      return;
    }

    const shopId = normalizeText(shopSummary && shopSummary.shopId);
    const platformShopId = normalizeText(matchedMall && matchedMall.mallId);
    const platformShopUniqueId = normalizeText(matchedMall && matchedMall.uniqueId);

    if (!shopId || (!platformShopId && !platformShopUniqueId)) {
      return;
    }

    try {
      await shopManagementService.updateResolvedPlatformShopId({
        shopId,
        platformShopId,
        platformShopUniqueId
      });
    } catch (error) {
      logError('operations_traffic_boost_persist_shop_identity_failed', error, {
        shopId,
        platformShopId,
        platformShopUniqueId
      });
    }
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
          platformShopId: normalizeText(shop && shop.platformShopId),
          platformShopUniqueId: normalizeText(shop && shop.platformShopUniqueId),
          shopName: normalizeText(shop && shop.shopName),
          shopGroupId: normalizeText(shop && shop.groupId),
          shopGroupName: normalizeText(shop && shop.groupName),
          updatedAt: normalizeText(shop && shop.updatedAt),
          isVisible: isShopParticipating(shop)
        }))
        .filter((shop) => shop.shopId)
      : [];
  }

  async function getShopRuntimeProfile(shopSummary, sessionContext = null) {
    const shopId = normalizeText(
      shopSummary && shopSummary.shopId
      || sessionContext && sessionContext.shopId
    );

    if (
      !shopId
      || !shopManagementService
      || typeof shopManagementService.getShopRuntimeProfile !== 'function'
    ) {
      return null;
    }

    ensureOwnerScope();

    if (shopRuntimeProfileByShopId.has(shopId)) {
      return shopRuntimeProfileByShopId.get(shopId);
    }

    try {
      const runtimeProfile = await shopManagementService.getShopRuntimeProfile({
        shopId
      });
      const normalizedRuntimeProfile =
        runtimeProfile && typeof runtimeProfile === 'object'
          ? {
              shopId: normalizeText(runtimeProfile.shopId),
              shopName: normalizeText(runtimeProfile.shopName),
              proxyConfig:
                runtimeProfile.proxyConfig && typeof runtimeProfile.proxyConfig === 'object'
                  ? { ...runtimeProfile.proxyConfig }
                  : null
            }
          : null;

      shopRuntimeProfileByShopId.set(shopId, normalizedRuntimeProfile);
      return normalizedRuntimeProfile;
    } catch (error) {
      logError('operations_traffic_boost_load_shop_runtime_profile_failed', error, {
        shopId
      });
      return null;
    }
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

  function getShopCookieCacheEntry(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return null;
    }

    ensureOwnerScope();

    if (!cookieCacheByShopId.has(normalizedShopId)) {
      cookieCacheByShopId.set(normalizedShopId, {
        shopId: normalizedShopId,
        byRegion: Object.create(null)
      });
    }

    return cookieCacheByShopId.get(normalizedShopId);
  }

  function invalidateRegionCookieCache(shopId, marketRegion) {
    const cacheEntry = getShopCookieCacheEntry(shopId);

    if (!cacheEntry) {
      return;
    }

    if (marketRegion) {
      delete cacheEntry.byRegion[normalizeMarketRegion(marketRegion)];
      return;
    }

    cacheEntry.byRegion = Object.create(null);
  }

  async function resolveSellerSessionContext(shopSummary, options = {}) {
    const controller = getController();
    const shopId = normalizeText(shopSummary && shopSummary.shopId);
    const shopUpdatedAt = normalizeText(shopSummary && shopSummary.updatedAt);

    if (!shopId) {
      throw new Error('\u7f3a\u5c11\u5e97\u94fa\u6807\u8bc6\uff0c\u65e0\u6cd5\u67e5\u8be2\u6d41\u91cf\u52a0\u901f\u6570\u636e\u3002');
    }

    if (controller && typeof controller.ensureBackgroundSellerCenterGlobalSession === 'function') {
      const warmedResult = await controller.ensureBackgroundSellerCenterGlobalSession({
        shopId,
        shopUpdatedAt,
        timeoutMs: options.timeoutMs
      });
      const sessionContext =
        warmedResult && warmedResult.sessionContext && typeof warmedResult.sessionContext === 'object'
          ? warmedResult.sessionContext
          : warmedResult;

      if (sessionContext && normalizeText(sessionContext.partition)) {
        return applyKnownPlatformShopIdToSessionContext(
          enrichSessionContextWithSellerAuthSnapshot(
            sessionContext,
            warmedResult
            && warmedResult.shopEntry
            && warmedResult.shopEntry.lastSellerAuthSessionSnapshot
          ),
          shopSummary
        );
      }
    }

    if (controller && typeof controller.resolveShopSessionContext === 'function') {
      const sessionContext = await controller.resolveShopSessionContext({
        shopId,
        shopUpdatedAt
      });

      if (sessionContext && normalizeText(sessionContext.partition)) {
        return applyKnownPlatformShopIdToSessionContext(sessionContext, shopSummary);
      }
    }

    throw new Error('\u5e97\u94fa\u5356\u5bb6\u4e2d\u5fc3\u4f1a\u8bdd\u672a\u5c31\u7eea\uff0c\u8bf7\u5148\u6253\u5f00\u5bf9\u5e94\u5e97\u94fa\u5e76\u786e\u8ba4\u767b\u5f55\u3002');
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

  function findCookieValue(cookies, cookieName) {
    const normalizedCookieName = normalizeText(cookieName).toLowerCase();
    const matchedCookie = (Array.isArray(cookies) ? cookies : []).find((cookie) => {
      return normalizeText(cookie && cookie.name).toLowerCase() === normalizedCookieName;
    });

    return normalizeText(matchedCookie && matchedCookie.value);
  }

  function readMallIdFromCookies(cookies, fallbackValue) {
    return findCookieValue(cookies, 'mallid') || normalizeText(fallbackValue);
  }

  function parseSellerTempUserId(rawValue) {
    const normalizedValue = normalizeText(rawValue);

    if (!normalizedValue) {
      return '';
    }

    const encodedPayload = normalizedValue.replace(/^N_/, '').replace(/-/g, '+').replace(/_/g, '/');

    try {
      const decodedText = Buffer.from(encodedPayload, 'base64').toString('utf8');
      const payload = JSON.parse(decodedText);
      return normalizeText(
        payload && (
          payload.u
          || payload.userId
          || payload.accountId
        )
      );
    } catch (_error) {
      return '';
    }
  }

  function readSellerUserIdFromCookies(cookies, fallbackValue) {
    const sellerTempUserId = parseSellerTempUserId(findCookieValue(cookies, 'seller_temp'));
    return sellerTempUserId || normalizeText(fallbackValue);
  }

  function resolveTargetMallRecord(sessionContext, shopSummary, malls) {
    const normalizedMalls = normalizeMallRecords(malls);
    const preferredMallUniqueId = normalizeText(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.mallUniqueId
    );
    const preferredMallId = normalizeText(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.mallId
    );

    if (preferredMallUniqueId) {
      const matchedMall = normalizedMalls.find((mall) => normalizeText(mall && mall.uniqueId) === preferredMallUniqueId);

      if (matchedMall) {
        return matchedMall;
      }
    }

    if (preferredMallId) {
      const matchedMall = normalizedMalls.find((mall) => normalizeText(mall && mall.mallId) === preferredMallId);

      if (matchedMall) {
        return matchedMall;
      }
    }

    const targetShopName = normalizeShopMatchText(
      shopSummary && shopSummary.shopName
      || sessionContext && sessionContext.shopName
    );

    if (targetShopName) {
      const scoredMalls = normalizedMalls
        .map((mall) => {
          const mallName = normalizeShopMatchText(mall && mall.mallName);
          let score = 0;

          if (!mallName) {
            return {
              mall,
              score
            };
          }

          if (mallName === targetShopName) {
            score = 4;
          } else if (mallName.includes(targetShopName) || targetShopName.includes(mallName)) {
            score = 3;
          } else if (
            mallName.replace(/[()（）\[\]\-_.]/g, '') === targetShopName.replace(/[()（）\[\]\-_.]/g, '')
          ) {
            score = 2;
          }

          return {
            mall,
            score
          };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score);

      if (scoredMalls.length > 0) {
        if (scoredMalls.length === 1 || scoredMalls[0].score > scoredMalls[1].score) {
          return scoredMalls[0].mall;
        }
      }
    }

    return normalizedMalls.length === 1 ? normalizedMalls[0] : null;
  }

  function applyKnownPlatformShopIdToSessionContext(sessionContext, shopSummary) {
    const knownMallId = normalizeText(shopSummary && shopSummary.platformShopId);
    const knownMallUniqueId = normalizeText(shopSummary && shopSummary.platformShopUniqueId);

    if ((!knownMallId && !knownMallUniqueId) || !sessionContext || typeof sessionContext !== 'object') {
      return sessionContext;
    }

    if (knownMallId && !normalizeText(sessionContext.mallId)) {
      sessionContext.mallId = knownMallId;
    }

    if (!sessionContext.sellerSession || typeof sessionContext.sellerSession !== 'object') {
      sessionContext.sellerSession = {};
    }

    if (knownMallId && !normalizeText(sessionContext.sellerSession.mallId)) {
      sessionContext.sellerSession.mallId = knownMallId;
    }

    if (knownMallUniqueId && !normalizeText(sessionContext.platformShopUniqueId)) {
      sessionContext.platformShopUniqueId = knownMallUniqueId;
    }

    if (knownMallUniqueId && !normalizeText(sessionContext.sellerSession.mallUniqueId)) {
      sessionContext.sellerSession.mallUniqueId = knownMallUniqueId;
    }

    return sessionContext;
  }

  function listSessionContextMallRecords(sessionContext) {
    const sellerSession =
      sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object'
        ? sessionContext.sellerSession
        : {};
    const sessionMalls = Array.isArray(sellerSession.malls)
      ? sellerSession.malls
      : [];
    const directMallRecord = {
      mallId: normalizeText(sellerSession.mallId),
      mallName: normalizeText(sellerSession.mallName),
      uniqueId: normalizeText(sellerSession.mallUniqueId)
    };
    const mergedRecords = normalizeMallRecords(
      sessionMalls.concat(
        directMallRecord.mallId || directMallRecord.mallName || directMallRecord.uniqueId
          ? [directMallRecord]
          : []
      )
    );
    const dedupedRecords = [];
    const seenKeys = new Set();

    mergedRecords.forEach((mall) => {
      const mallKey = [
        normalizeText(mall && mall.mallId),
        normalizeText(mall && mall.mallName),
        normalizeText(mall && mall.uniqueId)
      ].join('|');

      if (!mallKey || seenKeys.has(mallKey)) {
        return;
      }

      seenKeys.add(mallKey);
      dedupedRecords.push(mall);
    });

    return dedupedRecords;
  }

  function enrichSessionContextWithSellerAuthSnapshot(sessionContext, sellerAuthSnapshot) {
    if (!sessionContext || typeof sessionContext !== 'object') {
      return sessionContext;
    }

    const sellerSession =
      sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object'
        ? sessionContext.sellerSession
        : {};
    const snapshotMalls = normalizeMallRecords(
      sellerAuthSnapshot && Array.isArray(sellerAuthSnapshot.malls)
        ? sellerAuthSnapshot.malls
        : []
    );
    const mergedMalls = normalizeMallRecords(
      listSessionContextMallRecords({
        sellerSession
      }).concat(snapshotMalls)
    );

    sessionContext.sellerSession = {
      ...sellerSession,
      origin: normalizeOriginUrl(sellerAuthSnapshot && sellerAuthSnapshot.origin) || normalizeOriginUrl(sellerSession.origin),
      hostname: normalizeText(sellerAuthSnapshot && sellerAuthSnapshot.hostname) || normalizeText(sellerSession.hostname),
      status: normalizeText(sellerAuthSnapshot && sellerAuthSnapshot.status) || normalizeText(sellerSession.status),
      accountId: normalizeText(sellerAuthSnapshot && sellerAuthSnapshot.accountId) || normalizeText(sellerSession.accountId),
      malls: mergedMalls,
      mallNames: Array.from(new Set(
        mergedMalls
          .map((mall) => normalizeText(mall && mall.mallName))
          .concat(
            Array.isArray(sellerSession.mallNames)
              ? sellerSession.mallNames.map((mallName) => normalizeText(mallName))
              : []
          )
          .filter(Boolean)
      ))
    };

    return sessionContext;
  }

  async function readCookiesForOrigin(partition, origin, options = {}) {
    const normalizedPartition = normalizeText(partition);
    const normalizedOrigin = normalizeOriginUrl(origin);
    const targetSession = resolveShopScopedCookieSession(normalizedPartition, {
      ...options,
      origin: normalizedOrigin,
      requestUrl: `${normalizedOrigin}/`,
      message: '\u6d41\u91cf\u52a0\u901f Cookies \u8bfb\u53d6\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    });

    try {
      return await targetSession.cookies.get({
        url: `${normalizedOrigin}/`
      });
    } catch (error) {
      logError('operations_traffic_boost_cookie_read_failed', error, {
        partition: normalizedPartition,
        origin: normalizedOrigin
      });
      return [];
    }
  }

  async function captureCookieSnapshotForOrigin(sessionContext, origin, options = {}) {
    const partition = normalizeText(sessionContext && sessionContext.partition);
    const normalizedOrigin = normalizeOriginUrl(origin) || DEFAULT_SELLER_ORIGIN;
    const cookies = await readCookiesForOrigin(partition, normalizedOrigin, {
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      sessionContext
    });

    return {
      partition,
      cookieHeader: buildCookieHeader(cookies),
      mallId: readMallIdFromCookies(
        cookies,
        options.mallId
        || (
          sessionContext
          && sessionContext.sellerSession
          && sessionContext.sellerSession.mallId
        )
      ),
      sellerUserId: readSellerUserIdFromCookies(cookies, options.sellerUserId),
      capturedAt: nowIso(),
      origin: normalizedOrigin
    };
  }

  async function waitForRegionCookieSnapshot(sessionContext, origin, options = {}) {
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || REGION_COOKIE_READY_TIMEOUT_MS);
    const pollIntervalMs = Math.max(120, Number(options.pollIntervalMs) || REGION_COOKIE_READY_POLL_MS);
    const deadline = Date.now() + timeoutMs;
    let lastSnapshot = null;

    while (Date.now() < deadline) {
      assertQueryJobActive(options.queryJob || null);

      lastSnapshot = await captureCookieSnapshotForOrigin(sessionContext, origin, options);

      if (normalizeText(lastSnapshot && lastSnapshot.cookieHeader)) {
        return lastSnapshot;
      }

      await createCancelableDelay(options.queryJob || null, pollIntervalMs);
    }

    return lastSnapshot || await captureCookieSnapshotForOrigin(sessionContext, origin, options);
  }

  async function verifyRegionCookieSnapshot(sessionContext, shopSummary, marketRegion, cookieSnapshot, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const origin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;
    const requestUrl = `${origin}${SELLER_AUTH_USER_INFO_PATH}`;
    const requestPath = SELLER_AUTH_USER_INFO_PATH;
    const normalizedPartition = normalizeText(cookieSnapshot && cookieSnapshot.partition)
      || normalizeText(sessionContext && sessionContext.partition);
    const targetSession = resolveShopScopedFetchSession(normalizedPartition, {
      shopSummary,
      sessionContext,
      origin,
      requestUrl,
      message: '\u6d41\u91cf\u52a0\u901f\u533a\u57df\u4f1a\u8bdd\u9a8c\u8bc1\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    });
    const headers = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      cookie: normalizeText(cookieSnapshot && cookieSnapshot.cookieHeader),
      origin,
      referer: `${origin}/`,
      'x-requested-with': 'XMLHttpRequest'
    };

    if (normalizeText(cookieSnapshot && cookieSnapshot.mallId)) {
      headers.Mallid = normalizeText(cookieSnapshot.mallId);
    }

    const response = await executeFetchWithTimeout(
      targetSession,
      requestUrl,
      {
        method: 'POST',
        headers,
        body: '{}',
        cache: 'no-store',
        credentials: 'omit'
      },
      {
        queryJob: options.queryJob,
        shopSummary,
        sessionContext,
        progressContext: options.progressContext || null,
        emitProgress: typeof options.emitProgress === 'function' ? options.emitProgress : null,
        requestLabel: '\u9a8c\u8bc1\u76ee\u6807\u533a\u57df\u4f1a\u8bdd',
        requestPath,
        timeoutMs: REGION_COOKIE_VERIFY_TIMEOUT_MS,
        timeoutMessage: '\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u9a8c\u8bc1\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
      }
    );
    const responseText = await response.text();
    const parsedPayload = parseSellerAuthProfileResponse(response, responseText);
    const matchedMall = resolveTargetMallRecord(sessionContext, shopSummary, parsedPayload.malls);
    const verified = parsedPayload.ok === true && Boolean(matchedMall && normalizeText(matchedMall.uniqueId));

    emitQueryRequestProgress(options.progressContext || null, {
      phase: verified ? 'request-completed' : 'request-failed',
      traceType: verified ? 'request-completed' : (parsedPayload.authRequired === true ? 'request-auth-required' : 'request-failed'),
      requestLabel: '\u9a8c\u8bc1\u76ee\u6807\u533a\u57df\u4f1a\u8bdd',
      requestPath,
      requestUrl,
      requestMethod: 'POST',
      requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
      httpStatus: Number(response && response.status) || 0,
      errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
      success: verified,
      authRequired: parsedPayload.authRequired === true,
      responseTextPreview: normalizeText(responseText),
      message: verified
        ? '\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u5df2\u9a8c\u8bc1\u53ef\u7528\u3002'
        : (
          normalizeText(parsedPayload && parsedPayload.message)
          || '\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u9a8c\u8bc1\u5931\u8d25\u3002'
        )
    }, typeof options.emitProgress === 'function' ? options.emitProgress : null);

    log(verified ? 'operations_traffic_boost_region_cookie_verified' : 'operations_traffic_boost_region_cookie_verify_failed', {
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      marketRegion: normalizedRegion,
      partition: normalizedPartition,
      origin,
      httpStatus: Number(response && response.status) || 0,
      errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
      authRequired: parsedPayload.authRequired === true,
      mallCount: Array.isArray(parsedPayload && parsedPayload.malls) ? parsedPayload.malls.length : 0,
      matchedMallId: normalizeText(matchedMall && matchedMall.mallId),
      message: normalizeText(parsedPayload && parsedPayload.message)
    });

    if (!verified) {
      throw new Error(
        normalizeText(parsedPayload && parsedPayload.message)
        || (
          parsedPayload.authRequired === true
            ? '\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u5df2\u5931\u6548\uff0c\u8bf7\u5148\u786e\u8ba4\u5e97\u94fa\u5df2\u767b\u5f55\u540e\u518d\u91cd\u8bd5\u3002'
            : '\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u672a\u80fd\u5339\u914d\u5f53\u524d\u5e97\u94fa\uff0c\u8bf7\u786e\u8ba4\u5e97\u94fa\u4e0e\u5e02\u573a\u533a\u57df\u540e\u91cd\u8bd5\u3002'
        )
      );
    }

    return {
      ok: true,
      parsedPayload,
      matchedMall
    };
  }

  function parseSellerAuthProfileResponse(response, responseText) {
    const parsedPayload = parseApiPayload(response, responseText);
    const result = parsedPayload && parsedPayload.data && parsedPayload.data.result
      && typeof parsedPayload.data.result === 'object'
      ? parsedPayload.data.result
      : null;

    return {
      ...parsedPayload,
      accountId: normalizeText(result && result.accountId),
      malls: normalizeMallRecords(result && result.mallList)
    };
  }

  function buildSellerAuthProfileFromSessionContext(sessionContext, shopSummary, options = {}) {
    const sessionMalls = listSessionContextMallRecords(sessionContext);
    const matchedMall = resolveTargetMallRecord(sessionContext, shopSummary, sessionMalls);
    const sellerUserId = normalizeText(
      options.sellerUserId
      || (
        options.globalCookieSnapshot
        && options.globalCookieSnapshot.sellerUserId
      )
      || (
        sessionContext
        && sessionContext.sellerSession
        && sessionContext.sellerSession.accountId
      )
    );

    if (!matchedMall || !normalizeText(matchedMall.uniqueId) || !sellerUserId) {
      return null;
    }

    return {
      accountId: normalizeText(
        sessionContext
        && sessionContext.sellerSession
        && sessionContext.sellerSession.accountId
      ),
      sellerUserId,
      matchedMall,
      malls: sessionMalls,
      globalCookieSnapshot: options.globalCookieSnapshot || null
    };
  }

  async function fetchSellerAuthProfile(sessionContext, shopSummary, options = {}) {
    const queryJob = options.queryJob || null;
    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    let workingSessionContext = sessionContext;
    let globalCookieSnapshot = options.globalCookieSnapshot || await captureCookieSnapshotForOrigin(
      workingSessionContext,
      DEFAULT_SELLER_ORIGIN
    );
    let lastFailureMessage = '';
    let lastCandidateOrigins = [];

    for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
      const cachedProfile = buildSellerAuthProfileFromSessionContext(workingSessionContext, shopSummary, {
        globalCookieSnapshot
      });

      if (cachedProfile) {
        await persistResolvedPlatformShopIdentity(shopSummary, cachedProfile.matchedMall);
        log('operations_traffic_boost_seller_auth_profile_reused', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          source: attemptIndex > 0 ? 'session-context-refreshed' : 'session-context',
          mallId: normalizeText(
            cachedProfile
            && cachedProfile.matchedMall
            && cachedProfile.matchedMall.mallId
          )
        });
        return cachedProfile;
      }

      const partition = normalizeText(workingSessionContext && workingSessionContext.partition);
      const normalizedPartition = normalizeText(partition);
      const candidateOrigins = Array.from(new Set(
        [
          normalizeOriginUrl(
            workingSessionContext
            && workingSessionContext.sellerSession
            && workingSessionContext.sellerSession.origin
          ),
          DEFAULT_SELLER_ORIGIN
        ].filter(Boolean)
      ));
      let authRequiredDetected = false;

      lastCandidateOrigins = candidateOrigins.slice();

      for (const origin of candidateOrigins) {
        const requestUrl = `${origin}${SELLER_AUTH_USER_INFO_PATH}`;
        const requestPath = SELLER_AUTH_USER_INFO_PATH;
        const targetSession = resolveShopScopedFetchSession(normalizedPartition, {
          shopSummary,
          sessionContext: workingSessionContext,
          origin,
          requestUrl,
          message: '\u6d41\u91cf\u52a0\u901f\u5356\u5bb6\u4f1a\u8bdd\u68c0\u67e5\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
        });
        const response = await executeFetchWithTimeout(
          targetSession,
          requestUrl,
          {
            method: 'POST',
            headers: {
              accept: 'application/json, text/plain, */*',
              'content-type': 'application/json;charset=UTF-8',
              origin,
              referer: `${origin}/`,
              'x-requested-with': 'XMLHttpRequest'
            },
            body: '{}',
            cache: 'no-store',
            credentials: 'include'
          },
          {
            queryJob,
            shopSummary,
            sessionContext: workingSessionContext,
            progressContext,
            emitProgress: progressEmitter,
            requestLabel: '\u83b7\u53d6\u5356\u5bb6\u4f1a\u8bdd\u4fe1\u606f',
            requestPath,
            timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
            timeoutMessage: '\u5356\u5bb6\u4f1a\u8bdd\u68c0\u67e5\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
          }
        );
        const responseText = await response.text();
        const parsedPayload = parseSellerAuthProfileResponse(response, responseText);
        const matchedMall = resolveTargetMallRecord(workingSessionContext, shopSummary, parsedPayload.malls);
        const sellerUserId = normalizeText(parsedPayload.accountId) || normalizeText(globalCookieSnapshot.sellerUserId);

        if (parsedPayload.authRequired === true) {
          authRequiredDetected = true;
        }

        emitQueryRequestProgress(progressContext, {
          phase: parsedPayload.ok === true ? 'request-completed' : 'request-failed',
          traceType: parsedPayload.ok === true
            ? 'request-completed'
            : (parsedPayload.authRequired === true ? 'request-auth-required' : 'request-failed'),
          requestLabel: '\u83b7\u53d6\u5356\u5bb6\u4f1a\u8bdd\u4fe1\u606f',
          requestPath,
          requestUrl,
          requestMethod: 'POST',
          requestTransport: response && response.requestTransport ? response.requestTransport : 'session.fetch',
          httpStatus: Number(response && response.status) || 0,
          errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
          success: parsedPayload.ok === true,
          authRequired: parsedPayload.authRequired === true,
          responseTextPreview: normalizeText(responseText),
          message: normalizeText(parsedPayload.message) || (
            parsedPayload.ok === true
              ? '\u5df2\u83b7\u53d6\u5356\u5bb6\u4f1a\u8bdd\u4fe1\u606f\u3002'
              : (
                parsedPayload.authRequired === true
                  ? '\u5356\u5bb6\u4f1a\u8bdd\u5df2\u5931\u6548\uff0c\u6b63\u5728\u51c6\u5907\u5237\u65b0\u540e\u91cd\u8bd5\u3002'
                  : '\u5356\u5bb6\u4f1a\u8bdd\u4fe1\u606f\u83b7\u53d6\u5931\u8d25\u3002'
              )
          )
        }, progressEmitter);

        if (parsedPayload.ok !== true || parsedPayload.malls.length <= 0) {
          lastFailureMessage = normalizeText(parsedPayload.message)
            || '\u65e0\u6cd5\u8bfb\u53d6\u5356\u5bb6\u4f1a\u8bdd\u4e2d\u7684\u5e97\u94fa\u4fe1\u606f\uff0c\u8bf7\u5148\u786e\u8ba4\u5356\u5bb6\u4e2d\u5fc3\u767b\u5f55\u72b6\u6001\u3002';
          continue;
        }

        if (!matchedMall || !normalizeText(matchedMall.uniqueId)) {
          lastFailureMessage = '\u672a\u80fd\u5728\u5f53\u524d\u5356\u5bb6\u4f1a\u8bdd\u4e2d\u5339\u914d\u76ee\u6807\u5e97\u94fa\u7684 uniqueId\uff0c\u8bf7\u5148\u6253\u5f00\u5bf9\u5e94\u5e97\u94fa\u7684\u5356\u5bb6\u4e2d\u5fc3\u9875\u9762\u5e76\u786e\u8ba4\u767b\u5f55\u3002';
          continue;
        }

        if (!sellerUserId) {
          lastFailureMessage = '\u672a\u80fd\u8bfb\u53d6\u5356\u5bb6\u8d26\u53f7\u6807\u8bc6\uff0c\u65e0\u6cd5\u5b8c\u6210\u533a\u57df\u5207\u6362\u3002';
          continue;
        }

        log('operations_traffic_boost_seller_auth_profile_loaded', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          source: attemptIndex > 0 ? 'network-refreshed' : 'network',
          origin,
          mallId: normalizeText(matchedMall && matchedMall.mallId)
        });
        await persistResolvedPlatformShopIdentity(shopSummary, matchedMall);

        return {
          accountId: normalizeText(parsedPayload.accountId),
          sellerUserId,
          matchedMall,
          malls: parsedPayload.malls,
          globalCookieSnapshot
        };
      }

      if (authRequiredDetected !== true || attemptIndex > 0) {
        break;
      }

      workingSessionContext = await resolveSellerSessionContext(shopSummary, {
        timeoutMs: QUERY_REQUEST_TIMEOUT_MS
      });
      globalCookieSnapshot = await captureCookieSnapshotForOrigin(
        workingSessionContext,
        DEFAULT_SELLER_ORIGIN
      );
    }

    log('operations_traffic_boost_seller_auth_profile_failed', {
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      sessionOrigin: normalizeText(
        workingSessionContext
        && workingSessionContext.sellerSession
        && workingSessionContext.sellerSession.origin
      ),
      candidateOrigins: lastCandidateOrigins,
      knownMallId: normalizeText(shopSummary && shopSummary.platformShopId),
      knownMallUniqueId: normalizeText(shopSummary && shopSummary.platformShopUniqueId),
      sessionMallCount: listSessionContextMallRecords(workingSessionContext).length,
      lastFailureMessage
    });

    throw new Error(
      lastFailureMessage
      || '\u65e0\u6cd5\u8bfb\u53d6\u5356\u5bb6\u4f1a\u8bdd\u4e2d\u7684\u5e97\u94fa\u4fe1\u606f\uff0c\u8bf7\u5148\u786e\u8ba4\u5356\u5bb6\u4e2d\u5fc3\u767b\u5f55\u72b6\u6001\u3002'
    );
  }

  async function requestSellerRegionSwitchCode(sessionContext, marketRegion, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const sourceOrigin = normalizeOriginUrl(options.sourceOrigin) || resolveSellerOriginFromSessionContext(sessionContext);
    const sourceRegion = normalizeMarketRegion(options.sourceRegion || resolveMarketRegionFromOrigin(sourceOrigin));
    const targetDr = MARKET_DR_BY_REGION[normalizedRegion];
    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;

    if (!targetDr || sourceRegion === normalizedRegion) {
      throw new Error('\u5f53\u524d\u533a\u57df\u4e0d\u9700\u8981\u5207\u6362\u6216\u6682\u4e0d\u652f\u6301\u5207\u6362\u3002');
    }

    const browserContext = options.browserContext && isUsableBrowserView(options.browserContext.view)
      ? options.browserContext
      : await ensureSellerRegionSwitchBrowserContext(sessionContext, {
        shopSummary: options.shopSummary || null,
        marketRegion: normalizedRegion,
        sourceRegion,
        timeoutMs: options.timeoutMs
      });
    const view = browserContext.view;
    const sourceRedirectUrl = browserContext.sourceRedirectUrl || buildTrafficBoostRegionRedirectUrl(sourceRegion);
    const mallId = normalizeText(
      options.mallId
      || (
        sessionContext
        && sessionContext.sellerSession
        && sessionContext.sellerSession.mallId
      )
    );
    await navigateSellerRegionView(view, sourceRedirectUrl, {
      timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
      shopSummary: options.shopSummary || null
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 220);
    });
    const response = await executeSellerRegionContextRequest(
      view,
      {
        requestPath: SELLER_AUTH_OBTAIN_CODE_PATH,
        method: 'POST',
        referrer: sourceRedirectUrl,
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json;charset=UTF-8',
          ...(mallId ? { mallid: mallId } : {})
        },
        body: {
          redirectUrl:
            browserContext.targetAuthenticationRedirectUrl
            || buildSellerRegionAuthenticationRedirectUrl(normalizedRegion),
          targetDr
        }
        },
      {
        shopSummary: options.shopSummary || null,
        progressContext,
        emitProgress: progressEmitter,
        requestLabel: '\u83b7\u53d6\u5207\u533a\u6388\u6743\u7801',
        requestTransport: 'page.fetch'
      }
    );
    const code = normalizeText(
      response
      && response.data
      && response.data.result
      && response.data.result.code
    );

    if (response.ok !== true || !code) {
      log('operations_traffic_boost_region_switch_code_failed', {
        shopId: normalizeText(options.shopSummary && options.shopSummary.shopId),
        sourceRegion,
        targetRegion: normalizedRegion,
        sourceRedirectUrl,
        responseStatus: normalizeText(response && response.status),
        httpStatus: Number(response && response.httpStatus) || 0,
        errorCode: Number(response && response.errorCode) || 0,
        message: normalizeText(response && response.message),
        responseTextPreview: normalizeText(response && response.responseTextPreview)
      });
      throw new Error(
        normalizeText(response && response.message)
        || '\u5356\u5bb6\u533a\u57df\u5207\u6362\u6388\u6743\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
      );
    }

    return code;
  }

  function buildSellerRegionAuthenticationUrl(marketRegion, authProfile, code, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const targetOrigin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;
    const sourceRegion = normalizeMarketRegion(options.sourceRegion || 'global');
    const params = new URLSearchParams({
      cover: 'true',
      uId: normalizeText(authProfile && authProfile.sellerUserId),
      uniqueId: normalizeText(
        authProfile
        && authProfile.matchedMall
        && authProfile.matchedMall.uniqueId
      ),
      code: normalizeText(code),
      codeFromDr: String(MARKET_DR_BY_REGION[sourceRegion] || MARKET_DR_BY_REGION.global),
      redirectUrl: buildSellerRegionAuthenticationRedirectUrl(normalizedRegion)
    });

    return `${targetOrigin}/auth/authentication?${params.toString()}`;
  }

  function resolveSellerRegionLoginByCodeValue(authenticationResult, fallbackCode) {
    const obtainCode = normalizeText(fallbackCode);

    if (obtainCode) {
      return {
        code: obtainCode,
        source: 'obtain-code'
      };
    }

    const finalUrl = normalizeText(authenticationResult && authenticationResult.finalUrl);
    const parsedUrl = parseUrlOrNull(finalUrl);

    if (parsedUrl) {
      const asCode = normalizeText(parsedUrl.searchParams.get('asCode'));

      if (asCode) {
        return {
          code: asCode,
          source: 'authentication-final-url-asCode'
        };
      }

      const authCode = normalizeText(parsedUrl.searchParams.get('code'));

      if (authCode) {
        return {
          code: authCode,
          source: 'authentication-final-url-code'
        };
      }
    }

    return {
      code: '',
      source: 'missing'
    };
  }

  function buildSellerRegionLoginByCodeReferer(marketRegion, authProfile, code) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const targetOrigin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;
    const params = new URLSearchParams({
      redirectUrl: buildSellerRegionAuthenticationRedirectUrl(normalizedRegion, {
        trailingSlash: false
      }),
      uniqueId: normalizeText(
        authProfile
        && authProfile.matchedMall
        && authProfile.matchedMall.uniqueId
      )
    });
    const authCode = normalizeText(code);

    if (authCode) {
      params.set('asCode', authCode);
    }

    return `${targetOrigin}/auth/authentication?${params.toString()}`;
  }

  function shouldNavigateToSellerRegionLoginByCodePage(currentUrl, expectedUrl) {
    const normalizedCurrentUrl = normalizeText(currentUrl);
    const normalizedExpectedUrl = normalizeText(expectedUrl);

    if (!normalizedExpectedUrl) {
      return false;
    }

    if (!normalizedCurrentUrl) {
      return true;
    }

    const currentParsedUrl = parseUrlOrNull(normalizedCurrentUrl);
    const expectedParsedUrl = parseUrlOrNull(normalizedExpectedUrl);

    if (!currentParsedUrl || !expectedParsedUrl) {
      return normalizedCurrentUrl !== normalizedExpectedUrl;
    }

    const currentPathname = normalizeText(currentParsedUrl.pathname);
    const expectedPathname = normalizeText(expectedParsedUrl.pathname);
    const currentAsCode = normalizeText(currentParsedUrl.searchParams.get('asCode'));
    const expectedAsCode = normalizeText(expectedParsedUrl.searchParams.get('asCode'));
    const currentUniqueId = normalizeText(currentParsedUrl.searchParams.get('uniqueId'));
    const expectedUniqueId = normalizeText(expectedParsedUrl.searchParams.get('uniqueId'));
    const currentRedirectUrl = normalizeText(currentParsedUrl.searchParams.get('redirectUrl'));
    const expectedRedirectUrl = normalizeText(expectedParsedUrl.searchParams.get('redirectUrl'));

    return (
      normalizeOriginUrl(currentParsedUrl.origin) !== normalizeOriginUrl(expectedParsedUrl.origin)
      || currentPathname !== expectedPathname
      || currentAsCode !== expectedAsCode
      || currentUniqueId !== expectedUniqueId
      || currentRedirectUrl !== expectedRedirectUrl
    );
  }

  async function waitForSellerRegionAuthenticationAutoCompletion(view, options = {}) {
    if (!isUsableBrowserView(view)) {
      return {
        autoCompleted: false,
        finalUrl: '',
        reason: 'view-unavailable'
      };
    }

    const timeoutMs = Math.max(1200, Number(options.timeoutMs) || 8000);
    const pollIntervalMs = Math.max(120, Number(options.pollIntervalMs) || 220);
    const targetOrigin = normalizeOriginUrl(options.targetOrigin);
    const requestUrl = normalizeText(options.requestUrl);
    const deadline = Date.now() + timeoutMs;
    let lastUrl = normalizeText(view.webContents.getURL()) || requestUrl;

    while (Date.now() < deadline) {
      if (!isUsableBrowserView(view)) {
        break;
      }

      const currentUrl = normalizeText(view.webContents.getURL()) || lastUrl;
      const parsedCurrentUrl = parseUrlOrNull(currentUrl);
      const currentOrigin = normalizeOriginUrl(parsedCurrentUrl && parsedCurrentUrl.origin);
      const onAuthenticationPage = /\/auth\/authentication(?:[?#]|$)/i.test(currentUrl);

      if (currentUrl) {
        lastUrl = currentUrl;
      }

      if (
        currentUrl
        && currentOrigin === targetOrigin
        && !onAuthenticationPage
        && currentUrl !== requestUrl
      ) {
        return {
          autoCompleted: true,
          finalUrl: currentUrl,
          reason: 'left-authentication-page'
        };
      }

      await new Promise((resolve) => {
        setTimeout(resolve, pollIntervalMs);
      });
    }

    return {
      autoCompleted: false,
      finalUrl: lastUrl,
      reason: 'timeout'
    };
  }

  async function executeSellerRegionAuthentication(sessionContext, marketRegion, authProfile, code, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const sourceOrigin = normalizeOriginUrl(options.sourceOrigin) || resolveSellerOriginFromSessionContext(sessionContext);
    const sourceRegion = normalizeMarketRegion(options.sourceRegion || resolveMarketRegionFromOrigin(sourceOrigin));
    const browserContext = options.browserContext && isUsableBrowserView(options.browserContext.view)
      ? options.browserContext
      : await ensureSellerRegionSwitchBrowserContext(sessionContext, {
        shopSummary: options.shopSummary || null,
        marketRegion: normalizedRegion,
        sourceRegion,
        timeoutMs: options.timeoutMs
      });
    const requestUrl = buildSellerRegionAuthenticationUrl(normalizedRegion, authProfile, code, {
      sourceRegion
    });
    emitQueryRequestProgress(options.progressContext || null, {
      phase: 'requesting',
      traceType: 'request-start',
      requestLabel: '\u533a\u57df\u767b\u5f55\u9a8c\u8bc1',
      requestPath: '/auth/authentication',
      requestUrl,
      requestMethod: 'GET',
      requestTransport: 'page.navigate',
      message: '\u6b63\u5728\u6253\u5f00\u533a\u57df\u767b\u5f55\u9a8c\u8bc1\u9875\u3002',
      sourceOrigin,
      targetOrigin: MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN
    }, typeof options.emitProgress === 'function' ? options.emitProgress : null);
    const readyResult = await navigateSellerRegionView(browserContext.view, requestUrl, {
      timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
      httpReferrer: browserContext.sourceRedirectUrl || buildTrafficBoostRegionRedirectUrl(sourceRegion),
      shopSummary: options.shopSummary || null
    });
    let finalUrl = normalizeText(readyResult && readyResult.currentUrl)
      || normalizeText(browserContext.view.webContents.getURL());
    const targetOrigin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;
    let parsedFinalUrl = parseUrlOrNull(finalUrl);

    if (!finalUrl || normalizeOriginUrl(parsedFinalUrl && parsedFinalUrl.origin) !== targetOrigin) {
      log('operations_traffic_boost_region_authentication_failed', {
        shopId: normalizeText(options.shopSummary && options.shopSummary.shopId),
        marketRegion: normalizedRegion,
        sourceRegion,
        sourceOrigin,
        targetOrigin,
        requestUrl,
        currentUrl: finalUrl
      });
      emitQueryRequestProgress(options.progressContext || null, {
        phase: 'request-failed',
        traceType: 'request-failed',
        requestLabel: '\u533a\u57df\u767b\u5f55\u9a8c\u8bc1',
        requestPath: '/auth/authentication',
        requestUrl,
        requestMethod: 'GET',
        requestTransport: 'page.navigate',
        message: '\u533a\u57df\u767b\u5f55\u9a8c\u8bc1\u5931\u8d25\u3002',
        errorMessage: '\u8df3\u8f6c\u7ed3\u679c\u4e0e\u76ee\u6807\u533a\u57df\u4e0d\u4e00\u81f4\u3002',
        currentUrl: finalUrl,
        sourceOrigin,
        targetOrigin
      }, typeof options.emitProgress === 'function' ? options.emitProgress : null);
      throw new Error(
        '\u5356\u5bb6\u533a\u57df\u767b\u5f55\u540c\u6b65\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
      );
    }

    emitQueryRequestProgress(options.progressContext || null, {
      phase: 'requesting',
      traceType: 'request-start',
      requestLabel: '\u7b49\u5f85\u533a\u57df\u767b\u5f55\u81ea\u52a8\u5b8c\u6210',
      requestPath: '/auth/authentication',
      requestUrl,
      requestMethod: 'GET',
      requestTransport: 'page.navigate',
      message: '\u8ba4\u8bc1\u9875\u5df2\u6253\u5f00\uff0c\u6b63\u5728\u7b49\u5f85\u5b83\u81ea\u52a8\u5b8c\u6210\u533a\u57df\u767b\u5f55\u3002',
      sourceOrigin,
      targetOrigin,
      currentUrl: finalUrl
    }, typeof options.emitProgress === 'function' ? options.emitProgress : null);

    const autoCompletionResult = await waitForSellerRegionAuthenticationAutoCompletion(
      browserContext.view,
      {
        timeoutMs: 9000,
        targetOrigin,
        requestUrl
      }
    );
    const autoLoginCompleted = autoCompletionResult.autoCompleted === true;

    finalUrl = normalizeText(autoCompletionResult && autoCompletionResult.finalUrl) || finalUrl;
    parsedFinalUrl = parseUrlOrNull(finalUrl);

    emitQueryRequestProgress(options.progressContext || null, {
      phase: 'request-completed',
      traceType: 'request-completed',
      requestLabel: '\u533a\u57df\u767b\u5f55\u9a8c\u8bc1',
      requestPath: '/auth/authentication',
      requestUrl,
      requestMethod: 'GET',
      requestTransport: 'page.navigate',
      httpStatus: 200,
      success: true,
      message: autoLoginCompleted
        ? '\u533a\u57df\u767b\u5f55\u9a8c\u8bc1\u5b8c\u6210\uff0c\u8ba4\u8bc1\u9875\u5df2\u81ea\u52a8\u5237\u65b0\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u3002'
        : '\u533a\u57df\u767b\u5f55\u9a8c\u8bc1\u9875\u5df2\u6253\u5f00\uff0c\u672a\u89c2\u5bdf\u5230\u81ea\u52a8\u5b8c\u6210\uff0c\u5c06\u7ee7\u7eed\u68c0\u67e5\u6216\u4f7f\u7528\u517c\u5bb9\u515c\u5e95\u3002',
      sourceOrigin,
      targetOrigin,
      finalUrl,
      autoLoginCompleted
    }, typeof options.emitProgress === 'function' ? options.emitProgress : null);

    log('operations_traffic_boost_region_authentication_completed', {
      shopId: normalizeText(options.shopSummary && options.shopSummary.shopId),
      marketRegion: normalizedRegion,
      sourceRegion,
      sourceOrigin,
      targetOrigin,
      requestUrl,
      currentUrl: finalUrl,
      autoLoginCompleted,
      autoCompletionReason: normalizeText(autoCompletionResult && autoCompletionResult.reason)
    });

    return {
      ok: true,
      status: 200,
      httpStatus: 200,
      finalUrl,
      requestUrl,
      responseTextPreview: '',
      message: '',
      data: null,
      autoLoginCompleted
    };
  }

  async function executeSellerRegionLoginByCode(sessionContext, marketRegion, authProfile, code, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const loginCode = normalizeText(code);
    const targetUniqueId = normalizeText(
      authProfile
      && authProfile.matchedMall
      && authProfile.matchedMall.uniqueId
    );

    if (!loginCode || !targetUniqueId) {
      throw new Error('\u533a\u57df\u767b\u5f55\u786e\u8ba4\u7f3a\u5c11\u6388\u6743 code \u6216 uniqueId\uff0c\u65e0\u6cd5\u5237\u65b0\u76ee\u6807\u533a\u57df\u4f1a\u8bdd\u3002');
    }

    const browserContext = options.browserContext && isUsableBrowserView(options.browserContext.view)
      ? options.browserContext
      : await ensureSellerRegionSwitchBrowserContext(sessionContext, {
        shopSummary: options.shopSummary || null,
        marketRegion: normalizedRegion,
        sourceRegion: options.sourceRegion,
        timeoutMs: options.timeoutMs
      });
    const targetView = browserContext.view;
    let currentAuthUrl = normalizeText(
      options.referer
      || (isUsableBrowserView(targetView) ? targetView.webContents.getURL() : '')
    );
    const referer = buildSellerRegionLoginByCodeReferer(normalizedRegion, authProfile, loginCode);

    if (shouldNavigateToSellerRegionLoginByCodePage(currentAuthUrl, referer)) {
      emitQueryRequestProgress(options.progressContext || null, {
        phase: 'requesting',
        traceType: 'request-start',
        requestLabel: '\u51c6\u5907\u533a\u57df\u767b\u5f55\u786e\u8ba4\u9875',
        requestPath: '/auth/authentication',
        requestUrl: referer,
        requestMethod: 'GET',
        requestTransport: 'page.navigate',
        message: '\u6b63\u5728\u51c6\u5907\u533a\u57df\u767b\u5f55\u786e\u8ba4\u9875\u3002',
        currentUrl: currentAuthUrl,
        targetOrigin: MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN
      }, typeof options.emitProgress === 'function' ? options.emitProgress : null);

      const readyResult = await navigateSellerRegionView(targetView, referer, {
        timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
        httpReferrer: currentAuthUrl
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 220);
      });

      currentAuthUrl = normalizeText(readyResult && readyResult.currentUrl)
        || normalizeText(targetView.webContents.getURL());

      emitQueryRequestProgress(options.progressContext || null, {
        phase: 'request-completed',
        traceType: 'request-completed',
        requestLabel: '\u51c6\u5907\u533a\u57df\u767b\u5f55\u786e\u8ba4\u9875',
        requestPath: '/auth/authentication',
        requestUrl: referer,
        requestMethod: 'GET',
        requestTransport: 'page.navigate',
        httpStatus: 200,
        success: true,
        message: '\u533a\u57df\u767b\u5f55\u786e\u8ba4\u9875\u5df2\u5c31\u7eea\u3002',
        currentUrl: currentAuthUrl,
        targetOrigin: MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN
      }, typeof options.emitProgress === 'function' ? options.emitProgress : null);
    }

    const response = await executeSellerRegionContextRequest(
      targetView,
      {
        requestPath: SELLER_AUTH_LOGIN_BY_CODE_PATH,
        method: 'POST',
        referrer: referer,
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json;charset=UTF-8'
        },
        body: {
          code: loginCode,
          confirm: false,
          targetUniqueId
        }
      },
      {
        shopSummary: options.shopSummary || null,
        progressContext: options.progressContext || null,
        emitProgress: typeof options.emitProgress === 'function' ? options.emitProgress : null,
        requestLabel: '\u786e\u8ba4\u533a\u57df\u767b\u5f55',
        requestTransport: 'page.fetch'
      }
    );

    if (response.ok !== true) {
      log('operations_traffic_boost_region_login_by_code_failed', {
        shopId: normalizeText(options.shopSummary && options.shopSummary.shopId),
        marketRegion: normalizedRegion,
        loginRequestUrl: `${MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN}${SELLER_AUTH_LOGIN_BY_CODE_PATH}`,
        currentAuthUrl,
        httpStatus: Number(response && response.httpStatus) || 0,
        errorCode: Number(response && response.errorCode) || 0,
        message: normalizeText(response && response.message),
        responseTextPreview: normalizeText(response && response.responseTextPreview)
      });
      throw new Error(
        normalizeText(response && response.message)
        || '\u5356\u5bb6\u533a\u57df\u767b\u5f55\u786e\u8ba4\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
      );
    }

    log('operations_traffic_boost_region_login_by_code_completed', {
      shopId: normalizeText(options.shopSummary && options.shopSummary.shopId),
      marketRegion: normalizedRegion,
      currentAuthUrl,
      finalUrl: normalizeText(response && response.finalUrl) || normalizeText(targetView.webContents.getURL())
    });

    return {
      ...response,
      finalUrl: normalizeText(response && response.finalUrl) || normalizeText(targetView.webContents.getURL()),
      referer,
      loginCode
    };
  }

  async function refreshRegionCookieSnapshot(shopSummary, marketRegion, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const cacheEntry = getShopCookieCacheEntry(shopSummary && shopSummary.shopId);
    let sessionContext = options.sessionContext;

    if (!sessionContext || options.forceRefresh === true) {
      sessionContext = await resolveSellerSessionContext(shopSummary, {
        timeoutMs: options.timeoutMs
      });
    }
    const progressContext = options.progressContext || {
      owner: ensureOwnerScope(),
      runId: normalizeText(options.runId) || normalizeText(options.queryJob && options.queryJob.runId),
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName)
    };
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const currentOrigin = resolveSellerOriginFromSessionContext(sessionContext);
    const currentRegion = resolveSellerSessionRegion(sessionContext);
    const currentCookieSnapshot = await captureCookieSnapshotForOrigin(
      sessionContext,
      currentOrigin,
      {
        mallId: normalizeText(
          shopSummary && shopSummary.platformShopId
        ) || normalizeText(
          sessionContext
          && sessionContext.sellerSession
          && sessionContext.sellerSession.mallId
        )
      }
    );

    if (cacheEntry && normalizedRegion !== currentRegion && normalizeText(currentCookieSnapshot && currentCookieSnapshot.cookieHeader)) {
      cacheEntry.byRegion[currentRegion] = currentCookieSnapshot;
    }

    const targetOrigin = MARKET_ORIGIN_BY_REGION[normalizedRegion] || DEFAULT_SELLER_ORIGIN;
    const targetCookieSnapshot = await captureCookieSnapshotForOrigin(
      sessionContext,
      targetOrigin,
      {
        mallId: normalizeText(
          shopSummary && shopSummary.platformShopId
        ) || normalizeText(
          sessionContext
          && sessionContext.sellerSession
          && sessionContext.sellerSession.mallId
        ),
        sellerUserId: normalizeText(currentCookieSnapshot && currentCookieSnapshot.sellerUserId)
      }
    );

    if (normalizeText(targetCookieSnapshot && targetCookieSnapshot.cookieHeader)) {
      try {
        await verifyRegionCookieSnapshot(sessionContext, shopSummary, normalizedRegion, targetCookieSnapshot, {
          queryJob: options.queryJob,
          progressContext,
          emitProgress: progressEmitter
        });

        if (cacheEntry) {
          cacheEntry.byRegion[normalizedRegion] = targetCookieSnapshot;
        }

        log('operations_traffic_boost_region_cookie_refreshed', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          marketRegion: normalizedRegion,
          source: options.forceRefresh === true ? 'target-origin-cookie-refreshed' : 'target-origin-cookie'
        });

        return targetCookieSnapshot;
      } catch (error) {
        if (isQueryCanceledError(error)) {
          throw error;
        }

        logError('operations_traffic_boost_target_origin_cookie_verify_failed', error, {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          marketRegion: normalizedRegion,
          source: options.forceRefresh === true ? 'target-origin-cookie-refreshed' : 'target-origin-cookie'
        });
      }
    }

    if (!normalizeText(currentCookieSnapshot && currentCookieSnapshot.cookieHeader)) {
      throw new Error('\u672a\u80fd\u8bfb\u53d6\u5230\u5f53\u524d\u5356\u5bb6\u4f1a\u8bdd Cookies\uff0c\u8bf7\u5148\u786e\u8ba4\u5bf9\u5e94\u5e97\u94fa\u5df2\u767b\u5f55\u3002');
    }

    if (normalizedRegion === currentRegion) {
      const verifyCurrentRegionSnapshot = async (snapshot, source) => {
        await verifyRegionCookieSnapshot(sessionContext, shopSummary, normalizedRegion, snapshot, {
          queryJob: options.queryJob,
          progressContext,
          emitProgress: progressEmitter
        });

        if (cacheEntry) {
          cacheEntry.byRegion[normalizedRegion] = snapshot;
        }

        log('operations_traffic_boost_region_cookie_refreshed', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          marketRegion: normalizedRegion,
          source
        });

        return snapshot;
      };

      try {
        return await verifyCurrentRegionSnapshot(
          currentCookieSnapshot,
          options.forceRefresh === true ? 'browser-current-region-refreshed' : 'browser-current-region'
        );
      } catch (error) {
        if (isQueryCanceledError(error)) {
          throw error;
        }

        logError('operations_traffic_boost_current_region_cookie_verify_failed', error, {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          marketRegion: normalizedRegion,
          source: options.forceRefresh === true ? 'browser-current-region-refreshed' : 'browser-current-region'
        });

        const browserContext = await ensureSellerRegionSwitchBrowserContext(sessionContext, {
          shopSummary,
          marketRegion: normalizedRegion,
          sourceRegion: currentRegion,
          timeoutMs: options.queryJob ? QUERY_REQUEST_TIMEOUT_MS : options.timeoutMs
        });
        const targetRedirectUrl = browserContext.targetRedirectUrl || buildTrafficBoostRegionRedirectUrl(normalizedRegion);

        await navigateSellerRegionView(browserContext.view, targetRedirectUrl, {
          timeoutMs: options.queryJob ? QUERY_REQUEST_TIMEOUT_MS : options.timeoutMs,
          shopSummary
        });

        const refreshedSnapshot = await waitForRegionCookieSnapshot(
          sessionContext,
          MARKET_ORIGIN_BY_REGION[normalizedRegion],
          {
            mallId: normalizeText(
              shopSummary && shopSummary.platformShopId
            ) || normalizeText(
              sessionContext
              && sessionContext.sellerSession
              && sessionContext.sellerSession.mallId
            ),
            sellerUserId: normalizeText(currentCookieSnapshot && currentCookieSnapshot.sellerUserId),
            queryJob: options.queryJob
          }
        );

        if (!refreshedSnapshot.cookieHeader) {
          throw new Error('\u533a\u57df Cookies \u5237\u65b0\u540e\u672a\u8bfb\u53d6\u5230\u76ee\u6807\u57df\u767b\u5f55\u4f1a\u8bdd\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
        }

        return verifyCurrentRegionSnapshot(refreshedSnapshot, 'browser-current-region-page-refreshed');
      }
    }

    const authProfile = await fetchSellerAuthProfile(sessionContext, shopSummary, {
      queryJob: options.queryJob,
      globalCookieSnapshot: currentCookieSnapshot,
      sellerUserId: normalizeText(currentCookieSnapshot && currentCookieSnapshot.sellerUserId),
      progressContext,
      emitProgress: progressEmitter
    });
    const browserContext = await ensureSellerRegionSwitchBrowserContext(sessionContext, {
      shopSummary,
      marketRegion: normalizedRegion,
      sourceRegion: currentRegion,
      timeoutMs: options.queryJob ? QUERY_REQUEST_TIMEOUT_MS : options.timeoutMs
    });
    const code = await requestSellerRegionSwitchCode(sessionContext, normalizedRegion, {
      mallId: normalizeText(authProfile && authProfile.matchedMall && authProfile.matchedMall.mallId),
      sourceOrigin: currentOrigin,
      sourceRegion: currentRegion,
      browserContext,
      shopSummary,
      queryJob: options.queryJob,
      progressContext,
      emitProgress: progressEmitter
    });

    const authenticationResult = await executeSellerRegionAuthentication(sessionContext, normalizedRegion, authProfile, code, {
      sourceOrigin: currentOrigin,
      sourceRegion: currentRegion,
      browserContext,
      shopSummary,
      queryJob: options.queryJob,
      progressContext,
      emitProgress: progressEmitter
    });
    const loginByCodeInfo = resolveSellerRegionLoginByCodeValue(authenticationResult, code);

    log('operations_traffic_boost_region_authentication_completed', {
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      marketRegion: normalizedRegion,
      finalUrl: normalizeText(authenticationResult && authenticationResult.finalUrl),
      autoLoginCompleted: Boolean(authenticationResult && authenticationResult.autoLoginCompleted),
      loginCodeSource: normalizeText(loginByCodeInfo && loginByCodeInfo.source),
      hasLoginCode: Boolean(normalizeText(loginByCodeInfo && loginByCodeInfo.code))
    });

    if (authenticationResult && authenticationResult.autoLoginCompleted === true) {
      log('operations_traffic_boost_region_login_by_code_skipped', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        marketRegion: normalizedRegion,
        reason: 'authentication-page-auto-completed'
      });
    } else {
      await executeSellerRegionLoginByCode(sessionContext, normalizedRegion, authProfile, loginByCodeInfo.code, {
        referer: normalizeText(authenticationResult && authenticationResult.finalUrl),
        browserContext,
        shopSummary,
        queryJob: options.queryJob,
        progressContext,
        emitProgress: progressEmitter
      });

      log('operations_traffic_boost_region_login_by_code_completed', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        marketRegion: normalizedRegion,
        loginCodeSource: normalizeText(loginByCodeInfo && loginByCodeInfo.source)
      });
    }

    const captureVerifiedRegionCookieSnapshot = async () => {
      const snapshot = await waitForRegionCookieSnapshot(
        sessionContext,
        MARKET_ORIGIN_BY_REGION[normalizedRegion],
        {
          mallId: normalizeText(authProfile && authProfile.matchedMall && authProfile.matchedMall.mallId),
          sellerUserId: normalizeText(authProfile && authProfile.sellerUserId),
          queryJob: options.queryJob
        }
      );

      if (!snapshot.cookieHeader) {
        throw new Error('\u533a\u57df Cookies \u5237\u65b0\u540e\u672a\u8bfb\u53d6\u5230\u76ee\u6807\u57df\u767b\u5f55\u4f1a\u8bdd\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
      }

      await verifyRegionCookieSnapshot(sessionContext, shopSummary, normalizedRegion, snapshot, {
        queryJob: options.queryJob,
        progressContext,
        emitProgress: progressEmitter
      });

      return snapshot;
    };
    let regionCookieSnapshot;

    try {
      regionCookieSnapshot = await captureVerifiedRegionCookieSnapshot();
    } catch (error) {
      if (
        isQueryCanceledError(error)
        || !(authenticationResult && authenticationResult.autoLoginCompleted === true)
        || !normalizeText(loginByCodeInfo && loginByCodeInfo.code)
      ) {
        throw error;
      }

      log('operations_traffic_boost_region_login_by_code_fallback', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        marketRegion: normalizedRegion,
        reason: 'auto-completed-cookie-verify-failed',
        errorMessage: normalizeText(error && error.message)
      });

      await executeSellerRegionLoginByCode(sessionContext, normalizedRegion, authProfile, loginByCodeInfo.code, {
        referer: normalizeText(authenticationResult && authenticationResult.finalUrl),
        browserContext,
        shopSummary,
        queryJob: options.queryJob,
        progressContext,
        emitProgress: progressEmitter
      });

      regionCookieSnapshot = await captureVerifiedRegionCookieSnapshot();
    }

    if (cacheEntry) {
      cacheEntry.byRegion[normalizedRegion] = regionCookieSnapshot;
    }

    log('operations_traffic_boost_region_cookie_refreshed', {
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      marketRegion: normalizedRegion,
      source: 'browser-refresh'
    });

    return regionCookieSnapshot;
  }

  async function ensureRegionCookieSnapshot(shopSummary, marketRegion, options = {}) {
    const cacheEntry = getShopCookieCacheEntry(shopSummary && shopSummary.shopId);
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const cachedSnapshot = cacheEntry && cacheEntry.byRegion
      ? cacheEntry.byRegion[normalizedRegion]
      : null;

    if (cachedSnapshot && options.forceRefresh !== true) {
      try {
        const sessionContext = options.sessionContext || await resolveSellerSessionContext(shopSummary, {
          timeoutMs: options.timeoutMs
        });

        await verifyRegionCookieSnapshot(sessionContext, shopSummary, normalizedRegion, cachedSnapshot, {
          queryJob: options.queryJob,
          progressContext: options.progressContext || null,
          emitProgress: typeof options.emitProgress === 'function' ? options.emitProgress : null
        });

        log('operations_traffic_boost_region_cookie_cache_hit', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          marketRegion: normalizedRegion,
          source: 'cache-verified'
        });
        return cachedSnapshot;
      } catch (error) {
        if (isQueryCanceledError(error)) {
          throw error;
        }

        logError('operations_traffic_boost_region_cookie_cache_invalid', error, {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          marketRegion: normalizedRegion
        });
        invalidateRegionCookieCache(shopSummary && shopSummary.shopId, normalizedRegion);
      }
    }

    return refreshRegionCookieSnapshot(shopSummary, normalizedRegion, options);
  }

  function parseApiPayload(response, responseText) {
    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      data = null;
    }

    const textPreview = normalizeText(responseText).slice(0, RESPONSE_TEXT_PREVIEW_LIMIT);
    const message = normalizeText(
      data && (
        data.message
        || data.msg
        || data.errorMsg
        || data.error_message
        || data.errorMessage
      )
    );
    const hasAuthKeyword = AUTH_REQUIRED_MESSAGE_PATTERN.test(
      `${message} ${textPreview}`
    );
    const authRequired =
      Number(response && response.status) === 401
      || Number(response && response.status) === 403
      || hasAuthKeyword
      || (
        /^\s*</.test(textPreview)
        && /seller|login|redirect|sign\s*in|sign\s*up/i.test(textPreview)
      )
      || (
        data
        && data.success === false
        && (
          Number(data.errorCode) === 401
          || Number(data.errorCode) === 403
          || hasAuthKeyword
        )
      );
    const success = data && Object.prototype.hasOwnProperty.call(data, 'success')
      ? Boolean(data.success)
      : null;
    const errorCode = data && Object.prototype.hasOwnProperty.call(data, 'errorCode')
      ? Number(data.errorCode)
      : null;
    const hasErrorCode = errorCode !== null && Number.isFinite(errorCode);
    const businessSucceeded = success === true && (!hasErrorCode || errorCode === 1000000 || errorCode === 0);
    const ok = Boolean(response && response.ok)
      && authRequired !== true
      && businessSucceeded === true;

    return {
      ok,
      authRequired,
      httpStatus: Number(response && response.status) || 0,
      message,
      success,
      errorCode,
      data,
      responseTextPreview: textPreview
    };
  }

  function parseHtmlPayload(response, responseText) {
    const textPreview = normalizeText(responseText).slice(0, RESPONSE_TEXT_PREVIEW_LIMIT);
    const finalUrl = normalizeText(response && response.url);
    const onAuthenticationPage = /\/(?:main|auth)\/authentication(?:[?#]|$)/i.test(finalUrl);
    const authRequired =
      Number(response && response.status) === 401
      || Number(response && response.status) === 403
      || /\/login(?:\.html)?(?:[?#]|$)/i.test(finalUrl)
      || (
        !onAuthenticationPage
        && /(?:sign\s*in|log\s*in|password|captcha|\u767b\u5f55|\u5bc6\u7801|\u9a8c\u8bc1\u7801)/i.test(textPreview)
      );

    return {
      ok: Boolean(response && response.ok) && authRequired !== true,
      authRequired,
      httpStatus: Number(response && response.status) || 0,
      message: authRequired ? 'seller page auth required' : '',
      responseTextPreview: textPreview,
      finalUrl
    };
  }

  function buildSessionTransportError(error, options = {}) {
    const rawMessage = normalizeText(error && error.message);

    if (
      error
      && (
        error.code === QUERY_CANCELED_ERROR_CODE
        || error.name === 'AbortError'
        || /aborted/i.test(rawMessage)
      )
    ) {
      return createQueryCanceledError();
    }

    const requestUrl = normalizeText(options.requestUrl);
    const proxyConfig =
      options.proxyConfig && typeof options.proxyConfig === 'object'
        ? options.proxyConfig
        : null;
    const hasProxyCredentials = Boolean(
      normalizeText(proxyConfig && proxyConfig.username)
      || normalizeText(proxyConfig && proxyConfig.password)
    );
    let nextMessage = rawMessage || '\u6d41\u91cf\u52a0\u901f\u8bf7\u6c42\u5931\u8d25\u3002';

    if (/ERR_TUNNEL_CONNECTION_FAILED/i.test(rawMessage)) {
      nextMessage = hasProxyCredentials
        ? '\u5e97\u94fa\u4ee3\u7406\u8fde\u63a5\u5931\u8d25\u6216\u4ee3\u7406\u9274\u6743\u672a\u901a\u8fc7\uff0c\u8bf7\u68c0\u67e5\u4ee3\u7406\u5730\u5740\u3001\u7aef\u53e3\u3001\u8d26\u53f7\u5bc6\u7801\u3002'
        : '\u5e97\u94fa\u4ee3\u7406\u96a7\u9053\u5efa\u7acb\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u4ee3\u7406\u5730\u5740\u4e0e\u7aef\u53e3\u662f\u5426\u53ef\u7528\u3002';
    } else if (
      /ERR_PROXY_CONNECTION_FAILED/i.test(rawMessage)
      || /ERR_NO_SUPPORTED_PROXIES/i.test(rawMessage)
    ) {
      nextMessage = '\u5e97\u94fa\u4ee3\u7406\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u4ee3\u7406\u914d\u7f6e\u3002';
    } else if (/ERR_BLOCKED_BY_CLIENT/i.test(rawMessage)) {
      nextMessage = hasProxyCredentials
        ? '\u5e97\u94fa\u4ee3\u7406\u8bf7\u6c42\u88ab\u672c\u5730\u7f51\u7edc\u5c42\u62e6\u622a\uff0c\u8bf7\u68c0\u67e5\u5f53\u524d\u4ee3\u7406\u94fe\u8def\u6216\u4ee3\u7406\u9274\u6743\u72b6\u6001\u3002'
        : '\u5f53\u524d\u4f1a\u8bdd\u8bf7\u6c42\u88ab\u672c\u5730\u7f51\u7edc\u5c42\u62e6\u622a\uff0c\u8bf7\u68c0\u67e5\u5e97\u94fa\u5206\u533a\u7f51\u7edc\u73af\u5883\u3002';
    }

    const transportError = new Error(nextMessage);
    transportError.code = normalizeText(error && error.code) || 'OPERATIONS_TRAFFIC_BOOST_TRANSPORT_ERROR';
    transportError.cause = error;
    transportError.requestUrl = requestUrl;
    transportError.proxyType = normalizeText(proxyConfig && proxyConfig.type);
    transportError.proxyHost = normalizeText(proxyConfig && proxyConfig.host);
    transportError.proxyPort = normalizeText(proxyConfig && proxyConfig.port);
    transportError.proxyAuthenticated = hasProxyCredentials;
    return transportError;
  }

  async function executeNetRequestWithSession(targetSession, requestUrl, requestInit = {}, options = {}) {
    const normalizedUrl = normalizeText(requestUrl);
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
    const abortSignal = requestInit.signal || null;

    return new Promise((resolve, reject) => {
      let finalUrl = normalizedUrl;
      let settled = false;
      const request = net.request({
        method: normalizeHelperText(requestInit.method) || 'GET',
        url: normalizedUrl,
        session: targetSession,
        headers: requestHeaders,
        redirect: 'follow'
      });

      function cleanupAbortListener() {
        if (abortSignal && typeof abortSignal.removeEventListener === 'function') {
          abortSignal.removeEventListener('abort', handleAbortSignal);
        }
      }

      function finishWithError(error) {
        if (settled) {
          return;
        }

        settled = true;
        cleanupAbortListener();
        reject(buildSessionTransportError(error, {
          requestUrl: normalizedUrl,
          proxyConfig
        }));
      }

      function settleWithResponse(response) {
        if (settled) {
          return;
        }

        settled = true;
        cleanupAbortListener();
        resolve(response);
      }

      function handleAbortSignal() {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';

        try {
          request.destroy(abortError);
        } catch (_error) {
          // ignore destroy failures
        }

        finishWithError(abortError);
      }

      if (abortSignal) {
        if (abortSignal.aborted === true) {
          handleAbortSignal();
          return;
        }

        if (typeof abortSignal.addEventListener === 'function') {
          abortSignal.addEventListener('abort', handleAbortSignal, { once: true });
        }
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
          log('operations_traffic_boost_proxy_auth_supplied', {
            shopId,
            partition,
            requestUrl: normalizedUrl,
            proxyType: normalizeText(proxyConfig.type)
          });
          callback(
            normalizeText(proxyConfig.username),
            normalizeText(proxyConfig.password)
          );
          return;
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
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const status = Number(response && response.statusCode) || 0;

          settleWithResponse({
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

  async function executeFetchWithTimeout(targetSession, requestUrl, requestInit, options = {}) {
    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    const queryJob = options.queryJob || null;
    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const requestLabel = normalizeText(options.requestLabel) || normalizeText(requestUrl) || '\u4f1a\u8bdd\u8bf7\u6c42';
    const requestPath = normalizeText(options.requestPath);
    const requestMethod = normalizeHelperText(requestInit && requestInit.method).toUpperCase() || 'GET';
    let requestTransport = '';
    let timeoutId = 0;

    assertQueryJobActive(queryJob);

    if (queryJob && controller) {
      queryJob.activeControllers.add(controller);

      if (queryJob.canceled === true || queryJob.stopRequested === true) {
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

        const timeoutError = new Error(
          normalizeText(options.timeoutMessage)
          || '\u6d41\u91cf\u52a0\u901f\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );
        timeoutError.timeout = true;
        reject(timeoutError);
      }, Math.max(1000, Number(options.timeoutMs) || QUERY_REQUEST_TIMEOUT_MS));
    });

    const fetchPromise = (async () => {
      const nextRequestInit = {
        ...requestInit
      };
      const runtimeProfile = await getShopRuntimeProfile(
        options.shopSummary,
        options.sessionContext
      );
      const proxyConfig =
        runtimeProfile && runtimeProfile.proxyConfig && typeof runtimeProfile.proxyConfig === 'object'
          ? runtimeProfile.proxyConfig
          : null;

      if (controller) {
        nextRequestInit.signal = controller.signal;
      }

      // Keep explicit Cookie headers intact for region-bound seller APIs.
      requestTransport = 'net.request';

      emitQueryRequestProgress(progressContext, {
        phase: 'requesting',
        traceType: 'request-start',
        requestLabel,
        requestPath,
        requestUrl,
        requestMethod,
        requestTransport,
        message: normalizeText(options.requestStartMessage) || `\u6b63\u5728\u53d1\u8d77${requestLabel}\u3002`
      }, progressEmitter);

      return executeNetRequestWithSession(targetSession, requestUrl, nextRequestInit, {
        proxyConfig,
        shopId: normalizeText(
          options.shopSummary && options.shopSummary.shopId
          || options.sessionContext && options.sessionContext.shopId
        ),
        partition: normalizeText(
          options.sessionContext && options.sessionContext.partition
        )
      });
    })();

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (response && typeof response === 'object') {
        response.requestTransport = response.requestTransport || requestTransport || 'session.fetch';
      }

      return response;
    } catch (error) {
      emitQueryRequestProgress(progressContext, {
        phase: 'request-failed',
        traceType: 'request-failed',
        requestLabel,
        requestPath,
        requestUrl,
        requestMethod,
        requestTransport,
        message: normalizeText(error && error.message) || `\u53d1\u8d77${requestLabel}\u5931\u8d25\u3002`,
        errorMessage: normalizeText(error && error.message)
      }, progressEmitter);
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (queryJob && controller) {
        queryJob.activeControllers.delete(controller);
      }
    }
  }

  async function executeFlowAnalysisRequest(sessionContext, marketRegion, requestPayload, options = {}) {
    const shopSummary = options.shopSummary;
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const requestUrl = QUERY_URL_BY_REGION[normalizedRegion] || QUERY_URL_BY_REGION[DEFAULT_MARKET_REGION];
    const parsedRequestUrl = parseUrlOrNull(requestUrl);
    const requestPath = normalizeText(parsedRequestUrl && parsedRequestUrl.pathname) || '/api/flow/analysis/list';
    const queryJob = options.queryJob || null;
    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    let cookieSnapshot = await ensureRegionCookieSnapshot(shopSummary, normalizedRegion, {
      sessionContext,
      forceRefresh: options.forceCookieRefresh === true,
      queryJob,
      progressContext,
      emitProgress: progressEmitter
    });

    for (let attemptIndex = 0; attemptIndex < Math.max(2, RATE_LIMIT_RETRY_ATTEMPTS); attemptIndex += 1) {
      assertQueryJobActive(queryJob);

      const normalizedPartition = normalizeText(cookieSnapshot && cookieSnapshot.partition) || normalizeText(sessionContext && sessionContext.partition);
      log('operations_traffic_boost_query_region_cookie_snapshot', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        marketRegion: normalizedRegion,
        partition: normalizedPartition,
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        hasCookieHeader: Boolean(normalizeText(cookieSnapshot && cookieSnapshot.cookieHeader)),
        hasMallId: Boolean(normalizeText(cookieSnapshot && cookieSnapshot.mallId)),
        attemptIndex
      });
      const targetSession = resolveShopScopedFetchSession(normalizedPartition, {
        shopSummary,
        sessionContext,
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        requestUrl,
        message: '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
      });
      const headers = {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        cookie: normalizeText(cookieSnapshot && cookieSnapshot.cookieHeader),
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        referer: `${MARKET_ORIGIN_BY_REGION[normalizedRegion]}/`
      };

      if (normalizeText(cookieSnapshot && cookieSnapshot.mallId)) {
        headers.Mallid = normalizeText(cookieSnapshot.mallId);
      }

      const response = await executeFetchWithTimeout(
        targetSession,
        requestUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload || {}),
          cache: 'no-store',
          credentials: 'omit'
        },
        {
          queryJob,
          shopSummary,
          sessionContext,
          progressContext,
          emitProgress: progressEmitter,
          requestLabel: '\u67e5\u8be2\u6d41\u91cf\u52a0\u901f\u5546\u54c1\u5217\u8868',
          requestPath,
          timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
          timeoutMessage: '\u6d41\u91cf\u52a0\u901f\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        }
      );
      const responseText = await response.text();
      const parsedPayload = parseApiPayload(response, responseText);

      emitQueryRequestProgress(progressContext, {
        phase: parsedPayload.ok === true ? 'request-completed' : (
          parsedPayload.authRequired === true && attemptIndex <= 0
            ? 'request-failed'
            : 'request-failed'
        ),
        traceType: parsedPayload.ok === true
          ? 'request-completed'
          : (parsedPayload.authRequired === true && attemptIndex <= 0 ? 'request-auth-required' : 'request-failed'),
        requestLabel: '\u67e5\u8be2\u6d41\u91cf\u52a0\u901f\u5546\u54c1\u5217\u8868',
        requestPath,
        requestUrl,
        requestMethod: 'POST',
        requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
        httpStatus: Number(response && response.status) || 0,
        errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
        success: parsedPayload.ok === true,
        authRequired: parsedPayload.authRequired === true,
        responseTextPreview: normalizeText(responseText),
        message: normalizeText(parsedPayload.message) || (
          parsedPayload.ok === true
            ? '\u6d41\u91cf\u52a0\u901f\u5217\u8868\u8bf7\u6c42\u5b8c\u6210\u3002'
            : (
              parsedPayload.authRequired === true && attemptIndex <= 0
                ? '\u5217\u8868\u8bf7\u6c42\u8fd4\u56de\u9700\u8981\u91cd\u65b0\u767b\u5f55\uff0c\u6b63\u5728\u5237\u65b0\u4f1a\u8bdd\u3002'
                : '\u6d41\u91cf\u52a0\u901f\u5217\u8868\u8bf7\u6c42\u5931\u8d25\u3002'
            )
        )
      }, progressEmitter);

      if (parsedPayload.ok === true) {
        return {
          ...parsedPayload,
          cookieSnapshot
        };
      }

      const responseMessage = normalizeText(parsedPayload.message);
      const isRateLimited = isRateLimitErrorMessage(responseMessage);

      if (isRateLimited && attemptIndex < RATE_LIMIT_RETRY_ATTEMPTS - 1) {
        const retryDelayMs = computeRateLimitRetryDelayMs(attemptIndex, responseMessage);

        emitQueryRequestProgress(progressContext, {
          phase: 'request-failed',
          traceType: 'request-rate-limited',
          requestLabel: '\u67e5\u8be2\u6d41\u91cf\u52a0\u901f\u5546\u54c1\u5217\u8868',
          requestPath,
          requestUrl,
          requestMethod: 'POST',
          requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
          httpStatus: Number(response && response.status) || 0,
          errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
          success: false,
          authRequired: false,
          responseTextPreview: normalizeText(responseText),
          message: `${responseMessage || '\u63a5\u53e3\u8fd4\u56de\u9650\u6d41'}\uff0c${Math.max(1, Math.ceil(retryDelayMs / 1000))}\u79d2\u540e\u81ea\u52a8\u91cd\u8bd5\u3002`
        }, progressEmitter);
        emitQueryProgress(progressContext, {
          phase: 'querying',
          currentShopId: normalizeText(shopSummary && shopSummary.shopId),
          currentShopName: normalizeText(shopSummary && shopSummary.shopName),
          pageNum: Math.max(1, normalizeIntegerValue(requestPayload && requestPayload.pageNumber, 1)),
          totalPages: 0,
          pageSize: DEFAULT_PAGE_SIZE,
          accumulatedItemCount: 0,
          rowCount: 0,
          message: `${responseMessage || '\u5f53\u524d\u9875\u89e6\u53d1\u9650\u6d41'}\uff0c${Math.max(1, Math.ceil(retryDelayMs / 1000))}\u79d2\u540e\u91cd\u8bd5`
        }, progressEmitter);

        await createCancelableDelay(queryJob, retryDelayMs);
        continue;
      }

      if (isRateLimited) {
        throw new Error(
          `${responseMessage || '\u63a5\u53e3\u8fd4\u56de\u9650\u6d41'}\uff0c\u5df2\u81ea\u52a8\u91cd\u8bd5 ${RATE_LIMIT_RETRY_ATTEMPTS} \u6b21\u4ecd\u672a\u6062\u590d\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002`
        );
      }

      if (parsedPayload.authRequired !== true || attemptIndex > 0) {
        throw new Error(
          responseMessage
          || '\u6d41\u91cf\u52a0\u901f\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );
      }

      invalidateRegionCookieCache(shopSummary && shopSummary.shopId, normalizedRegion);
      cookieSnapshot = await ensureRegionCookieSnapshot(shopSummary, normalizedRegion, {
        sessionContext,
        forceRefresh: true,
        queryJob,
        progressContext,
        emitProgress: progressEmitter
      });
    }

    throw new Error('\u5356\u5bb6\u4e2d\u5fc3\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u5148\u786e\u8ba4\u5bf9\u5e94\u5e97\u94fa\u5df2\u767b\u5f55\u540e\u518d\u91cd\u8bd5\u3002');
  }

  function buildCategoryPathText(category) {
    const source = category && typeof category === 'object' ? category : {};
    const segments = [];

    for (let index = 1; index <= 10; index += 1) {
      const fieldName = `cat${index}Name`;
      const value = normalizeText(source[fieldName]);

      if (!value) {
        continue;
      }

      if (segments[segments.length - 1] !== value) {
        segments.push(value);
      }
    }

    return segments.join(' / ');
  }

  function formatPromotionSummaryText(promotionList) {
    return (Array.isArray(promotionList) ? promotionList : [])
      .map((promotionItem) => {
        const typeLabel = normalizeText(promotionItem && promotionItem.promotionInstanceTypeDesc);
        const nameList = (Array.isArray(promotionItem && promotionItem.promotionInfoVOS)
          ? promotionItem.promotionInfoVOS
          : [])
          .map((item) => normalizeText(item && item.promotionInstanceName))
          .filter(Boolean);

        if (!typeLabel && nameList.length <= 0) {
          return '';
        }

        if (typeLabel && nameList.length > 0) {
          return `${typeLabel}: ${nameList.join(' | ')}`;
        }

        return typeLabel || nameList.join(' | ');
      })
      .filter(Boolean)
      .join(' ; ')
      .slice(0, 600);
  }

  function countPromotionItems(promotionList) {
    return (Array.isArray(promotionList) ? promotionList : [])
      .reduce((totalCount, promotionItem) => {
        const infoList = Array.isArray(promotionItem && promotionItem.promotionInfoVOS)
          ? promotionItem.promotionInfoVOS
          : [];

        return totalCount + infoList.length;
      }, 0);
  }

  function formatPromotionTypeSummaryText(promotionList) {
    return (Array.isArray(promotionList) ? promotionList : [])
      .map((promotionItem) => {
        const typeLabel = normalizeText(promotionItem && promotionItem.promotionInstanceTypeDesc);
        const infoCount = Array.isArray(promotionItem && promotionItem.promotionInfoVOS)
          ? promotionItem.promotionInfoVOS.length
          : 0;

        if (!typeLabel && infoCount <= 0) {
          return '';
        }

        if (typeLabel && infoCount > 0) {
          return `${typeLabel} ${infoCount}`;
        }

        return typeLabel;
      })
      .filter(Boolean)
      .join(' | ')
      .slice(0, 240);
  }

  function buildPromotionTypeTags(promotionList) {
    return (Array.isArray(promotionList) ? promotionList : [])
      .map((promotionItem) => {
        const typeLabel = normalizeText(promotionItem && promotionItem.promotionInstanceTypeDesc);
        const infoCount = Array.isArray(promotionItem && promotionItem.promotionInfoVOS)
          ? promotionItem.promotionInfoVOS.length
          : 0;

        if (!typeLabel) {
          return null;
        }

        return {
          label: typeLabel,
          count: infoCount
        };
      })
      .filter(Boolean)
      .slice(0, 8);
  }

  function formatPromotionDetailText(promotionList) {
    const seenNameSet = new Set();
    const detailList = [];

    (Array.isArray(promotionList) ? promotionList : []).forEach((promotionItem) => {
      const infoList = Array.isArray(promotionItem && promotionItem.promotionInfoVOS)
        ? promotionItem.promotionInfoVOS
        : [];

      infoList.forEach((item) => {
        const detailText = normalizeText(item && item.promotionInstanceName);

        if (!detailText || seenNameSet.has(detailText)) {
          return;
        }

        seenNameSet.add(detailText);
        detailList.push(detailText);
      });
    });

    return detailList.join(' | ').slice(0, 600);
  }

  function buildPartialShopFailureWarning(shopSummary, pageNumber, collectedRowsLength, error) {
    const shopLabel = normalizeText(shopSummary && shopSummary.shopName)
      || normalizeText(shopSummary && shopSummary.shopId)
      || '\u5f53\u524d\u5e97\u94fa';
    const errorMessage = normalizeText(error && error.message) || '\u672a\u77e5\u9519\u8bef';

    return `${shopLabel} \u5728\u67e5\u8be2\u7b2c ${Math.max(1, normalizeIntegerValue(pageNumber, 1))} \u9875\u65f6\u4e2d\u65ad\uff0c\u5df2\u4fdd\u7559\u524d\u9762\u5df2\u67e5\u5230\u7684 ${Math.max(0, normalizeIntegerValue(collectedRowsLength, 0))} \u6761\u7ed3\u679c\uff1a${errorMessage}`;
  }

  function buildRowSortTimestamp(row) {
    const bindTimestamp = Number(row && row.firstBindSiteTime);

    if (Number.isFinite(bindTimestamp) && bindTimestamp > 0) {
      return bindTimestamp;
    }

    const ptTimestamp = Date.parse(normalizeText(row && row.pt));
    return Number.isFinite(ptTimestamp) ? ptTimestamp : 0;
  }

  function normalizeResultRow(item, shopSummary, marketRegion, options = {}) {
    const source = item && typeof item === 'object' ? item : {};
    const category = source.category && typeof source.category === 'object'
      ? source.category
      : {};
    const promotionList = Array.isArray(source.promotionList)
      ? source.promotionList
      : [];
    const productSkuIdList = Array.isArray(source.productSkuIdList)
      ? source.productSkuIdList
      : [];
    const productSkuExtCodeList = Array.isArray(source.productSkuExtCodeList)
      ? source.productSkuExtCodeList
      : [];
    const promotionTypeCount = promotionList.length;
    const promotionItemCount = countPromotionItems(promotionList);
    const flowPriceInfo = options && options.flowPriceInfo && typeof options.flowPriceInfo === 'object'
      ? options.flowPriceInfo
      : null;
    const flowPriceInfoRequested = options && options.flowPriceInfoRequested === true;
    const flowPriceInfoLoadFailed = options && options.flowPriceInfoLoadFailed === true;
    const flowPriceInfoWarning = flowPriceInfoLoadFailed
      ? '\u8be5\u5546\u54c1SKU\u660e\u7ec6\u672a\u8bbf\u53d6\u5230\uff0c\u5df2\u5148\u663e\u793a\u57fa\u7840\u4fe1\u606f\u3002'
      : (
        flowPriceInfoRequested && !flowPriceInfo
          ? '\u63a5\u53e3\u672a\u8fd4\u56deSKU\u660e\u7ec6\u3002'
          : ''
      );
    const sharedCostLookup = options && options.sharedCostLookup instanceof Map
      ? options.sharedCostLookup
      : null;
    const categoryId = normalizeText(source.cateId)
      || normalizeText(category.catId)
      || normalizeText(flowPriceInfo && flowPriceInfo.cateList && flowPriceInfo.cateList.leafCatId);
    const skuPriceInfoList = (Array.isArray(flowPriceInfo && flowPriceInfo.skuPriceInfoList)
      ? flowPriceInfo.skuPriceInfoList
      : [])
      .map((skuItem) => {
        const sharedCostPrice = resolveSharedCostPrice(sharedCostLookup, {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          station: normalizeText(source.siteId),
          stationLabel: normalizeText(source.siteName),
          category: categoryId,
          categoryLabel: normalizeText(category.catName),
          skuId: normalizeText(skuItem && skuItem.productSkuId),
          skcId: normalizeText(skuItem && skuItem.productSkcId),
          spec: normalizeText(skuItem && skuItem.specText),
          specAliases: Array.isArray(skuItem && skuItem.specAliases) ? skuItem.specAliases : []
        });

        if (!sharedCostPrice) {
          return skuItem;
        }

        return {
          ...skuItem,
          costPrice: sharedCostPrice
        };
      });

    return {
      rowKey: [
        normalizeText(shopSummary && shopSummary.shopId),
        normalizeText(source.siteId),
        normalizeText(source.productId),
        normalizeText(source.goodsId),
        normalizeText(source.pt),
        normalizeText(source.firstBindSiteTime)
      ].join(':'),
      marketRegion: normalizeMarketRegion(marketRegion),
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      supplierId: normalizeText(source.supplierId),
      supplierName: normalizeText(source.supplierName),
      siteId: normalizeText(source.siteId),
      siteName: normalizeText(source.siteName),
      goodsId: normalizeText(source.goodsId),
      productId: normalizeText(source.productId),
      productName: normalizeText(source.productName)
        || normalizeText(flowPriceInfo && flowPriceInfo.productName)
        || normalizeText(source.goodsName),
      goodsName: normalizeText(source.goodsName),
      mainImageUrl: normalizeText(source.mainImageUrl) || normalizeText(flowPriceInfo && flowPriceInfo.mainImages),
      categoryId: normalizeText(source.cateId) || normalizeText(category.catId),
      categoryPathText: buildCategoryPathText(category),
      categoryName: normalizeText(category.catName),
      firstBindSiteTime: normalizeScalarValue(source.firstBindSiteTime),
      firstBindSiteTimeStr: normalizeText(source.firstBindSiteTimeStr),
      pt: normalizeText(source.pt),
      productSkuIdList,
      productSkuIdText: productSkuIdList
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(', '),
      productSkuExtCodeList,
      productSkuExtCodeText: productSkuExtCodeList
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(', '),
      flowPriceInfoLoaded: flowPriceInfoRequested && flowPriceInfoLoadFailed !== true,
      flowPriceInfoFound: Boolean(flowPriceInfo),
      flowPriceInfoWarning,
      canNotSubmitReason: normalizeText(flowPriceInfo && flowPriceInfo.canNotSubmitReason),
      ordinaryFlowIncreaseAbsolute: normalizeScalarValue(flowPriceInfo && flowPriceInfo.ordinaryFlowIncreaseAbsolute),
      ordinaryFlowIncreasePercent: normalizeScalarValue(flowPriceInfo && flowPriceInfo.ordinaryFlowIncreasePercent),
      premiumFlowIncreaseAbsolute: normalizeScalarValue(flowPriceInfo && flowPriceInfo.premiumFlowIncreaseAbsolute),
      premiumFlowIncreasePercent: normalizeScalarValue(flowPriceInfo && flowPriceInfo.premiumFlowIncreasePercent),
      superFlowIncreaseAbsolute: normalizeScalarValue(flowPriceInfo && flowPriceInfo.superFlowIncreaseAbsolute),
      superFlowIncreasePercent: normalizeScalarValue(flowPriceInfo && flowPriceInfo.superFlowIncreasePercent),
      skuPriceInfoList,
      skuPriceInfoCount: skuPriceInfoList.length,
      impressionCount: normalizeScalarValue(source.impressionCount),
      clickCount: normalizeScalarValue(source.clickCount),
      goodsVisitorsUserNum: normalizeScalarValue(source.goodsVisitorsUserNum),
      orderPayGoodsNum: normalizeScalarValue(source.orderPayGoodsNum),
      orderPayOrderNum: normalizeScalarValue(source.orderPayOrderNum),
      orderPayImpressionRate: normalizeScalarValue(source.orderPayImpressionRate),
      clickImpressionRate: normalizeScalarValue(source.clickImpressionRate),
      clickOrderRatio: normalizeScalarValue(source.clickOrderRatio),
      businessDetailPaymentUserRate: normalizeScalarValue(source.businessDetailPaymentUserRate),
      searchExposeNum: normalizeScalarValue(source.searchExposeNum),
      recommendExposeNum: normalizeScalarValue(source.recommendExposeNum),
      searchClickNum: normalizeScalarValue(source.searchClickNum),
      recommendClickNum: normalizeScalarValue(source.recommendClickNum),
      flowGrowStatus: normalizeScalarValue(source.flowGrowStatus),
      flowLimitStatus: normalizeScalarValue(source.flowLimitStatus),
      canToGrow: normalizeScalarValue(source.canToGrow),
      promotionCount: promotionItemCount,
      promotionTypeCount,
      promotionItemCount,
      promotionTypeTags: buildPromotionTypeTags(promotionList),
      promotionTypeSummaryText: formatPromotionTypeSummaryText(promotionList),
      promotionDetailText: formatPromotionDetailText(promotionList),
      promotionSummaryText: formatPromotionSummaryText(promotionList),
      sortTimestamp: buildRowSortTimestamp(source)
    };
  }

  async function executeFlowPriceInfoRequest(sessionContext, marketRegion, requestPayload, options = {}) {
    const shopSummary = options.shopSummary;
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const requestUrl = FLOW_PRICE_INFO_URL_BY_REGION[normalizedRegion] || FLOW_PRICE_INFO_URL_BY_REGION[DEFAULT_MARKET_REGION];
    const parsedRequestUrl = parseUrlOrNull(requestUrl);
    const requestPath = normalizeText(parsedRequestUrl && parsedRequestUrl.pathname)
      || '/api/kiana/marvel-mms/cyborg/increase/flow/batchQueryIncreaseFlowPriceInfo';
    const queryJob = options.queryJob || null;
    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    let cookieSnapshot = options.initialCookieSnapshot && typeof options.initialCookieSnapshot === 'object'
      ? options.initialCookieSnapshot
      : await ensureRegionCookieSnapshot(shopSummary, normalizedRegion, {
        sessionContext,
        forceRefresh: options.forceCookieRefresh === true,
        queryJob,
        progressContext,
        emitProgress: progressEmitter
      });

    for (let attemptIndex = 0; attemptIndex < Math.max(2, RATE_LIMIT_RETRY_ATTEMPTS); attemptIndex += 1) {
      assertQueryJobActive(queryJob);

      const normalizedPartition = normalizeText(cookieSnapshot && cookieSnapshot.partition) || normalizeText(sessionContext && sessionContext.partition);
      const targetSession = resolveShopScopedFetchSession(normalizedPartition, {
        shopSummary,
        sessionContext,
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        requestUrl,
        message: '\u6d41\u91cf\u52a0\u901fSKU\u660e\u7ec6\u67e5\u8be2\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
      });
      const headers = {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        cookie: normalizeText(cookieSnapshot && cookieSnapshot.cookieHeader),
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        referer: `${MARKET_ORIGIN_BY_REGION[normalizedRegion]}/`
      };

      if (normalizeText(cookieSnapshot && cookieSnapshot.mallId)) {
        headers.Mallid = normalizeText(cookieSnapshot.mallId);
      }

      const response = await executeFetchWithTimeout(
        targetSession,
        requestUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload || {}),
          cache: 'no-store',
          credentials: 'omit'
        },
        {
          queryJob,
          shopSummary,
          sessionContext,
          progressContext,
          emitProgress: progressEmitter,
          requestLabel: '\u67e5\u8be2\u6d41\u91cf\u52a0\u901fSKU\u4ef7\u683c\u660e\u7ec6',
          requestPath,
          timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
          timeoutMessage: '\u6d41\u91cf\u52a0\u901fSKU\u660e\u7ec6\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        }
      );
      const responseText = await response.text();
      const parsedPayload = parseApiPayload(response, responseText);

      emitQueryRequestProgress(progressContext, {
        phase: parsedPayload.ok === true ? 'request-completed' : 'request-failed',
        traceType: parsedPayload.ok === true
          ? 'request-completed'
          : (parsedPayload.authRequired === true && attemptIndex <= 0 ? 'request-auth-required' : 'request-failed'),
        requestLabel: '\u67e5\u8be2\u6d41\u91cf\u52a0\u901fSKU\u4ef7\u683c\u660e\u7ec6',
        requestPath,
        requestUrl,
        requestMethod: 'POST',
        requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
        httpStatus: Number(response && response.status) || 0,
        errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
        success: parsedPayload.ok === true,
        authRequired: parsedPayload.authRequired === true,
        responseTextPreview: normalizeText(responseText),
        message: normalizeText(parsedPayload.message) || (
          parsedPayload.ok === true
            ? '\u6d41\u91cf\u52a0\u901fSKU\u660e\u7ec6\u8bf7\u6c42\u5b8c\u6210\u3002'
            : (
              parsedPayload.authRequired === true && attemptIndex <= 0
                ? '\u6d41\u91cf\u52a0\u901fSKU\u660e\u7ec6\u8fd4\u56de\u9700\u8981\u91cd\u65b0\u767b\u5f55\uff0c\u6b63\u5728\u5237\u65b0\u4f1a\u8bdd\u3002'
                : '\u6d41\u91cf\u52a0\u901fSKU\u660e\u7ec6\u8bf7\u6c42\u5931\u8d25\u3002'
            )
        )
      }, progressEmitter);

      if (parsedPayload.ok === true) {
        return {
          ...parsedPayload,
          cookieSnapshot
        };
      }

      const responseMessage = normalizeText(parsedPayload.message);
      const isRateLimited = isRateLimitErrorMessage(responseMessage);

      if (isRateLimited && attemptIndex < RATE_LIMIT_RETRY_ATTEMPTS - 1) {
        const retryDelayMs = computeRateLimitRetryDelayMs(attemptIndex, responseMessage);

        emitQueryRequestProgress(progressContext, {
          phase: 'request-failed',
          traceType: 'request-rate-limited',
          requestLabel: '\u67e5\u8be2\u6d41\u91cf\u52a0\u901fSKU\u4ef7\u683c\u660e\u7ec6',
          requestPath,
          requestUrl,
          requestMethod: 'POST',
          requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
          httpStatus: Number(response && response.status) || 0,
          errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
          success: false,
          authRequired: false,
          responseTextPreview: normalizeText(responseText),
          message: `${responseMessage || '\u63a5\u53e3\u8fd4\u56de\u9650\u6d41'}\uff0c${Math.max(1, Math.ceil(retryDelayMs / 1000))}\u79d2\u540e\u81ea\u52a8\u91cd\u8bd5\u3002`
        }, progressEmitter);
        emitQueryProgress(progressContext, {
          phase: 'querying',
          currentShopId: normalizeText(shopSummary && shopSummary.shopId),
          currentShopName: normalizeText(shopSummary && shopSummary.shopName),
          pageNum: Math.max(1, normalizeIntegerValue(options && options.pageNumber, 1)),
          totalPages: 0,
          pageSize: FLOW_PRICE_INFO_BATCH_SIZE,
          accumulatedItemCount: 0,
          rowCount: 0,
          message: `${responseMessage || '\u5f53\u524d\u6279SKU\u660e\u7ec6\u89e6\u53d1\u9650\u6d41'}\uff0c${Math.max(1, Math.ceil(retryDelayMs / 1000))}\u79d2\u540e\u91cd\u8bd5`
        }, progressEmitter);

        await createCancelableDelay(queryJob, retryDelayMs);
        continue;
      }

      if (isRateLimited) {
        throw new Error(
          `${responseMessage || '\u63a5\u53e3\u8fd4\u56de\u9650\u6d41'}\uff0c\u5df2\u81ea\u52a8\u91cd\u8bd5 ${RATE_LIMIT_RETRY_ATTEMPTS} \u6b21\u4ecd\u672a\u6062\u590d\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002`
        );
      }

      if (parsedPayload.authRequired !== true || attemptIndex > 0) {
        throw new Error(
          responseMessage
          || '\u6d41\u91cf\u52a0\u901fSKU\u660e\u7ec6\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );
      }

      invalidateRegionCookieCache(shopSummary && shopSummary.shopId, normalizedRegion);
      cookieSnapshot = await ensureRegionCookieSnapshot(shopSummary, normalizedRegion, {
        sessionContext,
        forceRefresh: true,
        queryJob,
        progressContext,
        emitProgress: progressEmitter
      });
    }

    throw new Error('\u5356\u5bb6\u4e2d\u5fc3\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u5148\u786e\u8ba4\u5bf9\u5e94\u5e97\u94fa\u5df2\u767b\u5f55\u540e\u518d\u91cd\u8bd5\u3002');
  }

  function mergeFlowPriceInfoBatchQueryResult(target, source) {
    if (!target || !source) {
      return target;
    }

    if (source.flowPriceInfoMap instanceof Map) {
      source.flowPriceInfoMap.forEach((value, key) => {
        target.flowPriceInfoMap.set(key, value);
      });
    }

    if (source.requestedProductKeySet instanceof Set) {
      source.requestedProductKeySet.forEach((key) => {
        target.requestedProductKeySet.add(key);
      });
    }

    if (source.failedProductKeySet instanceof Set) {
      source.failedProductKeySet.forEach((key) => {
        target.failedProductKeySet.add(key);
      });
    }

    if (Array.isArray(source.warnings) && source.warnings.length > 0) {
      target.warnings.push(...source.warnings);
    }

    if (source.cookieSnapshot && typeof source.cookieSnapshot === 'object') {
      target.cookieSnapshot = source.cookieSnapshot;
    }

    return target;
  }

  async function queryFlowPriceInfoBatchWithFallback(sessionContext, shopSummary, marketRegion, batchProductList, options = {}) {
    const normalizedBatchProductList = Array.isArray(batchProductList) ? batchProductList.filter(Boolean) : [];
    const batchResult = {
      flowPriceInfoMap: new Map(),
      requestedProductKeySet: new Set(),
      failedProductKeySet: new Set(),
      warnings: [],
      cookieSnapshot: options.initialCookieSnapshot && typeof options.initialCookieSnapshot === 'object'
        ? options.initialCookieSnapshot
        : null
    };

    if (normalizedBatchProductList.length <= 0) {
      return batchResult;
    }

    try {
      const response = await executeFlowPriceInfoRequest(
        sessionContext,
        marketRegion,
        {
          productList: normalizedBatchProductList.map((item) => ({
            productId: Number(item.productId),
            siteId: Number(item.siteId)
          }))
        },
        {
          shopSummary,
          queryJob: options.queryJob,
          progressContext: options.progressContext,
          emitProgress: options.emitProgress,
          initialCookieSnapshot: batchResult.cookieSnapshot,
          pageNumber: options.pageNumber
        }
      );
      const responseResult = response && response.data && response.data.result && typeof response.data.result === 'object'
        ? response.data.result
        : {};
      const responseMap = buildFlowPriceInfoMap(responseResult);

      batchResult.cookieSnapshot = response && response.cookieSnapshot ? response.cookieSnapshot : batchResult.cookieSnapshot;
      normalizedBatchProductList.forEach((item) => {
        batchResult.requestedProductKeySet.add(buildFlowPriceInfoKey(item.productId, item.siteId));
      });
      responseMap.forEach((value, key) => {
        batchResult.flowPriceInfoMap.set(key, value);
      });

      return batchResult;
    } catch (error) {
      if (normalizedBatchProductList.length > 1) {
        const splitIndex = Math.ceil(normalizedBatchProductList.length / 2);
        const leftBatch = normalizedBatchProductList.slice(0, splitIndex);
        const rightBatch = normalizedBatchProductList.slice(splitIndex);

        log('operations_traffic_boost_query_flow_price_info_batch_split_retry', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          shopName: normalizeText(shopSummary && shopSummary.shopName),
          marketRegion: normalizeMarketRegion(marketRegion),
          pageNumber: normalizeIntegerValue(options.pageNumber, 0),
          batchSize: normalizedBatchProductList.length,
          leftBatchSize: leftBatch.length,
          rightBatchSize: rightBatch.length,
          errorMessage: normalizeText(error && error.message)
        });

        const leftResult = await queryFlowPriceInfoBatchWithFallback(
          sessionContext,
          shopSummary,
          marketRegion,
          leftBatch,
          {
            ...options,
            initialCookieSnapshot: batchResult.cookieSnapshot
          }
        );

        mergeFlowPriceInfoBatchQueryResult(batchResult, leftResult);

        const rightResult = await queryFlowPriceInfoBatchWithFallback(
          sessionContext,
          shopSummary,
          marketRegion,
          rightBatch,
          {
            ...options,
            initialCookieSnapshot: batchResult.cookieSnapshot
          }
        );

        mergeFlowPriceInfoBatchQueryResult(batchResult, rightResult);
        return batchResult;
      }

      const onlyProduct = normalizedBatchProductList[0] || null;
      const productKey = buildFlowPriceInfoKey(
        onlyProduct && onlyProduct.productId,
        onlyProduct && onlyProduct.siteId
      );

      if (productKey && productKey !== ':') {
        batchResult.failedProductKeySet.add(productKey);
      }

      batchResult.warnings.push(
        `${normalizeText(shopSummary && shopSummary.shopName) || normalizeText(shopSummary && shopSummary.shopId) || '\u5f53\u524d\u5e97\u94fa'} `
        + `SKU\u660e\u7ec6\u8865\u67e5\u5931\u8d25\uff1aSPU ${normalizeText(onlyProduct && onlyProduct.productId) || '--'}`
      );

      logError('operations_traffic_boost_query_flow_price_info_failed', error, {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        marketRegion: normalizeMarketRegion(marketRegion),
        pageNumber: normalizeIntegerValue(options.pageNumber, 0),
        batchIndex: normalizeIntegerValue(options.batchIndex, 0),
        batchCount: normalizeIntegerValue(options.batchCount, 0),
        productCount: normalizedBatchProductList.length,
        productId: normalizeText(onlyProduct && onlyProduct.productId),
        siteId: normalizeText(onlyProduct && onlyProduct.siteId)
      });

      return batchResult;
    }
  }

  async function executeFlowPriceSubmitRequest(sessionContext, shopSummary, marketRegion, requestPayload, options = {}) {
    const normalizedRegion = normalizeMarketRegion(marketRegion);
    const requestUrlByRegion = options.requestUrlByRegion && typeof options.requestUrlByRegion === 'object'
      ? options.requestUrlByRegion
      : FLOW_PRICE_SUBMIT_URL_BY_REGION;
    const requestUrl = requestUrlByRegion[normalizedRegion] || requestUrlByRegion[DEFAULT_MARKET_REGION];
    const parsedRequestUrl = parseUrlOrNull(requestUrl);
    const requestPath = normalizeText(parsedRequestUrl && parsedRequestUrl.pathname)
      || normalizeText(options.fallbackRequestPath)
      || '/api/kiana/marvel-mms/cyborg/increase/flow/batchSubmitIncreaseFlowPriceInfo';
    const progressContext = options.progressContext || null;
    const progressEmitter = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const requestLabel = normalizeText(options.requestLabel) || '\u63d0\u4ea4\u6d41\u91cf\u52a0\u901f';
    const queryJob = options.queryJob || null;
    let cookieSnapshot = options.initialCookieSnapshot && typeof options.initialCookieSnapshot === 'object'
      ? options.initialCookieSnapshot
      : await ensureRegionCookieSnapshot(shopSummary, normalizedRegion, {
        sessionContext,
        forceRefresh: options.forceCookieRefresh === true,
        queryJob,
        progressContext,
        emitProgress: progressEmitter
      });

    for (let attemptIndex = 0; attemptIndex < Math.max(2, RATE_LIMIT_RETRY_ATTEMPTS); attemptIndex += 1) {
      assertQueryJobActive(queryJob);
      const normalizedPartition = normalizeText(cookieSnapshot && cookieSnapshot.partition) || normalizeText(sessionContext && sessionContext.partition);
      const targetSession = resolveShopScopedFetchSession(normalizedPartition, {
        shopSummary,
        sessionContext,
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        requestUrl,
        message: '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
      });
      const headers = {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        cookie: normalizeText(cookieSnapshot && cookieSnapshot.cookieHeader),
        origin: MARKET_ORIGIN_BY_REGION[normalizedRegion],
        referer: `${MARKET_ORIGIN_BY_REGION[normalizedRegion]}/`
      };

      if (normalizeText(cookieSnapshot && cookieSnapshot.mallId)) {
        headers.Mallid = normalizeText(cookieSnapshot.mallId);
      }

      const response = await executeFetchWithTimeout(
        targetSession,
        requestUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload || {}),
          cache: 'no-store',
          credentials: 'omit'
        },
        {
          queryJob,
          shopSummary,
          sessionContext,
          progressContext,
          emitProgress: progressEmitter,
          requestLabel,
          requestPath,
          requestStartMessage: normalizeText(options.requestStartMessage),
          timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
          timeoutMessage: '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        }
      );
      const responseText = await response.text();
      const parsedPayload = parseApiPayload(response, responseText);

      emitQueryRequestProgress(progressContext, {
        phase: parsedPayload.ok === true ? 'request-completed' : 'request-failed',
        traceType: parsedPayload.ok === true
          ? 'request-completed'
          : (parsedPayload.authRequired === true && attemptIndex <= 0 ? 'request-auth-required' : 'request-failed'),
        requestLabel,
        requestPath,
        requestUrl,
        requestMethod: 'POST',
        requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
        httpStatus: Number(response && response.status) || 0,
        errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
        success: parsedPayload.ok === true,
        authRequired: parsedPayload.authRequired === true,
        responseTextPreview: normalizeText(responseText),
        message: normalizeText(parsedPayload.message) || (
          parsedPayload.ok === true
            ? `${requestLabel}\u5b8c\u6210\u3002`
            : (
              parsedPayload.authRequired === true && attemptIndex <= 0
                ? `${requestLabel}\u8fd4\u56de\u9700\u8981\u91cd\u65b0\u767b\u5f55\uff0c\u6b63\u5728\u5237\u65b0\u4f1a\u8bdd\u3002`
                : `${requestLabel}\u5931\u8d25\u3002`
            )
        )
      }, progressEmitter);

      if (parsedPayload.ok === true) {
        return {
          ...parsedPayload,
          cookieSnapshot
        };
      }

      const responseMessage = normalizeText(parsedPayload.message);
      const isRateLimited = isRateLimitErrorMessage(responseMessage);

      if (isRateLimited && attemptIndex < RATE_LIMIT_RETRY_ATTEMPTS - 1) {
        const retryDelayMs = computeRateLimitRetryDelayMs(attemptIndex, responseMessage);

        emitQueryRequestProgress(progressContext, {
          phase: 'request-failed',
          traceType: 'request-rate-limited',
          requestLabel,
          requestPath,
          requestUrl,
          requestMethod: 'POST',
          requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
          httpStatus: Number(response && response.status) || 0,
          errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
          success: false,
          authRequired: false,
          responseTextPreview: normalizeText(responseText),
          message: `${responseMessage || '\u63d0\u4ea4\u63a5\u53e3\u8fd4\u56de\u9650\u6d41'}\uff0c${Math.max(1, Math.ceil(retryDelayMs / 1000))}\u79d2\u540e\u81ea\u52a8\u91cd\u8bd5\u3002`
        }, progressEmitter);
        await createCancelableDelay(options.queryJob || null, retryDelayMs);
        continue;
      }

      if (parsedPayload.authRequired === true && attemptIndex < RATE_LIMIT_RETRY_ATTEMPTS - 1) {
        const retryDelayMs = randomIntegerBetween(
          SUBMIT_BATCH_DELAY_MIN_MS,
          SUBMIT_BATCH_DELAY_MAX_MS
        );

        invalidateRegionCookieCache(shopSummary && shopSummary.shopId, normalizedRegion);
        emitQueryRequestProgress(progressContext, {
          phase: 'request-failed',
          traceType: 'request-auth-refreshing',
          requestLabel,
          requestPath,
          requestUrl,
          requestMethod: 'POST',
          requestTransport: normalizeText(response && response.requestTransport) || 'session.fetch',
          httpStatus: Number(response && response.status) || 0,
          errorCode: Number(parsedPayload && parsedPayload.errorCode) || 0,
          success: false,
          authRequired: true,
          responseTextPreview: normalizeText(responseText),
          message: `${requestLabel}\u8fd4\u56de\u767b\u5f55\u72b6\u6001\u672a\u5c31\u7eea\uff0c\u6b63\u5728\u5237\u65b0\u4f1a\u8bdd\uff0c${(retryDelayMs / 1000).toFixed(1)}\u79d2\u540e\u91cd\u8bd5\u3002`
        }, progressEmitter);
        emitQueryProgress(progressContext, {
          phase: 'warming-session',
          currentShopId: normalizeText(shopSummary && shopSummary.shopId),
          currentShopName: normalizeText(shopSummary && shopSummary.shopName),
          message: `${requestLabel}\u767b\u5f55\u72b6\u6001\u672a\u5c31\u7eea\uff0c\u6b63\u5728\u91cd\u65b0\u5237\u65b0\u76ee\u6807\u533a\u57df\u4f1a\u8bdd`
        }, progressEmitter);
        cookieSnapshot = await ensureRegionCookieSnapshot(shopSummary, normalizedRegion, {
          sessionContext,
          forceRefresh: true,
          queryJob,
          progressContext,
          emitProgress: progressEmitter
        });
        await createCancelableDelay(queryJob, retryDelayMs);
        continue;
      }

      if (parsedPayload.authRequired !== true) {
        const responseStatus = Number(parsedPayload && parsedPayload.httpStatus) || 0;
        throw new Error(
          normalizeText(parsedPayload.message)
          || (responseStatus > 0 ? `${requestLabel}\u63a5\u53e3\u8fd4\u56de HTTP ${responseStatus}` : '')
          || '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );
      }

      throw new Error(
        '\u76ee\u6807\u533a\u57df\u767b\u5f55\u72b6\u6001\u4ecd\u672a\u5c31\u7eea\uff0c\u5df2\u81ea\u52a8\u5237\u65b0\u5e76\u91cd\u8bd5\u591a\u6b21\uff0c\u8bf7\u786e\u8ba4\u5e97\u94fa\u5356\u5bb6\u4e2d\u5fc3\u5df2\u5b8c\u6210\u767b\u5f55\u540e\u518d\u63d0\u4ea4\u3002'
      );
    }

    throw new Error('\u5356\u5bb6\u4e2d\u5fc3\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u5148\u786e\u8ba4\u5bf9\u5e94\u5e97\u94fa\u5df2\u767b\u5f55\u540e\u518d\u91cd\u8bd5\u3002');
  }

  function splitSubmitProductsByReusableSkuPrice(products) {
    const reusableProducts = [];
    const hydrateProducts = [];

    (Array.isArray(products) ? products : []).forEach((productItem) => {
      if (productItem && productItem.forceSkuDetailHydrate === true) {
        hydrateProducts.push(productItem);
        return;
      }

      const sourceProductSkuCount = Array.from(new Set(
        (Array.isArray(productItem && productItem.sourceProductSkuIdList)
          ? productItem.sourceProductSkuIdList
          : []
        )
          .map((value) => normalizeText(value))
          .filter(Boolean)
      )).length;
      const submittedProductSkuCount = Array.from(new Set(
        (Array.isArray(productItem && productItem.skuPriceList)
          ? productItem.skuPriceList
          : []
        )
          .map((skuItem) => normalizeText(skuItem && skuItem.productSkuId))
          .filter(Boolean)
      )).length;

      if (sourceProductSkuCount > 0 && submittedProductSkuCount > 0 && submittedProductSkuCount < sourceProductSkuCount) {
        hydrateProducts.push(productItem);
        return;
      }

      const reusableProduct = normalizeFlowPriceSubmitProductForRequest(productItem);

      if (reusableProduct) {
        reusableProducts.push(reusableProduct);
        return;
      }

      hydrateProducts.push(productItem);
    });

    return {
      reusableProducts,
      hydrateProducts
    };
  }

  function buildFlowPriceSubmitPayload(productChunk) {
    return {
      productList: (Array.isArray(productChunk) ? productChunk : [])
        .map((productItem) => normalizeFlowPriceSubmitProductForRequest(productItem))
        .filter(Boolean)
        .map((productItem) => ({
          siteId: productItem.siteId,
          productId: productItem.productId,
          isAutoRenew: productItem.isAutoRenew,
          increaseFlowLevel: productItem.increaseFlowLevel,
          increaseFlowDays: productItem.increaseFlowDays,
          skuPriceList: (Array.isArray(productItem && productItem.skuPriceList)
            ? productItem.skuPriceList
            : []
          )
            .map((skuItem) => normalizeFlowPriceSubmitSkuForBatchPayload(
              skuItem,
              productItem && productItem.increaseFlowLevel
            ))
            .filter(Boolean)
        }))
        .filter((productItem) => Array.isArray(productItem.skuPriceList) && productItem.skuPriceList.length > 0)
    };
  }

  function buildFlowPriceSingleProductSubmitPayload(productItem) {
    const normalizedProduct = normalizeFlowPriceSubmitProductForRequest(productItem);

    if (!normalizedProduct) {
      return null;
    }

    const skuPriceList = (Array.isArray(normalizedProduct && normalizedProduct.skuPriceList)
      ? normalizedProduct.skuPriceList
      : []
    )
      .map((skuItem) => normalizeFlowPriceSubmitSkuForRequest(
        skuItem,
        normalizedProduct && normalizedProduct.increaseFlowLevel
      ))
      .filter(Boolean);

    if (skuPriceList.length <= 0) {
      return null;
    }

    return {
      siteId: normalizedProduct.siteId,
      productId: normalizedProduct.productId,
      isAutoRenew: normalizedProduct.isAutoRenew,
      increaseFlowLevel: normalizedProduct.increaseFlowLevel,
      increaseFlowDays: normalizedProduct.increaseFlowDays,
      skuPriceList
    };
  }

  function extractFlowPriceSubmitWithoutSkuId(message) {
    const matched = normalizeText(message).match(/without\s+sku\s*:?\s*(\d+)/i);
    return matched ? normalizeText(matched[1]) : '';
  }

  function extractFlowPriceSubmitHigherCustomPriceSkuId(message) {
    const matched = normalizeText(message).match(/submit\s+higher\s+custom\s+price\s*,?\s*sku\s*:?\s*(\d+)/i);
    return matched ? normalizeText(matched[1]) : '';
  }

  function buildFlowPriceSubmitHigherCustomPriceMessage(skuId) {
    const normalizedSkuId = normalizeText(skuId);

    return normalizedSkuId
      ? `SKU ${normalizedSkuId}\u81ea\u5b9a\u4e49\u63d0\u4ea4\u4ef7\u9ad8\u4e8e\u5e73\u53f0\u5141\u8bb8\u4ef7\uff0c\u5df2\u8df3\u8fc7\u8be5SKU`
      : '\u81ea\u5b9a\u4e49\u63d0\u4ea4\u4ef7\u9ad8\u4e8e\u5e73\u53f0\u5141\u8bb8\u4ef7\uff0c\u8be5\u5546\u54c1\u5df2\u8df3\u8fc7';
  }

  function shouldRetryFlowPriceSingleSubmitWithBatchPayload(error) {
    const message = normalizeText(error && error.message);

    return /product\s+list\s+must\s+not\s+be\s+null|product\s*list\s*(?:is\s*)?null|productList\s*(?:is\s*)?null|HTTP\s+404/i.test(message);
  }

  function doesFlowPriceSubmitProductMatchWithoutSkuId(productItem, withoutSkuId) {
    const normalizedWithoutSkuId = normalizeText(withoutSkuId);

    if (!normalizedWithoutSkuId) {
      return false;
    }

    return (Array.isArray(productItem && productItem.skuPriceList) ? productItem.skuPriceList : [])
      .some((skuItem) => normalizeText(skuItem && skuItem.productSkuId) === normalizedWithoutSkuId);
  }

  function doesFlowPriceSubmitProductExpectSkuId(productItem, skuId) {
    const normalizedSkuId = normalizeText(skuId);

    if (!normalizedSkuId) {
      return false;
    }

    if (doesFlowPriceSubmitProductMatchWithoutSkuId(productItem, normalizedSkuId) === true) {
      return true;
    }

    return (Array.isArray(productItem && productItem.expectedProductSkuIdList)
      ? productItem.expectedProductSkuIdList
      : []
    )
      .some((item) => normalizeText(item) === normalizedSkuId);
  }

  function doesFlowPriceSubmitProductSourceHaveSkuId(productItem, skuId) {
    const normalizedSkuId = normalizeText(skuId);

    if (!normalizedSkuId) {
      return false;
    }

    return (Array.isArray(productItem && productItem.sourceProductSkuIdList)
      ? productItem.sourceProductSkuIdList
      : []
    )
      .some((item) => normalizeText(item) === normalizedSkuId);
  }

  function removeFlowPriceSubmitProductSkuReferences(productItem, skuId, options = {}) {
    const normalizedSkuId = normalizeText(skuId);
    const shouldRemoveSkuPrice = options.removeSkuPrice !== false;
    const skuPriceList = Array.isArray(productItem && productItem.skuPriceList)
      ? productItem.skuPriceList
      : [];
    const expectedProductSkuIdList = (Array.isArray(productItem && productItem.expectedProductSkuIdList)
      ? productItem.expectedProductSkuIdList
      : []
    )
      .map((item) => normalizeText(item))
      .filter(Boolean);
    const sourceProductSkuIdList = (Array.isArray(productItem && productItem.sourceProductSkuIdList)
      ? productItem.sourceProductSkuIdList
      : []
    )
      .map((item) => normalizeText(item))
      .filter(Boolean);

    if (!normalizedSkuId) {
      return {
        removed: false,
        removedFromSkuPriceList: false,
        removedFromExpectedList: false,
        removedFromSourceList: false,
        product: productItem
      };
    }

    const nextSkuPriceList = shouldRemoveSkuPrice
      ? skuPriceList.filter((skuItem) => normalizeText(skuItem && skuItem.productSkuId) !== normalizedSkuId)
      : skuPriceList.slice();
    const nextExpectedProductSkuIdList = expectedProductSkuIdList
      .filter((item) => item !== normalizedSkuId);
    const nextSourceProductSkuIdList = sourceProductSkuIdList
      .filter((item) => item !== normalizedSkuId);
    const removedFromSkuPriceList = shouldRemoveSkuPrice && nextSkuPriceList.length !== skuPriceList.length;
    const removedFromExpectedList = nextExpectedProductSkuIdList.length !== expectedProductSkuIdList.length;
    const removedFromSourceList = nextSourceProductSkuIdList.length !== sourceProductSkuIdList.length;
    const removed = removedFromSkuPriceList || removedFromExpectedList || removedFromSourceList;

    if (!removed) {
      return {
        removed: false,
        removedFromSkuPriceList: false,
        removedFromExpectedList: false,
        removedFromSourceList: false,
        product: productItem
      };
    }

    if (shouldRemoveSkuPrice && skuPriceList.length > 0 && nextSkuPriceList.length <= 0) {
      return {
        removed: true,
        removedFromSkuPriceList,
        removedFromExpectedList,
        removedFromSourceList,
        product: null
      };
    }

    return {
      removed: true,
      removedFromSkuPriceList,
      removedFromExpectedList,
      removedFromSourceList,
      product: {
        ...productItem,
        expectedProductSkuIdList: nextExpectedProductSkuIdList,
        sourceProductSkuIdList: nextSourceProductSkuIdList,
        removedWithoutSkuId: normalizedSkuId,
        skuPriceList: nextSkuPriceList
      }
    };
  }

  function pruneFlowPriceSubmitProductWithoutSku(productItem, withoutSkuId) {
    const removeResult = removeFlowPriceSubmitProductSkuReferences(productItem, withoutSkuId, {
      removeSkuPrice: true
    });

    if (removeResult.removedFromSkuPriceList !== true) {
      return {
        removed: false,
        product: productItem
      };
    }

    return {
      removed: true,
      product: removeResult.product
    };
  }

  function buildFlowPriceSubmitSkuCoverageSummary(productItem) {
    const expectedSkuIdList = Array.from(new Set(
      (Array.isArray(productItem && productItem.expectedProductSkuIdList)
        ? productItem.expectedProductSkuIdList
        : []
      )
        .map((value) => normalizeText(value))
        .filter(Boolean)
    ));
    const submittedSkuIdList = Array.from(new Set(
      (Array.isArray(productItem && productItem.skuPriceList)
        ? productItem.skuPriceList
        : []
      )
        .map((skuItem) => normalizeText(skuItem && skuItem.productSkuId))
        .filter(Boolean)
    ));
    const submittedSkuIdSet = new Set(submittedSkuIdList);
    const missingSkuIdList = expectedSkuIdList
      .filter((skuId) => !submittedSkuIdSet.has(skuId));

    return {
      expectedSkuCount: expectedSkuIdList.length,
      submittedSkuCount: submittedSkuIdList.length,
      missingSkuCount: missingSkuIdList.length,
      missingSkuIdList
    };
  }

  function buildFlowPriceSubmitFailedProduct(shopSummary, marketRegion, productItem, message) {
    const withoutSkuId = normalizeText(productItem && productItem.withoutSkuId)
      || extractFlowPriceSubmitWithoutSkuId(message);
    const higherCustomPriceSkuId = normalizeText(productItem && productItem.higherCustomPriceSkuId)
      || extractFlowPriceSubmitHigherCustomPriceSkuId(message);
    const coverageSummary = buildFlowPriceSubmitSkuCoverageSummary(productItem);
    const displayMessage = withoutSkuId
      ? (
        coverageSummary.missingSkuCount > 0
          ? `SKU\u660e\u7ec6\u4e0d\u5b8c\u6574\uff0c\u5f53\u524d\u4ec5\u5305\u542b ${coverageSummary.submittedSkuCount}/${coverageSummary.expectedSkuCount} \u4e2aSKU\uff0c\u7f3a\u5c11SKU ${withoutSkuId}`
          : `\u5e73\u53f0\u8fd4\u56de\u9700\u8981SKU ${withoutSkuId}\uff0c\u4f46\u8be5SKU\u672a\u5728\u672c\u6b21\u901a\u8fc7\u9884\u68c0\u7684SKU\u5185\uff0c\u8be5\u5546\u54c1\u5df2\u8df3\u8fc7`
      )
      : (
        higherCustomPriceSkuId
          ? buildFlowPriceSubmitHigherCustomPriceMessage(higherCustomPriceSkuId)
          : normalizeText(message)
      );

    return {
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      marketRegion: normalizeMarketRegion(marketRegion),
      siteId: normalizeText(productItem && productItem.siteId),
      productId: normalizeText(productItem && productItem.productId),
      productName: normalizeText(productItem && productItem.productName),
      withoutSkuId,
      higherCustomPriceSkuId,
      expectedSkuCount: coverageSummary.expectedSkuCount,
      submittedSkuCount: coverageSummary.submittedSkuCount,
      missingSkuCount: coverageSummary.missingSkuCount,
      missingSkuIdList: coverageSummary.missingSkuIdList,
      message: displayMessage
    };
  }

  async function submitFlowPriceSingleProductFallback(sessionContext, shopSummary, marketRegion, productItem, options = {}) {
    const normalizedProduct = normalizeFlowPriceSubmitProductForRequest(productItem);
    const requestPayload = buildFlowPriceSingleProductSubmitPayload(normalizedProduct);
    const withoutSkuId = normalizeText(options && options.withoutSkuId);
    const initialCookieSnapshot = options.initialCookieSnapshot && typeof options.initialCookieSnapshot === 'object'
      ? options.initialCookieSnapshot
      : null;

    if (!normalizedProduct || !requestPayload) {
      return {
        successProducts: [],
        failProducts: [
          buildFlowPriceSubmitFailedProduct(
            shopSummary,
            marketRegion,
            {
              ...(productItem || {}),
              withoutSkuId
            },
            '\u7f3a\u5c11\u53ef\u7528\u7684\u5355\u5546\u54c1\u63d0\u4ea4SKU\u4ef7\u683c'
          )
        ],
        cookieSnapshot: initialCookieSnapshot
      };
    }

    const coverageSummary = buildFlowPriceSubmitSkuCoverageSummary(normalizedProduct);

    log('operations_traffic_boost_submit_single_product_fallback_start', {
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      marketRegion: normalizeMarketRegion(marketRegion),
      productId: normalizeText(normalizedProduct && normalizedProduct.productId),
      siteId: normalizeText(normalizedProduct && normalizedProduct.siteId),
      withoutSkuId,
      submittedSkuCount: coverageSummary.submittedSkuCount,
      expectedSkuCount: coverageSummary.expectedSkuCount,
      missingSkuCount: coverageSummary.missingSkuCount,
      skuIdList: requestPayload.skuPriceList
        .slice(0, 10)
        .map((skuItem) => normalizeText(skuItem && skuItem.productSkuId))
        .filter(Boolean)
    });

    const buildSingleProductSubmitResult = (response, fallbackFailMessage) => {
      const resultPayload = response && response.data && response.data.result && typeof response.data.result === 'object'
        ? response.data.result
        : {};
      const productId = normalizeText(normalizedProduct && normalizedProduct.productId);
      const successProductIdSet = new Set(
        (Array.isArray(resultPayload && resultPayload.successProductIdList) ? resultPayload.successProductIdList : [])
          .map((value) => normalizeText(value))
          .filter(Boolean)
      );
      const failProductList = Array.isArray(resultPayload && resultPayload.failProductList)
        ? resultPayload.failProductList
        : [];
      const failProductItem = failProductList.find((item) => {
        const failedProductId = normalizeText(item && (item.productId || item.spuId));
        return !failedProductId || failedProductId === productId;
      });

      if (failProductItem) {
        return {
          successProducts: [],
          failProducts: [
            buildFlowPriceSubmitFailedProduct(
              shopSummary,
              marketRegion,
              {
                ...normalizedProduct,
                withoutSkuId
              },
              normalizeText(failProductItem && (
                failProductItem.reason
                || failProductItem.msg
                || failProductItem.message
                || failProductItem.failReason
              )) || fallbackFailMessage
            )
          ],
          cookieSnapshot: (response && response.cookieSnapshot) || initialCookieSnapshot
        };
      }

      if (successProductIdSet.size > 0 && !successProductIdSet.has(productId)) {
        return {
          successProducts: [],
          failProducts: [
            buildFlowPriceSubmitFailedProduct(
              shopSummary,
              marketRegion,
              {
                ...normalizedProduct,
                withoutSkuId
              },
              '\u5355\u5546\u54c1\u63a5\u53e3\u672a\u8fd4\u56de\u8be5\u5546\u54c1\u7684\u6210\u529f\u7ed3\u679c'
            )
          ],
          cookieSnapshot: (response && response.cookieSnapshot) || initialCookieSnapshot
        };
      }

      return {
        successProducts: [normalizedProduct],
        failProducts: [],
        cookieSnapshot: (response && response.cookieSnapshot) || initialCookieSnapshot
      };
    };

    try {
      const productLabel = normalizeText(normalizedProduct && normalizedProduct.productId)
        || '\u5f53\u524d\u5546\u54c1';
      const response = await executeFlowPriceSubmitRequest(
        sessionContext,
        shopSummary,
        marketRegion,
        requestPayload,
        {
          ...options,
          initialCookieSnapshot,
          requestUrlByRegion: FLOW_PRICE_SINGLE_SUBMIT_URL_BY_REGION,
          fallbackRequestPath: '/api/kiana/marvel-mms/cyborg/increase/flow/submitIncreaseFlowPriceInfo',
          requestLabel: normalizeText(options && options.requestLabel)
            || `${productLabel}\u5355\u5546\u54c1\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4`,
          requestStartMessage: normalizeText(options && options.requestStartMessage)
            || `\u6b63\u5728\u4f7f\u7528\u5355\u5546\u54c1\u683c\u5f0f\u63d0\u4ea4 ${productLabel}`
        }
      );
      return buildSingleProductSubmitResult(response, '\u5355\u5546\u54c1\u63d0\u4ea4\u5931\u8d25');
    } catch (error) {
      if (isQueryCanceledError(error)) {
        throw error;
      }

      if (shouldRetryFlowPriceSingleSubmitWithBatchPayload(error) === true) {
        const batchRequestPayload = buildFlowPriceSubmitPayload([normalizedProduct]);

        if (Array.isArray(batchRequestPayload && batchRequestPayload.productList) && batchRequestPayload.productList.length > 0) {
          try {
            log('operations_traffic_boost_submit_single_product_batch_payload_retry', {
              shopId: normalizeText(shopSummary && shopSummary.shopId),
              shopName: normalizeText(shopSummary && shopSummary.shopName),
              marketRegion: normalizeMarketRegion(marketRegion),
              productId: normalizeText(normalizedProduct && normalizedProduct.productId),
              siteId: normalizeText(normalizedProduct && normalizedProduct.siteId),
              withoutSkuId,
              reason: normalizeText(error && error.message)
            });

            const batchResponse = await executeFlowPriceSubmitRequest(
              sessionContext,
              shopSummary,
              marketRegion,
              batchRequestPayload,
              {
                ...options,
                initialCookieSnapshot,
                requestLabel: `${normalizeText(normalizedProduct && normalizedProduct.productId) || '\u5f53\u524d\u5546\u54c1'}\u5355\u5546\u54c1\u517c\u5bb9\u683c\u5f0f\u63d0\u4ea4`,
                requestStartMessage: `\u5355\u5546\u54c1\u63a5\u53e3\u672a\u63a5\u53d7\u5f53\u524d\u683c\u5f0f\uff0c\u6b63\u5728\u4f7f\u7528 productList \u517c\u5bb9\u683c\u5f0f\u91cd\u8bd5 ${normalizeText(normalizedProduct && normalizedProduct.productId) || '\u5f53\u524d\u5546\u54c1'}`
              }
            );

            return buildSingleProductSubmitResult(batchResponse, '\u5355\u5546\u54c1\u517c\u5bb9\u683c\u5f0f\u63d0\u4ea4\u5931\u8d25');
          } catch (batchError) {
            if (isQueryCanceledError(batchError)) {
              throw batchError;
            }

            logError('operations_traffic_boost_submit_single_product_batch_payload_retry_failed', batchError, {
              shopId: normalizeText(shopSummary && shopSummary.shopId),
              shopName: normalizeText(shopSummary && shopSummary.shopName),
              marketRegion: normalizeMarketRegion(marketRegion),
              productId: normalizeText(normalizedProduct && normalizedProduct.productId),
              siteId: normalizeText(normalizedProduct && normalizedProduct.siteId),
              withoutSkuId
            });

            return {
              successProducts: [],
              failProducts: [
                buildFlowPriceSubmitFailedProduct(
                  shopSummary,
                  marketRegion,
                  {
                    ...normalizedProduct,
                    withoutSkuId: withoutSkuId || extractFlowPriceSubmitWithoutSkuId(batchError && batchError.message)
                  },
                  normalizeText(batchError && batchError.message) || '\u5355\u5546\u54c1\u517c\u5bb9\u683c\u5f0f\u63d0\u4ea4\u5931\u8d25'
                )
              ],
              cookieSnapshot: initialCookieSnapshot
            };
          }
        }
      }

      logError('operations_traffic_boost_submit_single_product_fallback_failed', error, {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        marketRegion: normalizeMarketRegion(marketRegion),
        productId: normalizeText(normalizedProduct && normalizedProduct.productId),
        siteId: normalizeText(normalizedProduct && normalizedProduct.siteId),
        withoutSkuId
      });

      return {
        successProducts: [],
        failProducts: [
          buildFlowPriceSubmitFailedProduct(
            shopSummary,
            marketRegion,
            {
              ...normalizedProduct,
              withoutSkuId: withoutSkuId || extractFlowPriceSubmitWithoutSkuId(error && error.message)
            },
            normalizeText(error && error.message) || '\u5355\u5546\u54c1\u63d0\u4ea4\u5931\u8d25'
          )
        ],
        cookieSnapshot: initialCookieSnapshot
      };
    }
  }

  async function submitFlowPriceProductChunkWithFallback(sessionContext, shopSummary, marketRegion, productChunk, options = {}) {
    const droppedProductList = [];
    const normalizedProductChunk = (Array.isArray(productChunk) ? productChunk : [])
      .map((productItem) => {
        const normalizedProduct = normalizeFlowPriceSubmitProductForRequest(productItem);

        if (!normalizedProduct) {
          droppedProductList.push(productItem);
        }

        return normalizedProduct;
      })
      .filter(Boolean);
    const initialCookieSnapshot = options.initialCookieSnapshot && typeof options.initialCookieSnapshot === 'object'
      ? options.initialCookieSnapshot
      : null;
    const droppedFailProducts = droppedProductList.map((productItem) => buildFlowPriceSubmitFailedProduct(
      shopSummary,
      marketRegion,
      productItem,
      '\u7f3a\u5c11\u53ef\u63d0\u4ea4\u7684SKU\u4ef7\u683c'
    ));

    if (normalizedProductChunk.length <= 0) {
      return {
        successProducts: [],
        failProducts: droppedFailProducts,
        cookieSnapshot: initialCookieSnapshot
      };
    }

    if (droppedProductList.length > 0) {
      log('operations_traffic_boost_submit_drop_invalid_product', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        marketRegion: normalizeMarketRegion(marketRegion),
        droppedCount: droppedProductList.length,
        productIdList: droppedProductList
          .slice(0, 10)
          .map((productItem) => normalizeText(productItem && productItem.productId))
          .filter(Boolean)
      });
    }

    const splitAndRetry = async (reasonLabel, reasonMessage, cookieSnapshot, retryProductChunk = normalizedProductChunk) => {
      const normalizedRetryProductChunk = Array.isArray(retryProductChunk)
        ? retryProductChunk.filter(Boolean)
        : [];

      if (normalizedRetryProductChunk.length <= 0) {
        return {
          successProducts: [],
          failProducts: [],
          cookieSnapshot
        };
      }

      if (normalizedRetryProductChunk.length <= 1) {
        return {
          successProducts: [],
          failProducts: [
            buildFlowPriceSubmitFailedProduct(
              shopSummary,
              marketRegion,
              normalizedRetryProductChunk[0],
              reasonMessage
            )
          ],
          cookieSnapshot
        };
      }

      const splitIndex = Math.ceil(normalizedRetryProductChunk.length / 2);
      const leftChunk = normalizedRetryProductChunk.slice(0, splitIndex);
      const rightChunk = normalizedRetryProductChunk.slice(splitIndex);

      log('operations_traffic_boost_submit_batch_split_retry', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        marketRegion: normalizeMarketRegion(marketRegion),
        reason: normalizeText(reasonLabel),
        batchSize: normalizedRetryProductChunk.length,
        leftBatchSize: leftChunk.length,
        rightBatchSize: rightChunk.length,
        message: normalizeText(reasonMessage)
      });

      const leftResult = await submitFlowPriceProductChunkWithFallback(
        sessionContext,
        shopSummary,
        marketRegion,
        leftChunk,
        {
          ...options,
          initialCookieSnapshot: cookieSnapshot
        }
      );
      const nextCookieSnapshot = leftResult && leftResult.cookieSnapshot
        ? leftResult.cookieSnapshot
        : cookieSnapshot;

      if (rightChunk.length > 0) {
        await createCancelableDelay(
          options.queryJob || null,
          randomIntegerBetween(SUBMIT_BATCH_DELAY_MIN_MS, SUBMIT_BATCH_DELAY_MAX_MS)
        );
      }

      const rightResult = await submitFlowPriceProductChunkWithFallback(
        sessionContext,
        shopSummary,
        marketRegion,
        rightChunk,
        {
          ...options,
          initialCookieSnapshot: nextCookieSnapshot
        }
      );

      return {
        successProducts: []
          .concat(Array.isArray(leftResult && leftResult.successProducts) ? leftResult.successProducts : [])
          .concat(Array.isArray(rightResult && rightResult.successProducts) ? rightResult.successProducts : []),
        failProducts: []
          .concat(Array.isArray(leftResult && leftResult.failProducts) ? leftResult.failProducts : [])
          .concat(Array.isArray(rightResult && rightResult.failProducts) ? rightResult.failProducts : []),
        deferredProducts: []
          .concat(Array.isArray(leftResult && leftResult.deferredProducts) ? leftResult.deferredProducts : [])
          .concat(Array.isArray(rightResult && rightResult.deferredProducts) ? rightResult.deferredProducts : []),
        cookieSnapshot: (rightResult && rightResult.cookieSnapshot)
          || (leftResult && leftResult.cookieSnapshot)
          || nextCookieSnapshot
      };
    };

    try {
      const requestPayload = buildFlowPriceSubmitPayload(normalizedProductChunk);

      if (!Array.isArray(requestPayload.productList) || requestPayload.productList.length <= 0) {
        return {
          successProducts: [],
          failProducts: droppedFailProducts.concat(
            normalizedProductChunk.map((productItem) => buildFlowPriceSubmitFailedProduct(
              shopSummary,
              marketRegion,
              productItem,
              '\u7f3a\u5c11\u53ef\u63d0\u4ea4\u7684SKU\u4ef7\u683c'
            ))
          ),
          cookieSnapshot: initialCookieSnapshot
        };
      }

      const sourceProductByKey = new Map(
        normalizedProductChunk
          .map((productItem) => [
            buildTrafficBoostSubmitProductKey(productItem && productItem.productId, productItem && productItem.siteId),
            productItem
          ])
          .filter((item) => item[0] && item[0] !== ':')
      );

      log('operations_traffic_boost_submit_payload_summary', {
        shopId: normalizeText(shopSummary && shopSummary.shopId),
        shopName: normalizeText(shopSummary && shopSummary.shopName),
        marketRegion: normalizeMarketRegion(marketRegion),
        productCount: requestPayload.productList.length,
        productList: requestPayload.productList.slice(0, 5).map((productItem) => {
          const sourceProduct = sourceProductByKey.get(buildTrafficBoostSubmitProductKey(
            productItem && productItem.productId,
            productItem && productItem.siteId
          )) || productItem;
          const coverageSummary = buildFlowPriceSubmitSkuCoverageSummary(sourceProduct);
          const payloadSkuPriceList = Array.isArray(productItem && productItem.skuPriceList)
            ? productItem.skuPriceList
            : [];

          return {
            productId: normalizeText(productItem && productItem.productId),
            siteId: normalizeText(productItem && productItem.siteId),
            increaseFlowLevel: normalizeIntegerValue(productItem && productItem.increaseFlowLevel, 0),
            skuCount: payloadSkuPriceList.length,
            expectedSkuCount: coverageSummary.expectedSkuCount,
            missingSkuCount: coverageSummary.missingSkuCount,
            missingSkuIdList: coverageSummary.missingSkuIdList.slice(0, 5),
            skuIdList: payloadSkuPriceList
              .slice(0, 5)
              .map((skuItem) => normalizeText(skuItem && skuItem.productSkuId))
              .filter(Boolean),
            hasPreSupplierPrice: payloadSkuPriceList
              .some((skuItem) => normalizeIntegerValue(skuItem && skuItem.preSupplierPrice, 0) > 0),
            samePriceSkuCount: payloadSkuPriceList
              .filter((skuItem) => (
                normalizeIntegerValue(skuItem && skuItem.preSupplierPrice, 0) > 0
                && normalizeIntegerValue(skuItem && skuItem.preSupplierPrice, 0)
                  === normalizeIntegerValue(skuItem && skuItem.supplierPrice, 0)
              )).length,
            hasCustomFlowSupplierPrice: payloadSkuPriceList
              .some((skuItem) => normalizeIntegerValue(skuItem && skuItem.customFlowSupplierPrice, 0) > 0),
            hasTargetSupplierPrice: payloadSkuPriceList
              .some((skuItem) => normalizeIntegerValue(skuItem && skuItem.targetSupplierPrice, 0) > 0)
          };
        })
      });

      const response = await executeFlowPriceSubmitRequest(
        sessionContext,
        shopSummary,
        marketRegion,
        requestPayload,
        options
      );
      const resultPayload = response && response.data && response.data.result && typeof response.data.result === 'object'
        ? response.data.result
        : {};
      const successProductIdSet = new Set(
        (Array.isArray(resultPayload && resultPayload.successProductIdList) ? resultPayload.successProductIdList : [])
          .map((value) => normalizeText(value))
          .filter(Boolean)
      );
      const failProductList = Array.isArray(resultPayload && resultPayload.failProductList)
        ? resultPayload.failProductList
        : [];
      const failProductMap = new Map();
      const successProducts = [];
      const failProducts = [];
      const unresolvedProducts = [];
      const skuRejectedRetryProducts = [];
      const skuRejectedExhaustedProducts = [];
      let skuRejectedPrunedProductCount = 0;

      failProductList.forEach((item) => {
        const productId = normalizeText(item && (item.productId || item.spuId));

        if (!productId) {
          return;
        }

        failProductMap.set(productId, normalizeText(item && (item.reason || item.msg || item.message || item.failReason)));
      });

      normalizedProductChunk.forEach((productItem) => {
        const productId = normalizeText(productItem && productItem.productId);

        if (successProductIdSet.has(productId)) {
          successProducts.push(productItem);
          return;
        }

        if (failProductMap.has(productId)) {
          const failMessage = failProductMap.get(productId) || '\u63d0\u4ea4\u5931\u8d25';
          const higherCustomPriceSkuId = extractFlowPriceSubmitHigherCustomPriceSkuId(failMessage);
          const withoutSkuId = extractFlowPriceSubmitWithoutSkuId(failMessage);
          const skuRejectedId = higherCustomPriceSkuId || withoutSkuId;

          if (skuRejectedId) {
            const pruneResult = pruneFlowPriceSubmitProductWithoutSku(productItem, skuRejectedId);

            if (pruneResult.removed === true) {
              skuRejectedPrunedProductCount += 1;

              if (pruneResult.product) {
                skuRejectedRetryProducts.push(pruneResult.product);
              } else {
                skuRejectedExhaustedProducts.push({
                  ...productItem,
                  withoutSkuId,
                  higherCustomPriceSkuId,
                  message: failMessage
                });
              }
              return;
            }
          }

          failProducts.push(buildFlowPriceSubmitFailedProduct(
            shopSummary,
            marketRegion,
            productItem,
            failMessage
          ));
          return;
        }

        unresolvedProducts.push(productItem);
      });

      let nextCookieSnapshot = (response && response.cookieSnapshot) || initialCookieSnapshot;
      const skuRejectedRetrySuccessProducts = [];
      const skuRejectedRetryFailProducts = [];
      const skuRejectedRetryDeferredProducts = [];

      if (skuRejectedRetryProducts.length > 0 || skuRejectedExhaustedProducts.length > 0) {
        log('operations_traffic_boost_submit_result_sku_rejected_pruned_retry', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          shopName: normalizeText(shopSummary && shopSummary.shopName),
          marketRegion: normalizeMarketRegion(marketRegion),
          batchSize: normalizedProductChunk.length,
          prunedProductCount: skuRejectedPrunedProductCount,
          retryProductCount: skuRejectedRetryProducts.length,
          exhaustedProductCount: skuRejectedExhaustedProducts.length,
          exhaustedProductList: skuRejectedExhaustedProducts.slice(0, 5).map((productItem) => ({
            productId: normalizeText(productItem && productItem.productId),
            siteId: normalizeText(productItem && productItem.siteId),
            withoutSkuId: normalizeText(productItem && productItem.withoutSkuId),
            higherCustomPriceSkuId: normalizeText(productItem && productItem.higherCustomPriceSkuId)
          }))
        });
      }

      if (skuRejectedRetryProducts.length > 0) {
        await createCancelableDelay(
          options.queryJob || null,
          randomIntegerBetween(SUBMIT_BATCH_DELAY_MIN_MS, SUBMIT_BATCH_DELAY_MAX_MS)
        );

        const skuRejectedRetryResult = await submitFlowPriceProductChunkWithFallback(
          sessionContext,
          shopSummary,
          marketRegion,
          skuRejectedRetryProducts,
          {
            ...options,
            initialCookieSnapshot: nextCookieSnapshot
          }
        );

        nextCookieSnapshot = (skuRejectedRetryResult && skuRejectedRetryResult.cookieSnapshot) || nextCookieSnapshot;
        skuRejectedRetrySuccessProducts.push(
          ...(Array.isArray(skuRejectedRetryResult && skuRejectedRetryResult.successProducts)
            ? skuRejectedRetryResult.successProducts
            : [])
        );
        skuRejectedRetryFailProducts.push(
          ...(Array.isArray(skuRejectedRetryResult && skuRejectedRetryResult.failProducts)
            ? skuRejectedRetryResult.failProducts
            : [])
        );
        skuRejectedRetryDeferredProducts.push(
          ...(Array.isArray(skuRejectedRetryResult && skuRejectedRetryResult.deferredProducts)
            ? skuRejectedRetryResult.deferredProducts
            : [])
        );
      }

      const skuRejectedExhaustedFailProducts = skuRejectedExhaustedProducts.map((productItem) => buildFlowPriceSubmitFailedProduct(
        shopSummary,
        marketRegion,
        productItem,
        normalizeText(productItem && productItem.message) || '\u63d0\u4ea4\u5931\u8d25'
      ));

      if (unresolvedProducts.length > 0) {
        const fallbackReason = '\u63a5\u53e3\u672a\u8fd4\u56de\u8be5\u5546\u54c1\u7684\u63d0\u4ea4\u6210\u529f\u7ed3\u679c';

        if (
          unresolvedProducts.length < normalizedProductChunk.length
          && PARTIAL_SUBMIT_RESULT_RETRY_DELAY_MS > 0
        ) {
          await createCancelableDelay(options.queryJob || null, PARTIAL_SUBMIT_RESULT_RETRY_DELAY_MS);
        }

        const retryResult = await splitAndRetry(
          'missing-success-result',
          fallbackReason,
          nextCookieSnapshot,
          unresolvedProducts
        );

        return {
          successProducts: successProducts.concat(
            skuRejectedRetrySuccessProducts
          ).concat(
            Array.isArray(retryResult && retryResult.successProducts) ? retryResult.successProducts : []
          ),
          failProducts: droppedFailProducts.concat(failProducts).concat(
            skuRejectedExhaustedFailProducts
          ).concat(
            skuRejectedRetryFailProducts
          ).concat(
            Array.isArray(retryResult && retryResult.failProducts) ? retryResult.failProducts : []
          ),
          deferredProducts: skuRejectedRetryDeferredProducts.concat(
            Array.isArray(retryResult && retryResult.deferredProducts)
              ? retryResult.deferredProducts
              : []
          ),
          cookieSnapshot: (retryResult && retryResult.cookieSnapshot)
            || nextCookieSnapshot
        };
      }

      return {
        successProducts: successProducts.concat(skuRejectedRetrySuccessProducts),
        failProducts: droppedFailProducts.concat(failProducts).concat(
          skuRejectedExhaustedFailProducts
        ).concat(skuRejectedRetryFailProducts),
        deferredProducts: skuRejectedRetryDeferredProducts,
        cookieSnapshot: nextCookieSnapshot
      };
    } catch (error) {
      if (shouldSplitFlowPriceSubmitError(error) !== true) {
        throw error;
      }

      const errorMessage = normalizeText(error && error.message) || '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u5931\u8d25';
      const withoutSkuId = extractFlowPriceSubmitWithoutSkuId(errorMessage);

      if (withoutSkuId) {
        const retryProducts = [];
        const exhaustedProducts = [];
        const missingSkuProducts = [];
        const singleFallbackProducts = [];
        let prunedProductCount = 0;

        normalizedProductChunk.forEach((productItem) => {
          const pruneResult = pruneFlowPriceSubmitProductWithoutSku(productItem, withoutSkuId);

          if (pruneResult.removed === true) {
            prunedProductCount += 1;

            if (pruneResult.product) {
              retryProducts.push(pruneResult.product);
            } else {
              exhaustedProducts.push({
                ...productItem,
                withoutSkuId
              });
            }
            return;
          }

          if (
            doesFlowPriceSubmitProductExpectSkuId(productItem, withoutSkuId) === true
            || doesFlowPriceSubmitProductSourceHaveSkuId(productItem, withoutSkuId) === true
          ) {
            const removeSkuReferenceResult = removeFlowPriceSubmitProductSkuReferences(productItem, withoutSkuId, {
              removeSkuPrice: false
            });

            singleFallbackProducts.push({
              ...(removeSkuReferenceResult.product || productItem),
              withoutSkuId
            });
            return;
          }

          retryProducts.push(productItem);
        });

        if (prunedProductCount > 0 || missingSkuProducts.length > 0 || singleFallbackProducts.length > 0) {
          log('operations_traffic_boost_submit_without_sku_pruned_retry', {
            shopId: normalizeText(shopSummary && shopSummary.shopId),
            shopName: normalizeText(shopSummary && shopSummary.shopName),
            marketRegion: normalizeMarketRegion(marketRegion),
            withoutSkuId,
            batchSize: normalizedProductChunk.length,
            prunedProductCount,
            retryProductCount: retryProducts.length,
            exhaustedProductCount: exhaustedProducts.length,
            missingSkuProductCount: missingSkuProducts.length,
            singleFallbackProductCount: singleFallbackProducts.length,
            missingSkuProductList: missingSkuProducts.slice(0, 5).map((productItem) => {
              const coverageSummary = buildFlowPriceSubmitSkuCoverageSummary(productItem);

              return {
                productId: normalizeText(productItem && productItem.productId),
                siteId: normalizeText(productItem && productItem.siteId),
                productName: normalizeText(productItem && productItem.productName),
                expectedSkuCount: coverageSummary.expectedSkuCount,
                submittedSkuCount: coverageSummary.submittedSkuCount,
                missingSkuCount: coverageSummary.missingSkuCount,
                missingSkuIdList: coverageSummary.missingSkuIdList.slice(0, 5)
              };
            }),
            singleFallbackProductList: singleFallbackProducts.slice(0, 5).map((productItem) => {
              const coverageSummary = buildFlowPriceSubmitSkuCoverageSummary(productItem);

              return {
                productId: normalizeText(productItem && productItem.productId),
                siteId: normalizeText(productItem && productItem.siteId),
                productName: normalizeText(productItem && productItem.productName),
                expectedSkuCount: coverageSummary.expectedSkuCount,
                submittedSkuCount: coverageSummary.submittedSkuCount,
                missingSkuCount: coverageSummary.missingSkuCount,
                missingSkuIdList: coverageSummary.missingSkuIdList.slice(0, 5)
              };
            }),
            message: errorMessage
          });

          let nextCookieSnapshot = initialCookieSnapshot;
          const singleFallbackSuccessProducts = [];
          const singleFallbackFailProducts = [];

          for (let singleFallbackIndex = 0; singleFallbackIndex < singleFallbackProducts.length; singleFallbackIndex += 1) {
            const productItem = singleFallbackProducts[singleFallbackIndex];
            assertQueryJobActive(options.queryJob || null);

            if (singleFallbackIndex > 0) {
              await createCancelableDelay(
                options.queryJob || null,
                randomIntegerBetween(SUBMIT_BATCH_DELAY_MIN_MS, SUBMIT_BATCH_DELAY_MAX_MS)
              );
            }

            const singleFallbackResult = await submitFlowPriceSingleProductFallback(
              sessionContext,
              shopSummary,
              marketRegion,
              productItem,
              {
                ...options,
                initialCookieSnapshot: nextCookieSnapshot,
                withoutSkuId,
                requestLabel: `${normalizeText(productItem && productItem.productId) || '\u5f53\u524d\u5546\u54c1'}\u5355\u5546\u54c1\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4`,
                requestStartMessage: `\u5e73\u53f0\u8fd4\u56deSKU\u6821\u9a8c\u5dee\u5f02\uff0c\u6b63\u5728\u6539\u7528\u5355\u5546\u54c1\u683c\u5f0f\u63d0\u4ea4 ${normalizeText(productItem && productItem.productId) || '\u5f53\u524d\u5546\u54c1'}`
              }
            );

            nextCookieSnapshot = singleFallbackResult && singleFallbackResult.cookieSnapshot
              ? singleFallbackResult.cookieSnapshot
              : nextCookieSnapshot;
            singleFallbackSuccessProducts.push(
              ...(Array.isArray(singleFallbackResult && singleFallbackResult.successProducts)
                ? singleFallbackResult.successProducts
                : [])
            );
            singleFallbackFailProducts.push(
              ...(Array.isArray(singleFallbackResult && singleFallbackResult.failProducts)
                ? singleFallbackResult.failProducts
                : [])
            );
          }

          if (retryProducts.length <= 0) {
            return {
              successProducts: singleFallbackSuccessProducts,
              failProducts: droppedFailProducts.concat(
                exhaustedProducts.map((productItem) => buildFlowPriceSubmitFailedProduct(
                  shopSummary,
                  marketRegion,
                  productItem,
                  errorMessage
                ))
              ).concat(
                missingSkuProducts.map((productItem) => buildFlowPriceSubmitFailedProduct(
                  shopSummary,
                  marketRegion,
                  productItem,
                  errorMessage
                ))
              ).concat(singleFallbackFailProducts),
              cookieSnapshot: nextCookieSnapshot
            };
          }

          if (singleFallbackProducts.length > 0) {
            await createCancelableDelay(
              options.queryJob || null,
              randomIntegerBetween(SUBMIT_BATCH_DELAY_MIN_MS, SUBMIT_BATCH_DELAY_MAX_MS)
            );
          }

          const retryResult = await submitFlowPriceProductChunkWithFallback(
            sessionContext,
            shopSummary,
            marketRegion,
            retryProducts,
            {
              ...options,
              initialCookieSnapshot: nextCookieSnapshot
            }
          );

          return {
            successProducts: singleFallbackSuccessProducts.concat(
              Array.isArray(retryResult && retryResult.successProducts)
                ? retryResult.successProducts
                : []
            ),
            failProducts: droppedFailProducts.concat(
              []
                .concat(exhaustedProducts)
                .concat(missingSkuProducts)
                .map((productItem) => buildFlowPriceSubmitFailedProduct(
                  shopSummary,
                  marketRegion,
                  productItem,
                  errorMessage
                ))
            ).concat(
              Array.isArray(retryResult && retryResult.failProducts)
                ? retryResult.failProducts
                : []
            ).concat(singleFallbackFailProducts),
            deferredProducts: Array.isArray(retryResult && retryResult.deferredProducts)
              ? retryResult.deferredProducts
              : [],
            cookieSnapshot: (retryResult && retryResult.cookieSnapshot) || nextCookieSnapshot
          };
        }

        log('operations_traffic_boost_submit_without_sku_unmatched_batch_failed', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          shopName: normalizeText(shopSummary && shopSummary.shopName),
          marketRegion: normalizeMarketRegion(marketRegion),
          withoutSkuId,
          batchSize: normalizedProductChunk.length,
          message: errorMessage
        });

        const retryResult = await splitAndRetry(
          'without-sku-unmatched',
          errorMessage,
          initialCookieSnapshot
        );

        return {
          successProducts: Array.isArray(retryResult && retryResult.successProducts)
            ? retryResult.successProducts
            : [],
          failProducts: droppedFailProducts.concat(
            Array.isArray(retryResult && retryResult.failProducts)
              ? retryResult.failProducts
              : []
          ),
          deferredProducts: Array.isArray(retryResult && retryResult.deferredProducts)
            ? retryResult.deferredProducts
            : [],
          cookieSnapshot: (retryResult && retryResult.cookieSnapshot) || initialCookieSnapshot
        };
      }

      const higherCustomPriceSkuId = extractFlowPriceSubmitHigherCustomPriceSkuId(errorMessage);

      if (higherCustomPriceSkuId) {
        const retryProducts = [];
        const exhaustedProducts = [];
        let prunedProductCount = 0;

        normalizedProductChunk.forEach((productItem) => {
          const pruneResult = pruneFlowPriceSubmitProductWithoutSku(productItem, higherCustomPriceSkuId);

          if (pruneResult.removed === true) {
            prunedProductCount += 1;

            if (pruneResult.product) {
              retryProducts.push(pruneResult.product);
            } else {
              exhaustedProducts.push({
                ...productItem,
                higherCustomPriceSkuId
              });
            }
            return;
          }

          retryProducts.push(productItem);
        });

        if (prunedProductCount > 0) {
          log('operations_traffic_boost_submit_higher_custom_price_pruned_retry', {
            shopId: normalizeText(shopSummary && shopSummary.shopId),
            shopName: normalizeText(shopSummary && shopSummary.shopName),
            marketRegion: normalizeMarketRegion(marketRegion),
            higherCustomPriceSkuId,
            batchSize: normalizedProductChunk.length,
            prunedProductCount,
            retryProductCount: retryProducts.length,
            exhaustedProductCount: exhaustedProducts.length,
            message: errorMessage
          });

          if (retryProducts.length <= 0) {
            return {
              successProducts: [],
              failProducts: droppedFailProducts.concat(
                exhaustedProducts.map((productItem) => buildFlowPriceSubmitFailedProduct(
                  shopSummary,
                  marketRegion,
                  productItem,
                  errorMessage
                ))
              ),
              cookieSnapshot: initialCookieSnapshot
            };
          }

          await createCancelableDelay(
            options.queryJob || null,
            randomIntegerBetween(SUBMIT_BATCH_DELAY_MIN_MS, SUBMIT_BATCH_DELAY_MAX_MS)
          );

          const retryResult = await submitFlowPriceProductChunkWithFallback(
            sessionContext,
            shopSummary,
            marketRegion,
            retryProducts,
            {
              ...options,
              initialCookieSnapshot
            }
          );

          return {
            successProducts: Array.isArray(retryResult && retryResult.successProducts)
              ? retryResult.successProducts
              : [],
            failProducts: droppedFailProducts.concat(
              exhaustedProducts.map((productItem) => buildFlowPriceSubmitFailedProduct(
                shopSummary,
                marketRegion,
                productItem,
                errorMessage
              ))
            ).concat(
              Array.isArray(retryResult && retryResult.failProducts)
                ? retryResult.failProducts
                : []
            ),
            deferredProducts: Array.isArray(retryResult && retryResult.deferredProducts)
              ? retryResult.deferredProducts
              : [],
            cookieSnapshot: (retryResult && retryResult.cookieSnapshot) || initialCookieSnapshot
          };
        }

        log('operations_traffic_boost_submit_higher_custom_price_unmatched_batch_failed', {
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          shopName: normalizeText(shopSummary && shopSummary.shopName),
          marketRegion: normalizeMarketRegion(marketRegion),
          higherCustomPriceSkuId,
          batchSize: normalizedProductChunk.length,
          message: errorMessage
        });
      }

      const retryResult = await splitAndRetry('request-error', errorMessage, initialCookieSnapshot);

      return {
        successProducts: Array.isArray(retryResult && retryResult.successProducts)
          ? retryResult.successProducts
          : [],
        failProducts: droppedFailProducts.concat(
          Array.isArray(retryResult && retryResult.failProducts)
            ? retryResult.failProducts
            : []
        ),
        deferredProducts: Array.isArray(retryResult && retryResult.deferredProducts)
          ? retryResult.deferredProducts
          : [],
        cookieSnapshot: (retryResult && retryResult.cookieSnapshot) || initialCookieSnapshot
      };
    }
  }

  async function queryFlowPriceInfoMap(sessionContext, shopSummary, marketRegion, productList, options = {}) {
    const normalizedProductList = Array.from(new Map(
      (Array.isArray(productList) ? productList : [])
        .map((item) => ({
          productId: normalizeText(item && item.productId),
          siteId: normalizeText(item && item.siteId)
        }))
        .filter((item) => item.productId && item.siteId)
        .map((item) => [buildFlowPriceInfoKey(item.productId, item.siteId), item])
    ).values());

    const flowPriceInfoMap = new Map();
    const requestedProductKeySet = new Set();
    const failedProductKeySet = new Set();
    const warningMessages = [];

    if (normalizedProductList.length <= 0) {
      return {
        flowPriceInfoMap,
        requestedProductKeySet,
        failedProductKeySet,
        warnings: []
      };
    }

    let cookieSnapshot = options.initialCookieSnapshot && typeof options.initialCookieSnapshot === 'object'
      ? options.initialCookieSnapshot
      : null;
    const batchCount = Math.max(1, Math.ceil(normalizedProductList.length / FLOW_PRICE_INFO_BATCH_SIZE));

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const batchProductList = normalizedProductList.slice(
        batchIndex * FLOW_PRICE_INFO_BATCH_SIZE,
        (batchIndex + 1) * FLOW_PRICE_INFO_BATCH_SIZE
      );

      if (batchProductList.length <= 0) {
        continue;
      }

      const batchResult = await queryFlowPriceInfoBatchWithFallback(
        sessionContext,
        shopSummary,
        marketRegion,
        batchProductList,
        {
          queryJob: options.queryJob,
          progressContext: options.progressContext,
          emitProgress: options.emitProgress,
          initialCookieSnapshot: cookieSnapshot,
          pageNumber: options.pageNumber,
          batchIndex: batchIndex + 1,
          batchCount
        }
      );

      cookieSnapshot = batchResult && batchResult.cookieSnapshot ? batchResult.cookieSnapshot : cookieSnapshot;

      if (batchResult && batchResult.requestedProductKeySet instanceof Set) {
        batchResult.requestedProductKeySet.forEach((key) => {
          requestedProductKeySet.add(key);
        });
      }

      if (batchResult && batchResult.flowPriceInfoMap instanceof Map) {
        batchResult.flowPriceInfoMap.forEach((value, key) => {
          flowPriceInfoMap.set(key, value);
        });
      }

      if (batchResult && batchResult.failedProductKeySet instanceof Set) {
        batchResult.failedProductKeySet.forEach((key) => {
          failedProductKeySet.add(key);
        });
      }

      if (Array.isArray(batchResult && batchResult.warnings) && batchResult.warnings.length > 0) {
        warningMessages.push(...batchResult.warnings);
      }
    }

    const failedProductCount = failedProductKeySet.size;
    const warnings = [];

    if (failedProductCount > 0) {
      warnings.push(
        `${normalizeText(shopSummary && shopSummary.shopName) || normalizeText(shopSummary && shopSummary.shopId) || '\u5f53\u524d\u5e97\u94fa'} `
        + `\u7b2c ${Math.max(1, normalizeIntegerValue(options.pageNumber, 1))} \u9875\u6709 ${failedProductCount} \u4e2aSKU\u660e\u7ec6\u672a\u83b7\u53d6\u5230\uff0c\u5df2\u5148\u663e\u793a\u57fa\u7840\u4fe1\u606f\u3002`
      );
    }

    if (warningMessages.length > 0) {
      warnings.push(...warningMessages);
    }

    return {
      flowPriceInfoMap,
      requestedProductKeySet,
      failedProductKeySet,
      warnings
    };
  }

  async function hydrateSubmitProductsWithFlowPriceInfo(shopSummary, marketRegion, sessionContext, products, options = {}) {
    const normalizedProducts = Array.isArray(products) ? products.filter(Boolean) : [];

    if (normalizedProducts.length <= 0) {
      return {
        hydratedProducts: [],
        droppedProducts: [],
        warnings: []
      };
    }

    const productList = normalizedProducts.map((item) => ({
      productId: item && item.productId,
      siteId: item && item.siteId
    }));
    const sharedCostLookup = options.sharedCostLookup instanceof Map
      ? options.sharedCostLookup
      : await buildSharedCostLookup([normalizeText(shopSummary && shopSummary.shopId)]);
    const flowPriceInfoResult = await queryFlowPriceInfoMap(
      sessionContext,
      shopSummary,
      marketRegion,
      productList,
      {
        queryJob: options.queryJob,
        progressContext: options.progressContext,
        emitProgress: options.emitProgress,
        initialCookieSnapshot: options.initialCookieSnapshot
      }
    );
    const flowPriceInfoMap = flowPriceInfoResult && flowPriceInfoResult.flowPriceInfoMap instanceof Map
      ? flowPriceInfoResult.flowPriceInfoMap
      : new Map();
    const hydratedProducts = [];
    const droppedProducts = [];

    normalizedProducts.forEach((productItem) => {
      const productKey = buildFlowPriceInfoKey(productItem && productItem.productId, productItem && productItem.siteId);
      const flowPriceInfo = flowPriceInfoMap.get(productKey) || null;
      const sourceRow = {
        siteId: productItem && productItem.siteId,
        siteName: productItem && productItem.siteName,
        cateId: productItem && productItem.categoryId,
        productId: productItem && productItem.productId,
        productName: productItem && productItem.productName
      };
      const normalizedRow = normalizeResultRow(sourceRow, shopSummary, marketRegion, {
        flowPriceInfo,
        sharedCostLookup,
        flowPriceInfoRequested: true,
        flowPriceInfoLoadFailed: Boolean(
          flowPriceInfoResult
          && flowPriceInfoResult.failedProductKeySet
          && flowPriceInfoResult.failedProductKeySet.has(productKey)
        )
      });
      const hydratedSkuPriceList = Array.isArray(normalizedRow && normalizedRow.skuPriceInfoList)
        ? normalizedRow.skuPriceInfoList
        : [];
      const hydratedProduct = {
        ...productItem,
        skuPriceInfoList: hydratedSkuPriceList
      };

      hydratedProducts.push(hydratedProduct);

      if (hydratedSkuPriceList.length <= 0) {
        droppedProducts.push({
          shopId: normalizeText(productItem && productItem.shopId),
          shopName: normalizeText(productItem && productItem.shopName),
          marketRegion: normalizeMarketRegion(productItem && productItem.marketRegion),
          siteId: normalizeText(productItem && productItem.siteId),
          productId: normalizeText(productItem && productItem.productId),
          productName: normalizeText(productItem && productItem.productName),
          message: normalizeText(normalizedRow && normalizedRow.flowPriceInfoWarning) || '\u7f3a\u5c11SKU\u660e\u7ec6\uff0c\u672a\u63d0\u4ea4'
        });
      }
    });

    return {
      hydratedProducts,
      droppedProducts,
      warnings: Array.isArray(flowPriceInfoResult && flowPriceInfoResult.warnings)
        ? flowPriceInfoResult.warnings
        : []
    };
  }

  async function querySingleShopRows(payload = {}, options = {}) {
    const shopSummary = payload.shopSummary;
    const filters = payload.filters;
    const marketRegion = normalizeMarketRegion(filters && filters.marketRegion);
    const owner = options.owner || ensureOwnerScope();
    const runId = normalizeText(options.runId);
    const queryJob = options.queryJob || null;
    const progressContext = {
      owner,
      runId,
      shopId: normalizeText(shopSummary && shopSummary.shopId),
      shopName: normalizeText(shopSummary && shopSummary.shopName)
    };
    const onPageRows = typeof options.onPageRows === 'function'
      ? options.onPageRows
      : null;
    const emitShopProgress = typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const sharedCostLookup = options.sharedCostLookup instanceof Map
      ? options.sharedCostLookup
      : null;

    emitQueryProgress(progressContext, {
      phase: 'warming-session',
      currentShopId: progressContext.shopId,
      currentShopName: progressContext.shopName,
      message: '\u6b63\u5728\u68c0\u67e5\u5356\u5bb6\u4e2d\u5fc3\u767b\u5f55\u4f1a\u8bdd...'
    }, emitShopProgress);

    const sessionContext = await resolveSellerSessionContext(shopSummary, {
      timeoutMs: QUERY_REQUEST_TIMEOUT_MS
    });
    const baseRequestPayload = buildQueryRequestPayload(filters, 1);
    const collectedRows = [];
    const collectedWarnings = [];
    let total = 0;
    let totalPages = 1;
    let pageNumber = 1;

    while (pageNumber <= totalPages) {
      assertQueryJobActive(queryJob);

      const requestPayload = {
        ...baseRequestPayload,
        pageNumber
      };

      emitQueryProgress(progressContext, {
        phase: 'querying',
        currentShopId: progressContext.shopId,
        currentShopName: progressContext.shopName,
        pageNum: pageNumber,
        totalPages,
        pageSize: DEFAULT_PAGE_SIZE,
        accumulatedItemCount: collectedRows.length,
        rowCount: collectedRows.length,
        message: `\u6b63\u5728\u67e5\u8be2\u7b2c ${pageNumber}/${totalPages} \u9875`
      }, emitShopProgress);

      let response;

      try {
        response = await executeFlowAnalysisRequest(
          sessionContext,
          marketRegion,
          requestPayload,
          {
            shopSummary,
            queryJob,
            progressContext,
            emitProgress: emitShopProgress
          }
        );
      } catch (error) {
        if (collectedRows.length > 0) {
          const partialWarning = buildPartialShopFailureWarning(
            shopSummary,
            pageNumber,
            collectedRows.length,
            error
          );
          collectedWarnings.push(partialWarning);

          emitQueryProgress(progressContext, {
            phase: 'page-completed',
            currentShopId: progressContext.shopId,
            currentShopName: progressContext.shopName,
            pageNum: Math.max(1, pageNumber - 1),
            totalPages,
            pageSize: DEFAULT_PAGE_SIZE,
            fetchedItemCount: 0,
            accumulatedItemCount: collectedRows.length,
            estimatedTotal: total,
            rowCount: collectedRows.length,
            message: partialWarning
          }, emitShopProgress);

          break;
        }

        throw error;
      }
      const result = response && response.data && response.data.result && typeof response.data.result === 'object'
        ? response.data.result
        : {};
      const pageItems = Array.isArray(result.pageItems) ? result.pageItems : [];

      if (pageNumber === 1) {
        total = Math.max(0, normalizeIntegerValue(result.total, pageItems.length));
        totalPages = Math.max(
          1,
          total > 0
            ? Math.ceil(total / DEFAULT_PAGE_SIZE)
            : (pageItems.length > 0 ? 1 : 1)
        );
      }

      const flowPriceInfoResult = await queryFlowPriceInfoMap(
        sessionContext,
        shopSummary,
        marketRegion,
        pageItems.map((item) => ({
          productId: item && item.productId,
          siteId: item && item.siteId
        })),
        {
          queryJob,
          progressContext,
          emitProgress: emitShopProgress,
          initialCookieSnapshot: response && response.cookieSnapshot,
          pageNumber
        }
      );
      if (Array.isArray(flowPriceInfoResult && flowPriceInfoResult.warnings) && flowPriceInfoResult.warnings.length > 0) {
        collectedWarnings.push(...flowPriceInfoResult.warnings);
      }

      const pageRows = pageItems.map((item) => {
        const itemKey = buildFlowPriceInfoKey(item && item.productId, item && item.siteId);
        return normalizeResultRow(item, shopSummary, marketRegion, {
          flowPriceInfo: flowPriceInfoResult && flowPriceInfoResult.flowPriceInfoMap
            ? flowPriceInfoResult.flowPriceInfoMap.get(itemKey) || null
            : null,
          sharedCostLookup,
          flowPriceInfoRequested: Boolean(
            flowPriceInfoResult
            && flowPriceInfoResult.requestedProductKeySet
            && flowPriceInfoResult.requestedProductKeySet.has(itemKey)
          ),
          flowPriceInfoLoadFailed: Boolean(
            flowPriceInfoResult
            && flowPriceInfoResult.failedProductKeySet
            && flowPriceInfoResult.failedProductKeySet.has(itemKey)
          )
        });
      });

      if (pageRows.length > 0) {
        collectedRows.push(...pageRows);

        if (onPageRows) {
          onPageRows(pageRows);
        }
      }

      emitQueryProgress(progressContext, {
        phase: 'page-completed',
        currentShopId: progressContext.shopId,
        currentShopName: progressContext.shopName,
        pageNum: pageNumber,
        totalPages,
        pageSize: DEFAULT_PAGE_SIZE,
        fetchedItemCount: pageRows.length,
        accumulatedItemCount: collectedRows.length,
        estimatedTotal: total,
        rowCount: collectedRows.length,
        message: pageItems.length > 0
          ? `\u5df2\u5b8c\u6210\u7b2c ${pageNumber}/${totalPages} \u9875`
          : '\u5f53\u524d\u9875\u65e0\u6570\u636e'
      }, emitShopProgress);

      if (shouldStopQueryAfterCurrentStep(queryJob) === true) {
        break;
      }

      if (pageItems.length <= 0 || pageNumber >= totalPages) {
        break;
      }

      const interPageDelayMs = randomIntegerBetween(
        SINGLE_SHOP_PAGE_DELAY_MIN_MS,
        SINGLE_SHOP_PAGE_DELAY_MAX_MS
      );

      emitQueryProgress(progressContext, {
        phase: 'querying',
        currentShopId: progressContext.shopId,
        currentShopName: progressContext.shopName,
        pageNum: pageNumber,
        totalPages,
        pageSize: DEFAULT_PAGE_SIZE,
        fetchedItemCount: pageRows.length,
        accumulatedItemCount: collectedRows.length,
        estimatedTotal: total,
        rowCount: collectedRows.length,
        message: `\u5f53\u524d\u5e97\u94fa\u7b2c ${pageNumber}/${totalPages} \u9875\u5df2\u5b8c\u6210\uff0c${(interPageDelayMs / 1000).toFixed(1)} \u79d2\u540e\u7ee7\u7eed\u67e5\u4e0b\u4e00\u9875`
      }, emitShopProgress);
      await createCancelableDelay(queryJob, interPageDelayMs);

      pageNumber += 1;
    }

    return {
      total,
      rows: collectedRows,
      warnings: Array.from(new Set(collectedWarnings.filter(Boolean)))
    };
  }

  function buildAggregateProgressPayload(progressContext = {}, aggregate = {}, sourcePayload = {}) {
    return {
      phase: normalizeText(sourcePayload.phase),
      totalShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.totalShops, 0)),
      completedShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.completedShops, 0)),
      failedShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.failedShops, 0)),
      canceledShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.canceledShops, 0)),
      activeShops: Math.max(0, normalizeIntegerValue(aggregate && aggregate.activeShops, 0)),
      currentShopId: normalizeText(sourcePayload.currentShopId) || normalizeText(aggregate && aggregate.currentShopId),
      currentShopName: normalizeText(sourcePayload.currentShopName) || normalizeText(aggregate && aggregate.currentShopName),
      pageNum: Math.max(0, normalizeIntegerValue(sourcePayload.pageNum, 0)),
      totalPages: Math.max(0, normalizeIntegerValue(sourcePayload.totalPages, 0)),
      pageSize: Math.max(0, normalizeIntegerValue(sourcePayload.pageSize, DEFAULT_PAGE_SIZE)),
      fetchedItemCount: Math.max(0, normalizeIntegerValue(sourcePayload.fetchedItemCount, 0)),
      accumulatedItemCount: Math.max(0, normalizeIntegerValue(sourcePayload.accumulatedItemCount, 0)),
      estimatedTotal: Math.max(0, normalizeIntegerValue(sourcePayload.estimatedTotal, 0)),
      rowCount: Math.max(0, normalizeIntegerValue(sourcePayload.rowCount, aggregate && aggregate.rowCount)),
      message: normalizeText(sourcePayload.message),
      shopId: normalizeText(progressContext && progressContext.shopId),
      shopName: normalizeText(progressContext && progressContext.shopName)
    };
  }

  async function queryRows(payload = {}, options = {}) {
    const owner = ensureOwnerScope();
    const runId = normalizeText(payload && payload.runId) || `traffic_query_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const filters = normalizeFilters(payload && payload.filters);
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : emitProgress;
    const queryJob = createQueryJob(owner, {
      runId
    }, {
      requesterKey: options && options.requesterKey
    });

    try {
      const shopSummaries = await resolveShopSummaries(
        normalizeSelectedShopIds(payload && payload.shopIds || filters.selectedShopIds)
      );
      const normalizedShopSummaries = shopSummaries.filter((shopSummary) => {
        return normalizeText(shopSummary && shopSummary.shopId);
      });

      if (normalizedShopSummaries.length <= 0) {
        throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u67e5\u8be2\u6d41\u91cf\u52a0\u901f\u3002');
      }

      const progressContext = {
        owner,
        runId,
        shopId: '',
        shopName: ''
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
      const aggregateWarnings = [];
      let nextShopIndex = 0;

      emitQueryProgress(progressContext, buildAggregateProgressPayload(progressContext, aggregate, {
        phase: 'preparing',
        message: `\u5df2\u9009 ${aggregate.totalShops} \u5bb6\u5e97\u94fa\uff0c\u6b63\u5728\u51c6\u5907\u67e5\u8be2`
      }), progressEmitter);
      const sharedCostLookup = await buildSharedCostLookup(
        normalizedShopSummaries.map((shopSummary) => normalizeText(shopSummary && shopSummary.shopId))
      );

      const emitAggregateProgress = (payloadOverrides = {}) => {
        emitQueryProgress(
          progressContext,
          buildAggregateProgressPayload(progressContext, aggregate, payloadOverrides),
          progressEmitter
        );
      };

      const runSingleShopWorker = async () => {
        while (nextShopIndex < normalizedShopSummaries.length) {
          if (shouldStopQueryAfterCurrentStep(queryJob) === true) {
            return;
          }

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
            const response = await querySingleShopRows({
              shopSummary,
              filters
            }, {
              owner,
              runId,
              queryJob,
              sharedCostLookup,
              emitProgress(shopProgress) {
                const normalizedShopProgress = shopProgress && typeof shopProgress === 'object'
                  ? shopProgress
                  : null;

                if (!normalizedShopProgress) {
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
            if (Array.isArray(response && response.warnings) && response.warnings.length > 0) {
              aggregateWarnings.push(...response.warnings);
            }

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

          if (shouldStopQueryAfterCurrentStep(queryJob) === true) {
            return;
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
        return normalizeIntegerValue(right && right.sortTimestamp, 0) - normalizeIntegerValue(left && left.sortTimestamp, 0);
      });

      if (shouldStopQueryAfterCurrentStep(queryJob) === true) {
        queryJob.canceled = true;
        aggregate.canceledShops = Math.max(
          0,
          aggregate.totalShops - aggregate.completedShops - aggregate.failedShops
        );

        emitAggregateProgress({
          phase: 'canceled',
          rowCount: sortedRows.length,
          message: '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u5df2\u505c\u6b62'
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
          warning: '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u5df2\u505c\u6b62'
        };
      }

      if (aggregate.completedShops <= 0 && aggregate.failedShops > 0 && sortedRows.length <= 0) {
        const error = new Error(
          aggregate.failedShopNames.length > 0
            ? `\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u5931\u8d25\uff1a${aggregate.failedShopNames.map((name, index) => {
                const reason = normalizeText(aggregate.failedShopReasons && aggregate.failedShopReasons[index]);
                return reason ? `${name}(${reason})` : name;
              }).join('\u3001')}`
            : '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u5931\u8d25'
        );
        throw error;
      }

      const warningList = [];

      if (aggregate.failedShopNames.length > 0) {
        warningList.push(`\u4ee5\u4e0b\u5e97\u94fa\u67e5\u8be2\u5931\u8d25\uff1a${aggregate.failedShopNames.join('\u3001')}`);
      }

      const detailWarningText = buildCompactWarningText(aggregateWarnings, 2);
      if (detailWarningText) {
        warningList.push(detailWarningText);
      }

      const warning = warningList.join('\uff1b');

      emitAggregateProgress({
        phase: 'completed',
        rowCount: sortedRows.length,
        message: aggregate.failedShopNames.length > 0
          ? `\u67e5\u8be2\u5b8c\u6210\uff0c${aggregate.failedShopNames.length} \u5bb6\u5e97\u94fa\u5931\u8d25`
          : (warning ? '\u67e5\u8be2\u5b8c\u6210\uff0c\u90e8\u5206\u5e97\u94fa\u5df2\u4fdd\u7559\u5df2\u67e5\u5230\u7684\u7ed3\u679c' : '\u67e5\u8be2\u5b8c\u6210')
      });

      log('operations_traffic_boost_query_succeeded', {
        runId,
        marketRegion: normalizeMarketRegion(filters.marketRegion),
        totalShops: aggregate.totalShops,
        completedShops: aggregate.completedShops,
        failedShops: aggregate.failedShops,
        rowCount: sortedRows.length,
        total: aggregate.total
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
        logError('operations_traffic_boost_query_failed', error, {
          runId,
          shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
          marketRegion: normalizeMarketRegion(filters.marketRegion)
        });
      }

      throw error;
    } finally {
      clearQueryJob(queryJob);
    }
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

  async function getQueryProgressSnapshot(payload = {}) {
    const owner = payload && payload.owner ? payload.owner : ensureOwnerScope();
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

  async function cancelSubmitJob(payload = {}, options = {}) {
    const job = getSubmitJob(payload, options);
    const canceled = cancelSubmitJobInternally(job);

    return {
      canceled,
      requestId: normalizeText(payload && payload.requestId) || normalizeText(job && job.requestId)
    };
  }

  async function getCustomLevelFilterSettings() {
    try {
      const configResult = await store.readUserConfig('customLevelFilterSettings');
      const newerPayload = pickNewerPayload(
        configResult && configResult.localConfig,
        configResult && configResult.cloudConfig
      );
      const savedSettings = newerPayload && newerPayload.payload && typeof newerPayload.payload === 'object'
        ? newerPayload.payload
        : DEFAULT_CUSTOM_LEVEL_FILTER_SETTINGS;

      return {
        settings: normalizeCustomLevelFilterSettingsPayload({
          ...DEFAULT_CUSTOM_LEVEL_FILTER_SETTINGS,
          ...savedSettings
        }),
        source: newerPayload && newerPayload.source ? newerPayload.source : 'default',
        warning: ''
      };
    } catch (error) {
      logError('operations_traffic_boost_get_custom_level_filter_settings_failed', error, {});

      return {
        settings: normalizeCustomLevelFilterSettingsPayload(DEFAULT_CUSTOM_LEVEL_FILTER_SETTINGS),
        source: 'default',
        warning: normalizeText(error && error.message) || '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25'
      };
    }
  }

  async function saveCustomLevelFilterSettings(payload = {}) {
    const nextSettings = normalizeCustomLevelFilterSettingsPayload({
      ...DEFAULT_CUSTOM_LEVEL_FILTER_SETTINGS,
      ...(payload && typeof payload === 'object' ? payload : {})
    });
    const writeResult = await store.writeUserConfig('customLevelFilterSettings', nextSettings);

    return {
      settings: {
        ...nextSettings,
        version: CUSTOM_LEVEL_FILTER_SETTINGS_VERSION,
        updatedAt: nextSettings.updatedAt || nowIso()
      },
      source: writeResult && writeResult.cloudSynced === true ? 'cloud' : 'local',
      localSaved: writeResult && writeResult.localSaved === true,
      cloudSynced: writeResult && writeResult.cloudSynced === true,
      warning: normalizeText(writeResult && writeResult.warning)
    };
  }

  async function submitEnableBatch(payload = {}, options = {}) {
    const owner = ensureOwnerScope();
    const request = normalizeTrafficBoostSubmitRequest(payload);
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : emitProgress;

    if (request.products.length <= 0 || request.shopSubmissions.length <= 0) {
      return {
        success: false,
        updatedAt: nowIso(),
        requestId: request.requestId,
        totalShopCount: 0,
        completedShopCount: 0,
        failedShopCount: 0,
        totalProductCount: 0,
        successProductCount: 0,
        failedProductCount: 0,
        shopResults: [],
        failProducts: [],
        warning: '\u8bf7\u5148\u52fe\u9009\u53ef\u63d0\u4ea4\u7684\u5546\u54c1'
      };
    }

    const submitJob = createSubmitJob(owner, {
      requestId: request.requestId
    }, {
      requesterKey: options && options.requesterKey
    });

    const shopSummaries = await resolveShopSummaries(
      request.shopSubmissions.map((item) => item.shopId)
    );
    const shopSummaryMap = new Map(
      shopSummaries.map((shopSummary) => [normalizeText(shopSummary && shopSummary.shopId), shopSummary])
    );
    const progressContext = {
      owner,
      runId: request.requestId,
      shopId: '',
      shopName: ''
    };
    const totalShopCount = request.shopSubmissions.length;
    const totalProductCount = request.products.length;
    const submitBatchSize = normalizeTrafficBoostSubmitBatchSize(request.submitBatchSize);
    const submitShopConcurrency = Math.max(1, normalizeIntegerValue(request.submitShopConcurrency, 1));
    let completedShopCount = 0;
    let failedShopCount = 0;
    let successProductCount = 0;
    let failedProductCount = 0;
    const shopResults = [];
    const failProducts = [];
    const deferredRetryEntries = [];

    try {
      for (let shopIndex = 0; shopIndex < request.shopSubmissions.length; shopIndex += 1) {
        if (shouldStopSubmitAfterCurrentStep(submitJob) === true) {
          break;
        }

        const shopSubmission = request.shopSubmissions[shopIndex];
        const shopId = normalizeText(shopSubmission && shopSubmission.shopId);
        const shopName = normalizeText(shopSubmission && shopSubmission.shopName) || shopId;
        const marketRegion = normalizeMarketRegion(shopSubmission && shopSubmission.marketRegion);
        const shopSummary = shopSummaryMap.get(shopId) || null;
        const currentShopIndex = shopIndex + 1;
        const shopProductCount = Array.isArray(shopSubmission && shopSubmission.products)
          ? shopSubmission.products.length
          : 0;

        progressContext.shopId = shopId;
        progressContext.shopName = shopName;

        if (!shopSummary) {
          failedShopCount += 1;
          failedProductCount += shopProductCount;
          shopResults.push({
            shopId,
            shopName,
            marketRegion,
            success: false,
            productCount: shopProductCount,
            successProductCount: 0,
            failedProductCount: shopProductCount,
            message: '\u672a\u627e\u5230\u5bf9\u5e94\u5e97\u94fa'
          });
          emitQueryProgress(progressContext, {
            phase: 'request-failed',
            totalShops: totalShopCount,
            completedShops: completedShopCount,
            failedShops: failedShopCount,
            canceledShops: 0,
            activeShops: 0,
            rowCount: successProductCount,
            currentShopIndex,
            currentShopId: shopId,
            currentShopName: shopName,
            totalProductCount,
            successItemCount: successProductCount,
            failedItemCount: failedProductCount,
            currentShopSuccessCount: 0,
            currentShopFailedCount: shopProductCount,
            currentShopTotalCount: shopProductCount,
            estimatedTotal: shopProductCount,
            message: `${shopName}\u63d0\u4ea4\u8df3\u8fc7\uff1a\u672a\u627e\u5230\u5bf9\u5e94\u5e97\u94fa`
          }, progressEmitter);
          continue;
        }

        emitQueryProgress(progressContext, {
          phase: 'starting',
          totalShops: totalShopCount,
          completedShops: completedShopCount,
          failedShops: failedShopCount,
          canceledShops: 0,
          activeShops: 1,
          rowCount: successProductCount,
          currentShopIndex,
          currentShopId: shopId,
          currentShopName: shopName,
          totalProductCount,
          successItemCount: successProductCount,
          failedItemCount: failedProductCount,
          currentShopSuccessCount: 0,
          currentShopFailedCount: 0,
          currentShopTotalCount: shopProductCount,
          estimatedTotal: shopProductCount,
          message: `\u6b63\u5728\u51c6\u5907\u63d0\u4ea4 ${shopName}\uff08\u7b2c ${currentShopIndex}/${totalShopCount} \u5bb6\u5e97\u94fa\uff0c\u5171 ${shopProductCount} \u4e2a\u5546\u54c1\uff09`
        }, progressEmitter);

        let submitReadyProducts = [];
        let shopSuccessProductCount = 0;
        let shopFailedProductCount = 0;
        let cookieSnapshot = null;
        const shopFailedProducts = [];
        const accountedProductKeySet = new Set();
        const deferredProductKeySet = new Set();
        const markShopProductAccounted = (productId, siteId) => {
          const productKey = buildTrafficBoostSubmitProductKey(productId, siteId);

          if (!productKey || productKey === ':' || accountedProductKeySet.has(productKey)) {
            return false;
          }

          accountedProductKeySet.add(productKey);
          return true;
        };
        const recordShopFailedProduct = (item) => {
          const normalizedItem = {
            shopId,
            shopName,
            marketRegion,
            siteId: normalizeText(item && item.siteId),
            productId: normalizeText(item && item.productId),
            productName: normalizeText(item && item.productName),
            withoutSkuId: normalizeText(item && item.withoutSkuId),
            higherCustomPriceSkuId: normalizeText(item && item.higherCustomPriceSkuId),
            expectedSkuCount: Math.max(0, normalizeIntegerValue(item && item.expectedSkuCount, 0)),
            submittedSkuCount: Math.max(0, normalizeIntegerValue(item && item.submittedSkuCount, 0)),
            missingSkuCount: Math.max(0, normalizeIntegerValue(item && item.missingSkuCount, 0)),
            missingSkuIdList: Array.from(new Set(
              (Array.isArray(item && item.missingSkuIdList) ? item.missingSkuIdList : [])
                .map((value) => normalizeText(value))
                .filter(Boolean)
            )),
            message: normalizeText(item && item.message)
          };

          if (!markShopProductAccounted(normalizedItem.productId, normalizedItem.siteId)) {
            return false;
          }

          shopFailedProductCount += 1;
          shopFailedProducts.push(normalizedItem);
          failProducts.push(normalizedItem);
          return true;
        };
        const appendShopDeferredRetryProduct = (productItem) => {
          const productKey = buildTrafficBoostSubmitProductKey(
            productItem && productItem.productId,
            productItem && productItem.siteId
          );

          if (!productKey || productKey === ':' || accountedProductKeySet.has(productKey) || deferredProductKeySet.has(productKey)) {
            return false;
          }

          deferredProductKeySet.add(productKey);
          deferredRetryEntries.push({
            shopSummary,
            shopId,
            shopName,
            marketRegion,
            product: productItem,
            currentShopIndex,
            shopProductCount,
            progressContext: {
              owner,
              runId: request.requestId,
              shopId,
              shopName
            }
          });
          return true;
        };
        const appendShopFailureWarning = (warningMessage) => {
          const normalizedWarningMessage = normalizeText(warningMessage);

          if (!normalizedWarningMessage) {
            return;
          }

          shopFailedProducts.push({
            shopId,
            shopName,
            marketRegion,
            siteId: '',
            productId: '',
            productName: '',
            message: normalizedWarningMessage
          });
        };

        try {
          emitQueryProgress(progressContext, {
            phase: 'warming-session',
            totalShops: totalShopCount,
            completedShops: completedShopCount,
            failedShops: failedShopCount,
            canceledShops: 0,
            activeShops: 1,
            rowCount: successProductCount,
            currentShopIndex,
            currentShopId: shopId,
            currentShopName: shopName,
            totalProductCount,
            successItemCount: successProductCount,
            failedItemCount: failedProductCount,
            currentShopSuccessCount: 0,
            currentShopFailedCount: shopFailedProductCount,
            currentShopTotalCount: shopProductCount,
            estimatedTotal: shopProductCount,
            message: `${shopName}\u6b63\u5728\u68c0\u67e5\u5356\u5bb6\u4e2d\u5fc3\u4f1a\u8bdd`
          }, progressEmitter);

          const sessionContext = await resolveSellerSessionContext(shopSummary, {
            timeoutMs: QUERY_REQUEST_TIMEOUT_MS
          });

          emitQueryProgress(progressContext, {
            phase: 'starting',
            totalShops: totalShopCount,
            completedShops: completedShopCount,
            failedShops: failedShopCount,
            canceledShops: 0,
            activeShops: 1,
            rowCount: successProductCount,
            currentShopIndex,
            currentShopId: shopId,
            currentShopName: shopName,
            totalProductCount,
            successItemCount: successProductCount,
            failedItemCount: failedProductCount,
            currentShopSuccessCount: 0,
            currentShopFailedCount: shopFailedProductCount,
            currentShopTotalCount: shopProductCount,
            estimatedTotal: shopProductCount,
            message: `${shopName}\u4f1a\u8bdd\u5df2\u5c31\u7eea\uff0c\u6b63\u5728\u51c6\u5907SKU\u63d0\u4ea4\u4ef7\u683c`
          }, progressEmitter);

          const submitProductPreparation = splitSubmitProductsByReusableSkuPrice(shopSubmission.products);
          submitReadyProducts = submitProductPreparation.reusableProducts;
          const droppedProductMap = new Map();
          const appendDroppedProduct = (item) => {
            const productId = normalizeText(item && item.productId);
            const siteId = normalizeText(item && item.siteId);
            const productKey = buildTrafficBoostSubmitProductKey(productId, siteId);

            if (!productKey || productKey === ':') {
              return;
            }

            const normalizedItem = {
              shopId,
              shopName,
              marketRegion,
              siteId,
              productId,
              productName: normalizeText(item && item.productName),
              message: normalizeText(item && item.message)
            };
            const existingItem = droppedProductMap.get(productKey);

            droppedProductMap.set(productKey, existingItem
              ? {
                  ...existingItem,
                  ...normalizedItem,
                  message: normalizedItem.message || existingItem.message
                }
              : normalizedItem);
          };

          if (submitProductPreparation.hydrateProducts.length > 0) {
            emitQueryProgress(progressContext, {
              phase: 'querying',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 1,
              rowCount: successProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              totalProductCount,
              successItemCount: successProductCount,
              failedItemCount: failedProductCount,
              currentShopSuccessCount: 0,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              estimatedTotal: shopProductCount,
              fetchedItemCount: submitProductPreparation.hydrateProducts.length,
              message: `${shopName}\u6b63\u5728\u8865\u67e5 ${submitProductPreparation.hydrateProducts.length} \u4e2a\u5546\u54c1\u7684SKU\u4ef7\u683c\u660e\u7ec6`
            }, progressEmitter);

            const submitSharedCostLookup = await buildSharedCostLookup([shopId]);
            const hydrationResult = await hydrateSubmitProductsWithFlowPriceInfo(
              shopSummary,
              marketRegion,
              sessionContext,
              submitProductPreparation.hydrateProducts,
              {
                queryJob: submitJob,
                progressContext,
                emitProgress: progressEmitter,
                sharedCostLookup: submitSharedCostLookup
              }
            );

            (Array.isArray(hydrationResult && hydrationResult.droppedProducts)
              ? hydrationResult.droppedProducts
              : []
            ).forEach((item) => {
              appendDroppedProduct(item);
            });

            submitReadyProducts = submitReadyProducts.concat((Array.isArray(hydrationResult && hydrationResult.hydratedProducts)
              ? hydrationResult.hydratedProducts
              : []
            ).map((productItem) => {
              const selectedLevel = normalizeTrafficBoostSubmitLevel(productItem && productItem.increaseFlowLevel);
              const productKey = buildTrafficBoostSubmitProductKey(
                normalizeText(productItem && productItem.productId),
                normalizeText(productItem && productItem.siteId)
              );
              const existingSkuPriceMap = new Map(
                (Array.isArray(productItem && productItem.skuPriceList) ? productItem.skuPriceList : [])
                  .map((skuItem) => {
                    const productSkuId = normalizeIntegerValue(skuItem && skuItem.productSkuId, 0);

                    if (productSkuId <= 0) {
                      return null;
                    }

                    return [String(productSkuId), {
                      productSkuId,
                      supplierPrice: normalizeIntegerValue(skuItem && skuItem.supplierPrice, 0),
                      preSupplierPrice: normalizeIntegerValue(skuItem && skuItem.preSupplierPrice, 0),
                      targetSupplierPrice: normalizeIntegerValue(skuItem && skuItem.targetSupplierPrice, 0),
                      customFlowSupplierPrice: normalizeIntegerValue(skuItem && skuItem.customFlowSupplierPrice, 0),
                      currencyType: normalizeText(skuItem && skuItem.currencyType) || 'CNY'
                    }];
                  })
                  .filter(Boolean)
              );
              const fallbackSkuPriceList = Array.from(existingSkuPriceMap.values())
                .filter((skuItem) => skuItem && skuItem.productSkuId > 0 && skuItem.supplierPrice > 0);

              if (
                fallbackSkuPriceList.length > 0
                && (!Array.isArray(productItem && productItem.skuPriceInfoList) || productItem.skuPriceInfoList.length <= 0)
              ) {
                droppedProductMap.delete(productKey);
                return {
                  ...productItem,
                  skuPriceList: fallbackSkuPriceList
                };
              }

              const selectedSkuPriceList = (Array.isArray(productItem && productItem.skuPriceInfoList)
                ? productItem.skuPriceInfoList
                : []
              ).map((skuItem) => {
                const productSkuId = normalizeIntegerValue(skuItem && skuItem.productSkuId, 0);
                const existingSkuPrice = productSkuId > 0
                  ? existingSkuPriceMap.get(String(productSkuId))
                  : null;

                if (existingSkuPriceMap.size > 0 && !existingSkuPrice) {
                  return null;
                }

                const existingSupplierPrice = normalizeIntegerValue(existingSkuPrice && existingSkuPrice.supplierPrice, 0);
                const existingPreSupplierPrice = normalizeIntegerValue(existingSkuPrice && existingSkuPrice.preSupplierPrice, 0);
                const oldCustomTargetSupplierPrice = selectedLevel === 4
                  && existingPreSupplierPrice > 0
                  && existingSupplierPrice > 0
                  && existingPreSupplierPrice !== existingSupplierPrice
                  ? existingSupplierPrice
                  : 0;
                const targetSupplierPrice = selectedLevel === 4
                  ? (
                    normalizeIntegerValue(existingSkuPrice && existingSkuPrice.targetSupplierPrice, 0)
                    || normalizeIntegerValue(existingSkuPrice && existingSkuPrice.customFlowSupplierPrice, 0)
                    || oldCustomTargetSupplierPrice
                    || normalizeIntegerValue(skuItem && skuItem.customFlowSupplierPrice, 0)
                  )
                  : 0;
                const supplierPrice = selectedLevel === 4
                  ? (
                    (oldCustomTargetSupplierPrice > 0 ? existingPreSupplierPrice : existingSupplierPrice)
                    || normalizeIntegerValue(skuItem && skuItem.supplierPrice, 0)
                  )
                  : (
                    selectedLevel === 3
                      ? normalizeIntegerValue(skuItem && skuItem.superFlowSupplierPrice, 0)
                      : (
                        selectedLevel === 2
                          ? normalizeIntegerValue(skuItem && skuItem.premiumFlowSupplierPrice, 0)
                          : normalizeIntegerValue(skuItem && skuItem.ordinaryFlowSupplierPrice, 0)
                      )
                  );

                if (supplierPrice <= 0 || (selectedLevel === 4 && targetSupplierPrice <= 0)) {
                  return null;
                }

                const normalizedSkuPrice = {
                  productSkuId,
                  supplierPrice,
                  preSupplierPrice: normalizeIntegerValue(
                    existingSkuPrice && existingSkuPrice.preSupplierPrice,
                    normalizeIntegerValue(skuItem && skuItem.supplierPrice, 0)
                  ),
                  currencyType: normalizeText(existingSkuPrice && existingSkuPrice.currencyType)
                    || normalizeText(skuItem && skuItem.currencyType)
                    || 'CNY'
                };

                if (selectedLevel === 4) {
                  normalizedSkuPrice.targetSupplierPrice = targetSupplierPrice;
                }

                return normalizedSkuPrice;
              }).filter((skuItem) => skuItem && skuItem.productSkuId > 0 && skuItem.supplierPrice > 0);

              if (selectedSkuPriceList.length <= 0) {
                appendDroppedProduct({
                  siteId: normalizeText(productItem && productItem.siteId),
                  productId: normalizeText(productItem && productItem.productId),
                  productName: normalizeText(productItem && productItem.productName),
                  message: '\u5f53\u524d\u7b49\u7ea7\u672a\u751f\u6210\u53ef\u63d0\u4ea4\u7684SKU\u4ef7\u683c'
                });
                return null;
              }

              droppedProductMap.delete(productKey);
              return {
                ...productItem,
                skuPriceList: selectedSkuPriceList
              };
            }).filter(Boolean));

            if (Array.isArray(hydrationResult && hydrationResult.warnings) && hydrationResult.warnings.length > 0) {
              hydrationResult.warnings.forEach((warningMessage) => {
                appendShopFailureWarning(warningMessage);
              });
            }

            emitQueryProgress(progressContext, {
              phase: 'page-completed',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 1,
              rowCount: successProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              totalProductCount,
              successItemCount: successProductCount,
              failedItemCount: failedProductCount,
              currentShopSuccessCount: 0,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              estimatedTotal: shopProductCount,
              fetchedItemCount: submitProductPreparation.hydrateProducts.length,
              accumulatedItemCount: submitReadyProducts.length,
              message: `${shopName} SKU\u4ef7\u683c\u660e\u7ec6\u5df2\u51c6\u5907 ${submitReadyProducts.length} \u4e2a\u5546\u54c1`
            }, progressEmitter);
          }

          const droppedProducts = Array.from(droppedProductMap.values());

          droppedProducts.forEach((item) => {
            recordShopFailedProduct(item);
          });

          if (submitProductPreparation.reusableProducts.length > 0) {
            log('operations_traffic_boost_submit_reuse_sku_price', {
              shopId,
              shopName,
              marketRegion,
              reusedProductCount: submitProductPreparation.reusableProducts.length,
              hydratedProductCount: submitProductPreparation.hydrateProducts.length
            });
          }

          if (shouldStopSubmitAfterCurrentStep(submitJob) === true) {
            emitQueryProgress(progressContext, {
              phase: 'canceling',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 1,
              rowCount: successProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              totalProductCount,
              successItemCount: successProductCount,
              failedItemCount: failedProductCount,
              currentShopSuccessCount: 0,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              estimatedTotal: shopProductCount,
              message: `${shopName} SKU\u4ef7\u683c\u5df2\u51c6\u5907\u5b8c\u6210\uff0c\u5df2\u6309\u505c\u6b62\u6307\u4ee4\u7ed3\u675f\u63d0\u4ea4`
            }, progressEmitter);
            break;
          }

          const productChunks = chunkList(submitReadyProducts, submitBatchSize);

          if (productChunks.length <= 0) {
            failedShopCount += 1;
            failedProductCount += shopFailedProductCount;
            shopResults.push({
              shopId,
              shopName,
              marketRegion,
              success: false,
              productCount: shopProductCount,
              successProductCount: 0,
              failedProductCount: shopFailedProductCount,
              failProducts: shopFailedProducts,
              message: '\u672c\u6b21\u67e5\u8be2\u5546\u54c1\u7f3a\u5c11\u53ef\u63d0\u4ea4SKU\u660e\u7ec6'
            });
            emitQueryProgress(progressContext, {
              phase: 'request-failed',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 0,
              rowCount: successProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              totalProductCount,
              successItemCount: successProductCount,
              failedItemCount: failedProductCount,
              currentShopSuccessCount: 0,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              estimatedTotal: shopProductCount,
              message: `${shopName} \u7f3a\u5c11\u53ef\u63d0\u4ea4SKU\u660e\u7ec6\uff0c\u672c\u6b21\u672a\u63d0\u4ea4`
            }, progressEmitter);
            continue;
          }

          for (let chunkIndex = 0; chunkIndex < productChunks.length; chunkIndex += 1) {
            const productChunk = productChunks[chunkIndex];
            const currentBatchIndex = chunkIndex + 1;
            const currentShopProcessedCount = shopSuccessProductCount + shopFailedProductCount;

            emitQueryProgress(progressContext, {
              phase: shouldStopSubmitAfterCurrentStep(submitJob) === true ? 'canceling' : 'querying',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 1,
              rowCount: successProductCount + shopSuccessProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              pageNum: currentBatchIndex,
              totalPages: productChunks.length,
              pageSize: submitBatchSize,
              fetchedItemCount: productChunk.length,
              accumulatedItemCount: currentShopProcessedCount,
              estimatedTotal: shopProductCount,
              totalProductCount,
              successItemCount: successProductCount + shopSuccessProductCount,
              failedItemCount: failedProductCount + shopFailedProductCount,
              currentShopSuccessCount: shopSuccessProductCount,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              message: shouldStopSubmitAfterCurrentStep(submitJob) === true
                ? `\u5df2\u8bf7\u6c42\u505c\u6b62\uff0c\u6b63\u5728\u7b49\u5f85 ${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u63d0\u4ea4\u5b8c\u6210`
                : `\u6b63\u5728\u63d0\u4ea4 ${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\uff08\u672c\u6279 ${productChunk.length} \u4e2a\u5546\u54c1\uff09`
            }, progressEmitter);

            const submitChunkResult = await submitFlowPriceProductChunkWithFallback(
              sessionContext,
              shopSummary,
              marketRegion,
              productChunk,
              {
                queryJob: submitJob,
                progressContext,
                emitProgress: progressEmitter,
                initialCookieSnapshot: cookieSnapshot,
                requestLabel: `${shopName}\u6d41\u91cf\u52a0\u901f\u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u63d0\u4ea4`,
                requestStartMessage: `\u6b63\u5728\u53d1\u8d77 ${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u63d0\u4ea4\u8bf7\u6c42\uff08${productChunk.length} \u4e2a\u5546\u54c1\uff09`
              }
            );
            let currentBatchSuccessCount = 0;
            let currentBatchFailedCount = 0;

            cookieSnapshot = submitChunkResult && submitChunkResult.cookieSnapshot
              ? submitChunkResult.cookieSnapshot
              : cookieSnapshot;

            (Array.isArray(submitChunkResult && submitChunkResult.successProducts)
              ? submitChunkResult.successProducts
              : []
            ).forEach((productItem) => {
              if (markShopProductAccounted(productItem && productItem.productId, productItem && productItem.siteId)) {
                shopSuccessProductCount += 1;
                currentBatchSuccessCount += 1;
              }
            });

            (Array.isArray(submitChunkResult && submitChunkResult.failProducts)
              ? submitChunkResult.failProducts
              : []
            ).forEach((failedProduct) => {
              if (recordShopFailedProduct(failedProduct)) {
                currentBatchFailedCount += 1;
              }
            });
            (Array.isArray(submitChunkResult && submitChunkResult.deferredProducts)
              ? submitChunkResult.deferredProducts
              : []
            ).forEach((productItem) => {
              appendShopDeferredRetryProduct(productItem);
            });

            emitQueryProgress(progressContext, {
              phase: shouldStopSubmitAfterCurrentStep(submitJob) === true ? 'canceling' : 'page-completed',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 1,
              rowCount: successProductCount + shopSuccessProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              pageNum: currentBatchIndex,
              totalPages: productChunks.length,
              pageSize: submitBatchSize,
              fetchedItemCount: productChunk.length,
              accumulatedItemCount: shopSuccessProductCount + shopFailedProductCount,
              estimatedTotal: shopProductCount,
              totalProductCount,
              successItemCount: successProductCount + shopSuccessProductCount,
              failedItemCount: failedProductCount + shopFailedProductCount,
              currentShopSuccessCount: shopSuccessProductCount,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              currentBatchSuccessCount,
              currentBatchFailedCount,
              message: shouldStopSubmitAfterCurrentStep(submitJob) === true
                ? `${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u5df2\u5b8c\u6210\uff0c\u6b63\u5728\u7b49\u5f85\u505c\u6b62`
                : (
                  currentBatchFailedCount > 0
                    ? `${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${currentBatchSuccessCount} \u4e2a\uff0c\u5931\u8d25 ${currentBatchFailedCount} \u4e2a`
                    : `${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${currentBatchSuccessCount} \u4e2a`
                )
            }, progressEmitter);

            if (shouldStopSubmitAfterCurrentStep(submitJob) === true) {
              break;
            }

            if (
              currentBatchIndex === 1
              && currentBatchIndex < productChunks.length
            ) {
              const remainingProducts = productChunks
                .slice(chunkIndex + 1)
                .reduce((result, chunk) => result.concat(Array.isArray(chunk) ? chunk : []), []);

              remainingProducts.forEach((productItem) => {
                appendShopDeferredRetryProduct(productItem);
              });

              emitQueryProgress(progressContext, {
                phase: 'querying',
                totalShops: totalShopCount,
                completedShops: completedShopCount,
                failedShops: failedShopCount,
                canceledShops: 0,
                activeShops: 1,
                rowCount: successProductCount + shopSuccessProductCount,
                currentShopIndex,
                currentShopId: shopId,
                currentShopName: shopName,
                pageNum: currentBatchIndex,
                totalPages: productChunks.length,
                accumulatedItemCount: shopSuccessProductCount + shopFailedProductCount,
                estimatedTotal: shopProductCount,
                totalProductCount,
                successItemCount: successProductCount + shopSuccessProductCount,
                failedItemCount: failedProductCount + shopFailedProductCount,
                currentShopSuccessCount: shopSuccessProductCount,
                currentShopFailedCount: shopFailedProductCount,
                currentShopTotalCount: shopProductCount,
                message: `${shopName} \u7b2c\u4e00\u6279\u5df2\u5b8c\u6210\uff0c\u5269\u4f59 ${remainingProducts.length} \u4e2a\u5546\u54c1\u5df2\u52a0\u5165\u5e97\u94fa\u8f6e\u8be2\u961f\u5217`
              }, progressEmitter);
              break;
            }

            if (currentBatchIndex < productChunks.length) {
              const interBatchDelayMs = randomIntegerBetween(
                SUBMIT_BATCH_DELAY_MIN_MS,
                SUBMIT_BATCH_DELAY_MAX_MS
              );

              emitQueryProgress(progressContext, {
                phase: 'querying',
                totalShops: totalShopCount,
                completedShops: completedShopCount,
                failedShops: failedShopCount,
                canceledShops: 0,
                activeShops: 1,
                rowCount: successProductCount + shopSuccessProductCount,
                currentShopIndex,
                currentShopId: shopId,
                currentShopName: shopName,
                pageNum: currentBatchIndex,
                totalPages: productChunks.length,
                accumulatedItemCount: shopSuccessProductCount + shopFailedProductCount,
                estimatedTotal: shopProductCount,
                totalProductCount,
                successItemCount: successProductCount + shopSuccessProductCount,
                failedItemCount: failedProductCount + shopFailedProductCount,
                currentShopSuccessCount: shopSuccessProductCount,
                currentShopFailedCount: shopFailedProductCount,
                currentShopTotalCount: shopProductCount,
                message: `${shopName} \u7b2c ${currentBatchIndex}/${productChunks.length} \u6279\u5df2\u5b8c\u6210\uff0c${(interBatchDelayMs / 1000).toFixed(1)} \u79d2\u540e\u7ee7\u7eed\u63d0\u4ea4\u4e0b\u4e00\u6279`
              }, progressEmitter);
              await createCancelableDelay(submitJob, interBatchDelayMs);
            }
          }

          completedShopCount += 1;
          successProductCount += shopSuccessProductCount;
          failedProductCount += shopFailedProductCount;
          shopResults.push({
            shopId,
            shopName,
            marketRegion,
            success: shopFailedProductCount <= 0,
            productCount: shopSubmission.products.length,
            submittedProductCount: submitReadyProducts.length,
            successProductCount: shopSuccessProductCount,
            failedProductCount: shopFailedProductCount,
            failProducts: shopFailedProducts,
            message: shopFailedProductCount > 0
              ? `\u5b9e\u9645\u63d0\u4ea4 ${submitReadyProducts.length} \u4e2a\uff0c\u6210\u529f ${shopSuccessProductCount} \u4e2a\uff0c\u5931\u8d25 ${shopFailedProductCount} \u4e2a`
              : `\u5b9e\u9645\u63d0\u4ea4 ${submitReadyProducts.length} \u4e2a\uff0c\u5df2\u6210\u529f ${shopSuccessProductCount} \u4e2a`
          });
          emitQueryProgress(progressContext, {
            phase: 'starting',
            totalShops: totalShopCount,
            completedShops: completedShopCount,
            failedShops: failedShopCount,
            canceledShops: 0,
            activeShops: 0,
            rowCount: successProductCount,
            currentShopIndex,
            currentShopId: shopId,
            currentShopName: shopName,
            pageNum: productChunks.length,
            totalPages: productChunks.length,
            accumulatedItemCount: shopProductCount,
            estimatedTotal: shopProductCount,
            totalProductCount,
            successItemCount: successProductCount,
            failedItemCount: failedProductCount,
            currentShopSuccessCount: shopSuccessProductCount,
            currentShopFailedCount: shopFailedProductCount,
            currentShopTotalCount: shopProductCount,
            message: shouldStopSubmitAfterCurrentStep(submitJob) === true
              ? `${shopName} \u5f53\u524d\u5df2\u63d0\u4ea4\u5b8c\u6210\uff0c\u4efb\u52a1\u5373\u5c06\u505c\u6b62`
              : (
                shopFailedProductCount > 0
                  ? `${shopName} \u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${shopSuccessProductCount} \u4e2a\uff0c\u5931\u8d25 ${shopFailedProductCount} \u4e2a`
                  : `${shopName} \u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${shopSuccessProductCount} \u4e2a`
              )
          }, progressEmitter);

          if (
            shouldStopSubmitAfterCurrentStep(submitJob) !== true
            && currentShopIndex < totalShopCount
          ) {
            const interShopDelayMs = randomIntegerBetween(
              SUBMIT_SHOP_DELAY_MIN_MS,
              SUBMIT_SHOP_DELAY_MAX_MS
            );

            emitQueryProgress(progressContext, {
              phase: 'querying',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: 0,
              activeShops: 0,
              rowCount: successProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              totalProductCount,
              successItemCount: successProductCount,
              failedItemCount: failedProductCount,
              currentShopSuccessCount: shopSuccessProductCount,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              message: `${shopName} \u5df2\u63d0\u4ea4\u5b8c\u6210\uff0c${(interShopDelayMs / 1000).toFixed(1)} \u79d2\u540e\u7ee7\u7eed\u5904\u7406\u4e0b\u4e00\u5bb6\u5e97\u94fa`
            }, progressEmitter);
            await createCancelableDelay(submitJob, interShopDelayMs);
          }
        } catch (error) {
          if (isQueryCanceledError(error) || shouldStopSubmitAfterCurrentStep(submitJob) === true) {
            successProductCount += shopSuccessProductCount;
            failedProductCount += shopFailedProductCount;
            emitQueryProgress(progressContext, {
              phase: 'canceling',
              totalShops: totalShopCount,
              completedShops: completedShopCount,
              failedShops: failedShopCount,
              canceledShops: Math.max(0, totalShopCount - completedShopCount - failedShopCount),
              activeShops: 0,
              rowCount: successProductCount,
              currentShopIndex,
              currentShopId: shopId,
              currentShopName: shopName,
              totalProductCount,
              successItemCount: successProductCount,
              failedItemCount: failedProductCount,
              currentShopSuccessCount: shopSuccessProductCount,
              currentShopFailedCount: shopFailedProductCount,
              currentShopTotalCount: shopProductCount,
              estimatedTotal: shopProductCount,
              message: `${shopName} \u63d0\u4ea4\u5df2\u505c\u6b62\uff0c\u672a\u7ee7\u7eed\u63d0\u4ea4\u540e\u7eed\u6279\u6b21`
            }, progressEmitter);
            break;
          }

          failedShopCount += 1;
          const errorMessage = normalizeText(error && error.message) || '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u5931\u8d25';
          Array.isArray(shopSubmission && shopSubmission.products)
            && shopSubmission.products.forEach((productItem) => {
              recordShopFailedProduct({
                siteId: productItem && productItem.siteId,
                productId: productItem && productItem.productId,
                productName: productItem && productItem.productName,
                message: errorMessage
              });
            });
          successProductCount += shopSuccessProductCount;
          failedProductCount += shopFailedProductCount;

          shopResults.push({
            shopId,
            shopName,
            marketRegion,
            success: false,
            productCount: shopProductCount,
            submittedProductCount: submitReadyProducts.length,
            successProductCount: shopSuccessProductCount,
            failedProductCount: shopFailedProductCount,
            failProducts: shopFailedProducts,
            message: shopSuccessProductCount > 0 || shopFailedProductCount > 0
              ? `\u63d0\u4ea4\u4e2d\u65ad\uff0c\u5df2\u6210\u529f ${shopSuccessProductCount} \u4e2a\uff0c\u5931\u8d25 ${shopFailedProductCount} \u4e2a\uff1a${errorMessage}`
              : errorMessage
          });
          emitQueryProgress(progressContext, {
            phase: 'request-failed',
            totalShops: totalShopCount,
            completedShops: completedShopCount,
            failedShops: failedShopCount,
            canceledShops: 0,
            activeShops: 0,
            rowCount: successProductCount,
            currentShopIndex,
            currentShopId: shopId,
            currentShopName: shopName,
            totalProductCount,
            successItemCount: successProductCount,
            failedItemCount: failedProductCount,
            currentShopSuccessCount: shopSuccessProductCount,
            currentShopFailedCount: shopFailedProductCount,
            currentShopTotalCount: shopProductCount,
            estimatedTotal: shopProductCount,
            message: shopSuccessProductCount > 0 || shopFailedProductCount > 0
              ? `${shopName} \u63d0\u4ea4\u4e2d\u65ad\uff1a${errorMessage}\uff08\u5df2\u6210\u529f ${shopSuccessProductCount} \u4e2a\uff0c\u5931\u8d25 ${shopFailedProductCount} \u4e2a\uff09`
              : `${shopName} \u63d0\u4ea4\u5931\u8d25\uff1a${errorMessage}`
          }, progressEmitter);
          logError('operations_traffic_boost_submit_failed', error, {
            requestId: request.requestId,
            shopId,
            shopName,
            productCount: shopProductCount,
            marketRegion
          });
        }
      }

      if (
        shouldStopSubmitAfterCurrentStep(submitJob) !== true
        && deferredRetryEntries.length > 0
      ) {
        const deferredRetryGroupMap = new Map();
        const deferredOutcomeKeySet = new Set();
        const buildDeferredOutcomeKey = (group, productItem) => [
          normalizeText(group && group.shopId),
          normalizeMarketRegion(group && group.marketRegion),
          normalizeText(productItem && productItem.siteId),
          normalizeText(productItem && productItem.productId)
        ].join(':');
        const findDeferredShopResult = (group) => shopResults.find((item) => (
          normalizeText(item && item.shopId) === normalizeText(group && group.shopId)
          && normalizeMarketRegion(item && item.marketRegion) === normalizeMarketRegion(group && group.marketRegion)
        )) || null;
        const refreshDeferredShopResult = (shopResult) => {
          if (!shopResult) {
            return;
          }

          const submittedProductCount = Number(shopResult && shopResult.submittedProductCount) || 0;
          const shopSuccessCount = Number(shopResult && shopResult.successProductCount) || 0;
          const shopFailedCount = Number(shopResult && shopResult.failedProductCount) || 0;

          shopResult.success = shopFailedCount <= 0;
          shopResult.message = shopFailedCount > 0
            ? `\u5b9e\u9645\u63d0\u4ea4 ${submittedProductCount} \u4e2a\uff0c\u6210\u529f ${shopSuccessCount} \u4e2a\uff0c\u5931\u8d25 ${shopFailedCount} \u4e2a`
            : `\u5b9e\u9645\u63d0\u4ea4 ${submittedProductCount} \u4e2a\uff0c\u5df2\u6210\u529f ${shopSuccessCount} \u4e2a`;
        };
        const recordDeferredSuccessProduct = (group, productItem) => {
          const outcomeKey = buildDeferredOutcomeKey(group, productItem);

          if (!outcomeKey || /::$/.test(outcomeKey) || deferredOutcomeKeySet.has(outcomeKey)) {
            return false;
          }

          deferredOutcomeKeySet.add(outcomeKey);
          successProductCount += 1;

          const shopResult = findDeferredShopResult(group);
          if (shopResult) {
            shopResult.successProductCount = (Number(shopResult && shopResult.successProductCount) || 0) + 1;
            refreshDeferredShopResult(shopResult);
          }

          return true;
        };
        const recordDeferredFailedProduct = (group, productItem, fallbackMessage) => {
          const normalizedFailedProduct = {
            shopId: normalizeText(group && group.shopId),
            shopName: normalizeText(group && group.shopName),
            marketRegion: normalizeMarketRegion(group && group.marketRegion),
            siteId: normalizeText(productItem && productItem.siteId),
            productId: normalizeText(productItem && productItem.productId),
            productName: normalizeText(productItem && productItem.productName),
            withoutSkuId: normalizeText(productItem && productItem.withoutSkuId),
            higherCustomPriceSkuId: normalizeText(productItem && productItem.higherCustomPriceSkuId),
            expectedSkuCount: Math.max(0, normalizeIntegerValue(productItem && productItem.expectedSkuCount, 0)),
            submittedSkuCount: Math.max(0, normalizeIntegerValue(productItem && productItem.submittedSkuCount, 0)),
            missingSkuCount: Math.max(0, normalizeIntegerValue(productItem && productItem.missingSkuCount, 0)),
            missingSkuIdList: Array.from(new Set(
              (Array.isArray(productItem && productItem.missingSkuIdList) ? productItem.missingSkuIdList : [])
                .map((value) => normalizeText(value))
                .filter(Boolean)
            )),
            message: normalizeText(productItem && productItem.message) || normalizeText(fallbackMessage)
          };
          const outcomeKey = buildDeferredOutcomeKey(group, normalizedFailedProduct);

          if (!outcomeKey || /::$/.test(outcomeKey) || deferredOutcomeKeySet.has(outcomeKey)) {
            return false;
          }

          deferredOutcomeKeySet.add(outcomeKey);
          failedProductCount += 1;
          failProducts.push(normalizedFailedProduct);

          const shopResult = findDeferredShopResult(group);
          if (shopResult) {
            shopResult.failedProductCount = (Number(shopResult && shopResult.failedProductCount) || 0) + 1;
            shopResult.failProducts = (Array.isArray(shopResult && shopResult.failProducts)
              ? shopResult.failProducts
              : []
            ).concat(normalizedFailedProduct);
            refreshDeferredShopResult(shopResult);
          }

          return true;
        };

        failProducts.forEach((failedProduct) => {
          const outcomeKey = buildDeferredOutcomeKey(failedProduct, failedProduct);

          if (outcomeKey && !/::$/.test(outcomeKey)) {
            deferredOutcomeKeySet.add(outcomeKey);
          }
        });

        deferredRetryEntries.forEach((entry) => {
          const groupKey = [
            normalizeText(entry && entry.shopId),
            normalizeMarketRegion(entry && entry.marketRegion)
          ].join(':');
          const outcomeKey = buildDeferredOutcomeKey(entry, entry && entry.product);
          const productKey = buildTrafficBoostSubmitProductKey(
            entry && entry.product && entry.product.productId,
            entry && entry.product && entry.product.siteId
          );

          if (!groupKey || !productKey || productKey === ':' || deferredOutcomeKeySet.has(outcomeKey)) {
            return;
          }

          if (!deferredRetryGroupMap.has(groupKey)) {
            deferredRetryGroupMap.set(groupKey, {
              shopSummary: entry && entry.shopSummary,
              shopId: normalizeText(entry && entry.shopId),
              shopName: normalizeText(entry && entry.shopName),
              marketRegion: normalizeMarketRegion(entry && entry.marketRegion),
              currentShopIndex: Number(entry && entry.currentShopIndex) || 0,
              shopProductCount: Number(entry && entry.shopProductCount) || 0,
              progressContext: entry && entry.progressContext,
              productKeySet: new Set(),
              products: []
            });
          }

          const group = deferredRetryGroupMap.get(groupKey);

          if (group.productKeySet.has(productKey)) {
            return;
          }

          group.productKeySet.add(productKey);
          group.products.push(entry.product);
        });

        const deferredRetryGroups = Array.from(deferredRetryGroupMap.values())
          .filter((group) => Array.isArray(group && group.products) && group.products.length > 0);

        if (deferredRetryGroups.length > 0) {
          log('operations_traffic_boost_submit_deferred_retry_start', {
            requestId: request.requestId,
            groupCount: deferredRetryGroups.length,
            productCount: deferredRetryGroups.reduce((sum, group) => sum + group.products.length, 0)
          });
        }

        const deferredRetryRuntimeGroups = deferredRetryGroups.map((group) => ({
          ...group,
          retryChunks: chunkList(group.products, submitBatchSize),
          groupProgressContext: group.progressContext && typeof group.progressContext === 'object'
            ? group.progressContext
            : progressContext,
          retryCookieSnapshot: null,
          sessionContext: null,
          failed: false
        })).filter((group) => group.retryChunks.length > 0);
        const maxDeferredRetryRound = deferredRetryRuntimeGroups.reduce((maxRound, group) => {
          return Math.max(maxRound, group.retryChunks.length);
        }, 0);
        const hasRemainingDeferredRetryWork = (groupIndex, roundIndex) => {
          for (let nextGroupIndex = groupIndex + 1; nextGroupIndex < deferredRetryRuntimeGroups.length; nextGroupIndex += 1) {
            const nextGroup = deferredRetryRuntimeGroups[nextGroupIndex];

            if (nextGroup && nextGroup.failed !== true && nextGroup.retryChunks[roundIndex]) {
              return true;
            }
          }

          for (let nextRoundIndex = roundIndex + 1; nextRoundIndex < maxDeferredRetryRound; nextRoundIndex += 1) {
            if (deferredRetryRuntimeGroups.some((group) => (
              group && group.failed !== true && group.retryChunks[nextRoundIndex]
            ))) {
              return true;
            }
          }

          return false;
        };

        if (
          deferredRetryRuntimeGroups.length > 0
          && shouldStopSubmitAfterCurrentStep(submitJob) !== true
          && successProductCount + failedProductCount > 0
        ) {
          const beforeDeferredDelayMs = randomIntegerBetween(
            SUBMIT_SHOP_DELAY_MIN_MS,
            SUBMIT_SHOP_DELAY_MAX_MS
          );

          emitQueryProgress(progressContext, {
            phase: 'querying',
            totalShops: totalShopCount,
            completedShops: completedShopCount,
            failedShops: failedShopCount,
            canceledShops: 0,
            activeShops: 0,
            rowCount: successProductCount,
            totalProductCount,
            successItemCount: successProductCount,
            failedItemCount: failedProductCount,
            message: `\u7b2c\u4e00\u8f6e\u5e97\u94fa\u6279\u6b21\u5df2\u5b8c\u6210\uff0c${(beforeDeferredDelayMs / 1000).toFixed(1)} \u79d2\u540e\u7ee7\u7eed\u8f6e\u8be2\u63d0\u4ea4\u4e0b\u4e00\u6279`
          }, progressEmitter);
          await createCancelableDelay(submitJob, beforeDeferredDelayMs);
        }

        deferredRetryLoop:
        for (let retryRoundIndex = 0; retryRoundIndex < maxDeferredRetryRound; retryRoundIndex += 1) {
          for (let groupIndex = 0; groupIndex < deferredRetryRuntimeGroups.length; groupIndex += 1) {
            if (shouldStopSubmitAfterCurrentStep(submitJob) === true) {
              break deferredRetryLoop;
            }

            const group = deferredRetryRuntimeGroups[groupIndex];
            const retryProductChunk = group && group.failed !== true
              ? group.retryChunks[retryRoundIndex]
              : null;

            if (!Array.isArray(retryProductChunk) || retryProductChunk.length <= 0) {
              continue;
            }

            const retryBatchIndex = retryRoundIndex + 1;
            const groupProgressContext = group.groupProgressContext;

            try {
              if (!group.sessionContext) {
                emitQueryProgress(groupProgressContext, {
                  phase: 'warming-session',
                  totalShops: totalShopCount,
                  completedShops: completedShopCount,
                  failedShops: failedShopCount,
                  canceledShops: 0,
                  activeShops: 1,
                  rowCount: successProductCount,
                  currentShopIndex: group.currentShopIndex,
                  currentShopId: group.shopId,
                  currentShopName: group.shopName,
                  pageNum: retryBatchIndex,
                  totalPages: group.retryChunks.length,
                  estimatedTotal: group.shopProductCount,
                  totalProductCount,
                  successItemCount: successProductCount,
                  failedItemCount: failedProductCount,
                  message: `\u8f6e\u8be2\u63d0\u4ea4\u961f\u5217\uff1a\u6b63\u5728\u68c0\u67e5 ${group.shopName} \u4f1a\u8bdd`
                }, progressEmitter);

                group.sessionContext = await resolveSellerSessionContext(group.shopSummary, {
                  timeoutMs: QUERY_REQUEST_TIMEOUT_MS
                });
              }

              emitQueryProgress(groupProgressContext, {
                phase: 'querying',
                totalShops: totalShopCount,
                completedShops: completedShopCount,
                failedShops: failedShopCount,
                canceledShops: 0,
                activeShops: 1,
                rowCount: successProductCount,
                currentShopIndex: group.currentShopIndex,
                currentShopId: group.shopId,
                currentShopName: group.shopName,
                pageNum: retryBatchIndex,
                totalPages: group.retryChunks.length,
                pageSize: submitBatchSize,
                fetchedItemCount: retryProductChunk.length,
                accumulatedItemCount: successProductCount + failedProductCount,
                estimatedTotal: group.shopProductCount,
                totalProductCount,
                successItemCount: successProductCount,
                failedItemCount: failedProductCount,
                message: `\u6b63\u5728\u8f6e\u8be2\u63d0\u4ea4 ${group.shopName} \u7b2c ${retryBatchIndex}/${group.retryChunks.length} \u6279\uff08${retryProductChunk.length} \u4e2a\u5546\u54c1\uff09`
              }, progressEmitter);

              const retryChunkResult = await submitFlowPriceProductChunkWithFallback(
                group.sessionContext,
                group.shopSummary,
                group.marketRegion,
                retryProductChunk,
                {
                  queryJob: submitJob,
                  progressContext: groupProgressContext,
                  emitProgress: progressEmitter,
                  initialCookieSnapshot: group.retryCookieSnapshot,
                  deferWithoutSkuRetry: false,
                  requestLabel: `${group.shopName}\u6d41\u91cf\u52a0\u901f\u8f6e\u8be2\u7b2c ${retryBatchIndex}/${group.retryChunks.length} \u6279\u63d0\u4ea4`,
                  requestStartMessage: `\u6b63\u5728\u8f6e\u8be2\u63d0\u4ea4 ${group.shopName} \u7b2c ${retryBatchIndex}/${group.retryChunks.length} \u6279\uff08${retryProductChunk.length} \u4e2a\u5546\u54c1\uff09`
                }
              );
              let retryBatchSuccessCount = 0;
              let retryBatchFailedCount = 0;

              group.retryCookieSnapshot = retryChunkResult && retryChunkResult.cookieSnapshot
                ? retryChunkResult.cookieSnapshot
                : group.retryCookieSnapshot;

              (Array.isArray(retryChunkResult && retryChunkResult.successProducts)
                ? retryChunkResult.successProducts
                : []
              ).forEach((productItem) => {
                if (recordDeferredSuccessProduct(group, productItem)) {
                  retryBatchSuccessCount += 1;
                }
              });

              (Array.isArray(retryChunkResult && retryChunkResult.failProducts)
                ? retryChunkResult.failProducts
                : []
              ).forEach((failedProduct) => {
                if (recordDeferredFailedProduct(group, failedProduct, '\u8f6e\u8be2\u63d0\u4ea4\u4ecd\u672a\u6210\u529f')) {
                  retryBatchFailedCount += 1;
                }
              });

              emitQueryProgress(groupProgressContext, {
                phase: shouldStopSubmitAfterCurrentStep(submitJob) === true ? 'canceling' : 'page-completed',
                totalShops: totalShopCount,
                completedShops: completedShopCount,
                failedShops: failedShopCount,
                canceledShops: 0,
                activeShops: 1,
                rowCount: successProductCount,
                currentShopIndex: group.currentShopIndex,
                currentShopId: group.shopId,
                currentShopName: group.shopName,
                pageNum: retryBatchIndex,
                totalPages: group.retryChunks.length,
                pageSize: submitBatchSize,
                fetchedItemCount: retryProductChunk.length,
                accumulatedItemCount: successProductCount + failedProductCount,
                estimatedTotal: group.shopProductCount,
                totalProductCount,
                successItemCount: successProductCount,
                failedItemCount: failedProductCount,
                currentBatchSuccessCount: retryBatchSuccessCount,
                currentBatchFailedCount: retryBatchFailedCount,
                message: retryBatchFailedCount > 0
                  ? `${group.shopName} \u8f6e\u8be2\u7b2c ${retryBatchIndex}/${group.retryChunks.length} \u6279\u5b8c\u6210\uff0c\u6210\u529f ${retryBatchSuccessCount} \u4e2a\uff0c\u5931\u8d25 ${retryBatchFailedCount} \u4e2a`
                  : `${group.shopName} \u8f6e\u8be2\u7b2c ${retryBatchIndex}/${group.retryChunks.length} \u6279\u5b8c\u6210\uff0c\u6210\u529f ${retryBatchSuccessCount} \u4e2a`
              }, progressEmitter);
            } catch (error) {
              if (isQueryCanceledError(error) || shouldStopSubmitAfterCurrentStep(submitJob) === true) {
                emitQueryProgress(groupProgressContext, {
                  phase: 'canceling',
                  totalShops: totalShopCount,
                  completedShops: completedShopCount,
                  failedShops: failedShopCount,
                  canceledShops: Math.max(0, totalShopCount - completedShopCount - failedShopCount),
                  activeShops: 0,
                  rowCount: successProductCount,
                  currentShopIndex: group.currentShopIndex,
                  currentShopId: group.shopId,
                  currentShopName: group.shopName,
                  totalProductCount,
                  successItemCount: successProductCount,
                  failedItemCount: failedProductCount,
                  message: `${group.shopName} \u8f6e\u8be2\u63d0\u4ea4\u5df2\u505c\u6b62`
                }, progressEmitter);
                break deferredRetryLoop;
              }

              const errorMessage = normalizeText(error && error.message) || '\u8f6e\u8be2\u63d0\u4ea4\u5931\u8d25';

              group.failed = true;
              group.products.forEach((productItem) => {
                recordDeferredFailedProduct(group, productItem, errorMessage);
              });
              emitQueryProgress(groupProgressContext, {
                phase: 'request-failed',
                totalShops: totalShopCount,
                completedShops: completedShopCount,
                failedShops: failedShopCount,
                canceledShops: 0,
                activeShops: 0,
                rowCount: successProductCount,
                currentShopIndex: group.currentShopIndex,
                currentShopId: group.shopId,
                currentShopName: group.shopName,
                totalProductCount,
                successItemCount: successProductCount,
                failedItemCount: failedProductCount,
                message: `${group.shopName} \u8f6e\u8be2\u63d0\u4ea4\u5931\u8d25\uff1a${errorMessage}`
              }, progressEmitter);
              logError('operations_traffic_boost_submit_deferred_retry_failed', error, {
                requestId: request.requestId,
                shopId: group.shopId,
                shopName: group.shopName,
                productCount: group.products.length,
                marketRegion: group.marketRegion
              });
            }

            if (
              shouldStopSubmitAfterCurrentStep(submitJob) !== true
              && hasRemainingDeferredRetryWork(groupIndex, retryRoundIndex) === true
            ) {
              await createCancelableDelay(
                submitJob,
                randomIntegerBetween(SUBMIT_SHOP_DELAY_MIN_MS, SUBMIT_SHOP_DELAY_MAX_MS)
              );
            }
          }
        }
      }
    } finally {
      clearSubmitJob(submitJob);
    }

    if (shouldStopSubmitAfterCurrentStep(submitJob) === true) {
      submitJob.canceled = true;
      const canceledShopCount = Math.max(
        0,
        totalShopCount - completedShopCount - failedShopCount
      );

      emitQueryProgress(progressContext, {
        phase: 'canceled',
        totalShops: totalShopCount,
        completedShops: completedShopCount,
        failedShops: failedShopCount,
        canceledShops: canceledShopCount,
        activeShops: 0,
        rowCount: successProductCount,
        totalProductCount,
        successItemCount: successProductCount,
        failedItemCount: failedProductCount,
        message: `\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u5df2\u505c\u6b62\uff0c\u5df2\u6210\u529f ${successProductCount} \u4e2a\uff0c\u5931\u8d25 ${failedProductCount} \u4e2a`
      }, progressEmitter);

      return {
        success: successProductCount > 0 && failedProductCount <= 0,
        updatedAt: nowIso(),
        requestId: request.requestId,
        totalShopCount,
        completedShopCount,
        failedShopCount,
        totalProductCount,
        successProductCount,
        failedProductCount,
        submitBatchSize,
        submitShopConcurrency,
        shopResults,
        failProducts,
        canceled: true,
        canceledShopCount,
        warning: '\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u5df2\u505c\u6b62'
      };
    }

    const warning = failedShopCount > 0
      ? `\u5171 ${totalShopCount} \u5bb6\u5e97\u94fa\uff0c\u6210\u529f ${completedShopCount} \u5bb6\uff0c\u5931\u8d25 ${failedShopCount} \u5bb6`
      : '';

    emitQueryProgress(progressContext, {
      phase: 'completed',
      totalShops: totalShopCount,
      completedShops: completedShopCount,
      failedShops: failedShopCount,
      canceledShops: 0,
      activeShops: 0,
      rowCount: successProductCount,
      totalProductCount,
      successItemCount: successProductCount,
      failedItemCount: failedProductCount,
      message: failedShopCount > 0
        ? `\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u5b8c\u6210\uff0c\u6210\u529f ${successProductCount} \u4e2a\uff0c\u5931\u8d25 ${failedProductCount} \u4e2a\uff0c${failedShopCount} \u5bb6\u5e97\u94fa\u5904\u7406\u5931\u8d25`
        : `\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u5b8c\u6210\uff0c\u5df2\u6210\u529f\u63d0\u4ea4 ${successProductCount} \u4e2a\u5546\u54c1`
    }, progressEmitter);

    return {
      success: successProductCount > 0 && failedProductCount <= 0,
      updatedAt: nowIso(),
      requestId: request.requestId,
      totalShopCount,
      completedShopCount,
      failedShopCount,
      totalProductCount,
      successProductCount,
      failedProductCount,
      submitBatchSize,
      submitShopConcurrency,
      shopResults,
      failProducts,
      canceled: false,
      canceledShopCount: 0,
      warning
    };
  }

  return {
    async queryRows(payload = {}, options = {}) {
      return queryRows(payload, options);
    },
    async cancelQueryJob(payload = {}, options = {}) {
      return cancelQueryJob(payload, options);
    },
    async cancelSubmitJob(payload = {}, options = {}) {
      return cancelSubmitJob(payload, options);
    },
    async getQueryProgressSnapshot(payload = {}) {
      return getQueryProgressSnapshot(payload);
    },
    async getCustomLevelFilterSettings() {
      return getCustomLevelFilterSettings();
    },
    async saveCustomLevelFilterSettings(payload = {}) {
      return saveCustomLevelFilterSettings(payload);
    },
    async submitEnableBatch(payload = {}, options = {}) {
      return submitEnableBatch(payload, options);
    }
  };
}

module.exports = {
  createOperationsTrafficBoostService
};
