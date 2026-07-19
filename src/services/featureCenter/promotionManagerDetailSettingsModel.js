const { normalizeText } = require('../shopManagement/common');

const SETTINGS_VERSION = 1;
const REGION_IDS = Object.freeze(['us', 'eu', 'global']);
const DETAIL_ACTION_PAUSE = 'pause_plan';
const DETAIL_ACTION_IDS = Object.freeze([
  DETAIL_ACTION_PAUSE,
  'resume_plan',
  'update_roas',
  'increase_roas',
  'delete_plan'
]);
const DETAIL_ROAS_MODE_STRONG = 'strong';
const DETAIL_ROAS_MODE_IDS = Object.freeze([
  DETAIL_ROAS_MODE_STRONG,
  'medium',
  'weak',
  'custom'
]);
const DETAIL_STATUS_IDS = Object.freeze([
  'running',
  'paused',
  'goods_offline',
  'ended',
  'deleted'
]);

function normalizeUniqueTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeRegionIds(values) {
  return normalizeUniqueTextList(values).filter((regionId) => REGION_IDS.includes(regionId));
}

function normalizeFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeOptionalNonNegativeNumber(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue !== null && numberValue >= 0 ? numberValue : null;
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

function normalizeDateRange(values) {
  return (Array.isArray(values) ? values : [])
    .slice(0, 2)
    .map(normalizeText)
    .filter(Boolean);
}

function pickFirstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '');
}

function normalizeActionType(value) {
  const normalizedValue = normalizeText(value);

  return DETAIL_ACTION_IDS.includes(normalizedValue) ? normalizedValue : DETAIL_ACTION_PAUSE;
}

function normalizeRoasMode(value) {
  const normalizedValue = normalizeText(value);

  return DETAIL_ROAS_MODE_IDS.includes(normalizedValue) ? normalizedValue : DETAIL_ROAS_MODE_STRONG;
}

function createEmptyDetailFilterState() {
  return {
    identityText: '',
    shopValues: [],
    statusValues: [],
    siteValues: [],
    spendMin: null,
    spendMax: null,
    roasMin: null,
    roasMax: null,
    targetRoasMin: null,
    targetRoasMax: null,
    orderMin: null,
    orderMax: null
  };
}

function normalizeFilterRangeFields(fieldName, minValue, maxValue) {
  const range = normalizeRangeNumbers(minValue, maxValue);

  return {
    [`${fieldName}Min`]: range.min,
    [`${fieldName}Max`]: range.max
  };
}

function normalizeDetailFilterState(filters) {
  const source = filters && typeof filters === 'object' && !Array.isArray(filters)
    ? filters
    : {};

  return {
    identityText: normalizeText(source.identityText),
    shopValues: normalizeUniqueTextList(source.shopValues),
    statusValues: normalizeUniqueTextList(source.statusValues)
      .filter((statusId) => DETAIL_STATUS_IDS.includes(statusId)),
    siteValues: normalizeUniqueTextList(source.siteValues),
    ...normalizeFilterRangeFields('spend', source.spendMin, source.spendMax),
    ...normalizeFilterRangeFields('roas', source.roasMin, source.roasMax),
    ...normalizeFilterRangeFields('targetRoas', source.targetRoasMin, source.targetRoasMax),
    ...normalizeFilterRangeFields('order', source.orderMin, source.orderMax)
  };
}

function normalizeDetailSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const legacyFilters = source.detailFilters || source.filters || null;

  return {
    selectedShopIds: normalizeUniqueTextList(source.selectedShopIds || source.shopIds),
    selectedRegionIds: normalizeRegionIds(source.selectedRegionIds || source.regionIds),
    queryDateRange: normalizeDateRange(source.queryDateRange || source.dateRange),
    detailFilterDraft: normalizeDetailFilterState(source.detailFilterDraft || legacyFilters),
    appliedDetailFilters: normalizeDetailFilterState(source.appliedDetailFilters || legacyFilters),
    batchActionType: normalizeActionType(source.batchActionType || source.actionType),
    batchRoasMode: normalizeRoasMode(source.batchRoasMode || source.roasMode),
    batchTargetRoas: normalizeOptionalNonNegativeNumber(
      pickFirstPresent(source.batchTargetRoas, source.targetRoas)
    )
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
    detailView: normalizeDetailSettings()
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
    detailView: normalizeDetailSettings(source.detailView)
  };
}

module.exports = {
  SETTINGS_VERSION,
  REGION_IDS,
  buildDefaultSettings,
  createEmptyDetailFilterState,
  normalizeDetailFilterState,
  normalizeDetailSettings,
  normalizeSettingsPayload
};
