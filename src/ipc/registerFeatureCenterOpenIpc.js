function registerFeatureCenterOpenIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    getFeatureCatalog,
    onOpenOperationsActivityManagement,
    onOpenOperationsTrafficBoost,
    onOpenOperationsPriceDeclaration,
    onOpenOperationsNewProductLifecycle,
    onOpenMarketingTools,
    onOpenGlobalCategorySync,
    onOpenPromotionManager,
    onOpenPodUploadSheetMiaoshou,
    onOpenPodUploadSheetMiaoshouUniversal
  } = options;
  const {
    fb_empty,
    fb_success
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.GET_FEATURE_CATALOG, async () => {
    if (typeof getFeatureCatalog !== 'function') return fb_empty();
    return getFeatureCatalog();
  });

  handle(FEATURE_CHANNELS.OPEN_OPERATIONS_ACTIVITY_MANAGEMENT, async (event, payload) => {
    if (typeof onOpenOperationsActivityManagement === 'function') {
      await onOpenOperationsActivityManagement(payload, {
        event
      });
    }
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_OPERATIONS_TRAFFIC_BOOST, async (event, payload) => {
    if (typeof onOpenOperationsTrafficBoost === 'function') {
      await onOpenOperationsTrafficBoost(payload, {
        event
      });
    }
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_OPERATIONS_PRICE_DECLARATION, async (event, payload) => {
    if (typeof onOpenOperationsPriceDeclaration === 'function') {
      await onOpenOperationsPriceDeclaration(payload, {
        event
      });
    }
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_OPERATIONS_NEW_PRODUCT_LIFECYCLE, async (event, payload) => {
    if (typeof onOpenOperationsNewProductLifecycle === 'function') {
      await onOpenOperationsNewProductLifecycle(payload, {
        event
      });
    }
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_MARKETING_TOOLS, async (event, payload) => {
    if (typeof onOpenMarketingTools === 'function') {
      await onOpenMarketingTools(payload, {
        event
      });
    }
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_GLOBAL_CATEGORY_SYNC, async () => {
    if (typeof onOpenGlobalCategorySync === 'function') onOpenGlobalCategorySync();
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_PROMOTION_MANAGER, async () => {
    if (typeof onOpenPromotionManager === 'function') onOpenPromotionManager();
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_POD_UPLOAD_SHEET_MIAOSHOU, async (event, payload) => {
    if (typeof onOpenPodUploadSheetMiaoshou === 'function') {
      await onOpenPodUploadSheetMiaoshou(payload, {
        event
      });
    }
    return fb_success();
  });

  handle(FEATURE_CHANNELS.OPEN_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL, async (event, payload) => {
    if (typeof onOpenPodUploadSheetMiaoshouUniversal === 'function') {
      await onOpenPodUploadSheetMiaoshouUniversal(payload, {
        event
      });
    }
    return fb_success();
  });
}

module.exports = {
  registerFeatureCenterOpenIpc
};
