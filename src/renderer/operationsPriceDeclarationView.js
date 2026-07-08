(function initOperationsPriceDeclarationView() {
  const profitMetrics = window.operationsProfitMetrics && typeof window.operationsProfitMetrics === 'object'
    ? window.operationsProfitMetrics
    : null;
  const MAX_MULTI_KEYWORDS = 40;
  const PRODUCT_THUMBNAIL_SIZE = '120x';
  const PRODUCT_PREVIEW_SIZE = '1200x';
  const SHOP_SELECTION_SCOPE_KEY = 'operations-price-declaration';
  const REPORT_STATUS_OPTIONS = Object.freeze([
    { value: 'declaring', label: '\u4ef7\u683c\u7533\u62a5\u4e2d', tone: 'blue' },
    { value: 'pendingSeller', label: '\u5f85\u5356\u5bb6\u786e\u8ba4', tone: 'amber' },
    { value: 'success', label: '\u6210\u529f', tone: 'green' },
    { value: 'failed', label: '\u5931\u8d25', tone: 'red' }
  ]);
  const DECLARATION_PRICE_TYPE_OPTIONS = Object.freeze([
    { value: 'daily', label: '\u65e5\u5e38\u4ef7\u683c' },
    { value: 'activity', label: '\u6d3b\u52a8\u4ef7\u683c' }
  ]);
  const CUSTOM_PRODUCT_OPTIONS = Object.freeze([
    { value: 'yes', label: '\u662f' },
    { value: 'no', label: '\u5426' }
  ]);
  const COST_STATE_OPTIONS = Object.freeze([
    { value: '', label: '\u5168\u90e8\u72b6\u6001' },
    { value: 'unset', label: '\u672a\u8bbe\u7f6e' },
    { value: 'set', label: '\u5df2\u8bbe\u7f6e' }
  ]);
  const REVIEW_RULE_METRIC_OPTIONS = Object.freeze([
    { value: 'profitRate', label: '\u5229\u6da6\u7387(\u6309\u5f53\u524d\u4ef7\u683c)' },
    { value: 'profitAmount', label: '\u5229\u6da6\u989d(\u5143)' }
  ]);
  const GOODS_NO_TYPE_OPTIONS = Object.freeze([
    { value: 'sku', label: 'SKU' },
    { value: 'skc', label: 'SKC' }
  ]);
  const CHANGE_TYPE_OPTIONS = Object.freeze([
    { value: 'raise', label: '\u4e0a\u8c03', tone: 'red' },
    { value: 'reduce', label: '\u4e0b\u8c03', tone: 'green' },
    { value: 'new', label: '\u65b0\u62a5', tone: 'blue' }
  ]);
  const DEFAULT_FILTERS = Object.freeze({
    selectedShopIds: Object.freeze([]),
    stationIds: Object.freeze(['100']),
    productSource: 'pendingSeller',
    declarationPriceType: '',
    costState: '',
    orderNoKeywords: '',
    productName: '',
    skcIdKeywords: '',
    createdDateStart: '',
    createdDateEnd: '',
    customizedProduct: '',
    goodsNoType: 'skc',
    goodsNoKeywords: ''
  });
  const DEFAULT_REVIEW_RULES = Object.freeze({
    dailyRule: Object.freeze({
      metric: 'profitRate',
      threshold: ''
    }),
    activityRule: Object.freeze({
      metric: 'profitRate',
      threshold: ''
    }),
    rejectReason: ''
  });
  const REPORT_STATUS_MAP = Object.freeze(
    REPORT_STATUS_OPTIONS.reduce((result, item) => {
      result[item.value] = item;
      return result;
    }, Object.create(null))
  );
  const DECLARATION_PRICE_TYPE_MAP = Object.freeze(
    DECLARATION_PRICE_TYPE_OPTIONS.reduce((result, item) => {
      result[item.value] = item;
      return result;
    }, Object.create(null))
  );
  const CUSTOM_PRODUCT_MAP = Object.freeze(
    CUSTOM_PRODUCT_OPTIONS.reduce((result, item) => {
      result[item.value] = item;
      return result;
    }, Object.create(null))
  );
  const COST_STATE_MAP = Object.freeze(
    COST_STATE_OPTIONS.reduce((result, item) => {
      result[item.value] = item;
      return result;
    }, Object.create(null))
  );
  const CHANGE_TYPE_MAP = Object.freeze(
    CHANGE_TYPE_OPTIONS.reduce((result, item) => {
      result[item.value] = item;
      return result;
    }, Object.create(null))
  );

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeNonNegativeInteger(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    return Array.from(new Set(
      (Array.isArray(selectedShopIds) ? selectedShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function normalizeSelectedStationIds(stationIds) {
    return Array.from(new Set(
      (Array.isArray(stationIds) ? stationIds : [])
        .map((stationId) => normalizeText(stationId))
        .filter(Boolean)
    ));
  }

  function cloneFilters(filters) {
    const source = filters && typeof filters === 'object' ? filters : {};

    return {
      ...DEFAULT_FILTERS,
      ...source,
      selectedShopIds: normalizeSelectedShopIds(source.selectedShopIds),
      stationIds: normalizeSelectedStationIds(source.stationIds || (source.station ? [source.station] : DEFAULT_FILTERS.stationIds))
    };
  }

  function normalizeDeclarationPriceTypeValue(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue) {
      return '';
    }

    if (
      normalizedValue === 'daily'
      || normalizedValue === '0'
      || normalizedValue === '\u65e5\u5e38'
      || normalizedValue === '\u65e5\u5e38\u4ef7\u683c'
      || normalizedValue === '\u65e5\u5e38\u6d3b\u52a8'
    ) {
      return 'daily';
    }

    if (
      normalizedValue === 'activity'
      || normalizedValue === '1'
      || normalizedValue === '2'
      || normalizedValue === '\u6d3b\u52a8'
      || normalizedValue === '\u6d3b\u52a8\u4ef7\u683c'
    ) {
      return 'activity';
    }

    return '';
  }

  function getRowDeclarationPriceType(row) {
    return normalizeDeclarationPriceTypeValue(
      row && (
        row.declarationPriceType
        || row.priceType
      )
    );
  }

  function getRowDeclarationPriceTypeLabel(row) {
    const explicitLabel = normalizeText(row && row.priceTypeLabel);

    if (explicitLabel) {
      return explicitLabel;
    }

    const normalizedType = getRowDeclarationPriceType(row);
    const option = DECLARATION_PRICE_TYPE_MAP[normalizedType] || null;

    if (option) {
      return option.label;
    }

    const rawPriceType = normalizeText(row && row.priceType);

    if (rawPriceType === '0') {
      return '\u65e5\u5e38\u4ef7\u683c';
    }

    if (rawPriceType === '1' || rawPriceType === '2') {
      return '\u6d3b\u52a8\u4ef7\u683c';
    }

    return '--';
  }

  function cloneFiltersForQuery(filters) {
    const nextFilters = cloneFilters(filters);
    nextFilters.costState = '';
    return nextFilters;
  }

  function normalizeReviewRuleMetric(value) {
    const metric = normalizeText(value);
    return metric === 'profitAmount' ? 'profitAmount' : 'profitRate';
  }

  function normalizeReviewThresholdInput(value) {
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

  function cloneReviewRules(rules) {
    const source = rules && typeof rules === 'object' ? rules : {};
    const dailyRule = source && source.dailyRule && typeof source.dailyRule === 'object'
      ? source.dailyRule
      : {};
    const activityRule = source && source.activityRule && typeof source.activityRule === 'object'
      ? source.activityRule
      : {};

    return {
      dailyRule: {
        metric: normalizeReviewRuleMetric(dailyRule.metric),
        threshold: normalizeReviewThresholdInput(dailyRule.threshold)
      },
      activityRule: {
        metric: normalizeReviewRuleMetric(activityRule.metric),
        threshold: normalizeReviewThresholdInput(activityRule.threshold)
      },
      rejectReason: normalizeText(source.rejectReason).slice(0, 100)
    };
  }

  function updateReviewRulesValue(rules, fieldPath, value) {
    const nextRules = cloneReviewRules(rules);
    const normalizedFieldPath = normalizeText(fieldPath);

    if (normalizedFieldPath === 'dailyRule.metric') {
      nextRules.dailyRule.metric = normalizeReviewRuleMetric(value);
      return nextRules;
    }

    if (normalizedFieldPath === 'dailyRule.threshold') {
      nextRules.dailyRule.threshold = normalizeText(value);
      return nextRules;
    }

    if (normalizedFieldPath === 'activityRule.metric') {
      nextRules.activityRule.metric = normalizeReviewRuleMetric(value);
      return nextRules;
    }

    if (normalizedFieldPath === 'activityRule.threshold') {
      nextRules.activityRule.threshold = normalizeText(value);
      return nextRules;
    }

    if (normalizedFieldPath === 'rejectReason') {
      nextRules.rejectReason = normalizeText(value).slice(0, 100);
      return nextRules;
    }

    return nextRules;
  }

  function parseKeywordList(value) {
    return Array.from(new Set(
      normalizeText(value)
        .split(/[\s,\uff0c;\uff1b]+/)
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )).slice(0, MAX_MULTI_KEYWORDS);
  }

  function normalizeDateInputValue(value) {
    return normalizeText(value).replace(/\s+/g, 'T');
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

    return normalizeText(value);
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

  function formatMoney(value) {
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '--';
    }

    return numericValue.toFixed(2);
  }

  function formatPercent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '--';
    }

    return `${numericValue.toFixed(2).replace(/\.00$/, '')}%`;
  }

  function formatDateTimeLabel(value) {
    const normalizedValue = normalizeDateInputValue(value);

    if (Number.isFinite(Number(value)) && Number(value) > 0) {
      return new Date(Number(value)).toLocaleString('zh-CN', {
        hour12: false
      });
    }

    if (!normalizedValue) {
      return '--';
    }

    return normalizedValue.replace('T', ' ');
  }

  function parseDateTimestamp(value, options = {}) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = normalizeDateInputValue(value);

    if (!normalizedValue) {
      return Number.NaN;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
      const suffix = options.endOfDay === true ? 'T23:59:59' : 'T00:00:00';
      return Date.parse(`${normalizedValue}${suffix}`);
    }

    return Date.parse(normalizedValue);
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

  function resolveQuickCostStationValue(source = {}) {
    const stationIds = Array.isArray(source && source.stationIds)
      ? source.stationIds.map((stationId) => normalizeText(stationId)).filter(Boolean)
      : [];

    return normalizeText(
      source && (
        source.station
        || stationIds[0]
        || source.stationLabel
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

  function buildQuickCostLookupKeys(shopId, station, spec) {
    return Array.from(new Set([
      buildQuickCostEntryKey(shopId, station, spec),
      buildQuickCostLegacyKey(shopId, spec)
    ].filter(Boolean)));
  }

  function computeRowProfitRate(row) {
    const adjustedDeclaredPrice = Number(row && row.adjustedDeclaredPrice);
    const costPrice = Number(row && row.costPrice);

    if (!profitMetrics || typeof profitMetrics.computeProfitRateByPrice !== 'function') {
      return null;
    }

    if (!Number.isFinite(adjustedDeclaredPrice) || adjustedDeclaredPrice <= 0) {
      return null;
    }

    if (!Number.isFinite(costPrice)) {
      return null;
    }

    const profitRate = profitMetrics.computeProfitRateByPrice(adjustedDeclaredPrice, costPrice);
    return Number.isFinite(profitRate)
      ? Number(profitRate.toFixed(2))
      : null;
  }

  function buildQuickCostDialogEntries(rows) {
    const entryMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const shopId = normalizeText(row && row.shopId);
      const shopName = normalizeText(row && row.shopName);
      const station = resolveQuickCostStationValue(row);
      const stationLabel = normalizeText(row && row.stationLabel);
      const spec = normalizeText(row && row.skuAttributeSet);
      const key = buildQuickCostEntryKey(shopId, station, spec);

      if (!key) {
        return;
      }

      const nextEntry = {
        key,
        shopId,
        shopName,
        station,
        stationLabel,
        skuId: normalizeText(row && (row.productSkuId || row.goodsSkuId || row.skuId)),
        skuCode: normalizeText(row && (row.skuExtCode || row.skuId)),
        skcId: normalizeText(row && row.skcId),
        skcCode: normalizeText(row && row.skcCode),
        spec,
        costPrice: normalizeQuickCostValue(row && row.costPrice),
        updatedAt: '',
        mergedRecordCount: 1,
        mergedCategoryLabels: [],
        mergedCostConflict: false
      };
      const previousEntry = entryMap.get(key);

      if (!previousEntry) {
        entryMap.set(key, nextEntry);
        return;
      }

      if (!previousEntry.costPrice && nextEntry.costPrice) {
        entryMap.set(key, nextEntry);
      }
    });

    return Array.from(entryMap.values()).sort((left, right) => {
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
  }

  function buildQuickCostShopNameMap(state, entries) {
    const shopNameMap = Object.create(null);
    const shopCatalogMap = state
      && state.shopCatalog
      && state.shopCatalog.shopMap
      && typeof state.shopCatalog.shopMap === 'object'
      ? state.shopCatalog.shopMap
      : null;

    if (shopCatalogMap) {
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
    }

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);
      const shopName = normalizeText(entry && entry.shopName);

      if (shopId && shopName && !shopNameMap[shopId]) {
        shopNameMap[shopId] = shopName;
      }
    });

    return shopNameMap;
  }

  function buildQuickCostPresetHintEntries(entries, targetShopIdSet) {
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
      const costPrice = normalizeQuickCostValue(entry && entry.costPrice);
      const previousEntry = entryMap.get(hintKey);

      if (previousEntry && (previousEntry.costPrice || !costPrice)) {
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
        specSegments: buildQuickCostSpecSegments(spec),
        costPrice,
        updatedAt: normalizeText(entry && entry.updatedAt)
      });
    });

    return Array.from(entryMap.values());
  }

  function buildQuickCostSourceEntries(snapshotEntries, presetHintEntries, targetShopIds) {
    const targetShopIdSet = new Set(normalizeSelectedShopIds(targetShopIds));
    const hintEntries = buildQuickCostPresetHintEntries(
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
              spec: normalizeText(hintEntry && hintEntry.spec),
              costPrice: normalizeQuickCostValue(entry && entry.costPrice) || normalizeQuickCostValue(hintEntry && hintEntry.costPrice),
              updatedAt: normalizeText(entry && entry.updatedAt) || normalizeText(hintEntry && hintEntry.updatedAt)
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
        costPrice: normalizeQuickCostValue(hintEntry && hintEntry.costPrice),
        updatedAt: normalizeText(hintEntry && hintEntry.updatedAt)
      });
      sourceEntryKeys.add(sourceKey);
    });

    return sourceEntries;
  }

  function buildQuickCostSharedDialogEntries(state, baseEntries, snapshotEntries, presetHintEntries) {
    const targetShopIds = normalizeSelectedShopIds(
      (Array.isArray(baseEntries) ? baseEntries : []).map((entry) => entry && entry.shopId)
    );
    const targetShopIdSet = new Set(targetShopIds);
    const allSourceHints = []
      .concat(Array.isArray(baseEntries) ? baseEntries : [])
      .concat(Array.isArray(presetHintEntries) ? presetHintEntries : []);
    const shopNameMap = buildQuickCostShopNameMap(
      state,
      allSourceHints.concat(Array.isArray(snapshotEntries) ? snapshotEntries : [])
    );
    const entryMap = new Map();
    const sourceEntries = buildQuickCostSourceEntries(
      snapshotEntries,
      allSourceHints,
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

  function mergeQuickCostSnapshotEntries(entries, snapshotEntries) {
    const snapshotMap = new Map();

    (Array.isArray(snapshotEntries) ? snapshotEntries : []).forEach((entry) => {
      buildQuickCostLookupKeys(
        entry && entry.shopId,
        resolveQuickCostStationValue(entry),
        entry && entry.spec
      ).forEach((key) => {
        if (!snapshotMap.has(key)) {
          snapshotMap.set(key, normalizeQuickCostValue(entry && entry.costPrice));
        }
      });
    });

    return (Array.isArray(entries) ? entries : []).map((entry) => {
      const matchedKey = buildQuickCostLookupKeys(
        entry && entry.shopId,
        resolveQuickCostStationValue(entry),
        entry && entry.spec
      ).find((key) => snapshotMap.has(key));

      if (!matchedKey) {
        return entry;
      }

      return {
        ...entry,
        costPrice: snapshotMap.get(matchedKey)
      };
    });
  }

  function applyQuickCostEntriesToRows(rows, entries) {
    const costMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      buildQuickCostLookupKeys(
        entry && entry.shopId,
        resolveQuickCostStationValue(entry),
        entry && entry.spec
      ).forEach((key) => {
        if (!costMap.has(key)) {
          costMap.set(key, normalizeQuickCostValue(entry && entry.costPrice));
        }
      });
    });

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const matchedKey = buildQuickCostLookupKeys(
        row && row.shopId,
        resolveQuickCostStationValue(row),
        row && row.skuAttributeSet
      ).find((key) => costMap.has(key));

      if (!matchedKey) {
        return row;
      }

      const normalizedCostPrice = costMap.get(matchedKey);
      const nextRow = {
        ...row,
        costPrice: normalizedCostPrice ? Number(normalizedCostPrice) : '',
        costState: normalizedCostPrice ? 'set' : 'unset'
      };

      nextRow.profitRate = computeRowProfitRate(nextRow);
      return nextRow;
    });
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

  function createState() {
    const filters = cloneFilters(DEFAULT_FILTERS);

    return {
      filters,
      appliedFilters: cloneFiltersForQuery(filters),
      rows: [],
      shopCatalog: buildEmptyShopCatalog(),
      shopSelectorOpen: false,
      shopSelectorKeyword: '',
      shopSelectorFocusSearch: false,
      shopSelectorLoading: false,
      shopSelectorLoaded: false,
      shopSelectorError: '',
      shopSelectorPromise: null,
      shopSelectionPreset: createShopSelectionPresetState(),
      stationSelectorOpen: false,
      queryLoading: false,
      queryCanceling: false,
      queryRunId: '',
      queryProgress: null,
      queryError: '',
      queryWarning: '',
      queryResultMeta: null,
      queryDelaySeconds: 0,
      shopSelectionTouched: false,
      querySettingsLoaded: false,
      querySettingsLoading: false,
      querySettingsSaving: false,
      querySettingsPromise: null,
      querySettingsSaveTimer: 0,
      reviewRules: cloneReviewRules(DEFAULT_REVIEW_RULES),
      reviewRulesLoaded: false,
      reviewRulesLoading: false,
      reviewRulesPromise: null,
      reviewRulesSaveTimer: 0,
      batchRejectRunning: false,
      batchRejectError: '',
      batchRejectWarning: '',
      batchRejectNotice: '',
      quickCostDialogOpen: false,
      quickCostDialogLoading: false,
      quickCostDialogSaving: false,
      quickCostDialogError: '',
      quickCostDialogWarning: '',
      quickCostDialogNotice: '',
      quickCostDialogEntries: [],
      quickCostDialogRowCount: 0,
      quickCostDialogSourceEntryCount: 0,
      quickCostDialogMergedEntryCount: 0,
      quickCostDialogConflictCount: 0,
      imagePreview: null,
      removeQueryProgressListener: null
    };
  }

  function getState(container) {
    if (!container.__operationsPriceDeclarationState) {
      container.__operationsPriceDeclarationState = createState();
    }

    return container.__operationsPriceDeclarationState;
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
        state.shopCatalog = catalog && typeof catalog === 'object' ? catalog : buildEmptyShopCatalog();
        state.shopSelectorLoaded = true;
        state.shopSelectorError = '';
        state.filters.selectedShopIds = normalizeSelectedShopIds(state.filters.selectedShopIds)
          .filter((shopId) => Boolean(state.shopCatalog.shopMap && state.shopCatalog.shopMap[shopId]));
        state.appliedFilters.selectedShopIds = normalizeSelectedShopIds(state.appliedFilters.selectedShopIds)
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
      delaySeconds: Math.max(0, Number(payload.delaySeconds) || (Number(payload.delayMs) || 0) / 1000),
      message: normalizeText(payload.message),
      updatedAt: normalizeText(payload.updatedAt)
    };
  }

  function isTerminalQueryProgress(progress) {
    const phase = normalizeText(progress && progress.phase);
    return phase === 'completed' || phase === 'failed' || phase === 'canceled';
  }

  function formatDelaySeconds(value) {
    const normalizedValue = Math.max(0, Number(value) || 0);

    if (normalizedValue <= 0) {
      return '0';
    }

    return normalizedValue.toFixed(normalizedValue >= 1 ? 1 : 2)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*[1-9])0+$/, '$1');
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
    const totalCount = normalizedProgress.estimatedTotal > 0
      ? normalizedProgress.estimatedTotal
      : normalizedProgress.accumulatedItemCount;

    if (normalizedProgress.phase === 'preparing') {
      return normalizedProgress.message || '\u6b63\u5728\u51c6\u5907\u67e5\u8be2...';
    }

    if (normalizedProgress.phase === 'dispatching-query') {
      return normalizedProgress.message || '\u5df2\u53d1\u9001\u67e5\u8be2\u6307\u4ee4\uff0c\u6b63\u5728\u7b49\u5f85\u4e3b\u8fdb\u7a0b\u5904\u7406';
    }

    if (normalizedProgress.phase === 'warming-session') {
      return `${prefix}${normalizedProgress.message || '\u6b63\u5728\u68c0\u67e5\u5e97\u94fa\u767b\u5f55\u4f1a\u8bdd...'}`;
    }

    if (normalizedProgress.phase === 'starting') {
      return normalizedProgress.message || `${prefix}\u6b63\u5728\u67e5\u8be2`;
    }

    if (normalizedProgress.phase === 'requesting-page') {
      return `${prefix}${normalizedProgress.message || `\u6b63\u5728\u53d1\u8d77\u7b2c ${Math.max(1, normalizedProgress.pageNum)} \u9875\u8bf7\u6c42`}`;
    }

    if (normalizedProgress.phase === 'page-fetched') {
      return `${prefix}\u67e5\u8be2\u4e2d ${normalizedProgress.pageNum}/${Math.max(normalizedProgress.totalPages, 1)} \u9875\uff0c\u5df2\u83b7\u53d6 ${normalizedProgress.accumulatedItemCount}/${totalCount} \u6761`;
    }

    if (normalizedProgress.phase === 'delaying') {
      return `${prefix}\u5df2\u83b7\u53d6 ${normalizedProgress.accumulatedItemCount}/${totalCount} \u6761\uff0c${formatDelaySeconds(normalizedProgress.delaySeconds)}\u79d2\u540e\u7ee7\u7eed`;
    }

    if (normalizedProgress.phase === 'completed') {
      return normalizedProgress.message || `\u67e5\u8be2\u5b8c\u6210\uff0c\u5171 ${normalizedProgress.rowCount} \u6761SKU\u8bb0\u5f55`;
    }

    if (normalizedProgress.phase === 'canceling') {
      return '\u6b63\u5728\u505c\u6b62\u67e5\u8be2...';
    }

    if (normalizedProgress.phase === 'canceled') {
      return '\u67e5\u8be2\u5df2\u505c\u6b62';
    }

    if (normalizedProgress.phase === 'failed') {
      return `\u67e5\u8be2\u5931\u8d25\uff0c${normalizedProgress.message || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`;
    }

    return normalizedProgress.message || '';
  }

  function getQueryProgressToneClass(progress) {
    const phase = normalizeText(progress && progress.phase);

    if (phase === 'failed') {
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

  function renderQueryProgress(state) {
    const progress = normalizeQueryProgressPayload(state && state.queryProgress);
    const progressText = formatQueryProgressText(progress);

    if (!progressText) {
      return '';
    }

    return `
      <div class="ops-pd-query-progress ${getQueryProgressToneClass(progress)}">
        <strong>${escapeHtml(progressText)}</strong>
      </div>
    `;
  }

  async function loadQuerySettings(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.querySettingsLoading === true && state.querySettingsPromise) {
      return state.querySettingsPromise;
    }

    if (options.force !== true && state.querySettingsLoaded === true) {
      return state.queryDelaySeconds;
    }

    if (!featureCenterApi || typeof featureCenterApi.getOperationsPriceDeclarationQuerySettings !== 'function') {
      state.querySettingsLoaded = true;
      return state.queryDelaySeconds;
    }

    state.querySettingsLoading = true;
    state.querySettingsPromise = featureCenterApi.getOperationsPriceDeclarationQuerySettings()
      .then((response) => {
        const savedShopIds = normalizeSelectedShopIds(
          response
          && response.settings
          && response.settings.selectedShopIds
        );
        const nextDelaySeconds = Math.max(
          0,
          Number(
            response
            && response.settings
            && response.settings.perShopDelaySeconds
          ) || 0
        );

        state.queryDelaySeconds = Number(nextDelaySeconds.toFixed(2));

        if (state.shopSelectionTouched !== true) {
          const availableShopIds = state.shopSelectorLoaded === true && state.shopCatalog && state.shopCatalog.shopMap
            ? savedShopIds.filter((shopId) => Boolean(state.shopCatalog.shopMap[shopId]))
            : savedShopIds;

          state.filters.selectedShopIds = availableShopIds;
          state.appliedFilters.selectedShopIds = availableShopIds;
        }

        state.querySettingsLoaded = true;
        return state.queryDelaySeconds;
      })
      .catch(() => {
        state.querySettingsLoaded = true;
        return state.queryDelaySeconds;
      })
      .finally(() => {
        state.querySettingsLoading = false;
        state.querySettingsPromise = null;
        render(container);
      });

    return state.querySettingsPromise;
  }

  async function saveQuerySettings(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const shouldRenderSaving = options && options.silent === true ? false : true;

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsPriceDeclarationQuerySettings !== 'function'
    ) {
      return null;
    }

    if (shouldRenderSaving) {
      state.querySettingsSaving = true;
      render(container);
    }

    try {
      const response = await featureCenterApi.saveOperationsPriceDeclarationQuerySettings({
        perShopDelaySeconds: state.queryDelaySeconds,
        selectedShopIds: normalizeSelectedShopIds(state.filters.selectedShopIds)
      });
      const savedDelaySeconds = Math.max(
        0,
        Number(response && response.settings && response.settings.perShopDelaySeconds) || 0
      );

      state.queryDelaySeconds = Number(savedDelaySeconds.toFixed(2));
      return response;
    } catch (_error) {
      return null;
    } finally {
      if (shouldRenderSaving) {
        state.querySettingsSaving = false;
        render(container);
      }
    }
  }

  async function loadShopSelectionPresetSnapshot(container, options = {}) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.loadSnapshot !== 'function') {
      return state.shopSelectionPreset;
    }

    return helper.loadSnapshot(state.shopSelectionPreset, {
      force: options.force === true,
      onChange: () => render(container)
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

    return helper.saveTemplate(state.shopSelectionPreset, state.filters.selectedShopIds, {
      onChange: () => render(container)
    });
  }

  async function deleteShopSelectionTemplate(container, templateId) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.deleteTemplate !== 'function') {
      return null;
    }

    return helper.deleteTemplate(state.shopSelectionPreset, templateId, {
      onChange: () => render(container)
    });
  }

  function normalizePresetShopSelection(state, selectedShopIds) {
    const normalizedSelectedShopIds = normalizeSelectedShopIds(selectedShopIds);

    if (state.shopSelectorLoaded !== true || !state.shopCatalog || !state.shopCatalog.shopMap) {
      return normalizedSelectedShopIds;
    }

    return normalizedSelectedShopIds.filter((shopId) => Boolean(state.shopCatalog.shopMap[shopId]));
  }

  function applyShopSelectionPreset(container, selectedShopIds) {
    const state = getState(container);
    const nextSelectedShopIds = normalizePresetShopSelection(state, selectedShopIds);

    if (nextSelectedShopIds.length <= 0) {
      return;
    }

    state.filters.selectedShopIds = nextSelectedShopIds;
    state.shopSelectionTouched = true;
    scheduleSaveQuerySettings(container);
    void saveShopSelectionLast(container, nextSelectedShopIds);
    render(container);
  }

  function scheduleSaveQuerySettings(container) {
    const state = getState(container);

    if (state.querySettingsSaveTimer) {
      window.clearTimeout(state.querySettingsSaveTimer);
      state.querySettingsSaveTimer = 0;
    }

    state.querySettingsSaveTimer = window.setTimeout(() => {
      state.querySettingsSaveTimer = 0;
      void saveQuerySettings(container, {
        silent: true
      });
    }, 350);
  }

  async function loadReviewRules(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.reviewRulesLoading === true && state.reviewRulesPromise) {
      return state.reviewRulesPromise;
    }

    if (options.force !== true && state.reviewRulesLoaded === true) {
      return state.reviewRules;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsPriceDeclarationReviewRules !== 'function'
    ) {
      state.reviewRulesLoaded = true;
      return state.reviewRules;
    }

    state.reviewRulesLoading = true;
    state.reviewRulesPromise = featureCenterApi.getOperationsPriceDeclarationReviewRules()
      .then((response) => {
        state.reviewRules = cloneReviewRules(response && response.rules);
        state.reviewRulesLoaded = true;
        return state.reviewRules;
      })
      .catch(() => {
        state.reviewRulesLoaded = true;
        return state.reviewRules;
      })
      .finally(() => {
        state.reviewRulesLoading = false;
        state.reviewRulesPromise = null;
        render(container);
      });

    return state.reviewRulesPromise;
  }

  async function saveReviewRules(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsPriceDeclarationReviewRules !== 'function'
    ) {
      return null;
    }

    try {
      const response = await featureCenterApi.saveOperationsPriceDeclarationReviewRules(
        cloneReviewRules(state.reviewRules)
      );
      state.reviewRules = cloneReviewRules(response && response.rules);
      return response;
    } catch (_error) {
      return null;
    }
  }

  function scheduleSaveReviewRules(container) {
    const state = getState(container);

    if (state.reviewRulesSaveTimer) {
      window.clearTimeout(state.reviewRulesSaveTimer);
      state.reviewRulesSaveTimer = 0;
    }

    state.reviewRulesSaveTimer = window.setTimeout(() => {
      state.reviewRulesSaveTimer = 0;
      void saveReviewRules(container);
    }, 350);
  }

  function compareFilters(left, right) {
    const leftFilters = cloneFiltersForQuery(left);
    const rightFilters = cloneFiltersForQuery(right);

    return JSON.stringify(leftFilters) === JSON.stringify(rightFilters);
  }

  function matchKeywordList(targetValue, keywordList) {
    if (!Array.isArray(keywordList) || keywordList.length <= 0) {
      return true;
    }

    const haystack = normalizeText(targetValue).toLowerCase();

    return keywordList.some((keyword) => haystack.includes(normalizeText(keyword).toLowerCase()));
  }

  function applyFilters(rows, filters) {
    const normalizedFilters = cloneFilters(filters);
    const selectedShopIds = new Set(normalizeSelectedShopIds(normalizedFilters.selectedShopIds));
    const selectedStationIds = new Set(normalizeSelectedStationIds(normalizedFilters.stationIds));
    const orderNoKeywords = parseKeywordList(normalizedFilters.orderNoKeywords);
    const skcIdKeywords = parseKeywordList(normalizedFilters.skcIdKeywords);
    const goodsNoKeywords = parseKeywordList(normalizedFilters.goodsNoKeywords);
    const createdDateStartTimestamp = parseDateTimestamp(normalizedFilters.createdDateStart);
    const createdDateEndTimestamp = parseDateTimestamp(normalizedFilters.createdDateEnd, {
      endOfDay: true
    });

    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (selectedShopIds.size > 0 && !selectedShopIds.has(normalizeText(row && row.shopId))) {
        return false;
      }

      if (selectedStationIds.size > 0) {
        const rowStationIds = Array.isArray(row && row.stationIds)
          ? row.stationIds.map((stationId) => normalizeText(stationId)).filter(Boolean)
          : [normalizeText(row && row.station)].filter(Boolean);

        if (!rowStationIds.some((stationId) => selectedStationIds.has(stationId))) {
          return false;
        }
      }

      if (normalizedFilters.costState) {
        const rowCostPrice = Number(row && row.costPrice);
        const rowCostState = Number.isFinite(rowCostPrice) && rowCostPrice > 0 ? 'set' : 'unset';

        if (rowCostState !== normalizedFilters.costState) {
          return false;
        }
      }

      if (
        normalizedFilters.productSource
        && normalizeText(row && row.operationStatus) !== normalizedFilters.productSource
        && normalizeText(row && row.batchRejectPinnedProductSource) !== normalizedFilters.productSource
      ) {
        return false;
      }

      if (
        normalizedFilters.declarationPriceType
        && getRowDeclarationPriceType(row) !== normalizedFilters.declarationPriceType
      ) {
        return false;
      }

      if (
        normalizedFilters.customizedProduct
        && normalizeText(row && row.customizedProduct) !== normalizedFilters.customizedProduct
      ) {
        return false;
      }

      if (!matchKeywordList(row && row.orderNo, orderNoKeywords)) {
        return false;
      }

      if (
        normalizedFilters.productName
        && !normalizeText(row && row.productName).toLowerCase().includes(normalizedFilters.productName.toLowerCase())
      ) {
        return false;
      }

      if (!matchKeywordList(row && row.skcId, skcIdKeywords)) {
        return false;
      }

      if (goodsNoKeywords.length > 0) {
        const goodsNoTarget = normalizedFilters.goodsNoType === 'sku'
          ? normalizeText(row && row.skuId)
          : normalizeText(row && row.skcId);

        if (!matchKeywordList(goodsNoTarget, goodsNoKeywords)) {
          return false;
        }
      }

      if (Number.isFinite(createdDateStartTimestamp) || Number.isFinite(createdDateEndTimestamp)) {
        const createdAtTimestamp = parseDateTimestamp(row && row.createdAt);

        if (!Number.isFinite(createdAtTimestamp)) {
          return false;
        }

        if (Number.isFinite(createdDateStartTimestamp) && createdAtTimestamp < createdDateStartTimestamp) {
          return false;
        }

        if (Number.isFinite(createdDateEndTimestamp) && createdAtTimestamp > createdDateEndTimestamp) {
          return false;
        }
      }

      return true;
    });
  }

  function countPendingSellerOrders(rows) {
    const orderKeySet = new Set();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (normalizeText(row && row.operationStatus) !== 'pendingSeller') {
        return;
      }

      const orderKey = normalizeText(row && row.reviewOrderId) || normalizeText(row && row.orderNo);

      if (orderKey) {
        orderKeySet.add(orderKey);
      }
    });

    return orderKeySet.size;
  }

  function normalizeOptionalNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : '';
  }

  function serializeRowsForBatchReject(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      reviewOrderId: normalizeText(row && row.reviewOrderId),
      orderNo: normalizeText(row && row.orderNo),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      declarationPriceType: getRowDeclarationPriceType(row)
        || normalizeText(
          row && (
            row.declarationPriceType
            || row.priceType
          )
        ),
      operationStatus: normalizeText(row && row.operationStatus),
      adjustedDeclaredPrice: normalizeOptionalNumber(row && row.adjustedDeclaredPrice),
      costPrice: normalizeOptionalNumber(row && row.costPrice),
      profitRate: normalizeOptionalNumber(row && row.profitRate)
    }));
  }

  function buildBatchRejectNotice(response) {
    const passOrderCount = Math.max(0, Number(response && response.passOrderCount) || 0);
    const requestedPassOrderCount = Math.max(0, Number(response && response.requestedPassOrderCount) || passOrderCount);
    const approvedOrderCount = Math.max(0, Number(response && response.approvedOrderCount) || 0);
    const failedApproveOrderCount = Math.max(0, Number(response && response.failedApproveOrderCount) || 0);
    const requestedRejectOrderCount = Math.max(0, Number(response && response.requestedRejectOrderCount) || 0);
    const rejectedOrderCount = Math.max(0, Number(response && response.rejectedOrderCount) || 0);
    const failedRejectOrderCount = Math.max(0, Number(response && response.failedRejectOrderCount) || 0);

    if (requestedPassOrderCount <= 0 && requestedRejectOrderCount <= 0) {
      return passOrderCount > 0
        ? `\u89c4\u5219\u5224\u65ad\u540e ${passOrderCount} \u6761\u7b26\u5408\u901a\u8fc7\uff0c\u672a\u53d1\u8d77\u6279\u91cf\u5ba1\u6838`
        : '\u5f53\u524d\u89c4\u5219\u4e0b\u6ca1\u6709\u53ef\u63d0\u4ea4\u62d2\u7edd\u7684\u8bb0\u5f55';
    }

    const noticeParts = [`\u89c4\u5219\u901a\u8fc7 ${passOrderCount} \u6761`];

    if (requestedPassOrderCount > 0) {
      noticeParts.push(`\u63d0\u4ea4\u540c\u610f\u8c03\u4ef7 ${requestedPassOrderCount} \u6761`);
      noticeParts.push(`\u540c\u610f\u6210\u529f ${approvedOrderCount} \u6761`);
      if (failedApproveOrderCount > 0) {
        noticeParts.push(`\u540c\u610f\u5931\u8d25 ${failedApproveOrderCount} \u6761`);
      }
    }

    if (requestedRejectOrderCount > 0) {
      noticeParts.push(`\u63d0\u4ea4\u62d2\u7edd ${requestedRejectOrderCount} \u6761`);
      noticeParts.push(`\u62d2\u7edd\u6210\u529f ${rejectedOrderCount} \u6761`);
      if (failedRejectOrderCount > 0) {
        noticeParts.push(`\u62d2\u7edd\u5931\u8d25 ${failedRejectOrderCount} \u6761`);
      }
    }

    return noticeParts.join('\uff0c');
  }

  function applyBatchRejectResultToRows(rows, response) {
    const rejectReason = normalizeText(
      response && (
        response.rejectReason
        || response.reason
      )
    );
    const succeededApprovedReviewOrderIdSet = new Set(
      (Array.isArray(response && response.succeededApprovedReviewOrderIds) ? response.succeededApprovedReviewOrderIds : [])
        .map((reviewOrderId) => normalizeText(reviewOrderId))
        .filter(Boolean)
    );
    const succeededApprovedOrderNoSet = new Set(
      (Array.isArray(response && response.succeededApprovedOrderNos) ? response.succeededApprovedOrderNos : [])
        .map((orderNo) => normalizeText(orderNo))
        .filter(Boolean)
    );
    const succeededRejectedReviewOrderIdSet = new Set(
      (Array.isArray(response && response.succeededRejectedReviewOrderIds) ? response.succeededRejectedReviewOrderIds : (
        Array.isArray(response && response.succeededReviewOrderIds) ? response.succeededReviewOrderIds : []
      ))
        .map((reviewOrderId) => normalizeText(reviewOrderId))
        .filter(Boolean)
    );
    const succeededRejectedOrderNoSet = new Set(
      (Array.isArray(response && response.succeededRejectedOrderNos) ? response.succeededRejectedOrderNos : (
        Array.isArray(response && response.succeededOrderNos) ? response.succeededOrderNos : []
      ))
        .map((orderNo) => normalizeText(orderNo))
        .filter(Boolean)
    );
    const failedResultByReviewOrderId = new Map();
    const failedResultByOrderNo = new Map();

    (Array.isArray(response && response.failedOrders) ? response.failedOrders : []).forEach((failedOrder) => {
      const reviewOrderId = normalizeText(failedOrder && failedOrder.reviewOrderId);
      const orderNo = normalizeText(failedOrder && failedOrder.orderNo);
      const failedReason = normalizeText(failedOrder && failedOrder.reason)
        || '\u63d0\u4ea4\u5931\u8d25';
      const action = normalizeText(failedOrder && failedOrder.action) || 'reject';
      const failedResult = {
        reason: failedReason,
        action
      };

      if (reviewOrderId) {
        failedResultByReviewOrderId.set(reviewOrderId, failedResult);
      }

      if (orderNo) {
        failedResultByOrderNo.set(orderNo, failedResult);
      }
    });

    if (
      succeededApprovedReviewOrderIdSet.size <= 0
      && succeededApprovedOrderNoSet.size <= 0
      && succeededRejectedReviewOrderIdSet.size <= 0
      && succeededRejectedOrderNoSet.size <= 0
      && failedResultByReviewOrderId.size <= 0
      && failedResultByOrderNo.size <= 0
    ) {
      return Array.isArray(rows) ? rows.slice() : [];
    }

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const reviewOrderId = normalizeText(row && row.reviewOrderId);
      const orderNo = normalizeText(row && row.orderNo);
      const originalOperationStatus = normalizeText(row && row.operationStatus) || 'pendingSeller';
      const matchedApprovedByReviewOrderId = reviewOrderId && succeededApprovedReviewOrderIdSet.has(reviewOrderId);
      const matchedApprovedByOrderNo = (
        (!reviewOrderId && succeededApprovedOrderNoSet.has(orderNo))
        || succeededApprovedOrderNoSet.has(orderNo)
      );
      const matchedRejectedByReviewOrderId = reviewOrderId && succeededRejectedReviewOrderIdSet.has(reviewOrderId);
      const matchedRejectedByOrderNo = (
        (!reviewOrderId && succeededRejectedOrderNoSet.has(orderNo))
        || succeededRejectedOrderNoSet.has(orderNo)
      );
      const failedResult = (
        (reviewOrderId && failedResultByReviewOrderId.get(reviewOrderId))
        || failedResultByOrderNo.get(orderNo)
        || null
      );

      if (matchedApprovedByReviewOrderId || matchedApprovedByOrderNo) {
        return {
          ...row,
          operationStatus: 'success',
          failedReason: '',
          batchRejectLogStatus: 'approved',
          batchRejectPinnedProductSource: originalOperationStatus
        };
      }

      if (matchedRejectedByReviewOrderId || matchedRejectedByOrderNo) {
        return {
          ...row,
          operationStatus: 'failed',
          failedReason: rejectReason || normalizeText(row && row.failedReason),
          batchRejectLogStatus: 'submitted',
          batchRejectPinnedProductSource: originalOperationStatus
        };
      }

      if (!failedResult) {
        return row;
      }

      return {
        ...row,
        failedReason: failedResult.reason || normalizeText(row && row.failedReason),
        batchRejectLogStatus: failedResult.action === 'approve' ? 'approveFailed' : 'submitFailed',
        batchRejectPinnedProductSource: originalOperationStatus
      };
    });
  }

  function resolveQueryShopIds(state) {
    const selectedShopIds = normalizeSelectedShopIds(state && state.filters && state.filters.selectedShopIds);

    if (selectedShopIds.length > 0) {
      return selectedShopIds;
    }

    return Array.isArray(state && state.shopCatalog && state.shopCatalog.shops)
      ? state.shopCatalog.shops
        .map((shop) => normalizeText(shop && shop.id))
        .filter(Boolean)
      : [];
  }

  function buildQueryRunId() {
    return `price_query_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function settleQueryRequestFromProgress(container, progress) {
    const state = getState(container);
    const normalizedProgress = normalizeQueryProgressPayload(progress);

    if (!normalizedProgress || !isTerminalQueryProgress(normalizedProgress)) {
      return;
    }

    if (
      normalizeText(state.queryRunId)
      && normalizeText(normalizedProgress.runId)
      && normalizeText(normalizedProgress.runId) !== normalizeText(state.queryRunId)
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
      || typeof featureCenterApi.onOperationsPriceDeclarationProgress !== 'function'
    ) {
      return;
    }

    state.removeQueryProgressListener = featureCenterApi.onOperationsPriceDeclarationProgress((payload) => {
      const nextProgress = normalizeQueryProgressPayload(payload);

      if (!nextProgress) {
        return;
      }

      if (
        normalizeText(state.queryRunId)
        && normalizeText(nextProgress.runId)
        && normalizeText(nextProgress.runId) !== normalizeText(state.queryRunId)
      ) {
        return;
      }

      state.queryProgress = nextProgress;
      settleQueryRequestFromProgress(container, nextProgress);
      render(container);
    });

    window.addEventListener('beforeunload', () => {
      if (typeof state.removeQueryProgressListener === 'function') {
        state.removeQueryProgressListener();
        state.removeQueryProgressListener = null;
      }
    }, { once: true });
  }

  async function startQuery(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.queryLoading === true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.queryOperationsPriceDeclarationRows !== 'function'
    ) {
      state.queryError = '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
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
    const queryFilters = cloneFiltersForQuery(state.filters);
    const appliedFilters = {
      ...queryFilters,
      costState: normalizeText(state.appliedFilters && state.appliedFilters.costState)
    };

    state.appliedFilters = appliedFilters;
    state.rows = [];
    state.queryRunId = runId;
    state.queryLoading = true;
    state.queryCanceling = false;
    state.queryError = '';
    state.queryWarning = '';
    state.queryResultMeta = null;
    state.batchRejectError = '';
    state.batchRejectWarning = '';
    state.batchRejectNotice = '';
    state.queryProgress = normalizeQueryProgressPayload({
      runId,
      phase: 'dispatching-query',
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
      const response = await featureCenterApi.queryOperationsPriceDeclarationRows({
        runId,
        shopIds,
        filters: queryFilters,
        perShopDelaySeconds: state.queryDelaySeconds
      });

      state.rows = Array.isArray(response && response.rows) ? response.rows : [];
      state.queryWarning = normalizeText(response && response.warning);
      state.queryResultMeta = {
        updatedAt: normalizeText(response && response.updatedAt),
        rowCount: Number(response && response.rowCount) || state.rows.length,
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
        rowCount: state.rows.length,
        totalShops: state.queryResultMeta.totalShops,
        completedShops: state.queryResultMeta.completedShops,
        failedShops: state.queryResultMeta.failedShops,
        canceledShops: state.queryResultMeta.canceledShops,
        message: state.queryWarning
      });
      return response;
    } catch (error) {
      state.queryError = normalizeText(error && error.message) || '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u5931\u8d25';
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
      || typeof featureCenterApi.cancelOperationsPriceDeclarationQuery !== 'function'
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
      return await featureCenterApi.cancelOperationsPriceDeclarationQuery({
        runId
      });
    } catch (error) {
      state.queryError = normalizeText(error && error.message) || '\u505c\u6b62\u67e5\u8be2\u5931\u8d25';
      return null;
    } finally {
      render(container);
    }
  }

  async function batchRejectVisibleRows(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const visibleRows = applyFilters(state.rows, state.appliedFilters);
    const pendingSellerOrderCount = countPendingSellerOrders(visibleRows);

    if (
      !featureCenterApi
      || typeof featureCenterApi.batchRejectOperationsPriceDeclarationRows !== 'function'
    ) {
      state.batchRejectError = '\u6279\u91cf\u62d2\u7edd\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    if (pendingSellerOrderCount <= 0) {
      state.batchRejectError = '\u5f53\u524d\u7b5b\u9009\u7ed3\u679c\u4e2d\u6ca1\u6709\u5f85\u5356\u5bb6\u786e\u8ba4\u7684\u8bb0\u5f55';
      render(container);
      return null;
    }

    state.batchRejectRunning = true;
    state.batchRejectError = '';
    state.batchRejectWarning = '';
    state.batchRejectNotice = '';
    render(container);

    try {
      await saveReviewRules(container);

      const response = await featureCenterApi.batchRejectOperationsPriceDeclarationRows({
        rules: cloneReviewRules(state.reviewRules),
        rejectReason: normalizeText(state.reviewRules && state.reviewRules.rejectReason),
        rows: serializeRowsForBatchReject(visibleRows)
      });

      state.reviewRules = cloneReviewRules(response && response.rules);
      state.rows = applyBatchRejectResultToRows(state.rows, response);
      state.batchRejectWarning = normalizeText(response && response.warning);
      state.batchRejectNotice = buildBatchRejectNotice(response);
      return response;
    } catch (error) {
      state.batchRejectError = normalizeText(error && error.message) || '\u6279\u91cf\u62d2\u7edd\u5931\u8d25';
      return null;
    } finally {
      state.batchRejectRunning = false;
      render(container);
    }
  }

  async function openQuickCostPresetDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const visibleRows = applyFilters(state.rows, state.appliedFilters);
    const baseEntries = buildQuickCostDialogEntries(visibleRows);

    if (baseEntries.length <= 0) {
      state.queryError = '\u8bf7\u5148\u67e5\u8be2\u5e76\u7b5b\u51fa\u9700\u8981\u9884\u8bbe\u6210\u672c\u7684SKU';
      render(container);
      return;
    }

    state.quickCostDialogOpen = true;
    state.quickCostDialogLoading = true;
    state.quickCostDialogSaving = false;
    state.quickCostDialogError = '';
    state.quickCostDialogWarning = '';
    state.quickCostDialogNotice = '';
    state.quickCostDialogEntries = baseEntries;
    state.quickCostDialogRowCount = visibleRows.length;
    state.quickCostDialogSourceEntryCount = baseEntries.length;
    state.quickCostDialogMergedEntryCount = 0;
    state.quickCostDialogConflictCount = 0;
    render(container);

    const targetShopIds = normalizeSelectedShopIds(baseEntries.map((entry) => entry && entry.shopId));
    const hasSharedCostApi = Boolean(
      featureCenterApi
      && typeof featureCenterApi.getOperationsSharedCostSnapshot === 'function'
    );
    const hasLegacyCostApi = Boolean(
      featureCenterApi
      && typeof featureCenterApi.getOperationsPriceDeclarationQuickCostPresetSnapshot === 'function'
    );

    if (!hasSharedCostApi && !hasLegacyCostApi) {
      state.quickCostDialogLoading = false;
      render(container);
      return;
    }

    try {
      if (hasSharedCostApi) {
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

        const aggregateResult = buildQuickCostSharedDialogEntries(
          state,
          baseEntries,
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
          warningList.push(`\u5df2\u6309\u201c\u5e97\u94faID + \u7ad9\u70b9ID + SKU\u89c4\u683c\u201d\u805a\u5408\u5171\u4eab\u6210\u672c\u4ef7\uff0c\u5176\u4e2d ${aggregateResult.conflictCount} \u9879\u547d\u4e2d\u4e86\u591a\u6761\u4e0d\u540c\u6210\u672c\u4ef7\u8bb0\u5f55\uff0c\u5df2\u9ed8\u8ba4\u53d6\u6700\u8fd1\u66f4\u65b0\u7684\u6210\u672c\u4ef7\u3002`);
        }

        state.quickCostDialogEntries = aggregateResult.entries;
        state.quickCostDialogSourceEntryCount = aggregateResult.sourceEntryCount;
        state.quickCostDialogMergedEntryCount = aggregateResult.mergedEntryCount;
        state.quickCostDialogConflictCount = aggregateResult.conflictCount;
        state.quickCostDialogWarning = warningList.join('\n');
        return;
      }

      const response = await featureCenterApi.getOperationsPriceDeclarationQuickCostPresetSnapshot({
        shopIds: targetShopIds,
        entries: baseEntries.map((entry) => ({
          shopId: entry.shopId,
          station: entry.station,
          stationLabel: entry.stationLabel,
          spec: entry.spec
        }))
      });

      state.quickCostDialogEntries = mergeQuickCostSnapshotEntries(
        baseEntries,
        response && response.entries
      );
      state.quickCostDialogSourceEntryCount = state.quickCostDialogEntries.length;
      state.quickCostDialogMergedEntryCount = 0;
      state.quickCostDialogConflictCount = 0;
      state.quickCostDialogWarning = normalizeText(response && response.warning);
    } catch (error) {
      state.quickCostDialogError = normalizeText(error && error.message) || '\u6210\u672c\u9884\u8bbe\u6570\u636e\u52a0\u8f7d\u5931\u8d25';
    } finally {
      state.quickCostDialogLoading = false;
      render(container);
    }
  }

  async function saveQuickCostPresetDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    const hasSharedCostApi = Boolean(
      featureCenterApi
      && typeof featureCenterApi.saveOperationsSharedCostBatch === 'function'
    );
    const hasLegacyCostApi = Boolean(
      featureCenterApi
      && typeof featureCenterApi.saveOperationsPriceDeclarationQuickCostPresetBatch === 'function'
    );

    if (!hasSharedCostApi && !hasLegacyCostApi) {
      state.quickCostDialogError = '\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
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
      const response = hasSharedCostApi
        ? await featureCenterApi.saveOperationsSharedCostBatch({
          entries: payloadEntries
        })
        : await featureCenterApi.saveOperationsPriceDeclarationQuickCostPresetBatch({
          entries: payloadEntries
        });

      state.rows = applyQuickCostEntriesToRows(state.rows, payloadEntries);
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
        || (hasSharedCostApi && response && response.cloudSynced !== true
          ? '\u6210\u672c\u9884\u8bbe\u5df2\u4fdd\u5b58\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210'
          : '');
      state.quickCostDialogNotice = `\u5df2\u4fdd\u5b58 ${payloadEntries.length} \u9879\u6210\u672c\u9884\u8bbe`;
      state.queryWarning = state.quickCostDialogWarning;
      return response;
    } catch (error) {
      state.quickCostDialogError = normalizeText(error && error.message) || '\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u5931\u8d25';
      return null;
    } finally {
      state.quickCostDialogSaving = false;
      render(container);
    }
  }

  function closeQuickCostPresetDialog(container) {
    const state = getState(container);

    state.quickCostDialogOpen = false;
    state.quickCostDialogLoading = false;
    state.quickCostDialogSaving = false;
    state.quickCostDialogError = '';
    state.quickCostDialogWarning = '';
    state.quickCostDialogNotice = '';
    state.quickCostDialogEntries = [];
    state.quickCostDialogRowCount = 0;
    state.quickCostDialogSourceEntryCount = 0;
    state.quickCostDialogMergedEntryCount = 0;
    state.quickCostDialogConflictCount = 0;
    render(container);
  }

  function renderOptions(options, selectedValue, defaultLabel, renderOptionsConfig = {}) {
    const normalizedSelectedValue = normalizeText(selectedValue);
    const optionItems = renderOptionsConfig && renderOptionsConfig.includeEmpty === false
      ? []
      : [`<option value="">${escapeHtml(defaultLabel)}</option>`];

    (Array.isArray(options) ? options : []).forEach((option) => {
      optionItems.push(
        `<option value="${escapeHtml(option.value)}"${normalizeText(option.value) === normalizedSelectedValue ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
      );
    });

    return optionItems.join('');
  }

  function renderShopSelectorField(state) {
    const control = getShopMultiSelectControl();
    const selectedShopIds = normalizeSelectedShopIds(state.filters.selectedShopIds);
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
      <label class="ops-pd-field ops-pd-field-inline ops-pd-field-shop span-4">
        <span class="ops-pd-field-label">\u5e97\u94fa</span>
        <span class="ops-pd-field-content">
          ${fieldMarkup}
          ${state.shopSelectorError ? `<span class="ops-pd-filter-note is-error">${escapeHtml(state.shopSelectorError)}</span>` : ''}
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
    const selectedStationIds = normalizeSelectedStationIds(state.filters.stationIds);
    const selectedStationSet = new Set(selectedStationIds);
    const stationOptions = getStationOptions();

    return `
      <div class="ops-pd-field ops-pd-field-inline ops-pd-field-station span-2" data-price-declare-station-select>
        <span class="ops-pd-field-label">\u7ad9\u70b9</span>
        <div class="ops-pd-station-select">
          <button
            class="ops-pd-station-trigger${state.stationSelectorOpen === true ? ' is-open' : ''}"
            type="button"
            data-price-declare-station-toggle="true"
          >
            <span>${escapeHtml(renderSelectedStationText(selectedStationIds))}</span>
            <span class="ops-pd-station-arrow" aria-hidden="true">\u25be</span>
          </button>
          ${state.stationSelectorOpen === true ? `
            <div class="ops-pd-station-panel">
              <div class="ops-pd-station-toolbar">
                <button class="ops-pd-station-action" type="button" data-price-declare-station-action="select-us">\u7f8e\u56fd\u7ad9</button>
                <button class="ops-pd-station-action" type="button" data-price-declare-station-action="clear">\u6e05\u7a7a</button>
                <span class="ops-pd-station-count">\u5df2\u9009 ${escapeHtml(String(selectedStationIds.length))}</span>
              </div>
              <div class="ops-pd-station-list">
                ${stationOptions.map((option) => `
                  <label class="ops-pd-station-item">
                    <input
                      type="checkbox"
                      data-price-declare-station-option="${escapeHtml(option.value)}"
                      ${selectedStationSet.has(normalizeText(option.value)) ? ' checked' : ''}
                    />
                    <span>${escapeHtml(option.label)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderQueryDelayControls(state) {
    return `
      <label class="ops-pd-query-delay">
        <span class="ops-pd-query-delay-label">\u67e5\u8be2\u5ef6\u65f6</span>
        <input
          class="ops-pd-control ops-pd-query-delay-input"
          type="number"
          min="0"
          step="0.1"
          data-price-declare-setting="perShopDelaySeconds"
          value="${escapeHtml(state.queryDelaySeconds)}"
          ${state.querySettingsSaving === true ? ' disabled' : ''}
        />
        <span class="ops-pd-query-delay-unit">\u79d2</span>
      </label>
    `;
  }

  function renderReviewRulesPanel(state, filteredRows, queryRunning) {
    const reviewRules = cloneReviewRules(state && state.reviewRules);
    const pendingSellerOrderCount = countPendingSellerOrders(filteredRows);

    return `
      <label class="ops-pd-inline-review-field is-threshold">
        <span class="ops-pd-inline-review-label">\u65e5\u5e38\u4ef7\u683c \u2265</span>
        <span class="ops-pd-field-content ops-pd-review-rule-shell">
          <input
            class="ops-pd-control"
            type="number"
            min="0"
            step="0.01"
            value="${escapeHtml(reviewRules.dailyRule.threshold)}"
            placeholder="\u8bf7\u8f93\u5165"
            data-price-declare-review-rule="dailyRule.threshold"
            ${state.batchRejectRunning === true ? ' disabled' : ''}
          />
          <select
            class="ops-pd-control"
            data-price-declare-review-rule="dailyRule.metric"
            ${state.batchRejectRunning === true ? ' disabled' : ''}
          >
            ${renderOptions(REVIEW_RULE_METRIC_OPTIONS, reviewRules.dailyRule.metric, '', {
              includeEmpty: false
            })}
          </select>
        </span>
      </label>
      <label class="ops-pd-inline-review-field is-threshold">
        <span class="ops-pd-inline-review-label">\u6216 \u6d3b\u52a8\u4ef7\u683c \u2265</span>
        <span class="ops-pd-field-content ops-pd-review-rule-shell has-note">
          <input
            class="ops-pd-control"
            type="number"
            min="0"
            step="0.01"
            value="${escapeHtml(reviewRules.activityRule.threshold)}"
            placeholder="\u8bf7\u8f93\u5165"
            data-price-declare-review-rule="activityRule.threshold"
            ${state.batchRejectRunning === true ? ' disabled' : ''}
          />
          <select
            class="ops-pd-control"
            data-price-declare-review-rule="activityRule.metric"
            ${state.batchRejectRunning === true ? ' disabled' : ''}
          >
            ${renderOptions(REVIEW_RULE_METRIC_OPTIONS, reviewRules.activityRule.metric, '', {
              includeEmpty: false
            })}
          </select>
          <span class="ops-pd-review-rule-note">\u901a\u8fc7\u8c03\u4ef7\uff0c\u5426\u5219\u62d2\u7edd\u8c03\u4ef7</span>
        </span>
      </label>
      <label class="ops-pd-inline-review-field is-reason">
        <span class="ops-pd-inline-review-label">\u62d2\u7edd\u8bf4\u660e</span>
        <span class="ops-pd-field-content">
          <input
            class="ops-pd-control"
            type="text"
            maxlength="100"
            value="${escapeHtml(reviewRules.rejectReason)}"
            placeholder="\u7b26\u5408\u6761\u4ef6\u901a\u8fc7\u8c03\u6574\uff0c\u5426\u5219\u62d2\u7edd\u8c03\u4ef7"
            data-price-declare-review-rule="rejectReason"
            ${state.batchRejectRunning === true ? ' disabled' : ''}
          />
        </span>
      </label>
      <button
        class="ops-pd-action-button is-danger"
        type="button"
        data-price-declare-action="batch-reject"
        ${queryRunning || state.batchRejectRunning === true || pendingSellerOrderCount <= 0 ? ' disabled' : ''}
      >
        ${state.batchRejectRunning === true ? '\u5904\u7406\u4e2d...' : '\u6279\u91cf\u8c03\u4ef7\u62d2\u7edd'}
      </button>
      <span class="ops-pd-inline-review-summary">\u5f85\u5356\u5bb6\u786e\u8ba4 ${escapeHtml(String(pendingSellerOrderCount))} \u6761</span>
      ${state.batchRejectError || state.batchRejectWarning || state.batchRejectNotice ? `
        
      ` : ''}
    `;
  }

  function renderReviewRuleMessages(state) {
    if (!state || (!state.batchRejectError && !state.batchRejectWarning && !state.batchRejectNotice)) {
      return '';
    }

    return `
      <div class="ops-pd-inline-review-messages">
        ${state.batchRejectError ? `<div class="ops-pd-review-rule-message is-error">${escapeHtml(state.batchRejectError)}</div>` : ''}
        ${state.batchRejectWarning ? `<div class="ops-pd-review-rule-message is-warning">${escapeHtml(state.batchRejectWarning)}</div>` : ''}
        ${state.batchRejectNotice ? `<div class="ops-pd-review-rule-message is-success">${escapeHtml(state.batchRejectNotice)}</div>` : ''}
      </div>
    `;
  }

  function renderStatusBadge(value) {
    const option = REPORT_STATUS_MAP[normalizeText(value)] || null;

    if (!option) {
      return `<span class="ops-pd-badge is-slate">--</span>`;
    }

    return `<span class="ops-pd-badge is-${escapeHtml(option.tone)}">${escapeHtml(option.label)}</span>`;
  }

  function renderTypeBadge(value) {
    const option = CHANGE_TYPE_MAP[normalizeText(value)] || null;

    if (!option) {
      return `<span class="ops-pd-badge is-slate">--</span>`;
    }

    return `<span class="ops-pd-badge is-${escapeHtml(option.tone)}">${escapeHtml(option.label)}</span>`;
  }

  function renderPriceTypeBadge(value) {
    const option = DECLARATION_PRICE_TYPE_MAP[normalizeDeclarationPriceTypeValue(value)] || null;

    if (!option) {
      return '--';
    }

    return `<span class="ops-pd-mini-badge">${escapeHtml(option.label)}</span>`;
  }

  function renderRowPriceTypeBadge(row) {
    const label = getRowDeclarationPriceTypeLabel(row);

    if (!label || label === '--') {
      return '--';
    }

    return `<span class="ops-pd-mini-badge">${escapeHtml(label)}</span>`;
  }

  function resolveOperationStatusLabel(value) {
    const option = REPORT_STATUS_MAP[normalizeText(value)] || null;
    return option ? option.label : '--';
  }

  function renderOperationStatusCell(row) {
    const logStatus = normalizeText(row && row.batchRejectLogStatus);
    let logLabel = '';
    let logTone = 'muted';

    if (logStatus === 'approved') {
      logLabel = '\u5df2\u63d0\u4ea4\u540c\u610f\u8c03\u4ef7';
      logTone = 'success';
    } else if (logStatus === 'approveFailed') {
      logLabel = '\u540c\u610f\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25';
      logTone = 'error';
    } else if (logStatus === 'submitted') {
      logLabel = '\u5df2\u63d0\u4ea4\u62d2\u7edd';
      logTone = 'success';
    } else if (logStatus === 'submitFailed') {
      logLabel = '\u62d2\u7edd\u63d0\u4ea4\u5931\u8d25';
      logTone = 'error';
    }

    if (!logLabel) {
      return renderStatusBadge(row && row.operationStatus);
    }

    return `
      <div class="ops-pd-status-cell">
        ${renderStatusBadge(row && row.operationStatus)}
        <span class="ops-pd-status-note is-${escapeHtml(logTone)}">${escapeHtml(logLabel)}</span>
      </div>
    `;
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

  function normalizeImagePreview(payload) {
    const sourceUrl = normalizeText(payload && payload.sourceUrl);

    if (!sourceUrl) {
      return null;
    }

    return {
      sourceUrl,
      previewUrl: buildSizedImageUrl(sourceUrl, PRODUCT_PREVIEW_SIZE) || sourceUrl,
      title: normalizeText(payload && payload.title)
    };
  }

  function renderImagePreviewDialog(state) {
    const preview = normalizeImagePreview(state && state.imagePreview);

    if (!preview) {
      return '';
    }

    return `
      <div class="ops-pd-image-preview" data-price-declare-image-preview-backdrop="true">
        <div class="ops-pd-image-preview-dialog" data-price-declare-image-preview-panel="true">
          <button
            class="ops-pd-image-preview-close"
            type="button"
            data-price-declare-image-preview-close="true"
            aria-label="\u5173\u95ed\u5927\u56fe"
          >
            &times;
          </button>
          <div class="ops-pd-image-preview-body">
            <img src="${escapeHtml(preview.previewUrl)}" alt="${escapeHtml(preview.title || '\u5927\u56fe\u9884\u89c8')}" />
          </div>
          ${preview.title ? `<div class="ops-pd-image-preview-title">${escapeHtml(preview.title)}</div>` : ''}
        </div>
      </div>
    `;
  }

  function renderQuickCostDialog(state) {
    if (!state || state.quickCostDialogOpen !== true) {
      return '';
    }

    const groupedEntries = groupQuickCostDialogEntries(state.quickCostDialogEntries);
    const mergedEntryCount = normalizeNonNegativeInteger(state.quickCostDialogMergedEntryCount, 0);
    const conflictCount = normalizeNonNegativeInteger(state.quickCostDialogConflictCount, 0);

    return `
      <div class="ops-pd-quick-cost-modal" data-price-declare-quick-cost-backdrop="true">
        <div class="ops-pd-quick-cost-dialog" data-price-declare-quick-cost-panel="true">
          <div class="ops-pd-quick-cost-header">
            <div class="ops-pd-quick-cost-title-block">
              <h3 class="ops-pd-quick-cost-title">\u5feb\u901f\u9884\u8bbe\u6210\u672c\u4ef7</h3>
              <p class="ops-pd-quick-cost-subtitle">
                \u5f53\u524d\u5171 ${escapeHtml(String(state.quickCostDialogRowCount || 0))} \u6761SKU\u8bb0\u5f55\uff0c
                \u5df2\u6c47\u603b ${escapeHtml(String((state.quickCostDialogEntries || []).length))} \u4e2a\u6309\u5e97\u94fa\u3001\u7ad9\u70b9\u3001SKU\u89c4\u683c\u53bb\u91cd\u540e\u7684\u5171\u4eab\u6210\u672c\u4ef7\u3002
                <br />
                \u4fdd\u5b58\u540e\u4f1a\u540c\u6b65\u7ed9\u5f00\u542f\u6d41\u91cf\u52a0\u901f\u3001\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u7b49\u529f\u80fd\u5171\u7528\u3002
              </p>
            </div>
            <button
              class="ops-pd-quick-cost-close"
              type="button"
              data-price-declare-action="close-quick-cost-preset"
              aria-label="\u5173\u95ed\u6210\u672c\u9884\u8bbe"
            >
              &times;
            </button>
          </div>

          <div class="ops-pd-quick-cost-body">
            ${state.quickCostDialogLoading === true ? `
              <div class="ops-pd-quick-cost-empty">\u6b63\u5728\u4ece\u4e91\u7aef\u52a0\u8f7d\u5171\u4eab\u6210\u672c\u4ef7...</div>
            ` : groupedEntries.length <= 0 ? `
              <div class="ops-pd-quick-cost-empty">\u5f53\u524d\u7b5b\u9009SKU\u548c\u5171\u4eab\u4e91\u7aef\u6210\u672c\u4ef7\u6682\u65e0\u53ef\u9884\u8bbe\u4fe1\u606f</div>
            ` : groupedEntries.map((group) => `
              <section class="ops-pd-quick-cost-group">
                <div class="ops-pd-quick-cost-group-header">
                  <strong>${escapeHtml(group.shopName || group.shopId)}</strong>
                  <span>${escapeHtml(String((group.entries || []).length))} \u9879</span>
                </div>
                <div class="ops-pd-quick-cost-group-list">
                  ${(Array.isArray(group.entries) ? group.entries : []).map((entry) => {
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
        metaTitleParts.push(`\u6700\u8fd1\u66f4\u65b0 ${formatDateTimeLabel(entry.updatedAt)}`);
      }

      if (mergedCategoryLabels.length > 0) {
        metaTitleParts.push(`\u6765\u6e90\u7c7b\u76ee ${mergedCategoryLabels.join(' / ')}`);
      }

      return `
                    <label class="ops-pd-quick-cost-item">
                      <span class="ops-pd-quick-cost-spec">
                        <span>${escapeHtml(normalizeText(entry && entry.spec) || '--')}</span>
                        <small
                          class="ops-pd-quick-cost-meta"
                          ${metaTitleParts.length > 0 ? `title="${escapeHtml(metaTitleParts.join('\n'))}"` : ''}
                        >
                          ${escapeHtml(metaTextParts.join(' \u00b7 '))}
                        </small>
                      </span>
                      <span class="ops-pd-quick-cost-input-shell">
                        <input
                          class="ops-pd-control ops-pd-quick-cost-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value="${escapeHtml(normalizeQuickCostValue(entry && entry.costPrice))}"
                          data-price-declare-quick-cost-input="${escapeHtml(normalizeText(entry && entry.key))}"
                        />
                        <span>\u5143</span>
                      </span>
                    </label>
                  `;
    }).join('')}
                </div>
              </section>
            `).join('')}
          </div>

          <div class="ops-pd-quick-cost-footer">
            ${state.quickCostDialogError ? `<div class="ops-pd-quick-cost-message is-error">${escapeHtml(state.quickCostDialogError)}</div>` : ''}
            ${state.quickCostDialogWarning ? `<div class="ops-pd-quick-cost-message is-warning">${escapeHtml(state.quickCostDialogWarning)}</div>` : ''}
            ${state.quickCostDialogNotice ? `<div class="ops-pd-quick-cost-message is-success">${escapeHtml(state.quickCostDialogNotice)}</div>` : ''}
            <div class="ops-pd-quick-cost-actions">
              <span class="ops-pd-quick-cost-message">
                \u5df2\u6c47\u603b ${escapeHtml(String(((state.quickCostDialogEntries) || []).length))} \u9879
                ${mergedEntryCount > 0 ? `\uff0c\u5df2\u805a\u5408 ${escapeHtml(String(mergedEntryCount))} \u6761\u91cd\u590d\u5386\u53f2\u8bb0\u5f55` : ''}
                ${conflictCount > 0 ? `\uff0c${escapeHtml(String(conflictCount))} \u9879\u5b58\u5728\u591a\u6761\u6210\u672c\u4ef7\u8bb0\u5f55` : ''}
              </span>
              <button
                class="ops-pd-action-button is-secondary"
                type="button"
                data-price-declare-action="close-quick-cost-preset"
                ${state.quickCostDialogSaving === true ? ' disabled' : ''}
              >
                \u5173\u95ed
              </button>
              <button
                class="ops-pd-action-button is-primary"
                type="button"
                data-price-declare-action="save-quick-cost-preset"
                ${state.quickCostDialogLoading === true ? ' disabled' : ''}
                ${state.quickCostDialogSaving === true ? ' disabled' : ''}
              >
                ${state.quickCostDialogSaving === true ? '\u4fdd\u5b58\u4e2d...' : '\u6279\u91cf\u4fdd\u5b58'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderProductThumb(row) {
    const normalizedImageUrl = normalizeText(row && row.imageUrl);
    const previewTitle = normalizeText(row && row.productName) || '\u5546\u54c1\u4e3b\u56fe';

    if (normalizedImageUrl) {
      const thumbUrl = buildSizedImageUrl(normalizedImageUrl, PRODUCT_THUMBNAIL_SIZE) || normalizedImageUrl;
      const normalizedPreview = normalizeImagePreview({
        sourceUrl: normalizedImageUrl,
        title: previewTitle
      });

      return `
        <button
          class="ops-pd-thumb-trigger"
          type="button"
          data-price-declare-image-preview-open="true"
          data-preview-image="${escapeHtml(normalizedPreview && normalizedPreview.sourceUrl)}"
          data-preview-title="${escapeHtml(normalizedPreview && normalizedPreview.title)}"
          aria-label="\u9884\u89c8\u5927\u56fe"
        >
          <div class="ops-pd-product-thumb is-image">
            <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(previewTitle)}" loading="lazy" />
          </div>
        </button>
      `;
    }

    return `
      <div class="ops-pd-product-thumb">
        <span>SKU</span>
      </div>
    `;
  }

  function renderTableRows(rows) {
    if (!Array.isArray(rows) || rows.length <= 0) {
      return `
        <tr>
          <td class="ops-pd-empty-cell" colspan="14">
            \u6682\u65e0\u5339\u914d\u7684\u4ef7\u683c\u7533\u62a5\u8bb0\u5f55
          </td>
        </tr>
      `;
    }

    return rows.map((row) => {
      return `
        <tr>
          <td class="ops-pd-nowrap">${escapeHtml(row.orderNo)}</td>
          <td class="ops-pd-product-cell">
            <div class="ops-pd-product-card">
              ${renderProductThumb(row)}
              <div class="ops-pd-product-copy">
                <div class="ops-pd-product-name">${escapeHtml(row.productName)}</div>
                <div class="ops-pd-product-meta">
                  <span>\u5e97\u94fa: ${escapeHtml(row.shopName)}</span>
                  <span>\u5546\u54c1\u6765\u6e90: ${escapeHtml(resolveOperationStatusLabel(row.operationStatus))}</span>
                  <span>SKC ID: ${escapeHtml(row.skcId)}</span>
                  <span>SKU: ${escapeHtml(row.skuId)}</span>
                </div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(row.skuAttributeSet)}</td>
          <td class="ops-pd-nowrap">${escapeHtml(row.stationLabel)}</td>
          <td class="ops-pd-nowrap">${renderRowPriceTypeBadge(row)}</td>
          <td class="ops-pd-nowrap">${escapeHtml(formatMoney(row.originalDeclaredPrice))}</td>
          <td class="ops-pd-nowrap ops-pd-price-strong">${escapeHtml(formatMoney(row.adjustedDeclaredPrice))}</td>
          <td class="ops-pd-nowrap">${escapeHtml(formatMoney(row.costPrice))}</td>
          <td class="ops-pd-nowrap">${escapeHtml(formatPercent(row.profitRate))}</td>
          <td class="ops-pd-nowrap">${escapeHtml(row.currency)}</td>
          <td class="ops-pd-nowrap">${renderTypeBadge(row.changeType)}</td>
          <td>${escapeHtml(row.reason || '--')}</td>
          <td>${escapeHtml(row.failedReason || '--')}</td>
          <td class="ops-pd-nowrap">${renderOperationStatusCell(row)}</td>
        </tr>
      `;
    }).join('');
  }

  function render(container) {
    const state = getState(container);

    const filteredRows = applyFilters(state.rows, state.appliedFilters);
    const queryDirty = compareFilters(state.filters, state.appliedFilters) !== true;
    const queryRunning = state.queryLoading === true;

    container.innerHTML = `
      <section class="ops-pd-view operations-module-workspace" data-operations-workspace="price-declaration">
        <div class="ops-pd-shell">
          <section class="ops-pd-filter-card">
            <div class="ops-pd-filter-section">
              <div class="ops-pd-filter-section-content">
                <div class="ops-pd-filter-row is-query">
                  ${renderShopSelectorField(state)}
                  ${renderStationSelectorField(state)}
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-select ops-pd-field-select-compact ops-pd-field-product-source span-2">
                    <span class="ops-pd-field-label">\u5546\u54c1\u6765\u6e90</span>
                    <span class="ops-pd-field-content">
                      <select class="ops-pd-control" data-price-declare-filter="productSource">
                        ${renderOptions(REPORT_STATUS_OPTIONS, state.filters.productSource, '', {
                          includeEmpty: false
                        })}
                      </select>
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-select ops-pd-field-select-compact span-2">
                    <span class="ops-pd-field-label">\u7533\u62a5\u4ef7\u683c\u7c7b\u578b</span>
                    <span class="ops-pd-field-content">
                      <select class="ops-pd-control" data-price-declare-filter="declarationPriceType">
                        ${renderOptions(DECLARATION_PRICE_TYPE_OPTIONS, state.filters.declarationPriceType, '\u8bf7\u9009\u62e9')}
                      </select>
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-keyword span-2">
                    <span class="ops-pd-field-label">\u5355\u53f7</span>
                    <span class="ops-pd-field-content">
                      <input
                        class="ops-pd-control"
                        type="text"
                        value="${escapeHtml(state.filters.orderNoKeywords)}"
                        placeholder="\u591a\u4e2a\u67e5\u8be2\u8bf7\u7a7a\u683c\u6216\u9017\u53f7\u4f9d\u6b21\u8f93\u5165\uff0c\u6700\u591a40"
                        data-price-declare-filter="orderNoKeywords"
                      />
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-name span-2">
                    <span class="ops-pd-field-label">\u5546\u54c1\u540d\u79f0</span>
                    <span class="ops-pd-field-content">
                      <input
                        class="ops-pd-control"
                        type="text"
                        value="${escapeHtml(state.filters.productName)}"
                        placeholder="\u8bf7\u8f93\u5165"
                        data-price-declare-filter="productName"
                      />
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-keyword span-2">
                    <span class="ops-pd-field-label">SKC ID</span>
                    <span class="ops-pd-field-content">
                      <input
                        class="ops-pd-control"
                        type="text"
                        value="${escapeHtml(state.filters.skcIdKeywords)}"
                        placeholder="\u591a\u4e2a\u67e5\u8be2\u8bf7\u7a7a\u683c\u6216\u9017\u53f7\u4f9d\u6b21\u8f93\u5165\uff0c\u6700\u591a40"
                        data-price-declare-filter="skcIdKeywords"
                      />
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-range span-2">
                    <span class="ops-pd-field-label">\u521b\u5efa\u65e5\u671f</span>
                    <span class="ops-pd-field-content ops-pd-range-shell">
                      <input
                        class="ops-pd-control"
                        type="date"
                        value="${escapeHtml(state.filters.createdDateStart)}"
                        data-price-declare-filter="createdDateStart"
                      />
                      <span class="ops-pd-range-separator">-</span>
                      <input
                        class="ops-pd-control"
                        type="date"
                        value="${escapeHtml(state.filters.createdDateEnd)}"
                        data-price-declare-filter="createdDateEnd"
                      />
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-goods-no span-2">
                    <span class="ops-pd-field-label">\u8d27\u53f7</span>
                    <span class="ops-pd-field-content ops-pd-goods-no-shell">
                      <select class="ops-pd-control ops-pd-goods-no-type" data-price-declare-filter="goodsNoType">
                        ${renderOptions(GOODS_NO_TYPE_OPTIONS, state.filters.goodsNoType, '\u8bf7\u9009\u62e9')}
                      </select>
                      <input
                        class="ops-pd-control"
                        type="text"
                        value="${escapeHtml(state.filters.goodsNoKeywords)}"
                        placeholder="\u591a\u4e2a\u8bf7\u4ee5\u9017\u53f7\u6216\u7a7a\u683c\u5206\u9694"
                        data-price-declare-filter="goodsNoKeywords"
                      />
                    </span>
                  </label>
                  <label class="ops-pd-field ops-pd-field-inline ops-pd-field-select ops-pd-field-select-mini span-2">
                    <span class="ops-pd-field-label">\u662f\u5426\u662f\u5b9a\u5236\u54c1</span>
                    <span class="ops-pd-field-content">
                      <select class="ops-pd-control" data-price-declare-filter="customizedProduct">
                        ${renderOptions(CUSTOM_PRODUCT_OPTIONS, state.filters.customizedProduct, '\u8bf7\u9009\u62e9')}
                      </select>
                    </span>
                  </label>
                  ${renderQueryDelayControls(state)}
                  <button class="ops-pd-action-button is-primary" type="button" data-price-declare-action="search" ${queryRunning ? ' disabled' : ''}>
                    ${queryRunning ? '\u67e5\u8be2\u4e2d...' : '\u67e5\u8be2'}
                  </button>
                  <button class="ops-pd-action-button is-secondary" type="button" data-price-declare-action="reset" ${queryRunning ? ' disabled' : ''}>
                    \u91cd\u7f6e
                  </button>
                  <button class="ops-pd-action-button is-danger" type="button" data-price-declare-action="stop" ${queryRunning ? '' : ' hidden'} ${state.queryCanceling === true ? ' disabled' : ''}>
                    ${state.queryCanceling === true ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u67e5\u8be2'}
                  </button>
                </div>
              </div>
            </div>
            ${renderQueryProgress(state)}
            ${state.queryError ? `<div class="ops-pd-query-message is-error">${escapeHtml(state.queryError)}</div>` : ''}
            ${state.queryWarning ? `<div class="ops-pd-query-message is-warning">${escapeHtml(state.queryWarning)}</div>` : ''}
          </section>

          <section class="ops-pd-operation-card">
            <div class="ops-pd-filter-section is-operation">
              <div class="ops-pd-filter-section-content">
                <div class="ops-pd-filter-row is-operation">
                  <div class="ops-pd-operation-actions">
                    <label class="ops-pd-field is-inline-control">
                      <span class="ops-pd-field-label">\u6210\u672c\u4ef7\u72b6\u6001</span>
                      <span class="ops-pd-field-content">
                        <select class="ops-pd-control" data-price-declare-filter="costState">
                          ${renderOptions(COST_STATE_OPTIONS, state.filters.costState, '', {
                            includeEmpty: false
                          })}
                        </select>
                      </span>
                    </label>
                    <button
                      class="ops-pd-action-button is-primary"
                      type="button"
                      data-price-declare-action="open-quick-cost-preset"
                      ${queryRunning || filteredRows.length <= 0 ? ' disabled' : ''}
                    >
                      \u5feb\u901f\u9884\u8bbe\u6210\u672c\u4ef7
                    </button>
                    ${renderReviewRulesPanel(state, filteredRows, queryRunning)}
                  </div>
                </div>
                ${renderReviewRuleMessages(state)}
              </div>
            </div>
          </section>

          <section class="ops-pd-table-card">
            <div class="ops-pd-table-summary">
              <span>\u5f53\u524d\u5171 ${escapeHtml(String(filteredRows.length))} \u6761SKU\u7533\u62a5\u8bb0\u5f55</span>
              ${queryRunning ? '<span class="ops-pd-pending-tag">\u67e5\u8be2\u4e2d\uff0c\u8bf7\u7b49\u5f85\u8fdb\u5ea6\u5b8c\u6210</span>' : (queryDirty ? '<span class="ops-pd-pending-tag">\u7b5b\u9009\u6761\u4ef6\u5df2\u53d8\u66f4\uff0c\u70b9\u51fb\u67e5\u8be2\u540e\u751f\u6548</span>' : '<span class="ops-pd-pending-tag is-muted">\u5df2\u6309\u5f53\u524d\u6761\u4ef6\u67e5\u8be2</span>')}
            </div>
            <div class="ops-pd-table-scroll">
              <table class="ops-pd-table">
                <thead>
                  <tr>
                    <th>\u5355\u53f7</th>
                    <th>\u8d27\u54c1\u4fe1\u606f</th>
                    <th>SKU\u5c5e\u6027\u96c6</th>
                    <th>\u7ad9\u70b9</th>
                    <th>\u7533\u62a5\u4ef7\u683c\u7c7b\u578b</th>
                    <th>\u539f\u7533\u62a5\u4ef7\u683c</th>
                    <th>\u8c03\u6574\u540e\u7533\u62a5\u4ef7\u683c</th>
                    <th>\u6210\u672c</th>
                    <th>\u5229\u6da6\u7387(\u6309\u8c03\u6574\u540e\u7533\u62a5\u4ef7)</th>
                    <th>\u5e01\u79cd</th>
                    <th>\u7c7b\u578b</th>
                    <th>\u539f\u56e0</th>
                    <th>\u5931\u8d25\u539f\u56e0</th>
                    <th>\u64cd\u4f5c\u72b6\u6001</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderTableRows(filteredRows)}
                </tbody>
              </table>
            </div>
          </section>
          ${renderQuickCostDialog(state)}
          ${renderImagePreviewDialog(state)}
        </div>
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
  }

  function handleInput(container, event) {
    const target = event.target;
    const state = getState(container);

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const shopTemplateName = normalizeText(target.getAttribute('data-shop-multi-select-template-name'));

    if (shopTemplateName && 'value' in target) {
      state.shopSelectionPreset.templateName = target.value;
      return;
    }

    const searchFlag = normalizeText(target.getAttribute('data-shop-multi-select-search'));

    if (searchFlag && 'value' in target) {
      state.shopSelectorKeyword = target.value;
      render(container);
      return;
    }

    const quickCostInputKey = normalizeText(target.getAttribute('data-price-declare-quick-cost-input'));

    if (quickCostInputKey && 'value' in target) {
      state.quickCostDialogEntries = (Array.isArray(state.quickCostDialogEntries) ? state.quickCostDialogEntries : [])
        .map((entry) => {
          if (normalizeText(entry && entry.key) !== quickCostInputKey) {
            return entry;
          }

          return {
            ...entry,
            costPrice: normalizeText(target.value)
          };
        });
      return;
    }

    const reviewRuleField = normalizeText(target.getAttribute('data-price-declare-review-rule'));

    if (reviewRuleField && 'value' in target) {
      state.reviewRules = updateReviewRulesValue(state.reviewRules, reviewRuleField, target.value);
      state.batchRejectError = '';
      state.batchRejectWarning = '';
      state.batchRejectNotice = '';
      scheduleSaveReviewRules(container);
      return;
    }

    const filterField = normalizeText(target.getAttribute('data-price-declare-filter'));

    if (filterField && 'value' in target) {
      state.filters = {
        ...state.filters,
        [filterField]: target.value
      };
      if (filterField === 'costState') {
        state.appliedFilters = {
          ...state.appliedFilters,
          costState: normalizeText(target.value)
        };
        render(container);
      }
      return;
    }

    const settingField = normalizeText(target.getAttribute('data-price-declare-setting'));

    if (settingField === 'perShopDelaySeconds' && 'value' in target) {
      const nextDelaySeconds = Math.max(0, Number(target.value) || 0);

      state.queryDelaySeconds = Number(nextDelaySeconds.toFixed(2));
    }
  }

  function handleChange(container, event) {
    const target = event.target;
    const state = getState(container);

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const selectedShopId = normalizeText(target.getAttribute('data-shop-multi-select-shop'));

    if (selectedShopId && target instanceof HTMLInputElement) {
      const control = getShopMultiSelectControl();

      state.filters.selectedShopIds =
        control && typeof control.toggleShopSelection === 'function'
          ? control.toggleShopSelection(state.filters.selectedShopIds, selectedShopId, target.checked)
          : normalizeSelectedShopIds(state.filters.selectedShopIds);
      state.shopSelectionTouched = true;
      scheduleSaveQuerySettings(container);
      void saveShopSelectionLast(container, state.filters.selectedShopIds);
      render(container);
      return;
    }

    const selectedStationId = normalizeText(target.getAttribute('data-price-declare-station-option'));

    if (selectedStationId && target instanceof HTMLInputElement) {
      const currentStationIds = normalizeSelectedStationIds(state.filters.stationIds);
      const nextStationIds = target.checked
        ? Array.from(new Set([...currentStationIds, selectedStationId]))
        : currentStationIds.filter((stationId) => stationId !== selectedStationId);

      state.filters = {
        ...state.filters,
        stationIds: nextStationIds
      };
      render(container);
      return;
    }

    const filterField = normalizeText(target.getAttribute('data-price-declare-filter'));

    if (filterField && 'value' in target) {
      state.filters = {
        ...state.filters,
        [filterField]: target.value
      };
      if (filterField === 'costState') {
        state.appliedFilters = {
          ...state.appliedFilters,
          costState: normalizeText(target.value)
        };
        render(container);
      }
      return;
    }

    const reviewRuleField = normalizeText(target.getAttribute('data-price-declare-review-rule'));

    if (reviewRuleField && 'value' in target) {
      state.reviewRules = updateReviewRulesValue(state.reviewRules, reviewRuleField, target.value);
      state.batchRejectError = '';
      state.batchRejectWarning = '';
      state.batchRejectNotice = '';
      scheduleSaveReviewRules(container);
      return;
    }

    const settingField = normalizeText(target.getAttribute('data-price-declare-setting'));

    if (settingField === 'perShopDelaySeconds' && 'value' in target) {
      const nextDelaySeconds = Math.max(0, Number(target.value) || 0);

      state.queryDelaySeconds = Number(nextDelaySeconds.toFixed(2));
      void saveQuerySettings(container);
    }
  }

  function handleClick(container, event) {
    const target = event.target instanceof Element ? event.target : null;
    const state = getState(container);
    const control = getShopMultiSelectControl();
    const shopSelectorRoot = target ? target.closest('[data-shop-multi-select]') : null;
    const stationSelectorRoot = target ? target.closest('[data-price-declare-station-select]') : null;
    let closedByOutsideClick = false;

    if (!target) {
      return;
    }

    if (state.shopSelectorOpen === true && !shopSelectorRoot) {
      state.shopSelectorOpen = false;
      state.shopSelectorKeyword = '';
      closedByOutsideClick = true;
    }

    if (state.stationSelectorOpen === true && !stationSelectorRoot) {
      state.stationSelectorOpen = false;
      closedByOutsideClick = true;
    }

    const imagePreviewOpenTrigger = target.closest('[data-price-declare-image-preview-open]');

    if (imagePreviewOpenTrigger instanceof HTMLButtonElement) {
      state.imagePreview = normalizeImagePreview({
        sourceUrl: imagePreviewOpenTrigger.getAttribute('data-preview-image'),
        title: imagePreviewOpenTrigger.getAttribute('data-preview-title')
      });
      render(container);
      return;
    }

    const imagePreviewCloseTrigger = target.closest('[data-price-declare-image-preview-close]');

    if (imagePreviewCloseTrigger instanceof HTMLButtonElement) {
      state.imagePreview = null;
      render(container);
      return;
    }

    const imagePreviewBackdrop = target.closest('[data-price-declare-image-preview-backdrop]');
    const imagePreviewPanel = target.closest('[data-price-declare-image-preview-panel]');
    const quickCostBackdrop = target.closest('[data-price-declare-quick-cost-backdrop]');
    const quickCostPanel = target.closest('[data-price-declare-quick-cost-panel]');

    if (state.imagePreview && imagePreviewBackdrop && !imagePreviewPanel) {
      state.imagePreview = null;
      render(container);
      return;
    }

    if (state.quickCostDialogOpen === true && quickCostBackdrop && !quickCostPanel) {
      closeQuickCostPresetDialog(container);
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
      const helper = getShopSelectionTemplateHelper();
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
        const helper = getShopSelectionTemplateHelper();
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
        state.filters.selectedShopIds = control.setAllVisibleSelection(
          state.shopCatalog,
          state.filters.selectedShopIds,
          state.shopSelectorKeyword,
          true
        );
      } else if (actionId === 'clear') {
        state.filters.selectedShopIds = [];
      }

      state.shopSelectionTouched = true;
      scheduleSaveQuerySettings(container);
      void saveShopSelectionLast(container, state.filters.selectedShopIds);
      render(container);
      return;
    }

    const shopSelectorSectionAction = target.closest('[data-shop-multi-select-section]');

    if (shopSelectorSectionAction instanceof HTMLButtonElement) {
      const sectionId = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section'));
      const sectionMode = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section-mode'));

      if (sectionId && control && typeof control.setGroupSelection === 'function') {
        state.filters.selectedShopIds = control.setGroupSelection(
          state.shopCatalog,
          state.filters.selectedShopIds,
          sectionId,
          state.shopSelectorKeyword,
          sectionMode !== 'clear'
        );
        state.shopSelectionTouched = true;
        scheduleSaveQuerySettings(container);
        void saveShopSelectionLast(container, state.filters.selectedShopIds);
      }

      render(container);
      return;
    }

    const stationSelectorToggle = target.closest('[data-price-declare-station-toggle]');

    if (stationSelectorToggle instanceof HTMLButtonElement) {
      state.stationSelectorOpen = !state.stationSelectorOpen;
      render(container);
      return;
    }

    const stationSelectorAction = target.closest('[data-price-declare-station-action]');

    if (stationSelectorAction instanceof HTMLButtonElement) {
      const actionId = normalizeText(stationSelectorAction.getAttribute('data-price-declare-station-action'));

      if (actionId === 'select-us') {
        state.filters = {
          ...state.filters,
          stationIds: ['100']
        };
      } else if (actionId === 'clear') {
        state.filters = {
          ...state.filters,
          stationIds: []
        };
      }

      render(container);
      return;
    }

    const actionButton = target.closest('[data-price-declare-action]');

    if (actionButton instanceof HTMLButtonElement) {
      const actionId = normalizeText(actionButton.getAttribute('data-price-declare-action'));

      if (actionId === 'search') {
        void startQuery(container);
        return;
      }

      if (actionId === 'stop') {
        void stopQuery(container);
        return;
      }

      if (actionId === 'open-quick-cost-preset') {
        void openQuickCostPresetDialog(container);
        return;
      }

      if (actionId === 'close-quick-cost-preset') {
        closeQuickCostPresetDialog(container);
        return;
      }

      if (actionId === 'save-quick-cost-preset') {
        void saveQuickCostPresetDialog(container);
        return;
      }

      if (actionId === 'batch-reject') {
        void batchRejectVisibleRows(container);
        return;
      }

      if (actionId === 'reset') {
        state.filters = cloneFilters(DEFAULT_FILTERS);
        state.appliedFilters = cloneFiltersForQuery(DEFAULT_FILTERS);
        state.shopSelectorOpen = false;
        state.shopSelectorKeyword = '';
        state.shopSelectorFocusSearch = false;
        state.stationSelectorOpen = false;
        state.queryError = '';
        state.queryWarning = '';
        state.queryProgress = null;
        state.queryResultMeta = null;
        state.rows = [];
        state.batchRejectRunning = false;
        state.batchRejectError = '';
        state.batchRejectWarning = '';
        state.batchRejectNotice = '';
        state.shopSelectionTouched = true;
        scheduleSaveQuerySettings(container);
        render(container);
        return;
      }
    }

    if (closedByOutsideClick) {
      render(container);
    }
  }

  function createController(container) {
    const keepAliveHelper = window.moduleKeepAlive || window.operationsModuleKeepAlive;

    if (keepAliveHelper && typeof keepAliveHelper.createKeepAliveController === 'function') {
      return keepAliveHelper.createKeepAliveController({
        panel: container,
        onActivate(options = {}) {
          const state = getState(container);

          bindQueryProgressListener(container);

          if (options && options.resume === true) {
            render(container);
            return;
          }

          void loadShopSelectionPresetSnapshot(container);
          void loadQuerySettings(container);
          void loadReviewRules(container);

          if (state.shopSelectorLoaded !== true && state.shopSelectorLoading !== true) {
            void loadShopCatalog(container);
          } else {
            render(container);
          }
        },
        onDeactivate() {
          const state = getState(container);

          if (state.shopSelectorOpen === true) {
            state.shopSelectorOpen = false;
            state.shopSelectorKeyword = '';
            state.shopSelectorFocusSearch = false;
            render(container);
          }

          if (state.stationSelectorOpen === true) {
            state.stationSelectorOpen = false;
            render(container);
          }

          if (state.imagePreview) {
            state.imagePreview = null;
            render(container);
          }

          if (state.quickCostDialogOpen === true) {
            closeQuickCostPresetDialog(container);
          }
        }
      });
    }

    return {
      panel: container,
      activate() {},
      deactivate() {}
    };
  }

  function mount(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    if (container.dataset.operationsPriceDeclarationMounted !== 'true') {
      container.dataset.operationsPriceDeclarationMounted = 'true';
      container.addEventListener('input', (event) => {
        handleInput(container, event);
      });
      container.addEventListener('change', (event) => {
        handleChange(container, event);
      });
      container.addEventListener('click', (event) => {
        handleClick(container, event);
      }, true);
    }

    if (!container.__operationsPriceDeclarationController) {
      container.__operationsPriceDeclarationController = createController(container);
    }

    render(container);
    bindQueryProgressListener(container);
    void loadShopSelectionPresetSnapshot(container);
    void loadQuerySettings(container);
    void loadReviewRules(container);
    void loadShopCatalog(container);

    return container.__operationsPriceDeclarationController;
  }

  window.operationsPriceDeclarationView = {
    mount
  };
})();
