const { normalizeText } = require('../shopManagement/common');

const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
const MIN_MONITOR_INTERVAL_SECONDS = 5;
const DEFAULT_MONITOR_INTERVAL_MS = DEFAULT_MONITOR_INTERVAL_SECONDS * 1000;

const REGION_ENTRIES = Object.freeze([
  { id: 'us', label: '\u7f8e\u533a', source: 1 },
  { id: 'global', label: '\u5168\u7403', source: 2 },
  { id: 'eu', label: '\u6b27\u533a', source: 3 }
]);

const REGION_IDS_IN_SWITCH_ORDER = Object.freeze([
  'global',
  'eu',
  'us'
]);

const MONITOR_ACTION_TYPES = Object.freeze([
  'pause_plan',
  'pause_then_resume',
  'pause_then_modify',
  'pause_then_modify_resume',
  'delete_plan',
  'update_roas',
  'increase_roas'
]);

const PAUSE_SEQUENCE_ACTION_TYPES = new Set([
  'pause_then_resume',
  'pause_then_modify',
  'pause_then_modify_resume'
]);

const RESUME_SEQUENCE_ACTION_TYPES = new Set([
  'pause_then_resume',
  'pause_then_modify_resume'
]);

const TARGET_ROAS_ACTION_TYPES = new Set([
  'update_roas',
  'increase_roas',
  'pause_then_modify',
  'pause_then_modify_resume'
]);

const MONITOR_EXECUTION_ACTION_TYPES = Object.freeze([
  ...MONITOR_ACTION_TYPES,
  'resume_plan'
]);

const MONITOR_OPERATION_REASON_TYPES = Object.freeze([
  'primary_action',
  'auto_pause_spend',
  'auto_pause_roas',
  'pause_then_resume_pause',
  'pause_then_resume_resume'
]);

function uniq(values) {
  return Array.from(new Set(values));
}

function hasOwnField(container, fieldName) {
  return Boolean(
    container
    && typeof container === 'object'
    && Object.prototype.hasOwnProperty.call(container, fieldName)
  );
}

function normalizeEnabledShopIds(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return uniq(values.map((value) => normalizeText(value)).filter(Boolean));
}

function normalizeIntegerValue(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function normalizeMinOrderCountValue(value) {
  if (value === '' || value === null || value === undefined) {
    return 1;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return parsedValue;
}

function normalizeMonitorIntervalSecondsValue(value) {
  if (value === '' || value === null || value === undefined) {
    return DEFAULT_MONITOR_INTERVAL_SECONDS;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_MONITOR_INTERVAL_SECONDS;
  }

  if (parsedValue < MIN_MONITOR_INTERVAL_SECONDS) {
    return MIN_MONITOR_INTERVAL_SECONDS;
  }

  return parsedValue;
}

function normalizeResumeIntervalMinutesValue(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return null;
  }

  return parsedValue;
}

function normalizeDecimalValue(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function normalizeNullableBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  return null;
}

function getRegionEntriesInSwitchOrder() {
  return REGION_IDS_IN_SWITCH_ORDER
    .map((regionId) => REGION_ENTRIES.find((region) => region.id === regionId))
    .filter(Boolean);
}

function resolveRequestedRegionEntries(regionIds, options = {}) {
  const useSwitchOrder = options && options.useSwitchOrder === true;
  const baseRegionEntries = useSwitchOrder ? getRegionEntriesInSwitchOrder() : REGION_ENTRIES.slice();

  if (!Array.isArray(regionIds)) {
    return baseRegionEntries;
  }

  const selectedRegionIds = new Set(
    regionIds
      .map((regionId) => normalizeText(regionId))
      .filter((regionId) => REGION_ENTRIES.some((region) => region.id === regionId))
  );

  return baseRegionEntries.filter((region) => selectedRegionIds.has(region.id));
}

function buildDefaultMonitorConfig() {
  return {
    monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
    dailyOperationLimit: null,
    totalOperationLimit: null,
    autoPauseSpendThreshold: null,
    autoPauseRoasThreshold: null,
    conditionMaxRoas: null,
    minOrderCount: 1,
    regionIds: REGION_ENTRIES.map((region) => region.id),
    actionType: 'pause_plan',
    resumeIntervalMinutes: null,
    targetRoas: null
  };
}

function normalizeMonitorConfig(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    monitorIntervalSeconds: normalizeMonitorIntervalSecondsValue(source.monitorIntervalSeconds),
    dailyOperationLimit: normalizeIntegerValue(source.dailyOperationLimit),
    totalOperationLimit: normalizeIntegerValue(source.totalOperationLimit),
    autoPauseSpendThreshold: normalizeDecimalValue(source.autoPauseSpendThreshold),
    autoPauseRoasThreshold: normalizeDecimalValue(source.autoPauseRoasThreshold),
    conditionMaxRoas: normalizeDecimalValue(source.conditionMaxRoas),
    minOrderCount: normalizeMinOrderCountValue(source.minOrderCount),
    regionIds: uniq(
      (Array.isArray(source.regionIds) ? source.regionIds : REGION_ENTRIES.map((region) => region.id))
        .map((value) => normalizeText(value))
        .filter((value) => REGION_ENTRIES.some((region) => region.id === value))
    ),
    actionType: MONITOR_ACTION_TYPES.includes(normalizeText(source.actionType))
      ? normalizeText(source.actionType)
      : 'pause_plan',
    resumeIntervalMinutes: normalizeResumeIntervalMinutesValue(source.resumeIntervalMinutes),
    targetRoas: normalizeDecimalValue(source.targetRoas)
  };
}

