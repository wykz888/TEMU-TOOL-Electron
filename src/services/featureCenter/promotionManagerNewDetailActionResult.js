const { normalizeText } = require('../shopManagement/common');

const DETAIL_ACTION_STATUS_VALUES = new Set([
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
  'canceled',
  'warning',
  'configured'
]);

function normalizeFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeNonNegativeInteger(value) {
  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null || numberValue <= 0) {
    return 0;
  }

  return Math.trunc(numberValue);
}

function normalizeActionStatus(value) {
  const status = normalizeText(value);

  return DETAIL_ACTION_STATUS_VALUES.has(status) ? status : 'failed';
}

function toPlainJsonObject(value) {
  try {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const text = JSON.stringify(value);
    return text ? JSON.parse(text) : {};
  } catch (_error) {
    return {};
  }
}

function normalizePlainJsonRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(toPlainJsonObject)
    .filter((row) => Object.keys(row).length > 0);
}

function sanitizeDetailActionRowResult(row) {
  return {
    rowKey: normalizeText(row && row.rowKey),
    shopId: normalizeText(row && row.shopId),
    shopName: normalizeText(row && row.shopName),
    regionId: normalizeText(row && row.regionId),
    regionLabel: normalizeText(row && row.regionLabel),
    goodsId: normalizeText(row && row.goodsId),
    adId: normalizeText(row && row.adId),
    roasMode: normalizeText(row && row.roasMode),
    actionType: normalizeText(row && row.actionType),
    status: normalizeActionStatus(row && row.status),
    message: normalizeText(row && row.message)
  };
}

function sanitizeDetailActionMessageEntry(entry) {
  return {
    shopId: normalizeText(entry && entry.shopId),
    shopName: normalizeText(entry && entry.shopName),
    regionId: normalizeText(entry && entry.regionId),
    regionLabel: normalizeText(entry && entry.regionLabel),
    goodsId: normalizeText(entry && entry.goodsId),
    adId: normalizeText(entry && entry.adId),
    message: normalizeText(entry && entry.message)
  };
}

function sanitizeDetailActionChunkResult(chunk) {
  return {
    chunkIndex: normalizeNonNegativeInteger(chunk && chunk.chunkIndex),
    requestCount: normalizeNonNegativeInteger(chunk && chunk.requestCount),
    successCount: normalizeNonNegativeInteger(chunk && chunk.successCount),
    failedCount: normalizeNonNegativeInteger(chunk && chunk.failedCount),
    canceledCount: normalizeNonNegativeInteger(chunk && chunk.canceledCount),
    skippedCount: normalizeNonNegativeInteger(chunk && chunk.skippedCount),
    warningCount: normalizeNonNegativeInteger(chunk && chunk.warningCount),
    message: normalizeText(chunk && chunk.message),
    failedRows: normalizePlainJsonRows(chunk && chunk.failedRows),
    successRows: normalizePlainJsonRows(chunk && chunk.successRows),
    rowResults: (Array.isArray(chunk && chunk.rowResults) ? chunk.rowResults : [])
      .map(sanitizeDetailActionRowResult),
    refreshedCookies: Boolean(chunk && chunk.refreshedCookies === true),
    cookieSyncMode: normalizeText(chunk && chunk.cookieSyncMode)
  };
}

function sanitizeDetailActionGroupResult(group) {
  return {
    shopId: normalizeText(group && group.shopId),
    shopName: normalizeText(group && group.shopName),
    regionId: normalizeText(group && group.regionId),
    regionLabel: normalizeText(group && group.regionLabel),
    rowCount: normalizeNonNegativeInteger(group && group.rowCount),
    successCount: normalizeNonNegativeInteger(group && group.successCount),
    failedCount: normalizeNonNegativeInteger(group && group.failedCount),
    canceledCount: normalizeNonNegativeInteger(group && group.canceledCount),
    skippedCount: normalizeNonNegativeInteger(group && group.skippedCount),
    warningCount: normalizeNonNegativeInteger(group && group.warningCount),
    chunks: (Array.isArray(group && group.chunks) ? group.chunks : [])
      .map(sanitizeDetailActionChunkResult)
  };
}

function sanitizeDetailActionRequestSummary(request) {
  return {
    rowCount: normalizeNonNegativeInteger(request && request.rowCount),
    validCount: normalizeNonNegativeInteger(request && request.validCount),
    skippedCount: normalizeNonNegativeInteger(request && request.skippedCount),
    groupCount: normalizeNonNegativeInteger(request && request.groupCount),
    shopThreadCount: normalizeNonNegativeInteger(request && request.shopThreadCount),
    chunkSize: normalizeNonNegativeInteger(request && request.chunkSize),
    actionType: normalizeText(request && request.actionType),
    roasMode: normalizeText(request && request.roasMode)
  };
}

function sanitizeDetailActionResult(result = {}) {
  return {
    taskId: normalizeText(result && result.taskId),
    canceled: Boolean(result && result.canceled === true),
    updatedAt: normalizeText(result && result.updatedAt),
    request: sanitizeDetailActionRequestSummary(result && result.request),
    groups: (Array.isArray(result && result.groups) ? result.groups : [])
      .map(sanitizeDetailActionGroupResult),
    rowResults: (Array.isArray(result && result.rowResults) ? result.rowResults : [])
      .map(sanitizeDetailActionRowResult),
    errors: (Array.isArray(result && result.errors) ? result.errors : [])
      .map(sanitizeDetailActionMessageEntry),
    warnings: (Array.isArray(result && result.warnings) ? result.warnings : [])
      .map(sanitizeDetailActionMessageEntry),
    totalCount: normalizeNonNegativeInteger(result && result.totalCount),
    successCount: normalizeNonNegativeInteger(result && result.successCount),
    failedCount: normalizeNonNegativeInteger(result && result.failedCount),
    skippedCount: normalizeNonNegativeInteger(result && result.skippedCount),
    canceledCount: normalizeNonNegativeInteger(result && result.canceledCount),
    warningCount: normalizeNonNegativeInteger(result && result.warningCount)
  };
}

module.exports = {
  sanitizeDetailActionResult,
  sanitizeDetailActionRowResult
};
