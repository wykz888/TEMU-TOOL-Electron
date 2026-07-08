const { normalizeText } = require('../shopManagement/common');

function normalizeCostSpecSegmentText(specSegmentText) {
  return normalizeText(specSegmentText)
    .replace(/\s+/g, ' ')
    .replace(/[\uff1a\u0156\u0113\u951b\u6b56]/g, ':')
    .replace(/(\d+)\s*pcs?\b/gi, '$1pc')
    .replace(/\s*:\s*/g, ':');
}

function buildNormalizedSpecSegments(specText) {
  return Array.from(new Set(
    normalizeText(specText)
      .split(/[|,\uff0c]/)
      .map((segment) => normalizeCostSpecSegmentText(segment))
      .filter(Boolean)
  ));
}

function normalizeCostSpecText(specText) {
  const segments = buildNormalizedSpecSegments(specText);
  return segments.length > 0
    ? segments.join('\uff0c')
    : normalizeText(specText);
}

function buildCostLookupKey(parts) {
  const normalizedParts = (Array.isArray(parts) ? parts : [])
    .map((part) => normalizeText(part).toLowerCase());

  if (normalizedParts.length <= 0 || normalizedParts.some((part) => !part)) {
    return '';
  }

  return normalizedParts.join('\x1f');
}

function resolveNormalizedStationIds(source = {}) {
  return Array.from(new Set(
    []
      .concat(Array.isArray(source && source.stationIds) ? source.stationIds : [])
      .concat(Array.isArray(source && source.siteIds) ? source.siteIds : [])
      .map((stationId) => normalizeText(stationId))
      .filter(Boolean)
  ));
}

function normalizeCostIdentity(source = {}) {
  const stationIds = resolveNormalizedStationIds(source);
  const station = normalizeText(
    source && (
      source.station
      || source.siteId
      || source.stationId
      || source.semiOrderSiteId
      || stationIds[0]
      || source.stationLabel
      || source.siteName
    )
  );
  const spec = normalizeCostSpecText(source && (source.spec || source.skuAttributeSet));
  const specAliases = Array.from(new Set(
    []
      .concat(Array.isArray(source && source.specAliases) ? source.specAliases : [])
      .concat(source && source.legacySpec ? [source.legacySpec] : [])
      .concat(
        source
        && source.skuAttributeSet
        && normalizeText(source.skuAttributeSet).toLowerCase() !== spec.toLowerCase()
          ? [source.skuAttributeSet]
          : []
      )
      .map((aliasSpec) => normalizeCostSpecText(aliasSpec))
      .filter(Boolean)
  )).filter((aliasSpec) => aliasSpec.toLowerCase() !== spec.toLowerCase());

  return {
    shopId: normalizeText(source && source.shopId),
    shopName: normalizeText(source && source.shopName),
    station,
    stationLabel: normalizeText(source && (source.stationLabel || source.siteName)),
    stationIds,
    category: normalizeText(source && (source.category || source.categoryId || source.leafCategoryId)),
    categoryLabel: normalizeText(source && (source.categoryLabel || source.leafCategoryName)),
    categoryTrail: normalizeText(source && source.categoryTrail),
    skuId: normalizeText(source && (source.skuId || source.productSkuId || source.goodsSkuId)),
    skuCode: normalizeText(source && source.skuCode) || normalizeText(source && source.skuExtCode),
    skcId: normalizeText(source && source.skcId),
    skcCode: normalizeText(source && source.skcCode),
    spec,
    specAliases
  };
}

function buildCostLookupCandidateParts(source = {}) {
  const identity = normalizeCostIdentity(source);
  const specVariants = [];
  const seenSpecKeys = new Set();

  [identity.spec]
    .concat(Array.isArray(identity.specAliases) ? identity.specAliases : [])
    .forEach((specVariant) => {
      const normalizedSpec = normalizeText(specVariant);
      const specKey = normalizedSpec.toLowerCase();

      if (!specKey || seenSpecKeys.has(specKey)) {
        return;
      }

      seenSpecKeys.add(specKey);
      specVariants.push(normalizedSpec);
    });

  const candidateParts = [
    ['sku-id-station', identity.shopId, identity.station, identity.skuId],
    ['sku-id', identity.shopId, identity.skuId]
  ];

  specVariants.forEach((specVariant) => {
    // Preferred shared-cost scopes: shop + station + category + spec, then shop + station + spec.
    candidateParts.push(
      ['shop-category-spec-station', identity.shopId, identity.station, identity.category, specVariant],
      ['shop-spec-station', identity.shopId, identity.station, specVariant],
      ['skc-id-sku-code-spec-station', identity.shopId, identity.station, identity.skcId, identity.skuCode, specVariant],
      ['skc-id-sku-code-spec', identity.shopId, identity.skcId, identity.skuCode, specVariant],
      ['skc-code-sku-code-spec-station', identity.shopId, identity.station, identity.skcCode, identity.skuCode, specVariant],
      ['skc-code-sku-code-spec', identity.shopId, identity.skcCode, identity.skuCode, specVariant],
      ['sku-code-spec-station', identity.shopId, identity.station, identity.skuCode, specVariant],
      ['sku-code-spec', identity.shopId, identity.skuCode, specVariant],
      ['skc-id-spec-station', identity.shopId, identity.station, identity.skcId, specVariant],
      ['skc-id-spec', identity.shopId, identity.skcId, specVariant],
      ['skc-code-spec-station', identity.shopId, identity.station, identity.skcCode, specVariant],
      ['skc-code-spec', identity.shopId, identity.skcCode, specVariant],
      ['shop-category-spec', identity.shopId, identity.category, specVariant],
      ['shop-spec', identity.shopId, specVariant]
    );
  });

  return candidateParts;
}

function buildCostLookupCandidates(source = {}) {
  return buildCostLookupCandidateParts(source)
    .map((parts) => buildCostLookupKey(parts))
    .filter(Boolean);
}

function buildCostPrimaryKey(source = {}) {
  const candidates = buildCostLookupCandidates(source);
  return candidates[0] || '';
}

module.exports = {
  buildCostLookupKey,
  buildCostLookupCandidateParts,
  buildCostLookupCandidates,
  buildCostPrimaryKey,
  normalizeCostIdentity,
  normalizeCostSpecSegmentText,
  buildNormalizedSpecSegments,
  normalizeCostSpecText
};
