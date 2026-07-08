export function getPromotionManagerBridge() {
  if (window.temuApp && window.temuApp.featureCenter) {
    return window.temuApp.featureCenter;
  }

  throw new Error('推广大师通信未就绪。');
}

export function getThemeBridge() {
  if (window.temuApp && window.temuApp.theme) {
    return window.temuApp.theme;
  }

  throw new Error('主题配色通信未就绪。');
}

// 获取推广大师设置
export async function loadPromotionManagerSettings() {
  const bridge = getPromotionManagerBridge();
  return bridge.getPromotionManagerSettings();
}

// 保存推广大师设置
export async function savePromotionManagerSettings(settings) {
  const bridge = getPromotionManagerBridge();
  return bridge.savePromotionManagerSettings(settings);
}

// 获取监控快照
export async function getPromotionMonitorSnapshot() {
  const bridge = getPromotionManagerBridge();
  return bridge.getPromotionMonitorSnapshot();
}

// 设置单个店铺监控开关
export async function setPromotionMonitorShopEnabled(shopId, enabled) {
  const bridge = getPromotionManagerBridge();
  return bridge.setPromotionMonitorShopEnabled({ shopId, enabled });
}

// 批量开关监控
export async function setPromotionMonitorBatchActive(active) {
  const bridge = getPromotionManagerBridge();
  return bridge.setPromotionMonitorBatchActive({ enabled: active });
}

// 获取运行时日志
export async function getRuntimeLogEntries(params) {
  const bridge = getPromotionManagerBridge();
  return bridge.getRuntimeLogEntries(params);
}
