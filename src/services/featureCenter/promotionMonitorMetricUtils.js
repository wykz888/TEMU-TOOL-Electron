const { normalizeText } = require('../shopManagement/common');
const {
  resolveAdsDetailSummaryValue
} = require('./promotionAdsDetailUtils');

const MONITOR_COLUMN_IDS = Object.freeze([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_all',
  'order_pay_amt_label',
  'net_pay_amt_label',
  'roas_all',
  'roas_label',
  'net_roas_label',
  'acos_all_label',
  'acos_label',
  'net_acos_ad_label',
  'transaction_cost_all',
  'transaction_cost_label',
  'net_trans_cost_ad_label',
  'order_pay_count_all_label',
  'order_pay_count_label',
  'net_pay_cnt_label',
  'goods_num_all',
  'goods_num_label',
  'net_goods_num_label',
  'impr_count_all',
  'impr_count_label',
  'click_count_all',
  'click_count_label',
  'ctr_all',
  'ctr_label',
  'cvr_all',
  'cvr_label',
  'add_cart_count_label'
]);

const COLUMN_VALUE_ALIASES = Object.freeze({
  ad_spend_label: [
    'ad_spend_label',
    'ad_spend',
    'spend',
    'spend_amt',
    'total_spend',
    'adSpend',
    'AD_SPEND',
    'SPEND_AD'
  ],
  net_ad_spend_label: [
    'net_ad_spend_label',
    'net_ad_spend',
    'net_spend',
    'netAdSpend',
    'NET_AD_SPEND',
    'SPEND_NET_AD'
  ],
  order_pay_amt_all: [
    'order_pay_amt_all',
    'order_pay_amt_all_label',
    'all_order_pay_amt',
    'totalOrderPayAmt',
    'totalPayAmt',
    'TOTAL_PAY_AMT',
    'ORDER_PAY_AMT_TOTAL'
  ],
  order_pay_amt_label: [
    'order_pay_amt_label',
    'order_pay_amt',
    'ad_order_pay_amt',
    'orderPayAmt',
    'ORDER_PAY_AMT',
    'ORDER_PAY_AMT_AD'
  ],
  net_pay_amt_label: [
    'net_pay_amt_label',
    'net_pay_amt',
    'netOrderPayAmt',
    'NET_PAY_AMT',
    'ORDER_PAY_AMT_NET_AD'
  ],
  roas_all: [
    'roas_all',
    'all_roas',
    'totalRoas',
    'TOTAL_ROAS',
    'ROAS_TOTAL',
    'OVERALL_ROAS'
  ],
  roas_label: ['roas_label', 'roas', 'ad_roas', 'ROAS', 'ROAS_AD'],
  net_roas_label: ['net_roas_label', 'net_roas', 'netRoas', 'NET_ROAS', 'ROAS_NET_AD'],
  acos_all_label: ['acos_all_label', 'acos_all', 'all_acos', 'totalAcos', 'TOTAL_ACOS', 'ACOS_TOTAL'],
  acos_label: ['acos_label', 'acos', 'ad_acos', 'ACOS', 'ACOS_AD'],
  net_acos_ad_label: ['net_acos_ad_label', 'net_acos_ad', 'net_acos', 'netAcos', 'NET_ACOS', 'ACOS_NET_AD'],
  transaction_cost_all: [
    'transaction_cost_all',
    'all_transaction_cost',
    'totalTransactionCost',
    'TOTAL_TRANS_COST',
    'TRANSACTION_COST_TOTAL'
  ],
  transaction_cost_label: [
    'transaction_cost_label',
    'transaction_cost',
    'ad_transaction_cost',
    'transactionCost',
    'TRANSACTION_COST',
    'TRANSACTION_COST_AD'
  ],
  net_trans_cost_ad_label: [
    'net_trans_cost_ad_label',
    'net_trans_cost_ad',
    'net_transaction_cost',
    'netTransactionCost',
    'NET_TRANS_COST',
    'TRANSACTION_COST_NET_AD'
  ],
  order_pay_count_all_label: [
    'order_pay_count_all_label',
    'order_pay_count_all',
    'all_order_pay_count',
    'totalOrderPayCnt',
    'totalOrderPayCount',
    'TOTAL_PAY_CNT',
    'ORDER_PAY_CNT_TOTAL',
    'ORDER_PAY_COUNT_TOTAL'
  ],
  order_pay_count_label: [
    'order_pay_count_label',
    'order_pay_count',
    'ad_order_pay_count',
    'orderPayCnt',
    'orderPayCount',
    'ORDER_PAY_CNT',
    'ORDER_PAY_COUNT',
    'ORDER_PAY_CNT_AD',
    'ORDER_PAY_COUNT_AD'
  ],
  net_pay_cnt_label: [
    'net_pay_cnt_label',
    'net_pay_cnt',
    'net_order_pay_count',
    'netOrderPayCnt',
    'netPayCnt',
    'NET_PAY_CNT',
    'ORDER_PAY_CNT_NET_AD',
    'ORDER_PAY_COUNT_NET_AD'
  ],
  goods_num_all: ['goods_num_all', 'all_goods_num', 'totalGoodsNum', 'TOTAL_GOODS_NUM', 'GOODS_NUM_TOTAL'],
  goods_num_label: ['goods_num_label', 'goods_num', 'ad_goods_num', 'goodsNum', 'GOODS_NUM', 'GOODS_NUM_AD'],
  net_goods_num_label: ['net_goods_num_label', 'net_goods_num', 'netGoodsNum', 'NET_GOODS_NUM', 'GOODS_NUM_NET_AD'],
  impr_count_all: [
    'impr_count_all',
    'all_impr_count',
    'impression_all',
    'totalImprCnt',
    'totalImprCount',
    'TOTAL_IMPR_CNT',
    'IMPRT_CNT_TOTAL',
    'IMPR_COUNT_TOTAL'
  ],
  impr_count_label: [
    'impr_count_label',
    'impr_count',
    'impression',
    'ad_impression',
    'imprCnt',
    'imprCount',
    'IMPR_COUNT',
    'IMPRT_CNT',
    'IMPRT_CNT_AD'
  ],
  click_count_all: [
    'click_count_all',
    'all_click_count',
    'totalClkCnt',
    'totalClickCount',
    'TOTAL_CLK_CNT',
    'CLK_CNT_TOTAL',
    'CLICK_COUNT_TOTAL'
  ],
  click_count_label: [
    'click_count_label',
    'click_count',
    'click',
    'clkCnt',
    'clickCount',
    'CLICK_COUNT',
    'CLK_CNT',
    'CLK_CNT_AD'
  ],
  ctr_all: ['ctr_all', 'all_ctr', 'totalCtr', 'TOTAL_CTR', 'CTR_TOTAL'],
  ctr_label: ['ctr_label', 'ctr', 'CTR', 'CTR_AD'],
  cvr_all: ['cvr_all', 'all_cvr', 'totalCvr', 'TOTAL_CVR', 'CVR_TOTAL'],
  cvr_label: ['cvr_label', 'cvr', 'CVR', 'CVR_AD'],
  add_cart_count_label: [
    'add_cart_count_label',
    'add_cart_count',
    'cart_count',
    'addCartCount',
    'ADD_CART_COUNT',
    'cartCnt',
    'CART_CNT',
    'CART_CNT_AD'
  ]
});

