import {
  BUDGET_MODE_CUSTOM,
  BUDGET_MODE_UNLIMITED,
  FAST_START_MODE_OFF,
  FAST_START_MODE_ON,
  ROAS_MODE_CUSTOM,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_STRONG,
  ROAS_MODE_WEAK,
  createEmptyGoodsFilterState,
  normalizeGoodsFilterState
} from '../view-models/createPromotionGoodsRows.js';

export const CREATE_PROMOTION_REGION_IDS = Object.freeze(['us', 'eu', 'global']);

const BUDGET_MODE_IDS = Object.freeze([
  BUDGET_MODE_UNLIMITED,
  BUDGET_MODE_CUSTOM
]);
const ROAS_MODE_IDS = Object.freeze([
  ROAS_MODE_STRONG,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_WEAK,
  ROAS_MODE_CUSTOM
]);
const FAST_START_MODE_IDS = Object.freeze([
  FAST_START_MODE_OFF,
  FAST_START_MODE_ON
]);

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

function normalizeMode(value, validValues, fallback) {
  const normalizedValue = normalizeText(value);

  return validValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

export function normalizeBatchSettings(settings = {}) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings
    : {};

  return {
    budgetMode: normalizeMode(source.budgetMode, BUDGET_MODE_IDS, BUDGET_MODE_UNLIMITED),
    roasMode: normalizeMode(source.roasMode, ROAS_MODE_IDS, ROAS_MODE_STRONG),
    fastStartMode: normalizeMode(source.fastStartMode, FAST_START_MODE_IDS, FAST_START_MODE_OFF),
    customBudget: normalizeOptionalNumber(source.customBudget),
    customRoas: normalizeOptionalNumber(source.customRoas)
  };
}

export function resolveFeatureCenterBridge() {
  return window.temuApp && window.temuApp.featureCenter
    ? window.temuApp.featureCenter
    : null;
}

export function buildCreatePromotionSettingsPayload(settings = {}) {
  return {
    createPromotion: {
      selectedShopIds: normalizeTextList(settings.selectedShopIds),
      selectedRegionIds: normalizeRegionIdList(settings.selectedRegionIds),
      goodsFilterDraft: normalizeGoodsFilterState(settings.goodsFilterDraft),
      appliedGoodsFilters: normalizeGoodsFilterState(settings.appliedGoodsFilters),
      batchSettings: normalizeBatchSettings(settings.batchSettings)
    }
  };
}

export async function loadCreatePromotionSettings(featureCenterBridge = resolveFeatureCenterBridge()) {
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
    selectedRegionIds: normalizeRegionIdList(settings.selectedRegionIds || settings.regionIds),
    goodsFilterDraft: normalizeGoodsFilterState(settings.goodsFilterDraft || settings.goodsFilters),
    appliedGoodsFilters: normalizeGoodsFilterState(settings.appliedGoodsFilters || settings.goodsFilters),
    batchSettings: normalizeBatchSettings(settings.batchSettings)
  };
}

export async function saveCreatePromotionSettings(
  settings,
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const bridge = featureCenterBridge && featureCenterBridge.savePromotionManagerNewCreateSettings;

  if (typeof bridge !== 'function') {
    return null;
  }

  return bridge(buildCreatePromotionSettingsPayload(settings));
}

export async function loadCreatePromotionSelection(featureCenterBridge = resolveFeatureCenterBridge()) {
  const settings = await loadCreatePromotionSettings(featureCenterBridge);

  if (!settings) {
    return null;
  }

  return {
    selectedShopIds: settings.selectedShopIds,
    selectedRegionIds: settings.selectedRegionIds
  };
}

export async function saveCreatePromotionSelection(
  selection,
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  return saveCreatePromotionSettings(selection, featureCenterBridge);
}

export function createDefaultCreatePromotionSettings() {
  return {
    selectedShopIds: [],
    selectedRegionIds: [],
    goodsFilterDraft: createEmptyGoodsFilterState(),
    appliedGoodsFilters: createEmptyGoodsFilterState(),
    batchSettings: normalizeBatchSettings()
  };
}
