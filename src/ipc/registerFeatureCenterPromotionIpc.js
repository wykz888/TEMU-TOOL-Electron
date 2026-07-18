function registerFeatureCenterPromotionIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    getPromotionMonitorSnapshot,
    setPromotionMonitorShopEnabled,
    setPromotionMonitorBatchActive,
    getPromotionMonitorRuntimeLogs,
    clearPromotionMonitorRuntimeLogs,
    getPromotionManagerNewCreateSettings,
    savePromotionManagerNewCreateSettings,
    getPromotionManagerNewMonitorSettings,
    savePromotionManagerNewMonitorSettings,
    queryPromotionManagerNewGoods,
    cancelPromotionManagerNewGoodsQuery,
    createPromotionManagerNewAds,
    cancelPromotionManagerNewAdsCreate,
    getRuntimeLogEntries
  } = options;
  const {
    fb_promotionManagerNewCreateSettings,
    fb_promotionManagerNewMonitorSettings,
    fb_promotionMonitor,
    fb_promotionMonitorRuntimeLogs,
    fb_runtimeLog
  } = options.fallbacks || {};

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

  handle(FEATURE_CHANNELS.GET_PROMOTION_MONITOR_RUNTIME_LOGS, async (_event, payload) => {
    if (typeof getPromotionMonitorRuntimeLogs !== 'function') return fb_promotionMonitorRuntimeLogs();
    return getPromotionMonitorRuntimeLogs(payload);
  });

  handle(FEATURE_CHANNELS.CLEAR_PROMOTION_MONITOR_RUNTIME_LOGS, async () => {
    if (typeof clearPromotionMonitorRuntimeLogs !== 'function') return fb_promotionMonitorRuntimeLogs();
    return clearPromotionMonitorRuntimeLogs();
  });

  handle(FEATURE_CHANNELS.GET_PROMOTION_MANAGER_NEW_CREATE_SETTINGS, async () => {
    if (typeof getPromotionManagerNewCreateSettings !== 'function') {
      return fb_promotionManagerNewCreateSettings();
    }

    return getPromotionManagerNewCreateSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_PROMOTION_MANAGER_NEW_CREATE_SETTINGS, async (_event, payload) => {
    if (typeof savePromotionManagerNewCreateSettings !== 'function') {
      return fb_promotionManagerNewCreateSettings();
    }

    return savePromotionManagerNewCreateSettings(payload);
  });

  handle(FEATURE_CHANNELS.GET_PROMOTION_MANAGER_NEW_MONITOR_SETTINGS, async () => {
    if (typeof getPromotionManagerNewMonitorSettings !== 'function') {
      return fb_promotionManagerNewMonitorSettings();
    }

    return getPromotionManagerNewMonitorSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_PROMOTION_MANAGER_NEW_MONITOR_SETTINGS, async (_event, payload) => {
    if (typeof savePromotionManagerNewMonitorSettings !== 'function') {
      return fb_promotionManagerNewMonitorSettings();
    }

    return savePromotionManagerNewMonitorSettings(payload);
  });

  handle(FEATURE_CHANNELS.QUERY_PROMOTION_MANAGER_NEW_GOODS, async (_event, payload) => {
    if (typeof queryPromotionManagerNewGoods !== 'function') {
      return {
        taskId: '',
        canceled: false,
        updatedAt: new Date().toISOString(),
        request: {},
        rows: [],
        regions: [],
        errors: [{
          shopId: '',
          shopName: '',
          regionId: '',
          regionLabel: '',
          message: '\u63a8\u5e7f\u5546\u54c1\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }],
        warnings: [],
        totalCount: 0,
        successCount: 0,
        failedCount: 1
      };
    }

    return queryPromotionManagerNewGoods(payload);
  });

  handle(FEATURE_CHANNELS.CANCEL_PROMOTION_MANAGER_NEW_GOODS_QUERY, async (_event, payload) => {
    if (typeof cancelPromotionManagerNewGoodsQuery !== 'function') {
      return {
        canceled: false,
        taskId: '',
        message: '\u5546\u54c1\u67e5\u8be2\u505c\u6b62\u670d\u52a1\u672a\u52a0\u8f7d'
      };
    }

    return cancelPromotionManagerNewGoodsQuery(payload);
  });

  handle(FEATURE_CHANNELS.CREATE_PROMOTION_MANAGER_NEW_ADS, async (_event, payload) => {
    if (typeof createPromotionManagerNewAds !== 'function') {
      return {
        updatedAt: new Date().toISOString(),
        request: {},
        groups: [],
        rowResults: [],
        errors: [{
          shopId: '',
          shopName: '',
          regionId: '',
          regionLabel: '',
          message: '\u63a8\u5e7f\u521b\u5efa\u670d\u52a1\u672a\u52a0\u8f7d'
        }],
        warnings: [],
        totalCount: 0,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0,
        canceledCount: 0
      };
    }

    return createPromotionManagerNewAds(payload);
  });

  handle(FEATURE_CHANNELS.CANCEL_PROMOTION_MANAGER_NEW_ADS_CREATE, async (_event, payload) => {
    if (typeof cancelPromotionManagerNewAdsCreate !== 'function') {
      return {
        canceled: false,
        taskId: '',
        message: '\u521b\u5efa\u5e7f\u544a\u505c\u6b62\u670d\u52a1\u672a\u52a0\u8f7d'
      };
    }

    return cancelPromotionManagerNewAdsCreate(payload);
  });

  handle(FEATURE_CHANNELS.GET_RUNTIME_LOG_ENTRIES, async (_event, payload) => {
    if (typeof getRuntimeLogEntries !== 'function') return fb_runtimeLog();
    return getRuntimeLogEntries(payload);
  });
}

module.exports = {
  registerFeatureCenterPromotionIpc
};
