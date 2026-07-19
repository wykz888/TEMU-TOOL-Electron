const { normalizeText } = require('../shopManagement/common');
const {
  normalizeRoasRawValue
} = require('./promotionMonitorMetricUtils');
const {
  createPromotionManagerNewBidFetcher
} = require('./promotionManagerNewBidService');
const {
  sanitizeDetailActionResult
} = require('./promotionManagerNewDetailActionResult');
const {
  DETAIL_ROAS_MODE_CUSTOM,
  DETAIL_ROAS_MODE_MEDIUM,
  DETAIL_ROAS_MODE_STRONG,
  DETAIL_ROAS_MODE_WEAK,
  DETAIL_ACTION_STATUS_CANCELED,
  DETAIL_ACTION_STATUS_FAILED,
  DETAIL_ACTION_STATUS_SKIPPED,
  DETAIL_ACTION_STATUS_WARNING,
  TARGET_ROAS_ACTION_TYPES,
  buildActionTaskId,
  buildModifyPayloadForRows,
  buildRegionIdsByShop,
  buildRowResult,
  chunkList,
  getSourceRows,
  groupRowsByShopRegion,
  groupShopRegionGroupsByShop,
  normalizeActionType,
  normalizeDetailActionRows,
  normalizePositiveInteger,
  normalizeRegionIds,
  normalizeRoasMode,
  parseRoasDisplayValue
} = require('./promotionManagerNewDetailActionRows');
const {
  assertModifyAdsResponseSuccess,
  buildModifyChunkRowResults,
  extractModifyResponseStats
} = require('./promotionManagerNewDetailActionApi');

const DETAIL_ACTION_MODIFY_ADS_URL = 'https://ads.temu.com/api/v1/coconut/ad/modify_ads';
const DEFAULT_DETAIL_ACTION_CHUNK_SIZE = 50;
const MAX_DETAIL_ACTION_CHUNK_SIZE = 50;
const DETAIL_ROAS_MODE_ORDER = Object.freeze([
  DETAIL_ROAS_MODE_STRONG,
  DETAIL_ROAS_MODE_MEDIUM,
  DETAIL_ROAS_MODE_WEAK
]);
const DETAIL_ROAS_MODE_LABELS = Object.freeze({
  [DETAIL_ROAS_MODE_STRONG]: '\u7ade\u4e89\u529b\u5f3a',
  [DETAIL_ROAS_MODE_MEDIUM]: '\u7ade\u4e89\u529b\u4e2d',
  [DETAIL_ROAS_MODE_WEAK]: '\u7ade\u4e89\u529b\u5f31'
});

function buildMessageSignature(entry) {
  return [
    normalizeText(entry && entry.shopName),
    normalizeText(entry && entry.regionLabel),
    normalizeText(entry && entry.message)
  ].join('|');
}

function pushUniqueMessage(target, entry, signatureSet) {
  const signature = buildMessageSignature(entry);

  if (!signature || signatureSet.has(signature)) {
    return false;
  }

  signatureSet.add(signature);
  target.push(entry);
  return true;
}

function hasSourceRowActionTargetRoas(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => {
    const source = row && typeof row === 'object' ? row : {};

    return normalizeRoasRawValue(
      source.actionTargetRoasRaw
      || source.action_target_roas_raw
      || source.actionTargetRoas
      || source.action_target_roas
      || source.nextTargetRoasRaw
      || source.next_target_roas_raw
      || source.nextTargetRoas
      || source.next_target_roas
    ) !== null;
  });
}

function resolvePredictionMode(prediction, index) {
  const desc = normalizeText(prediction && prediction.desc);

  if (desc.includes(DETAIL_ROAS_MODE_LABELS[DETAIL_ROAS_MODE_STRONG])) {
    return DETAIL_ROAS_MODE_STRONG;
  }

  if (desc.includes(DETAIL_ROAS_MODE_LABELS[DETAIL_ROAS_MODE_MEDIUM])) {
    return DETAIL_ROAS_MODE_MEDIUM;
  }

  if (desc.includes(DETAIL_ROAS_MODE_LABELS[DETAIL_ROAS_MODE_WEAK])) {
    return DETAIL_ROAS_MODE_WEAK;
  }

  return DETAIL_ROAS_MODE_ORDER[index] || '';
}

