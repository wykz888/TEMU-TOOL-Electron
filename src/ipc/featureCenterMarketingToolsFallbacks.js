function fb_marketingToolsSingleProductCouponBatchCouponSettings() {
  return {
    settings: {},
    source: 'default'
  };
}

function fb_marketingToolsSingleProductCouponBatchCouponSettingsSaved() {
  return {
    settings: {},
    source: 'default',
    cloudSynced: false,
    warning: ''
  };
}

function fb_marketingToolsSingleProductCouponQueryResult(payload) {
  return {
    success: false,
    updatedAt: '',
    runId: String(payload && payload.runId || '').trim(),
    rows: [],
    rowCount: 0,
    rawRowCount: 0,
    filteredConfiguredCount: 0,
    totalShopCount: 0,
    completedShopCount: 0,
    failedShopCount: 0,
    canceledShopCount: 0,
    canceled: false,
    shopResults: [],
    warning: '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
  };
}

function fb_marketingToolsSingleProductCouponBatchCouponCreate() {
  return {
    success: false,
    requestedRowCount: 0,
    preparedRowCount: 0,
    skippedRowCount: 0,
    skippedRows: [],
    chunkCount: 0,
    successCount: 0,
    failCount: 0,
    results: []
  };
}

module.exports = {
  fb_marketingToolsSingleProductCouponBatchCouponSettings,
  fb_marketingToolsSingleProductCouponBatchCouponSettingsSaved,
  fb_marketingToolsSingleProductCouponBatchCouponCreate,
  fb_marketingToolsSingleProductCouponQueryResult
};
