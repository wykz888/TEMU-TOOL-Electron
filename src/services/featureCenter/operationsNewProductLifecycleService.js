const crypto = require('node:crypto');
const { normalizeText, isShopParticipating } = require('../shopManagement/common');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');
const {
  buildCostLookupCandidates,
  buildCostPrimaryKey,
  normalizeCostSpecText
} = require('./operationsCostIdentity');
const {
  buildSkuSpecDescriptor
} = require('./operationsSkuSpec');
const {
  computeProfitRateByPrice
} = require('../../utils/operationsProfitMetrics');
const {
  createOperationsNewProductLifecycleStore
} = require('./operationsNewProductLifecycleStore');
const {
  buildPriceDeclFallbackApproveDetail,
  buildPriceDeclPrimaryApproveDetail,
  computePriceDeclProfitMetrics,
  computePriceDeclRedeclareSubmitPrice,
  hasConfiguredPriceDeclFallbackApproveRule,
  normalizePriceDeclFallbackApproveRuleList,
  resolvePriceDeclDeclaredPriceCentFromReviewData,
  resolvePriceDeclDeclaredPriceCentFromRow,
  resolvePriceDeclFallbackApproveDecision
} = require('./operationsPriceDeclarationPricing');

const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const QUERY_ENDPOINT_PATH = '/api/kiana/mms/robin/searchForSemiSupplier';
const BATCH_ADJUST_ACTIVITY_DETAIL_ENDPOINT_PATH = '/api/kiana/magnus/mms/price-adjust/product-adjust-query';
const BATCH_ADJUST_SUBMIT_ENDPOINT_PATH = '/api/kiana/magnus/mms/price/priceAdjust/gmpProductBatchAdjustPrice';
const QUERY_REQUEST_TIMEOUT_MS = 30000;
const QUERY_TRANSIENT_RETRY_LIMIT = 2;
const QUERY_TRANSIENT_RETRY_DELAY_MS = 3000;
  const BATCH_ADJUST_REQUEST_TIMEOUT_MS = 45000;
  const BATCH_ADJUST_DETAIL_CHUNK_SIZE = 50;
  const BATCH_ADJUST_SUBMIT_CHUNK_SIZE = 20;
  const BATCH_ADJUST_PREVIEW_SHOP_CONCURRENCY = 5;
  const BATCH_ADJUST_SUBMIT_SHOP_CONCURRENCY = 5;
const BATCH_ADJUST_SUBMIT_REQUEST_DELAY_MIN_MS = 2000;
const BATCH_ADJUST_SUBMIT_REQUEST_DELAY_MAX_MS = 4000;
const BATCH_ADJUST_PREVIEW_HISTORY_TIMEOUT_MS = 3000;
const BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL = 20;
const BATCH_ADJUST_PREVIEW_REQUEST_CACHE_TTL_MS = 30 * 60 * 1000;
  const DEFAULT_PAGE_SIZE = 100;
const RESPONSE_TEXT_PREVIEW_LIMIT = 280;
const QUERY_SETTINGS_VERSION = 1;
const BATCH_ADJUST_PRESET_VERSION = 1;
const BATCH_ADJUST_SUBMIT_HISTORY_VERSION = 1;
const BATCH_ADJUST_SUBMIT_HISTORY_RETENTION_DAYS = 180;
const BATCH_ADJUST_SUBMIT_CANCELED_ERROR_CODE = 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_CANCELED';
const PRICE_DECL_QUERY_ENDPOINT_PATH = '/api/kiana/magnus/mms/price/bargain-no-bom/batch/info/query';
const PRICE_DECL_SUBMIT_ENDPOINT_PATH = '/api/kiana/magnus/mms/price/bargain-no-bom/batch';
const PRICE_DECL_QUERY_REQUEST_CHUNK_SIZE = 100;
const PRICE_DECL_QUERY_RETRY_TIMES = 2;
const PRICE_DECL_QUERY_RETRY_DELAY_MS = 1000;
const PRICE_DECL_SUBMIT_REQUEST_CHUNK_SIZE = 100;
const PRICE_DECL_SETTINGS_VERSION = 1;
const DEFAULT_PRICE_DECL_SETTINGS = Object.freeze({
  approveUseCostPrice: false,
  approveCondition: 'profitRate',
  approveValue: '',
  fallbackApproveRules: Object.freeze([]),
  approveReduceType: 'discount',
  approveReduceValue: '',
  approveReduceValueDiscount: '',
  approveReduceValueFlatReduce: '',
  voidMaxAttempts: '3'
});

const DEFAULT_BATCH_ADJUST_SETTINGS = Object.freeze({
  stationIds: Object.freeze([]),
  dailyEnabled: true,
  activityEnabled: false,
  reasonCode: '',
  remark: '',
  duplicateSubmitWindowDays: '',
  useSuggestedPriceAfterSubmitCount: '',
  activityPriceReduction: '',
  dailyProfitFloorMode: 'rate',
  dailyProfitFloorValue: '',
  activityProfitFloorMode: 'rate',
  activityProfitFloorValue: ''
});
const DEFAULT_QUERY_SETTINGS = Object.freeze({
  pageDelayMinSeconds: '',
  pageDelayMaxSeconds: ''
});
const BATCH_ADJUST_MODE = Object.freeze({
  fixed: 'fixed',
  reduce: 'reduce',
  discount: 'discount'
});
const BATCH_ADJUST_REASON_CODE_TO_API_VALUE = Object.freeze({
  clearance: 2,
  competitiveness: 3,
  promotion: 4,
  promotion_slow_moving_risk: 14,
  exposure: 15
});
const BATCH_ADJUST_SKIP_REASON_LABELS = Object.freeze({
  missing_cost: '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e',
  daily_source_missing: '\u65e5\u5e38\u7533\u62a5\u4ef7\u7f3a\u5931',
  daily_rule_not_matched: '\u672a\u547d\u4e2d\u65e5\u5e38\u8c03\u4ef7\u7ec4',
  daily_target_invalid: '\u65e5\u5e38\u8c03\u4ef7\u76ee\u6807\u65e0\u6548',
  daily_not_reduce: '\u65e5\u5e38\u8c03\u4ef7\u672a\u4f4e\u4e8e\u5f53\u524d\u7533\u62a5\u4ef7',
  daily_profit_floor: '\u65e5\u5e38\u4f4e\u4e8e\u4fdd\u5e95\u5229\u6da6',
  daily_recent_submitted: '\u65e5\u5e38\u8fd1\u671f\u5df2\u63d0\u4ea4\u8fc7',
  activity_source_missing: '\u65e0\u5efa\u8bae\u6d3b\u52a8\u4ef7',
  activity_reduction_missing: '\u6d3b\u52a8\u76f4\u51cf\u4ef7\u672a\u8bbe\u7f6e',
  activity_target_invalid: '\u6d3b\u52a8\u76f4\u51cf\u4ef7\u76ee\u6807\u65e0\u6548',
  activity_not_reduce: '\u6d3b\u52a8\u76f4\u51cf\u4ef7\u672a\u4f4e\u4e8e\u5f53\u524d\u6d3b\u52a8\u7533\u62a5\u4ef7',
  activity_profit_floor: '\u6d3b\u52a8\u4f4e\u4e8e\u4fdd\u5e95\u5229\u6da6',
  activity_recent_submitted: '\u6d3b\u52a8\u8fd1\u671f\u5df2\u63d0\u4ea4\u8fc7',
  activity_invitation_empty: '\u6d3b\u52a8\u8be6\u60c5\u672a\u8fd4\u56de\u53ef\u7528\u7684 activityInvitationId',
  activity_invitation_price_mismatch: '\u6d3b\u52a8\u8be6\u60c5\u5df2\u8fd4\u56de\uff0c\u4f46\u672a\u5339\u914d\u5230\u5bf9\u5e94\u6d3b\u52a8\u4ef7',
  profit_floor: '\u4f4e\u4e8e\u4fdd\u5e95\u5229\u6da6',
  missing_supplier_id: '\u7f3a\u5c11 supplierId',
  missing_identity: '\u7f3a\u5c11\u63d0\u4ea4\u6240\u9700\u6807\u8bc6',
  detail_forbid: '\u8be6\u60c5\u63a5\u53e3\u8fd4\u56de\u4e0d\u53ef\u8c03\u4ef7',
  activity_detail_missing: '\u7f3a\u5c11\u6d3b\u52a8\u4ef7\u8be6\u60c5',
  activity_invitation_missing: '\u672a\u5339\u914d\u5230\u5bf9\u5e94\u7684 activityInvitationId'
});
const BATCH_ADJUST_GENERIC_SCOPE_SKIP_REASON_KEYS = Object.freeze([
  'missing_cost',
  'missing_supplier_id',
  'missing_identity',
  'profit_floor'
]);
const BATCH_ADJUST_ACTIVITY_SCOPE_SKIP_REASON_KEYS = Object.freeze([
  'detail_forbid'
]);
const MAX_MULTI_KEYWORDS = 40;
const TIME_TYPE_BY_FIELD = Object.freeze({
  createdAt: 1,
  priceConfirmedAt: 4,
  joinedStationAt: 6,
  offlineAt: 7
});
const PRODUCT_ID_FIELD_BY_TYPE = Object.freeze({
  spu: 'productSpuIdList',
  skc: 'productSkcIdList',
  sku: 'productSkuIdList'
});
const GOODS_NO_FIELD_BY_TYPE = Object.freeze({
  skc: 'skcExtCodeList',
  sku: 'skuExtCodeList'
});
const PRODUCT_SOURCE_PAYLOADS = Object.freeze({
  all: Object.freeze({
    supplierTodoTypeList: Object.freeze([])
  }),
  pricePending: Object.freeze({
    priceReviewStatusList: Object.freeze([0]),
    secondarySelectStatusList: Object.freeze([7]),
    supplierTodoTypeList: Object.freeze([])
  }),
  pricePendingSellerConfirm: Object.freeze({
    priceReviewStatusList: Object.freeze([1]),
    secondarySelectStatusList: Object.freeze([7]),
    supplierTodoTypeList: Object.freeze([])
  }),
  priceInvalid: Object.freeze({
    secondarySelectStatusList: Object.freeze([9]),
    supplierTodoTypeList: Object.freeze([])
  }),
  unpublished: Object.freeze({
    secondarySelectStatusList: Object.freeze([10, 11]),
    supplierTodoTypeList: Object.freeze([])
  }),
  published: Object.freeze({
    secondarySelectStatusList: Object.freeze([12]),
    supplierTodoTypeList: Object.freeze([])
  }),
  offline: Object.freeze({
    secondarySelectStatusList: Object.freeze([13]),
    supplierTodoTypeList: Object.freeze([])
  }),
  terminated: Object.freeze({
    secondarySelectStatusList: Object.freeze([17]),
    supplierTodoTypeList: Object.freeze([])
  })
});
const QUERY_CANCELED_ERROR_CODE = 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_CANCELED';

