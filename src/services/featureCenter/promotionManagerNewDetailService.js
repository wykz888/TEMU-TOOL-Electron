const { normalizeText } = require('../shopManagement/common');
const {
  ADS_DETAIL_URL
} = require('./promotionMonitorAdsDetailItems');
const {
  DEFAULT_DETAIL_PAGE_NUMBER,
  DEFAULT_DETAIL_PAGE_SIZE,
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
} = require('./promotionManagerNewDetailRows');

const DETAIL_QUERY_CANCELED_MESSAGE = '\u5df2\u505c\u6b62\u67e5\u8be2';

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
      accountValue: normalizeText(shop && shop.accountValue),
      note: normalizeText(shop && shop.note)
    }));
}

function createEmptyDetailQueryResult(taskId = '') {
  return {
    taskId: normalizeText(taskId),
    canceled: false,
    updatedAt: new Date().toISOString(),
    request: {},
    rows: [],
    regions: [],
    errors: [],
    warnings: [],
    totalCount: 0,
    successCount: 0,
    failedCount: 0
  };
}

function buildServiceUnavailableResult(message) {
  return {
    ...createEmptyDetailQueryResult(),
    errors: [{
      shopId: '',
      shopName: '',
      regionId: '',
      regionLabel: '',
      message
    }],
    failedCount: 1
  };
}

