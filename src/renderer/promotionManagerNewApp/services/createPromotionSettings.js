export const CREATE_PROMOTION_REGION_IDS = Object.freeze(['us', 'eu', 'global']);

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function normalizeTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

export function normalizeRegionIdList(values, regionIds = CREATE_PROMOTION_REGION_IDS) {
  const validRegionIds = new Set(Array.isArray(regionIds) ? regionIds : CREATE_PROMOTION_REGION_IDS);

  return normalizeTextList(values).filter((regionId) => validRegionIds.has(regionId));
}

export function resolveFeatureCenterBridge() {
  return window.temuApp && window.temuApp.featureCenter
    ? window.temuApp.featureCenter
    : null;
}

export function buildCreatePromotionSettingsPayload(selection = {}) {
  return {
    createPromotion: {
      selectedShopIds: normalizeTextList(selection.selectedShopIds),
      selectedRegionIds: normalizeRegionIdList(selection.selectedRegionIds)
    }
  };
}

export async function loadCreatePromotionSelection(featureCenterBridge = resolveFeatureCenterBridge()) {
  const bridge = featureCenterBridge && featureCenterBridge.getPromotionManagerNewCreateSettings;

  if (typeof bridge !== 'function') {
    return null;
  }

  const result = await bridge();
  const settings = result && result.settings && result.settings.createPromotion
    ? result.settings.createPromotion
    : {};

  return {
    selectedShopIds: normalizeTextList(settings.selectedShopIds || settings.shopIds),
    selectedRegionIds: normalizeRegionIdList(settings.selectedRegionIds || settings.regionIds)
  };
}

export async function saveCreatePromotionSelection(
  selection,
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const bridge = featureCenterBridge && featureCenterBridge.savePromotionManagerNewCreateSettings;

  if (typeof bridge !== 'function') {
    return null;
  }

  return bridge(buildCreatePromotionSettingsPayload(selection));
}
