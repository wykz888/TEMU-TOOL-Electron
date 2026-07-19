const {
  createFeatureCenterOperationsPreloadApi
} = require('./featureCenterOperationsPreloadApi');

function toCloneablePayload(payload, fallback = {}) {
  try {
    if (payload === undefined) {
      return fallback;
    }

    const text = JSON.stringify(payload);
    return text ? JSON.parse(text) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function createFeatureCenterPreloadApi({
  ipcRenderer,
  featureChannels,
  subscribe
}) {
  const FEATURE_CHANNELS = featureChannels;

  return {
    getFeatureCatalog() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_FEATURE_CATALOG);
    },
    openOperationsActivityManagement(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_OPERATIONS_ACTIVITY_MANAGEMENT, payload);
    },
    openOperationsTrafficBoost(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_OPERATIONS_TRAFFIC_BOOST, payload);
    },
    openOperationsPriceDeclaration(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_OPERATIONS_PRICE_DECLARATION, payload);
    },
    openOperationsNewProductLifecycle(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_OPERATIONS_NEW_PRODUCT_LIFECYCLE, payload);
    },
    openMarketingTools(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_MARKETING_TOOLS, payload);
    },
    queryMarketingToolsSingleProductCouponRows(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.QUERY_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_ROWS,
        payload
      );
    },
    cancelMarketingToolsSingleProductCouponQuery(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_QUERY,
        payload
      );
    },
    getMarketingToolsSingleProductCouponBatchCouponSettings() {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.GET_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_BATCH_COUPON_SETTINGS
      );
    },
    saveMarketingToolsSingleProductCouponBatchCouponSettings(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SAVE_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_BATCH_COUPON_SETTINGS,
        payload
      );
    },
    createMarketingToolsSingleProductCouponBatchCoupons(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CREATE_MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_BATCH_COUPONS,
        payload
      );
    },
    onMarketingToolsSingleProductCouponProgress(listener) {
      return subscribe(FEATURE_CHANNELS.MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_PROGRESS, listener);
    },
    openGlobalCategorySync() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_GLOBAL_CATEGORY_SYNC);
    },
    openPromotionManager() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_PROMOTION_MANAGER);
    },
    openPodUploadSheetMiaoshou(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_POD_UPLOAD_SHEET_MIAOSHOU, payload);
    },
    openPodUploadSheetMiaoshouUniversal(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.OPEN_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL, payload);
    },
    ...createFeatureCenterOperationsPreloadApi({
      ipcRenderer,
      featureChannels: FEATURE_CHANNELS,
      subscribe
    }),
    getPromotionMonitorSnapshot() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_PROMOTION_MONITOR_SNAPSHOT);
    },
    setPromotionMonitorShopEnabled(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SET_PROMOTION_MONITOR_SHOP_ENABLED, payload);
    },
    setPromotionMonitorBatchActive(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SET_PROMOTION_MONITOR_BATCH_ACTIVE, payload);
    },
    getPromotionMonitorRuntimeLogs(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.GET_PROMOTION_MONITOR_RUNTIME_LOGS,
        toCloneablePayload(payload)
      );
    },
    clearPromotionMonitorRuntimeLogs() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CLEAR_PROMOTION_MONITOR_RUNTIME_LOGS);
    },
    getPromotionManagerNewCreateSettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_PROMOTION_MANAGER_NEW_CREATE_SETTINGS);
    },
    savePromotionManagerNewCreateSettings(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SAVE_PROMOTION_MANAGER_NEW_CREATE_SETTINGS,
        toCloneablePayload(payload)
      );
    },
    getPromotionManagerNewMonitorSettings() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_PROMOTION_MANAGER_NEW_MONITOR_SETTINGS);
    },
    savePromotionManagerNewMonitorSettings(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.SAVE_PROMOTION_MANAGER_NEW_MONITOR_SETTINGS,
        toCloneablePayload(payload)
      );
    },
    queryPromotionManagerNewGoods(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.QUERY_PROMOTION_MANAGER_NEW_GOODS,
        toCloneablePayload(payload)
      );
    },
    cancelPromotionManagerNewGoodsQuery(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_PROMOTION_MANAGER_NEW_GOODS_QUERY,
        toCloneablePayload(payload)
      );
    },
    queryPromotionManagerNewDetails(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.QUERY_PROMOTION_MANAGER_NEW_DETAILS,
        toCloneablePayload(payload)
      );
    },
    cancelPromotionManagerNewDetailsQuery(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_PROMOTION_MANAGER_NEW_DETAILS_QUERY,
        toCloneablePayload(payload)
      );
    },
    executePromotionManagerNewDetailActions(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.EXECUTE_PROMOTION_MANAGER_NEW_DETAIL_ACTIONS,
        toCloneablePayload(payload)
      );
    },
    cancelPromotionManagerNewDetailActions(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_PROMOTION_MANAGER_NEW_DETAIL_ACTIONS,
        toCloneablePayload(payload)
      );
    },
    createPromotionManagerNewAds(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CREATE_PROMOTION_MANAGER_NEW_ADS,
        toCloneablePayload(payload)
      );
    },
    cancelPromotionManagerNewAdsCreate(payload) {
      return ipcRenderer.invoke(
        FEATURE_CHANNELS.CANCEL_PROMOTION_MANAGER_NEW_ADS_CREATE,
        toCloneablePayload(payload)
      );
    },
    getRuntimeLogEntries(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_RUNTIME_LOG_ENTRIES, payload);
    },
    getPodUploadSheetMiaoshouCategories() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_CATEGORIES);
    },
    getPodUploadSheetMiaoshouTemplateSnapshot() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_TEMPLATE_SNAPSHOT);
    },
    syncPodUploadSheetMiaoshouTemplates() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SYNC_POD_UPLOAD_SHEET_MIAOSHOU_TEMPLATES);
    },
    getPodUploadSheetMiaoshouFormTemplates() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_FORM_TEMPLATES);
    },
    savePodUploadSheetMiaoshouFormTemplate(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_FORM_TEMPLATE, payload);
    },
    deletePodUploadSheetMiaoshouFormTemplate(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.DELETE_POD_UPLOAD_SHEET_MIAOSHOU_FORM_TEMPLATE, payload);
    },
    getPodUploadSheetMiaoshouWorkspaceState() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_WORKSPACE_STATE);
    },
    savePodUploadSheetMiaoshouWorkspaceState(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_WORKSPACE_STATE, payload);
    },
    selectPodUploadSheetMiaoshouImportDirectory(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SELECT_POD_UPLOAD_SHEET_MIAOSHOU_IMPORT_DIRECTORY, payload);
    },
    exportPodUploadSheetMiaoshouTable(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.EXPORT_POD_UPLOAD_SHEET_MIAOSHOU_TABLE, payload);
    },
    uploadPodUploadSheetMiaoshouCosImages(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.UPLOAD_POD_UPLOAD_SHEET_MIAOSHOU_COS_IMAGES, payload);
    },
    cancelPodUploadSheetMiaoshouCosImages(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_POD_UPLOAD_SHEET_MIAOSHOU_COS_IMAGES, payload);
    },
    getPodUploadSheetMiaoshouCosUploadProgressSnapshot(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_COS_UPLOAD_PROGRESS_SNAPSHOT, payload);
    },
    getPodUploadSheetMiaoshouAiTitleConfig() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_CONFIG);
    },
    savePodUploadSheetMiaoshouAiTitleConfig(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_CONFIG, payload);
    },
    generatePodUploadSheetMiaoshouAiTitles(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GENERATE_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLES, payload);
    },
    onPodUploadSheetMiaoshouAiTitleProgress(listener) {
      return subscribe(FEATURE_CHANNELS.POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_PROGRESS, listener);
    },
    cancelPodUploadSheetMiaoshouAiTitles(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLES, payload);
    },
    getPodUploadSheetMiaoshouUniversalTemplateSnapshot() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_TEMPLATE_SNAPSHOT);
    },
    syncPodUploadSheetMiaoshouUniversalTemplates() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SYNC_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_TEMPLATES);
    },
    getPodUploadSheetMiaoshouUniversalFormTemplates() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_FORM_TEMPLATES);
    },
    savePodUploadSheetMiaoshouUniversalFormTemplate(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_FORM_TEMPLATE, payload);
    },
    deletePodUploadSheetMiaoshouUniversalFormTemplate(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.DELETE_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_FORM_TEMPLATE, payload);
    },
    getPodUploadSheetMiaoshouUniversalWorkspaceState() {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_WORKSPACE_STATE);
    },
    savePodUploadSheetMiaoshouUniversalWorkspaceState(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_WORKSPACE_STATE, payload);
    },
    selectPodUploadSheetMiaoshouUniversalImportDirectory(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.SELECT_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_IMPORT_DIRECTORY, payload);
    },
    exportPodUploadSheetMiaoshouUniversalTable(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.EXPORT_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_TABLE, payload);
    },
    uploadPodUploadSheetMiaoshouUniversalCosImages(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.UPLOAD_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_COS_IMAGES, payload);
    },
    cancelPodUploadSheetMiaoshouUniversalCosImages(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.CANCEL_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_COS_IMAGES, payload);
    },
    getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot(payload) {
      return ipcRenderer.invoke(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_COS_UPLOAD_PROGRESS_SNAPSHOT, payload);
    }
  };
}

module.exports = {
  createFeatureCenterPreloadApi
};
