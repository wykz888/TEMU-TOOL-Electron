const { normalizeText } = require('../shopManagement/common');
const {
  detectAdsDetailHasMore,
  extractAdsDetailItems,
  resolveAdsDetailProductCount,
  buildAdsDetailRequestFailureMessage
} = require('./promotionMonitorAdsDetailItems');
const {
  ADS_DETAIL_PAGE_SIZE,
  ADS_DETAIL_SORT_BY_PAUSED_STATUS,
  buildAdsDetailPayload
} = require('./promotionAdsDetailUtils');
const {
  parseMetricNumber
} = require('./promotionMonitorMetricUtils');

const DEFAULT_DETAIL_PAGE_NUMBER = 1;
const DEFAULT_DETAIL_PAGE_SIZE = ADS_DETAIL_PAGE_SIZE;
const MAX_DETAIL_PAGE_SIZE = 50;
const MAX_DETAIL_PAGE_COUNT = 500;
const MAX_CONSECUTIVE_DUPLICATE_DETAIL_PAGE_COUNT = 5;

const REGION_LABELS = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

const DETAIL_STATUS_RUNNING = 'running';
const DETAIL_STATUS_PAUSED = 'paused';
const DETAIL_STATUS_ENDED = 'ended';
const DETAIL_STATUS_DELETED = 'deleted';

const DETAIL_STATUS_LABELS = Object.freeze({
  [DETAIL_STATUS_RUNNING]: '\u6295\u653e\u4e2d',
  [DETAIL_STATUS_PAUSED]: '\u5df2\u6682\u505c',
  [DETAIL_STATUS_ENDED]: '\u5df2\u7ed3\u675f',
  [DETAIL_STATUS_DELETED]: '\u5df2\u5220\u9664'
});

function normalizeUniqueTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [values];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeRegionIds(values) {
  return normalizeUniqueTextList(values)
    .filter((regionId) => Object.prototype.hasOwnProperty.call(REGION_LABELS, regionId));
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

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseLocalDateText(value, endOfDay = false) {
  const text = normalizeText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  ).getTime();
}

function parseDateTimestamp(value, endOfDay = false) {
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0) {
    return numberValue;
  }

  const localDateTimestamp = parseLocalDateText(value, endOfDay);

  if (localDateTimestamp !== null) {
    return localDateTimestamp;
  }

  const parsedDate = new Date(value);
  const parsedTimestamp = parsedDate.getTime();

  if (Number.isNaN(parsedTimestamp)) {
    return null;
  }

  if (!endOfDay) {
    parsedDate.setHours(0, 0, 0, 0);
  } else {
    parsedDate.setHours(23, 59, 59, 999);
  }

  return parsedDate.getTime();
}

function normalizeDetailDateRange(payload = {}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const range = Array.isArray(payload.dateRange || payload.date_range)
    ? (payload.dateRange || payload.date_range)
    : [];
  const startCandidate = payload.startTime || payload.start_time || range[0];
  const endCandidate = payload.endTime || payload.end_time || range[1];
  const startTime = parseDateTimestamp(startCandidate, false) || todayStart;
  const endTime = parseDateTimestamp(endCandidate, true) || todayEnd;

  return {
    startTime: Math.min(startTime, endTime),
    endTime: Math.max(startTime, endTime)
  };
}

