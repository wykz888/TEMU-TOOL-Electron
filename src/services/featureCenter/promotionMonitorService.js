const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  normalizeText,
  isShopParticipating
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const MODULE_ID = 'campaign-monitor';
const CONFIG_FILE_NAME = 'monitor-config.json';
const STATE_FILE_NAME = 'monitor-state.json';
const LOOP_INTERVAL_MS = 4000;
const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
const MIN_MONITOR_INTERVAL_SECONDS = 5;
const DEFAULT_MONITOR_INTERVAL_MS = DEFAULT_MONITOR_INTERVAL_SECONDS * 1000;
const RETRY_BASE_DELAY_MS = 20000;
const RETRY_MAX_DELAY_MS = 180000;
const ADS_DETAIL_URL = 'https://ads.temu.com/api/v1/coconut/ad/ads_detail';
const ADS_MODIFY_URL = 'https://ads.temu.com/api/v1/coconut/ad/modify_ads';
const ADS_DETAIL_PAGE_SIZE = 50;
const ADS_DETAIL_MAX_PAGES = 20;
const ADS_DETAIL_PAUSED_PAGE_SIZE = 50;
const ADS_DETAIL_SORT_BY_PAUSED_STATUS = 0;
const ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT = 2;
const ADS_DETAIL_SORT_BY_TOTAL_SPEND = 3;
const ADS_DETAIL_PAUSED_STATUS_CODE = 7;
const ADS_DETAIL_RUNNING_STATUS_CODE = 8;
const ADS_DETAIL_MIN_ORDER_COUNT_FOR_PAGING = 1;
const ADS_MODIFY_STATUS_RESUME = 0;
const ADS_MODIFY_STATUS_PAUSE = 2;
const ADS_MODIFY_STATUS_DELETE = 3;
const MONITOR_SETTINGS_REFRESH_MS = 5000;
const SHARED_STATE_CLOUD_PERSIST_DELAY_MS = 30000;
const PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES = 999;

const REGION_ENTRIES = Object.freeze([
  { id: 'us', label: '美区', source: 1 },
  { id: 'global', label: '全球', source: 2 },
  { id: 'eu', label: '欧区', source: 3 }
]);

const REGION_IDS_IN_SWITCH_ORDER = Object.freeze([
  'global',
  'eu',
  'us'
]);

function getRegionEntriesInSwitchOrder() {
  return REGION_IDS_IN_SWITCH_ORDER
    .map((regionId) => REGION_ENTRIES.find((region) => region.id === regionId))
    .filter(Boolean);
}

function resolveRequestedRegionEntries(regionIds, options = {}) {
  const useSwitchOrder = options && options.useSwitchOrder === true;
  const baseRegionEntries = useSwitchOrder ? getRegionEntriesInSwitchOrder() : REGION_ENTRIES.slice();

  if (!Array.isArray(regionIds)) {
    return baseRegionEntries;
  }

  const selectedRegionIds = new Set(
    regionIds
      .map((regionId) => normalizeText(regionId))
      .filter((regionId) => REGION_ENTRIES.some((region) => region.id === regionId))
  );

  return baseRegionEntries.filter((region) => selectedRegionIds.has(region.id));
}

const MONITOR_COLUMN_IDS = Object.freeze([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_all',
  'order_pay_amt_label',
  'net_pay_amt_label',
  'roas_all',
  'roas_label',
  'net_roas_label',
  'acos_all_label',
  'acos_label',
  'net_acos_ad_label',
  'transaction_cost_all',
  'transaction_cost_label',
  'net_trans_cost_ad_label',
  'order_pay_count_all_label',
  'order_pay_count_label',
  'net_pay_cnt_label',
  'goods_num_all',
  'goods_num_label',
  'net_goods_num_label',
  'impr_count_all',
  'impr_count_label',
  'click_count_all',
  'click_count_label',
  'ctr_all',
  'ctr_label',
  'cvr_all',
  'cvr_label',
  'add_cart_count_label'
]);

const COLUMN_VALUE_ALIASES = Object.freeze({
  ad_spend_label: [
    'ad_spend_label',
    'ad_spend',
    'spend',
    'spend_amt',
    'total_spend',
    'adSpend',
    'AD_SPEND',
    'SPEND_AD'
  ],
  net_ad_spend_label: [
    'net_ad_spend_label',
    'net_ad_spend',
    'net_spend',
    'netAdSpend',
    'NET_AD_SPEND',
    'SPEND_NET_AD'
  ],
  order_pay_amt_all: [
    'order_pay_amt_all',
    'order_pay_amt_all_label',
    'all_order_pay_amt',
    'totalOrderPayAmt',
    'totalPayAmt',
    'TOTAL_PAY_AMT',
    'ORDER_PAY_AMT_TOTAL'
  ],
  order_pay_amt_label: [
    'order_pay_amt_label',
    'order_pay_amt',
    'ad_order_pay_amt',
    'orderPayAmt',
    'ORDER_PAY_AMT',
    'ORDER_PAY_AMT_AD'
  ],
  net_pay_amt_label: [
    'net_pay_amt_label',
    'net_pay_amt',
    'netOrderPayAmt',
    'NET_PAY_AMT',
    'ORDER_PAY_AMT_NET_AD'
  ],
  roas_all: [
    'roas_all',
    'all_roas',
    'totalRoas',
    'TOTAL_ROAS',
    'ROAS_TOTAL',
    'OVERALL_ROAS'
  ],
  roas_label: ['roas_label', 'roas', 'ad_roas', 'ROAS', 'ROAS_AD'],
  net_roas_label: ['net_roas_label', 'net_roas', 'netRoas', 'NET_ROAS', 'ROAS_NET_AD'],
  acos_all_label: ['acos_all_label', 'acos_all', 'all_acos', 'totalAcos', 'TOTAL_ACOS', 'ACOS_TOTAL'],
  acos_label: ['acos_label', 'acos', 'ad_acos', 'ACOS', 'ACOS_AD'],
  net_acos_ad_label: ['net_acos_ad_label', 'net_acos_ad', 'net_acos', 'netAcos', 'NET_ACOS', 'ACOS_NET_AD'],
  transaction_cost_all: [
    'transaction_cost_all',
    'all_transaction_cost',
    'totalTransactionCost',
    'TOTAL_TRANS_COST',
    'TRANSACTION_COST_TOTAL'
  ],
  transaction_cost_label: [
    'transaction_cost_label',
    'transaction_cost',
    'ad_transaction_cost',
    'transactionCost',
    'TRANSACTION_COST',
    'TRANSACTION_COST_AD'
  ],
  net_trans_cost_ad_label: [
    'net_trans_cost_ad_label',
    'net_trans_cost_ad',
    'net_transaction_cost',
    'netTransactionCost',
    'NET_TRANS_COST',
    'TRANSACTION_COST_NET_AD'
  ],
  order_pay_count_all_label: [
    'order_pay_count_all_label',
    'order_pay_count_all',
    'all_order_pay_count',
    'totalOrderPayCnt',
    'totalOrderPayCount',
    'TOTAL_PAY_CNT',
    'ORDER_PAY_CNT_TOTAL',
    'ORDER_PAY_COUNT_TOTAL'
  ],
  order_pay_count_label: [
    'order_pay_count_label',
    'order_pay_count',
    'ad_order_pay_count',
    'orderPayCnt',
    'orderPayCount',
    'ORDER_PAY_CNT',
    'ORDER_PAY_COUNT',
    'ORDER_PAY_CNT_AD',
    'ORDER_PAY_COUNT_AD'
  ],
  net_pay_cnt_label: [
    'net_pay_cnt_label',
    'net_pay_cnt',
    'net_order_pay_count',
    'netOrderPayCnt',
    'netPayCnt',
    'NET_PAY_CNT',
    'ORDER_PAY_CNT_NET_AD',
    'ORDER_PAY_COUNT_NET_AD'
  ],
  goods_num_all: ['goods_num_all', 'all_goods_num', 'totalGoodsNum', 'TOTAL_GOODS_NUM', 'GOODS_NUM_TOTAL'],
  goods_num_label: ['goods_num_label', 'goods_num', 'ad_goods_num', 'goodsNum', 'GOODS_NUM', 'GOODS_NUM_AD'],
  net_goods_num_label: ['net_goods_num_label', 'net_goods_num', 'netGoodsNum', 'NET_GOODS_NUM', 'GOODS_NUM_NET_AD'],
  impr_count_all: [
    'impr_count_all',
    'all_impr_count',
    'impression_all',
    'totalImprCnt',
    'totalImprCount',
    'TOTAL_IMPR_CNT',
    'IMPRT_CNT_TOTAL',
    'IMPR_COUNT_TOTAL'
  ],
  impr_count_label: [
    'impr_count_label',
    'impr_count',
    'impression',
    'ad_impression',
    'imprCnt',
    'imprCount',
    'IMPR_COUNT',
    'IMPRT_CNT',
    'IMPRT_CNT_AD'
  ],
  click_count_all: [
    'click_count_all',
    'all_click_count',
    'totalClkCnt',
    'totalClickCount',
    'TOTAL_CLK_CNT',
    'CLK_CNT_TOTAL',
    'CLICK_COUNT_TOTAL'
  ],
  click_count_label: [
    'click_count_label',
    'click_count',
    'click',
    'clkCnt',
    'clickCount',
    'CLICK_COUNT',
    'CLK_CNT',
    'CLK_CNT_AD'
  ],
  ctr_all: ['ctr_all', 'all_ctr', 'totalCtr', 'TOTAL_CTR', 'CTR_TOTAL'],
  ctr_label: ['ctr_label', 'ctr', 'CTR', 'CTR_AD'],
  cvr_all: ['cvr_all', 'all_cvr', 'totalCvr', 'TOTAL_CVR', 'CVR_TOTAL'],
  cvr_label: ['cvr_label', 'cvr', 'CVR', 'CVR_AD'],
  add_cart_count_label: [
    'add_cart_count_label',
    'add_cart_count',
    'cart_count',
    'addCartCount',
    'ADD_CART_COUNT',
    'cartCnt',
    'CART_CNT',
    'CART_CNT_AD'
  ]
});

const MONEY_COLUMN_ID_SET = new Set([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_all',
  'order_pay_amt_label',
  'net_pay_amt_label',
  'transaction_cost_all',
  'transaction_cost_label',
  'net_trans_cost_ad_label'
]);

const PERCENT_COLUMN_ID_SET = new Set([
  'acos_all_label',
  'acos_label',
  'net_acos_ad_label',
  'ctr_all',
  'ctr_label',
  'cvr_all',
  'cvr_label'
]);

const RATIO_COLUMN_ID_SET = new Set([
  'roas_all',
  'roas_label',
  'net_roas_label'
]);

const MONITOR_ACTION_TYPES = Object.freeze([
  'pause_plan',
  'pause_then_resume',
  'delete_plan',
  'update_roas',
  'increase_roas'
]);

const MONITOR_EXECUTION_ACTION_TYPES = Object.freeze([
  ...MONITOR_ACTION_TYPES,
  'resume_plan'
]);

const MONITOR_OPERATION_REASON_TYPES = Object.freeze([
  'primary_action',
  'auto_pause_spend',
  'auto_pause_roas',
  'pause_then_resume_pause',
  'pause_then_resume_resume'
]);

const ADS_DETAIL_ITEM_LIST_KEYS = Object.freeze([
  'list',
  'items',
  'rows',
  'records',
  'record_list',
  'data_list',
  'page_list',
  'goods_list',
  'ad_list'
]);

const ADS_DETAIL_GOODS_ID_ALIASES = Object.freeze([
  'goods_id',
  'goodsId',
  'product_id',
  'productId',
  'item_id',
  'itemId',
  'sku_id',
  'skuId'
]);

const ADS_DETAIL_PRODUCT_NAME_ALIASES = Object.freeze([
  'goods_name',
  'goodsName',
  'product_name',
  'productName',
  'item_name',
  'itemName',
  'product_title',
  'productTitle',
  'goods_title',
  'goodsTitle',
  'title',
  'name'
]);

const ADS_DETAIL_AD_ID_ALIASES = Object.freeze([
  'ad_id',
  'adId',
  'promotion_id',
  'promotionId',
  'plan_id',
  'planId',
  'campaign_id',
  'campaignId'
]);

const ADS_DETAIL_TARGET_ROAS_ALIASES = Object.freeze([
  'target_roas',
  'targetRoas',
  'target_roas_value',
  'targetRoasValue',
  'expect_roas',
  'expectRoas'
]);

const ADS_DETAIL_SHOW_STATUS_ALIASES = Object.freeze([
  'ad_show_status',
  'adShowStatus'
]);

const ADS_DETAIL_STATUS_ALIASES = Object.freeze([
  'status',
  'state',
  'ad_status',
  'ad_state',
  'adStatus',
  'adState',
  'promotion_status',
  'promotion_state',
  'promotionStatus',
  'promotionState',
  'plan_status',
  'plan_state',
  'planStatus',
  'planState',
  'campaign_status',
  'campaign_state',
  'campaignStatus'
]);

const ADS_DETAIL_PAUSED_FLAG_ALIASES = Object.freeze([
  'paused',
  'is_paused',
  'isPaused',
  'pause',
  'pause_status',
  'pauseStatus',
  'is_pause',
  'isPause'
]);

const ADS_DETAIL_STATUS_TEXT_ALIASES = Object.freeze([
  'status_desc',
  'statusDesc',
  'state_desc',
  'stateDesc',
  'status_text',
  'statusText',
  'state_text',
  'stateText',
  'status_label',
  'statusLabel',
  'status_name',
  'statusName',
  'ad_status_desc',
  'adStatusDesc',
  'ad_state_desc',
  'adStateDesc',
  'ad_status_text',
  'adStatusText',
  'ad_state_text',
  'adStateText',
  'ad_status_label',
  'adStatusLabel',
  'ad_state_label',
  'adStateLabel',
  'promotion_status_desc',
  'promotionStatusDesc',
  'promotion_state_desc',
  'promotionStateDesc',
  'promotion_status_text',
  'promotionStatusText',
  'promotion_state_text',
  'promotionStateText',
  'plan_status_desc',
  'planStatusDesc',
  'plan_state_desc',
  'planStateDesc',
  'plan_status_text',
  'planStatusText',
  'plan_state_text',
  'planStateText',
  'campaign_status_desc',
  'campaignStatusDesc',
  'campaign_state_desc',
  'campaignStateDesc',
  'campaign_status_text',
  'campaignStatusText',
  'campaign_state_text',
  'campaignStateText'
]);

const ADS_DETAIL_PAGE_NUMBER_ALIASES = Object.freeze([
  'page_number',
  'pageNumber',
  'page_no',
  'pageNo',
  'current_page',
  'currentPage'
]);

const ADS_DETAIL_TOTAL_PAGE_ALIASES = Object.freeze([
  'total_page',
  'totalPage',
  'page_total',
  'pageTotal',
  'total_pages',
  'totalPages',
  'page_count',
  'pageCount'
]);

const ADS_DETAIL_TOTAL_COUNT_ALIASES = Object.freeze([
  'total',
  'total_count',
  'totalCount',
  'total_num',
  'totalNum',
  'record_total',
  'recordTotal'
]);

const ADS_DETAIL_HAS_MORE_ALIASES = Object.freeze([
  'has_more',
  'hasMore',
  'more'
]);

