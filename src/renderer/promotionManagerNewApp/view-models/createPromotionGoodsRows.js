export const GOODS_QUERY_PAGE_SIZE = 100;

export const BUDGET_MODE_UNLIMITED = 'unlimited';
export const BUDGET_MODE_CUSTOM = 'custom';

export const ROAS_MODE_STRONG = 'strong';
export const ROAS_MODE_MEDIUM = 'medium';
export const ROAS_MODE_WEAK = 'weak';
export const ROAS_MODE_CUSTOM = 'custom';

export const FAST_START_MODE_OFF = 'off';
export const FAST_START_MODE_ON = 'on';

export const EMPTY_GOODS_FILTER_STATE = Object.freeze({
  identityText: '',
  shopValues: [],
  categoryValues: [],
  siteValues: [],
  priceMin: null,
  priceMax: null,
  salesMin: null,
  salesMax: null,
  createdRange: []
});

export const BUDGET_MODE_OPTIONS = Object.freeze([
  { value: BUDGET_MODE_UNLIMITED, label: '\u4e0d\u9650' },
  { value: BUDGET_MODE_CUSTOM, label: '\u81ea\u5b9a\u4e49' }
]);

export const ROAS_MODE_OPTIONS = Object.freeze([
  { value: ROAS_MODE_STRONG, label: '\u7ade\u4e89\u529b\u5f3a' },
  { value: ROAS_MODE_MEDIUM, label: '\u7ade\u4e89\u529b\u4e2d' },
  { value: ROAS_MODE_WEAK, label: '\u7ade\u4e89\u529b\u5f31' },
  { value: ROAS_MODE_CUSTOM, label: '\u81ea\u5b9a\u4e49' }
]);

export const FAST_START_MODE_OPTIONS = Object.freeze([
  { value: FAST_START_MODE_OFF, label: '\u5173\u95ed' },
  { value: FAST_START_MODE_ON, label: '\u5f00\u542f' }
]);

const ROAS_MODE_ORDER = Object.freeze([
  ROAS_MODE_STRONG,
  ROAS_MODE_MEDIUM,
  ROAS_MODE_WEAK
]);

const ROAS_LABELS = Object.freeze({
  [ROAS_MODE_STRONG]: '\u7ade\u4e89\u529b\u5f3a',
  [ROAS_MODE_MEDIUM]: '\u7ade\u4e89\u529b\u4e2d',
  [ROAS_MODE_WEAK]: '\u7ade\u4e89\u529b\u5f31',
  [ROAS_MODE_CUSTOM]: '\u81ea\u5b9a\u4e49'
});