function findPredictionByMode(bidInfo, mode) {
  const predictions = Array.isArray(bidInfo && bidInfo.predictions)
    ? bidInfo.predictions
    : [];
  const predictionByMode = new Map();

  predictions.forEach((prediction, index) => {
    const predictionMode = resolvePredictionMode(prediction, index);

    if (predictionMode && !predictionByMode.has(predictionMode)) {
      predictionByMode.set(predictionMode, prediction);
    }
  });

  return predictionByMode.get(mode) || null;
}

function resolvePredictionTargetRoasRaw(prediction) {
  const roasRaw = normalizeRoasRawValue(prediction && prediction.roasValueNumber);

  if (roasRaw !== null) {
    return roasRaw;
  }

  return normalizeRoasRawValue(prediction && prediction.roasNumber);
}

function needsLazyBidTarget(row, actionType) {
  return (
    actionType === 'update_roas'
    && normalizeRoasMode(row && row.roasMode) !== DETAIL_ROAS_MODE_CUSTOM
    && !(Number(row && row.actionTargetRoasRaw) > 0)
  );
}

function applyBidLookupToActionRows(rows, bidLookup, actionType) {
  if (actionType !== 'update_roas') {
    return Array.isArray(rows) ? rows : [];
  }

  const lookup = bidLookup instanceof Map ? bidLookup : new Map();

  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (!needsLazyBidTarget(row, actionType)) {
      return row;
    }

    const roasMode = normalizeRoasMode(row && row.roasMode);
    const bidInfo = lookup.get(normalizeText(row && row.goodsId)) || null;
    const prediction = findPredictionByMode(bidInfo, roasMode);
    const actionTargetRoasRaw = resolvePredictionTargetRoasRaw(prediction);

    if (!(actionTargetRoasRaw > 0)) {
      return {
        ...row,
        actionTargetRoasMessage: `\u672a\u83b7\u53d6\u5230${DETAIL_ROAS_MODE_LABELS[roasMode] || '\u5bf9\u5e94\u6863\u4f4d'}ROAS\u9884\u4f30`
      };
    }

    return {
      ...row,
      actionTargetRoasRaw
    };
  });
}

