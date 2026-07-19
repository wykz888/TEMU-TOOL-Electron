const { normalizeText } = require('../shopManagement/common');
const {
  ADS_DETAIL_PAGE_SIZE,
  ADS_DETAIL_PAUSED_PAGE_SIZE,
  ADS_DETAIL_SORT_BY_PAUSED_STATUS,
  ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT,
  ADS_DETAIL_SORT_BY_TOTAL_SPEND,
  buildAdsDetailPayload,
  normalizeAdsDetailSortBy
} = require('./promotionAdsDetailUtils');
const {
  ADS_DETAIL_PAUSED_STATUS_CODE,
  ADS_DETAIL_TOTAL_COUNT_ALIASES,
  extractIntegerByAliases,
  extractBooleanByAliases,
  normalizeAdsDetailItem,
  extractAdsDetailItems,
  resolveAdsDetailProductCount,
  mergeAdsDetailItemLists
} = require('./promotionMonitorAdsDetailItemParser');

const ADS_DETAIL_URL = 'https://ads.temu.com/api/v1/coconut/ad/ads_detail';
const ADS_DETAIL_MAX_PAGES = 20;
const ADS_DETAIL_MIN_ORDER_COUNT_FOR_PAGING = 1;

const ADS_DETAIL_TOTAL_PAGE_ALIASES = Object.freeze([
  'total_page',
  'totalPage',
  'page_total',
  'pageTotal',
  'total_pages',
  'totalPages',
  'page_count',
  'pageCount'
]);

const ADS_DETAIL_HAS_MORE_ALIASES = Object.freeze([
  'has_more',
  'hasMore',
  'more'
]);

function readResponsePayload(response) {
  return response && response.data && typeof response.data === 'object'
    ? response.data
    : {};
}

function buildAdsDetailPagePayload(pageNumber, options = {}) {
  return buildAdsDetailPayload({
    ...options,
    pageNumber
  });
}

function normalizeAdsDetailPageSize(value, fallback = ADS_DETAIL_PAGE_SIZE) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function detectAdsDetailHasMore(payload, pageNumber, rowCount, pageSize = ADS_DETAIL_PAGE_SIZE) {
  const responseData = payload && typeof payload === 'object' ? payload : {};
  const resultData = responseData.result && typeof responseData.result === 'object'
    ? responseData.result
    : {};
  const flatPayload = { ...responseData, ...resultData };
  const hasMore = extractBooleanByAliases(flatPayload, ADS_DETAIL_HAS_MORE_ALIASES);
  const normalizedPageNumber = Math.max(1, Number.parseInt(pageNumber, 10) || 1);
  const normalizedPageSize = normalizeAdsDetailPageSize(pageSize);

  if (typeof hasMore === 'boolean') {
    return hasMore;
  }

  const totalPage = extractIntegerByAliases(flatPayload, ADS_DETAIL_TOTAL_PAGE_ALIASES);

  if (totalPage !== null) {
    return normalizedPageNumber < totalPage;
  }

  const totalCount = extractIntegerByAliases(flatPayload, ADS_DETAIL_TOTAL_COUNT_ALIASES);

  if (totalCount !== null) {
    return normalizedPageNumber * normalizedPageSize < totalCount;
  }

  return Math.max(0, Number(rowCount) || 0) >= normalizedPageSize;
}

function shouldContinueAdsDetailPaging(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  if (Number(options.sortBy) === ADS_DETAIL_SORT_BY_PAUSED_STATUS) {
    return true;
  }

  const lastItem = items[items.length - 1];

  if (Number(options.sortBy) === ADS_DETAIL_SORT_BY_TOTAL_SPEND) {
    const spendThreshold = Number.isFinite(Number(options.spendThreshold))
      ? Number(options.spendThreshold)
      : null;
    const lastAdSpend = typeof (lastItem && lastItem.adSpend) === 'number'
      && Number.isFinite(lastItem.adSpend)
      ? lastItem.adSpend
      : null;

    return spendThreshold !== null && lastAdSpend !== null && lastAdSpend > spendThreshold;
  }

  return Math.max(0, Number(lastItem && lastItem.orderCount) || 0) >= ADS_DETAIL_MIN_ORDER_COUNT_FOR_PAGING;
}

