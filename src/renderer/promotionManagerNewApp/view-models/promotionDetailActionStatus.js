import {
  DETAIL_ACTION_DELETE,
  DETAIL_ACTION_INCREASE_ROAS,
  DETAIL_ACTION_OPTIONS,
  DETAIL_ACTION_PAUSE,
  DETAIL_ACTION_RESUME,
  DETAIL_ACTION_UPDATE_ROAS,
  DETAIL_ROAS_MODE_CUSTOM,
  DETAIL_ACTION_ROAS_MODE_OPTIONS,
  getPromotionDetailRowKey,
  normalizeText
} from './promotionDetailRows.js';

export const DETAIL_ACTION_STATUS_PENDING = 'pending';
export const DETAIL_ACTION_STATUS_CONFIGURED = 'configured';
export const DETAIL_ACTION_STATUS_RUNNING = 'running';
export const DETAIL_ACTION_STATUS_SUCCESS = 'success';
export const DETAIL_ACTION_STATUS_FAILED = 'failed';
export const DETAIL_ACTION_STATUS_SKIPPED = 'skipped';
export const DETAIL_ACTION_STATUS_CANCELED = 'canceled';
export const DETAIL_ACTION_STATUS_WARNING = 'warning';

const DETAIL_ACTION_STATUS_PREVIEW_KIND = 'preview';

export const DETAIL_ACTION_STATUS_LABELS = Object.freeze({
  [DETAIL_ACTION_STATUS_PENDING]: '\u5f85\u5904\u7406',
  [DETAIL_ACTION_STATUS_CONFIGURED]: '\u5df2\u8bbe\u7f6e',
  [DETAIL_ACTION_STATUS_RUNNING]: '\u6267\u884c\u4e2d',
  [DETAIL_ACTION_STATUS_SUCCESS]: '\u64cd\u4f5c\u6210\u529f',
  [DETAIL_ACTION_STATUS_FAILED]: '\u64cd\u4f5c\u5931\u8d25',
  [DETAIL_ACTION_STATUS_SKIPPED]: '\u5df2\u8df3\u8fc7',
  [DETAIL_ACTION_STATUS_CANCELED]: '\u5df2\u505c\u6b62',
  [DETAIL_ACTION_STATUS_WARNING]: '\u9700\u786e\u8ba4'
});

function normalizeStatus(value) {
  const status = normalizeText(value);

  return Object.prototype.hasOwnProperty.call(DETAIL_ACTION_STATUS_LABELS, status)
    ? status
    : DETAIL_ACTION_STATUS_PENDING;
}

function getRowResultKey(result) {
  return normalizeText(result && result.rowKey) || [
    normalizeText(result && result.shopId),
    normalizeText(result && result.regionId),
    normalizeText(result && result.adId),
    normalizeText(result && result.goodsId)
  ].filter(Boolean).join(':');
}

export function getDetailActionStatusRecord(statusMap, row) {
  const rowKey = getPromotionDetailRowKey(row);
  const record = statusMap && rowKey ? statusMap[rowKey] : null;
  const rowStatus = normalizeStatus(record && record.status);
  const fallbackStatus = normalizeStatus(row && row.actionStatusValue);
  const status = record ? rowStatus : fallbackStatus;

  return {
    status,
    label: record
      ? DETAIL_ACTION_STATUS_LABELS[status]
      : (normalizeText(row && row.actionStatusLabel) || DETAIL_ACTION_STATUS_LABELS[status]),
    message: record
      ? normalizeText(record && record.message)
      : normalizeText(row && row.actionMessage),
    updatedAt: normalizeText(record && record.updatedAt)
  };
}

