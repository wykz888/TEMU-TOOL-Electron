const DEFAULT_MAX_ENTRY_COUNT = 600;
const DEFAULT_READ_LIMIT = 180;
const MAX_READ_LIMIT = 500;

const REGION_LABEL_MAP = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

const EVENT_LABEL_MAP = Object.freeze({
  promotion_monitor_stage_changed: '\u76d1\u63a7\u9636\u6bb5',
  promotion_monitor_shop_cycle_started: '\u5e97\u94fa\u5f00\u59cb\u540c\u6b65',
  promotion_monitor_shop_synced: '\u5e97\u94fa\u540c\u6b65\u5b8c\u6210',
  promotion_monitor_shop_sync_failed: '\u5e97\u94fa\u540c\u6b65\u5931\u8d25',
  promotion_monitor_action_executed: '\u5546\u54c1\u64cd\u4f5c\u6210\u529f',
  promotion_monitor_action_failed: '\u5546\u54c1\u64cd\u4f5c\u5931\u8d25',
  promotion_monitor_pause_resume_fallback_synced: '\u6062\u590d\u68c0\u67e5\u5b8c\u6210',
  promotion_monitor_pause_resume_fallback_failed: '\u6062\u590d\u68c0\u67e5\u5931\u8d25',
  promotion_monitor_shop_toggle: '\u5e97\u94fa\u76d1\u63a7\u5f00\u5173',
  promotion_monitor_batch_toggle: '\u6279\u91cf\u76d1\u63a7\u5f00\u5173',
  promotion_monitor_scheduler_failed: '\u76d1\u63a7\u8c03\u5ea6\u5f02\u5e38',
  promotion_monitor_relogin_trigger_failed: '\u91cd\u767b\u89e6\u53d1\u5931\u8d25'
});

const ACTION_LABEL_MAP = Object.freeze({
  pause_plan: '\u6682\u505c\u8ba1\u5212',
  delete_plan: '\u5220\u9664\u8ba1\u5212',
  update_roas: '\u4fee\u6539 ROAS',
  resume_plan: '\u6062\u590d\u8ba1\u5212',
  pause_then_modify: '\u6682\u505c\u540e\u4fee\u6539',
  pause_then_resume: '\u6682\u505c\u540e\u6062\u590d',
  pause_then_modify_resume: '\u6682\u505c\u540e\u4fee\u6539\u5e76\u6062\u590d'
});

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function truncateText(value, maxLength = 360) {
  const text = normalizeText(value);

  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function normalizeInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: normalizeText(error.name) || 'Error',
    message: normalizeText(error.message || error),
    stack: normalizeText(error.stack)
  };
}

function buildRegionLabel(regionId) {
  const normalizedRegionId = normalizeText(regionId);

  return REGION_LABEL_MAP[normalizedRegionId] || normalizedRegionId;
}

function buildActionLabel(actionType) {
  const normalizedActionType = normalizeText(actionType);

  return ACTION_LABEL_MAP[normalizedActionType] || normalizedActionType;
}

function buildShopLabel(payload) {
  const shopName = normalizeText(payload && payload.shopName);
  const shopId = normalizeText(payload && payload.shopId);

  return shopName || shopId;
}

function buildProductLabel(payload) {
  const productName = normalizeText(payload && payload.productName);
  const goodsId = normalizeText(payload && payload.goodsId);

  if (productName && goodsId) {
    return `${productName} (${goodsId})`;
  }

  return productName || goodsId;
}

function buildOperationSummaryText(operationSummary) {
  const summary = operationSummary && typeof operationSummary === 'object' ? operationSummary : {};
  const successCount = Math.max(0, Number(summary.successCount) || 0);
  const failedCount = Math.max(0, Number(summary.failedCount) || 0);
  const skippedCount = Math.max(0, Number(summary.skippedCount) || 0);
  const attemptedCount = Math.max(0, Number(summary.attemptedCount) || 0);
  const parts = [];

  if (attemptedCount > 0) {
    parts.push(`\u5c1d\u8bd5 ${attemptedCount}`);
  }

  if (successCount > 0) {
    parts.push(`\u6210\u529f ${successCount}`);
  }

  if (failedCount > 0) {
    parts.push(`\u5931\u8d25 ${failedCount}`);
  }

  if (skippedCount > 0) {
    parts.push(`\u8df3\u8fc7 ${skippedCount}`);
  }

  return parts.join(' / ');
}

