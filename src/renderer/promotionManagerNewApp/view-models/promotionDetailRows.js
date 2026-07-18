export const DETAIL_QUERY_PAGE_SIZE = 50;

export const DETAIL_ACTION_PAUSE = 'pause_plan';
export const DETAIL_ACTION_RESUME = 'resume_plan';
export const DETAIL_ACTION_UPDATE_ROAS = 'update_roas';
export const DETAIL_ACTION_INCREASE_ROAS = 'increase_roas';
export const DETAIL_ACTION_DELETE = 'delete_plan';

export const DETAIL_ACTION_OPTIONS = Object.freeze([
  { value: DETAIL_ACTION_PAUSE, label: '\u6682\u505c\u8ba1\u5212' },
  { value: DETAIL_ACTION_RESUME, label: '\u6062\u590d\u8ba1\u5212' },
  { value: DETAIL_ACTION_UPDATE_ROAS, label: '\u4fee\u6539ROAS' },
  { value: DETAIL_ACTION_INCREASE_ROAS, label: '\u589e\u52a0ROAS' },
  { value: DETAIL_ACTION_DELETE, label: '\u5220\u9664\u8ba1\u5212' }
]);

export const DETAIL_ACTION_TARGET_ROAS_TYPES = new Set([
  DETAIL_ACTION_UPDATE_ROAS,
  DETAIL_ACTION_INCREASE_ROAS
]);

export const DETAIL_STATUS_RUNNING = 'running';
export const DETAIL_STATUS_PAUSED = 'paused';
export const DETAIL_STATUS_ENDED = 'ended';
export const DETAIL_STATUS_DELETED = 'deleted';

export const DETAIL_STATUS_OPTIONS = Object.freeze([
  { value: DETAIL_STATUS_RUNNING, label: '\u6295\u653e\u4e2d' },
  { value: DETAIL_STATUS_PAUSED, label: '\u5df2\u6682\u505c' },
  { value: DETAIL_STATUS_ENDED, label: '\u5df2\u7ed3\u675f' },
  { value: DETAIL_STATUS_DELETED, label: '\u5df2\u5220\u9664' }
]);

export const EMPTY_DETAIL_FILTER_STATE = Object.freeze({
  identityText: '',
  shopValues: [],
  statusValues: [],
  siteValues: [],
  spendMin: null,
  spendMax: null,
  roasMin: null,
  roasMax: null,
  orderMin: null,
  orderMax: null
});

export function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
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

export function normalizeTextList(value) {
  const sourceItems = Array.isArray(value) ? value : [value];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function splitFilterTokens(value) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[\s,\uFF0C;\uFF1B]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createTextLookup(values) {
  return new Set(normalizeTextList(values).map((entry) => entry.toLowerCase()));
}

function splitJoinedTextValues(value) {
  return normalizeText(value)
    .split(/\s*\/\s*|[\uFF0C,\uFF1B;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeFilterRangeFields(fieldName, minValue, maxValue) {
  const range = normalizeRangeNumbers(minValue, maxValue);

  return {
    [`${fieldName}Min`]: range.min,
    [`${fieldName}Max`]: range.max
  };
}

function isNumberInRange(value, range) {
  if (range.min === null && range.max === null) {
    return true;
  }

  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null) {
    return false;
  }

  if (range.min !== null && numberValue < range.min) {
    return false;
  }

  if (range.max !== null && numberValue > range.max) {
    return false;
  }

  return true;
}

function firstPresentText(...values) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

export function createEmptyPromotionDetailFilterState() {
  return {
    ...EMPTY_DETAIL_FILTER_STATE,
    shopValues: [],
    statusValues: [],
    siteValues: []
  };
}

export function normalizePromotionDetailFilterState(filters) {
  const source = filters && typeof filters === 'object' ? filters : {};

  return {
    identityText: normalizeText(source.identityText),
    shopValues: normalizeTextList(source.shopValues),
    statusValues: normalizeTextList(source.statusValues)
      .filter((value) => DETAIL_STATUS_OPTIONS.some((option) => option.value === value)),
    siteValues: normalizeTextList(source.siteValues),
    ...normalizeFilterRangeFields('spend', source.spendMin, source.spendMax),
    ...normalizeFilterRangeFields('roas', source.roasMin, source.roasMax),
    ...normalizeFilterRangeFields('order', source.orderMin, source.orderMax)
  };
}

function hasNormalizedFilterValues(filters) {
  return Boolean(
    filters.identityText
    || filters.shopValues.length > 0
    || filters.statusValues.length > 0
    || filters.siteValues.length > 0
    || filters.spendMin !== null
    || filters.spendMax !== null
    || filters.roasMin !== null
    || filters.roasMax !== null
    || filters.orderMin !== null
    || filters.orderMax !== null
  );
}

export function isPromotionDetailFilterActive(filters) {
  return hasNormalizedFilterValues(normalizePromotionDetailFilterState(filters));
}

function buildUniqueTextOptions(rows, resolveValues) {
  const optionValues = new Set();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    normalizeTextList(resolveValues(row)).forEach((value) => {
      optionValues.add(value);
    });
  });

  return Array.from(optionValues)
    .sort((left, right) => left.localeCompare(right, 'zh-CN', {
      numeric: true,
      sensitivity: 'base'
    }))
    .map((value) => ({
      value,
      label: value
    }));
}

export function buildPromotionDetailShopFilterOptions(rows) {
  const optionMap = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = firstPresentText(row && row.shopId, row && row.shopName);
    const label = firstPresentText(row && row.shopName, row && row.shopId);

    if (value && !optionMap.has(value)) {
      optionMap.set(value, label);
    }
  });

  return Array.from(optionMap.entries())
    .sort((left, right) => left[1].localeCompare(right[1], 'zh-CN', {
      numeric: true,
      sensitivity: 'base'
    }))
    .map(([value, label]) => ({
      value,
      label
    }));
}

