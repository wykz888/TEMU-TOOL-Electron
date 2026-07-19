import {
  DETAIL_ACTION_OPTIONS,
  DETAIL_ACTION_PAUSE,
  createEmptyPromotionDetailFilterState,
  normalizePromotionDetailFilterState
} from '../view-models/promotionDetailRows.js';
import {
  normalizeRegionIdList,
  normalizeText,
  normalizeTextList,
  resolveFeatureCenterBridge
} from './createPromotionSettings.js';

const DETAIL_ACTION_IDS = Object.freeze(DETAIL_ACTION_OPTIONS.map((option) => option.value));

function normalizeActionType(value) {
  const normalizedValue = normalizeText(value);

  return DETAIL_ACTION_IDS.includes(normalizedValue) ? normalizedValue : DETAIL_ACTION_PAUSE;
}

function pickFirstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '');
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

export function normalizePromotionDetailDateRange(values) {
  return (Array.isArray(values) ? values : [])
    .slice(0, 2)
    .map(normalizeText)
    .filter(Boolean);
}

export function createDefaultPromotionDetailSettings() {
  return {
    selectedShopIds: [],
    selectedRegionIds: [],
    queryDateRange: [],
    detailFilterDraft: createEmptyPromotionDetailFilterState(),
    appliedDetailFilters: createEmptyPromotionDetailFilterState(),
    batchActionType: DETAIL_ACTION_PAUSE,
    batchTargetRoas: null
  };
}

export function normalizePromotionDetailSettings(settings = {}) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings
    : {};

  return {
    selectedShopIds: normalizeTextList(source.selectedShopIds || source.shopIds),
    selectedRegionIds: normalizeRegionIdList(source.selectedRegionIds || source.regionIds),
    queryDateRange: normalizePromotionDetailDateRange(source.queryDateRange || source.dateRange),
    detailFilterDraft: normalizePromotionDetailFilterState(source.detailFilterDraft || source.detailFilters),
    appliedDetailFilters: normalizePromotionDetailFilterState(source.appliedDetailFilters || source.detailFilters),
    batchActionType: normalizeActionType(source.batchActionType || source.actionType),
    batchTargetRoas: normalizeOptionalNumber(pickFirstPresent(source.batchTargetRoas, source.targetRoas))
  };
}

export function buildPromotionDetailSettingsPayload(settings = {}) {
  const normalizedSettings = normalizePromotionDetailSettings(settings);

  return {
    detailView: normalizedSettings
  };
}

export async function loadPromotionDetailSettings(featureCenterBridge = resolveFeatureCenterBridge()) {
  const bridge = featureCenterBridge && featureCenterBridge.getPromotionManagerNewDetailSettings;

  if (typeof bridge !== 'function') {
    return null;
  }

  const result = await bridge();
  const settings = result && result.settings && result.settings.detailView
    ? result.settings.detailView
    : {};

  return normalizePromotionDetailSettings(settings);
}

export async function savePromotionDetailSettings(
  settings,
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const bridge = featureCenterBridge && featureCenterBridge.savePromotionManagerNewDetailSettings;

  if (typeof bridge !== 'function') {
    return null;
  }

  return bridge(buildPromotionDetailSettingsPayload(settings));
}
