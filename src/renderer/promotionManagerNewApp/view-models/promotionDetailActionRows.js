import { getPromotionDetailRowKey, normalizeText } from './promotionDetailRows.js';

export const DETAIL_ACTION_ROAS_VALUE_SCALE = 10000;

function normalizeTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeSubmitInteger(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue === null ? null : Math.trunc(numberValue);
}

function normalizeSubmitNumber(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue === null ? null : numberValue;
}

function normalizeTargetRoasRaw(row) {
  const rawValue = normalizeFiniteNumber(row && row.targetRoasRaw);

  if (rawValue !== null && rawValue > 0) {
    return Math.trunc(rawValue);
  }

  const displayValue = normalizeFiniteNumber(row && row.targetRoasValue);

  return displayValue !== null && displayValue > 0
    ? Math.round(displayValue * DETAIL_ACTION_ROAS_VALUE_SCALE)
    : null;
}

export function buildDetailActionSubmitRows(rows, actionType) {
  const submitRows = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    submitRows.push({
      rowKey: getPromotionDetailRowKey(row),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      regionId: normalizeText(row && row.regionId),
      regionLabel: normalizeText(row && row.regionLabel),
      goodsId: normalizeText(row && row.goodsId),
      adId: normalizeText(row && row.adId),
      targetRoasRaw: normalizeTargetRoasRaw(row),
      actionType: normalizeText(actionType)
    });
  });

  return submitRows;
}

export function buildCloneableDetailActionPayload({
  taskId,
  actionType,
  targetRoas,
  rows,
  regionIds
} = {}) {
  return {
    taskId: normalizeText(taskId),
    actionType: normalizeText(actionType),
    targetRoas: normalizeSubmitNumber(targetRoas),
    rows: (Array.isArray(rows) ? rows : []).map((row) => ({
      rowKey: normalizeText(row && row.rowKey),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      regionId: normalizeText(row && row.regionId),
      regionLabel: normalizeText(row && row.regionLabel),
      goodsId: normalizeText(row && row.goodsId),
      adId: normalizeText(row && row.adId),
      targetRoasRaw: normalizeSubmitInteger(row && row.targetRoasRaw),
      actionType: normalizeText(row && row.actionType)
    })),
    regionIds: normalizeTextList(regionIds)
  };
}

export function hasDetailActionRows(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => (
    normalizeText(row && row.shopId)
    && normalizeText(row && row.regionId)
    && normalizeText(row && row.goodsId)
  ));
}
