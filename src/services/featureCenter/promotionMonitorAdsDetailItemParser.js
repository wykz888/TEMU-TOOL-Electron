const { normalizeText } = require('../shopManagement/common');
const {
  COLUMN_VALUE_ALIASES,
  isPlainObject,
  normalizeMetricAlias,
  buildAliasMatcher,
  extractValueCandidate,
  findValueByAlias,
  parseMetricNumber,
  normalizeRoasRawValue,
  normalizeMoneyMetricValue,
  resolveMonitorSummaryValue,
  mapSummaryToMetrics
} = require('./promotionMonitorMetricUtils');

const ADS_DETAIL_PAUSED_STATUS_CODE = 7;
const ADS_DETAIL_RUNNING_STATUS_CODE = 8;
const ADS_MODIFY_STATUS_RESUME = 0;
const ADS_MODIFY_STATUS_PAUSE = 2;

const ADS_DETAIL_ITEM_LIST_KEYS = Object.freeze([
  'ads_detail',
  'list',
  'items',
  'rows',
  'records',
  'record_list',
  'data_list',
  'page_list',
  'goods_list',
  'ad_list'
]);

const ADS_DETAIL_GOODS_ID_ALIASES = Object.freeze([
  'goods_id',
  'goodsId',
  'product_id',
  'productId',
  'item_id',
  'itemId',
  'sku_id',
  'skuId'
]);

const ADS_DETAIL_PRODUCT_NAME_ALIASES = Object.freeze([
  'goods_name',
  'goodsName',
  'product_name',
  'productName',
  'item_name',
  'itemName',
  'product_title',
  'productTitle',
  'goods_title',
  'goodsTitle',
  'title',
  'name'
]);

const ADS_DETAIL_AD_ID_ALIASES = Object.freeze([
  'ad_id',
  'adId',
  'promotion_id',
  'promotionId',
  'plan_id',
  'planId',
  'campaign_id',
  'campaignId'
]);

const ADS_DETAIL_TARGET_ROAS_ALIASES = Object.freeze([
  'target_roas',
  'targetRoas',
  'target_roas_value',
  'targetRoasValue',
  'expect_roas',
  'expectRoas'
]);

const ADS_DETAIL_SHOW_STATUS_ALIASES = Object.freeze([
  'ad_show_status',
  'adShowStatus'
]);

const ADS_DETAIL_STATUS_ALIASES = Object.freeze([
  'status',
  'state',
  'ad_status',
  'ad_state',
  'adStatus',
  'adState',
  'promotion_status',
  'promotion_state',
  'promotionStatus',
  'promotionState',
  'plan_status',
  'plan_state',
  'planStatus',
  'planState',
  'campaign_status',
  'campaign_state',
  'campaignStatus'
]);

const ADS_DETAIL_PAUSED_FLAG_ALIASES = Object.freeze([
  'paused',
  'is_paused',
  'isPaused',
  'pause',
  'pause_status',
  'pauseStatus',
  'is_pause',
  'isPause'
]);

const ADS_DETAIL_STATUS_TEXT_ALIASES = Object.freeze([
  'status_desc',
  'statusDesc',
  'state_desc',
  'stateDesc',
  'status_text',
  'statusText',
  'state_text',
  'stateText',
  'status_label',
  'statusLabel',
  'status_name',
  'statusName',
  'ad_status_desc',
  'adStatusDesc',
  'ad_state_desc',
  'adStateDesc',
  'ad_status_text',
  'adStatusText',
  'ad_state_text',
  'adStateText',
  'ad_status_label',
  'adStatusLabel',
  'ad_state_label',
  'adStateLabel',
  'promotion_status_desc',
  'promotionStatusDesc',
  'promotion_state_desc',
  'promotionStateDesc',
  'promotion_status_text',
  'promotionStatusText',
  'promotion_state_text',
  'promotionStateText',
  'plan_status_desc',
  'planStatusDesc',
  'plan_state_desc',
  'planStateDesc',
  'plan_status_text',
  'planStatusText',
  'plan_state_text',
  'planStateText',
  'campaign_status_desc',
  'campaignStatusDesc',
  'campaign_state_desc',
  'campaignStateDesc',
  'campaign_status_text',
  'campaignStatusText',
  'campaign_state_text',
  'campaignStateText'
]);

