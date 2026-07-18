import { getGoodsRowKey } from './createPromotionGoodsRows.js';

export const CREATE_STATUS_PENDING = 'pending';
export const CREATE_STATUS_CREATING = 'creating';
export const CREATE_STATUS_SUCCESS = 'success';
export const CREATE_STATUS_FAILED = 'failed';
export const CREATE_STATUS_SKIPPED = 'skipped';
export const CREATE_STATUS_CANCELED = 'canceled';

export const CREATE_STATUS_LABELS = Object.freeze({
  [CREATE_STATUS_PENDING]: '\u5f85\u521b\u5efa',
  [CREATE_STATUS_CREATING]: '\u521b\u5efa\u4e2d',
  [CREATE_STATUS_SUCCESS]: '\u521b\u5efa\u6210\u529f',
  [CREATE_STATUS_FAILED]: '\u521b\u5efa\u5931\u8d25',
  [CREATE_STATUS_SKIPPED]: '\u5df2\u8df3\u8fc7',
  [CREATE_STATUS_CANCELED]: '\u5df2\u505c\u6b62'
});

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeStatus(value) {
  const status = normalizeText(value);

  return Object.prototype.hasOwnProperty.call(CREATE_STATUS_LABELS, status)
    ? status
    : CREATE_STATUS_PENDING;
}

function getRowResultKey(result) {
  return normalizeText(result && result.rowKey) || [
    normalizeText(result && result.shopId),
    normalizeText(result && result.regionId),
    normalizeText(result && result.goodsId)
  ].filter(Boolean).join(':');
}

export function getCreateStatusRecord(statusMap, row) {
  const rowKey = getGoodsRowKey(row);
  const record = statusMap && rowKey ? statusMap[rowKey] : null;
  const status = normalizeStatus(record && record.status);

  return {
    status,
    label: CREATE_STATUS_LABELS[status],
    message: normalizeText(record && record.message),
    updatedAt: normalizeText(record && record.updatedAt)
  };
}

export function patchCreateStatusForRows(statusMap, rows, status, message = '') {
  const nextStatusMap = {
    ...(statusMap && typeof statusMap === 'object' ? statusMap : {})
  };
  const normalizedStatus = normalizeStatus(status);
  const updatedAt = new Date().toISOString();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowKey = normalizeText(row && row.rowKey) || getGoodsRowKey(row);

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

export function applyCreateResultToStatusMap(statusMap, result) {
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
