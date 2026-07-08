function fb_activityBatchQueryCanceled(payload) {
  return {
    canceled: false,
    requestId: String(payload && payload.requestId || '').trim()
  };
}

function fb_activityBatchSignupCanceled(payload) {
  return {
    canceled: false,
    requestId: String(payload && payload.requestId || '').trim()
  };
}

function fb_activityQueryResult() {
  return {
    success: false,
    updatedAt: '',
    totalShopCount: 0,
    successShopCount: 0,
    failedShopCount: 0,
    rawActivityCount: 0,
    uniqueActivityCount: 0,
    rows: [],
    shopResults: [],
    themeTypeMapping: [],
    warning: '\u6d3b\u52a8\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_activityMatchProductsResult() {
  return {
    success: false,
    updatedAt: '',
    cacheKey: '',
    activityKey: '',
    activityType: null,
    activityThematicId: '',
    totalShopCount: 0,
    successShopCount: 0,
    failedShopCount: 0,
    rawProductCount: 0,
    uniqueProductCount: 0,
    cachedRowCount: 0,
    stillCount: 0,
    hasMore: false,
    searchScrollContext: '',
    pageIndex: 1,
    pageSize: 80,
    pageCount: 1,
    rows: [],
    shopResults: [],
    warning: '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_activityMatchProductsBatchResult() {
  return {
    success: false,
    updatedAt: '',
    cacheKey: '',
    totalShopCount: 0,
    totalActivityCount: 0,
    successActivityCount: 0,
    failedActivityCount: 0,
    uniqueProductCount: 0,
    cachedRowCount: 0,
    pageIndex: 1,
    pageSize: 80,
    pageCount: 1,
    rows: [],
    quickCostEntries: [],
    activityResults: [],
    warning: '\u6d3b\u52a8\u5546\u54c1\u6279\u91cf\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_activityBatchSignupSubmitResult(payload) {
  return {
    success: false,
    canceled: false,
    updatedAt: '',
    batchSize: 100,
    totalInputRowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
    submittedRowCount: 0,
    skippedRowCount: 0,
    successRowCount: 0,
    failedRowCount: 0,
    totalShopCount: 0,
    totalGroupCount: 0,
    totalRequestCount: 0,
    completedRequestCount: 0,
    failedRequestCount: 0,
    rowResults: [],
    skippedRows: [],
    warning: '\u6d3b\u52a8\u5546\u54c1\u6279\u91cf\u62a5\u540d\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_activityBackgroundLogSession(payload) {
  return {
    success: false,
    sessionId: String(payload && payload.sessionId || '').trim(),
    runId: Number(payload && payload.runId) || 0,
    startedAt: '',
    finishedAt: '',
    directoryPath: '',
    fileName: '',
    filePath: '',
    rowCount: 0,
    appendedCount: 0,
    warning: '\u540e\u53f0\u62a5\u540d\u65e5\u5fd7\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_activityFilterSettings() {
  return {
    settings: {
      version: 1,
      updatedAt: '',
      minDiscountRate: '',
      minEnrollRemainingDays: '',
      minActivityRemainingDays: '',
      activityThemeTypes: []
    },
    source: 'default',
    warning: ''
  };
}

function fb_activityFilterSettingsSaved() {
  return {
    settings: {
      version: 1,
      updatedAt: '',
      minDiscountRate: '',
      minEnrollRemainingDays: '',
      minActivityRemainingDays: '',
      activityThemeTypes: []
    },
    source: 'default',
    localSaved: false,
    cloudSynced: false,
    warning: ''
  };
}

function fb_activityProductFilterSettings() {
  return {
    settings: {
      version: 1,
      updatedAt: '',
      mode: 'suggestActivityPrice',
      modeValueDailyDiscount: '',
      modeValueProfitRateDiscount: '',
      modeValueDailyReduce: '',
      profitFloorRate: ''
    },
    source: 'default',
    warning: ''
  };
}

function fb_activityProductFilterSettingsSaved() {
  return {
    settings: {
      version: 1,
      updatedAt: '',
      mode: 'suggestActivityPrice',
      modeValueDailyDiscount: '',
      modeValueProfitRateDiscount: '',
      modeValueDailyReduce: '',
      profitFloorRate: ''
    },
    source: 'default',
    localSaved: false,
    cloudSynced: false,
    warning: ''
  };
}

module.exports = {
  fb_activityBackgroundLogSession,
  fb_activityBatchQueryCanceled,
  fb_activityBatchSignupCanceled,
  fb_activityBatchSignupSubmitResult,
  fb_activityFilterSettings,
  fb_activityFilterSettingsSaved,
  fb_activityMatchProductsBatchResult,
  fb_activityMatchProductsResult,
  fb_activityProductFilterSettings,
  fb_activityProductFilterSettingsSaved,
  fb_activityQueryResult
};
