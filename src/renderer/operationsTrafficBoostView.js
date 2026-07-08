(function initOperationsTrafficBoostView() {
  const profitMetrics = window.operationsProfitMetrics && typeof window.operationsProfitMetrics === 'object'
    ? window.operationsProfitMetrics
    : null;
  const TAB_CONFIG = Object.freeze([
    {
      id: 'enable',
      label: '\u5f00\u542f\u6d41\u91cf\u52a0\u901f'
    },
    {
      id: 'management',
      label: '\u7ba1\u7406\u6d41\u91cf\u52a0\u901f'
    }
  ]);
  const DEFAULT_TAB_ID = TAB_CONFIG[0].id;
  const SHOP_SELECTION_SCOPE_KEY = 'operations-traffic-boost-enable';
  const MAX_CATEGORY_LEVEL = 4;
  const DEFAULT_STATION_IDS = Object.freeze(['100']);
  const PRODUCT_THUMBNAIL_SIZE = '120x';
  const MARKET_REGION_OPTIONS = Object.freeze([
    { value: 'global', label: '\u5168\u7403' },
    { value: 'us', label: '\u7f8e\u533a' },
    { value: 'eu', label: '\u6b27\u533a' }
  ]);
  const PRODUCT_ID_TYPE_OPTIONS = Object.freeze([
    { value: 'spu', label: 'SPU' },
    { value: 'skc', label: 'SKC' },
    { value: 'sku', label: 'SKU' }
  ]);
  const TRAFFIC_PRODUCT_METRIC_OPTIONS = Object.freeze([
    { value: 'exposure', label: '\u66dd\u5149\u91cf' },
    { value: 'click', label: '\u70b9\u51fb\u91cf' },
    { value: 'visitor', label: '\u5546\u54c1\u8bbf\u5ba2\u6570' }
  ]);
  const TRAFFIC_PAYMENT_METRIC_OPTIONS = Object.freeze([
    { value: 'paidPieces', label: '\u652f\u4ed8\u4ef6\u6570' },
    { value: 'paidOrders', label: '\u652f\u4ed8\u8ba2\u5355\u6570' }
  ]);
  const TRAFFIC_CONVERSION_METRIC_OPTIONS = Object.freeze([
    { value: 'exposureOrderRate', label: '\u66dd\u5149\u8ba2\u5355\u8f6c\u5316\u7387' },
    { value: 'clickRate', label: '\u70b9\u51fb\u7387' },
    { value: 'clickOrderRate', label: '\u70b9\u51fb\u8ba2\u5355\u8f6c\u5316\u7387' },
    { value: 'detailPaymentRate', label: '\u5546\u8be6\u652f\u4ed8\u8f6c\u5316\u7387' }
  ]);
  const DATE_PRESET_OPTIONS = Object.freeze([
    { value: '7', label: '\u8fd17\u5929' },
    { value: '14', label: '\u8fd114\u5929' },
    { value: '30', label: '\u8fd130\u5929' },
    { value: 'clear', label: '\u6e05\u7a7a' }
  ]);
  const TRAFFIC_BOOST_DURATION_OPTIONS = Object.freeze([
    { value: '7d', label: '\u6301\u7eed7\u5929' },
    { value: '14d', label: '\u6301\u7eed14\u5929' },
    { value: '30d', label: '\u6301\u7eed30\u5929' },
    { value: 'long_term', label: '\u957f\u671f\u6301\u7eed\u52a0\u901f' }
  ]);
  const TRAFFIC_BOOST_LEVEL_OPTIONS = Object.freeze([
    { value: 'normal', label: '\u666e\u901a\u6d41\u91cf\u52a0\u6743' },
    { value: 'advanced', label: '\u9ad8\u7ea7\u6d41\u91cf\u52a0\u6743' },
    { value: 'super', label: '\u8d85\u7ea7\u6d41\u91cf\u52a0\u6743' },
    { value: 'custom', label: '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743' }
  ]);
  const TRAFFIC_CUSTOM_FILTER_MODE_OPTIONS = Object.freeze([
    { value: 'dailyDiscount', label: '\u4ee5\u65e5\u5e38\u4ef7\u6298\u6263' },
    { value: 'dailyReduce', label: '\u4ee5\u65e5\u5e38\u4ef7\u51cf\u5c11' },
    { value: 'costMarkup', label: '\u4ee5\u6210\u672c\u4ef7\u52a0\u4ef7' },
    { value: 'profitRateDiscount', label: '\u4ee5\u6210\u672c\u5229\u6da6\u7387' },
    { value: 'saleProfitRate', label: '\u4ee5\u552e\u4ef7\u5229\u6da6\u7387' }
  ]);
  const TRAFFIC_CUSTOM_FILTER_RELATION_OPTIONS = Object.freeze([
    { value: 'and', label: '\u4e14' },
    { value: 'or', label: '\u6216' }
  ]);
  const TRAFFIC_CUSTOM_FILTER_SUBMIT_BASIS_OPTIONS = Object.freeze([
    { value: 'profitFloorRate', label: '\u4fdd\u5e95\u5229\u6da6\u7387' },
    { value: 'profitFloorValue', label: '\u4fdd\u5e95\u5229\u6da6\u503c' }
  ]);
  const MAX_QUERY_TRACE_ENTRY_COUNT = 8;
  const TRAFFIC_RESULT_ROW_HEIGHT = 248;
  const TRAFFIC_RESULT_SINGLE_SKU_ROW_HEIGHT = 160;
  const TRAFFIC_RESULT_HEAD_HEIGHT = 44;
  const TRAFFIC_RESULT_OVERSCAN = 6;
  const TRAFFIC_RESULT_COLLAPSE_WIDTH = 1080;
  const TRAFFIC_SUBMIT_BATCH_SIZE = 30;
  const TRAFFIC_SUBMIT_FAILURE_PREVIEW_LIMIT = 80;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeTextArray(input) {
    const source = Array.isArray(input)
      ? input
      : (input === null || input === undefined ? [] : [input]);

    return Array.from(new Set(
      source
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    ));
  }

  function normalizeNonNegativeInteger(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
  }

  function normalizeOptionalNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function normalizeBooleanSetting(value, fallback = false) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue) {
      return fallback;
    }

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return fallback;
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

  function formatDateTime(value) {
    const timestamp = parseTimestamp(value);

    if (!Number.isFinite(timestamp)) {
      return '\u2014';
    }

    const date = new Date(timestamp);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatInteger(value, fallback = '\u2014') {
    const parsedValue = normalizeOptionalNumber(value);
    return parsedValue === null ? fallback : String(Math.trunc(parsedValue));
  }

  function normalizeQuickCostValue(value) {
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

  function normalizeDecimalInputValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return '';
    }

    return String(Number(numericValue.toFixed(2)));
  }

  function formatPercent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '\u2014';
    }

    return `${numericValue.toFixed(2).replace(/\.00$/, '')}%`;
  }

  function normalizeQuickCostSpecSegmentText(segmentText) {
    return normalizeText(segmentText)
      .replace(/\s+/g, ' ')
      .replace(/[\uff1a\u0156\u0113\u951b\u6b56]/g, ':')
      .replace(/(\d+)\s*pcs?\b/gi, '$1pc')
      .replace(/\s*:\s*/g, ':');
  }

  function buildQuickCostSpecSegments(specText) {
    const catalog = getOperationsSharedCatalog();

    if (catalog && typeof catalog.buildNormalizedCostSpecSegments === 'function') {
      return catalog.buildNormalizedCostSpecSegments(specText);
    }

    return Array.from(new Set(
      normalizeText(specText)
        .split(/[|,\uff0c]/)
        .map((segment) => normalizeQuickCostSpecSegmentText(segment))
        .filter(Boolean)
    ));
  }

  function normalizeQuickCostSpecIdentity(specText) {
    const catalog = getOperationsSharedCatalog();

    if (catalog && typeof catalog.normalizeCostSpecText === 'function') {
      return catalog.normalizeCostSpecText(specText);
    }

    const segments = buildQuickCostSpecSegments(specText);
    return segments.length > 0
      ? segments.join('\uff0c')
      : normalizeText(specText);
  }

  function resolveQuickCostStationValue(source = {}) {
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

  function buildQuickCostLegacyKey(shopId, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildQuickCostEntryKey(shopId, station, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return normalizedStation
      ? `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedSpec}`.toLowerCase()
      : buildQuickCostLegacyKey(normalizedShopId, normalizedSpec);
  }

  function groupQuickCostDialogEntries(entries) {
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

  function truncateText(value, maxLength = 240) {
    const text = normalizeText(value);

    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
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

  function normalizeTabId(tabId) {
    const normalizedTabId = normalizeText(tabId);
    return TAB_CONFIG.some((tab) => tab.id === normalizedTabId)
      ? normalizedTabId
      : DEFAULT_TAB_ID;
  }

  function getTrafficTabConfig(tabId) {
    const normalizedTabId = normalizeTabId(tabId);
    return TAB_CONFIG.find((tab) => tab.id === normalizedTabId) || TAB_CONFIG[0] || null;
  }

  function normalizeProductIdType(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    return PRODUCT_ID_TYPE_OPTIONS.some((option) => option.value === normalizedValue)
      ? normalizedValue
      : PRODUCT_ID_TYPE_OPTIONS[0].value;
  }

  function normalizeTrafficBoostDuration(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    return TRAFFIC_BOOST_DURATION_OPTIONS.some((option) => option.value === normalizedValue)
      ? normalizedValue
      : TRAFFIC_BOOST_DURATION_OPTIONS[0].value;
  }

  function normalizeTrafficBoostLevel(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (normalizedValue === '1') {
      return 'normal';
    }

    if (normalizedValue === '2') {
      return 'advanced';
    }

    if (normalizedValue === '3') {
      return 'super';
    }

    if (normalizedValue === '4') {
      return 'custom';
    }

    return TRAFFIC_BOOST_LEVEL_OPTIONS.some((option) => option.value === normalizedValue)
      ? normalizedValue
      : TRAFFIC_BOOST_LEVEL_OPTIONS[0].value;
  }

  function shouldShowTrafficBoostAutoRenew(durationValue) {
    return ['7d', '14d', '30d'].includes(normalizeTrafficBoostDuration(durationValue));
  }

  function buildEmptyTrafficBoostCustomLevelModeValueCache() {
    return {
      dailyDiscount: '',
      saleProfitRate: '',
      profitRateDiscount: '',
      dailyReduce: '',
      costMarkup: ''
    };
  }

  function normalizeTrafficBoostCustomLevelModeValueCache(cache) {
    const source = cache && typeof cache === 'object' && !Array.isArray(cache)
      ? cache
      : {};
    const normalizedCache = buildEmptyTrafficBoostCustomLevelModeValueCache();

    Object.keys(normalizedCache).forEach((modeKey) => {
      normalizedCache[modeKey] = normalizeDecimalInputValue(source[modeKey]);
    });

    return normalizedCache;
  }

  function buildEmptyTrafficBoostCustomLevelFilterSettings() {
    return {
      version: 1,
      updatedAt: '',
      mode: 'dailyDiscount',
      modeValueByMode: buildEmptyTrafficBoostCustomLevelModeValueCache(),
      modeValueDailyDiscount: '',
      modeValueSaleProfitRate: '',
      modeValueProfitRateDiscount: '',
      modeValueDailyReduce: '',
      modeValueCostMarkup: '',
      modeValue: '',
      clampToSuggestPrice: false,
      profitFloorRate: '',
      profitFloorRelation: 'and',
      profitFloorValue: '',
      submitAtProfitFloor: false,
      submitAtProfitFloorBasis: 'profitFloorRate'
    };
  }

  function normalizeTrafficBoostCustomLevelFilterMode(value) {
    const normalizedValue = normalizeText(value);
    return TRAFFIC_CUSTOM_FILTER_MODE_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : 'dailyDiscount';
  }

  function normalizeTrafficBoostCustomLevelFilterRelation(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return TRAFFIC_CUSTOM_FILTER_RELATION_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : 'and';
  }

  function normalizeTrafficBoostCustomLevelSubmitBasis(value) {
    const normalizedValue = normalizeText(value);
    return TRAFFIC_CUSTOM_FILTER_SUBMIT_BASIS_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : 'profitFloorRate';
  }

  function formatTrafficBoostCustomLevelSubmitBasisLabel(value) {
    const normalizedValue = normalizeTrafficBoostCustomLevelSubmitBasis(value);
    const matchedOption = TRAFFIC_CUSTOM_FILTER_SUBMIT_BASIS_OPTIONS.find((option) => (
      normalizeText(option && option.value) === normalizedValue
    ));

    return normalizeText(matchedOption && matchedOption.label) || '\u4fdd\u5e95\u5229\u6da6\u7387';
  }

  function resolveTrafficBoostCustomLevelFilterModeValue(settings, mode) {
    const normalizedSettings = settings && typeof settings === 'object'
      ? settings
      : buildEmptyTrafficBoostCustomLevelFilterSettings();
    const normalizedMode = normalizeTrafficBoostCustomLevelFilterMode(mode || normalizedSettings.mode);
    const modeValueByMode = normalizeTrafficBoostCustomLevelModeValueCache(
      normalizedSettings.modeValueByMode
    );

    if (normalizedMode === 'dailyDiscount') {
      return normalizeDecimalInputValue(modeValueByMode.dailyDiscount || normalizedSettings.modeValueDailyDiscount);
    }

    if (normalizedMode === 'saleProfitRate') {
      return normalizeDecimalInputValue(modeValueByMode.saleProfitRate || normalizedSettings.modeValueSaleProfitRate);
    }

    if (normalizedMode === 'profitRateDiscount') {
      return normalizeDecimalInputValue(modeValueByMode.profitRateDiscount || normalizedSettings.modeValueProfitRateDiscount);
    }

    if (normalizedMode === 'dailyReduce') {
      return normalizeDecimalInputValue(modeValueByMode.dailyReduce || normalizedSettings.modeValueDailyReduce);
    }

    if (normalizedMode === 'costMarkup') {
      return normalizeDecimalInputValue(modeValueByMode.costMarkup || normalizedSettings.modeValueCostMarkup);
    }

    return '';
  }

  function normalizeTrafficBoostCustomLevelFilterSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const mode = normalizeTrafficBoostCustomLevelFilterMode(source.mode);
    const sourceModeValueByMode = normalizeTrafficBoostCustomLevelModeValueCache(source.modeValueByMode);
    let modeValueDailyDiscount = normalizeDecimalInputValue(source.modeValueDailyDiscount || sourceModeValueByMode.dailyDiscount);
    let modeValueSaleProfitRate = normalizeDecimalInputValue(source.modeValueSaleProfitRate || sourceModeValueByMode.saleProfitRate);
    let modeValueProfitRateDiscount = normalizeDecimalInputValue(source.modeValueProfitRateDiscount || sourceModeValueByMode.profitRateDiscount);
    let modeValueDailyReduce = normalizeDecimalInputValue(source.modeValueDailyReduce || sourceModeValueByMode.dailyReduce);
    let modeValueCostMarkup = normalizeDecimalInputValue(source.modeValueCostMarkup || sourceModeValueByMode.costMarkup);
    const legacyModeValue = normalizeDecimalInputValue(source.modeValue);

    if (!modeValueDailyDiscount && mode === 'dailyDiscount' && legacyModeValue) {
      modeValueDailyDiscount = legacyModeValue;
    }

    if (!modeValueSaleProfitRate && mode === 'saleProfitRate' && legacyModeValue) {
      modeValueSaleProfitRate = legacyModeValue;
    }

    if (!modeValueProfitRateDiscount && mode === 'profitRateDiscount' && legacyModeValue) {
      modeValueProfitRateDiscount = legacyModeValue;
    }

    if (!modeValueDailyReduce && mode === 'dailyReduce' && legacyModeValue) {
      modeValueDailyReduce = legacyModeValue;
    }

    if (!modeValueCostMarkup && mode === 'costMarkup' && legacyModeValue) {
      modeValueCostMarkup = legacyModeValue;
    }

    const normalizedSettings = {
      version: 1,
      updatedAt: normalizeText(source.updatedAt),
      mode,
      modeValueByMode: {
        dailyDiscount: modeValueDailyDiscount,
        saleProfitRate: modeValueSaleProfitRate,
        profitRateDiscount: modeValueProfitRateDiscount,
        dailyReduce: modeValueDailyReduce,
        costMarkup: modeValueCostMarkup
      },
      modeValueDailyDiscount,
      modeValueSaleProfitRate,
      modeValueProfitRateDiscount,
      modeValueDailyReduce,
      modeValueCostMarkup,
      clampToSuggestPrice: normalizeBooleanSetting(source.clampToSuggestPrice, false),
      profitFloorRate: normalizeDecimalInputValue(source.profitFloorRate),
      profitFloorRelation: normalizeTrafficBoostCustomLevelFilterRelation(source.profitFloorRelation),
      profitFloorValue: normalizeDecimalInputValue(source.profitFloorValue),
      submitAtProfitFloor: normalizeBooleanSetting(source.submitAtProfitFloor, false),
      submitAtProfitFloorBasis: normalizeTrafficBoostCustomLevelSubmitBasis(source.submitAtProfitFloorBasis)
    };

    normalizedSettings.modeValue = resolveTrafficBoostCustomLevelFilterModeValue(normalizedSettings, mode);
    return normalizedSettings;
  }

  function areTrafficBoostCustomLevelFilterSettingsEqual(left, right) {
    const normalizedLeft = normalizeTrafficBoostCustomLevelFilterSettings(left);
    const normalizedRight = normalizeTrafficBoostCustomLevelFilterSettings(right);
    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
  }

  function syncTrafficBoostCustomLevelFilterSettingsState(state, settings, options = {}) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);

    state.customLevelFilterSettings = normalizeTrafficBoostCustomLevelFilterSettings(normalizedSettings);

    if (options.markLoaded !== false) {
      state.customLevelFilterSettingsLoaded = true;
    }

    if (options.markApplied === true) {
      state.customLevelFilterAppliedSettings = normalizeTrafficBoostCustomLevelFilterSettings(normalizedSettings);
      state.customLevelFilterSettingsDirty = false;
      return normalizedSettings;
    }

    state.customLevelFilterSettingsDirty = !areTrafficBoostCustomLevelFilterSettingsEqual(
      state.customLevelFilterAppliedSettings,
      normalizedSettings
    );
    return normalizedSettings;
  }

  function formatTrafficBoostCustomLevelAmount(value) {
    const numericValue = normalizeOptionalNumber(value);

    if (numericValue === null) {
      return '\u2014';
    }

    return numericValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  function formatTrafficBoostCentsPrice(value, options = {}) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return normalizeText(options.fallback) || '\u2014';
    }

    const amount = numericValue / 100;
    return amount.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  function formatTrafficBoostPriceLabel(label, value, suffix = '\u5143') {
    const priceText = formatTrafficBoostCentsPrice(value);
    return priceText === '\u2014'
      ? `${label} ${priceText}`
      : `${label} ${priceText}${suffix}`;
  }

  function normalizeTrafficBoostYuanToCent(value) {
    const numericValue = normalizeOptionalNumber(value);

    if (numericValue === null || numericValue <= 0) {
      return null;
    }

    return Math.max(1, Math.round(numericValue * 100));
  }

  function formatTrafficBoostCentAmount(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return '\u2014';
    }

    return (numericValue / 100).toFixed(2).replace(/\.00$/, '').replace(/0$/, '');
  }

  function formatTrafficBoostLevelLabel(level) {
    const normalizedLevel = normalizeTrafficBoostLevel(level);
    const matchedOption = TRAFFIC_BOOST_LEVEL_OPTIONS.find((option) => (
      normalizeText(option && option.value) === normalizedLevel
    ));

    return normalizeText(matchedOption && matchedOption.label) || '\u666e\u901a\u6d41\u91cf\u52a0\u6743';
  }

  function mapTrafficBoostLevelToSubmitLevel(level) {
    const normalizedLevel = normalizeTrafficBoostLevel(level);

    if (normalizedLevel === 'advanced') {
      return 2;
    }

    if (normalizedLevel === 'super') {
      return 3;
    }

    if (normalizedLevel === 'custom') {
      return 4;
    }

    return 1;
  }

  function mapTrafficBoostDurationToSubmitDays(duration) {
    const normalizedDuration = normalizeTrafficBoostDuration(duration);

    if (normalizedDuration === '14d') {
      return 14;
    }

    if (normalizedDuration === '30d') {
      return 30;
    }

    if (normalizedDuration === 'long_term') {
      return -1;
    }

    return 7;
  }

  function computeTrafficBoostProfitRate(priceAmount, costAmount) {
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

  function computeTrafficBoostProfitValue(priceAmount, costAmount) {
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

  function computeTrafficBoostRequiredPriceForProfitRate(costAmount, profitFloorRate) {
    const normalizedCostAmount = Number(costAmount);
    const normalizedProfitFloorRate = normalizeOptionalNumber(profitFloorRate);

    if (
      !Number.isFinite(normalizedCostAmount)
      || normalizedCostAmount <= 0
      || normalizedProfitFloorRate === null
      || normalizedProfitFloorRate <= 0
    ) {
      return null;
    }

    const profitFloorBasis = Math.round(normalizedProfitFloorRate * 100);
    const denominatorBasis = 10000 - profitFloorBasis;

    if (denominatorBasis <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(1, Math.ceil((normalizedCostAmount * 10000) / denominatorBasis));
  }

  function resolveTrafficBoostProfitFloorState(settings, costAmount) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const profitFloorRate = normalizeOptionalNumber(normalizedSettings.profitFloorRate);
    const profitFloorValueAmount = normalizeTrafficBoostYuanToCent(normalizedSettings.profitFloorValue);
    const relation = normalizeTrafficBoostCustomLevelFilterRelation(normalizedSettings.profitFloorRelation);
    const hasProfitFloorRate = profitFloorRate !== null && profitFloorRate > 0;
    const hasProfitFloorValue = profitFloorValueAmount !== null && profitFloorValueAmount > 0;
    const requiredPriceForRate = hasProfitFloorRate
      ? computeTrafficBoostRequiredPriceForProfitRate(costAmount, profitFloorRate)
      : null;
    const requiredPriceForValue = hasProfitFloorValue && Number.isFinite(Number(costAmount))
      ? Math.max(1, Math.round(Number(costAmount) + profitFloorValueAmount))
      : null;
    const requiredPriceCandidates = [requiredPriceForRate, requiredPriceForValue]
      .filter((value) => value !== null);
    let minimumRequiredPrice = null;
    let submitFloorBasisActive = '';
    let submitFloorRequiredPrice = null;

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

    const requestedSubmitFloorBasis = normalizeTrafficBoostCustomLevelSubmitBasis(normalizedSettings.submitAtProfitFloorBasis);

    if (requestedSubmitFloorBasis === 'profitFloorRate' && hasProfitFloorRate) {
      submitFloorBasisActive = 'profitFloorRate';
      submitFloorRequiredPrice = requiredPriceForRate;
    } else if (requestedSubmitFloorBasis === 'profitFloorValue' && hasProfitFloorValue) {
      submitFloorBasisActive = 'profitFloorValue';
      submitFloorRequiredPrice = requiredPriceForValue;
    } else if (hasProfitFloorRate) {
      submitFloorBasisActive = 'profitFloorRate';
      submitFloorRequiredPrice = requiredPriceForRate;
    } else if (hasProfitFloorValue) {
      submitFloorBasisActive = 'profitFloorValue';
      submitFloorRequiredPrice = requiredPriceForValue;
    }

    return {
      profitFloorRate,
      profitFloorValueAmount,
      relation,
      submitAtProfitFloor: normalizedSettings.submitAtProfitFloor === true,
      submitAtProfitFloorBasis: requestedSubmitFloorBasis,
      hasProfitFloorRate,
      hasProfitFloorValue,
      requiredPriceForRate,
      requiredPriceForValue,
      minimumRequiredPrice,
      submitFloorBasisActive,
      submitFloorRequiredPrice
    };
  }

  function evaluateTrafficBoostProfitFloor(priceAmount, costAmount, settings) {
    const floorState = resolveTrafficBoostProfitFloorState(settings, costAmount);
    const profitRate = computeTrafficBoostProfitRate(priceAmount, costAmount);
    const profitValue = computeTrafficBoostProfitValue(priceAmount, costAmount);
    const meetsProfitFloorRate = !floorState.hasProfitFloorRate
      || (Number.isFinite(profitRate) && profitRate + 0.0001 >= floorState.profitFloorRate);
    const meetsProfitFloorValue = !floorState.hasProfitFloorValue
      || (Number.isFinite(profitValue) && profitValue + 0.0001 >= floorState.profitFloorValueAmount);
    let meetsFloor = true;
    let meetsSubmitFloorBasis = true;

    if (floorState.hasProfitFloorRate && floorState.hasProfitFloorValue) {
      meetsFloor = floorState.relation === 'or'
        ? (meetsProfitFloorRate || meetsProfitFloorValue)
        : (meetsProfitFloorRate && meetsProfitFloorValue);
    } else if (floorState.hasProfitFloorRate) {
      meetsFloor = meetsProfitFloorRate;
    } else if (floorState.hasProfitFloorValue) {
      meetsFloor = meetsProfitFloorValue;
    }

    if (floorState.submitFloorBasisActive === 'profitFloorRate') {
      meetsSubmitFloorBasis = meetsProfitFloorRate;
    } else if (floorState.submitFloorBasisActive === 'profitFloorValue') {
      meetsSubmitFloorBasis = meetsProfitFloorValue;
    } else {
      meetsSubmitFloorBasis = meetsFloor;
    }

    return {
      ...floorState,
      profitRate,
      profitValue,
      meetsProfitFloorRate,
      meetsProfitFloorValue,
      meetsFloor,
      meetsSubmitFloorBasis
    };
  }

  function buildTrafficBoostProfitFloorFailReason(floorEvaluation) {
    const rateReason = floorEvaluation && floorEvaluation.hasProfitFloorRate
      ? `\u5229\u6da6\u7387\u4f4e\u4e8e\u4fdd\u5e95 ${formatPercent(floorEvaluation.profitFloorRate)}`
      : '';
    const valueReason = floorEvaluation && floorEvaluation.hasProfitFloorValue
      ? `\u5229\u6da6\u503c\u4f4e\u4e8e\u4fdd\u5e95 ${formatTrafficBoostCentAmount(floorEvaluation.profitFloorValueAmount)}\u5143`
      : '';

    if (!floorEvaluation || (!rateReason && !valueReason)) {
      return '\u672a\u6ee1\u8db3\u4fdd\u5e95\u6761\u4ef6';
    }

    if (floorEvaluation.hasProfitFloorRate && floorEvaluation.hasProfitFloorValue) {
      if (floorEvaluation.relation === 'or') {
        return `\u5229\u6da6\u7387\u672a\u8fbe\u5230 ${formatPercent(floorEvaluation.profitFloorRate)}\uff0c\u4e14\u5229\u6da6\u503c\u672a\u8fbe\u5230 ${formatTrafficBoostCentAmount(floorEvaluation.profitFloorValueAmount)}\u5143`;
      }

      const failedReasons = [];

      if (floorEvaluation.meetsProfitFloorRate !== true && rateReason) {
        failedReasons.push(rateReason);
      }

      if (floorEvaluation.meetsProfitFloorValue !== true && valueReason) {
        failedReasons.push(valueReason);
      }

      return failedReasons.join('\uff0c') || '\u672a\u6ee1\u8db3\u4fdd\u5e95\u6761\u4ef6';
    }

    return rateReason || valueReason || '\u672a\u6ee1\u8db3\u4fdd\u5e95\u6761\u4ef6';
  }

  function formatTrafficBoostCustomLevelProfitFloorRule(settings, options = {}) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const profitFloorRate = normalizeOptionalNumber(normalizedSettings.profitFloorRate);
    const profitFloorValue = normalizeOptionalNumber(normalizedSettings.profitFloorValue);
    const hasProfitFloorRate = profitFloorRate !== null && profitFloorRate > 0;
    const hasProfitFloorValue = profitFloorValue !== null && profitFloorValue > 0;
    const includeSubmitAction = options && options.includeSubmitAction !== false;

    if (!hasProfitFloorRate && !hasProfitFloorValue) {
      return '\u4e0d\u9650';
    }

    const parts = [];

    if (hasProfitFloorRate) {
      parts.push(`\u5229\u6da6\u7387 >= ${formatPercent(profitFloorRate)}`);
    }

    if (hasProfitFloorValue) {
      parts.push(`\u5229\u6da6\u503c >= ${formatTrafficBoostCustomLevelAmount(profitFloorValue)}\u5143`);
    }

    let ruleText = parts.join(
      hasProfitFloorRate && hasProfitFloorValue
        ? (normalizeTrafficBoostCustomLevelFilterRelation(normalizedSettings.profitFloorRelation) === 'or' ? ' \u6216 ' : ' \u4e14 ')
        : ''
    );

    if (includeSubmitAction === true && normalizedSettings.submitAtProfitFloor === true) {
      ruleText += `\uff0c\u4f4e\u4e8e\u4fdd\u5e95\u6309${formatTrafficBoostCustomLevelSubmitBasisLabel(normalizedSettings.submitAtProfitFloorBasis)}\u63d0\u4ea4`;
    }

    return ruleText;
  }

  function buildTrafficBoostCustomLevelSubmitFloorText(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const floorRuleText = formatTrafficBoostCustomLevelProfitFloorRule(normalizedSettings, {
      includeSubmitAction: false
    });

    if (floorRuleText === '\u4e0d\u9650') {
      return '\u5148\u6309\u5f53\u524d\u8ba1\u4ef7\u89c4\u5219\u8ba1\u7b97\uff0c\u5927\u4e8e\u7b49\u4e8e\u8d85\u7ea7\u4ef7\u65f6\u6539\u4e3a\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u63d0\u4ea4';
    }

    if (normalizedSettings.submitAtProfitFloor !== true) {
      return '\u81ea\u5b9a\u4e49\u4ef7\u672a\u8fbe\u4fdd\u5e95\u6216\u5927\u4e8e\u7b49\u4e8e\u8d85\u7ea7\u4ef7\u65f6\uff0c\u5148\u6309\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u590d\u6838\uff1b\u4ecd\u672a\u8fbe\u4fdd\u5e95\u5219\u4e0d\u63d0\u4ea4';
    }

    const basisLabel = formatTrafficBoostCustomLevelSubmitBasisLabel(normalizedSettings.submitAtProfitFloorBasis);
    return `\u81ea\u5b9a\u4e49\u4ef7\u672a\u8fbe\u4fdd\u5e95\u6216\u5927\u4e8e\u7b49\u4e8e\u8d85\u7ea7\u4ef7\u65f6\uff0c\u5148\u6309\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u590d\u6838\uff1b\u4ecd\u672a\u8fbe\u4fdd\u5e95\u65f6\uff0c\u518d\u6309${basisLabel}\u751f\u6210\u4fdd\u5e95\u63d0\u4ea4\u4ef7`;
  }

  function formatTrafficBoostCustomLevelFilterRule(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const mode = normalizeTrafficBoostCustomLevelFilterMode(normalizedSettings.mode);
    const modeOption = TRAFFIC_CUSTOM_FILTER_MODE_OPTIONS.find((option) => normalizeText(option && option.value) === mode) || null;
    const modeLabel = normalizeText(modeOption && modeOption.label) || '\u4ee5\u65e5\u5e38\u4ef7\u6298\u6263';
    const modeValue = normalizeOptionalNumber(resolveTrafficBoostCustomLevelFilterModeValue(normalizedSettings, mode));
    let ruleText = modeLabel;

    if (mode === 'dailyDiscount' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${modeValue}\u6298`;
    } else if (mode === 'saleProfitRate' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${formatPercent(modeValue)}`;
    } else if (mode === 'profitRateDiscount' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${formatPercent(modeValue)}`;
    } else if (mode === 'dailyReduce' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${formatTrafficBoostCustomLevelAmount(modeValue)}\u5143`;
    } else if (mode === 'costMarkup' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${formatTrafficBoostCustomLevelAmount(modeValue)}\u5143`;
    }

    if (isTrafficBoostCustomLevelCostBasedMode(mode)) {
      ruleText += '\uff08\u9700\u6210\u672c\u4ef7\uff09';
    }

    return ruleText;
  }

  function buildTrafficBoostCustomLevelModeFormulaText(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const mode = normalizeTrafficBoostCustomLevelFilterMode(normalizedSettings.mode);

    if (mode === 'dailyDiscount') {
      return '\u5148\u6309\u65e5\u5e38\u4ef7 x \u6298\u6263 / 10 \u8ba1\u7b97\u81ea\u5b9a\u4e49\u4ef7';
    }

    if (mode === 'dailyReduce') {
      return '\u5148\u6309\u65e5\u5e38\u4ef7 - \u76f4\u51cf\u91d1\u989d \u8ba1\u7b97\u81ea\u5b9a\u4e49\u4ef7';
    }

    if (mode === 'costMarkup') {
      return '\u5148\u6309\u6210\u672c\u4ef7 + \u52a0\u4ef7\u91d1\u989d \u8ba1\u7b97\u81ea\u5b9a\u4e49\u4ef7\uff08\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff09';
    }

    if (mode === 'profitRateDiscount') {
      return '\u5148\u6309\u6210\u672c\u4ef7 x (1 + \u5229\u6da6\u7387) \u8ba1\u7b97\u81ea\u5b9a\u4e49\u4ef7\uff08\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff09';
    }

    if (mode === 'saleProfitRate') {
      return '\u5148\u6309\u552e\u4ef7\u5229\u6da6\u7387\u53cd\u63a8\u81ea\u5b9a\u4e49\u4ef7\uff0c\u516c\u5f0f\u4e3a\uff1a\u4ef7\u683c = \u6210\u672c\u4ef7 / (1 - \u5229\u6da6\u7387)\uff08\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff09';
    }

    return '\u5148\u6309\u5f53\u524d\u8ba1\u4ef7\u89c4\u5219\u8ba1\u7b97\u81ea\u5b9a\u4e49\u4ef7';
  }

  function buildTrafficBoostCustomLevelModeTipText(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const floorRuleText = formatTrafficBoostCustomLevelProfitFloorRule(normalizedSettings, {
      includeSubmitAction: false
    });
    const formulaText = buildTrafficBoostCustomLevelModeFormulaText(normalizedSettings);
    const costRequirementText = buildTrafficBoostCustomLevelCostRequirementText(normalizedSettings);
    const costRequirementPrefix = costRequirementText ? `${costRequirementText}\uff1b` : '';

    if (floorRuleText === '\u4e0d\u9650') {
      return `${formulaText}\uff1b${costRequirementPrefix}\u82e5\u81ea\u5b9a\u4e49\u4ef7\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01\uff0c\u76f4\u63a5\u63d0\u4ea4\uff1b\u82e5\u5927\u4e8e\u7b49\u4e8e\u8d85\u7ea7\u4ef7\uff0c\u5219\u6539\u4e3a\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u63d0\u4ea4\u3002`;
    }

    if (normalizedSettings.submitAtProfitFloor === true) {
      const basisLabel = formatTrafficBoostCustomLevelSubmitBasisLabel(normalizedSettings.submitAtProfitFloorBasis);
      return `${formulaText}\uff1b${costRequirementPrefix}\u82e5\u81ea\u5b9a\u4e49\u4ef7\u6ee1\u8db3\u4fdd\u5e95\u4e14\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01\uff0c\u76f4\u63a5\u63d0\u4ea4\uff1b\u5426\u5219\u5148\u6309\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u590d\u6838\uff0c\u4ecd\u672a\u8fbe\u5230\u5f53\u524d\u4fdd\u5e95\u65f6\uff0c\u518d\u6309${basisLabel}\u751f\u6210\u4fdd\u5e95\u63d0\u4ea4\u4ef7\uff0c\u53ea\u6709\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01 \u4e14\u4ecd\u6ee1\u8db3\u4fdd\u5e95\u65f6\u624d\u4f1a\u63d0\u4ea4\u3002`;
    }

    return `${formulaText}\uff1b${costRequirementPrefix}\u82e5\u81ea\u5b9a\u4e49\u4ef7\u6ee1\u8db3\u4fdd\u5e95\u4e14\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01\uff0c\u76f4\u63a5\u63d0\u4ea4\uff1b\u5426\u5219\u5148\u6309\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u590d\u6838\uff0c\u4ecd\u672a\u8fbe\u5230\u5f53\u524d\u4fdd\u5e95\u65f6\u5219\u4e0d\u63d0\u4ea4\u3002`;
  }

  function buildTrafficBoostCustomLevelFilterNoteText(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const floorRuleText = formatTrafficBoostCustomLevelProfitFloorRule(normalizedSettings, {
      includeSubmitAction: false
    });
    const costRequirementText = buildTrafficBoostCustomLevelCostRequirementText(normalizedSettings);
    const missingCostActionText = costRequirementText
      ? '\u6210\u672c\u9884\u8bbe\u672a\u547d\u4e2d\u7684SKU\u672c\u6b21\u4e0d\u63d0\u4ea4\uff0c\u4e0d\u5f71\u54cd\u540c\u5546\u54c1\u5176\u4ed6\u5df2\u901a\u8fc7SKU\u63d0\u4ea4\uff1b\u5982\u5df2\u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7\uff0c\u8bf7\u68c0\u67e5SKU\u89c4\u683c\u3001\u7ad9\u70b9\u6216\u7c7b\u76ee\u662f\u5426\u4e00\u81f4'
      : '';

    if (floorRuleText === '\u4e0d\u9650') {
      return costRequirementText
        ? `\u5f53\u524d\u4e0d\u8bbe\u4fdd\u5e95\u9650\u5236\uff1b${costRequirementText}\uff1b${missingCostActionText}\uff1b\u6700\u7ec8\u63d0\u4ea4\u4ef7\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01\u3002`
        : '\u5f53\u524d\u4e0d\u8bbe\u4fdd\u5e95\u9650\u5236\uff1b\u6700\u7ec8\u63d0\u4ea4\u4ef7\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01\u3002';
    }

    if (normalizedSettings.submitAtProfitFloor === true) {
      const basisLabel = formatTrafficBoostCustomLevelSubmitBasisLabel(normalizedSettings.submitAtProfitFloorBasis);
      return `\u5f53\u524d\u4fdd\u5e95\u89c4\u5219\uff1a${floorRuleText}\u3002${costRequirementText || '\u4fdd\u5e95\u5229\u6da6\u6821\u9a8c\u9700\u8981\u5148\u5339\u914d\u6210\u672c\u4ef7'}\uff1b${missingCostActionText || '\u672a\u5339\u914d\u6210\u672c\u4ef7\u7684SKU\u4e0d\u63d0\u4ea4'}\uff1b\u5982\u81ea\u5b9a\u4e49\u4ef7\u548c\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u90fd\u672a\u8fbe\u5230\u4fdd\u5e95\uff0c\u5219\u4f1a\u6309${basisLabel}\u751f\u6210\u4fdd\u5e95\u63d0\u4ea4\u4ef7\uff0c\u53ea\u6709\u8be5\u4ef7\u683c\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01 \u4e14\u4ecd\u6ee1\u8db3\u5f53\u524d\u4fdd\u5e95\u65f6\u624d\u4f1a\u63d0\u4ea4\u3002`;
    }

    return `\u5f53\u524d\u4fdd\u5e95\u89c4\u5219\uff1a${floorRuleText}\u3002${costRequirementText || '\u4fdd\u5e95\u5229\u6da6\u6821\u9a8c\u9700\u8981\u5148\u5339\u914d\u6210\u672c\u4ef7'}\uff1b${missingCostActionText || '\u672a\u5339\u914d\u6210\u672c\u4ef7\u7684SKU\u4e0d\u63d0\u4ea4'}\uff1b\u5982\u81ea\u5b9a\u4e49\u4ef7\u548c\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u90fd\u672a\u8fbe\u5230\u4fdd\u5e95\uff0c\u5219\u8be5SKU\u672c\u6b21\u4e0d\u63d0\u4ea4\u3002`;
  }

  function buildTrafficBoostCustomLevelFilterEditorModel(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const mode = normalizeTrafficBoostCustomLevelFilterMode(normalizedSettings.mode);
    const modeValuePlaceholder = mode === 'dailyDiscount'
      ? '\u8f93\u5165\u6298\u6263\uff0c\u4f8b\u5982 8.5 \u8868\u793a85\u6298'
      : (mode === 'saleProfitRate'
        ? '\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff1b\u8f93\u5165\u552e\u4ef7\u5229\u6da6\u7387\uff0c\u4f8b\u5982 20'
        : (mode === 'profitRateDiscount'
          ? '\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff1b\u8f93\u5165\u6210\u672c\u5229\u6da6\u7387\uff0c\u4f8b\u5982 20'
          : (mode === 'dailyReduce'
            ? '\u8f93\u5165\u76f4\u51cf\u91d1\u989d\uff0c\u4f8b\u5982 10 \u8868\u793a\u5728\u65e5\u5e38\u4ef7\u57fa\u7840\u4e0a\u51cf10\u5143'
            : '\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff1b\u8f93\u5165\u52a0\u4ef7\u91d1\u989d\uff0c\u4f8b\u5982 10')));
    const modeValueUnit = mode === 'dailyReduce' || mode === 'costMarkup'
      ? '\u5143'
      : ((mode === 'profitRateDiscount' || mode === 'saleProfitRate') ? '%' : '\u6298');

    return {
      settings: normalizedSettings,
      mode,
      modeValuePlaceholder,
      modeValueUnit,
      modeTipText: buildTrafficBoostCustomLevelModeTipText(normalizedSettings),
      profitFloorRuleText: formatTrafficBoostCustomLevelProfitFloorRule(normalizedSettings),
      filterNoteText: buildTrafficBoostCustomLevelFilterNoteText(normalizedSettings)
    };
  }

  function renderTrafficBoostCustomLevelFilterSettingsFields(settings, options = {}) {
    const editorModel = buildTrafficBoostCustomLevelFilterEditorModel(settings);
    const attrName = normalizeText(options && options.settingAttribute) || 'data-ops-traffic-custom-level-setting';
    const disabled = options && options.disabled === true;

    return `
      <div class="ops-activity-product-filter-row is-mode-row">
        <label class="ops-activity-product-filter-field">
          <span>\u7b5b\u9009\u65b9\u5f0f</span>
          <select ${attrName}="mode" ${disabled ? 'disabled' : ''}>
            ${renderOptions(TRAFFIC_CUSTOM_FILTER_MODE_OPTIONS, editorModel.mode, '', { includeEmpty: false })}
          </select>
        </label>
        <label class="ops-activity-product-filter-field">
          <span>\u8bbe\u7f6e\u8f93\u5165</span>
          <div class="ops-activity-product-filter-input-wrap">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="${escapeHtml(editorModel.modeValuePlaceholder)}"
              value="${escapeHtml(editorModel.settings.modeValue)}"
              ${attrName}="modeValue"
              ${disabled ? 'disabled' : ''}
            />
            <span>${escapeHtml(editorModel.modeValueUnit)}</span>
          </div>
        </label>
        <span class="ops-activity-product-filter-tip">${escapeHtml(editorModel.modeTipText)}</span>
      </div>
      <div class="ops-activity-product-filter-row is-floor-row">
        <label class="ops-activity-product-filter-field">
          <span>\u4fdd\u5e95\u5229\u6da6\u7387\u8bbe\u7f6e</span>
          <div class="ops-activity-product-filter-input-wrap">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="\u4f8b\u5982 12"
              value="${escapeHtml(editorModel.settings.profitFloorRate)}"
              ${attrName}="profitFloorRate"
              ${disabled ? 'disabled' : ''}
            />
            <span>%</span>
          </div>
        </label>
        <label class="ops-activity-product-filter-field is-floor-relation">
          <span>\u6761\u4ef6</span>
          <select ${attrName}="profitFloorRelation" ${disabled ? 'disabled' : ''}>
            ${renderOptions(TRAFFIC_CUSTOM_FILTER_RELATION_OPTIONS, editorModel.settings.profitFloorRelation, '', { includeEmpty: false })}
          </select>
        </label>
        <label class="ops-activity-product-filter-field">
          <span>\u4fdd\u5e95\u5229\u6da6\u503c\u8bbe\u7f6e</span>
          <div class="ops-activity-product-filter-input-wrap">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="\u4f8b\u5982 15"
              value="${escapeHtml(editorModel.settings.profitFloorValue)}"
              ${attrName}="profitFloorValue"
              ${disabled ? 'disabled' : ''}
            />
            <span>\u5143</span>
          </div>
        </label>
      </div>
      <div class="ops-activity-product-filter-row is-submit-row">
        <div class="ops-activity-product-filter-submit-group">
          <label class="ops-activity-product-filter-toggle">
            <input
              type="checkbox"
              ${editorModel.settings.submitAtProfitFloor === true ? 'checked' : ''}
              ${attrName}="submitAtProfitFloor"
              ${disabled ? 'disabled' : ''}
            />
            <span>\u81ea\u5b9a\u4e49\u4ef7\u548c\u8d85\u7ea7\u4ef7\u90fd\u672a\u8fbe\u4fdd\u5e95\u65f6\uff0c\u6309\u4fdd\u5e95\u4ef7\u63d0\u4ea4</span>
          </label>
          <label class="ops-activity-product-filter-inline-field is-submit-basis">
            <span>\u4f7f\u7528</span>
            <select
              ${attrName}="submitAtProfitFloorBasis"
              ${editorModel.settings.submitAtProfitFloor === true && !disabled ? '' : 'disabled'}
            >
              ${renderOptions(
                TRAFFIC_CUSTOM_FILTER_SUBMIT_BASIS_OPTIONS,
                editorModel.settings.submitAtProfitFloorBasis,
                '',
                { includeEmpty: false }
              )}
            </select>
          </label>
        </div>
        <span class="ops-activity-product-filter-note">${escapeHtml(editorModel.filterNoteText)}</span>
      </div>
    `;
  }

  function updateTrafficBoostCustomLevelFilterSettingsDraft(settings, fieldName, value) {
    const currentSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const normalizedFieldName = normalizeText(fieldName);

    if (normalizedFieldName === 'mode') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        mode: value
      });
    }

    if (normalizedFieldName === 'modeValue') {
      const currentMode = normalizeTrafficBoostCustomLevelFilterMode(currentSettings.mode);
      const nextPayload = { ...currentSettings };

      if (currentMode === 'dailyDiscount') {
        nextPayload.modeValueDailyDiscount = value;
      } else if (currentMode === 'saleProfitRate') {
        nextPayload.modeValueSaleProfitRate = value;
      } else if (currentMode === 'profitRateDiscount') {
        nextPayload.modeValueProfitRateDiscount = value;
      } else if (currentMode === 'dailyReduce') {
        nextPayload.modeValueDailyReduce = value;
      } else if (currentMode === 'costMarkup') {
        nextPayload.modeValueCostMarkup = value;
      }

      return normalizeTrafficBoostCustomLevelFilterSettings(nextPayload);
    }

    if (normalizedFieldName === 'clampToSuggestPrice') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        clampToSuggestPrice: value
      });
    }

    if (normalizedFieldName === 'profitFloorRate') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        profitFloorRate: value
      });
    }

    if (normalizedFieldName === 'profitFloorRelation') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        profitFloorRelation: value
      });
    }

    if (normalizedFieldName === 'profitFloorValue') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        profitFloorValue: value
      });
    }

    if (normalizedFieldName === 'submitAtProfitFloor') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        submitAtProfitFloor: value
      });
    }

    if (normalizedFieldName === 'submitAtProfitFloorBasis') {
      return normalizeTrafficBoostCustomLevelFilterSettings({
        ...currentSettings,
        submitAtProfitFloorBasis: value
      });
    }

    return currentSettings;
  }

  function normalizeMarketRegion(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    return MARKET_REGION_OPTIONS.some((option) => option.value === normalizedValue)
      ? normalizedValue
      : 'us';
  }

  function normalizeDateInputValue(value) {
    const normalizedValue = normalizeText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : '';
  }

  function padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  function formatDateInputValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    return [
      date.getFullYear(),
      padDatePart(date.getMonth() + 1),
      padDatePart(date.getDate())
    ].join('-');
  }

  function buildRecentDateRange(dayCount) {
    const normalizedDayCount = Math.max(1, Number.parseInt(dayCount, 10) || 1);
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(endDate.getDate() - normalizedDayCount + 1);

    return {
      startDate: formatDateInputValue(startDate),
      endDate: formatDateInputValue(endDate)
    };
  }

  function getShopMultiSelectControl() {
    if (
      window.shopMultiSelectControl
      && typeof window.shopMultiSelectControl === 'object'
    ) {
      return window.shopMultiSelectControl;
    }

    return null;
  }

  function getShopSelectionTemplateHelper() {
    if (
      window.operationsShopSelectionTemplates
      && typeof window.operationsShopSelectionTemplates === 'object'
    ) {
      return window.operationsShopSelectionTemplates;
    }

    return null;
  }

  function getCategoryCascadeControl() {
    if (
      window.categoryCascadeControl
      && typeof window.categoryCascadeControl === 'object'
    ) {
      return window.categoryCascadeControl;
    }

    return null;
  }

  function getFeatureCenterApi() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter === 'object'
    ) {
      return window.temuApp.featureCenter;
    }

    return null;
  }

  function normalizeQueryProgressPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const phase = normalizeText(payload.phase);

    if (!phase) {
      return null;
    }

    return {
      runId: normalizeText(payload.runId),
      shopId: normalizeText(payload.shopId),
      shopName: normalizeText(payload.shopName),
      currentShopId: normalizeText(payload.currentShopId),
      currentShopName: normalizeText(payload.currentShopName),
      currentShopIndex: Math.max(0, Number.parseInt(payload.currentShopIndex, 10) || 0),
      phase,
      pageNum: Math.max(0, Number.parseInt(payload.pageNum, 10) || 0),
      totalPages: Math.max(0, Number.parseInt(payload.totalPages, 10) || 0),
      pageSize: Math.max(0, Number.parseInt(payload.pageSize, 10) || 0),
      fetchedItemCount: Math.max(0, Number.parseInt(payload.fetchedItemCount, 10) || 0),
      accumulatedItemCount: Math.max(0, Number.parseInt(payload.accumulatedItemCount, 10) || 0),
      estimatedTotal: Math.max(0, Number.parseInt(payload.estimatedTotal, 10) || 0),
      rowCount: Math.max(0, Number.parseInt(payload.rowCount, 10) || 0),
      totalShops: Math.max(0, Number.parseInt(payload.totalShops, 10) || 0),
      completedShops: Math.max(0, Number.parseInt(payload.completedShops, 10) || 0),
      failedShops: Math.max(0, Number.parseInt(payload.failedShops, 10) || 0),
      canceledShops: Math.max(0, Number.parseInt(payload.canceledShops, 10) || 0),
      activeShops: Math.max(0, Number.parseInt(payload.activeShops, 10) || 0),
      totalProductCount: Math.max(0, Number.parseInt(payload.totalProductCount, 10) || 0),
      successItemCount: Math.max(0, Number.parseInt(payload.successItemCount, 10) || 0),
      failedItemCount: Math.max(0, Number.parseInt(payload.failedItemCount, 10) || 0),
      currentShopSuccessCount: Math.max(0, Number.parseInt(payload.currentShopSuccessCount, 10) || 0),
      currentShopFailedCount: Math.max(0, Number.parseInt(payload.currentShopFailedCount, 10) || 0),
      currentShopTotalCount: Math.max(0, Number.parseInt(payload.currentShopTotalCount, 10) || 0),
      currentBatchSuccessCount: Math.max(0, Number.parseInt(payload.currentBatchSuccessCount, 10) || 0),
      currentBatchFailedCount: Math.max(0, Number.parseInt(payload.currentBatchFailedCount, 10) || 0),
      message: normalizeText(payload.message),
      updatedAt: normalizeText(payload.updatedAt),
      traceType: normalizeText(payload.traceType),
      requestLabel: normalizeText(payload.requestLabel),
      requestPath: normalizeText(payload.requestPath),
      requestUrl: normalizeText(payload.requestUrl),
      requestMethod: normalizeText(payload.requestMethod).toUpperCase(),
      requestTransport: normalizeText(payload.requestTransport),
      currentUrl: normalizeText(payload.currentUrl),
      finalUrl: normalizeText(payload.finalUrl),
      sourceOrigin: normalizeText(payload.sourceOrigin),
      targetOrigin: normalizeText(payload.targetOrigin),
      responseTextPreview: normalizeText(payload.responseTextPreview),
      errorMessage: normalizeText(payload.errorMessage),
      loginCodeSource: normalizeText(payload.loginCodeSource),
      success: payload && Object.prototype.hasOwnProperty.call(payload, 'success')
        ? payload.success === true
        : null,
      authRequired: payload && payload.authRequired === true,
      hasLoginCode: payload && payload.hasLoginCode === true,
      httpStatus: Math.max(0, Number.parseInt(payload.httpStatus, 10) || 0),
      errorCode: Math.max(0, Number.parseInt(payload.errorCode, 10) || 0)
    };
  }

  function isTerminalQueryProgress(progress) {
    const phase = normalizeText(progress && progress.phase);
    return phase === 'completed' || phase === 'failed' || phase === 'canceled';
  }

  function isTrafficBoostSubmitProgressPayload(progress) {
    const normalizedProgress = normalizeQueryProgressPayload(progress);

    if (!normalizedProgress) {
      return false;
    }

    return Boolean(
      normalizedProgress.totalProductCount > 0
      || normalizedProgress.currentShopTotalCount > 0
      || normalizedProgress.successItemCount > 0
      || normalizedProgress.failedItemCount > 0
    );
  }

  function formatRequestTransportLabel(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (normalizedValue === 'page.fetch') {
      return '\u9875\u9762 fetch';
    }

    if (normalizedValue === 'page.navigate') {
      return '\u9875\u9762\u8df3\u8f6c';
    }

    if (normalizedValue === 'session.fetch') {
      return '\u4f1a\u8bdd fetch';
    }

    if (normalizedValue === 'net.request') {
      return 'net.request';
    }

    return normalizeText(value);
  }

  function normalizeQueryTraceEntry(payload) {
    const progress = normalizeQueryProgressPayload(payload);

    if (!progress) {
      return null;
    }

    const hasTraceDetail = Boolean(
      normalizeText(progress.traceType)
      || normalizeText(progress.requestLabel)
      || normalizeText(progress.requestPath)
      || normalizeText(progress.requestUrl)
      || normalizeText(progress.requestTransport)
      || Math.max(0, Number(progress.httpStatus) || 0) > 0
      || Math.max(0, Number(progress.errorCode) || 0) > 0
      || normalizeText(progress.responseTextPreview)
      || normalizeText(progress.errorMessage)
    );

    if (!hasTraceDetail) {
      return null;
    }

    return {
      runId: normalizeText(progress.runId),
      updatedAt: normalizeText(progress.updatedAt),
      phase: normalizeText(progress.phase),
      traceType: normalizeText(progress.traceType),
      requestLabel: normalizeText(progress.requestLabel),
      requestPath: normalizeText(progress.requestPath),
      requestUrl: normalizeText(progress.requestUrl),
      requestMethod: normalizeText(progress.requestMethod).toUpperCase(),
      requestTransport: normalizeText(progress.requestTransport),
      httpStatus: Math.max(0, Number(progress.httpStatus) || 0),
      errorCode: Math.max(0, Number(progress.errorCode) || 0),
      responseTextPreview: truncateText(progress.responseTextPreview, 260),
      errorMessage: truncateText(progress.errorMessage, 260),
      message: truncateText(progress.message, 180),
      finalUrl: normalizeText(progress.finalUrl),
      currentUrl: normalizeText(progress.currentUrl),
      sourceOrigin: normalizeText(progress.sourceOrigin),
      targetOrigin: normalizeText(progress.targetOrigin),
      authRequired: progress.authRequired === true
    };
  }

  function appendQueryTraceEntry(state, payload) {
    const nextEntry = normalizeQueryTraceEntry(payload);

    if (!state || !nextEntry) {
      return;
    }

    const nextKey = [
      normalizeText(nextEntry.runId),
      normalizeText(nextEntry.updatedAt),
      normalizeText(nextEntry.phase),
      normalizeText(nextEntry.traceType),
      normalizeText(nextEntry.requestLabel),
      normalizeText(nextEntry.requestPath),
      normalizeText(nextEntry.requestUrl),
      normalizeText(nextEntry.requestTransport),
      String(Math.max(0, Number(nextEntry.httpStatus) || 0)),
      String(Math.max(0, Number(nextEntry.errorCode) || 0)),
      normalizeText(nextEntry.message),
      normalizeText(nextEntry.responseTextPreview),
      normalizeText(nextEntry.errorMessage)
    ].join('|');
    const latestEntry = Array.isArray(state.queryTraceEntries) ? state.queryTraceEntries[0] : null;
    const latestKey = latestEntry
      ? [
        normalizeText(latestEntry.runId),
        normalizeText(latestEntry.updatedAt),
        normalizeText(latestEntry.phase),
        normalizeText(latestEntry.traceType),
        normalizeText(latestEntry.requestLabel),
        normalizeText(latestEntry.requestPath),
        normalizeText(latestEntry.requestUrl),
        normalizeText(latestEntry.requestTransport),
        String(Math.max(0, Number(latestEntry.httpStatus) || 0)),
        String(Math.max(0, Number(latestEntry.errorCode) || 0)),
        normalizeText(latestEntry.message),
        normalizeText(latestEntry.responseTextPreview),
        normalizeText(latestEntry.errorMessage)
      ].join('|')
      : '';

    if (latestKey === nextKey) {
      return;
    }

    state.queryTraceEntries = [nextEntry].concat(
      Array.isArray(state.queryTraceEntries) ? state.queryTraceEntries : []
    ).slice(0, MAX_QUERY_TRACE_ENTRY_COUNT);
  }

  function formatQueryTraceTitle(entry) {
    const requestLabel = normalizeText(entry && entry.requestLabel);
    const requestPath = normalizeText(entry && entry.requestPath);

    if (requestLabel) {
      return requestLabel;
    }

    if (requestPath) {
      return requestPath;
    }

    return normalizeText(entry && entry.phase) || '\u8bf7\u6c42';
  }

  function formatQueryTraceMeta(entry) {
    const parts = [];
    const requestMethod = normalizeText(entry && entry.requestMethod).toUpperCase();
    const requestPath = normalizeText(entry && entry.requestPath) || normalizeText(entry && entry.requestUrl);
    const requestTransport = formatRequestTransportLabel(entry && entry.requestTransport);
    const httpStatus = Math.max(0, Number(entry && entry.httpStatus) || 0);
    const errorCode = Math.max(0, Number(entry && entry.errorCode) || 0);

    if (normalizeText(entry && entry.updatedAt)) {
      parts.push(normalizeText(entry.updatedAt));
    }

    if (requestMethod || requestPath) {
      parts.push([requestMethod, requestPath].filter(Boolean).join(' '));
    }

    if (requestTransport) {
      parts.push(requestTransport);
    }

    if (httpStatus > 0) {
      parts.push(`HTTP ${httpStatus}`);
    }

    if (errorCode > 0) {
      parts.push(`code ${errorCode}`);
    }

    if (entry && entry.authRequired === true) {
      parts.push('\u9700\u8981\u91cd\u65b0\u767b\u5f55');
    }

    return parts.join(' | ');
  }

  function formatQueryTraceDetail(entry) {
    const errorMessage = normalizeText(entry && entry.errorMessage);
    const responseTextPreview = normalizeText(entry && entry.responseTextPreview);
    const message = normalizeText(entry && entry.message);

    if (errorMessage) {
      return errorMessage;
    }

    if (responseTextPreview) {
      return responseTextPreview;
    }

    return message;
  }

  function getMarketRegionLabel(value) {
    const normalizedValue = normalizeMarketRegion(value);
    const matchedOption = MARKET_REGION_OPTIONS.find((option) => option.value === normalizedValue);
    return normalizeText(matchedOption && matchedOption.label) || normalizedValue.toUpperCase();
  }

  function resolveTrafficBoostLevelPriceField(level) {
    const normalizedLevel = normalizeTrafficBoostLevel(level);

    if (normalizedLevel === 'advanced') {
      return 'premiumFlowSupplierPrice';
    }

    if (normalizedLevel === 'super') {
      return 'superFlowSupplierPrice';
    }

    if (normalizedLevel === 'custom') {
      return 'custom';
    }

    return 'ordinaryFlowSupplierPrice';
  }

  function buildTrafficBoostSkuStatusReason(result) {
    if (!result || result.status === 'ready') {
      return '';
    }

    const baseReason = normalizeText(result.reason);

    if (baseReason) {
      if (result.code === 'missingCost') {
        return `${baseReason}\uff0c\u8be5SKU\u672c\u6b21\u4e0d\u63d0\u4ea4`;
      }

      return baseReason;
    }

    return '\u5f53\u524dSKU\u4e0d\u53ef\u63d0\u4ea4';
  }

  function resolveTrafficBoostCustomLevelStatusSettings(state) {
    if (state && state.customLevelFilterDialogOpen === true) {
      return normalizeTrafficBoostCustomLevelFilterSettings(state.customLevelFilterSettings);
    }

    return normalizeTrafficBoostCustomLevelFilterSettings(state && state.customLevelFilterAppliedSettings);
  }

  function isTrafficBoostCustomLevelCostBasedMode(mode) {
    const normalizedMode = normalizeTrafficBoostCustomLevelFilterMode(mode);
    return normalizedMode === 'costMarkup'
      || normalizedMode === 'profitRateDiscount'
      || normalizedMode === 'saleProfitRate';
  }

  function hasTrafficBoostCustomLevelProfitFloorRule(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    return normalizeOptionalNumber(normalizedSettings.profitFloorRate) > 0
      || normalizeOptionalNumber(normalizedSettings.profitFloorValue) > 0;
  }

  function buildTrafficBoostCustomLevelCostRequirementText(settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const mode = normalizeTrafficBoostCustomLevelFilterMode(normalizedSettings.mode);
    const parts = [];

    if (isTrafficBoostCustomLevelCostBasedMode(mode)) {
      parts.push('\u5f53\u524d\u8ba1\u4ef7\u65b9\u5f0f\u9700\u8981\u5148\u5339\u914d\u6210\u672c\u4ef7');
    }

    if (hasTrafficBoostCustomLevelProfitFloorRule(normalizedSettings)) {
      parts.push('\u4fdd\u5e95\u5229\u6da6\u6821\u9a8c\u9700\u8981\u5148\u5339\u914d\u6210\u672c\u4ef7');
    }

    return Array.from(new Set(parts)).join('\uff1b');
  }

  function computeTrafficBoostCustomSkuResult(skuItem, settings) {
    const normalizedSettings = normalizeTrafficBoostCustomLevelFilterSettings(settings);
    const mode = normalizeTrafficBoostCustomLevelFilterMode(normalizedSettings.mode);
    const modeValue = normalizeOptionalNumber(resolveTrafficBoostCustomLevelFilterModeValue(normalizedSettings, mode));
    const dailyPrice = Number(skuItem && skuItem.supplierPrice);
    const superPrice = Number(skuItem && skuItem.superFlowSupplierPrice);
    const costPrice = normalizeOptionalNumber(skuItem && skuItem.costPrice);
    const costAmount = normalizeTrafficBoostYuanToCent(costPrice);
    const hasCostAmount = costAmount !== null && costAmount > 0;
    const hasProfitFloorRule = hasTrafficBoostCustomLevelProfitFloorRule(normalizedSettings);
    const requiresCostAmount = isTrafficBoostCustomLevelCostBasedMode(mode) || hasProfitFloorRule;
    const result = {
      status: 'skip',
      code: '',
      reason: '',
      targetPrice: null,
      targetPriceText: '\u2014',
      profitRate: null,
      profitRateText: '\u2014',
      profitValue: null,
      profitValueText: '\u2014',
      adjustedToProfitFloor: false,
      adjustedToProfitFloorBasis: '',
      adjustedToProfitFloorBasisText: '',
      adjustedToSuperPrice: false
    };

    if (!(Number.isFinite(superPrice) && superPrice > 0)) {
      result.reason = '\u7f3a\u5c11\u8d85\u7ea7\u4ef7\uff0c\u65e0\u6cd5\u8ba1\u7b97\u81ea\u5b9a\u4e49\u63d0\u4ea4\u4ef7';
      return result;
    }

    if (requiresCostAmount === true && hasCostAmount !== true) {
      result.code = 'missingCost';
      result.reason = `\u6210\u672c\u9884\u8bbe\u672a\u547d\u4e2d\uff0c${buildTrafficBoostCustomLevelCostRequirementText(normalizedSettings)}\uff1b\u5982\u5df2\u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7\uff0c\u8bf7\u68c0\u67e5SKU\u89c4\u683c\u3001\u7ad9\u70b9\u6216\u7c7b\u76ee\u662f\u5426\u4e00\u81f4`;
      return result;
    }

    let submitPrice = Number.NaN;

    if (mode === 'dailyDiscount') {
      if (!(Number.isFinite(dailyPrice) && dailyPrice > 0)) {
        result.reason = '\u7f3a\u5c11\u539f\u4ef7\uff0c\u65e0\u6cd5\u6309\u6298\u6263\u8ba1\u7b97';
        return result;
      }

      if (!(modeValue !== null && modeValue > 0)) {
        result.reason = '\u8bf7\u5148\u8bbe\u7f6e\u65e5\u5e38\u4ef7\u6298\u6263';
        return result;
      }

      submitPrice = Number((dailyPrice * (modeValue / 10)).toFixed(2));
    } else if (mode === 'dailyReduce') {
      if (!(Number.isFinite(dailyPrice) && dailyPrice > 0)) {
        result.reason = '\u7f3a\u5c11\u539f\u4ef7\uff0c\u65e0\u6cd5\u6309\u76f4\u51cf\u8ba1\u7b97';
        return result;
      }

      if (!(modeValue !== null && modeValue > 0)) {
        result.reason = '\u8bf7\u5148\u8bbe\u7f6e\u76f4\u51cf\u91d1\u989d';
        return result;
      }

      submitPrice = dailyPrice - Math.max(1, Math.round(modeValue * 100));
    } else if (mode === 'costMarkup') {
      if (!(modeValue !== null && modeValue > 0)) {
        result.reason = '\u8bf7\u5148\u8bbe\u7f6e\u6210\u672c\u52a0\u4ef7\u91d1\u989d';
        return result;
      }

      submitPrice = costAmount + Math.max(1, Math.round(modeValue * 100));
    } else if (mode === 'profitRateDiscount') {
      if (!(modeValue !== null && modeValue > 0)) {
        result.reason = '\u8bf7\u5148\u8bbe\u7f6e\u6210\u672c\u5229\u6da6\u7387';
        return result;
      }

      submitPrice = Number((costAmount * (1 + (modeValue / 100))).toFixed(2));
    } else if (mode === 'saleProfitRate') {
      if (!(modeValue !== null && modeValue > 0)) {
        result.reason = '\u8bf7\u5148\u8bbe\u7f6e\u552e\u4ef7\u5229\u6da6\u7387';
        return result;
      }

      submitPrice = computeTrafficBoostRequiredPriceForProfitRate(costAmount, modeValue);
    }

    if (!Number.isFinite(submitPrice) || submitPrice <= 0) {
      result.reason = '\u8ba1\u7b97\u51fa\u7684\u63d0\u4ea4\u4ef7\u65e0\u6548';
      return result;
    }

    const roundedSuperPrice = Math.max(1, Math.round(superPrice));
    const customSubmitPriceCeiling = roundedSuperPrice - 1;

    if (customSubmitPriceCeiling <= 0) {
      result.reason = '\u8d85\u7ea7\u4ef7\u8fc7\u4f4e\uff0c\u65e0\u6cd5\u751f\u6210\u4f4e\u4e8e\u8d85\u7ea7\u4ef7 0.01 \u7684\u63d0\u4ea4\u4ef7';
      return result;
    }

    let finalSubmitPrice = Math.max(1, Math.round(submitPrice));
    let floorEvaluation = hasCostAmount === true
      ? evaluateTrafficBoostProfitFloor(finalSubmitPrice, costAmount, normalizedSettings)
      : {
        meetsFloor: true,
        profitRate: Number.NaN,
        profitValue: Number.NaN,
        hasProfitFloorRate: false,
        hasProfitFloorValue: false
      };
    let readyReason = '';
    let failureReason = '';

    if (floorEvaluation.meetsFloor === true && finalSubmitPrice <= customSubmitPriceCeiling) {
      readyReason = '\u53ef\u76f4\u63a5\u63d0\u4ea4';
    } else {
      finalSubmitPrice = customSubmitPriceCeiling;
      result.adjustedToSuperPrice = true;
      floorEvaluation = hasCostAmount === true
        ? evaluateTrafficBoostProfitFloor(finalSubmitPrice, costAmount, normalizedSettings)
        : {
          meetsFloor: true,
          profitRate: Number.NaN,
          profitValue: Number.NaN,
          hasProfitFloorRate: false,
          hasProfitFloorValue: false
        };

      if (floorEvaluation.meetsFloor === true) {
        readyReason = '\u5df2\u538b\u5230\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u63d0\u4ea4';
      } else {
        const submitFloorBasisLabel = formatTrafficBoostCustomLevelSubmitBasisLabel(
          floorEvaluation.submitFloorBasisActive || floorEvaluation.submitAtProfitFloorBasis
        );
        const superCandidateFailReason = buildTrafficBoostProfitFloorFailReason(floorEvaluation);
        const canSubmitAtProfitFloor = floorEvaluation.submitAtProfitFloor === true
          && Number.isFinite(floorEvaluation.submitFloorRequiredPrice)
          && Boolean(submitFloorBasisLabel);

        if (!canSubmitAtProfitFloor) {
          failureReason = `\u6309\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u6821\u9a8c\u540e\uff0c${superCandidateFailReason}`;
        } else {
          const submitFloorPrice = Math.max(1, Math.round(floorEvaluation.submitFloorRequiredPrice));

          result.adjustedToProfitFloorBasis = floorEvaluation.submitFloorBasisActive || '';
          result.adjustedToProfitFloorBasisText = submitFloorBasisLabel;

          if (submitFloorPrice > customSubmitPriceCeiling) {
            failureReason = `\u6309${submitFloorBasisLabel}\u63d0\u4ea4\u9700 ${formatTrafficBoostCentsPrice(submitFloorPrice)}\u5143\uff0c\u4f46\u5fc5\u987b\u4f4e\u4e8e\u8d85\u7ea7\u4ef7\u81f3\u5c11 0.01`;
          } else {
            if (submitFloorPrice !== finalSubmitPrice) {
              result.adjustedToProfitFloor = true;
            }

            finalSubmitPrice = submitFloorPrice;
            floorEvaluation = evaluateTrafficBoostProfitFloor(finalSubmitPrice, costAmount, normalizedSettings);

            if (floorEvaluation.meetsFloor === true) {
              readyReason = `\u5df2\u6309${submitFloorBasisLabel}\u62ac\u9ad8\u5230\u53ef\u63d0\u4ea4\u4ef7`;
            } else {
              failureReason = `\u6309${submitFloorBasisLabel}\u63d0\u4ea4\u540e\uff0c${buildTrafficBoostProfitFloorFailReason(floorEvaluation)}`;
            }
          }
        }
      }
    }

    if (hasCostAmount === true && !Number.isFinite(floorEvaluation.profitRate)) {
      result.reason = '\u65e0\u6cd5\u8ba1\u7b97\u5229\u6da6\u7387';
      return result;
    }

    if (hasCostAmount === true && !Number.isFinite(floorEvaluation.profitValue)) {
      result.reason = '\u65e0\u6cd5\u8ba1\u7b97\u5229\u6da6\u503c';
      return result;
    }

    result.targetPrice = finalSubmitPrice;
    result.targetPriceText = formatTrafficBoostCentsPrice(finalSubmitPrice) === '\u2014'
      ? '\u2014'
      : `${formatTrafficBoostCentsPrice(finalSubmitPrice)}\u5143`;
    result.profitRate = hasCostAmount === true
      ? Number(floorEvaluation.profitRate.toFixed(2))
      : null;
    result.profitRateText = hasCostAmount === true
      ? formatPercent(result.profitRate)
      : '\u2014';
    result.profitValue = hasCostAmount === true
      ? Math.round(floorEvaluation.profitValue)
      : null;
    result.profitValueText = hasCostAmount === true
      ? `${formatTrafficBoostCentAmount(result.profitValue)}\u5143`
      : '\u2014';

    if (floorEvaluation.meetsFloor !== true) {
      result.reason = failureReason || (
        result.adjustedToSuperPrice === true
          ? `\u6309\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u538b\u4ef7\u540e\uff0c${buildTrafficBoostProfitFloorFailReason(floorEvaluation)}`
          : buildTrafficBoostProfitFloorFailReason(floorEvaluation)
      );
      return result;
    }

    result.status = 'ready';
    result.reason = readyReason || (
      result.adjustedToSuperPrice === true
        ? '\u5df2\u538b\u5230\u8d85\u7ea7\u4ef7\u4e0b\u65b9 0.01 \u63d0\u4ea4'
        : (result.adjustedToProfitFloor === true
          ? `\u5df2\u6309${result.adjustedToProfitFloorBasisText}\u62ac\u9ad8\u5230\u53ef\u63d0\u4ea4\u4ef7`
          : '\u53ef\u76f4\u63a5\u63d0\u4ea4')
    );
    return result;
  }

  function evaluateTrafficBoostRowStatus(row, state) {
    const selectedLevel = normalizeTrafficBoostLevel(state && state.trafficBoostLevel);
    const selectedLevelLabel = formatTrafficBoostLevelLabel(selectedLevel);
    const flowGrowStatus = normalizeText(row && row.flowGrowStatus);
    const canToGrow = normalizeText(row && row.canToGrow);
    const flowLimitStatus = normalizeText(row && row.flowLimitStatus);
    const canNotSubmitReason = normalizeText(row && row.canNotSubmitReason);
    const submitFailureMessage = normalizeText(row && row.submitFailureMessage);
    const submitFailureSkuId = normalizeText(row && row.submitFailureSkuId);
    const submittedTrafficBoostLevel = normalizeText(row && row.submittedTrafficBoostLevel);
    const submittedTrafficBoostDays = normalizeText(row && row.submittedTrafficBoostDays);
    const submittedTrafficBoostAutoRenew = row && row.submittedTrafficBoostAutoRenew === true;
    const submitPendingRefresh = row && row.submitPendingRefresh === true;
    const flowPriceInfoLoaded = row && row.flowPriceInfoLoaded === true;
    const flowPriceInfoFound = row && row.flowPriceInfoFound === true;
    const skuList = Array.isArray(row && row.skuPriceInfoList) ? row.skuPriceInfoList : [];
    const listedProductSkuIdList = Array.isArray(row && row.productSkuIdList)
      ? row.productSkuIdList
        .map((value) => normalizeText(value))
        .filter(Boolean)
      : [];
    const badgeList = [];
    const detailLines = [];
    const previewList = [];
    const invalidSkuReasons = [];
    const customProfitRateValues = [];
    const customProfitValueValues = [];
    const totalSkuCount = Math.max(skuList.length, listedProductSkuIdList.length);
    const hasRowBlocker = canToGrow === '0' || Boolean(canNotSubmitReason);
    let invalidCount = 0;
    let readyCount = 0;

    if (submitPendingRefresh === true && flowGrowStatus !== '1') {
      badgeList.push({
        label: '\u5df2\u63d0\u4ea4\u5f85\u5237\u65b0',
        tone: 'accent'
      });

      if (submittedTrafficBoostLevel) {
        detailLines.push(`\u672c\u6b21\u5df2\u63d0\u4ea4 ${formatTrafficBoostLevelLabel(submittedTrafficBoostLevel)}`);
      } else {
        detailLines.push('\u672c\u6b21\u63d0\u4ea4\u5df2\u8fd4\u56de\u6210\u529f\uff0c\u7b49\u5f85\u4e0b\u6b21\u5237\u65b0\u540c\u6b65\u540e\u53f0\u72b6\u6001');
      }

      return {
        badgeList,
        detailText: detailLines.filter(Boolean).join('\uff1b'),
        submittable: false
      };
    }

    if (flowGrowStatus === '1') {
      badgeList.push({
        label: '\u5df2\u5f00\u542f',
        tone: 'success'
      });

      const submittedLevelLabel = submittedTrafficBoostLevel
        ? formatTrafficBoostLevelLabel(submittedTrafficBoostLevel)
        : selectedLevelLabel;
      const submittedDays = Number(submittedTrafficBoostDays);
      let submittedDurationLabel = '';

      if (submittedDays === 7) {
        submittedDurationLabel = '\u6301\u7eed7\u5929';
      } else if (submittedDays === 14) {
        submittedDurationLabel = '\u6301\u7eed14\u5929';
      } else if (submittedDays === 30) {
        submittedDurationLabel = '\u6301\u7eed30\u5929';
      } else if (submittedDays === -1) {
        submittedDurationLabel = '\u957f\u671f\u6301\u7eed\u52a0\u901f';
      }

      if (submittedLevelLabel) {
        detailLines.push(`\u672c\u6b21\u5df2\u63d0\u4ea4 ${submittedLevelLabel}`);
      }

      if (submittedDurationLabel) {
        detailLines.push(
          submittedTrafficBoostAutoRenew === true && submittedDays > 0
            ? `${submittedDurationLabel}\uff08\u81ea\u52a8\u7eed\u671f\u5df2\u5f00\u542f\uff09`
            : submittedDurationLabel
        );
      }
    }

    if (flowGrowStatus === '1') {
      return {
        badgeList,
        detailText: detailLines.filter(Boolean).join('\uff1b'),
        submittable: false
      };
    } else if (flowGrowStatus === '0') {
      badgeList.push({
        label: '\u672a\u5f00\u542f',
        tone: 'neutral'
      });
    }

    if (canToGrow === '1') {
      badgeList.push({
        label: '\u53ef\u5f00\u542f',
        tone: 'accent'
      });
    } else if (canToGrow === '0') {
      badgeList.push({
        label: '\u6682\u4e0d\u53ef\u5f00\u542f',
        tone: 'warning'
      });
    }

    if (flowLimitStatus && flowLimitStatus !== '0') {
      badgeList.push({
        label: '\u89e6\u53d1\u9650\u5236',
        tone: 'warning'
      });
      detailLines.push(`\u5f53\u524d\u5546\u54c1\u5b58\u5728\u6d41\u91cf\u52a0\u901f\u9650\u5236\uff0c\u9650\u5236\u7801 ${flowLimitStatus}\uff0c\u5df2\u7b97\u4ef7SKU\u4ecd\u53ef\u5c1d\u8bd5\u63d0\u4ea4`);
    }

    if (canNotSubmitReason) {
      badgeList.push({
        label: '\u4e0d\u7b26\u5408\u63d0\u4ea4\u6761\u4ef6',
        tone: 'danger'
      });
      detailLines.push(canNotSubmitReason);
    }

    if (submitFailureMessage) {
      badgeList.push({
        label: '\u4e0a\u6b21\u63d0\u4ea4\u5931\u8d25',
        tone: 'danger'
      });
      detailLines.push(
        submitFailureSkuId
          ? `SKU ${submitFailureSkuId}\uff1a${submitFailureMessage}`
          : submitFailureMessage
      );
    }

    if (flowPriceInfoFound !== true) {
      if (flowPriceInfoLoaded === true) {
        badgeList.push({
          label: '\u672a\u8fd4\u56deSKU\u660e\u7ec6',
          tone: 'warning'
        });
      } else {
        badgeList.push({
          label: '\u7b49\u5f85SKU\u660e\u7ec6',
          tone: 'neutral'
        });
      }
    }

    if (skuList.length > 0) {
      skuList.forEach((skuItem) => {
        if (selectedLevel === 'custom') {
          const customResult = computeTrafficBoostCustomSkuResult(
            skuItem,
            resolveTrafficBoostCustomLevelStatusSettings(state)
          );

          if (customResult.status === 'ready') {
            readyCount += 1;

            if (Number.isFinite(customResult.profitRate)) {
              customProfitRateValues.push(customResult.profitRate);
            }

            if (Number.isFinite(customResult.profitValue)) {
              customProfitValueValues.push(customResult.profitValue);
            }

            if (customResult.targetPriceText && previewList.length < 3) {
              previewList.push(`SKU ${normalizeText(skuItem && skuItem.productSkuId) || '--'} ${customResult.targetPriceText}`);
            }
          } else {
            invalidCount += 1;

            if (invalidSkuReasons.length < 3) {
              invalidSkuReasons.push(
                `SKU ${normalizeText(skuItem && skuItem.productSkuId) || '--'} ${buildTrafficBoostSkuStatusReason(customResult)}`
              );
            }
          }
          return;
        }

        const priceField = resolveTrafficBoostLevelPriceField(selectedLevel);
        const targetPrice = Number(skuItem && skuItem[priceField]);

        if (Number.isFinite(targetPrice) && targetPrice > 0) {
          readyCount += 1;

          if (previewList.length < 3) {
            previewList.push(`SKU ${normalizeText(skuItem && skuItem.productSkuId) || '--'} ${formatTrafficBoostCentsPrice(targetPrice)}\u5143`);
          }
        } else {
          invalidCount += 1;

          if (invalidSkuReasons.length < 3) {
            invalidSkuReasons.push(`SKU ${normalizeText(skuItem && skuItem.productSkuId) || '--'} \u7f3a\u5c11${selectedLevelLabel}\u4ef7`);
          }
        }
      });
    }

    const submittedSkuCount = readyCount;
    const missingSubmitCount = Math.max(0, totalSkuCount - submittedSkuCount);

    if (selectedLevel === 'custom') {
      badgeList.push({
        label: '\u81ea\u5b9a\u4e49\u89c4\u5219',
        tone: 'neutral'
      });
    } else {
      badgeList.push({
        label: selectedLevelLabel,
        tone: 'neutral'
      });
    }

    if (readyCount > 0) {
      const hasBlockedSku = missingSubmitCount > 0 || invalidCount > 0;
      const skuStatusLabel = hasBlockedSku
        ? `\u5df2\u7b97\u4ef7 ${submittedSkuCount}/${Math.max(totalSkuCount, submittedSkuCount) || submittedSkuCount} SKU`
        : `${submittedSkuCount}/${Math.max(totalSkuCount, submittedSkuCount) || submittedSkuCount} SKU\u53ef\u63d0\u4ea4`;

      badgeList.push({
        label: skuStatusLabel,
        tone: hasRowBlocker
          ? 'warning'
          : (hasBlockedSku
            ? 'warning'
            : (readyCount === totalSkuCount || (totalSkuCount <= 0 && invalidCount <= 0)
              ? 'success'
              : 'warning'))
      });
    } else if (skuList.length > 0) {
      badgeList.push({
        label: '\u65e0\u53ef\u63d0\u4ea4SKU',
        tone: 'danger'
      });
    }

    let profitSummaryText = '';
    let customRuleSummaryText = '';
    if (selectedLevel === 'custom' && customProfitRateValues.length > 0 && customProfitValueValues.length > 0) {
      const minProfitRate = Math.min(...customProfitRateValues);
      const maxProfitRate = Math.max(...customProfitRateValues);
      const minProfitValue = Math.min(...customProfitValueValues);
      const maxProfitValue = Math.max(...customProfitValueValues);
      const profitRateSummary = customProfitRateValues.length === 1 || minProfitRate === maxProfitRate
        ? formatPercent(Number(minProfitRate.toFixed(2)))
        : `${formatPercent(Number(minProfitRate.toFixed(2)))} ~ ${formatPercent(Number(maxProfitRate.toFixed(2)))}`;
      const profitValueSummary = customProfitValueValues.length === 1 || minProfitValue === maxProfitValue
        ? `${formatTrafficBoostCentAmount(Math.round(minProfitValue))}\u5143`
        : `${formatTrafficBoostCentAmount(Math.round(minProfitValue))}~${formatTrafficBoostCentAmount(Math.round(maxProfitValue))}\u5143`;

      profitSummaryText = `\u5339\u914d\u540e\u5229\u6da6\u7387 ${profitRateSummary} \u00b7 \u5229\u6da6\u503c ${profitValueSummary}`;
    }

    if (selectedLevel === 'custom') {
      const customSettings = resolveTrafficBoostCustomLevelStatusSettings(state);
      customRuleSummaryText = `\u89c4\u5219 ${formatTrafficBoostCustomLevelFilterRule(customSettings)} \u00b7 \u4fdd\u5e95 ${formatTrafficBoostCustomLevelProfitFloorRule(customSettings)}`;
    }

    if (missingSubmitCount > 0) {
      detailLines.push(`\u672c\u6b21\u4ec5\u63d0\u4ea4 ${submittedSkuCount}/${totalSkuCount} \u4e2aSKU\uff0c\u672a\u7b97\u4ef7\u6216\u4e0d\u5408\u683cSKU\u4e0d\u63d0\u4ea4`);
    }

    if (profitSummaryText) {
      detailLines.unshift(profitSummaryText);
    }

    if (customRuleSummaryText) {
      detailLines.splice(profitSummaryText ? 1 : 0, 0, customRuleSummaryText);
    }

    if (previewList.length > 0) {
      detailLines.push(`\u9700\u63d0\u4ea4${selectedLevelLabel}\uff1a${previewList.join('\uff1b')}`);
    }

    if (invalidSkuReasons.length > 0) {
      detailLines.push(invalidSkuReasons.join('\uff1b'));

      if (invalidCount > invalidSkuReasons.length) {
        detailLines.push(`\u5176\u4f59 ${invalidCount - invalidSkuReasons.length} \u4e2aSKU\u4e5f\u4e0d\u6ee1\u8db3\u5f53\u524d\u89c4\u5219`);
      }
    }

    return {
      badgeList,
      detailText: detailLines.filter(Boolean).join('\uff1b'),
      submittable: hasRowBlocker !== true && readyCount > 0
    };
  }

  function renderTrafficBoostSkuPriceBlocks(row, state) {
    const skuList = Array.isArray(row && row.skuPriceInfoList)
      ? row.skuPriceInfoList
      : [];
    const selectedLevel = normalizeTrafficBoostLevel(state && state.trafficBoostLevel);
    const customSettings = selectedLevel === 'custom'
      ? resolveTrafficBoostCustomLevelStatusSettings(state)
      : null;

    if (skuList.length <= 0) {
      const productSkuIdText = normalizeText(row && row.productSkuIdText) || '--';
      const productSkuExtCodeText = normalizeText(row && row.productSkuExtCodeText);
      const warningText = normalizeText(row && row.flowPriceInfoWarning);

      return `
        <div class="ops-traffic-result-sku-empty">
          <strong class="ops-traffic-result-title" title="${escapeHtml(productSkuIdText)}">${escapeHtml(productSkuIdText)}</strong>
          ${productSkuExtCodeText ? `<span class="ops-traffic-result-subline is-clamp" title="${escapeHtml(productSkuExtCodeText)}">${escapeHtml(productSkuExtCodeText)}</span>` : ''}
          <span class="ops-traffic-result-subline">${escapeHtml(warningText || '\u6682\u65e0SKU\u660e\u7ec6')}</span>
        </div>
      `;
    }

    const skuCardsMarkup = skuList.map((skuItem) => {
      const specText = normalizeText(skuItem && skuItem.specText) || normalizeText(skuItem && skuItem.productSkuId) || '--';
      const productSkuId = normalizeText(skuItem && skuItem.productSkuId) || '--';
      const skuHeadText = productSkuId && productSkuId !== '--'
        ? `SKU ${productSkuId} | ${specText}`
        : specText;
      const customFlowSupplierPrice = Number(skuItem && skuItem.customFlowSupplierPrice);
      const customSubmitResult = selectedLevel === 'custom'
        ? computeTrafficBoostCustomSkuResult(skuItem, customSettings)
        : null;
      const finalSubmitPrice = Number(customSubmitResult && customSubmitResult.targetPrice);
      const finalSubmitPriceMarkup = customSubmitResult
        && customSubmitResult.status === 'ready'
        && Number.isFinite(finalSubmitPrice)
        && finalSubmitPrice > 0
        ? `<span class="ops-traffic-result-sku-price-item is-submit">${escapeHtml(formatTrafficBoostPriceLabel('\u81ea\u5b9a\u4e49\u4ef7', finalSubmitPrice))}</span>`
        : '';
      const shouldShowCurrentCustomPrice = selectedLevel !== 'custom'
        && Number.isFinite(customFlowSupplierPrice)
        && customFlowSupplierPrice > 0;
      const costPrice = normalizeText(skuItem && skuItem.costPrice);
      const originalPriceLabel = formatTrafficBoostPriceLabel('\u539f\u4ef7', skuItem && skuItem.supplierPrice);

      return `
        <div class="ops-traffic-result-sku-card">
          <div class="ops-traffic-result-sku-card-head">
            <div class="ops-traffic-result-sku-spec-line">
              <strong class="ops-traffic-result-sku-spec" title="${escapeHtml(skuHeadText)}">${escapeHtml(skuHeadText)}</strong>
              <span class="ops-traffic-result-sku-price-inline">${escapeHtml(originalPriceLabel)}</span>
              ${costPrice ? `<span class="ops-traffic-result-sku-cost-inline">${escapeHtml(`\u6210\u672c ${costPrice}\u5143`)}</span>` : ''}
            </div>
          </div>
          <div class="ops-traffic-result-sku-price-list">
            <span class="ops-traffic-result-sku-price-item">${escapeHtml(formatTrafficBoostPriceLabel('\u666e\u901a', skuItem && skuItem.ordinaryFlowSupplierPrice))}</span>
            <span class="ops-traffic-result-sku-price-item">${escapeHtml(formatTrafficBoostPriceLabel('\u9ad8\u7ea7', skuItem && skuItem.premiumFlowSupplierPrice))}</span>
            <span class="ops-traffic-result-sku-price-item is-accent">${escapeHtml(formatTrafficBoostPriceLabel('\u8d85\u7ea7', skuItem && skuItem.superFlowSupplierPrice))}</span>
            ${finalSubmitPriceMarkup}
            ${shouldShowCurrentCustomPrice
              ? `<span class="ops-traffic-result-sku-price-item is-custom">${escapeHtml(formatTrafficBoostPriceLabel('\u81ea\u5b9a\u4e49', customFlowSupplierPrice))}</span>`
              : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ops-traffic-result-sku-list">
        ${skuCardsMarkup}
      </div>
    `;
  }

  function parseTrafficBoostPromotionSummaryEntries(summaryText) {
    return normalizeText(summaryText)
      .split(/\s*;\s*/)
      .map((segment) => {
        const normalizedSegment = normalizeText(segment);

        if (!normalizedSegment) {
          return null;
        }

        const separatorIndex = normalizedSegment.indexOf(':');

        if (separatorIndex < 0) {
          return {
            label: normalizedSegment,
            detailText: ''
          };
        }

        return {
          label: normalizeText(normalizedSegment.slice(0, separatorIndex)),
          detailText: normalizeText(normalizedSegment.slice(separatorIndex + 1))
        };
      })
      .filter((entry) => entry && entry.label);
  }

  function buildTrafficBoostActivityTooltipText(label, detailText, count) {
    const normalizedLabel = normalizeText(label);
    const normalizedDetailText = normalizeText(detailText);
    const detailLineList = normalizedDetailText
      ? normalizedDetailText
        .split(/\s+\|\s+/)
        .map((line) => normalizeText(line))
        .filter(Boolean)
      : [];
    const countText = Math.max(0, Number.parseInt(count, 10) || 0) > 0
      ? `\u5171 ${Math.max(0, Number.parseInt(count, 10) || 0)} \u4e2a\u6d3b\u52a8`
      : '';

    return [normalizedLabel, countText].concat(detailLineList).filter(Boolean).join('\n');
  }

  function buildTrafficBoostActivityDisplay(row) {
    const promotionItemCount = Math.max(
      0,
      Number.parseInt(row && row.promotionItemCount, 10)
      || Number.parseInt(row && row.promotionCount, 10)
      || 0
    );
    const promotionTypeCount = Math.max(0, Number.parseInt(row && row.promotionTypeCount, 10) || 0);
    const promotionTypeSummaryText = normalizeText(row && row.promotionTypeSummaryText);
    const promotionDetailText = normalizeText(row && row.promotionDetailText);
    const promotionSummaryText = normalizeText(row && row.promotionSummaryText);
    const promotionSummaryEntryList = parseTrafficBoostPromotionSummaryEntries(promotionSummaryText);
    const promotionSummaryEntryMap = new Map();

    promotionSummaryEntryList.forEach((entry) => {
      if (!promotionSummaryEntryMap.has(entry.label)) {
        promotionSummaryEntryMap.set(entry.label, entry.detailText);
      }
    });

    let tagList = (Array.isArray(row && row.promotionTypeTags) ? row.promotionTypeTags : [])
      .map((tag) => {
        const label = normalizeText(tag && tag.label);
        const count = Math.max(0, Number.parseInt(tag && tag.count, 10) || 0);

        if (!label) {
          return null;
        }

        return {
          label,
          count,
          detailText: normalizeText(tag && tag.detailText) || normalizeText(promotionSummaryEntryMap.get(label))
        };
      })
      .filter(Boolean);

    if (tagList.length <= 0 && promotionSummaryEntryList.length > 0) {
      tagList = promotionSummaryEntryList.map((entry) => ({
        label: entry.label,
        count: 0,
        detailText: entry.detailText
      }));
    }

    if (tagList.length <= 0 && promotionTypeSummaryText) {
      tagList = promotionTypeSummaryText
        .split('|')
        .map((segment) => normalizeText(segment))
        .filter(Boolean)
        .map((segment) => {
          const matchedCount = segment.match(/\s+(\d+)$/);
          const count = matchedCount ? Math.max(0, Number.parseInt(matchedCount[1], 10) || 0) : 0;
          const label = normalizeText(segment.replace(/\s+\d+$/, ''));

          if (!label) {
            return null;
          }

          return {
            label,
            count,
            detailText: normalizeText(promotionSummaryEntryMap.get(label))
          };
        })
        .filter(Boolean);
    }

    if (tagList.length > 8) {
      tagList = tagList.slice(0, 8);
    }

    const fallbackTooltipText = buildTrafficBoostActivityTooltipText(
      '\u6d3b\u52a8\u8be6\u60c5',
      promotionDetailText || promotionSummaryText || promotionTypeSummaryText,
      promotionItemCount
    );
    const helperText = [
      promotionItemCount > 0 ? `\u5171 ${promotionItemCount} \u4e2a\u6d3b\u52a8` : '',
      tagList.length > 0 ? '\u60ac\u505c\u6807\u7b7e\u67e5\u770b\u8be6\u60c5' : ''
    ].filter(Boolean).join(' \u00b7 ');

    return {
      hasActivity: promotionItemCount > 0 || promotionTypeCount > 0 || tagList.length > 0 || Boolean(fallbackTooltipText),
      helperText,
      tagList,
      fallbackTooltipText
    };
  }

  function formatQueryProgressText(progress) {
    const normalizedProgress = normalizeQueryProgressPayload(progress);

    if (!normalizedProgress) {
      return '';
    }

    const shopText = normalizeText(normalizedProgress.currentShopName)
      || normalizeText(normalizedProgress.shopName)
      || normalizeText(normalizedProgress.currentShopId)
      || normalizeText(normalizedProgress.shopId);
    const prefix = shopText ? `${shopText} ` : '';
    const pageText = normalizedProgress.pageNum > 0
      ? `\u7b2c ${normalizedProgress.pageNum}/${Math.max(1, normalizedProgress.totalPages || 1)} \u9875`
      : '';
    const pageCountParts = [];

    if (normalizedProgress.fetchedItemCount > 0 || normalizedProgress.phase === 'page-completed') {
      pageCountParts.push(`\u672c\u9875 ${normalizedProgress.fetchedItemCount} \u6761`);
    }

    if (normalizedProgress.accumulatedItemCount > 0 || normalizedProgress.estimatedTotal > 0) {
      pageCountParts.push(
        `\u5f53\u524d\u5e97\u94fa ${normalizedProgress.accumulatedItemCount}${normalizedProgress.estimatedTotal > 0 ? `/${normalizedProgress.estimatedTotal}` : ''} \u6761`
      );
    }

    if (normalizedProgress.rowCount > 0) {
      pageCountParts.push(`\u603b\u7d2f\u8ba1 ${normalizedProgress.rowCount} \u6761`);
    }

    const pageCountText = pageCountParts.join('\uff0c');

    if (normalizedProgress.phase === 'preparing') {
      return normalizedProgress.message || '\u6b63\u5728\u51c6\u5907\u67e5\u8be2...';
    }

    if (normalizedProgress.phase === 'starting') {
      return normalizedProgress.message || `${prefix}\u6b63\u5728\u53d1\u8d77\u67e5\u8be2...`;
    }

    if (normalizedProgress.phase === 'warming-session') {
      return normalizedProgress.message || `${prefix}\u6b63\u5728\u68c0\u67e5\u767b\u5f55\u4f1a\u8bdd...`;
    }

    if (normalizedProgress.phase === 'requesting') {
      return normalizedProgress.message || `${prefix}\u6b63\u5728\u53d1\u8d77\u8bf7\u6c42...`;
    }

    if (normalizedProgress.phase === 'request-completed') {
      return normalizedProgress.message || `${prefix}\u8bf7\u6c42\u5df2\u5b8c\u6210`;
    }

    if (normalizedProgress.phase === 'request-failed') {
      return normalizedProgress.message || `${prefix}\u8bf7\u6c42\u5931\u8d25`;
    }

    if (normalizedProgress.phase === 'querying') {
      return [prefix ? `${prefix}\u6b63\u5728\u67e5\u8be2` : '\u6b63\u5728\u67e5\u8be2', pageText, pageCountText]
        .filter(Boolean)
        .join('\uff0c');
    }

    if (normalizedProgress.phase === 'page-completed') {
      return [prefix ? `${prefix}\u5df2\u5b8c\u6210\u67e5\u8be2` : '\u5df2\u5b8c\u6210\u5f53\u524d\u9875\u67e5\u8be2', pageText, pageCountText]
        .filter(Boolean)
        .join('\uff0c');
    }

    if (normalizedProgress.phase === 'canceling') {
      return [normalizedProgress.message || (prefix ? `${prefix}\u6b63\u5728\u505c\u6b62\u67e5\u8be2` : '\u6b63\u5728\u505c\u6b62\u67e5\u8be2'), pageCountText]
        .filter(Boolean)
        .join('\uff0c');
    }

    if (normalizedProgress.phase === 'canceled') {
      return [normalizedProgress.message || '\u67e5\u8be2\u5df2\u505c\u6b62', pageCountText]
        .filter(Boolean)
        .join('\uff0c');
    }

    if (normalizedProgress.phase === 'failed') {
      return [normalizedProgress.message || '\u67e5\u8be2\u5931\u8d25', pageCountText]
        .filter(Boolean)
        .join('\uff0c');
    }

    if (normalizedProgress.phase === 'completed') {
      return [normalizedProgress.message || '\u67e5\u8be2\u5b8c\u6210', pageCountText || `\u603b\u7d2f\u8ba1 ${normalizedProgress.rowCount} \u6761`]
        .filter(Boolean)
        .join('\uff0c');
    }

    return normalizedProgress.message;
  }

  function formatTrafficBoostSubmitProgressText(progress) {
    const normalizedProgress = normalizeQueryProgressPayload(progress);

    if (!normalizedProgress) {
      return '';
    }

    const shopText = normalizeText(normalizedProgress.currentShopName)
      || normalizeText(normalizedProgress.shopName)
      || normalizeText(normalizedProgress.currentShopId)
      || normalizeText(normalizedProgress.shopId);
    const currentShopIndex = Math.max(0, Number(normalizedProgress.currentShopIndex) || 0);
    const totalShops = Math.max(0, Number(normalizedProgress.totalShops) || 0);
    const currentBatchIndex = Math.max(0, Number(normalizedProgress.pageNum) || 0);
    const totalBatches = Math.max(0, Number(normalizedProgress.totalPages) || 0);
    const totalProductCount = Math.max(0, Number(normalizedProgress.totalProductCount) || 0);
    const successItemCount = Math.max(0, Number(normalizedProgress.successItemCount) || 0);
    const failedItemCount = Math.max(0, Number(normalizedProgress.failedItemCount) || 0);
    const currentShopSuccessCount = Math.max(0, Number(normalizedProgress.currentShopSuccessCount) || 0);
    const currentShopFailedCount = Math.max(0, Number(normalizedProgress.currentShopFailedCount) || 0);
    const currentShopTotalCount = Math.max(0, Number(normalizedProgress.currentShopTotalCount) || 0);
    const currentBatchSuccessCount = Math.max(0, Number(normalizedProgress.currentBatchSuccessCount) || 0);
    const currentBatchFailedCount = Math.max(0, Number(normalizedProgress.currentBatchFailedCount) || 0);
    const currentShopProcessedCount = Math.max(
      currentShopSuccessCount + currentShopFailedCount,
      Math.max(0, Number(normalizedProgress.accumulatedItemCount) || 0)
    );
    const batchSize = Math.max(0, Number(normalizedProgress.fetchedItemCount) || 0);
    const prefixParts = [];
    const detailParts = [];

    if (shopText) {
      prefixParts.push(shopText);
    }

    if (currentShopIndex > 0 && totalShops > 0) {
      prefixParts.push(`\u5e97\u94fa ${currentShopIndex}/${totalShops}`);
    } else if (totalShops > 0) {
      prefixParts.push(`\u5171 ${totalShops} \u5bb6\u5e97\u94fa`);
    }

    if (currentBatchIndex > 0 && totalBatches > 0) {
      prefixParts.push(`\u6279\u6b21 ${currentBatchIndex}/${totalBatches}`);
    }

    if (batchSize > 0) {
      detailParts.push(`\u672c\u6279 ${batchSize} \u4e2a`);
    }

    if (currentBatchSuccessCount > 0 || currentBatchFailedCount > 0) {
      detailParts.push(`\u672c\u6279\u6210\u529f ${currentBatchSuccessCount} \u4e2a`);
      if (currentBatchFailedCount > 0) {
        detailParts.push(`\u672c\u6279\u5931\u8d25 ${currentBatchFailedCount} \u4e2a`);
      }
    }

    if (currentShopProcessedCount > 0 || currentShopTotalCount > 0) {
      detailParts.push(
        `\u5f53\u524d\u5e97\u94fa ${currentShopProcessedCount}${currentShopTotalCount > 0 ? `/${currentShopTotalCount}` : ''} \u4e2a`
      );
    }

    if (successItemCount > 0 || failedItemCount > 0 || totalProductCount > 0) {
      detailParts.push(`\u7d2f\u8ba1\u6210\u529f ${successItemCount} \u4e2a`);
      if (failedItemCount > 0) {
        detailParts.push(`\u7d2f\u8ba1\u5931\u8d25 ${failedItemCount} \u4e2a`);
      }
      if (totalProductCount > 0) {
        detailParts.push(`\u603b\u5546\u54c1 ${totalProductCount} \u4e2a`);
      }
    }

    const fallbackText = [prefixParts.join('\uff0c'), detailParts.join('\uff0c')].filter(Boolean).join('\uff1b');

    if (normalizedProgress.phase === 'preparing') {
      return normalizedProgress.message || '\u6b63\u5728\u51c6\u5907\u63d0\u4ea4...';
    }

    if (normalizedProgress.phase === 'starting') {
      return normalizedProgress.message || [prefixParts.join('，'), detailParts.join('，')].filter(Boolean).join('；') || '\u6b63\u5728\u51c6\u5907\u63d0\u4ea4...';
    }

    if (normalizedProgress.phase === 'warming-session') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u6b63\u5728\u68c0\u67e5\u767b\u5f55\u4f1a\u8bdd'].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'requesting') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u6b63\u5728\u53d1\u8d77\u63d0\u4ea4\u8bf7\u6c42', detailParts.join('，')].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'request-completed') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u63d0\u4ea4\u8bf7\u6c42\u5df2\u5b8c\u6210', detailParts.join('，')].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'request-failed') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u63d0\u4ea4\u8bf7\u6c42\u5931\u8d25', detailParts.join('，')].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'querying') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u6b63\u5728\u63d0\u4ea4', detailParts.join('，')].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'page-completed') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u5f53\u524d\u6279\u63d0\u4ea4\u5b8c\u6210', detailParts.join('，')].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'canceling') {
      return normalizedProgress.message || [prefixParts.join('，'), '\u6b63\u5728\u7b49\u5f85\u5f53\u524d\u6279\u63d0\u4ea4\u5b8c\u6210\u540e\u505c\u6b62', detailParts.join('，')].filter(Boolean).join('；');
    }

    if (normalizedProgress.phase === 'canceled') {
      return normalizedProgress.message || '\u6279\u91cf\u63d0\u4ea4\u5df2\u505c\u6b62';
    }

    if (normalizedProgress.phase === 'failed') {
      return normalizedProgress.message || '\u6279\u91cf\u63d0\u4ea4\u5931\u8d25';
    }

    if (normalizedProgress.phase === 'completed') {
      return normalizedProgress.message || fallbackText || '\u6279\u91cf\u63d0\u4ea4\u5b8c\u6210';
    }

    return normalizedProgress.message || fallbackText;
  }

  function getOperationsSharedCatalog() {
    if (
      window.operationsSharedCatalog
      && typeof window.operationsSharedCatalog === 'object'
    ) {
      return window.operationsSharedCatalog;
    }

    return null;
  }

  function getStationOptions() {
    const catalog = getOperationsSharedCatalog();

    return Array.isArray(catalog && catalog.STATION_OPTIONS)
      ? catalog.STATION_OPTIONS
      : [];
  }

  function getStationLabelByValue(value) {
    const catalog = getOperationsSharedCatalog();

    if (catalog && typeof catalog.getStationLabelByValue === 'function') {
      return catalog.getStationLabelByValue(value);
    }

    const normalizedValue = normalizeText(value);
    const matchedOption = getStationOptions()
      .find((option) => normalizeText(option && option.value) === normalizedValue);

    return normalizeText(matchedOption && matchedOption.label);
  }

  function resolveStationMarketRegion(stationId) {
    const catalog = getOperationsSharedCatalog();

    if (catalog && typeof catalog.getStationMarketRegionByValue === 'function') {
      return normalizeText(catalog.getStationMarketRegionByValue(stationId)) || 'global';
    }

    return 'global';
  }

  function getMarketStationOptions(marketRegion) {
    const normalizedMarketRegion = normalizeMarketRegion(marketRegion);

    return getStationOptions().filter(
      (option) => resolveStationMarketRegion(option && option.value) === normalizedMarketRegion
    );
  }

  function filterStationIdsByMarketRegion(stationIds, marketRegion) {
    const allowedStationIdSet = new Set(
      getMarketStationOptions(marketRegion)
        .map((option) => normalizeText(option && option.value))
        .filter(Boolean)
    );

    return normalizeSelectedStationIds(stationIds)
      .filter((stationId) => allowedStationIdSet.has(stationId));
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

  function createShopSelectionPresetState() {
    const helper = getShopSelectionTemplateHelper();

    if (helper && typeof helper.createState === 'function') {
      return helper.createState(SHOP_SELECTION_SCOPE_KEY);
    }

    return {
      scopeKey: SHOP_SELECTION_SCOPE_KEY,
      templates: [],
      lastSelection: {
        scopeKey: SHOP_SELECTION_SCOPE_KEY,
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

  function normalizeSelectedStationIds(stationIds) {
    return Array.from(new Set(
      (Array.isArray(stationIds) ? stationIds : [])
        .map((stationId) => normalizeText(stationId))
        .filter(Boolean)
    ));
  }

  function createState() {
    return {
      activeTabId: DEFAULT_TAB_ID,
      shopCatalog: buildEmptyShopCatalog(),
      selectedShopIds: [],
      shopSelectorOpen: false,
      shopSelectorKeyword: '',
      shopSelectorFocusSearch: false,
      shopSelectorLoading: false,
      shopSelectorLoaded: false,
      shopSelectorError: '',
      shopSelectorPromise: null,
      shopSelectionPreset: createShopSelectionPresetState(),
      shopSelectionTouched: false,
      marketRegion: 'us',
      stationIds: Array.from(DEFAULT_STATION_IDS),
      stationSelectorOpen: false,
      categorySnapshot: buildEmptyCategorySnapshot(),
      categorySelectedPath: [],
      categoryCheckedPaths: [],
      categoryColumns: [],
      categoryRootLoading: false,
      categoryRootLoaded: false,
      categoryRootError: '',
      categoryRootPromise: null,
      categoryChildCache: Object.create(null),
      categoryChildLoadingKey: '',
      categoryChildErrorKey: '',
      categoryChildError: '',
      categorySelectorOpen: false,
      categorySearchKeyword: '',
      categorySearchResults: [],
      categorySearchLoading: false,
      categorySearchError: '',
      categorySearchTotal: 0,
      categorySearchTimer: 0,
      categorySearchRequestId: 0,
      categorySearchFocusInput: false,
      productIdType: PRODUCT_ID_TYPE_OPTIONS[0].value,
      productIdKeywords: '',
      productName: '',
      trafficBoostDuration: TRAFFIC_BOOST_DURATION_OPTIONS[0].value,
      trafficBoostLevel: TRAFFIC_BOOST_LEVEL_OPTIONS[0].value,
      trafficBoostAutoRenew: false,
      trafficProductMetricType: TRAFFIC_PRODUCT_METRIC_OPTIONS[0].value,
      trafficProductMinValue: '',
      trafficProductMaxValue: '',
      trafficPaymentMetricType: TRAFFIC_PAYMENT_METRIC_OPTIONS[0].value,
      trafficPaymentMinValue: '',
      trafficPaymentMaxValue: '',
      trafficConversionMetricType: TRAFFIC_CONVERSION_METRIC_OPTIONS[0].value,
      trafficConversionMinValue: '',
      trafficConversionMaxValue: '',
      joinedStartDate: '',
      joinedEndDate: '',
      joinedDatePickerOpen: false,
      joinedDraftStartDate: '',
      joinedDraftEndDate: '',
      queryRunId: '',
      queryLoading: false,
      queryCanceling: false,
      queryProgress: null,
      queryTraceEntries: [],
      queryError: '',
      queryWarning: '',
      submitLoading: false,
      submitRequestId: '',
      submitCanceling: false,
      submitError: '',
      submitWarning: '',
      submitNotice: '',
      submitPrecheckSummary: null,
      submitFailProducts: [],
      submitScopeSummary: {
        eligibleRowCount: 0,
        eligibleShopCount: 0,
        eligibleProductCount: 0,
        readyProductCount: 0,
        readyShopCount: 0
      },
      queryResultMeta: null,
      resultRows: [],
      quickCostDialogOpen: false,
      quickCostDialogLoading: false,
      quickCostDialogSaving: false,
      quickCostDialogError: '',
      quickCostDialogWarning: '',
      quickCostDialogNotice: '',
      quickCostDialogEntries: [],
      quickCostDialogShopCount: 0,
      quickCostDialogSourceEntryCount: 0,
      quickCostDialogMergedEntryCount: 0,
      quickCostDialogConflictCount: 0,
      customLevelFilterDialogOpen: false,
      customLevelFilterDialogError: '',
      customLevelFilterDialogWarning: '',
      customLevelFilterDialogNotice: '',
      customLevelFilterSettingsLoaded: false,
      customLevelFilterSettingsLoading: false,
      customLevelFilterSettingsSaving: false,
      customLevelFilterSettingsPromise: null,
      customLevelFilterSettingsSavePromise: null,
      customLevelFilterSettingsSaveQueued: false,
      customLevelFilterSettings: normalizeTrafficBoostCustomLevelFilterSettings(
        buildEmptyTrafficBoostCustomLevelFilterSettings()
      ),
      customLevelFilterAppliedSettings: normalizeTrafficBoostCustomLevelFilterSettings(
        buildEmptyTrafficBoostCustomLevelFilterSettings()
      ),
      customLevelFilterSettingsDirty: false,
      resultViewportScrollTop: 0,
      resultViewportScrollLeft: 0,
      removeQueryProgressListener: null
    };
  }

  function getState(container) {
    if (!container.__operationsTrafficBoostState) {
      container.__operationsTrafficBoostState = createState();
    }

    return container.__operationsTrafficBoostState;
  }

  function normalizePresetShopSelection(state, selectedShopIds) {
    const normalizedSelectedShopIds = normalizeSelectedShopIds(selectedShopIds);

    if (state.shopSelectorLoaded !== true || !state.shopCatalog || !state.shopCatalog.shopMap) {
      return normalizedSelectedShopIds;
    }

    return normalizedSelectedShopIds.filter((shopId) => Boolean(state.shopCatalog.shopMap[shopId]));
  }

  function renderOptions(options, selectedValue, placeholder, config = {}) {
    const normalizedSelectedValue = normalizeText(selectedValue);
    const includeEmpty = config.includeEmpty !== false;
    const optionList = Array.isArray(options) ? options : [];
    const renderedOptions = [];

    if (includeEmpty) {
      renderedOptions.push(`
        <option value="">${escapeHtml(placeholder || '\u8bf7\u9009\u62e9')}</option>
      `);
    }

    optionList.forEach((option) => {
      const optionValue = normalizeText(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;

      renderedOptions.push(`
        <option value="${escapeHtml(optionValue)}"${optionValue === normalizedSelectedValue ? ' selected' : ''}>
          ${escapeHtml(optionLabel)}
        </option>
      `);
    });

    return renderedOptions.join('');
  }

  function renderShopSelectorField(state) {
    const control = getShopMultiSelectControl();
    const selectedShopIds = normalizeSelectedShopIds(state.selectedShopIds);
    const fieldMarkup =
      control && typeof control.render === 'function'
        ? control.render({
          catalog: state.shopCatalog,
          selectedShopIds,
          keyword: state.shopSelectorKeyword,
          open: state.shopSelectorOpen,
          compact: true,
          loading: state.shopSelectorLoading,
          error: state.shopSelectorError,
          shopSelectionPresets: buildShopSelectionPresetConfig(state.shopSelectionPreset),
          disabled: state.shopSelectorLoading !== true
            && state.shopSelectorLoaded === true
            && state.shopCatalog.shops.length <= 0
        })
        : `
          <button class="shop-multi-select-trigger" type="button" disabled>
            <span class="shop-multi-select-trigger-copy">
              <span class="shop-multi-select-trigger-value">\u5e97\u94fa\u7b5b\u9009\u63a7\u4ef6\u672a\u52a0\u8f7d</span>
            </span>
          </button>
        `;

    return `
      <label class="ops-traffic-field ops-traffic-field-shop">
        <span class="ops-traffic-field-label">\u5e97\u94fa</span>
        <span class="ops-traffic-field-content">
          ${fieldMarkup}
          ${state.shopSelectorError ? `<span class="ops-traffic-field-note is-error">${escapeHtml(state.shopSelectorError)}</span>` : ''}
        </span>
      </label>
    `;
  }

  function renderSelectedStationText(stationIds) {
    const selectedStationIds = normalizeSelectedStationIds(stationIds);

    if (selectedStationIds.length <= 0) {
      return '\u8bf7\u9009\u62e9';
    }

    if (selectedStationIds.length === 1) {
      return getStationLabelByValue(selectedStationIds[0]) || selectedStationIds[0];
    }

    return `\u5df2\u9009 ${selectedStationIds.length} \u4e2a\u7ad9\u70b9`;
  }

  function renderStationSelectorField(state) {
    const marketRegion = normalizeMarketRegion(state && state.marketRegion);
    const stationOptions = getMarketStationOptions(marketRegion);
    const selectedStationIds = filterStationIdsByMarketRegion(state && state.stationIds, marketRegion);
    const selectedStationSet = new Set(selectedStationIds);

    if (state && state.stationIds !== selectedStationIds) {
      state.stationIds = selectedStationIds;
    }

    return `
      <label class="ops-traffic-field ops-traffic-field-station">
        <span class="ops-traffic-field-label">\u7ad9\u70b9</span>
        <span class="ops-traffic-field-content">
          <div class="ops-traffic-station-select" data-ops-traffic-station-select>
            <button
              class="ops-traffic-station-trigger${state.stationSelectorOpen === true ? ' is-open' : ''}"
              type="button"
              data-ops-traffic-station-toggle="true"
            >
              <span>${escapeHtml(renderSelectedStationText(selectedStationIds))}</span>
              <span class="ops-traffic-station-arrow" aria-hidden="true">\u25be</span>
            </button>
            ${state.stationSelectorOpen === true ? `
              <div class="ops-traffic-station-panel">
                <div class="ops-traffic-station-toolbar">
                  <button
                    class="ops-traffic-station-action"
                    type="button"
                    data-ops-traffic-station-action="select-all"
                  >
                    \u5168\u9009
                  </button>
                  <button
                    class="ops-traffic-station-action"
                    type="button"
                    data-ops-traffic-station-action="clear"
                  >
                    \u6e05\u7a7a
                  </button>
                  <span class="ops-traffic-station-count">\u5df2\u9009 ${escapeHtml(String(selectedStationIds.length))}</span>
                </div>
                <div class="ops-traffic-station-list">
                  ${stationOptions.map((option) => `
                    <label class="ops-traffic-station-item">
                      <input
                        type="checkbox"
                        data-ops-traffic-station-option="${escapeHtml(option.value)}"
                        ${selectedStationSet.has(normalizeText(option.value)) ? ' checked' : ''}
                      />
                      <span>${escapeHtml(option.label)}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </span>
      </label>
    `;
  }

  function renderMarketRegionField(state) {
    const marketRegion = normalizeMarketRegion(state && state.marketRegion);

    if (state && state.marketRegion !== marketRegion) {
      state.marketRegion = marketRegion;
    }

    return `
      <label class="ops-traffic-field ops-traffic-field-market">
        <span class="ops-traffic-field-label">\u5e02\u573a</span>
        <span class="ops-traffic-field-content">
          <select class="ops-traffic-control" data-ops-traffic-field="marketRegion">
            ${renderOptions(MARKET_REGION_OPTIONS, marketRegion, '', {
              includeEmpty: false
            })}
          </select>
        </span>
      </label>
    `;
  }

  function renderCategorySelectorField(state) {
    const control = getCategoryCascadeControl();
    const snapshot = normalizeCategorySnapshot(state.categorySnapshot);
    const fieldMarkup =
      control && typeof control.render === 'function'
        ? control.render({
          snapshot,
          selectedPath: state.categorySelectedPath,
          checkedPaths: state.categoryCheckedPaths,
          columns: state.categoryColumns,
          open: state.categorySelectorOpen,
          compact: true,
          placeholder: '\u9009\u62e9\u7c7b\u76ee',
          triggerSelectionMode: 'count',
          loadingRoots: state.categoryRootLoading,
          multipleSelection: true,
          showSearch: true,
          searchKeyword: state.categorySearchKeyword,
          searchResults: state.categorySearchResults,
          searchLoading: state.categorySearchLoading,
          searchErrorText: state.categorySearchError,
          searchTotal: state.categorySearchTotal,
          hideTriggerMeta: true,
          showSyncRootAction: false,
          showToolbarMeta: false,
          showHelperText: false,
          errorText: state.categoryRootError,
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
      <label class="ops-traffic-field ops-traffic-field-category">
        <span class="ops-traffic-field-label">\u7c7b\u76ee</span>
        <span class="ops-traffic-field-content">
          ${fieldMarkup}
        </span>
      </label>
    `;
  }

  function renderProductIdField(state) {
    return `
      <label class="ops-traffic-field ops-traffic-field-product-id">
        <span class="ops-traffic-field-label">\u5546\u54c1ID\u67e5\u8be2</span>
        <span class="ops-traffic-field-content">
          <span class="ops-traffic-combo-control">
            <select class="ops-traffic-control" data-ops-traffic-field="productIdType">
              ${renderOptions(PRODUCT_ID_TYPE_OPTIONS, state.productIdType, '', {
                includeEmpty: false
              })}
            </select>
            <input
              class="ops-traffic-control"
              type="text"
              value="${escapeHtml(state.productIdKeywords)}"
              placeholder="\u591a\u4e2a\u67e5\u8be2\u8bf7\u7a7a\u683c\u6216\u9017\u53f7\u4f9d\u6b21\u8f93\u5165"
              data-ops-traffic-field="productIdKeywords"
            />
          </span>
        </span>
      </label>
    `;
  }

  function renderProductNameField(state) {
    return `
      <label class="ops-traffic-field ops-traffic-field-product-name">
        <span class="ops-traffic-field-label">\u5546\u54c1\u540d\u79f0</span>
        <span class="ops-traffic-field-content">
          <input
            class="ops-traffic-control"
            type="text"
            value="${escapeHtml(state.productName)}"
            placeholder="\u8bf7\u8f93\u5165"
            data-ops-traffic-field="productName"
          />
        </span>
      </label>
    `;
  }

  function normalizeTrafficMetricType(fieldName, value) {
    const normalizedFieldName = normalizeText(fieldName);
    const normalizedValue = normalizeText(value);
    const metricOptionMap = {
      trafficProductMetricType: TRAFFIC_PRODUCT_METRIC_OPTIONS,
      trafficPaymentMetricType: TRAFFIC_PAYMENT_METRIC_OPTIONS,
      trafficConversionMetricType: TRAFFIC_CONVERSION_METRIC_OPTIONS
    };
    const options = metricOptionMap[normalizedFieldName] || [];

    return options.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : normalizeText(options[0] && options[0].value);
  }

  function applyTrafficFieldValue(state, fieldName, value) {
    const normalizedFieldName = normalizeText(fieldName);

    if (!normalizedFieldName) {
      return false;
    }

    if (normalizedFieldName === 'marketRegion') {
      const nextMarketRegion = normalizeMarketRegion(value);
      const filteredStationIds = filterStationIdsByMarketRegion(state.stationIds, nextMarketRegion);

      state.marketRegion = nextMarketRegion;
      state.stationIds = filteredStationIds.length > 0
        ? filteredStationIds
        : (nextMarketRegion === 'us' ? Array.from(DEFAULT_STATION_IDS) : []);
      return true;
    }

    if (normalizedFieldName === 'productIdType') {
      state.productIdType = normalizeProductIdType(value);
      return true;
    }

    if (normalizedFieldName === 'trafficBoostDuration') {
      state.trafficBoostDuration = normalizeTrafficBoostDuration(value);

      if (!shouldShowTrafficBoostAutoRenew(state.trafficBoostDuration)) {
        state.trafficBoostAutoRenew = false;
      }

      return true;
    }

    if (normalizedFieldName === 'trafficBoostLevel') {
      state.trafficBoostLevel = normalizeTrafficBoostLevel(value);
      return true;
    }

    if (
      normalizedFieldName === 'productIdKeywords'
      || normalizedFieldName === 'productName'
      || normalizedFieldName === 'trafficProductMinValue'
      || normalizedFieldName === 'trafficProductMaxValue'
      || normalizedFieldName === 'trafficPaymentMinValue'
      || normalizedFieldName === 'trafficPaymentMaxValue'
      || normalizedFieldName === 'trafficConversionMinValue'
      || normalizedFieldName === 'trafficConversionMaxValue'
    ) {
      state[normalizedFieldName] = String(value == null ? '' : value);
      return true;
    }

    if (
      normalizedFieldName === 'trafficProductMetricType'
      || normalizedFieldName === 'trafficPaymentMetricType'
      || normalizedFieldName === 'trafficConversionMetricType'
    ) {
      state[normalizedFieldName] = normalizeTrafficMetricType(normalizedFieldName, value);
      return true;
    }

    if (normalizedFieldName === 'joinedDraftStartDate') {
      state.joinedDraftStartDate = normalizeDateInputValue(value) || String(value == null ? '' : value);
      return true;
    }

    if (normalizedFieldName === 'joinedDraftEndDate') {
      state.joinedDraftEndDate = normalizeDateInputValue(value) || String(value == null ? '' : value);
      return true;
    }

    return false;
  }

  function updateTrafficBoostCustomLevelFilterSetting(container, fieldName, value) {
    const state = getState(container);

    syncTrafficBoostCustomLevelFilterSettingsState(
      state,
      updateTrafficBoostCustomLevelFilterSettingsDraft(
        state.customLevelFilterSettings,
        fieldName,
        value
      )
    );
    state.customLevelFilterDialogError = '';
    state.customLevelFilterDialogWarning = '';
    state.customLevelFilterDialogNotice = '';
    render(container);
  }

  function renderTrafficMetricField(config) {
    const fieldName = normalizeText(config && config.fieldName);
    const label = normalizeText(config && config.label);
    const options = Array.isArray(config && config.options) ? config.options : [];
    const selectValue = normalizeText(config && config.selectValue);
    const minValue = normalizeText(config && config.minValue);
    const maxValue = normalizeText(config && config.maxValue);
    const minFieldName = normalizeText(config && config.minFieldName);
    const maxFieldName = normalizeText(config && config.maxFieldName);
    const step = normalizeText(config && config.step) || '1';
    const unitLabel = normalizeText(config && config.unitLabel);

    if (!fieldName || !label || options.length <= 0) {
      return '';
    }

    return `
      <label class="ops-traffic-field ops-traffic-field-metric ops-traffic-field-${escapeHtml(fieldName)}">
        <span class="ops-traffic-field-label">${escapeHtml(label)}</span>
        <span class="ops-traffic-field-content">
          <span class="ops-traffic-metric-shell">
            <select
              class="ops-traffic-control ops-traffic-metric-select"
              data-ops-traffic-field="${escapeHtml(fieldName)}"
            >
              ${renderOptions(options, selectValue, '', {
                includeEmpty: false
              })}
            </select>
            <span class="ops-traffic-metric-range">
              <input
                class="ops-traffic-control"
                type="number"
                min="0"
                step="${escapeHtml(step)}"
                value="${escapeHtml(minValue)}"
                placeholder="\u6700\u5c0f\u503c"
                data-ops-traffic-field="${escapeHtml(minFieldName)}"
              />
              <span class="ops-traffic-metric-separator">~</span>
              <input
                class="ops-traffic-control"
                type="number"
                min="0"
                step="${escapeHtml(step)}"
                value="${escapeHtml(maxValue)}"
                placeholder="\u6700\u5927\u503c"
                data-ops-traffic-field="${escapeHtml(maxFieldName)}"
              />
            </span>
            ${unitLabel ? `<span class="ops-traffic-metric-unit">${escapeHtml(unitLabel)}</span>` : ''}
          </span>
        </span>
      </label>
    `;
  }

  function renderTrafficProductMetricField(state) {
    return renderTrafficMetricField({
      fieldName: 'trafficProductMetricType',
      label: '\u5546\u54c1\u60c5\u51b5',
      options: TRAFFIC_PRODUCT_METRIC_OPTIONS,
      selectValue: state.trafficProductMetricType,
      minValue: state.trafficProductMinValue,
      maxValue: state.trafficProductMaxValue,
      minFieldName: 'trafficProductMinValue',
      maxFieldName: 'trafficProductMaxValue',
      step: '1'
    });
  }

  function renderTrafficPaymentMetricField(state) {
    return renderTrafficMetricField({
      fieldName: 'trafficPaymentMetricType',
      label: '\u652f\u4ed8\u60c5\u51b5',
      options: TRAFFIC_PAYMENT_METRIC_OPTIONS,
      selectValue: state.trafficPaymentMetricType,
      minValue: state.trafficPaymentMinValue,
      maxValue: state.trafficPaymentMaxValue,
      minFieldName: 'trafficPaymentMinValue',
      maxFieldName: 'trafficPaymentMaxValue',
      step: '1'
    });
  }

  function renderTrafficConversionMetricField(state) {
    return renderTrafficMetricField({
      fieldName: 'trafficConversionMetricType',
      label: '\u8f6c\u5316\u7387',
      options: TRAFFIC_CONVERSION_METRIC_OPTIONS,
      selectValue: state.trafficConversionMetricType,
      minValue: state.trafficConversionMinValue,
      maxValue: state.trafficConversionMaxValue,
      minFieldName: 'trafficConversionMinValue',
      maxFieldName: 'trafficConversionMaxValue',
      step: '0.01',
      unitLabel: '%'
    });
  }

  function renderJoinedDateRangeText(startDate, endDate) {
    const normalizedStartDate = normalizeDateInputValue(startDate);
    const normalizedEndDate = normalizeDateInputValue(endDate);

    if (normalizedStartDate && normalizedEndDate) {
      return `${normalizedStartDate} ~ ${normalizedEndDate}`;
    }

    if (normalizedStartDate) {
      return `${normalizedStartDate} ~`;
    }

    if (normalizedEndDate) {
      return `~ ${normalizedEndDate}`;
    }

    return '\u9009\u62e9\u65f6\u95f4\u8303\u56f4';
  }

  function syncJoinedDateDraftFromValue(state) {
    state.joinedDraftStartDate = normalizeDateInputValue(state.joinedStartDate);
    state.joinedDraftEndDate = normalizeDateInputValue(state.joinedEndDate);
  }

  function applyJoinedDateDraft(state) {
    state.joinedStartDate = normalizeDateInputValue(state.joinedDraftStartDate);
    state.joinedEndDate = normalizeDateInputValue(state.joinedDraftEndDate);
  }

  function renderJoinDateField(state) {
    return `
      <label class="ops-traffic-field ops-traffic-field-date">
        <span class="ops-traffic-field-label">\u9996\u6b21\u52a0\u5165\u7ad9\u70b9\u65e5\u671f</span>
        <span class="ops-traffic-field-content">
          <span class="ops-traffic-date-picker" data-ops-traffic-date-picker>
            <button
              class="ops-traffic-date-trigger${state.joinedDatePickerOpen === true ? ' is-open' : ''}"
              type="button"
              data-ops-traffic-date-toggle="true"
            >
              <span class="ops-traffic-date-trigger-value">
                ${escapeHtml(renderJoinedDateRangeText(state.joinedStartDate, state.joinedEndDate))}
              </span>
              <span class="ops-traffic-date-trigger-icon" aria-hidden="true">\u25be</span>
            </button>
            ${state.joinedDatePickerOpen === true ? `
              <span class="ops-traffic-date-panel">
                <span class="ops-traffic-date-presets">
                  ${DATE_PRESET_OPTIONS.map((option) => `
                    <button
                      class="ops-traffic-date-preset"
                      type="button"
                      data-ops-traffic-date-preset="${escapeHtml(option.value)}"
                    >
                      ${escapeHtml(option.label)}
                    </button>
                  `).join('')}
                </span>
                <span class="ops-traffic-date-panel-row">
                  <label class="ops-traffic-date-input-field">
                    <span class="ops-traffic-date-input-label">\u5f00\u59cb\u65e5\u671f</span>
                    <input
                      class="ops-traffic-control"
                      type="date"
                      value="${escapeHtml(state.joinedDraftStartDate)}"
                      data-ops-traffic-field="joinedDraftStartDate"
                    />
                  </label>
                  <label class="ops-traffic-date-input-field">
                    <span class="ops-traffic-date-input-label">\u7ed3\u675f\u65e5\u671f</span>
                    <input
                      class="ops-traffic-control"
                      type="date"
                      value="${escapeHtml(state.joinedDraftEndDate)}"
                      data-ops-traffic-field="joinedDraftEndDate"
                    />
                  </label>
                </span>
                <span class="ops-traffic-date-panel-actions">
                  <button
                    class="ops-traffic-date-action is-secondary"
                    type="button"
                    data-ops-traffic-date-action="cancel"
                  >
                    \u53d6\u6d88
                  </button>
                  <button
                    class="ops-traffic-date-action is-secondary"
                    type="button"
                    data-ops-traffic-date-action="clear"
                  >
                    \u6e05\u7a7a
                  </button>
                  <button
                    class="ops-traffic-date-action is-primary"
                    type="button"
                    data-ops-traffic-date-action="confirm"
                  >
                    \u786e\u8ba4
                  </button>
                </span>
              </span>
            ` : ''}
          </span>
        </span>
      </label>
    `;
  }

  function buildCategorySelectionsForQuery(paths) {
    return normalizeCategoryCheckedPaths(paths)
      .map((path) => {
        const normalizedPath = normalizeCategoryPath(path);
        const categoryId = normalizeText(
          normalizedPath.length > 0
            ? normalizedPath[normalizedPath.length - 1].id
            : ''
        );
        const categoryPathIds = normalizedPath
          .map((item) => normalizeText(item && item.id))
          .filter(Boolean);

        if (!categoryId || categoryPathIds.length <= 0) {
          return null;
        }

        return {
          categoryId,
          categoryPathIds
        };
      })
      .filter(Boolean);
  }

  function buildQueryFiltersFromState(state) {
    return {
      selectedShopIds: normalizeSelectedShopIds(state && state.selectedShopIds),
      marketRegion: normalizeMarketRegion(state && state.marketRegion),
      stationIds: filterStationIdsByMarketRegion(state && state.stationIds, state && state.marketRegion),
      categorySelections: buildCategorySelectionsForQuery(state && state.categoryCheckedPaths),
      productIdType: normalizeProductIdType(state && state.productIdType),
      productIdKeywords: normalizeText(state && state.productIdKeywords),
      productName: normalizeText(state && state.productName),
      joinedStartDate: normalizeDateInputValue(state && state.joinedStartDate),
      joinedEndDate: normalizeDateInputValue(state && state.joinedEndDate),
      trafficProductMetricType: normalizeText(state && state.trafficProductMetricType),
      trafficProductMinValue: normalizeText(state && state.trafficProductMinValue),
      trafficProductMaxValue: normalizeText(state && state.trafficProductMaxValue),
      trafficPaymentMetricType: normalizeText(state && state.trafficPaymentMetricType),
      trafficPaymentMinValue: normalizeText(state && state.trafficPaymentMinValue),
      trafficPaymentMaxValue: normalizeText(state && state.trafficPaymentMaxValue),
      trafficConversionMetricType: normalizeText(state && state.trafficConversionMetricType),
      trafficConversionMinValue: normalizeText(state && state.trafficConversionMinValue),
      trafficConversionMaxValue: normalizeText(state && state.trafficConversionMaxValue)
    };
  }

  function resolveQueryShopIds(state) {
    const selectedShopIds = normalizeSelectedShopIds(state && state.selectedShopIds);

    if (selectedShopIds.length > 0) {
      return selectedShopIds;
    }

    return Array.isArray(state && state.shopCatalog && state.shopCatalog.shops)
      ? state.shopCatalog.shops
        .map((shop) => normalizeText(shop && (shop.id || shop.shopId)))
        .filter(Boolean)
      : [];
  }

  function buildQueryRunId() {
    return `traffic_query_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function settleQueryRequestFromProgress(container, progress) {
    const state = getState(container);
    const normalizedProgress = normalizeQueryProgressPayload(progress);

    if (!normalizedProgress || !isTerminalQueryProgress(normalizedProgress)) {
      return;
    }

    const progressRunId = normalizeText(normalizedProgress.runId);

    if (normalizeText(state.submitRequestId) && progressRunId === normalizeText(state.submitRequestId)) {
      state.submitLoading = false;
      state.submitCanceling = false;
      return;
    }

    if (
      normalizeText(state.queryRunId)
      && progressRunId
      && progressRunId !== normalizeText(state.queryRunId)
    ) {
      return;
    }

    state.queryLoading = false;
    state.queryCanceling = false;
  }

  function bindQueryProgressListener(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      typeof state.removeQueryProgressListener === 'function'
      || !featureCenterApi
      || typeof featureCenterApi.onOperationsTrafficBoostProgress !== 'function'
    ) {
      return;
    }

    state.removeQueryProgressListener = featureCenterApi.onOperationsTrafficBoostProgress((payload) => {
      const nextProgress = normalizeQueryProgressPayload(payload);

      if (!nextProgress) {
        return;
      }

      const progressRunId = normalizeText(nextProgress.runId);
      const isSubmitProgress = Boolean(
        normalizeText(state.submitRequestId)
        && progressRunId
        && progressRunId === normalizeText(state.submitRequestId)
      );
      const isQueryProgress = Boolean(
        normalizeText(state.queryRunId)
        && progressRunId
        && progressRunId === normalizeText(state.queryRunId)
      );

      if (!isSubmitProgress && normalizeText(state.queryRunId) && progressRunId && !isQueryProgress) {
        return;
      }

      state.queryProgress = nextProgress;
      if (!isSubmitProgress) {
        appendQueryTraceEntry(state, nextProgress);
      }
      if (isSubmitProgress) {
        if (normalizeText(nextProgress.phase) === 'canceled') {
          state.submitWarning = normalizeText(nextProgress.message) || '\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u5df2\u505c\u6b62';
        }
      }
      settleQueryRequestFromProgress(container, nextProgress);
      if (isSubmitProgress && !isTerminalQueryProgress(nextProgress)) {
        if (refreshTrafficBoostLiveProgressUi(container) !== true) {
          render(container);
        }
        return;
      }

      render(container);
    });

    window.addEventListener('beforeunload', () => {
      if (typeof state.removeQueryProgressListener === 'function') {
        state.removeQueryProgressListener();
        state.removeQueryProgressListener = null;
      }
    }, { once: true });
  }

  async function hydrateQueryProgressSnapshot(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsTrafficBoostProgressSnapshot !== 'function'
    ) {
      return null;
    }

    if (!normalizeText(state.queryRunId) && state.queryLoading !== true) {
      return null;
    }

    try {
      const response = await featureCenterApi.getOperationsTrafficBoostProgressSnapshot({
        runId: normalizeText(state.queryRunId)
      });
      const progress = normalizeQueryProgressPayload(response && response.progress);

      if (!progress) {
        return null;
      }

      if (
        normalizeText(state.queryRunId)
        && normalizeText(progress.runId)
        && normalizeText(progress.runId) !== normalizeText(state.queryRunId)
      ) {
        return null;
      }

      state.queryProgress = progress;
      appendQueryTraceEntry(state, progress);
      settleQueryRequestFromProgress(container, progress);
      if (
        normalizeText(state.submitRequestId)
        && normalizeText(progress.runId)
        && normalizeText(progress.runId) === normalizeText(state.submitRequestId)
        && !isTerminalQueryProgress(progress)
      ) {
        if (refreshTrafficBoostLiveProgressUi(container) !== true) {
          render(container);
        }
        return progress;
      }

      render(container);
      return progress;
    } catch (_error) {
      return null;
    }
  }

  async function startQuery(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.queryLoading === true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.queryOperationsTrafficBoostRows !== 'function'
    ) {
      state.queryError = '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    if (state.shopSelectorLoaded !== true && state.shopSelectorLoading !== true) {
      await loadShopCatalog(container);
    }

    const shopIds = resolveQueryShopIds(state);

    if (shopIds.length <= 0) {
      state.queryError = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u67e5\u8be2';
      render(container);
      return null;
    }

    const runId = buildQueryRunId();
    const filters = buildQueryFiltersFromState(state);

    state.queryRunId = runId;
    state.queryLoading = true;
    state.queryCanceling = false;
    state.queryError = '';
    state.queryWarning = '';
    state.submitError = '';
    state.submitWarning = '';
    state.submitNotice = '';
    state.submitPrecheckSummary = null;
    state.submitFailProducts = [];
    state.submitRequestId = '';
    state.submitCanceling = false;
    state.submitScopeSummary = {
      eligibleRowCount: 0,
      eligibleShopCount: 0,
      eligibleProductCount: 0,
      readyProductCount: 0,
      readyShopCount: 0
    };
    state.queryResultMeta = null;
    state.resultRows = [];
    state.resultRowMetricsCache = null;
    state.resultViewportScrollTop = 0;
    state.resultViewportScrollLeft = 0;
    state.queryTraceEntries = [];
    state.queryProgress = normalizeQueryProgressPayload({
      runId,
      phase: 'preparing',
      totalShops: shopIds.length,
      completedShops: 0,
      failedShops: 0,
      canceledShops: 0,
      activeShops: 0,
      rowCount: 0,
      message: '\u6b63\u5728\u53d1\u9001\u67e5\u8be2\u6307\u4ee4...'
    });
    render(container);

    try {
      const response = await featureCenterApi.queryOperationsTrafficBoostRows({
        runId,
        shopIds,
        filters
      });

      state.resultRows = Array.isArray(response && response.rows) ? response.rows : [];
      state.resultRowMetricsCache = null;
      refreshTrafficBoostSubmitScopeSummary(state);
      state.resultViewportScrollTop = 0;
      state.resultViewportScrollLeft = 0;
      state.queryWarning = normalizeText(response && response.warning);
      state.queryResultMeta = {
        updatedAt: normalizeText(response && response.updatedAt),
        rowCount: Number(response && response.rowCount) || state.resultRows.length,
        total: Number(response && response.total) || 0,
        totalShops: Number(response && response.totalShops) || shopIds.length,
        completedShops: Number(response && response.completedShops) || 0,
        failedShops: Number(response && response.failedShops) || 0,
        canceledShops: Number(response && response.canceledShops) || 0,
        canceled: response && response.canceled === true
      };
      state.queryProgress = normalizeQueryProgressPayload({
        ...(state.queryProgress || {}),
        runId,
        phase: response && response.canceled === true ? 'canceled' : 'completed',
        rowCount: state.resultRows.length,
        totalShops: state.queryResultMeta.totalShops,
        completedShops: state.queryResultMeta.completedShops,
        failedShops: state.queryResultMeta.failedShops,
        canceledShops: state.queryResultMeta.canceledShops,
        message: state.queryWarning
      });
      return response;
    } catch (error) {
      state.queryError = normalizeText(error && error.message) || '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u5931\u8d25';
      state.queryProgress = normalizeQueryProgressPayload({
        ...(state.queryProgress || {}),
        runId,
        phase: 'failed',
        message: state.queryError
      });
      return null;
    } finally {
      state.queryLoading = false;
      state.queryCanceling = false;
      render(container);
    }
  }

  async function stopQuery(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const runId = normalizeText(state.queryRunId);

    if (!runId || state.queryLoading !== true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.cancelOperationsTrafficBoostQuery !== 'function'
    ) {
      state.queryError = '\u505c\u6b62\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    state.queryCanceling = true;
    state.queryProgress = normalizeQueryProgressPayload({
      ...(state.queryProgress || {}),
      runId,
      phase: 'canceling',
      message: '\u6b63\u5728\u505c\u6b62\u67e5\u8be2...'
    });
    render(container);

    try {
      return await featureCenterApi.cancelOperationsTrafficBoostQuery({
        runId
      });
    } catch (error) {
      state.queryError = normalizeText(error && error.message) || '\u505c\u6b62\u67e5\u8be2\u5931\u8d25';
      return null;
    } finally {
      render(container);
    }
  }

  async function submitTrafficBoostBatchEnable(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const selectedLevel = normalizeTrafficBoostLevel(state && state.trafficBoostLevel);

    if (state.submitLoading === true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.submitOperationsTrafficBoostProducts !== 'function'
    ) {
      state.submitError = '\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u63a5\u53e3\u672a\u52a0\u8f7d';
      state.submitWarning = '';
      state.submitNotice = '';
      render(container);
      return null;
    }

    if (selectedLevel === 'custom' && state.customLevelFilterSettingsLoaded !== true) {
      await loadTrafficBoostCustomLevelFilterSettings(container, {
        render: false
      });
    }

    if (selectedLevel === 'custom' && state.customLevelFilterSettingsDirty === true) {
      const saveResult = await saveTrafficBoostCustomLevelFilterSettings(container);

      if (!saveResult) {
        state.submitError = state.customLevelFilterDialogError || '\u8bf7\u5148\u4fdd\u5b58\u81ea\u5b9a\u4e49\u89c4\u5219\u540e\u518d\u63d0\u4ea4';
        state.submitWarning = '';
        state.submitNotice = '';
        render(container);
        return null;
      }
    }

    const products = buildTrafficBoostSubmitProducts(state);
    const submitPrecheckSummary = buildTrafficBoostSubmitPrecheckSummary(state, products);

    if (products.length <= 0) {
      state.submitPrecheckSummary = submitPrecheckSummary;
      state.submitFailProducts = [];
      state.submitError = '\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u5546\u54c1\uff0c\u8bf7\u5148\u67e5\u8be2\u5e76\u786e\u4fdd\u5546\u54c1\u72b6\u6001\u4e3a\u53ef\u63d0\u4ea4';
      state.submitWarning = '';
      state.submitNotice = '';
      render(container);
      return null;
    }

    const requestId = `traffic_submit_${Date.now().toString(36)}`;
    const submitShopCount = new Set(
      products
        .map((item) => `${normalizeText(item && item.shopId)}::${normalizeText(item && item.marketRegion)}`)
        .filter((item) => item !== '::')
    ).size;
    state.submitLoading = true;
    state.submitRequestId = requestId;
    state.submitCanceling = false;
    state.submitError = '';
    state.submitWarning = '';
    state.submitNotice = '';
    state.submitFailProducts = [];
    state.submitPrecheckSummary = submitPrecheckSummary;
    state.queryProgress = normalizeQueryProgressPayload({
      runId: requestId,
      phase: 'preparing',
      totalShops: submitShopCount,
      completedShops: 0,
      failedShops: 0,
      canceledShops: 0,
      activeShops: 0,
      rowCount: 0,
      message: '\u6b63\u5728\u53d1\u9001\u63d0\u4ea4\u6307\u4ee4...'
    });
    render(container);

    try {
      const response = await featureCenterApi.submitOperationsTrafficBoostProducts({
        requestId,
        submitBatchSize: TRAFFIC_SUBMIT_BATCH_SIZE,
        products
      });
      const successProductCount = Number(response && response.successProductCount) || 0;
      const failedProductCount = Number(response && response.failedProductCount) || 0;
      state.submitFailProducts = Array.isArray(response && response.failProducts)
        ? response.failProducts.slice()
        : [];
      const failProductList = Array.isArray(response && response.failProducts)
        ? response.failProducts
        : [];
      const failedProductMap = new Map(
        failProductList
          .map((item) => [
            `${normalizeText(item && item.shopId)}:${normalizeText(item && item.siteId)}:${normalizeText(item && item.productId)}`,
            item
          ])
          .filter((item) => item[0] !== '::' && item[0] !== ':::')
      );
      const failedProductKeySet = new Set(
        Array.from(failedProductMap.keys())
      );

      if (successProductCount > 0 || failedProductKeySet.size > 0) {
        const submittedProductMap = new Map(
          products.map((productItem) => [
            `${normalizeText(productItem && productItem.shopId)}:${normalizeText(productItem && productItem.siteId)}:${normalizeText(productItem && productItem.productId)}`,
            productItem
          ])
        );
        state.resultRows = (Array.isArray(state.resultRows) ? state.resultRows : []).map((row) => {
          const rowKey = `${normalizeText(row && row.shopId)}:${normalizeText(row && row.siteId)}:${normalizeText(row && row.productId)}`;
          const submittedProduct = rowKey !== '::' && rowKey !== ':::' ? submittedProductMap.get(rowKey) : null;

          if (!submittedProduct || failedProductKeySet.has(rowKey)) {
            const failedProduct = failedProductMap.get(rowKey) || null;

            if (!failedProduct) {
              return row;
            }

            return {
              ...row,
              submitFailureMessage: normalizeText(failedProduct && failedProduct.message),
              submitFailureSkuId: normalizeText(failedProduct && failedProduct.higherCustomPriceSkuId)
                || normalizeText(failedProduct && failedProduct.withoutSkuId)
            };
          }

          return {
            ...row,
            canNotSubmitReason: '',
            submitFailureMessage: '',
            submitFailureSkuId: '',
            submittedTrafficBoostLevel: normalizeText(submittedProduct && submittedProduct.increaseFlowLevel),
            submittedTrafficBoostDays: normalizeText(submittedProduct && submittedProduct.increaseFlowDays),
            submittedTrafficBoostAutoRenew: submittedProduct && submittedProduct.isAutoRenew === true,
            submitPendingRefresh: true
          };
        });
        state.resultRowMetricsCache = null;
        refreshTrafficBoostSubmitScopeSummary(state);
        scheduleTrafficBoostResultsViewportRefresh(container);
      }

      state.submitWarning = normalizeText(response && response.warning);
      const actualSubmitCount = Math.max(
        0,
        Number(response && response.totalProductCount) || 0,
        successProductCount + failedProductCount,
        products.length
      );
      const submitScopePrefix = `\u672c\u6b21\u9001\u63d0 ${actualSubmitCount} \u4e2a\u5546\u54c1`;
      state.submitNotice = response && response.canceled === true
        ? (
          failedProductCount > 0
            ? `\u5df2\u505c\u6b62\u63d0\u4ea4\uff0c${submitScopePrefix}\uff0c\u6210\u529f ${successProductCount} \u4e2a\uff0c\u5931\u8d25 ${failedProductCount} \u4e2a`
            : `\u5df2\u505c\u6b62\u63d0\u4ea4\uff0c${submitScopePrefix}\uff0c\u5df2\u6210\u529f ${successProductCount} \u4e2a`
        )
        : (
          failedProductCount > 0
            ? `${submitScopePrefix}\uff0c\u6210\u529f ${successProductCount} \u4e2a\uff0c\u5931\u8d25 ${failedProductCount} \u4e2a`
            : `${submitScopePrefix}\uff0c\u5df2\u6210\u529f ${successProductCount} \u4e2a`
        );
      state.queryProgress = normalizeQueryProgressPayload({
        ...(state.queryProgress || {}),
        runId: requestId,
        phase: response && response.canceled === true ? 'canceled' : 'completed',
        totalShops: Number(response && response.totalShopCount) || 0,
        completedShops: Number(response && response.completedShopCount) || 0,
        failedShops: Number(response && response.failedShopCount) || 0,
        canceledShops: Number(response && response.canceledShopCount) || 0,
        activeShops: 0,
        rowCount: successProductCount,
        message: normalizeText(response && response.warning) || state.submitNotice
      });

      if (failedProductCount > 0 && Array.isArray(response && response.failProducts) && response.failProducts.length > 0) {
        const detailCount = Math.max(0, response.failProducts.length);
        const failureSampleMessages = Array.from(new Set(
          response.failProducts
            .map((item) => normalizeText(item && item.message))
            .filter(Boolean)
        )).slice(0, 3);
        const failureSampleText = failureSampleMessages.length > 0
          ? `\uff0c\u793a\u4f8b\uff1a${failureSampleMessages.join('\uff1b')}`
          : '';

        if (detailCount > 0) {
          state.submitWarning = state.submitWarning
            ? `${state.submitWarning}\uff1b\u53ef\u5728\u5217\u8868\u4e2d\u67e5\u770b ${detailCount} \u6761\u5931\u8d25\u660e\u7ec6${failureSampleText}`
            : `\u53ef\u5728\u5217\u8868\u4e2d\u67e5\u770b ${detailCount} \u6761\u5931\u8d25\u660e\u7ec6${failureSampleText}`;
        }
      }

      return response;
    } catch (error) {
      state.submitError = normalizeText(error && error.message) || '\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u5931\u8d25';
      state.queryProgress = normalizeQueryProgressPayload({
        ...(state.queryProgress || {}),
        runId: requestId,
        phase: 'failed',
        message: state.submitError
      });
      return null;
    } finally {
      state.submitLoading = false;
      state.submitCanceling = false;
      render(container);
    }
  }

  async function stopSubmitTrafficBoostBatchEnable(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const requestId = normalizeText(state.submitRequestId);

    if (!requestId || state.submitLoading !== true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.cancelOperationsTrafficBoostSubmit !== 'function'
    ) {
      state.submitError = '\u505c\u6b62\u63d0\u4ea4\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    state.submitCanceling = true;
    state.queryProgress = normalizeQueryProgressPayload({
      ...(state.queryProgress || {}),
      runId: requestId,
      phase: 'canceling',
      message: '\u6b63\u5728\u505c\u6b62\u5f53\u524d\u63d0\u4ea4\u8bf7\u6c42...'
    });
    render(container);

    try {
      return await featureCenterApi.cancelOperationsTrafficBoostSubmit({
        requestId
      });
    } catch (error) {
      state.submitCanceling = false;
      state.submitError = normalizeText(error && error.message) || '\u505c\u6b62\u63d0\u4ea4\u5931\u8d25';
      render(container);
      return null;
    }
  }

  function closeTrafficBoostCustomLevelFilterDialog(container) {
    const state = getState(container);

    state.customLevelFilterDialogOpen = false;
    state.customLevelFilterDialogError = '';
    state.customLevelFilterDialogWarning = '';
    state.customLevelFilterDialogNotice = '';
    render(container);
  }

  async function loadTrafficBoostCustomLevelFilterSettings(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      state.customLevelFilterSettingsLoading === true
      && state.customLevelFilterSettingsPromise
      && options.force !== true
    ) {
      return state.customLevelFilterSettingsPromise;
    }

    if (options.force !== true && state.customLevelFilterSettingsLoaded === true) {
      return state.customLevelFilterSettings;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsTrafficBoostCustomLevelFilterSettings !== 'function'
    ) {
      syncTrafficBoostCustomLevelFilterSettingsState(
        state,
        buildEmptyTrafficBoostCustomLevelFilterSettings(),
        { markApplied: true }
      );
      state.customLevelFilterDialogWarning = '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219\u8bfb\u53d6\u63a5\u53e3\u672a\u52a0\u8f7d';

      if (options.render !== false || state.customLevelFilterDialogOpen === true) {
        render(container);
      }

      return state.customLevelFilterSettings;
    }

    state.customLevelFilterSettingsLoading = true;
    state.customLevelFilterDialogError = '';

    if (options.render !== false || state.customLevelFilterDialogOpen === true) {
      render(container);
    }

    state.customLevelFilterSettingsPromise = featureCenterApi.getOperationsTrafficBoostCustomLevelFilterSettings()
      .then((response) => {
        syncTrafficBoostCustomLevelFilterSettingsState(
          state,
          response && response.settings,
          { markApplied: true }
        );
        state.customLevelFilterDialogWarning = normalizeText(response && response.warning);

        if (
          normalizeTrafficBoostLevel(state && state.trafficBoostLevel) === 'custom'
          && Array.isArray(state.resultRows)
          && state.resultRows.length > 0
        ) {
          refreshTrafficBoostSubmitScopeSummary(state);
        }

        return state.customLevelFilterSettings;
      })
      .catch((error) => {
        syncTrafficBoostCustomLevelFilterSettingsState(
          state,
          buildEmptyTrafficBoostCustomLevelFilterSettings(),
          { markApplied: true }
        );
        state.customLevelFilterDialogWarning = normalizeText(error && error.message)
          || '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219\u52a0\u8f7d\u5931\u8d25';
        return state.customLevelFilterSettings;
      })
      .finally(() => {
        state.customLevelFilterSettingsLoading = false;
        state.customLevelFilterSettingsPromise = null;

        if (options.render !== false || state.customLevelFilterDialogOpen === true) {
          render(container);
        }
      });

    return state.customLevelFilterSettingsPromise;
  }

  async function openTrafficBoostCustomLevelFilterDialog(container, options = {}) {
    const state = getState(container);

    state.customLevelFilterDialogOpen = true;
    state.customLevelFilterDialogError = '';
    state.customLevelFilterDialogWarning = '';
    state.customLevelFilterDialogNotice = '';
    render(container);

    return loadTrafficBoostCustomLevelFilterSettings(container, {
      force: options.force === true,
      render: true
    });
  }

  async function saveTrafficBoostCustomLevelFilterSettings(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const normalizedSettings = syncTrafficBoostCustomLevelFilterSettingsState(
      state,
      state.customLevelFilterSettings
    );

    state.customLevelFilterSettings = normalizedSettings;

    const modeValue = normalizeOptionalNumber(
      resolveTrafficBoostCustomLevelFilterModeValue(normalizedSettings, normalizedSettings.mode)
    );

    if (modeValue === null || modeValue <= 0) {
      state.customLevelFilterDialogError = '\u8bf7\u5148\u586b\u5199\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u7684\u8ba1\u4ef7\u53c2\u6570';
      state.customLevelFilterDialogWarning = '';
      state.customLevelFilterDialogNotice = '';
      render(container);
      return null;
    }

    if (
      state.customLevelFilterSettingsSaving === true
      && state.customLevelFilterSettingsSavePromise
      && options.force !== true
    ) {
      state.customLevelFilterSettingsSaveQueued = true;
      return state.customLevelFilterSettingsSavePromise;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsTrafficBoostCustomLevelFilterSettings !== 'function'
    ) {
      state.customLevelFilterDialogWarning = '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d';
      render(container);
      return {
        settings: normalizedSettings,
        source: 'default',
        localSaved: false,
        cloudSynced: false,
        warning: state.customLevelFilterDialogWarning
      };
    }

    state.customLevelFilterSettingsSaving = true;
    state.customLevelFilterDialogError = '';
    state.customLevelFilterDialogWarning = '';
    state.customLevelFilterDialogNotice = '';
    render(container);

    state.customLevelFilterSettingsSavePromise = featureCenterApi.saveOperationsTrafficBoostCustomLevelFilterSettings(normalizedSettings)
      .then((response) => {
        const latestLocalSettings = normalizeTrafficBoostCustomLevelFilterSettings(state.customLevelFilterSettings);
        const hasNewerDraft = !areTrafficBoostCustomLevelFilterSettingsEqual(latestLocalSettings, normalizedSettings);

        syncTrafficBoostCustomLevelFilterSettingsState(
          state,
          hasNewerDraft ? latestLocalSettings : (response && response.settings),
          { markApplied: hasNewerDraft !== true }
        );
        state.customLevelFilterDialogWarning = normalizeText(response && response.warning)
          || (response && response.cloudSynced !== true
            ? '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219\u5df2\u4fdd\u5b58\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
            : '');

        if (hasNewerDraft !== true) {
          state.customLevelFilterDialogNotice = '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219\u5df2\u4fdd\u5b58';
        }

        if (Array.isArray(state.resultRows) && state.resultRows.length > 0) {
          refreshTrafficBoostSubmitScopeSummary(state);
          scheduleTrafficBoostResultsViewportRefresh(container);
        }

        return response;
      })
      .catch((error) => {
        state.customLevelFilterDialogError = normalizeText(error && error.message)
          || '\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219\u4fdd\u5b58\u5931\u8d25';
        return null;
      })
      .finally(() => {
        state.customLevelFilterSettingsSaving = false;
        state.customLevelFilterSettingsSavePromise = null;

        if (state.customLevelFilterSettingsSaveQueued === true) {
          state.customLevelFilterSettingsSaveQueued = false;
          void saveTrafficBoostCustomLevelFilterSettings(container, {
            force: true
          });
        }

        render(container);

        if (Array.isArray(state.resultRows) && state.resultRows.length > 0) {
          scheduleTrafficBoostResultsViewportRestore(container);
        }
      });

    return state.customLevelFilterSettingsSavePromise;
  }

  function closeTrafficBoostQuickCostDialog(container) {
    const state = getState(container);

    state.quickCostDialogOpen = false;
    state.quickCostDialogLoading = false;
    state.quickCostDialogSaving = false;
    state.quickCostDialogError = '';
    state.quickCostDialogWarning = '';
    state.quickCostDialogNotice = '';
    state.quickCostDialogEntries = [];
    state.quickCostDialogShopCount = 0;
    state.quickCostDialogSourceEntryCount = 0;
    state.quickCostDialogMergedEntryCount = 0;
    state.quickCostDialogConflictCount = 0;
    render(container);
  }

  async function openTrafficBoostQuickCostDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.shopSelectorLoaded !== true && state.shopSelectorLoading !== true) {
      await loadShopCatalog(container);
    }

    const targetShopIds = buildTrafficBoostQuickCostTargetShopIds(state);

    if (targetShopIds.length <= 0) {
      state.queryWarning = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7';
      render(container);
      return;
    }

    state.quickCostDialogOpen = true;
    state.quickCostDialogLoading = true;
    state.quickCostDialogSaving = false;
    state.quickCostDialogError = '';
    state.quickCostDialogWarning = '';
    state.quickCostDialogNotice = '';
    state.quickCostDialogEntries = [];
    state.quickCostDialogShopCount = targetShopIds.length;
    state.quickCostDialogSourceEntryCount = 0;
    state.quickCostDialogMergedEntryCount = 0;
    state.quickCostDialogConflictCount = 0;
    render(container);

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      state.quickCostDialogLoading = false;
      state.quickCostDialogError = '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u8bfb\u53d6\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
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

      const aggregateResult = buildTrafficBoostQuickCostDialogEntries(
        state,
        response && response.entries,
        presetResponse && presetResponse.entries
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

      state.quickCostDialogEntries = aggregateResult.entries;
      state.quickCostDialogSourceEntryCount = aggregateResult.sourceEntryCount;
      state.quickCostDialogMergedEntryCount = aggregateResult.mergedEntryCount;
      state.quickCostDialogConflictCount = aggregateResult.conflictCount;
      state.quickCostDialogWarning = warningList.join('\n');
    } catch (error) {
      state.quickCostDialogError = normalizeText(error && error.message) || '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u52a0\u8f7d\u5931\u8d25';
    } finally {
      state.quickCostDialogLoading = false;
      render(container);
    }
  }

  async function saveTrafficBoostQuickCostDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsSharedCostBatch !== 'function'
    ) {
      state.quickCostDialogError = '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    state.quickCostDialogSaving = true;
    state.quickCostDialogError = '';
    state.quickCostDialogWarning = '';
    state.quickCostDialogNotice = '';
    render(container);

    try {
      const payloadEntries = (Array.isArray(state.quickCostDialogEntries) ? state.quickCostDialogEntries : [])
        .map((entry) => ({
          shopId: normalizeText(entry && entry.shopId),
          shopName: normalizeText(entry && entry.shopName),
          station: resolveQuickCostStationValue(entry),
          stationLabel: normalizeText(entry && entry.stationLabel),
          spec: normalizeText(entry && entry.spec),
          costPrice: normalizeQuickCostValue(entry && entry.costPrice)
        }))
        .filter((entry) => buildQuickCostEntryKey(entry.shopId, entry.station, entry.spec));
      const response = await featureCenterApi.saveOperationsSharedCostBatch({
        entries: payloadEntries
      });

      state.quickCostDialogEntries = payloadEntries.map((entry) => ({
        ...entry,
        key: buildQuickCostEntryKey(entry.shopId, entry.station, entry.spec),
        updatedAt: normalizeText(response && response.updatedAt),
        mergedRecordCount: 1,
        mergedCategoryLabels: [],
        mergedCostConflict: false
      }));
      state.quickCostDialogSourceEntryCount = payloadEntries.length;
      state.quickCostDialogMergedEntryCount = 0;
      state.quickCostDialogConflictCount = 0;
      state.quickCostDialogWarning = normalizeText(response && response.warning)
        || (response && response.cloudSynced !== true
          ? '\u6210\u672c\u9884\u8bbe\u5df2\u4fdd\u5b58\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
          : '');
      state.quickCostDialogNotice = `\u5df2\u4fdd\u5b58 ${payloadEntries.length} \u9879\u6210\u672c\u9884\u8bbe`;
      return response;
    } catch (error) {
      state.quickCostDialogError = normalizeText(error && error.message) || '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u5931\u8d25';
      return null;
    } finally {
      state.quickCostDialogSaving = false;
      render(container);
    }
  }

  function renderQueryMetaText(state) {
    const progress = normalizeQueryProgressPayload(state && state.queryProgress);
    const meta = state && state.queryResultMeta ? state.queryResultMeta : null;
    const summaryParts = [];
    const isSubmitProgress = Boolean(
      progress
      && normalizeText(state && state.submitRequestId)
      && normalizeText(progress && progress.runId) === normalizeText(state && state.submitRequestId)
    );
    const showLiveQueryProgress = !isSubmitProgress && state && state.queryLoading === true;
    const progressTotalShops = Math.max(0, Number(progress && progress.totalShops) || 0);
    const progressCompletedShops = Math.max(0, Number(progress && progress.completedShops) || 0);
    const progressFailedShops = Math.max(0, Number(progress && progress.failedShops) || 0);
    const progressCanceledShops = Math.max(0, Number(progress && progress.canceledShops) || 0);
    const progressActiveShops = Math.max(0, Number(progress && progress.activeShops) || 0);
    const progressPageNum = Math.max(0, Number(progress && progress.pageNum) || 0);
    const progressTotalPages = Math.max(0, Number(progress && progress.totalPages) || 0);
    const progressFetchedItemCount = Math.max(0, Number(progress && progress.fetchedItemCount) || 0);
    const progressAccumulatedItemCount = Math.max(0, Number(progress && progress.accumulatedItemCount) || 0);
    const progressEstimatedTotal = Math.max(0, Number(progress && progress.estimatedTotal) || 0);
    const progressRowCount = Math.max(0, Number(progress && progress.rowCount) || 0);

    if (showLiveQueryProgress && progressTotalShops > 0) {
      summaryParts.push(`\u5df2\u5b8c\u6210\u5e97\u94fa ${progressCompletedShops}/${progressTotalShops} \u5bb6`);
    }

    if (showLiveQueryProgress && progressActiveShops > 0) {
      summaryParts.push(`\u8fdb\u884c\u4e2d ${progressActiveShops} \u5bb6`);
    }

    if (showLiveQueryProgress && progressFailedShops > 0) {
      summaryParts.push(`\u5931\u8d25 ${progressFailedShops} \u5bb6`);
    }

    if (showLiveQueryProgress && progressCanceledShops > 0) {
      summaryParts.push(`\u505c\u6b62 ${progressCanceledShops} \u5bb6`);
    }

    if (showLiveQueryProgress && progressPageNum > 0) {
      summaryParts.push(`\u9875\u7801 ${progressPageNum}/${Math.max(1, progressTotalPages || 1)}`);
    }

    if (showLiveQueryProgress && (progressFetchedItemCount > 0 || normalizeText(progress && progress.phase) === 'page-completed')) {
      summaryParts.push(`\u672c\u9875 ${progressFetchedItemCount} \u6761`);
    }

    if (showLiveQueryProgress && (progressAccumulatedItemCount > 0 || progressEstimatedTotal > 0)) {
      summaryParts.push(
        `\u5f53\u524d\u5e97\u94fa ${progressAccumulatedItemCount}${progressEstimatedTotal > 0 ? `/${progressEstimatedTotal}` : ''} \u6761`
      );
    }

    if (showLiveQueryProgress && progressRowCount > 0) {
      summaryParts.push(`\u603b\u7d2f\u8ba1 ${progressRowCount} \u6761`);
    }

    if (meta && Number(meta.rowCount) >= 0) {
      summaryParts.push(`\u7ed3\u679c ${meta.rowCount} \u6761`);
    }

    if (meta && Number(meta.totalShops) > 0) {
      summaryParts.push(`\u5e97\u94fa ${meta.completedShops}/${meta.totalShops}`);
    }

    if (meta && Number(meta.failedShops) > 0) {
      summaryParts.push(`\u5931\u8d25 ${meta.failedShops}`);
    }

    if (meta && Number(meta.canceledShops) > 0) {
      summaryParts.push(`\u505c\u6b62 ${meta.canceledShops}`);
    }

    if (meta && normalizeText(meta.updatedAt)) {
      summaryParts.push(normalizeText(meta.updatedAt));
    }

    return Array.from(new Set(summaryParts.filter(Boolean))).join(' | ');
  }

  function buildTrafficBoostQuickCostTargetShopIds(state) {
    return normalizeSelectedShopIds(state && state.selectedShopIds);
  }

  function buildTrafficBoostQuickCostShopNameMap(state) {
    const shopNameMap = Object.create(null);
    const shopCatalogMap = state
      && state.shopCatalog
      && state.shopCatalog.shopMap
      && typeof state.shopCatalog.shopMap === 'object'
      ? state.shopCatalog.shopMap
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

  function buildTrafficBoostQuickCostPresetHintEntries(entries, targetShopIdSet) {
    const entryMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!shopId || (targetShopIdSet.size > 0 && !targetShopIdSet.has(shopId))) {
        return;
      }

      const station = resolveQuickCostStationValue(entry);
      const spec = normalizeText(entry && entry.spec);

      if (!station || !spec) {
        return;
      }

      const category = normalizeText(entry && entry.category);
      const hintKey = [
        shopId,
        station,
        category || '-',
        normalizeQuickCostSpecIdentity(spec)
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
        spec,
        specKey: normalizeQuickCostSpecIdentity(spec),
        specSegments: buildQuickCostSpecSegments(spec)
      });
    });

    return Array.from(entryMap.values());
  }

  function buildTrafficBoostQuickCostSourceEntries(snapshotEntries, presetHintEntries, targetShopIds) {
    const targetShopIdSet = new Set(normalizeSelectedShopIds(targetShopIds));
    const hintEntries = buildTrafficBoostQuickCostPresetHintEntries(
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

      const station = resolveQuickCostStationValue(entry);
      const sharedSpec = normalizeText(entry && entry.spec);
      const sharedSpecKey = normalizeQuickCostSpecIdentity(sharedSpec);
      const sharedSpecSegments = buildQuickCostSpecSegments(sharedSpec);
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

          return normalizeQuickCostSpecIdentity(hintEntry && hintEntry.spec) === sharedSpecKey
            || hintSpecSegments.some((segment) => normalizeQuickCostSpecIdentity(segment) === sharedSpecKey);
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
              spec: normalizeText(hintEntry && hintEntry.spec)
            };
            const sourceKey = buildQuickCostEntryKey(
              nextEntry.shopId,
              resolveQuickCostStationValue(nextEntry),
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
      const sourceKey = buildQuickCostEntryKey(
        shopId,
        station,
        sharedSpec
      );

      if (sourceKey) {
        sourceEntryKeys.add(sourceKey);
      }
    });

    hintEntries.forEach((hintEntry) => {
      const sourceKey = buildQuickCostEntryKey(
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
        costPrice: ''
      });
      sourceEntryKeys.add(sourceKey);
    });

    return sourceEntries;
  }

  function buildTrafficBoostQuickCostDialogEntries(state, snapshotEntries, presetHintEntries) {
    const targetShopIds = buildTrafficBoostQuickCostTargetShopIds(state);
    const targetShopIdSet = new Set(targetShopIds);
    const shopNameMap = buildTrafficBoostQuickCostShopNameMap(state);
    const entryMap = new Map();
    const sourceEntries = buildTrafficBoostQuickCostSourceEntries(
      snapshotEntries,
      presetHintEntries,
      targetShopIds
    );

    sourceEntries.forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!shopId || (targetShopIdSet.size > 0 && !targetShopIdSet.has(shopId))) {
        return;
      }

      const station = resolveQuickCostStationValue(entry);
      const stationLabel = normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.siteName) || station;
      const spec = normalizeText(entry && entry.spec);
      const key = buildQuickCostEntryKey(shopId, station, spec);

      if (!key) {
        return;
      }

      const costPrice = normalizeQuickCostValue(entry && entry.costPrice);
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

      const previousCostPrice = normalizeQuickCostValue(previousEntry && previousEntry.costPrice);
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
        mergedRecordCount: normalizeNonNegativeInteger(previousEntry && previousEntry.mergedRecordCount, 1) + 1,
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

  function renderQueryActionButtons(state) {
    return `
      <div class="ops-traffic-query-actions">
        <button
          class="ops-marketing-tools-action-button is-primary"
          type="button"
          data-ops-traffic-action="query"
          ${state && state.queryLoading === true ? 'disabled' : ''}
        >
          \u67e5\u8be2
        </button>
        <button
          class="ops-marketing-tools-action-button ${state && state.queryLoading === true ? 'is-danger' : 'is-secondary'}"
          type="button"
          data-ops-traffic-action="stop"
          ${state && state.queryLoading === true ? '' : 'disabled'}
        >
          ${state && state.queryCanceling === true ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u4efb\u52a1'}
        </button>
      </div>
    `;
  }

  function renderTrafficBoostConfigControls(state) {
    const selectedDuration = normalizeTrafficBoostDuration(state && state.trafficBoostDuration);
    const selectedLevel = normalizeTrafficBoostLevel(state && state.trafficBoostLevel);
    const showAutoRenew = shouldShowTrafficBoostAutoRenew(selectedDuration);
    const autoRenewChecked = state && state.trafficBoostAutoRenew === true;
    const submitScopeSummary = state && state.submitScopeSummary && typeof state.submitScopeSummary === 'object'
      ? state.submitScopeSummary
      : refreshTrafficBoostSubmitScopeSummary(state);
    const selectableCount = Math.max(0, Number(submitScopeSummary && submitScopeSummary.readyProductCount) || 0);
    const submitRunning = state && state.submitLoading === true;
    const customRuleTitle = selectedLevel === 'custom'
      ? `${formatTrafficBoostCustomLevelFilterRule(state && state.customLevelFilterAppliedSettings)} | ${formatTrafficBoostCustomLevelProfitFloorRule(state && state.customLevelFilterAppliedSettings)}`
      : '';

    return `
      <div class="ops-traffic-boost-configs">
        <label class="ops-traffic-boost-config-field ops-traffic-boost-config-field-duration">
          <span class="ops-traffic-boost-config-label">\u6d41\u91cf\u52a0\u901f\u65f6\u957f\uff1a</span>
          <select
            class="ops-traffic-control ops-traffic-boost-config-select"
            data-ops-traffic-field="trafficBoostDuration"
          >
            ${renderOptions(TRAFFIC_BOOST_DURATION_OPTIONS, selectedDuration, '', {
              includeEmpty: false
            })}
          </select>
        </label>
        ${showAutoRenew ? `
          <label class="ops-traffic-boost-renew-toggle">
            <input
              class="ops-traffic-boost-renew-toggle-input"
              type="checkbox"
              data-ops-traffic-toggle="trafficBoostAutoRenew"
              ${autoRenewChecked ? 'checked' : ''}
            />
            <span class="ops-traffic-boost-renew-toggle-track">
              <span class="ops-traffic-boost-renew-toggle-knob"></span>
            </span>
            <span class="ops-traffic-boost-renew-toggle-label">\u81ea\u52a8\u7eed\u671f</span>
          </label>
        ` : ''}
        <label class="ops-traffic-boost-config-field ops-traffic-boost-config-field-level">
          <span class="ops-traffic-boost-config-label">\u6d41\u91cf\u52a0\u901f\u7b49\u7ea7\uff1a</span>
          <select
            class="ops-traffic-control ops-traffic-boost-config-select is-level"
            data-ops-traffic-field="trafficBoostLevel"
          >
            ${renderOptions(TRAFFIC_BOOST_LEVEL_OPTIONS, selectedLevel, '', {
              includeEmpty: false
            })}
          </select>
        </label>
        ${selectedLevel === 'custom' ? `
          <button
            class="ops-marketing-tools-action-button is-danger"
            type="button"
            data-ops-traffic-action="edit-custom-level"
            title="${escapeHtmlAttribute(customRuleTitle || '\u7f16\u8f91\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219')}"
          >
            \u7f16\u8f91\u81ea\u5b9a\u4e49\u89c4\u5219
          </button>
        ` : ''}
        <button
          class="ops-marketing-tools-action-button is-danger"
          type="button"
          data-ops-traffic-action="batch-enable"
          title="${escapeHtmlAttribute(selectableCount > 0 ? `\u5f53\u524d\u53ef\u63d0\u4ea4 ${selectableCount} \u4e2a\u5546\u54c1` : '\u8bf7\u5148\u67e5\u8be2\u53ef\u63d0\u4ea4\u5546\u54c1')}"
          ${submitRunning ? 'disabled' : ''}
        >
          ${submitRunning ? '\u63d0\u4ea4\u4e2d...' : '\u6279\u91cf\u5f00\u542f\u6d41\u91cf\u52a0\u901f'}
        </button>
        <button
          class="ops-marketing-tools-action-button ${submitRunning ? 'is-danger' : 'is-secondary'}"
          type="button"
          data-ops-traffic-action="stop-submit"
          ${submitRunning ? '' : 'disabled'}
        >
          ${state && state.submitCanceling === true ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u4efb\u52a1'}
        </button>
      </div>
    `;
  }

  function renderQuickCostEntryCard(state) {
    const selectedShopCount = buildTrafficBoostQuickCostTargetShopIds(state).length;
    const quickCostDisabled = selectedShopCount <= 0
      || (state && state.quickCostDialogLoading === true)
      || (state && state.quickCostDialogSaving === true);

    return `
      <section class="ops-traffic-quick-cost-entry-card" data-ops-traffic-quick-cost-entry-card>
        <div class="ops-traffic-quick-cost-entry-actions">
          <button
            class="ops-marketing-tools-action-button is-primary"
            type="button"
            data-ops-traffic-action="quick-cost"
            title="${escapeHtml(selectedShopCount > 0 ? `\u5f53\u524d\u5df2\u9009 ${selectedShopCount} \u5bb6\u5e97\u94fa` : '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa')}"
            ${quickCostDisabled ? 'disabled' : ''}
          >
            \u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7
          </button>
        </div>
        ${renderTrafficBoostConfigControls(state)}
      </section>
    `;
  }

  function renderTrafficBoostQuickCostDialog(state) {
    if (state && state.quickCostDialogOpen !== true) {
      return '';
    }

    const groupedEntries = groupQuickCostDialogEntries(state && state.quickCostDialogEntries);
    const selectedShopCount = Math.max(
      normalizeNonNegativeInteger(state && state.quickCostDialogShopCount, 0),
      buildTrafficBoostQuickCostTargetShopIds(state).length
    );
    const mergedEntryCount = normalizeNonNegativeInteger(state && state.quickCostDialogMergedEntryCount, 0);
    const conflictCount = normalizeNonNegativeInteger(state && state.quickCostDialogConflictCount, 0);

    return `
      <div class="ops-activity-quick-cost-modal" data-ops-traffic-quick-cost-backdrop="true">
        <div class="ops-activity-quick-cost-dialog" data-ops-traffic-quick-cost-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u6279\u91cf\u9884\u8bbe\u6210\u672c\u4ef7</h3>
              <p class="ops-activity-quick-cost-subtitle">
                \u8fd9\u91cc\u4f1a\u6c47\u603b\u5f53\u524d\u5df2\u9009 ${escapeHtml(String(selectedShopCount))} \u5bb6\u5e97\u94fa\u5728\u9884\u89c8\u7248\u3001\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406\u3001\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u7b49\u529f\u80fd\u91cc\u5df2\u4fdd\u5b58\u7684\u5171\u4eab\u6210\u672c\u4ef7\u3002
                <br />
                \u6d41\u91cf\u52a0\u901f\u73b0\u5728\u4f1a\u5148\u8865\u67e5SKU\u660e\u7ec6\uff0c\u8fd9\u91cc\u4f1a\u4f18\u5148\u6309\u201c\u5e97\u94faID + \u7ad9\u70b9ID + SKU\u89c4\u683c\u201d\u805a\u5408\u5c55\u793a\uff0c\u82e5\u547d\u4e2d\u591a\u6761\u5386\u53f2\u8bb0\u5f55\uff0c\u9ed8\u8ba4\u53d6\u6700\u8fd1\u66f4\u65b0\u7684\u6210\u672c\u4ef7\uff1b\u5982\u679c\u5e97\u94fa\u8fd8\u672a\u5728\u5176\u4ed6\u529f\u80fd\u8bbe\u7f6e\u8fc7\u6210\u672c\u4ef7\uff0c\u8bf7\u5148\u53bb\u5176\u4ed6\u529f\u80fd\u8bbe\u7f6e\u3002
              </p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-ops-traffic-quick-cost-action="close"
              ${state && state.quickCostDialogSaving === true ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body">
            ${state && state.quickCostDialogLoading === true
        ? `<div class="ops-activity-quick-cost-empty">\u6b63\u5728\u4ece\u4e91\u7aef\u52a0\u8f7d\u5171\u4eab\u6210\u672c\u9884\u8bbe...</div>`
        : groupedEntries.length <= 0
          ? `<div class="ops-activity-quick-cost-empty">\u5f53\u524d\u5df2\u9009\u5e97\u94fa\u5728\u5176\u4ed6\u529f\u80fd\u91cc\u6682\u65e0\u5df2\u4fdd\u5b58\u7684\u6210\u672c\u4ef7\u9884\u8bbe\uff0c\u8bf7\u5148\u53bb\u9884\u89c8\u7248\u3001\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406\u6216\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u91cc\u8bbe\u7f6e\u3002</div>`
          : groupedEntries.map((group) => `
              <section class="ops-activity-quick-cost-group">
                <div class="ops-activity-quick-cost-group-header">
                  <strong>${escapeHtml(normalizeText(group && group.shopName) || normalizeText(group && group.shopId) || '--')}</strong>
                  <span>${escapeHtml(normalizeText(group && group.shopId) || '--')}</span>
                </div>
                <div class="ops-activity-quick-cost-group-list">
                  ${(Array.isArray(group && group.entries) ? group.entries : []).map((entry) => {
      const mergedRecordCount = normalizeNonNegativeInteger(entry && entry.mergedRecordCount, 1);
      const mergedCategoryLabels = Array.isArray(entry && entry.mergedCategoryLabels)
        ? entry.mergedCategoryLabels.filter(Boolean)
        : [];
      const metaTextParts = [
        normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.station) || '--'
      ];
      const metaTitleParts = metaTextParts.slice();

      if (mergedRecordCount > 1) {
        metaTextParts.push(`\u805a\u5408 ${mergedRecordCount} \u6761`);
        metaTitleParts.push(`\u5df2\u6309\u5f31\u5339\u914d\u952e\u805a\u5408 ${mergedRecordCount} \u6761\u5386\u53f2\u8bb0\u5f55`);
      }

      if (normalizeText(entry && entry.updatedAt)) {
        metaTitleParts.push(`\u6700\u8fd1\u66f4\u65b0 ${formatDateTime(entry.updatedAt)}`);
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
                          value="${escapeHtml(normalizeQuickCostValue(entry && entry.costPrice))}"
                          data-ops-traffic-quick-cost-input="${escapeHtml(normalizeText(entry && entry.key))}"
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
            ${state && state.quickCostDialogError ? `<div class="ops-activity-quick-cost-message is-error">${escapeHtml(state.quickCostDialogError)}</div>` : ''}
            ${state && state.quickCostDialogWarning ? `<div class="ops-activity-quick-cost-message is-warning">${escapeHtml(state.quickCostDialogWarning)}</div>` : ''}
            ${state && state.quickCostDialogNotice ? `<div class="ops-activity-quick-cost-message is-success">${escapeHtml(state.quickCostDialogNotice)}</div>` : ''}
            <div class="ops-activity-quick-cost-actions">
              <span class="ops-activity-quick-cost-message">
                \u5df2\u6c47\u603b ${escapeHtml(String(((state && state.quickCostDialogEntries) || []).length))} \u9879
                ${mergedEntryCount > 0 ? `\uff0c\u5df2\u805a\u5408 ${escapeHtml(String(mergedEntryCount))} \u6761\u91cd\u590d\u5386\u53f2\u8bb0\u5f55` : ''}
                ${conflictCount > 0 ? `\uff0c${escapeHtml(String(conflictCount))} \u9879\u5b58\u5728\u591a\u6761\u6210\u672c\u4ef7\u8bb0\u5f55` : ''}
              </span>
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-traffic-quick-cost-action="close"
                ${state && state.quickCostDialogSaving === true ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-ops-traffic-quick-cost-action="save"
                ${state && (state.quickCostDialogLoading === true || state.quickCostDialogSaving === true) ? 'disabled' : ''}
              >
                ${state && state.quickCostDialogSaving === true ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58\u9884\u8bbe'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTrafficBoostCustomLevelFilterDialog(state) {
    if (state && state.customLevelFilterDialogOpen !== true) {
      return '';
    }

    const settings = normalizeTrafficBoostCustomLevelFilterSettings(state && state.customLevelFilterSettings);
    const appliedSettings = normalizeTrafficBoostCustomLevelFilterSettings(state && state.customLevelFilterAppliedSettings);
    const settingsLoading = state && state.customLevelFilterSettingsLoading === true;
    const settingsSaving = state && state.customLevelFilterSettingsSaving === true;
    const settingsDirty = state && state.customLevelFilterSettingsDirty === true;
    const disabled = settingsLoading || settingsSaving;
    const currentRuleText = formatTrafficBoostCustomLevelFilterRule(settings);
    const currentFloorRuleText = formatTrafficBoostCustomLevelProfitFloorRule(settings, {
      includeSubmitAction: false
    });
    const appliedRuleText = formatTrafficBoostCustomLevelFilterRule(appliedSettings);
    const appliedFloorRuleText = formatTrafficBoostCustomLevelProfitFloorRule(appliedSettings, {
      includeSubmitAction: false
    });
    const appliedAtText = normalizeText(appliedSettings && appliedSettings.updatedAt)
      ? formatDateTime(appliedSettings.updatedAt)
      : '';
    const submitFloorText = buildTrafficBoostCustomLevelSubmitFloorText(settings);

    return `
      <div class="ops-activity-quick-cost-modal" data-ops-traffic-custom-level-backdrop="true">
        <div class="ops-activity-quick-cost-dialog ops-activity-product-filter-dialog" data-ops-traffic-custom-level-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743</h3>
              <p class="ops-activity-quick-cost-subtitle">\u4ec5\u5728\u9009\u62e9\u201c\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u201d\u65f6\u751f\u6548\u3002\u9700\u8c03\u4ef7\u7684SKU\u5fc5\u987b\u5148\u5339\u914d\u6210\u672c\u4ef7\uff0c\u7f3a\u6210\u672c\u6216\u89c4\u5219\u4e0d\u901a\u8fc7\u7684SKU\u4e0d\u63d0\u4ea4\uff1b\u540c\u5546\u54c1\u5176\u4ed6\u5df2\u901a\u8fc7SKU\u4ecd\u53ef\u63d0\u4ea4\uff0c\u6700\u7ec8\u63d0\u4ea4\u4ef7\u4e0d\u4f1a\u9ad8\u4e8e\u8d85\u7ea7\u4ef7\u3002</p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-ops-traffic-custom-level-action="close"
              ${settingsSaving ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body ops-activity-product-filter-dialog-body">
            ${state && state.customLevelFilterDialogError ? `
              <div class="ops-activity-product-filter-banner is-error">${escapeHtml(state.customLevelFilterDialogError)}</div>
            ` : ''}
            ${state && state.customLevelFilterDialogWarning ? `
              <div class="ops-activity-product-filter-banner is-warning">${escapeHtml(state.customLevelFilterDialogWarning)}</div>
            ` : ''}
            ${state && state.customLevelFilterDialogNotice ? `
              <div class="ops-activity-product-filter-banner is-success">${escapeHtml(state.customLevelFilterDialogNotice)}</div>
            ` : ''}
            <section class="ops-activity-product-filter-card">
              <div class="ops-activity-product-filter-card-head">
                <span class="ops-activity-product-filter-card-step">1</span>
                <div class="ops-activity-product-filter-card-copy">
                  <strong>\u8ba1\u4ef7\u89c4\u5219</strong>
                </div>
              </div>
              <div class="ops-activity-product-filter-card-body">
                ${settingsLoading ? `
                  <div class="ops-activity-quick-cost-empty">\u6b63\u5728\u52a0\u8f7d\u81ea\u5b9a\u4e49\u6d41\u91cf\u52a0\u6743\u89c4\u5219...</div>
                ` : renderTrafficBoostCustomLevelFilterSettingsFields(settings, {
                  settingAttribute: 'data-ops-traffic-custom-level-setting',
                  disabled
                })}
              </div>
            </section>
            <section class="ops-activity-product-filter-card">
              <div class="ops-activity-product-filter-card-head">
                <span class="ops-activity-product-filter-card-step">2</span>
                <div class="ops-activity-product-filter-card-copy">
                  <strong>\u89c4\u5219\u9884\u89c8</strong>
                </div>
              </div>
              <div class="ops-activity-product-filter-card-body">
                <div class="ops-activity-product-filter-summary">
                  <span>\u8ba1\u4ef7\u89c4\u5219 ${escapeHtml(currentRuleText)}</span>
                  <span>\u4fdd\u5e95\u89c4\u5219 ${escapeHtml(currentFloorRuleText)}</span>
                  <span>${escapeHtml(submitFloorText)}</span>
                  <span>\u5168\u90e8SKU\u4ecd\u4f1a\u53d7\u201c\u4e0d\u9ad8\u4e8e\u8d85\u7ea7\u4ef7\u201d\u9650\u5236</span>
                </div>
                ${settingsDirty ? `
                  <div class="ops-activity-product-filter-card-note is-warning">\u89c4\u5219\u5df2\u53d8\u66f4\uff0c\u8bf7\u5148\u4fdd\u5b58\u540e\u518d\u67e5\u770b\u6700\u65b0\u72b6\u6001\u3002</div>
                ` : appliedAtText ? `
                  <div class="ops-activity-product-filter-card-note is-info">\u4e0a\u6b21\u4fdd\u5b58 ${escapeHtml(appliedAtText)}\uff0c\u8ba1\u4ef7\u89c4\u5219\uff1a${escapeHtml(appliedRuleText)}\uff1b\u4fdd\u5e95\u89c4\u5219\uff1a${escapeHtml(appliedFloorRuleText)}\u3002</div>
                ` : `
                  <div class="ops-activity-product-filter-card-note is-info">\u4fdd\u5b58\u540e\u8fd9\u5957\u89c4\u5219\u4f1a\u8ddf\u968f\u5f53\u524d\u8d26\u53f7\u540c\u6b65\uff0c\u540e\u7eed\u53ef\u76f4\u63a5\u590d\u7528\u3002</div>
                `}
              </div>
            </section>
          </div>
          <div class="ops-activity-quick-cost-footer ops-activity-product-filter-dialog-footer">
            <div class="ops-activity-quick-cost-actions">
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-traffic-custom-level-action="close"
                ${settingsSaving ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-ops-traffic-custom-level-action="save"
                ${disabled ? 'disabled' : ''}
              >
                ${settingsSaving ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58\u89c4\u5219'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderQueryTraceCard(state) {
    const traceEntries = Array.isArray(state && state.queryTraceEntries)
      ? state.queryTraceEntries
      : [];

    if (traceEntries.length <= 0) {
      return '';
    }

    return `
      <div class="ops-traffic-query-trace">
        <div class="ops-traffic-query-trace-head">
          <strong>\u8bf7\u6c42\u660e\u7ec6</strong>
          <span>${escapeHtml(
            state && state.queryLoading === true
              ? '\u5b9e\u65f6\u66f4\u65b0\u4e2d'
              : '\u4fdd\u7559\u6700\u8fd1\u4e00\u6b21\u67e5\u8be2\u8bb0\u5f55'
          )}</span>
        </div>
        <div class="ops-traffic-query-trace-list">
          ${traceEntries.map((entry) => {
            const title = formatQueryTraceTitle(entry);
            const meta = formatQueryTraceMeta(entry);
            const detail = formatQueryTraceDetail(entry);

            return `
              <div class="ops-traffic-query-trace-item">
                <div class="ops-traffic-query-trace-item-head">
                  <strong>${escapeHtml(title || '\u8bf7\u6c42')}</strong>
                  ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
                </div>
                ${detail ? `<div class="ops-traffic-query-trace-item-detail">${escapeHtml(detail)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderQueryStatusCard(state) {
    const currentProgress = normalizeQueryProgressPayload(state && state.queryProgress);
    const progressText = (
      isTrafficBoostSubmitProgressPayload(currentProgress)
        ? formatTrafficBoostSubmitProgressText(currentProgress)
        : formatQueryProgressText(currentProgress)
    ) || '';
    const metaText = renderQueryMetaText(state);

    return `
      <div class="ops-traffic-query-card">
        <div class="ops-traffic-query-toolbar">
          <div class="ops-traffic-query-status">
            <span class="ops-traffic-query-status-text${state && state.queryLoading === true ? ' is-running' : ''}">
              ${escapeHtml(progressText)}
            </span>
            ${metaText ? `<span class="ops-traffic-query-status-meta">${escapeHtml(metaText)}</span>` : ''}
          </div>
        </div>
        ${state && state.queryError ? `
          <div class="ops-traffic-query-alert is-error">${escapeHtml(state.queryError)}</div>
        ` : ''}
        ${state && state.queryWarning ? `
          <div class="ops-traffic-query-alert is-warning">${escapeHtml(state.queryWarning)}</div>
        ` : ''}
        ${renderQueryTraceCard(state)}
      </div>
    `;
  }

  function getTrafficBoostQueryProgressToneClass(progress) {
    const phase = normalizeText(progress && progress.phase);

    if (phase === 'failed' || phase === 'request-failed') {
      return 'is-error';
    }

    if (phase === 'completed') {
      return 'is-success';
    }

    if (phase === 'canceled') {
      return 'is-muted';
    }

    return 'is-active';
  }

  function renderTrafficBoostStatusBadges(statusSummary) {
    const badgeList = Array.isArray(statusSummary && statusSummary.badgeList)
      ? statusSummary.badgeList
      : [];

    if (badgeList.length <= 0) {
      return '<span class="ops-traffic-result-placeholder">-</span>';
    }

    return badgeList.map((badge) => {
      const tone = normalizeText(badge && badge.tone) || 'neutral';
      const label = normalizeText(badge && badge.label) || '--';
      return `<span class="ops-traffic-result-badge is-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
    }).join('');
  }

  function buildTrafficBoostResultsFeedbackItems(state) {
    const items = [];
    const progress = normalizeQueryProgressPayload(state && state.queryProgress);
    const meta = state && state.queryResultMeta ? state.queryResultMeta : null;
    const rows = Array.isArray(state && state.resultRows) ? state.resultRows : [];
    const isSubmitProgress = Boolean(
      progress
      && normalizeText(state && state.submitRequestId)
      && normalizeText(progress && progress.runId) === normalizeText(state && state.submitRequestId)
    );

    if (progress && isSubmitProgress !== true) {
      const totalShops = Math.max(
        Math.max(0, Number.parseInt(progress.totalShops, 10) || 0),
        Math.max(0, Number.parseInt(meta && meta.totalShops, 10) || 0)
      );
      const completedShops = Math.max(
        Math.max(0, Number.parseInt(progress.completedShops, 10) || 0),
        Math.max(0, Number.parseInt(meta && meta.completedShops, 10) || 0)
      );
      const failedShops = Math.max(
        Math.max(0, Number.parseInt(progress.failedShops, 10) || 0),
        Math.max(0, Number.parseInt(meta && meta.failedShops, 10) || 0)
      );
      const canceledShops = Math.max(
        Math.max(0, Number.parseInt(progress.canceledShops, 10) || 0),
        Math.max(0, Number.parseInt(meta && meta.canceledShops, 10) || 0)
      );
      let activeShops = Math.max(0, Number.parseInt(progress.activeShops, 10) || 0);
      const accumulatedItemCount = Math.max(
        Math.max(0, Number.parseInt(progress.accumulatedItemCount, 10) || 0),
        rows.length
      );
      const estimatedTotal = Math.max(0, Number.parseInt(progress.estimatedTotal, 10) || 0);
      const summaryParts = [];

      if (totalShops > 0) {
        summaryParts.push(`\u5171 ${totalShops} \u5bb6\u5e97\u94fa`);
        activeShops = Math.max(activeShops, totalShops - completedShops - failedShops - canceledShops);
      }

      if (completedShops > 0 || totalShops > 0) {
        summaryParts.push(`\u5df2\u5b8c\u6210 ${completedShops} \u5bb6`);
      }

      if (activeShops > 0) {
        summaryParts.push(`\u8fdb\u884c\u4e2d ${activeShops} \u5bb6`);
      }

      if (failedShops > 0) {
        summaryParts.push(`\u5931\u8d25 ${failedShops} \u5bb6`);
      }

      if (canceledShops > 0) {
        summaryParts.push(`\u505c\u6b62 ${canceledShops} \u5bb6`);
      }

      if (accumulatedItemCount > 0 || estimatedTotal > 0) {
        summaryParts.push(`\u5df2\u83b7\u53d6 ${accumulatedItemCount}${estimatedTotal > 0 ? `/${estimatedTotal}` : ''} \u6761`);
      }

      const summaryText = summaryParts.length > 0
        ? `${state && state.queryLoading === true ? '\u6b63\u5728\u67e5\u8be2\uff1a' : '\u672c\u6b21\u67e5\u8be2\uff1a'}${summaryParts.join('\uff0c')}`
        : '';
      const detailText = formatQueryProgressText(progress);
      const mergedText = detailText && detailText !== summaryText
        ? [summaryText, detailText].filter(Boolean).join('\uff1b')
        : (summaryText || detailText);

      if (mergedText) {
        items.push({
          tone: getTrafficBoostQueryProgressToneClass(progress),
          text: mergedText
        });
      }
    }

    if (progress && isSubmitProgress === true && !isTerminalQueryProgress(progress)) {
      const submitProgressText = formatTrafficBoostSubmitProgressText(progress);

      if (submitProgressText) {
        items.push({
          tone: getTrafficBoostQueryProgressToneClass(progress),
          text: submitProgressText
        });
      }
    }

    const submitWarningText = normalizeText(state && state.submitWarning);
    const submitNoticeText = normalizeText(state && state.submitNotice);

    if (state && state.queryError) {
      items.push({
        tone: 'is-error',
        text: state.queryError
      });
    } else if (state && state.submitError) {
      items.push({
        tone: 'is-error',
        text: state.submitError
      });
    } else if (state && state.queryWarning) {
      items.push({
        tone: 'is-warning',
        text: state.queryWarning
      });
    } else if (submitWarningText || submitNoticeText) {
      items.push({
        tone: submitWarningText ? 'is-warning' : 'is-success',
        text: [submitNoticeText, submitWarningText].filter(Boolean).join('\uff1b')
      });
    }

    const precheckText = formatTrafficBoostSubmitPrecheckText(state && state.submitPrecheckSummary);

    if (precheckText) {
      items.push({
        tone: 'is-muted',
        text: precheckText
      });
    }

    if (items.length <= 2) {
      return items;
    }

    const primaryItem = items[0];
    const secondaryItem = items.slice(1).find((item) => item && item.tone === 'is-error')
      || items.slice(1).find((item) => item && item.tone === 'is-warning')
      || items.slice(1).find((item) => item && item.tone === 'is-success');

    const mutedItem = items.slice(1).find((item) => item && item.tone === 'is-muted');
    const nextItems = secondaryItem ? [primaryItem, secondaryItem] : [primaryItem];

    if (mutedItem && !nextItems.includes(mutedItem)) {
      nextItems.push(mutedItem);
    }

    return nextItems;
  }

  function renderTrafficBoostResultsFeedback(state) {
    const items = buildTrafficBoostResultsFeedbackItems(state);
    const failProducts = Array.isArray(state && state.submitFailProducts)
      ? state.submitFailProducts
      : [];
    const failPreviewList = failProducts.slice(0, TRAFFIC_SUBMIT_FAILURE_PREVIEW_LIMIT);

    if (items.length <= 0 && failPreviewList.length <= 0) {
      return '';
    }

    return `
      <section class="ops-traffic-results-feedback">
        ${items.map((item) => `
          <div class="ops-traffic-query-alert ${escapeHtml(item.tone)}">${escapeHtml(item.text)}</div>
        `).join('')}
        ${failPreviewList.length > 0 ? `
          <div class="ops-traffic-submit-failure-panel">
            <div class="ops-traffic-submit-failure-head">
              <strong>\u5931\u8d25\u660e\u7ec6</strong>
              <span>\u663e\u793a ${escapeHtml(String(failPreviewList.length))}/${escapeHtml(String(failProducts.length))} \u6761</span>
            </div>
            <div class="ops-traffic-submit-failure-list">
              ${failPreviewList.map((item) => {
                const skuText = normalizeText(item && item.higherCustomPriceSkuId)
                  || normalizeText(item && item.withoutSkuId)
                  || (Array.isArray(item && item.missingSkuIdList) ? item.missingSkuIdList.map((value) => normalizeText(value)).filter(Boolean).slice(0, 3).join(', ') : '');
                const coverageText = Number(item && item.expectedSkuCount) > 0
                  ? `SKU ${Math.max(0, Number(item && item.submittedSkuCount) || 0)}/${Math.max(0, Number(item && item.expectedSkuCount) || 0)}`
                  : '';

                return `
                  <div class="ops-traffic-submit-failure-item">
                    <span>${escapeHtml(normalizeText(item && item.shopName) || normalizeText(item && item.shopId) || '--')}</span>
                    <span>SPU ${escapeHtml(normalizeText(item && item.productId) || '--')} / ${escapeHtml(normalizeText(item && item.siteId) || '--')}</span>
                    <span>${skuText ? `SKU ${escapeHtml(skuText)}` : '--'}</span>
                    <span>${coverageText ? escapeHtml(coverageText) : '--'}</span>
                    <strong title="${escapeHtmlAttribute(normalizeText(item && item.message))}">${escapeHtml(normalizeText(item && item.message) || '\u63d0\u4ea4\u5931\u8d25')}</strong>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    `;
  }

  function getSelectableTrafficBoostRows(state) {
    return (Array.isArray(state && state.resultRows) ? state.resultRows : [])
      .filter((row) => {
        if (!row) {
          return false;
        }

        const statusSummary = evaluateTrafficBoostRowStatus(row, state);
        return statusSummary && statusSummary.submittable === true;
      });
  }

  function buildTrafficBoostSubmitScopeSummary(state) {
    const eligibleRows = (Array.isArray(state && state.resultRows) ? state.resultRows : []).filter(Boolean);
    const eligibleProductKeySet = new Set(
      eligibleRows
        .map((row) => `${normalizeText(row && row.shopId)}:${normalizeText(row && row.siteId)}:${normalizeText(row && row.productId)}`)
        .filter((key) => key !== '::' && key !== ':::')
    );
    const eligibleShopCount = new Set(
      eligibleRows
        .map((row) => normalizeText(row && row.shopId))
        .filter(Boolean)
    ).size;
    const readyProducts = buildTrafficBoostSubmitProducts(state);
    const readyShopCount = new Set(
      readyProducts
        .map((item) => normalizeText(item && item.shopId))
        .filter(Boolean)
    ).size;

    return {
      eligibleRowCount: eligibleRows.length,
      eligibleProductCount: eligibleProductKeySet.size,
      eligibleShopCount,
      readyProductCount: readyProducts.length,
      readyShopCount
    };
  }

  function classifyTrafficBoostSubmitSkuBlockReason(result, fallbackReason) {
    const reasonText = normalizeText(result && result.reason) || normalizeText(fallbackReason);
    const resultCode = normalizeText(result && result.code);

    if (
      resultCode === 'missingCost'
      || /\u6210\u672c(?:\u4ef7|\u9884\u8bbe)?(?:\u672a\u547d\u4e2d|\u672a\u5339\u914d|\u7f3a\u5c11|\u7f3a\u5931|\u4e3a\u7a7a|\u672a\u8bbe\u7f6e)|\u672a\u5339\u914d\u6210\u672c|\u7f3a\u6210\u672c/.test(reasonText)
    ) {
      return 'missingCostSkuCount';
    }

    if (/\u7f3a\u5c11|\u672a\u751f\u6210|\u65e0\u6548|\u8bf7\u5148\u8bbe\u7f6e|\u8ba1\u7b97/.test(reasonText)) {
      return 'missingPriceSkuCount';
    }

    return 'ruleFailedSkuCount';
  }

  function buildTrafficBoostSubmitPrecheckSummary(state, products) {
    const rows = Array.isArray(state && state.resultRows) ? state.resultRows.filter(Boolean) : [];
    const selectedLevel = normalizeTrafficBoostLevel(state && state.trafficBoostLevel);
    const selectedLevelLabel = formatTrafficBoostLevelLabel(selectedLevel);
    const customSettings = resolveTrafficBoostCustomLevelStatusSettings(state);
    const submitProductKeySet = new Set(
      (Array.isArray(products) ? products : [])
        .map((item) => `${normalizeText(item && item.shopId)}:${normalizeText(item && item.siteId)}:${normalizeText(item && item.productId)}`)
        .filter((key) => key !== '::' && key !== ':::')
    );
    const submitSkuIdSet = new Set();
    const summary = {
      totalProductCount: rows.length,
      submitProductCount: submitProductKeySet.size,
      totalSkuCount: 0,
      passedSkuCount: 0,
      blockedSkuCount: 0,
      missingCostSkuCount: 0,
      ruleFailedSkuCount: 0,
      missingPriceSkuCount: 0,
      triggerLimitProductCount: 0,
      productBlockedCount: 0
    };

    (Array.isArray(products) ? products : []).forEach((productItem) => {
      (Array.isArray(productItem && productItem.skuPriceList) ? productItem.skuPriceList : []).forEach((skuItem) => {
        const productSkuId = normalizeText(skuItem && skuItem.productSkuId);

        if (productSkuId) {
          submitSkuIdSet.add(`${normalizeText(productItem && productItem.shopId)}:${normalizeText(productItem && productItem.siteId)}:${normalizeText(productItem && productItem.productId)}:${productSkuId}`);
        }
      });
    });

    rows.forEach((row) => {
      const rowKeyPrefix = `${normalizeText(row && row.shopId)}:${normalizeText(row && row.siteId)}:${normalizeText(row && row.productId)}`;
      const skuList = Array.isArray(row && row.skuPriceInfoList) ? row.skuPriceInfoList : [];
      const listedProductSkuIdList = Array.isArray(row && row.productSkuIdList)
        ? row.productSkuIdList.map((value) => normalizeText(value)).filter(Boolean)
        : [];
      const totalSkuCount = Math.max(skuList.length, listedProductSkuIdList.length);
      const canToGrow = normalizeText(row && row.canToGrow);
      const canNotSubmitReason = normalizeText(row && row.canNotSubmitReason);
      const flowLimitStatus = normalizeText(row && row.flowLimitStatus);

      if (flowLimitStatus && flowLimitStatus !== '0') {
        summary.triggerLimitProductCount += 1;
      }

      if (canToGrow === '0' || canNotSubmitReason) {
        summary.productBlockedCount += 1;
      }

      summary.totalSkuCount += totalSkuCount;

      if (skuList.length <= 0) {
        const missingCount = Math.max(0, totalSkuCount);

        summary.blockedSkuCount += missingCount;
        summary.missingPriceSkuCount += missingCount;
        return;
      }

      skuList.forEach((skuItem) => {
        const productSkuId = normalizeText(skuItem && skuItem.productSkuId);
        const skuSubmitKey = `${rowKeyPrefix}:${productSkuId}`;

        if (submitSkuIdSet.has(skuSubmitKey)) {
          summary.passedSkuCount += 1;
          return;
        }

        summary.blockedSkuCount += 1;

        if (selectedLevel === 'custom') {
          const customResult = computeTrafficBoostCustomSkuResult(skuItem, customSettings);
          summary[classifyTrafficBoostSubmitSkuBlockReason(customResult)] += 1;
          return;
        }

        const priceField = resolveTrafficBoostLevelPriceField(selectedLevel);
        const targetPrice = Number(skuItem && skuItem[priceField]);
        const blockField = Number.isFinite(targetPrice) && targetPrice > 0
          ? 'ruleFailedSkuCount'
          : classifyTrafficBoostSubmitSkuBlockReason(null, `\u7f3a\u5c11${selectedLevelLabel}\u4ef7`);

        summary[blockField] += 1;
      });
    });

    return summary;
  }

  function formatTrafficBoostSubmitPrecheckText(summary) {
    if (!summary || typeof summary !== 'object') {
      return '';
    }

    const totalProductCount = Math.max(0, Number(summary.totalProductCount) || 0);
    const submitProductCount = Math.max(0, Number(summary.submitProductCount) || 0);
    const totalSkuCount = Math.max(0, Number(summary.totalSkuCount) || 0);
    const passedSkuCount = Math.max(0, Number(summary.passedSkuCount) || 0);
    const parts = [
      `\u63d0\u4ea4\u524d\u9884\u68c0\uff1a${submitProductCount}/${totalProductCount} \u4e2a\u5546\u54c1\u5c06\u9001\u63d0`,
      `${passedSkuCount}/${totalSkuCount || passedSkuCount} \u4e2aSKU\u901a\u8fc7`
    ];
    const missingCostSkuCount = Math.max(0, Number(summary.missingCostSkuCount) || 0);
    const ruleFailedSkuCount = Math.max(0, Number(summary.ruleFailedSkuCount) || 0);
    const missingPriceSkuCount = Math.max(0, Number(summary.missingPriceSkuCount) || 0);
    const triggerLimitProductCount = Math.max(0, Number(summary.triggerLimitProductCount) || 0);
    const productBlockedCount = Math.max(0, Number(summary.productBlockedCount) || 0);

    if (missingCostSkuCount > 0) {
      parts.push(`\u7f3a\u6210\u672c ${missingCostSkuCount} \u4e2aSKU\u5df2\u62e6\u622a`);
    }

    if (ruleFailedSkuCount > 0) {
      parts.push(`\u4e0d\u7b26\u5408\u89c4\u5219 ${ruleFailedSkuCount} \u4e2aSKU\u5df2\u62e6\u622a`);
    }

    if (missingPriceSkuCount > 0) {
      parts.push(`\u7f3a\u4ef7\u683c/\u660e\u7ec6 ${missingPriceSkuCount} \u4e2aSKU\u5df2\u62e6\u622a`);
    }

    if (productBlockedCount > 0) {
      parts.push(`\u5546\u54c1\u7ea7\u4e0d\u53ef\u63d0\u4ea4 ${productBlockedCount} \u4e2a`);
    }

    if (triggerLimitProductCount > 0) {
      parts.push(`\u89e6\u53d1\u9650\u5236 ${triggerLimitProductCount} \u4e2a\u5546\u54c1\u4e0d\u518d\u62e6\u622a`);
    }

    return parts.join('\uff1b');
  }

  function refreshTrafficBoostSubmitScopeSummary(state) {
    state.submitScopeSummary = buildTrafficBoostSubmitScopeSummary(state);
    return state.submitScopeSummary;
  }

  function getSelectedTrafficBoostRows(state) {
    const summary = state && state.submitScopeSummary && typeof state.submitScopeSummary === 'object'
      ? state.submitScopeSummary
      : refreshTrafficBoostSubmitScopeSummary(state);

    if (!summary || summary.eligibleRowCount <= 0) {
      return [];
    }

    return getSelectableTrafficBoostRows(state);
  }

  function formatTrafficBoostSubmitScopeText(state) {
    const summary = state && state.submitScopeSummary && typeof state.submitScopeSummary === 'object'
      ? state.submitScopeSummary
      : refreshTrafficBoostSubmitScopeSummary(state);

    if (!summary || summary.eligibleRowCount <= 0) {
      return '';
    }

    const eligibleRowCount = Math.max(0, Number(summary.eligibleRowCount) || 0);
    const eligibleProductCount = Math.max(0, Number(summary.eligibleProductCount) || 0);
    const readyProductCount = Math.max(0, Number(summary.readyProductCount) || 0);
    const readyShopCount = Math.max(0, Number(summary.readyShopCount) || 0);

    if (eligibleRowCount <= 0 && readyProductCount <= 0) {
      return '';
    }

    const resultSummaryText = eligibleProductCount > 0 && eligibleProductCount !== eligibleRowCount
      ? `\u5f53\u524d\u7ed3\u679c ${eligibleRowCount} \u6761 / ${eligibleProductCount} \u4e2a\u5546\u54c1`
      : `\u5f53\u524d\u7ed3\u679c ${Math.max(eligibleProductCount, eligibleRowCount)} \u4e2a\u5546\u54c1`;

    if (readyProductCount > 0) {
      return `${resultSummaryText}\uff0c\u53ef\u63d0\u4ea4 ${readyProductCount} \u4e2a\u5546\u54c1\uff0c\u6d89\u53ca ${readyShopCount || summary.eligibleShopCount} \u5bb6\u5e97\u94fa`;
    }

    return `${resultSummaryText}\uff0c\u6d89\u53ca ${summary.eligibleShopCount} \u5bb6\u5e97\u94fa`;
  }

  function buildTrafficBoostSubmitProducts(state) {
    const selectedRows = getSelectedTrafficBoostRows(state);
    const selectedLevel = normalizeTrafficBoostLevel(state && state.trafficBoostLevel);
    const submitLevel = mapTrafficBoostLevelToSubmitLevel(selectedLevel);
    const submitDays = mapTrafficBoostDurationToSubmitDays(state && state.trafficBoostDuration);
    const isAutoRenew = shouldShowTrafficBoostAutoRenew(state && state.trafficBoostDuration)
      ? state && state.trafficBoostAutoRenew === true
      : false;
    const customSettings = resolveTrafficBoostCustomLevelStatusSettings(state);

    const mergedProductMap = new Map();

    selectedRows.forEach((row) => {
      const allSkuPriceInfoList = Array.isArray(row && row.skuPriceInfoList) ? row.skuPriceInfoList : [];
      const skuPriceList = allSkuPriceInfoList
        .map((skuItem) => {
          if (selectedLevel === 'custom') {
            const customResult = computeTrafficBoostCustomSkuResult(skuItem, customSettings);
            const productSkuId = normalizeText(skuItem && skuItem.productSkuId);
            const sourceSupplierPrice = Number(skuItem && skuItem.supplierPrice);

            if (!productSkuId || !(Number.isFinite(sourceSupplierPrice) && sourceSupplierPrice > 0)) {
              return null;
            }

            if (customResult.status !== 'ready' || !(Number.isFinite(customResult.targetPrice) && customResult.targetPrice > 0)) {
              return null;
            }

            return {
              productSkuId,
              supplierPrice: Math.round(sourceSupplierPrice),
              targetSupplierPrice: Math.round(customResult.targetPrice),
              customFlowSupplierPrice: Math.round(customResult.targetPrice),
              preSupplierPrice: Math.round(sourceSupplierPrice),
              currencyType: normalizeText(skuItem && skuItem.currencyType) || 'CNY'
            };
          }

          const priceField = resolveTrafficBoostLevelPriceField(selectedLevel);
          const targetPrice = Number(skuItem && skuItem[priceField]);

          if (!(Number.isFinite(targetPrice) && targetPrice > 0)) {
            return null;
          }

          return {
            productSkuId: normalizeText(skuItem && skuItem.productSkuId),
            supplierPrice: Math.round(targetPrice),
            currencyType: normalizeText(skuItem && skuItem.currencyType) || 'CNY'
          };
        })
        .filter(Boolean);
      const submitSkuIdSet = new Set(
        skuPriceList
          .map((skuItem) => normalizeText(skuItem && skuItem.productSkuId))
          .filter(Boolean)
      );
      const expectedProductSkuIdList = Array.from(submitSkuIdSet);
      const sourceProductSkuIdList = Array.from(new Set(
        []
          .concat(allSkuPriceInfoList.map((skuItem) => normalizeText(skuItem && skuItem.productSkuId)))
          .concat(Array.isArray(row && row.productSkuIdList) ? row.productSkuIdList : [])
          .map((value) => normalizeText(value))
          .filter(Boolean)
      ));

      if (
        skuPriceList.length <= 0
        || submitSkuIdSet.size <= 0
      ) {
        return;
      }
      const normalizedProduct = {
        shopId: normalizeText(row && row.shopId),
        shopName: normalizeText(row && row.shopName),
        marketRegion: normalizeMarketRegion(row && row.marketRegion),
        siteId: normalizeText(row && row.siteId),
        productId: normalizeText(row && row.productId),
        productName: normalizeText(row && row.productName),
        isAutoRenew,
        increaseFlowLevel: submitLevel,
        increaseFlowDays: submitDays,
        expectedProductSkuIdList,
        sourceProductSkuIdList,
        forceSkuDetailHydrate: sourceProductSkuIdList.length > submitSkuIdSet.size,
        skuPriceList
      };
      const productKey = `${normalizedProduct.shopId}:${normalizedProduct.siteId}:${normalizedProduct.productId}`;

      if (productKey === '::' || productKey === ':::') {
        return;
      }

      const existingProduct = mergedProductMap.get(productKey);

      if (!existingProduct) {
        mergedProductMap.set(productKey, normalizedProduct);
        return;
      }

      const mergedSkuPriceMap = new Map(
        (Array.isArray(existingProduct.skuPriceList) ? existingProduct.skuPriceList : [])
          .map((skuItem) => [normalizeText(skuItem && skuItem.productSkuId), skuItem])
          .filter((item) => item[0])
      );

      skuPriceList.forEach((skuItem) => {
        const skuKey = normalizeText(skuItem && skuItem.productSkuId);

        if (!skuKey) {
          return;
        }

        mergedSkuPriceMap.set(skuKey, skuItem);
      });

      mergedProductMap.set(productKey, {
        ...existingProduct,
        shopName: existingProduct.shopName || normalizedProduct.shopName,
        productName: existingProduct.productName || normalizedProduct.productName,
        expectedProductSkuIdList: Array.from(new Set(
          []
            .concat(Array.isArray(existingProduct.expectedProductSkuIdList) ? existingProduct.expectedProductSkuIdList : [])
            .concat(Array.isArray(normalizedProduct.expectedProductSkuIdList) ? normalizedProduct.expectedProductSkuIdList : [])
            .map((value) => normalizeText(value))
            .filter(Boolean)
        )),
        skuPriceList: Array.from(mergedSkuPriceMap.values())
      });
    });

    return Array.from(mergedProductMap.values());
  }

  function renderTrafficBoostSummaryChips(state) {
    const meta = state && state.queryResultMeta ? state.queryResultMeta : null;
    const rows = Array.isArray(state && state.resultRows) ? state.resultRows : [];
    const hasContext = rows.length > 0 || Boolean(meta) || Boolean(normalizeText(state && state.queryRunId));
    const chipList = [];

    if (!hasContext) {
      return '';
    }

    chipList.push(`\u7ed3\u679c ${rows.length}\u6761`);

    if (meta && Number(meta.totalShops) > 0) {
      chipList.push(`\u5b8c\u6210 ${meta.completedShops}/${meta.totalShops}\u5bb6`);
    }

    if (meta && Number(meta.failedShops) > 0) {
      chipList.push(`\u5931\u8d25 ${meta.failedShops}\u5bb6`);
    }

    if (meta && Number(meta.canceledShops) > 0) {
      chipList.push(`\u505c\u6b62 ${meta.canceledShops}\u5bb6`);
    }

    return chipList.map((text) => (
      `<span class="ops-traffic-results-summary-chip">${escapeHtml(text)}</span>`
    )).join('');
  }

  function renderTrafficBoostResultsHead(state) {
    const summaryChipsMarkup = renderTrafficBoostSummaryChips(state);
    const queryMetaText = renderQueryMetaText(state);
    const submitScopeText = formatTrafficBoostSubmitScopeText(state);
    const uniqueHeadMetaTexts = Array.from(new Set(
      [queryMetaText, submitScopeText]
        .map((text) => normalizeText(text))
        .filter(Boolean)
    ));

    return `
      <div class="ops-traffic-results-head" data-ops-traffic-results-head>
        <div class="ops-traffic-results-head-copy">
          <strong>\u5546\u54c1\u5217\u8868</strong>
          ${uniqueHeadMetaTexts.map((text) => `<span>${escapeHtml(text)}</span>`).join('')}
        </div>
        ${summaryChipsMarkup ? `
          <div class="ops-traffic-results-summary">
            ${summaryChipsMarkup}
          </div>
        ` : ''}
      </div>
    `;
  }

  function resolveTrafficBoostResultRowHeight(row) {
    const skuCount = Math.max(
      0,
      Number.parseInt(row && row.skuPriceInfoCount, 10)
      || (Array.isArray(row && row.skuPriceInfoList) ? row.skuPriceInfoList.length : 0)
      || (Array.isArray(row && row.productSkuIdList) ? row.productSkuIdList.length : 0)
      || 0
    );

    return skuCount === 1
      ? TRAFFIC_RESULT_SINGLE_SKU_ROW_HEIGHT
      : TRAFFIC_RESULT_ROW_HEIGHT;
  }

  function getTrafficBoostRowMetrics(state, rows) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const cachedMetrics = state && state.resultRowMetricsCache && typeof state.resultRowMetricsCache === 'object'
      ? state.resultRowMetricsCache
      : null;

    if (cachedMetrics && cachedMetrics.rows === normalizedRows) {
      return cachedMetrics;
    }

    const rowMetaList = [];
    let runningOffsetTop = 0;

    normalizedRows.forEach((row, index) => {
      const height = resolveTrafficBoostResultRowHeight(row);

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

    if (state && typeof state === 'object') {
      state.resultRowMetricsCache = nextMetrics;
    }

    return nextMetrics;
  }

  function findTrafficBoostRowIndexByOffset(rowMetaList, offset, options = {}) {
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

  function computeTrafficBoostVirtualRange(rows, scrollTop, viewportHeight, state) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const normalizedRowCount = normalizedRows.length;
    const normalizedScrollTop = Math.max(0, Number(scrollTop) || 0);
    const normalizedViewportHeight = Math.max(0, Number(viewportHeight) || 0);
    const effectiveScrollTop = Math.max(0, normalizedScrollTop - TRAFFIC_RESULT_HEAD_HEIGHT);
    const effectiveViewportHeight = Math.max(0, normalizedViewportHeight - TRAFFIC_RESULT_HEAD_HEIGHT);
    const metrics = getTrafficBoostRowMetrics(state, normalizedRows);
    const rowMetaList = metrics.rowMetaList;
    let startIndex = findTrafficBoostRowIndexByOffset(rowMetaList, effectiveScrollTop, {
      compareTopOnly: false
    });
    startIndex = Math.max(0, startIndex - TRAFFIC_RESULT_OVERSCAN);
    const viewportBottom = effectiveScrollTop + effectiveViewportHeight;
    let endIndex = findTrafficBoostRowIndexByOffset(rowMetaList, viewportBottom, {
      compareTopOnly: true
    });

    endIndex = Math.min(
      normalizedRowCount,
      Math.max(startIndex + 12, endIndex + TRAFFIC_RESULT_OVERSCAN)
    );
    const startRowMeta = rowMetaList[startIndex] || null;

    return {
      startIndex,
      endIndex,
      offsetTop: startRowMeta ? startRowMeta.offsetTop : 0,
      totalHeight: metrics.totalHeight
    };
  }

  function renderTrafficBoostResultRow(row, rowIndex, state) {
    const productName = normalizeText(row && row.productName) || normalizeText(row && row.goodsName) || '--';
    const categoryText = normalizeText(row && row.categoryPathText) || normalizeText(row && row.categoryName) || '--';
    const marketRegionLabel = getMarketRegionLabel(row && row.marketRegion);
    const imageUrl = normalizeText(row && row.mainImageUrl);
    const thumbUrl = buildSizedImageUrl(imageUrl, PRODUCT_THUMBNAIL_SIZE) || imageUrl;
    const activityDisplay = buildTrafficBoostActivityDisplay(row);
    const statusSummary = evaluateTrafficBoostRowStatus(row, state);

    const rowHeight = resolveTrafficBoostResultRowHeight(row);
    const rowClassName = rowHeight <= TRAFFIC_RESULT_SINGLE_SKU_ROW_HEIGHT
      ? ' ops-traffic-results-row-single-sku'
      : '';

    return `
      <div class="ops-traffic-results-grid ops-traffic-results-row${rowClassName}" data-row-key="${escapeHtml(normalizeText(row && row.rowKey) || String(rowIndex))}" style="height:${rowHeight}px;">
        <div class="ops-traffic-result-cell is-shop">
          <div class="ops-traffic-result-primary-line">
            <strong class="ops-traffic-result-title">${escapeHtml(normalizeText(row && row.shopName) || '--')}</strong>
            <span class="ops-traffic-result-region">${escapeHtml(marketRegionLabel)}</span>
          </div>
          <span class="ops-traffic-result-subline">${escapeHtml(normalizeText(row && row.supplierName) || '--')}</span>
          <span class="ops-traffic-result-subline">
            ${escapeHtml(normalizeText(row && row.siteName) || '--')} \u00b7 ID ${escapeHtml(normalizeText(row && row.siteId) || '--')} \u00b7 #${escapeHtml(String(rowIndex + 1))}
          </span>
        </div>
        <div class="ops-traffic-result-cell is-product">
          <div class="ops-traffic-result-product">
            ${thumbUrl
              ? `<img class="ops-traffic-result-thumb" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(productName)}" loading="lazy" />`
              : '<div class="ops-traffic-result-thumb is-empty">No Image</div>'}
            <div class="ops-traffic-result-product-copy">
              <strong class="ops-traffic-result-title" title="${escapeHtml(productName)}">${escapeHtml(productName)}</strong>
              <span class="ops-traffic-result-subline">SPU ${escapeHtml(normalizeText(row && row.productId) || '--')} \u00b7 Goods ${escapeHtml(normalizeText(row && row.goodsId) || '--')}</span>
              <span class="ops-traffic-result-subline is-clamp" title="${escapeHtml(categoryText)}">${escapeHtml(categoryText)}</span>
              <span class="ops-traffic-result-subline">\u9996\u6b21\u52a0\u7ad9 ${escapeHtml(normalizeText(row && row.firstBindSiteTimeStr) || '--')}</span>
            </div>
          </div>
        </div>
        <div class="ops-traffic-result-cell is-activity">
          ${activityDisplay.hasActivity
            ? `
              ${activityDisplay.tagList.length > 0 ? `
                <div class="ops-traffic-result-activity-tag-list">
                  ${activityDisplay.tagList.map((tag) => (
                    `<span class="ops-traffic-result-activity-tag" title="${escapeHtmlAttribute(buildTrafficBoostActivityTooltipText(tag.label, tag.detailText, tag.count))}">${escapeHtml(tag.label)}</span>`
                  )).join('')}
                </div>
              ` : `
                <div class="ops-traffic-result-activity-tag-list">
                  <span class="ops-traffic-result-activity-tag" title="${escapeHtmlAttribute(activityDisplay.fallbackTooltipText)}">\u6d3b\u52a8\u8be6\u60c5</span>
                </div>
              `}
              ${activityDisplay.helperText ? `<span class="ops-traffic-result-subline">${escapeHtml(activityDisplay.helperText)}</span>` : ''}
            `
            : `<span class="ops-traffic-result-placeholder">\u6682\u65e0\u6d3b\u52a8</span>`}
        </div>
        <div class="ops-traffic-result-cell is-sku">
          ${renderTrafficBoostSkuPriceBlocks(row, state)}
        </div>
        <div class="ops-traffic-result-cell is-status">
          <div class="ops-traffic-result-badge-list">
            ${renderTrafficBoostStatusBadges(statusSummary)}
          </div>
          ${normalizeText(statusSummary && statusSummary.detailText)
            ? `<span class="ops-traffic-result-subline is-clamp-3" title="${escapeHtml(normalizeText(statusSummary && statusSummary.detailText))}">${escapeHtml(normalizeText(statusSummary && statusSummary.detailText))}</span>`
            : (normalizeText(row && row.flowPriceInfoWarning)
              ? `<span class="ops-traffic-result-subline is-clamp-3" title="${escapeHtml(normalizeText(row && row.flowPriceInfoWarning))}">${escapeHtml(normalizeText(row && row.flowPriceInfoWarning))}</span>`
              : '')}
        </div>
      </div>
    `;
  }

  function renderTrafficBoostVirtualResultRows(rows, startIndex, state) {
    return (Array.isArray(rows) ? rows : []).map((row, index) => {
      return renderTrafficBoostResultRow(row, startIndex + index, state);
    }).join('');
  }

  function shouldUseCollapsedTrafficResultsLayout(container, viewport) {
    const viewportWidth = Math.max(
      0,
      Number(
        (viewport && viewport.clientWidth)
        || (container && container.clientWidth)
        || 0
      ) || 0
    );

    return viewportWidth > 0 && viewportWidth <= TRAFFIC_RESULT_COLLAPSE_WIDTH;
  }

  function renderTrafficBoostResultsViewport(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const state = getState(container);
    const rows = Array.isArray(state && state.resultRows) ? state.resultRows : [];
    const workbench = container.querySelector('[data-ops-traffic-workbench]');
    const viewport = container.querySelector('[data-ops-traffic-results-viewport]');
    const virtualBody = container.querySelector('[data-ops-traffic-results-virtual-body]');
    const virtualWindow = container.querySelector('[data-ops-traffic-results-virtual-window]');

    if (
      !(viewport instanceof HTMLElement)
      || !(virtualBody instanceof HTMLElement)
      || !(virtualWindow instanceof HTMLElement)
    ) {
      return;
    }

    const useCollapsedLayout = shouldUseCollapsedTrafficResultsLayout(container, viewport);
    if (workbench instanceof HTMLElement) {
      workbench.classList.toggle('ops-traffic-results-collapsed', useCollapsedLayout);
    }

    if (useCollapsedLayout) {
      virtualBody.style.height = 'auto';
      virtualWindow.style.transform = 'none';
      virtualWindow.innerHTML = renderTrafficBoostVirtualResultRows(rows, 0, state);
      return;
    }

    const range = computeTrafficBoostVirtualRange(
      rows,
      state.resultViewportScrollTop,
      viewport.clientHeight,
      state
    );
    const visibleRows = rows.slice(range.startIndex, range.endIndex);

    virtualBody.style.height = `${range.totalHeight}px`;
    virtualWindow.style.transform = `translateY(${range.offsetTop}px)`;
    virtualWindow.innerHTML = renderTrafficBoostVirtualResultRows(visibleRows, range.startIndex, state);
  }

  function restoreTrafficBoostResultsViewport(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const state = getState(container);
    const viewport = container.querySelector('[data-ops-traffic-results-viewport]');

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    renderTrafficBoostResultsViewport(container);

    const desiredTop = Math.max(0, Number(state.resultViewportScrollTop) || 0);
    const desiredLeft = Math.max(0, Number(state.resultViewportScrollLeft) || 0);

    if (Math.abs(viewport.scrollTop - desiredTop) > 1) {
      viewport.scrollTop = desiredTop;
    }

    if (Math.abs(viewport.scrollLeft - desiredLeft) > 1) {
      viewport.scrollLeft = desiredLeft;
    }

    renderTrafficBoostResultsViewport(container);
  }

  function scheduleTrafficBoostResultsViewportRestore(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (container.__opsTrafficResultsViewportFrameId) {
      window.cancelAnimationFrame(container.__opsTrafficResultsViewportFrameId);
    }

    container.__opsTrafficResultsViewportFrameId = window.requestAnimationFrame(() => {
      container.__opsTrafficResultsViewportFrameId = 0;
      restoreTrafficBoostResultsViewport(container);
    });
  }

  function scheduleTrafficBoostResultsViewportRefresh(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (container.__opsTrafficResultsViewportRefreshFrameId) {
      window.cancelAnimationFrame(container.__opsTrafficResultsViewportRefreshFrameId);
    }

    container.__opsTrafficResultsViewportRefreshFrameId = window.requestAnimationFrame(() => {
      container.__opsTrafficResultsViewportRefreshFrameId = 0;
      renderTrafficBoostResultsViewport(container);
    });
  }

  function captureShopSelectorPanelScroll(container) {
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

  function restoreShopSelectorPanelScroll(container, snapshot) {
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

  function renderResultsCard(state) {
    const rows = Array.isArray(state && state.resultRows) ? state.resultRows : [];
    const feedbackMarkup = renderTrafficBoostResultsFeedback(state);
    const emptyTitleText = state && state.queryLoading === true
      ? '\u6b63\u5728\u67e5\u8be2\u5546\u54c1\u5217\u8868...'
      : '';
    const emptyDetailText = state && state.queryLoading === true
      ? (formatQueryProgressText(state.queryProgress) || '\u8bf7\u7a0d\u5019...')
      : '';
    const emptyStateMarkup = `
      <div class="ops-traffic-results-empty ops-traffic-results-empty-table">
        ${emptyTitleText ? `<strong>${escapeHtml(emptyTitleText)}</strong>` : ''}
        ${emptyDetailText ? `<span>${escapeHtml(emptyDetailText)}</span>` : ''}
      </div>
    `;

    return `
      <div class="ops-traffic-results-card">
        ${renderTrafficBoostResultsHead(state)}
        <div data-ops-traffic-results-feedback-slot>${feedbackMarkup}</div>
        <div class="ops-traffic-results-table-shell">
          <div class="ops-traffic-results-viewport" data-ops-traffic-results-viewport>
            <div class="ops-traffic-results-table-virtual">
              <div class="ops-traffic-results-grid ops-traffic-results-grid-head">
                <div class="ops-traffic-results-head-cell">\u5e97\u94fa / \u7ad9\u70b9</div>
                <div class="ops-traffic-results-head-cell">\u5546\u54c1\u4fe1\u606f</div>
                <div class="ops-traffic-results-head-cell">\u6d3b\u52a8</div>
                <div class="ops-traffic-results-head-cell">SKU</div>
                <div class="ops-traffic-results-head-cell">\u72b6\u6001</div>
              </div>
              ${rows.length > 0 ? `
                <div class="ops-traffic-results-virtual-body" data-ops-traffic-results-virtual-body>
                  <div class="ops-traffic-results-virtual-window" data-ops-traffic-results-virtual-window></div>
                </div>
              ` : `
                <div class="ops-traffic-results-table-empty-shell">
                  ${emptyStateMarkup}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderEnablePanel(state, active) {
    return `
      <section
        class="ops-traffic-panel${active ? ' is-active' : ''}"
        data-ops-traffic-panel="enable"
        role="tabpanel"
        aria-label="\u5f00\u542f\u6d41\u91cf\u52a0\u901f"
        ${active ? '' : 'hidden'}
      >
        <div class="ops-traffic-enable-card">
          <div class="ops-traffic-enable-card-body">
            ${renderShopSelectorField(state)}
            ${renderMarketRegionField(state)}
            ${renderStationSelectorField(state)}
            ${renderCategorySelectorField(state)}
            ${renderProductIdField(state)}
            ${renderProductNameField(state)}
            ${renderJoinDateField(state)}
            ${renderTrafficProductMetricField(state)}
            ${renderTrafficPaymentMetricField(state)}
            ${renderTrafficConversionMetricField(state)}
            ${renderQueryActionButtons(state)}
          </div>
        </div>
        ${renderQuickCostEntryCard(state)}
        ${renderResultsCard(state)}
      </section>
    `;
  }

  function renderManagementPanel(active) {
    return `
      <section
        class="ops-traffic-panel${active ? ' is-active' : ''}"
        data-ops-traffic-panel="management"
        role="tabpanel"
        aria-label="\u7ba1\u7406\u6d41\u91cf\u52a0\u901f"
        ${active ? '' : 'hidden'}
      >
        <div class="ops-traffic-placeholder">
          <p class="ops-traffic-placeholder-title">\u7ba1\u7406\u6d41\u91cf\u52a0\u901f</p>
          <p class="ops-traffic-placeholder-text">
            \u5f53\u524d\u4f18\u5148\u63a5\u5165\u201c\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u201d\u7684\u67e5\u8be2\u4e0e\u5546\u54c1\u5217\u8868\uff0c
            \u7ba1\u7406\u9762\u677f\u540e\u7eed\u518d\u7ee7\u7eed\u6269\u5c55\u3002
          </p>
        </div>
      </section>
    `;
  }

  function renderPanels(state, activeTabId) {
    return TAB_CONFIG.map((tab) => {
      if (tab.id === 'enable') {
        return renderEnablePanel(state, tab.id === activeTabId);
      }

      return renderManagementPanel(tab.id === activeTabId);
    }).join('');
  }

  function render(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const state = getState(container);
    const activeTabId = normalizeTabId(state.activeTabId);
    const shopSelectorPanelScrollSnapshot = options.preserveShopSelectorPanelScroll === true
      ? captureShopSelectorPanelScroll(container)
      : null;
    const activeTabConfig = getTrafficTabConfig(activeTabId);
    const trafficHeaderText = normalizeText(activeTabConfig && activeTabConfig.label) || '\u6d41\u91cf\u52a0\u901f';

    state.activeTabId = activeTabId;
    container.dataset.activeOpsTrafficTab = activeTabId;
    container.innerHTML = `
      <section class="ops-traffic-workbench" data-ops-traffic-workbench>
        <header class="ops-traffic-header">
          <div class="ops-traffic-header-copy">
            <p class="ops-traffic-eyebrow">\u6d41\u91cf\u52a0\u901f</p>
            <h2 class="ops-traffic-title">${escapeHtml(trafficHeaderText)}</h2>
          </div>
          <div class="ops-traffic-tab-row" role="tablist" aria-label="\u6d41\u91cf\u52a0\u901f\u529f\u80fd\u5207\u6362">
            ${TAB_CONFIG.map((tab) => `
              <button
                class="ops-traffic-tab${tab.id === activeTabId ? ' is-active' : ''}"
                type="button"
                data-ops-traffic-tab="${escapeHtml(tab.id)}"
                role="tab"
                aria-selected="${tab.id === activeTabId ? 'true' : 'false'}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `).join('')}
          </div>
        </header>
        <section class="ops-traffic-panels">
          ${renderPanels(state, activeTabId)}
        </section>
        ${renderTrafficBoostCustomLevelFilterDialog(state)}
        ${renderTrafficBoostQuickCostDialog(state)}
      </section>
    `;

    if (state.shopSelectorOpen === true && state.shopSelectorFocusSearch === true) {
      state.shopSelectorFocusSearch = false;
      window.requestAnimationFrame(() => {
        const searchInput = container.querySelector('[data-shop-multi-select-search]');

        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
          searchInput.select();
        }
      });
    }

    if (state.categorySelectorOpen === true && state.categorySearchFocusInput === true) {
      state.categorySearchFocusInput = false;
      window.requestAnimationFrame(() => {
        const searchInput = container.querySelector('[data-category-cascade-search]');

        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
          searchInput.select();
        }
      });
    }

    if (shopSelectorPanelScrollSnapshot) {
      restoreShopSelectorPanelScroll(container, shopSelectorPanelScrollSnapshot);
    }

    scheduleTrafficBoostResultsViewportRestore(container);
  }

  function refreshTrafficBoostLiveProgressUi(container) {
    if (!(container instanceof HTMLElement)) {
      return false;
    }

    const state = getState(container);
    let updated = false;
    const quickCostCard = container.querySelector('[data-ops-traffic-quick-cost-entry-card]');

    if (quickCostCard instanceof HTMLElement) {
      quickCostCard.outerHTML = renderQuickCostEntryCard(state);
      updated = true;
    }

    const resultsHead = container.querySelector('[data-ops-traffic-results-head]');

    if (resultsHead instanceof HTMLElement) {
      resultsHead.outerHTML = renderTrafficBoostResultsHead(state);
      updated = true;
    }

    const feedbackSlot = container.querySelector('[data-ops-traffic-results-feedback-slot]');

    if (feedbackSlot instanceof HTMLElement) {
      feedbackSlot.innerHTML = renderTrafficBoostResultsFeedback(state);
      updated = true;
    }

    return updated;
  }

  async function loadShopCatalog(container, options = {}) {
    const state = getState(container);
    const control = getShopMultiSelectControl();

    if (!control || typeof control.loadShopCatalog !== 'function') {
      state.shopSelectorLoaded = true;
      state.shopSelectorError = '\u5e97\u94fa\u7b5b\u9009\u63a7\u4ef6\u672a\u52a0\u8f7d';
      render(container);
      return state.shopCatalog;
    }

    if (state.shopSelectorLoading === true && state.shopSelectorPromise) {
      return state.shopSelectorPromise;
    }

    if (options.force !== true && state.shopSelectorLoaded === true) {
      return state.shopCatalog;
    }

    state.shopSelectorLoading = true;
    state.shopSelectorError = '';
    render(container);

    state.shopSelectorPromise = control.loadShopCatalog()
      .then((catalog) => {
        state.shopCatalog = catalog && typeof catalog === 'object'
          ? catalog
          : buildEmptyShopCatalog();
        state.shopSelectorLoaded = true;
        state.shopSelectorError = '';
        state.selectedShopIds = normalizeSelectedShopIds(state.selectedShopIds)
          .filter((shopId) => Boolean(state.shopCatalog.shopMap && state.shopCatalog.shopMap[shopId]));
        return state.shopCatalog;
      })
      .catch((error) => {
        state.shopCatalog = buildEmptyShopCatalog();
        state.shopSelectorLoaded = true;
        state.shopSelectorError = normalizeText(error && error.message) || '\u5e97\u94fa\u5217\u8868\u52a0\u8f7d\u5931\u8d25';
        return state.shopCatalog;
      })
      .finally(() => {
        state.shopSelectorLoading = false;
        state.shopSelectorPromise = null;
        render(container);
      });

    return state.shopSelectorPromise;
  }

  async function loadShopSelectionPresetSnapshot(container, options = {}) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.loadSnapshot !== 'function') {
      return state.shopSelectionPreset;
    }

    return helper.loadSnapshot(state.shopSelectionPreset, {
      force: options.force === true,
      onChange: () => render(container, {
        preserveShopSelectorPanelScroll: true
      })
    });
  }

  async function saveShopSelectionLast(container, selectedShopIds) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.saveLastSelection !== 'function') {
      return null;
    }

    return helper.saveLastSelection(state.shopSelectionPreset, selectedShopIds);
  }

  async function saveShopSelectionTemplate(container) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.saveTemplate !== 'function') {
      return null;
    }

    return helper.saveTemplate(state.shopSelectionPreset, state.selectedShopIds, {
      onChange: () => render(container, {
        preserveShopSelectorPanelScroll: true
      })
    });
  }

  async function deleteShopSelectionTemplate(container, templateId) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.deleteTemplate !== 'function') {
      return null;
    }

    return helper.deleteTemplate(state.shopSelectionPreset, templateId, {
      onChange: () => render(container, {
        preserveShopSelectorPanelScroll: true
      })
    });
  }

  async function loadShopSelectionPreference(container, options = {}) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.getLastSelectionIds !== 'function') {
      return state.selectedShopIds;
    }

    if (options.force !== true && state.shopSelectionTouched === true) {
      return state.selectedShopIds;
    }

    const selectedShopIds = helper.getLastSelectionIds(state.shopSelectionPreset);

    if (selectedShopIds.length <= 0) {
      return state.selectedShopIds;
    }

    state.selectedShopIds = normalizePresetShopSelection(state, selectedShopIds);
    render(container);
    return state.selectedShopIds;
  }

  function applyShopSelectionPreset(container, selectedShopIds) {
    const state = getState(container);
    const nextSelectedShopIds = normalizePresetShopSelection(state, selectedShopIds);

    if (nextSelectedShopIds.length <= 0) {
      return;
    }

    state.selectedShopIds = nextSelectedShopIds;
    state.shopSelectionTouched = true;
    void saveShopSelectionLast(container, nextSelectedShopIds);
    render(container, {
      preserveShopSelectorPanelScroll: true
    });
  }

  function getCategoryChildCacheKey(parentCatId) {
    return normalizeText(parentCatId);
  }

  function buildCategoryColumns(state) {
    const snapshot = normalizeCategorySnapshot(state.categorySnapshot);
    const selectedPath = normalizeCategoryPath(state.categorySelectedPath).slice(0, MAX_CATEGORY_LEVEL);
    const columns = [
      {
        level: 1,
        items: snapshot.categories,
        pathPrefix: [],
        selectedId: normalizeText(selectedPath[0] && selectedPath[0].id),
        loading: state.categoryRootLoading,
        error: state.categoryRootLoading === true ? '' : state.categoryRootError,
        emptyText: '\u6682\u65e0\u4e3b\u7c7b\u76ee'
      }
    ];

    for (let index = 0; index < MAX_CATEGORY_LEVEL - 1; index += 1) {
      const parentNode = selectedPath[index];

      if (!parentNode || parentNode.isLeaf === true) {
        break;
      }

      const cacheKey = getCategoryChildCacheKey(parentNode.id);
      const cachedItems = cacheKey && Array.isArray(state.categoryChildCache[cacheKey])
        ? state.categoryChildCache[cacheKey]
        : [];
      const isLoading = cacheKey ? state.categoryChildLoadingKey === cacheKey : false;
      const hasError = cacheKey && state.categoryChildErrorKey === cacheKey;

      columns.push({
        level: index + 2,
        items: cachedItems,
        pathPrefix: selectedPath.slice(0, index + 1),
        selectedId: normalizeText(selectedPath[index + 1] && selectedPath[index + 1].id),
        loading: isLoading,
        error: hasError ? state.categoryChildError : '',
        emptyText: '\u6682\u65e0\u53ef\u9009\u5b50\u7c7b\u76ee'
      });

      if (cachedItems.length <= 0) {
        break;
      }
    }

    return columns;
  }

  function syncCategoryColumnsState(state) {
    state.categoryColumns = buildCategoryColumns(state);
  }

  function setCheckedCategoryPaths(state, paths) {
    state.categoryCheckedPaths = normalizeCategoryCheckedPaths(paths);
    syncCategoryColumnsState(state);
  }

  function updateCheckedCategoryPaths(state, paths, checked) {
    const currentPaths = normalizeCategoryCheckedPaths(state.categoryCheckedPaths);
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

    setCheckedCategoryPaths(state, Array.from(nextPathMap.values()));
  }

  function toggleCheckedCategoryPath(state, path, checked) {
    const normalizedPath = normalizeCategoryPath(path).slice(0, MAX_CATEGORY_LEVEL);
    const pathKey = buildCategoryPathKey(normalizedPath);

    if (!pathKey) {
      return;
    }

    updateCheckedCategoryPaths(state, [normalizedPath], checked);
  }

  function setSelectedCategoryPath(state, path) {
    state.categorySelectedPath = normalizeCategoryPath(path).slice(0, MAX_CATEGORY_LEVEL);
    syncCategoryColumnsState(state);
  }

  function buildCategoryColumnPaths(column) {
    const pathPrefix = normalizeCategoryPath(column && column.pathPrefix);

    return normalizeCategoryList(column && column.items)
      .map((category) => normalizeCategoryPath(pathPrefix.concat(category)).slice(0, MAX_CATEGORY_LEVEL))
      .filter((path) => path.length > 0);
  }

  function clearCategorySearchTimer(state) {
    if (state.categorySearchTimer) {
      window.clearTimeout(state.categorySearchTimer);
      state.categorySearchTimer = 0;
    }
  }

  function clearCategorySearchState(state, options = {}) {
    clearCategorySearchTimer(state);
    state.categorySearchRequestId += 1;
    state.categorySearchKeyword = '';
    state.categorySearchResults = [];
    state.categorySearchTotal = 0;
    state.categorySearchLoading = false;
    state.categorySearchError = '';
    state.categorySearchFocusInput = options.keepFocus === true;
  }

  async function searchCategories(container, keyword, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const rawKeyword = String(keyword == null ? '' : keyword);
    const trimmedKeyword = normalizeText(rawKeyword);

    state.categorySearchKeyword = rawKeyword;
    state.categorySearchError = '';
    state.categorySearchFocusInput = options.focusInput !== false;
    clearCategorySearchTimer(state);

    if (!trimmedKeyword) {
      state.categorySearchRequestId += 1;
      state.categorySearchResults = [];
      state.categorySearchTotal = 0;
      state.categorySearchLoading = false;
      render(container);
      return;
    }

    if (!featureCenterApi || typeof featureCenterApi.searchOperationsProductCategories !== 'function') {
      state.categorySearchRequestId += 1;
      state.categorySearchResults = [];
      state.categorySearchTotal = 0;
      state.categorySearchLoading = false;
      state.categorySearchError = '\u7c7b\u76ee\u641c\u7d22\u6682\u4e0d\u53ef\u7528';
      render(container);
      return;
    }

    const requestId = state.categorySearchRequestId + 1;

    state.categorySearchRequestId = requestId;
    state.categorySearchLoading = true;
    render(container);

    state.categorySearchTimer = window.setTimeout(async () => {
      try {
        const response = await featureCenterApi.searchOperationsProductCategories({
          keyword: trimmedKeyword,
          limit: 12
        });

        if (state.categorySearchRequestId !== requestId) {
          return;
        }

        state.categorySearchResults = normalizeCategorySearchResults(response && response.results);
        state.categorySearchTotal = Math.max(0, Number.parseInt(response && response.total, 10) || 0);
        state.categorySearchError = '';
      } catch (error) {
        if (state.categorySearchRequestId !== requestId) {
          return;
        }

        state.categorySearchResults = [];
        state.categorySearchTotal = 0;
        state.categorySearchError = normalizeText(error && error.message) || '\u7c7b\u76ee\u641c\u7d22\u5931\u8d25';
      } finally {
        if (state.categorySearchRequestId === requestId) {
          state.categorySearchLoading = false;
        }

        if (state.categorySearchTimer) {
          state.categorySearchTimer = 0;
        }

        render(container);
      }
    }, 180);
  }

  async function loadCategorySnapshot(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (!featureCenterApi || typeof featureCenterApi.getOperationsProductCategorySnapshot !== 'function') {
      state.categoryRootLoaded = true;
      state.categoryRootError = '\u5546\u54c1\u7c7b\u76ee\u63a5\u53e3\u672a\u52a0\u8f7d';
      syncCategoryColumnsState(state);
      render(container);
      return state.categorySnapshot;
    }

    if (state.categoryRootLoading === true && state.categoryRootPromise) {
      return state.categoryRootPromise;
    }

    if (options.force !== true && state.categoryRootLoaded === true) {
      return state.categorySnapshot;
    }

    state.categoryRootLoading = true;
    state.categoryRootError = '';
    syncCategoryColumnsState(state);
    render(container);

    state.categoryRootPromise = featureCenterApi.getOperationsProductCategorySnapshot()
      .then((snapshot) => {
        state.categorySnapshot = normalizeCategorySnapshot(snapshot);
        state.categoryRootLoaded = true;
        state.categoryRootError = '';
        syncCategoryColumnsState(state);
        return state.categorySnapshot;
      })
      .catch((error) => {
        state.categoryRootLoaded = true;
        state.categoryRootError = normalizeText(error && error.message) || '\u4e3b\u7c7b\u76ee\u52a0\u8f7d\u5931\u8d25';
        syncCategoryColumnsState(state);
        return state.categorySnapshot;
      })
      .finally(() => {
        state.categoryRootLoading = false;
        state.categoryRootPromise = null;
        syncCategoryColumnsState(state);
        render(container);
      });

    return state.categoryRootPromise;
  }

  async function loadCategoryChildren(container, parentNode, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const normalizedParentNode = normalizeCategoryPath([parentNode])[0];

    if (!normalizedParentNode || !normalizeText(normalizedParentNode.id)) {
      return [];
    }

    if (!featureCenterApi || typeof featureCenterApi.getOperationsProductChildCategories !== 'function') {
      state.categoryChildErrorKey = normalizeText(normalizedParentNode.id);
      state.categoryChildError = '\u5b50\u7c7b\u76ee\u63a5\u53e3\u672a\u52a0\u8f7d';
      syncCategoryColumnsState(state);
      render(container);
      return [];
    }

    const cacheKey = getCategoryChildCacheKey(normalizedParentNode.id);

    if (
      options.force !== true
      && cacheKey
      && Array.isArray(state.categoryChildCache[cacheKey])
    ) {
      return state.categoryChildCache[cacheKey];
    }

    state.categoryChildLoadingKey = cacheKey;
    state.categoryChildErrorKey = '';
    state.categoryChildError = '';
    syncCategoryColumnsState(state);
    render(container);

    try {
      const response = await featureCenterApi.getOperationsProductChildCategories({
        parentCatId: normalizedParentNode.id
      });
      const normalizedCategories = normalizeCategoryList(response && response.categories);

      state.categoryChildCache[cacheKey] = normalizedCategories;
      syncCategoryColumnsState(state);
      return normalizedCategories;
    } catch (error) {
      state.categoryChildErrorKey = cacheKey;
      state.categoryChildError = normalizeText(error && error.message) || '\u5b50\u7c7b\u76ee\u52a0\u8f7d\u5931\u8d25';
      syncCategoryColumnsState(state);
      return [];
    } finally {
      if (state.categoryChildLoadingKey === cacheKey) {
        state.categoryChildLoadingKey = '';
      }

      syncCategoryColumnsState(state);
      render(container);
    }
  }

  async function ensureCategorySelectionHydrated(container) {
    const state = getState(container);
    const selectedPath = normalizeCategoryPath(state.categorySelectedPath).slice(0, MAX_CATEGORY_LEVEL);
    const snapshot = normalizeCategorySnapshot(state.categorySnapshot);

    if (selectedPath.length <= 0) {
      syncCategoryColumnsState(state);
      render(container);
      return selectedPath;
    }

    const normalizedPath = [];
    const rootCategoryId = normalizeText(selectedPath[0] && selectedPath[0].id);
    const rootCategory = snapshot.categories.find((category) => category.id === rootCategoryId);

    if (!rootCategory) {
      setSelectedCategoryPath(state, []);
      render(container);
      return [];
    }

    normalizedPath.push(rootCategory);

    for (let index = 0; index < selectedPath.length - 1; index += 1) {
      const parentNode = normalizedPath[index];

      if (!parentNode || parentNode.isLeaf === true) {
        break;
      }

      const cacheKey = getCategoryChildCacheKey(parentNode.id);
      let childCategories = cacheKey && Array.isArray(state.categoryChildCache[cacheKey])
        ? state.categoryChildCache[cacheKey]
        : null;

      if (!childCategories) {
        childCategories = await loadCategoryChildren(container, parentNode, {
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

    setSelectedCategoryPath(state, normalizedPath);
    render(container);
    return normalizedPath;
  }

  async function applyCategorySearchSelection(container, result) {
    const state = getState(container);
    const normalizedResults = normalizeCategorySearchResults([result]);
    const searchResult = normalizedResults[0];

    if (!searchResult || !Array.isArray(searchResult.path) || searchResult.path.length <= 0) {
      return;
    }

    if (state.categoryRootLoaded !== true) {
      await loadCategorySnapshot(container);
    }

    const pathKey = buildCategoryPathKey(searchResult.path);
    const alreadyChecked = normalizeCategoryCheckedPaths(state.categoryCheckedPaths)
      .some((item) => buildCategoryPathKey(item) === pathKey);

    setSelectedCategoryPath(state, searchResult.path);
    toggleCheckedCategoryPath(state, searchResult.path, alreadyChecked !== true);
    state.categoryChildErrorKey = '';
    state.categoryChildError = '';
    clearCategorySearchState(state, {
      keepFocus: true
    });
    state.categorySelectorOpen = true;

    await ensureCategorySelectionHydrated(container);

    const lastCategory = searchResult.path[searchResult.path.length - 1] || null;

    if (lastCategory && lastCategory.isLeaf !== true && searchResult.path.length < MAX_CATEGORY_LEVEL) {
      await loadCategoryChildren(container, lastCategory, {
        silent: true
      });
    }

    render(container);
  }

  function applyDatePreset(state, presetValue, options = {}) {
    const normalizedPresetValue = normalizeText(presetValue);
    const useDraft = options.useDraft === true;

    if (normalizedPresetValue === 'clear') {
      if (useDraft) {
        state.joinedDraftStartDate = '';
        state.joinedDraftEndDate = '';
      } else {
        state.joinedStartDate = '';
        state.joinedEndDate = '';
      }
      return;
    }

    const range = buildRecentDateRange(normalizedPresetValue);

    if (useDraft) {
      state.joinedDraftStartDate = range.startDate;
      state.joinedDraftEndDate = range.endDate;
      return;
    }

    state.joinedStartDate = range.startDate;
    state.joinedEndDate = range.endDate;
  }

  async function ensureEnableTabResources(container) {
    await Promise.all([
      loadShopSelectionPresetSnapshot(container),
      loadShopCatalog(container)
    ]);
    await loadShopSelectionPreference(container);
  }

  function handleInput(container, event) {
    const target = event.target;
    const state = getState(container);

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const templateNameFlag = normalizeText(target.getAttribute('data-shop-multi-select-template-name'));

    if (templateNameFlag && 'value' in target) {
      state.shopSelectionPreset.templateName = target.value;
      return;
    }

    const searchFlag = normalizeText(target.getAttribute('data-shop-multi-select-search'));

    if (searchFlag && 'value' in target) {
      state.shopSelectorKeyword = target.value;
      state.shopSelectorOpen = true;
      render(container);
      return;
    }

    if (normalizeText(target.getAttribute('data-category-cascade-search')) && 'value' in target) {
      void searchCategories(container, target.value);
      return;
    }

    const quickCostInputKey = normalizeText(target.getAttribute('data-ops-traffic-quick-cost-input'));

    if (quickCostInputKey && 'value' in target) {
      state.quickCostDialogEntries = (Array.isArray(state.quickCostDialogEntries) ? state.quickCostDialogEntries : [])
        .map((entry) => {
          if (normalizeText(entry && entry.key) !== quickCostInputKey) {
            return entry;
          }

          return {
            ...entry,
            costPrice: normalizeQuickCostValue(target.value)
          };
        });
      state.quickCostDialogError = '';
      state.quickCostDialogWarning = '';
      state.quickCostDialogNotice = '';
      return;
    }

    const customLevelSetting = normalizeText(target.getAttribute('data-ops-traffic-custom-level-setting'));

    if (customLevelSetting && 'value' in target) {
      if (
        customLevelSetting === 'modeValue'
        || customLevelSetting === 'profitFloorRate'
        || customLevelSetting === 'profitFloorValue'
      ) {
        syncTrafficBoostCustomLevelFilterSettingsState(
          state,
          updateTrafficBoostCustomLevelFilterSettingsDraft(
            state.customLevelFilterSettings,
            customLevelSetting,
            target.value
          )
        );
        state.customLevelFilterDialogError = '';
        state.customLevelFilterDialogWarning = '';
        state.customLevelFilterDialogNotice = '';
      }
      return;
    }

    const fieldName = normalizeText(target.getAttribute('data-ops-traffic-field'));

    if (!fieldName || !('value' in target)) {
      return;
    }

    applyTrafficFieldValue(state, fieldName, target.value);
  }

  function handleChange(container, event) {
    const target = event.target;
    const state = getState(container);
    const control = getShopMultiSelectControl();

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const selectedShopId = normalizeText(target.getAttribute('data-shop-multi-select-shop'));

    if (selectedShopId && target instanceof HTMLInputElement) {
      state.selectedShopIds =
        control && typeof control.toggleShopSelection === 'function'
          ? control.toggleShopSelection(state.selectedShopIds, selectedShopId, target.checked)
          : normalizeSelectedShopIds(state.selectedShopIds);
      state.shopSelectionTouched = true;
      void saveShopSelectionLast(container, state.selectedShopIds);
      render(container, {
        preserveShopSelectorPanelScroll: true
      });
      return;
    }

    const selectedStationId = normalizeText(target.getAttribute('data-ops-traffic-station-option'));

    if (selectedStationId && target instanceof HTMLInputElement) {
      const currentStationIds = filterStationIdsByMarketRegion(state.stationIds, state.marketRegion);
      const nextStationIds = target.checked
        ? Array.from(new Set(currentStationIds.concat(selectedStationId)))
        : currentStationIds.filter((stationId) => stationId !== selectedStationId);

      state.stationIds = nextStationIds;
      render(container);
      return;
    }

    const categoryCheckedId = normalizeText(target.getAttribute('data-category-cascade-check'));

    if (categoryCheckedId && target instanceof HTMLInputElement) {
      const level = Number.parseInt(target.getAttribute('data-category-cascade-level'), 10);
      const categoryId = normalizeText(target.getAttribute('data-category-id'));
      const categoryColumn = Array.isArray(state.categoryColumns)
        ? state.categoryColumns.find((column) => Number.parseInt(column && column.level, 10) === level)
        : null;
      const categoryRecord = normalizeCategoryList(categoryColumn && categoryColumn.items)
        .find((category) => category.id === categoryId);
      const pathPrefix = normalizeCategoryPath(categoryColumn && categoryColumn.pathPrefix);
      const nextPath = categoryRecord ? pathPrefix.concat(categoryRecord) : [];

      if (nextPath.length <= 0) {
        return;
      }

      setSelectedCategoryPath(state, nextPath);
      toggleCheckedCategoryPath(state, nextPath, target.checked);
      state.categoryChildErrorKey = '';
      state.categoryChildError = '';
      state.categorySelectorOpen = true;
      state.categorySearchFocusInput = false;
      render(container);

      if (categoryRecord && categoryRecord.isLeaf !== true && level < MAX_CATEGORY_LEVEL) {
        void loadCategoryChildren(container, categoryRecord, {
          silent: true
        });
      }
      return;
    }

    const customLevelSetting = normalizeText(target.getAttribute('data-ops-traffic-custom-level-setting'));

    if (customLevelSetting) {
      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        updateTrafficBoostCustomLevelFilterSetting(container, customLevelSetting, target.checked === true);
      } else if ('value' in target) {
        updateTrafficBoostCustomLevelFilterSetting(container, customLevelSetting, target.value);
      }
      return;
    }

    const fieldName = normalizeText(target.getAttribute('data-ops-traffic-field'));

    if (!fieldName || !('value' in target)) {
      const autoRenewFlag = normalizeText(target.getAttribute('data-ops-traffic-toggle'));

      if (autoRenewFlag === 'trafficBoostAutoRenew' && target instanceof HTMLInputElement) {
        state.trafficBoostAutoRenew = target.checked === true;
        return;
      }

      return;
    }

    applyTrafficFieldValue(state, fieldName, target.value);

    if (
      fieldName === 'marketRegion'
      || fieldName === 'trafficBoostDuration'
    ) {
      render(container);
      return;
    }

    if (fieldName === 'trafficBoostLevel') {
      const selectedLevel = normalizeTrafficBoostLevel(target.value);

      if (selectedLevel === 'custom') {
        void openTrafficBoostCustomLevelFilterDialog(container);
      } else if (state.customLevelFilterDialogOpen === true) {
        closeTrafficBoostCustomLevelFilterDialog(container);
      } else {
        render(container);
      }

      if (Array.isArray(state.resultRows) && state.resultRows.length > 0) {
        refreshTrafficBoostSubmitScopeSummary(state);
        scheduleTrafficBoostResultsViewportRefresh(container);
      }
    }
  }

  function handleClick(container, event) {
    const target = event.target instanceof Element ? event.target : null;
    const state = getState(container);
    const control = getShopMultiSelectControl();
    const helper = getShopSelectionTemplateHelper();
    const shopSelectorRoot = target ? target.closest('[data-shop-multi-select]') : null;
    const stationSelectorRoot = target ? target.closest('[data-ops-traffic-station-select]') : null;
    const categorySelectorRoot = target ? target.closest('[data-category-cascade]') : null;
    const datePickerRoot = target ? target.closest('[data-ops-traffic-date-picker]') : null;
    let closedByOutsideClick = false;

    if (!target) {
      return;
    }

    if (state.shopSelectorOpen === true && !shopSelectorRoot) {
      state.shopSelectorOpen = false;
      state.shopSelectorKeyword = '';
      state.shopSelectorFocusSearch = false;
      closedByOutsideClick = true;
    }

    if (state.stationSelectorOpen === true && !stationSelectorRoot) {
      state.stationSelectorOpen = false;
      closedByOutsideClick = true;
    }

    if (state.categorySelectorOpen === true && !categorySelectorRoot) {
      state.categorySelectorOpen = false;
      clearCategorySearchState(state);
      closedByOutsideClick = true;
    }

    if (state.joinedDatePickerOpen === true && !datePickerRoot) {
      state.joinedDatePickerOpen = false;
      closedByOutsideClick = true;
    }

    const tabButton = target.closest('[data-ops-traffic-tab]');

    if (tabButton instanceof HTMLButtonElement) {
      const nextTabId = normalizeTabId(tabButton.getAttribute('data-ops-traffic-tab'));

      if (state.activeTabId !== nextTabId) {
        state.activeTabId = nextTabId;
        render(container);

        if (nextTabId === 'enable') {
          void ensureEnableTabResources(container);
        }
      } else if (closedByOutsideClick) {
        render(container);
      }

      return;
    }

    const shopSelectorToggle = target.closest('[data-shop-multi-select-toggle]');

    if (shopSelectorToggle instanceof HTMLButtonElement) {
      if (!shopSelectorToggle.disabled) {
        state.shopSelectorOpen = !state.shopSelectorOpen;
        state.shopSelectorFocusSearch = state.shopSelectorOpen === true;

        if (state.shopSelectorOpen !== true) {
          state.shopSelectorKeyword = '';
        }

        render(container);
      }

      return;
    }

    const shopTemplateSave = target.closest('[data-shop-multi-select-template-save]');

    if (shopTemplateSave instanceof HTMLButtonElement) {
      if (!shopTemplateSave.disabled) {
        void saveShopSelectionTemplate(container);
      }

      return;
    }

    const shopTemplateApply = target.closest('[data-shop-multi-select-template-apply]');

    if (shopTemplateApply instanceof HTMLButtonElement) {
      const templateId = normalizeText(shopTemplateApply.getAttribute('data-shop-multi-select-template-apply'));
      const selectedShopIds = helper && typeof helper.findTemplateSelection === 'function'
        ? helper.findTemplateSelection(state.shopSelectionPreset, templateId)
        : [];

      applyShopSelectionPreset(container, selectedShopIds);
      return;
    }

    const shopTemplateDelete = target.closest('[data-shop-multi-select-template-delete]');

    if (shopTemplateDelete instanceof HTMLButtonElement) {
      if (!shopTemplateDelete.disabled) {
        void deleteShopSelectionTemplate(
          container,
          shopTemplateDelete.getAttribute('data-shop-multi-select-template-delete')
        );
      }

      return;
    }

    const shopRestoreLast = target.closest('[data-shop-multi-select-restore-last]');

    if (shopRestoreLast instanceof HTMLButtonElement) {
      if (!shopRestoreLast.disabled) {
        const selectedShopIds = helper && typeof helper.getLastSelectionIds === 'function'
          ? helper.getLastSelectionIds(state.shopSelectionPreset)
          : [];

        applyShopSelectionPreset(container, selectedShopIds);
      }

      return;
    }

    const shopSelectorAction = target.closest('[data-shop-multi-select-action]');

    if (shopSelectorAction instanceof HTMLButtonElement) {
      const actionId = normalizeText(shopSelectorAction.getAttribute('data-shop-multi-select-action'));

      if (actionId === 'select-visible' && control && typeof control.setAllVisibleSelection === 'function') {
        state.selectedShopIds = control.setAllVisibleSelection(
          state.shopCatalog,
          state.selectedShopIds,
          state.shopSelectorKeyword,
          true
        );
      } else if (actionId === 'clear') {
        state.selectedShopIds = [];
      }

      state.shopSelectionTouched = true;
      void saveShopSelectionLast(container, state.selectedShopIds);
      render(container, {
        preserveShopSelectorPanelScroll: true
      });
      return;
    }

    const shopSelectorSectionAction = target.closest('[data-shop-multi-select-section]');

    if (shopSelectorSectionAction instanceof HTMLButtonElement) {
      const sectionId = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section'));
      const sectionMode = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section-mode'));

      if (sectionId && control && typeof control.setGroupSelection === 'function') {
        state.selectedShopIds = control.setGroupSelection(
          state.shopCatalog,
          state.selectedShopIds,
          sectionId,
          state.shopSelectorKeyword,
          sectionMode !== 'clear'
        );
        state.shopSelectionTouched = true;
        void saveShopSelectionLast(container, state.selectedShopIds);
      }

      render(container, {
        preserveShopSelectorPanelScroll: true
      });
      return;
    }

    const stationSelectorToggle = target.closest('[data-ops-traffic-station-toggle]');

    if (stationSelectorToggle instanceof HTMLButtonElement) {
      state.stationSelectorOpen = !state.stationSelectorOpen;
      render(container);
      return;
    }

    const stationSelectorAction = target.closest('[data-ops-traffic-station-action]');

    if (stationSelectorAction instanceof HTMLButtonElement) {
      const actionId = normalizeText(stationSelectorAction.getAttribute('data-ops-traffic-station-action'));

      if (actionId === 'select-all') {
        state.stationIds = getMarketStationOptions(state.marketRegion)
          .map((option) => normalizeText(option && option.value))
          .filter(Boolean);
      } else if (actionId === 'clear') {
        state.stationIds = [];
      }

      render(container);
      return;
    }

    const actionButton = target.closest('[data-ops-traffic-action]');

    if (actionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(actionButton.getAttribute('data-ops-traffic-action'));

      if (actionId === 'query') {
        void startQuery(container);
        return;
      }

      if (actionId === 'stop') {
        void stopQuery(container);
        return;
      }

      if (actionId === 'quick-cost') {
        void openTrafficBoostQuickCostDialog(container);
        return;
      }

      if (actionId === 'edit-custom-level') {
        void openTrafficBoostCustomLevelFilterDialog(container);
        return;
      }

      if (actionId === 'batch-enable') {
        void submitTrafficBoostBatchEnable(container);
        return;
      }

      if (actionId === 'stop-submit') {
        void stopSubmitTrafficBoostBatchEnable(container);
        return;
      }
    }

    const dateToggleButton = target.closest('[data-ops-traffic-date-toggle]');

    if (dateToggleButton instanceof HTMLButtonElement) {
      if (state.joinedDatePickerOpen === true) {
        state.joinedDatePickerOpen = false;
      } else {
        syncJoinedDateDraftFromValue(state);
        state.joinedDatePickerOpen = true;
      }

      render(container);
      return;
    }

    const datePresetButton = target.closest('[data-ops-traffic-date-preset]');

    if (datePresetButton instanceof HTMLButtonElement) {
      applyDatePreset(state, datePresetButton.getAttribute('data-ops-traffic-date-preset'), {
        useDraft: state.joinedDatePickerOpen === true
      });
      render(container);
      return;
    }

    const dateActionButton = target.closest('[data-ops-traffic-date-action]');

    if (dateActionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(dateActionButton.getAttribute('data-ops-traffic-date-action'));

      if (actionId === 'cancel') {
        state.joinedDatePickerOpen = false;
      } else if (actionId === 'clear') {
        state.joinedDraftStartDate = '';
        state.joinedDraftEndDate = '';
      } else if (actionId === 'confirm') {
        applyJoinedDateDraft(state);
        state.joinedDatePickerOpen = false;
      }

      render(container);
      return;
    }

    const categoryToggle = target.closest('[data-category-cascade-toggle]');

    if (categoryToggle instanceof HTMLButtonElement) {
      if (!categoryToggle.disabled) {
        state.categorySelectorOpen = !state.categorySelectorOpen;

        if (state.categorySelectorOpen === true) {
          if (state.categorySelectedPath.length <= 0 && state.categoryCheckedPaths.length > 0) {
            setSelectedCategoryPath(state, state.categoryCheckedPaths[0]);
          }

          state.categorySearchFocusInput = true;
        } else {
          clearCategorySearchState(state);
        }

        syncCategoryColumnsState(state);
        render(container);

        if (state.categorySelectorOpen === true) {
          if (state.categoryRootLoaded !== true) {
            void loadCategorySnapshot(container);
          } else if (state.categorySelectedPath.length > 0) {
            void ensureCategorySelectionHydrated(container);
          }
        }
      }

      return;
    }

    const categoryActionButton = target.closest('[data-category-cascade-action]');

    if (categoryActionButton instanceof HTMLButtonElement) {
      const categoryActionId = normalizeText(categoryActionButton.getAttribute('data-category-cascade-action'));

      if (categoryActionId === 'clear') {
        setCheckedCategoryPaths(state, []);
        setSelectedCategoryPath(state, []);
        state.categoryChildErrorKey = '';
        state.categoryChildError = '';
        clearCategorySearchState(state, {
          keepFocus: true
        });
        render(container);
      }

      return;
    }

    const categoryColumnActionButton = target.closest('[data-category-cascade-column-action]');

    if (categoryColumnActionButton instanceof HTMLButtonElement) {
      const columnActionId = normalizeText(categoryColumnActionButton.getAttribute('data-category-cascade-column-action'));
      const level = Number.parseInt(categoryColumnActionButton.getAttribute('data-category-cascade-level'), 10);
      const categoryColumn = Array.isArray(state.categoryColumns)
        ? state.categoryColumns.find((column) => Number.parseInt(column && column.level, 10) === level)
        : null;
      const columnPaths = buildCategoryColumnPaths(categoryColumn);

      if (!categoryColumn || columnPaths.length <= 0) {
        return;
      }

      if (columnActionId === 'select-all') {
        updateCheckedCategoryPaths(state, columnPaths, true);
      } else if (columnActionId === 'clear') {
        updateCheckedCategoryPaths(state, columnPaths, false);
      } else {
        return;
      }

      if (normalizeCategoryPath(categoryColumn && categoryColumn.pathPrefix).length > 0) {
        setSelectedCategoryPath(state, categoryColumn.pathPrefix);
      }

      state.categoryChildErrorKey = '';
      state.categoryChildError = '';
      state.categorySelectorOpen = true;
      state.categorySearchFocusInput = false;
      render(container);
      return;
    }

    const categoryItemButton = target.closest('[data-category-cascade-item]');

    if (categoryItemButton instanceof HTMLButtonElement) {
      const level = Number.parseInt(categoryItemButton.getAttribute('data-category-cascade-level'), 10);
      const categoryId = normalizeText(categoryItemButton.getAttribute('data-category-id'));
      const categoryColumn = Array.isArray(state.categoryColumns)
        ? state.categoryColumns.find((column) => Number.parseInt(column && column.level, 10) === level)
        : null;
      const categoryRecord = normalizeCategoryList(categoryColumn && categoryColumn.items)
        .find((category) => category.id === categoryId);

      if (!categoryRecord || !Number.isFinite(level) || level <= 0) {
        return;
      }

      const nextSelectedPath = normalizeCategoryPath(state.categorySelectedPath).slice(0, Math.max(0, level - 1));

      nextSelectedPath[level - 1] = categoryRecord;
      setSelectedCategoryPath(state, nextSelectedPath);
      state.categoryChildErrorKey = '';
      state.categoryChildError = '';
      state.categorySelectorOpen = true;
      state.categorySearchFocusInput = false;
      render(container);

      if (categoryRecord.isLeaf !== true && level < MAX_CATEGORY_LEVEL) {
        void loadCategoryChildren(container, categoryRecord, {
          silent: true
        });
      }

      return;
    }

    const categorySearchResultButton = target.closest('[data-category-cascade-search-result]');

    if (categorySearchResultButton instanceof HTMLButtonElement) {
      const categoryId = normalizeText(categorySearchResultButton.getAttribute('data-category-id'));
      const searchResult = normalizeCategorySearchResults(state.categorySearchResults)
        .find((item) => item.id === categoryId);

      if (searchResult) {
        void applyCategorySearchSelection(container, searchResult);
      }

      return;
    }

    const customLevelBackdrop = target.closest('[data-ops-traffic-custom-level-backdrop]');
    const customLevelPanel = target.closest('[data-ops-traffic-custom-level-panel]');

    if (
      customLevelBackdrop
      && !customLevelPanel
      && state.customLevelFilterSettingsSaving !== true
    ) {
      closeTrafficBoostCustomLevelFilterDialog(container);
      return;
    }

    const customLevelActionButton = target.closest('[data-ops-traffic-custom-level-action]');

    if (customLevelActionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(customLevelActionButton.getAttribute('data-ops-traffic-custom-level-action'));

      if (actionId === 'close') {
        closeTrafficBoostCustomLevelFilterDialog(container);
        return;
      }

      if (actionId === 'save') {
        void saveTrafficBoostCustomLevelFilterSettings(container);
        return;
      }
    }

    const quickCostBackdrop = target.closest('[data-ops-traffic-quick-cost-backdrop]');
    const quickCostPanel = target.closest('[data-ops-traffic-quick-cost-panel]');

    if (
      quickCostBackdrop
      && !quickCostPanel
      && state.quickCostDialogSaving !== true
    ) {
      closeTrafficBoostQuickCostDialog(container);
      return;
    }

    const quickCostActionButton = target.closest('[data-ops-traffic-quick-cost-action]');

    if (quickCostActionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(quickCostActionButton.getAttribute('data-ops-traffic-quick-cost-action'));

      if (actionId === 'close') {
        closeTrafficBoostQuickCostDialog(container);
        return;
      }

      if (actionId === 'save') {
        void saveTrafficBoostQuickCostDialog(container);
        return;
      }
    }

    if (closedByOutsideClick) {
      render(container);
    }
  }

  function handleScroll(container, event) {
    const target = event && event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches('[data-ops-traffic-results-viewport]')) {
      const state = getState(container);

      state.resultViewportScrollTop = Math.max(0, Number(target.scrollTop) || 0);
      state.resultViewportScrollLeft = Math.max(0, Number(target.scrollLeft) || 0);
      scheduleTrafficBoostResultsViewportRefresh(container);
    }
  }

  function bindEvents(container) {
    if (!(container instanceof HTMLElement) || container.dataset.operationsTrafficBoostEventsBound === 'true') {
      return;
    }

    container.dataset.operationsTrafficBoostEventsBound = 'true';
    container.addEventListener('input', (event) => {
      handleInput(container, event);
    });
    container.addEventListener('change', (event) => {
      handleChange(container, event);
    });
    container.addEventListener('click', (event) => {
      handleClick(container, event);
    });
    container.addEventListener('scroll', (event) => {
      handleScroll(container, event);
    }, true);

    const resizeHandler = () => {
      scheduleTrafficBoostResultsViewportRestore(container);
    };

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('beforeunload', () => {
      window.removeEventListener('resize', resizeHandler);
    }, { once: true });
  }

  function createController(container) {
    const keepAliveHelper = window.moduleKeepAlive || window.operationsModuleKeepAlive;
    const activateView = () => {
      bindEvents(container);
      bindQueryProgressListener(container);
      render(container);

      if (normalizeTabId(getState(container).activeTabId) === 'enable') {
        void ensureEnableTabResources(container);
      }
    };

    if (keepAliveHelper && typeof keepAliveHelper.createKeepAliveController === 'function') {
      return keepAliveHelper.createKeepAliveController({
        panel: container,
        onActivate(options = {}) {
          activateView();

          if (options && options.resume === true) {
            void hydrateQueryProgressSnapshot(container);
          }
        },
        onDeactivate() {
          const state = getState(container);
          let changed = false;

          if (state.shopSelectorOpen === true) {
            state.shopSelectorOpen = false;
            state.shopSelectorKeyword = '';
            state.shopSelectorFocusSearch = false;
            changed = true;
          }

          if (state.stationSelectorOpen === true) {
            state.stationSelectorOpen = false;
            changed = true;
          }

          if (state.categorySelectorOpen === true) {
            state.categorySelectorOpen = false;
            clearCategorySearchState(state);
            changed = true;
          }

          if (state.joinedDatePickerOpen === true) {
            state.joinedDatePickerOpen = false;
            changed = true;
          }

          if (state.quickCostDialogOpen === true) {
            state.quickCostDialogOpen = false;
            state.quickCostDialogLoading = false;
            state.quickCostDialogSaving = false;
            state.quickCostDialogError = '';
            state.quickCostDialogWarning = '';
            state.quickCostDialogNotice = '';
            state.quickCostDialogEntries = [];
            state.quickCostDialogShopCount = 0;
            state.quickCostDialogSourceEntryCount = 0;
            state.quickCostDialogMergedEntryCount = 0;
            state.quickCostDialogConflictCount = 0;
            changed = true;
          }

          if (state.customLevelFilterDialogOpen === true) {
            state.customLevelFilterDialogOpen = false;
            state.customLevelFilterDialogError = '';
            state.customLevelFilterDialogWarning = '';
            state.customLevelFilterDialogNotice = '';
            changed = true;
          }

          if (changed) {
            render(container);
          }
        }
      });
    }

    return {
      panel: container,
      activate(options = {}) {
        activateView();

        if (options && options.resume === true) {
          void hydrateQueryProgressSnapshot(container);
        }
      },
      deactivate() {
        const state = getState(container);
        let changed = false;

        if (state.shopSelectorOpen === true) {
          state.shopSelectorOpen = false;
          state.shopSelectorKeyword = '';
          state.shopSelectorFocusSearch = false;
          changed = true;
        }

        if (state.stationSelectorOpen === true) {
          state.stationSelectorOpen = false;
          changed = true;
        }

        if (state.categorySelectorOpen === true) {
          state.categorySelectorOpen = false;
          clearCategorySearchState(state);
          changed = true;
        }

        if (state.joinedDatePickerOpen === true) {
          state.joinedDatePickerOpen = false;
          changed = true;
        }

        if (state.quickCostDialogOpen === true) {
          state.quickCostDialogOpen = false;
          state.quickCostDialogLoading = false;
          state.quickCostDialogSaving = false;
          state.quickCostDialogError = '';
          state.quickCostDialogWarning = '';
          state.quickCostDialogNotice = '';
          state.quickCostDialogEntries = [];
          state.quickCostDialogShopCount = 0;
          state.quickCostDialogSourceEntryCount = 0;
          state.quickCostDialogMergedEntryCount = 0;
          state.quickCostDialogConflictCount = 0;
          changed = true;
        }

        if (state.customLevelFilterDialogOpen === true) {
          state.customLevelFilterDialogOpen = false;
          state.customLevelFilterDialogError = '';
          state.customLevelFilterDialogWarning = '';
          state.customLevelFilterDialogNotice = '';
          changed = true;
        }

        if (changed) {
          render(container);
        }
      }
    };
  }

  function mount(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    if (container.dataset.operationsTrafficBoostMounted !== 'true') {
      container.dataset.operationsTrafficBoostMounted = 'true';
      getState(container);
      render(container);
    }

    if (!container.__operationsTrafficBoostController) {
      container.__operationsTrafficBoostController = createController(container);
    }

    return container.__operationsTrafficBoostController;
  }

  window.operationsTrafficBoostView = {
    mount
  };
})();
