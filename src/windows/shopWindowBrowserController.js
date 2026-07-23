const fs = require('node:fs');
const { WebContentsView, session } = require('electron');
const crypto = require('node:crypto');
const {
  buildShopBrowserEnvironment,
  buildEnvironmentSignature,
  buildViewWebPreferences,
  applyPartitionEnvironment,
  applyViewEnvironment
} = require('./shopWindowBrowserEnvironment');
const {
  hasCompleteAuthConfig,
  isLoginAutofillUrl,
  buildLoginAutofillHelperSignature,
  buildEnsureLoginAutofillHelperScript,
  buildIsLoginAutofillHelperReadyScript,
  buildRunInstalledLoginAutofillScript,
  buildCollectInstalledLoginDebugSnapshotScript
} = require('./shopWindowLoginAutofill');
const {
  buildSellerCenterAuthenticationEntryScript
} = require('./shopWindowAuthenticationEntry');
const { buildShopMallSwitchScript } = require('./shopWindowMallSwitch');
const { buildPageLocationNavigationScript } = require('./shopWindowPageNavigation');
const {
  buildProductPromotionActivityLoginOpenerBridgeScript,
  buildProductPromotionBridgeLoginScript
} = require('./shopWindowProductPromotionBridge');
const {
  buildPopupMessageCaptureOpenerBridgeScript,
  buildPopupMessageDispatchScript
} = require('./shopWindowPopupMessageBridge');
const { buildSellerCenterLandingScript } = require('./shopWindowSellerCenterLanding');
const {
  buildSellerRegionContextRequestScript
} = require('./shopWindowSellerRegionSwitch');
const {
  installWebContentsDebugShortcuts,
  openDevTools,
  reloadContents
} = require('./installWebContentsDebugShortcuts');
const {
  buildViewLoadErrorPageDataUrl,
  describeViewLoadFailure,
  isBrowserLoadErrorPageUrl
} = require('./shopWindowViewLoadErrorPage');
const {
  getLegacyPartition,
  getPartition,
  getPartitionDirectory
} = require('./shopWindowPartitionIdentity');
const { attachShopWindowContextMenu } = require('./shopWindowContextMenu');
const {
  hasRuntimeEnvironmentPayload,
  isRuntimeEnvironmentPayloadChanged,
  resolveWorkspaceEnvironmentKey
} = require('./shopWindowEnvironmentSignature');
const { SHOP_WINDOW_CHANNELS } = require('../ipc/shopWindowChannels');
const {
  normalizeText,
  resolveAccountIdentity
} = require('../services/shopManagement/common');

const WORKSPACE_URLS = Object.freeze({
  'seller-center': 'https://seller.kuajingmaihuo.com/',
  'product-promotion': 'https://ads.temu.com/index.html?adAreaOverride=2&source=2&seller_source=11'
});

const WORKSPACE_LABELS = Object.freeze({
  'seller-center': '\u5356\u5BB6\u4E2D\u5FC3',
  'product-promotion': '\u5546\u54C1\u63A8\u5E7F'
});

const SELLER_CENTER_PORTAL_URL = 'https://seller.kuajingmaihuo.com/';
const PRODUCT_PROMOTION_HOME_REQUIRED_URL = WORKSPACE_URLS['product-promotion'];
const PRODUCT_PROMOTION_ACTIVITY_ENTRY_URL = 'https://ads.temu.com/';
const PRODUCT_PROMOTION_ACTIVITY_LOGIN_URL = `https://ads.temu.com/login.html?redirectUrl=${encodeURIComponent(
  PRODUCT_PROMOTION_HOME_REQUIRED_URL
)}`;
const PRODUCT_PROMOTION_ACTIVITY_BRIDGE_HASH_KEY = 'ttb_activity_login';
const POPUP_MESSAGE_BRIDGE_HASH_KEY = 'ttb_popup_message';
const DEFAULT_SELLER_AUTH_ORIGIN = 'https://agentseller.temu.com';
const SELLER_AUTH_USER_INFO_PATH = '/api/seller/auth/userInfo';
const SELLER_CENTER_MMS_USER_INFO_PATH = '/bg/quiet/api/mms/userInfo';

const SELLER_CENTER_HOST_PATTERNS = Object.freeze([
  /(^|\.)agentseller(?:-[a-z]+)?\.temu\.com$/i
]);

const AUTHENTICATION_HOST_PATTERNS = SELLER_CENTER_HOST_PATTERNS;

const AUTHENTICATION_PATH_PATTERNS = Object.freeze([
  /^\/(?:main|auth)\/authentication$/i
]);

const SELLER_CENTER_RELATED_HOST_PATTERNS = Object.freeze([
  ...SELLER_CENTER_HOST_PATTERNS,
  /(^|\.)seller\.kuajingmaihuo\.com$/i
]);

const ADS_HOST_PATTERNS = Object.freeze([
  /(^|\.)ads\.temu\.com$/i
]);

const SELLER_OAUTH_HOST_PATTERNS = Object.freeze([
  /(^|\.)seller\.temu\.com$/i
]);

const PRODUCT_PROMOTION_RELATED_HOST_PATTERNS = Object.freeze([
  ...ADS_HOST_PATTERNS,
  /(^|\.)seller\.kuajingmaihuo\.com$/i,
  ...SELLER_OAUTH_HOST_PATTERNS
]);

const ADS_LOGIN_PATH_PATTERNS = Object.freeze([
  /^\/login\.html$/i
]);

const SELLER_OAUTH_PATH_PATTERNS = Object.freeze([
  /^\/oauth\.html$/i
]);

const DEFAULT_BROWSER_TAB_ID = 'default';
const MAX_BROWSER_TABS_PER_PAGE = 10;
const MAX_INACTIVE_PAGE_VIEW_CACHE = 4;
const WINDOW_WORKSPACE_SYNC_DELAY_MS = 80;
const LOGIN_AUTOMATION_FOLLOW_UP_LIMIT = 4;
const LOGIN_AUTOMATION_FOLLOW_UP_DELAY_MS = 2200;
const LOGIN_AUTOMATION_MIN_INJECTION_GAP_MS = 900;
const LOGIN_AUTOMATION_AUTH_REDIRECT_DEBOUNCE_MS = 8000;
const LOGIN_AUTOMATION_AUTH_REDIRECT_WINDOW_MS = 180000;
const LOGIN_AUTOMATION_AUTH_REDIRECT_LIMIT = 4;
const LOGIN_AUTOMATION_AUTH_LOOP_COOLDOWN_MS = 45000;
const LOGIN_DEBUG_SNAPSHOT_THROTTLE_MS = 5000;
const LOGIN_AUTOMATION_QUEUE_RESCHEDULE_MARGIN_MS = 60;
const LOGIN_AUTOMATION_RESULT_LOG_THROTTLE_MS = 4000;
const LOGIN_AUTOFILL_AUTH_CONFIG_REFRESH_THROTTLE_MS = 2500;
const SELLER_SESSION_RESULT_LOG_THROTTLE_MS = 20000;
const AUTHENTICATION_ENTRY_MIN_GAP_MS = 1200;
const AUTHENTICATION_ENTRY_FOLLOW_UP_DELAY_MS = 2800;
const AUTHENTICATION_ENTRY_HOLD_MS = 8000;
const AUTHENTICATION_ENTRY_BACKGROUND_RETRY_MS = 2200;
const AUTHENTICATION_ENTRY_FALLBACK_COOLDOWN_MS = 10000;
const AUTHENTICATION_ENTRY_NO_NAVIGATION_REPEAT_WINDOW_MS = 30000;
const AUTHENTICATION_ENTRY_FOREGROUND_NO_NAVIGATION_HOLD_MS = 20000;
const LOGIN_PAGE_SESSION_STATUS_CHECK_MIN_GAP_MS = 4000;
const SELLER_SESSION_STATUS_INITIAL_DELAY_MS = 6000;
const SELLER_SESSION_STATUS_CHECK_INTERVAL_MS = 90000;
const SELLER_SESSION_STATUS_ERROR_RETRY_MS = 30000;
const SELLER_MALL_SWITCH_DEBOUNCE_MS = 180000;
const SELLER_CENTER_SITE_MAIN_MIN_ACTION_GAP_MS = 1200;
const SELLER_CENTER_SITE_MAIN_POPUP_HOLD_MS = 18000;
const SELLER_CENTER_SITE_MAIN_READY_RETRY_LIMIT = 12;
const SELLER_CENTER_AUTH_HOME_POPUP_REUSE_WINDOW_MS = 20000;
const SELLER_AUTH_SESSION_REQUEST_TIMEOUT_MS = 15000;
const VIEW_LOAD_MAX_AUTO_RETRY_COUNT = 2;
const VIEW_LOAD_RETRY_DELAY_MS = 1400;
const SELLER_CENTER_GLOBAL_SESSION_READY_TIMEOUT_MS = 90000;
const SELLER_CENTER_GLOBAL_SESSION_POLL_INTERVAL_MS = 1500;
const BACKGROUND_BROWSER_STORAGE_RESTORE_RETRY_COOLDOWN_MS = 60000;
const SHOP_ENVIRONMENT_APPLY_SLOW_LOG_THRESHOLD_MS = 300;
const VIEW_LOAD_RETRYABLE_ERROR_CODES = new Set([
  -2,
  -7,
  -100,
  -101,
  -102,
  -105,
  -106,
  -109,
  -111,
  -118,
  -130
]);
const ENABLE_SELLER_SESSION_STATUS_PROBE = false;
const WINDOW_CLOSE_GUARD_SCRIPT = `
  (() => {
    const guardKey = '__temuToolboxWindowCloseGuardInstalled';

    if (window[guardKey]) {
      return {
        status: 'already-installed'
      };
    }

    const blockedClose = () => undefined;

    try {
      Object.defineProperty(window, guardKey, {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false
      });
    } catch (_error) {
      window[guardKey] = true;
    }

    try {
      window.close = blockedClose;
    } catch (_error) {
      // Ignore window.close override failures.
    }

    try {
      self.close = blockedClose;
    } catch (_error) {
      // Ignore self.close override failures.
    }

    return {
      status: 'installed'
    };
  })();
`;

const LOGIN_AUTOMATION_PHASES = Object.freeze({
  IDLE: 'idle',
  REDIRECTING_LOGIN: 'redirecting-login',
  LOGIN_PAGE: 'login-page',
  SUBMITTING: 'submitting',
  WAITING_MANUAL_VERIFICATION: 'waiting-manual-verification',
  COOLDOWN: 'cooldown',
  AUTHENTICATED: 'authenticated'
});

const SHOP_MATCH_STATES = Object.freeze({
  MATCHED: 'matched',
  AMBIGUOUS: 'ambiguous',
  MISSING: 'missing'
});

