const crypto = require('node:crypto');

const ADS_DETAIL_PAGE_SIZE = 50;
const ADS_DETAIL_PAUSED_PAGE_SIZE = 50;
const ADS_DETAIL_SORT_BY_PAUSED_STATUS = 0;
const ADS_DETAIL_SORT_BY_TOTAL_SPEND = 1002;
const ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT = 1202;
const ADS_DETAIL_COLUMNS_TYPE = 22;
const ADS_DETAIL_SELECTED_ROAS_TYPE = 1;

const ADS_DETAIL_ALLOWED_SORT_BY_VALUES = new Set([
  ADS_DETAIL_SORT_BY_PAUSED_STATUS,
  ADS_DETAIL_SORT_BY_TOTAL_SPEND,
  ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT
]);

const SUMMARY_METRIC_PATHS = Object.freeze({
  ad_spend_label: { metricKey: 'spend', bucketKey: 'total' },
  net_ad_spend_label: { metricKey: 'spend', bucketKey: 'net_total' },
  order_pay_amt_all: { metricKey: 'order_pay_amt', bucketKey: 'total' },
  order_pay_amt_label: { metricKey: 'order_pay_amt', bucketKey: 'total' },
  net_pay_amt_label: { metricKey: 'order_pay_amt', bucketKey: 'net_total' },
  roas_all: { metricKey: 'roas', bucketKey: 'total' },
  roas_label: { metricKey: 'roas', bucketKey: 'total' },
  net_roas_label: { metricKey: 'roas', bucketKey: 'net_total' },
  acos_all_label: { metricKey: 'acos', bucketKey: 'total' },
  acos_label: { metricKey: 'acos', bucketKey: 'total' },
  net_acos_ad_label: { metricKey: 'acos', bucketKey: 'net_total' },
  transaction_cost_all: { metricKey: 'transaction_cost', bucketKey: 'total' },
  transaction_cost_label: { metricKey: 'transaction_cost', bucketKey: 'total' },
  net_trans_cost_ad_label: { metricKey: 'transaction_cost', bucketKey: 'net_total' },
  order_pay_count_all_label: { metricKey: 'order_pay_cnt', bucketKey: 'total' },
  order_pay_count_label: { metricKey: 'order_pay_cnt', bucketKey: 'total' },
  net_pay_cnt_label: { metricKey: 'order_pay_cnt', bucketKey: 'net_total' },
  goods_num_all: { metricKey: 'goods_num', bucketKey: 'total' },
  goods_num_label: { metricKey: 'goods_num', bucketKey: 'total' },
  net_goods_num_label: { metricKey: 'goods_num', bucketKey: 'net_total' },
  impr_count_all: { metricKey: 'impr_cnt', bucketKey: 'total' },
  impr_count_label: { metricKey: 'impr_cnt', bucketKey: 'total' },
  click_count_all: { metricKey: 'clk_cnt', bucketKey: 'total' },
  click_count_label: { metricKey: 'clk_cnt', bucketKey: 'total' },
  ctr_all: { metricKey: 'ctr', bucketKey: 'total' },
  ctr_label: { metricKey: 'ctr', bucketKey: 'total' },
  cvr_all: { metricKey: 'cvr', bucketKey: 'total' },
  cvr_label: { metricKey: 'cvr', bucketKey: 'total' },
  add_cart_count_label: { metricKey: 'cart_cnt', bucketKey: 'total' }
});

const SUMMARY_CELL_VALUE_KEYS = Object.freeze([
  'trans_val',
  'transVal',
  'displayValue',
  'display_value',
  'displayText',
  'display_text',
  'formattedValue',
  'formatted_value',
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
]);

