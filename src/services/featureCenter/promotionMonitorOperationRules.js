const {
  MONITOR_ACTION_TYPES,
  TARGET_ROAS_ACTION_TYPES,
  normalizeMonitorConfig
} = require('./promotionMonitorConfigModel');
const {
  isResumeSequenceActionType
} = require('./promotionMonitorPauseSequenceRules');

const SPEND_SORT_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MS = 10 * 60 * 1000;

function normalizeMonitorItemOrderCount(item) {
  return Math.max(0, Number.parseInt(item && item.orderCount, 10) || 0);
}

function normalizeMonitorItemAdSpend(item) {
  const value = item && item.adSpend;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeMonitorItemRoasRaw(item) {
  const value = item && item.currentRoasRaw;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeTimestampMs(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.floor(numericValue);
  }

  const parsedValue = Date.parse(String(value).trim());

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function isSpendSortCheckDue(
  lastCheckedAt,
  nowMs = Date.now(),
  intervalMs = SPEND_SORT_CHECK_INTERVAL_MS
) {
  const normalizedIntervalMs = Math.max(0, Number(intervalMs) || 0);

  if (normalizedIntervalMs <= 0) {
    return true;
  }

  const normalizedNowMs = normalizeTimestampMs(nowMs) || Date.now();
  const normalizedLastCheckedAt = normalizeTimestampMs(lastCheckedAt);

  return (
    normalizedLastCheckedAt <= 0
    || normalizedNowMs - normalizedLastCheckedAt >= normalizedIntervalMs
  );
}

function isEmptyPromotionRegionRecheckDue(
  regionState,
  nowMs = Date.now(),
  intervalMs = EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MS
) {
  const sourceState = regionState && typeof regionState === 'object' ? regionState : {};
  const productCount = Math.max(0, Number.parseInt(sourceState.productCount, 10) || 0);
  const promotionOrderCount = Math.max(0, Number.parseInt(sourceState.promotionOrderCount, 10) || 0);

  if (productCount > 0 || promotionOrderCount > 0) {
    return true;
  }

  const lastCheckedAt = normalizeTimestampMs(sourceState.fetchedAt);

  if (lastCheckedAt <= 0) {
    return true;
  }

  return isSpendSortCheckDue(lastCheckedAt, nowMs, intervalMs);
}

function shouldAutoPauseBySpend(item, spendThreshold, options = {}) {
  if (options && options.pausedOnly === true) {
    return false;
  }

  const threshold = normalizeOptionalNumber(spendThreshold);
  const adSpend = normalizeMonitorItemAdSpend(item);

  return (
    threshold !== null
    && adSpend !== null
    && normalizeMonitorItemOrderCount(item) === 0
    && adSpend > threshold
  );
}

function shouldAutoPauseByRoas(item, roasThresholdRaw, options = {}) {
  if (options && options.pausedOnly === true) {
    return false;
  }

  const threshold = normalizeOptionalNumber(roasThresholdRaw);
  const currentRoasRaw = normalizeMonitorItemRoasRaw(item);

  return (
    threshold !== null
    && normalizeMonitorItemOrderCount(item) > 0
    && currentRoasRaw !== null
    && currentRoasRaw <= threshold
  );
}

function resolveMonitorAutoPauseDecision(item, options = {}) {
  if (shouldAutoPauseBySpend(item, options.spendThreshold, options)) {
    return {
      matched: true,
      reason: 'spend'
    };
  }

  if (shouldAutoPauseByRoas(item, options.roasThresholdRaw, options)) {
    return {
      matched: true,
      reason: 'roas'
    };
  }

  return {
    matched: false,
    reason: ''
  };
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

  if (TARGET_ROAS_ACTION_TYPES.has(config.actionType) && config.targetRoas === null) {
    return false;
  }

  if (isResumeSequenceActionType(config.actionType) && config.resumeIntervalMinutes === null) {
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

module.exports = {
  SPEND_SORT_CHECK_INTERVAL_MS,
  EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MS,
  isSpendSortCheckDue,
  isEmptyPromotionRegionRecheckDue,
  normalizeMonitorItemOrderCount,
  shouldAutoPauseBySpend,
  shouldAutoPauseByRoas,
  resolveMonitorAutoPauseDecision,
  hasAutoPauseSpendThreshold,
  hasAutoPauseRoasThreshold,
  hasPrimaryMonitorAction,
  shouldUseAdListSummaryMonitorFlow,
  hasExecutableMonitorAction
};
