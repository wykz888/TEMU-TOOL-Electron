function registerFeatureCenterPromotionIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    getPromotionManagerSettings,
    savePromotionManagerSettings,
    getPromotionMonitorSnapshot,
    setPromotionMonitorShopEnabled,
    setPromotionMonitorBatchActive,
    queryPromotionManagerNewGoods,
    getRuntimeLogEntries
  } = options;
  const {
    fb_promotionMonitor,
    fb_promotionSettings,
    fb_runtimeLog
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.GET_PROMOTION_MANAGER_SETTINGS, async () => {
    if (typeof getPromotionManagerSettings !== 'function') return fb_promotionSettings();
    return getPromotionManagerSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_PROMOTION_MANAGER_SETTINGS, async (_event, payload) => {
    if (typeof savePromotionManagerSettings !== 'function') {
      return {
        settings: payload || null,
        source: 'unavailable',
        cloudSynced: false
      };
    }

    return savePromotionManagerSettings(payload);
  });

  handle(FEATURE_CHANNELS.GET_PROMOTION_MONITOR_SNAPSHOT, async () => {
    if (typeof getPromotionMonitorSnapshot !== 'function') return fb_promotionMonitor();
    return getPromotionMonitorSnapshot();
  });

  handle(FEATURE_CHANNELS.SET_PROMOTION_MONITOR_SHOP_ENABLED, async (_event, payload) => {
    if (typeof setPromotionMonitorShopEnabled !== 'function') return fb_promotionMonitor();
    return setPromotionMonitorShopEnabled(payload);
  });

  handle(FEATURE_CHANNELS.SET_PROMOTION_MONITOR_BATCH_ACTIVE, async (_event, payload) => {
    if (typeof setPromotionMonitorBatchActive !== 'function') return fb_promotionMonitor();
    return setPromotionMonitorBatchActive(payload);
  });

  handle(FEATURE_CHANNELS.QUERY_PROMOTION_MANAGER_NEW_GOODS, async (_event, payload) => {
    if (typeof queryPromotionManagerNewGoods !== 'function') {
      return {
        updatedAt: new Date().toISOString(),
        request: {},
        rows: [],
        regions: [],
        errors: [{
          shopId: '',
          shopName: '',
          regionId: '',
          regionLabel: '',
          message: '\u65b0\u7248\u63a8\u5e7f\u5546\u54c1\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }],
        totalCount: 0,
        successCount: 0,
        failedCount: 1
      };
    }

    return queryPromotionManagerNewGoods(payload);
  });

  handle(FEATURE_CHANNELS.GET_RUNTIME_LOG_ENTRIES, async (_event, payload) => {
    if (typeof getRuntimeLogEntries !== 'function') return fb_runtimeLog();
    return getRuntimeLogEntries(payload);
  });
}

module.exports = {
  registerFeatureCenterPromotionIpc
};
