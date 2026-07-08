function fb_trafficBoostSubmitCanceled(payload) {
  return {
    canceled: false,
    requestId: String(payload && payload.requestId || '').trim()
  };
}

function fb_trafficBoostCustomLevelFilterSettings() {
  return {
    settings: {
      version: 1,
      updatedAt: '',
      mode: 'suggestActivityPrice',
      modeValueDailyDiscount: '',
      modeValueSaleProfitRate: '',
      modeValueProfitRateDiscount: '',
      modeValueDailyReduce: '',
      modeValueCostMarkup: '',
      modeValue: '',
      clampToSuggestPrice: false,
      profitFloorRate: '',
      profitFloorRelation: 'and',
      profitFloorValue: '',
      submitAtProfitFloor: false,
      submitAtProfitFloorBasis: 'profitFloorRate'
    },
    source: 'default',
    warning: ''
  };
}

function fb_trafficBoostCustomLevelFilterSettingsSaved() {
  return {
    settings: {
      version: 1,
      updatedAt: '',
      mode: 'suggestActivityPrice',
      modeValueDailyDiscount: '',
      modeValueSaleProfitRate: '',
      modeValueProfitRateDiscount: '',
      modeValueDailyReduce: '',
      modeValueCostMarkup: '',
      modeValue: '',
      clampToSuggestPrice: false,
      profitFloorRate: '',
      profitFloorRelation: 'and',
      profitFloorValue: '',
      submitAtProfitFloor: false,
      submitAtProfitFloorBasis: 'profitFloorRate'
    },
    source: 'default',
    localSaved: false,
    cloudSynced: false,
    warning: ''
  };
}

function fb_trafficBoostQueryResult(payload) {
  return {
    updatedAt: '',
    runId: String(payload && payload.runId || '').trim(),
    rows: [],
    rowCount: 0,
    total: 0,
    totalShops: 0,
    completedShops: 0,
    failedShops: 0,
    canceledShops: 0,
    canceled: false,
    warning: '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_trafficBoostSubmitResult(payload) {
  return {
    success: false,
    updatedAt: '',
    requestId: String(payload && payload.requestId || '').trim(),
    totalShopCount: 0,
    completedShopCount: 0,
    failedShopCount: 0,
    totalProductCount: 0,
    successProductCount: 0,
    failedProductCount: 0,
    shopResults: [],
    failProducts: [],
    warning: '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

module.exports = {
  fb_trafficBoostCustomLevelFilterSettings,
  fb_trafficBoostCustomLevelFilterSettingsSaved,
  fb_trafficBoostQueryResult,
  fb_trafficBoostSubmitCanceled,
  fb_trafficBoostSubmitResult
};
