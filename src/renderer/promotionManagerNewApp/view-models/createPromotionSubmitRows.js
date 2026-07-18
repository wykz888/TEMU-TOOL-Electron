import {
  BUDGET_MODE_CUSTOM,
  BUDGET_MODE_UNLIMITED,
  ROAS_MODE_CUSTOM,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_STRONG,
  ROAS_MODE_WEAK,
  buildGoodsRowDraft,
  getGoodsRowKey
} from './createPromotionGoodsRows.js';

export const CREATE_ADS_ROAS_TYPE = 1;
export const CREATE_ADS_ROAS_VALUE_SCALE = 10000;

const ROAS_MODE_ORDER = Object.freeze([
  ROAS_MODE_STRONG,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_WEAK
]);

const ROAS_MODE_LABELS = Object.freeze({
  [ROAS_MODE_STRONG]: '\u7ade\u4e89\u529b\u5f3a',
  [ROAS_MODE_MEDIUM]: '\u7ade\u4e89\u529b\u4e2d',
  [ROAS_MODE_WEAK]: '\u7ade\u4e89\u529b\u5f31'
});

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizePositiveInteger(value) {
  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null || numberValue <= 0) {
    return null;
  }

  return Math.trunc(numberValue);
}

function normalizePositiveRoasNumber(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function toRoasSubmitValue(value) {
  const roasNumber = normalizePositiveRoasNumber(value);

  return roasNumber === null
    ? null
    : Math.round(roasNumber * CREATE_ADS_ROAS_VALUE_SCALE);
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

  if (desc.includes(ROAS_MODE_LABELS[ROAS_MODE_STRONG])) {
    return ROAS_MODE_STRONG;
  }

  if (desc.includes(ROAS_MODE_LABELS[ROAS_MODE_MEDIUM])) {
    return ROAS_MODE_MEDIUM;
  }

  if (desc.includes(ROAS_MODE_LABELS[ROAS_MODE_WEAK])) {
    return ROAS_MODE_WEAK;
  }

  return ROAS_MODE_ORDER[index] || '';
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

function resolveBudgetValue(draft) {
  if (draft.budgetMode === BUDGET_MODE_UNLIMITED) {
    return -1;
  }

  if (draft.budgetMode === BUDGET_MODE_CUSTOM) {
    return normalizePositiveInteger(draft.customBudget);
  }

  return null;
}

function resolvePredictionRoasValue(prediction) {
  const roasValue = normalizeFiniteNumber(prediction && prediction.roasValueNumber);

  if (roasValue !== null && roasValue > 0) {
    return Math.trunc(roasValue);
  }

  return toRoasSubmitValue(prediction && prediction.roasNumber);
}

function resolveRoasValue(row, draft) {
  if (draft.roasMode === ROAS_MODE_CUSTOM) {
    return toRoasSubmitValue(draft.customRoas);
  }

  return resolvePredictionRoasValue(findPredictionByMode(row, draft.roasMode));
}

function buildInvalidReasonList(row, budget, roas) {
  const reasons = [];

  if (!normalizeText(row && row.shopId)) {
    reasons.push('\u5e97\u94fa\u7f3a\u5931');
  }

  if (!normalizeText(row && row.regionId)) {
    reasons.push('\u5730\u533a\u7f3a\u5931');
  }

  if (!normalizeText(row && row.goodsId)) {
    reasons.push('\u5546\u54c1ID\u7f3a\u5931');
  }

  if (budget === null) {
    reasons.push('\u63a8\u5e7f\u65e5\u9884\u7b97\u65e0\u6548');
  }

  if (roas === null) {
    reasons.push('\u76ee\u6807ROAS\u65e0\u6548');
  }

  return reasons;
}

export function buildCreateAdsSubmitRows(rows, draftMap = {}) {
  const submitRows = [];
  const invalidRows = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowKey = getGoodsRowKey(row);
    const draft = {
      ...buildGoodsRowDraft(row),
      ...(draftMap && draftMap[rowKey] && typeof draftMap[rowKey] === 'object' ? draftMap[rowKey] : {})
    };
    const budget = resolveBudgetValue(draft);
    const roas = resolveRoasValue(row, draft);
    const invalidReasons = buildInvalidReasonList(row, budget, roas);
    const submitRow = {
      rowKey,
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      regionId: normalizeText(row && row.regionId),
      regionLabel: normalizeText(row && row.regionLabel),
      goodsId: normalizeText(row && row.goodsId),
      budget,
      roas,
      fastStart: draft.fastStartEnabled === true ? 1 : 0,
      roasType: CREATE_ADS_ROAS_TYPE
    };

    submitRows.push(submitRow);

    if (invalidReasons.length > 0) {
      invalidRows.push({
        rowKey,
        shopName: submitRow.shopName,
        regionLabel: submitRow.regionLabel,
        goodsId: submitRow.goodsId,
        message: invalidReasons.join('\uff1b')
      });
    }
  });

  return {
    rows: submitRows,
    invalidRows
  };
}

export function hasValidCreateAdsRows(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => (
    normalizeText(row && row.shopId)
    && normalizeText(row && row.regionId)
    && normalizeText(row && row.goodsId)
    && row.budget !== null
    && row.budget !== undefined
    && row.roas !== null
    && row.roas !== undefined
  ));
}
