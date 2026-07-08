const { normalizeText } = require('../shopManagement/common');

const DEFAULT_TRAFFIC_BOOST_SUBMIT_BATCH_SIZE = 30;
const DEFAULT_MARKET_REGION = 'us';
const MARKET_REGIONS = Object.freeze(['global', 'us', 'eu']);

function normalizeIntegerValue(value, fallback = 0) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeBooleanSetting(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

function normalizeMarketRegion(value) {
  const normalizedValue = normalizeText(value).toLowerCase();
  return MARKET_REGIONS.includes(normalizedValue)
    ? normalizedValue
    : DEFAULT_MARKET_REGION;
}

function normalizeTrafficBoostSubmitDays(value) {
  const normalizedValue = normalizeIntegerValue(value, 0);
  return [7, 14, 30, -1].includes(normalizedValue) ? normalizedValue : 7;
}

function normalizeTrafficBoostSubmitBatchSize(value) {
  const normalizedValue = normalizeIntegerValue(value, DEFAULT_TRAFFIC_BOOST_SUBMIT_BATCH_SIZE);
  return Math.max(1, Math.min(30, normalizedValue || DEFAULT_TRAFFIC_BOOST_SUBMIT_BATCH_SIZE));
}

function normalizeTrafficBoostSubmitLevel(value) {
  const normalizedValue = normalizeIntegerValue(value, 0);
  return [1, 2, 3, 4].includes(normalizedValue) ? normalizedValue : 1;
}

function buildTrafficBoostSubmitProductKey(productId, siteId) {
  return `${normalizeText(siteId)}:${normalizeText(productId)}`;
}

function normalizeTrafficBoostSubmitSkuPriceItem(source = {}) {
  const productSkuId = normalizeIntegerValue(source.productSkuId, 0);
  const supplierPrice = normalizeIntegerValue(source.supplierPrice, 0);
  const preSupplierPrice = normalizeIntegerValue(source.preSupplierPrice, 0);
  const targetSupplierPrice = normalizeIntegerValue(source.targetSupplierPrice, 0);
  const customFlowSupplierPrice = normalizeIntegerValue(source.customFlowSupplierPrice, targetSupplierPrice);

  if (productSkuId <= 0 || supplierPrice <= 0) {
    return null;
  }

  const normalizedItem = {
    productSkuId,
    supplierPrice,
    currencyType: normalizeText(source.currencyType) || 'CNY'
  };

  if (preSupplierPrice > 0) {
    normalizedItem.preSupplierPrice = preSupplierPrice;
  }

  if (customFlowSupplierPrice > 0) {
    normalizedItem.customFlowSupplierPrice = customFlowSupplierPrice;
  }

  if (targetSupplierPrice > 0) {
    normalizedItem.targetSupplierPrice = targetSupplierPrice;
  }

  return normalizedItem;
}

function normalizeTrafficBoostSubmitProductItem(source = {}) {
  const shopId = normalizeText(source.shopId);
  const shopName = normalizeText(source.shopName);
  const marketRegion = normalizeMarketRegion(source.marketRegion);
  const siteId = normalizeIntegerValue(source.siteId, 0);
  const productId = normalizeIntegerValue(source.productId, 0);
  const productName = normalizeText(source.productName);
  const skuPriceList = Array.from(new Map(
    (Array.isArray(source.skuPriceList) ? source.skuPriceList : [])
      .map((skuItem) => normalizeTrafficBoostSubmitSkuPriceItem(skuItem))
      .filter(Boolean)
      .map((skuItem) => [normalizeText(skuItem.productSkuId), skuItem])
  ).values());
  const submittedProductSkuIdSet = new Set(
    skuPriceList
      .map((skuItem) => normalizeText(skuItem && skuItem.productSkuId))
      .filter(Boolean)
  );
  const sourceExpectedProductSkuIdList = (Array.isArray(source.expectedProductSkuIdList)
    ? source.expectedProductSkuIdList
    : []
  )
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const expectedProductSkuIdList = Array.from(new Set(
    (sourceExpectedProductSkuIdList.length > 0
      ? sourceExpectedProductSkuIdList
      : Array.from(submittedProductSkuIdSet)
    )
      .map((value) => normalizeText(value))
      .filter(Boolean)
  ));
  const sourceProductSkuIdList = Array.from(new Set(
    (Array.isArray(source.sourceProductSkuIdList)
      ? source.sourceProductSkuIdList
      : (Array.isArray(source.productSkuIdList) ? source.productSkuIdList : [])
    )
      .map((value) => normalizeText(value))
      .filter(Boolean)
  ));

  if (!shopId || siteId <= 0 || productId <= 0 || skuPriceList.length <= 0) {
    return null;
  }

  return {
    shopId,
    shopName,
    marketRegion,
    siteId,
    productId,
    productName,
    isAutoRenew: normalizeBooleanSetting(source.isAutoRenew, false),
    increaseFlowLevel: normalizeTrafficBoostSubmitLevel(source.increaseFlowLevel),
    increaseFlowDays: normalizeTrafficBoostSubmitDays(source.increaseFlowDays),
    expectedProductSkuIdList,
    sourceProductSkuIdList,
    forceSkuDetailHydrate: normalizeBooleanSetting(source.forceSkuDetailHydrate, false),
    skuPriceList
  };
}

function normalizeFlowPriceSubmitSkuForRequest(skuItem, selectedLevel) {
  const productSkuId = normalizeIntegerValue(skuItem && skuItem.productSkuId, 0);
  const supplierPrice = normalizeIntegerValue(skuItem && skuItem.supplierPrice, 0);
  const preSupplierPrice = normalizeIntegerValue(skuItem && skuItem.preSupplierPrice, 0);
  const selectedLevelValue = normalizeTrafficBoostSubmitLevel(selectedLevel);
  const customFlowSupplierPrice = normalizeIntegerValue(
    skuItem && skuItem.customFlowSupplierPrice,
    0
  );
  const oldCustomTargetSupplierPrice = selectedLevelValue === 4
    && preSupplierPrice > 0
    && supplierPrice > 0
    && preSupplierPrice !== supplierPrice
    ? supplierPrice
    : 0;
  const targetSupplierPrice = normalizeIntegerValue(skuItem && skuItem.targetSupplierPrice, 0)
    || customFlowSupplierPrice;
  const normalizedTargetSupplierPrice = targetSupplierPrice || oldCustomTargetSupplierPrice;
  const requestSupplierPrice = selectedLevelValue === 4 && oldCustomTargetSupplierPrice > 0
    ? preSupplierPrice
    : supplierPrice;

  if (productSkuId <= 0 || requestSupplierPrice <= 0) {
    return null;
  }

  if (selectedLevelValue === 4 && normalizedTargetSupplierPrice <= 0) {
    return null;
  }

  const normalizedSkuItem = {
    productSkuId,
    supplierPrice: requestSupplierPrice,
    currencyType: normalizeText(skuItem && skuItem.currencyType) || 'CNY'
  };

  if (preSupplierPrice > 0) {
    normalizedSkuItem.preSupplierPrice = preSupplierPrice;
  } else if (selectedLevelValue === 4) {
    normalizedSkuItem.preSupplierPrice = requestSupplierPrice;
  }

  if (selectedLevelValue === 4) {
    normalizedSkuItem.targetSupplierPrice = normalizedTargetSupplierPrice;
  }

  return normalizedSkuItem;
}

function normalizeFlowPriceSubmitProductForRequest(productItem) {
  const siteId = normalizeIntegerValue(productItem && productItem.siteId, 0);
  const productId = normalizeIntegerValue(productItem && productItem.productId, 0);
  const increaseFlowLevel = normalizeTrafficBoostSubmitLevel(productItem && productItem.increaseFlowLevel);
  const increaseFlowDays = normalizeTrafficBoostSubmitDays(productItem && productItem.increaseFlowDays);
  const skuPriceList = Array.from(new Map(
    (Array.isArray(productItem && productItem.skuPriceList) ? productItem.skuPriceList : [])
      .map((skuItem) => normalizeFlowPriceSubmitSkuForRequest(skuItem, increaseFlowLevel))
      .filter(Boolean)
      .map((skuItem) => [normalizeText(skuItem.productSkuId), skuItem])
  ).values());

  if (siteId <= 0 || productId <= 0 || skuPriceList.length <= 0) {
    return null;
  }

  return {
    ...productItem,
    siteId,
    productId,
    isAutoRenew: normalizeBooleanSetting(productItem && productItem.isAutoRenew, false),
    increaseFlowLevel,
    increaseFlowDays,
    expectedProductSkuIdList: Array.from(new Set(
      (Array.isArray(productItem && productItem.expectedProductSkuIdList)
        ? productItem.expectedProductSkuIdList
        : skuPriceList.map((skuItem) => skuItem && skuItem.productSkuId)
      )
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )),
    sourceProductSkuIdList: Array.from(new Set(
      (Array.isArray(productItem && productItem.sourceProductSkuIdList)
        ? productItem.sourceProductSkuIdList
        : []
      )
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )),
    removedWithoutSkuId: normalizeText(productItem && productItem.removedWithoutSkuId),
    skuPriceList
  };
}

function normalizeFlowPriceSubmitSkuForBatchPayload(skuItem, selectedLevel) {
  const normalizedSkuItem = normalizeFlowPriceSubmitSkuForRequest(skuItem, selectedLevel);
  const selectedLevelValue = normalizeTrafficBoostSubmitLevel(selectedLevel);

  if (!normalizedSkuItem) {
    return null;
  }

  if (selectedLevelValue !== 4) {
    return normalizedSkuItem;
  }

  const targetSupplierPrice = normalizeIntegerValue(normalizedSkuItem.targetSupplierPrice, 0);

  if (targetSupplierPrice <= 0) {
    return null;
  }

  return {
    productSkuId: normalizedSkuItem.productSkuId,
    preSupplierPrice: normalizeIntegerValue(
      normalizedSkuItem.preSupplierPrice,
      normalizeIntegerValue(normalizedSkuItem.supplierPrice, 0)
    ),
    supplierPrice: targetSupplierPrice,
    currencyType: normalizeText(normalizedSkuItem.currencyType) || 'CNY'
  };
}

module.exports = {
  buildTrafficBoostSubmitProductKey,
  normalizeFlowPriceSubmitProductForRequest,
  normalizeFlowPriceSubmitSkuForBatchPayload,
  normalizeFlowPriceSubmitSkuForRequest,
  normalizeTrafficBoostSubmitBatchSize,
  normalizeTrafficBoostSubmitDays,
  normalizeTrafficBoostSubmitLevel,
  normalizeTrafficBoostSubmitProductItem,
  normalizeTrafficBoostSubmitSkuPriceItem
};
