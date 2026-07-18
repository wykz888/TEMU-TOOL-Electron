export const GOODS_QUERY_PAGE_SIZE = 20;

export const BUDGET_MODE_UNLIMITED = 'unlimited';
export const BUDGET_MODE_CUSTOM = 'custom';

export const ROAS_MODE_STRONG = 'strong';
export const ROAS_MODE_MEDIUM = 'medium';
export const ROAS_MODE_WEAK = 'weak';
export const ROAS_MODE_CUSTOM = 'custom';

export const BUDGET_MODE_OPTIONS = Object.freeze([
  { value: BUDGET_MODE_UNLIMITED, label: '\u4e0d\u9650' },
  { value: BUDGET_MODE_CUSTOM, label: '\u81ea\u5b9a\u4e49' }
]);

const ROAS_MODE_ORDER = Object.freeze([
  ROAS_MODE_STRONG,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_WEAK
]);

const ROAS_LABELS = Object.freeze({
  [ROAS_MODE_STRONG]: '\u7ade\u4e89\u529b\u5f3a',
  [ROAS_MODE_MEDIUM]: '\u7ade\u4e89\u529b\u4e2d',
  [ROAS_MODE_WEAK]: '\u7ade\u4e89\u529b\u5f31',
  [ROAS_MODE_CUSTOM]: '\u81ea\u5b9a\u4e49'
});

function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function pickNumber(...values) {
  for (const value of values) {
    const numberValue = normalizeFiniteNumber(value);

    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
}

function firstPresentText(...values) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) {
      return text;
    }
  }

  return '';
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

  if (desc.includes(ROAS_LABELS[ROAS_MODE_STRONG])) {
    return ROAS_MODE_STRONG;
  }

  if (desc.includes(ROAS_LABELS[ROAS_MODE_MEDIUM])) {
    return ROAS_MODE_MEDIUM;
  }

  if (desc.includes(ROAS_LABELS[ROAS_MODE_WEAK])) {
    return ROAS_MODE_WEAK;
  }

  return ROAS_MODE_ORDER[index] || '';
}

function findBestRoasMode(row) {
  const predictions = getPredictions(row);
  const bestPrediction = predictions.find((entry) => entry && entry.bestSelect === true)
    || getBidInfo(row).bestPrediction
    || predictions[0]
    || null;

  if (!bestPrediction) {
    return ROAS_MODE_CUSTOM;
  }

  const bestIndex = predictions.indexOf(bestPrediction);
  const resolvedMode = resolvePredictionMode(bestPrediction, bestIndex >= 0 ? bestIndex : 0);

  return resolvedMode || ROAS_MODE_CUSTOM;
}

export function getGoodsRowKey(row) {
  return firstPresentText(
    row && row.id,
    [
      row && row.shopId,
      row && row.regionId,
      row && row.goodsId,
      row && row.spuId,
      row && row.skuEncode,
      row && row.rowIndex
    ].map(normalizeText).filter(Boolean).join(':')
  );
}

export function getDailyBudgetBounds(row) {
  const bidInfo = getBidInfo(row);

  return {
    min: pickNumber(bidInfo.minDailyBudget, row && row.bidMinDailyBudget),
    max: pickNumber(bidInfo.maxDailyBudget, row && row.bidMaxDailyBudget)
  };
}

export function getCustomRoasBounds(row) {
  const bidInfo = getBidInfo(row);

  return {
    min: pickNumber(bidInfo.minCustomRoas, row && row.bidMinCustomRoas),
    max: pickNumber(bidInfo.maxCustomRoas, row && row.bidMaxCustomRoas)
  };
}

export function buildDailyBudgetHint(row) {
  return firstPresentText(row && row.bidDailyBudgetText, getBidInfo(row).dailyBudgetText);
}

export function buildCustomRoasHint(row) {
  return firstPresentText(
    row && row.bidCustomRoasRangeText,
    getBidInfo(row).customRoasRangeText,
    row && row.bidRecommendRoasRangeText,
    getBidInfo(row).recommendRoasRangeText
  );
}

export function buildRoasPredictionOptions(row) {
  const predictionByMode = new Map();

  getPredictions(row).forEach((prediction, index) => {
    const mode = resolvePredictionMode(prediction, index);

    if (mode && !predictionByMode.has(mode)) {
      predictionByMode.set(mode, prediction);
    }
  });

  return ROAS_MODE_ORDER.map((mode) => {
    const prediction = predictionByMode.get(mode) || null;
    const roasText = normalizeText(prediction && prediction.roasText);
    const budgetText = normalizeText(prediction && prediction.roasBudgetText);
    const impressionText = normalizeText(prediction && prediction.impressionDeltaText);
    const orderText = normalizeText(prediction && prediction.orderDeltaText);

    return {
      value: mode,
      label: ROAS_LABELS[mode],
      roasText,
      budgetText,
      disabled: !prediction,
      title: [
        roasText ? `ROAS ${roasText}` : '',
        budgetText ? `\u9884\u7b97 ${budgetText}` : '',
        impressionText ? `\u66dd\u5149 ${impressionText}` : '',
        orderText ? `\u8ba2\u5355 ${orderText}` : ''
      ].filter(Boolean).join(' / ')
    };
  });
}

export function buildGoodsSearchText(row) {
  const bidInfo = getBidInfo(row);
  const predictionText = getPredictions(row)
    .map((entry) => [
      entry && entry.desc,
      entry && entry.roasText,
      entry && entry.summaryText
    ].map(normalizeText).filter(Boolean).join(' '))
    .join(' ');

  return [
    row && row.goodsName,
    row && row.goodsId,
    row && row.spuId,
    row && row.skuEncode,
    row && row.shopName,
    row && row.regionLabel,
    row && row.categoryText,
    row && row.siteText,
    row && row.priceText,
    row && row.sitePriceText,
    row && row.promotionText,
    row && row.bidBestText,
    row && row.bidBestRoasText,
    row && row.bidBestDesc,
    row && row.bidOptionsText,
    bidInfo.bestText,
    predictionText
  ].map(normalizeText).filter(Boolean).join(' ').toLowerCase();
}

export function buildGoodsRowDraft(row) {
  const dailyBudgetBounds = getDailyBudgetBounds(row);
  const roasBounds = getCustomRoasBounds(row);
  const bestPrediction = getBidInfo(row).bestPrediction || null;
  const defaultCustomRoas = pickNumber(
    bestPrediction && bestPrediction.roasNumber,
    getBidInfo(row).adviceRoas,
    roasBounds.min
  );

  return {
    budgetMode: BUDGET_MODE_UNLIMITED,
    customBudget: dailyBudgetBounds.min,
    fastStartEnabled: row && row.fastStartEnabled === true,
    roasMode: findBestRoasMode(row),
    customRoas: defaultCustomRoas
  };
}

export function buildGoodsRowDraftMap(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((draftMap, row) => {
    const rowKey = getGoodsRowKey(row);

    if (rowKey) {
      draftMap[rowKey] = buildGoodsRowDraft(row);
    }

    return draftMap;
  }, {});
}
