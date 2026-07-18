const { normalizeText } = require('../shopManagement/common');

const ADS_GET_BID_URL = 'https://ads.temu.com/api/v1/coconut/pred/getBid';
const MAX_BID_GOODS_PER_REQUEST = 50;
const ROAS_VALUE_SCALE = 10000;

function normalizePositiveInteger(value, fallback, options = {}) {
  const numberValue = Number.parseInt(value, 10);
  const minimum = Number.isFinite(Number(options.minimum)) ? Number(options.minimum) : 1;
  const maximum = Number.isFinite(Number(options.maximum)) ? Number(options.maximum) : Number.MAX_SAFE_INTEGER;

  if (!Number.isFinite(numberValue) || numberValue < minimum) {
    return fallback;
  }

  return Math.min(numberValue, maximum);
}

function normalizeFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeNumberText(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value).trim();
}

function pickFirstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '');
}

function formatDecimalNumber(value, fractionDigits = 2) {
  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null) {
    return '';
  }

  return numberValue
    .toFixed(Math.max(0, Number(fractionDigits) || 0))
    .replace(/\.?0+$/, '');
}

function formatRoasText(roas, roasValue) {
  const directRoas = normalizeFiniteNumber(roas);

  if (directRoas !== null) {
    return formatDecimalNumber(directRoas, 2);
  }

  const scaledRoasValue = normalizeFiniteNumber(roasValue);

  if (scaledRoasValue !== null) {
    return formatDecimalNumber(scaledRoasValue / ROAS_VALUE_SCALE, 2);
  }

  return normalizeNumberText(roas) || normalizeNumberText(roasValue);
}

function normalizeRoasValueNumber(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue === null ? null : numberValue / ROAS_VALUE_SCALE;
}

function formatMoneyText(value, currency) {
  const valueText = normalizeNumberText(value);

  if (!valueText) {
    return '';
  }

  const numberValue = normalizeFiniteNumber(value);
  const formattedValue = numberValue === null
    ? valueText
    : numberValue.toLocaleString('en-US', {
      maximumFractionDigits: 2
    });

  return `${normalizeText(currency)}${formattedValue}`;
}

function buildRangeText(minText, maxText) {
  const normalizedMinText = normalizeText(minText);
  const normalizedMaxText = normalizeText(maxText);

  if (normalizedMinText && normalizedMaxText && normalizedMinText !== normalizedMaxText) {
    return `${normalizedMinText} - ${normalizedMaxText}`;
  }

  return normalizedMinText || normalizedMaxText;
}

function normalizePredictionDelta(source) {
  const container = source && typeof source === 'object' ? source : {};
  const percentDelta = normalizeText(container.percent_delta || container.percentDelta);
  const absoluteDelta = normalizeNumberText(container.absolute_delta || container.absoluteDelta);

  return {
    percentDelta,
    absoluteDelta,
    text: percentDelta || absoluteDelta
  };
}

function buildPredictionSummaryText(prediction) {
  if (!prediction) {
    return '';
  }

  return [
    normalizeText(prediction.desc),
    prediction.roasText ? `ROAS ${prediction.roasText}` : '',
    normalizeText(prediction.roasBudgetText)
  ].filter(Boolean).join(' / ');
}

function normalizeBidPrediction(source, currency) {
  const record = source && typeof source === 'object' ? source : {};
  const impressionDelta = normalizePredictionDelta(record.impr_predict_info || record.imprPredictInfo);
  const orderDelta = normalizePredictionDelta(record.order_predict_info || record.orderPredictInfo);
  const roasText = formatRoasText(record.roas, pickFirstPresent(record.roas_value, record.roasValue));
  const roasBudgetText = formatMoneyText(pickFirstPresent(record.roas_budget, record.roasBudget), currency);
  const roasNumber = normalizeFiniteNumber(record.roas);
  const roasValueNumber = normalizeFiniteNumber(pickFirstPresent(record.roas_value, record.roasValue));
  const roasBudgetNumber = normalizeFiniteNumber(pickFirstPresent(record.roas_budget, record.roasBudget));
  const prediction = {
    desc: normalizeText(record.desc),
    roas: roasNumber,
    roasNumber: roasNumber !== null
      ? roasNumber
      : (roasValueNumber === null ? null : roasValueNumber / ROAS_VALUE_SCALE),
    roasValue: normalizeNumberText(pickFirstPresent(record.roas_value, record.roasValue)),
    roasValueNumber,
    roasText,
    roasBudget: normalizeNumberText(pickFirstPresent(record.roas_budget, record.roasBudget)),
    roasBudgetNumber,
    roasBudgetText,
    bestSelect: record.best_select === true || record.bestSelect === true,
    impressionDelta,
    orderDelta,
    impressionDeltaText: impressionDelta.text,
    orderDeltaText: orderDelta.text,
    acosText: normalizeText(record.acos_str || record.acosStr)
  };

  return {
    ...prediction,
    summaryText: buildPredictionSummaryText(prediction)
  };
}