const ADS_DETAIL_TOTAL_COUNT_ALIASES = Object.freeze([
  'total',
  'total_goods_num',
  'totalGoodsNum',
  'total_count',
  'totalCount',
  'total_num',
  'totalNum',
  'record_total',
  'recordTotal'
]);

function extractIntegerByAliases(container, aliases, depth = 0) {
  if (depth > 4 || container === null || container === undefined) {
    return null;
  }

  if (Array.isArray(container)) {
    for (const item of container) {
      const nestedValue = extractIntegerByAliases(item, aliases, depth + 1);

      if (nestedValue !== null) {
        return nestedValue;
      }
    }

    return null;
  }

  if (!isPlainObject(container)) {
    return null;
  }

  const aliasMatcher = buildAliasMatcher(aliases);

  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(container, alias)) {
      continue;
    }

    const directValue = parseMetricNumber(container[alias]);

    if (directValue !== null) {
      return Math.round(directValue);
    }
  }

  for (const [key, value] of Object.entries(container)) {
    if (!aliasMatcher.has(normalizeMetricAlias(key))) {
      continue;
    }

    const directValue = parseMetricNumber(value);

    if (directValue !== null) {
      return Math.round(directValue);
    }
  }

  for (const value of Object.values(container)) {
    const nestedValue = extractIntegerByAliases(value, aliases, depth + 1);

    if (nestedValue !== null) {
      return nestedValue;
    }
  }

  return null;
}