export function patchDetailActionStatusForRows(statusMap, rows, status, message = '') {
  const nextStatusMap = {
    ...(statusMap && typeof statusMap === 'object' ? statusMap : {})
  };
  const normalizedStatus = normalizeStatus(status);
  const updatedAt = new Date().toISOString();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowKey = normalizeText(row && row.rowKey) || getPromotionDetailRowKey(row);

    if (!rowKey) {
      return;
    }

    nextStatusMap[rowKey] = {
      status: normalizedStatus,
      message: normalizeText(message),
      updatedAt,
      kind: ''
    };
  });

  return nextStatusMap;
}

export function applyDetailActionResultToStatusMap(statusMap, result) {
  const nextStatusMap = {
    ...(statusMap && typeof statusMap === 'object' ? statusMap : {})
  };
  const updatedAt = new Date().toISOString();
  const rowResults = Array.isArray(result && result.rowResults)
    ? result.rowResults
    : [];

  rowResults.forEach((rowResult) => {
    const rowKey = getRowResultKey(rowResult);

    if (!rowKey) {
      return;
    }

    nextStatusMap[rowKey] = {
      status: normalizeStatus(rowResult && rowResult.status),
      message: normalizeText(rowResult && rowResult.message),
      updatedAt,
      kind: ''
    };
  });

  return nextStatusMap;
}

function findOptionLabel(options, value) {
  const normalizedValue = normalizeText(value);
  const matchedOption = (Array.isArray(options) ? options : [])
    .find((option) => option && option.value === normalizedValue);

  return normalizeText(matchedOption && matchedOption.label);
}

function formatDisplayNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return '';
  }

  return numberValue
    .toFixed(2)
    .replace(/\.?0+$/, '');
}

function formatRoasRawValue(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return '';
  }

  return formatDisplayNumber(numberValue >= 1000 ? numberValue / 10000 : numberValue);
}

function resolveActionLabel(actionType) {
  return findOptionLabel(DETAIL_ACTION_OPTIONS, actionType) || '\u63a8\u5e7f\u64cd\u4f5c';
}

function resolveRoasModeLabel(roasMode) {
  return findOptionLabel(DETAIL_ACTION_ROAS_MODE_OPTIONS, roasMode) || '\u7ade\u4e89\u529b\u6863\u4f4d';
}

function buildInvalidRowMessage(row, actionType) {
  const messages = [];

  if (!normalizeText(row && row.goodsId)) {
    messages.push('\u5546\u54c1ID\u7f3a\u5931');
  }

  if (
    (actionType === DETAIL_ACTION_UPDATE_ROAS || actionType === DETAIL_ACTION_INCREASE_ROAS)
    && !normalizeText(row && row.adId)
  ) {
    messages.push('\u8ba1\u5212ID\u7f3a\u5931');
  }

  if (actionType === DETAIL_ACTION_INCREASE_ROAS && !(Number(row && row.targetRoasRaw) > 0)) {
    messages.push('\u5f53\u524d\u76ee\u6807ROAS\u7f3a\u5931');
  }

  return messages.length > 0 ? `${messages.join('\uff1b')}\uff0c\u6267\u884c\u4f1a\u8df3\u8fc7` : '';
}

function buildUpdateRoasPreviewMessage(row, payload) {
  const roasMode = normalizeText(row && row.roasMode) || normalizeText(payload && payload.roasMode);
  const modeLabel = resolveRoasModeLabel(roasMode);
  const targetRoasText = formatRoasRawValue(row && row.actionTargetRoasRaw);
  const currentRoasText = formatRoasRawValue(row && row.targetRoasRaw);

  if (!targetRoasText) {
    return roasMode === DETAIL_ROAS_MODE_CUSTOM
      ? '\u8bf7\u5148\u8f93\u5165\u76ee\u6807ROAS\uff0c\u6267\u884c\u4f1a\u8df3\u8fc7'
      : `\u5c06\u63d0\u4ea4\uff1a\u4fee\u6539ROAS ${modeLabel}\uff0c\u6267\u884c\u65f6\u67e5\u8be2\u9884\u4f30ROAS`;
  }

  return [
    `\u5c06\u63d0\u4ea4\uff1a\u4fee\u6539ROAS ${modeLabel} ${targetRoasText}`,
    currentRoasText ? `\u5f53\u524d ${currentRoasText}` : ''
  ].filter(Boolean).join('\uff0c');
}

