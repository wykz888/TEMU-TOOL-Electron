const { normalizeText } = require('../shopManagement/common');

const CREATE_STATUS_VALUES = new Set([
  'success',
  'failed',
  'skipped',
  'canceled'
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

function normalizeCreateStatus(value) {
  const status = normalizeText(value);

  return CREATE_STATUS_VALUES.has(status) ? status : 'failed';
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

function sanitizeCreateRowResult(row) {
  return {
    rowKey: normalizeText(row && row.rowKey),
    shopId: normalizeText(row && row.shopId),
    shopName: normalizeText(row && row.shopName),
    regionId: normalizeText(row && row.regionId),
    regionLabel: normalizeText(row && row.regionLabel),
    goodsId: normalizeText(row && row.goodsId),
    status: normalizeCreateStatus(row && row.status),
    message: normalizeText(row && row.message)
  };
}

function sanitizeCreateMessageEntry(entry) {
  return {
    shopId: normalizeText(entry && entry.shopId),
    shopName: normalizeText(entry && entry.shopName),
    regionId: normalizeText(entry && entry.regionId),
    regionLabel: normalizeText(entry && entry.regionLabel),
    goodsId: normalizeText(entry && entry.goodsId),
    message: normalizeText(entry && entry.message)
  };
}

function sanitizeCreateChunkResult(chunk) {
  return {
    chunkIndex: normalizeNonNegativeInteger(chunk && chunk.chunkIndex),
    requestCount: normalizeNonNegativeInteger(chunk && chunk.requestCount),
    successCount: normalizeNonNegativeInteger(chunk && chunk.successCount),
    failedCount: normalizeNonNegativeInteger(chunk && chunk.failedCount),
    canceledCount: normalizeNonNegativeInteger(chunk && chunk.canceledCount),
    message: normalizeText(chunk && chunk.message),
    failedRows: normalizePlainJsonRows(chunk && chunk.failedRows),
    successRows: normalizePlainJsonRows(chunk && chunk.successRows),
    rowResults: (Array.isArray(chunk && chunk.rowResults) ? chunk.rowResults : []).map(sanitizeCreateRowResult),
    refreshedCookies: Boolean(chunk && chunk.refreshedCookies === true),
    cookieSyncMode: normalizeText(chunk && chunk.cookieSyncMode)
  };
}

function sanitizeCreateGroupResult(group) {
  return {
    shopId: normalizeText(group && group.shopId),
    shopName: normalizeText(group && group.shopName),
    regionId: normalizeText(group && group.regionId),
    regionLabel: normalizeText(group && group.regionLabel),
    rowCount: normalizeNonNegativeInteger(group && group.rowCount),
    successCount: normalizeNonNegativeInteger(group && group.successCount),
    failedCount: normalizeNonNegativeInteger(group && group.failedCount),
    canceledCount: normalizeNonNegativeInteger(group && group.canceledCount),
    chunks: (Array.isArray(group && group.chunks) ? group.chunks : []).map(sanitizeCreateChunkResult)
  };
}

function sanitizeCreateRequestSummary(request) {
  return {
    rowCount: normalizeNonNegativeInteger(request && request.rowCount),
    validCount: normalizeNonNegativeInteger(request && request.validCount),
    skippedCount: normalizeNonNegativeInteger(request && request.skippedCount),
    groupCount: normalizeNonNegativeInteger(request && request.groupCount),
    shopThreadCount: normalizeNonNegativeInteger(request && request.shopThreadCount),
    chunkSize: normalizeNonNegativeInteger(request && request.chunkSize)
  };
}

function sanitizeCreateAdsResult(result = {}) {
  return {
    taskId: normalizeText(result && result.taskId),
    canceled: Boolean(result && result.canceled === true),
    updatedAt: normalizeText(result && result.updatedAt),
    request: sanitizeCreateRequestSummary(result && result.request),
    groups: (Array.isArray(result && result.groups) ? result.groups : []).map(sanitizeCreateGroupResult),
    rowResults: (Array.isArray(result && result.rowResults) ? result.rowResults : []).map(sanitizeCreateRowResult),
    errors: (Array.isArray(result && result.errors) ? result.errors : []).map(sanitizeCreateMessageEntry),
    warnings: (Array.isArray(result && result.warnings) ? result.warnings : []).map(sanitizeCreateMessageEntry),
    totalCount: normalizeNonNegativeInteger(result && result.totalCount),
    successCount: normalizeNonNegativeInteger(result && result.successCount),
    failedCount: normalizeNonNegativeInteger(result && result.failedCount),
    skippedCount: normalizeNonNegativeInteger(result && result.skippedCount),
    canceledCount: normalizeNonNegativeInteger(result && result.canceledCount)
  };
}

module.exports = {
  sanitizeCreateAdsResult,
  sanitizeCreateRowResult
};
