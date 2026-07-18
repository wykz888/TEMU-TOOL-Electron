const fs = require('node:fs');
const path = require('node:path');
const { app, dialog, ipcMain, safeStorage, BrowserWindow, shell } = require('electron');
const { registerCreationCenterIpc } = require('./ipc/registerCreationCenterIpc');
const { registerAuthIpc } = require('./ipc/registerAuthIpc');
const { registerDialogIpc } = require('./ipc/registerDialogIpc');
const { registerFeatureCenterIpc } = require('./ipc/registerFeatureCenterIpc');
const { registerGlobalConfigIpc } = require('./ipc/registerGlobalConfigIpc');
const { registerUpdaterIpc } = require('./ipc/registerUpdaterIpc');
const { registerPodSuiteToolIpc } = require('./ipc/registerPodSuiteToolIpc');
const { registerShopManagementIpc } = require('./ipc/registerShopManagementIpc');
const { registerShopWindowIpc } = require('./ipc/registerShopWindowIpc');
const { createCreationCenterProfileService } = require('./services/creationCenter/creationCenterProfileService');
const { createFeatureCenterProfileService } = require('./services/featureCenter/featureCenterProfileService');
const { createGlobalConfigService } = require('./services/globalConfig/globalConfigService');
const { createGlobalAiTitleConfigAdapter } = require('./services/globalConfig/globalAiTitleConfigAdapter');
const { createAppUpdateService } = require('./services/update/updateService');
const { createPromotionAdsSessionService } = require('./services/featureCenter/promotionAdsSessionService');
const {
  createPromotionManagerNewGoodsService
} = require('./services/featureCenter/promotionManagerNewGoodsService');
const {
  createPromotionManagerNewSettingsService
} = require('./services/featureCenter/promotionManagerNewSettingsService');
const { createPromotionMonitorService } = require('./services/featureCenter/promotionMonitorService');
const { createPromotionManagerSettingsService } = require('./services/featureCenter/promotionManagerSettingsService');
const {
  createOperationsActivityBackgroundLogService
} = require('./services/featureCenter/operationsActivityBackgroundLogService');
const {
  createPodUploadSheetMiaoshouCategoryService
} = require('./services/featureCenter/podUploadSheetMiaoshouCategoryService');
const {
  createPodUploadSheetMiaoshouTemplateService
} = require('./services/featureCenter/podUploadSheetMiaoshouTemplateService');
const {
  createPodUploadSheetMiaoshouAiTitleConfigService
} = require('./services/featureCenter/podUploadSheetMiaoshouAiTitleConfigService');
const { createAuthSessionCache } = require('./state/authSessionCache');
const { createLoginAccountCache } = require('./state/loginAccountCache');
const { createSessionStore } = require('./state/sessionStore');
const { createAuthWindow } = require('./windows/createAuthWindow');
const { createMainWindow } = require('./windows/createMainWindow');
const {
  createPodUploadSheetMiaoshouWindow
} = require('./windows/createPodUploadSheetMiaoshouWindow');
const {
  createPodUploadSheetMiaoshouUniversalWindow
} = require('./windows/createPodUploadSheetMiaoshouUniversalWindow');
const { createPodSuiteToolWindow } = require('./windows/createPodSuiteToolWindow');
const {
  createGlobalCategorySyncWindow
} = require('./windows/createGlobalCategorySyncWindow');
const { createMarketingToolsWindow } = require('./windows/createMarketingToolsWindow');
const {
  createOperationsActivityManagementWindow
} = require('./windows/createOperationsActivityManagementWindow');
const {
  createOperationsNewProductLifecycleWindow
} = require('./windows/createOperationsNewProductLifecycleWindow');
const {
  createOperationsPriceDeclarationWindow
} = require('./windows/createOperationsPriceDeclarationWindow');
const {
  createOperationsTrafficBoostWindow
} = require('./windows/createOperationsTrafficBoostWindow');
const { createPromotionManagerWindow } = require('./windows/createPromotionManagerWindow');
const { createPromotionManagerNewWindow } = require('./windows/createPromotionManagerNewWindow');
const { createExitSyncProgressWindow } = require('./windows/createExitSyncProgressWindow');
const {
  installWebContentsDebugShortcuts,
  openDevTools,
  reloadContents
} = require('./windows/installWebContentsDebugShortcuts');
const { showConfirmDialog } = require('./windows/showConfirmDialog');
const { bindWindowCleanup } = require('./windows/windowUtils');
const { createRuntimeLogger } = require('./utils/runtimeLogger');
const { createLazyServiceProxy } = require('./utils/lazyService');
const {
  createThemePreferenceService,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_THEME,
  normalizeTheme,
  normalizeThemeAppearance
} = require('./services/theme/themePreferenceService');
const { FEATURE_CHANNELS } = require('./ipc/featureChannels');
const { EXIT_PROGRESS_CHANNELS } = require('./ipc/exitProgressChannels');
const { registerInvokeHandlers } = require('./ipc/ipcRegistration');
const { createProgressEmitter, extractRequesterKey } = require('./main/featureCenterHelpers');
const { THEME_CHANNELS } = require('./ipc/themeChannels');

if (process.env.TEMU_TOOLBOX_DISABLE_HW_ACCEL === '1') {
  app.disableHardwareAcceleration();
}

const hasSingleInstanceLock =
  app && typeof app.requestSingleInstanceLock === 'function'
    ? app.requestSingleInstanceLock()
    : true;

if (!hasSingleInstanceLock) {
  app.quit();
}

if (app.isPackaged !== true) {
  const devSessionDataPath = path.join(app.getPath('userData'), 'session_data_dev');
  const devDiskCachePath = path.join(devSessionDataPath, 'disk_cache');

  fs.mkdirSync(devSessionDataPath, { recursive: true });
  fs.mkdirSync(devDiskCachePath, { recursive: true });
  app.setPath('sessionData', devSessionDataPath);
  app.commandLine.appendSwitch('disk-cache-dir', devDiskCachePath);
}

app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');

const sessionStore = createSessionStore();
const loginAccountCache = createLoginAccountCache({ app, safeStorage });
const authSessionCache = createAuthSessionCache({ app });
const creationCenterProfileService = createCreationCenterProfileService({ app });
const featureCenterProfileService = createFeatureCenterProfileService({ app });
const globalConfigService = createGlobalConfigService({
  sessionStore,
  featureCenterProfileService
});
const runtimeLogger = createRuntimeLogger({ app });
const appUpdateService = createAppUpdateService({
  app,
  getUpdateSettings: () => globalConfigService.getUpdateSettings(),
  runtimeLogger
});
const promotionManagerSettingsService = createPromotionManagerSettingsService({
  sessionStore,
  featureCenterProfileService
});
const promotionManagerNewSettingsService = createPromotionManagerNewSettingsService({
  sessionStore,
  featureCenterProfileService
});
const operationsActivityBackgroundLogService = createOperationsActivityBackgroundLogService({
  app,
  runtimeLogger
});
const themePreferenceService = createThemePreferenceService({ app });

let authWindow = null;
let mainWindow = null;
let globalCategorySyncWindow = null;
let marketingToolsWindow = null;
const marketingToolsWindows = new Set();
let operationsActivityManagementWindow = null;
const operationsActivityManagementWindows = new Set();
let operationsTrafficBoostWindow = null;
const operationsTrafficBoostWindows = new Set();
let operationsPriceDeclarationWindow = null;
const operationsPriceDeclarationWindows = new Set();
let operationsNewProductLifecycleWindow = null;
const operationsNewProductLifecycleWindows = new Set();
let promotionManagerWindow = null;
let promotionManagerNewWindow = null;
let podUploadSheetMiaoshouWindow = null;
const podUploadSheetMiaoshouWindows = new Set();
let podUploadSheetMiaoshouUniversalWindow = null;
const podUploadSheetMiaoshouUniversalWindows = new Set();
let podSuiteToolWindow = null;
const podSuiteToolWindows = new Set();
let exitSyncProgressWindow = null;
let shopWindowBrowserController = null;
let shopWindowBrowserStorageSyncService = null;
let shopManagementService = null;
let promotionAdsSessionService = null;
let promotionManagerNewGoodsService = null;
let promotionMonitorService = null;
let operationsProductCategoryService = null;
let operationsSharedCostService = null;
let operationsShopSelectionService = null;
let operationsPriceDeclarationService = null;
let operationsTrafficBoostService = null;
let operationsNewProductLifecycleService = null;
let operationsActivityManagementService = null;
let marketingToolsSingleProductCouponService = null;
let podUploadSheetMiaoshouCategoryService = null;
let podUploadSheetMiaoshouTemplateService = null;
let podUploadSheetMiaoshouAiTitleConfigService = null;
let podUploadSheetMiaoshouFormTemplateService = null;
let podUploadSheetMiaoshouWorkspaceStateService = null;
let podUploadSheetMiaoshouExportService = null;
let podUploadSheetMiaoshouCosUploadService = null;
let podUploadSheetMiaoshouAiTitleService = null;
let podUploadSheetMiaoshouUniversalTemplateService = null;
let podUploadSheetMiaoshouUniversalFormTemplateService = null;
let podUploadSheetMiaoshouUniversalWorkspaceStateService = null;
let podUploadSheetMiaoshouUniversalExportService = null;
let podUploadSheetMiaoshouUniversalCosUploadService = null;
let podSuiteToolService = null;
let isAppQuitting = false;
let allowMainWindowClose = false;
let isMainWindowExitConfirming = false;
let lastNativeMainWindowCloseIntentAt = 0;
let currentTheme = DEFAULT_THEME;
let currentThemeAppearance = normalizeThemeAppearance({
  primaryColor: DEFAULT_PRIMARY_COLOR
});
let beforeQuitSessionPersistCompleted = false;
let beforeQuitSessionPersistPromise = null;

function createAppLazyService(serviceName, factory) {
  return createLazyServiceProxy(() => {
    const instance = factory();

    runtimeLogger.log('lazy_service_created', {
      serviceName
    });

    return instance;
  });
}

const WM_CLOSE = 0x0010;
const WM_SYSCOMMAND = 0x0112;
const SC_CLOSE = 0xF060;
const MAIN_WINDOW_CLOSE_INTENT_WINDOW_MS = 1500;

function getThemeBackgroundColor(theme) {
  return normalizeTheme(theme) === 'dark' ? '#0f172a' : '#ffffff';
}

function getOpenManagedSubWindows(windowSet) {
  const openWindows = [];

  windowSet.forEach((windowInstance) => {
    if (!windowInstance || windowInstance.isDestroyed()) {
      windowSet.delete(windowInstance);
      return;
    }

    openWindows.push(windowInstance);
  });

  return openWindows;
}

function resolvePrimaryManagedSubWindow(primaryWindow, windowSet, setPrimaryWindow) {
  if (primaryWindow && !primaryWindow.isDestroyed()) {
    if (!windowSet.has(primaryWindow)) {
      windowSet.add(primaryWindow);
    }

    return primaryWindow;
  }

  const openWindows = getOpenManagedSubWindows(windowSet);
  const fallbackWindow = openWindows.length ? openWindows[openWindows.length - 1] : null;

  if (typeof setPrimaryWindow === 'function') {
    setPrimaryWindow(fallbackWindow || null);
  }

  return fallbackWindow || null;
}

function closeManagedSubWindows(windowSet) {
  getOpenManagedSubWindows(windowSet).forEach((windowInstance) => {
    windowInstance.close();
  });
}

function bindManagedSubWindow(windowInstance, windowSet, getPrimaryWindow, setPrimaryWindow) {
  if (!windowInstance || windowInstance.isDestroyed()) {
    return windowInstance;
  }

  windowSet.add(windowInstance);
  setPrimaryWindow(windowInstance);
  windowInstance.on('focus', () => {
    windowSet.delete(windowInstance);
    windowSet.add(windowInstance);
    setPrimaryWindow(windowInstance);
  });

  return setupSubWindow(windowInstance, () => {
    windowSet.delete(windowInstance);

    if (getPrimaryWindow() === windowInstance) {
      setPrimaryWindow(null);
    }

    if (!getPrimaryWindow() || getPrimaryWindow().isDestroyed()) {
      const openWindows = getOpenManagedSubWindows(windowSet);
      const fallbackWindow = openWindows.length ? openWindows[openWindows.length - 1] : null;
      setPrimaryWindow(fallbackWindow || null);
    }
  });
}

function resolveFeatureSubWindowParentWindow(options = {}) {
  return options && options.parentWindow && !options.parentWindow.isDestroyed()
    ? options.parentWindow
    : mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : null;
}

function getWindowFromIpcEvent(event) {
  const sender = event && event.sender && !event.sender.isDestroyed()
    ? event.sender
    : null;

  return sender ? BrowserWindow.fromWebContents(sender) : null;
}

function mergeWindowOpenPayload(payload, context = {}) {
  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    parentWindow: getWindowFromIpcEvent(context && context.event)
  };
}

async function showManagedFeatureSubWindow(options = {}, config = {}) {
  if (!sessionStore.hasSession()) {
    return null;
  }

  const forceNewWindow = options && options.forceNewWindow === true;
  const promptForNewWindow = options && options.promptForNewWindow === true;
  const parentWindow = resolveFeatureSubWindowParentWindow(options);
  const existingWindow =
    config && typeof config.getPrimaryWindow === 'function'
      ? config.getPrimaryWindow()
      : null;

  if (existingWindow && !forceNewWindow) {
    if (promptForNewWindow) {
      const shouldOpenNewWindow = await showConfirmDialog({
        parentWindow,
        theme: currentTheme,
        appearance: currentThemeAppearance,
        title: String(config && config.openedTitle || '').trim(),
        badgeText: String(config && config.badgeText || '').trim(),
        message: String(config && config.openedMessage || '').trim(),
        confirmText: '\u65b0\u5f00\u7a97\u53e3',
        cancelText: '\u524d\u5f80\u5df2\u6253\u5f00\u7a97\u53e3'
      });

      if (shouldOpenNewWindow !== true) {
        return presentWindow(existingWindow);
      }
    } else {
      return presentWindow(existingWindow);
    }
  }

  return presentWindow(config.bindWindow(config.createWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme)
  })));
}

function broadcastToManagedSubWindows(windowSet, channel, payload, errorEventName) {
  getOpenManagedSubWindows(windowSet).forEach((windowInstance) => {
    if (!windowInstance.webContents || windowInstance.webContents.isDestroyed()) {
      return;
    }

    try {
      windowInstance.webContents.send(channel, payload);
    } catch (error) {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError(errorEventName, error);
      }
    }
  });
}

