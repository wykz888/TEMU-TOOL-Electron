(() => {
  const STORAGE_KEY = 'temu_toolbox_shop_window_auto_login_v1';
  const PAGE_TYPES = Object.freeze({
    SELLER_CENTER: 'seller-center',
    PRODUCT_PROMOTION: 'product-promotion'
  });

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizePageType(pageType) {
    return normalizeText(pageType) === PAGE_TYPES.PRODUCT_PROMOTION
      ? PAGE_TYPES.PRODUCT_PROMOTION
      : PAGE_TYPES.SELLER_CENTER;
  }

  function readState() {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      const parsedValue = rawValue ? JSON.parse(rawValue) : {};

      return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
    } catch (_error) {
      return {};
    }
  }

  function writeState(nextState) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState || {}));
    } catch (_error) {
      // Ignore local cache write failures.
    }
  }

  function getPreference(shopId, pageType) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return true;
    }

    const state = readState();
    const shopSettings = state[normalizedShopId];
    const normalizedPageType = normalizePageType(pageType);

    if (!shopSettings || typeof shopSettings !== 'object') {
      return true;
    }

    return shopSettings[normalizedPageType] !== false;
  }

  function setPreference(shopId, pageType, enabled) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return true;
    }

    const state = readState();
    const normalizedPageType = normalizePageType(pageType);
    const nextEnabled = enabled !== false;

    state[normalizedShopId] = {
      ...(state[normalizedShopId] && typeof state[normalizedShopId] === 'object'
        ? state[normalizedShopId]
        : {}),
      [normalizedPageType]: nextEnabled
    };

    writeState(state);
    return nextEnabled;
  }

  window.shopWindowAutoLoginStore = {
    getPreference,
    setPreference
  };
})();
