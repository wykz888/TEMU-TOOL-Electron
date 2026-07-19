const DEFAULT_CURRENCY = '\u00a5';

function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return normalizeFiniteNumber(value);
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

function pickPositiveNumber(...values) {
  for (const value of values) {
    const numberValue = normalizeFiniteNumber(value);

    if (numberValue !== null && numberValue > 0) {
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

function parseNumberList(value) {
  return normalizeText(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry)) || [];
}

function getBidInfo(row) {
  return row && row.bidInfo && typeof row.bidInfo === 'object'
    ? row.bidInfo
    : {};
}

function formatMoneyText(value, currency) {
  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null) {
    return '';
  }

  return `${normalizeText(currency) || DEFAULT_CURRENCY}${numberValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatPercentText(value) {
  const numberValue = normalizeFiniteNumber(value);

  if (numberValue === null) {
    return '';
  }

  return `${numberValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`;
}

function getCustomRoasBounds(row) {
  const bidInfo = getBidInfo(row);

  return {
    min: pickNumber(bidInfo.minCustomRoas, row && row.bidMinCustomRoas),
    max: pickNumber(bidInfo.maxCustomRoas, row && row.bidMaxCustomRoas)
  };
}

function roundRoasValue(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue === null ? null : Number(numberValue.toFixed(2));
}

function clampCustomRoasValue(row, value) {
  const roasNumber = pickPositiveNumber(value);

  if (roasNumber === null) {
    return null;
  }

  const bounds = getCustomRoasBounds(row);
  const minValue = pickPositiveNumber(bounds.min);
  const maxValue = pickPositiveNumber(bounds.max);
  const boundedValue = Math.min(
    maxValue === null ? roasNumber : maxValue,
    Math.max(minValue === null ? roasNumber : minValue, roasNumber)
  );

  return roundRoasValue(boundedValue);
}

export function getRowPriceRange(row) {
  const priceMin = normalizeOptionalNumber(row && row.priceMin);
  const priceMax = normalizeOptionalNumber(row && row.priceMax);

  if (priceMin !== null || priceMax !== null) {
    return normalizeRangeNumbers(priceMin, priceMax);
  }

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

export function getRowReferencePrice(row) {
  const priceRange = getRowPriceRange(row);

  return pickPositiveNumber(priceRange.max, priceRange.min);
}

function resolveChargeEstimate(row, prediction, roasText) {
  const roasNumber = pickPositiveNumber(
    prediction && prediction.roasNumber,
    prediction && prediction.roas,
    roasText
  );

  if (roasNumber === null) {
    return null;
  }

  const priceRange = getRowPriceRange(row);
  const minPrice = pickPositiveNumber(priceRange.min, priceRange.max);
  const maxPrice = pickPositiveNumber(priceRange.max, priceRange.min);

  if (minPrice === null || maxPrice === null) {
    return null;
  }

  return {
    roasNumber,
    minPrice,
    maxPrice,
    currency: normalizeText(getBidInfo(row).currency) || DEFAULT_CURRENCY
  };
}

function buildEstimatedChargeText(row, prediction, roasText) {
  const estimate = resolveChargeEstimate(row, prediction, roasText);

  if (!estimate) {
    return '';
  }

  const minChargeText = formatMoneyText(estimate.minPrice / estimate.roasNumber, estimate.currency);
  const maxChargeText = formatMoneyText(estimate.maxPrice / estimate.roasNumber, estimate.currency);
  const chargeText = minChargeText && maxChargeText && minChargeText !== maxChargeText
    ? `${minChargeText} - ${maxChargeText}`
    : (minChargeText || maxChargeText);

  return chargeText ? `\u9884\u4f30\u6263\u8d39 ${chargeText}` : '';
}

function buildEstimatedChargeRatioText(row, prediction, roasText) {
  const estimate = resolveChargeEstimate(row, prediction, roasText);

  if (!estimate) {
    return '';
  }

  const minRatioText = formatPercentText(((estimate.minPrice / estimate.roasNumber) / estimate.minPrice) * 100);
  const maxRatioText = formatPercentText(((estimate.maxPrice / estimate.roasNumber) / estimate.maxPrice) * 100);
  const ratioText = minRatioText && maxRatioText && minRatioText !== maxRatioText
    ? `${minRatioText} - ${maxRatioText}`
    : (minRatioText || maxRatioText);

  return ratioText ? `\u6263\u8d39\u5360\u6bd4 ${ratioText}` : '';
}

export function buildEstimatedChargeTextList(row, prediction, roasText) {
  return [
    buildEstimatedChargeText(row, prediction, roasText),
    buildEstimatedChargeRatioText(row, prediction, roasText)
  ].filter(Boolean);
}

export function buildRoasEstimateTextList(row, roasValue) {
  const roasNumber = pickPositiveNumber(roasValue);

  if (roasNumber === null) {
    return [];
  }

  return buildEstimatedChargeTextList(row, { roasNumber }, roasNumber);
}

export function resolveRoasFromEstimatedCharge(row, chargeValue) {
  const charge = pickPositiveNumber(chargeValue);
  const referencePrice = getRowReferencePrice(row);

  if (charge === null || referencePrice === null) {
    return null;
  }

  return clampCustomRoasValue(row, referencePrice / charge);
}

export function resolveRoasFromEstimatedChargeRatio(row, ratioValue) {
  const ratio = pickPositiveNumber(ratioValue);

  if (ratio === null) {
    return null;
  }

  return clampCustomRoasValue(row, 100 / ratio);
}