function buildAdsDetailRequestFailureMessage(response, fallbackMessage) {
  const baseMessage = normalizeText(fallbackMessage) || 'ads_detail request failed';
  const directMessage = normalizeText(response && response.message);

  if (directMessage) {
    return directMessage;
  }

  const httpStatus = Math.max(
    0,
    Number(response && response.httpStatus) || Number(response && response.status) || 0
  );
  const statusText = normalizeText(response && response.statusText);
  const errorCode = Number(response && response.errorCode);
  const responsePreview = normalizeText(response && response.responseTextPreview)
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  let reason = '';

  if (httpStatus > 0) {
    reason = `HTTP ${httpStatus}${statusText ? ` ${statusText}` : ''}`;
  } else if (Number.isFinite(errorCode) && errorCode !== 0) {
    reason = `errorCode ${errorCode}`;
  } else if (responsePreview) {
    reason = responsePreview;
  }

  return reason ? `${baseMessage}: ${reason}` : baseMessage;
}

function getPostWithRegionCookie(options) {
  return options && typeof options.postWithRegionCookie === 'function'
    ? options.postWithRegionCookie
    : null;
}

async function fetchAdsDetailPage(shopId, regionId, pageNumber, requestOptions) {
  const fetchResult = await requestOptions.postWithRegionCookie(
    shopId,
    regionId,
    ADS_DETAIL_URL,
    requestOptions.buildPayload(pageNumber),
    {
      reason: `${regionId}-${requestOptions.reasonPrefix}-page-${pageNumber}`
    }
  );
  const response = fetchResult && fetchResult.response ? fetchResult.response : null;

  if (!response || response.ok !== true || response.success === false) {
    throw new Error(
      buildAdsDetailRequestFailureMessage(
        response,
        `${regionId} ${requestOptions.failureLabel} page ${pageNumber} failed`
      )
    );
  }

  return response;
}

async function collectPagedAdsDetailItems(shopId, regionId, options) {
  const normalizedRegionId = normalizeText(regionId);
  const postWithRegionCookie = getPostWithRegionCookie(options);
  const pageSize = normalizeAdsDetailPageSize(options.pageSize, ADS_DETAIL_PAGE_SIZE);
  const shouldContinue = typeof options.shouldContinue === 'function'
    ? options.shouldContinue
    : () => true;
  const combinedItems = [];
  let pageNumber = 1;
  let hasMore = true;

  if (options.firstResponse) {
    const firstPayload = readResponsePayload(options.firstResponse);
    const firstItems = extractAdsDetailItems(firstPayload, normalizedRegionId);

    combinedItems.push(...firstItems);
    hasMore =
      detectAdsDetailHasMore(firstPayload, pageNumber, firstItems.length, pageSize)
      && shouldContinue(firstItems);
    pageNumber += 1;

    if (hasMore && !postWithRegionCookie) {
      throw new Error(buildAdsDetailRequestFailureMessage(null, `${normalizedRegionId} ads_detail pagination unavailable`));
    }
  }

  while (
    hasMore
    && pageNumber <= ADS_DETAIL_MAX_PAGES
    && postWithRegionCookie
  ) {
    const response = await fetchAdsDetailPage(shopId, normalizedRegionId, pageNumber, {
      postWithRegionCookie,
      buildPayload: options.buildPayload,
      reasonPrefix: options.reasonPrefix,
      failureLabel: options.failureLabel
    });
    const payload = readResponsePayload(response);
    const nextItems = extractAdsDetailItems(payload, normalizedRegionId);

    if (nextItems.length === 0) {
      break;
    }

    combinedItems.push(...nextItems);
    hasMore =
      detectAdsDetailHasMore(payload, pageNumber, nextItems.length, pageSize)
      && shouldContinue(nextItems);
    pageNumber += 1;
  }

  if (combinedItems.length === 0 && !options.firstResponse && !postWithRegionCookie) {
    throw new Error(buildAdsDetailRequestFailureMessage(null, `${normalizedRegionId} ads_detail request failed`));
  }

  return combinedItems;
}

function createAdsDetailPayloadBuilder(options) {
  const sourceRequestPayload =
    options.requestPayload && typeof options.requestPayload === 'object'
      ? options.requestPayload
      : (
        options.firstRequestPayload && typeof options.firstRequestPayload === 'object'
          ? options.firstRequestPayload
          : {}
      );
  let pagingListId = normalizeText(
    options.listId
    || options.list_id
    || sourceRequestPayload.list_id
  );
  const sortBy = normalizeAdsDetailSortBy(options.sortBy, ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT);
  const pageSize = normalizeAdsDetailPageSize(options.pageSize, ADS_DETAIL_PAGE_SIZE);
  const adStatus = Array.isArray(options.adStatus) ? options.adStatus : [];
  const startTime = options.startTime || options.start_time || sourceRequestPayload.start_time;
  const endTime = options.endTime || options.end_time || sourceRequestPayload.end_time;
  const columnsType = options.columnsType || options.columns_type || sourceRequestPayload.columns_type;
  const selectedRoasType =
    options.selectedRoasType
    || options.selected_roas_type
    || sourceRequestPayload.selected_roas_type;

  return {
    pageSize,
    sortBy,
    buildPayload(pageNumber) {
      const payload = buildAdsDetailPagePayload(pageNumber, {
        sortBy,
        adStatus,
        pageSize,
        listId: pagingListId,
        startTime,
        endTime,
        columnsType,
        selectedRoasType
      });

      pagingListId = normalizeText(payload && payload.list_id) || pagingListId;
      return payload;
    }
  };
}

