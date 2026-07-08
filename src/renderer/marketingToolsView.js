(function initMarketingToolsView() {
  const DEFAULT_MODULE_ID = 'marketing-tools';
  const STANDALONE_MARKETING_TOOLS_MODE = 'marketing-tools';
  const DEFAULT_MODULE_IDS = Object.freeze([
    'marketing-tools'
  ]);
  const MARKETING_TOOLS_TAB_CONFIG = Object.freeze([
    {
      id: 'single-product-coupon',
      label: '\u5355\u54c1\u4f18\u60e0\u5238'
    },
    {
      id: 'store-full-reduction-coupon',
      label: '\u5e97\u94fa\u6ee1\u51cf\u5238'
    },
    {
      id: 'review-reward',
      label: '\u8bc4\u4ef7\u6709\u793c'
    },
    {
      id: 'free-shipping-promotion',
      label: '\u5305\u90ae\u4f18\u60e0\u6d3b\u52a8'
    }
  ]);
  const PRODUCT_ID_TYPE_OPTIONS = Object.freeze([
    {
      value: 'spu',
      label: 'SPU'
    },
    {
      value: 'skc',
      label: 'SKC'
    },
    {
      value: 'sku',
      label: 'SKU'
    }
  ]);
  const SINGLE_PRODUCT_COUPON_SUBTAB_CONFIG = Object.freeze([
    {
      id: 'create',
      label: '\u521b\u5efa\u4f18\u60e0\u5238'
    },
    {
      id: 'manage',
      label: '\u7ba1\u7406\u4f18\u60e0\u5238'
    }
  ]);
  const SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS = Object.freeze([
    {
      value: '1',
      label: '\u7acb\u51cf\u5238'
    },
    {
      value: '2',
      label: '\u60ca\u559c\u5238'
    }
  ]);
  const SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE_OPTIONS = Object.freeze([
    {
      value: 'min-eligible-price',
      label: '\u4ee5\u6700\u4f4e\u53ef\u914d\u4ef7'
    },
    {
      value: 'max-eligible-price',
      label: '\u4ee5\u6700\u9ad8\u53ef\u914d\u4ef7'
    },
    {
      value: 'suggested-amount',
      label: '\u4ee5\u5efa\u8bae\u91d1\u989d'
    },
    {
      value: 'fixed-discount',
      label: '\u56fa\u5b9a\u4f18\u60e0\u5238\u91d1\u989d',
      rateField: 'batchCouponAmountFixedDiscount',
      ratePlaceholder: '\u8f93\u5165\u56fa\u5b9a\u4f18\u60e0\u5238\u91d1\u989d',
      rateUnit: '\u5143'
    },
    {
      value: 'cost-profit-rate',
      label: '\u4ee5\u6210\u672c\u5229\u6da6\u7387\u8ba9\u5229',
      rateField: 'batchCouponAmountCostProfitRate',
      ratePlaceholder: '\u8f93\u5165\u6210\u672c\u8ba9\u5229\u6bd4\u4f8b'
    },
    {
      value: 'sale-profit-rate',
      label: '\u4ee5\u552e\u4ef7\u5229\u6da6\u7387\u8ba9\u5229',
      rateField: 'batchCouponAmountSaleProfitRate',
      ratePlaceholder: '\u8f93\u5165\u552e\u4ef7\u8ba9\u5229\u6bd4\u4f8b'
    }
  ]);
  const DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE = 'suggested-amount';
  const DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_PROFIT_FLOOR_LOGIC = 'and';
  const MAX_CATEGORY_LEVEL = 4;
  const SINGLE_PRODUCT_COUPON_SHOP_SELECTION_SCOPE_KEY = 'operations-marketing-tools-single-product-coupon';
  const SINGLE_PRODUCT_COUPON_QUERY_RESULT_EMPTY_TEXT = '\u8bf7\u8bbe\u7f6e\u5e97\u94fa\u4e0e\u7b5b\u9009\u6761\u4ef6\u540e\u70b9\u51fb\u67e5\u8be2';
  const OPERATIONS_MODULE_WINDOW_TITLE = '\u8fd0\u8425\u5de5\u5177';
  const MARKETING_TOOLS_WINDOW_TITLE = '\u8425\u9500\u5de5\u5177';
  const MARKETING_TOOLS_PRODUCT_THUMBNAIL_SIZE = '120x';
  const MARKETING_TOOLS_RESULT_ROW_HEIGHT = 232;
  const MARKETING_TOOLS_RESULT_SINGLE_SKU_ROW_HEIGHT = 160;
  const MARKETING_TOOLS_RESULT_HEAD_HEIGHT = 44;
  const MARKETING_TOOLS_RESULT_OVERSCAN = 6;
  const MARKETING_TOOLS_RESULT_COLLAPSE_WIDTH = 1080;
  const standaloneMode = (() => {
    try {
      return String(new URLSearchParams(window.location.search).get('mode') || '').trim().toLowerCase();
    } catch (_error) {
      return '';
    }
  })();
  const STANDALONE_MODE_CONFIG = Object.freeze({
    [STANDALONE_MARKETING_TOOLS_MODE]: {
      moduleId: 'marketing-tools',
      bodyClass: 'marketing-tools-standalone',
      title: MARKETING_TOOLS_WINDOW_TITLE
    }
  });
  const standaloneConfig = STANDALONE_MODE_CONFIG[standaloneMode] || null;
  const standaloneModuleId = standaloneConfig ? standaloneConfig.moduleId : '';
  let activeModuleId = '';
  const moduleControllers = new Map();
  let activeMarketingToolsTabId = 'single-product-coupon';
  let marketingToolsResultsResponsiveFrameId = 0;
  const marketingToolsState = createMarketingToolsState();
  const profitMetrics = window.operationsProfitMetrics && typeof window.operationsProfitMetrics === 'object'
    ? window.operationsProfitMetrics
    : null;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function getShopMultiSelectControl() {
    return window.shopMultiSelectControl && typeof window.shopMultiSelectControl === 'object'
      ? window.shopMultiSelectControl
      : null;
  }

  function getShopSelectionTemplateHelper() {
    return window.operationsShopSelectionTemplates
      && typeof window.operationsShopSelectionTemplates === 'object'
      ? window.operationsShopSelectionTemplates
      : null;
  }

  function getFeatureCenterApi() {
    return window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter === 'object'
      ? window.temuApp.featureCenter
      : null;
  }

  function getOperationsSharedCatalog() {
    return window.operationsSharedCatalog && typeof window.operationsSharedCatalog === 'object'
      ? window.operationsSharedCatalog
      : null;
  }

  function getCategoryCascadeControl() {
    return window.categoryCascadeControl && typeof window.categoryCascadeControl === 'object'
      ? window.categoryCascadeControl
      : null;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeHtmlAttribute(value) {
    return escapeHtml(value).replace(/\r?\n/g, '&#10;');
  }

  function buildSizedImageUrl(imageUrl, targetSize) {
    const normalizedImageUrl = normalizeText(imageUrl);
    const normalizedTargetSize = normalizeText(targetSize);

    if (!normalizedImageUrl || !normalizedTargetSize) {
      return normalizedImageUrl;
    }

    if (/imageMogr2\/thumbnail\//i.test(normalizedImageUrl)) {
      return normalizedImageUrl.replace(
        /imageMogr2\/thumbnail\/[^&#]+/i,
        `imageMogr2/thumbnail/${normalizedTargetSize}`
      );
    }

    const separator = normalizedImageUrl.includes('?') ? '&' : '?';
    return `${normalizedImageUrl}${separator}imageMogr2/thumbnail/${normalizedTargetSize}`;
  }

  function parseTimestamp(value) {
    if (value === null || value === undefined || value === '') {
      return Number.NaN;
    }

    const numericValue = Number(value);
    const timestamp = Number.isFinite(numericValue)
      ? numericValue
      : Date.parse(String(value));

    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Number.NaN;
  }

  function formatSingleProductCouponQuickCostDateTime(value) {
    const timestamp = parseTimestamp(value);

    if (!Number.isFinite(timestamp)) {
      return '\u2014';
    }

    const date = new Date(timestamp);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatSingleProductCouponBatchCouponDateTimeValue(value) {
    const timestamp = parseTimestamp(value);

    if (!Number.isFinite(timestamp)) {
      return '';
    }

    const date = new Date(timestamp);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatSingleProductCouponBatchCouponDateTimeText(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    return normalizedValue.replace('T', ' ');
  }

  function buildSingleProductCouponBatchCouponDefaultTimeRange(baseDate = new Date()) {
    const startDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0
    );
    const endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 89);
    endDate.setHours(23, 59, 0, 0);

    return {
      start: formatSingleProductCouponBatchCouponDateTimeValue(startDate),
      end: formatSingleProductCouponBatchCouponDateTimeValue(endDate)
    };
  }

  function normalizeSingleProductCouponBatchCouponAmountMode(value) {
    const normalizedValue = normalizeText(value);
    const matchedOption = SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE_OPTIONS.find(
      (option) => normalizeText(option && option.value) === normalizedValue
    );
    return normalizeText(matchedOption && matchedOption.value) || DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE;
  }

  function normalizeSingleProductCouponBatchCouponRateValue(value) {
    return normalizeText(value);
  }

  function normalizeSingleProductCouponBatchCouponProfitFloorLogic(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return normalizedValue === 'or' ? 'or' : 'and';
  }

  function normalizeSingleProductCouponQuickCostValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return '';
    }

    return String(Number(numericValue.toFixed(2)));
  }

  function normalizeSingleProductCouponOptionalNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function formatSingleProductCouponMoneyYuan(value, currency = 'CNY') {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '-';
    }

    try {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: normalizeText(currency) || 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numericValue);
    } catch (_error) {
      return `\u00a5${numericValue.toFixed(2)}`;
    }
  }

  function formatSingleProductCouponPercent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '-';
    }

    return `${numericValue.toFixed(2).replace(/\.00$/, '')}%`;
  }

  function normalizeSingleProductCouponYuanAmountFromCent(value) {
    const numericValue = normalizeSingleProductCouponOptionalNumber(value);

    if (numericValue === null) {
      return null;
    }

    return Number((numericValue / 100).toFixed(2));
  }

  function computeSingleProductCouponProfitValue(priceAmount, costAmount) {
    const numericPriceAmount = Number(priceAmount);
    const numericCostAmount = Number(costAmount);

    if (!profitMetrics || typeof profitMetrics.computeProfitValue !== 'function') {
      return Number.NaN;
    }

    if (
      !Number.isFinite(numericPriceAmount)
      || numericPriceAmount <= 0
      || !Number.isFinite(numericCostAmount)
      || numericCostAmount < 0
    ) {
      return Number.NaN;
    }

    return profitMetrics.computeProfitValue(numericPriceAmount, numericCostAmount);
  }

  function computeSingleProductCouponProfitRate(priceAmount, costAmount) {
    const numericPriceAmount = Number(priceAmount);
    const numericCostAmount = Number(costAmount);

    if (!profitMetrics || typeof profitMetrics.computeProfitRateByPrice !== 'function') {
      return Number.NaN;
    }

    if (
      !Number.isFinite(numericPriceAmount)
      || numericPriceAmount <= 0
      || !Number.isFinite(numericCostAmount)
      || numericCostAmount <= 0
    ) {
      return Number.NaN;
    }

    return profitMetrics.computeProfitRateByPrice(numericPriceAmount, numericCostAmount);
  }

  function computeSingleProductCouponRequiredPriceForSaleProfitRate(costAmount, profitRate) {
    const normalizedCostAmount = Number(costAmount);
    const normalizedProfitRate = normalizeSingleProductCouponOptionalNumber(profitRate);

    if (
      !Number.isFinite(normalizedCostAmount)
      || normalizedCostAmount <= 0
      || normalizedProfitRate === null
      || normalizedProfitRate <= 0
    ) {
      return null;
    }

    const profitRateBasis = Math.round(normalizedProfitRate * 100);
    const denominatorBasis = 10000 - profitRateBasis;

    if (denominatorBasis <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Number(((normalizedCostAmount * 10000) / denominatorBasis).toFixed(2));
  }

  function buildSingleProductCouponQuickCostLookup() {
    const lookup = new Map();

    (Array.isArray(marketingToolsState.singleProductCouponQuickCostEntries)
      ? marketingToolsState.singleProductCouponQuickCostEntries
      : []
    ).forEach((entry) => {
      const key = buildSingleProductCouponQuickCostEntryKey(
        entry && entry.shopId,
        resolveSingleProductCouponQuickCostStationValue(entry),
        entry && entry.spec
      );
      const costPrice = normalizeSingleProductCouponOptionalNumber(entry && entry.costPrice);

      if (!key || !(costPrice !== null && costPrice > 0)) {
        return;
      }

      lookup.set(key, Number(costPrice.toFixed(2)));
    });

    return lookup;
  }

  function resolveSingleProductCouponRowCostPrice(row, costLookup) {
    const quickCostHintEntries = Array.isArray(row && row.quickCostHintEntries)
      ? row.quickCostHintEntries
      : [];
    const directCostPrice = normalizeSingleProductCouponOptionalNumber(row && row.costPrice);

    if (directCostPrice !== null && directCostPrice > 0) {
      return Number(directCostPrice.toFixed(2));
    }

    for (const hintEntry of quickCostHintEntries) {
      const hintCostPrice = normalizeSingleProductCouponOptionalNumber(hintEntry && hintEntry.costPrice);

      if (hintCostPrice !== null && hintCostPrice > 0) {
        return Number(hintCostPrice.toFixed(2));
      }
    }

    for (const hintEntry of quickCostHintEntries) {
      const key = buildSingleProductCouponQuickCostEntryKey(
        hintEntry && hintEntry.shopId,
        resolveSingleProductCouponQuickCostStationValue(hintEntry),
        hintEntry && hintEntry.spec
      );

      if (!key) {
        continue;
      }

      const costPrice = Number(costLookup.get(key));

      if (Number.isFinite(costPrice) && costPrice > 0) {
        return Number(costPrice.toFixed(2));
      }
    }

    return null;
  }

  function resolveSingleProductCouponProfitFloorState(costAmount) {
    const profitFloorRate = normalizeSingleProductCouponOptionalNumber(
      marketingToolsState.singleProductCouponBatchCouponProfitFloorRate
    );
    const profitFloorValue = normalizeSingleProductCouponOptionalNumber(
      marketingToolsState.singleProductCouponBatchCouponProfitFloorValue
    );
    const relation = normalizeSingleProductCouponBatchCouponProfitFloorLogic(
      marketingToolsState.singleProductCouponBatchCouponProfitFloorLogic
    );
    const hasProfitFloorRate = profitFloorRate !== null && profitFloorRate > 0;
    const hasProfitFloorValue = profitFloorValue !== null && profitFloorValue > 0;
    const requiredPriceForRate = hasProfitFloorRate
      ? computeSingleProductCouponRequiredPriceForSaleProfitRate(costAmount, profitFloorRate)
      : null;
    const requiredPriceForValue = hasProfitFloorValue
      ? Number((Number(costAmount) + profitFloorValue).toFixed(2))
      : null;
    const requiredPriceCandidates = [requiredPriceForRate, requiredPriceForValue]
      .filter((value) => value !== null);
    let minimumRequiredPrice = null;

    if (requiredPriceCandidates.length > 0) {
      if (hasProfitFloorRate && hasProfitFloorValue) {
        minimumRequiredPrice = relation === 'or'
          ? Math.min(...requiredPriceCandidates.map((value) => Number.isFinite(value) ? value : Number.POSITIVE_INFINITY))
          : (requiredPriceCandidates.some((value) => !Number.isFinite(value))
            ? Number.POSITIVE_INFINITY
            : Math.max(...requiredPriceCandidates));
      } else {
        minimumRequiredPrice = requiredPriceCandidates[0];
      }
    }

    return {
      profitFloorRate,
      profitFloorValue,
      relation,
      hasProfitFloorRate,
      hasProfitFloorValue,
      requiredPriceForRate,
      requiredPriceForValue,
      minimumRequiredPrice
    };
  }

  function evaluateSingleProductCouponProfitFloor(priceAmount, costAmount) {
    const floorState = resolveSingleProductCouponProfitFloorState(costAmount);
    const profitRate = computeSingleProductCouponProfitRate(priceAmount, costAmount);
    const profitValue = computeSingleProductCouponProfitValue(priceAmount, costAmount);
    const meetsProfitFloorRate = !floorState.hasProfitFloorRate
      || (Number.isFinite(profitRate) && profitRate + 0.0001 >= floorState.profitFloorRate);
    const meetsProfitFloorValue = !floorState.hasProfitFloorValue
      || (Number.isFinite(profitValue) && profitValue + 0.0001 >= floorState.profitFloorValue);
    let meetsFloor = true;

    if (floorState.hasProfitFloorRate && floorState.hasProfitFloorValue) {
      meetsFloor = floorState.relation === 'or'
        ? (meetsProfitFloorRate || meetsProfitFloorValue)
        : (meetsProfitFloorRate && meetsProfitFloorValue);
    } else if (floorState.hasProfitFloorRate) {
      meetsFloor = meetsProfitFloorRate;
    } else if (floorState.hasProfitFloorValue) {
      meetsFloor = meetsProfitFloorValue;
    }

    return {
      ...floorState,
      profitRate,
      profitValue,
      meetsProfitFloorRate,
      meetsProfitFloorValue,
      meetsFloor
    };
  }

  function buildSingleProductCouponProfitFloorFailReason(floorEvaluation) {
    const rateReason = floorEvaluation && floorEvaluation.hasProfitFloorRate
      ? `\u5229\u6da6\u7387\u672a\u8fbe ${formatSingleProductCouponPercent(floorEvaluation.profitFloorRate)}`
      : '';
    const valueReason = floorEvaluation && floorEvaluation.hasProfitFloorValue
      ? `\u5229\u6da6\u503c\u672a\u8fbe ${formatSingleProductCouponMoneyYuan(floorEvaluation.profitFloorValue)}`
      : '';

    if (!rateReason && !valueReason) {
      return '\u672a\u6ee1\u8db3\u4fdd\u5e95\u5229\u6da6\u6761\u4ef6';
    }

    if (floorEvaluation.hasProfitFloorRate && floorEvaluation.hasProfitFloorValue) {
      return floorEvaluation.relation === 'or'
        ? `\u5229\u6da6\u7387\u4e0e\u5229\u6da6\u503c\u5747\u672a\u8fbe\u6807`
        : [rateReason, valueReason].filter(Boolean).join('\uff0c');
    }

    return rateReason || valueReason;
  }

  function resolveSingleProductCouponPlannedCouponPreview(row, providedCostLookup) {
    const amountMode = normalizeSingleProductCouponBatchCouponAmountMode(
      marketingToolsState.singleProductCouponBatchCouponAmountMode
    );
    const couponCurrency = normalizeText(row && row.couponCurrency) || 'CNY';
    const basePrice = normalizeSingleProductCouponYuanAmountFromCent(row && row.currentDailyPriceMin);
    const couponAmountMin = normalizeSingleProductCouponYuanAmountFromCent(row && row.couponAmountMin);
    const couponAmountMax = normalizeSingleProductCouponYuanAmountFromCent(row && row.couponAmountMax);
    const suggestedAmount = normalizeSingleProductCouponYuanAmountFromCent(row && row.suggestCouponAmount);
    const costLookup = providedCostLookup instanceof Map
      ? providedCostLookup
      : buildSingleProductCouponQuickCostLookup();
    const costPrice = resolveSingleProductCouponRowCostPrice(row, costLookup);
    const fixedDiscount = normalizeSingleProductCouponOptionalNumber(
      marketingToolsState.singleProductCouponBatchCouponAmountFixedDiscount
    );
    const costProfitRate = normalizeSingleProductCouponOptionalNumber(
      marketingToolsState.singleProductCouponBatchCouponAmountCostProfitRate
    );
    const saleProfitRate = normalizeSingleProductCouponOptionalNumber(
      marketingToolsState.singleProductCouponBatchCouponAmountSaleProfitRate
    );
    const result = {
      amountMode,
      status: 'skip',
      statusCode: 'skip',
      reason: '',
      reasonCode: '',
      couponAmount: null,
      couponAmountText: '-',
      costPrice,
      costPriceText: costPrice !== null ? formatSingleProductCouponMoneyYuan(costPrice, couponCurrency) : '-',
      dealPrice: null,
      dealPriceText: '-',
      profitRate: null,
      profitRateText: '-',
      profitValue: null,
      profitValueText: '-'
    };

    if (!(basePrice !== null && basePrice > 0)) {
      result.reason = '\u7f3a\u5c11\u65e5\u5e38\u7533\u62a5\u4ef7';
      result.reasonCode = 'missing-base-price';
      return result;
    }

    let plannedCouponAmount = null;

    if (amountMode === 'min-eligible-price') {
      plannedCouponAmount = couponAmountMin;
    } else if (amountMode === 'max-eligible-price') {
      plannedCouponAmount = couponAmountMax;
    } else if (amountMode === 'suggested-amount') {
      plannedCouponAmount = suggestedAmount;
    } else if (amountMode === 'fixed-discount') {
      if (!(fixedDiscount !== null && fixedDiscount > 0)) {
        result.reason = '\u7f3a\u5c11\u56fa\u5b9a\u4f18\u60e0\u5238\u91d1\u989d';
        result.reasonCode = 'missing-fixed-discount';
        return result;
      }

      plannedCouponAmount = Number(fixedDiscount.toFixed(2));
    } else if (amountMode === 'cost-profit-rate') {
      if (!(costPrice !== null && costPrice > 0)) {
        result.reason = '\u7f3a\u5c11\u6210\u672c\u4ef7';
        result.reasonCode = 'missing-cost-price';
        return result;
      }

      if (!(costProfitRate !== null && costProfitRate > 0)) {
        result.reason = '\u7f3a\u5c11\u6210\u672c\u8ba9\u5229\u6bd4\u4f8b';
        result.reasonCode = 'missing-cost-profit-rate';
        return result;
      }

      plannedCouponAmount = Number(((costPrice * costProfitRate) / 100).toFixed(2));
    } else if (amountMode === 'sale-profit-rate') {
      if (!(saleProfitRate !== null && saleProfitRate > 0)) {
        result.reason = '\u7f3a\u5c11\u552e\u4ef7\u8ba9\u5229\u6bd4\u4f8b';
        result.reasonCode = 'missing-sale-profit-rate';
        return result;
      }

      plannedCouponAmount = Number(((basePrice * saleProfitRate) / 100).toFixed(2));

      if (!(Number.isFinite(plannedCouponAmount) && plannedCouponAmount > 0)) {
        result.reason = '\u552e\u4ef7\u8ba9\u5229\u6bd4\u4f8b\u8ba1\u7b97\u65e0\u6548';
        result.reasonCode = 'invalid-sale-profit-rate';
        return result;
      }
    }

    if (!(plannedCouponAmount !== null && Number.isFinite(plannedCouponAmount))) {
      result.reason = '\u5238\u91d1\u989d\u8ba1\u7b97\u65e0\u6548';
      result.reasonCode = 'invalid-coupon-amount';
      return result;
    }

    let clampedCouponAmount = plannedCouponAmount;

    if (couponAmountMin !== null) {
      clampedCouponAmount = Math.max(couponAmountMin, clampedCouponAmount);
    }

    if (couponAmountMax !== null) {
      clampedCouponAmount = Math.min(couponAmountMax, clampedCouponAmount);
    }

    if (!(Number.isFinite(clampedCouponAmount) && clampedCouponAmount >= 0)) {
      result.reason = '\u5238\u91d1\u989d\u4e0d\u5728\u53ef\u914d\u8303\u56f4';
      result.reasonCode = 'coupon-out-of-range';
      return result;
    }

    const finalDealPrice = Number((basePrice - clampedCouponAmount).toFixed(2));

    if (!(Number.isFinite(finalDealPrice) && finalDealPrice > 0)) {
      result.reason = '\u5238\u540e\u6210\u4ea4\u4ef7\u65e0\u6548';
      result.reasonCode = 'invalid-deal-price';
      return result;
    }

    result.couponAmount = Number(clampedCouponAmount.toFixed(2));
    result.couponAmountText = formatSingleProductCouponMoneyYuan(result.couponAmount, couponCurrency);
    result.dealPrice = finalDealPrice;
    result.dealPriceText = formatSingleProductCouponMoneyYuan(finalDealPrice, couponCurrency);

    const floorState = resolveSingleProductCouponProfitFloorState(costPrice);
    const requiresCostPrice = amountMode === 'cost-profit-rate'
      || floorState.hasProfitFloorRate === true
      || floorState.hasProfitFloorValue === true;

    if (!(costPrice !== null && costPrice > 0)) {
      result.status = requiresCostPrice ? 'skip' : 'ready';
      result.statusCode = result.status;
      result.reason = requiresCostPrice
        ? '\u7f3a\u5c11\u6210\u672c\u4ef7'
        : '\u5df2\u6309\u89c4\u5219\u8ba1\u7b97\u5238\u91d1\u989d';
      result.reasonCode = requiresCostPrice
        ? 'missing-cost-price'
        : 'ready-without-cost';
      return result;
    }

    const floorEvaluation = evaluateSingleProductCouponProfitFloor(finalDealPrice, costPrice);

    result.profitRate = Number.isFinite(floorEvaluation.profitRate)
      ? Number(floorEvaluation.profitRate.toFixed(2))
      : null;
    result.profitRateText = result.profitRate !== null
      ? formatSingleProductCouponPercent(result.profitRate)
      : '-';
    result.profitValue = Number.isFinite(floorEvaluation.profitValue)
      ? Number(floorEvaluation.profitValue.toFixed(2))
      : null;
    result.profitValueText = result.profitValue !== null
      ? formatSingleProductCouponMoneyYuan(result.profitValue, couponCurrency)
      : '-';

    if (floorEvaluation.meetsFloor !== true) {
      result.reason = buildSingleProductCouponProfitFloorFailReason(floorEvaluation);
      result.reasonCode = 'profit-floor-not-met';
      return result;
    }

    result.status = 'ready';
    result.statusCode = 'ready';
    result.reason = '\u5df2\u6309\u6210\u672c\u548c\u5229\u6da6\u89c4\u5219\u8ba1\u7b97';
    result.reasonCode = 'ready';
    return result;
  }

  function normalizeSingleProductCouponQuickCostSpecSegment(segmentText) {
    return normalizeText(segmentText)
      .replace(/\s+/g, ' ')
      .replace(/[\uff1a\u0156\u0113\u951b\u6b56]/g, ':')
      .replace(/(\d+)\s*pcs?\b/gi, '$1pc')
      .replace(/\s*:\s*/g, ':');
  }

  function buildSingleProductCouponQuickCostSpecSegments(specText) {
    const catalog = getOperationsSharedCatalog();

    if (catalog && typeof catalog.buildNormalizedCostSpecSegments === 'function') {
      return catalog.buildNormalizedCostSpecSegments(specText);
    }

    return Array.from(new Set(
      normalizeText(specText)
        .split(/[|,\uff0c]/)
        .map((segment) => normalizeSingleProductCouponQuickCostSpecSegment(segment))
        .filter(Boolean)
    ));
  }

  function normalizeSingleProductCouponQuickCostSpecIdentity(specText) {
    const catalog = getOperationsSharedCatalog();

    if (catalog && typeof catalog.normalizeCostSpecText === 'function') {
      return catalog.normalizeCostSpecText(specText);
    }

    const segments = buildSingleProductCouponQuickCostSpecSegments(specText);
    return segments.length > 0
      ? segments.join('\uff0c')
      : normalizeText(specText);
  }

  function resolveSingleProductCouponQuickCostStationValue(source = {}) {
    const stationIds = Array.isArray(source && source.stationIds)
      ? source.stationIds.map((stationId) => normalizeText(stationId)).filter(Boolean)
      : [];

    return normalizeText(
      source && (
        source.station
        || source.siteId
        || stationIds[0]
        || source.stationLabel
        || source.siteName
      )
    );
  }

  function buildSingleProductCouponQuickCostLegacyKey(shopId, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedSpec = normalizeSingleProductCouponQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildSingleProductCouponQuickCostEntryKey(shopId, station, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedSpec = normalizeSingleProductCouponQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return normalizedStation
      ? `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedSpec}`.toLowerCase()
      : buildSingleProductCouponQuickCostLegacyKey(normalizedShopId, normalizedSpec);
  }

  function groupSingleProductCouponQuickCostDialogEntries(entries) {
    const groups = [];
    const groupMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!groupMap.has(shopId)) {
        const nextGroup = {
          shopId,
          shopName: normalizeText(entry && entry.shopName),
          entries: []
        };

        groupMap.set(shopId, nextGroup);
        groups.push(nextGroup);
      }

      groupMap.get(shopId).entries.push(entry);
    });

    return groups;
  }

  function getMarketingToolsWorkbenchElement() {
    return document.querySelector('.ops-marketing-tools-workbench');
  }

  function getSingleProductCouponPanelElement() {
    return document.querySelector('[data-marketing-tools-panel="single-product-coupon"]');
  }

  function shouldUseCollapsedSingleProductCouponResultsLayout(viewport, workbench) {
    const viewportWidth = Math.max(
      0,
      Number(
        (viewport && viewport.clientWidth)
        || (workbench && workbench.clientWidth)
        || 0
      ) || 0
    );

    return viewportWidth > 0 && viewportWidth <= MARKETING_TOOLS_RESULT_COLLAPSE_WIDTH;
  }

  function syncSingleProductCouponResultsResponsiveState() {
    const workbench = getMarketingToolsWorkbenchElement();

    if (!(workbench instanceof HTMLElement)) {
      return;
    }

    const viewport = workbench.querySelector('.ops-marketing-tools-results-viewport');

    if (!(viewport instanceof HTMLElement)) {
      workbench.classList.remove('ops-marketing-tools-results-collapsed');
      return;
    }

    workbench.classList.toggle(
      'ops-marketing-tools-results-collapsed',
      shouldUseCollapsedSingleProductCouponResultsLayout(viewport, workbench)
    );
  }

  function scheduleSingleProductCouponResultsResponsiveState() {
    if (marketingToolsResultsResponsiveFrameId) {
      window.cancelAnimationFrame(marketingToolsResultsResponsiveFrameId);
    }

    marketingToolsResultsResponsiveFrameId = window.requestAnimationFrame(() => {
      marketingToolsResultsResponsiveFrameId = 0;
      syncSingleProductCouponResultsResponsiveState();
      scheduleSingleProductCouponResultsViewportRestore(getSingleProductCouponPanelElement());
    });
  }

  function getSingleProductCouponResultRowMetrics(rows) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const cachedMetrics = marketingToolsState.singleProductCouponResultRowMetricsCache
      && typeof marketingToolsState.singleProductCouponResultRowMetricsCache === 'object'
      ? marketingToolsState.singleProductCouponResultRowMetricsCache
      : null;

    if (cachedMetrics && cachedMetrics.rows === normalizedRows) {
      return cachedMetrics;
    }

    const rowMetaList = [];
    let runningOffsetTop = 0;

    normalizedRows.forEach((row, index) => {
      const height = resolveSingleProductCouponResultRowHeight(row);

      rowMetaList.push({
        index,
        offsetTop: runningOffsetTop,
        height
      });
      runningOffsetTop += height;
    });

    const nextMetrics = {
      rows: normalizedRows,
      rowMetaList,
      totalHeight: runningOffsetTop
    };

    marketingToolsState.singleProductCouponResultRowMetricsCache = nextMetrics;
    return nextMetrics;
  }

  function findSingleProductCouponResultRowIndexByOffset(rowMetaList, offset, options = {}) {
    const normalizedMetaList = Array.isArray(rowMetaList) ? rowMetaList : [];
    const normalizedOffset = Math.max(0, Number(offset) || 0);
    const compareTopOnly = options.compareTopOnly === true;

    if (normalizedMetaList.length <= 0) {
      return 0;
    }

    let left = 0;
    let right = normalizedMetaList.length;

    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      const middleValue = compareTopOnly
        ? normalizedMetaList[middle].offsetTop
        : (normalizedMetaList[middle].offsetTop + normalizedMetaList[middle].height);

      if (middleValue <= normalizedOffset) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    return Math.max(0, Math.min(normalizedMetaList.length, left));
  }

  function computeSingleProductCouponVirtualRange(rows, scrollTop, viewportHeight) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const normalizedRowCount = normalizedRows.length;
    const normalizedScrollTop = Math.max(0, Number(scrollTop) || 0);
    const normalizedViewportHeight = Math.max(0, Number(viewportHeight) || 0);
    const effectiveScrollTop = Math.max(0, normalizedScrollTop - MARKETING_TOOLS_RESULT_HEAD_HEIGHT);
    const effectiveViewportHeight = Math.max(0, normalizedViewportHeight - MARKETING_TOOLS_RESULT_HEAD_HEIGHT);
    const metrics = getSingleProductCouponResultRowMetrics(normalizedRows);
    const rowMetaList = metrics.rowMetaList;
    let startIndex = findSingleProductCouponResultRowIndexByOffset(rowMetaList, effectiveScrollTop, {
      compareTopOnly: false
    });

    startIndex = Math.max(0, startIndex - MARKETING_TOOLS_RESULT_OVERSCAN);

    const viewportBottom = effectiveScrollTop + effectiveViewportHeight;
    let endIndex = findSingleProductCouponResultRowIndexByOffset(rowMetaList, viewportBottom, {
      compareTopOnly: true
    });

    endIndex = Math.min(
      normalizedRowCount,
      Math.max(startIndex + 12, endIndex + MARKETING_TOOLS_RESULT_OVERSCAN)
    );

    const startRowMeta = rowMetaList[startIndex] || null;

    return {
      startIndex,
      endIndex,
      offsetTop: startRowMeta ? startRowMeta.offsetTop : 0,
      totalHeight: metrics.totalHeight
    };
  }

  function renderSingleProductCouponVirtualResultRows(rows, startIndex, costLookup) {
    return (Array.isArray(rows) ? rows : []).map((row, index) => {
      return renderSingleProductCouponResultRow(row, startIndex + index, costLookup);
    }).join('');
  }

  function bindSingleProductCouponResultsViewport(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const viewport = container.querySelector('.ops-marketing-tools-results-viewport');

    if (!(viewport instanceof HTMLElement) || viewport.__singleProductCouponViewportBound === true) {
      return;
    }

    viewport.__singleProductCouponViewportBound = true;
    viewport.addEventListener('scroll', () => {
      marketingToolsState.singleProductCouponResultViewportScrollTop = viewport.scrollTop;
      marketingToolsState.singleProductCouponResultViewportScrollLeft = viewport.scrollLeft;
      scheduleSingleProductCouponResultsViewportRefresh(container);
    }, {
      passive: true
    });
  }

  function renderSingleProductCouponResultsViewport(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const rows = Array.isArray(marketingToolsState.singleProductCouponQueryRows)
      ? marketingToolsState.singleProductCouponQueryRows
      : [];
    const workbench = getMarketingToolsWorkbenchElement();
    const viewport = container.querySelector('.ops-marketing-tools-results-viewport');
    const virtualBody = container.querySelector('[data-single-product-coupon-results-virtual-body]');
    const virtualWindow = container.querySelector('[data-single-product-coupon-results-virtual-window]');

    if (
      !(viewport instanceof HTMLElement)
      || !(virtualBody instanceof HTMLElement)
      || !(virtualWindow instanceof HTMLElement)
    ) {
      return;
    }

    const useCollapsedLayout = shouldUseCollapsedSingleProductCouponResultsLayout(viewport, workbench);
    if (workbench instanceof HTMLElement) {
      workbench.classList.toggle('ops-marketing-tools-results-collapsed', useCollapsedLayout);
    }

    const costLookup = buildSingleProductCouponQuickCostLookup();

    if (useCollapsedLayout) {
      virtualBody.style.height = 'auto';
      virtualWindow.style.transform = 'none';
      virtualWindow.innerHTML = renderSingleProductCouponVirtualResultRows(rows, 0, costLookup);
      return;
    }

    const range = computeSingleProductCouponVirtualRange(
      rows,
      marketingToolsState.singleProductCouponResultViewportScrollTop,
      viewport.clientHeight
    );
    const visibleRows = rows.slice(range.startIndex, range.endIndex);

    virtualBody.style.height = `${range.totalHeight}px`;
    virtualWindow.style.transform = `translateY(${range.offsetTop}px)`;
    virtualWindow.innerHTML = renderSingleProductCouponVirtualResultRows(visibleRows, range.startIndex, costLookup);
  }

  function restoreSingleProductCouponResultsViewport(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const viewport = container.querySelector('.ops-marketing-tools-results-viewport');

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    renderSingleProductCouponResultsViewport(container);

    const desiredTop = Math.max(0, Number(marketingToolsState.singleProductCouponResultViewportScrollTop) || 0);
    const desiredLeft = Math.max(0, Number(marketingToolsState.singleProductCouponResultViewportScrollLeft) || 0);

    if (Math.abs(viewport.scrollTop - desiredTop) > 1) {
      viewport.scrollTop = desiredTop;
    }

    if (Math.abs(viewport.scrollLeft - desiredLeft) > 1) {
      viewport.scrollLeft = desiredLeft;
    }

    marketingToolsState.singleProductCouponResultViewportResetPending = false;
    renderSingleProductCouponResultsViewport(container);
  }

  function scheduleSingleProductCouponResultsViewportRestore(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (container.__singleProductCouponResultsViewportRestoreFrameId) {
      window.cancelAnimationFrame(container.__singleProductCouponResultsViewportRestoreFrameId);
    }

    container.__singleProductCouponResultsViewportRestoreFrameId = window.requestAnimationFrame(() => {
      container.__singleProductCouponResultsViewportRestoreFrameId = 0;
      restoreSingleProductCouponResultsViewport(container);
    });
  }

  function scheduleSingleProductCouponResultsViewportRefresh(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (container.__singleProductCouponResultsViewportRefreshFrameId) {
      window.cancelAnimationFrame(container.__singleProductCouponResultsViewportRefreshFrameId);
    }

    container.__singleProductCouponResultsViewportRefreshFrameId = window.requestAnimationFrame(() => {
      container.__singleProductCouponResultsViewportRefreshFrameId = 0;
      renderSingleProductCouponResultsViewport(container);
    });
  }

  function captureSingleProductCouponResultsViewportState(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (marketingToolsState.singleProductCouponResultViewportResetPending === true) {
      return;
    }

    const viewport = container.querySelector('.ops-marketing-tools-results-viewport');

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    marketingToolsState.singleProductCouponResultViewportScrollTop = viewport.scrollTop;
    marketingToolsState.singleProductCouponResultViewportScrollLeft = viewport.scrollLeft;
  }

  function captureSingleProductCouponShopSelectorPanelScroll(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    const sectionList = container.querySelector('.shop-multi-select-section-list');

    if (!(sectionList instanceof HTMLElement)) {
      return null;
    }

    return {
      top: sectionList.scrollTop,
      left: sectionList.scrollLeft
    };
  }

  function restoreSingleProductCouponShopSelectorPanelScroll(container, snapshot) {
    if (!(container instanceof HTMLElement) || !snapshot) {
      return;
    }

    const sectionList = container.querySelector('.shop-multi-select-section-list');

    if (!(sectionList instanceof HTMLElement)) {
      return;
    }

    sectionList.scrollTop = Number(snapshot.top) || 0;
    sectionList.scrollLeft = Number(snapshot.left) || 0;
  }

  function buildEmptyShopCatalog() {
    const control = getShopMultiSelectControl();

    if (control && typeof control.buildEmptyCatalog === 'function') {
      return control.buildEmptyCatalog();
    }

    return {
      updatedAt: '',
      shops: [],
      sections: [],
      shopMap: Object.create(null)
    };
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    const control = getShopMultiSelectControl();

    if (control && typeof control.normalizeSelectedShopIds === 'function') {
      return control.normalizeSelectedShopIds(selectedShopIds);
    }

    return Array.from(new Set(
      (Array.isArray(selectedShopIds) ? selectedShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function normalizeProductIdType(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    return PRODUCT_ID_TYPE_OPTIONS.some((option) => option.value === normalizedValue)
      ? normalizedValue
      : PRODUCT_ID_TYPE_OPTIONS[0].value;
  }

  function createShopSelectionPresetState(scopeKey) {
    const helper = getShopSelectionTemplateHelper();

    if (helper && typeof helper.createState === 'function') {
      return helper.createState(scopeKey);
    }

    return {
      scopeKey,
      templates: [],
      lastSelection: {
        scopeKey,
        selectedShopIds: [],
        updatedAt: ''
      },
      templateName: '',
      loading: false,
      saving: false,
      loaded: true,
      error: '',
      promise: null
    };
  }

  function buildShopSelectionPresetConfig(presetState) {
    const helper = getShopSelectionTemplateHelper();

    if (helper && typeof helper.buildControlConfig === 'function') {
      return helper.buildControlConfig(presetState);
    }

    return {
      enabled: false
    };
  }

  function buildEmptyCategorySnapshot() {
    const control = getCategoryCascadeControl();

    if (control && typeof control.buildEmptySnapshot === 'function') {
      return control.buildEmptySnapshot();
    }

    return {
      updatedAt: '',
      syncedAt: '',
      shopId: '',
      sourceOrigin: '',
      categories: [],
      source: 'default',
      cloudSynced: false,
      warning: ''
    };
  }

  function normalizeCategorySnapshot(snapshot) {
    const control = getCategoryCascadeControl();

    if (control && typeof control.normalizeSnapshot === 'function') {
      return control.normalizeSnapshot(snapshot);
    }

    return buildEmptyCategorySnapshot();
  }

  function normalizeCategoryList(categories) {
    const control = getCategoryCascadeControl();

    if (control && typeof control.normalizeCategoryList === 'function') {
      return control.normalizeCategoryList(categories);
    }

    return [];
  }

  function normalizeCategoryPath(path) {
    const control = getCategoryCascadeControl();

    if (control && typeof control.normalizePath === 'function') {
      return control.normalizePath(path);
    }

    return [];
  }

  function buildCategoryPathKey(path) {
    const control = getCategoryCascadeControl();

    if (control && typeof control.buildPathKey === 'function') {
      return control.buildPathKey(path);
    }

    return normalizeCategoryPath(path)
      .map((item) => normalizeText(item && item.id))
      .filter(Boolean)
      .join('/');
  }

  function normalizeCategoryCheckedPaths(paths) {
    const control = getCategoryCascadeControl();

    if (control && typeof control.normalizePathCollection === 'function') {
      return control.normalizePathCollection(paths);
    }

    const pathMap = new Map();

    (Array.isArray(paths) ? paths : []).forEach((path) => {
      const normalizedPath = normalizeCategoryPath(path);
      const pathKey = buildCategoryPathKey(normalizedPath);

      if (!pathKey || pathMap.has(pathKey)) {
        return;
      }

      pathMap.set(pathKey, normalizedPath);
    });

    return Array.from(pathMap.values());
  }

  function normalizeCategorySearchResults(results) {
    const control = getCategoryCascadeControl();

    if (control && typeof control.normalizeSearchResultList === 'function') {
      return control.normalizeSearchResultList(results);
    }

    return [];
  }

  function createMarketingToolsState() {
    const defaultBatchCouponTimeRange = buildSingleProductCouponBatchCouponDefaultTimeRange();

    return {
      singleProductCouponSelectedShopIds: [],
      singleProductCouponActiveSubtabId: SINGLE_PRODUCT_COUPON_SUBTAB_CONFIG[0].id,
      singleProductCouponShopCatalog: buildEmptyShopCatalog(),
      singleProductCouponShopSelectorOpen: false,
      singleProductCouponShopSelectorKeyword: '',
      singleProductCouponShopSelectorFocusSearch: false,
      singleProductCouponShopSelectorLoading: false,
      singleProductCouponShopSelectorLoaded: false,
      singleProductCouponShopSelectorError: '',
      singleProductCouponShopSelectorPromise: null,
      singleProductCouponShopSelectionPreset: createShopSelectionPresetState(SINGLE_PRODUCT_COUPON_SHOP_SELECTION_SCOPE_KEY),
      singleProductCouponShopSelectionTouched: false,
      singleProductCouponShopSelectionPreferenceLoaded: false,
      singleProductCouponShopSelectionPreferenceLoading: false,
      singleProductCouponShopSelectionPreferencePromise: null,
      singleProductCouponCategorySnapshot: buildEmptyCategorySnapshot(),
      singleProductCouponCategorySelectedPath: [],
      singleProductCouponCategoryCheckedPaths: [],
      singleProductCouponCategoryColumns: [],
      singleProductCouponCategoryRootLoading: false,
      singleProductCouponCategoryRootLoaded: false,
      singleProductCouponCategoryRootError: '',
      singleProductCouponCategoryRootPromise: null,
      singleProductCouponCategoryChildCache: Object.create(null),
      singleProductCouponCategoryChildLoadingKey: '',
      singleProductCouponCategoryChildErrorKey: '',
      singleProductCouponCategoryChildError: '',
      singleProductCouponCategorySelectorOpen: false,
      singleProductCouponCategorySearchKeyword: '',
      singleProductCouponCategorySearchResults: [],
      singleProductCouponCategorySearchLoading: false,
      singleProductCouponCategorySearchError: '',
      singleProductCouponCategorySearchTotal: 0,
      singleProductCouponCategorySearchTimer: 0,
      singleProductCouponCategorySearchRequestId: 0,
      singleProductCouponCategorySearchFocusInput: false,
      singleProductCouponProductIdType: PRODUCT_ID_TYPE_OPTIONS[0].value,
      singleProductCouponProductIdKeywords: '',
      singleProductCouponDailyPriceMin: '',
      singleProductCouponDailyPriceMax: '',
      singleProductCouponQueryRunId: '',
      singleProductCouponQueryRunning: false,
      singleProductCouponCreateRunning: false,
      singleProductCouponCreateRunId: '',
      singleProductCouponQueryStopping: false,
      singleProductCouponQueryProgressText: '',
      singleProductCouponQueryError: '',
      singleProductCouponQueryResultSummaryText: '',
      singleProductCouponQueryRows: [],
      singleProductCouponCreateRowStatusMap: Object.create(null),
      singleProductCouponResultViewportScrollTop: 0,
      singleProductCouponResultViewportScrollLeft: 0,
      singleProductCouponResultViewportResetPending: false,
      singleProductCouponResultRowMetricsCache: null,
      singleProductCouponQueryShopResults: [],
      singleProductCouponQueryUpdatedAt: '',
      singleProductCouponQueryWarning: '',
      singleProductCouponQueryRawRowCount: 0,
      singleProductCouponQueryFilteredConfiguredCount: 0,
      singleProductCouponQueryCompletedShopCount: 0,
      singleProductCouponQueryFailedShopCount: 0,
      singleProductCouponQueryCanceledShopCount: 0,
      singleProductCouponBatchCouponSettingsLoaded: false,
      singleProductCouponBatchCouponSettingsLoading: false,
      singleProductCouponBatchCouponSettingsSaving: false,
      singleProductCouponBatchCouponSettingsPromise: null,
      singleProductCouponQuickCostDialogOpen: false,
      singleProductCouponQuickCostDialogLoading: false,
      singleProductCouponQuickCostDialogSaving: false,
      singleProductCouponQuickCostDialogError: '',
      singleProductCouponQuickCostDialogWarning: '',
      singleProductCouponQuickCostDialogNotice: '',
      singleProductCouponQuickCostDialogEntries: [],
      singleProductCouponQuickCostEntries: [],
      singleProductCouponQuickCostDialogShopCount: 0,
      singleProductCouponQuickCostDialogSourceEntryCount: 0,
      singleProductCouponQuickCostDialogMergedEntryCount: 0,
      singleProductCouponQuickCostDialogConflictCount: 0,
      singleProductCouponBatchCouponDialogOpen: false,
      singleProductCouponBatchCouponDialogSaving: false,
      singleProductCouponBatchCouponDialogError: '',
      singleProductCouponBatchCouponDialogWarning: '',
      singleProductCouponBatchCouponDialogNotice: '',
      singleProductCouponBatchCouponTypes: SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS.map((option) => option.value),
      singleProductCouponBatchCouponName: '',
      singleProductCouponBatchCouponQuantity: '200',
      singleProductCouponBatchCouponStartTime: defaultBatchCouponTimeRange.start,
      singleProductCouponBatchCouponEndTime: defaultBatchCouponTimeRange.end,
      singleProductCouponBatchCouponAmountMode: DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE,
      singleProductCouponBatchCouponAmountFixedDiscount: '',
      singleProductCouponBatchCouponAmountCostProfitRate: '',
      singleProductCouponBatchCouponAmountSaleProfitRate: '',
      singleProductCouponBatchCouponProfitFloorLogic: DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_PROFIT_FLOOR_LOGIC,
      singleProductCouponBatchCouponProfitFloorRate: '',
      singleProductCouponBatchCouponProfitFloorValue: '',
      singleProductCouponBatchCouponDialogTypes: [],
      singleProductCouponBatchCouponDialogName: '',
      singleProductCouponBatchCouponDialogQuantity: '200',
      singleProductCouponBatchCouponDialogStartTime: defaultBatchCouponTimeRange.start,
      singleProductCouponBatchCouponDialogEndTime: defaultBatchCouponTimeRange.end,
      singleProductCouponBatchCouponDialogAmountMode: DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE,
      singleProductCouponBatchCouponDialogAmountFixedDiscount: '',
      singleProductCouponBatchCouponDialogAmountCostProfitRate: '',
      singleProductCouponBatchCouponDialogAmountSaleProfitRate: '',
      singleProductCouponBatchCouponDialogProfitFloorLogic: DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_PROFIT_FLOOR_LOGIC,
      singleProductCouponBatchCouponDialogProfitFloorRate: '',
      singleProductCouponBatchCouponDialogProfitFloorValue: ''
    };
  }

  function parseSingleProductCouponIntegerList(value) {
    return Array.from(new Set(
      normalizeText(value)
        .split(/[\s,\uff0c;\uff1b]+/)
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .filter((item) => /^\d+$/.test(item))
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item) && item > 0)
    ));
  }

  function formatSingleProductCouponMoneyText(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '';
    }

    return `\u00a5${(numericValue / 100).toFixed(2)}`;
  }

  function formatSingleProductCouponUpdatedAt(value) {
    const timestamp = Date.parse(normalizeText(value));

    if (!Number.isFinite(timestamp)) {
      return '';
    }

    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${month}-${day} ${hour}:${minute}:${second}`;
  }

  function buildSingleProductCouponResultSummaryText() {
    const queryDiagnostics = buildSingleProductCouponQueryDiagnostics();
    const totals = queryDiagnostics.totals;
    const summaryParts = [];

    if (totals.candidateCount > 0) {
      summaryParts.push(`\u5019\u9009 ${totals.candidateCount} \u4e2a`);
    }

    if (totals.readyCount > 0) {
      summaryParts.push(`\u53ef\u521b\u5efa ${totals.readyCount} \u4e2a`);
    }

    if (marketingToolsState.singleProductCouponQueryFilteredConfiguredCount > 0) {
      summaryParts.push(`\u5df2\u521b\u5efa\u4f18\u60e0\u5238\u8fc7\u6ee4 ${marketingToolsState.singleProductCouponQueryFilteredConfiguredCount} \u4e2a`);
    }

    if (totals.missingCostCount > 0) {
      summaryParts.push(`\u7f3a\u6210\u672c ${totals.missingCostCount} \u4e2a`);
    }

    if (totals.profitFloorBlockedCount > 0) {
      summaryParts.push(`\u5229\u6da6\u4e0d\u8db3 ${totals.profitFloorBlockedCount} \u4e2a`);
    }

    if (marketingToolsState.singleProductCouponQueryCompletedShopCount > 0 || marketingToolsState.singleProductCouponQueryFailedShopCount > 0) {
      summaryParts.push(
        `\u5e97\u94fa ${marketingToolsState.singleProductCouponQueryCompletedShopCount}\u6210\u529f/${marketingToolsState.singleProductCouponQueryFailedShopCount}\u5931\u8d25`
      );
    }

    const updatedAtText = formatSingleProductCouponUpdatedAt(marketingToolsState.singleProductCouponQueryUpdatedAt);

    if (updatedAtText) {
      summaryParts.push(`\u66f4\u65b0 ${updatedAtText}`);
    }

    return summaryParts.join(' | ');
  }

  function createSingleProductCouponQueryDiagnosticTotals() {
    return {
      candidateCount: 0,
      readyCount: 0,
      missingCostCount: 0,
      profitFloorBlockedCount: 0,
      platformLimitedCount: 0,
      missingAgreementCount: 0,
      otherBlockedCount: 0
    };
  }

  function createSingleProductCouponShopQueryDiagnostic(shopId, shopName) {
    return {
      shopId: normalizeText(shopId),
      shopName: normalizeText(shopName),
      candidateCount: 0,
      readyCount: 0,
      missingCostCount: 0,
      profitFloorBlockedCount: 0,
      platformLimitedCount: 0,
      missingAgreementCount: 0,
      otherBlockedCount: 0
    };
  }

  function incrementSingleProductCouponQueryDiagnosticField(target, fieldName) {
    if (!target || !fieldName) {
      return;
    }

    target[fieldName] = Math.max(0, Number.parseInt(target[fieldName], 10) || 0) + 1;
  }

  function buildSingleProductCouponQueryDiagnostics() {
    const rows = Array.isArray(marketingToolsState.singleProductCouponQueryRows)
      ? marketingToolsState.singleProductCouponQueryRows
      : [];
    const costLookup = buildSingleProductCouponQuickCostLookup();
    const totals = createSingleProductCouponQueryDiagnosticTotals();
    const byShopId = Object.create(null);

    rows.forEach((row) => {
      if (!row || typeof row !== 'object') {
        return;
      }

      const shopId = normalizeText(row && row.shopId);
      const shopName = normalizeText(row && row.shopName) || shopId;
      const diagnostic = byShopId[shopId] || createSingleProductCouponShopQueryDiagnostic(shopId, shopName);
      const couponPreview = resolveSingleProductCouponPlannedCouponPreview(row, costLookup);
      const reasonCode = normalizeText(couponPreview && couponPreview.reasonCode);
      const previewStatus = normalizeText(couponPreview && couponPreview.status);
      const agreementId = normalizeText(row && row.agreementId);
      const hasPlatformLimit = row && row.shouldFilterOut === true
        || Boolean(normalizeText(row && row.filterReasonText));

      byShopId[shopId] = diagnostic;
      diagnostic.shopName = shopName;
      incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'candidateCount');
      incrementSingleProductCouponQueryDiagnosticField(totals, 'candidateCount');

      if (hasPlatformLimit) {
        incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'platformLimitedCount');
        incrementSingleProductCouponQueryDiagnosticField(totals, 'platformLimitedCount');
        return;
      }

      if (previewStatus === 'ready' && agreementId) {
        incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'readyCount');
        incrementSingleProductCouponQueryDiagnosticField(totals, 'readyCount');
        return;
      }

      if (previewStatus === 'ready' && !agreementId) {
        incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'missingAgreementCount');
        incrementSingleProductCouponQueryDiagnosticField(totals, 'missingAgreementCount');
        return;
      }

      if (reasonCode === 'missing-cost-price') {
        incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'missingCostCount');
        incrementSingleProductCouponQueryDiagnosticField(totals, 'missingCostCount');
        return;
      }

      if (reasonCode === 'profit-floor-not-met') {
        incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'profitFloorBlockedCount');
        incrementSingleProductCouponQueryDiagnosticField(totals, 'profitFloorBlockedCount');
        return;
      }

      incrementSingleProductCouponQueryDiagnosticField(diagnostic, 'otherBlockedCount');
      incrementSingleProductCouponQueryDiagnosticField(totals, 'otherBlockedCount');
    });

    return {
      totals,
      byShopId
    };
  }

  function resetSingleProductCouponQueryProgressState() {
    marketingToolsState.singleProductCouponQueryProgressText = '';
    marketingToolsState.singleProductCouponQueryError = '';
  }

  function buildSingleProductCouponBatchCreateRows() {
    const costLookup = buildSingleProductCouponQuickCostLookup();

    return (Array.isArray(marketingToolsState.singleProductCouponQueryRows)
      ? marketingToolsState.singleProductCouponQueryRows
      : []
    ).map((row) => {
      const couponPreview = resolveSingleProductCouponPlannedCouponPreview(row, costLookup);

      return {
        row,
        couponPreview
      };
    }).filter((entry) => {
      const row = entry && entry.row;
      const couponPreview = entry && entry.couponPreview;

      return row
        && row.shouldFilterOut !== true
        && !normalizeText(row && row.filterReasonText)
        && normalizeText(couponPreview && couponPreview.status) === 'ready';
    }).map((entry) => {
      const row = entry.row;
      const couponPreview = entry.couponPreview;
      const shopId = normalizeText(row && row.shopId);
      const productId = normalizeText(row && row.productId);
      const goodsId = normalizeText(row && row.goodsId);

      return {
        rowKey: normalizeText(row && row.rowKey) || `${shopId}:${productId || goodsId}:${goodsId || productId}`,
        shopId,
        shopName: normalizeText(row && row.shopName),
        productId,
        goodsId,
        agreementId: normalizeText(row && row.agreementId),
        couponCurrency: normalizeText(row && row.couponCurrency) || 'CNY',
        couponAmountYuan: Number(couponPreview && couponPreview.couponAmount)
      };
    }).filter((row) => {
      return row.shopId
        && row.productId
        && row.goodsId
        && row.agreementId
        && Number.isFinite(row.couponAmountYuan)
        && row.couponAmountYuan > 0;
    });
  }

  function buildSingleProductCouponCreateStatusMapKey(source = {}) {
    const rowKey = normalizeText(source && source.rowKey);

    if (rowKey) {
      return `row:${rowKey}`;
    }

    const productId = normalizeText(source && source.productId);
    const goodsId = normalizeText(source && source.goodsId);

    if (productId && goodsId) {
      return `pg:${productId}\x1f${goodsId}`;
    }

    return '';
  }

  function buildSingleProductCouponCreateStatusTypeKey(couponType) {
    return Number.parseInt(couponType, 10) === 2 ? '2' : '1';
  }

  function resetSingleProductCouponCreateRowStatusMap() {
    marketingToolsState.singleProductCouponCreateRowStatusMap = Object.create(null);
  }

  function updateSingleProductCouponCreateRowStatuses(items, options = {}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const nextMap = {
      ...(marketingToolsState.singleProductCouponCreateRowStatusMap || Object.create(null))
    };
    const clearMissingTypes = options.clearMissingTypes === true;

    normalizedItems.forEach((item) => {
      const key = buildSingleProductCouponCreateStatusMapKey(item);

      if (!key) {
        return;
      }

      const typeKey = buildSingleProductCouponCreateStatusTypeKey(item && item.couponType);
      const currentEntry = nextMap[key] && typeof nextMap[key] === 'object'
        ? { ...nextMap[key] }
        : {
          rowKey: normalizeText(item && item.rowKey),
          productId: normalizeText(item && item.productId),
          goodsId: normalizeText(item && item.goodsId),
          types: Object.create(null)
        };
      const currentTypes = currentEntry.types && typeof currentEntry.types === 'object'
        ? { ...currentEntry.types }
        : Object.create(null);

      currentTypes[typeKey] = {
        status: normalizeText(item && item.status),
        reason: normalizeText(item && item.reason),
        updatedAt: Date.now()
      };
      currentEntry.rowKey = currentEntry.rowKey || normalizeText(item && item.rowKey);
      currentEntry.productId = currentEntry.productId || normalizeText(item && item.productId);
      currentEntry.goodsId = currentEntry.goodsId || normalizeText(item && item.goodsId);
      currentEntry.types = currentTypes;
      nextMap[key] = currentEntry;
    });

    if (clearMissingTypes) {
      const allowedTypeKeys = new Set(
        normalizeSingleProductCouponBatchCouponTypes(marketingToolsState.singleProductCouponBatchCouponTypes, {
          allowEmpty: true
        }).map((value) => buildSingleProductCouponCreateStatusTypeKey(value))
      );

      Object.keys(nextMap).forEach((key) => {
        const entry = nextMap[key];
        const currentTypes = entry && entry.types && typeof entry.types === 'object'
          ? { ...entry.types }
          : Object.create(null);

        Object.keys(currentTypes).forEach((typeKey) => {
          if (!allowedTypeKeys.has(typeKey)) {
            delete currentTypes[typeKey];
          }
        });

        nextMap[key] = {
          ...entry,
          types: currentTypes
        };
      });
    }

    marketingToolsState.singleProductCouponCreateRowStatusMap = nextMap;
  }

  function getSingleProductCouponCreateRowStatusEntry(row) {
    const map = marketingToolsState.singleProductCouponCreateRowStatusMap || Object.create(null);
    const directKey = buildSingleProductCouponCreateStatusMapKey(row);

    if (directKey && map[directKey]) {
      return map[directKey];
    }

    const fallbackKey = buildSingleProductCouponCreateStatusMapKey({
      productId: normalizeText(row && row.productId),
      goodsId: normalizeText(row && row.goodsId)
    });

    return fallbackKey ? map[fallbackKey] || null : null;
  }

  function buildSingleProductCouponCreateStatusDetail(entry) {
    const selectedTypes = normalizeSingleProductCouponBatchCouponTypes(
      marketingToolsState.singleProductCouponBatchCouponTypes,
      {
        allowEmpty: true
      }
    );
    const normalizedEntry = entry && typeof entry === 'object' ? entry : null;
    const typeStatusMap = normalizedEntry && normalizedEntry.types && typeof normalizedEntry.types === 'object'
      ? normalizedEntry.types
      : Object.create(null);
    const typeDetails = [];
    let queuedCount = 0;
    let runningCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    selectedTypes.forEach((typeValue) => {
      const typeKey = buildSingleProductCouponCreateStatusTypeKey(typeValue);
      const typeOption = SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS.find((option) => normalizeText(option && option.value) === typeKey);
      const typeLabel = normalizeText(typeOption && typeOption.label) || typeKey;
      const statusRecord = typeStatusMap[typeKey];
      const status = normalizeText(statusRecord && statusRecord.status);
      const reason = normalizeText(statusRecord && statusRecord.reason);
      let suffix = '\u5f85\u63d0\u4ea4';

      if (status === 'running') {
        runningCount += 1;
        suffix = '\u521b\u5efa\u4e2d';
      } else if (status === 'queued') {
        queuedCount += 1;
        suffix = '\u5f85\u521b\u5efa';
      } else if (status === 'success') {
        successCount += 1;
        suffix = '\u5df2\u521b\u5efa';
      } else if (status === 'failed') {
        failedCount += 1;
        suffix = reason ? `\u5931\u8d25(${reason})` : '\u521b\u5efa\u5931\u8d25';
      } else if (status === 'skipped') {
        skippedCount += 1;
        suffix = reason ? `\u5df2\u8df3\u8fc7(${reason})` : '\u5df2\u8df3\u8fc7';
      }

      typeDetails.push(`${typeLabel}${suffix}`);
    });

    if (runningCount > 0) {
      return {
        label: '\u521b\u5efa\u4e2d',
        tone: 'is-accent',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (failedCount > 0 && (successCount > 0 || queuedCount > 0 || skippedCount > 0)) {
      return {
        label: '\u90e8\u5206\u5931\u8d25',
        tone: 'is-warning',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (failedCount > 0) {
      return {
        label: '\u521b\u5efa\u5931\u8d25',
        tone: 'is-warning',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (successCount > 0 && queuedCount > 0) {
      return {
        label: '\u90e8\u5206\u5b8c\u6210',
        tone: 'is-accent',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (successCount > 0 && skippedCount > 0) {
      return {
        label: '\u90e8\u5206\u5b8c\u6210',
        tone: 'is-accent',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (successCount > 0 && selectedTypes.length > 0 && successCount >= selectedTypes.length) {
      return {
        label: '\u5df2\u521b\u5efa',
        tone: 'is-success',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (skippedCount > 0) {
      return {
        label: '\u5df2\u8df3\u8fc7',
        tone: 'is-warning',
        detailText: typeDetails.join('\uff0c')
      };
    }

    if (queuedCount > 0) {
      return {
        label: '\u5f85\u521b\u5efa',
        tone: 'is-accent',
        detailText: typeDetails.join('\uff0c')
      };
    }

    return null;
  }

  function buildSingleProductCouponBatchCreateResultMessage(response) {
    const successCount = Math.max(0, Number.parseInt(response && response.successCount, 10) || 0);
    const failCount = Math.max(0, Number.parseInt(response && response.failCount, 10) || 0);
    const skippedRowCount = Math.max(0, Number.parseInt(response && response.skippedRowCount, 10) || 0);
    const chunkCount = Math.max(0, Number.parseInt(response && response.chunkCount, 10) || 0);
    const results = Array.isArray(response && response.results) ? response.results : [];
    const failedResult = results.find((item) => item && item.success !== true && normalizeText(item && item.message));
    const couponTypeSummaryMap = new Map();
    const summaryParts = [];

    summaryParts.push(`\u5df2\u521b\u5efa ${successCount} \u4e2a`);

    results.forEach((item) => {
      const couponType = Number.parseInt(item && item.couponType, 10);
      const successRowCount = Math.max(0, Number.parseInt(item && item.successCount, 10) || 0);
      const failRowCount = Math.max(0, Number.parseInt(item && item.failCount, 10) || 0);
      const key = couponType === 2 ? '2' : '1';
      const current = couponTypeSummaryMap.get(key) || {
        successCount: 0,
        failCount: 0
      };

      current.successCount += successRowCount;
      current.failCount += failRowCount;
      couponTypeSummaryMap.set(key, current);
    });

    if (couponTypeSummaryMap.size > 0) {
      const couponTypeParts = [];

      if (couponTypeSummaryMap.has('1')) {
        const typeSummary = couponTypeSummaryMap.get('1');
        couponTypeParts.push(`\u7acb\u51cf\u5238 ${typeSummary.successCount}\u6210\u529f/${typeSummary.failCount}\u5931\u8d25`);
      }

      if (couponTypeSummaryMap.has('2')) {
        const typeSummary = couponTypeSummaryMap.get('2');
        couponTypeParts.push(`\u60ca\u559c\u5238 ${typeSummary.successCount}\u6210\u529f/${typeSummary.failCount}\u5931\u8d25`);
      }

      if (couponTypeParts.length > 0) {
        summaryParts.push(couponTypeParts.join('\uff0c'));
      }
    }

    if (failCount > 0) {
      summaryParts.push(`\u5931\u8d25 ${failCount} \u4e2a`);
    }

    if (skippedRowCount > 0) {
      summaryParts.push(`\u8df3\u8fc7 ${skippedRowCount} \u4e2a`);
    }

    if (chunkCount > 0) {
      summaryParts.push(`\u5171\u63d0\u4ea4 ${chunkCount} \u6279`);
    }

    if (failedResult) {
      summaryParts.push(normalizeText(failedResult.message));
    }

    return summaryParts.join('\uff0c');
  }

  async function submitSingleProductCouponBatchCreateCoupons() {
    const featureCenterApi = getFeatureCenterApi();

    if (!featureCenterApi || typeof featureCenterApi.createMarketingToolsSingleProductCouponBatchCoupons !== 'function') {
      throw new Error('\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    await loadSingleProductCouponBatchCouponSettings();

    const selectedShopIds = buildSingleProductCouponQuickCostTargetShopIds();

    if (selectedShopIds.length <= 0) {
      marketingToolsState.singleProductCouponQueryWarning = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238';
      marketingToolsState.singleProductCouponQueryError = '';
      syncMarketingToolsDynamicPanels();
      return null;
    }

    if (marketingToolsState.singleProductCouponQueryRows.length <= 0) {
      marketingToolsState.singleProductCouponQueryWarning = '\u8bf7\u5148\u67e5\u8be2\u53ef\u914d\u5546\u54c1\u540e\u518d\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238';
      marketingToolsState.singleProductCouponQueryError = '';
      syncMarketingToolsDynamicPanels();
      return null;
    }

    const rows = buildSingleProductCouponBatchCreateRows();

    if (rows.length <= 0) {
      marketingToolsState.singleProductCouponQueryWarning = '\u5f53\u524d\u6ca1\u6709\u53ef\u4f18\u60e0\u7684\u5546\u54c1\uff0c\u8bf7\u5148\u8865\u5145\u6210\u672c\u6216\u8c03\u6574\u5238\u989d\u89c4\u5219';
      marketingToolsState.singleProductCouponQueryError = '';
      syncMarketingToolsDynamicPanels();
      return null;
    }

    const settings = buildSingleProductCouponBatchCouponSettingsPayload();
    const nextCreateRunId = `sp_coupon_create_${Date.now().toString(36)}`;
    const selectedCouponTypes = normalizeSingleProductCouponBatchCouponTypes(settings.couponTypes, {
      allowEmpty: true
    });

    marketingToolsState.singleProductCouponCreateRunId = nextCreateRunId;
    marketingToolsState.singleProductCouponCreateRunning = true;
    marketingToolsState.singleProductCouponQueryError = '';
    marketingToolsState.singleProductCouponQueryWarning = '';
    resetSingleProductCouponCreateRowStatusMap();
    updateSingleProductCouponCreateRowStatuses(rows.flatMap((row) => {
      return selectedCouponTypes.map((couponType) => ({
        rowKey: normalizeText(row && row.rowKey),
        productId: normalizeText(row && row.productId),
        goodsId: normalizeText(row && row.goodsId),
        couponType,
        status: 'queued'
      }));
    }));
    marketingToolsState.singleProductCouponQueryProgressText = `\u6b63\u5728\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238\uff0c\u5f85\u63d0\u4ea4 ${rows.length} \u4e2a\u5546\u54c1`;
    syncMarketingToolsDynamicPanels();

    try {
      const response = await featureCenterApi.createMarketingToolsSingleProductCouponBatchCoupons({
        runId: nextCreateRunId,
        settings,
        couponTypes: settings.couponTypes,
        rows
      });

      marketingToolsState.singleProductCouponQueryProgressText = '';

      if (response && response.success === true && Number.parseInt(response && response.failCount, 10) <= 0) {
        marketingToolsState.singleProductCouponQueryWarning = buildSingleProductCouponBatchCreateResultMessage(response);
      } else {
        marketingToolsState.singleProductCouponQueryWarning = buildSingleProductCouponBatchCreateResultMessage(response);
      }

      syncMarketingToolsDynamicPanels();
      return response;
    } catch (error) {
      marketingToolsState.singleProductCouponQueryProgressText = '';
      marketingToolsState.singleProductCouponQueryError = normalizeText(error && error.message) || '\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238\u5931\u8d25';
      syncMarketingToolsDynamicPanels();
      return null;
    } finally {
      marketingToolsState.singleProductCouponCreateRunning = false;
      marketingToolsState.singleProductCouponCreateRunId = '';
      syncMarketingToolsDynamicPanels();
    }
  }

  function buildSingleProductCouponBatchCouponSettingsPayload() {
    return {
      couponTypes: normalizeSingleProductCouponBatchCouponTypes(
        marketingToolsState.singleProductCouponBatchCouponTypes
      ),
      couponName: normalizeText(marketingToolsState.singleProductCouponBatchCouponName),
      couponQuantity: normalizeText(marketingToolsState.singleProductCouponBatchCouponQuantity) || '200',
      startTime: formatSingleProductCouponBatchCouponDateTimeValue(
        marketingToolsState.singleProductCouponBatchCouponStartTime
      ) || buildSingleProductCouponBatchCouponDefaultTimeRange().start,
      endTime: formatSingleProductCouponBatchCouponDateTimeValue(
        marketingToolsState.singleProductCouponBatchCouponEndTime
      ) || buildSingleProductCouponBatchCouponDefaultTimeRange().end,
      amountMode: normalizeSingleProductCouponBatchCouponAmountMode(
        marketingToolsState.singleProductCouponBatchCouponAmountMode
      ),
      amountFixedDiscount: normalizeSingleProductCouponBatchCouponRateValue(
        marketingToolsState.singleProductCouponBatchCouponAmountFixedDiscount
      ),
      amountCostProfitRate: normalizeSingleProductCouponBatchCouponRateValue(
        marketingToolsState.singleProductCouponBatchCouponAmountCostProfitRate
      ),
      amountSaleProfitRate: normalizeSingleProductCouponBatchCouponRateValue(
        marketingToolsState.singleProductCouponBatchCouponAmountSaleProfitRate
      ),
      profitFloorLogic: normalizeSingleProductCouponBatchCouponProfitFloorLogic(
        marketingToolsState.singleProductCouponBatchCouponProfitFloorLogic
      ),
      profitFloorRate: normalizeSingleProductCouponBatchCouponRateValue(
        marketingToolsState.singleProductCouponBatchCouponProfitFloorRate
      ),
      profitFloorValue: normalizeSingleProductCouponBatchCouponRateValue(
        marketingToolsState.singleProductCouponBatchCouponProfitFloorValue
      )
    };
  }

  function applySingleProductCouponBatchCouponSettings(settings) {
    const defaultTimeRange = buildSingleProductCouponBatchCouponDefaultTimeRange();
    const source = settings && typeof settings === 'object' ? settings : {};

    marketingToolsState.singleProductCouponBatchCouponTypes = normalizeSingleProductCouponBatchCouponTypes(
      source.couponTypes
    );
    marketingToolsState.singleProductCouponBatchCouponName = normalizeText(source.couponName);
    marketingToolsState.singleProductCouponBatchCouponQuantity = normalizeText(source.couponQuantity) || '200';
    marketingToolsState.singleProductCouponBatchCouponStartTime = formatSingleProductCouponBatchCouponDateTimeValue(
      source.startTime
    ) || defaultTimeRange.start;
    marketingToolsState.singleProductCouponBatchCouponEndTime = formatSingleProductCouponBatchCouponDateTimeValue(
      source.endTime
    ) || defaultTimeRange.end;
    marketingToolsState.singleProductCouponBatchCouponAmountMode = normalizeSingleProductCouponBatchCouponAmountMode(
      source.amountMode
    );
    marketingToolsState.singleProductCouponBatchCouponAmountFixedDiscount = normalizeSingleProductCouponBatchCouponRateValue(
      source.amountFixedDiscount
    );
    marketingToolsState.singleProductCouponBatchCouponAmountCostProfitRate = normalizeSingleProductCouponBatchCouponRateValue(
      source.amountCostProfitRate
    );
    marketingToolsState.singleProductCouponBatchCouponAmountSaleProfitRate = normalizeSingleProductCouponBatchCouponRateValue(
      source.amountSaleProfitRate
    );
    marketingToolsState.singleProductCouponBatchCouponProfitFloorLogic = normalizeSingleProductCouponBatchCouponProfitFloorLogic(
      source.profitFloorLogic
    );
    marketingToolsState.singleProductCouponBatchCouponProfitFloorRate = normalizeSingleProductCouponBatchCouponRateValue(
      source.profitFloorRate
    );
    marketingToolsState.singleProductCouponBatchCouponProfitFloorValue = normalizeSingleProductCouponBatchCouponRateValue(
      source.profitFloorValue
    );
  }

  async function loadSingleProductCouponBatchCouponSettings(options = {}) {
    const featureCenterApi = getFeatureCenterApi();

    if (
      marketingToolsState.singleProductCouponBatchCouponSettingsLoading === true
      && marketingToolsState.singleProductCouponBatchCouponSettingsPromise
    ) {
      return marketingToolsState.singleProductCouponBatchCouponSettingsPromise;
    }

    if (options.force !== true && marketingToolsState.singleProductCouponBatchCouponSettingsLoaded === true) {
      return buildSingleProductCouponBatchCouponSettingsPayload();
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.getMarketingToolsSingleProductCouponBatchCouponSettings !== 'function'
    ) {
      marketingToolsState.singleProductCouponBatchCouponSettingsLoaded = true;
      return buildSingleProductCouponBatchCouponSettingsPayload();
    }

    marketingToolsState.singleProductCouponBatchCouponSettingsLoading = true;
    marketingToolsState.singleProductCouponBatchCouponSettingsPromise = featureCenterApi
      .getMarketingToolsSingleProductCouponBatchCouponSettings()
      .then((response) => {
        applySingleProductCouponBatchCouponSettings(response && response.settings);
        marketingToolsState.singleProductCouponBatchCouponSettingsLoaded = true;
        return response && response.settings ? response.settings : {};
      })
      .catch(() => {
        marketingToolsState.singleProductCouponBatchCouponSettingsLoaded = true;
        return buildSingleProductCouponBatchCouponSettingsPayload();
      })
      .finally(() => {
        marketingToolsState.singleProductCouponBatchCouponSettingsLoading = false;
        marketingToolsState.singleProductCouponBatchCouponSettingsPromise = null;
        syncMarketingToolsDynamicPanels();
      });

    return marketingToolsState.singleProductCouponBatchCouponSettingsPromise;
  }

  async function persistSingleProductCouponBatchCouponSettings(payload) {
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveMarketingToolsSingleProductCouponBatchCouponSettings !== 'function'
    ) {
      return null;
    }

    marketingToolsState.singleProductCouponBatchCouponSettingsSaving = true;

    try {
      const response = await featureCenterApi.saveMarketingToolsSingleProductCouponBatchCouponSettings(payload);
      applySingleProductCouponBatchCouponSettings(response && response.settings);
      marketingToolsState.singleProductCouponBatchCouponSettingsLoaded = true;
      return response;
    } catch (_error) {
      return null;
    } finally {
      marketingToolsState.singleProductCouponBatchCouponSettingsSaving = false;
    }
  }

  function buildSingleProductCouponQuickCostHintEntriesFromRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .flatMap((row) => Array.isArray(row && row.quickCostHintEntries) ? row.quickCostHintEntries : [])
      .filter((entry) => normalizeText(entry && entry.shopId) && normalizeText(entry && entry.spec));
  }

  function countSingleProductCouponResolvedQuickCostEntries(entries) {
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      return Boolean(normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice));
    }).length;
  }

  async function hydrateSingleProductCouponQueryCostEntries(rows) {
    const featureCenterApi = getFeatureCenterApi();
    const presetHintEntries = buildSingleProductCouponQuickCostHintEntriesFromRows(rows);

    if (
      presetHintEntries.length <= 0
      || !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      return {
        matchedCostEntryCount: countSingleProductCouponResolvedQuickCostEntries(
          marketingToolsState.singleProductCouponQuickCostEntries
        )
      };
    }

    try {
      const response = await featureCenterApi.getOperationsSharedCostSnapshot({
        shopIds: normalizeSelectedShopIds(presetHintEntries.map((entry) => entry && entry.shopId)),
        entries: presetHintEntries.map((entry) => ({
          shopId: normalizeText(entry && entry.shopId),
          shopName: normalizeText(entry && entry.shopName),
          station: resolveSingleProductCouponQuickCostStationValue(entry),
          stationLabel: normalizeText(entry && entry.stationLabel),
          siteId: normalizeText(entry && entry.siteId),
          siteName: normalizeText(entry && entry.siteName),
          siteIds: Array.isArray(entry && entry.siteIds) ? entry.siteIds.slice() : [],
          category: normalizeText(entry && entry.category),
          categoryLabel: normalizeText(entry && entry.categoryLabel),
          categoryTrail: normalizeText(entry && entry.categoryTrail),
          skcId: normalizeText(entry && entry.skcId),
          skuId: normalizeText(entry && entry.skuId),
          spec: normalizeText(entry && entry.spec),
          specAliases: Array.isArray(entry && entry.specAliases) ? entry.specAliases.slice() : [],
          costPrice: normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice)
        }))
      });
      const aggregateResult = buildSingleProductCouponQuickCostDialogEntries(
        response && response.entries,
        presetHintEntries
      );

      marketingToolsState.singleProductCouponQuickCostEntries = aggregateResult.entries.slice();

      return {
        matchedCostEntryCount: countSingleProductCouponResolvedQuickCostEntries(aggregateResult.entries)
      };
    } catch (_error) {
      return {
        matchedCostEntryCount: countSingleProductCouponResolvedQuickCostEntries(
          marketingToolsState.singleProductCouponQuickCostEntries
        )
      };
    }
  }

  function applySingleProductCouponQueryResponse(response) {
    const nextRows = Array.isArray(response && response.rows)
      ? response.rows
      : [];
    const nextShopResults = Array.isArray(response && response.shopResults)
      ? response.shopResults
      : [];
    const nextQuickCostAggregate = buildSingleProductCouponQuickCostDialogEntries(
      [],
      buildSingleProductCouponQuickCostHintEntriesFromRows(nextRows)
    );

    marketingToolsState.singleProductCouponQueryRows = nextRows;
    marketingToolsState.singleProductCouponResultViewportScrollTop = 0;
    marketingToolsState.singleProductCouponResultViewportScrollLeft = 0;
    marketingToolsState.singleProductCouponResultViewportResetPending = true;
    marketingToolsState.singleProductCouponResultRowMetricsCache = null;
    marketingToolsState.singleProductCouponQueryShopResults = nextShopResults;
    marketingToolsState.singleProductCouponQueryUpdatedAt = normalizeText(response && response.updatedAt);
    marketingToolsState.singleProductCouponQueryWarning = normalizeText(response && response.warning);
    marketingToolsState.singleProductCouponQueryRawRowCount = Math.max(0, Number.parseInt(response && response.rawRowCount, 10) || 0);
    marketingToolsState.singleProductCouponQueryFilteredConfiguredCount = Math.max(0, Number.parseInt(response && response.filteredConfiguredCount, 10) || 0);
    marketingToolsState.singleProductCouponQueryCompletedShopCount = Math.max(0, Number.parseInt(response && response.completedShopCount, 10) || 0);
    marketingToolsState.singleProductCouponQueryFailedShopCount = Math.max(0, Number.parseInt(response && response.failedShopCount, 10) || 0);
    marketingToolsState.singleProductCouponQueryCanceledShopCount = Math.max(0, Number.parseInt(response && response.canceledShopCount, 10) || 0);
    marketingToolsState.singleProductCouponQuickCostEntries = nextQuickCostAggregate.entries.slice();
    marketingToolsState.singleProductCouponQueryResultSummaryText = buildSingleProductCouponResultSummaryText();
  }

  function buildSingleProductCouponQueryPayload() {
    const selectedShopIds = normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);

    if (selectedShopIds.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u5e97\u94fa');
    }

    return {
      shopIds: selectedShopIds,
      categoryIds: normalizeCategoryCheckedPaths(marketingToolsState.singleProductCouponCategoryCheckedPaths)
        .map((path) => {
          const normalizedPath = normalizeCategoryPath(path);
          const lastNode = normalizedPath[normalizedPath.length - 1];
          return Number.parseInt(lastNode && lastNode.id, 10);
        })
        .filter((categoryId) => Number.isFinite(categoryId) && categoryId > 0),
      productIdType: normalizeProductIdType(marketingToolsState.singleProductCouponProductIdType),
      productIdKeywords: normalizeText(marketingToolsState.singleProductCouponProductIdKeywords),
      dailyPriceMin: normalizeText(marketingToolsState.singleProductCouponDailyPriceMin),
      dailyPriceMax: normalizeText(marketingToolsState.singleProductCouponDailyPriceMax)
    };
  }

  async function submitSingleProductCouponQuery() {
    const featureCenterApi = getFeatureCenterApi();

    if (!featureCenterApi || typeof featureCenterApi.queryMarketingToolsSingleProductCouponRows !== 'function') {
      throw new Error('\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const payload = buildSingleProductCouponQueryPayload();
    const nextRunId = `sp_coupon_${Date.now().toString(36)}`;

    marketingToolsState.singleProductCouponQueryRunId = nextRunId;
    marketingToolsState.singleProductCouponQueryRunning = true;
    marketingToolsState.singleProductCouponQueryStopping = false;
    marketingToolsState.singleProductCouponQueryError = '';
    marketingToolsState.singleProductCouponQueryWarning = '';
    marketingToolsState.singleProductCouponQueryRows = [];
    marketingToolsState.singleProductCouponQueryShopResults = [];
    marketingToolsState.singleProductCouponQueryUpdatedAt = '';
    marketingToolsState.singleProductCouponQueryRawRowCount = 0;
    marketingToolsState.singleProductCouponQueryFilteredConfiguredCount = 0;
    marketingToolsState.singleProductCouponQueryCompletedShopCount = 0;
    marketingToolsState.singleProductCouponQueryFailedShopCount = 0;
    marketingToolsState.singleProductCouponQueryCanceledShopCount = 0;
    marketingToolsState.singleProductCouponQueryResultSummaryText = '';
    marketingToolsState.singleProductCouponQuickCostEntries = [];
    marketingToolsState.singleProductCouponResultViewportScrollTop = 0;
    marketingToolsState.singleProductCouponResultViewportScrollLeft = 0;
    marketingToolsState.singleProductCouponResultViewportResetPending = true;
    marketingToolsState.singleProductCouponResultRowMetricsCache = null;
    marketingToolsState.singleProductCouponQueryProgressText = '\u6b63\u5728\u51c6\u5907\u67e5\u8be2';
    syncMarketingToolsDynamicPanels();

    try {
      const response = await featureCenterApi.queryMarketingToolsSingleProductCouponRows({
        ...payload,
        runId: nextRunId
      });

      if (marketingToolsState.singleProductCouponQueryRunId !== nextRunId) {
        return;
      }

      applySingleProductCouponQueryResponse(response);
      marketingToolsState.singleProductCouponQueryProgressText = response && response.canceled === true
        ? '\u67e5\u8be2\u5df2\u505c\u6b62'
        : '\u67e5\u8be2\u5b8c\u6210\uff0c\u6b63\u5728\u81ea\u52a8\u5339\u914d\u6210\u672c\u4ef7';
      syncMarketingToolsDynamicPanels();

      const quickCostHydrateResult = await hydrateSingleProductCouponQueryCostEntries(
        marketingToolsState.singleProductCouponQueryRows
      );

      if (marketingToolsState.singleProductCouponQueryRunId !== nextRunId) {
        return;
      }

      const matchedCostEntryCount = Math.max(
        0,
        Number.parseInt(quickCostHydrateResult && quickCostHydrateResult.matchedCostEntryCount, 10) || 0
      );

      marketingToolsState.singleProductCouponQueryProgressText = response && response.canceled === true
        ? '\u67e5\u8be2\u5df2\u505c\u6b62'
        : (matchedCostEntryCount > 0
          ? `\u67e5\u8be2\u5b8c\u6210\uff0c\u5df2\u81ea\u52a8\u5339\u914d ${matchedCostEntryCount} \u9879\u6210\u672c\u4ef7`
          : '\u67e5\u8be2\u5b8c\u6210');
    } catch (error) {
      if (marketingToolsState.singleProductCouponQueryRunId !== nextRunId) {
        return;
      }

      marketingToolsState.singleProductCouponQueryError = normalizeText(error && error.message) || '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5931\u8d25';
      marketingToolsState.singleProductCouponQueryProgressText = '';
    } finally {
      if (marketingToolsState.singleProductCouponQueryRunId === nextRunId) {
        marketingToolsState.singleProductCouponQueryRunning = false;
        marketingToolsState.singleProductCouponQueryStopping = false;
        marketingToolsState.singleProductCouponQueryResultSummaryText = buildSingleProductCouponResultSummaryText();
        syncMarketingToolsDynamicPanels();
      }
    }
  }

  async function stopSingleProductCouponQuery() {
    const featureCenterApi = getFeatureCenterApi();
    const currentRunId = normalizeText(marketingToolsState.singleProductCouponQueryRunId);

    if (
      !currentRunId
      || marketingToolsState.singleProductCouponQueryRunning !== true
      || !featureCenterApi
      || typeof featureCenterApi.cancelMarketingToolsSingleProductCouponQuery !== 'function'
    ) {
      return;
    }

    marketingToolsState.singleProductCouponQueryStopping = true;
    marketingToolsState.singleProductCouponQueryProgressText = '\u6b63\u5728\u505c\u6b62\u67e5\u8be2';
    syncMarketingToolsDynamicPanels();

    try {
      await featureCenterApi.cancelMarketingToolsSingleProductCouponQuery({
        runId: currentRunId
      });
    } catch (_error) {
      marketingToolsState.singleProductCouponQueryProgressText = '\u505c\u6b62\u6307\u4ee4\u53d1\u9001\u5931\u8d25';
    } finally {
      marketingToolsState.singleProductCouponQueryStopping = false;
      syncMarketingToolsDynamicPanels();
    }
  }

  function handleSingleProductCouponQueryProgress(payload) {
    const runId = normalizeText(payload && payload.runId);

    if (runId && runId === normalizeText(marketingToolsState.singleProductCouponCreateRunId)) {
      const rowProgressItems = Array.isArray(payload && payload.rowProgressItems)
        ? payload.rowProgressItems
        : [];

      if (rowProgressItems.length > 0) {
        updateSingleProductCouponCreateRowStatuses(rowProgressItems);
      }

      const progressMessage = normalizeText(payload && payload.message);

      if (progressMessage) {
        marketingToolsState.singleProductCouponQueryProgressText = progressMessage;
      }

      syncSingleProductCouponResultsArea();
      return;
    }

    if (!runId || runId !== normalizeText(marketingToolsState.singleProductCouponQueryRunId)) {
      return;
    }

    const currentShopName = normalizeText(payload && payload.currentShopName);
    const phaseMessage = normalizeText(payload && payload.message);
    const phase = normalizeText(payload && payload.phase);
    const totalShopCount = Math.max(0, Number.parseInt(payload && payload.totalShopCount, 10) || 0);
    const currentPageIndex = Math.max(0, Number.parseInt(payload && payload.currentPageIndex, 10) || 0);
    const rowCount = Math.max(0, Number.parseInt(payload && payload.rowCount, 10) || 0);
    const filteredConfiguredCount = Math.max(0, Number.parseInt(payload && payload.filteredConfiguredCount, 10) || 0);
    const completedShopCount = Math.max(0, Number.parseInt(payload && payload.completedShopCount, 10) || 0);
    const failedShopCount = Math.max(0, Number.parseInt(payload && payload.failedShopCount, 10) || 0);
    const canceledShopCount = Math.max(0, Number.parseInt(payload && payload.canceledShopCount, 10) || 0);
    const runningShopCount = totalShopCount > 0
      ? Math.max(0, totalShopCount - completedShopCount - failedShopCount - canceledShopCount)
      : 0;
    const textParts = [];

    if (phase === 'preparing') {
      textParts.push(`\u6b63\u5728\u51c6\u5907\u67e5\u8be2\uff0c\u5171 ${totalShopCount || 0} \u5bb6\u5e97\u94fa`);
    } else if (phase === 'completed') {
      textParts.push(`\u67e5\u8be2\u5b8c\u6210\uff0c\u5df2\u5b8c\u6210 ${completedShopCount}/${totalShopCount || completedShopCount} \u5bb6\u5e97\u94fa`);
    } else if (phase === 'canceled') {
      textParts.push(`\u67e5\u8be2\u5df2\u505c\u6b62\uff0c\u5df2\u5b8c\u6210 ${completedShopCount}/${totalShopCount || completedShopCount} \u5bb6\u5e97\u94fa`);
    } else if (currentShopName) {
      textParts.push(`\u5f53\u524d ${currentShopName}`);
    } else if (phaseMessage) {
      textParts.push(phaseMessage);
    }

    if (
      totalShopCount > 0
      && phase !== 'preparing'
      && phase !== 'completed'
      && phase !== 'canceled'
    ) {
      textParts.push(`\u8fdb\u5ea6 ${completedShopCount + failedShopCount}/${totalShopCount}`);
    }

    if (currentPageIndex > 0) {
      textParts.push(`\u7b2c ${currentPageIndex} \u9875`);
    }

    if (rowCount > 0 || filteredConfiguredCount > 0) {
      textParts.push(`\u5019\u9009 ${rowCount}`);
      textParts.push(`\u5df2\u521b\u5efa\u4f18\u60e0\u5238\u8fc7\u6ee4 ${filteredConfiguredCount}`);
    }

    if (runningShopCount > 0) {
      textParts.push(`\u8fd0\u884c\u4e2d ${runningShopCount}`);
    }

    if (completedShopCount > 0 || failedShopCount > 0 || canceledShopCount > 0 || totalShopCount > 0) {
      textParts.push(`\u6210\u529f ${completedShopCount}`);
      textParts.push(`\u5931\u8d25 ${failedShopCount}`);

      if (canceledShopCount > 0) {
        textParts.push(`\u672a\u5b8c\u6210 ${canceledShopCount}`);
      }
    }

    if (
      phaseMessage
      && phase !== 'preparing'
      && phase !== 'completed'
      && phase !== 'canceled'
      && (!currentShopName || !phaseMessage.includes(currentShopName))
    ) {
      textParts.push(phaseMessage);
    }

    marketingToolsState.singleProductCouponQueryProgressText = textParts.join(' | ');
    syncSingleProductCouponResultsArea();
  }

  function normalizeSingleProductCouponPresetShopSelection(selectedShopIds) {
    const normalizedSelectedShopIds = normalizeSelectedShopIds(selectedShopIds);

    if (
      marketingToolsState.singleProductCouponShopSelectorLoaded !== true
      || !marketingToolsState.singleProductCouponShopCatalog
      || !marketingToolsState.singleProductCouponShopCatalog.shopMap
    ) {
      return normalizedSelectedShopIds;
    }

    return normalizedSelectedShopIds.filter((shopId) => Boolean(marketingToolsState.singleProductCouponShopCatalog.shopMap[shopId]));
  }

  function getSingleProductCouponCategoryChildCacheKey(parentCatId) {
    return normalizeText(parentCatId);
  }

  function buildSingleProductCouponCategoryColumns() {
    const snapshot = normalizeCategorySnapshot(marketingToolsState.singleProductCouponCategorySnapshot);
    const selectedPath = normalizeCategoryPath(marketingToolsState.singleProductCouponCategorySelectedPath).slice(0, MAX_CATEGORY_LEVEL);
    const columns = [
      {
        level: 1,
        items: snapshot.categories,
        pathPrefix: [],
        selectedId: normalizeText(selectedPath[0] && selectedPath[0].id),
        loading: marketingToolsState.singleProductCouponCategoryRootLoading,
        error: marketingToolsState.singleProductCouponCategoryRootLoading === true
          ? ''
          : marketingToolsState.singleProductCouponCategoryRootError,
        emptyText: '\u6682\u65e0\u4e3b\u7c7b\u76ee'
      }
    ];

    for (let index = 0; index < MAX_CATEGORY_LEVEL - 1; index += 1) {
      const parentNode = selectedPath[index];

      if (!parentNode || parentNode.isLeaf === true) {
        break;
      }

      const cacheKey = getSingleProductCouponCategoryChildCacheKey(parentNode.id);
      const cachedItems = cacheKey && Array.isArray(marketingToolsState.singleProductCouponCategoryChildCache[cacheKey])
        ? marketingToolsState.singleProductCouponCategoryChildCache[cacheKey]
        : [];
      const isLoading = cacheKey ? marketingToolsState.singleProductCouponCategoryChildLoadingKey === cacheKey : false;
      const hasError = cacheKey && marketingToolsState.singleProductCouponCategoryChildErrorKey === cacheKey;

      columns.push({
        level: index + 2,
        items: cachedItems,
        pathPrefix: selectedPath.slice(0, index + 1),
        selectedId: normalizeText(selectedPath[index + 1] && selectedPath[index + 1].id),
        loading: isLoading,
        error: hasError ? marketingToolsState.singleProductCouponCategoryChildError : '',
        emptyText: '\u6682\u65e0\u53ef\u9009\u5b50\u7c7b\u76ee'
      });

      if (cachedItems.length <= 0) {
        break;
      }
    }

    return columns;
  }

  function syncSingleProductCouponCategoryColumnsState() {
    marketingToolsState.singleProductCouponCategoryColumns = buildSingleProductCouponCategoryColumns();
  }

  function setSingleProductCouponCheckedCategoryPaths(paths) {
    marketingToolsState.singleProductCouponCategoryCheckedPaths = normalizeCategoryCheckedPaths(paths);
    syncSingleProductCouponCategoryColumnsState();
  }

  function updateSingleProductCouponCheckedCategoryPaths(paths, checked) {
    const currentPaths = normalizeCategoryCheckedPaths(marketingToolsState.singleProductCouponCategoryCheckedPaths);
    const nextPathMap = new Map();

    currentPaths.forEach((path) => {
      const pathKey = buildCategoryPathKey(path);

      if (pathKey) {
        nextPathMap.set(pathKey, path);
      }
    });

    normalizeCategoryCheckedPaths(paths).forEach((path) => {
      const pathKey = buildCategoryPathKey(path);

      if (!pathKey) {
        return;
      }

      if (checked === true) {
        nextPathMap.set(pathKey, path);
      } else {
        nextPathMap.delete(pathKey);
      }
    });

    setSingleProductCouponCheckedCategoryPaths(Array.from(nextPathMap.values()));
  }

  function toggleSingleProductCouponCheckedCategoryPath(path, checked) {
    const normalizedPath = normalizeCategoryPath(path).slice(0, MAX_CATEGORY_LEVEL);
    const pathKey = buildCategoryPathKey(normalizedPath);

    if (!pathKey) {
      return;
    }

    updateSingleProductCouponCheckedCategoryPaths([normalizedPath], checked);
  }

  function setSingleProductCouponSelectedCategoryPath(path) {
    marketingToolsState.singleProductCouponCategorySelectedPath = normalizeCategoryPath(path).slice(0, MAX_CATEGORY_LEVEL);
    syncSingleProductCouponCategoryColumnsState();
  }

  function buildSingleProductCouponCategoryColumnPaths(column) {
    const pathPrefix = normalizeCategoryPath(column && column.pathPrefix);

    return normalizeCategoryList(column && column.items)
      .map((category) => normalizeCategoryPath(pathPrefix.concat(category)).slice(0, MAX_CATEGORY_LEVEL))
      .filter((path) => path.length > 0);
  }

  function clearSingleProductCouponCategorySearchTimer() {
    if (marketingToolsState.singleProductCouponCategorySearchTimer) {
      window.clearTimeout(marketingToolsState.singleProductCouponCategorySearchTimer);
      marketingToolsState.singleProductCouponCategorySearchTimer = 0;
    }
  }

  function clearSingleProductCouponCategorySearchState(options = {}) {
    clearSingleProductCouponCategorySearchTimer();
    marketingToolsState.singleProductCouponCategorySearchRequestId += 1;
    marketingToolsState.singleProductCouponCategorySearchKeyword = '';
    marketingToolsState.singleProductCouponCategorySearchResults = [];
    marketingToolsState.singleProductCouponCategorySearchTotal = 0;
    marketingToolsState.singleProductCouponCategorySearchLoading = false;
    marketingToolsState.singleProductCouponCategorySearchError = '';
    marketingToolsState.singleProductCouponCategorySearchFocusInput = options.keepFocus === true;
  }

  function renderSingleProductCouponCategorySelectorField() {
    const control = getCategoryCascadeControl();
    const snapshot = normalizeCategorySnapshot(marketingToolsState.singleProductCouponCategorySnapshot);
    const fieldMarkup =
      control && typeof control.render === 'function'
        ? control.render({
          snapshot,
          selectedPath: marketingToolsState.singleProductCouponCategorySelectedPath,
          checkedPaths: marketingToolsState.singleProductCouponCategoryCheckedPaths,
          columns: marketingToolsState.singleProductCouponCategoryColumns,
          open: marketingToolsState.singleProductCouponCategorySelectorOpen,
          compact: true,
          placeholder: '\u9009\u62e9\u7c7b\u76ee',
          triggerSelectionMode: 'count',
          loadingRoots: marketingToolsState.singleProductCouponCategoryRootLoading,
          multipleSelection: true,
          showSearch: true,
          searchKeyword: marketingToolsState.singleProductCouponCategorySearchKeyword,
          searchResults: marketingToolsState.singleProductCouponCategorySearchResults,
          searchLoading: marketingToolsState.singleProductCouponCategorySearchLoading,
          searchErrorText: marketingToolsState.singleProductCouponCategorySearchError,
          searchTotal: marketingToolsState.singleProductCouponCategorySearchTotal,
          hideTriggerMeta: true,
          showSyncRootAction: false,
          showToolbarMeta: false,
          showHelperText: false,
          errorText: marketingToolsState.singleProductCouponCategoryRootError,
          allowEmptyOpen: true
        })
        : `
          <button class="category-cascade-trigger" type="button" disabled>
            <span class="category-cascade-trigger-copy">
              <span class="category-cascade-trigger-value">\u7c7b\u76ee\u9009\u62e9\u63a7\u4ef6\u672a\u52a0\u8f7d</span>
            </span>
          </button>
        `;

    return `
      <label class="ops-marketing-tools-query-field ops-marketing-tools-query-field-category">
        <span class="ops-marketing-tools-query-field-label">\u7c7b\u76ee</span>
        <span class="ops-marketing-tools-query-field-content">
          ${fieldMarkup}
        </span>
      </label>
    `;
  }

  function renderSingleProductCouponProductIdField() {
    return `
      <label class="ops-marketing-tools-query-field ops-marketing-tools-query-field-product-id">
        <span class="ops-marketing-tools-query-field-label">\u5546\u54c1ID\u67e5\u8be2</span>
        <span class="ops-marketing-tools-query-field-content">
          <span class="ops-marketing-tools-combo-control">
            <select class="ops-marketing-tools-control" data-single-product-coupon-field="productIdType">
              ${PRODUCT_ID_TYPE_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}"${option.value === marketingToolsState.singleProductCouponProductIdType ? ' selected' : ''}>
                  ${escapeHtml(option.label)}
                </option>
              `).join('')}
            </select>
            <input
              class="ops-marketing-tools-control"
              type="text"
              value="${escapeHtml(marketingToolsState.singleProductCouponProductIdKeywords)}"
              placeholder="\u591a\u4e2a\u67e5\u8be2\u8bf7\u7a7a\u683c\u6216\u9017\u53f7\u4f9d\u6b21\u8f93\u5165"
              data-single-product-coupon-field="productIdKeywords"
            />
          </span>
        </span>
      </label>
    `;
  }

  function renderSingleProductCouponDailyPriceField() {
    return `
      <label class="ops-marketing-tools-query-field ops-marketing-tools-query-field-daily-price">
        <span class="ops-marketing-tools-query-field-label">\u65e5\u5e38\u7533\u62a5\u4ef7</span>
        <span class="ops-marketing-tools-query-field-content">
          <span class="ops-marketing-tools-range-control">
            <input
              class="ops-marketing-tools-control"
              type="number"
              min="0"
              step="0.01"
              value="${escapeHtml(marketingToolsState.singleProductCouponDailyPriceMin)}"
              placeholder="\u6700\u5c0f\u503c"
              data-single-product-coupon-field="dailyPriceMin"
            />
            <span class="ops-marketing-tools-range-separator">~</span>
            <input
              class="ops-marketing-tools-control"
              type="number"
              min="0"
              step="0.01"
              value="${escapeHtml(marketingToolsState.singleProductCouponDailyPriceMax)}"
              placeholder="\u6700\u5927\u503c"
              data-single-product-coupon-field="dailyPriceMax"
            />
          </span>
        </span>
      </label>
    `;
  }

  function renderSingleProductCouponQueryCard() {
    const queryButtonDisabled = marketingToolsState.singleProductCouponQueryRunning === true;
    const stopButtonDisabled =
      marketingToolsState.singleProductCouponQueryRunning !== true
      || marketingToolsState.singleProductCouponQueryStopping === true;

    return `
      <div class="ops-marketing-tools-query-card">
        <div class="ops-marketing-tools-query-card-body">
          ${renderSingleProductCouponCategorySelectorField()}
          ${renderSingleProductCouponProductIdField()}
          ${renderSingleProductCouponDailyPriceField()}
          <div class="ops-marketing-tools-query-actions">
            <button
              class="ops-marketing-tools-action-button is-primary"
              type="button"
              data-single-product-coupon-action="query"
              ${queryButtonDisabled ? 'disabled' : ''}
            >
              ${marketingToolsState.singleProductCouponQueryRunning === true ? '\u67e5\u8be2\u4e2d' : '\u67e5\u8be2'}
            </button>
            <button
              class="ops-marketing-tools-action-button is-danger"
              type="button"
              data-single-product-coupon-action="stop"
              ${stopButtonDisabled ? 'disabled' : ''}
            >
              ${marketingToolsState.singleProductCouponQueryStopping === true ? '\u505c\u6b62\u4e2d' : '\u505c\u6b62'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSingleProductCouponShopResultBadges() {
    if (!Array.isArray(marketingToolsState.singleProductCouponQueryShopResults) || marketingToolsState.singleProductCouponQueryShopResults.length <= 0) {
      return '';
    }

    const queryDiagnostics = buildSingleProductCouponQueryDiagnostics();

    return `
      <div class="ops-marketing-tools-result-shop-badges">
        ${marketingToolsState.singleProductCouponQueryShopResults.map((shopResult) => {
          const isSuccess = shopResult && shopResult.success === true;
          const badgeClass = isSuccess ? 'is-success' : 'is-failed';
          const shopName = normalizeText(shopResult && shopResult.shopName) || normalizeText(shopResult && shopResult.shopId);
          const shopId = normalizeText(shopResult && shopResult.shopId);
          const diagnostic = queryDiagnostics.byShopId[shopId] || createSingleProductCouponShopQueryDiagnostic(shopId, shopName);
          const metaParts = [];

          if (isSuccess) {
            metaParts.push(`\u5019\u9009 ${Math.max(0, Number.parseInt(diagnostic && diagnostic.candidateCount, 10) || 0)}`);
            metaParts.push(`\u53ef\u521b\u5efa ${Math.max(0, Number.parseInt(diagnostic && diagnostic.readyCount, 10) || 0)}`);
            if (Math.max(0, Number.parseInt(shopResult && shopResult.filteredConfiguredCount, 10) || 0) > 0) {
              metaParts.push(`\u5df2\u521b\u5efa\u4f18\u60e0\u5238\u8fc7\u6ee4 ${Math.max(0, Number.parseInt(shopResult && shopResult.filteredConfiguredCount, 10) || 0)}`);
            }
            if (Math.max(0, Number.parseInt(diagnostic && diagnostic.missingCostCount, 10) || 0) > 0) {
              metaParts.push(`\u7f3a\u6210\u672c ${Math.max(0, Number.parseInt(diagnostic && diagnostic.missingCostCount, 10) || 0)}`);
            }
            if (Math.max(0, Number.parseInt(diagnostic && diagnostic.profitFloorBlockedCount, 10) || 0) > 0) {
              metaParts.push(`\u5229\u6da6\u4e0d\u8db3 ${Math.max(0, Number.parseInt(diagnostic && diagnostic.profitFloorBlockedCount, 10) || 0)}`);
            }
            if (Math.max(0, Number.parseInt(diagnostic && diagnostic.platformLimitedCount, 10) || 0) > 0) {
              metaParts.push(`\u5e73\u53f0\u9650\u5236 ${Math.max(0, Number.parseInt(diagnostic && diagnostic.platformLimitedCount, 10) || 0)}`);
            }
            if (Math.max(0, Number.parseInt(diagnostic && diagnostic.missingAgreementCount, 10) || 0) > 0) {
              metaParts.push(`\u7f3a\u534f\u8bae ${Math.max(0, Number.parseInt(diagnostic && diagnostic.missingAgreementCount, 10) || 0)}`);
            }
            if (Math.max(0, Number.parseInt(diagnostic && diagnostic.otherBlockedCount, 10) || 0) > 0) {
              metaParts.push(`\u5176\u4ed6 ${Math.max(0, Number.parseInt(diagnostic && diagnostic.otherBlockedCount, 10) || 0)}`);
            }
          } else if (normalizeText(shopResult && shopResult.message)) {
            metaParts.push(normalizeText(shopResult && shopResult.message));
          }

          return `
            <div class="ops-marketing-tools-result-shop-badge ${badgeClass}">
              <span class="ops-marketing-tools-result-shop-badge-name">${escapeHtml(shopName)}</span>
              ${metaParts.length > 0 ? `<span class="ops-marketing-tools-result-shop-badge-meta">${escapeHtml(metaParts.join(' | '))}</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderSingleProductCouponResultSummaryChips() {
    const queryDiagnostics = buildSingleProductCouponQueryDiagnostics();
    const totals = queryDiagnostics.totals;
    const chipTexts = [];
    const updatedAtText = formatSingleProductCouponUpdatedAt(marketingToolsState.singleProductCouponQueryUpdatedAt);

    if (totals.candidateCount > 0) {
      chipTexts.push(`\u5019\u9009 ${totals.candidateCount}`);
    }

    if (totals.readyCount > 0) {
      chipTexts.push(`\u53ef\u521b\u5efa ${totals.readyCount}`);
    }

    if (marketingToolsState.singleProductCouponQueryFilteredConfiguredCount > 0) {
      chipTexts.push(`\u5df2\u521b\u5efa\u4f18\u60e0\u5238\u8fc7\u6ee4 ${marketingToolsState.singleProductCouponQueryFilteredConfiguredCount}`);
    }

    if (totals.missingCostCount > 0) {
      chipTexts.push(`\u7f3a\u6210\u672c ${totals.missingCostCount}`);
    }

    if (totals.profitFloorBlockedCount > 0) {
      chipTexts.push(`\u5229\u6da6\u4e0d\u8db3 ${totals.profitFloorBlockedCount}`);
    }

    if (marketingToolsState.singleProductCouponQueryCompletedShopCount > 0) {
      chipTexts.push(`\u6210\u529f\u5e97\u94fa ${marketingToolsState.singleProductCouponQueryCompletedShopCount}`);
    }

    if (marketingToolsState.singleProductCouponQueryFailedShopCount > 0) {
      chipTexts.push(`\u5931\u8d25\u5e97\u94fa ${marketingToolsState.singleProductCouponQueryFailedShopCount}`);
    }

    if (marketingToolsState.singleProductCouponQueryCanceledShopCount > 0) {
      chipTexts.push(`\u672a\u5b8c\u6210\u5e97\u94fa ${marketingToolsState.singleProductCouponQueryCanceledShopCount}`);
    }

    if (updatedAtText) {
      chipTexts.push(`\u66f4\u65b0 ${updatedAtText}`);
    }

    if (chipTexts.length <= 0) {
      return '';
    }

    return `
      <div class="ops-marketing-tools-results-summary">
        ${chipTexts.map((text) => (
          `<span class="ops-marketing-tools-results-summary-chip">${escapeHtml(text)}</span>`
        )).join('')}
      </div>
    `;
  }

  function renderSingleProductCouponResultAlert(text, tone) {
    const normalizedText = normalizeText(text);
    const normalizedTone = normalizeText(tone) || 'muted';

    if (!normalizedText) {
      return '';
    }

    return `
      <div class="ops-marketing-tools-results-alert is-${escapeHtml(normalizedTone)}">
        ${escapeHtml(normalizedText)}
      </div>
    `;
  }

  function buildSingleProductCouponQuickCostTargetShopIds() {
    return normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);
  }

  function buildSingleProductCouponQuickCostShopNameMap() {
    const shopNameMap = Object.create(null);
    const shopCatalogMap = marketingToolsState
      && marketingToolsState.singleProductCouponShopCatalog
      && marketingToolsState.singleProductCouponShopCatalog.shopMap
      && typeof marketingToolsState.singleProductCouponShopCatalog.shopMap === 'object'
        ? marketingToolsState.singleProductCouponShopCatalog.shopMap
        : null;

    if (!shopCatalogMap) {
      return shopNameMap;
    }

    Object.keys(shopCatalogMap).forEach((shopId) => {
      const shopRecord = shopCatalogMap[shopId];
      const shopName = normalizeText(shopRecord && (
        shopRecord.shopName
        || shopRecord.name
        || shopRecord.label
      ));

      if (shopId && shopName && !shopNameMap[shopId]) {
        shopNameMap[shopId] = shopName;
      }
    });

    return shopNameMap;
  }

  function buildSingleProductCouponQuickCostPresetHintEntries(entries, targetShopIdSet) {
    const entryMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!shopId || (targetShopIdSet.size > 0 && !targetShopIdSet.has(shopId))) {
        return;
      }

      const station = resolveSingleProductCouponQuickCostStationValue(entry);
      const spec = normalizeText(entry && entry.spec);

      if (!station || !spec) {
        return;
      }

      const category = normalizeText(entry && entry.category);
      const hintKey = [
        shopId,
        station,
        category || '-',
        normalizeSingleProductCouponQuickCostSpecIdentity(spec)
      ].join('\x1f').toLowerCase();

      if (entryMap.has(hintKey)) {
        return;
      }

      entryMap.set(hintKey, {
        hintKey,
        shopId,
        shopName: normalizeText(entry && entry.shopName),
        station,
        stationLabel: normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.siteName) || station,
        category,
        categoryLabel: normalizeText(entry && entry.categoryLabel),
        categoryTrail: normalizeText(entry && entry.categoryTrail),
        costPrice: normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice),
        spec,
        specKey: normalizeSingleProductCouponQuickCostSpecIdentity(spec),
        specSegments: buildSingleProductCouponQuickCostSpecSegments(spec)
      });
    });

    return Array.from(entryMap.values());
  }

  function buildSingleProductCouponQuickCostSourceEntries(snapshotEntries, presetHintEntries, targetShopIds) {
    const targetShopIdSet = new Set(normalizeSelectedShopIds(targetShopIds));
    const hintEntries = buildSingleProductCouponQuickCostPresetHintEntries(
      presetHintEntries,
      targetShopIdSet
    );
    const sourceEntries = [];
    const sourceEntryKeys = new Set();

    (Array.isArray(snapshotEntries) ? snapshotEntries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!shopId || (targetShopIdSet.size > 0 && !targetShopIdSet.has(shopId))) {
        return;
      }

      const station = resolveSingleProductCouponQuickCostStationValue(entry);
      const sharedSpec = normalizeText(entry && entry.spec);
      const sharedSpecKey = normalizeSingleProductCouponQuickCostSpecIdentity(sharedSpec);
      const sharedSpecSegments = buildSingleProductCouponQuickCostSpecSegments(sharedSpec);
      const sharedCategory = normalizeText(entry && entry.category);

      if (!station || !sharedSpecKey) {
        return;
      }

      if (sharedSpecSegments.length <= 1) {
        const matchingHints = hintEntries.filter((hintEntry) => {
          if (normalizeText(hintEntry && hintEntry.shopId) !== shopId) {
            return false;
          }

          if (normalizeText(hintEntry && hintEntry.station) !== station) {
            return false;
          }

          if (
            sharedCategory
            && normalizeText(hintEntry && hintEntry.category)
            && normalizeText(hintEntry && hintEntry.category) !== sharedCategory
          ) {
            return false;
          }

          const hintSpecSegments = Array.isArray(hintEntry && hintEntry.specSegments)
            ? hintEntry.specSegments
            : [];

          return normalizeSingleProductCouponQuickCostSpecIdentity(hintEntry && hintEntry.spec) === sharedSpecKey
            || hintSpecSegments.some((segment) => normalizeSingleProductCouponQuickCostSpecIdentity(segment) === sharedSpecKey);
        });

        if (matchingHints.length > 0) {
          matchingHints.forEach((hintEntry) => {
            const nextEntry = {
              ...entry,
              shopId,
              shopName: normalizeText(entry && entry.shopName) || normalizeText(hintEntry && hintEntry.shopName) || shopId,
              station,
              stationLabel: normalizeText(hintEntry && hintEntry.stationLabel)
                || normalizeText(entry && entry.stationLabel)
                || normalizeText(entry && entry.siteName)
                || station,
              category: sharedCategory || normalizeText(hintEntry && hintEntry.category),
              categoryLabel: normalizeText(entry && entry.categoryLabel) || normalizeText(hintEntry && hintEntry.categoryLabel),
              categoryTrail: normalizeText(entry && entry.categoryTrail) || normalizeText(hintEntry && hintEntry.categoryTrail),
              costPrice: normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice)
                || normalizeSingleProductCouponQuickCostValue(hintEntry && hintEntry.costPrice),
              spec: normalizeText(hintEntry && hintEntry.spec)
            };
            const sourceKey = buildSingleProductCouponQuickCostEntryKey(
              nextEntry.shopId,
              resolveSingleProductCouponQuickCostStationValue(nextEntry),
              nextEntry.spec
            );

            sourceEntries.push(nextEntry);

            if (sourceKey) {
              sourceEntryKeys.add(sourceKey);
            }
          });
          return;
        }
      }

      sourceEntries.push(entry);
      const sourceKey = buildSingleProductCouponQuickCostEntryKey(
        shopId,
        station,
        sharedSpec
      );

      if (sourceKey) {
        sourceEntryKeys.add(sourceKey);
      }
    });

    hintEntries.forEach((hintEntry) => {
      const sourceKey = buildSingleProductCouponQuickCostEntryKey(
        hintEntry && hintEntry.shopId,
        hintEntry && hintEntry.station,
        hintEntry && hintEntry.spec
      );

      if (!sourceKey || sourceEntryKeys.has(sourceKey)) {
        return;
      }

      sourceEntries.push({
        shopId: normalizeText(hintEntry && hintEntry.shopId),
        shopName: normalizeText(hintEntry && hintEntry.shopName),
        station: normalizeText(hintEntry && hintEntry.station),
        stationLabel: normalizeText(hintEntry && hintEntry.stationLabel),
        category: normalizeText(hintEntry && hintEntry.category),
        categoryLabel: normalizeText(hintEntry && hintEntry.categoryLabel),
        categoryTrail: normalizeText(hintEntry && hintEntry.categoryTrail),
        spec: normalizeText(hintEntry && hintEntry.spec),
        costPrice: normalizeSingleProductCouponQuickCostValue(hintEntry && hintEntry.costPrice)
      });
      sourceEntryKeys.add(sourceKey);
    });

    return sourceEntries;
  }

  function buildSingleProductCouponQuickCostDialogEntries(snapshotEntries, presetHintEntries) {
    const targetShopIds = buildSingleProductCouponQuickCostTargetShopIds();
    const targetShopIdSet = new Set(targetShopIds);
    const shopNameMap = buildSingleProductCouponQuickCostShopNameMap();
    const entryMap = new Map();
    const sourceEntries = buildSingleProductCouponQuickCostSourceEntries(
      snapshotEntries,
      presetHintEntries,
      targetShopIds
    );

    sourceEntries.forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!shopId || (targetShopIdSet.size > 0 && !targetShopIdSet.has(shopId))) {
        return;
      }

      const station = resolveSingleProductCouponQuickCostStationValue(entry);
      const stationLabel = normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.siteName) || station;
      const spec = normalizeText(entry && entry.spec);
      const key = buildSingleProductCouponQuickCostEntryKey(shopId, station, spec);

      if (!key) {
        return;
      }

      const costPrice = normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice);
      const updatedAt = normalizeText(entry && entry.updatedAt);
      const categoryLabel = normalizeText(entry && entry.categoryTrail)
        || normalizeText(entry && entry.categoryLabel)
        || normalizeText(entry && entry.category);
      const nextEntry = {
        key,
        shopId,
        shopName: normalizeText(entry && entry.shopName) || shopNameMap[shopId] || shopId,
        station,
        stationLabel,
        spec,
        costPrice,
        updatedAt,
        mergedRecordCount: 1,
        mergedCategoryLabels: categoryLabel ? [categoryLabel] : [],
        mergedCostConflict: false
      };
      const previousEntry = entryMap.get(key);

      if (!previousEntry) {
        entryMap.set(key, nextEntry);
        return;
      }

      const previousCostPrice = normalizeSingleProductCouponQuickCostValue(previousEntry && previousEntry.costPrice);
      const previousUpdatedAt = parseTimestamp(previousEntry && previousEntry.updatedAt);
      const nextUpdatedAt = parseTimestamp(updatedAt);
      const shouldReplace = Boolean(costPrice) && (
        !previousCostPrice
        || (
          Number.isFinite(nextUpdatedAt)
          && (
            !Number.isFinite(previousUpdatedAt)
            || nextUpdatedAt > previousUpdatedAt
          )
        )
      );
      const mergedCategoryLabels = Array.from(new Set(
        []
          .concat(Array.isArray(previousEntry && previousEntry.mergedCategoryLabels)
            ? previousEntry.mergedCategoryLabels
            : [])
          .concat(categoryLabel ? [categoryLabel] : [])
          .map((label) => normalizeText(label))
          .filter(Boolean)
      ));
      const mergedEntry = shouldReplace
        ? {
          ...previousEntry,
          ...nextEntry
        }
        : {
          ...nextEntry,
          ...previousEntry
        };

      entryMap.set(key, {
        ...mergedEntry,
        mergedRecordCount: Math.max(1, Number.parseInt(previousEntry && previousEntry.mergedRecordCount, 10) || 1) + 1,
        mergedCategoryLabels,
        mergedCostConflict: previousEntry.mergedCostConflict === true
          || (Boolean(previousCostPrice) && Boolean(costPrice) && previousCostPrice !== costPrice)
      });
    });

    const entries = Array.from(entryMap.values()).sort((left, right) => {
      const leftShopName = normalizeText(left && left.shopName) || normalizeText(left && left.shopId);
      const rightShopName = normalizeText(right && right.shopName) || normalizeText(right && right.shopId);
      const shopCompare = leftShopName.localeCompare(rightShopName, 'zh-CN');

      if (shopCompare !== 0) {
        return shopCompare;
      }

      const stationCompare = (normalizeText(left && left.stationLabel) || normalizeText(left && left.station)).localeCompare(
        normalizeText(right && right.stationLabel) || normalizeText(right && right.station),
        'zh-CN'
      );

      if (stationCompare !== 0) {
        return stationCompare;
      }

      return normalizeText(left && left.spec).localeCompare(
        normalizeText(right && right.spec),
        'zh-CN'
      );
    });

    return {
      entries,
      sourceEntryCount: sourceEntries.length,
      mergedEntryCount: Math.max(0, sourceEntries.length - entries.length),
      conflictCount: entries.filter((entry) => entry && entry.mergedCostConflict === true).length
    };
  }

  function normalizeSingleProductCouponBatchCouponTypes(values, options = {}) {
    const allowedValueSet = new Set(
      SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS.map((option) => normalizeText(option && option.value))
    );
    const normalizedValues = Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter((value) => allowedValueSet.has(value))
    ));

    return normalizedValues.length > 0 || options.allowEmpty === true
      ? normalizedValues
      : [SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS[0].value];
  }

  function formatSingleProductCouponBatchCouponTypeLabels(values) {
    return normalizeSingleProductCouponBatchCouponTypes(values, {
      allowEmpty: true
    })
      .map((value) => {
        const matchedOption = SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS.find((option) => normalizeText(option && option.value) === value);
        return normalizeText(matchedOption && matchedOption.label) || value;
      })
      .filter(Boolean);
  }

  function resolveSingleProductCouponBatchCouponButtonTitle(selectedShopCount) {
    if (selectedShopCount <= 0) {
      return '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa';
    }

    if (marketingToolsState.singleProductCouponQueryRows.length <= 0) {
      return '\u8bf7\u5148\u67e5\u8be2\u53ef\u914d\u5546\u54c1';
    }

    const selectedTypeLabels = formatSingleProductCouponBatchCouponTypeLabels(
      marketingToolsState.singleProductCouponBatchCouponTypes
    );

    return `\u5f53\u524d\u53ef\u6279\u91cf\u8bbe\u7f6e ${marketingToolsState.singleProductCouponQueryRows.length} \u4e2a\u5546\u54c1${selectedTypeLabels.length > 0 ? `\uff0c\u5df2\u9009\u7c7b\u578b ${selectedTypeLabels.join('\u3001')}` : ''}`;
  }

  function resolveSingleProductCouponBatchCreateCouponButtonTitle(selectedShopCount) {
    if (selectedShopCount <= 0) {
      return '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa';
    }

    if (marketingToolsState.singleProductCouponQueryRows.length <= 0) {
      return '\u8bf7\u5148\u67e5\u8be2\u53ef\u914d\u5546\u54c1';
    }

    const creatableCount = buildSingleProductCouponBatchCreateRows().length;

    return `\u5f53\u524d\u53ef\u6279\u91cf\u521b\u5efa ${creatableCount} \u4e2a\u5546\u54c1\u7684\u4f18\u60e0\u5238`;
  }

  function closeSingleProductCouponBatchCouponDialog() {
    marketingToolsState.singleProductCouponBatchCouponDialogOpen = false;
    marketingToolsState.singleProductCouponBatchCouponDialogSaving = false;
    marketingToolsState.singleProductCouponBatchCouponDialogError = '';
    marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
    marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
    marketingToolsState.singleProductCouponBatchCouponDialogTypes = [];
    marketingToolsState.singleProductCouponBatchCouponDialogName = '';
    marketingToolsState.singleProductCouponBatchCouponDialogQuantity = '200';
    marketingToolsState.singleProductCouponBatchCouponDialogStartTime = '';
    marketingToolsState.singleProductCouponBatchCouponDialogEndTime = '';
    marketingToolsState.singleProductCouponBatchCouponDialogAmountMode = DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE;
    marketingToolsState.singleProductCouponBatchCouponDialogAmountFixedDiscount = '';
    marketingToolsState.singleProductCouponBatchCouponDialogAmountCostProfitRate = '';
    marketingToolsState.singleProductCouponBatchCouponDialogAmountSaleProfitRate = '';
    marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorLogic = DEFAULT_SINGLE_PRODUCT_COUPON_BATCH_PROFIT_FLOOR_LOGIC;
    marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorRate = '';
    marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorValue = '';
    syncMarketingToolsDynamicPanels();
  }

  async function openSingleProductCouponBatchCouponDialog() {
    await loadSingleProductCouponBatchCouponSettings();
    const selectedShopIds = buildSingleProductCouponQuickCostTargetShopIds();

    if (selectedShopIds.length <= 0) {
      marketingToolsState.singleProductCouponQueryWarning = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u6279\u91cf\u8bbe\u7f6e\u4f18\u60e0\u5238';
      marketingToolsState.singleProductCouponQueryError = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (marketingToolsState.singleProductCouponQueryRows.length <= 0) {
      marketingToolsState.singleProductCouponQueryWarning = '\u8bf7\u5148\u67e5\u8be2\u53ef\u914d\u5546\u54c1\u540e\u518d\u6279\u91cf\u8bbe\u7f6e\u4f18\u60e0\u5238';
      marketingToolsState.singleProductCouponQueryError = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    marketingToolsState.singleProductCouponBatchCouponDialogOpen = true;
    marketingToolsState.singleProductCouponBatchCouponDialogSaving = false;
    marketingToolsState.singleProductCouponBatchCouponDialogError = '';
    marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
    marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
    marketingToolsState.singleProductCouponBatchCouponDialogTypes = normalizeSingleProductCouponBatchCouponTypes(
      marketingToolsState.singleProductCouponBatchCouponTypes,
      {
        allowEmpty: true
      }
    );
    marketingToolsState.singleProductCouponBatchCouponDialogName = normalizeText(
      marketingToolsState.singleProductCouponBatchCouponName
    );
    marketingToolsState.singleProductCouponBatchCouponDialogQuantity = normalizeText(
      marketingToolsState.singleProductCouponBatchCouponQuantity
    ) || '200';
    marketingToolsState.singleProductCouponBatchCouponDialogStartTime = formatSingleProductCouponBatchCouponDateTimeValue(
      marketingToolsState.singleProductCouponBatchCouponStartTime
    ) || buildSingleProductCouponBatchCouponDefaultTimeRange().start;
    marketingToolsState.singleProductCouponBatchCouponDialogEndTime = formatSingleProductCouponBatchCouponDateTimeValue(
      marketingToolsState.singleProductCouponBatchCouponEndTime
    ) || buildSingleProductCouponBatchCouponDefaultTimeRange().end;
    marketingToolsState.singleProductCouponBatchCouponDialogAmountMode = normalizeSingleProductCouponBatchCouponAmountMode(
      marketingToolsState.singleProductCouponBatchCouponAmountMode
    );
    marketingToolsState.singleProductCouponBatchCouponDialogAmountFixedDiscount = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponAmountFixedDiscount
    );
    marketingToolsState.singleProductCouponBatchCouponDialogAmountCostProfitRate = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponAmountCostProfitRate
    );
    marketingToolsState.singleProductCouponBatchCouponDialogAmountSaleProfitRate = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponAmountSaleProfitRate
    );
    marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorLogic = normalizeSingleProductCouponBatchCouponProfitFloorLogic(
      marketingToolsState.singleProductCouponBatchCouponProfitFloorLogic
    );
    marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorRate = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponProfitFloorRate
    );
    marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponProfitFloorValue
    );
    syncMarketingToolsDynamicPanels();
  }

  function toggleSingleProductCouponBatchCouponType(value, checked) {
    const normalizedValue = normalizeText(value);
    const currentTypes = normalizeSingleProductCouponBatchCouponTypes(
      marketingToolsState.singleProductCouponBatchCouponDialogTypes,
      {
        allowEmpty: true
      }
    );
    const nextTypeSet = new Set(currentTypes);

    if (checked) {
      nextTypeSet.add(normalizedValue);
    } else {
      nextTypeSet.delete(normalizedValue);
    }

    marketingToolsState.singleProductCouponBatchCouponDialogTypes = normalizeSingleProductCouponBatchCouponTypes(Array.from(nextTypeSet), {
      allowEmpty: true
    });
    marketingToolsState.singleProductCouponBatchCouponDialogError = '';
    marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
    marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
  }

  function selectSingleProductCouponBatchCouponAmountMode(value) {
    marketingToolsState.singleProductCouponBatchCouponDialogAmountMode = normalizeSingleProductCouponBatchCouponAmountMode(value);
    marketingToolsState.singleProductCouponBatchCouponDialogError = '';
    marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
    marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
  }

  function renderSingleProductCouponBatchCouponAmountSettingField(selectedMode, options = {}) {
    const normalizedSelectedMode = normalizeSingleProductCouponBatchCouponAmountMode(selectedMode);
    const saving = options.saving === true;
    const selectedOption = SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE_OPTIONS.find(
      (option) => normalizeText(option && option.value) === normalizedSelectedMode
    ) || SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE_OPTIONS[0];
    const rateField = normalizeText(selectedOption && selectedOption.rateField);
    const ratePlaceholder = normalizeText(selectedOption && selectedOption.ratePlaceholder) || '\u8f93\u5165\u5229\u6da6\u7387';
    const rateUnit = normalizeText(selectedOption && selectedOption.rateUnit) || '%';
    const fixedDiscount = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountFixedDiscount
    );
    const costProfitRate = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountCostProfitRate
    );
    const saleProfitRate = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountSaleProfitRate
    );
    const rateValue = rateField === 'batchCouponAmountFixedDiscount'
      ? fixedDiscount
      : rateField === 'batchCouponAmountCostProfitRate'
      ? costProfitRate
      : rateField === 'batchCouponAmountSaleProfitRate'
        ? saleProfitRate
        : '';

    return `
      <div class="ops-marketing-tools-batch-coupon-field">
        <div class="ops-activity-filter-label-row">
          <span class="ops-activity-filter-field-label">\u5238\u91d1\u989d\u8bbe\u7f6e</span>
        </div>
        <div class="ops-marketing-tools-batch-coupon-amount-inline">
          <select
            class="ops-activity-filter-input ops-marketing-tools-batch-coupon-amount-select"
            data-single-product-coupon-field="batchCouponAmountMode"
            ${saving ? 'disabled' : ''}
          >
            ${SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE_OPTIONS.map((option) => {
      const optionValue = normalizeText(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;
      return `
              <option value="${escapeHtml(optionValue)}"${optionValue === normalizedSelectedMode ? ' selected' : ''}>
                ${escapeHtml(optionLabel)}
              </option>
            `;
    }).join('')}
          </select>
          ${rateField ? `
            <span class="ops-marketing-tools-batch-coupon-amount-input-wrap">
              <input
                class="ops-activity-filter-input ops-marketing-tools-batch-coupon-amount-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="${escapeHtmlAttribute(ratePlaceholder)}"
                data-single-product-coupon-field="${escapeHtml(rateField)}"
                value="${escapeHtmlAttribute(rateValue)}"
                ${saving ? 'disabled' : ''}
              />
              <span class="ops-activity-filter-unit">${escapeHtml(rateUnit)}</span>
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderSingleProductCouponBatchCouponProfitFloorField(options = {}) {
    const saving = options.saving === true;
    const logicMode = normalizeSingleProductCouponBatchCouponProfitFloorLogic(
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorLogic
    );
    const profitFloorRate = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorRate
    );
    const profitFloorValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorValue
    );

    return `
      <div class="ops-marketing-tools-batch-coupon-field">
        <div class="ops-activity-filter-label-row">
          <span class="ops-activity-filter-field-label">\u4fdd\u5e95\u5229\u6da6\u8bbe\u7f6e</span>
        </div>
        <div class="ops-marketing-tools-batch-coupon-profit-floor-row">
          <label class="ops-marketing-tools-batch-coupon-profit-floor-inline">
            <span class="ops-marketing-tools-batch-coupon-inline-label">\u4fdd\u5e95\u5229\u6da6\u7387</span>
            <span class="ops-marketing-tools-batch-coupon-amount-input-wrap">
              <input
                class="ops-activity-filter-input ops-marketing-tools-batch-coupon-amount-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="\u8f93\u5165\u4fdd\u5e95\u5229\u6da6\u7387"
                data-single-product-coupon-field="batchCouponProfitFloorRate"
                value="${escapeHtmlAttribute(profitFloorRate)}"
                ${saving ? 'disabled' : ''}
              />
              <span class="ops-activity-filter-unit">%</span>
            </span>
          </label>
          <label class="ops-marketing-tools-batch-coupon-profit-floor-inline is-logic">
            <span class="ops-marketing-tools-batch-coupon-inline-label">\u6761\u4ef6</span>
            <select
              class="ops-activity-filter-input"
              data-single-product-coupon-field="batchCouponProfitFloorLogic"
              ${saving ? 'disabled' : ''}
            >
              <option value="and"${logicMode === 'and' ? ' selected' : ''}>\u4e14</option>
              <option value="or"${logicMode === 'or' ? ' selected' : ''}>\u6216</option>
            </select>
          </label>
          <label class="ops-marketing-tools-batch-coupon-profit-floor-inline">
            <span class="ops-marketing-tools-batch-coupon-inline-label">\u4fdd\u5e95\u5229\u6da6\u503c</span>
            <span class="ops-marketing-tools-batch-coupon-amount-input-wrap">
              <input
                class="ops-activity-filter-input ops-marketing-tools-batch-coupon-amount-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="\u8f93\u5165\u4fdd\u5e95\u5229\u6da6\u503c"
                data-single-product-coupon-field="batchCouponProfitFloorValue"
                value="${escapeHtmlAttribute(profitFloorValue)}"
                ${saving ? 'disabled' : ''}
              />
              <span class="ops-activity-filter-unit">\u5143</span>
            </span>
          </label>
        </div>
      </div>
    `;
  }

  async function saveSingleProductCouponBatchCouponDialog() {
    const couponName = normalizeText(marketingToolsState.singleProductCouponBatchCouponDialogName);
    const couponQuantityValue = normalizeText(marketingToolsState.singleProductCouponBatchCouponDialogQuantity);
    const couponQuantity = Number.parseInt(couponQuantityValue, 10);
    const selectedTypes = normalizeSingleProductCouponBatchCouponTypes(
      marketingToolsState.singleProductCouponBatchCouponDialogTypes,
      {
        allowEmpty: true
      }
    );
    const startTime = formatSingleProductCouponBatchCouponDateTimeValue(
      marketingToolsState.singleProductCouponBatchCouponDialogStartTime
    );
    const endTime = formatSingleProductCouponBatchCouponDateTimeValue(
      marketingToolsState.singleProductCouponBatchCouponDialogEndTime
    );
    const amountMode = normalizeSingleProductCouponBatchCouponAmountMode(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountMode
    );
    const fixedDiscountValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountFixedDiscount
    );
    const costProfitRateValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountCostProfitRate
    );
    const saleProfitRateValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountSaleProfitRate
    );
    const profitFloorLogic = normalizeSingleProductCouponBatchCouponProfitFloorLogic(
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorLogic
    );
    const profitFloorRateValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorRate
    );
    const profitFloorValueValue = normalizeSingleProductCouponBatchCouponRateValue(
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorValue
    );
    const fixedDiscount = Number.parseFloat(fixedDiscountValue);
    const costProfitRate = Number.parseFloat(costProfitRateValue);
    const saleProfitRate = Number.parseFloat(saleProfitRateValue);
    const profitFloorRate = Number.parseFloat(profitFloorRateValue);
    const profitFloorValue = Number.parseFloat(profitFloorValueValue);

    if (!couponName) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u5148\u8f93\u5165\u5238\u540d\u79f0';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (!Number.isFinite(couponQuantity) || couponQuantity < 200) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u53d1\u5238\u6570\u91cf\u4e0d\u80fd\u5c0f\u4e8e 200';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (selectedTypes.length <= 0) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u79cd\u4f18\u60e0\u5238\u7c7b\u578b';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (!startTime || !endTime) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u8bbe\u7f6e\u5b8c\u6574\u7684\u53d1\u5238\u65f6\u95f4';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (Date.parse(startTime) > Date.parse(endTime)) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u53d1\u5238\u7ed3\u675f\u65f6\u95f4\u4e0d\u80fd\u65e9\u4e8e\u5f00\u59cb\u65f6\u95f4';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (amountMode === 'fixed-discount' && (!Number.isFinite(fixedDiscount) || fixedDiscount <= 0)) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u586b\u5199\u6709\u6548\u7684\u56fa\u5b9a\u4f18\u60e0\u5238\u91d1\u989d';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (amountMode === 'cost-profit-rate' && (!Number.isFinite(costProfitRate) || costProfitRate <= 0)) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u586b\u5199\u6709\u6548\u7684\u6210\u672c\u8ba9\u5229\u6bd4\u4f8b';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (amountMode === 'sale-profit-rate' && (!Number.isFinite(saleProfitRate) || saleProfitRate <= 0)) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u586b\u5199\u6709\u6548\u7684\u552e\u4ef7\u8ba9\u5229\u6bd4\u4f8b';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (profitFloorRateValue && (!Number.isFinite(profitFloorRate) || profitFloorRate < 0)) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u586b\u5199\u6709\u6548\u7684\u4fdd\u5e95\u5229\u6da6\u7387';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (profitFloorValueValue && (!Number.isFinite(profitFloorValue) || profitFloorValue < 0)) {
      marketingToolsState.singleProductCouponBatchCouponDialogError = '\u8bf7\u586b\u5199\u6709\u6548\u7684\u4fdd\u5e95\u5229\u6da6\u503c';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    marketingToolsState.singleProductCouponBatchCouponDialogSaving = true;
    marketingToolsState.singleProductCouponBatchCouponDialogError = '';
    marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
    marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
    syncMarketingToolsDynamicPanels();

    try {
      marketingToolsState.singleProductCouponBatchCouponName = couponName;
      marketingToolsState.singleProductCouponBatchCouponQuantity = String(couponQuantity);
      marketingToolsState.singleProductCouponBatchCouponStartTime = startTime;
      marketingToolsState.singleProductCouponBatchCouponEndTime = endTime;
      marketingToolsState.singleProductCouponBatchCouponTypes = selectedTypes;
      marketingToolsState.singleProductCouponBatchCouponAmountMode = amountMode;
      marketingToolsState.singleProductCouponBatchCouponAmountFixedDiscount = fixedDiscountValue;
      marketingToolsState.singleProductCouponBatchCouponAmountCostProfitRate = costProfitRateValue;
      marketingToolsState.singleProductCouponBatchCouponAmountSaleProfitRate = saleProfitRateValue;
      marketingToolsState.singleProductCouponBatchCouponProfitFloorLogic = profitFloorLogic;
      marketingToolsState.singleProductCouponBatchCouponProfitFloorRate = profitFloorRateValue;
      marketingToolsState.singleProductCouponBatchCouponProfitFloorValue = profitFloorValueValue;
      await persistSingleProductCouponBatchCouponSettings(buildSingleProductCouponBatchCouponSettingsPayload());
      closeSingleProductCouponBatchCouponDialog();
    } finally {
      marketingToolsState.singleProductCouponBatchCouponDialogSaving = false;
      syncMarketingToolsDynamicPanels();
    }
  }

  function closeSingleProductCouponQuickCostDialog() {
    marketingToolsState.singleProductCouponQuickCostDialogOpen = false;
    marketingToolsState.singleProductCouponQuickCostDialogLoading = false;
    marketingToolsState.singleProductCouponQuickCostDialogSaving = false;
    marketingToolsState.singleProductCouponQuickCostDialogError = '';
    marketingToolsState.singleProductCouponQuickCostDialogWarning = '';
    marketingToolsState.singleProductCouponQuickCostDialogNotice = '';
    marketingToolsState.singleProductCouponQuickCostDialogEntries = [];
    marketingToolsState.singleProductCouponQuickCostDialogShopCount = 0;
    marketingToolsState.singleProductCouponQuickCostDialogSourceEntryCount = 0;
    marketingToolsState.singleProductCouponQuickCostDialogMergedEntryCount = 0;
    marketingToolsState.singleProductCouponQuickCostDialogConflictCount = 0;
    syncMarketingToolsDynamicPanels();
  }

  async function openSingleProductCouponQuickCostDialog() {
    const featureCenterApi = getFeatureCenterApi();

    if (
      marketingToolsState.singleProductCouponShopSelectorLoaded !== true
      && marketingToolsState.singleProductCouponShopSelectorLoading !== true
    ) {
      await loadSingleProductCouponShopCatalog();
    }

    const targetShopIds = buildSingleProductCouponQuickCostTargetShopIds();

    if (targetShopIds.length <= 0) {
      marketingToolsState.singleProductCouponQueryWarning = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7';
      syncMarketingToolsDynamicPanels();
      return;
    }

    marketingToolsState.singleProductCouponQuickCostDialogOpen = true;
    marketingToolsState.singleProductCouponQuickCostDialogLoading = true;
    marketingToolsState.singleProductCouponQuickCostDialogSaving = false;
    marketingToolsState.singleProductCouponQuickCostDialogError = '';
    marketingToolsState.singleProductCouponQuickCostDialogWarning = '';
    marketingToolsState.singleProductCouponQuickCostDialogNotice = '';
    marketingToolsState.singleProductCouponQuickCostDialogEntries = [];
    marketingToolsState.singleProductCouponQuickCostDialogShopCount = targetShopIds.length;
    marketingToolsState.singleProductCouponQuickCostDialogSourceEntryCount = 0;
    marketingToolsState.singleProductCouponQuickCostDialogMergedEntryCount = 0;
    marketingToolsState.singleProductCouponQuickCostDialogConflictCount = 0;
    syncMarketingToolsDynamicPanels();

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      marketingToolsState.singleProductCouponQuickCostDialogLoading = false;
      marketingToolsState.singleProductCouponQuickCostDialogError = '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u8bfb\u53d6\u63a5\u53e3\u672a\u52a0\u8f7d';
      syncMarketingToolsDynamicPanels();
      return;
    }

    try {
      const response = await featureCenterApi.getOperationsSharedCostSnapshot({
        shopIds: targetShopIds,
        refreshCloud: true
      });
      let presetResponse = {
        entries: [],
        warning: ''
      };

      if (typeof featureCenterApi.getOperationsNewProductLifecycleBatchAdjustPresetSnapshot === 'function') {
        try {
          presetResponse = await featureCenterApi.getOperationsNewProductLifecycleBatchAdjustPresetSnapshot({
            shopIds: targetShopIds
          });
        } catch (error) {
          presetResponse = {
            entries: [],
            warning: normalizeText(error && error.message)
              || '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u89c4\u683c\u9884\u8bbe\u52a0\u8f7d\u5931\u8d25'
          };
        }
      }

      const presetHintEntries = buildSingleProductCouponQuickCostHintEntriesFromRows(
        marketingToolsState.singleProductCouponQueryRows
      ).concat(Array.isArray(presetResponse && presetResponse.entries) ? presetResponse.entries : []);
      const aggregateResult = buildSingleProductCouponQuickCostDialogEntries(
        response && response.entries,
        presetHintEntries
      );
      const warningList = [];

      if (normalizeText(response && response.warning)) {
        warningList.push(normalizeText(response && response.warning));
      }

      if (normalizeText(presetResponse && presetResponse.warning)) {
        warningList.push(normalizeText(presetResponse && presetResponse.warning));
      }

      if (aggregateResult.conflictCount > 0) {
        warningList.push(`\u5df2\u6309\u201c\u5e97\u94faID + \u7ad9\u70b9ID + SKU\u540d\u79f0\u201d\u805a\u5408\u5386\u53f2\u6210\u672c\u4ef7\uff0c\u5176\u4e2d ${aggregateResult.conflictCount} \u9879\u547d\u4e2d\u4e86\u591a\u6761\u4e0d\u540c\u6210\u672c\u4ef7\u8bb0\u5f55\uff0c\u5df2\u9ed8\u8ba4\u53d6\u6700\u8fd1\u66f4\u65b0\u7684\u6210\u672c\u4ef7\u3002`);
      }

      marketingToolsState.singleProductCouponQuickCostDialogEntries = aggregateResult.entries;
      marketingToolsState.singleProductCouponQuickCostEntries = aggregateResult.entries.slice();
      marketingToolsState.singleProductCouponQuickCostDialogSourceEntryCount = aggregateResult.sourceEntryCount;
      marketingToolsState.singleProductCouponQuickCostDialogMergedEntryCount = aggregateResult.mergedEntryCount;
      marketingToolsState.singleProductCouponQuickCostDialogConflictCount = aggregateResult.conflictCount;
      marketingToolsState.singleProductCouponQuickCostDialogWarning = warningList.join('\n');
    } catch (error) {
      marketingToolsState.singleProductCouponQuickCostDialogError = normalizeText(error && error.message) || '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u52a0\u8f7d\u5931\u8d25';
    } finally {
      marketingToolsState.singleProductCouponQuickCostDialogLoading = false;
      syncMarketingToolsDynamicPanels();
    }
  }

  async function saveSingleProductCouponQuickCostDialog() {
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsSharedCostBatch !== 'function'
    ) {
      marketingToolsState.singleProductCouponQuickCostDialogError = '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
      syncMarketingToolsDynamicPanels();
      return null;
    }

    marketingToolsState.singleProductCouponQuickCostDialogSaving = true;
    marketingToolsState.singleProductCouponQuickCostDialogError = '';
    marketingToolsState.singleProductCouponQuickCostDialogWarning = '';
    marketingToolsState.singleProductCouponQuickCostDialogNotice = '';
    syncMarketingToolsDynamicPanels();

    try {
      const payloadEntries = (Array.isArray(marketingToolsState.singleProductCouponQuickCostDialogEntries)
        ? marketingToolsState.singleProductCouponQuickCostDialogEntries
        : [])
        .map((entry) => ({
          shopId: normalizeText(entry && entry.shopId),
          shopName: normalizeText(entry && entry.shopName),
          station: resolveSingleProductCouponQuickCostStationValue(entry),
          stationLabel: normalizeText(entry && entry.stationLabel),
          spec: normalizeText(entry && entry.spec),
          costPrice: normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice)
        }))
        .filter((entry) => buildSingleProductCouponQuickCostEntryKey(entry.shopId, entry.station, entry.spec));
      const response = await featureCenterApi.saveOperationsSharedCostBatch({
        entries: payloadEntries
      });

      marketingToolsState.singleProductCouponQuickCostDialogEntries = payloadEntries.map((entry) => ({
        ...entry,
        key: buildSingleProductCouponQuickCostEntryKey(entry.shopId, entry.station, entry.spec),
        updatedAt: normalizeText(response && response.updatedAt),
        mergedRecordCount: 1,
        mergedCategoryLabels: [],
        mergedCostConflict: false
      }));
      marketingToolsState.singleProductCouponQuickCostEntries = marketingToolsState.singleProductCouponQuickCostDialogEntries.slice();
      marketingToolsState.singleProductCouponQuickCostDialogSourceEntryCount = payloadEntries.length;
      marketingToolsState.singleProductCouponQuickCostDialogMergedEntryCount = 0;
      marketingToolsState.singleProductCouponQuickCostDialogConflictCount = 0;
      marketingToolsState.singleProductCouponQuickCostDialogWarning = normalizeText(response && response.warning)
        || (response && response.cloudSynced !== true
          ? '\u6210\u672c\u9884\u8bbe\u5df2\u4fdd\u5b58\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
          : '');
      marketingToolsState.singleProductCouponQuickCostDialogNotice = `\u5df2\u4fdd\u5b58 ${payloadEntries.length} \u9879\u6210\u672c\u9884\u8bbe`;
      return response;
    } catch (error) {
      marketingToolsState.singleProductCouponQuickCostDialogError = normalizeText(error && error.message) || '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u5931\u8d25';
      return null;
    } finally {
      marketingToolsState.singleProductCouponQuickCostDialogSaving = false;
      syncMarketingToolsDynamicPanels();
    }
  }

  function buildSingleProductCouponResultStatusDisplay(row, couponPreview) {
    const normalizedCouponPreview = couponPreview && typeof couponPreview === 'object'
      ? couponPreview
      : resolveSingleProductCouponPlannedCouponPreview(row);
    const createStatusDetail = buildSingleProductCouponCreateStatusDetail(
      getSingleProductCouponCreateRowStatusEntry(row)
    );
    const shouldFilterOut = row && row.shouldFilterOut === true;
    const filterReasonText = normalizeText(row && row.filterReasonText);
    const modeOption = SINGLE_PRODUCT_COUPON_BATCH_AMOUNT_MODE_OPTIONS.find((option) => {
      return normalizeText(option && option.value) === normalizeText(normalizedCouponPreview && normalizedCouponPreview.amountMode);
    });
    const modeLabel = normalizeText(modeOption && modeOption.label) || '\u5238\u91d1\u989d\u89c4\u5219';
    const couponAmountText = normalizeText(normalizedCouponPreview && normalizedCouponPreview.couponAmountText) || '-';
    const dealPriceText = normalizeText(normalizedCouponPreview && normalizedCouponPreview.dealPriceText) || '-';
    const profitRateText = normalizeText(normalizedCouponPreview && normalizedCouponPreview.profitRateText) || '-';
    const profitValueText = normalizeText(normalizedCouponPreview && normalizedCouponPreview.profitValueText) || '-';
    const agreementId = normalizeText(row && row.agreementId);

    if (createStatusDetail) {
      return createStatusDetail;
    }

    if (shouldFilterOut) {
      return {
        label: '\u4e0d\u5efa\u8bae',
        tone: 'is-warning',
        detailText: filterReasonText || '\u5f53\u524d\u5546\u54c1\u4e0d\u5efa\u8bae\u521b\u5efa\u4f18\u60e0\u5238'
      };
    }

    if (filterReasonText) {
      return {
        label: '\u5f85\u4eba\u5de5\u786e\u8ba4',
        tone: 'is-accent',
        detailText: `\u5e73\u53f0\u63d0\u793a\uff1a${filterReasonText}`
      };
    }

    if (normalizedCouponPreview.status !== 'ready') {
      return {
        label: '\u6761\u4ef6\u4e0d\u8db3',
        tone: 'is-warning',
        detailText: `\u6682\u4e0d\u53ef\u4f18\u60e0\uff1a${normalizeText(normalizedCouponPreview.reason) || '\u5f53\u524d\u5546\u54c1\u6682\u65e0\u6cd5\u8ba1\u7b97\u4f18\u60e0\u5238'}`
      };
    }

    if (normalizedCouponPreview.status === 'ready' && !agreementId) {
      return {
        label: '\u6682\u4e0d\u53ef\u521b\u5efa',
        tone: 'is-warning',
        detailText: '\u4f18\u60e0\u89c4\u5219\u5df2\u8ba1\u7b97\uff0c\u4f46\u7f3a\u5c11 agreementId\uff0c\u6682\u65f6\u65e0\u6cd5\u63d0\u4ea4\u521b\u5efa'
      };
    }

    return {
      label: '\u53ef\u4f18\u60e0',
      tone: 'is-success',
      detailText: `\u4f18\u60e0\u9884\u89c8\uff1a${modeLabel}\u3001\u5238\u989d ${couponAmountText}\u3001\u5238\u540e\u4ef7 ${dealPriceText}\u3001\u5229\u6da6 ${profitRateText} / ${profitValueText}`
    };
  }

  function renderSingleProductCouponQuickCostEntryCard() {
    const selectedShopCount = buildSingleProductCouponQuickCostTargetShopIds().length;
    const quickCostDisabled = selectedShopCount <= 0
      || marketingToolsState.singleProductCouponQuickCostDialogLoading === true
      || marketingToolsState.singleProductCouponQuickCostDialogSaving === true
      || marketingToolsState.singleProductCouponCreateRunning === true;
    const batchCouponDisabled = selectedShopCount <= 0
      || marketingToolsState.singleProductCouponQueryRows.length <= 0
      || marketingToolsState.singleProductCouponQueryRunning === true
      || marketingToolsState.singleProductCouponCreateRunning === true;
    const batchCreateCouponDisabled = batchCouponDisabled;

    return `
      <section class="ops-marketing-tools-quick-cost-entry-card">
        <div class="ops-marketing-tools-quick-cost-entry-actions">
          <button
            class="ops-marketing-tools-action-button ops-marketing-tools-batch-action-button is-primary"
            type="button"
            data-single-product-coupon-action="quick-cost"
            title="${escapeHtml(selectedShopCount > 0 ? `\u5f53\u524d\u5df2\u9009 ${selectedShopCount} \u5bb6\u5e97\u94fa` : '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa')}"
            ${quickCostDisabled ? 'disabled' : ''}
          >
            \u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7
          </button>
          <button
            class="ops-marketing-tools-action-button ops-marketing-tools-batch-action-button is-danger"
            type="button"
            data-single-product-coupon-action="batch-coupon"
            title="${escapeHtml(resolveSingleProductCouponBatchCouponButtonTitle(selectedShopCount))}"
            ${batchCouponDisabled ? 'disabled' : ''}
          >
            \u6279\u91cf\u8bbe\u7f6e\u4f18\u60e0\u5238
          </button>
          <button
            class="ops-marketing-tools-action-button ops-marketing-tools-batch-action-button is-danger"
            type="button"
            data-single-product-coupon-action="batch-create-coupon"
            title="${escapeHtml(resolveSingleProductCouponBatchCreateCouponButtonTitle(selectedShopCount))}"
            ${batchCreateCouponDisabled ? 'disabled' : ''}
          >
            ${marketingToolsState.singleProductCouponCreateRunning === true ? '\u521b\u5efa\u4e2d' : '\u6279\u91cf\u521b\u5efa\u4f18\u60e0\u5238'}
          </button>
        </div>
      </section>
    `;
  }

  function renderSingleProductCouponQuickCostDialog() {
    if (marketingToolsState.singleProductCouponQuickCostDialogOpen !== true) {
      return '';
    }

    const groupedEntries = groupSingleProductCouponQuickCostDialogEntries(
      marketingToolsState.singleProductCouponQuickCostDialogEntries
    );
    const selectedShopCount = Math.max(
      Math.max(0, Number.parseInt(marketingToolsState.singleProductCouponQuickCostDialogShopCount, 10) || 0),
      buildSingleProductCouponQuickCostTargetShopIds().length
    );
    const mergedEntryCount = Math.max(0, Number.parseInt(marketingToolsState.singleProductCouponQuickCostDialogMergedEntryCount, 10) || 0);
    const conflictCount = Math.max(0, Number.parseInt(marketingToolsState.singleProductCouponQuickCostDialogConflictCount, 10) || 0);

    return `
      <div class="ops-activity-quick-cost-modal" data-single-product-coupon-quick-cost-backdrop="true">
        <div class="ops-activity-quick-cost-dialog" data-single-product-coupon-quick-cost-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7</h3>
              <p class="ops-activity-quick-cost-subtitle">
                \u8fd9\u91cc\u4f1a\u6c47\u603b\u5f53\u524d\u5df2\u9009 ${escapeHtml(String(selectedShopCount))} \u5bb6\u5e97\u94fa\u7684\u5171\u4eab\u6210\u672c\u9884\u8bbe\uff0c\u5e76\u7ed3\u5408\u672c\u6b21\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u5230\u7684 SKU / SKC \u89c4\u683c\u8865\u9f50\u5f85\u7f16\u8f91\u9879\u3002
                <br />
                \u4f1a\u4f18\u5148\u6309\u201c\u5e97\u94faID + \u7ad9\u70b9ID + SKU\u89c4\u683c\u201d\u805a\u5408\u5c55\u793a\uff0c\u82e5\u547d\u4e2d\u591a\u6761\u5386\u53f2\u8bb0\u5f55\uff0c\u9ed8\u8ba4\u53d6\u6700\u8fd1\u66f4\u65b0\u7684\u6210\u672c\u4ef7\u3002
              </p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-single-product-coupon-quick-cost-action="close"
              ${marketingToolsState.singleProductCouponQuickCostDialogSaving === true ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body">
            ${marketingToolsState.singleProductCouponQuickCostDialogLoading === true
        ? `<div class="ops-activity-quick-cost-empty">\u6b63\u5728\u4ece\u4e91\u7aef\u52a0\u8f7d\u5171\u4eab\u6210\u672c\u9884\u8bbe...</div>`
        : groupedEntries.length <= 0
          ? `<div class="ops-activity-quick-cost-empty">\u5f53\u524d\u5df2\u9009\u5e97\u94fa\u4e0b\uff0c\u6682\u65e0\u5df2\u4fdd\u5b58\u7684\u5171\u4eab\u6210\u672c\u6216\u53ef\u5339\u914d\u7684 SKU / SKC \u89c4\u683c\u3002</div>`
          : groupedEntries.map((group) => `
              <section class="ops-activity-quick-cost-group">
                <div class="ops-activity-quick-cost-group-header">
                  <strong>${escapeHtml(normalizeText(group && group.shopName) || normalizeText(group && group.shopId) || '--')}</strong>
                  <span>${escapeHtml(normalizeText(group && group.shopId) || '--')}</span>
                </div>
                <div class="ops-activity-quick-cost-group-list">
                  ${(Array.isArray(group && group.entries) ? group.entries : []).map((entry) => {
      const mergedRecordCount = Math.max(1, Number.parseInt(entry && entry.mergedRecordCount, 10) || 1);
      const mergedCategoryLabels = Array.isArray(entry && entry.mergedCategoryLabels)
        ? entry.mergedCategoryLabels.filter(Boolean)
        : [];
      const metaTextParts = [
        normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.station) || '--'
      ];
      const metaTitleParts = metaTextParts.slice();

      if (mergedRecordCount > 1) {
        metaTextParts.push(`\u805a\u5408 ${mergedRecordCount} \u6761`);
        metaTitleParts.push(`\u5df2\u805a\u5408 ${mergedRecordCount} \u6761\u5386\u53f2\u8bb0\u5f55`);
      }

      if (normalizeText(entry && entry.updatedAt)) {
        metaTitleParts.push(`\u6700\u8fd1\u66f4\u65b0 ${formatSingleProductCouponQuickCostDateTime(entry.updatedAt)}`);
      }

      if (mergedCategoryLabels.length > 0) {
        metaTitleParts.push(`\u6765\u6e90\u7c7b\u76ee ${mergedCategoryLabels.join(' / ')}`);
      }

      return `
                    <label class="ops-activity-quick-cost-item">
                      <span class="ops-activity-quick-cost-spec">
                        ${escapeHtml(normalizeText(entry && entry.spec) || '--')}
                        <small
                          class="ops-activity-quick-cost-meta"
                          ${metaTitleParts.length > 0 ? `title="${escapeHtmlAttribute(metaTitleParts.join('\n'))}"` : ''}
                        >
                          ${escapeHtml(metaTextParts.join(' \u00b7 '))}
                        </small>
                      </span>
                      <span class="ops-activity-quick-cost-input-shell">
                        <input
                          class="ops-activity-quick-cost-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value="${escapeHtml(normalizeSingleProductCouponQuickCostValue(entry && entry.costPrice))}"
                          data-single-product-coupon-quick-cost-input="${escapeHtml(normalizeText(entry && entry.key))}"
                        />
                      </span>
                    </label>
                  `;
    }).join('')}
                </div>
              </section>
            `).join('')}
          </div>
          <div class="ops-activity-quick-cost-footer">
            ${marketingToolsState.singleProductCouponQuickCostDialogError ? `<div class="ops-activity-quick-cost-message is-error">${escapeHtml(marketingToolsState.singleProductCouponQuickCostDialogError)}</div>` : ''}
            ${marketingToolsState.singleProductCouponQuickCostDialogWarning ? `<div class="ops-activity-quick-cost-message is-warning">${escapeHtml(marketingToolsState.singleProductCouponQuickCostDialogWarning)}</div>` : ''}
            ${marketingToolsState.singleProductCouponQuickCostDialogNotice ? `<div class="ops-activity-quick-cost-message is-success">${escapeHtml(marketingToolsState.singleProductCouponQuickCostDialogNotice)}</div>` : ''}
            <div class="ops-activity-quick-cost-actions">
              <span class="ops-activity-quick-cost-message">
                \u5df2\u6c47\u603b ${escapeHtml(String((marketingToolsState.singleProductCouponQuickCostDialogEntries || []).length))} \u9879
                ${mergedEntryCount > 0 ? `\uff0c\u5df2\u805a\u5408 ${escapeHtml(String(mergedEntryCount))} \u6761\u91cd\u590d\u5386\u53f2\u8bb0\u5f55` : ''}
                ${conflictCount > 0 ? `\uff0c${escapeHtml(String(conflictCount))} \u9879\u5b58\u5728\u591a\u6761\u6210\u672c\u4ef7\u8bb0\u5f55` : ''}
              </span>
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-single-product-coupon-quick-cost-action="close"
                ${marketingToolsState.singleProductCouponQuickCostDialogSaving === true ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-single-product-coupon-quick-cost-action="save"
                ${marketingToolsState.singleProductCouponQuickCostDialogLoading === true || marketingToolsState.singleProductCouponQuickCostDialogSaving === true ? 'disabled' : ''}
              >
                ${marketingToolsState.singleProductCouponQuickCostDialogSaving === true ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSingleProductCouponBatchCouponDialog() {
    if (marketingToolsState.singleProductCouponBatchCouponDialogOpen !== true) {
      return '';
    }

    const selectedShopCount = buildSingleProductCouponQuickCostTargetShopIds().length;
    const couponName = normalizeText(marketingToolsState.singleProductCouponBatchCouponDialogName);
    const couponQuantity = normalizeText(marketingToolsState.singleProductCouponBatchCouponDialogQuantity) || '200';
    const selectedTypes = normalizeSingleProductCouponBatchCouponTypes(
      marketingToolsState.singleProductCouponBatchCouponDialogTypes,
      {
        allowEmpty: true
      }
    );
    const amountMode = normalizeSingleProductCouponBatchCouponAmountMode(
      marketingToolsState.singleProductCouponBatchCouponDialogAmountMode
    );
    const startTime = formatSingleProductCouponBatchCouponDateTimeValue(
      marketingToolsState.singleProductCouponBatchCouponDialogStartTime
    );
    const endTime = formatSingleProductCouponBatchCouponDateTimeValue(
      marketingToolsState.singleProductCouponBatchCouponDialogEndTime
    );

    return `
      <div class="ops-activity-quick-cost-modal" data-single-product-coupon-batch-coupon-backdrop="true">
        <div class="ops-activity-quick-cost-dialog ops-marketing-tools-batch-coupon-dialog" data-single-product-coupon-batch-coupon-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u6279\u91cf\u8bbe\u7f6e\u4f18\u60e0\u5238</h3>
              <p class="ops-activity-quick-cost-subtitle">
                \u5f53\u524d\u5df2\u9009 ${escapeHtml(String(selectedShopCount))} \u5bb6\u5e97\u94fa\uff0c\u672c\u6b21\u67e5\u8be2\u5171\u83b7\u5f97 ${escapeHtml(String(marketingToolsState.singleProductCouponQueryRows.length))} \u4e2a\u53ef\u914d\u5546\u54c1\u3002
              </p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-single-product-coupon-batch-coupon-action="close"
              ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body">
            <section class="ops-marketing-tools-batch-coupon-card">
              <div class="ops-marketing-tools-batch-coupon-inline-grid">
                <div class="ops-marketing-tools-batch-coupon-field ops-marketing-tools-batch-coupon-type-field">
                  <div class="ops-activity-filter-label-row">
                    <span class="ops-activity-filter-field-label">\u4f18\u60e0\u5238\u7c7b\u578b</span>
                    <span class="ops-activity-filter-help">
                      <button
                        class="ops-activity-filter-help-trigger"
                        type="button"
                        aria-label="\u4f18\u60e0\u5238\u7c7b\u578b\u63d0\u793a"
                      >
                        ?
                      </button>
                      <span class="ops-activity-filter-help-bubble">
                        <strong>\u4ec0\u4e48\u662f\u7acb\u51cf\u5238\uff1f</strong><br />
                        \u7acb\u51cf\u5238\u662f\u5355\u4e2a\u5546\u54c1\u53ef\u7528\u7684\u65e0\u95e8\u69db\u4f18\u60e0\u5238\uff0c\u53ea\u80fd\u4f5c\u7528\u4e8e\u5355\u4e2a\u5546\u54c1\uff0c\u53ef\u8bbe\u7f6e\u53d1\u884c\u5f20\u6570\u3002\u83b7\u5f97\u7acb\u51cf\u5238\u7684\u6d88\u8d39\u8005\u53ef\u4ee5\u5728\u4e0b\u5355\u65f6\u4f7f\u7528\u3002
                        <br /><br />
                        <strong>\u7acb\u51cf\u5238\u6709\u4ec0\u4e48\u5e2e\u52a9\uff1f</strong><br />
                        \u9488\u5bf9\u5174\u8da3\u6f5c\u5ba2\u4eba\u7fa4\u8bbe\u7acb\u4f18\u60e0\uff0c\u6709\u52a9\u63d0\u5347\u5bf9\u5546\u54c1\u611f\u5174\u8da3\u7684\u6d88\u8d39\u8005\u7684\u4e0b\u5355\u8f6c\u5316\u7387\uff0c\u63d0\u5347\u5e97\u94faGMV\u3002
                        <br /><br />
                        <strong>\u4ec0\u4e48\u662f\u60ca\u559c\u5238\uff1f</strong><br />
                        \u60ca\u559c\u5238\u662f\u9488\u5bf9\u8fd1\u671f\u52a0\u8d2d\u540e\u957f\u671f\u672a\u4e0b\u5355\u7684\u9ad8\u5174\u8da3\u6f5c\u5ba2\u4eba\u7fa4\u5b9a\u5411\u53d1\u653e\u7684\u4f18\u60e0\u5238\uff0c\u6709\u52a9\u9ad8\u6548\u8f6c\u5316\u3002\u53ea\u80fd\u4f5c\u7528\u4e8e\u5355\u4e2a\u5546\u54c1\uff0c\u53ef\u8bbe\u7f6e\u53d1\u884c\u5f20\u6570\u3002\u83b7\u5f97\u60ca\u559c\u5238\u7684\u6d88\u8d39\u8005\u53ef\u4ee5\u5728\u4e0b\u5355\u65f6\u4f7f\u7528\u3002
                        <br /><br />
                        <strong>\u60ca\u559c\u5238\u6709\u4ec0\u4e48\u5e2e\u52a9\uff1f</strong><br />
                        \u5bf9\u4e8e\u7206\u6b3e\u5546\u54c1\u53ef\u6781\u5927\u63d0\u5347\u5355\u54c1\u7684\u4e0b\u5355\u8f6c\u5316\u7387\u3002\u5bf9\u4e8e\u96f6\u9500\u91cf\u7684\u5546\u54c1\uff0c\u5e2e\u52a9\u5546\u54c1\u9500\u91cf\u7834\u96f6\u3002
                      </span>
                    </span>
                  </div>
                  <div class="ops-activity-filter-check-list ops-marketing-tools-batch-coupon-type-list">
                    ${SINGLE_PRODUCT_COUPON_BATCH_TYPE_OPTIONS.map((option) => {
      const optionValue = normalizeText(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;
      const checked = selectedTypes.includes(optionValue);

      return `
                  <label class="ops-activity-filter-check-item">
                    <input
                      type="checkbox"
                      data-single-product-coupon-batch-coupon-type="${escapeHtml(optionValue)}"
                      ${checked ? 'checked' : ''}
                    />
                    <span>${escapeHtml(optionLabel)}</span>
                  </label>
                `;
    }).join('')}
                  </div>
                </div>
                <label class="ops-marketing-tools-batch-coupon-field">
                  <span class="ops-activity-filter-field-label">\u5238\u540d\u79f0</span>
                  <input
                    class="ops-activity-filter-input"
                    type="text"
                    maxlength="60"
                    placeholder="\u8bf7\u8f93\u5165\u5238\u540d\u79f0"
                    data-single-product-coupon-field="batchCouponName"
                    value="${escapeHtmlAttribute(couponName)}"
                    ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
                  />
                </label>
                <label class="ops-marketing-tools-batch-coupon-field">
                  <span class="ops-activity-filter-field-label">\u53d1\u5238\u6570\u91cf</span>
                  <input
                    class="ops-activity-filter-input"
                    type="number"
                    min="200"
                    step="1"
                    placeholder="\u6700\u5c0f 200"
                    data-single-product-coupon-field="batchCouponQuantity"
                    value="${escapeHtmlAttribute(couponQuantity)}"
                    ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
                  />
                </label>
              </div>
              <div class="ops-marketing-tools-batch-coupon-field">
                <div class="ops-activity-filter-label-row">
                  <span class="ops-activity-filter-field-label">\u53d1\u5238\u65f6\u95f4</span>
                </div>
                <div class="ops-marketing-tools-batch-coupon-time-range">
                  <label class="ops-marketing-tools-batch-coupon-time-field">
                    <span class="ops-marketing-tools-batch-coupon-time-label">\u5f00\u59cb\u65f6\u95f4</span>
                    <input
                      class="ops-activity-filter-input"
                      type="datetime-local"
                      data-single-product-coupon-field="batchCouponStartTime"
                      value="${escapeHtmlAttribute(startTime)}"
                      ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
                    />
                  </label>
                  <label class="ops-marketing-tools-batch-coupon-time-field">
                    <span class="ops-marketing-tools-batch-coupon-time-label">\u7ed3\u675f\u65f6\u95f4</span>
                    <input
                      class="ops-activity-filter-input"
                      type="datetime-local"
                      data-single-product-coupon-field="batchCouponEndTime"
                      value="${escapeHtmlAttribute(endTime)}"
                      ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
                    />
                  </label>
                </div>
              </div>
              ${renderSingleProductCouponBatchCouponAmountSettingField(amountMode, {
      saving: marketingToolsState.singleProductCouponBatchCouponDialogSaving === true
    })}
              ${renderSingleProductCouponBatchCouponProfitFloorField({
      saving: marketingToolsState.singleProductCouponBatchCouponDialogSaving === true
    })}
            </section>
          </div>
          <div class="ops-activity-quick-cost-footer">
            ${marketingToolsState.singleProductCouponBatchCouponDialogError ? `<div class="ops-activity-quick-cost-message is-error">${escapeHtml(marketingToolsState.singleProductCouponBatchCouponDialogError)}</div>` : ''}
            ${marketingToolsState.singleProductCouponBatchCouponDialogWarning ? `<div class="ops-activity-quick-cost-message is-warning">${escapeHtml(marketingToolsState.singleProductCouponBatchCouponDialogWarning)}</div>` : ''}
            ${marketingToolsState.singleProductCouponBatchCouponDialogNotice ? `<div class="ops-activity-quick-cost-message is-success">${escapeHtml(marketingToolsState.singleProductCouponBatchCouponDialogNotice)}</div>` : ''}
            <div class="ops-activity-quick-cost-actions">
              <span class="ops-activity-quick-cost-message">
                \u5df2\u9009 ${escapeHtml(String(selectedTypes.length))} \u79cd\u7c7b\u578b
              </span>
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-single-product-coupon-batch-coupon-action="close"
                ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-single-product-coupon-batch-coupon-action="save"
                ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? 'disabled' : ''}
              >
                ${marketingToolsState.singleProductCouponBatchCouponDialogSaving === true ? '\u4fdd\u5b58\u4e2d...' : '\u786e\u5b9a'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSingleProductCouponResultEmptyState() {
    let titleText = '\u5c1a\u672a\u5f00\u59cb\u67e5\u8be2';
    let detailText = SINGLE_PRODUCT_COUPON_QUERY_RESULT_EMPTY_TEXT;

    if (marketingToolsState.singleProductCouponQueryRunning === true) {
      titleText = '\u6b63\u5728\u67e5\u8be2\u5546\u54c1\u5217\u8868...';
      detailText = normalizeText(marketingToolsState.singleProductCouponQueryProgressText) || '\u8bf7\u7a0d\u5019...';
    } else if (marketingToolsState.singleProductCouponQueryUpdatedAt) {
      titleText = '\u6682\u65e0\u53ef\u5c55\u793a\u5546\u54c1';
      detailText = '\u5f53\u524d\u6761\u4ef6\u4e0b\u6ca1\u6709\u627e\u5230\u53ef\u521b\u5efa\u4f18\u60e0\u5238\u7684\u5546\u54c1';
    }

    return `
      <div class="ops-marketing-tools-result-empty">
        <strong>${escapeHtml(titleText)}</strong>
        <span>${escapeHtml(detailText)}</span>
      </div>
    `;
  }

  function resolveSingleProductCouponResultRowHeight(row) {
    const skuInfoLines = Array.isArray(row && row.skuInfoLines) ? row.skuInfoLines : [];
    const hiddenSkuLineCount = Math.max(0, Number.parseInt(row && row.hiddenSkuLineCount, 10) || 0);
    const displayedSkuLineCount = skuInfoLines.length + (hiddenSkuLineCount > 0 ? 1 : 0);

    return displayedSkuLineCount <= 1
      ? MARKETING_TOOLS_RESULT_SINGLE_SKU_ROW_HEIGHT
      : MARKETING_TOOLS_RESULT_ROW_HEIGHT;
  }

  function resolveSingleProductCouponSkuChipTone(segment) {
    const normalizedSegment = normalizeText(segment);

    if (!normalizedSegment) {
      return '';
    }

    if (normalizedSegment.includes('\u65e5\u5e38\u7533\u62a5\u4ef7')) {
      return ' is-price';
    }

    if (normalizedSegment.includes('\u5e93\u5b58')) {
      return ' is-stock';
    }

    return '';
  }

  function renderSingleProductCouponSkuLineCard(line) {
    const segments = normalizeText(line)
      .split(/\s*\/\s*/)
      .map((segment) => normalizeText(segment))
      .filter(Boolean);

    if (segments.length <= 0) {
      return '';
    }

    const titleIndexes = [];

    segments.forEach((segment, index) => {
      if (
        titleIndexes.length < 2
        && (/^SKC\b/i.test(segment) || /^SKU\b/i.test(segment))
      ) {
        titleIndexes.push(index);
      }
    });

    const title = titleIndexes.length > 0
      ? titleIndexes.map((index) => segments[index]).join(' \u00b7 ')
      : (segments[0] || '--');
    const detailSegments = segments.filter((_segment, index) => {
      if (titleIndexes.length > 0) {
        return !titleIndexes.includes(index);
      }

      return index !== 0;
    });

    return `
      <div class="ops-marketing-tools-result-sku-card">
        <div class="ops-marketing-tools-result-sku-card-head">
          <strong class="ops-marketing-tools-result-sku-card-title">${escapeHtml(title)}</strong>
        </div>
        ${detailSegments.length > 0 ? `
          <div class="ops-marketing-tools-result-sku-chip-list">
            ${detailSegments.map((segment) => (
              `<span class="ops-marketing-tools-result-sku-chip${resolveSingleProductCouponSkuChipTone(segment)}">${escapeHtml(segment)}</span>`
            )).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderSingleProductCouponResultRow(row, rowIndex, costLookup) {
    const productName = normalizeText(row && row.productName) || '\u672a\u77e5\u5546\u54c1';
    const categoryText = normalizeText(row && row.categoryName) || '--';
    const siteText = normalizeText(row && row.siteText);
    const shopName = normalizeText(row && row.shopName) || normalizeText(row && row.shopId) || '--';
    const shopId = normalizeText(row && row.shopId) || '--';
    const imageUrl = normalizeText(row && row.materialImgUrl);
    const thumbUrl = buildSizedImageUrl(imageUrl, MARKETING_TOOLS_PRODUCT_THUMBNAIL_SIZE) || imageUrl;
    const skuInfoLines = Array.isArray(row && row.skuInfoLines) ? row.skuInfoLines : [];
    const hiddenSkuLineCount = Math.max(0, Number.parseInt(row && row.hiddenSkuLineCount, 10) || 0);
    const skcCount = Math.max(0, Number.parseInt(row && row.skcCount, 10) || 0);
    const skuCount = Math.max(0, Number.parseInt(row && row.skuCount, 10) || 0);
    const couponPreview = resolveSingleProductCouponPlannedCouponPreview(row, costLookup);
    const statusDisplay = buildSingleProductCouponResultStatusDisplay(row, couponPreview);
    const couponSummaryText = couponPreview && couponPreview.couponAmountText && couponPreview.dealPriceText
      ? `${couponPreview.couponAmountText}/${couponPreview.dealPriceText}`
      : (normalizeText(couponPreview && couponPreview.couponAmountText) || '-');
    const profitSummaryText = couponPreview && couponPreview.profitRateText && couponPreview.profitValueText
      ? `${couponPreview.profitRateText}/${couponPreview.profitValueText}`
      : (normalizeText(couponPreview && couponPreview.profitRateText) || '-');
    const rowHeight = resolveSingleProductCouponResultRowHeight(row);
    const rowClassName = rowHeight <= MARKETING_TOOLS_RESULT_SINGLE_SKU_ROW_HEIGHT
      ? ' ops-marketing-tools-results-row-single-sku'
      : '';

    return `
      <div class="ops-marketing-tools-results-grid ops-marketing-tools-results-row${rowClassName}" data-row-key="${escapeHtml(normalizeText(row && row.rowKey) || String(rowIndex))}" style="height:${rowHeight}px;">
        <div class="ops-marketing-tools-result-cell is-shop">
          <div class="ops-marketing-tools-result-primary-line">
            <strong class="ops-marketing-tools-result-title">${escapeHtml(shopName)}</strong>
            ${siteText ? `<span class="ops-marketing-tools-result-badge is-accent">${escapeHtml(siteText)}</span>` : ''}
          </div>
          <span class="ops-marketing-tools-result-subline">\u5e97\u94fa ID ${escapeHtml(shopId)}</span>
          <span class="ops-marketing-tools-result-subline">#${escapeHtml(String(rowIndex + 1))}</span>
        </div>
        <div class="ops-marketing-tools-result-cell is-product">
          <div class="ops-marketing-tools-result-product">
            ${thumbUrl
              ? `<img class="ops-marketing-tools-result-thumb" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(productName)}" loading="lazy" />`
              : '<div class="ops-marketing-tools-result-thumb is-empty">No Image</div>'}
            <div class="ops-marketing-tools-result-product-copy">
              <strong class="ops-marketing-tools-result-title" title="${escapeHtmlAttribute(productName)}">${escapeHtml(productName)}</strong>
              <span class="ops-marketing-tools-result-subline">SPU ${escapeHtml(normalizeText(row && row.productId) || '--')} \u00b7 Goods ${escapeHtml(normalizeText(row && row.goodsId) || '--')}</span>
              <span class="ops-marketing-tools-result-subline is-clamp" title="${escapeHtmlAttribute(categoryText)}">${escapeHtml(categoryText)}</span>
            </div>
          </div>
        </div>
        <div class="ops-marketing-tools-result-cell is-price">
          <div class="ops-marketing-tools-result-metric-list">
            <div class="ops-marketing-tools-result-metric-item is-primary">
              <span class="ops-marketing-tools-result-metric-label">\u5f53\u524d\u7533\u62a5\u4ef7</span>
              <strong class="ops-marketing-tools-result-metric-value">${escapeHtml(normalizeText(row && row.currentDailyPriceText) || '-')}</strong>
            </div>
            <div class="ops-marketing-tools-result-metric-item is-accent">
              <span class="ops-marketing-tools-result-metric-label">\u5efa\u8bae\u5238\u989d</span>
              <strong class="ops-marketing-tools-result-metric-value">${escapeHtml(normalizeText(row && row.suggestCouponAmountText) || '-')}</strong>
            </div>
            <div class="ops-marketing-tools-result-metric-item is-muted">
              <span class="ops-marketing-tools-result-metric-label">\u5238\u989d/\u5238\u540e\u4ef7</span>
              <strong class="ops-marketing-tools-result-metric-value">${escapeHtml(couponSummaryText)}</strong>
            </div>
            <div class="ops-marketing-tools-result-metric-item is-muted">
              <span class="ops-marketing-tools-result-metric-label">\u6210\u672c\u4ef7</span>
              <strong class="ops-marketing-tools-result-metric-value">${escapeHtml(normalizeText(couponPreview && couponPreview.costPriceText) || '-')}</strong>
            </div>
            <div class="ops-marketing-tools-result-metric-item is-muted">
              <span class="ops-marketing-tools-result-metric-label">\u5229\u6da6\u7387/\u5229\u6da6\u503c</span>
              <strong class="ops-marketing-tools-result-metric-value">${escapeHtml(profitSummaryText)}</strong>
            </div>
            <div class="ops-marketing-tools-result-metric-item is-muted">
              <span class="ops-marketing-tools-result-metric-label">\u53ef\u914d\u8303\u56f4</span>
              <strong class="ops-marketing-tools-result-metric-value">${escapeHtml(normalizeText(row && row.couponRangeText) || '-')}</strong>
            </div>
          </div>
        </div>
        <div class="ops-marketing-tools-result-cell is-sku">
          ${skuInfoLines.length > 0 ? `
            <div class="ops-marketing-tools-result-sku-list">
              ${skuInfoLines.map((line) => renderSingleProductCouponSkuLineCard(line)).join('')}
              ${hiddenSkuLineCount > 0 ? `
                <div class="ops-marketing-tools-result-sku-card is-more">
                  <div class="ops-marketing-tools-result-sku-card-head">
                    <strong class="ops-marketing-tools-result-sku-card-title">\u8fd8\u6709 ${escapeHtml(String(hiddenSkuLineCount))} \u6761\u672a\u5c55\u5f00</strong>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="ops-marketing-tools-result-sku-empty">
              <span class="ops-marketing-tools-result-subline">SKC ${escapeHtml(String(skcCount))} \u00b7 SKU ${escapeHtml(String(skuCount))}</span>
              <span class="ops-marketing-tools-result-subline">\u6682\u65e0\u53ef\u5c55\u793a\u7684 SKU \u660e\u7ec6</span>
            </div>
          `}
        </div>
        <div class="ops-marketing-tools-result-cell is-status">
          <div class="ops-marketing-tools-result-status-stack">
            <div class="ops-marketing-tools-result-badge-list">
              <span class="ops-marketing-tools-result-badge ${escapeHtml(normalizeText(statusDisplay && statusDisplay.tone) || '')}">
                ${escapeHtml(normalizeText(statusDisplay && statusDisplay.label) || '--')}
              </span>
            </div>
            <span class="ops-marketing-tools-result-subline is-clamp-3" title="${escapeHtmlAttribute(normalizeText(statusDisplay && statusDisplay.detailText) || '--')}">
              ${escapeHtml(normalizeText(statusDisplay && statusDisplay.detailText) || '--')}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function renderSingleProductCouponResultList() {
    if (!Array.isArray(marketingToolsState.singleProductCouponQueryRows) || marketingToolsState.singleProductCouponQueryRows.length <= 0) {
      return `
        <div class="ops-marketing-tools-results-table-shell">
          <div class="ops-marketing-tools-results-empty-shell">
            ${renderSingleProductCouponResultEmptyState()}
          </div>
        </div>
      `;
    }

    return `
      <div class="ops-marketing-tools-results-table-shell">
        <div class="ops-marketing-tools-results-viewport">
          <div class="ops-marketing-tools-results-table">
            <div class="ops-marketing-tools-results-grid ops-marketing-tools-results-grid-head">
              <div class="ops-marketing-tools-results-head-cell">\u5e97\u94fa / \u7ad9\u70b9</div>
              <div class="ops-marketing-tools-results-head-cell is-center">\u5546\u54c1\u4fe1\u606f</div>
              <div class="ops-marketing-tools-results-head-cell is-center">\u4f18\u60e0\u5efa\u8bae</div>
              <div class="ops-marketing-tools-results-head-cell">SKC / SKU \u4fe1\u606f</div>
              <div class="ops-marketing-tools-results-head-cell">\u72b6\u6001</div>
            </div>
            <div
              class="ops-marketing-tools-results-virtual-body"
              data-single-product-coupon-results-virtual-body
            >
              <div
                class="ops-marketing-tools-results-virtual-window"
                data-single-product-coupon-results-virtual-window
              ></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSingleProductCouponResultSection() {
    const progressText = normalizeText(marketingToolsState.singleProductCouponQueryProgressText);
    const warningText = normalizeText(marketingToolsState.singleProductCouponQueryWarning);
    const errorText = normalizeText(marketingToolsState.singleProductCouponQueryError);

    return `
      <div class="ops-marketing-tools-results-section">
        <div data-single-product-coupon-quick-actions-host>
          ${renderSingleProductCouponQuickCostEntryCard()}
        </div>
        <section class="ops-marketing-tools-results-card">
        <div class="ops-marketing-tools-results-head">
          <div class="ops-marketing-tools-results-head-copy">
            <strong class="ops-marketing-tools-results-head-title">\u5546\u54c1\u5217\u8868</strong>
            <span class="ops-marketing-tools-results-head-subtitle">\u53ea\u5c55\u793a\u521b\u5efa\u4f18\u60e0\u5238\u65f6\u53ef\u914d\u7684\u5546\u54c1</span>
          </div>
          ${renderSingleProductCouponResultSummaryChips()}
        </div>
        <div class="ops-marketing-tools-results-feedback">
          ${renderSingleProductCouponResultAlert(progressText, 'active')}
          ${renderSingleProductCouponResultAlert(warningText, 'warning')}
          ${renderSingleProductCouponResultAlert(errorText, 'error')}
          ${renderSingleProductCouponShopResultBadges()}
        </div>
        ${renderSingleProductCouponResultList()}
        </section>
        ${renderSingleProductCouponQuickCostDialog()}
        ${renderSingleProductCouponBatchCouponDialog()}
      </div>
    `;
  }

  function renderSingleProductCouponShopSelector() {
    const control = getShopMultiSelectControl();
    const selectedShopIds = normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);
    const fieldMarkup =
      control && typeof control.render === 'function'
        ? control.render({
          catalog: marketingToolsState.singleProductCouponShopCatalog,
          selectedShopIds,
          keyword: marketingToolsState.singleProductCouponShopSelectorKeyword,
          open: marketingToolsState.singleProductCouponShopSelectorOpen,
          compact: true,
          loading: marketingToolsState.singleProductCouponShopSelectorLoading,
          error: marketingToolsState.singleProductCouponShopSelectorError,
          shopSelectionPresets: buildShopSelectionPresetConfig(marketingToolsState.singleProductCouponShopSelectionPreset),
          disabled: marketingToolsState.singleProductCouponShopSelectorLoading !== true
            && marketingToolsState.singleProductCouponShopSelectorLoaded === true
            && Array.isArray(marketingToolsState.singleProductCouponShopCatalog.shops)
            && marketingToolsState.singleProductCouponShopCatalog.shops.length <= 0
        })
        : `
          <button class="shop-multi-select-trigger" type="button" disabled>
            <span class="shop-multi-select-trigger-copy">
              <span class="shop-multi-select-trigger-value">\u5e97\u94fa\u9009\u62e9\u5668\u672a\u52a0\u8f7d</span>
            </span>
          </button>
        `;

    return `
      <div class="ops-marketing-tools-signup-card">
        <div class="ops-marketing-tools-signup-card-main">
          <span class="ops-marketing-tools-query-field-label">\u5e97\u94fa</span>
          <div class="ops-marketing-tools-signup-card-body">
            ${fieldMarkup}
          </div>
        </div>
        ${marketingToolsState.singleProductCouponShopSelectorError ? `<div class="ops-marketing-tools-signup-error">${escapeHtml(marketingToolsState.singleProductCouponShopSelectorError)}</div>` : ''}
      </div>
    `;
  }

  function renderSingleProductCouponPanel() {
    const activeSubtabId = normalizeSingleProductCouponSubtabId(marketingToolsState.singleProductCouponActiveSubtabId);

    return `
      <div class="ops-marketing-tools-subtab-shell${activeSubtabId === 'create' ? ' is-create' : ''}">
        <div class="ops-marketing-tools-subtab-row" role="tablist" aria-label="\u5355\u54c1\u4f18\u60e0\u5238\u529f\u80fd\u5207\u6362">
          ${SINGLE_PRODUCT_COUPON_SUBTAB_CONFIG.map((tab) => `
            <button
              class="ops-marketing-tools-subtab${tab.id === activeSubtabId ? ' is-active' : ''}"
              type="button"
              data-single-product-coupon-subtab="${escapeHtml(tab.id)}"
              aria-selected="${tab.id === activeSubtabId ? 'true' : 'false'}"
            >
              ${escapeHtml(tab.label)}
            </button>
          `).join('')}
        </div>
        ${activeSubtabId === 'create' ? `
          <div class="ops-marketing-tools-combined-card">
            <div class="ops-marketing-tools-row">
              <div data-single-product-coupon-shop-selector-host>
                ${renderSingleProductCouponShopSelector()}
              </div>
              <div data-single-product-coupon-query-card-host>
                ${renderSingleProductCouponQueryCard()}
              </div>
            </div>
          </div>
          <div data-single-product-coupon-results-host>
            ${renderSingleProductCouponResultSection()}
          </div>
        ` : `
          <div class="ops-marketing-tools-placeholder">
            <p class="ops-marketing-tools-placeholder-title">\u7ba1\u7406\u4f18\u60e0\u5238</p>
            <p class="ops-marketing-tools-placeholder-text">\u5f53\u524d\u5148\u4f5c\u4e3a\u5360\u4f4d\u529f\u80fd\uff0c\u540e\u7eed\u53ef\u5728\u8fd9\u91cc\u63a5\u5165\u4f18\u60e0\u5238\u5217\u8868\u3001\u72b6\u6001\u7ba1\u7406\u548c\u505c\u542f\u64cd\u4f5c\u3002</p>
          </div>
        `}
      </div>
      `;
  }

  function getSingleProductCouponPanelElement() {
    const panel = document.querySelector('[data-marketing-tools-panel="single-product-coupon"]');
    return panel instanceof HTMLElement ? panel : null;
  }

  function applySingleProductCouponShopSelectorFocus(panel) {
    if (
      !(panel instanceof HTMLElement)
      || marketingToolsState.singleProductCouponShopSelectorOpen !== true
      || marketingToolsState.singleProductCouponShopSelectorFocusSearch !== true
    ) {
      return;
    }

    const searchInput = panel.querySelector('[data-shop-multi-select-search]');

    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus();

      try {
        const cursorPosition = searchInput.value.length;
        searchInput.setSelectionRange(cursorPosition, cursorPosition);
      } catch (_error) {
        // Ignore selection sync failures.
      }
    }

    marketingToolsState.singleProductCouponShopSelectorFocusSearch = false;
  }

  function applySingleProductCouponCategorySearchFocus(panel) {
    if (
      !(panel instanceof HTMLElement)
      || marketingToolsState.singleProductCouponCategorySelectorOpen !== true
      || marketingToolsState.singleProductCouponCategorySearchFocusInput !== true
    ) {
      return;
    }

    marketingToolsState.singleProductCouponCategorySearchFocusInput = false;
    window.requestAnimationFrame(() => {
      const searchInput = panel.querySelector('[data-category-cascade-search]');

      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  function syncSingleProductCouponQuickActionsArea(panel) {
    const resolvedPanel = panel instanceof HTMLElement ? panel : getSingleProductCouponPanelElement();

    if (!(resolvedPanel instanceof HTMLElement)) {
      return;
    }

    const quickActionsHost = resolvedPanel.querySelector('[data-single-product-coupon-quick-actions-host]');

    if (!(quickActionsHost instanceof HTMLElement)) {
      return;
    }

    quickActionsHost.innerHTML = renderSingleProductCouponQuickCostEntryCard();
  }

  function syncSingleProductCouponShopSelectorArea(options = {}) {
    const panel = getSingleProductCouponPanelElement();

    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const shopSelectorHost = panel.querySelector('[data-single-product-coupon-shop-selector-host]');

    if (!(shopSelectorHost instanceof HTMLElement)) {
      syncSingleProductCouponPanel();
      return;
    }

    const shopSelectorPanelScrollSnapshot = marketingToolsState.singleProductCouponShopSelectorOpen === true
      ? captureSingleProductCouponShopSelectorPanelScroll(panel)
      : null;

    shopSelectorHost.innerHTML = renderSingleProductCouponShopSelector();

    if (shopSelectorPanelScrollSnapshot) {
      window.requestAnimationFrame(() => {
        restoreSingleProductCouponShopSelectorPanelScroll(panel, shopSelectorPanelScrollSnapshot);
      });
    }

    applySingleProductCouponShopSelectorFocus(panel);

    if (options.includeQuickActions === true) {
      syncSingleProductCouponQuickActionsArea(panel);
    }
  }

  function syncSingleProductCouponResultsArea() {
    const panel = getSingleProductCouponPanelElement();

    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const resultsHost = panel.querySelector('[data-single-product-coupon-results-host]');

    if (!(resultsHost instanceof HTMLElement)) {
      syncSingleProductCouponPanel();
      return;
    }

    captureSingleProductCouponResultsViewportState(panel);
    resultsHost.innerHTML = renderSingleProductCouponResultSection();
    bindSingleProductCouponResultsViewport(panel);
    scheduleSingleProductCouponResultsViewportRestore(panel);
    scheduleSingleProductCouponResultsResponsiveState();
  }

  function syncSingleProductCouponPanel() {
    const panel = getSingleProductCouponPanelElement();

    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const shopSelectorPanelScrollSnapshot = marketingToolsState.singleProductCouponShopSelectorOpen === true
      ? captureSingleProductCouponShopSelectorPanelScroll(panel)
      : null;

    captureSingleProductCouponResultsViewportState(panel);
    panel.innerHTML = renderSingleProductCouponPanel();
    bindSingleProductCouponResultsViewport(panel);

    if (shopSelectorPanelScrollSnapshot) {
      window.requestAnimationFrame(() => {
        restoreSingleProductCouponShopSelectorPanelScroll(panel, shopSelectorPanelScrollSnapshot);
      });
    }

    applySingleProductCouponShopSelectorFocus(panel);
    applySingleProductCouponCategorySearchFocus(panel);
    scheduleSingleProductCouponResultsResponsiveState();
  }

  function syncMarketingToolsDynamicPanels() {
    syncSingleProductCouponPanel();
  }

  function getSingleProductCouponSubtabConfig(subtabId) {
    const normalizedSubtabId = normalizeText(subtabId);
    return SINGLE_PRODUCT_COUPON_SUBTAB_CONFIG.find((tab) => tab.id === normalizedSubtabId)
      || SINGLE_PRODUCT_COUPON_SUBTAB_CONFIG[0];
  }

  function normalizeSingleProductCouponSubtabId(subtabId) {
    const config = getSingleProductCouponSubtabConfig(subtabId);
    return config ? config.id : SINGLE_PRODUCT_COUPON_SUBTAB_CONFIG[0].id;
  }

  async function loadSingleProductCouponShopCatalog(options = {}) {
    const control = getShopMultiSelectControl();

    if (!control || typeof control.loadShopCatalog !== 'function') {
      marketingToolsState.singleProductCouponShopSelectorLoaded = true;
      marketingToolsState.singleProductCouponShopSelectorLoading = false;
      marketingToolsState.singleProductCouponShopSelectorError = '\u5e97\u94fa\u9009\u62e9\u5668\u672a\u52a0\u8f7d';
      syncSingleProductCouponShopSelectorArea({
        includeQuickActions: true
      });
      return Promise.resolve(marketingToolsState.singleProductCouponShopCatalog);
    }

    if (
      marketingToolsState.singleProductCouponShopSelectorLoading === true
      && marketingToolsState.singleProductCouponShopSelectorPromise
    ) {
      return marketingToolsState.singleProductCouponShopSelectorPromise;
    }

    if (options.force !== true && marketingToolsState.singleProductCouponShopSelectorLoaded === true) {
      return Promise.resolve(marketingToolsState.singleProductCouponShopCatalog);
    }

    marketingToolsState.singleProductCouponShopSelectorLoading = true;
    marketingToolsState.singleProductCouponShopSelectorError = '';
    syncSingleProductCouponShopSelectorArea({
      includeQuickActions: true
    });

    marketingToolsState.singleProductCouponShopSelectorPromise = control.loadShopCatalog()
      .then((catalog) => {
        const nextCatalog = catalog && typeof catalog === 'object'
          ? catalog
          : buildEmptyShopCatalog();
        const nextSelectedShopIds = normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds)
          .filter((shopId) => Boolean(nextCatalog.shopMap && nextCatalog.shopMap[shopId]));

        marketingToolsState.singleProductCouponShopCatalog = nextCatalog;
        marketingToolsState.singleProductCouponSelectedShopIds = nextSelectedShopIds;
        marketingToolsState.singleProductCouponShopSelectorLoaded = true;
        marketingToolsState.singleProductCouponShopSelectorError = '';
        syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        });
        return marketingToolsState.singleProductCouponShopCatalog;
      })
      .catch((error) => {
        marketingToolsState.singleProductCouponShopCatalog = buildEmptyShopCatalog();
        marketingToolsState.singleProductCouponSelectedShopIds = [];
        marketingToolsState.singleProductCouponShopSelectorLoaded = true;
        marketingToolsState.singleProductCouponShopSelectorError = normalizeText(error && error.message) || '\u5e97\u94fa\u5217\u8868\u52a0\u8f7d\u5931\u8d25';
        syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        });
        return marketingToolsState.singleProductCouponShopCatalog;
      })
      .finally(() => {
        marketingToolsState.singleProductCouponShopSelectorLoading = false;
        marketingToolsState.singleProductCouponShopSelectorPromise = null;
        syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        });
      });

    return marketingToolsState.singleProductCouponShopSelectorPromise;
  }

  async function loadSingleProductCouponShopSelectionPresetSnapshot(options = {}) {
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.loadSnapshot !== 'function') {
      return marketingToolsState.singleProductCouponShopSelectionPreset;
    }

    return helper.loadSnapshot(marketingToolsState.singleProductCouponShopSelectionPreset, {
      force: options.force === true,
      onChange: () => syncSingleProductCouponShopSelectorArea({
        includeQuickActions: true
      })
    });
  }

  async function saveSingleProductCouponShopSelectionLast(selectedShopIds) {
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.saveLastSelection !== 'function') {
      return null;
    }

    return helper.saveLastSelection(
      marketingToolsState.singleProductCouponShopSelectionPreset,
      selectedShopIds,
      {
        allowEmpty: true
      }
    );
  }

  async function saveSingleProductCouponShopSelectionTemplate() {
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.saveTemplate !== 'function') {
      return null;
    }

    return helper.saveTemplate(
      marketingToolsState.singleProductCouponShopSelectionPreset,
      marketingToolsState.singleProductCouponSelectedShopIds,
      {
        onChange: () => syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        })
      }
    );
  }

  async function deleteSingleProductCouponShopSelectionTemplate(templateId) {
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.deleteTemplate !== 'function') {
      return null;
    }

    return helper.deleteTemplate(
      marketingToolsState.singleProductCouponShopSelectionPreset,
      templateId,
      {
        onChange: () => syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        })
      }
    );
  }

  function applySingleProductCouponShopSelectionPreset(selectedShopIds) {
    const nextSelectedShopIds = normalizeSingleProductCouponPresetShopSelection(selectedShopIds);

    if (nextSelectedShopIds.length <= 0) {
      return;
    }

    marketingToolsState.singleProductCouponSelectedShopIds = nextSelectedShopIds;
    marketingToolsState.singleProductCouponShopSelectionTouched = true;
    void saveSingleProductCouponShopSelectionLast(nextSelectedShopIds);
    syncSingleProductCouponShopSelectorArea({
      includeQuickActions: true
    });
  }

  async function loadSingleProductCouponShopSelectionPreference(options = {}) {
    const helper = getShopSelectionTemplateHelper();

    if (
      marketingToolsState.singleProductCouponShopSelectionPreferenceLoading === true
      && marketingToolsState.singleProductCouponShopSelectionPreferencePromise
    ) {
      return marketingToolsState.singleProductCouponShopSelectionPreferencePromise;
    }

    if (options.force !== true && marketingToolsState.singleProductCouponShopSelectionPreferenceLoaded === true) {
      return normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);
    }

    if (!helper || typeof helper.getLastSelectionIds !== 'function') {
      marketingToolsState.singleProductCouponShopSelectionPreferenceLoaded = true;
      return normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);
    }

    marketingToolsState.singleProductCouponShopSelectionPreferenceLoading = true;
    marketingToolsState.singleProductCouponShopSelectionPreferencePromise = loadSingleProductCouponShopSelectionPresetSnapshot({
      force: options.force === true
    })
      .then(() => {
        if (marketingToolsState.singleProductCouponShopSelectionTouched === true && options.force !== true) {
          return normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);
        }

        const nextSelectedShopIds = normalizeSingleProductCouponPresetShopSelection(
          helper.getLastSelectionIds(marketingToolsState.singleProductCouponShopSelectionPreset)
        );

        marketingToolsState.singleProductCouponSelectedShopIds = nextSelectedShopIds;
        syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        });
        return nextSelectedShopIds;
      })
      .catch(() => normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds))
      .finally(() => {
        marketingToolsState.singleProductCouponShopSelectionPreferenceLoaded = true;
        marketingToolsState.singleProductCouponShopSelectionPreferenceLoading = false;
        marketingToolsState.singleProductCouponShopSelectionPreferencePromise = null;
      });

    return marketingToolsState.singleProductCouponShopSelectionPreferencePromise;
  }

  async function searchSingleProductCouponCategories(keyword, options = {}) {
    const featureCenterApi = getFeatureCenterApi();
    const rawKeyword = String(keyword == null ? '' : keyword);
    const trimmedKeyword = normalizeText(rawKeyword);

    marketingToolsState.singleProductCouponCategorySearchKeyword = rawKeyword;
    marketingToolsState.singleProductCouponCategorySearchError = '';
    marketingToolsState.singleProductCouponCategorySearchFocusInput = options.focusInput !== false;
    clearSingleProductCouponCategorySearchTimer();

    if (!trimmedKeyword) {
      marketingToolsState.singleProductCouponCategorySearchRequestId += 1;
      marketingToolsState.singleProductCouponCategorySearchResults = [];
      marketingToolsState.singleProductCouponCategorySearchTotal = 0;
      marketingToolsState.singleProductCouponCategorySearchLoading = false;
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (!featureCenterApi || typeof featureCenterApi.searchOperationsProductCategories !== 'function') {
      marketingToolsState.singleProductCouponCategorySearchRequestId += 1;
      marketingToolsState.singleProductCouponCategorySearchResults = [];
      marketingToolsState.singleProductCouponCategorySearchTotal = 0;
      marketingToolsState.singleProductCouponCategorySearchLoading = false;
      marketingToolsState.singleProductCouponCategorySearchError = '\u7c7b\u76ee\u641c\u7d22\u6682\u4e0d\u53ef\u7528';
      syncMarketingToolsDynamicPanels();
      return;
    }

    const requestId = marketingToolsState.singleProductCouponCategorySearchRequestId + 1;

    marketingToolsState.singleProductCouponCategorySearchRequestId = requestId;
    marketingToolsState.singleProductCouponCategorySearchLoading = true;
    syncMarketingToolsDynamicPanels();

    marketingToolsState.singleProductCouponCategorySearchTimer = window.setTimeout(async () => {
      try {
        const response = await featureCenterApi.searchOperationsProductCategories({
          keyword: trimmedKeyword,
          limit: 12
        });

        if (marketingToolsState.singleProductCouponCategorySearchRequestId !== requestId) {
          return;
        }

        marketingToolsState.singleProductCouponCategorySearchResults = normalizeCategorySearchResults(response && response.results);
        marketingToolsState.singleProductCouponCategorySearchTotal = Math.max(0, Number.parseInt(response && response.total, 10) || 0);
        marketingToolsState.singleProductCouponCategorySearchError = '';
      } catch (error) {
        if (marketingToolsState.singleProductCouponCategorySearchRequestId !== requestId) {
          return;
        }

        marketingToolsState.singleProductCouponCategorySearchResults = [];
        marketingToolsState.singleProductCouponCategorySearchTotal = 0;
        marketingToolsState.singleProductCouponCategorySearchError = normalizeText(error && error.message) || '\u7c7b\u76ee\u641c\u7d22\u5931\u8d25';
      } finally {
        if (marketingToolsState.singleProductCouponCategorySearchRequestId === requestId) {
          marketingToolsState.singleProductCouponCategorySearchLoading = false;
        }

        if (marketingToolsState.singleProductCouponCategorySearchTimer) {
          marketingToolsState.singleProductCouponCategorySearchTimer = 0;
        }

        syncMarketingToolsDynamicPanels();
      }
    }, 180);
  }

  async function loadSingleProductCouponCategorySnapshot(options = {}) {
    const featureCenterApi = getFeatureCenterApi();

    if (!featureCenterApi || typeof featureCenterApi.getOperationsProductCategorySnapshot !== 'function') {
      marketingToolsState.singleProductCouponCategoryRootLoaded = true;
      marketingToolsState.singleProductCouponCategoryRootError = '\u5546\u54c1\u7c7b\u76ee\u63a5\u53e3\u672a\u52a0\u8f7d';
      syncSingleProductCouponCategoryColumnsState();
      syncMarketingToolsDynamicPanels();
      return marketingToolsState.singleProductCouponCategorySnapshot;
    }

    if (
      marketingToolsState.singleProductCouponCategoryRootLoading === true
      && marketingToolsState.singleProductCouponCategoryRootPromise
    ) {
      return marketingToolsState.singleProductCouponCategoryRootPromise;
    }

    if (options.force !== true && marketingToolsState.singleProductCouponCategoryRootLoaded === true) {
      return marketingToolsState.singleProductCouponCategorySnapshot;
    }

    marketingToolsState.singleProductCouponCategoryRootLoading = true;
    marketingToolsState.singleProductCouponCategoryRootError = '';
    syncSingleProductCouponCategoryColumnsState();
    syncMarketingToolsDynamicPanels();

    marketingToolsState.singleProductCouponCategoryRootPromise = featureCenterApi.getOperationsProductCategorySnapshot()
      .then((snapshot) => {
        marketingToolsState.singleProductCouponCategorySnapshot = normalizeCategorySnapshot(snapshot);
        marketingToolsState.singleProductCouponCategoryRootLoaded = true;
        marketingToolsState.singleProductCouponCategoryRootError = '';
        syncSingleProductCouponCategoryColumnsState();
        return marketingToolsState.singleProductCouponCategorySnapshot;
      })
      .catch((error) => {
        marketingToolsState.singleProductCouponCategoryRootLoaded = true;
        marketingToolsState.singleProductCouponCategoryRootError = normalizeText(error && error.message) || '\u4e3b\u7c7b\u76ee\u52a0\u8f7d\u5931\u8d25';
        syncSingleProductCouponCategoryColumnsState();
        return marketingToolsState.singleProductCouponCategorySnapshot;
      })
      .finally(() => {
        marketingToolsState.singleProductCouponCategoryRootLoading = false;
        marketingToolsState.singleProductCouponCategoryRootPromise = null;
        syncSingleProductCouponCategoryColumnsState();
        syncMarketingToolsDynamicPanels();
      });

    return marketingToolsState.singleProductCouponCategoryRootPromise;
  }

  async function loadSingleProductCouponCategoryChildren(parentNode, options = {}) {
    const featureCenterApi = getFeatureCenterApi();
    const normalizedParentNode = normalizeCategoryPath([parentNode])[0];

    if (!normalizedParentNode || !normalizeText(normalizedParentNode.id)) {
      return [];
    }

    if (!featureCenterApi || typeof featureCenterApi.getOperationsProductChildCategories !== 'function') {
      marketingToolsState.singleProductCouponCategoryChildErrorKey = normalizeText(normalizedParentNode.id);
      marketingToolsState.singleProductCouponCategoryChildError = '\u5b50\u7c7b\u76ee\u63a5\u53e3\u672a\u52a0\u8f7d';
      syncSingleProductCouponCategoryColumnsState();
      syncMarketingToolsDynamicPanels();
      return [];
    }

    const cacheKey = getSingleProductCouponCategoryChildCacheKey(normalizedParentNode.id);

    if (
      options.force !== true
      && cacheKey
      && Array.isArray(marketingToolsState.singleProductCouponCategoryChildCache[cacheKey])
    ) {
      return marketingToolsState.singleProductCouponCategoryChildCache[cacheKey];
    }

    marketingToolsState.singleProductCouponCategoryChildLoadingKey = cacheKey;
    marketingToolsState.singleProductCouponCategoryChildErrorKey = '';
    marketingToolsState.singleProductCouponCategoryChildError = '';
    syncSingleProductCouponCategoryColumnsState();
    syncMarketingToolsDynamicPanels();

    try {
      const response = await featureCenterApi.getOperationsProductChildCategories({
        parentCatId: normalizedParentNode.id
      });
      const normalizedCategories = normalizeCategoryList(response && response.categories);

      marketingToolsState.singleProductCouponCategoryChildCache[cacheKey] = normalizedCategories;
      syncSingleProductCouponCategoryColumnsState();
      return normalizedCategories;
    } catch (error) {
      marketingToolsState.singleProductCouponCategoryChildErrorKey = cacheKey;
      marketingToolsState.singleProductCouponCategoryChildError = normalizeText(error && error.message) || '\u5b50\u7c7b\u76ee\u52a0\u8f7d\u5931\u8d25';
      syncSingleProductCouponCategoryColumnsState();
      return [];
    } finally {
      if (marketingToolsState.singleProductCouponCategoryChildLoadingKey === cacheKey) {
        marketingToolsState.singleProductCouponCategoryChildLoadingKey = '';
      }

      syncSingleProductCouponCategoryColumnsState();
      syncMarketingToolsDynamicPanels();
    }
  }

  async function ensureSingleProductCouponCategorySelectionHydrated() {
    const selectedPath = normalizeCategoryPath(marketingToolsState.singleProductCouponCategorySelectedPath).slice(0, MAX_CATEGORY_LEVEL);
    const snapshot = normalizeCategorySnapshot(marketingToolsState.singleProductCouponCategorySnapshot);

    if (selectedPath.length <= 0) {
      syncSingleProductCouponCategoryColumnsState();
      syncMarketingToolsDynamicPanels();
      return selectedPath;
    }

    const normalizedPath = [];
    const rootCategoryId = normalizeText(selectedPath[0] && selectedPath[0].id);
    const rootCategory = snapshot.categories.find((category) => category.id === rootCategoryId);

    if (!rootCategory) {
      setSingleProductCouponSelectedCategoryPath([]);
      syncMarketingToolsDynamicPanels();
      return [];
    }

    normalizedPath.push(rootCategory);

    for (let index = 0; index < selectedPath.length - 1; index += 1) {
      const parentNode = normalizedPath[index];

      if (!parentNode || parentNode.isLeaf === true) {
        break;
      }

      const cacheKey = getSingleProductCouponCategoryChildCacheKey(parentNode.id);
      let childCategories = cacheKey && Array.isArray(marketingToolsState.singleProductCouponCategoryChildCache[cacheKey])
        ? marketingToolsState.singleProductCouponCategoryChildCache[cacheKey]
        : null;

      if (!childCategories) {
        childCategories = await loadSingleProductCouponCategoryChildren(parentNode, {
          silent: true
        });
      }

      const nextCategoryId = normalizeText(selectedPath[index + 1] && selectedPath[index + 1].id);
      const matchedChild = (Array.isArray(childCategories) ? childCategories : [])
        .find((category) => category.id === nextCategoryId);

      if (!matchedChild) {
        break;
      }

      normalizedPath.push(matchedChild);
    }

    setSingleProductCouponSelectedCategoryPath(normalizedPath);
    syncMarketingToolsDynamicPanels();
    return normalizedPath;
  }

  async function applySingleProductCouponCategorySearchSelection(result) {
    const normalizedResults = normalizeCategorySearchResults([result]);
    const searchResult = normalizedResults[0];

    if (!searchResult || !Array.isArray(searchResult.path) || searchResult.path.length <= 0) {
      return;
    }

    if (marketingToolsState.singleProductCouponCategoryRootLoaded !== true) {
      await loadSingleProductCouponCategorySnapshot();
    }

    const pathKey = buildCategoryPathKey(searchResult.path);
    const alreadyChecked = normalizeCategoryCheckedPaths(marketingToolsState.singleProductCouponCategoryCheckedPaths)
      .some((item) => buildCategoryPathKey(item) === pathKey);

    setSingleProductCouponSelectedCategoryPath(searchResult.path);
    toggleSingleProductCouponCheckedCategoryPath(searchResult.path, alreadyChecked !== true);
    marketingToolsState.singleProductCouponCategoryChildErrorKey = '';
    marketingToolsState.singleProductCouponCategoryChildError = '';
    clearSingleProductCouponCategorySearchState({
      keepFocus: true
    });
    marketingToolsState.singleProductCouponCategorySelectorOpen = true;

    await ensureSingleProductCouponCategorySelectionHydrated();

    const lastCategory = searchResult.path[searchResult.path.length - 1] || null;

    if (lastCategory && lastCategory.isLeaf !== true && searchResult.path.length < MAX_CATEGORY_LEVEL) {
      await loadSingleProductCouponCategoryChildren(lastCategory, {
        silent: true
      });
    }

    syncMarketingToolsDynamicPanels();
  }

  function handleSingleProductCouponMarketingToolsClick(target) {
    const shopSelectorRoot = target.closest('[data-shop-multi-select]');
    const categorySelectorRoot = target.closest('[data-category-cascade]');
    const quickCostBackdrop = target.closest('[data-single-product-coupon-quick-cost-backdrop]');
    const quickCostPanel = target.closest('[data-single-product-coupon-quick-cost-panel]');
    const batchCouponBackdrop = target.closest('[data-single-product-coupon-batch-coupon-backdrop]');
    const batchCouponPanel = target.closest('[data-single-product-coupon-batch-coupon-panel]');

    if (marketingToolsState.singleProductCouponShopSelectorOpen === true && !shopSelectorRoot) {
      marketingToolsState.singleProductCouponShopSelectorOpen = false;
      marketingToolsState.singleProductCouponShopSelectorKeyword = '';
      marketingToolsState.singleProductCouponShopSelectorFocusSearch = false;
      syncSingleProductCouponShopSelectorArea({
        includeQuickActions: false
      });
    }

    if (marketingToolsState.singleProductCouponCategorySelectorOpen === true && !categorySelectorRoot) {
      marketingToolsState.singleProductCouponCategorySelectorOpen = false;
      clearSingleProductCouponCategorySearchState();
      syncMarketingToolsDynamicPanels();
    }

    const shopTemplateSave = target.closest('[data-shop-multi-select-template-save]');

    if (shopTemplateSave instanceof HTMLButtonElement) {
      if (!shopTemplateSave.disabled) {
        void saveSingleProductCouponShopSelectionTemplate();
      }
      return true;
    }

    if (
      quickCostBackdrop
      && !quickCostPanel
      && marketingToolsState.singleProductCouponQuickCostDialogSaving !== true
    ) {
      closeSingleProductCouponQuickCostDialog();
      return true;
    }

    const quickCostActionButton = target.closest('[data-single-product-coupon-quick-cost-action]');

    if (quickCostActionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(quickCostActionButton.getAttribute('data-single-product-coupon-quick-cost-action'));

      if (actionId === 'close') {
        closeSingleProductCouponQuickCostDialog();
        return true;
      }

      if (actionId === 'save') {
        void saveSingleProductCouponQuickCostDialog();
        return true;
      }
    }

    if (
      batchCouponBackdrop
      && !batchCouponPanel
      && marketingToolsState.singleProductCouponBatchCouponDialogSaving !== true
    ) {
      closeSingleProductCouponBatchCouponDialog();
      return true;
    }

    const batchCouponActionButton = target.closest('[data-single-product-coupon-batch-coupon-action]');

    if (batchCouponActionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(batchCouponActionButton.getAttribute('data-single-product-coupon-batch-coupon-action'));

      if (actionId === 'close') {
        closeSingleProductCouponBatchCouponDialog();
        return true;
      }

      if (actionId === 'save') {
        void saveSingleProductCouponBatchCouponDialog();
        return true;
      }
    }

    const shopTemplateApply = target.closest('[data-shop-multi-select-template-apply]');

    if (shopTemplateApply instanceof HTMLButtonElement) {
      const helper = getShopSelectionTemplateHelper();
      const templateId = normalizeText(shopTemplateApply.getAttribute('data-shop-multi-select-template-apply'));
      const selectedShopIds = helper && typeof helper.findTemplateSelection === 'function'
        ? helper.findTemplateSelection(marketingToolsState.singleProductCouponShopSelectionPreset, templateId)
        : [];

      applySingleProductCouponShopSelectionPreset(selectedShopIds);
      return true;
    }

    const shopTemplateDelete = target.closest('[data-shop-multi-select-template-delete]');

    if (shopTemplateDelete instanceof HTMLButtonElement) {
      if (!shopTemplateDelete.disabled) {
        void deleteSingleProductCouponShopSelectionTemplate(
          shopTemplateDelete.getAttribute('data-shop-multi-select-template-delete')
        );
      }
      return true;
    }

    const shopRestoreLast = target.closest('[data-shop-multi-select-restore-last]');

    if (shopRestoreLast instanceof HTMLButtonElement) {
      const helper = getShopSelectionTemplateHelper();
      const selectedShopIds = helper && typeof helper.getLastSelectionIds === 'function'
        ? helper.getLastSelectionIds(marketingToolsState.singleProductCouponShopSelectionPreset)
        : [];

      applySingleProductCouponShopSelectionPreset(selectedShopIds);
      return true;
    }

    const shopSelectorToggle = target.closest('[data-shop-multi-select-toggle]');

    if (shopSelectorToggle instanceof HTMLButtonElement) {
      if (!shopSelectorToggle.disabled) {
        marketingToolsState.singleProductCouponShopSelectorOpen = !marketingToolsState.singleProductCouponShopSelectorOpen;
        marketingToolsState.singleProductCouponShopSelectorFocusSearch = marketingToolsState.singleProductCouponShopSelectorOpen === true;

        if (marketingToolsState.singleProductCouponShopSelectorOpen !== true) {
          marketingToolsState.singleProductCouponShopSelectorKeyword = '';
        }

        syncSingleProductCouponShopSelectorArea({
          includeQuickActions: false
        });

        if (marketingToolsState.singleProductCouponShopSelectorLoaded !== true) {
          void loadSingleProductCouponShopCatalog();
        }
      }
      return true;
    }

    const shopSelectorAction = target.closest('[data-shop-multi-select-action]');

    if (shopSelectorAction instanceof HTMLButtonElement) {
      const actionId = normalizeText(shopSelectorAction.getAttribute('data-shop-multi-select-action'));
      const control = getShopMultiSelectControl();
      let nextSelectedShopIds = normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);

      if (control && typeof control.setAllVisibleSelection === 'function') {
        if (actionId === 'select-visible') {
          nextSelectedShopIds = control.setAllVisibleSelection(
            marketingToolsState.singleProductCouponShopCatalog,
            nextSelectedShopIds,
            marketingToolsState.singleProductCouponShopSelectorKeyword,
            true
          );
        } else if (actionId === 'clear') {
          nextSelectedShopIds = [];
        }
      } else if (actionId === 'clear') {
        nextSelectedShopIds = [];
      }

      marketingToolsState.singleProductCouponSelectedShopIds = nextSelectedShopIds;
      marketingToolsState.singleProductCouponShopSelectionTouched = true;
      void saveSingleProductCouponShopSelectionLast(nextSelectedShopIds);
      syncSingleProductCouponShopSelectorArea({
        includeQuickActions: true
      });
      return true;
    }

    const shopSelectorSectionAction = target.closest('[data-shop-multi-select-section]');

    if (shopSelectorSectionAction instanceof HTMLButtonElement) {
      const control = getShopMultiSelectControl();
      const sectionId = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section'));
      const sectionMode = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section-mode'));

      if (control && typeof control.setGroupSelection === 'function') {
        marketingToolsState.singleProductCouponSelectedShopIds = control.setGroupSelection(
          marketingToolsState.singleProductCouponShopCatalog,
          marketingToolsState.singleProductCouponSelectedShopIds,
          sectionId,
          marketingToolsState.singleProductCouponShopSelectorKeyword,
          sectionMode !== 'clear'
        );
        marketingToolsState.singleProductCouponShopSelectionTouched = true;
        void saveSingleProductCouponShopSelectionLast(marketingToolsState.singleProductCouponSelectedShopIds);
        syncSingleProductCouponShopSelectorArea({
          includeQuickActions: true
        });
      }

      return true;
    }

    const categoryToggle = target.closest('[data-category-cascade-toggle]');

    if (categoryToggle instanceof HTMLButtonElement) {
      if (!categoryToggle.disabled) {
        marketingToolsState.singleProductCouponCategorySelectorOpen = !marketingToolsState.singleProductCouponCategorySelectorOpen;

        if (marketingToolsState.singleProductCouponCategorySelectorOpen === true) {
          if (
            marketingToolsState.singleProductCouponCategorySelectedPath.length <= 0
            && marketingToolsState.singleProductCouponCategoryCheckedPaths.length > 0
          ) {
            setSingleProductCouponSelectedCategoryPath(marketingToolsState.singleProductCouponCategoryCheckedPaths[0]);
          }

          marketingToolsState.singleProductCouponCategorySearchFocusInput = true;
        } else {
          clearSingleProductCouponCategorySearchState();
        }

        syncSingleProductCouponCategoryColumnsState();
        syncMarketingToolsDynamicPanels();

        if (marketingToolsState.singleProductCouponCategorySelectorOpen === true) {
          if (marketingToolsState.singleProductCouponCategoryRootLoaded !== true) {
            void loadSingleProductCouponCategorySnapshot();
          } else if (marketingToolsState.singleProductCouponCategorySelectedPath.length > 0) {
            void ensureSingleProductCouponCategorySelectionHydrated();
          }
        }
      }

      return true;
    }

    const categoryActionButton = target.closest('[data-category-cascade-action]');

    if (categoryActionButton instanceof HTMLButtonElement) {
      const categoryActionId = normalizeText(categoryActionButton.getAttribute('data-category-cascade-action'));

      if (categoryActionId === 'clear') {
        setSingleProductCouponCheckedCategoryPaths([]);
        setSingleProductCouponSelectedCategoryPath([]);
        marketingToolsState.singleProductCouponCategoryChildErrorKey = '';
        marketingToolsState.singleProductCouponCategoryChildError = '';
        clearSingleProductCouponCategorySearchState({
          keepFocus: true
        });
        syncMarketingToolsDynamicPanels();
      }

      return true;
    }

    const categoryColumnActionButton = target.closest('[data-category-cascade-column-action]');

    if (categoryColumnActionButton instanceof HTMLButtonElement) {
      const columnActionId = normalizeText(categoryColumnActionButton.getAttribute('data-category-cascade-column-action'));
      const level = Number.parseInt(categoryColumnActionButton.getAttribute('data-category-cascade-level'), 10);
      const categoryColumn = Array.isArray(marketingToolsState.singleProductCouponCategoryColumns)
        ? marketingToolsState.singleProductCouponCategoryColumns.find((column) => Number.parseInt(column && column.level, 10) === level)
        : null;
      const columnPaths = buildSingleProductCouponCategoryColumnPaths(categoryColumn);

      if (!categoryColumn || columnPaths.length <= 0) {
        return true;
      }

      if (columnActionId === 'select-all') {
        updateSingleProductCouponCheckedCategoryPaths(columnPaths, true);
      } else if (columnActionId === 'clear') {
        updateSingleProductCouponCheckedCategoryPaths(columnPaths, false);
      } else {
        return true;
      }

      if (normalizeCategoryPath(categoryColumn && categoryColumn.pathPrefix).length > 0) {
        setSingleProductCouponSelectedCategoryPath(categoryColumn.pathPrefix);
      }

      marketingToolsState.singleProductCouponCategoryChildErrorKey = '';
      marketingToolsState.singleProductCouponCategoryChildError = '';
      marketingToolsState.singleProductCouponCategorySelectorOpen = true;
      marketingToolsState.singleProductCouponCategorySearchFocusInput = false;
      syncMarketingToolsDynamicPanels();
      return true;
    }

    const categoryItemButton = target.closest('[data-category-cascade-item]');

    if (categoryItemButton instanceof HTMLButtonElement) {
      const level = Number.parseInt(categoryItemButton.getAttribute('data-category-cascade-level'), 10);
      const categoryId = normalizeText(categoryItemButton.getAttribute('data-category-id'));
      const categoryColumn = Array.isArray(marketingToolsState.singleProductCouponCategoryColumns)
        ? marketingToolsState.singleProductCouponCategoryColumns.find((column) => Number.parseInt(column && column.level, 10) === level)
        : null;
      const categoryRecord = normalizeCategoryList(categoryColumn && categoryColumn.items)
        .find((category) => category.id === categoryId);

      if (!categoryRecord || !Number.isFinite(level) || level <= 0) {
        return true;
      }

      const nextSelectedPath = normalizeCategoryPath(marketingToolsState.singleProductCouponCategorySelectedPath).slice(0, Math.max(0, level - 1));

      nextSelectedPath[level - 1] = categoryRecord;
      setSingleProductCouponSelectedCategoryPath(nextSelectedPath);
      marketingToolsState.singleProductCouponCategoryChildErrorKey = '';
      marketingToolsState.singleProductCouponCategoryChildError = '';
      marketingToolsState.singleProductCouponCategorySelectorOpen = true;
      marketingToolsState.singleProductCouponCategorySearchFocusInput = false;
      syncMarketingToolsDynamicPanels();

      if (categoryRecord.isLeaf !== true && level < MAX_CATEGORY_LEVEL) {
        void loadSingleProductCouponCategoryChildren(categoryRecord, {
          silent: true
        });
      }

      return true;
    }

    const categorySearchResultButton = target.closest('[data-category-cascade-search-result]');

    if (categorySearchResultButton instanceof HTMLButtonElement) {
      const categoryId = normalizeText(categorySearchResultButton.getAttribute('data-category-id'));
      const searchResult = normalizeCategorySearchResults(marketingToolsState.singleProductCouponCategorySearchResults)
        .find((item) => item.id === categoryId);

      if (searchResult) {
        void applySingleProductCouponCategorySearchSelection(searchResult);
      }

      return true;
    }

    const singleProductCouponActionButton = target.closest('[data-single-product-coupon-action]');

    if (singleProductCouponActionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(singleProductCouponActionButton.getAttribute('data-single-product-coupon-action'));

      if (actionId === 'query' && !singleProductCouponActionButton.disabled) {
        void submitSingleProductCouponQuery();
        return true;
      }

      if (actionId === 'stop' && !singleProductCouponActionButton.disabled) {
        void stopSingleProductCouponQuery();
        return true;
      }

      if (actionId === 'quick-cost' && !singleProductCouponActionButton.disabled) {
        void openSingleProductCouponQuickCostDialog();
        return true;
      }

      if (actionId === 'batch-coupon' && !singleProductCouponActionButton.disabled) {
        openSingleProductCouponBatchCouponDialog();
        return true;
      }

      if (actionId === 'batch-create-coupon' && !singleProductCouponActionButton.disabled) {
        void submitSingleProductCouponBatchCreateCoupons();
        return true;
      }
    }

    return false;
  }

  function initializeMarketingToolsTab(tabId) {
    const normalizedTabId = normalizeMarketingToolsTabId(tabId);

    if (normalizedTabId !== 'single-product-coupon') {
      return;
    }

    void loadSingleProductCouponShopCatalog();
    void loadSingleProductCouponShopSelectionPreference();
    void loadSingleProductCouponBatchCouponSettings();
    syncSingleProductCouponCategoryColumnsState();
  }

  function initializeMarketingToolsEventSubscriptions() {
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.onMarketingToolsSingleProductCouponProgress !== 'function'
    ) {
      return;
    }

    featureCenterApi.onMarketingToolsSingleProductCouponProgress((payload) => {
      handleSingleProductCouponQueryProgress(payload);
    });
  }

  function getAvailableModuleIds() {
    if (standaloneModuleId) {
      return new Set([standaloneModuleId]);
    }

    return new Set(DEFAULT_MODULE_IDS);
  }

  function applyLayoutMode() {
    if (typeof document !== 'undefined') {
      document.title = standaloneConfig
        ? standaloneConfig.title
        : OPERATIONS_MODULE_WINDOW_TITLE;
    }

    if (!(document.body instanceof HTMLElement)) {
      return;
    }

    Object.values(STANDALONE_MODE_CONFIG).forEach((config) => {
      document.body.classList.toggle(config.bodyClass, standaloneConfig === config);
    });
    document.body.classList.toggle(
      'operations-default-layout',
      !standaloneConfig
    );

    Array.from(document.querySelectorAll('[data-operations-module]')).forEach((button) => {
      const moduleId = normalizeText(button.getAttribute('data-operations-module'));
      button.hidden = standaloneModuleId
        ? moduleId !== standaloneModuleId
        : false;
    });

    Array.from(document.querySelectorAll('[data-operations-panel]')).forEach((panel) => {
      const moduleId = normalizeText(panel.getAttribute('data-operations-panel'));

      if (standaloneModuleId) {
        panel.hidden = moduleId !== standaloneModuleId;
        return;
      }

      panel.hidden = moduleId !== DEFAULT_MODULE_ID;
    });
  }

  function normalizeModuleId(moduleId) {
    const normalizedModuleId = String(moduleId || '').trim();
    const availableModuleIds = getAvailableModuleIds();

    return availableModuleIds.has(normalizedModuleId)
      ? normalizedModuleId
      : (standaloneModuleId || DEFAULT_MODULE_ID);
  }

  function getLocationModuleId() {
    const hashValue = String(window.location && window.location.hash || '').replace(/^#/, '');

    return normalizeModuleId(hashValue);
  }

  function syncLocationHash(moduleId) {
    const normalizedModuleId = normalizeModuleId(moduleId);
    const nextHash = `#${normalizedModuleId}`;

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function getPanelByModuleId(moduleId) {
    const normalizedModuleId = normalizeModuleId(moduleId);
    return document.querySelector(`[data-operations-panel="${normalizedModuleId}"]`);
  }

  function createFallbackController(moduleId, panel) {
    return {
      id: moduleId,
      panel,
      activate() {},
      deactivate() {}
    };
  }

  function resolveModuleView(moduleId) {
    const normalizedModuleId = normalizeModuleId(moduleId);

    return null;
  }

  function ensureModuleController(moduleId) {
    const normalizedModuleId = normalizeModuleId(moduleId);

    if (moduleControllers.has(normalizedModuleId)) {
      return moduleControllers.get(normalizedModuleId);
    }

    const panel = getPanelByModuleId(normalizedModuleId);

    if (!(panel instanceof HTMLElement)) {
      return null;
    }

    const moduleView = resolveModuleView(normalizedModuleId);
    let controller = null;

    if (moduleView && typeof moduleView.mount === 'function') {
      controller = moduleView.mount(panel) || null;
    }

    if (!controller || typeof controller !== 'object') {
      controller = createFallbackController(normalizedModuleId, panel);
    }

    if (typeof controller.activate !== 'function') {
      controller.activate = function activate() {};
    }

    if (typeof controller.deactivate !== 'function') {
      controller.deactivate = function deactivate() {};
    }

    moduleControllers.set(normalizedModuleId, controller);
    return controller;
  }

  function getButtons() {
    return Array.from(document.querySelectorAll('[data-operations-module]'));
  }

  function getPanels() {
    return Array.from(document.querySelectorAll('[data-operations-panel]'));
  }

  function getMarketingToolsTabConfig(tabId) {
    const normalizedTabId = String(tabId || '').trim();
    return MARKETING_TOOLS_TAB_CONFIG.find((tab) => tab.id === normalizedTabId) || MARKETING_TOOLS_TAB_CONFIG[0];
  }

  function normalizeMarketingToolsTabId(tabId) {
    const tabConfig = getMarketingToolsTabConfig(tabId);
    return tabConfig ? tabConfig.id : 'single-product-coupon';
  }

  function syncMarketingToolsTitle() {
    const titleElement = document.querySelector('.ops-marketing-tools-title');

    if (!(titleElement instanceof HTMLElement)) {
      return;
    }

    const tabConfig = getMarketingToolsTabConfig(activeMarketingToolsTabId);
    titleElement.textContent = tabConfig ? tabConfig.label : '\u8425\u9500\u5de5\u5177';
  }

  function syncMarketingToolsTabState() {
    const normalizedActiveTabId = normalizeMarketingToolsTabId(activeMarketingToolsTabId);

    Array.from(document.querySelectorAll('[data-marketing-tools-tab]')).forEach((button) => {
      const isActive = button.getAttribute('data-marketing-tools-tab') === normalizedActiveTabId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Array.from(document.querySelectorAll('[data-marketing-tools-panel]')).forEach((panel) => {
      const isActive = panel.getAttribute('data-marketing-tools-panel') === normalizedActiveTabId;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });

    activeMarketingToolsTabId = normalizedActiveTabId;
    syncMarketingToolsTitle();
    syncMarketingToolsDynamicPanels();
    initializeMarketingToolsTab(normalizedActiveTabId);
  }

  function setActiveModule(moduleId, options = {}) {
    const normalizedModuleId = normalizeModuleId(moduleId);
    const previousModuleId = activeModuleId;
    const previousController = previousModuleId ? ensureModuleController(previousModuleId) : null;
    const nextController = ensureModuleController(normalizedModuleId);

    if (
      previousModuleId === normalizedModuleId
      && nextController
      && options.force !== true
    ) {
      if (options.syncHash !== false) {
        syncLocationHash(normalizedModuleId);
      }

      return;
    }

    getButtons().forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-operations-module') === normalizedModuleId);
    });

    getPanels().forEach((panel) => {
      panel.hidden = panel.getAttribute('data-operations-panel') !== normalizedModuleId;
    });

    if (
      previousController
      && previousModuleId
      && previousModuleId !== normalizedModuleId
    ) {
      previousController.deactivate({
        reason: 'switch',
        nextModuleId: normalizedModuleId
      });
    }

    if (nextController) {
      nextController.activate({
        previousModuleId
      });
    }

    activeModuleId = normalizedModuleId;

    if (options.syncHash !== false) {
      syncLocationHash(normalizedModuleId);
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('[data-operations-module]');

    if (!button) {
      const marketingToolsTabButton = target.closest('[data-marketing-tools-tab]');

      if (!marketingToolsTabButton) {
        const singleProductCouponSubtabButton = target.closest('[data-single-product-coupon-subtab]');

        if (singleProductCouponSubtabButton) {
          if (activeModuleId === 'marketing-tools' && activeMarketingToolsTabId === 'single-product-coupon') {
            marketingToolsState.singleProductCouponActiveSubtabId = normalizeSingleProductCouponSubtabId(
              singleProductCouponSubtabButton.getAttribute('data-single-product-coupon-subtab')
            );
            syncMarketingToolsDynamicPanels();
          }

          return;
        }

        if (
          activeModuleId === 'marketing-tools'
          && activeMarketingToolsTabId === 'single-product-coupon'
          && handleSingleProductCouponMarketingToolsClick(target)
        ) {
          return;
        }

        return;
      }

      activeMarketingToolsTabId = normalizeMarketingToolsTabId(
        marketingToolsTabButton.getAttribute('data-marketing-tools-tab')
      );
      syncMarketingToolsTabState();
      return;
    }

    setActiveModule(button.getAttribute('data-operations-module'));
  });

  document.addEventListener('input', (event) => {
    const target = event.target;

    if (
      !(target instanceof HTMLElement)
      || activeModuleId !== 'marketing-tools'
      || activeMarketingToolsTabId !== 'single-product-coupon'
    ) {
      return;
    }

    const shopTemplateName = normalizeText(target.getAttribute('data-shop-multi-select-template-name'));

    if (shopTemplateName && 'value' in target) {
      marketingToolsState.singleProductCouponShopSelectionPreset.templateName = target.value;
      return;
    }

    const searchFlag = normalizeText(target.getAttribute('data-shop-multi-select-search'));

    if (searchFlag && 'value' in target) {
      marketingToolsState.singleProductCouponShopSelectorKeyword = target.value;
      marketingToolsState.singleProductCouponShopSelectorOpen = true;
      marketingToolsState.singleProductCouponShopSelectorFocusSearch = true;
      syncSingleProductCouponShopSelectorArea({
        includeQuickActions: false
      });
      return;
    }

    if (normalizeText(target.getAttribute('data-category-cascade-search')) && 'value' in target) {
      void searchSingleProductCouponCategories(target.value);
      return;
    }

    const singleProductCouponField = normalizeText(target.getAttribute('data-single-product-coupon-field'));
    const quickCostInputKey = normalizeText(target.getAttribute('data-single-product-coupon-quick-cost-input'));

    if (quickCostInputKey) {
      marketingToolsState.singleProductCouponQuickCostDialogEntries = (
        Array.isArray(marketingToolsState.singleProductCouponQuickCostDialogEntries)
          ? marketingToolsState.singleProductCouponQuickCostDialogEntries
          : []
      ).map((entry) => {
        if (normalizeText(entry && entry.key) !== quickCostInputKey) {
          return entry;
        }

        return {
          ...entry,
          costPrice: normalizeSingleProductCouponQuickCostValue(target.value)
        };
      });
      return;
    }

    if (!singleProductCouponField || !('value' in target)) {
      return;
    }

    if (singleProductCouponField === 'productIdType') {
      marketingToolsState.singleProductCouponProductIdType = normalizeProductIdType(target.value);
      return;
    }

    if (singleProductCouponField === 'productIdKeywords') {
      marketingToolsState.singleProductCouponProductIdKeywords = String(target.value == null ? '' : target.value);
      return;
    }

    if (singleProductCouponField === 'batchCouponName') {
      marketingToolsState.singleProductCouponBatchCouponDialogName = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponQuantity') {
      marketingToolsState.singleProductCouponBatchCouponDialogQuantity = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponStartTime') {
      marketingToolsState.singleProductCouponBatchCouponDialogStartTime = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (singleProductCouponField === 'batchCouponEndTime') {
      marketingToolsState.singleProductCouponBatchCouponDialogEndTime = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (singleProductCouponField === 'batchCouponAmountMode') {
      selectSingleProductCouponBatchCouponAmountMode(target.value);
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (singleProductCouponField === 'batchCouponAmountFixedDiscount') {
      marketingToolsState.singleProductCouponBatchCouponDialogAmountFixedDiscount = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponProfitFloorLogic') {
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorLogic = normalizeSingleProductCouponBatchCouponProfitFloorLogic(target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponAmountCostProfitRate') {
      marketingToolsState.singleProductCouponBatchCouponDialogAmountCostProfitRate = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponAmountSaleProfitRate') {
      marketingToolsState.singleProductCouponBatchCouponDialogAmountSaleProfitRate = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponProfitFloorRate') {
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorRate = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'batchCouponProfitFloorValue') {
      marketingToolsState.singleProductCouponBatchCouponDialogProfitFloorValue = String(target.value == null ? '' : target.value);
      marketingToolsState.singleProductCouponBatchCouponDialogError = '';
      marketingToolsState.singleProductCouponBatchCouponDialogWarning = '';
      marketingToolsState.singleProductCouponBatchCouponDialogNotice = '';
      return;
    }

    if (singleProductCouponField === 'dailyPriceMin') {
      marketingToolsState.singleProductCouponDailyPriceMin = String(target.value == null ? '' : target.value);
      return;
    }

    if (singleProductCouponField === 'dailyPriceMax') {
      marketingToolsState.singleProductCouponDailyPriceMax = String(target.value == null ? '' : target.value);
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;

    if (
      !(target instanceof HTMLElement)
      || activeModuleId !== 'marketing-tools'
      || activeMarketingToolsTabId !== 'single-product-coupon'
    ) {
      return;
    }

    const selectedShopId = normalizeText(target.getAttribute('data-shop-multi-select-shop'));

    if (selectedShopId && target instanceof HTMLInputElement) {
      const control = getShopMultiSelectControl();
      const nextSelectedShopIds =
        control && typeof control.toggleShopSelection === 'function'
          ? control.toggleShopSelection(marketingToolsState.singleProductCouponSelectedShopIds, selectedShopId, target.checked)
          : normalizeSelectedShopIds(marketingToolsState.singleProductCouponSelectedShopIds);

      marketingToolsState.singleProductCouponSelectedShopIds = nextSelectedShopIds;
      marketingToolsState.singleProductCouponShopSelectionTouched = true;
      void saveSingleProductCouponShopSelectionLast(nextSelectedShopIds);
      syncSingleProductCouponShopSelectorArea({
        includeQuickActions: true
      });
      return;
    }

    const categoryCheckedId = normalizeText(target.getAttribute('data-category-cascade-check'));
    const batchCouponType = normalizeText(target.getAttribute('data-single-product-coupon-batch-coupon-type'));

    if (batchCouponType && target instanceof HTMLInputElement) {
      toggleSingleProductCouponBatchCouponType(batchCouponType, target.checked);
      syncMarketingToolsDynamicPanels();
      return;
    }

    if (categoryCheckedId && target instanceof HTMLInputElement) {
      const level = Number.parseInt(target.getAttribute('data-category-cascade-level'), 10);
      const categoryId = normalizeText(target.getAttribute('data-category-id'));
      const categoryColumn = Array.isArray(marketingToolsState.singleProductCouponCategoryColumns)
        ? marketingToolsState.singleProductCouponCategoryColumns.find((column) => Number.parseInt(column && column.level, 10) === level)
        : null;
      const categoryRecord = normalizeCategoryList(categoryColumn && categoryColumn.items)
        .find((category) => category.id === categoryId);
      const pathPrefix = normalizeCategoryPath(categoryColumn && categoryColumn.pathPrefix);
      const nextPath = categoryRecord ? pathPrefix.concat(categoryRecord) : [];

      if (nextPath.length <= 0) {
        return;
      }

      setSingleProductCouponSelectedCategoryPath(nextPath);
      toggleSingleProductCouponCheckedCategoryPath(nextPath, target.checked);
      marketingToolsState.singleProductCouponCategoryChildErrorKey = '';
      marketingToolsState.singleProductCouponCategoryChildError = '';
      marketingToolsState.singleProductCouponCategorySelectorOpen = true;
      marketingToolsState.singleProductCouponCategorySearchFocusInput = false;
      syncMarketingToolsDynamicPanels();

      if (categoryRecord && categoryRecord.isLeaf !== true && level < MAX_CATEGORY_LEVEL) {
        void loadSingleProductCouponCategoryChildren(categoryRecord, {
          silent: true
        });
      }
    }
  });

  window.addEventListener('hashchange', () => {
    setActiveModule(getLocationModuleId(), {
      syncHash: false
    });
  });

  window.addEventListener('resize', () => {
    scheduleSingleProductCouponResultsResponsiveState();
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyLayoutMode();
    initializeMarketingToolsEventSubscriptions();

    if (standaloneModuleId === 'marketing-tools' || getLocationModuleId() === 'marketing-tools') {
      syncMarketingToolsTabState();
    }

    setActiveModule(getLocationModuleId(), {
      syncHash: false
    });
  });
})();