function getOpenWindows() {
  return [
    authWindow,
    mainWindow,
    globalCategorySyncWindow,
    ...getOpenManagedSubWindows(marketingToolsWindows),
    ...getOpenManagedSubWindows(operationsActivityManagementWindows),
    ...getOpenManagedSubWindows(operationsTrafficBoostWindows),
    ...getOpenManagedSubWindows(operationsPriceDeclarationWindows),
    ...getOpenManagedSubWindows(operationsNewProductLifecycleWindows),
    promotionManagerWindow,
    promotionManagerNewWindow,
    ...getOpenManagedSubWindows(podUploadSheetMiaoshouWindows),
    ...getOpenManagedSubWindows(podUploadSheetMiaoshouUniversalWindows),
    ...getOpenManagedSubWindows(podSuiteToolWindows)
  ].filter((windowInstance) => windowInstance && !windowInstance.isDestroyed());
}

function applyThemeToWindow(windowInstance, theme, appearance) {
  if (!windowInstance || windowInstance.isDestroyed()) {
    return;
  }

  const resolvedTheme = normalizeTheme(theme);
  const resolvedAppearance = normalizeThemeAppearance(appearance || currentThemeAppearance);
  windowInstance.setBackgroundColor(getThemeBackgroundColor(resolvedTheme));

  if (windowInstance.webContents && !windowInstance.webContents.isDestroyed()) {
    windowInstance.webContents.send(THEME_CHANNELS.CHANGED, {
      theme: resolvedTheme,
      appearance: resolvedAppearance
    });
  }
}

function broadcastTheme(theme, appearance) {
  currentTheme = normalizeTheme(theme);
  currentThemeAppearance = {
    ...(appearance && typeof appearance === 'object' ? appearance : currentThemeAppearance || null),
    ...normalizeThemeAppearance(appearance || currentThemeAppearance)
  };
  getOpenWindows().forEach((windowInstance) => {
    applyThemeToWindow(windowInstance, currentTheme, currentThemeAppearance);
  });
}

function setupSubWindow(win, onClosed) {
  applyThemeToWindow(win, currentTheme, currentThemeAppearance);
  installWebContentsDebugShortcuts(win);
  return bindWindowCleanup(win, onClosed);
}

async function showExitSyncProgressWindow(initialPayload = {}) {
  if (exitSyncProgressWindow && !exitSyncProgressWindow.isDestroyed()) {
    presentWindow(exitSyncProgressWindow);
    updateExitSyncProgress(initialPayload);
    return exitSyncProgressWindow;
  }

  exitSyncProgressWindow = await createExitSyncProgressWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme),
    theme: currentTheme
  });

  exitSyncProgressWindow.on('closed', () => {
    exitSyncProgressWindow = null;
  });

  presentWindow(exitSyncProgressWindow);
  updateExitSyncProgress(initialPayload);
  return exitSyncProgressWindow;
}

function closeExitSyncProgressWindow() {
  if (!exitSyncProgressWindow || exitSyncProgressWindow.isDestroyed()) {
    exitSyncProgressWindow = null;
    return;
  }

  exitSyncProgressWindow.close();
  exitSyncProgressWindow = null;
}

function updateExitSyncProgress(payload = {}) {
  if (
    !exitSyncProgressWindow
    || exitSyncProgressWindow.isDestroyed()
    || !exitSyncProgressWindow.webContents
    || exitSyncProgressWindow.webContents.isDestroyed()
  ) {
    return;
  }

  exitSyncProgressWindow.webContents.send(EXIT_PROGRESS_CHANNELS.UPDATE, {
    theme: currentTheme,
    ...payload
  });
}

function readWindowsMessageParam(bufferLike) {
  if (!bufferLike || typeof bufferLike.length !== 'number' || bufferLike.length === 0) {
    return 0;
  }

  try {
    if (bufferLike.length >= 4 && typeof bufferLike.readUInt32LE === 'function') {
      return bufferLike.readUInt32LE(0);
    }
  } catch (_error) {
    return 0;
  }

  return 0;
}

function markNativeMainWindowCloseIntent(reason) {
  lastNativeMainWindowCloseIntentAt = Date.now();
  runtimeLogger.log('main_window_native_close_intent', {
    reason,
    timestamp: lastNativeMainWindowCloseIntentAt
  });
}

function hasRecentNativeMainWindowCloseIntent() {
  return Date.now() - lastNativeMainWindowCloseIntentAt <= MAIN_WINDOW_CLOSE_INTENT_WINDOW_MS;
}

function presentWindow(windowInstance) {
  if (!windowInstance || windowInstance.isDestroyed()) {
    return null;
  }

  if (typeof windowInstance.setAlwaysOnTop === 'function') {
    try {
      windowInstance.setAlwaysOnTop(true, 'screen-saver');
    } catch (_error) {}
  }

  if (typeof windowInstance.isMinimized === 'function' && windowInstance.isMinimized()) {
    windowInstance.restore();
  }

  if (typeof windowInstance.show === 'function') {
    windowInstance.show();
  }

  if (typeof windowInstance.moveTop === 'function') {
    windowInstance.moveTop();
  }

  if (typeof windowInstance.focus === 'function') {
    windowInstance.focus();
  }

  if (typeof windowInstance.flashFrame === 'function') {
    try {
      windowInstance.flashFrame(true);
      setTimeout(() => {
        if (!windowInstance || windowInstance.isDestroyed()) {
          return;
        }

        try {
          windowInstance.flashFrame(false);
        } catch (_error) {}
      }, 1200);
    } catch (_error) {}
  }

  if (typeof windowInstance.setAlwaysOnTop === 'function') {
    setTimeout(() => {
      if (!windowInstance || windowInstance.isDestroyed()) {
        return;
      }

      try {
        windowInstance.setAlwaysOnTop(false);
      } catch (_error) {}
    }, 800);
  }

  return windowInstance;
}

function shouldConfirmMainWindowClose(windowInstance) {
  if (!windowInstance || windowInstance.isDestroyed()) {
    return false;
  }

  if (typeof windowInstance.isMinimized === 'function' && windowInstance.isMinimized()) {
    return false;
  }

  if (typeof windowInstance.isFocused === 'function' && !windowInstance.isFocused()) {
    return false;
  }

  if (process.platform === 'win32' && !hasRecentNativeMainWindowCloseIntent()) {
    return false;
  }

  return true;
}

async function confirmMainWindowExit() {
  if (!mainWindow || mainWindow.isDestroyed() || isMainWindowExitConfirming) {
    return false;
  }

  isMainWindowExitConfirming = true;

  try {
    return await showConfirmDialog({
      parentWindow: mainWindow,
      theme: currentTheme,
      appearance: currentThemeAppearance,
      tone: 'warning',
      title: '\u9000\u51fa\u786e\u8ba4',
      badgeText: '',
      message: '',
      detail: '',
      confirmText: '\u786e\u8ba4',
      cancelText: '\u53d6\u6d88'
    });
  } catch (error) {
    runtimeLogger.logError('main_window_close_confirm_failed', error);
    return false;
  } finally {
    isMainWindowExitConfirming = false;
  }
}

function bindAuthWindow(windowInstance) {
  authWindow = windowInstance;
  return setupSubWindow(windowInstance, () => {
    authWindow = null;

    if (!sessionStore.hasSession() && !mainWindow) {
      app.quit();
    }
  });
}

function bindMainWindow(windowInstance) {
  mainWindow = windowInstance;
  applyThemeToWindow(mainWindow, currentTheme);
  lastNativeMainWindowCloseIntentAt = 0;
  const { createShopWindowBrowserController } = require('./windows/shopWindowBrowserController');

  shopWindowBrowserController = createShopWindowBrowserController(mainWindow, {
    runtimeLogger,
    async loadShopRuntimeProfile(payload) {
      if (!shopManagementService || typeof shopManagementService.getShopRuntimeProfile !== 'function') {
        return null;
      }

      return shopManagementService.getShopRuntimeProfile(payload);
    },
    getBrowserStorageSyncService() {
      return shopWindowBrowserStorageSyncService;
    },
    async onPlatformShopIdResolved(payload) {
      if (
        !shopManagementService
        || typeof shopManagementService.updateResolvedPlatformShopId !== 'function'
      ) {
        return null;
      }

      return shopManagementService.updateResolvedPlatformShopId(payload);
    }
  });
  installWebContentsDebugShortcuts(mainWindow, {
    onReload(webContents) {
      if (shopWindowBrowserController && shopWindowBrowserController.reloadActiveContents()) {
        return;
      }

      reloadContents(webContents);
    },
    onOpenDevTools(webContents) {
      if (shopWindowBrowserController && shopWindowBrowserController.openActiveDevTools()) {
        return;
      }

      openDevTools(webContents);
    }
  });

  if (process.platform === 'win32' && typeof mainWindow.hookWindowMessage === 'function') {
    try {
      mainWindow.hookWindowMessage(WM_CLOSE, () => {
        markNativeMainWindowCloseIntent('wm-close');
      });
      mainWindow.hookWindowMessage(WM_SYSCOMMAND, (wParam) => {
        if ((readWindowsMessageParam(wParam) & 0xFFF0) === SC_CLOSE) {
          markNativeMainWindowCloseIntent('wm-syscommand-sc-close');
        }
      });
    } catch (error) {
      runtimeLogger.logError('main_window_hook_close_message_failed', error);
    }
  }

  mainWindow.on('close', (event) => {
    const hasSession = sessionStore.hasSession();
    const hasRecentNativeCloseIntent = hasRecentNativeMainWindowCloseIntent();

    runtimeLogger.log('main_window_close', {
      hasSession,
      isAppQuitting,
      allowMainWindowClose,
      hasRecentNativeCloseIntent
    });

    if (!isAppQuitting && !allowMainWindowClose && hasSession) {
      event.preventDefault();

      if (!shouldConfirmMainWindowClose(mainWindow)) {
        runtimeLogger.log('main_window_close_ignored', {
          reason: process.platform === 'win32' && !hasRecentNativeCloseIntent
            ? 'missing-native-close-intent'
            : 'window-not-focused-or-minimized'
        });
        return;
      }

      lastNativeMainWindowCloseIntentAt = 0;

      void confirmMainWindowExit().then((confirmed) => {
        runtimeLogger.log('main_window_close_confirmed', {
          confirmed
        });

        if (!confirmed) {
          return;
        }

        allowMainWindowClose = true;
        setImmediate(() => {
          runtimeLogger.log('main_window_close_forward_to_app_quit', {
            reason: 'user-confirmed-main-window-close'
          });
          app.quit();
        });
      });
      return;
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    runtimeLogger.log('main_window_render_process_gone', {
      details
    });

    if (isAppQuitting) {
      return;
    }

    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || isAppQuitting) {
        return;
      }

      runtimeLogger.log('main_window_render_process_reload_attempt', {
        reason: details && details.reason ? details.reason : ''
      });
      reloadContents(mainWindow.webContents);
    }, 1200);
  });

  mainWindow.webContents.on('unresponsive', () => {
    runtimeLogger.log('main_window_unresponsive');
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const normalizedMessage = String(message || '').trim();

    if (!normalizedMessage) {
      return;
    }

    runtimeLogger.log('main_window_renderer_console_message', {
      level,
      message: normalizedMessage,
      line,
      sourceId: String(sourceId || '').trim()
    });
  });

  mainWindow.on('closed', () => {
    runtimeLogger.log('main_window_closed');

    if (globalCategorySyncWindow && !globalCategorySyncWindow.isDestroyed()) {
      globalCategorySyncWindow.close();
    }

    closeManagedSubWindows(marketingToolsWindows);
    closeManagedSubWindows(operationsActivityManagementWindows);
    closeManagedSubWindows(operationsTrafficBoostWindows);
    closeManagedSubWindows(operationsPriceDeclarationWindows);
    closeManagedSubWindows(operationsNewProductLifecycleWindows);
    closeManagedSubWindows(podUploadSheetMiaoshouWindows);
    closeManagedSubWindows(podUploadSheetMiaoshouUniversalWindows);
    closeManagedSubWindows(podSuiteToolWindows);

    if (promotionManagerWindow && !promotionManagerWindow.isDestroyed()) {
      promotionManagerWindow.close();
    }

    if (promotionManagerNewWindow && !promotionManagerNewWindow.isDestroyed()) {
      promotionManagerNewWindow.close();
    }

    if (shopWindowBrowserController) {
      shopWindowBrowserController.destroy();
      shopWindowBrowserController = null;
    }

    closeExitSyncProgressWindow();

    mainWindow = null;
    allowMainWindowClose = false;
    isMainWindowExitConfirming = false;
    lastNativeMainWindowCloseIntentAt = 0;
  });

  return mainWindow;
}

function bindGlobalCategorySyncWindow(windowInstance) {
  globalCategorySyncWindow = windowInstance;
  return setupSubWindow(windowInstance, () => { globalCategorySyncWindow = null; });
}

function bindMarketingToolsWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    marketingToolsWindows,
    () => marketingToolsWindow,
    (nextWindow) => {
      marketingToolsWindow = nextWindow;
    }
  );
}

function bindOperationsActivityManagementWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    operationsActivityManagementWindows,
    () => operationsActivityManagementWindow,
    (nextWindow) => {
      operationsActivityManagementWindow = nextWindow;
    }
  );
}

function bindOperationsTrafficBoostWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    operationsTrafficBoostWindows,
    () => operationsTrafficBoostWindow,
    (nextWindow) => {
      operationsTrafficBoostWindow = nextWindow;
    }
  );
}

function bindOperationsPriceDeclarationWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    operationsPriceDeclarationWindows,
    () => operationsPriceDeclarationWindow,
    (nextWindow) => {
      operationsPriceDeclarationWindow = nextWindow;
    }
  );
}

function bindOperationsNewProductLifecycleWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    operationsNewProductLifecycleWindows,
    () => operationsNewProductLifecycleWindow,
    (nextWindow) => {
      operationsNewProductLifecycleWindow = nextWindow;
    }
  );
}

function bindPromotionManagerWindow(windowInstance) {
  promotionManagerWindow = windowInstance;
  return setupSubWindow(windowInstance, () => { promotionManagerWindow = null; });
}

function bindPromotionManagerNewWindow(windowInstance) {
  promotionManagerNewWindow = windowInstance;
  return setupSubWindow(windowInstance, () => { promotionManagerNewWindow = null; });
}

function bindPodUploadSheetMiaoshouWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    podUploadSheetMiaoshouWindows,
    () => podUploadSheetMiaoshouWindow,
    (nextWindow) => {
      podUploadSheetMiaoshouWindow = nextWindow;
    }
  );
}

function bindPodUploadSheetMiaoshouUniversalWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    podUploadSheetMiaoshouUniversalWindows,
    () => podUploadSheetMiaoshouUniversalWindow,
    (nextWindow) => {
      podUploadSheetMiaoshouUniversalWindow = nextWindow;
    }
  );
}

function bindPodSuiteToolWindow(windowInstance) {
  return bindManagedSubWindow(
    windowInstance,
    podSuiteToolWindows,
    () => podSuiteToolWindow,
    (nextWindow) => {
      podSuiteToolWindow = nextWindow;
    }
  );
}

const IMPORTABLE_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.heic',
  '.heif',
  '.svg'
]);

function normalizeDirectoryDialogPath(directoryPath) {
  const normalizedPath = String(directoryPath || '').trim();

  if (!normalizedPath) {
    return '';
  }

  try {
    const resolvedPath = path.resolve(normalizedPath);
    const stat = fs.statSync(resolvedPath);

    if (stat.isDirectory()) {
      return resolvedPath;
    }
  } catch (_error) {}

  try {
    const resolvedParentPath = path.resolve(path.dirname(normalizedPath));
    const stat = fs.statSync(resolvedParentPath);

    if (stat.isDirectory()) {
      return resolvedParentPath;
    }
  } catch (_error) {}

  return '';
}

async function collectImportableImageFiles(rootDirectoryPath, currentDirectoryPath = rootDirectoryPath, result = []) {
  const directoryEntries = await fs.promises.readdir(currentDirectoryPath, {
    withFileTypes: true
  });

  for (const entry of directoryEntries) {
    const absolutePath = path.join(currentDirectoryPath, entry.name);

    if (entry.isDirectory()) {
      await collectImportableImageFiles(rootDirectoryPath, absolutePath, result);
      continue;
    }

    if (!entry.isFile() || !IMPORTABLE_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const relativePath = path.relative(rootDirectoryPath, absolutePath).split(path.sep).join('/');

    result.push({
      name: entry.name,
      path: absolutePath,
      webkitRelativePath: `${path.basename(rootDirectoryPath)}/${relativePath}`
    });
  }

  return result;
}

async function selectPodUploadSheetMiaoshouImportDirectory(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const mode = String(payload && payload.mode || '').trim();
  const parentWindow = resolvePodUploadSheetParentWindow(context, mode);
  const result = await dialog.showOpenDialog(parentWindow, {
    title: '\u9009\u62e9\u672c\u5730\u5546\u54c1\u76ee\u5f55',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'dontAddToRecent'],
    buttonLabel: '\u4f7f\u7528\u6b64\u6587\u4ef6\u5939'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      directoryPath: '',
      files: []
    };
  }

  const selectedDirectoryPath = path.resolve(String(result.filePaths[0] || ''));
  const files = await collectImportableImageFiles(selectedDirectoryPath);

  return {
    canceled: false,
    directoryPath: selectedDirectoryPath,
    files: files.sort((left, right) => {
      return String(left.webkitRelativePath || '').localeCompare(String(right.webkitRelativePath || ''), 'zh-CN', {
        numeric: true,
        sensitivity: 'base'
      });
    })
  };
}

function resolvePodSuiteToolParentWindow(context = {}) {
  const senderWindow = getWindowFromIpcEvent(context && context.event);

  return senderWindow && !senderWindow.isDestroyed()
    ? senderWindow
    : getPrimaryPodSuiteToolWindow()
      ? getPrimaryPodSuiteToolWindow()
      : mainWindow && !mainWindow.isDestroyed()
        ? mainWindow
        : null;
}

function resolvePodUploadSheetParentWindow(context = {}, mode = '') {
  const senderWindow = getWindowFromIpcEvent(context && context.event);

  if (senderWindow && !senderWindow.isDestroyed()) {
    return senderWindow;
  }

  const podWindow = mode === 'universal'
    ? getPrimaryPodUploadSheetMiaoshouUniversalWindow()
    : getPrimaryPodUploadSheetMiaoshouWindow();

  return podWindow && !podWindow.isDestroyed()
    ? podWindow
    : mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : null;
}

async function selectPodSuiteToolWhiteMockupFile(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u767d\u819c\u56fe\u7247',
    defaultPath: defaultPath || undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [
      {
        name: '\u56fe\u7247',
        extensions: ['png', 'jpg', 'jpeg', 'webp']
      }
    ],
    buttonLabel: '\u4f7f\u7528\u6b64\u767d\u819c'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      filePath: ''
    };
  }

  const filePath = path.resolve(String(result.filePaths[0] || ''));

  return {
    canceled: false,
    filePath
  };
}

async function selectPodSuiteToolPsdMockupFile(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9PSD\u6837\u673a\u6587\u4ef6',
    defaultPath: defaultPath || undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [
      {
        name: 'PSD',
        extensions: ['psd', 'psb']
      }
    ],
    buttonLabel: '\u4f7f\u7528\u6b64PSD'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      filePath: ''
    };
  }

  const filePath = path.resolve(String(result.filePaths[0] || ''));

  return {
    canceled: false,
    filePath
  };
}

async function selectPodSuiteToolTextureImageFile(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u7eb9\u7406\u6216\u906e\u6321\u56fe',
    defaultPath: defaultPath || undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [
      {
        name: '\u56fe\u7247',
        extensions: ['png', 'jpg', 'jpeg', 'webp']
      }
    ],
    buttonLabel: '\u4f7f\u7528\u6b64\u56fe\u7247'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      filePath: ''
    };
  }

  const filePath = path.resolve(String(result.filePaths[0] || ''));

  return {
    canceled: false,
    filePath
  };
}

async function selectPodSuiteToolPreviewDesignFile(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u9884\u89c8\u7d20\u6750\u56fe',
    defaultPath: defaultPath || undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [
      {
        name: '\u56fe\u7247',
        extensions: ['png', 'jpg', 'jpeg', 'webp']
      }
    ],
    buttonLabel: '\u7528\u6765\u9884\u89c8'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      filePath: ''
    };
  }

  const filePath = path.resolve(String(result.filePaths[0] || ''));

  return {
    canceled: false,
    filePath
  };
}

async function selectPodSuiteToolMaskImageFile(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u5370\u82b1\u8499\u7248\u56fe',
    defaultPath: defaultPath || undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [
      {
        name: '\u56fe\u7247',
        extensions: ['png', 'jpg', 'jpeg', 'webp']
      }
    ],
    buttonLabel: '\u4f7f\u7528\u6b64\u8499\u7248'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      filePath: ''
    };
  }

  const filePath = path.resolve(String(result.filePaths[0] || ''));

  return {
    canceled: false,
    filePath
  };
}

async function selectPodSuiteToolImageDirectory(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u5f85\u5957\u56fe\u56fe\u7247\u76ee\u5f55',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'dontAddToRecent'],
    buttonLabel: '\u4f7f\u7528\u6b64\u6587\u4ef6\u5939'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      directoryPath: '',
      files: []
    };
  }

  const directoryPath = path.resolve(String(result.filePaths[0] || ''));
  const collectedResult = podSuiteToolService && typeof podSuiteToolService.collectImageFiles === 'function'
    ? await podSuiteToolService.collectImageFiles({
      directoryPath
    })
    : null;

  return {
    canceled: false,
    directoryPath,
    files: collectedResult && collectedResult.success === true && Array.isArray(collectedResult.files)
      ? collectedResult.files
      : []
  };
}

async function selectPodSuiteToolPsdImageDirectory(payload, context = {}) {
  return selectPodSuiteToolImageDirectory(payload, context);
}

async function selectPodSuiteToolOutputDirectory(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u5bfc\u51fa\u76ee\u5f55',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
    buttonLabel: '\u5bfc\u51fa\u5230\u6b64\u76ee\u5f55'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      directoryPath: ''
    };
  }

  return {
    canceled: false,
    directoryPath: path.resolve(String(result.filePaths[0] || ''))
  };
}

async function selectPodSuiteToolPsdOutputDirectory(payload, context = {}) {
  return selectPodSuiteToolOutputDirectory(payload, context);
}

async function selectPodSuiteToolPsdMetadataSourceFile(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u5143\u6570\u636e\u6765\u6e90\u56fe',
    defaultPath: defaultPath || undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [
      {
        name: '\u56fe\u7247',
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'heic', 'heif']
      }
    ],
    buttonLabel: '\u4f7f\u7528\u6b64\u539f\u56fe'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      filePath: ''
    };
  }

  const filePath = path.resolve(String(result.filePaths[0] || ''));

  return {
    canceled: false,
    filePath
  };
}

async function selectPodSuiteToolPsdMetadataSourceDirectory(payload, context = {}) {
  const defaultPath = normalizeDirectoryDialogPath(payload && payload.defaultPath);
  const result = await dialog.showOpenDialog(resolvePodSuiteToolParentWindow(context), {
    title: '\u9009\u62e9\u5143\u6570\u636e\u539f\u56fe\u76ee\u5f55',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'dontAddToRecent'],
    buttonLabel: '\u4f7f\u7528\u6b64\u6587\u4ef6\u5939'
  });

  if (!result || result.canceled === true || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return {
      canceled: true,
      directoryPath: '',
      files: []
    };
  }

  const directoryPath = path.resolve(String(result.filePaths[0] || ''));
  const collectedResult = podSuiteToolService && typeof podSuiteToolService.collectImageFiles === 'function'
    ? await podSuiteToolService.collectImageFiles({
      directoryPath
    })
    : null;

  return {
    canceled: false,
    directoryPath,
    files: collectedResult && collectedResult.success === true && Array.isArray(collectedResult.files)
      ? collectedResult.files
      : []
  };
}

async function openPodSuiteToolDirectory(payload) {
  const directoryPath = normalizeDirectoryDialogPath(payload && payload.directoryPath);

  if (!directoryPath) {
    return {
      success: false,
      updatedAt: new Date().toISOString(),
      message: '\u8bf7\u5148\u9009\u62e9\u76ee\u5f55\u3002'
    };
  }

  const errorMessage = await shell.openPath(directoryPath);

  return {
    success: !errorMessage,
    updatedAt: new Date().toISOString(),
    message: errorMessage || '\u76ee\u5f55\u5df2\u6253\u5f00\u3002'
  };
}

function showAuthWindow() {
  if (authWindow && !authWindow.isDestroyed()) {
    return presentWindow(authWindow);
  }

  return presentWindow(bindAuthWindow(createAuthWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme)
  })));
}

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return presentWindow(mainWindow);
  }

  return presentWindow(bindMainWindow(createMainWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme)
  })));
}

function showPromotionManagerWindow() {
  if (!sessionStore.hasSession()) {
    return null;
  }

  if (promotionManagerWindow && !promotionManagerWindow.isDestroyed()) {
    promotionManagerWindow.focus();
    return promotionManagerWindow;
  }

  return bindPromotionManagerWindow(createPromotionManagerWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme)
  }));
}

function showPromotionManagerNewWindow() {
  if (!sessionStore.hasSession()) {
    return null;
  }

  if (promotionManagerNewWindow && !promotionManagerNewWindow.isDestroyed()) {
    promotionManagerNewWindow.focus();
    return promotionManagerNewWindow;
  }

  return bindPromotionManagerNewWindow(createPromotionManagerNewWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme)
  }));
}

function showGlobalCategorySyncWindow() {
  if (!sessionStore.hasSession()) {
    return null;
  }

  if (globalCategorySyncWindow && !globalCategorySyncWindow.isDestroyed()) {
    globalCategorySyncWindow.focus();
    return globalCategorySyncWindow;
  }

  return bindGlobalCategorySyncWindow(createGlobalCategorySyncWindow({
    backgroundColor: getThemeBackgroundColor(currentTheme)
  }));
}

function getPrimaryMarketingToolsWindow() {
  marketingToolsWindow = resolvePrimaryManagedSubWindow(
    marketingToolsWindow,
    marketingToolsWindows,
    (nextWindow) => {
      marketingToolsWindow = nextWindow;
    }
  );
  return marketingToolsWindow;
}

function getPrimaryOperationsActivityManagementWindow() {
  operationsActivityManagementWindow = resolvePrimaryManagedSubWindow(
    operationsActivityManagementWindow,
    operationsActivityManagementWindows,
    (nextWindow) => {
      operationsActivityManagementWindow = nextWindow;
    }
  );
  return operationsActivityManagementWindow;
}

function getPrimaryOperationsTrafficBoostWindow() {
  operationsTrafficBoostWindow = resolvePrimaryManagedSubWindow(
    operationsTrafficBoostWindow,
    operationsTrafficBoostWindows,
    (nextWindow) => {
      operationsTrafficBoostWindow = nextWindow;
    }
  );
  return operationsTrafficBoostWindow;
}

function getPrimaryOperationsPriceDeclarationWindow() {
  operationsPriceDeclarationWindow = resolvePrimaryManagedSubWindow(
    operationsPriceDeclarationWindow,
    operationsPriceDeclarationWindows,
    (nextWindow) => {
      operationsPriceDeclarationWindow = nextWindow;
    }
  );
  return operationsPriceDeclarationWindow;
}

function getPrimaryOperationsNewProductLifecycleWindow() {
  operationsNewProductLifecycleWindow = resolvePrimaryManagedSubWindow(
    operationsNewProductLifecycleWindow,
    operationsNewProductLifecycleWindows,
    (nextWindow) => {
      operationsNewProductLifecycleWindow = nextWindow;
    }
  );
  return operationsNewProductLifecycleWindow;
}

function getPrimaryPodUploadSheetMiaoshouWindow() {
  podUploadSheetMiaoshouWindow = resolvePrimaryManagedSubWindow(
    podUploadSheetMiaoshouWindow,
    podUploadSheetMiaoshouWindows,
    (nextWindow) => {
      podUploadSheetMiaoshouWindow = nextWindow;
    }
  );
  return podUploadSheetMiaoshouWindow;
}

function getPrimaryPodUploadSheetMiaoshouUniversalWindow() {
  podUploadSheetMiaoshouUniversalWindow = resolvePrimaryManagedSubWindow(
    podUploadSheetMiaoshouUniversalWindow,
    podUploadSheetMiaoshouUniversalWindows,
    (nextWindow) => {
      podUploadSheetMiaoshouUniversalWindow = nextWindow;
    }
  );
  return podUploadSheetMiaoshouUniversalWindow;
}