function createPromotionMonitorService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  getShopWindowBrowserController = null,
  promotionManagerSettingsService,
  promotionMasterSessionService,
  runtimeLogger
}) {
  let loadedOwnerKey = '';
  let currentOwner = null;
  let configCache = buildDefaultConfig(null);
  let stateCache = buildDefaultState(null);
  let monitorConfigCache = null;
  let monitorConfigLoadedAt = 0;
  let schedulerTimer = 0;
  let schedulerRunning = false;
  let persistStateTimer = 0;
  let persistSharedStateTimer = 0;
  let sharedStateLoadedAt = 0;
  let sharedStateDirty = false;
  let sharedStateRevision = 0;
  let sharedStatePersistedRevision = 0;

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

  function updateShopStageLog(shopId, shopState, message, options = {}) {
    if (!shopState) {
      return;
    }

    const normalizedMessage = normalizeText(message);

    if (!normalizedMessage) {
      return;
    }

    shopState.log = normalizedMessage;
    stateCache.updatedAt = nowIso();
    scheduleStatePersist(0);

    if (options.writeRuntimeLog === true) {
      log('promotion_monitor_stage_changed', {
        shopId: normalizeText(shopId),
        stage: normalizeText(options.stage) || 'stage',
        regionId: normalizeText(options.regionId),
        message: normalizedMessage
      });
    }
  }

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

  function getModuleEntry() {
    const moduleEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getEntryById === 'function'
        ? featureCenterProfileService.getEntryById(MODULE_ID)
        : null;

    if (!moduleEntry) {
      throw new Error('推广监控模块未注册，无法加载监控配置。');
    }

    return moduleEntry;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uniq(values) {
    return Array.from(new Set(values));
  }

  function hasOwnField(container, fieldName) {
    return Boolean(
      container
      && typeof container === 'object'
      && Object.prototype.hasOwnProperty.call(container, fieldName)
    );
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
        ? cloudPayload
        : localPayload;
    }

    return cloudPayload || localPayload || null;
  }

  function normalizeEnabledShopIds(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    return uniq(values.map((value) => normalizeText(value)).filter(Boolean));
  }

  function normalizeIntegerValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return null;
    }

    return parsedValue;
  }

  function normalizeMinOrderCountValue(value) {
    if (value === '' || value === null || value === undefined) {
      return 1;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return 1;
    }

    return parsedValue;
  }

  function normalizeMonitorIntervalSecondsValue(value) {
    if (value === '' || value === null || value === undefined) {
      return DEFAULT_MONITOR_INTERVAL_SECONDS;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue)) {
      return DEFAULT_MONITOR_INTERVAL_SECONDS;
    }

    if (parsedValue < MIN_MONITOR_INTERVAL_SECONDS) {
      return MIN_MONITOR_INTERVAL_SECONDS;
    }

    return parsedValue;
  }

  function normalizeResumeIntervalMinutesValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return null;
    }

    return parsedValue;
  }

  function normalizeBooleanFlag(value, fallback = false) {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue) {
      return fallback;
    }

    if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return fallback;
  }

  function normalizeDecimalValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number.parseFloat(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return null;
    }

    return parsedValue;
  }

  function normalizeNullableBoolean(value) {
    if (value === true || value === false) {
      return value;
    }

    return null;
  }

  function buildDefaultMonitorConfig() {
    return {
      monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
      dailyOperationLimit: null,
      totalOperationLimit: null,
      autoPauseSpendThreshold: null,
      autoPauseRoasThreshold: null,
      conditionMaxRoas: null,
      minOrderCount: 1,
      regionIds: REGION_ENTRIES.map((region) => region.id),
      actionType: 'pause_plan',
      resumeIntervalMinutes: null,
      targetRoas: null
    };
  }

  function normalizeMonitorConfig(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};

    return {
      monitorIntervalSeconds: normalizeMonitorIntervalSecondsValue(source.monitorIntervalSeconds),
      dailyOperationLimit: normalizeIntegerValue(source.dailyOperationLimit),
      totalOperationLimit: normalizeIntegerValue(source.totalOperationLimit),
      autoPauseSpendThreshold: normalizeDecimalValue(source.autoPauseSpendThreshold),
      autoPauseRoasThreshold: normalizeDecimalValue(source.autoPauseRoasThreshold),
      conditionMaxRoas: normalizeDecimalValue(source.conditionMaxRoas),
      minOrderCount: normalizeMinOrderCountValue(source.minOrderCount),
      regionIds: uniq(
        (Array.isArray(source.regionIds) ? source.regionIds : REGION_ENTRIES.map((region) => region.id))
          .map((value) => normalizeText(value))
          .filter((value) => REGION_ENTRIES.some((region) => region.id === value))
      ),
      actionType: MONITOR_ACTION_TYPES.includes(normalizeText(source.actionType))
        ? normalizeText(source.actionType)
        : 'pause_plan',
      resumeIntervalMinutes: normalizeResumeIntervalMinutesValue(source.resumeIntervalMinutes),
      targetRoas: normalizeDecimalValue(source.targetRoas)
    };
  }

  function normalizeMonitorConfigPatch(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const normalizedPatch = {};

    if (hasOwnField(source, 'monitorIntervalSeconds')) {
      normalizedPatch.monitorIntervalSeconds = normalizeMonitorIntervalSecondsValue(source.monitorIntervalSeconds);
    }

    if (hasOwnField(source, 'dailyOperationLimit')) {
      normalizedPatch.dailyOperationLimit = normalizeIntegerValue(source.dailyOperationLimit);
    }

    if (hasOwnField(source, 'totalOperationLimit')) {
      normalizedPatch.totalOperationLimit = normalizeIntegerValue(source.totalOperationLimit);
    }

    if (hasOwnField(source, 'autoPauseSpendThreshold')) {
      normalizedPatch.autoPauseSpendThreshold = normalizeDecimalValue(source.autoPauseSpendThreshold);
    }

    if (hasOwnField(source, 'autoPauseRoasThreshold')) {
      normalizedPatch.autoPauseRoasThreshold = normalizeDecimalValue(source.autoPauseRoasThreshold);
    }

    if (hasOwnField(source, 'conditionMaxRoas')) {
      normalizedPatch.conditionMaxRoas = normalizeDecimalValue(source.conditionMaxRoas);
    }

    if (hasOwnField(source, 'minOrderCount')) {
      normalizedPatch.minOrderCount = normalizeMinOrderCountValue(source.minOrderCount);
    }

    if (hasOwnField(source, 'regionIds')) {
      normalizedPatch.regionIds = uniq(
        (Array.isArray(source.regionIds) ? source.regionIds : [])
          .map((value) => normalizeText(value))
          .filter((value) => REGION_ENTRIES.some((region) => region.id === value))
      );
    }

    if (hasOwnField(source, 'actionType')) {
      normalizedPatch.actionType = MONITOR_ACTION_TYPES.includes(normalizeText(source.actionType))
        ? normalizeText(source.actionType)
        : 'pause_plan';
    }

    if (hasOwnField(source, 'resumeIntervalMinutes')) {
      normalizedPatch.resumeIntervalMinutes = normalizeResumeIntervalMinutesValue(source.resumeIntervalMinutes);
    }

    if (hasOwnField(source, 'targetRoas')) {
      normalizedPatch.targetRoas = normalizeDecimalValue(source.targetRoas);
    }

    return normalizedPatch;
  }

  function mergeMonitorConfig(baseConfig, overrideConfig) {
    const normalizedBaseConfig = normalizeMonitorConfig(baseConfig);
    const normalizedOverrideConfig = normalizeMonitorConfigPatch(overrideConfig);

    return {
      monitorIntervalSeconds: hasOwnField(normalizedOverrideConfig, 'monitorIntervalSeconds')
        ? normalizedOverrideConfig.monitorIntervalSeconds
        : normalizedBaseConfig.monitorIntervalSeconds,
      dailyOperationLimit: hasOwnField(normalizedOverrideConfig, 'dailyOperationLimit')
        ? normalizedOverrideConfig.dailyOperationLimit
        : normalizedBaseConfig.dailyOperationLimit,
      totalOperationLimit: hasOwnField(normalizedOverrideConfig, 'totalOperationLimit')
        ? normalizedOverrideConfig.totalOperationLimit
        : normalizedBaseConfig.totalOperationLimit,
      autoPauseSpendThreshold: hasOwnField(normalizedOverrideConfig, 'autoPauseSpendThreshold')
        ? normalizedOverrideConfig.autoPauseSpendThreshold
        : normalizedBaseConfig.autoPauseSpendThreshold,
      autoPauseRoasThreshold: hasOwnField(normalizedOverrideConfig, 'autoPauseRoasThreshold')
        ? normalizedOverrideConfig.autoPauseRoasThreshold
        : normalizedBaseConfig.autoPauseRoasThreshold,
      conditionMaxRoas: hasOwnField(normalizedOverrideConfig, 'conditionMaxRoas')
        ? normalizedOverrideConfig.conditionMaxRoas
        : normalizedBaseConfig.conditionMaxRoas,
      minOrderCount: hasOwnField(normalizedOverrideConfig, 'minOrderCount')
        ? normalizedOverrideConfig.minOrderCount
        : normalizedBaseConfig.minOrderCount,
      regionIds: hasOwnField(normalizedOverrideConfig, 'regionIds')
        ? normalizedOverrideConfig.regionIds
        : normalizedBaseConfig.regionIds,
      actionType: hasOwnField(normalizedOverrideConfig, 'actionType')
        ? normalizedOverrideConfig.actionType
        : normalizedBaseConfig.actionType,
      resumeIntervalMinutes: hasOwnField(normalizedOverrideConfig, 'resumeIntervalMinutes')
        ? normalizedOverrideConfig.resumeIntervalMinutes
        : normalizedBaseConfig.resumeIntervalMinutes,
      targetRoas: hasOwnField(normalizedOverrideConfig, 'targetRoas')
        ? normalizedOverrideConfig.targetRoas
        : normalizedBaseConfig.targetRoas
    };
  }

  function normalizeMonitorShopConfigs(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(payload)
        .map(([shopId, shopConfig]) => {
          const normalizedShopId = normalizeText(shopId);

          if (!normalizedShopId) {
            return null;
          }

          return [normalizedShopId, normalizeMonitorConfigPatch(shopConfig)];
        })
        .filter(Boolean)
    );
  }

  function buildDefaultMonitorConfigBundle() {
    return {
      globalConfig: buildDefaultMonitorConfig(),
      shopConfigs: {}
    };
  }

  function normalizeMonitorConfigBundle(settingsPayload) {
    const source = settingsPayload && typeof settingsPayload === 'object' ? settingsPayload : {};

    return {
      globalConfig: normalizeMonitorConfig(source.monitorConfig),
      shopConfigs: normalizeMonitorShopConfigs(source.monitorShopConfigs)
    };
  }

  function resolveShopMonitorConfig(shopId, monitorConfigBundle) {
    const normalizedShopId = normalizeText(shopId);
    const bundle = monitorConfigBundle && typeof monitorConfigBundle === 'object'
      ? monitorConfigBundle
      : buildDefaultMonitorConfigBundle();

    if (
      normalizedShopId
      && bundle.shopConfigs
      && Object.prototype.hasOwnProperty.call(bundle.shopConfigs, normalizedShopId)
    ) {
      return mergeMonitorConfig(bundle.globalConfig, bundle.shopConfigs[normalizedShopId]);
    }

    return normalizeMonitorConfig(bundle.globalConfig);
  }

  function buildOperationDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function buildDefaultOperationStat() {
    return {
      dailyBucket: '',
      dailyCount: 0,
      totalCount: 0,
      lastActionType: '',
      lastRegionId: '',
      lastGoodsId: '',
      lastAdId: '',
      lastTargetRoas: 0,
      lastExecutedAt: '',
      lastResultMessage: '',
      lastTriggerReason: '',
      lastTriggerMessage: '',
      lastObservedAdSpend: null,
      lastObservedOrderCount: 0,
      lastObservedCurrentRoas: null,
      lastObservedTargetRoas: null,
      knownPausedState: null,
      pauseStateUpdatedAt: '',
      pausedAt: ''
    };
  }

  function buildEmptyOperationSummary() {
    return {
      actionType: '',
      attemptedCount: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      skippedByRoas: 0,
      skippedByOrderCount: 0,
      skippedByDailyLimit: 0,
      skippedByTotalLimit: 0,
      skippedByAlreadyPaused: 0,
      autoPausedBySpendCount: 0,
      autoPausedByRoasCount: 0,
      skippedByResumeWaiting: 0,
      skippedByActionPayload: 0,
      successfulActionCounts: {},
      executedItems: [],
      failedItems: []
    };
  }

  function resolveAdsDetailProductCount(payload, regionId) {
    const responseData = payload && typeof payload === 'object' ? payload : {};
    const resultData = responseData.result && typeof responseData.result === 'object'
      ? responseData.result
      : {};
    const totalCount = extractIntegerByAliases(
      { ...responseData, ...resultData },
      ADS_DETAIL_TOTAL_COUNT_ALIASES
    );

    if (totalCount !== null) {
      return Math.max(0, totalCount);
    }

    return extractAdsDetailItems(responseData, regionId).length;
  }

  function buildRegionProductCountSummary(regionProductCounts, regionIds) {
    const counts = regionProductCounts && typeof regionProductCounts === 'object'
      ? regionProductCounts
      : {};
    const targetRegions = resolveRequestedRegionEntries(regionIds);

    if (targetRegions.length === 0) {
      return '\u672a\u9009\u62e9\u76d1\u63a7\u5730\u533a';
    }

    const parts = [];
    let totalCount = 0;

    targetRegions.forEach((region) => {
      const productCount = Math.max(0, Number.parseInt(counts[region.id], 10) || 0);

      totalCount += productCount;
      parts.push(`${region.label} ${productCount}`);
    });

    return `${parts.join(' / ')}，共 ${totalCount} 个商品`;
  }

  function buildRegionLabelPreview(labels, limit = 2) {
    const normalizedLabels = Array.isArray(labels)
      ? labels.map((label) => normalizeText(label)).filter(Boolean)
      : [];

    if (normalizedLabels.length === 0) {
      return '';
    }

    if (normalizedLabels.length <= limit) {
      return normalizedLabels.join(' / ');
    }

    return `${normalizedLabels.slice(0, limit).join(' / ')} 等 ${normalizedLabels.length} 区`;
  }

  function buildRegionMonitorDataSummary(regionStates, regionIds) {
    const states = regionStates && typeof regionStates === 'object'
      ? regionStates
      : {};
    const targetRegions = resolveRequestedRegionEntries(regionIds);

    if (targetRegions.length === 0) {
      return '\u672a\u9009\u62e9\u76d1\u63a7\u5730\u533a';
    }

    const syncedLabels = [];

    targetRegions.forEach((region) => {
      const regionState = states[region.id] && typeof states[region.id] === 'object'
        ? states[region.id]
        : {};
      const summarySource = normalizeText(regionState.summarySource);
      const summary = regionState.summary && typeof regionState.summary === 'object'
        ? regionState.summary
        : {};
      const fetchedAt = normalizeText(regionState.fetchedAt);
      const detailFetched = regionState.detailFetched === true || summarySource === 'ads-detail';
      const productCount = Math.max(
        0,
        Number.parseInt(regionState.productCount, 10)
        || Math.round(parseMetricNumber(summary.goods_num_label) || 0)
      );
      const orderCountLabel = normalizeText(summary.order_pay_count_label);
      let label = region.label;

      if (!summarySource && !fetchedAt && detailFetched !== true) {
        return;
      }

      if (productCount > 0) {
        label = `${region.label} ${productCount} \u5546\u54c1`;
      } else if (orderCountLabel && orderCountLabel !== '--') {
        label = `${region.label} ${orderCountLabel} \u5355`;
      }

      syncedLabels.push(label);
    });

    if (syncedLabels.length === 0) {
      return '\u672a\u540c\u6b65';
    }

    return `\u5df2\u540c\u6b65 ${buildRegionLabelPreview(syncedLabels)}`;
  }

  function normalizeOperationStat(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const normalizedDailyBucket = normalizeText(source.dailyBucket);
    const normalizedTriggerReason = normalizeText(source.lastTriggerReason);
    const lastObservedAdSpend = normalizeMoneyMetricValue(source.lastObservedAdSpend);
    const lastObservedCurrentRoas = normalizeRoasRawValue(source.lastObservedCurrentRoas);
    const lastObservedTargetRoas = normalizeRoasRawValue(source.lastObservedTargetRoas);

    return {
      dailyBucket: normalizedDailyBucket,
      dailyCount: Math.max(0, Number.parseInt(source.dailyCount, 10) || 0),
      totalCount: Math.max(0, Number.parseInt(source.totalCount, 10) || 0),
      lastActionType: MONITOR_EXECUTION_ACTION_TYPES.includes(normalizeText(source.lastActionType))
        ? normalizeText(source.lastActionType)
        : '',
      lastRegionId: normalizeText(source.lastRegionId),
      lastGoodsId: normalizeText(source.lastGoodsId),
      lastAdId: normalizeText(source.lastAdId),
      lastTargetRoas: Math.max(0, Number.parseInt(source.lastTargetRoas, 10) || 0),
      lastExecutedAt: normalizeText(source.lastExecutedAt),
      lastResultMessage: normalizeText(source.lastResultMessage),
      lastTriggerReason: MONITOR_OPERATION_REASON_TYPES.includes(normalizedTriggerReason)
        ? normalizedTriggerReason
        : '',
      lastTriggerMessage: normalizeText(source.lastTriggerMessage),
      lastObservedAdSpend: lastObservedAdSpend !== null ? lastObservedAdSpend : null,
      lastObservedOrderCount: Math.max(0, Number.parseInt(source.lastObservedOrderCount, 10) || 0),
      lastObservedCurrentRoas: lastObservedCurrentRoas,
      lastObservedTargetRoas: lastObservedTargetRoas,
      knownPausedState: normalizeNullableBoolean(source.knownPausedState),
      pauseStateUpdatedAt: normalizeText(source.pauseStateUpdatedAt),
      pausedAt: normalizeText(source.pausedAt)
    };
  }

  function isPersistableOperationStat(stat) {
    const normalizedStat = normalizeOperationStat(stat);

    return (
      normalizedStat.totalCount > 0
      || normalizedStat.dailyCount > 0
      || Boolean(normalizedStat.lastExecutedAt)
      || (
        normalizedStat.knownPausedState === true
        && Boolean(normalizedStat.pausedAt)
      )
    );
  }

  function normalizeOperationStats(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(payload)
        .map(([key, value]) => [normalizeText(key), normalizeOperationStat(value)])
        .filter(([key, stat]) => Boolean(key) && isPersistableOperationStat(stat))
    );
  }

  function buildSharedOperationStatsPayload(payload) {
    return Object.fromEntries(
      Object.entries(normalizeOperationStats(payload))
        .map(([statKey, stat]) => [
          statKey,
          {
            dailyBucket: stat.dailyBucket,
            dailyCount: stat.dailyCount,
            totalCount: stat.totalCount,
            lastActionType: stat.lastActionType,
            lastExecutedAt: stat.lastExecutedAt,
            knownPausedState: stat.knownPausedState,
            pauseStateUpdatedAt: stat.pauseStateUpdatedAt,
            pausedAt: stat.pausedAt
          }
        ])
    );
  }

  function buildOperationStatKey(regionId, goodsId, adId) {
    return [
      normalizeText(regionId) || 'all',
      normalizeText(goodsId) || '-',
      normalizeText(adId) || '-'
    ].join('::');
  }

  function buildDefaultConfig(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: nowIso(),
      batchMonitoringActive: false,
      enabledShopIds: []
    };
  }

  function buildEmptyRegionState(regionId) {
    return {
      regionId,
      productCount: 0,
      summary: {},
      fetchedAt: '',
      switchMessage: '',
      detailMessage: '',
      summarySource: '',
      promotionOrderCount: 0,
      previousPromotionOrderCount: 0,
      hasPromotionOrderIncrease: false,
      detailFetched: false
    };
  }

  function buildDefaultShopState(shopId, enabled = false) {
    return {
      shopId: normalizeText(shopId),
      enabled: enabled === true,
      status: enabled ? 'idle' : 'disabled',
      log: enabled ? '等待同步' : '',
      lastUpdatedAt: '',
      lastSuccessAt: '',
      lastError: '',
      nextRunAt: enabled ? 0 : Number.MAX_SAFE_INTEGER,
      retryCount: 0,
      taskRunning: false,
      startupPauseResumeSweepPending: true,
      pauseResumeFallbackNextRunAt: 0,
      pauseResumeFallbackRetryCount: 0,
      cookieHeaderByRegion: {},
      operationStats: {},
      regions: REGION_ENTRIES.reduce((result, region) => {
        result[region.id] = buildEmptyRegionState(region.id);
        return result;
      }, {})
    };
  }

  function buildDefaultState(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: nowIso(),
      shops: {}
    };
  }

  function getStoragePaths(owner) {
    const moduleEntry = getModuleEntry();

    return {
      configFilePath: path.join(
        moduleEntry.storageProfile.localRootDir,
        'users',
        owner.userKey,
        'config',
        CONFIG_FILE_NAME
      ),
      stateFilePath: path.join(
        moduleEntry.storageProfile.localRootDir,
        'users',
        owner.userKey,
        'state',
        STATE_FILE_NAME
      ),
      cloudConfigKey: `${moduleEntry.storageKey}/users/${owner.userKey}/config/${CONFIG_FILE_NAME}`,
      cloudStateKey: `${moduleEntry.storageKey}/users/${owner.userKey}/state/${STATE_FILE_NAME}`
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
    const serializedPayload = JSON.stringify(payload, null, 2);

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, serializedPayload, 'utf8');

    const renameRetryDelays = [0, 40, 120];
    let lastRenameError = null;

    for (const delayMs of renameRetryDelays) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        await fs.promises.rename(tempFilePath, filePath);
        return;
      } catch (error) {
        lastRenameError = error;
        const errorCode = normalizeText(error && error.code).toUpperCase();

        if (!['EPERM', 'EBUSY', 'EACCES'].includes(errorCode)) {
          break;
        }
      }
    }

    try {
      await fs.promises.writeFile(filePath, serializedPayload, 'utf8');
      await fs.promises.unlink(tempFilePath).catch(() => {});
      return;
    } catch (writeError) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
      throw lastRenameError || writeError;
    }
  }

  async function readCloudJson(key) {
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key
    });

    return result.data;
  }

  async function writeCloudJson(key, payload, metadata = {}) {
    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key,
      data: payload,
      metadata
    });
  }

  function normalizeRegionState(regionId, payload) {
    const nextPayload = payload && typeof payload === 'object' ? payload : {};

    return {
      regionId,
      productCount: Math.max(0, Number.parseInt(nextPayload.productCount, 10) || 0),
      summary: nextPayload.summary && typeof nextPayload.summary === 'object'
        ? { ...nextPayload.summary }
        : {},
      fetchedAt: normalizeText(nextPayload.fetchedAt),
      switchMessage: normalizeText(nextPayload.switchMessage),
      detailMessage: normalizeText(nextPayload.detailMessage),
      summarySource: normalizeText(nextPayload.summarySource),
      promotionOrderCount: Math.max(0, Number.parseInt(nextPayload.promotionOrderCount, 10) || 0),
      previousPromotionOrderCount: Math.max(0, Number.parseInt(nextPayload.previousPromotionOrderCount, 10) || 0),
      hasPromotionOrderIncrease: nextPayload.hasPromotionOrderIncrease === true,
      detailFetched: nextPayload.detailFetched === true
    };
  }

  function normalizeShopState(shopId, payload, enabledShopIdsSet, batchMonitoringActive = false) {
    const normalizedShopId = normalizeText(shopId);
    const nextPayload = payload && typeof payload === 'object' ? payload : {};
    const enabled = enabledShopIdsSet.has(normalizedShopId);
    const baseState = buildDefaultShopState(normalizedShopId, enabled);
    const nextRegions = REGION_ENTRIES.reduce((result, region) => {
      result[region.id] = normalizeRegionState(
        region.id,
        nextPayload.regions && nextPayload.regions[region.id]
      );
      return result;
    }, {});

    return {
      ...baseState,
      enabled,
      status: enabled
        ? (
          batchMonitoringActive === true
            ? (normalizeText(nextPayload.status) || baseState.status)
            : 'idle'
        )
        : 'disabled',
      log: enabled
        ? (
          batchMonitoringActive === true
            ? normalizeText(nextPayload.log || baseState.log)
            : '已加入批量监控名单，等待开始'
        )
        : '未加入批量监控',
      lastUpdatedAt: normalizeText(nextPayload.lastUpdatedAt),
      lastSuccessAt: normalizeText(nextPayload.lastSuccessAt),
      lastError: normalizeText(nextPayload.lastError),
      nextRunAt: enabled
        ? (
          batchMonitoringActive === true
            ? Math.max(0, Number(nextPayload.nextRunAt) || 0)
            : Number.MAX_SAFE_INTEGER
        )
        : Number.MAX_SAFE_INTEGER,
      retryCount: Math.max(0, Number(nextPayload.retryCount) || 0),
      taskRunning: false,
      startupPauseResumeSweepPending: true,
      pauseResumeFallbackNextRunAt: Math.max(0, Number(nextPayload.pauseResumeFallbackNextRunAt) || 0),
      pauseResumeFallbackRetryCount: Math.max(0, Number(nextPayload.pauseResumeFallbackRetryCount) || 0),
      cookieHeaderByRegion: {},
      operationStats: normalizeOperationStats(nextPayload.operationStats),
      regions: nextRegions
    };
  }

  function normalizeConfig(payload, owner) {
    const baseConfig = buildDefaultConfig(owner);

    return {
      ...baseConfig,
      owner: baseConfig.owner,
      updatedAt: normalizeText(payload && payload.updatedAt) || baseConfig.updatedAt,
      // Batch monitoring is runtime-only and must never auto-resume from persisted state.
      batchMonitoringActive: false,
      enabledShopIds: normalizeEnabledShopIds(payload && payload.enabledShopIds)
    };
  }

  function buildPersistableConfig(payload, owner) {
    const normalizedConfig = normalizeConfig(payload, owner);

    return {
      version: normalizedConfig.version,
      owner: normalizedConfig.owner,
      updatedAt: normalizedConfig.updatedAt,
      enabledShopIds: normalizedConfig.enabledShopIds.slice()
    };
  }

  function normalizeState(payload, owner, enabledShopIds = [], batchMonitoringActive = false) {
    const baseState = buildDefaultState(owner);
    const enabledShopIdsSet = new Set(normalizeEnabledShopIds(enabledShopIds));
    const sourceShops = payload && payload.shops && typeof payload.shops === 'object'
      ? payload.shops
      : {};
    const normalizedShops = {};

    Object.entries(sourceShops).forEach(([shopId, shopState]) => {
      const normalizedShopId = normalizeText(shopId);

      if (!normalizedShopId) {
        return;
      }

      normalizedShops[normalizedShopId] = normalizeShopState(
        normalizedShopId,
        shopState,
        enabledShopIdsSet,
        batchMonitoringActive
      );
    });

    enabledShopIdsSet.forEach((shopId) => {
      if (!normalizedShops[shopId]) {
        normalizedShops[shopId] = buildDefaultShopState(shopId, true);
        if (batchMonitoringActive !== true) {
          normalizedShops[shopId].status = 'idle';
          normalizedShops[shopId].log = '已加入批量监控名单，等待开始';
          normalizedShops[shopId].nextRunAt = Number.MAX_SAFE_INTEGER;
        }
      }
    });

    return {
      ...baseState,
      owner: baseState.owner,
      updatedAt: nowIso(),
      shops: normalizedShops
    };
  }

  function buildSharedCloudState() {
    const shops = Object.fromEntries(
      Object.entries(stateCache.shops)
        .map(([shopId, shopState]) => [
          shopId,
          {
            shopId,
            operationStats: buildSharedOperationStatsPayload(shopState && shopState.operationStats)
          }
        ])
        .filter(([, shopState]) => Object.keys(shopState.operationStats).length > 0)
    );

    return {
      version: SERVICE_VERSION,
      owner: currentOwner ? {
        userId: currentOwner.userId,
        username: currentOwner.username,
        userKey: currentOwner.userKey
      } : null,
      updatedAt: nowIso(),
      shops
    };
  }

  function compactOperationStats(shopState) {
    if (!shopState || typeof shopState !== 'object') {
      return false;
    }

    const currentStats = shopState.operationStats;
    const nextStats = normalizeOperationStats(currentStats);
    const currentKeys = currentStats && typeof currentStats === 'object'
      ? Object.keys(currentStats)
      : [];
    const nextKeys = Object.keys(nextStats);
    const changed =
      currentKeys.length !== nextKeys.length
      || currentKeys.some((key) => !Object.prototype.hasOwnProperty.call(nextStats, key));

    shopState.operationStats = nextStats;
    return changed;
  }

  function compactStateOperationStats(targetState = stateCache) {
    if (!targetState || !targetState.shops || typeof targetState.shops !== 'object') {
      return false;
    }

    let changed = false;

    Object.values(targetState.shops).forEach((shopState) => {
      changed = compactOperationStats(shopState) || changed;
    });

    return changed;
  }

  function normalizeSharedCloudState(payload, owner) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const sourceShops = source.shops && typeof source.shops === 'object'
      ? source.shops
      : {};

    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: normalizeText(source.updatedAt) || nowIso(),
      shops: Object.fromEntries(
        Object.entries(sourceShops)
          .map(([shopId, shopState]) => {
            const normalizedShopId = normalizeText(shopId);

            if (!normalizedShopId) {
              return null;
            }

            return [
              normalizedShopId,
              {
                shopId: normalizedShopId,
                operationStats: normalizeOperationStats(shopState && shopState.operationStats)
              }
            ];
          })
          .filter(Boolean)
      )
    };
  }

  function parseIsoTimestamp(value) {
    const timestamp = Date.parse(normalizeText(value));

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function resolveNextLocalDayStartTimestamp(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return 0;
    }

    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  }

  function resolvePauseThenResumeDueAtFromPausedAt(pausedAtTimestamp, resumeIntervalMinutes) {
    const normalizedResumeIntervalMinutes = normalizeResumeIntervalMinutesValue(resumeIntervalMinutes);

    if (normalizedResumeIntervalMinutes === null) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (!Number.isFinite(pausedAtTimestamp) || pausedAtTimestamp <= 0) {
      return 0;
    }

    if (normalizedResumeIntervalMinutes === PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES) {
      return resolveNextLocalDayStartTimestamp(pausedAtTimestamp);
    }

    return pausedAtTimestamp + (normalizedResumeIntervalMinutes * 60 * 1000);
  }

  function resolveOperationPauseStateTimestamp(stat) {
    const normalizedStat = normalizeOperationStat(stat);

    return Math.max(
      parseIsoTimestamp(normalizedStat.pauseStateUpdatedAt),
      normalizedStat.knownPausedState === true ? parseIsoTimestamp(normalizedStat.pausedAt) : 0
    );
  }

  function mergeOperationStat(left, right) {
    const localStat = normalizeOperationStat(left);
    const cloudStat = normalizeOperationStat(right);
    const localLastExecutedAt = parseIsoTimestamp(localStat.lastExecutedAt);
    const cloudLastExecutedAt = parseIsoTimestamp(cloudStat.lastExecutedAt);
    const localPauseStateAt = resolveOperationPauseStateTimestamp(localStat);
    const cloudPauseStateAt = resolveOperationPauseStateTimestamp(cloudStat);
    const preferCloud =
      cloudLastExecutedAt > localLastExecutedAt
      || (
        cloudLastExecutedAt === localLastExecutedAt
        && cloudStat.totalCount > localStat.totalCount
      );
    const preferredStat = preferCloud ? cloudStat : localStat;
    const preferredPauseStateStat =
      cloudPauseStateAt > localPauseStateAt
        ? cloudStat
        : localStat;
    const latestDailyBucket = [localStat.dailyBucket, cloudStat.dailyBucket]
      .filter(Boolean)
      .sort()
      .pop() || '';

    return {
      ...preferredStat,
      dailyBucket: latestDailyBucket,
      dailyCount: latestDailyBucket
        ? (
          localStat.dailyBucket === latestDailyBucket && cloudStat.dailyBucket === latestDailyBucket
            ? Math.max(localStat.dailyCount, cloudStat.dailyCount)
            : (localStat.dailyBucket === latestDailyBucket ? localStat.dailyCount : cloudStat.dailyCount)
        )
        : 0,
      totalCount: Math.max(localStat.totalCount, cloudStat.totalCount),
      knownPausedState: preferredPauseStateStat.knownPausedState,
      pauseStateUpdatedAt: normalizeText(preferredPauseStateStat.pauseStateUpdatedAt),
      pausedAt: preferredPauseStateStat.knownPausedState === true
        ? normalizeText(preferredPauseStateStat.pausedAt)
        : ''
    };
  }

  function mergeOperationStats(left, right) {
    const leftStats = normalizeOperationStats(left);
    const rightStats = normalizeOperationStats(right);
    const statKeys = new Set([
      ...Object.keys(leftStats),
      ...Object.keys(rightStats)
    ]);
    const mergedStats = {};

    statKeys.forEach((statKey) => {
      mergedStats[statKey] = mergeOperationStat(leftStats[statKey], rightStats[statKey]);
    });

    return mergedStats;
  }

  function mergeSharedCloudStateInto(targetState, payload, enabledShopIds = configCache.enabledShopIds) {
    const normalizedSharedState = normalizeSharedCloudState(payload, currentOwner);
    const enabledShopIdsSet = new Set(normalizeEnabledShopIds(enabledShopIds));

    Object.entries(normalizedSharedState.shops).forEach(([shopId, sharedShopState]) => {
      if (!targetState.shops[shopId]) {
        targetState.shops[shopId] = buildDefaultShopState(
          shopId,
          enabledShopIdsSet.has(shopId)
        );
      }

      targetState.shops[shopId].operationStats = mergeOperationStats(
        targetState.shops[shopId].operationStats,
        sharedShopState.operationStats
      );
    });

    return targetState;
  }

  async function ensureLoaded() {
    const owner = getOwner();

    if (!owner) {
      loadedOwnerKey = '';
      currentOwner = null;
      configCache = buildDefaultConfig(null);
      stateCache = buildDefaultState(null);
      sharedStateDirty = false;
      sharedStateLoadedAt = 0;
      sharedStateRevision = 0;
      sharedStatePersistedRevision = 0;
      return null;
    }

    if (loadedOwnerKey === owner.userKey) {
      return owner;
    }

    const {
      configFilePath,
      stateFilePath,
      cloudConfigKey,
      cloudStateKey
    } = getStoragePaths(owner);
    const localConfig = await readJsonFile(configFilePath).catch(() => null);
    let cloudConfig = null;

    try {
      cloudConfig = await readCloudJson(cloudConfigKey);
    } catch (error) {
      logError('promotion_monitor_config_cloud_read_failed', error, {
        ownerUserKey: owner.userKey
      });
    }

    const persistedConfig = pickNewerPayload(localConfig, cloudConfig);
    const normalizedConfig = normalizeConfig(persistedConfig, owner);
    const persistedState = await readJsonFile(stateFilePath).catch(() => null);
    const normalizedState = normalizeState(
      persistedState,
      owner,
      normalizedConfig.enabledShopIds,
      normalizedConfig.batchMonitoringActive
    );

    currentOwner = owner;
    loadedOwnerKey = owner.userKey;
    try {
      const cloudState = await readCloudJson(cloudStateKey);

      if (cloudState) {
        mergeSharedCloudStateInto(normalizedState, cloudState, normalizedConfig.enabledShopIds);
      }
    } catch (error) {
      logError('promotion_monitor_state_cloud_read_failed', error, {
        ownerUserKey: owner.userKey
      });
    }

    configCache = normalizedConfig;
    stateCache = normalizedState;
    const stateCompacted = compactStateOperationStats(stateCache);
    sharedStateDirty = false;
    sharedStateLoadedAt = Date.now();
    sharedStateRevision = 0;
    sharedStatePersistedRevision = 0;

    void persistConfig().catch((error) => {
      logError('promotion_monitor_config_bootstrap_sync_failed', error, {
        ownerUserKey: owner.userKey
      });
    });

    if (
      stateCompacted === true
      ||
      Object.values(stateCache.shops).some((shopState) => (
        Object.keys(normalizeOperationStats(shopState && shopState.operationStats)).length > 0
      ))
    ) {
      sharedStateDirty = true;
      sharedStateRevision += 1;
      scheduleSharedStatePersist(SHARED_STATE_CLOUD_PERSIST_DELAY_MS);
    }

    return owner;
  }

  function getShopRuntimeState(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return null;
    }

    if (!stateCache.shops[normalizedShopId]) {
      stateCache.shops[normalizedShopId] = buildDefaultShopState(
        normalizedShopId,
        configCache.enabledShopIds.includes(normalizedShopId)
      );
    }

    return stateCache.shops[normalizedShopId];
  }

  function buildPersistableState() {
    const shops = Object.fromEntries(
      Object.entries(stateCache.shops).map(([shopId, shopState]) => [
        shopId,
        {
          shopId,
          enabled: shopState.enabled === true,
          status: normalizeText(shopState.status),
          log: normalizeText(shopState.log),
          lastUpdatedAt: normalizeText(shopState.lastUpdatedAt),
          lastSuccessAt: normalizeText(shopState.lastSuccessAt),
          lastError: normalizeText(shopState.lastError),
          nextRunAt: Math.max(0, Number(shopState.nextRunAt) || 0),
          retryCount: Math.max(0, Number(shopState.retryCount) || 0),
          pauseResumeFallbackNextRunAt: Math.max(
            0,
            Number(shopState.pauseResumeFallbackNextRunAt) || 0
          ),
          pauseResumeFallbackRetryCount: Math.max(
            0,
            Number(shopState.pauseResumeFallbackRetryCount) || 0
          ),
          operationStats: normalizeOperationStats(shopState.operationStats),
          regions: REGION_ENTRIES.reduce((result, region) => {
            result[region.id] = normalizeRegionState(
              region.id,
              shopState.regions && shopState.regions[region.id]
            );
            return result;
          }, {})
        }
      ])
    );

    return {
      version: SERVICE_VERSION,
      owner: currentOwner ? {
        userId: currentOwner.userId,
        username: currentOwner.username,
        userKey: currentOwner.userKey
      } : null,
      updatedAt: nowIso(),
      shops
    };
  }

  async function persistConfig() {
    if (!currentOwner) {
      return;
    }

    const normalizedConfig = {
      ...normalizeConfig(configCache, currentOwner),
      batchMonitoringActive: configCache.batchMonitoringActive === true
    };
    const persistableConfig = buildPersistableConfig(normalizedConfig, currentOwner);
    const { configFilePath, cloudConfigKey } = getStoragePaths(currentOwner);

    configCache = normalizedConfig;
    await writeJsonFile(configFilePath, persistableConfig);

    try {
      await writeCloudJson(
        cloudConfigKey,
        persistableConfig,
        {
          record_type: 'promotion-monitor-config',
          owner_user_key: currentOwner.userKey,
          owner_username: currentOwner.username
        }
      );
    } catch (error) {
      logError('promotion_monitor_config_cloud_write_failed', error, {
        ownerUserKey: currentOwner.userKey
      });
    }
  }

  async function persistState() {
    if (!currentOwner) {
      return;
    }

    const { stateFilePath } = getStoragePaths(currentOwner);
    compactStateOperationStats(stateCache);
    const persistableState = buildPersistableState();

    await writeJsonFile(stateFilePath, persistableState);
  }

  async function persistSharedState() {
    if (!currentOwner) {
      sharedStateDirty = false;
      sharedStatePersistedRevision = sharedStateRevision;
      return;
    }

    if (sharedStateDirty !== true) {
      return;
    }

    const { cloudStateKey } = getStoragePaths(currentOwner);
    const sharedStatePayload = buildSharedCloudState();
    const targetRevision = sharedStateRevision;

    await writeCloudJson(
      cloudStateKey,
      sharedStatePayload,
      {
        record_type: 'promotion-monitor-state',
        owner_user_key: currentOwner.userKey,
        owner_username: currentOwner.username
      }
    );

    sharedStatePersistedRevision = Math.max(sharedStatePersistedRevision, targetRevision);
    sharedStateDirty = sharedStatePersistedRevision < sharedStateRevision;
    sharedStateLoadedAt = Date.now();

    if (sharedStateDirty === true) {
      scheduleSharedStatePersist(SHARED_STATE_CLOUD_PERSIST_DELAY_MS);
    }
  }

  function scheduleStatePersist(delayMs = 0) {
    if (persistStateTimer) {
      clearTimeout(persistStateTimer);
      persistStateTimer = 0;
    }

    persistStateTimer = setTimeout(() => {
      persistStateTimer = 0;
      persistState().catch((error) => {
        logError('promotion_monitor_state_persist_failed', error);
      });
    }, Math.max(0, Number(delayMs) || 0));
  }

  function scheduleSharedStatePersist(delayMs = 0) {
    if (persistSharedStateTimer) {
      clearTimeout(persistSharedStateTimer);
      persistSharedStateTimer = 0;
    }

    persistSharedStateTimer = setTimeout(() => {
      persistSharedStateTimer = 0;
      persistSharedState().catch((error) => {
        logError('promotion_monitor_shared_state_persist_failed', error);

        if (sharedStateDirty === true) {
          scheduleSharedStatePersist(30000);
        }
      });
    }, Math.max(0, Number(delayMs) || 0));
  }

  function scheduleScheduler(delayMs = LOOP_INTERVAL_MS) {
    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = 0;
    }

    schedulerTimer = setTimeout(() => {
      schedulerTimer = 0;
      void runScheduler();
    }, Math.max(0, Number(delayMs) || 0));
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  async function readLocalShopManagementState() {
    if (
      !shopManagementService
      || typeof shopManagementService.getLocalState !== 'function'
    ) {
      return null;
    }

    const state = await shopManagementService.getLocalState();

    return state && state.localStateAvailable === true ? state : null;
  }

  async function buildShopControllerPayload(shopId) {
    const payload = {
      shopId: normalizeText(shopId)
    };

    try {
      const state = await readLocalShopManagementState();
      const matchedShop = Array.isArray(state && state.shops)
        ? state.shops.find((shop) => normalizeText(shop && shop.id) === payload.shopId)
        : null;

      if (matchedShop) {
        payload.shopUpdatedAt = normalizeText(matchedShop.updatedAt);
      }
    } catch (_error) {
      // Ignore state lookup failures and fall back to shop id only.
    }

    return payload;
  }

  async function resolveShopLogMeta(shopId) {
    const normalizedShopId = normalizeText(shopId);
    const payload = {
      shopId: normalizedShopId,
      shopName: ''
    };

    if (
      !normalizedShopId
    ) {
      return payload;
    }

    try {
      const state = await readLocalShopManagementState();
      const matchedShop = Array.isArray(state && state.shops)
        ? state.shops.find((shop) => normalizeText(shop && shop.id) === normalizedShopId)
        : null;

      if (matchedShop) {
        payload.shopName = normalizeText(
          matchedShop.shopName
          || matchedShop.name
          || matchedShop.storeName
          || matchedShop.label
        );
      }
    } catch (_error) {
      // Ignore shop label lookup failures and fall back to shop id only.
    }

    return payload;
  }

  async function loadManagedShopDirectory() {
    if (
      !shopManagementService
      || typeof shopManagementService.getLocalState !== 'function'
    ) {
      return {
        loaded: false,
        shops: [],
        shopMap: new Map()
      };
    }

    try {
      const state = await readLocalShopManagementState();

      if (!state) {
        return {
          loaded: false,
          shops: [],
          shopMap: new Map()
        };
      }

      const shops = Array.isArray(state && state.shops) ? state.shops : [];
      const shopMap = new Map(
        shops
          .map((shop) => [normalizeText(shop && shop.id), shop])
          .filter(([shopId]) => Boolean(shopId))
      );

      return {
        loaded: true,
        shops,
        shopMap
      };
    } catch (_error) {
      return {
        loaded: false,
        shops: [],
        shopMap: new Map()
      };
    }
  }

  function applyUnavailableMonitorShopState(shopState, reasonLog = '') {
    if (!shopState) {
      return false;
    }

    const resolvedReasonLog =
      normalizeText(reasonLog)
      || '\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u4E0D\u518D\u53C2\u4E0E\u63A8\u5E7F\u76D1\u63A7';
    let changed = false;

    if (shopState.enabled !== false) {
      shopState.enabled = false;
      changed = true;
    }

    if (shopState.taskRunning !== false) {
      shopState.taskRunning = false;
      changed = true;
    }

    if (shopState.retryCount !== 0) {
      shopState.retryCount = 0;
      changed = true;
    }

    if (shopState.pauseResumeFallbackRetryCount !== 0) {
      shopState.pauseResumeFallbackRetryCount = 0;
      changed = true;
    }

    if (normalizeText(shopState.status) !== 'disabled') {
      shopState.status = 'disabled';
      changed = true;
    }

    if (normalizeText(shopState.log) !== resolvedReasonLog) {
      shopState.log = resolvedReasonLog;
      changed = true;
    }

    if (normalizeText(shopState.lastError)) {
      shopState.lastError = '';
      changed = true;
    }

    if (Math.max(0, Number(shopState.nextRunAt) || 0) !== Number.MAX_SAFE_INTEGER) {
      shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
      changed = true;
    }

    if (Math.max(0, Number(shopState.pauseResumeFallbackNextRunAt) || 0) !== Number.MAX_SAFE_INTEGER) {
      shopState.pauseResumeFallbackNextRunAt = Number.MAX_SAFE_INTEGER;
      changed = true;
    }

    if (
      shopState.cookieHeaderByRegion
      && Object.keys(shopState.cookieHeaderByRegion).length > 0
    ) {
      shopState.cookieHeaderByRegion = {};
      changed = true;
    }

    if (changed) {
      shopState.lastUpdatedAt = nowIso();
    }

    return changed;
  }

  async function reconcileManagedShopAvailability() {
    const directory = await loadManagedShopDirectory();

    if (directory.loaded !== true) {
      return directory;
    }

    let configChanged = false;
    let stateChanged = false;
    const nextEnabledShopIds = [];

    configCache.enabledShopIds.forEach((shopId) => {
      const normalizedShopId = normalizeText(shopId);

      if (!normalizedShopId) {
        configChanged = true;
        return;
      }

      const matchedShop = directory.shopMap.get(normalizedShopId);

      if (matchedShop && isShopParticipating(matchedShop)) {
        nextEnabledShopIds.push(normalizedShopId);
        return;
      }

      configChanged = true;
      stateChanged = applyUnavailableMonitorShopState(
        getShopRuntimeState(normalizedShopId),
        matchedShop
          ? '\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u4E0D\u518D\u53C2\u4E0E\u63A8\u5E7F\u76D1\u63A7'
          : '\u5E97\u94FA\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u4E0D\u518D\u53C2\u4E0E\u63A8\u5E7F\u76D1\u63A7'
      ) || stateChanged;

      if (
        promotionMasterSessionService
        && typeof promotionMasterSessionService.invalidateShopCache === 'function'
      ) {
        promotionMasterSessionService.invalidateShopCache(normalizedShopId);
      }
    });

    if (configChanged) {
      configCache.enabledShopIds = nextEnabledShopIds;
      configCache.updatedAt = nowIso();
      await persistConfig();
    }

    if (stateChanged) {
      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
    }

    return {
      ...directory,
      configChanged,
      stateChanged
    };
  }

  function sleep(delayMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
    });
  }

  function buildAdsDetailPayload(options = {}) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rawSortBy = Number(options.sortBy);
    const sortBy = (
      rawSortBy === ADS_DETAIL_SORT_BY_PAUSED_STATUS
      || rawSortBy === ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT
      || rawSortBy === ADS_DETAIL_SORT_BY_TOTAL_SPEND
    )
      ? rawSortBy
      : ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT;
    const pageNumber = Math.max(1, Number(options.pageNumber) || 1);
    const pageSize = Math.max(1, Number.parseInt(options.pageSize, 10) || ADS_DETAIL_PAGE_SIZE);
    const adStatus = Array.isArray(options.adStatus)
      ? options.adStatus
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value >= 0)
      : [];

    return {
      ad_status: adStatus,
      ad_advice_types: [],
      page_size: pageSize,
      page_number: pageNumber,
      specific_query_info: '',
      sort_by: sortBy,
      sort_type: 'desc',
      start_time: startOfDay.getTime(),
      end_time: now.getTime(),
      need_calculate_goods_summary: true,
      list_id: typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`,
      columns_type: 11,
      filter_cooperative_ad_type: 0,
      ad_phase: -1
    };
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function normalizeMetricAlias(value) {
    return normalizeText(value)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  function buildAliasMatcher(aliases) {
    return new Set(
      (Array.isArray(aliases) ? aliases : [aliases])
        .map((alias) => normalizeMetricAlias(alias))
        .filter(Boolean)
    );
  }

  function extractValueCandidate(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (typeof value === 'string') {
      return normalizeText(value);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return '';
      }

      return value.toLocaleString('zh-CN', {
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2
      });
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const candidate = extractValueCandidate(item);

        if (candidate) {
          return candidate;
        }
      }

      return '';
    }

    if (!isPlainObject(value)) {
      return '';
    }

    const keys = [
      'displayValue',
      'display_value',
      'displayText',
      'display_text',
      'display',
      'formattedValue',
      'formatted_value',
      'formatValue',
      'format_value',
      'formatted',
      'valueText',
      'value_text',
      'valueStr',
      'value_str',
      'showValue',
      'show_value',
      'text',
      'label',
      'value',
      'val',
      'amount',
      'ratio',
      'percent',
      'num',
      'count'
    ];

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const candidate = extractValueCandidate(value[key]);

        if (candidate) {
          return candidate;
        }
      }
    }

    const fallbackCandidate = Object.entries(value)
      .filter(([key]) => ![
        'id',
        'key',
        'code',
        'name',
        'metric',
        'field',
        'columnId',
        'column_id',
        'indicatorId',
        'indicator_id',
        'type',
        'dataType',
        'data_type'
      ].includes(key))
      .map(([, candidateValue]) => extractValueCandidate(candidateValue))
      .find(Boolean);

    if (fallbackCandidate) {
      return fallbackCandidate;
    }

    return '';
  }

  function resolveSummaryContainer(payload) {
    const candidates = [
      payload && payload.result && payload.result.reports_summary,
      payload && payload.result && payload.result.summary,
      payload && payload.reports_summary,
      payload && payload.summary,
      payload && payload.result,
      payload
    ];

    return candidates.find((candidate) => isPlainObject(candidate) || Array.isArray(candidate)) || {};
  }

  function extractRecordValueByAlias(record, aliasMatcher) {
    if (!isPlainObject(record) || !(aliasMatcher instanceof Set) || aliasMatcher.size === 0) {
      return '';
    }

    const identityKeys = [
      'id',
      'key',
      'code',
      'name',
      'metric',
      'field',
      'columnId',
      'column_id',
      'indicatorId',
      'indicator_id',
      'type',
      'dataType',
      'data_type',
      'title'
    ];

    const hasAliasIdentity = identityKeys.some((key) => (
      Object.prototype.hasOwnProperty.call(record, key)
      && aliasMatcher.has(normalizeMetricAlias(record[key]))
    ));

    if (!hasAliasIdentity) {
      return '';
    }

    const preferredValueKeys = [
      'displayValue',
      'display_value',
      'displayText',
      'display_text',
      'display',
      'formattedValue',
      'formatted_value',
      'formatValue',
      'format_value',
      'formatted',
      'valueText',
      'value_text',
      'valueStr',
      'value_str',
      'showValue',
      'show_value',
      'value',
      'val',
      'amount',
      'ratio',
      'percent',
      'num',
      'count',
      'text',
      'label'
    ];

    for (const key of preferredValueKeys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        continue;
      }

      const candidate = extractValueCandidate(record[key]);

      if (candidate) {
        return candidate;
      }
    }

    return Object.entries(record)
      .filter(([key]) => !identityKeys.includes(key))
      .map(([, value]) => extractValueCandidate(value))
      .find(Boolean) || '';
  }

  function findValueByAlias(container, aliases, depth = 0) {
    if (depth > 4 || container === null || container === undefined) {
      return '';
    }

    const aliasMatcher = buildAliasMatcher(aliases);

    if (aliasMatcher.size === 0) {
      return '';
    }

    if (Array.isArray(container)) {
      for (const item of container) {
        const directValue = extractRecordValueByAlias(item, aliasMatcher);

        if (directValue) {
          return directValue;
        }
      }

      for (const item of container) {
        const nestedValue = findValueByAlias(item, aliases, depth + 1);

        if (nestedValue) {
          return nestedValue;
        }
      }

      return '';
    }

    if (!isPlainObject(container)) {
      return '';
    }

    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(container, alias)) {
        const directValue = extractValueCandidate(container[alias]);

        if (directValue) {
          return directValue;
        }
      }
    }

    for (const [key, value] of Object.entries(container)) {
      if (!aliasMatcher.has(normalizeMetricAlias(key))) {
        continue;
      }

      const directValue = extractValueCandidate(value);

      if (directValue) {
        return directValue;
      }
    }

    const recordValue = extractRecordValueByAlias(container, aliasMatcher);

    if (recordValue) {
      return recordValue;
    }

    const nestedKeys = [
      'data',
      'metrics',
      'values',
      'summary',
      'reports_summary',
      'result',
      'list',
      'items',
      'rows',
      'allData',
      'adData',
      'netData',
      'all_data',
      'ad_data',
      'net_data'
    ];

    for (const nestedKey of nestedKeys) {
      if (!Object.prototype.hasOwnProperty.call(container, nestedKey)) {
        continue;
      }

      const nestedValue = findValueByAlias(container[nestedKey], aliases, depth + 1);

      if (nestedValue) {
        return nestedValue;
      }
    }

    for (const [key, value] of Object.entries(container)) {
      if (nestedKeys.includes(key)) {
        continue;
      }

      const nestedValue = findValueByAlias(value, aliases, depth + 1);

      if (nestedValue) {
        return nestedValue;
      }
    }

    return '';
  }

  function parseMetricNumber(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const text = normalizeText(value);

    if (!text || text === '--') {
      return null;
    }

    const normalized = text
      .replace(/[%％,\s]/g, '')
      .replace(/[^\d.-]/g, '');

    if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatMetricNumber(value, options = {}) {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: Math.max(0, Number(options.minimumFractionDigits) || 0),
      maximumFractionDigits: Math.max(
        Math.max(0, Number(options.minimumFractionDigits) || 0),
        Number(options.maximumFractionDigits) || 0
      )
    });
  }

  function shouldScaleIntegerMetricValue(rawValue) {
    const text = normalizeText(rawValue);

    if (!text || text === '--') {
      return false;
    }

    return !/[.%％]/.test(text);
  }

  function normalizeMoneyMetricValue(rawValue) {
    const numericValue = parseMetricNumber(rawValue);

    if (numericValue === null) {
      return null;
    }

    return shouldScaleIntegerMetricValue(rawValue)
      ? numericValue / 100
      : numericValue;
  }

  function normalizeMetricDisplayValue(columnId, rawValue) {
    const text = normalizeText(rawValue);

    if (!text) {
      return '--';
    }

    const numericValue = parseMetricNumber(rawValue);

    if (numericValue === null) {
      return text || '--';
    }

    if (MONEY_COLUMN_ID_SET.has(columnId)) {
      const normalizedValue = shouldScaleIntegerMetricValue(text)
        ? numericValue / 100
        : numericValue;

      return formatMetricNumber(normalizedValue, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (PERCENT_COLUMN_ID_SET.has(columnId)) {
      const normalizedValue = shouldScaleIntegerMetricValue(text)
        ? numericValue / 100
        : numericValue;

      return `${formatMetricNumber(normalizedValue, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })}%`;
    }

    if (RATIO_COLUMN_ID_SET.has(columnId)) {
      const normalizedValue = shouldScaleIntegerMetricValue(text)
        ? numericValue / 100
        : numericValue;

      return formatMetricNumber(normalizedValue, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }

    return text;
  }

  function mapSummaryToMetrics(summaryContainer) {
    return MONITOR_COLUMN_IDS.reduce((result, columnId) => {
      const aliases = COLUMN_VALUE_ALIASES[columnId] || [columnId];

      result[columnId] = normalizeMetricDisplayValue(
        columnId,
        findValueByAlias(summaryContainer, aliases) || '--'
      );
      return result;
    }, {});
  }

  function resolvePromotionOrderCountFromSummary(summaryContainer) {
    return Math.max(
      0,
      Math.round(
        parseMetricNumber(findValueByAlias(summaryContainer, COLUMN_VALUE_ALIASES.order_pay_count_label)) || 0
      )
    );
  }

  function resolveSummaryGoodsCount(summaryContainer) {
    const preferredCount =
      parseMetricNumber(findValueByAlias(summaryContainer, COLUMN_VALUE_ALIASES.goods_num_label));
    const fallbackCount =
      parseMetricNumber(findValueByAlias(summaryContainer, COLUMN_VALUE_ALIASES.goods_num_all));
    const resolvedCount = preferredCount !== null ? preferredCount : fallbackCount;

    return Math.max(0, Math.round(resolvedCount || 0));
  }

  async function loadMonitorConfig(options = {}) {
    const now = Date.now();

    if (
      options.force !== true
      && monitorConfigCache
      && now - monitorConfigLoadedAt < MONITOR_SETTINGS_REFRESH_MS
    ) {
      return monitorConfigCache;
    }

    let settingsGetter = null;

    if (
      promotionManagerSettingsService
      && typeof promotionManagerSettingsService.getCachedSettings === 'function'
    ) {
      settingsGetter = promotionManagerSettingsService.getCachedSettings.bind(promotionManagerSettingsService);
    } else if (
      promotionManagerSettingsService
      && typeof promotionManagerSettingsService.getSettings === 'function'
    ) {
      settingsGetter = promotionManagerSettingsService.getSettings.bind(promotionManagerSettingsService);
    }

    let settingsResult = null;

    if (settingsGetter) {
      settingsResult = await settingsGetter().catch(() => null);
    }

    monitorConfigCache = normalizeMonitorConfigBundle(
      settingsResult && settingsResult.settings ? settingsResult.settings : null
    );
    monitorConfigLoadedAt = now;

    return monitorConfigCache;
  }

  function extractIntegerByAliases(container, aliases, depth = 0) {
    if (depth > 4 || container === null || container === undefined) {
      return null;
    }

    if (Array.isArray(container)) {
      for (const item of container) {
        const nestedValue = extractIntegerByAliases(item, aliases, depth + 1);

        if (nestedValue !== null) {
          return nestedValue;
        }
      }

      return null;
    }

    if (!isPlainObject(container)) {
      return null;
    }

    const aliasMatcher = buildAliasMatcher(aliases);

    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(container, alias)) {
        continue;
      }

      const directValue = parseMetricNumber(container[alias]);

      if (directValue !== null) {
        return Math.round(directValue);
      }
    }

    for (const [key, value] of Object.entries(container)) {
      if (!aliasMatcher.has(normalizeMetricAlias(key))) {
        continue;
      }

      const directValue = parseMetricNumber(value);

      if (directValue !== null) {
        return Math.round(directValue);
      }
    }

    for (const value of Object.values(container)) {
      const nestedValue = extractIntegerByAliases(value, aliases, depth + 1);

      if (nestedValue !== null) {
        return nestedValue;
      }
    }

    return null;
  }

  function extractBooleanByAliases(container, aliases, depth = 0) {
    if (depth > 4 || container === null || container === undefined) {
      return null;
    }

    if (Array.isArray(container)) {
      for (const item of container) {
        const nestedValue = extractBooleanByAliases(item, aliases, depth + 1);

        if (typeof nestedValue === 'boolean') {
          return nestedValue;
        }
      }

      return null;
    }

    if (!isPlainObject(container)) {
      return null;
    }

    const aliasMatcher = buildAliasMatcher(aliases);

    for (const [key, value] of Object.entries(container)) {
      if (!aliasMatcher.has(normalizeMetricAlias(key))) {
        continue;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      const normalizedValue = normalizeText(value).toLowerCase();

      if (normalizedValue === 'true' || normalizedValue === '1') {
        return true;
      }

      if (normalizedValue === 'false' || normalizedValue === '0') {
        return false;
      }
    }

    for (const value of Object.values(container)) {
      const nestedValue = extractBooleanByAliases(value, aliases, depth + 1);

      if (typeof nestedValue === 'boolean') {
        return nestedValue;
      }
    }

    return null;
  }

  function buildAdsDetailPagePayload(pageNumber, options = {}) {
    return buildAdsDetailPayload({
      ...options,
      pageNumber
    });
  }

  function normalizeRoasRawValue(rawValue) {
    const numericValue = parseMetricNumber(rawValue);

    if (numericValue === null || numericValue <= 0) {
      return null;
    }

    const text = normalizeText(rawValue);
    const scaleByTenThousand =
      numericValue < 1000
      || /[.]/.test(text);

    return Math.round(scaleByTenThousand ? numericValue * 10000 : numericValue);
  }

  function resolveAdsDetailPausedState(item) {
    if (!isPlainObject(item)) {
      return null;
    }

    const showStatusCode = extractIntegerByAliases(item, ADS_DETAIL_SHOW_STATUS_ALIASES);

    if (showStatusCode !== null) {
      if (showStatusCode === ADS_DETAIL_PAUSED_STATUS_CODE) {
        return true;
      }

      if (showStatusCode === ADS_DETAIL_RUNNING_STATUS_CODE) {
        return false;
      }
    }

    const pausedFlag = extractBooleanByAliases(item, ADS_DETAIL_PAUSED_FLAG_ALIASES);

    if (typeof pausedFlag === 'boolean') {
      return pausedFlag;
    }

    const statusCode = extractIntegerByAliases(item, ADS_DETAIL_STATUS_ALIASES);

    if (statusCode !== null) {
      if (statusCode === ADS_DETAIL_PAUSED_STATUS_CODE || statusCode === ADS_MODIFY_STATUS_PAUSE) {
        return true;
      }

      if (statusCode === ADS_DETAIL_RUNNING_STATUS_CODE || statusCode === ADS_MODIFY_STATUS_RESUME || statusCode === 1) {
        return false;
      }
    }

    const statusText = normalizeText(
      findValueByAlias(item, ADS_DETAIL_STATUS_TEXT_ALIASES)
      || findValueByAlias(item, ADS_DETAIL_STATUS_ALIASES)
    ).toLowerCase();

    if (!statusText) {
      return null;
    }

    if (
      /\u6682\u505c/.test(statusText)
      || /\u505c\u7528/.test(statusText)
      || /paus(?:e|ed)?/.test(statusText)
      || /suspend(?:ed)?/.test(statusText)
    ) {
      return true;
    }

    if (
      /\u542f\u7528/.test(statusText)
      || /\u6295\u653e/.test(statusText)
      || /running/.test(statusText)
      || /active/.test(statusText)
      || /enabled?/.test(statusText)
    ) {
      return false;
    }

    return null;
  }

  function collectAdsDetailArrayCandidates(container, candidates, depth = 0) {
    if (depth > 4 || container === null || container === undefined) {
      return;
    }

    if (Array.isArray(container)) {
      candidates.push(container);
      container.forEach((item) => {
        collectAdsDetailArrayCandidates(item, candidates, depth + 1);
      });
      return;
    }

    if (!isPlainObject(container)) {
      return;
    }

    ADS_DETAIL_ITEM_LIST_KEYS.forEach((key) => {
      if (Array.isArray(container[key])) {
        candidates.push(container[key]);
      }
    });

    Object.values(container).forEach((value) => {
      if (isPlainObject(value) || Array.isArray(value)) {
        collectAdsDetailArrayCandidates(value, candidates, depth + 1);
      }
    });
  }

  function normalizeAdsDetailItem(item, regionId) {
    if (!isPlainObject(item)) {
      return null;
    }

    const goodsId = normalizeText(findValueByAlias(item, ADS_DETAIL_GOODS_ID_ALIASES));
    const adId = normalizeText(findValueByAlias(item, ADS_DETAIL_AD_ID_ALIASES));
    const productName = normalizeText(findValueByAlias(item, ADS_DETAIL_PRODUCT_NAME_ALIASES));

    if (!goodsId && !adId) {
      return null;
    }

    return {
      regionId: normalizeText(regionId),
      goodsId,
      adId,
      productName,
      adSpend: normalizeMoneyMetricValue(findValueByAlias(item, COLUMN_VALUE_ALIASES.ad_spend_label)),
      orderCount: parseMetricNumber(findValueByAlias(item, COLUMN_VALUE_ALIASES.order_pay_count_label)) || 0,
      currentRoasRaw: normalizeRoasRawValue(findValueByAlias(item, COLUMN_VALUE_ALIASES.roas_label)),
      targetRoasRaw: normalizeRoasRawValue(findValueByAlias(item, ADS_DETAIL_TARGET_ROAS_ALIASES)),
      isPaused: resolveAdsDetailPausedState(item),
      raw: item
    };
  }

  function extractAdsDetailItems(payload, regionId) {
    const candidates = [];
    const roots = [
      payload && payload.result,
      payload && payload.data,
      payload
    ];
    let bestItems = [];

    roots.forEach((root) => {
      collectAdsDetailArrayCandidates(root, candidates);
    });

    candidates.forEach((candidateArray) => {
      const items = candidateArray
        .map((item) => normalizeAdsDetailItem(item, regionId))
        .filter(Boolean);

      if (items.length > bestItems.length) {
        bestItems = items;
      }
    });

    return bestItems;
  }

  function detectAdsDetailHasMore(payload, pageNumber, rowCount) {
    const responseData = payload && typeof payload === 'object' ? payload : {};
    const resultData = responseData.result && typeof responseData.result === 'object'
      ? responseData.result
      : {};
    const hasMore = extractBooleanByAliases(
      { ...responseData, ...resultData },
      ADS_DETAIL_HAS_MORE_ALIASES
    );

    if (typeof hasMore === 'boolean') {
      return hasMore;
    }

    const totalPage = extractIntegerByAliases(
      { ...responseData, ...resultData },
      ADS_DETAIL_TOTAL_PAGE_ALIASES
    );

    if (totalPage !== null) {
      return pageNumber < totalPage;
    }

    const totalCount = extractIntegerByAliases(
      { ...responseData, ...resultData },
      ADS_DETAIL_TOTAL_COUNT_ALIASES
    );

    if (totalCount !== null) {
      return pageNumber * ADS_DETAIL_PAGE_SIZE < totalCount;
    }

    return rowCount >= ADS_DETAIL_PAGE_SIZE;
  }

  function shouldContinueAdsDetailPaging(items, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      return false;
    }

    if (Number(options.sortBy) === ADS_DETAIL_SORT_BY_PAUSED_STATUS) {
      return true;
    }

    const lastItem = items[items.length - 1];

    if (Number(options.sortBy) === ADS_DETAIL_SORT_BY_TOTAL_SPEND) {
      const spendThreshold = Number.isFinite(Number(options.spendThreshold))
        ? Number(options.spendThreshold)
        : null;
      const lastAdSpend = typeof (lastItem && lastItem.adSpend) === 'number'
        && Number.isFinite(lastItem.adSpend)
        ? lastItem.adSpend
        : null;

      return spendThreshold !== null && lastAdSpend !== null && lastAdSpend > spendThreshold;
    }

    return Math.max(0, Number(lastItem && lastItem.orderCount) || 0) >= ADS_DETAIL_MIN_ORDER_COUNT_FOR_PAGING;
  }

  function buildAdsDetailItemKey(item, fallbackRegionId = '') {
    const resolvedRegionId = normalizeText(item && item.regionId) || normalizeText(fallbackRegionId);
    const goodsId = normalizeText(item && item.goodsId);
    const adId = normalizeText(item && item.adId);

    return [resolvedRegionId || 'all', goodsId || '-', adId || '-'].join('::');
  }

  function mergeAdsDetailItem(left, right) {
    const previousItem = left && typeof left === 'object' ? left : null;
    const nextItem = right && typeof right === 'object' ? right : null;

    if (!previousItem) {
      return nextItem;
    }

    if (!nextItem) {
      return previousItem;
    }

    return {
      regionId: normalizeText(nextItem.regionId) || normalizeText(previousItem.regionId),
      goodsId: normalizeText(nextItem.goodsId) || normalizeText(previousItem.goodsId),
      adId: normalizeText(nextItem.adId) || normalizeText(previousItem.adId),
      productName: normalizeText(nextItem.productName) || normalizeText(previousItem.productName),
      adSpend: typeof nextItem.adSpend === 'number' && Number.isFinite(nextItem.adSpend)
        ? nextItem.adSpend
        : previousItem.adSpend,
      orderCount: Math.max(
        0,
        Number(nextItem.orderCount) || 0,
        Number(previousItem.orderCount) || 0
      ),
      targetRoasRaw: nextItem.targetRoasRaw !== null && nextItem.targetRoasRaw !== undefined
        ? nextItem.targetRoasRaw
        : previousItem.targetRoasRaw,
      currentRoasRaw: nextItem.currentRoasRaw !== null && nextItem.currentRoasRaw !== undefined
        ? nextItem.currentRoasRaw
        : previousItem.currentRoasRaw,
      isPaused: typeof nextItem.isPaused === 'boolean'
        ? nextItem.isPaused
        : previousItem.isPaused,
      raw: nextItem.raw || previousItem.raw
    };
  }

  function mergeAdsDetailItemLists(itemLists, fallbackRegionId = '') {
    const mergedItemMap = new Map();

    (Array.isArray(itemLists) ? itemLists : []).forEach((items) => {
      (Array.isArray(items) ? items : []).forEach((item) => {
        const itemKey = buildAdsDetailItemKey(item, fallbackRegionId);

        if (!mergedItemMap.has(itemKey)) {
          mergedItemMap.set(itemKey, item);
          return;
        }

        mergedItemMap.set(itemKey, mergeAdsDetailItem(mergedItemMap.get(itemKey), item));
      });
    });

    return Array.from(mergedItemMap.values());
  }

  function buildAdsDetailRequestFailureMessage(response, fallbackMessage) {
    const baseMessage = normalizeText(fallbackMessage) || 'ads_detail request failed';
    const directMessage = normalizeText(response && response.message);

    if (directMessage) {
      return directMessage;
    }

    const httpStatus = Math.max(
      0,
      Number(response && response.httpStatus) || Number(response && response.status) || 0
    );
    const statusText = normalizeText(response && response.statusText);
    const errorCode = Number(response && response.errorCode);
    const responsePreview = normalizeText(response && response.responseTextPreview)
      .replace(/\s+/g, ' ')
      .slice(0, 160);
    let reason = '';

    if (httpStatus > 0) {
      reason = `HTTP ${httpStatus}${statusText ? ` ${statusText}` : ''}`;
    } else if (Number.isFinite(errorCode) && errorCode !== 0) {
      reason = `errorCode ${errorCode}`;
    } else if (responsePreview) {
      reason = responsePreview;
    }

    return reason ? `${baseMessage}: ${reason}` : baseMessage;
  }

  async function fetchAdsDetailItemsBySortForRegion(shopId, regionId, options = {}) {
    const normalizedRegionId = normalizeText(regionId);
    const rawSortBy = Number(options.sortBy);
    const sortBy = (
      rawSortBy === ADS_DETAIL_SORT_BY_PAUSED_STATUS
      || rawSortBy === ADS_DETAIL_SORT_BY_TOTAL_SPEND
      || rawSortBy === ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT
    )
      ? rawSortBy
      : ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT;
    const spendThreshold = Number.isFinite(Number(options.spendThreshold))
      ? Number(options.spendThreshold)
      : null;
    const pageSize = Math.max(1, Number.parseInt(options.pageSize, 10) || ADS_DETAIL_PAGE_SIZE);
    const adStatus = Array.isArray(options.adStatus) ? options.adStatus : [];
    let firstResponse = options.firstResponse || null;

    if (!firstResponse) {
      const initialFetchResult =
        promotionMasterSessionService
        && typeof promotionMasterSessionService.postWithRegionCookie === 'function'
          ? await promotionMasterSessionService.postWithRegionCookie(
            shopId,
            normalizedRegionId,
            ADS_DETAIL_URL,
            buildAdsDetailPagePayload(1, {
              sortBy,
              adStatus,
              pageSize
            }),
            {
              reason: `${normalizedRegionId}-ads-detail-sort-${sortBy}-page-1`
            }
          )
          : null;
      const initialResponse = initialFetchResult && initialFetchResult.response ? initialFetchResult.response : null;

      if (!initialResponse || initialResponse.ok !== true || initialResponse.success === false) {
        throw new Error(
          buildAdsDetailRequestFailureMessage(
            initialResponse,
            `${normalizedRegionId} ads_detail sort ${sortBy} page 1 failed`
          )
        );
      }

      firstResponse = initialResponse;
    }

    const firstPayload = firstResponse && firstResponse.data && typeof firstResponse.data === 'object'
      ? firstResponse.data
      : {};
    const combinedItems = extractAdsDetailItems(firstPayload, normalizedRegionId);
    let pageNumber = 1;
    let hasMore =
      detectAdsDetailHasMore(firstPayload, pageNumber, combinedItems.length)
      && shouldContinueAdsDetailPaging(combinedItems, {
        sortBy,
        spendThreshold
      });

    while (
      hasMore
      && pageNumber < ADS_DETAIL_MAX_PAGES
      && promotionMasterSessionService
      && typeof promotionMasterSessionService.postWithRegionCookie === 'function'
    ) {
      pageNumber += 1;
      const fetchResult = await promotionMasterSessionService.postWithRegionCookie(
        shopId,
        normalizedRegionId,
        ADS_DETAIL_URL,
        buildAdsDetailPagePayload(pageNumber, {
          sortBy,
          adStatus,
          pageSize
        }),
        {
          reason: `${normalizedRegionId}-ads-detail-sort-${sortBy}-page-${pageNumber}`
        }
      );
      const response = fetchResult && fetchResult.response ? fetchResult.response : null;

      if (!response || response.ok !== true || response.success === false) {
        throw new Error(
          buildAdsDetailRequestFailureMessage(
            response,
            `${normalizedRegionId} ads_detail page ${pageNumber} failed`
          )
        );
      }

      const responsePayload = response && response.data && typeof response.data === 'object'
        ? response.data
        : {};
      const nextItems = extractAdsDetailItems(responsePayload, normalizedRegionId);

      if (nextItems.length === 0) {
        break;
      }

      combinedItems.push(...nextItems);
      hasMore =
        detectAdsDetailHasMore(responsePayload, pageNumber, nextItems.length)
        && shouldContinueAdsDetailPaging(nextItems, {
          sortBy,
          spendThreshold
        });
    }

    return combinedItems;
  }

  async function fetchPausedAdsDetailItemsForRegion(shopId, regionId, options = {}) {
    const normalizedRegionId = normalizeText(regionId);
    const combinedItems = [];
    let firstResponse = options.firstResponse || null;
    let pageNumber = 1;
    let hasMore = true;

    if (firstResponse) {
      const firstPayload = firstResponse && firstResponse.data && typeof firstResponse.data === 'object'
        ? firstResponse.data
        : {};
      const firstItems = extractAdsDetailItems(firstPayload, normalizedRegionId);

      if (firstItems.length > 0) {
        combinedItems.push(...firstItems);
      }

      hasMore = detectAdsDetailHasMore(firstPayload, pageNumber, firstItems.length);
      pageNumber += 1;
    }

    while (
      hasMore
      && pageNumber <= ADS_DETAIL_MAX_PAGES
      && promotionMasterSessionService
      && typeof promotionMasterSessionService.postWithRegionCookie === 'function'
    ) {
      const fetchResult = await promotionMasterSessionService.postWithRegionCookie(
        shopId,
        normalizedRegionId,
        ADS_DETAIL_URL,
        buildAdsDetailPagePayload(pageNumber, {
          sortBy: ADS_DETAIL_SORT_BY_PAUSED_STATUS,
          adStatus: [ADS_DETAIL_PAUSED_STATUS_CODE],
          pageSize: ADS_DETAIL_PAUSED_PAGE_SIZE
        }),
        {
          reason: `${normalizedRegionId}-ads-detail-paused-page-${pageNumber}`
        }
      );
      const response = fetchResult && fetchResult.response ? fetchResult.response : null;

      if (!response || response.ok !== true || response.success === false) {
        throw new Error(
          buildAdsDetailRequestFailureMessage(
            response,
            `${normalizedRegionId} paused ads_detail page ${pageNumber} failed`
          )
        );
      }

      const responsePayload = response && response.data && typeof response.data === 'object'
        ? response.data
        : {};
      const nextItems = extractAdsDetailItems(responsePayload, normalizedRegionId);

      if (nextItems.length === 0) {
        break;
      }

      combinedItems.push(...nextItems);
      hasMore = detectAdsDetailHasMore(responsePayload, pageNumber, nextItems.length);
      pageNumber += 1;
    }

    return combinedItems;
  }

  async function fetchAdsDetailItemsForRegion(shopId, regionId, firstResponse, options = {}) {
    const normalizedRegionId = normalizeText(regionId);
    const spendThreshold = Number.isFinite(Number(options.spendThreshold))
      ? Number(options.spendThreshold)
      : null;
    const pausedOnly = options.pausedOnly === true;

    if (pausedOnly) {
      const pausedItems = await fetchPausedAdsDetailItemsForRegion(shopId, normalizedRegionId, {
        firstResponse
      });

      return mergeAdsDetailItemLists([
        pausedItems.map((item) => ({
          ...item,
          isPaused: true
        }))
      ], normalizedRegionId);
    }

    const childOrderSortedItems = await fetchAdsDetailItemsBySortForRegion(shopId, normalizedRegionId, {
      sortBy: ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT,
      firstResponse
    });
    const itemLists = [childOrderSortedItems];

    if (spendThreshold !== null) {
      const totalSpendSortedItems = await fetchAdsDetailItemsBySortForRegion(shopId, normalizedRegionId, {
        sortBy: ADS_DETAIL_SORT_BY_TOTAL_SPEND,
        spendThreshold
      });

      itemLists.push(totalSpendSortedItems);
    }

    return mergeAdsDetailItemLists(itemLists, normalizedRegionId);
  }

  function getShopOperationStat(shopState, regionId, goodsId, adId, options = {}) {
    if (!shopState.operationStats || typeof shopState.operationStats !== 'object') {
      shopState.operationStats = {};
    }

    const statKey = buildOperationStatKey(regionId, goodsId, adId);

    if (!shopState.operationStats[statKey]) {
      if (options.create !== true) {
        return null;
      }

      shopState.operationStats[statKey] = buildDefaultOperationStat();
    }

    const stat = shopState.operationStats[statKey];
    const dailyBucket = buildOperationDateKey();

    if (stat.dailyBucket !== dailyBucket) {
      stat.dailyBucket = dailyBucket;
      stat.dailyCount = 0;
    }

    return stat;
  }

  function removeShopOperationStat(shopState, regionId, goodsId, adId) {
    if (!shopState || !shopState.operationStats || typeof shopState.operationStats !== 'object') {
      return false;
    }

    const statKey = buildOperationStatKey(regionId, goodsId, adId);

    if (!Object.prototype.hasOwnProperty.call(shopState.operationStats, statKey)) {
      return false;
    }

    delete shopState.operationStats[statKey];
    sharedStateDirty = true;
    sharedStateRevision += 1;
    return true;
  }

  function resolveStoredPausedState(stat) {
    const normalizedStat = normalizeOperationStat(stat);

    if (normalizedStat.knownPausedState === true) {
      return true;
    }

    if (normalizedStat.knownPausedState === false) {
      return false;
    }

    return normalizeText(normalizedStat.pausedAt) ? true : null;
  }

  function resolveEffectivePausedState(item, stat) {
    if (item && typeof item.isPaused === 'boolean') {
      return item.isPaused;
    }

    return resolveStoredPausedState(stat);
  }

  function setOperationPausedState(stat, isPaused, options = {}) {
    if (!stat || typeof stat !== 'object' || typeof isPaused !== 'boolean') {
      return false;
    }

    const nextPausedAt = isPaused
      ? (
        hasOwnField(options, 'pausedAt')
          ? normalizeText(options.pausedAt)
          : normalizeText(stat.pausedAt)
      )
      : '';
    const nextUpdatedAt = normalizeText(options.eventAt) || nowIso();
    const currentPausedState = normalizeNullableBoolean(stat.knownPausedState);
    const currentUpdatedAt = normalizeText(stat.pauseStateUpdatedAt);
    const currentPausedAt = normalizeText(stat.pausedAt);

    if (
      currentPausedState === isPaused
      && currentUpdatedAt === nextUpdatedAt
      && currentPausedAt === nextPausedAt
    ) {
      return false;
    }

    stat.knownPausedState = isPaused;
    stat.pauseStateUpdatedAt = nextUpdatedAt;
    stat.pausedAt = nextPausedAt;
    sharedStateDirty = true;
    sharedStateRevision += 1;
    return true;
  }

  function syncOperationPausedStateFromItem(stat, itemPaused) {
    if (typeof itemPaused !== 'boolean' || !stat || typeof stat !== 'object') {
      return false;
    }

    const currentPausedState = resolveStoredPausedState(stat);
    const currentPausedAt = normalizeText(stat.pausedAt);

    if (itemPaused === true && currentPausedState === true) {
      return false;
    }

    if (itemPaused === false && currentPausedState === false && !currentPausedAt) {
      return false;
    }

    return setOperationPausedState(stat, itemPaused, {
      eventAt: nowIso(),
      pausedAt: itemPaused ? currentPausedAt : ''
    });
  }

  function resolveResumeIntervalMs(monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (config.resumeIntervalMinutes === null) {
      return null;
    }

    return Math.max(1, Number(config.resumeIntervalMinutes) || 0) * 60 * 1000;
  }

  function resolvePauseThenResumeExecution(stat, item, monitorConfig) {
    const effectivePausedState = resolveEffectivePausedState(item, stat);
    const config = normalizeMonitorConfig(monitorConfig);

    if (config.resumeIntervalMinutes === null) {
      return {
        executionActionType: '',
        skipReason: 'action_payload'
      };
    }

    if (effectivePausedState !== true) {
      return {
        executionActionType: 'pause_plan'
      };
    }

    const pausedAt = normalizeText(stat && stat.pausedAt);
    const pausedAtTimestamp = parseIsoTimestamp(pausedAt);

    if (!pausedAtTimestamp) {
      return {
        executionActionType: 'resume_plan'
      };
    }

    const resumeDueAt = resolvePauseThenResumeDueAtFromPausedAt(
      pausedAtTimestamp,
      config.resumeIntervalMinutes
    );

    if (Date.now() >= resumeDueAt) {
      return {
        executionActionType: 'resume_plan'
      };
    }

    return {
      executionActionType: '',
      skipReason: 'resume_waiting'
    };
  }

  function resolveOperationStatRegionId(statKey, stat) {
    const keyRegionId = normalizeText(String(statKey || '').split('::')[0]);
    const statRegionId = normalizeText(stat && stat.lastRegionId);

    return statRegionId || keyRegionId;
  }

  function resolvePauseThenResumeCheckDueAt(stat, monitorConfig) {
    const effectivePausedState = resolveStoredPausedState(stat);
    const config = normalizeMonitorConfig(monitorConfig);

    if (effectivePausedState !== true || config.resumeIntervalMinutes === null) {
      return Number.MAX_SAFE_INTEGER;
    }

    const pausedAtTimestamp = parseIsoTimestamp(normalizeText(stat && stat.pausedAt));

    if (!pausedAtTimestamp) {
      return 0;
    }

    return resolvePauseThenResumeDueAtFromPausedAt(
      pausedAtTimestamp,
      config.resumeIntervalMinutes
    );
  }

  function buildSelectedMonitorRegionIdSet(monitorConfig) {
    return new Set(normalizeMonitorConfig(monitorConfig).regionIds);
  }

  function resolvePauseThenResumeNextRunAt(shopState, monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (config.actionType !== 'pause_then_resume') {
      return Number.MAX_SAFE_INTEGER;
    }

    const operationStats = normalizeOperationStats(shopState && shopState.operationStats);
    const selectedRegionIds = buildSelectedMonitorRegionIdSet(config);
    let nextDueAt = Number.MAX_SAFE_INTEGER;

    Object.entries(operationStats).forEach(([statKey, stat]) => {
      const regionId = resolveOperationStatRegionId(statKey, stat);

      if (selectedRegionIds.size > 0 && !selectedRegionIds.has(regionId)) {
        return;
      }

      const statDueAt = resolvePauseThenResumeCheckDueAt(stat, config);

      if (statDueAt < nextDueAt) {
        nextDueAt = statDueAt;
      }
    });

    return nextDueAt;
  }

  function getDuePauseThenResumeRegionIds(shopState, monitorConfig, now = Date.now()) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (config.actionType !== 'pause_then_resume') {
      return [];
    }

    const operationStats = normalizeOperationStats(shopState && shopState.operationStats);
    const selectedRegionIds = buildSelectedMonitorRegionIdSet(config);
    const regionIds = new Set();

    Object.entries(operationStats).forEach(([statKey, stat]) => {
      const regionId = resolveOperationStatRegionId(statKey, stat);

      if (!regionId || (selectedRegionIds.size > 0 && !selectedRegionIds.has(regionId))) {
        return;
      }

      const statDueAt = resolvePauseThenResumeCheckDueAt(stat, config);

      if (statDueAt > now) {
        return;
      }

      regionIds.add(regionId);
    });

    return Array.from(regionIds);
  }

  function getPauseThenResumeFallbackNextRunAt(shopState) {
    return Math.max(0, Number(shopState && shopState.pauseResumeFallbackNextRunAt) || 0);
  }

  function getPauseThenResumeFallbackRetryCount(shopState) {
    return Math.max(0, Number(shopState && shopState.pauseResumeFallbackRetryCount) || 0);
  }

  function setPauseThenResumeFallbackSchedule(shopState, nextRunAt, retryCount = 0) {
    if (!shopState || typeof shopState !== 'object') {
      return false;
    }

    const normalizedNextRunAt = Math.max(0, Number(nextRunAt) || 0);
    const normalizedRetryCount = Math.max(0, Number(retryCount) || 0);

    if (
      getPauseThenResumeFallbackNextRunAt(shopState) === normalizedNextRunAt
      && getPauseThenResumeFallbackRetryCount(shopState) === normalizedRetryCount
    ) {
      return false;
    }

    shopState.pauseResumeFallbackNextRunAt = normalizedNextRunAt;
    shopState.pauseResumeFallbackRetryCount = normalizedRetryCount;
    return true;
  }

  function resolvePauseThenResumeFallbackDueAt(shopState, monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (
      !shopState
      || shopState.enabled !== true
      || config.actionType !== 'pause_then_resume'
      || config.resumeIntervalMinutes === null
    ) {
      return Number.MAX_SAFE_INTEGER;
    }

    const nextDueAt = resolvePauseThenResumeNextRunAt(shopState, config);

    if (nextDueAt >= Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (
      config.resumeIntervalMinutes === PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES
      && getPauseThenResumeFallbackRetryCount(shopState) === 0
    ) {
      return nextDueAt;
    }

    return Math.max(nextDueAt, getPauseThenResumeFallbackNextRunAt(shopState));
  }

  function resolvePauseThenResumeFallbackSuccessNextRunAt(shopState, monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (
      config.actionType !== 'pause_then_resume'
      || config.resumeIntervalMinutes === null
    ) {
      return 0;
    }

    if (config.resumeIntervalMinutes === PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES) {
      const nextDueAt = resolvePauseThenResumeNextRunAt(shopState, config);
      return nextDueAt >= Number.MAX_SAFE_INTEGER ? 0 : nextDueAt;
    }

    const resumeIntervalMs = resolveResumeIntervalMs(config) || 0;
    return resumeIntervalMs > 0 ? Date.now() + resumeIntervalMs : 0;
  }

  function hasAutoPauseSpendThreshold(monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);
    return config.autoPauseSpendThreshold !== null;
  }

  function hasAutoPauseRoasThreshold(monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);
    return config.autoPauseRoasThreshold !== null;
  }

  function hasPrimaryMonitorAction(monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (!config.actionType || !MONITOR_ACTION_TYPES.includes(config.actionType)) {
      return false;
    }

    if ((config.actionType === 'update_roas' || config.actionType === 'increase_roas') && config.targetRoas === null) {
      return false;
    }

    if (config.actionType === 'pause_then_resume' && config.resumeIntervalMinutes === null) {
      return false;
    }

    return true;
  }

  function shouldUseAdListSummaryMonitorFlow(monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    return config.actionType === 'delete_plan';
  }

  function hasExecutableMonitorAction(monitorConfig) {
    return (
      hasPrimaryMonitorAction(monitorConfig)
      || hasAutoPauseSpendThreshold(monitorConfig)
      || hasAutoPauseRoasThreshold(monitorConfig)
    );
  }

  function buildModifyAdsPayload(actionType, item, monitorConfig) {
    const normalizedActionType = normalizeText(actionType);
    const goodsId = normalizeText(item && item.goodsId);
    const adId = normalizeText(item && item.adId);

    if (normalizedActionType === 'pause_plan') {
      return goodsId
        ? { modify_ad_dtos: [{ goods_id: goodsId, status: ADS_MODIFY_STATUS_PAUSE }] }
        : null;
    }

    if (normalizedActionType === 'resume_plan') {
      return goodsId
        ? { modify_ad_dtos: [{ goods_id: goodsId, status: ADS_MODIFY_STATUS_RESUME }] }
        : null;
    }

    if (normalizedActionType === 'delete_plan') {
      return goodsId
        ? { modify_ad_dtos: [{ goods_id: goodsId, status: ADS_MODIFY_STATUS_DELETE }] }
        : null;
    }

    const targetRoasRaw = normalizeRoasRawValue(monitorConfig && monitorConfig.targetRoas);

    if (!goodsId || !adId || targetRoasRaw === null) {
      return null;
    }

    if (normalizedActionType === 'update_roas') {
      if (item && item.targetRoasRaw !== null && item.targetRoasRaw === targetRoasRaw) {
        return null;
      }

      return {
        modify_ad_dtos: [{
          ad_id: adId,
          roas: targetRoasRaw,
          goods_id: goodsId,
          roas_type: 0
        }]
      };
    }

    if (normalizedActionType === 'increase_roas') {
      if (item && item.targetRoasRaw === null) {
        return null;
      }

      return {
        modify_ad_dtos: [{
          ad_id: adId,
          roas: Math.max(0, item.targetRoasRaw + targetRoasRaw),
          goods_id: goodsId,
          roas_type: 0
        }]
      };
    }

    return null;
  }

  function recordMonitorOperationStat(stat, item, actionType, payload, resultMessage, options = {}) {
    const dailyBucket = buildOperationDateKey();
    const normalizedActionType = normalizeText(actionType);
    const executedAt = nowIso();
    const normalizedReasonType = normalizeText(options.reasonType);

    if (stat.dailyBucket !== dailyBucket) {
      stat.dailyBucket = dailyBucket;
      stat.dailyCount = 0;
    }

    stat.dailyCount += 1;
    stat.totalCount += 1;
    stat.lastActionType = normalizedActionType;
    stat.lastRegionId = normalizeText(item && item.regionId);
    stat.lastGoodsId = normalizeText(item && item.goodsId);
    stat.lastAdId = normalizeText(item && item.adId);
    stat.lastTargetRoas = extractIntegerByAliases(payload, ['roas']) || 0;
    stat.lastExecutedAt = executedAt;
    stat.lastResultMessage = normalizeText(resultMessage);
    stat.lastTriggerReason = MONITOR_OPERATION_REASON_TYPES.includes(normalizedReasonType)
      ? normalizedReasonType
      : '';
    stat.lastTriggerMessage = normalizeText(options.reasonMessage);
    stat.lastObservedAdSpend =
      item && typeof item.adSpend === 'number' && Number.isFinite(item.adSpend)
        ? item.adSpend
        : null;
    stat.lastObservedOrderCount = Math.max(0, Number.parseInt(item && item.orderCount, 10) || 0);
    stat.lastObservedCurrentRoas = normalizeRoasRawValue(item && item.currentRoasRaw);
    stat.lastObservedTargetRoas = normalizeRoasRawValue(item && item.targetRoasRaw);

    if (normalizedActionType === 'pause_plan') {
      stat.knownPausedState = true;
      stat.pauseStateUpdatedAt = executedAt;
      stat.pausedAt = executedAt;
    } else if (normalizedActionType === 'resume_plan') {
      stat.knownPausedState = false;
      stat.pauseStateUpdatedAt = executedAt;
      stat.pausedAt = '';
    }

    sharedStateDirty = true;
    sharedStateRevision += 1;
  }

  function buildMonitorActionLabel(actionType) {
    const normalizedActionType = normalizeText(actionType);
    const actionLabelMap = {
      pause_plan: '\u6682\u505c\u8ba1\u5212',
      pause_then_resume: '\u6682\u505c\u540e\u6062\u590d',
      resume_plan: '\u6062\u590d\u8ba1\u5212',
      delete_plan: '\u5220\u9664\u8ba1\u5212',
      update_roas: '\u4fee\u6539ROAS',
      increase_roas: '\u589e\u52a0ROAS'
    };

    return actionLabelMap[normalizedActionType] || normalizedActionType || '\u76d1\u63a7\u4fee\u6539';
  }

  function buildMonitorActionExecutionLabel(actionType) {
    const normalizedActionType = normalizeText(actionType);
    const actionLabelMap = {
      pause_plan: '\u672c\u8f6e\u6682\u505c',
      pause_then_resume: '\u672c\u8f6e\u6682\u505c\u540e\u6062\u590d',
      resume_plan: '\u672c\u8f6e\u6062\u590d',
      delete_plan: '\u672c\u8f6e\u5220\u9664',
      update_roas: '\u672c\u8f6e\u4fee\u6539ROAS',
      increase_roas: '\u672c\u8f6e\u589e\u52a0ROAS'
    };

    return actionLabelMap[normalizedActionType] || buildMonitorActionLabel(normalizedActionType);
  }

  function resolveOperationReasonType(executionActionType, options = {}) {
    const normalizedExecutionActionType = normalizeText(executionActionType);
    const normalizedSourceActionType = normalizeText(options.sourceActionType);

    if (normalizedExecutionActionType === 'pause_plan') {
      if (options.autoPauseBySpend === true) {
        return 'auto_pause_spend';
      }

      if (options.autoPauseByRoas === true) {
        return 'auto_pause_roas';
      }

      if (normalizedSourceActionType === 'pause_then_resume') {
        return 'pause_then_resume_pause';
      }
    }

    if (
      normalizedExecutionActionType === 'resume_plan'
      && normalizedSourceActionType === 'pause_then_resume'
    ) {
      return 'pause_then_resume_resume';
    }

    return normalizedExecutionActionType ? 'primary_action' : '';
  }

  function buildOperationReasonLabel(executionActionType, reasonType) {
    const normalizedReasonType = normalizeText(reasonType);

    if (normalizedReasonType === 'auto_pause_spend') {
      return '\u8d85\u82b1\u8d39\u8fbe\u9608\u503c\u6682\u505c';
    }

    if (normalizedReasonType === 'auto_pause_roas') {
      return '\u6210\u4ea4ROAS\u8fbe\u9608\u503c\u6682\u505c';
    }

    if (normalizedReasonType === 'pause_then_resume_pause') {
      return '\u6682\u505c\u540e\u6062\u590d-\u6682\u505c';
    }

    if (normalizedReasonType === 'pause_then_resume_resume') {
      return '\u6682\u505c\u540e\u6062\u590d-\u6062\u590d';
    }

    return buildMonitorActionLabel(executionActionType);
  }

  function formatOperationNumber(value, options = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '--';
    }

    return formatMetricNumber(value, {
      minimumFractionDigits: Math.max(0, Number(options.minimumFractionDigits) || 0),
      maximumFractionDigits: Math.max(0, Number(options.maximumFractionDigits) || 0)
    });
  }

  function formatOperationRoas(rawValue) {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue <= 0) {
      return '--';
    }

    return formatOperationNumber(rawValue / 10000, {
      maximumFractionDigits: 2
    });
  }

  function buildOperationReasonMetricsText(reasonType, item) {
    const normalizedReasonType = normalizeText(reasonType);
    const normalizedItem = item && typeof item === 'object' ? item : {};
    const adSpend = typeof normalizedItem.adSpend === 'number' && Number.isFinite(normalizedItem.adSpend)
      ? normalizedItem.adSpend
      : null;
    const orderCount = Math.max(0, Number.parseInt(normalizedItem.orderCount, 10) || 0);

    if (normalizedReasonType === 'auto_pause_spend') {
      return [
        `\u82b1\u8d39 ${formatOperationNumber(adSpend, { maximumFractionDigits: 2 })}`,
        `\u5b50\u8ba2\u5355(\u63a8\u5e7f) ${orderCount}`
      ].join(' / ');
    }

    if (normalizedReasonType === 'auto_pause_roas') {
      return [
        `\u82b1\u8d39 ${formatOperationNumber(adSpend, { maximumFractionDigits: 2 })}`,
        `\u5b50\u8ba2\u5355(\u63a8\u5e7f) ${orderCount}`,
        `\u6210\u4ea4ROAS ${formatOperationRoas(normalizedItem.currentRoasRaw)}`
      ].join(' / ');
    }

    return '';
  }

  function truncateOperationText(value, maxLength = 18) {
    const text = normalizeText(value);

    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  function buildOperationPreviewItemLabel(item) {
    const goodsId = normalizeText(item && item.goodsId);
    const productName = truncateOperationText(item && item.productName, 14);

    if (goodsId) {
      return `SPUID ${goodsId}`;
    }

    return productName || '\u672a\u547d\u540d\u5546\u54c1';
  }

  function appendOperationSummaryItem(targetList, item, regionId, errorMessage = '') {
    if (!Array.isArray(targetList) || targetList.length >= 3) {
      return;
    }

    const regionEntry = REGION_ENTRIES.find((region) => region.id === normalizeText(regionId));

    targetList.push({
      regionId: normalizeText(regionId),
      regionLabel: regionEntry ? regionEntry.label : normalizeText(regionId),
      goodsId: normalizeText(item && item.goodsId),
      productName: normalizeText(item && item.productName),
      errorMessage: normalizeText(errorMessage)
    });
  }

  function buildOperationRuntimeMessage(executionActionType, item, regionId, options = {}) {
    const regionEntry = REGION_ENTRIES.find((region) => region.id === normalizeText(regionId));
    const regionLabel = regionEntry ? regionEntry.label : normalizeText(regionId);
    const itemLabel = buildOperationPreviewItemLabel(item);
    const reasonType =
      normalizeText(options.reasonType)
      || resolveOperationReasonType(executionActionType, options);
    const metricsText = buildOperationReasonMetricsText(reasonType, item);
    let actionLabel = buildOperationReasonLabel(executionActionType, reasonType);

    if (options.failed === true) {
      actionLabel = `${actionLabel}\u5931\u8d25`;
    }

    return [regionLabel, actionLabel, itemLabel, metricsText].filter(Boolean).join(' ');
  }

  function buildOperationPreviewText(items, totalCount) {
    const previewItems = Array.isArray(items) ? items.filter(Boolean) : [];

    if (previewItems.length === 0 || totalCount <= 0) {
      return '';
    }

    const previewText = previewItems
      .map((item) => {
        const label = buildOperationPreviewItemLabel(item);
        const regionLabel = normalizeText(item && item.regionLabel);

        return regionLabel ? `${regionLabel} ${label}` : label;
      })
      .join(' / ');
    const suffix = totalCount > previewItems.length ? ` 等 ${totalCount} 个` : '';

    return `${previewText}${suffix}`;
  }

  function buildExecutedActionSummaryText(summary) {
    const autoPauseSpendCount = Math.max(0, Number(summary && summary.autoPausedBySpendCount) || 0);
    const autoPauseRoasCount = Math.max(0, Number(summary && summary.autoPausedByRoasCount) || 0);
    const actionCounts = summary && summary.successfulActionCounts && typeof summary.successfulActionCounts === 'object'
      ? summary.successfulActionCounts
      : {};
    const summaryParts = [];

    if (autoPauseSpendCount > 0) {
      summaryParts.push(`\u8d85\u82b1\u8d39\u6682\u505c ${autoPauseSpendCount}`);
    }

    if (autoPauseRoasCount > 0) {
      summaryParts.push(`\u6210\u4ea4ROAS\u8fbe\u9608\u503c\u6682\u505c ${autoPauseRoasCount}`);
    }

    const countEntries = Object.entries(actionCounts)
      .map(([actionType, count]) => {
        let normalizedCount = Math.max(0, Number(count) || 0);

        if (normalizeText(actionType) === 'pause_plan') {
          normalizedCount = Math.max(0, normalizedCount - autoPauseSpendCount - autoPauseRoasCount);
        }

        return [actionType, normalizedCount];
      })
      .filter(([, count]) => count > 0);

    if (countEntries.length === 0 && summaryParts.length === 0) {
      const fallbackLabel = buildMonitorActionLabel(summary && summary.actionType);
      return fallbackLabel;
    }

    summaryParts.push(
      ...countEntries.map(
        ([actionType, count]) => `${buildMonitorActionExecutionLabel(actionType)} ${Math.max(0, Number(count) || 0)}`
      )
    );

    return summaryParts.join(' / ');
  }

  async function executeMonitorActions(shopId, shopState, monitorConfig, fetchResult, options = {}) {
    const shopLogMeta = await resolveShopLogMeta(shopId);

    const config = normalizeMonitorConfig(monitorConfig);
    const scopedRegionIds = Array.isArray(options.regionIds)
      ? options.regionIds.map((regionId) => normalizeText(regionId)).filter(Boolean)
      : [];
    const pausedOnly = options.pausedOnly === true;
    const selectedRegionIds = new Set(scopedRegionIds.length > 0 ? scopedRegionIds : config.regionIds);
    const primaryActionEnabled = hasPrimaryMonitorAction(config);
    const autoPauseSpendThreshold = config.autoPauseSpendThreshold;
    const autoPauseRoasThresholdRaw = normalizeRoasRawValue(config.autoPauseRoasThreshold);
    const operationSummary = buildEmptyOperationSummary();
    operationSummary.actionType = config.actionType;

    if (!hasExecutableMonitorAction(config)) {
      return operationSummary;
    }

    updateShopStageLog(shopId, shopState, '正在按监控条件筛选商品并准备执行操作', {
      stage: 'evaluate-actions',
      writeRuntimeLog: true
    });

    for (const region of REGION_ENTRIES) {
      if (!selectedRegionIds.has(region.id)) {
        continue;
      }

      const regionResult = fetchResult && fetchResult.regions ? fetchResult.regions[region.id] : null;
      const response = regionResult && regionResult.response ? regionResult.response : null;

      if (!response || response.ok !== true || response.success === false) {
        continue;
      }

      const items = await fetchAdsDetailItemsForRegion(shopId, region.id, response, {
        pausedOnly,
        spendThreshold: pausedOnly ? null : autoPauseSpendThreshold
      });

      for (const item of items) {
        let operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId);
        let currentDailyCount = operationStat ? Math.max(0, Number(operationStat.dailyCount) || 0) : 0;
        let currentTotalCount = operationStat ? Math.max(0, Number(operationStat.totalCount) || 0) : 0;
        const conditionMaxRoasRaw = normalizeRoasRawValue(config.conditionMaxRoas);
        const adSpend = typeof item.adSpend === 'number' && Number.isFinite(item.adSpend)
          ? item.adSpend
          : null;
        let executionActionType = primaryActionEnabled ? config.actionType : '';
        let shouldEvaluateConditions = true;
        let autoPauseBySpendMatched = false;
        let autoPauseByRoasMatched = false;

        if (operationStat || config.actionType === 'pause_then_resume') {
          if (!operationStat && item.isPaused === true) {
            operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId, {
              create: true
            });
          }

          if (operationStat) {
            syncOperationPausedStateFromItem(operationStat, item.isPaused);
          }
        }

        const effectivePausedState = resolveEffectivePausedState(item, operationStat);

        if (
          pausedOnly !== true
          &&
          autoPauseSpendThreshold !== null
          && adSpend !== null
          && item.orderCount === 0
          && adSpend > autoPauseSpendThreshold
        ) {
          executionActionType = 'pause_plan';
          shouldEvaluateConditions = false;
          autoPauseBySpendMatched = true;
        }

        if (
          pausedOnly !== true
          &&
          !autoPauseBySpendMatched
          && autoPauseRoasThresholdRaw !== null
          && item.orderCount > 0
          && item.currentRoasRaw !== null
          && item.currentRoasRaw <= autoPauseRoasThresholdRaw
        ) {
          executionActionType = 'pause_plan';
          shouldEvaluateConditions = false;
          autoPauseByRoasMatched = true;
        }

        if (!autoPauseBySpendMatched && !autoPauseByRoasMatched && config.actionType === 'pause_then_resume') {
          if (!operationStat && item.isPaused !== true) {
            executionActionType = 'pause_plan';
            shouldEvaluateConditions = true;
          } else {
            if (!operationStat) {
              operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId, {
                create: true
              });
            }

            const pauseThenResumeDecision = resolvePauseThenResumeExecution(operationStat, item, config);

            if (!pauseThenResumeDecision.executionActionType) {
              operationSummary.skippedCount += 1;

              if (pauseThenResumeDecision.skipReason === 'resume_waiting') {
                operationSummary.skippedByResumeWaiting += 1;
              } else {
                operationSummary.skippedByActionPayload += 1;
              }
              continue;
            }

            executionActionType = pauseThenResumeDecision.executionActionType;
            shouldEvaluateConditions = executionActionType !== 'resume_plan';
            currentDailyCount = Math.max(0, Number(operationStat && operationStat.dailyCount) || 0);
            currentTotalCount = Math.max(0, Number(operationStat && operationStat.totalCount) || 0);
          }
        }

        if (shouldEvaluateConditions) {
          if (
            conditionMaxRoasRaw !== null
            && (item.targetRoasRaw === null || item.targetRoasRaw > conditionMaxRoasRaw)
          ) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByRoas += 1;
            continue;
          }

          if (config.minOrderCount !== null && item.orderCount < config.minOrderCount) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByOrderCount += 1;
            continue;
          }

          if (config.dailyOperationLimit !== null && currentDailyCount >= config.dailyOperationLimit) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByDailyLimit += 1;
            continue;
          }

          if (config.totalOperationLimit !== null && currentTotalCount >= config.totalOperationLimit) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByTotalLimit += 1;
            continue;
          }
        }

        if (executionActionType === 'pause_plan' && effectivePausedState === true) {
          operationSummary.skippedCount += 1;
          operationSummary.skippedByAlreadyPaused += 1;
          continue;
        }

        const payload = buildModifyAdsPayload(executionActionType, item, config);

        if (!payload) {
          operationSummary.skippedCount += 1;
          operationSummary.skippedByActionPayload += 1;
          continue;
        }

        if (!operationStat) {
          operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId, {
            create: true
          });
        }

        operationSummary.attemptedCount += 1;

        try {
          const modifyResult =
            promotionMasterSessionService
            && typeof promotionMasterSessionService.postWithRegionCookie === 'function'
              ? await promotionMasterSessionService.postWithRegionCookie(
                shopId,
                region.id,
                ADS_MODIFY_URL,
                payload,
                {
                  reason: `${region.id}-${executionActionType}-modify-ads`
                }
              )
              : null;
          const responsePayload = modifyResult && modifyResult.response ? modifyResult.response : null;
          const responseData = responsePayload && responsePayload.data && typeof responsePayload.data === 'object'
            ? responsePayload.data
            : {};
          const resultData = responseData && responseData.result && typeof responseData.result === 'object'
            ? responseData.result
            : {};
          const successCount = Math.max(0, Number(resultData.success_modify_product_num) || 0);

          if (!responsePayload || responsePayload.ok !== true || responsePayload.success === false || successCount <= 0) {
            throw new Error(
              normalizeText(responsePayload && responsePayload.message)
              || normalizeText(responseData && responseData.error_msg)
              || `${executionActionType} failed`
            );
          }

          const operationReasonType = resolveOperationReasonType(
            executionActionType,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType
            }
          );
          const runtimeActionMessage = buildOperationRuntimeMessage(
            executionActionType,
            item,
            region.id,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType,
              reasonType: operationReasonType
            }
          );

          recordMonitorOperationStat(
            operationStat,
            item,
            executionActionType,
            payload,
            normalizeText(responsePayload.message) || 'success',
            {
              reasonType: operationReasonType,
              reasonMessage: runtimeActionMessage
            }
          );

          if (executionActionType === 'resume_plan' || executionActionType === 'delete_plan') {
            removeShopOperationStat(shopState, region.id, item.goodsId, item.adId);
          }

          operationSummary.successCount += 1;

          if (!operationSummary.successfulActionCounts[executionActionType]) {
            operationSummary.successfulActionCounts[executionActionType] = 0;
          }

          operationSummary.successfulActionCounts[executionActionType] += 1;

          if (autoPauseBySpendMatched === true && executionActionType === 'pause_plan') {
            operationSummary.autoPausedBySpendCount += 1;
          }

          if (autoPauseByRoasMatched === true && executionActionType === 'pause_plan') {
            operationSummary.autoPausedByRoasCount += 1;
          }

          appendOperationSummaryItem(operationSummary.executedItems, item, region.id);

          log('promotion_monitor_action_executed', {
            ...shopLogMeta,
            regionId: region.id,
            goodsId: item.goodsId,
            adId: item.adId,
            productName: normalizeText(item.productName),
            adSpend: typeof item.adSpend === 'number' && Number.isFinite(item.adSpend) ? item.adSpend : null,
            orderCount: item.orderCount,
            currentRoasRaw: item.currentRoasRaw,
            targetRoasRaw: item.targetRoasRaw,
            triggerReason: operationReasonType,
            message: runtimeActionMessage,
            actionType: config.actionType,
            executedActionType: executionActionType
          });
        } catch (error) {
          if (error && error.authRequired === true) {
            throw error;
          }

          operationSummary.failedCount += 1;
          operationStat.lastResultMessage = normalizeText(error && error.message);
          appendOperationSummaryItem(
            operationSummary.failedItems,
            item,
            region.id,
            normalizeText(error && error.message)
          );
          const operationReasonType = resolveOperationReasonType(
            executionActionType,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType
            }
          );
          const runtimeFailureMessage = buildOperationRuntimeMessage(
            executionActionType,
            item,
            region.id,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType,
              reasonType: operationReasonType,
              failed: true
            }
          );

          logError('promotion_monitor_action_failed', error, {
            ...shopLogMeta,
            regionId: region.id,
            goodsId: item.goodsId,
            adId: item.adId,
            productName: normalizeText(item.productName),
            adSpend: typeof item.adSpend === 'number' && Number.isFinite(item.adSpend) ? item.adSpend : null,
            orderCount: item.orderCount,
            currentRoasRaw: item.currentRoasRaw,
            targetRoasRaw: item.targetRoasRaw,
            triggerReason: operationReasonType,
            message: runtimeFailureMessage,
            actionType: config.actionType,
            executedActionType: executionActionType
          });
        }
      }
    }

    if (sharedStateDirty === true) {
      scheduleSharedStatePersist(SHARED_STATE_CLOUD_PERSIST_DELAY_MS);
    }

    return operationSummary;
  }

  function buildShopSyncLog(cookieSyncMode, operationSummary, regionStates, regionIds) {
    return buildShopSyncLogV2(cookieSyncMode, operationSummary, regionStates, regionIds);
  }

  function buildShopSyncLogV2(cookieSyncMode, operationSummary, regionStates, regionIds) {
    const summary = operationSummary && typeof operationSummary === 'object'
      ? {
        ...buildEmptyOperationSummary(),
        ...operationSummary
      }
      : buildEmptyOperationSummary();
    const modificationPreview = buildOperationPreviewText(summary.executedItems, summary.successCount);
    const failurePreview = buildOperationPreviewText(summary.failedItems, summary.failedCount);
    const actionSummaryText = buildExecutedActionSummaryText(summary);
    const conditionParts = [];

    if (summary.skippedByRoas > 0) {
      conditionParts.push(`ROAS\u672a\u8fbe ${summary.skippedByRoas}`);
    }

    if (summary.skippedByOrderCount > 0) {
      conditionParts.push(`\u8ba2\u5355\u672a\u8fbe ${summary.skippedByOrderCount}`);
    }

    if (summary.skippedByDailyLimit > 0) {
      conditionParts.push(`\u65e5\u4e0a\u9650 ${summary.skippedByDailyLimit}`);
    }

    if (summary.skippedByTotalLimit > 0) {
      conditionParts.push(`\u603b\u4e0a\u9650 ${summary.skippedByTotalLimit}`);
    }

    if (summary.skippedByAlreadyPaused > 0) {
      conditionParts.push(`\u8df3\u8fc7\u5df2\u6682\u505c ${summary.skippedByAlreadyPaused}`);
    }

    if (summary.skippedByResumeWaiting > 0) {
      conditionParts.push(`\u5f85\u6062\u590d ${summary.skippedByResumeWaiting}`);
    }

    if (summary.skippedByActionPayload > 0) {
      conditionParts.push(`\u4e0d\u53ef\u6267\u884c ${summary.skippedByActionPayload}`);
    }

    const logParts = [
      `\u6570\u636e: ${buildRegionMonitorDataSummary(regionStates, regionIds)}`
    ];

    if (summary.successCount > 0) {
      logParts.push(
        `\u64cd\u4f5c: ${actionSummaryText}`
        + (modificationPreview ? `\uff08${modificationPreview}\uff09` : '')
      );
    }

    if (summary.failedCount > 0) {
      logParts.push(
        `\u5931\u8d25: ${summary.failedCount}`
        + (failurePreview ? `\uff08${failurePreview}\uff09` : '')
      );
    }

    if (conditionParts.length > 0) {
      logParts.push(`\u8df3\u8fc7: ${conditionParts.join(' / ')}`);
    }

    return logParts.join(' | ');
  }

  function buildRetryError(message, options = {}) {
    const error = new Error(normalizeText(message) || '推广监控同步失败');

    error.authRequired = options.authRequired === true;
    error.loginPending = options.loginPending === true;
    return error;
  }

  function computeRetryDelay(retryCount, options = {}) {
    const nextRetryCount = Math.max(0, Number(retryCount) || 0);
    const baseDelay = options.authRequired === true
      ? RETRY_BASE_DELAY_MS
      : Math.floor(RETRY_BASE_DELAY_MS * 1.5);
    const scaledDelay = baseDelay * Math.max(1, Math.min(6, nextRetryCount + 1));

    return Math.min(RETRY_MAX_DELAY_MS, scaledDelay);
  }

  function resolveMonitorIntervalMs(monitorConfig) {
    if (!monitorConfig || typeof monitorConfig !== 'object') {
      return DEFAULT_MONITOR_INTERVAL_MS;
    }

    return normalizeMonitorIntervalSecondsValue(
      monitorConfig.monitorIntervalSeconds
    ) * 1000;
  }

  function shouldUseRetrySchedule(shopState) {
    const status = normalizeText(shopState && shopState.status);

    return (
      Math.max(0, Number(shopState && shopState.retryCount) || 0) > 0
      || status === 'retrying'
      || status === 'relogin'
    );
  }

  function resolveIntervalDrivenNextRunAt(shopState, monitorConfig) {
    const lastSuccessAt = Date.parse(normalizeText(shopState && shopState.lastSuccessAt));

    if (!Number.isFinite(lastSuccessAt) || lastSuccessAt <= 0) {
      return Math.max(0, Number(shopState && shopState.nextRunAt) || 0);
    }

    return lastSuccessAt + resolveMonitorIntervalMs(monitorConfig);
  }

  function resolveSchedulerDueAt(shopState, monitorConfig) {
    if (!shopState || shopState.enabled !== true) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (shouldUseRetrySchedule(shopState)) {
      return Math.max(0, Number(shopState.nextRunAt) || 0);
    }

    return resolveIntervalDrivenNextRunAt(shopState, monitorConfig);
  }

  async function collectShopMetricsViaAdListSummary(
    shopId,
    shopState,
    monitorConfig,
    selectedRegionIds
  ) {
    updateShopStageLog(shopId, shopState, '\u6b63\u5728\u51c6\u5907 Cookies \u5e76\u540c\u6b65\u63a8\u5e7f\u6c47\u603b\u6570\u636e', {
      stage: 'prepare-sync',
      writeRuntimeLog: true
    });

    const summaryFetchResult = await promotionMasterSessionService.fetchAdListSummaries(shopId, {
      regionIds: selectedRegionIds,
      onRegionStatus: ({ regionId, regionLabel, stage, summary }) => {
        if (stage === 'start') {
          updateShopStageLog(
            shopId,
            shopState,
            `\u6b63\u5728\u540c\u6b65 ${regionLabel} \u63a8\u5e7f\u6c47\u603b`,
            {
              stage: 'region-sync-start',
              regionId,
              writeRuntimeLog: true
            }
          );
          return;
        }

        if (stage === 'done') {
          const promotionOrderCount = resolvePromotionOrderCountFromSummary({
            summary: summary && typeof summary === 'object' ? summary : {}
          });
          const hitPromotionOrder = promotionOrderCount > 0;

          updateShopStageLog(
            shopId,
            shopState,
            hitPromotionOrder
              ? `${regionLabel} 汇总同步完成，已命中推广子订单`
              : `${regionLabel} 汇总同步完成`,
            {
              stage: 'region-sync-done',
              regionId,
              writeRuntimeLog: true
            }
          );
        }
      }
    });
    const nextRegions = {};
    const regionProductCounts = {};
    const detailRegionIds = [];
    let detailFetchResult = null;
    let operationSummary = buildEmptyOperationSummary();
    const detailCheckEnabled = hasExecutableMonitorAction(monitorConfig);
    const spendThresholdCheckEnabled = hasAutoPauseSpendThreshold(monitorConfig);

    if (
      summaryFetchResult
      && summaryFetchResult.cookieSnapshot
      && summaryFetchResult.cookieSnapshot.byRegion
    ) {
      shopState.cookieHeaderByRegion = Object.fromEntries(
        selectedRegionIds.map((regionId) => [
          regionId,
          normalizeText(
            summaryFetchResult.cookieSnapshot.byRegion[regionId]
            && summaryFetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
          )
        ])
      );
    } else {
      shopState.cookieHeaderByRegion = {};
    }

    for (const region of REGION_ENTRIES) {
      if (!selectedRegionIds.includes(region.id)) {
        nextRegions[region.id] = buildEmptyRegionState(region.id);
        continue;
      }

      const regionResult = summaryFetchResult && summaryFetchResult.regions
        ? summaryFetchResult.regions[region.id]
        : null;
      const response = regionResult && regionResult.response ? regionResult.response : null;
      const summaryPayload = regionResult && regionResult.summary && typeof regionResult.summary === 'object'
        ? regionResult.summary
        : {};
      const productCount = resolveSummaryGoodsCount(summaryPayload);
      const promotionOrderCount = resolvePromotionOrderCountFromSummary(summaryPayload);
      const previousPromotionOrderCount = Math.max(
        0,
        Number(
          shopState
          && shopState.regions
          && shopState.regions[region.id]
          && shopState.regions[region.id].promotionOrderCount
        ) || 0
      );
      const hasPromotionOrderIncrease = promotionOrderCount > previousPromotionOrderCount;
      const shouldFetchDetail =
        spendThresholdCheckEnabled === true
        || promotionOrderCount > 0
        || hasPromotionOrderIncrease;

      regionProductCounts[region.id] = productCount;

      if (shouldFetchDetail) {
        detailRegionIds.push(region.id);
      }

        nextRegions[region.id] = {
          regionId: region.id,
          productCount,
          summary: mapSummaryToMetrics(summaryPayload),
          fetchedAt: normalizeText(regionResult && regionResult.fetchedAt) || nowIso(),
          switchMessage: summaryFetchResult && summaryFetchResult.refreshedCookies === true ? 'cookies-refreshed' : 'cookies-cached',
        detailMessage: shouldFetchDetail && detailCheckEnabled
          ? (
            promotionOrderCount > 0 || hasPromotionOrderIncrease
              ? '\u5df2\u547d\u4e2d\u5b50\u8ba2\u5355(\u63a8\u5e7f)\uff0c\u5f85\u68c0\u67e5 ads_detail'
              : '\u5df2\u5f00\u542f\u8d85\u82b1\u8d39(\u5b50\u8ba2\u5355(\u63a8\u5e7f)=0)\u68c0\u67e5\uff0c\u5f85\u68c0\u67e5 ads_detail'
          )
          : shouldFetchDetail
            ? (
              promotionOrderCount > 0 || hasPromotionOrderIncrease
                ? '\u5df2\u547d\u4e2d\u5b50\u8ba2\u5355(\u63a8\u5e7f)'
                : '\u5df2\u5f00\u542f\u8d85\u82b1\u8d39(\u5b50\u8ba2\u5355(\u63a8\u5e7f)=0)\u68c0\u67e5'
            )
          : (
            normalizeText(response && response.message)
            || '\u5b50\u8ba2\u5355(\u63a8\u5e7f) \u4e3a 0\uff0c\u8df3\u8fc7 ads_detail'
          ),
        summarySource: 'ad-list',
        promotionOrderCount,
        previousPromotionOrderCount,
        hasPromotionOrderIncrease,
        detailFetched: false
      };
    }

    if (
      detailCheckEnabled
      && detailRegionIds.length > 0
      && typeof promotionMasterSessionService.fetchAdsDetailSummaries === 'function'
    ) {
      updateShopStageLog(
        shopId,
        shopState,
        spendThresholdCheckEnabled === true
          ? '\u6b63\u5728\u6309\u5b50\u8ba2\u5355/\u603b\u82b1\u8d39\u68c0\u67e5\u5546\u54c1\u5217\u8868'
          : '\u6b63\u5728\u6309\u5b50\u8ba2\u5355(\u63a8\u5e7f) \u68c0\u67e5\u5546\u54c1\u5217\u8868',
        {
          stage: 'detail-sync',
          writeRuntimeLog: true
        }
      );

      detailFetchResult = await promotionMasterSessionService.fetchAdsDetailSummaries(shopId, {
        regionIds: detailRegionIds,
        buildPayload: () => buildAdsDetailPayload(),
        onRegionStatus: ({ regionId, regionLabel, stage, response }) => {
          if (stage === 'start') {
            updateShopStageLog(
              shopId,
              shopState,
              `\u6b63\u5728\u68c0\u67e5 ${regionLabel} ads_detail \u5546\u54c1\u5217\u8868`,
              {
                stage: 'detail-region-start',
                regionId,
                writeRuntimeLog: true
              }
            );
            return;
          }

          if (stage === 'done') {
            const responseData = response && response.data && typeof response.data === 'object'
              ? response.data
              : {};
            const productCount = resolveAdsDetailProductCount(responseData, regionId);

            updateShopStageLog(
              shopId,
              shopState,
              `${regionLabel} ads_detail \u68c0\u67e5\u5b8c\u6210\uff0c\u5546\u54c1 ${productCount} \u4e2a`,
              {
                stage: 'detail-region-done',
                regionId,
                writeRuntimeLog: true
              }
            );
          }
        }
      });
      operationSummary = await executeMonitorActions(
        shopId,
        shopState,
        monitorConfig,
        detailFetchResult,
        {
          regionIds: detailRegionIds
        }
      );

      if (
        detailFetchResult
        && detailFetchResult.cookieSnapshot
        && detailFetchResult.cookieSnapshot.byRegion
      ) {
        detailRegionIds.forEach((regionId) => {
          shopState.cookieHeaderByRegion[regionId] = normalizeText(
            detailFetchResult.cookieSnapshot.byRegion[regionId]
            && detailFetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
          );
        });
      }

      detailRegionIds.forEach((regionId) => {
        const regionResult = detailFetchResult && detailFetchResult.regions
          ? detailFetchResult.regions[regionId]
          : null;
        const response = regionResult && regionResult.response ? regionResult.response : null;
        const responseData = response && response.data && typeof response.data === 'object'
          ? response.data
          : {};
        const detailProductCount = resolveAdsDetailProductCount(responseData, regionId);

        if (detailProductCount > 0) {
          regionProductCounts[regionId] = detailProductCount;
          nextRegions[regionId].productCount = detailProductCount;
        }

        nextRegions[regionId].detailMessage =
          normalizeText(response && response.message) || '\u5df2\u68c0\u67e5 ads_detail';
        nextRegions[regionId].detailFetched = true;
      });
    }

    shopState.log = buildShopSyncLogV2(
      (detailFetchResult && detailFetchResult.cookieSyncMode)
      || (summaryFetchResult && summaryFetchResult.cookieSyncMode),
      operationSummary,
      nextRegions,
      selectedRegionIds
    );

    return {
      monitorConfig,
      selectedRegionIds,
      regions: nextRegions,
      operationSummary
    };
  }

  async function collectShopMetrics(shopId, shopState) {
    const monitorConfigBundle = await loadMonitorConfig();
    const monitorConfig = resolveShopMonitorConfig(shopId, monitorConfigBundle);
    const selectedRegionEntries = resolveRequestedRegionEntries(monitorConfig.regionIds, {
      useSwitchOrder: true
    });
    const selectedRegionIds = selectedRegionEntries.map((region) => region.id);

    if (selectedRegionEntries.length === 0) {
      shopState.cookieHeaderByRegion = {};
      shopState.log = '\u672a\u9009\u62e9\u76d1\u63a7\u5730\u533a\uff0c\u672c\u8f6e\u8df3\u8fc7\u6570\u636e\u540c\u6b65';

      return {
        monitorConfig,
        selectedRegionIds,
        regions: REGION_ENTRIES.reduce((result, region) => {
          result[region.id] = buildEmptyRegionState(region.id);
          return result;
        }, {}),
        operationSummary: buildEmptyOperationSummary()
      };
    }

    if (
      shouldUseAdListSummaryMonitorFlow(monitorConfig)
      && promotionMasterSessionService
      && typeof promotionMasterSessionService.fetchAdListSummaries === 'function'
    ) {
      // delete_plan needs queryReports summaries because deleted plans may no longer appear in ads_detail.
      return collectShopMetricsViaAdListSummary(
        shopId,
        shopState,
        monitorConfig,
        selectedRegionIds
      );
    }

    if (
      promotionMasterSessionService
      && typeof promotionMasterSessionService.fetchAdsDetailSummaries === 'function'
    ) {
      updateShopStageLog(shopId, shopState, '正在准备 Cookies 并同步推广数据', {
        stage: 'prepare-sync',
        writeRuntimeLog: true
      });

      const fetchResult = await promotionMasterSessionService.fetchAdsDetailSummaries(shopId, {
        regionIds: selectedRegionIds,
        buildPayload: () => buildAdsDetailPayload(),
        onRegionStatus: ({ regionId, regionLabel, stage, response }) => {
          if (stage === 'start') {
            updateShopStageLog(shopId, shopState, `正在同步 ${regionLabel} 推广数据`, {
              stage: 'region-sync-start',
              regionId,
              writeRuntimeLog: true
            });
            return;
          }

          if (stage === 'done') {
            const responseData = response && response.data && typeof response.data === 'object'
              ? response.data
              : {};
            const productCount = resolveAdsDetailProductCount(responseData, regionId);

            updateShopStageLog(shopId, shopState, `${regionLabel} 推广数据同步完成，获取 ${productCount} 个商品`, {
              stage: 'region-sync-done',
              regionId,
              writeRuntimeLog: true
            });
          }
        }
      });
      const nextRegions = {};
      const regionProductCounts = {};
      const operationSummary = hasExecutableMonitorAction(monitorConfig)
        ? await executeMonitorActions(shopId, shopState, monitorConfig, fetchResult)
        : buildEmptyOperationSummary();

      if (
        fetchResult
        && fetchResult.cookieSnapshot
        && fetchResult.cookieSnapshot.byRegion
      ) {
        shopState.cookieHeaderByRegion = Object.fromEntries(
          selectedRegionIds.map((regionId) => [
            regionId,
            normalizeText(
              fetchResult.cookieSnapshot.byRegion[regionId]
              && fetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
            )
          ])
        );
      } else {
        shopState.cookieHeaderByRegion = {};
      }

      for (const region of REGION_ENTRIES) {
        if (!selectedRegionIds.includes(region.id)) {
          nextRegions[region.id] = buildEmptyRegionState(region.id);
          continue;
        }

        const regionResult = fetchResult && fetchResult.regions ? fetchResult.regions[region.id] : null;
        const response = regionResult && regionResult.response ? regionResult.response : null;
        const responseData = response && response.data && typeof response.data === 'object'
          ? response.data
          : {};
        const productCount = resolveAdsDetailProductCount(responseData, region.id);
        const summaryPayload = regionResult && regionResult.summary && typeof regionResult.summary === 'object'
          ? regionResult.summary
          : {};

        regionProductCounts[region.id] = productCount;

        nextRegions[region.id] = {
          regionId: region.id,
          productCount,
          summary: mapSummaryToMetrics(summaryPayload),
          fetchedAt: normalizeText(regionResult && regionResult.fetchedAt) || nowIso(),
          switchMessage: fetchResult && fetchResult.refreshedCookies === true ? 'cookies-refreshed' : 'cookies-cached',
          detailMessage: normalizeText(response && response.message),
          summarySource: 'ads-detail',
          detailFetched: true
        };
      }

      shopState.log = buildShopSyncLogV2(
        fetchResult && fetchResult.cookieSyncMode,
        operationSummary,
        nextRegions,
        selectedRegionIds
      );

      return {
        monitorConfig,
        selectedRegionIds,
        regions: nextRegions,
        operationSummary
      };
    }

    throw new Error('\u63a8\u5e7f\u76d1\u63a7\u4e3b\u4f1a\u8bdd\u670d\u52a1\u4e0d\u53ef\u7528\uff0c\u5c06\u5728\u4e0b\u4e00\u8f6e\u91cd\u8bd5\u3002');

  }

  async function triggerMonitorReloginIfNeeded(shopId, error) {
    if (!(error && error.authRequired === true)) {
      return;
    }

    const controller = getController();

    if (
      !controller
      || typeof controller.beginBackgroundProductPromotionMonitorRelogin !== 'function'
    ) {
      return;
    }

    try {
      const controllerPayload = await buildShopControllerPayload(shopId);
      await controller.beginBackgroundProductPromotionMonitorRelogin({
        ...controllerPayload,
        reason: error && error.loginPending === true
          ? 'monitor-login-pending'
          : 'monitor-auth-expired'
      });
    } catch (reloginError) {
      logError('promotion_monitor_relogin_trigger_failed', reloginError, {
        shopId: normalizeText(shopId)
      });
    }
  }

  async function runPauseThenResumeFallbackCycle(shopId, monitorConfigOverride = null, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shopState = getShopRuntimeState(normalizedShopId);

    if (
      !shopState
      || configCache.batchMonitoringActive !== true
      || shopState.enabled !== true
      || shopState.taskRunning === true
    ) {
      return;
    }

    let resolvedMonitorConfig = monitorConfigOverride;

    if (!resolvedMonitorConfig) {
      const monitorConfigBundle = await loadMonitorConfig();
      resolvedMonitorConfig = resolveShopMonitorConfig(normalizedShopId, monitorConfigBundle);
    }

    const monitorConfig = normalizeMonitorConfig(resolvedMonitorConfig);
    const shopLogMeta = await resolveShopLogMeta(normalizedShopId);

    if (
      monitorConfig.actionType !== 'pause_then_resume'
      || monitorConfig.resumeIntervalMinutes === null
    ) {
      return;
    }

    const forcedRegionIds = resolveRequestedRegionEntries(options.forceRegionIds, {
      useSwitchOrder: true
    }).map((region) => region.id);
    const dueRegionIds = resolveRequestedRegionEntries(
      getDuePauseThenResumeRegionIds(shopState, monitorConfig),
      { useSwitchOrder: true }
    ).map((region) => region.id);
    const targetRegionIds = forcedRegionIds.length > 0 ? forcedRegionIds : dueRegionIds;

    if (targetRegionIds.length === 0) {
      if (setPauseThenResumeFallbackSchedule(shopState, 0, 0)) {
        stateCache.updatedAt = nowIso();
        scheduleStatePersist(0);
      }
      return;
    }

    if (
      !promotionMasterSessionService
      || typeof promotionMasterSessionService.fetchAdsDetailSummaries !== 'function'
    ) {
      return;
    }

    shopState.taskRunning = true;
    updateShopStageLog(
      normalizedShopId,
      shopState,
      '\u6b63\u5728\u6309\u6062\u590d\u8bbe\u7f6e\u68c0\u67e5\u6682\u505c\u8ba1\u5212',
      {
        stage: 'pause-resume-fallback-start',
        writeRuntimeLog: true
      }
    );

    try {
      const fetchResult = await promotionMasterSessionService.fetchAdsDetailSummaries(normalizedShopId, {
        regionIds: targetRegionIds,
        buildPayload: () => buildAdsDetailPayload({
          sortBy: ADS_DETAIL_SORT_BY_PAUSED_STATUS,
          adStatus: [ADS_DETAIL_PAUSED_STATUS_CODE],
          pageSize: ADS_DETAIL_PAUSED_PAGE_SIZE
        }),
        onRegionStatus: ({ regionId, regionLabel, stage, response }) => {
          if (stage === 'start') {
            updateShopStageLog(
              normalizedShopId,
              shopState,
              `\u6b63\u5728\u68c0\u67e5 ${regionLabel} \u6682\u505c\u8ba1\u5212`,
              {
                stage: 'pause-resume-fallback-region-start',
                regionId,
                writeRuntimeLog: true
              }
            );
            return;
          }

          if (stage === 'done') {
            const responseData = response && response.data && typeof response.data === 'object'
              ? response.data
              : {};
            const productCount = resolveAdsDetailProductCount(responseData, regionId);

            updateShopStageLog(
              normalizedShopId,
              shopState,
              `${regionLabel} \u6682\u505c\u8ba1\u5212\u68c0\u67e5\u5b8c\u6210\uff0c\u83b7\u53d6 ${productCount} \u4e2a\u5546\u54c1`,
              {
                stage: 'pause-resume-fallback-region-done',
                regionId,
                writeRuntimeLog: true
              }
            );
          }
        }
      });
      const operationSummary = await executeMonitorActions(
        normalizedShopId,
        shopState,
        monitorConfig,
        fetchResult,
        {
          regionIds: targetRegionIds,
          pausedOnly: true
        }
      );
      const nextFallbackRunAt = resolvePauseThenResumeFallbackSuccessNextRunAt(
        shopState,
        monitorConfig
      );

      if (
        fetchResult
        && fetchResult.cookieSnapshot
        && fetchResult.cookieSnapshot.byRegion
      ) {
        if (!shopState.cookieHeaderByRegion || typeof shopState.cookieHeaderByRegion !== 'object') {
          shopState.cookieHeaderByRegion = {};
        }

        targetRegionIds.forEach((regionId) => {
          const cookieHeader = normalizeText(
            fetchResult.cookieSnapshot.byRegion[regionId]
            && fetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
          );

          if (cookieHeader) {
            shopState.cookieHeaderByRegion[regionId] = cookieHeader;
          }
        });
      }

      setPauseThenResumeFallbackSchedule(
        shopState,
        nextFallbackRunAt,
        0
      );
      shopState.lastUpdatedAt = nowIso();
      shopState.log = buildShopSyncLogV2(
        fetchResult && fetchResult.cookieSyncMode,
        operationSummary,
        shopState.regions,
        monitorConfig.regionIds
      );

      log('promotion_monitor_pause_resume_fallback_synced', {
        ...shopLogMeta,
        regionIds: targetRegionIds,
        nextRunAt: getPauseThenResumeFallbackNextRunAt(shopState),
        operationSummary
      });
    } catch (error) {
      const retryCount = getPauseThenResumeFallbackRetryCount(shopState);
      const retryDelay = computeRetryDelay(retryCount, {
        authRequired: error && error.authRequired === true
      });

      setPauseThenResumeFallbackSchedule(
        shopState,
        Date.now() + retryDelay,
        retryCount + 1
      );
      shopState.lastUpdatedAt = nowIso();
      shopState.log =
        normalizeText(error && error.message)
        || '\u6682\u505c\u6062\u590d\u68c0\u67e5\u5931\u8d25\uff0c\u5c06\u5728\u7a0d\u540e\u91cd\u8bd5';
      await triggerMonitorReloginIfNeeded(normalizedShopId, error);

      logError('promotion_monitor_pause_resume_fallback_failed', error, {
        ...shopLogMeta,
        regionIds: targetRegionIds,
        nextRunAt: getPauseThenResumeFallbackNextRunAt(shopState),
        authRequired: Boolean(error && error.authRequired)
      });
    } finally {
      shopState.taskRunning = false;
      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
    }
  }

  async function runShopCycle(shopId) {
    const normalizedShopId = normalizeText(shopId);
    const shopState = getShopRuntimeState(normalizedShopId);
    let immediatePauseResumeSweepRegionIds = [];
    let immediatePauseResumeSweepMonitorConfig = null;

    if (
      !shopState
      || configCache.batchMonitoringActive !== true
      || shopState.enabled !== true
      || shopState.taskRunning === true
    ) {
      return;
    }

    const shopLogMeta = await resolveShopLogMeta(normalizedShopId);
    shopState.taskRunning = true;
    shopState.status = 'running';
    shopState.log = '正在检查商品推广在线状态';
    stateCache.updatedAt = nowIso();
    scheduleStatePersist(0);

    try {
      const collectResult = await collectShopMetrics(normalizedShopId, shopState);
      const nextRegions = collectResult && collectResult.regions ? collectResult.regions : {};
      const operationSummary = collectResult && collectResult.operationSummary ? collectResult.operationSummary : null;
      const monitorConfig = collectResult && collectResult.monitorConfig ? collectResult.monitorConfig : null;
      const selectedRegionIds = collectResult && Array.isArray(collectResult.selectedRegionIds)
        ? collectResult.selectedRegionIds
        : [];
      const successLog = normalizeText(shopState.log);

      shopState.regions = REGION_ENTRIES.reduce((result, region) => {
        result[region.id] = normalizeRegionState(region.id, nextRegions[region.id]);
        return result;
      }, {});
      shopState.status = 'online';
      shopState.log = selectedRegionIds.length > 0
        ? `商品推广在线，已完成 ${selectedRegionIds.length} 个监控地区数据同步`
        : '未选择监控地区，本轮未查询数据';
      shopState.lastUpdatedAt = nowIso();
      shopState.log = successLog || normalizeText(shopState.log);
      shopState.lastSuccessAt = shopState.lastUpdatedAt;
      shopState.lastError = '';
      shopState.retryCount = 0;
      shopState.nextRunAt = Date.now() + resolveMonitorIntervalMs(monitorConfig);

      if (
        shopState.startupPauseResumeSweepPending === true
        && monitorConfig
        && monitorConfig.actionType === 'pause_then_resume'
        && monitorConfig.resumeIntervalMinutes !== null
        && selectedRegionIds.length > 0
      ) {
        shopState.startupPauseResumeSweepPending = false;
        immediatePauseResumeSweepRegionIds = selectedRegionIds.slice();
        immediatePauseResumeSweepMonitorConfig = monitorConfig;
      }

      log('promotion_monitor_shop_synced', {
        ...shopLogMeta,
        nextRunAt: shopState.nextRunAt,
        monitorIntervalSeconds: normalizeMonitorIntervalSecondsValue(
          monitorConfig && monitorConfig.monitorIntervalSeconds
        ),
        operationSummary
      });
    } catch (error) {
      const retryDelay = computeRetryDelay(shopState.retryCount, {
        authRequired: error && error.authRequired === true
      });

      shopState.status = error && error.authRequired === true ? 'relogin' : 'retrying';
      shopState.log = normalizeText(error && error.message) || '同步失败，稍后自动重试。';
      shopState.lastError = shopState.log;
      shopState.retryCount += 1;
      shopState.nextRunAt = Date.now() + retryDelay;

      await triggerMonitorReloginIfNeeded(normalizedShopId, error);

      logError('promotion_monitor_shop_sync_failed', error, {
        ...shopLogMeta,
        nextRunAt: shopState.nextRunAt,
        authRequired: Boolean(error && error.authRequired)
      });
    } finally {
      shopState.taskRunning = false;
      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
    }

    if (
      immediatePauseResumeSweepRegionIds.length > 0
      && immediatePauseResumeSweepMonitorConfig
    ) {
      await runPauseThenResumeFallbackCycle(
        normalizedShopId,
        immediatePauseResumeSweepMonitorConfig,
        {
          forceRegionIds: immediatePauseResumeSweepRegionIds
        }
      );
    }
  }

  async function runScheduler() {
    if (schedulerRunning) {
      scheduleScheduler(LOOP_INTERVAL_MS);
      return;
    }

    schedulerRunning = true;

    try {
      const owner = await ensureLoaded();
      const monitorConfigBundle = await loadMonitorConfig();
      await reconcileManagedShopAvailability();

      if (!owner) {
        return;
      }

      if (configCache.batchMonitoringActive !== true) {
        return;
      }

      const now = Date.now();
      let hasNextRunAtUpdate = false;
      const dueShopIdSet = new Set();
      const duePauseFallbackShopIds = [];
      const monitorConfigByShopId = new Map();

      Object.values(stateCache.shops)
        .filter((shopState) => (
          shopState
          && shopState.enabled === true
          && shopState.taskRunning !== true
        ))
        .forEach((shopState) => {
          const monitorConfig = resolveShopMonitorConfig(shopState.shopId, monitorConfigBundle);
          const resolvedDueAt = resolveSchedulerDueAt(shopState, monitorConfig);

          monitorConfigByShopId.set(shopState.shopId, monitorConfig);

          if (!shouldUseRetrySchedule(shopState)) {
            const normalizedCurrentNextRunAt = Math.max(0, Number(shopState.nextRunAt) || 0);

            if (normalizedCurrentNextRunAt !== resolvedDueAt) {
              shopState.nextRunAt = resolvedDueAt;
              hasNextRunAtUpdate = true;
            }
          }

          if (now >= resolvedDueAt) {
            dueShopIdSet.add(shopState.shopId);
            return;
          }

          const pauseThenResumeDueAt = resolvePauseThenResumeFallbackDueAt(shopState, monitorConfig);

          if (now >= pauseThenResumeDueAt) {
            duePauseFallbackShopIds.push(shopState.shopId);
          }
        });
      const dueShopIds = Array.from(dueShopIdSet);

      if (hasNextRunAtUpdate) {
        stateCache.updatedAt = nowIso();
        scheduleStatePersist(0);
      }

      await Promise.all([
        ...dueShopIds.map((shopId) => runShopCycle(shopId)),
        ...duePauseFallbackShopIds
          .filter((shopId) => !dueShopIdSet.has(shopId))
          .map((shopId) => runPauseThenResumeFallbackCycle(
            shopId,
            monitorConfigByShopId.get(shopId) || null
          ))
      ]);
    } catch (error) {
      logError('promotion_monitor_scheduler_failed', error);
    } finally {
      schedulerRunning = false;
      scheduleScheduler(LOOP_INTERVAL_MS);
    }
  }

  function serializeShopStateForRenderer(shopState) {
    return {
      shopId: normalizeText(shopState && shopState.shopId),
      enabled: shopState && shopState.enabled === true,
      status: normalizeText(shopState && shopState.status),
      log: normalizeText(shopState && shopState.log),
      lastUpdatedAt: normalizeText(shopState && shopState.lastUpdatedAt),
      lastSuccessAt: normalizeText(shopState && shopState.lastSuccessAt),
      lastError: normalizeText(shopState && shopState.lastError),
      nextRunAt: Math.max(0, Number(shopState && shopState.nextRunAt) || 0),
      regions: REGION_ENTRIES.reduce((result, region) => {
        result[region.id] = normalizeRegionState(
          region.id,
          shopState && shopState.regions && shopState.regions[region.id]
        );
        return result;
      }, {})
    };
  }

  return {
    async init() {
      await ensureLoaded().catch(() => null);
      await reconcileManagedShopAvailability().catch(() => null);
      scheduleScheduler(500);
    },

    async getSnapshot() {
      await ensureLoaded();
      await reconcileManagedShopAvailability();

      return {
        updatedAt: normalizeText(stateCache.updatedAt),
        batchMonitoringActive: configCache.batchMonitoringActive === true,
        enabledShopIds: configCache.enabledShopIds.slice(),
        shops: Object.fromEntries(
          Object.entries(stateCache.shops).map(([shopId, shopState]) => [
            shopId,
            serializeShopStateForRenderer(shopState)
          ])
        )
      };
    },

    async setShopEnabled(payload) {
      const owner = await ensureLoaded();
      const shopId = normalizeText(payload && payload.shopId);
      const enabled = payload && payload.enabled === true;

      if (!owner) {
        throw new Error('当前未登录，无法更新推广监控状态。');
      }

      if (!shopId) {
        throw new Error('缺少店铺标识，无法更新推广监控状态。');
      }

      if (shopManagementService) {
        let state = null;

        if (typeof shopManagementService.getLocalState === 'function') {
          state = await shopManagementService.getLocalState().catch(() => null);
        }

        if (
          (!state || state.localStateAvailable !== true)
          && typeof shopManagementService.getState === 'function'
        ) {
          state = await shopManagementService.getState().catch(() => null);
        }

        const matchedShop = Array.isArray(state && state.shops)
          ? state.shops.find((shop) => normalizeText(shop && shop.id) === shopId)
          : null;
        const shopExists = Boolean(matchedShop);

        if (!shopExists) {
          throw new Error('当前店铺不存在或已被删除。');
        }

        if (enabled && isShopParticipating(matchedShop) !== true) {
          throw new Error('\u5F53\u524D\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u4E2D\u5F00\u542F\u540E\u518D\u52A0\u5165\u63A8\u5E7F\u76D1\u63A7\u3002');
        }
      }

      const nextEnabledShopIds = new Set(configCache.enabledShopIds);

      if (enabled) {
        nextEnabledShopIds.add(shopId);
      } else {
        nextEnabledShopIds.delete(shopId);
      }

      configCache.enabledShopIds = Array.from(nextEnabledShopIds);
      configCache.updatedAt = nowIso();

      const shopState = getShopRuntimeState(shopId);

      if (shopState) {
        shopState.enabled = enabled;
        shopState.taskRunning = false;
        shopState.retryCount = 0;
        shopState.startupPauseResumeSweepPending = true;

        if (enabled) {
          if (configCache.batchMonitoringActive === true) {
            shopState.status = shopState.lastSuccessAt ? 'online' : 'idle';
          shopState.log = shopState.lastSuccessAt
            ? (normalizeText(shopState.log) || '已开启监控，等待下一轮同步')
            : '已开启监控，正在准备同步';
            shopState.nextRunAt = 0;
          } else {
            shopState.status = 'idle';
            shopState.log = '已加入批量监控名单，等待开始';
            shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
          }
        } else {
          shopState.status = 'disabled';
          shopState.log = '未加入批量监控';
          shopState.lastError = '';
          shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
          shopState.cookieHeaderByRegion = {};

          if (
            promotionMasterSessionService
            && typeof promotionMasterSessionService.invalidateShopCache === 'function'
          ) {
            promotionMasterSessionService.invalidateShopCache(shopId);
          }
        }
      }

      stateCache.updatedAt = nowIso();
      await persistConfig();
      scheduleStatePersist(0);
      scheduleScheduler(configCache.batchMonitoringActive === true && enabled ? 200 : 500);

      log('promotion_monitor_shop_toggle', {
        shopId,
        enabled
      });

      return this.getSnapshot();
    },

    async setBatchMonitoringActive(payload) {
      const owner = await ensureLoaded();
      const enabled = payload && payload.enabled === true;

      if (!owner) {
        throw new Error('当前未登录，无法更新批量监控状态。');
      }

      configCache.batchMonitoringActive = enabled;

      Object.values(stateCache.shops).forEach((shopState) => {
        if (!shopState) {
          return;
        }

        shopState.taskRunning = false;
        shopState.retryCount = 0;
        shopState.startupPauseResumeSweepPending = true;

        if (shopState.enabled !== true) {
          shopState.status = 'disabled';
          shopState.log = '未加入批量监控';
          shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
          return;
        }

        if (enabled) {
          shopState.status = shopState.lastSuccessAt ? 'online' : 'idle';
          shopState.log = shopState.lastSuccessAt
            ? (normalizeText(shopState.log) || '批量监控已启动，等待下一轮同步')
            : '批量监控已启动，等待执行';
          shopState.nextRunAt = 0;
          return;
        }

        shopState.status = 'idle';
        shopState.log = '已加入批量监控名单，等待开始';
        shopState.lastError = '';
        shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
      });

      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
      scheduleScheduler(enabled ? 80 : 500);

      log('promotion_monitor_batch_toggle', {
        enabled
      });

      return this.getSnapshot();
    },

    shutdown() {
      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = 0;
      }

      if (persistStateTimer) {
        clearTimeout(persistStateTimer);
        persistStateTimer = 0;
      }

      if (persistSharedStateTimer) {
        clearTimeout(persistSharedStateTimer);
        persistSharedStateTimer = 0;
      }
    }
  };
}

module.exports = {
  createPromotionMonitorService
};