function buildNextRunText(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  try {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (_error) {
    return '';
  }
}

function buildEventLabel(eventName) {
  const normalizedEventName = normalizeText(eventName);

  return EVENT_LABEL_MAP[normalizedEventName] || normalizedEventName || '\u8fd0\u884c\u65e5\u5fd7';
}

function buildSummary(eventName, payload, error) {
  const normalizedEventName = normalizeText(eventName);
  const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
  const message = normalizeText(normalizedPayload.message);
  const shopLabel = buildShopLabel(normalizedPayload);
  const regionLabel = buildRegionLabel(normalizedPayload.regionId);
  const actionLabel = buildActionLabel(
    normalizedPayload.executedActionType || normalizedPayload.actionType
  );
  const productLabel = buildProductLabel(normalizedPayload);
  const errorMessage = normalizeText(error && error.message);

  if (message) {
    return truncateText(message);
  }

  if (normalizedEventName === 'promotion_monitor_batch_toggle') {
    return normalizedPayload.enabled === true
      ? '\u6279\u91cf\u76d1\u63a7\u5df2\u542f\u52a8'
      : '\u6279\u91cf\u76d1\u63a7\u5df2\u505c\u6b62';
  }

  if (normalizedEventName === 'promotion_monitor_shop_toggle') {
    return [
      shopLabel || '\u5e97\u94fa',
      normalizedPayload.enabled === true
        ? '\u5df2\u52a0\u5165\u63a8\u5e7f\u76d1\u63a7'
        : '\u5df2\u79fb\u51fa\u63a8\u5e7f\u76d1\u63a7'
    ].filter(Boolean).join(' ');
  }

  if (normalizedEventName === 'promotion_monitor_shop_cycle_started') {
    return shopLabel
      ? `${shopLabel} \u5f00\u59cb\u68c0\u67e5\u63a8\u5e7f\u6570\u636e`
      : '\u5f00\u59cb\u68c0\u67e5\u63a8\u5e7f\u6570\u636e';
  }

  if (normalizedEventName === 'promotion_monitor_shop_synced') {
    const operationText = buildOperationSummaryText(normalizedPayload.operationSummary);
    const nextRunText = buildNextRunText(normalizedPayload.nextRunAt);

    return [
      shopLabel ? `${shopLabel} \u540c\u6b65\u5b8c\u6210` : '\u5e97\u94fa\u540c\u6b65\u5b8c\u6210',
      operationText ? `\u64cd\u4f5c ${operationText}` : '',
      nextRunText ? `\u4e0b\u6b21 ${nextRunText}` : ''
    ].filter(Boolean).join('\uff0c');
  }

  if (normalizedEventName === 'promotion_monitor_shop_sync_failed') {
    return truncateText(
      [
        shopLabel ? `${shopLabel} \u540c\u6b65\u5931\u8d25` : '\u5e97\u94fa\u540c\u6b65\u5931\u8d25',
        errorMessage
      ].filter(Boolean).join('\uff0c')
    );
  }

  if (
    normalizedEventName === 'promotion_monitor_action_executed'
    || normalizedEventName === 'promotion_monitor_action_failed'
  ) {
    return truncateText(
      [
        shopLabel,
        regionLabel,
        actionLabel,
        productLabel,
        normalizedEventName === 'promotion_monitor_action_failed'
          ? (errorMessage || '\u6267\u884c\u5931\u8d25')
          : '\u6267\u884c\u6210\u529f'
      ].filter(Boolean).join('\uff0c')
    );
  }

  if (normalizedEventName === 'promotion_monitor_pause_resume_fallback_synced') {
    const operationText = buildOperationSummaryText(normalizedPayload.operationSummary);

    return [
      shopLabel ? `${shopLabel} \u6062\u590d\u68c0\u67e5\u5b8c\u6210` : '\u6062\u590d\u68c0\u67e5\u5b8c\u6210',
      operationText
    ].filter(Boolean).join('\uff0c');
  }

  if (normalizedEventName === 'promotion_monitor_pause_resume_fallback_failed') {
    return truncateText(
      [
        shopLabel ? `${shopLabel} \u6062\u590d\u68c0\u67e5\u5931\u8d25` : '\u6062\u590d\u68c0\u67e5\u5931\u8d25',
        errorMessage
      ].filter(Boolean).join('\uff0c')
    );
  }

  return truncateText(errorMessage || JSON.stringify(normalizedPayload));
}

function normalizeEntry(rawEntry, fallbackId) {
  const payload = rawEntry && rawEntry.payload && typeof rawEntry.payload === 'object'
    ? rawEntry.payload
    : {};
  const error = normalizeError(rawEntry && rawEntry.error);
  const level = normalizeText(rawEntry && rawEntry.level) || (error ? 'error' : 'info');
  const eventName = normalizeText(rawEntry && rawEntry.eventName);
  const regionId = normalizeText(payload.regionId);
  const actionType = normalizeText(payload.executedActionType || payload.actionType);

  return {
    id: normalizeText(rawEntry && rawEntry.id) || String(fallbackId),
    time: normalizeText(rawEntry && rawEntry.time) || new Date().toISOString(),
    level: level === 'error' || level === 'warning' ? level : 'info',
    eventName,
    event: buildEventLabel(eventName),
    summary: buildSummary(eventName, payload, error),
    detail: normalizeText(payload.detail),
    errorMessage: error ? truncateText(error.message, 260) : '',
    shopId: normalizeText(payload.shopId),
    shopName: normalizeText(payload.shopName),
    regionId,
    regionLabel: buildRegionLabel(regionId),
    goodsId: normalizeText(payload.goodsId),
    productName: normalizeText(payload.productName),
    actionType,
    actionLabel: buildActionLabel(actionType)
  };
}

function matchesFilter(entry, payload) {
  const shopId = normalizeText(payload && payload.shopId);
  const regionId = normalizeText(payload && payload.regionId);
  const level = normalizeText(payload && payload.level);

  return (
    (!shopId || entry.shopId === shopId)
    && (!regionId || entry.regionId === regionId)
    && (!level || entry.level === level)
  );
}

function createPromotionMonitorRuntimeLogStore(options = {}) {
  const maxEntryCount = Math.max(
    20,
    normalizeInteger(options.maxEntries, DEFAULT_MAX_ENTRY_COUNT)
  );
  let entries = [];
  let sequence = 0;
  let updatedAt = '';

  function read(payload = {}) {
    const limit = Math.max(
      1,
      Math.min(MAX_READ_LIMIT, normalizeInteger(payload && payload.limit, DEFAULT_READ_LIMIT))
    );
    const filteredEntries = entries.filter((entry) => matchesFilter(entry, payload));

    return {
      updatedAt,
      totalCount: filteredEntries.length,
      entries: filteredEntries.slice(0, limit)
    };
  }

  function append(eventName, payload = {}, options = {}) {
    const now = new Date().toISOString();
    const entry = normalizeEntry(
      {
        id: `${now}:${sequence += 1}`,
        time: now,
        eventName,
        payload,
        level: options.level,
        error: options.error
      },
      sequence
    );

    entries = [entry, ...entries].slice(0, maxEntryCount);
    updatedAt = now;
    return entry;
  }

  function clear() {
    entries = [];
    updatedAt = new Date().toISOString();
    return read();
  }

  return {
    append,
    clear,
    read
  };
}

module.exports = {
  createPromotionMonitorRuntimeLogStore
};
