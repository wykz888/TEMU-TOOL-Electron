const { normalizeText } = require('../shopManagement/common');

const SETTINGS_VERSION = 3;

const REGION_IDS = Object.freeze(['us', 'eu', 'global']);
const BUDGET_MODE_UNLIMITED = 'unlimited';
const BUDGET_MODE_CUSTOM = 'custom';
const ROAS_MODE_STRONG = 'strong';
const ROAS_MODE_MEDIUM = 'medium';
const ROAS_MODE_WEAK = 'weak';
const ROAS_MODE_CUSTOM = 'custom';
const ROAS_MODE_ESTIMATED_CHARGE = 'estimated_charge';
const ROAS_MODE_ESTIMATED_RATIO = 'estimated_ratio';
const FAST_START_MODE_OFF = 'off';
const FAST_START_MODE_ON = 'on';

const BUDGET_MODE_IDS = Object.freeze([
  BUDGET_MODE_UNLIMITED,
  BUDGET_MODE_CUSTOM
]);
const ROAS_MODE_IDS = Object.freeze([
  ROAS_MODE_STRONG,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_WEAK,
  ROAS_MODE_CUSTOM,
  ROAS_MODE_ESTIMATED_CHARGE,
  ROAS_MODE_ESTIMATED_RATIO
]);
const FAST_START_MODE_IDS = Object.freeze([
  FAST_START_MODE_OFF,
  FAST_START_MODE_ON
]);

function normalizeUniqueTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeRegionIds(values) {
  return normalizeUniqueTextList(values)
    .filter((regionId) => REGION_IDS.includes(regionId));
}

function normalizeFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeOptionalPositiveNumber(value) {
  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function normalizeRangeNumbers(minValue, maxValue) {
  const minNumber = normalizeFiniteNumber(minValue);
  const maxNumber = normalizeFiniteNumber(maxValue);

  if (minNumber === 0 && maxNumber === 0) {
    return {
      min: null,
      max: null
    };
  }

  if (minNumber !== null && maxNumber !== null && minNumber > maxNumber) {
    return {
      min: maxNumber,
      max: minNumber
    };
  }

  return {
    min: minNumber,
    max: maxNumber
  };
}

function normalizeMode(value, validValues, fallback) {
  const normalizedValue = normalizeText(value);

  return validValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function createEmptyGoodsFilterState() {
  return {
    identityText: '',
    shopValues: [],
    categoryValues: [],
    siteValues: [],
    priceMin: null,
    priceMax: null,
    salesMin: null,
    salesMax: null,
    createdRange: []
  };
}

function normalizeDateRange(values) {
  return (Array.isArray(values) ? values : [])
    .slice(0, 2)
    .map(normalizeText)
    .filter(Boolean);
}

function normalizeGoodsFilterState(filters) {
  const source = filters && typeof filters === 'object' && !Array.isArray(filters)
    ? filters
    : {};
  const priceRange = normalizeRangeNumbers(source.priceMin, source.priceMax);
  const salesRange = normalizeRangeNumbers(source.salesMin, source.salesMax);

  return {
    identityText: normalizeText(source.identityText),
    shopValues: normalizeUniqueTextList(source.shopValues),
    categoryValues: normalizeUniqueTextList(source.categoryValues),
    siteValues: normalizeUniqueTextList(source.siteValues),
    priceMin: priceRange.min,
    priceMax: priceRange.max,
    salesMin: salesRange.min,
    salesMax: salesRange.max,
    createdRange: normalizeDateRange(source.createdRange)
  };
}

function normalizeBatchSettings(settings) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings
    : {};

  return {
    budgetMode: normalizeMode(source.budgetMode, BUDGET_MODE_IDS, BUDGET_MODE_UNLIMITED),
    roasMode: normalizeMode(source.roasMode, ROAS_MODE_IDS, ROAS_MODE_STRONG),
    fastStartMode: normalizeMode(source.fastStartMode, FAST_START_MODE_IDS, FAST_START_MODE_OFF),
    customBudget: normalizeOptionalPositiveNumber(source.customBudget),
    customRoas: normalizeOptionalPositiveNumber(source.customRoas),
    estimatedCharge: normalizeOptionalPositiveNumber(source.estimatedCharge),
    estimatedRatio: normalizeOptionalPositiveNumber(source.estimatedRatio)
  };
}

function buildDefaultSettings(owner) {
  return {
    version: SETTINGS_VERSION,
    owner: owner ? {
      userId: owner.userId,
      username: owner.username,
      userKey: owner.userKey
    } : null,
    updatedAt: new Date().toISOString(),
    createPromotion: {
      selectedShopIds: [],
      selectedRegionIds: [],
      goodsFilterDraft: createEmptyGoodsFilterState(),
      appliedGoodsFilters: createEmptyGoodsFilterState(),
      batchSettings: normalizeBatchSettings()
    }
  };
}

function normalizeCreatePromotionSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const legacyGoodsFilters = source.goodsFilters || null;

  return {
    selectedShopIds: normalizeUniqueTextList(source.selectedShopIds || source.shopIds),
    selectedRegionIds: normalizeRegionIds(source.selectedRegionIds || source.regionIds),
    goodsFilterDraft: normalizeGoodsFilterState(source.goodsFilterDraft || legacyGoodsFilters),
    appliedGoodsFilters: normalizeGoodsFilterState(source.appliedGoodsFilters || legacyGoodsFilters),
    batchSettings: normalizeBatchSettings(source.batchSettings)
  };
}

function normalizeSettingsPayload(payload, owner) {
  const defaults = buildDefaultSettings(owner);
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};

  return {
    ...defaults,
    ...source,
    version: SETTINGS_VERSION,
    owner: defaults.owner,
    updatedAt: normalizeText(source.updatedAt) || defaults.updatedAt,
    createPromotion: normalizeCreatePromotionSettings(source.createPromotion)
  };
}

module.exports = {
  SETTINGS_VERSION,
  REGION_IDS,
  buildDefaultSettings,
  createEmptyGoodsFilterState,
  normalizeBatchSettings,
  normalizeCreatePromotionSettings,
  normalizeGoodsFilterState,
  normalizeSettingsPayload
};
