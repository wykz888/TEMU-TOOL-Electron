const { normalizeText } = require('../shopManagement/common');
const {
  REGION_ENTRIES,
  MONITOR_EXECUTION_ACTION_TYPES,
  MONITOR_OPERATION_REASON_TYPES,
  normalizeEnabledShopIds,
  normalizeNullableBoolean
} = require('./promotionMonitorConfigModel');
const {
  normalizeMoneyMetricValue,
  normalizeRoasRawValue
} = require('./promotionMonitorMetricUtils');

const SERVICE_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function buildOwnerSnapshot(owner) {
  return owner ? {
    userId: owner.userId,
    username: owner.username,
    userKey: owner.userKey
  } : null;
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
    lastObservedCurrentRoas,
    lastObservedTargetRoas,
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
    owner: buildOwnerSnapshot(owner),
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
    detailFetched: false,
    lastSpendSortCheckedAt: ''
  };
}

function buildDefaultShopState(shopId, enabled = false) {
  return {
    shopId: normalizeText(shopId),
    enabled: enabled === true,
    status: enabled ? 'idle' : 'disabled',
    log: enabled ? '\u7b49\u5f85\u540c\u6b65' : '',
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
    owner: buildOwnerSnapshot(owner),
    updatedAt: nowIso(),
    shops: {}
  };
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
    detailFetched: nextPayload.detailFetched === true,
    lastSpendSortCheckedAt: normalizeText(nextPayload.lastSpendSortCheckedAt)
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
          : '\u5df2\u52a0\u5165\u6279\u91cf\u76d1\u63a7\u540d\u5355\uff0c\u7b49\u5f85\u5f00\u59cb'
      )
      : '\u672a\u52a0\u5165\u6279\u91cf\u76d1\u63a7',
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
        normalizedShops[shopId].log = '\u5df2\u52a0\u5165\u6279\u91cf\u76d1\u63a7\u540d\u5355\uff0c\u7b49\u5f85\u5f00\u59cb';
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

function buildSharedCloudState(stateCache, currentOwner) {
  const sourceState = stateCache && typeof stateCache === 'object'
    ? stateCache
    : {};
  const shops = Object.fromEntries(
    Object.entries(sourceState.shops || {})
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
    owner: buildOwnerSnapshot(currentOwner),
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

function compactStateOperationStats(targetState) {
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
    owner: buildOwnerSnapshot(owner),
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

function mergeSharedCloudStateInto(targetState, payload, owner, enabledShopIds = []) {
  const normalizedSharedState = normalizeSharedCloudState(payload, owner);
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

function buildPersistableState(stateCache, currentOwner) {
  const sourceState = stateCache && typeof stateCache === 'object'
    ? stateCache
    : {};
  const shops = Object.fromEntries(
    Object.entries(sourceState.shops || {}).map(([shopId, shopState]) => [
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
    owner: buildOwnerSnapshot(currentOwner),
    updatedAt: nowIso(),
    shops
  };
}

module.exports = {
  buildOperationDateKey,
  buildDefaultOperationStat,
  buildEmptyOperationSummary,
  normalizeOperationStat,
  normalizeOperationStats,
  buildOperationStatKey,
  buildDefaultConfig,
  buildEmptyRegionState,
  buildDefaultShopState,
  buildDefaultState,
  normalizeRegionState,
  normalizeConfig,
  buildPersistableConfig,
  normalizeState,
  buildSharedCloudState,
  compactStateOperationStats,
  parseIsoTimestamp,
  resolveNextLocalDayStartTimestamp,
  mergeSharedCloudStateInto,
  buildPersistableState
};