export function buildPromotionDetailSiteFilterOptions(rows) {
  return buildUniqueTextOptions(rows, (row) => splitJoinedTextValues(row && row.siteText));
}

export function prunePromotionDetailFilterStateOptions(filters, options = {}) {
  const normalizedFilters = normalizePromotionDetailFilterState(filters);
  const shopLookup = createTextLookup(options.shopValues);
  const siteLookup = createTextLookup(options.siteValues);

  return {
    ...normalizedFilters,
    shopValues: shopLookup.size > 0
      ? normalizedFilters.shopValues.filter((value) => shopLookup.has(value.toLowerCase()))
      : [],
    siteValues: siteLookup.size > 0
      ? normalizedFilters.siteValues.filter((value) => siteLookup.has(value.toLowerCase()))
      : []
  };
}

export function filterPromotionDetailRows(rows, filters) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const normalizedFilters = normalizePromotionDetailFilterState(filters);

  if (!hasNormalizedFilterValues(normalizedFilters)) {
    return sourceRows;
  }

  const identityTokens = splitFilterTokens(normalizedFilters.identityText);
  const shopLookup = createTextLookup(normalizedFilters.shopValues);
  const statusLookup = createTextLookup(normalizedFilters.statusValues);
  const selectedSiteValues = Array.from(createTextLookup(normalizedFilters.siteValues));
  const spendRange = normalizeRangeNumbers(normalizedFilters.spendMin, normalizedFilters.spendMax);
  const roasRange = normalizeRangeNumbers(normalizedFilters.roasMin, normalizedFilters.roasMax);
  const orderRange = normalizeRangeNumbers(normalizedFilters.orderMin, normalizedFilters.orderMax);

  return sourceRows.filter((row) => {
    if (identityTokens.length > 0) {
      const rowIdentityText = [
        row && row.goodsId,
        row && row.adId,
        row && row.spuId,
        row && row.productName
      ].map(normalizeText).join(' ').toLowerCase();

      if (!identityTokens.some((token) => rowIdentityText.includes(token))) {
        return false;
      }
    }

    if (shopLookup.size > 0) {
      const rowShopValue = firstPresentText(row && row.shopId, row && row.shopName).toLowerCase();

      if (!shopLookup.has(rowShopValue)) {
        return false;
      }
    }

    if (statusLookup.size > 0 && !statusLookup.has(normalizeText(row && row.statusValue).toLowerCase())) {
      return false;
    }

    if (selectedSiteValues.length > 0) {
      const rowSiteLookup = createTextLookup(splitJoinedTextValues(row && row.siteText));

      if (!selectedSiteValues.some((value) => rowSiteLookup.has(value))) {
        return false;
      }
    }

    return (
      isNumberInRange(row && row.spendValue, spendRange)
      && isNumberInRange(row && row.roasValue, roasRange)
      && isNumberInRange(row && row.orderCount, orderRange)
    );
  });
}

export function getPromotionDetailRowKey(row) {
  return firstPresentText(
    row && row.id,
    [
      row && row.shopId,
      row && row.regionId,
      row && row.adId,
      row && row.goodsId
    ].map(normalizeText).filter(Boolean).join(':')
  );
}

