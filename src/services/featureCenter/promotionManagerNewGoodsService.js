const crypto = require('node:crypto');
const { normalizeText } = require('../shopManagement/common');

const ADS_GOODS_LIST_URL = 'https://ads.temu.com/api/v1/coconut/ad/query_mall_goods_list';
const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const MAX_GOODS_PAGE_COUNT = 1000;

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
    list_id: normalizeText(payload.listId || payload.list_id) || createQueryListId(),
    is_gray: normalizeBoolean(payload.isGray || payload.is_gray, false),
    selected_roas_type: normalizePositiveInteger(
      payload.selectedRoasType || payload.selected_roas_type,
      1
    )
  };
}

function createQueryListId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildGoodsListPagePayload(payload, pageNumber) {
  return {
    ...payload,
    page_number: normalizePositiveInteger(pageNumber, DEFAULT_PAGE_NUMBER)
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
  const recRoasType = normalizeNumberText(record && record.rec_roas_type);

  if (Number.isFinite(fastStartEnable) && fastStartEnable > 0) {
    parts.push(fastStartEnable === 1 ? '\u6781\u901f\u8d77\u91cf' : `\u6781\u901f\u8d77\u91cf ${fastStartEnable}`);
  }

  if (recRoasType) {
    parts.push(`ROAS ${recRoasType}`);
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

  return {
    id: [
      context.shopId,
      context.regionId,
      goodsId || spuId || skuEncode || context.index
    ].filter(Boolean).join(':'),
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
    sitePriceText,
    categoryText,
    siteText,
    skuTotalQuantity: normalizeNumberText(safeRecord.sku_total_quantity),
    sales: normalizeNumberText(safeRecord.sales),
    createdAtText: formatTimestamp(safeRecord.create_timestamp),
    createTimestamp: Number(safeRecord.create_timestamp) || 0,
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

function shouldFetchNextGoodsPage(extracted, accumulatedRowCount) {
  if (!extracted || !Array.isArray(extracted.rows) || extracted.rows.length <= 0) {
    return false;
  }

  if (extracted.hasMore === true) {
    return true;
  }

  if (extracted.hasMore === false) {
    return false;
  }

  const total = normalizeNonNegativeInteger(extracted.total, 0);

  if (total > 0 && accumulatedRowCount < total) {
    return true;
  }

  const pageSize = normalizePositiveInteger(extracted.pageSize, DEFAULT_PAGE_SIZE);

  return extracted.rows.length >= pageSize;
}

function createPromotionManagerNewGoodsService({
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

  async function fetchAllGoodsRowsForRegion(shop, regionId, regionIds, baseRequestPayload) {
    const regionRows = [];
    const pageDetails = [];
    const seenPageSignatures = new Set();
    const seenRowIds = new Set();
    let pageNumber = normalizePositiveInteger(baseRequestPayload.page_number, DEFAULT_PAGE_NUMBER);
    let lastExtracted = null;
    let lastSessionResult = null;
    let stoppedByDuplicatePage = false;
    let stoppedByPageLimit = false;

    for (let pageIndex = 0; pageIndex < MAX_GOODS_PAGE_COUNT; pageIndex += 1) {
      const requestPayload = buildGoodsListPagePayload(baseRequestPayload, pageNumber);
      const { sessionResult, extracted } = await fetchGoodsPageForRegion(
        shop,
        regionId,
        regionIds,
        requestPayload,
        regionRows.length
      );
      const pageSignature = buildGoodsPageSignature(extracted.rows);

      lastExtracted = extracted;
      lastSessionResult = sessionResult;

      if (pageSignature && seenPageSignatures.has(pageSignature)) {
        stoppedByDuplicatePage = true;
        break;
      }

      if (pageSignature) {
        seenPageSignatures.add(pageSignature);
      }

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

      pageDetails.push({
        pageNumber: extracted.pageNumber,
        pageSize: extracted.pageSize,
        rowCount: extracted.rows.length,
        uniqueRowCount,
        total: extracted.total,
        hasMore: extracted.hasMore
      });

      if (!shouldFetchNextGoodsPage(extracted, regionRows.length)) {
        break;
      }

      pageNumber = extracted.pageNumber + 1;

      if (pageIndex + 1 >= MAX_GOODS_PAGE_COUNT) {
        stoppedByPageLimit = true;
      }
    }

    return {
      rows: regionRows,
      pageDetails,
      pageCount: pageDetails.length,
      stoppedByDuplicatePage,
      stoppedByPageLimit,
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

    const rows = [];
    const regions = [];
    const errors = [];

    for (const shop of shops) {
      for (const regionId of regionIds) {
        try {
          const extracted = await fetchAllGoodsRowsForRegion(
            shop,
            regionId,
            regionIds,
            requestPayload
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
            stoppedByDuplicatePage: extracted.stoppedByDuplicatePage === true,
            stoppedByPageLimit: extracted.stoppedByPageLimit === true,
            refreshedCookies: extracted.refreshedCookies === true,
            cookieSyncMode: normalizeText(extracted.cookieSyncMode)
          });

          if (extracted.stoppedByPageLimit === true) {
            errors.push({
              shopId: shop.id,
              shopName: shop.shopName,
              regionId,
              regionLabel: REGION_LABELS[regionId] || regionId,
              message: '\u5546\u54c1\u5217\u8868\u5206\u9875\u8fbe\u5230\u4e0a\u9650\uff0c\u8bf7\u7f29\u5c0f\u67e5\u8be2\u8303\u56f4\u540e\u91cd\u8bd5'
            });
          }

          if (extracted.stoppedByDuplicatePage === true) {
            errors.push({
              shopId: shop.id,
              shopName: shop.shopName,
              regionId,
              regionLabel: REGION_LABELS[regionId] || regionId,
              message: '\u5546\u54c1\u5217\u8868\u5206\u9875\u8fd4\u56de\u91cd\u590d\u6570\u636e\uff0c\u5df2\u505c\u6b62\u7ee7\u7eed\u67e5\u8be2'
            });
          }
        } catch (error) {
          const failure = {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            regionLabel: REGION_LABELS[regionId] || regionId,
            message: normalizeText(error && error.message) || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25'
          };

          errors.push(failure);
          logError('promotion_manager_new_goods_query_region_failed', error, failure);
        }
      }
    }

    const result = {
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
      totalCount: rows.length,
      successCount: regions.length,
      failedCount: errors.length
    };

    log('promotion_manager_new_goods_query_finished', {
      shopCount: shops.length,
      regionCount: regionIds.length,
      rowCount: rows.length,
      failedCount: errors.length
    });

    return toCloneableJsonValue(result, {
      updatedAt: new Date().toISOString(),
      request: {},
      rows: [],
      regions: [],
      errors: [{
        shopId: '',
        shopName: '',
        regionId: '',
        regionLabel: '',
        message: '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u7ed3\u679c\u89e3\u6790\u5931\u8d25'
      }],
      totalCount: 0,
      successCount: 0,
      failedCount: 1
    });
  }

  return {
    queryGoods
  };
}

module.exports = {
  ADS_GOODS_LIST_URL,
  REGION_IDS,
  buildGoodsListPayload,
  buildGoodsListPagePayload,
  extractGoodsRows,
  mapGoodsRecord,
  shouldFetchNextGoodsPage,
  toCloneableJsonValue,
  createPromotionManagerNewGoodsService
};
