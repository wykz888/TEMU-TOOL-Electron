const crypto = require('node:crypto');
const { normalizeText } = require('../shopManagement/common');
const {
  applyBidInfoToRows
} = require('./promotionManagerNewBidUtils');
const { createPromotionManagerNewBidFetcher } = require('./promotionManagerNewBidService');

const ADS_GOODS_LIST_URL = 'https://ads.temu.com/api/v1/coconut/ad/query_mall_goods_list';
const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const MAX_GOODS_PAGE_COUNT = 1000;
const MAX_CONSECUTIVE_DUPLICATE_GOODS_PAGE_COUNT = 5;
const GOODS_QUERY_CANCELED_MESSAGE = '\u5df2\u505c\u6b62\u67e5\u8be2';

const REGION_LABELS = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

const REGION_IDS = Object.freeze(Object.keys(REGION_LABELS));

function normalizeUniqueTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [values];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeRegionIds(values) {
  const selectedIds = normalizeUniqueTextList(values);

  return selectedIds.filter((regionId) => Object.prototype.hasOwnProperty.call(REGION_LABELS, regionId));
}

function normalizePositiveInteger(value, fallback, options = {}) {
  const numberValue = Number.parseInt(value, 10);
  const minimum = Number.isFinite(Number(options.minimum)) ? Number(options.minimum) : 1;
  const maximum = Number.isFinite(Number(options.maximum)) ? Number(options.maximum) : Number.MAX_SAFE_INTEGER;

  if (!Number.isFinite(numberValue) || numberValue < minimum) {
    return fallback;
  }

  return Math.min(numberValue, maximum);
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const numberValue = Number.parseInt(value, 10);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return fallback;
  }

  return numberValue;
}

function normalizeFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(String(value).replace(/,/g, ''));

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeNumberText(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value).trim();
}

