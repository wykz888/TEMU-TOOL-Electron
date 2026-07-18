const { normalizeText } = require('../shopManagement/common');

const CREATE_PROMOTION_MANAGER_NEW_ADS_URL = 'https://ads.temu.com/api/v1/coconut/ad/create_ads/create';
const DEFAULT_ROAS_TYPE = 1;
const MAX_CREATE_ADS_PER_REQUEST = 50;

const REGION_LABELS = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

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

function normalizeInteger(value) {
  const numberValue = normalizeFiniteNumber(value);

  return numberValue === null ? null : Math.trunc(numberValue);
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

function normalizeBudgetValue(value) {
  const numberValue = normalizeInteger(value);

  if (numberValue === -1) {
    return -1;
  }

  if (numberValue !== null && numberValue > 0) {
    return numberValue;
  }

  return null;
}

function normalizeRoasSubmitValue(value) {
  const numberValue = normalizeInteger(value);

  if (numberValue !== null && numberValue >= 1000) {
    return numberValue;
  }

  return null;
}

function normalizeFastStartFlag(value) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const numberValue = normalizeFiniteNumber(value);

  if (numberValue !== null) {
    return numberValue > 0 ? 1 : 0;
  }

  const normalized = normalizeText(value).toLowerCase();

  return ['true', 'yes', 'on'].includes(normalized) ? 1 : 0;
}

function toCloneableJsonValue(value, fallback) {
  try {
    if (value === undefined) {
      return fallback;
    }

    const text = JSON.stringify(value);
    return text ? JSON.parse(text) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function chunkList(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function getSourceRows(payload = {}) {
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload.requests)) {
    return payload.requests;
  }

  if (Array.isArray(payload.createAdReqs)) {
    return payload.createAdReqs;
  }

  if (Array.isArray(payload.create_ad_reqs)) {
    return payload.create_ad_reqs;
  }

  return [];
}

function buildSkippedRow(row, messages) {
  return {
    rowKey: normalizeText(row && row.rowKey),
    shopId: normalizeText(row && (row.shopId || row.shop_id)),
    shopName: normalizeText(row && (row.shopName || row.shop_name)),
    regionId: normalizeText(row && (row.regionId || row.region_id)),
    regionLabel: normalizeText(row && (row.regionLabel || row.region_label)),
    goodsId: normalizeText(row && (row.goodsId || row.goods_id)),
    message: messages.join('\uff1b')
  };
}

function normalizeCreateAdRow(row) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const shopId = normalizeText(safeRow.shopId || safeRow.shop_id);
  const shopName = normalizeText(safeRow.shopName || safeRow.shop_name);
  const regionId = normalizeText(safeRow.regionId || safeRow.region_id);
  const regionLabel = REGION_LABELS[regionId] || normalizeText(safeRow.regionLabel || safeRow.region_label);
  const goodsId = normalizeText(safeRow.goodsId || safeRow.goods_id);
  const budget = normalizeBudgetValue(safeRow.budget);
  const roas = normalizeRoasSubmitValue(safeRow.roas || safeRow.roasValue || safeRow.roas_value);
  const fastStart = normalizeFastStartFlag(
    safeRow.fastStart !== undefined
      ? safeRow.fastStart
      : (safeRow.fast_start !== undefined ? safeRow.fast_start : safeRow.fastStartEnabled)
  );
  const roasType = normalizePositiveInteger(safeRow.roasType || safeRow.roas_type, DEFAULT_ROAS_TYPE);
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

  if (budget === null) {
    errors.push('\u63a8\u5e7f\u65e5\u9884\u7b97\u65e0\u6548');
  }

  if (roas === null) {
    errors.push('\u76ee\u6807ROAS\u65e0\u6548');
  }

  if (errors.length > 0) {
    return {
      row: null,
      skipped: buildSkippedRow(safeRow, errors)
    };
  }

  return {
    row: {
      rowKey: normalizeText(safeRow.rowKey) || [shopId, regionId, goodsId].join(':'),
      shopId,
      shopName,
      regionId,
      regionLabel,
      goodsId,
      budget,
      roas,
      fastStart,
      roasType
    },
    skipped: null
  };
}

