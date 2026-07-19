const { normalizeText } = require('../shopManagement/common');
const {
  buildModifyAdsPayload
} = require('./promotionMonitorModifyPayloads');
const {
  normalizeRoasRawValue
} = require('./promotionMonitorMetricUtils');

const DETAIL_ACTION_STATUS_SUCCESS = 'success';
const DETAIL_ACTION_STATUS_FAILED = 'failed';
const DETAIL_ACTION_STATUS_SKIPPED = 'skipped';
const DETAIL_ACTION_STATUS_CANCELED = 'canceled';
const DETAIL_ACTION_STATUS_WARNING = 'warning';

const REGION_LABELS = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

const DETAIL_ACTION_OPTIONS = Object.freeze({
  pause_plan: '\u6682\u505c\u8ba1\u5212',
  resume_plan: '\u6062\u590d\u8ba1\u5212',
  update_roas: '\u4fee\u6539ROAS',
  increase_roas: '\u589e\u52a0ROAS',
  delete_plan: '\u5220\u9664\u8ba1\u5212'
});

const TARGET_ROAS_ACTION_TYPES = new Set([
  'update_roas',
  'increase_roas'
]);

const DETAIL_ROAS_MODE_STRONG = 'strong';
const DETAIL_ROAS_MODE_MEDIUM = 'medium';
const DETAIL_ROAS_MODE_WEAK = 'weak';
const DETAIL_ROAS_MODE_CUSTOM = 'custom';
const DETAIL_ROAS_MODE_IDS = Object.freeze([
  DETAIL_ROAS_MODE_STRONG,
  DETAIL_ROAS_MODE_MEDIUM,
  DETAIL_ROAS_MODE_WEAK,
  DETAIL_ROAS_MODE_CUSTOM
]);

function normalizeFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizePositiveInteger(value, fallback, options = {}) {
  const numberValue = Number.parseInt(value, 10);
  const minimum = Number.isFinite(Number(options.minimum)) ? Number(options.minimum) : 1;
  const maximum = Number.isFinite(Number(options.maximum)) ? Number(options.maximum) : Number.MAX_SAFE_INTEGER;

  if (!Number.isFinite(numberValue) || numberValue < minimum) {
    return fallback;
  }

  return Math.min(numberValue, maximum);
}

function normalizeUniqueTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [values];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeRegionIds(values) {
  return normalizeUniqueTextList(values).filter((regionId) => (
    Object.prototype.hasOwnProperty.call(REGION_LABELS, regionId)
  ));
}

function getSourceRows(payload = {}) {
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload.requests)) {
    return payload.requests;
  }

  if (Array.isArray(payload.modifyRows)) {
    return payload.modifyRows;
  }

  if (Array.isArray(payload.modify_rows)) {
    return payload.modify_rows;
  }

  return [];
}

