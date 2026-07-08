function fb_nplcQueryResult() {
  return {
    updatedAt: '', rowCount: 0, productCount: 0, total: 0,
    totalShops: 0, completedShops: 0, failedShops: 0,
    rows: [], requestPreviewByShop: [],
    warning: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_nplcSettings() {
  return {
    settings: {
      version: 1, owner: null, updatedAt: '',
      pageDelayMinSeconds: '', pageDelayMaxSeconds: ''
    },
    source: 'unavailable', warning: ''
  };
}

function fb_nplcSettingsSaved() {
  return {
    settings: {
      version: 1, owner: null, updatedAt: '',
      pageDelayMinSeconds: '', pageDelayMaxSeconds: ''
    },
    source: 'unavailable', localSaved: false,
    warning: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_nplcPreset() {
  return {
    version: 1,
    owner: null,
    updatedAt: '',
    source: 'unavailable',
    settings: {
      stationIds: [],
      dailyEnabled: true,
      activityEnabled: false,
      reasonCode: '',
      remark: '',
      duplicateSubmitWindowDays: '',
      useSuggestedPriceAfterSubmitCount: '',
      activityPriceReduction: '',
      dailyProfitFloorMode: 'rate',
      dailyProfitFloorValue: '',
      activityProfitFloorMode: 'rate',
      activityProfitFloorValue: ''
    },
    entryCount: 0,
    entries: [],
    warning: ''
  };
}

function fb_nplcPresetSaved() {
  return {
    version: 1, owner: null, updatedAt: '',
    source: 'unavailable', localSaved: false, cloudSynced: false,
    entryCount: 0, savedEntryCount: 0, entries: [],
    warning: '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_nplcPresetWithSettings() {
  const fallback = fb_nplcPreset();
  return {
    ...fallback,
    settings: {
      stationIds: [],
      dailyEnabled: true,
      activityEnabled: false,
      reasonCode: '',
      remark: '',
      duplicateSubmitWindowDays: '',
      useSuggestedPriceAfterSubmitCount: '',
      activityPriceReduction: '',
      dailyProfitFloorMode: 'rate',
      dailyProfitFloorValue: '',
      activityProfitFloorMode: 'rate',
      activityProfitFloorValue: ''
    }
  };
}

function fb_nplcPresetSavedWithSettings() {
  const fallback = fb_nplcPresetSaved();
  return {
    ...fallback,
    settings: {
      stationIds: [],
      dailyEnabled: true,
      activityEnabled: false,
      reasonCode: '',
      remark: '',
      duplicateSubmitWindowDays: '',
      useSuggestedPriceAfterSubmitCount: '',
      activityPriceReduction: '',
      dailyProfitFloorMode: 'rate',
      dailyProfitFloorValue: '',
      activityProfitFloorMode: 'rate',
      activityProfitFloorValue: ''
    }
  };
}

function fb_nplcBatchPreview(payload) {
  return {
    success: false,
    runId: String(payload && payload.runId || '').trim(),
    message: '\u6279\u91cf\u8c03\u4ef7\u9884\u89c8\u670d\u52a1\u672a\u52a0\u8f7d',
    warning: '',
    previewItems: [],
    groupedRequests: [],
    summary: {
      totalRowCount: 0,
      totalShops: 0,
      readyRowCount: 0,
      dailyReadyRowCount: 0,
      activityReadyRowCount: 0,
      requestedDailyCount: 0,
      requestedActivityCount: 0,
      requestGroupCount: 0,
      skippedRowCount: 0
    },
    resultsByShop: []
  };
}

function fb_nplcBatchSubmit(payload) {
  return {
    updatedAt: '',
    runId: String(payload && payload.runId || '').trim(),
    totalRowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
    totalShops: 0, completedShops: 0, failedShops: 0,
    localDailyEligibleCount: 0, localActivityEligibleCount: 0,
    requestedDailyCount: 0, requestedActivityCount: 0,
    successDailyCount: 0, successActivityCount: 0,
    failedDailyCount: 0, failedActivityCount: 0,
    skippedRowCount: 0, skippedReasonCounts: {}, rowUpdates: [],
    warning: '\u6279\u91cf\u8c03\u4ef7\u63d0\u4ea4\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

module.exports = {
  fb_nplcBatchPreview,
  fb_nplcBatchSubmit,
  fb_nplcPreset,
  fb_nplcPresetSaved,
  fb_nplcPresetSavedWithSettings,
  fb_nplcPresetWithSettings,
  fb_nplcQueryResult,
  fb_nplcSettings,
  fb_nplcSettingsSaved
};
