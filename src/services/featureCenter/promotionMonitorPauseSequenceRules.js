const { normalizeText } = require('../shopManagement/common');
const {
  PAUSE_SEQUENCE_ACTION_TYPES,
  RESUME_SEQUENCE_ACTION_TYPES,
  normalizeMonitorConfig,
  normalizeResumeIntervalMinutesValue
} = require('./promotionMonitorConfigModel');
const { normalizeRoasRawValue } = require('./promotionMonitorMetricUtils');
const {
  normalizeOperationStat,
  normalizeOperationStats,
  parseIsoTimestamp,
  resolveNextLocalDayStartTimestamp
} = require('./promotionMonitorStateModel');

const PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES = 999;

function resolveStoredPausedState(stat) {
  const normalizedStat = normalizeOperationStat(stat);

  if (normalizedStat.knownPausedState === true) {
    return true;
  }

  if (normalizedStat.knownPausedState === false) {
    return false;
  }

  return normalizeText(normalizedStat.pausedAt) ? true : null;
}

function resolveEffectivePausedState(item, stat) {
  if (item && typeof item.isPaused === 'boolean') {
    return item.isPaused;
  }

  return resolveStoredPausedState(stat);
}

function resolveResumeIntervalMs(monitorConfig) {
  const config = normalizeMonitorConfig(monitorConfig);

  if (config.resumeIntervalMinutes === null) {
    return null;
  }

  return Math.max(1, Number(config.resumeIntervalMinutes) || 0) * 60 * 1000;
}

