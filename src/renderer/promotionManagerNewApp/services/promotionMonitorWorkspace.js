import {
  DEFAULT_MONITOR_COLUMN_IDS,
  normalizeMonitorColumnIds,
  normalizeMonitorFilter
} from '../view-models/promotionMonitorColumns.js';
import {
  buildPromotionMonitorConfigSettingsPayload,
  createDefaultPromotionMonitorConfig,
  normalizePromotionMonitorConfig
} from '../view-models/promotionMonitorConfig.js';
import {
  createDefaultPromotionMonitorSnapshot
} from '../view-models/promotionMonitorRows.js';

function resolveFeatureCenterBridge() {
  return window.temuApp && window.temuApp.featureCenter
    ? window.temuApp.featureCenter
    : null;
}

function resolveShopManagementBridge() {
  return window.temuApp && window.temuApp.shopManagement
    ? window.temuApp.shopManagement
    : null;
}

function getBridgeMethod(bridge, methodName, errorMessage) {
  const method = bridge && bridge[methodName];

  if (typeof method !== 'function') {
    throw new Error(errorMessage);
  }

  return method.bind(bridge);
}

function normalizeSettingsResult(result) {
  const source = result && typeof result === 'object' ? result : {};
  const settings = source.settings && typeof source.settings === 'object'
    ? source.settings
    : {};
  const monitorView = settings.monitorView && typeof settings.monitorView === 'object'
    ? settings.monitorView
    : {};

  return {
    settings,
    source: String(source.source || '').trim(),
    monitorView: {
      activeFilter: normalizeMonitorFilter(monitorView.activeFilter),
      selectedColumnIds: normalizeMonitorColumnIds(monitorView.selectedColumnIds || DEFAULT_MONITOR_COLUMN_IDS)
    },
    monitorConfig: settings.monitorConfig && typeof settings.monitorConfig === 'object'
      ? normalizePromotionMonitorConfig(settings.monitorConfig)
      : createDefaultPromotionMonitorConfig(),
    monitorShopConfigs: normalizeMonitorShopConfigs(settings.monitorShopConfigs)
  };
}

function normalizeMonitorShopConfigs(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload)
      .map(([shopId, config]) => {
        const normalizedShopId = String(shopId || '').trim();

        if (!normalizedShopId || !config || typeof config !== 'object') {
          return null;
        }

        return [normalizedShopId, normalizePromotionMonitorConfig(config)];
      })
      .filter(Boolean)
  );
}

async function readSettings(featureCenterBridge) {
  const getSettings = getBridgeMethod(
    featureCenterBridge,
    'getPromotionManagerNewMonitorSettings',
    '\u63a8\u5e7f\u76d1\u63a7\u8bbe\u7f6e\u8bfb\u53d6\u670d\u52a1\u672a\u52a0\u8f7d'
  );

  return normalizeSettingsResult(await getSettings());
}

async function readSnapshot(featureCenterBridge) {
  const getSnapshot = getBridgeMethod(
    featureCenterBridge,
    'getPromotionMonitorSnapshot',
    '\u63a8\u5e7f\u76d1\u63a7\u5feb\u7167\u670d\u52a1\u672a\u52a0\u8f7d'
  );
  const snapshot = await getSnapshot();

  return snapshot && typeof snapshot === 'object'
    ? {
      ...createDefaultPromotionMonitorSnapshot(),
      ...snapshot,
      shops: snapshot.shops && typeof snapshot.shops === 'object' ? snapshot.shops : {}
    }
    : createDefaultPromotionMonitorSnapshot();
}

async function readShopState(shopManagementBridge) {
  const getState = getBridgeMethod(
    shopManagementBridge,
    'getState',
    '\u5e97\u94fa\u7ba1\u7406\u6570\u636e\u670d\u52a1\u672a\u52a0\u8f7d'
  );
  const state = await getState();

  return state && typeof state === 'object' ? state : { shops: [] };
}

function toMessage(error) {
  return String(error && error.message ? error.message : error || '').trim();
}

export async function loadPromotionMonitorWorkspaceData({
  featureCenterBridge = resolveFeatureCenterBridge(),
  shopManagementBridge = resolveShopManagementBridge()
} = {}) {
  const [settingsResult, snapshotResult, shopStateResult] = await Promise.allSettled([
    readSettings(featureCenterBridge),
    readSnapshot(featureCenterBridge),
    readShopState(shopManagementBridge)
  ]);
  const errors = [settingsResult, snapshotResult, shopStateResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => toMessage(result.reason))
    .filter(Boolean);

  return {
    settings: settingsResult.status === 'fulfilled'
      ? settingsResult.value
      : normalizeSettingsResult(null),
    snapshot: snapshotResult.status === 'fulfilled'
      ? snapshotResult.value
      : createDefaultPromotionMonitorSnapshot(),
    shopState: shopStateResult.status === 'fulfilled'
      ? shopStateResult.value
      : { shops: [] },
    errors
  };
}

export async function loadPromotionMonitorSnapshot(featureCenterBridge = resolveFeatureCenterBridge()) {
  return readSnapshot(featureCenterBridge);
}

export async function savePromotionMonitorViewSettings(payload, featureCenterBridge = resolveFeatureCenterBridge()) {
  const saveSettings = getBridgeMethod(
    featureCenterBridge,
    'savePromotionManagerNewMonitorSettings',
    '\u63a8\u5e7f\u76d1\u63a7\u8bbe\u7f6e\u4fdd\u5b58\u670d\u52a1\u672a\u52a0\u8f7d'
  );

  return normalizeSettingsResult(await saveSettings({
    monitorView: {
      selectedColumnIds: normalizeMonitorColumnIds(payload && payload.selectedColumnIds),
      activeFilter: normalizeMonitorFilter(payload && payload.activeFilter)
    }
  }));
}