function createShopWindowBrowserController(mainWindow, options = {}) {
  const shopEntriesById = new Map();
  const attachedViews = new WeakSet();
  const loginAutofillTimers = new WeakMap();
  const sellerSessionStatusTimers = new WeakMap();
  const automationStates = new WeakMap();
  const viewLoadStates = new WeakMap();
  let activeDescriptor = null;
  let workspaceUpdateToken = 0;
  let workspaceSyncTimer = 0;
  const runtimeLogger = options.runtimeLogger || null;
  const loadShopRuntimeProfile =
    typeof options.loadShopRuntimeProfile === 'function'
      ? options.loadShopRuntimeProfile
      : null;
  const getBrowserStorageSyncService =
    typeof options.getBrowserStorageSyncService === 'function'
      ? options.getBrowserStorageSyncService
      : null;
  const onPlatformShopIdResolved =
    typeof options.onPlatformShopIdResolved === 'function'
      ? options.onPlatformShopIdResolved
      : null;

  function isWindowAlive() {
    return Boolean(mainWindow && !mainWindow.isDestroyed());
  }

  function notifyRenderer(channel, payload) {
    if (!isWindowAlive()) {
      return;
    }

    try {
      mainWindow.webContents.send(channel, payload);
    } catch (_error) {
      // Ignore renderer notification failures when the window is closing.
    }
  }

  function notifyResolvedPlatformShopId(shopEntry, platformShopId, platformShopUniqueId) {
    if (!onPlatformShopIdResolved) {
      return;
    }

    const shopId = normalizeText(shopEntry && shopEntry.shopId);
    const normalizedPlatformShopId = normalizeText(platformShopId);
    const normalizedPlatformShopUniqueId = normalizeText(platformShopUniqueId);

    if (!shopId || (!normalizedPlatformShopId && !normalizedPlatformShopUniqueId)) {
      return;
    }

    const identityKey = `${normalizedPlatformShopId}|${normalizedPlatformShopUniqueId}`;

    if (normalizeText(shopEntry && shopEntry.lastResolvedPlatformShopIdentityKey) === identityKey) {
      return;
    }

    if (shopEntry) {
      shopEntry.lastResolvedPlatformShopId = normalizedPlatformShopId;
      shopEntry.lastResolvedPlatformShopIdentityKey = identityKey;
    }

    Promise.resolve(onPlatformShopIdResolved({
      shopId,
      platformShopId: normalizedPlatformShopId,
      platformShopUniqueId: normalizedPlatformShopUniqueId
    })).catch((error) => {
      console.error('Failed to persist resolved platform shop id:', error);
    });
  }

  function persistPopupResolvedPlatformShopIdentity(shopEntry, popupMessage) {
    const platformShopId = normalizeText(
      popupMessage && (
        popupMessage.mallId
        || popupMessage.platformShopId
      )
    );
    const platformShopUniqueId = normalizeText(
      popupMessage && (
        popupMessage.uniqueId
        || popupMessage.mallUniqueId
        || popupMessage.platformShopUniqueId
      )
    );

    if (!platformShopId && !platformShopUniqueId) {
      return false;
    }

    notifyResolvedPlatformShopId(shopEntry, platformShopId, platformShopUniqueId);

    log('shop_popup_message_platform_shop_identity_resolved', {
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      platformShopId,
      platformShopUniqueId,
      messageScene: normalizeText(popupMessage && popupMessage.scene),
      messageAction: Number(popupMessage && popupMessage.action) || 0
    });

    return true;
  }

  function clearWorkspaceSyncTimer() {
    if (!workspaceSyncTimer) {
      return;
    }

    clearTimeout(workspaceSyncTimer);
    workspaceSyncTimer = 0;
  }

  function requestRendererWorkspaceSync(reason = 'window-layout-change') {
    if (!isWindowAlive() || mainWindow.isMinimized() === true || mainWindow.isVisible() === false) {
      return;
    }

    clearWorkspaceSyncTimer();
    workspaceSyncTimer = setTimeout(() => {
      workspaceSyncTimer = 0;
      notifyRenderer(SHOP_WINDOW_CHANNELS.REQUEST_WORKSPACE_SYNC, {
        reason
      });
    }, WINDOW_WORKSPACE_SYNC_DELAY_MS);
  }

  function handleMainWindowLayoutChange() {
    requestRendererWorkspaceSync();
  }

  if (isWindowAlive()) {
    mainWindow.on('resize', handleMainWindowLayoutChange);
    mainWindow.on('maximize', handleMainWindowLayoutChange);
    mainWindow.on('unmaximize', handleMainWindowLayoutChange);
    mainWindow.on('restore', handleMainWindowLayoutChange);
    mainWindow.on('show', handleMainWindowLayoutChange);
    mainWindow.on('enter-full-screen', handleMainWindowLayoutChange);
    mainWindow.on('leave-full-screen', handleMainWindowLayoutChange);
  }

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function getBrowserStorageSyncServiceSafe() {
    return getBrowserStorageSyncService
      ? getBrowserStorageSyncService()
      : null;
  }

  function notifyBrowserTabMessage(context, message, options = {}) {
    if (
      !context
      || context.suppressRendererNotifications === true
      || !normalizeText(message)
    ) {
      return;
    }

    notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, {
      shopId: context.shopId,
      pageType: context.pageType,
      message,
      durationMs: options.durationMs,
      persistent: options.persistent === true
    });
  }

  function clearBrowserTabMessage(context) {
    if (!context || context.suppressRendererNotifications === true) {
      return;
    }

    notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, {
      shopId: context.shopId,
      pageType: context.pageType,
      message: ''
    });
  }

  function notifyManualVerificationRequired(context) {
    notifyBrowserTabMessage(
      context,
      '\u68C0\u6d4b\u5230\u9a8c\u8bc1\u7801\u6216\u4e8c\u6b21\u9a8c\u8bc1\uff0c\u8bf7\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u624b\u52a8\u5b8c\u6210\u767b\u5f55\u3002\u81ea\u52a8\u6d41\u7a0b\u5df2\u6682\u505c\u3002',
      {
        persistent: true
      }
    );
  }

  function notifyBrowserTabReset(shopId, pageTypes) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedPageTypes = Array.isArray(pageTypes)
      ? pageTypes.map((pageType) => normalizeText(pageType)).filter(Boolean)
      : [];

    if (!normalizedShopId || normalizedPageTypes.length === 0) {
      return;
    }

    notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_RESET, {
      shopId: normalizedShopId,
      pageTypes: normalizedPageTypes
    });
  }

  function normalizeManualBrowserUrl(value) {
    const rawValue = normalizeText(value);

    if (!rawValue) {
      return '';
    }

    const candidateUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue)
      ? rawValue
      : `https://${rawValue}`;

    try {
      const parsedUrl = new URL(candidateUrl);
      const protocol = normalizeText(parsedUrl.protocol).toLowerCase();

      if (
        protocol !== 'http:'
        && protocol !== 'https:'
      ) {
        return '';
      }

      return parsedUrl.toString();
    } catch (_error) {
      return '';
    }
  }

  function buildProxySummary(proxyConfig) {
    const type = normalizeText(proxyConfig && proxyConfig.type).toLowerCase();
    const host = normalizeText(proxyConfig && proxyConfig.host);
    const port = normalizeText(proxyConfig && proxyConfig.port);
    const hasAuth = Boolean(
      normalizeText(proxyConfig && proxyConfig.username)
      || normalizeText(proxyConfig && proxyConfig.password)
    );

    if (!type || type === 'local' || !host || !port) {
      return '\u672c\u5730\u76f4\u8fde';
    }

    return `${type.toUpperCase()} ${host}:${port}${hasAuth ? '\uff08\u8d26\u53f7\u4ee3\u7406\uff09' : ''}`;
  }

  function getViewLoadState(view) {
    if (!viewLoadStates.has(view)) {
      viewLoadStates.set(view, {
        context: null,
        partition: '',
        proxyConfig: null,
        retryTimer: 0,
        retryCount: 0,
        isLoading: false,
        lastRequestedUrl: '',
        lastRequestedLoadOptions: null,
        lastRequestedAt: 0,
        lastFailedUrl: '',
        lastFailedCode: 0,
        lastFailedDescription: '',
        lastFailureAt: 0,
        lastCompletedUrl: ''
      });
    }

    return viewLoadStates.get(view);
  }

  function clearViewLoadRetryTimer(view) {
    const state = viewLoadStates.get(view);

    if (!state || !state.retryTimer) {
      return;
    }

    clearTimeout(state.retryTimer);
    state.retryTimer = 0;
  }

  function updateViewLoadStateContext(view, shopEntry, context) {
    const state = getViewLoadState(view);

    state.context = context && typeof context === 'object'
      ? { ...context }
      : null;
    state.partition = normalizeText(shopEntry && shopEntry.partition);
    state.proxyConfig =
      shopEntry
      && shopEntry.environment
      && shopEntry.environment.proxyConfig
      && typeof shopEntry.environment.proxyConfig === 'object'
        ? { ...shopEntry.environment.proxyConfig }
        : null;
  }

  function buildViewLoadLogPayload(view, context, extra = {}) {
    const state = getViewLoadState(view);
    const resolvedContext = context && typeof context === 'object'
      ? context
      : (state.context || {});

    return {
      shopId: normalizeText(resolvedContext && resolvedContext.shopId),
      pageType: normalizeText(resolvedContext && resolvedContext.pageType),
      browserTabId: normalizeText(resolvedContext && resolvedContext.browserTabId),
      partition: normalizeText(state.partition),
      proxySummary: buildProxySummary(state.proxyConfig),
      ...extra
    };
  }

  async function resetViewConnections(view) {
    if (!isViewUsable(view)) {
      return;
    }

    const targetSession = view.webContents.session;

    if (targetSession && typeof targetSession.closeAllConnections === 'function') {
      await targetSession.closeAllConnections().catch(() => {});
    }
  }

  async function flushSessionPersistence(targetSession) {
    if (!targetSession) {
      return;
    }

    if (typeof targetSession.flushStorageData === 'function') {
      try {
        targetSession.flushStorageData();
      } catch (_error) {
        // Ignore flushStorageData failures and still try cookie flush.
      }
    }

    if (
      targetSession.cookies
      && typeof targetSession.cookies.flushStore === 'function'
    ) {
      await targetSession.cookies.flushStore();
    }
  }

  async function persistShopPartitionNow(shopEntry, metadata = {}) {
    if (!shopEntry || !normalizeText(shopEntry.partition)) {
      return {
        success: false,
        shopId: normalizeText(shopEntry && shopEntry.shopId),
        partition: normalizeText(shopEntry && shopEntry.partition)
      };
    }

    const targetSession = session.fromPartition(shopEntry.partition);
    await flushSessionPersistence(targetSession);

    log('shop_partition_persist_flushed', {
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      partition: normalizeText(shopEntry && shopEntry.partition),
      reason: normalizeText(metadata && metadata.reason),
      pageType: normalizeText(metadata && metadata.pageType),
      browserTabId: normalizeText(metadata && metadata.browserTabId)
    });

    return {
      success: true,
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      partition: normalizeText(shopEntry && shopEntry.partition)
    };
  }

  async function syncShopBrowserStorageSnapshotNow(shopEntry, metadata = {}) {
    const browserStorageSyncService = getBrowserStorageSyncServiceSafe();

    if (
      !browserStorageSyncService
      || typeof browserStorageSyncService.syncToCloud !== 'function'
      || !shopEntry
      || !normalizeText(shopEntry.shopId)
    ) {
      return null;
    }

    return browserStorageSyncService.syncToCloud({
      shopId: normalizeText(shopEntry.shopId),
      types: ['cookies', 'localStorage', 'indexedDb'],
      reason: normalizeText(metadata && metadata.reason) || 'shop-partition-sync-now'
    });
  }

  function loadUrlIntoView(view, url, loadOptions = null, metadata = {}) {
    if (!isViewUsable(view) || !canLoadInCurrentView(url)) {
      return false;
    }

    const state = getViewLoadState(view);
    const normalizedUrl = normalizeText(url);

    if (metadata.resetRetry !== false) {
      clearViewLoadRetryTimer(view);
      state.retryCount = 0;
    }

    state.lastRequestedUrl = normalizedUrl;
    state.lastRequestedLoadOptions =
      loadOptions && typeof loadOptions === 'object'
        ? { ...loadOptions }
        : null;
    state.lastRequestedAt = Date.now();
    state.isLoading = true;

    view.webContents.loadURL(normalizedUrl, loadOptions || undefined).catch((error) => {
      if (!error || /ERR_ABORTED/i.test(normalizeText(error && error.message))) {
        return;
      }

      logError(
        'shop_view_load_url_request_failed',
        error,
        buildViewLoadLogPayload(view, metadata.context, {
          url: normalizedUrl,
          reason: normalizeText(metadata.reason)
        })
      );
    });

    return true;
  }

  function showViewLoadErrorPage(view, targetUrl, options = {}) {
    const state = getViewLoadState(view);
    const context = state.context;

    if (!isViewUsable(view) || !context || context.suppressRendererNotifications === true) {
      return;
    }

    const dataUrl = buildViewLoadErrorPageDataUrl({
      title: options.title || '\u9875\u9762\u6682\u65f6\u6253\u4e0d\u5f00',
      message: options.message,
      targetUrl,
      proxySummary: buildProxySummary(state.proxyConfig),
      detailText: options.detailText,
      actionText: options.actionText
    });

    view.webContents.loadURL(dataUrl).catch(() => {});
  }

  function scheduleViewLoadRetry(view, targetUrl) {
    const state = getViewLoadState(view);

    clearViewLoadRetryTimer(view);
    state.retryCount += 1;
    const currentRetryCount = state.retryCount;

    state.retryTimer = setTimeout(() => {
      state.retryTimer = 0;

      if (!isViewUsable(view)) {
        return;
      }

      const latestState = getViewLoadState(view);

      if (normalizeText(latestState.lastRequestedUrl) !== normalizeText(targetUrl)) {
        return;
      }

      resetViewConnections(view)
        .catch(() => {})
        .finally(() => {
          loadUrlIntoView(
            view,
            targetUrl,
            latestState.lastRequestedLoadOptions,
            {
              context: latestState.context,
              reason: `auto-retry-${currentRetryCount}`,
              resetRetry: false
            }
          );
        });
    }, VIEW_LOAD_RETRY_DELAY_MS * currentRetryCount);
  }

  function handleViewLoadFailure(view, context, errorCode, errorDescription, validatedURL, isMainFrame) {
    const state = getViewLoadState(view);
    const targetUrl = normalizeText(validatedURL || state.lastRequestedUrl);

    state.isLoading = false;

    if (!isMainFrame || !targetUrl || isBrowserLoadErrorPageUrl(targetUrl) || Number(errorCode) === -3) {
      return;
    }

    state.lastFailedUrl = targetUrl;
    state.lastFailedCode = Number(errorCode) || 0;
    state.lastFailedDescription = normalizeText(errorDescription);
    state.lastFailureAt = Date.now();
    const failureText = describeViewLoadFailure(state.lastFailedCode, state.lastFailedDescription);
    const shouldRetry =
      VIEW_LOAD_RETRYABLE_ERROR_CODES.has(state.lastFailedCode)
      && state.retryCount < VIEW_LOAD_MAX_AUTO_RETRY_COUNT;

    log('shop_view_main_frame_load_failed', buildViewLoadLogPayload(view, context, {
      url: targetUrl,
      errorCode: state.lastFailedCode,
      errorDescription: state.lastFailedDescription,
      retryCount: state.retryCount,
      willRetry: shouldRetry
    }));

    if (shouldRetry) {
      const nextRetryIndex = state.retryCount + 1;

      notifyBrowserTabMessage(
        context,
        `\u9875\u9762\u52a0\u8f7d\u5931\u8d25\uff0c\u6b63\u5728\u81ea\u52a8\u91cd\u8bd5 ${nextRetryIndex}/${VIEW_LOAD_MAX_AUTO_RETRY_COUNT}\u3002${failureText}`,
        {
          persistent: true
        }
      );
      showViewLoadErrorPage(view, targetUrl, {
        title: '\u9875\u9762\u6b63\u5728\u91cd\u65b0\u8fde\u63a5',
        message: '\u68c0\u6d4b\u5230\u5f53\u524d\u9875\u9762\u52a0\u8f7d\u5931\u8d25\uff0c\u6b63\u5728\u5c1d\u8bd5\u91cd\u65b0\u8fde\u63a5\u3002',
        detailText: failureText,
        actionText: `\u7cfb\u7edf\u6b63\u5728\u81ea\u52a8\u91cd\u8bd5 ${nextRetryIndex}/${VIEW_LOAD_MAX_AUTO_RETRY_COUNT}\u3002\u5982\u591a\u6b21\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u5f53\u524d\u5e97\u94fa\u4ee3\u7406\u662f\u5426\u5728\u7ebf\u3002`
      });
      scheduleViewLoadRetry(view, targetUrl);
      return;
    }

    notifyBrowserTabMessage(
      context,
      `\u9875\u9762\u52a0\u8f7d\u5931\u8d25\uff1a${failureText}\u3002\u8bf7\u68c0\u67e5\u5f53\u524d\u5e97\u94fa\u4ee3\u7406\u548c\u7f51\u7edc\u540e\u91cd\u8bd5\u3002`,
      {
        persistent: true
      }
    );
    showViewLoadErrorPage(view, targetUrl, {
      title: '\u9875\u9762\u52a0\u8f7d\u5931\u8d25',
      message: '\u5f53\u524d\u6d4f\u89c8\u5668\u9875\u9762\u6ca1\u6709\u6b63\u5e38\u6253\u5f00\u3002',
      detailText: failureText,
      actionText: '\u53ef\u6309 F5 \u91cd\u8bd5\uff1b\u5982\u679c\u4ecd\u7136\u5931\u8d25\uff0c\u8bf7\u5148\u68c0\u67e5\u5f53\u524d\u5e97\u94fa\u4ee3\u7406\u7ebf\u8def\u548c\u8d26\u53f7\u8ba4\u8bc1\u3002'
    });
  }

  function requestBrowserUrlInput(context, view) {
    if (!context || context.suppressRendererNotifications === true) {
      return;
    }

    const currentUrl = normalizeText(isViewUsable(view) ? view.webContents.getURL() : '');
    const state = isViewUsable(view) ? getViewLoadState(view) : null;

    notifyRenderer(SHOP_WINDOW_CHANNELS.REQUEST_BROWSER_URL_INPUT, {
      shopId: normalizeText(context.shopId),
      pageType: normalizeText(context.pageType),
      browserTabId: normalizeText(context.browserTabId),
      currentUrl: isBrowserLoadErrorPageUrl(currentUrl)
        ? normalizeText(state && (state.lastFailedUrl || state.lastRequestedUrl))
        : currentUrl
    });
  }

  async function openBrowserUrlInNewTab(payload = {}) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageType = normalizeText(payload && payload.pageType);
    const sourceBrowserTabId =
      normalizeText(payload && payload.browserTabId) || DEFAULT_BROWSER_TAB_ID;
    const nextUrl = normalizeManualBrowserUrl(payload && payload.url);

    if (!shopId || !pageType) {
      throw new Error('\u5f53\u524d\u5e97\u94fa\u9875\u7b7e\u4fe1\u606f\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u6d4f\u89c8\u5668\u7a97\u53e3\u540e\u518d\u8bd5\u3002');
    }

    if (!nextUrl) {
      throw new Error('\u8bf7\u8f93\u5165\u6709\u6548\u7684\u7f51\u5740\uff0c\u652f\u6301 http:// \u6216 https://\u3002');
    }

    const shopEntry = shopEntriesById.get(shopId);

    if (!shopEntry) {
      throw new Error('\u5f53\u524d\u5e97\u94fa\u6d4f\u89c8\u5668\u672a\u51c6\u5907\u597d\uff0c\u8bf7\u5148\u6253\u5f00\u5bf9\u5e94\u9875\u9762\u3002');
    }

    const pageEntry = ensurePageEntry(shopEntry, pageType);
    const currentTabEntry =
      pageEntry.tabs.get(sourceBrowserTabId)
      || pageEntry.tabs.get(pageEntry.order[0])
      || null;

    if (pageEntry.order.length >= MAX_BROWSER_TABS_PER_PAGE) {
      loadInCurrentView(currentTabEntry && currentTabEntry.view, nextUrl);
      notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, {
        shopId,
        pageType,
        message: '\u5f53\u524d\u529f\u80fd\u533a\u6700\u591a\u53ea\u80fd\u6253\u5f00 10 \u4e2a\u6807\u7b7e\uff0c\u5df2\u5728\u5f53\u524d\u6807\u7b7e\u7ee7\u7eed\u6253\u5f00\u65b0\u7f51\u5740\u3002'
      });
      log('shop_manual_url_open_reused_current_tab', {
        shopId,
        pageType,
        browserTabId: sourceBrowserTabId,
        url: nextUrl
      });
      return {
        success: true,
        openedInCurrentTab: true,
        url: nextUrl,
        browserTabId: normalizeText(currentTabEntry && currentTabEntry.meta && currentTabEntry.meta.id)
      };
    }

    const browserTabId = createTabId();
    const tabMeta = buildTabMeta(pageType, browserTabId, pageEntry.nextSequence, nextUrl);

    pageEntry.nextSequence += 1;
    pageEntry.tabs.set(browserTabId, {
      meta: tabMeta,
      view: null,
      lastUsedAt: 0,
      popupOpener: {
        shopId,
        pageType,
        browserTabId: sourceBrowserTabId,
        sourceUrl: normalizeText(payload && payload.currentUrl),
        targetUrl: nextUrl
      }
    });
    pageEntry.order.push(browserTabId);

    notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_CREATED, {
      shopId,
      pageType,
      tab: buildRendererTab(tabMeta)
    });
    log('shop_manual_url_tab_created', {
      shopId,
      pageType,
      browserTabId,
      url: nextUrl
    });

    return {
      success: true,
      openedInCurrentTab: false,
      url: nextUrl,
      browserTabId
    };
  }

  function isViewUsable(view) {
    return Boolean(view && view.webContents && !view.webContents.isDestroyed());
  }

  function createTabId() {
    return `tab_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  }

  function buildBackgroundViewKey(pageType, backgroundGroupKey, entryId = 'default') {
    return [
      normalizeText(pageType) || 'browser',
      normalizeText(backgroundGroupKey) || 'background',
      normalizeText(entryId) || 'default'
    ].join('::');
  }

  function buildBackgroundViewId(pageType, backgroundGroupKey, entryId = 'default') {
    return [
      '__background__',
      normalizeText(pageType) || 'browser',
      normalizeText(backgroundGroupKey) || 'background',
      normalizeText(entryId) || 'default'
    ].join('_');
  }

  function tryMigrateLegacyPartition(payload, nextPartition) {
    const legacyPartition = getLegacyPartition(payload);

    if (!legacyPartition || legacyPartition === nextPartition) {
      return;
    }

    const legacyDirectory = getPartitionDirectory(legacyPartition);
    const nextDirectory = getPartitionDirectory(nextPartition);

    if (!fs.existsSync(legacyDirectory) || fs.existsSync(nextDirectory)) {
      return;
    }

    try {
      fs.renameSync(legacyDirectory, nextDirectory);
      log('shop_partition_migrated', {
        shopId: payload && payload.shopId ? payload.shopId : '',
        legacyPartition,
        nextPartition
      });
    } catch (error) {
      logError('shop_partition_migrate_failed', error, {
        shopId: payload && payload.shopId ? payload.shopId : '',
        legacyPartition,
        nextPartition
      });
    }
  }

  function getWorkspaceUrl(pageType) {
    return WORKSPACE_URLS[pageType] || WORKSPACE_URLS['seller-center'];
  }

  function getWorkspaceLabel(pageType) {
    return WORKSPACE_LABELS[pageType] || '\u6D4F\u89C8\u5668';
  }

  function canLoadInCurrentView(url) {
    return /^https?:\/\//i.test(String(url || ''));
  }

  function parseUrl(url) {
    try {
      return new URL(String(url || ''));
    } catch (_error) {
      return null;
    }
  }

  function isAuthenticationPageUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      AUTHENTICATION_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && AUTHENTICATION_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isAdsLoginPageUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      ADS_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && ADS_LOGIN_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isProductPromotionTicketLoginUrl(url) {
    if (!isAdsLoginPageUrl(url)) {
      return false;
    }

    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    return Boolean(
      normalizeText(parsedUrl.searchParams.get('ticket'))
      || normalizeText(parsedUrl.searchParams.get('adSellerUniqueId'))
    );
  }

  function isProductPromotionAnonymousLoginPendingUrl(url) {
    if (!isAdsLoginPageUrl(url)) {
      return false;
    }

    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hasIdentity = Boolean(
      normalizeText(parsedUrl.searchParams.get('mallId'))
      || normalizeText(parsedUrl.searchParams.get('adLoginMallId'))
      || normalizeText(parsedUrl.searchParams.get('adSellerUniqueId'))
    );
    const hasLoginType = Boolean(
      normalizeText(parsedUrl.searchParams.get('mallType'))
      || normalizeText(parsedUrl.searchParams.get('userType'))
    );
    const hasSource = Boolean(
      normalizeText(parsedUrl.searchParams.get('seller_source'))
      || normalizeText(parsedUrl.searchParams.get('local_source'))
      || normalizeText(parsedUrl.searchParams.get('source'))
    );
    const isBackNavigation = normalizeText(parsedUrl.searchParams.get('is_back')) === '1';

    return hasIdentity && hasSource && (hasLoginType || isBackNavigation);
  }

  function isSellerOauthPageUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      SELLER_OAUTH_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && SELLER_OAUTH_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isSellerCenterRelatedUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    return SELLER_CENTER_RELATED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  }

  function isSellerCenterWorkspaceUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      SELLER_CENTER_RELATED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && !isAuthenticationPageUrl(url)
      && !isLoginAutofillUrl(url)
      && !ADS_LOGIN_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isSellerCenterSiteMainUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      /(^|\.)seller\.kuajingmaihuo\.com$/i.test(hostname)
      && /^\/settle\/site-main$/i.test(pathname)
    );
  }

  function isSellerCenterAuthHomeUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase().replace(/\/+$/, '') || '/';

    return (
      SELLER_CENTER_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && pathname === '/'
    );
  }

  function getSellerCenterPopupUrlKind(url) {
    if (isAuthenticationPageUrl(url)) {
      return 'authentication';
    }

    if (isLoginAutofillUrl(url)) {
      return 'login';
    }

    if (isSellerCenterAuthHomeUrl(url)) {
      return 'auth-home';
    }

    return '';
  }

  function isProductPromotionRelatedUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    return PRODUCT_PROMOTION_RELATED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  }

  function isProductPromotionWorkspaceUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      ADS_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
      && !ADS_LOGIN_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
    );
  }

  function isProductPromotionActivityLoginPageUrl(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return false;
    }

    const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
    const pathname = normalizeText(parsedUrl.pathname).toLowerCase();

    return (
      /(^|\.)seller\.kuajingmaihuo\.com$/i.test(hostname)
      && /^\/settle\/activity-login$/i.test(pathname)
    );
  }

  function getProductPromotionActivityBridgeToken(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return '';
    }

    const hash = normalizeText(parsedUrl.hash).replace(/^#/, '');

    if (!hash) {
      return '';
    }

    try {
      const hashParams = new URLSearchParams(hash);
      return normalizeText(hashParams.get(PRODUCT_PROMOTION_ACTIVITY_BRIDGE_HASH_KEY));
    } catch (_error) {
      return '';
    }
  }

  function getPopupMessageBridgePayload(url) {
    const parsedUrl = parseUrl(url);

    if (!parsedUrl) {
      return null;
    }

    const hash = String(parsedUrl.hash || '').replace(/^#/, '').trim();

    if (!hash) {
      return null;
    }

    try {
      const hashParams = new URLSearchParams(hash);
      const rawPayload = String(hashParams.get(POPUP_MESSAGE_BRIDGE_HASH_KEY) || '').trim();

      if (!rawPayload) {
        return null;
      }

      const message = JSON.parse(rawPayload);

      if (!message || typeof message !== 'object') {
        return null;
      }

      return {
        token: rawPayload,
        message
      };
    } catch (_error) {
      return null;
    }
  }

  function buildSellerCenterReloginUrl(sourceUrl) {
    const parsedUrl = parseUrl(sourceUrl);
    const requestedRedirectUrl = normalizeText(
      (parsedUrl && parsedUrl.searchParams.get('redirectUrl')) || sourceUrl
    );
    const redirectUrl = isSellerCenterWorkspaceUrl(requestedRedirectUrl)
      || isSellerCenterSiteMainUrl(requestedRedirectUrl)
      ? requestedRedirectUrl
      : WORKSPACE_URLS['seller-center'];
    const parsedRedirectUrl = parseUrl(redirectUrl);
    const authenticationHost = (
      (
        parsedUrl
        && AUTHENTICATION_HOST_PATTERNS.some((pattern) => pattern.test(normalizeText(parsedUrl.hostname)))
      )
        ? normalizeText(parsedUrl.hostname)
        : (
          parsedRedirectUrl
          && AUTHENTICATION_HOST_PATTERNS.some((pattern) => pattern.test(normalizeText(parsedRedirectUrl.hostname)))
        )
          ? normalizeText(parsedRedirectUrl.hostname)
          : 'agentseller.temu.com'
    );

    return `https://${authenticationHost}/main/authentication?redirectUrl=${encodeURIComponent(
      redirectUrl
    )}`;
  }

  function buildProductPromotionLoginUrl(sourceUrl) {
    const parsedUrl = parseUrl(sourceUrl);

    if (parsedUrl) {
      const hostname = normalizeText(parsedUrl.hostname).toLowerCase();
      parsedUrl.hash = '';

      if (ADS_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
        if (isAdsLoginPageUrl(parsedUrl.toString())) {
          return parsedUrl.toString();
        }

        return `https://ads.temu.com/login.html?redirectUrl=${encodeURIComponent(
          parsedUrl.toString()
        )}`;
      }

      if (SELLER_OAUTH_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
        return parsedUrl.toString();
      }
    }

    return PRODUCT_PROMOTION_ACTIVITY_LOGIN_URL;
  }

  function buildProductPromotionReloginUrl(sourceUrl) {
    const loginUrl = buildProductPromotionLoginUrl(sourceUrl);

    if (!loginUrl) {
      return '';
    }

    return `https://seller.kuajingmaihuo.com/settle/activity-login?source=${encodeURIComponent(
      loginUrl
    )}`;
  }

  function isManagedLoginEntryUrl(pageType, url) {
    if (pageType === 'seller-center') {
      return isAuthenticationPageUrl(url);
    }

    if (pageType === 'product-promotion') {
      return isAdsLoginPageUrl(url) || isSellerOauthPageUrl(url);
    }

    return false;
  }

  function isWorkspaceReadyUrl(pageType, url) {
    if (pageType === 'seller-center') {
      return isSellerCenterWorkspaceUrl(url);
    }

    if (pageType === 'product-promotion') {
      return isProductPromotionWorkspaceUrl(url);
    }

    return false;
  }

  function isAutomationRelevantUrl(pageType, url) {
    if (isLoginAutofillUrl(url) || isAuthenticationPageUrl(url)) {
      return true;
    }

    if (pageType === 'product-promotion') {
      return (
        isProductPromotionRelatedUrl(url)
        || isProductPromotionTicketLoginUrl(url)
        || isProductPromotionAnonymousLoginPendingUrl(url)
      );
    }

    if (pageType === 'seller-center') {
      return isSellerCenterRelatedUrl(url);
    }

    return false;
  }

  function normalizeShopMatchText(value) {
    return normalizeText(value).toLowerCase().replace(/\s+/g, '');
  }

  function normalizeMallRecords(malls) {
    return Array.isArray(malls)
      ? malls
        .map((mall) => ({
          mallId: normalizeText(mall && mall.mallId),
          mallName: normalizeText(mall && mall.mallName),
          uniqueId: normalizeText(mall && mall.uniqueId)
        }))
        .filter((mall) => mall.mallName)
      : [];
  }

  function updateShopSellerAuthSessionSnapshot(shopEntry, probeResult) {
    if (!shopEntry) {
      return;
    }

    if (normalizeText(probeResult && probeResult.responseType).toLowerCase() !== 'seller-auth-user-info') {
      return;
    }

    const malls = normalizeMallRecords(probeResult && probeResult.malls);

    if (malls.length === 0) {
      return;
    }

    shopEntry.lastSellerAuthSessionSnapshot = {
      updatedAt: Date.now(),
      origin: normalizeText(probeResult && probeResult.origin),
      hostname: normalizeText(probeResult && probeResult.hostname),
      accountId: normalizeText(probeResult && probeResult.accountId),
      status: 'online',
      malls,
      mallNames: malls.map((mall) => mall.mallName).filter(Boolean)
    };
  }

  function normalizeSellerAuthSessionSnapshot(snapshot) {
    const malls = normalizeMallRecords(snapshot && snapshot.malls);
    const mallNames = Array.from(new Set(
      malls
        .map((mall) => mall.mallName)
        .concat(
          Array.isArray(snapshot && snapshot.mallNames)
            ? snapshot.mallNames.map((mallName) => normalizeText(mallName))
            : []
        )
        .filter(Boolean)
    ));
    const status = normalizeText(snapshot && snapshot.status).toLowerCase();

    return {
      updatedAt: Number(snapshot && snapshot.updatedAt) || 0,
      origin: normalizeText(snapshot && snapshot.origin),
      hostname: normalizeText(snapshot && snapshot.hostname),
      accountId: normalizeText(snapshot && snapshot.accountId),
      status: status || (malls.length > 0 ? 'online' : ''),
      malls,
      mallNames
    };
  }

  function isSellerAuthSessionOnline(snapshot) {
    const normalizedSnapshot = normalizeSellerAuthSessionSnapshot(snapshot);

    return (
      normalizedSnapshot.status === 'online'
      && normalizedSnapshot.malls.length > 0
      && Boolean(normalizedSnapshot.origin)
    );
  }

  function collectSellerAuthSessionOrigins(shopEntry) {
    const originSet = new Set();
    const snapshot = normalizeSellerAuthSessionSnapshot(
      shopEntry && shopEntry.lastSellerAuthSessionSnapshot
    );

    if (/^https?:\/\/[^/]+$/i.test(snapshot.origin)) {
      originSet.add(snapshot.origin.replace(/\/+$/, ''));
    }

    const pageOrigins = [];

    if (shopEntry && shopEntry.pages instanceof Map) {
      shopEntry.pages.forEach((pageEntry) => {
        if (!pageEntry || !(pageEntry.tabs instanceof Map)) {
          return;
        }

        pageEntry.tabs.forEach((tabEntry) => {
          const view = tabEntry && tabEntry.view;

          if (!isViewUsable(view) || !view.webContents || view.webContents.isDestroyed()) {
            return;
          }

          pageOrigins.push(normalizeText(view.webContents.getURL()));
        });
      });
    }

    if (shopEntry && shopEntry.backgroundViews instanceof Map) {
      shopEntry.backgroundViews.forEach((backgroundEntry) => {
        const view = backgroundEntry && backgroundEntry.view;

        if (!isViewUsable(view) || !view.webContents || view.webContents.isDestroyed()) {
          return;
        }

        pageOrigins.push(normalizeText(view.webContents.getURL()));
      });
    }

    pageOrigins.forEach((url) => {
      const parsedUrl = parseUrl(url);

      if (!parsedUrl) {
        return;
      }

      const hostname = normalizeText(parsedUrl.hostname).toLowerCase();

      if (!SELLER_CENTER_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
        return;
      }

      originSet.add(`${parsedUrl.protocol}//${parsedUrl.host}`);
    });

    originSet.add(DEFAULT_SELLER_AUTH_ORIGIN);

    return Array.from(originSet);
  }

  async function executeSellerAuthSessionFetch(targetSession, requestUrl, requestInit, options = {}) {
    const timeoutMs = Math.max(
      1000,
      Number(options && options.timeoutMs) || SELLER_AUTH_SESSION_REQUEST_TIMEOUT_MS
    );

    if (!targetSession || typeof targetSession.fetch !== 'function') {
      throw new Error('\u5356\u5bb6\u4f1a\u8bdd\u8bf7\u6c42\u901a\u9053\u4e0d\u53ef\u7528\u3002');
    }

    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    let timeoutId = 0;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (controller) {
          try {
            controller.abort();
          } catch (_error) {
            // Ignore abort failures.
          }
        }

        const timeoutError = new Error(
          '\u5356\u5bb6\u4f1a\u8bdd\u68c0\u6d4b\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );

        timeoutError.timeout = true;
        timeoutError.retryable = true;
        reject(timeoutError);
      }, timeoutMs);
    });

    const fetchPromise = (async () => {
      try {
        return await targetSession.fetch(requestUrl, {
          ...requestInit,
          ...(controller ? { signal: controller.signal } : {})
        });
      } catch (error) {
        if (
          (controller && controller.signal && controller.signal.aborted)
          || normalizeText(error && error.name) === 'AbortError'
        ) {
          const timeoutError = new Error(
            '\u5356\u5bb6\u4f1a\u8bdd\u68c0\u6d4b\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
          );

          timeoutError.timeout = true;
          timeoutError.retryable = true;
          throw timeoutError;
        }

        throw error;
      }
    })();

    try {
      return await Promise.race([
        fetchPromise,
        timeoutPromise
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  function parseSellerAuthUserInfoResponse(origin, response, responseText) {
    const normalizedOrigin = normalizeText(origin).replace(/\/+$/, '') || DEFAULT_SELLER_AUTH_ORIGIN;
    const parsedOrigin = parseUrl(normalizedOrigin);
    const httpStatus = Number(response && response.status) || 0;
    const responsePreview = normalizeText(responseText).slice(0, 180);
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      payload = null;
    }

    if (!payload || typeof payload !== 'object') {
      return {
        status: httpStatus === 401 || httpStatus === 403 ? 'offline' : 'invalid-response',
        origin: normalizedOrigin,
        hostname: normalizeText(parsedOrigin && parsedOrigin.hostname),
        requestUrl: `${normalizedOrigin}${SELLER_AUTH_USER_INFO_PATH}`,
        httpStatus,
        malls: [],
        mallNames: [],
        accountId: '',
        errorMessage: responsePreview
      };
    }

    const malls = normalizeMallRecords(payload && payload.result && payload.result.mallList);
    const success =
      response.ok
      && payload.success === true
      && (
        !Object.prototype.hasOwnProperty.call(payload, 'errorCode')
        || Number(payload.errorCode) === 1000000
      )
      && malls.length > 0;

    return {
      responseType: 'seller-auth-user-info',
      status: success ? 'online' : 'offline',
      origin: normalizedOrigin,
      hostname: normalizeText(parsedOrigin && parsedOrigin.hostname),
      requestUrl: `${normalizedOrigin}${SELLER_AUTH_USER_INFO_PATH}`,
      httpStatus,
      success,
      malls,
      mallCount: malls.length,
      mallNames: malls.map((mall) => mall.mallName).filter(Boolean),
      accountId: normalizeText(payload && payload.result && payload.result.accountId),
      accountType: normalizeText(payload && payload.result && payload.result.accountType),
      accountStatus: normalizeText(payload && payload.result && payload.result.accountStatus),
      tokenType: normalizeText(payload && payload.result && payload.result.tokenType),
      errorCode: Object.prototype.hasOwnProperty.call(payload, 'errorCode')
        ? Number(payload.errorCode)
        : null,
      errorMessage: normalizeText(
        payload && (
          payload.errorMsg
          || payload.message
          || payload.msg
        )
      ),
      errorMsg: normalizeText(
        payload && (
          payload.errorMsg
          || payload.message
          || payload.msg
        )
      ),
      message: normalizeText(
        payload && (
          payload.message
          || payload.msg
          || payload.errorMsg
        )
      ),
      companyCount: 0,
      hasSessionContext: success
    };
  }

  function collectMmsSessionMallRecords(payload) {
    const result = payload && payload.result && typeof payload.result === 'object'
      ? payload.result
      : (payload && payload.res && typeof payload.res === 'object' ? payload.res : null);
    const companyList = Array.isArray(result && result.companyList)
      ? result.companyList
      : [];
    const malls = [];

    companyList.forEach((company) => {
      const mallList = Array.isArray(company && company.malInfoList)
        ? company.malInfoList
        : [];

      mallList.forEach((mall) => {
        malls.push({
          mallId: normalizeText(mall && (mall.mallId || mall.mallID || mall.id || mall.shopId || mall.shopID)),
          mallName: normalizeText(mall && (mall.mallName || mall.shopName || mall.name || mall.mallTitle)),
          uniqueId: normalizeText(
            mall && (mall.uniqueId || mall.uniqueID || mall.mallUniqueId || mall.mallUniqueID)
          )
        });
      });
    });

    return normalizeMallRecords(malls);
  }

  function getMmsSessionCompanyCount(payload) {
    const result = payload && payload.result && typeof payload.result === 'object'
      ? payload.result
      : (payload && payload.res && typeof payload.res === 'object' ? payload.res : null);
    const companyList = Array.isArray(result && result.companyList)
      ? result.companyList
      : [];

    return companyList.length;
  }

  function hasMmsSessionContext(payload) {
    const result = payload && payload.result && typeof payload.result === 'object'
      ? payload.result
      : (payload && payload.res && typeof payload.res === 'object' ? payload.res : null);

    if (!result || typeof result !== 'object') {
      return false;
    }

    return Boolean(
      normalizeText(result.userId)
      || normalizeText(result.accountType)
      || normalizeText(result.accountStatus)
      || normalizeText(result.tokenType)
      || normalizeText(result.maskMobile)
    );
  }

  function parseMmsUserInfoResponse(origin, response, responseText) {
    const normalizedOrigin = normalizeText(origin).replace(/\/+$/, '') || DEFAULT_SELLER_AUTH_ORIGIN;
    const parsedOrigin = parseUrl(normalizedOrigin);
    const httpStatus = Number(response && response.status) || 0;
    const responsePreview = normalizeText(responseText).slice(0, 180);
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      payload = null;
    }

    if (!payload || typeof payload !== 'object') {
      return {
        responseType: 'mms-user-info',
        status: httpStatus === 401 || httpStatus === 403 ? 'offline' : 'invalid-response',
        origin: normalizedOrigin,
        hostname: normalizeText(parsedOrigin && parsedOrigin.hostname),
        requestUrl: `${normalizedOrigin}${SELLER_CENTER_MMS_USER_INFO_PATH}`,
        httpStatus,
        success: false,
        malls: [],
        mallCount: 0,
        mallNames: [],
        accountId: '',
        accountType: '',
        accountStatus: '',
        tokenType: '',
        errorCode: null,
        errorMessage: responsePreview,
        errorMsg: responsePreview,
        message: responsePreview,
        companyCount: 0,
        hasSessionContext: false
      };
    }

    const malls = collectMmsSessionMallRecords(payload);
    const companyCount = getMmsSessionCompanyCount(payload);
    const hasSession = hasMmsSessionContext(payload);
    const statusCode = Number(
      payload && (
        payload.code
        || payload.status
        || payload.errorCode
      )
    );
    const message = normalizeText(
      payload && (
        payload.msg
        || payload.message
        || payload.errorMsg
      )
    );
    const normalizedMessage = message.toLowerCase();
    const success = Boolean(
      response
      && response.ok
      && payload.success !== false
      && (
        !Number.isFinite(statusCode)
        || statusCode === 0
        || statusCode === 200
        || statusCode === 1000000
      )
      && !/unauthorized|forbidden|login|expired|offline/.test(normalizedMessage)
      && (hasSession || companyCount > 0 || malls.length > 0)
    );
    const result = payload && payload.result && typeof payload.result === 'object'
      ? payload.result
      : (payload && payload.res && typeof payload.res === 'object' ? payload.res : null);

    return {
      responseType: 'mms-user-info',
      status: success ? 'online' : 'offline',
      origin: normalizedOrigin,
      hostname: normalizeText(parsedOrigin && parsedOrigin.hostname),
      requestUrl: `${normalizedOrigin}${SELLER_CENTER_MMS_USER_INFO_PATH}`,
      httpStatus,
      success,
      malls,
      mallCount: malls.length,
      mallNames: malls.map((mall) => mall.mallName).filter(Boolean),
      accountId: normalizeText(result && (result.accountId || result.userId)),
      accountType: normalizeText(result && result.accountType),
      accountStatus: normalizeText(result && result.accountStatus),
      tokenType: normalizeText(result && result.tokenType),
      errorCode: Number.isFinite(statusCode) ? statusCode : null,
      errorMessage: message,
      errorMsg: message,
      message,
      companyCount,
      hasSessionContext: hasSession
    };
  }

  function resolveSellerSessionProbeRequest(origin) {
    const normalizedOrigin = normalizeText(origin).replace(/\/+$/, '') || DEFAULT_SELLER_AUTH_ORIGIN;
    const parsedOrigin = parseUrl(normalizedOrigin);
    const hostname = normalizeText(parsedOrigin && parsedOrigin.hostname).toLowerCase();
    const useMmsEndpoint = /(^|\.)seller\.kuajingmaihuo\.com$/i.test(hostname);
    const requestPath = useMmsEndpoint
      ? SELLER_CENTER_MMS_USER_INFO_PATH
      : SELLER_AUTH_USER_INFO_PATH;

    return {
      origin: normalizedOrigin,
      hostname,
      responseType: useMmsEndpoint ? 'mms-user-info' : 'seller-auth-user-info',
      requestPath,
      requestUrl: `${normalizedOrigin}${requestPath}`
    };
  }

  function parseSellerSessionProbeResponse(requestInfo, response, responseText) {
    return requestInfo && requestInfo.responseType === 'mms-user-info'
      ? parseMmsUserInfoResponse(requestInfo.origin, response, responseText)
      : parseSellerAuthUserInfoResponse(requestInfo && requestInfo.origin, response, responseText);
  }

  async function loadSellerAuthSessionContext(targetSession, options = {}) {
    const candidateOrigins = Array.from(new Set(
      (Array.isArray(options && options.preferredOrigins) ? options.preferredOrigins : [])
        .map((origin) => normalizeText(origin).replace(/\/+$/, ''))
        .filter(Boolean)
        .concat(DEFAULT_SELLER_AUTH_ORIGIN)
    ));
    const attempts = [];
    let lastResult = {
      status: 'offline',
      origin: '',
      hostname: '',
      requestUrl: '',
      httpStatus: 0,
      malls: [],
      mallNames: [],
      accountId: '',
      attempts
    };

    if (!targetSession || typeof targetSession.fetch !== 'function') {
      return lastResult;
    }

    for (const origin of candidateOrigins) {
      const requestUrl = new URL(SELLER_AUTH_USER_INFO_PATH, origin).toString();

      try {
        const response = await executeSellerAuthSessionFetch(targetSession, requestUrl, {
          method: 'POST',
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json;charset=UTF-8',
            origin,
            referer: `${origin}/`,
            'x-requested-with': 'XMLHttpRequest'
          },
          body: '{}',
          cache: 'no-store',
          credentials: 'include'
        });
        const responseText = await response.text();
        const parsedResult = parseSellerAuthUserInfoResponse(origin, response, responseText);

        attempts.push({
          origin,
          requestUrl,
          response: {
            status: parsedResult.httpStatus,
            ok: parsedResult.status === 'online'
          },
          accountId: parsedResult.accountId,
          malls: parsedResult.malls,
          transportError: ''
        });

        lastResult = {
          ...parsedResult,
          attempts
        };

        if (parsedResult.status === 'online' && parsedResult.malls.length > 0) {
          return lastResult;
        }
      } catch (error) {
        attempts.push({
          origin,
          requestUrl,
          response: {
            status: 0,
            ok: false
          },
          accountId: '',
          malls: [],
          transportError: normalizeText(error && error.message)
        });
        lastResult = {
          status: 'error',
          origin,
          hostname: normalizeText(parseUrl(origin) && parseUrl(origin).hostname),
          requestUrl,
          httpStatus: 0,
          malls: [],
          mallNames: [],
          accountId: '',
          errorMessage: normalizeText(error && error.message),
          attempts
        };
      }
    }

    return lastResult;
  }

  async function probeSellerSessionForView(shopEntry, currentUrl = '') {
    if (!shopEntry || !normalizeText(shopEntry.partition)) {
      return {
        responseType: 'seller-auth-user-info',
        status: 'offline',
        origin: '',
        hostname: '',
        requestUrl: '',
        httpStatus: 0,
        success: false,
        malls: [],
        mallCount: 0,
        mallNames: [],
        accountId: '',
        accountType: '',
        accountStatus: '',
        tokenType: '',
        errorCode: null,
        errorMessage: '',
        errorMsg: '',
        message: '',
        companyCount: 0,
        hasSessionContext: false
      };
    }

    const targetSession = session.fromPartition(shopEntry.partition);
    const currentOrigin = normalizeText(parseUrl(currentUrl) && parseUrl(currentUrl).origin).replace(/\/+$/, '');
    const cachedOrigin = normalizeText(
      shopEntry && shopEntry.lastSellerAuthSessionSnapshot && shopEntry.lastSellerAuthSessionSnapshot.origin
    ).replace(/\/+$/, '');
    const candidateOrigins = Array.from(new Set(
      [currentOrigin, cachedOrigin]
        .concat(collectSellerAuthSessionOrigins(shopEntry))
        .concat(DEFAULT_SELLER_AUTH_ORIGIN)
        .map((origin) => normalizeText(origin).replace(/\/+$/, ''))
        .filter(Boolean)
    ));
    let lastResult = {
      responseType: 'seller-auth-user-info',
      status: 'offline',
      origin: currentOrigin || cachedOrigin,
      hostname: normalizeText(parseUrl(currentOrigin || cachedOrigin) && parseUrl(currentOrigin || cachedOrigin).hostname),
      requestUrl: '',
      httpStatus: 0,
      success: false,
      malls: [],
      mallCount: 0,
      mallNames: [],
      accountId: '',
      accountType: '',
      accountStatus: '',
      tokenType: '',
      errorCode: null,
      errorMessage: '',
      errorMsg: '',
      message: '',
      companyCount: 0,
      hasSessionContext: false
    };

    for (const origin of candidateOrigins) {
      const requestInfo = resolveSellerSessionProbeRequest(origin);

      try {
        const response = await executeSellerAuthSessionFetch(targetSession, requestInfo.requestUrl, {
          method: 'POST',
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json;charset=UTF-8',
            origin: requestInfo.origin,
            referer: `${requestInfo.origin}/`,
            'x-requested-with': 'XMLHttpRequest'
          },
          body: '{}',
          cache: 'no-store',
          credentials: 'include'
        });
        const responseText = await response.text();
        const parsedResult = parseSellerSessionProbeResponse(requestInfo, response, responseText);

        lastResult = parsedResult;
        updateShopSellerAuthSessionSnapshot(shopEntry, parsedResult);

        if (normalizeText(parsedResult && parsedResult.status).toLowerCase() === 'online') {
          return parsedResult;
        }
      } catch (error) {
        lastResult = {
          responseType: requestInfo.responseType,
          status: 'error',
          origin: requestInfo.origin,
          hostname: requestInfo.hostname,
          requestUrl: requestInfo.requestUrl,
          httpStatus: 0,
          success: false,
          malls: [],
          mallCount: 0,
          mallNames: [],
          accountId: '',
          accountType: '',
          accountStatus: '',
          tokenType: '',
          errorCode: null,
          errorMessage: normalizeText(error && error.message),
          errorMsg: normalizeText(error && error.message),
          message: normalizeText(error && error.message),
          companyCount: 0,
          hasSessionContext: false
        };
      }
    }

    return lastResult;
  }

  async function probeSellerAuthSessionForShopEntry(shopEntry) {
    if (!shopEntry || !normalizeText(shopEntry.partition)) {
      return null;
    }

    const targetSession = session.fromPartition(shopEntry.partition);
    const candidateOrigins = collectSellerAuthSessionOrigins(shopEntry);
    let lastResult = null;

    for (const origin of candidateOrigins) {
      const requestUrl = new URL(SELLER_AUTH_USER_INFO_PATH, origin).toString();

      try {
        const response = await executeSellerAuthSessionFetch(targetSession, requestUrl, {
          method: 'POST',
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json;charset=UTF-8',
            origin,
            referer: `${origin}/`,
            'x-requested-with': 'XMLHttpRequest'
          },
          body: '{}',
          cache: 'no-store',
          credentials: 'include'
        });
        const responseText = await response.text();
        const parsedResult = parseSellerAuthUserInfoResponse(origin, response, responseText);

        lastResult = parsedResult;

        if (parsedResult.status === 'online' && parsedResult.malls.length > 0) {
          updateShopSellerAuthSessionSnapshot(shopEntry, {
            responseType: 'seller-auth-user-info',
            origin: parsedResult.origin,
            hostname: parsedResult.hostname,
            accountId: parsedResult.accountId,
            malls: parsedResult.malls
          });
          return normalizeSellerAuthSessionSnapshot(shopEntry.lastSellerAuthSessionSnapshot);
        }
      } catch (error) {
        const parsedOrigin = parseUrl(origin);

        lastResult = {
          status: 'error',
          origin,
          hostname: normalizeText(parsedOrigin && parsedOrigin.hostname),
          requestUrl,
          httpStatus: 0,
          malls: [],
          mallNames: [],
          accountId: '',
          errorMessage: normalizeText(error && error.message)
        };
      }
    }

    return lastResult;
  }

  function buildShopSessionContext(shopEntry, snapshotOverride) {
    const snapshot = normalizeSellerAuthSessionSnapshot(
      snapshotOverride || (shopEntry && shopEntry.lastSellerAuthSessionSnapshot)
    );
    const malls = normalizeMallRecords(snapshot && snapshot.malls);
    const mallMatch = findMatchingMall(getShopTargetName(shopEntry), malls);
    const preferredMall =
      mallMatch.state === SHOP_MATCH_STATES.MATCHED && mallMatch.match
        ? mallMatch.match
        : (malls.length === 1 ? malls[0] : null);
    const platformShopId = normalizeText(preferredMall && preferredMall.mallId);
    const platformShopUniqueId = normalizeText(preferredMall && preferredMall.uniqueId);

    notifyResolvedPlatformShopId(shopEntry, platformShopId, platformShopUniqueId);

    return {
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      shopName: getShopTargetName(shopEntry),
      platformShopId,
      platformShopUniqueId,
      partition: normalizeText(shopEntry && shopEntry.partition),
      sellerSession: {
        origin: snapshot.origin,
        hostname: snapshot.hostname,
        status: snapshot.status,
        accountId: normalizeText(snapshot && snapshot.accountId),
        mallId: platformShopId,
        mallUniqueId: platformShopUniqueId,
        mallName: normalizeText(preferredMall && preferredMall.mallName),
        mallNames: snapshot.mallNames.slice(),
        malls: malls.map((mall) => ({
          mallId: normalizeText(mall && mall.mallId),
          mallName: normalizeText(mall && mall.mallName),
          uniqueId: normalizeText(mall && mall.uniqueId)
        }))
      }
    };
  }

  function buildOnlineSellerSessionLookupEntries(payload = {}) {
    const preferredShopId = normalizeText(payload && payload.shopId);
    const excludedShopIds = new Set(
      (Array.isArray(payload && payload.excludeShopIds) ? payload.excludeShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    );
    const activeShopId = normalizeText(activeDescriptor && activeDescriptor.shopId);
    const candidateEntries = preferredShopId
      ? [shopEntriesById.get(preferredShopId)].filter(Boolean)
      : Array.from(shopEntriesById.values());

    return candidateEntries
      .filter((shopEntry) => {
        const shopId = normalizeText(shopEntry && shopEntry.shopId);

        return shopId && !excludedShopIds.has(shopId);
      })
      .sort((left, right) => {
        function getScore(shopEntry) {
          const shopId = normalizeText(shopEntry && shopEntry.shopId);
          const cachedSnapshot = normalizeSellerAuthSessionSnapshot(
            shopEntry && shopEntry.lastSellerAuthSessionSnapshot
          );
          let score = 0;

          if (shopId && shopId === activeShopId) {
            score += 400;
          }

          if (hasForegroundWorkspaceReadyTab(shopEntry, 'seller-center')) {
            score += 220;
          }

          if (hasForegroundWorkspaceReadyTab(shopEntry, 'product-promotion')) {
            score += 80;
          }

          if (cachedSnapshot.status === 'online') {
            score += 40;
          }

          score += Math.min(
            Math.floor(Math.max(0, Number(cachedSnapshot.updatedAt) || 0) / 1000),
            1000000
          ) / 1000000;

          return score;
        }

        return getScore(right) - getScore(left);
      });
  }

  function hasSellerCenterSessionCandidateView(shopEntry) {
    if (!shopEntry) {
      return false;
    }

    const sellerCenterPageEntry =
      shopEntry.pages instanceof Map
        ? shopEntry.pages.get('seller-center')
        : null;

    if (sellerCenterPageEntry && Array.isArray(sellerCenterPageEntry.order) && sellerCenterPageEntry.order.length > 0) {
      return true;
    }

    if (!(shopEntry.backgroundViews instanceof Map)) {
      return false;
    }

    return Array.from(shopEntry.backgroundViews.values()).some((backgroundEntry) => {
      return normalizeText(backgroundEntry && backgroundEntry.pageType) === 'seller-center';
    });
  }

  async function listOnlineSellerSessionContexts(payload = {}) {
    const candidateEntries = buildOnlineSellerSessionLookupEntries(payload);
    const includePending = payload && payload.includePending === true;
    const contexts = [];

    for (const shopEntry of candidateEntries) {
      if (!shopEntry || !normalizeText(shopEntry.partition)) {
        continue;
      }

      try {
        if (shopEntry.environment && shopEntry.environmentSignature) {
          await ensureEnvironmentApplied(shopEntry);
        }
      } catch (error) {
        logError('shop_online_session_environment_apply_failed', error, {
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          partition: normalizeText(shopEntry && shopEntry.partition)
        });
      }

      const cachedSnapshot = normalizeSellerAuthSessionSnapshot(
        shopEntry.lastSellerAuthSessionSnapshot
      );
      let liveSnapshot = null;

      try {
        liveSnapshot = await probeSellerAuthSessionForShopEntry(shopEntry);
      } catch (error) {
        logError('shop_online_session_probe_failed', error, {
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          partition: normalizeText(shopEntry && shopEntry.partition)
        });
        continue;
      }

      const normalizedLiveSnapshot = normalizeSellerAuthSessionSnapshot(liveSnapshot);

      if (isSellerAuthSessionOnline(normalizedLiveSnapshot)) {
        contexts.push(buildShopSessionContext(shopEntry, normalizedLiveSnapshot));
        continue;
      }

      if (isSellerAuthSessionOnline(cachedSnapshot)) {
        contexts.push(buildShopSessionContext(shopEntry, cachedSnapshot));
        continue;
      }

      if (includePending && hasSellerCenterSessionCandidateView(shopEntry)) {
        contexts.push(buildShopSessionContext(shopEntry, normalizedLiveSnapshot));
      }
    }

    return contexts;
  }

  function getShopSellerAuthSnapshotMalls(shopEntry) {
    return normalizeMallRecords(
      shopEntry
      && shopEntry.lastSellerAuthSessionSnapshot
      && shopEntry.lastSellerAuthSessionSnapshot.malls
    );
  }

  function findMatchingMall(targetShopName, malls) {
    const normalizedTargetShopName = normalizeShopMatchText(targetShopName);
    const normalizedMalls = normalizeMallRecords(malls);

    if (!normalizedTargetShopName || normalizedMalls.length === 0) {
      return {
        state: SHOP_MATCH_STATES.MISSING,
        match: null,
        matches: []
      };
    }

    const exactMatches = normalizedMalls.filter(
      (mall) => normalizeShopMatchText(mall.mallName) === normalizedTargetShopName
    );

    if (exactMatches.length === 1) {
      return {
        state: SHOP_MATCH_STATES.MATCHED,
        match: exactMatches[0],
        matches: exactMatches
      };
    }

    if (exactMatches.length > 1) {
      return {
        state: SHOP_MATCH_STATES.AMBIGUOUS,
        match: null,
        matches: exactMatches
      };
    }

    const looseMatches = normalizedMalls.filter((mall) => {
      const normalizedMallName = normalizeShopMatchText(mall.mallName);

      return (
        normalizedMallName.includes(normalizedTargetShopName)
        || normalizedTargetShopName.includes(normalizedMallName)
      );
    });

    if (looseMatches.length === 1) {
      return {
        state: SHOP_MATCH_STATES.MATCHED,
        match: looseMatches[0],
        matches: looseMatches
      };
    }

    if (looseMatches.length > 1) {
      return {
        state: SHOP_MATCH_STATES.AMBIGUOUS,
        match: null,
        matches: looseMatches
      };
    }

    return {
      state: SHOP_MATCH_STATES.MISSING,
      match: null,
      matches: []
    };
  }

  function getAutomationState(view) {
    if (!automationStates.has(view)) {
      automationStates.set(view, {
        contextKey: '',
        currentUrl: '',
        verificationBlockedUrl: '',
        followUpCount: 0,
        lastAuthenticationRedirectUrl: '',
        lastAuthenticationRedirectAt: 0,
        phase: LOGIN_AUTOMATION_PHASES.IDLE,
        phaseChangedAt: 0,
        cooldownUntil: 0,
        lastAutofillAttemptAt: 0,
        lastAutofillStatus: '',
        autofillHelperReady: false,
        autofillHelperSignature: '',
        autofillHelperUrl: '',
        autofillHelperInstallPromise: null,
        pendingAutofillTrigger: '',
        pendingAutofillUrl: '',
        pendingAutofillDueAt: 0,
        lastAutofillLogAt: 0,
        lastAutofillLogStatus: '',
        lastAutofillLogUrl: '',
        lastLoginAuthConfigRefreshAt: 0,
        lastLoginAuthConfigRefreshUrl: '',
        lastDebugSnapshotAt: 0,
        lastDebugSnapshotStatus: '',
        lastDebugSnapshotUrl: '',
        lastAuthenticationEntryAt: 0,
        lastAuthenticationEntryUrl: '',
        lastAuthenticationEntryStatus: '',
        authenticationEntryHoldUntil: 0,
        lastAuthenticationEntryFallbackAt: 0,
        lastAuthenticationEntryFallbackUrl: '',
        lastAuthenticationEntryNoNavigationAt: 0,
        lastAuthenticationEntryNoNavigationUrl: '',
        lastAuthenticationEntryNoNavigationCount: 0,
        siteMainPopupHoldUntil: 0,
        lastLoginPageSessionProbeAt: 0,
        authRedirectHistory: [],
        lastSuccessUrl: '',
        lastSuccessAt: 0,
        lastSessionProbeAt: 0,
        lastSessionProbeStatus: '',
        pendingSessionProbeTrigger: '',
        pendingSessionProbeUrl: '',
        pendingSessionProbeDueAt: 0,
        lastSessionProbeLogAt: 0,
        lastSessionProbeLogStatus: '',
        lastSessionProbeLogUrl: '',
        lastSessionProbeLogKind: '',
        sessionProbeRunning: false,
        sessionProbeErrorCount: 0,
        lastMallSwitchAttemptAt: 0,
        lastMallSwitchTarget: '',
        lastMallSwitchStatus: '',
        lastSiteMainActionAt: 0,
        lastSiteMainStatus: '',
        lastSiteMainResult: null,
        lastSiteMainPendingCount: 0,
        lastSellerAuthHomeAt: 0,
        lastActivityLoginBridgeUrl: '',
        lastActivityLoginBridgeAt: 0,
        productPromotionBridgeRunning: false,
        lastProductPromotionBridgeToken: '',
        lastProductPromotionBridgeStatus: '',
        lastProductPromotionBridgeAt: 0,
        lastPopupMessageCaptureUrl: '',
        lastPopupMessageCaptureAt: 0,
        popupMessageForwardRunning: false,
        lastPopupMessageForwardToken: '',
        lastPopupMessageForwardStatus: '',
        lastPopupMessageForwardAt: 0
      });
    }

    return automationStates.get(view);
  }

  function buildAutomationContextKey(context) {
    if (!context || typeof context !== 'object') {
      return '';
    }

    const shopId = normalizeText(context.shopId);
    const pageType = normalizeText(context.pageType);
    const browserTabId = normalizeText(context.browserTabId);

    if (!shopId || !pageType) {
      return '';
    }

    return `${shopId}|${pageType}|${browserTabId || DEFAULT_BROWSER_TAB_ID}`;
  }

  function setAutomationPhase(context, state, nextPhase, options = {}) {
    const now = Number(options.now) || Date.now();
    const previousPhase = normalizeText(state && state.phase) || LOGIN_AUTOMATION_PHASES.IDLE;

    if (state) {
      state.phase = nextPhase;
      if (previousPhase !== nextPhase || !state.phaseChangedAt) {
        state.phaseChangedAt = now;
      }

      if (Object.prototype.hasOwnProperty.call(options, 'cooldownUntil')) {
        state.cooldownUntil = Number(options.cooldownUntil) || 0;
      }

      if (Object.prototype.hasOwnProperty.call(options, 'lastAutofillStatus')) {
        state.lastAutofillStatus = normalizeText(options.lastAutofillStatus).toLowerCase();
      }
    }

    if (previousPhase !== nextPhase) {
      log('shop_login_automation_phase_changed', {
        shopId: context && context.shopId ? context.shopId : '',
        pageType: context && context.pageType ? context.pageType : '',
        browserTabId: context && context.browserTabId ? context.browserTabId : '',
        previousPhase,
        nextPhase,
        reason: normalizeText(options.reason),
        url: normalizeText(options.url || (state && state.currentUrl))
      });
    }
  }

  function pruneAuthRedirectHistory(state, now) {
    const timestamp = Number(now) || Date.now();
    const history = Array.isArray(state && state.authRedirectHistory)
      ? state.authRedirectHistory
      : [];

    state.authRedirectHistory = history.filter(
      (entry) => Number(entry) > 0 && timestamp - Number(entry) <= LOGIN_AUTOMATION_AUTH_REDIRECT_WINDOW_MS
    );

    return state.authRedirectHistory;
  }

  function isAutomationCooldownActive(state, now) {
    return Number(state && state.cooldownUntil) > (Number(now) || Date.now());
  }

  function clearManualAutomationBlock(state) {
    if (!state) {
      return;
    }

    state.verificationBlockedUrl = '';
    state.followUpCount = 0;
  }

  function markAutomationAuthenticated(context, state, currentUrl) {
    const now = Date.now();
    const url = normalizeText(currentUrl);
    const shouldLogSuccess =
      Boolean(state)
      && (
        state.phase !== LOGIN_AUTOMATION_PHASES.AUTHENTICATED
        || state.verificationBlockedUrl
        || state.cooldownUntil > 0
      );

    clearManualAutomationBlock(state);
    state.cooldownUntil = 0;
    state.lastAutofillStatus = '';
    state.lastSuccessUrl = url;
    state.lastSuccessAt = now;
    state.lastAuthenticationRedirectUrl = '';
    state.lastAuthenticationRedirectAt = 0;
    state.authRedirectHistory = [];
    state.authenticationEntryHoldUntil = 0;
    state.sessionProbeErrorCount = 0;
    state.lastSessionProbeStatus = 'online';
    state.lastMallSwitchStatus = '';

    setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.AUTHENTICATED, {
      now,
      reason: 'workspace-ready',
      url
    });

    if (shouldLogSuccess) {
      log('shop_login_authenticated', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url
      });
    }

    const shopEntry = shopEntriesById.get(normalizeText(context && context.shopId));

    if (shopEntry) {
      void persistShopPartitionNow(shopEntry, {
        reason: 'login-authenticated',
        pageType: normalizeText(context && context.pageType),
        browserTabId: normalizeText(context && context.browserTabId)
      }).catch((error) => {
        logError('shop_partition_persist_flush_failed', error, {
          shopId: normalizeText(context && context.shopId),
          pageType: normalizeText(context && context.pageType),
          browserTabId: normalizeText(context && context.browserTabId)
        });
      });
    }
  }

  function syncAutomationPhaseByUrl(context, state, currentUrl) {
    const url = normalizeText(currentUrl);

    if (!url) {
      return;
    }

    if (isManagedLoginEntryUrl(context.pageType, url)) {
      return;
    }

    if (isLoginAutofillUrl(url)) {
      if (state.phase !== LOGIN_AUTOMATION_PHASES.WAITING_MANUAL_VERIFICATION) {
        setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.LOGIN_PAGE, {
          reason: 'login-page-ready',
          url
        });
      }
      return;
    }

    if (context.pageType === 'seller-center' && isSellerCenterAuthHomeUrl(url)) {
      state.lastSellerAuthHomeAt = Date.now();
    }

    if (isWorkspaceReadyUrl(context.pageType, url)) {
      markAutomationAuthenticated(context, state, url);
    }
  }

  function syncAutomationState(view, currentUrl, context = null) {
    const state = getAutomationState(view);
    const nextContextKey = buildAutomationContextKey(context);

    if (
      nextContextKey
      && state.contextKey
      && state.contextKey !== nextContextKey
    ) {
      clearLoginAutofillTimer(view);
      clearSellerSessionStatusTimer(view);
      state.verificationBlockedUrl = '';
      state.followUpCount = 0;
      state.cooldownUntil = 0;
      state.lastAutofillAttemptAt = 0;
      state.lastAutofillStatus = '';
      state.lastLoginAuthConfigRefreshAt = 0;
      state.lastLoginAuthConfigRefreshUrl = '';
      state.lastDebugSnapshotAt = 0;
      state.lastDebugSnapshotStatus = '';
      state.lastDebugSnapshotUrl = '';
      state.autofillHelperReady = false;
      state.autofillHelperSignature = '';
      state.autofillHelperUrl = '';
      state.autofillHelperInstallPromise = null;
      state.pendingAutofillTrigger = '';
      state.pendingAutofillUrl = '';
      state.pendingAutofillDueAt = 0;
      state.lastAutofillLogAt = 0;
      state.lastAutofillLogStatus = '';
      state.lastAutofillLogUrl = '';
    }

    if (nextContextKey && state.contextKey !== nextContextKey) {
      state.contextKey = nextContextKey;
    }

    if (state.currentUrl !== currentUrl) {
      state.currentUrl = currentUrl;
      state.followUpCount = 0;
      state.autofillHelperReady = false;
      state.autofillHelperUrl = '';
      state.autofillHelperInstallPromise = null;
      state.lastAuthenticationEntryNoNavigationAt = 0;
      state.lastAuthenticationEntryNoNavigationUrl = '';
      state.lastAuthenticationEntryNoNavigationCount = 0;
      state.siteMainPopupHoldUntil = 0;

      if (state.verificationBlockedUrl && state.verificationBlockedUrl !== currentUrl) {
        state.verificationBlockedUrl = '';
      }
    }

    return state;
  }

  function resolveCurrentTabPopupTargetUrl(view, context, targetUrl) {
    if (
      !isViewUsable(view)
      || !context
      || normalizeText(context.pageType) !== 'seller-center'
    ) {
      return '';
    }

    const currentUrl = normalizeText(view.webContents.getURL());

    if (!isSellerCenterAuthHomeUrl(currentUrl)) {
      return '';
    }

    if (
      !isSellerCenterWorkspaceUrl(targetUrl)
      || isAuthenticationPageUrl(targetUrl)
      || isLoginAutofillUrl(targetUrl)
      || isSellerCenterAuthHomeUrl(targetUrl)
    ) {
      return '';
    }

    const state = syncAutomationState(view, currentUrl);
    const lastSellerAuthHomeAt = Number(state && state.lastSellerAuthHomeAt) || 0;

    if (
      lastSellerAuthHomeAt > 0
      && Date.now() - lastSellerAuthHomeAt <= SELLER_CENTER_AUTH_HOME_POPUP_REUSE_WINDOW_MS
    ) {
      return normalizeText(targetUrl);
    }

    return '';
  }

  function getManagedEntryCurrentUrl(entry) {
    if (!entry || typeof entry !== 'object') {
      return '';
    }

    if (isViewUsable(entry.view)) {
      const liveUrl = normalizeText(entry.view.webContents.getURL());

      if (liveUrl && !/^about:blank$/i.test(liveUrl)) {
        return liveUrl;
      }
    }

    return normalizeText(entry.meta && entry.meta.url);
  }

  function collectSellerCenterManagedEntries(shopEntry, pageType) {
    if (!shopEntry) {
      return [];
    }

    const normalizedPageType = normalizeText(pageType);
    const pageEntry = shopEntry.pages.get(normalizedPageType);
    const pageTabs = pageEntry && pageEntry.tabs
      ? Array.from(pageEntry.tabs.values())
      : [];
    const backgroundTabs = shopEntry.backgroundViews
      ? Array.from(shopEntry.backgroundViews.values()).filter((entry) => (
        normalizeText(entry && entry.pageType) === normalizedPageType
      ))
      : [];

    return pageTabs.concat(backgroundTabs);
  }

  function isSamePopupOpenerDescriptor(popupOpener, context) {
    return Boolean(
      popupOpener
      && context
      && popupOpener.shopId === normalizeText(context.shopId)
      && popupOpener.pageType === normalizeText(context.pageType)
      && popupOpener.browserTabId === normalizeText(context.browserTabId)
    );
  }

  function isSellerCenterPopupFlowEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const popupOpener = normalizeBrowserTabDescriptor(entry.popupOpener);

    if (!popupOpener) {
      return false;
    }

    return Boolean(getSellerCenterPopupUrlKind(getManagedEntryCurrentUrl(entry)));
  }

  function findReusablePopupEntry(shopEntry, context, targetUrl) {
    if (
      !shopEntry
      || !context
      || normalizeText(context.pageType) !== 'seller-center'
    ) {
      return null;
    }

    const targetKind = getSellerCenterPopupUrlKind(targetUrl);

    if (!targetKind) {
      return null;
    }

    const candidates = collectSellerCenterManagedEntries(shopEntry, context.pageType);

    for (const entry of candidates) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const popupOpener = normalizeBrowserTabDescriptor(entry.popupOpener);

      if (!isSamePopupOpenerDescriptor(popupOpener, context)) {
        continue;
      }

      const entryUrl = getManagedEntryCurrentUrl(entry);

      if (getSellerCenterPopupUrlKind(entryUrl) !== targetKind) {
        continue;
      }

      return entry;
    }

    for (const entry of candidates) {
      if (!isSellerCenterPopupFlowEntry(entry)) {
        continue;
      }

      const entryUrl = getManagedEntryCurrentUrl(entry);

      if (getSellerCenterPopupUrlKind(entryUrl) !== targetKind) {
        continue;
      }

      return entry;
    }

    return null;
  }

  function hasSellerCenterPopupFlowEntry(shopEntry, pageType) {
    if (
      !shopEntry
      || normalizeText(pageType) !== 'seller-center'
    ) {
      return false;
    }

    return collectSellerCenterManagedEntries(shopEntry, pageType).some((entry) => (
      isSellerCenterPopupFlowEntry(entry)
    ));
  }

  function normalizeRuntimeProfile(runtimeProfile) {
    const accountIdentity = resolveAccountIdentity(runtimeProfile);
    return {
      shopId: normalizeText(runtimeProfile && runtimeProfile.shopId),
      phoneNumber: accountIdentity.phoneNumber,
      email: accountIdentity.email,
      accountValue: accountIdentity.accountValue,
      accountType: accountIdentity.accountType,
      shopName: normalizeText(runtimeProfile && runtimeProfile.shopName),
      loginPassword: normalizeText(runtimeProfile && runtimeProfile.loginPassword),
      proxyConfig:
        runtimeProfile && runtimeProfile.proxyConfig && typeof runtimeProfile.proxyConfig === 'object'
          ? { ...runtimeProfile.proxyConfig }
          : null,
      fingerprintConfig:
        runtimeProfile && runtimeProfile.fingerprintConfig && typeof runtimeProfile.fingerprintConfig === 'object'
          ? { ...runtimeProfile.fingerprintConfig }
          : null,
      browserStorageAutoSyncEnabled: runtimeProfile && runtimeProfile.browserStorageAutoSyncEnabled !== false,
      updatedAt: normalizeText(runtimeProfile && runtimeProfile.updatedAt)
    };
  }

  function loadInCurrentView(view, url, options = null) {
    if (!isViewUsable(view) || !canLoadInCurrentView(url)) {
      return;
    }

    const loadOptions = options && typeof options === 'object'
      ? options
      : undefined;

    loadUrlIntoView(view, url, loadOptions, {
      reason: 'load-in-current-view'
    });
  }

  function navigateInCurrentViewFromPage(view, url, options = {}) {
    if (!isViewUsable(view) || !canLoadInCurrentView(url)) {
      return Promise.resolve({
        status: 'unavailable'
      });
    }

    return view.webContents.executeJavaScript(
      buildPageLocationNavigationScript({
        targetUrl: url,
        mode: normalizeText(options.mode) || 'assign'
      }),
      true
    );
  }

  async function waitForViewReady(view, options = {}) {
    if (!isViewUsable(view)) {
      return {
        status: 'unavailable'
      };
    }

    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 12000);
    const pollIntervalMs = Math.max(120, Number(options.pollIntervalMs) || 180);
    const deadline = Date.now() + timeoutMs;
    let lastReadyState = '';

    while (Date.now() < deadline) {
      if (!isViewUsable(view)) {
        break;
      }

      try {
        lastReadyState = normalizeText(
          await view.webContents.executeJavaScript('document.readyState', true)
        ).toLowerCase();
      } catch (_error) {
        lastReadyState = '';
      }

      if (lastReadyState === 'complete' || lastReadyState === 'interactive') {
        return {
          status: 'ready',
          readyState: lastReadyState,
          currentUrl: normalizeText(view.webContents.getURL())
        };
      }

      await new Promise((resolve) => {
        setTimeout(resolve, pollIntervalMs);
      });
    }

    return {
      status: 'timeout',
      readyState: lastReadyState,
      currentUrl: normalizeText(isViewUsable(view) ? view.webContents.getURL() : '')
    };
  }

  async function ensurePopupMessageCaptureBridge(view, context, currentUrl, state) {
    if (!isViewUsable(view) || !isLoginAutofillUrl(currentUrl)) {
      return false;
    }

    const tabEntry = getManagedEntry(context.shopId, context.pageType, context.browserTabId);
    const popupOpener = normalizeBrowserTabDescriptor(tabEntry && tabEntry.popupOpener);

    if (!popupOpener) {
      return false;
    }

    const now = Date.now();

    if (
      state.lastPopupMessageCaptureUrl === currentUrl
      && now - (Number(state.lastPopupMessageCaptureAt) || 0) < 800
    ) {
      return false;
    }

    state.lastPopupMessageCaptureUrl = currentUrl;
    state.lastPopupMessageCaptureAt = now;

    try {
      const result = await view.webContents.executeJavaScript(
        buildPopupMessageCaptureOpenerBridgeScript({
          hashKey: POPUP_MESSAGE_BRIDGE_HASH_KEY
        }),
        true
      );

      log('shop_popup_message_bridge_installed', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        popupOpener,
        result
      });
    } catch (error) {
      logError('shop_popup_message_bridge_install_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        popupOpener
      });
    }

    return false;
  }

  async function runPopupMessageBridge(view, context, currentUrl, state) {
    if (!isViewUsable(view)) {
      return false;
    }

    const popupPayload = getPopupMessageBridgePayload(currentUrl);

    if (!popupPayload) {
      return false;
    }

    const tabEntry = getManagedEntry(context.shopId, context.pageType, context.browserTabId);
    const popupOpener = normalizeBrowserTabDescriptor(tabEntry && tabEntry.popupOpener);
    const shopEntry = shopEntriesById.get(context.shopId);
    const now = Date.now();

    if (state.popupMessageForwardRunning) {
      return true;
    }

    if (
      state.lastPopupMessageForwardToken === popupPayload.token
      && now - (Number(state.lastPopupMessageForwardAt) || 0) < 3000
    ) {
      return true;
    }

    state.popupMessageForwardRunning = true;
    state.lastPopupMessageForwardToken = popupPayload.token;
    state.lastPopupMessageForwardAt = now;

    try {
      if (!popupOpener) {
        state.lastPopupMessageForwardStatus = 'missing-popup-opener';
        notifyBrowserTabMessage(
          context,
          '\u5F53\u524D\u767B\u5F55\u5F39\u7A97\u5DF2\u56DE\u4F20\u6388\u6743\u4FE1\u606F\uFF0C\u4F46\u672A\u627E\u5230\u5BF9\u5E94\u7684\u4E3B\u9875\u6807\u7B7E\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u6682\u505C\u3002',
          {
            persistent: true
          }
        );
        return true;
      }

      const openerTabEntry = getManagedEntry(
        popupOpener.shopId,
        popupOpener.pageType,
        popupOpener.browserTabId
      );
      const openerView = openerTabEntry && openerTabEntry.view;

      if (!isViewUsable(openerView)) {
        state.lastPopupMessageForwardStatus = 'missing-opener-view';
        notifyBrowserTabMessage(
          context,
          '\u5F53\u524D\u767B\u5F55\u5F39\u7A97\u5DF2\u56DE\u4F20\u6388\u6743\u4FE1\u606F\uFF0C\u4F46\u4E3B\u9875\u4E0A\u4E0B\u6587\u5DF2\u4E22\u5931\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u6682\u505C\u3002',
          {
            persistent: true
          }
        );
        return true;
      }

      const dispatchResult = await openerView.webContents.executeJavaScript(
        buildPopupMessageDispatchScript({
          message: popupPayload.message
        }),
        true
      );
      const dispatchStatus = normalizeText(dispatchResult && dispatchResult.status).toLowerCase();

      state.lastPopupMessageForwardStatus = dispatchStatus;

      log('shop_popup_message_bridge_forwarded', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        popupOpener,
        messageScene: normalizeText(popupPayload.message && popupPayload.message.scene),
        messageAction: Number(popupPayload.message && popupPayload.message.action) || 0,
        dispatchResult
      });

      if (dispatchStatus === 'posted' || dispatchStatus === 'dispatched') {
        persistPopupResolvedPlatformShopIdentity(shopEntry, popupPayload.message);
        await closeBrowserTab({
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          activateBrowserTabId: popupOpener.browserTabId
        });
        return true;
      }

      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u767B\u5F55\u5F39\u7A97\u5DF2\u56DE\u4F20\u6388\u6743\u4FE1\u606F\uFF0C\u4F46\u4E3B\u9875\u63A5\u529B\u5931\u8D25\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u6682\u505C\u3002',
        {
          persistent: true
        }
      );
      return true;
    } catch (error) {
      state.lastPopupMessageForwardStatus = 'error';
      logError('shop_popup_message_bridge_forward_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        popupOpener
      });
      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u767B\u5F55\u5F39\u7A97\u5DF2\u56DE\u4F20\u6388\u6743\u4FE1\u606F\uFF0C\u4F46\u4E3B\u9875\u63A5\u529B\u5F02\u5E38\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u6682\u505C\u3002',
        {
          persistent: true
        }
      );
      return true;
    } finally {
      state.popupMessageForwardRunning = false;
    }
  }

  async function ensureProductPromotionActivityLoginOpenerBridge(view, context, currentUrl, state) {
    if (
      !isViewUsable(view)
      || context.pageType !== 'product-promotion'
      || !isProductPromotionActivityLoginPageUrl(currentUrl)
    ) {
      return false;
    }

    const now = Date.now();

    if (
      state.lastActivityLoginBridgeUrl === currentUrl
      && now - (Number(state.lastActivityLoginBridgeAt) || 0) < 800
    ) {
      return false;
    }

    state.lastActivityLoginBridgeUrl = currentUrl;
    state.lastActivityLoginBridgeAt = now;

    try {
      const result = await view.webContents.executeJavaScript(
        buildProductPromotionActivityLoginOpenerBridgeScript({
          bridgeHashKey: PRODUCT_PROMOTION_ACTIVITY_BRIDGE_HASH_KEY,
          adsLoginUrl: PRODUCT_PROMOTION_ACTIVITY_LOGIN_URL
        }),
        true
      );

      log('shop_product_promotion_activity_login_bridge_installed', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        result
      });
    } catch (error) {
      logError('shop_product_promotion_activity_login_bridge_install_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl
      });
    }

    return false;
  }

  async function runProductPromotionActivityBridge(view, context, currentUrl, state) {
    if (
      !isViewUsable(view)
      || context.pageType !== 'product-promotion'
      || !isAdsLoginPageUrl(currentUrl)
    ) {
      return false;
    }

    const bridgeToken = getProductPromotionActivityBridgeToken(currentUrl);

    if (!bridgeToken) {
      return false;
    }

    const now = Date.now();

    if (state.productPromotionBridgeRunning) {
      return true;
    }

    if (
      state.lastProductPromotionBridgeToken === bridgeToken
      && now - (Number(state.lastProductPromotionBridgeAt) || 0) < 3000
    ) {
      return true;
    }

    state.productPromotionBridgeRunning = true;
    state.lastProductPromotionBridgeToken = bridgeToken;
    state.lastProductPromotionBridgeAt = now;

    notifyBrowserTabMessage(
      context,
      '\u5546\u54C1\u63A8\u5E7F\u767B\u5F55\u5DF2\u83B7\u53D6\u6388\u6743\u7801\uFF0C\u6B63\u5728\u5728\u5F53\u524D\u9875\u9762\u6062\u590D\u767B\u5F55\u4F1A\u8BDD\u3002',
      {
        durationMs: 4200
      }
    );

    try {
      const result = await view.webContents.executeJavaScript(
        buildProductPromotionBridgeLoginScript({
          bridgeHashKey: PRODUCT_PROMOTION_ACTIVITY_BRIDGE_HASH_KEY,
          workspaceUrl: PRODUCT_PROMOTION_HOME_REQUIRED_URL
        }),
        true
      );
      const status = normalizeText(result && result.status).toLowerCase();

      state.lastProductPromotionBridgeStatus = status;

      log('shop_product_promotion_activity_login_bridge_result', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        result
      });

      if (status === 'navigating') {
        setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.REDIRECTING_LOGIN, {
          now: Date.now(),
          reason: 'activity-login-bridge-success',
          url: currentUrl
        });
        return true;
      }

      if (status === 'missing-bridge-payload') {
        return false;
      }

      notifyBrowserTabMessage(
        context,
        '\u5546\u54C1\u63A8\u5E7F\u6388\u6743\u7801\u5DF2\u56DE\u4F20\uFF0C\u4F46\u672A\u80FD\u5728 ads \u9875\u9762\u5B8C\u6210\u4F1A\u8BDD\u63A5\u529B\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u5728\u5F53\u524D\u9875\u9762\u6682\u505C\u3002',
        {
          persistent: true
        }
      );
      return true;
    } catch (error) {
      state.lastProductPromotionBridgeStatus = 'error';
      logError('shop_product_promotion_activity_login_bridge_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl
      });
      notifyBrowserTabMessage(
        context,
        '\u5546\u54C1\u63A8\u5E7F\u6388\u6743\u7801\u5DF2\u56DE\u4F20\uFF0C\u4F46\u5F53\u524D\u9875\u9762\u63A5\u529B\u767B\u5F55\u5931\u8D25\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u5728\u5F53\u524D\u9875\u9762\u6682\u505C\u3002',
        {
          persistent: true
        }
      );
      return true;
    } finally {
      state.productPromotionBridgeRunning = false;
    }
  }

  function buildRendererTab(tabMeta) {
    return {
      id: tabMeta.id,
      title: tabMeta.title,
      url: tabMeta.url
    };
  }

  function buildTabMeta(pageType, tabId, sequence, url) {
    return {
      id: tabId,
      title: `${getWorkspaceLabel(pageType)} ${sequence}`,
      url: url || getWorkspaceUrl(pageType)
    };
  }

  function createPageEntry(pageType) {
    const defaultTabMeta = buildTabMeta(pageType, DEFAULT_BROWSER_TAB_ID, 1, getWorkspaceUrl(pageType));

    return {
      pageType,
      autoLoginEnabled: true,
      order: [defaultTabMeta.id],
      tabs: new Map([
        [
          defaultTabMeta.id,
          {
            meta: defaultTabMeta,
            view: null,
            popupOpener: null,
            lastUsedAt: 0
          }
        ]
      ]),
      nextSequence: 2
    };
  }

  function isSameDescriptor(left, right) {
    return Boolean(
      left
      && right
      && left.shopId === right.shopId
      && left.pageType === right.pageType
      && left.browserTabId === right.browserTabId
    );
  }

  function ensureShopEntry(payload) {
    const shopId = String((payload && payload.shopId) || '').trim();

    if (!shopEntriesById.has(shopId)) {
      shopEntriesById.set(shopId, {
        shopId,
        partition: getPartition(payload),
        pages: new Map(),
        backgroundViews: new Map(),
        environment: null,
        environmentSignature: '',
        appliedEnvironmentSignature: '',
        phoneNumber: '',
        shopName: '',
        runtimeProfile: null,
        runtimeProfileVersion: '',
        lastSellerAuthSessionSnapshot: null,
        lastResolvedPlatformShopId: '',
        lastResolvedPlatformShopIdentityKey: '',
        backgroundStorageRestoreSignature: '',
        backgroundStorageRestorePromise: null,
        backgroundStorageRestoreCompletedAt: 0,
        backgroundStorageRestoreFailedAt: 0,
        backgroundStorageRestoreLastError: '',
        environmentApplySignature: '',
        environmentApplyPromise: null
      });
    }

    return shopEntriesById.get(shopId);
  }

  function ensurePageEntry(shopEntry, pageType) {
    if (!shopEntry.pages.has(pageType)) {
      shopEntry.pages.set(pageType, createPageEntry(pageType));
    }

    return shopEntry.pages.get(pageType);
  }

  function ensureTabEntry(pageEntry, pageType, browserTabId) {
    const normalizedTabId = String(browserTabId || DEFAULT_BROWSER_TAB_ID).trim() || DEFAULT_BROWSER_TAB_ID;

    if (!pageEntry.tabs.has(normalizedTabId)) {
      const tabMeta = buildTabMeta(pageType, normalizedTabId, pageEntry.nextSequence, getWorkspaceUrl(pageType));
      pageEntry.nextSequence += 1;
      pageEntry.tabs.set(normalizedTabId, {
        meta: tabMeta,
        view: null,
        popupOpener: null,
        lastUsedAt: 0
      });
      pageEntry.order.push(normalizedTabId);
    }

    return pageEntry.tabs.get(normalizedTabId);
  }

  function isPageAutoLoginEnabled(shopId, pageType) {
    const shopEntry = shopEntriesById.get(normalizeText(shopId));

    if (!shopEntry) {
      return true;
    }

    const pageEntry = shopEntry.pages.get(normalizeText(pageType));

    if (!pageEntry) {
      return true;
    }

    return pageEntry.autoLoginEnabled !== false;
  }

  function getTabEntry(shopId, pageType, browserTabId) {
    const shopEntry = shopEntriesById.get(shopId);

    if (!shopEntry) {
      return null;
    }

    const pageEntry = shopEntry.pages.get(pageType);

    if (!pageEntry) {
      return null;
    }

    return pageEntry.tabs.get(browserTabId) || null;
  }

  function getBackgroundViewEntryByBrowserTabId(shopId, pageType, browserTabId) {
    const shopEntry = shopEntriesById.get(normalizeText(shopId));

    if (!shopEntry || !shopEntry.backgroundViews) {
      return null;
    }

    return Array.from(shopEntry.backgroundViews.values()).find((backgroundEntry) => (
      normalizeText(backgroundEntry && backgroundEntry.pageType) === normalizeText(pageType)
      && normalizeText(backgroundEntry && backgroundEntry.meta && backgroundEntry.meta.id) === normalizeText(browserTabId)
    )) || null;
  }

  function getManagedEntry(shopId, pageType, browserTabId) {
    return getTabEntry(shopId, pageType, browserTabId)
      || getBackgroundViewEntryByBrowserTabId(shopId, pageType, browserTabId);
  }

  function markTabEntryUsed(shopId, pageType, browserTabId, timestamp = Date.now()) {
    const tabEntry = getTabEntry(
      normalizeText(shopId),
      normalizeText(pageType),
      normalizeText(browserTabId)
    );

    if (!tabEntry) {
      return;
    }

    tabEntry.lastUsedAt = Math.max(0, Number(timestamp) || Date.now());
  }

  function getBackgroundViewEntry(shopEntry, pageType, backgroundGroupKey, entryId = 'default') {
    if (!shopEntry || !shopEntry.backgroundViews) {
      return null;
    }

    return shopEntry.backgroundViews.get(
      buildBackgroundViewKey(pageType, backgroundGroupKey, entryId)
    ) || null;
  }

  function ensureBackgroundViewEntry(shopEntry, pageType, backgroundGroupKey, entryId = 'default', url = '') {
    const normalizedPageType = normalizeText(pageType) || 'seller-center';
    const normalizedGroupKey = normalizeText(backgroundGroupKey) || 'background';
    const normalizedEntryId = normalizeText(entryId) || 'default';
    const entryKey = buildBackgroundViewKey(normalizedPageType, normalizedGroupKey, normalizedEntryId);

    if (!shopEntry.backgroundViews.has(entryKey)) {
      const browserTabId = buildBackgroundViewId(normalizedPageType, normalizedGroupKey, normalizedEntryId);
      const initialUrl = normalizeText(url) || getWorkspaceUrl(normalizedPageType);

      shopEntry.backgroundViews.set(entryKey, {
        key: entryKey,
        pageType: normalizedPageType,
        backgroundGroupKey: normalizedGroupKey,
        meta: {
          id: browserTabId,
          title: `${getWorkspaceLabel(normalizedPageType)} \u540e\u53f0`,
          url: initialUrl
        },
        view: null,
        popupOpener: null,
        context: {
          shopId: shopEntry.shopId,
          pageType: normalizedPageType,
          browserTabId,
          backgroundGroupKey: normalizedGroupKey,
          backgroundEntryId: normalizedEntryId,
          suppressRendererNotifications: true
        }
      });
    }

    return shopEntry.backgroundViews.get(entryKey);
  }

  function hasForegroundWorkspaceReadyTab(shopEntry, pageType) {
    if (!shopEntry || !shopEntry.pages) {
      return false;
    }

    const pageEntry = shopEntry.pages.get(normalizeText(pageType));

    if (!pageEntry || !pageEntry.tabs) {
      return false;
    }

    return Array.from(pageEntry.tabs.values()).some((tabEntry) => {
      const currentUrl = normalizeText(
        isViewUsable(tabEntry && tabEntry.view)
          ? tabEntry.view.webContents.getURL()
          : tabEntry && tabEntry.meta && tabEntry.meta.url
      );

      return isWorkspaceReadyUrl(pageType, currentUrl);
    });
  }

  function normalizeBrowserTabDescriptor(descriptor) {
    const normalizedDescriptor = descriptor && typeof descriptor === 'object'
      ? descriptor
      : null;
    const shopId = normalizeText(normalizedDescriptor && normalizedDescriptor.shopId);
    const pageType = normalizeText(normalizedDescriptor && normalizedDescriptor.pageType);
    const browserTabId = normalizeText(normalizedDescriptor && normalizedDescriptor.browserTabId);

    if (!shopId || !pageType || !browserTabId) {
      return null;
    }

    return {
      shopId,
      pageType,
      browserTabId
    };
  }

  function getPopupOpenerDescriptor(descriptor) {
    const normalizedDescriptor = normalizeBrowserTabDescriptor(descriptor);

    if (!normalizedDescriptor) {
      return null;
    }

    const tabEntry = getManagedEntry(
      normalizedDescriptor.shopId,
      normalizedDescriptor.pageType,
      normalizedDescriptor.browserTabId
    );

    return normalizeBrowserTabDescriptor(tabEntry && tabEntry.popupOpener);
  }

  function collectWorkspacePreservedDescriptors(descriptor) {
    const normalizedDescriptor = normalizeBrowserTabDescriptor(descriptor);
    const preservedDescriptors = normalizedDescriptor ? [normalizedDescriptor] : [];
    const popupOpenerDescriptor = getPopupOpenerDescriptor(normalizedDescriptor);

    if (
      popupOpenerDescriptor
      && !preservedDescriptors.some((item) => isSameDescriptor(item, popupOpenerDescriptor))
    ) {
      preservedDescriptors.push(popupOpenerDescriptor);
    }

    return preservedDescriptors;
  }

  function getActiveView() {
    if (!activeDescriptor) {
      return null;
    }

    const tabEntry = getTabEntry(
      activeDescriptor.shopId,
      activeDescriptor.pageType,
      activeDescriptor.browserTabId
    );

    return tabEntry && tabEntry.view ? tabEntry.view : null;
  }

  function getReusableActiveTabEntry(targetDescriptor, shopUpdatedAt = '', workspaceEnvironmentKey = '') {
    if (
      !activeDescriptor
      || !isSameDescriptor(activeDescriptor, targetDescriptor)
      || normalizeText(activeDescriptor.shopUpdatedAt) !== normalizeText(shopUpdatedAt)
      || normalizeText(activeDescriptor.workspaceEnvironmentKey) !== normalizeText(workspaceEnvironmentKey)
    ) {
      return null;
    }

    const tabEntry = getTabEntry(
      targetDescriptor.shopId,
      targetDescriptor.pageType,
      targetDescriptor.browserTabId
    );

    if (!tabEntry || !isViewUsable(tabEntry.view)) {
      return null;
    }

    return tabEntry;
  }

  function removeViewFromWindow(view) {
    if (!view || !isWindowAlive()) {
      return;
    }

    try {
      mainWindow.contentView.removeChildView(view);
      attachedViews.delete(view);
    } catch (_error) {
      // Ignore detach failures when the view is no longer attached.
    }
  }

  function hideViewForCache(view) {
    if (!view) {
      return;
    }

    try {
      view.setVisible(false);
      view.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    } catch (_error) {
      // Ignore hide failures for cached views.
    }
  }

  function destroyView(view) {
    if (!view) {
      return;
    }

    clearLoginAutofillTimer(view);
    clearSellerSessionStatusTimer(view);
    clearViewLoadRetryTimer(view);

    try {
      view.setVisible(false);
      view.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    } catch (_error) {
      // Ignore cleanup bounds failures.
    }

    removeViewFromWindow(view);

    if (isViewUsable(view)) {
      try {
        view.webContents.close();
      } catch (_error) {
        // Ignore close failures during cleanup.
      }
    }
  }

  function resetShopViews(shopEntry) {
    shopEntry.pages.forEach((pageEntry) => {
      pageEntry.tabs.forEach((tabEntry) => {
        destroyView(tabEntry.view);
        tabEntry.view = null;
      });
    });

    if (shopEntry.backgroundViews) {
      shopEntry.backgroundViews.forEach((backgroundEntry) => {
        destroyView(backgroundEntry.view);
        backgroundEntry.view = null;
      });
      shopEntry.backgroundViews.clear();
    }
  }

  function resetPageEntryTabs(pageEntry) {
    const defaultTabMeta = buildTabMeta(pageEntry.pageType, DEFAULT_BROWSER_TAB_ID, 1, getWorkspaceUrl(pageEntry.pageType));

    pageEntry.tabs = new Map([
      [
        defaultTabMeta.id,
        {
          meta: defaultTabMeta,
          view: null,
          popupOpener: null,
          lastUsedAt: 0
        }
      ]
    ]);
    pageEntry.order = [defaultTabMeta.id];
    pageEntry.nextSequence = 2;
  }

  function resetShopBrowserTabs(shopEntry, pageTypes) {
    const targetPageTypes = Array.isArray(pageTypes) && pageTypes.length > 0
      ? pageTypes
      : Object.keys(WORKSPACE_URLS);

    targetPageTypes.forEach((pageType) => {
      const pageEntry = ensurePageEntry(shopEntry, pageType);

      pageEntry.tabs.forEach((tabEntry) => {
        destroyView(tabEntry.view);
      });
      resetPageEntryTabs(pageEntry);
    });

    if (shopEntry.backgroundViews) {
      Array.from(shopEntry.backgroundViews.entries()).forEach(([entryKey, backgroundEntry]) => {
        if (!targetPageTypes.includes(backgroundEntry.pageType)) {
          return;
        }

        destroyView(backgroundEntry.view);
        shopEntry.backgroundViews.delete(entryKey);
      });
    }

    notifyBrowserTabReset(shopEntry.shopId, targetPageTypes);
  }

  async function clearShopPartitionData(partition) {
    const normalizedPartition = normalizeText(partition);

    if (!normalizedPartition) {
      return;
    }

    const targetSession = session.fromPartition(normalizedPartition);

    await targetSession.clearStorageData();
    await targetSession.clearCache();

    if (typeof targetSession.clearAuthCache === 'function') {
      await targetSession.clearAuthCache();
    }
  }

  function destroyAllLiveViewsExcept(descriptorOrDescriptors) {
    const preservedDescriptors = Array.isArray(descriptorOrDescriptors)
      ? descriptorOrDescriptors
        .map((descriptor) => normalizeBrowserTabDescriptor(descriptor))
        .filter(Boolean)
      : [normalizeBrowserTabDescriptor(descriptorOrDescriptors)].filter(Boolean);
    const activePreservedDescriptor = preservedDescriptors[0] || null;

    shopEntriesById.forEach((shopEntry) => {
      shopEntry.pages.forEach((pageEntry) => {
        pageEntry.tabs.forEach((tabEntry) => {
          const currentDescriptor = {
            shopId: shopEntry.shopId,
            pageType: pageEntry.pageType,
            browserTabId: tabEntry.meta.id
          };

          if (preservedDescriptors.some((descriptor) => isSameDescriptor(currentDescriptor, descriptor))) {
            if (
              !isSameDescriptor(currentDescriptor, activePreservedDescriptor)
              && isViewUsable(tabEntry.view)
            ) {
              try {
                tabEntry.view.setVisible(false);
              } catch (_error) {
                // Ignore hide failures for preserved background views.
              }
            }
            return;
          }

          if (!tabEntry.view) {
            return;
          }

          destroyView(tabEntry.view);
          tabEntry.view = null;
        });
      });
    });
  }

  function hideAndTrimLiveViewsExcept(descriptorOrDescriptors) {
    const preservedDescriptors = Array.isArray(descriptorOrDescriptors)
      ? descriptorOrDescriptors
        .map((descriptor) => normalizeBrowserTabDescriptor(descriptor))
        .filter(Boolean)
      : [normalizeBrowserTabDescriptor(descriptorOrDescriptors)].filter(Boolean);
    const activePreservedDescriptor = preservedDescriptors[0] || null;
    const cachedEntries = [];

    shopEntriesById.forEach((shopEntry) => {
      shopEntry.pages.forEach((pageEntry) => {
        pageEntry.tabs.forEach((tabEntry) => {
          const currentDescriptor = {
            shopId: shopEntry.shopId,
            pageType: pageEntry.pageType,
            browserTabId: tabEntry.meta.id
          };

          if (!isViewUsable(tabEntry.view)) {
            return;
          }

          if (preservedDescriptors.some((descriptor) => isSameDescriptor(currentDescriptor, descriptor))) {
            if (!isSameDescriptor(currentDescriptor, activePreservedDescriptor)) {
              hideViewForCache(tabEntry.view);
            }
            return;
          }

          hideViewForCache(tabEntry.view);
          cachedEntries.push({
            tabEntry
          });
        });
      });
    });

    cachedEntries
      .sort((left, right) => (
        Math.max(0, Number(left && left.tabEntry && left.tabEntry.lastUsedAt) || 0)
        - Math.max(0, Number(right && right.tabEntry && right.tabEntry.lastUsedAt) || 0)
      ))
      .slice(0, Math.max(0, cachedEntries.length - MAX_INACTIVE_PAGE_VIEW_CACHE))
      .forEach((entry) => {
        if (!entry || !entry.tabEntry || !entry.tabEntry.view) {
          return;
        }

        destroyView(entry.tabEntry.view);
        entry.tabEntry.view = null;
      });
  }

  function clearActiveDescriptorForShop(shopId) {
    if (activeDescriptor && activeDescriptor.shopId === shopId) {
      activeDescriptor = null;
    }
  }

  function normalizeBounds(bounds) {
    const width = Math.max(0, Math.round(Number(bounds && bounds.width) || 0));
    const height = Math.max(0, Math.round(Number(bounds && bounds.height) || 0));

    return {
      x: Math.max(0, Math.round(Number(bounds && bounds.x) || 0)),
      y: Math.max(0, Math.round(Number(bounds && bounds.y) || 0)),
      width,
      height
    };
  }

  function areBoundsEqual(left, right) {
    return Boolean(
      left
      && right
      && left.x === right.x
      && left.y === right.y
      && left.width === right.width
      && left.height === right.height
    );
  }

  function updateTabMeta(shopId, pageType, browserTabId, changes) {
    const shopEntry = shopEntriesById.get(shopId);

    if (!shopEntry) {
      return;
    }

    const pageEntry = shopEntry.pages.get(pageType);

    if (!pageEntry || !pageEntry.tabs.has(browserTabId)) {
      return;
    }

    const tabEntry = pageEntry.tabs.get(browserTabId);
    const nextTitle = String(changes && changes.title || '').trim();
    const nextUrl = String(changes && changes.url || '').trim();
    let changed = false;

    if (nextTitle && nextTitle !== tabEntry.meta.title) {
      tabEntry.meta.title = nextTitle;
      changed = true;
    }

    if (nextUrl && nextUrl !== tabEntry.meta.url) {
      tabEntry.meta.url = nextUrl;
      changed = true;
    }

    if (changed) {
      notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_UPDATED, {
        shopId,
        pageType,
        tab: buildRendererTab(tabEntry.meta)
      });
    }
  }

  function attachNavigationListeners(view, context) {
    const { shopId, pageType, browserTabId } = context;

    view.webContents.on('before-input-event', (event, input) => {
      const inputType = normalizeText(input && input.type).toLowerCase();
      const key = normalizeText(input && input.key).toLowerCase();
      const code = normalizeText(input && input.code).toLowerCase();

      if (inputType !== 'keydown' || input && input.isAutoRepeat === true) {
        return;
      }

      if (key === 'f7' || code === 'f7') {
        event.preventDefault();
        requestBrowserUrlInput(context, view);
      }
    });

    view.webContents.on('page-title-updated', (_event, title) => {
      if (isBrowserLoadErrorPageUrl(normalizeText(view.webContents.getURL()))) {
        return;
      }

      updateTabMeta(shopId, pageType, browserTabId, {
        title
      });
    });

    view.webContents.on('did-start-loading', () => {
      const state = getViewLoadState(view);
      state.isLoading = true;
      const automationState = getAutomationState(view);

      automationState.autofillHelperReady = false;
      automationState.autofillHelperUrl = '';
      automationState.autofillHelperInstallPromise = null;
    });

    view.webContents.on('did-stop-loading', () => {
      const state = getViewLoadState(view);
      state.isLoading = false;
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      handleViewLoadFailure(
        view,
        context,
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      );
    });

    view.webContents.on('did-navigate', (_event, url) => {
      if (isBrowserLoadErrorPageUrl(url)) {
        return;
      }

      updateTabMeta(shopId, pageType, browserTabId, {
        url
      });
      if (!isManagedLoginEntryUrl(pageType, url) && !isLoginAutofillUrl(url)) {
        clearBrowserTabMessage(context);
      }
      queueLoginAutofillInjection(view, context, 'did-navigate', 120);
      queueSellerSessionStatusCheck(view, context, 'did-navigate', SELLER_SESSION_STATUS_INITIAL_DELAY_MS);
    });

    view.webContents.on('did-navigate-in-page', (_event, url) => {
      if (isBrowserLoadErrorPageUrl(url)) {
        return;
      }

      updateTabMeta(shopId, pageType, browserTabId, {
        url
      });
      if (!isManagedLoginEntryUrl(pageType, url) && !isLoginAutofillUrl(url)) {
        clearBrowserTabMessage(context);
      }
      queueLoginAutofillInjection(view, context, 'did-navigate-in-page', 80);
      queueSellerSessionStatusCheck(view, context, 'did-navigate-in-page', SELLER_SESSION_STATUS_INITIAL_DELAY_MS);
    });

    view.webContents.on('dom-ready', () => {
      const currentUrl = normalizeText(view.webContents.getURL());

      if (isBrowserLoadErrorPageUrl(currentUrl)) {
        return;
      }

      installWindowCloseGuard(view, context, 'dom-ready');
      queueLoginAutofillInjection(view, context, 'dom-ready', 60);
    });

    view.webContents.on('did-finish-load', () => {
      const currentUrl = normalizeText(view.webContents.getURL());
      const state = getViewLoadState(view);

      state.isLoading = false;

      if (isBrowserLoadErrorPageUrl(currentUrl)) {
        return;
      }

      clearViewLoadRetryTimer(view);
      state.retryCount = 0;
      state.lastCompletedUrl = currentUrl;
      installWindowCloseGuard(view, context, 'did-finish-load');
      queueLoginAutofillInjection(view, context, 'did-finish-load', 120);
      queueSellerSessionStatusCheck(view, context, 'did-finish-load', SELLER_SESSION_STATUS_INITIAL_DELAY_MS);
    });

    view.webContents.on('render-process-gone', (_event, details) => {
      log('shop_view_render_process_gone', {
        shopId,
        pageType,
        browserTabId,
        details
      });
    });

    view.webContents.on('unresponsive', () => {
      log('shop_view_unresponsive', {
        shopId,
        pageType,
        browserTabId
      });
    });
  }

  function installWindowCloseGuard(view, context, trigger) {
    if (!isViewUsable(view)) {
      return;
    }

    view.webContents.executeJavaScript(WINDOW_CLOSE_GUARD_SCRIPT, true).catch((error) => {
      log('shop_window_close_guard_failed', {
        shopId: context && context.shopId ? context.shopId : '',
        pageType: context && context.pageType ? context.pageType : '',
        browserTabId: context && context.browserTabId ? context.browserTabId : '',
        trigger: normalizeText(trigger),
        errorMessage: normalizeText(error && error.message)
      });
    });
  }

  function clearLoginAutofillTimer(view) {
    const currentTimer = loginAutofillTimers.get(view);

    if (!currentTimer) {
      const state = getAutomationState(view);

      state.pendingAutofillTrigger = '';
      state.pendingAutofillUrl = '';
      state.pendingAutofillDueAt = 0;
      return;
    }

    clearTimeout(currentTimer);
    loginAutofillTimers.delete(view);
    const state = getAutomationState(view);

    state.pendingAutofillTrigger = '';
    state.pendingAutofillUrl = '';
    state.pendingAutofillDueAt = 0;
  }

  function clearSellerSessionStatusTimer(view) {
    const currentTimer = sellerSessionStatusTimers.get(view);

    if (!currentTimer) {
      const state = getAutomationState(view);

      state.pendingSessionProbeTrigger = '';
      state.pendingSessionProbeUrl = '';
      state.pendingSessionProbeDueAt = 0;
      return;
    }

    clearTimeout(currentTimer);
    sellerSessionStatusTimers.delete(view);
    const state = getAutomationState(view);

    state.pendingSessionProbeTrigger = '';
    state.pendingSessionProbeUrl = '';
    state.pendingSessionProbeDueAt = 0;
  }

  function buildLoginAutofillLogResult(result) {
    return {
      status: normalizeText(result && result.status).toLowerCase(),
      attempts: Math.max(0, Number(result && result.attempts) || 0),
      filledAccount: result && result.filledAccount === true,
      filledPassword: result && result.filledPassword === true,
      phoneInputMode: normalizeText(result && result.phoneInputMode),
      helperVersion: normalizeText(result && result.helperVersion),
      authConfigSource: normalizeText(result && result.authConfigSource).toLowerCase(),
      resolvedAccountType: normalizeText(result && result.resolvedAccountType).toLowerCase(),
      resolvedAccountValuePreview: normalizeText(result && result.resolvedAccountValuePreview),
      loginModeStatus: normalizeText(result && result.loginModeStatus).toLowerCase(),
      waitMs: Math.max(0, Number(result && result.waitMs) || 0),
      remainingMs: Math.max(0, Number(result && result.remainingMs) || 0),
      message: normalizeText(result && result.message)
    };
  }

  function maskLoginAccountValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    if (normalizedValue.length <= 6) {
      return normalizedValue;
    }

    return `${normalizedValue.slice(0, 3)}***${normalizedValue.slice(-3)}`;
  }

  function buildLoginAutofillLogAuthConfig(authConfig) {
    const accountIdentity = resolveAccountIdentity(authConfig);

    return {
      accountType: normalizeText(accountIdentity.accountType).toLowerCase(),
      accountValuePreview: maskLoginAccountValue(accountIdentity.accountValue),
      hasPassword: Boolean(normalizeText(authConfig && authConfig.loginPassword))
    };
  }

  function shouldLogLoginAutofillResult(state, currentUrl, status, now) {
    const normalizedStatus = normalizeText(status).toLowerCase();
    const timestamp = Math.max(0, Number(now) || Date.now());

    if (
      state.lastAutofillLogStatus === normalizedStatus
      && state.lastAutofillLogUrl === currentUrl
      && timestamp - state.lastAutofillLogAt < LOGIN_AUTOMATION_RESULT_LOG_THROTTLE_MS
    ) {
      return false;
    }

    state.lastAutofillLogStatus = normalizedStatus;
    state.lastAutofillLogUrl = currentUrl;
    state.lastAutofillLogAt = timestamp;
    return true;
  }

  function shouldLogSellerSessionProbeResult(state, currentUrl, status, kind, now) {
    const normalizedStatus = normalizeText(status).toLowerCase();
    const normalizedKind = normalizeText(kind).toLowerCase();
    const timestamp = Math.max(0, Number(now) || Date.now());

    if (
      state.lastSessionProbeLogStatus === normalizedStatus
      && state.lastSessionProbeLogUrl === currentUrl
      && state.lastSessionProbeLogKind === normalizedKind
      && timestamp - state.lastSessionProbeLogAt < SELLER_SESSION_RESULT_LOG_THROTTLE_MS
    ) {
      return false;
    }

    state.lastSessionProbeLogStatus = normalizedStatus;
    state.lastSessionProbeLogUrl = currentUrl;
    state.lastSessionProbeLogKind = normalizedKind;
    state.lastSessionProbeLogAt = timestamp;
    return true;
  }

  function queueLoginAutofillInjection(view, context, trigger, delayMs) {
    if (!isViewUsable(view)) {
      return;
    }

    const currentUrl = normalizeText(view.webContents.getURL());

    if (currentUrl && !isAutomationRelevantUrl(context.pageType, currentUrl)) {
      return;
    }

    const state = syncAutomationState(view, currentUrl, context);
    const nextDelayMs = Math.max(0, Number(delayMs) || 0);
    const nextDueAt = Date.now() + nextDelayMs;
    const currentTimer = loginAutofillTimers.get(view);

    if (currentTimer && state.pendingAutofillUrl === currentUrl) {
      if (nextDueAt + LOGIN_AUTOMATION_QUEUE_RESCHEDULE_MARGIN_MS < state.pendingAutofillDueAt) {
        clearLoginAutofillTimer(view);
      } else {
        return;
      }
    }

    const timer = setTimeout(() => {
      loginAutofillTimers.delete(view);
      const latestState = getAutomationState(view);

      latestState.pendingAutofillTrigger = '';
      latestState.pendingAutofillUrl = '';
      latestState.pendingAutofillDueAt = 0;
      runLoginAutofillInjection(view, context, trigger);
    }, nextDelayMs);

    loginAutofillTimers.set(view, timer);
    state.pendingAutofillTrigger = normalizeText(trigger);
    state.pendingAutofillUrl = currentUrl;
    state.pendingAutofillDueAt = nextDueAt;
  }

  function queueSellerSessionStatusCheck(view, context, trigger, delayMs) {
    if (!isViewUsable(view)) {
      return;
    }

    if (!ENABLE_SELLER_SESSION_STATUS_PROBE) {
      return;
    }

    const currentUrl = normalizeText(view.webContents.getURL());

    if (context.pageType !== 'seller-center' || !isSellerCenterWorkspaceUrl(currentUrl)) {
      return;
    }

    const state = syncAutomationState(view, currentUrl, context);
    const nextDelayMs = Math.max(0, Number(delayMs) || 0);
    const nextDueAt = Date.now() + nextDelayMs;
    const currentTimer = sellerSessionStatusTimers.get(view);

    if (currentTimer && state.pendingSessionProbeUrl === currentUrl) {
      if (nextDueAt + LOGIN_AUTOMATION_QUEUE_RESCHEDULE_MARGIN_MS < state.pendingSessionProbeDueAt) {
        clearSellerSessionStatusTimer(view);
      } else {
        return;
      }
    }

    const timer = setTimeout(() => {
      sellerSessionStatusTimers.delete(view);
      const latestState = getAutomationState(view);

      latestState.pendingSessionProbeTrigger = '';
      latestState.pendingSessionProbeUrl = '';
      latestState.pendingSessionProbeDueAt = 0;
      runSellerSessionStatusCheck(view, context, trigger);
    }, nextDelayMs);

    sellerSessionStatusTimers.set(view, timer);
    state.pendingSessionProbeTrigger = normalizeText(trigger);
    state.pendingSessionProbeUrl = currentUrl;
    state.pendingSessionProbeDueAt = nextDueAt;
  }

  function getShopTargetName(shopEntry) {
    return normalizeText(
      shopEntry && (
        shopEntry.shopName
        || (shopEntry.runtimeProfile && shopEntry.runtimeProfile.shopName)
      )
    );
  }

  function listPersistableShopEntries() {
    const results = [];

    for (const shopEntry of shopEntriesById.values()) {
      if (!shopEntry || !normalizeText(shopEntry.partition)) {
        continue;
      }

      results.push(shopEntry);
    }

    return results;
  }

  function formatMallNames(malls) {
    return normalizeMallRecords(malls)
      .map((mall) => mall.mallName)
      .filter(Boolean)
      .join('\u3001');
  }

  async function closeShopBrowserForMismatch(view, context, currentUrl, shopEntry, options = {}) {
    if (!shopEntry) {
      return false;
    }

    const state = syncAutomationState(view, currentUrl);
    const message =
      normalizeText(options.message)
      || '\u5F53\u524D\u767B\u5F55\u8D26\u53F7\u4E0E\u5E97\u94FA\u914D\u7F6E\u4E0D\u5339\u914D\uFF0C\u5DF2\u5173\u95ED\u5F53\u524D\u6D4F\u89C8\u5668\u5E76\u6E05\u7406\u7F13\u5B58\u3002';

    clearManualAutomationBlock(state);
    state.cooldownUntil = 0;
    state.lastSessionProbeStatus = 'shop-mismatch';
    state.lastMallSwitchStatus = '';

    setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.IDLE, {
      reason: normalizeText(options.reason) || 'shop-mismatch',
      url: currentUrl
    });

    log('shop_login_shop_mismatch', {
      shopId: context.shopId,
      pageType: context.pageType,
      browserTabId: context.browserTabId,
      url: currentUrl,
      targetShopName: getShopTargetName(shopEntry),
      message,
      malls: normalizeMallRecords(options.malls)
    });

    clearActiveDescriptorForShop(shopEntry.shopId);
    resetShopBrowserTabs(shopEntry, Object.keys(WORKSPACE_URLS));

    try {
      await clearShopPartitionData(shopEntry.partition);
    } catch (error) {
      logError('shop_browser_partition_clear_failed', error, {
        shopId: shopEntry.shopId,
        partition: shopEntry.partition
      });
    }

    notifyBrowserTabMessage(context, message, {
      persistent: true
    });

    return true;
  }

  async function trySwitchMallInCurrentView(view, context, state, targetMall) {
    if (!isViewUsable(view) || !targetMall) {
      return null;
    }

    const targetKey = `${normalizeText(targetMall.mallId)}|${normalizeText(targetMall.mallName)}`;
    const now = Date.now();

    if (
      state.lastMallSwitchTarget === targetKey
      && now - state.lastMallSwitchAttemptAt < SELLER_MALL_SWITCH_DEBOUNCE_MS
    ) {
      return {
        status: 'debounced'
      };
    }

    state.lastMallSwitchTarget = targetKey;
    state.lastMallSwitchAttemptAt = now;

    try {
      const result = await view.webContents.executeJavaScript(
        buildShopMallSwitchScript({
          targetShopName: targetMall.mallName,
          targetMallId: targetMall.mallId,
          targetMallUniqueId: targetMall.uniqueId
        }),
        true
      );

      state.lastMallSwitchStatus = normalizeText(result && result.status).toLowerCase();

      log('shop_login_multi_mall_switch_attempt', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        targetMall,
        result
      });

      if (state.lastMallSwitchStatus === 'switched') {
        notifyBrowserTabMessage(
          context,
          `\u68C0\u6D4B\u5230\u5F53\u524D\u8D26\u53F7\u4E0B\u6709\u591A\u4E2A\u5E97\u94FA\uFF0C\u5DF2\u5C1D\u8BD5\u5207\u6362\u5230\u300C${targetMall.mallName}\u300D\u3002`,
          {
            durationMs: 5000
          }
        );
        queueSellerSessionStatusCheck(view, context, 'mall-switch-follow-up', 5000);
      } else if (
        state.lastMallSwitchStatus === 'target-not-found'
        || state.lastMallSwitchStatus === 'trigger-not-found'
      ) {
        notifyBrowserTabMessage(
          context,
          `\u68C0\u6D4B\u5230\u5F53\u524D\u8D26\u53F7\u4E0B\u6709\u591A\u4E2A\u5E97\u94FA\uFF0C\u4F46\u6682\u65F6\u65E0\u6CD5\u81EA\u52A8\u5207\u6362\u5230\u300C${targetMall.mallName}\u300D\u3002\u8BF7\u624B\u52A8\u5207\u6362\u540E\u518D\u7EE7\u7EED\u3002`,
          {
            persistent: true
          }
        );
      }

      return result;
    } catch (error) {
      state.lastMallSwitchStatus = 'error';
      logError('shop_login_multi_mall_switch_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        targetMall
      });
      return null;
    }
  }

  async function handleSellerSessionOnlineState(view, context, currentUrl, shopEntry, probeResult) {
    const targetShopName = getShopTargetName(shopEntry);
    const malls = normalizeMallRecords(probeResult && probeResult.malls);
    const mallMatch = findMatchingMall(targetShopName, malls);
    const mallNames = formatMallNames(malls);
    const state = syncAutomationState(view, currentUrl);

    if (!targetShopName || malls.length === 0) {
      return false;
    }

    if (malls.length === 1 && mallMatch.state !== SHOP_MATCH_STATES.MATCHED) {
      const currentMallName = normalizeText(malls[0] && malls[0].mallName) || '-';

      return closeShopBrowserForMismatch(view, context, currentUrl, shopEntry, {
        reason: 'single-mall-mismatch',
        malls,
        message: `\u5F53\u524D\u767B\u5F55\u8D26\u53F7\u4EC5\u8FD4\u56DE\u5E97\u94FA\u300C${currentMallName}\u300D\uFF0C\u4E0E\u914D\u7F6E\u5E97\u94FA\u300C${targetShopName}\u300D\u4E0D\u5339\u914D\u3002\u5DF2\u5173\u95ED\u5F53\u524D\u6D4F\u89C8\u5668\u5E76\u6E05\u7406\u7F13\u5B58\u3002`
      });
    }

    if (mallMatch.state === SHOP_MATCH_STATES.MISSING) {
      return closeShopBrowserForMismatch(view, context, currentUrl, shopEntry, {
        reason: 'target-shop-missing',
        malls,
        message: `\u5F53\u524D\u767B\u5F55\u8D26\u53F7\u4E0B\u672A\u627E\u5230\u914D\u7F6E\u5E97\u94FA\u300C${targetShopName}\u300D\u3002${mallNames ? `\u5F53\u524D\u53EF\u7528\u5E97\u94FA\uFF1A${mallNames}\u3002` : ''}\u5DF2\u5173\u95ED\u5F53\u524D\u6D4F\u89C8\u5668\u5E76\u6E05\u7406\u7F13\u5B58\u3002`
      });
    }

    if (malls.length > 1 && mallMatch.state === SHOP_MATCH_STATES.AMBIGUOUS) {
      notifyBrowserTabMessage(
        context,
        `\u5F53\u524D\u767B\u5F55\u8D26\u53F7\u4E0B\u68C0\u6D4B\u5230\u591A\u4E2A\u7C7B\u4F3C\u5E97\u94FA\uFF0C\u6682\u65F6\u65E0\u6CD5\u81EA\u52A8\u786E\u8BA4\u300C${targetShopName}\u300D\u3002\u8BF7\u624B\u52A8\u5207\u6362\u76EE\u6807\u5E97\u94FA\u3002`,
        {
          persistent: true
        }
      );
      return false;
    }

    if (malls.length > 1 && mallMatch.state === SHOP_MATCH_STATES.MATCHED && mallMatch.match) {
      if (state.lastMallSwitchStatus !== 'skipped') {
        log('shop_login_multi_mall_switch_skipped', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          targetMall: mallMatch.match,
          malls
        });
      }

      state.lastMallSwitchStatus = 'skipped';
    }

    return false;
  }

  function scheduleLoginAutofillFollowUp(view, context) {
    const currentUrl = normalizeText(view && view.webContents && view.webContents.getURL());
    const state = syncAutomationState(view, currentUrl, context);
    const followUpLimit = context && context.suppressRendererNotifications === true
      ? 12
      : LOGIN_AUTOMATION_FOLLOW_UP_LIMIT;

    if (state.followUpCount >= followUpLimit) {
      return;
    }

    state.followUpCount += 1;
    queueLoginAutofillInjection(
      view,
      context,
      `post-submit-${state.followUpCount}`,
      LOGIN_AUTOMATION_FOLLOW_UP_DELAY_MS
    );
  }

  async function activateProductPromotionSessionFromLoginPage(view, context, currentUrl) {
    return false;

    if (!isViewUsable(view) || context.pageType !== 'product-promotion') {
      return false;
    }

    const shopEntry = shopEntriesById.get(context.shopId);
    const state = syncAutomationState(view, currentUrl);

    if (!shopEntry) {
      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u5546\u54C1\u63A8\u5E7F\u4F1A\u8BDD\u672A\u627E\u5230\u5E97\u94FA\u914D\u7F6E\uFF0C\u65E0\u6CD5\u81EA\u52A8\u6FC0\u6D3B\u3002',
        {
          persistent: true
        }
      );
      return true;
    }

    const targetSession = session.fromPartition(shopEntry.partition);
    let probeResult = null;

    try {
      probeResult = await probeSellerSessionForView(shopEntry, currentUrl);
    } catch (error) {
      logError('shop_product_promotion_activation_probe_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl
      });
      notifyBrowserTabMessage(
        context,
        '\u5546\u54C1\u63A8\u5E7F\u4F1A\u8BDD\u6FC0\u6D3B\u5931\u8D25\uFF0C\u672A\u80FD\u68C0\u67E5\u5F53\u524D\u5356\u5BB6\u4F1A\u8BDD\u3002',
        {
          persistent: true
        }
      );
      return true;
    }

    const probeStatus = normalizeText(probeResult && probeResult.status).toLowerCase();
    const targetShopName = getShopTargetName(shopEntry);
    const probeMalls = normalizeMallRecords(probeResult && probeResult.malls);
    let cachedSellerAuthMalls = getShopSellerAuthSnapshotMalls(shopEntry);
    let sellerAuthFallbackResult = null;

    if (probeMalls.length === 0 && cachedSellerAuthMalls.length === 0) {
      const preferredOrigins = [];
      const cachedSellerAuthOrigin = normalizeText(
        shopEntry
        && shopEntry.lastSellerAuthSessionSnapshot
        && shopEntry.lastSellerAuthSessionSnapshot.origin
      );

      if (cachedSellerAuthOrigin) {
        preferredOrigins.push(cachedSellerAuthOrigin);
      }

      try {
        sellerAuthFallbackResult = await loadSellerAuthSessionContext(targetSession, {
          preferredOrigins
        });

        const fallbackStatus = normalizeText(
          sellerAuthFallbackResult && sellerAuthFallbackResult.status
        ).toLowerCase();
        const fallbackMalls = normalizeMallRecords(sellerAuthFallbackResult && sellerAuthFallbackResult.malls);

        if (fallbackStatus === 'online' && fallbackMalls.length > 0) {
          const fallbackOriginUrl = parseUrl(sellerAuthFallbackResult.origin);

          updateShopSellerAuthSessionSnapshot(shopEntry, {
            responseType: 'seller-auth-user-info',
            origin: sellerAuthFallbackResult.origin,
            hostname: normalizeText(fallbackOriginUrl && fallbackOriginUrl.hostname),
            accountId: sellerAuthFallbackResult.accountId,
            malls: fallbackMalls
          });
          cachedSellerAuthMalls = getShopSellerAuthSnapshotMalls(shopEntry);
        }

        log('shop_product_promotion_activation_seller_auth_fallback', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          targetShopName,
          probeStatus,
          fallbackStatus,
          fallbackOrigin: normalizeText(sellerAuthFallbackResult && sellerAuthFallbackResult.origin),
          fallbackAccountId: normalizeText(sellerAuthFallbackResult && sellerAuthFallbackResult.accountId),
          fallbackMalls,
          attempts: Array.isArray(sellerAuthFallbackResult && sellerAuthFallbackResult.attempts)
            ? sellerAuthFallbackResult.attempts.map((attempt) => ({
              origin: normalizeText(attempt && attempt.origin),
              requestUrl: normalizeText(attempt && attempt.requestUrl),
              status: normalizeText(attempt && attempt.response && attempt.response.status),
              ok: Boolean(attempt && attempt.response && attempt.response.ok),
              accountId: normalizeText(attempt && attempt.accountId),
              malls: normalizeMallRecords(attempt && attempt.malls),
              transportError: normalizeText(attempt && attempt.transportError)
            }))
            : []
        });
      } catch (error) {
        logError('shop_product_promotion_activation_seller_auth_fallback_failed', error, {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          targetShopName,
          probeStatus
        });
      }
    }

    const malls = probeMalls.length > 0 ? probeMalls : cachedSellerAuthMalls;
    const mallSource = probeMalls.length > 0
      ? 'activity-login-probe'
      : (cachedSellerAuthMalls.length > 0 ? 'seller-auth-session' : 'none');
    const mallNames = formatMallNames(malls);
    const mallMatch = findMatchingMall(targetShopName, malls);
    const fallbackTargetMall = !targetShopName && malls.length === 1 ? malls[0] : null;
    const targetMall = mallMatch.state === SHOP_MATCH_STATES.MATCHED
      ? mallMatch.match
      : fallbackTargetMall;

    log('shop_product_promotion_activation_probe', {
      shopId: context.shopId,
      pageType: context.pageType,
      browserTabId: context.browserTabId,
      url: currentUrl,
      probeResult,
      targetShopName,
      mallSource,
      cachedSellerAuthMalls,
      sellerAuthFallbackStatus: normalizeText(sellerAuthFallbackResult && sellerAuthFallbackResult.status),
      sellerAuthFallbackOrigin: normalizeText(sellerAuthFallbackResult && sellerAuthFallbackResult.origin)
    });

    if (probeStatus !== 'online' && cachedSellerAuthMalls.length === 0) {
      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u5356\u5BB6\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u51C6\u5907\u597D\uFF0C\u672A\u80FD\u4ECE seller-auth \u63A5\u53E3\u8865\u5145 mallId\uFF0C\u65E0\u6CD5\u76F4\u63A5\u6FC0\u6D3B\u5546\u54C1\u63A8\u5E7F\u3002',
        {
          persistent: true
        }
      );
      return true;
    }

    if (!targetMall) {
      if (mallMatch.state === SHOP_MATCH_STATES.AMBIGUOUS) {
        notifyBrowserTabMessage(
          context,
          `\u5F53\u524D\u5356\u5BB6\u4F1A\u8BDD\u4E0B\u5339\u914D\u5230\u591A\u4E2A\u7C7B\u4F3C\u5E97\u94FA\uFF0C\u6682\u65E0\u6CD5\u786E\u5B9A\u5546\u54C1\u63A8\u5E7F mallId\u3002${mallNames ? `\u5F53\u524D\u53EF\u7528\u5E97\u94FA\uFF1A${mallNames}\u3002` : ''}`,
          {
            persistent: true
          }
        );
        return true;
      }

      notifyBrowserTabMessage(
        context,
        `\u5F53\u524D\u767B\u5F55\u8D26\u53F7\u4E0B\u672A\u627E\u5230\u914D\u7F6E\u5E97\u94FA\u300C${targetShopName || '-'}\u300D\u7684 mallId\u3002${mallNames ? `\u5F53\u524D\u53EF\u7528\u5E97\u94FA\uFF1A${mallNames}\u3002` : ''}`,
        {
          persistent: true
        }
      );
      return true;
    }

    notifyBrowserTabMessage(
      context,
      `\u5F53\u524D\u9875\u9762\u9700\u8981\u4ECE\u5546\u54C1\u63A8\u5E7F\u5165\u53E3\u4E3B\u9875\u7EE7\u7EED\u767B\u5F55\uFF0C\u6B63\u5728\u4E3A\u300C${targetMall.mallName || targetShopName || '-'}\u300D\u51C6\u5907 ads \u767B\u5F55\u63A5\u529B\u94FE\u8DEF\u3002`,
      {
        durationMs: 5200
      }
    );

    try {
      const handoffResult = await prepareProductPromotionLoginHandoff(
        targetSession,
        {
          mallId: targetMall.mallId,
          mallUniqueId: targetMall.uniqueId,
          workspaceUrl: PRODUCT_PROMOTION_HOME_REQUIRED_URL
        }
      );

      log('shop_product_promotion_login_handoff', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        targetShopName,
        targetMall,
        handoffResult
      });

      if (normalizeText(handoffResult && handoffResult.status).toLowerCase() === 'handoff-ready') {
        clearManualAutomationBlock(state);
        state.cooldownUntil = 0;
        setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.REDIRECTING_LOGIN, {
          now: Date.now(),
          reason: 'product-promotion-login-handoff',
          url: currentUrl
        });
        notifyBrowserTabMessage(
          context,
          `\u5DF2\u4E3A\u300C${targetMall.mallName || targetShopName || '-'}\u751F\u6210 ads \u767B\u5F55\u63A5\u529B URL\uFF0C\u6B63\u5728\u4EA4\u7531\u9875\u9762\u7EE7\u7EED\u5B8C\u6210\u767B\u5F55\u3002`,
          {
            durationMs: 4600
          }
        );
        loadInCurrentView(view, handoffResult.handoffUrl);
        return true;
      }

      notifyBrowserTabMessage(
        context,
        `${buildProductPromotionActivationFailureMessage(handoffResult)}\u81EA\u52A8\u6D41\u7A0B\u5DF2\u5728\u5F53\u524D\u9875\u9762\u505C\u6B62\u3002`,
        {
          persistent: true
        }
      );
      return true;
    } catch (error) {
      logError('shop_product_promotion_session_activation_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        targetShopName,
        targetMall
      });
      notifyBrowserTabMessage(
        context,
        '\u5546\u54C1\u63A8\u5E7F\u4F1A\u8BDD\u6FC0\u6D3B\u5931\u8D25\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u5728\u5F53\u524D\u9875\u9762\u505C\u6B62\u3002',
        {
          persistent: true
        }
      );
      return true;
    }
  }

  async function ensureLoginAutofillHelper(view, currentUrl, authConfig, state) {
    if (
      !isViewUsable(view)
      || !state
      || !isLoginAutofillUrl(currentUrl)
      || !hasCompleteAuthConfig(authConfig)
    ) {
      return false;
    }

    const helperSignature = buildLoginAutofillHelperSignature(authConfig);

    if (
      state.autofillHelperReady === true
      && state.autofillHelperSignature === helperSignature
      && state.autofillHelperUrl === currentUrl
    ) {
      try {
        const helperReady = await view.webContents.executeJavaScript(
          buildIsLoginAutofillHelperReadyScript(),
          true
        );

        if (helperReady === true) {
          return true;
        }
      } catch (_error) {
        // Ignore helper ping failures and reinstall below.
      }

      state.autofillHelperReady = false;
    }

    if (
      state.autofillHelperInstallPromise
      && state.autofillHelperSignature === helperSignature
      && state.autofillHelperUrl === currentUrl
    ) {
      await state.autofillHelperInstallPromise;
      return state.autofillHelperReady === true;
    }

    state.autofillHelperSignature = helperSignature;
    state.autofillHelperUrl = currentUrl;

    let installPromise = null;

    installPromise = view.webContents.executeJavaScript(
      buildEnsureLoginAutofillHelperScript(authConfig),
      true
    )
      .then(() => {
        state.autofillHelperReady = true;
        return true;
      })
      .catch((error) => {
        state.autofillHelperReady = false;
        state.autofillHelperUrl = '';
        throw error;
      })
      .finally(() => {
        if (state.autofillHelperInstallPromise === installPromise) {
          state.autofillHelperInstallPromise = null;
        }
      });

    state.autofillHelperInstallPromise = installPromise;
    await installPromise;
    return state.autofillHelperReady === true;
  }

  function shouldCollectLoginDebugSnapshot(status) {
    return [
      'activity-home-required',
      'page-route-changed',
      'missing-input',
      'missing-email-login-mode',
      'pending-login-mode',
      'pending-region',
      'pending-fill',
      'pending-submit',
      'pending-agreement',
      'pending-authorization',
      'missing-submit',
      'verification-required'
    ].includes(normalizeText(status).toLowerCase());
  }

  async function collectLoginDebugSnapshot(view, context, currentUrl, status, authConfig) {
    if (!isViewUsable(view) || !isLoginAutofillUrl(currentUrl)) {
      return;
    }

    const state = syncAutomationState(view, currentUrl, context);
    const normalizedStatus = normalizeText(status).toLowerCase();
    const now = Date.now();

    if (
      state.lastDebugSnapshotStatus === normalizedStatus
      && state.lastDebugSnapshotUrl === currentUrl
      && now - state.lastDebugSnapshotAt < LOGIN_DEBUG_SNAPSHOT_THROTTLE_MS
    ) {
      return;
    }

    state.lastDebugSnapshotAt = now;
    state.lastDebugSnapshotStatus = normalizedStatus;
    state.lastDebugSnapshotUrl = currentUrl;

    try {
      await ensureLoginAutofillHelper(view, currentUrl, authConfig, state);
      const snapshot = await view.webContents.executeJavaScript(
        buildCollectInstalledLoginDebugSnapshotScript(),
        true
      );

      log('shop_login_page_debug_snapshot', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        status: normalizedStatus,
        url: currentUrl,
        snapshot
      });
    } catch (error) {
      logError('shop_login_page_debug_snapshot_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        status: normalizedStatus,
        url: currentUrl
      });
    }
  }

  function handleLoginAutofillResult(view, context, currentUrl, result) {
    const state = syncAutomationState(view, currentUrl, context);
    const normalizedResult = result && typeof result === 'object' ? result : {};
    const status = normalizeText(normalizedResult.status).toLowerCase();
    const loginModeStatus = normalizeText(normalizedResult.loginModeStatus).toLowerCase();
    const attempts = Number(normalizedResult.attempts) || 0;
    const filledAccount = normalizedResult.filledAccount !== false;
    const filledPassword = normalizedResult.filledPassword !== false;
    const now = Date.now();

    if (!status) {
      return;
    }

    state.lastAutofillStatus = status;

    if (status === 'busy') {
      return;
    }

    if (status === 'page-route-changed') {
      scheduleLoginAutofillFollowUp(view, context);
      return;
    }

    if (status === 'authorization-confirm-clicked') {
      clearManualAutomationBlock(state);
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.SUBMITTING, {
        now,
        reason: status,
        url: currentUrl,
        lastAutofillStatus: status
      });
      notifyBrowserTabMessage(
        context,
        '\u5DF2\u81EA\u52A8\u786E\u8BA4\u5356\u5BB6\u4E2D\u5FC3\u6388\u6743\uFF0C\u6B63\u5728\u7B49\u5F85\u9875\u9762\u8DF3\u8F6C\u3002',
        {
          durationMs: 4200
        }
      );
      scheduleLoginAutofillFollowUp(view, context);
      return;
    }

    if (status === 'pending-authorization') {
      scheduleLoginAutofillFollowUp(view, context);
      return;
    }

    if (
      status === 'missing-email-login-mode'
      || (status === 'pending-login-mode' && loginModeStatus === 'missing-email-login-mode')
    ) {
      clearManualAutomationBlock(state);
      clearLoginAutofillTimer(view);
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.IDLE, {
        now,
        reason: 'missing-email-login-mode',
        url: currentUrl,
        lastAutofillStatus: 'missing-email-login-mode'
      });
      notifyBrowserTabMessage(
        context,
        normalizedResult.message
          || '\u5F53\u524D\u8D26\u53F7\u914D\u7F6E\u4E3A\u90AE\u7BB1\u767B\u5F55\uFF0C\u4F46\u9875\u9762\u6CA1\u6709\u627E\u5230\u90AE\u7BB1\u767B\u5F55\u5207\u6362\u3002\u5DF2\u505C\u6B62\u81EA\u52A8\u767B\u5F55\u3002',
        {
          persistent: true
        }
      );
      return;
    }

    if (
      status === 'pending-login-mode'
      || status === 'pending-region'
      || status === 'pending-fill'
      || status === 'pending-submit'
      || status === 'pending-agreement'
      || status === 'missing-input'
      || status === 'missing-submit'
    ) {
      scheduleLoginAutofillFollowUp(view, context);
      return;
    }

    if (status === 'activity-home-required') {
      clearManualAutomationBlock(state);
      clearLoginAutofillTimer(view);
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.COOLDOWN, {
        now,
        reason: status,
        url: currentUrl,
        cooldownUntil: now + LOGIN_AUTOMATION_AUTH_LOOP_COOLDOWN_MS,
        lastAutofillStatus: status
      });

      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u9875\u9762\u63D0\u793A\u9700\u4ECE\u5546\u54C1\u63A8\u5E7F\u5165\u53E3\u4E3B\u9875\u7EE7\u7EED\u767B\u5F55\uFF0C\u5DF2\u505C\u6B62\u91CD\u590D\u70B9\u51FB\u767B\u5F55\uFF0C\u6B63\u5728\u76F4\u63A5\u8DF3\u8F6C\u5230\u5546\u54C1\u63A8\u5E7F\u4E3B\u9875\u3002',
        {
          durationMs: 5200
        }
      );

      if (context.pageType === 'product-promotion') {
        log('shop_activity_login_home_required_redirect', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          targetUrl: PRODUCT_PROMOTION_HOME_REQUIRED_URL,
          notice: normalizeText(normalizedResult.message)
        });
        setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.REDIRECTING_LOGIN, {
          now: Date.now(),
          reason: 'activity-home-required-redirect',
          url: currentUrl,
          cooldownUntil: 0,
          lastAutofillStatus: status
        });
        loadInCurrentView(view, PRODUCT_PROMOTION_HOME_REQUIRED_URL);
        return;
      }

      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u9875\u9762\u63D0\u793A\u9700\u4ECE\u4E3B\u9875\u7EE7\u7EED\u767B\u5F55\uFF0C\u81EA\u52A8\u6D41\u7A0B\u5DF2\u505C\u6B62\u91CD\u590D\u70B9\u51FB\u767B\u5F55\u3002',
        {
          persistent: true
        }
      );
      return;
    }

    if (
      (status === 'submitted' || status === 'submitting')
      && (!filledAccount || !filledPassword)
    ) {
      return;
    }

    if (status === 'submitted' || status === 'submitting') {
      clearManualAutomationBlock(state);
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.SUBMITTING, {
        now,
        reason: status,
        url: currentUrl,
        lastAutofillStatus: status
      });
      notifyBrowserTabMessage(
        context,
        '\u5DF2\u81EA\u52A8\u586B\u5199\u8D26\u53F7\u5BC6\u7801\u5E76\u63D0\u4EA4\u767B\u5F55\uFF0C\u6B63\u5728\u7B49\u5F85\u767B\u5F55\u7ED3\u679C\u3002',
        {
          durationMs: 5200
        }
      );
      scheduleLoginAutofillFollowUp(view, context);
      return;
    }

    if (status === 'otp-required' || status === 'verification-required') {
      state.verificationBlockedUrl = currentUrl;
      state.followUpCount = 0;
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.WAITING_MANUAL_VERIFICATION, {
        now,
        reason: status,
        url: currentUrl,
        lastAutofillStatus: status
      });
      notifyManualVerificationRequired(context);
      return;
    }

    if (attempts > 0 && attempts >= 18 && status === 'pending-login-mode') {
      state.verificationBlockedUrl = currentUrl;
      state.followUpCount = 0;
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.WAITING_MANUAL_VERIFICATION, {
        now,
        reason: status,
        url: currentUrl,
        lastAutofillStatus: status
      });
      notifyBrowserTabMessage(
        context,
        '\u767B\u5F55\u9875\u9762\u672A\u80FD\u81EA\u52A8\u5207\u6362\u5230\u8D26\u53F7\u767B\u5F55\u5361\u7247\u3002\u8BF7\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u624B\u52A8\u5207\u6362\u540E\u518D\u7EE7\u7EED\u767B\u5F55\u3002',
        {
          persistent: true
        }
      );
      return;
    }

    if (
      attempts > 0
      && attempts >= 18
      && (
        status === 'missing-submit'
        || status === 'missing-input'
        || status === 'pending-login-mode'
        || status === 'pending-region'
        || status === 'pending-fill'
        || status === 'pending-submit'
        || status === 'pending-agreement'
        || status === 'pending-authorization'
      )
    ) {
      state.verificationBlockedUrl = currentUrl;
      state.followUpCount = 0;
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.WAITING_MANUAL_VERIFICATION, {
        now,
        reason: status,
        url: currentUrl,
        lastAutofillStatus: status
      });
      notifyBrowserTabMessage(
        context,
        '\u767B\u5F55\u9875\u9762\u51FA\u73B0\u4E86\u533A\u53F7\u5207\u6362\u3001\u8F93\u5165\u6846\u63D0\u4EA4\u6216\u52FE\u9009\u72B6\u6001\u5F02\u5E38\uFF0C\u8BF7\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u624B\u52A8\u5B8C\u6210\u767B\u5F55\u3002',
        {
          persistent: true
        }
      );
      return;
    }

    if (status === 'missing-auth') {
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.IDLE, {
        now,
        reason: 'missing-auth',
        url: currentUrl,
        lastAutofillStatus: status
      });
    }
  }

  function beginWorkspaceRelogin(view, context, currentUrl, authConfig, options = {}) {
    if (!isViewUsable(view)) {
      return false;
    }

    if (!isPageAutoLoginEnabled(context.shopId, context.pageType)) {
      return false;
    }

    const state = syncAutomationState(view, currentUrl);
    const now = Date.now();
    const authRedirectHistory = pruneAuthRedirectHistory(state, now);

    if (isAutomationCooldownActive(state, now)) {
      const remainingSeconds = Math.max(1, Math.ceil((state.cooldownUntil - now) / 1000));

      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.COOLDOWN, {
        now,
        reason: 'auth-loop-cooldown',
        url: currentUrl,
        cooldownUntil: state.cooldownUntil
      });
      notifyBrowserTabMessage(
        context,
        `\u767B\u5F55\u72B6\u6001\u53CD\u590D\u5931\u6548\uFF0C\u81EA\u52A8\u91CD\u767B\u5DF2\u6682\u505C ${remainingSeconds} \u79D2\u3002\u8BF7\u68C0\u67E5\u8D26\u53F7\u5BC6\u7801\u6216\u624B\u52A8\u5B8C\u6210\u9A8C\u8BC1\u540E\u518D\u7EE7\u7EED\u3002`,
        {
          persistent: true
        }
      );
      return true;
    }

    if (
      state.lastAuthenticationRedirectUrl === currentUrl
      && now - state.lastAuthenticationRedirectAt < LOGIN_AUTOMATION_AUTH_REDIRECT_DEBOUNCE_MS
    ) {
      return true;
    }

    if (!hasCompleteAuthConfig(authConfig)) {
      notifyBrowserTabMessage(
        context,
        '\u5F53\u524D\u5E97\u94FA\u672A\u914D\u7F6E\u5B8C\u6574\u7684\u767B\u5F55\u8D26\u53F7\u6216\u5BC6\u7801\uFF0C\u8BF7\u5148\u5728\u5E97\u94FA\u914D\u7F6E\u91CC\u8865\u5145\u3002',
        {
          durationMs: 8000
        }
      );
      return true;
    }

    if (authRedirectHistory.length >= LOGIN_AUTOMATION_AUTH_REDIRECT_LIMIT) {
      state.followUpCount = 0;
      state.cooldownUntil = now + LOGIN_AUTOMATION_AUTH_LOOP_COOLDOWN_MS;
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.COOLDOWN, {
        now,
        reason: 'auth-loop-detected',
        url: currentUrl,
        cooldownUntil: state.cooldownUntil
      });
      notifyBrowserTabMessage(
        context,
        '\u68C0\u6D4B\u5230\u5F53\u524D\u5E97\u94FA\u77ED\u65F6\u95F4\u5185\u591A\u6B21\u6389\u7EBF\u6216\u91CD\u5B9A\u5411\uFF0C\u4E3A\u907F\u514D\u5FAA\u73AF\u91CD\u767B\uFF0C\u5DF2\u6682\u505C\u81EA\u52A8\u91CD\u767B 45 \u79D2\u3002\u8BF7\u68C0\u67E5\u8D26\u53F7\u5BC6\u7801\u3001\u9A8C\u8BC1\u7801\u6216\u7F51\u7EDC\u72B6\u6001\u3002',
        {
          persistent: true
        }
      );
      log('shop_login_authentication_cooldown', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        sourceUrl: currentUrl,
        redirectCount: authRedirectHistory.length,
        cooldownUntil: state.cooldownUntil,
        reason: normalizeText(options.reason)
      });
      return true;
    }

    const targetUrl = normalizeText(options.targetUrl);

    if (!targetUrl) {
      return false;
    }

    state.lastAuthenticationRedirectUrl = currentUrl;
    state.lastAuthenticationRedirectAt = now;
    state.authRedirectHistory = authRedirectHistory.concat(now);
    state.lastSessionProbeStatus = normalizeText(options.probeStatus) || state.lastSessionProbeStatus;
    clearManualAutomationBlock(state);
    setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.REDIRECTING_LOGIN, {
      now,
      reason: normalizeText(options.reason) || 'auth-expired',
      url: currentUrl
    });

    notifyBrowserTabMessage(
      context,
      normalizeText(options.message) || '\u68C0\u6D4B\u5230\u5E97\u94FA\u767B\u5F55\u5DF2\u6389\u7EBF\uFF0C\u6B63\u5728\u81EA\u52A8\u8FDB\u5165\u767B\u5F55\u9875\u3002',
      {
        durationMs: Number(options.durationMs) || 4200
      }
    );
    const normalizedHttpReferrer = normalizeText(options.httpReferrer);
    const preferDomNavigation = options.preferDomNavigation === true;
    const fallbackLoadOptions = normalizedHttpReferrer
      ? {
        httpReferrer: normalizedHttpReferrer
      }
      : null;
    const logEventName = normalizeText(options.logEventName) || 'shop_login_authentication_redirect';
    const baseLogPayload = {
      shopId: context.shopId,
      pageType: context.pageType,
      browserTabId: context.browserTabId,
      sourceUrl: currentUrl,
      targetUrl,
      httpReferrer: normalizedHttpReferrer,
      navigationMode: preferDomNavigation ? 'page-context' : 'load-url',
      reason: normalizeText(options.reason) || 'auth-expired'
    };
    const fallbackToLoadUrl = (reason, result = null) => {
      log('shop_login_authentication_redirect_load_url_fallback', {
        ...baseLogPayload,
        fallbackReason: normalizeText(reason),
        result
      });
      loadInCurrentView(view, targetUrl, fallbackLoadOptions);
    };

    log(logEventName, baseLogPayload);

    if (preferDomNavigation) {
      navigateInCurrentViewFromPage(view, targetUrl, {
        mode: 'replace'
      })
        .then((result) => {
          const status = normalizeText(result && result.status).toLowerCase();

          log('shop_login_authentication_redirect_page_context_result', {
            ...baseLogPayload,
            result
          });

          if (status !== 'navigating' && status !== 'same-url') {
            fallbackToLoadUrl(status || 'page-context-rejected', result);
          }
        })
        .catch((error) => {
          logError('shop_login_authentication_redirect_page_context_failed', error, baseLogPayload);
          fallbackToLoadUrl('page-context-error');
        });
      return true;
    }

    loadInCurrentView(view, targetUrl, fallbackLoadOptions);
    return true;
  }

  function beginSellerCenterRelogin(view, context, currentUrl, authConfig, options = {}) {
    if (context.pageType !== 'seller-center') {
      return false;
    }

    return beginWorkspaceRelogin(view, context, currentUrl, authConfig, {
      ...options,
      targetUrl: buildSellerCenterReloginUrl(currentUrl)
    });
  }

  function beginProductPromotionRelogin(view, context, currentUrl, authConfig, options = {}) {
    if (context.pageType !== 'product-promotion') {
      return false;
    }

    return beginWorkspaceRelogin(view, context, currentUrl, authConfig, {
      ...options,
      targetUrl: buildProductPromotionReloginUrl(currentUrl),
      httpReferrer: PRODUCT_PROMOTION_ACTIVITY_ENTRY_URL,
      preferDomNavigation: true
    });
  }

  function runSellerCenterAuthenticationEntry(view, context, currentUrl) {
    if (!isViewUsable(view) || !isAuthenticationPageUrl(currentUrl)) {
      return false;
    }

    const state = syncAutomationState(view, currentUrl);
    const now = Date.now();
    const isBackgroundContext = context && context.suppressRendererNotifications === true;

    if ((Number(state.authenticationEntryHoldUntil) || 0) > now) {
      return true;
    }

    if (
      state.lastAuthenticationEntryUrl === currentUrl
      && now - state.lastAuthenticationEntryAt < AUTHENTICATION_ENTRY_MIN_GAP_MS
    ) {
      return true;
    }

    state.lastAuthenticationEntryAt = now;
    state.lastAuthenticationEntryUrl = currentUrl;

    function holdAuthenticationEntry(delayMs = AUTHENTICATION_ENTRY_HOLD_MS) {
      state.authenticationEntryHoldUntil = Math.max(
        Number(state.authenticationEntryHoldUntil) || 0,
        Date.now() + Math.max(0, Number(delayMs) || 0)
      );
    }

    function queueAuthenticationEntryRetry(reason, result = null) {
      if (!isBackgroundContext) {
        holdAuthenticationEntry();
        log('shop_login_authentication_entry_foreground_wait', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          reason: normalizeText(reason),
          result
        });
        return;
      }

      holdAuthenticationEntry(AUTHENTICATION_ENTRY_BACKGROUND_RETRY_MS);
      log('shop_login_authentication_entry_retry_scheduled', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        reason: normalizeText(reason),
        delayMs: AUTHENTICATION_ENTRY_BACKGROUND_RETRY_MS,
        result
      });
      queueLoginAutofillInjection(
        view,
        context,
        `authentication-entry-${normalizeText(reason) || 'retry'}`,
        AUTHENTICATION_ENTRY_BACKGROUND_RETRY_MS
      );
    }

    function fallbackToSellerCenterPortal(reason, result = null) {
      if (!isBackgroundContext) {
        holdAuthenticationEntry();
        log('shop_login_authentication_entry_foreground_wait', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          reason: normalizeText(reason),
          result
        });
        return;
      }

      const fallbackNow = Date.now();

      if (
        state.lastAuthenticationEntryFallbackUrl === currentUrl
        && fallbackNow - state.lastAuthenticationEntryFallbackAt < AUTHENTICATION_ENTRY_FALLBACK_COOLDOWN_MS
      ) {
        return;
      }

      state.lastAuthenticationEntryFallbackAt = fallbackNow;
      state.lastAuthenticationEntryFallbackUrl = currentUrl;

      log('shop_login_authentication_entry_portal_fallback', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        reason: normalizeText(reason),
        result
      });

      notifyBrowserTabMessage(
        context,
        '\u8BA4\u8BC1\u9875\u63A5\u529B\u5931\u8D25\uFF0C\u5DF2\u81EA\u52A8\u56DE\u5230\u5356\u5BB6\u4E2D\u5FC3\u5165\u53E3\u7EE7\u7EED\u767B\u5F55\u3002',
        {
          durationMs: 3600
        }
      );

      loadInCurrentView(view, SELLER_CENTER_PORTAL_URL);
    }

    view.webContents.executeJavaScript(
      buildSellerCenterAuthenticationEntryScript(),
      true
    )
      .then((result) => {
        const status = normalizeText(result && result.status).toLowerCase();

        state.lastAuthenticationEntryStatus = status;

        log('shop_login_authentication_entry', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          result
        });

        if (status === 'missing-entry' || status === 'click-failed') {
          fallbackToSellerCenterPortal(status || 'entry-missing', result);
          return;
        }

        if (status === 'loading' || status === 'waiting-entry') {
          queueAuthenticationEntryRetry(status, result);
          return;
        }

        if (status === 'manual-selection-required') {
          if (isBackgroundContext) {
            fallbackToSellerCenterPortal(status, result);
            return;
          }

          holdAuthenticationEntry();
          notifyBrowserTabMessage(
            context,
            '\u5F53\u524D\u8BA4\u8BC1\u9875\u5B58\u5728\u591A\u4E2A\u53EF\u9009\u5165\u53E3\uFF0C\u8BF7\u5728\u5F53\u524D\u9875\u9762\u624B\u52A8\u9009\u62E9\u540E\u7EE7\u7EED\u767B\u5F55\u3002',
            {
              durationMs: 3600
            }
          );
          return;
        }

        if (status === 'clicked') {
          holdAuthenticationEntry();
          if (!isBackgroundContext) {
            notifyBrowserTabMessage(
              context,
              '\u6B63\u5728\u4ECE agentSeller \u8BA4\u8BC1\u9875\u8FDB\u5165\u767B\u5F55\u6D41\u7A0B\u3002',
              {
                durationMs: 3200
              }
            );
          }

          setTimeout(() => {
            if (!isViewUsable(view)) {
              return;
            }

            const latestUrl = normalizeText(view.webContents.getURL());
            const latestParsedUrl = parseUrl(latestUrl);
            const latestHostname = normalizeText(latestParsedUrl && latestParsedUrl.hostname).toLowerCase();
            const latestOnAuthenticationHost = AUTHENTICATION_HOST_PATTERNS.some((pattern) => (
              pattern.test(latestHostname)
            ));

            if (
              !latestUrl
              || latestUrl === currentUrl
              || isAuthenticationPageUrl(latestUrl)
              || (
                latestOnAuthenticationHost
                && !isLoginAutofillUrl(latestUrl)
                && !isSellerCenterSiteMainUrl(latestUrl)
                && !isSellerCenterWorkspaceUrl(latestUrl)
              )
            ) {
              if (isBackgroundContext) {
                fallbackToSellerCenterPortal('entry-click-no-navigation', {
                  ...result,
                  latestUrl
                });
                return;
              }

              const followUpNow = Date.now();
              const sameNoNavigationWindow = (
                state.lastAuthenticationEntryNoNavigationUrl === currentUrl
                && followUpNow - (Number(state.lastAuthenticationEntryNoNavigationAt) || 0)
                  < AUTHENTICATION_ENTRY_NO_NAVIGATION_REPEAT_WINDOW_MS
              );
              const noNavigationCount = sameNoNavigationWindow
                ? Math.max(0, Number(state.lastAuthenticationEntryNoNavigationCount) || 0) + 1
                : 1;
              const holdDelayMs = noNavigationCount >= 2
                ? AUTHENTICATION_ENTRY_FOREGROUND_NO_NAVIGATION_HOLD_MS
                : AUTHENTICATION_ENTRY_HOLD_MS;

              state.lastAuthenticationEntryNoNavigationAt = followUpNow;
              state.lastAuthenticationEntryNoNavigationUrl = currentUrl;
              state.lastAuthenticationEntryNoNavigationCount = noNavigationCount;

              holdAuthenticationEntry(holdDelayMs);

              if (noNavigationCount === 2) {
                notifyBrowserTabMessage(
                  context,
                  '\u5F53\u524D\u8BA4\u8BC1\u9875\u672A\u80FD\u81EA\u52A8\u8FDB\u5165\u767B\u5F55\u6D41\u7A0B\uFF0C\u5DF2\u6682\u505C\u91CD\u590D\u70B9\u51FB\u3002\u8BF7\u5728\u5F53\u524D\u9875\u9762\u624B\u52A8\u70B9\u51FB\u5356\u5BB6\u4E2D\u5FC3\u5165\u53E3\u540E\u7EE7\u7EED\u767B\u5F55\u3002',
                  {
                    persistent: true
                  }
                );
              }

              log('shop_login_authentication_entry_foreground_no_navigation', {
                shopId: context.shopId,
                pageType: context.pageType,
                browserTabId: context.browserTabId,
                url: currentUrl,
                latestUrl,
                noNavigationCount,
                holdDelayMs,
                result
              });
              return;
            }

            state.lastAuthenticationEntryNoNavigationAt = 0;
            state.lastAuthenticationEntryNoNavigationUrl = '';
            state.lastAuthenticationEntryNoNavigationCount = 0;
          }, AUTHENTICATION_ENTRY_FOLLOW_UP_DELAY_MS);
        }
      })
      .catch((error) => {
        state.lastAuthenticationEntryStatus = 'error';
        logError('shop_login_authentication_entry_failed', error, {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl
        });
        fallbackToSellerCenterPortal('entry-script-error');
      });

    return true;
  }

  function runAuthenticationPageAutomation(view, context, currentUrl, authConfig) {
    if (!isViewUsable(view)) {
      return false;
    }

    if (!isPageAutoLoginEnabled(context.shopId, context.pageType)) {
      return false;
    }

    if (context.pageType === 'seller-center' && isAuthenticationPageUrl(currentUrl)) {
      return runSellerCenterAuthenticationEntry(view, context, currentUrl, authConfig);
    }

    if (
      context.pageType === 'product-promotion'
      && (
        isAdsLoginPageUrl(currentUrl)
        || isSellerOauthPageUrl(currentUrl)
      )
    ) {
      if (isProductPromotionTicketLoginUrl(currentUrl) || isProductPromotionAnonymousLoginPendingUrl(currentUrl)) {
        return true;
      }

      return beginProductPromotionRelogin(view, context, currentUrl, authConfig, {
        reason: 'ads-auth-expired',
        message: '\u68C0\u6D4B\u5230\u5546\u54C1\u63A8\u5E7F\u767B\u5F55\u5DF2\u6389\u7EBF\uFF0C\u6B63\u5728\u81EA\u52A8\u8FDB\u5165\u767B\u5F55\u6D41\u7A0B\u3002',
        logEventName: 'shop_ads_login_redirect'
      });
    }

    return false;
  }

  async function runSellerCenterSiteMainAutomation(view, context, currentUrl, shopEntry, state) {
    if (!isViewUsable(view) || context.pageType !== 'seller-center') {
      return false;
    }

    if (!isSellerCenterSiteMainUrl(currentUrl)) {
      return false;
    }

    const now = Date.now();

    if ((Number(state.siteMainPopupHoldUntil) || 0) > now) {
      return true;
    }

    if (hasSellerCenterPopupFlowEntry(shopEntry, context.pageType)) {
      state.siteMainPopupHoldUntil = Math.max(
        Number(state.siteMainPopupHoldUntil) || 0,
        now + SELLER_CENTER_SITE_MAIN_POPUP_HOLD_MS
      );
      return true;
    }

    if (
      state.lastSiteMainActionAt > 0
      && now - state.lastSiteMainActionAt < SELLER_CENTER_SITE_MAIN_MIN_ACTION_GAP_MS
    ) {
      return true;
    }

    state.lastSiteMainActionAt = now;

    try {
      const result = await view.webContents.executeJavaScript(
        buildSellerCenterLandingScript({
          targetShopName: getShopTargetName(shopEntry)
        }),
        true
      );
      const status = normalizeText(result && result.status).toLowerCase();

      state.lastSiteMainStatus = status;
      state.lastSiteMainResult = result && typeof result === 'object'
        ? JSON.parse(JSON.stringify(result))
        : null;

      if (status === 'pending-page-ready') {
        state.lastSiteMainPendingCount += 1;
      } else {
        state.lastSiteMainPendingCount = 0;
      }

      log('shop_seller_center_site_main_automation', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl,
        result
      });

      if (status === 'pending-page-ready') {
        if (state.lastSiteMainPendingCount < SELLER_CENTER_SITE_MAIN_READY_RETRY_LIMIT) {
          queueLoginAutofillInjection(view, context, 'site-main-ready-follow-up', 1500);
          return true;
        }

        notifyBrowserTabMessage(
          context,
          '\u5356\u5bb6\u4e3b\u9875\u957f\u65f6\u95f4\u672a\u5b8c\u6210\u52a0\u8f7d\uff0c\u81ea\u52a8\u6d41\u7a0b\u5df2\u5728\u5f53\u524d\u9875\u9762\u6682\u505c\uff0c\u8bf7\u624b\u52a8\u68c0\u67e5\u540e\u7ee7\u7eed\u3002',
          {
            persistent: true
          }
        );
        return true;
      }

      if (status === 'switched-shop') {
        notifyBrowserTabMessage(
          context,
          `\u5F53\u524D\u843D\u5730\u9875\u5E97\u94FA\u4E0E\u914D\u7F6E\u4E0D\u4E00\u81F4\uFF0C\u5DF2\u5C1D\u8BD5\u5207\u6362\u5230\u300C${getShopTargetName(shopEntry)}\u300D\u3002`,
          {
            durationMs: 4500
          }
        );
        queueLoginAutofillInjection(view, context, 'site-main-switch-follow-up', 2200);
        return true;
      }

      if (status === 'pending-agreement') {
        queueLoginAutofillInjection(view, context, 'site-main-agreement-follow-up', 1200);
        return true;
      }

      if (status === 'pending-authorization' || status === 'authorization-confirm-clicked') {
        queueLoginAutofillInjection(view, context, 'site-main-authorization-follow-up', 1200);
        return true;
      }

      if (status === 'entered-global') {
        state.siteMainPopupHoldUntil = Math.max(
          Number(state.siteMainPopupHoldUntil) || 0,
          Date.now() + SELLER_CENTER_SITE_MAIN_POPUP_HOLD_MS
        );
        notifyBrowserTabMessage(
          context,
          '\u5DF2\u5B8C\u6210\u5E97\u94FA\u6821\u9A8C\u5E76\u8FDB\u5165\u5168\u7403\u7AD9\u70B9\u3002',
          {
            durationMs: 4200
          }
        );
        return true;
      }

      if ([
        'switch-trigger-not-found',
        'switch-trigger-click-failed',
        'switch-target-not-found',
        'switch-target-click-failed',
        'missing-current-shop',
        'shop-not-ready-for-global-entry'
      ].includes(status)) {
        const targetShopName = getShopTargetName(shopEntry);
        const currentShopName = normalizeText(result && result.currentShopName);
        const siteMainModel = result && result.siteMainModel && typeof result.siteMainModel === 'object'
          ? result.siteMainModel
          : null;
        const currentShopRowText = normalizeText(
          (siteMainModel && siteMainModel.currentShopRowText)
          || (result && result.shopRowText)
        );
        const globalEntryFound = Boolean(
          result && result.globalEntryFound === true
          || siteMainModel && siteMainModel.globalEntryFound === true
        );
        const currentShopLabel = currentShopName
          ? `\u5F53\u524D\u9875\u9762\u8BC6\u522B\u5230\u7684\u5E97\u94FA\uFF1A${currentShopName}\u3002`
          : `\u672A\u8BC6\u522B\u5230\u5F53\u524D\u9875\u9762\u5E97\u94FA\uFF0C\u76EE\u6807\u5E97\u94FA\uFF1A\u300C${targetShopName}\u300D\u3002`;
        const rowLabel = currentShopRowText
          ? `\u9875\u9762\u5E97\u94FA\u533A\u57DF\u6587\u672C\uFF1A${currentShopRowText}\u3002`
          : '';
        const globalEntryLabel = globalEntryFound
          ? '\u5DF2\u8BC6\u522B\u5230\u300C\u5168\u7403\u300D\u5165\u53E3\uFF0C\u4F46\u5E97\u94FA\u672A\u901A\u8FC7\u6821\u9A8C\uFF0C\u672A\u6267\u884C\u70B9\u51FB\u3002'
          : '\u672A\u8BC6\u522B\u5230\u300C\u5168\u7403\u300D\u5165\u53E3\u3002';
        notifyBrowserTabMessage(
          context,
          `${currentShopLabel}${rowLabel}\u65E0\u6CD5\u81EA\u52A8\u5207\u6362\u5230\u914D\u7F6E\u5E97\u94FA\u300C${targetShopName}\u300D\u3002${globalEntryLabel}`,
          {
            persistent: true
          }
        );
        return true;
      }

      if (status === 'missing-global-entry' || status === 'global-click-failed') {
        notifyBrowserTabMessage(
          context,
          '\u5DF2\u5B8C\u6210\u5E97\u94FA\u6821\u9A8C\uFF0C\u4F46\u672A\u80FD\u81EA\u52A8\u8FDB\u5165\u300C\u5168\u7403\u300D\uFF0C\u8BF7\u5728\u5F53\u524D\u9875\u9762\u624B\u52A8\u7EE7\u7EED\u3002',
          {
            persistent: true
          }
        );
        return true;
      }

      return true;
    } catch (error) {
      state.lastSiteMainStatus = 'error';
      logError('shop_seller_center_site_main_automation_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl
      });
      return true;
    }
  }

  async function runManagedLoginPageSessionCheck(view, context, currentUrl, shopEntry) {
    if (!ENABLE_SELLER_SESSION_STATUS_PROBE) {
      return false;
    }

    if (!isViewUsable(view) || context.pageType !== 'seller-center') {
      return false;
    }

    if (!(isAuthenticationPageUrl(currentUrl) || isLoginAutofillUrl(currentUrl))) {
      return false;
    }

    const state = syncAutomationState(view, currentUrl, context);
    const now = Date.now();

    if (state.sessionProbeRunning) {
      return false;
    }

    if (
      state.lastLoginPageSessionProbeAt > 0
      && now - state.lastLoginPageSessionProbeAt < LOGIN_PAGE_SESSION_STATUS_CHECK_MIN_GAP_MS
    ) {
      return false;
    }

    state.sessionProbeRunning = true;
    state.lastLoginPageSessionProbeAt = now;

    try {
      const result = await probeSellerSessionForView(shopEntry, currentUrl);
      const probeStatus = normalizeText(result && result.status).toLowerCase();
      updateShopSellerAuthSessionSnapshot(shopEntry, result);

      state.lastSessionProbeStatus = probeStatus;

      if (shouldLogSellerSessionProbeResult(state, currentUrl, probeStatus, 'login-page', now)) {
        log('shop_login_page_session_status_checked', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          url: currentUrl,
          result: {
            status: probeStatus,
            responseType: normalizeText(result && result.responseType),
            origin: normalizeText(result && result.origin),
            httpStatus: Math.max(0, Number(result && result.httpStatus) || 0),
            mallCount: Math.max(0, Number(result && result.mallCount) || 0),
            message: normalizeText(result && (result.message || result.errorMessage))
          }
        });
      }

      if (probeStatus !== 'online') {
        return false;
      }

      if (await handleSellerSessionOnlineState(view, context, currentUrl, shopEntry, result)) {
        return true;
      }

      clearManualAutomationBlock(state);
      state.followUpCount = 0;
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.AUTHENTICATED, {
        now: Date.now(),
        reason: 'login-page-session-online',
        url: currentUrl,
        lastAutofillStatus: state.lastAutofillStatus
      });

      notifyBrowserTabMessage(
        context,
        '\u68C0\u6D4B\u5230\u5F53\u524D\u4F1A\u8BDD\u5DF2\u7ECF\u767B\u5F55\u6210\u529F\uFF0C\u6B63\u5728\u8DF3\u8F6C\u5230\u5356\u5BB6\u4E3B\u9875\u3002',
        {
          durationMs: 3600
        }
      );

      log('shop_login_page_session_online_redirect', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        sourceUrl: currentUrl,
        targetUrl: SELLER_CENTER_PORTAL_URL,
        malls: normalizeMallRecords(result && result.malls)
      });

      loadInCurrentView(view, SELLER_CENTER_PORTAL_URL);
      return true;
    } catch (error) {
      logError('shop_login_page_session_status_check_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url: currentUrl
      });
      return false;
    } finally {
      state.sessionProbeRunning = false;
    }
  }

  async function runSellerSessionStatusCheck(view, context, trigger) {
    if (!ENABLE_SELLER_SESSION_STATUS_PROBE) {
      return;
    }

    if (!isViewUsable(view) || context.pageType !== 'seller-center') {
      return;
    }

    const currentUrl = normalizeText(view.webContents.getURL());

    if (!isSellerCenterWorkspaceUrl(currentUrl)) {
      return;
    }

    const state = syncAutomationState(view, currentUrl, context);
    const shopEntry = shopEntriesById.get(context.shopId);
    const authConfig = shopEntry && shopEntry.environment ? shopEntry.environment.authConfig : null;

    if (state.sessionProbeRunning) {
      return;
    }

    state.sessionProbeRunning = true;
    state.lastSessionProbeAt = Date.now();

    try {
      const result = await probeSellerSessionForView(shopEntry, currentUrl);
      const probeStatus = normalizeText(result && result.status).toLowerCase();
      const now = Date.now();
      updateShopSellerAuthSessionSnapshot(shopEntry, result);

      state.lastSessionProbeStatus = probeStatus;

      if (shouldLogSellerSessionProbeResult(state, currentUrl, probeStatus, 'workspace', now)) {
        log('shop_login_session_status_checked', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          trigger,
          url: currentUrl,
          result: {
            status: probeStatus,
            responseType: normalizeText(result && result.responseType),
            origin: normalizeText(result && result.origin),
            httpStatus: Math.max(0, Number(result && result.httpStatus) || 0),
            mallCount: Math.max(0, Number(result && result.mallCount) || 0),
            message: normalizeText(result && (result.message || result.errorMessage))
          }
        });
      }

      if (probeStatus === 'online') {
        state.sessionProbeErrorCount = 0;
        if (await handleSellerSessionOnlineState(view, context, currentUrl, shopEntry, result)) {
          return;
        }
        markAutomationAuthenticated(context, state, currentUrl);
        queueSellerSessionStatusCheck(
          view,
          context,
          'session-status-online',
          SELLER_SESSION_STATUS_CHECK_INTERVAL_MS
        );
        return;
      }

      if (probeStatus === 'offline') {
        state.sessionProbeErrorCount = 0;
        beginSellerCenterRelogin(view, context, currentUrl, authConfig, {
          reason: 'user-info-offline',
          probeStatus,
          message: '\u68C0\u6D4B\u5230\u540E\u7AEF\u4F1A\u8BDD\u5DF2\u5931\u6548\uFF0C\u6B63\u5728\u81EA\u52A8\u91CD\u767B\u3002',
          logEventName: 'shop_login_session_offline_redirect'
        });
        return;
      }

      state.sessionProbeErrorCount += 1;
      queueSellerSessionStatusCheck(
        view,
        context,
        'session-status-retry',
        SELLER_SESSION_STATUS_ERROR_RETRY_MS
      );
    } catch (error) {
      state.lastSessionProbeStatus = 'error';
      state.sessionProbeErrorCount += 1;
      logError('shop_login_session_status_check_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        trigger,
        url: currentUrl
      });
      queueSellerSessionStatusCheck(
        view,
        context,
        'session-status-error',
        SELLER_SESSION_STATUS_ERROR_RETRY_MS
      );
    } finally {
      state.sessionProbeRunning = false;
    }
  }

  async function runLoginAutofillInjection(view, context, trigger) {
    if (!isViewUsable(view)) {
      return;
    }

    if (!isPageAutoLoginEnabled(context.shopId, context.pageType)) {
      return;
    }

    const currentUrl = normalizeText(view.webContents.getURL());

    if (!isAutomationRelevantUrl(context.pageType, currentUrl)) {
      return;
    }

    const state = syncAutomationState(view, currentUrl, context);
    const now = Date.now();
    const shopEntry = shopEntriesById.get(context.shopId);
    let authConfig = shopEntry && shopEntry.environment ? shopEntry.environment.authConfig : null;

    syncAutomationPhaseByUrl(context, state, currentUrl);

    if (await runProductPromotionActivityBridge(view, context, currentUrl, state)) {
      return;
    }

    if (await runPopupMessageBridge(view, context, currentUrl, state)) {
      return;
    }

    if (await runManagedLoginPageSessionCheck(view, context, currentUrl, shopEntry)) {
      return;
    }

    if (runAuthenticationPageAutomation(view, context, currentUrl, authConfig)) {
      return;
    }

    if (await runSellerCenterSiteMainAutomation(view, context, currentUrl, shopEntry, state)) {
      return;
    }

    if (
      context.pageType === 'product-promotion'
      && (
        isProductPromotionTicketLoginUrl(currentUrl)
        || isProductPromotionAnonymousLoginPendingUrl(currentUrl)
      )
    ) {
      return;
    }

    if (!isLoginAutofillUrl(currentUrl)) {
      return;
    }

    await ensurePopupMessageCaptureBridge(view, context, currentUrl, state);
    await ensureProductPromotionActivityLoginOpenerBridge(view, context, currentUrl, state);

    if (state.verificationBlockedUrl && state.verificationBlockedUrl === currentUrl) {
      setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.WAITING_MANUAL_VERIFICATION, {
        now,
        reason: 'manual-verification-blocked',
        url: currentUrl
      });
      notifyManualVerificationRequired(context);
      return;
    }

    if (isAutomationCooldownActive(state, now)) {
      return;
    }

    if (
      state.lastAutofillAttemptAt > 0
      && now - state.lastAutofillAttemptAt < LOGIN_AUTOMATION_MIN_INJECTION_GAP_MS
    ) {
      return;
    }

    if (!hasCompleteAuthConfig(authConfig)) {
      log('shop_login_autofill_skipped', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        trigger,
        url: currentUrl,
        reason: 'missing-auth'
      });
      return;
    }

    authConfig = await maybeRefreshLoginAuthConfig(shopEntry, currentUrl, state, authConfig);

    if (!hasCompleteAuthConfig(authConfig)) {
      log('shop_login_autofill_skipped', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        trigger,
        url: currentUrl,
        reason: 'missing-auth-after-refresh'
      });
      return;
    }

    state.lastAutofillAttemptAt = now;

    try {
      await ensureLoginAutofillHelper(view, currentUrl, authConfig, state);
      const result = await view.webContents.executeJavaScript(
        buildRunInstalledLoginAutofillScript(),
        true
      );
      const resultStatus = normalizeText(result && result.status).toLowerCase();

      if (resultStatus === 'helper-missing') {
        state.autofillHelperReady = false;
        await ensureLoginAutofillHelper(view, currentUrl, authConfig, state);
      }

      const finalResult = resultStatus === 'helper-missing'
        ? await view.webContents.executeJavaScript(
          buildRunInstalledLoginAutofillScript(),
          true
        )
        : result;
      const finalResultStatus = normalizeText(finalResult && finalResult.status).toLowerCase();

      if (shouldLogLoginAutofillResult(state, currentUrl, finalResultStatus, Date.now())) {
        log('shop_login_autofill_injected', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          trigger,
          url: currentUrl,
          authConfig: buildLoginAutofillLogAuthConfig(authConfig),
          result: buildLoginAutofillLogResult(finalResult)
        });
      }
      if (shouldCollectLoginDebugSnapshot(finalResultStatus)) {
        await collectLoginDebugSnapshot(view, context, currentUrl, finalResultStatus, authConfig);
      }
      handleLoginAutofillResult(view, context, currentUrl, finalResult);
    } catch (error) {
      logError('shop_login_autofill_inject_failed', error, {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        trigger,
        url: currentUrl
      });
    }
  }

  async function handlePopupNewTab(view, context, url) {
    if (!canLoadInCurrentView(url)) {
      return;
    }

    const shopEntry = shopEntriesById.get(context.shopId);

    if (!shopEntry) {
      return;
    }

    const reusablePopupEntry = findReusablePopupEntry(shopEntry, context, url);

    if (reusablePopupEntry) {
      const reusableUrl = normalizeText(url);
      if (reusablePopupEntry.meta) {
        reusablePopupEntry.meta.url = reusableUrl;
      }
      reusablePopupEntry.popupOpener = {
        shopId: normalizeText(context.shopId),
        pageType: normalizeText(context.pageType),
        browserTabId: normalizeText(context.browserTabId),
        sourceUrl: normalizeText(isViewUsable(view) ? view.webContents.getURL() : ''),
        targetUrl: reusableUrl
      };

      if (isViewUsable(reusablePopupEntry.view)) {
        loadInCurrentView(reusablePopupEntry.view, reusableUrl);
      } else if (reusablePopupEntry.meta) {
        reusablePopupEntry.meta.url = reusableUrl;

        if (normalizeText(reusablePopupEntry.meta.id) && !normalizeText(reusablePopupEntry.backgroundGroupKey)) {
          updateTabMeta(
            normalizeText(context.shopId),
            normalizeText(context.pageType),
            normalizeText(reusablePopupEntry.meta.id),
            {
              url: reusableUrl
            }
          );
        }
      }

      log('shop_popup_reused_existing_entry', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        targetUrl: reusableUrl,
        reusedBrowserTabId: normalizeText(reusablePopupEntry.meta && reusablePopupEntry.meta.id),
        reusedEntryUrl: getManagedEntryCurrentUrl(reusablePopupEntry)
      });
      return;
    }

    const backgroundGroupKey = normalizeText(context && context.backgroundGroupKey);

    if (backgroundGroupKey) {
      const backgroundEntry = ensureBackgroundViewEntry(
        shopEntry,
        context.pageType,
        backgroundGroupKey,
        createTabId(),
        url
      );

      backgroundEntry.popupOpener = {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        sourceUrl: normalizeText(isViewUsable(view) ? view.webContents.getURL() : ''),
        targetUrl: normalizeText(url)
      };

      await ensureEnvironmentApplied(shopEntry);

      if (!backgroundEntry.view) {
        createTabView(shopEntry, context.pageType, backgroundEntry, url);
      }

      log('shop_background_browser_tab_created', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: backgroundEntry.meta.id,
        url,
        backgroundGroupKey
      });
      return;
    }

    const pageEntry = ensurePageEntry(shopEntry, context.pageType);

    if (pageEntry.order.length >= MAX_BROWSER_TABS_PER_PAGE) {
      const currentTabEntry = pageEntry.tabs.get(context.browserTabId);

      loadInCurrentView(currentTabEntry && currentTabEntry.view, url);
      notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, {
        shopId: context.shopId,
        pageType: context.pageType,
        message: '\u5F53\u524D\u529F\u80FD\u533A\u6700\u591A\u53EA\u80FD\u6253\u5F00 10 \u4E2A\u6807\u7B7E\uFF0C\u5DF2\u5728\u5F53\u524D\u6807\u7B7E\u7EE7\u7EED\u6253\u5F00\u3002'
      });
      log('shop_tab_limit_reached', {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        url
      });
      return;
    }

    const browserTabId = createTabId();
    const tabMeta = buildTabMeta(context.pageType, browserTabId, pageEntry.nextSequence, url);

    pageEntry.nextSequence += 1;
    pageEntry.tabs.set(browserTabId, {
      meta: tabMeta,
      view: null,
      popupOpener: {
        shopId: context.shopId,
        pageType: context.pageType,
        browserTabId: context.browserTabId,
        sourceUrl: normalizeText(isViewUsable(view) ? view.webContents.getURL() : ''),
        targetUrl: normalizeText(url)
      }
    });
    pageEntry.order.push(browserTabId);

    notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_CREATED, {
      shopId: context.shopId,
      pageType: context.pageType,
      tab: buildRendererTab(tabMeta)
    });
    log('shop_browser_tab_created', {
      shopId: context.shopId,
      pageType: context.pageType,
      browserTabId,
      url
    });
  }

  function attachOpenHandler(view, context) {
    view.webContents.setWindowOpenHandler(({ url }) => {
      const reuseTargetUrl = resolveCurrentTabPopupTargetUrl(view, context, url);

      if (reuseTargetUrl) {
        loadInCurrentView(view, reuseTargetUrl);
        log('shop_popup_reused_current_tab', {
          shopId: context.shopId,
          pageType: context.pageType,
          browserTabId: context.browserTabId,
          sourceUrl: normalizeText(view.webContents.getURL()),
          targetUrl: url,
          reuseTargetUrl
        });

        return {
          action: 'deny'
        };
      }

      Promise.resolve(handlePopupNewTab(view, context, url)).catch(() => {
        if (context.suppressRendererNotifications !== true) {
          notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, {
            shopId: context.shopId,
            pageType: context.pageType,
            message: '\u65B0\u6807\u7B7E\u521B\u5EFA\u5931\u8D25\uFF0C\u5DF2\u53D6\u6D88\u8BE5\u8DF3\u8F6C\u3002'
          });
        }
      });

      return {
        action: 'deny'
      };
    });
  }

  async function ensureShopRuntimeProfile(shopEntry, payload) {
    const nextRuntimeProfileVersion = normalizeText(payload && payload.shopUpdatedAt);
    const forceRefresh = payload && payload.forceRefreshRuntimeProfile === true;
    const runtimeEnvironmentPayloadChanged = isRuntimeEnvironmentPayloadChanged(shopEntry, payload);

    if (
      !loadShopRuntimeProfile
      || (
        !forceRefresh
        && !runtimeEnvironmentPayloadChanged
        && (
          (
            !shopEntry.runtimeProfile
            && nextRuntimeProfileVersion
            && shopEntry.runtimeProfileVersion === nextRuntimeProfileVersion
          )
          || (
            shopEntry.runtimeProfile
            && (
              !nextRuntimeProfileVersion
              || shopEntry.runtimeProfileVersion === nextRuntimeProfileVersion
            )
          )
        )
      )
    ) {
      return shopEntry.runtimeProfile;
    }

    try {
      shopEntry.runtimeProfile = normalizeRuntimeProfile(await loadShopRuntimeProfile({
        shopId: shopEntry.shopId
      }));
    } catch (error) {
      shopEntry.runtimeProfile = null;
      logError('shop_runtime_profile_load_failed', error, {
        shopId: shopEntry.shopId
      });
    }

    shopEntry.runtimeProfileVersion =
      nextRuntimeProfileVersion
      || normalizeText(shopEntry.runtimeProfile && shopEntry.runtimeProfile.updatedAt);

    return shopEntry.runtimeProfile;
  }

  function isBrowserStorageAutoSyncEnabledForShopEntry(shopEntry) {
    return !(
      shopEntry
      && shopEntry.runtimeProfile
      && shopEntry.runtimeProfile.browserStorageAutoSyncEnabled === false
    );
  }

  function buildBackgroundStorageRestoreSignature(shopEntry) {
    return [
      normalizeText(shopEntry && shopEntry.partition),
      normalizeText(shopEntry && shopEntry.runtimeProfileVersion),
      isBrowserStorageAutoSyncEnabledForShopEntry(shopEntry) ? 'auto-sync-on' : 'auto-sync-off'
    ].join('|');
  }

  function resetBackgroundStorageRestoreState(shopEntry) {
    if (!shopEntry) {
      return;
    }

    shopEntry.backgroundStorageRestoreSignature = '';
    shopEntry.backgroundStorageRestorePromise = null;
    shopEntry.backgroundStorageRestoreCompletedAt = 0;
    shopEntry.backgroundStorageRestoreFailedAt = 0;
    shopEntry.backgroundStorageRestoreLastError = '';
  }

  async function maybeRestoreBrowserStorageForBackgroundSellerSession(shopEntry, payload = {}) {
    if (
      !shopEntry
      || !normalizeText(shopEntry.shopId)
      || !normalizeText(shopEntry.partition)
      || payload.restoreBrowserStorage === false
    ) {
      return {
        attempted: false
      };
    }

    if (!isBrowserStorageAutoSyncEnabledForShopEntry(shopEntry)) {
      return {
        attempted: false,
        skippedReason: 'auto-sync-disabled'
      };
    }

    const browserStorageSyncService = getBrowserStorageSyncServiceSafe();

    if (
      !browserStorageSyncService
      || typeof browserStorageSyncService.restoreFromCloud !== 'function'
    ) {
      return {
        attempted: false,
        skippedReason: 'service-unavailable'
      };
    }

    const nextRestoreSignature = buildBackgroundStorageRestoreSignature(shopEntry);

    if (normalizeText(shopEntry.backgroundStorageRestoreSignature) !== nextRestoreSignature) {
      resetBackgroundStorageRestoreState(shopEntry);
      shopEntry.backgroundStorageRestoreSignature = nextRestoreSignature;
    }

    if (shopEntry.backgroundStorageRestorePromise) {
      return shopEntry.backgroundStorageRestorePromise;
    }

    const forceRestore = payload.forceBrowserStorageRestore === true;
    const now = Date.now();

    if (!forceRestore && Number(shopEntry.backgroundStorageRestoreCompletedAt) > 0) {
      return {
        attempted: false,
        skippedReason: 'already-restored',
        completedAt: Number(shopEntry.backgroundStorageRestoreCompletedAt) || 0
      };
    }

    if (
      !forceRestore
      && Number(shopEntry.backgroundStorageRestoreFailedAt) > 0
      && (now - Number(shopEntry.backgroundStorageRestoreFailedAt))
        < BACKGROUND_BROWSER_STORAGE_RESTORE_RETRY_COOLDOWN_MS
    ) {
      return {
        attempted: false,
        skippedReason: 'recent-failure',
        errorMessage: normalizeText(shopEntry.backgroundStorageRestoreLastError)
      };
    }

    shopEntry.backgroundStorageRestorePromise = (async () => {
      try {
        const restoreResult = await browserStorageSyncService.restoreFromCloud({
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          types: ['cookies', 'localStorage', 'indexedDb'],
          reloadActiveView: false,
          reason: normalizeText(payload && payload.restoreReason) || 'background-seller-center-global-session',
          skipRestoreWhenLocalSessionReady: true,
          skipCookieRestoreWhenSessionOnline: true
        });

        shopEntry.backgroundStorageRestoreCompletedAt = Date.now();
        shopEntry.backgroundStorageRestoreFailedAt = 0;
        shopEntry.backgroundStorageRestoreLastError = '';

        log('shop_background_browser_storage_restore_completed', {
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          partition: normalizeText(shopEntry && shopEntry.partition),
          skippedCookieRestore: restoreResult && restoreResult.skippedCookieRestore === true,
          skippedFullRestore: restoreResult && restoreResult.skippedFullRestore === true,
          skippedRestoreBecauseSessionReady:
            restoreResult && restoreResult.skippedRestoreBecauseSessionReady === true
        });

        return {
          attempted: true,
          success: true,
          restoreResult
        };
      } catch (error) {
        const errorMessage = normalizeText(error && error.message);

        shopEntry.backgroundStorageRestoreFailedAt = Date.now();
        shopEntry.backgroundStorageRestoreLastError = errorMessage;

        logError('shop_background_browser_storage_restore_failed', error, {
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          partition: normalizeText(shopEntry && shopEntry.partition),
          restoreReason:
            normalizeText(payload && payload.restoreReason) || 'background-seller-center-global-session'
        });

        return {
          attempted: true,
          success: false,
          errorMessage
        };
      } finally {
        shopEntry.backgroundStorageRestorePromise = null;
      }
    })();

    return shopEntry.backgroundStorageRestorePromise;
  }

  function normalizeLoginAuthConfig(authConfig) {
    const accountIdentity = resolveAccountIdentity(authConfig);
    return {
      phoneNumber: accountIdentity.phoneNumber,
      email: accountIdentity.email,
      accountValue: accountIdentity.accountValue,
      accountType: accountIdentity.accountType,
      loginPassword: normalizeText(authConfig && authConfig.loginPassword)
    };
  }

  async function maybeRefreshLoginAuthConfig(shopEntry, currentUrl, state, authConfig) {
    const currentAuthConfig = normalizeLoginAuthConfig(authConfig);

    if (
      !shopEntry
      || !state
      || (!isAuthenticationPageUrl(currentUrl) && !isLoginAutofillUrl(currentUrl))
    ) {
      return currentAuthConfig;
    }

    const now = Date.now();

    if (
      state.lastLoginAuthConfigRefreshUrl === currentUrl
      && now - (Number(state.lastLoginAuthConfigRefreshAt) || 0) < LOGIN_AUTOFILL_AUTH_CONFIG_REFRESH_THROTTLE_MS
    ) {
      return currentAuthConfig;
    }

    state.lastLoginAuthConfigRefreshAt = now;
    state.lastLoginAuthConfigRefreshUrl = currentUrl;

    try {
      const runtimeProfile = await ensureShopRuntimeProfile(shopEntry, {
        shopId: shopEntry.shopId,
        forceRefreshRuntimeProfile: true
      });
      const refreshedAuthConfig = normalizeLoginAuthConfig(runtimeProfile);

      if (!hasCompleteAuthConfig(refreshedAuthConfig)) {
        return currentAuthConfig;
      }

      if (
        currentAuthConfig.phoneNumber !== refreshedAuthConfig.phoneNumber
        || currentAuthConfig.email !== refreshedAuthConfig.email
        || currentAuthConfig.loginPassword !== refreshedAuthConfig.loginPassword
      ) {
        if (shopEntry.environment && typeof shopEntry.environment === 'object') {
          shopEntry.environment.authConfig = refreshedAuthConfig;
        }

        log('shop_login_auth_config_refreshed', {
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          url: currentUrl,
          previousAccount: normalizeText(currentAuthConfig.phoneNumber || currentAuthConfig.email),
          nextAccount: normalizeText(refreshedAuthConfig.phoneNumber || refreshedAuthConfig.email)
        });
      }

      return refreshedAuthConfig;
    } catch (error) {
      logError('shop_login_auth_config_refresh_failed', error, {
        shopId: normalizeText(shopEntry && shopEntry.shopId),
        url: currentUrl
      });
      return currentAuthConfig;
    }
  }

  async function ensureShopEnvironment(payload) {
    const shopEntry = ensureShopEntry(payload);
    const runtimeProfile = await ensureShopRuntimeProfile(shopEntry, payload);
    const runtimeAccountIdentity = resolveAccountIdentity(runtimeProfile);
    const payloadAccountIdentity = resolveAccountIdentity(payload);
    const accountIdentity = runtimeAccountIdentity.accountValue
      ? runtimeAccountIdentity
      : payloadAccountIdentity;
    const runtimeShopName =
      normalizeText(runtimeProfile && runtimeProfile.shopName)
      || normalizeText(payload && payload.shopName);
    const environmentPayload = {
      ...(payload || {}),
      phoneNumber: accountIdentity.phoneNumber,
      email: accountIdentity.email,
      accountValue: accountIdentity.accountValue,
      accountType: accountIdentity.accountType,
      shopName: runtimeShopName,
      proxyConfig:
        (runtimeProfile && runtimeProfile.proxyConfig)
        || (payload && payload.proxyConfig)
        || null,
      fingerprintConfig:
        (runtimeProfile && runtimeProfile.fingerprintConfig)
        || (payload && payload.fingerprintConfig)
        || null,
      authConfig: {
        phoneNumber: accountIdentity.phoneNumber,
        email: accountIdentity.email,
        accountValue: accountIdentity.accountValue,
        accountType: accountIdentity.accountType,
        loginPassword: normalizeText(runtimeProfile && runtimeProfile.loginPassword)
      }
    };
    const nextPartition = getPartition(environmentPayload);
    const environment = await buildShopBrowserEnvironment(environmentPayload);
    const environmentSignature = buildEnvironmentSignature(environment);
    const partitionChanged = shopEntry.partition !== nextPartition;

    if (partitionChanged || (shopEntry.environmentSignature && shopEntry.environmentSignature !== environmentSignature)) {
      resetShopViews(shopEntry);
      shopEntry.appliedEnvironmentSignature = '';
      resetBackgroundStorageRestoreState(shopEntry);
    }

    tryMigrateLegacyPartition(payload, nextPartition);
    shopEntry.partition = nextPartition;
    shopEntry.environment = environment;
    shopEntry.environmentSignature = environmentSignature;
    return shopEntry;
  }

  async function resolveShopEntry(payload) {
    const shopEntry = ensureShopEntry(payload);
    const hasRuntimeEnvironment = hasRuntimeEnvironmentPayload(payload);
    const nextRuntimeProfileVersion = normalizeText(payload && payload.shopUpdatedAt);
    const forceRuntimeProfileRefresh = payload && payload.forceRefreshRuntimeProfile === true;
    const runtimeProfileVersionChanged = Boolean(
      nextRuntimeProfileVersion
      && shopEntry.runtimeProfileVersion !== nextRuntimeProfileVersion
    );

    if (
      !shopEntry.environment
      || hasRuntimeEnvironment
      || forceRuntimeProfileRefresh
      || runtimeProfileVersionChanged
    ) {
      return ensureShopEnvironment(payload);
    }

    return shopEntry;
  }

  function recoverSellerCenterGlobalSessionInView(view, context, shopEntry, currentUrl, options = {}) {
    if (!isViewUsable(view)) {
      return false;
    }

    const normalizedCurrentUrl = normalizeText(currentUrl);
    const authConfig = shopEntry && shopEntry.environment ? shopEntry.environment.authConfig : null;

    if (
      !normalizedCurrentUrl
      || isBrowserLoadErrorPageUrl(normalizedCurrentUrl)
      || !isSellerCenterRelatedUrl(normalizedCurrentUrl)
    ) {
      loadInCurrentView(view, SELLER_CENTER_PORTAL_URL);
      return true;
    }

    if (
      isAuthenticationPageUrl(normalizedCurrentUrl)
      || isLoginAutofillUrl(normalizedCurrentUrl)
      || isSellerCenterSiteMainUrl(normalizedCurrentUrl)
    ) {
      queueLoginAutofillInjection(
        view,
        context,
        normalizeText(options.trigger) || 'seller-center-global-session-recovery',
        Math.max(0, Number(options.delayMs) || 80)
      );
      return true;
    }

    if (!isSellerCenterWorkspaceUrl(normalizedCurrentUrl)) {
      return false;
    }

    const reloginStarted = beginSellerCenterRelogin(
      view,
      context,
      normalizedCurrentUrl,
      authConfig,
      {
        reason: normalizeText(options.reason) || 'seller-center-global-session-recovery',
        message: normalizeText(options.message)
          || '\u68c0\u6d4b\u5230\u5356\u5bb6\u4e2d\u5fc3\u5168\u7403\u4f1a\u8bdd\u5c1a\u672a\u5c31\u7eea\uff0c\u6b63\u5728\u5c1d\u8bd5\u6062\u590d\u767b\u5f55\u3002',
        logEventName: normalizeText(options.logEventName)
          || 'shop_background_seller_center_global_session_relogin'
      }
    );

    if (!reloginStarted) {
      loadInCurrentView(view, SELLER_CENTER_PORTAL_URL);
    }

    return true;
  }

  async function ensureEnvironmentApplied(shopEntry) {
    if (shopEntry.appliedEnvironmentSignature === shopEntry.environmentSignature) {
      return;
    }

    if (
      shopEntry.environmentApplyPromise
      && shopEntry.environmentApplySignature === shopEntry.environmentSignature
    ) {
      await shopEntry.environmentApplyPromise;
      return;
    }

    const targetSignature = shopEntry.environmentSignature;
    const startedAt = Date.now();

    shopEntry.environmentApplySignature = targetSignature;
    shopEntry.environmentApplyPromise = (async () => {
      const partitionStartedAt = Date.now();
      await applyPartitionEnvironment(shopEntry.partition, shopEntry.environment);
      const partitionDurationMs = Date.now() - partitionStartedAt;

      if (shopEntry.environmentSignature === targetSignature) {
        shopEntry.appliedEnvironmentSignature = targetSignature;
      }

      const totalDurationMs = Date.now() - startedAt;

      if (totalDurationMs >= SHOP_ENVIRONMENT_APPLY_SLOW_LOG_THRESHOLD_MS) {
        log('shop_environment_apply_slow', {
          shopId: normalizeText(shopEntry && shopEntry.shopId),
          partition: normalizeText(shopEntry && shopEntry.partition),
          totalDurationMs,
          partitionDurationMs
        });
      }
    })().finally(() => {
      if (shopEntry.environmentApplySignature === targetSignature) {
        shopEntry.environmentApplySignature = '';
        shopEntry.environmentApplyPromise = null;
      }
    });

    await shopEntry.environmentApplyPromise;
  }

  function createTabView(shopEntry, pageType, tabEntry, initialUrl) {
    const view = new WebContentsView({
      webPreferences: buildViewWebPreferences(
        shopEntry.partition,
        shopEntry.environment.fingerprintConfig,
        shopEntry.environment.authConfig
      )
    });

    const context = tabEntry && tabEntry.context && typeof tabEntry.context === 'object'
      ? {
        ...tabEntry.context,
        shopId: shopEntry.shopId,
        pageType,
        browserTabId: normalizeText(tabEntry.context.browserTabId) || tabEntry.meta.id
      }
      : {
        shopId: shopEntry.shopId,
        pageType,
        browserTabId: tabEntry.meta.id
    };

    view.setBackgroundColor('#ffffff');
    view.setVisible(false);
    updateViewLoadStateContext(view, shopEntry, context);
    installWebContentsDebugShortcuts(view);
    attachOpenHandler(view, context);
    attachNavigationListeners(view, context);
    attachShopWindowContextMenu(view, context, {
      window: mainWindow,
      openUrlInNewTab: openBrowserUrlInNewTab,
      onError(error) {
        logError('shop_window_context_menu_action_failed', error, {
          shopId: normalizeText(context && context.shopId),
          pageType: normalizeText(context && context.pageType),
          browserTabId: normalizeText(context && context.browserTabId)
        });
      }
    });
    applyViewEnvironment(view, shopEntry.environment);

    if (context.suppressRendererNotifications === true && isWindowAlive()) {
      try {
        if (!attachedViews.has(view)) {
          mainWindow.contentView.addChildView(view);
          attachedViews.add(view);
        }

        view.setBounds({
          x: 0,
          y: 0,
          width: 0,
          height: 0
        });
      } catch (_error) {
        // Ignore hidden background attach failures and rely on direct webContents loading.
      }
    }

    tabEntry.view = view;

    const loadUrl = initialUrl || tabEntry.meta.url || getWorkspaceUrl(pageType);

    if (loadUrl && loadUrl !== tabEntry.meta.url) {
      tabEntry.meta.url = loadUrl;
    }

    loadUrlIntoView(view, loadUrl, null, {
      context,
      reason: 'initial-view-load'
    });
  }

  async function ensureTabView(payload) {
    const pageType = String((payload && payload.pageType) || '').trim();
    const browserTabId =
      String((payload && payload.browserTabId) || DEFAULT_BROWSER_TAB_ID).trim() || DEFAULT_BROWSER_TAB_ID;
    const shopEntry = await resolveShopEntry(payload);
    const pageEntry = ensurePageEntry(shopEntry, pageType);
    const tabEntry = ensureTabEntry(pageEntry, pageType, browserTabId);

    await ensureEnvironmentApplied(shopEntry);

    if (!tabEntry.view) {
      createTabView(shopEntry, pageType, tabEntry, payload && payload.initialUrl);
    }

    return tabEntry.view;
  }

  function buildBackgroundViewSnapshot(shopEntry, backgroundEntry) {
    const view = backgroundEntry && backgroundEntry.view;
    const currentUrl = normalizeText(isViewUsable(view) ? view.webContents.getURL() : '');
    const automationState = isViewUsable(view)
      ? syncAutomationState(view, currentUrl)
      : null;

    return {
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      partition: normalizeText(shopEntry && shopEntry.partition),
      pageType: normalizeText(backgroundEntry && backgroundEntry.pageType),
      browserTabId: normalizeText(backgroundEntry && backgroundEntry.meta && backgroundEntry.meta.id),
      currentUrl,
      phase: normalizeText(automationState && automationState.phase),
      lastAutofillStatus: normalizeText(automationState && automationState.lastAutofillStatus),
      lastSiteMainStatus: normalizeText(automationState && automationState.lastSiteMainStatus),
      lastSiteMainResult: automationState && automationState.lastSiteMainResult
        ? automationState.lastSiteMainResult
        : null,
      lastSessionProbeStatus: normalizeText(automationState && automationState.lastSessionProbeStatus),
      authConfigured: hasCompleteAuthConfig(shopEntry && shopEntry.environment && shopEntry.environment.authConfig),
      isWorkspaceReady: isWorkspaceReadyUrl(
        backgroundEntry && backgroundEntry.pageType,
        currentUrl
      ),
      isManagedLoginEntry: isManagedLoginEntryUrl(
        backgroundEntry && backgroundEntry.pageType,
        currentUrl
      ),
      isLoginPage: isLoginAutofillUrl(currentUrl),
      isRelatedUrl: (
        (backgroundEntry && backgroundEntry.pageType) === 'product-promotion'
          ? isProductPromotionRelatedUrl(currentUrl)
          : isSellerCenterRelatedUrl(currentUrl)
      )
    };
  }

  function ensureSellerCenterBackgroundView(shopEntry, payload = {}) {
    if (!shopEntry) {
      return null;
    }

    const backgroundGroupKey = normalizeText(payload && payload.backgroundGroupKey) || 'global-category-sync';
    const entryId = normalizeText(payload && payload.entryId) || 'default';
    const initialUrl = normalizeText(payload && payload.initialUrl) || getWorkspaceUrl('seller-center');
    const backgroundEntry = ensureBackgroundViewEntry(
      shopEntry,
      'seller-center',
      backgroundGroupKey,
      entryId,
      initialUrl
    );

    if (backgroundEntry && backgroundEntry.meta) {
      backgroundEntry.meta.url = initialUrl;
    }

    if (!backgroundEntry.view) {
      createTabView(shopEntry, 'seller-center', backgroundEntry, initialUrl);
    }

    return backgroundEntry;
  }

  function buildSellerCenterGlobalSessionError(message, extra = {}) {
    const error = new Error(
      normalizeText(message)
      || '\u5356\u5bb6\u4e2d\u5fc3\u5168\u7403\u540e\u53f0\u767b\u5f55\u5c1a\u672a\u5b8c\u6210\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
    );

    error.authRequired = extra.authRequired !== false;
    error.loginPending = extra.loginPending !== false;
    error.shopId = normalizeText(extra.shopId);
    error.currentUrl = normalizeText(extra.currentUrl);
    error.phase = normalizeText(extra.phase);
    error.lastSiteMainStatus = normalizeText(extra.lastSiteMainStatus);
    error.lastSiteMainResult = extra.lastSiteMainResult && typeof extra.lastSiteMainResult === 'object'
      ? extra.lastSiteMainResult
      : null;
    error.lastAutofillStatus = normalizeText(extra.lastAutofillStatus);
    error.manualVerification = extra.manualVerification === true;

    return error;
  }

  async function ensureBackgroundSellerCenterGlobalSession(payload = {}) {
    const normalizedShopId = normalizeText(payload && payload.shopId);
    const timeoutMs = Math.max(
      10000,
      Number(payload && payload.timeoutMs) || SELLER_CENTER_GLOBAL_SESSION_READY_TIMEOUT_MS
    );
    const pollIntervalMs = Math.max(
      300,
      Number(payload && payload.pollIntervalMs) || SELLER_CENTER_GLOBAL_SESSION_POLL_INTERVAL_MS
    );
    const shopEntry = await resolveShopEntry({
      ...(payload || {}),
      shopId: normalizedShopId,
      forceRefreshRuntimeProfile: true
    });

    await ensureEnvironmentApplied(shopEntry);

    const authConfig = shopEntry && shopEntry.environment ? shopEntry.environment.authConfig : null;

    let liveSnapshot = null;

    try {
      liveSnapshot = normalizeSellerAuthSessionSnapshot(
        await probeSellerAuthSessionForShopEntry(shopEntry)
      );
    } catch (error) {
      logError('shop_background_seller_center_global_probe_failed', error, {
        shopId: normalizedShopId,
        partition: normalizeText(shopEntry && shopEntry.partition),
        stage: 'initial'
      });
      liveSnapshot = normalizeSellerAuthSessionSnapshot(shopEntry && shopEntry.lastSellerAuthSessionSnapshot);
    }

    if (!isSellerAuthSessionOnline(liveSnapshot)) {
      const restoreResult = await maybeRestoreBrowserStorageForBackgroundSellerSession(shopEntry, payload);

      if (restoreResult && restoreResult.attempted === true && restoreResult.success === true) {
        try {
          liveSnapshot = normalizeSellerAuthSessionSnapshot(
            await probeSellerAuthSessionForShopEntry(shopEntry)
          );
        } catch (error) {
          logError('shop_background_seller_center_global_probe_failed', error, {
            shopId: normalizedShopId,
            partition: normalizeText(shopEntry && shopEntry.partition),
            stage: 'post-restore'
          });
          liveSnapshot = normalizeSellerAuthSessionSnapshot(
            shopEntry && shopEntry.lastSellerAuthSessionSnapshot
          );
        }
      }
    }

    if (isSellerAuthSessionOnline(liveSnapshot)) {
      if (payload && payload.requireView === true) {
        const backgroundEntry = ensureSellerCenterBackgroundView(shopEntry, {
          backgroundGroupKey: normalizeText(payload && payload.backgroundGroupKey) || 'global-category-sync',
          entryId: normalizeText(payload && payload.entryId) || 'default',
          initialUrl: normalizeText(payload && payload.initialUrl)
        });

        return {
          shopEntry,
          backgroundEntry,
          view: backgroundEntry && backgroundEntry.view ? backgroundEntry.view : null,
          context: backgroundEntry ? backgroundEntry.context : null,
          snapshot: backgroundEntry ? buildBackgroundViewSnapshot(shopEntry, backgroundEntry) : null,
          sessionContext: buildShopSessionContext(shopEntry, liveSnapshot),
          warmedUp: false
        };
      }

      return {
        shopEntry,
        backgroundEntry: null,
        view: null,
        context: null,
        snapshot: null,
        sessionContext: buildShopSessionContext(shopEntry, liveSnapshot),
        warmedUp: false
      };
    }

    if (!hasCompleteAuthConfig(authConfig)) {
      throw buildSellerCenterGlobalSessionError(
        '\u5f53\u524d\u5e97\u94fa\u672a\u914d\u7f6e\u5b8c\u6574\u7684\u767b\u5f55\u8d26\u53f7\u6216\u5bc6\u7801\uff0c\u65e0\u6cd5\u5728\u540e\u53f0\u81ea\u52a8\u6062\u590d\u5356\u5bb6\u4e2d\u5fc3\u5168\u7403\u540e\u53f0\u767b\u5f55\u3002\u8bf7\u5148\u5728\u5e97\u94fa\u914d\u7f6e\u4e2d\u8865\u5145\u540e\u518d\u91cd\u8bd5\u3002',
        {
          shopId: normalizedShopId,
          loginPending: false
        }
      );
    }

    const backgroundEntry = ensureSellerCenterBackgroundView(shopEntry, {
      backgroundGroupKey: normalizeText(payload && payload.backgroundGroupKey) || 'global-category-sync',
      entryId: normalizeText(payload && payload.entryId) || 'default',
      initialUrl: normalizeText(payload && payload.initialUrl)
    });

    const view = backgroundEntry.view;
    const context = backgroundEntry.context;
    const deadline = Date.now() + timeoutMs;
    let lastUrl = normalizeText(
      isViewUsable(view) && view.webContents
        ? view.webContents.getURL()
        : ''
    );
    let lastPhase = '';
    let lastSiteMainStatus = '';
    let lastSiteMainResult = null;
    let lastAutofillStatus = '';

    recoverSellerCenterGlobalSessionInView(
      view,
      context,
      shopEntry,
      lastUrl,
      {
        trigger: 'global-category-sync-warmup-initial',
        delayMs: 40,
        reason: 'global-category-sync-session-warmup',
        logEventName: 'shop_background_seller_center_global_session_relogin'
      }
    );

    while (Date.now() < deadline) {
      if (!isViewUsable(view)) {
        break;
      }

      lastUrl = normalizeText(view.webContents.getURL());
      const state = syncAutomationState(view, lastUrl);

      syncAutomationPhaseByUrl(context, state, lastUrl);

      lastPhase = normalizeText(state && state.phase);
      lastSiteMainStatus = normalizeText(state && state.lastSiteMainStatus);
      lastSiteMainResult = state && state.lastSiteMainResult
        ? state.lastSiteMainResult
        : null;
      lastAutofillStatus = normalizeText(state && state.lastAutofillStatus);

      if (
        state.verificationBlockedUrl
        || lastPhase === LOGIN_AUTOMATION_PHASES.WAITING_MANUAL_VERIFICATION
      ) {
        throw buildSellerCenterGlobalSessionError(
          '\u5356\u5bb6\u4e2d\u5fc3\u5168\u7403\u540e\u53f0\u767b\u5f55\u4ecd\u9700\u624b\u52a8\u5b8c\u6210\u9a8c\u8bc1\u7801\u3001\u6388\u6743\u6216\u534f\u8bae\u786e\u8ba4\u3002\u8bf7\u5148\u5728\u6d4f\u89c8\u7a97\u53e3\u6253\u5f00\u5bf9\u5e94\u5e97\u94fa\u7684\u5356\u5bb6\u4e2d\u5fc3\u5168\u7403\u540e\u53f0\u5de5\u4f5c\u53f0\uff0c\u5b8c\u6210\u767b\u5f55\u540e\u518d\u91cd\u8bd5\u3002',
          {
            shopId: normalizedShopId,
            currentUrl: lastUrl,
            phase: lastPhase,
            lastSiteMainStatus,
            lastSiteMainResult,
            lastAutofillStatus,
            manualVerification: true
          }
        );
      }

      try {
        liveSnapshot = normalizeSellerAuthSessionSnapshot(
          await probeSellerAuthSessionForShopEntry(shopEntry)
        );
      } catch (error) {
        logError('shop_background_seller_center_global_probe_failed', error, {
          shopId: normalizedShopId,
          partition: normalizeText(shopEntry && shopEntry.partition),
          currentUrl: lastUrl,
          phase: lastPhase,
          stage: 'polling'
        });
        liveSnapshot = normalizeSellerAuthSessionSnapshot(shopEntry && shopEntry.lastSellerAuthSessionSnapshot);
      }

      if (isSellerAuthSessionOnline(liveSnapshot)) {
        return {
          shopEntry,
          backgroundEntry,
          view,
          context,
          snapshot: buildBackgroundViewSnapshot(shopEntry, backgroundEntry),
          sessionContext: buildShopSessionContext(shopEntry, liveSnapshot),
          warmedUp: true
        };
      }

      recoverSellerCenterGlobalSessionInView(
        view,
        context,
        shopEntry,
        lastUrl,
        {
          trigger: 'global-category-sync-warmup',
          delayMs: 80,
          reason: 'global-category-sync-session-warmup',
          logEventName: 'shop_background_seller_center_global_session_relogin'
        }
      );

      await new Promise((resolve) => {
        setTimeout(resolve, pollIntervalMs);
      });
    }

    throw buildSellerCenterGlobalSessionError(
      '\u5df2\u5728\u540e\u53f0\u5c1d\u8bd5\u81ea\u52a8\u6062\u590d\u5356\u5bb6\u4e2d\u5fc3\u5168\u7403\u540e\u53f0\u767b\u5f55\uff0c\u4f46\u5728\u89c4\u5b9a\u65f6\u95f4\u5185\u4ecd\u672a\u786e\u8ba4\u4f1a\u8bdd\u5df2\u5c31\u7eea\u3002\u82e5\u5f53\u524d\u8d26\u53f7\u89e6\u53d1\u4e86\u9a8c\u8bc1\u7801\u3001\u6388\u6743\u786e\u8ba4\u6216\u9875\u9762\u62e6\u622a\uff0c\u8bf7\u6253\u5f00\u5bf9\u5e94\u5e97\u94fa\u7684\u5356\u5bb6\u4e2d\u5fc3\u7ee7\u7eed\u5904\u7406\u540e\u518d\u91cd\u8bd5\u3002',
        {
          shopId: normalizedShopId,
          currentUrl: lastUrl,
          phase: lastPhase,
          lastSiteMainStatus,
          lastSiteMainResult,
          lastAutofillStatus
        }
      );
  }

  async function ensureBackgroundProductPromotionMonitorSession(payload = {}) {
    const shopEntry = await resolveShopEntry({
      ...(payload || {}),
      shopId: normalizeText(payload && payload.shopId)
    });

    await ensureEnvironmentApplied(shopEntry);

    const backgroundEntry = ensureBackgroundViewEntry(
      shopEntry,
      'product-promotion',
      'promotion-monitor'
    );

    if (!backgroundEntry.view) {
      createTabView(
        shopEntry,
        'product-promotion',
        backgroundEntry,
        normalizeText(payload && payload.initialUrl) || backgroundEntry.meta.url
      );
    }

    const snapshot = buildBackgroundViewSnapshot(shopEntry, backgroundEntry);

    if (
      snapshot.isWorkspaceReady !== true
      && hasForegroundWorkspaceReadyTab(shopEntry, 'product-promotion')
      && isViewUsable(backgroundEntry.view)
    ) {
      loadInCurrentView(backgroundEntry.view, getWorkspaceUrl('product-promotion'));
      log('shop_background_product_promotion_follow_foreground_session', {
        shopId: normalizeText(shopEntry && shopEntry.shopId),
        browserTabId: normalizeText(backgroundEntry && backgroundEntry.meta && backgroundEntry.meta.id)
      });
    }

    return {
      shopEntry,
      backgroundEntry,
      view: backgroundEntry.view,
      context: backgroundEntry.context,
      snapshot: buildBackgroundViewSnapshot(shopEntry, backgroundEntry)
    };
  }

  async function ensureShopEnvironmentReady(payload = {}) {
    const shopEntry = await resolveShopEntry({
      ...(payload || {}),
      shopId: normalizeText(payload && payload.shopId)
    });

    await ensureEnvironmentApplied(shopEntry);

    return {
      shopEntry,
      shopId: normalizeText(shopEntry && shopEntry.shopId),
      partition: normalizeText(shopEntry && shopEntry.partition),
      proxyConfig:
        shopEntry
        && shopEntry.environment
        && shopEntry.environment.proxyConfig
        && typeof shopEntry.environment.proxyConfig === 'object'
          ? { ...shopEntry.environment.proxyConfig }
          : null
    };
  }

  async function beginBackgroundProductPromotionMonitorRelogin(payload = {}) {
    const sessionContext = await ensureBackgroundProductPromotionMonitorSession(payload);
    const { shopEntry, view, context } = sessionContext;
    const currentUrl = normalizeText(isViewUsable(view) ? view.webContents.getURL() : '');

    if (!currentUrl) {
      loadInCurrentView(view, getWorkspaceUrl('product-promotion'));
      return {
        ...sessionContext,
        started: true,
        reason: 'initial-load'
      };
    }

    return {
      ...sessionContext,
      started: beginProductPromotionRelogin(
        view,
        context,
        currentUrl,
        shopEntry && shopEntry.environment ? shopEntry.environment.authConfig : null,
        {
          reason: normalizeText(payload && payload.reason) || 'monitor-session-refresh',
          message: normalizeText(payload && payload.message)
            || '\u68C0\u6D4B\u5230\u540E\u53F0\u76D1\u63A7\u4F1A\u8BDD\u9700\u8981\u91CD\u767B\uFF0C\u6B63\u5728\u91CD\u65B0\u6062\u590D\u5546\u54C1\u63A8\u5E7F\u767B\u5F55\u3002',
          logEventName: 'shop_background_product_promotion_relogin'
        }
      )
    };
  }

  async function loadBackgroundProductPromotionMonitorHome(payload = {}) {
    const sessionContext = await ensureBackgroundProductPromotionMonitorSession(payload);

    loadInCurrentView(sessionContext.view, getWorkspaceUrl('product-promotion'));

    return sessionContext;
  }

  async function restartLoginFlow(payload = {}) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageType = normalizeText(payload && payload.pageType);
    const browserTabId =
      normalizeText(payload && payload.browserTabId) || DEFAULT_BROWSER_TAB_ID;

    if (!shopId) {
      throw new Error('\u5F53\u524D\u5E97\u94FA\u4FE1\u606F\u65E0\u6548\uFF0C\u8BF7\u5148\u91CD\u65B0\u9009\u62E9\u5E97\u94FA\u3002');
    }

    if (pageType !== 'seller-center' && pageType !== 'product-promotion') {
      throw new Error('\u5F53\u524D\u5165\u53E3\u4E0D\u652F\u6301\u91CD\u65B0\u767B\u5F55\u3002');
    }

    const shopEntry = await resolveShopEntry(payload);

    await ensureEnvironmentApplied(shopEntry);

    const pageEntry = ensurePageEntry(shopEntry, pageType);
    const tabEntry = ensureTabEntry(pageEntry, pageType, browserTabId);
    const context = {
      ...(tabEntry && tabEntry.context && typeof tabEntry.context === 'object' ? tabEntry.context : {}),
      shopId,
      pageType,
      browserTabId: normalizeText(tabEntry && tabEntry.meta && tabEntry.meta.id) || browserTabId
    };
    const sourceUrl = normalizeText(
      isViewUsable(tabEntry && tabEntry.view)
        ? tabEntry.view.webContents.getURL()
        : (tabEntry && tabEntry.meta && tabEntry.meta.url)
    ) || getWorkspaceUrl(pageType);
    const targetUrl = pageType === 'product-promotion'
      ? buildProductPromotionReloginUrl(sourceUrl)
      : buildSellerCenterReloginUrl(sourceUrl);

    if (!targetUrl) {
      throw new Error('\u767B\u5F55\u9875\u5730\u5740\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002');
    }

    tabEntry.context = context;

    const createdView = !tabEntry.view;

    if (createdView) {
      createTabView(shopEntry, pageType, tabEntry, targetUrl);
    }

    const view = tabEntry.view;

    if (!isViewUsable(view)) {
      throw new Error('\u5F53\u524D\u767B\u5F55\u7A97\u53E3\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002');
    }

    updateViewLoadStateContext(view, shopEntry, context);

    const state = syncAutomationState(view, normalizeText(view.webContents.getURL()));

    clearManualAutomationBlock(state);
    state.cooldownUntil = 0;
    state.lastAutofillStatus = '';
    state.authRedirectHistory = [];
    state.lastAuthenticationRedirectUrl = '';
    state.lastAuthenticationRedirectAt = 0;
    state.lastAuthenticationEntryAt = 0;
    state.lastAuthenticationEntryUrl = '';
    state.lastAuthenticationEntryStatus = '';
    state.authenticationEntryHoldUntil = 0;
    state.lastAuthenticationEntryFallbackAt = 0;
    state.lastAuthenticationEntryFallbackUrl = '';
    state.lastAuthenticationEntryNoNavigationAt = 0;
    state.lastAuthenticationEntryNoNavigationUrl = '';
    state.lastAuthenticationEntryNoNavigationCount = 0;
    state.siteMainPopupHoldUntil = 0;
    state.lastActivityLoginBridgeUrl = '';
    state.lastActivityLoginBridgeAt = 0;
    state.productPromotionBridgeRunning = false;
    state.lastProductPromotionBridgeToken = '';
    state.lastProductPromotionBridgeStatus = '';
    state.lastSessionProbeStatus = '';

    setAutomationPhase(context, state, LOGIN_AUTOMATION_PHASES.REDIRECTING_LOGIN, {
      now: Date.now(),
      reason: 'manual-restart-login',
      url: targetUrl,
      cooldownUntil: 0,
      lastAutofillStatus: ''
    });

    updateTabMeta(shopId, pageType, context.browserTabId, {
      url: targetUrl
    });

    if (!createdView) {
      loadInCurrentView(view, targetUrl);
    }

    markTabEntryUsed(shopId, pageType, context.browserTabId);
    notifyBrowserTabMessage(
      context,
      '\u6B63\u5728\u91CD\u65B0\u6253\u5F00\u767B\u5F55\u9875\u5E76\u91CD\u65B0\u8D70\u767B\u5F55\u6D41\u7A0B\u3002',
      {
        durationMs: 3600
      }
    );

    return {
      success: true,
      shopId,
      pageType,
      browserTabId: context.browserTabId,
      targetUrl,
      message: '\u767B\u5F55\u9875\u5DF2\u91CD\u65B0\u6253\u5F00\u3002'
    };
  }

  async function updateWorkspace(payload) {
    const currentToken = ++workspaceUpdateToken;

    if (!isWindowAlive()) {
      return;
    }

    const visible = payload && payload.visible === true;
    const overlayOpen = payload && payload.overlayOpen === true;
    const shopId = String((payload && payload.shopId) || '').trim();
    const pageType = String((payload && payload.pageType) || '').trim();
    const browserTabId =
      String((payload && payload.browserTabId) || DEFAULT_BROWSER_TAB_ID).trim() || DEFAULT_BROWSER_TAB_ID;
    const shopUpdatedAt = normalizeText(payload && payload.shopUpdatedAt);
    const workspaceEnvironmentKey = resolveWorkspaceEnvironmentKey(payload);
    const bounds = normalizeBounds(payload && payload.bounds);

    if (!visible || !shopId || !pageType || bounds.width < 10 || bounds.height < 10) {
      if (overlayOpen) {
        const activeView = getActiveView();

        if (isViewUsable(activeView)) {
          try {
            activeView.setVisible(false);
          } catch (_error) {
            // Ignore temporary hide failures while renderer overlays are open.
          }
        }

        return;
      }

      hideAndTrimLiveViewsExcept([]);
      activeDescriptor = null;
      return;
    }

    const targetDescriptor = {
      shopId,
      pageType,
      browserTabId
    };
    let view = null;
    const reusableTabEntry = getReusableActiveTabEntry(
      targetDescriptor,
      shopUpdatedAt,
      workspaceEnvironmentKey
    );

    if (reusableTabEntry) {
      const existingShopEntry = shopEntriesById.get(shopId);
      const existingPageEntry =
        existingShopEntry && existingShopEntry.pages
          ? existingShopEntry.pages.get(pageType)
          : null;

      if (existingPageEntry) {
        existingPageEntry.autoLoginEnabled = !(payload && payload.autoLoginEnabled === false);
      }

      view = reusableTabEntry.view;
    } else {
      const shopEntry = ensureShopEntry(payload);
      const pageEntry = ensurePageEntry(shopEntry, pageType);

      pageEntry.autoLoginEnabled = !(payload && payload.autoLoginEnabled === false);

      hideAndTrimLiveViewsExcept(collectWorkspacePreservedDescriptors(targetDescriptor));

      try {
        view = await ensureTabView(payload);
      } catch (error) {
        logError('shop_view_prepare_failed', error, {
        shopId,
        pageType,
        browserTabId,
        partition: normalizeText(shopEntry && shopEntry.partition)
      });
      notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_MESSAGE, {
        shopId,
        pageType,
        message: normalizeText(error && error.message) || '\u6d4f\u89c8\u5668\u4ee3\u7406\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u4ee3\u7406\u914d\u7f6e\u540e\u91cd\u8bd5\u3002'
      });
        return;
      }
    }

    if (currentToken !== workspaceUpdateToken || !isWindowAlive() || !isViewUsable(view)) {
      return;
    }

    const shouldLogActivation = !(
      activeDescriptor
      && isSameDescriptor(activeDescriptor, targetDescriptor)
      && areBoundsEqual(activeDescriptor.bounds, bounds)
      && normalizeText(activeDescriptor.shopUpdatedAt) === shopUpdatedAt
      && normalizeText(activeDescriptor.workspaceEnvironmentKey) === workspaceEnvironmentKey
    );

    try {
      const wasAttached = attachedViews.has(view);

      if (!wasAttached) {
        mainWindow.contentView.addChildView(view);
        attachedViews.add(view);
      }

      const shouldUpdateBounds = !wasAttached || !(
        activeDescriptor
        && isSameDescriptor(activeDescriptor, targetDescriptor)
        && areBoundsEqual(activeDescriptor.bounds, bounds)
      );

      if (shouldUpdateBounds) {
        view.setBounds(bounds);
      }

      view.setVisible(true);
    } catch (error) {
      logError('shop_view_show_failed', error, {
        shopId,
        pageType,
        browserTabId,
        bounds
      });
      return;
    }

    activeDescriptor = {
      ...targetDescriptor,
      bounds,
      shopUpdatedAt,
      workspaceEnvironmentKey
    };
    markTabEntryUsed(shopId, pageType, browserTabId);
    if (shouldLogActivation) {
      log('shop_view_activated', {
        shopId,
        pageType,
        browserTabId,
        bounds
      });
    }
  }

  async function closeBrowserTab(payload) {
    const shopId = String((payload && payload.shopId) || '').trim();
    const pageType = String((payload && payload.pageType) || '').trim();
    const browserTabId = String((payload && payload.browserTabId) || '').trim();
    const activateBrowserTabId = String((payload && payload.activateBrowserTabId) || '').trim();

    if (!shopId || !pageType || !browserTabId) {
      return;
    }

    const shopEntry = shopEntriesById.get(shopId);

    if (!shopEntry) {
      return;
    }

    const backgroundEntry = getBackgroundViewEntryByBrowserTabId(shopId, pageType, browserTabId);

    if (backgroundEntry) {
      destroyView(backgroundEntry.view);
      shopEntry.backgroundViews.delete(backgroundEntry.key);
      log('shop_background_browser_tab_closed', {
        shopId,
        pageType,
        browserTabId,
        activateBrowserTabId
      });
      return;
    }

    const pageEntry = shopEntry.pages.get(pageType);

    if (!pageEntry || !pageEntry.tabs.has(browserTabId)) {
      return;
    }

    const tabEntry = pageEntry.tabs.get(browserTabId);

    destroyView(tabEntry.view);
    pageEntry.tabs.delete(browserTabId);
    pageEntry.order = pageEntry.order.filter((item) => item !== browserTabId);
    notifyRenderer(SHOP_WINDOW_CHANNELS.BROWSER_TAB_CLOSED, {
      shopId,
      pageType,
      browserTabId,
      activateBrowserTabId
    });
    log('shop_browser_tab_closed', {
      shopId,
      pageType,
      browserTabId,
      activateBrowserTabId
    });

    if (activeDescriptor
      && activeDescriptor.shopId === shopId
      && activeDescriptor.pageType === pageType
      && activeDescriptor.browserTabId === browserTabId) {
      activeDescriptor = null;
    }

    if (pageEntry.order.length === 0) {
      const defaultTabMeta = buildTabMeta(pageType, DEFAULT_BROWSER_TAB_ID, 1, getWorkspaceUrl(pageType));

      pageEntry.tabs.set(defaultTabMeta.id, {
        meta: defaultTabMeta,
        view: null,
        popupOpener: null,
        lastUsedAt: 0
      });
      pageEntry.order = [defaultTabMeta.id];
      pageEntry.nextSequence = Math.max(pageEntry.nextSequence, 2);
    }
  }

  function destroy() {
    clearWorkspaceSyncTimer();
    if (isWindowAlive()) {
      mainWindow.removeListener('resize', handleMainWindowLayoutChange);
      mainWindow.removeListener('maximize', handleMainWindowLayoutChange);
      mainWindow.removeListener('unmaximize', handleMainWindowLayoutChange);
      mainWindow.removeListener('restore', handleMainWindowLayoutChange);
      mainWindow.removeListener('show', handleMainWindowLayoutChange);
      mainWindow.removeListener('enter-full-screen', handleMainWindowLayoutChange);
      mainWindow.removeListener('leave-full-screen', handleMainWindowLayoutChange);
    }
    destroyAllLiveViewsExcept([]);
    shopEntriesById.forEach((shopEntry) => {
      if (shopEntry.backgroundViews) {
        shopEntry.backgroundViews.forEach((backgroundEntry) => {
          destroyView(backgroundEntry.view);
          backgroundEntry.view = null;
        });
        shopEntry.backgroundViews.clear();
      }

      shopEntry.pages.forEach((pageEntry) => {
        pageEntry.tabs.forEach((tabEntry) => {
          destroyView(tabEntry.view);
          tabEntry.view = null;
        });
        pageEntry.tabs.clear();
        pageEntry.order = [];
      });
      shopEntry.pages.clear();
    });
    shopEntriesById.clear();
    activeDescriptor = null;
  }

  return {
    updateWorkspace,
    restartLoginFlow,
    closeBrowserTab,
    openBrowserUrlInNewTab,
    ensureShopEnvironmentReady,
    ensureBackgroundProductPromotionMonitorSession,
    beginBackgroundProductPromotionMonitorRelogin,
    loadBackgroundProductPromotionMonitorHome,
    reloadActiveContents() {
      const activeView = getActiveView();

      if (!isViewUsable(activeView)) {
        return false;
      }

      const currentUrl = normalizeText(activeView.webContents.getURL());

      if (isBrowserLoadErrorPageUrl(currentUrl)) {
        const state = getViewLoadState(activeView);
        const retryUrl = normalizeText(state.lastFailedUrl || state.lastRequestedUrl);

        if (canLoadInCurrentView(retryUrl)) {
          loadUrlIntoView(activeView, retryUrl, state.lastRequestedLoadOptions, {
            context: state.context,
            reason: 'manual-reload-error-page'
          });
          return true;
        }
      }

      reloadContents(activeView.webContents);
      return true;
    },
    async resolveShopSessionContext(payload = {}) {
      const shopEntry = await resolveShopEntry(payload);

      await ensureEnvironmentApplied(shopEntry);

      return buildShopSessionContext(shopEntry);
    },
    getCachedShopSessionContext(payload = {}) {
      const shopId = normalizeText(payload && payload.shopId);

      if (!shopId || !shopEntriesById.has(shopId)) {
        return null;
      }

      return buildShopSessionContext(shopEntriesById.get(shopId));
    },
    async findOnlineSellerSessionContext(payload = {}) {
      const contexts = await listOnlineSellerSessionContexts(payload);

      return contexts[0] || null;
    },
    async listOnlineSellerSessionContexts(payload = {}) {
      return listOnlineSellerSessionContexts(payload);
    },
    async ensureBackgroundSellerCenterGlobalSession(payload = {}) {
      return ensureBackgroundSellerCenterGlobalSession(payload);
    },
    async persistBrowserSessionNow(payload = {}) {
      const shopEntry = await resolveShopEntry(payload);

      await ensureEnvironmentApplied(shopEntry);

      return persistShopPartitionNow(shopEntry, {
        reason: normalizeText(payload && payload.reason),
        pageType: normalizeText(payload && payload.pageType),
        browserTabId: normalizeText(payload && payload.browserTabId)
      });
    },
    async persistAllBrowserSessionsNow(payload = {}) {
      const results = [];
      const progressCallback =
        payload && typeof payload.onProgress === 'function'
          ? payload.onProgress
          : null;
      const syncBrowserStorage = payload && payload.syncBrowserStorage === true;
      const persistableShopEntries = listPersistableShopEntries();
      const shopTotal = persistableShopEntries.length;
      let completedShopCount = 0;
      let failureCount = 0;

      const emitProgress = (progressPayload) => {
        if (!progressCallback) {
          return;
        }

        try {
          progressCallback({
            shopTotal,
            completedShopCount,
            failureCount,
            ...progressPayload
          });
        } catch (_error) {}
      };

      emitProgress({
        phase: 'start',
        progressValue: shopTotal > 0 ? 0 : 1
      });

      for (const shopEntry of persistableShopEntries) {
        try {
          if (shopEntry.environment && shopEntry.environmentSignature) {
            await ensureEnvironmentApplied(shopEntry);
          }

          const reason = normalizeText(payload && payload.reason) || 'persist-all-browser-sessions';
          const shopId = normalizeText(shopEntry && shopEntry.shopId);
          const shopName = getShopTargetName(shopEntry) || shopId;

          emitProgress({
            phase: 'persist-session',
            shopId,
            shopName,
            shopIndex: completedShopCount + 1,
            progressValue: shopTotal > 0 ? completedShopCount / shopTotal : 1
          });

          const persistResult = await persistShopPartitionNow(shopEntry, {
            reason
          });
          let syncResult = null;

          if (syncBrowserStorage === true) {
            try {
              emitProgress({
                phase: 'sync-browser-storage',
                shopId,
                shopName,
                shopIndex: completedShopCount + 1,
                progressValue: shopTotal > 0 ? (completedShopCount + 0.35) / shopTotal : 1
              });

              syncResult = await syncShopBrowserStorageSnapshotNow(shopEntry, {
                reason
              });
            } catch (error) {
              failureCount += 1;
              logError('shop_partition_sync_all_failed', error, {
                shopId,
                partition: normalizeText(shopEntry && shopEntry.partition),
                reason
              });
            }
          }

          completedShopCount += 1;
          emitProgress({
            phase: 'shop-finished',
            shopId,
            shopName,
            shopIndex: completedShopCount,
            progressValue: shopTotal > 0 ? completedShopCount / shopTotal : 1
          });

          results.push({
            ...persistResult,
            cloudSync: syncResult
          });
        } catch (error) {
          completedShopCount += 1;
          failureCount += 1;
          emitProgress({
            phase: 'shop-finished',
            shopId: normalizeText(shopEntry && shopEntry.shopId),
            shopName: getShopTargetName(shopEntry) || normalizeText(shopEntry && shopEntry.shopId),
            shopIndex: completedShopCount,
            progressValue: shopTotal > 0 ? completedShopCount / shopTotal : 1
          });
          logError('shop_partition_persist_all_failed', error, {
            shopId: normalizeText(shopEntry && shopEntry.shopId),
            partition: normalizeText(shopEntry && shopEntry.partition),
            reason: normalizeText(payload && payload.reason)
          });
        }
      }

      emitProgress({
        phase: 'done',
        progressValue: 1
      });

      return results;
    },
    openActiveDevTools() {
      const activeView = getActiveView();

      if (!isViewUsable(activeView)) {
        return false;
      }

      openDevTools(activeView.webContents);
      return true;
    },
    destroy,
    getActiveDescriptor() {
      return activeDescriptor ? { ...activeDescriptor } : null;
    }
  };
}

module.exports = {
  createShopWindowBrowserController
};