const MONEY_COLUMN_ID_SET = new Set([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_all',
  'order_pay_amt_label',
  'net_pay_amt_label',
  'transaction_cost_all',
  'transaction_cost_label',
  'net_trans_cost_ad_label'
]);

const PERCENT_COLUMN_ID_SET = new Set([
  'acos_all_label',
  'acos_label',
  'net_acos_ad_label',
  'ctr_all',
  'ctr_label',
  'cvr_all',
  'cvr_label'
]);

const RATIO_COLUMN_ID_SET = new Set([
  'roas_all',
  'roas_label',
  'net_roas_label'
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeMetricAlias(value) {
  return normalizeText(value)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function buildAliasMatcher(aliases) {
  return new Set(
    (Array.isArray(aliases) ? aliases : [aliases])
      .map((alias) => normalizeMetricAlias(alias))
      .filter(Boolean)
  );
}

function extractValueCandidate(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    return normalizeText(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '';
    }

    return value.toLocaleString('zh-CN', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2
    });
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractValueCandidate(item);

      if (candidate) {
        return candidate;
      }
    }

    return '';
  }

  if (!isPlainObject(value)) {
    return '';
  }

  const keys = [
    'displayValue',
    'display_value',
    'displayText',
    'display_text',
    'display',
    'formattedValue',
    'formatted_value',
    'formatValue',
    'format_value',
    'formatted',
    'valueText',
    'value_text',
    'valueStr',
    'value_str',
    'showValue',
    'show_value',
    'text',
    'label',
    'value',
    'val',
    'amount',
    'ratio',
    'percent',
    'num',
    'count'
  ];

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const candidate = extractValueCandidate(value[key]);

      if (candidate) {
        return candidate;
      }
    }
  }

  const fallbackCandidate = Object.entries(value)
    .filter(([key]) => ![
      'id',
      'key',
      'code',
      'name',
      'metric',
      'field',
      'columnId',
      'column_id',
      'indicatorId',
      'indicator_id',
      'type',
      'dataType',
      'data_type'
    ].includes(key))
    .map(([, candidateValue]) => extractValueCandidate(candidateValue))
    .find(Boolean);

  if (fallbackCandidate) {
    return fallbackCandidate;
  }

  return '';
}