function extractBooleanByAliases(container, aliases, depth = 0) {
  if (depth > 4 || container === null || container === undefined) {
    return null;
  }

  if (Array.isArray(container)) {
    for (const item of container) {
      const nestedValue = extractBooleanByAliases(item, aliases, depth + 1);

      if (typeof nestedValue === 'boolean') {
        return nestedValue;
      }
    }

    return null;
  }

  if (!isPlainObject(container)) {
    return null;
  }

  const aliasMatcher = buildAliasMatcher(aliases);

  for (const [key, value] of Object.entries(container)) {
    if (!aliasMatcher.has(normalizeMetricAlias(key))) {
      continue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalizedValue = normalizeText(value).toLowerCase();

    if (normalizedValue === 'true' || normalizedValue === '1') {
      return true;
    }

    if (normalizedValue === 'false' || normalizedValue === '0') {
      return false;
    }
  }

  for (const value of Object.values(container)) {
    const nestedValue = extractBooleanByAliases(value, aliases, depth + 1);

    if (typeof nestedValue === 'boolean') {
      return nestedValue;
    }
  }

  return null;
}

function resolveAdsDetailPausedState(item) {
  if (!isPlainObject(item)) {
    return null;
  }

  const showStatusCode = extractIntegerByAliases(item, ADS_DETAIL_SHOW_STATUS_ALIASES);

  if (showStatusCode !== null) {
    if (showStatusCode === ADS_DETAIL_PAUSED_STATUS_CODE) {
      return true;
    }

    if (showStatusCode === ADS_DETAIL_RUNNING_STATUS_CODE) {
      return false;
    }
  }

  const pausedFlag = extractBooleanByAliases(item, ADS_DETAIL_PAUSED_FLAG_ALIASES);

  if (typeof pausedFlag === 'boolean') {
    return pausedFlag;
  }

  const statusCode = extractIntegerByAliases(item, ADS_DETAIL_STATUS_ALIASES);

  if (statusCode !== null) {
    if (statusCode === ADS_DETAIL_PAUSED_STATUS_CODE || statusCode === ADS_MODIFY_STATUS_PAUSE) {
      return true;
    }

    if (statusCode === ADS_DETAIL_RUNNING_STATUS_CODE || statusCode === ADS_MODIFY_STATUS_RESUME || statusCode === 1) {
      return false;
    }
  }

  const statusText = normalizeText(
    findValueByAlias(item, ADS_DETAIL_STATUS_TEXT_ALIASES)
    || findValueByAlias(item, ADS_DETAIL_STATUS_ALIASES)
  ).toLowerCase();

  if (!statusText) {
    return null;
  }

  if (
    /\u6682\u505c/.test(statusText)
    || /\u505c\u7528/.test(statusText)
    || /paus(?:e|ed)?/.test(statusText)
    || /suspend(?:ed)?/.test(statusText)
  ) {
    return true;
  }

  if (
    /\u542f\u7528/.test(statusText)
    || /\u6295\u653e/.test(statusText)
    || /running/.test(statusText)
    || /active/.test(statusText)
    || /enabled?/.test(statusText)
  ) {
    return false;
  }

  return null;
}

function collectAdsDetailArrayCandidates(container, candidates, depth = 0) {
  if (depth > 4 || container === null || container === undefined) {
    return;
  }

  if (Array.isArray(container)) {
    candidates.push(container);
    container.forEach((item) => {
      collectAdsDetailArrayCandidates(item, candidates, depth + 1);
    });
    return;
  }

  if (!isPlainObject(container)) {
    return;
  }

  ADS_DETAIL_ITEM_LIST_KEYS.forEach((key) => {
    if (Array.isArray(container[key])) {
      candidates.push(container[key]);
    }
  });

  Object.values(container).forEach((value) => {
    if (isPlainObject(value) || Array.isArray(value)) {
      collectAdsDetailArrayCandidates(value, candidates, depth + 1);
    }
  });
}

function findDirectValueByKeys(container, keys) {
  if (!isPlainObject(container)) {
    return '';
  }

  for (const key of Array.isArray(keys) ? keys : []) {
    if (!Object.prototype.hasOwnProperty.call(container, key)) {
      continue;
    }

    const candidate = extractValueCandidate(container[key]);

    if (candidate) {
      return candidate;
    }
  }

  return '';
}

function resolveAdsDetailTargetRoasText(item) {
  return findDirectValueByKeys(item, [
    'target_roas',
    'targetRoas',
    'target_roas_value',
    'targetRoasValue',
    'expect_roas',
    'expectRoas',
    'roas',
    'roas_str',
    'roasStr'
  ]) || findValueByAlias(item, ADS_DETAIL_TARGET_ROAS_ALIASES);
}

function resolveAdsDetailCurrentRoasText(item) {
  const summary = item && item.summary && typeof item.summary === 'object'
    ? item.summary
    : {};

  return (
    resolveMonitorSummaryValue(summary, 'roas_label')
    || findDirectValueByKeys(item, [
      'real_roas',
      'realRoas',
      'current_roas',
      'currentRoas',
      'overall_roas',
      'overallRoas',
      'overall_roas_str',
      'overallRoasStr'
    ])
  );
}

function resolveAdsDetailSpendText(item) {
  const summary = item && item.summary && typeof item.summary === 'object'
    ? item.summary
    : {};

  return resolveMonitorSummaryValue(summary, 'ad_spend_label')
    || findValueByAlias(item, COLUMN_VALUE_ALIASES.ad_spend_label);
}

function resolveAdsDetailOrderCountText(item) {
  const summary = item && item.summary && typeof item.summary === 'object'
    ? item.summary
    : {};

  return resolveMonitorSummaryValue(summary, 'order_pay_count_label')
    || findValueByAlias(item, COLUMN_VALUE_ALIASES.order_pay_count_label);
}

function normalizeAdsDetailSiteNames(item) {
  const sourceValues = Array.isArray(item && item.site_name_list)
    ? item.site_name_list
    : [];

  return sourceValues.map((value) => normalizeText(value)).filter(Boolean);
}

function normalizeOptionalFlag(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue === 1 : null;
}

function resolveAdsDetailFastStartEnabled(item) {
  const info = item && item.fast_start_info && typeof item.fast_start_info === 'object'
    ? item.fast_start_info
    : {};
  const candidates = [
    info.active,
    item && item.fast_start_state,
    item && item.fast_start_enable,
    info.enable,
    info.state
  ];

  for (const candidate of candidates) {
    const flag = normalizeOptionalFlag(candidate);

    if (typeof flag === 'boolean') {
      return flag;
    }
  }

  return false;
}

function normalizeAdsDetailItem(item, regionId) {
  if (!isPlainObject(item)) {
    return null;
  }

  const goodsId = normalizeText(findValueByAlias(item, ADS_DETAIL_GOODS_ID_ALIASES));
  const adId = normalizeText(findValueByAlias(item, ADS_DETAIL_AD_ID_ALIASES));
  const productName = normalizeText(findValueByAlias(item, ADS_DETAIL_PRODUCT_NAME_ALIASES));
  const summary = item.summary && typeof item.summary === 'object' ? item.summary : {};
  const currentRoasText = resolveAdsDetailCurrentRoasText(item);
  const targetRoasText = resolveAdsDetailTargetRoasText(item);

  if (!goodsId && !adId) {
    return null;
  }

  return {
    regionId: normalizeText(regionId),
    goodsId,
    adId,
    productName,
    productImageUrl: normalizeText(findDirectValueByKeys(item, ['goods_image_url', 'goodsImageUrl', 'image_url', 'imageUrl'])),
    siteNames: normalizeAdsDetailSiteNames(item),
    budget: parseMetricNumber(findDirectValueByKeys(item, ['budget'])),
    budgetText: findDirectValueByKeys(item, ['budget_str', 'budgetStr']),
    adSpend: normalizeMoneyMetricValue(resolveAdsDetailSpendText(item)),
    orderCount: parseMetricNumber(resolveAdsDetailOrderCountText(item)) || 0,
    currentRoasRaw: normalizeRoasRawValue(currentRoasText),
    currentRoasText: normalizeText(currentRoasText),
    targetRoasRaw: normalizeRoasRawValue(targetRoasText),
    targetRoasText: normalizeText(targetRoasText),
    fastStartEnabled: resolveAdsDetailFastStartEnabled(item),
    summary: mapSummaryToMetrics(summary),
    isPaused: resolveAdsDetailPausedState(item),
    raw: item
  };
}

function extractAdsDetailItems(payload, regionId) {
  const candidates = [];
  const roots = [
    payload && payload.result,
    payload && payload.data,
    payload
  ];
  let bestItems = [];

  roots.forEach((root) => {
    collectAdsDetailArrayCandidates(root, candidates);
  });

  candidates.forEach((candidateArray) => {
    const items = candidateArray
      .map((item) => normalizeAdsDetailItem(item, regionId))
      .filter(Boolean);

    if (items.length > bestItems.length) {
      bestItems = items;
    }
  });

  return bestItems;
}

function resolveAdsDetailProductCount(payload, regionId) {
  const responseData = payload && typeof payload === 'object' ? payload : {};
  const resultData = responseData.result && typeof responseData.result === 'object'
    ? responseData.result
    : {};
  const totalCount = extractIntegerByAliases(
    { ...responseData, ...resultData },
    ADS_DETAIL_TOTAL_COUNT_ALIASES
  );

  if (totalCount !== null) {
    return Math.max(0, totalCount);
  }

  return extractAdsDetailItems(responseData, regionId).length;
}

function buildAdsDetailItemKey(item, fallbackRegionId = '') {
  const resolvedRegionId = normalizeText(item && item.regionId) || normalizeText(fallbackRegionId);
  const goodsId = normalizeText(item && item.goodsId);
  const adId = normalizeText(item && item.adId);

  return [resolvedRegionId || 'all', goodsId || '-', adId || '-'].join('::');
}

function mergeAdsDetailItem(left, right) {
  const previousItem = left && typeof left === 'object' ? left : null;
  const nextItem = right && typeof right === 'object' ? right : null;

  if (!previousItem) {
    return nextItem;
  }

  if (!nextItem) {
    return previousItem;
  }

  return {
    regionId: normalizeText(nextItem.regionId) || normalizeText(previousItem.regionId),
    goodsId: normalizeText(nextItem.goodsId) || normalizeText(previousItem.goodsId),
    adId: normalizeText(nextItem.adId) || normalizeText(previousItem.adId),
    productName: normalizeText(nextItem.productName) || normalizeText(previousItem.productName),
    productImageUrl: normalizeText(nextItem.productImageUrl) || normalizeText(previousItem.productImageUrl),
    siteNames: Array.isArray(nextItem.siteNames) && nextItem.siteNames.length > 0
      ? nextItem.siteNames.slice()
      : (Array.isArray(previousItem.siteNames) ? previousItem.siteNames.slice() : []),
    budget: nextItem.budget !== null && nextItem.budget !== undefined
      ? nextItem.budget
      : previousItem.budget,
    budgetText: normalizeText(nextItem.budgetText) || normalizeText(previousItem.budgetText),
    adSpend: typeof nextItem.adSpend === 'number' && Number.isFinite(nextItem.adSpend)
      ? nextItem.adSpend
      : previousItem.adSpend,
    orderCount: Math.max(
      0,
      Number(nextItem.orderCount) || 0,
      Number(previousItem.orderCount) || 0
    ),
    targetRoasRaw: nextItem.targetRoasRaw !== null && nextItem.targetRoasRaw !== undefined
      ? nextItem.targetRoasRaw
      : previousItem.targetRoasRaw,
    currentRoasRaw: nextItem.currentRoasRaw !== null && nextItem.currentRoasRaw !== undefined
      ? nextItem.currentRoasRaw
      : previousItem.currentRoasRaw,
    currentRoasText: normalizeText(nextItem.currentRoasText) || normalizeText(previousItem.currentRoasText),
    targetRoasText: normalizeText(nextItem.targetRoasText) || normalizeText(previousItem.targetRoasText),
    fastStartEnabled: typeof nextItem.fastStartEnabled === 'boolean'
      ? nextItem.fastStartEnabled
      : previousItem.fastStartEnabled,
    summary: nextItem.summary && typeof nextItem.summary === 'object'
      ? { ...nextItem.summary }
      : (previousItem.summary && typeof previousItem.summary === 'object' ? { ...previousItem.summary } : {}),
    isPaused: typeof nextItem.isPaused === 'boolean'
      ? nextItem.isPaused
      : previousItem.isPaused,
    raw: nextItem.raw || previousItem.raw
  };
}

function mergeAdsDetailItemLists(itemLists, fallbackRegionId = '') {
  const mergedItemMap = new Map();

  (Array.isArray(itemLists) ? itemLists : []).forEach((items) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      const itemKey = buildAdsDetailItemKey(item, fallbackRegionId);

      if (!mergedItemMap.has(itemKey)) {
        mergedItemMap.set(itemKey, item);
        return;
      }

      mergedItemMap.set(itemKey, mergeAdsDetailItem(mergedItemMap.get(itemKey), item));
    });
  });

  return Array.from(mergedItemMap.values());
}

module.exports = {
  ADS_DETAIL_PAUSED_STATUS_CODE,
  ADS_DETAIL_TOTAL_COUNT_ALIASES,
  extractIntegerByAliases,
  extractBooleanByAliases,
  normalizeAdsDetailItem,
  extractAdsDetailItems,
  resolveAdsDetailProductCount,
  mergeAdsDetailItemLists
};
