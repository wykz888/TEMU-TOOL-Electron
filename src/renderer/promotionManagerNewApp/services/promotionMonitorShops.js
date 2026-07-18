import {
  buildPromotionMonitorShopRows
} from '../view-models/promotionMonitorShopRows.js';

function resolveShopManagementBridge() {
  return window.temuApp && window.temuApp.shopManagement
    ? window.temuApp.shopManagement
    : null;
}

export async function loadPromotionMonitorShopRows(
  shopManagementBridge = resolveShopManagementBridge()
) {
  const getState = shopManagementBridge && shopManagementBridge.getState;

  if (typeof getState !== 'function') {
    throw new Error('\u5e97\u94fa\u6570\u636e\u6a21\u5757\u672a\u52a0\u8f7d');
  }

  return buildPromotionMonitorShopRows(await getState.call(shopManagementBridge));
}