function createPromotionManagerNewDetailActionService({
  promotionAdsSessionService,
  promotionMasterSessionService,
  runtimeLogger
} = {}) {
  const adsSessionService = promotionAdsSessionService || promotionMasterSessionService;
  const activeActionTasks = new Map();
  const pendingCanceledActionTaskIds = new Set();

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

  const bidFetcher = createPromotionManagerNewBidFetcher({
    adsSessionService,
    assertApiSuccess: assertModifyAdsResponseSuccess
  });

  async function resolveRowsWithLazyBidTargets(group, rows, actionType, chunkIndex, allRegionIds, signal) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const rowsNeedingBid = sourceRows.filter((row) => needsLazyBidTarget(row, actionType));

    if (rowsNeedingBid.length <= 0) {
      return sourceRows;
    }

    try {
      const bidResult = await bidFetcher.fetchBidInfoForRows({
        shop: {
          id: group.shopId,
          shopName: group.shopName
        },
        regionId: group.regionId,
        regionIds: allRegionIds,
        rows: rowsNeedingBid,
        roasType: 1,
        pageNumber: chunkIndex + 1,
        signal
      });

      return applyBidLookupToActionRows(sourceRows, bidResult.lookup, actionType);
    } catch (error) {
      const message = normalizeText(error && error.message) || '\u51fa\u4ef7\u9884\u6d4b\u67e5\u8be2\u5931\u8d25';

      logError('promotion_manager_new_detail_action_bid_query_failed', error, {
        shopId: group.shopId,
        shopName: group.shopName,
        regionId: group.regionId,
        actionType,
        chunkIndex: chunkIndex + 1,
        requestCount: rowsNeedingBid.length
      });

      return sourceRows.map((row) => (
        needsLazyBidTarget(row, actionType)
          ? {
            ...row,
            actionTargetRoasMessage: message
          }
          : row
      ));
    }
  }

  function createActionTaskSignal(taskId) {
    const normalizedTaskId = normalizeText(taskId) || buildActionTaskId();
    const signal = {
      taskId: normalizedTaskId,
      canceled: pendingCanceledActionTaskIds.has(normalizedTaskId),
      canceledAt: ''
    };

    pendingCanceledActionTaskIds.delete(normalizedTaskId);
    activeActionTasks.set(normalizedTaskId, signal);
    return signal;
  }

  function cancelDetailActions(payload = {}) {
    const taskId = normalizeText(payload.taskId || payload.task_id);

    if (!taskId) {
      return {
        canceled: false,
        taskId: '',
        message: '\u64cd\u4f5c\u4efb\u52a1\u4e0d\u5b58\u5728'
      };
    }

    const signal = activeActionTasks.get(taskId);

    if (!signal) {
      pendingCanceledActionTaskIds.add(taskId);
      return {
        canceled: true,
        taskId,
        message: '\u5df2\u53d1\u9001\u505c\u6b62\u8bf7\u6c42'
      };
    }

    signal.canceled = true;
    signal.canceledAt = new Date().toISOString();

    return {
      canceled: true,
      taskId,
      message: '\u5df2\u53d1\u9001\u505c\u6b62\u8bf7\u6c42'
    };
  }

  function buildCanceledChunkResult(chunkRows, chunkIndex) {
    const rowResults = chunkRows.map((row) => (
      buildRowResult(row, DETAIL_ACTION_STATUS_CANCELED, '\u5df2\u505c\u6b62\u64cd\u4f5c')
    ));

    return {
      chunkIndex: chunkIndex + 1,
      requestCount: chunkRows.length,
      successCount: 0,
      failedCount: 0,
      canceledCount: chunkRows.length,
      skippedCount: 0,
      warningCount: 0,
      message: '\u5df2\u505c\u6b62\u64cd\u4f5c',
      failedRows: [],
      successRows: [],
      rowResults,
      refreshedCookies: false,
      cookieSyncMode: ''
    };
  }

  function buildSkippedChunkResult(rows, skippedRows, chunkIndex) {
    const rowResults = skippedRows.map((row) => (
      buildRowResult(row, DETAIL_ACTION_STATUS_SKIPPED, normalizeText(row && row.message) || '\u64cd\u4f5c\u5df2\u8df3\u8fc7')
    ));

    return {
      chunkIndex: chunkIndex + 1,
      requestCount: rows.length,
      successCount: 0,
      failedCount: 0,
      canceledCount: 0,
      skippedCount: skippedRows.length,
      warningCount: 0,
      message: '\u6ca1\u6709\u53ef\u6267\u884c\u7684\u63a8\u5e7f',
      failedRows: [],
      successRows: [],
      rowResults,
      refreshedCookies: false,
      cookieSyncMode: ''
    };
  }

  async function submitGroupChunk(group, rows, actionType, targetRoas, chunkIndex, allRegionIds, signal) {
    const preparedRows = await resolveRowsWithLazyBidTargets(
      group,
      rows,
      actionType,
      chunkIndex,
      allRegionIds,
      signal
    );

    if (signal && signal.canceled === true) {
      return buildCanceledChunkResult(preparedRows, chunkIndex);
    }

    const prepared = buildModifyPayloadForRows(preparedRows, actionType, targetRoas);

    if (prepared.rowPayloads.length <= 0) {
      return buildSkippedChunkResult(preparedRows, prepared.skippedRows, chunkIndex);
    }

    const sessionResult = await adsSessionService.postWithRegionCookie(
      group.shopId,
      group.regionId,
      DETAIL_ACTION_MODIFY_ADS_URL,
      prepared.requestPayload,
      {
        allRegionIds,
        reason: `${group.regionId}-${actionType}-modify-ads-chunk-${chunkIndex + 1}`
      }
    );
    const response = sessionResult && sessionResult.response ? sessionResult.response : null;

    assertModifyAdsResponseSuccess(response, '\u63a8\u5e7f\u64cd\u4f5c\u5931\u8d25');

    const stats = extractModifyResponseStats(response, prepared.rowPayloads.length);
    const submittedRows = prepared.rowPayloads.map((entry) => entry.row);
    const submittedRowResults = buildModifyChunkRowResults(submittedRows, stats);
    const skippedRowResults = prepared.skippedRows.map((row) => (
      buildRowResult(row, DETAIL_ACTION_STATUS_SKIPPED, normalizeText(row && row.message) || '\u64cd\u4f5c\u5df2\u8df3\u8fc7')
    ));
    const warningCount = submittedRowResults.filter((row) => row.status === DETAIL_ACTION_STATUS_WARNING).length;

    return {
      chunkIndex: chunkIndex + 1,
      requestCount: preparedRows.length,
      successCount: stats.successCount,
      failedCount: stats.failedCount,
      canceledCount: 0,
      skippedCount: prepared.skippedRows.length,
      warningCount,
      message: stats.message,
      failedRows: stats.failedRows,
      successRows: stats.successRows,
      rowResults: [...submittedRowResults, ...skippedRowResults],
      refreshedCookies: sessionResult && sessionResult.refreshedCookies === true,
      cookieSyncMode: normalizeText(sessionResult && sessionResult.cookieSyncMode)
    };
  }

  function appendChunkResult(groupResult, summary, chunkResult) {
    groupResult.chunks.push(chunkResult);
    groupResult.successCount += chunkResult.successCount;
    groupResult.failedCount += chunkResult.failedCount;
    groupResult.canceledCount += chunkResult.canceledCount;
    groupResult.skippedCount += chunkResult.skippedCount;
    groupResult.warningCount += chunkResult.warningCount;
    summary.successCount += chunkResult.successCount;
    summary.failedCount += chunkResult.failedCount;
    summary.canceledCount += chunkResult.canceledCount;
    summary.skippedCount += chunkResult.skippedCount;
    summary.warningCount += chunkResult.warningCount;
    summary.rowResults.push(...chunkResult.rowResults);
  }

  function createEmptyShopActionSummary() {
    return {
      groups: [],
      errors: [],
      warnings: [],
      rowResults: [],
      successCount: 0,
      failedCount: 0,
      canceledCount: 0,
      skippedCount: 0,
      warningCount: 0
    };
  }

  async function submitShopGroups(shopGroup, regionIdsByShop, actionType, targetRoas, chunkSize, signal) {
    const summary = createEmptyShopActionSummary();
    const errorSignatures = new Set();
    const warningSignatures = new Set();

    for (const group of shopGroup.groups) {
      const chunks = chunkList(group.rows, chunkSize);
      const groupResult = {
        shopId: group.shopId,
        shopName: group.shopName,
        regionId: group.regionId,
        regionLabel: group.regionLabel,
        rowCount: group.rows.length,
        successCount: 0,
        failedCount: 0,
        canceledCount: 0,
        skippedCount: 0,
        warningCount: 0,
        chunks: []
      };
      const allRegionIds = regionIdsByShop.get(group.shopId) || [group.regionId];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunkRows = chunks[chunkIndex];

        if (signal && signal.canceled === true) {
          const chunkResult = buildCanceledChunkResult(chunkRows, chunkIndex);

          appendChunkResult(groupResult, summary, chunkResult);
          pushUniqueMessage(summary.warnings, {
            shopId: group.shopId,
            shopName: group.shopName,
            regionId: group.regionId,
            regionLabel: group.regionLabel,
            message: '\u5df2\u505c\u6b62\u64cd\u4f5c'
          }, warningSignatures);
          continue;
        }

        try {
          const chunkResult = await submitGroupChunk(
            group,
            chunkRows,
            actionType,
            targetRoas,
            chunkIndex,
            allRegionIds,
            signal
          );

          appendChunkResult(groupResult, summary, chunkResult);

          if (chunkResult.failedCount > 0 || chunkResult.warningCount > 0) {
            pushUniqueMessage(summary.warnings, {
              shopId: group.shopId,
              shopName: group.shopName,
              regionId: group.regionId,
              regionLabel: group.regionLabel,
              message: chunkResult.message || '\u90e8\u5206\u63a8\u5e7f\u64cd\u4f5c\u9700\u786e\u8ba4'
            }, warningSignatures);
          }
        } catch (error) {
          const message = normalizeText(error && error.message) || '\u63a8\u5e7f\u64cd\u4f5c\u5931\u8d25';
          const failedRowResults = chunkRows.map((row) => (
            buildRowResult(row, DETAIL_ACTION_STATUS_FAILED, message)
          ));
          const chunkResult = {
            chunkIndex: chunkIndex + 1,
            requestCount: chunkRows.length,
            successCount: 0,
            failedCount: chunkRows.length,
            canceledCount: 0,
            skippedCount: 0,
            warningCount: 0,
            message,
            failedRows: [],
            successRows: [],
            rowResults: failedRowResults,
            refreshedCookies: false,
            cookieSyncMode: ''
          };

          appendChunkResult(groupResult, summary, chunkResult);
          pushUniqueMessage(summary.errors, {
            shopId: group.shopId,
            shopName: group.shopName,
            regionId: group.regionId,
            regionLabel: group.regionLabel,
            message
          }, errorSignatures);
          logError('promotion_manager_new_detail_action_chunk_failed', error, {
            shopId: group.shopId,
            shopName: group.shopName,
            regionId: group.regionId,
            actionType,
            chunkIndex: chunkIndex + 1,
            requestCount: chunkRows.length
          });
        }
      }

      summary.groups.push(groupResult);
    }

    return summary;
  }

  async function executeDetailActions(payload = {}) {
    if (!adsSessionService || typeof adsSessionService.postWithRegionCookie !== 'function') {
      throw new Error('\u63a8\u5e7f\u4f1a\u8bdd\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const sourceRows = getSourceRows(payload);

    if (sourceRows.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u9700\u8981\u64cd\u4f5c\u7684\u63a8\u5e7f');
    }

    const actionType = normalizeActionType(payload.actionType || payload.action_type);
    const roasMode = normalizeRoasMode(payload.roasMode || payload.roas_mode);
    const targetRoas = TARGET_ROAS_ACTION_TYPES.has(actionType)
      ? parseRoasDisplayValue(payload.targetRoas || payload.target_roas)
      : null;

    if (actionType === 'increase_roas' && normalizeRoasRawValue(targetRoas) === null) {
      throw new Error('\u8bf7\u5148\u8f93\u5165\u76ee\u6807ROAS');
    }

    if (
      actionType === 'update_roas'
      && roasMode === DETAIL_ROAS_MODE_CUSTOM
      && normalizeRoasRawValue(targetRoas) === null
      && !hasSourceRowActionTargetRoas(sourceRows)
    ) {
      throw new Error('\u8bf7\u5148\u8f93\u5165\u76ee\u6807ROAS');
    }

    const taskSignal = createActionTaskSignal(payload.taskId || payload.task_id);

    try {
      const normalized = normalizeDetailActionRows({
        ...payload,
        actionType
      });
      const requestedRegionIds = normalizeRegionIds(payload.regionIds || payload.region_ids);
      const regionIdsByShop = buildRegionIdsByShop(normalized.rows, requestedRegionIds);
      const groups = groupRowsByShopRegion(normalized.rows);
      const shopGroups = groupShopRegionGroupsByShop(groups);
      const errors = [];
      const warnings = [];
      const rowResults = [];
      const errorSignatures = new Set();
      const warningSignatures = new Set();
      const chunkSize = normalizePositiveInteger(
        payload.chunkSize || payload.chunk_size,
        DEFAULT_DETAIL_ACTION_CHUNK_SIZE,
        { maximum: MAX_DETAIL_ACTION_CHUNK_SIZE }
      );
      let successCount = 0;
      let failedCount = 0;
      let canceledCount = 0;
      let skippedCount = 0;
      let warningCount = 0;

      normalized.skippedRows.forEach((row) => {
        rowResults.push(buildRowResult(row, DETAIL_ACTION_STATUS_SKIPPED, normalizeText(row && row.message)));
        skippedCount += 1;
        pushUniqueMessage(warnings, {
          shopId: normalizeText(row && row.shopId),
          shopName: normalizeText(row && row.shopName),
          regionId: normalizeText(row && row.regionId),
          regionLabel: normalizeText(row && row.regionLabel),
          goodsId: normalizeText(row && row.goodsId),
          adId: normalizeText(row && row.adId),
          message: normalizeText(row && row.message) || '\u63a8\u5e7f\u5df2\u8df3\u8fc7'
        }, warningSignatures);
      });

      const shopResults = await Promise.all(shopGroups.map((shopGroup) => (
        submitShopGroups(shopGroup, regionIdsByShop, actionType, targetRoas, chunkSize, taskSignal)
      )));
      const groupResults = [];

      shopResults.forEach((shopResult) => {
        groupResults.push(...shopResult.groups);
        rowResults.push(...shopResult.rowResults);
        successCount += shopResult.successCount;
        failedCount += shopResult.failedCount;
        canceledCount += shopResult.canceledCount;
        skippedCount += shopResult.skippedCount;
        warningCount += shopResult.warningCount;

        shopResult.errors.forEach((entry) => {
          pushUniqueMessage(errors, entry, errorSignatures);
        });
        shopResult.warnings.forEach((entry) => {
          pushUniqueMessage(warnings, entry, warningSignatures);
        });
      });

      if (normalized.rows.length <= 0 && normalized.skippedRows.length > 0) {
        pushUniqueMessage(errors, {
          shopId: '',
          shopName: '',
          regionId: '',
          regionLabel: '',
          message: '\u6ca1\u6709\u53ef\u6267\u884c\u64cd\u4f5c\u7684\u63a8\u5e7f'
        }, errorSignatures);
      }

      const result = {
        taskId: taskSignal.taskId,
        canceled: taskSignal.canceled === true,
        updatedAt: new Date().toISOString(),
        request: {
          rowCount: sourceRows.length,
          validCount: normalized.rows.length,
          skippedCount: normalized.skippedRows.length,
          groupCount: groups.length,
          shopThreadCount: shopGroups.length,
          chunkSize,
          actionType,
          roasMode
        },
        groups: groupResults,
        rowResults,
        errors,
        warnings,
        totalCount: sourceRows.length,
        successCount,
        failedCount,
        skippedCount,
        canceledCount,
        warningCount
      };

      log('promotion_manager_new_detail_action_finished', {
        taskId: taskSignal.taskId,
        canceled: taskSignal.canceled === true,
        actionType,
        roasMode,
        rowCount: sourceRows.length,
        validCount: normalized.rows.length,
        skippedCount,
        groupCount: groups.length,
        shopThreadCount: shopGroups.length,
        successCount,
        failedCount,
        canceledCount,
        warningCount,
        errorCount: errors.length,
        warningMessageCount: warnings.length
      });

      return sanitizeDetailActionResult(result);
    } finally {
      activeActionTasks.delete(taskSignal.taskId);
    }
  }

  return {
    cancelDetailActions,
    executeDetailActions
  };
}

module.exports = {
  DETAIL_ACTION_MODIFY_ADS_URL,
  DEFAULT_DETAIL_ACTION_CHUNK_SIZE,
  MAX_DETAIL_ACTION_CHUNK_SIZE,
  createPromotionManagerNewDetailActionService
};
