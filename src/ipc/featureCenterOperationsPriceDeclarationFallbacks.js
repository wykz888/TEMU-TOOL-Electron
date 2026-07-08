function fb_priceQueryResult(payload) {
  return {
    updatedAt: '',
    runId: String(payload && payload.runId || '').trim(),
    rows: [], rowCount: 0, total: 0,
    totalShops: 0, completedShops: 0, failedShops: 0,
    canceledShops: 0, canceled: false,
    warning: '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_priceSettings() {
  return {
    settings: {
      version: 1, owner: null, updatedAt: '', perShopDelaySeconds: 0
    },
    source: 'unavailable'
  };
}

function fb_priceSettingsSaved() {
  return {
    settings: {
      version: 1, owner: null, updatedAt: '', perShopDelaySeconds: 0
    },
    source: 'unavailable', cloudSynced: false, warning: ''
  };
}

function fb_priceQuickCost() {
  return {
    version: 1, owner: null, updatedAt: '',
    source: 'unavailable', entryCount: 0, entries: []
  };
}

function fb_priceQuickCostSaved() {
  return {
    updatedAt: '', entryCount: 0, entries: [],
    updatedRowCount: 0, updatedShopCount: 0, cloudSynced: false, warning: ''
  };
}

function fb_reviewRules() {
  return {
    rules: {
      version: 1, owner: null, updatedAt: '',
      dailyRule: { metric: 'profitRate', threshold: '' },
      activityRule: { metric: 'profitRate', threshold: '' },
      rejectReason: ''
    },
    source: 'unavailable'
  };
}

function fb_reviewRulesSaved() {
  return {
    rules: {
      version: 1, owner: null, updatedAt: '',
      dailyRule: { metric: 'profitRate', threshold: '' },
      activityRule: { metric: 'profitRate', threshold: '' },
      rejectReason: ''
    },
    source: 'unavailable', cloudSynced: false, warning: ''
  };
}

function fb_priceBatchReject() {
  return {
    updatedAt: '',
    rules: {
      version: 1, owner: null, updatedAt: '',
      dailyRule: { metric: 'profitRate', threshold: '' },
      activityRule: { metric: 'profitRate', threshold: '' },
      rejectReason: ''
    },
    rejectReason: '', totalRowCount: 0,
    eligibleOrderCount: 0, passOrderCount: 0, skippedOrderCount: 0,
    invalidRowCount: 0, requestedRejectOrderCount: 0, rejectedOrderCount: 0,
    succeededReviewOrderIds: [], failedRejectOrderCount: 0,
    succeededOrderNos: [], failedOrders: [],
    warning: '\u6279\u91cf\u62d2\u7edd\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

module.exports = {
  fb_priceBatchReject,
  fb_priceQueryResult,
  fb_priceQuickCost,
  fb_priceQuickCostSaved,
  fb_priceSettings,
  fb_priceSettingsSaved,
  fb_reviewRules,
  fb_reviewRulesSaved
};