function extractRecordValueByAlias(record, aliasMatcher) {
  if (!isPlainObject(record) || !(aliasMatcher instanceof Set) || aliasMatcher.size === 0) {
    return '';
  }

  const identityKeys = [
    'id',
    'key',
    'code',
    'name',
    'metric',
    'field',
    'columnId',
    'column_id',
    'indicatorId',
    'indicator_id',
    'type',
    'dataType',
    'data_type',
    'title'
  ];

  const hasAliasIdentity = identityKeys.some((key) => (
    Object.prototype.hasOwnProperty.call(record, key)
    && aliasMatcher.has(normalizeMetricAlias(record[key]))
  ));

  if (!hasAliasIdentity) {
    return '';
  }

  const preferredValueKeys = [
    'displayValue',
    'display_value',
    'displayText',
    'display_text',
    'display',
    'formattedValue',
    'formatted_value',
    'formatValue',
    'format_value',
    'formatted',
    'valueText',
    'value_text',
    'valueStr',
    'value_str',
    'showValue',
    'show_value',
    'value',
    'val',
    'amount',
    'ratio',
    'percent',
    'num',
    'count',
    'text',
    'label'
  ];

  for (const key of preferredValueKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }

    const candidate = extractValueCandidate(record[key]);

    if (candidate) {
      return candidate;
    }
  }

  return Object.entries(record)
    .filter(([key]) => !identityKeys.includes(key))
    .map(([, value]) => extractValueCandidate(value))
    .find(Boolean) || '';
}

function findValueByAlias(container, aliases, depth = 0) {
  if (depth > 4 || container === null || container === undefined) {
    return '';
  }

  const aliasMatcher = buildAliasMatcher(aliases);

  if (aliasMatcher.size === 0) {
    return '';
  }

  if (Array.isArray(container)) {
    for (const item of container) {
      const directValue = extractRecordValueByAlias(item, aliasMatcher);

      if (directValue) {
        return directValue;
      }
    }

    for (const item of container) {
      const nestedValue = findValueByAlias(item, aliases, depth + 1);

      if (nestedValue) {
        return nestedValue;
      }
    }

    return '';
  }

  if (!isPlainObject(container)) {
    return '';
  }

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(container, alias)) {
      const directValue = extractValueCandidate(container[alias]);

      if (directValue) {
        return directValue;
      }
    }
  }

  for (const [key, value] of Object.entries(container)) {
    if (!aliasMatcher.has(normalizeMetricAlias(key))) {
      continue;
    }

    const directValue = extractValueCandidate(value);

    if (directValue) {
      return directValue;
    }
  }

  const recordValue = extractRecordValueByAlias(container, aliasMatcher);

  if (recordValue) {
    return recordValue;
  }

  const nestedKeys = [
    'data',
    'metrics',
    'values',
    'summary',
    'reports_summary',
    'result',
    'list',
    'items',
    'rows',
    'allData',
    'adData',
    'netData',
    'all_data',
    'ad_data',
    'net_data'
  ];

  for (const nestedKey of nestedKeys) {
    if (!Object.prototype.hasOwnProperty.call(container, nestedKey)) {
      continue;
    }

    const nestedValue = findValueByAlias(container[nestedKey], aliases, depth + 1);

    if (nestedValue) {
      return nestedValue;
    }
  }

  for (const [key, value] of Object.entries(container)) {
    if (nestedKeys.includes(key)) {
      continue;
    }

    const nestedValue = findValueByAlias(value, aliases, depth + 1);

    if (nestedValue) {
      return nestedValue;
    }
  }

  return '';
}

function parseMetricNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = normalizeText(value);

  if (!text || text === '--') {
    return null;
  }

  const normalized = text
    .replace(/[%％,\s]/g, '')
    .replace(/[^\d.-]/g, '');

  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRoasRawValue(rawValue) {
  const numericValue = parseMetricNumber(rawValue);

  if (numericValue === null || numericValue <= 0) {
    return null;
  }

  const text = normalizeText(rawValue);
  const scaleByTenThousand =
    numericValue < 1000
    || /[.]/.test(text);

  return Math.round(scaleByTenThousand ? numericValue * 10000 : numericValue);
}

function formatMetricNumber(value, options = {}) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: Math.max(0, Number(options.minimumFractionDigits) || 0),
    maximumFractionDigits: Math.max(
      Math.max(0, Number(options.minimumFractionDigits) || 0),
      Number(options.maximumFractionDigits) || 0
    )
  });
}

function shouldScaleIntegerMetricValue(rawValue) {
  const text = normalizeText(rawValue);

  if (!text || text === '--') {
    return false;
  }

  return !/[.%％]/.test(text);
}

function normalizeMoneyMetricValue(rawValue) {
  const numericValue = parseMetricNumber(rawValue);

  if (numericValue === null) {
    return null;
  }

  return shouldScaleIntegerMetricValue(rawValue)
    ? numericValue / 100
    : numericValue;
}

function normalizeMetricDisplayValue(columnId, rawValue) {
  const text = normalizeText(rawValue);

  if (!text) {
    return '--';
  }

  const numericValue = parseMetricNumber(rawValue);

  if (numericValue === null) {
    return text || '--';
  }

  if (MONEY_COLUMN_ID_SET.has(columnId)) {
    const normalizedValue = shouldScaleIntegerMetricValue(text)
      ? numericValue / 100
      : numericValue;

    return formatMetricNumber(normalizedValue, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (PERCENT_COLUMN_ID_SET.has(columnId)) {
    const normalizedValue = shouldScaleIntegerMetricValue(text)
      ? numericValue / 100
      : numericValue;

    return `${formatMetricNumber(normalizedValue, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}%`;
  }

  if (RATIO_COLUMN_ID_SET.has(columnId)) {
    const normalizedValue = shouldScaleIntegerMetricValue(text)
      ? numericValue / 100
      : numericValue;

    return formatMetricNumber(normalizedValue, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  return text;
}

function resolveMonitorSummaryValue(summaryContainer, columnId) {
  const explicitValue = resolveAdsDetailSummaryValue(summaryContainer, columnId);

  if (explicitValue) {
    return explicitValue;
  }

  if (
    summaryContainer
    && isPlainObject(summaryContainer.normalizedReportsSummary)
    && Object.prototype.hasOwnProperty.call(summaryContainer.normalizedReportsSummary, columnId)
  ) {
    const reportsValue = extractValueCandidate(summaryContainer.normalizedReportsSummary[columnId]);

    if (reportsValue) {
      return reportsValue;
    }
  }

  return findValueByAlias(summaryContainer, COLUMN_VALUE_ALIASES[columnId] || [columnId]);
}

function mapSummaryToMetrics(summaryContainer) {
  return MONITOR_COLUMN_IDS.reduce((result, columnId) => {
    result[columnId] = normalizeMetricDisplayValue(
      columnId,
      resolveMonitorSummaryValue(summaryContainer, columnId) || '--'
    );
    return result;
  }, {});
}

function resolvePromotionOrderCountFromSummary(summaryContainer) {
  return Math.max(
    0,
    Math.round(
      parseMetricNumber(resolveMonitorSummaryValue(summaryContainer, 'order_pay_count_label')) || 0
    )
  );
}

function resolveSummaryGoodsCount(summaryContainer) {
  const preferredCount =
    parseMetricNumber(resolveMonitorSummaryValue(summaryContainer, 'goods_num_label'));
  const fallbackCount =
    parseMetricNumber(resolveMonitorSummaryValue(summaryContainer, 'goods_num_all'));
  const resolvedCount = preferredCount !== null ? preferredCount : fallbackCount;

  return Math.max(0, Math.round(resolvedCount || 0));
}

module.exports = {
  MONITOR_COLUMN_IDS,
  COLUMN_VALUE_ALIASES,
  isPlainObject,
  normalizeMetricAlias,
  buildAliasMatcher,
  extractValueCandidate,
  findValueByAlias,
  parseMetricNumber,
  normalizeRoasRawValue,
  formatMetricNumber,
  normalizeMoneyMetricValue,
  normalizeMetricDisplayValue,
  resolveMonitorSummaryValue,
  mapSummaryToMetrics,
  resolvePromotionOrderCountFromSummary,
  resolveSummaryGoodsCount
};
