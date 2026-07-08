function createFeatureCenterOperationsPreloadApi({
  ipcRenderer,
  featureChannels,
  subscribe
}) {
  const FEATURE_CHANNELS = featureChannels;

  return {
    getOperationsProductCategorySnapshot() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_PRODUCT_CATEGORY_SNAPSHOT);
    },
    getOperationsProductGlobalCategorySyncSnapshot() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_PRODUCT_GLOBAL_CATEGORY_SYNC_SNAPSHOT);
    },
    syncOperationsProductRootCategories(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SYNC_OPERATIONS_PRODUCT_ROOT_CATEGORIES, payload);
    },
    syncOperationsProductGlobalCategoryTreeFromOnlineShop(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SYNC_OPERATIONS_PRODUCT_GLOBAL_CATEGORY_TREE_FROM_ONLINE_SHOP,
        payload
      );
    },
    getOperationsProductChildCategories(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_PRODUCT_CHILD_CATEGORIES, payload);
    },
    searchOperationsProductCategories(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SEARCH_OPERATIONS_PRODUCT_CATEGORIES, payload);
    },
    getOperationsShopSelectionSnapshot(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_SHOP_SELECTION_SNAPSHOT, payload);
    },
    queryOperationsActivityManagementActivities(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_ACTIVITIES, payload);
    },
    queryOperationsActivityManagementMatchProducts(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS, payload);
    },
    getOperationsActivityManagementMatchProductsPage(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_PAGE, payload);
    },
    queryOperationsActivityManagementMatchProductsBatch(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH, payload);
    },
    cancelOperationsActivityManagementMatchProductsBatchQuery(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_QUERY, payload);
    },
    cancelOperationsActivityManagementMatchProductsBatchSubmit(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_SUBMIT, payload);
    },
    getOperationsActivityManagementMatchProductsBatchPage(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_PAGE, payload);
    },
    submitOperationsActivityManagementMatchProductsBatch(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SUBMIT_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH, payload);
    },
    onOperationsActivityManagementBatchProgress(listener) {
      return subscribe(FEATURE_CHANNELS.OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_PROGRESS, listener);
    },
    startOperationsActivityManagementBackgroundLogSession(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.START_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_SESSION,
        payload
      );
    },
    appendOperationsActivityManagementBackgroundLogRows(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.APPEND_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_ROWS,
        payload
      );
    },
    finishOperationsActivityManagementBackgroundLogSession(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.FINISH_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_SESSION,
        payload
      );
    },
    getOperationsActivityManagementFilterSettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_FILTER_SETTINGS);
    },
    saveOperationsActivityManagementFilterSettings(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_ACTIVITY_MANAGEMENT_FILTER_SETTINGS, payload);
    },
    getOperationsActivityManagementProductFilterSettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_PRODUCT_FILTER_SETTINGS);
    },
    saveOperationsActivityManagementProductFilterSettings(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_ACTIVITY_MANAGEMENT_PRODUCT_FILTER_SETTINGS, payload);
    },
    saveOperationsShopSelectionLast(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_SHOP_SELECTION_LAST, payload);
    },
    saveOperationsShopSelectionTemplate(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_SHOP_SELECTION_TEMPLATE, payload);
    },
    deleteOperationsShopSelectionTemplate(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.DELETE_OPERATIONS_SHOP_SELECTION_TEMPLATE, payload);
    },
    getOperationsSharedCostSnapshot(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_SHARED_COST_SNAPSHOT, payload);
    },
    saveOperationsSharedCostBatch(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_SHARED_COST_BATCH, payload);
    },
    queryOperationsTrafficBoostRows(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.QUERY_OPERATIONS_TRAFFIC_BOOST_ROWS, payload);
    },
    submitOperationsTrafficBoostProducts(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SUBMIT_OPERATIONS_TRAFFIC_BOOST_PRODUCTS, payload);
    },
    cancelOperationsTrafficBoostQuery(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_OPERATIONS_TRAFFIC_BOOST_QUERY, payload);
    },
    cancelOperationsTrafficBoostSubmit(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_OPERATIONS_TRAFFIC_BOOST_SUBMIT, payload);
    },
    getOperationsTrafficBoostProgressSnapshot(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_TRAFFIC_BOOST_PROGRESS_SNAPSHOT, payload);
    },
    getOperationsTrafficBoostCustomLevelFilterSettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_TRAFFIC_BOOST_CUSTOM_LEVEL_FILTER_SETTINGS);
    },
    saveOperationsTrafficBoostCustomLevelFilterSettings(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_TRAFFIC_BOOST_CUSTOM_LEVEL_FILTER_SETTINGS, payload);
    },
    onOperationsTrafficBoostProgress(listener) {
      return subscribe(FEATURE_CHANNELS.OPERATIONS_TRAFFIC_BOOST_PROGRESS, listener);
    },
    queryOperationsNewProductLifecycleRows(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.QUERY_OPERATIONS_NEW_PRODUCT_LIFECYCLE_ROWS, payload);
    },
    cancelOperationsNewProductLifecycleQuery(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY, payload);
    },
    getOperationsNewProductLifecycleQuerySettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_SETTINGS);
    },
    saveOperationsNewProductLifecycleQuerySettings(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_SETTINGS, payload);
    },
    getOperationsNewProductLifecycleBatchAdjustPresetSnapshot(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PRESET_SNAPSHOT,
        payload
      );
    },
    saveOperationsNewProductLifecycleBatchAdjustPresetBatch(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PRESET_BATCH,
        payload
      );
    },
    previewOperationsNewProductLifecycleBatchAdjust(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST,
        payload
      );
    },
    submitOperationsNewProductLifecycleBatchAdjust(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST,
        payload
      );
    },
    cancelOperationsNewProductLifecycleBatchAdjust(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST,
        payload
      );
    },
    previewOperationsNewProductLifecycleBatchPriceDecl(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL,
        payload
      );
    },
    submitOperationsNewProductLifecycleBatchPriceDecl(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL,
        payload
      );
    },
    cancelOperationsNewProductLifecycleBatchPriceDecl(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL,
        payload
      );
    },
    getOperationsNewProductLifecyclePriceDeclSettings() {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_PRICE_DECL_SETTINGS
      );
    },
    saveOperationsNewProductLifecyclePriceDeclSettings(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_PRICE_DECL_SETTINGS,
        payload
      );
    },
    onOperationsNewProductLifecycleProgress(listener) {
      return subscribe(FEATURE_CHANNELS.OPERATIONS_NEW_PRODUCT_LIFECYCLE_PROGRESS, listener);
    },
    onOperationsNewProductLifecycleBatchAdjustProgress(listener) {
      return subscribe(FEATURE_CHANNELS.OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PROGRESS, listener);
    },
    queryOperationsPriceDeclarationRows(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.QUERY_OPERATIONS_PRICE_DECLARATION_ROWS, payload);
    },
    cancelOperationsPriceDeclarationQuery(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_OPERATIONS_PRICE_DECLARATION_QUERY, payload);
    },
    getOperationsPriceDeclarationQuerySettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_QUERY_SETTINGS);
    },
    saveOperationsPriceDeclarationQuerySettings(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_PRICE_DECLARATION_QUERY_SETTINGS, payload);
    },
    getOperationsPriceDeclarationQuickCostPresetSnapshot(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_QUICK_COST_PRESET_SNAPSHOT,
        payload
      );
    },
    saveOperationsPriceDeclarationQuickCostPresetBatch(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SAVE_OPERATIONS_PRICE_DECLARATION_QUICK_COST_PRESET_BATCH,
        payload
      );
    },
    getOperationsPriceDeclarationReviewRules() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_REVIEW_RULES);
    },
    saveOperationsPriceDeclarationReviewRules(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_OPERATIONS_PRICE_DECLARATION_REVIEW_RULES, payload);
    },
    batchRejectOperationsPriceDeclarationRows(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.BATCH_REJECT_OPERATIONS_PRICE_DECLARATION_ROWS, payload);
    },
    getOperationsPriceDeclarationProgressSnapshot(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_PROGRESS_SNAPSHOT, payload);
    },
    onOperationsPriceDeclarationProgress(listener) {
      return subscribe(FEATURE_CHANNELS.OPERATIONS_PRICE_DECLARATION_PROGRESS, listener);
    }
  };
}

module.exports = {
  createFeatureCenterOperationsPreloadApi
};
