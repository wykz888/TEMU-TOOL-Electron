function registerFeatureCenterPromotionIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    getPromotionManagerSettings,
    savePromotionManagerSettings,
    getPromotionMonitorSnapshot,
    setPromotionMonitorShopEnabled,
    setPromotionMonitorBatchActive,
    getPromotionManagerNewCreateSettings,
    savePromotionManagerNewCreateSettings,
    queryPromotionManagerNewGoods,
    createPromotionManagerNewAds,
    getRuntimeLogEntries
  } = options;
  const logError = typeof options.logError === 'function'
    ? options.logError
    : () => {};
  const {
    fb_promotionManagerNewCreateSettings,
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
        warnings: [],
        totalCount: 0,
        successCount: 0,
        failedCount: 1
      };
    }

    const result = await queryPromotionManagerNewGoods(payload);

    try {
      return structuredClone(result);
    } catch (error) {
      logError('promotion_manager_new_goods_query_result_clone_failed', error, {
        rowCount: Array.isArray(result && result.rows) ? result.rows.length : 0,
        regionCount: Array.isArray(result && result.regions) ? result.regions.length : 0,
        errorCount: Array.isArray(result && result.errors) ? result.errors.length : 0,
        warningCount: Array.isArray(result && result.warnings) ? result.warnings.length : 0
      });

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
          message: '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u7ed3\u679c\u8fd4\u56de\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'
        }],
        warnings: [],
        totalCount: 0,
        successCount: 0,
        failedCount: 1
      };
    }
  });

  handle(FEATURE_CHANNELS.CREATE_PROMOTION_MANAGER_NEW_ADS, async (_event, payload) => {
    if (typeof createPromotionManagerNewAds !== 'function') {
      return {
        updatedAt: new Date().toISOString(),
        request: {},
        groups: [],
        errors: [{
          shopId: '',
          shopName: '',
          regionId: '',
          regionLabel: '',
          message: '\u65b0\u7248\u63a8\u5e7f\u521b\u5efa\u670d\u52a1\u672a\u52a0\u8f7d'
        }],
        warnings: [],
        totalCount: 0,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0
      };
    }

    const result = await createPromotionManagerNewAds(payload);

    try {
      return structuredClone(result);
    } catch (error) {
      logError('promotion_manager_new_create_ads_result_clone_failed', error, {
        groupCount: Array.isArray(result && result.groups) ? result.groups.length : 0,
        errorCount: Array.isArray(result && result.errors) ? result.errors.length : 0,
        warningCount: Array.isArray(result && result.warnings) ? result.warnings.length : 0
      });

      return {
        updatedAt: new Date().toISOString(),
        request: {},
        groups: [],
        errors: [{
          shopId: '',
          shopName: '',
          regionId: '',
          regionLabel: '',
          message: '\u521b\u5efa\u5e7f\u544a\u7ed3\u679c\u8fd4\u56de\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'
        }],
        warnings: [],
        totalCount: 0,
        successCount: 0,
        failedCount: 1,
        skippedCount: 0
      };
    }
  });

  handle(FEATURE_CHANNELS.GET_RUNTIME_LOG_ENTRIES, async (_event, payload) => {
    if (typeof getRuntimeLogEntries !== 'function') return fb_runtimeLog();
    return getRuntimeLogEntries(payload);
  });
}

module.exports = {
  registerFeatureCenterPromotionIpc
};