function formatTimestamp(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (numberValue) => String(numberValue).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

function joinTextList(values, separator = ' / ') {
  return Array.isArray(values)
    ? values.map(normalizeText).filter(Boolean).join(separator)
    : '';
}

function resolveSummaryText(item, columnIds) {
  const summary = item && item.summary && typeof item.summary === 'object'
    ? item.summary
    : {};

  for (const columnId of Array.isArray(columnIds) ? columnIds : []) {
    const text = normalizeText(summary[columnId]);

    if (text && text !== '--') {
      return text;
    }
  }

  return '';
}

function formatRoasText(rawValue, displayText) {
  const text = normalizeText(displayText);
  const numberValue = parseMetricNumber(text);

  if (numberValue !== null && numberValue >= 1000 && !/[.]/.test(text)) {
    return (numberValue / 10000).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  if (text) {
    return text;
  }

  const rawNumber = Number(rawValue);

  if (Number.isFinite(rawNumber) && rawNumber > 0) {
    return (rawNumber / 10000).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  return '';
}

function parseRoasValue(rawValue, displayText) {
  const displayValue = parseMetricNumber(displayText);

  if (displayValue !== null) {
    return displayValue;
  }

  const rawNumber = Number(rawValue);

  if (!Number.isFinite(rawNumber) || rawNumber <= 0) {
    return 0;
  }

  return rawNumber >= 1000 ? rawNumber / 10000 : rawNumber;
}

function resolveDetailStatusValue(item) {
  const raw = item && item.raw && typeof item.raw === 'object' ? item.raw : {};
  const showStatus = Number(raw.ad_show_status);
  const adPhase = Number(raw.ad_phase);

  if (item && item.isPaused === true) {
    return DETAIL_STATUS_PAUSED;
  }

  if (showStatus === 7) {
    return DETAIL_STATUS_PAUSED;
  }

  if (showStatus === 8) {
    return DETAIL_STATUS_RUNNING;
  }

  if (showStatus === 9 || adPhase === 3) {
    return DETAIL_STATUS_ENDED;
  }

  if (showStatus === 10 || adPhase === 4) {
    return DETAIL_STATUS_DELETED;
  }

  return DETAIL_STATUS_RUNNING;
}

function resolveBudgetText(item) {
  const budgetText = normalizeText(item && item.budgetText);
  const budget = normalizeOptionalNumber(item && item.budget);

  if (budget === -1) {
    return budgetText || '\u4e0d\u9650';
  }

  if (budgetText) {
    return budgetText;
  }

  return budget !== null ? String(budget) : '';
}

function resolveRawTimestamp(raw, keys) {
  for (const key of Array.isArray(keys) ? keys : []) {
    const timestamp = Number(raw && raw[key]);

    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }

  return 0;
}

function mapAdsDetailItemToRow(item, context) {
  const raw = item && item.raw && typeof item.raw === 'object' ? item.raw : {};
  const rowIndex = Math.max(1, Number(context.index) || 1);
  const goodsId = normalizeText(item && item.goodsId);
  const adId = normalizeText(item && item.adId);
  const statusValue = resolveDetailStatusValue(item);
  const spendText = resolveSummaryText(item, ['ad_spend_label', 'net_ad_spend_label']);
  const roasText = resolveSummaryText(item, ['roas_label', 'roas_all'])
    || formatRoasText(item && item.currentRoasRaw, item && item.currentRoasText);
  const targetRoasText = formatRoasText(item && item.targetRoasRaw, item && item.targetRoasText);
  const orderCountText = resolveSummaryText(item, ['order_pay_count_label', 'order_pay_count_all_label'])
    || String(Math.max(0, Number(item && item.orderCount) || 0));
  const rowId = [
    context.shopId,
    context.regionId,
    adId || goodsId || rowIndex
  ].filter(Boolean).join(':');

  return {
    id: rowId,
    rowKey: rowId,
    rowIndex,
    shopId: normalizeText(context.shopId),
    shopName: normalizeText(context.shopName),
    regionId: normalizeText(context.regionId),
    regionLabel: REGION_LABELS[context.regionId] || context.regionId,
    goodsId,
    adId,
    spuId: normalizeText(raw.spu_id || raw.spuId),
    productName: normalizeText(item && item.productName),
    productImageUrl: normalizeText(item && item.productImageUrl),
    siteText: joinTextList(item && item.siteNames),
    categoryText: joinTextList(raw.category_name_list || raw.categoryNameList),
    createdAtText: formatTimestamp(resolveRawTimestamp(raw, [
      'create_timestamp',
      'createTimestamp',
      'created_at',
      'createdAt'
    ])),
    statusValue,
    statusLabel: DETAIL_STATUS_LABELS[statusValue] || '\u672a\u77e5',
    fastStartEnabled: item && item.fastStartEnabled === true,
    fastStartText: item && item.fastStartEnabled === true ? '\u5f00\u542f' : '\u5173\u95ed',
    roasTypeText: '\u5168\u57df\u63a8\u5e7f',
    spendText,
    netSpendText: resolveSummaryText(item, ['net_ad_spend_label']),
    salesAmountText: resolveSummaryText(item, ['order_pay_amt_all', 'order_pay_amt_label']),
    roasText,
    costPerOrderText: resolveSummaryText(item, ['transaction_cost_label', 'transaction_cost_all']),
    orderCountText,
    impressionText: resolveSummaryText(item, ['impr_count_label', 'impr_count_all']),
    clickText: resolveSummaryText(item, ['click_count_label', 'click_count_all']),
    spendValue: typeof (item && item.adSpend) === 'number'
      ? item.adSpend
      : (parseMetricNumber(spendText) || 0),
    roasValue: parseRoasValue(item && item.currentRoasRaw, roasText),
    orderCount: Math.max(0, Number(item && item.orderCount) || parseMetricNumber(orderCountText) || 0),
    dailyBudgetText: resolveBudgetText(item),
    targetRoasText,
    targetRoasRaw: Math.max(0, Number(item && item.targetRoasRaw) || 0),
    targetRoasValue: parseRoasValue(item && item.targetRoasRaw, targetRoasText),
    updatedAtText: formatTimestamp(resolveRawTimestamp(raw, [
      'update_timestamp',
      'updateTimestamp',
      'updated_at',
      'updatedAt'
    ])),
    actionStatusValue: '',
    actionStatusLabel: '',
    actionMessage: ''
  };
}

function getApiErrorMessage(response, fallbackMessage) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const data = responsePayload.data && typeof responsePayload.data === 'object'
    ? responsePayload.data
    : {};
  const errorCode = normalizeText(data.error_code || data.errorCode || responsePayload.errorCode);
  const message = normalizeText(
    data.error_msg
    || data.errorMsg
    || data.message
    || data.msg
    || responsePayload.message
  );

  if (message) {
    return errorCode ? `${message} (${errorCode})` : message;
  }

  return buildAdsDetailRequestFailureMessage(responsePayload, fallbackMessage);
}

function assertApiSuccess(response, contextText) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const data = responsePayload.data && typeof responsePayload.data === 'object'
    ? responsePayload.data
    : {};

  if (responsePayload.ok !== true || data.success === false || responsePayload.success === false) {
    throw new Error(getApiErrorMessage(
      responsePayload,
      contextText || '\u63a8\u5e7f\u660e\u7ec6\u67e5\u8be2\u5931\u8d25'
    ));
  }
}

function readResponseData(response) {
  return response && response.data && typeof response.data === 'object'
    ? response.data
    : {};
}

function buildDetailPageSignature(rows) {
  if (!Array.isArray(rows) || rows.length <= 0) {
    return '';
  }

  return rows
    .map((row) => [
      row && row.goodsId,
      row && row.adId,
      row && row.productImageUrl
    ].map(normalizeText).filter(Boolean).join(':'))
    .filter(Boolean)
    .join('|');
}

function shouldFetchNextDetailPage(extracted, pageNumber) {
  if (!extracted || !Array.isArray(extracted.rows) || extracted.rows.length <= 0) {
    return false;
  }

  if (extracted.hasMore === false) {
    return false;
  }

  const currentPageNumber = normalizePositiveInteger(pageNumber, DEFAULT_DETAIL_PAGE_NUMBER);
  const pageSize = normalizePositiveInteger(extracted.pageSize, DEFAULT_DETAIL_PAGE_SIZE);
  const total = Math.max(0, Number(extracted.total) || 0);

  if (total > 0 && pageSize > 0) {
    return currentPageNumber < Math.ceil(total / pageSize);
  }

  return extracted.hasMore === true || extracted.rows.length >= pageSize;
}

function extractDetailRows(response, context) {
  const responseData = readResponseData(response);
  const pageSize = normalizePositiveInteger(
    responseData.page_size || context.requestPayload.page_size,
    DEFAULT_DETAIL_PAGE_SIZE
  );
  const pageNumber = normalizePositiveInteger(
    responseData.page_number || context.requestPayload.page_number,
    DEFAULT_DETAIL_PAGE_NUMBER
  );
  const items = extractAdsDetailItems(responseData, context.regionId);

  return {
    listId: normalizeText(
      responseData.list_id
      || responseData.listId
      || context.requestPayload.list_id
    ),
    pageNumber,
    pageSize,
    total: resolveAdsDetailProductCount(responseData, context.regionId),
    hasMore: detectAdsDetailHasMore(responseData, pageNumber, items.length, pageSize),
    rows: items.map((item, index) => mapAdsDetailItemToRow(item, {
      ...context,
      index: Math.max(0, Number(context.rowOffset) || 0) + index + 1
    }))
  };
}

function buildDetailBasePayload(payload = {}) {
  const dateRange = normalizeDetailDateRange(payload);

  return buildAdsDetailPayload({
    pageNumber: payload.pageNumber || payload.page_number || DEFAULT_DETAIL_PAGE_NUMBER,
    pageSize: normalizePositiveInteger(payload.pageSize || payload.page_size, DEFAULT_DETAIL_PAGE_SIZE, {
      maximum: MAX_DETAIL_PAGE_SIZE
    }),
    sortBy: payload.sortBy || payload.sort_by || ADS_DETAIL_SORT_BY_PAUSED_STATUS,
    startTime: dateRange.startTime,
    endTime: dateRange.endTime,
    listId: payload.listId || payload.list_id,
    selectedRoasType: payload.selectedRoasType || payload.selected_roas_type || 1
  });
}

function buildDetailPagePayload(basePayload, pageNumber, listId) {
  return {
    ...basePayload,
    page_number: normalizePositiveInteger(pageNumber, DEFAULT_DETAIL_PAGE_NUMBER),
    list_id: normalizeText(listId) || normalizeText(basePayload && basePayload.list_id)
  };
}

function buildMessageSignature(entry) {
  return [
    normalizeText(entry && entry.shopName),
    normalizeText(entry && entry.regionLabel),
    normalizeText(entry && entry.message)
  ].join('|');
}

function pushUniqueMessage(target, entry, signatureSet) {
  const signature = buildMessageSignature(entry);

  if (!signature || signatureSet.has(signature)) {
    return false;
  }

  signatureSet.add(signature);
  target.push(entry);
  return true;
}

function toCloneableJsonValue(value, fallback) {
  try {
    if (value === undefined) {
      return fallback;
    }

    const text = JSON.stringify(value);
    return text ? JSON.parse(text) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function createDetailQueryTaskId() {
  return [
    'query_detail',
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 10)
  ].join('_');
}

module.exports = {
  DEFAULT_DETAIL_PAGE_NUMBER,
  DEFAULT_DETAIL_PAGE_SIZE,
  MAX_DETAIL_PAGE_SIZE,
  MAX_DETAIL_PAGE_COUNT,
  MAX_CONSECUTIVE_DUPLICATE_DETAIL_PAGE_COUNT,
  REGION_LABELS,
  normalizeUniqueTextList,
  normalizeRegionIds,
  normalizePositiveInteger,
  buildDetailBasePayload,
  buildDetailPagePayload,
  extractDetailRows,
  mapAdsDetailItemToRow,
  shouldFetchNextDetailPage,
  buildDetailPageSignature,
  assertApiSuccess,
  pushUniqueMessage,
  toCloneableJsonValue,
  createDetailQueryTaskId
};