function normalizeBidResult(source, currency) {
  const record = source && typeof source === 'object' ? source : {};
  const predictions = Array.isArray(record.pred_list)
    ? record.pred_list.map((entry) => normalizeBidPrediction(entry, currency))
    : [];
  const recPredictions = Array.isArray(record.rec_pred_list)
    ? record.rec_pred_list.map((entry) => normalizeBidPrediction(entry, currency))
    : [];
  const bestPrediction = predictions.find((entry) => entry.bestSelect) || predictions[0] || null;
  const minDailyBudgetText = formatMoneyText(record.min_daily_budget, currency);
  const maxDailyBudgetText = formatMoneyText(record.max_daily_budget, currency);
  const minCustomRoasValue = pickFirstPresent(record.min_custom_roas_value, record.minCustomRoasValue);
  const maxCustomRoasValue = pickFirstPresent(record.hard_base_roas_value, record.hardBaseRoasValue);
  const minRecommendRoasValue = pickFirstPresent(record.min_recommend_roas_value, record.minRecommendRoasValue);
  const maxRoasValue = pickFirstPresent(record.max_roas_value, record.maxRoasValue);
  const minCustomRoasText = formatRoasText(null, minCustomRoasValue);
  const maxCustomRoasText = formatRoasText(null, maxCustomRoasValue);
  const minRecommendRoasText = formatRoasText(null, minRecommendRoasValue);
  const maxRoasText = formatRoasText(null, maxRoasValue);
  const softBaseRoasText = formatRoasText(null, record.soft_base_roas_value);
  const hardBaseRoasText = formatRoasText(null, record.hard_base_roas_value);

  return {
    goodsId: normalizeText(pickFirstPresent(record.goods_id, record.goodsId)),
    siteId: normalizeNumberText(pickFirstPresent(record.site_id, record.siteId)),
    currency: normalizeText(currency),
    predictions,
    recPredictions,
    bestPrediction,
    bestDesc: normalizeText(bestPrediction && bestPrediction.desc),
    bestRoasText: normalizeText(bestPrediction && bestPrediction.roasText),
    bestBudgetText: normalizeText(bestPrediction && bestPrediction.roasBudgetText),
    bestText: buildPredictionSummaryText(bestPrediction),
    bestImpressionDeltaText: normalizeText(bestPrediction && bestPrediction.impressionDeltaText),
    bestOrderDeltaText: normalizeText(bestPrediction && bestPrediction.orderDeltaText),
    predictionOptionsText: predictions.map((entry) => entry.summaryText).filter(Boolean).join(' | '),
    minDailyBudget: normalizeFiniteNumber(record.min_daily_budget),
    maxDailyBudget: normalizeFiniteNumber(record.max_daily_budget),
    minDailyBudgetText,
    maxDailyBudgetText,
    dailyBudgetText: buildRangeText(minDailyBudgetText, maxDailyBudgetText),
    usedBudgetText: formatMoneyText(record.used_budget_value, currency),
    minCustomRoas: normalizeRoasValueNumber(minCustomRoasValue),
    maxCustomRoas: normalizeRoasValueNumber(maxCustomRoasValue),
    minCustomRoasText,
    maxCustomRoasText,
    customRoasRangeText: buildRangeText(minCustomRoasText, maxCustomRoasText),
    minRecommendRoas: normalizeRoasValueNumber(minRecommendRoasValue),
    maxRoas: normalizeRoasValueNumber(maxRoasValue),
    minRecommendRoasText,
    maxRoasText,
    recommendRoasRangeText: buildRangeText(minRecommendRoasText, maxRoasText),
    softBaseRoas: normalizeRoasValueNumber(record.soft_base_roas_value),
    hardBaseRoas: normalizeRoasValueNumber(record.hard_base_roas_value),
    softBaseRoasText,
    hardBaseRoasText,
    baseRoasText: buildRangeText(softBaseRoasText, hardBaseRoasText),
    adviceRoas: normalizeRoasValueNumber(record.advice_roas),
    adviceRoasText: formatRoasText(null, record.advice_roas),
    remainingChangesText: normalizeNumberText(record.remaining_changes),
    acosType: normalizeNumberText(record.acos_type),
    overallRoasText: normalizeText(record.overall_roas_str),
    acosText: normalizeText(record.acos_str)
  };
}

