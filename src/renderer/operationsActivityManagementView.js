(function initOperationsActivityManagementView() {
  const profitMetrics = window.operationsProfitMetrics && typeof window.operationsProfitMetrics === 'object'
    ? window.operationsProfitMetrics
    : null;
  const TAB_CONFIG = Object.freeze([
    {
      id: 'signup',
      label: '\u6d3b\u52a8\u62a5\u540d'
    },
    {
      id: 'management',
      label: '\u6d3b\u52a8\u7ba1\u7406'
    }
  ]);
  const ACTIVITY_SORT_FIELDS = new Set([
    'activityThematicName',
    'activityName',
    'activityThemeTypeLabel',
    'discountThreshold',
    'stockThreshold',
    'durationDays',
    'enrollWindow',
    'activityWindow',
    'remaining',
    'priority'
  ]);
  const ACTIVITY_BATCH_PRODUCT_SORT_FIELDS = new Set([
    'productId',
    'productName',
    'shopName',
    'activityName',
    'suggestActivityStock',
    'salesStock',
    'canEnrollSessionCount',
    'suggestActivityPrice',
    'dailyPrice'
  ]);
  const ACTIVITY_BATCH_COST_FILTER_OPTIONS = Object.freeze([
    { value: '', label: '\u5168\u90e8\u6210\u672c' },
    { value: 'set', label: '\u5df2\u8bbe\u7f6e' },
    { value: 'unset', label: '\u672a\u8bbe\u7f6e' }
  ]);
  const ACTIVITY_BATCH_SIGNUP_STATUS_FILTER_OPTIONS = Object.freeze([
    { value: '', label: '\u5168\u90e8\u72b6\u6001' },
    { value: 'eligible', label: '\u53ef\u62a5\u540d' },
    { value: 'skip', label: '\u4e0d\u53c2\u52a0' }
  ]);
  const SHOP_SELECTION_SCOPE_KEY = 'operations-activity-management';
  const PRODUCT_TABLE_DEFAULT_PAGE_SIZE = 80;
  const PRODUCT_TABLE_MAX_PAGE_SIZE = 200;
  const ACTIVITY_POINTER_ACTION_SUPPRESS_MS = 480;
  const ACTIVITY_BACKGROUND_LOG_LIMIT = 300;
  const ACTIVITY_BACKGROUND_LOG_TOP_STICK_THRESHOLD = 24;
  const ACTIVITY_BACKGROUND_QUERY_PAGE_SIZE = 200;
  const ACTIVITY_BACKGROUND_SUBMIT_BATCH_SIZE = 100;
  const ACTIVITY_PRODUCT_FILTER_MODE_OPTIONS = Object.freeze([
    { value: 'suggestActivityPrice', label: '\u4ee5\u5efa\u8bae\u6d3b\u52a8\u4ef7' },
    { value: 'dailyDiscount', label: '\u4ee5\u65e5\u5e38\u4ef7\u6298\u6263' },
    { value: 'dailyReduce', label: '\u4ee5\u65e5\u5e38\u4ef7\u51cf\u5c11' },
    { value: 'costMarkup', label: '\u4ee5\u6210\u672c\u4ef7\u52a0\u4ef7' },
    { value: 'profitRateDiscount', label: '\u4ee5\u6210\u672c\u5229\u6da6\u7387' },
    { value: 'saleProfitRate', label: '\u4ee5\u552e\u4ef7\u5229\u6da6\u7387' }
  ]);
  const ACTIVITY_PRODUCT_PROFIT_FLOOR_RELATION_OPTIONS = Object.freeze([
    { value: 'and', label: '\u4e14' },
    { value: 'or', label: '\u6216' }
  ]);
  const ACTIVITY_PRODUCT_SUBMIT_FLOOR_BASIS_OPTIONS = Object.freeze([
    { value: 'profitFloorRate', label: '\u4fdd\u5e95\u5229\u6da6\u7387' },
    { value: 'profitFloorValue', label: '\u4fdd\u5e95\u5229\u6da6\u503c' }
  ]);

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function getOperationsSharedCatalog() {
    return window.operationsSharedCatalog && typeof window.operationsSharedCatalog === 'object'
      ? window.operationsSharedCatalog
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

  function markRecentPointerHandled(container, actionName) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    container.__opsActivityRecentPointerAction = {
      actionName: normalizeText(actionName),
      expiresAt: Date.now() + ACTIVITY_POINTER_ACTION_SUPPRESS_MS
    };
  }

  function consumeRecentPointerHandled(container, actionName) {
    if (!(container instanceof HTMLElement)) {
      return false;
    }

    const record = container.__opsActivityRecentPointerAction;
    const normalizedActionName = normalizeText(actionName);

    if (
      !record
      || normalizeText(record.actionName) !== normalizedActionName
      || !Number.isFinite(Number(record.expiresAt))
      || Number(record.expiresAt) < Date.now()
    ) {
      container.__opsActivityRecentPointerAction = null;
      return false;
    }

    container.__opsActivityRecentPointerAction = null;
    return true;
  }

  function normalizeNonNegativeInteger(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
  }

  function normalizeOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
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

  function normalizeProductTablePageSize(value) {
    const parsedValue = normalizeNonNegativeInteger(value, PRODUCT_TABLE_DEFAULT_PAGE_SIZE);

    if (parsedValue <= 0) {
      return PRODUCT_TABLE_DEFAULT_PAGE_SIZE;
    }

    return Math.min(PRODUCT_TABLE_MAX_PAGE_SIZE, parsedValue);
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

  function buildActivityDetailSpecParts(detail) {
    const parts = [];
    const seen = new Set();

    [
      normalizeText(detail && detail.skcPropertiesText),
      normalizeText(detail && detail.skuPropertiesText)
    ].forEach((textValue) => {
      normalizeTextArray(textValue ? textValue.split('|') : []).forEach((part) => {
        const normalizedPart = normalizeText(part);
        const partKey = normalizedPart.toLowerCase();

        if (!partKey || seen.has(partKey)) {
          return;
        }

        seen.add(partKey);
        parts.push(normalizedPart);
      });
    });

    return parts;
  }

  function buildActivityDetailSpecText(detail) {
    return buildActivityDetailSpecParts(detail).join(' | ');
  }

  function buildActivityDetailSpecAliases(_detail) {
    return [];
  }

  function normalizeActivitySelectedKeys(keys) {
    return normalizeTextArray(keys);
  }

  function normalizeActivityThemeTypeFilterValues(values) {
    return normalizeTextArray(values);
  }

  function resolveActivityThemeTypeLabel(row) {
    return normalizeText(row && row.activityThemeTypeLabel);
  }

  function resolveActivityCategoryFilterLabel(row) {
    return normalizeText(row && row.activityName);
  }

  function buildActivityThemeTypeFilterOptions(rows) {
    const optionMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const label = resolveActivityCategoryFilterLabel(row);

      if (!label || optionMap.has(label)) {
        return;
      }

      optionMap.set(label, {
        value: label,
        label
      });
    });

    return Array.from(optionMap.values());
  }

  function normalizeActivityThemeTypeFilterOptions(options) {
    const optionMap = new Map();

    (Array.isArray(options) ? options : []).forEach((option) => {
      const optionValue = normalizeText(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;

      if (!optionValue || optionMap.has(optionValue)) {
        return;
      }

      optionMap.set(optionValue, {
        value: optionValue,
        label: optionLabel
      });
    });

    return Array.from(optionMap.values());
  }

  function filterActivityThemeTypeValuesByRows(values, rows) {
    return filterActivityThemeTypeValuesByOptions(values, buildActivityThemeTypeFilterOptions(rows));
  }

  function filterActivityThemeTypeValuesByOptions(values, options) {
    const availableValueSet = new Set(
      normalizeActivityThemeTypeFilterOptions(options).map((option) => normalizeText(option && option.value))
    );

    if (availableValueSet.size <= 0) {
      return [];
    }

    return normalizeActivityThemeTypeFilterValues(values).filter((value) => availableValueSet.has(value));
  }

  function buildActivityMatchDisplayName(activity) {
    const source = activity && typeof activity === 'object' ? activity : {};
    return normalizeText(source.activityThematicName)
      || normalizeText(source.activityName)
      || normalizeText(source.activityKey);
  }

  function getDiscountThresholdValue(value) {
    const parsedValue = normalizeOptionalNumber(value);

    if (parsedValue === null) {
      return null;
    }

    return parsedValue > 10 ? (parsedValue / 10) : parsedValue;
  }

  function getRemainingDaysUntil(targetTime) {
    const timestamp = parseTimestamp(targetTime);

    if (!Number.isFinite(timestamp)) {
      return null;
    }

    const diffMs = timestamp - Date.now();

    if (diffMs <= 0) {
      return null;
    }

    const totalDays = diffMs / (24 * 60 * 60 * 1000);
    return totalDays < 1 ? 1 : Math.ceil(totalDays);
  }

  function hasActivityEnrollStartTime(row) {
    return Number.isFinite(parseTimestamp(row && row.enrollStartAt));
  }

  function hasActivityEnrollDeadline(row) {
    return Number.isFinite(parseTimestamp(row && row.enrollDeadLine));
  }

  function isActivityEnrollPermanent(row) {
    return !hasActivityEnrollDeadline(row);
  }

  function normalizeFilterDiscountInputValue(value) {
    const parsedValue = normalizeOptionalNumber(value);

    if (parsedValue === null || parsedValue < 0) {
      return '';
    }

    const normalizedValue = parsedValue > 10 ? (parsedValue / 10) : parsedValue;
    const roundedValue = Number(normalizedValue.toFixed(2));
    return Number.isInteger(roundedValue)
      ? String(roundedValue)
      : roundedValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function normalizeFilterRemainingDaysInputValue(value) {
    const parsedValue = normalizeOptionalNumber(value);

    if (parsedValue === null || parsedValue < 0) {
      return '';
    }

    return String(Math.trunc(parsedValue));
  }

  function normalizeFilterRemainingDaysRange(minValue, maxValue) {
    const normalizedMinValue = normalizeFilterRemainingDaysInputValue(minValue);
    const normalizedMaxValue = normalizeFilterRemainingDaysInputValue(maxValue);
    const minNumericValue = normalizeOptionalNumber(normalizedMinValue);
    const maxNumericValue = normalizeOptionalNumber(normalizedMaxValue);

    if (
      minNumericValue !== null
      && maxNumericValue !== null
      && minNumericValue > maxNumericValue
    ) {
      return {
        minValue: normalizedMaxValue,
        maxValue: normalizedMinValue
      };
    }

    return {
      minValue: normalizedMinValue,
      maxValue: normalizedMaxValue
    };
  }

  function buildSelectableActivityKeys(rows) {
    return Array.from(new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => normalizeText(row && row.activityKey))
        .filter(Boolean)
    ));
  }

  function normalizeLabelList(input) {
    const source = Array.isArray(input) ? input : [];
    const seen = new Set();
    const result = [];

    source.forEach((entry) => {
      const normalizedEntry = entry && typeof entry === 'object'
        ? {
          key: normalizeText(entry.key),
          value: normalizeText(entry.value)
        }
        : {
          key: '',
          value: normalizeText(entry)
        };

      if (!normalizedEntry.key && !normalizedEntry.value) {
        return;
      }

      const dedupKey = `${normalizedEntry.key}\x1f${normalizedEntry.value}`;

      if (seen.has(dedupKey)) {
        return;
      }

      seen.add(dedupKey);
      result.push(normalizedEntry);
    });

    return result;
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

  function renderOptions(options, selectedValue, emptyLabel, config = {}) {
    const normalizedSelectedValue = normalizeText(selectedValue);
    const includeEmpty = config.includeEmpty !== false;
    const source = Array.isArray(options) ? options : [];
    const renderedOptions = [];

    if (includeEmpty) {
      renderedOptions.push(`<option value="">${escapeHtml(normalizeText(emptyLabel) || '\u8bf7\u9009\u62e9')}</option>`);
    }

    source.forEach((option) => {
      const value = normalizeText(option && option.value);
      const label = normalizeText(option && option.label) || value;

      renderedOptions.push(`
        <option value="${escapeHtml(value)}"${value === normalizedSelectedValue ? ' selected' : ''}>
          ${escapeHtml(label)}
        </option>
      `);
    });

    return renderedOptions.join('');
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

  function buildQuickCostLookupKeys(shopId, station, spec, aliasSpecs = []) {
    const specVariants = normalizeTextArray([spec].concat(aliasSpecs));

    return Array.from(new Set(
      specVariants.flatMap((specVariant) => ([
        buildQuickCostEntryKey(shopId, station, specVariant),
        buildQuickCostLegacyKey(shopId, specVariant)
      ])).filter(Boolean)
    ));
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

  function buildActivityBackgroundQuickCostPresetHintEntries(entries, targetShopIdSet) {
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

  function buildActivityBackgroundQuickCostSourceEntries(state, snapshotEntries, presetHintEntries, options = {}) {
    const targetShopIds = normalizeSelectedShopIds(options && options.targetShopIds).length > 0
      ? normalizeSelectedShopIds(options && options.targetShopIds)
      : buildActivityBackgroundQuickCostTargetShopIds(state);
    const targetShopIdSet = new Set(targetShopIds);
    const hintEntries = buildActivityBackgroundQuickCostPresetHintEntries(
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
      const sharedSpec = normalizeText(entry && entry.spec) || normalizeText(buildActivityDetailSpecText(entry));
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
              legacySpec: '',
              specAliases: []
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
        legacySpec: '',
        specAliases: [],
        costPrice: ''
      });
      sourceEntryKeys.add(sourceKey);
    });

    return sourceEntries;
  }

  function formatThreshold(value, suffix) {
    const parsedValue = normalizeOptionalNumber(value);
    return parsedValue === null ? '\u2014' : `${Math.trunc(parsedValue)}${suffix}`;
  }

  function formatDiscountThreshold(value) {
    const discountValue = getDiscountThresholdValue(value);

    if (discountValue === null) {
      return '\u2014';
    }

    const normalizedDiscountValue = Number.isInteger(discountValue)
      ? String(discountValue)
      : discountValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

    return `${normalizedDiscountValue}\u6298`;
  }

  function formatDurationDays(value) {
    const parsedValue = normalizeOptionalNumber(value);
    return parsedValue === null ? '\u2014' : `${Math.trunc(parsedValue)}\u5929`;
  }

  function formatRemainingDuration(targetTime, options = {}) {
    const timestamp = parseTimestamp(targetTime);

    if (!Number.isFinite(timestamp)) {
      return '\u2014';
    }

    const now = Date.now();
    const diffMs = timestamp - now;
    const activeLabel = normalizeText(options.activeLabel) || '\u5269\u4f59';
    const futureLabel = normalizeText(options.futureLabel) || '\u8ddd\u5f00\u59cb';
    const endedLabel = normalizeText(options.endedLabel) || '\u5df2\u7ed3\u675f';
    const startedAt = parseTimestamp(options.startedAt);

    if (diffMs <= 0) {
      return endedLabel;
    }

    const totalDays = diffMs / (24 * 60 * 60 * 1000);
    const dayText = totalDays < 1 ? '\u0031\u5929\u5185' : `${Math.ceil(totalDays)}\u5929`;

    if (Number.isFinite(startedAt) && now < startedAt) {
      const beforeStartMs = startedAt - now;
      const beforeStartDays = beforeStartMs / (24 * 60 * 60 * 1000);
      const beforeStartText = beforeStartDays < 1 ? '\u0031\u5929\u5185' : `${Math.ceil(beforeStartDays)}\u5929`;
      return `${futureLabel} ${beforeStartText}`;
    }

    return `${activeLabel} ${dayText}`;
  }

  function formatActivityPermanentRemainingDuration(row) {
    const enrollStartAt = parseTimestamp(row && row.enrollStartAt);

    if (Number.isFinite(enrollStartAt) && Date.now() < enrollStartAt) {
      const beforeStartMs = enrollStartAt - Date.now();
      const beforeStartDays = beforeStartMs / (24 * 60 * 60 * 1000);
      const beforeStartText = beforeStartDays < 1 ? '\u0031\u5929\u5185' : `${Math.ceil(beforeStartDays)}\u5929`;
      return `\u8ddd\u5f00\u59cb ${beforeStartText}\uff08\u5f00\u540e\u6c38\u4e45\uff09`;
    }

    return '\u6c38\u4e45';
  }

  function buildActivityEnrollWindowLines(row) {
    if (isActivityEnrollPermanent(row)) {
      return hasActivityEnrollStartTime(row)
        ? [
          `\u5f00\u59cb ${formatDateTime(row && row.enrollStartAt)}`,
          '\u622a\u6b62 \u6c38\u4e45'
        ]
        : [
          '\u957f\u671f\u62a5\u540d',
          '\u622a\u6b62 \u6c38\u4e45'
        ];
    }

    return [
      `\u5f00\u59cb ${formatDateTime(row && row.enrollStartAt)}`,
      `\u622a\u6b62 ${formatDateTime(row && row.enrollDeadLine)}`
    ];
  }

  function formatActivityEnrollRemainingText(row) {
    return isActivityEnrollPermanent(row)
      ? formatActivityPermanentRemainingDuration(row)
      : formatRemainingDuration(row && row.enrollDeadLine, {
        activeLabel: '\u5269\u4f59',
        futureLabel: '\u8ddd\u5f00\u59cb',
        endedLabel: '\u5df2\u622a\u6b62',
        startedAt: row && row.enrollStartAt
      });
  }

  function formatActivityEnrollWindowSummaryText(row) {
    if (isActivityEnrollPermanent(row)) {
      return hasActivityEnrollStartTime(row)
        ? `${formatDateTime(row && row.enrollStartAt)} ~ \u6c38\u4e45`
        : '\u957f\u671f\u62a5\u540d\uff08\u65e0\u622a\u6b62\uff09';
    }

    return `${formatDateTime(row && row.enrollStartAt)} ~ ${formatDateTime(row && row.enrollDeadLine)}`;
  }

  function buildListPreviewText(values, maxCount = 4) {
    const normalizedValues = normalizeTextArray(values);

    if (normalizedValues.length <= 0) {
      return '\u2014';
    }

    if (normalizedValues.length <= maxCount) {
      return normalizedValues.join('\u3001');
    }

    return `${normalizedValues.slice(0, maxCount).join('\u3001')} +${normalizedValues.length - maxCount}`;
  }

  function buildListFullText(values) {
    const normalizedValues = normalizeTextArray(values);
    return normalizedValues.length > 0 ? normalizedValues.join('\u3001') : '';
  }

  function renderChipList(values, options = {}) {
    const normalizedValues = normalizeTextArray(values);
    const maxCount = Number.isFinite(Number(options.maxCount))
      ? Math.max(0, Number(options.maxCount))
      : normalizedValues.length;
    const items = maxCount > 0 ? normalizedValues.slice(0, maxCount) : normalizedValues.slice();
    const overflowCount = normalizedValues.length - items.length;

    if (items.length <= 0) {
      return `<span class="ops-activity-chip ops-activity-chip-empty">\u2014</span>`;
    }

    return `${items.map((item) => `<span class="ops-activity-chip">${escapeHtml(item)}</span>`).join('')}${overflowCount > 0 ? `<span class="ops-activity-chip ops-activity-chip-more">+${overflowCount}</span>` : ''}`;
  }

  function getShopMultiSelectControl() {
    return window.shopMultiSelectControl && typeof window.shopMultiSelectControl === 'object'
      ? window.shopMultiSelectControl
      : null;
  }

  function getFeatureCenterApi() {
    return window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter === 'object'
      ? window.temuApp.featureCenter
      : null;
  }

  function getShopSelectionTemplateHelper() {
    return window.operationsShopSelectionTemplates
      && typeof window.operationsShopSelectionTemplates === 'object'
      ? window.operationsShopSelectionTemplates
      : null;
  }

  function getDialogBridge() {
    return window.temuApp
      && window.temuApp.dialogs
      && typeof window.temuApp.dialogs === 'object'
      ? window.temuApp.dialogs
      : null;
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

  function buildEmptyActivityQuerySummary() {
    return {
      totalShopCount: 0,
      successShopCount: 0,
      failedShopCount: 0,
      rawActivityCount: 0,
      uniqueActivityCount: 0
    };
  }

  function buildEmptyActivityFilterSettings() {
    return {
      minDiscountRate: '',
      minEnrollRemainingDays: '',
      maxEnrollRemainingDays: '',
      minActivityRemainingDays: '',
      maxActivityRemainingDays: '',
      activityThemeTypes: []
    };
  }

  function normalizeActivityProductFilterMode(value) {
    const normalizedValue = normalizeText(value);
    return ACTIVITY_PRODUCT_FILTER_MODE_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : 'suggestActivityPrice';
  }

  function normalizeActivityProductProfitFloorRelation(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return ACTIVITY_PRODUCT_PROFIT_FLOOR_RELATION_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : 'and';
  }

  function normalizeActivityProductSubmitFloorBasis(value) {
    const normalizedValue = normalizeText(value);
    return ACTIVITY_PRODUCT_SUBMIT_FLOOR_BASIS_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : 'profitFloorRate';
  }

  function formatActivityProductSubmitFloorBasisLabel(value) {
    const normalizedValue = normalizeActivityProductSubmitFloorBasis(value);
    const matchedOption = ACTIVITY_PRODUCT_SUBMIT_FLOOR_BASIS_OPTIONS.find((option) => (
      normalizeText(option && option.value) === normalizedValue
    ));

    return normalizeText(matchedOption && matchedOption.label) || '\u4fdd\u5e95\u5229\u6da6\u7387';
  }

  function normalizeActivityBatchCostFilter(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return ACTIVITY_BATCH_COST_FILTER_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : '';
  }

  function normalizeActivityBatchSignupStatusFilter(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return ACTIVITY_BATCH_SIGNUP_STATUS_FILTER_OPTIONS.some((option) => normalizeText(option && option.value) === normalizedValue)
      ? normalizedValue
      : '';
  }

  function buildEmptyActivityProductFilterSettings() {
    return {
      mode: 'suggestActivityPrice',
      modeValueDailyDiscount: '',
      modeValueSaleProfitRate: '',
      modeValueProfitRateDiscount: '',
      modeValueDailyReduce: '',
      modeValueCostMarkup: '',
      profitFloorRate: '',
      profitFloorRelation: 'and',
      profitFloorValue: '',
      submitAtProfitFloor: false,
      submitAtProfitFloorBasis: 'profitFloorRate'
    };
  }

  function resolveActivityProductFilterModeValue(settings, mode) {
    const normalizedSettings = settings && typeof settings === 'object'
      ? settings
      : buildEmptyActivityProductFilterSettings();
    const normalizedMode = normalizeActivityProductFilterMode(mode || normalizedSettings.mode);

    if (normalizedMode === 'dailyDiscount') {
      return normalizeDecimalInputValue(normalizedSettings.modeValueDailyDiscount);
    }

    if (normalizedMode === 'saleProfitRate') {
      return normalizeDecimalInputValue(normalizedSettings.modeValueSaleProfitRate);
    }

    if (normalizedMode === 'profitRateDiscount') {
      return normalizeDecimalInputValue(normalizedSettings.modeValueProfitRateDiscount);
    }

    if (normalizedMode === 'dailyReduce') {
      return normalizeDecimalInputValue(normalizedSettings.modeValueDailyReduce);
    }

    if (normalizedMode === 'costMarkup') {
      return normalizeDecimalInputValue(normalizedSettings.modeValueCostMarkup);
    }

    return '';
  }

  function buildEmptyActivityProductFilterSummary() {
    return {
      totalProductCount: 0,
      eligibleProductCount: 0,
      skippedProductCount: 0,
      totalSkuCount: 0,
      eligibleSkuCount: 0,
      skippedSkuCount: 0
    };
  }

  function buildEmptyActivityProductFilterProgress() {
    return {
      processedProductCount: 0,
      totalProductCount: 0,
      processedSkuCount: 0,
      totalSkuCount: 0,
      updatedAt: ''
    };
  }

  function normalizeActivityProductFilterSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const mode = normalizeActivityProductFilterMode(source.mode);
    let modeValueDailyDiscount = normalizeDecimalInputValue(source.modeValueDailyDiscount);
    let modeValueSaleProfitRate = normalizeDecimalInputValue(source.modeValueSaleProfitRate);
    let modeValueProfitRateDiscount = normalizeDecimalInputValue(source.modeValueProfitRateDiscount);
    let modeValueDailyReduce = normalizeDecimalInputValue(source.modeValueDailyReduce);
    let modeValueCostMarkup = normalizeDecimalInputValue(source.modeValueCostMarkup);
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
      mode,
      modeValueDailyDiscount,
      modeValueSaleProfitRate,
      modeValueProfitRateDiscount,
      modeValueDailyReduce,
      modeValueCostMarkup,
      profitFloorRate: normalizeDecimalInputValue(source.profitFloorRate),
      profitFloorRelation: normalizeActivityProductProfitFloorRelation(source.profitFloorRelation),
      profitFloorValue: normalizeDecimalInputValue(source.profitFloorValue),
      submitAtProfitFloor: normalizeBooleanSetting(source.submitAtProfitFloor, false),
      submitAtProfitFloorBasis: normalizeActivityProductSubmitFloorBasis(source.submitAtProfitFloorBasis)
    };

    normalizedSettings.modeValue = resolveActivityProductFilterModeValue(normalizedSettings, mode);
    return normalizedSettings;
  }

  function areActivityProductFilterSettingsEqual(left, right) {
    const normalizedLeft = normalizeActivityProductFilterSettings(left);
    const normalizedRight = normalizeActivityProductFilterSettings(right);

    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
  }

  function syncSharedActivityProductFilterSettingsState(state, settings, options = {}) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const backgroundState = state && state.activityBackgroundSubmitState
      ? state.activityBackgroundSubmitState
      : buildEmptyActivityBackgroundSubmitState();

    state.activityProductBatchState = productState;
    state.activityBackgroundSubmitState = backgroundState;
    productState.activityProductFilterSettings = normalizeActivityProductFilterSettings(normalizedSettings);
    backgroundState.filterSettings = normalizeActivityProductFilterSettings(normalizedSettings);

    if (options.markLoaded !== false) {
      productState.activityProductFilterSettingsLoaded = true;
      backgroundState.filterSettingsLoaded = true;
    }

    if (options.markApplied === true) {
      productState.activityProductFilterAppliedSettings = normalizeActivityProductFilterSettings(normalizedSettings);
      productState.activityProductFilterSettingsDirty = false;
      return normalizedSettings;
    }

    if (productState.activityProductFilterApplied === true) {
      productState.activityProductFilterSettingsDirty = !areActivityProductFilterSettingsEqual(
        productState.activityProductFilterAppliedSettings,
        normalizedSettings
      );
    } else {
      productState.activityProductFilterSettingsDirty = false;
    }

    return normalizedSettings;
  }

  function normalizeActivityYuanToCent(value) {
    const numericValue = normalizeOptionalNumber(value);

    if (numericValue === null || numericValue <= 0) {
      return null;
    }

    return Math.max(1, Math.round(numericValue * 100));
  }

  function formatActivityProductProfitFloorRule(settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const profitFloorRate = normalizeOptionalNumber(normalizedSettings.profitFloorRate);
    const profitFloorValueAmount = normalizeActivityYuanToCent(normalizedSettings.profitFloorValue);
    const hasProfitFloorRate = profitFloorRate !== null && profitFloorRate > 0;
    const hasProfitFloorValue = profitFloorValueAmount !== null && profitFloorValueAmount > 0;

    if (!hasProfitFloorRate && !hasProfitFloorValue) {
      return '\u4e0d\u9650';
    }

    const parts = [];

    if (hasProfitFloorRate) {
      parts.push(`\u5229\u6da6\u7387 >= ${formatPercent(profitFloorRate)}`);
    }

    if (hasProfitFloorValue) {
      parts.push(`\u5229\u6da6\u503c >= ${formatCentAmount(profitFloorValueAmount)}\u5143`);
    }

    let ruleText = parts.join(
      hasProfitFloorRate && hasProfitFloorValue
        ? (normalizeActivityProductProfitFloorRelation(normalizedSettings.profitFloorRelation) === 'or' ? ' \u6216 ' : ' \u4e14 ')
        : ''
    );

    if (normalizedSettings.submitAtProfitFloor === true) {
      ruleText += `\uff0c\u4f4e\u4e8e\u4fdd\u5e95\u6309${formatActivityProductSubmitFloorBasisLabel(normalizedSettings.submitAtProfitFloorBasis)}\u63d0\u4ea4`;
    }

    return ruleText;
  }

  function formatActivityProductFilterRule(settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const mode = normalizeActivityProductFilterMode(normalizedSettings.mode);
    const modeOption = ACTIVITY_PRODUCT_FILTER_MODE_OPTIONS.find((option) => normalizeText(option && option.value) === mode) || null;
    const modeLabel = normalizeText(modeOption && modeOption.label) || '\u4ee5\u5efa\u8bae\u6d3b\u52a8\u4ef7';
    const modeValue = normalizeOptionalNumber(resolveActivityProductFilterModeValue(normalizedSettings, mode));
    let ruleText = modeLabel;

    if (mode === 'dailyDiscount' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${modeValue}\u6298`;
    } else if (mode === 'saleProfitRate' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${formatPercent(modeValue)}`;
    } else if (mode === 'profitRateDiscount' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${formatPercent(modeValue)}`;
    } else if (mode === 'dailyReduce' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${modeValue.toFixed(2).replace(/\.00$/, '')}\u5143`;
    } else if (mode === 'costMarkup' && modeValue !== null && modeValue > 0) {
      ruleText = `${modeLabel} ${modeValue.toFixed(2).replace(/\.00$/, '')}\u5143`;
    }

    return ruleText;
  }

  function buildActivityProductFilterModeFormulaText(settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const mode = normalizeActivityProductFilterMode(normalizedSettings.mode);

    if (mode === 'suggestActivityPrice') {
      return '\u5148\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4f5c\u4e3a\u5f53\u524d\u6d3b\u52a8\u4ef7';
    }

    if (mode === 'dailyDiscount') {
      return '\u5148\u6309\u65e5\u5e38\u4ef7 x \u6298\u6263 / 10 \u8ba1\u7b97\u81ea\u5b9a\u4e49\u6d3b\u52a8\u4ef7';
    }

    if (mode === 'dailyReduce') {
      return '\u5148\u6309\u65e5\u5e38\u4ef7 - \u51cf\u5c11\u91d1\u989d \u8ba1\u7b97\u81ea\u5b9a\u4e49\u6d3b\u52a8\u4ef7';
    }

    if (mode === 'costMarkup') {
      return '\u5148\u6309\u6210\u672c\u4ef7 + \u52a0\u4ef7\u91d1\u989d \u8ba1\u7b97\u81ea\u5b9a\u4e49\u6d3b\u52a8\u4ef7';
    }

    if (mode === 'profitRateDiscount') {
      return '\u5148\u6309\u6210\u672c\u4ef7 x (1 + \u5229\u6da6\u7387) \u8ba1\u7b97\u81ea\u5b9a\u4e49\u6d3b\u52a8\u4ef7';
    }

    if (mode === 'saleProfitRate') {
      return '\u5148\u6309\u552e\u4ef7\u5229\u6da6\u7387\u53cd\u63a8\u81ea\u5b9a\u4e49\u6d3b\u52a8\u4ef7\uff0c\u516c\u5f0f\u4e3a\uff1a\u4ef7\u683c = \u6210\u672c\u4ef7 / (1 - \u5229\u6da6\u7387)';
    }

    return '\u5148\u6309\u5f53\u524d\u89c4\u5219\u8ba1\u7b97\u6d3b\u52a8\u4ef7';
  }

  function buildActivityProductFilterModeTipText(settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const formulaText = buildActivityProductFilterModeFormulaText(normalizedSettings);
    const floorRuleText = formatActivityProductProfitFloorRule(normalizedSettings, {
      includeSubmitAction: false
    });

    if (floorRuleText === '\u4e0d\u9650') {
      return `${formulaText}\uff1b\u82e5\u5f53\u524d\u6d3b\u52a8\u4ef7\u4e0d\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\uff0c\u76f4\u63a5\u901a\u8fc7\uff1b\u82e5\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\uff0c\u5219\u6539\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u63d0\u4ea4\u3002`;
    }

    if (normalizedSettings.submitAtProfitFloor === true) {
      const basisLabel = formatActivityProductSubmitFloorBasisLabel(normalizedSettings.submitAtProfitFloorBasis);
      return `${formulaText}\uff1b\u82e5\u5f53\u524d\u6d3b\u52a8\u4ef7\u6ee1\u8db3\u4fdd\u5e95\u4e14\u4e0d\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\uff0c\u76f4\u63a5\u901a\u8fc7\uff1b\u5426\u5219\u5148\u6539\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u590d\u6838\uff0c\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4ecd\u672a\u8fbe\u5230\u5f53\u524d\u4fdd\u5e95\u65f6\uff0c\u518d\u6309${basisLabel}\u751f\u6210\u4fdd\u5e95\u63d0\u4ea4\u4ef7\uff0c\u53ea\u6709\u4e0d\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4e14\u4ecd\u6ee1\u8db3\u4fdd\u5e95\u65f6\u624d\u4f1a\u901a\u8fc7\u3002`;
    }

    return `${formulaText}\uff1b\u82e5\u5f53\u524d\u6d3b\u52a8\u4ef7\u6ee1\u8db3\u4fdd\u5e95\u4e14\u4e0d\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\uff0c\u76f4\u63a5\u901a\u8fc7\uff1b\u5426\u5219\u5148\u6539\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u590d\u6838\uff0c\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4ecd\u672a\u8fbe\u5230\u5f53\u524d\u4fdd\u5e95\u65f6\u5219\u4e0d\u901a\u8fc7\u3002`;
  }

  function buildActivityProductFilterNoteText(settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const floorRuleText = formatActivityProductProfitFloorRule(normalizedSettings, {
      includeSubmitAction: false
    });

    if (floorRuleText === '\u4e0d\u9650') {
      return '\u5f53\u524d\u4e0d\u8bbe\u4fdd\u5e95\u9650\u5236\uff1b\u6240\u6709SKU\u90fd\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff0c\u672a\u5339\u914d\u6210\u672c\u4ef7\u7684SKU\u4e0d\u4f1a\u901a\u8fc7\uff0c\u4e14\u6700\u7ec8\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u4e0d\u4f1a\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\u3002';
    }

    if (normalizedSettings.submitAtProfitFloor === true) {
      const basisLabel = formatActivityProductSubmitFloorBasisLabel(normalizedSettings.submitAtProfitFloorBasis);
      return `\u5f53\u524d\u4fdd\u5e95\u89c4\u5219\uff1a${floorRuleText}\u3002\u52fe\u9009\u540e\u4f1a\u5148\u770b\u5f53\u524d\u6d3b\u52a8\u4ef7\u662f\u5426\u8fc7\u4fdd\u5e95\u4e14\u4e0d\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\uff1b\u4e0d\u901a\u8fc7\u65f6\u518d\u6539\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u590d\u6838\uff1b\u82e5\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4ecd\u672a\u8fbe\u5230\u4fdd\u5e95\uff0c\u5219\u4f1a\u6309${basisLabel}\u751f\u6210\u4fdd\u5e95\u63d0\u4ea4\u4ef7\uff0c\u53ea\u6709\u8be5\u4ef7\u683c\u4e0d\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4e14\u4ecd\u6ee1\u8db3\u5f53\u524d\u4fdd\u5e95\u65f6\u624d\u4f1a\u901a\u8fc7\u3002`;
    }

    return `\u5f53\u524d\u4fdd\u5e95\u89c4\u5219\uff1a${floorRuleText}\u3002\u6240\u6709SKU\u90fd\u9700\u5148\u5339\u914d\u6210\u672c\u4ef7\uff1b\u5982\u5f53\u524d\u6d3b\u52a8\u4ef7\u548c\u5efa\u8bae\u6d3b\u52a8\u4ef7\u90fd\u672a\u8fbe\u5230\u4fdd\u5e95\uff0c\u5219\u8be5SKU\u4e0d\u4f1a\u901a\u8fc7\u3002`;
  }

  function buildActivityProductFilterEditorModel(settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const mode = normalizeActivityProductFilterMode(normalizedSettings.mode);
    const modeValuePlaceholder = mode === 'suggestActivityPrice'
      ? '\u76f4\u63a5\u4f7f\u7528\u7cfb\u7edf\u5efa\u8bae\u6d3b\u52a8\u4ef7\uff0c\u65e0\u9700\u8f93\u5165'
      : (mode === 'dailyDiscount'
        ? '\u8f93\u5165\u6298\u6263\uff0c\u4f8b\u5982 8.5 \u8868\u793a85\u6298'
        : (mode === 'saleProfitRate'
          ? '\u8f93\u5165\u552e\u4ef7\u5229\u6da6\u7387\uff0c\u4f8b\u5982 20 \u8868\u793a\u552e\u4ef7\u5229\u6da6\u738720%'
        : (mode === 'profitRateDiscount'
          ? '\u8f93\u5165\u6210\u672c\u5229\u6da6\u7387\uff0c\u4f8b\u5982 20 \u8868\u793a\u552e\u4ef7 = \u6210\u672c x 1.2'
          : (mode === 'dailyReduce'
            ? '\u8f93\u5165\u51cf\u5c11\u91d1\u989d\uff0c\u4f8b\u5982 10 \u8868\u793a\u51cf10\u5143'
            : '\u8f93\u5165\u6210\u672c\u52a0\u4ef7\u91d1\u989d\uff0c\u4f8b\u5982 10 \u8868\u793a\u5728\u6210\u672c\u4ef7\u57fa\u7840\u4e0a\u52a010\u5143'))));
    const modeValueUnit = mode === 'dailyReduce' || mode === 'costMarkup'
      ? '\u5143'
      : ((mode === 'profitRateDiscount' || mode === 'saleProfitRate') ? '%' : '\u6298');

    return {
      settings: normalizedSettings,
      mode,
      modeValuePlaceholder,
      modeValueUnit,
      modeTipText: buildActivityProductFilterModeTipText(normalizedSettings),
      profitFloorRuleText: formatActivityProductProfitFloorRule(normalizedSettings),
      filterNoteText: buildActivityProductFilterNoteText(normalizedSettings)
    };
  }

  function renderActivityProductFilterSettingsFields(settings, options = {}) {
    const editorModel = buildActivityProductFilterEditorModel(settings);
    const attrName = normalizeText(options && options.settingAttribute) || 'data-ops-activity-batch-product-filter-setting';
    const disabled = options && options.disabled === true;

    return `
      <div class="ops-activity-product-filter-row is-mode-row">
        <label class="ops-activity-product-filter-field">
          <span>\u7b5b\u9009\u65b9\u5f0f</span>
          <select ${attrName}="mode" ${disabled ? 'disabled' : ''}>
            ${renderOptions(ACTIVITY_PRODUCT_FILTER_MODE_OPTIONS, editorModel.mode, '', { includeEmpty: false })}
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
              ${editorModel.mode === 'suggestActivityPrice' ? 'disabled' : ''}
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
            ${renderOptions(ACTIVITY_PRODUCT_PROFIT_FLOOR_RELATION_OPTIONS, editorModel.settings.profitFloorRelation, '', { includeEmpty: false })}
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
            <span>\u5f53\u524d\u6d3b\u52a8\u4ef7\u548c\u5efa\u8bae\u6d3b\u52a8\u4ef7\u90fd\u672a\u8fbe\u4fdd\u5e95\u65f6\uff0c\u6309\u4fdd\u5e95\u4ef7\u63d0\u4ea4</span>
          </label>
          <label class="ops-activity-product-filter-inline-field is-submit-basis">
            <span>\u4f7f\u7528</span>
            <select
              ${attrName}="submitAtProfitFloorBasis"
              ${editorModel.settings.submitAtProfitFloor === true && !disabled ? '' : 'disabled'}
            >
              ${renderOptions(
                ACTIVITY_PRODUCT_SUBMIT_FLOOR_BASIS_OPTIONS,
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

  function updateActivityProductFilterSettingsDraft(settings, fieldName, value) {
    const currentSettings = normalizeActivityProductFilterSettings(settings);
    const normalizedFieldName = normalizeText(fieldName);

    if (normalizedFieldName === 'mode') {
      return normalizeActivityProductFilterSettings({
        ...currentSettings,
        mode: value
      });
    }

    if (normalizedFieldName === 'modeValue') {
      const currentMode = normalizeActivityProductFilterMode(currentSettings.mode);
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

      return normalizeActivityProductFilterSettings(nextPayload);
    }

    if (normalizedFieldName === 'profitFloorRate') {
      return normalizeActivityProductFilterSettings({
        ...currentSettings,
        profitFloorRate: value
      });
    }

    if (normalizedFieldName === 'profitFloorRelation') {
      return normalizeActivityProductFilterSettings({
        ...currentSettings,
        profitFloorRelation: value
      });
    }

    if (normalizedFieldName === 'profitFloorValue') {
      return normalizeActivityProductFilterSettings({
        ...currentSettings,
        profitFloorValue: value
      });
    }

    if (normalizedFieldName === 'submitAtProfitFloor') {
      return normalizeActivityProductFilterSettings({
        ...currentSettings,
        submitAtProfitFloor: value
      });
    }

    if (normalizedFieldName === 'submitAtProfitFloorBasis') {
      return normalizeActivityProductFilterSettings({
        ...currentSettings,
        submitAtProfitFloorBasis: value
      });
    }

    return currentSettings;
  }

  function normalizeActivityFilterSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const settingsVersion = normalizeNonNegativeInteger(source.version, 0);
    const useLegacyActivityRemainingDaysValue = (
      settingsVersion > 0
      && settingsVersion < 2
      && (source.minActivityRemainingDays === undefined || source.minActivityRemainingDays === null || source.minActivityRemainingDays === '')
      && source.maxActivityRemainingDays !== undefined
      && source.maxActivityRemainingDays !== null
      && source.maxActivityRemainingDays !== ''
    );
    const enrollRemainingRange = normalizeFilterRemainingDaysRange(
      source.minEnrollRemainingDays,
      source.maxEnrollRemainingDays
    );
    const activityRemainingRange = normalizeFilterRemainingDaysRange(
      useLegacyActivityRemainingDaysValue ? source.maxActivityRemainingDays : source.minActivityRemainingDays,
      useLegacyActivityRemainingDaysValue ? '' : source.maxActivityRemainingDays
    );

    return {
      minDiscountRate: normalizeFilterDiscountInputValue(source.minDiscountRate),
      minEnrollRemainingDays: enrollRemainingRange.minValue,
      maxEnrollRemainingDays: enrollRemainingRange.maxValue,
      minActivityRemainingDays: activityRemainingRange.minValue,
      maxActivityRemainingDays: activityRemainingRange.maxValue,
      activityThemeTypes: normalizeActivityThemeTypeFilterValues(source.activityThemeTypes)
    };
  }

  function getCommittedActivityFilterSettings(state) {
    return {
      minDiscountRate: normalizeText(state && state.activityFilterMinDiscountRate),
      minEnrollRemainingDays: normalizeText(state && state.activityFilterMinEnrollRemainingDays),
      maxEnrollRemainingDays: normalizeText(state && state.activityFilterMaxEnrollRemainingDays),
      minActivityRemainingDays: normalizeText(state && state.activityFilterMinActivityRemainingDays),
      maxActivityRemainingDays: normalizeText(state && state.activityFilterMaxActivityRemainingDays),
      activityThemeTypes: normalizeActivityThemeTypeFilterValues(state && state.activityFilterThemeTypes)
    };
  }

  function getDraftActivityFilterSettings(state) {
    return {
      minDiscountRate: normalizeText(state && state.activityFilterDraftMinDiscountRate),
      minEnrollRemainingDays: normalizeText(state && state.activityFilterDraftMinEnrollRemainingDays),
      maxEnrollRemainingDays: normalizeText(state && state.activityFilterDraftMaxEnrollRemainingDays),
      minActivityRemainingDays: normalizeText(state && state.activityFilterDraftMinActivityRemainingDays),
      maxActivityRemainingDays: normalizeText(state && state.activityFilterDraftMaxActivityRemainingDays),
      activityThemeTypes: normalizeActivityThemeTypeFilterValues(state && state.activityFilterDraftThemeTypes)
    };
  }

  function hasActivityFilterSettings(settings) {
    const normalizedSettings = settings && typeof settings === 'object'
      ? settings
      : buildEmptyActivityFilterSettings();
    return Boolean(
      normalizeText(normalizedSettings.minDiscountRate)
      || normalizeText(normalizedSettings.minEnrollRemainingDays)
      || normalizeText(normalizedSettings.maxEnrollRemainingDays)
      || normalizeText(normalizedSettings.minActivityRemainingDays)
      || normalizeText(normalizedSettings.maxActivityRemainingDays)
      || normalizeActivityThemeTypeFilterValues(normalizedSettings.activityThemeTypes).length > 0
    );
  }

  function setCommittedActivityFilterSettings(state, settings) {
    const normalizedSettings = normalizeActivityFilterSettings(settings);
    state.activityFilterMinDiscountRate = normalizedSettings.minDiscountRate;
    state.activityFilterMinEnrollRemainingDays = normalizedSettings.minEnrollRemainingDays;
    state.activityFilterMaxEnrollRemainingDays = normalizedSettings.maxEnrollRemainingDays;
    state.activityFilterMinActivityRemainingDays = normalizedSettings.minActivityRemainingDays;
    state.activityFilterMaxActivityRemainingDays = normalizedSettings.maxActivityRemainingDays;
    state.activityFilterThemeTypes = normalizedSettings.activityThemeTypes.slice();
    return normalizedSettings;
  }

  function syncActivityFilterDraftSettings(state) {
    const normalizedSettings = getCommittedActivityFilterSettings(state);
    state.activityFilterDraftMinDiscountRate = normalizedSettings.minDiscountRate;
    state.activityFilterDraftMinEnrollRemainingDays = normalizedSettings.minEnrollRemainingDays;
    state.activityFilterDraftMaxEnrollRemainingDays = normalizedSettings.maxEnrollRemainingDays;
    state.activityFilterDraftMinActivityRemainingDays = normalizedSettings.minActivityRemainingDays;
    state.activityFilterDraftMaxActivityRemainingDays = normalizedSettings.maxActivityRemainingDays;
    state.activityFilterDraftThemeTypes = normalizeActivityThemeTypeFilterValues(normalizedSettings.activityThemeTypes);
    return normalizedSettings;
  }

  function clearActivityFilterFeedback(state) {
    state.activityFilterWarning = '';
    state.activityFilterNotice = '';
  }

  function closeActivityFilterDialogState(state) {
    state.activityFilterDialogOpen = false;
    state.activityFilterSaving = false;
    clearActivityFilterFeedback(state);
    syncActivityFilterDraftSettings(state);
  }

  function normalizeActivitySortField(value) {
    const normalizedValue = normalizeText(value);
    return ACTIVITY_SORT_FIELDS.has(normalizedValue) ? normalizedValue : '';
  }

  function normalizeActivitySortDirection(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return normalizedValue === 'asc' || normalizedValue === 'desc'
      ? normalizedValue
      : '';
  }

  function resolveDefaultActivitySortDirection(sortField) {
    const normalizedSortField = normalizeActivitySortField(sortField);

    if (!normalizedSortField) {
      return 'asc';
    }

    if (
      normalizedSortField === 'discountThreshold'
      || normalizedSortField === 'stockThreshold'
      || normalizedSortField === 'durationDays'
      || normalizedSortField === 'remaining'
      || normalizedSortField === 'priority'
    ) {
      return 'desc';
    }

    return 'asc';
  }

  function toggleActivitySortState(state, sortField) {
    const normalizedSortField = normalizeActivitySortField(sortField);

    if (!normalizedSortField) {
      return;
    }

    const currentSortField = normalizeActivitySortField(state && state.activitySortField);
    const currentSortDirection = normalizeActivitySortDirection(state && state.activitySortDirection);

    if (currentSortField !== normalizedSortField) {
      state.activitySortField = normalizedSortField;
      state.activitySortDirection = resolveDefaultActivitySortDirection(normalizedSortField);
      return;
    }

    state.activitySortField = normalizedSortField;
    state.activitySortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  }

  function normalizeSortableNumberValue(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function compareSortableTextValue(left, right, sortDirection = 'asc') {
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);

    if (!leftText && !rightText) {
      return 0;
    }

    if (!leftText) {
      return 1;
    }

    if (!rightText) {
      return -1;
    }

    const compareResult = leftText.localeCompare(rightText, 'zh-CN');
    return sortDirection === 'desc' ? compareResult * -1 : compareResult;
  }

  function compareSortableNumberValue(left, right, sortDirection = 'asc') {
    const leftNumber = normalizeSortableNumberValue(left);
    const rightNumber = normalizeSortableNumberValue(right);

    if (leftNumber === null && rightNumber === null) {
      return 0;
    }

    if (leftNumber === null) {
      return 1;
    }

    if (rightNumber === null) {
      return -1;
    }

    const compareResult = leftNumber - rightNumber;
    return sortDirection === 'desc' ? compareResult * -1 : compareResult;
  }

  function getActivitySortValue(row, sortField) {
    const normalizedSortField = normalizeActivitySortField(sortField);

    if (!normalizedSortField) {
      return '';
    }

    if (normalizedSortField === 'activityThematicName') {
      return normalizeText(row && row.activityThematicName);
    }

    if (normalizedSortField === 'activityName') {
      return normalizeText(row && row.activityName);
    }

    if (normalizedSortField === 'activityThemeTypeLabel') {
      return resolveActivityThemeTypeLabel(row);
    }

    if (normalizedSortField === 'discountThreshold') {
      return getDiscountThresholdValue(row && row.discountThreshold);
    }

    if (normalizedSortField === 'stockThreshold') {
      return normalizeOptionalNumber(row && row.stockThreshold);
    }

    if (normalizedSortField === 'durationDays') {
      return normalizeOptionalNumber(row && row.durationDays);
    }

    if (normalizedSortField === 'enrollWindow') {
      return parseTimestamp(row && row.enrollDeadLine);
    }

    if (normalizedSortField === 'activityWindow') {
      return parseTimestamp(row && row.startTime);
    }

    if (normalizedSortField === 'remaining') {
      return getRemainingDaysUntil(row && row.endTime);
    }

    if (normalizedSortField === 'priority') {
      return normalizeOptionalNumber(row && row.priority);
    }

    return '';
  }

  function compareActivityRowsBySortField(leftRow, rightRow, sortField, sortDirection) {
    const normalizedSortField = normalizeActivitySortField(sortField);
    const normalizedSortDirection = normalizeActivitySortDirection(sortDirection) || 'asc';

    if (!normalizedSortField) {
      return 0;
    }

    const leftValue = getActivitySortValue(leftRow, normalizedSortField);
    const rightValue = getActivitySortValue(rightRow, normalizedSortField);

    if (
      normalizedSortField === 'discountThreshold'
      || normalizedSortField === 'stockThreshold'
      || normalizedSortField === 'durationDays'
      || normalizedSortField === 'enrollWindow'
      || normalizedSortField === 'activityWindow'
      || normalizedSortField === 'remaining'
      || normalizedSortField === 'priority'
    ) {
      return compareSortableNumberValue(leftValue, rightValue, normalizedSortDirection);
    }

    return compareSortableTextValue(leftValue, rightValue, normalizedSortDirection);
  }

  function buildSortedActivityRows(rows, state) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const sortField = normalizeActivitySortField(state && state.activitySortField);
    const sortDirection = normalizeActivitySortDirection(state && state.activitySortDirection);

    if (!sortField || !sortDirection) {
      return sourceRows.slice();
    }

    return sourceRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const compareResult = compareActivityRowsBySortField(left.row, right.row, sortField, sortDirection);

        if (compareResult !== 0) {
          return compareResult;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.row);
  }

  function buildEmptyActivityProductQueryState() {
    return {
      loading: false,
      queryCanceling: false,
      requestId: 0,
      requestPromise: null,
      statusKind: 'idle',
      statusMessage: '',
      updatedAt: '',
      cacheKey: '',
      baseRows: [],
      rows: [],
      shopResults: [],
      totalShopCount: 0,
      successShopCount: 0,
      failedShopCount: 0,
      rawProductCount: 0,
      uniqueProductCount: 0,
      cachedRowCount: 0,
      stillCount: 0,
      hasMore: false,
      pageIndex: 1,
      pageCount: 1,
      tablePage: 1,
      tablePageSize: PRODUCT_TABLE_DEFAULT_PAGE_SIZE
    };
  }

  function formatCentAmount(value) {
    const parsedValue = normalizeOptionalNumber(value);

    if (parsedValue === null) {
      return '\u2014';
    }

    const normalizedValue = (parsedValue / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return normalizedValue || '0';
  }

  function formatPriceRange(minValue, maxValue, currency) {
    const normalizedMinValue = normalizeOptionalNumber(minValue);
    const normalizedMaxValue = normalizeOptionalNumber(maxValue);
    const normalizedCurrency = normalizeText(currency);

    if (normalizedMinValue === null && normalizedMaxValue === null) {
      return '\u2014';
    }

    const effectiveMinValue = normalizedMinValue === null ? normalizedMaxValue : normalizedMinValue;
    const effectiveMaxValue = normalizedMaxValue === null ? normalizedMinValue : normalizedMaxValue;
    const suffix = normalizedCurrency ? ` ${normalizedCurrency}` : '';

    if (effectiveMinValue === effectiveMaxValue) {
      return `${formatCentAmount(effectiveMinValue)}${suffix}`;
    }

    return `${formatCentAmount(effectiveMinValue)} - ${formatCentAmount(effectiveMaxValue)}${suffix}`;
  }

  function normalizeActivityProductShopScopeRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const shopId = normalizeText(source.shopId);
    const shopName = normalizeText(source.shopName) || shopId;

    return {
      shopId,
      shopName,
      siteIds: normalizeTextArray(source.siteIds),
      siteNames: normalizeTextArray(source.siteNames),
      suggestEnrollSessionIdList: normalizeTextArray(source.suggestEnrollSessionIdList),
      enrollSessionIdList: normalizeTextArray(source.enrollSessionIdList)
    };
  }

  function normalizeActivityProductShopScopeList(input) {
    const scopeMap = new Map();
    const source = Array.isArray(input) ? input : [];

    source.forEach((record) => {
      const normalizedRecord = normalizeActivityProductShopScopeRecord(record);
      const scopeKey = normalizedRecord.shopId || normalizedRecord.shopName;

      if (!scopeKey) {
        return;
      }

      if (!scopeMap.has(scopeKey)) {
        scopeMap.set(scopeKey, normalizedRecord);
        return;
      }

      const current = scopeMap.get(scopeKey);
      current.shopId = current.shopId || normalizedRecord.shopId;
      current.shopName = current.shopName || normalizedRecord.shopName;
      current.siteIds = normalizeTextArray([...(current.siteIds || []), ...(normalizedRecord.siteIds || [])]);
      current.siteNames = normalizeTextArray([...(current.siteNames || []), ...(normalizedRecord.siteNames || [])]);
      current.suggestEnrollSessionIdList = normalizeTextArray([
        ...(current.suggestEnrollSessionIdList || []),
        ...(normalizedRecord.suggestEnrollSessionIdList || [])
      ]);
      current.enrollSessionIdList = normalizeTextArray([
        ...(current.enrollSessionIdList || []),
        ...(normalizedRecord.enrollSessionIdList || [])
      ]);
    });

    return Array.from(scopeMap.values());
  }

  function normalizeActivityProductActivityScopeRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const activityKey = normalizeText(source.activityKey);
    const activityType = normalizeOptionalNumber(source.activityType);
    const activityThematicId = normalizeText(source.activityThematicId);
    const activityName = normalizeText(source.activityName);
    const shopScope = normalizeActivityProductShopScopeRecord(source);

    return {
      activityKey,
      activityType,
      activityThematicId,
      activityName,
      shopId: shopScope.shopId,
      shopName: shopScope.shopName,
      siteIds: shopScope.siteIds,
      siteNames: shopScope.siteNames,
      suggestEnrollSessionIdList: shopScope.suggestEnrollSessionIdList,
      enrollSessionIdList: shopScope.enrollSessionIdList
    };
  }

  function normalizeActivityProductActivityScopeList(input) {
    const scopeMap = new Map();
    const source = Array.isArray(input) ? input : [];

    source.forEach((record) => {
      const normalizedRecord = normalizeActivityProductActivityScopeRecord(record);
      const scopeKey = [
        normalizeText(normalizedRecord.activityKey),
        normalizedRecord.activityType === null ? '' : String(normalizedRecord.activityType),
        normalizeText(normalizedRecord.activityThematicId),
        normalizeText(normalizedRecord.shopId) || normalizeText(normalizedRecord.shopName)
      ].join('\x1f');

      if (!normalizedRecord.activityKey || !(normalizedRecord.shopId || normalizedRecord.shopName)) {
        return;
      }

      if (!scopeMap.has(scopeKey)) {
        scopeMap.set(scopeKey, normalizedRecord);
        return;
      }

      const current = scopeMap.get(scopeKey);
      current.activityType = current.activityType === null ? normalizedRecord.activityType : current.activityType;
      current.activityThematicId = current.activityThematicId || normalizedRecord.activityThematicId;
      current.activityName = current.activityName || normalizedRecord.activityName;
      current.shopId = current.shopId || normalizedRecord.shopId;
      current.shopName = current.shopName || normalizedRecord.shopName;
      current.siteIds = normalizeTextArray([...(current.siteIds || []), ...(normalizedRecord.siteIds || [])]);
      current.siteNames = normalizeTextArray([...(current.siteNames || []), ...(normalizedRecord.siteNames || [])]);
      current.suggestEnrollSessionIdList = normalizeTextArray([
        ...(current.suggestEnrollSessionIdList || []),
        ...(normalizedRecord.suggestEnrollSessionIdList || [])
      ]);
      current.enrollSessionIdList = normalizeTextArray([
        ...(current.enrollSessionIdList || []),
        ...(normalizedRecord.enrollSessionIdList || [])
      ]);
    });

    return Array.from(scopeMap.values());
  }

  function normalizeActivityProductRowRecord(row) {
    const source = row && typeof row === 'object' ? row : {};
    const availableShopIds = normalizeTextArray(source.availableShopIds);
    const availableShopNames = normalizeTextArray(source.availableShopNames);
    const shopScopes = normalizeActivityProductShopScopeList(source.shopScopes);
    const activityScopes = normalizeActivityProductActivityScopeList(source.activityScopes);
    const skuDetails = Array.isArray(source.skuDetails)
      ? source.skuDetails
        .map((record) => {
          const detailSource = record && typeof record === 'object' ? record : {};
          return {
            siteId: normalizeText(detailSource.siteId),
            siteName: normalizeText(detailSource.siteName),
            skcId: normalizeText(detailSource.skcId),
            skcExtCode: normalizeText(detailSource.skcExtCode),
            skcPropertiesText: normalizeText(detailSource.skcPropertiesText),
            skuId: normalizeText(detailSource.skuId),
            skuExtCode: normalizeText(detailSource.skuExtCode),
            skuPropertiesText: normalizeText(detailSource.skuPropertiesText),
            currency: normalizeText(detailSource.currency),
            suggestActivityPrice: normalizeOptionalNumber(detailSource.suggestActivityPrice),
            dailyPrice: normalizeOptionalNumber(detailSource.dailyPrice),
            activityPrice: normalizeOptionalNumber(detailSource.activityPrice),
            suggestActivityDiscount: normalizeOptionalNumber(detailSource.suggestActivityDiscount),
            costPrice: normalizeQuickCostValue(detailSource.costPrice)
          };
        })
        .filter((detail) => detail.skuId || detail.skcId || detail.skuPropertiesText || detail.skcPropertiesText)
      : [];

    return {
      productId: normalizeText(source.productId),
      productName: normalizeText(source.productName),
      pictureUrl: normalizeText(source.pictureUrl),
      currency: normalizeText(source.currency),
      semiDrCode: normalizeText(source.semiDrCode),
      targetActivityStock: normalizeOptionalNumber(source.targetActivityStock),
      suggestActivityStock: normalizeOptionalNumber(source.suggestActivityStock),
      salesStock: normalizeOptionalNumber(source.salesStock),
      canEnrollSessionCount: normalizeOptionalNumber(source.canEnrollSessionCount),
      siteIds: normalizeTextArray(source.siteIds),
      siteNames: normalizeTextArray(source.siteNames),
      availableShopIds,
      availableShopNames,
      shopId: normalizeText(source.shopId) || (availableShopIds[0] || ''),
      shopName: normalizeText(source.shopName) || (availableShopNames[0] || ''),
      suggestEnrollSessionIdList: normalizeTextArray(source.suggestEnrollSessionIdList),
      enrollSessionIdList: normalizeTextArray(source.enrollSessionIdList),
      skcCount: normalizeNonNegativeInteger(source.skcCount, 0),
      skuCount: normalizeNonNegativeInteger(source.skuCount, 0),
      suggestActivityPriceMin: normalizeOptionalNumber(source.suggestActivityPriceMin),
      suggestActivityPriceMax: normalizeOptionalNumber(source.suggestActivityPriceMax),
      dailyPriceMin: normalizeOptionalNumber(source.dailyPriceMin),
      dailyPriceMax: normalizeOptionalNumber(source.dailyPriceMax),
      sourceShopCount: normalizeNonNegativeInteger(source.sourceShopCount, availableShopIds.length),
      activityKeys: normalizeTextArray(source.activityKeys),
      activityNames: normalizeTextArray(source.activityNames),
      activityCount: normalizeNonNegativeInteger(source.activityCount, 0),
      shopScopes,
      activityScopes,
      activityScopeCount: normalizeNonNegativeInteger(source.activityScopeCount, activityScopes.length),
      skuDetails
    };
  }

  function normalizeActivityProductShopResultRecord(record, shopCatalog) {
    const source = record && typeof record === 'object' ? record : {};
    const shopId = normalizeText(source.shopId);
    const catalogShop = shopCatalog && shopCatalog.shopMap && shopCatalog.shopMap[shopId]
      ? shopCatalog.shopMap[shopId]
      : null;

    return {
      shopId,
      shopName: normalizeText(source.shopName) || normalizeText(catalogShop && catalogShop.shopName) || shopId,
      success: source.success === true,
      productCount: normalizeNonNegativeInteger(source.productCount, 0),
      stillCount: normalizeNonNegativeInteger(source.stillCount, 0),
      hasMore: source.hasMore === true,
      searchScrollContext: normalizeText(source.searchScrollContext),
      message: normalizeText(source.message)
    };
  }

  function normalizeActivityProductQueryResponse(response, state) {
    const source = response && typeof response === 'object' ? response : {};
    const rows = Array.isArray(source.rows)
      ? source.rows
        .map(normalizeActivityProductRowRecord)
        .filter((row) => Boolean(row.productId))
      : [];
    const shopResults = Array.isArray(source.shopResults)
      ? source.shopResults.map((item) => normalizeActivityProductShopResultRecord(item, state.shopCatalog))
      : [];

    return {
      success: source.success === true,
      updatedAt: normalizeText(source.updatedAt),
      cacheKey: normalizeText(source.cacheKey),
      activityKey: normalizeText(source.activityKey),
      activityType: normalizeOptionalNumber(source.activityType),
      activityThematicId: normalizeText(source.activityThematicId),
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, shopResults.length),
      successShopCount: normalizeNonNegativeInteger(source.successShopCount, shopResults.filter((item) => item.success).length),
      failedShopCount: normalizeNonNegativeInteger(source.failedShopCount, Math.max(0, shopResults.length - shopResults.filter((item) => item.success).length)),
      rawProductCount: normalizeNonNegativeInteger(source.rawProductCount, rows.length),
      uniqueProductCount: normalizeNonNegativeInteger(source.uniqueProductCount, rows.length),
      cachedRowCount: normalizeNonNegativeInteger(
        source.cachedRowCount,
        normalizeNonNegativeInteger(source.uniqueProductCount, rows.length)
      ),
      stillCount: normalizeNonNegativeInteger(source.stillCount, 0),
      hasMore: source.hasMore === true,
      pageIndex: Math.max(1, normalizeNonNegativeInteger(source.pageIndex, 1)),
      pageSize: normalizeProductTablePageSize(source.pageSize),
      pageCount: Math.max(1, normalizeNonNegativeInteger(source.pageCount, 1)),
      rows,
      shopResults,
      warning: normalizeText(source.warning)
    };
  }

  function buildEmptyActivityProductBatchState() {
    return {
      loading: false,
      requestId: 0,
      requestKey: '',
      progressUnsubscribe: null,
      submitProgressUnsubscribe: null,
      requestPromise: null,
      statusKind: 'idle',
      statusMessage: '',
      updatedAt: '',
      cacheKey: '',
      rows: [],
      totalShopCount: 0,
      totalActivityCount: 0,
      successActivityCount: 0,
      failedActivityCount: 0,
      uniqueProductCount: 0,
      cachedRowCount: 0,
      pageIndex: 1,
      pageCount: 1,
      tablePage: 1,
      tablePageSize: PRODUCT_TABLE_DEFAULT_PAGE_SIZE,
      progress: null,
      submitRequestKey: '',
      submitProgress: null,
      activityResults: [],
      filterShopId: '',
      filterActivityKey: '',
      costFilter: '',
      filterSignupStatus: '',
      sortField: '',
      sortDirection: '',
      viewShopOptions: [],
      viewActivityOptions: [],
      expandedSkuDetailKeys: [],
      quickCostEntries: [],
      quickCostSnapshotLoading: false,
      quickCostSnapshotCacheKey: '',
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
      submitting: false,
      activityBatchSubmitResultMap: Object.create(null),
      activityProductFilterDialogOpen: false,
      activityProductFilterDialogLoading: false,
      activityProductFilterDialogApplying: false,
      activityProductFilterDialogError: '',
      activityProductFilterDialogWarning: '',
      activityProductFilterDialogNotice: '',
      activityProductFilterDialogOpenRequestId: 0,
      activityProductFilterSettingsLoaded: false,
      activityProductFilterSettingsLoading: false,
      activityProductFilterSettingsSaving: false,
      activityProductFilterSettingsPromise: null,
      activityProductFilterSettingsSavePromise: null,
      activityProductFilterSettingsSaveQueued: false,
      activityProductFilterSettings: normalizeActivityProductFilterSettings(buildEmptyActivityProductFilterSettings()),
      activityProductFilterAppliedSettings: normalizeActivityProductFilterSettings(buildEmptyActivityProductFilterSettings()),
      activityProductFilterSettingsDirty: false,
      activityProductFilterSummary: buildEmptyActivityProductFilterSummary(),
      activityProductFilterProgress: buildEmptyActivityProductFilterProgress(),
      activityProductFilterRows: [],
      activityProductFilterResultMap: Object.create(null),
      activityProductFilterApplied: false
    };
  }

  function buildEmptyActivityBackgroundSubmitSummary() {
    return {
      totalActivityCount: 0,
      totalShopCount: 0,
      completedActivityCount: 0,
      submittedActivityCount: 0,
      failedActivityCount: 0,
      skippedActivityCount: 0,
      queriedProductCount: 0,
      eligibleProductCount: 0,
      skippedProductCount: 0,
      submitPreparedRowCount: 0,
      submitSuccessCount: 0,
      submitFailedCount: 0,
      submitSkippedCount: 0
    };
  }

  function buildEmptyActivityBackgroundSubmitState() {
    return {
      running: false,
      stopRequested: false,
      stopping: false,
      queryCanceling: false,
      runId: 0,
      runPromise: null,
      currentActivityKey: '',
      currentActivityName: '',
      currentQueryRequestId: '',
      currentSubmitRequestId: '',
      progress: null,
      progressUnsubscribe: null,
      statusKind: 'idle',
      statusMessage: '',
      startedAt: '',
      finishedAt: '',
      settingsCollapsed: false,
      summaryCollapsed: false,
      filterSettings: normalizeActivityProductFilterSettings(buildEmptyActivityProductFilterSettings()),
      filterSettingsLoaded: false,
      filterSettingsLoading: false,
      filterSettingsSaving: false,
      filterSettingsPromise: null,
      filterSettingsSavePromise: null,
      filterSettingsSaveQueued: false,
      filterSettingsWarning: '',
      filterSettingsNotice: '',
      filterSettingsError: '',
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
      logSessionId: '',
      logSessionPath: '',
      logSessionFileName: '',
      logSessionRowCount: 0,
      logPersistPromise: null,
      logPersistWarning: '',
      logInteractionActive: false,
      summary: buildEmptyActivityBackgroundSubmitSummary(),
      logs: [],
      nextLogId: 1,
      rowDecisionMessageMap: Object.create(null)
    };
  }

  function buildActivityBackgroundStoppedError() {
    const error = new Error('\u540e\u53f0\u4efb\u52a1\u5df2\u505c\u6b62');
    error.code = 'activity_background_stopped';
    return error;
  }

  function isActivityBackgroundStoppedError(error) {
    return Boolean(error) && normalizeText(error && error.code) === 'activity_background_stopped';
  }

  function buildActivityBackgroundLogRecord(level, message, context = {}) {
    const normalizedContext = context && typeof context === 'object' ? context : {};

    return {
      level: normalizeText(level) || 'info',
      message: normalizeText(message),
      createdAt: new Date().toISOString(),
      phase: normalizeText(normalizedContext.phase),
      shopName: normalizeText(normalizedContext.shopName),
      shopId: normalizeText(normalizedContext.shopId),
      siteName: normalizeText(normalizedContext.siteName),
      siteId: normalizeText(normalizedContext.siteId),
      activityName: normalizeText(normalizedContext.activityName),
      activityKey: normalizeText(normalizedContext.activityKey),
      productName: normalizeText(normalizedContext.productName),
      productId: normalizeText(normalizedContext.productId),
      statusText: normalizeText(normalizedContext.statusText)
    };
  }

  function appendActivityBackgroundSubmitLogs(backgroundState, records) {
    const state = backgroundState && typeof backgroundState === 'object'
      ? backgroundState
      : null;
    const sourceRecords = Array.isArray(records) ? records : [];

    if (!state || sourceRecords.length <= 0) {
      return [];
    }

    const nextLogs = Array.isArray(state.logs) ? state.logs.slice() : [];
    const appendedLogs = [];
    let nextLogId = normalizeNonNegativeInteger(state.nextLogId, 1);

    sourceRecords.forEach((record) => {
      const sourceRecord = record && typeof record === 'object' ? record : {};
      const nextLog = {
        id: nextLogId,
        ...buildActivityBackgroundLogRecord(
          sourceRecord.level,
          sourceRecord.message,
          sourceRecord
        )
      };

      nextLogs.push(nextLog);
      appendedLogs.push(nextLog);
      nextLogId += 1;
    });

    state.logs = nextLogs;
    state.nextLogId = nextLogId;

    if (nextLogs.length > ACTIVITY_BACKGROUND_LOG_LIMIT) {
      nextLogs.splice(0, nextLogs.length - ACTIVITY_BACKGROUND_LOG_LIMIT);
    }

    void queueActivityBackgroundLogRowsPersist(state, appendedLogs);
    return appendedLogs;
  }

  function appendActivityBackgroundSubmitLog(backgroundState, level, message, context = {}) {
    const appendedLogs = appendActivityBackgroundSubmitLogs(backgroundState, [{
      level,
      message,
      ...context
    }]);

    return appendedLogs[appendedLogs.length - 1] || null;
  }

  async function startActivityBackgroundLogSession(backgroundState) {
    const featureCenterApi = getFeatureCenterApi();

    if (
      !backgroundState
      || !featureCenterApi
      || typeof featureCenterApi.startOperationsActivityManagementBackgroundLogSession !== 'function'
    ) {
      return null;
    }

    try {
      const response = await featureCenterApi.startOperationsActivityManagementBackgroundLogSession({
        runId: normalizeNonNegativeInteger(backgroundState.runId, 0),
        startedAt: normalizeText(backgroundState.startedAt)
      });

      backgroundState.logSessionId = normalizeText(response && response.sessionId);
      backgroundState.logSessionPath = normalizeText(response && response.filePath);
      backgroundState.logSessionFileName = normalizeText(response && response.fileName);
      backgroundState.logSessionRowCount = normalizeNonNegativeInteger(response && response.rowCount, 0);
      backgroundState.logPersistWarning = normalizeText(response && response.warning);
      return response;
    } catch (error) {
      backgroundState.logSessionId = '';
      backgroundState.logSessionPath = '';
      backgroundState.logSessionFileName = '';
      backgroundState.logSessionRowCount = 0;
      backgroundState.logPersistWarning = normalizeText(error && error.message) || '\u65e5\u5fd7\u6587\u4ef6\u521b\u5efa\u5931\u8d25';
      return null;
    }
  }

  function queueActivityBackgroundLogRowsPersist(backgroundState, rows) {
    const state = backgroundState && typeof backgroundState === 'object' ? backgroundState : null;
    const featureCenterApi = getFeatureCenterApi();
    const normalizedRows = Array.isArray(rows)
      ? rows.filter((row) => row && typeof row === 'object')
      : [];

    if (
      !state
      || !normalizeText(state.logSessionId)
      || normalizedRows.length <= 0
      || !featureCenterApi
      || typeof featureCenterApi.appendOperationsActivityManagementBackgroundLogRows !== 'function'
    ) {
      return Promise.resolve(null);
    }

    const previousPromise = Promise.resolve(state.logPersistPromise).catch(() => null);

    state.logPersistPromise = previousPromise.then(async () => {
      const response = await featureCenterApi.appendOperationsActivityManagementBackgroundLogRows({
        sessionId: normalizeText(state.logSessionId),
        rows: normalizedRows.map((row) => ({
          createdAt: normalizeText(row && row.createdAt),
          phase: normalizeText(row && row.phase),
          shopName: normalizeText(row && row.shopName),
          shopId: normalizeText(row && row.shopId),
          siteName: normalizeText(row && row.siteName),
          siteId: normalizeText(row && row.siteId),
          activityName: normalizeText(row && row.activityName),
          activityKey: normalizeText(row && row.activityKey),
          productName: normalizeText(row && row.productName),
          productId: normalizeText(row && row.productId),
          statusText: normalizeText(row && row.statusText),
          level: normalizeText(row && row.level),
          message: normalizeText(row && row.message)
        }))
      });

      state.logSessionRowCount = normalizeNonNegativeInteger(
        response && response.rowCount,
        state.logSessionRowCount + normalizedRows.length
      );
      state.logPersistWarning = normalizeText(response && response.warning);
      return response;
    }).catch((error) => {
      state.logPersistWarning = normalizeText(error && error.message) || '\u65e5\u5fd7\u6587\u4ef6\u5199\u5165\u5931\u8d25';
      return null;
    });

    return state.logPersistPromise;
  }

  async function flushActivityBackgroundLogRowsPersist(backgroundState) {
    await Promise.resolve(backgroundState && backgroundState.logPersistPromise).catch(() => null);
  }

  async function finishActivityBackgroundLogSession(backgroundState) {
    const state = backgroundState && typeof backgroundState === 'object' ? backgroundState : null;
    const featureCenterApi = getFeatureCenterApi();

    if (
      !state
      || !normalizeText(state.logSessionId)
      || !featureCenterApi
      || typeof featureCenterApi.finishOperationsActivityManagementBackgroundLogSession !== 'function'
    ) {
      return null;
    }

    await flushActivityBackgroundLogRowsPersist(state);

    try {
      const response = await featureCenterApi.finishOperationsActivityManagementBackgroundLogSession({
        sessionId: normalizeText(state.logSessionId),
        finishedAt: normalizeText(state.finishedAt)
      });

      state.logSessionRowCount = normalizeNonNegativeInteger(
        response && response.rowCount,
        state.logSessionRowCount
      );
      state.logPersistWarning = normalizeText(response && response.warning);
      return response;
    } catch (error) {
      state.logPersistWarning = normalizeText(error && error.message) || '\u65e5\u5fd7\u6587\u4ef6\u7ed3\u675f\u5931\u8d25';
      return null;
    } finally {
      state.logSessionId = '';
      state.logPersistPromise = null;
    }
  }

  function normalizeActivityProductBatchResultRecord(record) {
    const source = record && typeof record === 'object' ? record : {};

    return {
      activityKey: normalizeText(source.activityKey),
      activityType: normalizeOptionalNumber(source.activityType),
      activityThematicId: normalizeText(source.activityThematicId),
      activityName: normalizeText(source.activityName),
      cacheKey: normalizeText(source.cacheKey),
      success: source.success === true,
      uniqueProductCount: normalizeNonNegativeInteger(source.uniqueProductCount, 0),
      message: normalizeText(source.message)
    };
  }

  function normalizeActivityBatchSignupSubmitResponse(response) {
    const source = response && typeof response === 'object' ? response : {};
    const normalizeRowResult = (record) => {
      const item = record && typeof record === 'object' ? record : {};
      return {
        rowKey: normalizeText(item.rowKey),
        submitScopeKey: normalizeText(item.submitScopeKey),
        productId: normalizeText(item.productId),
        productName: normalizeText(item.productName),
        shopId: normalizeText(item.shopId),
        shopName: normalizeText(item.shopName),
        siteIds: normalizeTextArray(item.siteIds),
        siteNames: normalizeTextArray(item.siteNames),
        activityKey: normalizeText(item.activityKey),
        activityType: normalizeOptionalNumber(item.activityType),
        activityThematicId: normalizeText(item.activityThematicId),
        activityName: normalizeText(item.activityName),
        success: item.success === true,
        statusText: normalizeText(item.statusText),
        enrollId: normalizeText(item.enrollId),
        message: normalizeText(item.message)
      };
    };
    const normalizeSkippedRow = (record) => {
      const item = record && typeof record === 'object' ? record : {};
      return {
        rowKey: normalizeText(item.rowKey),
        submitScopeKey: normalizeText(item.submitScopeKey),
        productId: normalizeText(item.productId),
        productName: normalizeText(item.productName),
        shopId: normalizeText(item.shopId),
        shopName: normalizeText(item.shopName),
        siteIds: normalizeTextArray(item.siteIds),
        siteNames: normalizeTextArray(item.siteNames),
        activityKey: normalizeText(item.activityKey),
        activityType: normalizeOptionalNumber(item.activityType),
        activityThematicId: normalizeText(item.activityThematicId),
        activityName: normalizeText(item.activityName),
        message: normalizeText(item.message)
      };
    };

    return {
      success: source.success === true,
      canceled: source.canceled === true,
      updatedAt: normalizeText(source.updatedAt),
      batchSize: Math.max(1, normalizeNonNegativeInteger(source.batchSize, 100)),
      totalInputRowCount: normalizeNonNegativeInteger(source.totalInputRowCount, 0),
      submittedRowCount: normalizeNonNegativeInteger(source.submittedRowCount, 0),
      skippedRowCount: normalizeNonNegativeInteger(source.skippedRowCount, 0),
      successRowCount: normalizeNonNegativeInteger(source.successRowCount, 0),
      failedRowCount: normalizeNonNegativeInteger(source.failedRowCount, 0),
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, 0),
      completedShopCount: normalizeNonNegativeInteger(source.completedShopCount, 0),
      failedShopCount: normalizeNonNegativeInteger(source.failedShopCount, 0),
      totalGroupCount: normalizeNonNegativeInteger(source.totalGroupCount, 0),
      totalRequestCount: normalizeNonNegativeInteger(source.totalRequestCount, 0),
      completedRequestCount: normalizeNonNegativeInteger(source.completedRequestCount, 0),
      failedRequestCount: normalizeNonNegativeInteger(source.failedRequestCount, 0),
      rowResults: Array.isArray(source.rowResults) ? source.rowResults.map(normalizeRowResult) : [],
      skippedRows: Array.isArray(source.skippedRows) ? source.skippedRows.map(normalizeSkippedRow) : [],
      warning: normalizeText(source.warning)
    };
  }

  function computeActivityProductProfitRate(priceAmount, costAmount) {
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

  function computeActivityProductProfitValue(priceAmount, costAmount) {
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

  function computeActivityProductRequiredPriceForProfitRate(costAmount, profitFloorRate) {
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

  function resolveActivityProductProfitFloorState(settings, costAmount) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const profitFloorRate = normalizeOptionalNumber(normalizedSettings.profitFloorRate);
    const profitFloorValueAmount = normalizeActivityYuanToCent(normalizedSettings.profitFloorValue);
    const relation = normalizeActivityProductProfitFloorRelation(normalizedSettings.profitFloorRelation);
    const hasProfitFloorRate = profitFloorRate !== null && profitFloorRate > 0;
    const hasProfitFloorValue = profitFloorValueAmount !== null && profitFloorValueAmount > 0;
    const requiredPriceForRate = hasProfitFloorRate
      ? computeActivityProductRequiredPriceForProfitRate(costAmount, profitFloorRate)
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

    const requestedSubmitFloorBasis = normalizeActivityProductSubmitFloorBasis(normalizedSettings.submitAtProfitFloorBasis);

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

  function evaluateActivityProductProfitFloor(priceAmount, costAmount, settings) {
    const floorState = resolveActivityProductProfitFloorState(settings, costAmount);
    const profitRate = computeActivityProductProfitRate(priceAmount, costAmount);
    const profitValue = computeActivityProductProfitValue(priceAmount, costAmount);
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

  function buildActivityProductProfitFloorFailReason(floorEvaluation) {
    const rateReason = floorEvaluation && floorEvaluation.hasProfitFloorRate
      ? `\u5229\u6da6\u7387\u4f4e\u4e8e\u4fdd\u5e95 ${formatPercent(floorEvaluation.profitFloorRate)}`
      : '';
    const valueReason = floorEvaluation && floorEvaluation.hasProfitFloorValue
      ? `\u5229\u6da6\u503c\u4f4e\u4e8e\u4fdd\u5e95 ${formatCentAmount(floorEvaluation.profitFloorValueAmount)}\u5143`
      : '';

    if (!floorEvaluation || (!rateReason && !valueReason)) {
      return '\u672a\u6ee1\u8db3\u4fdd\u5e95\u6761\u4ef6';
    }

    if (floorEvaluation.hasProfitFloorRate && floorEvaluation.hasProfitFloorValue) {
      if (floorEvaluation.relation === 'or') {
        return `\u5229\u6da6\u7387\u672a\u8fbe\u5230 ${formatPercent(floorEvaluation.profitFloorRate)}\uff0c\u4e14\u5229\u6da6\u503c\u672a\u8fbe\u5230 ${formatCentAmount(floorEvaluation.profitFloorValueAmount)}\u5143`;
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

  function buildActivityProductFilterReasonText(detail, result, baseReason) {
    const reason = normalizeText(baseReason);
    const metricParts = [];
    const suggestActivityPrice = normalizeOptionalNumber(detail && detail.suggestActivityPrice);
    const currency = normalizeText(detail && detail.currency);
    const submitPriceText = normalizeText(result && result.submitPriceText);
    const profitRateText = normalizeText(result && result.profitRateText);
    const profitValueText = normalizeText(result && result.profitValueText);

    if (submitPriceText && submitPriceText !== '\u2014') {
      metricParts.push(`\u63d0\u4ea4\u6d3b\u52a8\u4ef7 ${submitPriceText}`);
    }

    if (profitRateText && profitRateText !== '\u2014') {
      metricParts.push(`\u5229\u6da6\u7387 ${profitRateText}`);
    }

    if (profitValueText && profitValueText !== '\u2014') {
      metricParts.push(`\u5229\u6da6\u503c ${profitValueText}`);
    }

    if (suggestActivityPrice !== null && suggestActivityPrice > 0) {
      metricParts.push(`\u5efa\u8bae\u6d3b\u52a8\u4ef7 ${formatPriceRange(suggestActivityPrice, suggestActivityPrice, currency)}`);
    }

    if (metricParts.length <= 0) {
      return reason;
    }

    return [metricParts.join('\uff0c'), reason].filter(Boolean).join('\uff1b');
  }

  function buildActivityProductSkuDecisionLabel(detail) {
    const skuPropertiesText = normalizeText(buildActivityDetailSpecText(detail));
    const skuExtCode = normalizeText(detail && detail.skuExtCode);
    const skuId = normalizeText(detail && detail.skuId);

    if (skuPropertiesText) {
      return skuPropertiesText;
    }

    if (skuExtCode) {
      return skuExtCode;
    }

    if (skuId) {
      return `SKU ${skuId}`;
    }

    return '\u672a\u547d\u540dSKU';
  }

  function formatActivityProductPercentRange(values) {
    const numericValues = (Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (numericValues.length <= 0) {
      return '\u2014';
    }

    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    return minValue === maxValue
      ? formatPercent(minValue)
      : `${formatPercent(minValue)} - ${formatPercent(maxValue)}`;
  }

  function buildActivityProductRowRuleSummaryText(settings) {
    if (!settings || typeof settings !== 'object') {
      return '';
    }

    return `\u89c4\u5219 ${formatActivityProductFilterRule(settings)} \u00b7 \u4fdd\u5e95 ${formatActivityProductProfitFloorRule(settings)}`;
  }

  function buildActivityProductRowSignupReason(nextSkuDetails, status, settings) {
    const skuDetails = Array.isArray(nextSkuDetails) ? nextSkuDetails : [];
    const eligibleDetails = skuDetails.filter((detail) => normalizeText(detail && detail.activitySignupStatus) === 'eligible');
    const skippedDetails = skuDetails.filter((detail) => normalizeText(detail && detail.activitySignupStatus) !== 'eligible');
    const currency = normalizeText((eligibleDetails[0] || skippedDetails[0] || {}).currency);
    const ruleSummaryText = buildActivityProductRowRuleSummaryText(settings);

    if (status === 'eligible') {
      const submitPrices = eligibleDetails
        .map((detail) => normalizeOptionalNumber(detail && detail.activitySubmitPrice))
        .filter((value) => value !== null && value > 0);
      const profitRates = eligibleDetails
        .map((detail) => normalizeOptionalNumber(detail && detail.activitySubmitProfitRate))
        .filter((value) => value !== null);
      const profitValues = eligibleDetails
        .map((detail) => normalizeOptionalNumber(detail && detail.activitySubmitProfitValue))
        .filter((value) => value !== null);
      const adjustedCount = eligibleDetails.filter((detail) => detail && detail.activitySubmitAdjustedToProfitFloor === true).length;
      const adjustedBasisLabels = Array.from(new Set(
        eligibleDetails
          .filter((detail) => detail && detail.activitySubmitAdjustedToProfitFloor === true)
          .map((detail) => normalizeText(detail && detail.activitySubmitAdjustedToProfitFloorBasisText))
          .filter(Boolean)
      ));
      const summaryParts = [];
      const profitSummaryParts = [];

      if (profitRates.length > 0) {
        profitSummaryParts.push(`\u5229\u6da6\u7387 ${formatActivityProductPercentRange(profitRates)}`);
      }

      if (profitValues.length > 0) {
        profitSummaryParts.push(`\u5229\u6da6\u503c ${formatPriceRange(Math.min(...profitValues), Math.max(...profitValues), currency)}`);
      }

      if (profitSummaryParts.length > 0) {
        summaryParts.push(profitSummaryParts.join('\uff0c'));
      }

      if (ruleSummaryText) {
        summaryParts.push(ruleSummaryText);
      }

      if (submitPrices.length > 0) {
        summaryParts.push(`\u63d0\u4ea4\u6d3b\u52a8\u4ef7 ${formatPriceRange(Math.min(...submitPrices), Math.max(...submitPrices), currency)}`);
      }

      if (adjustedCount > 0) {
        summaryParts.push(
          adjustedBasisLabels.length === 1
            ? `${formatInteger(adjustedCount, '0')} \u6761SKU\u5df2\u6309${adjustedBasisLabels[0]}\u63d0\u4ea4`
            : `${formatInteger(adjustedCount, '0')} \u6761SKU\u5df2\u6309\u4fdd\u5e95\u4ef7\u63d0\u4ea4`
        );
      }

      summaryParts.push(`SKU\u5168\u90e8\u53ef\u62a5\u540d\uff0c\u5171 ${formatInteger(eligibleDetails.length, '0')} \u6761`);
      return summaryParts.filter(Boolean).join('\uff1b');
    }

    const skippedExamples = skippedDetails
      .slice(0, 2)
      .map((detail) => `${buildActivityProductSkuDecisionLabel(detail)}\uff1a${normalizeText(detail && detail.activitySignupReason) || '\u4e0d\u7b26\u5408\u62a5\u540d\u6761\u4ef6'}`);
    const remainingSkippedCount = Math.max(0, skippedDetails.length - skippedExamples.length);
    const eligibleProfitRates = eligibleDetails
      .map((detail) => normalizeOptionalNumber(detail && detail.activitySubmitProfitRate))
      .filter((value) => value !== null);
    const eligibleProfitValues = eligibleDetails
      .map((detail) => normalizeOptionalNumber(detail && detail.activitySubmitProfitValue))
      .filter((value) => value !== null);
    const eligibleProfitSummaryParts = [];
    const summaryParts = [];

    if (eligibleProfitRates.length > 0) {
      eligibleProfitSummaryParts.push(`\u5229\u6da6\u7387 ${formatActivityProductPercentRange(eligibleProfitRates)}`);
    }

    if (eligibleProfitValues.length > 0) {
      eligibleProfitSummaryParts.push(`\u5229\u6da6\u503c ${formatPriceRange(Math.min(...eligibleProfitValues), Math.max(...eligibleProfitValues), currency)}`);
    }

    if (eligibleProfitSummaryParts.length > 0) {
      summaryParts.push(eligibleProfitSummaryParts.join('\uff0c'));
    }

    if (ruleSummaryText) {
      summaryParts.push(ruleSummaryText);
    }

    summaryParts.push(`\u5171 ${formatInteger(skuDetails.length, '0')} \u6761SKU\uff0c\u53ef\u62a5\u540d ${formatInteger(eligibleDetails.length, '0')} \u6761\uff0c\u4e0d\u7b26\u5408 ${formatInteger(skippedDetails.length, '0')} \u6761`);

    if (skippedExamples.length > 0) {
      summaryParts.push(skippedExamples.join('\uff1b'));
    }

    if (remainingSkippedCount > 0) {
      summaryParts.push(`\u5176\u4f59 ${formatInteger(remainingSkippedCount, '0')} \u6761\u8bf7\u67e5\u770bSKU\u660e\u7ec6`);
    }

    return summaryParts.filter(Boolean).join('\uff1b');
  }

  function isGenericActivityProductSignupReason(reason) {
    const normalizedReason = normalizeText(reason);

    return !normalizedReason || [
      '\u4e0d\u7b26\u5408\u62a5\u540d\u6761\u4ef6',
      '\u5b58\u5728\u4e0d\u53ef\u62a5\u540dSKU'
    ].includes(normalizedReason);
  }

  function resolveActivityProductRowSignupReason(row, status, fallbackReason, settings) {
    const normalizedStatus = normalizeText(status);
    const normalizedReason = normalizeText(fallbackReason);
    const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];
    const computedReason = skuDetails.length > 0
      ? buildActivityProductRowSignupReason(skuDetails, normalizedStatus, settings)
      : '';

    if (normalizedStatus === 'skip') {
      if (isGenericActivityProductSignupReason(normalizedReason)) {
        return computedReason || normalizedReason;
      }

      return normalizedReason || computedReason;
    }

    return normalizedReason || computedReason;
  }

  function normalizeActivityProductCostAmount(costPrice) {
    const numericCostPrice = normalizeOptionalNumber(costPrice);

    if (numericCostPrice === null || numericCostPrice <= 0) {
      return null;
    }

    return Math.max(1, Math.round(numericCostPrice * 100));
  }

  function buildActivityProductFilterStateKey(row) {
    return buildActivityBatchProductRowKey(row) || normalizeText(row && row.productId);
  }

  function computeActivityProductFilterSkuResult(detail, settings) {
    const normalizedSettings = normalizeActivityProductFilterSettings(settings);
    const mode = normalizeActivityProductFilterMode(normalizedSettings.mode);
    const modeValue = normalizeOptionalNumber(resolveActivityProductFilterModeValue(normalizedSettings, mode));
    const dailyPrice = normalizeOptionalNumber(detail && detail.dailyPrice);
    const suggestActivityPrice = normalizeOptionalNumber(detail && detail.suggestActivityPrice);
    const costPrice = normalizeOptionalNumber(detail && detail.costPrice);
    const costAmount = normalizeActivityProductCostAmount(costPrice);
    const result = {
      status: 'skip',
      statusText: '\u8df3\u8fc7',
      submitPrice: null,
      submitPriceText: '\u2014',
      profitRate: null,
      profitRateText: '\u2014',
      profitValue: null,
      profitValueText: '\u2014',
      adjustedToProfitFloor: false,
      adjustedToProfitFloorBasis: '',
      adjustedToProfitFloorBasisText: '',
      reason: '',
      hasCostPrice: costAmount !== null && costAmount > 0
    };

    if (!result.hasCostPrice) {
      result.reason = '\u672a\u5339\u914d\u6210\u672c\u4ef7\uff0c\u65e0\u6cd5\u8ba1\u7b97\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u548c\u5229\u6da6';
      return result;
    }

    let submitPrice = Number.NaN;

    if (mode === 'suggestActivityPrice') {
      if (suggestActivityPrice === null || suggestActivityPrice <= 0) {
        result.reason = '\u7f3a\u5c11\u5efa\u8bae\u6d3b\u52a8\u4ef7';
        return result;
      }

      submitPrice = suggestActivityPrice;
    } else if (mode === 'dailyDiscount') {
      if (dailyPrice === null || dailyPrice <= 0) {
        result.reason = '\u7f3a\u5c11\u65e5\u5e38\u4ef7';
        return result;
      }

      if (modeValue === null || modeValue <= 0) {
        result.reason = '\u672a\u8bbe\u7f6e\u65e5\u5e38\u4ef7\u6298\u6263';
        return result;
      }

      submitPrice = Number((dailyPrice * (modeValue / 10)).toFixed(2));
    } else if (mode === 'profitRateDiscount') {
      if (modeValue === null || modeValue <= 0) {
        result.reason = '\u672a\u8bbe\u7f6e\u6210\u672c\u5229\u6da6\u7387';
        return result;
      }

      const targetProfitRate = Number(modeValue.toFixed(4));
      const multiplier = 1 + (targetProfitRate / 100);

      if (!Number.isFinite(multiplier) || multiplier <= 0) {
        result.reason = '\u6210\u672c\u5229\u6da6\u7387\u65e0\u6548';
        return result;
      }

      submitPrice = Number((costAmount * multiplier).toFixed(2));
    } else if (mode === 'saleProfitRate') {
      if (modeValue === null || modeValue <= 0) {
        result.reason = '\u672a\u8bbe\u7f6e\u552e\u4ef7\u5229\u6da6\u7387';
        return result;
      }

      submitPrice = computeActivityProductRequiredPriceForProfitRate(costAmount, modeValue);

      if (!Number.isFinite(submitPrice) || submitPrice <= 0) {
        result.reason = '\u552e\u4ef7\u5229\u6da6\u7387\u65e0\u6548';
        return result;
      }
    } else if (mode === 'dailyReduce') {
      if (dailyPrice === null || dailyPrice <= 0) {
        result.reason = '\u7f3a\u5c11\u65e5\u5e38\u4ef7';
        return result;
      }

      if (modeValue === null || modeValue <= 0) {
        result.reason = '\u672a\u8bbe\u7f6e\u65e5\u5e38\u4ef7\u51cf\u5c11';
        return result;
      }

      const reduceAmount = Math.max(1, Math.round(modeValue * 100));
      submitPrice = dailyPrice - reduceAmount;
    } else {
      if (modeValue === null || modeValue <= 0) {
        result.reason = '\u672a\u8bbe\u7f6e\u6210\u672c\u4ef7\u52a0\u4ef7\u91d1\u989d';
        return result;
      }

      submitPrice = costAmount + Math.max(1, Math.round(modeValue * 100));
    }

    if (!Number.isFinite(submitPrice) || submitPrice <= 0) {
      result.reason = '\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u65e0\u6548';
      return result;
    }

    if (suggestActivityPrice === null || suggestActivityPrice <= 0) {
      result.reason = '\u7f3a\u5c11\u5efa\u8bae\u6d3b\u52a8\u4ef7';
      return result;
    }

    const roundedSuggestActivityPrice = Math.max(1, Math.round(suggestActivityPrice));
    let finalSubmitPrice = Math.max(1, Math.round(submitPrice));
    let floorEvaluation = evaluateActivityProductProfitFloor(finalSubmitPrice, costAmount, normalizedSettings);
    let readyReason = '';
    let failureReason = '';

    if (!Number.isFinite(floorEvaluation.profitRate)) {
      result.reason = '\u65e0\u6cd5\u8ba1\u7b97\u5229\u6da6\u7387';
      return result;
    }

    if (!Number.isFinite(floorEvaluation.profitValue)) {
      result.reason = '\u65e0\u6cd5\u8ba1\u7b97\u5229\u6da6\u503c';
      return result;
    }

    if (floorEvaluation.meetsFloor === true && finalSubmitPrice <= roundedSuggestActivityPrice) {
      readyReason = '\u53ef\u76f4\u63a5\u901a\u8fc7';
    } else {
      finalSubmitPrice = roundedSuggestActivityPrice;
      floorEvaluation = evaluateActivityProductProfitFloor(finalSubmitPrice, costAmount, normalizedSettings);

      if (floorEvaluation.meetsFloor === true) {
        readyReason = '\u5df2\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u63d0\u4ea4';
      } else {
        const submitFloorBasisLabel = formatActivityProductSubmitFloorBasisLabel(
          floorEvaluation.submitFloorBasisActive || floorEvaluation.submitAtProfitFloorBasis
        );
        const suggestCandidateFailReason = buildActivityProductProfitFloorFailReason(floorEvaluation);
        const canSubmitAtProfitFloor = floorEvaluation.submitAtProfitFloor === true
          && Number.isFinite(floorEvaluation.submitFloorRequiredPrice)
          && Boolean(submitFloorBasisLabel);

        if (!canSubmitAtProfitFloor) {
          failureReason = `\u6309\u5efa\u8bae\u6d3b\u52a8\u4ef7\u6821\u9a8c\u540e\uff0c${suggestCandidateFailReason}`;
        } else {
          const submitFloorPrice = Math.max(1, Math.round(floorEvaluation.submitFloorRequiredPrice));

          result.adjustedToProfitFloorBasis = floorEvaluation.submitFloorBasisActive || '';
          result.adjustedToProfitFloorBasisText = submitFloorBasisLabel;

          if (submitFloorPrice > roundedSuggestActivityPrice) {
            failureReason = `\u6309${submitFloorBasisLabel}\u63d0\u4ea4\u9700 ${formatPriceRange(submitFloorPrice, submitFloorPrice, normalizeText(detail && detail.currency))}\uff0c\u4f46\u5df2\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7\u4e0a\u9650`;
          } else {
            if (submitFloorPrice !== finalSubmitPrice) {
              result.adjustedToProfitFloor = true;
            }

            finalSubmitPrice = submitFloorPrice;
            floorEvaluation = evaluateActivityProductProfitFloor(finalSubmitPrice, costAmount, normalizedSettings);

            if (floorEvaluation.meetsFloor === true) {
              readyReason = `\u5df2\u6309${submitFloorBasisLabel}\u62ac\u9ad8\u5230\u53ef\u63d0\u4ea4\u4ef7`;
            } else {
              failureReason = `\u6309${submitFloorBasisLabel}\u63d0\u4ea4\u540e\uff0c${buildActivityProductProfitFloorFailReason(floorEvaluation)}`;
            }
          }
        }
      }
    }

    result.submitPrice = finalSubmitPrice;
    if (!result.adjustedToProfitFloorBasis) {
      result.adjustedToProfitFloorBasis = floorEvaluation.submitFloorBasisActive || floorEvaluation.submitAtProfitFloorBasis || '';
    }
    if (!result.adjustedToProfitFloorBasisText) {
      result.adjustedToProfitFloorBasisText = formatActivityProductSubmitFloorBasisLabel(result.adjustedToProfitFloorBasis);
    }
    result.submitPriceText = formatPriceRange(finalSubmitPrice, finalSubmitPrice, normalizeText(detail && detail.currency));
    result.profitRate = Number(floorEvaluation.profitRate.toFixed(2));
    result.profitRateText = formatPercent(result.profitRate);
    result.profitValue = Math.round(floorEvaluation.profitValue);
    result.profitValueText = formatPriceRange(result.profitValue, result.profitValue, normalizeText(detail && detail.currency));

    if (floorEvaluation.meetsFloor !== true) {
      result.reason = buildActivityProductFilterReasonText(
        detail,
        result,
        failureReason || buildActivityProductProfitFloorFailReason(floorEvaluation)
      );
      return result;
    }

    result.status = 'eligible';
    result.statusText = '\u53ef\u62a5\u540d';
    result.reason = buildActivityProductFilterReasonText(
      detail,
      result,
      readyReason || (
        result.adjustedToProfitFloor === true
          ? `\u6ee1\u8db3\u62a5\u540d\u89c4\u5219\uff0c\u5df2\u6309${result.adjustedToProfitFloorBasisText}\u63d0\u4ea4`
          : '\u6ee1\u8db3\u62a5\u540d\u89c4\u5219'
      )
    );
    return result;
  }

  function applyActivityProductFilterToSingleRow(row, settings, summary, resultMap) {
    const rowKey = buildActivityProductFilterStateKey(row);
    const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];
    const nextSkuDetails = skuDetails.map((detail) => {
      const filterResult = computeActivityProductFilterSkuResult(detail, settings);
      summary.totalSkuCount += 1;

      if (filterResult.status === 'eligible') {
        summary.eligibleSkuCount += 1;
      } else {
        summary.skippedSkuCount += 1;
      }

      return {
        ...detail,
        activitySignupStatus: filterResult.status,
        activitySignupStatusText: filterResult.statusText,
        activitySignupReason: filterResult.reason,
        activitySubmitPrice: filterResult.submitPrice,
        activitySubmitPriceText: filterResult.submitPriceText,
        activitySubmitProfitRate: filterResult.profitRate,
        activitySubmitProfitRateText: filterResult.profitRateText,
        activitySubmitProfitValue: filterResult.profitValue,
        activitySubmitProfitValueText: filterResult.profitValueText,
        activitySubmitAdjustedToProfitFloor: filterResult.adjustedToProfitFloor === true,
        activitySubmitAdjustedToProfitFloorBasis: filterResult.adjustedToProfitFloorBasis,
        activitySubmitAdjustedToProfitFloorBasisText: filterResult.adjustedToProfitFloorBasisText
      };
    });
    const hasIneligibleSku = nextSkuDetails.some((detail) => normalizeText(detail && detail.activitySignupStatus) !== 'eligible');
    const eligibleSkuCount = nextSkuDetails.filter((detail) => normalizeText(detail && detail.activitySignupStatus) === 'eligible').length;
    const status = nextSkuDetails.length > 0 && !hasIneligibleSku ? 'eligible' : 'skip';
    const reason = buildActivityProductRowSignupReason(nextSkuDetails, status, settings)
      || (status === 'eligible'
        ? `SKU\u5168\u90e8\u53ef\u62a5\u540d\uff0c\u5171 ${formatInteger(eligibleSkuCount, '0')} \u6761`
        : '\u5b58\u5728\u4e0d\u53ef\u62a5\u540dSKU');

    summary.totalProductCount += 1;
    if (status === 'eligible') {
      summary.eligibleProductCount += 1;
    } else {
      summary.skippedProductCount += 1;
    }

    const nextRow = {
      ...row,
      skuDetails: nextSkuDetails,
      activitySignupStatus: status,
      activitySignupStatusText: status === 'eligible' ? '\u53ef\u62a5\u540d' : '\u4e0d\u53c2\u52a0',
      activitySignupReason: reason
    };

    if (rowKey) {
      resultMap[rowKey] = {
        status,
        statusText: nextRow.activitySignupStatusText,
        reason
      };
    }

    return nextRow;
  }

  function applyActivityProductFilterToRows(rows, settings) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const summary = buildEmptyActivityProductFilterSummary();
    const resultMap = Object.create(null);
    const nextRows = normalizedRows.map((row) => applyActivityProductFilterToSingleRow(row, settings, summary, resultMap));

    return {
      rows: nextRows,
      summary,
      resultMap
    };
  }

  function waitForNextRenderFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  }

  async function applyActivityProductFilterToRowsProgressive(rows, settings, options = {}) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const summary = buildEmptyActivityProductFilterSummary();
    const resultMap = Object.create(null);
    const nextRows = [];
    const chunkSize = Math.max(10, normalizeNonNegativeInteger(options.chunkSize, 40));
    const totalSkuCount = normalizedRows.reduce((count, row) => (
      count + (Array.isArray(row && row.skuDetails) ? row.skuDetails.length : 0)
    ), 0);
    const progress = buildEmptyActivityProductFilterProgress();

    progress.totalProductCount = normalizedRows.length;
    progress.totalSkuCount = totalSkuCount;

    for (let index = 0; index < normalizedRows.length; index += chunkSize) {
      if (typeof options.shouldStop === 'function' && options.shouldStop() === true) {
        throw buildActivityBackgroundStoppedError();
      }

      const rowSlice = normalizedRows.slice(index, index + chunkSize);

      rowSlice.forEach((row) => {
        nextRows.push(applyActivityProductFilterToSingleRow(row, settings, summary, resultMap));
      });

      progress.processedProductCount = nextRows.length;
      progress.processedSkuCount = summary.totalSkuCount;
      progress.updatedAt = new Date().toISOString();

      if (typeof options.onProgress === 'function') {
        options.onProgress({
          ...progress,
          summary: {
            ...summary
          }
        });
      }

      if (nextRows.length < normalizedRows.length) {
        await waitForNextRenderFrame();
      }
    }

    return {
      rows: nextRows,
      summary,
      resultMap,
      progress
    };
  }

  function normalizeActivityProductBatchProgressRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const phase = normalizeText(source.phase);
    const taskType = normalizeText(source.taskType) || (phase.startsWith('signup-') ? 'submit' : 'query');

    return {
      success: source.success === true,
      updatedAt: normalizeText(source.updatedAt),
      taskType,
      requestId: normalizeText(source.requestId),
      phase,
      totalInputRowCount: normalizeNonNegativeInteger(source.totalInputRowCount, 0),
      submittedRowCount: normalizeNonNegativeInteger(source.submittedRowCount, 0),
      skippedRowCount: normalizeNonNegativeInteger(source.skippedRowCount, 0),
      totalActivityCount: normalizeNonNegativeInteger(source.totalActivityCount, 0),
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, 0),
      currentActivityIndex: normalizeNonNegativeInteger(source.currentActivityIndex, 0),
      currentActivityName: normalizeText(source.currentActivityName),
      currentActivityKey: normalizeText(source.currentActivityKey),
      totalGroupCount: normalizeNonNegativeInteger(source.totalGroupCount, 0),
      currentGroupIndex: normalizeNonNegativeInteger(source.currentGroupIndex, 0),
      currentGroupCount: normalizeNonNegativeInteger(source.currentGroupCount, 0),
      completedShopCount: normalizeNonNegativeInteger(source.completedShopCount, 0),
      failedShopCount: normalizeNonNegativeInteger(source.failedShopCount, 0),
      currentShopIndex: normalizeNonNegativeInteger(source.currentShopIndex, 0),
      currentShopName: normalizeText(source.currentShopName),
      currentPageIndex: normalizeNonNegativeInteger(source.currentPageIndex, 0),
      currentPageCount: normalizeNonNegativeInteger(source.currentPageCount, 0),
      currentChunkIndex: normalizeNonNegativeInteger(source.currentChunkIndex, 0),
      currentChunkCount: normalizeNonNegativeInteger(source.currentChunkCount, 0),
      currentChunkRowCount: normalizeNonNegativeInteger(source.currentChunkRowCount, 0),
      currentActivityRawProductCount: normalizeNonNegativeInteger(source.currentActivityRawProductCount, 0),
      currentActivityUniqueProductCount: normalizeNonNegativeInteger(source.currentActivityUniqueProductCount, 0),
      totalRawProductCount: normalizeNonNegativeInteger(source.totalRawProductCount, 0),
      totalUniqueProductCount: normalizeNonNegativeInteger(source.totalUniqueProductCount, 0),
      currentActivityDoneCount: normalizeNonNegativeInteger(source.currentActivityDoneCount, 0),
      totalActivitySuccessCount: normalizeNonNegativeInteger(source.totalActivitySuccessCount, 0),
      totalActivityFailedCount: normalizeNonNegativeInteger(source.totalActivityFailedCount, 0),
      successRowCount: normalizeNonNegativeInteger(source.successRowCount, 0),
      failedRowCount: normalizeNonNegativeInteger(source.failedRowCount, 0),
      totalRequestCount: normalizeNonNegativeInteger(source.totalRequestCount, 0),
      completedRequestCount: normalizeNonNegativeInteger(source.completedRequestCount, 0),
      failedRequestCount: normalizeNonNegativeInteger(source.failedRequestCount, 0),
      message: normalizeText(source.message)
    };
  }

  function normalizeActivityProductBatchQueryResponse(response) {
    const source = response && typeof response === 'object' ? response : {};

    return {
      success: source.success === true,
      updatedAt: normalizeText(source.updatedAt),
      cacheKey: normalizeText(source.cacheKey),
      requestId: normalizeText(source.requestId),
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, 0),
      totalActivityCount: normalizeNonNegativeInteger(source.totalActivityCount, 0),
      successActivityCount: normalizeNonNegativeInteger(source.successActivityCount, 0),
      failedActivityCount: normalizeNonNegativeInteger(source.failedActivityCount, 0),
      uniqueProductCount: normalizeNonNegativeInteger(source.uniqueProductCount, 0),
      cachedRowCount: normalizeNonNegativeInteger(
        source.cachedRowCount,
        normalizeNonNegativeInteger(source.uniqueProductCount, 0)
      ),
      pageIndex: Math.max(1, normalizeNonNegativeInteger(source.pageIndex, 1)),
      pageSize: normalizeProductTablePageSize(source.pageSize),
      pageCount: Math.max(1, normalizeNonNegativeInteger(source.pageCount, 1)),
      rows: Array.isArray(source.rows)
        ? source.rows.map(normalizeActivityProductRowRecord).filter((row) => Boolean(row.productId))
        : [],
      quickCostEntries: normalizeActivityQuickCostEntryList(source.quickCostEntries),
      activityResults: Array.isArray(source.activityResults)
        ? source.activityResults.map(normalizeActivityProductBatchResultRecord)
        : [],
      filterShopId: normalizeText(source.filterShopId),
      filterActivityKey: normalizeText(source.filterActivityKey),
      sortField: ACTIVITY_BATCH_PRODUCT_SORT_FIELDS.has(normalizeText(source.sortField))
        ? normalizeText(source.sortField)
        : '',
      sortDirection: normalizeText(source.sortDirection).toLowerCase() === 'desc'
        ? 'desc'
        : (normalizeText(source.sortDirection).toLowerCase() === 'asc' ? 'asc' : ''),
      warning: normalizeText(source.warning)
    };
  }

  function normalizeActivityBatchProductSortField(value) {
    const normalizedValue = normalizeText(value);
    return ACTIVITY_BATCH_PRODUCT_SORT_FIELDS.has(normalizedValue) ? normalizedValue : '';
  }

  function normalizeActivityBatchProductSortDirection(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return normalizedValue === 'asc' || normalizedValue === 'desc'
      ? normalizedValue
      : '';
  }

  function resolveDefaultActivityBatchProductSortDirection(sortField) {
    const normalizedSortField = normalizeActivityBatchProductSortField(sortField);

    if (
      normalizedSortField === 'suggestActivityStock'
      || normalizedSortField === 'salesStock'
      || normalizedSortField === 'canEnrollSessionCount'
      || normalizedSortField === 'suggestActivityPrice'
      || normalizedSortField === 'dailyPrice'
    ) {
      return 'desc';
    }

    return 'asc';
  }

  function toggleActivityBatchProductSortState(productState, sortField) {
    const normalizedSortField = normalizeActivityBatchProductSortField(sortField);

    if (!normalizedSortField) {
      return;
    }

    const currentSortField = normalizeActivityBatchProductSortField(productState && productState.sortField);
    const currentSortDirection = normalizeActivityBatchProductSortDirection(productState && productState.sortDirection);

    if (currentSortField !== normalizedSortField) {
      productState.sortField = normalizedSortField;
      productState.sortDirection = resolveDefaultActivityBatchProductSortDirection(normalizedSortField);
      return;
    }

    productState.sortField = normalizedSortField;
    productState.sortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  }

  function buildActivityBatchProductShopOptions(state) {
    const rows = Array.isArray(state && state.submittedActivityRows) ? state.submittedActivityRows : [];
    const optionMap = new Map();

    rows.forEach((row) => {
      const shopIds = normalizeTextArray(row && row.availableShopIds);
      const shopNames = normalizeTextArray(row && row.availableShopNames);
      const maxCount = Math.max(shopIds.length, shopNames.length);

      for (let index = 0; index < maxCount; index += 1) {
        const shopId = normalizeText(shopIds[index]);
        const shopName = normalizeText(shopNames[index]) || shopId;
        const optionKey = shopId || shopName;

        if (!optionKey) {
          continue;
        }

        if (!optionMap.has(optionKey)) {
          optionMap.set(optionKey, {
            shopId,
            shopName
          });
        }
      }
    });

    return Array.from(optionMap.values()).sort((left, right) => (
      normalizeText(left && left.shopName).localeCompare(normalizeText(right && right.shopName), 'zh-CN')
    ));
  }

  function buildActivityBatchProductActivityOptions(state) {
    const rows = Array.isArray(state && state.submittedActivityRows) ? state.submittedActivityRows : [];

    return rows
      .map((row) => ({
        activityKey: normalizeText(row && row.activityKey),
        activityName: buildActivityMatchDisplayName(row)
      }))
      .filter((option) => option.activityKey && option.activityName)
      .sort((left, right) => normalizeText(left.activityName).localeCompare(normalizeText(right.activityName), 'zh-CN'));
  }

  function getActivityProductTablePaginationState(productState) {
    const pageSize = normalizeProductTablePageSize(productState && productState.tablePageSize);
    const totalRows = Math.max(
      0,
      normalizeNonNegativeInteger(
        productState && productState.cachedRowCount,
        normalizeNonNegativeInteger(productState && productState.uniqueProductCount, 0)
      )
    );
    const fallbackPageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    const totalPages = Math.max(
      1,
      normalizeNonNegativeInteger(productState && productState.pageCount, fallbackPageCount)
    );
    const page = Math.min(
      totalPages,
      Math.max(
        1,
        normalizeNonNegativeInteger(
          productState && productState.tablePage,
          normalizeNonNegativeInteger(productState && productState.pageIndex, 1)
        )
      )
    );

    return {
      totalRows,
      pageSize,
      totalPages,
      page
    };
  }

  function clearSubmittedActivityState(state) {
    state.submittedActivityKeys = [];
    state.submittedActivityRows = [];
    state.activeSubmittedActivityKey = '';
    state.activityProductStateByKey = Object.create(null);
    state.activityProductBatchState = buildEmptyActivityProductBatchState();
    state.activityBackgroundSubmitState = buildEmptyActivityBackgroundSubmitState();
  }

  function getActivityProductState(state, activityKey) {
    const normalizedActivityKey = normalizeText(activityKey);

    if (!normalizedActivityKey) {
      return buildEmptyActivityProductQueryState();
    }

    if (!state.activityProductStateByKey || typeof state.activityProductStateByKey !== 'object') {
      state.activityProductStateByKey = Object.create(null);
    }

    if (!state.activityProductStateByKey[normalizedActivityKey]) {
      state.activityProductStateByKey[normalizedActivityKey] = buildEmptyActivityProductQueryState();
    }

    return state.activityProductStateByKey[normalizedActivityKey];
  }

  function findActivityRowByKey(rows, activityKey) {
    const normalizedActivityKey = normalizeText(activityKey);
    return (Array.isArray(rows) ? rows : []).find((row) => normalizeText(row && row.activityKey) === normalizedActivityKey) || null;
  }

  function buildSubmittedActivityRows(state) {
    const selectedActivityKeySet = new Set(normalizeActivitySelectedKeys(state.activitySelectedKeys));

    return buildSortedActivityRows(state.activityQueryRows, state)
      .filter((row) => selectedActivityKeySet.has(normalizeText(row && row.activityKey)))
      .map((row) => normalizeActivityRowRecord(row));
  }

  function buildSubmittedActivityBatchQueryActivities(state) {
    return Array.isArray(state && state.submittedActivityRows)
      ? state.submittedActivityRows
        .map((row) => ({
          activityKey: normalizeText(row && row.activityKey),
          activityType: normalizeOptionalNumber(row && row.activityType),
          activityThematicId: normalizeText(row && row.activityThematicId),
          activityThematicName: normalizeText(row && row.activityThematicName),
          activityName: normalizeText(row && row.activityName),
          shopIds: buildActivityProductQueryShopIds(state, row)
        }))
        .filter((row) => row.activityKey && row.activityType !== null)
      : [];
  }

  function buildActivityProductQueryShopIds(state, activityRow, options = {}) {
    const normalizedActivityRow = activityRow && typeof activityRow === 'object' ? activityRow : {};

    const selectedShopIdSet = new Set(normalizeSelectedShopIds(state.signupSelectedShopIds));
    const availableShopIds = normalizeTextArray(normalizedActivityRow.availableShopIds);
    const filteredShopIds = availableShopIds.filter((shopId) => selectedShopIdSet.size <= 0 || selectedShopIdSet.has(shopId));

    return filteredShopIds.length > 0 ? filteredShopIds : availableShopIds;
  }

  function normalizePresetShopSelection(state, selectedShopIds) {
    const normalizedSelectedShopIds = normalizeSelectedShopIds(selectedShopIds);

    if (state.shopSelectorLoaded !== true || !state.shopCatalog || !state.shopCatalog.shopMap) {
      return normalizedSelectedShopIds;
    }

    return normalizedSelectedShopIds.filter((shopId) => Boolean(state.shopCatalog.shopMap[shopId]));
  }

  function createState() {
    return {
      activeTabId: getDefaultTabId(),
      workflowStep: 'activity',
      signupSelectedShopIds: [],
      shopSelectionPreset: createShopSelectionPresetState(),
      shopSelectionTouched: false,
      shopSelectionPreferenceLoaded: false,
      shopSelectionPreferenceLoading: false,
      shopSelectionPreferencePromise: null,
      shopCatalog: buildEmptyShopCatalog(),
      shopSelectorOpen: false,
      shopSelectorKeyword: '',
      shopSelectorFocusSearch: false,
      shopSelectorLoading: false,
      shopSelectorLoaded: false,
      shopSelectorError: '',
      shopSelectorPromise: null,
      activityQueryLoading: false,
      activityQueryRequestId: 0,
      activityQueryPromise: null,
      activityQueryStatusKind: 'idle',
      activityQueryStatusMessage: '',
      activityQueryUpdatedAt: '',
      activityQueryRows: [],
      activityQueryThemeTypeOptions: [],
      activitySelectedKeys: [],
      activitySortField: '',
      activitySortDirection: '',
      activityFilterLoaded: false,
      activityFilterLoading: false,
      activityFilterSaving: false,
      activityFilterPromise: null,
      activityFilterDialogOpen: false,
      activityFilterWarning: '',
      activityFilterNotice: '',
      activityFilterMinDiscountRate: '',
      activityFilterMinEnrollRemainingDays: '',
      activityFilterMaxEnrollRemainingDays: '',
      activityFilterMinActivityRemainingDays: '',
      activityFilterMaxActivityRemainingDays: '',
      activityFilterThemeTypes: [],
      activityFilterDraftMinDiscountRate: '',
      activityFilterDraftMinEnrollRemainingDays: '',
      activityFilterDraftMaxEnrollRemainingDays: '',
      activityFilterDraftMinActivityRemainingDays: '',
      activityFilterDraftMaxActivityRemainingDays: '',
      activityFilterDraftThemeTypes: [],
      activityQueryShopResults: [],
      activityQuerySummary: buildEmptyActivityQuerySummary(),
      submittedActivityKeys: [],
      submittedActivityRows: [],
      activeSubmittedActivityKey: '',
      activityProductStateByKey: Object.create(null),
      activityProductBatchState: buildEmptyActivityProductBatchState(),
      activityBackgroundSubmitState: buildEmptyActivityBackgroundSubmitState()
    };
  }

  function getState(container) {
    if (!container.__operationsActivityManagementState) {
      container.__operationsActivityManagementState = createState();
    }

    return container.__operationsActivityManagementState;
  }

  function createController(container) {
    const keepAliveHelper = window.moduleKeepAlive || window.operationsModuleKeepAlive;

    if (keepAliveHelper && typeof keepAliveHelper.createKeepAliveController === 'function') {
      return keepAliveHelper.createKeepAliveController({
        panel: container,
        onActivate() {},
        onDeactivate() {}
      });
    }

    return {
      panel: container,
      activate() {},
      deactivate() {}
    };
  }

  function getDefaultTabId() {
    return TAB_CONFIG[0] ? TAB_CONFIG[0].id : 'signup';
  }

  function normalizeTabId(tabId) {
    const normalizedTabId = String(tabId || '').trim();
    return TAB_CONFIG.some((entry) => entry.id === normalizedTabId)
      ? normalizedTabId
      : getDefaultTabId();
  }

  function getActivityTabConfig(tabId) {
    const normalizedTabId = normalizeTabId(tabId);
    return TAB_CONFIG.find((entry) => entry.id === normalizedTabId) || TAB_CONFIG[0] || null;
  }

  function renderActivityQueryStatus(state) {
    const statusKind = normalizeText(state.activityQueryStatusKind);
    const statusMessage = normalizeText(state.activityQueryStatusMessage);
    const updatedAt = normalizeText(state.activityQueryUpdatedAt);

    if (!statusMessage && statusKind === 'idle') {
      return '';
    }

    const statusClass = statusKind ? ` is-${escapeHtml(statusKind)}` : '';

    return `
      <div class="ops-activity-query-status${statusClass}">
        <span class="ops-activity-query-status-text">${escapeHtml(statusMessage || '\u2014')}</span>
        ${updatedAt ? `<span class="ops-activity-query-status-meta">${escapeHtml(formatDateTime(updatedAt))}</span>` : ''}
      </div>
    `;
  }

  function buildActivityTags(row) {
    const benefitLabels = normalizeTextArray(row && row.benefitLabelName);
    const labelList = Array.isArray(row && row.activityLabelList)
      ? row.activityLabelList
        .map((item) => normalizeText(item && item.value) || normalizeText(item && item.key))
        .filter(Boolean)
      : [];
    const labelDesc = normalizeText(row && row.activityLabelDesc);
    const labelTag = normalizeText(row && row.activityLabelTag);
    const merged = [...benefitLabels, ...labelList];

    if (labelDesc) {
      merged.push(labelDesc);
    }

    if (labelTag) {
      merged.push(`\u6807\u7b7e${labelTag}`);
    }

    return Array.from(new Set(merged.filter(Boolean)));
  }

  function normalizeActivityRowRecord(row) {
    const source = row && typeof row === 'object' ? row : {};
    return {
      activityKey: normalizeText(source.activityKey),
      activityThematicId: normalizeText(source.activityThematicId),
      activityThematicName: normalizeText(source.activityThematicName),
      activityName: normalizeText(source.activityName),
      activityType: normalizeOptionalNumber(source.activityType),
      activityThemeType: normalizeOptionalNumber(source.activityThemeType),
      activityThemeTypeLabel: normalizeText(source.activityThemeTypeLabel),
      activityContent: normalizeText(source.activityContent),
      activityThematicContent: normalizeText(source.activityThematicContent),
      activityLabelDesc: normalizeText(source.activityLabelDesc),
      activityLabelTag: normalizeText(source.activityLabelTag),
      activityLabelList: normalizeLabelList(source.activityLabelList),
      benefitLabelName: normalizeTextArray(source.benefitLabelName),
      discountThreshold: normalizeOptionalNumber(source.discountThreshold),
      stockThreshold: normalizeOptionalNumber(source.stockThreshold),
      durationDays: normalizeOptionalNumber(source.durationDays),
      priority: normalizeOptionalNumber(source.priority),
      enrollStartAt: normalizeOptionalNumber(source.enrollStartAt),
      startTime: normalizeOptionalNumber(source.startTime),
      endTime: normalizeOptionalNumber(source.endTime),
      enrollDeadLine: normalizeOptionalNumber(source.enrollDeadLine),
      enrolledCount: normalizeOptionalNumber(source.enrolledCount),
      sessionAssignType: normalizeOptionalNumber(source.sessionAssignType),
      sessionCount: normalizeNonNegativeInteger(source.sessionCount, 0),
      siteIds: normalizeTextArray(source.siteIds),
      siteNames: normalizeTextArray(source.siteNames),
      availableShopEntries: Array.isArray(source.availableShopEntries)
        ? source.availableShopEntries
          .map((entry) => ({
            shopId: normalizeText(entry && entry.shopId),
            shopName: normalizeText(entry && entry.shopName) || normalizeText(entry && entry.shopId),
            enrolledCount: normalizeOptionalNumber(entry && entry.enrolledCount)
          }))
          .filter((entry) => Boolean(entry.shopId || entry.shopName))
        : [],
      availableShopIds: normalizeTextArray(source.availableShopIds),
      availableShopNames: normalizeTextArray(source.availableShopNames),
      sourceShopCount: normalizeNonNegativeInteger(source.sourceShopCount, 0)
    };
  }

  function buildActivityAvailableShopDisplayEntries(row) {
    const availableShopEntries = Array.isArray(row && row.availableShopEntries)
      ? row.availableShopEntries
      : [];

    if (availableShopEntries.length > 0) {
      return availableShopEntries.map((entry) => ({
        shopId: normalizeText(entry && entry.shopId),
        shopName: normalizeText(entry && entry.shopName) || normalizeText(entry && entry.shopId),
        enrolledCount: normalizeOptionalNumber(entry && entry.enrolledCount)
      })).filter((entry) => Boolean(entry.shopId || entry.shopName));
    }

    const availableShopIds = normalizeTextArray(row && row.availableShopIds);
    const availableShopNames = normalizeTextArray(row && row.availableShopNames);
    const maxCount = Math.max(availableShopIds.length, availableShopNames.length);
    const fallbackEntries = [];

    for (let index = 0; index < maxCount; index += 1) {
      const shopId = normalizeText(availableShopIds[index]);
      const shopName = normalizeText(availableShopNames[index]) || shopId;

      if (!shopId && !shopName) {
        continue;
      }

      fallbackEntries.push({
        shopId,
        shopName,
        enrolledCount: null
      });
    }

    return fallbackEntries;
  }

  function formatActivityAvailableShopLabel(entry) {
    const shopName = normalizeText(entry && entry.shopName) || normalizeText(entry && entry.shopId);
    const enrolledCount = normalizeOptionalNumber(entry && entry.enrolledCount);

    if (!shopName) {
      return '';
    }

    if (enrolledCount === null) {
      return shopName;
    }

    return `${shopName}(\u5df2\u62a5${formatInteger(enrolledCount, '0')})`;
  }

  function normalizeShopResultRecord(record, shopCatalog) {
    const source = record && typeof record === 'object' ? record : {};
    const shopId = normalizeText(source.shopId);
    const catalogShop = shopCatalog && shopCatalog.shopMap && shopCatalog.shopMap[shopId]
      ? shopCatalog.shopMap[shopId]
      : null;

    return {
      shopId,
      shopName: normalizeText(source.shopName) || normalizeText(catalogShop && catalogShop.shopName) || shopId,
      success: source.success === true,
      activityCount: normalizeNonNegativeInteger(source.activityCount, 0),
      message: normalizeText(source.message)
    };
  }

  function normalizeQueryResponse(response, state) {
    const source = response && typeof response === 'object' ? response : {};
    const rows = Array.isArray(source.rows)
      ? source.rows.map(normalizeActivityRowRecord).filter((row) => Boolean(normalizeText(row.activityKey)))
      : [];
    const shopResults = Array.isArray(source.shopResults)
      ? source.shopResults.map((item) => normalizeShopResultRecord(item, state.shopCatalog))
      : [];
    const summary = {
      totalShopCount: normalizeNonNegativeInteger(source.totalShopCount, normalizeSelectedShopIds(state.signupSelectedShopIds).length),
      successShopCount: normalizeNonNegativeInteger(source.successShopCount, shopResults.filter((item) => item.success).length),
      failedShopCount: normalizeNonNegativeInteger(source.failedShopCount, 0),
      rawActivityCount: normalizeNonNegativeInteger(source.rawActivityCount, rows.length),
      uniqueActivityCount: normalizeNonNegativeInteger(source.uniqueActivityCount, rows.length)
    };

    if (summary.failedShopCount <= 0 && shopResults.length > 0) {
      summary.failedShopCount = Math.max(0, shopResults.length - summary.successShopCount);
    }

    return {
      success: source.success === true,
      updatedAt: normalizeText(source.updatedAt),
      summary,
      rows,
      shopResults,
      themeTypeMapping: Array.isArray(source.themeTypeMapping) ? source.themeTypeMapping : [],
      warning: normalizeText(source.warning)
    };
  }

  function rowMatchesActivityFilter(row, filterSettings) {
    const normalizedFilterSettings = filterSettings && typeof filterSettings === 'object'
      ? filterSettings
      : buildEmptyActivityFilterSettings();
    const minDiscountRate = normalizeOptionalNumber(normalizedFilterSettings.minDiscountRate);
    const minEnrollRemainingDays = normalizeOptionalNumber(normalizedFilterSettings.minEnrollRemainingDays);
    const maxEnrollRemainingDays = normalizeOptionalNumber(normalizedFilterSettings.maxEnrollRemainingDays);
    const minActivityRemainingDays = normalizeOptionalNumber(normalizedFilterSettings.minActivityRemainingDays);
    const maxActivityRemainingDays = normalizeOptionalNumber(normalizedFilterSettings.maxActivityRemainingDays);
    const activityThemeTypes = normalizeActivityThemeTypeFilterValues(normalizedFilterSettings.activityThemeTypes);
    const discountThresholdValue = getDiscountThresholdValue(row && row.discountThreshold);
    const isPermanentEnroll = isActivityEnrollPermanent(row);
    const enrollRemainingDays = getRemainingDaysUntil(row && row.enrollDeadLine);
    const activityRemainingDays = getRemainingDaysUntil(row && row.endTime);
    const matchedThemeType = resolveActivityCategoryFilterLabel(row);

    if (minDiscountRate !== null) {
      if (discountThresholdValue === null || discountThresholdValue < minDiscountRate) {
        return false;
      }
    }

    if (minActivityRemainingDays !== null) {
      if (activityRemainingDays === null || activityRemainingDays < minActivityRemainingDays) {
        return false;
      }
    }

    if (maxActivityRemainingDays !== null) {
      if (activityRemainingDays === null || activityRemainingDays > maxActivityRemainingDays) {
        return false;
      }
    }

    if (minEnrollRemainingDays !== null) {
      if (!isPermanentEnroll && (enrollRemainingDays === null || enrollRemainingDays < minEnrollRemainingDays)) {
        return false;
      }
    }

    if (maxEnrollRemainingDays !== null) {
      if (!isPermanentEnroll && (enrollRemainingDays === null || enrollRemainingDays > maxEnrollRemainingDays)) {
        return false;
      }
    }

    if (activityThemeTypes.length > 0) {
      if (!matchedThemeType || !activityThemeTypes.includes(matchedThemeType)) {
        return false;
      }
    }

    return true;
  }

  function renderActivityRowTags(row) {
    return renderChipList(buildActivityTags(row), {
      maxCount: 2
    });
  }

  function renderActivityTableCellText(value, options = {}) {
    const text = normalizeText(value);

    if (!text) {
      return '<span class="ops-activity-table-empty">\u2014</span>';
    }

    const className = options.className ? ` ${options.className}` : '';

    return `<span class="ops-activity-table-text${className}">${escapeHtml(text)}</span>`;
  }

  function renderActivityTableCellLines(lines, options = {}) {
    const normalizedLines = (Array.isArray(lines) ? lines : [])
      .map((line) => {
        if (line && typeof line === 'object') {
          return {
            text: normalizeText(line.text),
            className: normalizeText(line.className)
          };
        }

        return {
          text: normalizeText(line),
          className: ''
        };
      })
      .filter((line) => Boolean(line.text));

    if (normalizedLines.length <= 0) {
      return '<span class="ops-activity-table-empty">\u2014</span>';
    }

    const className = options.className ? ` ${options.className}` : '';

    return `
      <span class="ops-activity-table-text${className}">
        ${normalizedLines.map((line) => `<span class="ops-activity-table-line${line.className ? ` ${line.className}` : ''}">${escapeHtml(line.text)}</span>`).join('')}
      </span>
    `;
  }

  function buildActivityBatchProductRowKey(row) {
    const productId = normalizeText(row && row.productId);
    const activityKey = normalizeText(
      Array.isArray(row && row.activityKeys) && row.activityKeys.length > 0
        ? row.activityKeys[0]
        : ''
    );

    return [activityKey, productId].filter(Boolean).join('\x1f');
  }

  function buildActivityBatchSubmitScopeKey(values = {}) {
    const shopId = normalizeText(values && values.shopId);
    const activityKey = normalizeText(values && values.activityKey);
    const activityType = normalizeOptionalNumber(values && values.activityType);
    const activityThematicId = normalizeText(values && values.activityThematicId);
    const productId = normalizeText(values && values.productId);

    if (!shopId && !activityKey && activityType === null && !activityThematicId && !productId) {
      return '';
    }

    return [
      shopId,
      activityKey,
      activityType === null ? '' : String(activityType),
      activityThematicId,
      productId
    ].join('\x1f');
  }

  function buildActivityBatchSubmitResultMapKey(record) {
    const item = record && typeof record === 'object' ? record : {};
    const scopedKey = buildActivityBatchSubmitScopeKey({
      shopId: item.shopId,
      activityKey: item.activityKey,
      activityType: item.activityType,
      activityThematicId: item.activityThematicId,
      productId: item.productId
    });

    if (scopedKey) {
      return scopedKey;
    }

    return normalizeText(item.rowKey)
      || [normalizeText(item.activityKey), normalizeText(item.productId)].filter(Boolean).join('\x1f');
  }

  function normalizeActivityQuickCostEntryRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const shopId = normalizeText(source.shopId);
    const shopName = normalizeText(source.shopName);
    const station = resolveQuickCostStationValue(source);
    const stationLabel = normalizeText(source.stationLabel) || normalizeText(source.siteName) || station;
    const spec = normalizeText(source.spec) || normalizeText(buildActivityDetailSpecText(source));
    const specAliases = buildActivityDetailSpecAliases(source);
    const key = buildQuickCostEntryKey(shopId, station, spec);

    if (!key) {
      return null;
    }

    return {
      key,
      shopId,
      shopName,
      station,
      stationLabel,
      spec,
      legacySpec: '',
      specAliases,
      costPrice: normalizeQuickCostValue(source.costPrice)
    };
  }

  function normalizeActivityQuickCostEntryList(entries) {
    const entryMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const normalizedEntry = normalizeActivityQuickCostEntryRecord(entry);

      if (!normalizedEntry || !normalizedEntry.key) {
        return;
      }

      const previousEntry = entryMap.get(normalizedEntry.key);

      if (!previousEntry) {
        entryMap.set(normalizedEntry.key, normalizedEntry);
        return;
      }

      if (!previousEntry.costPrice && normalizedEntry.costPrice) {
        entryMap.set(normalizedEntry.key, normalizedEntry);
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

  function buildActivityQuickCostShopNameMapFromEntries(entries) {
    const shopNameMap = Object.create(null);

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);
      const shopName = normalizeText(entry && entry.shopName);

      if (shopId && shopName && !shopNameMap[shopId]) {
        shopNameMap[shopId] = shopName;
      }
    });

    return shopNameMap;
  }

  function mergeActivityQuickCostSnapshotEntries(entries, snapshotEntries) {
    const snapshotMap = new Map();

    (Array.isArray(snapshotEntries) ? snapshotEntries : []).forEach((entry) => {
      buildQuickCostLookupKeys(
        entry && entry.shopId,
        resolveQuickCostStationValue(entry),
        entry && entry.spec,
        entry && entry.specAliases
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
        entry && entry.spec,
        entry && entry.specAliases
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

  function buildActivityBackgroundQuickCostTargetShopIds(state) {
    return normalizeSelectedShopIds(
      buildSubmittedActivityBatchQueryActivities(state)
        .flatMap((activity) => (Array.isArray(activity && activity.shopIds) ? activity.shopIds : []))
    );
  }

  function buildActivityBackgroundQuickCostShopNameMap(state) {
    const shopNameMap = Object.create(null);
    const shopCatalogMap = state
      && state.shopCatalog
      && state.shopCatalog.shopMap
      && typeof state.shopCatalog.shopMap === 'object'
      ? state.shopCatalog.shopMap
      : null;

    if (shopCatalogMap) {
      Object.keys(shopCatalogMap).forEach((shopId) => {
        const shopName = normalizeText(shopCatalogMap[shopId] && shopCatalogMap[shopId].shopName);

        if (shopId && shopName && !shopNameMap[shopId]) {
          shopNameMap[shopId] = shopName;
        }
      });
    }

    (Array.isArray(state && state.submittedActivityRows) ? state.submittedActivityRows : []).forEach((row) => {
      const availableShopIds = normalizeTextArray(row && row.availableShopIds);
      const availableShopNames = Array.isArray(row && row.availableShopNames) ? row.availableShopNames : [];

      availableShopIds.forEach((shopId, index) => {
        const shopName = normalizeText(availableShopNames[index]);

        if (shopId && shopName && !shopNameMap[shopId]) {
          shopNameMap[shopId] = shopName;
        }
      });

      (Array.isArray(row && row.shopScopes) ? row.shopScopes : []).forEach((shopScope) => {
        const shopId = normalizeText(shopScope && shopScope.shopId);
        const shopName = normalizeText(shopScope && shopScope.shopName);

        if (shopId && shopName && !shopNameMap[shopId]) {
          shopNameMap[shopId] = shopName;
        }
      });
    });

    return shopNameMap;
  }

  function buildActivityBackgroundQuickCostDialogEntries(state, snapshotEntries, presetHintEntries, options = {}) {
    const targetShopIds = normalizeSelectedShopIds(options && options.targetShopIds).length > 0
      ? normalizeSelectedShopIds(options && options.targetShopIds)
      : buildActivityBackgroundQuickCostTargetShopIds(state);
    const targetShopIdSet = new Set(targetShopIds);
    const shopNameMap = options && options.shopNameMap && typeof options.shopNameMap === 'object'
      ? options.shopNameMap
      : buildActivityBackgroundQuickCostShopNameMap(state);
    const entryMap = new Map();
    const sourceEntries = buildActivityBackgroundQuickCostSourceEntries(
      state,
      snapshotEntries,
      presetHintEntries,
      {
        targetShopIds
      }
    );

    sourceEntries.forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);

      if (!shopId || (targetShopIdSet.size > 0 && !targetShopIdSet.has(shopId))) {
        return;
      }

      const station = resolveQuickCostStationValue(entry);
      const stationLabel = normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.siteName) || station;
      const spec = normalizeText(entry && entry.spec) || normalizeText(buildActivityDetailSpecText(entry));
      const specAliases = buildActivityDetailSpecAliases(entry);
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
        legacySpec: '',
        specAliases,
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

  function applyActivityQuickCostEntriesToRows(rows, entries, options = {}) {
    const costMap = new Map();
    const preferredShopId = normalizeText(options && options.preferredShopId);

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      buildQuickCostLookupKeys(
        entry && entry.shopId,
        resolveQuickCostStationValue(entry),
        entry && entry.spec,
        entry && entry.specAliases
      ).forEach((key) => {
        if (!costMap.has(key)) {
          costMap.set(key, normalizeQuickCostValue(entry && entry.costPrice));
        }
      });
    });

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const shopScopes = Array.isArray(row && row.shopScopes) && row.shopScopes.length > 0
        ? row.shopScopes
        : [{
          shopId: normalizeText(row && row.shopId) || normalizeText(Array.isArray(row && row.availableShopIds) ? row.availableShopIds[0] : '')
        }];
      const matchedShopScopes = preferredShopId
        ? shopScopes.filter((shopScope) => normalizeText(shopScope && shopScope.shopId) === preferredShopId)
        : shopScopes;
      const effectiveShopScopes = matchedShopScopes.length > 0 ? matchedShopScopes : shopScopes;
      const updatedSkuDetails = (Array.isArray(row && row.skuDetails) ? row.skuDetails : []).map((detail) => {
        const station = resolveQuickCostStationValue({
          siteId: detail && detail.siteId,
          station: detail && detail.siteId,
          stationLabel: detail && detail.siteName,
          siteName: detail && detail.siteName
        });
        const spec = buildActivityDetailSpecText(detail);
        const specAliases = buildActivityDetailSpecAliases(detail);
        const matchedKey = effectiveShopScopes
          .flatMap((shopScope) => buildQuickCostLookupKeys(
            shopScope && shopScope.shopId,
            station,
            spec,
            specAliases
          ))
          .find((key) => costMap.has(key));

        if (!matchedKey) {
          return detail;
        }

        return {
          ...detail,
          costPrice: costMap.get(matchedKey)
        };
      });

      return {
        ...row,
        skuDetails: updatedSkuDetails
      };
    });
  }

  function hasMatchedActivityQuickCostPrice(value) {
    const normalizedValue = normalizeOptionalNumber(value);
    return normalizedValue !== null && normalizedValue > 0;
  }

  function resolveActivityBatchRowCostFilterStatus(row) {
    const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];

    if (skuDetails.length <= 0) {
      return 'unset';
    }

    const matchedCostCount = skuDetails.filter((detail) => hasMatchedActivityQuickCostPrice(detail && detail.costPrice)).length;
    return matchedCostCount > 0 && matchedCostCount >= skuDetails.length
      ? 'set'
      : 'unset';
  }

  function applyActivityBatchCostFilterToRows(rows, costFilter) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const normalizedCostFilter = normalizeActivityBatchCostFilter(costFilter);

    if (!normalizedCostFilter) {
      return normalizedRows.slice();
    }

    return normalizedRows.filter((row) => {
      const rowCostStatus = resolveActivityBatchRowCostFilterStatus(row);
      return normalizedCostFilter === 'set'
        ? rowCostStatus === 'set'
        : rowCostStatus !== 'set';
    });
  }

  function rebuildActivityBatchVisibleRows(productState) {
    const sourceState = productState && typeof productState === 'object'
      ? productState
      : buildEmptyActivityProductBatchState();
    const baseRows = Array.isArray(sourceState.baseRows) ? sourceState.baseRows : [];
    const preferredShopId = normalizeText(sourceState.filterShopId);
    const nextRowsWithCost = applyActivityQuickCostEntriesToRows(
      baseRows,
      sourceState.quickCostEntries,
      {
        preferredShopId
      }
    );
    const costFilteredRows = applyActivityBatchCostFilterToRows(nextRowsWithCost, sourceState.costFilter);
    let nextRows = costFilteredRows;

    if (sourceState.activityProductFilterApplied === true) {
      const filterResult = applyActivityProductFilterToRows(
        nextRows,
        sourceState.activityProductFilterAppliedSettings || sourceState.activityProductFilterSettings
      );

      nextRows = filterResult.rows;
      sourceState.activityProductFilterRows = filterResult.rows.slice();
      sourceState.activityProductFilterSummary = filterResult.summary;
      sourceState.activityProductFilterResultMap = filterResult.resultMap;
    }

    if (
      sourceState.activityBatchSubmitResultMap
      && typeof sourceState.activityBatchSubmitResultMap === 'object'
      && Object.keys(sourceState.activityBatchSubmitResultMap).length > 0
    ) {
      nextRows = applyActivityBatchSignupSubmitResultMapToRows(
        nextRows,
        sourceState.activityBatchSubmitResultMap
      );
    }

    sourceState.rows = nextRows;
    return nextRows;
  }

  function resolveActivityProductRowSignupStatus(row, state) {
    const rowStatus = normalizeText(row && row.activitySignupStatus);
    const rowStatusText = normalizeText(row && row.activitySignupStatusText);
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const filterSettings = productState.activityProductFilterApplied === true
      ? (productState.activityProductFilterAppliedSettings || productState.activityProductFilterSettings)
      : null;
    const rowReason = resolveActivityProductRowSignupReason(
      row,
      rowStatus,
      row && row.activitySignupReason,
      filterSettings
    );

    if (rowStatus) {
      return {
        status: rowStatus,
        text: rowStatusText || (rowStatus === 'eligible' ? '\u53ef\u62a5\u540d' : '\u4e0d\u53c2\u52a0'),
        reason: rowReason
      };
    }

    const resultMap = productState && productState.activityProductFilterResultMap && typeof productState.activityProductFilterResultMap === 'object'
      ? productState.activityProductFilterResultMap
      : Object.create(null);
    const rowKey = buildActivityProductFilterStateKey(row);
    const mapped = rowKey ? resultMap[rowKey] : null;

    if (mapped && typeof mapped === 'object') {
      const mappedStatus = normalizeText(mapped.status);
      return {
        status: mappedStatus,
        text: normalizeText(mapped.statusText) || (mappedStatus === 'eligible' ? '\u53ef\u62a5\u540d' : '\u4e0d\u53c2\u52a0'),
        reason: resolveActivityProductRowSignupReason(row, mappedStatus, mapped.reason, filterSettings)
      };
    }

    return {
      status: '',
      text: productState.activityProductFilterApplied === true ? '\u672a\u7edf\u8ba1' : '\u672a\u7b5b\u9009',
      reason: ''
    };
  }

  function renderActivityProductSignupStatusCell(row, state) {
    const statusInfo = resolveActivityProductRowSignupStatus(row, state);
    const batchSubmitScopeResults = Array.isArray(row && row.activityBatchSubmitScopeResults)
      ? row.activityBatchSubmitScopeResults
      : [];
    const successCount = batchSubmitScopeResults.filter((item) => normalizeText(item && item.status) === 'success').length;
    const failedCount = batchSubmitScopeResults.filter((item) => normalizeText(item && item.status) === 'failed').length;
    const skippedCount = batchSubmitScopeResults.filter((item) => normalizeText(item && item.status) === 'skip').length;
    const totalScopeCount = batchSubmitScopeResults.length;
    const hasSubmitResults = totalScopeCount > 0;
    const hasSubmitSuccess = successCount > 0;
    const shouldSuppressNegativeFilterReason = hasSubmitSuccess && statusInfo.status !== 'eligible';
    const statusLines = [
      `${hasSubmitResults ? '\u7b5b\u9009\u72b6\u6001' : '\u72b6\u6001'} ${statusInfo.text || '\u2014'}`
    ];
    let statusClass = '';

    if (statusInfo.reason && !shouldSuppressNegativeFilterReason) {
      statusLines.push(`${hasSubmitResults ? '\u7b5b\u9009\u660e\u7ec6' : '\u8bf4\u660e'} ${statusInfo.reason}`);
    } else if (hasSubmitSuccess) {
      statusLines.push('\u7b5b\u9009\u660e\u7ec6 \u6ee1\u8db3\u62a5\u540d\u89c4\u5219');
    }

    if (hasSubmitResults) {
      if (successCount > 0 && failedCount <= 0 && skippedCount <= 0) {
        statusLines.push(`\u62a5\u540d\u7ed3\u679c \u5168\u90e8\u63d0\u4ea4\u6210\u529f (${successCount}/${totalScopeCount})`);
        statusClass = 'is-status-success';
      } else if (successCount > 0 && (failedCount > 0 || skippedCount > 0)) {
        statusLines.push(`\u62a5\u540d\u7ed3\u679c \u90e8\u5206\u6210\u529f (\u6210\u529f ${successCount} / \u5931\u8d25 ${failedCount} / \u8df3\u8fc7 ${skippedCount})`);
        statusClass = 'is-status-warning';
      } else if (failedCount > 0) {
        statusLines.push(`\u62a5\u540d\u7ed3\u679c \u63d0\u4ea4\u5931\u8d25 (${failedCount}/${totalScopeCount})`);
        statusClass = 'is-status-warning';
      } else if (skippedCount > 0) {
        statusLines.push(`\u62a5\u540d\u7ed3\u679c \u672a\u63d0\u4ea4\u62a5\u540d (${skippedCount}/${totalScopeCount})`);
        statusClass = 'is-status-warning';
      }

      batchSubmitScopeResults.forEach((item) => {
        const shopName = normalizeText(item && item.shopName) || normalizeText(item && item.shopId) || '\u672a\u547d\u540d\u5e97\u94fa';
        const itemStatusText = normalizeText(item && item.statusText) || '\u2014';
        const itemMessage = normalizeText(item && item.message);
        statusLines.push(`\u5e97\u94fa\u7ed3\u679c ${shopName} ${itemStatusText}`);

        if (itemMessage) {
          statusLines.push(`\u62a5\u540d\u56de\u6267 ${shopName}\uff1a${itemMessage}`);
        }
      });
    } else if (statusInfo.status === 'eligible') {
      statusLines.push('\u62a5\u540d\u7ed3\u679c \u901a\u8fc7\u7b5b\u9009\u5f85\u62a5\u540d');
      statusClass = 'is-status-success';
    } else if (statusInfo.status === 'skip') {
      statusClass = 'is-status-warning';
    }

    return renderActivityTableCellLines(statusLines, {
      className: statusClass || (
        statusInfo.status === 'eligible'
          ? 'is-status-success'
          : (statusInfo.status === 'skip' ? 'is-status-warning' : '')
      )
    });
  }

  function renderActivitySkcDetailCell(row, state) {
    const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];
    const skcDetails = [];
    const skcDetailKeySet = new Set();
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const expandedSkuDetailKeys = Array.isArray(productState.expandedSkuDetailKeys)
      ? productState.expandedSkuDetailKeys
      : [];
    const rowKey = buildActivityBatchProductRowKey(row);
    const isExpanded = rowKey ? expandedSkuDetailKeys.includes(rowKey) : false;

    skuDetails.forEach((detail) => {
      const skcId = normalizeText(detail && detail.skcId);
      const skcExtCode = normalizeText(detail && detail.skcExtCode);
      const skcPropertiesText = normalizeText(detail && detail.skcPropertiesText);
      const skcDetailKey = [skcId || '-', skcExtCode || '-', skcPropertiesText || '-'].join('\x1f');

      if (skcDetailKeySet.has(skcDetailKey)) {
        return;
      }

      skcDetailKeySet.add(skcDetailKey);
      skcDetails.push(detail);
    });

    const visibleSkcDetails = isExpanded ? skcDetails : skcDetails.slice(0, 2);

    if (skcDetails.length <= 0) {
      return '<span class="ops-activity-table-empty">\u2014</span>';
    }

    return `
      <div class="ops-activity-sku-detail-list is-skc">
        ${visibleSkcDetails.map((detail) => {
      const skcId = normalizeText(detail && detail.skcId);
      const skcExtCode = normalizeText(detail && detail.skcExtCode);
      const skcPropertiesText = normalizeText(detail && detail.skcPropertiesText);
      const lines = [];

      lines.push(`SKC ${skcId || '\u2014'}`);

      if (skcExtCode) {
        lines.push(`SKC\u7f16\u53f7 ${skcExtCode}`);
      }

      if (skcPropertiesText) {
        lines.push(`SKC\u5c5e\u6027 ${skcPropertiesText}`);
      }

      return `
            <div class="ops-activity-sku-detail-item">
              ${renderActivityTableCellLines(lines)}
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  function renderActivitySkuDetailCell(row, state) {
    const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const expandedSkuDetailKeys = Array.isArray(productState.expandedSkuDetailKeys)
      ? productState.expandedSkuDetailKeys
      : [];
    const rowKey = buildActivityBatchProductRowKey(row);
    const isExpanded = rowKey ? expandedSkuDetailKeys.includes(rowKey) : false;
    const visibleSkuDetails = isExpanded ? skuDetails : skuDetails.slice(0, 2);

    if (skuDetails.length <= 0) {
      return '<span class="ops-activity-table-empty">\u2014</span>';
    }

    return `
      <div class="ops-activity-sku-detail-list">
        ${visibleSkuDetails.map((detail) => {
      const skuId = normalizeText(detail && detail.skuId);
      const skuExtCode = normalizeText(detail && detail.skuExtCode);
      const skuPropertiesText = normalizeText(buildActivityDetailSpecText(detail));
      const siteName = normalizeText(detail && detail.siteName) || normalizeText(detail && detail.siteId);
      const currency = normalizeText(detail && detail.currency) || normalizeText(row && row.currency);
      const suggestActivityPriceText = formatPriceRange(
        detail && detail.suggestActivityPrice,
        detail && detail.suggestActivityPrice,
        currency
      );
      const dailyPriceText = formatPriceRange(
        detail && detail.dailyPrice,
        detail && detail.dailyPrice,
        currency
      );
      const lines = [];

      lines.push(`SKU ${skuId || '\u2014'}`);

      if (skuExtCode) {
        lines.push(`SKU\u7f16\u53f7 ${skuExtCode}`);
      }

      if (skuPropertiesText) {
        lines.push(`SKU\u5c5e\u6027 ${skuPropertiesText}`);
      }

      if (siteName) {
        lines.push(`\u7ad9\u70b9 ${siteName}`);
      }

      lines.push(`\u5efa\u8bae\u6d3b\u52a8\u4ef7 ${suggestActivityPriceText}`);
      lines.push(`\u65e5\u5e38\u4ef7 ${dailyPriceText}`);

      if (normalizeQuickCostValue(detail && detail.costPrice)) {
        lines.push(`\u6210\u672c\u4ef7 ${normalizeQuickCostValue(detail && detail.costPrice)}`);
      }

      const signupStatus = normalizeText(detail && detail.activitySignupStatus);
      const signupStatusClass = signupStatus === 'eligible'
        ? 'is-status-success'
        : (signupStatus === 'skip' || signupStatus === 'failed'
          ? 'is-status-warning'
          : '');

      if (normalizeText(detail && detail.activitySubmitPriceText)) {
        lines.push({
          text: `\u63d0\u4ea4\u6d3b\u52a8\u4ef7 ${normalizeText(detail && detail.activitySubmitPriceText)}`,
          className: 'is-submit-price'
        });
      }

      if (normalizeText(detail && detail.activitySubmitProfitRateText)) {
        lines.push({
          text: `\u63d0\u4ea4\u5229\u6da6\u7387 ${normalizeText(detail && detail.activitySubmitProfitRateText)}`,
          className: signupStatusClass
        });
      }

      if (normalizeText(detail && detail.activitySubmitProfitValueText)) {
        lines.push({
          text: `\u63d0\u4ea4\u5229\u6da6\u503c ${normalizeText(detail && detail.activitySubmitProfitValueText)}`,
          className: signupStatusClass
        });
      }

      if (detail && detail.activitySubmitAdjustedToProfitFloor === true) {
        const submitFloorBasisText = normalizeText(detail && detail.activitySubmitAdjustedToProfitFloorBasisText);
        lines.push({
          text: `\u4fdd\u5e95\u63d0\u4ea4 \u5df2\u6309${submitFloorBasisText || '\u4fdd\u5e95\u4ef7'}\u63d0\u4ea4`,
          className: 'is-submit-price'
        });
      }

      if (normalizeText(detail && detail.activitySignupStatusText)) {
        lines.push({
          text: `\u62a5\u540d\u72b6\u6001 ${normalizeText(detail && detail.activitySignupStatusText)}`,
          className: signupStatusClass
        });
      }

      if (normalizeText(detail && detail.activitySignupReason)) {
        lines.push({
          text: `\u62a5\u540d\u8bf4\u660e ${normalizeText(detail && detail.activitySignupReason)}`,
          className: signupStatusClass || 'is-signup-note'
        });
      }

      return `
            <div class="ops-activity-sku-detail-item">
              ${renderActivityTableCellLines(lines)}
            </div>
          `;
    }).join('')}
        ${skuDetails.length > 2 && rowKey ? `
          <button
            class="ops-activity-sku-detail-toggle"
            type="button"
            data-ops-activity-sku-toggle="${escapeHtml(rowKey)}"
          >
            ${isExpanded ? '\u6536\u8d77SKU\u660e\u7ec6' : `\u5c55\u5f00\u5269\u4f59 ${escapeHtml(formatInteger(skuDetails.length - 2, '0'))} \u6761SKU\u660e\u7ec6`}
          </button>
        ` : ''}
      </div>
    `;
  }

  function renderActivityQueryTable(state) {
    const rows = buildSortedActivityRows(state.activityQueryRows, state);
    const selectableActivityKeys = buildSelectableActivityKeys(rows);
    const selectableActivityKeySet = new Set(selectableActivityKeys);
    const selectedActivityKeys = normalizeActivitySelectedKeys(state.activitySelectedKeys)
      .filter((activityKey) => selectableActivityKeySet.has(activityKey));
    const selectedActivityKeySet = new Set(selectedActivityKeys);
    const allChecked = selectableActivityKeys.length > 0 && selectedActivityKeys.length === selectableActivityKeys.length;
    const activeSortField = normalizeActivitySortField(state && state.activitySortField);
    const activeSortDirection = normalizeActivitySortDirection(state && state.activitySortDirection);
    const summary = state.activityQuerySummary || buildEmptyActivityQuerySummary();
    const statusKind = normalizeText(state.activityQueryStatusKind);
    const hasError = statusKind === 'error';
    const hasQueryAttempt = (
      statusKind !== 'idle'
      || normalizeText(state.activityQueryUpdatedAt)
      || normalizeNonNegativeInteger(summary.totalShopCount, 0) > 0
      || normalizeNonNegativeInteger(summary.successShopCount, 0) > 0
      || normalizeNonNegativeInteger(summary.failedShopCount, 0) > 0
    );

    if (state.activityQueryLoading === true) {
      return `
        <div class="ops-activity-query-empty">
          <p class="ops-activity-query-empty-title">\u6b63\u5728\u67e5\u8be2\u6d3b\u52a8\u5217\u8868...</p>
        </div>
      `;
    }

    if (rows.length <= 0) {
      return `
        <div class="ops-activity-query-empty">
          <p class="ops-activity-query-empty-title">${hasError ? '\u6d3b\u52a8\u67e5\u8be2\u672a\u5b8c\u6210' : hasQueryAttempt ? '\u5f53\u524d\u67e5\u8be2\u6682\u65e0\u53ef\u62a5\u6d3b\u52a8' : '\u6682\u65e0\u6d3b\u52a8\u6570\u636e'}</p>
        </div>
      `;
    }

    const columns = [
      { label: '\u4e13\u9898\u540d\u79f0', key: 'activityThematicName', sortField: 'activityThematicName' },
      { label: '\u6d3b\u52a8\u5927\u7c7b', key: 'activityName', sortField: 'activityName' },
      { label: '\u4e3b\u9898\u7c7b\u578b', key: 'activityThemeTypeLabel', sortField: 'activityThemeTypeLabel' },
      { label: '\u6298\u6263\u95e8\u69db', key: 'discountThreshold', sortField: 'discountThreshold' },
      { label: '\u5e93\u5b58\u95e8\u69db', key: 'stockThreshold', sortField: 'stockThreshold' },
      { label: '\u65f6\u957f', key: 'durationDays', sortField: 'durationDays' },
      { label: '\u62a5\u540d\u65f6\u95f4', key: 'enrollWindow', sortField: 'enrollWindow' },
      { label: '\u6d3b\u52a8\u65f6\u95f4', key: 'activityWindow', sortField: 'activityWindow' },
      { label: '\u5269\u4f59\u65f6\u95f4', key: 'remaining', sortField: 'remaining' },
      { label: '\u53ef\u62a5\u7ad9\u70b9', key: 'siteNames', sortField: '' },
      { label: '\u53ef\u62a5\u5e97\u94fa', key: 'availableShopNames', sortField: '' },
      { label: '\u6743\u76ca\u6807\u7b7e', key: 'tags', sortField: '' },
      { label: '\u6d3b\u52a8\u8bf4\u660e', key: 'description', sortField: '' },
      { label: '\u4f18\u5148\u7ea7', key: 'priority', sortField: 'priority' }
    ];

    return `
      <div class="ops-activity-query-table-wrap">
        <table class="ops-activity-table">
          <thead>
            <tr>
              <th class="ops-activity-checkbox-cell">
                <input
                  class="ops-activity-checkbox-input"
                  type="checkbox"
                  data-ops-activity-check-all="true"
                  ${allChecked ? 'checked' : ''}
                  ${selectableActivityKeys.length <= 0 ? 'disabled' : ''}
                />
              </th>
              ${columns.map((column) => {
                const sortField = normalizeActivitySortField(column && column.sortField);
                const isSortActive = Boolean(sortField) && sortField === activeSortField;
                const indicatorMarkup = isSortActive
                  ? (activeSortDirection === 'desc' ? '&#8595;' : '&#8593;')
                  : '&#8597;';

                if (!sortField) {
                  return `<th>${escapeHtml(column && column.label)}</th>`;
                }

                return `
                  <th>
                    <button
                      class="ops-activity-sort-button${isSortActive ? ' is-active' : ''}"
                      type="button"
                      data-ops-activity-sort-field="${escapeHtml(sortField)}"
                    >
                      <span>${escapeHtml(column && column.label)}</span>
                      <span class="ops-activity-sort-indicator">${indicatorMarkup}</span>
                    </button>
                  </th>
                `;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const activityKey = normalizeText(row.activityKey);
              const activityKeyEscaped = escapeHtml(activityKey);
              const rowChecked = selectedActivityKeySet.has(activityKey);
              const description = normalizeText(row.activityThematicContent) || normalizeText(row.activityContent);
              const themeTypeDisplay = resolveActivityThemeTypeLabel(row);
              const siteNamesPreview = buildListPreviewText(row.siteNames, 2);
              const siteNamesFullText = buildListFullText(row.siteNames);
              const availableShopDisplayEntries = buildActivityAvailableShopDisplayEntries(row);
              const availableShopDisplayLabels = availableShopDisplayEntries
                .map((entry) => formatActivityAvailableShopLabel(entry))
                .filter(Boolean);
              const availableShopNamesFullText = buildListFullText(availableShopDisplayLabels);
              const activityTagsFullText = buildListFullText(buildActivityTags(row));
              const enrollWindowLines = buildActivityEnrollWindowLines(row);
              const activityWindowLines = [
                `\u5f00\u59cb ${formatDateTime(row.startTime)}`,
                `\u7ed3\u675f ${formatDateTime(row.endTime)}`
              ];
              const remainingLines = [
                `\u62a5\u540d ${formatActivityEnrollRemainingText(row)}`,
                `\u6d3b\u52a8 ${formatRemainingDuration(row.endTime, {
                  activeLabel: '\u5269\u4f59',
                  futureLabel: '\u8ddd\u5f00\u59cb',
                  endedLabel: '\u5df2\u7ed3\u675f',
                  startedAt: row.startTime
                })}`
              ];
              return `
                <tr data-activity-key="${activityKeyEscaped}">
                  <td class="ops-activity-checkbox-cell">
                    <input
                      class="ops-activity-checkbox-input"
                      type="checkbox"
                      data-ops-activity-row-check="true"
                      data-ops-activity-key="${activityKeyEscaped}"
                      ${rowChecked ? 'checked' : ''}
                    />
                  </td>
                  <td>${renderActivityTableCellText(row.activityThematicName)}</td>
                  <td>${renderActivityTableCellText(row.activityName)}</td>
                  <td>${renderActivityTableCellText(themeTypeDisplay)}</td>
                  <td>${renderActivityTableCellText(formatDiscountThreshold(row.discountThreshold))}</td>
                  <td>${renderActivityTableCellText(formatThreshold(row.stockThreshold, '\u4ef6'))}</td>
                  <td>${renderActivityTableCellText(formatDurationDays(row.durationDays))}</td>
                  <td>${renderActivityTableCellLines(enrollWindowLines, { className: 'is-multiline' })}</td>
                  <td>${renderActivityTableCellLines(activityWindowLines, { className: 'is-multiline' })}</td>
                  <td>${renderActivityTableCellLines(remainingLines, { className: 'is-multiline' })}</td>
                  <td><span class="ops-activity-table-list"${siteNamesFullText ? ` title="${escapeHtml(siteNamesFullText)}"` : ''}>${escapeHtml(siteNamesPreview)}</span></td>
                  <td><div class="ops-activity-chip-list"${availableShopNamesFullText ? ` title="${escapeHtml(availableShopNamesFullText)}"` : ''}>${renderChipList(availableShopDisplayLabels, { maxCount: 2 })}</div></td>
                  <td><div class="ops-activity-chip-list"${activityTagsFullText ? ` title="${escapeHtml(activityTagsFullText)}"` : ''}>${renderActivityRowTags(row)}</div></td>
                  <td>${renderActivityTableCellText(description, { className: 'is-multiline' })}</td>
                  <td>${renderActivityTableCellText(formatInteger(row.priority))}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderActivityFilterDialog(state) {
    if (!state || state.activityFilterDialogOpen !== true) {
      return '';
    }

    const loading = state.activityFilterLoading === true && state.activityFilterLoaded !== true;
    const saving = state.activityFilterSaving === true;
    const selectedThemeTypes = normalizeActivityThemeTypeFilterValues(state.activityFilterDraftThemeTypes);
    const themeTypeOptions = normalizeActivityThemeTypeFilterOptions(
      state && state.activityQueryThemeTypeOptions
    );

    return `
      <div class="ops-activity-filter-modal" data-ops-activity-filter-backdrop="true">
        <div
          class="ops-activity-filter-dialog"
          data-ops-activity-filter-panel="true"
          role="dialog"
          aria-modal="true"
          aria-label="\u6d3b\u52a8\u7b5b\u9009"
        >
          <div class="ops-activity-filter-header">
            <div class="ops-activity-filter-title-block">
              <h3 class="ops-activity-filter-title">\u6d3b\u52a8\u7b5b\u9009</h3>
            </div>
            <button
              class="ops-activity-filter-close"
              type="button"
              data-ops-activity-filter-action="close"
              ${saving ? 'disabled' : ''}
              aria-label="\u5173\u95ed"
            >
              &times;
            </button>
          </div>

          <div class="ops-activity-filter-body">
            ${loading ? `
              <div class="ops-activity-filter-loading">\u6b63\u5728\u52a0\u8f7d\u7b5b\u9009\u8bbe\u7f6e...</div>
            ` : `
              <label class="ops-activity-filter-field">
                <span class="ops-activity-filter-field-label">\u6298\u6263 \u2265</span>
                <div class="ops-activity-filter-input-wrap">
                  <input
                    class="ops-activity-filter-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value="${escapeHtml(state.activityFilterDraftMinDiscountRate)}"
                    data-ops-activity-filter-field="minDiscountRate"
                    ${saving ? 'disabled' : ''}
                  />
                  <span class="ops-activity-filter-unit">\u6298</span>
                </div>
              </label>

              <label class="ops-activity-filter-field">
                <span class="ops-activity-filter-field-label">\u62a5\u540d\u65f6\u95f4</span>
                <div class="ops-activity-filter-input-wrap is-range">
                  <input
                    class="ops-activity-filter-input is-range-value"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.activityFilterDraftMinEnrollRemainingDays)}"
                    data-ops-activity-filter-field="minEnrollRemainingDays"
                    ${saving ? 'disabled' : ''}
                  />
                  <span class="ops-activity-filter-range-separator">-</span>
                  <input
                    class="ops-activity-filter-input is-range-value"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.activityFilterDraftMaxEnrollRemainingDays)}"
                    data-ops-activity-filter-field="maxEnrollRemainingDays"
                    ${saving ? 'disabled' : ''}
                  />
                  <span class="ops-activity-filter-unit">\u5929</span>
                </div>
              </label>

              <label class="ops-activity-filter-field">
                <span class="ops-activity-filter-field-label">\u6d3b\u52a8\u65f6\u95f4</span>
                <div class="ops-activity-filter-input-wrap is-range">
                  <input
                    class="ops-activity-filter-input is-range-value"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.activityFilterDraftMinActivityRemainingDays)}"
                    data-ops-activity-filter-field="minActivityRemainingDays"
                    ${saving ? 'disabled' : ''}
                  />
                  <span class="ops-activity-filter-range-separator">-</span>
                  <input
                    class="ops-activity-filter-input is-range-value"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.activityFilterDraftMaxActivityRemainingDays)}"
                    data-ops-activity-filter-field="maxActivityRemainingDays"
                    ${saving ? 'disabled' : ''}
                  />
                  <span class="ops-activity-filter-unit">\u5929</span>
                </div>
              </label>

              <div class="ops-activity-filter-field is-block">
                <div class="ops-activity-filter-label-row">
                  <span class="ops-activity-filter-field-label">\u6d3b\u52a8\u5927\u7c7b</span>
                  <span class="ops-activity-filter-help">
                    <button
                      class="ops-activity-filter-help-trigger"
                      type="button"
                      aria-label="\u6d3b\u52a8\u5927\u7c7b\u63d0\u793a"
                    >
                      ?
                    </button>
                    <span class="ops-activity-filter-help-bubble">
                      \u8de8\u5e97\u6ee1\u51cf\u3001\u4e2a\u6027\u5316\u6298\u6263\u3001\u4fc3\u9500\u6d3b\u52a8\u52a0\u8865\u3001\u56e2\u8d2d\u6d3b\u52a8\u8fd9\u56db\u7c7b\u5c5e\u4e8e\u6298\u4e0a\u6298\u6d3b\u52a8\uff0c\u4e0d\u5efa\u8bae\u52fe\u9009\u3002
                    </span>
                  </span>
                </div>
                <div class="ops-activity-filter-check-list">
                  ${themeTypeOptions.length > 0 ? themeTypeOptions.map((option) => {
      const optionValue = normalizeText(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;
      const checked = selectedThemeTypes.includes(optionValue);
      return `
                    <label class="ops-activity-filter-check-item">
                      <input
                        type="checkbox"
                        data-ops-activity-filter-theme-type="${escapeHtml(optionValue)}"
                        ${checked ? 'checked' : ''}
                        ${saving ? 'disabled' : ''}
                      />
                      <span>${escapeHtml(optionLabel)}</span>
                    </label>
                  `;
    }).join('') : `
                    <span class="ops-activity-table-empty">\u8bf7\u5148\u67e5\u8be2\u6d3b\u52a8\u540e\u518d\u9009\u62e9\u5927\u7c7b</span>
                  `}
                </div>
              </div>
            `}
          </div>

          <div class="ops-activity-filter-footer">
            ${state.activityFilterWarning ? `<div class="ops-activity-filter-message is-warning">${escapeHtml(state.activityFilterWarning)}</div>` : ''}
            ${state.activityFilterNotice ? `<div class="ops-activity-filter-message is-success">${escapeHtml(state.activityFilterNotice)}</div>` : ''}
            <div class="ops-activity-filter-actions">
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-activity-filter-action="reset"
                ${loading || saving ? 'disabled' : ''}
              >
                \u91cd\u7f6e
              </button>
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-activity-filter-action="cancel"
                ${saving ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-ops-activity-filter-action="save"
                ${loading || saving ? 'disabled' : ''}
              >
                ${saving ? '\u7b5b\u9009\u52fe\u9009\u4e2d...' : '\u7b5b\u9009\u52fe\u9009'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderActivityQueryPanel(state) {
    return `
      <section class="ops-activity-query-panel">
        <div class="ops-activity-query-panel-head">
          <strong class="ops-activity-query-panel-title">\u6d3b\u52a8\u5217\u8868</strong>
          <div class="ops-activity-query-panel-meta">
            ${state.activityQueryUpdatedAt ? `<span>\u6700\u8fd1\u66f4\u65b0 ${escapeHtml(formatDateTime(state.activityQueryUpdatedAt))}</span>` : ''}
          </div>
        </div>
        ${renderActivityQueryStatus(state)}
        ${renderActivityQueryTable(state)}
      </section>
    `;
  }

  function renderSubmittedActivityToolbar(state) {
    const selectedCount = normalizeActivitySelectedKeys(state.activitySelectedKeys).length;
    const tipText = selectedCount > 0
      ? '\u9884\u89c8\u7248\u4f1a\u8fdb\u5165\u5546\u54c1\u5217\u8868\u9875\uff0c\u540e\u53f0\u7248\u4f1a\u76f4\u63a5\u67e5\u8be2\u3001\u7b5b\u9009\u5e76\u63d0\u4ea4\uff0c\u8fdb\u5ea6\u4f1a\u5728\u9875\u9762\u5185\u6301\u7eed\u663e\u793a'
      : '';

    return `
      <div class="ops-activity-submit-row">
        ${tipText ? `<span class="ops-activity-submit-tip">${tipText}</span>` : ''}
        <div class="ops-activity-submit-buttons">
          <button
            class="ops-activity-danger-button"
            type="button"
            data-ops-activity-submit-selected="true"
            ${selectedCount <= 0 ? 'disabled' : ''}
          >
            \u6279\u91cf\u67e5\u8be2\u6d3b\u52a8\u5546\u54c1-\u9884\u89c8\u7248
          </button>
          <button
            class="ops-activity-background-entry-button"
            type="button"
            data-ops-activity-submit-selected-background="true"
            ${selectedCount <= 0 ? 'disabled' : ''}
          >
            \u6279\u91cf\u63d0\u4ea4\u6d3b\u52a8\u5546\u54c1-\u540e\u53f0\u7248
          </button>
        </div>
      </div>
    `;
  }

  function renderActivityBackgroundFilterSettingsPanel(state) {
    const backgroundState = state && state.activityBackgroundSubmitState
      ? state.activityBackgroundSubmitState
      : buildEmptyActivityBackgroundSubmitState();
    const settings = normalizeActivityProductFilterSettings(backgroundState.filterSettings);
    const disabled = backgroundState.running === true
      || backgroundState.filterSettingsLoading === true
      || backgroundState.filterSettingsSaving === true;
    const collapsed = backgroundState.settingsCollapsed === true;
    const hasFooterMessage = Boolean(
      normalizeText(backgroundState.filterSettingsError)
      || normalizeText(backgroundState.filterSettingsWarning)
      || normalizeText(backgroundState.filterSettingsNotice)
    );
    const collapsedSummaryText = [
      `\u7b5b\u9009 ${formatActivityProductFilterRule(settings)}`,
      `\u4fdd\u5e95 ${formatActivityProductProfitFloorRule(settings)}`
    ].join(' / ');

    return `
      <div class="ops-activity-background-settings-panel ops-activity-background-settings-panel-compact">
        <div class="ops-activity-background-settings-head">
          <div class="ops-activity-background-settings-head-copy">
            <strong>\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1\u8bbe\u7f6e</strong>
            <span>${escapeHtml(collapsed ? collapsedSummaryText : '\u540e\u53f0\u7248\u4e0e\u9884\u89c8\u7248\u5171\u7528\u540c\u4e00\u5957\u7b5b\u9009\u89c4\u5219')}</span>
          </div>
          <button
            class="ops-activity-background-collapse-button"
            type="button"
            data-ops-activity-background-toggle-section="settings"
            aria-expanded="${collapsed ? 'false' : 'true'}"
          >
            ${collapsed ? '\u5c55\u5f00' : '\u6536\u8d77'}
          </button>
        </div>
        <div class="ops-activity-background-settings-body ops-activity-background-settings-body-compact${collapsed ? ' is-collapsed' : ''}">
          ${renderActivityProductFilterSettingsFields(settings, {
            settingAttribute: 'data-ops-activity-background-filter-setting',
            disabled
          })}
          ${backgroundState.filterSettingsLoading === true ? `
            <div class="ops-activity-quick-cost-empty">\u6b63\u5728\u52a0\u8f7d\u7b5b\u9009\u8bbe\u7f6e...</div>
          ` : ''}
        </div>
        <div class="ops-activity-background-settings-footer${collapsed && hasFooterMessage !== true ? ' is-collapsed' : ''}">
          ${backgroundState.filterSettingsError ? `<div class="ops-activity-quick-cost-message is-error">${escapeHtml(backgroundState.filterSettingsError)}</div>` : ''}
          ${backgroundState.filterSettingsWarning ? `<div class="ops-activity-quick-cost-message is-warning">${escapeHtml(backgroundState.filterSettingsWarning)}</div>` : ''}
          ${backgroundState.filterSettingsNotice ? `<div class="ops-activity-quick-cost-message is-success">${escapeHtml(backgroundState.filterSettingsNotice)}</div>` : ''}
        </div>
      </div>
    `;
  }

  function renderActivityBackgroundLogEntityCell(primaryText, secondaryText) {
    const primary = normalizeText(primaryText);
    const secondary = normalizeText(secondaryText);
    const titleText = [primary, secondary].filter(Boolean).join('\n');

    if (!primary && !secondary) {
      return '<span class="ops-activity-background-log-placeholder">\u2014</span>';
    }

    return `
      <div class="ops-activity-background-log-entity"${titleText ? ` title="${escapeHtml(titleText)}"` : ''}>
        <span class="ops-activity-background-log-entity-main">${escapeHtml(primary || secondary)}</span>
        ${primary && secondary ? `<span class="ops-activity-background-log-entity-sub">${escapeHtml(secondary)}</span>` : ''}
      </div>
    `;
  }

  function renderActivityBackgroundLogTable(state) {
    const backgroundState = state && state.activityBackgroundSubmitState
      ? state.activityBackgroundSubmitState
      : buildEmptyActivityBackgroundSubmitState();
    const logs = Array.isArray(backgroundState.logs) ? backgroundState.logs.slice().reverse() : [];

    if (logs.length <= 0) {
      return `
        <div class="ops-activity-background-log-empty">
          ${backgroundState.running === true ? '\u6b63\u5728\u51c6\u5907\u540e\u53f0\u4efb\u52a1...' : '\u70b9\u51fb\u201c\u5f00\u59cb\u6267\u884c\u201d\u540e\uff0c\u8fd9\u91cc\u4f1a\u5b9e\u65f6\u663e\u793a\u5e97\u94fa\u3001\u7ad9\u70b9\u3001\u6d3b\u52a8\u3001\u5546\u54c1\u3001\u62a5\u540d\u72b6\u6001\u4e0e\u8df3\u8fc7\u539f\u56e0\u3002'}
        </div>
      `;
    }

    return `
      <div class="ops-activity-background-log-table-wrap">
        <table class="ops-activity-background-log-table">
          <thead>
            <tr>
              <th>\u65f6\u95f4</th>
              <th>\u9636\u6bb5</th>
              <th>\u5e97\u94fa</th>
              <th>\u7ad9\u70b9</th>
              <th>\u6d3b\u52a8</th>
              <th>\u5546\u54c1</th>
              <th>\u72b6\u6001</th>
              <th>\u8bf4\u660e</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((logItem) => {
      const level = normalizeText(logItem && logItem.level) || 'info';
      const shopSecondary = normalizeText(logItem && logItem.shopId) ? `ID ${normalizeText(logItem && logItem.shopId)}` : '';
      const siteSecondary = normalizeText(logItem && logItem.siteId) ? `ID ${normalizeText(logItem && logItem.siteId)}` : '';
      const activitySecondary = normalizeText(logItem && logItem.activityKey)
        ? `Key ${normalizeText(logItem && logItem.activityKey)}`
        : '';
      const productSecondary = normalizeText(logItem && logItem.productId)
        ? `ID ${normalizeText(logItem && logItem.productId)}`
        : '';

      return `
              <tr class="is-${escapeHtml(level)}" data-ops-activity-background-log-id="${escapeHtml(String(logItem && logItem.id || ''))}">
                <td class="ops-activity-background-log-time-cell">${escapeHtml(formatDateTime(logItem && logItem.createdAt))}</td>
                <td>${escapeHtml(normalizeText(logItem && logItem.phase) || '\u2014')}</td>
                <td>${renderActivityBackgroundLogEntityCell(logItem && logItem.shopName, shopSecondary)}</td>
                <td>${renderActivityBackgroundLogEntityCell(logItem && logItem.siteName, siteSecondary)}</td>
                <td>${renderActivityBackgroundLogEntityCell(logItem && logItem.activityName, activitySecondary)}</td>
                <td>${renderActivityBackgroundLogEntityCell(logItem && logItem.productName, productSecondary)}</td>
                <td><span class="ops-activity-background-log-status is-${escapeHtml(level)}">${escapeHtml(normalizeText(logItem && logItem.statusText) || '\u2014')}</span></td>
                <td class="ops-activity-background-log-message-cell">${escapeHtml(normalizeText(logItem && logItem.message) || '\u2014')}</td>
              </tr>
            `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function hasActivityBackgroundSummaryContent(summary) {
    const targetSummary = summary && typeof summary === 'object'
      ? summary
      : buildEmptyActivityBackgroundSubmitSummary();

    return [
      'totalActivityCount',
      'completedActivityCount',
      'submittedActivityCount',
      'failedActivityCount',
      'skippedActivityCount',
      'queriedProductCount',
      'eligibleProductCount',
      'skippedProductCount',
      'submitPreparedRowCount',
      'submitSuccessCount',
      'submitFailedCount',
      'submitSkippedCount'
    ].some((fieldName) => normalizeNonNegativeInteger(targetSummary[fieldName], 0) > 0);
  }

  function renderActivityBackgroundSummaryItems(summary) {
    const targetSummary = summary && typeof summary === 'object'
      ? summary
      : buildEmptyActivityBackgroundSubmitSummary();

    return `
      <span>\u5df2\u5b8c\u6210\u6d3b\u52a8 ${escapeHtml(formatInteger(targetSummary.completedActivityCount, '0'))} / ${escapeHtml(formatInteger(targetSummary.totalActivityCount, '0'))}</span>
      <span>\u5df2\u63d0\u4ea4\u6d3b\u52a8 ${escapeHtml(formatInteger(targetSummary.submittedActivityCount, '0'))}</span>
      <span>\u5f02\u5e38\u6d3b\u52a8 ${escapeHtml(formatInteger(targetSummary.failedActivityCount, '0'))}</span>
      <span>\u8df3\u8fc7\u6d3b\u52a8 ${escapeHtml(formatInteger(targetSummary.skippedActivityCount, '0'))}</span>
      <span>\u67e5\u8be2\u5546\u54c1 ${escapeHtml(formatInteger(targetSummary.queriedProductCount, '0'))}</span>
      <span>\u53ef\u62a5\u540d\u5546\u54c1 ${escapeHtml(formatInteger(targetSummary.eligibleProductCount, '0'))}</span>
      <span>\u8df3\u8fc7\u5546\u54c1 ${escapeHtml(formatInteger(targetSummary.skippedProductCount, '0'))}</span>
      <span>\u63d0\u4ea4\u6210\u529f ${escapeHtml(formatInteger(targetSummary.submitSuccessCount, '0'))}</span>
      <span>\u63d0\u4ea4\u5931\u8d25 ${escapeHtml(formatInteger(targetSummary.submitFailedCount, '0'))}</span>
      <span>\u63d0\u4ea4\u8df3\u8fc7 ${escapeHtml(formatInteger(targetSummary.submitSkippedCount, '0'))}</span>
    `;
  }

  function renderActivityBackgroundRuntimePanel(state) {
    const backgroundState = state && state.activityBackgroundSubmitState
      ? state.activityBackgroundSubmitState
      : buildEmptyActivityBackgroundSubmitState();
    const summary = backgroundState.summary || buildEmptyActivityBackgroundSubmitSummary();
    const statusKind = normalizeText(backgroundState.statusKind);
    const statusMessage = normalizeText(backgroundState.statusMessage);
    const statusClass = statusKind ? ` is-${escapeHtml(statusKind)}` : '';
    const progress = backgroundState.progress;
    const collapsed = backgroundState.summaryCollapsed === true;
    const hasContent = Boolean(
      statusMessage
      || progress
      || normalizeText(backgroundState.startedAt)
      || normalizeText(backgroundState.finishedAt)
      || hasActivityBackgroundSummaryContent(summary)
    );
    const previewItems = [
      `\u6d3b\u52a8 ${formatInteger(summary.completedActivityCount, '0')} / ${formatInteger(summary.totalActivityCount, '0')}`,
      `\u53ef\u62a5 ${formatInteger(summary.eligibleProductCount, '0')}`,
      `\u6210\u529f ${formatInteger(summary.submitSuccessCount, '0')}`,
      `\u5931\u8d25 ${formatInteger(summary.submitFailedCount, '0')}`
    ];

    if (!hasContent) {
      return '';
    }

    return `
      <div class="ops-activity-background-runtime-panel${collapsed ? ' is-collapsed' : ''}">
        <div class="ops-activity-background-runtime-head">
          <div class="ops-activity-background-runtime-head-copy">
            <strong>\u8fd0\u884c\u6982\u89c8</strong>
            <span>${escapeHtml(statusMessage || '\u5f00\u59cb\u6267\u884c\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u8fdb\u5ea6\u548c\u7ed3\u679c\u6982\u89c8')}</span>
          </div>
          <div class="ops-activity-background-runtime-head-meta">
            ${previewItems.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
          <button
            class="ops-activity-background-collapse-button"
            type="button"
            data-ops-activity-background-toggle-section="summary"
            aria-expanded="${collapsed ? 'false' : 'true'}"
          >
            ${collapsed ? '\u5c55\u5f00' : '\u6536\u8d77'}
          </button>
        </div>
        <div class="ops-activity-background-runtime-body${collapsed ? ' is-collapsed' : ''}">
          ${statusMessage ? `<div class="ops-activity-query-status${statusClass}"><span class="ops-activity-query-status-text">${escapeHtml(statusMessage)}</span></div>` : ''}
          ${progress ? renderActivityBatchProgressDetail(progress) : ''}
          <div class="ops-activity-background-summary">
            ${renderActivityBackgroundSummaryItems(summary)}
          </div>
        </div>
      </div>
    `;
  }

  function renderActivityBatchBackgroundPage(state) {
    const rows = Array.isArray(state && state.submittedActivityRows) ? state.submittedActivityRows : [];
    const backgroundState = state && state.activityBackgroundSubmitState
      ? state.activityBackgroundSubmitState
      : buildEmptyActivityBackgroundSubmitState();
    const summary = backgroundState.summary || buildEmptyActivityBackgroundSubmitSummary();
    const selectedActivities = buildSubmittedActivityBatchQueryActivities(state);
    const selectedShopCount = normalizeNonNegativeInteger(
      summary.totalShopCount,
      normalizeSelectedShopIds(selectedActivities.flatMap((activity) => activity && activity.shopIds)).length
    );
    const logHintText = normalizeText(backgroundState.logPersistWarning)
      || (
        normalizeText(backgroundState.logSessionFileName)
          ? `CSV ${backgroundState.logSessionFileName}`
          : '\u6bcf\u6b21\u540e\u53f0\u8fd0\u884c\u90fd\u4f1a\u5728\u8f6f\u4ef6\u8fd0\u884c\u76ee\u5f55\u4e0b\u5355\u72ec\u4fdd\u5b58 CSV \u65e5\u5fd7'
      );

    return `
      <section class="ops-activity-next-step-panel" data-ops-activity-next-step="true">
        <div class="ops-activity-next-step-head">
          <div class="ops-activity-next-step-title-row">
            <button
              class="ops-activity-secondary-button ops-activity-back-button"
              type="button"
              data-ops-activity-products-back="true"
              ${backgroundState.running === true ? 'disabled' : ''}
            >
              \u8fd4\u56de\u6d3b\u52a8
            </button>
            <button
              class="ops-activity-danger-button ops-activity-quick-cost-trigger"
              type="button"
              data-ops-activity-background-open-quick-cost="true"
              ${backgroundState.running === true ? 'disabled' : ''}
            >
              \u6279\u91cf\u6210\u672c\u4ef7\u9884\u8bbe
            </button>
            <button
              class="ops-activity-signup-query-button"
              type="button"
              data-ops-activity-background-restart="true"
              ${backgroundState.running === true || rows.length <= 0 ? 'disabled' : ''}
            >
              ${backgroundState.startedAt ? '\u91cd\u65b0\u6267\u884c' : '\u5f00\u59cb\u6267\u884c'}
            </button>
            ${backgroundState.running === true ? `
              <button
                class="ops-activity-danger-button"
                type="button"
                data-ops-activity-background-stop="true"
                ${backgroundState.stopping === true ? 'disabled' : ''}
              >
                ${backgroundState.stopping === true ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u4efb\u52a1'}
              </button>
            ` : ''}
          </div>
          <span class="ops-activity-query-panel-meta">
            \u5df2\u9009 ${formatInteger(rows.length, '0')} \u4e2a\u6d3b\u52a8 / ${formatInteger(selectedShopCount, '0')} \u5bb6\u5e97\u94fa
          </span>
        </div>
        ${renderActivityBackgroundFilterSettingsPanel(state)}
        ${renderActivityBackgroundRuntimePanel(state)}
        <div class="ops-activity-background-log-panel">
          <div class="ops-activity-background-log-head">
            <strong>\u6267\u884c\u65e5\u5fd7</strong>
            <span>${escapeHtml(logHintText)}</span>
          </div>
          ${renderActivityBackgroundLogTable(state)}
        </div>
      </section>
    `;
  }

  function renderActivityBatchProductSortIndicator(activeSortField, activeSortDirection, sortField) {
    if (normalizeActivityBatchProductSortField(sortField) !== normalizeActivityBatchProductSortField(activeSortField)) {
      return '\u2195';
    }

    return normalizeActivityBatchProductSortDirection(activeSortDirection) === 'desc' ? '\u2193' : '\u2191';
  }

  function renderActivityBatchProductHeaderCell(label, sortField, state, options = {}) {
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const normalizedSortField = normalizeActivityBatchProductSortField(sortField);
    const className = normalizeText(options && options.className);
    const classAttribute = className ? ` class="${escapeHtml(className)}"` : '';

    if (!normalizedSortField) {
      return `<th${classAttribute}>${label}</th>`;
    }

    const isActive = normalizedSortField === normalizeActivityBatchProductSortField(productState.sortField);
    const indicator = renderActivityBatchProductSortIndicator(productState.sortField, productState.sortDirection, normalizedSortField);

    return `
      <th${classAttribute}>
        <button
          class="ops-activity-sort-button${isActive ? ' is-active' : ''}"
          type="button"
          data-ops-activity-batch-sort-field="${escapeHtml(normalizedSortField)}"
        >
          <span>${label}</span>
          <span class="ops-activity-sort-indicator">${indicator}</span>
        </button>
      </th>
    `;
  }

  function renderActivityBatchProductControls(state) {
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const shopOptions = Array.isArray(productState.viewShopOptions) ? productState.viewShopOptions : [];
    const activityOptions = Array.isArray(productState.viewActivityOptions) ? productState.viewActivityOptions : [];
    const selectedShopId = normalizeText(productState.filterShopId);
    const selectedActivityKey = normalizeText(productState.filterActivityKey);
    const selectedCostFilter = normalizeActivityBatchCostFilter(productState.costFilter);
    const selectedSignupStatus = normalizeActivityBatchSignupStatusFilter(productState.filterSignupStatus);
    const busy = productState.loading === true || productState.submitting === true;

    return `
      <div class="ops-activity-batch-toolbar">
        <label class="ops-activity-batch-toolbar-field">
          <span>\u5e97\u94fa</span>
          <select data-ops-activity-batch-filter-shop="true" ${busy ? 'disabled' : ''}>
            <option value="">\u5168\u90e8\u5e97\u94fa</option>
            ${shopOptions.map((option) => {
      const shopId = normalizeText(option && option.shopId);
      const shopName = normalizeText(option && option.shopName) || shopId;
      return `<option value="${escapeHtml(shopId)}"${shopId === selectedShopId ? ' selected' : ''}>${escapeHtml(shopName)}</option>`;
    }).join('')}
          </select>
        </label>
        <label class="ops-activity-batch-toolbar-field">
          <span>\u6d3b\u52a8</span>
          <select data-ops-activity-batch-filter-activity="true" ${busy ? 'disabled' : ''}>
            <option value="">\u5168\u90e8\u6d3b\u52a8</option>
            ${activityOptions.map((option) => {
      const activityKey = normalizeText(option && option.activityKey);
      const activityName = normalizeText(option && option.activityName) || activityKey;
      return `<option value="${escapeHtml(activityKey)}"${activityKey === selectedActivityKey ? ' selected' : ''}>${escapeHtml(activityName)}</option>`;
    }).join('')}
          </select>
        </label>
        <label class="ops-activity-batch-toolbar-field">
          <span>\u6210\u672c\u4ef7</span>
          <select data-ops-activity-batch-filter-cost="true" ${busy ? 'disabled' : ''}>
            ${ACTIVITY_BATCH_COST_FILTER_OPTIONS.map((option) => {
      const optionValue = normalizeActivityBatchCostFilter(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;
      return `<option value="${escapeHtml(optionValue)}"${optionValue === selectedCostFilter ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`;
    }).join('')}
          </select>
        </label>
        <button
          class="ops-activity-danger-button ops-activity-quick-cost-trigger"
          type="button"
          data-ops-activity-batch-open-quick-cost="true"
          ${busy || !Array.isArray(productState.rows) || productState.rows.length <= 0 ? 'disabled' : ''}
        >
          \u6279\u91cf\u9884\u8bbe\u6210\u672c
        </button>
        <button
          class="ops-activity-danger-button"
          type="button"
          data-ops-activity-batch-open-filter-products="true"
          ${busy || !Array.isArray(productState.rows) || productState.rows.length <= 0 ? 'disabled' : ''}
        >
          \u7b5b\u9009\u6d3b\u52a8\u5546\u54c1
        </button>
        <label class="ops-activity-batch-toolbar-field">
          <span>\u62a5\u540d\u72b6\u6001</span>
          <select data-ops-activity-batch-filter-signup-status="true" ${busy ? 'disabled' : ''}>
            ${ACTIVITY_BATCH_SIGNUP_STATUS_FILTER_OPTIONS.map((option) => {
      const optionValue = normalizeActivityBatchSignupStatusFilter(option && option.value);
      const optionLabel = normalizeText(option && option.label) || optionValue;
      return `<option value="${escapeHtml(optionValue)}"${optionValue === selectedSignupStatus ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`;
    }).join('')}
          </select>
        </label>
        <button
          class="ops-activity-signup-query-button"
          type="button"
          data-ops-activity-batch-submit-products="true"
          ${productState.loading === true || productState.submitting === true || !Array.isArray(productState.rows) || productState.rows.length <= 0 ? 'disabled' : ''}
        >
          ${productState.submitting === true ? '\u63d0\u4ea4\u4e2d...' : '\u6279\u91cf\u63d0\u4ea4\u6d3b\u52a8'}
        </button>
      </div>
    `;
  }

  function renderActivityBatchProgressDetail(progressRecord) {
    const progress = normalizeActivityProductBatchProgressRecord(progressRecord);

    if (!progress.requestId) {
      return '';
    }

    if (progress.taskType === 'submit') {
      const groupDenominator = progress.currentGroupCount > 0
        ? progress.currentGroupCount
        : progress.totalGroupCount;

      return `
        <div class="ops-activity-batch-progress-detail">
          <span>\u5e97\u94fa ${escapeHtml(formatInteger(progress.currentShopIndex, '0'))} / ${escapeHtml(formatInteger(progress.totalShopCount, '0'))}</span>
          <span>${escapeHtml(progress.currentShopName || '\u2014')}</span>
          <span>\u5df2\u5b8c\u6210\u5e97\u94fa ${escapeHtml(formatInteger(progress.completedShopCount, '0'))} / ${escapeHtml(formatInteger(progress.totalShopCount, '0'))}</span>
          <span>\u5f02\u5e38\u5e97\u94fa ${escapeHtml(formatInteger(progress.failedShopCount, '0'))}</span>
          <span>\u6d3b\u52a8\u7ec4 ${escapeHtml(formatInteger(progress.currentGroupIndex, '0'))} / ${escapeHtml(formatInteger(groupDenominator, '0'))}</span>
          <span>${escapeHtml(progress.currentActivityName || '\u2014')}</span>
          <span>\u6279\u6b21 ${escapeHtml(formatInteger(progress.currentChunkIndex, '0'))} / ${escapeHtml(formatInteger(progress.currentChunkCount, '0'))}</span>
          <span>\u5f53\u524d\u6279 ${escapeHtml(formatInteger(progress.currentChunkRowCount, '0'))} \u4e2a\u5546\u54c1</span>
          <span>\u8bf7\u6c42 ${escapeHtml(formatInteger(progress.completedRequestCount, '0'))} / ${escapeHtml(formatInteger(progress.totalRequestCount, '0'))}</span>
          <span>\u6210\u529f ${escapeHtml(formatInteger(progress.successRowCount, '0'))} / \u5931\u8d25 ${escapeHtml(formatInteger(progress.failedRowCount, '0'))}</span>
          <span>\u8df3\u8fc7 ${escapeHtml(formatInteger(progress.skippedRowCount, '0'))}</span>
        </div>
      `;
    }

    return `
      <div class="ops-activity-batch-progress-detail">
        <span>\u6d3b\u52a8 ${escapeHtml(formatInteger(progress.currentActivityIndex, '0'))} / ${escapeHtml(formatInteger(progress.totalActivityCount, '0'))}</span>
        <span>${escapeHtml(progress.currentActivityName || '\u2014')}</span>
        <span>\u5e97\u94fa ${escapeHtml(formatInteger(progress.currentShopIndex, '0'))} / ${escapeHtml(formatInteger(progress.totalShopCount, '0'))}</span>
        <span>${escapeHtml(progress.currentShopName || '\u2014')}</span>
        <span>\u5f53\u524d ${escapeHtml(formatInteger(progress.currentActivityRawProductCount, '0'))} / \u6d3b\u52a8\u5546\u54c1 ${escapeHtml(formatInteger(progress.currentActivityUniqueProductCount, '0'))}</span>
        <span>\u7d2f\u8ba1 ${escapeHtml(formatInteger(progress.totalRawProductCount, '0'))} / \u6d3b\u52a8\u5546\u54c1 ${escapeHtml(formatInteger(progress.totalUniqueProductCount, '0'))}</span>
      </div>
    `;
  }

  function renderActivityBatchProductFilterDialog(state) {
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();

    if (productState.activityProductFilterDialogOpen !== true) {
      return '';
    }

    const settings = normalizeActivityProductFilterSettings(productState.activityProductFilterSettings);
    const summary = productState.activityProductFilterSummary || buildEmptyActivityProductFilterSummary();
    const filterProgress = productState.activityProductFilterProgress || buildEmptyActivityProductFilterProgress();
    const applying = productState.activityProductFilterDialogApplying === true;
    const settingsLoading = productState.activityProductFilterSettingsLoading === true;
    const settingsDirty = productState.activityProductFilterSettingsDirty === true;
    const disabled = settingsLoading || applying;
    const hasAppliedSummary = productState.activityProductFilterApplied === true && settingsDirty !== true;
    const showSummary = settingsLoading !== true && (applying || hasAppliedSummary);
    const showIdleEmpty = settingsLoading !== true && applying !== true && hasAppliedSummary !== true && settingsDirty !== true;

    return `
      <div class="ops-activity-quick-cost-modal" data-ops-activity-product-filter-backdrop="true">
        <div class="ops-activity-quick-cost-dialog ops-activity-product-filter-dialog" data-ops-activity-product-filter-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1</h3>
              <p class="ops-activity-quick-cost-subtitle">\u6279\u91cf\u89c4\u5219\u4e0e\u62a5\u540d\u9884\u89c8\u5171\u7528\u3002\u53ea\u8981\u6709 1 \u6761SKU\u4e0d\u6ee1\u8db3\u89c4\u5219\uff0c\u6574\u4e2a\u5546\u54c1\u5c31\u4e0d\u62a5\u540d\u3002</p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-ops-activity-batch-product-filter-action="close"
              ${applying ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body ops-activity-product-filter-dialog-body">
            ${applying ? `
              <div class="ops-activity-product-filter-banner is-info">
                <strong>\u6b63\u5728\u7b5b\u9009</strong>
                <span>\u5546\u54c1 ${escapeHtml(formatInteger(filterProgress.processedProductCount, '0'))} / ${escapeHtml(formatInteger(filterProgress.totalProductCount, '0'))}\uff0cSKU ${escapeHtml(formatInteger(filterProgress.processedSkuCount, '0'))} / ${escapeHtml(formatInteger(filterProgress.totalSkuCount, '0'))}</span>
              </div>
            ` : ''}
            ${productState.activityProductFilterDialogError ? `
              <div class="ops-activity-product-filter-banner is-error">${escapeHtml(productState.activityProductFilterDialogError)}</div>
            ` : ''}
            ${productState.activityProductFilterDialogWarning ? `
              <div class="ops-activity-product-filter-banner is-warning">${escapeHtml(productState.activityProductFilterDialogWarning)}</div>
            ` : ''}
            ${productState.activityProductFilterDialogNotice ? `
              <div class="ops-activity-product-filter-banner is-success">${escapeHtml(productState.activityProductFilterDialogNotice)}</div>
            ` : ''}
            <section class="ops-activity-product-filter-card">
              <div class="ops-activity-product-filter-card-head">
                <span class="ops-activity-product-filter-card-step">1</span>
                <div class="ops-activity-product-filter-card-copy">
                  <strong>\u7b5b\u9009\u89c4\u5219</strong>
                  <span>\u6309SKU\u9010\u6761\u5224\u65ad\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u3001\u5229\u6da6\u7387\u4e0e\u4fdd\u5e95\u6761\u4ef6\u3002</span>
                </div>
              </div>
              <div class="ops-activity-product-filter-card-body">
                ${settingsLoading ? `
                  <div class="ops-activity-quick-cost-empty">\u6b63\u5728\u52a0\u8f7d\u7b5b\u9009\u8bbe\u7f6e...</div>
                ` : renderActivityProductFilterSettingsFields(settings, {
                  settingAttribute: 'data-ops-activity-batch-product-filter-setting',
                  disabled
                })}
              </div>
            </section>
            <section class="ops-activity-product-filter-card">
              <div class="ops-activity-product-filter-card-head">
                <span class="ops-activity-product-filter-card-step">2</span>
                <div class="ops-activity-product-filter-card-copy">
                  <strong>\u7ed3\u679c\u6982\u89c8</strong>
                  <span>\u7b5b\u9009\u540e\u53ef\u76f4\u63a5\u7528\u4e8e\u6279\u91cf\u63d0\u4ea4\u6d3b\u52a8\u3002</span>
                </div>
              </div>
              <div class="ops-activity-product-filter-card-body">
                ${showSummary ? `
                  <div class="ops-activity-product-filter-summary">
                    <span>\u5546\u54c1\u603b\u6570 ${escapeHtml(formatInteger(summary.totalProductCount, '0'))}</span>
                    <span class="is-eligible">\u53ef\u62a5\u540d\u5546\u54c1 ${escapeHtml(formatInteger(summary.eligibleProductCount, '0'))}</span>
                    <span class="is-skip">\u8df3\u8fc7\u5546\u54c1 ${escapeHtml(formatInteger(summary.skippedProductCount, '0'))}</span>
                    <span>SKU\u603b\u6570 ${escapeHtml(formatInteger(summary.totalSkuCount, '0'))}</span>
                    <span>\u53ef\u62a5SKU ${escapeHtml(formatInteger(summary.eligibleSkuCount, '0'))}</span>
                    <span>\u8df3\u8fc7SKU ${escapeHtml(formatInteger(summary.skippedSkuCount, '0'))}</span>
                  </div>
                ` : ''}
                ${settingsDirty === true ? `
                  <div class="ops-activity-product-filter-card-note is-warning">\u7b5b\u9009\u8bbe\u7f6e\u5df2\u53d8\u66f4\uff0c\u8bf7\u91cd\u65b0\u70b9\u51fb\u201c\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1\u201d\u540e\u518d\u4f7f\u7528\u5f53\u524d\u7ed3\u679c\u3002</div>
                ` : ''}
                ${showIdleEmpty ? `
                  <div class="ops-activity-product-filter-card-note">\u5f53\u524d\u8fd8\u672a\u6267\u884c\u7b5b\u9009\uff0c\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u540e\u4f1a\u5c06\u7ed3\u679c\u5e94\u7528\u5230\u5546\u54c1\u5217\u8868\u3002</div>
                ` : ''}
                ${applying ? `
                  <div class="ops-activity-product-filter-card-note is-info">\u7cfb\u7edf\u4f1a\u8fb9\u7b5b\u9009\u8fb9\u66f4\u65b0\u7edf\u8ba1\uff0c\u7a0d\u540e\u53ef\u76f4\u63a5\u5728\u5546\u54c1\u5217\u8868\u67e5\u770b\u53ef\u62a5\u540d\u72b6\u6001\u4e0eSKU\u660e\u7ec6\u3002</div>
                ` : ''}
              </div>
            </section>
          </div>
          <div class="ops-activity-quick-cost-footer ops-activity-product-filter-dialog-footer">
            <div class="ops-activity-quick-cost-actions">
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-activity-batch-product-filter-action="close"
                ${applying ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-danger-button"
                type="button"
                data-ops-activity-batch-product-filter-action="apply"
                ${disabled ? 'disabled' : ''}
              >
                ${applying ? '\u7b5b\u9009\u4e2d...' : '\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderActivityBatchQuickCostDialog(state) {
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();

    if (productState.quickCostDialogOpen !== true) {
      return '';
    }

    const groupedEntries = groupQuickCostDialogEntries(productState.quickCostDialogEntries);
    const mergedEntryCount = normalizeNonNegativeInteger(productState.quickCostDialogMergedEntryCount, 0);
    const conflictCount = normalizeNonNegativeInteger(productState.quickCostDialogConflictCount, 0);

    return `
      <div class="ops-activity-quick-cost-modal" data-ops-activity-quick-cost-backdrop="true">
        <div class="ops-activity-quick-cost-dialog" data-ops-activity-quick-cost-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u6279\u91cf\u9884\u8bbe\u6210\u672c</h3>
              <p class="ops-activity-quick-cost-subtitle">
                \u8fd9\u91cc\u4f1a\u540c\u6b65\u5171\u4eab\u6210\u672c\u4ef7\u4e91\u7aef\uff0c\u5e76\u6309\u5e97\u94faID + \u7ad9\u70b9ID + SKU\u540d\u79f0\u805a\u5408\u5c55\u793a\uff0c\u5171 ${escapeHtml(String((productState.quickCostDialogEntries || []).length))} \u9879\u3002
              </p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-ops-activity-batch-quick-cost-action="close"
              ${productState.quickCostDialogSaving === true ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body">
            ${productState.quickCostDialogLoading === true
        ? `<div class="ops-activity-quick-cost-empty">\u6b63\u5728\u4ece\u4e91\u7aef\u52a0\u8f7d\u5171\u4eab\u6210\u672c\u9884\u8bbe...</div>`
        : groupedEntries.length <= 0
          ? `<div class="ops-activity-quick-cost-empty">\u5f53\u524d\u67e5\u8be2\u7ed3\u679c\u4e2d\u6682\u65e0\u53ef\u9884\u8bbe\u7684SKU\u660e\u7ec6</div>`
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
                          ${metaTitleParts.length > 0 ? `title="${escapeHtml(metaTitleParts.join('\n'))}"` : ''}
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
                          data-ops-activity-batch-quick-cost-input="${escapeHtml(normalizeText(entry && entry.key))}"
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
            ${productState.quickCostDialogError ? `<div class="ops-activity-quick-cost-message is-error">${escapeHtml(productState.quickCostDialogError)}</div>` : ''}
            ${productState.quickCostDialogWarning ? `<div class="ops-activity-quick-cost-message is-warning">${escapeHtml(productState.quickCostDialogWarning)}</div>` : ''}
            ${productState.quickCostDialogNotice ? `<div class="ops-activity-quick-cost-message is-success">${escapeHtml(productState.quickCostDialogNotice)}</div>` : ''}
            <div class="ops-activity-quick-cost-actions">
              <span class="ops-activity-quick-cost-message">
                \u5df2\u6c47\u603b ${escapeHtml(String((productState.quickCostDialogEntries || []).length))} \u9879
                ${mergedEntryCount > 0 ? `\uff0c\u5df2\u805a\u5408 ${escapeHtml(String(mergedEntryCount))} \u6761\u91cd\u590d\u5386\u53f2\u8bb0\u5f55` : ''}
                ${conflictCount > 0 ? `\uff0c${escapeHtml(String(conflictCount))} \u9879\u5b58\u5728\u591a\u6761\u6210\u672c\u4ef7\u8bb0\u5f55` : ''}
              </span>
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-activity-batch-quick-cost-action="close"
                ${productState.quickCostDialogSaving === true ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-ops-activity-batch-quick-cost-action="save"
                ${productState.quickCostDialogLoading === true || productState.quickCostDialogSaving === true ? 'disabled' : ''}
              >
                ${productState.quickCostDialogSaving === true ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58\u9884\u8bbe'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderActivityBackgroundQuickCostDialog(state) {
    const backgroundState = state && state.activityBackgroundSubmitState
      ? state.activityBackgroundSubmitState
      : buildEmptyActivityBackgroundSubmitState();

    if (backgroundState.quickCostDialogOpen !== true) {
      return '';
    }

    const groupedEntries = groupQuickCostDialogEntries(backgroundState.quickCostDialogEntries);
    const selectedShopCount = Math.max(
      normalizeNonNegativeInteger(backgroundState.quickCostDialogShopCount, 0),
      buildActivityBackgroundQuickCostTargetShopIds(state).length
    );
    const mergedEntryCount = normalizeNonNegativeInteger(backgroundState.quickCostDialogMergedEntryCount, 0);
    const conflictCount = normalizeNonNegativeInteger(backgroundState.quickCostDialogConflictCount, 0);

    return `
      <div class="ops-activity-quick-cost-modal" data-ops-activity-background-quick-cost-backdrop="true">
        <div class="ops-activity-quick-cost-dialog" data-ops-activity-background-quick-cost-panel="true">
          <div class="ops-activity-quick-cost-header">
            <div class="ops-activity-quick-cost-title-block">
              <h3 class="ops-activity-quick-cost-title">\u6279\u91cf\u6210\u672c\u4ef7\u9884\u8bbe</h3>
              <p class="ops-activity-quick-cost-subtitle">
                \u8fd9\u91cc\u4f1a\u6c47\u603b\u5f53\u524d\u5df2\u9009 ${escapeHtml(String(selectedShopCount))} \u5bb6\u5e97\u94fa\u5728\u9884\u89c8\u7248\u3001\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406\u3001\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u7b49\u529f\u80fd\u91cc\u5df2\u4fdd\u5b58\u7684\u5171\u4eab\u6210\u672c\u4ef7\u3002
                <br />
                \u7531\u4e8e\u540e\u53f0\u7248\u672a\u9884\u5148\u67e5\u8be2\u5546\u54c1\uff0c\u8fd9\u91cc\u53ea\u6309\u201c\u5e97\u94faID + \u7ad9\u70b9ID + SKU\u540d\u79f0\u201d\u805a\u5408\u5c55\u793a\uff0c\u82e5\u547d\u4e2d\u591a\u6761\u5386\u53f2\u8bb0\u5f55\uff0c\u9ed8\u8ba4\u53d6\u6700\u8fd1\u66f4\u65b0\u7684\u6210\u672c\u4ef7\uff1b\u5982\u679c\u5e97\u94fa\u8fd8\u672a\u5728\u5176\u4ed6\u529f\u80fd\u8bbe\u7f6e\u8fc7\u6210\u672c\u4ef7\uff0c\u8bf7\u5148\u53bb\u5176\u4ed6\u529f\u80fd\u8bbe\u7f6e\u3002
              </p>
            </div>
            <button
              class="ops-activity-quick-cost-close"
              type="button"
              data-ops-activity-background-quick-cost-action="close"
              ${backgroundState.quickCostDialogSaving === true ? 'disabled' : ''}
            >
              \u5173\u95ed
            </button>
          </div>
          <div class="ops-activity-quick-cost-body">
            ${backgroundState.quickCostDialogLoading === true
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
                          ${metaTitleParts.length > 0 ? `title="${escapeHtml(metaTitleParts.join('\n'))}"` : ''}
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
                          data-ops-activity-background-quick-cost-input="${escapeHtml(normalizeText(entry && entry.key))}"
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
            ${backgroundState.quickCostDialogError ? `<div class="ops-activity-quick-cost-message is-error">${escapeHtml(backgroundState.quickCostDialogError)}</div>` : ''}
            ${backgroundState.quickCostDialogWarning ? `<div class="ops-activity-quick-cost-message is-warning">${escapeHtml(backgroundState.quickCostDialogWarning)}</div>` : ''}
            ${backgroundState.quickCostDialogNotice ? `<div class="ops-activity-quick-cost-message is-success">${escapeHtml(backgroundState.quickCostDialogNotice)}</div>` : ''}
            <div class="ops-activity-quick-cost-actions">
              <span class="ops-activity-quick-cost-message">
                \u5df2\u6c47\u603b ${escapeHtml(String((backgroundState.quickCostDialogEntries || []).length))} \u9879
                ${mergedEntryCount > 0 ? `\uff0c\u5df2\u805a\u5408 ${escapeHtml(String(mergedEntryCount))} \u6761\u91cd\u590d\u5386\u53f2\u8bb0\u5f55` : ''}
                ${conflictCount > 0 ? `\uff0c${escapeHtml(String(conflictCount))} \u9879\u5b58\u5728\u591a\u6761\u6210\u672c\u4ef7\u8bb0\u5f55` : ''}
              </span>
              <button
                class="ops-activity-secondary-button"
                type="button"
                data-ops-activity-background-quick-cost-action="close"
                ${backgroundState.quickCostDialogSaving === true ? 'disabled' : ''}
              >
                \u53d6\u6d88
              </button>
              <button
                class="ops-activity-signup-query-button"
                type="button"
                data-ops-activity-background-quick-cost-action="save"
                ${backgroundState.quickCostDialogLoading === true || backgroundState.quickCostDialogSaving === true ? 'disabled' : ''}
              >
                ${backgroundState.quickCostDialogSaving === true ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58\u9884\u8bbe'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderActivityBatchProductTable(state) {
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const baseRows = Array.isArray(productState.rows) ? productState.rows : [];
    const rows = filterActivityBatchProductRowsBySignupStatus(baseRows, productState);
    const loading = Boolean(productState.loading);
    const statusKind = normalizeText(productState.statusKind);
    const statusMessage = normalizeText(productState.statusMessage);
    const updatedAt = normalizeText(productState.updatedAt);
    const paginationState = getActivityProductTablePaginationState(productState);

    if (loading === true && baseRows.length <= 0) {
      return `
        <div class="ops-activity-query-empty">
          <p class="ops-activity-query-empty-title">\u6b63\u5728\u9010\u4e2a\u6d3b\u52a8\u67e5\u8be2\u5546\u54c1...</p>
          ${statusMessage ? `<p class="ops-activity-placeholder-text">${escapeHtml(statusMessage)}</p>` : ''}
        </div>
      `;
    }

    if (rows.length <= 0) {
      return `
        <div class="ops-activity-query-empty">
          <p class="ops-activity-query-empty-title">${
        baseRows.length > 0 && normalizeActivityBatchSignupStatusFilter(productState.filterSignupStatus)
          ? '\u5f53\u524d\u62a5\u540d\u72b6\u6001\u7b5b\u9009\u4e0b\u6682\u65e0\u6d3b\u52a8\u5546\u54c1'
          : (statusKind === 'error' ? '\u5546\u54c1\u67e5\u8be2\u5931\u8d25' : '\u6682\u65e0\u6d3b\u52a8\u5546\u54c1')
      }</p>
          ${statusMessage ? `<p class="ops-activity-placeholder-text">${escapeHtml(statusMessage)}</p>` : ''}
        </div>
      `;
    }

    return `
      <div class="ops-activity-query-table-wrap">
        <table class="ops-activity-table">
          <thead>
            <tr>
              <th>\u56fe\u7247</th>
              ${renderActivityBatchProductHeaderCell('ProductID', 'productId', state)}
              ${renderActivityBatchProductHeaderCell('\u5546\u54c1\u540d\u79f0', 'productName', state, {
                className: 'ops-activity-batch-col-product-name'
              })}
              <th>\u53ef\u62a5\u7ad9\u70b9</th>
              ${renderActivityBatchProductHeaderCell('\u53ef\u62a5\u5e97\u94fa', 'shopName', state)}
              ${renderActivityBatchProductHeaderCell('\u6240\u5c5e\u6d3b\u52a8', 'activityName', state, {
                className: 'ops-activity-batch-col-activity-name'
              })}
              <th>\u53ef\u62a5\u4fe1\u606f</th>
              <th>\u5e93\u5b58\u4fe1\u606f</th>
              <th>\u4ef7\u683c\u4fe1\u606f</th>
              <th>SKC\u4fe1\u606f</th>
              <th>SKU\u4fe1\u606f</th>
              <th>\u62a5\u540d\u72b6\u6001</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const productId = normalizeText(row && row.productId);
              const productName = normalizeText(row && row.productName);
              const siteNamesText = buildListPreviewText(row && row.siteNames, 2);
              const siteNamesFullText = buildListFullText(row && row.siteNames);
              const availableShopNamesFullText = buildListFullText(row && row.availableShopNames);
              const activityNamesFullText = buildListFullText(row && row.activityNames);
              const pictureUrl = normalizeText(row && row.pictureUrl);

              return `
                <tr data-activity-product-id="${escapeHtml(productId)}">
                  <td>
                    ${pictureUrl ? `<img class="ops-activity-product-thumb" src="${escapeHtml(pictureUrl)}" alt="${escapeHtml(productName || productId)}" loading="lazy" />` : '<span class="ops-activity-table-empty">\u2014</span>'}
                  </td>
                  <td>${renderActivityTableCellText(productId)}</td>
                  <td class="ops-activity-batch-col-product-name">${renderActivityTableCellText(productName, { className: 'is-multiline' })}</td>
                  <td><span class="ops-activity-table-list"${siteNamesFullText ? ` title="${escapeHtml(siteNamesFullText)}"` : ''}>${escapeHtml(siteNamesText)}</span></td>
                  <td><div class="ops-activity-chip-list"${availableShopNamesFullText ? ` title="${escapeHtml(availableShopNamesFullText)}"` : ''}>${renderChipList(row && row.availableShopNames, { maxCount: 2 })}</div></td>
                  <td class="ops-activity-batch-col-activity-name"><div class="ops-activity-chip-list"${activityNamesFullText ? ` title="${escapeHtml(activityNamesFullText)}"` : ''}>${renderChipList(row && row.activityNames, { maxCount: 2 })}</div></td>
                  <td>${renderActivityTableCellLines([
                    `\u53ef\u62a5\u7ec4\u5408 ${formatInteger(row && row.activityScopeCount)}`,
                    `\u53ef\u62a5\u573a\u6b21 ${formatInteger(row && row.canEnrollSessionCount)}`
                  ], { className: 'is-multiline' })}</td>
                  <td>${renderActivityTableCellLines([
                    `\u9500\u552e\u5e93\u5b58 ${formatInteger(row && row.salesStock)}`,
                    `\u5efa\u8bae\u6d3b\u52a8\u5e93\u5b58 ${formatInteger(row && row.suggestActivityStock)}`
                  ], { className: 'is-multiline' })}</td>
                  <td>${renderActivityTableCellLines([
                    `\u65e5\u5e38\u4ef7 ${formatPriceRange(row && row.dailyPriceMin, row && row.dailyPriceMax, row && row.currency)}`,
                    `\u5efa\u8bae\u6d3b\u52a8\u4ef7 ${formatPriceRange(row && row.suggestActivityPriceMin, row && row.suggestActivityPriceMax, row && row.currency)}`
                  ], { className: 'is-multiline' })}</td>
                  <td>${renderActivitySkcDetailCell(row, state)}</td>
                  <td>${renderActivitySkuDetailCell(row, state)}</td>
                  <td>${renderActivityProductSignupStatusCell(row, state)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="ops-activity-product-footer">
        <div class="ops-activity-product-meta">
          <span>\u6d3b\u52a8\u5546\u54c1 ${formatInteger(productState.uniqueProductCount, '0')} \u6761</span>
          <span>\u5df2\u9009\u6d3b\u52a8 ${formatInteger(productState.totalActivityCount, '0')} \u4e2a</span>
          <span>\u5f53\u524d\u9875 ${formatInteger(rows.length, '0')} / ${formatInteger(paginationState.totalRows, '0')} \u884c</span>
          <span>\u7b2c ${formatInteger(paginationState.page, '1')} / ${formatInteger(paginationState.totalPages, '1')} \u9875</span>
          ${updatedAt ? `<span>\u66f4\u65b0\u4e8e ${escapeHtml(formatDateTime(updatedAt))}</span>` : ''}
        </div>
        <div class="ops-activity-product-actions">
          <div class="ops-activity-product-pager">
            <button
              class="ops-activity-secondary-button"
              type="button"
              data-ops-activity-batch-page-action="prev"
              ${paginationState.page <= 1 || loading ? 'disabled' : ''}
            >
              \u4e0a\u4e00\u9875
            </button>
            <button
              class="ops-activity-secondary-button"
              type="button"
              data-ops-activity-batch-page-action="next"
              ${paginationState.page >= paginationState.totalPages || loading ? 'disabled' : ''}
            >
              \u4e0b\u4e00\u9875
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderActivityBatchProductPage(state) {
    const productState = state && state.activityProductBatchState
      ? state.activityProductBatchState
      : buildEmptyActivityProductBatchState();
    const statusKind = normalizeText(productState.statusKind);
    const statusMessage = normalizeText(productState.statusMessage);
    const statusClass = statusKind ? ` is-${escapeHtml(statusKind)}` : '';
    const progress = productState.submitting === true
      ? (productState.submitProgress || productState.progress)
      : (productState.progress || productState.submitProgress);

    return `
      <section class="ops-activity-next-step-panel" data-ops-activity-next-step="true">
        <div class="ops-activity-next-step-head">
          <div class="ops-activity-next-step-title-row">
            <button
              class="ops-activity-secondary-button ops-activity-back-button"
              type="button"
              data-ops-activity-products-back="true"
              ${productState.loading === true || productState.submitting === true ? 'disabled' : ''}
            >
              \u8fd4\u56de\u6d3b\u52a8
            </button>
            ${renderActivityBatchProductControls(state)}
            ${productState.loading === true ? `
              <button
                class="ops-activity-danger-button"
                type="button"
                data-ops-activity-batch-stop-query="true"
                ${productState.queryCanceling === true ? 'disabled' : ''}
              >
                ${productState.queryCanceling === true ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u67e5\u8be2'}
              </button>
            ` : ''}
          </div>
          <span class="ops-activity-query-panel-meta">
            \u5df2\u9009 ${formatInteger(productState.totalActivityCount, '0')} \u4e2a\u6d3b\u52a8 / ${formatInteger(productState.totalShopCount, '0')} \u5bb6\u5e97\u94fa
          </span>
        </div>
        ${statusMessage ? `<div class="ops-activity-query-status${statusClass}"><span class="ops-activity-query-status-text">${escapeHtml(statusMessage)}</span></div>` : ''}
        ${progress ? renderActivityBatchProgressDetail(progress) : ''}
        ${renderActivityBatchProductTable(state)}
      </section>
    `;
  }

  function renderSubmittedActivityTabs(state) {
    const rows = Array.isArray(state.submittedActivityRows) ? state.submittedActivityRows : [];

    if (rows.length <= 0) {
      return '';
    }

    const activeActivityKey = normalizeText(state.activeSubmittedActivityKey) || normalizeText(rows[0] && rows[0].activityKey);

    return `
      <div class="ops-activity-submitted-tabs">
        ${rows.map((row) => {
          const activityKey = normalizeText(row && row.activityKey);
          const activityName = normalizeText(row && row.activityThematicName) || normalizeText(row && row.activityName) || '\u672a\u547d\u540d\u6d3b\u52a8';
          const isActive = activityKey && activityKey === activeActivityKey;

          return `
            <button
              class="ops-activity-submitted-tab${isActive ? ' is-active' : ''}"
              type="button"
              data-ops-activity-submitted-key="${escapeHtml(activityKey)}"
            >
              ${escapeHtml(activityName)}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderActivityProductTable(state, activityRow, productState) {
    const rows = Array.isArray(productState && productState.rows) ? productState.rows : [];
    const loading = Boolean(productState && productState.loading);
    const statusKind = normalizeText(productState && productState.statusKind);
    const statusMessage = normalizeText(productState && productState.statusMessage);
    const updatedAt = normalizeText(productState && productState.updatedAt);
    const paginationState = getActivityProductTablePaginationState(productState);
    const visibleRows = rows;

    if (loading === true && rows.length <= 0) {
      return `
        <div class="ops-activity-query-empty">
          <p class="ops-activity-query-empty-title">\u6b63\u5728\u67e5\u8be2\u6d3b\u52a8\u5546\u54c1...</p>
        </div>
      `;
    }

    if (rows.length <= 0) {
      return `
        <div class="ops-activity-query-empty">
          <p class="ops-activity-query-empty-title">${statusKind === 'error' ? '\u5546\u54c1\u67e5\u8be2\u5931\u8d25' : '\u6682\u65e0\u53ef\u62a5\u5546\u54c1'}</p>
          ${statusMessage ? `<p class="ops-activity-placeholder-text">${escapeHtml(statusMessage)}</p>` : ''}
        </div>
      `;
    }

    return `
      <div class="ops-activity-query-table-wrap">
        <table class="ops-activity-table">
          <thead>
            <tr>
              <th>\u56fe\u7247</th>
              <th>ProductID</th>
              <th>\u5546\u54c1\u540d\u79f0</th>
              <th>\u53ef\u62a5\u7ad9\u70b9</th>
              <th>\u53ef\u62a5\u5e97\u94fa</th>
              <th>\u5efa\u8bae\u6d3b\u52a8\u5e93\u5b58</th>
              <th>\u9500\u552e\u5e93\u5b58</th>
              <th>\u53ef\u62a5\u573a\u6b21</th>
              <th>\u5efa\u8bae\u6d3b\u52a8\u4ef7\u533a\u95f4</th>
              <th>\u65e5\u5e38\u4ef7\u533a\u95f4</th>
              <th>SKC\u4fe1\u606f</th>
              <th>SKU\u4fe1\u606f</th>
            </tr>
          </thead>
          <tbody>
            ${visibleRows.map((row) => {
              const productId = normalizeText(row && row.productId);
              const productName = normalizeText(row && row.productName);
              const siteNamesText = buildListPreviewText(row && row.siteNames, 2);
              const siteNamesFullText = buildListFullText(row && row.siteNames);
              const availableShopNamesFullText = buildListFullText(row && row.availableShopNames);
              const pictureUrl = normalizeText(row && row.pictureUrl);

              return `
                <tr data-activity-product-id="${escapeHtml(productId)}">
                  <td>
                    ${pictureUrl ? `<img class="ops-activity-product-thumb" src="${escapeHtml(pictureUrl)}" alt="${escapeHtml(productName || productId)}" loading="lazy" />` : '<span class="ops-activity-table-empty">\u2014</span>'}
                  </td>
                  <td>${renderActivityTableCellText(productId)}</td>
                  <td>${renderActivityTableCellText(productName, { className: 'is-multiline' })}</td>
                  <td><span class="ops-activity-table-list"${siteNamesFullText ? ` title="${escapeHtml(siteNamesFullText)}"` : ''}>${escapeHtml(siteNamesText)}</span></td>
                  <td><div class="ops-activity-chip-list"${availableShopNamesFullText ? ` title="${escapeHtml(availableShopNamesFullText)}"` : ''}>${renderChipList(row && row.availableShopNames, { maxCount: 2 })}</div></td>
                  <td>${renderActivityTableCellText(formatInteger(row && row.suggestActivityStock))}</td>
                  <td>${renderActivityTableCellText(formatInteger(row && row.salesStock))}</td>
                  <td>${renderActivityTableCellText(formatInteger(row && row.canEnrollSessionCount))}</td>
                  <td>${renderActivityTableCellText(formatPriceRange(row && row.suggestActivityPriceMin, row && row.suggestActivityPriceMax, row && row.currency))}</td>
                  <td>${renderActivityTableCellText(formatPriceRange(row && row.dailyPriceMin, row && row.dailyPriceMax, row && row.currency))}</td>
                  <td>${renderActivitySkcDetailCell(row, state)}</td>
                  <td>${renderActivitySkuDetailCell(row, state)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="ops-activity-product-footer">
        <div class="ops-activity-product-meta">
          <span>\u5df2\u53bb\u91cd ${formatInteger(productState && productState.uniqueProductCount, '0')} \u4e2a\u5546\u54c1</span>
          <span>\u5f53\u524d\u9875 ${formatInteger(visibleRows.length, '0')} / ${formatInteger(paginationState.totalRows, '0')} \u884c</span>
          <span>\u7b2c ${formatInteger(paginationState.page, '1')} / ${formatInteger(paginationState.totalPages, '1')} \u9875</span>
          ${updatedAt ? `<span>\u66f4\u65b0\u4e8e ${escapeHtml(formatDateTime(updatedAt))}</span>` : ''}
        </div>
        <div class="ops-activity-product-actions">
          <div class="ops-activity-product-pager">
            <button
              class="ops-activity-secondary-button"
              type="button"
              data-ops-activity-product-page-action="prev"
              data-ops-activity-key="${escapeHtml(normalizeText(activityRow && activityRow.activityKey))}"
              ${paginationState.page <= 1 || loading ? 'disabled' : ''}
            >
              \u4e0a\u4e00\u9875
            </button>
            <button
              class="ops-activity-secondary-button"
              type="button"
              data-ops-activity-product-page-action="next"
              data-ops-activity-key="${escapeHtml(normalizeText(activityRow && activityRow.activityKey))}"
              ${paginationState.page >= paginationState.totalPages || loading ? 'disabled' : ''}
            >
              \u4e0b\u4e00\u9875
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSubmittedActivityPanel(state) {
    const rows = Array.isArray(state.submittedActivityRows) ? state.submittedActivityRows : [];

    if (rows.length <= 0) {
      return '';
    }

    const activeActivityKey = normalizeText(state.activeSubmittedActivityKey) || normalizeText(rows[0] && rows[0].activityKey);
    const activeActivityRow = findActivityRowByKey(rows, activeActivityKey) || rows[0] || null;
    const activeProductState = getActivityProductState(state, normalizeText(activeActivityRow && activeActivityRow.activityKey));
    const statusKind = normalizeText(activeProductState && activeProductState.statusKind);
    const statusMessage = normalizeText(activeProductState && activeProductState.statusMessage);
    const statusClass = statusKind ? ` is-${escapeHtml(statusKind)}` : '';
    const activityTitle = normalizeText(activeActivityRow && activeActivityRow.activityThematicName) || normalizeText(activeActivityRow && activeActivityRow.activityName);
    const submittedShopNames = buildListPreviewText(activeActivityRow && activeActivityRow.availableShopNames, 3);
    const enrollWindowText = formatActivityEnrollWindowSummaryText(activeActivityRow);
    const activityWindowText = `${formatDateTime(activeActivityRow && activeActivityRow.startTime)} ~ ${formatDateTime(activeActivityRow && activeActivityRow.endTime)}`;

    return `
      <section class="ops-activity-next-step-panel" data-ops-activity-next-step="true">
        <div class="ops-activity-next-step-head">
          <strong class="ops-activity-query-panel-title">\u7b2c\u4e8c\u6b65\uff1a\u5546\u54c1\u8bbe\u7f6e</strong>
          <span class="ops-activity-query-panel-meta">\u5df2\u63d0\u4ea4 ${rows.length} \u4e2a\u6d3b\u52a8</span>
        </div>
        ${renderSubmittedActivityTabs(state)}
        <div class="ops-activity-next-step-summary">
          <span class="ops-activity-next-step-title">${renderActivityTableCellText(activityTitle)}</span>
          <span class="ops-activity-next-step-meta">\u6d3b\u52a8\u7c7b\u578b ${escapeHtml(formatInteger(activeActivityRow && activeActivityRow.activityType, '\u2014'))}</span>
          <span class="ops-activity-next-step-meta">\u5e97\u94fa ${escapeHtml(submittedShopNames)}</span>
          <span class="ops-activity-next-step-meta">\u62a5\u540d ${escapeHtml(enrollWindowText)}</span>
          <span class="ops-activity-next-step-meta">\u6d3b\u52a8 ${escapeHtml(activityWindowText)}</span>
        </div>
        ${statusMessage ? `<div class="ops-activity-query-status${statusClass}"><span class="ops-activity-query-status-text">${escapeHtml(statusMessage)}</span></div>` : ''}
        ${renderActivityProductTable(state, activeActivityRow, activeProductState)}
      </section>
    `;
  }

  function renderSignupShopSelector(state) {
    const control = getShopMultiSelectControl();
    const selectedShopIds = normalizeSelectedShopIds(state.signupSelectedShopIds);
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
            && Array.isArray(state.shopCatalog.shops)
            && state.shopCatalog.shops.length <= 0
        })
        : `
          <button class="shop-multi-select-trigger" type="button" disabled>
            <span class="shop-multi-select-trigger-copy">
              <span class="shop-multi-select-trigger-value">\u5e97\u94fa\u9009\u62e9\u5668\u672a\u52a0\u8f7d</span>
            </span>
          </button>
        `;

    return `
      <div class="ops-activity-signup-card">
        <div class="ops-activity-signup-card-main">
          <span class="ops-activity-signup-field-label">\u5e97\u94fa</span>
          <div class="ops-activity-signup-card-body">
            ${fieldMarkup}
          </div>
          <div class="ops-activity-signup-card-actions">
            <button
              class="ops-activity-signup-query-button ops-pd-action-button is-primary"
              type="button"
              data-ops-activity-query="true"
              ${state.activityQueryLoading === true || selectedShopIds.length <= 0 ? 'disabled' : ''}
            >
              ${state.activityQueryLoading === true ? '\u67e5\u8be2\u4e2d' : '\u67e5\u8be2\u6d3b\u52a8'}
            </button>
            <button
              class="ops-activity-secondary-button ops-activity-filter-button"
              type="button"
              data-ops-activity-filter-action="open"
            >
              \u6d3b\u52a8\u7b5b\u9009
            </button>
            ${renderSubmittedActivityToolbar(state)}
          </div>
        </div>
        ${state.shopSelectorError ? `<div class="ops-activity-signup-error">${escapeHtml(state.shopSelectorError)}</div>` : ''}
      </div>
    `;
  }

  function renderTabPanel(tab, active, state) {
    const workflowStep = normalizeText(state && state.workflowStep) || 'activity';

    return `
      <article
        class="ops-activity-panel${active ? ' is-active' : ''}"
        data-ops-activity-panel="${tab.id}"
        role="tabpanel"
        aria-label="${tab.label}"
        ${active ? '' : 'hidden'}
      >
        ${tab.id === 'signup'
          ? (workflowStep === 'products'
            ? `
              ${renderActivityBatchProductPage(state)}
            `
            : (workflowStep === 'submit-background'
              ? `
                ${renderActivityBatchBackgroundPage(state)}
              `
              : `
                ${renderSignupShopSelector(state)}
                ${renderActivityQueryPanel(state)}
              `))
          : ``}
      </article>
    `;
  }

  function captureActivityQueryTableScroll(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    const tableWrap = container.querySelector('.ops-activity-query-table-wrap');

    if (!(tableWrap instanceof HTMLElement)) {
      return null;
    }

    return {
      top: tableWrap.scrollTop,
      left: tableWrap.scrollLeft
    };
  }

  function restoreActivityQueryTableScroll(container, snapshot) {
    if (!(container instanceof HTMLElement) || !snapshot) {
      return;
    }

    const tableWrap = container.querySelector('.ops-activity-query-table-wrap');

    if (!(tableWrap instanceof HTMLElement)) {
      return;
    }

    tableWrap.scrollTop = Number(snapshot.top) || 0;
    tableWrap.scrollLeft = Number(snapshot.left) || 0;
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

  function captureActivityBackgroundLogTableScroll(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    const tableWrap = container.querySelector('.ops-activity-background-log-table-wrap');

    if (!(tableWrap instanceof HTMLElement)) {
      return null;
    }

    const wrapRect = tableWrap.getBoundingClientRect();
    const rowList = Array.from(tableWrap.querySelectorAll('tbody tr[data-ops-activity-background-log-id]'));
    let anchorLogId = '';
    let anchorOffsetTop = 0;

    for (let index = 0; index < rowList.length; index += 1) {
      const row = rowList[index];

      if (!(row instanceof HTMLElement)) {
        continue;
      }

      const rowRect = row.getBoundingClientRect();

      if (rowRect.bottom > wrapRect.top) {
        anchorLogId = normalizeText(row.getAttribute('data-ops-activity-background-log-id'));
        anchorOffsetTop = rowRect.top - wrapRect.top;
        break;
      }
    }

    return {
      top: tableWrap.scrollTop,
      left: tableWrap.scrollLeft,
      stickToTop: tableWrap.scrollTop <= ACTIVITY_BACKGROUND_LOG_TOP_STICK_THRESHOLD,
      anchorLogId,
      anchorOffsetTop
    };
  }

  function restoreActivityBackgroundLogTableScroll(container, snapshot) {
    if (!(container instanceof HTMLElement) || !snapshot) {
      return;
    }

    const tableWrap = container.querySelector('.ops-activity-background-log-table-wrap');

    if (!(tableWrap instanceof HTMLElement)) {
      return;
    }

    const previousTop = Number(snapshot.top) || 0;
    const previousLeft = Number(snapshot.left) || 0;

    tableWrap.scrollLeft = previousLeft;

    if (snapshot.stickToTop === true || previousTop <= 0) {
      tableWrap.scrollTop = 0;
      return;
    }

    const anchorLogId = normalizeText(snapshot.anchorLogId);
    const anchorOffsetTop = Number(snapshot.anchorOffsetTop) || 0;

    if (anchorLogId) {
      const anchorRow = tableWrap.querySelector(`tbody tr[data-ops-activity-background-log-id="${anchorLogId}"]`);

      if (anchorRow instanceof HTMLElement) {
        const wrapRect = tableWrap.getBoundingClientRect();
        const rowRect = anchorRow.getBoundingClientRect();
        const anchorAbsoluteTop = rowRect.top - wrapRect.top;
        const maxScrollTop = Math.max(0, tableWrap.scrollHeight - tableWrap.clientHeight);

        tableWrap.scrollTop = Math.min(maxScrollTop, Math.max(0, anchorAbsoluteTop - anchorOffsetTop));
        return;
      }
    }

    tableWrap.scrollTop = previousTop;
  }

  function flushDeferredActivityBackgroundRender(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const pendingRender = container.__opsActivityDeferredBackgroundRender;

    if (!pendingRender || typeof pendingRender !== 'object') {
      return;
    }

    container.__opsActivityDeferredBackgroundRender = null;
    render(container, pendingRender.activeTabId, {
      ...(pendingRender.options || {}),
      preserveActivityBackgroundLogTableScroll: true
    });
  }

  function render(container, activeTabId, options = {}) {
    const state = getState(container);
    const normalizedActiveTabId = normalizeTabId(activeTabId || state.activeTabId);
    const isProductWorkflow = normalizedActiveTabId === 'signup'
      && normalizeText(state && state.workflowStep) === 'products';
    const isBackgroundWorkflow = normalizedActiveTabId === 'signup'
      && normalizeText(state && state.workflowStep) === 'submit-background';
    const backgroundState = isBackgroundWorkflow
      ? ensureActivityBackgroundSubmitState(state)
      : null;

    if (
      isBackgroundWorkflow
      && backgroundState
      && backgroundState.logInteractionActive === true
      && options.deferDuringBackgroundLogInteraction !== false
    ) {
      container.__opsActivityDeferredBackgroundRender = {
        activeTabId: normalizedActiveTabId,
        options: {
          ...options
        }
      };
      return;
    }

    const shouldPreserveActivityQueryTableScroll = options && options.preserveActivityQueryTableScroll === true;
    const shouldPreserveShopSelectorPanelScroll = options && options.preserveShopSelectorPanelScroll === true;
    const shouldPreserveActivityBackgroundLogTableScroll = (
      options && Object.prototype.hasOwnProperty.call(options, 'preserveActivityBackgroundLogTableScroll')
    )
      ? options.preserveActivityBackgroundLogTableScroll === true
      : isBackgroundWorkflow;
    const activityQueryTableScrollSnapshot = shouldPreserveActivityQueryTableScroll
      ? captureActivityQueryTableScroll(container)
      : null;
    const shopSelectorPanelScrollSnapshot = shouldPreserveShopSelectorPanelScroll
      ? captureShopSelectorPanelScroll(container)
      : null;
    const activityBackgroundLogTableScrollSnapshot = shouldPreserveActivityBackgroundLogTableScroll && isBackgroundWorkflow
      ? captureActivityBackgroundLogTableScroll(container)
      : null;
    const activeTabConfig = getActivityTabConfig(normalizedActiveTabId);
    const activityHeaderText = normalizeText(activeTabConfig && activeTabConfig.label) || '\u6d3b\u52a8\u7ba1\u7406';
    state.activeTabId = normalizedActiveTabId;

    container.innerHTML = `
      <section class="ops-activity-workbench" data-ops-activity-workbench>
        <header class="ops-activity-header">
          <div class="ops-activity-header-copy">
            <p class="ops-activity-eyebrow">${isProductWorkflow ? '\u5546\u54c1\u5217\u8868' : '\u8425\u9500\u6d3b\u52a8'}</p>
            <h2 class="ops-activity-title">${isProductWorkflow ? '\u6d3b\u52a8\u5546\u54c1' : activityHeaderText}</h2>
          </div>

          ${isProductWorkflow ? '' : `
            <div class="ops-activity-tab-row" role="tablist" aria-label="\u6d3b\u52a8\u7ba1\u7406\u529f\u80fd\u5207\u6362">
              ${TAB_CONFIG.map((tab) => `
                <button
                  type="button"
                  class="ops-activity-tab${tab.id === normalizedActiveTabId ? ' is-active' : ''}"
                  data-ops-activity-tab="${tab.id}"
                  role="tab"
                  aria-selected="${tab.id === normalizedActiveTabId ? 'true' : 'false'}"
                >
                  ${tab.label}
                </button>
              `).join('')}
            </div>
          `}
        </header>

        <section class="ops-activity-panels">
          ${TAB_CONFIG.map((tab) => renderTabPanel(tab, tab.id === normalizedActiveTabId, state)).join('')}
        </section>
        ${renderActivityFilterDialog(state)}
        ${renderActivityBatchProductFilterDialog(state)}
        ${renderActivityBatchQuickCostDialog(state)}
        ${renderActivityBackgroundQuickCostDialog(state)}
      </section>
    `;

    if (state.shopSelectorOpen === true && state.shopSelectorFocusSearch === true) {
      const searchInput = container.querySelector('[data-shop-multi-select-search]');

      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();

        try {
          const cursorPosition = searchInput.value.length;
          searchInput.setSelectionRange(cursorPosition, cursorPosition);
        } catch (_error) {
          // Ignore selection sync failures.
        }
      }

      state.shopSelectorFocusSearch = false;
    }

    if (activityQueryTableScrollSnapshot) {
      restoreActivityQueryTableScroll(container, activityQueryTableScrollSnapshot);
    }

    if (shopSelectorPanelScrollSnapshot) {
      restoreShopSelectorPanelScroll(container, shopSelectorPanelScrollSnapshot);
    }

    if (activityBackgroundLogTableScrollSnapshot) {
      restoreActivityBackgroundLogTableScroll(container, activityBackgroundLogTableScrollSnapshot);
    }
  }

  function clearActivityQueryResults(state, options = {}) {
    const keepStatus = options.keepStatus === true;
    state.workflowStep = 'activity';
    state.activityQueryRows = [];
    state.activityQueryThemeTypeOptions = [];
    state.activitySelectedKeys = [];
    state.activityQueryShopResults = [];
    state.activityQuerySummary = buildEmptyActivityQuerySummary();
    state.activityQueryUpdatedAt = '';
    clearSubmittedActivityState(state);

    if (!keepStatus) {
      state.activityQueryStatusKind = 'idle';
      state.activityQueryStatusMessage = '';
    }
  }

  function normalizeActivityQuerySelectionSignature(selectedShopIds) {
    return normalizeSelectedShopIds(selectedShopIds).join('|');
  }

  function applyActivityQueryResponse(state, response) {
    const normalized = normalizeQueryResponse(response, state);
    const themeTypeOptions = buildActivityThemeTypeFilterOptions(normalized.rows);
    state.activitySortField = 'remaining';
    state.activitySortDirection = 'desc';
    state.activityQueryRows = normalized.rows;
    state.activityQueryThemeTypeOptions = themeTypeOptions;
    state.activitySelectedKeys = normalizeActivitySelectedKeys(state.activitySelectedKeys)
      .filter((activityKey) => normalized.rows.some((row) => normalizeText(row.activityKey) === activityKey));
    state.activityQueryShopResults = normalized.shopResults;
    state.activityQuerySummary = normalized.summary;
    state.activityQueryUpdatedAt = normalized.updatedAt || normalizeText(response && response.updatedAt) || new Date().toISOString();
    state.activityFilterDraftThemeTypes = filterActivityThemeTypeValuesByOptions(
      state.activityFilterDraftThemeTypes,
      themeTypeOptions
    );
    clearSubmittedActivityState(state);

    if (normalized.warning) {
      state.activityQueryStatusKind = normalized.success ? 'warning' : 'error';
      state.activityQueryStatusMessage = normalized.warning;
    } else {
      state.activityQueryStatusKind = 'success';
      state.activityQueryStatusMessage = normalized.rows.length > 0
        ? `\u67e5\u8be2\u5b8c\u6210\uff0c\u5171 ${normalized.rows.length} \u6761\u53bb\u91cd\u6d3b\u52a8`
        : '\u67e5\u8be2\u5b8c\u6210\uff0c\u6682\u65e0\u53ef\u62a5\u6d3b\u52a8';
    }
  }

  function applyActivityProductBatchQueryResponse(state, response) {
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const normalized = normalizeActivityProductBatchQueryResponse(response);
    const previousCacheKey = normalizeText(productState.cacheKey);
    const currentFilterShopId = normalizeText(productState.filterShopId);
    const currentFilterActivityKey = normalizeText(productState.filterActivityKey);
    const currentCostFilter = normalizeActivityBatchCostFilter(productState.costFilter);
    const currentSortField = normalizeActivityBatchProductSortField(productState.sortField);
    const currentSortDirection = normalizeActivityBatchProductSortDirection(productState.sortDirection);
    const mergedQuickCostEntries = mergeActivityQuickCostSnapshotEntries(
      normalized.quickCostEntries,
      productState.quickCostEntries
    );

    state.activityProductBatchState = productState;
    if (productState.progressUnsubscribe && typeof productState.progressUnsubscribe === 'function') {
      // Keep the live listener in place; it is scoped to the current request id.
    }
    productState.cacheKey = normalized.cacheKey;
    if (normalizeText(normalized.cacheKey) !== previousCacheKey) {
      productState.quickCostSnapshotLoading = false;
      productState.quickCostSnapshotCacheKey = '';
    }
    productState.requestKey = normalized.requestId || productState.requestKey;
    productState.baseRows = normalized.rows.slice();
    productState.quickCostEntries = mergedQuickCostEntries.slice();
    productState.totalShopCount = normalized.totalShopCount;
    productState.totalActivityCount = normalized.totalActivityCount;
    productState.successActivityCount = normalized.successActivityCount;
    productState.failedActivityCount = normalized.failedActivityCount;
    productState.uniqueProductCount = normalized.uniqueProductCount;
    productState.cachedRowCount = normalized.cachedRowCount;
    productState.updatedAt = normalized.updatedAt || new Date().toISOString();
    productState.pageIndex = normalized.pageIndex;
    productState.pageCount = normalized.pageCount;
    productState.tablePageSize = normalizeProductTablePageSize(normalized.pageSize || productState.tablePageSize);
    productState.tablePage = normalized.pageIndex;
    productState.activityResults = normalized.activityResults;
    productState.progress = null;
    productState.submitProgress = null;
    productState.submitRequestKey = '';
    productState.viewShopOptions = buildActivityBatchProductShopOptions(state);
    productState.viewActivityOptions = buildActivityBatchProductActivityOptions(state);
    productState.filterShopId = normalizeText(normalized.filterShopId) || currentFilterShopId;
    productState.filterActivityKey = normalizeText(normalized.filterActivityKey) || currentFilterActivityKey;
    productState.costFilter = currentCostFilter;
    productState.sortField = normalizeActivityBatchProductSortField(normalized.sortField) || currentSortField;
    productState.sortDirection = normalizeActivityBatchProductSortDirection(normalized.sortDirection) || currentSortDirection;
    rebuildActivityBatchVisibleRows(productState);

    if (normalized.warning) {
      productState.statusKind = normalized.success ? 'warning' : 'error';
      productState.statusMessage = normalized.warning;
      return;
    }

    if (productState.rows.length <= 0) {
      productState.statusKind = 'warning';
      productState.statusMessage = normalizeActivityBatchCostFilter(productState.costFilter)
        ? '\u5f53\u524d\u6210\u672c\u4ef7\u7b5b\u9009\u6761\u4ef6\u4e0b\u6682\u65e0\u6d3b\u52a8\u5546\u54c1'
        : '\u5f53\u524d\u52fe\u9009\u6d3b\u52a8\u6682\u65e0\u53ef\u62a5\u5546\u54c1';
      return;
    }

    productState.statusKind = 'success';
    productState.statusMessage = `\u5df2\u6c47\u603b ${normalized.totalActivityCount} \u4e2a\u6d3b\u52a8\uff0c\u7b2c ${normalized.pageIndex} / ${normalized.pageCount} \u9875\uff0c\u5171 ${normalized.cachedRowCount} \u6761\u6d3b\u52a8\u5546\u54c1\u8bb0\u5f55`;
  }

  async function hydrateActivityBatchQuickCostSnapshot(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const expectedCacheKey = normalizeText(options && options.cacheKey) || normalizeText(productState.cacheKey);
    const baseEntries = normalizeActivityQuickCostEntryList(productState.quickCostEntries);

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
      || !expectedCacheKey
      || productState.quickCostSnapshotLoading === true
      || productState.quickCostSnapshotCacheKey === expectedCacheKey
      || baseEntries.length <= 0
    ) {
      return null;
    }

    productState.quickCostSnapshotLoading = true;

    try {
      const response = await featureCenterApi.getOperationsSharedCostSnapshot({
        shopIds: normalizeSelectedShopIds(baseEntries.map((entry) => entry.shopId)),
        entries: baseEntries.map((entry) => ({
          shopId: entry.shopId,
          station: entry.station,
          stationLabel: entry.stationLabel,
          spec: entry.spec
        }))
      });
      const latestState = getState(container).activityProductBatchState || buildEmptyActivityProductBatchState();

      if (normalizeText(latestState.cacheKey) !== expectedCacheKey) {
        return response;
      }

      latestState.quickCostEntries = mergeActivityQuickCostSnapshotEntries(
        normalizeActivityQuickCostEntryList(latestState.quickCostEntries),
        response && response.entries
      );
      latestState.quickCostSnapshotCacheKey = expectedCacheKey;
      latestState.quickCostSnapshotLoading = false;
      rebuildActivityBatchVisibleRows(latestState);

      render(container, state.activeTabId);
      return response;
    } catch (_error) {
      const latestState = getState(container).activityProductBatchState || buildEmptyActivityProductBatchState();

      if (normalizeText(latestState.cacheKey) === expectedCacheKey) {
        latestState.quickCostSnapshotLoading = false;
      }

      return null;
    }
  }

  function buildActivityProductBatchViewRequest(productState, pageIndex) {
    const sourceState = productState && typeof productState === 'object'
      ? productState
      : buildEmptyActivityProductBatchState();

    return {
      pageIndex,
      pageSize: sourceState.tablePageSize,
      filterShopId: normalizeText(sourceState.filterShopId),
      filterActivityKey: normalizeText(sourceState.filterActivityKey),
      sortField: normalizeActivityBatchProductSortField(sourceState.sortField),
      sortDirection: normalizeActivityBatchProductSortDirection(sourceState.sortDirection)
    };
  }

  function applyActivityProductBatchProgressResponse(state, response) {
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const normalized = normalizeActivityProductBatchProgressRecord(response);

    if (productState.loading !== true) {
      return;
    }

    if (productState.requestKey && normalized.requestId && productState.requestKey !== normalized.requestId) {
      return;
    }

    productState.progress = normalized;
    productState.statusKind = 'info';
    productState.statusMessage = normalized.message || productState.statusMessage;
  }

  function applyActivityProductBatchSubmitProgressResponse(state, response) {
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const normalized = normalizeActivityProductBatchProgressRecord(response);

    if (productState.submitting !== true) {
      return;
    }

    if (productState.submitRequestKey && normalized.requestId && productState.submitRequestKey !== normalized.requestId) {
      return;
    }

    productState.submitProgress = normalized;
    productState.statusKind = 'info';
    productState.statusMessage = normalized.message || productState.statusMessage;
  }

  async function stopActivityBatchProductQuery(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const requestKey = normalizeText(productState.requestKey);
    const viewRequest = buildActivityProductBatchViewRequest(
      productState,
      Math.max(1, normalizeNonNegativeInteger(productState.tablePage || productState.pageIndex, 1))
    );

    state.activityProductBatchState = productState;

    if (!requestKey || productState.loading !== true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.cancelOperationsActivityManagementMatchProductsBatchQuery !== 'function'
    ) {
      productState.statusKind = 'error';
      productState.statusMessage = '\u505c\u6b62\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    productState.queryCanceling = true;
    productState.statusKind = 'info';
    productState.statusMessage = '\u6b63\u5728\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2...';
    render(container, state.activeTabId);

    let cancelResponse = null;

    try {
      cancelResponse = await featureCenterApi.cancelOperationsActivityManagementMatchProductsBatchQuery({
        requestId: requestKey
      });
    } catch (error) {
      productState.queryCanceling = false;
      productState.statusKind = 'error';
      productState.statusMessage = normalizeText(error && error.message) || '\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u5931\u8d25';
      render(container, state.activeTabId);
      return null;
    }

    productState.requestId += 1;
    productState.loading = false;
    productState.queryCanceling = false;
    productState.requestPromise = null;
    productState.requestKey = '';
    productState.progress = null;

    if (productState.progressUnsubscribe && typeof productState.progressUnsubscribe === 'function') {
      productState.progressUnsubscribe();
      productState.progressUnsubscribe = null;
    }

    const stoppedCacheKey = normalizeText(cancelResponse && cancelResponse.cacheKey);

    if (
      stoppedCacheKey
      && typeof featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage === 'function'
    ) {
      try {
        const pageResponse = await featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage({
          cacheKey: stoppedCacheKey,
          ...viewRequest
        });
        const normalizedPage = normalizeActivityProductBatchQueryResponse(pageResponse);
        const hasRetainedRows = normalizedPage.cachedRowCount > 0;

        applyActivityProductBatchQueryResponse(state, pageResponse);
        productState.loading = false;
        productState.queryCanceling = false;
        productState.requestPromise = null;
        productState.requestKey = '';
        productState.progress = null;
        productState.statusKind = 'warning';
        productState.statusMessage = hasRetainedRows
          ? '\u5df2\u505c\u6b62\u67e5\u8be2\uff0c\u4fdd\u7559\u5df2\u67e5\u8be2\u5230\u7684\u5546\u54c1\uff0c\u53ef\u7ee7\u7eed\u7b5b\u9009\u548c\u62a5\u540d'
          : '\u5df2\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2';
        render(container, state.activeTabId);
        void loadActivityBatchProductFilterSettings(container, {
          render: false
        });
        void hydrateActivityBatchQuickCostSnapshot(container, {
          cacheKey: normalizeText(normalizedPage.cacheKey)
        });
        return {
          canceled: true,
          requestId: requestKey,
          cacheKey: stoppedCacheKey,
          restored: hasRetainedRows
        };
      } catch (_error) {
        // Ignore cache restore errors and fall back to the generic stopped state.
      }
    }

    productState.statusKind = 'warning';
    productState.statusMessage = '\u5df2\u505c\u6b62\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2';
    render(container, state.activeTabId);
    return {
      canceled: true,
      requestId: requestKey,
      cacheKey: stoppedCacheKey
    };
  }

  function applyActivityBackgroundProgressResponse(state, response) {
    const backgroundState = state.activityBackgroundSubmitState || buildEmptyActivityBackgroundSubmitState();
    const normalized = normalizeActivityProductBatchProgressRecord(response);
    const expectedRequestId = normalized.taskType === 'submit'
      ? normalizeText(backgroundState.currentSubmitRequestId)
      : normalizeText(backgroundState.currentQueryRequestId);

    if (backgroundState.running !== true || !expectedRequestId || normalized.requestId !== expectedRequestId) {
      return;
    }

    state.activityBackgroundSubmitState = backgroundState;
    backgroundState.progress = normalized;
    backgroundState.statusKind = 'info';
    backgroundState.statusMessage = normalized.message || backgroundState.statusMessage;
    backgroundState.currentActivityName = normalizeText(normalized.currentActivityName) || backgroundState.currentActivityName;
    backgroundState.currentActivityKey = normalizeText(normalized.currentActivityKey) || backgroundState.currentActivityKey;
  }

  function ensureActivityBackgroundSubmitState(state) {
    if (!state.activityBackgroundSubmitState || typeof state.activityBackgroundSubmitState !== 'object') {
      state.activityBackgroundSubmitState = buildEmptyActivityBackgroundSubmitState();
    }

    return state.activityBackgroundSubmitState;
  }

  function shouldStopActivityBackgroundSubmit(backgroundState) {
    return Boolean(backgroundState) && (
      backgroundState.stopRequested === true
      || backgroundState.stopping === true
    );
  }

  function assertActivityBackgroundSubmitNotStopped(backgroundState) {
    if (shouldStopActivityBackgroundSubmit(backgroundState)) {
      throw buildActivityBackgroundStoppedError();
    }
  }

  async function ensureActivityBackgroundFilterSettings(container, backgroundState) {
    const featureCenterApi = getFeatureCenterApi();

    if (backgroundState.filterSettingsLoaded === true) {
      return backgroundState.filterSettings;
    }

    if (
      featureCenterApi
      && typeof featureCenterApi.getOperationsActivityManagementProductFilterSettings === 'function'
    ) {
      try {
        const response = await featureCenterApi.getOperationsActivityManagementProductFilterSettings();
        syncSharedActivityProductFilterSettingsState(getState(container), response && response.settings);
        backgroundState.filterSettingsWarning = normalizeText(response && response.warning);
        backgroundState.filterSettingsLoaded = true;
        return backgroundState.filterSettings;
      } catch (error) {
        backgroundState.filterSettingsWarning = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25';
      }
    }

    syncSharedActivityProductFilterSettingsState(getState(container), buildEmptyActivityProductFilterSettings());
    backgroundState.filterSettingsLoaded = true;
    return backgroundState.filterSettings;
  }

  async function loadActivityBackgroundFilterSettings(container, options = {}) {
    const state = getState(container);
    const backgroundState = ensureActivityBackgroundSubmitState(state);

    if (backgroundState.filterSettingsLoading === true && backgroundState.filterSettingsPromise && options.force !== true) {
      return backgroundState.filterSettingsPromise;
    }

    if (options.force !== true && backgroundState.filterSettingsLoaded === true) {
      return backgroundState.filterSettings;
    }

    if (options.force === true) {
      backgroundState.filterSettingsLoaded = false;
    }

    backgroundState.filterSettingsLoading = true;
    backgroundState.filterSettingsError = '';
    backgroundState.filterSettingsNotice = '';

    if (options.render !== false) {
      render(container, state.activeTabId);
    }

    backgroundState.filterSettingsPromise = ensureActivityBackgroundFilterSettings(container, backgroundState)
      .catch((error) => {
        backgroundState.filterSettingsError = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25';
        return backgroundState.filterSettings;
      })
      .finally(() => {
        backgroundState.filterSettingsLoading = false;
        backgroundState.filterSettingsPromise = null;

        if (options.render !== false) {
          render(container, state.activeTabId);
        }
      });

    return backgroundState.filterSettingsPromise;
  }

  async function saveActivityBackgroundFilterSettings(container, options = {}) {
    const state = getState(container);
    const backgroundState = ensureActivityBackgroundSubmitState(state);
    const featureCenterApi = getFeatureCenterApi();
    const normalizedSettings = syncSharedActivityProductFilterSettingsState(state, backgroundState.filterSettings);

    backgroundState.filterSettings = normalizedSettings;

    if (backgroundState.filterSettingsSaving === true && backgroundState.filterSettingsSavePromise && options.force !== true) {
      backgroundState.filterSettingsSaveQueued = true;
      return backgroundState.filterSettingsSavePromise;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsActivityManagementProductFilterSettings !== 'function'
    ) {
      backgroundState.filterSettingsLoaded = true;
      backgroundState.filterSettingsWarning = '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d';
      if (options.render !== false) {
        render(container, state.activeTabId);
      }
      return null;
    }

    backgroundState.filterSettingsSaving = true;
    backgroundState.filterSettingsError = '';
    backgroundState.filterSettingsNotice = '';

    backgroundState.filterSettingsSavePromise = featureCenterApi.saveOperationsActivityManagementProductFilterSettings(normalizedSettings)
      .then((response) => {
        const latestLocalSettings = normalizeActivityProductFilterSettings(backgroundState.filterSettings);
        const hasNewerDraft = !areActivityProductFilterSettingsEqual(latestLocalSettings, normalizedSettings);

        syncSharedActivityProductFilterSettingsState(
          state,
          hasNewerDraft ? latestLocalSettings : (response && response.settings)
        );
        backgroundState.filterSettingsLoaded = true;
        backgroundState.filterSettingsWarning = normalizeText(response && response.warning);
        backgroundState.filterSettingsNotice = '\u7b5b\u9009\u8bbe\u7f6e\u5df2\u4fdd\u5b58';
        return response;
      })
      .catch((error) => {
        backgroundState.filterSettingsError = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u4fdd\u5b58\u5931\u8d25';
        return null;
      })
      .finally(() => {
        backgroundState.filterSettingsSaving = false;
        backgroundState.filterSettingsSavePromise = null;

        if (backgroundState.filterSettingsSaveQueued === true) {
          backgroundState.filterSettingsSaveQueued = false;
          void saveActivityBackgroundFilterSettings(container, {
            force: true,
            render: false
          });
        }

        if (options.render !== false || backgroundState.filterSettingsError || backgroundState.filterSettingsWarning || backgroundState.filterSettingsNotice) {
          render(container, state.activeTabId);
        }
      });

    return backgroundState.filterSettingsSavePromise;
  }

  function updateActivityBackgroundFilterSetting(container, fieldName, value) {
    const state = getState(container);
    const backgroundState = ensureActivityBackgroundSubmitState(state);

    syncSharedActivityProductFilterSettingsState(
      state,
      updateActivityProductFilterSettingsDraft(
        backgroundState.filterSettings,
        fieldName,
        value
      )
    );
    backgroundState.filterSettingsError = '';
    backgroundState.filterSettingsWarning = '';
    backgroundState.filterSettingsNotice = '';
    render(container, state.activeTabId);
    void saveActivityBackgroundFilterSettings(container);
  }

  async function ensureActivityBackgroundProgressSubscription(container, backgroundState) {
    const featureCenterApi = getFeatureCenterApi();

    if (backgroundState.progressUnsubscribe || !featureCenterApi || typeof featureCenterApi.onOperationsActivityManagementBatchProgress !== 'function') {
      return;
    }

    backgroundState.progressUnsubscribe = featureCenterApi.onOperationsActivityManagementBatchProgress((progressPayload) => {
      const latestState = getState(container);
      const latestBackgroundState = ensureActivityBackgroundSubmitState(latestState);

      applyActivityBackgroundProgressResponse(latestState, progressPayload);

      if (latestBackgroundState.running === true) {
        render(container, latestState.activeTabId);
      }
    });
  }

  function clearActivityBackgroundProgressSubscription(backgroundState) {
    if (backgroundState.progressUnsubscribe && typeof backgroundState.progressUnsubscribe === 'function') {
      backgroundState.progressUnsubscribe();
      backgroundState.progressUnsubscribe = null;
    }
  }

  function buildActivityBackgroundQuickCostEntriesFromRows(rows) {
    const entryMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const shopScopes = Array.isArray(row && row.shopScopes) && row.shopScopes.length > 0
        ? row.shopScopes
        : [{
          shopId: normalizeText(row && row.shopId) || normalizeText(Array.isArray(row && row.availableShopIds) ? row.availableShopIds[0] : ''),
          shopName: normalizeText(row && row.shopName) || normalizeText(Array.isArray(row && row.availableShopNames) ? row.availableShopNames[0] : '')
        }];

      (Array.isArray(row && row.skuDetails) ? row.skuDetails : []).forEach((detail) => {
        const spec = normalizeText(buildActivityDetailSpecText(detail));
        const specAliases = buildActivityDetailSpecAliases(detail);

        if (!spec) {
          return;
        }

        const station = resolveQuickCostStationValue({
          siteId: detail && detail.siteId,
          siteName: detail && detail.siteName,
          station: detail && detail.siteId,
          stationLabel: detail && detail.siteName
        });

        shopScopes.forEach((shopScope) => {
          const shopId = normalizeText(shopScope && shopScope.shopId);
          const key = buildQuickCostEntryKey(shopId, station, spec);

          if (!key || entryMap.has(key)) {
            return;
          }

          entryMap.set(key, {
            key,
            shopId,
            shopName: normalizeText(shopScope && shopScope.shopName) || shopId,
            station,
            stationLabel: normalizeText(detail && detail.siteName) || station,
            spec,
            legacySpec: specAliases[0] || '',
            specAliases,
            costPrice: normalizeQuickCostValue(detail && detail.costPrice)
          });
        });
      });
    });

    return Array.from(entryMap.values());
  }

  async function hydrateActivityBackgroundCostEntries(container, rows) {
    const featureCenterApi = getFeatureCenterApi();
    const baseEntries = buildActivityBackgroundQuickCostEntriesFromRows(rows);

    if (
      baseEntries.length <= 0
      || !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      return baseEntries;
    }

    try {
      const response = await featureCenterApi.getOperationsSharedCostSnapshot({
        shopIds: normalizeSelectedShopIds(baseEntries.map((entry) => entry.shopId)),
        entries: baseEntries.map((entry) => ({
          shopId: entry.shopId,
          station: entry.station,
          stationLabel: entry.stationLabel,
          spec: entry.spec
        }))
      });

      return mergeActivityQuickCostSnapshotEntries(baseEntries, response && response.entries);
    } catch (_error) {
      return baseEntries;
    }
  }

  async function loadActivityBackgroundAllRows(container, activity, requestId, backgroundState) {
    const featureCenterApi = getFeatureCenterApi();
    const normalizedActivity = activity && typeof activity === 'object' ? activity : {};
    const activityName = buildActivityMatchDisplayName(normalizedActivity);

    if (
      !featureCenterApi
      || typeof featureCenterApi.queryOperationsActivityManagementMatchProductsBatch !== 'function'
      || typeof featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage !== 'function'
    ) {
      throw new Error('\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d');
    }

    const firstResponse = await featureCenterApi.queryOperationsActivityManagementMatchProductsBatch({
      shopIds: normalizeSelectedShopIds(normalizedActivity.shopIds),
      activities: [{
        activityKey: normalizeText(normalizedActivity.activityKey),
        activityName,
        activityType: normalizeOptionalNumber(normalizedActivity.activityType),
        activityThematicId: normalizeText(normalizedActivity.activityThematicId),
        shopIds: normalizeSelectedShopIds(normalizedActivity.shopIds)
      }],
      pageIndex: 1,
      pageSize: ACTIVITY_BACKGROUND_QUERY_PAGE_SIZE,
      rowCount: 50,
      requestId
    });

    assertActivityBackgroundSubmitNotStopped(backgroundState);

    if (firstResponse && firstResponse.canceled === true) {
      throw buildActivityBackgroundStoppedError();
    }

    const normalizedFirst = normalizeActivityProductBatchQueryResponse(firstResponse);

    if (normalizedFirst.success !== true && normalizedFirst.rows.length <= 0) {
      throw new Error(normalizedFirst.warning || '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u5931\u8d25');
    }

    const allRows = normalizedFirst.rows.slice();
    const pageCount = Math.max(1, normalizeNonNegativeInteger(normalizedFirst.pageCount, 1));

    for (let pageIndex = 2; pageIndex <= pageCount; pageIndex += 1) {
      assertActivityBackgroundSubmitNotStopped(backgroundState);
      const pageResponse = await featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage({
        cacheKey: normalizedFirst.cacheKey,
        pageIndex,
        pageSize: ACTIVITY_BACKGROUND_QUERY_PAGE_SIZE
      });
      const normalizedPage = normalizeActivityProductBatchQueryResponse(pageResponse);

      if (normalizedPage.success !== true && normalizedPage.rows.length <= 0) {
        throw new Error(normalizedPage.warning || '\u6d3b\u52a8\u5546\u54c1\u5206\u9875\u52a0\u8f7d\u5931\u8d25');
      }

      allRows.push(...normalizedPage.rows);
    }

    return {
      rows: allRows,
      warning: normalizeText(normalizedFirst.warning),
      cacheKey: normalizeText(normalizedFirst.cacheKey)
    };
  }

  async function buildActivityBackgroundEligibleRows(container, activity, backgroundState) {
    const queryRequestId = `activity_background_query_${Date.now().toString(36)}_${backgroundState.runId}_${normalizeText(activity && activity.activityKey)}`;
    backgroundState.currentQueryRequestId = queryRequestId;
    backgroundState.currentSubmitRequestId = '';
    backgroundState.progress = null;

    const queryResult = await loadActivityBackgroundAllRows(container, activity, queryRequestId, backgroundState);
    backgroundState.currentQueryRequestId = '';
    const costEntries = await hydrateActivityBackgroundCostEntries(container, queryResult.rows);
    const rowsWithCost = applyActivityQuickCostEntriesToRows(queryResult.rows, costEntries, {
      preferredShopId: ''
    });
    const filterResult = await applyActivityProductFilterToRowsProgressive(
      rowsWithCost,
      backgroundState.filterSettings,
      {
        chunkSize: 40,
        onProgress: (progressPayload) => {
          backgroundState.statusKind = 'info';
          backgroundState.statusMessage = `\u6b63\u5728\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1\uff1a${formatInteger(progressPayload && progressPayload.processedProductCount, '0')} / ${formatInteger(progressPayload && progressPayload.totalProductCount, '0')}`;
          render(container, getState(container).activeTabId);
        },
        shouldStop: () => shouldStopActivityBackgroundSubmit(backgroundState)
      }
    );
    const filteredRows = Array.isArray(filterResult && filterResult.rows)
      ? filterResult.rows
      : [];

    return {
      queriedRows: filteredRows,
      eligibleRows: filteredRows.filter((row) => normalizeText(row && row.activitySignupStatus) === 'eligible'),
      summary: filterResult.summary || buildEmptyActivityProductFilterSummary(),
      warning: normalizeText(queryResult.warning)
    };
  }

  async function submitActivityBackgroundRows(container, rows, backgroundState) {
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.submitOperationsActivityManagementMatchProductsBatch !== 'function'
    ) {
      throw new Error('\u6d3b\u52a8\u6279\u91cf\u63d0\u4ea4\u63a5\u53e3\u672a\u52a0\u8f7d');
    }

    const submitRequestId = `activity_background_submit_${Date.now().toString(36)}_${backgroundState.runId}`;
    backgroundState.currentSubmitRequestId = submitRequestId;
    backgroundState.progress = null;

    try {
      const response = await featureCenterApi.submitOperationsActivityManagementMatchProductsBatch({
        requestId: submitRequestId,
        rows,
        batchSize: ACTIVITY_BACKGROUND_SUBMIT_BATCH_SIZE
      });

      return normalizeActivityBatchSignupSubmitResponse(response);
    } finally {
      backgroundState.currentSubmitRequestId = '';
    }
  }

  async function executeActivityBackgroundSubmit(container) {
    const state = getState(container);
    const backgroundState = ensureActivityBackgroundSubmitState(state);
    const selectedActivities = buildSubmittedActivityBatchQueryActivities(state);
    const selectedShopIds = normalizeSelectedShopIds(selectedActivities.flatMap((activity) => activity && activity.shopIds));
    const summary = buildEmptyActivityBackgroundSubmitSummary();

    summary.totalActivityCount = selectedActivities.length;
    summary.totalShopCount = selectedShopIds.length;

    backgroundState.running = true;
    backgroundState.stopRequested = false;
    backgroundState.stopping = false;
    backgroundState.queryCanceling = false;
    backgroundState.runId += 1;
    backgroundState.startedAt = new Date().toISOString();
    backgroundState.finishedAt = '';
    backgroundState.settingsCollapsed = true;
    backgroundState.summaryCollapsed = true;
    backgroundState.currentActivityKey = '';
    backgroundState.currentActivityName = '';
    backgroundState.currentQueryRequestId = '';
    backgroundState.currentSubmitRequestId = '';
    backgroundState.progress = null;
    backgroundState.summary = summary;
    backgroundState.logs = [];
    backgroundState.nextLogId = 1;
    backgroundState.rowDecisionMessageMap = Object.create(null);
    backgroundState.logSessionId = '';
    backgroundState.logSessionPath = '';
    backgroundState.logSessionFileName = '';
    backgroundState.logSessionRowCount = 0;
    backgroundState.logPersistPromise = null;
    backgroundState.logPersistWarning = '';
    backgroundState.statusKind = 'info';
    backgroundState.statusMessage = '\u6b63\u5728\u51c6\u5907\u540e\u53f0\u62a5\u540d\u4efb\u52a1...';

    await ensureActivityBackgroundProgressSubscription(container, backgroundState);
    await ensureActivityBackgroundFilterSettings(container, backgroundState);
    await startActivityBackgroundLogSession(backgroundState);

    appendActivityBackgroundSubmitLog(
      backgroundState,
      'info',
      `\u5df2\u5f00\u59cb\u540e\u53f0\u62a5\u540d\uff0c\u5171 ${selectedActivities.length} \u4e2a\u6d3b\u52a8 / ${selectedShopIds.length} \u5bb6\u5e97\u94fa\uff0c\u7b5b\u9009\u89c4\u5219\uff1a${formatActivityProductFilterRule(backgroundState.filterSettings)}\uff0c\u4fdd\u5e95\u89c4\u5219\uff1a${formatActivityProductProfitFloorRule(backgroundState.filterSettings)}`,
      {
        phase: '\u4efb\u52a1\u5f00\u59cb',
        statusText: '\u5df2\u542f\u52a8'
      }
    );

    if (normalizeText(backgroundState.filterSettingsWarning)) {
      appendActivityBackgroundSubmitLog(backgroundState, 'warning', backgroundState.filterSettingsWarning, {
        phase: '\u89c4\u5219\u63d0\u793a',
        statusText: '\u63d0\u793a'
      });
    }
    render(container, state.activeTabId);

    try {
      for (let index = 0; index < selectedActivities.length; index += 1) {
        const activity = selectedActivities[index];
        const activityName = buildActivityMatchDisplayName(activity);

        assertActivityBackgroundSubmitNotStopped(backgroundState);
        backgroundState.currentActivityKey = normalizeText(activity && activity.activityKey);
        backgroundState.currentActivityName = activityName;
        backgroundState.statusKind = 'info';
        backgroundState.statusMessage = `\u6b63\u5728\u5904\u7406\u7b2c ${index + 1} / ${selectedActivities.length} \u4e2a\u6d3b\u52a8\uff1a${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'}`;
        appendActivityBackgroundSubmitLog(
          backgroundState,
          'info',
          `\u5f00\u59cb\u5904\u7406\u6d3b\u52a8 ${index + 1}/${selectedActivities.length}\uff1a${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'}`,
          {
            phase: '\u6d3b\u52a8\u5f00\u59cb',
            activityName,
            activityKey: normalizeText(activity && activity.activityKey),
            statusText: '\u5f00\u59cb\u5904\u7406'
          }
        );
        render(container, state.activeTabId);

        try {
          const eligibleResult = await buildActivityBackgroundEligibleRows(container, activity, backgroundState);
          const queriedRows = Array.isArray(eligibleResult && eligibleResult.queriedRows) ? eligibleResult.queriedRows : [];
          const eligibleRows = Array.isArray(eligibleResult && eligibleResult.eligibleRows) ? eligibleResult.eligibleRows : [];
          const eligibleSummary = eligibleResult && eligibleResult.summary ? eligibleResult.summary : buildEmptyActivityProductFilterSummary();
          const invalidRows = [];
          const submitRows = [];

          summary.completedActivityCount += 1;
          summary.queriedProductCount += queriedRows.length;
          summary.eligibleProductCount += normalizeNonNegativeInteger(eligibleSummary.eligibleProductCount, eligibleRows.length);
          summary.skippedProductCount += normalizeNonNegativeInteger(eligibleSummary.skippedProductCount, Math.max(0, queriedRows.length - eligibleRows.length));

          appendActivityBackgroundSubmitLog(
            backgroundState,
            eligibleRows.length > 0 ? 'success' : 'warning',
            `${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'} \u67e5\u8be2\u5b8c\u6210\uff0c\u5171 ${queriedRows.length} \u4e2a\u5546\u54c1\uff0c\u53ef\u62a5\u540d ${eligibleRows.length} \u4e2a\uff0c\u8df3\u8fc7 ${Math.max(0, queriedRows.length - eligibleRows.length)} \u4e2a`,
            {
              phase: '\u67e5\u8be2\u5b8c\u6210',
              activityName,
              activityKey: normalizeText(activity && activity.activityKey),
              statusText: eligibleRows.length > 0 ? '\u5df2\u67e5\u5230\u53ef\u62a5\u5546\u54c1' : '\u65e0\u53ef\u62a5\u5546\u54c1'
            }
          );

          appendActivityBackgroundFilterRowLogs(backgroundState, queriedRows, activity);

          if (normalizeText(eligibleResult && eligibleResult.warning)) {
            appendActivityBackgroundSubmitLog(
              backgroundState,
              'warning',
              normalizeText(eligibleResult && eligibleResult.warning),
              {
                phase: '\u67e5\u8be2\u63d0\u793a',
                activityName,
                activityKey: normalizeText(activity && activity.activityKey),
                statusText: '\u63d0\u793a'
              }
            );
          }

          eligibleRows.forEach((row) => {
            const scopedResult = buildActivityBatchSignupSubmitRowsForAllScopes(row);

            submitRows.push(...scopedResult.submitRows);
            invalidRows.push(...scopedResult.invalidRows);
          });

          summary.submitPreparedRowCount += submitRows.length;
          summary.submitSkippedCount += invalidRows.length;

          appendActivityBackgroundInvalidRowLogs(backgroundState, invalidRows);

          if (submitRows.length <= 0) {
            summary.skippedActivityCount += 1;
            appendActivityBackgroundSubmitLog(
              backgroundState,
              'warning',
              `${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'} \u6ca1\u6709\u53ef\u63d0\u4ea4\u5546\u54c1${invalidRows.length > 0 ? `\uff0c\u5df2\u8df3\u8fc7 ${invalidRows.length} \u4e2a\u7ed3\u6784\u4e0d\u5408\u683c\u5546\u54c1` : ''}`,
              {
                phase: '\u63d0\u4ea4\u51c6\u5907',
                activityName,
                activityKey: normalizeText(activity && activity.activityKey),
                statusText: '\u65e0\u53ef\u63d0\u4ea4\u5546\u54c1'
              }
            );
            continue;
          }

          assertActivityBackgroundSubmitNotStopped(backgroundState);
          backgroundState.statusKind = 'info';
          backgroundState.statusMessage = `\u6b63\u5728\u63d0\u4ea4\u6d3b\u52a8\uff1a${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'}\uff0c\u5171 ${submitRows.length} \u4e2a\u5546\u54c1`;
          appendActivityBackgroundSubmitLog(
            backgroundState,
            'info',
            `\u5df2\u901a\u8fc7\u7b5b\u9009\u5f85\u63d0\u4ea4 ${submitRows.length} \u4e2a\u5546\u54c1`,
            {
              phase: '\u63d0\u4ea4\u51c6\u5907',
              activityName,
              activityKey: normalizeText(activity && activity.activityKey),
              statusText: '\u5f85\u63d0\u4ea4'
            }
          );
          render(container, state.activeTabId);

          const submitResponse = await submitActivityBackgroundRows(container, submitRows, backgroundState);

          summary.submittedActivityCount += 1;
          summary.submitSuccessCount += normalizeNonNegativeInteger(submitResponse && submitResponse.successRowCount, 0);
          summary.submitFailedCount += normalizeNonNegativeInteger(submitResponse && submitResponse.failedRowCount, 0);
          summary.submitSkippedCount += normalizeNonNegativeInteger(submitResponse && submitResponse.skippedRowCount, 0);
          appendActivityBackgroundSubmitResultLogs(backgroundState, submitResponse);

          if (submitResponse && submitResponse.canceled === true) {
            summary.skippedActivityCount += 1;
            appendActivityBackgroundSubmitLog(
              backgroundState,
              'warning',
              `${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'} \u63d0\u4ea4\u5df2\u505c\u6b62\uff0c\u6210\u529f ${normalizeNonNegativeInteger(submitResponse && submitResponse.successRowCount, 0)} \u4e2a\uff0c\u5931\u8d25 ${normalizeNonNegativeInteger(submitResponse && submitResponse.failedRowCount, 0)} \u4e2a\uff0c\u672a\u63d0\u4ea4 ${normalizeNonNegativeInteger(submitResponse && submitResponse.skippedRowCount, 0)} \u4e2a`,
              {
                phase: '\u6d3b\u52a8\u505c\u6b62',
                activityName,
                activityKey: normalizeText(activity && activity.activityKey),
                statusText: '\u5df2\u505c\u6b62'
              }
            );
            throw buildActivityBackgroundStoppedError();
          }

          if (normalizeNonNegativeInteger(submitResponse && submitResponse.failedRowCount, 0) > 0) {
            summary.failedActivityCount += 1;
            appendActivityBackgroundSubmitLog(
              backgroundState,
              'warning',
              `${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'} \u63d0\u4ea4\u5b8c\u6210\uff0c\u6210\u529f ${normalizeNonNegativeInteger(submitResponse && submitResponse.successRowCount, 0)} \u4e2a\uff0c\u5931\u8d25 ${normalizeNonNegativeInteger(submitResponse && submitResponse.failedRowCount, 0)} \u4e2a${normalizeText(submitResponse && submitResponse.warning) ? `\uff0c${normalizeText(submitResponse && submitResponse.warning)}` : ''}`,
              {
                phase: '\u6d3b\u52a8\u5b8c\u6210',
                activityName,
                activityKey: normalizeText(activity && activity.activityKey),
                statusText: '\u90e8\u5206\u63d0\u4ea4\u5931\u8d25'
              }
            );
          } else {
            appendActivityBackgroundSubmitLog(
              backgroundState,
              'success',
              `${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'} \u63d0\u4ea4\u6210\u529f\uff0c\u6210\u529f ${normalizeNonNegativeInteger(submitResponse && submitResponse.successRowCount, submitRows.length)} \u4e2a`,
              {
                phase: '\u6d3b\u52a8\u5b8c\u6210',
                activityName,
                activityKey: normalizeText(activity && activity.activityKey),
                statusText: '\u63d0\u4ea4\u5b8c\u6210'
              }
            );
          }
        } catch (error) {
          if (isActivityBackgroundStoppedError(error)) {
            throw error;
          }

          summary.completedActivityCount += 1;
          summary.failedActivityCount += 1;
          appendActivityBackgroundSubmitLog(
            backgroundState,
            'error',
            `${activityName || '\u672a\u547d\u540d\u6d3b\u52a8'} \u6267\u884c\u5931\u8d25\uff1a${normalizeText(error && error.message) || '\u672a\u77e5\u9519\u8bef'}`,
            {
              phase: '\u6d3b\u52a8\u5f02\u5e38',
              activityName,
              activityKey: normalizeText(activity && activity.activityKey),
              statusText: '\u6267\u884c\u5931\u8d25'
            }
          );
        }
      }

      backgroundState.statusKind = summary.failedActivityCount > 0 || summary.submitSuccessCount <= 0 ? 'warning' : 'success';
      backgroundState.statusMessage = `\u540e\u53f0\u62a5\u540d\u5df2\u5b8c\u6210\uff0c\u6210\u529f\u63d0\u4ea4 ${summary.submitSuccessCount} \u4e2a\uff0c\u5931\u8d25 ${summary.submitFailedCount} \u4e2a\uff0c\u8df3\u8fc7 ${summary.submitSkippedCount} \u4e2a`;
      appendActivityBackgroundSubmitLog(
        backgroundState,
        summary.failedActivityCount > 0 ? 'warning' : 'success',
        backgroundState.statusMessage,
        {
          phase: '\u4efb\u52a1\u5b8c\u6210',
          statusText: summary.failedActivityCount > 0 ? '\u5b8c\u6210\uff08\u6709\u5931\u8d25\uff09' : '\u5df2\u5b8c\u6210'
        }
      );
    } catch (error) {
      if (isActivityBackgroundStoppedError(error)) {
        backgroundState.statusKind = 'warning';
        backgroundState.statusMessage = '\u540e\u53f0\u62a5\u540d\u4efb\u52a1\u5df2\u505c\u6b62';
        appendActivityBackgroundSubmitLog(backgroundState, 'warning', backgroundState.statusMessage, {
          phase: '\u4efb\u52a1\u505c\u6b62',
          statusText: '\u5df2\u505c\u6b62'
        });
      } else {
        backgroundState.statusKind = 'error';
        backgroundState.statusMessage = normalizeText(error && error.message) || '\u540e\u53f0\u62a5\u540d\u4efb\u52a1\u6267\u884c\u5931\u8d25';
        appendActivityBackgroundSubmitLog(backgroundState, 'error', backgroundState.statusMessage, {
          phase: '\u4efb\u52a1\u5f02\u5e38',
          statusText: '\u6267\u884c\u5931\u8d25'
        });
      }
    } finally {
      backgroundState.running = false;
      backgroundState.stopRequested = false;
      backgroundState.stopping = false;
      backgroundState.queryCanceling = false;
      backgroundState.currentQueryRequestId = '';
      backgroundState.currentSubmitRequestId = '';
      backgroundState.finishedAt = new Date().toISOString();
      await finishActivityBackgroundLogSession(backgroundState);
      clearActivityBackgroundProgressSubscription(backgroundState);
      render(container, state.activeTabId);
    }
  }

  function startActivityBackgroundSubmit(container) {
    const state = getState(container);
    const backgroundState = ensureActivityBackgroundSubmitState(state);
    const selectedActivities = buildSubmittedActivityBatchQueryActivities(state);

    if (backgroundState.running === true) {
      return backgroundState.runPromise;
    }

    if (selectedActivities.length <= 0) {
      backgroundState.statusKind = 'warning';
      backgroundState.statusMessage = '\u8bf7\u5148\u52fe\u9009\u6d3b\u52a8';
      render(container, state.activeTabId);
      return null;
    }

    backgroundState.runPromise = executeActivityBackgroundSubmit(container)
      .finally(() => {
        const latestBackgroundState = ensureActivityBackgroundSubmitState(getState(container));
        latestBackgroundState.runPromise = null;
      });

    return backgroundState.runPromise;
  }

  async function stopActivityBackgroundSubmit(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const backgroundState = ensureActivityBackgroundSubmitState(state);
    const queryRequestId = normalizeText(backgroundState.currentQueryRequestId);
    const submitRequestId = normalizeText(backgroundState.currentSubmitRequestId);

    if (backgroundState.running !== true) {
      return null;
    }

    backgroundState.stopRequested = true;
    backgroundState.stopping = true;
    backgroundState.statusKind = 'info';
    backgroundState.statusMessage = '\u6b63\u5728\u505c\u6b62\u540e\u53f0\u62a5\u540d\u4efb\u52a1...';
    appendActivityBackgroundSubmitLog(
      backgroundState,
      'info',
      '\u5df2\u53d1\u8d77\u505c\u6b62\u8bf7\u6c42\uff0c\u6b63\u5728\u7ed3\u675f\u5f53\u524d\u67e5\u8be2\u6216\u63d0\u4ea4\u4efb\u52a1',
      {
        phase: '\u4efb\u52a1\u505c\u6b62',
        statusText: '\u6b63\u5728\u505c\u6b62'
      }
    );
    render(container, state.activeTabId);

    const cancelTasks = [];

    if (
      queryRequestId
      && featureCenterApi
      && typeof featureCenterApi.cancelOperationsActivityManagementMatchProductsBatchQuery === 'function'
    ) {
      backgroundState.queryCanceling = true;
      cancelTasks.push(
        featureCenterApi.cancelOperationsActivityManagementMatchProductsBatchQuery({
          requestId: queryRequestId
        }).catch(() => null)
      );
    }

    if (
      submitRequestId
      && featureCenterApi
      && typeof featureCenterApi.cancelOperationsActivityManagementMatchProductsBatchSubmit === 'function'
    ) {
      cancelTasks.push(
        featureCenterApi.cancelOperationsActivityManagementMatchProductsBatchSubmit({
          requestId: submitRequestId
        }).catch(() => null)
      );
    }

    if (cancelTasks.length > 0) {
      try {
        await Promise.allSettled(cancelTasks);
      } finally {
        backgroundState.queryCanceling = false;
      }
    } else {
      backgroundState.queryCanceling = false;
    }

    render(container, state.activeTabId);
    return {
      stopped: true
    };
  }

  async function loadSubmittedActivityBatchProducts(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const pageIndex = Math.max(1, normalizeNonNegativeInteger(options.pageIndex, 1));
    const forceReload = options.forceReload === true;
    const viewRequest = buildActivityProductBatchViewRequest(productState, pageIndex);

    state.activityProductBatchState = productState;
    productState.viewShopOptions = buildActivityBatchProductShopOptions(state);
    productState.viewActivityOptions = buildActivityBatchProductActivityOptions(state);

    if (
      !featureCenterApi
      || typeof featureCenterApi.queryOperationsActivityManagementMatchProductsBatch !== 'function'
      || typeof featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage !== 'function'
    ) {
      productState.statusKind = 'error';
      productState.statusMessage = '\u6279\u91cf\u5546\u54c1\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    if (productState.loading === true && productState.requestPromise) {
      return productState.requestPromise;
    }

    const selectedActivities = buildSubmittedActivityBatchQueryActivities(state);

    if (selectedActivities.length <= 0) {
      productState.statusKind = 'warning';
      productState.statusMessage = '\u8bf7\u5148\u52fe\u9009\u6d3b\u52a8';
      render(container, state.activeTabId);
      return null;
    }

    productState.requestId += 1;
    const requestId = productState.requestId;
    const requestKey = `activity_batch_${Date.now().toString(36)}_${requestId}`;
    productState.loading = true;
    productState.queryCanceling = false;
    productState.requestKey = requestKey;
    productState.progress = null;
    productState.submitProgress = null;
    productState.submitRequestKey = '';
    if (productState.submitProgressUnsubscribe && typeof productState.submitProgressUnsubscribe === 'function') {
      productState.submitProgressUnsubscribe();
      productState.submitProgressUnsubscribe = null;
    }
    productState.statusKind = 'info';
    const selectedActivityNames = buildListPreviewText(
      selectedActivities.map((activity) => buildActivityMatchDisplayName(activity)),
      3
    );
    productState.statusMessage = pageIndex > 1
      ? `\u6b63\u5728\u52a0\u8f7d\u7b2c ${pageIndex} \u9875\u5546\u54c1...`
      : `\u6b63\u5728\u9010\u4e2a\u6d3b\u52a8\u67e5\u8be2\u5546\u54c1\uff0c\u5171 ${selectedActivities.length} \u4e2a\u6d3b\u52a8${selectedActivityNames ? `\uff0c\u5305\u62ec ${selectedActivityNames}` : ''}\u3002`;

    if (
      pageIndex <= 1
      && forceReload === true
      && typeof featureCenterApi.onOperationsActivityManagementBatchProgress === 'function'
    ) {
      if (productState.progressUnsubscribe && typeof productState.progressUnsubscribe === 'function') {
        productState.progressUnsubscribe();
      }

      productState.progressUnsubscribe = featureCenterApi.onOperationsActivityManagementBatchProgress((progressPayload) => {
        const currentState = getState(container).activityProductBatchState || buildEmptyActivityProductBatchState();
        const normalizedProgress = normalizeActivityProductBatchProgressRecord(progressPayload);

        if (!currentState.requestKey || normalizedProgress.requestId !== currentState.requestKey) {
          return;
        }

        applyActivityProductBatchProgressResponse(getState(container), normalizedProgress);
        render(container, state.activeTabId);
      });
    }

    render(container, state.activeTabId);

    let requestPromise = null;

    if (!forceReload && productState.cacheKey) {
      requestPromise = featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage({
        cacheKey: productState.cacheKey,
        ...viewRequest
      });
    } else {
      requestPromise = featureCenterApi.queryOperationsActivityManagementMatchProductsBatch({
        shopIds: normalizeSelectedShopIds(state.signupSelectedShopIds),
        activities: selectedActivities,
        requestId: requestKey,
        rowCount: 50,
        ...viewRequest
      });
    }

    productState.requestPromise = requestPromise;

    try {
      const response = await requestPromise;

      if (productState.requestId !== requestId) {
        return response;
      }

      const normalizedResponse = normalizeActivityProductBatchQueryResponse(response);

      if (
        !forceReload
        && productState.cacheKey
        && !normalizedResponse.success
        && normalizeText(normalizedResponse.warning).includes('\u7f13\u5b58')
      ) {
        productState.cacheKey = '';
        productState.loading = false;
        productState.requestPromise = null;
        return await loadSubmittedActivityBatchProducts(container, {
          pageIndex,
          forceReload: true
        });
      }

      applyActivityProductBatchQueryResponse(state, response);
      render(container, state.activeTabId);
      void loadActivityBatchProductFilterSettings(container, {
        render: false
      });
      void hydrateActivityBatchQuickCostSnapshot(container, {
        cacheKey: normalizeText(normalizedResponse.cacheKey)
      });
      return response;
    } catch (error) {
      if (productState.requestId !== requestId) {
        return null;
      }

      productState.statusKind = 'error';
      productState.statusMessage = normalizeText(error && error.message) || '\u6279\u91cf\u5546\u54c1\u67e5\u8be2\u5931\u8d25';
      return null;
    } finally {
      if (productState.requestId === requestId) {
        productState.loading = false;
        productState.queryCanceling = false;
        productState.requestPromise = null;
        if (productState.progressUnsubscribe && typeof productState.progressUnsubscribe === 'function') {
          productState.progressUnsubscribe();
          productState.progressUnsubscribe = null;
        }
        productState.requestKey = '';
        render(container, state.activeTabId);
      }
    }
  }

  async function changeActivityBatchTablePage(container, direction) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const paginationState = getActivityProductTablePaginationState(productState);
    const normalizedDirection = normalizeText(direction);
    const delta = normalizedDirection === 'next'
      ? 1
      : (normalizedDirection === 'prev' ? -1 : 0);

    if (!delta) {
      return;
    }

    const nextPage = Math.min(
      paginationState.totalPages,
      Math.max(1, paginationState.page + delta)
    );

    if (nextPage === paginationState.page) {
      return;
    }

    productState.tablePage = nextPage;
    await loadSubmittedActivityBatchProducts(container, {
      pageIndex: nextPage
    });
  }

  async function updateActivityBatchProductView(container, updates = {}) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    let shouldReload = false;

    state.activityProductBatchState = productState;

    if (Object.prototype.hasOwnProperty.call(updates, 'filterShopId')) {
      productState.filterShopId = normalizeText(updates.filterShopId);
      shouldReload = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'filterActivityKey')) {
      productState.filterActivityKey = normalizeText(updates.filterActivityKey);
      shouldReload = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'costFilter')) {
      productState.costFilter = normalizeActivityBatchCostFilter(updates.costFilter);
      shouldReload = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'filterSignupStatus')) {
      productState.filterSignupStatus = normalizeActivityBatchSignupStatusFilter(updates.filterSignupStatus);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'sortField')) {
      productState.sortField = normalizeActivityBatchProductSortField(updates.sortField);
      shouldReload = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'sortDirection')) {
      productState.sortDirection = normalizeActivityBatchProductSortDirection(updates.sortDirection);
      shouldReload = true;
    }

    if (shouldReload) {
      productState.tablePage = 1;
    }

    if (shouldReload && productState.cacheKey) {
      await loadSubmittedActivityBatchProducts(container, {
        pageIndex: 1
      });
      return;
    }

    render(container, state.activeTabId);
  }

  function openActivityBatchProductFilterDialog(container) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

    state.activityProductBatchState = productState;
    productState.activityProductFilterDialogOpen = true;
    productState.activityProductFilterDialogLoading = false;
    productState.activityProductFilterDialogApplying = false;
    productState.activityProductFilterDialogError = '';
    productState.activityProductFilterDialogWarning = '';
    productState.activityProductFilterDialogNotice = '';
    productState.activityProductFilterProgress = buildEmptyActivityProductFilterProgress();
    render(container, state.activeTabId);
    void loadActivityBatchProductFilterSettings(container, {
      render: true
    });
  }

  function closeActivityBatchProductFilterDialog(container) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

    state.activityProductBatchState = productState;
    productState.activityProductFilterDialogOpen = false;
    productState.activityProductFilterDialogLoading = false;
    productState.activityProductFilterDialogApplying = false;
    productState.activityProductFilterDialogError = '';
    productState.activityProductFilterDialogWarning = '';
    productState.activityProductFilterDialogNotice = '';
    productState.activityProductFilterProgress = buildEmptyActivityProductFilterProgress();
    render(container, state.activeTabId);
  }

  async function loadActivityBatchProductFilterSettings(container, options = {}) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const featureCenterApi = getFeatureCenterApi();

    state.activityProductBatchState = productState;

    if (productState.activityProductFilterSettingsLoading === true && productState.activityProductFilterSettingsPromise && options.force !== true) {
      return productState.activityProductFilterSettingsPromise;
    }

    if (options.force !== true && productState.activityProductFilterSettingsLoaded === true) {
      return productState.activityProductFilterSettings;
    }

    if (!featureCenterApi || typeof featureCenterApi.getOperationsActivityManagementProductFilterSettings !== 'function') {
      syncSharedActivityProductFilterSettingsState(state, buildEmptyActivityProductFilterSettings());
      return productState.activityProductFilterSettings;
    }

    productState.activityProductFilterDialogLoading = true;
    productState.activityProductFilterSettingsLoading = true;
    productState.activityProductFilterSettingsPromise = featureCenterApi.getOperationsActivityManagementProductFilterSettings()
      .then((response) => {
        syncSharedActivityProductFilterSettingsState(state, response && response.settings);
        productState.activityProductFilterDialogWarning = normalizeText(response && response.warning);
        return productState.activityProductFilterSettings;
      })
      .catch((error) => {
        syncSharedActivityProductFilterSettingsState(state, buildEmptyActivityProductFilterSettings());
        productState.activityProductFilterDialogWarning = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25';
        return productState.activityProductFilterSettings;
      })
      .finally(() => {
        productState.activityProductFilterDialogLoading = false;
        productState.activityProductFilterSettingsLoading = false;
        productState.activityProductFilterSettingsPromise = null;

        if (options.render !== false || productState.activityProductFilterDialogOpen === true) {
          render(container, state.activeTabId);
        }
      });

    return productState.activityProductFilterSettingsPromise;
  }

  async function saveActivityBatchProductFilterSettings(container, options = {}) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const featureCenterApi = getFeatureCenterApi();
    const normalizedSettings = syncSharedActivityProductFilterSettingsState(state, productState.activityProductFilterSettings);

    state.activityProductBatchState = productState;
    productState.activityProductFilterSettings = normalizedSettings;

    if (productState.activityProductFilterSettingsSaving === true && productState.activityProductFilterSettingsSavePromise && options.force !== true) {
      productState.activityProductFilterSettingsSaveQueued = true;
      return productState.activityProductFilterSettingsSavePromise;
    }

    if (!featureCenterApi || typeof featureCenterApi.saveOperationsActivityManagementProductFilterSettings !== 'function') {
      syncSharedActivityProductFilterSettingsState(state, normalizedSettings);
      return {
        settings: normalizedSettings,
        source: 'default',
        localSaved: false,
        cloudSynced: false,
        warning: '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
      };
    }

    productState.activityProductFilterSettingsSaving = true;
    productState.activityProductFilterSettingsSavePromise = featureCenterApi.saveOperationsActivityManagementProductFilterSettings(normalizedSettings)
      .then((response) => {
        const latestLocalSettings = normalizeActivityProductFilterSettings(productState.activityProductFilterSettings);
        const hasNewerDraft = !areActivityProductFilterSettingsEqual(latestLocalSettings, normalizedSettings);

        syncSharedActivityProductFilterSettingsState(
          state,
          hasNewerDraft ? latestLocalSettings : (response && response.settings)
        );
        productState.activityProductFilterDialogWarning = normalizeText(response && response.warning);
        return response;
      })
      .catch((error) => {
        productState.activityProductFilterDialogWarning = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u4fdd\u5b58\u5931\u8d25';
        return null;
      })
      .finally(() => {
        productState.activityProductFilterSettingsSaving = false;
        productState.activityProductFilterSettingsSavePromise = null;

        if (productState.activityProductFilterSettingsSaveQueued === true) {
          productState.activityProductFilterSettingsSaveQueued = false;
          void saveActivityBatchProductFilterSettings(container, {
            force: true
          });
        }

        if (
          productState.activityProductFilterDialogOpen === true
          && (options.render === true || Boolean(productState.activityProductFilterDialogWarning))
        ) {
          render(container, state.activeTabId);
        }
      });

    return productState.activityProductFilterSettingsSavePromise;
  }

  function updateActivityBatchProductFilterSetting(container, fieldName, value) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

    state.activityProductBatchState = productState;
    syncSharedActivityProductFilterSettingsState(
      state,
      updateActivityProductFilterSettingsDraft(
        productState.activityProductFilterSettings,
        fieldName,
        value
      )
    );

    productState.activityProductFilterDialogError = '';
    productState.activityProductFilterDialogWarning = '';
    productState.activityProductFilterDialogNotice = '';
    productState.activityProductFilterProgress = buildEmptyActivityProductFilterProgress();
    productState.activityProductFilterDialogLoading = false;
    render(container, state.activeTabId);
    void saveActivityBatchProductFilterSettings(container);
  }

  async function applyActivityBatchProductFilterDialog(container) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const settings = syncSharedActivityProductFilterSettingsState(state, productState.activityProductFilterSettings);
    const mode = normalizeActivityProductFilterMode(settings.mode);

    state.activityProductBatchState = productState;
    productState.activityProductFilterSettings = settings;
    void saveActivityBatchProductFilterSettings(container);
    productState.activityProductFilterDialogApplying = true;
    productState.activityProductFilterDialogError = '';
    productState.activityProductFilterDialogWarning = '';
    productState.activityProductFilterDialogNotice = '';
    productState.activityProductFilterProgress = buildEmptyActivityProductFilterProgress();
    render(container, state.activeTabId);

    if (mode !== 'suggestActivityPrice' && normalizeOptionalNumber(settings.modeValue) === null) {
      productState.activityProductFilterDialogApplying = false;
      productState.activityProductFilterDialogError = mode === 'dailyDiscount'
        ? '\u8bf7\u5148\u586b\u5199\u65e5\u5e38\u4ef7\u6298\u6263'
        : (mode === 'saleProfitRate'
          ? '\u8bf7\u5148\u586b\u5199\u552e\u4ef7\u5229\u6da6\u7387'
        : (mode === 'profitRateDiscount'
          ? '\u8bf7\u5148\u586b\u5199\u6210\u672c\u5229\u6da6\u7387'
          : (mode === 'dailyReduce'
            ? '\u8bf7\u5148\u586b\u5199\u51cf\u5c11\u91d1\u989d'
            : '\u8bf7\u5148\u586b\u5199\u6210\u672c\u4ef7\u52a0\u4ef7\u91d1\u989d')));
      productState.activityProductFilterProgress = buildEmptyActivityProductFilterProgress();
      render(container, state.activeTabId);
      return;
    }

    try {
      const sourceResult = await collectActivityBatchViewRows(container, {
        includeActivityFilter: false,
        eligibleOnly: false
      });

      if (normalizeText(sourceResult && sourceResult.warning)) {
        throw new Error(normalizeText(sourceResult.warning));
      }

      const sourceRows = Array.isArray(sourceResult && sourceResult.rows) ? sourceResult.rows : [];
      const totalSkuCount = sourceRows.reduce((count, row) => (
        count + (Array.isArray(row && row.skuDetails) ? row.skuDetails.length : 0)
      ), 0);

      productState.activityProductFilterProgress = {
        processedProductCount: 0,
        totalProductCount: sourceRows.length,
        processedSkuCount: 0,
        totalSkuCount,
        updatedAt: new Date().toISOString()
      };
      render(container, state.activeTabId);

      const filterResult = await applyActivityProductFilterToRowsProgressive(sourceRows, settings, {
        chunkSize: 40,
        onProgress: (progressPayload) => {
          const latestState = getState(container).activityProductBatchState || buildEmptyActivityProductBatchState();

          if (latestState.activityProductFilterDialogApplying !== true) {
            return;
          }

          latestState.activityProductFilterSummary = progressPayload && progressPayload.summary
            ? progressPayload.summary
            : latestState.activityProductFilterSummary;
          latestState.activityProductFilterProgress = {
            processedProductCount: normalizeNonNegativeInteger(progressPayload && progressPayload.processedProductCount, 0),
            totalProductCount: normalizeNonNegativeInteger(progressPayload && progressPayload.totalProductCount, sourceRows.length),
            processedSkuCount: normalizeNonNegativeInteger(progressPayload && progressPayload.processedSkuCount, 0),
            totalSkuCount: normalizeNonNegativeInteger(progressPayload && progressPayload.totalSkuCount, totalSkuCount),
            updatedAt: normalizeText(progressPayload && progressPayload.updatedAt) || new Date().toISOString()
          };
          render(container, state.activeTabId);
        }
      });

      productState.activityProductFilterApplied = true;
      productState.activityProductFilterAppliedSettings = normalizeActivityProductFilterSettings(settings);
      productState.activityProductFilterSettingsDirty = false;
      rebuildActivityBatchVisibleRows(productState);
      productState.activityProductFilterRows = Array.isArray(productState.rows) ? productState.rows.slice() : [];
      productState.activityProductFilterSummary = filterResult.summary;
      productState.activityProductFilterResultMap = filterResult.resultMap;
      productState.activityProductFilterDialogApplying = false;
      productState.activityProductFilterProgress = {
        processedProductCount: normalizeNonNegativeInteger(filterResult && filterResult.progress && filterResult.progress.processedProductCount, sourceRows.length),
        totalProductCount: normalizeNonNegativeInteger(filterResult && filterResult.progress && filterResult.progress.totalProductCount, sourceRows.length),
        processedSkuCount: normalizeNonNegativeInteger(filterResult && filterResult.progress && filterResult.progress.processedSkuCount, filterResult.summary.totalSkuCount),
        totalSkuCount: normalizeNonNegativeInteger(filterResult && filterResult.progress && filterResult.progress.totalSkuCount, totalSkuCount),
        updatedAt: normalizeText(filterResult && filterResult.progress && filterResult.progress.updatedAt) || new Date().toISOString()
      };
      productState.activityProductFilterDialogNotice = `\u5df2\u7b5b\u51fa ${formatInteger(filterResult.summary.eligibleProductCount, '0')} \u4e2a\u53ef\u62a5\u540d\u5546\u54c1\uff0c\u8df3\u8fc7 ${formatInteger(filterResult.summary.skippedProductCount, '0')} \u4e2a\u5546\u54c1`;
      productState.statusKind = 'success';
      productState.statusMessage = productState.activityProductFilterDialogNotice;
      render(container, state.activeTabId);
    } catch (error) {
      productState.activityProductFilterDialogApplying = false;
      productState.activityProductFilterProgress = buildEmptyActivityProductFilterProgress();
      productState.activityProductFilterDialogError = normalizeText(error && error.message) || '\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1\u5931\u8d25';
      render(container, state.activeTabId);
    }
  }

  function toActivitySubmitRequestValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    if (!/^\d+$/.test(normalizedValue)) {
      return normalizedValue;
    }

    const numericValue = Number(normalizedValue);
    return Number.isSafeInteger(numericValue) ? numericValue : normalizedValue;
  }

  function buildActivityBatchSignupSessionIds(scope, row) {
    const sourceIds = normalizeTextArray(
      (scope && Array.isArray(scope.suggestEnrollSessionIdList) && scope.suggestEnrollSessionIdList.length > 0)
        ? scope.suggestEnrollSessionIdList
        : (
          (scope && Array.isArray(scope.enrollSessionIdList) && scope.enrollSessionIdList.length > 0)
            ? scope.enrollSessionIdList
            : (
              Array.isArray(row && row.suggestEnrollSessionIdList) && row.suggestEnrollSessionIdList.length > 0
                ? row.suggestEnrollSessionIdList
                : row && row.enrollSessionIdList
            )
        )
    );

    return sourceIds
      .map((sessionId) => toActivitySubmitRequestValue(sessionId))
      .filter((sessionId) => sessionId !== '');
  }

  function resolveActivityBatchSignupScopeSiteIds(scope, row) {
    return normalizeTextArray(
      scope && Array.isArray(scope.siteIds) && scope.siteIds.length > 0
        ? scope.siteIds
        : (row && row.siteIds)
    );
  }

  function resolveActivityBatchSignupScopedSkuDetails(row, scope) {
    const skuDetails = Array.isArray(row && row.skuDetails) ? row.skuDetails : [];
    const scopedSiteIds = resolveActivityBatchSignupScopeSiteIds(scope, row);
    const scopedSiteIdSet = new Set(scopedSiteIds);

    if (scopedSiteIdSet.size <= 0) {
      return skuDetails.slice();
    }

    return skuDetails.filter((detail) => {
      const detailSiteId = normalizeText(detail && detail.siteId);

      if (detailSiteId) {
        return scopedSiteIdSet.has(detailSiteId);
      }

      return scopedSiteIds.length === 1;
    });
  }

  function buildActivityBatchSignupSubmitRow(row, selectedShopId) {
    const normalizedSelectedShopId = normalizeText(selectedShopId);
    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    const activityScope = normalizedSelectedShopId
      ? activityScopes.find((scopeItem) => normalizeText(scopeItem && scopeItem.shopId) === normalizedSelectedShopId)
      : (activityScopes[0] || null);
    const rowKey = buildActivityProductFilterStateKey(row);
    const productId = normalizeText(row && row.productId);
    const activityKey = normalizeText(activityScope && activityScope.activityKey)
      || normalizeText(Array.isArray(row && row.activityKeys) ? row.activityKeys[0] : '');
    const activityType = normalizeOptionalNumber(activityScope && activityScope.activityType);
    const activityThematicId = normalizeText(activityScope && activityScope.activityThematicId);
    const activityName = normalizeText(activityScope && activityScope.activityName)
      || normalizeText(Array.isArray(row && row.activityNames) ? row.activityNames[0] : '');
    const shopId = normalizeText(activityScope && activityScope.shopId) || normalizedSelectedShopId;
    const shopName = normalizeText(activityScope && activityScope.shopName)
      || normalizeText(Array.isArray(row && row.availableShopNames) ? row.availableShopNames[0] : '')
      || shopId;
    const activityStock = normalizeNonNegativeInteger(
      row && row.suggestActivityStock,
      normalizeNonNegativeInteger(row && row.targetActivityStock, 0)
    );
    const sessionIds = buildActivityBatchSignupSessionIds(activityScope, row);
    const scopedSiteIds = resolveActivityBatchSignupScopeSiteIds(activityScope, row);
    const scopedSkuDetails = resolveActivityBatchSignupScopedSkuDetails(row, activityScope);
    const siteMap = new Map();
    let validSkuCount = 0;

    if (!productId || !shopId || activityType === null || activityStock <= 0 || sessionIds.length <= 0) {
      return null;
    }

    scopedSkuDetails.forEach((detail) => {
      const skuId = normalizeText(detail && detail.skuId);
      const skcId = normalizeText(detail && detail.skcId);
      const siteId = normalizeText(detail && detail.siteId)
        || normalizeText(scopedSiteIds[0])
        || normalizeText(Array.isArray(row && row.siteIds) ? row.siteIds[0] : '');
      const siteName = normalizeText(detail && detail.siteName)
        || normalizeText(activityScope && Array.isArray(activityScope.siteNames) ? activityScope.siteNames[0] : '')
        || normalizeText(Array.isArray(row && row.siteNames) ? row.siteNames[0] : '')
        || siteId;
      const activitySubmitPrice = normalizeOptionalNumber(detail && detail.activitySubmitPrice);
      const suggestActivityPrice = normalizeOptionalNumber(detail && detail.suggestActivityPrice);

      if (
        normalizeText(detail && detail.activitySignupStatus) !== 'eligible'
        || !skuId
        || !skcId
        || !siteId
        || activitySubmitPrice === null
        || activitySubmitPrice <= 0
        || (suggestActivityPrice !== null && suggestActivityPrice > 0 && activitySubmitPrice > suggestActivityPrice)
      ) {
        return;
      }

      const siteKey = siteId;

      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, {
          siteId: toActivitySubmitRequestValue(siteId),
          siteName,
          skcMap: new Map()
        });
      }

      const siteEntry = siteMap.get(siteKey);

      if (!normalizeText(siteEntry && siteEntry.siteName) && siteName) {
        siteEntry.siteName = siteName;
      }

      if (!siteEntry.skcMap.has(skcId)) {
        siteEntry.skcMap.set(skcId, {
          skcId: toActivitySubmitRequestValue(skcId),
          skuList: []
        });
      }

      siteEntry.skcMap.get(skcId).skuList.push({
        skuId: toActivitySubmitRequestValue(skuId),
        activityPrice: Math.max(1, Math.round(activitySubmitPrice))
      });
      validSkuCount += 1;
    });

    const siteInfoList = Array.from(siteMap.values())
      .map((siteEntry) => ({
        siteId: siteEntry.siteId,
        skcList: Array.from(siteEntry.skcMap.values()).filter((skcEntry) => Array.isArray(skcEntry.skuList) && skcEntry.skuList.length > 0)
      }))
      .filter((siteEntry) => Array.isArray(siteEntry.skcList) && siteEntry.skcList.length > 0);
    const siteEntries = Array.from(siteMap.values());
    const siteIds = normalizeTextArray(siteEntries.map((item) => item && item.siteId));
    const siteNames = normalizeTextArray(siteEntries.map((item) => item && item.siteName));

    if (validSkuCount <= 0 || siteInfoList.length <= 0) {
      return null;
    }

    const submitScopeKey = buildActivityBatchSubmitScopeKey({
      shopId,
      activityKey,
      activityType,
      activityThematicId,
      productId
    });

    return {
      rowKey,
      submitScopeKey,
      productId,
      productName: normalizeText(row && row.productName),
      shopId,
      shopName,
      activityKey,
      activityType,
      activityThematicId,
      activityName,
      siteIds,
      siteNames,
      productPayload: {
        productId: toActivitySubmitRequestValue(productId),
        activityStock,
        siteInfoList,
        sessionIds
      }
    };
  }

  function buildActivityBatchSignupPreviewInvalidMessage(row, selectedShopId) {
    const normalizedSelectedShopId = normalizeText(selectedShopId);
    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    const activityScope = normalizedSelectedShopId
      ? activityScopes.find((scopeItem) => normalizeText(scopeItem && scopeItem.shopId) === normalizedSelectedShopId)
      : (activityScopes[0] || null);
    const activityStock = normalizeNonNegativeInteger(
      row && row.suggestActivityStock,
      normalizeNonNegativeInteger(row && row.targetActivityStock, 0)
    );
    const skuDetails = resolveActivityBatchSignupScopedSkuDetails(row, activityScope);

    if (!normalizeText(row && row.productId)) {
      return '\u5546\u54c1ID\u7f3a\u5931';
    }

    if (!normalizeText(row && row.shopId) && !activityScope) {
      return '\u5546\u54c1\u672a\u5339\u914d\u5230\u5e97\u94fa';
    }

    if (normalizeOptionalNumber(activityScope && activityScope.activityType) === null) {
      return '\u6d3b\u52a8\u7c7b\u578b\u7f3a\u5931';
    }

    if (activityStock <= 0) {
      return '\u5efa\u8bae\u6d3b\u52a8\u5e93\u5b58\u7f3a\u5931';
    }

    if (buildActivityBatchSignupSessionIds(activityScope, row).length <= 0) {
      return '\u53ef\u62a5\u573a\u6b21\u7f3a\u5931';
    }

    if (skuDetails.length <= 0) {
      return '\u53ef\u62a5\u7ad9\u70b9SKU\u7f3a\u5931';
    }

    for (const detail of skuDetails) {
      const skuId = normalizeText(detail && detail.skuId);
      const skcId = normalizeText(detail && detail.skcId);
      const siteId = normalizeText(detail && detail.siteId);
      const activitySubmitPrice = normalizeOptionalNumber(detail && detail.activitySubmitPrice);
      const suggestActivityPrice = normalizeOptionalNumber(detail && detail.suggestActivityPrice);
      const detailStatus = normalizeText(detail && detail.activitySignupStatus);

      if (detailStatus && detailStatus !== 'eligible') {
        return normalizeText(detail && detail.activitySignupReason) || '\u5b58\u5728\u4e0d\u53ef\u62a5\u540dSKU';
      }

      if (!skuId || !skcId || !siteId) {
        return '\u53ef\u62a5\u7ad9\u70b9SKU\u7f3a\u5931';
      }

      if (activitySubmitPrice === null || activitySubmitPrice <= 0) {
        return '\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u7f3a\u5931';
      }

      if (suggestActivityPrice !== null && suggestActivityPrice > 0 && activitySubmitPrice > suggestActivityPrice) {
        return '\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u9ad8\u4e8e\u5efa\u8bae\u6d3b\u52a8\u4ef7';
      }
    }

    return '\u53ef\u62a5\u540d\u5546\u54c1\u5728\u63d0\u4ea4\u65f6\u672a\u901a\u8fc7\u7ed3\u6784\u6821\u9a8c';
  }

  function buildActivityBatchSignupPreviewInvalidResult(row, selectedShopId) {
    const normalizedSelectedShopId = normalizeText(selectedShopId);
    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    const activityScope = normalizedSelectedShopId
      ? activityScopes.find((scopeItem) => normalizeText(scopeItem && scopeItem.shopId) === normalizedSelectedShopId)
      : (activityScopes[0] || null);

    return {
      rowKey: buildActivityProductFilterStateKey(row),
      submitScopeKey: buildActivityBatchSubmitScopeKey({
        shopId: normalizeText(activityScope && activityScope.shopId) || normalizeText(row && row.shopId) || normalizedSelectedShopId,
        activityKey: normalizeText(activityScope && activityScope.activityKey)
          || normalizeText(Array.isArray(row && row.activityKeys) ? row.activityKeys[0] : ''),
        activityType: normalizeOptionalNumber(activityScope && activityScope.activityType),
        activityThematicId: normalizeText(activityScope && activityScope.activityThematicId),
        productId: normalizeText(row && row.productId)
      }),
      productId: normalizeText(row && row.productId),
      productName: normalizeText(row && row.productName),
      shopId: normalizeText(activityScope && activityScope.shopId) || normalizeText(row && row.shopId) || normalizedSelectedShopId,
      shopName: normalizeText(activityScope && activityScope.shopName)
        || normalizeText(row && row.shopName)
        || normalizedSelectedShopId,
      siteIds: normalizeTextArray(
        activityScope && Array.isArray(activityScope.siteIds) && activityScope.siteIds.length > 0
          ? activityScope.siteIds
          : row && row.siteIds
      ),
      siteNames: normalizeTextArray(
        activityScope && Array.isArray(activityScope.siteNames) && activityScope.siteNames.length > 0
          ? activityScope.siteNames
          : row && row.siteNames
      ),
      activityKey: normalizeText(activityScope && activityScope.activityKey)
        || normalizeText(Array.isArray(row && row.activityKeys) ? row.activityKeys[0] : ''),
      activityType: normalizeOptionalNumber(activityScope && activityScope.activityType),
      activityThematicId: normalizeText(activityScope && activityScope.activityThematicId),
      activityName: normalizeText(activityScope && activityScope.activityName)
        || normalizeText(Array.isArray(row && row.activityNames) ? row.activityNames[0] : ''),
      message: buildActivityBatchSignupPreviewInvalidMessage(row, selectedShopId)
    };
  }

  function buildActivityBatchSignupSubmitRowsForAllScopes(row) {
    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    const scopedShopIds = normalizeSelectedShopIds(activityScopes.map((scopeItem) => scopeItem && scopeItem.shopId));
    const shopIds = scopedShopIds.length > 0 ? scopedShopIds : [''];
    const submitRows = [];
    const invalidRows = [];

    shopIds.forEach((shopId) => {
      const submitRow = buildActivityBatchSignupSubmitRow(row, shopId);

      if (submitRow) {
        submitRows.push(submitRow);
        return;
      }

      invalidRows.push(buildActivityBatchSignupPreviewInvalidResult(row, shopId));
    });

    return {
      submitRows,
      invalidRows
    };
  }

  function buildActivityBackgroundSiteNameText(values) {
    return buildListFullText(values);
  }

  function buildActivityBackgroundSiteIdText(values) {
    return buildListFullText(values);
  }

  function buildActivityBackgroundRowLogContexts(row, activity) {
    const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
    const scopeList = activityScopes.length > 0 ? activityScopes : [null];
    const contextMap = new Map();

    scopeList.forEach((scopeItem) => {
      const shopId = normalizeText(scopeItem && scopeItem.shopId) || normalizeText(row && row.shopId);
      const shopName = normalizeText(scopeItem && scopeItem.shopName)
        || normalizeText(row && row.shopName)
        || shopId;
      const activityKey = normalizeText(scopeItem && scopeItem.activityKey)
        || normalizeText(activity && activity.activityKey)
        || normalizeText(Array.isArray(row && row.activityKeys) ? row.activityKeys[0] : '');
      const activityName = normalizeText(scopeItem && scopeItem.activityName)
        || buildActivityMatchDisplayName(activity)
        || normalizeText(Array.isArray(row && row.activityNames) ? row.activityNames[0] : '');
      const siteIds = normalizeTextArray(
        scopeItem && Array.isArray(scopeItem.siteIds) && scopeItem.siteIds.length > 0
          ? scopeItem.siteIds
          : row && row.siteIds
      );
      const siteNames = normalizeTextArray(
        scopeItem && Array.isArray(scopeItem.siteNames) && scopeItem.siteNames.length > 0
          ? scopeItem.siteNames
          : row && row.siteNames
      );
      const contextKey = [
        shopId,
        activityKey,
        normalizeText(row && row.productId),
        buildActivityBackgroundSiteIdText(siteIds)
      ].join('\x1f');

      if (!contextMap.has(contextKey)) {
        contextMap.set(contextKey, {
          phase: '',
          shopId,
          shopName,
          siteId: buildActivityBackgroundSiteIdText(siteIds),
          siteName: buildActivityBackgroundSiteNameText(siteNames),
          activityKey,
          activityName,
          productId: normalizeText(row && row.productId),
          productName: normalizeText(row && row.productName),
          statusText: ''
        });
      }
    });

    return Array.from(contextMap.values());
  }

  function buildActivityBackgroundSubmitRowLogContext(row) {
    return {
      phase: '',
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      siteId: buildActivityBackgroundSiteIdText(row && row.siteIds),
      siteName: buildActivityBackgroundSiteNameText(row && row.siteNames),
      activityKey: normalizeText(row && row.activityKey),
      activityName: normalizeText(row && row.activityName),
      productId: normalizeText(row && row.productId),
      productName: normalizeText(row && row.productName),
      statusText: ''
    };
  }

  function appendActivityBackgroundFilterRowLogs(backgroundState, rows, activity) {
    const logRecords = [];
    const rowDecisionMessageMap = backgroundState && backgroundState.rowDecisionMessageMap && typeof backgroundState.rowDecisionMessageMap === 'object'
      ? backgroundState.rowDecisionMessageMap
      : Object.create(null);

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const signupStatus = normalizeText(row && row.activitySignupStatus);
      const eligible = signupStatus === 'eligible';
      const contexts = buildActivityBackgroundRowLogContexts(row, activity);
      const statusText = eligible ? '\u53ef\u62a5\u540d' : '\u4e0d\u7b26\u5408';
      const message = resolveActivityProductRowSignupReason(
        row,
        signupStatus,
        row && row.activitySignupReason,
        backgroundState && backgroundState.filterSettings
      )
        || (eligible ? '\u6ee1\u8db3\u62a5\u540d\u89c4\u5219' : '\u4e0d\u7b26\u5408\u62a5\u540d\u6761\u4ef6');
      const rowKey = buildActivityProductFilterStateKey(row);

      if (rowKey) {
        rowDecisionMessageMap[rowKey] = message;
      }

      contexts.forEach((context) => {
        logRecords.push({
          level: eligible ? 'success' : 'warning',
          message,
          ...context,
          phase: '\u7b5b\u9009\u5224\u65ad',
          statusText
        });
      });
    });

    appendActivityBackgroundSubmitLogs(backgroundState, logRecords);
  }

  function appendActivityBackgroundInvalidRowLogs(backgroundState, rows) {
    appendActivityBackgroundSubmitLogs(
      backgroundState,
      (Array.isArray(rows) ? rows : []).map((row) => ({
        level: 'warning',
        message: normalizeText(row && row.message) || '\u63d0\u4ea4\u7ed3\u6784\u4e0d\u5408\u683c',
        ...buildActivityBackgroundSubmitRowLogContext(row),
        phase: '\u63d0\u4ea4\u6821\u9a8c',
        statusText: '\u7ed3\u6784\u8df3\u8fc7'
      }))
    );
  }

  function appendActivityBackgroundSubmitResultLogs(backgroundState, submitResponse) {
    const rowResults = Array.isArray(submitResponse && submitResponse.rowResults)
      ? submitResponse.rowResults
      : [];
    const skippedRows = Array.isArray(submitResponse && submitResponse.skippedRows)
      ? submitResponse.skippedRows
      : [];
    const rowDecisionMessageMap = backgroundState && backgroundState.rowDecisionMessageMap && typeof backgroundState.rowDecisionMessageMap === 'object'
      ? backgroundState.rowDecisionMessageMap
      : Object.create(null);

    const logRecords = [];

    rowResults.forEach((row) => {
      const success = row && row.success === true;
      const rowKey = normalizeText(row && row.rowKey);
      const decisionMessage = rowKey ? normalizeText(rowDecisionMessageMap[rowKey]) : '';
      const baseMessage = normalizeText(row && row.message) || (success ? '\u62a5\u540d\u6210\u529f' : '\u62a5\u540d\u5931\u8d25');

      logRecords.push({
        level: success ? 'success' : 'error',
        message: decisionMessage ? `${baseMessage}\uff1b\u7b5b\u9009\u660e\u7ec6\uff1a${decisionMessage}` : baseMessage,
        ...buildActivityBackgroundSubmitRowLogContext(row),
        phase: '\u63d0\u4ea4\u7ed3\u679c',
        statusText: success ? '\u63d0\u4ea4\u6210\u529f' : '\u63d0\u4ea4\u5931\u8d25'
      });
    });

    skippedRows.forEach((row) => {
      const rowKey = normalizeText(row && row.rowKey);
      const decisionMessage = rowKey ? normalizeText(rowDecisionMessageMap[rowKey]) : '';
      const baseMessage = normalizeText(row && row.message) || '\u672a\u901a\u8fc7\u63d0\u4ea4\u6821\u9a8c';

      logRecords.push({
        level: 'warning',
        message: decisionMessage ? `${baseMessage}\uff1b\u7b5b\u9009\u660e\u7ec6\uff1a${decisionMessage}` : baseMessage,
        ...buildActivityBackgroundSubmitRowLogContext(row),
        phase: '\u63d0\u4ea4\u6821\u9a8c',
        statusText: '\u63d0\u4ea4\u8df3\u8fc7'
      });
    });

    appendActivityBackgroundSubmitLogs(backgroundState, logRecords);
  }

  async function collectActivityBatchViewRows(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const selectedShopId = normalizeText(productState.filterShopId);
    const pageSize = Math.min(PRODUCT_TABLE_MAX_PAGE_SIZE, 200);
    const limit = Object.prototype.hasOwnProperty.call(options, 'limit')
      ? Math.max(1, normalizeNonNegativeInteger(options.limit, 1))
      : 0;
    const countAllMatched = options.countAllMatched === true;
    const includeActivityFilter = options.includeActivityFilter === true;
    const eligibleOnly = options.eligibleOnly === true;
    const onPageProgress = typeof options.onPageProgress === 'function'
      ? options.onPageProgress
      : null;
    const effectiveFilterSettings = Object.prototype.hasOwnProperty.call(options, 'filterSettings')
      ? normalizeActivityProductFilterSettings(options.filterSettings)
      : normalizeActivityProductFilterSettings(
        productState.activityProductFilterAppliedSettings || productState.activityProductFilterSettings
      );
    const collectedRows = [];
    let matchedRowCount = 0;
    let pageIndex = 1;
    let totalPages = 1;

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage !== 'function'
    ) {
      return {
        rows: [],
        matchedRowCount: 0,
        warning: '\u6279\u91cf\u6d3b\u52a8\u5546\u54c1\u5206\u9875\u63a5\u53e3\u672a\u52a0\u8f7d'
      };
    }

    if (!normalizeText(productState.cacheKey)) {
      return {
        rows: [],
        matchedRowCount: 0,
        warning: '\u5546\u54c1\u5217\u8868\u7f13\u5b58\u4e0d\u5b58\u5728\uff0c\u8bf7\u5148\u67e5\u8be2\u6d3b\u52a8\u5546\u54c1'
      };
    }

    while (pageIndex <= totalPages && (countAllMatched || limit <= 0 || collectedRows.length < limit)) {
      if (onPageProgress) {
        onPageProgress({
          pageIndex,
          totalPages,
          collectedRowCount: collectedRows.length,
          matchedRowCount
        });
      }

      const response = await featureCenterApi.getOperationsActivityManagementMatchProductsBatchPage({
        cacheKey: productState.cacheKey,
        pageIndex,
        pageSize,
        filterShopId: selectedShopId,
        filterActivityKey: normalizeText(productState.filterActivityKey),
        sortField: normalizeActivityBatchProductSortField(productState.sortField),
        sortDirection: normalizeActivityBatchProductSortDirection(productState.sortDirection)
      });
      const normalizedResponse = normalizeActivityProductBatchQueryResponse(response);

      if (normalizedResponse.success !== true && normalizedResponse.rows.length <= 0) {
        return {
          rows: collectedRows.slice(),
          matchedRowCount,
          warning: normalizedResponse.warning || '\u6279\u91cf\u6d3b\u52a8\u5546\u54c1\u5217\u8868\u52a0\u8f7d\u5931\u8d25'
        };
      }

      totalPages = Math.max(1, normalizeNonNegativeInteger(normalizedResponse.pageCount, totalPages));
      let pageRows = applyActivityQuickCostEntriesToRows(
        normalizedResponse.rows.slice(),
        productState.quickCostEntries,
        {
          preferredShopId: selectedShopId
        }
      );
      pageRows = applyActivityBatchCostFilterToRows(pageRows, productState.costFilter);

      if (includeActivityFilter) {
        pageRows = applyActivityProductFilterToRows(
          pageRows,
          effectiveFilterSettings
        ).rows;
      }

      if (eligibleOnly) {
        pageRows = pageRows.filter((row) => normalizeText(row && row.activitySignupStatus) === 'eligible');
      }

      matchedRowCount += pageRows.length;

      if (limit > 0) {
        const remainCount = limit - collectedRows.length;

        if (remainCount > 0) {
          collectedRows.push(...pageRows.slice(0, remainCount));
        }
      } else {
        collectedRows.push(...pageRows);
      }

      pageIndex += 1;
    }

    return {
      rows: limit > 0 ? collectedRows.slice(0, limit) : collectedRows,
      matchedRowCount,
      warning: ''
    };
  }

  function filterActivityBatchProductRowsBySignupStatus(rows, productState) {
    const normalizedFilter = normalizeActivityBatchSignupStatusFilter(productState && productState.filterSignupStatus);

    if (!normalizedFilter) {
      return Array.isArray(rows) ? rows.slice() : [];
    }

    if (productState && productState.activityProductFilterApplied !== true) {
      return Array.isArray(rows) ? rows.slice() : [];
    }

    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const rowStatus = normalizeText(resolveActivityProductRowSignupStatus(row, {
        activityProductBatchState: productState
      }).status);
      return rowStatus === normalizedFilter;
    });
  }

  async function collectActivityBatchSignupSubmitRows(container, options = {}) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const hasLimit = Object.prototype.hasOwnProperty.call(options, 'limit');
    const limit = hasLimit ? Math.max(1, normalizeNonNegativeInteger(options.limit, 100)) : 0;
    const collectResult = await collectActivityBatchViewRows(container, {
      ...(limit > 0 ? { limit } : {}),
      countAllMatched: true,
      includeActivityFilter: true,
      filterSettings: productState.activityProductFilterAppliedSettings,
      eligibleOnly: true,
      onPageProgress: (progress) => {
        productState.statusKind = 'info';
        productState.statusMessage = `\u6b63\u5728\u6574\u7406\u7b2c ${normalizeNonNegativeInteger(progress && progress.pageIndex, 1)} / ${Math.max(1, normalizeNonNegativeInteger(progress && progress.totalPages, 1))} \u9875\u53ef\u63d0\u4ea4\u5546\u54c1...`;
        render(container, state.activeTabId);
      }
    });

    return {
      rows: Array.isArray(collectResult && collectResult.rows) ? collectResult.rows : [],
      matchedRowCount: normalizeNonNegativeInteger(collectResult && collectResult.matchedRowCount, 0),
      warning: normalizeText(collectResult && collectResult.warning)
    };
  }

  function mergeActivityBatchSignupSubmitResultMap(currentMap, response) {
    const normalizedResponse = normalizeActivityBatchSignupSubmitResponse(response);
    const nextResultMap = currentMap && typeof currentMap === 'object'
      ? { ...currentMap }
      : Object.create(null);

    normalizedResponse.rowResults.forEach((result) => {
      const resultKey = buildActivityBatchSubmitResultMapKey(result);

      if (resultKey) {
        nextResultMap[resultKey] = {
          shopId: normalizeText(result && result.shopId),
          shopName: normalizeText(result && result.shopName),
          status: result.success ? 'success' : 'failed',
          statusText: result.success
            ? '\u63d0\u4ea4\u62a5\u540d\u6210\u529f'
            : (normalizeText(result && result.statusText) || '\u63d0\u4ea4\u62a5\u540d\u5931\u8d25'),
          message: normalizeText(result && result.message) || (normalizeText(result && result.enrollId) ? `\u62a5\u540dID ${normalizeText(result && result.enrollId)}` : '')
        };
      }
    });

    normalizedResponse.skippedRows.forEach((result) => {
      const resultKey = buildActivityBatchSubmitResultMapKey(result);

      if (resultKey) {
        nextResultMap[resultKey] = {
          shopId: normalizeText(result && result.shopId),
          shopName: normalizeText(result && result.shopName),
          status: 'skip',
          statusText: '\u5df2\u8df3\u8fc7',
          message: normalizeText(result && result.message)
        };
      }
    });

    return nextResultMap;
  }

  function applyActivityBatchSignupSubmitResultMapToRows(rows, submitResultMap) {
    const sourceMap = submitResultMap && typeof submitResultMap === 'object'
      ? submitResultMap
      : Object.create(null);

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const activityScopes = Array.isArray(row && row.activityScopes) ? row.activityScopes : [];
      const scopeResults = [];
      const scopeResultKeySet = new Set();

      activityScopes.forEach((scopeItem) => {
        const resultKey = buildActivityBatchSubmitScopeKey({
          shopId: normalizeText(scopeItem && scopeItem.shopId),
          activityKey: normalizeText(scopeItem && scopeItem.activityKey),
          activityType: normalizeOptionalNumber(scopeItem && scopeItem.activityType),
          activityThematicId: normalizeText(scopeItem && scopeItem.activityThematicId),
          productId: normalizeText(row && row.productId)
        });

        if (!resultKey || scopeResultKeySet.has(resultKey) || !sourceMap[resultKey]) {
          return;
        }

        scopeResultKeySet.add(resultKey);
        scopeResults.push({
          shopId: normalizeText(scopeItem && scopeItem.shopId) || normalizeText(sourceMap[resultKey] && sourceMap[resultKey].shopId),
          shopName: normalizeText(scopeItem && scopeItem.shopName)
            || normalizeText(sourceMap[resultKey] && sourceMap[resultKey].shopName)
            || normalizeText(scopeItem && scopeItem.shopId),
          status: normalizeText(sourceMap[resultKey] && sourceMap[resultKey].status),
          statusText: normalizeText(sourceMap[resultKey] && sourceMap[resultKey].statusText),
          message: normalizeText(sourceMap[resultKey] && sourceMap[resultKey].message)
        });
      });

      if (scopeResults.length <= 0) {
        const rowKey = buildActivityProductFilterStateKey(row);
        const legacyResult = rowKey ? sourceMap[rowKey] : null;

        if (!legacyResult) {
          return {
            ...row,
            activityBatchSubmitScopeResults: [],
            activityBatchSubmitStatus: '',
            activityBatchSubmitStatusText: '',
            activityBatchSubmitMessage: ''
          };
        }

        scopeResults.push({
          shopId: normalizeText(legacyResult && legacyResult.shopId) || normalizeText(row && row.shopId),
          shopName: normalizeText(legacyResult && legacyResult.shopName)
            || normalizeText(row && row.shopName)
            || normalizeText(row && row.shopId),
          status: normalizeText(legacyResult && legacyResult.status),
          statusText: normalizeText(legacyResult && legacyResult.statusText),
          message: normalizeText(legacyResult && legacyResult.message)
        });
      }

      const successCount = scopeResults.filter((item) => normalizeText(item && item.status) === 'success').length;
      const failedCount = scopeResults.filter((item) => normalizeText(item && item.status) === 'failed').length;
      const skippedCount = scopeResults.filter((item) => normalizeText(item && item.status) === 'skip').length;
      const totalScopeCount = scopeResults.length;
      let batchSubmitStatus = '';
      let batchSubmitStatusText = '';

      if (successCount > 0 && failedCount <= 0 && skippedCount <= 0) {
        batchSubmitStatus = 'success';
        batchSubmitStatusText = totalScopeCount > 1
          ? `\u5168\u90e8\u63d0\u4ea4\u6210\u529f (${successCount}/${totalScopeCount})`
          : '\u63d0\u4ea4\u62a5\u540d\u6210\u529f';
      } else if (successCount > 0 && (failedCount > 0 || skippedCount > 0)) {
        batchSubmitStatus = 'partial';
        batchSubmitStatusText = `\u90e8\u5206\u63d0\u4ea4\u6210\u529f (\u6210\u529f ${successCount} / \u5931\u8d25 ${failedCount} / \u8df3\u8fc7 ${skippedCount})`;
      } else if (failedCount > 0) {
        batchSubmitStatus = 'failed';
        batchSubmitStatusText = totalScopeCount > 1
          ? `\u63d0\u4ea4\u62a5\u540d\u5931\u8d25 (${failedCount}/${totalScopeCount})`
          : '\u63d0\u4ea4\u62a5\u540d\u5931\u8d25';
      } else if (skippedCount > 0) {
        batchSubmitStatus = 'skip';
        batchSubmitStatusText = totalScopeCount > 1
          ? `\u672a\u63d0\u4ea4\u62a5\u540d (${skippedCount}/${totalScopeCount})`
          : '\u672a\u63d0\u4ea4\u62a5\u540d';
      }

      return {
        ...row,
        activityBatchSubmitScopeResults: scopeResults,
        activityBatchSubmitStatus: batchSubmitStatus,
        activityBatchSubmitStatusText: batchSubmitStatusText,
        activityBatchSubmitMessage: scopeResults.length === 1
          ? normalizeText(scopeResults[0] && scopeResults[0].message)
          : ''
      };
    });
  }

  function applyActivityBatchSignupSubmitResultToRows(rows, response, currentMap) {
    const nextResultMap = mergeActivityBatchSignupSubmitResultMap(currentMap, response);

    return {
      rows: applyActivityBatchSignupSubmitResultMapToRows(rows, nextResultMap),
      resultMap: nextResultMap
    };
  }

  async function submitActivityBatchProducts(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const dialogBridge = getDialogBridge();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const selectedShopId = normalizeText(productState.filterShopId);
    const submitLimit = 100;

    state.activityProductBatchState = productState;

    if (productState.submitting === true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.submitOperationsActivityManagementMatchProductsBatch !== 'function'
    ) {
      productState.statusKind = 'error';
      productState.statusMessage = '\u6d3b\u52a8\u6279\u91cf\u63d0\u4ea4\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    if (productState.activityProductFilterApplied !== true) {
      productState.statusKind = 'warning';
      productState.statusMessage = '\u8bf7\u5148\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1\uff0c\u751f\u6210\u63d0\u4ea4\u6d3b\u52a8\u4ef7\u540e\u518d\u62a5\u540d';
      render(container, state.activeTabId);
      return null;
    }

    if (productState.activityProductFilterSettingsDirty === true) {
      productState.statusKind = 'warning';
      productState.statusMessage = '\u7b5b\u9009\u8bbe\u7f6e\u5df2\u53d8\u66f4\uff0c\u8bf7\u91cd\u65b0\u70b9\u51fb\u201c\u7b5b\u9009\u6d3b\u52a8\u5546\u54c1\u201d\u540e\u518d\u63d0\u4ea4\u62a5\u540d';
      render(container, state.activeTabId);
      return null;
    }

    const collectResult = await collectActivityBatchSignupSubmitRows(container);

    if (collectResult.warning) {
      productState.statusKind = 'warning';
      productState.statusMessage = collectResult.warning;
      render(container, state.activeTabId);
      return null;
    }

    const sourceRows = Array.isArray(collectResult.rows) ? collectResult.rows : [];
    const submitRows = [];
    const previewInvalidRows = [];

    sourceRows.forEach((row) => {
      const submitRow = buildActivityBatchSignupSubmitRow(row, selectedShopId);

      if (submitRow) {
        submitRows.push(submitRow);
        return;
      }

      previewInvalidRows.push(buildActivityBatchSignupPreviewInvalidResult(row, selectedShopId));
    });

    const matchedRowCount = normalizeNonNegativeInteger(collectResult && collectResult.matchedRowCount, submitRows.length);
    const submitShopCount = normalizeSelectedShopIds(submitRows.map((row) => normalizeText(row && row.shopId))).length;
    const previewSkippedRowCount = previewInvalidRows.length;

    if (previewSkippedRowCount > 0) {
      const previewSubmitResult = applyActivityBatchSignupSubmitResultToRows(
        productState.rows,
        {
          skippedRows: previewInvalidRows
        },
        productState.activityBatchSubmitResultMap
      );
      productState.rows = previewSubmitResult.rows;
      productState.activityBatchSubmitResultMap = previewSubmitResult.resultMap;
    }

    if (submitRows.length <= 0) {
      const invalidReason = sourceRows.length > 0
        ? buildActivityBatchSignupPreviewInvalidMessage(sourceRows[0], selectedShopId)
        : '';
      productState.statusKind = 'warning';
      productState.statusMessage = invalidReason
        ? `\u5f53\u524d\u7b5b\u9009\u7ed3\u679c\u4e2d\u6682\u65e0\u53ef\u63d0\u4ea4\u7684\u5546\u54c1\uff1a${invalidReason}`
        : '\u5f53\u524d\u7b5b\u9009\u7ed3\u679c\u4e2d\u6682\u65e0\u53ef\u63d0\u4ea4\u7684\u5546\u54c1';
      render(container, state.activeTabId);
      return null;
    }

    if (
      dialogBridge
      && typeof dialogBridge.confirm === 'function'
      && !(await dialogBridge.confirm({
        type: 'warning',
        title: '\u6279\u91cf\u63d0\u4ea4\u6d3b\u52a8',
        message: previewSkippedRowCount > 0
          ? `\u5f53\u524d\u7b5b\u9009\u547d\u4e2d ${matchedRowCount} \u4e2a\u5546\u54c1\uff0c\u5176\u4e2d ${submitRows.length} \u4e2a\u4f1a\u6309\u5e97\u94fa\u5e76\u884c\u3001\u6309\u6d3b\u52a8\u5206\u7ec4\u63d0\u4ea4\uff0c${previewSkippedRowCount} \u4e2a\u4f1a\u6807\u8bb0\u4e3a\u5df2\u8df3\u8fc7\u3002\u5355\u6b21\u8bf7\u6c42\u6700\u591a ${submitLimit} \u4e2a\uff0c\u4e0d\u6ee1 ${submitLimit} \u4e5f\u4f1a\u63d0\u4ea4\uff0c\u662f\u5426\u7ee7\u7eed\uff1f`
          : `\u5f53\u524d\u7b5b\u9009\u547d\u4e2d ${matchedRowCount} \u4e2a\u5546\u54c1\uff0c\u5c06\u6309\u5e97\u94fa\u5e76\u884c\u3001\u6309\u6d3b\u52a8\u5206\u7ec4\u63d0\u4ea4\uff0c\u5355\u6b21\u8bf7\u6c42\u6700\u591a ${submitLimit} \u4e2a\uff0c\u4e0d\u6ee1 ${submitLimit} \u4e5f\u4f1a\u63d0\u4ea4\uff0c\u662f\u5426\u7ee7\u7eed\uff1f`,
        buttons: ['\u786e\u5b9a', '\u53d6\u6d88'],
        defaultId: 0,
        cancelId: 1
      }))
    ) {
      return null;
    }

    productState.requestId += 1;
    const requestId = productState.requestId;
    const submitRequestKey = `activity_batch_submit_${Date.now().toString(36)}_${requestId}`;

    if (productState.submitProgressUnsubscribe && typeof productState.submitProgressUnsubscribe === 'function') {
      productState.submitProgressUnsubscribe();
      productState.submitProgressUnsubscribe = null;
    }

    if (typeof featureCenterApi.onOperationsActivityManagementBatchProgress === 'function') {
      productState.submitProgressUnsubscribe = featureCenterApi.onOperationsActivityManagementBatchProgress((progressPayload) => {
        const currentState = getState(container).activityProductBatchState || buildEmptyActivityProductBatchState();
        const normalizedProgress = normalizeActivityProductBatchProgressRecord(progressPayload);

        if (normalizedProgress.taskType !== 'submit') {
          return;
        }

        if (!currentState.submitRequestKey || normalizedProgress.requestId !== currentState.submitRequestKey) {
          return;
        }

        applyActivityProductBatchSubmitProgressResponse(getState(container), normalizedProgress);
        render(container, state.activeTabId);
      });
    }

    productState.submitting = true;
    productState.submitRequestKey = submitRequestKey;
    productState.submitProgress = normalizeActivityProductBatchProgressRecord({
      success: true,
      taskType: 'submit',
      requestId: submitRequestKey,
      phase: 'signup-start',
      submittedRowCount: submitRows.length,
      totalInputRowCount: matchedRowCount,
      skippedRowCount: previewSkippedRowCount,
      totalShopCount: submitShopCount,
      successRowCount: 0,
      failedRowCount: 0,
      message: `\u6b63\u5728\u6309\u5e97\u94fa\u5e76\u884c\u63d0\u4ea4\u6d3b\u52a8\uff0c\u5171 ${submitRows.length} \u4e2a\u53ef\u63d0\u4ea4\u5546\u54c1 / ${submitShopCount} \u5bb6\u5e97\u94fa...`
    });
    productState.statusKind = 'info';
    productState.statusMessage = productState.submitProgress.message || `\u6b63\u5728\u6279\u91cf\u63d0\u4ea4\u6d3b\u52a8\uff0c\u5171 ${submitRows.length} \u4e2a\u5546\u54c1...`;
    render(container, state.activeTabId);

    try {
      const response = await featureCenterApi.submitOperationsActivityManagementMatchProductsBatch({
        requestId: submitRequestKey,
        batchSize: submitLimit,
        rows: submitRows
      });

      if (productState.requestId !== requestId) {
        return response;
      }

      const normalizedResponse = normalizeActivityBatchSignupSubmitResponse(response);

      const appliedSubmitResult = applyActivityBatchSignupSubmitResultToRows(
        productState.rows,
        normalizedResponse,
        productState.activityBatchSubmitResultMap
      );
      productState.rows = appliedSubmitResult.rows;
      productState.activityBatchSubmitResultMap = appliedSubmitResult.resultMap;
      productState.updatedAt = normalizedResponse.updatedAt || productState.updatedAt || new Date().toISOString();
      productState.submitProgress = normalizeActivityProductBatchProgressRecord({
        ...(productState.submitProgress || {}),
        taskType: 'submit',
        requestId: submitRequestKey,
        phase: normalizedResponse.canceled === true ? 'signup-canceled' : 'signup-done',
        totalInputRowCount: matchedRowCount,
        submittedRowCount: normalizedResponse.submittedRowCount,
        skippedRowCount: normalizedResponse.skippedRowCount + previewSkippedRowCount,
        totalShopCount: normalizedResponse.totalShopCount,
        completedShopCount: normalizeNonNegativeInteger(normalizedResponse.completedShopCount, normalizedResponse.totalShopCount),
        failedShopCount: normalizeNonNegativeInteger(
          normalizedResponse.failedShopCount,
          normalizeNonNegativeInteger(productState.submitProgress && productState.submitProgress.failedShopCount, 0)
        ),
        totalGroupCount: normalizedResponse.totalGroupCount,
        currentShopIndex: 0,
        currentShopName: '',
        currentGroupIndex: 0,
        currentGroupCount: 0,
        currentActivityName: '',
        currentActivityKey: '',
        currentChunkIndex: 0,
        currentChunkCount: 0,
        currentChunkRowCount: 0,
        totalRequestCount: normalizedResponse.totalRequestCount,
        completedRequestCount: normalizedResponse.completedRequestCount,
        failedRequestCount: normalizedResponse.failedRequestCount,
        successRowCount: normalizedResponse.successRowCount,
        failedRowCount: normalizedResponse.failedRowCount,
        message: normalizedResponse.warning
          ? normalizedResponse.warning
          : `\u6279\u91cf\u63d0\u4ea4\u5df2\u5b8c\u6210\uff0c\u6210\u529f ${formatInteger(normalizedResponse.successRowCount, '0')} \u4e2a\u5546\u54c1${previewSkippedRowCount > 0 ? `\uff0c\u8df3\u8fc7 ${formatInteger(previewSkippedRowCount, '0')} \u4e2a` : ''}`
      });

      if (normalizedResponse.canceled === true) {
        productState.statusKind = 'warning';
        productState.statusMessage = normalizedResponse.warning || '\u6d3b\u52a8\u6279\u91cf\u63d0\u4ea4\u5df2\u505c\u6b62';
      } else if (normalizedResponse.warning) {
        productState.statusKind = normalizedResponse.success ? 'warning' : 'error';
        productState.statusMessage = normalizedResponse.warning;
      } else {
        productState.statusKind = 'success';
        productState.statusMessage = `\u6279\u91cf\u62a5\u540d\u5b8c\u6210\uff0c\u6210\u529f ${formatInteger(normalizedResponse.successRowCount, '0')} \u4e2a\u5546\u54c1${previewSkippedRowCount > 0 ? `\uff0c\u8df3\u8fc7 ${formatInteger(previewSkippedRowCount, '0')} \u4e2a` : ''}`;
      }

      render(container, state.activeTabId);
      return normalizedResponse;
    } catch (error) {
      if (productState.requestId !== requestId) {
        return null;
      }

      productState.statusKind = 'error';
      productState.statusMessage = normalizeText(error && error.message) || '\u6d3b\u52a8\u6279\u91cf\u63d0\u4ea4\u5931\u8d25';
      render(container, state.activeTabId);
      return null;
    } finally {
      if (productState.requestId === requestId) {
        productState.submitting = false;
        productState.submitRequestKey = '';
        if (productState.submitProgressUnsubscribe && typeof productState.submitProgressUnsubscribe === 'function') {
          productState.submitProgressUnsubscribe();
          productState.submitProgressUnsubscribe = null;
        }
        render(container, state.activeTabId);
      }
    }
  }

  function toggleActivityBatchProductSkuDetails(container, rowKey) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const normalizedRowKey = normalizeText(rowKey);

    if (!normalizedRowKey) {
      return;
    }

    state.activityProductBatchState = productState;
    const expandedSet = new Set(Array.isArray(productState.expandedSkuDetailKeys) ? productState.expandedSkuDetailKeys : []);

    if (expandedSet.has(normalizedRowKey)) {
      expandedSet.delete(normalizedRowKey);
    } else {
      expandedSet.add(normalizedRowKey);
    }

    productState.expandedSkuDetailKeys = Array.from(expandedSet);
    render(container, state.activeTabId, {
      preserveActivityQueryTableScroll: true
    });
  }

  async function openActivityBatchQuickCostDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

    state.activityProductBatchState = productState;
    productState.quickCostDialogOpen = true;
    productState.quickCostDialogLoading = true;
    productState.quickCostDialogSaving = false;
    productState.quickCostDialogError = '';
    productState.quickCostDialogWarning = '';
    productState.quickCostDialogNotice = '';
    productState.quickCostDialogEntries = [];
    productState.quickCostDialogRowCount = 0;
    productState.quickCostDialogSourceEntryCount = 0;
    productState.quickCostDialogMergedEntryCount = 0;
    productState.quickCostDialogConflictCount = 0;
    render(container, state.activeTabId);

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      productState.quickCostDialogLoading = false;
      render(container, state.activeTabId);
      return;
    }

    try {
      const baseEntries = normalizeActivityQuickCostEntryList(productState.quickCostEntries);

      if (baseEntries.length <= 0) {
        productState.quickCostDialogError = '\u5f53\u524d\u67e5\u8be2\u7ed3\u679c\u4e2d\u6682\u65e0\u53ef\u9884\u8bbe\u6210\u672c\u7684SKU\u660e\u7ec6';
        return;
      }

      productState.quickCostDialogEntries = baseEntries;
      productState.quickCostDialogRowCount = normalizeNonNegativeInteger(
        productState.cachedRowCount,
        baseEntries.length
      );
      productState.quickCostDialogSourceEntryCount = baseEntries.length;
      productState.quickCostDialogMergedEntryCount = 0;
      productState.quickCostDialogConflictCount = 0;
      const targetShopIds = normalizeSelectedShopIds(baseEntries.map((entry) => entry && entry.shopId));

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

      const aggregateResult = buildActivityBackgroundQuickCostDialogEntries(
        state,
        response && response.entries,
        baseEntries.concat(Array.isArray(presetResponse && presetResponse.entries) ? presetResponse.entries : []),
        {
          targetShopIds,
          shopNameMap: buildActivityQuickCostShopNameMapFromEntries(baseEntries)
        }
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

      productState.quickCostEntries = aggregateResult.entries;
      productState.quickCostSnapshotCacheKey = normalizeText(productState.cacheKey);
      productState.quickCostDialogEntries = productState.quickCostEntries.slice();
      productState.quickCostDialogSourceEntryCount = aggregateResult.sourceEntryCount;
      productState.quickCostDialogMergedEntryCount = aggregateResult.mergedEntryCount;
      productState.quickCostDialogConflictCount = aggregateResult.conflictCount;
      rebuildActivityBatchVisibleRows(productState);
      productState.quickCostDialogWarning = warningList.join('\n');
    } catch (error) {
      productState.quickCostDialogError = normalizeText(error && error.message) || '\u6210\u672c\u9884\u8bbe\u6570\u636e\u52a0\u8f7d\u5931\u8d25';
    } finally {
      productState.quickCostDialogLoading = false;
      render(container, state.activeTabId);
    }
  }

  function closeActivityBatchQuickCostDialog(container) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

    state.activityProductBatchState = productState;
    productState.quickCostDialogOpen = false;
    productState.quickCostDialogLoading = false;
    productState.quickCostDialogSaving = false;
    productState.quickCostDialogError = '';
    productState.quickCostDialogWarning = '';
    productState.quickCostDialogNotice = '';
    productState.quickCostDialogEntries = [];
    productState.quickCostDialogRowCount = 0;
    productState.quickCostDialogSourceEntryCount = 0;
    productState.quickCostDialogMergedEntryCount = 0;
    productState.quickCostDialogConflictCount = 0;
    render(container, state.activeTabId);
  }

  async function saveActivityBatchQuickCostDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

    state.activityProductBatchState = productState;

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsSharedCostBatch !== 'function'
    ) {
      productState.quickCostDialogError = '\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    productState.quickCostDialogSaving = true;
    productState.quickCostDialogError = '';
    productState.quickCostDialogWarning = '';
    productState.quickCostDialogNotice = '';
    render(container, state.activeTabId);

    try {
      const payloadEntries = (Array.isArray(productState.quickCostDialogEntries) ? productState.quickCostDialogEntries : [])
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

      productState.quickCostEntries = payloadEntries.map((entry) => ({
        ...entry,
        key: buildQuickCostEntryKey(entry.shopId, entry.station, entry.spec),
        updatedAt: normalizeText(response && response.updatedAt),
        mergedRecordCount: 1,
        mergedCategoryLabels: [],
        mergedCostConflict: false
      }));
      productState.quickCostSnapshotCacheKey = normalizeText(productState.cacheKey);
      rebuildActivityBatchVisibleRows(productState);
      productState.quickCostDialogEntries = productState.quickCostEntries.slice();
      productState.quickCostDialogSourceEntryCount = payloadEntries.length;
      productState.quickCostDialogMergedEntryCount = 0;
      productState.quickCostDialogConflictCount = 0;
      productState.quickCostDialogWarning = normalizeText(response && response.warning);
      productState.quickCostDialogNotice = `\u5df2\u4fdd\u5b58 ${payloadEntries.length} \u9879\u6210\u672c\u9884\u8bbe`;
      if (response && response.cloudSynced !== true) {
        productState.statusKind = 'warning';
        productState.statusMessage = normalizeText(response && response.warning)
          || '\u6210\u672c\u9884\u8bbe\u5df2\u4fdd\u5b58\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210';
        return response;
      }

      productState.statusKind = normalizeText(response && response.warning) ? 'warning' : 'success';
      productState.statusMessage = normalizeText(response && response.warning) || productState.quickCostDialogNotice;
      closeActivityBatchQuickCostDialog(container);
      return response;
    } catch (error) {
      productState.quickCostDialogError = normalizeText(error && error.message) || '\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u5931\u8d25';
      return null;
    } finally {
      productState.quickCostDialogSaving = false;
      render(container, state.activeTabId);
    }
  }

  async function openActivityBackgroundQuickCostDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const backgroundState = ensureActivityBackgroundSubmitState(state);
    const targetShopIds = buildActivityBackgroundQuickCostTargetShopIds(state);

    if (targetShopIds.length <= 0) {
      backgroundState.statusKind = 'warning';
      backgroundState.statusMessage = '\u8bf7\u5148\u9009\u62e9\u9700\u8981\u540e\u53f0\u62a5\u540d\u7684\u6d3b\u52a8\u548c\u5e97\u94fa';
      render(container, state.activeTabId);
      return;
    }

    backgroundState.quickCostDialogOpen = true;
    backgroundState.quickCostDialogLoading = true;
    backgroundState.quickCostDialogSaving = false;
    backgroundState.quickCostDialogError = '';
    backgroundState.quickCostDialogWarning = '';
    backgroundState.quickCostDialogNotice = '';
    backgroundState.quickCostDialogEntries = [];
    backgroundState.quickCostDialogShopCount = targetShopIds.length;
    backgroundState.quickCostDialogSourceEntryCount = 0;
    backgroundState.quickCostDialogMergedEntryCount = 0;
    backgroundState.quickCostDialogConflictCount = 0;
    render(container, state.activeTabId);

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      backgroundState.quickCostDialogLoading = false;
      backgroundState.quickCostDialogError = '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u8bfb\u53d6\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
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

      const aggregateResult = buildActivityBackgroundQuickCostDialogEntries(
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

      backgroundState.quickCostDialogEntries = aggregateResult.entries;
      backgroundState.quickCostDialogSourceEntryCount = aggregateResult.sourceEntryCount;
      backgroundState.quickCostDialogMergedEntryCount = aggregateResult.mergedEntryCount;
      backgroundState.quickCostDialogConflictCount = aggregateResult.conflictCount;
      backgroundState.quickCostDialogWarning = warningList.join('\n');
    } catch (error) {
      backgroundState.quickCostDialogError = normalizeText(error && error.message) || '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u52a0\u8f7d\u5931\u8d25';
    } finally {
      backgroundState.quickCostDialogLoading = false;
      render(container, state.activeTabId);
    }
  }

  function closeActivityBackgroundQuickCostDialog(container) {
    const state = getState(container);
    const backgroundState = ensureActivityBackgroundSubmitState(state);

    backgroundState.quickCostDialogOpen = false;
    backgroundState.quickCostDialogLoading = false;
    backgroundState.quickCostDialogSaving = false;
    backgroundState.quickCostDialogError = '';
    backgroundState.quickCostDialogWarning = '';
    backgroundState.quickCostDialogNotice = '';
    backgroundState.quickCostDialogEntries = [];
    backgroundState.quickCostDialogShopCount = 0;
    backgroundState.quickCostDialogSourceEntryCount = 0;
    backgroundState.quickCostDialogMergedEntryCount = 0;
    backgroundState.quickCostDialogConflictCount = 0;
    render(container, state.activeTabId);
  }

  async function saveActivityBackgroundQuickCostDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const backgroundState = ensureActivityBackgroundSubmitState(state);

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsSharedCostBatch !== 'function'
    ) {
      backgroundState.quickCostDialogError = '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    backgroundState.quickCostDialogSaving = true;
    backgroundState.quickCostDialogError = '';
    backgroundState.quickCostDialogWarning = '';
    backgroundState.quickCostDialogNotice = '';
    render(container, state.activeTabId);

    try {
      const payloadEntries = (Array.isArray(backgroundState.quickCostDialogEntries) ? backgroundState.quickCostDialogEntries : [])
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

      backgroundState.quickCostDialogEntries = payloadEntries.map((entry) => ({
        ...entry,
        key: buildQuickCostEntryKey(entry.shopId, entry.station, entry.spec),
        updatedAt: normalizeText(response && response.updatedAt),
        mergedRecordCount: 1,
        mergedCategoryLabels: [],
        mergedCostConflict: false
      }));
      backgroundState.quickCostDialogSourceEntryCount = payloadEntries.length;
      backgroundState.quickCostDialogMergedEntryCount = 0;
      backgroundState.quickCostDialogConflictCount = 0;
      backgroundState.quickCostDialogWarning = normalizeText(response && response.warning);
      backgroundState.quickCostDialogNotice = `\u5df2\u4fdd\u5b58 ${payloadEntries.length} \u9879\u6210\u672c\u9884\u8bbe`;

      if (response && response.cloudSynced !== true) {
        backgroundState.statusKind = 'warning';
        backgroundState.statusMessage = normalizeText(response && response.warning)
          || '\u6210\u672c\u9884\u8bbe\u5df2\u4fdd\u5b58\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u672a\u5b8c\u6210';
        return response;
      }

      backgroundState.statusKind = normalizeText(response && response.warning) ? 'warning' : 'success';
      backgroundState.statusMessage = normalizeText(response && response.warning) || backgroundState.quickCostDialogNotice;
      return response;
    } catch (error) {
      backgroundState.quickCostDialogError = normalizeText(error && error.message) || '\u5171\u4eab\u6210\u672c\u9884\u8bbe\u4fdd\u5b58\u5931\u8d25';
      return null;
    } finally {
      backgroundState.quickCostDialogSaving = false;
      render(container, state.activeTabId);
    }
  }

  function returnToActivityQueryStep(container) {
    const state = getState(container);
    const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
    const backgroundState = ensureActivityBackgroundSubmitState(state);

    if (productState.progressUnsubscribe && typeof productState.progressUnsubscribe === 'function') {
      productState.progressUnsubscribe();
      productState.progressUnsubscribe = null;
    }

    if (productState.submitProgressUnsubscribe && typeof productState.submitProgressUnsubscribe === 'function') {
      productState.submitProgressUnsubscribe();
      productState.submitProgressUnsubscribe = null;
    }

    productState.progress = null;
    productState.submitProgress = null;
    productState.submitRequestKey = '';
    clearActivityBackgroundProgressSubscription(backgroundState);
    backgroundState.progress = null;
    backgroundState.currentQueryRequestId = '';
    backgroundState.currentSubmitRequestId = '';
    state.workflowStep = 'activity';
    render(container, state.activeTabId);
  }

  function applyActivityProductQueryResponse(state, activityKey, response, options = {}) {
    const normalizedActivityKey = normalizeText(activityKey);
    const productState = getActivityProductState(state, normalizedActivityKey);
    const normalized = normalizeActivityProductQueryResponse(response, state);
    const nextRows = normalized.rows.slice();

    productState.cacheKey = normalized.cacheKey;
    productState.rows = nextRows;
    productState.shopResults = normalized.shopResults;
    productState.totalShopCount = normalized.totalShopCount;
    productState.successShopCount = normalized.successShopCount;
    productState.failedShopCount = normalized.failedShopCount;
    productState.rawProductCount = normalized.rawProductCount;
    productState.uniqueProductCount = normalized.uniqueProductCount;
    productState.cachedRowCount = normalized.cachedRowCount;
    productState.stillCount = normalized.stillCount;
    productState.hasMore = normalized.hasMore === true;
    productState.updatedAt = normalized.updatedAt || new Date().toISOString();
    productState.pageIndex = normalized.pageIndex;
    productState.pageCount = normalized.pageCount;
    productState.tablePageSize = normalizeProductTablePageSize(normalized.pageSize || productState.tablePageSize);
    productState.tablePage = normalized.pageIndex;

    if (normalized.warning) {
      productState.statusKind = normalized.success ? 'warning' : 'error';
      productState.statusMessage = normalized.warning;
      return;
    }

    if (nextRows.length <= 0) {
      productState.statusKind = 'warning';
      productState.statusMessage = '\u5f53\u524d\u6d3b\u52a8\u6682\u65e0\u53ef\u62a5\u5546\u54c1';
      return;
    }

    productState.statusKind = 'success';
    productState.statusMessage = `\u5df2\u52a0\u8f7d\u7b2c ${normalized.pageIndex} / ${normalized.pageCount} \u9875\uff0c\u5171 ${normalized.cachedRowCount} \u4e2a\u53ef\u62a5\u5546\u54c1`;
  }

  function scrollToSubmittedActivityPanel(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const panel = container.querySelector('[data-ops-activity-next-step="true"]');

    if (!(panel instanceof HTMLElement) || typeof panel.scrollIntoView !== 'function') {
      return;
    }

    requestAnimationFrame(() => {
      panel.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    });
  }

  async function loadSubmittedActivityProducts(container, activityKey, options = {}) {
    const state = getState(container);
    const normalizedActivityKey = normalizeText(activityKey);
    const featureCenterApi = getFeatureCenterApi();
    const activityRow = findActivityRowByKey(state.submittedActivityRows, normalizedActivityKey);
    const productState = getActivityProductState(state, normalizedActivityKey);
    const pageIndex = Math.max(1, normalizeNonNegativeInteger(options.pageIndex, 1));
    const forceReload = options.forceReload === true;

    if (!activityRow) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.queryOperationsActivityManagementMatchProducts !== 'function'
      || typeof featureCenterApi.getOperationsActivityManagementMatchProductsPage !== 'function'
    ) {
      productState.statusKind = 'error';
      productState.statusMessage = '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    if (productState.loading === true && productState.requestPromise) {
      return productState.requestPromise;
    }

    productState.requestId += 1;
    const requestId = productState.requestId;
    productState.loading = true;
    productState.statusKind = 'info';
    productState.statusMessage = pageIndex > 1
      ? `\u6b63\u5728\u52a0\u8f7d\u7b2c ${pageIndex} \u9875\u5546\u54c1...`
      : '\u6b63\u5728\u9010\u5e97\u94fa\u67e5\u8be2\u6d3b\u52a8\u5546\u54c1...';
    render(container, state.activeTabId);

    let requestPromise = null;

    if (!forceReload && productState.cacheKey && pageIndex >= 1) {
      requestPromise = featureCenterApi.getOperationsActivityManagementMatchProductsPage({
        cacheKey: productState.cacheKey,
        activityKey: normalizedActivityKey,
        pageIndex,
        pageSize: productState.tablePageSize
      });
    } else {
      const shopIds = buildActivityProductQueryShopIds(state, activityRow);

      if (shopIds.length <= 0) {
        productState.loading = false;
        productState.statusKind = 'warning';
        productState.statusMessage = '\u5f53\u524d\u6d3b\u52a8\u672a\u5339\u914d\u5230\u53ef\u67e5\u8be2\u5e97\u94fa';
        render(container, state.activeTabId);
        return null;
      }

      const requestPayload = {
        activityKey: normalizedActivityKey,
        activityType: activityRow.activityType,
        shopIds,
        rowCount: 50,
        pageIndex,
        pageSize: productState.tablePageSize,
        addSite: true
      };

      if (normalizeText(activityRow.activityThematicId)) {
        requestPayload.activityThematicId = normalizeText(activityRow.activityThematicId);
      }

      requestPromise = featureCenterApi.queryOperationsActivityManagementMatchProducts(requestPayload);
    }
    productState.requestPromise = requestPromise;

    try {
      const response = await requestPromise;

      if (productState.requestId !== requestId) {
        return response;
      }

      const normalizedResponse = normalizeActivityProductQueryResponse(response, state);

      if (
        !forceReload
        && productState.cacheKey
        && pageIndex >= 1
        && !normalizedResponse.success
        && normalizeText(normalizedResponse.warning).includes('\u7f13\u5b58')
      ) {
        productState.cacheKey = '';
        productState.loading = false;
        productState.requestPromise = null;
        return await loadSubmittedActivityProducts(container, normalizedActivityKey, {
          pageIndex,
          forceReload: true
        });
      }

      applyActivityProductQueryResponse(state, normalizedActivityKey, response);
      return response;
    } catch (error) {
      if (productState.requestId !== requestId) {
        return null;
      }

      productState.statusKind = 'error';
      productState.statusMessage = normalizeText(error && error.message) || '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u5931\u8d25';
      return null;
    } finally {
      if (productState.requestId === requestId) {
        productState.loading = false;
        productState.requestPromise = null;
        render(container, state.activeTabId);
      }
    }
  }

  async function changeActivityProductTablePage(container, activityKey, direction) {
    const state = getState(container);
    const normalizedActivityKey = normalizeText(activityKey);

    if (!normalizedActivityKey) {
      return;
    }

    const productState = getActivityProductState(state, normalizedActivityKey);
    const paginationState = getActivityProductTablePaginationState(productState);
    const normalizedDirection = normalizeText(direction);
    const delta = normalizedDirection === 'next'
      ? 1
      : (normalizedDirection === 'prev' ? -1 : 0);

    if (!delta) {
      return;
    }

    const nextPage = Math.min(
      paginationState.totalPages,
      Math.max(1, paginationState.page + delta)
    );

    if (nextPage === paginationState.page) {
      return;
    }

    productState.tablePage = nextPage;
    await loadSubmittedActivityProducts(container, normalizedActivityKey, {
      pageIndex: nextPage
    });
  }

  async function submitSelectedActivities(container) {
    const state = getState(container);
    const submittedRows = buildSubmittedActivityRows(state);

    if (submittedRows.length <= 0) {
      state.activityQueryStatusKind = 'warning';
      state.activityQueryStatusMessage = '\u8bf7\u5148\u52fe\u9009\u6d3b\u52a8';
      render(container, state.activeTabId);
      return [];
    }

    clearSubmittedActivityState(state);
    state.submittedActivityRows = submittedRows;
    state.submittedActivityKeys = submittedRows
      .map((row) => normalizeText(row && row.activityKey))
      .filter(Boolean);
    state.activeSubmittedActivityKey = normalizeText(submittedRows[0] && submittedRows[0].activityKey);
    state.workflowStep = 'products';
    render(container, state.activeTabId);
    await loadSubmittedActivityBatchProducts(container, {
      pageIndex: 1,
      forceReload: true
    });

    return submittedRows;
  }

  function openActivityBatchBackgroundPage(container) {
    const state = getState(container);
    const submittedRows = buildSubmittedActivityRows(state);

    if (submittedRows.length <= 0) {
      state.activityQueryStatusKind = 'warning';
      state.activityQueryStatusMessage = '\u8bf7\u5148\u52fe\u9009\u6d3b\u52a8';
      render(container, state.activeTabId);
      return [];
    }

    clearSubmittedActivityState(state);
    state.submittedActivityRows = submittedRows;
    state.submittedActivityKeys = submittedRows
      .map((row) => normalizeText(row && row.activityKey))
      .filter(Boolean);
    state.activeSubmittedActivityKey = normalizeText(submittedRows[0] && submittedRows[0].activityKey);
    state.workflowStep = 'submit-background';
    render(container, state.activeTabId);
    void loadActivityBackgroundFilterSettings(container);
    return submittedRows;
  }

  async function activateSubmittedActivity(container, activityKey) {
    const state = getState(container);
    const normalizedActivityKey = normalizeText(activityKey);

    if (!normalizedActivityKey || !findActivityRowByKey(state.submittedActivityRows, normalizedActivityKey)) {
      return;
    }

    state.activeSubmittedActivityKey = normalizedActivityKey;
    render(container, state.activeTabId);

    const productState = getActivityProductState(state, normalizedActivityKey);

    if (
      (Array.isArray(productState.rows) ? productState.rows.length : 0) <= 0
      && productState.loading !== true
    ) {
      await loadSubmittedActivityProducts(container, normalizedActivityKey);
    }
  }

  async function loadActivityFilterSettings(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.activityFilterLoading === true && state.activityFilterPromise && options.force !== true) {
      return state.activityFilterPromise;
    }

    if (options.force !== true && state.activityFilterLoaded === true) {
      return getCommittedActivityFilterSettings(state);
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsActivityManagementFilterSettings !== 'function'
    ) {
      state.activityFilterLoaded = true;
      setCommittedActivityFilterSettings(state, buildEmptyActivityFilterSettings());
      syncActivityFilterDraftSettings(state);
      return getCommittedActivityFilterSettings(state);
    }

    state.activityFilterLoading = true;
    state.activityFilterPromise = featureCenterApi.getOperationsActivityManagementFilterSettings()
      .then((response) => {
        state.activityFilterLoaded = true;
        setCommittedActivityFilterSettings(state, response && response.settings);
        syncActivityFilterDraftSettings(state);
        state.activityFilterWarning = normalizeText(response && response.warning);
        return getCommittedActivityFilterSettings(state);
      })
      .catch((error) => {
        state.activityFilterLoaded = true;
        setCommittedActivityFilterSettings(state, buildEmptyActivityFilterSettings());
        syncActivityFilterDraftSettings(state);
        state.activityFilterWarning = normalizeText(error && error.message) || '\u7b5b\u9009\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25';
        return getCommittedActivityFilterSettings(state);
      })
      .finally(() => {
        state.activityFilterLoading = false;
        state.activityFilterPromise = null;

        if (options.render !== false || state.activityFilterDialogOpen === true) {
          render(container, state.activeTabId);
        }
      });

    return state.activityFilterPromise;
  }

  function openActivityFilterDialog(container) {
    const state = getState(container);

    state.activityFilterDialogOpen = true;
    state.activityFilterSaving = false;
    clearActivityFilterFeedback(state);
    syncActivityFilterDraftSettings(state);
    state.activityFilterDraftThemeTypes = filterActivityThemeTypeValuesByOptions(
      state.activityFilterDraftThemeTypes,
      state.activityQueryThemeTypeOptions
    );
    render(container, state.activeTabId);

    if (state.activityFilterLoaded !== true) {
      void loadActivityFilterSettings(container);
    }
  }

  function closeActivityFilterDialog(container) {
    const state = getState(container);
    closeActivityFilterDialogState(state);
    render(container, state.activeTabId);
  }

  async function saveActivityFilterSettings(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsActivityManagementFilterSettings !== 'function'
    ) {
      state.activityFilterWarning = '\u7b5b\u9009\u8bbe\u7f6e\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    state.activityFilterSaving = true;
    clearActivityFilterFeedback(state);
    render(container, state.activeTabId);

    try {
      const response = await featureCenterApi.saveOperationsActivityManagementFilterSettings(
        getDraftActivityFilterSettings(state)
      );

      state.activityFilterLoaded = true;
      setCommittedActivityFilterSettings(state, response && response.settings);
      syncActivityFilterDraftSettings(state);
      state.activityFilterWarning = normalizeText(response && response.warning);

      if (state.activityFilterWarning) {
        if (Array.isArray(state.activityQueryRows) && state.activityQueryRows.length > 0) {
          await runActivitySelectionFilter(container);
        }
        state.activityFilterNotice = '\u7b5b\u9009\u6761\u4ef6\u5df2\u4fdd\u5b58';
        return response;
      }

      state.activityFilterDialogOpen = false;
      if (Array.isArray(state.activityQueryRows) && state.activityQueryRows.length > 0) {
        await runActivitySelectionFilter(container);
      }
      return response;
    } catch (error) {
      state.activityFilterWarning = normalizeText(error && error.message) || '\u7b5b\u9009\u8bbe\u7f6e\u4fdd\u5b58\u5931\u8d25';
      return null;
    } finally {
      state.activityFilterSaving = false;
      render(container, state.activeTabId);
    }
  }

  async function runActivitySelectionFilter(container) {
    const state = getState(container);

    if (state.activityFilterLoaded !== true) {
      await loadActivityFilterSettings(container, {
        render: false
      });
    }

    const rows = Array.isArray(state.activityQueryRows) ? state.activityQueryRows : [];

    if (rows.length <= 0) {
      state.activityQueryStatusKind = 'warning';
      state.activityQueryStatusMessage = '\u8bf7\u5148\u67e5\u8be2\u6d3b\u52a8';
      render(container, state.activeTabId);
      return [];
    }

    const filterSettings = getCommittedActivityFilterSettings(state);

    if (!hasActivityFilterSettings(filterSettings)) {
      state.activityQueryStatusKind = 'warning';
      state.activityQueryStatusMessage = '\u8bf7\u5148\u8bbe\u7f6e\u7b5b\u9009\u6761\u4ef6';
      render(container, state.activeTabId);
      return [];
    }

    const matchedKeys = rows
      .filter((row) => rowMatchesActivityFilter(row, filterSettings))
      .map((row) => normalizeText(row && row.activityKey))
      .filter(Boolean);

    state.activitySelectedKeys = matchedKeys;
    state.activityQueryStatusKind = matchedKeys.length > 0 ? 'success' : 'warning';
    state.activityQueryStatusMessage = matchedKeys.length > 0
      ? `\u5df2\u6309\u7b5b\u9009\u6761\u4ef6\u52fe\u9009 ${matchedKeys.length} \u6761\u6d3b\u52a8`
      : '\u672a\u627e\u5230\u7b26\u5408\u7b5b\u9009\u6761\u4ef6\u7684\u6d3b\u52a8';
    render(container, state.activeTabId);
    return matchedKeys;
  }

  async function loadShopSelectionPresetSnapshot(container, options = {}) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.loadSnapshot !== 'function') {
      return state.shopSelectionPreset;
    }

    return helper.loadSnapshot(state.shopSelectionPreset, {
      force: options.force === true,
      onChange: () => render(container, state.activeTabId, {
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

    return helper.saveLastSelection(state.shopSelectionPreset, selectedShopIds, {
      allowEmpty: true
    });
  }

  async function saveShopSelectionTemplate(container) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (!helper || typeof helper.saveTemplate !== 'function') {
      return null;
    }

    return helper.saveTemplate(state.shopSelectionPreset, state.signupSelectedShopIds, {
      onChange: () => render(container, state.activeTabId, {
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
      onChange: () => render(container, state.activeTabId, {
        preserveShopSelectorPanelScroll: true
      })
    });
  }

  function applyShopSelectionPreset(container, selectedShopIds) {
    const state = getState(container);
    const nextSelectedShopIds = normalizePresetShopSelection(state, selectedShopIds);
    const selectionChanged = normalizeActivityQuerySelectionSignature(nextSelectedShopIds)
      !== normalizeActivityQuerySelectionSignature(state.signupSelectedShopIds);

    if (nextSelectedShopIds.length <= 0 || selectionChanged !== true) {
      return;
    }

    state.signupSelectedShopIds = nextSelectedShopIds;
    state.shopSelectionTouched = true;
    clearActivityQueryResults(state);
    void saveShopSelectionLast(container, nextSelectedShopIds);
    render(container, state.activeTabId, {
      preserveShopSelectorPanelScroll: true
    });
  }

  async function loadShopSelectionPreference(container, options = {}) {
    const state = getState(container);
    const helper = getShopSelectionTemplateHelper();

    if (state.shopSelectionPreferenceLoading === true && state.shopSelectionPreferencePromise && options.force !== true) {
      return state.shopSelectionPreferencePromise;
    }

    if (options.force !== true && state.shopSelectionPreferenceLoaded === true) {
      return normalizeSelectedShopIds(state.signupSelectedShopIds);
    }

    if (!helper || typeof helper.getLastSelectionIds !== 'function') {
      state.shopSelectionPreferenceLoaded = true;
      return normalizeSelectedShopIds(state.signupSelectedShopIds);
    }

    state.shopSelectionPreferenceLoading = true;
    state.shopSelectionPreferencePromise = loadShopSelectionPresetSnapshot(container, {
      force: options.force === true
    })
      .then(() => {
        if (state.shopSelectionTouched === true && options.force !== true) {
          return normalizeSelectedShopIds(state.signupSelectedShopIds);
        }

        const nextSelectedShopIds = normalizePresetShopSelection(
          state,
          helper.getLastSelectionIds(state.shopSelectionPreset)
        );
        const selectionChanged = normalizeActivityQuerySelectionSignature(nextSelectedShopIds)
          !== normalizeActivityQuerySelectionSignature(state.signupSelectedShopIds);

        state.signupSelectedShopIds = nextSelectedShopIds;

        if (selectionChanged) {
          clearActivityQueryResults(state);
        }

        render(container, state.activeTabId);
        return nextSelectedShopIds;
      })
      .catch(() => normalizeSelectedShopIds(state.signupSelectedShopIds))
      .finally(() => {
        state.shopSelectionPreferenceLoaded = true;
        state.shopSelectionPreferenceLoading = false;
        state.shopSelectionPreferencePromise = null;
      });

    return state.shopSelectionPreferencePromise;
  }

  async function loadShopCatalog(container, options = {}) {
    const state = getState(container);
    const control = getShopMultiSelectControl();

    if (!control || typeof control.loadShopCatalog !== 'function') {
      state.shopSelectorLoaded = true;
      state.shopSelectorLoading = false;
      state.shopSelectorError = '\u5e97\u94fa\u9009\u62e9\u5668\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return Promise.resolve(state.shopCatalog);
    }

    if (state.shopSelectorLoading === true && state.shopSelectorPromise) {
      return state.shopSelectorPromise;
    }

    if (options.force !== true && state.shopSelectorLoaded === true) {
      return Promise.resolve(state.shopCatalog);
    }

    state.shopSelectorLoading = true;
    state.shopSelectorError = '';

    state.shopSelectorPromise = control.loadShopCatalog()
      .then((catalog) => {
        const nextCatalog = catalog && typeof catalog === 'object'
          ? catalog
          : buildEmptyShopCatalog();
        const nextSelectedShopIds = normalizeSelectedShopIds(state.signupSelectedShopIds)
          .filter((shopId) => Boolean(nextCatalog.shopMap && nextCatalog.shopMap[shopId]));
        const selectionChanged = normalizeActivityQuerySelectionSignature(nextSelectedShopIds) !== normalizeActivityQuerySelectionSignature(state.signupSelectedShopIds);

        state.shopCatalog = nextCatalog;
        state.signupSelectedShopIds = nextSelectedShopIds;
        state.shopSelectorLoaded = true;
        state.shopSelectorError = '';

        if (selectionChanged) {
          clearActivityQueryResults(state);
          void saveShopSelectionLast(container, nextSelectedShopIds);
        }

        render(container, state.activeTabId);
        return state.shopCatalog;
      })
      .catch((error) => {
        state.shopCatalog = buildEmptyShopCatalog();
        state.signupSelectedShopIds = [];
        state.shopSelectorLoaded = true;
        state.shopSelectorError = normalizeText(error && error.message) || '\u5e97\u94fa\u5217\u8868\u52a0\u8f7d\u5931\u8d25';
        clearActivityQueryResults(state);
        render(container, state.activeTabId);
        return state.shopCatalog;
      })
      .finally(() => {
        state.shopSelectorLoading = false;
        state.shopSelectorPromise = null;
      });

    return state.shopSelectorPromise;
  }

  function updateActiveState(container, activeTabId) {
    const state = getState(container);
    const normalizedActiveTabId = normalizeTabId(activeTabId);
    state.activeTabId = normalizedActiveTabId;

    Array.from(container.querySelectorAll('[data-ops-activity-tab]')).forEach((tabButton) => {
      const isActive = tabButton.getAttribute('data-ops-activity-tab') === normalizedActiveTabId;
      tabButton.classList.toggle('is-active', isActive);
      tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Array.from(container.querySelectorAll('[data-ops-activity-panel]')).forEach((panel) => {
      const isActive = panel.getAttribute('data-ops-activity-panel') === normalizedActiveTabId;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });

    container.dataset.activeOpsActivityTab = normalizedActiveTabId;
  }

  async function runActivityQuery(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const selectedShopIds = normalizeSelectedShopIds(state.signupSelectedShopIds);

    if (!featureCenterApi || typeof featureCenterApi.queryOperationsActivityManagementActivities !== 'function') {
      state.activityQueryStatusKind = 'error';
      state.activityQueryStatusMessage = '\u6d3b\u52a8\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container, state.activeTabId);
      return null;
    }

    if (selectedShopIds.length <= 0) {
      state.activityQueryStatusKind = 'error';
      state.activityQueryStatusMessage = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa';
      render(container, state.activeTabId);
      return null;
    }

    if (state.activityQueryLoading === true && state.activityQueryPromise) {
      return state.activityQueryPromise;
    }

    const requestId = state.activityQueryRequestId + 1;
    const selectionSignature = normalizeActivityQuerySelectionSignature(selectedShopIds);
    state.activityQueryRequestId = requestId;
    state.activityQueryLoading = true;
    clearSubmittedActivityState(state);
    state.activityQueryStatusKind = 'info';
    state.activityQueryStatusMessage = '\u6b63\u5728\u5e76\u884c\u67e5\u8be2\u5df2\u9009\u5e97\u94fa\u6d3b\u52a8...';
    render(container, state.activeTabId);

    const requestPromise = featureCenterApi.queryOperationsActivityManagementActivities({
      shopIds: selectedShopIds
    });
    state.activityQueryPromise = requestPromise;

    try {
      const response = await requestPromise;

      if (state.activityQueryRequestId !== requestId || normalizeActivityQuerySelectionSignature(state.signupSelectedShopIds) !== selectionSignature) {
        return response;
      }

      applyActivityQueryResponse(state, response);
      return response;
    } catch (error) {
      if (state.activityQueryRequestId !== requestId || normalizeActivityQuerySelectionSignature(state.signupSelectedShopIds) !== selectionSignature) {
        return null;
      }

      clearActivityQueryResults(state);
      state.activityQueryStatusKind = 'error';
      state.activityQueryStatusMessage = normalizeText(error && error.message) || '\u6d3b\u52a8\u67e5\u8be2\u5931\u8d25';
      return null;
    } finally {
      if (state.activityQueryRequestId === requestId) {
        state.activityQueryLoading = false;
        state.activityQueryPromise = null;
        render(container, state.activeTabId);
      }
    }
  }

  function mount(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    if (container.dataset.operationsActivityManagementMounted !== 'true') {
      container.dataset.operationsActivityManagementMounted = 'true';
      render(container, container.dataset.activeOpsActivityTab || getDefaultTabId());
    }

    if (!container.__operationsActivityManagementController) {
      const controller = createController(container);

      if (container.__opsActivityBackgroundPointerReleaseBound !== true) {
        const releaseInteraction = () => {
          const state = getState(container);
          const backgroundState = ensureActivityBackgroundSubmitState(state);

          if (backgroundState.logInteractionActive !== true) {
            return;
          }

          backgroundState.logInteractionActive = false;
          flushDeferredActivityBackgroundRender(container);
        };

        window.addEventListener('pointerup', releaseInteraction);
        window.addEventListener('pointercancel', releaseInteraction);
        container.__opsActivityBackgroundPointerReleaseBound = true;
      }

      controller.activate = function activate() {
        const nextTabId = container.dataset.activeOpsActivityTab || getDefaultTabId();
        updateActiveState(container, nextTabId);

        if (nextTabId === 'signup') {
          void loadShopCatalog(container);
          void loadShopSelectionPreference(container);
          void loadActivityFilterSettings(container, {
            render: false
          });
        }
      };

      controller.deactivate = function deactivate() {
        const state = getState(container);
        state.shopSelectorOpen = false;
        state.shopSelectorKeyword = '';
        state.shopSelectorFocusSearch = false;
        closeActivityFilterDialogState(state);
        render(container, state.activeTabId);
      };

      container.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const state = getState(container);
        const queryButton = target.closest('[data-ops-activity-query]');

        if (queryButton instanceof HTMLButtonElement) {
          if (!queryButton.disabled) {
            void runActivityQuery(container);
          }
          return;
        }

        const submitSelectedButton = target.closest('[data-ops-activity-submit-selected]');

        if (submitSelectedButton instanceof HTMLButtonElement) {
          if (!submitSelectedButton.disabled) {
            void submitSelectedActivities(container);
          }
          return;
        }

        const submitSelectedBackgroundButton = target.closest('[data-ops-activity-submit-selected-background]');

        if (submitSelectedBackgroundButton instanceof HTMLButtonElement) {
          if (!submitSelectedBackgroundButton.disabled) {
            openActivityBatchBackgroundPage(container);
          }
          return;
        }

        const tabButton = target.closest('[data-ops-activity-tab]');

        if (!(tabButton instanceof HTMLElement)) {
          const shopSelectorRoot = target.closest('[data-shop-multi-select]');

          if (state.shopSelectorOpen === true && !shopSelectorRoot) {
            state.shopSelectorOpen = false;
            state.shopSelectorKeyword = '';
            state.shopSelectorFocusSearch = false;
            render(container, state.activeTabId);
          }

          return;
        }

        const nextTabId = normalizeTabId(tabButton.getAttribute('data-ops-activity-tab'));
        if (nextTabId !== 'signup') {
          closeActivityFilterDialogState(state);
        }
        updateActiveState(container, nextTabId);
        render(container, nextTabId);

        if (nextTabId === 'signup') {
          void loadShopCatalog(container);
          void loadShopSelectionPreference(container);
          void loadActivityFilterSettings(container, {
            render: false
          });
        }
      });

      container.addEventListener('pointerdown', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const logTableWrap = target.closest('.ops-activity-background-log-table-wrap');

        if (!(logTableWrap instanceof HTMLElement)) {
          return;
        }

        const state = getState(container);
        const backgroundState = ensureActivityBackgroundSubmitState(state);

        backgroundState.logInteractionActive = true;
      });

      container.addEventListener('input', (event) => {
        const target = event.target;
        const state = getState(container);

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const filterField = normalizeText(target.getAttribute('data-ops-activity-filter-field'));

        if (filterField && 'value' in target) {
          clearActivityFilterFeedback(state);

          if (filterField === 'minDiscountRate') {
            state.activityFilterDraftMinDiscountRate = normalizeText(target.value);
          } else if (filterField === 'minEnrollRemainingDays') {
            state.activityFilterDraftMinEnrollRemainingDays = normalizeText(target.value).replace(/[^\d]/g, '');
          } else if (filterField === 'maxEnrollRemainingDays') {
            state.activityFilterDraftMaxEnrollRemainingDays = normalizeText(target.value).replace(/[^\d]/g, '');
          } else if (filterField === 'minActivityRemainingDays') {
            state.activityFilterDraftMinActivityRemainingDays = normalizeText(target.value).replace(/[^\d]/g, '');
          } else if (filterField === 'maxActivityRemainingDays') {
            state.activityFilterDraftMaxActivityRemainingDays = normalizeText(target.value).replace(/[^\d]/g, '');
          }

          render(container, state.activeTabId);
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
          state.shopSelectorOpen = true;
          state.shopSelectorFocusSearch = true;
          render(container, state.activeTabId);
          return;
        }

        const quickCostInputKey = normalizeText(target.getAttribute('data-ops-activity-batch-quick-cost-input'));

        if (quickCostInputKey && 'value' in target) {
          const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

          state.activityProductBatchState = productState;
          productState.quickCostDialogEntries = (Array.isArray(productState.quickCostDialogEntries) ? productState.quickCostDialogEntries : [])
            .map((entry) => {
              if (normalizeText(entry && entry.key) !== quickCostInputKey) {
                return entry;
              }

              return {
                ...entry,
                costPrice: normalizeQuickCostValue(target.value)
              };
            });
          productState.quickCostDialogError = '';
          productState.quickCostDialogWarning = '';
          productState.quickCostDialogNotice = '';
          return;
        }

        const backgroundQuickCostInputKey = normalizeText(target.getAttribute('data-ops-activity-background-quick-cost-input'));

        if (backgroundQuickCostInputKey && 'value' in target) {
          const backgroundState = ensureActivityBackgroundSubmitState(state);

          backgroundState.quickCostDialogEntries = (Array.isArray(backgroundState.quickCostDialogEntries) ? backgroundState.quickCostDialogEntries : [])
            .map((entry) => {
              if (normalizeText(entry && entry.key) !== backgroundQuickCostInputKey) {
                return entry;
              }

              return {
                ...entry,
                costPrice: normalizeQuickCostValue(target.value)
              };
            });
          backgroundState.quickCostDialogError = '';
          backgroundState.quickCostDialogWarning = '';
          backgroundState.quickCostDialogNotice = '';
          return;
        }

        const productFilterSetting = normalizeText(target.getAttribute('data-ops-activity-batch-product-filter-setting'));

        if (productFilterSetting && 'value' in target) {
          const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();

          if (productState.activityProductFilterDialogApplying === true) {
            return;
          }

          if (
            productFilterSetting === 'modeValue'
            || productFilterSetting === 'profitFloorRate'
            || productFilterSetting === 'profitFloorValue'
          ) {
            state.activityProductBatchState = productState;
            productState.activityProductFilterSettings = updateActivityProductFilterSettingsDraft(
              productState.activityProductFilterSettings,
              productFilterSetting,
              target.value
            );
            productState.activityProductFilterDialogError = '';
            productState.activityProductFilterDialogWarning = '';
            productState.activityProductFilterDialogNotice = '';
          }
        }

        const backgroundFilterSetting = normalizeText(target.getAttribute('data-ops-activity-background-filter-setting'));

        if (backgroundFilterSetting && 'value' in target) {
          const backgroundState = ensureActivityBackgroundSubmitState(state);

          if (backgroundState.running === true || backgroundState.filterSettingsLoading === true || backgroundState.filterSettingsSaving === true) {
            return;
          }

          if (
            backgroundFilterSetting === 'modeValue'
            || backgroundFilterSetting === 'profitFloorRate'
            || backgroundFilterSetting === 'profitFloorValue'
          ) {
            backgroundState.filterSettings = updateActivityProductFilterSettingsDraft(
              backgroundState.filterSettings,
              backgroundFilterSetting,
              target.value
            );
            backgroundState.filterSettingsError = '';
            backgroundState.filterSettingsWarning = '';
            backgroundState.filterSettingsNotice = '';
          }
        }
      });

      container.addEventListener('change', (event) => {
        const target = event.target;
        const state = getState(container);

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const activityThemeTypeValue = normalizeText(target.getAttribute('data-ops-activity-filter-theme-type'));

        if (activityThemeTypeValue && target instanceof HTMLInputElement) {
          const currentDraftValues = new Set(normalizeActivityThemeTypeFilterValues(state.activityFilterDraftThemeTypes));

          if (target.checked) {
            currentDraftValues.add(activityThemeTypeValue);
          } else {
            currentDraftValues.delete(activityThemeTypeValue);
          }

          state.activityFilterDraftThemeTypes = normalizeActivityThemeTypeFilterValues(Array.from(currentDraftValues));
          clearActivityFilterFeedback(state);
          render(container, state.activeTabId);
          return;
        }

        const checkAllFlag = normalizeText(target.getAttribute('data-ops-activity-check-all'));

        if (checkAllFlag && target instanceof HTMLInputElement) {
          state.activitySelectedKeys = target.checked
            ? buildSelectableActivityKeys(state.activityQueryRows)
            : [];
          render(container, state.activeTabId, {
            preserveActivityQueryTableScroll: true
          });
          return;
        }

        const rowCheckFlag = normalizeText(target.getAttribute('data-ops-activity-row-check'));
        const rowActivityKey = normalizeText(target.getAttribute('data-ops-activity-key'));

        if (rowCheckFlag && rowActivityKey && target instanceof HTMLInputElement) {
          const selectableActivityKeySet = new Set(buildSelectableActivityKeys(state.activityQueryRows));
          const selectedActivityKeySet = new Set(normalizeActivitySelectedKeys(state.activitySelectedKeys));

          if (target.checked) {
            selectedActivityKeySet.add(rowActivityKey);
          } else {
            selectedActivityKeySet.delete(rowActivityKey);
          }

          state.activitySelectedKeys = Array.from(selectedActivityKeySet)
            .filter((activityKey) => selectableActivityKeySet.has(activityKey));
          render(container, state.activeTabId, {
            preserveActivityQueryTableScroll: true
          });
          return;
        }

        const selectedShopId = normalizeText(target.getAttribute('data-shop-multi-select-shop'));

        if (selectedShopId && target instanceof HTMLInputElement) {
          const control = getShopMultiSelectControl();
          const nextSelectedShopIds =
            control && typeof control.toggleShopSelection === 'function'
              ? control.toggleShopSelection(state.signupSelectedShopIds, selectedShopId, target.checked)
              : normalizeSelectedShopIds(state.signupSelectedShopIds);

          state.signupSelectedShopIds = nextSelectedShopIds;
          state.shopSelectionTouched = true;
          clearActivityQueryResults(state);
          void saveShopSelectionLast(container, nextSelectedShopIds);
          render(container, state.activeTabId, {
            preserveShopSelectorPanelScroll: true
          });
          return;
        }

        const batchFilterShopFlag = normalizeText(target.getAttribute('data-ops-activity-batch-filter-shop'));

        if (batchFilterShopFlag && target instanceof HTMLSelectElement) {
          void updateActivityBatchProductView(container, {
            filterShopId: target.value
          });
          return;
        }

        const batchFilterActivityFlag = normalizeText(target.getAttribute('data-ops-activity-batch-filter-activity'));

        if (batchFilterActivityFlag && target instanceof HTMLSelectElement) {
          void updateActivityBatchProductView(container, {
            filterActivityKey: target.value
          });
          return;
        }

        const batchFilterCostFlag = normalizeText(target.getAttribute('data-ops-activity-batch-filter-cost'));

        if (batchFilterCostFlag && target instanceof HTMLSelectElement) {
          void updateActivityBatchProductView(container, {
            costFilter: target.value
          });
          return;
        }

        const batchFilterSignupStatusFlag = normalizeText(target.getAttribute('data-ops-activity-batch-filter-signup-status'));

        if (batchFilterSignupStatusFlag && target instanceof HTMLSelectElement) {
          void updateActivityBatchProductView(container, {
            filterSignupStatus: target.value
          });
          return;
        }

        const productFilterSetting = normalizeText(target.getAttribute('data-ops-activity-batch-product-filter-setting'));

        if (productFilterSetting && 'value' in target) {
          const nextValue = target instanceof HTMLInputElement && target.type === 'checkbox'
            ? String(target.checked)
            : target.value;
          updateActivityBatchProductFilterSetting(container, productFilterSetting, nextValue);
          return;
        }

        const backgroundFilterSetting = normalizeText(target.getAttribute('data-ops-activity-background-filter-setting'));

        if (backgroundFilterSetting && 'value' in target) {
          const nextValue = target instanceof HTMLInputElement && target.type === 'checkbox'
            ? String(target.checked)
            : target.value;
          updateActivityBackgroundFilterSetting(container, backgroundFilterSetting, nextValue);
          return;
        }
      });

      container.addEventListener('pointerdown', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (event.button !== 0 || event.isPrimary === false) {
          return;
        }

        const openProductFilterButton = target.closest('[data-ops-activity-batch-open-filter-products]');

        if (openProductFilterButton instanceof HTMLButtonElement) {
          if (!openProductFilterButton.disabled) {
            markRecentPointerHandled(container, 'open-activity-batch-product-filter-dialog');
            event.preventDefault();
            openActivityBatchProductFilterDialog(container);
          }
          return;
        }

        const productFilterApplyButton = target.closest('[data-ops-activity-batch-product-filter-action="apply"]');

        if (productFilterApplyButton instanceof HTMLButtonElement) {
          if (!productFilterApplyButton.disabled) {
            markRecentPointerHandled(container, 'apply-activity-batch-product-filter-dialog');
            event.preventDefault();
            applyActivityBatchProductFilterDialog(container);
          }
        }
      });

      container.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const state = getState(container);
        const sortButton = target.closest('[data-ops-activity-sort-field]');

        if (sortButton instanceof HTMLButtonElement) {
          const sortField = normalizeText(sortButton.getAttribute('data-ops-activity-sort-field'));

          if (sortField) {
            toggleActivitySortState(state, sortField);
            render(container, state.activeTabId);
          }
          return;
        }

        const submittedActivityButton = target.closest('[data-ops-activity-submitted-key]');

        if (submittedActivityButton instanceof HTMLButtonElement) {
          const activityKey = normalizeText(submittedActivityButton.getAttribute('data-ops-activity-submitted-key'));

          if (activityKey) {
            void activateSubmittedActivity(container, activityKey);
          }
          return;
        }

        const batchSortButton = target.closest('[data-ops-activity-batch-sort-field]');

        if (batchSortButton instanceof HTMLButtonElement) {
          const productState = state.activityProductBatchState || buildEmptyActivityProductBatchState();
          const sortField = normalizeText(batchSortButton.getAttribute('data-ops-activity-batch-sort-field'));

          state.activityProductBatchState = productState;
          toggleActivityBatchProductSortState(productState, sortField);
          void updateActivityBatchProductView(container, {
            sortField: productState.sortField,
            sortDirection: productState.sortDirection
          });
          return;
        }

        const batchResetFiltersButton = target.closest('[data-ops-activity-batch-reset-filters]');

        if (batchResetFiltersButton instanceof HTMLButtonElement) {
          if (!batchResetFiltersButton.disabled) {
            void updateActivityBatchProductView(container, {
              filterShopId: '',
              filterActivityKey: '',
              costFilter: '',
              filterSignupStatus: ''
            });
          }
          return;
        }

        const openBatchQuickCostButton = target.closest('[data-ops-activity-batch-open-quick-cost]');

        if (openBatchQuickCostButton instanceof HTMLButtonElement) {
          if (!openBatchQuickCostButton.disabled) {
            void openActivityBatchQuickCostDialog(container);
          }
          return;
        }

        const openBackgroundQuickCostButton = target.closest('[data-ops-activity-background-open-quick-cost]');

        if (openBackgroundQuickCostButton instanceof HTMLButtonElement) {
          if (!openBackgroundQuickCostButton.disabled) {
            void openActivityBackgroundQuickCostDialog(container);
          }
          return;
        }

        const openProductFilterButton = target.closest('[data-ops-activity-batch-open-filter-products]');

        if (openProductFilterButton instanceof HTMLButtonElement) {
          if (consumeRecentPointerHandled(container, 'open-activity-batch-product-filter-dialog')) {
            return;
          }

          if (!openProductFilterButton.disabled) {
            openActivityBatchProductFilterDialog(container);
          }
          return;
        }

        const submitBatchProductsButton = target.closest('[data-ops-activity-batch-submit-products]');

        if (submitBatchProductsButton instanceof HTMLButtonElement) {
          if (!submitBatchProductsButton.disabled) {
            void submitActivityBatchProducts(container);
          }
          return;
        }

        const stopBatchQueryButton = target.closest('[data-ops-activity-batch-stop-query]');

        if (stopBatchQueryButton instanceof HTMLButtonElement) {
          if (!stopBatchQueryButton.disabled) {
            void stopActivityBatchProductQuery(container);
          }
          return;
        }

        const restartBackgroundButton = target.closest('[data-ops-activity-background-restart]');

        if (restartBackgroundButton instanceof HTMLButtonElement) {
          if (!restartBackgroundButton.disabled) {
            void startActivityBackgroundSubmit(container);
          }
          return;
        }

        const stopBackgroundButton = target.closest('[data-ops-activity-background-stop]');

        if (stopBackgroundButton instanceof HTMLButtonElement) {
          if (!stopBackgroundButton.disabled) {
            void stopActivityBackgroundSubmit(container);
          }
          return;
        }

        const toggleBackgroundSectionButton = target.closest('[data-ops-activity-background-toggle-section]');

        if (toggleBackgroundSectionButton instanceof HTMLButtonElement) {
          const backgroundState = ensureActivityBackgroundSubmitState(state);
          const sectionId = normalizeText(toggleBackgroundSectionButton.getAttribute('data-ops-activity-background-toggle-section'));

          if (sectionId === 'settings') {
            backgroundState.settingsCollapsed = backgroundState.settingsCollapsed !== true;
            render(container, state.activeTabId);
            return;
          }

          if (sectionId === 'summary') {
            backgroundState.summaryCollapsed = backgroundState.summaryCollapsed !== true;
            render(container, state.activeTabId);
            return;
          }
        }

        const quickCostBackdrop = target.closest('[data-ops-activity-quick-cost-backdrop]');
        const quickCostPanel = target.closest('[data-ops-activity-quick-cost-panel]');

        if (
          quickCostBackdrop
          && !quickCostPanel
          && state.activityProductBatchState
          && state.activityProductBatchState.quickCostDialogSaving !== true
        ) {
          closeActivityBatchQuickCostDialog(container);
          return;
        }

        const quickCostActionButton = target.closest('[data-ops-activity-batch-quick-cost-action]');

        if (quickCostActionButton instanceof HTMLButtonElement) {
          const actionId = normalizeText(quickCostActionButton.getAttribute('data-ops-activity-batch-quick-cost-action'));

          if (actionId === 'close') {
            closeActivityBatchQuickCostDialog(container);
            return;
          }

          if (actionId === 'save') {
            void saveActivityBatchQuickCostDialog(container);
            return;
          }
        }

        const backgroundQuickCostBackdrop = target.closest('[data-ops-activity-background-quick-cost-backdrop]');
        const backgroundQuickCostPanel = target.closest('[data-ops-activity-background-quick-cost-panel]');

        if (
          backgroundQuickCostBackdrop
          && !backgroundQuickCostPanel
          && state.activityBackgroundSubmitState
          && state.activityBackgroundSubmitState.quickCostDialogSaving !== true
        ) {
          closeActivityBackgroundQuickCostDialog(container);
          return;
        }

        const backgroundQuickCostActionButton = target.closest('[data-ops-activity-background-quick-cost-action]');

        if (backgroundQuickCostActionButton instanceof HTMLButtonElement) {
          const actionId = normalizeText(backgroundQuickCostActionButton.getAttribute('data-ops-activity-background-quick-cost-action'));

          if (actionId === 'close') {
            closeActivityBackgroundQuickCostDialog(container);
            return;
          }

          if (actionId === 'save') {
            void saveActivityBackgroundQuickCostDialog(container);
            return;
          }
        }

        const productFilterBackdrop = target.closest('[data-ops-activity-product-filter-backdrop]');
        const productFilterPanel = target.closest('[data-ops-activity-product-filter-panel]');

        if (
          productFilterBackdrop
          && !productFilterPanel
          && state.activityProductBatchState
          && state.activityProductBatchState.activityProductFilterDialogApplying !== true
        ) {
          closeActivityBatchProductFilterDialog(container);
          return;
        }

        const productFilterActionButton = target.closest('[data-ops-activity-batch-product-filter-action]');

        if (productFilterActionButton instanceof HTMLButtonElement) {
          const actionId = normalizeText(productFilterActionButton.getAttribute('data-ops-activity-batch-product-filter-action'));

          if (actionId === 'close') {
            closeActivityBatchProductFilterDialog(container);
            return;
          }

          if (actionId === 'apply') {
            if (consumeRecentPointerHandled(container, 'apply-activity-batch-product-filter-dialog')) {
              return;
            }

            applyActivityBatchProductFilterDialog(container);
            return;
          }
        }

        const skuToggleButton = target.closest('[data-ops-activity-sku-toggle]');

        if (skuToggleButton instanceof HTMLButtonElement) {
          const rowKey = normalizeText(skuToggleButton.getAttribute('data-ops-activity-sku-toggle'));

          if (rowKey) {
            toggleActivityBatchProductSkuDetails(container, rowKey);
          }
          return;
        }

        const backToActivitiesButton = target.closest('[data-ops-activity-products-back]');

        if (backToActivitiesButton instanceof HTMLButtonElement) {
          if (!backToActivitiesButton.disabled) {
            returnToActivityQueryStep(container);
          }
          return;
        }

        const batchPageButton = target.closest('[data-ops-activity-batch-page-action]');

        if (batchPageButton instanceof HTMLButtonElement) {
          const pageAction = normalizeText(batchPageButton.getAttribute('data-ops-activity-batch-page-action'));

          if (pageAction && !batchPageButton.disabled) {
            void changeActivityBatchTablePage(container, pageAction);
          }
          return;
        }

        const productPageButton = target.closest('[data-ops-activity-product-page-action]');

        if (productPageButton instanceof HTMLButtonElement) {
          const activityKey = normalizeText(productPageButton.getAttribute('data-ops-activity-key'));
          const pageAction = normalizeText(productPageButton.getAttribute('data-ops-activity-product-page-action'));

          if (activityKey && pageAction && !productPageButton.disabled) {
            void changeActivityProductTablePage(container, activityKey, pageAction);
          }
          return;
        }

        const filterBackdrop = target.closest('[data-ops-activity-filter-backdrop]');
        const filterPanel = target.closest('[data-ops-activity-filter-panel]');

        if (
          state.activityFilterDialogOpen === true
          && filterBackdrop
          && !filterPanel
          && state.activityFilterSaving !== true
        ) {
          closeActivityFilterDialog(container);
          return;
        }

        const filterActionButton = target.closest('[data-ops-activity-filter-action]');

        if (filterActionButton instanceof HTMLButtonElement) {
          const actionId = normalizeText(filterActionButton.getAttribute('data-ops-activity-filter-action'));

          if (actionId === 'open') {
            openActivityFilterDialog(container);
            return;
          }

          if ((actionId === 'close' || actionId === 'cancel') && state.activityFilterSaving !== true) {
            closeActivityFilterDialog(container);
            return;
          }

          if (actionId === 'reset' && state.activityFilterSaving !== true) {
            state.activityFilterDraftMinDiscountRate = '';
            state.activityFilterDraftMinEnrollRemainingDays = '';
            state.activityFilterDraftMaxEnrollRemainingDays = '';
            state.activityFilterDraftMinActivityRemainingDays = '';
            state.activityFilterDraftMaxActivityRemainingDays = '';
            state.activityFilterDraftThemeTypes = [];
            clearActivityFilterFeedback(state);
            render(container, state.activeTabId);
            return;
          }

          if (actionId === 'save' && state.activityFilterSaving !== true) {
            void saveActivityFilterSettings(container);
            return;
          }
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

        const shopSelectorToggle = target.closest('[data-shop-multi-select-toggle]');

        if (shopSelectorToggle instanceof HTMLButtonElement) {
          if (!shopSelectorToggle.disabled) {
            state.shopSelectorOpen = !state.shopSelectorOpen;
            state.shopSelectorFocusSearch = state.shopSelectorOpen === true;
            if (state.shopSelectorOpen !== true) {
              state.shopSelectorKeyword = '';
            }
            render(container, state.activeTabId);
          }
          return;
        }

        const shopSelectorAction = target.closest('[data-shop-multi-select-action]');
        if (shopSelectorAction instanceof HTMLButtonElement) {
          const actionId = normalizeText(shopSelectorAction.getAttribute('data-shop-multi-select-action'));
          const control = getShopMultiSelectControl();

          if (actionId === 'select-visible' && control && typeof control.setAllVisibleSelection === 'function') {
            state.signupSelectedShopIds = control.setAllVisibleSelection(
              state.shopCatalog,
              state.signupSelectedShopIds,
              state.shopSelectorKeyword,
              true
            );
          } else if (actionId === 'clear') {
            state.signupSelectedShopIds = [];
          }

          state.shopSelectionTouched = true;
          clearActivityQueryResults(state);
          void saveShopSelectionLast(container, state.signupSelectedShopIds);
          render(container, state.activeTabId, {
            preserveShopSelectorPanelScroll: true
          });
          return;
        }

        const shopSelectorSectionAction = target.closest('[data-shop-multi-select-section]');
        if (shopSelectorSectionAction instanceof HTMLButtonElement) {
          const sectionId = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section'));
          const sectionMode = normalizeText(shopSelectorSectionAction.getAttribute('data-shop-multi-select-section-mode'));
          const control = getShopMultiSelectControl();

          if (control && typeof control.setGroupSelection === 'function') {
            state.signupSelectedShopIds = control.setGroupSelection(
              state.shopCatalog,
              state.signupSelectedShopIds,
              sectionId,
              state.shopSelectorKeyword,
              sectionMode !== 'clear'
            );
          }

          state.shopSelectionTouched = true;
          clearActivityQueryResults(state);
          void saveShopSelectionLast(container, state.signupSelectedShopIds);
          render(container, state.activeTabId, {
            preserveShopSelectorPanelScroll: true
          });
        }
      });

      container.__operationsActivityManagementController = controller;
    }

    updateActiveState(container, container.dataset.activeOpsActivityTab || getDefaultTabId());
    if ((container.dataset.activeOpsActivityTab || getDefaultTabId()) === 'signup') {
      void loadShopCatalog(container);
      void loadShopSelectionPreference(container);
      void loadActivityFilterSettings(container, {
        render: false
      });
    }
    return container.__operationsActivityManagementController;
  }

  window.operationsActivityManagementView = {
    mount
  };
})();