export async function savePromotionMonitorConfigSettings(config, featureCenterBridge = resolveFeatureCenterBridge()) {
  const saveSettings = getBridgeMethod(
    featureCenterBridge,
    'savePromotionManagerNewMonitorSettings',
    '\u63a8\u5e7f\u76d1\u63a7\u8bbe\u7f6e\u4fdd\u5b58\u670d\u52a1\u672a\u52a0\u8f7d'
  );

  return normalizeSettingsResult(await saveSettings({
    monitorConfig: buildPromotionMonitorConfigSettingsPayload(config)
  }));
}

export async function savePromotionMonitorShopConfigSettings(
  {
    shopId,
    config,
    currentShopConfigs
  },
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const normalizedShopId = String(shopId || '').trim();
  const saveSettings = getBridgeMethod(
    featureCenterBridge,
    'savePromotionManagerNewMonitorSettings',
    '\u5e97\u94fa\u72ec\u7acb\u76d1\u63a7\u914d\u7f6e\u4fdd\u5b58\u670d\u52a1\u672a\u52a0\u8f7d'
  );
  const nextShopConfigs = {
    ...(currentShopConfigs && typeof currentShopConfigs === 'object' ? currentShopConfigs : {})
  };

  if (normalizedShopId) {
    nextShopConfigs[normalizedShopId] = buildPromotionMonitorConfigSettingsPayload(config);
  }

  return normalizeSettingsResult(await saveSettings({
    monitorShopConfigs: nextShopConfigs
  }));
}

export async function clearPromotionMonitorShopConfigSettings(
  {
    shopId,
    currentShopConfigs
  },
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const normalizedShopId = String(shopId || '').trim();
  const saveSettings = getBridgeMethod(
    featureCenterBridge,
    'savePromotionManagerNewMonitorSettings',
    '\u5e97\u94fa\u72ec\u7acb\u76d1\u63a7\u914d\u7f6e\u4fdd\u5b58\u670d\u52a1\u672a\u52a0\u8f7d'
  );
  const nextShopConfigs = {
    ...(currentShopConfigs && typeof currentShopConfigs === 'object' ? currentShopConfigs : {})
  };

  if (normalizedShopId) {
    delete nextShopConfigs[normalizedShopId];
  }

  return normalizeSettingsResult(await saveSettings({
    monitorShopConfigs: nextShopConfigs
  }));
}

export async function setPromotionMonitorShopEnabled(payload, featureCenterBridge = resolveFeatureCenterBridge()) {
  const setEnabled = getBridgeMethod(
    featureCenterBridge,
    'setPromotionMonitorShopEnabled',
    '\u5e97\u94fa\u76d1\u63a7\u72b6\u6001\u66f4\u65b0\u670d\u52a1\u672a\u52a0\u8f7d'
  );

  return readSnapshotFromResult(await setEnabled({
    shopId: String(payload && payload.shopId || '').trim(),
    enabled: payload && payload.enabled === true
  }));
}

export async function setPromotionMonitorBatchActive(enabled, featureCenterBridge = resolveFeatureCenterBridge()) {
  const setBatchActive = getBridgeMethod(
    featureCenterBridge,
    'setPromotionMonitorBatchActive',
    '\u6279\u91cf\u76d1\u63a7\u72b6\u6001\u66f4\u65b0\u670d\u52a1\u672a\u52a0\u8f7d'
  );

  return readSnapshotFromResult(await setBatchActive({ enabled: enabled === true }));
}

export async function loadPromotionMonitorRuntimeLogs(
  payload,
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const getRuntimeLogs = getBridgeMethod(
    featureCenterBridge,
    'getPromotionMonitorRuntimeLogs',
    '\u63a8\u5e7f\u76d1\u63a7\u8fd0\u884c\u65e5\u5fd7\u670d\u52a1\u672a\u52a0\u8f7d'
  );
  const result = await getRuntimeLogs({
    limit: Math.max(1, Math.min(500, Number.parseInt(payload && payload.limit, 10) || 180))
  });

  return normalizeRuntimeLogsResult(result);
}

export async function clearPromotionMonitorRuntimeLogs(
  featureCenterBridge = resolveFeatureCenterBridge()
) {
  const clearRuntimeLogs = getBridgeMethod(
    featureCenterBridge,
    'clearPromotionMonitorRuntimeLogs',
    '\u63a8\u5e7f\u76d1\u63a7\u8fd0\u884c\u65e5\u5fd7\u6e05\u7a7a\u670d\u52a1\u672a\u52a0\u8f7d'
  );

  return normalizeRuntimeLogsResult(await clearRuntimeLogs());
}

function normalizeRuntimeLogsResult(result) {
  const source = result && typeof result === 'object' ? result : {};

  return {
    updatedAt: String(source.updatedAt || '').trim(),
    totalCount: Math.max(0, Number(source.totalCount) || 0),
    entries: Array.isArray(source.entries) ? source.entries : []
  };
}

function readSnapshotFromResult(result) {
  return result && typeof result === 'object'
    ? {
      ...createDefaultPromotionMonitorSnapshot(),
      ...result,
      shops: result.shops && typeof result.shops === 'object' ? result.shops : {}
    }
    : createDefaultPromotionMonitorSnapshot();
}
