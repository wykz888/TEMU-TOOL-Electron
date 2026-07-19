import {
  buildMonitorMetricCells,
  buildMonitorRegionSummary,
  normalizeText
} from './promotionMonitorColumns.js';

const EMPTY_TEXT = '-';
const UNGROUPED_LABEL = '\u672a\u5206\u7ec4';
const MONITOR_ENABLED_TEXT = '\u76d1\u63a7\u4e2d';
const MONITOR_DISABLED_TEXT = '\u672a\u76d1\u63a7';
const MONITOR_LOG_JOINED_WAITING = '\u5df2\u52a0\u5165\u6279\u91cf\u76d1\u63a7\u540d\u5355\uff0c\u7b49\u5f85\u5f00\u59cb';
const HIDDEN_VISIBLE_VALUES = Object.freeze([
  '0',
  'false',
  'hidden',
  'hide',
  'close',
  'closed',
  'disable',
  'disabled',
  '\u9690\u85cf',
  '\u5173\u95ed'
]);
const SHOWN_VISIBLE_VALUES = Object.freeze([
  '1',
  'true',
  'visible',
  'show',
  'open',
  'opened',
  'enable',
  'enabled',
  '\u663e\u793a',
  '\u5f00\u542f',
  '\u542f\u7528'
]);

const STATUS_LABEL_MAP = Object.freeze({
  disabled: '\u5df2\u505c\u7528',
  idle: '\u7b49\u5f85',
  online: '\u5728\u7ebf',
  running: '\u8fd0\u884c\u4e2d',
  retrying: '\u91cd\u8bd5\u4e2d',
  relogin: '\u91cd\u65b0\u767b\u5f55',
  stopped: '\u5df2\u505c\u6b62',
  error: '\u5f02\u5e38'
});

const STATUS_TONE_MAP = Object.freeze({
  disabled: 'gray',
  idle: 'gray',
  online: 'green',
  running: 'blue',
  retrying: 'orange',
  relogin: 'orange',
  stopped: 'gray',
  error: 'red'
});

function normalizeVisibleFlag(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (HIDDEN_VISIBLE_VALUES.includes(normalizedValue)) {
    return false;
  }

  if (SHOWN_VISIBLE_VALUES.includes(normalizedValue)) {
    return true;
  }

  return fallback;
}

function normalizeShopSummary(shop) {
  const id = normalizeText(shop && shop.id);

  if (!id || !normalizeVisibleFlag(shop && shop.isVisible)) {
    return null;
  }

  return {
    id,
    shopName: normalizeText(
      shop && (
        shop.shopName
        || shop.name
        || shop.storeName
        || shop.label
      )
    ) || id,
    groupName: normalizeText(shop && shop.groupName) || UNGROUPED_LABEL,
    note: normalizeText(shop && shop.note),
    updatedAt: normalizeText(shop && shop.updatedAt)
  };
}

function buildShopMap(shopRows) {
  return new Map(
    (Array.isArray(shopRows) ? shopRows : [])
      .map(normalizeShopSummary)
      .filter(Boolean)
      .map((shop) => [shop.id, shop])
  );
}

function buildSnapshotShopEntries(snapshot) {
  const shops = snapshot && snapshot.shops && typeof snapshot.shops === 'object'
    ? snapshot.shops
    : {};

  return new Map(
    Object.entries(shops)
      .map(([shopId, shopState]) => {
        const normalizedShopId = normalizeText(shopId || (shopState && shopState.shopId));

        return normalizedShopId ? [normalizedShopId, shopState || {}] : null;
      })
      .filter(Boolean)
  );
}

function getStatusLabel(status, enabled) {
  if (enabled !== true) {
    return MONITOR_DISABLED_TEXT;
  }

  const normalizedStatus = normalizeText(status) || 'idle';

  return STATUS_LABEL_MAP[normalizedStatus] || normalizedStatus;
}

function getStatusTone(status, enabled) {
  if (enabled !== true) {
    return STATUS_TONE_MAP.disabled;
  }

  return STATUS_TONE_MAP[normalizeText(status)] || STATUS_TONE_MAP.idle;
}