function getPrimaryPodSuiteToolWindow() {
  podSuiteToolWindow = resolvePrimaryManagedSubWindow(
    podSuiteToolWindow,
    podSuiteToolWindows,
    (nextWindow) => {
      podSuiteToolWindow = nextWindow;
    }
  );
  return podSuiteToolWindow;
}

function showMarketingToolsWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryMarketingToolsWindow,
    bindWindow: bindMarketingToolsWindow,
    createWindow: createMarketingToolsWindow,
    openedTitle: '\u8425\u9500\u5de5\u5177\u5df2\u6253\u5f00',
    badgeText: '\u8425\u9500\u5de5\u5177',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00\u8425\u9500\u5de5\u5177\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showOperationsActivityManagementWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryOperationsActivityManagementWindow,
    bindWindow: bindOperationsActivityManagementWindow,
    createWindow: createOperationsActivityManagementWindow,
    openedTitle: '\u8425\u9500\u6d3b\u52a8\u5df2\u6253\u5f00',
    badgeText: '\u8425\u9500\u6d3b\u52a8',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00\u8425\u9500\u6d3b\u52a8\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showOperationsTrafficBoostWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryOperationsTrafficBoostWindow,
    bindWindow: bindOperationsTrafficBoostWindow,
    createWindow: createOperationsTrafficBoostWindow,
    openedTitle: '\u6d41\u91cf\u52a0\u901f\u5df2\u6253\u5f00',
    badgeText: '\u6d41\u91cf\u52a0\u901f',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00\u6d41\u91cf\u52a0\u901f\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showOperationsPriceDeclarationWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryOperationsPriceDeclarationWindow,
    bindWindow: bindOperationsPriceDeclarationWindow,
    createWindow: createOperationsPriceDeclarationWindow,
    openedTitle: '\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u5df2\u6253\u5f00',
    badgeText: '\u5546\u54c1\u4ef7\u683c\u7533\u62a5',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showOperationsNewProductLifecycleWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryOperationsNewProductLifecycleWindow,
    bindWindow: bindOperationsNewProductLifecycleWindow,
    createWindow: createOperationsNewProductLifecycleWindow,
    openedTitle: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406\u5df2\u6253\u5f00',
    badgeText: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showPodUploadSheetMiaoshouWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryPodUploadSheetMiaoshouWindow,
    bindWindow: bindPodUploadSheetMiaoshouWindow,
    createWindow: createPodUploadSheetMiaoshouWindow,
    openedTitle: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u5df2\u6253\u5f00',
    badgeText: 'POD\u5999\u624bTEMU\u7248',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showPodUploadSheetMiaoshouUniversalWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryPodUploadSheetMiaoshouUniversalWindow,
    bindWindow: bindPodUploadSheetMiaoshouUniversalWindow,
    createWindow: createPodUploadSheetMiaoshouUniversalWindow,
    openedTitle: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624b\u901a\u7528\u7248)\u5df2\u6253\u5f00',
    badgeText: 'POD\u5999\u624b\u901a\u7528\u7248',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00POD\u4e0a\u8d27\u8868\u683c(\u5999\u624b\u901a\u7528\u7248)\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function showPodSuiteToolWindow(options = {}) {
  return showManagedFeatureSubWindow(options, {
    getPrimaryWindow: getPrimaryPodSuiteToolWindow,
    bindWindow: bindPodSuiteToolWindow,
    createWindow: createPodSuiteToolWindow,
    openedTitle: 'PSD\u667a\u80fd\u5957\u56fe\u5df2\u6253\u5f00',
    badgeText: 'PSD\u667a\u80fd\u5957\u56fe',
    openedMessage: '\u5f53\u524d\u5df2\u6253\u5f00PSD\u667a\u80fd\u5957\u56fe\u7a97\u53e3\uff0c\u662f\u5426\u518d\u6253\u5f00\u4e00\u4e2a\u65b0\u7a97\u53e3\uff1f'
  });
}

function openAuthenticatedArea(session) {
  sessionStore.setSession(session);
  runtimeLogger.log('login_success', {
    username: session && session.username ? session.username : ''
  });
  appUpdateService.scheduleStartupUpdateCheck();
  showMainWindow();

  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }
}

function returnToAuthArea() {
  sessionStore.clearSession();
  runtimeLogger.log('logout');
  showAuthWindow();

  if (globalCategorySyncWindow && !globalCategorySyncWindow.isDestroyed()) {
    globalCategorySyncWindow.close();
  }

  closeManagedSubWindows(marketingToolsWindows);

  closeManagedSubWindows(operationsActivityManagementWindows);
  closeManagedSubWindows(operationsTrafficBoostWindows);
  closeManagedSubWindows(operationsPriceDeclarationWindows);
  closeManagedSubWindows(operationsNewProductLifecycleWindows);
  closeManagedSubWindows(podUploadSheetMiaoshouWindows);
  closeManagedSubWindows(podUploadSheetMiaoshouUniversalWindows);
  closeManagedSubWindows(podSuiteToolWindows);

  if (promotionManagerWindow && !promotionManagerWindow.isDestroyed()) {
    promotionManagerWindow.close();
  }

  if (promotionManagerNewWindow && !promotionManagerNewWindow.isDestroyed()) {
    promotionManagerNewWindow.close();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    allowMainWindowClose = true;
    mainWindow.close();
  }
}

