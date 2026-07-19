import {
  BUDGET_MODE_CUSTOM,
  FAST_START_MODE_ON,
  ROAS_MODE_CUSTOM,
  ROAS_MODE_ESTIMATED_CHARGE,
  ROAS_MODE_ESTIMATED_RATIO,
  buildGoodsRowDraft,
  getGoodsRowKey
} from './createPromotionGoodsRows.js';
import {
  resolveRoasFromEstimatedCharge,
  resolveRoasFromEstimatedChargeRatio
} from './createPromotionRoasEstimates.js';

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

export function buildBatchDraftPatchForRow(row, settings = {}) {
  const patch = {
    budgetMode: settings.budgetMode,
    fastStartEnabled: settings.fastStartMode === FAST_START_MODE_ON
  };
  const customBudget = normalizeOptionalNumber(settings.customBudget);
  const customRoas = normalizeOptionalNumber(settings.customRoas);
  const estimatedCharge = normalizeOptionalNumber(settings.estimatedCharge);
  const estimatedRatio = normalizeOptionalNumber(settings.estimatedRatio);

  if (settings.budgetMode === BUDGET_MODE_CUSTOM && customBudget !== null) {
    patch.customBudget = customBudget;
  }

  if (settings.roasMode === ROAS_MODE_ESTIMATED_CHARGE && estimatedCharge !== null) {
    const resolvedRoas = resolveRoasFromEstimatedCharge(row, estimatedCharge);

    if (resolvedRoas !== null) {
      patch.roasMode = ROAS_MODE_CUSTOM;
      patch.customRoas = resolvedRoas;
    }
  } else if (settings.roasMode === ROAS_MODE_ESTIMATED_RATIO && estimatedRatio !== null) {
    const resolvedRoas = resolveRoasFromEstimatedChargeRatio(row, estimatedRatio);

    if (resolvedRoas !== null) {
      patch.roasMode = ROAS_MODE_CUSTOM;
      patch.customRoas = resolvedRoas;
    }
  } else {
    patch.roasMode = settings.roasMode;

    if (settings.roasMode === ROAS_MODE_CUSTOM && customRoas !== null) {
      patch.customRoas = customRoas;
    }
  }

  return patch;
}

export function applyBatchDraftSettingsToRows(currentDraftMap, rows, settings) {
  const nextDraftMap = {
    ...(currentDraftMap && typeof currentDraftMap === 'object' ? currentDraftMap : {})
  };

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowKey = getGoodsRowKey(row);

    if (!rowKey) {
      return;
    }

    nextDraftMap[rowKey] = {
      ...(nextDraftMap[rowKey] || buildGoodsRowDraft(row)),
      ...buildBatchDraftPatchForRow(row, settings)
    };
  });

  return nextDraftMap;
}