function formatHourMinute(value) {
  const timestamp = Date.parse(normalizeText(value));

  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const date = new Date(timestamp);

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function buildLogText(shopState, fallbackUpdatedAt = '') {
  const lastError = normalizeText(shopState && shopState.lastError);
  const logText = normalizeText(shopState && shopState.log);

  if (lastError) {
    return lastError;
  }

  if (!logText) {
    return EMPTY_TEXT;
  }

  if (logText === MONITOR_LOG_JOINED_WAITING) {
    const timeText = formatHourMinute(
      (shopState && shopState.lastUpdatedAt)
      || (shopState && shopState.lastSuccessAt)
      || fallbackUpdatedAt
    );

    return timeText ? `${timeText} ${logText}` : logText;
  }

  return logText;
}

function resolveShopLastUpdatedAt(shopState, snapshotUpdatedAt) {
  return (
    normalizeText(shopState && shopState.lastUpdatedAt)
    || normalizeText(snapshotUpdatedAt)
  );
}

function normalizeSnapshotTimestamp(snapshot) {
  return normalizeText(snapshot && snapshot.updatedAt);
}

export function createDefaultPromotionMonitorSnapshot() {
  return {
    updatedAt: '',
    batchMonitoringActive: false,
    enabledShopIds: [],
    shops: {}
  };
}

export function buildPromotionMonitorRows({
  snapshot,
  shopRows,
  selectedRegionIds,
  monitorShopConfigs
} = {}) {
  const shopMap = buildShopMap(shopRows);
  const snapshotShopEntries = buildSnapshotShopEntries(snapshot);
  const snapshotUpdatedAt = normalizeSnapshotTimestamp(snapshot);
  const shopIds = Array.from(new Set([
    ...shopMap.keys(),
    ...Array.from(snapshotShopEntries.entries())
      .filter(([, shopState]) => shopState && shopState.enabled === true)
      .map(([shopId]) => shopId)
  ]));

  return shopIds
    .map((shopId) => {
      const shop = shopMap.get(shopId);
      const shopState = snapshotShopEntries.get(shopId) || {};

      if (!shop && shopState.enabled !== true) {
        return null;
      }

      const enabled = shopState.enabled === true;
      const status = normalizeText(shopState.status) || (enabled ? 'idle' : 'disabled');
      const hasIndependentConfig = Boolean(
        monitorShopConfigs
        && typeof monitorShopConfigs === 'object'
        && monitorShopConfigs[shopId]
      );
      const rowRegionIds = hasIndependentConfig
        ? monitorShopConfigs[shopId].regionIds
        : selectedRegionIds;
      const regionSummary = buildMonitorRegionSummary(shopState.regions, rowRegionIds);

      return {
        id: shopId,
        shopId,
        shopName: normalizeText(shop && shop.shopName) || normalizeText(shopState.shopName) || shopId,
        groupName: normalizeText(shop && shop.groupName) || UNGROUPED_LABEL,
        note: normalizeText(shop && shop.note),
        monitorEnabled: enabled,
        monitorText: enabled ? MONITOR_ENABLED_TEXT : MONITOR_DISABLED_TEXT,
        status,
        statusLabel: getStatusLabel(status, enabled),
        statusTone: getStatusTone(status, enabled),
        logText: buildLogText(shopState, snapshotUpdatedAt),
        lastUpdatedAt: resolveShopLastUpdatedAt(shopState, snapshotUpdatedAt),
        lastSuccessAt: normalizeText(shopState.lastSuccessAt),
        nextRunAt: Math.max(0, Number(shopState.nextRunAt) || 0),
        hasIndependentConfig,
        regionSummaryText: regionSummary.text,
        regionSummaryTitle: regionSummary.title,
        metrics: buildMonitorMetricCells(shopState.regions, rowRegionIds)
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.groupName.localeCompare(right.groupName, 'zh-CN')
      || left.shopName.localeCompare(right.shopName, 'zh-CN')
      || left.shopId.localeCompare(right.shopId)
    ));
}
