const { normalizeText } = require('../shopManagement/common');
const {
  DETAIL_ACTION_STATUS_FAILED,
  DETAIL_ACTION_STATUS_SUCCESS,
  DETAIL_ACTION_STATUS_WARNING,
  buildRowResult,
  normalizePositiveInteger
} = require('./promotionManagerNewDetailActionRows');

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

function assertModifyAdsResponseSuccess(response, contextText) {
  const responsePayload = response && typeof response === 'object' ? response : {};
  const data = getApiResponseData(responsePayload);

  if (responsePayload.ok !== true || data.success === false || responsePayload.success === false) {
    throw new Error(getApiErrorMessage(
      responsePayload,
      contextText || '\u63a8\u5e7f\u64cd\u4f5c\u5931\u8d25'
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

function getResponseGoodsId(row) {
  return normalizeText(row && (
    row.goods_id
    || row.goodsId
    || row.goodsID
  ));
}

function getResponseAdId(row) {
  return normalizeText(row && (
    row.ad_id
    || row.adId
    || row.adID
  ));
}

function getResponseRowMessage(row) {
  return normalizeText(row && (
    row.error_msg
    || row.errorMsg
    || row.message
    || row.msg
    || row.reason
  ));
}

function resolveReportedSuccessCount(result) {
  const keys = [
    'success_modify_product_num',
    'successModifyProductNum',
    'success_num',
    'successNum'
  ];

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(result || {}, key)) {
      continue;
    }

    return normalizePositiveInteger(result[key], 0, { minimum: 0 });
  }

  return null;
}

function extractModifyResponseStats(response, requestCount) {
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
    'modified_list',
    'modifiedList'
  ]);
  const reportedSuccessCount = resolveReportedSuccessCount(result);
  const failedCount = failedRows.length > 0
    ? failedRows.length
    : (successRows.length > 0 ? Math.max(0, requestCount - successRows.length) : 0);
  const successCount = successRows.length > 0
    ? successRows.length
    : (
      reportedSuccessCount !== null
        ? Math.min(requestCount, reportedSuccessCount)
        : Math.max(0, requestCount - failedCount)
    );

  return {
    successCount,
    failedCount,
    message: normalizeText(data.error_msg || data.errorMsg || data.message || data.msg),
    failedRows,
    successRows
  };
}

function buildModifyChunkRowResults(rows, stats) {
  const failedRows = Array.isArray(stats && stats.failedRows) ? stats.failedRows : [];
  const successRows = Array.isArray(stats && stats.successRows) ? stats.successRows : [];
  const failedByKey = new Map();
  const successKeys = new Set();

  failedRows.forEach((row) => {
    const key = [getResponseGoodsId(row), getResponseAdId(row)].filter(Boolean).join(':');

    if (key && !failedByKey.has(key)) {
      failedByKey.set(key, row);
    }
  });
  successRows.forEach((row) => {
    const key = [getResponseGoodsId(row), getResponseAdId(row)].filter(Boolean).join(':');

    if (key) {
      successKeys.add(key);
    }
  });

  if (successKeys.size <= 0 && failedByKey.size <= 0) {
    if (stats.successCount >= rows.length) {
      return rows.map((row) => buildRowResult(row, DETAIL_ACTION_STATUS_SUCCESS, '\u64cd\u4f5c\u6210\u529f'));
    }

    if (stats.successCount <= 0) {
      return rows.map((row) => buildRowResult(row, DETAIL_ACTION_STATUS_FAILED, stats.message || '\u64cd\u4f5c\u5931\u8d25'));
    }

    return rows.map((row) => buildRowResult(
      row,
      DETAIL_ACTION_STATUS_WARNING,
      '\u90e8\u5206\u6210\u529f\uff0c\u8bf7\u5237\u65b0\u540e\u786e\u8ba4'
    ));
  }

  return rows.map((row) => {
    const key = [row.goodsId, row.adId].filter(Boolean).join(':');
    const failedRow = failedByKey.get(key);

    if (failedRow) {
      return buildRowResult(row, DETAIL_ACTION_STATUS_FAILED, getResponseRowMessage(failedRow) || '\u64cd\u4f5c\u5931\u8d25');
    }

    if (successKeys.size > 0 && !successKeys.has(key)) {
      return buildRowResult(row, DETAIL_ACTION_STATUS_FAILED, '\u64cd\u4f5c\u5931\u8d25');
    }

    return buildRowResult(row, DETAIL_ACTION_STATUS_SUCCESS, '\u64cd\u4f5c\u6210\u529f');
  });
}

module.exports = {
  assertModifyAdsResponseSuccess,
  buildModifyChunkRowResults,
  extractModifyResponseStats
};