function getResponseData(response) {
  if (response && response.data && typeof response.data === 'object') {
    return response.data;
  }

  return response && typeof response === 'object' ? response : {};
}

function extractBidResults(response) {
  const responseData = getResponseData(response);
  const result = responseData.result && typeof responseData.result === 'object'
    ? responseData.result
    : {};
  const currency = normalizeText(result.currency);
  const sourceRows = Array.isArray(result.query_ad_bid_result)
    ? result.query_ad_bid_result
    : [];
  const rows = sourceRows
    .map((entry) => normalizeBidResult(entry, currency))
    .filter((entry) => normalizeText(entry.goodsId));

  return {
    currency,
    rows
  };
}

function buildBidLookup(bidRows) {
  const lookup = new Map();

  (Array.isArray(bidRows) ? bidRows : []).forEach((entry) => {
    const goodsId = normalizeText(entry && entry.goodsId);

    if (goodsId) {
      lookup.set(goodsId, entry);
    }
  });

  return lookup;
}

function getRowGoodsId(row) {
  return normalizeText(
    row && (row.goodsId || row.goods_id || row.goodsID)
  );
}

function normalizeUniqueBidRows(rows) {
  const seenGoodsIds = new Set();
  const normalizedRows = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const goodsId = getRowGoodsId(row);

    if (!goodsId || seenGoodsIds.has(goodsId)) {
      return;
    }

    seenGoodsIds.add(goodsId);
    normalizedRows.push(row);
  });

  return normalizedRows;
}

function buildBidRequestPayload(rows, roasType) {
  const normalizedRoasType = normalizePositiveInteger(roasType, 1);

  return {
    goods_info_list: normalizeUniqueBidRows(rows).map((row) => ({
      goods_id: getRowGoodsId(row),
      roas_type: normalizedRoasType
    }))
  };
}

function chunkRowsForBidRequests(rows, chunkSize = MAX_BID_GOODS_PER_REQUEST) {
  const normalizedRows = normalizeUniqueBidRows(rows);
  const safeChunkSize = normalizePositiveInteger(chunkSize, MAX_BID_GOODS_PER_REQUEST, {
    maximum: MAX_BID_GOODS_PER_REQUEST
  });
  const chunks = [];

  for (let index = 0; index < normalizedRows.length; index += safeChunkSize) {
    chunks.push(normalizedRows.slice(index, index + safeChunkSize));
  }

  return chunks;
}

function applyBidInfoToRows(rows, bidLookup) {
  const lookup = bidLookup instanceof Map ? bidLookup : buildBidLookup([]);

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const bidInfo = lookup.get(getRowGoodsId(row)) || null;

    if (!bidInfo) {
      return row;
    }

    return {
      ...row,
      bidInfo,
      bidCurrency: bidInfo.currency,
      bidSiteId: bidInfo.siteId,
      bidBestText: bidInfo.bestText,
      bidBestRoasText: bidInfo.bestRoasText,
      bidBestBudgetText: bidInfo.bestBudgetText,
      bidBestDesc: bidInfo.bestDesc,
      bidOptionsText: bidInfo.predictionOptionsText,
      bidImpressionDeltaText: bidInfo.bestImpressionDeltaText,
      bidOrderDeltaText: bidInfo.bestOrderDeltaText,
      bidDailyBudgetText: bidInfo.dailyBudgetText,
      bidUsedBudgetText: bidInfo.usedBudgetText,
      bidCustomRoasRangeText: bidInfo.customRoasRangeText,
      bidRecommendRoasRangeText: bidInfo.recommendRoasRangeText,
      bidBaseRoasText: bidInfo.baseRoasText
    };
  });
}

module.exports = {
  ADS_GET_BID_URL,
  MAX_BID_GOODS_PER_REQUEST,
  ROAS_VALUE_SCALE,
  applyBidInfoToRows,
  buildBidLookup,
  buildBidRequestPayload,
  chunkRowsForBidRequests,
  extractBidResults,
  formatMoneyText,
  formatRoasText,
  normalizeBidPrediction,
  normalizeBidResult
};