function normalizeCreateAdRows(payload = {}) {
  const normalizedRows = [];
  const skippedRows = [];
  const seenKeys = new Set();

  getSourceRows(payload).forEach((sourceRow) => {
    const normalized = normalizeCreateAdRow(sourceRow);

    if (!normalized.row) {
      skippedRows.push(normalized.skipped);
      return;
    }

    const rowKey = [
      normalized.row.shopId,
      normalized.row.regionId,
      normalized.row.goodsId
    ].join(':');

    if (seenKeys.has(rowKey)) {
      skippedRows.push({
        ...normalized.row,
        message: '\u91cd\u590d\u5546\u54c1\u5df2\u8df3\u8fc7'
      });
      return;
    }

    seenKeys.add(rowKey);
    normalizedRows.push(normalized.row);
  });

  return {
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

function buildCreateAdsRequestPayload(rows) {
  return {
    create_ad_reqs: rows.map((row) => ({
      goods_id: row.goodsId,
      roas: row.roas,
      budget: row.budget,
      fast_start: row.fastStart,
      roas_type: row.roasType
    }))
  };
}

function getApiResponseData(response) {
  if (response && response.data && typeof response.data === 'object') {
    return response.data;
  }

  return response && typeof response === 'object' ? response : {};
}

function getApiErrorMessage(response, fallbackMessage) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const data = getApiResponseData(responsePayload);
  const errorCode = normalizeText(data.error_code || data.errorCode || responsePayload.errorCode);
  const message = normalizeText(
    data.error_msg
    || data.errorMsg
    || data.message
    || data.msg
    || responsePayload.message
  );

  if (message) {
    return errorCode ? `${message} (${errorCode})` : message;
  }

  if (responsePayload.httpStatus) {
    return `HTTP ${responsePayload.httpStatus}`;
  }

  return fallbackMessage;
}

function assertApiSuccess(response, contextText) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const data = getApiResponseData(responsePayload);

  if (responsePayload.ok !== true || data.success === false || responsePayload.success === false) {
    throw new Error(getApiErrorMessage(
      responsePayload,
      contextText || '\u521b\u5efa\u5e7f\u544a\u5931\u8d25'
    ));
  }
}