function buildIncreaseRoasPreviewMessage(row, payload) {
  const targetRoasText = formatDisplayNumber(payload && payload.targetRoas);
  const currentRoasText = formatRoasRawValue(row && row.targetRoasRaw);

  if (!targetRoasText) {
    return '\u8bf7\u5148\u8f93\u5165\u76ee\u6807ROAS\uff0c\u6267\u884c\u4f1a\u8df3\u8fc7';
  }

  return [
    `\u5c06\u63d0\u4ea4\uff1a\u589e\u52a0ROAS +${targetRoasText}`,
    currentRoasText ? `\u5f53\u524d ${currentRoasText}` : ''
  ].filter(Boolean).join('\uff0c');
}

function buildPreparedActionPreview(row, payload = {}) {
  const actionType = normalizeText(row && row.actionType) || normalizeText(payload.actionType);
  const invalidMessage = buildInvalidRowMessage(row, actionType);

  if (invalidMessage) {
    return {
      status: DETAIL_ACTION_STATUS_WARNING,
      message: invalidMessage
    };
  }

  if (actionType === DETAIL_ACTION_UPDATE_ROAS) {
    const message = buildUpdateRoasPreviewMessage(row, payload);

    return {
      status: message.includes('\u6267\u884c\u4f1a\u8df3\u8fc7')
        ? DETAIL_ACTION_STATUS_WARNING
        : DETAIL_ACTION_STATUS_CONFIGURED,
      message
    };
  }

  if (actionType === DETAIL_ACTION_INCREASE_ROAS) {
    const message = buildIncreaseRoasPreviewMessage(row, payload);

    return {
      status: message.includes('\u6267\u884c\u4f1a\u8df3\u8fc7')
        ? DETAIL_ACTION_STATUS_WARNING
        : DETAIL_ACTION_STATUS_CONFIGURED,
      message
    };
  }

  if (
    actionType === DETAIL_ACTION_PAUSE
    || actionType === DETAIL_ACTION_RESUME
    || actionType === DETAIL_ACTION_DELETE
  ) {
    return {
      status: DETAIL_ACTION_STATUS_CONFIGURED,
      message: `\u5c06\u63d0\u4ea4\uff1a${resolveActionLabel(actionType)}`
    };
  }

  return {
    status: DETAIL_ACTION_STATUS_WARNING,
    message: '\u64cd\u4f5c\u7c7b\u578b\u65e0\u6548\uff0c\u6267\u884c\u4f1a\u8df3\u8fc7'
  };
}

export function clearPreviewDetailActionStatuses(statusMap) {
  return Object.entries(statusMap && typeof statusMap === 'object' ? statusMap : {})
    .reduce((nextStatusMap, [rowKey, record]) => {
      if (record && record.kind === DETAIL_ACTION_STATUS_PREVIEW_KIND) {
        return nextStatusMap;
      }

      nextStatusMap[rowKey] = record;
      return nextStatusMap;
    }, {});
}

export function patchDetailActionPreviewStatusForPayload(statusMap, payload = {}) {
  const nextStatusMap = clearPreviewDetailActionStatuses(statusMap);
  const updatedAt = new Date().toISOString();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  rows.forEach((row) => {
    const rowKey = normalizeText(row && row.rowKey);

    if (!rowKey) {
      return;
    }

    const preview = buildPreparedActionPreview(row, payload);

    nextStatusMap[rowKey] = {
      status: normalizeStatus(preview.status),
      message: normalizeText(preview.message),
      updatedAt,
      kind: DETAIL_ACTION_STATUS_PREVIEW_KIND
    };
  });

  return nextStatusMap;
}
