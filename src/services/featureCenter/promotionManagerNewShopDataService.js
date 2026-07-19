const { normalizeText } = require('../shopManagement/common');
const {
  buildReportsQueryPayload,
  buildReportsQuerySummaryContainer
} = require('./promotionReportsQueryUtils');
const {
  resolveSummaryGoodsCount
} = require('./promotionMonitorMetricUtils');

const ADS_REPORTS_QUERY_URL = 'https://ads.temu.com/api/v1/coconut/reports/queryReports';
const DEFAULT_QUERY_CONCURRENCY = 4;
const MAX_QUERY_CONCURRENCY = 8;

const REGION_LABELS = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

const REGION_SHORT_LABELS = Object.freeze({
  us: '\u7f8e',
  eu: '\u6b27',
  global: '\u5168'
});

const REGION_IDS = Object.freeze(Object.keys(REGION_LABELS));

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

function parseLocalDateText(value, endOfDay = false) {
  const text = normalizeText(value);
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(
    year,
    monthIndex,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );

  if (
    date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}

function parseDateRangeTimestamp(value, endOfDay = false) {
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0) {
    return numberValue;
  }

  const localDateTimestamp = parseLocalDateText(value, endOfDay);

  if (localDateTimestamp !== null) {
    return localDateTimestamp;
  }

  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsedDate = new Date(text);
  const parsedTimestamp = parsedDate.getTime();

  if (Number.isNaN(parsedTimestamp)) {
    return null;
  }

  if (endOfDay) {
    parsedDate.setHours(23, 59, 59, 999);
  } else {
    parsedDate.setHours(0, 0, 0, 0);
  }

  return parsedDate.getTime();
}

function buildShopDataReportsPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const dateRange = Array.isArray(source.dateRange || source.date_range)
    ? (source.dateRange || source.date_range)
    : [];
  const basePayload = buildReportsQueryPayload();
  const startTime = parseDateRangeTimestamp(
    source.startTime
    || source.start_time
    || source.startTs
    || source.start_ts
    || dateRange[0],
    false
  ) || basePayload.start_ts;
  const endTime = parseDateRangeTimestamp(
    source.endTime
    || source.end_time
    || source.endTs
    || source.end_ts
    || dateRange[1],
    true
  ) || basePayload.end_ts;

  return {
    ...basePayload,
    start_ts: Math.min(startTime, endTime),
    end_ts: Math.max(startTime, endTime)
  };
}

function buildShopLookup(shopState) {
  const shops = Array.isArray(shopState && shopState.shops) ? shopState.shops : [];

  return new Map(shops.map((shop) => [normalizeText(shop && shop.id), shop]));
}

function resolveSelectedShops(shopState, shopIds) {
  const shopMap = buildShopLookup(shopState);

  return normalizeUniqueTextList(shopIds)
    .map((shopId) => shopMap.get(shopId))
    .filter(Boolean)
    .map((shop) => ({
      id: normalizeText(shop && shop.id),
      shopName: normalizeText(shop && shop.shopName),
      groupName: normalizeText(shop && shop.groupName),
      accountValue: normalizeText(shop && shop.accountValue),
      note: normalizeText(shop && shop.note)
    }))
    .filter((shop) => shop.id && shop.shopName);
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

  if (responsePayload.httpStatus) {
    return `HTTP ${responsePayload.httpStatus}`;
  }

  return fallbackMessage;
}

function assertApiSuccess(response, contextText) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const data = responsePayload.data && typeof responsePayload.data === 'object'
    ? responsePayload.data
    : {};

  if (responsePayload.ok !== true || data.success === false || responsePayload.success === false) {
    throw new Error(getApiErrorMessage(
      responsePayload,
      contextText || '\u5e97\u94fa\u6570\u636e\u67e5\u8be2\u5931\u8d25'
    ));
  }
}

function normalizeSummaryMetrics(summaryContainer) {
  const source = summaryContainer
    && summaryContainer.normalizedReportsSummary
    && typeof summaryContainer.normalizedReportsSummary === 'object'
    ? summaryContainer.normalizedReportsSummary
    : {};

  return Object.entries(source).reduce((result, [key, value]) => {
    const metricKey = normalizeText(key);
    const metricValue = normalizeText(value);

    if (metricKey && metricValue) {
      result[metricKey] = metricValue;
    }

    return result;
  }, {});
}

