function registerFeatureCenterMarketingToolsIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    log,
    logError,
    queryMarketingToolsSingleProductCouponRows,
    cancelMarketingToolsSingleProductCouponQuery,
    getMarketingToolsSingleProductCouponBatchCouponSettings,
    saveMarketingToolsSingleProductCouponBatchCouponSettings,
    createMarketingToolsSingleProductCouponBatchCoupons
  } = options;
  const {
    fb_canceled,
    fb_marketingToolsSingleProductCouponBatchCouponCreate,
    fb_marketingToolsSingleProductCouponBatchCouponSettings,
    fb_marketingToolsSingleProductCouponBatchCouponSettingsSaved,
    fb_marketingToolsSingleProductCouponQueryResult
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.QUERY_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_ROWS, async (event, payload) => {
    log('marketing_tools_single_product_coupon_query_ipc_invoked', {
      runId: String(payload && payload.runId || '').trim(),
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryMarketingToolsSingleProductCouponRows !== 'function') {
      return fb_marketingToolsSingleProductCouponQueryResult(payload);
    }

    try {
      return await queryMarketingToolsSingleProductCouponRows(payload, {
        event
      });
    } catch (error) {
      logError('marketing_tools_single_product_coupon_query_ipc_failed', error, {
        runId: String(payload && payload.runId || '').trim(),
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_QUERY, async (event, payload) => {
    if (typeof cancelMarketingToolsSingleProductCouponQuery !== 'function') {
      return fb_canceled(payload);
    }

    return cancelMarketingToolsSingleProductCouponQuery(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.GET_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_BATCH_COUPON_SETTINGS, async () => {
    if (typeof getMarketingToolsSingleProductCouponBatchCouponSettings !== 'function') {
      return fb_marketingToolsSingleProductCouponBatchCouponSettings();
    }

    return getMarketingToolsSingleProductCouponBatchCouponSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_BATCH_COUPON_SETTINGS, async (_event, payload) => {
    if (typeof saveMarketingToolsSingleProductCouponBatchCouponSettings !== 'function') {
      return fb_marketingToolsSingleProductCouponBatchCouponSettingsSaved();
    }

    return saveMarketingToolsSingleProductCouponBatchCouponSettings(payload);
  });

  handle(FEATURE_CHANNELS.CREATE_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_BATCH_COUPONS, async (event, payload) => {
    if (typeof createMarketingToolsSingleProductCouponBatchCoupons !== 'function') {
      return fb_marketingToolsSingleProductCouponBatchCouponCreate();
    }

    return createMarketingToolsSingleProductCouponBatchCoupons(payload, {
      event
    });
  });
}

module.exports = {
  registerFeatureCenterMarketingToolsIpc
};
