const {
  extractSummaryCellValue
} = require('./promotionAdsDetailUtils');

const REPORTS_QUERY_COLUMNS_TYPE = 18;

const REPORT_SUMMARY_FIELD_MAP = Object.freeze({
  ad_spend_label: ['ad_spend_all', 'total_ad_spend', 'total_spend'],
  net_ad_spend_label: ['net_ad_spend'],
  order_pay_amt_all: ['total_order_pay_amt', 'order_pay_amt_all'],
  order_pay_amt_label: ['total_order_pay_amt', 'order_pay_amt_all'],
  net_pay_amt_label: ['net_order_pay_amt'],
  roas_all: ['total_roas', 'roas_all'],
  roas_label: ['total_roas', 'roas_all'],
  net_roas_label: ['net_roas'],
  acos_all_label: ['total_acos', 'acos_all'],
  acos_label: ['total_acos', 'acos_all'],
  net_acos_ad_label: ['net_acos'],
  transaction_cost_all: ['total_transaction_cost', 'transaction_cost'],
  transaction_cost_label: ['total_transaction_cost', 'transaction_cost'],
  net_trans_cost_ad_label: ['net_transaction_cost'],
  order_pay_count_all_label: ['total_order_pay_cnt', 'order_pay_cnt_all'],
  order_pay_count_label: ['total_order_pay_cnt', 'order_pay_cnt_all'],
  net_pay_cnt_label: ['net_order_pay_cnt'],
  goods_num_all: ['total_goods_num', 'goods_num'],
  goods_num_label: ['total_goods_num', 'goods_num'],
  net_goods_num_label: ['net_goods_num'],
  impr_count_all: ['total_impr_cnt', 'impr_cnt_all'],
  impr_count_label: ['total_impr_cnt', 'impr_cnt_all'],
  click_count_all: ['total_clk_cnt', 'clk_cnt_all'],
  click_count_label: ['total_clk_cnt', 'clk_cnt_all'],
  ctr_all: ['total_ctr', 'ctr_all'],
  ctr_label: ['total_ctr', 'ctr_all'],
  cvr_all: ['total_cvr', 'cvr'],
  cvr_label: ['total_cvr', 'cvr'],
  add_cart_count_label: ['total_cart_cnt', 'cart_cnt_all']
});

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function buildReportsQueryPayload(now = new Date()) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const startOfDay = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate());

  return {
    start_ts: startOfDay.getTime(),
    end_ts: safeNow.getTime(),
    source: 0,
    sort_type: 0,
    query_type: 0,
    need_query_last_cycle: false,
    asc_order: true,
    columns_type: REPORTS_QUERY_COLUMNS_TYPE
  };
}

function findReportSummaryValue(reportsSummary, sourceKeys) {
  if (!isPlainObject(reportsSummary)) {
    return '';
  }

  for (const sourceKey of Array.isArray(sourceKeys) ? sourceKeys : []) {
    if (!Object.prototype.hasOwnProperty.call(reportsSummary, sourceKey)) {
      continue;
    }

    const value = extractSummaryCellValue(reportsSummary[sourceKey]);

    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeReportsSummaryMetrics(reportsSummary) {
  if (!isPlainObject(reportsSummary)) {
    return {};
  }

  return Object.entries(REPORT_SUMMARY_FIELD_MAP).reduce((result, [columnId, sourceKeys]) => {
    const value = findReportSummaryValue(reportsSummary, sourceKeys);

    if (value) {
      result[columnId] = value;
    }

    return result;
  }, {});
}

function buildReportsQuerySummaryContainer(resultData = {}, responseData = {}) {
  const resultReportsSummary = isPlainObject(resultData.reports_summary)
    ? resultData.reports_summary
    : {};
  const responseReportsSummary = isPlainObject(responseData.reports_summary)
    ? responseData.reports_summary
    : {};

  return {
    resultSummary: isPlainObject(resultData.summary) ? resultData.summary : {},
    resultReportsSummary,
    responseSummary: isPlainObject(responseData.summary) ? responseData.summary : {},
    responseReportsSummary,
    normalizedReportsSummary: {
      ...normalizeReportsSummaryMetrics(responseReportsSummary),
      ...normalizeReportsSummaryMetrics(resultReportsSummary)
    }
  };
}

module.exports = {
  REPORTS_QUERY_COLUMNS_TYPE,
  buildReportsQueryPayload,
  buildReportsQuerySummaryContainer,
  normalizeReportsSummaryMetrics
};