function extractReportsSummary(response, regionId, context = {}) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const responseData = responsePayload.data && typeof responsePayload.data === 'object'
    ? responsePayload.data
    : {};
  const resultData = responseData.result && typeof responseData.result === 'object'
    ? responseData.result
    : {};
  const summary = buildReportsQuerySummaryContainer(resultData, responseData);
  const metrics = normalizeSummaryMetrics(summary);
  const productCount = resolveSummaryGoodsCount(summary);
  const fetchedAt = new Date().toISOString();

  return {
    regionId,
    regionLabel: REGION_LABELS[regionId] || regionId,
    status: 'success',
    statusLabel: '\u5df2\u67e5\u8be2',
    statusTone: 'green',
    fetchedAt,
    summary: metrics,
    metrics,
    metricCount: Object.keys(metrics).length,
    productCount,
    cookieSyncMode: normalizeText(context.cookieSyncMode),
    refreshedCookies: context.refreshedCookies === true,
    message: ''
  };
}

function buildFailedRegionReport(regionId, error) {
  return {
    regionId,
    regionLabel: REGION_LABELS[regionId] || regionId,
    status: 'failed',
    statusLabel: '\u5931\u8d25',
    statusTone: 'red',
    fetchedAt: new Date().toISOString(),
    summary: {},
    metrics: {},
    metricCount: 0,
    productCount: 0,
    cookieSyncMode: '',
    refreshedCookies: false,
    message: normalizeText(error && error.message) || '\u5e97\u94fa\u6570\u636e\u67e5\u8be2\u5931\u8d25'
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

function buildRegionSummaryText(regionReports, regionIds) {
  return regionIds
    .map((regionId) => {
      const report = regionReports[regionId];
      const shortLabel = REGION_SHORT_LABELS[regionId] || regionId;

      if (!report) {
        return `${shortLabel} -`;
      }

      return report.status === 'success'
        ? `${shortLabel} \u5df2\u67e5`
        : `${shortLabel} \u5931\u8d25`;
    })
    .join(' / ');
}

function buildRegionSummaryTitle(regionReports, regionIds) {
  return regionIds
    .map((regionId) => {
      const report = regionReports[regionId];
      const label = REGION_LABELS[regionId] || regionId;

      if (!report) {
        return `${label}\uff1a-`;
      }

      return [
        `${label}\uff1a${report.statusLabel || '-'}`,
        report.message ? `\u539f\u56e0\uff1a${report.message}` : '',
        report.metricCount ? `\u6570\u636e\u9879\uff1a${report.metricCount}` : ''
      ].filter(Boolean).join(' / ');
    })
    .join('\n');
}

function buildShopRow(shop, regionReports, regionIds) {
  const reports = regionReports && typeof regionReports === 'object' ? regionReports : {};
  const successCount = regionIds.filter((regionId) => (
    reports[regionId] && reports[regionId].status === 'success'
  )).length;
  const failedCount = regionIds.filter((regionId) => (
    reports[regionId] && reports[regionId].status === 'failed'
  )).length;
  const status = successCount >= regionIds.length
    ? 'success'
    : successCount > 0
      ? 'partial'
      : 'failed';
  const statusLabel = status === 'success'
    ? '\u5df2\u5b8c\u6210'
    : status === 'partial'
      ? '\u90e8\u5206\u6210\u529f'
      : '\u67e5\u8be2\u5931\u8d25';
  const statusTone = status === 'success' ? 'green' : status === 'partial' ? 'orange' : 'red';

  return {
    id: shop.id,
    shopId: shop.id,
    shopName: shop.shopName,
    groupName: shop.groupName,
    accountValue: shop.accountValue,
    note: shop.note,
    status,
    statusLabel,
    statusTone,
    queriedAt: new Date().toISOString(),
    querySummaryText: `\u5730\u533a\u6210\u529f ${successCount} / \u5730\u533a\u5931\u8d25 ${failedCount}`,
    regionSummaryText: buildRegionSummaryText(reports, regionIds),
    regionSummaryTitle: buildRegionSummaryTitle(reports, regionIds),
    regions: reports
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedConcurrency = Math.min(
    sourceItems.length,
    normalizePositiveInteger(concurrency, DEFAULT_QUERY_CONCURRENCY, {
      maximum: MAX_QUERY_CONCURRENCY
    })
  );
  const results = new Array(sourceItems.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < sourceItems.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(sourceItems[currentIndex], currentIndex);
    }
  }

  if (sourceItems.length <= 0) {
    return results;
  }

  await Promise.all(Array.from({ length: normalizedConcurrency }, () => runWorker()));
  return results;
}

function createPromotionManagerNewShopDataService({
  shopManagementService,
  promotionAdsSessionService,
  promotionMasterSessionService,
  runtimeLogger
} = {}) {
  const adsSessionService = promotionAdsSessionService || promotionMasterSessionService;

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  async function queryRegionReport(shop, regionId, regionIds, requestPayload) {
    const sessionResult = await adsSessionService.postWithRegionCookie(
      shop.id,
      regionId,
      ADS_REPORTS_QUERY_URL,
      requestPayload,
      {
        allRegionIds: regionIds,
        reason: `${regionId}-shop-data-reports-query`
      }
    );
    const response = sessionResult && sessionResult.response ? sessionResult.response : null;

    assertApiSuccess(response);
    return extractReportsSummary(response, regionId, {
      cookieSyncMode: sessionResult && sessionResult.cookieSyncMode,
      refreshedCookies: sessionResult && sessionResult.refreshedCookies === true
    });
  }

  async function queryShopReports(shop, regionIds, requestPayload) {
    const reports = {};
    const errors = [];
    const errorSignatures = new Set();

    for (const regionId of regionIds) {
      try {
        reports[regionId] = await queryRegionReport(shop, regionId, regionIds, requestPayload);
      } catch (error) {
        const failedReport = buildFailedRegionReport(regionId, error);

        reports[regionId] = failedReport;
        pushUniqueMessage(errors, {
          shopId: shop.id,
          shopName: shop.shopName,
          regionId,
          regionLabel: REGION_LABELS[regionId] || regionId,
          message: failedReport.message
        }, errorSignatures);
        logError('promotion_manager_new_shop_data_region_failed', error, {
          shopId: shop.id,
          shopName: shop.shopName,
          regionId
        });
      }
    }

    return {
      row: buildShopRow(shop, reports, regionIds),
      errors
    };
  }

  async function queryShopData(payload = {}) {
    if (!adsSessionService || typeof adsSessionService.postWithRegionCookie !== 'function') {
      throw new Error('\u63a8\u5e7f\u4f1a\u8bdd\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    if (!shopManagementService || typeof shopManagementService.getState !== 'function') {
      throw new Error('\u5e97\u94fa\u6570\u636e\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const shopIds = normalizeUniqueTextList(payload.shopIds || payload.shop_ids);
    const regionIds = normalizeRegionIds(payload.regionIds || payload.region_ids);
    const requestPayload = buildShopDataReportsPayload(payload);

    if (shopIds.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa');
    }

    if (regionIds.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u67e5\u8be2\u5730\u533a');
    }

    const shopState = await shopManagementService.getState();
    const shops = resolveSelectedShops(shopState, shopIds);

    if (shops.length <= 0) {
      throw new Error('\u6ca1\u6709\u627e\u5230\u53ef\u67e5\u8be2\u7684\u5e97\u94fa');
    }

    const errors = [];
    const errorSignatures = new Set();
    const shopResults = await mapWithConcurrency(
      shops,
      payload.concurrency,
      (shop) => queryShopReports(shop, regionIds, requestPayload)
    );
    const rows = shopResults.map((result) => result.row).filter(Boolean);

    shopResults.forEach((shopResult) => {
      (Array.isArray(shopResult && shopResult.errors) ? shopResult.errors : []).forEach((entry) => {
        pushUniqueMessage(errors, entry, errorSignatures);
      });
    });

    const successCount = rows.reduce((sum, row) => (
      sum + regionIds.filter((regionId) => (
        row.regions
        && row.regions[regionId]
        && row.regions[regionId].status === 'success'
      )).length
    ), 0);
    const failedCount = errors.length;
    const result = {
      updatedAt: new Date().toISOString(),
      request: {
        shopIds: shops.map((shop) => shop.id),
        regionIds,
        startTime: requestPayload.start_ts,
        endTime: requestPayload.end_ts,
        columnsType: requestPayload.columns_type,
        url: ADS_REPORTS_QUERY_URL
      },
      rows,
      errors,
      warnings: [],
      totalCount: rows.length,
      successCount,
      failedCount
    };

    log('promotion_manager_new_shop_data_query_finished', {
      shopCount: shops.length,
      regionCount: regionIds.length,
      successCount,
      failedCount
    });

    return result;
  }

  return {
    queryShopData
  };
}

module.exports = {
  ADS_REPORTS_QUERY_URL,
  REGION_IDS,
  buildShopDataReportsPayload,
  createPromotionManagerNewShopDataService
};
