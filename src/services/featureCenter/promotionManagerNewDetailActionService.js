const { normalizeText } = require('../shopManagement/common');
const {
  normalizeRoasRawValue
} = require('./promotionMonitorMetricUtils');
const {
  sanitizeDetailActionResult
} = require('./promotionManagerNewDetailActionResult');
const {
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

  async function submitGroupChunk(group, rows, actionType, targetRoas, chunkIndex, allRegionIds) {
    const prepared = buildModifyPayloadForRows(rows, actionType, targetRoas);

    if (prepared.rowPayloads.length <= 0) {
      return buildSkippedChunkResult(rows, prepared.skippedRows, chunkIndex);
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
      requestCount: rows.length,
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
            allRegionIds
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
    const targetRoas = TARGET_ROAS_ACTION_TYPES.has(actionType)
      ? parseRoasDisplayValue(payload.targetRoas || payload.target_roas)
      : null;

    if (TARGET_ROAS_ACTION_TYPES.has(actionType) && normalizeRoasRawValue(targetRoas) === null) {
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
          actionType
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