function createGoodsListId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function createGoodsQueryTaskId() {
  return `query_goods_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
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

function joinTextList(values, separator = ' / ') {
  return Array.isArray(values)
    ? values.map(normalizeText).filter(Boolean).join(separator)
    : '';
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

function buildGoodsListPayload(payload = {}) {
  return {
    page_number: normalizePositiveInteger(payload.pageNumber || payload.page_number, DEFAULT_PAGE_NUMBER),
    page_size: normalizePositiveInteger(payload.pageSize || payload.page_size, DEFAULT_PAGE_SIZE, {
      maximum: MAX_PAGE_SIZE
    }),
    list_id: normalizeText(payload.listId || payload.list_id),
    is_gray: normalizeBoolean(payload.isGray || payload.is_gray, false),
    selected_roas_type: normalizePositiveInteger(
      payload.selectedRoasType || payload.selected_roas_type,
      1
    )
  };
}

function buildGoodsListPagePayload(payload, pageNumber, listId) {
  return {
    ...payload,
    page_number: normalizePositiveInteger(pageNumber, DEFAULT_PAGE_NUMBER),
    list_id: normalizeText(listId !== undefined ? listId : payload.list_id)
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
      accountValue: normalizeText(shop && shop.accountValue),
      note: normalizeText(shop && shop.note)
    }));
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
      contextText || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25'
    ));
  }
}

function buildPriceRange(record) {
  const minPrice = normalizeNumberText(record && record.supply_price_min);
  const maxPrice = normalizeNumberText(record && record.supply_price_max);

  if (minPrice && maxPrice && minPrice !== maxPrice) {
    return `${minPrice} - ${maxPrice}`;
  }

  return minPrice || maxPrice;
}

function buildSitePriceText(record) {
  const sitePriceList = Array.isArray(record && record.site_price_info_list)
    ? record.site_price_info_list
    : [];

  return sitePriceList
    .map((entry) => {
      const siteName = normalizeText(entry && entry.site_name);
      const minPrice = normalizeNumberText(entry && entry.supply_price_min);
      const maxPrice = normalizeNumberText(entry && entry.supply_price_max);
      const priceText = minPrice && maxPrice && minPrice !== maxPrice
        ? `${minPrice}-${maxPrice}`
        : (minPrice || maxPrice);

      return [siteName, priceText].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join(' / ');
}

function buildPromotionTagsText(record) {
  const parts = [];
  const fastStartEnable = Number(record && record.fast_start_enable);

  if (Number.isFinite(fastStartEnable) && fastStartEnable > 0) {
    parts.push(fastStartEnable === 1 ? '\u6781\u901f\u8d77\u91cf' : `\u6781\u901f\u8d77\u91cf ${fastStartEnable}`);
  }

  if (record && record.created_new_roas === true) {
    parts.push('New ROAS');
  }

  if (normalizeText(record && record.gray_reason)) {
    parts.push(normalizeText(record.gray_reason));
  }

  return parts.join(' / ');
}

function mapGoodsRecord(record, context) {
  const safeRecord = record && typeof record === 'object' ? record : {};
  const goodsId = normalizeText(safeRecord.goods_id);
  const spuId = normalizeText(safeRecord.spu_id);
  const skuEncode = normalizeText(safeRecord.sku_encode);
  const categoryText = joinTextList(safeRecord.category_name_list);
  const siteText = joinTextList(safeRecord.site_name_list);
  const priceText = buildPriceRange(safeRecord);
  const sitePriceText = buildSitePriceText(safeRecord);
  const fastStartEnable = Number(safeRecord.fast_start_enable);
  const priceMin = normalizeFiniteNumber(safeRecord.supply_price_min);
  const priceMax = normalizeFiniteNumber(safeRecord.supply_price_max);
  const rowId = [
    context.shopId,
    context.regionId,
    goodsId || spuId || skuEncode || context.index
  ].filter(Boolean).join(':');

  return {
    id: rowId,
    rowKey: rowId,
    rowIndex: context.index,
    shopId: context.shopId,
    shopName: context.shopName,
    regionId: context.regionId,
    regionLabel: REGION_LABELS[context.regionId] || context.regionId,
    mallId: context.mallId,
    mallType: context.mallType,
    goodsId,
    goodsName: normalizeText(safeRecord.goods_name),
    thumbUrl: normalizeText(safeRecord.thumb_url),
    skuEncode,
    spuId,
    priceText,
    priceMin,
    priceMax,
    sitePriceText,
    categoryText,
    siteText,
    skuTotalQuantity: normalizeNumberText(safeRecord.sku_total_quantity),
    sales: normalizeNumberText(safeRecord.sales),
    salesNumber: normalizeFiniteNumber(safeRecord.sales),
    createdAtText: formatTimestamp(safeRecord.create_timestamp),
    createTimestamp: Number(safeRecord.create_timestamp) || 0,
    fastStartEnable: Number.isFinite(fastStartEnable) ? fastStartEnable : null,
    fastStartEnabled: Number.isFinite(fastStartEnable) && fastStartEnable > 0,
    recRoasType: normalizeNumberText(safeRecord.rec_roas_type),
    promotionText: buildPromotionTagsText(safeRecord),
    couponText: normalizeText(safeRecord.coupon_discount || safeRecord.coupon_tag_type)
  };
}

function normalizeOptionalBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return null;
}

function buildGoodsPageSignature(rows) {
  if (!Array.isArray(rows) || rows.length <= 0) {
    return '';
  }

  return rows
    .map((row) => [
      row && row.goodsId,
      row && row.spuId,
      row && row.skuEncode,
      row && row.thumbUrl
    ].map(normalizeText).filter(Boolean).join(':'))
    .filter(Boolean)
    .join('|');
}

function extractGoodsRows(response, context) {
  const responsePayload = response && response.data && typeof response.data === 'object'
    ? response.data
    : {};
  const result = responsePayload.result && typeof responsePayload.result === 'object'
    ? responsePayload.result
    : {};
  const goodsList = Array.isArray(result.goods_info_list) ? result.goods_info_list : [];

  return {
    mallId: normalizeText(result.mall_id),
    mallType: normalizeText(result.mall_type),
    listId: normalizeText(responsePayload.list_id || responsePayload.listId || result.list_id || result.listId),
    pageNumber: normalizePositiveInteger(responsePayload.page_number, context.requestPayload.page_number),
    pageSize: normalizePositiveInteger(responsePayload.page_size, context.requestPayload.page_size),
    total: normalizeNonNegativeInteger(responsePayload.total, goodsList.length),
    hasMore: normalizeOptionalBoolean(responsePayload.has_more),
    rows: goodsList.map((record, index) => mapGoodsRecord(record, {
      ...context,
      mallId: normalizeText(result.mall_id),
      mallType: normalizeText(result.mall_type),
      index: normalizeNonNegativeInteger(context.rowOffset, 0) + index + 1
    }))
  };
}

function shouldFetchNextGoodsPage(extracted, currentPageNumber) {
  if (!extracted || !Array.isArray(extracted.rows) || extracted.rows.length <= 0) {
    return false;
  }

  if (extracted.hasMore === false) {
    return false;
  }

  const total = normalizeNonNegativeInteger(extracted.total, 0);
  const pageNumber = normalizePositiveInteger(currentPageNumber, normalizePositiveInteger(extracted.pageNumber, DEFAULT_PAGE_NUMBER));
  const pageSize = normalizePositiveInteger(extracted.pageSize, DEFAULT_PAGE_SIZE);

  if (total > 0 && pageSize > 0) {
    return pageNumber < Math.ceil(total / pageSize);
  }

  if (extracted.hasMore === true) {
    return true;
  }

  return extracted.rows.length >= pageSize;
}

function isGoodsQueryLimitMessage(message) {
  return /query\s+goods\s+over\s+limit/i.test(normalizeText(message));
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

function createPromotionManagerNewGoodsService({
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

  const bidFetcher = createPromotionManagerNewBidFetcher({
    adsSessionService,
    assertApiSuccess
  });

  function createQueryTaskSignal(taskId) {
    const normalizedTaskId = normalizeText(taskId) || createGoodsQueryTaskId();
    const signal = {
      taskId: normalizedTaskId,
      canceled: pendingCanceledQueryTaskIds.has(normalizedTaskId),
      canceledAt: ''
    };

    pendingCanceledQueryTaskIds.delete(normalizedTaskId);
    activeQueryTasks.set(normalizedTaskId, signal);
    return signal;
  }

  function cancelQueryGoods(payload = {}) {
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

  async function fetchGoodsPageForRegion(shop, regionId, regionIds, requestPayload, rowOffset) {
    const sessionResult = await adsSessionService.postWithRegionCookie(
      shop.id,
      regionId,
      ADS_GOODS_LIST_URL,
      requestPayload,
      {
        allRegionIds: regionIds,
        reason: `${regionId}-query-mall-goods-list-page-${requestPayload.page_number}`
      }
    );
    const response = sessionResult && sessionResult.response ? sessionResult.response : null;

    assertApiSuccess(response);

    return {
      sessionResult,
      extracted: extractGoodsRows(response, {
        shopId: shop.id,
        shopName: shop.shopName,
        regionId,
        requestPayload,
        rowOffset
      })
    };
  }

  async function fetchAllGoodsRowsForRegion(shop, regionId, regionIds, baseRequestPayload, signal) {
    const regionRows = [];
    const pageDetails = [];
    const bidErrors = [];
    const pageErrors = [];
    const duplicatePageWarnings = [];
    const seenPageSignatures = new Set();
    const seenRowIds = new Set();
    let pageNumber = normalizePositiveInteger(baseRequestPayload.page_number, DEFAULT_PAGE_NUMBER);
    const queryListId = normalizeText(baseRequestPayload.list_id) || createGoodsListId();
    let lastExtracted = null;
    let lastSessionResult = null;
    let stoppedByDuplicatePage = false;
    let stoppedByPageLimit = false;
    let stoppedByCancel = false;
    let consecutiveDuplicatePageCount = 0;

    for (let pageIndex = 0; pageIndex < MAX_GOODS_PAGE_COUNT; pageIndex += 1) {
      if (isQueryCanceled(signal)) {
        stoppedByCancel = true;
        break;
      }

      const requestPayload = buildGoodsListPagePayload(baseRequestPayload, pageNumber, queryListId);
      let sessionResult = null;
      let extracted = null;

      try {
        const pageResult = await fetchGoodsPageForRegion(
          shop,
          regionId,
          regionIds,
          requestPayload,
          regionRows.length
        );

        sessionResult = pageResult.sessionResult;
        extracted = pageResult.extracted;
      } catch (error) {
        const message = normalizeText(error && error.message) || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25';

        if (regionRows.length > 0 && isGoodsQueryLimitMessage(message)) {
          pageErrors.push({
            pageNumber: requestPayload.page_number,
            message
          });
          logError('promotion_manager_new_goods_query_page_limit_reached', error, {
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

      const pageSignature = buildGoodsPageSignature(extracted.rows);

      lastExtracted = extracted;
      lastSessionResult = sessionResult;

      if (isQueryCanceled(signal)) {
        stoppedByCancel = true;
        break;
      }

      if (pageSignature && seenPageSignatures.has(pageSignature)) {
        consecutiveDuplicatePageCount += 1;
        duplicatePageWarnings.push({
          pageNumber: requestPayload.page_number,
          message: '\u5546\u54c1\u5217\u8868\u5206\u9875\u8fd4\u56de\u91cd\u590d\u6570\u636e\uff0c\u5df2\u8df3\u8fc7\u8be5\u9875'
        });
        pageDetails.push({
          pageNumber: requestPayload.page_number,
          responsePageNumber: extracted.pageNumber,
          pageSize: extracted.pageSize,
          rowCount: extracted.rows.length,
          uniqueRowCount: 0,
          total: extracted.total,
          hasMore: extracted.hasMore,
          duplicatePage: true,
          bidRequestCount: 0,
          bidResponseCount: 0,
          bidErrorCount: 0
        });

        if (consecutiveDuplicatePageCount >= MAX_CONSECUTIVE_DUPLICATE_GOODS_PAGE_COUNT) {
          stoppedByDuplicatePage = true;
          break;
        }

        if (!shouldFetchNextGoodsPage(extracted, requestPayload.page_number)) {
          break;
        }

        pageNumber = requestPayload.page_number + 1;
        continue;
      }

      if (pageSignature) {
        seenPageSignatures.add(pageSignature);
      }
      consecutiveDuplicatePageCount = 0;

      let pageRows = extracted.rows;
      let bidRequestCount = 0;
      let bidResponseCount = 0;
      let bidErrorCount = 0;

      try {
        const bidResult = await bidFetcher.fetchBidInfoForRows({
          shop,
          regionId,
          regionIds,
          rows: extracted.rows,
          roasType: baseRequestPayload.selected_roas_type,
          pageNumber: extracted.pageNumber,
          signal
        });

        pageRows = applyBidInfoToRows(extracted.rows, bidResult.lookup);
        bidRequestCount = bidResult.requestCount;
        bidResponseCount = bidResult.responseCount;
      } catch (error) {
        bidErrorCount = 1;
        bidErrors.push({
          pageNumber: extracted.pageNumber,
          message: normalizeText(error && error.message) || '\u51fa\u4ef7\u9884\u6d4b\u67e5\u8be2\u5931\u8d25'
        });
        logError('promotion_manager_new_goods_bid_query_page_failed', error, {
          shopId: shop.id,
          shopName: shop.shopName,
          regionId,
          pageNumber: extracted.pageNumber,
          rowCount: extracted.rows.length
        });
      }

      if (isQueryCanceled(signal)) {
        stoppedByCancel = true;
        break;
      }

      let uniqueRowCount = 0;

      pageRows.forEach((row) => {
        const rowId = normalizeText(row && row.id);

        if (!rowId || seenRowIds.has(rowId)) {
          return;
        }

        seenRowIds.add(rowId);
        regionRows.push(row);
        uniqueRowCount += 1;
      });

      pageDetails.push({
        pageNumber: requestPayload.page_number,
        responsePageNumber: extracted.pageNumber,
        pageSize: extracted.pageSize,
        rowCount: extracted.rows.length,
        uniqueRowCount,
        total: extracted.total,
        hasMore: extracted.hasMore,
        duplicatePage: false,
        bidRequestCount,
        bidResponseCount,
        bidErrorCount
      });

      if (!shouldFetchNextGoodsPage(extracted, requestPayload.page_number)) {
        break;
      }

      pageNumber = requestPayload.page_number + 1;

      if (pageIndex + 1 >= MAX_GOODS_PAGE_COUNT) {
        stoppedByPageLimit = true;
      }
    }

    return {
      rows: regionRows,
      pageDetails,
      pageCount: pageDetails.length,
      bidErrors,
      pageErrors,
      duplicatePageWarnings,
      stoppedByDuplicatePage,
      stoppedByPageLimit,
      stoppedByCancel,
      mallId: normalizeText(lastExtracted && lastExtracted.mallId),
      mallType: normalizeText(lastExtracted && lastExtracted.mallType),
      pageNumber: normalizePositiveInteger(lastExtracted && lastExtracted.pageNumber, pageNumber),
      pageSize: normalizePositiveInteger(lastExtracted && lastExtracted.pageSize, baseRequestPayload.page_size),
      hasMore: lastExtracted ? lastExtracted.hasMore === true : false,
      total: normalizeNonNegativeInteger(lastExtracted && lastExtracted.total, regionRows.length),
      refreshedCookies: lastSessionResult && lastSessionResult.refreshedCookies === true,
      cookieSyncMode: normalizeText(lastSessionResult && lastSessionResult.cookieSyncMode)
    };
  }

  async function queryGoodsForShop(shop, regionIds, requestPayload, signal) {
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
          message: GOODS_QUERY_CANCELED_MESSAGE
        }, warningSignatures);
        break;
      }

      try {
        const extracted = await fetchAllGoodsRowsForRegion(
          shop,
          regionId,
          regionIds,
          requestPayload,
          signal
        );

        rows.push(...extracted.rows);
        regions.push({
          shopId: shop.id,
          shopName: shop.shopName,
          regionId,
          regionLabel: REGION_LABELS[regionId] || regionId,
          mallId: extracted.mallId,
          mallType: extracted.mallType,
          pageNumber: extracted.pageNumber,
          pageSize: extracted.pageSize,
          hasMore: extracted.hasMore,
          total: extracted.total,
          pageCount: extracted.pageCount,
          pageDetails: extracted.pageDetails,
          rowCount: extracted.rows.length,
          pageErrorCount: extracted.pageErrors.length,
          duplicatePageCount: extracted.duplicatePageWarnings.length,
          bidErrorCount: extracted.bidErrors.length,
          stoppedByDuplicatePage: extracted.stoppedByDuplicatePage === true,
          stoppedByPageLimit: extracted.stoppedByPageLimit === true,
          stoppedByCancel: extracted.stoppedByCancel === true,
          refreshedCookies: extracted.refreshedCookies === true,
          cookieSyncMode: normalizeText(extracted.cookieSyncMode)
        });

        extracted.pageErrors.forEach((pageError) => {
          pushUniqueMessage(warnings, {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            regionLabel: REGION_LABELS[regionId] || regionId,
            pageNumber: pageError.pageNumber,
            message: pageError.message
          }, warningSignatures);
        });

        if (extracted.stoppedByPageLimit === true) {
          pushUniqueMessage(errors, {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            regionLabel: REGION_LABELS[regionId] || regionId,
            message: '\u5546\u54c1\u5217\u8868\u5206\u9875\u8fbe\u5230\u4e0a\u9650\uff0c\u8bf7\u7f29\u5c0f\u67e5\u8be2\u8303\u56f4\u540e\u91cd\u8bd5'
          }, errorSignatures);
        }

        if (extracted.stoppedByCancel === true) {
          pushUniqueMessage(warnings, {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            regionLabel: REGION_LABELS[regionId] || regionId,
            message: GOODS_QUERY_CANCELED_MESSAGE
          }, warningSignatures);
          break;
        }

        extracted.bidErrors.forEach((bidError) => {
          pushUniqueMessage(warnings, {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            regionLabel: REGION_LABELS[regionId] || regionId,
            pageNumber: bidError.pageNumber,
            message: bidError.message
          }, warningSignatures);
        });
      } catch (error) {
        const failure = {
          shopId: shop.id,
          shopName: shop.shopName,
          regionId,
          regionLabel: REGION_LABELS[regionId] || regionId,
          message: normalizeText(error && error.message) || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25'
        };

        pushUniqueMessage(errors, failure, errorSignatures);
        logError('promotion_manager_new_goods_query_region_failed', error, failure);
      }
    }

    return {
      rows,
      regions,
      errors,
      warnings
    };
  }

  async function queryGoods(payload = {}) {
    if (!adsSessionService || typeof adsSessionService.postWithRegionCookie !== 'function') {
      throw new Error('\u63a8\u5e7f\u4f1a\u8bdd\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    if (!shopManagementService || typeof shopManagementService.getState !== 'function') {
      throw new Error('\u5e97\u94fa\u6570\u636e\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const shopIds = normalizeUniqueTextList(payload.shopIds || payload.shop_ids);
    const regionIds = normalizeRegionIds(payload.regionIds || payload.region_ids);
    const requestPayload = buildGoodsListPayload(payload);

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
      const rows = [];
      const regions = [];
      const errors = [];
      const warnings = [];
      const errorSignatures = new Set();
      const warningSignatures = new Set();

      const shopResults = await Promise.all(shops.map((shop) => (
        queryGoodsForShop(shop, regionIds, requestPayload, taskSignal)
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

      const result = {
        taskId: taskSignal.taskId,
        canceled: taskSignal.canceled === true,
        updatedAt: new Date().toISOString(),
        request: {
          shopIds: shops.map((shop) => shop.id),
          regionIds,
          pageNumber: requestPayload.page_number,
          pageSize: requestPayload.page_size
        },
        rows,
        regions,
        errors,
        warnings,
        totalCount: rows.length,
        successCount: regions.length,
        failedCount: errors.length
      };

      log('promotion_manager_new_goods_query_finished', {
        taskId: taskSignal.taskId,
        canceled: taskSignal.canceled === true,
        shopCount: shops.length,
        regionCount: regionIds.length,
        rowCount: rows.length,
        failedCount: errors.length,
        warningCount: warnings.length
      });

      return result;
    } finally {
      activeQueryTasks.delete(taskSignal.taskId);
    }
  }

  return {
    cancelQueryGoods,
    queryGoods
  };
}

module.exports = {
  ADS_GOODS_LIST_URL,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  REGION_IDS,
  buildGoodsListPayload,
  buildGoodsListPagePayload,
  createGoodsListId,
  createGoodsQueryTaskId,
  extractGoodsRows,
  mapGoodsRecord,
  shouldFetchNextGoodsPage,
  toCloneableJsonValue,
  createPromotionManagerNewGoodsService
};