function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function pickNumber(...values) {
  for (const value of values) {
    const numberValue = normalizeFiniteNumber(value);

    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
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

function pickPositiveNumber(...values) {
  for (const value of values) {
    const numberValue = normalizeFiniteNumber(value);

    if (numberValue !== null && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
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

function splitFilterTokens(value) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[\s,\uFF0C;\uFF1B]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeTextList(value) {
  const sourceItems = Array.isArray(value) ? value : [value];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
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

function parseNumberList(value) {
  return normalizeText(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry)) || [];
}

function getRowPriceRange(row) {
  const numbers = [
    ...parseNumberList(row && row.priceText),
    ...parseNumberList(row && row.sitePriceText)
  ];

  if (numbers.length <= 0) {
    return {
      min: null,
      max: null
    };
  }

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers)
  };
}

function isNumberRangeOverlapping(rowRange, filterRange) {
  if (filterRange.min === null && filterRange.max === null) {
    return true;
  }

  if (rowRange.min === null && rowRange.max === null) {
    return false;
  }

  const rowMin = rowRange.min === null ? rowRange.max : rowRange.min;
  const rowMax = rowRange.max === null ? rowRange.min : rowRange.max;

  if (filterRange.min !== null && rowMax < filterRange.min) {
    return false;
  }

  if (filterRange.max !== null && rowMin > filterRange.max) {
    return false;
  }

  return true;
}

function normalizeTimestamp(value) {
  if (value instanceof Date) {
    const time = value.getTime();

    return Number.isFinite(time) ? time : null;
  }

  const numberValue = normalizeFiniteNumber(value);

  if (numberValue !== null) {
    return numberValue;
  }

  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const time = new Date(text).getTime();

  return Number.isFinite(time) ? time : null;
}

function normalizeEndOfDayTimestamp(value) {
  const timestamp = normalizeTimestamp(value);

  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);

  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function getBidInfo(row) {
  return row && row.bidInfo && typeof row.bidInfo === 'object'
    ? row.bidInfo
    : {};
}

function getPredictions(row) {
  const bidInfo = getBidInfo(row);

  return Array.isArray(bidInfo.predictions) ? bidInfo.predictions : [];
}

function resolvePredictionMode(prediction, index) {
  const desc = normalizeText(prediction && prediction.desc);

  if (desc.includes(ROAS_LABELS[ROAS_MODE_STRONG])) {
    return ROAS_MODE_STRONG;
  }

  if (desc.includes(ROAS_LABELS[ROAS_MODE_MEDIUM])) {
    return ROAS_MODE_MEDIUM;
  }

  if (desc.includes(ROAS_LABELS[ROAS_MODE_WEAK])) {
    return ROAS_MODE_WEAK;
  }

  return ROAS_MODE_ORDER[index] || '';
}

function findBestRoasMode(row) {
  const predictions = getPredictions(row);
  const bestPrediction = predictions.find((entry) => entry && entry.bestSelect === true)
    || getBidInfo(row).bestPrediction
    || predictions[0]
    || null;

  if (!bestPrediction) {
    return ROAS_MODE_CUSTOM;
  }

  const bestIndex = predictions.indexOf(bestPrediction);
  const resolvedMode = resolvePredictionMode(bestPrediction, bestIndex >= 0 ? bestIndex : 0);

  return resolvedMode || ROAS_MODE_CUSTOM;
}

export function getGoodsRowKey(row) {
  return firstPresentText(
    row && row.id,
    [
      row && row.shopId,
      row && row.regionId,
      row && row.goodsId,
      row && row.spuId,
      row && row.skuEncode,
      row && row.rowIndex
    ].map(normalizeText).filter(Boolean).join(':')
  );
}

export function getDailyBudgetBounds(row) {
  const bidInfo = getBidInfo(row);

  return {
    min: pickNumber(bidInfo.minDailyBudget, row && row.bidMinDailyBudget),
    max: pickNumber(bidInfo.maxDailyBudget, row && row.bidMaxDailyBudget)
  };
}

export function hasDailyBudgetBounds(row) {
  const bounds = getDailyBudgetBounds(row);

  return bounds.min !== null || bounds.max !== null;
}

export function getCustomRoasBounds(row) {
  const bidInfo = getBidInfo(row);

  return {
    min: pickPositiveNumber(bidInfo.minCustomRoas, row && row.bidMinCustomRoas),
    max: pickPositiveNumber(bidInfo.maxCustomRoas, row && row.bidMaxCustomRoas)
  };
}

export function hasCustomRoasBounds(row) {
  const bounds = getCustomRoasBounds(row);

  return bounds.min !== null || bounds.max !== null;
}

export function buildDailyBudgetHint(row) {
  if (!hasDailyBudgetBounds(row)) {
    return '';
  }

  return firstPresentText(row && row.bidDailyBudgetText, getBidInfo(row).dailyBudgetText);
}

export function buildCustomRoasHint(row) {
  if (!hasCustomRoasBounds(row)) {
    return '';
  }

  return firstPresentText(
    row && row.bidCustomRoasRangeText,
    getBidInfo(row).customRoasRangeText
  );
}

export function buildRoasPredictionOptions(row) {
  const predictionByMode = new Map();

  getPredictions(row).forEach((prediction, index) => {
    const mode = resolvePredictionMode(prediction, index);

    if (mode && !predictionByMode.has(mode)) {
      predictionByMode.set(mode, prediction);
    }
  });

  return ROAS_MODE_ORDER.map((mode) => {
    const prediction = predictionByMode.get(mode) || null;
    const roasText = normalizeText(prediction && prediction.roasText);
    const budgetText = normalizeText(prediction && prediction.roasBudgetText);
    const impressionText = normalizeText(prediction && prediction.impressionDeltaText);
    const orderText = normalizeText(prediction && prediction.orderDeltaText);

    return {
      value: mode,
      label: ROAS_LABELS[mode],
      roasText,
      budgetText,
      disabled: !prediction,
      title: [
        roasText ? `ROAS ${roasText}` : '',
        budgetText ? `\u9884\u7b97 ${budgetText}` : '',
        impressionText ? `\u66dd\u5149 ${impressionText}` : '',
        orderText ? `\u8ba2\u5355 ${orderText}` : ''
      ].filter(Boolean).join(' / ')
    };
  });
}

export function createEmptyGoodsFilterState() {
  return {
    ...EMPTY_GOODS_FILTER_STATE,
    shopValues: [],
    categoryValues: [],
    siteValues: [],
    createdRange: []
  };
}

export function normalizeGoodsFilterState(filters) {
  const safeFilters = filters && typeof filters === 'object' ? filters : {};
  const createdRange = Array.isArray(safeFilters.createdRange) ? safeFilters.createdRange : [];

  return {
    identityText: normalizeText(safeFilters.identityText),
    shopValues: normalizeTextList(safeFilters.shopValues),
    categoryValues: normalizeTextList(safeFilters.categoryValues),
    siteValues: normalizeTextList(safeFilters.siteValues),
    ...normalizeFilterRangeFields('price', safeFilters.priceMin, safeFilters.priceMax),
    ...normalizeFilterRangeFields('sales', safeFilters.salesMin, safeFilters.salesMax),
    createdRange: createdRange.slice(0, 2)
  };
}

function normalizeFilterRangeFields(fieldName, minValue, maxValue) {
  const range = normalizeRangeNumbers(minValue, maxValue);

  return {
    [`${fieldName}Min`]: range.min,
    [`${fieldName}Max`]: range.max
  };
}

export function isGoodsFilterActive(filters) {
  const normalizedFilters = normalizeGoodsFilterState(filters);

  return Boolean(
    normalizedFilters.identityText
    || normalizedFilters.shopValues.length > 0
    || normalizedFilters.categoryValues.length > 0
    || normalizedFilters.siteValues.length > 0
    || normalizedFilters.priceMin !== null
    || normalizedFilters.priceMax !== null
    || normalizedFilters.salesMin !== null
    || normalizedFilters.salesMax !== null
    || normalizedFilters.createdRange.length > 0
  );
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

export function buildGoodsShopFilterOptions(rows) {
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

export function buildGoodsCategoryFilterOptions(rows) {
  return buildUniqueTextOptions(rows, (row) => row && row.categoryText);
}

export function buildGoodsSiteFilterOptions(rows) {
  return buildUniqueTextOptions(rows, (row) => splitJoinedTextValues(row && row.siteText));
}

function pruneSelectedValues(values, availableValues) {
  const availableLookup = createTextLookup(availableValues);

  if (availableLookup.size <= 0) {
    return [];
  }

  return normalizeTextList(values).filter((value) => availableLookup.has(value.toLowerCase()));
}

export function pruneGoodsFilterStateOptions(filters, options = {}) {
  const normalizedFilters = normalizeGoodsFilterState(filters);

  return {
    ...normalizedFilters,
    shopValues: pruneSelectedValues(normalizedFilters.shopValues, options.shopValues),
    categoryValues: pruneSelectedValues(normalizedFilters.categoryValues, options.categoryValues),
    siteValues: pruneSelectedValues(normalizedFilters.siteValues, options.siteValues)
  };
}

export function filterGoodsRows(rows, filters) {
  const normalizedFilters = normalizeGoodsFilterState(filters);
  const identityTokens = splitFilterTokens(normalizedFilters.identityText);
  const shopLookup = createTextLookup(normalizedFilters.shopValues);
  const categoryLookup = createTextLookup(normalizedFilters.categoryValues);
  const siteLookup = createTextLookup(normalizedFilters.siteValues);
  const selectedSiteValues = Array.from(siteLookup);
  const priceRange = normalizeRangeNumbers(normalizedFilters.priceMin, normalizedFilters.priceMax);
  const salesRange = normalizeRangeNumbers(normalizedFilters.salesMin, normalizedFilters.salesMax);
  const startTime = normalizeTimestamp(normalizedFilters.createdRange[0]);
  const endTime = normalizeEndOfDayTimestamp(normalizedFilters.createdRange[1]);

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (identityTokens.length > 0) {
      const rowIdentityText = [
        row && row.goodsId,
        row && row.spuId
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

    if (categoryLookup.size > 0) {
      const rowCategoryText = normalizeText(row && row.categoryText).toLowerCase();

      if (!categoryLookup.has(rowCategoryText)) {
        return false;
      }
    }

    if (selectedSiteValues.length > 0) {
      const rowSiteLookup = createTextLookup(splitJoinedTextValues(row && row.siteText));

      if (!selectedSiteValues.some((value) => rowSiteLookup.has(value))) {
        return false;
      }
    }

    if (!isNumberRangeOverlapping(getRowPriceRange(row), priceRange)) {
      return false;
    }

    if (salesRange.min !== null || salesRange.max !== null) {
      const sales = normalizeFiniteNumber(row && row.sales);

      if (sales === null) {
        return false;
      }

      if (salesRange.min !== null && sales < salesRange.min) {
        return false;
      }

      if (salesRange.max !== null && sales > salesRange.max) {
        return false;
      }
    }

    if (startTime !== null || endTime !== null) {
      const createTimestamp = normalizeTimestamp(row && row.createTimestamp);

      if (createTimestamp === null) {
        return false;
      }

      if (startTime !== null && createTimestamp < startTime) {
        return false;
      }

      if (endTime !== null && createTimestamp > endTime) {
        return false;
      }
    }

    return true;
  });
}

export function buildGoodsRowDraft(row) {
  const dailyBudgetBounds = getDailyBudgetBounds(row);
  const roasBounds = getCustomRoasBounds(row);
  const bestPrediction = getBidInfo(row).bestPrediction || null;
  const defaultCustomRoas = pickNumber(
    bestPrediction && bestPrediction.roasNumber,
    getBidInfo(row).adviceRoas,
    roasBounds.min
  );

  return {
    budgetMode: BUDGET_MODE_UNLIMITED,
    customBudget: dailyBudgetBounds.min,
    fastStartEnabled: row && row.fastStartEnabled === true,
    roasMode: findBestRoasMode(row),
    customRoas: defaultCustomRoas
  };
}

export function buildGoodsRowDraftMap(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((draftMap, row) => {
    const rowKey = getGoodsRowKey(row);

    if (rowKey) {
      draftMap[rowKey] = buildGoodsRowDraft(row);
    }

    return draftMap;
  }, {});
}

export function applyGoodsRowDraftPatchToRows(currentDraftMap, rows, patch) {
  const nextDraftMap = {
    ...(currentDraftMap && typeof currentDraftMap === 'object' ? currentDraftMap : {})
  };
  const safePatch = patch && typeof patch === 'object' ? patch : {};

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowKey = getGoodsRowKey(row);

    if (!rowKey) {
      return;
    }

    nextDraftMap[rowKey] = {
      ...(nextDraftMap[rowKey] || buildGoodsRowDraft(row)),
      ...safePatch
    };
  });

  return nextDraftMap;
}
