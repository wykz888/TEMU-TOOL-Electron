import { PSD_PROGRESS_PHASE_LABELS } from '../constants.js';

const FAILED_PHASES = Object.freeze(['item-failed', 'mockup-failed']);
const COMPLETE_PHASE = 'complete';
const NOISY_LOG_PHASES = Object.freeze(new Set([
  'cleanup',
  'export',
  'post-process',
  'post-process-drain',
  'post-process-wait',
  'replace',
  'slice',
  'smart-open',
  'write-output'
]));

function toNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function buildProgressSummary(current, total) {
  return `\u603B\u8FDB\u5EA6 ${current}/${total}`;
}

export function getPsdProgressPhaseLabel(progress) {
  const phase = progress && progress.phase;
  return PSD_PROGRESS_PHASE_LABELS[phase] || phase || '\u672A\u77E5\u9636\u6BB5';
}

export function buildPsdProgressLogMessage(progress, phaseLabel) {
  const source = progress && typeof progress === 'object' ? progress : {};
  const label = phaseLabel || getPsdProgressPhaseLabel(source);
  let message = `[${label}]`;

  if (source.mockupIndex != null) {
    message += ` \u6837\u673A${source.mockupIndex}`;
  }

  if (source.itemIndex != null && source.totalItems != null) {
    message += ` \u7D20\u6750${source.itemIndex + 1}/${source.totalItems}`;
  }

  if (source.sourceIndex != null && source.sourceCount != null) {
    message += ` \u7D20\u6750${source.sourceIndex}/${source.sourceCount}`;
  }

  if (source.smartObjectName) {
    message += ` (${source.smartObjectName})`;
  }

  if (source.message) {
    message += ` ${source.message}`;
  }

  return message;
}

export function getPsdProgressTone(progress) {
  const phase = progress && progress.phase;

  if (FAILED_PHASES.includes(phase)) {
    return 'error';
  }

  return phase === COMPLETE_PHASE ? 'success' : '';
}

export function shouldLogPsdProgress(progress) {
  const phase = progress && progress.phase;

  return !NOISY_LOG_PHASES.has(phase);
}

export function resolvePsdProgressState(progress) {
  if (!progress || typeof progress !== 'object') {
    return null;
  }

  const phaseLabel = getPsdProgressPhaseLabel(progress);
  const state = {
    complete: progress.phase === COMPLETE_PHASE,
    current: null,
    message: buildPsdProgressLogMessage(progress, phaseLabel),
    phaseLabel,
    shouldLog: shouldLogPsdProgress(progress),
    summary: '',
    tone: getPsdProgressTone(progress),
    total: null
  };
  const sourceTotal = toNumber(progress.sourceCount || progress.totalInputCount || 0);

  if (sourceTotal > 0 && progress.totalItems == null) {
    const generatedCount = toNumber(progress.generatedCount);
    const skippedCount = toNumber(progress.skippedCount);
    const failedCount = toNumber(progress.failedCount);
    const nextCurrent = progress.sourceIndex != null
      ? toNumber(progress.sourceIndex)
      : generatedCount + skippedCount + failedCount;

    state.total = sourceTotal;
    state.current = clamp(nextCurrent, 0, sourceTotal);
    state.summary = buildProgressSummary(state.current, state.total);
  }

  if (progress.totalItems != null) {
    const totalItems = toNumber(progress.totalItems);
    const itemCurrent = progress.itemIndex != null ? toNumber(progress.itemIndex) + 1 : 0;

    state.total = totalItems;
    state.current = clamp(itemCurrent, 0, totalItems);
    state.summary = buildProgressSummary(state.current, state.total);
  }

  if (state.complete && progress.summary) {
    state.summary = String(progress.summary);
  }

  return state;
}