app.whenReady().then(() => {
  runtimeLogger.log('app_ready', {
    logFilePath: runtimeLogger.getLogFilePath(),
    isPackaged: app.isPackaged === true,
    execPath: process.execPath,
    userDataPath: app.getPath('userData'),
    sessionDataPath: app.getPath('sessionData')
  });
  currentTheme = themePreferenceService.getTheme();
  currentThemeAppearance = themePreferenceService.getThemeAppearance();
  registerAuthIpc({
    sessionStore,
    loginAccountCache,
    authSessionCache,
    runtimeLogger,
    onLoginSuccess: openAuthenticatedArea,
    onLogout: returnToAuthArea
  });
  registerGlobalConfigIpc({
    globalConfigService
  });
  registerUpdaterIpc({
    updateService: appUpdateService
  });
  shopManagementService = registerShopManagementIpc({
    app,
    sessionStore,
    getShopWindowBrowserController: () => shopWindowBrowserController
  });
  shopWindowBrowserStorageSyncService = createAppLazyService('shop-window-browser-storage-sync', () => {
    const {
      createShopWindowBrowserStorageSyncService
    } = require('./services/shopWindow/browserStorageSyncService');

    return createShopWindowBrowserStorageSyncService({
      app,
      sessionStore,
      shopManagementService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      runtimeLogger
    });
  });
  promotionAdsSessionService = createPromotionAdsSessionService({
    sessionStore,
    shopManagementService,
    featureCenterProfileService,
    getShopWindowBrowserController: () => shopWindowBrowserController,
    runtimeLogger
  });
  promotionManagerNewGoodsService = createPromotionManagerNewGoodsService({
    shopManagementService,
    promotionAdsSessionService,
    runtimeLogger
  });
  operationsSharedCostService = createAppLazyService('operations-shared-cost', () => {
    const {
      createOperationsSharedCostService
    } = require('./services/featureCenter/operationsSharedCostService');

    return createOperationsSharedCostService({
      sessionStore,
      featureCenterProfileService,
      runtimeLogger
    });
  });
  operationsShopSelectionService = createAppLazyService('operations-shop-selection', () => {
    const {
      createOperationsShopSelectionService
    } = require('./services/featureCenter/operationsShopSelectionService');

    return createOperationsShopSelectionService({
      sessionStore,
      featureCenterProfileService,
      runtimeLogger
    });
  });
  operationsProductCategoryService = createAppLazyService('operations-product-category', () => {
    const {
      createOperationsProductCategoryService
    } = require('./services/featureCenter/operationsProductCategoryService');

    return createOperationsProductCategoryService({
      sessionStore,
      featureCenterProfileService,
      shopManagementService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      runtimeLogger
    });
  });
  operationsPriceDeclarationService = createAppLazyService('operations-price-declaration', () => {
    const {
      createOperationsPriceDeclarationService
    } = require('./services/featureCenter/operationsPriceDeclarationService');

    return createOperationsPriceDeclarationService({
      sessionStore,
      featureCenterProfileService,
      shopManagementService,
      operationsSharedCostService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      emitProgress(payload) {
        broadcastToManagedSubWindows(
          operationsPriceDeclarationWindows,
          FEATURE_CHANNELS.OPERATIONS_PRICE_DECLARATION_PROGRESS,
          payload,
          'operations_price_declaration_progress_send_failed'
        );
      },
      runtimeLogger
    });
  });
  operationsTrafficBoostService = createAppLazyService('operations-traffic-boost', () => {
    const {
      createOperationsTrafficBoostService
    } = require('./services/featureCenter/operationsTrafficBoostService');

    return createOperationsTrafficBoostService({
      sessionStore,
      featureCenterProfileService,
      shopManagementService,
      operationsSharedCostService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      emitProgress(payload) {
        broadcastToManagedSubWindows(
          operationsTrafficBoostWindows,
          FEATURE_CHANNELS.OPERATIONS_TRAFFIC_BOOST_PROGRESS,
          payload,
          'operations_traffic_boost_progress_send_failed'
        );
      },
      runtimeLogger
    });
  });
  operationsNewProductLifecycleService = createAppLazyService('operations-new-product-lifecycle', () => {
    const {
      createOperationsNewProductLifecycleService
    } = require('./services/featureCenter/operationsNewProductLifecycleService');

    return createOperationsNewProductLifecycleService({
      sessionStore,
      featureCenterProfileService,
      shopManagementService,
      operationsSharedCostService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      runtimeLogger
    });
  });
  operationsActivityManagementService = createAppLazyService('operations-activity-management', () => {
    const {
      createOperationsActivityManagementService
    } = require('./services/featureCenter/operationsActivityManagementService');

    return createOperationsActivityManagementService({
      sessionStore,
      featureCenterProfileService,
      shopManagementService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      runtimeLogger
    });
  });
  marketingToolsSingleProductCouponService = createAppLazyService('marketing-tools-single-product-coupon', () => {
    const {
      createMarketingToolsSingleProductCouponService
    } = require('./services/featureCenter/marketingToolsSingleProductCouponService');

    return createMarketingToolsSingleProductCouponService({
      sessionStore,
      featureCenterProfileService,
      shopManagementService,
      getShopWindowBrowserController: () => shopWindowBrowserController,
      runtimeLogger
    });
  });
  promotionMonitorService = createPromotionMonitorService({
    sessionStore,
    featureCenterProfileService,
    shopManagementService,
    promotionManagerSettingsService,
    promotionMasterSessionService: promotionAdsSessionService,
    runtimeLogger
  });
  podUploadSheetMiaoshouTemplateService = createPodUploadSheetMiaoshouTemplateService({
    sessionStore,
    featureCenterProfileService,
    runtimeLogger
  });
  podUploadSheetMiaoshouAiTitleConfigService = createAppLazyService('pod-upload-sheet-miaoshou-ai-title-config', () => {
    const legacyAiTitleConfigService = createPodUploadSheetMiaoshouAiTitleConfigService({
      sessionStore,
      featureCenterProfileService
    });

    return createGlobalAiTitleConfigAdapter({
      globalConfigService,
      legacyAiTitleConfigService
    });
  });
  podUploadSheetMiaoshouCategoryService = createPodUploadSheetMiaoshouCategoryService({
    runtimeLogger
  });
  podUploadSheetMiaoshouFormTemplateService = createAppLazyService('pod-upload-sheet-miaoshou-form-template', () => {
    const {
      createPodUploadSheetMiaoshouFormTemplateService
    } = require('./services/featureCenter/podUploadSheetMiaoshouFormTemplateService');

    return createPodUploadSheetMiaoshouFormTemplateService({
      sessionStore,
      featureCenterProfileService
    });
  });
  podUploadSheetMiaoshouWorkspaceStateService = createAppLazyService('pod-upload-sheet-miaoshou-workspace-state', () => {
    const {
      createPodUploadSheetMiaoshouWorkspaceStateService
    } = require('./services/featureCenter/podUploadSheetMiaoshouWorkspaceStateService');

    return createPodUploadSheetMiaoshouWorkspaceStateService({
      sessionStore,
      featureCenterProfileService
    });
  });
  podUploadSheetMiaoshouCosUploadService = createAppLazyService('pod-upload-sheet-miaoshou-cos-upload', () => {
    const {
      createPodUploadSheetMiaoshouCosUploadService
    } = require('./services/featureCenter/podUploadSheetMiaoshouCosUploadService');

    return createPodUploadSheetMiaoshouCosUploadService({
      sessionStore,
      featureCenterProfileService,
      globalConfigService,
      runtimeLogger
    });
  });
  podUploadSheetMiaoshouExportService = createAppLazyService('pod-upload-sheet-miaoshou-export', () => {
    const {
      createPodUploadSheetMiaoshouExportService
    } = require('./services/featureCenter/podUploadSheetMiaoshouExportService');

    return createPodUploadSheetMiaoshouExportService({
      app,
      dialog,
      runtimeLogger,
      templateService: podUploadSheetMiaoshouTemplateService,
      categoryService: podUploadSheetMiaoshouCategoryService,
      imageUploadService: podUploadSheetMiaoshouCosUploadService
    });
  });
  podUploadSheetMiaoshouAiTitleService = createAppLazyService('pod-upload-sheet-miaoshou-ai-title', () => {
    const {
      createPodUploadSheetMiaoshouAiTitleService
    } = require('./services/featureCenter/podUploadSheetMiaoshouAiTitleService');

    return createPodUploadSheetMiaoshouAiTitleService({
      sessionStore,
      featureCenterProfileService,
      aiTitleConfigService: podUploadSheetMiaoshouAiTitleConfigService,
      globalConfigService,
      runtimeLogger,
      emitProgress(payload) {
        [
          ...getOpenManagedSubWindows(podUploadSheetMiaoshouWindows),
          ...getOpenManagedSubWindows(podUploadSheetMiaoshouUniversalWindows)
        ].forEach((windowInstance) => {
          if (!windowInstance || windowInstance.isDestroyed()) {
            return;
          }

          try {
            windowInstance.webContents.send(
              FEATURE_CHANNELS.POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_PROGRESS,
              payload
            );
          } catch (error) {
            if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
              runtimeLogger.logError('pod_upload_sheet_ai_title_progress_send_failed', error);
            }
          }
        });
      }
    });
  });
  podUploadSheetMiaoshouUniversalTemplateService = createPodUploadSheetMiaoshouTemplateService({
    sessionStore,
    featureCenterProfileService,
    runtimeLogger,
    featureId: 'pod-upload-sheet-miaoshou-universal',
    templateDefinitions: [
      {
        id: 'universal',
        title: '\u5999\u624b\u901a\u7528\u7248\u6a21\u677f',
        fileName: '\u5bfc\u5165\u4ea7\u54c1\u6a21\u677f(\u5999\u624b\u901a\u7528\u7248).xlsx',
        url: 'https://chunagtao-1251234463.cos.ap-guangzhou.myqcloud.com/POD%E8%A1%A8%E6%A0%BC%E4%B8%8A%E8%B4%A7%E6%A8%A1%E6%9D%BF/%E5%AF%BC%E5%85%A5%E4%BA%A7%E5%93%81%E6%A8%A1%E6%9D%BF%28%E5%A6%99%E6%89%8B%E9%80%9A%E7%94%A8%E7%89%88%29.xlsx'
      }
    ],
    missingFeatureMessage: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624b\u901a\u7528\u7248) \u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u540c\u6b65\u6a21\u677f\u3002'
  });
  podUploadSheetMiaoshouUniversalFormTemplateService = createAppLazyService('pod-upload-sheet-miaoshou-universal-form-template', () => {
    const {
      createPodUploadSheetMiaoshouFormTemplateService
    } = require('./services/featureCenter/podUploadSheetMiaoshouFormTemplateService');

    return createPodUploadSheetMiaoshouFormTemplateService({
      sessionStore,
      featureCenterProfileService,
      entryId: 'pod-upload-sheet-miaoshou-universal-table',
      missingEntryMessage: '\u5999\u624b\u901a\u7528\u7248\u586b\u5199\u6a21\u677f\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u6a21\u677f\u914d\u7f6e\u3002',
      cloudRecordType: 'pod-upload-sheet-miaoshou-universal-form-templates',
      formTemplateFieldNames: [
        'sourceCategory',
        'customAttributes',
        'mainVideo',
        'certificate',
        'sizeChart',
        'description',
        'descriptionImageOrders',
        'aiTitlePrefix',
        'aiTitleSuffix',
        'aiTitleExtraPrompt',
        'aiTitleMaxLength',
        'aiTitleLanguage',
        'specValueOne',
        'specValueTwo'
      ],
      skuConfigFieldNames: [
        'declaredPrice',
        'skuImage',
        'platformSku',
        'stock',
        'skuWeightKg',
        'skuSize'
      ]
    });
  });
  podUploadSheetMiaoshouUniversalWorkspaceStateService = createAppLazyService('pod-upload-sheet-miaoshou-universal-workspace-state', () => {
    const {
      createPodUploadSheetMiaoshouWorkspaceStateService
    } = require('./services/featureCenter/podUploadSheetMiaoshouWorkspaceStateService');

    return createPodUploadSheetMiaoshouWorkspaceStateService({
      sessionStore,
      featureCenterProfileService,
      entryId: 'pod-upload-sheet-miaoshou-universal-table',
      missingEntryMessage: '\u5999\u624b\u901a\u7528\u7248\u672c\u5730\u5de5\u4f5c\u533a\u7f13\u5b58\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u672c\u5730\u7f13\u5b58\u3002'
    });
  });
  podUploadSheetMiaoshouUniversalCosUploadService = createAppLazyService('pod-upload-sheet-miaoshou-universal-cos-upload', () => {
    const {
      createPodUploadSheetMiaoshouCosUploadService
    } = require('./services/featureCenter/podUploadSheetMiaoshouCosUploadService');

    return createPodUploadSheetMiaoshouCosUploadService({
      sessionStore,
      featureCenterProfileService,
      globalConfigService,
      runtimeLogger,
      entryId: 'pod-upload-sheet-miaoshou-universal-table',
      missingEntryMessage: '\u5999\u624b\u901a\u7528\u7248\u56fe\u7247\u4e0a\u4f20\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u672c\u5730\u7f13\u5b58\u3002',
      resolveDescriptionReferences: false
    });
  });
  podUploadSheetMiaoshouUniversalExportService = createAppLazyService('pod-upload-sheet-miaoshou-universal-export', () => {
    const {
      createPodUploadSheetMiaoshouUniversalExportService
    } = require('./services/featureCenter/podUploadSheetMiaoshouUniversalExportService');

    return createPodUploadSheetMiaoshouUniversalExportService({
      app,
      dialog,
      runtimeLogger,
      templateService: podUploadSheetMiaoshouUniversalTemplateService,
      imageUploadService: podUploadSheetMiaoshouUniversalCosUploadService
    });
  });
  podSuiteToolService = createAppLazyService('pod-suite-tool', () => {
    const {
      createPodSuiteToolService
    } = require('./services/creationCenter/podSuiteToolService');
    const {
      createPodSuiteWhiteMockupTemplateStore
    } = require('./services/creationCenter/podSuiteWhiteMockupTemplateStore');
    const {
      createPodSuitePsdTemplateStore
    } = require('./services/creationCenter/podSuitePsdTemplateStore');
    const whiteMockupTemplateStore = createPodSuiteWhiteMockupTemplateStore({
      sessionStore,
      creationCenterProfileService
    });
    const psdTemplateStore = createPodSuitePsdTemplateStore({
      sessionStore,
      creationCenterProfileService,
      runtimeLogger
    });
    const podSuiteToolEntry = creationCenterProfileService.getEntryById('pod-suite-tool');
    const podSuiteToolTempRootDir = podSuiteToolEntry && podSuiteToolEntry.storageProfile
      ? path.join(podSuiteToolEntry.storageProfile.localCacheDir, 'photopea-temp')
      : '';

    return createPodSuiteToolService({
      runtimeLogger,
      whiteMockupTemplateStore,
      psdTemplateStore,
      tempRootDir: podSuiteToolTempRootDir
    });
  });
  void promotionMonitorService.init();
  void podUploadSheetMiaoshouTemplateService.init();
  void podUploadSheetMiaoshouUniversalTemplateService.init();
  registerFeatureCenterIpc({
    runtimeLogger,
    getFeatureCatalog: () => featureCenterProfileService.getCatalog(),
    onOpenOperationsActivityManagement: (payload, context = {}) => {
      return showOperationsActivityManagementWindow(mergeWindowOpenPayload(payload, context));
    },
    onOpenOperationsTrafficBoost: (payload, context = {}) => {
      return showOperationsTrafficBoostWindow(mergeWindowOpenPayload(payload, context));
    },
    onOpenOperationsPriceDeclaration: (payload, context = {}) => {
      return showOperationsPriceDeclarationWindow(mergeWindowOpenPayload(payload, context));
    },
    onOpenOperationsNewProductLifecycle: (payload, context = {}) => {
      return showOperationsNewProductLifecycleWindow(mergeWindowOpenPayload(payload, context));
    },
    onOpenMarketingTools: (payload, context = {}) => {
      return showMarketingToolsWindow(mergeWindowOpenPayload(payload, context));
    },
    queryMarketingToolsSingleProductCouponRows: (payload, context = {}) => (
      marketingToolsSingleProductCouponService
        ? marketingToolsSingleProductCouponService.queryRows(payload, {
          emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_PROGRESS, runtimeLogger),
          requesterKey: extractRequesterKey(context)
        })
        : {
          success: false,
          updatedAt: '',
          runId: String(payload && payload.runId || '').trim(),
          rows: [],
          rowCount: 0,
          rawRowCount: 0,
          filteredConfiguredCount: 0,
          totalShopCount: 0,
          completedShopCount: 0,
          failedShopCount: 0,
          canceledShopCount: 0,
          canceled: false,
          shopResults: [],
          warning: '\u5355\u54c1\u4f18\u60e0\u5238\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    cancelMarketingToolsSingleProductCouponQuery: (payload, context = {}) => (
      marketingToolsSingleProductCouponService
        ? marketingToolsSingleProductCouponService.cancelQuery(payload, {
          requesterKey: extractRequesterKey(context)
        })
        : {
          canceled: false,
          runId: String(payload && payload.runId || '').trim()
        }
    ),
    getMarketingToolsSingleProductCouponBatchCouponSettings: () => (
      marketingToolsSingleProductCouponService
        && typeof marketingToolsSingleProductCouponService.getBatchCouponSettings === 'function'
        ? marketingToolsSingleProductCouponService.getBatchCouponSettings()
        : {
          settings: {},
          source: 'default'
        }
    ),
    saveMarketingToolsSingleProductCouponBatchCouponSettings: (payload) => (
      marketingToolsSingleProductCouponService
        && typeof marketingToolsSingleProductCouponService.saveBatchCouponSettings === 'function'
        ? marketingToolsSingleProductCouponService.saveBatchCouponSettings(payload)
        : {
          settings: {},
          source: 'default',
          cloudSynced: false,
          warning: ''
        }
    ),
    createMarketingToolsSingleProductCouponBatchCoupons: (payload, context = {}) => (
      marketingToolsSingleProductCouponService
        && typeof marketingToolsSingleProductCouponService.createBatchCoupons === 'function'
        ? marketingToolsSingleProductCouponService.createBatchCoupons({
          ...(payload && typeof payload === 'object' ? payload : {}),
          emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.MARKETING_TOOLS_SINGLE_PRODUCT_COUPON_PROGRESS, runtimeLogger),
        })
        : {
          success: false,
          requestedRowCount: 0,
          preparedRowCount: 0,
          skippedRowCount: 0,
          skippedRows: [],
          chunkCount: 0,
          successCount: 0,
          failCount: 0,
          results: []
        }
    ),
    onOpenGlobalCategorySync: showGlobalCategorySyncWindow,
    onOpenPromotionManager: showPromotionManagerWindow,
    onOpenPromotionManagerNew: showPromotionManagerNewWindow,
    onOpenPodUploadSheetMiaoshou: (payload, context = {}) => {
      return showPodUploadSheetMiaoshouWindow(mergeWindowOpenPayload(payload, context));
    },
    onOpenPodUploadSheetMiaoshouUniversal: (payload, context = {}) => {
      return showPodUploadSheetMiaoshouUniversalWindow(mergeWindowOpenPayload(payload, context));
    },
    getOperationsProductCategorySnapshot: () => (
      operationsProductCategoryService
        ? operationsProductCategoryService.getRootCategorySnapshot()
        : {
          updatedAt: '',
          syncedAt: '',
          shopId: '',
          sourceOrigin: '',
          categories: [],
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    getOperationsProductGlobalCategorySyncSnapshot: () => (
      operationsProductCategoryService
        ? operationsProductCategoryService.getGlobalCategorySyncSnapshot()
        : {
          updatedAt: '',
          syncedAt: '',
          shopId: '',
          shopName: '',
          sourceOrigin: '',
          source: 'unavailable',
          cloudSynced: false,
          rootCount: 0,
          totalCount: 0,
          leafCount: 0,
          nonLeafCount: 0,
          maxLevel: 0,
          requestCount: 0,
          warning: ''
        }
    ),
    syncOperationsProductRootCategories: (payload) => (
      operationsProductCategoryService
        ? operationsProductCategoryService.syncRootCategories(payload)
        : {
          updatedAt: '',
          syncedAt: '',
          shopId: '',
          sourceOrigin: '',
          categories: [],
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    syncOperationsProductGlobalCategoryTreeFromOnlineShop: (payload) => (
      operationsProductCategoryService
        ? operationsProductCategoryService.syncGlobalCategoryTreeFromOnlineShop(payload)
        : {
          updatedAt: '',
          syncedAt: '',
          shopId: '',
          shopName: '',
          sourceOrigin: '',
          source: 'unavailable',
          cloudSynced: false,
          rootCount: 0,
          totalCount: 0,
          leafCount: 0,
          nonLeafCount: 0,
          maxLevel: 0,
          requestCount: 0,
          warning: ''
        }
    ),
    getOperationsProductChildCategories: (payload) => (
      operationsProductCategoryService
        ? operationsProductCategoryService.getChildCategories(payload)
        : {
          shopId: '',
          parentCatId: '',
          sourceOrigin: '',
          categories: [],
          fetchedAt: ''
        }
    ),
    searchOperationsProductCategories: (payload) => (
      operationsProductCategoryService
        ? operationsProductCategoryService.searchCategories(payload)
        : {
          keyword: '',
          total: 0,
          limit: 0,
          results: [],
          sourceOrigin: '',
          fetchedAt: '',
          source: 'unavailable'
        }
    ),
    getOperationsShopSelectionSnapshot: (payload) => (
      operationsShopSelectionService
        ? operationsShopSelectionService.getSnapshot(payload)
        : {
          snapshot: {
            version: 1,
            owner: null,
            updatedAt: '',
            scopeKey: String(payload && payload.scopeKey || '').trim(),
            templates: [],
            lastSelection: {
              scopeKey: String(payload && payload.scopeKey || '').trim(),
              selectedShopIds: [],
              updatedAt: ''
            }
          },
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    queryOperationsActivityManagementActivities: (payload) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.queryActivityListByShops(payload)
        : {
          success: false,
          updatedAt: '',
          totalShopCount: 0,
          successShopCount: 0,
          failedShopCount: 0,
          rawActivityCount: 0,
          uniqueActivityCount: 0,
          rows: [],
          shopResults: [],
          themeTypeMapping: [],
          warning: '\u6d3b\u52a8\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    queryOperationsActivityManagementMatchProducts: (payload) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.queryActivityMatchProducts(payload)
        : {
          success: false,
          updatedAt: '',
          cacheKey: '',
          activityKey: '',
          activityType: null,
          activityThematicId: '',
          totalShopCount: 0,
          successShopCount: 0,
          failedShopCount: 0,
          rawProductCount: 0,
          uniqueProductCount: 0,
          cachedRowCount: 0,
          stillCount: 0,
          hasMore: false,
          searchScrollContext: '',
          pageIndex: 1,
          pageSize: 80,
          pageCount: 1,
          rows: [],
          shopResults: [],
          warning: '\u6d3b\u52a8\u5546\u54c1\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    getOperationsActivityManagementMatchProductsPage: (payload) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.getActivityMatchProductsPage(payload)
        : {
          success: false,
          updatedAt: '',
          cacheKey: '',
          activityKey: '',
          activityType: null,
          activityThematicId: '',
          totalShopCount: 0,
          successShopCount: 0,
          failedShopCount: 0,
          rawProductCount: 0,
          uniqueProductCount: 0,
          cachedRowCount: 0,
          stillCount: 0,
          hasMore: false,
          searchScrollContext: '',
          pageIndex: 1,
          pageSize: 80,
          pageCount: 1,
          rows: [],
          shopResults: [],
          warning: '\u6d3b\u52a8\u5546\u54c1\u5206\u9875\u7f13\u5b58\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    queryOperationsActivityManagementMatchProductsBatch: (payload, options) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.queryActivityMatchProductsBatch(payload, options)
        : {
          success: false,
          updatedAt: '',
          cacheKey: '',
          totalShopCount: 0,
          totalActivityCount: 0,
          successActivityCount: 0,
          failedActivityCount: 0,
          uniqueProductCount: 0,
          cachedRowCount: 0,
          pageIndex: 1,
          pageSize: 80,
          pageCount: 1,
          rows: [],
          activityResults: [],
          warning: '\u6d3b\u52a8\u5546\u54c1\u6279\u91cf\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    cancelOperationsActivityManagementMatchProductsBatchQuery: (payload) => (
      operationsActivityManagementService
        && typeof operationsActivityManagementService.cancelActivityMatchProductsBatchQuery === 'function'
        ? operationsActivityManagementService.cancelActivityMatchProductsBatchQuery(payload)
        : {
          canceled: false,
          requestId: String(payload && payload.requestId || '').trim()
        }
    ),
    cancelOperationsActivityManagementMatchProductsBatchSubmit: (payload) => (
      operationsActivityManagementService
        && typeof operationsActivityManagementService.cancelActivityMatchProductsBatchSubmit === 'function'
        ? operationsActivityManagementService.cancelActivityMatchProductsBatchSubmit(payload)
        : {
          canceled: false,
          requestId: String(payload && payload.requestId || '').trim()
        }
    ),
    getOperationsActivityManagementMatchProductsBatchPage: (payload) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.getActivityMatchProductsBatchPage(payload)
        : {
          success: false,
          updatedAt: '',
          cacheKey: '',
          totalShopCount: 0,
          totalActivityCount: 0,
          successActivityCount: 0,
          failedActivityCount: 0,
          uniqueProductCount: 0,
          cachedRowCount: 0,
          pageIndex: 1,
          pageSize: 80,
          pageCount: 1,
          rows: [],
          activityResults: [],
          warning: '\u6d3b\u52a8\u5546\u54c1\u6279\u91cf\u5206\u9875\u7f13\u5b58\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    submitOperationsActivityManagementMatchProductsBatch: (payload, options = {}) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.submitActivityMatchProductsBatch(payload, options)
        : {
          success: false,
          canceled: false,
          updatedAt: '',
          batchSize: 100,
          totalInputRowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
          submittedRowCount: 0,
          skippedRowCount: 0,
          successRowCount: 0,
          failedRowCount: 0,
          totalShopCount: 0,
          totalGroupCount: 0,
          totalRequestCount: 0,
          completedRequestCount: 0,
          failedRequestCount: 0,
          rowResults: [],
          skippedRows: [],
          warning: '\u6d3b\u52a8\u5546\u54c1\u6279\u91cf\u62a5\u540d\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    startOperationsActivityManagementBackgroundLogSession: (payload) => (
      operationsActivityBackgroundLogService
        ? operationsActivityBackgroundLogService.startSession(payload)
        : {
          success: false,
          sessionId: String(payload && payload.sessionId || '').trim(),
          runId: Number(payload && payload.runId) || 0,
          startedAt: '',
          finishedAt: '',
          directoryPath: '',
          fileName: '',
          filePath: '',
          rowCount: 0,
          appendedCount: 0,
          warning: '\u540e\u53f0\u62a5\u540d\u65e5\u5fd7\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    appendOperationsActivityManagementBackgroundLogRows: (payload) => (
      operationsActivityBackgroundLogService
        ? operationsActivityBackgroundLogService.appendRows(payload)
        : {
          success: false,
          sessionId: String(payload && payload.sessionId || '').trim(),
          runId: Number(payload && payload.runId) || 0,
          startedAt: '',
          finishedAt: '',
          directoryPath: '',
          fileName: '',
          filePath: '',
          rowCount: 0,
          appendedCount: 0,
          warning: '\u540e\u53f0\u62a5\u540d\u65e5\u5fd7\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    finishOperationsActivityManagementBackgroundLogSession: (payload) => (
      operationsActivityBackgroundLogService
        ? operationsActivityBackgroundLogService.finishSession(payload)
        : {
          success: false,
          sessionId: String(payload && payload.sessionId || '').trim(),
          runId: Number(payload && payload.runId) || 0,
          startedAt: '',
          finishedAt: '',
          directoryPath: '',
          fileName: '',
          filePath: '',
          rowCount: 0,
          appendedCount: 0,
          warning: '\u540e\u53f0\u62a5\u540d\u65e5\u5fd7\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    getOperationsActivityManagementFilterSettings: () => (
      operationsActivityManagementService
        ? operationsActivityManagementService.getFilterSettings()
        : {
          settings: {
            version: 1,
            updatedAt: '',
            minDiscountRate: '',
            maxActivityRemainingDays: '',
            activityThemeTypes: []
          },
          source: 'default',
          warning: ''
        }
    ),
    saveOperationsActivityManagementFilterSettings: (payload) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.saveFilterSettings(payload)
        : {
          settings: {
            version: 1,
            updatedAt: '',
            minDiscountRate: '',
            maxActivityRemainingDays: '',
            activityThemeTypes: []
          },
          source: 'default',
          localSaved: false,
          cloudSynced: false,
          warning: '\u6d3b\u52a8\u7b5b\u9009\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    getOperationsActivityManagementProductFilterSettings: () => (
      operationsActivityManagementService
        ? operationsActivityManagementService.getProductFilterSettings()
        : {
          settings: {
            version: 1,
            updatedAt: '',
            mode: 'suggestActivityPrice',
            modeValueDailyDiscount: '',
            modeValueProfitRateDiscount: '',
            modeValueDailyReduce: '',
            profitFloorRate: ''
          },
          source: 'default',
          warning: ''
        }
    ),
    saveOperationsActivityManagementProductFilterSettings: (payload) => (
      operationsActivityManagementService
        ? operationsActivityManagementService.saveProductFilterSettings(payload)
        : {
          settings: {
            version: 1,
            updatedAt: '',
            mode: 'suggestActivityPrice',
            modeValueDailyDiscount: '',
            modeValueProfitRateDiscount: '',
            modeValueDailyReduce: '',
            profitFloorRate: ''
          },
          source: 'default',
          localSaved: false,
          cloudSynced: false,
          warning: '\u6d3b\u52a8\u5546\u54c1\u7b5b\u9009\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    saveOperationsShopSelectionLast: (payload) => (
      operationsShopSelectionService
        ? operationsShopSelectionService.saveLastSelection(payload)
        : {
          snapshot: {
            version: 1,
            owner: null,
            updatedAt: '',
            scopeKey: String(payload && payload.scopeKey || '').trim(),
            templates: [],
            lastSelection: {
              scopeKey: String(payload && payload.scopeKey || '').trim(),
              selectedShopIds: [],
              updatedAt: ''
            }
          },
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    saveOperationsShopSelectionTemplate: (payload) => (
      operationsShopSelectionService
        ? operationsShopSelectionService.saveTemplate(payload)
        : {
          snapshot: {
            version: 1,
            owner: null,
            updatedAt: '',
            scopeKey: String(payload && payload.scopeKey || '').trim(),
            templates: [],
            lastSelection: {
              scopeKey: String(payload && payload.scopeKey || '').trim(),
              selectedShopIds: [],
              updatedAt: ''
            }
          },
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    deleteOperationsShopSelectionTemplate: (payload) => (
      operationsShopSelectionService
        ? operationsShopSelectionService.deleteTemplate(payload)
        : {
          snapshot: {
            version: 1,
            owner: null,
            updatedAt: '',
            scopeKey: String(payload && payload.scopeKey || '').trim(),
            templates: [],
            lastSelection: {
              scopeKey: String(payload && payload.scopeKey || '').trim(),
              selectedShopIds: [],
              updatedAt: ''
            }
          },
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    getOperationsSharedCostSnapshot: (payload) => (
      operationsSharedCostService
        && typeof operationsSharedCostService.getCostSnapshot === 'function'
        ? operationsSharedCostService.getCostSnapshot(payload)
        : {
          updatedAt: '',
          source: 'unavailable',
          shopIds: [],
          entryCount: 0,
          entries: []
        }
    ),
    saveOperationsSharedCostBatch: (payload) => (
      operationsSharedCostService
        && typeof operationsSharedCostService.saveCostEntries === 'function'
        ? operationsSharedCostService.saveCostEntries(payload)
        : {
          updatedAt: '',
          updatedEntryCount: 0,
          updatedShopCount: 0,
          cloudSynced: false,
          warning: ''
        }
    ),
    queryOperationsTrafficBoostRows: (payload, context = {}) => (
      operationsTrafficBoostService
        ? operationsTrafficBoostService.queryRows(payload, {
          emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.OPERATIONS_TRAFFIC_BOOST_PROGRESS, runtimeLogger),
          requesterKey: extractRequesterKey(context)
        })
        : {
          updatedAt: '',
          runId: String(payload && payload.runId || '').trim(),
          rows: [],
          rowCount: 0,
          total: 0,
          totalShops: 0,
          completedShops: 0,
          failedShops: 0,
          canceledShops: 0,
          canceled: false,
          warning: '\u6d41\u91cf\u52a0\u901f\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    submitOperationsTrafficBoostProducts: (payload, context = {}) => (
      operationsTrafficBoostService
        && typeof operationsTrafficBoostService.submitEnableBatch === 'function'
        ? operationsTrafficBoostService.submitEnableBatch(payload, {
          emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.OPERATIONS_TRAFFIC_BOOST_PROGRESS, runtimeLogger),
          requesterKey: extractRequesterKey(context)
        })
        : {
          success: false,
          updatedAt: '',
          requestId: String(payload && payload.requestId || '').trim(),
          totalShopCount: 0,
          completedShopCount: 0,
          failedShopCount: 0,
          totalProductCount: 0,
          successProductCount: 0,
          failedProductCount: 0,
          shopResults: [],
          failProducts: [],
          warning: '\u6d41\u91cf\u52a0\u901f\u63d0\u4ea4\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    cancelOperationsTrafficBoostSubmit: (payload, context = {}) => (
      operationsTrafficBoostService
        && typeof operationsTrafficBoostService.cancelSubmitJob === 'function'
        ? operationsTrafficBoostService.cancelSubmitJob(payload, {
          requesterKey: extractRequesterKey(context)
        })
        : {
          canceled: false,
          requestId: String(payload && payload.requestId || '').trim()
        }
    ),
    cancelOperationsTrafficBoostQuery: (payload, context = {}) => (
      operationsTrafficBoostService
        ? operationsTrafficBoostService.cancelQueryJob(payload, {
          requesterKey: extractRequesterKey(context)
        })
        : {
          canceled: false,
          runId: String(payload && payload.runId || '').trim()
        }
    ),
    getOperationsTrafficBoostProgressSnapshot: (payload) => (
      operationsTrafficBoostService
        ? operationsTrafficBoostService.getQueryProgressSnapshot(payload)
        : {
          progress: null,
          source: 'unavailable',
          updatedAt: ''
        }
    ),
    getOperationsTrafficBoostCustomLevelFilterSettings: () => (
      operationsTrafficBoostService
        && typeof operationsTrafficBoostService.getCustomLevelFilterSettings === 'function'
        ? operationsTrafficBoostService.getCustomLevelFilterSettings()
        : {
          settings: {
            version: 1,
            updatedAt: '',
            mode: 'suggestActivityPrice',
            modeValueDailyDiscount: '',
            modeValueSaleProfitRate: '',
            modeValueProfitRateDiscount: '',
            modeValueDailyReduce: '',
            modeValueCostMarkup: '',
            modeValue: '',
            clampToSuggestPrice: false,
            profitFloorRate: '',
            profitFloorRelation: 'and',
            profitFloorValue: '',
            submitAtProfitFloor: false,
            submitAtProfitFloorBasis: 'profitFloorRate'
          },
          source: 'default',
          warning: ''
        }
    ),
    saveOperationsTrafficBoostCustomLevelFilterSettings: (payload) => (
      operationsTrafficBoostService
        && typeof operationsTrafficBoostService.saveCustomLevelFilterSettings === 'function'
        ? operationsTrafficBoostService.saveCustomLevelFilterSettings(payload)
        : {
          settings: {
            version: 1,
            updatedAt: '',
            mode: 'suggestActivityPrice',
            modeValueDailyDiscount: '',
            modeValueSaleProfitRate: '',
            modeValueProfitRateDiscount: '',
            modeValueDailyReduce: '',
            modeValueCostMarkup: '',
            modeValue: '',
            clampToSuggestPrice: false,
            profitFloorRate: '',
            profitFloorRelation: 'and',
            profitFloorValue: '',
            submitAtProfitFloor: false,
            submitAtProfitFloorBasis: 'profitFloorRate'
          },
          source: 'default',
          localSaved: false,
          cloudSynced: false,
          warning: ''
        }
    ),
    queryOperationsNewProductLifecycleRows: (payload, context = {}) => (
      operationsNewProductLifecycleService
        ? operationsNewProductLifecycleService.queryRows(payload, {
          emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.OPERATIONS_NEW_PRODUCT_LIFECYCLE_PROGRESS, runtimeLogger),
          requesterKey: extractRequesterKey(context)
        })
        : {
          updatedAt: '',
          runId: String(payload && payload.runId || '').trim(),
          rowCount: 0,
          productCount: 0,
          total: 0,
          totalShops: 0,
          completedShops: 0,
          failedShops: 0,
          canceledShops: 0,
          canceled: false,
          rows: [],
          requestPreviewByShop: [],
          warning: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    cancelOperationsNewProductLifecycleQuery: (payload) => (
      operationsNewProductLifecycleService
        ? operationsNewProductLifecycleService.cancelQueryJob(payload)
        : {
          canceled: false,
          runId: String(payload && payload.runId || '').trim()
        }
    ),
    getOperationsNewProductLifecycleQuerySettings: () => (
      operationsNewProductLifecycleService
        ? operationsNewProductLifecycleService.getQuerySettings()
        : {
          settings: {
            version: 1,
            owner: null,
            updatedAt: '',
            pageDelayMinSeconds: '',
            pageDelayMaxSeconds: ''
          },
          source: 'unavailable',
          warning: ''
        }
    ),
    saveOperationsNewProductLifecycleQuerySettings: (payload) => (
      operationsNewProductLifecycleService
        ? operationsNewProductLifecycleService.saveQuerySettings(payload)
        : {
          settings: {
            version: 1,
            owner: null,
            updatedAt: '',
            pageDelayMinSeconds: '',
            pageDelayMaxSeconds: ''
          },
          source: 'unavailable',
          localSaved: false,
          warning: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u67e5\u8be2\u914d\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    getOperationsNewProductLifecycleBatchAdjustPresetSnapshot: (payload) => (
      operationsNewProductLifecycleService
        ? operationsNewProductLifecycleService.getBatchAdjustPresetSnapshot(payload)
        : {
          version: 1,
          owner: null,
          updatedAt: '',
          source: 'unavailable',
          settings: {
            stationIds: [],
            dailyEnabled: true,
            activityEnabled: false,
            reasonCode: '',
            remark: '',
            duplicateSubmitWindowDays: '',
            useSuggestedPriceAfterSubmitCount: '',
            activityPriceReduction: '',
            dailyProfitFloorMode: 'rate',
            dailyProfitFloorValue: '',
            activityProfitFloorMode: 'rate',
            activityProfitFloorValue: ''
          },
          entryCount: 0,
          entries: [],
          warning: ''
        }
    ),
    saveOperationsNewProductLifecycleBatchAdjustPresetBatch: (payload) => (
      operationsNewProductLifecycleService
        ? operationsNewProductLifecycleService.saveBatchAdjustPresetBatch(payload)
        : {
          version: 1,
          owner: null,
          updatedAt: '',
          source: 'unavailable',
          localSaved: false,
          cloudSynced: false,
          settings: {
            stationIds: [],
            dailyEnabled: true,
            activityEnabled: false,
            reasonCode: '',
            remark: '',
            duplicateSubmitWindowDays: '',
            useSuggestedPriceAfterSubmitCount: '',
            activityPriceReduction: '',
            dailyProfitFloorMode: 'rate',
            dailyProfitFloorValue: '',
            activityProfitFloorMode: 'rate',
            activityProfitFloorValue: ''
          },
          entryCount: 0,
          savedEntryCount: 0,
          entries: [],
          warning: '\u6279\u91cf\u8c03\u4ef7\u8bbe\u7f6e\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    previewOperationsNewProductLifecycleBatchAdjust: (payload, context = {}) => (
      operationsNewProductLifecycleService
        && typeof operationsNewProductLifecycleService.previewBatchAdjust === 'function'
        ? operationsNewProductLifecycleService.previewBatchAdjust(payload, {
          emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.OPERATIONS_PRICE_DECLARATION_PROGRESS, runtimeLogger),
          requesterKey: extractRequesterKey(context)
        })
        : {
          updatedAt: '',
          runId: String(payload && payload.runId || '').trim(),
          rows: [],
          rowCount: 0,
          total: 0,
          totalShops: 0,
          completedShops: 0,
          failedShops: 0,
          canceledShops: 0,
          canceled: false,
          warning: '\u4ef7\u683c\u7533\u62a5\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    cancelOperationsPriceDeclarationQuery: (payload, context = {}) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.cancelQueryJob(payload, {
          requesterKey: extractRequesterKey(context)
        })
        : {
          canceled: false,
          runId: String(payload && payload.runId || '').trim()
        }
    ),
    getOperationsPriceDeclarationQuerySettings: () => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.getQuerySettings()
        : {
          settings: {
            version: 1,
            owner: null,
            updatedAt: '',
            perShopDelaySeconds: 0
          },
          source: 'unavailable'
        }
    ),
    saveOperationsPriceDeclarationQuerySettings: (payload) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.saveQuerySettings(payload)
        : {
          settings: {
            version: 1,
            owner: null,
            updatedAt: '',
            perShopDelaySeconds: 0
          },
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    getOperationsPriceDeclarationQuickCostPresetSnapshot: (payload) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.getQuickCostPresetSnapshot(payload)
        : {
          version: 1,
          owner: null,
          updatedAt: '',
          source: 'unavailable',
          entryCount: 0,
          entries: []
        }
    ),
    saveOperationsPriceDeclarationQuickCostPresetBatch: (payload) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.saveQuickCostPresetBatch(payload)
        : {
          updatedAt: '',
          entryCount: 0,
          entries: [],
          updatedRowCount: 0,
          updatedShopCount: 0,
          cloudSynced: false,
          warning: ''
        }
    ),
    getOperationsPriceDeclarationReviewRules: () => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.getReviewRules()
        : {
          rules: {
            version: 1,
            owner: null,
            updatedAt: '',
            dailyRule: {
              metric: 'profitRate',
              threshold: ''
            },
            activityRule: {
              metric: 'profitRate',
              threshold: ''
            },
            rejectReason: ''
          },
          source: 'unavailable'
        }
    ),
    saveOperationsPriceDeclarationReviewRules: (payload) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.saveReviewRules(payload)
        : {
          rules: {
            version: 1,
            owner: null,
            updatedAt: '',
            dailyRule: {
              metric: 'profitRate',
              threshold: ''
            },
            activityRule: {
              metric: 'profitRate',
              threshold: ''
            },
            rejectReason: ''
          },
          source: 'unavailable',
          cloudSynced: false,
          warning: ''
        }
    ),
    batchRejectOperationsPriceDeclarationRows: (payload) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.batchRejectRows(payload)
        : {
          updatedAt: '',
          rules: {
            version: 1,
            owner: null,
            updatedAt: '',
            dailyRule: {
              metric: 'profitRate',
              threshold: ''
            },
            activityRule: {
              metric: 'profitRate',
              threshold: ''
            },
            rejectReason: ''
          },
          rejectReason: '',
          totalRowCount: 0,
          eligibleOrderCount: 0,
          passOrderCount: 0,
          skippedOrderCount: 0,
          invalidRowCount: 0,
          requestedPassOrderCount: 0,
          approvedOrderCount: 0,
          succeededApprovedReviewOrderIds: [],
          succeededApprovedOrderNos: [],
          failedApproveOrderCount: 0,
          requestedRejectOrderCount: 0,
          rejectedOrderCount: 0,
          succeededRejectedReviewOrderIds: [],
          succeededRejectedOrderNos: [],
          succeededReviewOrderIds: [],
          failedRejectOrderCount: 0,
          succeededOrderNos: [],
          failedOrders: [],
          warning: '\u6279\u91cf\u62d2\u7edd\u670d\u52a1\u672a\u52a0\u8f7d'
        }
    ),
    getOperationsPriceDeclarationProgressSnapshot: (payload) => (
      operationsPriceDeclarationService
        ? operationsPriceDeclarationService.getQueryProgressSnapshot(payload)
        : {
          progress: null,
          source: 'unavailable',
          updatedAt: ''
        }
    ),
    getPromotionManagerSettings: () => promotionManagerSettingsService.getSettings(),
    savePromotionManagerSettings: (payload) => promotionManagerSettingsService.saveSettings(payload),
    getPromotionMonitorSnapshot: () => (
      promotionMonitorService
        ? promotionMonitorService.getSnapshot()
        : { updatedAt: '', batchMonitoringActive: false, enabledShopIds: [], shops: {} }
    ),
    setPromotionMonitorShopEnabled: (payload) => (
      promotionMonitorService
        ? promotionMonitorService.setShopEnabled(payload)
        : { updatedAt: '', batchMonitoringActive: false, enabledShopIds: [], shops: {} }
    ),
    setPromotionMonitorBatchActive: (payload) => (
      promotionMonitorService
        ? promotionMonitorService.setBatchMonitoringActive(payload)
        : { updatedAt: '', batchMonitoringActive: false, enabledShopIds: [], shops: {} }
    ),
    getPromotionManagerNewCreateSettings: () => promotionManagerNewSettingsService.getSettings(),
    savePromotionManagerNewCreateSettings: (payload) => promotionManagerNewSettingsService.saveSettings(payload),
    queryPromotionManagerNewGoods: (payload) => (
      promotionManagerNewGoodsService
        ? promotionManagerNewGoodsService.queryGoods(payload)
        : {
          updatedAt: '',
          request: {},
          rows: [],
          regions: [],
          errors: [{
            shopId: '',
            shopName: '',
            regionId: '',
            regionLabel: '',
            message: '\u65b0\u7248\u63a8\u5e7f\u5546\u54c1\u67e5\u8be2\u670d\u52a1\u672a\u52a0\u8f7d'
          }],
          totalCount: 0,
          successCount: 0,
          failedCount: 1
        }
    ),
    getRuntimeLogEntries: (payload) => runtimeLogger.readEntries(payload),
    getPodUploadSheetMiaoshouCategories: () => (
      podUploadSheetMiaoshouCategoryService
        ? podUploadSheetMiaoshouCategoryService.getSnapshot()
        : { updatedAt: '', sourceUrl: '', categories: [] }
    ),
    getPodUploadSheetMiaoshouTemplateSnapshot: () => (
      podUploadSheetMiaoshouTemplateService
        ? podUploadSheetMiaoshouTemplateService.getSnapshot()
        : { updatedAt: '', templates: [] }
    ),
    syncPodUploadSheetMiaoshouTemplates: () => (
      podUploadSheetMiaoshouTemplateService
        ? podUploadSheetMiaoshouTemplateService.syncNow()
        : { updatedAt: '', templates: [] }
    ),
    getPodUploadSheetMiaoshouFormTemplates: () => (
      podUploadSheetMiaoshouFormTemplateService
        ? podUploadSheetMiaoshouFormTemplateService.getTemplates()
        : { updatedAt: '', templates: [], source: 'unavailable' }
    ),
    savePodUploadSheetMiaoshouFormTemplate: (payload) => (
      podUploadSheetMiaoshouFormTemplateService
        ? podUploadSheetMiaoshouFormTemplateService.saveTemplate(payload)
        : { updatedAt: '', templates: [], source: 'unavailable', cloudSynced: false }
    ),
    deletePodUploadSheetMiaoshouFormTemplate: (payload) => (
      podUploadSheetMiaoshouFormTemplateService
        ? podUploadSheetMiaoshouFormTemplateService.deleteTemplate(payload)
        : { updatedAt: '', templates: [], source: 'unavailable', cloudSynced: false }
    ),
    getPodUploadSheetMiaoshouWorkspaceState: () => (
      podUploadSheetMiaoshouWorkspaceStateService
        ? podUploadSheetMiaoshouWorkspaceStateService.getWorkspaceState()
        : {
          updatedAt: '',
          workspace: {
            globalProductSettings: {},
            products: [],
            activeProductId: ''
          },
          source: 'unavailable'
        }
    ),
    savePodUploadSheetMiaoshouWorkspaceState: (payload) => (
      podUploadSheetMiaoshouWorkspaceStateService
        ? podUploadSheetMiaoshouWorkspaceStateService.saveWorkspaceState(payload)
        : {
          updatedAt: '',
          workspace: {
            globalProductSettings: {},
            products: [],
            activeProductId: ''
          },
          source: 'unavailable'
        }
    ),
    selectPodUploadSheetMiaoshouImportDirectory: (payload, context = {}) => (
      selectPodUploadSheetMiaoshouImportDirectory(payload, context)
    ),
    exportPodUploadSheetMiaoshouTable: (payload, context = {}) => (
      podUploadSheetMiaoshouExportService
        ? podUploadSheetMiaoshouExportService.exportTable({
          ...(payload && typeof payload === 'object' ? payload : {}),
          parentWindow: resolvePodUploadSheetParentWindow(context, '')
        })
        : { canceled: true, filePath: '', rowCount: 0, productCount: 0 }
    ),
    uploadPodUploadSheetMiaoshouCosImages: (payload) => (
      podUploadSheetMiaoshouCosUploadService
        ? podUploadSheetMiaoshouCosUploadService.uploadImages(payload)
        : {
          updatedAt: '',
          bucket: '',
          region: '',
          canceled: false,
          totalCount: 0,
          successCount: 0,
          uploadedCount: 0,
          cachedCount: 0,
          failedCount: 0,
          canceledCount: 0,
          items: []
        }
    ),
    cancelPodUploadSheetMiaoshouCosImages: (payload) => (
      podUploadSheetMiaoshouCosUploadService
        ? podUploadSheetMiaoshouCosUploadService.cancelUpload(payload)
        : {
          canceled: false
        }
    ),
    getPodUploadSheetMiaoshouCosUploadProgressSnapshot: (payload) => (
      podUploadSheetMiaoshouCosUploadService
        ? podUploadSheetMiaoshouCosUploadService.getUploadProgressSnapshot(payload)
        : {
          progress: null,
          source: 'unavailable',
          updatedAt: ''
        }
    ),
    getPodUploadSheetMiaoshouAiTitleConfig: () => (
      podUploadSheetMiaoshouAiTitleConfigService
        ? podUploadSheetMiaoshouAiTitleConfigService.getConfig()
        : {
          settings: {
            apiBaseUrl: '',
            model: '',
            apiKeys: []
          },
          source: 'unavailable'
        }
    ),
    savePodUploadSheetMiaoshouAiTitleConfig: (payload) => (
      podUploadSheetMiaoshouAiTitleConfigService
        ? podUploadSheetMiaoshouAiTitleConfigService.saveConfig(payload)
        : {
          settings: {
            apiBaseUrl: '',
            model: '',
            apiKeys: []
          },
          source: 'unavailable',
          cloudSynced: false
        }
    ),
    generatePodUploadSheetMiaoshouAiTitles: (payload, context = {}) => {
      const sender = context && context.event && context.event.sender && !context.event.sender.isDestroyed()
        ? context.event.sender
        : null;

      return podUploadSheetMiaoshouAiTitleService
        ? podUploadSheetMiaoshouAiTitleService.generateTitles({
            ...(payload && typeof payload === 'object' ? payload : {}),
            emitProgress: createProgressEmitter(context, FEATURE_CHANNELS.POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_PROGRESS, runtimeLogger),
          })
        : {
            updatedAt: '',
            requestedModel: '',
            resolvedModel: '',
            canceled: false,
            totalCount: 0,
            successCount: 0,
            failedCount: 0,
            canceledCount: 0,
            items: []
          };
    },
    cancelPodUploadSheetMiaoshouAiTitles: (payload) => (
      podUploadSheetMiaoshouAiTitleService
        ? podUploadSheetMiaoshouAiTitleService.cancelGeneration(payload)
        : {
          canceled: false
        }
    ),
    getPodUploadSheetMiaoshouUniversalTemplateSnapshot: () => (
      podUploadSheetMiaoshouUniversalTemplateService
        ? podUploadSheetMiaoshouUniversalTemplateService.getSnapshot()
        : { updatedAt: '', templates: [] }
    ),
    syncPodUploadSheetMiaoshouUniversalTemplates: () => (
      podUploadSheetMiaoshouUniversalTemplateService
        ? podUploadSheetMiaoshouUniversalTemplateService.syncNow()
        : { updatedAt: '', templates: [] }
    ),
    getPodUploadSheetMiaoshouUniversalFormTemplates: () => (
      podUploadSheetMiaoshouUniversalFormTemplateService
        ? podUploadSheetMiaoshouUniversalFormTemplateService.getTemplates()
        : { updatedAt: '', templates: [], source: 'unavailable' }
    ),
    savePodUploadSheetMiaoshouUniversalFormTemplate: (payload) => (
      podUploadSheetMiaoshouUniversalFormTemplateService
        ? podUploadSheetMiaoshouUniversalFormTemplateService.saveTemplate(payload)
        : { updatedAt: '', templates: [], source: 'unavailable', cloudSynced: false }
    ),
    deletePodUploadSheetMiaoshouUniversalFormTemplate: (payload) => (
      podUploadSheetMiaoshouUniversalFormTemplateService
        ? podUploadSheetMiaoshouUniversalFormTemplateService.deleteTemplate(payload)
        : { updatedAt: '', templates: [], source: 'unavailable', cloudSynced: false }
    ),
    getPodUploadSheetMiaoshouUniversalWorkspaceState: () => (
      podUploadSheetMiaoshouUniversalWorkspaceStateService
        ? podUploadSheetMiaoshouUniversalWorkspaceStateService.getWorkspaceState()
        : {
          updatedAt: '',
          workspace: {
            lastImportDirectoryPath: ''
          },
          source: 'unavailable'
        }
    ),
    savePodUploadSheetMiaoshouUniversalWorkspaceState: (payload) => (
      podUploadSheetMiaoshouUniversalWorkspaceStateService
        ? podUploadSheetMiaoshouUniversalWorkspaceStateService.saveWorkspaceState(payload)
        : {
          updatedAt: '',
          workspace: {
            lastImportDirectoryPath: ''
          },
          source: 'unavailable'
        }
    ),
    selectPodUploadSheetMiaoshouUniversalImportDirectory: (payload, context = {}) => (
      selectPodUploadSheetMiaoshouImportDirectory({
        ...payload,
        mode: 'universal'
      }, context)
    ),
    exportPodUploadSheetMiaoshouUniversalTable: (payload, context = {}) => (
      podUploadSheetMiaoshouUniversalExportService
        ? podUploadSheetMiaoshouUniversalExportService.exportTable({
          ...(payload && typeof payload === 'object' ? payload : {}),
          parentWindow: resolvePodUploadSheetParentWindow(context, 'universal')
        })
        : { canceled: true, filePath: '', directoryPath: '', rowCount: 0, productCount: 0 }
    ),
    uploadPodUploadSheetMiaoshouUniversalCosImages: (payload) => (
      podUploadSheetMiaoshouUniversalCosUploadService
        ? podUploadSheetMiaoshouUniversalCosUploadService.uploadImages(payload)
        : {
          updatedAt: '',
          bucket: '',
          region: '',
          canceled: false,
          totalCount: 0,
          successCount: 0,
          uploadedCount: 0,
          cachedCount: 0,
          failedCount: 0,
          canceledCount: 0,
          items: []
        }
    ),
    cancelPodUploadSheetMiaoshouUniversalCosImages: (payload) => (
      podUploadSheetMiaoshouUniversalCosUploadService
        ? podUploadSheetMiaoshouUniversalCosUploadService.cancelUpload(payload)
        : {
          canceled: false
        }
    ),
    getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot: (payload) => (
      podUploadSheetMiaoshouUniversalCosUploadService
        ? podUploadSheetMiaoshouUniversalCosUploadService.getUploadProgressSnapshot(payload)
        : {
          progress: null,
          source: 'unavailable',
          updatedAt: ''
        }
    )
  });
  registerCreationCenterIpc({
    getCreationCatalog: () => creationCenterProfileService.getCatalog(),
    onOpenPodUploadSheetMiaoshou: (payload, context = {}) => {
      return showPodUploadSheetMiaoshouWindow(mergeWindowOpenPayload(payload, context));
    },
    onOpenPodSuiteTool: (payload, context = {}) => {
      return showPodSuiteToolWindow(mergeWindowOpenPayload(payload, context));
    }
  });
  registerDialogIpc({
    showConfirmDialog: (payload) => showConfirmDialog({
      ...payload,
      theme: currentTheme,
      appearance: currentThemeAppearance
    })
  });
  registerPodSuiteToolIpc({
    selectWhiteMockupFile: (payload, context = {}) => selectPodSuiteToolWhiteMockupFile(payload, context),
    selectMaskImageFile: (payload, context = {}) => selectPodSuiteToolMaskImageFile(payload, context),
    selectTextureImageFile: (payload, context = {}) => selectPodSuiteToolTextureImageFile(payload, context),
    selectPreviewDesignFile: (payload, context = {}) => selectPodSuiteToolPreviewDesignFile(payload, context),
    selectImageDirectory: (payload, context = {}) => selectPodSuiteToolImageDirectory(payload, context),
    selectOutputDirectory: (payload, context = {}) => selectPodSuiteToolOutputDirectory(payload, context),
    collectImageFiles: (payload) => (
      podSuiteToolService && typeof podSuiteToolService.collectImageFiles === 'function'
        ? podSuiteToolService.collectImageFiles(payload)
        : {
          success: false,
          updatedAt: '',
          directoryPath: '',
          files: []
        }
    ),
    selectPsdMockupFile: (payload, context = {}) => selectPodSuiteToolPsdMockupFile(payload, context),
    selectPsdImageDirectory: (payload, context = {}) => selectPodSuiteToolPsdImageDirectory(payload, context),
    selectPsdOutputDirectory: (payload, context = {}) => selectPodSuiteToolPsdOutputDirectory(payload, context),
    selectPsdMetadataSourceFile: (payload, context = {}) => selectPodSuiteToolPsdMetadataSourceFile(payload, context),
    selectPsdMetadataSourceDirectory: (payload, context = {}) => selectPodSuiteToolPsdMetadataSourceDirectory(payload, context),
    openDirectory: (payload) => openPodSuiteToolDirectory(payload),
    generateWhiteMockups: (payload) => (
      podSuiteToolService
        ? podSuiteToolService.generateWhiteMockups(payload)
        : {
          success: false,
          updatedAt: '',
          message: '\u5957\u56fe\u5de5\u5177\u672a\u5c31\u7eea\u3002'
        }
    ),
    generatePsdSmartObjectMockups: (payload, context = {}) => (
      podSuiteToolService
        ? podSuiteToolService.generatePsdSmartObjectMockups(payload, context)
        : {
          success: false,
          updatedAt: '',
          message: 'PSD\u667a\u80fd\u5957\u56fe\u672a\u5c31\u7eea\u3002'
        }
    ),
    cancelPsdSmartObjectMockups: (payload) => (
      podSuiteToolService && typeof podSuiteToolService.cancelPsdSmartObjectMockups === 'function'
        ? podSuiteToolService.cancelPsdSmartObjectMockups(payload)
        : {
          success: false,
          updatedAt: '',
          message: 'PSD\u667a\u80fd\u5957\u56fe\u505c\u6b62\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        }
    ),
    setPsdEngineWindowVisible: (payload) => (
      podSuiteToolService && typeof podSuiteToolService.setPsdEngineWindowVisible === 'function'
        ? podSuiteToolService.setPsdEngineWindowVisible(payload)
        : {
          success: false,
          updatedAt: '',
          message: 'PSD\u5f15\u64ce\u7a97\u53e3\u5207\u6362\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        }
    ),
    getPsdSmartObjectTemplates: (payload) => (
      podSuiteToolService && typeof podSuiteToolService.getPsdSmartObjectTemplates === 'function'
        ? podSuiteToolService.getPsdSmartObjectTemplates(payload)
        : {
          success: false,
          updatedAt: '',
          templates: [],
          message: 'PSD\u5957\u56fe\u6a21\u677f\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        }
    ),
    savePsdSmartObjectTemplate: (payload) => (
      podSuiteToolService && typeof podSuiteToolService.savePsdSmartObjectTemplate === 'function'
        ? podSuiteToolService.savePsdSmartObjectTemplate(payload)
        : {
          success: false,
          updatedAt: '',
          templates: [],
          message: 'PSD\u5957\u56fe\u6a21\u677f\u4fdd\u5b58\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        }
    ),
    deletePsdSmartObjectTemplate: (payload) => (
      podSuiteToolService && typeof podSuiteToolService.deletePsdSmartObjectTemplate === 'function'
        ? podSuiteToolService.deletePsdSmartObjectTemplate(payload)
        : {
          success: false,
          updatedAt: '',
          templates: [],
          message: 'PSD\u5957\u56fe\u6a21\u677f\u5220\u9664\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        }
    ),
    renderWhiteMockupPreview: (payload) => (
      podSuiteToolService
        ? podSuiteToolService.renderWhiteMockupPreview(payload)
        : {
          success: false,
          updatedAt: '',
          message: '\u9884\u89c8\u751f\u6210\u672a\u5c31\u7eea\u3002'
        }
    ),
    getWhiteMockupTemplate: (payload) => (
      podSuiteToolService
        ? podSuiteToolService.getWhiteMockupTemplate(payload)
        : {
          success: false,
          updatedAt: '',
          message: '\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002'
        }
    ),
    saveWhiteMockupTemplate: (payload) => (
      podSuiteToolService
        ? podSuiteToolService.saveWhiteMockupTemplate(payload)
        : {
          success: false,
          updatedAt: '',
          message: '\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002'
        }
    ),
    createWhiteMockupRegionFromMask: (payload) => (
      podSuiteToolService
        ? podSuiteToolService.createWhiteMockupRegionFromMask(payload)
        : {
          success: false,
          updatedAt: '',
          message: '\u5370\u82b1\u8499\u7248\u533a\u57df\u8bc6\u522b\u672a\u5c31\u7eea\u3002'
        }
    )
  });
  registerShopWindowIpc({
    getController: () => shopWindowBrowserController,
    getBrowserStorageSyncService: () => shopWindowBrowserStorageSyncService
  });

  registerInvokeHandlers(ipcMain, {
    [THEME_CHANNELS.GET_THEME]: () => {
      return currentTheme;
    },
    [THEME_CHANNELS.GET_THEME_APPEARANCE]: () => {
      return currentThemeAppearance;
    },
    [THEME_CHANNELS.SET_THEME]: (_event, payload) => {
      const nextTheme = themePreferenceService.setTheme(payload && payload.theme);
      broadcastTheme(nextTheme, currentThemeAppearance);
      return {
        theme: nextTheme
      };
    },
    [THEME_CHANNELS.SET_THEME_APPEARANCE]: (_event, payload) => {
      const nextAppearance = themePreferenceService.setThemeAppearance(payload);
      broadcastTheme(currentTheme, nextAppearance);
      return {
        theme: currentTheme,
        appearance: nextAppearance
      };
    }
  });

  Promise.resolve(authSessionCache.getCachedSession())
    .then((cachedSession) => {
      if (cachedSession && !sessionStore.hasSession()) {
        runtimeLogger.log('auth_session_restored', {
          username: cachedSession.username
        });
        openAuthenticatedArea(cachedSession);
        return;
      }

      showAuthWindow();
    })
    .catch((error) => {
      runtimeLogger.logError('auth_session_restore_failed', error);
      showAuthWindow();
    });

  app.on('activate', () => {
    if (sessionStore.hasSession()) {
      showMainWindow();
      return;
    }

    showAuthWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    presentWindow(mainWindow);
    return;
  }

  if (authWindow && !authWindow.isDestroyed()) {
    presentWindow(authWindow);
  }
});

app.on('before-quit', (event) => {
  if (!beforeQuitSessionPersistCompleted && !beforeQuitSessionPersistPromise && shopWindowBrowserController) {
    event.preventDefault();
    isAppQuitting = true;
    allowMainWindowClose = true;
    if (promotionMonitorService) {
      promotionMonitorService.shutdown();
    }
    if (promotionAdsSessionService) {
      promotionAdsSessionService.shutdown();
    }
    runtimeLogger.log('before_quit');

    beforeQuitSessionPersistPromise = Promise.resolve(
      Promise.resolve()
        .then(() => showExitSyncProgressWindow({
          phase: 'start',
          progressValue: 0
        }))
        .catch((error) => {
          runtimeLogger.logError('exit_sync_progress_window_show_failed', error);
        })
        .then(() => (
          typeof shopWindowBrowserController.persistAllBrowserSessionsNow === 'function'
            ? shopWindowBrowserController.persistAllBrowserSessionsNow({
              reason: 'app-before-quit',
              syncBrowserStorage: false,
              onProgress(progressPayload) {
                updateExitSyncProgress(progressPayload);
              }
            })
            : []
        ))
    )
      .catch((error) => {
        runtimeLogger.logError('before_quit_session_persist_failed', error);
        updateExitSyncProgress({
          phase: 'error',
          progressValue: 1,
          detail: String(error && error.message || '').trim()
        });
      })
      .finally(() => {
        beforeQuitSessionPersistCompleted = true;
        beforeQuitSessionPersistPromise = null;
        updateExitSyncProgress({
          phase: 'done',
          progressValue: 1
        });
        app.quit();
      });
    return;
  }

  if (beforeQuitSessionPersistPromise) {
    event.preventDefault();
    return;
  }

  isAppQuitting = true;
  allowMainWindowClose = true;
  if (promotionMonitorService) {
    promotionMonitorService.shutdown();
  }
  if (promotionAdsSessionService) {
    promotionAdsSessionService.shutdown();
  }
  runtimeLogger.log('before_quit');
});

app.on('will-quit', () => {
  runtimeLogger.log('will_quit');
});

app.on('render-process-gone', (_event, webContents, details) => {
  runtimeLogger.log('app_render_process_gone', {
    details,
    url: webContents && typeof webContents.getURL === 'function' ? webContents.getURL() : ''
  });
});

app.on('child-process-gone', (_event, details) => {
  runtimeLogger.log('app_child_process_gone', {
    details
  });
});

process.on('uncaughtException', (error) => {
  runtimeLogger.logError('uncaught_exception', error);
});

process.on('unhandledRejection', (error) => {
  runtimeLogger.logError('unhandled_rejection', error);
});

app.on('window-all-closed', () => {
  runtimeLogger.log('window_all_closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