function createPromotionManagerNewDetailService({
  shopManagementService,
  promotionAdsSessionService,
  promotionMasterSessionService,
  runtimeLogger
} = {}) {
  const adsSessionService = promotionAdsSessionService || promotionMasterSessionService;
  const activeQueryTasks = new Map();
  const pendingCanceledQueryTaskIds = new Set();

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

  function createQueryTaskSignal(taskId) {
    const normalizedTaskId = normalizeText(taskId) || createDetailQueryTaskId();
    const signal = {
      taskId: normalizedTaskId,
      canceled: pendingCanceledQueryTaskIds.has(normalizedTaskId),
      canceledAt: ''
    };

    pendingCanceledQueryTaskIds.delete(normalizedTaskId);
    activeQueryTasks.set(normalizedTaskId, signal);
    return signal;
  }

  function cancelQueryDetails(payload = {}) {
    const taskId = normalizeText(payload.taskId || payload.task_id);

    if (!taskId) {
      return {
        canceled: false,
        taskId: '',
        message: '\u67e5\u8be2\u4efb\u52a1\u4e0d\u5b58\u5728'
      };
    }

    const signal = activeQueryTasks.get(taskId);

    if (!signal) {
      pendingCanceledQueryTaskIds.add(taskId);
      return {
        canceled: true,
        taskId,
        message: '\u5df2\u53d1\u9001\u505c\u6b62\u8bf7\u6c42'
      };
    }

    signal.canceled = true;
    signal.canceledAt = new Date().toISOString();

    return {
      canceled: true,
      taskId,
      message: '\u5df2\u53d1\u9001\u505c\u6b62\u8bf7\u6c42'
    };
  }

  function isQueryCanceled(signal) {
    return signal && signal.canceled === true;
  }

  async function fetchDetailPageForRegion(shop, regionId, regionIds, requestPayload, rowOffset) {
    const sessionResult = await adsSessionService.postWithRegionCookie(
      shop.id,
      regionId,
      ADS_DETAIL_URL,
      requestPayload,
      {
        allRegionIds: regionIds,
        reason: `${regionId}-ads-detail-page-${requestPayload.page_number}`
      }
    );
    const response = sessionResult && sessionResult.response ? sessionResult.response : null;

    assertApiSuccess(response);

    return {
      sessionResult,
      extracted: extractDetailRows(response, {
        shopId: shop.id,
        shopName: shop.shopName,
        regionId,
        requestPayload,
        rowOffset
      })
    };
  }

  async function fetchDetailRowsUntilDone(shop, regionId, regionIds, baseRequestPayload, signal) {
    const regionRows = [];
    const pageDetails = [];
    const pageErrors = [];
    const duplicatePageWarnings = [];
    const seenPageSignatures = new Set();
    const seenRowIds = new Set();
    const baseListId = normalizeText(baseRequestPayload.list_id);
    let pageNumber = normalizePositiveInteger(baseRequestPayload.page_number, DEFAULT_DETAIL_PAGE_NUMBER);
    let lastExtracted = null;
    let lastSessionResult = null;
    let stoppedByDuplicatePage = false;
    let stoppedByPageLimit = false;
    let stoppedByCancel = false;
    let consecutiveDuplicatePageCount = 0;

    for (let pageIndex = 0; pageIndex < MAX_DETAIL_PAGE_COUNT; pageIndex += 1) {
      if (isQueryCanceled(signal)) {
        stoppedByCancel = true;
        break;
      }

      const requestPayload = buildDetailPagePayload(baseRequestPayload, pageNumber, baseListId);
      let sessionResult = null;
      let extracted = null;

      try {
        const pageResult = await fetchDetailPageForRegion(
          shop,
          regionId,
          regionIds,
          requestPayload,
          regionRows.length
        );

        sessionResult = pageResult.sessionResult;
        extracted = pageResult.extracted;
      } catch (error) {
        const message = normalizeText(error && error.message) || '\u63a8\u5e7f\u660e\u7ec6\u67e5\u8be2\u5931\u8d25';

        if (regionRows.length > 0) {
          pageErrors.push({
            pageNumber: requestPayload.page_number,
            message
          });
          logError('promotion_manager_new_detail_query_page_failed', error, {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            pageNumber: requestPayload.page_number,
            rowCount: regionRows.length
          });
          break;
        }

        throw error;
      }

      lastExtracted = extracted;
      lastSessionResult = sessionResult;

      if (isQueryCanceled(signal)) {
        stoppedByCancel = true;
        break;
      }

      const pageSignature = buildDetailPageSignature(extracted.rows);

      if (pageSignature && seenPageSignatures.has(pageSignature)) {
        consecutiveDuplicatePageCount += 1;
        duplicatePageWarnings.push({
          pageNumber: requestPayload.page_number,
          message: '\u63a8\u5e7f\u660e\u7ec6\u5206\u9875\u8fd4\u56de\u91cd\u590d\u6570\u636e\uff0c\u5df2\u8df3\u8fc7\u8be5\u9875'
        });
        pageDetails.push({
          pageNumber: requestPayload.page_number,
          responsePageNumber: extracted.pageNumber,
          pageSize: extracted.pageSize,
          rowCount: extracted.rows.length,
          uniqueRowCount: 0,
          total: extracted.total,
          hasMore: extracted.hasMore,
          duplicatePage: true
        });

        if (consecutiveDuplicatePageCount >= MAX_CONSECUTIVE_DUPLICATE_DETAIL_PAGE_COUNT) {
          stoppedByDuplicatePage = true;
          break;
        }

        if (!shouldFetchNextDetailPage(extracted, requestPayload.page_number)) {
          break;
        }

        pageNumber = requestPayload.page_number + 1;
        continue;
      }

      if (pageSignature) {
        seenPageSignatures.add(pageSignature);
      }

      consecutiveDuplicatePageCount = 0;
      pageDetails.push(addUniqueDetailRows(regionRows, seenRowIds, extracted, requestPayload));

      if (!shouldFetchNextDetailPage(extracted, requestPayload.page_number)) {
        break;
      }

      pageNumber = requestPayload.page_number + 1;

      if (pageIndex + 1 >= MAX_DETAIL_PAGE_COUNT) {
        stoppedByPageLimit = true;
      }
    }

    return {
      rows: regionRows,
      pageDetails,
      pageCount: pageDetails.length,
      pageErrors,
      duplicatePageWarnings,
      stoppedByDuplicatePage,
      stoppedByPageLimit,
      stoppedByCancel,
      pageNumber: normalizePositiveInteger(lastExtracted && lastExtracted.pageNumber, pageNumber),
      pageSize: normalizePositiveInteger(lastExtracted && lastExtracted.pageSize, baseRequestPayload.page_size),
      total: Math.max(0, Number(lastExtracted && lastExtracted.total) || regionRows.length),
      hasMore: lastExtracted ? lastExtracted.hasMore === true : false,
      refreshedCookies: lastSessionResult && lastSessionResult.refreshedCookies === true,
      cookieSyncMode: normalizeText(lastSessionResult && lastSessionResult.cookieSyncMode)
    };
  }

  function addUniqueDetailRows(regionRows, seenRowIds, extracted, requestPayload) {
    let uniqueRowCount = 0;

    extracted.rows.forEach((row) => {
      const rowId = normalizeText(row && row.id);

      if (!rowId || seenRowIds.has(rowId)) {
        return;
      }

      seenRowIds.add(rowId);
      regionRows.push(row);
      uniqueRowCount += 1;
    });

    return {
      pageNumber: requestPayload.page_number,
      responsePageNumber: extracted.pageNumber,
      pageSize: extracted.pageSize,
      rowCount: extracted.rows.length,
      uniqueRowCount,
      total: extracted.total,
      hasMore: extracted.hasMore,
      duplicatePage: false
    };
  }

  function appendRegionWarnings(target, warningSignatures, shop, regionId, warnings) {
    (Array.isArray(warnings) ? warnings : []).forEach((warning) => {
      pushUniqueMessage(target, {
        shopId: shop.id,
        shopName: shop.shopName,
        regionId,
        regionLabel: REGION_LABELS[regionId] || regionId,
        pageNumber: warning.pageNumber,
        message: warning.message
      }, warningSignatures);
    });
  }

  function appendRegionLimitWarnings(target, warningSignatures, shop, regionId, extracted) {
    if (extracted.stoppedByPageLimit === true) {
      pushUniqueMessage(target, {
        shopId: shop.id,
        shopName: shop.shopName,
        regionId,
        regionLabel: REGION_LABELS[regionId] || regionId,
        message: '\u63a8\u5e7f\u660e\u7ec6\u5206\u9875\u8fbe\u5230\u4e0a\u9650\uff0c\u8bf7\u7f29\u5c0f\u67e5\u8be2\u65f6\u95f4\u540e\u91cd\u8bd5'
      }, warningSignatures);
    }

    if (extracted.stoppedByCancel === true) {
      pushUniqueMessage(target, {
        shopId: shop.id,
        shopName: shop.shopName,
        regionId,
        regionLabel: REGION_LABELS[regionId] || regionId,
        message: DETAIL_QUERY_CANCELED_MESSAGE
      }, warningSignatures);
    }
  }

  async function queryDetailsForShop(shop, regionIds, requestPayload, signal) {
    const rows = [];
    const regions = [];
    const errors = [];
    const warnings = [];
    const errorSignatures = new Set();
    const warningSignatures = new Set();

    for (const regionId of regionIds) {
      if (isQueryCanceled(signal)) {
        pushUniqueMessage(warnings, {
          shopId: shop.id,
          shopName: shop.shopName,
          regionId,
          regionLabel: REGION_LABELS[regionId] || regionId,
          message: DETAIL_QUERY_CANCELED_MESSAGE
        }, warningSignatures);
        break;
      }

      try {
        const extracted = await fetchDetailRowsUntilDone(
          shop,
          regionId,
          regionIds,
          requestPayload,
          signal
        );

        rows.push(...extracted.rows);
        regions.push(buildRegionSummary(shop, regionId, extracted));
        appendRegionWarnings(warnings, warningSignatures, shop, regionId, extracted.pageErrors);
        appendRegionWarnings(warnings, warningSignatures, shop, regionId, extracted.duplicatePageWarnings);
        appendRegionLimitWarnings(warnings, warningSignatures, shop, regionId, extracted);

        if (extracted.stoppedByCancel === true) {
          break;
        }
      } catch (error) {
        const failure = {
          shopId: shop.id,
          shopName: shop.shopName,
          regionId,
          regionLabel: REGION_LABELS[regionId] || regionId,
          message: normalizeText(error && error.message) || '\u63a8\u5e7f\u660e\u7ec6\u67e5\u8be2\u5931\u8d25'
        };

        pushUniqueMessage(errors, failure, errorSignatures);
        logError('promotion_manager_new_detail_query_region_failed', error, failure);
      }
    }

    return {
      rows,
      regions,
      errors,
      warnings
    };
  }

  function buildRegionSummary(shop, regionId, extracted) {
    return {
      shopId: shop.id,
      shopName: shop.shopName,
      regionId,
      regionLabel: REGION_LABELS[regionId] || regionId,
      pageNumber: extracted.pageNumber,
      pageSize: extracted.pageSize,
      total: extracted.total,
      hasMore: extracted.hasMore,
      pageCount: extracted.pageCount,
      pageDetails: extracted.pageDetails,
      rowCount: extracted.rows.length,
      pageErrorCount: extracted.pageErrors.length,
      duplicatePageCount: extracted.duplicatePageWarnings.length,
      stoppedByDuplicatePage: extracted.stoppedByDuplicatePage === true,
      stoppedByPageLimit: extracted.stoppedByPageLimit === true,
      stoppedByCancel: extracted.stoppedByCancel === true,
      refreshedCookies: extracted.refreshedCookies === true,
      cookieSyncMode: normalizeText(extracted.cookieSyncMode)
    };
  }

  async function queryDetails(payload = {}) {
    if (!adsSessionService || typeof adsSessionService.postWithRegionCookie !== 'function') {
      return buildServiceUnavailableResult('\u63a8\u5e7f\u4f1a\u8bdd\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    if (!shopManagementService || typeof shopManagementService.getState !== 'function') {
      return buildServiceUnavailableResult('\u5e97\u94fa\u6570\u636e\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const shopIds = normalizeUniqueTextList(payload.shopIds || payload.shop_ids);
    const regionIds = normalizeRegionIds(payload.regionIds || payload.region_ids);
    const requestPayload = buildDetailBasePayload(payload);

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

    const taskSignal = createQueryTaskSignal(payload.taskId || payload.task_id);

    try {
      const result = await queryDetailsForShops(shops, regionIds, requestPayload, taskSignal);

      log('promotion_manager_new_detail_query_finished', {
        taskId: taskSignal.taskId,
        canceled: taskSignal.canceled === true,
        shopCount: shops.length,
        regionCount: regionIds.length,
        rowCount: result.rows.length,
        failedCount: result.errors.length,
        warningCount: result.warnings.length
      });

      return toCloneableJsonValue({
        taskId: taskSignal.taskId,
        canceled: taskSignal.canceled === true,
        updatedAt: new Date().toISOString(),
        request: {
          shopIds: shops.map((shop) => shop.id),
          regionIds,
          pageNumber: requestPayload.page_number,
          pageSize: requestPayload.page_size,
          listId: requestPayload.list_id,
          startTime: requestPayload.start_time,
          endTime: requestPayload.end_time
        },
        rows: result.rows,
        regions: result.regions,
        errors: result.errors,
        warnings: result.warnings,
        totalCount: result.rows.length,
        successCount: result.regions.length,
        failedCount: result.errors.length
      }, createEmptyDetailQueryResult(taskSignal.taskId));
    } finally {
      activeQueryTasks.delete(taskSignal.taskId);
    }
  }

  async function queryDetailsForShops(shops, regionIds, requestPayload, signal) {
    const rows = [];
    const regions = [];
    const errors = [];
    const warnings = [];
    const errorSignatures = new Set();
    const warningSignatures = new Set();
    const shopResults = await Promise.all(shops.map((shop) => (
      queryDetailsForShop(shop, regionIds, requestPayload, signal)
    )));

    shopResults.forEach((shopResult) => {
      rows.push(...shopResult.rows);
      regions.push(...shopResult.regions);

      shopResult.errors.forEach((entry) => {
        pushUniqueMessage(errors, entry, errorSignatures);
      });
      shopResult.warnings.forEach((entry) => {
        pushUniqueMessage(warnings, entry, warningSignatures);
      });
    });

    return {
      rows,
      regions,
      errors,
      warnings
    };
  }

  return {
    cancelQueryDetails,
    queryDetails
  };
}

module.exports = {
  DEFAULT_DETAIL_PAGE_SIZE,
  MAX_DETAIL_PAGE_COUNT,
  REGION_LABELS,
  buildDetailBasePayload,
  extractDetailRows,
  mapAdsDetailItemToRow,
  shouldFetchNextDetailPage,
  createPromotionManagerNewDetailService
};
