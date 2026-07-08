function getStore() {
  if (window.shopManagementStore && typeof window.shopManagementStore === 'object') {
    return window.shopManagementStore;
  }

  throw new Error('\u5e97\u94fa\u7ba1\u7406\u901a\u4fe1\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\u3002');
}

export function getShopManagementBridge() {
  return getStore();
}