function pickArrayValue(container, keys) {
  for (const key of keys) {
    const value = container && container[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function extractCreateResponseStats(response, requestCount) {
  const data = getApiResponseData(response);
  const result = data.result && typeof data.result === 'object' ? data.result : {};
  const failedRows = pickArrayValue(result, [
    'fail_list',
    'failed_list',
    'failList',
    'failedList',
    'error_list',
    'errorList'
  ]);
  const successRows = pickArrayValue(result, [
    'success_list',
    'successList',
    'created_list',
    'createdList'
  ]);
  const failedCount = failedRows.length;
  const successCount = successRows.length > 0
    ? successRows.length
    : Math.max(0, requestCount - failedCount);

  return {
    successCount,
    failedCount,
    message: normalizeText(data.error_msg || data.errorMsg || data.message || data.msg),
    failedRows: failedRows.map((row) => toCloneableJsonValue(row, {})),
    successRows: successRows.map((row) => toCloneableJsonValue(row, {}))
  };
}

function buildMessageSignature(entry) {
  return [
    normalizeText(entry && entry.shopName),
    normalizeText(entry && entry.regionLabel),
    normalizeText(entry && entry.message)
  ].join('|');
}

function pushUniqueMessage(target, entry, signatureSet) {
  const signature = buildMessageSignature(entry);

  if (!signature || signatureSet.has(signature)) {
    return false;
  }

  signatureSet.add(signature);
  target.push(entry);
  return true;
}

function createPromotionManagerNewAdsCreateService({
  promotionAdsSessionService,
  promotionMasterSessionService,
  runtimeLogger
} = {}) {
  const adsSessionService = promotionAdsSessionService || promotionMasterSessionService;

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  async function submitGroupChunk(group, rows, chunkIndex, allRegionIds) {
    const requestPayload = buildCreateAdsRequestPayload(rows);
    const sessionResult = await adsSessionService.postWithRegionCookie(
      group.shopId,
      group.regionId,
      CREATE_PROMOTION_MANAGER_NEW_ADS_URL,
      requestPayload,
      {
        allRegionIds,
        reason: `${group.regionId}-create-ads-chunk-${chunkIndex + 1}`
      }
    );
    const response = sessionResult && sessionResult.response ? sessionResult.response : null;

    assertApiSuccess(response, '\u521b\u5efa\u5e7f\u544a\u5931\u8d25');

    const stats = extractCreateResponseStats(response, rows.length);

    return {
      chunkIndex: chunkIndex + 1,
      requestCount: rows.length,
      successCount: stats.successCount,
      failedCount: stats.failedCount,
      message: stats.message,
      failedRows: stats.failedRows,
      successRows: stats.successRows,
      refreshedCookies: sessionResult && sessionResult.refreshedCookies === true,
      cookieSyncMode: normalizeText(sessionResult && sessionResult.cookieSyncMode)
    };
  }

  async function createAds(payload = {}) {
    if (!adsSessionService || typeof adsSessionService.postWithRegionCookie !== 'function') {
      throw new Error('\u63a8\u5e7f\u4f1a\u8bdd\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const sourceRows = getSourceRows(payload);

    if (sourceRows.length <= 0) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u9700\u8981\u521b\u5efa\u5e7f\u544a\u7684\u5546\u54c1');
    }

    const normalized = normalizeCreateAdRows(payload);
    const requestedRegionIds = normalizeRegionIds(payload.regionIds || payload.region_ids);
    const regionIdsByShop = buildRegionIdsByShop(normalized.rows, requestedRegionIds);
    const groups = groupRowsByShopRegion(normalized.rows);
    const errors = [];
    const warnings = [];
    const errorSignatures = new Set();
    const warningSignatures = new Set();
    const groupResults = [];
    const chunkSize = normalizePositiveInteger(
      payload.chunkSize || payload.chunk_size,
      MAX_CREATE_ADS_PER_REQUEST,
      { maximum: MAX_CREATE_ADS_PER_REQUEST }
    );
    let successCount = 0;
    let failedCount = 0;

    normalized.skippedRows.forEach((row) => {
      pushUniqueMessage(warnings, {
        shopId: normalizeText(row && row.shopId),
        shopName: normalizeText(row && row.shopName),
        regionId: normalizeText(row && row.regionId),
        regionLabel: normalizeText(row && row.regionLabel),
        goodsId: normalizeText(row && row.goodsId),
        message: normalizeText(row && row.message) || '\u5546\u54c1\u5df2\u8df3\u8fc7'
      }, warningSignatures);
    });

    for (const group of groups) {
      const chunks = chunkList(group.rows, chunkSize);
      const groupResult = {
        shopId: group.shopId,
        shopName: group.shopName,
        regionId: group.regionId,
        regionLabel: group.regionLabel,
        rowCount: group.rows.length,
        successCount: 0,
        failedCount: 0,
        chunks: []
      };
      const allRegionIds = regionIdsByShop.get(group.shopId) || [group.regionId];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunkRows = chunks[chunkIndex];

        try {
          const chunkResult = await submitGroupChunk(group, chunkRows, chunkIndex, allRegionIds);

          groupResult.chunks.push(chunkResult);
          groupResult.successCount += chunkResult.successCount;
          groupResult.failedCount += chunkResult.failedCount;
          successCount += chunkResult.successCount;
          failedCount += chunkResult.failedCount;

          if (chunkResult.failedCount > 0) {
            pushUniqueMessage(errors, {
              shopId: group.shopId,
              shopName: group.shopName,
              regionId: group.regionId,
              regionLabel: group.regionLabel,
              message: chunkResult.message || '\u90e8\u5206\u5546\u54c1\u521b\u5efa\u5931\u8d25'
            }, errorSignatures);
          }
        } catch (error) {
          const message = normalizeText(error && error.message) || '\u521b\u5efa\u5e7f\u544a\u5931\u8d25';

          groupResult.chunks.push({
            chunkIndex: chunkIndex + 1,
            requestCount: chunkRows.length,
            successCount: 0,
            failedCount: chunkRows.length,
            message,
            failedRows: [],
            successRows: [],
            refreshedCookies: false,
            cookieSyncMode: ''
          });
          groupResult.failedCount += chunkRows.length;
          failedCount += chunkRows.length;
          pushUniqueMessage(errors, {
            shopId: group.shopId,
            shopName: group.shopName,
            regionId: group.regionId,
            regionLabel: group.regionLabel,
            message
          }, errorSignatures);
          logError('promotion_manager_new_create_ads_chunk_failed', error, {
            shopId: group.shopId,
            shopName: group.shopName,
            regionId: group.regionId,
            chunkIndex: chunkIndex + 1,
            requestCount: chunkRows.length
          });
        }
      }

      groupResults.push(groupResult);
    }

    if (normalized.rows.length <= 0 && normalized.skippedRows.length > 0) {
      pushUniqueMessage(errors, {
        shopId: '',
        shopName: '',
        regionId: '',
        regionLabel: '',
        message: '\u6ca1\u6709\u53ef\u521b\u5efa\u5e7f\u544a\u7684\u5546\u54c1'
      }, errorSignatures);
    }

    const result = {
      updatedAt: new Date().toISOString(),
      request: {
        rowCount: sourceRows.length,
        validCount: normalized.rows.length,
        skippedCount: normalized.skippedRows.length,
        groupCount: groups.length,
        chunkSize
      },
      groups: groupResults,
      errors,
      warnings,
      totalCount: sourceRows.length,
      successCount,
      failedCount,
      skippedCount: normalized.skippedRows.length
    };

    log('promotion_manager_new_create_ads_finished', {
      rowCount: sourceRows.length,
      validCount: normalized.rows.length,
      skippedCount: normalized.skippedRows.length,
      groupCount: groups.length,
      successCount,
      failedCount,
      errorCount: errors.length,
      warningCount: warnings.length
    });

    return toCloneableJsonValue(result, {
      updatedAt: new Date().toISOString(),
      request: {},
      groups: [],
      errors: [{
        shopId: '',
        shopName: '',
        regionId: '',
        regionLabel: '',
        message: '\u521b\u5efa\u5e7f\u544a\u7ed3\u679c\u89e3\u6790\u5931\u8d25'
      }],
      warnings: [],
      totalCount: 0,
      successCount: 0,
      failedCount: 1,
      skippedCount: 0
    });
  }

  return {
    createAds
  };
}

module.exports = {
  CREATE_PROMOTION_MANAGER_NEW_ADS_URL,
  DEFAULT_ROAS_TYPE,
  MAX_CREATE_ADS_PER_REQUEST,
  buildCreateAdsRequestPayload,
  createPromotionManagerNewAdsCreateService,
  normalizeCreateAdRows,
  normalizeRoasSubmitValue
};