function normalizeMonitorConfigPatch(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const normalizedPatch = {};

  if (hasOwnField(source, 'monitorIntervalSeconds')) {
    normalizedPatch.monitorIntervalSeconds = normalizeMonitorIntervalSecondsValue(source.monitorIntervalSeconds);
  }

  if (hasOwnField(source, 'dailyOperationLimit')) {
    normalizedPatch.dailyOperationLimit = normalizeIntegerValue(source.dailyOperationLimit);
  }

  if (hasOwnField(source, 'totalOperationLimit')) {
    normalizedPatch.totalOperationLimit = normalizeIntegerValue(source.totalOperationLimit);
  }

  if (hasOwnField(source, 'autoPauseSpendThreshold')) {
    normalizedPatch.autoPauseSpendThreshold = normalizeDecimalValue(source.autoPauseSpendThreshold);
  }

  if (hasOwnField(source, 'autoPauseRoasThreshold')) {
    normalizedPatch.autoPauseRoasThreshold = normalizeDecimalValue(source.autoPauseRoasThreshold);
  }

  if (hasOwnField(source, 'conditionMaxRoas')) {
    normalizedPatch.conditionMaxRoas = normalizeDecimalValue(source.conditionMaxRoas);
  }

  if (hasOwnField(source, 'minOrderCount')) {
    normalizedPatch.minOrderCount = normalizeMinOrderCountValue(source.minOrderCount);
  }

  if (hasOwnField(source, 'regionIds')) {
    normalizedPatch.regionIds = uniq(
      (Array.isArray(source.regionIds) ? source.regionIds : [])
        .map((value) => normalizeText(value))
        .filter((value) => REGION_ENTRIES.some((region) => region.id === value))
    );
  }

  if (hasOwnField(source, 'actionType')) {
    normalizedPatch.actionType = MONITOR_ACTION_TYPES.includes(normalizeText(source.actionType))
      ? normalizeText(source.actionType)
      : 'pause_plan';
  }

  if (hasOwnField(source, 'resumeIntervalMinutes')) {
    normalizedPatch.resumeIntervalMinutes = normalizeResumeIntervalMinutesValue(source.resumeIntervalMinutes);
  }

  if (hasOwnField(source, 'targetRoas')) {
    normalizedPatch.targetRoas = normalizeDecimalValue(source.targetRoas);
  }

  return normalizedPatch;
}

