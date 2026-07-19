const VALID_REGION_IDS = new Set(['us', 'eu', 'global']);

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function normalizeTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

export function normalizeShopDataRegionIds(values) {
  return normalizeTextList(values).filter((regionId) => VALID_REGION_IDS.has(regionId));
}

export function resolveFeatureCenterBridge() {
  return window.temuApp && window.temuApp.featureCenter
    ? window.temuApp.featureCenter
    : null;
}

export function buildShopDataQueryPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    shopIds: normalizeTextList(source.shopIds),
    regionIds: normalizeShopDataRegionIds(source.regionIds),
    dateRange: Array.isArray(source.dateRange) ? source.dateRange.slice(0, 2).map(normalizeText).filter(Boolean) : [],
    startTime: source.startTime || null,
    endTime: source.endTime || null
  };
}

export async function queryPromotionShopData(
  payload,
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const bridge = featureCenterBridge && featureCenterBridge.queryPromotionManagerNewShopData;

  if (typeof bridge !== 'function') {
    throw new Error('\u5e97\u94fa\u6570\u636e\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d');
  }

  return bridge(buildShopDataQueryPayload(payload));
}
