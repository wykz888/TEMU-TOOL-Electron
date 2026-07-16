const { normalizeText } = require('../shopManagement/common');

const ADS_GOODS_LIST_URL = 'https://ads.temu.com/api/v1/coconut/ad/query_mall_goods_list';
const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;

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

  if (Number.isFinite(fastStartEnable)) {
    parts.push(fastStartEnable === 1 ? 'Fast start' : `Fast start ${fastStartEnable}`);
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
    couponText: normalizeText(safeRecord.coupon_discount || safeRecord.coupon_tag_type),
    raw: safeRecord
  };
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
    total: normalizePositiveInteger(responsePayload.total, goodsList.length, {
      minimum: 0
    }),
    hasMore: responsePayload.has_more === true,
    rows: goodsList.map((record, index) => mapGoodsRecord(record, {
      ...context,
      mallId: normalizeText(result.mall_id),
      mallType: normalizeText(result.mall_type),
      index: index + 1
    }))
  };
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
          const sessionResult = await adsSessionService.postWithRegionCookie(
            shop.id,
            regionId,
            ADS_GOODS_LIST_URL,
            requestPayload,
            {
              allRegionIds: regionIds,
              reason: `${regionId}-query-mall-goods-list`
            }
          );
          const response = sessionResult && sessionResult.response ? sessionResult.response : null;

          assertApiSuccess(response);

          const extracted = extractGoodsRows(response, {
            shopId: shop.id,
            shopName: shop.shopName,
            regionId,
            requestPayload
          });

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
            rowCount: extracted.rows.length,
            refreshedCookies: sessionResult.refreshedCookies === true,
            cookieSyncMode: normalizeText(sessionResult.cookieSyncMode)
          });
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

    return result;
  }

  return {
    queryGoods
  };
}

module.exports = {
  ADS_GOODS_LIST_URL,
  REGION_IDS,
  createPromotionManagerNewGoodsService
};
