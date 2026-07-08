function getFeatureCenterBridge() {
  if (window.temuApp && window.temuApp.featureCenter) {
    return window.temuApp.featureCenter;
  }
  throw new Error('功能中心通信初始化失败，请重新打开软件。');
}

const bridge = {
  getSnapshot() {
    return getFeatureCenterBridge().getOperationsProductGlobalCategorySyncSnapshot();
  },
  syncFromOnlineShop(payload) {
    return getFeatureCenterBridge().syncOperationsProductGlobalCategoryTreeFromOnlineShop(payload || {});
  }
};

export default bridge;
