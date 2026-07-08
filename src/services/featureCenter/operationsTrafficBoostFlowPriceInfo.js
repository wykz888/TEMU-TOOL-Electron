const { normalizeText } = require('../shopManagement/common');

function normalizeScalarValue(value) {
  return value === null || value === undefined ? '' : value;
}

function buildFlowPriceInfoKey(productId, siteId) {
  return `${normalizeText(siteId)}:${normalizeText(productId)}`;
}

function buildFlowPriceInfoSpecList(specList) {
  return (Array.isArray(specList) ? specList : [])
    .map((specItem) => ({
      name: normalizeText(specItem && specItem.name),
      value: normalizeText(specItem && specItem.value)
    }))
    .filter((specItem) => specItem.name || specItem.value);
}

function buildFlowPriceInfoSpecText(specList) {
  return buildFlowPriceInfoSpecList(specList)
    .map((specItem) => {
      if (specItem.name && specItem.value) {
        return `${specItem.name}: ${specItem.value}`;
      }

      return specItem.value || specItem.name;
    })
    .filter(Boolean)
    .join(' | ');
}

function buildFlowPriceInfoSpecAliases(specList) {
  const normalizedSpecList = buildFlowPriceInfoSpecList(specList);
  const primarySpecText = buildFlowPriceInfoSpecText(normalizedSpecList);
  const aliasSet = new Set();
  const valueList = normalizedSpecList
    .map((specItem) => normalizeText(specItem && specItem.value))
    .filter(Boolean);

  if (normalizedSpecList.length > 0) {
    aliasSet.add(
      normalizedSpecList
        .map((specItem) => {
          if (specItem.name && specItem.value) {
            return `${specItem.name}:${specItem.value}`;
          }

          return specItem.value || specItem.name;
        })
        .filter(Boolean)
        .join('\uff0c')
    );
  }

  if (valueList.length > 0) {
    aliasSet.add(valueList.join('-'));
    aliasSet.add(valueList.join('\uff0c'));
  }

  return Array.from(aliasSet.values())
    .map((aliasText) => normalizeText(aliasText))
    .filter((aliasText) => aliasText && aliasText.toLowerCase() !== normalizeText(primarySpecText).toLowerCase());
}

function normalizeFlowPriceInfoSku(skuItem, fallbackSpecList = [], options = {}) {
  const source = skuItem && typeof skuItem === 'object' ? skuItem : {};
  const resolvedSpecList = Array.isArray(source.specList) && source.specList.length > 0
    ? source.specList
    : fallbackSpecList;
  const normalizedSpecList = buildFlowPriceInfoSpecList(resolvedSpecList);

  return {
    productSkuId: normalizeText(source.productSkuId),
    productSkcId: normalizeText(options && options.productSkcId),
    specList: normalizedSpecList,
    specText: buildFlowPriceInfoSpecText(normalizedSpecList),
    specAliases: buildFlowPriceInfoSpecAliases(normalizedSpecList),
    currencyType: normalizeText(source.currencyType) || 'CNY',
    supplierPrice: normalizeScalarValue(source.supplierPrice),
    ordinaryFlowSupplierPrice: normalizeScalarValue(source.ordinaryFlowSupplierPrice),
    premiumFlowSupplierPrice: normalizeScalarValue(source.premiumFlowSupplierPrice),
    superFlowSupplierPrice: normalizeScalarValue(source.superFlowSupplierPrice),
    customFlowSupplierPrice: normalizeScalarValue(source.customFlowSupplierPrice),
    sourceList: Array.isArray(source.sourceList)
      ? source.sourceList
        .map((value) => normalizeText(value))
        .filter(Boolean)
      : []
  };
}

function normalizeFlowPriceInfoItem(item) {
  const source = item && typeof item === 'object' ? item : {};
  const skuPriceInfoList = [];

  (Array.isArray(source.skcList) ? source.skcList : []).forEach((skcItem) => {
    const fallbackSpecList = Array.isArray(skcItem && skcItem.specList)
      ? skcItem.specList
      : [];
    const productSkcId = normalizeText(skcItem && skcItem.productSkcId);

    (Array.isArray(skcItem && skcItem.skuList) ? skcItem.skuList : []).forEach((skuItem) => {
      skuPriceInfoList.push(normalizeFlowPriceInfoSku(skuItem, fallbackSpecList, {
        productSkcId
      }));
    });
  });

  return {
    productId: normalizeText(source.productId),
    siteId: normalizeText(source.siteId),
    productName: normalizeText(source.productName),
    mainImages: normalizeText(source.mainImages),
    canNotSubmitReason: normalizeText(source.canNotSubmitReason),
    ordinaryFlowIncreaseAbsolute: normalizeScalarValue(source.ordinaryFlowIncreaseAbsolute),
    ordinaryFlowIncreasePercent: normalizeScalarValue(source.ordinaryFlowIncreasePercent),
    premiumFlowIncreaseAbsolute: normalizeScalarValue(source.premiumFlowIncreaseAbsolute),
    premiumFlowIncreasePercent: normalizeScalarValue(source.premiumFlowIncreasePercent),
    superFlowIncreaseAbsolute: normalizeScalarValue(source.superFlowIncreaseAbsolute),
    superFlowIncreasePercent: normalizeScalarValue(source.superFlowIncreasePercent),
    skuPriceInfoList
  };
}

function buildFlowPriceInfoMap(result) {
  const flowPriceInfoMap = new Map();
  const appendItemList = (itemList) => {
    (Array.isArray(itemList) ? itemList : []).forEach((item) => {
      const normalizedItem = normalizeFlowPriceInfoItem(item);
      const itemKey = buildFlowPriceInfoKey(normalizedItem.productId, normalizedItem.siteId);

      if (!itemKey || itemKey === ':') {
        return;
      }

      flowPriceInfoMap.set(itemKey, normalizedItem);
    });
  };

  appendItemList(result && result.canNotSubmitProductList);
  appendItemList(result && result.canSubmitProductList);
  return flowPriceInfoMap;
}

function buildCompactWarningText(warningList, limit = 3) {
  const normalizedList = Array.from(new Set(
    (Array.isArray(warningList) ? warningList : [])
      .map((warning) => normalizeText(warning))
      .filter(Boolean)
  ));

  if (normalizedList.length <= 0) {
    return '';
  }

  if (normalizedList.length <= limit) {
    return normalizedList.join('\uff1b');
  }

  return `${normalizedList.slice(0, limit).join('\uff1b')} \u7b49 ${normalizedList.length} \u9879`;
}

module.exports = {
  buildCompactWarningText,
  buildFlowPriceInfoKey,
  buildFlowPriceInfoMap,
  buildFlowPriceInfoSpecAliases,
  buildFlowPriceInfoSpecList,
  buildFlowPriceInfoSpecText,
  normalizeFlowPriceInfoItem,
  normalizeFlowPriceInfoSku,
  normalizeScalarValue
};
