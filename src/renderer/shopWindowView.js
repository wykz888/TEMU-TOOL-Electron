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
  const AUTO_STORAGE_SYNC_FULL_UPLOAD_TYPES = Object.freeze(AUTO_STORAGE_SYNC_TYPES.slice());
  const AUTO_STORAGE_SYNC_UPLOAD_TYPES = Object.freeze(['cookies']);
  const AUTO_STORAGE_SYNC_PREOPEN_RESTORE_TYPES = Object.freeze(['cookies']);
  const AUTO_STORAGE_SYNC_DEFERRED_RESTORE_TYPES = Object.freeze(['localStorage', 'indexedDb']);
  const AUTO_STORAGE_SYNC_UPLOAD_DELAY_MS = 18000;
  const AUTO_STORAGE_SYNC_RETRY_DELAY_MS = 45000;
  const AUTO_STORAGE_SYNC_DEFERRED_RESTORE_DELAY_MS = 1600;
  const AUTO_STORAGE_SYNC_HEARTBEAT_MS = 30000;
  const AUTO_STORAGE_SYNC_KICKOFF_DEBOUNCE_MS = 220;
  const AUTO_STORAGE_SYNC_INTERVAL_MS = 1800000;
  const AUTO_STORAGE_SYNC_MIN_UPLOAD_GAP_MS = 60000;
  const BROWSER_STORAGE_SYNC_STATE_CACHE_TTL_MS = 10000;
  const TAB_STATUS_MESSAGE_DEDUP_MS = 1200;
  const FAST_SESSION_PERSIST_DEBOUNCE_MS = 4000;
  const NO_CLOUD_SNAPSHOT_MESSAGE =
    '\u4E91\u7AEF\u8FD8\u6CA1\u6709\u53EF\u6062\u590D\u7684\u6D4F\u89C8\u5668\u5B58\u50A8\u6570\u636E\u3002';

  const viewState = {
    allShops: [],
    groups: [],
    shops: [],
    selectedGroupFilterId: '',
    selectedShopId: '',
    activeWorkspaceTab: 'seller-center',
    activeSection: 'shop-management',
    browserTabsByShopId: {},
    browserStorageSync: {
      statesByShopId: {},
      loadedAtByShopId: {},
      loadingByShopId: {},
      busyAction: '',
      busyShopId: ''
    }
  };

  let elements = null;
  let initialized = false;
  let mountPromise = null;
  let stylesheetPromise = null;
  let syncFrameId = 0;
  let resizeObserver = null;
  let deferredWorkspaceSyncTimer = 0;
  let lastVisibleWorkspacePayload = null;
  let lastDispatchedWorkspacePayload = null;
  let bridgeDisposers = [];
  let shopWindowAppController = null;
  let autoStorageSyncHeartbeatTimer = 0;
  let autoStorageSyncKickoffTimer = 0;
  let autoStorageSyncKickoffDelayMs = 0;
  let autoStorageSyncKickoffRunning = false;
  let pendingAutoStorageSyncReason = '';
  const autoStorageSyncRuntimeByShopId = Object.create(null);

  function ensureVueProcessShim() {
    if (!window.process || typeof window.process !== 'object') {
      window.process = {};
    }

    if (!window.process.env || typeof window.process.env !== 'object') {
      window.process.env = {};
    }

    if (typeof window.process.env.NODE_ENV !== 'string') {
      window.process.env.NODE_ENV = 'production';
    }
  }

  function ensureStylesheet() {
    if (stylesheetPromise) {
      return stylesheetPromise;
    }

    stylesheetPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('link[data-shop-window-app-style="true"]');

      if (existing) {
        resolve(existing);
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './shopWindowApp/dist/shop-window-app.css';
      link.dataset.shopWindowAppStyle = 'true';
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error('\u5e97\u94fa\u7a97\u53e3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002'));
      document.head.appendChild(link);
    });

    return stylesheetPromise;
  }

  function ensureMount() {
    if (!mountPromise) {
      ensureVueProcessShim();

      mountPromise = ensureStylesheet()
        .then(() => import('./shopWindowApp/dist/shop-window-app.js'))
        .then((module) => {
          if (!module || typeof module.mountShopWindowApp !== 'function') {
            throw new Error('\u5e97\u94fa\u7a97\u53e3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002');
          }

          shopWindowAppController = module.mountShopWindowApp('#shopWindowApp');
          configureShopWindowAppController();
          return shopWindowAppController;
        });
    }

    return mountPromise;
  }

  function getStore() {
    if (window.shopManagementStore) {
      return window.shopManagementStore;
    }

    throw new Error('\u5E97\u94FA\u5217\u8868\u6570\u636E\u52A0\u8F7D\u5931\u8D25\u3002');
  }

  function getBridge() {
    if (window.temuApp && window.temuApp.shopWindow) {
      return window.temuApp.shopWindow;
    }

    throw new Error('\u539F\u751F\u6D4F\u89C8\u5668\u901A\u4FE1\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\u3002');
  }

  function getAutoLoginStore() {
    if (window.shopWindowAutoLoginStore) {
      return window.shopWindowAutoLoginStore;
    }

    throw new Error('\u81EA\u52A8\u767B\u5F55\u672C\u5730\u7F13\u5B58\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\u3002');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return value == null ? '' : String(value).trim();
  }

  function formatTimestamp(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '-';
    }

    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
      return normalizedValue;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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

  function getBrowserStorageAutoSyncRuntime(shopId = '') {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return createEmptyBrowserStorageAutoSyncRuntime();
    }

    if (!autoStorageSyncRuntimeByShopId[normalizedShopId]) {
      autoStorageSyncRuntimeByShopId[normalizedShopId] =
        createEmptyBrowserStorageAutoSyncRuntime(normalizedShopId);
    }

    return autoStorageSyncRuntimeByShopId[normalizedShopId];
  }

  function clearBrowserStorageAutoSyncUploadTimer(shopId = '') {
    const normalizedShopId = normalizeText(shopId);
    const runtime = autoStorageSyncRuntimeByShopId[normalizedShopId];

    if (!runtime || !runtime.uploadTimer) {
      return;
    }

    window.clearTimeout(runtime.uploadTimer);
    runtime.uploadTimer = 0;
  }

  function clearBrowserStorageAutoSyncRetryTimer(shopId = '') {
    const normalizedShopId = normalizeText(shopId);
    const runtime = autoStorageSyncRuntimeByShopId[normalizedShopId];

    if (!runtime || !runtime.retryTimer) {
      return;
    }

    window.clearTimeout(runtime.retryTimer);
    runtime.retryTimer = 0;
  }

  function clearBrowserStorageAutoSyncDeferredRestoreTimer(shopId = '') {
    const normalizedShopId = normalizeText(shopId);
    const runtime = autoStorageSyncRuntimeByShopId[normalizedShopId];

    if (!runtime || !runtime.deferredRestoreTimer) {
      return;
    }

    window.clearTimeout(runtime.deferredRestoreTimer);
    runtime.deferredRestoreTimer = 0;
  }

  function clearAutoBrowserStorageSyncKickoffTimer() {
    if (!autoStorageSyncKickoffTimer) {
      return;
    }

    window.clearTimeout(autoStorageSyncKickoffTimer);
    autoStorageSyncKickoffTimer = 0;
    autoStorageSyncKickoffDelayMs = 0;
  }

  function clearAutoBrowserStoragePendingWorkExceptSelected() {
    const selectedShopId = normalizeText(viewState.selectedShopId);

    Object.keys(autoStorageSyncRuntimeByShopId).forEach((shopId) => {
      if (shopId === selectedShopId) {
        return;
      }

      clearBrowserStorageAutoSyncUploadTimer(shopId);
      clearBrowserStorageAutoSyncRetryTimer(shopId);
      clearBrowserStorageAutoSyncDeferredRestoreTimer(shopId);
    });
  }

  function collectElements() {
    if (typeof window.collectShopWindowElements !== 'function') {
      throw new Error('\u5e97\u94fa\u7a97\u53e3\u754c\u9762\u8282\u70b9\u91c7\u96c6\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\u3002');
    }

    return window.collectShopWindowElements();
  }

  function getSelectedShop() {
    return ensureShopListController().getSelectedShop();
  }

  function getShopById(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return null;
    }

    return viewState.allShops.find((shop) => normalizeText(shop && shop.id) === normalizedShopId) || null;
  }

  function getVisibleShops() {
    return viewState.allShops.filter((shop) => shop && shop.isVisible !== false);
  }

  function isBrowserStorageAutoSyncEnabled(shop) {
    return Boolean(shop) && shop.browserStorageAutoSyncEnabled !== false;
  }

  function getShopGroupName(shop) {
    return ensureShopListController().getShopGroupName(shop);
  }

  function getShopNoteText(shop) {
    return ensureShopListController().getShopNoteText(shop);
  }

  function matchesSelectedGroupFilter(shop) {
    return ensureShopListController().matchesSelectedGroupFilter(shop);
  }

  function buildGroupFilterOptions() {
    return ensureShopListController().buildGroupFilterOptions();
  }

  function isSelectedGroupFilterValid(options = buildGroupFilterOptions()) {
    return ensureShopListController().isSelectedGroupFilterValid(options);
  }

  function syncFilteredShops() {
    ensureShopListController().syncFilteredShops();
  }

  function isAutoLoginEnabled(shopId, pageType) {
    return getAutoLoginStore().getPreference(shopId, pageType);
  }

  function createDefaultBrowserTab(pageType) {
    return {
      id: DEFAULT_BROWSER_TAB_ID,
      title: `${TAB_LABELS[pageType] || '\u6D4F\u89C8\u5668'} 1`,
      url: WORKSPACE_URLS[pageType] || '',
      closable: false
    };
  }

  function createPageBrowserState(pageType) {
    const defaultTab = createDefaultBrowserTab(pageType);

    return {
      opened: false,
      activeBrowserTabId: defaultTab.id,
      tabs: [defaultTab]
    };
  }

  function updateClosableState(pageState) {
    const canCloseTabs = pageState.tabs.length > 1;
    pageState.tabs = pageState.tabs.map((tab) => ({
      ...tab,
      closable: canCloseTabs
    }));
  }

  function ensurePageBrowserState(shopId, pageType) {
    if (!shopId) {
      return createPageBrowserState(pageType);
    }

    if (!viewState.browserTabsByShopId[shopId]) {
      viewState.browserTabsByShopId[shopId] = {};
    }

    if (!viewState.browserTabsByShopId[shopId][pageType]) {
      viewState.browserTabsByShopId[shopId][pageType] = createPageBrowserState(pageType);
    }

    const pageState = viewState.browserTabsByShopId[shopId][pageType];

    if (!Array.isArray(pageState.tabs) || pageState.tabs.length === 0) {
      viewState.browserTabsByShopId[shopId][pageType] = createPageBrowserState(pageType);
      return viewState.browserTabsByShopId[shopId][pageType];
    }

    if (typeof pageState.opened !== 'boolean') {
      pageState.opened = false;
    }

    updateClosableState(pageState);
    return pageState;
  }

  function isPageBrowserOpened(shopId, pageType) {
    return ensurePageBrowserState(shopId, pageType).opened === true;
  }

  function setPageBrowserOpened(shopId, pageType, opened) {
    ensurePageBrowserState(shopId, pageType).opened = opened === true;
  }

  function getBrowserTabById(pageState, browserTabId) {
    return pageState.tabs.find((tab) => tab.id === browserTabId) || null;
  }

  function ensureActiveBrowserTab(shopId, pageType) {
    const pageState = ensurePageBrowserState(shopId, pageType);
    const activeTab = getBrowserTabById(pageState, pageState.activeBrowserTabId);

    if (!activeTab) {
      pageState.activeBrowserTabId = pageState.tabs[0].id;
    }

    return pageState;
  }

  function syncSelectedShop() {
    ensureShopListController().syncSelectedShop();
  }

  function isShopWorkspaceOpened(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return false;
    }

    return ['seller-center', 'product-promotion'].some(
      (pageType) => ensurePageBrowserState(normalizedShopId, pageType).opened === true
    );
  }

  function renderGroupFilterOptions() {
    ensureShopListController().renderGroupFilterOptions();
  }

  function renderShopList() {
    ensureShopListController().renderShopList();
  }

  function renderCurrentShop() {
    ensureShopListController().renderCurrentShop();
  }

  function getBrowserStorageBusyActionForShop(shopId = '') {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return '';
    }

    return viewState.browserStorageSync.busyShopId === normalizedShopId
      ? normalizeText(viewState.browserStorageSync.busyAction)
      : '';
  }

  function isAnyBrowserStorageSyncBusy() {
    return normalizeText(viewState.browserStorageSync.busyAction).length > 0;
  }

  function setBrowserStorageSyncBusyState(shopId, action) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedAction = normalizeText(action);

    if (
      viewState.browserStorageSync.busyShopId === normalizedShopId
      && normalizeText(viewState.browserStorageSync.busyAction) === normalizedAction
    ) {
      return;
    }

    viewState.browserStorageSync.busyShopId = normalizedShopId;
    viewState.browserStorageSync.busyAction = normalizedAction;
    renderBrowserStorageSyncUiForShop(normalizedShopId);
  }

  function clearBrowserStorageSyncBusyState(shopId, action) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedAction = normalizeText(action);
    const currentBusyShopId = normalizeText(viewState.browserStorageSync.busyShopId);
    const currentBusyAction = normalizeText(viewState.browserStorageSync.busyAction);

    if (!currentBusyShopId && !currentBusyAction) {
      return;
    }

    if (
      currentBusyShopId
      && currentBusyShopId !== normalizedShopId
    ) {
      return;
    }

    if (
      normalizedAction
      && currentBusyAction !== normalizedAction
    ) {
      return;
    }

    viewState.browserStorageSync.busyShopId = '';
    viewState.browserStorageSync.busyAction = '';
    renderBrowserStorageSyncUiForShop(normalizedShopId);
  }

  function getBrowserStorageSyncRevision(shop, cloudUpdatedAt = '') {
    return [
      normalizeText(shop && shop.updatedAt),
      normalizeText(cloudUpdatedAt)
    ].join('|');
  }

  function isNoCloudSnapshotError(error) {
    const message = normalizeText(error && error.message);

    return Boolean(message) && (
      message === NO_CLOUD_SNAPSHOT_MESSAGE
      || message.includes('\u8FD8\u6CA1\u6709\u53EF\u6062\u590D')
    );
  }

  function canAutoUploadShop(shop, options = {}) {
    const allowInactiveSection = options && options.allowInactiveSection === true;
    const allowHidden = options && options.allowHidden === true;

    if (!shop || !isBrowserStorageAutoSyncEnabled(shop)) {
      return false;
    }

    if (!allowInactiveSection && viewState.activeSection !== 'shop-window') {
      return false;
    }

    if (!allowHidden && !canSyncWorkspaceUi()) {
      return false;
    }

    return isShopWorkspaceOpened(shop.id);
  }

  function getCurrentBrowserStorageSyncState() {
    const selectedShop = getSelectedShop();

    if (!selectedShop) {
      return createEmptyBrowserStorageSyncState();
    }

    return viewState.browserStorageSync.statesByShopId[selectedShop.id]
      || createEmptyBrowserStorageSyncState(selectedShop.id);
  }

  function renderBrowserStorageSyncState() {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.renderStorageSyncStatus === 'function'
    ) {
      shopWindowAppController.renderStorageSyncStatus();
    }
  }

  function renderWorkspaceTabs() {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.renderWorkspaceTabs === 'function'
    ) {
      shopWindowAppController.renderWorkspaceTabs();
    }
  }

  function renderBrowserTabs() {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.renderBrowserTabs === 'function'
    ) {
      shopWindowAppController.renderBrowserTabs();
    }
  }

  function renderBrowserHosts() {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.renderBrowserHosts === 'function'
    ) {
      shopWindowAppController.renderBrowserHosts();
    }
  }

  function renderBrowserStorageSyncUi() {
    renderBrowserStorageSyncState();
    renderBrowserHosts();
  }

  function renderBrowserStorageSyncUiForShop(shopId = '') {
    const normalizedShopId = normalizeText(shopId);
    const selectedShopId = normalizeText(viewState.selectedShopId);

    if (normalizedShopId && normalizedShopId !== selectedShopId) {
      return;
    }

    renderBrowserStorageSyncUi();
  }

  function getActiveBrowserHost() {
    return elements.browserHosts[viewState.activeWorkspaceTab] || null;
  }

  function hideTabStatus() {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.hideTabStatus === 'function'
    ) {
      shopWindowAppController.hideTabStatus();
    }
  }

  function configureShopWindowAppController() {
    if (!shopWindowAppController) {
      return;
    }

    if (typeof shopWindowAppController.configureWorkspace === 'function') {
      shopWindowAppController.configureWorkspace({
        ensureActiveBrowserTab,
        ensurePageBrowserState,
        getBridge,
        getBrowserStorageBusyActionForShop,
        getSelectedShop,
        getViewState: () => viewState,
        hideTabStatus,
        kickOffAutoBrowserStorageSync,
        isPageBrowserOpened,
        normalizeText,
        openWorkspaceAfterStorageRestore,
        createDefaultBrowserTab,
        defaultBrowserTabId: DEFAULT_BROWSER_TAB_ID,
        maxBrowserTabs: MAX_BROWSER_TABS,
        scheduleAutoBrowserStorageUpload,
        render,
        tabLabels: TAB_LABELS,
        updateClosableState,
        showTabStatus
      });
    }

    if (typeof shopWindowAppController.configureShopList === 'function') {
      shopWindowAppController.configureShopList({
        clearBrowserStorageAutoSyncDeferredRestoreTimer,
        clearBrowserStorageAutoSyncRetryTimer,
        clearBrowserStorageAutoSyncUploadTimer,
        ensureActiveBrowserTab,
        ensurePageBrowserState,
        getBrowserTabById,
        getViewState: () => viewState,
        getVisibleShops,
        hideTabStatus,
        isAutoLoginEnabled,
        kickOffAutoBrowserStorageSync,
        normalizeText,
        refreshBrowserStorageSyncState,
        render,
        scheduleWorkspaceSync,
        setAutoLoginPreference(shopId, pageType, enabled) {
          return getAutoLoginStore().setPreference(shopId, pageType, enabled);
        },
        showTabStatus,
        tabLabels: TAB_LABELS
      });
    }

    if (typeof shopWindowAppController.configureUrlModal === 'function') {
      shopWindowAppController.configureUrlModal({
        openBrowserUrlInNewTab(payload) {
          return getBridge().openBrowserUrlInNewTab(payload);
        },
        onOpenStateChange() {
          scheduleWorkspaceSync();
        },
        showTabStatus
      });
    }

    if (typeof shopWindowAppController.configureStorageSyncStatus === 'function') {
      shopWindowAppController.configureStorageSyncStatus({
        getSelectedShop,
        getCurrentBrowserStorageSyncState,
        getBrowserStorageAutoSyncRuntime,
        createEmptyBrowserStorageAutoSyncRuntime,
        isBrowserStorageAutoSyncEnabled,
        getBrowserStorageBusyActionForShop,
        isBrowserStorageSyncStateLoading,
        formatTimestamp,
        scheduleDeferredWorkspaceSync,
        storageTypeLabels: STORAGE_TYPE_LABELS
      });
    }

    if (typeof shopWindowAppController.configureTabStatus === 'function') {
      shopWindowAppController.configureTabStatus({
        messageDedupMs: TAB_STATUS_MESSAGE_DEDUP_MS,
        scheduleDeferredWorkspaceSync
      });
    }
  }

  function isBrowserStorageSyncStateLoading(shopId = '') {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return false;
    }

    return Boolean(viewState.browserStorageSync.loadingByShopId[normalizedShopId]);
  }

  function ensureShopListController() {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.getSelectedShop === 'function'
      && typeof shopWindowAppController.renderShopList === 'function'
    ) {
      return shopWindowAppController;
    }

    throw new Error('\u5E97\u94FA\u7A97\u53E3\u5E97\u94FA\u5217\u8868\u63A7\u5236\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\u3002');
  }

  function openBrowserUrlModal(payload) {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.openBrowserUrlModal === 'function'
    ) {
      void shopWindowAppController.openBrowserUrlModal(payload);
    }
  }

  function isBrowserUrlModalOpen() {
    return Boolean(
      shopWindowAppController
      && typeof shopWindowAppController.isBrowserUrlModalOpen === 'function'
      && shopWindowAppController.isBrowserUrlModalOpen()
    );
  }

  function showTabStatus(payload) {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.showTabStatus === 'function'
    ) {
      shopWindowAppController.showTabStatus(payload);
    }
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
      shopId: String(payload && payload.shopId || '').trim(),
      pageType: String(payload && payload.pageType || '').trim(),
      browserTabId: String(payload && payload.browserTabId || '').trim(),
      autoLoginEnabled: payload && payload.autoLoginEnabled !== false,
      shopName: String(payload && payload.shopName || '').trim(),
      phoneNumber: String(payload && payload.phoneNumber || '').trim(),
      accountValue: String(payload && payload.accountValue || '').trim(),
      email: String(payload && payload.email || '').trim(),
      accountType: String(payload && payload.accountType || '').trim(),
      shopUpdatedAt: String(payload && payload.shopUpdatedAt || '').trim(),
      proxyConfig: payload && payload.proxyConfig ? { ...payload.proxyConfig } : {},
      fingerprintConfig: payload && payload.fingerprintConfig ? { ...payload.fingerprintConfig } : {},
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
      && areWorkspaceBoundsEqual(left.bounds, right.bounds)
    );
  }

  function dispatchWorkspaceUpdate(payload) {
    const normalizedPayload = cloneWorkspacePayload(payload);

    if (
      lastDispatchedWorkspacePayload
      && areWorkspacePayloadsEqual(lastDispatchedWorkspacePayload, normalizedPayload)
    ) {
      return;
    }

    lastDispatchedWorkspacePayload = normalizedPayload;
    getBridge().updateWorkspace(normalizedPayload);
  }

  function canSyncWorkspaceUi() {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  }

  function hideWorkspaceImmediately() {
    if (syncFrameId) {
      window.cancelAnimationFrame(syncFrameId);
      syncFrameId = 0;
    }

    if (deferredWorkspaceSyncTimer) {
      window.clearTimeout(deferredWorkspaceSyncTimer);
      deferredWorkspaceSyncTimer = 0;
    }

    lastVisibleWorkspacePayload = null;
    dispatchWorkspaceUpdate({
      visible: false
    });
  }

  function syncWorkspace() {
    syncFrameId = 0;

    if (!canSyncWorkspaceUi()) {
      hideWorkspaceImmediately();
      return;
    }

    const selectedShop = getSelectedShop();
    const isSectionActive = viewState.activeSection === 'shop-window';
    const activeHost = getActiveBrowserHost();
    const isUrlModalOpen = isBrowserUrlModalOpen();

    if (!isSectionActive || !selectedShop || !activeHost) {
      lastVisibleWorkspacePayload = null;
      dispatchWorkspaceUpdate({
        visible: false
      });
      return;
    }

    const pageState = ensureActiveBrowserTab(selectedShop.id, viewState.activeWorkspaceTab);
    const activeBrowserTab = getBrowserTabById(pageState, pageState.activeBrowserTabId);

    if (!activeBrowserTab || pageState.opened !== true) {
      lastVisibleWorkspacePayload = null;
      dispatchWorkspaceUpdate({
        visible: false
      });
      return;
    }

    if (isUrlModalOpen) {
      dispatchWorkspaceUpdate({
        visible: false,
        overlayOpen: true,
        shopId: selectedShop.id,
        pageType: viewState.activeWorkspaceTab,
        browserTabId: activeBrowserTab.id
      });
      return;
    }

    const bounds = getWorkspaceBounds(activeHost);

    if (bounds.width < 10 || bounds.height < 10) {
      if (lastVisibleWorkspacePayload) {
        dispatchWorkspaceUpdate(lastVisibleWorkspacePayload);
        return;
      }
      scheduleDeferredWorkspaceSync(120);
      return;
    }

    lastVisibleWorkspacePayload = {
      visible: true,
      shopId: selectedShop.id,
      shopName: selectedShop.shopName || '',
      phoneNumber: selectedShop.phoneNumber || selectedShop.accountValue || selectedShop.email || '',
      accountValue: selectedShop.accountValue || selectedShop.phoneNumber || selectedShop.email || '',
      email: selectedShop.email || '',
      accountType: selectedShop.accountType || '',
      shopUpdatedAt: selectedShop.updatedAt || '',
      proxyConfig: selectedShop.proxyConfig || {},
      fingerprintConfig: selectedShop.fingerprintConfig || {},
      autoLoginEnabled: isAutoLoginEnabled(selectedShop.id, viewState.activeWorkspaceTab),
      pageType: viewState.activeWorkspaceTab,
      browserTabId: activeBrowserTab.id,
      bounds
    };
    dispatchWorkspaceUpdate(lastVisibleWorkspacePayload);
  }

  function scheduleWorkspaceSync() {
    if (!canSyncWorkspaceUi()) {
      hideWorkspaceImmediately();
      return;
    }

    if (syncFrameId) {
      return;
    }

    syncFrameId = window.requestAnimationFrame(() => {
      syncWorkspace();
    });
  }

  function scheduleDeferredWorkspaceSync(delayMs = 80) {
    if (!canSyncWorkspaceUi()) {
      hideWorkspaceImmediately();
      return;
    }

    if (deferredWorkspaceSyncTimer) {
      window.clearTimeout(deferredWorkspaceSyncTimer);
    }

    deferredWorkspaceSyncTimer = window.setTimeout(() => {
      deferredWorkspaceSyncTimer = 0;
      scheduleWorkspaceSync();
    }, delayMs);
  }

  function render(options = {}) {
    syncFilteredShops();
    renderGroupFilterOptions();
    syncSelectedShop();
    clearAutoBrowserStoragePendingWorkExceptSelected();
    renderShopList();
    renderCurrentShop();
    renderBrowserStorageSyncState();
    renderWorkspaceTabs();
    renderBrowserTabs();
    renderBrowserHosts();

    if (options.syncWorkspace !== false) {
      scheduleWorkspaceSync();
    }
  }

  function applyState(state) {
    const allShops = Array.isArray(state && state.shops) ? state.shops.slice() : [];
    const groups = Array.isArray(state && state.groups) ? state.groups.slice() : [];

    viewState.allShops = allShops;
    viewState.groups = groups;
    syncFilteredShops();
    render();

    const selectedShop = getSelectedShop();

    if (selectedShop) {
      void refreshBrowserStorageSyncState(selectedShop.id);
    }

    void kickOffAutoBrowserStorageSync('state-applied');
  }

  async function refresh() {
    const state = await getStore().getState();
    applyState(state);
    return state;
  }

  async function refreshBrowserStorageSyncState(shopId, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const showError = options && options.showError === true;
    const forceRefresh = options && options.forceRefresh === true;

    if (!normalizedShopId) {
      return createEmptyBrowserStorageSyncState();
    }

    if (viewState.browserStorageSync.loadingByShopId[normalizedShopId]) {
      return viewState.browserStorageSync.loadingByShopId[normalizedShopId];
    }

    const cachedSnapshot = viewState.browserStorageSync.statesByShopId[normalizedShopId];
    const cachedLoadedAt = Math.max(
      0,
      Number(viewState.browserStorageSync.loadedAtByShopId[normalizedShopId]) || 0
    );

    if (
      !forceRefresh
      && cachedSnapshot
      && cachedLoadedAt > 0
      && Date.now() - cachedLoadedAt < BROWSER_STORAGE_SYNC_STATE_CACHE_TTL_MS
    ) {
      return cachedSnapshot;
    }

    const loadPromise = getBridge().getBrowserStorageSyncState({
      shopId: normalizedShopId
    })
      .then((snapshot) => {
        const normalizedSnapshot =
          snapshot && typeof snapshot === 'object'
            ? {
              shopId: normalizeText(snapshot.shopId) || normalizedShopId,
              origins: Array.isArray(snapshot.origins) ? snapshot.origins.slice() : [],
              storageTypes: Array.isArray(snapshot.storageTypes) ? snapshot.storageTypes.slice() : Object.keys(STORAGE_TYPE_LABELS),
              localSummary: snapshot.localSummary || null,
              cloudSummary: snapshot.cloudSummary || null
            }
            : createEmptyBrowserStorageSyncState(normalizedShopId);

        viewState.browserStorageSync.statesByShopId[normalizedShopId] = normalizedSnapshot;
        viewState.browserStorageSync.loadedAtByShopId[normalizedShopId] = Date.now();
        renderBrowserStorageSyncUiForShop(normalizedShopId);
        return normalizedSnapshot;
      })
      .catch((error) => {
        if (showError) {
          showTabStatus({
            message: error && error.message ? error.message : '\u6D4F\u89C8\u5668\u5B58\u50A8\u540C\u6B65\u72B6\u6001\u52A0\u8F7D\u5931\u8D25\u3002',
            persistent: true
          });
        }

        return createEmptyBrowserStorageSyncState(normalizedShopId);
      })
      .finally(() => {
        delete viewState.browserStorageSync.loadingByShopId[normalizedShopId];
        renderBrowserStorageSyncUiForShop(normalizedShopId);
      });

    viewState.browserStorageSync.loadingByShopId[normalizedShopId] = loadPromise;
    renderBrowserStorageSyncUiForShop(normalizedShopId);
    return loadPromise;
  }

  function scheduleAutoBrowserStorageSyncRetry(shopId, delayMs = AUTO_STORAGE_SYNC_RETRY_DELAY_MS) {
    const normalizedShopId = normalizeText(shopId);
    const runtime = getBrowserStorageAutoSyncRuntime(normalizedShopId);

    clearBrowserStorageAutoSyncRetryTimer(normalizedShopId);

    runtime.retryTimer = window.setTimeout(() => {
      runtime.retryTimer = 0;

      if (normalizedShopId !== normalizeText(viewState.selectedShopId)) {
        return;
      }

      void kickOffAutoBrowserStorageSync('retry');
    }, Math.max(1200, Number(delayMs) || AUTO_STORAGE_SYNC_RETRY_DELAY_MS));
  }

  function isBrowserStorageContextNotReadyError(error) {
    const message = normalizeText(error && error.message);

    return /browser.*context.*not.*ready/i.test(message)
      || /\u6d4f\u89c8\u5668\u4e0a\u4e0b\u6587\u672a\u5c31\u7eea/i.test(message)
      || /\u5e97\u94fa\u6d4f\u89c8\u5668\u4e0a\u4e0b\u6587\u672a\u5c31\u7eea/i.test(message);
  }

  function looksLikeWorkspaceReadyMessage(message) {
    const normalizedMessage = normalizeText(message);

    if (!normalizedMessage) {
      return false;
    }

    return (
      /\u5df2\u7ecf\u767b\u5f55\u6210\u529f/.test(normalizedMessage)
      || /\u6b63\u5728\u8df3\u8f6c\u5230\u5356\u5bb6\u4e3b\u9875/.test(normalizedMessage)
      || /\u5df2\u8fdb\u5165.*\u5168\u7403\u540e\u53f0/.test(normalizedMessage)
      || /\u5f53\u524d\u5df2\u5728.*\u540e\u53f0/.test(normalizedMessage)
    );
  }

  async function persistBrowserSessionNow(shopId, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shop = getShopById(normalizedShopId);

    if (!shop || !isBrowserStorageAutoSyncEnabled(shop)) {
      return null;
    }

    const runtime = getBrowserStorageAutoSyncRuntime(normalizedShopId);
    const now = Date.now();
    const minGapMs = Math.max(0, Number(options && options.minGapMs) || FAST_SESSION_PERSIST_DEBOUNCE_MS);

    if (!options.force && runtime.lastFastPersistAtMs > 0 && now - runtime.lastFastPersistAtMs < minGapMs) {
      return null;
    }

    runtime.lastFastPersistAtMs = now;

    try {
      const result = await getBridge().persistBrowserSessionNow({
        shopId: normalizedShopId,
        pageType: normalizeText(options && options.pageType) || viewState.activeWorkspaceTab || 'seller-center',
        reason: normalizeText(options && options.reason) || 'fast-persist',
        syncToCloud: options && options.syncToCloud !== false,
        types: ['cookies', 'localStorage', 'indexedDb']
      });

      runtime.lastAutoError = '';
      runtime.lastAutoErrorAt = '';

      await refreshBrowserStorageSyncState(normalizedShopId, {
        forceRefresh: true
      });

      return result;
    } catch (error) {
      runtime.lastAutoError = normalizeText(error && error.message) || '\u4f1a\u8bdd\u4fdd\u5b58\u5931\u8d25';
      runtime.lastAutoErrorAt = new Date().toISOString();
      render({
        syncWorkspace: false
      });
      return null;
    }
  }

  function scheduleAutoBrowserStorageUpload(shopId, reason = '', delayMs = AUTO_STORAGE_SYNC_UPLOAD_DELAY_MS, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shop = getShopById(normalizedShopId);

    if (!shop || !canAutoUploadShop(shop, options)) {
      clearBrowserStorageAutoSyncUploadTimer(normalizedShopId);
      return;
    }

    const runtime = getBrowserStorageAutoSyncRuntime(normalizedShopId);
    const elapsedMs = runtime.lastUploadAtMs > 0 ? Date.now() - runtime.lastUploadAtMs : AUTO_STORAGE_SYNC_MIN_UPLOAD_GAP_MS;
    const minDelayMs = elapsedMs >= AUTO_STORAGE_SYNC_MIN_UPLOAD_GAP_MS
      ? 0
      : AUTO_STORAGE_SYNC_MIN_UPLOAD_GAP_MS - elapsedMs;
    const nextDelayMs = Math.max(Number(delayMs) || 0, minDelayMs);

    clearBrowserStorageAutoSyncUploadTimer(normalizedShopId);

    runtime.uploadTimer = window.setTimeout(() => {
      runtime.uploadTimer = 0;

      const currentShop = getShopById(normalizedShopId);

      if (!currentShop || !canAutoUploadShop(currentShop, options)) {
        return;
      }

      if (
        runtime.restorePromise
        || runtime.uploadPromise
        || runtime.deferredRestoreTimer
        || isAnyBrowserStorageSyncBusy()
      ) {
        scheduleAutoBrowserStorageUpload(
          normalizedShopId,
          reason || 'busy-retry',
          AUTO_STORAGE_SYNC_RETRY_DELAY_MS,
          options
        );
        return;
      }

      runtime.uploadPromise = executeAutoBrowserStorageSyncAction(
        normalizedShopId,
        'upload',
        options
      ).finally(() => {
        runtime.uploadPromise = null;
      });
    }, nextDelayMs);
  }

  function scheduleDeferredBrowserStorageRestore(
    shopId,
    reason = '',
    delayMs = AUTO_STORAGE_SYNC_DEFERRED_RESTORE_DELAY_MS
  ) {
    const normalizedShopId = normalizeText(shopId);
    const shop = getShopById(normalizedShopId);

    if (!shop || !isBrowserStorageAutoSyncEnabled(shop) || !isShopWorkspaceOpened(normalizedShopId)) {
      clearBrowserStorageAutoSyncDeferredRestoreTimer(normalizedShopId);
      return;
    }

    const runtime = getBrowserStorageAutoSyncRuntime(normalizedShopId);

    clearBrowserStorageAutoSyncUploadTimer(normalizedShopId);
    clearBrowserStorageAutoSyncDeferredRestoreTimer(normalizedShopId);

    runtime.deferredRestoreTimer = window.setTimeout(() => {
      runtime.deferredRestoreTimer = 0;

      const currentShop = getShopById(normalizedShopId);

      if (
        !currentShop
        || !isBrowserStorageAutoSyncEnabled(currentShop)
        || !isShopWorkspaceOpened(normalizedShopId)
      ) {
        return;
      }

      if (
        runtime.restorePromise
        || runtime.uploadPromise
        || runtime.deferredRestoreTimer
        || isAnyBrowserStorageSyncBusy()
      ) {
        scheduleDeferredBrowserStorageRestore(
          normalizedShopId,
          reason || 'deferred-busy-retry',
          AUTO_STORAGE_SYNC_RETRY_DELAY_MS
        );
        return;
      }

      runtime.restorePromise = executeAutoBrowserStorageSyncAction(
        normalizedShopId,
        'restore',
        {
          reason,
          restoreScope: 'deferred-storage',
          types: AUTO_STORAGE_SYNC_DEFERRED_RESTORE_TYPES.slice()
        }
      ).finally(() => {
        runtime.restorePromise = null;
      });
    }, Math.max(400, Number(delayMs) || AUTO_STORAGE_SYNC_DEFERRED_RESTORE_DELAY_MS));
  }

  function waitForMs(delayMs) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
    });
  }

  async function ensureFullBrowserStorageRestoreForShop(shopId, reason = '', options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shop = getShopById(normalizedShopId);

    if (!shop || !isBrowserStorageAutoSyncEnabled(shop)) {
      return null;
    }

    const runtime = getBrowserStorageAutoSyncRuntime(normalizedShopId);

    if (runtime.restorePromise) {
      return runtime.restorePromise;
    }

    const snapshot = await refreshBrowserStorageSyncState(normalizedShopId);
    const cloudUpdatedAt = normalizeText(snapshot && snapshot.cloudSummary && snapshot.cloudSummary.updatedAt);
    const hasCloudSnapshot = Boolean(cloudUpdatedAt);
    const nextRevision = getBrowserStorageSyncRevision(shop, cloudUpdatedAt);

    const restoreTypes = Array.isArray(options && options.types) && options.types.length > 0
      ? options.types.slice()
      : AUTO_STORAGE_SYNC_PREOPEN_RESTORE_TYPES.slice();
    const restoreScope = normalizeText(options && options.restoreScope)
      || (restoreTypes.length === AUTO_STORAGE_SYNC_TYPES.length ? 'full' : 'cookies-only');
    const strictOpen = options && options.strictOpen === true;
    const retryDelayMs = Math.max(800, Number(options && options.retryDelayMs) || 1200);
    const timeoutMs = Math.max(10000, Number(options && options.timeoutMs) || 90000);
    const revisionFieldName = restoreScope === 'full'
      ? 'lastFullRestoreRevision'
      : 'lastCookieRestoreRevision';
    const isRestoreCompleted = () => runtime[revisionFieldName] === nextRevision;

    if (isRestoreCompleted()) {
      return {
        ready: true,
        restoreScope,
        usedCloudRestore: hasCloudSnapshot,
        reason: 'already-restored'
      };
    }

    showTabStatus({
      message: '\u9996\u6b21\u6253\u5f00\u524d\u6b63\u5728\u51c6\u5907\u5de5\u4f5c\u533a\uff1a1/2 \u68c0\u67e5\u767b\u5f55\u72b6\u6001\uff0c2/2 \u6062\u590d\u6d4f\u89c8\u5668\u5b58\u50a8...',
      persistent: true
    });

    const runRestoreAttempt = async () => {
      runtime.restorePromise = executeAutoBrowserStorageSyncAction(
        normalizedShopId,
        'restore',
        {
          reason,
          restoreScope,
          types: restoreTypes
        }
      ).finally(() => {
        runtime.restorePromise = null;
      });

      return runtime.restorePromise;
    };

    let restoreResult = await runRestoreAttempt();

    if (isRestoreCompleted() || (restoreResult && restoreResult.skippedFullRestore === true)) {
      return {
        ready: true,
        restoreScope,
        usedCloudRestore: hasCloudSnapshot,
        reason: restoreResult && restoreResult.skippedFullRestore === true
          ? 'restore-skipped-session-ready'
          : 'restored',
        result: restoreResult || null
      };
    }

    if (restoreResult && restoreResult.success === false) {
      return {
        ready: false,
        restoreScope,
        usedCloudRestore: hasCloudSnapshot,
        reason: 'restore-failed',
        result: restoreResult
      };
    }

    if (!strictOpen || !hasCloudSnapshot) {
      return {
        ready: !hasCloudSnapshot,
        restoreScope,
        usedCloudRestore: hasCloudSnapshot,
        reason: hasCloudSnapshot ? 'restore-pending' : 'no-cloud-snapshot',
        result: restoreResult || null
      };
    }

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await waitForMs(retryDelayMs);

      if (isRestoreCompleted()) {
        return {
          ready: true,
          restoreScope,
          usedCloudRestore: true,
          reason: 'restored-after-wait',
          result: restoreResult || null
        };
      }

      restoreResult = await runRestoreAttempt();

      if (isRestoreCompleted() || (restoreResult && restoreResult.skippedFullRestore === true)) {
        return {
          ready: true,
          restoreScope,
          usedCloudRestore: true,
          reason: restoreResult && restoreResult.skippedFullRestore === true
            ? 'restore-skipped-session-ready'
            : 'restored-after-retry',
          result: restoreResult || null
        };
      }

      if (restoreResult && restoreResult.success === false) {
        showTabStatus({
          message: '\u4E91\u7AEF\u6D4F\u89C8\u5668\u6570\u636E\u6062\u590d\u672A\u5B8C\u6574\u6210\u529F\uff0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002',
          persistent: true
        });
        return {
          ready: false,
          restoreScope,
          usedCloudRestore: true,
          reason: 'restore-failed-after-retry',
          result: restoreResult
        };
      }
    }

    showTabStatus({
      message: '\u6B63\u5728\u7B49\u5F85\u4E91\u7AEF\u6D4F\u89C8\u5668\u6570\u636E\u5B8C\u6210\u6062\u590d\uff0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002',
      persistent: true
    });

    return {
      ready: false,
      restoreScope,
      usedCloudRestore: true,
      reason: 'restore-timeout',
      result: restoreResult || null
    };
  }

  async function openWorkspaceAfterStorageRestore(shopId, pageType, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedPageType = normalizeText(pageType) || 'seller-center';
    const shop = getShopById(normalizedShopId);

    if (!shop || !normalizedPageType) {
      return false;
    }

    const pageState = ensureActiveBrowserTab(normalizedShopId, normalizedPageType);
    const requestedBrowserTabId = normalizeText(options && options.browserTabId);

    if (requestedBrowserTabId) {
      pageState.activeBrowserTabId = requestedBrowserTabId;
    }

    if (!getBrowserTabById(pageState, pageState.activeBrowserTabId)) {
      pageState.activeBrowserTabId = pageState.tabs[0].id;
    }

    if (
      isBrowserStorageAutoSyncEnabled(shop)
      && !isShopWorkspaceOpened(normalizedShopId)
    ) {
      const restoreState = await ensureFullBrowserStorageRestoreForShop(
        normalizedShopId,
        normalizeText(options && options.restoreReason) || 'workspace-open-intent',
        {
          restoreScope: 'cookies-only',
          types: AUTO_STORAGE_SYNC_PREOPEN_RESTORE_TYPES.slice()
        }
      );

      if (restoreState && restoreState.ready !== true) {
        const restoreReason = normalizeText(restoreState && restoreState.reason);

        if (restoreReason === 'restore-timeout') {
          return false;
        }

        showTabStatus({
          message: '\u4E91\u7AEF\u6D4F\u89C8\u5668\u6570\u636E\u6682\u65F6\u672A\u5B8C\u6574\u6062\u590D\uFF0C\u5C06\u5148\u6253\u5F00\u5DE5\u4F5C\u533A\uFF0C\u5269\u4F59\u6570\u636E\u540E\u53F0\u7EE7\u7EED\u6062\u590D\u3002',
          durationMs: 3600,
          persistent: false
        });
      }
    }

    if (
      normalizeText(viewState.selectedShopId) !== normalizedShopId
      || !getShopById(normalizedShopId)
    ) {
      return false;
    }

    setPageBrowserOpened(normalizedShopId, normalizedPageType, true);
    hideTabStatus();
    render();
    void kickOffAutoBrowserStorageSync(
      normalizeText(options && options.syncReason) || 'workspace-opened'
    );
    return true;
  }

  async function executeAutoBrowserStorageSyncAction(shopId, direction, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shop = getShopById(normalizedShopId);

    if (!shop || !isBrowserStorageAutoSyncEnabled(shop)) {
      return null;
    }

    const runtime = getBrowserStorageAutoSyncRuntime(normalizedShopId);
    const busyAction = direction === 'restore' ? 'auto-restore' : 'auto-upload';
    const actionTimestamp = new Date().toISOString();
    const selectedTypes = Array.isArray(options && options.types) && options.types.length > 0
      ? options.types.slice()
      : (
        direction === 'upload'
          ? AUTO_STORAGE_SYNC_UPLOAD_TYPES.slice()
          : AUTO_STORAGE_SYNC_TYPES.slice()
      );
    const restoreScope = normalizeText(options && options.restoreScope) || 'full';
    const isFullRestore = direction === 'restore' && restoreScope === 'full';
    const skipRestoreWhenLocalSessionReady =
      direction === 'restore'
        ? options && options.skipRestoreWhenLocalSessionReady !== false
        : false;
    const skipCookieRestoreWhenSessionOnline =
      direction === 'restore'
        ? (
          Object.prototype.hasOwnProperty.call(options || {}, 'skipCookieRestoreWhenSessionOnline')
            ? options.skipCookieRestoreWhenSessionOnline !== false
            : true
        )
        : true;

    clearBrowserStorageAutoSyncRetryTimer(normalizedShopId);
    clearBrowserStorageAutoSyncDeferredRestoreTimer(normalizedShopId);
    setBrowserStorageSyncBusyState(normalizedShopId, busyAction);

    try {
      const result = direction === 'restore'
        ? await getBridge().restoreBrowserStorageFromCloud({
          shopId: normalizedShopId,
          types: selectedTypes,
          reloadActiveView: false,
          reason: normalizeText(options && options.reason) || restoreScope || 'auto-restore',
          skipCookieRestoreWhenSessionOnline,
          skipRestoreWhenLocalSessionReady
        })
        : await getBridge().syncBrowserStorageToCloud({
          shopId: normalizedShopId,
          types: selectedTypes
        });
      const summaryUpdatedAt = normalizeText(
        result && result.summary && result.summary.updatedAt
      );

      runtime.lastAutoError = '';
      runtime.lastAutoErrorAt = '';
      const nextRevision = getBrowserStorageSyncRevision(shop, summaryUpdatedAt);

      if (direction === 'restore') {
        if (result && result.skippedFullRestore) {
          runtime.lastCookieRestoreRevision = nextRevision;
          runtime.lastFullRestoreRevision = nextRevision;
        } else if (restoreScope === 'cookies-only') {
          runtime.lastCookieRestoreRevision = nextRevision;
        } else {
          runtime.lastCookieRestoreRevision = nextRevision;
          runtime.lastFullRestoreRevision = nextRevision;
        }
        runtime.lastRestoreAt = actionTimestamp;
      } else {
        if (selectedTypes.includes('cookies')) {
          runtime.lastCookieRestoreRevision = nextRevision;
        }

        if (
          selectedTypes.includes('localStorage')
          || selectedTypes.includes('indexedDb')
        ) {
          runtime.lastFullRestoreRevision = nextRevision;
        }

        runtime.lastUploadAt = actionTimestamp;
        runtime.lastUploadAtMs = Date.now();
      }

      await refreshBrowserStorageSyncState(normalizedShopId, {
        forceRefresh: true
      });

      if (direction === 'restore') {
        if (isFullRestore) {
          showTabStatus({
            message: '\u6d4f\u89c8\u5668\u767b\u5f55\u72b6\u6001\u4e0e\u672c\u5730\u5b58\u50a8\u5df2\u6062\u590d\u5b8c\u6210\u3002',
            durationMs: 2200,
            persistent: false
          });
        }
        scheduleAutoBrowserStorageUpload(
          normalizedShopId,
          'restore-finished',
          AUTO_STORAGE_SYNC_UPLOAD_DELAY_MS
        );
      }

      return result;
    } catch (error) {
      if (direction === 'restore' && isNoCloudSnapshotError(error)) {
        runtime.lastAutoError = '';
        runtime.lastAutoErrorAt = '';
        runtime.lastCookieRestoreRevision = getBrowserStorageSyncRevision(shop, '');
        runtime.lastFullRestoreRevision = getBrowserStorageSyncRevision(shop, '');
        render({
          syncWorkspace: false
        });

        scheduleAutoBrowserStorageUpload(
          normalizedShopId,
          'no-cloud-snapshot',
          AUTO_STORAGE_SYNC_UPLOAD_DELAY_MS
        );

        if (isFullRestore) {
          showTabStatus({
            message: '\u672A\u627E\u5230\u53EF\u6062\u590D\u7684\u4E91\u7AEF\u5FEB\u7167\uff0c\u5C06\u76F4\u63A5\u6253\u5F00\u5F53\u524D\u5DE5\u4F5C\u533A\u3002',
            durationMs: 2600,
            persistent: false
          });
        }

        return null;
      }

      if (isBrowserStorageContextNotReadyError(error)) {
        runtime.lastAutoError = '';
        runtime.lastAutoErrorAt = '';
        scheduleAutoBrowserStorageSyncRetry(normalizedShopId, AUTO_STORAGE_SYNC_RETRY_DELAY_MS);

        if (isFullRestore) {
          showTabStatus({
            message: '\u6d4f\u89c8\u5668\u73af\u5883\u8fd8\u5728\u51c6\u5907\uff0c\u6062\u590d\u4efb\u52a1\u5df2\u8f6c\u4e3a\u7a0d\u540e\u7ee7\u7eed\u3002',
            durationMs: 2600,
            persistent: false
          });
        }
        return null;
      }

      runtime.lastAutoError = normalizeText(error && error.message)
        || '\u81EA\u52A8\u540C\u6B65\u5931\u8D25';
      runtime.lastAutoErrorAt = actionTimestamp;
      render({
        syncWorkspace: false
      });
      showTabStatus({
        message: `\u81EA\u52A8\u540C\u6B65\u6682\u65F6\u672A\u6210\u529F\uFF1A${runtime.lastAutoError}`,
        durationMs: 4200,
        persistent: false
      });
      scheduleAutoBrowserStorageSyncRetry(normalizedShopId);
      return null;
    } finally {
      clearBrowserStorageSyncBusyState(normalizedShopId, busyAction);

      if (direction !== 'restore') {
        void kickOffAutoBrowserStorageSync('action-finished');
      }
    }
  }

  async function runAutoBrowserStorageSync(reason = '') {
    const selectedShop = getSelectedShop();

    if (
      !selectedShop
      || !isBrowserStorageAutoSyncEnabled(selectedShop)
      || viewState.activeSection !== 'shop-window'
      || !canSyncWorkspaceUi()
    ) {
      return;
    }

    const runtime = getBrowserStorageAutoSyncRuntime(selectedShop.id);

    if (runtime.restorePromise || runtime.uploadPromise || isAnyBrowserStorageSyncBusy()) {
      return;
    }

    const snapshot = await refreshBrowserStorageSyncState(selectedShop.id);
    const cloudUpdatedAt = normalizeText(snapshot && snapshot.cloudSummary && snapshot.cloudSummary.updatedAt);
    const nextRevision = getBrowserStorageSyncRevision(selectedShop, cloudUpdatedAt);

    if (!isShopWorkspaceOpened(selectedShop.id)) {
      if (runtime.lastFullRestoreRevision === nextRevision) {
        return;
      }

      runtime.restorePromise = ensureFullBrowserStorageRestoreForShop(
        selectedShop.id,
        reason || 'preopen-restore'
      );
      return;
    }

    if (runtime.lastFullRestoreRevision !== nextRevision) {
      if (runtime.deferredRestoreTimer) {
        return;
      }

      scheduleDeferredBrowserStorageRestore(
        selectedShop.id,
        reason || 'workspace-opened',
        AUTO_STORAGE_SYNC_DEFERRED_RESTORE_DELAY_MS
      );
      return;
    }

    scheduleAutoBrowserStorageUpload(
      selectedShop.id,
      reason || 'workspace-active',
      AUTO_STORAGE_SYNC_UPLOAD_DELAY_MS
    );
  }

  function kickOffAutoBrowserStorageSync(reason = '', options = {}) {
    const normalizedReason = normalizeText(reason);
    const immediate = options && options.immediate === true;
    const requestedDelayMs = Math.max(
      0,
      Number(options && options.delayMs)
        || (immediate ? 0 : AUTO_STORAGE_SYNC_KICKOFF_DEBOUNCE_MS)
    );

    if (normalizedReason) {
      pendingAutoStorageSyncReason = normalizedReason;
    }

    if (autoStorageSyncKickoffRunning) {
      return;
    }

    if (
      autoStorageSyncKickoffTimer
      && requestedDelayMs >= autoStorageSyncKickoffDelayMs
    ) {
      return;
    }

    clearAutoBrowserStorageSyncKickoffTimer();
    autoStorageSyncKickoffDelayMs = requestedDelayMs;

    autoStorageSyncKickoffTimer = window.setTimeout(() => {
      const nextReason = pendingAutoStorageSyncReason || normalizedReason;

      autoStorageSyncKickoffTimer = 0;
      autoStorageSyncKickoffDelayMs = 0;
      pendingAutoStorageSyncReason = '';
      autoStorageSyncKickoffRunning = true;

      runAutoBrowserStorageSync(nextReason)
        .catch(() => null)
        .finally(() => {
          autoStorageSyncKickoffRunning = false;

          if (pendingAutoStorageSyncReason) {
            kickOffAutoBrowserStorageSync('', {
              delayMs: AUTO_STORAGE_SYNC_KICKOFF_DEBOUNCE_MS
            });
          }
        });
    }, requestedDelayMs);
  }

  function startAutoBrowserStorageSyncHeartbeat() {
    if (autoStorageSyncHeartbeatTimer) {
      return;
    }

    autoStorageSyncHeartbeatTimer = window.setInterval(() => {
      const selectedShop = getSelectedShop();

      if (
        !selectedShop
        || !isBrowserStorageAutoSyncEnabled(selectedShop)
        || viewState.activeSection !== 'shop-window'
        || !canSyncWorkspaceUi()
        || !isShopWorkspaceOpened(selectedShop.id)
      ) {
        return;
      }

      const runtime = getBrowserStorageAutoSyncRuntime(selectedShop.id);

      if (
        runtime.restorePromise
        || runtime.uploadPromise
        || runtime.uploadTimer
        || runtime.retryTimer
        || runtime.deferredRestoreTimer
        || isAnyBrowserStorageSyncBusy()
      ) {
        return;
      }

      const elapsedMs = runtime.lastUploadAtMs > 0
        ? Date.now() - runtime.lastUploadAtMs
        : Number.MAX_SAFE_INTEGER;

      if (elapsedMs >= AUTO_STORAGE_SYNC_INTERVAL_MS) {
        scheduleAutoBrowserStorageUpload(
          selectedShop.id,
          'heartbeat',
          1200
        );
      }
    }, AUTO_STORAGE_SYNC_HEARTBEAT_MS);
  }

  function handleBrowserTabCreated(payload) {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.handleBrowserTabCreated === 'function'
    ) {
      shopWindowAppController.handleBrowserTabCreated(payload);
    }
  }

  function handleBrowserTabClosed(payload) {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.handleBrowserTabClosed === 'function'
    ) {
      shopWindowAppController.handleBrowserTabClosed(payload);
    }
  }

  function handleBrowserTabUpdated(payload) {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.handleBrowserTabUpdated === 'function'
    ) {
      shopWindowAppController.handleBrowserTabUpdated(payload);
    }
  }

  function handleBrowserTabReset(payload) {
    if (
      shopWindowAppController
      && typeof shopWindowAppController.handleBrowserTabReset === 'function'
    ) {
      shopWindowAppController.handleBrowserTabReset(payload);
    }
  }

  function handleBrowserTabMessage(payload) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageType = normalizeText(payload && payload.pageType) || viewState.activeWorkspaceTab || 'seller-center';
    const message = normalizeText(payload && payload.message);

    if (
      shopId
      && shopId === normalizeText(viewState.selectedShopId)
      && looksLikeWorkspaceReadyMessage(message)
    ) {
      void persistBrowserSessionNow(shopId, {
        reason: 'workspace-ready-message',
        pageType,
        minGapMs: FAST_SESSION_PERSIST_DEBOUNCE_MS
      });
    }

    showTabStatus(payload || '');
  }

  function handleBrowserUrlInputRequested(payload) {
    openBrowserUrlModal(payload || {});
  }

  function bindResizeTracking() {
    resizeObserver = new ResizeObserver(() => {
      scheduleWorkspaceSync();
    });

    [
      ...Object.values(elements.browserHosts),
      ...elements.panels,
      ...Object.values(elements.browserTabLists),
      elements.sectionPanel,
      elements.mainPanel,
      elements.workspaceRoot,
      elements.currentShopName,
      elements.currentShopMeta,
      elements.statusRow,
      elements.storageSyncShell,
      elements.storageSyncSummary,
      elements.tabStatus
    ]
      .filter((element) => element instanceof Element)
      .forEach((element) => {
        resizeObserver.observe(element);
      });

    window.addEventListener('resize', scheduleWorkspaceSync);
    window.addEventListener('scroll', () => {
      scheduleDeferredWorkspaceSync(140);
    }, {
      capture: true,
      passive: true
    });
  }

  function bindBridgeEvents() {
    bridgeDisposers = [
      getBridge().onBrowserTabCreated((payload) => {
        handleBrowserTabCreated(payload);
      }),
      getBridge().onBrowserTabClosed((payload) => {
        handleBrowserTabClosed(payload);
      }),
      getBridge().onBrowserTabUpdated((payload) => {
        handleBrowserTabUpdated(payload);
      }),
      getBridge().onBrowserTabReset((payload) => {
        handleBrowserTabReset(payload);
      }),
      getBridge().onBrowserTabMessage((payload) => {
        handleBrowserTabMessage(payload);
      }),
      getBridge().onBrowserUrlInputRequested((payload) => {
        handleBrowserUrlInputRequested(payload);
      }),
      getBridge().onWorkspaceSyncRequested(() => {
        scheduleWorkspaceSync();
        scheduleDeferredWorkspaceSync();
      })
    ];
  }

  function bindEvents() {
    bindResizeTracking();
    bindBridgeEvents();

    window.addEventListener('shop-management:state-changed', (event) => {
      applyState(event.detail);
    });

    window.addEventListener('app:section-changed', (event) => {
      const previousSection = viewState.activeSection;
      viewState.activeSection =
        event && event.detail && event.detail.sectionId ? event.detail.sectionId : 'shop-management';
      scheduleWorkspaceSync();

      if (previousSection === 'shop-window' && viewState.activeSection !== 'shop-window') {
        const selectedShop = getSelectedShop();

        if (selectedShop) {
          scheduleAutoBrowserStorageUpload(
            selectedShop.id,
            'leave-shop-window',
            1200,
            {
              allowInactiveSection: true,
              types: AUTO_STORAGE_SYNC_FULL_UPLOAD_TYPES.slice()
            }
          );
        }
        return;
      }

      if (viewState.activeSection === 'shop-window') {
        void kickOffAutoBrowserStorageSync('section-entered');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (canSyncWorkspaceUi()) {
        scheduleWorkspaceSync();
        void kickOffAutoBrowserStorageSync('window-visible');
        return;
      }

      const selectedShop = getSelectedShop();

      if (selectedShop) {
        scheduleAutoBrowserStorageUpload(
          selectedShop.id,
          'window-hidden',
          1200,
          {
            allowInactiveSection: true,
            allowHidden: true,
            types: AUTO_STORAGE_SYNC_FULL_UPLOAD_TYPES.slice()
          }
        );
      }
      hideWorkspaceImmediately();
    });
    window.addEventListener('beforeunload', () => {
      const selectedShop = getSelectedShop();

      if (selectedShop && isShopWorkspaceOpened(selectedShop.id)) {
        void persistBrowserSessionNow(selectedShop.id, {
          reason: 'window-beforeunload',
          pageType: viewState.activeWorkspaceTab || 'seller-center',
          force: true,
          syncToCloud: true
        });
      }

      Object.keys(autoStorageSyncRuntimeByShopId).forEach((shopId) => {
        clearBrowserStorageAutoSyncUploadTimer(shopId);
        clearBrowserStorageAutoSyncRetryTimer(shopId);
        clearBrowserStorageAutoSyncDeferredRestoreTimer(shopId);
      });

      clearAutoBrowserStorageSyncKickoffTimer();
      pendingAutoStorageSyncReason = '';
      autoStorageSyncKickoffRunning = false;

      if (autoStorageSyncHeartbeatTimer) {
        window.clearInterval(autoStorageSyncHeartbeatTimer);
        autoStorageSyncHeartbeatTimer = 0;
      }
    });
  }

  async function init() {
    await ensureMount();

    if (initialized) {
      await refresh();
      kickOffAutoBrowserStorageSync('reinit', {
        immediate: true
      });
      return;
    }

    elements = collectElements();
    bindEvents();
    await refresh();
    startAutoBrowserStorageSyncHeartbeat();
    kickOffAutoBrowserStorageSync('init', {
      immediate: true
    });
    initialized = true;
  }

  window.shopWindowView = {
    init,
    refresh
  };
})();
