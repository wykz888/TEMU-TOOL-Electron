(function initOperationsNewProductLifecycleView() {
  const profitMetrics = window.operationsProfitMetrics && typeof window.operationsProfitMetrics === 'object'
    ? window.operationsProfitMetrics
    : null;
  const MAX_CATEGORY_LEVEL = 4;
  const PRODUCT_THUMBNAIL_SIZE = '120x';
  const PRODUCT_PREVIEW_SIZE = '1200x';
  const SHOP_SELECTION_SCOPE_KEY = 'operations-new-product-lifecycle';

  const DEFAULT_FILTERS = Object.freeze({
    selectedShopIds: Object.freeze([]),
    stationIds: Object.freeze(['100']),
    productSource: '',
    adStation: '',
    adLevels: Object.freeze([]),
    category: '',
    categoryTrail: '',
    categoryPathLabels: Object.freeze([]),
    categorySelections: Object.freeze([]),
    productName: '',
    productIdType: 'spu',
    productIdKeywords: '',
    goodsNoType: 'sku',
    goodsNoKeywords: '',
    timeField: 'createdAt',
    startTime: '',
    endTime: '',
    deletedState: '',
    costState: '',
    trafficStates: Object.freeze([]),
    pageDelayMinSeconds: '',
    pageDelayMaxSeconds: ''
  });

  const AD_LEVEL_OPTIONS = Object.freeze([
    { value: 'S', label: 'S\u7ea7' },
    { value: 'A', label: 'A\u7ea7' },
    { value: 'B', label: 'B\u7ea7' },
    { value: 'C', label: 'C\u7ea7' }
  ]);

  const PRODUCT_ID_TYPE_OPTIONS = Object.freeze([
    { value: 'spu', label: 'SPU' },
    { value: 'skc', label: 'SKC' },
    { value: 'sku', label: 'SKU' }
  ]);

  const GOODS_NO_TYPE_OPTIONS = Object.freeze([
    { value: 'sku', label: 'SKU' },
    { value: 'skc', label: 'SKC' }
  ]);

  const TIME_FIELD_OPTIONS = Object.freeze([
    { value: 'createdAt', label: '\u521b\u5efa\u65f6\u95f4' },
    { value: 'priceConfirmedAt', label: '\u4ef7\u683c\u786e\u8ba4\u65f6\u95f4' },
    { value: 'joinedStationAt', label: '\u52a0\u5165\u7ad9\u70b9\u65f6\u95f4' },
    { value: 'offlineAt', label: '\u4e0b\u67b6\u65f6\u95f4' }
  ]);

  const DELETED_STATE_OPTIONS = Object.freeze([
    { value: 'yes', label: '\u662f' },
    { value: 'no', label: '\u5426' }
  ]);

  const TRAFFIC_STATE_OPTIONS = Object.freeze([
    { value: 'willDrop', label: '\u5546\u54c1\u6d41\u91cf\u9884\u6d4b\u5c06\u4e0b\u964d' },
    { value: 'dropped', label: '\u5546\u54c1\u6d41\u91cf\u6709\u4e0b\u964d' }
  ]);
  const COST_STATE_OPTIONS = Object.freeze([
    { value: '', label: '\u5168\u90e8\u72b6\u6001' },
    { value: 'unset', label: '\u672a\u8bbe\u7f6e' },
    { value: 'set', label: '\u5df2\u8bbe\u7f6e' }
  ]);
  const PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50, 100]);
  const BATCH_ADJUST_MODE_OPTIONS = Object.freeze([
    { value: 'fixed', label: '\u56fa\u5b9a\u4ef7\u683c' },
    { value: 'reduce', label: '\u76f4\u51cf\u4ef7\u683c' },
    { value: 'discount', label: '\u6298\u6263\u8c03\u4ef7' }
  ]);
  const BATCH_ADJUST_REASON_OPTIONS = Object.freeze([
    { value: 'clearance', label: '\u964d\u4ef7\u6e05\u4ed3' },
    { value: 'competitiveness', label: '\u964d\u4ef7\u63d0\u5347\u7ade\u4e89\u529b' },
    { value: 'promotion', label: '\u4fc3\u9500' },
    { value: 'promotion_slow_moving_risk', label: '\u4fc3\u9500-\u5546\u54c1\u6709\u6ede\u9500\u98ce\u9669\uff0c\u8c03\u7533\u62a5\u4ef7\u53ef\u4fc3\u9500\u53d8\u73b0\u3002\u62d2\u7edd\u5bfc\u81f4\u957f\u671f\u6ede\u9500\uff0c\u9000\u4f9b\u6210\u672c\u7531\u5546\u5bb6\u627f\u62c5\u3002' },
    { value: 'exposure', label: '\u964d\u4ef7\u63d0\u9ad8\u5546\u54c1\u66dd\u5149' }
  ]);
  const BATCH_ADJUST_PROFIT_FLOOR_MODE_OPTIONS = Object.freeze([
    { value: 'rate', label: '\u5229\u6da6\u7387' },
    { value: 'value', label: '\u5229\u6da6\u503c' }
  ]);
  const PRICE_DECL_PREVIEW_RESULT_OPTIONS = Object.freeze([
    { value: 'approve', label: '\u901a\u8fc7\u6838\u4ef7' },
    { value: 'redeclare', label: '\u91cd\u65b0\u6838\u4ef7' },
    { value: 'void', label: '\u4f5c\u5e9f\u6838\u4ef7' },
    { value: 'skip', label: '\u8df3\u8fc7' }
  ]);
  const PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE = 120;
  const BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT = 148;
  const BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT = 720;
  const BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_OVERSCAN = 8;
  const BATCH_ADJUST_DIALOG_AUTO_SAVE_DEBOUNCE_MS = 1500;
  const BATCH_ADJUST_DIALOG_AUTO_SAVE_MIN_INTERVAL_MS = 15000;
  const BATCH_ADJUST_DAILY_RULE_SCOPE_TEXT = '\u4ee5\u4e0b\u4ef7\u683c\u7ec4\u4ec5\u5bf9\u65e5\u5e38\u4ef7\u683c\u751f\u6548\uff0c\u6d3b\u52a8\u4ef7\u53ea\u6309\u6d3b\u52a8\u76f4\u51cf\u4ef7\u548c\u6d3b\u52a8\u4fdd\u5e95\u5229\u6da6\u6821\u9a8c\u3002';
  const BATCH_ADJUST_ACTIVITY_PREVIEW_SCOPE_TEXT = '\u6d3b\u52a8\uff1a\u4e0d\u6309\u4e0a\u65b9\u65e5\u5e38\u4ef7\u683c\u7ec4\uff0c\u63d0\u4ea4\u65f6\u83b7\u53d6\u5b9e\u9645\u6d3b\u52a8\u4ef7\u540e\u6309\u76f4\u51cf\u4ef7\u548c\u6d3b\u52a8\u4fdd\u5e95\u5229\u6da6\u6821\u9a8c';
  const BATCH_ADJUST_ACTIVITY_HELP_TEXT = '\u4ec5\u5bf9\u5df2\u6709\u6d3b\u52a8\u7533\u62a5\u4ef7\u7684SKU\u751f\u6548\uff0c\u4e0d\u6309\u4e0a\u65b9\u65e5\u5e38\u4ef7\u683c\u7ec4\u9650\u5236\u3002\u63d0\u4ea4\u65f6\u4f1a\u5148\u4e8c\u6b21\u83b7\u53d6\u5b9e\u9645\u6d3b\u52a8\u4ef7\uff0c\u518d\u6309\u8fd9\u91cc\u586b\u5199\u7684\u76f4\u51cf\u91d1\u989d\u751f\u6210\u65b0\u7684\u6d3b\u52a8\u7533\u62a5\u4ef7\u3002\u4e00\u822c\u5efa\u8bae\u586b0.5\u5143\uff0c\u6ca1\u6709\u6d3b\u52a8\u4ef7\u7684SKU\u4f1a\u81ea\u52a8\u8df3\u8fc7\uff0c\u7559\u7a7a\u8868\u793a\u4e0d\u8c03\u6574\u6d3b\u52a8\u4ef7\u3002';
  const BATCH_ADJUST_DAILY_PROFIT_FLOOR_HELP_TEXT = '\u4ec5\u5bf9\u65e5\u5e38\u8c03\u4ef7\u751f\u6548\u3002\u6309\u5f53\u524d\u65e5\u5e38\u9884\u89c8\u4ef7\u683c\u6821\u9a8c\u4fdd\u5e95\u5229\u6da6\uff0c\u4f4e\u4e8e\u8bbe\u5b9a\u503c\u7684SKU\u4f1a\u5728\u9884\u89c8\u4e2d\u76f4\u63a5\u63d0\u793a\u5e76\u8df3\u8fc7\u63d0\u4ea4\u3002\u7559\u7a7a\u8868\u793a\u4e0d\u9650\u5236\u65e5\u5e38\u4fdd\u5e95\u5229\u6da6\u3002';
  const BATCH_ADJUST_ACTIVITY_PROFIT_FLOOR_HELP_TEXT = '\u4ec5\u5bf9\u6d3b\u52a8\u8c03\u4ef7\u751f\u6548\uff0c\u4e0d\u6309\u4e0a\u65b9\u65e5\u5e38\u4ef7\u683c\u7ec4\u6821\u9a8c\u3002\u63d0\u4ea4\u65f6\u4f1a\u5148\u83b7\u53d6\u5b9e\u9645\u6d3b\u52a8\u4ef7\uff0c\u518d\u6309\u6d3b\u52a8\u76f4\u51cf\u4ef7\u8ba1\u7b97\u76ee\u6807\u4ef7\u5e76\u505a\u4fdd\u5e95\u5229\u6da6\u6821\u9a8c\uff0c\u9884\u89c8\u91cc\u4e0d\u4f1a\u672c\u5730\u63d0\u524d\u8ba1\u7b97\u3002\u7559\u7a7a\u8868\u793a\u4e0d\u9650\u5236\u6d3b\u52a8\u4fdd\u5e95\u5229\u6da6\u3002';
  const BATCH_ADJUST_DUPLICATE_SUBMIT_HELP_TEXT = '\u6309\u6210\u529f\u63d0\u4ea4\u8bb0\u5f55\u8fc7\u6ee4\u91cd\u590d\u8c03\u4ef7\u3002\u4f8b\u5982\u586b3\uff0c\u5219\u8fd13\u5929\u5185\u5df2\u6210\u529f\u63d0\u4ea4\u8fc7\u7684\u540c\u7c7bSKU\u4f1a\u81ea\u52a8\u8df3\u8fc7\uff1b\u65e5\u5e38\u548c\u6d3b\u52a8\u5206\u5f00\u8bb0\u5f55\u3002\u7559\u7a7a\u62160\u8868\u793a\u4e0d\u8fc7\u6ee4\u3002';
  const BATCH_ADJUST_SUGGESTED_PRICE_FALLBACK_HELP_TEXT = '\u4ec5\u5bf9\u65e5\u5e38\u8c03\u4ef7\u751f\u6548\u3002\u6309\u540c\u7c7bSKU\u7684\u5386\u53f2\u6210\u529f\u8c03\u4ef7\u6b21\u6570\u5224\u65ad\uff0c\u8fbe\u5230\u8bbe\u5b9a\u6b21\u6570\u540e\uff0c\u65e5\u5e38\u4f18\u5148\u6539\u7528\u5e73\u53f0\u5efa\u8bae\u65e5\u5e38\u4ef7\uff0c\u6700\u7ec8\u4ecd\u4f1a\u7ee7\u7eed\u6821\u9a8c\u4fdd\u5e95\u5229\u6da6\u3002\u7559\u7a7a\u62160\u8868\u793a\u4e0d\u542f\u7528\u3002';

  const PRODUCT_SOURCE_OPTIONS = Object.freeze([
    { value: '', label: '\u5168\u90E8' },
    { value: 'pricePending', label: '\u4EF7\u683C\u7533\u62A5-\u4EF7\u683C\u7533\u62A5\u4E2D' },
    { value: 'pricePendingSellerConfirm', label: '\u4EF7\u683C\u7533\u62A5-\u5F85\u5356\u5BB6\u786E\u8BA4' },
    { value: 'priceInvalid', label: '\u4EF7\u683C\u5DF2\u4F5C\u5E9F' },
    { value: 'unpublished', label: '\u672A\u53D1\u5E03\u5230\u7AD9\u70B9' },
    { value: 'published', label: '\u5DF2\u53D1\u5E03\u5230\u7AD9\u70B9' },
    { value: 'offline', label: '\u5DF2\u4E0B\u67B6' },
    { value: 'terminated', label: '\u7EC8\u6B62' }
  ]);
  const PRODUCT_SOURCE_LABEL_MAP = Object.freeze(
    PRODUCT_SOURCE_OPTIONS.reduce((result, option) => {
      const optionValue = normalizeText(option && option.value);
      const optionLabel = normalizeText(option && option.label);

      if (optionValue && optionLabel) {
        result[optionValue] = optionLabel;
      }

      return result;
    }, {})
  );
  const STATUS_META = Object.freeze({
    published: { label: '\u5DF2\u53D1\u5E03\u5230\u7AD9\u70B9', tone: 'green' },
    unpublished: { label: '\u672A\u53D1\u5E03\u5230\u7AD9\u70B9', tone: 'amber' },
    pricePending: { label: '\u4EF7\u683C\u7533\u62A5-\u4EF7\u683C\u7533\u62A5\u4E2D', tone: 'blue' },
    pricePendingSellerConfirm: { label: '\u4EF7\u683C\u7533\u62A5-\u5F85\u5356\u5BB6\u786E\u8BA4', tone: 'blue' },
    priceInvalid: { label: '\u4EF7\u683C\u5DF2\u4F5C\u5E9F', tone: 'red' },
    offline: { label: '\u5DF2\u4E0B\u67B6', tone: 'slate' },
    terminated: { label: '\u7EC8\u6B62', tone: 'slate' }
  });
  const STATUS_DISPLAY_ORDER = Object.freeze([
    'published',
    'unpublished',
    'pricePending',
    'pricePendingSellerConfirm',
    'priceInvalid',
    'offline',
    'terminated'
  ]);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizePriceDeclReduceType(value) {
    return normalizeText(value) === 'flatReduce' ? 'flatReduce' : 'discount';
  }

  function getPriceDeclReduceValueByType(state, reduceType) {
    const normalizedReduceType = normalizePriceDeclReduceType(reduceType);

    if (normalizedReduceType === 'flatReduce') {
      return normalizeText(state.priceDeclDialogApproveReduceValueFlatReduce);
    }

    return normalizeText(state.priceDeclDialogApproveReduceValueDiscount);
  }

  function setPriceDeclReduceValueByType(state, reduceType, value) {
    const normalizedReduceType = normalizePriceDeclReduceType(reduceType);
    const normalizedValue = normalizeText(value);

    state.priceDeclDialogApproveReduceType = normalizedReduceType;
    state.priceDeclDialogApproveReduceValue = normalizedValue;

    if (normalizedReduceType === 'flatReduce') {
      state.priceDeclDialogApproveReduceValueFlatReduce = normalizedValue;
      return;
    }

    state.priceDeclDialogApproveReduceValueDiscount = normalizedValue;
  }

  function createPriceDeclFallbackApproveRuleId() {
    return `npl_price_decl_fallback_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizePriceDeclFallbackApproveRuleLogicMode(value) {
    return normalizeText(value) === 'or' ? 'or' : 'and';
  }

  function createDefaultPriceDeclFallbackApproveRule(overrides = {}) {
    return {
      id: normalizeText(overrides && overrides.id) || createPriceDeclFallbackApproveRuleId(),
      reviewTimesMin: normalizeText(overrides && overrides.reviewTimesMin),
      profitRateValue: normalizeText(overrides && overrides.profitRateValue),
      profitLogicMode: normalizePriceDeclFallbackApproveRuleLogicMode(
        overrides && overrides.profitLogicMode
      ),
      profitValueValue: normalizeText(overrides && overrides.profitValueValue)
    };
  }

  function normalizePriceDeclFallbackApproveRule(rule = {}) {
    return createDefaultPriceDeclFallbackApproveRule(rule);
  }

  function normalizePriceDeclFallbackApproveRuleList(rules) {
    return (Array.isArray(rules) ? rules : [])
      .map((rule) => normalizePriceDeclFallbackApproveRule(rule))
      .filter((rule, index, list) => {
        return list.findIndex((item) => normalizeText(item && item.id) === normalizeText(rule && rule.id)) === index;
      });
  }

  function hasConfiguredPriceDeclFallbackApproveRule(rule) {
    const normalizedRule = normalizePriceDeclFallbackApproveRule(rule);
    return Boolean(
      normalizeText(normalizedRule.reviewTimesMin)
      && normalizeText(normalizedRule.profitRateValue)
      && normalizeText(normalizedRule.profitValueValue)
    );
  }

  function hasPartialPriceDeclFallbackApproveRule(rule) {
    const normalizedRule = normalizePriceDeclFallbackApproveRule(rule);
    const hasAnyValue = Boolean(
      normalizeText(normalizedRule.reviewTimesMin)
      || normalizeText(normalizedRule.profitRateValue)
      || normalizeText(normalizedRule.profitValueValue)
    );

    return hasAnyValue && !hasConfiguredPriceDeclFallbackApproveRule(normalizedRule);
  }

  function buildConfiguredPriceDeclFallbackApproveRuleList(rules) {
    return normalizePriceDeclFallbackApproveRuleList(rules).filter((rule) => hasConfiguredPriceDeclFallbackApproveRule(rule));
  }

  function updatePriceDeclFallbackApproveRuleList(state, updater) {
    if (!state || typeof updater !== 'function') {
      return;
    }

    state.priceDeclDialogFallbackApproveRules = normalizePriceDeclFallbackApproveRuleList(
      updater(normalizePriceDeclFallbackApproveRuleList(state.priceDeclDialogFallbackApproveRules))
    );
  }

  function copyPriceDeclFallbackApproveRule(state, ruleId) {
    const normalizedRuleId = normalizeText(ruleId);

    if (!normalizedRuleId) {
      return false;
    }

    let copied = false;
    updatePriceDeclFallbackApproveRuleList(state, (rules) => {
      const matchedRule = rules.find((rule) => normalizeText(rule && rule.id) === normalizedRuleId);

      if (!matchedRule) {
        return rules;
      }

      copied = true;
      return rules.concat(createDefaultPriceDeclFallbackApproveRule({
        ...matchedRule,
        id: ''
      }));
    });

    return copied;
  }

  function removePriceDeclFallbackApproveRule(state, ruleId) {
    const normalizedRuleId = normalizeText(ruleId);

    if (!normalizedRuleId) {
      return;
    }

    updatePriceDeclFallbackApproveRuleList(state, (rules) => {
      const nextRules = rules.filter((rule) => normalizeText(rule && rule.id) !== normalizedRuleId);
      return nextRules.length > 0 ? nextRules : [createDefaultPriceDeclFallbackApproveRule()];
    });
  }

  function updatePriceDeclFallbackApproveRuleField(state, ruleId, fieldName, value) {
    const normalizedRuleId = normalizeText(ruleId);
    const normalizedFieldName = normalizeText(fieldName);

    if (!normalizedRuleId || !normalizedFieldName) {
      return;
    }

    updatePriceDeclFallbackApproveRuleList(state, (rules) => {
      return rules.map((rule) => {
        if (normalizeText(rule && rule.id) !== normalizedRuleId) {
          return rule;
        }

        return {
          ...rule,
          [normalizedFieldName]: normalizeText(value)
        };
      });
    });
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
      <div class="ops-pm-image-preview" data-image-preview-backdrop="true">
        <div class="ops-pm-image-preview-dialog" data-image-preview-panel="true">
          <button
            class="ops-pm-image-preview-close"
            type="button"
            data-image-preview-close="true"
            aria-label="\u5173\u95ed\u5927\u56fe"
          >
            &times;
          </button>
          <div class="ops-pm-image-preview-body">
            <img src="${escapeHtml(preview.previewUrl)}" alt="${escapeHtml(preview.title || '\u5927\u56fe\u9884\u89c8')}" />
          </div>
          ${preview.title ? `<div class="ops-pm-image-preview-title">${escapeHtml(preview.title)}</div>` : ''}
        </div>
      </div>
    `;
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

  function normalizeCategorySelectionRecords(selections) {
    const selectionMap = new Map();

    (Array.isArray(selections) ? selections : []).forEach((selection) => {
      const normalizedSelection =
        selection && typeof selection === 'object'
          ? selection
          : {
            categoryId: selection
          };
      const categoryId = normalizeText(normalizedSelection && normalizedSelection.categoryId);

      if (!categoryId) {
        return;
      }

      const categoryPathLabels = Array.isArray(normalizedSelection && normalizedSelection.categoryPathLabels)
        ? normalizedSelection.categoryPathLabels.map((label) => normalizeText(label)).filter(Boolean)
        : [];
      const categoryPathIds = Array.from(new Set(
        (Array.isArray(normalizedSelection && normalizedSelection.categoryPathIds)
          ? normalizedSelection.categoryPathIds
          : [])
          .map((categoryPathId) => normalizeText(categoryPathId))
          .filter(Boolean)
      ));

      if (
        categoryPathIds.length <= 0
        || categoryPathIds[categoryPathIds.length - 1] !== categoryId
      ) {
        categoryPathIds.push(categoryId);
      }

      const categoryTrail = normalizeText(normalizedSelection && normalizedSelection.categoryTrail)
        || categoryPathLabels.join(' / ');
      const selectionKey = categoryPathIds.join('/') || categoryId;

      if (!selectionKey || selectionMap.has(selectionKey)) {
        return;
      }

      selectionMap.set(selectionKey, {
        categoryId,
        categoryTrail,
        categoryPathLabels,
        categoryPathIds
      });
    });

    return Array.from(selectionMap.values());
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

  function normalizeSelectedOptionValues(values) {
    return Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    ));
  }

  function shouldForcePublishedProductSource(trafficStates) {
    return normalizeSelectedOptionValues(trafficStates).includes('dropped');
  }

  function applyFilterDependencies(filters) {
    const nextFilters = filters && typeof filters === 'object'
      ? { ...filters }
      : cloneFilters();

    if (shouldForcePublishedProductSource(nextFilters.trafficStates)) {
      nextFilters.productSource = 'published';
    }

    return nextFilters;
  }

  function cloneFilters(filters) {
    const source = filters && typeof filters === 'object' ? filters : {};
    const sourceStationIds = Array.isArray(source.stationIds)
      ? source.stationIds
      : (source.station ? [source.station] : DEFAULT_FILTERS.stationIds);
    const sourceAdLevels = Array.isArray(source.adLevels)
      ? source.adLevels
      : (source.adLevel ? [source.adLevel] : DEFAULT_FILTERS.adLevels);
    const sourceDeletedState = normalizeText(
      source.deletedState
      || (Array.isArray(source.deletedStates) ? source.deletedStates[0] : '')
      || ''
    );
    const sourceTrafficStates = Array.isArray(source.trafficStates)
      ? source.trafficStates
      : (source.trafficState ? [source.trafficState] : DEFAULT_FILTERS.trafficStates);

    return applyFilterDependencies({
      ...DEFAULT_FILTERS,
      ...source,
      selectedShopIds: normalizeSelectedShopIds(source.selectedShopIds || DEFAULT_FILTERS.selectedShopIds),
      stationIds: normalizeSelectedStationIds(sourceStationIds),
      adLevels: normalizeSelectedOptionValues(sourceAdLevels),
      deletedState: sourceDeletedState,
      trafficStates: normalizeSelectedOptionValues(sourceTrafficStates),
      categorySelections: normalizeCategorySelectionRecords(source.categorySelections),
      categoryPathLabels: Array.isArray(source.categoryPathLabels)
        ? source.categoryPathLabels.map((label) => normalizeText(label)).filter(Boolean)
        : []
    });
  }

  function cloneFiltersForQuery(filters) {
    const nextFilters = cloneFilters(filters);
    nextFilters.costState = '';
    return nextFilters;
  }

  function normalizeProductStatus(value) {
    const normalizedValue = normalizeText(value);

    if (normalizedValue === 'terminated') {
      return 'terminated';
    }

    if (normalizedValue === 'offline') {
      return 'offline';
    }

    if (normalizedValue === 'published') {
      return 'published';
    }

    if (normalizedValue === 'pricePending') {
      return 'pricePending';
    }

    if (normalizedValue === 'pricePendingSellerConfirm') {
      return 'pricePendingSellerConfirm';
    }

    if (normalizedValue === 'priceInvalid') {
      return 'priceInvalid';
    }

    return 'unpublished';
  }

  function normalizeIntegerValue(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function normalizeDecimalValue(value, fallback = 0) {
    if (value === '' || value === null || value === undefined) {
      return fallback;
    }

    const matchedNumber = String(value).match(/-?\d+(?:\.\d+)?/);
    const parsedValue = matchedNumber
      ? Number.parseFloat(matchedNumber[0])
      : Number.NaN;

    return Number.isFinite(parsedValue) ? Number(parsedValue) : fallback;
  }

  function formatMoney(value) {
    const numericValue = Number(value) || 0;
    return numericValue.toFixed(2).replace(/\.00$/, '.00');
  }

  function hasCostPriceConfigured(row) {
    const rawCostPrice = row && row.costPrice;

    if (rawCostPrice === '' || rawCostPrice === null || rawCostPrice === undefined) {
      return false;
    }

    const costPrice = Number(rawCostPrice);
    return Number.isFinite(costPrice) && costPrice > 0;
  }

  function computeProfitRate(row) {
    const declaredPrice = Number(row && row.declaredPrice) || 0;
    const totalCost = Number(row && row.costPrice) || 0;

    if (!profitMetrics || typeof profitMetrics.computeProfitRateByPrice !== 'function') {
      return Number.NaN;
    }

    if (declaredPrice <= 0 || totalCost <= 0) {
      return Number.NaN;
    }

    return profitMetrics.computeProfitRateByPrice(declaredPrice, totalCost);
  }

  function createDefaultBatchAdjustSubmitPreviewSummary() {
    return {
      totalRowCount: 0,
      totalShops: 0,
      readyRowCount: 0,
      dailyReadyRowCount: 0,
      activityReadyRowCount: 0,
      requestedDailyCount: 0,
      requestedActivityCount: 0,
      requestGroupCount: 0,
      skippedRowCount: 0
    };
  }

  function createDefaultBatchAdjustSubmitPreviewState() {
    return {
      open: false,
      items: [],
      resultsByShop: [],
      shopSummaries: [],
      groupedRequests: [],
      requestToken: '',
      summary: createDefaultBatchAdjustSubmitPreviewSummary(),
      saving: false,
      resetScroll: false,
      virtualScrollTop: 0,
      virtualViewportHeight: BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT,
      virtualFrame: 0
    };
  }

  function cancelBatchAdjustSubmitPreviewVirtualFrame(state) {
    if (!state || !state.batchAdjustSubmitPreviewVirtualFrame) {
      return;
    }

    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(state.batchAdjustSubmitPreviewVirtualFrame);
    } else {
      window.clearTimeout(state.batchAdjustSubmitPreviewVirtualFrame);
    }
    state.batchAdjustSubmitPreviewVirtualFrame = 0;
  }

  function resetBatchAdjustSubmitPreviewState(state) {
    const nextState = createDefaultBatchAdjustSubmitPreviewState();
    state.batchAdjustPreviewRunId = '';
    state.batchAdjustSubmitPreviewOpen = nextState.open;
    state.batchAdjustSubmitPreviewItems = nextState.items;
    state.batchAdjustSubmitPreviewResultsByShop = nextState.resultsByShop;
    state.batchAdjustSubmitPreviewShopSummaries = nextState.shopSummaries;
    state.batchAdjustSubmitPreviewGroupedRequests = nextState.groupedRequests;
    state.batchAdjustSubmitPreviewRequestToken = nextState.requestToken;
    state.batchAdjustSubmitPreviewSummary = nextState.summary;
    state.batchAdjustSubmitPreviewSaving = nextState.saving;
    state.batchAdjustPreviewProgress = null;
    state.batchAdjustSubmitPreviewResetScroll = nextState.resetScroll;
    state.batchAdjustSubmitPreviewVirtualScrollTop = nextState.virtualScrollTop;
    state.batchAdjustSubmitPreviewVirtualViewportHeight = nextState.virtualViewportHeight;
    cancelBatchAdjustSubmitPreviewVirtualFrame(state);
  }

  function renderBatchAdjustSubmitPreviewRows(rows, state) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const declaredPrice = Number(row && row.declaredPrice);
      const suggestedDeclaredPrice = normalizeDecimalValue(row && row.suggestedDeclaredPrice, 0);
      const suggestedActivityDeclaredPrice = normalizeDecimalValue(row && row.suggestedActivityDeclaredPrice, 0);
      const dailyAdjustedPrice = Number(row && row.batchAdjustDailyAdjustedPrice);
      const hasDeclaredPrice = Number.isFinite(declaredPrice) && declaredPrice > 0;
      const hasSuggestedDeclaredPrice = Number.isFinite(suggestedDeclaredPrice) && suggestedDeclaredPrice > 0;
      const hasSuggestedActivityDeclaredPrice = Number.isFinite(suggestedActivityDeclaredPrice) && suggestedActivityDeclaredPrice > 0;
      const hasDailyAdjustedPrice = Number.isFinite(dailyAdjustedPrice) && dailyAdjustedPrice > 0;
      const stationText = normalizeText(row && row.stationLabel) || normalizeText(row && row.station) || '--';
      const dailyReady = row && row.batchAdjustSubmitPreviewDailyReady === true;
      const activityReady = row && row.batchAdjustSubmitPreviewActivityReady === true;
      const dailyRequestCount = Math.max(0, normalizeIntegerValue(row && row.batchAdjustSubmitPreviewDailyRequestCount, 0));
      const activityRequestCount = Math.max(0, normalizeIntegerValue(row && row.batchAdjustSubmitPreviewActivityRequestCount, 0));
      const previewDailyTargetPrice = Number(row && row.batchAdjustSubmitPreviewDailyTargetPrice);
      const previewActivityTargetPrice = Number(row && row.batchAdjustSubmitPreviewActivityTargetPrice);
      const hasPreviewDailyTargetPrice = Number.isFinite(previewDailyTargetPrice) && previewDailyTargetPrice > 0;
      const hasPreviewActivityTargetPrice = Number.isFinite(previewActivityTargetPrice) && previewActivityTargetPrice > 0;
      const dailyPriceSource = normalizeText(row && row.batchAdjustSubmitPreviewDailyPriceSource);
      const activityPriceSource = normalizeText(row && row.batchAdjustSubmitPreviewActivityPriceSource);
      const dailySkipLabels = Array.isArray(row && row.batchAdjustSubmitPreviewDailySkipReasonLabels)
        ? row.batchAdjustSubmitPreviewDailySkipReasonLabels
        : [];
      const activitySkipLabels = Array.isArray(row && row.batchAdjustSubmitPreviewActivitySkipReasonLabels)
        ? row.batchAdjustSubmitPreviewActivitySkipReasonLabels
        : [];
      const ruleText = normalizeText(row && row.batchAdjustRuleText) || '--';
      const dailyReadyNote = dailyReady ? buildBatchAdjustPreviewReadyNote(dailyPriceSource, 'daily') : '';
      const activityReadyNote = activityReady ? buildBatchAdjustPreviewReadyNote(activityPriceSource, 'activity') : '';
      const previewPassed = row && row.batchAdjustSubmitPreviewEligible === true;
      const previewStatusLabel = previewPassed ? '\u901a\u8fc7' : '\u4e0d\u901a\u8fc7';

      return `
        <tr class="ops-pm-sku-row ops-npl-batch-adjust-preview-virtual-row">
          <td class="ops-pm-nowrap">${escapeHtml(normalizeText(row && row.shopName) || normalizeText(row && row.shopId) || '--')}</td>
          <td class="ops-pm-cell-product">
            ${renderProductInfoCell(row)}
          </td>
          <td class="ops-pm-nowrap">${escapeHtml(normalizeText(row && row.skuId) || '--')}</td>
          <td>${escapeHtml(normalizeText(row && row.spec) || '--')}</td>
          <td class="ops-pm-nowrap">${escapeHtml(stationText)}</td>
          <td>
            <div class="ops-npl-batch-adjust-preview-main">${escapeHtml(hasDeclaredPrice ? `${formatMoney(declaredPrice)}\u5143` : '--')}</div>
            ${hasSuggestedDeclaredPrice ? `<div class="ops-npl-batch-adjust-preview-note">\u5efa\u8bae\u65e5\u5e38\u4ef7 ${escapeHtml(formatMoney(suggestedDeclaredPrice))}\u5143</div>` : ''}
            ${hasSuggestedActivityDeclaredPrice ? `<div class="ops-npl-batch-adjust-preview-note">\u5efa\u8bae\u6d3b\u52a8\u4ef7 ${escapeHtml(formatMoney(suggestedActivityDeclaredPrice))}\u5143</div>` : ''}
          </td>
          <td class="ops-npl-batch-adjust-preview-cell${row && row.batchAdjustSubmitPreviewEligible ? '' : ' is-warning'}">
            <div class="ops-npl-batch-adjust-preview-main">
              ${escapeHtml(dailyReady && hasPreviewDailyTargetPrice ? `\u65e5\u5e38 ${formatMoney(previewDailyTargetPrice)}\u5143` : (hasDailyAdjustedPrice ? `\u65e5\u5e38 ${formatMoney(dailyAdjustedPrice)}\u5143` : `\u65e5\u5e38 ${row && row.batchAdjustDailyEnabled ? (normalizeText(row && row.batchAdjustDailyNoteText) || '--') : '\u672a\u542f\u7528'}`))}
            </div>
            ${row && row.batchAdjustActivityEnabled ? `<div class="ops-npl-batch-adjust-preview-note${activityReady ? '' : ' is-warning'}">${escapeHtml(activityReady && hasPreviewActivityTargetPrice ? `\u6d3b\u52a8 ${formatMoney(previewActivityTargetPrice)}\u5143` : `\u6d3b\u52a8 ${activitySkipLabels[0] || normalizeText(row && row.batchAdjustActivityNoteText) || '--'}`)}</div>` : ''}
          </td>
          <td class="ops-npl-batch-adjust-preview-cell${row && row.batchAdjustSubmitPreviewEligible ? '' : ' is-warning'}">
            <div class="ops-npl-batch-adjust-preview-main">
              ${escapeHtml(dailyReady ? `\u65e5\u5e38\u5f85\u63d0\u4ea4${dailyRequestCount > 1 ? ` ${dailyRequestCount} \u6761` : ''}` : `\u65e5\u5e38 ${dailySkipLabels[0] || (row && row.batchAdjustDailyEnabled ? '\u4e0d\u63d0\u4ea4' : '\u672a\u542f\u7528')}`)}
            </div>
            ${dailyReadyNote ? `<div class="ops-npl-batch-adjust-preview-note">${escapeHtml(dailyReadyNote)}</div>` : ''}
            ${row && row.batchAdjustActivityEnabled ? `<div class="ops-npl-batch-adjust-preview-note${activityReady ? '' : ' is-warning'}">${escapeHtml(activityReady ? `\u6d3b\u52a8\u5f85\u63d0\u4ea4${activityRequestCount > 1 ? ` ${activityRequestCount} \u6761` : ''}` : `\u6d3b\u52a8 ${activitySkipLabels[0] || '\u4e0d\u63d0\u4ea4'}`)}</div>` : ''}
            ${activityReadyNote ? `<div class="ops-npl-batch-adjust-preview-note">${escapeHtml(activityReadyNote)}</div>` : ''}
          </td>
          <td class="ops-npl-batch-adjust-preview-cell${row && row.batchAdjustSubmitPreviewEligible ? '' : ' is-warning'}">
            <div class="ops-npl-batch-adjust-preview-main">
              <span class="ops-npl-batch-adjust-preview-result-badge${previewPassed ? ' is-pass' : ' is-fail'}">${escapeHtml(previewStatusLabel)}</span>
              ${escapeHtml(`\u65e5\u5e38\u89c4\u5219\uff1a${ruleText}`)}
            </div>
            ${!dailyReady && dailySkipLabels.length > 0 ? `<div class="ops-npl-batch-adjust-preview-note is-warning">${escapeHtml(`\u65e5\u5e38\uff1a${dailySkipLabels.join('\uff1b')}`)}</div>` : ''}
            ${!activityReady && activitySkipLabels.length > 0 ? `<div class="ops-npl-batch-adjust-preview-note is-warning">${escapeHtml(`\u6d3b\u52a8\uff1a${activitySkipLabels.join('\uff1b')}`)}</div>` : ''}
            ${activityReady ? `<div class="ops-npl-batch-adjust-preview-note">${escapeHtml(`\u6d3b\u52a8\uff1a\u5df2\u751f\u6210 ${activityRequestCount} \u6761\u63d0\u4ea4\u660e\u7ec6`)}</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderBatchAdjustSubmitPreviewSpacerRow(height, position) {
    const normalizedHeight = Math.max(0, Math.round(Number(height) || 0));

    if (normalizedHeight <= 0) {
      return '';
    }

    return `
      <tr class="ops-npl-batch-adjust-preview-spacer is-${escapeHtml(normalizeText(position) || 'middle')}" aria-hidden="true">
        <td colspan="9">
          <div style="height:${escapeHtml(String(normalizedHeight))}px;"></div>
        </td>
      </tr>
    `;
  }

  function getBatchAdjustSubmitPreviewVirtualWindow(state, previewItems) {
    const normalizedItems = Array.isArray(previewItems) ? previewItems : [];
    const totalCount = normalizedItems.length;
    const viewportHeight = Math.max(
      320,
      normalizeIntegerValue(
        state && state.batchAdjustSubmitPreviewVirtualViewportHeight,
        BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT
      )
    );
    const maxScrollTop = Math.max(0, totalCount * BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT - viewportHeight);
    const rawScrollTop = Number(state && state.batchAdjustSubmitPreviewVirtualScrollTop);
    const scrollTop = Math.min(
      maxScrollTop,
      Math.max(0, Number.isFinite(rawScrollTop) ? rawScrollTop : 0)
    );
    const firstVisibleIndex = Math.floor(scrollTop / BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT);
    const startIndex = Math.max(0, firstVisibleIndex - BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_OVERSCAN);
    const renderCount = Math.ceil(viewportHeight / BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT)
      + BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_OVERSCAN * 2;
    const endIndex = Math.min(totalCount, startIndex + renderCount);

    if (state && state.batchAdjustSubmitPreviewVirtualScrollTop !== scrollTop) {
      state.batchAdjustSubmitPreviewVirtualScrollTop = scrollTop;
    }

    return {
      totalCount,
      viewportHeight,
      rowHeight: BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT,
      startIndex,
      endIndex,
      topPadding: startIndex * BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT,
      bottomPadding: Math.max(0, (totalCount - endIndex) * BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_ROW_HEIGHT),
      items: normalizedItems.slice(startIndex, endIndex)
    };
  }

  function renderBatchAdjustSubmitPreviewVirtualRowsMarkup(virtualWindow, state) {
    const normalizedWindow = virtualWindow && typeof virtualWindow === 'object'
      ? virtualWindow
      : {
        topPadding: 0,
        bottomPadding: 0,
        items: []
      };

    return `
      ${renderBatchAdjustSubmitPreviewSpacerRow(normalizedWindow.topPadding, 'top')}
      ${renderBatchAdjustSubmitPreviewRows(normalizedWindow.items, state)}
      ${renderBatchAdjustSubmitPreviewSpacerRow(normalizedWindow.bottomPadding, 'bottom')}
    `;
  }

  function formatBatchAdjustSubmitPreviewRangeText(virtualWindow) {
    const totalCount = Math.max(0, normalizeIntegerValue(virtualWindow && virtualWindow.totalCount, 0));
    const startIndex = Math.max(0, normalizeIntegerValue(virtualWindow && virtualWindow.startIndex, 0));
    const endIndex = Math.max(0, normalizeIntegerValue(virtualWindow && virtualWindow.endIndex, 0));

    if (totalCount <= 0) {
      return '';
    }

    return `\u865a\u62df\u8868\u683c\u5df2\u542f\u7528\uff0c\u5f53\u524d\u663e\u793a ${Math.min(startIndex + 1, totalCount)}-${Math.min(endIndex, totalCount)} / ${totalCount}`;
  }

  function refreshBatchAdjustSubmitPreviewVirtualRows(container) {
    if (!(container instanceof HTMLElement)) {
      return false;
    }

    const state = getState(container);

    if (state.batchAdjustSubmitPreviewOpen !== true) {
      return false;
    }

    const tableBody = container.querySelector('[data-npl-batch-adjust-submit-preview-body="true"]');
    const rangeHint = container.querySelector('[data-npl-batch-adjust-submit-preview-range="true"]');

    if (!(tableBody instanceof HTMLElement)) {
      return false;
    }

    const previewItems = Array.isArray(state.batchAdjustSubmitPreviewItems)
      ? state.batchAdjustSubmitPreviewItems
      : [];
    const virtualWindow = getBatchAdjustSubmitPreviewVirtualWindow(state, previewItems);

    tableBody.innerHTML = renderBatchAdjustSubmitPreviewVirtualRowsMarkup(virtualWindow, state);

    if (rangeHint instanceof HTMLElement) {
      rangeHint.textContent = formatBatchAdjustSubmitPreviewRangeText(virtualWindow);
      rangeHint.hidden = virtualWindow.totalCount <= virtualWindow.items.length;
    }

    return true;
  }

  function resetBatchAdjustSubmitPreviewVirtualScroll(state) {
    if (!state) {
      return;
    }

    state.batchAdjustSubmitPreviewVirtualScrollTop = 0;
    state.batchAdjustSubmitPreviewVirtualViewportHeight = BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT;
    cancelBatchAdjustSubmitPreviewVirtualFrame(state);
  }

  function createDefaultPriceDeclPreviewSummary() {
    return {
      total: 0,
      approve: 0,
      redeclare: 0,
      void: 0,
      skip: 0
    };
  }

  function createDefaultPriceDeclPreviewState() {
    return {
      open: false,
      items: [],
      resultsByShop: [],
      groupedRequests: [],
      summary: createDefaultPriceDeclPreviewSummary(),
      saving: false,
      retryMode: false,
      selectedShopIds: [],
      selectedResultTypes: [],
      sortField: 'productName',
      sortDirection: 'asc',
      visibleCount: PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE,
      resetScroll: false
    };
  }

  function resetPriceDeclPreviewState(state) {
    const nextState = createDefaultPriceDeclPreviewState();
    state.priceDeclPreviewOpen = nextState.open;
    state.priceDeclPreviewItems = nextState.items;
    state.priceDeclPreviewResultsByShop = nextState.resultsByShop;
    state.priceDeclPreviewGroupedRequests = nextState.groupedRequests;
    state.priceDeclPreviewSummary = nextState.summary;
    state.priceDeclPreviewSaving = nextState.saving;
    state.priceDeclPreviewRetryMode = nextState.retryMode;
    state.priceDeclPreviewSelectedShopIds = nextState.selectedShopIds;
    state.priceDeclPreviewSelectedResultTypes = nextState.selectedResultTypes;
    state.priceDeclPreviewSortField = nextState.sortField;
    state.priceDeclPreviewSortDirection = nextState.sortDirection;
    state.priceDeclPreviewVisibleCount = nextState.visibleCount;
    state.priceDeclPreviewResetScroll = nextState.resetScroll;
  }

  function resetPriceDeclPreviewVisibleCount(state) {
    if (!state) {
      return;
    }

    state.priceDeclPreviewVisibleCount = PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE;
    state.priceDeclPreviewResetScroll = true;
  }

  function ensurePriceDeclPreviewVisibleCount(state, totalCount = 0) {
    if (!state) {
      return 0;
    }

    const normalizedTotalCount = Math.max(0, Number(totalCount) || 0);
    const currentVisibleCount = Math.max(
      PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE,
      normalizeIntegerValue(state.priceDeclPreviewVisibleCount, PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE)
    );

    if (normalizedTotalCount <= 0) {
      state.priceDeclPreviewVisibleCount = PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE;
      return 0;
    }

    const nextVisibleCount = Math.min(currentVisibleCount, normalizedTotalCount);
    state.priceDeclPreviewVisibleCount = nextVisibleCount;
    return nextVisibleCount;
  }

  function appendPriceDeclPreviewVisibleCount(state, totalCount = 0) {
    if (!state) {
      return 0;
    }

    const normalizedTotalCount = Math.max(0, Number(totalCount) || 0);
    const currentVisibleCount = Math.max(
      0,
      normalizeIntegerValue(state.priceDeclPreviewVisibleCount, PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE)
    );
    const nextVisibleCount = Math.min(
      normalizedTotalCount,
      currentVisibleCount + PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE
    );

    state.priceDeclPreviewVisibleCount = nextVisibleCount;
    return nextVisibleCount;
  }

  function buildPriceDeclPreviewLazyRowsMarkup(visibleShopSummaries, sortField, sortDirection) {
    return (Array.isArray(visibleShopSummaries) ? visibleShopSummaries : [])
      .filter((shopSummary) => Array.isArray(shopSummary.items) && shopSummary.items.length > 0)
      .map((shopSummary) => {
        const sortedItems = sortPriceDeclPreviewItems(shopSummary.items, sortField, sortDirection);
        const shopRows = sortedItems.map((item) => {
          const resultType = normalizePriceDeclPreviewResultType(item);
          const labelClass = resultType === 'approve'
            ? 'is-approve'
            : (resultType === 'redeclare'
              ? 'is-redecl'
              : (resultType === 'void' ? 'is-void' : 'is-skip'));
          const declaredPriceYuan = Number(item.declaredPrice || 0).toFixed(2);
          const suggPriceYuan = (Number(item.suggestPrice || 0) / 100).toFixed(2);
          const submitPriceYuan = (Number(item.submitPrice || 0) / 100).toFixed(2);
          const costYuan = Number(item.costPrice || 0).toFixed(2);
          const profitVal = Number(item.profitValue || 0).toFixed(2);
          const profitRateVal = Number(item.profitRate || 0).toFixed(2) + '%';
          const productName = normalizeText(item.productName) || '--';
          const specText = normalizeText(item.spec);
          const approveDetail = normalizeText(item && item.approveDetail);
          const resultText = resultType === 'skip'
            ? normalizeText(item.skipReason) || '\u8df3\u8fc7'
            : getPriceDeclPreviewResultLabel(item);

          return `
            <tr class="ops-npl-price-decl-preview-row ${labelClass}">
              <td class="ops-npl-price-decl-preview-product-cell">
                <div class="ops-npl-price-decl-preview-product-name" title="${escapeHtml(productName)}">${escapeHtml(productName)}</div>
                <div class="ops-npl-price-decl-preview-product-meta">
                  <span>${escapeHtml(specText || '--')}</span>
                  <span>SKU: ${escapeHtml(item.productSkuId)}</span>
                </div>
              </td>
              <td>${item.priceOrderId}</td>
              <td>${declaredPriceYuan}</td>
              <td>${suggPriceYuan}</td>
              <td>${costYuan}</td>
              <td>${profitVal}</td>
              <td>${profitRateVal}</td>
              <td>${item.reviewTimes}</td>
              <td>${submitPriceYuan}</td>
              <td class="ops-npl-price-decl-preview-result-cell">
                <span class="ops-npl-price-decl-preview-result-badge ${labelClass}">${escapeHtml(resultText)}</span>
                ${approveDetail ? `
                  <div class="ops-npl-price-decl-preview-result-detail ${labelClass}">${escapeHtml(approveDetail)}</div>
                ` : ''}
              </td>
            </tr>
          `;
        }).join('');

        return `
          <tbody>
            <tr class="ops-npl-price-decl-preview-shop-row">
              <td colspan="10">
                <div class="ops-npl-price-decl-preview-shop-row-inner">
                  <strong>${escapeHtml(shopSummary.shopName || shopSummary.shopId || '--')}</strong>
                  <span>SKU ${shopSummary.total}</span>
                  <span class="is-approve">\u901a\u8fc7 ${shopSummary.approve}</span>
                  <span class="is-redecl">\u91cd\u6838 ${shopSummary.redeclare}</span>
                  <span class="is-void">\u4f5c\u5e9f ${shopSummary.void}</span>
                  <span class="is-skip">\u8df3\u8fc7 ${shopSummary.skip}</span>
                </div>
              </td>
            </tr>
            ${shopRows}
          </tbody>
        `;
      }).join('');
  }

  function applyLocalFilters(rows, filters) {
    const normalizedCostState = normalizeText(filters && filters.costState);

    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (!normalizedCostState) {
        return true;
      }

      const rowCostState = hasCostPriceConfigured(row) ? 'set' : 'unset';
      return rowCostState === normalizedCostState;
    });
  }

  function formatPercent(value) {
    return Number.isFinite(Number(value))
      ? `${Number(value).toFixed(2)}%`
      : '--';
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

  function normalizeBatchAdjustDuplicateSubmitWindowDaysValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const numericValue = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return '';
    }

    return String(numericValue);
  }

  function normalizeBatchAdjustSuggestedPriceFallbackCountValue(value) {
    return normalizeBatchAdjustDuplicateSubmitWindowDaysValue(value);
  }

  function buildSpecVariantList(spec, specAliases, legacySpec) {
    const variantList = [];
    const seenVariantKeys = new Set();

    []
      .concat(spec ? [spec] : [])
      .concat(legacySpec ? [legacySpec] : [])
      .concat(Array.isArray(specAliases) ? specAliases : [])
      .forEach((variant) => {
        const normalizedVariant = normalizeQuickCostSpecIdentity(variant);
        const variantKey = normalizedVariant.toLowerCase();

        if (!variantKey || seenVariantKeys.has(variantKey)) {
          return;
        }

        seenVariantKeys.add(variantKey);
        variantList.push(normalizedVariant);
      });

    return variantList;
  }

  function buildQuickCostLegacyKey(shopId, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildQuickCostStationKey(shopId, station, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return buildQuickCostLegacyKey(normalizedShopId, normalizedSpec);
    }

    if (!normalizedStation) {
      return buildQuickCostLegacyKey(normalizedShopId, normalizedSpec);
    }

    return `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildQuickCostCategoryKey(shopId, category, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedCategory = normalizeText(category);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedCategory || !normalizedSpec) {
      return buildQuickCostLegacyKey(normalizedShopId, normalizedSpec);
    }

    return `${normalizedShopId}\x1f${normalizedCategory}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildQuickCostEntryKey(shopId, station, category, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedCategory = normalizeText(category);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedSpec) {
      return buildQuickCostLegacyKey(normalizedShopId, normalizedSpec);
    }

    if (!normalizedStation || !normalizedCategory) {
      return buildQuickCostStationKey(normalizedShopId, normalizedStation, normalizedSpec);
    }

    return `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedCategory}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildQuickCostLookupKeys(shopId, station, category, spec, specAliases, legacySpec) {
    return Array.from(new Set(
      buildSpecVariantList(spec, specAliases, legacySpec)
        .flatMap((specVariant) => ([
          buildQuickCostEntryKey(shopId, station, category, specVariant),
          buildQuickCostCategoryKey(shopId, category, specVariant),
          buildQuickCostStationKey(shopId, station, specVariant),
          buildQuickCostLegacyKey(shopId, specVariant)
        ]))
        .filter(Boolean)
    ));
  }

  function resolveQuickCostCategoryLabel(source = {}) {
    return normalizeText(
      source && (
        source.categoryTrail
        || source.categoryLabel
        || source.category
      )
    );
  }

  function buildQuickCostDialogEntries(rows) {
    const entryMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const shopId = normalizeText(row && row.shopId);
      const shopName = normalizeText(row && row.shopName);
      const station = normalizeText(row && row.station);
      const stationLabel = normalizeText(row && row.stationLabel);
      const category = normalizeText(row && row.category);
      const categoryLabel = resolveQuickCostCategoryLabel(row);
      const spec = normalizeText(row && row.spec);
      const legacySpec = normalizeText(row && row.legacySpec);
      const specAliases = buildSpecVariantList('', row && row.specAliases, legacySpec);
      const key = buildQuickCostEntryKey(shopId, station, category, spec);

      if (!shopId || !category || !spec || !key) {
        return;
      }

      const nextEntry = {
        key,
        legacyKey: buildQuickCostLegacyKey(shopId, spec),
        stationKey: buildQuickCostStationKey(shopId, station, spec),
        categoryKey: buildQuickCostCategoryKey(shopId, category, spec),
        shopId,
        shopName,
        station,
        stationLabel,
        category,
        categoryLabel,
        categoryTrail: normalizeText(row && row.categoryTrail),
        spec,
        legacySpec,
        specAliases,
        costPrice: normalizeQuickCostValue(row && row.costPrice)
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

      const categoryCompare = resolveQuickCostCategoryLabel(left).localeCompare(
        resolveQuickCostCategoryLabel(right),
        'zh-CN'
      );

      if (categoryCompare !== 0) {
        return categoryCompare;
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

  function mergeQuickCostSnapshotEntries(entries, snapshotEntries) {
    const snapshotMap = new Map();

    (Array.isArray(snapshotEntries) ? snapshotEntries : []).forEach((entry) => {
      const costPrice = normalizeQuickCostValue(entry && entry.costPrice);

      buildQuickCostLookupKeys(
        entry && entry.shopId,
        entry && entry.station,
        entry && entry.category,
        entry && entry.spec,
        entry && entry.specAliases,
        entry && entry.legacySpec
      ).forEach((key) => {
        if (!snapshotMap.has(key)) {
          snapshotMap.set(key, costPrice);
        }
      });
    });

    return (Array.isArray(entries) ? entries : []).map((entry) => {
      const matchedKey = buildQuickCostLookupKeys(
        entry && entry.shopId,
        entry && entry.station,
        entry && entry.category,
        entry && entry.spec,
        entry && entry.specAliases,
        entry && entry.legacySpec
      ).find((key) => snapshotMap.has(key));

      if (matchedKey) {
        return {
          ...entry,
          costPrice: snapshotMap.get(matchedKey)
        };
      }

      return entry;
    });
  }

  function applyQuickCostEntriesToRows(rows, entries) {
    const costMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const normalizedCostPrice = normalizeQuickCostValue(entry && entry.costPrice);

      buildQuickCostLookupKeys(
        entry && entry.shopId,
        entry && entry.station,
        entry && entry.category,
        entry && entry.spec,
        entry && entry.specAliases,
        entry && entry.legacySpec
      ).forEach((key) => {
        if (!costMap.has(key)) {
          costMap.set(key, normalizedCostPrice);
        }
      });
    });

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const matchedKey = buildQuickCostLookupKeys(
        row && row.shopId,
        row && row.station,
        row && row.category,
        row && row.spec,
        row && row.specAliases,
        row && row.legacySpec
      ).find((key) => costMap.has(key));

      if (!matchedKey) {
        return row;
      }

      const nextCostPrice = costMap.get(matchedKey);

      return {
        ...row,
        costPrice: nextCostPrice ? Number(nextCostPrice) : ''
      };
    });
  }

  function groupQuickCostDialogEntries(entries) {
    const groups = [];
    const shopGroupMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);
      const categoryKey = buildQuickCostCategoryKey('__category__', entry && entry.category, '__group__');

      if (!shopGroupMap.has(shopId)) {
        const nextShopGroup = {
          shopId,
          shopName: normalizeText(entry && entry.shopName),
          categories: [],
          categoryMap: new Map()
        };

        shopGroupMap.set(shopId, nextShopGroup);
        groups.push(nextShopGroup);
      }

      const shopGroup = shopGroupMap.get(shopId);

      if (!shopGroup.categoryMap.has(categoryKey)) {
        const nextCategoryGroup = {
          key: categoryKey,
          category: normalizeText(entry && entry.category),
          categoryLabel: resolveQuickCostCategoryLabel(entry) || '--',
          entries: []
        };

        shopGroup.categoryMap.set(categoryKey, nextCategoryGroup);
        shopGroup.categories.push(nextCategoryGroup);
      }

      shopGroup.categoryMap.get(categoryKey).entries.push(entry);
    });

    return groups.map((group) => ({
      shopId: group.shopId,
      shopName: group.shopName,
      categories: (Array.isArray(group.categories) ? group.categories : []).map((categoryGroup) => ({
        ...categoryGroup,
        entries: (Array.isArray(categoryGroup.entries) ? categoryGroup.entries : []).sort((left, right) => {
          const stationCompare = (normalizeText(left && left.stationLabel) || normalizeText(left && left.station)).localeCompare(
            normalizeText(right && right.stationLabel) || normalizeText(right && right.station),
            'zh-CN'
          );

          if (stationCompare !== 0) {
            return stationCompare;
          }

          return normalizeText(left && left.spec).localeCompare(normalizeText(right && right.spec), 'zh-CN');
        })
      }))
    }));
  }

  function buildBatchAdjustEntryKey(shopId, station, category, spec) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedStation = normalizeText(station);
    const normalizedCategory = normalizeText(category);
    const normalizedSpec = normalizeQuickCostSpecIdentity(spec);

    if (!normalizedShopId || !normalizedCategory || !normalizedSpec) {
      return '';
    }

    return `${normalizedShopId}\x1f${normalizedStation}\x1f${normalizedCategory}\x1f${normalizedSpec}`.toLowerCase();
  }

  function buildBatchAdjustEntryCandidateKeys(shopId, station, category, spec, specAliases, legacySpec) {
    return Array.from(new Set(
      buildSpecVariantList(spec, specAliases, legacySpec)
        .map((specVariant) => buildBatchAdjustEntryKey(shopId, station, category, specVariant))
        .filter(Boolean)
    ));
  }

  function buildBatchAdjustDialogEntries(rows) {
    const entryMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const shopId = normalizeText(row && row.shopId);
      const station = normalizeText(row && row.station);
      const category = normalizeText(row && row.category);
      const skuId = normalizeText(row && row.skuId);
      const spec = normalizeText(row && row.spec);
      const legacySpec = normalizeText(row && row.legacySpec);
      const specAliases = buildSpecVariantList('', row && row.specAliases, legacySpec);
      const key = buildBatchAdjustEntryKey(shopId, station, category, spec);

      if (!shopId || !category || !spec || !key) {
        return;
      }

      const nextEntry = {
        key,
        shopId,
        shopName: normalizeText(row && row.shopName),
        station,
        stationLabel: normalizeText(row && row.stationLabel),
        category,
        categoryLabel: normalizeText(row && row.categoryLabel),
        categoryTrail: normalizeText(row && row.categoryTrail),
        skuId,
        skuIds: skuId ? [skuId] : [],
        skuCode: normalizeText(row && row.skuCode),
        spec,
        legacySpec,
        specAliases,
        declaredPrice: Number.isFinite(Number(row && row.declaredPrice))
          ? Number(Number(row.declaredPrice).toFixed(2))
          : 0,
        costPrice: hasCostPriceConfigured(row)
          ? Number(Number(row && row.costPrice).toFixed(2))
          : null,
        profitRate: Number.isFinite(computeProfitRate(row))
          ? Number(computeProfitRate(row).toFixed(2))
          : null,
        status: normalizeProductStatus(row && row.status),
        copySourceEntryKey: ''
      };
      const previousEntry = entryMap.get(key);

      if (!previousEntry) {
        entryMap.set(key, nextEntry);
        return;
      }

      const mergedSkuIds = Array.from(new Set(
        []
          .concat(Array.isArray(previousEntry.skuIds) ? previousEntry.skuIds : [])
          .concat(Array.isArray(nextEntry.skuIds) ? nextEntry.skuIds : [])
          .map((item) => normalizeText(item))
          .filter(Boolean)
      ));
      const shouldUseNextEntry = (
        (previousEntry.costPrice === null && nextEntry.costPrice !== null)
        || (Number(previousEntry.declaredPrice) <= 0 && Number(nextEntry.declaredPrice) > 0)
      );
      const preferredEntry = shouldUseNextEntry ? nextEntry : previousEntry;

      entryMap.set(key, {
        ...preferredEntry,
        skuId: normalizeText(preferredEntry && preferredEntry.skuId) || mergedSkuIds[0] || '',
        skuIds: mergedSkuIds
      });
    });

    return Array.from(entryMap.values()).sort((left, right) => {
      const leftShopName = normalizeText(left && left.shopName) || normalizeText(left && left.shopId);
      const rightShopName = normalizeText(right && right.shopName) || normalizeText(right && right.shopId);
      const shopCompare = leftShopName.localeCompare(rightShopName, 'zh-CN');

      if (shopCompare !== 0) {
        return shopCompare;
      }

      const categoryCompare = resolveQuickCostCategoryLabel(left).localeCompare(
        resolveQuickCostCategoryLabel(right),
        'zh-CN'
      );

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      const stationCompare = (normalizeText(left && left.stationLabel) || normalizeText(left && left.station)).localeCompare(
        normalizeText(right && right.stationLabel) || normalizeText(right && right.station),
        'zh-CN'
      );

      if (stationCompare !== 0) {
        return stationCompare;
      }

      const specCompare = normalizeText(left && left.spec).localeCompare(
        normalizeText(right && right.spec),
        'zh-CN'
      );

      if (specCompare !== 0) {
        return specCompare;
      }

      return normalizeText(left && left.skuId).localeCompare(
        normalizeText(right && right.skuId),
        'zh-CN'
      );
    });
  }

  function buildBatchAdjustDialogStationOptions(rows) {
    const optionMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const value = normalizeText(row && row.station);
      const label = normalizeText(row && row.stationLabel) || value;

      if (!value || optionMap.has(value)) {
        return;
      }

      optionMap.set(value, {
        value,
        label
      });
    });

    return Array.from(optionMap.values()).sort((left, right) => {
      return normalizeText(left && left.label).localeCompare(
        normalizeText(right && right.label),
        'zh-CN'
      );
    });
  }

  function normalizeBatchAdjustReasonCode(value) {
    const normalizedValue = normalizeText(value);
    return BATCH_ADJUST_REASON_OPTIONS.some((option) => {
      return normalizeText(option && option.value) === normalizedValue;
    })
      ? normalizedValue
      : '';
  }

  function normalizeBatchAdjustProfitFloorMode(value) {
    return normalizeText(value) === 'value'
      ? 'value'
      : 'rate';
  }

  function normalizeBatchAdjustDialogStationIds(stationIds, stationOptions) {
    const allowedStationIds = new Set(
      (Array.isArray(stationOptions) ? stationOptions : [])
        .map((option) => normalizeText(option && option.value))
        .filter(Boolean)
    );

    return Array.from(new Set(
      (Array.isArray(stationIds) ? stationIds : [])
        .map((stationId) => normalizeText(stationId))
        .filter((stationId) => {
          return stationId && (allowedStationIds.size <= 0 || allowedStationIds.has(stationId));
        })
    ));
  }

  function normalizeBatchAdjustToggleValue(value, fallbackValue) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }
    }

    const normalizedTextValue = normalizeText(value).toLowerCase();

    if (!normalizedTextValue) {
      return fallbackValue === true;
    }

    if (
      normalizedTextValue === '1'
      || normalizedTextValue === 'true'
      || normalizedTextValue === 'yes'
      || normalizedTextValue === 'on'
    ) {
      return true;
    }

    if (
      normalizedTextValue === '0'
      || normalizedTextValue === 'false'
      || normalizedTextValue === 'no'
      || normalizedTextValue === 'off'
    ) {
      return false;
    }

    return fallbackValue === true;
  }

  function resolveBatchAdjustDailyEnabled(settings) {
    return normalizeBatchAdjustToggleValue(settings && settings.dailyEnabled, true);
  }

  function resolveBatchAdjustActivityEnabled(settings) {
    return normalizeBatchAdjustToggleValue(settings && settings.activityEnabled, false);
  }

  function resolveBatchAdjustDialogSettings(stationOptions, settings) {
    const normalizedStationOptions = Array.isArray(stationOptions) ? stationOptions : [];
    const allStationIds = normalizedStationOptions
      .map((option) => normalizeText(option && option.value))
      .filter(Boolean);
    const selectedStationIds = normalizeBatchAdjustDialogStationIds(
      settings && settings.stationIds,
      normalizedStationOptions
    );

    return {
      stationIds: selectedStationIds.length > 0
        ? selectedStationIds
        : allStationIds,
      dailyEnabled: resolveBatchAdjustDailyEnabled(settings),
      activityEnabled: resolveBatchAdjustActivityEnabled(settings),
      reasonCode: normalizeBatchAdjustReasonCode(settings && settings.reasonCode),
      remark: normalizeText(settings && settings.remark),
      duplicateSubmitWindowDays: normalizeBatchAdjustDuplicateSubmitWindowDaysValue(
        settings && settings.duplicateSubmitWindowDays
      ),
      useSuggestedPriceAfterSubmitCount: normalizeBatchAdjustSuggestedPriceFallbackCountValue(
        settings && settings.useSuggestedPriceAfterSubmitCount
      ),
      activityPriceReduction: normalizeQuickCostValue(settings && settings.activityPriceReduction),
      dailyProfitFloorMode: normalizeBatchAdjustProfitFloorMode(
        settings && (settings.dailyProfitFloorMode || settings.profitFloorMode)
      ),
      dailyProfitFloorValue: normalizeQuickCostValue(
        settings && (settings.dailyProfitFloorValue || settings.profitFloorValue)
      ),
      activityProfitFloorMode: normalizeBatchAdjustProfitFloorMode(
        settings && (settings.activityProfitFloorMode || settings.profitFloorMode)
      ),
      activityProfitFloorValue: normalizeQuickCostValue(
        settings && (settings.activityProfitFloorValue || settings.profitFloorValue)
      )
    };
  }

  function buildBatchAdjustSettingsPayload(state) {
    return {
      stationIds: normalizeBatchAdjustDialogStationIds(
        state && state.batchAdjustDialogStationIds,
        state && state.batchAdjustDialogStationOptions
      ),
      dailyEnabled: Boolean(state && state.batchAdjustDialogDailyEnabled),
      activityEnabled: Boolean(state && state.batchAdjustDialogActivityEnabled),
      reasonCode: normalizeBatchAdjustReasonCode(state && state.batchAdjustDialogReasonCode),
      remark: normalizeText(state && state.batchAdjustDialogRemark),
      duplicateSubmitWindowDays: normalizeBatchAdjustDuplicateSubmitWindowDaysValue(
        state && state.batchAdjustDialogDuplicateSubmitWindowDays
      ),
      useSuggestedPriceAfterSubmitCount: normalizeBatchAdjustSuggestedPriceFallbackCountValue(
        state && state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount
      ),
      activityPriceReduction: normalizeQuickCostValue(state && state.batchAdjustDialogActivityPriceReduction),
      dailyProfitFloorMode: normalizeBatchAdjustProfitFloorMode(
        state && state.batchAdjustDialogDailyProfitFloorMode
      ),
      dailyProfitFloorValue: normalizeQuickCostValue(
        state && state.batchAdjustDialogDailyProfitFloorValue
      ),
      activityProfitFloorMode: normalizeBatchAdjustProfitFloorMode(
        state && state.batchAdjustDialogActivityProfitFloorMode
      ),
      activityProfitFloorValue: normalizeQuickCostValue(
        state && state.batchAdjustDialogActivityProfitFloorValue
      )
    };
  }

  function buildBatchAdjustDialogPersistPayload(state) {
    return {
      entries: buildBatchAdjustPresetPayloadEntries(state && state.batchAdjustDialogEntries),
      settings: buildBatchAdjustSettingsPayload(state)
    };
  }

  function buildBatchAdjustDialogPersistSignature(payload) {
    const normalizedPayload =
      payload && typeof payload === 'object'
        ? payload
        : {
          entries: [],
          settings: {}
        };

    return JSON.stringify({
      entries: Array.isArray(normalizedPayload.entries) ? normalizedPayload.entries : [],
      settings: normalizedPayload.settings && typeof normalizedPayload.settings === 'object'
        ? normalizedPayload.settings
        : {}
    });
  }

  function syncBatchAdjustDialogPersistSignature(state) {
    const payload = buildBatchAdjustDialogPersistPayload(state);
    state.batchAdjustDialogLastSavedSignature = buildBatchAdjustDialogPersistSignature(payload);
    state.batchAdjustDialogDirty = false;
  }

  function clearBatchAdjustDialogSaveTimer(state) {
    if (state && state.batchAdjustDialogSaveTimer) {
      window.clearTimeout(state.batchAdjustDialogSaveTimer);
      state.batchAdjustDialogSaveTimer = 0;
    }
  }

  function scheduleSaveBatchAdjustDialog(container) {
    const state = getState(container);

    if (state.batchAdjustDialogOpen !== true || state.batchAdjustDialogLoading === true) {
      return;
    }

    state.batchAdjustDialogDirty = true;
    state.batchAdjustDialogNotice = '';
    clearBatchAdjustDialogSaveTimer(state);
    const lastAutoSaveAt = Math.max(0, Number(state.batchAdjustDialogLastAutoSaveAt) || 0);
    const elapsedSinceLastAutoSave = lastAutoSaveAt > 0
      ? Math.max(0, Date.now() - lastAutoSaveAt)
      : Number.POSITIVE_INFINITY;
    const timerDelayMs = Math.max(
      BATCH_ADJUST_DIALOG_AUTO_SAVE_DEBOUNCE_MS,
      elapsedSinceLastAutoSave >= BATCH_ADJUST_DIALOG_AUTO_SAVE_MIN_INTERVAL_MS
        ? 0
        : (BATCH_ADJUST_DIALOG_AUTO_SAVE_MIN_INTERVAL_MS - elapsedSinceLastAutoSave)
    );
    state.batchAdjustDialogSaveTimer = window.setTimeout(() => {
      state.batchAdjustDialogSaveTimer = 0;

      if (state.batchAdjustDialogOpen !== true || state.batchAdjustDialogLoading === true) {
        return;
      }

      void persistBatchAdjustDialog(container, {
        reason: 'auto',
        showNotice: false
      });
    }, timerDelayMs);
  }

  function buildBatchAdjustProfitFloorNoteText(adjustedPrice, costPrice, mode, value) {
    const normalizedMode = normalizeBatchAdjustProfitFloorMode(mode);
    const floorValue = normalizeDecimalValue(value, 0);
    const numericAdjustedPrice = Number(adjustedPrice);
    const numericCostPrice = Number(costPrice);

    if (
      !Number.isFinite(numericAdjustedPrice)
      || numericAdjustedPrice <= 0
      || !Number.isFinite(numericCostPrice)
      || numericCostPrice <= 0
      || !(Number.isFinite(floorValue) && floorValue > 0)
    ) {
      return '';
    }

    if (normalizedMode === 'value') {
      const profitValue = numericAdjustedPrice - numericCostPrice;

      if (profitValue + 0.0001 < floorValue) {
        return `\u4f4e\u4e8e\u4fdd\u5e95\u5229\u6da6 ${formatMoney(floorValue)}\u5143`;
      }

      return '';
    }

    const profitRate = computeBatchAdjustPreviewProfitRate(numericAdjustedPrice, numericCostPrice);

    if (Number.isFinite(profitRate) && profitRate + 0.0001 < floorValue) {
      return `\u4f4e\u4e8e\u4fdd\u5e95\u5229\u6da6\u7387 ${formatMoney(floorValue)}%`;
    }

    return '';
  }

  function groupBatchAdjustDialogEntries(entries) {
    const groups = [];
    const shopGroupMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const shopId = normalizeText(entry && entry.shopId);
      const categoryKey = buildQuickCostCategoryKey('__batch_category__', entry && entry.category, '__group__');

      if (!shopGroupMap.has(shopId)) {
        const nextShopGroup = {
          shopId,
          shopName: normalizeText(entry && entry.shopName),
          categories: [],
          categoryMap: new Map()
        };

        shopGroupMap.set(shopId, nextShopGroup);
        groups.push(nextShopGroup);
      }

      const shopGroup = shopGroupMap.get(shopId);

      if (!shopGroup.categoryMap.has(categoryKey)) {
        const nextCategoryGroup = {
          key: categoryKey,
          category: normalizeText(entry && entry.category),
          categoryLabel: resolveQuickCostCategoryLabel(entry) || '--',
          entries: []
        };

        shopGroup.categoryMap.set(categoryKey, nextCategoryGroup);
        shopGroup.categories.push(nextCategoryGroup);
      }

      shopGroup.categoryMap.get(categoryKey).entries.push(entry);
    });

    return groups.map((group) => ({
      shopId: group.shopId,
      shopName: group.shopName,
      categories: (Array.isArray(group.categories) ? group.categories : []).map((categoryGroup) => ({
        ...categoryGroup,
        entries: (Array.isArray(categoryGroup.entries) ? categoryGroup.entries : []).sort((left, right) => {
          const stationCompare = (normalizeText(left && left.stationLabel) || normalizeText(left && left.station)).localeCompare(
            normalizeText(right && right.stationLabel) || normalizeText(right && right.station),
            'zh-CN'
          );

          if (stationCompare !== 0) {
            return stationCompare;
          }

          const skuCompare = normalizeText(left && left.skuId).localeCompare(
            normalizeText(right && right.skuId),
            'zh-CN'
          );

          if (skuCompare !== 0) {
            return skuCompare;
          }

          return normalizeText(left && left.spec).localeCompare(
            normalizeText(right && right.spec),
            'zh-CN'
          );
        })
      }))
    }));
  }

  function createBatchAdjustRuleId() {
    return `npl_batch_adjust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildBatchAdjustCopySourceLabel(entry) {
    const shopText = normalizeText(entry && entry.shopName) || normalizeText(entry && entry.shopId) || '--';
    const stationText = normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.station) || '--';
    const categoryText = normalizeText(entry && entry.categoryLabel) || normalizeText(entry && entry.category) || '--';
    const specText = normalizeText(entry && entry.spec) || '--';
    const configuredRuleCount = buildConfiguredBatchAdjustRuleList(entry && entry.batchAdjustRules).length;

    return `${shopText} / ${stationText} / ${categoryText} / ${specText} / \u5df2\u8bbe ${configuredRuleCount} \u7ec4`;
  }

  function buildBatchAdjustCopySourceOptions(entries, currentEntry) {
    const currentEntryKey = normalizeText(currentEntry && currentEntry.key);
    const currentShopId = normalizeText(currentEntry && currentEntry.shopId);
    const currentCategory = normalizeText(currentEntry && currentEntry.category);

    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => {
        return normalizeText(entry && entry.key) !== currentEntryKey
          && normalizeText(entry && entry.shopId) === currentShopId
          && buildConfiguredBatchAdjustRuleList(entry && entry.batchAdjustRules).length > 0;
      })
      .sort((left, right) => {
        const leftCategoryPriority = normalizeText(left && left.category) === currentCategory ? 0 : 1;
        const rightCategoryPriority = normalizeText(right && right.category) === currentCategory ? 0 : 1;

        if (leftCategoryPriority !== rightCategoryPriority) {
          return leftCategoryPriority - rightCategoryPriority;
        }

        return buildBatchAdjustCopySourceLabel(left).localeCompare(
          buildBatchAdjustCopySourceLabel(right),
          'zh-CN'
        );
      })
      .map((entry) => ({
        value: normalizeText(entry && entry.key),
        label: buildBatchAdjustCopySourceLabel(entry)
      }));
  }

  function normalizeOptionalDecimalValue(value) {
    if (value === '' || value === null || value === undefined) {
      return Number.NaN;
    }

    const matchedNumber = String(value).match(/-?\d+(?:\.\d+)?/);
    const parsedValue = matchedNumber
      ? Number.parseFloat(matchedNumber[0])
      : Number.NaN;

    return Number.isFinite(parsedValue) ? Number(parsedValue) : Number.NaN;
  }

  function normalizeBatchAdjustMode(value) {
    const normalizedValue = normalizeText(value);
    return normalizedValue === 'reduce' || normalizedValue === 'discount'
      ? normalizedValue
      : 'fixed';
  }

  function createDefaultBatchAdjustRule(overrides = {}) {
    return {
      id: normalizeText(overrides && overrides.id) || createBatchAdjustRuleId(),
      declaredPriceMin: normalizeText(overrides && overrides.declaredPriceMin),
      declaredPriceMax: normalizeText(overrides && overrides.declaredPriceMax),
      adjustMode: normalizeBatchAdjustMode(overrides && overrides.adjustMode),
      adjustValue: normalizeText(overrides && overrides.adjustValue)
    };
  }

  function normalizeBatchAdjustRule(rule = {}) {
    return createDefaultBatchAdjustRule(rule);
  }

  function normalizeBatchAdjustRuleList(rules) {
    return (Array.isArray(rules) ? rules : [])
      .map((rule) => normalizeBatchAdjustRule(rule))
      .filter((rule, index, list) => {
        return list.findIndex((item) => normalizeText(item && item.id) === normalizeText(rule && rule.id)) === index;
      });
  }

  function hasConfiguredBatchAdjustRuleValue(rule) {
    const normalizedRule = normalizeBatchAdjustRule(rule);

    return Boolean(
      normalizeText(normalizedRule && normalizedRule.declaredPriceMin)
      || normalizeText(normalizedRule && normalizedRule.declaredPriceMax)
      || normalizeText(normalizedRule && normalizedRule.adjustValue)
      || normalizeBatchAdjustMode(normalizedRule && normalizedRule.adjustMode) !== 'fixed'
    );
  }

  function buildConfiguredBatchAdjustRuleList(rules, options = {}) {
    return normalizeBatchAdjustRuleList(rules)
      .filter((rule) => hasConfiguredBatchAdjustRuleValue(rule))
      .map((rule) => {
        if (options && options.cloneIds === true) {
          return createDefaultBatchAdjustRule({
            ...rule,
            id: createBatchAdjustRuleId()
          });
        }

        return normalizeBatchAdjustRule(rule);
      });
  }

  function mergeBatchAdjustRuleDraftList(localRules, persistedRules) {
    const localRuleList = normalizeBatchAdjustRuleList(localRules);
    const persistedRuleList = normalizeBatchAdjustRuleList(persistedRules);
    const persistedRuleMap = new Map(
      persistedRuleList
        .map((rule) => [normalizeText(rule && rule.id), rule])
        .filter((item) => item[0])
    );
    const mergedRules = [];
    const appendedRuleIds = new Set();

    localRuleList.forEach((localRule) => {
      const localRuleId = normalizeText(localRule && localRule.id);
      const persistedRule = localRuleId
        ? persistedRuleMap.get(localRuleId)
        : null;

      if (persistedRule) {
        mergedRules.push(persistedRule);
        appendedRuleIds.add(localRuleId);
        return;
      }

      if (!hasConfiguredBatchAdjustRuleValue(localRule)) {
        mergedRules.push(localRule);
      }
    });

    persistedRuleList.forEach((persistedRule) => {
      const persistedRuleId = normalizeText(persistedRule && persistedRule.id);

      if (persistedRuleId && appendedRuleIds.has(persistedRuleId)) {
        return;
      }

      mergedRules.push(persistedRule);
    });

    return normalizeBatchAdjustRuleList(mergedRules);
  }

  function resolveBatchAdjustValueUnit(mode) {
    return normalizeBatchAdjustMode(mode) === 'discount'
      ? '\u6298'
      : '\u5143';
  }

  function updateBatchAdjustEntryRules(state, entryKey, updater) {
    const normalizedEntryKey = normalizeText(entryKey);

    if (!normalizedEntryKey || typeof updater !== 'function') {
      return;
    }

    state.batchAdjustDialogEntries = (Array.isArray(state.batchAdjustDialogEntries) ? state.batchAdjustDialogEntries : [])
      .map((entry) => {
        if (normalizeText(entry && entry.key) !== normalizedEntryKey) {
          return entry;
        }

        return {
          ...entry,
          batchAdjustRules: normalizeBatchAdjustRuleList(
            updater(normalizeBatchAdjustRuleList(entry && entry.batchAdjustRules))
          )
        };
      });
  }

  function updateBatchAdjustEntryUiField(state, entryKey, fieldName, value) {
    const normalizedEntryKey = normalizeText(entryKey);
    const normalizedFieldName = normalizeText(fieldName);

    if (!normalizedEntryKey || !normalizedFieldName) {
      return;
    }

    state.batchAdjustDialogEntries = (Array.isArray(state.batchAdjustDialogEntries) ? state.batchAdjustDialogEntries : [])
      .map((entry) => {
        if (normalizeText(entry && entry.key) !== normalizedEntryKey) {
          return entry;
        }

        return {
          ...entry,
          [normalizedFieldName]: normalizeText(value)
        };
      });
  }

  function applyBatchAdjustRulesFromEntry(state, targetEntryKey, sourceEntryKey) {
    const normalizedTargetEntryKey = normalizeText(targetEntryKey);
    const normalizedSourceEntryKey = normalizeText(sourceEntryKey);

    if (!normalizedTargetEntryKey || !normalizedSourceEntryKey) {
      return false;
    }

    const sourceEntry = (Array.isArray(state.batchAdjustDialogEntries) ? state.batchAdjustDialogEntries : [])
      .find((entry) => normalizeText(entry && entry.key) === normalizedSourceEntryKey);
    const copiedRules = buildConfiguredBatchAdjustRuleList(
      sourceEntry && sourceEntry.batchAdjustRules,
      { cloneIds: true }
    );

    if (copiedRules.length <= 0) {
      return false;
    }

    updateBatchAdjustEntryRules(state, normalizedTargetEntryKey, () => copiedRules);
    return true;
  }

  function addBatchAdjustRuleToEntry(state, entryKey) {
    updateBatchAdjustEntryRules(state, entryKey, (rules) => {
      return rules.concat(createDefaultBatchAdjustRule());
    });
  }

  function removeBatchAdjustRuleFromEntry(state, entryKey, ruleId) {
    const normalizedRuleId = normalizeText(ruleId);

    if (!normalizedRuleId) {
      return;
    }

    updateBatchAdjustEntryRules(state, entryKey, (rules) => {
      return rules.filter((rule) => normalizeText(rule && rule.id) !== normalizedRuleId);
    });
  }

  function updateBatchAdjustRuleField(state, entryKey, ruleId, fieldName, value) {
    const normalizedRuleId = normalizeText(ruleId);
    const normalizedFieldName = normalizeText(fieldName);

    if (!normalizedRuleId || !normalizedFieldName) {
      return;
    }

    updateBatchAdjustEntryRules(state, entryKey, (rules) => {
      return rules.map((rule) => {
        if (normalizeText(rule && rule.id) !== normalizedRuleId) {
          return rule;
        }

        return {
          ...rule,
          [normalizedFieldName]: normalizeText(value)
        };
      });
    });
  }

  function mergeBatchAdjustPresetEntries(baseEntries, presetEntries) {
    const presetMap = new Map(
      (Array.isArray(presetEntries) ? presetEntries : [])
        .map((entry) => {
          const entryKey = buildBatchAdjustEntryKey(
            entry && entry.shopId,
            normalizeText(entry && entry.station),
            entry && entry.category,
            entry && entry.spec
          );
          return [entryKey, entry];
        })
        .filter((item) => normalizeText(item[0]))
    );

    return (Array.isArray(baseEntries) ? baseEntries : []).map((entry) => {
      const matchedPreset = buildBatchAdjustEntryCandidateKeys(
        entry && entry.shopId,
        normalizeText(entry && entry.station),
        entry && entry.category,
        entry && entry.spec,
        entry && entry.specAliases,
        entry && entry.legacySpec
      )
        .map((candidateKey) => presetMap.get(candidateKey))
        .find(Boolean);

      return {
        ...entry,
        batchAdjustRules: mergeBatchAdjustRuleDraftList(
          entry && entry.batchAdjustRules,
          matchedPreset && matchedPreset.groups
        ),
        copySourceEntryKey: normalizeText(entry && entry.copySourceEntryKey)
      };
    });
  }

  function buildBatchAdjustPresetPayloadEntries(entries) {
    return (Array.isArray(entries) ? entries : []).map((entry) => ({
      key: normalizeText(entry && entry.key),
      shopId: normalizeText(entry && entry.shopId),
      shopName: normalizeText(entry && entry.shopName),
      station: normalizeText(entry && entry.station),
      stationLabel: normalizeText(entry && entry.stationLabel),
      category: normalizeText(entry && entry.category),
      categoryLabel: normalizeText(entry && entry.categoryLabel),
      categoryTrail: normalizeText(entry && entry.categoryTrail),
      spec: normalizeText(entry && entry.spec),
      legacySpec: normalizeText(entry && entry.legacySpec),
      specAliases: buildSpecVariantList('', entry && entry.specAliases, entry && entry.legacySpec),
      groups: normalizeBatchAdjustRuleList(entry && entry.batchAdjustRules).map((rule) => ({
        id: normalizeText(rule && rule.id),
        declaredPriceMin: normalizeText(rule && rule.declaredPriceMin),
        declaredPriceMax: normalizeText(rule && rule.declaredPriceMax),
        adjustMode: normalizeBatchAdjustMode(rule && rule.adjustMode),
        adjustValue: normalizeText(rule && rule.adjustValue)
      }))
    }));
  }

  function normalizeBatchAdjustPresetErrorMessage(error, fallbackMessage) {
    const message = normalizeText(error && error.message);

    if (/No handler registered/i.test(message)) {
      return '\u6279\u91cf\u8c03\u4ef7\u914d\u7f6e\u63a5\u53e3\u8fd8\u672a\u751f\u6548\uff0c\u8bf7\u5b8c\u5168\u91cd\u542f\u8f6f\u4ef6\u540e\u518d\u8bd5';
    }

    return message || fallbackMessage;
  }

  function normalizeBatchAdjustSubmitErrorMessage(error, fallbackMessage) {
    const message = normalizeText(error && error.message);

    if (/No handler registered/i.test(message)) {
      return '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u63a5\u53e3\u8fd8\u672a\u751f\u6548\uff0c\u8bf7\u5b8c\u5168\u91cd\u542f\u8f6f\u4ef6\u540e\u518d\u8bd5';
    }

    return message || fallbackMessage;
  }

  function isBatchAdjustCanceledErrorMessage(error) {
    const code = normalizeText(error && error.code);
    const message = normalizeText(error && error.message);

    return code === 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_CANCELED'
      || /\u6279\u91cf\u8c03\u4ef7\u5df2\u505c\u6b62|\u5df2\u505c\u6b62/.test(message);
  }

  function createBatchAdjustSubmitRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `npl_batch_adjust_${window.crypto.randomUUID()}`;
    }

    return `npl_batch_adjust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function createPriceDeclSubmitRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `npl_price_decl_${window.crypto.randomUUID()}`;
    }

    return `npl_price_decl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function convertBatchAdjustPriceToCent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 0;
    }

    return Math.round(numericValue * 100);
  }

  function convertBatchAdjustCentToPrice(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return Number.NaN;
    }

    return Number((numericValue / 100).toFixed(2));
  }

  function resolveBatchAdjustPreviewPriceSourceLabel(priceSource, scope) {
    const normalizedScope = normalizeText(scope) === 'activity' ? 'activity' : 'daily';
    const normalizedPriceSource = normalizeText(priceSource);

    if (normalizedPriceSource === 'suggested_reduce_cent') {
      return '\u5efa\u8bae\u65e5\u5e38\u4ef7\u9ad8\u4e8e\u7533\u62a5\u4ef7';
    }

    if (normalizedPriceSource === 'suggested') {
      return normalizedScope === 'activity'
        ? '\u5e73\u53f0\u5efa\u8bae\u6d3b\u52a8\u4ef7'
        : '\u5e73\u53f0\u5efa\u8bae\u65e5\u5e38\u4ef7';
    }

    return normalizedScope === 'activity'
      ? '\u6d3b\u52a8\u76f4\u51cf\u4ef7'
      : '\u89c4\u5219\u8c03\u4ef7';
  }

  function buildBatchAdjustPreviewReadyNote(priceSource, scope) {
    const normalizedPriceSource = normalizeText(priceSource);
    const sourceLabel = resolveBatchAdjustPreviewPriceSourceLabel(normalizedPriceSource, scope);

    if (!sourceLabel) {
      return '';
    }

    if (normalizedPriceSource === 'suggested_reduce_cent') {
      return `${sourceLabel}\uff0c\u9ed8\u8ba4\u6539\u4e3a\u7533\u62a5\u4ef7\u51cf0.01\uff0c\u5df2\u901a\u8fc7\u4fdd\u5e95\u8fc7\u6ee4`;
    }

    if (normalizedPriceSource === 'suggested') {
      return `${sourceLabel}\uff0c\u6309\u5386\u53f2\u6b21\u6570\u5207\u6362\uff0c\u5df2\u901a\u8fc7\u4fdd\u5e95\u8fc7\u6ee4`;
    }

    return `${sourceLabel}\uff0c\u5df2\u901a\u8fc7\u4fdd\u5e95\u8fc7\u6ee4`;
  }

  function resolveBatchAdjustModeLabel(mode) {
    const normalizedMode = normalizeBatchAdjustMode(mode);
    const matchedOption = BATCH_ADJUST_MODE_OPTIONS.find((option) => {
      return normalizeText(option && option.value) === normalizedMode;
    });

    return matchedOption
      ? normalizeText(matchedOption.label) || normalizedMode
      : normalizedMode;
  }

  function resolveBatchAdjustRuleRangeMin(rule) {
    const threshold = normalizeOptionalDecimalValue(rule && rule.declaredPriceMin);
    return Number.isFinite(threshold) && threshold >= 0 ? threshold : 0;
  }

  function resolveBatchAdjustRuleRangeMax(rule) {
    const threshold = normalizeOptionalDecimalValue(rule && rule.declaredPriceMax);
    return Number.isFinite(threshold) && threshold >= 0
      ? threshold
      : Number.POSITIVE_INFINITY;
  }

  function isBatchAdjustRuleRangeValid(rule) {
    const rangeMin = resolveBatchAdjustRuleRangeMin(rule);
    const rangeMax = resolveBatchAdjustRuleRangeMax(rule);

    return !Number.isFinite(rangeMax) || rangeMax + 0.0001 >= rangeMin;
  }

  function formatBatchAdjustRuleRangeText(rule) {
    const rangeMin = resolveBatchAdjustRuleRangeMin(rule);
    const rangeMax = resolveBatchAdjustRuleRangeMax(rule);

    if (Number.isFinite(rangeMax)) {
      return `${formatMoney(rangeMin)}-${formatMoney(rangeMax)}\u5143`;
    }

    if (rangeMin > 0) {
      return `\u2265 ${formatMoney(rangeMin)}\u5143`;
    }

    return '\u5168\u90e8\u4ef7\u683c';
  }

  function resolveBatchAdjustRuleValue(rule) {
    const adjustValue = normalizeOptionalDecimalValue(rule && rule.adjustValue);
    return Number.isFinite(adjustValue) && adjustValue > 0 ? adjustValue : Number.NaN;
  }

  function formatBatchAdjustRuleValue(rule) {
    const value = resolveBatchAdjustRuleValue(rule);

    if (!Number.isFinite(value)) {
      return '--';
    }

    return normalizeBatchAdjustMode(rule && rule.adjustMode) === 'discount'
      ? `${formatMoney(value)}\u6298`
      : `${formatMoney(value)}\u5143`;
  }

  function describeBatchAdjustRule(rule) {
    if (!rule) {
      return '--';
    }

    return `\u4ef7\u683c\u533a\u95f4 ${formatBatchAdjustRuleRangeText(rule)} / ${resolveBatchAdjustModeLabel(rule && rule.adjustMode)} ${formatBatchAdjustRuleValue(rule)}`;
  }

  function resolveBatchAdjustMatchedRuleByPrice(declaredPrice, rules) {
    if (!Number.isFinite(declaredPrice) || declaredPrice <= 0) {
      return null;
    }

    const normalizedRules = normalizeBatchAdjustRuleList(rules)
      .map((rule) => ({
        ...rule,
        __rangeMin: resolveBatchAdjustRuleRangeMin(rule),
        __rangeMax: resolveBatchAdjustRuleRangeMax(rule),
        __value: resolveBatchAdjustRuleValue(rule)
      }))
      .filter((rule) => {
        return Number.isFinite(rule.__value)
          && rule.__value > 0
          && isBatchAdjustRuleRangeValid(rule);
      })
      .sort((left, right) => {
        if (right.__rangeMin !== left.__rangeMin) {
          return right.__rangeMin - left.__rangeMin;
        }

        if (left.__rangeMax !== right.__rangeMax) {
          return left.__rangeMax - right.__rangeMax;
        }

        return normalizeText(left && left.id).localeCompare(normalizeText(right && right.id), 'en');
      });

    return normalizedRules.find((rule) => {
      return declaredPrice + 0.0001 >= rule.__rangeMin
        && declaredPrice <= rule.__rangeMax + 0.0001;
    }) || null;
  }

  function computeBatchAdjustAdjustedPrice(declaredPrice, rule) {
    const normalizedDeclaredPrice = Number(declaredPrice);
    const adjustValue = resolveBatchAdjustRuleValue(rule);

    if (!Number.isFinite(normalizedDeclaredPrice) || normalizedDeclaredPrice <= 0 || !Number.isFinite(adjustValue) || adjustValue <= 0) {
      return Number.NaN;
    }

    const adjustMode = normalizeBatchAdjustMode(rule && rule.adjustMode);
    let nextPrice = normalizedDeclaredPrice;

    if (adjustMode === 'reduce') {
      nextPrice = normalizedDeclaredPrice - adjustValue;
    } else if (adjustMode === 'discount') {
      nextPrice = normalizedDeclaredPrice * (adjustValue / 10);
    } else {
      nextPrice = adjustValue;
    }

    return Number.isFinite(nextPrice)
      ? Number(Math.max(0, nextPrice).toFixed(2))
      : Number.NaN;
  }

  function computeBatchAdjustPreviewProfitRate(adjustedPrice, costPrice) {
    const normalizedAdjustedPrice = Number(adjustedPrice);
    const normalizedCostPrice = Number(costPrice);

    if (!profitMetrics || typeof profitMetrics.computeProfitRateByPrice !== 'function') {
      return Number.NaN;
    }

    if (
      !Number.isFinite(normalizedAdjustedPrice)
      || normalizedAdjustedPrice <= 0
      || !Number.isFinite(normalizedCostPrice)
      || normalizedCostPrice <= 0
    ) {
      return Number.NaN;
    }

    return profitMetrics.computeProfitRateByPrice(normalizedAdjustedPrice, normalizedCostPrice);
  }

  function buildBatchAdjustRuleMap(entries) {
    return new Map(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => [normalizeText(entry && entry.key), normalizeBatchAdjustRuleList(entry && entry.batchAdjustRules)])
        .filter((item) => item[0])
    );
  }

  function resolveBatchAdjustActivityReductionAmount(settings) {
    const reductionAmount = normalizeOptionalDecimalValue(settings && settings.activityPriceReduction);
    return Number.isFinite(reductionAmount) && reductionAmount > 0
      ? reductionAmount
      : Number.NaN;
  }

  function resolveBatchAdjustDailySuggestedOverrideCandidate(declaredPrice, suggestedDeclaredPrice) {
    const normalizedDeclaredPrice = Number(declaredPrice);
    const normalizedSuggestedDeclaredPrice = Number(suggestedDeclaredPrice);

    if (
      !Number.isFinite(normalizedDeclaredPrice)
      || normalizedDeclaredPrice <= 0
      || !Number.isFinite(normalizedSuggestedDeclaredPrice)
      || normalizedSuggestedDeclaredPrice <= normalizedDeclaredPrice
    ) {
      return null;
    }

    return {
      oldPrice: normalizedDeclaredPrice,
      targetPrice: Number(Math.max(0, normalizedDeclaredPrice - 0.01).toFixed(2)),
      source: 'suggested_reduce_cent'
    };
  }

  function computeBatchAdjustActivityAdjustedPrice(activityDeclaredPrice, settings) {
    const normalizedActivityPrice = Number(activityDeclaredPrice);
    const reductionAmount = resolveBatchAdjustActivityReductionAmount(settings);

    if (
      !Number.isFinite(normalizedActivityPrice)
      || normalizedActivityPrice <= 0
      || !Number.isFinite(reductionAmount)
      || reductionAmount <= 0
    ) {
      return Number.NaN;
    }

    return Number(Math.max(0, normalizedActivityPrice - reductionAmount).toFixed(2));
  }

  function evaluateBatchAdjustRow(row, ruleMap, settings) {
    const entryKey = buildBatchAdjustEntryKey(
      row && row.shopId,
      row && row.station,
      row && row.category,
      row && row.spec
    );
    const declaredPrice = Number(row && row.declaredPrice);
    const suggestedDeclaredPrice = normalizeDecimalValue(row && row.suggestedDeclaredPrice, 0);
    const activityDeclaredPrice = normalizeDecimalValue(row && row.suggestedActivityDeclaredPrice, 0);
    const costPrice = Number(row && row.costPrice);
    const hasCostPrice = Number.isFinite(costPrice) && costPrice > 0;
    const hasSuggestedActivityDeclaredPrice = Number.isFinite(activityDeclaredPrice) && activityDeclaredPrice > 0;
    const dailySuggestedOverrideCandidate = resolveBatchAdjustDailySuggestedOverrideCandidate(
      declaredPrice,
      suggestedDeclaredPrice
    );
    const matchedRule = resolveBatchAdjustMatchedRuleByPrice(
      declaredPrice,
      ruleMap.get(entryKey)
    );
    const dailyAdjustedPrice = dailySuggestedOverrideCandidate
      ? Number(dailySuggestedOverrideCandidate.targetPrice)
      : computeBatchAdjustAdjustedPrice(declaredPrice, matchedRule);
    const dailyAdjustedProfitRate = computeBatchAdjustPreviewProfitRate(dailyAdjustedPrice, costPrice);
    const dailyEnabled = resolveBatchAdjustDailyEnabled(settings);
    const activitySelected = resolveBatchAdjustActivityEnabled(settings);
    const activityReductionAmount = resolveBatchAdjustActivityReductionAmount(settings);
    const activityEnabled = activitySelected;
    const activityConfigured = activitySelected
      && Number.isFinite(activityReductionAmount)
      && activityReductionAmount > 0;
    const localSkipReasons = new Set();
    let dailyNoteText = '';
    let activityNoteText = '';
    let dailyCandidate = null;
    let activityCandidate = null;

    if (dailyEnabled) {
      if (!Number.isFinite(declaredPrice) || declaredPrice <= 0) {
        dailyNoteText = '\u5f53\u524d\u7533\u62a5\u4ef7\u7f3a\u5931';
        localSkipReasons.add('daily_source_missing');
      } else if (dailySuggestedOverrideCandidate) {
        dailyNoteText = buildBatchAdjustProfitFloorNoteText(
          dailyAdjustedPrice,
          costPrice,
          settings && settings.dailyProfitFloorMode,
          settings && settings.dailyProfitFloorValue
        );

        if (!hasCostPrice) {
          dailyNoteText = '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e';
          localSkipReasons.add('missing_cost');
        } else if (dailyNoteText) {
          localSkipReasons.add('daily_profit_floor');
        } else {
          dailyCandidate = {
            oldPrice: declaredPrice,
            targetPrice: dailyAdjustedPrice,
            profitRate: dailyAdjustedProfitRate,
            source: 'suggested_reduce_cent'
          };
        }
      } else if (!matchedRule) {
        dailyNoteText = '\u672a\u547d\u4e2d\u8c03\u4ef7\u7ec4';
        localSkipReasons.add('daily_rule_not_matched');
      } else if (!Number.isFinite(dailyAdjustedPrice) || dailyAdjustedPrice <= 0) {
        dailyNoteText = '\u9884\u89c8\u540e\u4ef7\u683c\u65e0\u6548';
        localSkipReasons.add('daily_target_invalid');
      } else if (dailyAdjustedPrice + 0.0001 >= declaredPrice) {
        dailyNoteText = '\u9884\u89c8\u4ef7\u683c\u672a\u4f4e\u4e8e\u5f53\u524d\u7533\u62a5\u4ef7';
        localSkipReasons.add('daily_not_reduce');
      } else if (!hasCostPrice) {
        dailyNoteText = '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e';
        localSkipReasons.add('missing_cost');
      } else {
        dailyNoteText = buildBatchAdjustProfitFloorNoteText(
          dailyAdjustedPrice,
          costPrice,
          settings && settings.dailyProfitFloorMode,
          settings && settings.dailyProfitFloorValue
        );

        if (dailyNoteText) {
          localSkipReasons.add('daily_profit_floor');
        } else {
          dailyCandidate = {
            oldPrice: declaredPrice,
            targetPrice: dailyAdjustedPrice,
            profitRate: dailyAdjustedProfitRate
          };
        }
      }
    }

    if (activityEnabled) {
      if (!activityConfigured) {
        activityNoteText = '\u6d3b\u52a8\u76f4\u51cf\u4ef7\u672a\u8bbe\u7f6e';
        localSkipReasons.add('activity_reduction_missing');
      } else if (!hasSuggestedActivityDeclaredPrice) {
        activityNoteText = '\u65e0\u5efa\u8bae\u6d3b\u52a8\u4ef7';
        localSkipReasons.add('activity_source_missing');
      } else if (!hasCostPrice) {
        activityNoteText = '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e';
        localSkipReasons.add('missing_cost');
      } else {
        activityCandidate = {
          reductionAmount: activityReductionAmount
        };
      }
    }

    return {
      ...row,
      batchAdjustMatchedRule: dailySuggestedOverrideCandidate ? null : matchedRule,
      batchAdjustRuleText: dailySuggestedOverrideCandidate
        ? '--'
        : (matchedRule ? describeBatchAdjustRule(matchedRule) : '--'),
      batchAdjustHasCostPrice: hasCostPrice,
      batchAdjustDailyEnabled: dailyEnabled,
      batchAdjustDailyAdjustedPrice: Number.isFinite(dailyAdjustedPrice) ? dailyAdjustedPrice : Number.NaN,
      batchAdjustDailyAdjustedProfitRate: dailyAdjustedProfitRate,
      batchAdjustDailyNoteText: dailyNoteText,
      batchAdjustDailyCandidate: dailyCandidate,
      batchAdjustActivityEnabled: activityEnabled,
      batchAdjustActivitySourcePrice: activityDeclaredPrice,
      batchAdjustActivityAdjustedPrice: Number.NaN,
      batchAdjustActivityAdjustedProfitRate: Number.NaN,
      batchAdjustActivityNoteText: activityNoteText,
      batchAdjustActivityCandidate: activityCandidate,
      batchAdjustLocalSkipReasons: Array.from(localSkipReasons),
      batchAdjustSubmitEligible: Boolean(dailyCandidate || activityCandidate),
      batchAdjustAdjustedPrice: Number.isFinite(dailyAdjustedPrice) ? dailyAdjustedPrice : Number.NaN,
      batchAdjustAdjustedProfitRate: dailyAdjustedProfitRate,
      batchAdjustNoteText: dailyNoteText
    };
  }

  function evaluateBatchAdjustRows(rows, entries, settings) {
    const ruleMap = buildBatchAdjustRuleMap(entries);

    return (Array.isArray(rows) ? rows : []).map((row) => {
      return evaluateBatchAdjustRow(row, ruleMap, settings);
    });
  }

  function buildBatchAdjustPreviewRowsForShop(rows, entries, shopId, settings) {
    const normalizedShopId = normalizeText(shopId);

    return evaluateBatchAdjustRows(rows, entries, settings).filter((row) => {
      return normalizeText(row && row.shopId) === normalizedShopId;
    });
  }

  function summarizeBatchAdjustPreviewRows(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((summary, row) => {
      if (row && row.batchAdjustDailyCandidate) {
        summary.dailyEligibleCount += 1;
      }

      if (row && row.batchAdjustActivityCandidate) {
        summary.activityEligibleCount += 1;
      }

      if (!(row && row.batchAdjustHasCostPrice)) {
        summary.missingCostCount += 1;
      }

      if (!(row && row.batchAdjustSubmitEligible)) {
        summary.skippedCount += 1;
      }

      return summary;
    }, {
      dailyEligibleCount: 0,
      activityEligibleCount: 0,
      missingCostCount: 0,
      skippedCount: 0
    });
  }

  function buildBatchAdjustSubmitRowsPayload(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      rowId: normalizeText(row && (row.id || row.rowId)),
      shopId: normalizeText(row && row.shopId),
      shopName: normalizeText(row && row.shopName),
      productId: normalizeText(row && row.productId),
      productSkcId: normalizeText(row && (row.productSkcId || row.skcId)),
      skuId: normalizeText(row && row.skuId),
      supplierId: normalizeText(row && row.supplierId),
      siteId: normalizeText(row && (row.siteId || row.station)),
      productName: normalizeText(row && (row.productName || row.productTitle)),
      spec: normalizeText(row && row.spec),
      oldPriceCurrency: normalizeText(row && row.priceCurrency) || 'CNY',
      targetPriceCurrency: normalizeText(row && row.targetPriceCurrency)
        || normalizeText(row && row.priceCurrency)
        || 'CNY',
      declaredPrice: convertBatchAdjustPriceToCent(row && row.declaredPrice),
      suggestedDeclaredPrice: convertBatchAdjustPriceToCent(row && row.suggestedDeclaredPrice),
      suggestedActivityDeclaredPrice: convertBatchAdjustPriceToCent(row && row.suggestedActivityDeclaredPrice),
      dailySubmitCount: Math.max(0, normalizeIntegerValue(row && row.dailySubmitCount, 0)),
      activitySubmitCount: Math.max(0, normalizeIntegerValue(row && row.activitySubmitCount, 0)),
      costPrice: convertBatchAdjustPriceToCent(row && row.costPrice),
      dailyCandidate: row && row.batchAdjustDailyCandidate
        ? {
          oldSupplyPrice: convertBatchAdjustPriceToCent(
            row.batchAdjustDailyCandidate.oldPrice
          ),
          targetSupplyPrice: convertBatchAdjustPriceToCent(
            row.batchAdjustDailyCandidate.targetPrice
          )
        }
        : null,
      activityCandidate: row && row.batchAdjustActivityCandidate
        ? {
          oldSupplyPrice: convertBatchAdjustPriceToCent(
            row.batchAdjustActivityCandidate.oldPrice
          ),
          reductionAmount: convertBatchAdjustPriceToCent(
            row.batchAdjustActivityCandidate.reductionAmount
          )
        }
        : null,
      localSkipReasons: Array.isArray(row && row.batchAdjustLocalSkipReasons)
        ? row.batchAdjustLocalSkipReasons.slice()
        : []
    }));
  }

  function applyBatchAdjustRowUpdates(rows, rowUpdates) {
    const updateMap = new Map(
      (Array.isArray(rowUpdates) ? rowUpdates : [])
        .map((rowUpdate) => [normalizeText(rowUpdate && rowUpdate.rowId), rowUpdate])
        .filter((item) => item[0])
    );

    if (updateMap.size <= 0) {
      return Array.isArray(rows) ? rows.slice() : [];
    }

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const rowUpdate = updateMap.get(normalizeText(row && row.id));

      if (!rowUpdate) {
        return row;
      }

      return {
        ...row,
        ...(rowUpdate.status ? { status: normalizeText(rowUpdate.status) } : {}),
        ...(rowUpdate.priceReviewStatus !== undefined && rowUpdate.priceReviewStatus !== null
          ? { priceReviewStatus: normalizeIntegerValue(rowUpdate.priceReviewStatus, -1) }
          : {}),
        ...(Number.isFinite(Number(rowUpdate.suggestedDeclaredPrice))
          ? { suggestedDeclaredPrice: Number(Number(rowUpdate.suggestedDeclaredPrice).toFixed(2)) }
          : {}),
        ...(Number.isFinite(Number(rowUpdate.suggestedActivityDeclaredPrice))
          ? { suggestedActivityDeclaredPrice: Number(Number(rowUpdate.suggestedActivityDeclaredPrice).toFixed(2)) }
          : {}),
        ...(Number.isFinite(Number(rowUpdate.dailySubmitCount))
          ? { dailySubmitCount: Math.max(0, normalizeIntegerValue(rowUpdate.dailySubmitCount, 0)) }
          : {}),
        ...(Number.isFinite(Number(rowUpdate.activitySubmitCount))
          ? { activitySubmitCount: Math.max(0, normalizeIntegerValue(rowUpdate.activitySubmitCount, 0)) }
          : {}),
        ...(normalizeText(rowUpdate.dailyLastSubmittedAt)
          ? { dailyLastSubmittedAt: normalizeText(rowUpdate.dailyLastSubmittedAt) }
          : {}),
        ...(normalizeText(rowUpdate.activityLastSubmittedAt)
          ? { activityLastSubmittedAt: normalizeText(rowUpdate.activityLastSubmittedAt) }
          : {}),
        ...(normalizeText(rowUpdate.updatedAt)
          ? { updatedAt: normalizeText(rowUpdate.updatedAt) }
          : {})
      };
    });
  }

  function getBatchAdjustDialogValidationError(settingsPayload) {
    if (!(settingsPayload && settingsPayload.dailyEnabled) && !(settingsPayload && settingsPayload.activityEnabled)) {
      return '\u8bf7\u81f3\u5c11\u5f00\u542f\u4e00\u79cd\u8c03\u4ef7\u7c7b\u578b';
    }

    if (!normalizeText(settingsPayload && settingsPayload.reasonCode)) {
      return '\u8bf7\u5148\u9009\u62e9\u8c03\u4ef7\u539f\u56e0';
    }

    return '';
  }

  function collectBatchAdjustDialogPreviewContext(state) {
    const settingsPayload = buildBatchAdjustSettingsPayload(state);
    const validationError = getBatchAdjustDialogValidationError(settingsPayload);
    const selectedStationIds = new Set(
      normalizeBatchAdjustDialogStationIds(
        state && state.batchAdjustDialogStationIds,
        state && state.batchAdjustDialogStationOptions
      )
    );
    const filteredRows = applyLocalFilters(state && state.rows, state && state.appliedFilters).filter((row) => {
      if (selectedStationIds.size <= 0) {
        return true;
      }

      return selectedStationIds.has(normalizeText(row && row.station));
    });
    const evaluatedRows = evaluateBatchAdjustRows(
      filteredRows,
      state && state.batchAdjustDialogEntries,
      settingsPayload
    );
    const previewSummary = summarizeBatchAdjustPreviewRows(evaluatedRows);

    return {
      settingsPayload,
      validationError,
      filteredRows,
      evaluatedRows,
      previewSummary
    };
  }

  function mergeBatchAdjustSubmitPreviewRows(evaluatedRows, previewItems) {
    const previewItemMap = new Map(
      (Array.isArray(previewItems) ? previewItems : [])
        .map((previewItem) => [normalizeText(previewItem && previewItem.rowId), previewItem])
        .filter((item) => item[0])
    );

    return (Array.isArray(evaluatedRows) ? evaluatedRows : [])
      .map((row) => {
        const previewItem = previewItemMap.get(normalizeText(row && (row.id || row.rowId)));

        if (!previewItem) {
          return null;
        }

        return {
          ...row,
          batchAdjustSubmitPreviewDailyReady: previewItem && previewItem.dailyReady === true,
          batchAdjustSubmitPreviewDailyRequestCount: Math.max(0, normalizeIntegerValue(previewItem && previewItem.dailyRequestCount, 0)),
          batchAdjustSubmitPreviewDailyTargetPrice: convertBatchAdjustCentToPrice(previewItem && previewItem.dailyTargetSupplyPrice),
          batchAdjustSubmitPreviewDailyPriceSource: normalizeText(previewItem && previewItem.dailyPriceSource),
          batchAdjustSubmitPreviewDailySubmitCount: Math.max(
            0,
            normalizeIntegerValue(
              previewItem && previewItem.dailySubmitCount,
              normalizeIntegerValue(row && row.dailySubmitCount, 0)
            )
          ),
          batchAdjustSubmitPreviewDailySkipReasonLabels: Array.isArray(previewItem && previewItem.dailySkipReasonLabels)
            ? previewItem.dailySkipReasonLabels
            : [],
          batchAdjustSubmitPreviewActivityReady: previewItem && previewItem.activityReady === true,
          batchAdjustSubmitPreviewActivityRequestCount: Math.max(0, normalizeIntegerValue(previewItem && previewItem.activityRequestCount, 0)),
          batchAdjustSubmitPreviewActivityTargetPrice: convertBatchAdjustCentToPrice(previewItem && previewItem.activityTargetSupplyPrice),
          batchAdjustSubmitPreviewActivityPriceSource: normalizeText(previewItem && previewItem.activityPriceSource),
          batchAdjustSubmitPreviewActivitySubmitCount: Math.max(
            0,
            normalizeIntegerValue(
              previewItem && previewItem.activitySubmitCount,
              normalizeIntegerValue(row && row.activitySubmitCount, 0)
            )
          ),
          batchAdjustSubmitPreviewActivitySkipReasonLabels: Array.isArray(previewItem && previewItem.activitySkipReasonLabels)
            ? previewItem.activitySkipReasonLabels
            : [],
          batchAdjustSubmitPreviewEligible: previewItem && previewItem.submitEligible === true
        };
      })
      .filter(Boolean);
  }

  function resolveBatchAdjustSubmitProgressPhaseLabel(phase) {
    const normalizedPhase = normalizeText(phase);

    if (normalizedPhase === 'preparing') {
      return '\u51c6\u5907\u63d0\u4ea4';
    }

    if (normalizedPhase === 'activity-detail') {
      return '\u83b7\u53d6\u6d3b\u52a8\u8be6\u60c5';
    }

    if (normalizedPhase === 'submitting') {
      return '\u63d0\u4ea4\u8c03\u4ef7';
    }

    if (normalizedPhase === 'shop-completed') {
      return '\u5e97\u94fa\u5b8c\u6210';
    }

    if (normalizedPhase === 'shop-failed') {
      return '\u5e97\u94fa\u5f02\u5e38';
    }

    if (normalizedPhase === 'canceling') {
      return '\u6b63\u5728\u505c\u6b62';
    }

    if (normalizedPhase === 'canceled') {
      return '\u5df2\u505c\u6b62';
    }

    if (normalizedPhase === 'completed') {
      return '\u63d0\u4ea4\u5b8c\u6210';
    }

    if (normalizedPhase === 'failed') {
      return '\u63d0\u4ea4\u5931\u8d25';
    }

    return normalizedPhase || '--';
  }

  function resolveBatchAdjustPreviewProgressPhaseLabel(phase) {
    const normalizedPhase = normalizeText(phase);

    if (normalizedPhase === 'preparing') {
      return '\u51c6\u5907\u9884\u89c8';
    }

    if (normalizedPhase === 'history') {
      return '\u8bfb\u53d6\u5386\u53f2';
    }

    if (normalizedPhase === 'shop-session') {
      return '\u6821\u9a8c\u5e97\u94fa\u767b\u5f55';
    }

    if (normalizedPhase === 'daily-preview') {
      return '\u751f\u6210\u65e5\u5e38\u9884\u89c8';
    }

    if (normalizedPhase === 'activity-detail') {
      return '\u83b7\u53d6\u6d3b\u52a8\u8be6\u60c5';
    }

    if (normalizedPhase === 'activity-preview') {
      return '\u751f\u6210\u6d3b\u52a8\u9884\u89c8';
    }

    if (normalizedPhase === 'shop-completed') {
      return '\u5e97\u94fa\u5b8c\u6210';
    }

    if (normalizedPhase === 'shop-failed') {
      return '\u5e97\u94fa\u5f02\u5e38';
    }

    if (normalizedPhase === 'canceling') {
      return '\u6b63\u5728\u505c\u6b62';
    }

    if (normalizedPhase === 'canceled') {
      return '\u5df2\u505c\u6b62';
    }

    if (normalizedPhase === 'completed') {
      return '\u9884\u89c8\u5b8c\u6210';
    }

    if (normalizedPhase === 'failed') {
      return '\u9884\u89c8\u5931\u8d25';
    }

    return normalizedPhase || '--';
  }

  function renderBatchAdjustSubmitProgressMarkup(progress, options = {}) {
    const normalizedProgress = normalizeBatchAdjustSubmitProgressPayload(progress);

    if (!normalizedProgress) {
      return '';
    }

    const taskType = normalizeText(options && options.taskType);
    const phase = normalizeText(normalizedProgress.phase);
    const phaseLabel = taskType === 'batchAdjustPreview'
      ? resolveBatchAdjustPreviewProgressPhaseLabel(phase)
      : resolveBatchAdjustSubmitProgressPhaseLabel(phase);
    const phaseToneClass = phase === 'completed'
      ? ' is-success'
      : (phase === 'failed' || phase === 'shop-failed'
        ? ' is-danger'
        : (
          phase === 'canceled'
            ? ' is-warning'
            : (phase === 'activity-detail' ? ' is-accent' : ' is-running')
        ));
    const currentShopName = normalizeText(normalizedProgress.currentShopName)
      || normalizeText(normalizedProgress.currentShopId);
    const shopProgressText = normalizedProgress.totalShops > 0
      ? `${normalizedProgress.completedShops}/${normalizedProgress.totalShops}`
      : String(normalizedProgress.completedShops);
    const chunkText = normalizedProgress.totalChunks > 0 && normalizedProgress.currentChunkIndex > 0
      ? `${normalizedProgress.currentChunkIndex}/${normalizedProgress.totalChunks}`
      : '--';
    const summaryCards = [
      {
        label: '\u5e97\u94fa\u8fdb\u5ea6',
        value: shopProgressText
      },
      {
        label: '\u5931\u8d25\u5e97\u94fa',
        value: String(normalizedProgress.failedShops)
      }
    ];

    if (taskType === 'batchAdjustPreview') {
      summaryCards.push(
        {
          label: '\u65e5\u5e38\u5f85\u63d0\u4ea4',
          value: String(normalizedProgress.requestedDailyCount)
        },
        {
          label: '\u6d3b\u52a8\u5f85\u63d0\u4ea4',
          value: String(normalizedProgress.requestedActivityCount)
        },
        {
          label: '\u5df2\u8df3\u8fc7',
          value: String(normalizedProgress.skippedRowCount)
        }
      );

      if (normalizedProgress.totalChunks > 0 && normalizedProgress.currentChunkIndex > 0) {
        summaryCards.push({
          label: phase === 'activity-detail' ? '\u6d3b\u52a8\u8be6\u60c5\u6279\u6b21' : '\u7ec4\u88c5\u8fdb\u5ea6',
          value: chunkText
        });
      }
    } else if (phase === 'activity-detail') {
      summaryCards.push(
        {
          label: '\u5f53\u524d\u6279\u6b21',
          value: chunkText
        },
        {
          label: '\u5df2\u8df3\u8fc7',
          value: String(normalizedProgress.skippedRowCount)
        }
      );
    } else {
      summaryCards.push(
        {
          label: '\u65e5\u5e38',
          value: `${normalizedProgress.successDailyCount}/${normalizedProgress.requestedDailyCount}`
        },
        {
          label: '\u6d3b\u52a8',
          value: `${normalizedProgress.successActivityCount}/${normalizedProgress.requestedActivityCount}`
        },
        {
          label: '\u5df2\u8df3\u8fc7',
          value: String(normalizedProgress.skippedRowCount)
        }
      );

      if (normalizedProgress.totalChunks > 0 && normalizedProgress.currentChunkIndex > 0) {
        summaryCards.push({
          label: '\u5f53\u524d\u6279\u6b21',
          value: chunkText
        });
      }
    }

    return `
      <div class="ops-npl-batch-adjust-submit-progress" role="status" aria-live="polite">
        <div class="ops-npl-batch-adjust-submit-progress-head">
          <span class="ops-npl-batch-adjust-submit-progress-phase${phaseToneClass}">${escapeHtml(phaseLabel)}</span>
          <strong class="ops-npl-batch-adjust-submit-progress-message">${escapeHtml(normalizedProgress.message || phaseLabel)}</strong>
          ${currentShopName ? `<span class="ops-npl-batch-adjust-submit-progress-shop">\u5f53\u524d\u5e97\u94fa\uff1a${escapeHtml(currentShopName)}</span>` : ''}
        </div>
        <div class="ops-npl-batch-adjust-submit-progress-grid">
          ${summaryCards.map((card) => {
            return `
              <div class="ops-npl-batch-adjust-submit-progress-item">
                <span class="ops-npl-batch-adjust-submit-progress-item-label">${escapeHtml(card.label)}</span>
                <strong class="ops-npl-batch-adjust-submit-progress-item-value">${escapeHtml(card.value)}</strong>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderBatchAdjustRuntimeMarkup(state) {
    const previewSaving = Boolean(state && state.batchAdjustSubmitPreviewSaving);
    const submitSaving = Boolean(state && state.batchAdjustDialogSubmitting);
    const previewProgress = normalizeBatchAdjustSubmitProgressPayload(state && state.batchAdjustPreviewProgress);
    const submitProgress = normalizeBatchAdjustSubmitProgressPayload(state && state.batchAdjustSubmitProgress);

    return `
      ${previewSaving && previewProgress
        ? renderBatchAdjustSubmitProgressMarkup(previewProgress, {
          taskType: 'batchAdjustPreview'
        })
        : ''}
      ${submitSaving && submitProgress
        ? renderBatchAdjustSubmitProgressMarkup(submitProgress)
        : ''}
    `;
  }

  function refreshBatchAdjustSubmitRuntime(container) {
    const state = getState(container);
    const runtimeHost = container.querySelector('[data-npl-batch-adjust-submit-runtime="true"]');

    if (!(runtimeHost instanceof HTMLElement)) {
      return false;
    }

    runtimeHost.innerHTML = renderBatchAdjustRuntimeMarkup(state);
    return true;
  }

  function scheduleBatchAdjustSubmitRuntimeRefresh(container) {
    const state = getState(container);

    if (state.batchAdjustSubmitRuntimeFrame) {
      return;
    }

    state.batchAdjustSubmitRuntimeFrame = window.requestAnimationFrame(() => {
      state.batchAdjustSubmitRuntimeFrame = 0;

      if (refreshBatchAdjustSubmitRuntime(container) !== true) {
        render(container);
      }
    });
  }

  function padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  function formatDateTimeLabel(value) {
    const timestamp = Date.parse(normalizeText(value));

    if (!Number.isFinite(timestamp)) {
      return '--';
    }

    const date = new Date(timestamp);

    return [
      date.getFullYear(),
      '-',
      padDatePart(date.getMonth() + 1),
      '-',
      padDatePart(date.getDate()),
      ' ',
      padDatePart(date.getHours()),
      ':',
      padDatePart(date.getMinutes()),
      ':',
      padDatePart(date.getSeconds())
    ].join('');
  }

  function formatSummaryDateTimeLabel(value) {
    const text = formatDateTimeLabel(value);
    return text.length > 16 ? text.slice(0, 16) : text;
  }

  function createState() {
    return {
      filters: cloneFilters(),
      appliedFilters: cloneFiltersForQuery(DEFAULT_FILTERS),
      hasQueried: false,
      rows: [],
      selectedIds: new Set(),
      pageSize: 10,
      currentPage: 1,
      queryRunId: '',
      queryLoading: false,
      queryCanceling: false,
      queryProgress: null,
      queryShopProgressById: Object.create(null),
      querySettingsLoaded: false,
      querySettingsLoading: false,
      querySettingsSaving: false,
      querySettingsPromise: null,
      querySettingsSaveTimer: 0,
      queryError: '',
      queryWarning: '',
      queryResultMeta: null,
      quickCostDialogOpen: false,
      quickCostDialogLoading: false,
      quickCostDialogSaving: false,
      quickCostDialogError: '',
      quickCostDialogWarning: '',
      quickCostDialogNotice: '',
      quickCostDialogEntries: [],
      quickCostDialogRowCount: 0,
      batchAdjustDialogOpen: false,
      batchAdjustDialogLoading: false,
      batchAdjustDialogSaving: false,
      batchAdjustDialogSubmitting: false,
      batchAdjustDialogError: '',
      batchAdjustDialogWarning: '',
      batchAdjustDialogNotice: '',
      batchAdjustDialogEntries: [],
      batchAdjustDialogRowCount: 0,
      batchAdjustDialogDirty: false,
      batchAdjustDialogPendingSave: false,
      batchAdjustDialogPendingClose: false,
      batchAdjustDialogSaveTimer: 0,
      batchAdjustDialogSavePromise: null,
      batchAdjustSubmitRuntimeFrame: 0,
      batchAdjustDialogLastSavedSignature: '',
      batchAdjustDialogLastAutoSaveAt: 0,
      batchAdjustDialogStationOptions: [],
      batchAdjustDialogStationIds: [],
      batchAdjustDialogDailyEnabled: true,
      batchAdjustDialogActivityEnabled: false,
      batchAdjustDialogReasonCode: '',
      batchAdjustDialogRemark: '',
      batchAdjustDialogDuplicateSubmitWindowDays: '',
      batchAdjustDialogUseSuggestedPriceAfterSubmitCount: '',
      batchAdjustDialogActivityPriceReduction: '',
      batchAdjustDialogDailyProfitFloorMode: 'rate',
      batchAdjustDialogDailyProfitFloorValue: '',
      batchAdjustDialogActivityProfitFloorMode: 'rate',
      batchAdjustDialogActivityProfitFloorValue: '',
      batchAdjustPreviewRunId: '',
      batchAdjustCanceledRunId: '',
      batchAdjustSubmitRunId: '',
      batchAdjustSubmitProgress: null,
      batchAdjustPreviewProgress: null,
      batchAdjustPreviewShopId: '',
      batchAdjustSubmitPreviewOpen: false,
      batchAdjustSubmitPreviewItems: [],
      batchAdjustSubmitPreviewResultsByShop: [],
      batchAdjustSubmitPreviewShopSummaries: [],
      batchAdjustSubmitPreviewGroupedRequests: [],
      batchAdjustSubmitPreviewRequestToken: '',
      batchAdjustSubmitPreviewSummary: createDefaultBatchAdjustSubmitPreviewSummary(),
      batchAdjustSubmitPreviewSaving: false,
      batchAdjustSubmitPreviewResetScroll: false,
      batchAdjustSubmitPreviewVirtualScrollTop: 0,
      batchAdjustSubmitPreviewVirtualViewportHeight: BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT,
      batchAdjustSubmitPreviewVirtualFrame: 0,
      priceDeclDialogOpen: false,
      priceDeclDialogApproveUseCostPrice: false,
      priceDeclDialogApproveCondition: 'profitRate',
      priceDeclDialogApproveValue: '',
      priceDeclDialogRedeclareUseLastReduce: true,
      priceDeclDialogRedeclareCondition: 'profitRate',
      priceDeclDialogRedeclareValue: '',
      priceDeclDialogFallbackApproveRules: [createDefaultPriceDeclFallbackApproveRule()],
      priceDeclDialogApproveReduceType: 'discount',
      priceDeclDialogApproveReduceValue: '',
      priceDeclDialogApproveReduceValueDiscount: '',
      priceDeclDialogApproveReduceValueFlatReduce: '',
      priceDeclDialogVoidMaxAttempts: '3',
      priceDeclDialogError: '',
      priceDeclDialogResult: '',
      priceDeclDialogSaving: false,
      priceDeclSubmitRunId: '',
      priceDeclSubmitProgress: null,
      priceDeclSubmitRuntimeFrame: 0,
      priceDeclPreviewOpen: false,
      priceDeclPreviewItems: [],
      priceDeclPreviewResultsByShop: [],
      priceDeclPreviewGroupedRequests: [],
      priceDeclPreviewSummary: createDefaultPriceDeclPreviewSummary(),
      priceDeclPreviewSaving: false,
      priceDeclPreviewRetryMode: false,
      priceDeclPreviewSelectedShopIds: [],
      priceDeclPreviewSelectedResultTypes: [],
      priceDeclPreviewSortField: 'productName',
      priceDeclPreviewSortDirection: 'asc',
      priceDeclPreviewVisibleCount: PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE,
      priceDeclPreviewResetScroll: false,
      imagePreview: null,
      removeQueryProgressListener: null,
      removeBatchAdjustSubmitProgressListener: null,
      removePriceDeclSubmitProgressListener: null,
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
      categorySnapshot: buildEmptyCategorySnapshot(),
      categorySelectedPath: [],
      categoryCheckedPaths: [],
      categoryColumns: [],
      categorySelectorOpen: false,
      categoryRootLoading: false,
      categoryRootLoaded: false,
      categoryRootError: '',
      categoryRootPromise: null,
      categoryChildCache: Object.create(null),
      categoryChildLoadingKey: '',
      categoryChildErrorKey: '',
      categoryChildError: '',
      categorySearchKeyword: '',
      categorySearchResults: [],
      categorySearchTotal: 0,
      categorySearchLoading: false,
      categorySearchError: '',
      categorySearchFocusInput: false,
      categorySearchTimer: 0,
      categorySearchRequestId: 0,
      multiSelectorOpen: ''
    };
  }

  function getState(container) {
    if (!container.__operationsNewProductLifecycleState) {
      container.__operationsNewProductLifecycleState = createState();
    }

    return container.__operationsNewProductLifecycleState;
  }

  function resolveQueryShopIds(state) {
    return normalizeSelectedShopIds(
      state && state.filters && state.filters.selectedShopIds
    );
  }

  function createQueryRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `npl_${window.crypto.randomUUID()}`;
    }

    return `npl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
      phase,
      pageNum: Math.max(0, normalizeIntegerValue(payload.pageNum, 0)),
      totalPages: Math.max(0, normalizeIntegerValue(payload.totalPages, 0)),
      pageSize: Math.max(0, normalizeIntegerValue(payload.pageSize, 0)),
      fetchedItemCount: Math.max(0, normalizeIntegerValue(payload.fetchedItemCount, 0)),
      accumulatedItemCount: Math.max(0, normalizeIntegerValue(payload.accumulatedItemCount, 0)),
      estimatedTotal: Math.max(0, normalizeIntegerValue(payload.estimatedTotal, 0)),
      rowCount: Math.max(0, normalizeIntegerValue(payload.rowCount, 0)),
      totalShops: Math.max(0, normalizeIntegerValue(payload.totalShops, 0)),
      delaySeconds: Math.max(0, Number(payload.delaySeconds) || (Number(payload.delayMs) || 0) / 1000),
      message: normalizeText(payload.message),
      updatedAt: normalizeText(payload.updatedAt)
    };
  }

  function isTerminalQueryProgress(progress) {
    const phase = normalizeText(progress && progress.phase);
    return phase === 'completed' || phase === 'failed' || phase === 'canceled';
  }

  function normalizeBatchAdjustSubmitProgressPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const phase = normalizeText(payload.phase);

    if (!phase) {
      return null;
    }

    return {
      runId: normalizeText(payload.runId),
      phase,
      totalShops: Math.max(0, normalizeIntegerValue(payload.totalShops, 0)),
      completedShops: Math.max(0, normalizeIntegerValue(payload.completedShops, 0)),
      failedShops: Math.max(0, normalizeIntegerValue(payload.failedShops, 0)),
      requestedDailyCount: Math.max(0, normalizeIntegerValue(payload.requestedDailyCount, 0)),
      requestedActivityCount: Math.max(0, normalizeIntegerValue(payload.requestedActivityCount, 0)),
      successDailyCount: Math.max(0, normalizeIntegerValue(payload.successDailyCount, 0)),
      successActivityCount: Math.max(0, normalizeIntegerValue(payload.successActivityCount, 0)),
      failedDailyCount: Math.max(0, normalizeIntegerValue(payload.failedDailyCount, 0)),
      failedActivityCount: Math.max(0, normalizeIntegerValue(payload.failedActivityCount, 0)),
      skippedRowCount: Math.max(0, normalizeIntegerValue(payload.skippedRowCount, 0)),
      currentShopId: normalizeText(payload.currentShopId),
      currentShopName: normalizeText(payload.currentShopName),
      currentChunkIndex: Math.max(0, normalizeIntegerValue(payload.currentChunkIndex, 0)),
      totalChunks: Math.max(0, normalizeIntegerValue(payload.totalChunks, 0)),
      message: normalizeText(payload.message),
      updatedAt: normalizeText(payload.updatedAt)
    };
  }

  function isTerminalBatchAdjustSubmitProgress(progress) {
    const phase = normalizeText(progress && progress.phase);
    return phase === 'completed' || phase === 'failed' || phase === 'canceled';
  }

  function normalizePriceDeclSubmitProgressPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const taskType = normalizeText(payload.taskType);
    const phase = normalizeText(payload.phase);

    if ((taskType && taskType !== 'priceDeclSubmit') || !phase) {
      return null;
    }

    return {
      runId: normalizeText(payload.runId),
      phase,
      totalShops: Math.max(0, normalizeIntegerValue(payload.totalShops, 0)),
      completedShops: Math.max(0, normalizeIntegerValue(payload.completedShops, 0)),
      failedShops: Math.max(0, normalizeIntegerValue(payload.failedShops, 0)),
      successRequests: Math.max(0, normalizeIntegerValue(payload.successRequests, 0)),
      failedRequests: Math.max(0, normalizeIntegerValue(payload.failedRequests, 0)),
      successChunks: Math.max(0, normalizeIntegerValue(payload.successChunks, 0)),
      failedChunks: Math.max(0, normalizeIntegerValue(payload.failedChunks, 0)),
      successSkuCount: Math.max(0, normalizeIntegerValue(payload.successSkuCount, 0)),
      failedSkuCount: Math.max(0, normalizeIntegerValue(payload.failedSkuCount, 0)),
      currentShopId: normalizeText(payload.currentShopId),
      currentShopName: normalizeText(payload.currentShopName),
      currentChunkIndex: Math.max(0, normalizeIntegerValue(payload.currentChunkIndex, 0)),
      currentChunkRequestCount: Math.max(0, normalizeIntegerValue(payload.currentChunkRequestCount, 0)),
      totalChunks: Math.max(0, normalizeIntegerValue(payload.totalChunks, 0)),
      message: normalizeText(payload.message),
      updatedAt: normalizeText(payload.updatedAt)
    };
  }

  function isTerminalPriceDeclSubmitProgress(progress) {
    const phase = normalizeText(progress && progress.phase);
    return phase === 'completed' || phase === 'failed' || phase === 'canceled';
  }

  function bindQueryProgressListener(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      typeof state.removeQueryProgressListener === 'function'
      || !featureCenterApi
      || typeof featureCenterApi.onOperationsNewProductLifecycleProgress !== 'function'
    ) {
      return;
    }

    state.removeQueryProgressListener = featureCenterApi.onOperationsNewProductLifecycleProgress((payload) => {
      if (normalizeText(payload && payload.taskType)) {
        return;
      }

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

      if (nextProgress.shopId) {
        state.queryShopProgressById = {
          ...(state.queryShopProgressById || Object.create(null)),
          [nextProgress.shopId]: nextProgress
        };
      }

      if (isTerminalQueryProgress(nextProgress) && state.queryLoading === true) {
        const progressList = Object.values(state.queryShopProgressById || Object.create(null));
        const unfinishedProgress = progressList.some((progressItem) => !isTerminalQueryProgress(progressItem));

        if (unfinishedProgress !== true) {
          state.queryLoading = false;
          state.queryCanceling = false;
        }
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

  function bindBatchAdjustSubmitProgressListener(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      typeof state.removeBatchAdjustSubmitProgressListener === 'function'
      || !featureCenterApi
      || typeof featureCenterApi.onOperationsNewProductLifecycleBatchAdjustProgress !== 'function'
    ) {
      return;
    }

    state.removeBatchAdjustSubmitProgressListener = featureCenterApi.onOperationsNewProductLifecycleBatchAdjustProgress((payload) => {
      if (normalizeText(payload && payload.taskType) === 'batchAdjustPreview') {
        return;
      }

      const nextProgress = normalizeBatchAdjustSubmitProgressPayload(payload);

      if (!nextProgress) {
        return;
      }

      if (
        normalizeText(state.batchAdjustSubmitRunId)
        && normalizeText(nextProgress.runId)
        && normalizeText(nextProgress.runId) !== normalizeText(state.batchAdjustSubmitRunId)
      ) {
        return;
      }

      state.batchAdjustSubmitProgress = nextProgress;

      if (isTerminalBatchAdjustSubmitProgress(nextProgress)) {
        state.batchAdjustDialogSubmitting = false;

        if (state.batchAdjustDialogPendingClose === true && !state.batchAdjustDialogError) {
          state.batchAdjustDialogPendingClose = false;
          void closeBatchAdjustDialog(container, {
            persist: false
          });
          return;
        }
      }

      if (state.batchAdjustDialogOpen === true) {
        scheduleBatchAdjustSubmitRuntimeRefresh(container);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (typeof state.removeBatchAdjustSubmitProgressListener === 'function') {
        state.removeBatchAdjustSubmitProgressListener();
        state.removeBatchAdjustSubmitProgressListener = null;
      }
      if (state.batchAdjustSubmitRuntimeFrame) {
        window.cancelAnimationFrame(state.batchAdjustSubmitRuntimeFrame);
        state.batchAdjustSubmitRuntimeFrame = 0;
      }
    }, { once: true });
  }

  function bindBatchAdjustPreviewProgressListener(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      typeof state.removeBatchAdjustPreviewProgressListener === 'function'
      || !featureCenterApi
      || typeof featureCenterApi.onOperationsNewProductLifecycleBatchAdjustProgress !== 'function'
    ) {
      return;
    }

    state.removeBatchAdjustPreviewProgressListener = featureCenterApi.onOperationsNewProductLifecycleBatchAdjustProgress((payload) => {
      if (normalizeText(payload && payload.taskType) !== 'batchAdjustPreview') {
        return;
      }

      const nextProgress = normalizeBatchAdjustSubmitProgressPayload(payload);

      if (!nextProgress) {
        return;
      }

      if (
        normalizeText(state.batchAdjustPreviewRunId)
        && normalizeText(nextProgress.runId)
        && normalizeText(nextProgress.runId) !== normalizeText(state.batchAdjustPreviewRunId)
      ) {
        return;
      }

      state.batchAdjustPreviewProgress = nextProgress;

      if (isTerminalBatchAdjustSubmitProgress(nextProgress)) {
        state.batchAdjustSubmitPreviewSaving = false;

        if (state.batchAdjustDialogPendingClose === true && !state.batchAdjustDialogError) {
          state.batchAdjustDialogPendingClose = false;
          void closeBatchAdjustDialog(container, {
            persist: false
          });
          return;
        }
      }

      if (state.batchAdjustDialogOpen === true) {
        scheduleBatchAdjustSubmitRuntimeRefresh(container);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (typeof state.removeBatchAdjustPreviewProgressListener === 'function') {
        state.removeBatchAdjustPreviewProgressListener();
        state.removeBatchAdjustPreviewProgressListener = null;
      }
      if (state.batchAdjustSubmitRuntimeFrame) {
        window.cancelAnimationFrame(state.batchAdjustSubmitRuntimeFrame);
        state.batchAdjustSubmitRuntimeFrame = 0;
      }
    }, { once: true });
  }

  function bindPriceDeclSubmitProgressListener(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      typeof state.removePriceDeclSubmitProgressListener === 'function'
      || !featureCenterApi
      || typeof featureCenterApi.onOperationsNewProductLifecycleProgress !== 'function'
    ) {
      return;
    }

    state.removePriceDeclSubmitProgressListener = featureCenterApi.onOperationsNewProductLifecycleProgress((payload) => {
      if (normalizeText(payload && payload.taskType) !== 'priceDeclSubmit') {
        return;
      }

      const nextProgress = normalizePriceDeclSubmitProgressPayload(payload);

      if (!nextProgress) {
        return;
      }

      if (
        normalizeText(state.priceDeclSubmitRunId)
        && normalizeText(nextProgress.runId)
        && normalizeText(nextProgress.runId) !== normalizeText(state.priceDeclSubmitRunId)
      ) {
        return;
      }

      state.priceDeclSubmitProgress = nextProgress;

      if (state.priceDeclDialogOpen === true) {
        schedulePriceDeclSubmitRuntimeRefresh(container);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (state.priceDeclSubmitRuntimeFrame) {
        window.cancelAnimationFrame(state.priceDeclSubmitRuntimeFrame);
        state.priceDeclSubmitRuntimeFrame = 0;
      }
      if (typeof state.removePriceDeclSubmitProgressListener === 'function') {
        state.removePriceDeclSubmitProgressListener();
        state.removePriceDeclSubmitProgressListener = null;
      }
    }, { once: true });
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

  function formatDelayInputValue(value) {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return '';
    }

    return String(Number(numericValue.toFixed(3)));
  }

  async function loadQuerySettings(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.querySettingsLoading === true && state.querySettingsPromise) {
      return state.querySettingsPromise;
    }

    if (options.force !== true && state.querySettingsLoaded === true) {
      return {
        pageDelayMinSeconds: state.filters.pageDelayMinSeconds,
        pageDelayMaxSeconds: state.filters.pageDelayMaxSeconds
      };
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsNewProductLifecycleQuerySettings !== 'function'
    ) {
      state.querySettingsLoaded = true;
      return {
        pageDelayMinSeconds: state.filters.pageDelayMinSeconds,
        pageDelayMaxSeconds: state.filters.pageDelayMaxSeconds
      };
    }

    state.querySettingsLoading = true;
    state.querySettingsPromise = featureCenterApi.getOperationsNewProductLifecycleQuerySettings()
      .then((response) => {
        const nextMinValue = formatDelayInputValue(
          response && response.settings && response.settings.pageDelayMinSeconds
        );
        const nextMaxValue = formatDelayInputValue(
          response && response.settings && response.settings.pageDelayMaxSeconds
        );

        state.filters = {
          ...state.filters,
          pageDelayMinSeconds: nextMinValue,
          pageDelayMaxSeconds: nextMaxValue
        };
        state.querySettingsLoaded = true;
        return {
          pageDelayMinSeconds: nextMinValue,
          pageDelayMaxSeconds: nextMaxValue
        };
      })
      .catch(() => {
        state.querySettingsLoaded = true;
        return {
          pageDelayMinSeconds: state.filters.pageDelayMinSeconds,
          pageDelayMaxSeconds: state.filters.pageDelayMaxSeconds
        };
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
      || typeof featureCenterApi.saveOperationsNewProductLifecycleQuerySettings !== 'function'
    ) {
      return null;
    }

    if (shouldRenderSaving) {
      state.querySettingsSaving = true;
      render(container);
    }

    try {
      const response = await featureCenterApi.saveOperationsNewProductLifecycleQuerySettings({
        pageDelayMinSeconds: state.filters.pageDelayMinSeconds,
        pageDelayMaxSeconds: state.filters.pageDelayMaxSeconds
      });

      state.filters = {
        ...state.filters,
        pageDelayMinSeconds: formatDelayInputValue(
          response && response.settings && response.settings.pageDelayMinSeconds
        ),
        pageDelayMaxSeconds: formatDelayInputValue(
          response && response.settings && response.settings.pageDelayMaxSeconds
        )
      };

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

  function getQueryProgressToneClass(progress) {
    const phase = normalizeText(progress && progress.phase);

    if (phase === 'failed') {
      return 'is-error';
    }

    if (phase === 'canceled') {
      return 'is-warning';
    }

    return 'is-active';
  }

  function formatShopQueryProgressText(progress) {
    const normalizedProgress = normalizeQueryProgressPayload(progress);

    if (!normalizedProgress) {
      return '';
    }

    const shopText = normalizeText(normalizedProgress.shopName) || normalizeText(normalizedProgress.shopId);
    const currentPage = Math.max(1, normalizedProgress.pageNum || 1);
    const totalPages = Math.max(normalizedProgress.totalPages, currentPage);
    const estimatedTotalText = normalizedProgress.estimatedTotal > 0
      ? String(normalizedProgress.estimatedTotal)
      : '--';
    const accumulatedText = String(Math.max(0, normalizedProgress.accumulatedItemCount));
    const pagePrefix = `${shopText}\uff1a\u7b2c ${currentPage}/${totalPages} \u9875`;

    if (normalizedProgress.phase === 'warming-session') {
      return `${shopText}\uff1a${normalizedProgress.message || '\u6b63\u5728\u68c0\u67e5\u767b\u5f55\u4f1a\u8bdd'}`;
    }

    if (normalizedProgress.phase === 'starting') {
      return `${shopText}\uff1a${normalizedProgress.message || '\u5df2\u51c6\u5907\u5f00\u59cb\u67e5\u8be2'}`;
    }

    if (normalizedProgress.phase === 'requesting-page') {
      return `${pagePrefix}\uff0c\u6b63\u5728\u8bf7\u6c42\uff0c\u5df2\u83b7\u53d6 ${accumulatedText}/${estimatedTotalText} \u6761`;
    }

    if (normalizedProgress.phase === 'page-fetched') {
      return `${pagePrefix}\uff0c\u672c\u9875 ${Math.max(0, normalizedProgress.fetchedItemCount)} \u6761\uff0c\u5df2\u83b7\u53d6 ${accumulatedText}/${estimatedTotalText} \u6761`;
    }

    if (normalizedProgress.phase === 'delaying') {
      return `${pagePrefix}\uff0c\u5df2\u83b7\u53d6 ${accumulatedText}/${estimatedTotalText} \u6761\uff0c${formatDelaySeconds(normalizedProgress.delaySeconds)} \u79d2\u540e\u7ee7\u7eed`;
    }

    if (normalizedProgress.phase === 'failed') {
      return `${shopText}\uff1a\u67e5\u8be2\u5931\u8d25\uff0c${normalizedProgress.message || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`;
    }

    if (normalizedProgress.phase === 'canceled') {
      return `${shopText}\uff1a\u67e5\u8be2\u5df2\u505c\u6b62\uff0c\u5df2\u83b7\u53d6 ${accumulatedText}/${estimatedTotalText} \u6761`;
    }

    if (normalizedProgress.phase === 'completed') {
      return `${shopText}\uff1a\u67e5\u8be2\u5b8c\u6210\uff0c\u5171\u83b7\u53d6 ${accumulatedText}/${estimatedTotalText} \u6761`;
    }

    return normalizedProgress.message || '';
  }

  function buildVisibleShopProgressList(state) {
    const progressMap = state && state.queryShopProgressById && typeof state.queryShopProgressById === 'object'
      ? state.queryShopProgressById
      : Object.create(null);
    const selectedShopIds = normalizeSelectedShopIds(
      state && state.appliedFilters && state.appliedFilters.selectedShopIds
    );
    const seenShopIds = new Set();
    const progressList = [];

    selectedShopIds.forEach((shopId) => {
      const progress = progressMap[shopId];

      if (!progress) {
        return;
      }

      seenShopIds.add(shopId);
      progressList.push(progress);
    });

    Object.keys(progressMap).forEach((shopId) => {
      if (seenShopIds.has(shopId)) {
        return;
      }

      progressList.push(progressMap[shopId]);
    });

    return progressList.filter(Boolean);
  }

  function renderQueryProgressMessages(state) {
    const progressList = buildVisibleShopProgressList(state);

    if (progressList.length <= 0) {
      return [];
    }

    const totalShops = Math.max(
      progressList.length,
      normalizeSelectedShopIds(state && state.appliedFilters && state.appliedFilters.selectedShopIds).length,
      normalizeIntegerValue(state && state.queryProgress && state.queryProgress.totalShops, 0)
    );
    let completedShops = 0;
    let failedShops = 0;
    let canceledShops = 0;
    let activeShops = 0;
    let accumulatedItemCount = 0;
    let estimatedTotal = 0;

    progressList.forEach((progress) => {
      const phase = normalizeText(progress && progress.phase);

      if (phase === 'completed') {
        completedShops += 1;
      } else if (phase === 'failed') {
        failedShops += 1;
      } else if (phase === 'canceled') {
        canceledShops += 1;
      } else {
        activeShops += 1;
      }

      accumulatedItemCount += Math.max(0, normalizeIntegerValue(progress && progress.accumulatedItemCount, 0));
      estimatedTotal += Math.max(0, normalizeIntegerValue(progress && progress.estimatedTotal, 0));
    });

    const summaryText = state.queryLoading === true
      ? `\u6b63\u5728\u67e5\u8be2\uff1a\u5171 ${totalShops} \u5bb6\u5e97\u94fa\uff0c\u5df2\u5b8c\u6210 ${completedShops} \u5bb6\uff0c\u8fdb\u884c\u4e2d ${activeShops} \u5bb6\uff0c\u5931\u8d25 ${failedShops} \u5bb6\uff0c\u5df2\u83b7\u53d6 ${accumulatedItemCount}/${estimatedTotal > 0 ? estimatedTotal : '--'} \u6761`
      : `\u672c\u6b21\u67e5\u8be2\uff1a\u5171 ${totalShops} \u5bb6\u5e97\u94fa\uff0c\u5b8c\u6210 ${completedShops} \u5bb6\uff0c\u5931\u8d25 ${failedShops} \u5bb6\uff0c\u505c\u6b62 ${canceledShops} \u5bb6\uff0c\u83b7\u53d6 ${Math.max(0, normalizeIntegerValue(state && state.queryResultMeta && state.queryResultMeta.productCount, 0))} \u4e2a\u5546\u54c1 / ${Math.max(0, normalizeIntegerValue(state && state.queryResultMeta && state.queryResultMeta.rowCount, accumulatedItemCount))} \u4e2aSKU`;
    const detailProgressList = state.queryLoading === true
      ? progressList.filter((progress) => isTerminalQueryProgress(progress) !== true)
      : progressList.filter((progress) => {
        const phase = normalizeText(progress && progress.phase);
        return phase === 'failed' || phase === 'canceled';
      });
    const detailTexts = detailProgressList
      .map((progress) => formatShopQueryProgressText(progress))
      .filter(Boolean);
    const mergedText = detailTexts.length > 0
      ? `${summaryText}\uFF1B${detailTexts.join('\uFF1B')}`
      : summaryText;

    return [{
      tone: 'is-active',
      text: mergedText
    }];
  }

  async function startQuery(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (state.queryLoading === true) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.queryOperationsNewProductLifecycleRows !== 'function'
    ) {
      state.queryError = '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    if (state.shopSelectorLoaded !== true && state.shopSelectorLoading !== true) {
      await loadShopCatalog(container);
    }

    if (state.querySettingsLoaded !== true && state.querySettingsLoading !== true) {
      await loadQuerySettings(container);
    }

    const shopIds = resolveQueryShopIds(state);

    if (shopIds.length <= 0) {
      state.queryError = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u540e\u518d\u67e5\u8be2';
      render(container);
      return null;
    }

    const queryFilters = cloneFiltersForQuery(state.filters);
    const runId = createQueryRunId();

    state.appliedFilters = {
      ...queryFilters,
      costState: normalizeText(state.appliedFilters && state.appliedFilters.costState)
    };
    state.hasQueried = true;
    state.rows = [];
    state.currentPage = 1;
    state.queryRunId = runId;
    state.queryLoading = true;
    state.queryCanceling = false;
    state.queryProgress = normalizeQueryProgressPayload({
      runId,
      phase: 'preparing',
      totalShops: shopIds.length,
      message: `\u5df2\u9009 ${shopIds.length} \u5bb6\u5e97\u94fa\uff0c\u6b63\u5728\u51c6\u5907\u67e5\u8be2`
    });
    state.queryShopProgressById = Object.create(null);
    state.queryError = '';
    state.queryWarning = '';
    state.queryResultMeta = null;
    render(container);

    try {
      const response = await featureCenterApi.queryOperationsNewProductLifecycleRows({
        runId,
        shopIds,
        filters: queryFilters
      });

      state.rows = Array.isArray(response && response.rows) ? response.rows : [];
      state.queryWarning = normalizeText(response && response.warning);
      state.queryResultMeta = {
        runId: normalizeText(response && response.runId) || runId,
        updatedAt: normalizeText(response && response.updatedAt),
        rowCount: Number(response && response.rowCount) || state.rows.length,
        productCount: Number(response && response.productCount) || 0,
        total: Number(response && response.total) || 0,
        totalShops: Number(response && response.totalShops) || shopIds.length,
        completedShops: Number(response && response.completedShops) || 0,
        failedShops: Number(response && response.failedShops) || 0,
        canceledShops: Number(response && response.canceledShops) || 0,
        canceled: response && response.canceled === true
      };
      state.queryRunId = state.queryResultMeta.runId;

      return response;
    } catch (error) {
      state.queryError = normalizeText(error && error.message) || '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u5931\u8d25';
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
      || typeof featureCenterApi.cancelOperationsNewProductLifecycleQuery !== 'function'
    ) {
      state.queryError = '\u505c\u6b62\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    if (state.queryCanceling === true) {
      return null;
    }

    state.queryCanceling = true;
    state.queryProgress = normalizeQueryProgressPayload({
      ...(state.queryProgress || {}),
      runId,
      phase: 'canceling',
      message: '\u6b63\u5728\u505c\u6b62\u67e5\u8be2'
    });
    state.queryError = '';
    state.queryWarning = '\u6b63\u5728\u505c\u6b62\u67e5\u8be2...';
    render(container);

    try {
      return await featureCenterApi.cancelOperationsNewProductLifecycleQuery({
        runId
      });
    } catch (error) {
      state.queryError = normalizeText(error && error.message) || '\u505c\u6b62\u67e5\u8be2\u5931\u8d25';
      return null;
    } finally {
      render(container);
    }
  }

  async function openQuickCostPresetDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const visibleRows = applyLocalFilters(state.rows, state.appliedFilters);
    const baseEntries = buildQuickCostDialogEntries(visibleRows);

    if (baseEntries.length <= 0) {
      state.queryError = '\u8bf7\u5148\u67e5\u8be2\u5e76\u7b5b\u51fa\u9700\u8981\u9884\u8bbe\u6210\u672c\u4ef7\u7684SKU';
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
    render(container);

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsSharedCostSnapshot !== 'function'
    ) {
      state.quickCostDialogLoading = false;
      render(container);
      return;
    }

    try {
      const response = await featureCenterApi.getOperationsSharedCostSnapshot({
        shopIds: normalizeSelectedShopIds(baseEntries.map((entry) => entry.shopId)),
        entries: baseEntries.map((entry) => ({
          shopId: entry.shopId,
          station: entry.station,
          stationLabel: entry.stationLabel,
          category: entry.category,
          spec: entry.spec,
          legacySpec: entry.legacySpec,
          specAliases: Array.isArray(entry.specAliases) ? entry.specAliases.slice() : []
        }))
      });
      const mergedEntries = mergeQuickCostSnapshotEntries(
        baseEntries,
        response && response.entries
      );

      state.quickCostDialogEntries = mergedEntries;
      state.rows = applyQuickCostEntriesToRows(state.rows, response && response.entries);
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

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsSharedCostBatch !== 'function'
    ) {
      state.quickCostDialogError = '\u5171\u4eab\u6210\u672c\u4ef7\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
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
          station: normalizeText(entry && entry.station),
          stationLabel: normalizeText(entry && entry.stationLabel),
          category: normalizeText(entry && entry.category),
          categoryLabel: normalizeText(entry && entry.categoryLabel),
          categoryTrail: normalizeText(entry && entry.categoryTrail),
          spec: normalizeText(entry && entry.spec),
          legacySpec: normalizeText(entry && entry.legacySpec),
          specAliases: buildSpecVariantList('', entry && entry.specAliases, entry && entry.legacySpec),
          costPrice: normalizeQuickCostValue(entry && entry.costPrice)
        }))
        .filter((entry) => buildQuickCostEntryKey(entry.shopId, entry.station, entry.category, entry.spec));
      const response = await featureCenterApi.saveOperationsSharedCostBatch({
        entries: payloadEntries
      });

      state.rows = applyQuickCostEntriesToRows(state.rows, payloadEntries);
      state.quickCostDialogEntries = payloadEntries.map((entry) => ({
        ...entry,
        key: buildQuickCostEntryKey(entry.shopId, entry.station, entry.category, entry.spec),
        legacyKey: buildQuickCostLegacyKey(entry.shopId, entry.spec),
        stationKey: buildQuickCostStationKey(entry.shopId, entry.station, entry.spec),
        categoryKey: buildQuickCostCategoryKey(entry.shopId, entry.category, entry.spec),
        legacySpec: normalizeText(entry && entry.legacySpec),
        specAliases: buildSpecVariantList('', entry && entry.specAliases, entry && entry.legacySpec)
      }));
      state.quickCostDialogWarning = normalizeText(response && response.warning);
      state.quickCostDialogNotice = `\u5df2\u4fdd\u5b58 ${payloadEntries.length} \u9879\u6210\u672c\u9884\u8bbe`;
      state.queryWarning = normalizeText(response && response.warning);
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
    render(container);
  }

  async function openBatchAdjustDialog(container) {
    const state = getState(container);
    const visibleRows = applyLocalFilters(state.rows, state.appliedFilters);
    const baseEntries = buildBatchAdjustDialogEntries(visibleRows);
    const stationOptions = buildBatchAdjustDialogStationOptions(visibleRows);

    if (baseEntries.length <= 0) {
      state.queryError = '\u8bf7\u5148\u67e5\u8be2\u5e76\u7b5b\u51fa\u9700\u8981\u6279\u91cf\u8c03\u4ef7\u7684SKU';
      render(container);
      return;
    }

    state.batchAdjustDialogOpen = true;
    state.batchAdjustDialogLoading = true;
    state.batchAdjustDialogSaving = false;
    state.batchAdjustDialogSubmitting = false;
    state.batchAdjustDialogError = '';
    state.batchAdjustDialogWarning = '';
    state.batchAdjustDialogNotice = '';
    state.batchAdjustDialogEntries = mergeBatchAdjustPresetEntries(baseEntries, []);
    state.batchAdjustDialogRowCount = visibleRows.length;
    state.batchAdjustDialogDirty = false;
    state.batchAdjustDialogPendingSave = false;
    state.batchAdjustDialogPendingClose = false;
    clearBatchAdjustDialogSaveTimer(state);
    state.batchAdjustDialogSavePromise = null;
    state.batchAdjustDialogLastSavedSignature = '';
    state.batchAdjustDialogStationOptions = stationOptions;
    state.batchAdjustDialogStationIds = resolveBatchAdjustDialogSettings(stationOptions, {}).stationIds;
    state.batchAdjustDialogDailyEnabled = true;
    state.batchAdjustDialogActivityEnabled = false;
    state.batchAdjustDialogReasonCode = '';
    state.batchAdjustDialogRemark = '';
    state.batchAdjustDialogDuplicateSubmitWindowDays = '';
    state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount = '';
    state.batchAdjustDialogActivityPriceReduction = '';
    state.batchAdjustDialogDailyProfitFloorMode = 'rate';
    state.batchAdjustDialogDailyProfitFloorValue = '';
    state.batchAdjustDialogActivityProfitFloorMode = 'rate';
    state.batchAdjustDialogActivityProfitFloorValue = '';
    state.batchAdjustPreviewRunId = '';
    state.batchAdjustSubmitRunId = '';
    state.batchAdjustCanceledRunId = '';
    state.batchAdjustSubmitProgress = null;
    state.batchAdjustPreviewProgress = null;
    state.batchAdjustPreviewShopId = '';
    resetBatchAdjustSubmitPreviewState(state);
    render(container);

    const featureApi = window.temuApp && window.temuApp.featureCenter;

    if (
      !featureApi
      || typeof featureApi.getOperationsNewProductLifecycleBatchAdjustPresetSnapshot !== 'function'
    ) {
      state.batchAdjustDialogLoading = false;
      state.batchAdjustDialogWarning = '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return;
    }

    try {
      const response = await featureApi.getOperationsNewProductLifecycleBatchAdjustPresetSnapshot({
        shopIds: resolveQueryShopIds(state),
        entries: buildBatchAdjustPresetPayloadEntries(baseEntries)
      });

      state.batchAdjustDialogEntries = mergeBatchAdjustPresetEntries(
        baseEntries,
        response && Array.isArray(response.entries) ? response.entries : []
      );
      const settingsSource = response && response.settings && typeof response.settings === 'object'
        ? response.settings
        : buildBatchAdjustSettingsPayload(state);
      const dialogSettings = resolveBatchAdjustDialogSettings(
        stationOptions,
        settingsSource
      );
      state.batchAdjustDialogStationOptions = stationOptions;
      state.batchAdjustDialogStationIds = dialogSettings.stationIds;
      state.batchAdjustDialogDailyEnabled = dialogSettings.dailyEnabled;
      state.batchAdjustDialogActivityEnabled = dialogSettings.activityEnabled;
      state.batchAdjustDialogReasonCode = dialogSettings.reasonCode;
      state.batchAdjustDialogRemark = dialogSettings.remark;
      state.batchAdjustDialogDuplicateSubmitWindowDays = dialogSettings.duplicateSubmitWindowDays;
      state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount = dialogSettings.useSuggestedPriceAfterSubmitCount;
      state.batchAdjustDialogActivityPriceReduction = dialogSettings.activityPriceReduction;
      state.batchAdjustDialogDailyProfitFloorMode = dialogSettings.dailyProfitFloorMode;
      state.batchAdjustDialogDailyProfitFloorValue = dialogSettings.dailyProfitFloorValue;
      state.batchAdjustDialogActivityProfitFloorMode = dialogSettings.activityProfitFloorMode;
      state.batchAdjustDialogActivityProfitFloorValue = dialogSettings.activityProfitFloorValue;
      state.batchAdjustDialogWarning = normalizeText(response && response.warning);
    } catch (error) {
      state.batchAdjustDialogError = normalizeBatchAdjustPresetErrorMessage(
        error,
        '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25'
      );
    } finally {
      state.batchAdjustDialogLoading = false;
      syncBatchAdjustDialogPersistSignature(state);
      render(container);
    }
  }

  async function persistBatchAdjustDialog(container, options = {}) {
    const state = getState(container);
    const featureApi = getFeatureCenterApi();
    const reason = normalizeText(options && options.reason) || 'auto';
    const showNotice = options && options.showNotice !== false;
    const shouldRenderSavingState = reason !== 'auto';

    if (
      !featureApi
      || typeof featureApi.saveOperationsNewProductLifecycleBatchAdjustPresetBatch !== 'function'
    ) {
      state.batchAdjustDialogError = '\u6279\u91cf\u8c03\u4ef7\u914d\u7f6e\u4fdd\u5b58\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    if (state.batchAdjustDialogLoading === true) {
      return null;
    }

    if (state.batchAdjustDialogSaving === true) {
      if (reason === 'auto') {
        state.batchAdjustDialogPendingSave = true;
        return null;
      }

      const activeSavePromise = state.batchAdjustDialogSavePromise;

      if (activeSavePromise && typeof activeSavePromise.then === 'function') {
        try {
          await activeSavePromise;
        } catch (_error) {
          // keep the latest save result handling below
        }

        return persistBatchAdjustDialog(container, options);
      }

      return null;
    }

    const payload = buildBatchAdjustDialogPersistPayload(state);
    const signature = buildBatchAdjustDialogPersistSignature(payload);

    if (
      options.force !== true
      && signature === normalizeText(state.batchAdjustDialogLastSavedSignature)
    ) {
      state.batchAdjustDialogDirty = false;
      return {
        skipped: true
      };
    }

    clearBatchAdjustDialogSaveTimer(state);
    state.batchAdjustDialogSaving = true;
    state.batchAdjustDialogError = '';
    state.batchAdjustDialogWarning = '';
    if (showNotice) {
      state.batchAdjustDialogNotice = '';
    }
    if (shouldRenderSavingState) {
      render(container);
    }

    const persistPromise = (async () => {
      try {
        const response = await featureApi.saveOperationsNewProductLifecycleBatchAdjustPresetBatch({
          entries: payload.entries,
          settings: payload.settings
        });

        state.batchAdjustDialogEntries = mergeBatchAdjustPresetEntries(
          state.batchAdjustDialogEntries,
          response && Array.isArray(response.entries) ? response.entries : payload.entries
        );
        const settingsSource = response && response.settings && typeof response.settings === 'object'
          ? response.settings
          : payload.settings;
        const dialogSettings = resolveBatchAdjustDialogSettings(
          state.batchAdjustDialogStationOptions,
          settingsSource
        );
        state.batchAdjustDialogStationIds = dialogSettings.stationIds;
        state.batchAdjustDialogDailyEnabled = dialogSettings.dailyEnabled;
        state.batchAdjustDialogActivityEnabled = dialogSettings.activityEnabled;
        state.batchAdjustDialogReasonCode = dialogSettings.reasonCode;
        state.batchAdjustDialogRemark = dialogSettings.remark;
        state.batchAdjustDialogDuplicateSubmitWindowDays = dialogSettings.duplicateSubmitWindowDays;
        state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount = dialogSettings.useSuggestedPriceAfterSubmitCount;
        state.batchAdjustDialogActivityPriceReduction = dialogSettings.activityPriceReduction;
        state.batchAdjustDialogDailyProfitFloorMode = dialogSettings.dailyProfitFloorMode;
        state.batchAdjustDialogDailyProfitFloorValue = dialogSettings.dailyProfitFloorValue;
        state.batchAdjustDialogActivityProfitFloorMode = dialogSettings.activityProfitFloorMode;
        state.batchAdjustDialogActivityProfitFloorValue = dialogSettings.activityProfitFloorValue;
        state.batchAdjustDialogWarning = normalizeText(response && response.warning);
        syncBatchAdjustDialogPersistSignature(state);

        if (reason === 'auto') {
          state.batchAdjustDialogLastAutoSaveAt = Date.now();
        }

        if (showNotice) {
          state.batchAdjustDialogNotice = reason === 'submit'
            ? '\u63d0\u4ea4\u6279\u91cf\u8c03\u4ef7\u63a5\u53e3\u6682\u672a\u63a5\u5165\uff0c\u5f53\u524d\u8bbe\u7f6e\u5df2\u540c\u6b65'
            : '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u5df2\u540c\u6b65';
        }

        return response;
      } catch (error) {
        state.batchAdjustDialogError = normalizeBatchAdjustPresetErrorMessage(
          error,
          '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u4fdd\u5b58\u5931\u8d25'
        );
        return null;
      } finally {
        state.batchAdjustDialogSaving = false;
        state.batchAdjustDialogSavePromise = null;
        render(container);

        if (state.batchAdjustDialogPendingSave === true) {
          state.batchAdjustDialogPendingSave = false;
          void persistBatchAdjustDialog(container, {
            reason: 'auto',
            showNotice: false
          });
          return;
        }

        if (state.batchAdjustDialogPendingClose === true && !state.batchAdjustDialogError) {
          state.batchAdjustDialogPendingClose = false;
          void closeBatchAdjustDialog(container, {
            persist: false
          });
        }
      }
    })();

    state.batchAdjustDialogSavePromise = persistPromise;
    return persistPromise;
  }

  async function closeBatchAdjustDialog(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const runId = normalizeText(state.batchAdjustSubmitRunId) || normalizeText(state.batchAdjustPreviewRunId);
    const previewBusy = state.batchAdjustSubmitPreviewSaving === true;
    const submitBusy = state.batchAdjustDialogSaving === true || state.batchAdjustDialogSubmitting === true;

    clearBatchAdjustDialogSaveTimer(state);

    if (previewBusy || submitBusy) {
      state.batchAdjustDialogPendingClose = true;

      if (
        runId
        && featureCenterApi
        && typeof featureCenterApi.cancelOperationsNewProductLifecycleBatchAdjust === 'function'
      ) {
        state.batchAdjustDialogNotice = previewBusy
          ? '\u6b63\u5728\u505c\u6b62\u9884\u89c8\u4efb\u52a1\u5e76\u5173\u95ed\u7a97\u53e3'
          : '\u6b63\u5728\u505c\u6b62\u4efb\u52a1\u5e76\u5173\u95ed\u7a97\u53e3';
        state.batchAdjustDialogError = '';
        render(container);

        void (async () => {
          try {
            await featureCenterApi.cancelOperationsNewProductLifecycleBatchAdjust({ runId });
          } catch (error) {
            state.batchAdjustDialogNotice = '';
            state.batchAdjustDialogError = normalizeBatchAdjustSubmitErrorMessage(error, '\u505c\u6b62\u4efb\u52a1\u5931\u8d25');
          } finally {
            render(container);
          }
        })();
      }

      return false;
    }

    if (options.persist !== false && state.batchAdjustDialogDirty === true) {
      const response = await persistBatchAdjustDialog(container, {
        force: true,
        reason: 'close',
        showNotice: false
      });

      if (!response) {
        return false;
      }
    }

    state.batchAdjustDialogOpen = false;
    state.batchAdjustDialogLoading = false;
    state.batchAdjustDialogSaving = false;
    state.batchAdjustDialogSubmitting = false;
    state.batchAdjustDialogError = '';
    state.batchAdjustDialogWarning = '';
    state.batchAdjustDialogNotice = '';
    state.batchAdjustDialogEntries = [];
    state.batchAdjustDialogRowCount = 0;
    state.batchAdjustDialogDirty = false;
    state.batchAdjustDialogPendingSave = false;
    state.batchAdjustDialogPendingClose = false;
    state.batchAdjustDialogSaveTimer = 0;
    state.batchAdjustDialogSavePromise = null;
    if (state.batchAdjustSubmitRuntimeFrame) {
      window.cancelAnimationFrame(state.batchAdjustSubmitRuntimeFrame);
      state.batchAdjustSubmitRuntimeFrame = 0;
    }
    state.batchAdjustDialogLastSavedSignature = '';
    state.batchAdjustDialogLastAutoSaveAt = 0;
    state.batchAdjustDialogStationOptions = [];
    state.batchAdjustDialogStationIds = [];
    state.batchAdjustDialogDailyEnabled = true;
    state.batchAdjustDialogActivityEnabled = false;
    state.batchAdjustDialogReasonCode = '';
    state.batchAdjustDialogRemark = '';
    state.batchAdjustDialogDuplicateSubmitWindowDays = '';
    state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount = '';
    state.batchAdjustDialogActivityPriceReduction = '';
    state.batchAdjustDialogDailyProfitFloorMode = 'rate';
    state.batchAdjustDialogDailyProfitFloorValue = '';
    state.batchAdjustDialogActivityProfitFloorMode = 'rate';
    state.batchAdjustDialogActivityProfitFloorValue = '';
    state.batchAdjustSubmitRunId = '';
    state.batchAdjustSubmitProgress = null;
    state.batchAdjustPreviewShopId = '';
    resetBatchAdjustSubmitPreviewState(state);
    render(container);
    return true;
  }

  async function previewBatchAdjustDialog(container) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();

    if (
      state.batchAdjustDialogSaving === true
      || state.batchAdjustDialogSubmitting === true
      || state.batchAdjustSubmitPreviewSaving === true
    ) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.previewOperationsNewProductLifecycleBatchAdjust !== 'function'
    ) {
      state.batchAdjustDialogError = '\u6279\u91cf\u8c03\u4ef7\u9884\u89c8\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    const previewContext = collectBatchAdjustDialogPreviewContext(state);

    if (previewContext.validationError) {
      state.batchAdjustDialogError = previewContext.validationError;
      state.batchAdjustDialogWarning = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    }

    if (previewContext.evaluatedRows.length <= 0) {
      state.batchAdjustDialogWarning = '\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684SKU\u6570\u636e';
      state.batchAdjustDialogError = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    }

    const runId = createBatchAdjustSubmitRunId();
    const totalPreviewShops = Array.from(new Set(
      previewContext.evaluatedRows.map((row) => normalizeText(row && row.shopId)).filter(Boolean)
    )).length;

    state.batchAdjustSubmitPreviewSaving = true;
    state.batchAdjustPreviewRunId = runId;
    state.batchAdjustCanceledRunId = '';
    state.batchAdjustPreviewProgress = normalizeBatchAdjustSubmitProgressPayload({
      runId,
      phase: 'preparing',
      totalShops: totalPreviewShops,
      completedShops: 0,
      failedShops: 0,
      requestedDailyCount: 0,
      requestedActivityCount: 0,
      skippedRowCount: previewContext.previewSummary.skippedCount,
      message: `\u6b63\u5728\u51c6\u5907\u9884\u89c8 ${totalPreviewShops} \u5bb6\u5e97\u94fa\u7684\u6279\u91cf\u8c03\u4ef7`
    });
    state.batchAdjustDialogError = '';
    state.batchAdjustDialogWarning = '';
    state.batchAdjustDialogNotice = '';
    render(container);

    try {
      const response = await featureCenterApi.previewOperationsNewProductLifecycleBatchAdjust({
        runId,
        settings: previewContext.settingsPayload,
        rows: buildBatchAdjustSubmitRowsPayload(previewContext.evaluatedRows)
      });

      const previewItems = Array.isArray(response && response.previewItems) ? response.previewItems : [];
      const groupedRequests = Array.isArray(response && response.groupedRequests) ? response.groupedRequests : [];
      const previewSummary = response && response.summary
        ? response.summary
        : createDefaultBatchAdjustSubmitPreviewSummary();
      const resultsByShop = Array.isArray(response && response.resultsByShop) ? response.resultsByShop : [];
      const previewMergedItems = mergeBatchAdjustSubmitPreviewRows(
        previewContext.evaluatedRows,
        previewItems
      );
      const previewItemCount = previewItems.length;
      const previewMergedItemCount = previewMergedItems.length;
      const previewRequestToken = normalizeText(response && response.previewRequestToken)
        || normalizeText(response && response.runId)
        || runId;

      console.info('[BatchAdjust] preview response:', {
        runId,
        success: Boolean(response && response.success),
        canceled: Boolean(response && response.canceled),
        previewItemCount,
        previewMergedItemCount,
        groupedRequestCount: groupedRequests.length,
        hasPreviewRequestToken: Boolean(previewRequestToken)
      });

      if (normalizeText(state.batchAdjustCanceledRunId) === runId) {
        state.batchAdjustDialogNotice = '\u5df2\u505c\u6b62\u9884\u89c8\u4efb\u52a1';
        state.batchAdjustDialogError = '';
        state.batchAdjustDialogWarning = '';
        render(container);
        return response || null;
      }

      if ((response && response.canceled === true) || (response && response.success === true) || previewItemCount > 0) {
        const previewDisplayItems = sortBatchAdjustSubmitPreviewItems(
          previewMergedItemCount > 0
            ? previewMergedItems
            : previewItems
        );
        const previewShopSummaries = buildBatchAdjustSubmitPreviewShopSummaries(previewDisplayItems, resultsByShop);

        state.batchAdjustSubmitPreviewOpen = true;
        state.batchAdjustSubmitPreviewItems = previewDisplayItems;
        state.batchAdjustSubmitPreviewResultsByShop = resultsByShop;
        state.batchAdjustSubmitPreviewShopSummaries = previewShopSummaries;
        state.batchAdjustSubmitPreviewGroupedRequests = groupedRequests;
        state.batchAdjustSubmitPreviewRequestToken = previewRequestToken;
        state.batchAdjustSubmitPreviewSummary = previewSummary;
        state.batchAdjustSubmitPreviewResetScroll = true;
        resetBatchAdjustSubmitPreviewVirtualScroll(state);
        if (response && response.canceled === true) {
          state.batchAdjustDialogNotice = previewItems.length > 0
            ? `\u5df2\u505c\u6b62\u4efb\u52a1\uff0c\u5df2\u751f\u6210 ${previewItems.length} \u6761\u9884\u89c8\u7ed3\u679c`
            : '\u5df2\u505c\u6b62\u4efb\u52a1';
        } else {
          state.batchAdjustDialogNotice = groupedRequests.length > 0
            ? `\u9884\u89c8\u5b8c\u6210\uff0c\u65e5\u5e38\u5f85\u63d0\u4ea4 ${Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestedDailyCount, 0))} \u6761\uff0c\u6d3b\u52a8\u5f85\u63d0\u4ea4 ${Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestedActivityCount, 0))} \u6761`
            : '\u9884\u89c8\u5b8c\u6210\uff0c\u4f46\u6682\u65e0\u53ef\u63d0\u4ea4\u9879';
        }
        state.batchAdjustDialogWarning = normalizeText(response && response.warning);
        state.batchAdjustDialogError = '';
      } else {
        state.batchAdjustDialogError = normalizeText(response && response.message) || '\u6279\u91cf\u8c03\u4ef7\u9884\u89c8\u5931\u8d25';
        state.batchAdjustDialogWarning = normalizeText(response && response.warning);
        state.batchAdjustDialogNotice = '';
      }

      render(container);
      return response || null;
    } catch (error) {
      state.batchAdjustSubmitPreviewSaving = false;
      state.batchAdjustPreviewRunId = '';
      state.batchAdjustPreviewProgress = null;
      if (isBatchAdjustCanceledErrorMessage(error)) {
        state.batchAdjustDialogNotice = '\u5df2\u505c\u6b62\u9884\u89c8\u4efb\u52a1';
        state.batchAdjustDialogError = '';
        state.batchAdjustDialogWarning = '';
        render(container);
        return null;
      }

      state.batchAdjustDialogError = normalizeBatchAdjustSubmitErrorMessage(
        error,
        '\u6279\u91cf\u8c03\u4ef7\u9884\u89c8\u5931\u8d25'
      );
      state.batchAdjustDialogWarning = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    } finally {
      state.batchAdjustSubmitPreviewSaving = false;
      state.batchAdjustPreviewRunId = '';

      if (state.batchAdjustDialogPendingClose === true && !state.batchAdjustDialogError) {
        state.batchAdjustDialogPendingClose = false;
        void closeBatchAdjustDialog(container, {
          persist: false
        });
        return;
      }

      render(container);
    }
  }

  async function submitBatchAdjustDialog(container, options = {}) {
    const state = getState(container);
    const featureCenterApi = getFeatureCenterApi();
    const usePreviewRequests = options && options.usePreviewRequests === true;

    if (
      state.batchAdjustDialogSaving === true
      || state.batchAdjustDialogSubmitting === true
      || state.batchAdjustSubmitPreviewSaving === true
    ) {
      return null;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.submitOperationsNewProductLifecycleBatchAdjust !== 'function'
    ) {
      state.batchAdjustDialogError = '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u63a5\u53e3\u672a\u52a0\u8f7d';
      render(container);
      return null;
    }

    const previewContext = collectBatchAdjustDialogPreviewContext(state);

    if (previewContext.validationError) {
      state.batchAdjustDialogError = previewContext.validationError;
      state.batchAdjustDialogWarning = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    }

    if (previewContext.evaluatedRows.length <= 0) {
      state.batchAdjustDialogWarning = '\u5f53\u524d\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684SKU\u6570\u636e';
      state.batchAdjustDialogError = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    }

    const groupedRequests = usePreviewRequests
      ? (Array.isArray(state.batchAdjustSubmitPreviewGroupedRequests)
        ? state.batchAdjustSubmitPreviewGroupedRequests
        : [])
      : [];
    const previewRequestToken = usePreviewRequests
      ? normalizeText(state.batchAdjustSubmitPreviewRequestToken)
      : '';

    if (usePreviewRequests && groupedRequests.length <= 0 && !previewRequestToken) {
      state.batchAdjustDialogError = '\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u9884\u89c8\u6570\u636e\uff0c\u8bf7\u5148\u91cd\u65b0\u9884\u89c8';
      state.batchAdjustDialogWarning = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    }

    const persistResponse = await persistBatchAdjustDialog(container, {
      force: true,
      reason: 'preview',
      showNotice: false
    });

    if (!persistResponse) {
      state.batchAdjustDialogWarning = state.batchAdjustDialogError || '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u540c\u6b65\u5931\u8d25\uff0c\u5df2\u7ee7\u7eed\u4f7f\u7528\u5f53\u524d\u9875\u9762\u8bbe\u7f6e\u751f\u6210\u9884\u89c8';
      state.batchAdjustDialogError = '';
    }

    const runId = createBatchAdjustSubmitRunId();
    const submitPreviewSummary = usePreviewRequests
      ? (state.batchAdjustSubmitPreviewSummary || createDefaultBatchAdjustSubmitPreviewSummary())
      : createDefaultBatchAdjustSubmitPreviewSummary();
    const totalSubmitShops = usePreviewRequests
      ? (Array.from(new Set(
        groupedRequests.map((request) => normalizeText(request && request.shopId)).filter(Boolean)
      )).length || Math.max(0, normalizeIntegerValue(submitPreviewSummary && submitPreviewSummary.totalShops, 0)))
      : Array.from(new Set(
        previewContext.evaluatedRows.map((row) => normalizeText(row && row.shopId)).filter(Boolean)
      )).length;

    state.batchAdjustDialogSubmitting = true;
    state.batchAdjustSubmitRunId = runId;
    state.batchAdjustSubmitProgress = normalizeBatchAdjustSubmitProgressPayload({
      runId,
      phase: 'preparing',
      totalShops: totalSubmitShops,
      completedShops: 0,
      failedShops: 0,
      requestedDailyCount: 0,
      requestedActivityCount: 0,
      successDailyCount: 0,
      successActivityCount: 0,
      failedDailyCount: 0,
      failedActivityCount: 0,
      skippedRowCount: usePreviewRequests
        ? Math.max(0, normalizeIntegerValue(submitPreviewSummary && submitPreviewSummary.skippedRowCount, 0))
        : previewContext.previewSummary.skippedCount,
      message: '\u6b63\u5728\u51c6\u5907\u63d0\u4ea4\u6279\u91cf\u8c03\u4ef7'
    });
    state.batchAdjustDialogError = '';
    state.batchAdjustDialogWarning = '';
    state.batchAdjustDialogNotice = '';
    render(container);

    try {
      const response = await featureCenterApi.submitOperationsNewProductLifecycleBatchAdjust({
        runId,
        settings: previewContext.settingsPayload,
        rows: buildBatchAdjustSubmitRowsPayload(previewContext.evaluatedRows),
        ...(usePreviewRequests ? {
          itemRequests: groupedRequests,
          previewRequestToken
        } : {})
      });

      state.rows = applyBatchAdjustRowUpdates(state.rows, response && response.rowUpdates);
      state.batchAdjustDialogSubmitting = false;
      state.batchAdjustSubmitProgress = normalizeBatchAdjustSubmitProgressPayload({
        ...(state.batchAdjustSubmitProgress || {}),
        ...(response || {}),
        runId,
        phase: response && response.canceled === true
          ? 'canceled'
          : 'completed',
        message: response && response.canceled === true
          ? '\u5df2\u505c\u6b62\u4efb\u52a1'
          : (
            normalizeText(response && response.warning)
              ? '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5b8c\u6210\uff0c\u5b58\u5728\u90e8\u5206\u8df3\u8fc7\u6216\u5931\u8d25\u8bb0\u5f55'
              : '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5b8c\u6210'
          )
      });

      const successDailyCount = Math.max(0, normalizeIntegerValue(response && response.successDailyCount, 0));
      const successActivityCount = Math.max(0, normalizeIntegerValue(response && response.successActivityCount, 0));
      const totalSuccessCount = successDailyCount + successActivityCount;
      const warningText = normalizeText(response && response.warning);
      const noticeParts = [];

      if (successDailyCount > 0) {
        noticeParts.push(`\u65e5\u5e38 ${successDailyCount} \u6761`);
      }

      if (successActivityCount > 0) {
        noticeParts.push(`\u6d3b\u52a8 ${successActivityCount} \u6761`);
      }

      state.batchAdjustDialogNotice = response && response.canceled === true
        ? '\u5df2\u505c\u6b62\u4efb\u52a1'
        : (noticeParts.length > 0
          ? `\u5df2\u63d0\u4ea4\u6279\u91cf\u8c03\u4ef7\uff1a${noticeParts.join('\uff0c')}`
          : '');
      state.batchAdjustDialogWarning = warningText;

      if (response && response.canceled === true) {
        state.batchAdjustDialogError = '';
      } else if (totalSuccessCount <= 0) {
        state.batchAdjustDialogError = warningText || '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25';
        state.batchAdjustDialogNotice = '';
      } else if (usePreviewRequests) {
        resetBatchAdjustSubmitPreviewState(state);
      }

      render(container);
      return response;
    } catch (error) {
      state.batchAdjustDialogSubmitting = false;
      state.batchAdjustDialogError = normalizeBatchAdjustSubmitErrorMessage(
        error,
        '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u5931\u8d25'
      );
      state.batchAdjustDialogWarning = '';
      state.batchAdjustDialogNotice = '';
      render(container);
      return null;
    } finally {
      if (state.batchAdjustDialogPendingClose === true && !state.batchAdjustDialogError) {
        state.batchAdjustDialogPendingClose = false;
        void closeBatchAdjustDialog(container, {
          persist: false
        });
      }
    }
  }

  function renderOptions(options, selectedValue, placeholder, config = {}) {
    const normalizedSelectedValue = normalizeText(selectedValue);
    const includeEmpty = config.includeEmpty !== false;
    const emptyLabel = placeholder || '\u8bf7\u9009\u62e9';
    const optionItems = [];

    if (includeEmpty) {
      optionItems.push(
        `<option value=""${normalizedSelectedValue ? '' : ' selected'}>${escapeHtml(emptyLabel)}</option>`
      );
    }

    (Array.isArray(options) ? options : []).forEach((option) => {
      optionItems.push(
        `<option value="${escapeHtml(option.value)}"${normalizeText(option.value) === normalizedSelectedValue ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
      );
    });

    return optionItems.join('');
  }

  async function loadShopCatalog(container, options = {}) {
    const state = getState(container);
    const control = getShopMultiSelectControl();

    if (!control || typeof control.loadShopCatalog !== 'function') {
      state.shopSelectorLoaded = true;
      state.shopSelectorLoading = false;
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
        state.filters.selectedShopIds = normalizeSelectedShopIds(state.filters.selectedShopIds)
          .filter((shopId) => Boolean(state.shopCatalog.shopMap && state.shopCatalog.shopMap[shopId]));
        state.appliedFilters.selectedShopIds = normalizeSelectedShopIds(state.appliedFilters.selectedShopIds)
          .filter((shopId) => Boolean(state.shopCatalog.shopMap && state.shopCatalog.shopMap[shopId]));
        state.shopSelectorLoaded = true;
        state.shopSelectorError = '';
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
    state.currentPage = 1;
    void saveShopSelectionLast(container, nextSelectedShopIds);
    rerenderShopSelectorField(container);
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
        title: '\u4e00\u7ea7\u7c7b\u76ee',
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

  function syncCategoryFiltersFromCheckedPaths(state) {
    const checkedPaths = normalizeCategoryCheckedPaths(state.categoryCheckedPaths);

    state.categoryCheckedPaths = checkedPaths;
    state.filters.categorySelections = checkedPaths.map((path) => ({
      categoryId: normalizeText(path[path.length - 1] && path[path.length - 1].id),
      categoryTrail: path.map((item) => normalizeText(item.label)).filter(Boolean).join(' / '),
      categoryPathLabels: path.map((item) => normalizeText(item.label)).filter(Boolean),
      categoryPathIds: path.map((item) => normalizeText(item.id)).filter(Boolean)
    }));
    state.filters.category = '';
    state.filters.categoryTrail = '';
    state.filters.categoryPathLabels = [];
  }

  function setCheckedCategoryPaths(state, paths) {
    state.categoryCheckedPaths = normalizeCategoryCheckedPaths(paths);
    syncCategoryFiltersFromCheckedPaths(state);
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

  function clearCategoryChildRuntime(state) {
    state.categoryColumns = [];
    state.categoryChildCache = Object.create(null);
    state.categoryChildLoadingKey = '';
    state.categoryChildErrorKey = '';
    state.categoryChildError = '';
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
      await loadCategorySnapshot(container, {
        autoSync: false
      });
    }

    const pathKey = buildCategoryPathKey(searchResult.path);
    const alreadyChecked = normalizeCategoryCheckedPaths(state.categoryCheckedPaths)
      .some((item) => buildCategoryPathKey(item) === pathKey);

    setSelectedCategoryPath(state, searchResult.path);
    toggleCheckedCategoryPath(state, searchResult.path, alreadyChecked !== true);
    state.currentPage = 1;
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
      <label class="ops-npl-field ops-npl-field-shop" data-npl-shop-selector-field="true">
        <span class="ops-npl-field-label">\u5e97\u94fa</span>
        <span class="ops-npl-field-content">
          ${fieldMarkup}
          ${state.shopSelectorError ? `<span class="ops-npl-filter-note is-error">${escapeHtml(state.shopSelectorError)}</span>` : ''}
        </span>
      </label>
    `;
  }

  function captureShopSelectorUiState(container) {
    if (!(container instanceof HTMLElement)) {
      return {};
    }

    const searchInput = container.querySelector('[data-shop-multi-select-search]');

    return {
      panel: readElementScrollPosition(container.querySelector('[data-shop-multi-select-panel]')),
      sectionList: readElementScrollPosition(container.querySelector('.shop-multi-select-section-list')),
      searchHadFocus: searchInput instanceof HTMLInputElement && document.activeElement === searchInput,
      searchSelectionStart: searchInput instanceof HTMLInputElement ? searchInput.selectionStart : null,
      searchSelectionEnd: searchInput instanceof HTMLInputElement ? searchInput.selectionEnd : null
    };
  }

  function restoreShopSelectorUiState(container, uiState, options = {}) {
    if (!(container instanceof HTMLElement) || !uiState) {
      return;
    }

    restoreElementScrollPosition(
      container.querySelector('[data-shop-multi-select-panel]'),
      uiState.panel
    );
    restoreElementScrollPosition(
      container.querySelector('.shop-multi-select-section-list'),
      uiState.sectionList
    );

    if (options.focusSearch !== true && uiState.searchHadFocus !== true) {
      return;
    }

    const searchInput = container.querySelector('[data-shop-multi-select-search]');

    if (!(searchInput instanceof HTMLInputElement)) {
      return;
    }

    searchInput.focus();

    try {
      const selectionStart = Number.isInteger(uiState.searchSelectionStart)
        ? uiState.searchSelectionStart
        : searchInput.value.length;
      const selectionEnd = Number.isInteger(uiState.searchSelectionEnd)
        ? uiState.searchSelectionEnd
        : selectionStart;
      searchInput.setSelectionRange(selectionStart, selectionEnd);
    } catch (_error) {
      // Ignore selection sync failures.
    }
  }

  function rerenderShopSelectorField(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const state = getState(container);
    const field = container.querySelector('[data-npl-shop-selector-field="true"]');

    if (!(field instanceof HTMLElement)) {
      render(container);
      return;
    }

    const uiState = captureShopSelectorUiState(container);
    field.outerHTML = renderShopSelectorField(state);
    restoreShopSelectorUiState(container, uiState, options);
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
      <div class="ops-npl-field ops-npl-field-station" data-npl-station-select>
        <span class="ops-npl-field-label">\u7ad9\u70b9</span>
        <div class="ops-npl-field-content">
          <div class="ops-npl-station-select">
            <button
              class="ops-npl-station-trigger${state.stationSelectorOpen === true ? ' is-open' : ''}"
              type="button"
              data-npl-station-toggle="true"
            >
              <span>${escapeHtml(renderSelectedStationText(selectedStationIds))}</span>
              <span class="ops-npl-station-arrow" aria-hidden="true">\u25be</span>
            </button>
            ${state.stationSelectorOpen === true ? `
              <div class="ops-npl-station-panel">
                <div class="ops-npl-station-toolbar">
                  <button class="ops-npl-station-action" type="button" data-npl-station-action="select-us">\u7f8e\u56fd\u7ad9</button>
                  <button class="ops-npl-station-action" type="button" data-npl-station-action="clear">\u6e05\u7a7a</button>
                  <span class="ops-npl-station-count">\u5df2\u9009 ${escapeHtml(String(selectedStationIds.length))}</span>
                </div>
                <div class="ops-npl-station-list">
                  ${stationOptions.map((option) => `              
                    <label class="ops-npl-station-item">
                      <input
                        type="checkbox"
                        data-npl-station-option="${escapeHtml(option.value)}"
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
      </div>
    `;
  }

  function renderSelectedOptionText(selectedValues, options, placeholder, unitLabel) {
    const normalizedValues = normalizeSelectedOptionValues(selectedValues);
    const optionMap = new Map(
      (Array.isArray(options) ? options : [])
        .map((option) => [normalizeText(option && option.value), normalizeText(option && option.label)])
    );

    if (normalizedValues.length <= 0) {
      return placeholder || '\u8bf7\u9009\u62e9';
    }

    if (normalizedValues.length === 1) {
      return optionMap.get(normalizedValues[0]) || normalizedValues[0];
    }

    return `\u5df2\u9009 ${normalizedValues.length} ${unitLabel || '\u9879'}`;
  }

  function renderMultiSelectDropdown(config) {
    const fieldName = normalizeText(config && config.fieldName);
    const options = Array.isArray(config && config.options) ? config.options : [];
    const selectedValues = normalizeSelectedOptionValues(config && config.selectedValues);
    const selectedValueSet = new Set(selectedValues);
    const placeholder = normalizeText(config && config.placeholder) || '\u8bf7\u9009\u62e9';
    const unitLabel = normalizeText(config && config.unitLabel) || '\u9879';
    const open = config && config.open === true;

    if (!fieldName) {
      return '';
    }

    return `
      <div class="ops-npl-multi-select" data-npl-multi-select="${escapeHtml(fieldName)}">
        <button
          class="ops-npl-multi-trigger${open ? ' is-open' : ''}"
          type="button"
          data-npl-multi-toggle="${escapeHtml(fieldName)}"
        >
          <span>${escapeHtml(renderSelectedOptionText(selectedValues, options, placeholder, unitLabel))}</span>
          <span class="ops-npl-multi-arrow" aria-hidden="true">\u25be</span>
        </button>
        ${open ? `
          <div class="ops-npl-multi-panel">
            <div class="ops-npl-multi-toolbar">
              <button
                class="ops-npl-multi-action"
                type="button"
                data-npl-multi-action="clear"
                data-npl-multi-field="${escapeHtml(fieldName)}"
                ${selectedValues.length <= 0 ? 'disabled' : ''}
              >
                \u6e05\u7a7a
              </button>
              <span class="ops-npl-multi-count">\u5df2\u9009 ${escapeHtml(String(selectedValues.length))}</span>
            </div>
            <div class="ops-npl-multi-list">
              ${options.map((option) => `
                <label class="ops-npl-multi-item">
                  <input
                    type="checkbox"
                    value="${escapeHtml(option.value)}"
                    data-npl-multi-option="${escapeHtml(fieldName)}"
                    ${selectedValueSet.has(normalizeText(option.value)) ? ' checked' : ''}
                  />
                  <span>${escapeHtml(option.label)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderAdLevelSelectorField(state, stationOptions) {
    const filters = cloneFilters(state && state.filters);

    return `
      <label class="ops-npl-field ops-npl-field-ad-level">
        <span class="ops-npl-field-label">\u5e7f\u544a\u7b49\u7ea7</span>
        <span class="ops-npl-field-content ops-npl-ad-level-control">
          <select class="ops-npl-control" data-npl-filter="adStation">
            ${renderOptions(stationOptions, filters.adStation, '\u8bf7\u9009\u62e9\u7ad9\u70b9')}
          </select>
          ${renderMultiSelectDropdown({
            fieldName: 'adLevels',
            options: AD_LEVEL_OPTIONS,
            selectedValues: filters.adLevels,
            open: state.multiSelectorOpen === 'adLevels',
            placeholder: '\u8bf7\u9009\u62e9',
            unitLabel: '\u4e2a\u7b49\u7ea7'
          })}
        </span>
      </label>
    `;
  }

  function renderDeletedSelectorField(state) {
    const filters = cloneFilters(state && state.filters);

    return `
      <label class="ops-npl-field ops-npl-field-deleted">
        <span class="ops-npl-field-label">\u662f\u5426\u5df2\u5220\u9664</span>
        <span class="ops-npl-field-content">
          <select class="ops-npl-control" data-npl-filter="deletedState">
            ${renderOptions(DELETED_STATE_OPTIONS, filters.deletedState, '\u8bf7\u9009\u62e9')}
          </select>
        </span>
      </label>
    `;
  }

  function renderTrafficSelectorField(state) {
    const filters = cloneFilters(state && state.filters);

    return `
      <label class="ops-npl-field ops-npl-field-traffic">
        <span class="ops-npl-field-label">\u5546\u54c1\u6d41\u91cf\u60c5\u51b5</span>
        <span class="ops-npl-field-content">
          ${renderMultiSelectDropdown({
            fieldName: 'trafficStates',
            options: TRAFFIC_STATE_OPTIONS,
            selectedValues: filters.trafficStates,
            open: state.multiSelectorOpen === 'trafficStates',
            placeholder: '\u8bf7\u9009\u62e9',
            unitLabel: '\u9879'
          })}
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
      <label class="ops-npl-field ops-npl-field-category">
        <span class="ops-npl-field-label">\u7c7b\u76ee</span>
        <span class="ops-npl-field-content">
          ${fieldMarkup}
        </span>
      </label>
    `;
  }

  function renderFilterCard(state) {
    const filters = cloneFilters(state && state.filters);
    const stationOptions = getStationOptions();

    return `
      <section class="ops-npl-filter-card">
        <div class="ops-npl-filter-grid">
          ${renderShopSelectorField(state)}

          ${renderStationSelectorField(state)}

          ${renderCategorySelectorField(state)}

          ${renderAdLevelSelectorField(state, stationOptions)}

          <label class="ops-npl-field ops-npl-field-product-name">
            <span class="ops-npl-field-label">\u5546\u54c1\u540d\u79f0</span>
            <span class="ops-npl-field-content">
              <input
                class="ops-npl-control"
                type="text"
                value="${escapeHtml(filters.productName)}"
                placeholder="\u8bf7\u8f93\u5165"
                data-npl-filter="productName"
              />
            </span>
          </label>

          <label class="ops-npl-field ops-npl-field-product-id">
            <span class="ops-npl-field-label">\u5546\u54c1ID\u67e5\u8be2</span>
            <span class="ops-npl-field-content ops-npl-combo-control is-keyword">
              <select class="ops-npl-control" data-npl-filter="productIdType">
                ${renderOptions(PRODUCT_ID_TYPE_OPTIONS, filters.productIdType, '', {
                  includeEmpty: false
                })}
              </select>
              <input
                class="ops-npl-control"
                type="text"
                value="${escapeHtml(filters.productIdKeywords)}"
                placeholder="\u591a\u4e2a\u67e5\u8be2\u8bf7\u7a7a\u683c\u6216\u9017\u53f7\u4f9d\u6b21\u8f93\u5165"
                data-npl-filter="productIdKeywords"
              />
            </span>
          </label>

          <label class="ops-npl-field ops-npl-field-goods-no">
            <span class="ops-npl-field-label">\u8d27\u53f7</span>
            <span class="ops-npl-field-content ops-npl-combo-control is-keyword">
              <select class="ops-npl-control" data-npl-filter="goodsNoType">
                ${renderOptions(GOODS_NO_TYPE_OPTIONS, filters.goodsNoType, '', {
                  includeEmpty: false
                })}
              </select>
              <input
                class="ops-npl-control"
                type="text"
                value="${escapeHtml(filters.goodsNoKeywords)}"
                placeholder="\u591a\u4e2a\u8d27\u53f7\u4ee5\u7a7a\u683c\uff0c\u9017\u53f7\u5206\u9694"
                data-npl-filter="goodsNoKeywords"
              />
            </span>
          </label>

          ${renderDeletedSelectorField(state)}

          ${renderTrafficSelectorField(state)}

          <label class="ops-npl-field ops-npl-field-time">
            <span class="ops-npl-field-label">\u65f6\u95f4\u8303\u56f4</span>
            <span class="ops-npl-field-content ops-npl-time-control">
              <select class="ops-npl-control" data-npl-filter="timeField">
                ${renderOptions(TIME_FIELD_OPTIONS, filters.timeField, '', {
                  includeEmpty: false
                })}
              </select>
              <input
                class="ops-npl-control"
                type="date"
                value="${escapeHtml(filters.startTime)}"
                data-npl-filter="startTime"
              />
              <span class="ops-npl-time-separator">~</span>
              <input
                class="ops-npl-control"
                type="date"
                value="${escapeHtml(filters.endTime)}"
                data-npl-filter="endTime"
              />
            </span>
          </label>

          <label class="ops-npl-field ops-npl-field-product-source">
            <span class="ops-npl-field-label">\u5546\u54C1\u6765\u6E90</span>
            <span class="ops-npl-field-content">
              <select class="ops-npl-control" data-npl-filter="productSource">
                ${renderOptions(PRODUCT_SOURCE_OPTIONS, filters.productSource, '', {
                  includeEmpty: false
                })}
              </select>
            </span>
          </label>

          <label class="ops-npl-field ops-npl-field-page-delay">
            <span class="ops-npl-field-label">\u968f\u673a\u5ef6\u65f6</span>
            <span class="ops-npl-field-content ops-npl-delay-control">
              <input
                class="ops-npl-control"
                type="number"
                min="0"
                step="0.1"
                value="${escapeHtml(filters.pageDelayMinSeconds)}"
                placeholder="\u6700\u5c0f"
                data-npl-filter="pageDelayMinSeconds"
              />
              <span class="ops-npl-time-separator">~</span>
              <input
                class="ops-npl-control"
                type="number"
                min="0"
                step="0.1"
                value="${escapeHtml(filters.pageDelayMaxSeconds)}"
                placeholder="\u6700\u5927"
                data-npl-filter="pageDelayMaxSeconds"
              />
              <span class="ops-npl-delay-unit">\u79d2</span>
            </span>
          </label>

          <div class="ops-npl-actions">
            <button
              class="ops-npl-action-button is-primary"
              type="button"
              data-npl-action="search"
              ${state.queryLoading === true ? ' disabled' : ''}
            >
              ${state.queryLoading === true ? '\u67e5\u8be2\u4e2d...' : '\u67e5\u8be2'}
            </button>
            <button
              class="ops-npl-action-button is-danger"
              type="button"
              data-npl-action="stop"
              ${state.queryLoading === true ? '' : ' hidden'}
              ${state.queryCanceling === true ? ' disabled' : ''}
            >
              ${state.queryCanceling === true ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u67e5\u8be2'}
            </button>
            <button
              class="ops-npl-action-button is-secondary"
              type="button"
              data-npl-action="reset"
              ${state.queryLoading === true ? ' disabled' : ''}
            >
              \u91cd\u7f6e
            </button>
          </div>
        </div>
      </section>
    `;
  }

  function renderStatusBadgeByStatus(status) {
    const statusEntry = STATUS_META[normalizeProductStatus(status)] || STATUS_META.unpublished;
    return `<span class="ops-pm-status-badge is-${escapeHtml(statusEntry.tone)}">${escapeHtml(statusEntry.label)}</span>`;
  }

  function resolveProductSourceLabel(status) {
    const normalizedStatus = normalizeProductStatus(status);
    return normalizeText(PRODUCT_SOURCE_LABEL_MAP[normalizedStatus])
      || normalizeText(STATUS_META[normalizedStatus] && STATUS_META[normalizedStatus].label)
      || '--';
  }

  function resolveProductSourceSummary(statusList) {
    const labels = Array.from(new Set(
      (Array.isArray(statusList) ? statusList : [statusList])
        .map((status) => resolveProductSourceLabel(status))
        .map((label) => normalizeText(label))
        .filter((label) => label && label !== '--')
    ));

    return labels.length > 0 ? labels.join(' / ') : '--';
  }

  function renderStatusBadge(label, tone = 'slate') {
    const normalizedLabel = normalizeText(label);
    const normalizedTone = normalizeText(tone) || 'slate';

    if (!normalizedLabel) {
      return '';
    }

    return `<span class="ops-pm-status-badge is-${escapeHtml(normalizedTone)}">${escapeHtml(normalizedLabel)}</span>`;
  }

  function buildProductGroups(rows) {
    const groupMap = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const groupId = [
        normalizeText(row && row.shopId),
        normalizeText(row && row.productId),
        normalizeText(row && row.skcId)
      ].filter(Boolean).join(':') || normalizeText(row && row.id);

      if (!groupId) {
        return;
      }

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          productRow: row,
          skuRows: [],
          statusList: []
        });
      }

      const group = groupMap.get(groupId);

      group.skuRows.push(row);

      if (!group.productRow || normalizeText(group.productRow && group.productTitle).length <= 0) {
        group.productRow = row;
      }
    });

    return Array.from(groupMap.values()).map((group) => {
      const statusList = Array.from(new Set(
        (Array.isArray(group && group.skuRows) ? group.skuRows : [])
          .map((row) => normalizeProductStatus(row && row.status))
          .filter(Boolean)
      )).sort((left, right) => {
        const leftIndex = STATUS_DISPLAY_ORDER.indexOf(left);
        const rightIndex = STATUS_DISPLAY_ORDER.indexOf(right);
        const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : STATUS_DISPLAY_ORDER.length;
        const normalizedRightIndex = rightIndex >= 0 ? rightIndex : STATUS_DISPLAY_ORDER.length;

        return normalizedLeftIndex - normalizedRightIndex;
      });

      return {
        ...group,
        statusList
      };
    });
  }

  function resolveSkuStatusMeta(row) {
    const normalizedRowStatus = normalizeProductStatus(row && row.status);
    const numericPriceReviewStatus = normalizeIntegerValue(row && row.priceReviewStatus, -1);

    if (normalizedRowStatus === 'terminated') {
      return { label: '\u5df2\u7ec8\u6b62', tone: 'slate' };
    }

    if (numericPriceReviewStatus === 3 || normalizedRowStatus === 'priceInvalid') {
      return { label: '\u5df2\u4f5c\u5e9f', tone: 'red' };
    }

    if (numericPriceReviewStatus === 2 || normalizedRowStatus === 'published' || normalizedRowStatus === 'offline') {
      return { label: '\u5df2\u751f\u6548', tone: 'green' };
    }

    if (
      normalizedRowStatus === 'pricePending'
      || normalizedRowStatus === 'pricePendingSellerConfirm'
      || numericPriceReviewStatus === 0
      || numericPriceReviewStatus === 1
    ) {
      return { label: '\u5ba1\u6838\u4e2d', tone: 'blue' };
    }

    return { label: '\u5f85\u786e\u8ba4', tone: 'slate' };
  }

  function buildRowHandlingTexts(row) {
    const normalizedRowStatus = normalizeProductStatus(row && row.status);
    const numericPriceReviewStatus = normalizeIntegerValue(row && row.priceReviewStatus, -1);
    const declaredPrice = normalizeDecimalValue(row && row.declaredPrice, 0);
    const suggestedDeclaredPrice = normalizeDecimalValue(row && row.suggestedDeclaredPrice, 0);
    const suggestedActivityDeclaredPrice = normalizeDecimalValue(row && row.suggestedActivityDeclaredPrice, 0);
    const suggestedDeclaredPriceText = formatMoney(suggestedDeclaredPrice);
    const suggestedActivityDeclaredPriceText = formatMoney(suggestedActivityDeclaredPrice);
    const declaredPriceText = formatMoney(row && row.declaredPrice);
    const handlingTexts = [];

    if (normalizedRowStatus === 'terminated') {
      return ['\u5f53\u524dSKU\u5df2\u7ec8\u6b62'];
    }

    if (suggestedDeclaredPrice > declaredPrice && declaredPrice > 0) {
      handlingTexts.push('\u5efa\u8bae\u65e5\u5e38\u4ef7\u9ad8\u4e8e\u7533\u62a5\u4ef7\uff0c\u9ed8\u8ba4\u6309\u7533\u62a5\u4ef7\u51cf0.01');
    }

    if (suggestedDeclaredPrice > 0) {
      handlingTexts.push(`\u5e73\u53f0\u5efa\u8bae\u65e5\u5e38\u4ef7${suggestedDeclaredPriceText}\u5143`);
    }

    if (suggestedActivityDeclaredPrice > 0) {
      handlingTexts.push(`\u5e73\u53f0\u5efa\u8bae\u6d3b\u52a8\u4ef7${suggestedActivityDeclaredPriceText}\u5143`);
    }

    if (handlingTexts.length > 0) {
      return handlingTexts;
    }

    if (numericPriceReviewStatus === 3 || normalizedRowStatus === 'priceInvalid') {
      return [`\u65e5\u5e38\u7533\u62a5\u4ef7\u8c03\u6574\u4e3a${declaredPriceText}\u5143`];
    }

    if (numericPriceReviewStatus === 2 || normalizedRowStatus === 'published' || normalizedRowStatus === 'offline') {
      return ['\u5f53\u524dSKU\u7533\u62a5\u4ef7\u5df2\u751f\u6548'];
    }

    if (normalizedRowStatus === 'unpublished') {
      return ['\u5f53\u524dSKU\u672a\u53d1\u5e03\u5230\u7ad9\u70b9'];
    }

    if (normalizedRowStatus === 'pricePending') {
      return ['\u7b49\u5f85\u5e73\u53f0\u5ba1\u6838\u5f53\u524d\u7533\u62a5\u4ef7'];
    }

    if (normalizedRowStatus === 'pricePendingSellerConfirm') {
      return ['\u7b49\u5f85\u5356\u5bb6\u786e\u8ba4\u6838\u4ef7\u7ed3\u679c'];
    }

    return ['\u5f85\u5e73\u53f0\u786e\u8ba4'];
  }

  function renderCompositeStatusCell(row) {
    const skuStatusMeta = resolveSkuStatusMeta(row);
    const handlingTexts = buildRowHandlingTexts(row);

    return `
      <div class="ops-pm-status-cell">
        <div class="ops-pm-status-section">
          <span class="ops-pm-status-caption">SKU\u72b6\u6001</span>
          <div class="ops-pm-status-badges">
            ${renderStatusBadge(skuStatusMeta.label, skuStatusMeta.tone)}
          </div>
        </div>
        <div class="ops-pm-status-section">
          <span class="ops-pm-status-caption">\u5904\u7406\u65b9\u5f0f</span>
          <div class="ops-pm-handling-text">${handlingTexts.map((text) => {
            return `<div>${escapeHtml(text)}</div>`;
          }).join('')}</div>
        </div>
      </div>
    `;
  }

  function renderThumb(imageUrl, fallbackText, className, previewTitle) {
    const normalizedImageUrl = normalizeText(imageUrl);
    const normalizedFallbackText = normalizeText(fallbackText) || 'SP';

    if (normalizedImageUrl) {
      const thumbUrl = buildSizedImageUrl(normalizedImageUrl, PRODUCT_THUMBNAIL_SIZE) || normalizedImageUrl;
      const normalizedPreview = normalizeImagePreview({
        sourceUrl: normalizedImageUrl,
        title: normalizeText(previewTitle) || normalizedFallbackText
      });

      return `
        <button
          class="ops-pm-thumb-trigger"
          type="button"
          data-image-preview-open="true"
          data-preview-image="${escapeHtml(normalizedPreview && normalizedPreview.sourceUrl)}"
          data-preview-title="${escapeHtml(normalizedPreview && normalizedPreview.title)}"
          aria-label="\u9884\u89c8\u5927\u56fe"
        >
          <div class="${escapeHtml(className)} is-image" style="--thumb-accent:#315d9b;">
            <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(normalizedPreview && normalizedPreview.title)}" loading="lazy" />
          </div>
        </button>
      `;
    }

    return `
      <div class="${escapeHtml(className)}" style="--thumb-accent:#315d9b;">
        ${escapeHtml(normalizedFallbackText.slice(0, 2).toUpperCase())}
      </div>
    `;
  }

  function renderProductInfoCell(row) {
    const productMeta = [
      normalizeText(row && row.shopName),
      normalizeText(row && row.productId) ? `ID:${normalizeText(row && row.productId)}` : '',
      `\u5546\u54c1\u6765\u6e90: ${resolveProductSourceLabel(row && row.status)}`,
      normalizeText(row && row.categoryTrail)
    ].filter(Boolean);

    return `
      <div class="ops-pm-product-card">
        ${renderThumb(row && row.productImageUrl, row && row.productTitle, 'ops-pm-product-thumb')}
        <div class="ops-pm-product-copy">
          <p class="ops-pm-product-title">${escapeHtml(normalizeText(row && row.productTitle) || '--')}</p>
          <div class="ops-pm-product-meta">
            ${productMeta.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
          <div class="ops-pm-product-foot">
            ${renderStatusBadgeByStatus(row && row.status)}
          </div>
        </div>
      </div>
    `;
  }

  function renderSkuImageCell(row) {
    return renderThumb(row && row.skuImageUrl, row && row.skuCode, 'ops-pm-mini-thumb');
  }

  function renderLifecycleProductGroup(group, productIndex) {
    const productRow = group && group.productRow ? group.productRow : null;
    const skuRows = Array.isArray(group && group.skuRows) ? group.skuRows : [];
    const statusBadges = (Array.isArray(group && group.statusList) ? group.statusList : [])
      .map((status) => renderStatusBadgeByStatus(status))
      .join('');
    const productSourceText = resolveProductSourceSummary(
      Array.isArray(group && group.statusList) && group.statusList.length > 0
        ? group.statusList
        : [productRow && productRow.status]
    );
    const productPreviewTitle = normalizeText(productRow && productRow.productTitle) || '\u5546\u54c1\u4e3b\u56fe';

    if (!productRow || skuRows.length <= 0) {
      return '';
    }

    return skuRows.map((row, index) => {
      const profitRate = computeProfitRate(row);
      const costPriceText = hasCostPriceConfigured(row)
        ? `${formatMoney(row && row.costPrice)}\u5143`
        : '--';
      const declaredPriceText = Number(row && row.declaredPrice) > 0
        ? `${formatMoney(row && row.declaredPrice)}\u5143`
        : '--';
      const updatedAtText = formatDateTimeLabel(
        normalizeText(row && row.productUpdatedAt)
        || normalizeText(row && row.priceConfirmedAt)
        || normalizeText(row && row.createdAt)
      );
      const skuPreviewTitle = [
        normalizeText(row && row.skuId),
        normalizeText(row && row.spec)
      ].filter(Boolean).join(' / ') || '\u5546\u54c1SKU\u56fe';

      return `
        <tr class="ops-pm-sku-row">
          ${index === 0 ? `
            <td class="ops-pm-nowrap ops-npl-index-cell" rowspan="${skuRows.length}">
              ${escapeHtml(String(productIndex))}
            </td>
            <td class="ops-pm-cell-product" rowspan="${skuRows.length}">
              <div class="ops-pm-product-card">
                ${renderThumb(productRow && productRow.productImageUrl, productRow && productRow.productTitle, 'ops-pm-product-thumb', productPreviewTitle)}
                <div class="ops-pm-product-copy">
                  <p class="ops-pm-product-title">${escapeHtml(normalizeText(productRow && productRow.productTitle) || '--')}</p>
                  <div class="ops-pm-product-meta">
                    <span>SPU ID: ${escapeHtml(normalizeText(productRow && productRow.productId) || '--')}</span>
                    <span>SKC ID: ${escapeHtml(normalizeText(productRow && productRow.skcId) || '--')}</span>
                    <span>SKC\u8d27\u53f7: ${escapeHtml(normalizeText(productRow && productRow.skcCode) || '--')}</span>
                    <span>\u5e97\u94fa: ${escapeHtml(normalizeText(productRow && productRow.shopName) || '--')}</span>
                    ${normalizeText(productRow && productRow.shopGroupName)
                      ? `<span>\u5206\u7ec4: ${escapeHtml(normalizeText(productRow && productRow.shopGroupName))}</span>`
                      : ''}
                    <span>\u7ad9\u70b9: ${escapeHtml(normalizeText(productRow && productRow.stationLabel) || normalizeText(productRow && productRow.station) || '--')}</span>
                    <span>\u5546\u54c1\u6765\u6e90: ${escapeHtml(productSourceText)}</span>
                    <span>SKU\u6570: ${escapeHtml(String(skuRows.length))}</span>
                    <span>${escapeHtml(normalizeText(productRow && productRow.categoryTrail) || normalizeText(productRow && productRow.categoryLabel) || '--')}</span>
                  </div>
                  <div class="ops-pm-product-foot">
                    <span class="ops-pm-status-list">${statusBadges}</span>
                  </div>
                </div>
              </div>
            </td>
          ` : ''}
          <td class="ops-pm-nowrap">${escapeHtml(normalizeText(row && row.skuId) || '--')}</td>
          <td>
            ${renderThumb(row && row.skuImageUrl, row && row.skuCode, 'ops-pm-mini-thumb', skuPreviewTitle)}
          </td>
          <td>${escapeHtml(normalizeText(row && row.spec) || '--')}</td>
          <td class="ops-pm-nowrap">${escapeHtml(normalizeText(row && row.stationLabel) || normalizeText(row && row.station) || '--')}</td>
          <td>${renderCompositeStatusCell(row)}</td>
          <td class="ops-pm-nowrap">${escapeHtml(declaredPriceText)}</td>
          <td class="ops-pm-nowrap">${escapeHtml(costPriceText)}</td>
          <td class="ops-pm-nowrap">${escapeHtml(formatPercent(profitRate))}</td>
          <td class="ops-pm-nowrap">${escapeHtml(updatedAtText)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderQuickCostDialog(state) {
    if (!state || state.quickCostDialogOpen !== true) {
      return '';
    }

    const groupedEntries = groupQuickCostDialogEntries(state.quickCostDialogEntries);

    return `
      <div class="ops-pd-quick-cost-modal" data-npl-quick-cost-backdrop="true">
        <div class="ops-pd-quick-cost-dialog ops-npl-quick-cost-dialog" data-npl-quick-cost-panel="true">
          <div class="ops-pd-quick-cost-header">
            <div class="ops-pd-quick-cost-title-block">
              <h3 class="ops-pd-quick-cost-title">\u5feb\u901f\u9884\u8bbe\u6210\u672c\u4ef7</h3>
              <p class="ops-pd-quick-cost-subtitle">
                \u5f53\u524d\u5171 ${escapeHtml(String(state.quickCostDialogRowCount || 0))} \u6761SKU\u8bb0\u5f55\uff0c
                \u53ef\u9884\u8bbe ${escapeHtml(String((state.quickCostDialogEntries || []).length))} \u4e2a\u6309\u5e97\u94fa\u3001\u7ad9\u70b9\u3001\u7c7b\u76ee\u3001\u89c4\u683c\u53bb\u91cd\u540e\u7684\u552f\u4e00\u9879
              </p>
            </div>
            <button
              class="ops-pd-quick-cost-close"
              type="button"
              data-npl-action="close-quick-cost-preset"
              aria-label="\u5173\u95ed\u6210\u672c\u9884\u8bbe"
            >
              &times;
            </button>
          </div>

          <div class="ops-pd-quick-cost-body">
            ${state.quickCostDialogLoading === true ? `
              <div class="ops-pd-quick-cost-empty">\u6b63\u5728\u52a0\u8f7d\u6210\u672c\u9884\u8bbe...</div>
            ` : groupedEntries.length <= 0 ? `
              <div class="ops-pd-quick-cost-empty">\u6682\u65e0\u53ef\u9884\u8bbe\u7684SKU\u4fe1\u606f</div>
            ` : groupedEntries.map((shopGroup) => `
              <section class="ops-pd-quick-cost-group ops-npl-quick-cost-shop-group">
                <div class="ops-pd-quick-cost-group-header">
                  <strong>${escapeHtml(shopGroup.shopName || shopGroup.shopId)}</strong>
                  <span>${escapeHtml(String((shopGroup.categories || []).reduce((count, categoryGroup) => {
                    return count + (Array.isArray(categoryGroup && categoryGroup.entries) ? categoryGroup.entries.length : 0);
                  }, 0)))} \u9879</span>
                </div>
                <div class="ops-npl-quick-cost-category-list">
                  ${(Array.isArray(shopGroup.categories) ? shopGroup.categories : []).map((categoryGroup) => `
                    <section class="ops-npl-quick-cost-category-group">
                      <div class="ops-npl-quick-cost-category-header">
                        <strong>${escapeHtml(categoryGroup.categoryLabel || '--')}</strong>
                        <span>${escapeHtml(String((categoryGroup.entries || []).length))} \u9879</span>
                      </div>
                      <div class="ops-pd-quick-cost-group-list">
                        ${(Array.isArray(categoryGroup.entries) ? categoryGroup.entries : []).map((entry) => `
                          <label class="ops-pd-quick-cost-item">
                            <span class="ops-pd-quick-cost-spec">
                              <span>${escapeHtml(entry.spec)}</span>
                              <small class="ops-pd-quick-cost-meta">${escapeHtml(normalizeText(entry.stationLabel) || normalizeText(entry.station) || '--')}</small>
                            </span>
                            <span class="ops-pd-quick-cost-input-shell">
                              <input
                                class="ops-pd-control ops-pd-quick-cost-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value="${escapeHtml(entry.costPrice)}"
                                data-npl-quick-cost-input="${escapeHtml(entry.key)}"
                              />
                              <span>\u5143</span>
                            </span>
                          </label>
                        `).join('')}
                      </div>
                    </section>
                  `).join('')}
                </div>
              </section>
            `).join('')}
          </div>

          <div class="ops-pd-quick-cost-footer">
            ${state.quickCostDialogError ? `<div class="ops-pd-quick-cost-message is-error">${escapeHtml(state.quickCostDialogError)}</div>` : ''}
            ${state.quickCostDialogWarning ? `<div class="ops-pd-quick-cost-message is-warning">${escapeHtml(state.quickCostDialogWarning)}</div>` : ''}
            ${state.quickCostDialogNotice ? `<div class="ops-pd-quick-cost-message is-success">${escapeHtml(state.quickCostDialogNotice)}</div>` : ''}
            <div class="ops-pd-quick-cost-actions">
              <button
                class="ops-pd-action-button is-secondary"
                type="button"
                data-npl-action="close-quick-cost-preset"
                ${state.quickCostDialogSaving === true ? ' disabled' : ''}
              >
                \u5173\u95ed
              </button>
              <button
                class="ops-pd-action-button is-primary"
                type="button"
                data-npl-action="save-quick-cost-preset"
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

  function renderBatchAdjustRuleEditor(entry, rule, index, totalRules) {
    const entryKey = normalizeText(entry && entry.key);
    const ruleId = normalizeText(rule && rule.id);
    const adjustMode = normalizeBatchAdjustMode(rule && rule.adjustMode);
    const valueUnit = resolveBatchAdjustValueUnit(adjustMode);

    return `
      <div class="ops-npl-batch-adjust-group-row">
        <label class="ops-npl-batch-adjust-field">
          <span>\u65e5\u5e38\u4ef7\u683c\u533a\u95f4</span>
          <div class="ops-npl-batch-adjust-range">
            <input
              class="ops-pd-control"
              type="text"
              inputmode="decimal"
              placeholder="0"
              value="${escapeHtml(normalizeText(rule && rule.declaredPriceMin))}"
              data-npl-batch-adjust-entry-key="${escapeHtml(entryKey)}"
              data-npl-batch-adjust-rule-id="${escapeHtml(ruleId)}"
              data-npl-batch-adjust-field="declaredPriceMin"
            />
            <span class="ops-npl-batch-adjust-range-separator">\u81f3</span>
            <input
              class="ops-pd-control"
              type="text"
              inputmode="decimal"
              placeholder="\u4e0d\u9650"
              value="${escapeHtml(normalizeText(rule && rule.declaredPriceMax))}"
              data-npl-batch-adjust-entry-key="${escapeHtml(entryKey)}"
              data-npl-batch-adjust-rule-id="${escapeHtml(ruleId)}"
              data-npl-batch-adjust-field="declaredPriceMax"
            />
            <span class="ops-npl-batch-adjust-range-unit">\u5143</span>
          </div>
        </label>
        <label class="ops-npl-batch-adjust-field">
          <span>\u8c03\u4ef7\u65b9\u5f0f</span>
          <select
            class="ops-pd-control"
            data-npl-batch-adjust-entry-key="${escapeHtml(entryKey)}"
            data-npl-batch-adjust-rule-id="${escapeHtml(ruleId)}"
            data-npl-batch-adjust-field="adjustMode"
          >
            ${renderOptions(BATCH_ADJUST_MODE_OPTIONS, adjustMode, '', { includeEmpty: false })}
          </select>
        </label>
        <label class="ops-npl-batch-adjust-field">
          <span>\u8bbe\u7f6e\u4ef7\u683c</span>
          <div class="ops-npl-batch-adjust-value-shell">
            <input
              class="ops-pd-control"
              type="text"
              inputmode="decimal"
              placeholder="0"
              value="${escapeHtml(normalizeText(rule && rule.adjustValue))}"
              data-npl-batch-adjust-entry-key="${escapeHtml(entryKey)}"
              data-npl-batch-adjust-rule-id="${escapeHtml(ruleId)}"
              data-npl-batch-adjust-field="adjustValue"
            />
            <span class="ops-npl-batch-adjust-range-unit">${escapeHtml(valueUnit)}</span>
          </div>
        </label>
        <div class="ops-npl-batch-adjust-group-actions">
          <button
            class="ops-npl-action-button is-danger"
            type="button"
            data-npl-action="remove-batch-adjust-rule"
            data-npl-batch-adjust-entry-key="${escapeHtml(entryKey)}"
            data-npl-batch-adjust-rule-id="${escapeHtml(ruleId)}"
            ${totalRules <= 0 && index <= 0 ? ' disabled' : ''}
          >
            \u5220\u9664
          </button>
        </div>
      </div>
    `;
  }

  function countBatchAdjustConfiguredRuleGroups(entries) {
    return (Array.isArray(entries) ? entries : []).reduce((count, entry) => {
      return count + normalizeBatchAdjustRuleList(entry && entry.batchAdjustRules).length;
    }, 0);
  }

  function renderBatchAdjustInfoChip(text, options = {}) {
    const normalizedText = normalizeText(text);

    if (!normalizedText) {
      return '';
    }

    const toneClass = normalizeText(options && options.tone);
    const titleText = normalizeText(options && options.title) || normalizedText;
    return `<span class="ops-npl-batch-adjust-info-chip${toneClass ? ` is-${escapeHtml(toneClass)}` : ''}" title="${escapeHtml(titleText)}">${escapeHtml(normalizedText)}</span>`;
  }

  function renderBatchAdjustDialogEntry(entry, allEntries) {
    const costPriceNumber = Number(entry && entry.costPrice);
    const hasCostPrice = Number.isFinite(costPriceNumber) && costPriceNumber > 0;
    const costPriceText = hasCostPrice
      ? `${formatMoney(costPriceNumber)}\u5143`
      : '--';
    const specText = normalizeText(entry && entry.spec) || '--';
    const stationText = normalizeText(entry && entry.stationLabel) || normalizeText(entry && entry.station) || '--';
    const categoryText = normalizeText(entry && entry.categoryLabel) || normalizeText(entry && entry.category) || '--';
    const categoryTrailText = normalizeText(entry && entry.categoryTrail) || categoryText;
    const costLabelText = hasCostPrice
      ? `\u6210\u672c\u4ef7 ${costPriceText}`
      : '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e';
    const costHintText = hasCostPrice
      ? ''
      : '\u8bf7\u5148\u5feb\u901f\u9884\u8bbe\u6210\u672c\u4ef7';
    const rules = normalizeBatchAdjustRuleList(entry && entry.batchAdjustRules);
    const copySourceOptions = buildBatchAdjustCopySourceOptions(allEntries, entry);
    const selectedCopySourceKey = copySourceOptions.some((option) => {
      return normalizeText(option && option.value) === normalizeText(entry && entry.copySourceEntryKey);
    })
      ? normalizeText(entry && entry.copySourceEntryKey)
      : '';

    return `
      <section class="ops-npl-batch-adjust-entry-card">
        <div class="ops-npl-batch-adjust-entry-header">
          <div class="ops-npl-batch-adjust-entry-title">
            <strong>${escapeHtml(specText)}</strong>
            <div class="ops-npl-batch-adjust-entry-meta">
              ${renderBatchAdjustInfoChip(stationText)}
              ${renderBatchAdjustInfoChip(categoryText, { title: categoryTrailText })}
              ${renderBatchAdjustInfoChip(`\u5df2\u8bbe ${String(rules.length)} \u7ec4`)}
              ${renderBatchAdjustInfoChip(costLabelText, { tone: hasCostPrice ? '' : 'warning' })}
              ${costHintText ? renderBatchAdjustInfoChip(costHintText, { tone: 'warning' }) : ''}
            </div>
          </div>
        </div>
        <div class="ops-npl-batch-adjust-entry-toolbar">
          <div class="ops-npl-batch-adjust-copy-tools">
            <select
              class="ops-pd-control"
              data-npl-batch-adjust-copy-target="${escapeHtml(normalizeText(entry && entry.key))}"
              ${copySourceOptions.length <= 0 ? ' disabled' : ''}
            >
              <option value="">\u5feb\u901f\u5957\u7528\u5176\u4ed6 SKU \u8bbe\u7f6e</option>
              ${copySourceOptions.map((option) => `
                <option
                  value="${escapeHtml(normalizeText(option && option.value))}"
                  ${normalizeText(option && option.value) === selectedCopySourceKey ? ' selected' : ''}
                >
                  ${escapeHtml(normalizeText(option && option.label) || '--')}
                </option>
              `).join('')}
            </select>
            <button
              class="ops-npl-action-button is-secondary"
              type="button"
              data-npl-action="apply-batch-adjust-copy-source"
              data-npl-batch-adjust-copy-target="${escapeHtml(normalizeText(entry && entry.key))}"
              ${selectedCopySourceKey ? '' : ' disabled'}
            >
              \u5957\u7528
            </button>
          </div>
          <button
            class="ops-npl-action-button is-secondary"
            type="button"
            data-npl-action="add-batch-adjust-rule"
            data-npl-batch-adjust-entry-key="${escapeHtml(normalizeText(entry && entry.key))}"
          >
            \u65b0\u589e\u4ef7\u683c\u7ec4
          </button>
        </div>
        <div class="ops-npl-batch-adjust-group-list">
          ${rules.length > 0 ? rules.map((rule, index) => {
            return renderBatchAdjustRuleEditor(entry, rule, index, rules.length);
          }).join('') : `
            <div class="ops-npl-batch-adjust-group-empty">\u6682\u65e0\u5df2\u4fdd\u5b58\u7684\u8c03\u4ef7\u7ec4</div>
          `}
        </div>
      </section>
    `;
  }

  function renderBatchAdjustShopPreview(state, shopGroup) {
    const filteredRows = applyLocalFilters(state && state.rows, state && state.appliedFilters);
    const batchAdjustSettings = buildBatchAdjustSettingsPayload(state);
    const activityReductionAmount = resolveBatchAdjustActivityReductionAmount(batchAdjustSettings);
    const selectedStationIds = new Set(
      normalizeBatchAdjustDialogStationIds(
        state && state.batchAdjustDialogStationIds,
        state && state.batchAdjustDialogStationOptions
      )
    );
    const previewRows = buildBatchAdjustPreviewRowsForShop(
      filteredRows,
      state && state.batchAdjustDialogEntries,
      shopGroup && shopGroup.shopId,
      batchAdjustSettings
    ).filter((row) => {
      if (selectedStationIds.size <= 0) {
        return true;
      }

      return selectedStationIds.has(normalizeText(row && row.station));
    });

    if (previewRows.length <= 0) {
      return `
        <section class="ops-npl-batch-adjust-preview-shell">
          <div class="ops-pd-quick-cost-empty">\u5f53\u524d\u5e97\u94fa\u5728\u5df2\u9009\u8c03\u4ef7\u7ad9\u70b9\u4e0b\u6682\u65e0\u53ef\u9884\u89c8\u7684\u5546\u54c1\u6570\u636e</div>
        </section>
      `;
    }

    const summary = summarizeBatchAdjustPreviewRows(previewRows);

    return `
      <section class="ops-npl-batch-adjust-preview-shell">
        <div class="ops-npl-batch-adjust-preview-summary">
          <span>\u5171 ${escapeHtml(String(previewRows.length))} \u6761SKU</span>
          <span>\u65e5\u5e38\u53ef\u63d0\u4ea4 ${escapeHtml(String(summary.dailyEligibleCount))} \u6761</span>
          <span>\u6d3b\u52a8\u53ef\u63d0\u4ea4 ${escapeHtml(String(summary.activityEligibleCount))} \u6761</span>
          <span>\u4e0d\u53ef\u63d0\u4ea4 ${escapeHtml(String(summary.skippedCount))} \u6761</span>
          <span class="${summary.missingCostCount > 0 ? 'is-warning' : ''}">\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e ${escapeHtml(String(summary.missingCostCount))} \u6761</span>
        </div>
        <div class="ops-npl-batch-adjust-table-shell">
          <table class="ops-pm-table ops-npl-batch-adjust-table">
            <thead>
              <tr>
                <th>\u5546\u54c1\u4fe1\u606f</th>
                <th>SKU ID</th>
                <th>\u5546\u54c1\u89c4\u683c</th>
                <th>\u7ad9\u70b9</th>
                <th>\u5f53\u524d\u7533\u62a5\u4ef7</th>
                <th>\u9884\u89c8\u540e\u4ef7\u683c</th>
                <th>\u6210\u672c\u4ef7</th>
                <th>\u9884\u89c8\u5229\u6da6\u7387(\u6309\u9884\u89c8\u4ef7)</th>
                <th>\u65e5\u5e38\u4ef7\u683c\u7ec4 / \u8bf4\u660e</th>
              </tr>
            </thead>
            <tbody>
              ${previewRows.map((row) => {
                const declaredPrice = Number(row && row.declaredPrice);
                const suggestedDeclaredPrice = normalizeDecimalValue(row && row.suggestedDeclaredPrice, 0);
                const suggestedActivityDeclaredPrice = normalizeDecimalValue(row && row.suggestedActivityDeclaredPrice, 0);
                const dailyAdjustedPrice = Number(row && row.batchAdjustDailyAdjustedPrice);
                const costPrice = Number(row && row.costPrice);
                const dailyAdjustedProfitRate = Number(row && row.batchAdjustDailyAdjustedProfitRate);
                const hasDeclaredPrice = Number.isFinite(declaredPrice) && declaredPrice > 0;
                const hasSuggestedDeclaredPrice = Number.isFinite(suggestedDeclaredPrice) && suggestedDeclaredPrice > 0;
                const hasSuggestedActivityDeclaredPrice = Number.isFinite(suggestedActivityDeclaredPrice) && suggestedActivityDeclaredPrice > 0;
                const hasDailyAdjustedPrice = Number.isFinite(dailyAdjustedPrice) && dailyAdjustedPrice > 0;
                const hasCostPrice = Number.isFinite(costPrice) && costPrice > 0;
                const dailyEnabled = row && row.batchAdjustDailyEnabled === true;
                const dailyNoteText = normalizeText(row && row.batchAdjustDailyNoteText);
                const activityNoteText = normalizeText(row && row.batchAdjustActivityNoteText);
                const ruleText = normalizeText(row && row.batchAdjustRuleText) || '--';
                const stationText = normalizeText(row && row.stationLabel) || normalizeText(row && row.station) || '--';
                const activityEnabled = row && row.batchAdjustActivityEnabled === true;
                const hasActivityCandidate = Boolean(row && row.batchAdjustActivityCandidate);
                const activityReductionText = Number.isFinite(activityReductionAmount) && activityReductionAmount > 0
                  ? `\u6d3b\u52a8\u4ef7\u51cf${formatMoney(activityReductionAmount)}\u5143`
                  : '\u6d3b\u52a8\u4ef7\u51cf0';
                const ruleDisplayText = dailyEnabled
                  ? `\u65e5\u5e38\u4ef7\u683c\u7ec4\uff1a${ruleText}`
                  : '\u65e5\u5e38\u4ef7\u683c\u7ec4\uff1a\u672a\u542f\u7528';
                const dailyNoteTone = dailyNoteText === '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e'
                  ? ' is-missing'
                  : (dailyNoteText ? ' is-warning' : '');
                const activityNoteTone = activityNoteText === '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e'
                  ? ' is-missing'
                  : (activityNoteText ? ' is-warning' : '');
                const ruleCellTone = dailyNoteText === '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e' || activityNoteText === '\u6210\u672c\u4ef7\u672a\u8bbe\u7f6e'
                  ? ' is-missing'
                  : (row && row.batchAdjustSubmitEligible ? '' : ((dailyNoteText || activityNoteText) ? ' is-warning' : ''));

                return `
                  <tr class="ops-pm-sku-row">
                    <td class="ops-pm-cell-product">
                      ${renderProductInfoCell(row)}
                    </td>
                    <td class="ops-pm-nowrap">${escapeHtml(normalizeText(row && row.skuId) || '--')}</td>
                    <td>${escapeHtml(normalizeText(row && row.spec) || '--')}</td>
                    <td class="ops-pm-nowrap">${escapeHtml(stationText)}</td>
                    <td>
                      <div class="ops-npl-batch-adjust-preview-main">${escapeHtml(hasDeclaredPrice ? `${formatMoney(declaredPrice)}\u5143` : '--')}</div>
                      ${hasSuggestedDeclaredPrice ? `<div class="ops-npl-batch-adjust-preview-note">\u5efa\u8bae\u65e5\u5e38\u4ef7 ${escapeHtml(formatMoney(suggestedDeclaredPrice))}\u5143</div>` : ''}
                      ${hasSuggestedActivityDeclaredPrice ? `<div class="ops-npl-batch-adjust-preview-note">\u5efa\u8bae\u6d3b\u52a8\u4ef7 ${escapeHtml(formatMoney(suggestedActivityDeclaredPrice))}\u5143</div>` : ''}
                    </td>
                    <td class="ops-npl-batch-adjust-preview-cell${row && row.batchAdjustSubmitEligible ? '' : ' is-warning'}">
                      <div class="ops-npl-batch-adjust-preview-main">
                        ${escapeHtml(hasDailyAdjustedPrice ? `\u65e5\u5e38 ${formatMoney(dailyAdjustedPrice)}\u5143` : `\u65e5\u5e38 ${dailyEnabled ? (dailyNoteText || '--') : '\u672a\u542f\u7528'}`)}
                      </div>
                      ${activityEnabled ? `<div class="ops-npl-batch-adjust-preview-note${!hasActivityCandidate && activityNoteText ? ' is-warning' : ''}">${escapeHtml(hasActivityCandidate ? activityReductionText : `\u6d3b\u52a8 ${activityNoteText || '--'}`)}</div>` : ''}
                    </td>
                    <td class="ops-pm-nowrap ops-npl-batch-adjust-preview-cell${hasCostPrice ? '' : ' is-missing'}">${escapeHtml(hasCostPrice ? `${formatMoney(costPrice)}\u5143` : '--')}</td>
                    <td class="ops-pm-nowrap">
                      <div class="ops-npl-batch-adjust-preview-main">${escapeHtml(hasDailyAdjustedPrice ? `\u65e5\u5e38 ${formatPercent(dailyAdjustedProfitRate)}` : `\u65e5\u5e38 ${dailyEnabled ? '--' : '\u672a\u542f\u7528'}`)}</div>
                      ${activityEnabled ? `<div class="ops-npl-batch-adjust-preview-note">${escapeHtml(hasActivityCandidate ? '\u6d3b\u52a8\u5f85\u56de\u67e5' : '\u6d3b\u52a8 --')}</div>` : ''}
                    </td>
                    <td class="ops-npl-batch-adjust-preview-cell${ruleCellTone}">
                      <div class="ops-npl-batch-adjust-preview-main">${escapeHtml(ruleDisplayText)}</div>
                      ${dailyEnabled && dailyNoteText ? `<div class="ops-npl-batch-adjust-preview-note${dailyNoteTone}">${escapeHtml(`\u65e5\u5e38\uff1a${dailyNoteText}`)}</div>` : ''}
                      ${activityEnabled && hasActivityCandidate ? `<div class="ops-npl-batch-adjust-preview-note">${escapeHtml(BATCH_ADJUST_ACTIVITY_PREVIEW_SCOPE_TEXT)}</div>` : ''}
                      ${activityEnabled && !hasActivityCandidate && activityNoteText ? `<div class="ops-npl-batch-adjust-preview-note${activityNoteTone}">${escapeHtml(`\u6d3b\u52a8\uff1a${activityNoteText}`)}</div>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function buildBatchAdjustSubmitPreviewShopSummaries(previewItems, resultsByShop) {
    const summaryMap = new Map();

    function ensureSummary(shopId, shopName) {
      const key = normalizeText(shopId) || normalizeText(shopName);

      if (!key) {
        return null;
      }

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          key,
          shopId: normalizeText(shopId),
          shopName: normalizeText(shopName) || normalizeText(shopId),
          totalRows: 0,
          readyRowCount: 0,
          requestedDailyCount: 0,
          requestedActivityCount: 0,
          skippedRowCount: 0,
          success: true,
          message: '',
          hasResultData: false
        });
      }

      return summaryMap.get(key);
    }

    (Array.isArray(resultsByShop) ? resultsByShop : []).forEach((result) => {
      const summary = ensureSummary(result && result.shopId, result && result.shopName);

      if (!summary) {
        return;
      }

      summary.success = result && result.success !== false;
      summary.message = normalizeText(result && result.message);
      summary.hasResultData = true;
      summary.totalRows = Math.max(summary.totalRows, normalizeIntegerValue(result && result.totalRows, 0));
      summary.readyRowCount = Math.max(summary.readyRowCount, normalizeIntegerValue(result && result.readyRowCount, 0));
      summary.requestedDailyCount = Math.max(summary.requestedDailyCount, normalizeIntegerValue(result && result.requestedDailyCount, 0));
      summary.requestedActivityCount = Math.max(summary.requestedActivityCount, normalizeIntegerValue(result && result.requestedActivityCount, 0));
      summary.skippedRowCount = Math.max(summary.skippedRowCount, normalizeIntegerValue(result && result.skippedRowCount, 0));
    });

    (Array.isArray(previewItems) ? previewItems : []).forEach((item) => {
      const summary = ensureSummary(item && item.shopId, item && item.shopName);

      if (!summary) {
        return;
      }

      if (summary.hasResultData === true) {
        return;
      }

      summary.totalRows += 1;
      summary.readyRowCount += item && item.batchAdjustSubmitPreviewEligible ? 1 : 0;
      summary.requestedDailyCount += Math.max(0, normalizeIntegerValue(item && item.batchAdjustSubmitPreviewDailyRequestCount, 0));
      summary.requestedActivityCount += Math.max(0, normalizeIntegerValue(item && item.batchAdjustSubmitPreviewActivityRequestCount, 0));
      summary.skippedRowCount += item && item.batchAdjustSubmitPreviewEligible ? 0 : 1;
    });

    return Array.from(summaryMap.values()).sort((left, right) => {
      return normalizeText(left && left.shopName).localeCompare(
        normalizeText(right && right.shopName),
        'zh-CN'
      );
    });
  }

  function sortBatchAdjustSubmitPreviewItems(previewItems) {
    return (Array.isArray(previewItems) ? previewItems : []).slice().sort((left, right) => {
      return (
        normalizeText(left && left.shopName).localeCompare(normalizeText(right && right.shopName), 'zh-CN')
        || normalizeText(left && left.productName).localeCompare(normalizeText(right && right.productName), 'zh-CN')
        || normalizeText(left && left.spec).localeCompare(normalizeText(right && right.spec), 'zh-CN')
        || normalizeText(left && left.skuId).localeCompare(normalizeText(right && right.skuId), 'zh-CN')
      );
    });
  }

  function renderBatchAdjustSubmitPreviewShopOverview(shopSummaries) {
    const cards = (Array.isArray(shopSummaries) ? shopSummaries : []).map((shopSummary) => {
      const success = shopSummary && shopSummary.success !== false;

      return `
        <article class="ops-npl-price-decl-shop-card${success ? '' : ' is-failed'}">
          <div class="ops-npl-price-decl-shop-card-head">
            <strong>${escapeHtml(shopSummary.shopName || shopSummary.shopId || '--')}</strong>
            <span class="ops-npl-price-decl-shop-card-status${success ? '' : ' is-failed'}">${escapeHtml(success ? '\u9884\u89c8\u5b8c\u6210' : '\u90e8\u5206\u5931\u8d25')}</span>
          </div>
          <div class="ops-npl-price-decl-shop-card-metrics">
            <span>SKU <strong>${Math.max(0, normalizeIntegerValue(shopSummary && shopSummary.totalRows, 0))}</strong></span>
            <span class="is-approve">\u53ef\u63d0\u4ea4 <strong>${Math.max(0, normalizeIntegerValue(shopSummary && shopSummary.readyRowCount, 0))}</strong></span>
            <span class="is-redecl">\u65e5\u5e38 <strong>${Math.max(0, normalizeIntegerValue(shopSummary && shopSummary.requestedDailyCount, 0))}</strong></span>
            <span class="is-void">\u6d3b\u52a8 <strong>${Math.max(0, normalizeIntegerValue(shopSummary && shopSummary.requestedActivityCount, 0))}</strong></span>
            <span class="is-skip">\u8df3\u8fc7 <strong>${Math.max(0, normalizeIntegerValue(shopSummary && shopSummary.skippedRowCount, 0))}</strong></span>
          </div>
          ${shopSummary && shopSummary.message ? `
            <div class="ops-npl-price-decl-shop-card-message${success ? '' : ' is-failed'}">${escapeHtml(shopSummary.message)}</div>
          ` : ''}
        </article>
      `;
    }).join('');

    if (!cards) {
      return '';
    }

    return `
      <div class="ops-npl-price-decl-shop-overview">
        ${cards}
      </div>
    `;
  }

  function renderBatchAdjustSubmitPreviewSection(state) {
    if (!state || state.batchAdjustSubmitPreviewOpen !== true) {
      return '';
    }

    const previewItems = Array.isArray(state.batchAdjustSubmitPreviewItems)
      ? state.batchAdjustSubmitPreviewItems
      : [];
    const resultsByShop = Array.isArray(state.batchAdjustSubmitPreviewResultsByShop)
      ? state.batchAdjustSubmitPreviewResultsByShop
      : [];
    const previewSummary = state.batchAdjustSubmitPreviewSummary || createDefaultBatchAdjustSubmitPreviewSummary();
    const virtualWindow = getBatchAdjustSubmitPreviewVirtualWindow(state, previewItems);
    const visibleItems = virtualWindow.items;
    const cachedShopSummaries = Array.isArray(state.batchAdjustSubmitPreviewShopSummaries)
      ? state.batchAdjustSubmitPreviewShopSummaries
      : [];
    const shopSummaries = cachedShopSummaries.length > 0
      ? cachedShopSummaries
      : buildBatchAdjustSubmitPreviewShopSummaries(previewItems, resultsByShop);
    if (previewItems.length <= 0) {
      return `
        <section class="ops-npl-price-decl-preview-section">
          <div class="ops-npl-price-decl-block" style="border-top:1px solid var(--pm-border);">
            <div class="ops-npl-price-decl-block-header">
              <span class="ops-npl-price-decl-block-step">2</span>
              <strong>\u8c03\u4ef7\u9884\u89c8\u7ed3\u679c</strong>
            </div>
            ${renderBatchAdjustSubmitPreviewShopOverview(shopSummaries)}
            <div class="ops-npl-price-decl-preview-empty">\u672c\u6b21\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u8c03\u4ef7\u9879</div>
          </div>
        </section>
      `;
    }

    return `
      <section class="ops-npl-price-decl-preview-section">
        <div class="ops-npl-price-decl-block" style="border-top:1px solid var(--pm-border);">
          <div class="ops-npl-price-decl-block-header">
            <span class="ops-npl-price-decl-block-step">2</span>
            <strong>\u8c03\u4ef7\u9884\u89c8\u7ed3\u679c</strong>
            <span style="color:var(--pm-text-soft);font-size:12px;">\u5171 ${Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.totalRowCount, previewItems.length))} \u4e2aSKU / ${Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.totalShops, shopSummaries.length)) || shopSummaries.length || 1} \u5bb6\u5e97\u94fa</span>
          </div>
          <div class="ops-npl-batch-adjust-preview-summary">
            <span>\u53ef\u63d0\u4ea4SKU ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.readyRowCount, 0))))} \u6761</span>
            <span>\u65e5\u5e38\u5f85\u63d0\u4ea4 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestedDailyCount, 0))))} \u6761</span>
            <span>\u6d3b\u52a8\u5f85\u63d0\u4ea4 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestedActivityCount, 0))))} \u6761</span>
            <span>\u63d0\u4ea4\u5206\u7ec4 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestGroupCount, 0))))} \u7ec4</span>
            <span class="${Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.skippedRowCount, 0)) > 0 ? 'is-warning' : ''}">\u8df3\u8fc7 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.skippedRowCount, 0))))} \u6761</span>
          </div>
          ${renderBatchAdjustSubmitPreviewShopOverview(shopSummaries)}
          <div
            class="ops-npl-batch-adjust-table-shell ops-npl-batch-adjust-table-shell-virtual"
            data-npl-batch-adjust-submit-preview-wrap="true"
            style="--npl-batch-adjust-virtual-height:${escapeHtml(String(virtualWindow.viewportHeight))}px;"
          >
            <table class="ops-pm-table ops-npl-batch-adjust-table">
              <thead>
                <tr>
                  <th>\u5e97\u94fa</th>
                  <th>\u5546\u54c1\u4fe1\u606f</th>
                  <th>SKU ID</th>
                  <th>\u5546\u54c1\u89c4\u683c</th>
                  <th>\u7ad9\u70b9</th>
                  <th>\u5f53\u524d\u7533\u62a5\u4ef7/\u5efa\u8bae\u4ef7</th>
                  <th>\u9884\u89c8\u540e\u4ef7\u683c/\u8c03\u6574\u7ed3\u679c</th>
                  <th>\u9884\u89c8\u63d0\u4ea4\u7ed3\u679c/\u8bf4\u660e</th>
                  <th>\u8c03\u4ef7\u8bf4\u660e/\u8fc7\u6ee4\u539f\u56e0</th>
                </tr>
              </thead>
              <tbody data-npl-batch-adjust-submit-preview-body="true">
                ${renderBatchAdjustSubmitPreviewVirtualRowsMarkup(virtualWindow, state)}
              </tbody>
            </table>
          </div>
          ${previewItems.length > visibleItems.length ? `
            <div class="ops-npl-batch-adjust-preview-lazy-hint" data-npl-batch-adjust-submit-preview-range="true">
              ${escapeHtml(formatBatchAdjustSubmitPreviewRangeText(virtualWindow))}
            </div>
          ` : ''}
        </div>
      </section>
    `;
  }

  function renderBatchAdjustSubmitPreviewSectionSafely(state) {
    try {
      return renderBatchAdjustSubmitPreviewSection(state);
    } catch (error) {
      console.error('[BatchAdjust] preview detail render failed:', error);

      return `
        <section class="ops-npl-price-decl-preview-section">
          <div class="ops-npl-price-decl-block" style="border-top:1px solid var(--pm-border);">
            <div class="ops-npl-price-decl-block-header">
              <span class="ops-npl-price-decl-block-step">2</span>
              <strong>\u8c03\u4ef7\u9884\u89c8\u7ed3\u679c</strong>
            </div>
            <div class="ops-pd-quick-cost-message is-error">
              \u9884\u89c8\u5df2\u751f\u6210\uff0c\u4f46\u660e\u7ec6\u5217\u8868\u663e\u793a\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u70b9\u51fb\u6279\u91cf\u9884\u89c8\u8c03\u4ef7
            </div>
          </div>
        </section>
      `;
    }
  }

  function renderBatchAdjustDialog(state) {
    if (!state || state.batchAdjustDialogOpen !== true) {
      return '';
    }

    const entries = Array.isArray(state.batchAdjustDialogEntries)
      ? state.batchAdjustDialogEntries
      : [];
    const groupedEntries = groupBatchAdjustDialogEntries(entries);
    const batchAdjustStationOptions = Array.isArray(state.batchAdjustDialogStationOptions)
      ? state.batchAdjustDialogStationOptions
      : [];
    const selectedStationIds = new Set(
      normalizeBatchAdjustDialogStationIds(
        state.batchAdjustDialogStationIds,
        batchAdjustStationOptions
      )
    );
    const dailyEnabled = Boolean(state.batchAdjustDialogDailyEnabled);
    const activityEnabled = Boolean(state.batchAdjustDialogActivityEnabled);
    const duplicateSubmitWindowDays = normalizeText(state.batchAdjustDialogDuplicateSubmitWindowDays);
    const useSuggestedPriceAfterSubmitCount = normalizeText(state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount);
    const hasEnabledSubmitType = dailyEnabled || activityEnabled;
    const previewOpen = state.batchAdjustSubmitPreviewOpen === true;
    const previewSaving = state.batchAdjustSubmitPreviewSaving === true;
    const previewBusy = previewSaving === true;
    const submitRunning = state.batchAdjustDialogSubmitting === true;
    const submitBusy = state.batchAdjustDialogSaving === true
      || submitRunning
      || previewSaving === true;
    const previewSummary = state.batchAdjustSubmitPreviewSummary || createDefaultBatchAdjustSubmitPreviewSummary();
    const previewRequestToken = normalizeText(state.batchAdjustSubmitPreviewRequestToken);
    const previewGroupedRequestCount = Array.isArray(state.batchAdjustSubmitPreviewGroupedRequests)
      ? state.batchAdjustSubmitPreviewGroupedRequests.length
      : 0;
    const canSubmitPreviewRequests = Boolean(previewRequestToken) || previewGroupedRequestCount > 0;
    const disableBatchAdjustPrimaryButton = state.batchAdjustDialogLoading === true
      || (
        submitBusy !== true
        && (previewOpen ? !canSubmitPreviewRequests : !hasEnabledSubmitType)
      );

    return `
      <div class="ops-pd-quick-cost-modal" data-npl-batch-adjust-backdrop="true">
        <div class="ops-pd-quick-cost-dialog ops-npl-batch-adjust-dialog" data-npl-batch-adjust-panel="true">
          <div class="ops-pd-quick-cost-header">
            <div class="ops-pd-quick-cost-title-block">
              <h3 class="ops-pd-quick-cost-title">${previewOpen ? '\u6279\u91cf\u9884\u89c8\u8c03\u4ef7' : '\u6279\u91cf\u53d1\u8d77\u8c03\u4ef7'}</h3>
              <p class="ops-pd-quick-cost-subtitle">
                ${previewOpen
                  ? `\u5171 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.totalRowCount, 0))))} \u4e2aSKU\uff0c\u65e5\u5e38\u5f85\u63d0\u4ea4 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestedDailyCount, 0))))} \u6761\uff0c\u6d3b\u52a8\u5f85\u63d0\u4ea4 ${escapeHtml(String(Math.max(0, normalizeIntegerValue(previewSummary && previewSummary.requestedActivityCount, 0))))} \u6761`
                  : `\u5f53\u524d\u5171 ${escapeHtml(String(state.batchAdjustDialogRowCount || 0))} \u6761SKU\u8bb0\u5f55\uff0c\u53ef\u8bbe\u7f6e ${escapeHtml(String(entries.length))} \u4e2a\u6309\u5e97\u94fa\u3001\u7ad9\u70b9\u3001\u7c7b\u76ee\u3001\u89c4\u683c\u53bb\u91cd\u540e\u7684\u552f\u4e00\u9879`}
              </p>
            </div>
            <div class="ops-npl-batch-adjust-header-actions">
              <button
                class="ops-pd-action-button is-secondary"
                type="button"
                data-npl-action="close-batch-adjust"
                ${state.batchAdjustDialogLoading === true ? ' disabled' : ''}
              >
                \u5173\u95ed
              </button>
            </div>
          </div>

          <div class="ops-pd-quick-cost-body ops-npl-batch-adjust-body">
            ${previewOpen ? `
              ${renderBatchAdjustSubmitPreviewSectionSafely(state)}
            ` : `
            ${state.batchAdjustDialogLoading === true || groupedEntries.length <= 0 ? '' : `
              <div class="ops-npl-batch-adjust-scope-note">${escapeHtml(BATCH_ADJUST_DAILY_RULE_SCOPE_TEXT)}</div>
            `}
            ${state.batchAdjustDialogLoading === true ? `
              <div class="ops-pd-quick-cost-empty">\u6b63\u5728\u52a0\u8f7d\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e...</div>
            ` : groupedEntries.length <= 0 ? `
              <div class="ops-pd-quick-cost-empty">\u6682\u65e0\u53ef\u9884\u89c8\u7684SKU\u4fe1\u606f</div>
            ` : groupedEntries.map((shopGroup) => `
              <section class="ops-pd-quick-cost-group ops-npl-batch-adjust-shop-group">
                ${(() => {
                  const shopEntries = (Array.isArray(shopGroup.categories) ? shopGroup.categories : []).reduce((result, categoryGroup) => {
                    return result.concat(Array.isArray(categoryGroup && categoryGroup.entries) ? categoryGroup.entries : []);
                  }, []);
                  const shopEntryCount = shopEntries.length;
                  const shopCategoryCount = Array.isArray(shopGroup.categories) ? shopGroup.categories.length : 0;
                  const shopRuleCount = countBatchAdjustConfiguredRuleGroups(shopEntries);
                  return `
                <div class="ops-pd-quick-cost-group-header ops-npl-batch-adjust-shop-header">
                  <div class="ops-npl-batch-adjust-shop-title">
                    <strong>${escapeHtml(shopGroup.shopName || shopGroup.shopId)}</strong>
                    <div class="ops-npl-batch-adjust-shop-summary">
                      ${renderBatchAdjustInfoChip(`${String(shopEntryCount)} \u9879SKU\u89c4\u683c`)}
                      ${renderBatchAdjustInfoChip(`${String(shopCategoryCount)} \u4e2a\u7c7b\u76ee`)}
                      ${renderBatchAdjustInfoChip(`\u5df2\u8bbe ${String(shopRuleCount)} \u7ec4`)}
                    </div>
                  </div>
                </div>
                  `;
                })()}
                <div class="ops-npl-quick-cost-category-list">
                  ${(Array.isArray(shopGroup.categories) ? shopGroup.categories : []).map((categoryGroup) => {
                    const categoryEntries = Array.isArray(categoryGroup.entries) ? categoryGroup.entries : [];
                    const categoryRuleCount = countBatchAdjustConfiguredRuleGroups(categoryEntries);
                    return `
                      <section class="ops-npl-quick-cost-category-group">
                        <div class="ops-npl-quick-cost-category-header">
                          <strong>${escapeHtml(categoryGroup.categoryLabel || '--')}</strong>
                          <div class="ops-npl-batch-adjust-category-summary">
                            ${renderBatchAdjustInfoChip(`${String(categoryEntries.length)} \u9879\u89c4\u683c`)}
                            ${renderBatchAdjustInfoChip(`\u5df2\u8bbe ${String(categoryRuleCount)} \u7ec4`)}
                          </div>
                        </div>
                        <div class="ops-pd-quick-cost-group-list">
                          ${categoryEntries
                            .map((entry) => renderBatchAdjustDialogEntry(entry, entries))
                            .join('')}
                        </div>
                      </section>
                    `;
                  }).join('')}
                </div>
              </section>
            `).join('')}
            `}
          </div>

          <div class="ops-pd-quick-cost-footer">
            ${state.batchAdjustDialogError ? `<div class="ops-pd-quick-cost-message is-error">${escapeHtml(state.batchAdjustDialogError)}</div>` : ''}
            ${state.batchAdjustDialogWarning ? `<div class="ops-pd-quick-cost-message is-warning">${escapeHtml(state.batchAdjustDialogWarning)}</div>` : ''}
            ${state.batchAdjustDialogNotice ? `<div class="ops-pd-quick-cost-message is-success">${escapeHtml(state.batchAdjustDialogNotice)}</div>` : ''}
            <div data-npl-batch-adjust-submit-runtime="true">${renderBatchAdjustRuntimeMarkup(state)}</div>
            ${previewOpen ? '' : `
            <div class="ops-npl-batch-adjust-footer-config">
              <section class="ops-npl-batch-adjust-footer-section ops-npl-batch-adjust-footer-section-span-full">
                <div class="ops-npl-batch-adjust-footer-section-head">
                  <strong>\u8c03\u4ef7\u7ad9\u70b9</strong>
                </div>
                <div class="ops-npl-batch-adjust-station-list">
                  ${batchAdjustStationOptions.length > 0 ? batchAdjustStationOptions.map((option) => `
                    <label class="ops-npl-batch-adjust-station-item">
                      <input
                        type="checkbox"
                        value="${escapeHtml(normalizeText(option && option.value))}"
                        data-npl-batch-adjust-station-option="${escapeHtml(normalizeText(option && option.value))}"
                        ${selectedStationIds.has(normalizeText(option && option.value)) ? ' checked' : ''}
                      />
                      <span>${escapeHtml(normalizeText(option && option.label) || normalizeText(option && option.value) || '--')}</span>
                    </label>
                  `).join('') : `
                    <div class="ops-npl-batch-adjust-station-empty">\u6682\u65e0\u53ef\u9009\u7ad9\u70b9</div>
                  `}
                </div>
              </section>
              <section class="ops-npl-batch-adjust-footer-section ops-npl-batch-adjust-footer-section-span-2">
                <div class="ops-npl-batch-adjust-footer-inline-form">
                  <label class="ops-npl-batch-adjust-footer-field ops-npl-batch-adjust-footer-inline-form-reason">
                    <div class="ops-npl-batch-adjust-footer-section-head">
                      <strong>\u8c03\u4ef7\u539f\u56e0</strong>
                    </div>
                    <select class="ops-pd-control" data-npl-batch-adjust-setting="reasonCode">
                      ${renderOptions(BATCH_ADJUST_REASON_OPTIONS, state.batchAdjustDialogReasonCode, '\u8bf7\u9009\u62e9')}
                    </select>
                  </label>
                  <label class="ops-npl-batch-adjust-footer-field">
                    <div class="ops-npl-batch-adjust-footer-section-head">
                      <strong>\u5907\u6ce8</strong>
                    </div>
                    <input
                      class="ops-pd-control"
                      type="text"
                      maxlength="200"
                      placeholder="\u53ef\u8f93\u5165\u8c03\u4ef7\u5907\u6ce8"
                      value="${escapeHtml(normalizeText(state.batchAdjustDialogRemark))}"
                      data-npl-batch-adjust-setting="remark"
                    />
                  </label>
                </div>
              </section>
              <section class="ops-npl-batch-adjust-footer-section ops-npl-batch-adjust-footer-section-span-2">
                <div class="ops-npl-batch-adjust-footer-section-head">
                  <strong>\u6d3b\u52a8\u8c03\u4ef7</strong>
                  <button
                    class="ops-npl-batch-adjust-help"
                    type="button"
                    tabindex="-1"
                    title="${escapeHtml(BATCH_ADJUST_ACTIVITY_HELP_TEXT)}"
                    aria-label="${escapeHtml(BATCH_ADJUST_ACTIVITY_HELP_TEXT)}"
                  >?</button>
                </div>
                <div class="ops-npl-batch-adjust-footer-inline-grid">
                  <label class="ops-npl-batch-adjust-footer-field">
                    <span class="ops-npl-batch-adjust-footer-subtitle">\u6d3b\u52a8\u76f4\u51cf\u4ef7</span>
                    <div class="ops-npl-batch-adjust-inline-input">
                      <input
                        class="ops-pd-control"
                        type="text"
                        inputmode="decimal"
                        placeholder="0.00"
                        value="${escapeHtml(normalizeText(state.batchAdjustDialogActivityPriceReduction))}"
                        data-npl-batch-adjust-setting="activityPriceReduction"
                      />
                      <span class="ops-npl-batch-adjust-range-unit">\u5143</span>
                    </div>
                  </label>
                  <label class="ops-npl-batch-adjust-footer-field">
                    <span class="ops-npl-batch-adjust-footer-subtitle">\u6d3b\u52a8\u4fdd\u5e95\u5229\u6da6</span>
                    <div class="ops-npl-batch-adjust-profit-floor-inline">
                      <select class="ops-pd-control" data-npl-batch-adjust-setting="activityProfitFloorMode">
                        ${renderOptions(BATCH_ADJUST_PROFIT_FLOOR_MODE_OPTIONS, state.batchAdjustDialogActivityProfitFloorMode, '', {
                          includeEmpty: false
                        })}
                      </select>
                      <div class="ops-npl-batch-adjust-inline-input">
                        <input
                          class="ops-pd-control"
                          type="text"
                          inputmode="decimal"
                          placeholder="0.00"
                          value="${escapeHtml(normalizeText(state.batchAdjustDialogActivityProfitFloorValue))}"
                          data-npl-batch-adjust-setting="activityProfitFloorValue"
                        />
                        <span class="ops-npl-batch-adjust-range-unit">${escapeHtml(state.batchAdjustDialogActivityProfitFloorMode === 'value' ? '\u5143' : '%')}</span>
                      </div>
                    </div>
                  </label>
                </div>
              </section>
              <section class="ops-npl-batch-adjust-footer-section ops-npl-batch-adjust-footer-section-span-2">
                <div class="ops-npl-batch-adjust-footer-section-head">
                  <strong>\u65e5\u5e38\u8c03\u4ef7</strong>
                  <button
                    class="ops-npl-batch-adjust-help"
                    type="button"
                    tabindex="-1"
                    title="${escapeHtml(BATCH_ADJUST_DAILY_PROFIT_FLOOR_HELP_TEXT)}"
                    aria-label="${escapeHtml(BATCH_ADJUST_DAILY_PROFIT_FLOOR_HELP_TEXT)}"
                  >?</button>
                </div>
                <div class="ops-npl-batch-adjust-footer-inline-grid">
                  <label class="ops-npl-batch-adjust-footer-field">
                    <span class="ops-npl-batch-adjust-footer-subtitle">\u65e5\u5e38\u4fdd\u5e95\u5229\u6da6</span>
                    <div class="ops-npl-batch-adjust-profit-floor-inline">
                      <select class="ops-pd-control" data-npl-batch-adjust-setting="dailyProfitFloorMode">
                        ${renderOptions(BATCH_ADJUST_PROFIT_FLOOR_MODE_OPTIONS, state.batchAdjustDialogDailyProfitFloorMode, '', {
                          includeEmpty: false
                        })}
                      </select>
                      <div class="ops-npl-batch-adjust-inline-input">
                        <input
                          class="ops-pd-control"
                          type="text"
                          inputmode="decimal"
                          placeholder="0.00"
                          value="${escapeHtml(normalizeText(state.batchAdjustDialogDailyProfitFloorValue))}"
                          data-npl-batch-adjust-setting="dailyProfitFloorValue"
                        />
                        <span class="ops-npl-batch-adjust-range-unit">${escapeHtml(state.batchAdjustDialogDailyProfitFloorMode === 'value' ? '\u5143' : '%')}</span>
                      </div>
                    </div>
                  </label>
                  <div class="ops-npl-batch-adjust-footer-field">
                    <span class="ops-npl-batch-adjust-footer-subtitle">
                      \u65e5\u5e38\u8d85\u6b21\u6570\u6539\u5efa\u8bae\u4ef7
                      <button
                        class="ops-npl-batch-adjust-help"
                        type="button"
                        tabindex="-1"
                        title="${escapeHtml(BATCH_ADJUST_SUGGESTED_PRICE_FALLBACK_HELP_TEXT)}"
                        aria-label="${escapeHtml(BATCH_ADJUST_SUGGESTED_PRICE_FALLBACK_HELP_TEXT)}"
                      >?</button>
                    </span>
                    <div class="ops-npl-batch-adjust-inline-input ops-npl-batch-adjust-inline-input-compact">
                      <input
                        class="ops-pd-control"
                        type="text"
                        inputmode="numeric"
                        placeholder="0"
                        value="${escapeHtml(useSuggestedPriceAfterSubmitCount)}"
                        data-npl-batch-adjust-setting="useSuggestedPriceAfterSubmitCount"
                      />
                      <span class="ops-npl-batch-adjust-range-unit">\u6b21</span>
                    </div>
                  </div>
                </div>
              </section>
              <section class="ops-npl-batch-adjust-footer-section ops-npl-batch-adjust-footer-section-span-2">
                <div class="ops-npl-batch-adjust-submit-settings-row">
                  <div class="ops-npl-batch-adjust-submit-settings-block">
                    <div class="ops-npl-batch-adjust-footer-section-head ops-npl-batch-adjust-submit-settings-title">
                      <strong>\u63d0\u4ea4\u5185\u5bb9</strong>
                    </div>
                    <div class="ops-npl-batch-adjust-submit-toggle-list">
                      <label class="ops-npl-batch-adjust-submit-toggle${dailyEnabled ? ' is-active' : ''}">
                        <input
                          type="checkbox"
                          data-npl-batch-adjust-setting="dailyEnabled"
                          ${dailyEnabled ? ' checked' : ''}
                        />
                        <span>\u65e5\u5e38\u8c03\u4ef7</span>
                      </label>
                      <label class="ops-npl-batch-adjust-submit-toggle${activityEnabled ? ' is-active' : ''}">
                        <input
                          type="checkbox"
                          data-npl-batch-adjust-setting="activityEnabled"
                          ${activityEnabled ? ' checked' : ''}
                        />
                        <span>\u6d3b\u52a8\u8c03\u4ef7</span>
                      </label>
                    </div>
                  </div>
                  <div class="ops-npl-batch-adjust-submit-settings-block ops-npl-batch-adjust-submit-settings-block-filter">
                    <label class="ops-npl-batch-adjust-footer-field ops-npl-batch-adjust-submit-settings-field">
                      <div class="ops-npl-batch-adjust-footer-section-head ops-npl-batch-adjust-submit-settings-title">
                        <strong>\u91cd\u590d\u63d0\u4ea4\u8fc7\u6ee4</strong>
                        <button
                          class="ops-npl-batch-adjust-help"
                          type="button"
                          tabindex="-1"
                          title="${escapeHtml(BATCH_ADJUST_DUPLICATE_SUBMIT_HELP_TEXT)}"
                          aria-label="${escapeHtml(BATCH_ADJUST_DUPLICATE_SUBMIT_HELP_TEXT)}"
                        >?</button>
                      </div>
                      <div class="ops-npl-batch-adjust-inline-input ops-npl-batch-adjust-inline-input-compact">
                        <input
                          class="ops-pd-control"
                          type="text"
                          inputmode="numeric"
                          placeholder="0"
                          value="${escapeHtml(duplicateSubmitWindowDays)}"
                          data-npl-batch-adjust-setting="duplicateSubmitWindowDays"
                        />
                        <span class="ops-npl-batch-adjust-range-unit">\u5929</span>
                      </div>
                    </label>
                  </div>
                </div>
              </section>
            </div>
            `}
            <div class="ops-pd-quick-cost-actions">
              ${previewOpen ? `
              <button
                class="ops-pd-action-button is-secondary"
                type="button"
                data-npl-action="back-batch-adjust-submit-preview"
                ${submitBusy ? ' disabled' : ''}
              >
                \u8fd4\u56de\u4fee\u6539\u8bbe\u7f6e
              </button>
              ` : ''}
              <button
                class="ops-pd-action-button ${submitBusy ? 'ops-marketing-tools-action-button is-danger ops-npl-price-decl-action-stop' : 'is-primary ops-npl-batch-adjust-submit-button'}"
                type="button"
                data-npl-action="${submitBusy
                  ? 'cancel-batch-adjust'
                  : (previewOpen ? 'submit-batch-adjust-from-preview' : 'preview-batch-adjust')}"
                ${disableBatchAdjustPrimaryButton ? ' disabled' : ''}
              >
                ${submitRunning
                  ? '\u505c\u6b62\u63d0\u4ea4\u4efb\u52a1'
                  : (previewBusy
                    ? '\u505c\u6b62\u9884\u89c8\u4efb\u52a1'
                    : (state.batchAdjustDialogSaving === true
                      ? '\u540c\u6b65\u4e2d...'
                      : (previewOpen ? '\u63d0\u4ea4\u6279\u91cf\u8c03\u4ef7' : '\u6279\u91cf\u9884\u89c8\u8c03\u4ef7')))}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildPaginationItems(totalPages, currentPage) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_item, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
  }

  function renderProductList(state) {
    const rows = Array.isArray(state && state.rows) ? state.rows : [];
    const filteredRows = applyLocalFilters(rows, state && state.appliedFilters);
    const productGroups = buildProductGroups(filteredRows);
    const queryRunning = state && state.queryLoading === true;
    const hasQueried = state && state.hasQueried === true;
    const pageSize = Math.max(1, Number.parseInt(state && state.pageSize, 10) || 10);
    const totalPages = Math.max(1, Math.ceil(productGroups.length / pageSize));
    const currentPage = Math.min(Math.max(1, Number.parseInt(state && state.currentPage, 10) || 1), totalPages);
    const pageStartIndex = (currentPage - 1) * pageSize;
    const pageGroups = productGroups.slice(pageStartIndex, pageStartIndex + pageSize);
    const visibleRows = pageGroups.flatMap((group) => (
      Array.isArray(group && group.skuRows) ? group.skuRows : []
    ));
    const queryMeta = state && state.queryResultMeta ? state.queryResultMeta : null;
    const queryResultSkuCount = Math.max(0, normalizeIntegerValue(queryMeta && queryMeta.rowCount, rows.length));
    const queryResultProductCount = Math.max(
      0,
      normalizeIntegerValue(queryMeta && queryMeta.productCount, buildProductGroups(rows).length)
    );
    const productCount = productGroups.length;
    const totalSkuCount = filteredRows.length;
    const hasFilteredSummary = productCount !== queryResultProductCount || totalSkuCount !== queryResultSkuCount;
    const queryUpdatedAtText = queryMeta && queryMeta.updatedAt
      ? formatSummaryDateTimeLabel(queryMeta.updatedAt)
      : '';
    const feedbackItems = [];
    let emptyText = '\u8bf7\u5148\u8bbe\u7f6e\u6761\u4ef6\u5e76\u70b9\u51fb\u67e5\u8be2';

    if (state.queryLoading === true) {
      feedbackItems.push(...renderQueryProgressMessages(state));
      emptyText = '\u6b63\u5728\u67e5\u8be2\uff0c\u8bf7\u7a0d\u5019';
    } else if (state.queryProgress) {
      feedbackItems.push(...renderQueryProgressMessages(state));
    } else if (hasQueried) {
      emptyText = rows.length > 0
        ? '\u5f53\u524d\u6210\u672c\u4ef7\u7b5b\u9009\u4e0b\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684\u5546\u54c1'
        : '\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684\u5546\u54c1';
    }

    if (state.queryError) {
      feedbackItems.push({
        tone: 'is-error',
        text: state.queryError
      });
    }

    if (state.queryWarning) {
      feedbackItems.push({
        tone: 'is-warning',
        text: state.queryWarning
      });
    }

    if (rows.length > 0 && filteredRows.length <= 0) {
      feedbackItems.push({
        tone: 'is-warning',
        text: '\u5f53\u524d\u6210\u672c\u4ef7\u72b6\u6001\u7b5b\u9009\u5df2\u5c06\u67e5\u8be2\u7ed3\u679c\u5168\u90e8\u8fc7\u6ee4\uff0c\u8bf7\u8c03\u6574\u540e\u518d\u70b9\u51fb\u201c\u7b5b\u9009\u201d'
      });
    }

    return `
      <section class="ops-npl-query-feedback">
        ${feedbackItems.map((item) => `
          <div class="ops-npl-query-message ${escapeHtml(item.tone)}">${escapeHtml(item.text)}</div>
        `).join('')}
      </section>

      <section class="ops-pm-tab-strip ops-npl-product-summary">
        <div class="ops-npl-summary-shell">
          <div class="ops-npl-summary-actions">
            <label class="ops-pd-field is-inline-control ops-npl-cost-filter">
              <span class="ops-pd-field-label">\u6210\u672c\u4ef7\u72b6\u6001</span>
              <span class="ops-pd-field-content">
                <select class="ops-pd-control" data-npl-filter="costState">
                  ${renderOptions(COST_STATE_OPTIONS, state && state.filters && state.filters.costState, '', {
                    includeEmpty: false
                  })}
                </select>
              </span>
            </label>
            <button
              class="ops-pd-action-button is-primary"
              type="button"
              data-npl-action="open-quick-cost-preset"
              ${queryRunning || filteredRows.length <= 0 ? ' disabled' : ''}
            >
              \u5feb\u901f\u9884\u8bbe\u6210\u672c\u4ef7
            </button>
            <button
              class="ops-pd-action-button is-danger"
              type="button"
              data-npl-action="open-batch-adjust"
              ${queryRunning || filteredRows.length <= 0 ? ' disabled' : ''}
            >
              \u6279\u91cf\u53d1\u8d77\u8c03\u4ef7
            </button>
            <button
              class="ops-pd-action-button is-danger"
              type="button"
              data-npl-action="open-batch-price-declaration"
              ${queryRunning || filteredRows.length <= 0 ? ' disabled' : ''}
            >
              \u6279\u91cf\u7533\u62a5\u6838\u4ef7
            </button>
          </div>
          <div class="ops-pm-summary ops-npl-summary-metrics">
            <span class="ops-npl-summary-chip">
              <span>\u603b\u8ba1</span>
              <strong>${escapeHtml(String(queryResultProductCount))}\u5546\u54c1 / ${escapeHtml(String(queryResultSkuCount))}SKU</strong>
            </span>
            ${hasFilteredSummary ? `
              <span class="ops-npl-summary-chip">
                <span>\u7b5b\u9009</span>
                <strong>${escapeHtml(String(productCount))}\u5546\u54c1 / ${escapeHtml(String(totalSkuCount))}SKU</strong>
              </span>
            ` : ''}
            <span class="ops-npl-summary-chip">
              <span>\u672c\u9875</span>
              <strong>${escapeHtml(String(pageGroups.length))}\u5546\u54c1 / ${escapeHtml(String(visibleRows.length))}SKU</strong>
            </span>
            ${queryUpdatedAtText ? `
              <span class="ops-npl-summary-chip is-time">
                <span>\u66f4\u65b0</span>
                <strong>${escapeHtml(queryUpdatedAtText)}</strong>
              </span>
            ` : ''}
          </div>
        </div>
      </section>

      <section class="ops-pm-table-card ops-npl-table-card">
        <div class="ops-pm-table-scroll">
          <table class="ops-pm-table">
            <thead>
              <tr>
                <th class="ops-npl-index-cell">#</th>
                <th>\u5546\u54c1\u4fe1\u606f</th>
                <th>SKU ID</th>
                <th>SKU\u5546\u54c1\u56fe</th>
                <th>\u5546\u54c1\u89c4\u683c</th>
                <th>\u7ad9\u70b9</th>
                <th>SKU\u72b6\u6001 / \u5904\u7406\u65b9\u5f0f</th>
                <th>\u7533\u62a5\u4ef7\u683c</th>
                <th>\u6210\u672c\u4ef7</th>
                <th>\u5229\u6da6\u7387(\u6309\u7533\u62a5\u4ef7)</th>
                <th>\u66f4\u65b0\u65f6\u95f4</th>
              </tr>
            </thead>
            <tbody>
              ${pageGroups.length > 0
                ? pageGroups.map((group, index) => {
                  return renderLifecycleProductGroup(group, pageStartIndex + index + 1);
                }).join('')
                : `
                  <tr>
                    <td colspan="11" class="ops-pm-empty-cell">
                      ${escapeHtml(emptyText)}
                    </td>
                  </tr>
                `}
            </tbody>
          </table>
        </div>

        <div class="ops-pm-pagination">
          <div class="ops-pm-pagination-summary">
            <span>\u5171 ${escapeHtml(String(productCount))} \u4e2a\u5546\u54c1 / ${escapeHtml(String(totalSkuCount))} \u4e2aSKU</span>
            <label class="ops-pm-page-size">
              <select class="ops-pm-control" data-npl-page-size="true">
                ${PAGE_SIZE_OPTIONS.map((option) => {
                  return `<option value="${option}"${pageSize === option ? ' selected' : ''}>${option}\u4e2a\u5546\u54c1/\u9875</option>`;
                }).join('')}
              </select>
            </label>
          </div>
          <div class="ops-pm-page-controls">
            <button
              class="ops-pm-page-button"
              type="button"
              data-npl-page="prev"
              ${currentPage <= 1 ? ' disabled' : ''}
            >&lsaquo;</button>
            ${buildPaginationItems(totalPages, currentPage).map((item) => {
              if (item === 'ellipsis') {
                return '<span class="ops-pm-page-ellipsis">\u2026</span>';
              }

              return `
                <button
                  class="ops-pm-page-button${item === currentPage ? ' is-active' : ''}"
                  type="button"
                  data-npl-page="${escapeHtml(String(item))}"
                  ${item === currentPage ? ' disabled' : ''}
                >${escapeHtml(String(item))}</button>
              `;
            }).join('')}
            <button
              class="ops-pm-page-button"
              type="button"
              data-npl-page="next"
              ${currentPage >= totalPages ? ' disabled' : ''}
            >&rsaquo;</button>
          </div>
        </div>
      </section>
    `;
  }

  function readElementScrollPosition(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    return {
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft
    };
  }

  function restoreElementScrollPosition(element, position) {
    if (!(element instanceof HTMLElement) || !position) {
      return;
    }

    element.scrollTop = Number.isFinite(position.scrollTop) ? position.scrollTop : 0;
    element.scrollLeft = Number.isFinite(position.scrollLeft) ? position.scrollLeft : 0;
  }

  function captureRenderScrollState(container, state) {
    if (!(container instanceof HTMLElement) || !state) {
      return {};
    }

    return {
      batchAdjustDialogBody: state.batchAdjustDialogOpen === true
        ? readElementScrollPosition(container.querySelector('.ops-npl-batch-adjust-body'))
        : null,
      batchAdjustPreviewBody: state.batchAdjustPreviewShopId
        ? readElementScrollPosition(container.querySelector('.ops-npl-batch-adjust-preview-dialog-body'))
        : null,
      batchAdjustSubmitPreviewWrap: state.batchAdjustSubmitPreviewOpen === true
        ? readElementScrollPosition(container.querySelector('[data-npl-batch-adjust-submit-preview-wrap="true"]'))
        : null,
      priceDeclDialogBody: state.priceDeclDialogOpen === true
        ? readElementScrollPosition(container.querySelector('.ops-pd-quick-cost-body'))
        : null,
      priceDeclPreviewTableWrap: state.priceDeclPreviewOpen === true
        ? readElementScrollPosition(container.querySelector('[data-npl-price-decl-preview-table-wrap="true"]'))
        : null
    };
  }

  function restoreRenderScrollState(container, scrollState) {
    if (!(container instanceof HTMLElement) || !scrollState) {
      return;
    }

    const state = getState(container);

    restoreElementScrollPosition(
      container.querySelector('.ops-npl-batch-adjust-body'),
      scrollState.batchAdjustDialogBody
    );
    restoreElementScrollPosition(
      container.querySelector('.ops-npl-batch-adjust-preview-dialog-body'),
      scrollState.batchAdjustPreviewBody
    );
    restoreElementScrollPosition(
      container.querySelector('[data-npl-batch-adjust-submit-preview-wrap="true"]'),
      scrollState.batchAdjustSubmitPreviewWrap
    );
    restoreElementScrollPosition(
      container.querySelector('.ops-pd-quick-cost-body'),
      scrollState.priceDeclDialogBody
    );
    restoreElementScrollPosition(
      container.querySelector('[data-npl-price-decl-preview-table-wrap="true"]'),
      scrollState.priceDeclPreviewTableWrap
    );

    if (state.priceDeclPreviewResetScroll === true) {
      restoreElementScrollPosition(
        container.querySelector('[data-npl-price-decl-preview-table-wrap="true"]'),
        { scrollTop: 0, scrollLeft: 0 }
      );
      state.priceDeclPreviewResetScroll = false;
    }

    if (state.batchAdjustSubmitPreviewResetScroll === true) {
      restoreElementScrollPosition(
        container.querySelector('[data-npl-batch-adjust-submit-preview-wrap="true"]'),
        { scrollTop: 0, scrollLeft: 0 }
      );
      state.batchAdjustSubmitPreviewVirtualScrollTop = 0;
      state.batchAdjustSubmitPreviewResetScroll = false;
    }
  }

  function renderBatchPriceDeclDialog(state) {
    if (!state || state.priceDeclDialogOpen !== true) {
      return '';
    }

    const approveUseCostPrice = Boolean(state.priceDeclDialogApproveUseCostPrice);
    const approveCondition = normalizeText(state.priceDeclDialogApproveCondition) || 'profitRate';
    const approveValue = normalizeText(state.priceDeclDialogApproveValue);
    const approveReduceType = normalizePriceDeclReduceType(state.priceDeclDialogApproveReduceType);
    const approveReduceValue = getPriceDeclReduceValueByType(state, approveReduceType);
    const redeclareUseLastReduce = Boolean(state.priceDeclDialogRedeclareUseLastReduce);
    const redeclareCondition = normalizeText(state.priceDeclDialogRedeclareCondition) || 'profitRate';
    const redeclareValue = normalizeText(state.priceDeclDialogRedeclareValue);
    const voidMaxAttempts = normalizeText(state.priceDeclDialogVoidMaxAttempts) || '3';
    const eligibleCount = Number(state.priceDeclDialogEligibleCount) || 0;
    const errorText = normalizeText(state.priceDeclDialogError);
    const saving = Boolean(state.priceDeclDialogSaving);
    const previewSaving = Boolean(state.priceDeclPreviewSaving);
    const submitBusy = saving || previewSaving;
    const resultText = normalizeText(state.priceDeclDialogResult);
    const previewRetryMode = Boolean(state.priceDeclPreviewRetryMode);
    const submitProgress = normalizePriceDeclSubmitProgressPayload(state.priceDeclSubmitProgress);

    const CONDITION_OPTIONS = [
      { value: 'profitRate', label: '利润率' },
      { value: 'profitValue', label: '利润值' }
    ];
    const REDUCE_TYPE_OPTIONS = [
      { value: 'discount', label: '按百分比折扣' },
      { value: 'flatReduce', label: '直接减金额' }
    ];

    return `
      <div class="ops-pd-quick-cost-modal" data-npl-price-decl-backdrop="true">
        <div class="ops-pd-quick-cost-dialog ops-npl-price-decl-dialog${state.priceDeclPreviewOpen ? ' is-preview-open' : ''}" data-npl-price-decl-panel="true">
          <div class="ops-pd-quick-cost-header">
            <div class="ops-pd-quick-cost-title-block">
              <h3 class="ops-pd-quick-cost-title">批量预览核价</h3>
              <p class="ops-pd-quick-cost-subtitle">共 ${eligibleCount} 个「价格申报-待卖家确认」商品可进行核价设置</p>
            </div>
            <div class="ops-npl-batch-adjust-header-actions">
              <button
                class="ops-pd-action-button is-secondary ops-npl-price-decl-header-close"
                type="button"
                data-npl-action="close-batch-price-declaration"
                ${submitBusy ? 'disabled' : ''}
              >
                关闭
              </button>
            </div>
          </div>

          <div class="ops-pd-quick-cost-body">
            <div data-npl-price-decl-submit-runtime="true">${renderPriceDeclSubmitRuntimeMarkup(state)}</div>
            ${!state.priceDeclPreviewOpen ? `
            <section class="ops-pd-quick-cost-group ops-npl-price-decl-card">
              <!-- 核价条件 -->
              <div class="ops-npl-price-decl-block">
                <div class="ops-npl-price-decl-block-header">
                  <span class="ops-npl-price-decl-block-step">1</span>
                  <strong>核价条件</strong>
                </div>
                <div class="ops-npl-price-decl-block-body">
                  <div class="ops-npl-price-decl-flow-tip" role="note" aria-label="核价判断顺序">
                    <span class="ops-npl-price-decl-flow-tip-label">\u6838\u4ef7\u94fe\u8def</span>
                    <span class="ops-npl-price-decl-flow-tip-text">\u5148\u5224\u65ad\u300c\u901a\u8fc7\u6838\u4ef7\u6761\u4ef6\u300d\uff0c\u518d\u5224\u65ad\u300c\u4fdd\u5e95\u6838\u4ef7\u901a\u8fc7\u6761\u4ef6\u300d\uff1b\u90fd\u4e0d\u547d\u4e2d\u65f6\uff0c\u6838\u4ef7\u6b21\u6570\u8d85\u8fc7\u4f5c\u5e9f\u6761\u4ef6\u5219\u4f5c\u5e9f\uff0c\u5426\u5219\u8fdb\u5165\u91cd\u65b0\u6838\u4ef7\u3002</span>
                  </div>
                  <label class="ops-npl-price-decl-check-row">
                    <input type="checkbox" data-npl-price-decl-setting="approveUseCostPrice"${approveUseCostPrice ? ' checked' : ''}>
                    以成本价为基础计算
                  </label>
                  <div class="ops-npl-price-decl-condition-row">
                    <span class="ops-npl-price-decl-label ops-npl-price-decl-label-chip is-approve">通过核价条件：</span>
                    <span class="ops-npl-price-decl-text is-approve">申报价对比</span>
                    <select class="ops-pd-control" data-npl-price-decl-setting="approveCondition">
                      ${CONDITION_OPTIONS.map((opt) => `
                        <option value="${escapeHtml(opt.value)}"${approveCondition === opt.value ? ' selected' : ''}>${escapeHtml(opt.label)}</option>
                      `).join('')}
                    </select>
                    <span class="ops-npl-price-decl-comparator">≥</span>
                    <input class="ops-pd-control" type="number" data-npl-price-decl-setting="approveValue" value="${escapeHtml(approveValue)}" placeholder="数值" min="0" step="any">
                    <span class="ops-npl-price-decl-unit">${approveCondition === 'profitValue' ? '元' : '%'}</span>
                    <span class="ops-npl-price-decl-text is-approve">通过核价</span>
                  </div>
                  <div class="ops-npl-price-decl-condition-row">
                    <span class="ops-npl-price-decl-label ops-npl-price-decl-label-chip is-redecl">重新核价条件：</span>
                    <span class="ops-npl-price-decl-text is-redecl">按上次申报价重新计算</span>
                    <select class="ops-pd-control" data-npl-price-decl-setting="approveReduceType">
                      ${REDUCE_TYPE_OPTIONS.map((opt) => `
                        <option value="${escapeHtml(opt.value)}"${approveReduceType === opt.value ? ' selected' : ''}>${escapeHtml(opt.label)}</option>
                      `).join('')}
                    </select>
                    <input class="ops-pd-control" type="number" data-npl-price-decl-setting="approveReduceValue" value="${escapeHtml(approveReduceValue)}" placeholder="数值" min="0" step="any">
                    <span class="ops-npl-price-decl-unit">${approveReduceType === 'flatReduce' ? '元' : '%'}</span>
                    <span class="ops-npl-price-decl-text is-redecl">重新核价</span>
                  </div>
                  <div class="ops-npl-price-decl-condition-row ops-npl-price-decl-condition-row-sub">
                    <span class="ops-npl-price-decl-label ops-npl-price-decl-label-chip is-void">作废核价条件：</span>
                    <span class="ops-npl-price-decl-text is-void">核价次数超过</span>
                    <input class="ops-pd-control ops-npl-price-decl-count-input" type="number" data-npl-price-decl-setting="voidMaxAttempts" value="${escapeHtml(voidMaxAttempts)}" min="1" step="1">
                    <span class="ops-npl-price-decl-text is-void">作废核价</span>
                  </div>
                </div>
              </div>
              ${renderPriceDeclFallbackApproveRulesCard(state)}
            </section>
            ` : ''}
            ${renderPriceDeclPreviewTable(state)}
          </div>

          <div class="ops-pd-quick-cost-footer ops-npl-price-decl-footer">
            <div class="ops-npl-price-decl-footer-spacer"></div>
            <div class="ops-pd-quick-cost-actions ops-npl-price-decl-actions">
              <button
                class="ops-pd-action-button ops-npl-price-decl-action ${submitBusy ? 'ops-npl-price-decl-action-stop' : 'is-secondary ops-npl-price-decl-action-secondary'}"
                type="button"
                data-npl-action="${submitBusy ? 'cancel-batch-price-declaration' : 'close-batch-price-declaration'}"
              >
                ${submitBusy ? '停止任务' : '取消'}
              </button>
              ${state.priceDeclPreviewOpen ? `
              <button
                class="ops-pd-action-button is-primary ops-npl-price-decl-action ops-npl-price-decl-action-primary"
                type="button"
                data-npl-action="submit-batch-price-declaration-from-preview"
                ${submitBusy ? 'disabled' : ''}
              >
                ${previewSaving ? '提交中...' : '批量提交核价'}
              </button>
              ` : `
              <button
                class="ops-pd-action-button is-primary ops-npl-price-decl-action ops-npl-price-decl-action-primary"
                type="button"
                data-npl-action="preview-batch-price-declaration"
                ${submitBusy ? 'disabled' : ''}
              >
                ${saving ? '预览中...' : '批量预览核价'}
              </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPriceDeclSubmitRuntimeMarkup(state) {
    const saving = Boolean(state && state.priceDeclDialogSaving);
    const previewSaving = Boolean(state && state.priceDeclPreviewSaving);
    const submitBusy = saving || previewSaving;
    const submitProgress = normalizePriceDeclSubmitProgressPayload(state && state.priceDeclSubmitProgress);
    const errorText = normalizeText(state && state.priceDeclDialogError);
    const resultText = normalizeText(state && state.priceDeclDialogResult);

    return `
      ${submitBusy && submitProgress ? renderPriceDeclSubmitProgressMarkup(submitProgress) : ''}
      ${submitBusy && !submitProgress ? `
        <div style="margin-bottom:12px;padding:10px 16px;border-radius:10px;background:#f0f9ff;color:#2563eb;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:14px;height:14px;border:2px solid #2563eb;border-top-color:transparent;border-radius:50%;animation:ops-spin 0.6s linear infinite;"></span>
          ${saving ? '\u6b63\u5728\u51c6\u5907\u6838\u4ef7\u4efb\u52a1\uff0c\u8bf7\u7a0d\u5019...' : '\u6b63\u5728\u63d0\u4ea4\u6838\u4ef7\u4efb\u52a1\uff0c\u8bf7\u7a0d\u5019...'}
        </div>
      ` : ''}
      ${errorText ? `
        <div style="margin-bottom:12px;padding:10px 16px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px;font-weight:500;border:1px solid #fecaca;">
          ${escapeHtml(errorText)}
        </div>
      ` : ''}
      ${resultText ? `
        <div style="margin-bottom:12px;padding:10px 16px;border-radius:10px;background:#f0fdf4;color:#16a34a;font-size:13px;font-weight:500;border:1px solid #bbf7d0;">
          ${escapeHtml(resultText)}
        </div>
      ` : ''}
    `;
  }

  function renderPriceDeclFallbackApproveRuleRow(rule, index, totalRules) {
    const normalizedRule = normalizePriceDeclFallbackApproveRule(rule);
    const ruleId = normalizeText(normalizedRule && normalizedRule.id);
    const logicMode = normalizePriceDeclFallbackApproveRuleLogicMode(
      normalizedRule && normalizedRule.profitLogicMode
    );

    return `
      <div class="ops-npl-price-decl-fallback-rule-row">
        <span class="ops-npl-price-decl-text is-approve">核价次数超过</span>
        <input
          class="ops-pd-control ops-npl-price-decl-fallback-count-input"
          type="number"
          min="0"
          step="1"
          value="${escapeHtml(normalizedRule.reviewTimesMin)}"
          data-npl-price-decl-rule-id="${escapeHtml(ruleId)}"
          data-npl-price-decl-rule-field="reviewTimesMin"
        >
        <span class="ops-npl-price-decl-unit">次</span>
        <span class="ops-npl-price-decl-text is-approve">利润率≥设置</span>
        <input
          class="ops-pd-control ops-npl-price-decl-fallback-rate-input"
          type="number"
          min="0"
          step="any"
          value="${escapeHtml(normalizedRule.profitRateValue)}"
          data-npl-price-decl-rule-id="${escapeHtml(ruleId)}"
          data-npl-price-decl-rule-field="profitRateValue"
        >
        <span class="ops-npl-price-decl-unit">%</span>
        <select
          class="ops-pd-control ops-npl-price-decl-fallback-logic-select"
          data-npl-price-decl-rule-id="${escapeHtml(ruleId)}"
          data-npl-price-decl-rule-field="profitLogicMode"
        >
          <option value="or"${logicMode === 'or' ? ' selected' : ''}>或</option>
          <option value="and"${logicMode === 'and' ? ' selected' : ''}>且</option>
        </select>
        <span class="ops-npl-price-decl-text is-approve">利润值≥设置</span>
        <input
          class="ops-pd-control ops-npl-price-decl-fallback-value-input"
          type="number"
          min="0"
          step="any"
          value="${escapeHtml(normalizedRule.profitValueValue)}"
          data-npl-price-decl-rule-id="${escapeHtml(ruleId)}"
          data-npl-price-decl-rule-field="profitValueValue"
        >
        <span class="ops-npl-price-decl-unit">元</span>
        <button
          class="ops-pd-action-button is-secondary ops-npl-price-decl-fallback-row-action"
          type="button"
          data-npl-action="copy-price-decl-fallback-rule"
          data-npl-price-decl-rule-id="${escapeHtml(ruleId)}"
        >
          复制此行
        </button>
        <button
          class="ops-pd-action-button is-secondary ops-npl-price-decl-fallback-row-action"
          type="button"
          data-npl-action="remove-price-decl-fallback-rule"
          data-npl-price-decl-rule-id="${escapeHtml(ruleId)}"
          ${totalRules <= 1 && index <= 0 ? ' disabled' : ''}
        >
          删除
        </button>
      </div>
    `;
  }

  function renderPriceDeclFallbackApproveRulesCard(state) {
    const rules = normalizePriceDeclFallbackApproveRuleList(state && state.priceDeclDialogFallbackApproveRules);
    const visibleRules = rules.length > 0
      ? rules
      : [createDefaultPriceDeclFallbackApproveRule()];

    return `
      <div class="ops-npl-price-decl-fallback-card">
        <div class="ops-npl-price-decl-fallback-card-header">
          <span class="ops-npl-price-decl-label ops-npl-price-decl-label-chip is-approve">保底核价通过条件</span>
          <span class="ops-npl-price-decl-fallback-card-hint">命中任一行即通过核价</span>
        </div>
        <div class="ops-npl-price-decl-fallback-rule-list">
          ${visibleRules.map((rule, index) => renderPriceDeclFallbackApproveRuleRow(rule, index, visibleRules.length)).join('')}
        </div>
      </div>
    `;
  }

  function refreshPriceDeclSubmitRuntime(container) {
    const state = getState(container);
    const runtimeHost = container.querySelector('[data-npl-price-decl-submit-runtime="true"]');

    if (!(runtimeHost instanceof HTMLElement)) {
      return false;
    }

    runtimeHost.innerHTML = renderPriceDeclSubmitRuntimeMarkup(state);
    return true;
  }

  function schedulePriceDeclSubmitRuntimeRefresh(container) {
    const state = getState(container);

    if (state.priceDeclSubmitRuntimeFrame) {
      return;
    }

    state.priceDeclSubmitRuntimeFrame = window.requestAnimationFrame(() => {
      state.priceDeclSubmitRuntimeFrame = 0;

      if (refreshPriceDeclSubmitRuntime(container) !== true) {
        render(container);
      }
    });
  }

  function openBatchPriceDeclDialog(container) {
    const state = getState(container);
    const visibleRows = applyLocalFilters(state.rows, state.appliedFilters);
    const eligibleRows = visibleRows.filter((row) => {
      const status = normalizeProductStatus(row && row.status);
      return status === 'pricePendingSellerConfirm' && hasCostPriceConfigured(row);
    });

    if (eligibleRows.length <= 0) {
      state.priceDeclDialogError = '没有符合条件的商品：当前筛选结果中无「价格申报-待卖家确认」且已设置成本价的商品';
      state.priceDeclDialogOpen = false;
      render(container);
      return;
    }

    state.priceDeclDialogOpen = true;
    state.priceDeclDialogEligibleRows = eligibleRows;
    state.priceDeclDialogEligibleCount = eligibleRows.length;
    state.priceDeclDialogError = '';
    state.priceDeclDialogResult = '';
    state.priceDeclDialogSaving = false;
    state.priceDeclSubmitRunId = '';
    state.priceDeclSubmitProgress = null;
    resetPriceDeclPreviewState(state);

    // Load saved settings from cloud/local
    const featureCenterApi = getFeatureCenterApi();
    if (featureCenterApi && typeof featureCenterApi.getOperationsNewProductLifecyclePriceDeclSettings === 'function') {
      featureCenterApi.getOperationsNewProductLifecyclePriceDeclSettings().then((result) => {
        const saved = result && result.settings;
        if (saved) {
          applyPriceDeclSettings(state, saved);
          render(container);
        }
      }).catch(() => {
        // Ignore load failure, use defaults
      });
    }

    render(container);
  }

  function closeBatchPriceDeclDialog(container) {
    const state = getState(container);
    state.priceDeclDialogOpen = false;
    state.priceDeclDialogApproveUseCostPrice = false;
    state.priceDeclDialogApproveCondition = 'profitRate';
    state.priceDeclDialogApproveValue = '';
    state.priceDeclDialogRedeclareUseLastReduce = true;
    state.priceDeclDialogRedeclareCondition = 'profitRate';
    state.priceDeclDialogRedeclareValue = '';
    state.priceDeclDialogFallbackApproveRules = [createDefaultPriceDeclFallbackApproveRule()];
    state.priceDeclDialogApproveReduceType = 'discount';
    state.priceDeclDialogApproveReduceValue = '';
    state.priceDeclDialogApproveReduceValueDiscount = '';
    state.priceDeclDialogApproveReduceValueFlatReduce = '';
    state.priceDeclDialogVoidMaxAttempts = '3';
    state.priceDeclDialogError = '';
    state.priceDeclDialogResult = '';
    state.priceDeclDialogSaving = false;
    state.priceDeclSubmitRunId = '';
    state.priceDeclSubmitProgress = null;
    state.priceDeclDialogEligibleRows = [];
    state.priceDeclDialogEligibleCount = 0;
    resetPriceDeclPreviewState(state);
    render(container);
  }

  function collectPriceDeclSettings(state) {
    return {
      approveUseCostPrice: Boolean(state.priceDeclDialogApproveUseCostPrice),
      approveCondition: normalizeText(state.priceDeclDialogApproveCondition) || 'profitRate',
      approveValue: normalizeText(state.priceDeclDialogApproveValue),
      fallbackApproveRules: buildConfiguredPriceDeclFallbackApproveRuleList(
        state.priceDeclDialogFallbackApproveRules
      ),
      approveReduceType: normalizePriceDeclReduceType(state.priceDeclDialogApproveReduceType),
      approveReduceValue: getPriceDeclReduceValueByType(
        state,
        state.priceDeclDialogApproveReduceType
      ),
      approveReduceValueDiscount: normalizeText(state.priceDeclDialogApproveReduceValueDiscount),
      approveReduceValueFlatReduce: normalizeText(state.priceDeclDialogApproveReduceValueFlatReduce),
      voidMaxAttempts: normalizeText(state.priceDeclDialogVoidMaxAttempts) || '3'
    };
  }

  function applyPriceDeclSettings(state, settings) {
    if (!state || !settings || typeof settings !== 'object') {
      return;
    }

    state.priceDeclDialogApproveUseCostPrice = Boolean(settings.approveUseCostPrice);
    state.priceDeclDialogApproveCondition = normalizeText(settings.approveCondition) || 'profitRate';
    state.priceDeclDialogApproveValue = normalizeText(settings.approveValue);
    const nextFallbackApproveRules = normalizePriceDeclFallbackApproveRuleList(
      settings.fallbackApproveRules
    );
    state.priceDeclDialogFallbackApproveRules = nextFallbackApproveRules.length > 0
      ? nextFallbackApproveRules
      : [createDefaultPriceDeclFallbackApproveRule()];
    const nextReduceType = normalizePriceDeclReduceType(settings.approveReduceType);
    state.priceDeclDialogApproveReduceValueDiscount = normalizeText(
      settings.approveReduceValueDiscount
    );
    state.priceDeclDialogApproveReduceValueFlatReduce = normalizeText(
      settings.approveReduceValueFlatReduce
    );
    setPriceDeclReduceValueByType(
      state,
      nextReduceType,
      nextReduceType === 'flatReduce'
        ? normalizeText(settings.approveReduceValueFlatReduce || settings.approveReduceValue)
        : normalizeText(settings.approveReduceValueDiscount || settings.approveReduceValue)
    );
    state.priceDeclDialogVoidMaxAttempts = normalizeText(settings.voidMaxAttempts) || '3';
  }

  async function persistPriceDeclSettings(featureCenterApi, state, settingsOverride = null) {
    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsNewProductLifecyclePriceDeclSettings !== 'function'
    ) {
      return null;
    }

    try {
      return await featureCenterApi.saveOperationsNewProductLifecyclePriceDeclSettings(
        settingsOverride && typeof settingsOverride === 'object'
          ? settingsOverride
          : collectPriceDeclSettings(state)
      );
    } catch (_error) {
      return null;
    }
  }

  function getPriceDeclRunValidationError(state) {
    if (Boolean(state.priceDeclDialogApproveUseCostPrice) !== true) {
      return '\u8bf7\u5148\u52fe\u9009\u201c\u4ee5\u6210\u672c\u4ef7\u4e3a\u57fa\u7840\u8ba1\u7b97\u201d\uff0c\u672a\u52fe\u9009\u65f6\u4e0d\u53ef\u8fdb\u884c\u4e0b\u4e00\u6b65\u6838\u4ef7\u9884\u89c8';
    }

    if (!normalizeText(state.priceDeclDialogApproveValue)) {
      return '\u8bf7\u8bbe\u7f6e\u540c\u610f\u6838\u4ef7\u7684\u5229\u6da6\u6761\u4ef6\u6570\u503c';
    }

    if (!normalizeText(state.priceDeclDialogApproveReduceValue)) {
      return '\u8bf7\u8bbe\u7f6e\u91cd\u65b0\u6838\u4ef7\u7684\u51cf\u5c11\u6570\u503c';
    }

    const fallbackApproveRules = normalizePriceDeclFallbackApproveRuleList(
      state.priceDeclDialogFallbackApproveRules
    );
    if (fallbackApproveRules.some((rule) => hasPartialPriceDeclFallbackApproveRule(rule))) {
      return '\u8bf7\u5b8c\u5584\u4fdd\u5e95\u6838\u4ef7\u901a\u8fc7\u6761\u4ef6\uff0c\u6bcf\u884c\u90fd\u9700\u586b\u5199\u6838\u4ef7\u6b21\u6570\u3001\u5229\u6da6\u7387\u548c\u5229\u6da6\u503c';
    }

    const voidAttempts = Number(state.priceDeclDialogVoidMaxAttempts) || 0;
    if (voidAttempts < 1) {
      return '\u4f5c\u5e9f\u6838\u4ef7\uff1a\u6838\u4ef7\u6b21\u6570\u5fc5\u987b\u5927\u4e8e\u7b49\u4e8e 1';
    }

    return '';
  }

  function buildPriceDeclPreviewShopSummaries(previewItems, resultsByShop) {
    const summaryMap = new Map();

    function getSummaryKey(shopId, shopName) {
      return normalizeText(shopId) || normalizeText(shopName);
    }

    function ensureSummary(shopId, shopName) {
      const key = getSummaryKey(shopId, shopName);

      if (!key) {
        return null;
      }

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          key,
          shopId: normalizeText(shopId),
          shopName: normalizeText(shopName) || normalizeText(shopId),
          total: 0,
          approve: 0,
          redeclare: 0,
          void: 0,
          skip: 0,
          success: true,
          message: '',
          items: []
        });
      }

      return summaryMap.get(key);
    }

    (Array.isArray(resultsByShop) ? resultsByShop : []).forEach((result) => {
      const summary = ensureSummary(result && result.shopId, result && result.shopName);

      if (!summary) {
        return;
      }

      summary.success = result && result.success !== false;
      summary.message = normalizeText(result && result.message);
    });

    (Array.isArray(previewItems) ? previewItems : []).forEach((item) => {
      const summary = ensureSummary(item && item.shopId, item && item.shopName);

      if (!summary) {
        return;
      }

      summary.items.push(item);
      summary.total += 1;

      if (item && item.supplierResult === 1) {
        summary.approve += 1;
      } else if (item && item.supplierResult === 2) {
        summary.redeclare += 1;
      } else if (item && item.supplierResult === 3) {
        summary.void += 1;
      } else {
        summary.skip += 1;
      }
    });

    return Array.from(summaryMap.values())
      .map((summary) => ({
        ...summary,
        items: summary.items.slice().sort((left, right) => (
          normalizeText(left && left.productName).localeCompare(
            normalizeText(right && right.productName),
            'zh-CN'
          )
          || normalizeText(left && left.spec).localeCompare(
            normalizeText(right && right.spec),
            'zh-CN'
          )
          || normalizeText(left && left.productSkuId).localeCompare(
            normalizeText(right && right.productSkuId),
            'zh-CN'
          )
        ))
      }))
      .sort((left, right) => (
        normalizeText(left && left.shopName).localeCompare(
          normalizeText(right && right.shopName),
          'zh-CN'
        )
      ));
  }

  function normalizePriceDeclPreviewResultType(item) {
    const result = Number(item && item.supplierResult);

    if (result === 1) return 'approve';
    if (result === 2) return 'redeclare';
    if (result === 3) return 'void';
    return 'skip';
  }

  function getPriceDeclPreviewResultLabel(item) {
    const resultType = normalizePriceDeclPreviewResultType(item);
    const labelMap = {
      approve: '\u901a\u8fc7\u6838\u4ef7',
      redeclare: '\u91cd\u65b0\u6838\u4ef7',
      void: '\u4f5c\u5e9f\u6838\u4ef7',
      skip: '\u8df3\u8fc7'
    };

    return labelMap[resultType] || '\u8df3\u8fc7';
  }

  function buildPriceDeclPreviewRequestKey(shopId, priceOrderId, supplierResult) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedPriceOrderId = Number(priceOrderId) || 0;
    const normalizedSupplierResult = Number(supplierResult) || 0;

    if (!normalizedShopId || normalizedPriceOrderId <= 0 || normalizedSupplierResult <= 0) {
      return '';
    }

    return `${normalizedShopId}::${normalizedPriceOrderId}::${normalizedSupplierResult}`;
  }

  function getPriceDeclPreviewRequestKeyFromItem(item) {
    return buildPriceDeclPreviewRequestKey(
      item && item.shopId,
      item && item.priceOrderId,
      item && item.supplierResult
    );
  }

  function summarizePriceDeclPreviewItems(items) {
    const summary = createDefaultPriceDeclPreviewSummary();

    (Array.isArray(items) ? items : []).forEach((item) => {
      summary.total += 1;

      if (item && item.supplierResult === 1) {
        summary.approve += 1;
      } else if (item && item.supplierResult === 2) {
        summary.redeclare += 1;
      } else if (item && item.supplierResult === 3) {
        summary.void += 1;
      } else {
        summary.skip += 1;
      }
    });

    return summary;
  }

  function applyPriceDeclFailedRetryState(state, submitResult) {
    const failedItemRequests = Array.isArray(submitResult && submitResult.failedItemRequests)
      ? submitResult.failedItemRequests
      : [];
    const failedRequestKeySet = new Set(
      failedItemRequests
        .map((request) => buildPriceDeclPreviewRequestKey(
          request && request.shopId,
          request && request.priceOrderId,
          request && request.supplierResult
        ))
        .filter(Boolean)
    );

    if (failedRequestKeySet.size <= 0) {
      return false;
    }

    const currentPreviewItems = Array.isArray(state && state.priceDeclPreviewItems)
      ? state.priceDeclPreviewItems
      : [];
    const nextPreviewItems = currentPreviewItems.filter((item) => {
      return failedRequestKeySet.has(getPriceDeclPreviewRequestKeyFromItem(item));
    });

    if (nextPreviewItems.length <= 0) {
      return false;
    }

    const retryResultsByShop = (Array.isArray(submitResult && submitResult.results) ? submitResult.results : [])
      .filter((result) => Number(result && result.failedRequests) > 0)
      .map((result) => ({
        shopId: normalizeText(result && result.shopId),
        shopName: normalizeText(result && result.shopName) || normalizeText(result && result.shopId),
        success: false,
        message: `\u5f85\u91cd\u8bd5 ${Number(result && result.failedRequests) || 0} \u7ec4 / ${Number(result && result.failedSkuCount) || 0} \u4e2aSKU`
      }));

    state.priceDeclPreviewOpen = true;
    state.priceDeclPreviewItems = nextPreviewItems;
    state.priceDeclPreviewResultsByShop = retryResultsByShop;
    state.priceDeclPreviewGroupedRequests = failedItemRequests;
    state.priceDeclPreviewSummary = summarizePriceDeclPreviewItems(nextPreviewItems);
    state.priceDeclPreviewSaving = false;
    state.priceDeclPreviewRetryMode = true;
    state.priceDeclPreviewSelectedShopIds = [];
    state.priceDeclPreviewSelectedResultTypes = [];
    resetPriceDeclPreviewVisibleCount(state);
    return true;
  }

  function getPriceDeclPreviewShopFilterOptions(previewItems) {
    const optionMap = new Map();

    (Array.isArray(previewItems) ? previewItems : []).forEach((item) => {
      const shopId = normalizeText(item && item.shopId);

      if (!shopId || optionMap.has(shopId)) {
        return;
      }

      optionMap.set(shopId, normalizeText(item && item.shopName) || shopId);
    });

    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }

  function sortPriceDeclPreviewItems(items, sortField, sortDirection) {
    const field = normalizeText(sortField) || 'productName';
    const direction = normalizeText(sortDirection) === 'desc' ? -1 : 1;

    function getSortValue(item) {
      if (field === 'shopName') return normalizeText(item && item.shopName);
      if (field === 'productName') return normalizeText(item && item.productName);
      if (field === 'priceOrderId') return Number(item && item.priceOrderId) || 0;
      if (field === 'declaredPrice') return Number(item && item.declaredPrice) || 0;
      if (field === 'suggestPrice') return Number(item && item.suggestPrice) || 0;
      if (field === 'costPrice') return Number(item && item.costPrice) || 0;
      if (field === 'profitValue') return Number(item && item.profitValue) || 0;
      if (field === 'profitRate') return Number(item && item.profitRate) || 0;
      if (field === 'reviewTimes') return Number(item && item.reviewTimes) || 0;
      if (field === 'submitPrice') return Number(item && item.submitPrice) || 0;
      if (field === 'result') return normalizePriceDeclPreviewResultType(item);
      return normalizeText(item && item.productName);
    }

    return (Array.isArray(items) ? items : []).slice().sort((left, right) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);
      const leftNumber = Number(leftValue);
      const rightNumber = Number(rightValue);

      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return (leftNumber - rightNumber) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue), 'zh-CN') * direction;
    });
  }

  function getPriceDeclPreviewVisibleItems(state) {
    const previewItems = Array.isArray(state && state.priceDeclPreviewItems) ? state.priceDeclPreviewItems : [];
    const selectedShopIds = normalizeSelectedShopIds(state && state.priceDeclPreviewSelectedShopIds);
    const selectedResultTypes = normalizeSelectedOptionValues(state && state.priceDeclPreviewSelectedResultTypes);
    const filteredItems = previewItems.filter((item) => {
      const shopId = normalizeText(item && item.shopId);
      const resultType = normalizePriceDeclPreviewResultType(item);

      if (selectedShopIds.length > 0 && !selectedShopIds.includes(shopId)) {
        return false;
      }

      if (selectedResultTypes.length > 0 && !selectedResultTypes.includes(resultType)) {
        return false;
      }

      return true;
    });

    return sortPriceDeclPreviewItems(
      filteredItems,
      state && state.priceDeclPreviewSortField,
      state && state.priceDeclPreviewSortDirection
    );
  }

  function exportPriceDeclPreviewTable(state) {
    const visibleItems = getPriceDeclPreviewVisibleItems(state);

    if (visibleItems.length <= 0) {
      return false;
    }

    const rows = [
      [
        '\u5e97\u94fa',
        '\u5546\u54c1',
        'SKU ID',
        '\u539f\u7533\u62a5\u4ef7',
        '\u5efa\u8bae\u4f9b\u8d27\u4ef7',
        '\u6210\u672c\u4ef7',
        '\u5229\u6da6\u989d',
        '\u5229\u6da6\u7387',
        '\u5ba1\u6838\u6b21\u6570',
        '\u63d0\u4ea4\u4ef7\u683c',
        '\u7ed3\u679c',
        '\u547d\u4e2d\u660e\u7ec6'
      ]
    ].concat(visibleItems.map((item) => ([
      normalizeText(item && item.shopName) || normalizeText(item && item.shopId),
      normalizeText(item && item.productName),
      normalizeText(item && item.productSkuId),
      Number(item && item.declaredPrice || 0).toFixed(2),
      (Number(item && item.suggestPrice || 0) / 100).toFixed(2),
      Number(item && item.costPrice || 0).toFixed(2),
      Number(item && item.profitValue || 0).toFixed(2),
      `${Number(item && item.profitRate || 0).toFixed(2)}%`,
      String(Number(item && item.reviewTimes) || 0),
      (Number(item && item.submitPrice || 0) / 100).toFixed(2),
      getPriceDeclPreviewResultLabel(item),
      normalizeText(item && item.approveDetail)
    ])));

    const csvContent = rows.map((row) => row.map((value) => {
      return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    }).join(',')).join('\n');

    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `price-decl-preview-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function renderPriceDeclPreviewShopOverview(shopSummaries) {
    const cards = (Array.isArray(shopSummaries) ? shopSummaries : []).map((shopSummary) => {
      const success = shopSummary && shopSummary.success !== false;
      const statusText = success
        ? `已预览 ${shopSummary.total} 个SKU`
        : '预览失败';

      return `
        <article class="ops-npl-price-decl-shop-card${success ? '' : ' is-failed'}">
          <div class="ops-npl-price-decl-shop-card-head">
            <strong>${escapeHtml(shopSummary.shopName || shopSummary.shopId || '--')}</strong>
            <span class="ops-npl-price-decl-shop-card-status${success ? '' : ' is-failed'}">${escapeHtml(statusText)}</span>
          </div>
          <div class="ops-npl-price-decl-shop-card-metrics">
            <span>SKU <strong>${shopSummary.total}</strong></span>
            <span class="is-approve">通过 <strong>${shopSummary.approve}</strong></span>
            <span class="is-redecl">重核 <strong>${shopSummary.redeclare}</strong></span>
            <span class="is-void">作废 <strong>${shopSummary.void}</strong></span>
            <span class="is-skip">跳过 <strong>${shopSummary.skip}</strong></span>
          </div>
          ${shopSummary.message ? `
            <div class="ops-npl-price-decl-shop-card-message${success ? '' : ' is-failed'}">${escapeHtml(shopSummary.message)}</div>
          ` : ''}
        </article>
      `;
    }).join('');

    if (!cards) {
      return '';
    }

    return `
      <div class="ops-npl-price-decl-shop-overview">
        ${cards}
      </div>
    `;
  }

  function resolvePriceDeclSubmitProgressPhaseLabel(phase) {
    const normalizedPhase = normalizeText(phase);

    if (normalizedPhase === 'preparing') {
      return '\u51c6\u5907\u63d0\u4ea4';
    }

    if (normalizedPhase === 'warming-session') {
      return '\u68c0\u67e5\u4f1a\u8bdd';
    }

    if (normalizedPhase === 'query-review-items') {
      return '\u83b7\u53d6\u660e\u7ec6';
    }

    if (normalizedPhase === 'building-requests') {
      return '\u751f\u6210\u5206\u7ec4';
    }

    if (normalizedPhase === 'submitting') {
      return '\u63d0\u4ea4\u6838\u4ef7';
    }

    if (normalizedPhase === 'canceling') {
      return '\u6b63\u5728\u505c\u6b62';
    }

    if (normalizedPhase === 'shop-completed') {
      return '\u5e97\u94fa\u5b8c\u6210';
    }

    if (normalizedPhase === 'shop-failed') {
      return '\u5e97\u94fa\u5f02\u5e38';
    }

    if (normalizedPhase === 'completed') {
      return '\u63d0\u4ea4\u5b8c\u6210';
    }

    if (normalizedPhase === 'canceled') {
      return '\u5df2\u505c\u6b62';
    }

    if (normalizedPhase === 'failed') {
      return '\u63d0\u4ea4\u5931\u8d25';
    }

    return normalizedPhase || '--';
  }

  function renderPriceDeclSubmitProgressMarkup(progress) {
    const normalizedProgress = normalizePriceDeclSubmitProgressPayload(progress);

    if (!normalizedProgress) {
      return '';
    }

    const phase = normalizeText(normalizedProgress.phase);
    const phaseLabel = resolvePriceDeclSubmitProgressPhaseLabel(phase);
    const phaseToneClass = phase === 'completed'
      ? ' is-success'
      : (phase === 'failed' || phase === 'shop-failed'
        ? ' is-danger'
        : (phase === 'query-review-items' || phase === 'building-requests' || phase === 'canceled' || phase === 'canceling'
          ? ' is-accent'
          : ' is-running'));
    const currentShopName = normalizeText(normalizedProgress.currentShopName)
      || normalizeText(normalizedProgress.currentShopId);
    const chunkText = normalizedProgress.totalChunks > 0 && normalizedProgress.currentChunkIndex > 0
      ? `${normalizedProgress.currentChunkIndex}/${normalizedProgress.totalChunks}${normalizedProgress.currentChunkRequestCount > 0 ? `\uff08${normalizedProgress.currentChunkRequestCount}\u7ec4\uff09` : ''}`
      : '--';
    const summaryCards = [
      {
        label: '\u5e97\u94fa\u8fdb\u5ea6',
        value: normalizedProgress.totalShops > 0
          ? `${normalizedProgress.completedShops}/${normalizedProgress.totalShops}`
          : String(normalizedProgress.completedShops)
      },
      {
        label: '\u5f02\u5e38\u5e97\u94fa',
        value: String(normalizedProgress.failedShops)
      },
      {
        label: '\u8bf7\u6c42\u6279\u6b21',
        value: chunkText
      },
      {
        label: '\u6210\u529f\u6279\u6b21',
        value: String(normalizedProgress.successChunks)
      },
      {
        label: '\u5931\u8d25\u6279\u6b21',
        value: String(normalizedProgress.failedChunks)
      },
      {
        label: '\u6210\u529fSKU',
        value: String(normalizedProgress.successSkuCount)
      },
      {
        label: '\u5931\u8d25SKU',
        value: String(normalizedProgress.failedSkuCount)
      }
    ];

    return `
      <div class="ops-npl-batch-adjust-submit-progress" role="status" aria-live="polite">
        <div class="ops-npl-batch-adjust-submit-progress-head">
          <span class="ops-npl-batch-adjust-submit-progress-phase${phaseToneClass}">${escapeHtml(phaseLabel)}</span>
          <strong class="ops-npl-batch-adjust-submit-progress-message">${escapeHtml(normalizedProgress.message || phaseLabel)}</strong>
          ${currentShopName ? `<span class="ops-npl-batch-adjust-submit-progress-shop">\u5f53\u524d\u5e97\u94fa\uff1a${escapeHtml(currentShopName)}</span>` : ''}
        </div>
        <div class="ops-npl-batch-adjust-submit-progress-grid">
          ${summaryCards.map((card) => {
            return `
              <div class="ops-npl-batch-adjust-submit-progress-item">
                <span class="ops-npl-batch-adjust-submit-progress-item-label">${escapeHtml(card.label)}</span>
                <strong class="ops-npl-batch-adjust-submit-progress-item-value">${escapeHtml(card.value)}</strong>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }


  function renderPriceDeclPreviewTable(state) {
    if (!state || !state.priceDeclPreviewOpen) {
      return '';
    }

    const previewItems = Array.isArray(state.priceDeclPreviewItems) ? state.priceDeclPreviewItems : [];
    const resultsByShop = Array.isArray(state.priceDeclPreviewResultsByShop) ? state.priceDeclPreviewResultsByShop : [];
    const selectedShopIds = normalizeSelectedShopIds(state.priceDeclPreviewSelectedShopIds);
    const selectedResultTypes = normalizeSelectedOptionValues(state.priceDeclPreviewSelectedResultTypes);
    const shopFilterOptions = getPriceDeclPreviewShopFilterOptions(previewItems);
    const shopFilteredItems = previewItems.filter((item) => {
      if (selectedShopIds.length <= 0) {
        return true;
      }

      return selectedShopIds.includes(normalizeText(item && item.shopId));
    });
    const resultTypeCounts = {
      approve: 0,
      redeclare: 0,
      void: 0,
      skip: 0
    };

    shopFilteredItems.forEach((item) => {
      const resultType = normalizePriceDeclPreviewResultType(item);
      resultTypeCounts[resultType] += 1;
    });

    const visibleItems = getPriceDeclPreviewVisibleItems(state);
    const filteredResultsByShop = resultsByShop.filter((result) => {
      if (selectedShopIds.length <= 0) {
        return true;
      }

      return selectedShopIds.includes(normalizeText(result && result.shopId));
    });
    const visibleShopSummaries = buildPriceDeclPreviewShopSummaries(visibleItems, filteredResultsByShop)
      .filter((shopSummary) => {
        if (shopSummary.total > 0) {
          return true;
        }

        return selectedResultTypes.length <= 0 && shopSummary.success === false;
      });
    const renderedVisibleCount = ensurePriceDeclPreviewVisibleCount(state, visibleItems.length);
    const renderedItems = visibleItems.slice(0, renderedVisibleCount);
    const renderedShopSummaries = buildPriceDeclPreviewShopSummaries(renderedItems, filteredResultsByShop)
      .filter((shopSummary) => Array.isArray(shopSummary.items) && shopSummary.items.length > 0);
    const fullShopSummaryMap = new Map(
      visibleShopSummaries.map((shopSummary) => [normalizeText(shopSummary && shopSummary.key), shopSummary])
    );
    const tableShopSummaries = renderedShopSummaries.map((shopSummary) => {
      const fullSummary = fullShopSummaryMap.get(normalizeText(shopSummary && shopSummary.key));

      if (!fullSummary) {
        return shopSummary;
      }

      return {
        ...fullSummary,
        items: shopSummary.items
      };
    });
    const visibleSummary = createDefaultPriceDeclPreviewSummary();

    visibleItems.forEach((item) => {
      visibleSummary.total += 1;
      const resultType = normalizePriceDeclPreviewResultType(item);

      if (resultType === 'approve') {
        visibleSummary.approve += 1;
      } else if (resultType === 'redeclare') {
        visibleSummary.redeclare += 1;
      } else if (resultType === 'void') {
        visibleSummary.void += 1;
      } else {
        visibleSummary.skip += 1;
      }
    });

    const sortField = normalizeText(state.priceDeclPreviewSortField) || 'shopName';
    const sortDirection = normalizeText(state.priceDeclPreviewSortDirection) === 'desc' ? 'desc' : 'asc';
    const selectedShopValue = selectedShopIds[0] || '';

    function renderSortHeader(field, label) {
      const active = sortField === field;
      const indicator = active
        ? (sortDirection === 'desc' ? '\u2193' : '\u2191')
        : '\u2195';

      return `
        <button
          class="ops-npl-price-decl-sort-button${active ? ' is-active' : ''}"
          type="button"
          data-npl-action="sort-price-decl-preview"
          data-npl-price-decl-sort="${escapeHtml(field)}"
        >
          <span>${escapeHtml(label)}</span>
          <span class="ops-npl-price-decl-sort-indicator">${indicator}</span>
        </button>
      `;
    }

    const rows = buildPriceDeclPreviewLazyRowsMarkup(
      tableShopSummaries,
      sortField,
      sortDirection
    );

    const toolbar = `
      <div class="ops-npl-price-decl-preview-toolbar">
        <div class="ops-npl-price-decl-preview-toolbar-main">
          <label class="ops-npl-price-decl-preview-filter-field">
            <span>\u5e97\u94fa</span>
            <select class="ops-pd-control ops-npl-price-decl-preview-filter-select" data-npl-price-decl-preview-shop-filter="true">
              <option value="">\u5168\u90e8\u5e97\u94fa</option>
              ${shopFilterOptions.map((option) => `
                <option value="${escapeHtml(option.value)}"${selectedShopValue === option.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>
              `).join('')}
            </select>
          </label>
          <div class="ops-npl-price-decl-preview-result-filter-group">
            <button
              class="ops-pd-action-button is-secondary ops-npl-price-decl-preview-filter-chip${selectedResultTypes.length <= 0 ? ' is-active' : ''}"
              type="button"
              data-npl-action="clear-price-decl-preview-result-filter"
            >
              \u5168\u90e8\u7ed3\u679c
            </button>
            ${PRICE_DECL_PREVIEW_RESULT_OPTIONS.map((option) => {
              const count = Number(resultTypeCounts[option.value]) || 0;
              const active = selectedResultTypes.includes(option.value);
              const typeClass = option.value === 'approve'
                ? 'is-approve'
                : (option.value === 'redeclare'
                  ? 'is-redecl'
                  : (option.value === 'void' ? 'is-void' : 'is-skip'));

              return `
                <button
                  class="ops-pd-action-button is-secondary ops-npl-price-decl-preview-filter-chip ${typeClass}${active ? ' is-active' : ''}"
                  type="button"
                  data-npl-action="toggle-price-decl-preview-result-filter"
                  data-npl-price-decl-preview-result-type="${escapeHtml(option.value)}"
                >
                  ${escapeHtml(option.label)} <strong>${count}</strong>
                </button>
              `;
            }).join('')}
          </div>
        </div>
        <div class="ops-npl-price-decl-preview-toolbar-side">
          <span class="ops-npl-price-decl-preview-toolbar-summary${state.priceDeclPreviewRetryMode ? ' is-retry' : ''}">${state.priceDeclPreviewRetryMode ? '\u5f53\u524d\u4ec5\u4fdd\u7559\u63d0\u4ea4\u5931\u8d25\u9879\uff0c\u53ef\u76f4\u63a5\u518d\u6b21\u63d0\u4ea4' : `\u5f53\u524d\u5df2\u6e32\u67d3 ${renderedItems.length} / ${visibleItems.length} \u4e2aSKU\uff08\u603b ${previewItems.length} \u4e2aSKU\uff09`}</span>
          <button
            class="ops-pd-action-button is-primary ops-npl-price-decl-preview-export"
            type="button"
            data-npl-action="export-price-decl-preview"
            ${visibleItems.length <= 0 ? 'disabled' : ''}
          >
            \u5bfc\u51fa\u8868\u683c
          </button>
        </div>
      </div>
    `;

    if (previewItems.length <= 0) {
      return `
        <section class="ops-npl-price-decl-preview-section">
          ${toolbar}
          ${renderPriceDeclPreviewShopOverview(visibleShopSummaries)}
          <div class="ops-npl-price-decl-preview-empty">\u672c\u6b21\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u9884\u89c8SKU</div>
        </section>
      `;
    }

    if (visibleItems.length <= 0) {
      return `
        <section class="ops-npl-price-decl-preview-section">
          <div class="ops-npl-price-decl-block" style="border-top:1px solid var(--pm-border);">
            <div class="ops-npl-price-decl-block-header">
              <span class="ops-npl-price-decl-block-step">2</span>
              <strong>\u6838\u4ef7\u9884\u89c8\u7ed3\u679c</strong>
              <span style="color:var(--pm-text-soft);font-size:12px;">\u5171 ${previewItems.length} \u4e2aSKU / ${shopFilterOptions.length || 1} \u5bb6\u5e97\u94fa</span>
            </div>
            ${toolbar}
            ${renderPriceDeclPreviewShopOverview(visibleShopSummaries)}
            <div class="ops-npl-price-decl-preview-empty">\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u7684SKU</div>
          </div>
        </section>
      `;
    }

    return `
      <section class="ops-npl-price-decl-preview-section">
        <div class="ops-npl-price-decl-block" style="border-top:1px solid var(--pm-border);">
          <div class="ops-npl-price-decl-block-header">
            <span class="ops-npl-price-decl-block-step">2</span>
            <strong>\u6838\u4ef7\u9884\u89c8\u7ed3\u679c</strong>
            <span style="color:var(--pm-text-soft);font-size:12px;">\u5171 ${previewItems.length} \u4e2aSKU / ${shopFilterOptions.length || 1} \u5bb6\u5e97\u94fa</span>
          </div>
          ${toolbar}
          ${renderPriceDeclPreviewShopOverview(visibleShopSummaries)}
          <div class="ops-npl-price-decl-preview-table-wrap" data-npl-price-decl-preview-table-wrap="true">
            <table class="ops-npl-price-decl-preview-table">
              <thead>
                <tr>
                  <th>${renderSortHeader('productName', '\u5546\u54c1\u4fe1\u606f')}</th>
                  <th>${renderSortHeader('priceOrderId', '\u4ef7\u683c\u5355ID')}</th>
                  <th>${renderSortHeader('declaredPrice', '\u539f\u7533\u62a5\u4ef7')}</th>
                  <th>${renderSortHeader('suggestPrice', '\u5efa\u8bae\u4f9b\u8d27\u4ef7')}</th>
                  <th>${renderSortHeader('costPrice', '\u6210\u672c\u4ef7')}</th>
                  <th>${renderSortHeader('profitValue', '\u5229\u6da6\u503c')}</th>
                  <th>${renderSortHeader('profitRate', '\u5229\u6da6\u7387(\u6309\u5efa\u8bae\u4f9b\u8d27\u4ef7)')}</th>
                  <th>${renderSortHeader('reviewTimes', '\u5ba1\u6838\u6b21\u6570')}</th>
                  <th>${renderSortHeader('submitPrice', '\u63d0\u4ea4\u4ef7\u683c')}</th>
                  <th>${renderSortHeader('result', '\u7ed3\u679c')}</th>
                </tr>
              </thead>
              ${rows}
            </table>
          </div>
          ${renderedItems.length < visibleItems.length ? `
            <div class="ops-npl-price-decl-preview-lazy-hint">
              \u5411\u4e0b\u6eda\u52a8\u5c06\u81ea\u52a8\u52a0\u8f7d\u66f4\u591aSKU\uff0c\u5f53\u524d\u5df2\u6e32\u67d3 ${renderedItems.length} / ${visibleItems.length}
            </div>
          ` : ''}
          <div class="ops-npl-price-decl-preview-summary">
            <span>\u5408\u8ba1: <strong>${visibleSummary.total}</strong></span>
            <span class="is-approve">\u901a\u8fc7: <strong>${visibleSummary.approve}</strong></span>
            <span class="is-redecl">\u91cd\u65b0\u6838\u4ef7: <strong>${visibleSummary.redeclare}</strong></span>
            <span class="is-void">\u4f5c\u5e9f: <strong>${visibleSummary.void}</strong></span>
            <span class="is-skip">\u8df3\u8fc7: <strong>${visibleSummary.skip}</strong></span>
          </div>
        </div>
      </section>
    `;
  }

  function syncProfitRateCopy(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const state = getState(container);

    container.querySelectorAll('th').forEach((cell) => {
      const headerText = normalizeText(cell.textContent);

      if (headerText === '\u5229\u6da6\u7387') {
        cell.textContent = '\u5229\u6da6\u7387(\u6309\u7533\u62a5\u4ef7)';
      }

      if (headerText === '\u9884\u89c8\u5229\u6da6\u7387') {
        cell.textContent = '\u9884\u89c8\u5229\u6da6\u7387(\u6309\u9884\u89c8\u4ef7)';
      }
    });

    container.querySelectorAll('.ops-npl-price-decl-preview-table th').forEach((cell) => {
      const headerText = normalizeText(cell.textContent);

      if (headerText === '\u5229\u6da6') {
        cell.textContent = '\u5229\u6da6\u989d';
      }

      if (headerText === '\u5229\u6da6\u7387' || headerText === '\u5229\u6da6\u7387(\u6309\u7533\u62a5\u4ef7)') {
        cell.textContent = '\u5229\u6da6\u7387(\u6309\u5efa\u8bae\u4f9b\u8d27\u4ef7)';
      }
    });

    container.querySelectorAll('[data-npl-price-decl-setting="approveCondition"] option[value="profitRate"]').forEach((option) => {
      option.textContent = '\u5229\u6da6\u7387(\u6309\u5efa\u8bae\u4f9b\u8d27\u4ef7)';
    });

    container.querySelectorAll('[data-npl-price-decl-setting="approveCondition"] option[value="profitValue"]').forEach((option) => {
      option.textContent = '\u5229\u6da6\u989d';
    });

    if (state.priceDeclPreviewRetryMode === true) {
      container.querySelectorAll('[data-npl-action="submit-batch-price-declaration-from-preview"]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }

        button.textContent = state.priceDeclPreviewSaving === true
          ? '\u91cd\u8bd5\u4e2d...'
          : '\u91cd\u8bd5\u5931\u8d25\u6838\u4ef7';
      });
    }
  }


  function render(container) {
    const state = getState(container);
    const scrollState = captureRenderScrollState(container, state);

    container.innerHTML = `
      <section class="ops-npl-view operations-module-workspace" data-operations-workspace="new-product-lifecycle">
        <div class="ops-npl-shell">
          ${renderFilterCard(state)}
          ${renderProductList(state)}
        </div>
      </section>
      ${renderBatchAdjustDialog(state)}
      ${renderQuickCostDialog(state)}
      ${renderImagePreviewDialog(state)}
      ${renderBatchPriceDeclDialog(state)}
    `;

    syncProfitRateCopy(container);
    restoreRenderScrollState(container, scrollState);

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

    if (state.categorySelectorOpen === true && state.categorySearchFocusInput === true) {
      const categorySearchInput = container.querySelector('[data-category-cascade-search]');

      if (categorySearchInput instanceof HTMLInputElement) {
        categorySearchInput.focus();

        try {
          const cursorPosition = categorySearchInput.value.length;
          categorySearchInput.setSelectionRange(cursorPosition, cursorPosition);
        } catch (_error) {
          // Ignore selection sync failures.
        }
      }

      state.categorySearchFocusInput = false;
    }
  }

  function bindEvents(container) {
    if (container.dataset.operationsNewProductLifecycleBound === 'true') {
      return;
    }

    container.addEventListener('input', (event) => {
      const target = event.target;
      const state = getState(container);

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (normalizeText(target.getAttribute('data-shop-multi-select-template-name')) && 'value' in target) {
        state.shopSelectionPreset.templateName = target.value;
        return;
      }

      if (normalizeText(target.getAttribute('data-shop-multi-select-search'))) {
        state.shopSelectorKeyword = 'value' in target ? target.value : '';
        state.shopSelectorOpen = true;
        rerenderShopSelectorField(container, { focusSearch: true });
        return;
      }

      if (normalizeText(target.getAttribute('data-category-cascade-search'))) {
        void searchCategories(container, 'value' in target ? target.value : '');
        return;
      }

      const priceDeclRuleId = normalizeText(target.getAttribute('data-npl-price-decl-rule-id'));
      const priceDeclRuleField = normalizeText(target.getAttribute('data-npl-price-decl-rule-field'));

      if (priceDeclRuleId && priceDeclRuleField && target instanceof HTMLInputElement && 'value' in target) {
        updatePriceDeclFallbackApproveRuleField(state, priceDeclRuleId, priceDeclRuleField, target.value);
        return;
      }

      const priceDeclSetting = normalizeText(target.getAttribute('data-npl-price-decl-setting'));

      if (priceDeclSetting && target instanceof HTMLInputElement && target.type === 'number' && 'value' in target) {
        const numericValue = target.value;

        if (priceDeclSetting === 'approveReduceValue') {
          setPriceDeclReduceValueByType(
            state,
            state.priceDeclDialogApproveReduceType,
            numericValue
          );
          return;
        }

        state['priceDeclDialog' + priceDeclSetting.charAt(0).toUpperCase() + priceDeclSetting.slice(1)] = numericValue;
        return;
      }

      const quickCostInputKey = normalizeText(target.getAttribute('data-npl-quick-cost-input'));

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

      const batchAdjustEntryKey = normalizeText(target.getAttribute('data-npl-batch-adjust-entry-key'));
      const batchAdjustRuleId = normalizeText(target.getAttribute('data-npl-batch-adjust-rule-id'));
      const batchAdjustFieldName = normalizeText(target.getAttribute('data-npl-batch-adjust-field'));
      const batchAdjustSettingFieldName = normalizeText(target.getAttribute('data-npl-batch-adjust-setting'));

      if (
        (state.batchAdjustDialogSaving === true || state.batchAdjustDialogSubmitting === true)
        && (batchAdjustEntryKey || batchAdjustSettingFieldName)
      ) {
        return;
      }

      if (batchAdjustEntryKey && batchAdjustRuleId && batchAdjustFieldName && 'value' in target) {
        updateBatchAdjustRuleField(
          state,
          batchAdjustEntryKey,
          batchAdjustRuleId,
          batchAdjustFieldName,
          target.value
        );
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'remark' && 'value' in target) {
        state.batchAdjustDialogRemark = normalizeText(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'duplicateSubmitWindowDays' && 'value' in target) {
        state.batchAdjustDialogDuplicateSubmitWindowDays = normalizeText(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'useSuggestedPriceAfterSubmitCount' && 'value' in target) {
        state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount = normalizeText(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'activityPriceReduction' && 'value' in target) {
        state.batchAdjustDialogActivityPriceReduction = normalizeText(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'dailyProfitFloorValue' && 'value' in target) {
        state.batchAdjustDialogDailyProfitFloorValue = normalizeText(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'activityProfitFloorValue' && 'value' in target) {
        state.batchAdjustDialogActivityProfitFloorValue = normalizeText(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      const fieldName = target instanceof HTMLElement
        ? normalizeText(target.getAttribute('data-npl-filter'))
        : '';

      if (!fieldName || !(fieldName in DEFAULT_FILTERS) || !('value' in target)) {
        return;
      }

      state.filters = {
        ...applyFilterDependencies(state.filters),
        [fieldName]: target.value
      };

      if (fieldName === 'costState') {
        state.appliedFilters = {
          ...state.appliedFilters,
          costState: normalizeText(target.value)
        };
        render(container);
        return;
      }

      const pageSizeFlag = normalizeText(target.getAttribute('data-npl-page-size'));

      if (pageSizeFlag) {
        const nextPageSize = Number.parseInt(target.value, 10);

        if (PAGE_SIZE_OPTIONS.includes(nextPageSize) && nextPageSize !== state.pageSize) {
          state.pageSize = nextPageSize;
          state.currentPage = 1;
          render(container);
        }
        return;
      }

      if (fieldName === 'pageDelayMinSeconds' || fieldName === 'pageDelayMaxSeconds') {
        scheduleSaveQuerySettings(container);
      }
    });

    container.addEventListener('change', (event) => {
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
        state.currentPage = 1;
        void saveShopSelectionLast(container, state.filters.selectedShopIds);
        rerenderShopSelectorField(container);
        return;
      }

      const selectedStationId = normalizeText(target.getAttribute('data-npl-station-option'));

      if (selectedStationId && target instanceof HTMLInputElement) {
        const currentStationIds = normalizeSelectedStationIds(state.filters.stationIds);
        const nextStationIds = target.checked
          ? Array.from(new Set(currentStationIds.concat(selectedStationId)))
          : currentStationIds.filter((stationId) => stationId !== selectedStationId);

        state.filters = {
          ...state.filters,
          stationIds: nextStationIds
        };
        state.currentPage = 1;
        render(container);
        return;
      }

      const multiSelectField = normalizeText(target.getAttribute('data-npl-multi-option'));

      if (multiSelectField && target instanceof HTMLInputElement) {
        const currentValues = normalizeSelectedOptionValues(state.filters[multiSelectField]);
        const optionValue = normalizeText(target.value);
        const nextValues = target.checked
          ? Array.from(new Set(currentValues.concat(optionValue)))
          : currentValues.filter((value) => value !== optionValue);

        if (Object.prototype.hasOwnProperty.call(DEFAULT_FILTERS, multiSelectField)) {
          state.filters = applyFilterDependencies({
            ...state.filters,
            [multiSelectField]: nextValues
          });
          state.currentPage = 1;
          render(container);
        }

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
        state.currentPage = 1;
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

      const priceDeclChangeField = normalizeText(target.getAttribute('data-npl-price-decl-setting'));

      const priceDeclRuleId = normalizeText(target.getAttribute('data-npl-price-decl-rule-id'));
      const priceDeclRuleField = normalizeText(target.getAttribute('data-npl-price-decl-rule-field'));

      if (priceDeclRuleId && priceDeclRuleField && 'value' in target) {
        updatePriceDeclFallbackApproveRuleField(state, priceDeclRuleId, priceDeclRuleField, target.value);
        render(container);
        return;
      }

      if (priceDeclChangeField) {
        const stateKey = 'priceDeclDialog' + priceDeclChangeField.charAt(0).toUpperCase() + priceDeclChangeField.slice(1);

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
          state[stateKey] = target.checked;
        } else if ('value' in target) {
          if (priceDeclChangeField === 'approveReduceType') {
            setPriceDeclReduceValueByType(
              state,
              target.value,
              getPriceDeclReduceValueByType(state, target.value)
            );
          } else {
            state[stateKey] = target.value;
          }
        }

        render(container);
        return;
      }

      if (target instanceof HTMLSelectElement && target.hasAttribute('data-npl-price-decl-preview-shop-filter')) {
        state.priceDeclPreviewSelectedShopIds = target.value
          ? [normalizeText(target.value)]
          : [];
        resetPriceDeclPreviewVisibleCount(state);
        render(container);
        return;
      }

      const batchAdjustEntryKey = normalizeText(target.getAttribute('data-npl-batch-adjust-entry-key'));
      const batchAdjustRuleId = normalizeText(target.getAttribute('data-npl-batch-adjust-rule-id'));
      const batchAdjustFieldName = normalizeText(target.getAttribute('data-npl-batch-adjust-field'));
      const batchAdjustSettingFieldName = normalizeText(target.getAttribute('data-npl-batch-adjust-setting'));
      const batchAdjustStationOption = normalizeText(target.getAttribute('data-npl-batch-adjust-station-option'));
      const batchAdjustCopyTargetKey = normalizeText(target.getAttribute('data-npl-batch-adjust-copy-target'));

      if (
        (state.batchAdjustDialogSaving === true || state.batchAdjustDialogSubmitting === true)
        && (batchAdjustEntryKey || batchAdjustSettingFieldName || batchAdjustStationOption || batchAdjustCopyTargetKey)
      ) {
        render(container);
        return;
      }

      if (batchAdjustEntryKey && batchAdjustRuleId && batchAdjustFieldName && 'value' in target) {
        updateBatchAdjustRuleField(
          state,
          batchAdjustEntryKey,
          batchAdjustRuleId,
          batchAdjustFieldName,
          target.value
        );
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'reasonCode' && 'value' in target) {
        state.batchAdjustDialogReasonCode = normalizeBatchAdjustReasonCode(target.value);
        scheduleSaveBatchAdjustDialog(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'dailyEnabled' && target instanceof HTMLInputElement) {
        state.batchAdjustDialogDailyEnabled = target.checked;
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'activityEnabled' && target instanceof HTMLInputElement) {
        state.batchAdjustDialogActivityEnabled = target.checked;
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'duplicateSubmitWindowDays' && 'value' in target) {
        state.batchAdjustDialogDuplicateSubmitWindowDays = normalizeBatchAdjustDuplicateSubmitWindowDaysValue(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'useSuggestedPriceAfterSubmitCount' && 'value' in target) {
        state.batchAdjustDialogUseSuggestedPriceAfterSubmitCount = normalizeBatchAdjustSuggestedPriceFallbackCountValue(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'activityPriceReduction' && 'value' in target) {
        state.batchAdjustDialogActivityPriceReduction = normalizeQuickCostValue(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'dailyProfitFloorMode' && 'value' in target) {
        state.batchAdjustDialogDailyProfitFloorMode = normalizeBatchAdjustProfitFloorMode(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'dailyProfitFloorValue' && 'value' in target) {
        state.batchAdjustDialogDailyProfitFloorValue = normalizeQuickCostValue(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'activityProfitFloorMode' && 'value' in target) {
        state.batchAdjustDialogActivityProfitFloorMode = normalizeBatchAdjustProfitFloorMode(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustSettingFieldName === 'activityProfitFloorValue' && 'value' in target) {
        state.batchAdjustDialogActivityProfitFloorValue = normalizeQuickCostValue(target.value);
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (batchAdjustCopyTargetKey && 'value' in target) {
        updateBatchAdjustEntryUiField(
          state,
          batchAdjustCopyTargetKey,
          'copySourceEntryKey',
          target.value
        );
        render(container);
        return;
      }

      if (batchAdjustStationOption && target instanceof HTMLInputElement) {
        const nextStationIds = target.checked
          ? state.batchAdjustDialogStationIds.concat(batchAdjustStationOption)
          : state.batchAdjustDialogStationIds.filter((stationId) => {
            return normalizeText(stationId) !== batchAdjustStationOption;
          });
        state.batchAdjustDialogStationIds = normalizeBatchAdjustDialogStationIds(
          nextStationIds,
          state.batchAdjustDialogStationOptions
        );
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      const fieldName = target instanceof HTMLElement
        ? normalizeText(target.getAttribute('data-npl-filter'))
        : '';

      if (!fieldName || !(fieldName in DEFAULT_FILTERS) || !('value' in target)) {
        return;
      }

      state.filters = {
        ...state.filters,
        [fieldName]: target.value
      };

      state.filters = applyFilterDependencies(state.filters);

      if (fieldName === 'costState') {
        state.appliedFilters = {
          ...state.appliedFilters,
          costState: normalizeText(target.value)
        };
        render(container);
      }
    });

    container.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const state = getState(container);
      const control = getShopMultiSelectControl();

      if (!target) {
        return;
      }

      const shopSelectorRoot = target.closest('[data-shop-multi-select]');
      const stationSelectorRoot = target.closest('[data-npl-station-select]');
      const multiSelectorRoot = target.closest('[data-npl-multi-select]');
      const categorySelectorRoot = target.closest('[data-category-cascade]');
      let closedByOutsideClick = false;

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

      if (state.multiSelectorOpen && !multiSelectorRoot) {
        state.multiSelectorOpen = '';
        closedByOutsideClick = true;
      }

      if (state.categorySelectorOpen === true && !categorySelectorRoot) {
        state.categorySelectorOpen = false;
        clearCategorySearchState(state);
        closedByOutsideClick = true;
      }

      const imagePreviewOpenTrigger = target.closest('[data-image-preview-open]');

      if (imagePreviewOpenTrigger instanceof HTMLButtonElement) {
        state.imagePreview = normalizeImagePreview({
          sourceUrl: imagePreviewOpenTrigger.getAttribute('data-preview-image'),
          title: imagePreviewOpenTrigger.getAttribute('data-preview-title')
        });
        render(container);
        return;
      }

      const imagePreviewCloseTrigger = target.closest('[data-image-preview-close]');

      if (imagePreviewCloseTrigger instanceof HTMLButtonElement) {
        state.imagePreview = null;
        render(container);
        return;
      }

      const imagePreviewBackdrop = target.closest('[data-image-preview-backdrop]');
      const imagePreviewPanel = target.closest('[data-image-preview-panel]');
      if (state.imagePreview && imagePreviewBackdrop && !imagePreviewPanel) {
        state.imagePreview = null;
        render(container);
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

          rerenderShopSelectorField(container, { focusSearch: state.shopSelectorOpen === true });
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
        const shopActionId = normalizeText(shopSelectorAction.getAttribute('data-shop-multi-select-action'));

        if (shopActionId === 'select-visible' && control && typeof control.setAllVisibleSelection === 'function') {
          state.filters.selectedShopIds = control.setAllVisibleSelection(
            state.shopCatalog,
            state.filters.selectedShopIds,
            state.shopSelectorKeyword,
            true
          );
          state.currentPage = 1;
          void saveShopSelectionLast(container, state.filters.selectedShopIds);
          rerenderShopSelectorField(container);
          return;
        }

        if (shopActionId === 'clear') {
          state.filters.selectedShopIds = [];
          state.currentPage = 1;
          void saveShopSelectionLast(container, state.filters.selectedShopIds);
          rerenderShopSelectorField(container);
          return;
        }
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
          state.currentPage = 1;
          void saveShopSelectionLast(container, state.filters.selectedShopIds);
          rerenderShopSelectorField(container);
        }

        return;
      }

      const stationSelectorToggle = target.closest('[data-npl-station-toggle]');

      if (stationSelectorToggle instanceof HTMLButtonElement) {
        state.stationSelectorOpen = !state.stationSelectorOpen;
        render(container);
        return;
      }

      const stationSelectorAction = target.closest('[data-npl-station-action]');

      if (stationSelectorAction instanceof HTMLButtonElement) {
        const stationActionId = normalizeText(stationSelectorAction.getAttribute('data-npl-station-action'));

        if (stationActionId === 'select-us') {
          state.filters = {
            ...state.filters,
            stationIds: ['100']
          };
          state.currentPage = 1;
          render(container);
          return;
        }

        if (stationActionId === 'clear') {
          state.filters = {
            ...state.filters,
            stationIds: []
          };
          state.currentPage = 1;
          render(container);
          return;
        }
      }

      const multiSelectorToggle = target.closest('[data-npl-multi-toggle]');

      if (multiSelectorToggle instanceof HTMLButtonElement) {
        const multiField = normalizeText(multiSelectorToggle.getAttribute('data-npl-multi-toggle'));

        if (multiField && Object.prototype.hasOwnProperty.call(DEFAULT_FILTERS, multiField)) {
          state.multiSelectorOpen = state.multiSelectorOpen === multiField ? '' : multiField;
          render(container);
        }

        return;
      }

      const multiSelectorAction = target.closest('[data-npl-multi-action]');

      if (multiSelectorAction instanceof HTMLButtonElement) {
        const multiActionId = normalizeText(multiSelectorAction.getAttribute('data-npl-multi-action'));
        const multiField = normalizeText(multiSelectorAction.getAttribute('data-npl-multi-field'));

        if (
          multiActionId === 'clear'
          && multiField
          && Object.prototype.hasOwnProperty.call(DEFAULT_FILTERS, multiField)
        ) {
          state.filters = {
            ...state.filters,
            [multiField]: []
          };
          state.currentPage = 1;
          render(container);
        }

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
          state.currentPage = 1;
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

        state.currentPage = 1;
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
        state.currentPage = 1;
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

      const pageButton = target.closest('[data-npl-page]');

      if (pageButton instanceof HTMLButtonElement) {
        const pageAction = normalizeText(pageButton.getAttribute('data-npl-page'));
        const rows = Array.isArray(state.rows) ? state.rows : [];
        const pageSize = Math.max(1, Number.parseInt(state.pageSize, 10) || 10);
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

        if (pageAction === 'prev') {
          state.currentPage = Math.max(1, state.currentPage - 1);
        } else if (pageAction === 'next') {
          state.currentPage = Math.min(totalPages, state.currentPage + 1);
        } else {
          const nextPage = Number.parseInt(pageAction, 10);

          if (Number.isFinite(nextPage) && nextPage > 0) {
            state.currentPage = Math.min(totalPages, nextPage);
          }
        }

        render(container);
        return;
      }

      const actionButton = target.closest('[data-npl-action]');

      if (!(actionButton instanceof HTMLElement)) {
        if (closedByOutsideClick) {
          render(container);
        }

        return;
      }

      const actionId = normalizeText(actionButton.getAttribute('data-npl-action'));

      if (actionId === 'reset') {
        state.filters = cloneFilters();
        state.appliedFilters = cloneFiltersForQuery(DEFAULT_FILTERS);
        state.hasQueried = false;
        state.rows = [];
        state.selectedIds = new Set();
        state.currentPage = 1;
        state.queryRunId = '';
        state.queryLoading = false;
        state.queryCanceling = false;
        state.queryProgress = null;
        state.queryShopProgressById = Object.create(null);
        state.queryError = '';
        state.queryWarning = '';
        state.queryResultMeta = null;
        state.quickCostDialogOpen = false;
        state.quickCostDialogLoading = false;
        state.quickCostDialogSaving = false;
        state.quickCostDialogError = '';
        state.quickCostDialogWarning = '';
        state.quickCostDialogNotice = '';
        state.quickCostDialogEntries = [];
        state.quickCostDialogRowCount = 0;
        state.batchAdjustDialogOpen = false;
        state.batchAdjustDialogLoading = false;
        state.batchAdjustDialogSaving = false;
        state.batchAdjustDialogSubmitting = false;
        state.batchAdjustDialogError = '';
        state.batchAdjustDialogWarning = '';
        state.batchAdjustDialogNotice = '';
        state.batchAdjustDialogEntries = [];
        state.batchAdjustDialogRowCount = 0;
        state.batchAdjustDialogDirty = false;
        state.batchAdjustDialogPendingSave = false;
        state.batchAdjustDialogPendingClose = false;
        clearBatchAdjustDialogSaveTimer(state);
        state.batchAdjustDialogSavePromise = null;
        state.batchAdjustDialogLastSavedSignature = '';
        state.batchAdjustDialogStationOptions = [];
        state.batchAdjustDialogStationIds = [];
        state.batchAdjustDialogDailyEnabled = true;
        state.batchAdjustDialogActivityEnabled = false;
        state.batchAdjustDialogReasonCode = '';
        state.batchAdjustDialogRemark = '';
        state.batchAdjustDialogDuplicateSubmitWindowDays = '';
        state.batchAdjustDialogActivityPriceReduction = '';
        state.batchAdjustDialogDailyProfitFloorMode = 'rate';
        state.batchAdjustDialogDailyProfitFloorValue = '';
        state.batchAdjustDialogActivityProfitFloorMode = 'rate';
        state.batchAdjustDialogActivityProfitFloorValue = '';
        state.batchAdjustSubmitRunId = '';
        state.batchAdjustSubmitProgress = null;
        state.batchAdjustPreviewShopId = '';
        resetBatchAdjustSubmitPreviewState(state);
        state.imagePreview = null;
        state.shopSelectorOpen = false;
        state.shopSelectorKeyword = '';
        state.shopSelectorFocusSearch = false;
        state.stationSelectorOpen = false;
        state.multiSelectorOpen = '';
        state.categorySelectorOpen = false;
        clearCategorySearchState(state);
        setCheckedCategoryPaths(state, []);
        setSelectedCategoryPath(state, []);
        clearCategoryChildRuntime(state);
        scheduleSaveQuerySettings(container);
        render(container);
        return;
      }

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

      if (actionId === 'open-batch-adjust') {
        void openBatchAdjustDialog(container);
        return;
      }

      if (actionId === 'open-batch-price-declaration') {
        openBatchPriceDeclDialog(container);
        return;
      }

      if (actionId === 'copy-price-decl-fallback-rule') {
        const ruleId = normalizeText(actionButton.getAttribute('data-npl-price-decl-rule-id'));
        if (ruleId) {
          copyPriceDeclFallbackApproveRule(state, ruleId);
          render(container);
        }
        return;
      }

      if (actionId === 'remove-price-decl-fallback-rule') {
        const ruleId = normalizeText(actionButton.getAttribute('data-npl-price-decl-rule-id'));
        if (ruleId) {
          removePriceDeclFallbackApproveRule(state, ruleId);
          render(container);
        }
        return;
      }

      if (actionId === 'close-batch-price-declaration') {
        const featureCenterApi = getFeatureCenterApi();
        const settingsSnapshot = collectPriceDeclSettings(state);
        void persistPriceDeclSettings(featureCenterApi, state, settingsSnapshot);
        closeBatchPriceDeclDialog(container);
        return;
      }

      if (actionId === 'preview-batch-price-declaration') {
        const validationError = getPriceDeclRunValidationError(state);
        if (validationError) {
          state.priceDeclDialogError = validationError;
          render(container);
          return;
        }

        state.priceDeclDialogError = '';

        const featureCenterApi = getFeatureCenterApi();
        if (
          !featureCenterApi
          || typeof featureCenterApi.previewOperationsNewProductLifecycleBatchPriceDecl !== 'function'
        ) {
          state.priceDeclDialogError = '批量预览核价接口未加载';
          render(container);
          return;
        }

        const eligibleRows = Array.isArray(state.priceDeclDialogEligibleRows)
          ? state.priceDeclDialogEligibleRows
          : [];

        if (eligibleRows.length <= 0) {
          state.priceDeclDialogError = '没有可核价的商品，请重新查询筛选';
          render(container);
          return;
        }

        const runId = createPriceDeclSubmitRunId();
        state.priceDeclDialogSaving = true;
        state.priceDeclDialogResult = '';
        state.priceDeclSubmitRunId = runId;
        state.priceDeclSubmitProgress = null;
        render(container);

        void (async () => {
          try {
            const settings = collectPriceDeclSettings(state);
            await persistPriceDeclSettings(featureCenterApi, state);

            const result = await featureCenterApi.previewOperationsNewProductLifecycleBatchPriceDecl({
              runId,
              rows: eligibleRows,
              settings
            });

            const previewItems = Array.isArray(result && result.previewItems) ? result.previewItems : [];
            const previewResultsByShop = Array.isArray(result && result.resultsByShop) ? result.resultsByShop : [];
            const previewShopCount = buildPriceDeclPreviewShopSummaries(previewItems, previewResultsByShop).length || 0;
            const previewSummary = result && result.summary
              ? result.summary
              : { total: 0, approve: 0, redeclare: 0, void: 0, skip: 0 };

            if (result && result.canceled === true) {
              resetPriceDeclPreviewState(state);
              state.priceDeclDialogError = '';
              state.priceDeclDialogResult = `\u5df2\u505c\u6b62\u4efb\u52a1${previewItems.length > 0 ? `\uff0c\u5df2\u5904\u7406 ${previewItems.length} \u4e2aSKU${previewShopCount > 0 ? `\uff0c\u6d89\u53ca ${previewShopCount} \u5bb6\u5e97\u94fa` : ''}` : ''}`;
            } else if (result && result.success === true && Array.isArray(result.previewItems)) {
              state.priceDeclPreviewOpen = true;
              state.priceDeclPreviewItems = previewItems;
              state.priceDeclPreviewResultsByShop = previewResultsByShop;
              state.priceDeclPreviewGroupedRequests = Array.isArray(result.groupedRequests) ? result.groupedRequests : [];
              state.priceDeclPreviewSummary = previewSummary;
              state.priceDeclPreviewRetryMode = false;
              state.priceDeclPreviewSelectedShopIds = [];
              state.priceDeclPreviewSelectedResultTypes = [];
              state.priceDeclPreviewSortField = 'productName';
              state.priceDeclPreviewSortDirection = 'asc';
              resetPriceDeclPreviewVisibleCount(state);
              state.priceDeclDialogError = '';
              const previewWarning = normalizeText(result && result.warning);
              state.priceDeclDialogResult = `${previewWarning ? '\u90e8\u5206\u9884\u89c8\u5b8c\u6210' : '\u9884\u89c8\u5b8c\u6210'}\uff0c\u5171 ${previewItems.length} \u4e2aSKU\uff0c\u6d89\u53ca ${previewShopCount || 1} \u5bb6\u5e97\u94fa\uff08\u901a\u8fc7: ${previewSummary.approve}\u3001\u91cd\u65b0\u6838\u4ef7: ${previewSummary.redeclare}\u3001\u4f5c\u5e9f: ${previewSummary.void}\u3001\u8df3\u8fc7: ${previewSummary.skip}\uff09${previewWarning ? `\uff1b${previewWarning}` : ''}`;
            } else {
              const failDetail = (result && result.message) || '\u6838\u4ef7\u9884\u89c8\u5931\u8d25';
              state.priceDeclDialogError = failDetail;
              state.priceDeclDialogResult = '';
            }
          } catch (error) {
            console.error('[PriceDecl] preview error:', error);
            state.priceDeclDialogError = `\u6838\u4ef7\u9884\u89c8\u5f02\u5e38\uff1a${(error && error.message) || '\u672a\u77e5\u9519\u8bef'}`;
            state.priceDeclDialogResult = '';
          }

          state.priceDeclDialogSaving = false;
          state.priceDeclSubmitRunId = '';
          render(container);
        })();

        return;
      }

      if (actionId === 'cancel-batch-price-declaration') {
        const featureCenterApi = getFeatureCenterApi();
        if (state.priceDeclSubmitProgress) {
          state.priceDeclSubmitProgress = normalizePriceDeclSubmitProgressPayload({
            ...(state.priceDeclSubmitProgress || {}),
            runId: normalizeText(state.priceDeclSubmitRunId),
            taskType: 'priceDeclSubmit',
            phase: 'canceling',
            message: '\u6b63\u5728\u505c\u6b62\u6838\u4ef7\u4efb\u52a1'
          });
          render(container);
        }
        if (featureCenterApi && typeof featureCenterApi.cancelOperationsNewProductLifecycleBatchPriceDecl === 'function') {
          featureCenterApi.cancelOperationsNewProductLifecycleBatchPriceDecl({
            runId: normalizeText(state.priceDeclSubmitRunId)
          });
        }
        return;
      }

      if (actionId === 'toggle-price-decl-preview-result-filter') {
        const resultType = normalizeText(actionButton.getAttribute('data-npl-price-decl-preview-result-type'));
        const currentValues = normalizeSelectedOptionValues(state.priceDeclPreviewSelectedResultTypes);
        state.priceDeclPreviewSelectedResultTypes = currentValues.includes(resultType)
          ? currentValues.filter((value) => value !== resultType)
          : currentValues.concat(resultType);
        resetPriceDeclPreviewVisibleCount(state);
        render(container);
        return;
      }

      if (actionId === 'clear-price-decl-preview-result-filter') {
        state.priceDeclPreviewSelectedResultTypes = [];
        resetPriceDeclPreviewVisibleCount(state);
        render(container);
        return;
      }

      if (actionId === 'sort-price-decl-preview') {
        const field = normalizeText(actionButton.getAttribute('data-npl-price-decl-sort'));
        if (!field) {
          return;
        }

        if (state.priceDeclPreviewSortField === field) {
          state.priceDeclPreviewSortDirection = state.priceDeclPreviewSortDirection === 'desc' ? 'asc' : 'desc';
        } else {
          state.priceDeclPreviewSortField = field;
          state.priceDeclPreviewSortDirection = 'asc';
        }
        resetPriceDeclPreviewVisibleCount(state);
        render(container);
        return;
      }

      if (actionId === 'export-price-decl-preview') {
        if (exportPriceDeclPreviewTable(state) !== true) {
          state.priceDeclDialogError = '\u5f53\u524d\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u6838\u4ef7\u9884\u89c8\u6570\u636e';
          render(container);
        }
        return;
      }

      if (actionId === 'submit-batch-price-declaration') {
        const validationError = getPriceDeclRunValidationError(state);
        if (validationError) {
          state.priceDeclDialogError = validationError;
          render(container);
          return;
        }

        state.priceDeclDialogError = '';

        const featureCenterApi = getFeatureCenterApi();
        if (
          !featureCenterApi
          || typeof featureCenterApi.submitOperationsNewProductLifecycleBatchPriceDecl !== 'function'
        ) {
          state.priceDeclDialogError = '\u6279\u91cf\u7533\u62a5\u6838\u4ef7\u63a5\u53e3\u672a\u52a0\u8f7d';
          render(container);
          return;
        }

        const eligibleRows = Array.isArray(state.priceDeclDialogEligibleRows)
          ? state.priceDeclDialogEligibleRows
          : [];

        if (eligibleRows.length <= 0) {
          state.priceDeclDialogError = '\u6ca1\u6709\u53ef\u6838\u4ef7\u7684\u5546\u54c1\uff0c\u8bf7\u91cd\u65b0\u67e5\u8be2\u7b5b\u9009';
          render(container);
          return;
        }

        const runId = createPriceDeclSubmitRunId();
        const totalShops = Array.from(new Set(
          eligibleRows.map((row) => normalizeText(row && row.shopId)).filter(Boolean)
        )).length;

        state.priceDeclDialogSaving = true;
        state.priceDeclDialogResult = '';
        state.priceDeclSubmitRunId = runId;
        state.priceDeclSubmitProgress = normalizePriceDeclSubmitProgressPayload({
          runId,
          taskType: 'priceDeclSubmit',
          phase: 'preparing',
          totalShops,
          completedShops: 0,
          failedShops: 0,
          successRequests: 0,
          failedRequests: 0,
          successSkuCount: 0,
          failedSkuCount: 0,
          message: '\u6b63\u5728\u540c\u6b65\u6838\u4ef7\u8bbe\u7f6e\uff0c\u5e76\u51c6\u5907\u63d0\u4ea4'
        });
        render(container);

        void (async () => {
          try {
            const settings = collectPriceDeclSettings(state);
            await persistPriceDeclSettings(featureCenterApi, state);

            const result = await featureCenterApi.submitOperationsNewProductLifecycleBatchPriceDecl({
              runId,
              rows: eligibleRows,
              settings
            });

            if (result && result.canceled === true) {
              const partialMessage = Array.isArray(result.results) && result.results.length > 0
                ? result.results.map((r) => `${r.shopName || r.shopId}\uff1a${r.message}`).join('\uff1b')
                : '';
              state.priceDeclDialogResult = `\u5df2\u505c\u6b62\u4efb\u52a1${partialMessage ? `\uff0c\u5df2\u5b8c\u6210\uff1a${partialMessage}` : ''}`;
              state.priceDeclDialogError = '';
            } else if (result && result.success === true) {
              const resultMessages = Array.isArray(result.results)
                ? result.results.map((r) => `${r.shopName || r.shopId}\uff1a${r.message}`).join('\uff1b')
                : '';
              state.priceDeclDialogResult = `\u6838\u4ef7\u63d0\u4ea4\u6210\u529f${result.totalShops > 1 ? `\uff0c\u5171\u5904\u7406 ${result.totalShops} \u5bb6\u5e97\u94fa` : ''}${resultMessages ? `\uff08${resultMessages}\uff09` : ''}`;
              state.priceDeclDialogError = '';
            } else if (applyPriceDeclFailedRetryState(state, result) === true) {
              state.priceDeclDialogError = `\u6838\u4ef7\u63d0\u4ea4\u90e8\u5206\u5931\u8d25\uff0c\u5df2\u81ea\u52a8\u4fdd\u7559 ${Number(result && result.failedRequests) || 0} \u7ec4 / ${Number(result && result.failedSkuCount) || 0} \u4e2aSKU \u7684\u5931\u8d25\u9879\uff0c\u53ef\u76f4\u63a5\u518d\u6b21\u63d0\u4ea4`;
              state.priceDeclDialogResult = '';
            } else {
              const failDetail = Array.isArray(result && result.results) && result.results.length > 0
                ? result.results.filter((r) => !r.success).map((r) => `${r.shopName || r.shopId}\uff1a${r.message}`).join('\uff1b')
                : (result && result.message) || '\u6838\u4ef7\u63d0\u4ea4\u5931\u8d25';
              state.priceDeclDialogError = failDetail;
              state.priceDeclDialogResult = '';
            }
          } catch (error) {
            console.error('[PriceDecl] submit error:', error);
            state.priceDeclSubmitProgress = normalizePriceDeclSubmitProgressPayload({
              ...(state.priceDeclSubmitProgress || {}),
              runId,
              taskType: 'priceDeclSubmit',
              phase: 'failed',
              message: normalizeText(error && error.message) || '\u6838\u4ef7\u63d0\u4ea4\u5931\u8d25'
            });
            state.priceDeclDialogError = `\u6838\u4ef7\u63d0\u4ea4\u5f02\u5e38\uff1a${(error && error.message) || '\u672a\u77e5\u9519\u8bef'}`;
            state.priceDeclDialogResult = '';
          }

          state.priceDeclDialogSaving = false;
          render(container);
        })();

        return;
      }

      if (actionId === 'submit-batch-price-declaration-from-preview') {
        const groupedRequests = Array.isArray(state.priceDeclPreviewGroupedRequests)
          ? state.priceDeclPreviewGroupedRequests
          : [];

        const validationError = getPriceDeclRunValidationError(state);
        if (validationError) {
          state.priceDeclDialogError = validationError;
          render(container);
          return;
        }

        if (groupedRequests.length <= 0) {
          state.priceDeclDialogError = '\u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u6838\u4ef7\u6570\u636e\uff0c\u8bf7\u91cd\u65b0\u9884\u89c8';
          render(container);
          return;
        }

        state.priceDeclDialogError = '';

        const featureCenterApi = getFeatureCenterApi();
        if (
          !featureCenterApi
          || typeof featureCenterApi.submitOperationsNewProductLifecycleBatchPriceDecl !== 'function'
        ) {
          state.priceDeclDialogError = '\u6279\u91cf\u7533\u62a5\u6838\u4ef7\u63a5\u53e3\u672a\u52a0\u8f7d';
          render(container);
          return;
        }

        const eligibleRows = Array.isArray(state.priceDeclDialogEligibleRows)
          ? state.priceDeclDialogEligibleRows
          : [];

        const runId = createPriceDeclSubmitRunId();
        const totalShops = Array.from(new Set(
          eligibleRows.map((row) => normalizeText(row && row.shopId)).filter(Boolean)
        )).length;

        state.priceDeclPreviewSaving = true;
        state.priceDeclDialogResult = '';
        state.priceDeclSubmitRunId = runId;
        state.priceDeclSubmitProgress = normalizePriceDeclSubmitProgressPayload({
          runId,
          taskType: 'priceDeclSubmit',
          phase: 'preparing',
          totalShops,
          completedShops: 0,
          failedShops: 0,
          successRequests: 0,
          failedRequests: 0,
          successSkuCount: 0,
          failedSkuCount: 0,
          message: '\u6b63\u5728\u540c\u6b65\u6838\u4ef7\u8bbe\u7f6e\uff0c\u5e76\u51c6\u5907\u63d0\u4ea4'
        });
        render(container);

        void (async () => {
          try {
            const settings = collectPriceDeclSettings(state);
            await persistPriceDeclSettings(featureCenterApi, state);

            const result = await featureCenterApi.submitOperationsNewProductLifecycleBatchPriceDecl({
              runId,
              rows: eligibleRows,
              settings,
              itemRequests: groupedRequests
            });

            if (result && result.canceled === true) {
              const partialMessage = Array.isArray(result.results) && result.results.length > 0
                ? result.results.map((r) => `${r.shopName || r.shopId}\uff1a${r.message}`).join('\uff1b')
                : '';
              state.priceDeclDialogResult = `\u5df2\u505c\u6b62\u4efb\u52a1${partialMessage ? `\uff0c\u5df2\u5b8c\u6210\uff1a${partialMessage}` : ''}`;
              state.priceDeclDialogError = '';
            } else if (result && result.success === true) {
              const resultMessages = Array.isArray(result.results)
                ? result.results.map((r) => `${r.shopName || r.shopId}\uff1a${r.message}`).join('\uff1b')
                : '';
              state.priceDeclDialogResult = `\u6838\u4ef7\u63d0\u4ea4\u6210\u529f${result.totalShops > 1 ? `\uff0c\u5171\u5904\u7406 ${result.totalShops} \u5bb6\u5e97\u94fa` : ''}${resultMessages ? `\uff08${resultMessages}\uff09` : ''}`;
              state.priceDeclDialogError = '';
              resetPriceDeclPreviewState(state);
            } else if (applyPriceDeclFailedRetryState(state, result) === true) {
              state.priceDeclDialogError = `\u6838\u4ef7\u63d0\u4ea4\u90e8\u5206\u5931\u8d25\uff0c\u5df2\u81ea\u52a8\u4fdd\u7559 ${Number(result && result.failedRequests) || 0} \u7ec4 / ${Number(result && result.failedSkuCount) || 0} \u4e2aSKU \u7684\u5931\u8d25\u9879\uff0c\u53ef\u76f4\u63a5\u518d\u6b21\u63d0\u4ea4`;
              state.priceDeclDialogResult = '';
            } else {
              const failDetail = Array.isArray(result && result.results) && result.results.length > 0
                ? result.results.filter((r) => !r.success).map((r) => `${r.shopName || r.shopId}\uff1a${r.message}`).join('\uff1b')
                : (result && result.message) || '\u6838\u4ef7\u63d0\u4ea4\u5931\u8d25';
              state.priceDeclDialogError = failDetail;
              state.priceDeclDialogResult = '';
            }
          } catch (error) {
            console.error('[PriceDecl] submit from preview error:', error);
            state.priceDeclSubmitProgress = normalizePriceDeclSubmitProgressPayload({
              ...(state.priceDeclSubmitProgress || {}),
              runId,
              taskType: 'priceDeclSubmit',
              phase: 'failed',
              message: normalizeText(error && error.message) || '\u6838\u4ef7\u63d0\u4ea4\u5931\u8d25'
            });
            state.priceDeclDialogError = `\u6838\u4ef7\u63d0\u4ea4\u5f02\u5e38\uff1a${(error && error.message) || '\u672a\u77e5\u9519\u8bef'}`;
            state.priceDeclDialogResult = '';
          }

          state.priceDeclPreviewSaving = false;
          render(container);
        })();

        return;
      }

      if (actionId === 'close-quick-cost-preset') {
        closeQuickCostPresetDialog(container);
        return;
      }

      if (actionId === 'close-batch-adjust') {
        void closeBatchAdjustDialog(container);
        return;
      }

      if (actionId === 'cancel-batch-adjust') {
        const featureCenterApi = getFeatureCenterApi();
        const runId = normalizeText(state.batchAdjustSubmitRunId) || normalizeText(state.batchAdjustPreviewRunId);

        if (!runId) {
          return;
        }

        state.batchAdjustCanceledRunId = runId;

        if (state.batchAdjustDialogSubmitting === true && state.batchAdjustSubmitProgress) {
          state.batchAdjustSubmitProgress = normalizeBatchAdjustSubmitProgressPayload({
            ...(state.batchAdjustSubmitProgress || {}),
            runId: normalizeText(state.batchAdjustSubmitRunId),
            phase: 'canceling',
            message: '\u6b63\u5728\u505c\u6b62\u6279\u91cf\u8c03\u4ef7\u4efb\u52a1'
          });
        } else if (state.batchAdjustSubmitPreviewSaving === true) {
          state.batchAdjustPreviewProgress = normalizeBatchAdjustSubmitProgressPayload({
            ...(state.batchAdjustPreviewProgress || {}),
            runId: normalizeText(state.batchAdjustPreviewRunId),
            phase: 'canceling',
            message: '\u6b63\u5728\u505c\u6b62\u9884\u89c8\u4efb\u52a1'
          });
          state.batchAdjustDialogNotice = '\u6b63\u5728\u505c\u6b62\u9884\u89c8\u4efb\u52a1';
          state.batchAdjustDialogError = '';
        }

        scheduleBatchAdjustSubmitRuntimeRefresh(container);
        render(container);

        if (featureCenterApi && typeof featureCenterApi.cancelOperationsNewProductLifecycleBatchAdjust === 'function') {
          void (async () => {
            try {
              const cancelResult = await featureCenterApi.cancelOperationsNewProductLifecycleBatchAdjust({ runId });

              if (cancelResult && cancelResult.canceled === false) {
                state.batchAdjustDialogNotice = '';
                state.batchAdjustDialogError = '\u6682\u672a\u627e\u5230\u53ef\u505c\u6b62\u7684\u4efb\u52a1\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5';
              }
            } catch (error) {
              state.batchAdjustDialogNotice = '';
              state.batchAdjustDialogError = normalizeBatchAdjustSubmitErrorMessage(error, '\u505c\u6b62\u4efb\u52a1\u5931\u8d25');
            }

            render(container);
          })();
        }
        return;
      }

      if (actionId === 'back-batch-adjust-submit-preview') {
        resetBatchAdjustSubmitPreviewState(state);
        state.batchAdjustDialogError = '';
        state.batchAdjustDialogWarning = '';
        state.batchAdjustDialogNotice = '';
        render(container);
        return;
      }

      if (actionId === 'save-quick-cost-preset') {
        void saveQuickCostPresetDialog(container);
        return;
      }

      if (actionId === 'preview-batch-adjust') {
        void previewBatchAdjustDialog(container);
        return;
      }

      if (actionId === 'submit-batch-adjust-from-preview') {
        void submitBatchAdjustDialog(container, {
          usePreviewRequests: true
        });
        return;
      }

      if (actionId === 'submit-batch-adjust') {
        void submitBatchAdjustDialog(container);
        return;
      }

      if (actionId === 'add-batch-adjust-rule') {
        if (state.batchAdjustDialogSaving === true || state.batchAdjustDialogSubmitting === true) {
          return;
        }

        addBatchAdjustRuleToEntry(
          state,
          target.getAttribute('data-npl-batch-adjust-entry-key')
        );
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (actionId === 'apply-batch-adjust-copy-source') {
        if (state.batchAdjustDialogSaving === true || state.batchAdjustDialogSubmitting === true) {
          return;
        }

        const targetEntryKey = normalizeText(actionButton.getAttribute('data-npl-batch-adjust-copy-target'));
        const targetEntry = (Array.isArray(state.batchAdjustDialogEntries) ? state.batchAdjustDialogEntries : [])
          .find((entry) => normalizeText(entry && entry.key) === targetEntryKey);
        const sourceEntryKey = normalizeText(targetEntry && targetEntry.copySourceEntryKey);

        if (!sourceEntryKey) {
          return;
        }

        if (applyBatchAdjustRulesFromEntry(state, targetEntryKey, sourceEntryKey) !== true) {
          return;
        }

        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }

      if (actionId === 'remove-batch-adjust-rule') {
        if (state.batchAdjustDialogSaving === true || state.batchAdjustDialogSubmitting === true) {
          return;
        }

        removeBatchAdjustRuleFromEntry(
          state,
          target.getAttribute('data-npl-batch-adjust-entry-key'),
          target.getAttribute('data-npl-batch-adjust-rule-id')
        );
        scheduleSaveBatchAdjustDialog(container);
        render(container);
        return;
      }
    });

    container.addEventListener('scroll', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.hasAttribute('data-npl-batch-adjust-submit-preview-wrap') === true) {
        const state = getState(container);

        if (state.batchAdjustSubmitPreviewOpen !== true) {
          return;
        }

        const nextScrollTop = Math.max(0, Number(target.scrollTop) || 0);
        const nextViewportHeight = Math.max(
          320,
          normalizeIntegerValue(target.clientHeight, BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT)
        );
        const currentScrollTop = Math.max(0, Number(state.batchAdjustSubmitPreviewVirtualScrollTop) || 0);
        const currentViewportHeight = Math.max(
          320,
          normalizeIntegerValue(
            state.batchAdjustSubmitPreviewVirtualViewportHeight,
            BATCH_ADJUST_SUBMIT_PREVIEW_VIRTUAL_VIEWPORT_HEIGHT
          )
        );

        if (
          Math.abs(currentScrollTop - nextScrollTop) < 1
          && currentViewportHeight === nextViewportHeight
        ) {
          return;
        }

        state.batchAdjustSubmitPreviewVirtualScrollTop = nextScrollTop;
        state.batchAdjustSubmitPreviewVirtualViewportHeight = nextViewportHeight;

        if (!state.batchAdjustSubmitPreviewVirtualFrame) {
          const scheduleFrame = typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : (callback) => window.setTimeout(callback, 16);
          state.batchAdjustSubmitPreviewVirtualFrame = scheduleFrame(() => {
            state.batchAdjustSubmitPreviewVirtualFrame = 0;
            if (refreshBatchAdjustSubmitPreviewVirtualRows(container) !== true) {
              render(container);
            }
          });
        }
        return;
      }

      if (target.hasAttribute('data-npl-price-decl-preview-table-wrap') !== true) {
        return;
      }

      const state = getState(container);
      const visibleItems = getPriceDeclPreviewVisibleItems(state);
      const totalVisibleCount = visibleItems.length;
      const currentVisibleCount = Math.max(
        0,
        normalizeIntegerValue(state.priceDeclPreviewVisibleCount, PRICE_DECL_PREVIEW_LAZY_BATCH_SIZE)
      );

      if (currentVisibleCount >= totalVisibleCount) {
        return;
      }

      if (target.scrollTop + target.clientHeight < target.scrollHeight - 240) {
        return;
      }

      appendPriceDeclPreviewVisibleCount(state, totalVisibleCount);
      render(container);
    }, true);

    container.dataset.operationsNewProductLifecycleBound = 'true';
  }

  function createController(container) {
    const keepAliveHelper = window.moduleKeepAlive || window.operationsModuleKeepAlive;

    if (keepAliveHelper && typeof keepAliveHelper.createKeepAliveController === 'function') {
      return keepAliveHelper.createKeepAliveController({
        panel: container,
        onActivate(options = {}) {
          bindQueryProgressListener(container);
          bindBatchAdjustSubmitProgressListener(container);
          bindBatchAdjustPreviewProgressListener(container);
          bindPriceDeclSubmitProgressListener(container);

          if (options && options.resume === true) {
            render(container);
            return;
          }

          void loadQuerySettings(container);
          void loadShopSelectionPresetSnapshot(container);
          void loadShopCatalog(container);
          void loadCategorySnapshot(container);
        },
        onDeactivate() {
          const state = getState(container);

          if (state.batchAdjustDialogOpen === true) {
            void closeBatchAdjustDialog(container);
          }

          if (
            state.shopSelectorOpen
            || state.stationSelectorOpen
            || state.multiSelectorOpen
            || state.categorySelectorOpen
            || state.quickCostDialogOpen
            || state.batchAdjustDialogOpen
            || state.imagePreview
          ) {
            state.shopSelectorOpen = false;
            state.shopSelectorKeyword = '';
            state.shopSelectorFocusSearch = false;
            state.stationSelectorOpen = false;
            state.multiSelectorOpen = '';
            state.categorySelectorOpen = false;
            state.quickCostDialogOpen = false;
            state.quickCostDialogLoading = false;
            state.quickCostDialogSaving = false;
            state.quickCostDialogError = '';
            state.quickCostDialogWarning = '';
            state.quickCostDialogNotice = '';
            state.quickCostDialogEntries = [];
            state.quickCostDialogRowCount = 0;
            state.imagePreview = null;
            clearCategorySearchState(state);
            render(container);
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

    bindEvents(container);
    bindQueryProgressListener(container);
    bindBatchAdjustSubmitProgressListener(container);
    bindBatchAdjustPreviewProgressListener(container);
    bindPriceDeclSubmitProgressListener(container);

    if (container.dataset.operationsNewProductLifecycleMounted !== 'true') {
      container.dataset.operationsNewProductLifecycleMounted = 'true';
      render(container);
      void loadQuerySettings(container);
      void loadShopSelectionPresetSnapshot(container);
      void loadShopCatalog(container);
      void loadCategorySnapshot(container);
    }

    if (!container.__operationsNewProductLifecycleController) {
      container.__operationsNewProductLifecycleController = createController(container);
    }

    return container.__operationsNewProductLifecycleController;
  }

  window.operationsNewProductLifecycleView = {
    mount
  };
})();