function mergeMonitorConfig(baseConfig, overrideConfig) {
  const normalizedBaseConfig = normalizeMonitorConfig(baseConfig);
  const normalizedOverrideConfig = normalizeMonitorConfigPatch(overrideConfig);

  return {
    monitorIntervalSeconds: hasOwnField(normalizedOverrideConfig, 'monitorIntervalSeconds')
      ? normalizedOverrideConfig.monitorIntervalSeconds
      : normalizedBaseConfig.monitorIntervalSeconds,
    dailyOperationLimit: hasOwnField(normalizedOverrideConfig, 'dailyOperationLimit')
      ? normalizedOverrideConfig.dailyOperationLimit
      : normalizedBaseConfig.dailyOperationLimit,
    totalOperationLimit: hasOwnField(normalizedOverrideConfig, 'totalOperationLimit')
      ? normalizedOverrideConfig.totalOperationLimit
      : normalizedBaseConfig.totalOperationLimit,
    autoPauseSpendThreshold: hasOwnField(normalizedOverrideConfig, 'autoPauseSpendThreshold')
      ? normalizedOverrideConfig.autoPauseSpendThreshold
      : normalizedBaseConfig.autoPauseSpendThreshold,
    autoPauseRoasThreshold: hasOwnField(normalizedOverrideConfig, 'autoPauseRoasThreshold')
      ? normalizedOverrideConfig.autoPauseRoasThreshold
      : normalizedBaseConfig.autoPauseRoasThreshold,
    conditionMaxRoas: hasOwnField(normalizedOverrideConfig, 'conditionMaxRoas')
      ? normalizedOverrideConfig.conditionMaxRoas
      : normalizedBaseConfig.conditionMaxRoas,
    minOrderCount: hasOwnField(normalizedOverrideConfig, 'minOrderCount')
      ? normalizedOverrideConfig.minOrderCount
      : normalizedBaseConfig.minOrderCount,
    regionIds: hasOwnField(normalizedOverrideConfig, 'regionIds')
      ? normalizedOverrideConfig.regionIds
      : normalizedBaseConfig.regionIds,
    actionType: hasOwnField(normalizedOverrideConfig, 'actionType')
      ? normalizedOverrideConfig.actionType
      : normalizedBaseConfig.actionType,
    resumeIntervalMinutes: hasOwnField(normalizedOverrideConfig, 'resumeIntervalMinutes')
      ? normalizedOverrideConfig.resumeIntervalMinutes
      : normalizedBaseConfig.resumeIntervalMinutes,
    targetRoas: hasOwnField(normalizedOverrideConfig, 'targetRoas')
      ? normalizedOverrideConfig.targetRoas
      : normalizedBaseConfig.targetRoas
  };
}

function normalizeMonitorShopConfigs(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload)
      .map(([shopId, shopConfig]) => {
        const normalizedShopId = normalizeText(shopId);

        if (!normalizedShopId) {
          return null;
        }

        return [normalizedShopId, normalizeMonitorConfigPatch(shopConfig)];
      })
      .filter(Boolean)
  );
}

function buildDefaultMonitorConfigBundle() {
  return {
    globalConfig: buildDefaultMonitorConfig(),
    shopConfigs: {}
  };
}

function normalizeMonitorConfigBundle(settingsPayload) {
  const source = settingsPayload && typeof settingsPayload === 'object' ? settingsPayload : {};

  return {
    globalConfig: normalizeMonitorConfig(source.monitorConfig),
    shopConfigs: normalizeMonitorShopConfigs(source.monitorShopConfigs)
  };
}

function resolveShopMonitorConfig(shopId, monitorConfigBundle) {
  const normalizedShopId = normalizeText(shopId);
  const bundle = monitorConfigBundle && typeof monitorConfigBundle === 'object'
    ? monitorConfigBundle
    : buildDefaultMonitorConfigBundle();

  if (
    normalizedShopId
    && bundle.shopConfigs
    && Object.prototype.hasOwnProperty.call(bundle.shopConfigs, normalizedShopId)
  ) {
    return mergeMonitorConfig(bundle.globalConfig, bundle.shopConfigs[normalizedShopId]);
  }

  return normalizeMonitorConfig(bundle.globalConfig);
}

module.exports = {
  DEFAULT_MONITOR_INTERVAL_SECONDS,
  MIN_MONITOR_INTERVAL_SECONDS,
  DEFAULT_MONITOR_INTERVAL_MS,
  REGION_ENTRIES,
  REGION_IDS_IN_SWITCH_ORDER,
  MONITOR_ACTION_TYPES,
  PAUSE_SEQUENCE_ACTION_TYPES,
  RESUME_SEQUENCE_ACTION_TYPES,
  TARGET_ROAS_ACTION_TYPES,
  MONITOR_EXECUTION_ACTION_TYPES,
  MONITOR_OPERATION_REASON_TYPES,
  hasOwnField,
  normalizeEnabledShopIds,
  normalizeMonitorConfig,
  normalizeMonitorConfigPatch,
  mergeMonitorConfig,
  normalizeMonitorShopConfigs,
  buildDefaultMonitorConfig,
  buildDefaultMonitorConfigBundle,
  normalizeMonitorConfigBundle,
  resolveShopMonitorConfig,
  normalizeResumeIntervalMinutesValue,
  normalizeNullableBoolean,
  getRegionEntriesInSwitchOrder,
  resolveRequestedRegionEntries
};