function parseRoasDisplayValue(value) {
  const text = normalizeText(value).replace(/,/g, '');

  if (!text || text === '-' || text === '--') {
    return null;
  }

  const matched = /-?\d+(?:\.\d+)?/.exec(text);
  const numberValue = matched ? Number(matched[0]) : normalizeFiniteNumber(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeExistingTargetRoasRaw(row) {
  const rawCandidate = normalizeFiniteNumber(row && (
    row.targetRoasRaw
    || row.target_roas_raw
    || row.targetRoasSubmitValue
    || row.target_roas_submit_value
  ));

  if (rawCandidate !== null && rawCandidate > 0) {
    return Math.trunc(rawCandidate);
  }

  const displayValue = parseRoasDisplayValue(
    row && (
      row.targetRoasValue
      || row.target_roas_value
      || row.targetRoasText
      || row.target_roas_text
    )
  );

  return displayValue !== null && displayValue > 0
    ? Math.round(displayValue * 10000)
    : null;
}

function normalizeActionTargetRoasRaw(row) {
  const rawCandidate = normalizeFiniteNumber(row && (
    row.actionTargetRoasRaw
    || row.action_target_roas_raw
    || row.nextTargetRoasRaw
    || row.next_target_roas_raw
  ));

  if (rawCandidate !== null && rawCandidate > 0) {
    return Math.trunc(rawCandidate);
  }

  const displayValue = parseRoasDisplayValue(
    row && (
      row.actionTargetRoas
      || row.action_target_roas
      || row.nextTargetRoas
      || row.next_target_roas
    )
  );

  return displayValue !== null && displayValue > 0
    ? Math.round(displayValue * 10000)
    : null;
}

function buildActionTaskId() {
  return `detail_action_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

function chunkList(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizeActionType(value) {
  const actionType = normalizeText(value);

  return Object.prototype.hasOwnProperty.call(DETAIL_ACTION_OPTIONS, actionType)
    ? actionType
    : 'pause_plan';
}

function normalizeRoasMode(value) {
  const roasMode = normalizeText(value);

  return DETAIL_ROAS_MODE_IDS.includes(roasMode) ? roasMode : DETAIL_ROAS_MODE_STRONG;
}

function buildSkippedRow(row, messages, actionType, fallbackRoasMode) {
  return {
    rowKey: normalizeText(row && row.rowKey),
    shopId: normalizeText(row && (row.shopId || row.shop_id)),
    shopName: normalizeText(row && (row.shopName || row.shop_name)),
    regionId: normalizeText(row && (row.regionId || row.region_id)),
    regionLabel: normalizeText(row && (row.regionLabel || row.region_label)),
    goodsId: normalizeText(row && (row.goodsId || row.goods_id)),
    adId: normalizeText(row && (row.adId || row.ad_id)),
    roasMode: normalizeRoasMode(row && (row.roasMode || row.roas_mode) || fallbackRoasMode),
    actionType,
    message: messages.join('\uff1b')
  };
}

function buildRowResult(row, status, message = '') {
  return {
    rowKey: normalizeText(row && row.rowKey),
    shopId: normalizeText(row && row.shopId),
    shopName: normalizeText(row && row.shopName),
    regionId: normalizeText(row && row.regionId),
    regionLabel: normalizeText(row && row.regionLabel),
    goodsId: normalizeText(row && row.goodsId),
    adId: normalizeText(row && row.adId),
    roasMode: normalizeRoasMode(row && row.roasMode),
    actionType: normalizeText(row && row.actionType),
    status,
    message: normalizeText(message)
  };
}

function normalizeDetailActionRow(row, actionType, fallbackRoasMode) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const normalizedActionType = normalizeActionType(actionType);
  const shopId = normalizeText(safeRow.shopId || safeRow.shop_id);
  const shopName = normalizeText(safeRow.shopName || safeRow.shop_name);
  const regionId = normalizeText(safeRow.regionId || safeRow.region_id);
  const regionLabel = REGION_LABELS[regionId] || normalizeText(safeRow.regionLabel || safeRow.region_label);
  const goodsId = normalizeText(safeRow.goodsId || safeRow.goods_id);
  const adId = normalizeText(safeRow.adId || safeRow.ad_id);
  const targetRoasRaw = normalizeExistingTargetRoasRaw(safeRow);
  const actionTargetRoasRaw = normalizeActionTargetRoasRaw(safeRow);
  const roasMode = normalizeRoasMode(safeRow.roasMode || safeRow.roas_mode || fallbackRoasMode);
  const errors = [];

  if (!shopId) {
    errors.push('\u5e97\u94fa\u7f3a\u5931');
  }

  if (!regionId || !Object.prototype.hasOwnProperty.call(REGION_LABELS, regionId)) {
    errors.push('\u5730\u533a\u7f3a\u5931');
  }

  if (!goodsId) {
    errors.push('\u5546\u54c1ID\u7f3a\u5931');
  }

  if (TARGET_ROAS_ACTION_TYPES.has(normalizedActionType) && !adId) {
    errors.push('\u8ba1\u5212ID\u7f3a\u5931');
  }

  if (normalizedActionType === 'increase_roas' && targetRoasRaw === null) {
    errors.push('\u5f53\u524d\u76ee\u6807ROAS\u7f3a\u5931');
  }

  if (errors.length > 0) {
    return {
      row: null,
      skipped: buildSkippedRow(safeRow, errors, normalizedActionType, roasMode)
    };
  }

  return {
    row: {
      rowKey: normalizeText(safeRow.rowKey) || [shopId, regionId, adId || goodsId].join(':'),
      shopId,
      shopName,
      regionId,
      regionLabel,
      goodsId,
      adId,
      actionType: normalizedActionType,
      roasMode,
      targetRoasRaw,
      actionTargetRoasRaw
    },
    skipped: null
  };
}

function normalizeDetailActionRows(payload = {}) {
  const actionType = normalizeActionType(payload.actionType || payload.action_type);
  const roasMode = normalizeRoasMode(payload.roasMode || payload.roas_mode);
  const normalizedRows = [];
  const skippedRows = [];
  const seenKeys = new Set();

  getSourceRows(payload).forEach((sourceRow) => {
    const normalized = normalizeDetailActionRow(sourceRow, actionType, roasMode);

    if (!normalized.row) {
      skippedRows.push(normalized.skipped);
      return;
    }

    const rowKey = [
      normalized.row.shopId,
      normalized.row.regionId,
      normalized.row.goodsId,
      normalized.row.adId,
      actionType
    ].join(':');

    if (seenKeys.has(rowKey)) {
      skippedRows.push({
        ...normalized.row,
        message: '\u91cd\u590d\u63a8\u5e7f\u5df2\u8df3\u8fc7'
      });
      return;
    }

    seenKeys.add(rowKey);
    normalizedRows.push(normalized.row);
  });

  return {
    actionType,
    rows: normalizedRows,
    skippedRows
  };
}

function groupRowsByShopRegion(rows) {
  const groupMap = new Map();

  rows.forEach((row) => {
    const groupKey = [row.shopId, row.regionId].join('|');

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        shopId: row.shopId,
        shopName: row.shopName,
        regionId: row.regionId,
        regionLabel: row.regionLabel,
        rows: []
      });
    }

    groupMap.get(groupKey).rows.push(row);
  });

  return Array.from(groupMap.values());
}

function groupShopRegionGroupsByShop(groups) {
  const groupMap = new Map();

  groups.forEach((group) => {
    if (!groupMap.has(group.shopId)) {
      groupMap.set(group.shopId, {
        shopId: group.shopId,
        shopName: group.shopName,
        groups: []
      });
    }

    groupMap.get(group.shopId).groups.push(group);
  });

  return Array.from(groupMap.values());
}

function buildRegionIdsByShop(rows, requestedRegionIds) {
  const regionIdsByShop = new Map();

  rows.forEach((row) => {
    if (!regionIdsByShop.has(row.shopId)) {
      regionIdsByShop.set(row.shopId, new Set());
    }

    regionIdsByShop.get(row.shopId).add(row.regionId);
  });

  if (requestedRegionIds.length > 0) {
    rows.forEach((row) => {
      const regionSet = regionIdsByShop.get(row.shopId);

      requestedRegionIds.forEach((regionId) => {
        regionSet.add(regionId);
      });
    });
  }

  return new Map(Array.from(regionIdsByShop.entries()).map(([shopId, regionSet]) => [
    shopId,
    Array.from(regionSet)
  ]));
}

function resolveTargetRoasRawForRow(row, actionType, targetRoas) {
  const sharedTargetRoasRaw = normalizeRoasRawValue(targetRoas);
  const rowTargetRoasRaw = normalizeFiniteNumber(row && row.actionTargetRoasRaw);

  if (actionType === 'update_roas') {
    return rowTargetRoasRaw !== null && rowTargetRoasRaw > 0
      ? Math.trunc(rowTargetRoasRaw)
      : sharedTargetRoasRaw;
  }

  if (actionType === 'increase_roas') {
    return sharedTargetRoasRaw;
  }

  return null;
}

function buildModifyPayloadForRows(rows, actionType, targetRoas) {
  const rowPayloads = [];
  const skippedRows = [];

  rows.forEach((row) => {
    const targetRoasRaw = resolveTargetRoasRawForRow(row, actionType, targetRoas);

    if (TARGET_ROAS_ACTION_TYPES.has(actionType) && !(targetRoasRaw > 0)) {
      skippedRows.push({
        ...row,
        message: normalizeText(row && row.actionTargetRoasMessage) || '\u76ee\u6807ROAS\u7f3a\u5931'
      });
      return;
    }

    if (actionType === 'update_roas' && row.targetRoasRaw !== null && row.targetRoasRaw === targetRoasRaw) {
      skippedRows.push({
        ...row,
        message: '\u76ee\u6807ROAS\u672a\u53d8\u5316'
      });
      return;
    }

    const payload = buildModifyAdsPayload(actionType, {
      goodsId: row.goodsId,
      adId: row.adId,
      targetRoasRaw: row.targetRoasRaw
    }, {
      targetRoas: targetRoasRaw
    });

    if (!payload || !Array.isArray(payload.modify_ad_dtos) || payload.modify_ad_dtos.length <= 0) {
      skippedRows.push({
        ...row,
        message: '\u64cd\u4f5c\u53c2\u6570\u65e0\u6548'
      });
      return;
    }

    rowPayloads.push({
      row,
      dto: payload.modify_ad_dtos[0]
    });
  });

  return {
    rowPayloads,
    skippedRows,
    requestPayload: {
      modify_ad_dtos: rowPayloads.map((entry) => entry.dto)
    }
  };
}

module.exports = {
  DETAIL_ACTION_STATUS_SUCCESS,
  DETAIL_ACTION_STATUS_FAILED,
  DETAIL_ACTION_STATUS_SKIPPED,
  DETAIL_ACTION_STATUS_CANCELED,
  DETAIL_ACTION_STATUS_WARNING,
  DETAIL_ROAS_MODE_STRONG,
  DETAIL_ROAS_MODE_MEDIUM,
  DETAIL_ROAS_MODE_WEAK,
  DETAIL_ROAS_MODE_CUSTOM,
  REGION_LABELS,
  TARGET_ROAS_ACTION_TYPES,
  buildActionTaskId,
  buildModifyPayloadForRows,
  buildRegionIdsByShop,
  buildRowResult,
  chunkList,
  getSourceRows,
  groupRowsByShopRegion,
  groupShopRegionGroupsByShop,
  normalizeActionType,
  normalizeDetailActionRows,
  normalizePositiveInteger,
  normalizeRegionIds,
  normalizeRoasMode,
  parseRoasDisplayValue
};