function resolvePauseThenResumeDueAtFromPausedAt(pausedAtTimestamp, resumeIntervalMinutes) {
  const normalizedResumeIntervalMinutes = normalizeResumeIntervalMinutesValue(resumeIntervalMinutes);

  if (normalizedResumeIntervalMinutes === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (!Number.isFinite(pausedAtTimestamp) || pausedAtTimestamp <= 0) {
    return 0;
  }

  if (normalizedResumeIntervalMinutes === PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES) {
    return resolveNextLocalDayStartTimestamp(pausedAtTimestamp);
  }

  return pausedAtTimestamp + (normalizedResumeIntervalMinutes * 60 * 1000);
}

function isPauseSequenceActionType(actionType) {
  return PAUSE_SEQUENCE_ACTION_TYPES.has(normalizeText(actionType));
}

function isResumeSequenceActionType(actionType) {
  return RESUME_SEQUENCE_ACTION_TYPES.has(normalizeText(actionType));
}

function isModifySequenceActionType(actionType) {
  return normalizeText(actionType) === 'pause_then_modify'
    || normalizeText(actionType) === 'pause_then_modify_resume';
}

function resolvePauseThenResumeExecution(stat, item, monitorConfig) {
  const effectivePausedState = resolveEffectivePausedState(item, stat);
  const config = normalizeMonitorConfig(monitorConfig);

  if (config.resumeIntervalMinutes === null) {
    return {
      executionActionType: '',
      skipReason: 'action_payload'
    };
  }

  if (effectivePausedState !== true) {
    return {
      executionActionType: 'pause_plan'
    };
  }

  const pausedAt = normalizeText(stat && stat.pausedAt);
  const pausedAtTimestamp = parseIsoTimestamp(pausedAt);

  if (!pausedAtTimestamp) {
    return {
      executionActionType: 'resume_plan'
    };
  }

  const resumeDueAt = resolvePauseThenResumeDueAtFromPausedAt(
    pausedAtTimestamp,
    config.resumeIntervalMinutes
  );

  if (Date.now() >= resumeDueAt) {
    return {
      executionActionType: 'resume_plan'
    };
  }

  return {
    executionActionType: '',
    skipReason: 'resume_waiting'
  };
}

function resolvePauseSequenceExecution(stat, item, monitorConfig) {
  const effectivePausedState = resolveEffectivePausedState(item, stat);
  const config = normalizeMonitorConfig(monitorConfig);
  const targetRoasRaw = normalizeRoasRawValue(config.targetRoas);

  if (effectivePausedState !== true) {
    return {
      executionActionType: 'pause_plan',
      shouldEvaluateConditions: true
    };
  }

  if (
    isModifySequenceActionType(config.actionType)
    && targetRoasRaw !== null
    && item
    && item.targetRoasRaw !== targetRoasRaw
  ) {
    return {
      executionActionType: 'update_roas',
      shouldEvaluateConditions: false
    };
  }

  if (!isResumeSequenceActionType(config.actionType)) {
    return {
      executionActionType: '',
      skipReason: 'action_payload'
    };
  }

  const resumeDecision = resolvePauseThenResumeExecution(stat, item, config);

  return {
    ...resumeDecision,
    shouldEvaluateConditions: false
  };
}

function resolveOperationStatRegionId(statKey, stat) {
  const keyRegionId = normalizeText(String(statKey || '').split('::')[0]);
  const statRegionId = normalizeText(stat && stat.lastRegionId);

  return statRegionId || keyRegionId;
}

function buildSelectedMonitorRegionIdSet(monitorConfig) {
  return new Set(normalizeMonitorConfig(monitorConfig).regionIds);
}

function resolvePauseThenResumeCheckDueAt(stat, monitorConfig) {
  const effectivePausedState = resolveStoredPausedState(stat);
  const config = normalizeMonitorConfig(monitorConfig);

  if (effectivePausedState !== true || config.resumeIntervalMinutes === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  const pausedAtTimestamp = parseIsoTimestamp(normalizeText(stat && stat.pausedAt));

  if (!pausedAtTimestamp) {
    return 0;
  }

  return resolvePauseThenResumeDueAtFromPausedAt(
    pausedAtTimestamp,
    config.resumeIntervalMinutes
  );
}

function resolvePauseThenResumeNextRunAt(shopState, monitorConfig) {
  const config = normalizeMonitorConfig(monitorConfig);

  if (!isResumeSequenceActionType(config.actionType)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const operationStats = normalizeOperationStats(shopState && shopState.operationStats);
  const selectedRegionIds = buildSelectedMonitorRegionIdSet(config);
  let nextDueAt = Number.MAX_SAFE_INTEGER;

  Object.entries(operationStats).forEach(([statKey, stat]) => {
    const regionId = resolveOperationStatRegionId(statKey, stat);

    if (selectedRegionIds.size > 0 && !selectedRegionIds.has(regionId)) {
      return;
    }

    const statDueAt = resolvePauseThenResumeCheckDueAt(stat, config);

    if (statDueAt < nextDueAt) {
      nextDueAt = statDueAt;
    }
  });

  return nextDueAt;
}

function getDuePauseThenResumeRegionIds(shopState, monitorConfig, now = Date.now()) {
  const config = normalizeMonitorConfig(monitorConfig);

  if (!isResumeSequenceActionType(config.actionType)) {
    return [];
  }

  const operationStats = normalizeOperationStats(shopState && shopState.operationStats);
  const selectedRegionIds = buildSelectedMonitorRegionIdSet(config);
  const regionIds = new Set();

  Object.entries(operationStats).forEach(([statKey, stat]) => {
    const regionId = resolveOperationStatRegionId(statKey, stat);

    if (!regionId || (selectedRegionIds.size > 0 && !selectedRegionIds.has(regionId))) {
      return;
    }

    const statDueAt = resolvePauseThenResumeCheckDueAt(stat, config);

    if (statDueAt > now) {
      return;
    }

    regionIds.add(regionId);
  });

  return Array.from(regionIds);
}

module.exports = {
  PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES,
  resolveStoredPausedState,
  resolveEffectivePausedState,
  resolveResumeIntervalMs,
  resolvePauseThenResumeDueAtFromPausedAt,
  isPauseSequenceActionType,
  isResumeSequenceActionType,
  isModifySequenceActionType,
  resolvePauseThenResumeExecution,
  resolvePauseSequenceExecution,
  resolveOperationStatRegionId,
  buildSelectedMonitorRegionIdSet,
  resolvePauseThenResumeCheckDueAt,
  resolvePauseThenResumeNextRunAt,
  getDuePauseThenResumeRegionIds
};