function createOperationsNewProductLifecycleService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  operationsSharedCostService,
  getShopWindowBrowserController,
  runtimeLogger
}) {
  const store = createOperationsNewProductLifecycleStore({
    sessionStore,
    featureCenterProfileService
  });
  const activeQueryJobsByRunId = new Map();
  const activeQueryJobsByRequesterKey = new Map();
  const activePriceDeclRunsByRunId = new Map();
  const activeBatchAdjustRunsByRunId = new Map();
  const batchAdjustPreviewRequestCacheByRunId = new Map();

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
    scope: 'operations-new-product-lifecycle'
  });

  function emitQueryProgress(payload = {}, progressEmitter) {
    if (typeof progressEmitter !== 'function') {
      return;
    }

    try {
      progressEmitter({
        source: 'operations-new-product-lifecycle',
        updatedAt: nowIso(),
        ...payload
      });
    } catch (error) {
      logError('operations_new_product_lifecycle_progress_emit_failed', error, {
        runId: normalizeText(payload && payload.runId),
        shopId: normalizeText(payload && payload.shopId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  function nowIso() {
    return new Date().toISOString();
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

  function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numericValue = Number(value);
    const timestamp = Number.isFinite(numericValue)
      ? numericValue
      : Date.parse(value);

    return Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp).toISOString()
      : '';
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

  function normalizeSelectedAdLevels(adLevels) {
    return Array.from(new Set(
      (Array.isArray(adLevels) ? adLevels : [])
        .map((adLevel) => normalizeText(adLevel).toLowerCase())
        .filter((adLevel) => adLevel === 's' || adLevel === 'a' || adLevel === 'b' || adLevel === 'c')
    ));
  }

  function normalizeSelectedTrafficStates(trafficStates) {
    return Array.from(new Set(
      (Array.isArray(trafficStates) ? trafficStates : [])
        .map((trafficState) => normalizeText(trafficState))
        .filter(Boolean)
    ));
  }

  function truncateText(value, maxLength = RESPONSE_TEXT_PREVIEW_LIMIT) {
    const text = normalizeText(value);

    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
  }

  function shouldForcePublishedProductSource(trafficStates) {
    return normalizeSelectedTrafficStates(trafficStates).includes('dropped');
  }

  function normalizeProductSourceValue(productSource, trafficStates) {
    if (shouldForcePublishedProductSource(trafficStates)) {
      return 'published';
    }

    return normalizeText(productSource);
  }

  function createQueryCanceledError() {
    const error = new Error('\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u5df2\u505c\u6b62');
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

  function isQueryTransientRetryableError(error) {
    if (!error || isQueryCanceledError(error)) {
      return false;
    }

    if (error.timeout === true) {
      return true;
    }

    const normalizedMessage = normalizeText(error && error.message).toLowerCase();
    const responseTextPreview = normalizeText(error && error.responseTextPreview).toLowerCase();
    const lastSiteMainStatus = normalizeText(error && error.lastSiteMainStatus).toLowerCase();
    const lastAutofillStatus = normalizeText(error && error.lastAutofillStatus).toLowerCase();

    if (
      lastSiteMainStatus === 'pending-agreement'
      || lastSiteMainStatus === 'pending-authorization'
      || lastAutofillStatus === 'authorization-confirm-clicked'
      || lastAutofillStatus === 'pending-agreement'
    ) {
      return true;
    }

    return (
      normalizedMessage.includes('\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38')
      || normalizedMessage.includes('\u8bf7\u6c42\u8d85\u65f6')
      || normalizedMessage.includes('timeout')
      || responseTextPreview.includes('\u5373\u5c06\u8df3\u8f6c\u81f3temu seller central')
      || responseTextPreview.includes('seller central')
      || responseTextPreview.includes('\u9690\u79c1\u653f\u7b56')
      || responseTextPreview.includes('\u6388\u6743')
    );
  }

  function createQueryJob(payload = {}, options = {}) {
    const runId = normalizeText(payload && payload.runId) || `npl_query_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const requesterKey = normalizeText(options && options.requesterKey);
    const existingJob = requesterKey
      ? activeQueryJobsByRequesterKey.get(requesterKey)
      : null;

    if (existingJob && existingJob.canceled !== true) {
      throw new Error('\u5f53\u524d\u5df2\u6709\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u4efb\u52a1\u5728\u8fdb\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u6216\u7b49\u5f85\u5b8c\u6210');
    }

    const job = {
      runId,
      requesterKey,
      canceled: false,
      activeControllers: new Set(),
      activeDelayCancels: new Set()
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

    Array.from(job.activeDelayCancels).forEach((cancelDelay) => {
      try {
        cancelDelay();
      } catch (_error) {
        // ignore delay cancel failures
      }
    });

    return true;
  }

  function createBatchAdjustRunHandle(payload = {}) {
    const runId = normalizeText(payload && payload.runId) || `npl_batch_adjust_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const existingRun = activeBatchAdjustRunsByRunId.get(runId);

    if (existingRun && existingRun.canceled !== true) {
      throw new Error('\u5f53\u524d\u6279\u91cf\u8c03\u4ef7\u4efb\u52a1\u6807\u8bc6\u5df2\u5728\u4f7f\u7528\uff0c\u8bf7\u91cd\u8bd5');
    }

    const runHandle = {
      runId,
      canceled: false,
      activeControllers: new Set(),
      activeDelayCancels: new Set()
    };

    activeBatchAdjustRunsByRunId.set(runId, runHandle);
    return runHandle;
  }

  function getBatchAdjustRunHandle(payload = {}) {
    const runId = normalizeText(payload && payload.runId);

    if (!runId) {
      return null;
    }

    return activeBatchAdjustRunsByRunId.get(runId) || null;
  }

  function clearBatchAdjustRunHandle(runHandle) {
    if (!runHandle) {
      return;
    }

    if (
      runHandle.runId
      && activeBatchAdjustRunsByRunId.get(runHandle.runId) === runHandle
    ) {
      activeBatchAdjustRunsByRunId.delete(runHandle.runId);
    }
  }

  function cancelBatchAdjustRunInternally(runHandle) {
    if (!runHandle || runHandle.canceled === true) {
      return false;
    }

    runHandle.canceled = true;

    Array.from(runHandle.activeControllers).forEach((controller) => {
      try {
        controller.abort();
      } catch (_error) {
        // ignore abort failures
      }
    });

    Array.from(runHandle.activeDelayCancels).forEach((cancelDelay) => {
      try {
        cancelDelay();
      } catch (_error) {
        // ignore delay cancel failures
      }
    });

    return true;
  }

  function cancelPriceDeclRunInternally(runHandle) {
    return cancelBatchAdjustRunInternally(runHandle);
  }

  function assertBatchAdjustRunActive(runHandle) {
    if (runHandle && runHandle.canceled === true) {
      const error = new Error('\u6279\u91cf\u8c03\u4ef7\u5df2\u505c\u6b62');
      error.code = BATCH_ADJUST_SUBMIT_CANCELED_ERROR_CODE;
      throw error;
    }
  }

  function isBatchAdjustCanceledError(error) {
    return Boolean(
      error
      && (
        error.code === BATCH_ADJUST_SUBMIT_CANCELED_ERROR_CODE
        || error.name === 'AbortError'
      )
    );
  }

  function assertQueryJobActive(job) {
    if (job && job.canceled === true) {
      throw createQueryCanceledError();
    }
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

  function normalizeDelaySecondsValue(value, fieldLabel) {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const parsedValue = normalizeDecimalValue(value, Number.NaN);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      throw new Error(`${fieldLabel}\u4ec5\u652f\u6301\u5927\u4e8e\u6216\u7b49\u4e8e0\u7684\u6570\u5b57\u3002`);
    }

    return Number(parsedValue.toFixed(3));
  }

  function formatDelaySettingsValue(value) {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return '';
    }

    return Number(parsedValue.toFixed(3));
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

  function createBatchAdjustPresetGroupId() {
    return `npl_batch_adjust_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  }

  function resolveBatchAdjustStationIdentityValue(source = {}) {
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

  function buildBatchAdjustPresetKey(shopId, station, category, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedCategory = normalizeText(category);
    const normalizedSpec = normalizeCostSpecText(spec);

    if (!normalizedShopId || !normalizedCategory || !normalizedSpec) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedCategory}\x1f${normalizedSpec}`.toLowerCase();
  }

  function resolveBatchAdjustPresetSpecVariants(source = {}) {
    const specVariants = [];
    const seenSpecKeys = new Set();

    []
      .concat(source && source.spec ? [source.spec] : [])
      .concat(source && source.legacySpec ? [source.legacySpec] : [])
      .concat(Array.isArray(source && source.specAliases) ? source.specAliases : [])
      .forEach((specValue) => {
        const normalizedSpec = normalizeCostSpecText(specValue);
        const specKey = normalizedSpec.toLowerCase();

        if (!specKey || seenSpecKeys.has(specKey)) {
          return;
        }

        seenSpecKeys.add(specKey);
        specVariants.push(normalizedSpec);
      });

    return specVariants;
  }

  function buildBatchAdjustPresetCandidateKeys(source = {}) {
    const shopId = normalizeText(source && source.shopId);
    const station = resolveBatchAdjustStationIdentityValue(source);
    const category = normalizeText(source && source.category);

    return resolveBatchAdjustPresetSpecVariants(source)
      .map((specValue) => buildBatchAdjustPresetKey(shopId, station, category, specValue))
      .filter(Boolean);
  }

  function normalizeBatchAdjustMode(value) {
    const mode = normalizeText(value);
    return BATCH_ADJUST_MODE[mode] || BATCH_ADJUST_MODE.fixed;
  }

  function normalizeBatchAdjustNumericText(value, options = {}) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const decimals = Number.isFinite(Number(options && options.decimals))
      ? Math.max(0, Number.parseInt(options.decimals, 10))
      : 2;
    const parsedValue = normalizePositiveDecimalValue(normalizedValue, Number.NaN);

    if (!Number.isFinite(parsedValue)) {
      return '';
    }

    return String(Number(parsedValue.toFixed(decimals)));
  }

  function normalizeBatchAdjustDuplicateSubmitWindowDaysText(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const parsedValue = normalizeIntegerValue(normalizedValue, 0);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return '';
    }

    return String(parsedValue);
  }

  function resolveBatchAdjustDuplicateSubmitWindowDays(settings) {
    const normalizedValue = normalizeBatchAdjustDuplicateSubmitWindowDaysText(
      settings && settings.duplicateSubmitWindowDays
    );

    return normalizedValue
      ? Math.max(0, normalizeIntegerValue(normalizedValue, 0))
      : 0;
  }

  function normalizeBatchAdjustSuggestedPriceFallbackCountText(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const parsedValue = normalizeIntegerValue(normalizedValue, 0);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return '';
    }

    return String(parsedValue);
  }

  function resolveBatchAdjustSuggestedPriceFallbackCount(settings) {
    const normalizedValue = normalizeBatchAdjustSuggestedPriceFallbackCountText(
      settings && settings.useSuggestedPriceAfterSubmitCount
    );

    return normalizedValue
      ? Math.max(0, normalizeIntegerValue(normalizedValue, 0))
      : 0;
  }

  function normalizeBatchAdjustProfitFloorMode(value) {
    return normalizeText(value) === 'value' ? 'value' : 'rate';
  }

  function normalizeBatchAdjustPresetGroup(group = {}) {
    const input = group && typeof group === 'object' && !Array.isArray(group)
      ? group
      : {};
    const declaredPriceMin = normalizeBatchAdjustNumericText(
      input.declaredPriceMin,
      { decimals: 2 }
    );
    const declaredPriceMax = normalizeBatchAdjustNumericText(
      input.declaredPriceMax,
      { decimals: 2 }
    );
    const adjustMode = normalizeBatchAdjustMode(
      input.adjustMode || input.priceMode || input.mode
    );
    const adjustValue = normalizeBatchAdjustNumericText(
      input.adjustValue || input.priceValue || input.value,
      { decimals: 2 }
    );

    return {
      id: normalizeText(input.id) || createBatchAdjustPresetGroupId(),
      declaredPriceMin,
      declaredPriceMax,
      adjustMode,
      adjustValue
    };
  }

  function normalizeBatchAdjustPresetGroupList(groups) {
    const groupMap = new Map();

    (Array.isArray(groups) ? groups : []).forEach((group) => {
      const normalizedGroup = normalizeBatchAdjustPresetGroup(group);
      const hasValue = Boolean(
        normalizedGroup.declaredPriceMin
        || normalizedGroup.declaredPriceMax
        || normalizedGroup.adjustValue
        || normalizedGroup.adjustMode !== BATCH_ADJUST_MODE.fixed
      );

      if (!hasValue) {
        return;
      }

      groupMap.set(normalizedGroup.id, normalizedGroup);
    });

    return Array.from(groupMap.values());
  }

  function normalizeBatchAdjustPresetStationIds(stationIds) {
    return Array.from(new Set(
      (Array.isArray(stationIds) ? stationIds : [])
        .map((stationId) => normalizeText(stationId))
        .filter(Boolean)
    ));
  }

  function normalizeBatchAdjustEnabledSetting(value, fallbackValue) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }
    }

    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue) {
      return fallbackValue === true;
    }

    if (
      normalizedValue === '1'
      || normalizedValue === 'true'
      || normalizedValue === 'yes'
      || normalizedValue === 'on'
    ) {
      return true;
    }

    if (
      normalizedValue === '0'
      || normalizedValue === 'false'
      || normalizedValue === 'no'
      || normalizedValue === 'off'
    ) {
      return false;
    }

    return fallbackValue === true;
  }

  function normalizeBatchAdjustPresetSettings(settings = {}) {
    const input = settings && typeof settings === 'object' && !Array.isArray(settings)
      ? settings
      : {};
    const legacyProfitFloorMode = normalizeBatchAdjustProfitFloorMode(
      input.profitFloorMode || input.minimumProfitMode || input.minProfitMode
    );
    const legacyProfitFloorValue = normalizeBatchAdjustNumericText(
      input.profitFloorValue || input.minimumProfitValue || input.minProfitValue,
      { decimals: 2 }
    );

    return {
      stationIds: normalizeBatchAdjustPresetStationIds(
        input.stationIds || input.siteIds
      ),
      dailyEnabled: normalizeBatchAdjustEnabledSetting(input.dailyEnabled, true),
      activityEnabled: normalizeBatchAdjustEnabledSetting(input.activityEnabled, false),
      reasonCode: normalizeText(
        input.reasonCode || input.adjustReason || input.reason
      ),
      remark: normalizeText(input.remark),
      duplicateSubmitWindowDays: normalizeBatchAdjustDuplicateSubmitWindowDaysText(
        input.duplicateSubmitWindowDays || input.duplicateFilterDays
      ),
      useSuggestedPriceAfterSubmitCount: normalizeBatchAdjustSuggestedPriceFallbackCountText(
        input.useSuggestedPriceAfterSubmitCount
          || input.suggestedPriceAfterSubmitCount
          || input.usePlatformSuggestedPriceAfterCount
      ),
      activityPriceReduction: normalizeBatchAdjustNumericText(
        input.activityPriceReduction || input.activityReduction || input.activityReduceAmount,
        { decimals: 2 }
      ),
      dailyProfitFloorMode: normalizeBatchAdjustProfitFloorMode(
        input.dailyProfitFloorMode || legacyProfitFloorMode
      ),
      dailyProfitFloorValue: normalizeBatchAdjustNumericText(
        input.dailyProfitFloorValue || legacyProfitFloorValue,
        { decimals: 2 }
      ),
      activityProfitFloorMode: normalizeBatchAdjustProfitFloorMode(
        input.activityProfitFloorMode || input.activityMinimumProfitMode || input.activityMinProfitMode || legacyProfitFloorMode
      ),
      activityProfitFloorValue: normalizeBatchAdjustNumericText(
        input.activityProfitFloorValue || input.activityMinimumProfitValue || input.activityMinProfitValue || legacyProfitFloorValue,
        { decimals: 2 }
      )
    };
  }

  function buildDefaultBatchAdjustPresetPayload(owner) {
    return {
      version: BATCH_ADJUST_PRESET_VERSION,
      owner: owner || store.getOwner() || null,
      updatedAt: '',
      settings: normalizeBatchAdjustPresetSettings(DEFAULT_BATCH_ADJUST_SETTINGS),
      entries: []
    };
  }

  function buildBatchAdjustSubmitHistoryRecordKey(record, kind) {
    const normalizedKind = normalizeText(kind) === 'activity' ? 'activity' : 'daily';
    const shopId = normalizeText(record && record.shopId);
    const productId = normalizeText(record && record.productId);
    const productSkcId = normalizeText(record && record.productSkcId);
    const skuId = normalizeText(record && record.skuId);
    const siteId = normalizeText(record && record.siteId);
    const activityInvitationId = normalizeText(record && record.activityInvitationId);

    if (!shopId || !productId || !skuId || !siteId) {
      return '';
    }

    if (normalizedKind === 'activity' && !activityInvitationId) {
      return '';
    }

    return normalizedKind === 'activity'
      ? [shopId, productId, productSkcId, skuId, siteId, activityInvitationId].join('\x1f')
      : [shopId, productId, productSkcId, skuId, siteId].join('\x1f');
  }

  function normalizeBatchAdjustSubmitHistoryRecord(record, kind) {
    const normalizedKind = normalizeText(kind) === 'activity' ? 'activity' : 'daily';
    const input = record && typeof record === 'object' && !Array.isArray(record)
      ? record
      : {};
    const key = buildBatchAdjustSubmitHistoryRecordKey(input, normalizedKind);
    const submittedAt = normalizeTimestamp(input.submittedAt || input.updatedAt);

    if (!key || !submittedAt) {
      return null;
    }

    return {
      key,
      kind: normalizedKind,
      submittedAt,
      submitCount: Math.max(1, normalizeIntegerValue(input.submitCount, 1)),
      shopId: normalizeText(input.shopId),
      shopName: normalizeText(input.shopName),
      productId: normalizeText(input.productId),
      productSkcId: normalizeText(input.productSkcId),
      skuId: normalizeText(input.skuId),
      siteId: normalizeText(input.siteId),
      supplierId: normalizeText(input.supplierId),
      productName: normalizeText(input.productName),
      spec: normalizeText(input.spec),
      activityInvitationId: normalizedKind === 'activity'
        ? normalizeText(input.activityInvitationId)
        : ''
    };
  }

  function normalizeBatchAdjustSubmitHistoryRecordMap(records, kind) {
    const normalizedKind = normalizeText(kind) === 'activity' ? 'activity' : 'daily';
    const nextRecordMap = {};
    const sourceRecords = Array.isArray(records)
      ? records
      : (records && typeof records === 'object' ? Object.values(records) : []);

    sourceRecords.forEach((record) => {
      const normalizedRecord = normalizeBatchAdjustSubmitHistoryRecord(record, normalizedKind);

      if (!normalizedRecord) {
        return;
      }

      nextRecordMap[normalizedRecord.key] = normalizedRecord;
    });

    return nextRecordMap;
  }

  function pruneBatchAdjustSubmitHistoryRecordMap(recordMap, retentionDays = BATCH_ADJUST_SUBMIT_HISTORY_RETENTION_DAYS) {
    const normalizedRecordMap = recordMap && typeof recordMap === 'object' && !Array.isArray(recordMap)
      ? recordMap
      : {};
    const retentionMs = Math.max(1, normalizeIntegerValue(retentionDays, BATCH_ADJUST_SUBMIT_HISTORY_RETENTION_DAYS))
      * 24
      * 60
      * 60
      * 1000;
    const nowTimestamp = Date.now();
    const nextRecordMap = {};

    Object.keys(normalizedRecordMap).forEach((recordKey) => {
      const record = normalizedRecordMap[recordKey];
      const submittedTimestamp = Date.parse(normalizeText(record && record.submittedAt));

      if (!Number.isFinite(submittedTimestamp)) {
        return;
      }

      if (nowTimestamp - submittedTimestamp > retentionMs) {
        return;
      }

      nextRecordMap[recordKey] = record;
    });

    return nextRecordMap;
  }

  function buildDefaultBatchAdjustSubmitHistoryPayload(owner) {
    return {
      version: BATCH_ADJUST_SUBMIT_HISTORY_VERSION,
      owner: owner || store.getOwner() || null,
      updatedAt: '',
      dailyRecords: {},
      activityRecords: {}
    };
  }

  function normalizeBatchAdjustSubmitHistoryPayload(payload, owner) {
    const basePayload = buildDefaultBatchAdjustSubmitHistoryPayload(owner);
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};

    return {
      ...basePayload,
      updatedAt: normalizeText(input.updatedAt),
      dailyRecords: pruneBatchAdjustSubmitHistoryRecordMap(
        normalizeBatchAdjustSubmitHistoryRecordMap(input.dailyRecords, 'daily')
      ),
      activityRecords: pruneBatchAdjustSubmitHistoryRecordMap(
        normalizeBatchAdjustSubmitHistoryRecordMap(input.activityRecords, 'activity')
      )
    };
  }

  function buildBatchAdjustSubmitHistoryLineRecord(row, kind, extra = {}) {
    const normalizedKind = normalizeText(kind) === 'activity' ? 'activity' : 'daily';
    const record = {
      kind: normalizedKind,
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      productId: normalizeText(row && row.productId),
      productSkcId: normalizeText(row && row.productSkcId),
      skuId: normalizeText(row && row.skuId),
      siteId: normalizeText(row && row.siteId),
      supplierId: normalizeText(row && row.supplierId),
      productName: normalizeText(row && row.productName),
      spec: normalizeText(row && row.spec),
      activityInvitationId: normalizedKind === 'activity'
        ? normalizeText(extra && extra.activityInvitationId)
        : ''
    };
    const key = buildBatchAdjustSubmitHistoryRecordKey(record, normalizedKind);

    return key
      ? {
        ...record,
        key
      }
      : null;
  }

  function normalizeBatchAdjustPendingHistoryRecord(record, kind) {
    const normalizedKind = normalizeText(kind) === 'activity' ? 'activity' : 'daily';
    const input = record && typeof record === 'object' && !Array.isArray(record)
      ? record
      : {};
    const baseRecord = {
      key: normalizeText(input.key),
      kind: normalizedKind,
      shopId: normalizeText(input.shopId),
      shopName: normalizeText(input.shopName),
      productId: normalizeText(input.productId),
      productSkcId: normalizeText(input.productSkcId),
      skuId: normalizeText(input.skuId),
      siteId: normalizeText(input.siteId),
      supplierId: normalizeText(input.supplierId),
      productName: normalizeText(input.productName),
      spec: normalizeText(input.spec),
      activityInvitationId: normalizedKind === 'activity'
        ? normalizeText(input.activityInvitationId)
        : ''
    };
    const key = baseRecord.key || buildBatchAdjustSubmitHistoryRecordKey(baseRecord, normalizedKind);

    if (!key) {
      return null;
    }

    return {
      ...baseRecord,
      key,
      submitCount: Math.max(0, normalizeIntegerValue(input.submitCount, 0))
    };
  }

  function getBatchAdjustSubmitHistoryRecord(historyPayload, kind, historyKey) {
    const normalizedKind = normalizeText(kind) === 'activity' ? 'activity' : 'daily';
    const normalizedHistoryKey = normalizeText(historyKey);
    const recordMap = normalizedKind === 'activity'
      ? historyPayload && historyPayload.activityRecords
      : historyPayload && historyPayload.dailyRecords;

    if (!normalizedHistoryKey || !recordMap || typeof recordMap !== 'object') {
      return null;
    }

    return recordMap[normalizedHistoryKey] || null;
  }

  function getBatchAdjustSubmitHistoryCount(historyPayload, kind, historyKey) {
    const record = getBatchAdjustSubmitHistoryRecord(historyPayload, kind, historyKey);
    return Math.max(0, normalizeIntegerValue(record && record.submitCount, 0));
  }

  function shouldUseBatchAdjustSuggestedPrice(historyPayload, kind, historyKey, thresholdCount, suggestedPrice) {
    const normalizedThresholdCount = Math.max(0, normalizeIntegerValue(thresholdCount, 0));
    const normalizedSuggestedPrice = normalizeMoneyCentValue(suggestedPrice);

    if (normalizedThresholdCount <= 0 || normalizedSuggestedPrice <= 0) {
      return false;
    }

    return getBatchAdjustSubmitHistoryCount(historyPayload, kind, historyKey) >= normalizedThresholdCount;
  }

  function resolveBatchAdjustDailySuggestedTargetSupplyPrice(oldSupplyPrice, suggestedSupplyPrice) {
    const normalizedOldSupplyPrice = normalizeMoneyCentValue(oldSupplyPrice);
    const normalizedSuggestedSupplyPrice = normalizeMoneyCentValue(suggestedSupplyPrice);

    if (normalizedOldSupplyPrice <= 0) {
      return {
        targetSupplyPrice: normalizedSuggestedSupplyPrice,
        priceSource: 'suggested'
      };
    }

    if (normalizedSuggestedSupplyPrice > normalizedOldSupplyPrice) {
      return {
        targetSupplyPrice: Math.max(0, normalizedOldSupplyPrice - 1),
        priceSource: 'suggested_reduce_cent'
      };
    }

    return {
      targetSupplyPrice: normalizedSuggestedSupplyPrice,
      priceSource: 'suggested'
    };
  }

  function getBatchAdjustScopedLocalSkipReasonKeys(row, scope) {
    return filterBatchAdjustReasonKeysByScope(
      row && row.localSkipReasons,
      scope
    );
  }

  function recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, scope, fallbackReasonKey = '') {
    const localReasonKeys = getBatchAdjustScopedLocalSkipReasonKeys(row, scope);

    if (localReasonKeys.length > 0) {
      recordBatchAdjustSkipReasons(reasonRowIdMap, rowId, localReasonKeys);
      return true;
    }

    if (fallbackReasonKey) {
      recordBatchAdjustSkipReason(reasonRowIdMap, fallbackReasonKey, rowId);
      return true;
    }

    return false;
  }

  function shouldSkipBatchAdjustRecentSubmitted(historyPayload, kind, historyKey, windowDays) {
    const normalizedWindowDays = Math.max(0, normalizeIntegerValue(windowDays, 0));

    if (normalizedWindowDays <= 0) {
      return false;
    }

    const record = getBatchAdjustSubmitHistoryRecord(historyPayload, kind, historyKey);
    const submittedTimestamp = Date.parse(normalizeText(record && record.submittedAt));

    if (!record || !Number.isFinite(submittedTimestamp)) {
      return false;
    }

    return Date.now() - submittedTimestamp < normalizedWindowDays * 24 * 60 * 60 * 1000;
  }

  function upsertBatchAdjustSubmitHistoryRecord(historyPayload, record, submittedAt = nowIso()) {
    const currentRecord = getBatchAdjustSubmitHistoryRecord(
      historyPayload,
      record && record.kind,
      record && record.key
    );
    const normalizedRecord = normalizeBatchAdjustSubmitHistoryRecord({
      ...(record && typeof record === 'object' ? record : {}),
      submittedAt,
      submitCount: Math.max(
        1,
        normalizeIntegerValue(currentRecord && currentRecord.submitCount, 0) + 1
      )
    }, record && record.kind);

    if (!normalizedRecord) {
      return false;
    }

    const targetKey = normalizedRecord.kind === 'activity'
      ? 'activityRecords'
      : 'dailyRecords';
    const currentRecordMap = historyPayload && historyPayload[targetKey] && typeof historyPayload[targetKey] === 'object'
      ? historyPayload[targetKey]
      : {};

    historyPayload[targetKey] = pruneBatchAdjustSubmitHistoryRecordMap({
      ...currentRecordMap,
      [normalizedRecord.key]: normalizedRecord
    });
    historyPayload.updatedAt = submittedAt;
    return true;
  }

  function normalizeBatchAdjustPresetEntry(entry) {
    const input = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry
      : {};
    const shopId = normalizeText(input.shopId);
    const station = resolveBatchAdjustStationIdentityValue(input);
    const category = normalizeText(input.category);
    const spec = normalizeText(input.spec);
    const key = buildBatchAdjustPresetKey(shopId, station, category, spec);

    if (!key) {
      return null;
    }

    return {
      key,
      shopId,
      shopName: normalizeText(input.shopName),
      station,
      stationLabel: normalizeText(input.stationLabel),
      category,
      categoryLabel: normalizeText(input.categoryLabel),
      categoryTrail: normalizeText(input.categoryTrail),
      spec,
      groups: normalizeBatchAdjustPresetGroupList(input.groups),
      updatedAt: normalizeText(input.updatedAt)
    };
  }

  function normalizeBatchAdjustPresetPayload(payload, owner) {
    const basePayload = buildDefaultBatchAdjustPresetPayload(owner);
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const entryMap = new Map();

    (Array.isArray(input.entries) ? input.entries : []).forEach((entry) => {
      const normalizedEntry = normalizeBatchAdjustPresetEntry(entry);

      if (!normalizedEntry) {
        return;
      }

      entryMap.set(normalizedEntry.key, normalizedEntry);
    });

    return {
      ...basePayload,
      updatedAt: normalizeText(input.updatedAt),
      settings: normalizeBatchAdjustPresetSettings({
        ...DEFAULT_BATCH_ADJUST_SETTINGS,
        ...input.settings
      }),
      entries: Array.from(entryMap.values()).sort((left, right) => {
        const leftShopName = normalizeText(left && left.shopName) || normalizeText(left && left.shopId);
        const rightShopName = normalizeText(right && right.shopName) || normalizeText(right && right.shopId);
        const shopCompare = leftShopName.localeCompare(rightShopName, 'zh-CN');

        if (shopCompare !== 0) {
          return shopCompare;
        }

        const stationCompare = resolveBatchAdjustStationIdentityValue(left).localeCompare(
          resolveBatchAdjustStationIdentityValue(right),
          'zh-CN'
        );

        if (stationCompare !== 0) {
          return stationCompare;
        }

        const categoryCompare = normalizeText(left && left.categoryLabel).localeCompare(
          normalizeText(right && right.categoryLabel),
          'zh-CN'
        );

        if (categoryCompare !== 0) {
          return categoryCompare;
        }

        return normalizeText(left && left.spec).localeCompare(
          normalizeText(right && right.spec),
          'zh-CN'
        );
      })
    };
  }

  function filterBatchAdjustPresetEntries(entries, payload = {}) {
    const requestedShopIds = new Set(
      normalizeSelectedShopIds(payload && payload.shopIds)
    );
    const requestedKeys = new Set();

    (Array.isArray(payload && payload.entries) ? payload.entries : []).forEach((entry) => {
      buildBatchAdjustPresetCandidateKeys(entry).forEach((candidateKey) => {
        requestedKeys.add(candidateKey);
      });
    });

    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const entryShopId = normalizeText(entry && entry.shopId);
      const entryKey = buildBatchAdjustPresetKey(
        entry && entry.shopId,
        resolveBatchAdjustStationIdentityValue(entry),
        entry && entry.category,
        entry && entry.spec
      );

      if (requestedShopIds.size > 0 && !requestedShopIds.has(entryShopId)) {
        return false;
      }

      if (requestedKeys.size > 0 && !requestedKeys.has(entryKey)) {
        return false;
      }

      return true;
    });
  }

  function normalizeQuerySettingsPayload(source = {}) {
    const owner = store && typeof store.getOwner === 'function'
      ? store.getOwner()
      : null;
    const payload = source && typeof source === 'object' && !Array.isArray(source)
      ? source
      : {};

    return {
      version: QUERY_SETTINGS_VERSION,
      owner,
      updatedAt: normalizeText(payload.updatedAt) || nowIso(),
      pageDelayMinSeconds: normalizeDelaySecondsValue(
        payload.pageDelayMinSeconds,
        '\u968f\u673a\u5ef6\u65f6\u6700\u5c0f\u503c'
      ),
      pageDelayMaxSeconds: normalizeDelaySecondsValue(
        payload.pageDelayMaxSeconds,
        '\u968f\u673a\u5ef6\u65f6\u6700\u5927\u503c'
      )
    };
  }

  function buildSettingsBackfillFilters(filters, settings) {
    const sourceFilters = filters && typeof filters === 'object' ? filters : {};
    const sourceSettings = settings && typeof settings === 'object' ? settings : DEFAULT_QUERY_SETTINGS;
    const nextFilters = {
      ...sourceFilters
    };

    if (
      (nextFilters.pageDelayMinSeconds === '' || nextFilters.pageDelayMinSeconds === null || nextFilters.pageDelayMinSeconds === undefined)
      && sourceSettings.pageDelayMinSeconds !== ''
      && sourceSettings.pageDelayMinSeconds !== null
      && sourceSettings.pageDelayMinSeconds !== undefined
    ) {
      nextFilters.pageDelayMinSeconds = sourceSettings.pageDelayMinSeconds;
    }

    if (
      (nextFilters.pageDelayMaxSeconds === '' || nextFilters.pageDelayMaxSeconds === null || nextFilters.pageDelayMaxSeconds === undefined)
      && sourceSettings.pageDelayMaxSeconds !== ''
      && sourceSettings.pageDelayMaxSeconds !== null
      && sourceSettings.pageDelayMaxSeconds !== undefined
    ) {
      nextFilters.pageDelayMaxSeconds = sourceSettings.pageDelayMaxSeconds;
    }

    return nextFilters;
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
        filters.stationIds || (filters.station ? [filters.station] : [])
      ),
      productSource: normalizeProductSourceValue(
        filters.productSource,
        filters.trafficStates
      ),
      adStation: normalizeText(filters.adStation),
      adLevels: normalizeSelectedAdLevels(filters.adLevels),
      categorySelections: normalizeCategorySelections(filters.categorySelections),
      productName: normalizeText(filters.productName),
      productIdType: normalizeText(filters.productIdType) || 'spu',
      productIdKeywords: normalizeText(filters.productIdKeywords),
      goodsNoType: normalizeText(filters.goodsNoType) || 'sku',
      goodsNoKeywords: normalizeText(filters.goodsNoKeywords),
      timeField: normalizeText(filters.timeField) || 'createdAt',
      startTime: normalizeText(filters.startTime),
      endTime: normalizeText(filters.endTime),
      deletedState: normalizeText(filters.deletedState),
      trafficStates: normalizeSelectedTrafficStates(filters.trafficStates),
      pageDelayMinSeconds: normalizeDelaySecondsValue(
        filters.pageDelayMinSeconds,
        '\u968f\u673a\u5ef6\u65f6\u6700\u5c0f\u503c'
      ),
      pageDelayMaxSeconds: normalizeDelaySecondsValue(
        filters.pageDelayMaxSeconds,
        '\u968f\u673a\u5ef6\u65f6\u6700\u5927\u503c'
      )
    };
  }

  function resolveRandomPageDelayRange(filters) {
    const normalizedFilters = normalizeFilters(filters);
    const hasMinValue = Number.isFinite(normalizedFilters.pageDelayMinSeconds);
    const hasMaxValue = Number.isFinite(normalizedFilters.pageDelayMaxSeconds);

    if (!hasMinValue && !hasMaxValue) {
      return null;
    }

    const fallbackValue = hasMinValue
      ? normalizedFilters.pageDelayMinSeconds
      : normalizedFilters.pageDelayMaxSeconds;
    const minSeconds = hasMinValue
      ? normalizedFilters.pageDelayMinSeconds
      : fallbackValue;
    const maxSeconds = hasMaxValue
      ? normalizedFilters.pageDelayMaxSeconds
      : fallbackValue;

    return {
      minSeconds: Math.min(minSeconds, maxSeconds),
      maxSeconds: Math.max(minSeconds, maxSeconds)
    };
  }

  function buildRandomPageDelayMs(filters) {
    const delayRange = resolveRandomPageDelayRange(filters);

    if (!delayRange) {
      return 0;
    }

    if (delayRange.maxSeconds <= delayRange.minSeconds) {
      return Math.max(0, Math.round(delayRange.minSeconds * 1000));
    }

    const randomSeconds =
      delayRange.minSeconds + (Math.random() * (delayRange.maxSeconds - delayRange.minSeconds));

    return Math.max(0, Math.round(randomSeconds * 1000));
  }

  function clonePayloadValue(value) {
    if (Array.isArray(value)) {
      return value.slice();
    }

    return value;
  }

  function buildProductSourcePayload(productSource) {
    const sourceKey = normalizeText(productSource) || 'all';
    const sourcePayload = PRODUCT_SOURCE_PAYLOADS[sourceKey] || PRODUCT_SOURCE_PAYLOADS.all;
    const nextPayload = {};

    Object.keys(sourcePayload).forEach((fieldName) => {
      nextPayload[fieldName] = clonePayloadValue(sourcePayload[fieldName]);
    });

    return nextPayload;
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

  function buildQueryRequestPayload(filters, pageNum) {
    const normalizedFilters = normalizeFilters(filters);
    const payload = {
      pageSize: DEFAULT_PAGE_SIZE,
      pageNum: Math.max(1, normalizeIntegerValue(pageNum, 1))
    };
    const leafCatIdList = buildSmallestSelectedCategoryIdList(
      normalizedFilters.categorySelections
    );
    const siteIdList = normalizedFilters.stationIds
      .map((stationId) => Number.parseInt(stationId, 10))
      .filter((stationId) => Number.isFinite(stationId));
    const adLvlList = normalizeSelectedAdLevels(normalizedFilters.adLevels);
    const adSite = Number.parseInt(normalizedFilters.adStation, 10);
    const productIdFieldName = PRODUCT_ID_FIELD_BY_TYPE[normalizedFilters.productIdType] || PRODUCT_ID_FIELD_BY_TYPE.spu;
    const productIdList = parseIntegerKeywordList(
      normalizedFilters.productIdKeywords,
      '\u5546\u54c1ID'
    );
    const goodsNoFieldName = GOODS_NO_FIELD_BY_TYPE[normalizedFilters.goodsNoType] || GOODS_NO_FIELD_BY_TYPE.sku;
    const goodsNoList = parseKeywordList(normalizedFilters.goodsNoKeywords);
    const timeBegin = parseDateTimestamp(normalizedFilters.startTime);
    const timeEnd = parseDateTimestamp(normalizedFilters.endTime, {
      endOfDay: true
    });
    const timeType = TIME_TYPE_BY_FIELD[normalizedFilters.timeField];
    const limitStatusList = [];

    if (leafCatIdList.length > 0) {
      payload.leafCatIdList = Array.from(new Set(leafCatIdList));
    }

    if (siteIdList.length > 0) {
      payload.siteIdList = Array.from(new Set(siteIdList));
    }

    if (adLvlList.length > 0) {
      if (!Number.isFinite(adSite)) {
        throw new Error('\u9009\u62e9\u5e7f\u544a\u7b49\u7ea7\u65f6\uff0c\u5fc5\u987b\u5148\u9009\u62e9\u5bf9\u5e94\u7684\u5e7f\u544a\u7ad9\u70b9\u3002');
      }

      payload.adSite = adSite;
      payload.adLvlList = adLvlList;
    }

    if (normalizedFilters.productName) {
      payload.productNameKeyword = normalizedFilters.productName;
    }

    if (productIdList.length > 0) {
      payload[productIdFieldName] = productIdList;
    }

    if (goodsNoList.length > 0) {
      payload[goodsNoFieldName] = goodsNoList;
    }

    if (Number.isFinite(timeBegin) || Number.isFinite(timeEnd)) {
      if (!Number.isInteger(timeType)) {
        throw new Error('\u65f6\u95f4\u7c7b\u578b\u6620\u5c04\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u65f6\u95f4\u8303\u56f4\u5b57\u6bb5\u3002');
      }

      if (Number.isFinite(timeBegin) && Number.isFinite(timeEnd) && timeBegin > timeEnd) {
        throw new Error('\u5f00\u59cb\u65f6\u95f4\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\u65f6\u95f4\u3002');
      }

      payload.timeType = timeType;

      if (Number.isFinite(timeBegin)) {
        payload.timeBegin = timeBegin;
      }

      if (Number.isFinite(timeEnd)) {
        payload.timeEnd = timeEnd;
      }
    }

    if (normalizedFilters.deletedState === 'yes') {
      payload.removeStatus = 1;
    } else if (normalizedFilters.deletedState === 'no') {
      payload.removeStatus = 0;
    }

    if (normalizedFilters.trafficStates.includes('dropped')) {
      limitStatusList.push(2);
    }

    if (normalizedFilters.trafficStates.includes('willDrop')) {
      limitStatusList.push(1);
    }

    if (limitStatusList.length > 0) {
      payload.limitStatusList = limitStatusList;
    }

    return {
      ...payload,
      ...buildProductSourcePayload(normalizedFilters.productSource)
    };
  }

  function buildCostLookup(entries = []) {
    const lookup = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const costPrice = normalizePositiveDecimalValue(entry && entry.costPrice, 0);
      const primaryKey = buildCostPrimaryKey(entry);

      if (!primaryKey || costPrice <= 0) {
        return;
      }

      lookup.set(primaryKey, Number(costPrice.toFixed(2)));
    });

    return lookup;
  }

  async function buildSharedCostLookup(shopIds = []) {
    const normalizedShopIds = normalizeSelectedShopIds(shopIds);

    if (
      normalizedShopIds.length <= 0
      || !operationsSharedCostService
      || typeof operationsSharedCostService.getCostSnapshot !== 'function'
    ) {
      return new Map();
    }

    try {
      const snapshot = await operationsSharedCostService.getCostSnapshot({
        shopIds: normalizedShopIds
      });

      return buildCostLookup(snapshot && snapshot.entries);
    } catch (error) {
      logError('operations_new_product_lifecycle_cost_lookup_failed', error, {
        shopCount: normalizedShopIds.length
      });
      return new Map();
    }
  }

  function applySharedCostLookupToRows(rows, lookup) {
    if (!(lookup instanceof Map) || lookup.size <= 0) {
      return Array.isArray(rows) ? rows.slice() : [];
    }

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const costPrice = buildCostLookupCandidates(row)
        .map((candidateKey) => lookup.get(candidateKey))
        .find((candidateValue) => Number.isFinite(candidateValue) && candidateValue > 0);

      if (!Number.isFinite(costPrice) || costPrice <= 0) {
        return row;
      }

      return {
        ...row,
        costPrice: String(Number(costPrice.toFixed(2)))
      };
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
          platformShopId: normalizeText(shop && shop.platformShopId),
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
    const normalizedShopDescriptor =
      shopDescriptor && typeof shopDescriptor === 'object'
        ? shopDescriptor
        : {
          shopId: shopDescriptor
        };
    const normalizedShopId = normalizeText(
      normalizedShopDescriptor && normalizedShopDescriptor.shopId
    );
    const normalizedShopUpdatedAt = normalizeText(
      normalizedShopDescriptor && (
        normalizedShopDescriptor.updatedAt
        || normalizedShopDescriptor.shopUpdatedAt
      )
    );
    const normalizedPlatformShopId = normalizeText(
      normalizedShopDescriptor && normalizedShopDescriptor.platformShopId
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
        const sellerSession =
          sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object'
            ? {
              ...sessionContext.sellerSession
            }
            : {};
        const resolvedPlatformShopId = normalizeText(
          sessionContext.platformShopId
          || sessionContext.mallId
          || sellerSession.mallId
          || normalizedPlatformShopId
        );

        if (!normalizeText(sellerSession.mallId) && resolvedPlatformShopId) {
          sellerSession.mallId = resolvedPlatformShopId;
        }

        return {
          ...sessionContext,
          shopId: normalizedShopId,
          shopName: normalizeText(sessionContext.shopName) || normalizeText(normalizedShopDescriptor.shopName),
          platformShopId: resolvedPlatformShopId,
          partition: normalizeText(sessionContext.partition),
          sellerSession
        };
      }
    }

    if (!shopManagementService || typeof shopManagementService.getShopRuntimeProfile !== 'function') {
      throw new Error('\u5e97\u94fa\u4f1a\u8bdd\u73af\u5883\u672a\u5c31\u7eea\u3002');
    }

    const runtimeProfile = await shopManagementService.getShopRuntimeProfile({
      shopId: normalizedShopId
    });
    const runtimePlatformShopId = normalizeText(
      runtimeProfile && runtimeProfile.platformShopId
    ) || normalizedPlatformShopId;

    return {
      shopId: normalizedShopId,
      shopName: normalizeText(normalizedShopDescriptor.shopName) || normalizeText(runtimeProfile && runtimeProfile.shopName),
      platformShopId: runtimePlatformShopId,
      partition: buildShopPartition(runtimeProfile),
      sellerSession: {
        origin: DEFAULT_SELLER_ORIGIN,
        hostname: 'agentseller.temu.com',
        status: '',
        mallId: runtimePlatformShopId
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
    const queryJob = payload && payload.queryJob;
    const initialPlatformShopId = normalizeText(
      sessionContext
      && (
        sessionContext.platformShopId
        || sessionContext.mallId
        || (sessionContext.sellerSession && sessionContext.sellerSession.mallId)
      )
    );
    const normalizedSessionContext = {
      ...sessionContext,
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      platformShopId: initialPlatformShopId,
      partition: normalizeText(sessionContext && sessionContext.partition)
    };

    if (
      !controller
      || typeof controller.ensureBackgroundSellerCenterGlobalSession !== 'function'
      || !normalizedSessionContext.shopId
    ) {
      return normalizedSessionContext;
    }

    assertCancelableJobActive(queryJob);

    const warmupResult = await waitCancelableJobPromise(
      controller.ensureBackgroundSellerCenterGlobalSession({
        shopId: normalizedSessionContext.shopId,
        timeoutMs: payload && payload.timeoutMs
      }),
      queryJob
    );
    assertCancelableJobActive(queryJob);

    const warmedSessionContext =
      warmupResult && warmupResult.sessionContext && typeof warmupResult.sessionContext === 'object'
        ? warmupResult.sessionContext
        : normalizedSessionContext;
    const nextPlatformShopId = normalizeText(
      warmedSessionContext
      && (
        warmedSessionContext.platformShopId
        || warmedSessionContext.mallId
        || (
          warmedSessionContext.sellerSession
          && warmedSessionContext.sellerSession.mallId
        )
      )
    ) || normalizedSessionContext.platformShopId;
    const nextSellerSession =
      warmedSessionContext && warmedSessionContext.sellerSession && typeof warmedSessionContext.sellerSession === 'object'
        ? {
          ...(normalizedSessionContext.sellerSession || {}),
          ...warmedSessionContext.sellerSession
        }
        : (normalizedSessionContext.sellerSession || {});

    if (!normalizeText(nextSellerSession.mallId) && nextPlatformShopId) {
      nextSellerSession.mallId = nextPlatformShopId;
    }

    return {
      ...normalizedSessionContext,
      ...warmedSessionContext,
      shopId: normalizeText(warmedSessionContext && warmedSessionContext.shopId) || normalizedSessionContext.shopId,
      shopName: normalizeText(warmedSessionContext && warmedSessionContext.shopName) || normalizedSessionContext.shopName,
      platformShopId: nextPlatformShopId,
      partition: normalizeText(warmedSessionContext && warmedSessionContext.partition) || normalizedSessionContext.partition,
      sellerSession: nextSellerSession
    };
  }

  async function resolveMallIdFromCookie(sessionContext) {
    const origin = resolveSellerOrigin(sessionContext);
    const targetSession = resolveShopScopedCookieSession(
      sessionContext,
      `${origin}/`,
      '\u4e0a\u65b0\u751f\u547d\u5468\u671f Cookies \u8bfb\u53d6\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
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
      logError('operations_new_product_lifecycle_cookie_mallid_read_failed', error, {
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
        sessionContext.platformShopId
        || sessionContext.mallId
        || (
          sessionContext.sellerSession
          && sessionContext.sellerSession.mallId
        )
      )
    );

    if (directMallId) {
      if (sessionContext && typeof sessionContext === 'object') {
        sessionContext.platformShopId = directMallId;
      }

      if (sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object') {
        sessionContext.sellerSession.mallId = directMallId;
      }

      return directMallId;
    }

    const cookieMallId = await resolveMallIdFromCookie(sessionContext);

    if (cookieMallId) {
      if (sessionContext && typeof sessionContext === 'object') {
        sessionContext.platformShopId = cookieMallId;
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
    queryJob,
    timeoutMessage = '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
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

        const timeoutError = new Error(normalizeText(timeoutMessage) || '\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
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
      if (queryJob && queryJob.canceled === true && isQueryCanceledError(error)) {
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

  function createBatchAdjustCanceledError() {
    const error = new Error('\u6279\u91cf\u8c03\u4ef7\u5df2\u505c\u6b62');
    error.code = BATCH_ADJUST_SUBMIT_CANCELED_ERROR_CODE;
    return error;
  }

  function createBatchAdjustPreviewProgressPayload({
    context = {},
    runId,
    phase,
    currentIndex,
    totalRows,
    requestedDailyCount,
    requestedActivityCount,
    skippedRowCount,
    message
  } = {}) {
    const progressBase = context && typeof context.progressBase === 'object' ? context.progressBase : null;
    const fallbackDailyCount = progressBase && progressBase.requestedDailyCount;
    const fallbackActivityCount = progressBase && progressBase.requestedActivityCount;
    const fallbackSkippedCount = progressBase && progressBase.skippedRowCount;
    const normalizedFallbackDailyCount = Number.isFinite(fallbackDailyCount) ? fallbackDailyCount : 0;
    const normalizedFallbackActivityCount = Number.isFinite(fallbackActivityCount) ? fallbackActivityCount : 0;
    const normalizedFallbackSkippedCount = Number.isFinite(fallbackSkippedCount) ? fallbackSkippedCount : 0;

    return {
      taskType: normalizeText(context && context.progressTaskType) || 'batchAdjustPreview',
      runId: normalizeText(runId || (progressBase && progressBase.runId)),
      phase: normalizeText(phase) || 'preparing',
      totalShops: Math.max(0, normalizeIntegerValue(progressBase && progressBase.totalShops, 0)),
      completedShops: Math.max(0, normalizeIntegerValue(progressBase && progressBase.completedShops, 0)),
      failedShops: Math.max(0, normalizeIntegerValue(progressBase && progressBase.failedShops, 0)),
      requestedDailyCount: Math.max(0, normalizeIntegerValue(requestedDailyCount, normalizedFallbackDailyCount)),
      requestedActivityCount: Math.max(0, normalizeIntegerValue(requestedActivityCount, normalizedFallbackActivityCount)),
      skippedRowCount: Math.max(0, normalizeIntegerValue(skippedRowCount, normalizedFallbackSkippedCount)),
      currentShopId: normalizeText(context && context.currentShopId),
      currentShopName: normalizeText(context && context.currentShopName),
      currentChunkIndex: Math.max(0, normalizeIntegerValue(currentIndex, 0)),
      totalChunks: Math.max(0, normalizeIntegerValue(totalRows, 0)),
      message: normalizeText(message)
    };
  }

  function sleepBatchAdjust(delayMs, runHandle) {
    const normalizedDelayMs = Math.max(0, delayMs);

    if (normalizedDelayMs <= 0) {
      assertBatchAdjustRunActive(runHandle);
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

        if (runHandle && cancelDelay && runHandle.activeDelayCancels.has(cancelDelay)) {
          runHandle.activeDelayCancels.delete(cancelDelay);
        }

        callback();
      };

      cancelDelay = () => {
        finalize(() => {
          reject(createBatchAdjustCanceledError());
        });
      };

      if (runHandle) {
        runHandle.activeDelayCancels.add(cancelDelay);

        if (runHandle.canceled === true) {
          cancelDelay();
          return;
        }
      }

      timeoutId = setTimeout(() => {
        finalize(resolve);
      }, normalizedDelayMs);
    });
  }

  async function yieldBatchAdjustRun(runHandle) {
    assertBatchAdjustRunActive(runHandle);
    await sleepBatchAdjust(1, runHandle);
  }

  function createCancelableJobCanceledError(job) {
    const runId = normalizeText(job && job.runId);

    if (runId.startsWith('npl_query_')) {
      return createQueryCanceledError();
    }

    return createBatchAdjustCanceledError();
  }

  function assertCancelableJobActive(job) {
    if (!job) {
      return;
    }

    if (job.canceled === true) {
      throw createCancelableJobCanceledError(job);
    }
  }

  async function waitCancelableJobPromise(promise, job) {
    if (!job) {
      return promise;
    }

    assertCancelableJobActive(job);

    let settled = false;
    let cancelDelay = null;
    const cancelPromise = new Promise((_, reject) => {
      cancelDelay = () => {
        if (settled) {
          return;
        }

        settled = true;
        reject(createCancelableJobCanceledError(job));
      };

      job.activeDelayCancels.add(cancelDelay);

      if (job.canceled === true) {
        cancelDelay();
      }
    });

    try {
      return await Promise.race([
        promise,
        cancelPromise
      ]);
    } finally {
      settled = true;

      if (cancelDelay && job.activeDelayCancels.has(cancelDelay)) {
        job.activeDelayCancels.delete(cancelDelay);
      }
    }
  }

  async function reportBatchAdjustPreviewRowProgress({
    context,
    runHandle,
    progressEmitter,
    phase,
    currentIndex,
    totalRows,
    requestedDailyCount,
    requestedActivityCount,
    skippedRowCount,
    message
  } = {}) {
    if (runHandle) {
      await yieldBatchAdjustRun(runHandle);
    }

    emitBatchAdjustPreviewProgress(
      createBatchAdjustPreviewProgressPayload({
        context,
        runId: context && context.runId,
        phase,
        currentIndex,
        totalRows,
        requestedDailyCount,
        requestedActivityCount,
        skippedRowCount,
        message
      }),
      progressEmitter
    );
  }

  async function withBatchAdjustTimeout(promise, timeoutMs, runHandle, timeoutMessage) {
    const normalizedTimeoutMs = Math.max(1000, normalizeIntegerValue(timeoutMs, 1000));
    let settled = false;
    let timeoutId = 0;
    let cancelDelay = null;

    assertBatchAdjustRunActive(runHandle);

    const timeoutPromise = new Promise((_, reject) => {
      cancelDelay = () => {
        if (settled) {
          return;
        }

        settled = true;
        reject(createBatchAdjustCanceledError());
      };

      if (runHandle) {
        runHandle.activeDelayCancels.add(cancelDelay);
      }

      timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error(normalizeText(timeoutMessage) || '\u6279\u91cf\u8c03\u4ef7\u5904\u7406\u8d85\u65f6'));
      }, normalizedTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (runHandle && cancelDelay && runHandle.activeDelayCancels.has(cancelDelay)) {
        runHandle.activeDelayCancels.delete(cancelDelay);
      }
    }
  }

  function buildBatchAdjustSubmitRequestDelayMs() {
    const minMs = Math.max(0, BATCH_ADJUST_SUBMIT_REQUEST_DELAY_MIN_MS);
    const maxMs = Math.max(minMs, BATCH_ADJUST_SUBMIT_REQUEST_DELAY_MAX_MS);

    if (maxMs <= minMs) {
      return minMs;
    }

    return Math.round(minMs + (Math.random() * (maxMs - minMs)));
  }

  async function executeJsonRequest(sessionContext, endpointPath, payload, options = {}) {
    assertQueryJobActive(options && options.queryJob);
    const origin = resolveSellerOrigin(sessionContext);
    const mallId = await ensureMallId(sessionContext);

    if (!mallId) {
      throw new Error('\u5f53\u524d\u5e97\u94fa\u672a\u83b7\u53d6\u5230Mallid\uff0c\u8bf7\u5148\u786e\u8ba4\u5e97\u94fa\u767b\u5f55\u72b6\u6001\u540e\u91cd\u8bd5\u3002');
    }

    const requestUrl = new URL(endpointPath, origin).toString();
    const targetSession = resolveShopScopedFetchSession(
      sessionContext,
      requestUrl,
      '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u63a5\u53e3\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );
    const response = await executeFetchWithTimeout(targetSession, requestUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json;charset=UTF-8',
        ...(mallId ? { Mallid: mallId } : {}),
        origin,
        pragma: 'no-cache',
        referer: `${origin}${normalizeText(options && options.refererPath) || '/newon/product-select'}`,
        'x-requested-with': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload || {}),
      cache: 'no-store',
      credentials: 'include'
    }, options && options.timeoutMs, options && options.queryJob, options && options.timeoutMessage);
    const responseText = await response.text();
    let parsedPayload = null;

    try {
      parsedPayload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      parsedPayload = null;
    }

    const responseTextPreview = truncateText(
      String(responseText || '').replace(/\s+/g, ' ').trim(),
      RESPONSE_TEXT_PREVIEW_LIMIT
    );

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
        message || normalizeText(options && options.defaultErrorMessage) || '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38\u3002'
      );

      error.httpStatus = Number(response && response.status) || 0;
      error.responseTextPreview = responseTextPreview;
      error.endpointPath = normalizeText(endpointPath);
      error.mallId = mallId;
      throw error;
    }

    return {
      payload: parsedPayload,
      mallId
    };
  }

  async function persistResolvedMallIdForShop(shopSummary, mallId) {
    const normalizedShopId = normalizeText(shopSummary && shopSummary.shopId);
    const normalizedMallId = normalizeText(mallId);

    if (
      !normalizedShopId
      || !normalizedMallId
      || !shopManagementService
      || typeof shopManagementService.updateResolvedPlatformShopId !== 'function'
    ) {
      return;
    }

    try {
      await shopManagementService.updateResolvedPlatformShopId({
        shopId: normalizedShopId,
        platformShopId: normalizedMallId
      });

      if (shopSummary && typeof shopSummary === 'object') {
        shopSummary.platformShopId = normalizedMallId;
      }
    } catch (error) {
      logError('operations_new_product_lifecycle_persist_mallid_failed', error, {
        shopId: normalizedShopId,
        mallId: normalizedMallId
      });
    }
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

    if (response.payload && typeof response.payload.result === 'object') {
      return response.payload.result;
    }

    return {};
  }

  function buildBatchAdjustSubmitRunId(value) {
    const normalizedValue = normalizeText(value);
    return normalizedValue || `npl_batch_adjust_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  }

  function normalizeMoneyCentValue(value) {
    if (value === '' || value === null || value === undefined) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.max(0, Math.round(numericValue));
  }

  function toSafeIntegerIdValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return 0;
    }

    if (/^\d+$/.test(normalizedValue)) {
      const numericValue = Number.parseInt(normalizedValue, 10);

      if (Number.isSafeInteger(numericValue)) {
        return numericValue;
      }
    }

    return normalizedValue;
  }

  function normalizeBatchAdjustDailySubmitCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return null;
    }

    const oldSupplyPrice = normalizeMoneyCentValue(candidate.oldSupplyPrice);
    const targetSupplyPrice = normalizeMoneyCentValue(candidate.targetSupplyPrice);

    if (oldSupplyPrice <= 0 || targetSupplyPrice <= 0) {
      return null;
    }

    return {
      oldSupplyPrice,
      targetSupplyPrice,
      reductionAmount: 0
    };
  }

  function normalizeBatchAdjustActivitySubmitCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return null;
    }

    const oldSupplyPrice = normalizeMoneyCentValue(candidate.oldSupplyPrice);
    const targetSupplyPrice = normalizeMoneyCentValue(candidate.targetSupplyPrice);
    const reductionAmount = normalizeMoneyCentValue(
      candidate.reductionAmount || candidate.reduceAmount
    );

    if (reductionAmount <= 0 && targetSupplyPrice <= 0) {
      return null;
    }

    return {
      oldSupplyPrice,
      targetSupplyPrice,
      reductionAmount
    };
  }

  function normalizeBatchAdjustSubmitRow(row) {
    const input = row && typeof row === 'object' && !Array.isArray(row)
      ? row
      : {};
    const rowId = normalizeText(input.rowId || input.id)
      || [
        normalizeText(input.shopId),
        normalizeText(input.productId),
        normalizeText(input.productSkcId || input.skcId),
        normalizeText(input.skuId)
      ].filter(Boolean).join(':');

    return {
      rowId,
      shopId: normalizeText(input.shopId),
      shopName: normalizeText(input.shopName),
      productId: normalizeText(input.productId),
      productSkcId: normalizeText(input.productSkcId || input.skcId),
      skuId: normalizeText(input.skuId),
      supplierId: normalizeText(input.supplierId),
      siteId: normalizeText(input.siteId || input.station),
      productName: normalizeText(input.productName || input.productTitle),
      spec: normalizeText(input.spec),
      costPrice: normalizeMoneyCentValue(input.costPrice),
      declaredPrice: normalizeMoneyCentValue(input.declaredPrice),
      suggestedDeclaredPrice: normalizeMoneyCentValue(input.suggestedDeclaredPrice),
      suggestedActivityDeclaredPrice: normalizeMoneyCentValue(input.suggestedActivityDeclaredPrice),
      dailySubmitCount: Math.max(0, normalizeIntegerValue(input.dailySubmitCount, 0)),
      activitySubmitCount: Math.max(0, normalizeIntegerValue(input.activitySubmitCount, 0)),
      dailyLastSubmittedAt: normalizeTimestamp(input.dailyLastSubmittedAt),
      activityLastSubmittedAt: normalizeTimestamp(input.activityLastSubmittedAt),
      oldPriceCurrency: normalizeText(
        input.oldPriceCurrency
        || input.priceCurrency
        || input.currency
      ) || 'CNY',
      targetPriceCurrency: normalizeText(
        input.targetPriceCurrency
        || input.oldPriceCurrency
        || input.priceCurrency
        || input.currency
      ) || 'CNY',
      dailyCandidate: normalizeBatchAdjustDailySubmitCandidate(input.dailyCandidate),
      activityCandidate: normalizeBatchAdjustActivitySubmitCandidate(input.activityCandidate),
      localSkipReasons: Array.from(new Set(
        (Array.isArray(input.localSkipReasons) ? input.localSkipReasons : [])
          .map((reasonKey) => normalizeText(reasonKey))
          .filter(Boolean)
      ))
    };
  }

  function resolveBatchAdjustScopedProfitFloorSettings(settings, scope) {
    const normalizedScope = normalizeText(scope) === 'activity' ? 'activity' : 'daily';
    const modeKey = normalizedScope === 'activity'
      ? 'activityProfitFloorMode'
      : 'dailyProfitFloorMode';
    const valueKey = normalizedScope === 'activity'
      ? 'activityProfitFloorValue'
      : 'dailyProfitFloorValue';

    return {
      mode: normalizeBatchAdjustProfitFloorMode(settings && settings[modeKey]),
      value: normalizePositiveDecimalValue(settings && settings[valueKey], 0)
    };
  }

  function isBatchAdjustProfitFloorViolated(targetSupplyPrice, costPrice, profitFloor) {
    const normalizedTargetSupplyPrice = normalizeMoneyCentValue(targetSupplyPrice);
    const normalizedCostPrice = normalizeMoneyCentValue(costPrice);
    const normalizedFloor = profitFloor && typeof profitFloor === 'object'
      ? profitFloor
      : {};
    const floorMode = normalizeBatchAdjustProfitFloorMode(normalizedFloor.mode);
    const floorValue = normalizePositiveDecimalValue(normalizedFloor.value, 0);

    if (
      normalizedTargetSupplyPrice <= 0
      || normalizedCostPrice <= 0
      || !(Number.isFinite(floorValue) && floorValue > 0)
    ) {
      return false;
    }

    if (floorMode === 'value') {
      const profitValueCent = normalizedTargetSupplyPrice - normalizedCostPrice;
      return profitValueCent + 0.0001 < Math.round(floorValue * 100);
    }

    const profitRate = computeProfitRateByPrice(
      normalizedTargetSupplyPrice,
      normalizedCostPrice
    );
    return Number.isFinite(profitRate) && profitRate + 0.0001 < floorValue;
  }

  function normalizeBatchAdjustSubmitPayload(payload = {}) {
    const input = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
    const normalizedSettings = normalizeBatchAdjustPresetSettings(input.settings);

    return {
      runId: buildBatchAdjustSubmitRunId(input.runId),
      previewRequestToken: normalizeText(input.previewRequestToken),
      settings: normalizedSettings,
      rows: (Array.isArray(input.rows) ? input.rows : [])
        .map((row) => {
          const normalizedRow = normalizeBatchAdjustSubmitRow(row);

          if (!normalizedRow) {
            return null;
          }

          return {
            ...normalizedRow,
            dailyCandidate: normalizedSettings.dailyEnabled ? normalizedRow.dailyCandidate : null,
            activityCandidate: normalizedSettings.activityEnabled ? normalizedRow.activityCandidate : null
          };
        })
        .filter((row) => row && row.rowId && row.shopId)
    };
  }

  function recordBatchAdjustSkipReason(reasonRowIdMap, reasonKey, rowId) {
    const normalizedReasonKey = normalizeText(reasonKey);
    const normalizedRowId = normalizeText(rowId);

    if (!normalizedReasonKey || !normalizedRowId) {
      return;
    }

    if (!reasonRowIdMap.has(normalizedReasonKey)) {
      reasonRowIdMap.set(normalizedReasonKey, new Set());
    }

    reasonRowIdMap.get(normalizedReasonKey).add(normalizedRowId);
  }

  function recordBatchAdjustSkipReasons(reasonRowIdMap, rowId, reasonKeys) {
    Array.from(new Set(
      (Array.isArray(reasonKeys) ? reasonKeys : [])
        .map((reasonKey) => normalizeText(reasonKey))
        .filter(Boolean)
    )).forEach((reasonKey) => {
      recordBatchAdjustSkipReason(reasonRowIdMap, reasonKey, rowId);
    });
  }

  function buildBatchAdjustSkipReasonCounts(reasonRowIdMap) {
    const counts = {};

    reasonRowIdMap.forEach((rowIdSet, reasonKey) => {
      counts[reasonKey] = rowIdSet instanceof Set ? rowIdSet.size : 0;
    });

    return counts;
  }

  function countBatchAdjustSkippedRows(reasonRowIdMap) {
    const rowIdSet = new Set();

    reasonRowIdMap.forEach((candidateRowIds) => {
      if (!(candidateRowIds instanceof Set)) {
        return;
      }

      candidateRowIds.forEach((rowId) => {
        const normalizedRowId = normalizeText(rowId);

        if (normalizedRowId) {
          rowIdSet.add(normalizedRowId);
        }
      });
    });

    return rowIdSet.size;
  }

  function countBatchAdjustEligibleCandidates(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((summary, row) => {
      if (row && row.dailyCandidate) {
        summary.localDailyEligibleCount += 1;
      }

      if (row && row.activityCandidate) {
        summary.localActivityEligibleCount += 1;
      }

      return summary;
    }, {
      localDailyEligibleCount: 0,
      localActivityEligibleCount: 0
    });
  }

  function buildBatchAdjustPreparedRequestKey(shopId, submitKind) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedSubmitKind = normalizeText(submitKind) === 'activity'
      ? 'activity'
      : 'daily';

    if (!normalizedShopId) {
      return '';
    }

    return `${normalizedShopId}::${normalizedSubmitKind}`;
  }

  function countBatchAdjustPreparedGroupLineCount(adjustGroups = []) {
    return (Array.isArray(adjustGroups) ? adjustGroups : []).reduce((total, groupEntry) => {
      return total + (
        Array.isArray(groupEntry && groupEntry.lineMetas)
          ? groupEntry.lineMetas.length
          : 0
      );
    }, 0);
  }

  function buildBatchAdjustPreparedRequest(shopId, shopName, submitKind, adjustGroups) {
    const normalizedSubmitKind = normalizeText(submitKind) === 'activity'
      ? 'activity'
      : 'daily';
    const normalizedAdjustGroups = finalizeBatchAdjustGroupEntries(adjustGroups);
    const requestKey = buildBatchAdjustPreparedRequestKey(shopId, normalizedSubmitKind);

    if (!requestKey || normalizedAdjustGroups.length <= 0) {
      return null;
    }

    return {
      requestKey,
      shopId: normalizeText(shopId),
      shopName: normalizeText(shopName) || normalizeText(shopId),
      submitKind: normalizedSubmitKind,
      requestedCount: countBatchAdjustPreparedGroupLineCount(normalizedAdjustGroups),
      groupCount: normalizedAdjustGroups.length,
      adjustGroups: normalizedAdjustGroups.map((groupEntry) => ({
        ...groupEntry,
        lineMetas: (Array.isArray(groupEntry && groupEntry.lineMetas) ? groupEntry.lineMetas : []).map((lineMeta) => ({
          rowId: normalizeText(lineMeta && lineMeta.rowId),
          kind: normalizeText(lineMeta && lineMeta.kind) === 'activity' ? 'activity' : 'daily',
          targetSupplyPrice: normalizeMoneyCentValue(lineMeta && lineMeta.targetSupplyPrice),
          priceSource: normalizeText(lineMeta && lineMeta.priceSource),
          submitCount: Math.max(0, normalizeIntegerValue(lineMeta && lineMeta.submitCount, 0)),
          historyRecord: lineMeta && lineMeta.historyRecord
            ? normalizeBatchAdjustPendingHistoryRecord(
              lineMeta.historyRecord,
              normalizedSubmitKind
            )
            : null
        }))
      }))
    };
  }

  function estimateJsonPayloadBytes(payload) {
    try {
      return Buffer.byteLength(JSON.stringify(payload), 'utf8');
    } catch (_error) {
      return -1;
    }
  }

  function pruneBatchAdjustPreviewRequestCache(now = Date.now()) {
    Array.from(batchAdjustPreviewRequestCacheByRunId.entries()).forEach(([cacheRunId, cacheEntry]) => {
      const expiresAt = Number(cacheEntry && cacheEntry.expiresAt) || 0;

      if (expiresAt > 0 && expiresAt <= now) {
        batchAdjustPreviewRequestCacheByRunId.delete(cacheRunId);
      }
    });
  }

  function storeBatchAdjustPreviewPreparedRequests(runId, groupedRequests, summary = {}) {
    const normalizedRunId = normalizeText(runId);
    const normalizedGroupedRequests = Array.isArray(groupedRequests)
      ? groupedRequests
      : [];

    if (!normalizedRunId || normalizedGroupedRequests.length <= 0) {
      return '';
    }

    pruneBatchAdjustPreviewRequestCache();
    batchAdjustPreviewRequestCacheByRunId.set(normalizedRunId, {
      runId: normalizedRunId,
      groupedRequests: normalizedGroupedRequests,
      storedAt: Date.now(),
      expiresAt: Date.now() + BATCH_ADJUST_PREVIEW_REQUEST_CACHE_TTL_MS,
      summary: summary && typeof summary === 'object' && !Array.isArray(summary)
        ? { ...summary }
        : {}
    });
    return normalizedRunId;
  }

  function getBatchAdjustPreviewPreparedRequests(runId) {
    const normalizedRunId = normalizeText(runId);

    if (!normalizedRunId) {
      return [];
    }

    pruneBatchAdjustPreviewRequestCache();
    const cacheEntry = batchAdjustPreviewRequestCacheByRunId.get(normalizedRunId);

    if (!cacheEntry) {
      return [];
    }

    return Array.isArray(cacheEntry.groupedRequests)
      ? cacheEntry.groupedRequests
      : [];
  }

  function clearBatchAdjustPreviewPreparedRequests(runId) {
    const normalizedRunId = normalizeText(runId);

    if (!normalizedRunId) {
      return false;
    }

    return batchAdjustPreviewRequestCacheByRunId.delete(normalizedRunId);
  }

  function summarizeBatchAdjustPreparedRequestsForRenderer(groupedRequests) {
    return (Array.isArray(groupedRequests) ? groupedRequests : []).map((request) => ({
      requestKey: normalizeText(request && request.requestKey),
      shopId: normalizeText(request && request.shopId),
      shopName: normalizeText(request && request.shopName),
      submitKind: normalizeText(request && request.submitKind) === 'activity'
        ? 'activity'
        : 'daily',
      requestedCount: Math.max(0, normalizeIntegerValue(request && request.requestedCount, 0)),
      groupCount: Math.max(0, normalizeIntegerValue(request && request.groupCount, 0))
    })).filter((request) => request.requestKey && request.shopId);
  }

  function normalizeBatchAdjustPreparedGroupEntry(groupEntry) {
    const input = groupEntry && typeof groupEntry === 'object' && !Array.isArray(groupEntry)
      ? groupEntry
      : {};
    const adjustItemInput = input.adjustItem && typeof input.adjustItem === 'object' && !Array.isArray(input.adjustItem)
      ? input.adjustItem
      : {};
    const skuAdjustList = (Array.isArray(adjustItemInput.skuAdjustList) ? adjustItemInput.skuAdjustList : [])
      .map((skuAdjustItem) => {
        const normalizedSkuId = toSafeIntegerIdValue(skuAdjustItem && skuAdjustItem.skuId);
        const normalizedSiteId = toSafeIntegerIdValue(skuAdjustItem && skuAdjustItem.siteId);
        const normalizedOldSupplyPrice = normalizeMoneyCentValue(skuAdjustItem && skuAdjustItem.oldSupplyPrice);
        const normalizedTargetSupplyPrice = normalizeMoneyCentValue(skuAdjustItem && skuAdjustItem.targetSupplyPrice);
        const normalizedActivityInvitationId = toSafeIntegerIdValue(
          skuAdjustItem && skuAdjustItem.activityInvitationId
        );

        if (
          normalizedSkuId <= 0
          || normalizedSiteId <= 0
          || normalizedOldSupplyPrice <= 0
          || normalizedTargetSupplyPrice <= 0
        ) {
          return null;
        }

        return {
          targetPriceCurrency: normalizeText(skuAdjustItem && skuAdjustItem.targetPriceCurrency) || 'CNY',
          oldPriceCurrency: normalizeText(skuAdjustItem && skuAdjustItem.oldPriceCurrency) || 'CNY',
          oldSupplyPrice: normalizedOldSupplyPrice,
          skuId: normalizedSkuId,
          targetSupplyPrice: normalizedTargetSupplyPrice,
          syncPurchasePrice: Number(skuAdjustItem && skuAdjustItem.syncPurchasePrice) === 1 ? 1 : 0,
          siteId: normalizedSiteId,
          ...(normalizedActivityInvitationId > 0
            ? { activityInvitationId: normalizedActivityInvitationId }
            : {})
        };
      })
      .filter(Boolean);
    const lineMetas = (Array.isArray(input.lineMetas) ? input.lineMetas : [])
      .map((lineMeta) => {
        const normalizedKind = normalizeText(lineMeta && lineMeta.kind) === 'activity'
          ? 'activity'
          : 'daily';
        const normalizedHistoryRecord = normalizeBatchAdjustPendingHistoryRecord(
          lineMeta && lineMeta.historyRecord,
          normalizedKind
        );
        const rowId = normalizeText(lineMeta && lineMeta.rowId);

        if (!rowId) {
          return null;
        }

        return {
          rowId,
          kind: normalizedKind,
          targetSupplyPrice: normalizeMoneyCentValue(lineMeta && lineMeta.targetSupplyPrice),
          historyRecord: normalizedHistoryRecord
        };
      })
      .filter(Boolean);
    const productId = toSafeIntegerIdValue(adjustItemInput.productId);
    const productSkcId = toSafeIntegerIdValue(adjustItemInput.productSkcId);
    const supplierId = toSafeIntegerIdValue(adjustItemInput.supplierId);

    if (
      productId <= 0
      || productSkcId <= 0
      || supplierId <= 0
      || skuAdjustList.length <= 0
      || lineMetas.length <= 0
    ) {
      return null;
    }

    return {
      adjustItem: {
        productName: normalizeText(adjustItemInput.productName),
        productSkcId,
        skuAdjustList,
        productId,
        supplierId
      },
      lineMetas
    };
  }

  function normalizeBatchAdjustPreparedRequests(itemRequests = []) {
    return (Array.isArray(itemRequests) ? itemRequests : [])
      .map((request) => {
        const normalizedSubmitKind = normalizeText(request && request.submitKind) === 'activity'
          ? 'activity'
          : 'daily';
        const normalizedShopId = normalizeText(request && request.shopId);
        const normalizedAdjustGroups = (Array.isArray(request && request.adjustGroups) ? request.adjustGroups : [])
          .map((groupEntry) => normalizeBatchAdjustPreparedGroupEntry(groupEntry))
          .filter(Boolean);
        const requestKey = buildBatchAdjustPreparedRequestKey(
          normalizedShopId,
          normalizedSubmitKind
        );

        if (!requestKey || normalizedAdjustGroups.length <= 0) {
          return null;
        }

        return {
          requestKey,
          shopId: normalizedShopId,
          shopName: normalizeText(request && request.shopName) || normalizedShopId,
          submitKind: normalizedSubmitKind,
          requestedCount: countBatchAdjustPreparedGroupLineCount(normalizedAdjustGroups),
          groupCount: normalizedAdjustGroups.length,
          adjustGroups: normalizedAdjustGroups
        };
      })
      .filter(Boolean);
  }

  function buildBatchAdjustRowReasonMap(reasonRowIdMap) {
    const rowReasonMap = new Map();

    reasonRowIdMap.forEach((rowIdSet, reasonKey) => {
      if (!(rowIdSet instanceof Set)) {
        return;
      }

      rowIdSet.forEach((rowId) => {
        const normalizedRowId = normalizeText(rowId);
        const normalizedReasonKey = normalizeText(reasonKey);

        if (!normalizedRowId || !normalizedReasonKey) {
          return;
        }

        if (!rowReasonMap.has(normalizedRowId)) {
          rowReasonMap.set(normalizedRowId, []);
        }

        rowReasonMap.get(normalizedRowId).push(normalizedReasonKey);
      });
    });

    return rowReasonMap;
  }

  function filterBatchAdjustReasonKeysByScope(reasonKeys, scope) {
    const normalizedScope = normalizeText(scope) === 'activity'
      ? 'activity'
      : 'daily';

    return Array.from(new Set(
      (Array.isArray(reasonKeys) ? reasonKeys : [])
        .map((reasonKey) => normalizeText(reasonKey))
        .filter(Boolean)
    )).filter((reasonKey) => {
      if (reasonKey.startsWith(`${normalizedScope}_`)) {
        return true;
      }

      if (BATCH_ADJUST_GENERIC_SCOPE_SKIP_REASON_KEYS.includes(reasonKey)) {
        return true;
      }

      if (
        normalizedScope === 'activity'
        && BATCH_ADJUST_ACTIVITY_SCOPE_SKIP_REASON_KEYS.includes(reasonKey)
      ) {
        return true;
      }

      return false;
    });
  }

  function mapBatchAdjustReasonKeysToLabels(reasonKeys) {
    return Array.from(new Set(
      (Array.isArray(reasonKeys) ? reasonKeys : [])
        .map((reasonKey) => normalizeText(BATCH_ADJUST_SKIP_REASON_LABELS[reasonKey]) || normalizeText(reasonKey))
        .filter(Boolean)
    ));
  }

  function buildBatchAdjustPreviewItem(row) {
    return {
      rowId: normalizeText(row && row.rowId),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      productId: normalizeText(row && row.productId),
      productSkcId: normalizeText(row && row.productSkcId),
      skuId: normalizeText(row && row.skuId),
      supplierId: normalizeText(row && row.supplierId),
      siteId: normalizeText(row && row.siteId),
      productName: normalizeText(row && row.productName),
      spec: normalizeText(row && row.spec),
      dailySubmitCount: Math.max(0, normalizeIntegerValue(row && row.dailySubmitCount, 0)),
      activitySubmitCount: Math.max(0, normalizeIntegerValue(row && row.activitySubmitCount, 0)),
      dailyReady: false,
      dailyRequestCount: 0,
      dailyTargetSupplyPrice: 0,
      dailyPriceSource: '',
      dailySkipReasonKeys: [],
      dailySkipReasonLabels: [],
      activityReady: false,
      activityRequestCount: 0,
      activityTargetSupplyPrice: 0,
      activityPriceSource: '',
      activitySkipReasonKeys: [],
      activitySkipReasonLabels: [],
      submitEligible: false
    };
  }

  function markBatchAdjustPreviewPreparedRows(previewItemMap, adjustGroups, submitKind) {
    const normalizedSubmitKind = normalizeText(submitKind) === 'activity'
      ? 'activity'
      : 'daily';

    (Array.isArray(adjustGroups) ? adjustGroups : []).forEach((groupEntry) => {
      (Array.isArray(groupEntry && groupEntry.lineMetas) ? groupEntry.lineMetas : []).forEach((lineMeta) => {
        const rowId = normalizeText(lineMeta && lineMeta.rowId);

        if (!rowId || !previewItemMap.has(rowId)) {
          return;
        }

        const previewItem = previewItemMap.get(rowId);

        if (normalizedSubmitKind === 'activity') {
          previewItem.activityReady = true;
          previewItem.activityRequestCount += 1;
          previewItem.activityTargetSupplyPrice = normalizeMoneyCentValue(
            lineMeta && lineMeta.targetSupplyPrice
          );
          previewItem.activityPriceSource = normalizeText(lineMeta && lineMeta.priceSource);
          previewItem.activitySubmitCount = Math.max(
            previewItem.activitySubmitCount,
            normalizeIntegerValue(lineMeta && lineMeta.submitCount, 0)
          );
        } else {
          previewItem.dailyReady = true;
          previewItem.dailyRequestCount += 1;
          previewItem.dailyTargetSupplyPrice = normalizeMoneyCentValue(
            lineMeta && lineMeta.targetSupplyPrice
          );
          previewItem.dailyPriceSource = normalizeText(lineMeta && lineMeta.priceSource);
          previewItem.dailySubmitCount = Math.max(
            previewItem.dailySubmitCount,
            normalizeIntegerValue(lineMeta && lineMeta.submitCount, 0)
          );
        }

        previewItem.submitEligible = previewItem.dailyReady || previewItem.activityReady;
      });
    });
  }

  function buildBatchAdjustDetailLookupKey(productId, skuId, siteId) {
    const normalizedProductId = normalizeText(productId);
    const normalizedSkuId = normalizeText(skuId);
    const normalizedSiteId = normalizeText(siteId);

    if (!normalizedProductId || !normalizedSkuId || !normalizedSiteId) {
      return '';
    }

    return `${normalizedProductId}\x1f${normalizedSkuId}\x1f${normalizedSiteId}`;
  }

  function buildBatchAdjustGroupKey(row) {
    return [
      normalizeText(row && row.productId),
      normalizeText(row && row.productSkcId),
      normalizeText(row && row.supplierId)
    ].filter(Boolean).join('\x1f');
  }

  function mergeBatchAdjustActivityDetailEntry(lookup, productId, productSkcId, item) {
    const skuId = normalizeText(
      item && (
        item.productSkuId
        || item.skuId
        || item.goodsSkuId
      )
    );
    const siteId = normalizeText(item && item.siteId);
    const lookupKey = buildBatchAdjustDetailLookupKey(productId, skuId, siteId);

    if (!lookupKey) {
      return;
    }

    const existingEntry = lookup.get(lookupKey);
    const nextEntry = {
      productId: normalizeText(productId),
      productSkcId: normalizeText(productSkcId),
      skuId,
      siteId,
      forbid: item && item.forbid === true,
      forbidMsg: normalizeText(item && item.forbidMsg),
      priceCurrency: normalizeText(item && item.priceCurrency) || 'CNY',
      targetPriceCurrency: normalizeText(item && item.targetPriceCurrency)
        || normalizeText(item && item.priceCurrency)
        || 'CNY',
      marketingActivities: (Array.isArray(item && item.marketingActivityPriceDTOList)
        ? item.marketingActivityPriceDTOList
        : []
      ).map((activity) => ({
        activityInvitationId: normalizeText(activity && activity.activityInvitationId),
        supplyPrice: normalizeMoneyCentValue(activity && activity.supplyPrice),
        activityInvitationName: normalizeText(activity && activity.activityInvitationName)
      })).filter((activity) => activity.activityInvitationId && activity.supplyPrice > 0)
    };

    if (
      existingEntry
      && existingEntry.forbid === false
      && nextEntry.forbid === true
    ) {
      return;
    }

    lookup.set(lookupKey, nextEntry);
  }

  function buildBatchAdjustActivityDetailLookup(resultPayload) {
    const lookup = new Map();
    const spuAdjustResult =
      resultPayload && resultPayload.spuAdjustResult && typeof resultPayload.spuAdjustResult === 'object'
        ? resultPayload.spuAdjustResult
        : {};

    Object.keys(spuAdjustResult).forEach((bucketKey) => {
      const bucket = spuAdjustResult[bucketKey];
      const productId = normalizeText(bucket && bucket.productId) || normalizeText(bucketKey);
      const skcItems = Array.isArray(bucket && bucket.skcItems)
        ? bucket.skcItems
        : [];
      const skuPriceList = Array.isArray(bucket && bucket.skuPriceList)
        ? bucket.skuPriceList
        : [];

      skcItems.forEach((skcItem) => {
        const productSkcId = normalizeText(skcItem && skcItem.productSkcId)
          || normalizeText(bucket && bucket.productSkcId);
        const detailItems = Array.isArray(skcItem && skcItem.items)
          ? skcItem.items
          : [];

        detailItems.forEach((detailItem) => {
          mergeBatchAdjustActivityDetailEntry(lookup, productId, productSkcId, detailItem);
        });
      });

      skuPriceList.forEach((detailItem) => {
        mergeBatchAdjustActivityDetailEntry(
          lookup,
          productId,
          normalizeText(bucket && bucket.productSkcId),
          detailItem
        );
      });
    });

    return lookup;
  }

  function chunkList(items, chunkSize) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedChunkSize = Math.max(1, normalizeIntegerValue(chunkSize, 1));
    const chunks = [];

    for (let startIndex = 0; startIndex < normalizedItems.length; startIndex += normalizedChunkSize) {
      chunks.push(normalizedItems.slice(startIndex, startIndex + normalizedChunkSize));
    }

    return chunks;
  }

  async function mapWithConcurrency(items, concurrency, worker) {
    const targetItems = Array.isArray(items) ? items : [];

    if (targetItems.length <= 0) {
      return [];
    }

    const workerCount = Math.max(
      1,
      Math.min(targetItems.length, normalizeIntegerValue(concurrency, 1) || 1)
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

  function normalizePriceDeclOrderIdList(orderIds) {
    const normalizedOrderIds = [];
    const seenOrderIds = new Set();

    (Array.isArray(orderIds) ? orderIds : []).forEach((orderId) => {
      const normalizedOrderId = Number(orderId) || 0;

      if (normalizedOrderId <= 0 || seenOrderIds.has(normalizedOrderId)) {
        return;
      }

      seenOrderIds.add(normalizedOrderId);
      normalizedOrderIds.push(normalizedOrderId);
    });

    return normalizedOrderIds;
  }

  async function queryPriceDeclReviewItemsByOrderIdChunks({
    sessionContext,
    orderIds,
    queryJob,
    timeoutMs = 30000,
    timeoutMessage = '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
    defaultErrorMessage = '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u5931\u8d25',
    refererPath = '/newon/product-select',
    allowPartial = false,
    maxRetries = 0,
    retryDelayMs = 0
  } = {}) {
    const normalizedOrderIds = normalizePriceDeclOrderIdList(orderIds);
    const requestChunks = chunkList(normalizedOrderIds, PRICE_DECL_QUERY_REQUEST_CHUNK_SIZE);
    const items = [];
    const failedChunks = [];
    let successChunkCount = 0;
    const normalizedMaxRetries = Math.max(0, normalizeIntegerValue(maxRetries, 0));
    const normalizedRetryDelayMs = Math.max(0, normalizeIntegerValue(retryDelayMs, 0));

    for (let chunkIndex = 0; chunkIndex < requestChunks.length; chunkIndex += 1) {
      const orderIdChunk = requestChunks[chunkIndex];
      let attemptCount = 0;
      let firstChunkErrorMessage = '';
      let lastChunkErrorMessage = '';
      let completed = false;

      while (completed !== true) {
        assertQueryJobActive(queryJob);
        attemptCount += 1;

        try {
          const queryResponse = await executeJsonRequest(
            sessionContext,
            PRICE_DECL_QUERY_ENDPOINT_PATH,
            { orderIds: orderIdChunk },
            {
              queryJob,
              timeoutMs,
              timeoutMessage,
              defaultErrorMessage,
              refererPath
            }
          );
          const chunkItems = queryResponse && queryResponse.payload && queryResponse.payload.result
            && Array.isArray(queryResponse.payload.result.priceReviewItemList)
            ? queryResponse.payload.result.priceReviewItemList
            : [];

          items.push(...chunkItems);
          successChunkCount += 1;
          completed = true;
        } catch (error) {
          if (isQueryCanceledError(error) || (queryJob && queryJob.canceled === true)) {
            throw error;
          }

          const chunkErrorMessage = normalizeText(error && error.message) || defaultErrorMessage;
          if (!firstChunkErrorMessage) {
            firstChunkErrorMessage = chunkErrorMessage;
          }
          lastChunkErrorMessage = chunkErrorMessage;

          if (attemptCount <= normalizedMaxRetries) {
            if (normalizedRetryDelayMs > 0) {
              await sleep(normalizedRetryDelayMs, queryJob);
            }
            continue;
          }

          failedChunks.push({
            chunkIndex: chunkIndex + 1,
            chunkSize: orderIdChunk.length,
            orderIds: orderIdChunk.slice(),
            attemptCount,
            retryCount: Math.max(0, attemptCount - 1),
            firstMessage: firstChunkErrorMessage,
            message: lastChunkErrorMessage || firstChunkErrorMessage || defaultErrorMessage
          });

          if (allowPartial !== true) {
            throw error;
          }

          completed = true;
        }
      }
    }

    return {
      items,
      totalChunks: requestChunks.length,
      successChunks: successChunkCount,
      failedChunks: failedChunks.length,
      failedChunkDetails: failedChunks
    };
  }

  function groupBatchAdjustRowsByShop(rows) {
    const groupMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const shopId = normalizeText(row && row.shopId);

      if (!shopId) {
        return;
      }

      if (!groupMap.has(shopId)) {
        groupMap.set(shopId, {
          shopId,
          shopName: normalizeText(row && row.shopName),
          rows: []
        });
      }

      groupMap.get(shopId).rows.push(row);
    });

    return Array.from(groupMap.values());
  }

  function findMatchingActivityInvitation(detailEntry, candidate) {
    const marketingActivities = Array.isArray(detailEntry && detailEntry.marketingActivities)
      ? detailEntry.marketingActivities
      : [];
    const targetOldSupplyPrice = normalizeMoneyCentValue(
      candidate && (
        candidate.oldSupplyPrice
        || candidate.expectedSupplyPrice
      )
    );

    if (marketingActivities.length <= 0) {
      return {
        activity: null,
        reasonKey: 'activity_invitation_empty',
        matchedBy: ''
      };
    }

    if (targetOldSupplyPrice > 0) {
      const exactMatchedActivity = marketingActivities.find((activity) => {
        return normalizeMoneyCentValue(activity && activity.supplyPrice) === targetOldSupplyPrice;
      }) || null;

      if (exactMatchedActivity) {
        return {
          activity: exactMatchedActivity,
          reasonKey: '',
          matchedBy: 'exact_supply_price'
        };
      }

      const closestActivityCandidate = marketingActivities
        .map((activity) => ({
          activity,
          distance: Math.abs(
            normalizeMoneyCentValue(activity && activity.supplyPrice) - targetOldSupplyPrice
          )
        }))
        .filter((item) => normalizeMoneyCentValue(item && item.activity && item.activity.supplyPrice) > 0)
        .sort((left, right) => left.distance - right.distance)[0];

      if (closestActivityCandidate && closestActivityCandidate.distance <= 100) {
        return {
          activity: closestActivityCandidate.activity,
          reasonKey: '',
          matchedBy: 'closest_supply_price'
        };
      }

      if (closestActivityCandidate) {
        return {
          activity: closestActivityCandidate.activity,
          reasonKey: '',
          matchedBy: 'closest_supply_price_relaxed'
        };
      }
    }

    if (marketingActivities.length === 1) {
      return {
        activity: marketingActivities[0],
        reasonKey: '',
        matchedBy: 'single_activity_fallback'
      };
    }

    return {
      activity: null,
      reasonKey: targetOldSupplyPrice > 0
        ? 'activity_invitation_price_mismatch'
        : 'activity_invitation_missing',
      matchedBy: ''
    };
  }

  function resolveDetailEntryMarketingActivities(detailEntry) {
    return (Array.isArray(detailEntry && detailEntry.marketingActivities)
      ? detailEntry.marketingActivities
      : []
    ).filter((activity) => {
      return normalizeText(activity && activity.activityInvitationId)
        && normalizeMoneyCentValue(activity && activity.supplyPrice) > 0;
    });
  }

  function pushBatchAdjustRowUpdate(rowUpdateMap, rowId, patch = {}) {
    const normalizedRowId = normalizeText(rowId);

    if (!normalizedRowId) {
      return;
    }

    const currentPatch = rowUpdateMap.get(normalizedRowId) || {
      rowId: normalizedRowId
    };

    rowUpdateMap.set(normalizedRowId, {
      ...currentPatch,
      ...patch
    });
  }

  function buildBatchAdjustSubmitCountRowPatch(historyRecord, historyPayload, submittedAt) {
    const normalizedHistoryRecord = historyRecord && typeof historyRecord === 'object'
      ? historyRecord
      : null;

    if (!normalizedHistoryRecord) {
      return {};
    }

    const nextRecord = normalizeBatchAdjustSubmitHistoryRecord({
      ...normalizedHistoryRecord,
      submittedAt,
      submitCount: Math.max(
        1,
        normalizeIntegerValue(
          getBatchAdjustSubmitHistoryRecord(
            historyPayload,
            normalizedHistoryRecord.kind,
            normalizedHistoryRecord.key
          ) && getBatchAdjustSubmitHistoryRecord(
            historyPayload,
            normalizedHistoryRecord.kind,
            normalizedHistoryRecord.key
          ).submitCount,
          0
        ) + 1
      )
    }, normalizedHistoryRecord.kind);

    if (!nextRecord) {
      return {};
    }

    return nextRecord.kind === 'activity'
      ? {
        activitySubmitCount: Math.max(1, normalizeIntegerValue(nextRecord.submitCount, 1)),
        activityLastSubmittedAt: normalizeText(nextRecord.submittedAt)
      }
      : {
        dailySubmitCount: Math.max(1, normalizeIntegerValue(nextRecord.submitCount, 1)),
        dailyLastSubmittedAt: normalizeText(nextRecord.submittedAt)
      };
  }

  function buildBatchAdjustWarning(skipReasonCounts, summary, failedShopMessages = []) {
    const warningParts = [];

    Object.keys(skipReasonCounts || {}).forEach((reasonKey) => {
      const count = Math.max(0, normalizeIntegerValue(skipReasonCounts[reasonKey], 0));
      const label = normalizeText(BATCH_ADJUST_SKIP_REASON_LABELS[reasonKey]) || reasonKey;

      if (count > 0) {
        warningParts.push(`\u5df2\u8df3\u8fc7 ${count} \u6761${label}\u8bb0\u5f55`);
      }
    });

    if (summary.failedDailyCount > 0 || summary.failedActivityCount > 0) {
      warningParts.push(
        `\u63d0\u4ea4\u5931\u8d25\uff1a\u65e5\u5e38 ${summary.failedDailyCount} \u6761\uff0c\u6d3b\u52a8 ${summary.failedActivityCount} \u6761`
      );
    }

    if (summary.failedShops > 0) {
      warningParts.push(`\u63d0\u4ea4\u5931\u8d25\u5e97\u94fa ${summary.failedShops} \u5bb6`);
    }

    if (failedShopMessages.length > 0) {
      warningParts.push(failedShopMessages.slice(0, 3).join('\uff1b'));
    }

    return warningParts.join('\uff1b');
  }

  function collectBatchAdjustGroupLineMetas(adjustGroups) {
    return (Array.isArray(adjustGroups) ? adjustGroups : []).reduce((result, groupEntry) => {
      return result.concat(Array.isArray(groupEntry && groupEntry.lineMetas) ? groupEntry.lineMetas : []);
    }, []);
  }

  function buildBatchAdjustSplitGroupEntry(groupEntry, startIndex, endIndex) {
    const adjustItem = groupEntry && groupEntry.adjustItem && typeof groupEntry.adjustItem === 'object'
      ? groupEntry.adjustItem
      : {};
    const skuAdjustList = Array.isArray(adjustItem && adjustItem.skuAdjustList)
      ? adjustItem.skuAdjustList
      : [];
    const lineMetas = Array.isArray(groupEntry && groupEntry.lineMetas)
      ? groupEntry.lineMetas
      : [];
    const nextSkuAdjustList = skuAdjustList.slice(startIndex, endIndex);
    const nextLineMetas = lineMetas.slice(startIndex, endIndex);

    if (nextSkuAdjustList.length <= 0 || nextLineMetas.length <= 0) {
      return null;
    }

    return {
      ...groupEntry,
      adjustItem: {
        ...adjustItem,
        skuAdjustList: nextSkuAdjustList
      },
      lineMetas: nextLineMetas
    };
  }

  function splitBatchAdjustSubmitGroupEntries(adjustGroups) {
    const groups = (Array.isArray(adjustGroups) ? adjustGroups : []).filter(Boolean);

    if (groups.length > 1) {
      const middleIndex = Math.ceil(groups.length / 2);

      return [
        groups.slice(0, middleIndex),
        groups.slice(middleIndex)
      ].filter((groupPart) => groupPart.length > 0);
    }

    const groupEntry = groups[0] || null;
    const adjustItem = groupEntry && groupEntry.adjustItem && typeof groupEntry.adjustItem === 'object'
      ? groupEntry.adjustItem
      : {};
    const skuAdjustList = Array.isArray(adjustItem && adjustItem.skuAdjustList)
      ? adjustItem.skuAdjustList
      : [];
    const lineMetas = Array.isArray(groupEntry && groupEntry.lineMetas)
      ? groupEntry.lineMetas
      : [];
    const splitLength = Math.min(skuAdjustList.length, lineMetas.length);

    if (splitLength <= 1) {
      return [];
    }

    const middleIndex = Math.ceil(splitLength / 2);
    const leftGroup = buildBatchAdjustSplitGroupEntry(groupEntry, 0, middleIndex);
    const rightGroup = buildBatchAdjustSplitGroupEntry(groupEntry, middleIndex, splitLength);

    return [
      leftGroup ? [leftGroup] : [],
      rightGroup ? [rightGroup] : []
    ].filter((groupPart) => groupPart.length > 0);
  }

  function shouldSplitBatchAdjustSubmitFailure(error) {
    if (isBatchAdjustCanceledError(error)) {
      return false;
    }

    if (error && error.timeout === true) {
      return false;
    }

    const message = normalizeText(error && error.message);
    const endpointPath = normalizeText(error && error.endpointPath);
    const httpStatus = Math.max(0, normalizeIntegerValue(error && error.httpStatus, 0));

    if (httpStatus === 429 || httpStatus >= 500) {
      return false;
    }

    if (
      /\bAuthorization\b|\bAUTH\b|\blogin\b|\brate\b|\bbusy\b/i.test(message)
      || message.includes('\u767b\u5f55')
      || message.includes('\u4f1a\u8bdd')
      || message.includes('\u672a\u767b\u5f55')
      || message.includes('\u8d85\u65f6')
      || message.includes('\u9891\u7e41')
      || message.includes('\u9650\u6d41')
      || message.includes('\u8fc7\u4e8e\u706b\u7206')
      || message.includes('\u706b\u7206')
      || message.includes('\u7cfb\u7edf\u7e41\u5fd9')
      || message.includes('\u7a0d\u540e')
    ) {
      return false;
    }

    return endpointPath === BATCH_ADJUST_SUBMIT_ENDPOINT_PATH || httpStatus > 0;
  }

  function buildBatchAdjustSubmitDebugInfo(adjustGroups) {
    const groups = Array.isArray(adjustGroups) ? adjustGroups : [];
    const productIds = [];
    const skuIds = [];

    groups.forEach((groupEntry) => {
      const adjustItem = groupEntry && groupEntry.adjustItem && typeof groupEntry.adjustItem === 'object'
        ? groupEntry.adjustItem
        : {};
      const productId = normalizeText(adjustItem && adjustItem.productId);

      if (productId && productIds.length < 5) {
        productIds.push(productId);
      }

      (Array.isArray(adjustItem && adjustItem.skuAdjustList) ? adjustItem.skuAdjustList : []).forEach((skuAdjustItem) => {
        const skuId = normalizeText(skuAdjustItem && skuAdjustItem.skuId);

        if (skuId && skuIds.length < 10) {
          skuIds.push(skuId);
        }
      });
    });

    return {
      groupCount: groups.length,
      lineCount: collectBatchAdjustGroupLineMetas(groups).length,
      productIds,
      skuIds
    };
  }

  function resolveSupplierPriceReviewInfo(skcRecord, skuRecord, skuIndex) {
    const reviewInfoList = Array.isArray(skcRecord && skcRecord.supplierPriceReviewInfoList)
      ? skcRecord.supplierPriceReviewInfoList
      : [];
    const skuListLength = Array.isArray(skcRecord && skcRecord.skuList)
      ? skcRecord.skuList.length
      : 0;
    const normalizedSkuId = normalizeText(
      skuRecord && (
        skuRecord.skuId
        || skuRecord.goodsSkuId
        || skuRecord.id
      )
    );
    const normalizedSkuCode = normalizeText(
      skuRecord && (
        skuRecord.extCode
        || skuRecord.skuCode
        || skuRecord.supplierSkuCode
      )
    );

    if (reviewInfoList.length <= 0) {
      return null;
    }

    const matchedReviewInfo = reviewInfoList.find((reviewInfo) => {
      const reviewSkuId = normalizeText(
        reviewInfo && (
          reviewInfo.skuId
          || reviewInfo.goodsSkuId
          || reviewInfo.supplierSkuId
          || reviewInfo.productSkuId
        )
      );
      const reviewSkuCode = normalizeText(
        reviewInfo && (
          reviewInfo.extCode
          || reviewInfo.skuCode
          || reviewInfo.supplierSkuCode
        )
      );

      if (normalizedSkuId && reviewSkuId && reviewSkuId === normalizedSkuId) {
        return true;
      }

      return normalizedSkuCode && reviewSkuCode && reviewSkuCode === normalizedSkuCode;
    });

    if (matchedReviewInfo) {
      return matchedReviewInfo;
    }

    if (reviewInfoList.length === 1) {
      return reviewInfoList[0];
    }

    if (skuListLength > 0 && reviewInfoList.length === skuListLength) {
      return reviewInfoList[skuIndex] || null;
    }

    return null;
  }

  function resolveDeclaredPriceValue(skuRecord, skcRecord, productRecord, reviewInfo) {
    const siteSupplierPrice = Array.isArray(skuRecord && skuRecord.siteSupplierPriceList)
      ? skuRecord.siteSupplierPriceList[0]
      : (Array.isArray(reviewInfo && reviewInfo.siteSupplierPriceList)
        ? reviewInfo.siteSupplierPriceList[0]
        : null);

    if (Number.isFinite(Number(siteSupplierPrice && siteSupplierPrice.supplierPriceValue))) {
      return Number(siteSupplierPrice.supplierPriceValue) / 100;
    }

    if (Number.isFinite(Number(skuRecord && skuRecord.supplierPriceValue))) {
      return Number(skuRecord.supplierPriceValue) / 100;
    }

    if (Number.isFinite(Number(reviewInfo && reviewInfo.supplierPriceValue))) {
      return Number(reviewInfo.supplierPriceValue) / 100;
    }

    return normalizeDecimalValue(
      siteSupplierPrice && siteSupplierPrice.supplierPrice,
      normalizeDecimalValue(
        skuRecord && skuRecord.supplierPrice,
        normalizeDecimalValue(
          reviewInfo && reviewInfo.supplierPrice,
          normalizeDecimalValue(
            skcRecord && skcRecord.supplierPrice,
            normalizeDecimalValue(productRecord && productRecord.supplierPrice, 0)
          )
        )
      )
    );
  }

  function collectSiteSupplierPriceCandidates(skuRecord, reviewInfo) {
    return []
      .concat(Array.isArray(skuRecord && skuRecord.siteSupplierPriceList) ? skuRecord.siteSupplierPriceList : [])
      .concat(Array.isArray(reviewInfo && reviewInfo.siteSupplierPriceList) ? reviewInfo.siteSupplierPriceList : []);
  }

  function resolveSuggestedDeclaredPriceValue(skuRecord, reviewInfo) {
    const siteSupplierPriceCandidates = collectSiteSupplierPriceCandidates(skuRecord, reviewInfo);

    const matchedCandidate = siteSupplierPriceCandidates.find((siteSupplierPrice) => (
      Number.isFinite(Number(siteSupplierPrice && siteSupplierPrice.targetSupplyPrice))
    ));

    if (matchedCandidate) {
      return Number(matchedCandidate.targetSupplyPrice) / 100;
    }

    return 0;
  }

  function resolveSuggestedActivityDeclaredPriceValue(skuRecord, reviewInfo) {
    const siteSupplierPriceCandidates = collectSiteSupplierPriceCandidates(skuRecord, reviewInfo);

    const matchedCandidate = siteSupplierPriceCandidates.find((siteSupplierPrice) => (
      Number.isFinite(Number(siteSupplierPrice && siteSupplierPrice.suggestActivitySupplierPrice))
    ));

    if (matchedCandidate) {
      return Number(matchedCandidate.suggestActivitySupplierPrice) / 100;
    }

    return 0;
  }

  function resolvePriceCurrencyInfo(skuRecord, reviewInfo) {
    const siteSupplierPriceCandidates = collectSiteSupplierPriceCandidates(skuRecord, reviewInfo);
    const priceCurrencyCandidate = siteSupplierPriceCandidates.find((candidate) => {
      return Boolean(normalizeText(
        candidate && (
          candidate.priceCurrency
          || candidate.oldPriceCurrency
          || candidate.supplierPriceCurrency
        )
      ));
    }) || null;
    const targetPriceCurrencyCandidate = siteSupplierPriceCandidates.find((candidate) => {
      return Boolean(normalizeText(candidate && candidate.targetPriceCurrency));
    }) || null;
    const priceCurrency = normalizeText(
      priceCurrencyCandidate && (
        priceCurrencyCandidate.priceCurrency
        || priceCurrencyCandidate.oldPriceCurrency
        || priceCurrencyCandidate.supplierPriceCurrency
      )
    ) || 'CNY';
    const targetPriceCurrency = normalizeText(
      targetPriceCurrencyCandidate && targetPriceCurrencyCandidate.targetPriceCurrency
    ) || priceCurrency || 'CNY';

    return {
      priceCurrency,
      targetPriceCurrency
    };
  }

  function resolveStationInfo(skuRecord, skcRecord, productRecord, reviewInfo) {
    const siteSupplierPrice = Array.isArray(skuRecord && skuRecord.siteSupplierPriceList)
      ? skuRecord.siteSupplierPriceList[0]
      : (Array.isArray(reviewInfo && reviewInfo.siteSupplierPriceList)
        ? reviewInfo.siteSupplierPriceList[0]
        : null);
    const siteInfo = Array.isArray(productRecord && productRecord.siteInfoList)
      ? productRecord.siteInfoList[0]
      : null;
    const siteId = normalizeText(
      siteSupplierPrice && siteSupplierPrice.siteId
    ) || normalizeText(
      reviewInfo && reviewInfo.siteId
    ) || normalizeText(
      siteInfo && siteInfo.siteId
    ) || normalizeText(
      Array.isArray(productRecord && productRecord.semiHostedBindSiteIds)
        ? productRecord.semiHostedBindSiteIds[0]
        : ''
    );
    const siteName = normalizeText(
      siteSupplierPrice && siteSupplierPrice.siteName
    ) || normalizeText(
      reviewInfo && reviewInfo.siteName
    ) || normalizeText(
      siteInfo && siteInfo.siteName
    ) || normalizeText(productRecord && productRecord.siteName);

    return {
      siteId,
      station: siteId || siteName,
      stationLabel: siteName || siteId
    };
  }

  function buildSpecDescriptor(skcRecord, skuRecord) {
    return buildSkuSpecDescriptor({
      skcRecord,
      skuRecord
    });
  }

  function mapRemoteStatus(selectStatus, priceReviewStatus) {
    const numericSelectStatus = normalizeIntegerValue(selectStatus, -1);
    const numericPriceReviewStatus = normalizeIntegerValue(priceReviewStatus, -1);

    if (numericSelectStatus === 7) {
      if (numericPriceReviewStatus === 0) {
        return 'pricePending';
      }

      if (numericPriceReviewStatus === 1) {
        return 'pricePendingSellerConfirm';
      }

      return 'pricePending';
    }

    if (numericSelectStatus === 9) {
      return 'priceInvalid';
    }

    if (numericSelectStatus === 10 || numericSelectStatus === 11) {
      return 'unpublished';
    }

    if (numericSelectStatus === 12) {
      return 'published';
    }

    if (numericSelectStatus === 13) {
      return 'offline';
    }

    if (numericSelectStatus === 17) {
      return 'terminated';
    }

    if (numericPriceReviewStatus === 0) {
      return 'pricePending';
    }

    if (numericPriceReviewStatus === 1) {
      return 'pricePendingSellerConfirm';
    }

    if (numericPriceReviewStatus >= 2 && numericPriceReviewStatus <= 3) {
      return 'pricePending';
    }

    return 'unpublished';
  }

  function createRowsFromSearchItem(productRecord, shopSummary) {
    const rows = [];
    const skcList = Array.isArray(productRecord && productRecord.skcList) ? productRecord.skcList : [];

    skcList.forEach((skcRecord, skcIndex) => {
      const skuList = Array.isArray(skcRecord && skcRecord.skuList) ? skcRecord.skuList : [];
      const productImageUrl = normalizeText(
        Array.isArray(productRecord && productRecord.carouselImageUrlList)
          ? productRecord.carouselImageUrlList[0]
          : ''
      ) || normalizeText(
        Array.isArray(skcRecord && skcRecord.previewImgUrlList)
          ? skcRecord.previewImgUrlList[0]
          : ''
      );
      const categoryPathLabels = Array.isArray(productRecord && productRecord.fullCategoryName)
        ? productRecord.fullCategoryName.map((item) => normalizeText(item)).filter(Boolean)
        : [];

      skuList.forEach((skuRecord, skuIndex) => {
        const reviewInfo = resolveSupplierPriceReviewInfo(skcRecord, skuRecord, skuIndex);
        const specDescriptor = buildSpecDescriptor(skcRecord, skuRecord);
        const selectStatus = normalizeText(skuRecord && skuRecord.selectStatus)
          || normalizeText(reviewInfo && reviewInfo.selectStatus)
          || normalizeText(skcRecord && skcRecord.selectStatus);
        const priceReviewStatus =
          skuRecord && skuRecord.priceReviewStatus !== undefined && skuRecord.priceReviewStatus !== null && skuRecord.priceReviewStatus !== ''
            ? skuRecord.priceReviewStatus
            : (reviewInfo && reviewInfo.priceReviewStatus);
        const stationInfo = resolveStationInfo(skuRecord, skcRecord, productRecord, reviewInfo);
        const currencyInfo = resolvePriceCurrencyInfo(skuRecord, reviewInfo);
        const skuId = normalizeText(
          skuRecord && (
            skuRecord.skuId
            || skuRecord.goodsSkuId
            || skuRecord.id
          )
        ) || `${normalizeText(shopSummary && shopSummary.shopId)}:${normalizeText(productRecord && productRecord.productId)}:${normalizeText(skcRecord && skcRecord.skcId) || `skc-${skcIndex + 1}`}:sku:${skuIndex + 1}`;
        const statusTime = skcRecord && skcRecord.statusTime && typeof skcRecord.statusTime === 'object'
          ? skcRecord.statusTime
          : {};

        rows.push({
          id: `${normalizeText(shopSummary && shopSummary.shopId)}:${skuId}`,
          shopId: normalizeText(shopSummary && shopSummary.shopId),
          shopName: normalizeText(shopSummary && shopSummary.shopName),
          shopGroupId: normalizeText(shopSummary && shopSummary.shopGroupId),
          shopGroupName: normalizeText(shopSummary && shopSummary.shopGroupName),
          productId: normalizeText(productRecord && productRecord.productId),
          productName: normalizeText(productRecord && productRecord.productName),
          productSkcId: normalizeText(skcRecord && (skcRecord.productSkcId || skcRecord.skcId)),
          skcId: normalizeText(skcRecord && skcRecord.skcId),
          skuId,
          supplierId: normalizeText(
            productRecord && (
              productRecord.supplierId
              || productRecord.supplier_id
              || productRecord.supplierMallId
            )
          ),
          skcCode: normalizeText(skcRecord && skcRecord.extCode),
          skuCode: normalizeText(skuRecord && skuRecord.extCode)
            || normalizeText(reviewInfo && (reviewInfo.extCode || reviewInfo.skuCode || reviewInfo.supplierSkuCode)),
          productTitle: normalizeText(productRecord && productRecord.productName),
          priceOrderId: normalizeText(reviewInfo && (
            reviewInfo.id
            || reviewInfo.priceOrderId
            || reviewInfo.bargainId
            || reviewInfo.reviewId
            || reviewInfo.bid
          )) || normalizeText(skcRecord && (
            skcRecord.priceOrderId
            || skcRecord.bargainId
          )) || normalizeText(productRecord && (
            productRecord.priceOrderId
            || productRecord.bargainId
          )),
          category: normalizeText(productRecord && productRecord.leafCategoryId),
          categoryLabel: normalizeText(productRecord && productRecord.leafCategoryName),
          categoryTrail: categoryPathLabels.join(' / '),
          categoryPathLabels,
          siteId: stationInfo.siteId,
          station: stationInfo.station,
          stationLabel: stationInfo.stationLabel,
          priceCurrency: currencyInfo.priceCurrency,
          targetPriceCurrency: currencyInfo.targetPriceCurrency,
          productImageUrl,
          skuImageUrl: normalizeText(skuRecord && skuRecord.skuPreviewImage) || productImageUrl,
          status: mapRemoteStatus(selectStatus, priceReviewStatus),
          selectStatus,
          priceReviewStatus: normalizeIntegerValue(priceReviewStatus, -1),
          spec: specDescriptor.spec,
          legacySpec: specDescriptor.legacySpec,
          specAliases: Array.isArray(specDescriptor.specAliases) ? specDescriptor.specAliases.slice() : [],
          declaredPrice: Number(resolveDeclaredPriceValue(skuRecord, skcRecord, productRecord, reviewInfo).toFixed(2)),
          suggestedDeclaredPrice: Number(resolveSuggestedDeclaredPriceValue(skuRecord, reviewInfo).toFixed(2)),
          suggestedActivityDeclaredPrice: Number(resolveSuggestedActivityDeclaredPriceValue(skuRecord, reviewInfo).toFixed(2)),
          costPrice: '',
          createdAt: normalizeTimestamp(
            statusTime.createdTime || (productRecord && productRecord.productCreatedAt)
          ),
          priceConfirmedAt: normalizeTimestamp(statusTime.priceVerificationTime),
          listedAt: normalizeTimestamp(statusTime.addedToSiteTime),
          offlineAt: normalizeTimestamp(statusTime.unPublishedTime || statusTime.samplePostingFinishedTime),
          terminatedAt: normalizeTimestamp(statusTime.terminatedTime),
          productUpdatedAt: normalizeTimestamp(
            productRecord && (
              productRecord.productUpdatedAt
              || productRecord.productCreatedAt
            )
          ),
          removeStatus: normalizeIntegerValue(productRecord && productRecord.removeStatus, 0),
          updatedAt: nowIso()
        });
      });
    });

    return rows;
  }

  async function querySingleShopRows({ shopSummary, filters, queryJob, runId, emitProgress }) {
    assertQueryJobActive(queryJob);
    const shopId = normalizeText(shopSummary && shopSummary.shopId);
    const shopName = normalizeText(shopSummary && shopSummary.shopName);
    const emitShopProgress = (payload = {}) => {
      emitQueryProgress({
        runId,
        shopId,
        shopName,
        ...payload
      }, emitProgress);
    };
    let accumulatedItemCount = 0;

    emitShopProgress({
      phase: 'warming-session',
      message: '\u6b63\u5728\u68c0\u67e5\u5e97\u94fa\u767b\u5f55\u4f1a\u8bdd'
    });

    const sessionContext = await warmupSellerSessionContext(
      await resolveShopSessionContext(shopSummary),
      {
        timeoutMs: QUERY_REQUEST_TIMEOUT_MS
      }
    );
    const rows = [];
    const payloadPreview = [];
    let total = 0;
    let pageNum = 1;
    let totalPages = 1;
    let mallId = '';
    let mallIdPersisted = false;
    let transientRetryCount = 0;

    try {
      assertQueryJobActive(queryJob);

      emitShopProgress({
        phase: 'starting',
        pageNum,
        totalPages,
        accumulatedItemCount,
        estimatedTotal: total,
        rowCount: rows.length,
        message: '\u5df2\u51c6\u5907\u5f00\u59cb\u67e5\u8be2'
      });

      while (pageNum <= totalPages) {
        assertQueryJobActive(queryJob);
        const requestPayload = buildQueryRequestPayload(filters, pageNum);
        emitShopProgress({
          phase: 'requesting-page',
          pageNum,
          totalPages,
          pageSize: Math.max(
            1,
            normalizeIntegerValue(requestPayload && requestPayload.pageSize, DEFAULT_PAGE_SIZE)
          ),
          accumulatedItemCount,
          estimatedTotal: total,
          rowCount: rows.length
        });
        let response = null;

        while (true) {
          try {
            response = await executeJsonRequest(
              sessionContext,
              QUERY_ENDPOINT_PATH,
              requestPayload,
              {
                timeoutMs: QUERY_REQUEST_TIMEOUT_MS,
                queryJob
              }
            );
            transientRetryCount = 0;
            break;
          } catch (error) {
          if (
              transientRetryCount >= QUERY_TRANSIENT_RETRY_LIMIT
              || !isQueryTransientRetryableError(error)
            ) {
              throw error;
            }

            transientRetryCount += 1;

            emitShopProgress({
              phase: 'retrying-page',
              pageNum,
              totalPages,
              accumulatedItemCount,
              estimatedTotal: total,
              rowCount: rows.length,
              retryAttempt: transientRetryCount,
              retryLimit: QUERY_TRANSIENT_RETRY_LIMIT,
              message: `\u5f53\u524d\u9875\u8bf7\u6c42\u672a\u7a33\u5b9a\uff0c\u6b63\u5728\u7b49\u5f85\u540e\u91cd\u8bd5\uff08${transientRetryCount}/${QUERY_TRANSIENT_RETRY_LIMIT}\uff09`
            });

            await sleep(QUERY_TRANSIENT_RETRY_DELAY_MS, queryJob);
          }
        }
        const responsePayload = response && response.payload ? response.payload : null;
        const result = responsePayload && responsePayload.result ? responsePayload.result : {};
        const dataList = Array.isArray(result && result.dataList) ? result.dataList : [];
        const pageSize = Math.max(
          1,
          normalizeIntegerValue(requestPayload && requestPayload.pageSize, DEFAULT_PAGE_SIZE)
        );

        if (!mallId) {
          mallId = normalizeText(response && response.mallId);

          if (mallId) {
            await persistResolvedMallIdForShop(shopSummary, mallId);
            mallIdPersisted = true;
          }
        }

        payloadPreview.push({
          pageNum,
          payload: requestPayload
        });

        total = normalizeIntegerValue(result && result.total, dataList.length);
        totalPages = Math.max(1, Math.ceil((total || dataList.length || 0) / pageSize));
        accumulatedItemCount += dataList.length;
        rows.push(...dataList.flatMap((productRecord) => createRowsFromSearchItem(productRecord, shopSummary)));

        emitShopProgress({
          phase: 'page-fetched',
          pageNum,
          totalPages,
          pageSize,
          fetchedItemCount: dataList.length,
          accumulatedItemCount,
          estimatedTotal: total,
          rowCount: rows.length
        });

        if (dataList.length <= 0 || pageNum >= totalPages) {
          break;
        }

        const pageDelayMs = buildRandomPageDelayMs(filters);

        if (pageDelayMs > 0) {
          emitShopProgress({
            phase: 'delaying',
            pageNum,
            totalPages,
            pageSize,
            fetchedItemCount: dataList.length,
            accumulatedItemCount,
            estimatedTotal: total,
            rowCount: rows.length,
            delayMs: pageDelayMs,
            delaySeconds: Number((pageDelayMs / 1000).toFixed(3))
          });
          await sleep(pageDelayMs, queryJob);
        }

        pageNum += 1;
      }

      assertQueryJobActive(queryJob);

      if (mallId && mallIdPersisted !== true) {
        await persistResolvedMallIdForShop(shopSummary, mallId);
      }

      emitShopProgress({
        phase: 'completed',
        pageNum: Math.min(pageNum, totalPages),
        totalPages,
        accumulatedItemCount,
        estimatedTotal: total,
        rowCount: rows.length,
        message: '\u67e5\u8be2\u5b8c\u6210'
      });

      return {
        total,
        rowCount: rows.length,
        rows,
        mallId,
        requestPreview: payloadPreview
      };
    } catch (error) {
      if (isQueryCanceledError(error)) {
        error.partialResult = {
          total,
          rowCount: rows.length,
          rows: rows.slice(),
          mallId,
          requestPreview: payloadPreview.slice()
        };

        emitShopProgress({
          phase: 'canceled',
          pageNum: Math.min(pageNum, totalPages),
          totalPages,
          accumulatedItemCount,
          estimatedTotal: total,
          rowCount: rows.length,
          message: '\u67e5\u8be2\u5df2\u505c\u6b62'
        });
      } else {
        emitShopProgress({
          phase: 'failed',
          pageNum: Math.min(pageNum, totalPages),
          totalPages,
          accumulatedItemCount,
          estimatedTotal: total,
          rowCount: rows.length,
          message: normalizeShopQueryFailureMessage(error)
        });
      }

      throw error;
    }
  }

  function sortRows(rows) {
    return (Array.isArray(rows) ? rows.slice() : []).sort((left, right) => {
      const rightUpdatedAt = Date.parse(normalizeText(right && (right.productUpdatedAt || right.priceConfirmedAt || right.createdAt))) || 0;
      const leftUpdatedAt = Date.parse(normalizeText(left && (left.productUpdatedAt || left.priceConfirmedAt || left.createdAt))) || 0;

      if (rightUpdatedAt !== leftUpdatedAt) {
        return rightUpdatedAt - leftUpdatedAt;
      }

      return normalizeText(left && left.id).localeCompare(normalizeText(right && right.id));
    });
  }

  function countDistinctProducts(rows) {
    return new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => [
          normalizeText(row && row.shopId),
          normalizeText(row && row.productId)
        ].filter(Boolean).join(':'))
        .filter(Boolean)
    ).size;
  }

  function normalizeShopQueryFailureMessage(error) {
    const rawMessage = normalizeText(error && error.message);
    const normalizedMessage = rawMessage || '\u67e5\u8be2\u5931\u8d25';
    const phase = normalizeText(error && error.phase);
    const lastSiteMainStatus = normalizeText(error && error.lastSiteMainStatus);
    const lastAutofillStatus = normalizeText(error && error.lastAutofillStatus);
    const lastSiteMainResult = error && error.lastSiteMainResult && typeof error.lastSiteMainResult === 'object'
      ? error.lastSiteMainResult
      : null;
    const siteMainModel = lastSiteMainResult && lastSiteMainResult.siteMainModel && typeof lastSiteMainResult.siteMainModel === 'object'
      ? lastSiteMainResult.siteMainModel
      : null;

    if (
      lastSiteMainStatus === 'missing-current-shop'
      || lastSiteMainStatus === 'shop-not-ready-for-global-entry'
      || lastSiteMainStatus === 'switch-trigger-not-found'
      || lastSiteMainStatus === 'switch-target-not-found'
      || lastSiteMainStatus === 'switch-trigger-click-failed'
      || lastSiteMainStatus === 'switch-target-click-failed'
    ) {
      const targetShopName = normalizeText(lastSiteMainResult && lastSiteMainResult.targetShopName);
      const currentShopName = normalizeText(
        (lastSiteMainResult && lastSiteMainResult.currentShopName)
        || (siteMainModel && siteMainModel.currentShopName)
      );
      const currentShopRowText = normalizeText(
        (lastSiteMainResult && lastSiteMainResult.shopRowText)
        || (siteMainModel && siteMainModel.currentShopRowText)
      );
      const globalEntryFound = Boolean(
        lastSiteMainResult && lastSiteMainResult.globalEntryFound === true
        || siteMainModel && siteMainModel.globalEntryFound === true
      );
      const targetLabel = targetShopName
        ? `\u76ee\u6807\u5e97\u94fa\u300c${targetShopName}\u300d`
        : '\u76ee\u6807\u5e97\u94fa';
      const currentLabel = currentShopName
        ? `\u5f53\u524d\u9875\u9762\u8bc6\u522b\u5230\u300c${currentShopName}\u300d`
        : '\u5f53\u524d\u9875\u9762\u672a\u8bc6\u522b\u5230\u5e97\u94fa';
      const rowLabel = currentShopRowText
        ? `\uff0c\u5e97\u94fa\u533a\u57df\u6587\u672c\uff1a${currentShopRowText}`
        : '';
      const globalLabel = globalEntryFound
        ? '\uff1b\u5df2\u770b\u5230\u300c\u5168\u7403\u300d\u5165\u53e3\uff0c\u4f46\u5e97\u94fa\u672a\u901a\u8fc7\u6821\u9a8c\uff0c\u672a\u6267\u884c\u70b9\u51fb\u3002'
        : '\uff1b\u672a\u770b\u5230\u300c\u5168\u7403\u300d\u5165\u53e3\u3002';

      return `\u8d26\u53f7\u4e0d\u5728\u7ebf\u6216\u81ea\u52a8\u767b\u5f55\u672a\u5b8c\u6210\uff1a${targetLabel}\u672a\u901a\u8fc7\u5e97\u94fa\u6821\u9a8c\uff0c${currentLabel}${rowLabel}${globalLabel}`;
    }

    if (/Mallid/i.test(normalizedMessage)) {
      return '\u5df2\u6253\u5f00\u5e97\u94fa\u4f1a\u8bdd\uff0c\u4f46\u672a\u83b7\u53d6\u5230 Mallid\uff0c\u8bf7\u68c0\u67e5\u662f\u5426\u5df2\u8fdb\u5165 Seller Central \u5168\u7403\u540e\u53f0\u3002';
    }

    if (
      lastSiteMainStatus === 'pending-authorization'
      || lastSiteMainStatus === 'authorization-confirm-clicked'
      || lastAutofillStatus === 'pending-authorization'
      || lastAutofillStatus === 'authorization-confirm-clicked'
      || /\u6388\u6743|\u534f\u8bae\u786e\u8ba4|authorization/i.test(normalizedMessage)
    ) {
      return '\u81ea\u52a8\u767b\u5f55\u5df2\u8bc6\u522b\u5e76\u5904\u7406 Seller Central \u6388\u6743\u786e\u8ba4\uff0c\u4f46\u4f1a\u8bdd\u6682\u672a\u5b8c\u6210\u5c31\u7eea\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff1b\u5982\u4ecd\u5931\u8d25\uff0c\u8bf7\u6253\u5f00\u8be5\u5e97\u94fa\u5356\u5bb6\u4e2d\u5fc3\u67e5\u770b\u662f\u5426\u8fd8\u6709\u4e8c\u6b21\u786e\u8ba4\u6216\u9a8c\u8bc1\u3002';
    }

    if (
      error && error.manualVerification === true
      || /\u9a8c\u8bc1\u7801|\u624b\u52a8|manual|verification/i.test(normalizedMessage)
    ) {
      return '\u8d26\u53f7\u4e0d\u5728\u7ebf\uff0c\u81ea\u52a8\u767b\u5f55\u8fc7\u7a0b\u9700\u8981\u624b\u52a8\u9a8c\u8bc1\u6216\u786e\u8ba4\u6388\u6743\u3002';
    }

    if (
      error && error.timeout === true
      || /\u8d85\u65f6|timeout/i.test(normalizedMessage)
    ) {
      return '\u8d26\u53f7\u4f1a\u8bdd\u672a\u5c31\u7eea\uff0c\u540e\u53f0\u81ea\u52a8\u767b\u5f55\u7b49\u5f85\u8d85\u65f6\u3002';
    }

    if (
      normalizeText(error && error.responseTextPreview)
      && /\u5373\u5c06\u8df3\u8f6c\u81f3temu seller central|\u9690\u79c1\u653f\u7b56|\u6388\u6743|seller central/i.test(
        normalizeText(error && error.responseTextPreview)
      )
    ) {
      return '\u5df2\u8fdb\u5165 Seller Central \u5e97\u94fa\u9875\uff0c\u4f46\u5168\u7403\u540e\u53f0\u6388\u6743\u8df3\u8f6c\u8fd8\u672a\u5b8c\u5168\u7a33\u5b9a\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002';
    }

    if (
      phase
      || /\u81ea\u52a8\u6062\u590d\u5356\u5bb6\u4e2d\u5fc3|\u672a\u786e\u8ba4\u4f1a\u8bdd|\u767b\u5f55|offline|login/i.test(normalizedMessage)
    ) {
      return `\u8d26\u53f7\u4e0d\u5728\u7ebf\u6216\u81ea\u52a8\u767b\u5f55\u672a\u5b8c\u6210\uff1a${normalizedMessage}`;
    }

    return normalizedMessage;
  }

  async function getQuerySettings() {
    try {
      const configResult = await store.readUserConfig('querySettings');
      const newerPayload = pickNewerPayload(
        configResult && configResult.localConfig,
        configResult && configResult.cloudConfig
      );
      const savedSettings = newerPayload && newerPayload.payload && typeof newerPayload.payload === 'object'
        ? newerPayload.payload
        : DEFAULT_QUERY_SETTINGS;

      return {
        settings: {
          ...normalizeQuerySettingsPayload({
            ...DEFAULT_QUERY_SETTINGS,
            ...savedSettings
          }),
          pageDelayMinSeconds: formatDelaySettingsValue(savedSettings && savedSettings.pageDelayMinSeconds),
          pageDelayMaxSeconds: formatDelaySettingsValue(savedSettings && savedSettings.pageDelayMaxSeconds)
        },
        source: newerPayload && newerPayload.source ? newerPayload.source : 'default',
        warning: ''
      };
    } catch (error) {
      logError('operations_new_product_lifecycle_get_query_settings_failed', error, {});

      return {
        settings: {
          ...normalizeQuerySettingsPayload(DEFAULT_QUERY_SETTINGS),
          pageDelayMinSeconds: DEFAULT_QUERY_SETTINGS.pageDelayMinSeconds,
          pageDelayMaxSeconds: DEFAULT_QUERY_SETTINGS.pageDelayMaxSeconds
        },
        source: 'default',
        warning: normalizeText(error && error.message) || '\u672c\u5730\u914d\u7f6e\u8bfb\u53d6\u5931\u8d25'
      };
    }
  }

  async function saveQuerySettings(payload = {}) {
    const nextSettings = normalizeQuerySettingsPayload({
      ...DEFAULT_QUERY_SETTINGS,
      ...(payload && typeof payload === 'object' ? payload : {})
    });
    const writeResult = await store.writeUserConfig('querySettings', nextSettings);

    return {
      settings: {
        ...nextSettings,
        pageDelayMinSeconds: formatDelaySettingsValue(nextSettings.pageDelayMinSeconds),
        pageDelayMaxSeconds: formatDelaySettingsValue(nextSettings.pageDelayMaxSeconds)
      },
      source: writeResult && writeResult.localSaved === true ? 'local' : 'default',
      localSaved: Boolean(writeResult && writeResult.localSaved),
      cloudSynced: Boolean(writeResult && writeResult.cloudSynced),
      warning: normalizeText(writeResult && writeResult.warning)
    };
  }

  function normalizePriceDeclSettingsPayload(source = {}) {
    const payload = source && typeof source === 'object' && !Array.isArray(source)
      ? source
      : {};

    return {
      version: PRICE_DECL_SETTINGS_VERSION,
      updatedAt: normalizeText(payload.updatedAt) || nowIso(),
      approveUseCostPrice: Boolean(payload.approveUseCostPrice),
      approveCondition: normalizeText(payload.approveCondition) || 'profitRate',
      approveValue: normalizeText(payload.approveValue),
      fallbackApproveRules: normalizePriceDeclFallbackApproveRuleList(
        payload.fallbackApproveRules
      ).filter((rule) => hasConfiguredPriceDeclFallbackApproveRule(rule)),
      approveReduceType: normalizeText(payload.approveReduceType) || 'discount',
      approveReduceValue: normalizeText(payload.approveReduceValue),
      approveReduceValueDiscount: normalizeText(
        payload.approveReduceValueDiscount
        || (normalizeText(payload.approveReduceType) === 'discount' ? payload.approveReduceValue : '')
      ),
      approveReduceValueFlatReduce: normalizeText(
        payload.approveReduceValueFlatReduce
        || (normalizeText(payload.approveReduceType) === 'flatReduce' ? payload.approveReduceValue : '')
      ),
      voidMaxAttempts: normalizeText(payload.voidMaxAttempts) || '3'
    };
  }

  async function getPriceDeclSettings() {
    try {
      const configResult = await store.readUserConfig('priceDeclSettings');
      const newerPayload = pickNewerPayload(
        configResult && configResult.localConfig,
        configResult && configResult.cloudConfig
      );
      const savedSettings = newerPayload && newerPayload.payload && typeof newerPayload.payload === 'object'
        ? newerPayload.payload
        : DEFAULT_PRICE_DECL_SETTINGS;

      return {
        settings: normalizePriceDeclSettingsPayload({
          ...DEFAULT_PRICE_DECL_SETTINGS,
          ...savedSettings
        }),
        source: newerPayload && newerPayload.source ? newerPayload.source : 'default',
        warning: ''
      };
    } catch (error) {
      logError('operations_new_product_lifecycle_get_price_decl_settings_failed', error, {});

      return {
        settings: normalizePriceDeclSettingsPayload(DEFAULT_PRICE_DECL_SETTINGS),
        source: 'default',
        warning: normalizeText(error && error.message) || '配置读取失败'
      };
    }
  }

  async function savePriceDeclSettings(payload = {}) {
    const nextSettings = normalizePriceDeclSettingsPayload({
      ...DEFAULT_PRICE_DECL_SETTINGS,
      ...(payload && typeof payload === 'object' ? payload : {})
    });
    const writeResult = await store.writeUserConfig('priceDeclSettings', nextSettings);

    return {
      settings: normalizePriceDeclSettingsPayload(nextSettings),
      source: writeResult && writeResult.localSaved === true ? 'local' : 'default',
      localSaved: Boolean(writeResult && writeResult.localSaved),
      cloudSynced: Boolean(writeResult && writeResult.cloudSynced),
      warning: normalizeText(writeResult && writeResult.warning)
    };
  }

  async function getBatchAdjustPresetSnapshot(payload = {}) {
    try {
      const configResult = await store.readUserConfig('batchAdjustPresets');
      const owner = configResult && configResult.owner
        ? configResult.owner
        : store.getOwner();
      const newerPayload = pickNewerPayload(
        configResult && configResult.localConfig,
        configResult && configResult.cloudConfig
      );
      const presetPayload = normalizeBatchAdjustPresetPayload(newerPayload.payload, owner);
      const filteredEntries = filterBatchAdjustPresetEntries(presetPayload.entries, payload);

      return {
        version: presetPayload.version,
        owner: presetPayload.owner,
        updatedAt: presetPayload.updatedAt,
        source: newerPayload.source,
        settings: normalizeBatchAdjustPresetSettings(presetPayload.settings),
        entryCount: filteredEntries.length,
        entries: filteredEntries.map((entry) => ({
          key: entry.key,
          shopId: entry.shopId,
          shopName: entry.shopName,
          station: entry.station,
          stationLabel: entry.stationLabel,
          category: entry.category,
          categoryLabel: entry.categoryLabel,
          categoryTrail: entry.categoryTrail,
          spec: entry.spec,
          groups: (Array.isArray(entry.groups) ? entry.groups : []).map((group) => ({
            id: normalizeText(group && group.id),
            declaredPriceMin: normalizeText(group && group.declaredPriceMin),
            declaredPriceMax: normalizeText(group && group.declaredPriceMax),
            adjustMode: normalizeBatchAdjustMode(group && group.adjustMode),
            adjustValue: normalizeText(group && group.adjustValue)
          })),
          updatedAt: entry.updatedAt
        })),
        warning: ''
      };
    } catch (error) {
      logError('operations_new_product_lifecycle_get_batch_adjust_presets_failed', error, {});

      return {
        version: BATCH_ADJUST_PRESET_VERSION,
        owner: store.getOwner(),
        updatedAt: '',
        source: 'default',
        settings: normalizeBatchAdjustPresetSettings(DEFAULT_BATCH_ADJUST_SETTINGS),
        entryCount: 0,
        entries: [],
        warning: normalizeText(error && error.message) || '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u8bfb\u53d6\u5931\u8d25'
      };
    }
  }

  async function saveBatchAdjustPresetBatch(payload = {}) {
    const owner = store.getOwner();
    const configResult = await store.readUserConfig('batchAdjustPresets');
    const newerPayload = pickNewerPayload(
      configResult && configResult.localConfig,
      configResult && configResult.cloudConfig
    );
    const currentPayload = normalizeBatchAdjustPresetPayload(newerPayload.payload, owner);
    const nextEntryMap = new Map(
      currentPayload.entries.map((entry) => [entry.key, entry])
    );
    const hasSettingsPayload = Boolean(
      payload
      && typeof payload === 'object'
      && Object.prototype.hasOwnProperty.call(payload, 'settings')
    );
    const normalizedEntries = (Array.isArray(payload && payload.entries) ? payload.entries : [])
      .map((entry) => normalizeBatchAdjustPresetEntry(entry))
      .filter(Boolean);
    const nextSettings = hasSettingsPayload
      ? normalizeBatchAdjustPresetSettings(payload && payload.settings)
      : normalizeBatchAdjustPresetSettings(currentPayload && currentPayload.settings);

    normalizedEntries.forEach((entry) => {
      if (!entry.key) {
        return;
      }

      if (!Array.isArray(entry.groups) || entry.groups.length <= 0) {
        nextEntryMap.delete(entry.key);
        return;
      }

      nextEntryMap.set(entry.key, {
        ...entry,
        updatedAt: nowIso()
      });
    });

    const nextPayload = normalizeBatchAdjustPresetPayload({
      ...currentPayload,
      updatedAt: nowIso(),
      settings: nextSettings,
      entries: Array.from(nextEntryMap.values())
    }, owner);
    const writeResult = await store.writeUserConfig('batchAdjustPresets', nextPayload);

    return {
      version: nextPayload.version,
      owner: nextPayload.owner,
      updatedAt: nextPayload.updatedAt,
      source: writeResult && writeResult.localSaved === true ? 'local' : 'default',
      localSaved: Boolean(writeResult && writeResult.localSaved),
      cloudSynced: Boolean(writeResult && writeResult.cloudSynced),
      settings: normalizeBatchAdjustPresetSettings(nextPayload.settings),
      entryCount: normalizedEntries.length,
      savedEntryCount: nextPayload.entries.length,
      entries: normalizedEntries.map((entry) => ({
        key: entry.key,
        shopId: entry.shopId,
        shopName: entry.shopName,
        station: entry.station,
        stationLabel: entry.stationLabel,
        category: entry.category,
        categoryLabel: entry.categoryLabel,
        categoryTrail: entry.categoryTrail,
        spec: entry.spec,
        groups: (Array.isArray(entry.groups) ? entry.groups : []).map((group) => ({
          id: group.id,
          declaredPriceMin: group.declaredPriceMin,
          declaredPriceMax: group.declaredPriceMax,
          adjustMode: normalizeBatchAdjustMode(group.adjustMode),
          adjustValue: group.adjustValue
        }))
      })),
      warning: normalizeText(writeResult && writeResult.warning)
    };
  }

  async function getBatchAdjustSubmitHistorySnapshot() {
    try {
      const stateResult = await store.readUserState('batchAdjustSubmitHistory');
      const owner = stateResult && stateResult.owner
        ? stateResult.owner
        : store.getOwner();
      const newerPayload = pickNewerPayload(
        stateResult && stateResult.localState,
        stateResult && stateResult.cloudState
      );

      log('operations_new_product_lifecycle_get_batch_adjust_submit_history_loaded', {
        source: normalizeText(newerPayload && newerPayload.source) || 'empty',
        hasLocalState: Boolean(stateResult && stateResult.localState),
        hasCloudState: Boolean(stateResult && stateResult.cloudState),
        ownerUserKey: normalizeText(owner && owner.userKey)
      });

      return normalizeBatchAdjustSubmitHistoryPayload(newerPayload && newerPayload.payload, owner);
    } catch (error) {
      logError('operations_new_product_lifecycle_get_batch_adjust_submit_history_failed', error, {});
      return normalizeBatchAdjustSubmitHistoryPayload(null, store.getOwner());
    }
  }

  async function saveBatchAdjustSubmitHistorySnapshot(payload) {
    const owner = store.getOwner();
    const nextPayload = normalizeBatchAdjustSubmitHistoryPayload(payload, owner);
    const writeResult = await store.writeUserState('batchAdjustSubmitHistory', nextPayload);

    return {
      payload: nextPayload,
      localSaved: Boolean(writeResult && writeResult.localSaved),
      cloudSynced: Boolean(writeResult && writeResult.cloudSynced),
      warning: normalizeText(writeResult && writeResult.warning)
    };
  }

  function emitBatchAdjustSubmitProgress(payload = {}, progressEmitter) {
    if (typeof progressEmitter !== 'function') {
      return;
    }

    const taskType = normalizeText(payload && payload.taskType) || 'batchAdjustSubmit';

    try {
      progressEmitter({
        source: 'operations-new-product-lifecycle',
        updatedAt: nowIso(),
        ...payload,
        taskType
      });
    } catch (error) {
      logError('operations_new_product_lifecycle_batch_adjust_progress_emit_failed', error, {
        runId: normalizeText(payload && payload.runId),
        shopId: normalizeText(payload && payload.currentShopId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  function emitBatchAdjustPreviewProgress(payload = {}, progressEmitter) {
    emitBatchAdjustSubmitProgress({
      taskType: 'batchAdjustPreview',
      successDailyCount: Math.max(0, normalizeIntegerValue(payload && payload.requestedDailyCount, 0)),
      successActivityCount: Math.max(0, normalizeIntegerValue(payload && payload.requestedActivityCount, 0)),
      failedDailyCount: 0,
      failedActivityCount: 0,
      ...payload
    }, progressEmitter);
  }

  function emitPriceDeclSubmitProgress(payload = {}, progressEmitter) {
    if (typeof progressEmitter !== 'function') {
      return;
    }

    try {
      progressEmitter({
        source: 'operations-new-product-lifecycle',
        taskType: 'priceDeclSubmit',
        updatedAt: nowIso(),
        ...payload
      });
    } catch (error) {
      logError('operations_new_product_lifecycle_price_decl_progress_emit_failed', error, {
        runId: normalizeText(payload && payload.runId),
        shopId: normalizeText(payload && payload.currentShopId),
        phase: normalizeText(payload && payload.phase)
      });
    }
  }

  async function fetchBatchAdjustActivityDetailChunk(sessionContext, requestChunk, queryJob = null) {
    const response = await executeJsonRequest(
      sessionContext,
      BATCH_ADJUST_ACTIVITY_DETAIL_ENDPOINT_PATH,
      {
        items: requestChunk.map((item) => ({
          supplierId: toSafeIntegerIdValue(item && item.supplierId),
          productId: toSafeIntegerIdValue(item && item.productId)
        }))
      },
      {
        queryJob,
        timeoutMs: BATCH_ADJUST_REQUEST_TIMEOUT_MS,
        timeoutMessage: '\u6279\u91cf\u8c03\u4ef7\u6d3b\u52a8\u8be6\u60c5\u67e5\u8be2\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
        defaultErrorMessage: '\u6279\u91cf\u8c03\u4ef7\u6d3b\u52a8\u8be6\u60c5\u67e5\u8be2\u5931\u8d25',
        refererPath: '/newon/product-select'
      }
    );
    return buildBatchAdjustActivityDetailLookup(
      extractResponseResultPayload(response && response.payload)
    );
  }

  async function fetchBatchAdjustActivityDetailChunkWithFallback(sessionContext, requestChunk, context = {}) {
    const chunk = Array.isArray(requestChunk) ? requestChunk.filter(Boolean) : [];

    if (chunk.length <= 0) {
      return new Map();
    }

    try {
      return await fetchBatchAdjustActivityDetailChunk(
        sessionContext,
        chunk,
        context && context.queryJob
      );
    } catch (error) {
      if (isBatchAdjustCanceledError(error)) {
        throw error;
      }
      if (chunk.length <= 1) {
        logError('operations_new_product_lifecycle_batch_adjust_activity_detail_item_failed', error, {
          runId: normalizeText(context && context.runId),
          shopId: normalizeText(context && context.shopId),
          shopName: normalizeText(context && context.shopName),
          productId: normalizeText(chunk[0] && chunk[0].productId),
          supplierId: normalizeText(chunk[0] && chunk[0].supplierId),
          chunkSize: chunk.length
        });
        return new Map();
      }

      const middleIndex = Math.ceil(chunk.length / 2);
      const leftChunk = chunk.slice(0, middleIndex);
      const rightChunk = chunk.slice(middleIndex);
      const mergedLookup = new Map();
      const leftLookup = await fetchBatchAdjustActivityDetailChunkWithFallback(
        sessionContext,
        leftChunk,
        context
      );
      const rightLookup = await fetchBatchAdjustActivityDetailChunkWithFallback(
        sessionContext,
        rightChunk,
        context
      );

      leftLookup.forEach((entry, lookupKey) => {
        mergedLookup.set(lookupKey, entry);
      });
      rightLookup.forEach((entry, lookupKey) => {
        mergedLookup.set(lookupKey, entry);
      });

      logError('operations_new_product_lifecycle_batch_adjust_activity_detail_chunk_split', error, {
        runId: normalizeText(context && context.runId),
        shopId: normalizeText(context && context.shopId),
        shopName: normalizeText(context && context.shopName),
        chunkSize: chunk.length,
        leftChunkSize: leftChunk.length,
        rightChunkSize: rightChunk.length
      });

      return mergedLookup;
    }
  }

  async function fetchBatchAdjustActivityDetailLookupForShop(sessionContext, shopGroup, options = {}) {
    const activityRows = (Array.isArray(shopGroup && shopGroup.rows) ? shopGroup.rows : [])
      .filter((row) => Boolean(row && row.activityCandidate));
    const requestItemMap = new Map();
    const runId = normalizeText(options && options.runId);
    const totalShops = Math.max(0, normalizeIntegerValue(options && options.totalShops, 0));
    const completedShops = Math.max(0, normalizeIntegerValue(options && options.completedShops, 0));
    const failedShops = Math.max(0, normalizeIntegerValue(options && options.failedShops, 0));
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const progressTaskType = normalizeText(options && options.progressTaskType) || 'batchAdjustSubmit';
    const requestedDailyCount = Math.max(0, normalizeIntegerValue(options && options.requestedDailyCount, 0));
    const requestedActivityCount = Math.max(0, normalizeIntegerValue(options && options.requestedActivityCount, 0));
    const skippedRowCount = Math.max(0, normalizeIntegerValue(options && options.skippedRowCount, 0));
    const shopRequestState = options && options.shopRequestState
      ? options.shopRequestState
      : null;
    const queryJob = options && options.queryJob;

    assertCancelableJobActive(queryJob);

    activityRows.forEach((row) => {
      const productId = normalizeText(row && row.productId);
      const supplierId = normalizeText(row && row.supplierId);
      const requestKey = productId && supplierId
        ? `${productId}\x1f${supplierId}`
        : '';

      if (!requestKey || requestItemMap.has(requestKey)) {
        return;
      }

      requestItemMap.set(requestKey, {
        productId,
        supplierId
      });
    });

    const requestItems = Array.from(requestItemMap.values());

    if (requestItems.length <= 0) {
      return new Map();
    }

    const lookup = new Map();
    const requestChunks = chunkList(requestItems, BATCH_ADJUST_DETAIL_CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < requestChunks.length; chunkIndex += 1) {
      assertCancelableJobActive(queryJob);

      const requestChunk = requestChunks[chunkIndex];

      emitBatchAdjustSubmitProgress({
        taskType: progressTaskType,
        runId,
        phase: 'activity-detail',
        totalShops,
        completedShops,
        failedShops,
        requestedDailyCount,
        requestedActivityCount,
        skippedRowCount,
        currentShopId: normalizeText(shopGroup && shopGroup.shopId),
        currentShopName: normalizeText(shopGroup && shopGroup.shopName),
        currentChunkIndex: chunkIndex + 1,
        totalChunks: requestChunks.length,
        message: `\u6b63\u5728\u83b7\u53d6 ${normalizeText(shopGroup && shopGroup.shopName) || normalizeText(shopGroup && shopGroup.shopId)} \u7684\u6d3b\u52a8\u4ef7\u8be6\u60c5`
      }, progressEmitter);

      if (shopRequestState && shopRequestState.hasIssuedRequest === true) {
        await sleepBatchAdjust(buildBatchAdjustSubmitRequestDelayMs(), options && options.queryJob);
      }

      const chunkLookup = await waitCancelableJobPromise(
        fetchBatchAdjustActivityDetailChunkWithFallback(
          sessionContext,
          requestChunk,
          {
            runId,
            queryJob,
            shopId: normalizeText(shopGroup && shopGroup.shopId),
            shopName: normalizeText(shopGroup && shopGroup.shopName)
          }
        ),
        queryJob
      );
      assertCancelableJobActive(queryJob);

      if (shopRequestState) {
        shopRequestState.hasIssuedRequest = true;
      }

      chunkLookup.forEach((entry, lookupKey) => {
        lookup.set(lookupKey, entry);
      });
    }

    return lookup;
  }

  function getOrCreateBatchAdjustGroupEntry(groupMap, row, productId, productSkcId, supplierId) {
    const groupKey = buildBatchAdjustGroupKey(row);

    if (!groupKey) {
      return null;
    }

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        adjustItem: {
          productName: normalizeText(row && row.productName) || normalizeText(row && row.productId),
          productSkcId: toSafeIntegerIdValue(productSkcId),
          skuAdjustList: [],
          productId: toSafeIntegerIdValue(productId),
          supplierId: toSafeIntegerIdValue(supplierId)
        },
        lineMetas: []
      });
    }

    return groupMap.get(groupKey);
  }

  function finalizeBatchAdjustGroupEntries(groupMap) {
    return Array.from(groupMap.values()).filter((groupEntry) => {
      return Array.isArray(groupEntry && groupEntry.adjustItem && groupEntry.adjustItem.skuAdjustList)
        && groupEntry.adjustItem.skuAdjustList.length > 0;
    });
  }

  function hasPotentialBatchAdjustActivityRows(rows, settings) {
    return (Array.isArray(rows) ? rows : []).some((row) => {
      return Boolean(row && row.activityCandidate);
    });
  }

  async function prepareBatchAdjustDailySubmitGroups(shopRows, reasonRowIdMap, settings, submitHistoryPayload, context = {}) {
    const rows = Array.isArray(shopRows) ? shopRows : [];
    const dailyEnabled = normalizeBatchAdjustEnabledSetting(settings && settings.dailyEnabled, true);
    const dailyProfitFloor = resolveBatchAdjustScopedProfitFloorSettings(settings, 'daily');
    const duplicateSubmitWindowDays = resolveBatchAdjustDuplicateSubmitWindowDays(settings);
    const suggestedPriceFallbackCount = resolveBatchAdjustSuggestedPriceFallbackCount(settings);
    const groupMap = new Map();
    let requestedDailyCount = 0;
    const runHandle = context && context.runHandle;
    const progressEmitter = typeof context.progressEmitter === 'function' ? context.progressEmitter : null;
    const progressPhase = normalizeText(context && context.progressPhase) || 'daily-preview';
    const progressLabel = normalizeText(context && context.progressLabel) || '\u6b63\u5728\u751f\u6210\u65e5\u5e38\u8c03\u4ef7\u9884\u89c8';
    let skippedRowCount = 0;

    const emitRowProgress = async (index) => {
      const currentRow = rows[index] || {};

      log('operations_new_product_lifecycle_batch_adjust_daily_preview_slice_progress', {
        runId: normalizeText(context && context.runId),
        shopId: normalizeText(context && context.currentShopId),
        shopName: normalizeText(context && context.currentShopName),
        currentIndex: index + 1,
        totalRows: rows.length,
        rowId: normalizeText(currentRow && currentRow.rowId),
        productId: normalizeText(currentRow && currentRow.productId),
        skuId: normalizeText(currentRow && currentRow.skuId),
        requestedDailyCount,
        skippedRowCount
      });

      await reportBatchAdjustPreviewRowProgress({
        context,
        runHandle,
        progressEmitter,
        phase: progressPhase,
        currentIndex: index + 1,
        totalRows: rows.length,
        requestedDailyCount,
        requestedActivityCount: undefined,
        skippedRowCount,
        message: `${progressLabel} ${index + 1}/${rows.length}`
      });
    };

    if (!dailyEnabled) {
      return {
        requestedDailyCount,
        adjustGroups: []
      };
    }

    log('operations_new_product_lifecycle_batch_adjust_daily_preview_started', {
      runId: normalizeText(context && context.runId),
      shopId: normalizeText(context && context.currentShopId),
      shopName: normalizeText(context && context.currentShopName),
      rowCount: rows.length
    });

    for (let index = 0; index < rows.length; index += 1) {
      assertBatchAdjustRunActive(runHandle);
      const row = rows[index];
      const rowId = normalizeText(row && row.rowId);
      const productId = normalizeText(row && row.productId);
      const productSkcId = normalizeText(row && row.productSkcId);
      const skuId = normalizeText(row && row.skuId);
      const supplierId = normalizeText(row && row.supplierId);
      const siteId = normalizeText(row && row.siteId);
      const costPrice = normalizeMoneyCentValue(row && row.costPrice);
      const missingReasonKeys = [];

      if (!supplierId) {
        missingReasonKeys.push('missing_supplier_id');
      }

      if (!productId || !productSkcId || !skuId || !siteId) {
        missingReasonKeys.push('missing_identity');
      }

      if (missingReasonKeys.length > 0) {
        recordBatchAdjustSkipReasons(reasonRowIdMap, rowId, missingReasonKeys);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      const hasLocalDailyCandidate = Boolean(row && row.dailyCandidate);
      const groupEntry = getOrCreateBatchAdjustGroupEntry(
        groupMap,
        row,
        productId,
        productSkcId,
        supplierId
      );

      if (!groupEntry) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'missing_identity', rowId);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      const basePriceCurrency = normalizeText(row && row.oldPriceCurrency) || 'CNY';
      const baseTargetCurrency = normalizeText(row && row.targetPriceCurrency) || basePriceCurrency || 'CNY';
      const historyRecord = buildBatchAdjustSubmitHistoryLineRecord(row, 'daily');
      const historySubmitCount = historyRecord
        ? getBatchAdjustSubmitHistoryCount(submitHistoryPayload, 'daily', historyRecord.key)
        : 0;
      const useSuggestedPrice = Boolean(
        historyRecord
        && shouldUseBatchAdjustSuggestedPrice(
          submitHistoryPayload,
          'daily',
          historyRecord.key,
          suggestedPriceFallbackCount,
          row && row.suggestedDeclaredPrice
        )
      );
      const oldSupplyPrice = useSuggestedPrice
        ? normalizeMoneyCentValue(row && row.declaredPrice)
        : normalizeMoneyCentValue(row && row.dailyCandidate && row.dailyCandidate.oldSupplyPrice);
      const suggestedDailyResolution = useSuggestedPrice
        ? resolveBatchAdjustDailySuggestedTargetSupplyPrice(
          oldSupplyPrice,
          row && row.suggestedDeclaredPrice
        )
        : null;
      const targetSupplyPrice = useSuggestedPrice
        ? normalizeMoneyCentValue(suggestedDailyResolution && suggestedDailyResolution.targetSupplyPrice)
        : normalizeMoneyCentValue(row && row.dailyCandidate && row.dailyCandidate.targetSupplyPrice);

      if (!hasLocalDailyCandidate && !useSuggestedPrice) {
        recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, 'daily', 'daily_rule_not_matched');
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      if (oldSupplyPrice <= 0) {
        recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, 'daily', 'daily_source_missing');
        skippedRowCount += 1;
      } else if (targetSupplyPrice <= 0) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'daily_target_invalid', rowId);
        skippedRowCount += 1;
      } else if (targetSupplyPrice >= oldSupplyPrice) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'daily_not_reduce', rowId);
        skippedRowCount += 1;
      } else if (costPrice <= 0) {
        recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, 'daily', 'missing_cost');
        skippedRowCount += 1;
      } else if (isBatchAdjustProfitFloorViolated(targetSupplyPrice, costPrice, dailyProfitFloor)) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'daily_profit_floor', rowId);
        skippedRowCount += 1;
      } else if (
        historyRecord
        && shouldSkipBatchAdjustRecentSubmitted(
          submitHistoryPayload,
          'daily',
          historyRecord.key,
          duplicateSubmitWindowDays
        )
      ) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'daily_recent_submitted', rowId);
        skippedRowCount += 1;
      } else {
        groupEntry.adjustItem.skuAdjustList.push({
          targetPriceCurrency: baseTargetCurrency,
          oldPriceCurrency: basePriceCurrency,
          oldSupplyPrice,
          skuId: toSafeIntegerIdValue(skuId),
          targetSupplyPrice,
          syncPurchasePrice: 1,
          siteId: toSafeIntegerIdValue(siteId)
        });
        groupEntry.lineMetas.push({
          rowId,
          kind: 'daily',
          targetSupplyPrice,
          priceSource: useSuggestedPrice
            ? normalizeText(suggestedDailyResolution && suggestedDailyResolution.priceSource) || 'suggested'
            : 'rule',
          submitCount: historySubmitCount,
          historyRecord
        });
        requestedDailyCount += 1;
      }

      if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
        await emitRowProgress(index);
      }
    }

    log('operations_new_product_lifecycle_batch_adjust_daily_preview_completed', {
      runId: normalizeText(context && context.runId),
      shopId: normalizeText(context && context.currentShopId),
      shopName: normalizeText(context && context.currentShopName),
      rowCount: rows.length,
      requestedDailyCount,
      skippedRowCount,
      groupCount: groupMap.size
    });

    return {
      requestedDailyCount,
      adjustGroups: finalizeBatchAdjustGroupEntries(groupMap)
    };
  }

  async function prepareBatchAdjustActivitySubmitGroups(shopRows, activityDetailLookup, reasonRowIdMap, settings, submitHistoryPayload, context = {}) {
    const rows = Array.isArray(shopRows) ? shopRows : [];
    const lookup = activityDetailLookup instanceof Map ? activityDetailLookup : new Map();
    const activityEnabled = normalizeBatchAdjustEnabledSetting(settings && settings.activityEnabled, false);
    const activityProfitFloor = resolveBatchAdjustScopedProfitFloorSettings(settings, 'activity');
    const duplicateSubmitWindowDays = resolveBatchAdjustDuplicateSubmitWindowDays(settings);
    const groupMap = new Map();
    let requestedActivityCount = 0;
    const runHandle = context && context.runHandle;
    const progressEmitter = typeof context.progressEmitter === 'function' ? context.progressEmitter : null;
    const progressPhase = normalizeText(context && context.progressPhase) || 'activity-preview';
    const progressLabel = normalizeText(context && context.progressLabel) || '\u6b63\u5728\u751f\u6210\u6d3b\u52a8\u8c03\u4ef7\u9884\u89c8';
    let skippedRowCount = 0;

    const emitRowProgress = async (index) => {
      const currentRow = rows[index] || {};

      log('operations_new_product_lifecycle_batch_adjust_activity_preview_slice_progress', {
        runId: normalizeText(context && context.runId),
        shopId: normalizeText(context && context.currentShopId),
        shopName: normalizeText(context && context.currentShopName),
        currentIndex: index + 1,
        totalRows: rows.length,
        rowId: normalizeText(currentRow && currentRow.rowId),
        productId: normalizeText(currentRow && currentRow.productId),
        skuId: normalizeText(currentRow && currentRow.skuId),
        requestedActivityCount,
        skippedRowCount
      });

      await reportBatchAdjustPreviewRowProgress({
        context,
        runHandle,
        progressEmitter,
        phase: progressPhase,
        currentIndex: index + 1,
        totalRows: rows.length,
        requestedDailyCount: undefined,
        requestedActivityCount,
        skippedRowCount,
        message: `${progressLabel} ${index + 1}/${rows.length}`
      });
    };

    if (!activityEnabled) {
      return {
        requestedActivityCount,
        adjustGroups: []
      };
    }

    log('operations_new_product_lifecycle_batch_adjust_activity_preview_started', {
      runId: normalizeText(context && context.runId),
      shopId: normalizeText(context && context.currentShopId),
      shopName: normalizeText(context && context.currentShopName),
      rowCount: rows.length
    });

    for (let index = 0; index < rows.length; index += 1) {
      assertBatchAdjustRunActive(runHandle);
      const row = rows[index];
      const rowId = normalizeText(row && row.rowId);
      const productId = normalizeText(row && row.productId);
      const productSkcId = normalizeText(row && row.productSkcId);
      const skuId = normalizeText(row && row.skuId);
      const supplierId = normalizeText(row && row.supplierId);
      const siteId = normalizeText(row && row.siteId);
      const hasLocalActivityCandidate = Boolean(row && row.activityCandidate);
      const detailLookupKey = buildBatchAdjustDetailLookupKey(productId, skuId, siteId);
      const detailEntry = detailLookupKey && lookup.has(detailLookupKey)
        ? lookup.get(detailLookupKey)
        : null;
      const costPrice = normalizeMoneyCentValue(row && row.costPrice);
      const missingReasonKeys = [];

      if (!supplierId) {
        missingReasonKeys.push('missing_supplier_id');
      }

      if (!productId || !productSkcId || !skuId || !siteId) {
        missingReasonKeys.push('missing_identity');
      }

      if (missingReasonKeys.length > 0) {
        recordBatchAdjustSkipReasons(reasonRowIdMap, rowId, missingReasonKeys);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      if (!hasLocalActivityCandidate) {
        recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, 'activity', 'activity_reduction_missing');
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      if (!detailEntry) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'activity_detail_missing', rowId);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      if (detailEntry.forbid === true) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'detail_forbid', rowId);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      const groupEntry = getOrCreateBatchAdjustGroupEntry(
        groupMap,
        row,
        productId,
        productSkcId,
        supplierId
      );

      if (!groupEntry) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'missing_identity', rowId);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      if (costPrice <= 0) {
        recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, 'activity', 'missing_cost');
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      const basePriceCurrency = normalizeText(
        detailEntry && detailEntry.priceCurrency
      ) || normalizeText(row && row.oldPriceCurrency) || 'CNY';
      const baseTargetCurrency = normalizeText(
        detailEntry && detailEntry.targetPriceCurrency
      ) || normalizeText(row && row.targetPriceCurrency) || basePriceCurrency || 'CNY';
      const reductionAmount = normalizeMoneyCentValue(
        row && row.activityCandidate && row.activityCandidate.reductionAmount
      );
      const marketingActivities = resolveDetailEntryMarketingActivities(detailEntry);

      if (marketingActivities.length <= 0) {
        recordBatchAdjustSkipReason(reasonRowIdMap, 'activity_invitation_empty', rowId);
        skippedRowCount += 1;
        if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
          await emitRowProgress(index);
        }
        continue;
      }

      if (marketingActivities.length > 1) {
        log('operations_new_product_lifecycle_batch_adjust_activity_multi_records', {
          rowId,
          shopId: normalizeText(row && row.shopId),
          productId,
          skuId,
          siteId,
          activityCount: marketingActivities.length
        });
      }

      let submittedActivityCount = 0;
      let failedReasonKey = '';

      marketingActivities.forEach((activity) => {
        const activityInvitationId = normalizeText(activity && activity.activityInvitationId);
        const oldSupplyPrice = normalizeMoneyCentValue(activity && activity.supplyPrice);
        const historyRecord = buildBatchAdjustSubmitHistoryLineRecord(row, 'activity', {
          activityInvitationId
        });
        const historySubmitCount = historyRecord
          ? getBatchAdjustSubmitHistoryCount(submitHistoryPayload, 'activity', historyRecord.key)
          : 0;
        const targetSupplyPrice = reductionAmount > 0
          ? Math.max(0, oldSupplyPrice - reductionAmount)
          : normalizeMoneyCentValue(row && row.activityCandidate && row.activityCandidate.targetSupplyPrice);

        if (oldSupplyPrice <= 0 || targetSupplyPrice <= 0) {
          failedReasonKey = failedReasonKey || 'activity_target_invalid';
          return;
        }

        if (targetSupplyPrice >= oldSupplyPrice) {
          failedReasonKey = failedReasonKey || 'activity_not_reduce';
          return;
        }

        if (isBatchAdjustProfitFloorViolated(targetSupplyPrice, costPrice, activityProfitFloor)) {
          failedReasonKey = failedReasonKey || 'activity_profit_floor';
          return;
        }

        if (
          historyRecord
          && shouldSkipBatchAdjustRecentSubmitted(
            submitHistoryPayload,
            'activity',
            historyRecord.key,
            duplicateSubmitWindowDays
          )
        ) {
          failedReasonKey = failedReasonKey || 'activity_recent_submitted';
          return;
        }

        groupEntry.adjustItem.skuAdjustList.push({
          activityInvitationId: toSafeIntegerIdValue(activity && activity.activityInvitationId),
          targetPriceCurrency: normalizeText(detailEntry && detailEntry.targetPriceCurrency) || baseTargetCurrency,
          oldPriceCurrency: normalizeText(detailEntry && detailEntry.priceCurrency) || basePriceCurrency,
          oldSupplyPrice,
          skuId: toSafeIntegerIdValue(skuId),
          targetSupplyPrice,
          syncPurchasePrice: 1,
          siteId: toSafeIntegerIdValue(detailEntry && detailEntry.siteId ? detailEntry.siteId : siteId)
        });
        groupEntry.lineMetas.push({
          rowId,
          kind: 'activity',
          targetSupplyPrice,
          priceSource: 'reduction',
          submitCount: historySubmitCount,
          historyRecord
        });
        requestedActivityCount += 1;
        submittedActivityCount += 1;
      });

      if (submittedActivityCount <= 0) {
        if (!failedReasonKey) {
          recordBatchAdjustScopedLocalSkipReasons(reasonRowIdMap, rowId, row, 'activity', 'activity_invitation_missing');
          skippedRowCount += 1;
          if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
            await emitRowProgress(index);
          }
          continue;
        }

        recordBatchAdjustSkipReason(reasonRowIdMap, failedReasonKey, rowId);
        skippedRowCount += 1;
      }

      if ((index + 1) % BATCH_ADJUST_PREVIEW_PROGRESS_INTERVAL === 0 || index + 1 === rows.length) {
        await emitRowProgress(index);
      }
    }

    log('operations_new_product_lifecycle_batch_adjust_activity_preview_completed', {
      runId: normalizeText(context && context.runId),
      shopId: normalizeText(context && context.currentShopId),
      shopName: normalizeText(context && context.currentShopName),
      rowCount: rows.length,
      requestedActivityCount,
      skippedRowCount,
      groupCount: groupMap.size
    });

    return {
      requestedActivityCount,
      adjustGroups: finalizeBatchAdjustGroupEntries(groupMap)
    };
  }

  async function previewBatchAdjust(payload = {}, options = {}) {
    const normalizedPayload = normalizeBatchAdjustSubmitPayload(payload);
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const runHandle = createBatchAdjustRunHandle(payload);
    const runId = normalizeText(runHandle && runHandle.runId);
    const reasonRowIdMap = new Map();
    const previewItemMap = new Map();
    const shopGroups = groupBatchAdjustRowsByShop(normalizedPayload.rows);
    const resultsByShop = [];
    const groupedRequests = [];
    const previewProgressSummary = {
      totalShops: shopGroups.length,
      completedShops: 0,
      failedShops: 0,
      requestedDailyCount: 0,
      requestedActivityCount: 0,
      skippedRowCount: 0
    };
    let canceled = false;

    try {
      log('operations_new_product_lifecycle_batch_adjust_preview_started', {
        runId,
        rowCount: normalizedPayload.rows.length,
        shopCount: shopGroups.length,
        dailyEnabled: normalizeBatchAdjustEnabledSetting(normalizedPayload.settings.dailyEnabled, true),
        activityEnabled: normalizeBatchAdjustEnabledSetting(normalizedPayload.settings.activityEnabled, false)
      });

      normalizedPayload.rows.forEach((row) => {
        assertBatchAdjustRunActive(runHandle);
        const normalizedRowId = normalizeText(row && row.rowId);

        if (!normalizedRowId) {
          return;
        }

        previewItemMap.set(normalizedRowId, buildBatchAdjustPreviewItem(row));
      });

      if (normalizedPayload.rows.length <= 0) {
        emitBatchAdjustPreviewProgress({
          runId,
          phase: 'failed',
          totalShops: 0,
          completedShops: 0,
          failedShops: 0,
          requestedDailyCount: 0,
          requestedActivityCount: 0,
          skippedRowCount: 0,
          message: '\u6ca1\u6709\u53ef\u9884\u89c8\u7684\u8c03\u4ef7\u6570\u636e'
        }, progressEmitter);

        return {
          success: false,
          runId,
          message: '\u6ca1\u6709\u53ef\u9884\u89c8\u7684\u8c03\u4ef7\u6570\u636e',
          warning: '',
          previewItems: [],
          groupedRequests: [],
          summary: {
            totalRowCount: 0,
            totalShops: 0,
            readyRowCount: 0,
            dailyReadyRowCount: 0,
            activityReadyRowCount: 0,
            requestedDailyCount: 0,
            requestedActivityCount: 0,
            requestGroupCount: 0,
            skippedRowCount: 0
          },
          resultsByShop: [],
          canceled: false
        };
      }

      emitBatchAdjustPreviewProgress({
        runId,
        phase: 'preparing',
        totalShops: previewProgressSummary.totalShops,
        completedShops: 0,
        failedShops: 0,
        requestedDailyCount: 0,
        requestedActivityCount: 0,
        skippedRowCount: 0,
        message: `\u6b63\u5728\u51c6\u5907\u9884\u89c8 ${previewProgressSummary.totalShops} \u5bb6\u5e97\u94fa\u7684\u6279\u91cf\u8c03\u4ef7`
      }, progressEmitter);

      let submitHistoryPayload = normalizeBatchAdjustSubmitHistoryPayload(null, store.getOwner());

      emitBatchAdjustPreviewProgress({
        runId,
        phase: 'history',
        totalShops: previewProgressSummary.totalShops,
        completedShops: 0,
        failedShops: 0,
        requestedDailyCount: 0,
        requestedActivityCount: 0,
        skippedRowCount: 0,
        message: '\u6b63\u5728\u8bfb\u53d6\u5386\u53f2\u63d0\u4ea4\u8bb0\u5f55\uff0c\u7528\u4e8e\u8d85\u6b21\u540e\u6539\u5efa\u8bae\u4ef7'
      }, progressEmitter);

      try {
        submitHistoryPayload = await withBatchAdjustTimeout(
          getBatchAdjustSubmitHistorySnapshot(),
          BATCH_ADJUST_PREVIEW_HISTORY_TIMEOUT_MS,
          runHandle,
          '\u8bfb\u53d6\u5386\u53f2\u63d0\u4ea4\u8bb0\u5f55\u8d85\u65f6'
        );
      } catch (error) {
        if (isBatchAdjustCanceledError(error)) {
          throw error;
        }

        logError('operations_new_product_lifecycle_batch_adjust_preview_history_skipped', error, {
          runId
        });
      }

      const shopPreviewResults = await mapWithConcurrency(shopGroups, BATCH_ADJUST_PREVIEW_SHOP_CONCURRENCY, async (shopGroup, shopIndex) => {
        assertBatchAdjustRunActive(runHandle);
        const shopId = normalizeText(shopGroup && shopGroup.shopId);
        const shopName = normalizeText(shopGroup && shopGroup.shopName) || shopId;
        const shopRows = Array.isArray(shopGroup && shopGroup.rows) ? shopGroup.rows : [];
        const shopGroupedRequests = [];
        let shopSuccess = true;
        let shopMessage = '';
        let requestedDailyCount = 0;
        let requestedActivityCount = 0;
        let requestGroupCount = 0;

        try {
          if (normalizeBatchAdjustEnabledSetting(normalizedPayload.settings.dailyEnabled, true)) {
            log('operations_new_product_lifecycle_batch_adjust_preview_shop_daily_started', {
              runId,
              shopId,
              shopName,
              rowCount: shopRows.length
            });

            emitBatchAdjustPreviewProgress({
              runId,
              phase: 'daily-preview',
              totalShops: previewProgressSummary.totalShops,
              completedShops: previewProgressSummary.completedShops,
              failedShops: previewProgressSummary.failedShops,
              requestedDailyCount: previewProgressSummary.requestedDailyCount,
              requestedActivityCount: previewProgressSummary.requestedActivityCount,
              skippedRowCount: previewProgressSummary.skippedRowCount,
              currentShopId: shopId,
              currentShopName: shopName,
              message: `\u6b63\u5728\u751f\u6210 ${shopName} \u7684\u65e5\u5e38\u8c03\u4ef7\u9884\u89c8`
            }, progressEmitter);

            const dailyPreparedGroups = await prepareBatchAdjustDailySubmitGroups(
              shopRows,
              reasonRowIdMap,
              normalizedPayload.settings,
              submitHistoryPayload,
              {
                runHandle,
                progressEmitter,
                progressBase: {
                  runId,
                  totalShops: previewProgressSummary.totalShops,
                  completedShops: previewProgressSummary.completedShops,
                  failedShops: previewProgressSummary.failedShops,
                  requestedDailyCount: previewProgressSummary.requestedDailyCount,
                  requestedActivityCount: previewProgressSummary.requestedActivityCount,
                  skippedRowCount: previewProgressSummary.skippedRowCount
                },
                runId,
                progressTaskType: 'batchAdjustPreview',
                progressPhase: 'daily-preview',
                currentShopId: shopId,
                currentShopName: shopName,
                progressLabel: `\u6b63\u5728\u751f\u6210 ${shopName} \u7684\u65e5\u5e38\u8c03\u4ef7\u9884\u89c8`
              }
            );
            const dailyRequest = buildBatchAdjustPreparedRequest(
              shopId,
              shopName,
              'daily',
              dailyPreparedGroups && dailyPreparedGroups.adjustGroups
            );

            requestedDailyCount = Math.max(
              0,
              normalizeIntegerValue(dailyPreparedGroups && dailyPreparedGroups.requestedDailyCount, 0)
            );

            log('operations_new_product_lifecycle_batch_adjust_preview_shop_daily_completed', {
              runId,
              shopId,
              shopName,
              requestedDailyCount,
              groupCount: dailyRequest ? dailyRequest.groupCount : 0
            });

            if (dailyRequest) {
              shopGroupedRequests.push(dailyRequest);
              requestGroupCount += dailyRequest.groupCount;
              markBatchAdjustPreviewPreparedRows(
                previewItemMap,
                dailyRequest.adjustGroups,
                'daily'
              );
            }
          }

          if (
            normalizeBatchAdjustEnabledSetting(normalizedPayload.settings.activityEnabled, false)
            && hasPotentialBatchAdjustActivityRows(shopRows, normalizedPayload.settings)
          ) {
            try {
              log('operations_new_product_lifecycle_batch_adjust_preview_shop_activity_session_started', {
                runId,
                shopId,
                shopName,
                rowCount: shopRows.length
              });

              emitBatchAdjustPreviewProgress({
                runId,
                phase: 'shop-session',
                totalShops: previewProgressSummary.totalShops,
                completedShops: previewProgressSummary.completedShops,
                failedShops: previewProgressSummary.failedShops,
                requestedDailyCount: previewProgressSummary.requestedDailyCount,
                requestedActivityCount: previewProgressSummary.requestedActivityCount,
                skippedRowCount: previewProgressSummary.skippedRowCount,
                currentShopId: shopId,
                currentShopName: shopName,
                message: `\u6b63\u5728\u8bfb\u53d6 ${shopName} \u7684\u767b\u5f55\u72b6\u6001`
              }, progressEmitter);

              const sessionContext = await resolveShopSessionContext({ shopId, shopName });
              const warmedSessionContext = await warmupSellerSessionContext(sessionContext, {
                timeoutMs: 60000,
                queryJob: runHandle
              });
              assertBatchAdjustRunActive(runHandle);

              log('operations_new_product_lifecycle_batch_adjust_preview_shop_activity_session_completed', {
                runId,
                shopId,
                shopName,
                partition: normalizeText(warmedSessionContext && warmedSessionContext.partition)
              });

              const activityDetailLookup = await fetchBatchAdjustActivityDetailLookupForShop(
                warmedSessionContext,
                shopGroup,
                {
                  runId,
                  totalShops: previewProgressSummary.totalShops,
                  completedShops: previewProgressSummary.completedShops,
                  failedShops: previewProgressSummary.failedShops,
                  requestedDailyCount: previewProgressSummary.requestedDailyCount,
                  requestedActivityCount: previewProgressSummary.requestedActivityCount,
                  skippedRowCount: previewProgressSummary.skippedRowCount,
                  progressTaskType: 'batchAdjustPreview',
                  emitProgress: progressEmitter,
                  queryJob: runHandle
                }
              );
              assertBatchAdjustRunActive(runHandle);

              log('operations_new_product_lifecycle_batch_adjust_preview_shop_activity_detail_completed', {
                runId,
                shopId,
                shopName,
                detailCount: activityDetailLookup instanceof Map ? activityDetailLookup.size : 0
              });

              emitBatchAdjustPreviewProgress({
                runId,
                phase: 'activity-preview',
                totalShops: previewProgressSummary.totalShops,
                completedShops: previewProgressSummary.completedShops,
                failedShops: previewProgressSummary.failedShops,
                requestedDailyCount: previewProgressSummary.requestedDailyCount,
                requestedActivityCount: previewProgressSummary.requestedActivityCount,
                skippedRowCount: previewProgressSummary.skippedRowCount,
                currentShopId: shopId,
                currentShopName: shopName,
                message: `\u6b63\u5728\u751f\u6210 ${shopName} \u7684\u6d3b\u52a8\u8c03\u4ef7\u9884\u89c8`
              }, progressEmitter);

              const activityPreparedGroups = await prepareBatchAdjustActivitySubmitGroups(
                shopRows,
                activityDetailLookup,
                reasonRowIdMap,
                normalizedPayload.settings,
                submitHistoryPayload,
                {
                  runHandle,
                  progressEmitter,
                  progressBase: {
                    runId,
                    totalShops: previewProgressSummary.totalShops,
                    completedShops: previewProgressSummary.completedShops,
                    failedShops: previewProgressSummary.failedShops,
                    requestedDailyCount: previewProgressSummary.requestedDailyCount,
                    requestedActivityCount: previewProgressSummary.requestedActivityCount,
                    skippedRowCount: previewProgressSummary.skippedRowCount
                  },
                  runId,
                  progressTaskType: 'batchAdjustPreview',
                  progressPhase: 'activity-preview',
                  currentShopId: shopId,
                  currentShopName: shopName,
                  progressLabel: `\u6b63\u5728\u751f\u6210 ${shopName} \u7684\u6d3b\u52a8\u8c03\u4ef7\u9884\u89c8`
                }
              );
              const activityRequest = buildBatchAdjustPreparedRequest(
                shopId,
                shopName,
                'activity',
                activityPreparedGroups && activityPreparedGroups.adjustGroups
              );

              requestedActivityCount = Math.max(
                0,
                normalizeIntegerValue(activityPreparedGroups && activityPreparedGroups.requestedActivityCount, 0)
              );

              log('operations_new_product_lifecycle_batch_adjust_preview_shop_activity_completed', {
                runId,
                shopId,
                shopName,
                requestedActivityCount,
                groupCount: activityRequest ? activityRequest.groupCount : 0
              });

              if (activityRequest) {
                shopGroupedRequests.push(activityRequest);
                requestGroupCount += activityRequest.groupCount;
                markBatchAdjustPreviewPreparedRows(
                  previewItemMap,
                  activityRequest.adjustGroups,
                  'activity'
                );
              }
            } catch (error) {
              if (isBatchAdjustCanceledError(error)) {
                throw error;
              }
              shopSuccess = false;
              shopMessage = normalizeText(error && error.message)
                || '\u6d3b\u52a8\u8c03\u4ef7\u9884\u89c8\u5931\u8d25';
            }
          }
        } catch (error) {
          if (isBatchAdjustCanceledError(error)) {
            throw error;
          }
          shopSuccess = false;
          shopMessage = normalizeText(error && error.message)
            || '\u8c03\u4ef7\u9884\u89c8\u5931\u8d25';
        }

        const shopReadyRowCount = shopRows.reduce((total, row) => {
          const previewItem = previewItemMap.get(normalizeText(row && row.rowId));
          return total + (previewItem && previewItem.submitEligible ? 1 : 0);
        }, 0);
        const shopSkippedRowCount = Math.max(0, shopRows.length - shopReadyRowCount);
        const successParts = [];

        if (requestedDailyCount > 0) {
          successParts.push(`\u65e5\u5e38 ${requestedDailyCount} \u6761`);
        }

        if (requestedActivityCount > 0) {
          successParts.push(`\u6d3b\u52a8 ${requestedActivityCount} \u6761`);
        }

        if (shopSuccess === true) {
          shopMessage = successParts.length > 0
            ? `\u9884\u89c8\u5b8c\u6210\uff1a${successParts.join('\uff0c')}${shopSkippedRowCount > 0 ? `\uff0c\u8df3\u8fc7 ${shopSkippedRowCount} \u6761` : ''}`
            : `\u6682\u65e0\u53ef\u63d0\u4ea4\u9879${shopSkippedRowCount > 0 ? `\uff0c\u8df3\u8fc7 ${shopSkippedRowCount} \u6761` : ''}`;
        } else {
          previewProgressSummary.failedShops += 1;
          shopMessage = successParts.length > 0
            ? `\u90e8\u5206\u9884\u89c8\u5b8c\u6210\uff1a${successParts.join('\uff0c')}\uff1b${shopMessage}`
            : shopMessage;
        }

        previewProgressSummary.completedShops += 1;
        previewProgressSummary.requestedDailyCount += requestedDailyCount;
        previewProgressSummary.requestedActivityCount += requestedActivityCount;
        previewProgressSummary.skippedRowCount += shopSkippedRowCount;

        emitBatchAdjustPreviewProgress({
          runId,
          phase: shopSuccess === true ? 'shop-completed' : 'shop-failed',
          totalShops: previewProgressSummary.totalShops,
          completedShops: previewProgressSummary.completedShops,
          failedShops: previewProgressSummary.failedShops,
          requestedDailyCount: previewProgressSummary.requestedDailyCount,
          requestedActivityCount: previewProgressSummary.requestedActivityCount,
          skippedRowCount: previewProgressSummary.skippedRowCount,
          currentShopId: shopId,
          currentShopName: shopName,
          message: `${shopName}\uff1a${shopMessage}`
        }, progressEmitter);

        return {
          index: shopIndex,
          groupedRequests: shopGroupedRequests,
          result: {
            shopId,
            shopName,
            success: shopSuccess,
            message: shopMessage,
            requestedDailyCount,
            requestedActivityCount,
            groupCount: requestGroupCount,
            totalRows: shopRows.length,
            readyRowCount: shopReadyRowCount,
            skippedRowCount: shopSkippedRowCount
          }
        };
      });

      shopPreviewResults
        .filter(Boolean)
        .sort((left, right) => (
          Math.max(0, normalizeIntegerValue(left && left.index, 0))
          - Math.max(0, normalizeIntegerValue(right && right.index, 0))
        ))
        .forEach((shopPreviewResult) => {
          if (shopPreviewResult && shopPreviewResult.result) {
            resultsByShop.push(shopPreviewResult.result);
          }

          (Array.isArray(shopPreviewResult && shopPreviewResult.groupedRequests)
            ? shopPreviewResult.groupedRequests
            : []
          ).forEach((request) => {
            groupedRequests.push(request);
          });
        });

      const rowReasonMap = buildBatchAdjustRowReasonMap(reasonRowIdMap);
      const previewItems = Array.from(previewItemMap.values()).map((previewItem) => {
        const rowReasonKeys = rowReasonMap.get(normalizeText(previewItem && previewItem.rowId)) || [];
        const dailySkipReasonKeys = filterBatchAdjustReasonKeysByScope(rowReasonKeys, 'daily');
        const activitySkipReasonKeys = filterBatchAdjustReasonKeysByScope(rowReasonKeys, 'activity');

        return {
          ...previewItem,
          dailySkipReasonKeys,
          dailySkipReasonLabels: mapBatchAdjustReasonKeysToLabels(dailySkipReasonKeys),
          activitySkipReasonKeys,
          activitySkipReasonLabels: mapBatchAdjustReasonKeysToLabels(activitySkipReasonKeys),
          submitEligible: Boolean(previewItem && (previewItem.dailyReady || previewItem.activityReady))
        };
      });

      const summary = previewItems.reduce((result, previewItem) => {
        result.totalRowCount += 1;
        result.dailyReadyRowCount += previewItem && previewItem.dailyReady ? 1 : 0;
        result.activityReadyRowCount += previewItem && previewItem.activityReady ? 1 : 0;
        result.readyRowCount += previewItem && previewItem.submitEligible ? 1 : 0;
        result.requestedDailyCount += Math.max(0, normalizeIntegerValue(previewItem && previewItem.dailyRequestCount, 0));
        result.requestedActivityCount += Math.max(0, normalizeIntegerValue(previewItem && previewItem.activityRequestCount, 0));

        return result;
      }, {
        totalRowCount: 0,
        totalShops: shopGroups.length,
        readyRowCount: 0,
        dailyReadyRowCount: 0,
        activityReadyRowCount: 0,
        requestedDailyCount: 0,
        requestedActivityCount: 0,
        requestGroupCount: groupedRequests.reduce((total, request) => {
          return total + Math.max(0, normalizeIntegerValue(request && request.groupCount, 0));
        }, 0),
        skippedRowCount: 0
      });

      summary.skippedRowCount = Math.max(0, summary.totalRowCount - summary.readyRowCount);

      const warningParts = [];

      if (summary.skippedRowCount > 0) {
        warningParts.push(`\u5df2\u8df3\u8fc7 ${summary.skippedRowCount} \u6761\u4e0d\u7b26\u5408\u6761\u4ef6\u7684SKU`);
      }

      if (previewProgressSummary.failedShops > 0) {
        warningParts.push(`\u6709 ${previewProgressSummary.failedShops} \u5bb6\u5e97\u94fa\u672a\u5b8c\u6210\u9884\u89c8`);
      }

      emitBatchAdjustPreviewProgress({
        runId,
        phase: canceled === true ? 'canceled' : 'completed',
        totalShops: summary.totalShops,
        completedShops: previewProgressSummary.completedShops,
        failedShops: previewProgressSummary.failedShops,
        requestedDailyCount: summary.requestedDailyCount,
        requestedActivityCount: summary.requestedActivityCount,
        skippedRowCount: summary.skippedRowCount,
        message: canceled === true
          ? '\u5df2\u505c\u6b62\u4efb\u52a1'
          : (
            summary.readyRowCount > 0
              ? `\u9884\u89c8\u5b8c\u6210\uff0c\u65e5\u5e38 ${summary.requestedDailyCount} \u6761\uff0c\u6d3b\u52a8 ${summary.requestedActivityCount} \u6761`
              : '\u9884\u89c8\u5b8c\u6210\uff0c\u6682\u65e0\u53ef\u63d0\u4ea4\u9879'
          )
      }, progressEmitter);

      const previewRequestToken = storeBatchAdjustPreviewPreparedRequests(runId, groupedRequests, summary);
      const groupedRequestSummaries = summarizeBatchAdjustPreparedRequestsForRenderer(groupedRequests);
      const responsePayloadBytes = estimateJsonPayloadBytes({
        previewItems,
        groupedRequests: groupedRequestSummaries,
        summary,
        resultsByShop
      });

      log('operations_new_product_lifecycle_batch_adjust_preview_completed', {
        runId,
        totalShops: summary.totalShops,
        completedShops: previewProgressSummary.completedShops,
        failedShops: previewProgressSummary.failedShops,
        totalRowCount: summary.totalRowCount,
        readyRowCount: summary.readyRowCount,
        requestedDailyCount: summary.requestedDailyCount,
        requestedActivityCount: summary.requestedActivityCount,
        groupedRequestCount: groupedRequests.length,
        rendererGroupedRequestCount: groupedRequestSummaries.length,
        responsePayloadBytes,
        hasPreviewRequestToken: Boolean(previewRequestToken),
        canceled
      });

      return {
        success: canceled !== true && (previewProgressSummary.failedShops <= 0 || summary.readyRowCount > 0),
        runId,
        previewRequestToken,
        message: canceled === true
          ? '\u5df2\u505c\u6b62\u4efb\u52a1'
          : (summary.readyRowCount > 0
            ? ''
            : '\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u8c03\u4ef7\u6570\u636e'),
        warning: warningParts.join('\uff1b'),
        previewItems,
        groupedRequests: groupedRequestSummaries,
        summary,
        resultsByShop,
        canceled
      };
    } catch (error) {
      if (isBatchAdjustCanceledError(error)) {
        canceled = true;
        log('operations_new_product_lifecycle_batch_adjust_preview_canceled', {
          runId,
          completedShops: previewProgressSummary.completedShops,
          failedShops: previewProgressSummary.failedShops,
          previewItemCount: previewItemMap.size
        });

        emitBatchAdjustPreviewProgress({
          runId,
          phase: 'canceled',
          totalShops: shopGroups.length,
          completedShops: previewProgressSummary.completedShops,
          failedShops: previewProgressSummary.failedShops,
          requestedDailyCount: previewProgressSummary.requestedDailyCount,
          requestedActivityCount: previewProgressSummary.requestedActivityCount,
          skippedRowCount: previewProgressSummary.skippedRowCount,
          message: '\u5df2\u505c\u6b62\u4efb\u52a1'
        }, progressEmitter);

        const previewItems = Array.from(previewItemMap.values());
        const canceledSummary = {
          totalRowCount: previewItemMap.size,
          totalShops: shopGroups.length,
          readyRowCount: 0,
          dailyReadyRowCount: 0,
          activityReadyRowCount: 0,
          requestedDailyCount: 0,
          requestedActivityCount: 0,
          requestGroupCount: groupedRequests.reduce((total, request) => {
            return total + Math.max(0, normalizeIntegerValue(request && request.groupCount, 0));
          }, 0),
          skippedRowCount: 0
        };
        const previewRequestToken = storeBatchAdjustPreviewPreparedRequests(runId, groupedRequests, canceledSummary);

        return {
          success: false,
          runId,
          previewRequestToken,
          message: '\u5df2\u505c\u6b62\u4efb\u52a1',
          warning: '',
          previewItems,
          groupedRequests: summarizeBatchAdjustPreparedRequestsForRenderer(groupedRequests),
          summary: canceledSummary,
          resultsByShop,
          canceled: true
        };
      }

      throw error;
    }
    finally {
      clearBatchAdjustRunHandle(runHandle);
    }
  }

  async function submitBatchAdjustGroupChunks({
    warmedSessionContext,
    adjustReason,
    remark,
    adjustGroups,
    submitKind,
    shopGroup,
    summary,
    rowUpdateMap,
    failedShopMessages,
    progressEmitter,
    reasonRowIdMap,
    runId,
    submitHistoryState,
    runHandle,
    shopRequestState
  }) {
    const normalizedSubmitKind = normalizeText(submitKind) === 'activity' ? 'activity' : 'daily';
    const shopName = normalizeText(shopGroup && shopGroup.shopName) || normalizeText(shopGroup && shopGroup.shopId);
    const submitKindLabel = normalizedSubmitKind === 'activity'
      ? '\u6d3b\u52a8'
      : '\u65e5\u5e38';
    let hadFailure = false;

    if (!Array.isArray(adjustGroups) || adjustGroups.length <= 0) {
      return {
        hadFailure
      };
    }

    const adjustGroupChunks = chunkList(adjustGroups, BATCH_ADJUST_SUBMIT_CHUNK_SIZE);

    async function submitGroupBatch(adjustGroupBatch, chunkIndex, splitDepth = 0) {
      assertBatchAdjustRunActive(runHandle);
      const lineMetas = collectBatchAdjustGroupLineMetas(adjustGroupBatch);
      const chunkDailyCount = lineMetas.filter((lineMeta) => normalizeText(lineMeta && lineMeta.kind) === 'daily').length;
      const chunkActivityCount = lineMetas.filter((lineMeta) => normalizeText(lineMeta && lineMeta.kind) === 'activity').length;

      emitBatchAdjustSubmitProgress({
        runId,
        phase: 'submitting',
        totalShops: summary.totalShops,
        completedShops: summary.completedShops,
        failedShops: summary.failedShops,
        requestedDailyCount: summary.requestedDailyCount,
        requestedActivityCount: summary.requestedActivityCount,
        successDailyCount: summary.successDailyCount,
        successActivityCount: summary.successActivityCount,
        failedDailyCount: summary.failedDailyCount,
        failedActivityCount: summary.failedActivityCount,
        skippedRowCount: countBatchAdjustSkippedRows(reasonRowIdMap),
        currentShopId: normalizeText(shopGroup && shopGroup.shopId),
        currentShopName: shopName,
        currentChunkIndex: chunkIndex + 1,
        totalChunks: adjustGroupChunks.length,
        message: splitDepth > 0
          ? `\u6b63\u5728\u62c6\u5206\u91cd\u8bd5 ${shopName} \u7684${submitKindLabel}\u8c03\u4ef7`
          : `\u6b63\u5728\u63d0\u4ea4 ${shopName} \u7684${submitKindLabel}\u8c03\u4ef7`
      }, progressEmitter);

      try {
        if (shopRequestState && shopRequestState.hasIssuedRequest === true) {
          await sleepBatchAdjust(buildBatchAdjustSubmitRequestDelayMs(), runHandle);
        }

        const submitPayload = {
          adjustReason,
          adjustItems: adjustGroupBatch.map((groupEntry) => {
            return groupEntry.adjustItem;
          })
        };

        if (remark) {
          submitPayload.reason = remark;
        }

        let response = null;
        let requestStarted = false;

        try {
          requestStarted = true;
          response = await executeJsonRequest(
            warmedSessionContext,
            BATCH_ADJUST_SUBMIT_ENDPOINT_PATH,
            submitPayload,
            {
              queryJob: runHandle,
              timeoutMs: BATCH_ADJUST_REQUEST_TIMEOUT_MS,
              timeoutMessage: '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
              defaultErrorMessage: '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25',
              refererPath: '/newon/product-select'
            }
          );
        } finally {
          if (requestStarted === true && shopRequestState) {
            shopRequestState.hasIssuedRequest = true;
          }
        }

        if (!(response && response.payload && response.payload.result === true)) {
          const submitStatusError = new Error('\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u672a\u8fd4\u56de\u6210\u529f\u72b6\u6001\u3002');
          submitStatusError.endpointPath = BATCH_ADJUST_SUBMIT_ENDPOINT_PATH;
          throw submitStatusError;
        }

        summary.successDailyCount += chunkDailyCount;
        summary.successActivityCount += chunkActivityCount;

        lineMetas.forEach((lineMeta) => {
          const basePatch = {
            status: 'pricePending',
            priceReviewStatus: 0,
            updatedAt: nowIso()
          };
          const countPatch = buildBatchAdjustSubmitCountRowPatch(
            lineMeta && lineMeta.historyRecord,
            submitHistoryState && submitHistoryState.payload,
            basePatch.updatedAt
          );

          pushBatchAdjustRowUpdate(rowUpdateMap, lineMeta && lineMeta.rowId, {
            ...basePatch,
            ...countPatch
          });

          if (
            submitHistoryState
            && submitHistoryState.payload
            && lineMeta
            && lineMeta.historyRecord
            && upsertBatchAdjustSubmitHistoryRecord(
              submitHistoryState.payload,
              lineMeta.historyRecord,
              basePatch.updatedAt
            )
          ) {
            submitHistoryState.changed = true;
          }
        });
        return false;
      } catch (error) {
        if (isBatchAdjustCanceledError(error)) {
          throw error;
        }

        const splitGroupBatches = shouldSplitBatchAdjustSubmitFailure(error)
          ? splitBatchAdjustSubmitGroupEntries(adjustGroupBatch)
          : [];

        if (splitGroupBatches.length > 1) {
          let splitHadFailure = false;

          logError('operations_new_product_lifecycle_batch_adjust_submit_chunk_split_retry', error, {
            runId,
            submitKind: normalizedSubmitKind,
            shopId: normalizeText(shopGroup && shopGroup.shopId),
            chunkIndex: chunkIndex + 1,
            splitDepth,
            ...buildBatchAdjustSubmitDebugInfo(adjustGroupBatch)
          });

          for (const splitGroupBatch of splitGroupBatches) {
            assertBatchAdjustRunActive(runHandle);

            if (await submitGroupBatch(splitGroupBatch, chunkIndex, splitDepth + 1)) {
              splitHadFailure = true;
            }
          }

          return splitHadFailure;
        }

        hadFailure = true;
        summary.failedDailyCount += chunkDailyCount;
        summary.failedActivityCount += chunkActivityCount;

        if (failedShopMessages.length < 20) {
          failedShopMessages.push(
            `${shopName}(${submitKindLabel})\uff1a${normalizeText(error && error.message) || '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25'}`
          );
        }

        logError('operations_new_product_lifecycle_batch_adjust_submit_chunk_failed', error, {
          runId,
          submitKind: normalizedSubmitKind,
          shopId: normalizeText(shopGroup && shopGroup.shopId),
          chunkIndex: chunkIndex + 1,
          splitDepth,
          ...buildBatchAdjustSubmitDebugInfo(adjustGroupBatch)
        });
        return true;
      }
    }

    for (let chunkIndex = 0; chunkIndex < adjustGroupChunks.length; chunkIndex += 1) {
      if (await submitGroupBatch(adjustGroupChunks[chunkIndex], chunkIndex)) {
        hadFailure = true;
      }
    }

    return {
      hadFailure
    };
  }

  async function submitBatchAdjust(payload = {}, options = {}) {
    const normalizedPayload = normalizeBatchAdjustSubmitPayload(payload);
    const itemRequestsFromPayload = normalizeBatchAdjustPreparedRequests(payload && payload.itemRequests);
    const itemRequestsFromPreviewCache = itemRequestsFromPayload.length > 0
      ? itemRequestsFromPayload
      : normalizeBatchAdjustPreparedRequests(
        getBatchAdjustPreviewPreparedRequests(normalizeText(normalizedPayload.previewRequestToken))
      );
    const usedPreviewRequestCache = itemRequestsFromPayload.length <= 0
      && itemRequestsFromPreviewCache.length > 0
      && Boolean(normalizeText(normalizedPayload.previewRequestToken));
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const runHandle = createBatchAdjustRunHandle(payload);
    const runId = normalizeText(runHandle && runHandle.runId);
    const reasonCode = normalizeText(
      normalizedPayload
      && normalizedPayload.settings
      && normalizedPayload.settings.reasonCode
    );
    const adjustReason = BATCH_ADJUST_REASON_CODE_TO_API_VALUE[reasonCode];
    const remark = normalizeText(
      normalizedPayload
      && normalizedPayload.settings
      && normalizedPayload.settings.remark
    );
    const submitDailyEnabled = normalizeBatchAdjustEnabledSetting(
      normalizedPayload && normalizedPayload.settings && normalizedPayload.settings.dailyEnabled,
      true
    );
    const submitActivityEnabled = normalizeBatchAdjustEnabledSetting(
      normalizedPayload && normalizedPayload.settings && normalizedPayload.settings.activityEnabled,
      false
    );
    const itemRequestsToUse = itemRequestsFromPreviewCache.length > 0
      ? itemRequestsFromPreviewCache
      : itemRequestsFromPayload;

    if (!adjustReason) {
      clearBatchAdjustRunHandle(runHandle);
      throw new Error('\u8bf7\u5148\u9009\u62e9\u8c03\u4ef7\u539f\u56e0\u540e\u518d\u63d0\u4ea4\u3002');
    }

    try {
      const reasonRowIdMap = new Map();
      const eligibleCounts = itemRequestsToUse.length > 0
        ? {
          localDailyEligibleCount: itemRequestsToUse
            .filter((request) => normalizeText(request && request.submitKind) === 'daily')
            .reduce((total, request) => total + Math.max(0, normalizeIntegerValue(request && request.requestedCount, 0)), 0),
          localActivityEligibleCount: itemRequestsToUse
            .filter((request) => normalizeText(request && request.submitKind) === 'activity')
            .reduce((total, request) => total + Math.max(0, normalizeIntegerValue(request && request.requestedCount, 0)), 0)
        }
        : countBatchAdjustEligibleCandidates(normalizedPayload.rows);
      let submitHistoryPayload = normalizeBatchAdjustSubmitHistoryPayload(null, store.getOwner());

      try {
        submitHistoryPayload = await withBatchAdjustTimeout(
          getBatchAdjustSubmitHistorySnapshot(),
          BATCH_ADJUST_PREVIEW_HISTORY_TIMEOUT_MS,
          runHandle,
          '\u8bfb\u53d6\u5386\u53f2\u63d0\u4ea4\u8bb0\u5f55\u8d85\u65f6'
        );
      } catch (error) {
        if (isBatchAdjustCanceledError(error)) {
          throw error;
        }

        logError('operations_new_product_lifecycle_batch_adjust_submit_history_skipped', error, {
          runId
        });
      }

      const submitHistoryState = {
        payload: submitHistoryPayload,
        changed: false
      };
      const shopGroupMap = new Map();

      if (itemRequestsToUse.length > 0) {
        itemRequestsToUse.forEach((request) => {
          const shopId = normalizeText(request && request.shopId);

          if (!shopId || shopGroupMap.has(shopId)) {
            return;
          }

          shopGroupMap.set(shopId, {
            shopId,
            shopName: normalizeText(request && request.shopName) || shopId,
            rows: normalizedPayload.rows.filter((row) => normalizeText(row && row.shopId) === shopId)
          });
        });
      } else {
        groupBatchAdjustRowsByShop(normalizedPayload.rows).forEach((shopGroup) => {
          const shopId = normalizeText(shopGroup && shopGroup.shopId);

          if (shopId) {
            shopGroupMap.set(shopId, shopGroup);
          }
        });
      }

      const shopGroups = Array.from(shopGroupMap.values());
      const rowUpdateMap = new Map();
      const failedShopMessages = [];
      const totalRowCount = normalizedPayload.rows.length > 0
        ? normalizedPayload.rows.length
        : itemRequestsToUse.reduce((rowIdSet, request) => {
          (Array.isArray(request && request.adjustGroups) ? request.adjustGroups : []).forEach((groupEntry) => {
            (Array.isArray(groupEntry && groupEntry.lineMetas) ? groupEntry.lineMetas : []).forEach((lineMeta) => {
              const rowId = normalizeText(lineMeta && lineMeta.rowId);

              if (rowId) {
                rowIdSet.add(rowId);
              }
            });
          });

          return rowIdSet;
        }, new Set()).size;
      const summary = {
        updatedAt: nowIso(),
        runId,
        totalRowCount,
        totalShops: shopGroups.length,
        completedShops: 0,
        failedShops: 0,
        localDailyEligibleCount: eligibleCounts.localDailyEligibleCount,
        localActivityEligibleCount: eligibleCounts.localActivityEligibleCount,
        requestedDailyCount: 0,
        requestedActivityCount: 0,
        successDailyCount: 0,
        successActivityCount: 0,
        failedDailyCount: 0,
        failedActivityCount: 0,
        skippedRowCount: 0,
        skippedReasonCounts: {},
        rowUpdates: [],
        warning: '',
        canceled: false
      };

      if (normalizedPayload.rows.length <= 0 && itemRequestsToUse.length <= 0) {
        summary.skippedReasonCounts = buildBatchAdjustSkipReasonCounts(reasonRowIdMap);
        summary.skippedRowCount = countBatchAdjustSkippedRows(reasonRowIdMap);
        summary.warning = buildBatchAdjustWarning(summary.skippedReasonCounts, summary);
        return summary;
      }

      emitBatchAdjustSubmitProgress({
        runId,
        phase: 'preparing',
        totalShops: summary.totalShops,
        completedShops: 0,
        failedShops: 0,
        requestedDailyCount: 0,
        requestedActivityCount: 0,
        successDailyCount: 0,
        successActivityCount: 0,
        failedDailyCount: 0,
        failedActivityCount: 0,
        skippedRowCount: countBatchAdjustSkippedRows(reasonRowIdMap),
        message: `\u6b63\u5728\u51c6\u5907\u63d0\u4ea4 ${summary.totalShops} \u5bb6\u5e97\u94fa\u7684\u6279\u91cf\u8c03\u4ef7`
      }, progressEmitter);

      try {
        await mapWithConcurrency(shopGroups, BATCH_ADJUST_SUBMIT_SHOP_CONCURRENCY, async (shopGroup) => {
        assertBatchAdjustRunActive(runHandle);

        const shopId = normalizeText(shopGroup && shopGroup.shopId);
        const shopName = normalizeText(shopGroup && shopGroup.shopName) || shopId;
        const shopRequestState = {
          hasIssuedRequest: false
        };
        const shopPreparedRequests = itemRequestsToUse.filter((request) => {
          return normalizeText(request && request.shopId) === shopId;
        });
        const preparedDailyRequest = shopPreparedRequests.find((request) => normalizeText(request && request.submitKind) === 'daily') || null;
        const preparedActivityRequest = shopPreparedRequests.find((request) => normalizeText(request && request.submitKind) === 'activity') || null;
        const shopLocalDailyEligibleCount = itemRequestsToUse.length > 0
          ? countBatchAdjustPreparedGroupLineCount(preparedDailyRequest && preparedDailyRequest.adjustGroups)
          : (Array.isArray(shopGroup && shopGroup.rows) ? shopGroup.rows : []).filter((row) => Boolean(row && row.dailyCandidate)).length;
        const shopLocalActivityEligibleCount = itemRequestsToUse.length > 0
          ? countBatchAdjustPreparedGroupLineCount(preparedActivityRequest && preparedActivityRequest.adjustGroups)
          : (Array.isArray(shopGroup && shopGroup.rows) ? shopGroup.rows : []).filter((row) => Boolean(row && row.activityCandidate)).length;
        let shopHadFailure = false;
        let shopFailureMessage = '';

        try {
          const sessionContext = await resolveShopSessionContext({ shopId, shopName });
          const warmedSessionContext = await warmupSellerSessionContext(sessionContext, {
            timeoutMs: 60000,
            queryJob: runHandle
          });
          assertBatchAdjustRunActive(runHandle);

          if (submitDailyEnabled) {
            const dailyPreparationResult = itemRequestsToUse.length > 0
              ? {
                adjustGroups: preparedDailyRequest && Array.isArray(preparedDailyRequest.adjustGroups)
                  ? preparedDailyRequest.adjustGroups
                  : [],
                requestedDailyCount: shopLocalDailyEligibleCount
              }
              : await prepareBatchAdjustDailySubmitGroups(
                shopGroup && shopGroup.rows,
                reasonRowIdMap,
                normalizedPayload.settings,
                submitHistoryState.payload
              );
            const dailyAdjustGroups = Array.isArray(dailyPreparationResult && dailyPreparationResult.adjustGroups)
              ? dailyPreparationResult.adjustGroups
              : [];
            const requestedDailyCount = itemRequestsToUse.length > 0
              ? shopLocalDailyEligibleCount
              : Math.max(0, normalizeIntegerValue(dailyPreparationResult && dailyPreparationResult.requestedDailyCount, 0));

            summary.requestedDailyCount += requestedDailyCount;

            if (dailyAdjustGroups.length > 0) {
              const dailySubmitResult = await submitBatchAdjustGroupChunks({
                warmedSessionContext,
                adjustReason,
                remark,
                adjustGroups: dailyAdjustGroups,
                submitKind: 'daily',
                shopGroup,
                summary,
                rowUpdateMap,
                failedShopMessages,
                progressEmitter,
                reasonRowIdMap,
                runId,
                submitHistoryState,
                runHandle,
                shopRequestState
              });

              if (dailySubmitResult && dailySubmitResult.hadFailure === true) {
                shopHadFailure = true;
              }
            }
          }

            if (
            submitActivityEnabled
            && (
              itemRequestsToUse.length > 0
                ? shopLocalActivityEligibleCount > 0
                : hasPotentialBatchAdjustActivityRows(shopGroup && shopGroup.rows, normalizedPayload.settings)
            )
          ) {
            try {
              const activityAdjustGroups = itemRequestsToUse.length > 0
                ? (preparedActivityRequest && Array.isArray(preparedActivityRequest.adjustGroups)
                  ? preparedActivityRequest.adjustGroups
                  : [])
                : await fetchBatchAdjustActivityDetailLookupForShop(
                  warmedSessionContext,
                  shopGroup,
                  {
                    runId,
                    totalShops: summary.totalShops,
                    completedShops: summary.completedShops,
                    failedShops: summary.failedShops,
                    emitProgress: progressEmitter,
                    queryJob: runHandle,
                    shopRequestState
                  }
                );
              let normalizedActivityAdjustGroups = activityAdjustGroups;

              if (itemRequestsToUse.length <= 0) {
                const activityPreparedGroups = await prepareBatchAdjustActivitySubmitGroups(
                  shopGroup && shopGroup.rows,
                  activityAdjustGroups,
                  reasonRowIdMap,
                  normalizedPayload.settings,
                  submitHistoryState.payload
                );

                normalizedActivityAdjustGroups = activityPreparedGroups.adjustGroups;
                summary.requestedActivityCount += activityPreparedGroups.requestedActivityCount;
              } else {
                summary.requestedActivityCount += shopLocalActivityEligibleCount;
              }

              if (Array.isArray(normalizedActivityAdjustGroups) && normalizedActivityAdjustGroups.length > 0) {
                const activitySubmitResult = await submitBatchAdjustGroupChunks({
                  warmedSessionContext,
                  adjustReason,
                  remark,
                  adjustGroups: normalizedActivityAdjustGroups,
                  submitKind: 'activity',
                  shopGroup,
                  summary,
                  rowUpdateMap,
                  failedShopMessages,
                  progressEmitter,
                  reasonRowIdMap,
                  runId,
                  submitHistoryState,
                  runHandle,
                  shopRequestState
                });

                if (activitySubmitResult && activitySubmitResult.hadFailure === true) {
                  shopHadFailure = true;
                }
              }
            } catch (error) {
              if (isBatchAdjustCanceledError(error)) {
                throw error;
              }

              shopHadFailure = true;
              summary.failedActivityCount += shopLocalActivityEligibleCount;
              shopFailureMessage = normalizeText(error && error.message) || shopFailureMessage;
              failedShopMessages.push(
                `${shopName}(\u6d3b\u52a8)\uff1a${shopFailureMessage || '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25'}`
              );
              logError('operations_new_product_lifecycle_batch_adjust_activity_shop_failed', error, {
                runId,
                shopId,
                activityEligibleCount: shopLocalActivityEligibleCount
              });
            }
          }

          if (shopHadFailure === true) {
            shopFailureMessage = shopFailureMessage || '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25';
          }
        } catch (error) {
          if (isBatchAdjustCanceledError(error)) {
            throw error;
          }

          shopHadFailure = true;
          shopFailureMessage = normalizeText(error && error.message) || shopFailureMessage || '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25';
          summary.failedDailyCount += shopLocalDailyEligibleCount;
          summary.failedActivityCount += shopLocalActivityEligibleCount;
          failedShopMessages.push(
            `${shopName}\uff1a${shopFailureMessage}`
          );
          logError('operations_new_product_lifecycle_batch_adjust_submit_shop_failed', error, {
            runId,
            shopId,
            dailyEligibleCount: shopLocalDailyEligibleCount,
            activityEligibleCount: shopLocalActivityEligibleCount
          });
        }

        if (shopHadFailure === true) {
          summary.failedShops += 1;
          emitBatchAdjustSubmitProgress({
            runId,
            phase: 'shop-failed',
            totalShops: summary.totalShops,
            completedShops: summary.completedShops,
            failedShops: summary.failedShops,
            requestedDailyCount: summary.requestedDailyCount,
            requestedActivityCount: summary.requestedActivityCount,
            successDailyCount: summary.successDailyCount,
            successActivityCount: summary.successActivityCount,
            failedDailyCount: summary.failedDailyCount,
            failedActivityCount: summary.failedActivityCount,
            skippedRowCount: countBatchAdjustSkippedRows(reasonRowIdMap),
            currentShopId: shopId,
            currentShopName: shopName,
            message: `${shopName}\uff1a${shopFailureMessage || '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25'}`
          }, progressEmitter);
        } else {
          summary.completedShops += 1;
          emitBatchAdjustSubmitProgress({
            runId,
            phase: 'shop-completed',
            totalShops: summary.totalShops,
            completedShops: summary.completedShops,
            failedShops: summary.failedShops,
            requestedDailyCount: summary.requestedDailyCount,
            requestedActivityCount: summary.requestedActivityCount,
            successDailyCount: summary.successDailyCount,
            successActivityCount: summary.successActivityCount,
            failedDailyCount: summary.failedDailyCount,
            failedActivityCount: summary.failedActivityCount,
            skippedRowCount: countBatchAdjustSkippedRows(reasonRowIdMap),
            currentShopId: shopId,
            currentShopName: shopName,
            message: `${shopName}\uff1a\u5df2\u5b8c\u6210`
          }, progressEmitter);
        }
        });
      } catch (error) {
        if (isBatchAdjustCanceledError(error)) {
          summary.canceled = true;
        } else {
          throw error;
        }
      }

    summary.updatedAt = nowIso();
    summary.rowUpdates = Array.from(rowUpdateMap.values());

    if (submitHistoryState.changed === true && summary.canceled !== true) {
      try {
        const saveHistoryResult = await saveBatchAdjustSubmitHistorySnapshot(submitHistoryState.payload);

        if (saveHistoryResult && saveHistoryResult.payload) {
          submitHistoryState.payload = saveHistoryResult.payload;
        }

        if (normalizeText(saveHistoryResult && saveHistoryResult.warning)) {
          logError(
            'operations_new_product_lifecycle_save_batch_adjust_submit_history_warning',
            new Error(saveHistoryResult.warning),
            {
              runId
            }
          );
        }
      } catch (error) {
        logError('operations_new_product_lifecycle_save_batch_adjust_submit_history_failed', error, {
          runId
        });
      }
    }

    summary.skippedReasonCounts = buildBatchAdjustSkipReasonCounts(reasonRowIdMap);
    summary.skippedRowCount = countBatchAdjustSkippedRows(reasonRowIdMap);
    summary.warning = buildBatchAdjustWarning(
      summary.skippedReasonCounts,
      summary,
      failedShopMessages
    );

    emitBatchAdjustSubmitProgress({
      runId,
      phase: summary.canceled === true ? 'canceled' : 'completed',
      totalShops: summary.totalShops,
      completedShops: summary.completedShops,
      failedShops: summary.failedShops,
      requestedDailyCount: summary.requestedDailyCount,
      requestedActivityCount: summary.requestedActivityCount,
      successDailyCount: summary.successDailyCount,
      successActivityCount: summary.successActivityCount,
      failedDailyCount: summary.failedDailyCount,
      failedActivityCount: summary.failedActivityCount,
      skippedRowCount: summary.skippedRowCount,
      message: summary.canceled === true
        ? '\u5df2\u505c\u6b62\u4efb\u52a1'
        : (
          summary.warning
            ? '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5b8c\u6210\uff0c\u5b58\u5728\u90e8\u5206\u8df3\u8fc7\u6216\u5931\u8d25\u8bb0\u5f55'
            : '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5b8c\u6210'
        )
    }, progressEmitter);

    log('operations_new_product_lifecycle_batch_adjust_submit_completed', {
      runId,
      totalRowCount: summary.totalRowCount,
      totalShops: summary.totalShops,
      completedShops: summary.completedShops,
      failedShops: summary.failedShops,
      requestedDailyCount: summary.requestedDailyCount,
      requestedActivityCount: summary.requestedActivityCount,
      successDailyCount: summary.successDailyCount,
      successActivityCount: summary.successActivityCount,
      failedDailyCount: summary.failedDailyCount,
      failedActivityCount: summary.failedActivityCount,
      skippedRowCount: summary.skippedRowCount,
      canceled: summary.canceled === true
    });

    if (
      usedPreviewRequestCache === true
      && summary.canceled !== true
      && (summary.successDailyCount > 0 || summary.successActivityCount > 0)
    ) {
      clearBatchAdjustPreviewPreparedRequests(normalizedPayload.previewRequestToken);
    }

    return summary;
  } finally {
    clearBatchAdjustRunHandle(runHandle);
  }
  }

  async function queryRows(payload = {}, options = {}) {
    const queryJob = createQueryJob(payload, options);
    const runId = normalizeText(queryJob && queryJob.runId);
    const savedSettingsResult = await getQuerySettings();
    const filters = normalizeFilters(buildSettingsBackfillFilters(
      payload && payload.filters,
      savedSettingsResult && savedSettingsResult.settings
    ));
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const requestedShopIds = normalizeSelectedShopIds(
      payload && payload.shopIds || filters.selectedShopIds
    );

    try {
      const shopSummaries = await resolveShopSummaries(requestedShopIds);

      if (shopSummaries.length <= 0) {
        throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u67e5\u8be2\u4e0a\u65b0\u751f\u547d\u5468\u671f\u3002');
      }

      buildQueryRequestPayload(filters, 1);
      emitQueryProgress({
        runId,
        phase: 'preparing',
        totalShops: shopSummaries.length,
        message: `\u5df2\u9009 ${shopSummaries.length} \u5bb6\u5e97\u94fa\uff0c\u6b63\u5728\u5e76\u53d1\u67e5\u8be2`
      }, progressEmitter);

      const sharedCostLookup = await buildSharedCostLookup(
        shopSummaries.map((shopSummary) => normalizeText(shopSummary && shopSummary.shopId))
      );
      const shopResults = await Promise.all(
        shopSummaries.map(async (shopSummary) => {
          try {
            assertQueryJobActive(queryJob);

            const result = await querySingleShopRows({
              shopSummary,
              filters,
              queryJob,
              runId,
              emitProgress: progressEmitter
            });

            return {
              status: 'completed',
              shopSummary,
              result
            };
          } catch (error) {
            if (isQueryCanceledError(error)) {
              return {
                status: 'canceled',
                shopSummary,
                partialResult: error && error.partialResult ? error.partialResult : null
              };
            }

            const shopName = normalizeText(shopSummary && shopSummary.shopName) || normalizeText(shopSummary && shopSummary.shopId);

            logError('operations_new_product_lifecycle_shop_query_failed', error, {
              shopId: normalizeText(shopSummary && shopSummary.shopId),
              shopName,
              runId
            });

            return {
              status: 'failed',
              shopSummary,
              error
            };
          }
        })
      );
      const rows = [];
      const failedShopNames = [];
      const failedShopDetails = [];
      const requestPreviewByShop = [];
      let total = 0;
      let completedShops = 0;
      let canceledShops = 0;

      shopResults.forEach((shopResult) => {
        const shopSummary = shopResult && shopResult.shopSummary ? shopResult.shopSummary : null;

        if (shopResult && shopResult.status === 'completed') {
          const result = shopResult.result;

          rows.push(...(Array.isArray(result && result.rows) ? result.rows : []));
          total += normalizeIntegerValue(result && result.total, 0);
          completedShops += 1;
          requestPreviewByShop.push({
            shopId: normalizeText(shopSummary && shopSummary.shopId),
            shopName: normalizeText(shopSummary && shopSummary.shopName),
            mallId: normalizeText(result && result.mallId),
            payloads: Array.isArray(result && result.requestPreview) ? result.requestPreview : []
          });
          return;
        }

        if (shopResult && shopResult.status === 'canceled') {
          const partialResult = shopResult.partialResult;

          canceledShops += 1;

          if (partialResult) {
            rows.push(...(Array.isArray(partialResult.rows) ? partialResult.rows : []));
            total += normalizeIntegerValue(partialResult && partialResult.total, 0);
            requestPreviewByShop.push({
              shopId: normalizeText(shopSummary && shopSummary.shopId),
              shopName: normalizeText(shopSummary && shopSummary.shopName),
              mallId: normalizeText(partialResult && partialResult.mallId),
              payloads: Array.isArray(partialResult && partialResult.requestPreview)
                ? partialResult.requestPreview
                : []
            });
          }

          return;
        }

        if (shopResult && shopResult.status === 'failed') {
          const failedShopName = normalizeText(shopSummary && shopSummary.shopName) || normalizeText(shopSummary && shopSummary.shopId);
          const failedMessage = normalizeShopQueryFailureMessage(shopResult.error);

          failedShopNames.push(failedShopName);
          failedShopDetails.push({
            shopId: normalizeText(shopSummary && shopSummary.shopId),
            shopName: failedShopName,
            message: failedMessage
          });
        }
      });

      const canceled = canceledShops > 0 || queryJob.canceled === true;

      if (completedShops <= 0 && rows.length <= 0 && failedShopNames.length > 0 && canceled !== true) {
        const failedDetailText = failedShopDetails.length > 0
          ? failedShopDetails.map((item) => `${item.shopName}\uff1a${item.message}`).join('\uff1b')
          : failedShopNames.join('\u3001');

        throw new Error(`\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u5931\u8d25\uff1a${failedDetailText}`);
      }

      const nextRows = sortRows(applySharedCostLookupToRows(rows, sharedCostLookup));
      const warningParts = [];

      if (failedShopNames.length > 0) {
        const failedDetailText = failedShopDetails.length > 0
          ? failedShopDetails.map((item) => `${item.shopName}\uff1a${item.message}`).join('\uff1b')
          : failedShopNames.join('\u3001');

        warningParts.push(`\u4ee5\u4e0b\u5e97\u94fa\u67e5\u8be2\u5931\u8d25\uff1a${failedDetailText}`);
      }

      if (canceled === true) {
        warningParts.push('\u67e5\u8be2\u5df2\u505c\u6b62\uff0c\u5df2\u8fd4\u56de\u5f53\u524d\u5df2\u83b7\u53d6\u7684\u6570\u636e');
      }

      const warning = warningParts.join('\uff1b');

      log('operations_new_product_lifecycle_query_succeeded', {
        runId,
        shopCount: shopSummaries.length,
        completedShops,
        failedShops: failedShopNames.length,
        failedShopDetails,
        canceledShops,
        canceled,
        rowCount: nextRows.length,
        total,
        requestPreviewByShop
      });

      return {
        updatedAt: nowIso(),
        runId,
        rowCount: nextRows.length,
        productCount: countDistinctProducts(nextRows),
        total,
        totalShops: shopSummaries.length,
        completedShops,
        failedShops: failedShopNames.length,
        failedShopDetails,
        canceledShops,
        canceled,
        rows: nextRows,
        requestPreviewByShop,
        warning
      };
    } finally {
      clearQueryJob(queryJob);
    }
  }

  async function cancelQueryJob(payload = {}, options = {}) {
    const job = getQueryJob(payload, options);

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

  function createPriceDeclRunHandle(payload = {}) {
    const runId = normalizeText(payload && payload.runId) || `npl_price_decl_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const existingRun = activePriceDeclRunsByRunId.get(runId);

    if (existingRun && existingRun.canceled !== true) {
      throw new Error('\u5f53\u524d\u6838\u4ef7\u4efb\u52a1\u6807\u8bc6\u5df2\u5728\u4f7f\u7528\uff0c\u8bf7\u91cd\u8bd5');
    }

    const runHandle = {
      runId,
      canceled: false,
      activeControllers: new Set(),
      activeDelayCancels: new Set()
    };

    activePriceDeclRunsByRunId.set(runId, runHandle);
    return runHandle;
  }

  function getPriceDeclRunHandle(payload = {}) {
    const runId = normalizeText(payload && payload.runId);

    if (!runId) {
      return null;
    }

    return activePriceDeclRunsByRunId.get(runId) || null;
  }

  function clearPriceDeclRunHandle(runHandle) {
    if (!runHandle) {
      return;
    }

    if (
      runHandle.runId
      && activePriceDeclRunsByRunId.get(runHandle.runId) === runHandle
    ) {
      activePriceDeclRunsByRunId.delete(runHandle.runId);
    }
  }

  async function previewBatchPriceDeclaration(payload = {}) {
    const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
    const settings = payload && payload.settings && typeof payload.settings === 'object' ? payload.settings : {};
    const runHandle = createPriceDeclRunHandle(payload);
    const runId = normalizeText(runHandle && runHandle.runId);

    try {

      if (rows.length <= 0) {
        clearPriceDeclRunHandle(runHandle);
        return { success: false, runId, message: '没有可处理的商品', previewItems: [], groupedRequests: [], summary: { total: 0, approve: 0, redeclare: 0, void: 0, skip: 0 }, resultsByShop: [] };
      }

    const approveUseCostPrice = Boolean(settings.approveUseCostPrice);
    const approveCondition = normalizeText(settings.approveCondition) || 'profitRate';
    const approveValue = Number(settings.approveValue) || 0;
    const fallbackApproveRules = normalizePriceDeclFallbackApproveRuleList(
      settings.fallbackApproveRules
    ).filter((rule) => hasConfiguredPriceDeclFallbackApproveRule(rule));
    const approveReduceType = normalizeText(settings.approveReduceType) || 'discount';
    const approveReduceValue = Number(settings.approveReduceValue) || 0;
    const voidMaxAttempts = Number(settings.voidMaxAttempts) || 3;

    if (approveUseCostPrice !== true) {
      clearPriceDeclRunHandle(runHandle);
      return {
        success: false,
        runId,
        message: '\u8bf7\u5148\u52fe\u9009\u201c\u4ee5\u6210\u672c\u4ef7\u4e3a\u57fa\u7840\u8ba1\u7b97\u201d',
        previewItems: [],
        groupedRequests: [],
        summary: { total: 0, approve: 0, redeclare: 0, void: 0, skip: 0 },
        resultsByShop: []
      };
    }

    const shopGroups = groupBatchAdjustRowsByShop(rows);
    const previewItems = [];
    let hasError = false;
    const resultsByShop = [];
    let canceled = false;
    let aggregatedFailedQueryChunkCount = 0;
    let aggregatedQueryChunkCount = 0;
    let firstFailedQueryChunkMessage = '';
    for (const shopGroup of shopGroups) {
        if (runHandle.canceled === true) {
          canceled = true;
          break;
        }
      const shopId = normalizeText(shopGroup && shopGroup.shopId);
      const shopName = normalizeText(shopGroup && shopGroup.shopName) || shopId;
      if (!shopId) { hasError = true; continue; }

      let sessionContext, warmedSessionContext;
      try {
        sessionContext = await resolveShopSessionContext({ shopId, shopName });
        warmedSessionContext = await warmupSellerSessionContext(sessionContext, { timeoutMs: 60000 });
      } catch (error) {
        resultsByShop.push({ shopId, shopName, success: false, message: normalizeText(error && error.message) || '\u5e97\u94fa\u4f1a\u8bdd\u9884\u70ed\u5931\u8d25' });
        hasError = true;
        continue;
      }

      if (runHandle.canceled === true) {
        resultsByShop.push({ shopId, shopName, success: false, message: '\u5df2\u505c\u6b62\u4efb\u52a1' });
        canceled = true;
        break;
      }

      const orderIds = normalizePriceDeclOrderIdList(
        (Array.isArray(shopGroup.rows) ? shopGroup.rows : []).map((row) => {
          const priceOrderId = normalizeText(row && row.priceOrderId);
          return /^\d+$/.test(priceOrderId) ? Number(priceOrderId) : 0;
        })
      );
      if (orderIds.length <= 0) {
        resultsByShop.push({ shopId, shopName, success: false, message: '\u8be5\u5e97\u94fa\u7684\u5546\u54c1\u7f3a\u5c11\u6838\u4ef7\u5355ID\uff0c\u8bf7\u5148\u540c\u6b65\u67e5\u8be2\u6570\u636e' });
        hasError = true;
        continue;
      }

      let priceDeclQueryResult;
      try {
        priceDeclQueryResult = await queryPriceDeclReviewItemsByOrderIdChunks({
          sessionContext: warmedSessionContext,
          orderIds,
          queryJob: runHandle,
          timeoutMs: 30000,
          timeoutMessage: '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
          defaultErrorMessage: '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u5931\u8d25',
          refererPath: '/newon/product-select',
          allowPartial: true,
          maxRetries: PRICE_DECL_QUERY_RETRY_TIMES,
          retryDelayMs: PRICE_DECL_QUERY_RETRY_DELAY_MS
        });
      } catch (error) {
        if (isQueryCanceledError(error) || runHandle.canceled === true) {
          canceled = true;
          break;
        }
        resultsByShop.push({ shopId, shopName, success: false, message: normalizeText(error && error.message) || '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u5931\u8d25' });
        hasError = true;
        continue;
      }

      if (runHandle.canceled === true) {
        resultsByShop.push({ shopId, shopName, success: false, message: '\u5df2\u505c\u6b62\u4efb\u52a1' });
        canceled = true;
        break;
      }

      const priceReviewItemList = Array.isArray(priceDeclQueryResult && priceDeclQueryResult.items)
        ? priceDeclQueryResult.items
        : [];
      const failedQueryChunkCount = Number(priceDeclQueryResult && priceDeclQueryResult.failedChunks) || 0;
      const shopQueryChunkCount = Number(priceDeclQueryResult && priceDeclQueryResult.totalChunks) || 0;
      const failedQueryChunkDetails = Array.isArray(priceDeclQueryResult && priceDeclQueryResult.failedChunkDetails)
        ? priceDeclQueryResult.failedChunkDetails
        : [];
      aggregatedFailedQueryChunkCount += failedQueryChunkCount;
      aggregatedQueryChunkCount += shopQueryChunkCount;
      if (!firstFailedQueryChunkMessage && failedQueryChunkDetails.length > 0) {
        firstFailedQueryChunkMessage = normalizeText(
          failedQueryChunkDetails[0] && (
            failedQueryChunkDetails[0].firstMessage
            || failedQueryChunkDetails[0].message
          )
        );
      }
      if (priceReviewItemList.length <= 0) {
        const chunkFailureMessage = failedQueryChunkCount > 0
          ? `\u6838\u4ef7\u4fe1\u606f\u5206\u6279\u67e5\u8be2\u5931\u8d25 ${failedQueryChunkCount}/${shopQueryChunkCount} \u6279\uff08\u6bcf\u6279\u5df2\u81ea\u52a8\u91cd\u8bd5 ${PRICE_DECL_QUERY_RETRY_TIMES} \u6b21\uff09\uff0c${normalizeText(failedQueryChunkDetails[0] && (failedQueryChunkDetails[0].firstMessage || failedQueryChunkDetails[0].message)) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`
          : '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u7ed3\u679c\u4e3a\u7a7a';
        resultsByShop.push({ shopId, shopName, success: false, message: chunkFailureMessage });
        hasError = true;
        continue;
      }

      if (failedQueryChunkCount > 0) {
        hasError = true;
      }

      // Build cost price lookup maps
      const skuCostMap = new Map();
      const skcCostMap = new Map();
      const skuRowMetaMap = new Map();
      const skcRowMetaMap = new Map();
      (Array.isArray(shopGroup.rows) ? shopGroup.rows : []).forEach((row) => {
        const productSkuId = normalizeText(row && (row.productSkuId || row.skuId));
        const skcId = normalizeText(row && row.skcId);
        const costPrice = Number(row && row.costPrice);
        const rowMeta = {
          productName: normalizeText(row && (row.productName || row.productTitle)),
          spec: normalizeText(row && row.spec),
          declaredPriceCent: resolvePriceDeclDeclaredPriceCentFromRow(row)
        };
        if (productSkuId && Number.isFinite(costPrice) && costPrice > 0) {
          if (!skuCostMap.has(productSkuId)) skuCostMap.set(productSkuId, costPrice);
        }
        if (skcId && Number.isFinite(costPrice) && costPrice > 0) {
          if (!skcCostMap.has(skcId)) skcCostMap.set(skcId, costPrice);
        }
        if (productSkuId && !skuRowMetaMap.has(productSkuId)) {
          skuRowMetaMap.set(productSkuId, rowMeta);
        }
        if (skcId && !skcRowMetaMap.has(skcId)) {
          skcRowMetaMap.set(skcId, rowMeta);
        }
      });

      // Process each SKU
      for (const item of priceReviewItemList) {
        if (runHandle.canceled === true) {
          canceled = true;
          break;
        }

        const priceOrderId = item && item.id;
        if (!priceOrderId) continue;

        const reviewTimes = Number(item && item.reviewTimes) || 0;
        const itemSkcId = normalizeText(item && item.skcId);
        const skuInfoList = Array.isArray(item && item.skuInfoList) ? item.skuInfoList : [];
        if (skuInfoList.length <= 0) continue;

        for (const sku of skuInfoList) {
          if (runHandle.canceled === true) {
            canceled = true;
            break;
          }

          const productSkuId = sku && sku.productSkuId;
          if (!productSkuId) continue;

          const skuSuggestPrice = Number(sku && sku.suggestSupplyPrice)
            || Number(item && item.suggestSupplyPrice)
            || 0;
          if (skuSuggestPrice <= 0) continue;

          const normalizedProductSkuId = normalizeText(productSkuId);
          const costPriceFromSku = skuCostMap.get(normalizedProductSkuId);
          const costPriceFromSkc = skcCostMap.get(itemSkcId);
          const rowMeta = skuRowMetaMap.get(normalizedProductSkuId)
            || skcRowMetaMap.get(itemSkcId)
            || {};
          const declaredPriceCent = resolvePriceDeclDeclaredPriceCentFromReviewData(
            sku,
            item,
            rowMeta && rowMeta.declaredPriceCent
          );
          const costPriceYuan = costPriceFromSku || costPriceFromSkc || 0;
          const {
            profitValue,
            profitRate
          } = computePriceDeclProfitMetrics(skuSuggestPrice, costPriceYuan);
          const fallbackApproveDecision = resolvePriceDeclFallbackApproveDecision(
            fallbackApproveRules,
            reviewTimes,
            profitValue,
            profitRate
          );

          let supplierResult;
          let submitPrice = 0;
          let skipReason = '';
          let meetsApproveCondition = false;
          let approveSource = '';
          let approveDetail = '';

          if (approveUseCostPrice) {
            if (costPriceYuan <= 0) {
              previewItems.push(buildPriceDeclPreviewItem({ shopId, shopName, priceOrderId, productSkuId, skcId: itemSkcId, productName: rowMeta.productName, spec: rowMeta.spec, skuSuggestPrice, declaredPriceCent, costPriceYuan, profitValue, profitRate, reviewTimes, supplierResult: null, submitPrice: 0, meetsApproveCondition: false, skipReason: '\u7f3a\u5c11\u6210\u672c\u4ef7' }));
              continue;
            }

            meetsApproveCondition = approveCondition === 'profitRate'
              ? profitRate >= approveValue
              : profitValue >= approveValue;

            if (meetsApproveCondition) {
              supplierResult = 1;
              submitPrice = skuSuggestPrice;
              approveSource = 'primary';
              approveDetail = buildPriceDeclPrimaryApproveDetail(
                approveCondition,
                approveValue
              );
            } else if (fallbackApproveDecision.matched) {
              meetsApproveCondition = true;
              supplierResult = 1;
              submitPrice = skuSuggestPrice;
              approveSource = 'fallback';
              approveDetail = buildPriceDeclFallbackApproveDetail(
                fallbackApproveDecision
              );
            } else if (reviewTimes >= voidMaxAttempts) {
              supplierResult = 3;
            } else {
              supplierResult = 2;
              if (declaredPriceCent <= 0) {
                previewItems.push(buildPriceDeclPreviewItem({ shopId, shopName, priceOrderId, productSkuId, skcId: itemSkcId, productName: rowMeta.productName, spec: rowMeta.spec, skuSuggestPrice, declaredPriceCent, costPriceYuan, profitValue, profitRate, reviewTimes, supplierResult: null, submitPrice: 0, meetsApproveCondition: false, skipReason: '\u7f3a\u5c11\u539f\u7533\u62a5\u4ef7' }));
                continue;
              }
              submitPrice = computePriceDeclRedeclareSubmitPrice(
                declaredPriceCent,
                approveReduceType,
                approveReduceValue
              );
              if (submitPrice <= 0) {
                previewItems.push(buildPriceDeclPreviewItem({ shopId, shopName, priceOrderId, productSkuId, skcId: itemSkcId, productName: rowMeta.productName, spec: rowMeta.spec, skuSuggestPrice, declaredPriceCent, costPriceYuan, profitValue, profitRate, reviewTimes, supplierResult: null, submitPrice: 0, meetsApproveCondition: false, skipReason: '\u91cd\u65b0\u6838\u4ef7\u8ba1\u7b97\u4ef7\u683c\u65e0\u6548' }));
                continue;
              }
            }
          }
          previewItems.push(buildPriceDeclPreviewItem({ shopId, shopName, priceOrderId, productSkuId, skcId: itemSkcId, productName: rowMeta.productName, spec: rowMeta.spec, skuSuggestPrice, declaredPriceCent, costPriceYuan, profitValue, profitRate, reviewTimes, supplierResult, submitPrice, meetsApproveCondition, approveSource, approveDetail, skipReason }));
        }
      }
      if (runHandle.canceled === true) {
        resultsByShop.push({ shopId, shopName, success: false, message: '\u5df2\u505c\u6b62\u4efb\u52a1' });
        canceled = true;
        break;
      }
      const previewSkuCount = previewItems.filter((i) => i.shopId === shopId).length;
      const shopPreviewMessage = failedQueryChunkCount > 0
        ? `\u90e8\u5206\u9884\u89c8\u5b8c\u6210\uff0c${previewSkuCount} \u4e2aSKU\uff1b\u5206\u6279\u67e5\u8be2\u5931\u8d25 ${failedQueryChunkCount}/${shopQueryChunkCount} \u6279\uff08\u6bcf\u6279\u5df2\u81ea\u52a8\u91cd\u8bd5 ${PRICE_DECL_QUERY_RETRY_TIMES} \u6b21\uff09${normalizeText(failedQueryChunkDetails[0] && (failedQueryChunkDetails[0].firstMessage || failedQueryChunkDetails[0].message)) ? `\uff1b\u9996\u4e2a\u5931\u8d25\u539f\u56e0\uff1a${normalizeText(failedQueryChunkDetails[0] && (failedQueryChunkDetails[0].firstMessage || failedQueryChunkDetails[0].message))}` : ''}`
        : `\u9884\u89c8\u5b8c\u6210\uff0c${previewSkuCount} \u4e2aSKU`;
      resultsByShop.push({ shopId, shopName, success: true, message: shopPreviewMessage });
    }

    const summary = {
      total: previewItems.length,
      approve: previewItems.filter((i) => i.supplierResult === 1).length,
      redeclare: previewItems.filter((i) => i.supplierResult === 2).length,
      void: previewItems.filter((i) => i.supplierResult === 3).length,
      skip: previewItems.filter((i) => i.supplierResult === null || i.supplierResult === undefined).length
    };

    const groupedRequests = buildPriceDeclGroupedRequests(previewItems);
    const warning = aggregatedFailedQueryChunkCount > 0
      ? `\u5206\u6279\u67e5\u8be2\u4ecd\u6709 ${aggregatedFailedQueryChunkCount}/${aggregatedQueryChunkCount} \u6279\u5931\u8d25\uff08\u6bcf\u6279\u5df2\u81ea\u52a8\u91cd\u8bd5 ${PRICE_DECL_QUERY_RETRY_TIMES} \u6b21\uff09${firstFailedQueryChunkMessage ? `\uff1b\u9996\u4e2a\u5931\u8d25\u539f\u56e0\uff1a${firstFailedQueryChunkMessage}` : ''}`
      : '';

      clearPriceDeclRunHandle(runHandle);

      return {
        success: !canceled && (!hasError || previewItems.length > 0),
        runId,
        message: canceled ? '\u5df2\u505c\u6b62\u4efb\u52a1' : hasError && previewItems.length <= 0 ? '\u9884\u89c8\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u65e5\u5fd7' : '',
        warning,
        previewItems,
        groupedRequests,
        summary,
        resultsByShop,
        canceled
      };
    } finally {
      clearPriceDeclRunHandle(runHandle);
    }
  }

  function buildPriceDeclPreviewItem({ shopId, shopName, priceOrderId, productSkuId, skcId, productName, spec, skuSuggestPrice, declaredPriceCent, costPriceYuan, profitValue, profitRate, reviewTimes, supplierResult, submitPrice, meetsApproveCondition, approveSource, approveDetail, skipReason }) {
    return {
      shopId: normalizeText(shopId),
      shopName: normalizeText(shopName),
      priceOrderId: Number(priceOrderId) || 0,
      productSkuId: normalizeText(productSkuId),
      skcId: normalizeText(skcId),
      productName: normalizeText(productName),
      spec: normalizeText(spec),
      declaredPrice: (Number(declaredPriceCent) || 0) / 100,
      suggestPrice: Number(skuSuggestPrice) || 0,
      costPrice: Number(costPriceYuan) || 0,
      profitValue: Number.isFinite(profitValue) ? Math.round(profitValue * 100) / 100 : 0,
      profitRate: Number.isFinite(profitRate) ? Math.round(profitRate * 100) / 100 : 0,
      reviewTimes: Number(reviewTimes) || 0,
      supplierResult: Number.isFinite(supplierResult) ? supplierResult : null,
      submitPrice: Number(submitPrice) || 0,
      meetsApproveCondition: Boolean(meetsApproveCondition),
      approveSource: normalizeText(approveSource),
      approveDetail: normalizeText(approveDetail),
      skipReason: normalizeText(skipReason)
    };
  }

  function buildPriceDeclGroupedRequests(previewItems) {
    const orderSkuGroups = new Map();
    for (const item of previewItems) {
      if (item.supplierResult === null || item.supplierResult === undefined) continue;
      const shopId = normalizeText(item.shopId);
      const pid = item.priceOrderId;
      const result = item.supplierResult;
      const groupKey = `${shopId}::${pid}`;
      if (!orderSkuGroups.has(groupKey)) {
        orderSkuGroups.set(groupKey, {
          shopId,
          priceOrderId: pid,
          groupMap: new Map()
        });
      }
      const shopGroup = orderSkuGroups.get(groupKey);
      const groupMap = shopGroup.groupMap;
      if (!groupMap.has(result)) groupMap.set(result, []);
      const entry = result === 3
        ? { productSkuId: item.productSkuId }
        : { productSkuId: item.productSkuId, price: item.submitPrice };
      groupMap.get(result).push(entry);
    }

    const itemRequests = [];
    for (const shopGroup of orderSkuGroups.values()) {
      const { shopId, priceOrderId: pid, groupMap } = shopGroup;
      for (const [result, items] of groupMap) {
        itemRequests.push({
          requestKey: buildPriceDeclRequestKey(shopId, pid, result),
          shopId,
          priceOrderId: pid,
          supplierResult: result,
          items
        });
      }
    }
    return itemRequests;
  }

  function buildPriceDeclRequestKey(shopId, priceOrderId, supplierResult) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedPriceOrderId = Number(priceOrderId) || 0;
    const normalizedSupplierResult = Number(supplierResult) || 0;

    if (!normalizedShopId || normalizedPriceOrderId <= 0 || normalizedSupplierResult <= 0) {
      return '';
    }

    return `${normalizedShopId}::${normalizedPriceOrderId}::${normalizedSupplierResult}`;
  }

  function normalizePriceDeclSubmitItemRequests(itemRequests, fallbackShopId = '') {
    const normalizedFallbackShopId = normalizeText(fallbackShopId);

    return (Array.isArray(itemRequests) ? itemRequests : [])
      .map((request) => ({
        requestKey: buildPriceDeclRequestKey(
          normalizeText(request && request.shopId) || normalizedFallbackShopId,
          request && request.priceOrderId,
          request && request.supplierResult
        ),
        shopId: normalizeText(request && request.shopId) || normalizedFallbackShopId,
        priceOrderId: Number(request && request.priceOrderId) || 0,
        supplierResult: Number(request && request.supplierResult) || 0,
        items: Array.isArray(request && request.items)
          ? request.items
            .map((item) => {
              const productSkuId = normalizeText(item && item.productSkuId);
              if (!productSkuId) {
                return null;
              }

              if (Number(request && request.supplierResult) === 3) {
                return { productSkuId };
              }

              const price = Number(item && item.price) || 0;
              return price > 0
                ? { productSkuId, price }
                : null;
            })
            .filter(Boolean)
          : []
      }))
      .filter((request) => (
        request.requestKey
        && request.priceOrderId > 0
        && request.supplierResult > 0
        && request.items.length > 0
      ));
  }

  function sanitizePriceDeclApiItemRequests(itemRequests) {
    return (Array.isArray(itemRequests) ? itemRequests : []).map((request) => ({
      priceOrderId: Number(request && request.priceOrderId) || 0,
      supplierResult: Number(request && request.supplierResult) || 0,
      items: Array.isArray(request && request.items)
        ? request.items.map((item) => {
          if (Number(request && request.supplierResult) === 3) {
            return {
              productSkuId: normalizeText(item && item.productSkuId)
            };
          }

          return {
            productSkuId: normalizeText(item && item.productSkuId),
            price: Number(item && item.price) || 0
          };
        })
        : []
    }));
  }

  function normalizePriceDeclSubmitResponseEntries(batchOperateResult) {
    if (!batchOperateResult || typeof batchOperateResult !== 'object') {
      return [];
    }

    if (Array.isArray(batchOperateResult)) {
      return batchOperateResult.map((entry, index) => ({
        entryKey: String(index),
        entry,
        index
      }));
    }

    return Object.keys(batchOperateResult).map((entryKey, index) => ({
      entryKey: normalizeText(entryKey),
      entry: batchOperateResult[entryKey],
      index
    }));
  }

  function resolvePriceDeclSubmitResponseMessage(entry) {
    return normalizeText(entry && (
      entry.message
      || entry.msg
      || entry.errorMsg
      || entry.failReason
      || entry.reason
    ));
  }

  function resolvePriceDeclSubmitResponseRequestKey(entryKey, entry, fallbackShopId = '') {
    const normalizedFallbackShopId = normalizeText(fallbackShopId);
    const responsePriceOrderId = Number(
      entry && (
        entry.priceOrderId
        || entry.priceBargainNoBomId
        || entry.orderId
        || entry.id
      )
    ) || 0;
    const responseSupplierResult = Number(
      entry && (
        entry.supplierResult
        || entry.resultType
        || entry.operateType
        || entry.reviewResult
      )
    ) || 0;
    const directRequestKey = buildPriceDeclRequestKey(
      normalizedFallbackShopId,
      responsePriceOrderId,
      responseSupplierResult
    );

    if (directRequestKey) {
      return directRequestKey;
    }

    const normalizedEntryKey = normalizeText(entryKey);
    if (!normalizedEntryKey) {
      return '';
    }

    if (normalizedEntryKey.includes('::')) {
      const [maybeShopId, maybePriceOrderId, maybeSupplierResult] = normalizedEntryKey.split('::');
      const requestKeyFromEntryKey = buildPriceDeclRequestKey(
        normalizeText(maybeShopId) || normalizedFallbackShopId,
        maybePriceOrderId,
        maybeSupplierResult
      );
      if (requestKeyFromEntryKey) {
        return requestKeyFromEntryKey;
      }
    }

    const keyMatch = normalizedEntryKey.match(/(\d+)\D+(\d+)/);
    if (keyMatch) {
      const requestKeyFromPattern = buildPriceDeclRequestKey(
        normalizedFallbackShopId,
        keyMatch[1],
        keyMatch[2]
      );
      if (requestKeyFromPattern) {
        return requestKeyFromPattern;
      }
    }

    if (/^\d+$/.test(normalizedEntryKey) && responseSupplierResult > 0) {
      return buildPriceDeclRequestKey(
        normalizedFallbackShopId,
        normalizedEntryKey,
        responseSupplierResult
      );
    }

    return '';
  }

  function collectPriceDeclSubmitRequestOutcomes(requestChunk, batchOperateResult, fallbackShopId = '') {
    const requestList = Array.isArray(requestChunk) ? requestChunk : [];
    const responseEntries = normalizePriceDeclSubmitResponseEntries(batchOperateResult);
    const fallbackMessage = '\u63a5\u53e3\u672a\u8fd4\u56de\u8be5\u5206\u7ec4\u7684\u63d0\u4ea4\u7ed3\u679c';

    if (requestList.length <= 0) {
      return [];
    }

    if (responseEntries.length <= 0) {
      return requestList.map((request) => ({
        request,
        success: false,
        message: fallbackMessage
      }));
    }

    const responseEntryByRequestKey = new Map();
    const usedResponseEntryIndexes = new Set();

    responseEntries.forEach((entryMeta) => {
      const requestKey = resolvePriceDeclSubmitResponseRequestKey(
        entryMeta && entryMeta.entryKey,
        entryMeta && entryMeta.entry,
        fallbackShopId
      );

      if (requestKey && !responseEntryByRequestKey.has(requestKey)) {
        responseEntryByRequestKey.set(requestKey, entryMeta);
      }
    });

    const takeFallbackEntryMeta = (preferredIndex) => {
      if (
        Number.isInteger(preferredIndex)
        && preferredIndex >= 0
        && preferredIndex < responseEntries.length
        && !usedResponseEntryIndexes.has(preferredIndex)
      ) {
        usedResponseEntryIndexes.add(preferredIndex);
        return responseEntries[preferredIndex];
      }

      const fallbackEntryMeta = responseEntries.find((entryMeta) => (
        !usedResponseEntryIndexes.has(entryMeta && entryMeta.index)
      ));

      if (!fallbackEntryMeta) {
        return null;
      }

      usedResponseEntryIndexes.add(fallbackEntryMeta.index);
      return fallbackEntryMeta;
    };

    return requestList.map((request, requestIndex) => {
      const requestKey = normalizeText(request && request.requestKey);
      let matchedEntryMeta = requestKey ? responseEntryByRequestKey.get(requestKey) : null;

      if (matchedEntryMeta && !usedResponseEntryIndexes.has(matchedEntryMeta.index)) {
        usedResponseEntryIndexes.add(matchedEntryMeta.index);
      } else if (matchedEntryMeta) {
        matchedEntryMeta = null;
      }

      if (!matchedEntryMeta && responseEntries.length === requestList.length) {
        matchedEntryMeta = takeFallbackEntryMeta(requestIndex);
      }

      if (!matchedEntryMeta) {
        return {
          request,
          success: false,
          message: fallbackMessage
        };
      }

      const responseEntry = matchedEntryMeta.entry;
      return {
        request,
        success: Boolean(responseEntry && responseEntry.success === true),
        message: resolvePriceDeclSubmitResponseMessage(responseEntry)
      };
    });
  }

  async function submitBatchPriceDeclaration(payload = {}, options = {}) {
    const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
    const settings = payload && payload.settings && typeof payload.settings === 'object' ? payload.settings : {};
    const itemRequestsFromPayload = Array.isArray(payload && payload.itemRequests) ? payload.itemRequests : null;
    const progressEmitter = options && typeof options.emitProgress === 'function'
      ? options.emitProgress
      : null;
    const runId = normalizeText(payload && payload.runId);

    if (rows.length <= 0 && !itemRequestsFromPayload) {
      return { success: false, message: '没有可处理的商品', totalShops: 0, successShops: 0, failedShops: 0, results: [], canceled: false };
    }

    const approveUseCostPrice = Boolean(settings.approveUseCostPrice);
    const approveCondition = normalizeText(settings.approveCondition) || 'profitRate';
    const approveValue = Number(settings.approveValue) || 0;
    const fallbackApproveRules = normalizePriceDeclFallbackApproveRuleList(
      settings.fallbackApproveRules
    ).filter((rule) => hasConfiguredPriceDeclFallbackApproveRule(rule));
    const approveReduceType = normalizeText(settings.approveReduceType) || 'discount';
    const approveReduceValue = Number(settings.approveReduceValue) || 0;
    const voidMaxAttempts = Number(settings.voidMaxAttempts) || 3;

    if (approveUseCostPrice !== true) {
      return {
        success: false,
        message: '\u8bf7\u5148\u52fe\u9009\u201c\u4ee5\u6210\u672c\u4ef7\u4e3a\u57fa\u7840\u8ba1\u7b97\u201d',
        totalShops: 0,
        successShops: 0,
        failedShops: 0,
        results: [],
        canceled: false
      };
    }

    const shopGroups = groupBatchAdjustRowsByShop(rows);
    if (shopGroups.length <= 0) {
      return {
        success: false,
        message: '\u6ca1\u6709\u53ef\u5904\u7406\u7684\u5546\u54c1',
        totalShops: 0,
        successShops: 0,
        failedShops: 0,
        results: [],
        canceled: false
      };
    }
    const results = [];
    let successShops = 0;
    let failedShops = 0;
    let canceled = false;
    let liveSuccessRequests = 0;
    let liveFailedRequests = 0;
    let liveSuccessChunks = 0;
    let liveFailedChunks = 0;
    let liveSuccessSkuCount = 0;
    let liveFailedSkuCount = 0;

    const runHandle = createPriceDeclRunHandle({
      runId
    });

    try {
      const emitSubmitProgress = (progressPayload = {}) => {
      emitPriceDeclSubmitProgress({
        runId,
        totalShops: shopGroups.length,
        completedShops: successShops + failedShops,
        failedShops,
        successRequests: liveSuccessRequests,
        failedRequests: liveFailedRequests,
        successChunks: liveSuccessChunks,
        failedChunks: liveFailedChunks,
        successSkuCount: liveSuccessSkuCount,
        failedSkuCount: liveFailedSkuCount,
        ...progressPayload
      }, progressEmitter);
    };

    const recordShopFailure = (shopId, shopName, message) => {
      results.push({
        shopId,
        shopName,
        success: false,
        message
      });
      failedShops += 1;
      emitSubmitProgress({
        phase: 'shop-failed',
        currentShopId: shopId,
        currentShopName: shopName,
        message: `${shopName || shopId}\uff1a${message}`
      });
    };

    emitSubmitProgress({
      phase: 'preparing',
      message: `\u6b63\u5728\u51c6\u5907\u63d0\u4ea4 ${shopGroups.length} \u5bb6\u5e97\u94fa\u7684\u6279\u91cf\u6838\u4ef7`
    });

    for (const shopGroup of shopGroups) {
      if (runHandle.canceled === true) {
        canceled = true;
        break;
      }

      const shopId = normalizeText(shopGroup && shopGroup.shopId);
      const shopName = normalizeText(shopGroup && shopGroup.shopName) || shopId;

      try {
        if (!shopId) {
          recordShopFailure(shopId, shopName, '\u5e97\u94faID\u4e0d\u80fd\u4e3a\u7a7a');
          continue;
        }

        emitSubmitProgress({
          phase: 'warming-session',
          currentShopId: shopId,
          currentShopName: shopName,
          message: `\u6b63\u5728\u68c0\u67e5 ${shopName} \u7684\u767b\u5f55\u4f1a\u8bdd`
        });

        const sessionContext = await resolveShopSessionContext({ shopId, shopName });
        const warmedSessionContext = await warmupSellerSessionContext(sessionContext, { timeoutMs: 60000 });

        const orderIds = [];
        const seenOrderIds = new Set();

        (Array.isArray(shopGroup.rows) ? shopGroup.rows : []).forEach((row) => {
          const priceOrderId = normalizeText(row && row.priceOrderId);
          if (priceOrderId && /^\d+$/.test(priceOrderId) && !seenOrderIds.has(priceOrderId)) {
            seenOrderIds.add(priceOrderId);
            orderIds.push(Number(priceOrderId));
          }
        });

        if (orderIds.length <= 0) {
          const sampleRow = Array.isArray(shopGroup.rows) ? shopGroup.rows.slice(0, 3) : [];
          if (sampleRow.length > 0) {
            log('operations_new_product_lifecycle_price_decl_missing_order_ids', {
              shopId,
              shopName,
              sampleRows: sampleRow.map((row) => ({
                id: row && row.id,
                priceOrderId: row && row.priceOrderId,
                status: row && row.status
              })),
              sampleKeys: Object.keys(sampleRow[0] || {}).slice(0, 15)
            });
          }

          recordShopFailure(
            shopId,
            shopName,
            '\u8be5\u5e97\u94fa\u7684\u5546\u54c1\u7f3a\u5c11\u6838\u4ef7\u5355ID\uff0c\u8bf7\u5148\u540c\u6b65\u67e5\u8be2\u6570\u636e'
          );
          continue;
        }

        // Skip query+calculation when pre-computed item requests are provided from preview
        let itemRequests;
        let orderSkuGroups = null;

        if (itemRequestsFromPayload) {
          const shopOrderIdSet = new Set(orderIds);
          const hasShopScopedRequests = itemRequestsFromPayload.some((req) => normalizeText(req && req.shopId));
          const hasMissingShopId = itemRequestsFromPayload.some((req) => !normalizeText(req && req.shopId));

          if (hasShopScopedRequests && hasMissingShopId) {
            recordShopFailure(
              shopId,
              shopName,
              '\u9884\u89c8\u6570\u636e\u7f3a\u5c11\u5e97\u94fa\u7ef4\u5ea6\uff0c\u8bf7\u91cd\u65b0\u9884\u89c8'
            );
            continue;
          }

          if (shopGroups.length > 1 && hasShopScopedRequests !== true) {
            recordShopFailure(
              shopId,
              shopName,
              '\u9884\u89c8\u6570\u636e\u7f3a\u5c11\u5e97\u94fa\u7ef4\u5ea6\uff0c\u8bf7\u91cd\u65b0\u9884\u89c8'
            );
            continue;
          }

          itemRequests = itemRequestsFromPayload.filter((req) => {
            const reqPriceOrderId = Number(req && req.priceOrderId) || 0;

            if (!shopOrderIdSet.has(reqPriceOrderId)) {
              return false;
            }

            if (hasShopScopedRequests) {
              return normalizeText(req && req.shopId) === shopId;
            }

            return true;
          });

          if (itemRequests.length <= 0) {
            recordShopFailure(
              shopId,
              shopName,
              '\u8be5\u5e97\u94fa\u6ca1\u6709\u5339\u914d\u7684\u6838\u4ef7\u6570\u636e'
            );
            continue;
          }
        } else {
          emitSubmitProgress({
            phase: 'query-review-items',
            currentShopId: shopId,
            currentShopName: shopName,
            currentChunkIndex: 1,
            totalChunks: Math.max(1, chunkList(orderIds, PRICE_DECL_QUERY_REQUEST_CHUNK_SIZE).length),
            message: `\u6b63\u5728\u83b7\u53d6 ${shopName} \u7684\u6838\u4ef7\u660e\u7ec6`
          });

          // Original flow: Query price review info
          const priceDeclQueryResult = await queryPriceDeclReviewItemsByOrderIdChunks({
            sessionContext: warmedSessionContext,
            orderIds,
            queryJob: runHandle,
            timeoutMs: 30000,
            timeoutMessage: '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
            defaultErrorMessage: '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u5931\u8d25',
            refererPath: '/newon/product-select',
            allowPartial: false,
            maxRetries: PRICE_DECL_QUERY_RETRY_TIMES,
            retryDelayMs: PRICE_DECL_QUERY_RETRY_DELAY_MS
          });

        const priceReviewItemList = Array.isArray(priceDeclQueryResult && priceDeclQueryResult.items)
          ? priceDeclQueryResult.items
          : [];

        if (priceReviewItemList.length <= 0) {
          recordShopFailure(
            shopId,
            shopName,
            '\u6838\u4ef7\u4fe1\u606f\u67e5\u8be2\u7ed3\u679c\u4e3a\u7a7a'
          );
          continue;
        }

        // Step 2: Build cost price lookup maps from eligible rows.
        // Primary: productSkuId -> costPrice (yuan), fallback: skcId -> costPrice.
        const skuCostMap = new Map();
        const skcCostMap = new Map();
        const skuDeclaredPriceMap = new Map();
        const skcDeclaredPriceMap = new Map();

        (Array.isArray(shopGroup.rows) ? shopGroup.rows : []).forEach((row) => {
          const productSkuId = normalizeText(row && (row.productSkuId || row.skuId));
          const skcId = normalizeText(row && row.skcId);
          const costPrice = Number(row && row.costPrice);
          const declaredPriceCent = resolvePriceDeclDeclaredPriceCentFromRow(row);

          if (productSkuId && Number.isFinite(costPrice) && costPrice > 0) {
            if (!skuCostMap.has(productSkuId)) {
              skuCostMap.set(productSkuId, costPrice);
            }
          }
          if (skcId && Number.isFinite(costPrice) && costPrice > 0) {
            if (!skcCostMap.has(skcId)) {
              skcCostMap.set(skcId, costPrice);
            }
          }
          if (productSkuId && declaredPriceCent > 0 && !skuDeclaredPriceMap.has(productSkuId)) {
            skuDeclaredPriceMap.set(productSkuId, declaredPriceCent);
          }
          if (skcId && declaredPriceCent > 0 && !skcDeclaredPriceMap.has(skcId)) {
            skcDeclaredPriceMap.set(skcId, declaredPriceCent);
          }
        });

        // Step 3: Process each SKU individually with its own suggestSupplyPrice,
        //          then group by (priceOrderId, supplierResult)
        orderSkuGroups = new Map();

        for (const item of priceReviewItemList) {
          const priceOrderId = item && item.id;
          if (!priceOrderId) continue;

          const reviewTimes = Number(item && item.reviewTimes) || 0;
          const itemSkcId = normalizeText(item && item.skcId);
          const skuInfoList = Array.isArray(item && item.skuInfoList) ? item.skuInfoList : [];

          if (skuInfoList.length <= 0) continue;

          for (const sku of skuInfoList) {
            const productSkuId = sku && sku.productSkuId;
            if (!productSkuId) continue;

            // Use SKU-level suggestSupplyPrice, fall back to item-level (cents)
            const skuSuggestPrice = Number(sku && sku.suggestSupplyPrice)
              || Number(item && item.suggestSupplyPrice)
              || 0;

            if (skuSuggestPrice <= 0) continue;

            // Look up cost price: try productSkuId first, then skcId as fallback
            const normalizedProductSkuId = normalizeText(productSkuId);
            const costPriceFromSku = skuCostMap.get(normalizedProductSkuId);
            const costPriceFromSkc = skcCostMap.get(itemSkcId);
            const declaredPriceCent = resolvePriceDeclDeclaredPriceCentFromReviewData(
              sku,
              item,
              skuDeclaredPriceMap.get(normalizedProductSkuId)
                || skcDeclaredPriceMap.get(itemSkcId)
                || 0
            );
            const costPriceYuan = costPriceFromSku || costPriceFromSkc || 0;

            // Determine supplierResult per-SKU based on approveUseCostPrice setting
            let supplierResult;
            let submitPrice = 0;

            if (approveUseCostPrice) {
              // Cost-based approval still uses the preview profit metrics,
              // but the rate now follows the suggested-price denominator.
              if (costPriceYuan <= 0) {
                continue;
              }

              const {
                suggestPriceYuan,
                profitValue,
                profitRate
              } = computePriceDeclProfitMetrics(skuSuggestPrice, costPriceYuan);
              const fallbackApproveDecision = resolvePriceDeclFallbackApproveDecision(
                fallbackApproveRules,
                reviewTimes,
                profitValue,
                profitRate
              );

              const meetsApproveCondition = approveCondition === 'profitRate'
                ? profitRate >= approveValue
                : profitValue >= approveValue;

              if (meetsApproveCondition) {
                // Approve (supplierResult: 1): use SKU suggested price.
                supplierResult = 1;
                submitPrice = skuSuggestPrice;
              } else if (fallbackApproveDecision.matched) {
                supplierResult = 1;
                submitPrice = skuSuggestPrice;
              } else if (reviewTimes >= voidMaxAttempts) {
                // Void (supplierResult: 3): exceeded max retry count.
                supplierResult = 3;
              } else {
                // Redeclare (supplierResult: 2): reduce price per settings.
                supplierResult = 2;
                if (declaredPriceCent <= 0) {
                  results.push({ shopId, shopName, priceOrderId, productSkuId, success: false, message: '\u7f3a\u5c11\u539f\u7533\u62a5\u4ef7' });
                  continue;
                }
                submitPrice = computePriceDeclRedeclareSubmitPrice(
                  declaredPriceCent,
                  approveReduceType,
                  approveReduceValue
                );

                if (submitPrice <= 0) {
                  results.push({ shopId, shopName, priceOrderId, productSkuId, success: false, message: '\u91cd\u65b0\u6838\u4ef7\u8ba1\u7b97\u4ef7\u683c\u65e0\u6548' });
                  continue;
                }
              }
            }
            // Group by (priceOrderId, supplierResult)
            if (!orderSkuGroups.has(priceOrderId)) {
              orderSkuGroups.set(priceOrderId, new Map());
            }
            const groupMap = orderSkuGroups.get(priceOrderId);
            if (!groupMap.has(supplierResult)) {
              groupMap.set(supplierResult, []);
            }
            groupMap.get(supplierResult).push({
              productSkuId,
              price: submitPrice
            });
          }
        }

        if (!itemRequestsFromPayload) {
          itemRequests = [];

          for (const [pid, groupMap] of orderSkuGroups) {
            for (const [result, skuItems] of groupMap) {
              const items = result === 3
                ? skuItems.map((s) => ({ productSkuId: s.productSkuId }))
                : skuItems.map((s) => ({ productSkuId: s.productSkuId, price: s.price }));

              itemRequests.push({
                priceOrderId: pid,
                supplierResult: result,
                items
              });
            }
          }
        }
        }

        emitSubmitProgress({
          phase: 'building-requests',
          currentShopId: shopId,
          currentShopName: shopName,
          message: itemRequestsFromPayload
            ? `\u6b63\u5728\u6574\u7406 ${shopName} \u7684\u9884\u89c8\u6838\u4ef7\u5206\u7ec4`
            : `\u6b63\u5728\u751f\u6210 ${shopName} \u7684\u6838\u4ef7\u63d0\u4ea4\u5206\u7ec4`
        });

        const submitItemRequests = normalizePriceDeclSubmitItemRequests(itemRequests, shopId);

        if (submitItemRequests.length <= 0) {
          recordShopFailure(shopId, shopName, '\u65e0\u7b26\u5408\u6761\u4ef6\u7684\u6838\u4ef7\u64cd\u4f5c');
          continue;
        }

        const requestChunks = chunkList(submitItemRequests, PRICE_DECL_SUBMIT_REQUEST_CHUNK_SIZE);
        const shopFailedItemRequests = [];
        const shopSuccessItemRequests = [];
        const shopFailedRequestKeys = [];
        const shopSuccessRequestKeys = [];
        const shopChunkMessages = [];
        let shopSuccessChunkCount = 0;
        let shopFailedChunkCount = 0;
        let shopSuccessSkuCount = 0;
        let shopFailedSkuCount = 0;

        for (let chunkIndex = 0; chunkIndex < requestChunks.length; chunkIndex += 1) {
          if (runHandle.canceled === true) {
            canceled = true;
            break;
          }

          const requestChunk = requestChunks[chunkIndex];
          const apiItemRequests = sanitizePriceDeclApiItemRequests(requestChunk);
          const chunkSkuCount = requestChunk.reduce((total, request) => {
            return total + (Array.isArray(request && request.items) ? request.items.length : 0);
          }, 0);

          emitSubmitProgress({
            phase: 'submitting',
            currentShopId: shopId,
            currentShopName: shopName,
            currentChunkIndex: chunkIndex + 1,
            totalChunks: requestChunks.length,
            currentChunkRequestCount: requestChunk.length,
            message: `\u6b63\u5728\u63d0\u4ea4 ${shopName} \u7684\u7b2c ${chunkIndex + 1}/${requestChunks.length} \u6279\u6838\u4ef7\uff08\u672c\u6279 ${requestChunk.length} \u7ec4\uff09`
          });

          try {
            const submitResponse = await executeJsonRequest(
              warmedSessionContext,
              PRICE_DECL_SUBMIT_ENDPOINT_PATH,
              { itemRequests: apiItemRequests },
              {
                queryJob: runHandle,
                timeoutMs: 45000,
                timeoutMessage: '\u6838\u4ef7\u63d0\u4ea4\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
                defaultErrorMessage: '\u6838\u4ef7\u63d0\u4ea4\u5931\u8d25',
                refererPath: '/newon/product-select'
              }
            );

            const batchOperateResult = submitResponse && submitResponse.payload && submitResponse.payload.result
              && submitResponse.payload.result.batchOperateResult;
            const requestOutcomes = collectPriceDeclSubmitRequestOutcomes(
              requestChunk,
              batchOperateResult,
              shopId
            );
            const failedOutcomes = requestOutcomes.filter((outcome) => outcome && outcome.success !== true);
            const successOutcomes = requestOutcomes.filter((outcome) => outcome && outcome.success === true);

            successOutcomes.forEach((outcome) => {
              const request = outcome && outcome.request;
              const requestSkuCount = Array.isArray(request && request.items) ? request.items.length : 0;
              shopSuccessItemRequests.push(request);
              shopSuccessRequestKeys.push(normalizeText(request && request.requestKey));
              shopSuccessSkuCount += requestSkuCount;
              liveSuccessRequests += 1;
              liveSuccessSkuCount += requestSkuCount;
            });

            failedOutcomes.forEach((outcome) => {
              const request = outcome && outcome.request;
              const requestSkuCount = Array.isArray(request && request.items) ? request.items.length : 0;
              shopFailedItemRequests.push(request);
              shopFailedRequestKeys.push(normalizeText(request && request.requestKey));
              shopFailedSkuCount += requestSkuCount;
              liveFailedRequests += 1;
              liveFailedSkuCount += requestSkuCount;
            });

            if (requestOutcomes.length <= 0) {
              shopFailedItemRequests.push(...requestChunk);
              shopFailedRequestKeys.push(...requestChunk.map((request) => request.requestKey));
              shopFailedSkuCount += chunkSkuCount;
              shopFailedChunkCount += 1;
              liveFailedRequests += requestChunk.length;
              liveFailedChunks += 1;
              liveFailedSkuCount += chunkSkuCount;
              shopChunkMessages.push(
                `\u7b2c${chunkIndex + 1}\u6279\uff1a\u63a5\u53e3\u672a\u8fd4\u56de\u4efb\u4f55\u5206\u7ec4\u7ed3\u679c`
              );
            } else if (failedOutcomes.length > 0) {
              shopFailedChunkCount += 1;
              liveFailedChunks += 1;
              const responseMessage = failedOutcomes
                .map((outcome) => normalizeText(outcome && outcome.message))
                .filter(Boolean)[0] || '\u63a5\u53e3\u8fd4\u56de\u5b58\u5728\u5931\u8d25\u8bb0\u5f55';

              shopChunkMessages.push(
                `\u7b2c${chunkIndex + 1}\u6279\uff1a\u5931\u8d25 ${failedOutcomes.length} \u7ec4/${failedOutcomes.reduce((total, outcome) => total + (Array.isArray(outcome && outcome.request && outcome.request.items) ? outcome.request.items.length : 0), 0)} \u4e2aSKU\uff0c${responseMessage}`
              );
            } else {
              shopSuccessChunkCount += 1;
              liveSuccessChunks += 1;
            }
          } catch (error) {
            if (isQueryCanceledError(error) || runHandle.canceled === true) {
              canceled = true;
              break;
            }

            shopFailedItemRequests.push(...requestChunk);
            shopFailedRequestKeys.push(...requestChunk.map((request) => request.requestKey));
            shopFailedSkuCount += chunkSkuCount;
            shopFailedChunkCount += 1;
            liveFailedRequests += requestChunk.length;
            liveFailedChunks += 1;
            liveFailedSkuCount += chunkSkuCount;
            shopChunkMessages.push(
              `\u7b2c${chunkIndex + 1}\u6279\uff1a${normalizeText(error && error.message) || '\u6838\u4ef7\u63d0\u4ea4\u5931\u8d25'}`
            );

            logError('operations_new_product_lifecycle_price_decl_submit_chunk_failed', error, {
              shopId,
              shopName,
              chunkIndex: chunkIndex + 1,
              chunkSize: requestChunk.length
            });
          }
        }

        if (canceled === true) {
          break;
        }

        const shopTotalChunkCount = shopSuccessChunkCount + shopFailedChunkCount;
        const shopTotalSkuCount = shopSuccessSkuCount + shopFailedSkuCount;
        const shopSuccess = shopFailedItemRequests.length <= 0;
        const shopMessageSuffix = shopChunkMessages.length > 0
          ? `\uff1b${shopChunkMessages.join('\uff1b')}`
          : '';
        const shopMessage = `\u6838\u4ef7\u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${shopSuccessChunkCount} \u6279/${shopSuccessSkuCount} \u4e2aSKU\uff0c\u5931\u8d25 ${shopFailedChunkCount} \u6279/${shopFailedSkuCount} \u4e2aSKU${shopMessageSuffix}`;

        results.push({
          shopId,
          shopName,
          success: shopSuccess,
          message: shopMessage,
          totalChunks: shopTotalChunkCount,
          successChunks: shopSuccessChunkCount,
          failedChunks: shopFailedChunkCount,
          totalRequests: submitItemRequests.length,
          successRequests: shopSuccessItemRequests.length,
          failedRequests: shopFailedItemRequests.length,
          totalSkuCount: shopTotalSkuCount,
          successSkuCount: shopSuccessSkuCount,
          failedSkuCount: shopFailedSkuCount,
          successItemRequests: shopSuccessItemRequests,
          failedItemRequests: shopFailedItemRequests,
          successRequestKeys: shopSuccessRequestKeys,
          failedRequestKeys: shopFailedRequestKeys
        });

        if (shopSuccess) {
          successShops += 1;
          emitSubmitProgress({
            phase: 'shop-completed',
            currentShopId: shopId,
            currentShopName: shopName,
            message: `${shopName}\uff1a${shopMessage}`
          });
        } else {
          failedShops += 1;
          emitSubmitProgress({
            phase: 'shop-failed',
            currentShopId: shopId,
            currentShopName: shopName,
            message: `${shopName}\uff1a${shopMessage}`
          });
        }
      } catch (error) {
        if (isQueryCanceledError(error) || runHandle.canceled === true) {
          canceled = true;
          break;
        }
        recordShopFailure(
          shopId,
          shopName,
          normalizeText(error && error.message) || '\u6838\u4ef7\u5904\u7406\u5f02\u5e38'
        );
      }
      }

    const successItemRequests = results.reduce((all, result) => {
      return all.concat(Array.isArray(result && result.successItemRequests) ? result.successItemRequests : []);
    }, []);
    const failedItemRequests = results.reduce((all, result) => {
      return all.concat(Array.isArray(result && result.failedItemRequests) ? result.failedItemRequests : []);
    }, []);
    const successRequestKeys = results.reduce((all, result) => {
      return all.concat(Array.isArray(result && result.successRequestKeys) ? result.successRequestKeys : []);
    }, []);
    const failedRequestKeys = results.reduce((all, result) => {
      return all.concat(Array.isArray(result && result.failedRequestKeys) ? result.failedRequestKeys : []);
    }, []);
    const totalRequests = successItemRequests.length + failedItemRequests.length;
    const successRequests = successItemRequests.length;
    const failedRequests = failedItemRequests.length;
    const totalChunks = results.reduce((total, result) => {
      return total + (Number(result && result.totalChunks) || 0);
    }, 0);
    const successChunks = results.reduce((total, result) => {
      return total + (Number(result && result.successChunks) || 0);
    }, 0);
    const failedChunks = results.reduce((total, result) => {
      return total + (Number(result && result.failedChunks) || 0);
    }, 0);
    const successSkuCount = successItemRequests.reduce((total, request) => {
      return total + (Array.isArray(request && request.items) ? request.items.length : 0);
    }, 0);
    const failedSkuCount = failedItemRequests.reduce((total, request) => {
      return total + (Array.isArray(request && request.items) ? request.items.length : 0);
    }, 0);

    const updatedAt = nowIso();
    const resultMessage = canceled
      ? '\u5df2\u505c\u6b62\u4efb\u52a1'
      : (failedRequests > 0 || failedShops > 0)
        ? `\u6838\u4ef7\u63d0\u4ea4\u90e8\u5206\u5931\u8d25\uff0c\u6210\u529f ${successChunks} \u6279/${successSkuCount} \u4e2aSKU\uff0c\u5931\u8d25 ${failedChunks} \u6279/${failedSkuCount} \u4e2aSKU${failedShops > 0 ? `\uff0c\u5f02\u5e38\u5e97\u94fa ${failedShops} \u5bb6` : ''}`
        : `\u6838\u4ef7\u63d0\u4ea4\u6210\u529f\uff0c\u5171 ${successChunks} \u6279/${successSkuCount} \u4e2aSKU`;

    emitSubmitProgress({
      phase: canceled ? 'canceled' : 'completed',
      message: resultMessage
    });

      clearPriceDeclRunHandle(runHandle);

      return {
        updatedAt,
        runId,
        success: failedShops <= 0 && !canceled,
        message: resultMessage,
        totalShops: shopGroups.length,
        successShops,
        failedShops,
        canceled,
        totalRequests,
        successRequests,
        failedRequests,
        totalChunks,
        successChunks,
        failedChunks,
        successSkuCount,
        failedSkuCount,
        successItemRequests,
        failedItemRequests,
        successRequestKeys,
        failedRequestKeys,
        results
      };
    } catch (error) {
      clearPriceDeclRunHandle(runHandle);
      throw error;
    }
  }

  async function cancelBatchPriceDeclaration(payload = {}) {
    const activeRun = getPriceDeclRunHandle(payload);
    return {
      canceled: cancelPriceDeclRunInternally(activeRun),
      runId: normalizeText(activeRun && activeRun.runId) || normalizeText(payload && payload.runId)
    };
  }

  async function cancelBatchAdjust(payload = {}) {
    const activeRun = getBatchAdjustRunHandle(payload);
    const runId = normalizeText(activeRun && activeRun.runId) || normalizeText(payload && payload.runId);
    clearBatchAdjustPreviewPreparedRequests(runId);
    return {
      canceled: cancelBatchAdjustRunInternally(activeRun),
      runId
    };
  }

  return {
    async queryRows(payload = {}, options = {}) {
      return queryRows(payload, options);
    },
    async getQuerySettings() {
      return getQuerySettings();
    },
    async saveQuerySettings(payload = {}) {
      return saveQuerySettings(payload);
    },
    async getBatchAdjustPresetSnapshot(payload = {}) {
      return getBatchAdjustPresetSnapshot(payload);
    },
    async saveBatchAdjustPresetBatch(payload = {}) {
      return saveBatchAdjustPresetBatch(payload);
    },
    async previewBatchAdjust(payload = {}, options = {}) {
      return previewBatchAdjust(payload, options);
    },
    async submitBatchAdjust(payload = {}, options = {}) {
      return submitBatchAdjust(payload, options);
    },
    async cancelBatchAdjust(payload = {}) {
      return cancelBatchAdjust(payload);
    },
    async cancelQueryJob(payload = {}, options = {}) {
      return cancelQueryJob(payload, options);
    },
    async previewBatchPriceDeclaration(payload = {}) {
      return previewBatchPriceDeclaration(payload);
    },
    async submitBatchPriceDeclaration(payload = {}, options = {}) {
      return submitBatchPriceDeclaration(payload, options);
    },
    async cancelBatchPriceDeclaration(payload = {}) {
      return cancelBatchPriceDeclaration(payload);
    },
    async getPriceDeclSettings() {
      return getPriceDeclSettings();
    },
    async savePriceDeclSettings(payload = {}) {
      return savePriceDeclSettings(payload);
    }
  };
}

module.exports = {
  createOperationsNewProductLifecycleService
};
