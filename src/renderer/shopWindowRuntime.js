(() => {
  const TAB_LABELS = Object.freeze({
    'seller-center': '\u5356\u5BB6\u4E2D\u5FC3',
    'product-promotion': '\u5546\u54C1\u63A8\u5E7F'
  });

  const WORKSPACE_URLS = Object.freeze({
    'seller-center': 'https://seller.kuajingmaihuo.com/',
    'product-promotion': 'https://ads.temu.com/index.html?adAreaOverride=2&source=2&seller_source=11'
  });

  const DEFAULT_BROWSER_TAB_ID = 'default';
  const MAX_BROWSER_TABS = 10;
  const STORAGE_TYPE_LABELS = Object.freeze({
    cookies: 'Cookies',
    localStorage: 'Local Storage',
    indexedDb: 'IndexedDB'
  });
  const AUTO_STORAGE_SYNC_TYPES = Object.freeze(Object.keys(STORAGE_TYPE_LABELS));

  const constants = Object.freeze({
    TAB_LABELS,
    WORKSPACE_URLS,
    DEFAULT_BROWSER_TAB_ID,
    MAX_BROWSER_TABS,
    STORAGE_TYPE_LABELS,
    AUTO_STORAGE_SYNC_TYPES,
    AUTO_STORAGE_SYNC_FULL_UPLOAD_TYPES: Object.freeze(AUTO_STORAGE_SYNC_TYPES.slice()),
    AUTO_STORAGE_SYNC_UPLOAD_TYPES: Object.freeze(['cookies']),
    AUTO_STORAGE_SYNC_PREOPEN_RESTORE_TYPES: Object.freeze(['cookies']),
    AUTO_STORAGE_SYNC_DEFERRED_RESTORE_TYPES: Object.freeze(['localStorage', 'indexedDb']),
    AUTO_STORAGE_SYNC_UPLOAD_DELAY_MS: 18000,
    AUTO_STORAGE_SYNC_RETRY_DELAY_MS: 45000,
    AUTO_STORAGE_SYNC_DEFERRED_RESTORE_DELAY_MS: 1600,
    AUTO_STORAGE_SYNC_HEARTBEAT_MS: 30000,
    AUTO_STORAGE_SYNC_KICKOFF_DEBOUNCE_MS: 220,
    AUTO_STORAGE_SYNC_INTERVAL_MS: 1800000,
    AUTO_STORAGE_SYNC_MIN_UPLOAD_GAP_MS: 60000,
    BROWSER_STORAGE_SYNC_STATE_CACHE_TTL_MS: 10000,
    TAB_STATUS_MESSAGE_DEDUP_MS: 1200,
    FAST_SESSION_PERSIST_DEBOUNCE_MS: 4000,
    NO_CLOUD_SNAPSHOT_MESSAGE:
      '\u4E91\u7AEF\u8FD8\u6CA1\u6709\u53EF\u6062\u590D\u7684\u6D4F\u89C8\u5668\u5B58\u50A8\u6570\u636E\u3002'
  });

  function normalizeText(value) {
    return value == null ? '' : String(value).trim();
  }

  function normalizeWorkspaceComparableValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeWorkspaceComparableValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        const normalizedValue = normalizeWorkspaceComparableValue(value[key]);

        if (normalizedValue !== undefined) {
          result[key] = normalizedValue;
        }

        return result;
      }, {});
    }

    if (value === undefined || typeof value === 'function') {
      return undefined;
    }

    if (value === null || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    return normalizeText(value);
  }

  function buildWorkspaceEnvironmentKey(payload) {
    try {
      return JSON.stringify(normalizeWorkspaceComparableValue({
        proxyConfig: payload && payload.proxyConfig ? payload.proxyConfig : {},
        fingerprintConfig: payload && payload.fingerprintConfig ? payload.fingerprintConfig : {}
      }));
    } catch (_error) {
      return '';
    }
  }

  function createEmptyBrowserStorageSyncState(shopId = '') {
    return {
      shopId: normalizeText(shopId),
      origins: [],
      storageTypes: Object.keys(STORAGE_TYPE_LABELS),
      localSummary: null,
      cloudSummary: null
    };
  }

  function createEmptyBrowserStorageAutoSyncRuntime(shopId = '') {
    return {
      shopId: normalizeText(shopId),
      uploadTimer: 0,
      retryTimer: 0,
      deferredRestoreTimer: 0,
      restorePromise: null,
      uploadPromise: null,
      lastCookieRestoreRevision: '',
      lastFullRestoreRevision: '',
      lastRestoreAt: '',
      lastUploadAt: '',
      lastUploadAtMs: 0,
      lastFastPersistAtMs: 0,
      lastAutoError: '',
      lastAutoErrorAt: ''
    };
  }

  function getWorkspaceBounds(activeHost) {
    const hostRect = activeHost.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(activeHost);
    const insetLeft = (
      parseFloat(computedStyle.borderLeftWidth || '0')
      + parseFloat(computedStyle.paddingLeft || '0')
    );
    const insetTop = (
      parseFloat(computedStyle.borderTopWidth || '0')
      + parseFloat(computedStyle.paddingTop || '0')
    );
    const insetRight = (
      parseFloat(computedStyle.borderRightWidth || '0')
      + parseFloat(computedStyle.paddingRight || '0')
    );
    const insetBottom = (
      parseFloat(computedStyle.borderBottomWidth || '0')
      + parseFloat(computedStyle.paddingBottom || '0')
    );
    const width = Math.max(0, (Number(hostRect.width) || 0) - insetLeft - insetRight);
    const height = Math.max(0, (Number(hostRect.height) || 0) - insetTop - insetBottom);

    return {
      x: Math.round((hostRect.left || 0) + insetLeft),
      y: Math.round((hostRect.top || 0) + insetTop),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function cloneWorkspacePayload(payload) {
    const bounds = payload && payload.bounds
      ? {
        x: Number(payload.bounds.x) || 0,
        y: Number(payload.bounds.y) || 0,
        width: Number(payload.bounds.width) || 0,
        height: Number(payload.bounds.height) || 0
      }
      : null;

    return {
      visible: payload && payload.visible === true,
      overlayOpen: payload && payload.overlayOpen === true,
      shopId: normalizeText(payload && payload.shopId),
      pageType: normalizeText(payload && payload.pageType),
      browserTabId: normalizeText(payload && payload.browserTabId),
      autoLoginEnabled: payload && payload.autoLoginEnabled !== false,
      shopName: normalizeText(payload && payload.shopName),
      phoneNumber: normalizeText(payload && payload.phoneNumber),
      accountValue: normalizeText(payload && payload.accountValue),
      email: normalizeText(payload && payload.email),
      accountType: normalizeText(payload && payload.accountType),
      shopUpdatedAt: normalizeText(payload && payload.shopUpdatedAt),
      proxyConfig: payload && payload.proxyConfig ? { ...payload.proxyConfig } : {},
      fingerprintConfig: payload && payload.fingerprintConfig ? { ...payload.fingerprintConfig } : {},
      workspaceEnvironmentKey:
        normalizeText(payload && payload.workspaceEnvironmentKey)
        || buildWorkspaceEnvironmentKey(payload),
      bounds
    };
  }

  function areWorkspaceBoundsEqual(left, right) {
    return Boolean(
      left
      && right
      && left.x === right.x
      && left.y === right.y
      && left.width === right.width
      && left.height === right.height
    );
  }

  function areWorkspacePayloadsEqual(left, right) {
    if (!left || !right) {
      return false;
    }

    return (
      left.visible === right.visible
      && left.overlayOpen === right.overlayOpen
      && left.shopId === right.shopId
      && left.pageType === right.pageType
      && left.browserTabId === right.browserTabId
      && left.autoLoginEnabled === right.autoLoginEnabled
      && left.shopName === right.shopName
      && left.phoneNumber === right.phoneNumber
      && left.accountValue === right.accountValue
      && left.email === right.email
      && left.accountType === right.accountType
      && left.shopUpdatedAt === right.shopUpdatedAt
      && left.workspaceEnvironmentKey === right.workspaceEnvironmentKey
      && areWorkspaceBoundsEqual(left.bounds, right.bounds)
    );
  }

  window.shopWindowRuntime = {
    constants,
    createEmptyBrowserStorageSyncState,
    createEmptyBrowserStorageAutoSyncRuntime,
    getWorkspaceBounds,
    cloneWorkspacePayload,
    areWorkspaceBoundsEqual,
    areWorkspacePayloadsEqual
  };
})();