async function fetchAdsDetailItemsBySortForRegion(shopId, regionId, options = {}) {
  const payloadBuilder = createAdsDetailPayloadBuilder(options);
  const spendThreshold = Number.isFinite(Number(options.spendThreshold))
    ? Number(options.spendThreshold)
    : null;

  return collectPagedAdsDetailItems(shopId, regionId, {
    ...options,
    pageSize: payloadBuilder.pageSize,
    buildPayload: payloadBuilder.buildPayload,
    reasonPrefix: `ads-detail-sort-${payloadBuilder.sortBy}`,
    failureLabel: `ads_detail sort ${payloadBuilder.sortBy}`,
    shouldContinue: (items) => shouldContinueAdsDetailPaging(items, {
      sortBy: payloadBuilder.sortBy,
      spendThreshold
    })
  });
}

async function fetchPausedAdsDetailItemsForRegion(shopId, regionId, options = {}) {
  const payloadBuilder = createAdsDetailPayloadBuilder({
    ...options,
    sortBy: ADS_DETAIL_SORT_BY_PAUSED_STATUS,
    adStatus: [ADS_DETAIL_PAUSED_STATUS_CODE],
    pageSize: ADS_DETAIL_PAUSED_PAGE_SIZE
  });

  return collectPagedAdsDetailItems(shopId, regionId, {
    ...options,
    pageSize: payloadBuilder.pageSize,
    buildPayload: payloadBuilder.buildPayload,
    reasonPrefix: 'ads-detail-paused',
    failureLabel: 'paused ads_detail',
    shouldContinue: (items) => shouldContinueAdsDetailPaging(items, {
      sortBy: ADS_DETAIL_SORT_BY_PAUSED_STATUS
    })
  });
}

async function fetchAdsDetailItemsForRegion(shopId, regionId, firstResponse, options = {}) {
  const normalizedRegionId = normalizeText(regionId);
  const postWithRegionCookie = getPostWithRegionCookie(options);
  const spendThreshold = Number.isFinite(Number(options.spendThreshold))
    ? Number(options.spendThreshold)
    : null;

  if (options.pausedOnly === true) {
    const pausedItems = await fetchPausedAdsDetailItemsForRegion(shopId, normalizedRegionId, {
      firstResponse,
      listId: options.listId,
      requestPayload: options.requestPayload,
      firstRequestPayload: options.firstRequestPayload,
      postWithRegionCookie
    });

    return mergeAdsDetailItemLists([
      pausedItems.map((item) => ({
        ...item,
        isPaused: true
      }))
    ], normalizedRegionId);
  }

  const childOrderSortedItems = await fetchAdsDetailItemsBySortForRegion(shopId, normalizedRegionId, {
    sortBy: ADS_DETAIL_SORT_BY_CHILD_ORDER_COUNT,
    firstResponse,
    listId: options.listId,
    requestPayload: options.requestPayload,
    firstRequestPayload: options.firstRequestPayload,
    postWithRegionCookie
  });
  const itemLists = [childOrderSortedItems];

  if (spendThreshold !== null) {
    const totalSpendSortedItems = await fetchAdsDetailItemsBySortForRegion(shopId, normalizedRegionId, {
      sortBy: ADS_DETAIL_SORT_BY_TOTAL_SPEND,
      spendThreshold,
      postWithRegionCookie
    });

    itemLists.push(totalSpendSortedItems);
  }

  return mergeAdsDetailItemLists(itemLists, normalizedRegionId);
}

module.exports = {
  ADS_DETAIL_URL,
  ADS_DETAIL_MAX_PAGES,
  ADS_DETAIL_PAUSED_STATUS_CODE,
  extractIntegerByAliases,
  extractBooleanByAliases,
  normalizeAdsDetailItem,
  extractAdsDetailItems,
  resolveAdsDetailProductCount,
  detectAdsDetailHasMore,
  shouldContinueAdsDetailPaging,
  mergeAdsDetailItemLists,
  buildAdsDetailRequestFailureMessage,
  fetchAdsDetailItemsBySortForRegion,
  fetchPausedAdsDetailItemsForRegion,
  fetchAdsDetailItemsForRegion
};