const SUMMARY_ROOT_KEYS = Object.freeze([
  'resultSummary',
  'responseSummary',
  'summary',
  'reports_summary',
  'resultReportsSummary',
  'responseReportsSummary',
  'result',
  'data'
]);

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizePositiveInteger(value, fallback, options = {}) {
  const parsedValue = Number.parseInt(value, 10);
  const minimum = Number.isFinite(Number(options.minimum)) ? Number(options.minimum) : 1;
  const maximum = Number.isFinite(Number(options.maximum)) ? Number(options.maximum) : Number.MAX_SAFE_INTEGER;

  if (!Number.isFinite(parsedValue) || parsedValue < minimum) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function normalizeAdsDetailSortBy(value, fallback = ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT) {
  const parsedValue = Number(value);

  return ADS_DETAIL_ALLOWED_SORT_BY_VALUES.has(parsedValue) ? parsedValue : fallback;
}

function normalizeIntegerList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function createListId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildAdsDetailPayload(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pageNumber = Math.max(1, Number(options.pageNumber || options.page_number) || 1);
  const pageSize = normalizePositiveInteger(options.pageSize || options.page_size, ADS_DETAIL_PAGE_SIZE);

  return {
    ad_status: normalizeIntegerList(options.adStatus),
    ad_advice_types: [],
    page_size: pageSize,
    page_number: pageNumber,
    specific_query_info: '',
    sort_by: normalizeAdsDetailSortBy(options.sortBy),
    sort_type: 'desc',
    start_time: startOfDay.getTime(),
    end_time: now.getTime(),
    need_calculate_goods_summary: true,
    list_id: normalizeText(options.listId || options.list_id) || createListId(),
    columns_type: normalizePositiveInteger(options.columnsType || options.columns_type, ADS_DETAIL_COLUMNS_TYPE),
    selected_roas_type: normalizePositiveInteger(
      options.selectedRoasType || options.selected_roas_type,
      ADS_DETAIL_SELECTED_ROAS_TYPE
    ),
    filter_cooperative_ad_type: 0,
    ad_phase: -1
  };
}

function hasSummaryMetricRoot(container) {
  return isPlainObject(container) && Object.values(SUMMARY_METRIC_PATHS).some((path) => (
    isPlainObject(container[path.metricKey])
  ));
}

function collectSummaryRoots(container, roots, seenRoots, depth = 0) {
  if (depth > 4 || !isPlainObject(container) || seenRoots.has(container)) {
    return;
  }

  seenRoots.add(container);

  if (hasSummaryMetricRoot(container)) {
    roots.push(container);
  }

  SUMMARY_ROOT_KEYS.forEach((key) => {
    if (isPlainObject(container[key])) {
      collectSummaryRoots(container[key], roots, seenRoots, depth + 1);
    }
  });

  Object.values(container).forEach((value) => {
    if (isPlainObject(value)) {
      collectSummaryRoots(value, roots, seenRoots, depth + 1);
    }
  });
}

function resolveSummaryMetricCell(summaryContainer, columnId) {
  const path = SUMMARY_METRIC_PATHS[normalizeText(columnId)];

  if (!path) {
    return null;
  }

  const roots = [];
  collectSummaryRoots(summaryContainer, roots, new Set());

  for (const root of roots) {
    const metricBucket = root[path.metricKey];

    if (!isPlainObject(metricBucket)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(metricBucket, path.bucketKey)) {
      return metricBucket[path.bucketKey];
    }
  }

  return null;
}

function extractSummaryCellValue(cell) {
  if (cell === null || cell === undefined || cell === '') {
    return '';
  }

  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? String(cell) : '';
  }

  if (typeof cell === 'string') {
    return normalizeText(cell);
  }

  if (!isPlainObject(cell)) {
    return '';
  }

  for (const key of SUMMARY_CELL_VALUE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(cell, key)) {
      continue;
    }

    const value = extractSummaryCellValue(cell[key]);

    if (value) {
      return value;
    }
  }

  return '';
}

function resolveAdsDetailSummaryValue(summaryContainer, columnId) {
  return extractSummaryCellValue(resolveSummaryMetricCell(summaryContainer, columnId));
}

module.exports = {
  ADS_DETAIL_PAGE_SIZE,
  ADS_DETAIL_PAUSED_PAGE_SIZE,
  ADS_DETAIL_SORT_BY_PAUSED_STATUS,
  ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT,
  ADS_DETAIL_SORT_BY_TOTAL_SPEND,
  ADS_DETAIL_COLUMNS_TYPE,
  ADS_DETAIL_SELECTED_ROAS_TYPE,
  buildAdsDetailPayload,
  extractSummaryCellValue,
  normalizeAdsDetailSortBy,
  resolveAdsDetailSummaryValue
};
