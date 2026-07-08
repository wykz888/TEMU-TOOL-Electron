function registerFeatureCenterOperationsSharedIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    getOperationsProductCategorySnapshot,
    getOperationsProductGlobalCategorySyncSnapshot,
    syncOperationsProductRootCategories,
    syncOperationsProductGlobalCategoryTreeFromOnlineShop,
    getOperationsProductChildCategories,
    searchOperationsProductCategories,
    getOperationsShopSelectionSnapshot,
    saveOperationsShopSelectionLast,
    saveOperationsShopSelectionTemplate,
    deleteOperationsShopSelectionTemplate,
    getOperationsSharedCostSnapshot,
    saveOperationsSharedCostBatch
  } = options;
  const {
    fb_categorySnapshot,
    fb_childCategories,
    fb_globalCategorySyncSnapshot,
    fb_searchResults,
    fb_sharedCostSaved,
    fb_sharedCostSnapshot,
    fb_shopSelectionSnapshot
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRODUCT_CATEGORY_SNAPSHOT, async () => {
    if (typeof getOperationsProductCategorySnapshot !== 'function') return fb_categorySnapshot();
    return getOperationsProductCategorySnapshot();
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRODUCT_GLOBAL_CATEGORY_SYNC_SNAPSHOT, async () => {
    if (typeof getOperationsProductGlobalCategorySyncSnapshot !== 'function') return fb_globalCategorySyncSnapshot();
    return getOperationsProductGlobalCategorySyncSnapshot();
  });

  handle(FEATURE_CHANNELS.SYNC_OPERATIONS_PRODUCT_ROOT_CATEGORIES, async (_event, payload) => {
    if (typeof syncOperationsProductRootCategories !== 'function') return fb_categorySnapshot();
    return syncOperationsProductRootCategories(payload);
  });

  handle(FEATURE_CHANNELS.SYNC_OPERATIONS_PRODUCT_GLOBAL_CATEGORY_TREE_FROM_ONLINE_SHOP, async (_event, payload) => {
    if (typeof syncOperationsProductGlobalCategoryTreeFromOnlineShop !== 'function') return fb_globalCategorySyncSnapshot();
    return syncOperationsProductGlobalCategoryTreeFromOnlineShop(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRODUCT_CHILD_CATEGORIES, async (_event, payload) => {
    if (typeof getOperationsProductChildCategories !== 'function') return fb_childCategories();
    return getOperationsProductChildCategories(payload);
  });

  handle(FEATURE_CHANNELS.SEARCH_OPERATIONS_PRODUCT_CATEGORIES, async (_event, payload) => {
    if (typeof searchOperationsProductCategories !== 'function') return fb_searchResults();
    return searchOperationsProductCategories(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_SHOP_SELECTION_SNAPSHOT, async (_event, payload) => {
    if (typeof getOperationsShopSelectionSnapshot !== 'function') return fb_shopSelectionSnapshot(payload);
    return getOperationsShopSelectionSnapshot(payload);
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_SHOP_SELECTION_LAST, async (_event, payload) => {
    if (typeof saveOperationsShopSelectionLast !== 'function') return fb_shopSelectionSnapshot(payload);
    return saveOperationsShopSelectionLast(payload);
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_SHOP_SELECTION_TEMPLATE, async (_event, payload) => {
    if (typeof saveOperationsShopSelectionTemplate !== 'function') return fb_shopSelectionSnapshot(payload);
    return saveOperationsShopSelectionTemplate(payload);
  });

  handle(FEATURE_CHANNELS.DELETE_OPERATIONS_SHOP_SELECTION_TEMPLATE, async (_event, payload) => {
    if (typeof deleteOperationsShopSelectionTemplate !== 'function') return fb_shopSelectionSnapshot(payload);
    return deleteOperationsShopSelectionTemplate(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_SHARED_COST_SNAPSHOT, async (_event, payload) => {
    if (typeof getOperationsSharedCostSnapshot !== 'function') return fb_sharedCostSnapshot();
    return getOperationsSharedCostSnapshot(payload);
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_SHARED_COST_BATCH, async (_event, payload) => {
    if (typeof saveOperationsSharedCostBatch !== 'function') return fb_sharedCostSaved();
    return saveOperationsSharedCostBatch(payload);
  });
}

module.exports = {
  registerFeatureCenterOperationsSharedIpc
};
