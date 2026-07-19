import { getPromotionDetailRowKey, normalizeText } from './promotionDetailRows.js';

export const DETAIL_ACTION_STATUS_PENDING = 'pending';
export const DETAIL_ACTION_STATUS_RUNNING = 'running';
export const DETAIL_ACTION_STATUS_SUCCESS = 'success';
export const DETAIL_ACTION_STATUS_FAILED = 'failed';
export const DETAIL_ACTION_STATUS_SKIPPED = 'skipped';
export const DETAIL_ACTION_STATUS_CANCELED = 'canceled';
export const DETAIL_ACTION_STATUS_WARNING = 'warning';

export const DETAIL_ACTION_STATUS_LABELS = Object.freeze({
  [DETAIL_ACTION_STATUS_PENDING]: '\u5f85\u5904\u7406',
  [DETAIL_ACTION_STATUS_RUNNING]: '\u6267\u884c\u4e2d',
  [DETAIL_ACTION_STATUS_SUCCESS]: '\u64cd\u4f5c\u6210\u529f',
  [DETAIL_ACTION_STATUS_FAILED]: '\u64cd\u4f5c\u5931\u8d25',
  [DETAIL_ACTION_STATUS_SKIPPED]: '\u5df2\u8df3\u8fc7',
  [DETAIL_ACTION_STATUS_CANCELED]: '\u5df2\u505c\u6b62',
  [DETAIL_ACTION_STATUS_WARNING]: '\u9700\u786e\u8ba4'
});

function normalizeStatus(value) {
  const status = normalizeText(value);

  return Object.prototype.hasOwnProperty.call(DETAIL_ACTION_STATUS_LABELS, status)
    ? status
    : DETAIL_ACTION_STATUS_PENDING;
}

function getRowResultKey(result) {
  return normalizeText(result && result.rowKey) || [
    normalizeText(result && result.shopId),
    normalizeText(result && result.regionId),
    normalizeText(result && result.adId),
    normalizeText(result && result.goodsId)
  ].filter(Boolean).join(':');
}

export function getDetailActionStatusRecord(statusMap, row) {
  const rowKey = getPromotionDetailRowKey(row);
  const record = statusMap && rowKey ? statusMap[rowKey] : null;
  const rowStatus = normalizeStatus(record && record.status);
  const fallbackStatus = normalizeStatus(row && row.actionStatusValue);
  const status = record ? rowStatus : fallbackStatus;

  return {
    status,
    label: record
      ? DETAIL_ACTION_STATUS_LABELS[status]
      : (normalizeText(row && row.actionStatusLabel) || DETAIL_ACTION_STATUS_LABELS[status]),
    message: record
      ? normalizeText(record && record.message)
      : normalizeText(row && row.actionMessage),
    updatedAt: normalizeText(record && record.updatedAt)
  };
}

export function patchDetailActionStatusForRows(statusMap, rows, status, message = '') {
  const nextStatusMap = {
    ...(statusMap && typeof statusMap === 'object' ? statusMap : {})
  };
  const normalizedStatus = normalizeStatus(status);
  const updatedAt = new Date().toISOString();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowKey = normalizeText(row && row.rowKey) || getPromotionDetailRowKey(row);

    if (!rowKey) {
      return;
    }

    nextStatusMap[rowKey] = {
      status: normalizedStatus,
      message: normalizeText(message),
      updatedAt
    };
  });

  return nextStatusMap;
}

export function applyDetailActionResultToStatusMap(statusMap, result) {
  const nextStatusMap = {
    ...(statusMap && typeof statusMap === 'object' ? statusMap : {})
  };
  const updatedAt = new Date().toISOString();
  const rowResults = Array.isArray(result && result.rowResults)
    ? result.rowResults
    : [];

  rowResults.forEach((rowResult) => {
    const rowKey = getRowResultKey(rowResult);

    if (!rowKey) {
      return;
    }

    nextStatusMap[rowKey] = {
      status: normalizeStatus(rowResult && rowResult.status),
      message: normalizeText(rowResult && rowResult.message),
      updatedAt
    };
  });

  return nextStatusMap;
}
