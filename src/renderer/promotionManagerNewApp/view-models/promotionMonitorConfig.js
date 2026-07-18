const DEFAULT_REGION_IDS = Object.freeze(['us', 'eu', 'global']);
const DEFAULT_ACTION_TYPE = 'pause_plan';
const ACTION_REQUIRES_TARGET_ROAS = new Set([
  'pause_then_modify',
  'pause_then_modify_resume'
]);
const ACTION_REQUIRES_RESUME_INTERVAL = new Set([
  'pause_then_resume',
  'pause_then_modify_resume'
]);

export const MIN_MONITOR_INTERVAL_SECONDS = 5;
export const MAX_MONITOR_INTERVAL_SECONDS = 86400;
export const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
export const MIN_RESUME_INTERVAL_MINUTES = 1;
export const MAX_RESUME_INTERVAL_MINUTES = 999;
export const NEXT_DAY_RESUME_INTERVAL_MINUTES = 999;

export const MONITOR_REGION_OPTIONS = Object.freeze([
  { value: 'us', label: '\u7f8e\u56fd' },
  { value: 'eu', label: '\u6b27\u533a' },
  { value: 'global', label: '\u5168\u7403' }
]);

export const MONITOR_ACTION_OPTIONS = Object.freeze([
  { value: 'pause_plan', label: '\u6682\u505c\u8ba1\u5212' },
  { value: 'delete_plan', label: '\u5220\u9664\u8ba1\u5212' },
  { value: 'pause_then_modify', label: '\u6682\u505c\u540e\u4fee\u6539' },
  { value: 'pause_then_resume', label: '\u6682\u505c\u540e\u6062\u590d' },
  { value: 'pause_then_modify_resume', label: '\u6682\u505c\u540e\u4fee\u6539\u6062\u590d' }
]);

const VALID_REGION_IDS = new Set(MONITOR_REGION_OPTIONS.map((option) => option.value));
const VALID_ACTION_TYPES = new Set(MONITOR_ACTION_OPTIONS.map((option) => option.value));

function hasOwnField(source, field) {
  return Object.prototype.hasOwnProperty.call(source, field);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeOptionalNumber(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  const min = Number.isFinite(options.min) ? Number(options.min) : 0;
  const max = Number.isFinite(options.max) ? Number(options.max) : null;
  const precision = Math.max(0, Number(options.precision) || 0);
  const roundedValue = Number(numberValue.toFixed(precision));
  const minLimitedValue = Math.max(min, roundedValue);

  return max === null ? minLimitedValue : Math.min(max, minLimitedValue);
}

function normalizeRequiredInteger(value, defaultValue, options = {}) {
  const min = Number.isFinite(options.min) ? Number(options.min) : 0;
  const max = Number.isFinite(options.max) ? Number(options.max) : null;
  const numberValue = Number(value);
  const integerValue = Number.isFinite(numberValue)
    ? Math.floor(numberValue)
    : Math.floor(Number(defaultValue) || min);
  const minLimitedValue = Math.max(min, integerValue);

  return max === null ? minLimitedValue : Math.min(max, minLimitedValue);
}

function normalizeOptionalInteger(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const min = Number.isFinite(options.min) ? Number(options.min) : 0;
  const max = Number.isFinite(options.max) ? Number(options.max) : null;
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  const minLimitedValue = Math.max(min, parsedValue);

  return max === null ? minLimitedValue : Math.min(max, minLimitedValue);
}

export function normalizeMonitorRegionIds(value, options = {}) {
  if (!Array.isArray(value)) {
    return options.useDefault === false ? [] : [...DEFAULT_REGION_IDS];
  }

  return Array.from(new Set(
    value
      .map((entry) => normalizeText(entry))
      .filter((entry) => VALID_REGION_IDS.has(entry))
  ));
}

export function normalizeMonitorActionType(value) {
  const normalizedValue = normalizeText(value);

  return VALID_ACTION_TYPES.has(normalizedValue) ? normalizedValue : DEFAULT_ACTION_TYPE;
}

export function doesMonitorActionRequireTargetRoas(value) {
  return ACTION_REQUIRES_TARGET_ROAS.has(normalizeMonitorActionType(value));
}

export function doesMonitorActionRequireResumeInterval(value) {
  return ACTION_REQUIRES_RESUME_INTERVAL.has(normalizeMonitorActionType(value));
}

export function createDefaultPromotionMonitorConfig() {
  return {
    monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
    regionIds: [...DEFAULT_REGION_IDS],
    autoPauseSpendThreshold: null,
    autoPauseRoasThreshold: null,
    conditionMaxRoas: null,
    minOrderCount: 1,
    actionType: DEFAULT_ACTION_TYPE,
    resumeIntervalMinutes: null,
    targetRoas: null
  };
}

export function normalizePromotionMonitorConfig(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const defaultConfig = createDefaultPromotionMonitorConfig();

  return {
    monitorIntervalSeconds: normalizeRequiredInteger(
      source.monitorIntervalSeconds,
      defaultConfig.monitorIntervalSeconds,
      {
        min: MIN_MONITOR_INTERVAL_SECONDS,
        max: MAX_MONITOR_INTERVAL_SECONDS
      }
    ),
    regionIds: hasOwnField(source, 'regionIds')
      ? normalizeMonitorRegionIds(source.regionIds, { useDefault: false })
      : defaultConfig.regionIds,
    autoPauseSpendThreshold: normalizeOptionalNumber(source.autoPauseSpendThreshold, {
      min: 0,
      precision: 2
    }),
    autoPauseRoasThreshold: normalizeOptionalNumber(source.autoPauseRoasThreshold, {
      min: 0,
      precision: 2
    }),
    conditionMaxRoas: normalizeOptionalNumber(source.conditionMaxRoas, {
      min: 0,
      precision: 2
    }),
    minOrderCount: normalizeRequiredInteger(source.minOrderCount, defaultConfig.minOrderCount, {
      min: 0
    }),
    actionType: normalizeMonitorActionType(source.actionType),
    resumeIntervalMinutes: normalizeOptionalInteger(source.resumeIntervalMinutes, {
      min: MIN_RESUME_INTERVAL_MINUTES,
      max: MAX_RESUME_INTERVAL_MINUTES
    }),
    targetRoas: normalizeOptionalNumber(source.targetRoas, {
      min: 0,
      precision: 2
    })
  };
}

export function patchPromotionMonitorConfig(baseConfig, patch) {
  return normalizePromotionMonitorConfig({
    ...createDefaultPromotionMonitorConfig(),
    ...(baseConfig && typeof baseConfig === 'object' ? baseConfig : {}),
    ...(patch && typeof patch === 'object' ? patch : {})
  });
}

export function buildPromotionMonitorConfigSettingsPayload(config) {
  const normalizedConfig = normalizePromotionMonitorConfig(config);
  const payload = {
    monitorIntervalSeconds: normalizedConfig.monitorIntervalSeconds,
    regionIds: normalizedConfig.regionIds.slice(),
    autoPauseSpendThreshold: normalizedConfig.autoPauseSpendThreshold,
    autoPauseRoasThreshold: normalizedConfig.autoPauseRoasThreshold,
    conditionMaxRoas: normalizedConfig.conditionMaxRoas,
    minOrderCount: normalizedConfig.minOrderCount,
    actionType: normalizedConfig.actionType,
    resumeIntervalMinutes: normalizedConfig.resumeIntervalMinutes,
    targetRoas: normalizedConfig.targetRoas
  };

  return payload;
}
