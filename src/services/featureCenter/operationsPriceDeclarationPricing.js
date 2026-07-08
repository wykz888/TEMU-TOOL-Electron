const { normalizeText } = require('../shopManagement/common');
const {
  computeProfitRateByPrice,
  computeProfitValue
} = require('../../utils/operationsProfitMetrics');

function computePriceDeclProfitMetrics(suggestPriceCent, costPriceYuan) {
  const normalizedSuggestPriceCent = Number(suggestPriceCent) || 0;
  const normalizedCostPriceYuan = Number(costPriceYuan) || 0;
  const suggestPriceYuan = normalizedSuggestPriceCent / 100;
  const profitValue = computeProfitValue(suggestPriceYuan, normalizedCostPriceYuan);
  const profitRate = computeProfitRateByPrice(suggestPriceYuan, normalizedCostPriceYuan);

  return {
    suggestPriceYuan,
    profitValue,
    profitRate
  };
}

function createPriceDeclFallbackApproveRuleId() {
  return `npl_price_decl_fallback_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePriceDeclFallbackApproveRuleLogicMode(value) {
  return normalizeText(value) === 'or' ? 'or' : 'and';
}

function createDefaultPriceDeclFallbackApproveRule(overrides = {}) {
  return {
    id: normalizeText(overrides && overrides.id) || createPriceDeclFallbackApproveRuleId(),
    reviewTimesMin: normalizeText(overrides && overrides.reviewTimesMin),
    profitRateValue: normalizeText(overrides && overrides.profitRateValue),
    profitLogicMode: normalizePriceDeclFallbackApproveRuleLogicMode(
      overrides && overrides.profitLogicMode
    ),
    profitValueValue: normalizeText(overrides && overrides.profitValueValue)
  };
}

function normalizePriceDeclFallbackApproveRule(rule = {}) {
  return createDefaultPriceDeclFallbackApproveRule(rule);
}

function normalizePriceDeclFallbackApproveRuleList(rules) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => normalizePriceDeclFallbackApproveRule(rule))
    .filter((rule, index, list) => {
      return list.findIndex((item) => {
        return normalizeText(item && item.id) === normalizeText(rule && rule.id);
      }) === index;
    });
}

function hasConfiguredPriceDeclFallbackApproveRule(rule) {
  const normalizedRule = normalizePriceDeclFallbackApproveRule(rule);

  return Boolean(
    normalizeText(normalizedRule.reviewTimesMin)
    && normalizeText(normalizedRule.profitRateValue)
    && normalizeText(normalizedRule.profitValueValue)
  );
}

function resolvePriceDeclFallbackApproveRuleMatch(rule, reviewTimes, profitValue, profitRate) {
  const normalizedRule = normalizePriceDeclFallbackApproveRule(rule);

  if (!hasConfiguredPriceDeclFallbackApproveRule(normalizedRule)) {
    return {
      matched: false,
      rule: normalizedRule
    };
  }

  const reviewTimesMin = Number(normalizedRule.reviewTimesMin);
  const profitRateValue = Number(normalizedRule.profitRateValue);
  const profitValueValue = Number(normalizedRule.profitValueValue);

  if (
    !Number.isFinite(reviewTimesMin)
    || !Number.isFinite(profitRateValue)
    || !Number.isFinite(profitValueValue)
  ) {
    return {
      matched: false,
      rule: normalizedRule
    };
  }

  const reviewMatched = (Number(reviewTimes) || 0) > reviewTimesMin;
  const profitRateMatched = Number(profitRate) >= profitRateValue;
  const profitValueMatched = Number(profitValue) >= profitValueValue;
  const logicMode = normalizePriceDeclFallbackApproveRuleLogicMode(
    normalizedRule.profitLogicMode
  );
  const matched = reviewMatched && (
    logicMode === 'or'
      ? (profitRateMatched || profitValueMatched)
      : (profitRateMatched && profitValueMatched)
  );

  return {
    matched,
    rule: normalizedRule,
    logicMode,
    reviewMatched,
    profitRateMatched,
    profitValueMatched
  };
}

function resolvePriceDeclFallbackApproveDecision(rules, reviewTimes, profitValue, profitRate) {
  const normalizedRules = normalizePriceDeclFallbackApproveRuleList(rules)
    .filter((rule) => hasConfiguredPriceDeclFallbackApproveRule(rule));

  for (const rule of normalizedRules) {
    const matchResult = resolvePriceDeclFallbackApproveRuleMatch(
      rule,
      reviewTimes,
      profitValue,
      profitRate
    );

    if (matchResult.matched) {
      return matchResult;
    }
  }

  return {
    matched: false,
    rule: null
  };
}

function formatPriceDeclPreviewMetricNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '0.00';
  }

  return numericValue.toFixed(2);
}

function buildPriceDeclPrimaryApproveDetail(approveCondition, approveValue) {
  if (normalizeText(approveCondition) === 'profitValue') {
    return `\u547d\u4e2d\u901a\u8fc7\u6761\u4ef6\uff1a\u5229\u6da6\u503c\u2265${formatPriceDeclPreviewMetricNumber(approveValue)}\u5143`;
  }

  return `\u547d\u4e2d\u901a\u8fc7\u6761\u4ef6\uff1a\u5229\u6da6\u7387\u2265${formatPriceDeclPreviewMetricNumber(approveValue)}%`;
}

function buildPriceDeclFallbackApproveDetail(matchResult) {
  if (!matchResult || matchResult.matched !== true || !matchResult.rule) {
    return '';
  }

  const normalizedRule = normalizePriceDeclFallbackApproveRule(matchResult.rule);
  const logicText = normalizePriceDeclFallbackApproveRuleLogicMode(
    normalizedRule.profitLogicMode
  ) === 'or'
    ? '\u6216'
    : '\u4e14';

  return `\u547d\u4e2d\u4fdd\u5e95\u901a\u8fc7\uff1a\u6838\u4ef7\u6b21\u6570>${normalizeText(normalizedRule.reviewTimesMin) || '0'}\u6b21\uff0c\u5229\u6da6\u7387\u2265${formatPriceDeclPreviewMetricNumber(normalizedRule.profitRateValue)}%${logicText}\u5229\u6da6\u503c\u2265${formatPriceDeclPreviewMetricNumber(normalizedRule.profitValueValue)}\u5143`;
}

function resolvePriceDeclDeclaredPriceCentFromRow(row) {
  const declaredPriceYuan = Number(row && row.declaredPrice);

  if (!Number.isFinite(declaredPriceYuan) || declaredPriceYuan <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(declaredPriceYuan * 100));
}

function resolvePriceDeclDeclaredPriceCentFromReviewData(skuInfo, reviewItem, fallbackValue = 0) {
  const skuPriceBeforeExchange = Number(skuInfo && skuInfo.priceBeforeExchange);
  if (Number.isFinite(skuPriceBeforeExchange) && skuPriceBeforeExchange > 0) {
    return Math.max(0, Math.round(skuPriceBeforeExchange));
  }

  const itemPriceBeforeExchange = Number(reviewItem && reviewItem.priceBeforeExchange);
  if (Number.isFinite(itemPriceBeforeExchange) && itemPriceBeforeExchange > 0) {
    return Math.max(0, Math.round(itemPriceBeforeExchange));
  }

  const numericFallbackValue = Number(fallbackValue);
  if (Number.isFinite(numericFallbackValue) && numericFallbackValue > 0) {
    return Math.max(0, Math.round(numericFallbackValue));
  }

  return 0;
}

function computePriceDeclRedeclareSubmitPrice(baseDeclaredPriceCent, reduceType, reduceValue) {
  const normalizedBaseDeclaredPriceCent = Number(baseDeclaredPriceCent) || 0;

  if (normalizedBaseDeclaredPriceCent <= 0) {
    return 0;
  }

  if (reduceType === 'discount') {
    return Math.round(normalizedBaseDeclaredPriceCent * (1 - reduceValue / 100));
  }

  if (reduceType === 'flatReduce') {
    return Math.round(normalizedBaseDeclaredPriceCent - reduceValue * 100);
  }

  return 0;
}

module.exports = {
  buildPriceDeclFallbackApproveDetail,
  buildPriceDeclPrimaryApproveDetail,
  computePriceDeclProfitMetrics,
  computePriceDeclRedeclareSubmitPrice,
  createDefaultPriceDeclFallbackApproveRule,
  formatPriceDeclPreviewMetricNumber,
  hasConfiguredPriceDeclFallbackApproveRule,
  normalizePriceDeclFallbackApproveRule,
  normalizePriceDeclFallbackApproveRuleList,
  normalizePriceDeclFallbackApproveRuleLogicMode,
  resolvePriceDeclDeclaredPriceCentFromReviewData,
  resolvePriceDeclDeclaredPriceCentFromRow,
  resolvePriceDeclFallbackApproveDecision,
  resolvePriceDeclFallbackApproveRuleMatch
};
