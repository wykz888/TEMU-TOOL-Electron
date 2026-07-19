import {
  DETAIL_ACTION_UPDATE_ROAS,
  DETAIL_ROAS_MODE_CUSTOM,
  DETAIL_ROAS_MODE_MEDIUM,
  DETAIL_ROAS_MODE_STRONG,
  DETAIL_ROAS_MODE_WEAK,
  getPromotionDetailRowKey,
  normalizeText
} from './promotionDetailRows.js';

export const DETAIL_ACTION_ROAS_VALUE_SCALE = 10000;

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

function normalizePositiveRoasNumber(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function toRoasSubmitValue(value) {
  const roasNumber = normalizePositiveRoasNumber(value);

  return roasNumber === null
    ? null
    : Math.round(roasNumber * DETAIL_ACTION_ROAS_VALUE_SCALE);
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

function getBidInfo(row) {
  return row && row.bidInfo && typeof row.bidInfo === 'object'
    ? row.bidInfo
    : {};
}

function getPredictions(row) {
  const bidInfo = getBidInfo(row);

  return Array.isArray(bidInfo.predictions) ? bidInfo.predictions : [];
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

function findPredictionByMode(row, mode) {
  const predictionByMode = new Map();

  getPredictions(row).forEach((prediction, index) => {
    const predictionMode = resolvePredictionMode(prediction, index);

    if (predictionMode && !predictionByMode.has(predictionMode)) {
      predictionByMode.set(predictionMode, prediction);
    }
  });

  return predictionByMode.get(mode) || null;
}

function resolvePredictionRoasRawValue(prediction) {
  const roasRawValue = normalizeFiniteNumber(prediction && prediction.roasValueNumber);

  if (roasRawValue !== null && roasRawValue > 0) {
    return Math.trunc(roasRawValue);
  }

  return toRoasSubmitValue(prediction && prediction.roasNumber);
}

function normalizeDetailRoasMode(value) {
  const normalizedMode = normalizeText(value);

  return [
    DETAIL_ROAS_MODE_STRONG,
    DETAIL_ROAS_MODE_MEDIUM,
    DETAIL_ROAS_MODE_WEAK,
    DETAIL_ROAS_MODE_CUSTOM
  ].includes(normalizedMode)
    ? normalizedMode
    : DETAIL_ROAS_MODE_STRONG;
}

function normalizeDetailActionDraft(actionDraft) {
  const source = actionDraft && typeof actionDraft === 'object'
    ? actionDraft
    : { actionType: actionDraft };

  return {
    actionType: normalizeText(source.actionType),
    roasMode: normalizeDetailRoasMode(source.roasMode),
    targetRoas: normalizeSubmitNumber(source.targetRoas)
  };
}

function resolveActionTargetRoasRaw(row, actionDraft) {
  if (actionDraft.actionType !== DETAIL_ACTION_UPDATE_ROAS) {
    return null;
  }

  if (actionDraft.roasMode === DETAIL_ROAS_MODE_CUSTOM) {
    return toRoasSubmitValue(actionDraft.targetRoas);
  }

  return resolvePredictionRoasRawValue(findPredictionByMode(row, actionDraft.roasMode));
}

export function buildDetailActionSubmitRows(rows, actionDraft) {
  const normalizedActionDraft = normalizeDetailActionDraft(actionDraft);
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
      actionTargetRoasRaw: resolveActionTargetRoasRaw(row, normalizedActionDraft),
      roasMode: normalizedActionDraft.roasMode,
      actionType: normalizedActionDraft.actionType
    });
  });

  return submitRows;
}

export function buildCloneableDetailActionPayload({
  taskId,
  actionType,
  roasMode,
  targetRoas,
  rows,
  regionIds
} = {}) {
  return {
    taskId: normalizeText(taskId),
    actionType: normalizeText(actionType),
    roasMode: normalizeDetailRoasMode(roasMode),
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
      actionTargetRoasRaw: normalizeSubmitInteger(row && row.actionTargetRoasRaw),
      roasMode: normalizeDetailRoasMode(row && row.roasMode),
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
