(() => {
  function getBridge() {
    if (window.temuApp && window.temuApp.shopManagement) {
      return window.temuApp.shopManagement;
    }

    throw new Error('\u5E97\u94FA\u7BA1\u7406\u901A\u4FE1\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5173\u95ED\u8F6F\u4EF6\u540E\u91CD\u65B0\u6253\u5F00\u3002');
  }

  window.shopManagementStore = {
    getState() {
      return getBridge().getState();
    },
    syncCloudState() {
      return getBridge().syncCloudState();
    },
    getShopDetail(payload) {
      return getBridge().getShopDetail(payload);
    },
    setShopVisibility(payload) {
      return getBridge().setShopVisibility(payload);
    },
    addGroup(payload) {
      return getBridge().addGroup(payload);
    },
    updateGroup(payload) {
      return getBridge().updateGroup(payload);
    },
    deleteGroup(payload) {
      return getBridge().deleteGroup(payload);
    },
    addShop(payload) {
      return getBridge().addShop(payload);
    },
    updateShop(payload) {
      return getBridge().updateShop(payload);
    }
  };
})();
