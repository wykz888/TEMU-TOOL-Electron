const { WebContentsView, shell } = require('electron');
const { JIMENG_IMAGE_CHANNELS } = require('../ipc/jimengImageChannels');
const { installWebContentsDebugShortcuts } = require('./installWebContentsDebugShortcuts');
const { createJimengImageBatchRunner } = require('./jimengImage/batchRunner');
const { createJimengImageNetworkTracker } = require('./jimengImage/networkTracker');

const JIMENG_HOME_URL = 'https://jimeng.jianying.com/ai-tool/generate?workspace=0&type=image';
const WINDOW_WORKSPACE_SYNC_DELAY_MS = 90;
const JIMENG_PARTITION = 'persist:creation-center-jimeng-image';

function createJimengImageWindowController(jimengImageWindow, options = {}) {
  const runtimeLogger = options && options.runtimeLogger ? options.runtimeLogger : null;
  const dedupService = options && options.dedupService ? options.dedupService : null;

  let browserView = null;
  let viewAttached = false;
  let lastBounds = null;
  let browserState = buildDefaultBrowserState();
  let workspaceSyncTimer = 0;
  let networkTracker = null;

  function buildDefaultBrowserState() {
    return {
      homeUrl: JIMENG_HOME_URL,
      currentUrl: JIMENG_HOME_URL,
      title: '\u5373\u68A6\u751F\u56FE',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      lastErrorMessage: ''
    };
  }

  function normalizeText(value) {
    return String(value || '').trim();
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

  function isWindowAlive() {
    return Boolean(jimengImageWindow && !jimengImageWindow.isDestroyed());
  }

  function isBrowserViewUsable() {
    return Boolean(
      browserView
      && browserView.webContents
      && typeof browserView.webContents.isDestroyed === 'function'
      && browserView.webContents.isDestroyed() !== true
    );
  }

  function notifyRenderer(channel, payload) {
    if (!isWindowAlive()) {
      return;
    }

    try {
      jimengImageWindow.webContents.send(channel, payload);
    } catch (_error) {
      // Ignore notifications while the window is closing.
    }
  }

  function emitTaskEvent(payload) {
    notifyRenderer(JIMENG_IMAGE_CHANNELS.TASK_EVENT, payload && typeof payload === 'object' ? payload : {});
  }

  function clearWorkspaceSyncTimer() {
    if (!workspaceSyncTimer) {
      return;
    }

    clearTimeout(workspaceSyncTimer);
    workspaceSyncTimer = 0;
  }

  function requestRendererWorkspaceSync(reason = 'window-layout-change') {
    if (!isWindowAlive() || jimengImageWindow.isMinimized() === true || jimengImageWindow.isVisible() === false) {
      return;
    }

    clearWorkspaceSyncTimer();
    workspaceSyncTimer = setTimeout(() => {
      workspaceSyncTimer = 0;
      notifyRenderer(JIMENG_IMAGE_CHANNELS.REQUEST_WORKSPACE_SYNC, {
        reason
      });
    }, WINDOW_WORKSPACE_SYNC_DELAY_MS);
  }

  function handleWindowLayoutChange() {
    requestRendererWorkspaceSync();
  }

  if (isWindowAlive()) {
    jimengImageWindow.on('resize', handleWindowLayoutChange);
    jimengImageWindow.on('maximize', handleWindowLayoutChange);
    jimengImageWindow.on('unmaximize', handleWindowLayoutChange);
    jimengImageWindow.on('restore', handleWindowLayoutChange);
    jimengImageWindow.on('show', handleWindowLayoutChange);
    jimengImageWindow.on('enter-full-screen', handleWindowLayoutChange);
    jimengImageWindow.on('leave-full-screen', handleWindowLayoutChange);
  }

  function removeViewFromWindow() {
    if (!isBrowserViewUsable() || !isWindowAlive() || viewAttached !== true) {
      return;
    }

    try {
      jimengImageWindow.contentView.removeChildView(browserView);
      viewAttached = false;
    } catch (_error) {
      // Ignore detach failures when the view is already gone.
    }
  }

  function hideView() {
    if (!browserView) {
      return;
    }

    try {
      browserView.setVisible(false);
      browserView.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    } catch (_error) {
      // Ignore hide failures during cleanup.
    }
  }

  function destroyView() {
    if (!browserView) {
      return;
    }

    hideView();
    removeViewFromWindow();

    if (isBrowserViewUsable()) {
      try {
        browserView.webContents.close();
      } catch (_error) {
        // Ignore close failures while destroying the view.
      }
    }

    browserView = null;
    lastBounds = null;
  }

  function areBoundsEqual(left, right) {
    if (!left || !right) {
      return false;
    }

    return (
      left.x === right.x
      && left.y === right.y
      && left.width === right.width
      && left.height === right.height
    );
  }

  function normalizeBounds(payload) {
    const bounds = payload && payload.bounds && typeof payload.bounds === 'object'
      ? payload.bounds
      : {};
    const x = Math.max(0, Math.round(Number(bounds.x) || 0));
    const y = Math.max(0, Math.round(Number(bounds.y) || 0));
    const width = Math.max(0, Math.round(Number(bounds.width) || 0));
    const height = Math.max(0, Math.round(Number(bounds.height) || 0));

    return {
      x,
      y,
      width,
      height
    };
  }

  function syncBrowserState(extra = {}) {
    if (isBrowserViewUsable()) {
      try {
        browserState = {
          ...browserState,
          currentUrl: normalizeText(browserView.webContents.getURL()) || browserState.currentUrl,
          title: normalizeText(browserView.webContents.getTitle()) || browserState.title,
          canGoBack: browserView.webContents.canGoBack(),
          canGoForward: browserView.webContents.canGoForward()
        };
      } catch (_error) {
        // Ignore state sync failures while the view is tearing down.
      }
    }

    notifyRenderer(JIMENG_IMAGE_CHANNELS.BROWSER_STATE_CHANGED, {
      ...browserState,
      ...extra
    });
  }

  function loadUrl(url, reason = 'navigate') {
    const nextUrl = normalizeText(url) || JIMENG_HOME_URL;
    const activeView = ensureBrowserView();

    browserState = {
      ...browserState,
      currentUrl: nextUrl,
      lastErrorMessage: ''
    };
    syncBrowserState();

    return activeView.webContents.loadURL(nextUrl).then(() => {
      log('jimeng_browser_url_loaded', {
        reason,
        url: nextUrl
      });

      return {
        success: true,
        url: nextUrl
      };
    }).catch((error) => {
      browserState = {
        ...browserState,
        loading: false,
        lastErrorMessage: normalizeText(error && error.message) || '\u52A0\u8F7D\u5931\u8D25'
      };
      syncBrowserState();
      logError('jimeng_browser_url_load_failed', error, {
        reason,
        url: nextUrl
      });
      throw error;
    });
  }

  function bindBrowserViewEvents(view) {
    if (!view || !view.webContents) {
      return;
    }

    view.webContents.on('did-start-loading', () => {
      browserState = {
        ...browserState,
        loading: true,
        lastErrorMessage: ''
      };
      syncBrowserState();
    });

    view.webContents.on('did-stop-loading', () => {
      browserState = {
        ...browserState,
        loading: false
      };
      syncBrowserState();
    });

    view.webContents.on('did-navigate', () => {
      browserState = {
        ...browserState,
        lastErrorMessage: ''
      };
      syncBrowserState();
    });

    view.webContents.on('did-navigate-in-page', () => {
      syncBrowserState();
    });

    view.webContents.on('page-title-updated', (event) => {
      event.preventDefault();
      syncBrowserState();
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (isMainFrame !== true || errorCode === -3) {
        return;
      }

      browserState = {
        ...browserState,
        currentUrl: normalizeText(validatedUrl) || browserState.currentUrl,
        loading: false,
        lastErrorMessage: normalizeText(errorDescription) || '\u52A0\u8F7D\u5931\u8D25'
      };
      syncBrowserState();
    });

    view.webContents.setWindowOpenHandler(({ url }) => {
      void loadUrl(url, 'window-open');

      return {
        action: 'deny'
      };
    });
  }

  function ensureViewAttached() {
    if (!isBrowserViewUsable() || !isWindowAlive() || viewAttached === true) {
      return;
    }

    try {
      jimengImageWindow.contentView.addChildView(browserView);
      viewAttached = true;
    } catch (error) {
      logError('jimeng_browser_attach_failed', error);
    }
  }

  function ensureBrowserView() {
    if (isBrowserViewUsable()) {
      return browserView;
    }

    browserView = new WebContentsView({
      webPreferences: {
        backgroundThrottling: false,
        sandbox: false,
        partition: JIMENG_PARTITION
      }
    });

    browserView.setBackgroundColor('#ffffff');
    browserView.setVisible(false);
    browserView.setBounds({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    });

    installWebContentsDebugShortcuts(browserView);
    bindBrowserViewEvents(browserView);
    ensureViewAttached();
    if (networkTracker && typeof networkTracker.ensureAttached === 'function') {
      void networkTracker.ensureAttached();
    }
    void loadUrl(JIMENG_HOME_URL, 'initial-load');

    return browserView;
  }

  networkTracker = createJimengImageNetworkTracker({
    getBrowserView: () => (isBrowserViewUsable() ? browserView : ensureBrowserView()),
    log,
    logError
  });

  const batchRunner = createJimengImageBatchRunner({
    getBrowserView: () => (isBrowserViewUsable() ? browserView : ensureBrowserView()),
    emitTaskEvent,
    log,
    logError,
    networkTracker,
    dedupService
  });

  function updateWorkspace(payload = {}) {
    const visible = payload && payload.visible === true;
    const bounds = normalizeBounds(payload);

    if (!visible || bounds.width < 10 || bounds.height < 10) {
      hideView();

      return {
        visible: false
      };
    }

    ensureBrowserView();
    ensureViewAttached();

    if (!areBoundsEqual(lastBounds, bounds)) {
      try {
        browserView.setBounds(bounds);
        lastBounds = bounds;
      } catch (error) {
        logError('jimeng_browser_bounds_update_failed', error, {
          bounds
        });
      }
    }

    try {
      browserView.setVisible(true);
    } catch (error) {
      logError('jimeng_browser_visibility_update_failed', error, {
        bounds
      });
    }

    syncBrowserState();

    return {
      visible: true,
      bounds
    };
  }

  function reloadBrowser() {
    if (!isBrowserViewUsable()) {
      ensureBrowserView();
    }

    if (isBrowserViewUsable()) {
      browserView.webContents.reload();
    }

    return {
      success: true
    };
  }

  function navigateHome() {
    return loadUrl(JIMENG_HOME_URL, 'home');
  }

  async function openCurrentUrlExternal() {
    const currentUrl = normalizeText(browserState.currentUrl) || JIMENG_HOME_URL;

    if (!currentUrl) {
      return {
        opened: false,
        url: ''
      };
    }

    await shell.openExternal(currentUrl);

    return {
      opened: true,
      url: currentUrl
    };
  }

  async function startBatchGeneration(payload) {
    ensureBrowserView();

    return batchRunner.startBatchGeneration(payload);
  }

  function getBatchState() {
    return batchRunner.getBatchState();
  }

  function pauseBatchGeneration() {
    return batchRunner.pauseBatchGeneration();
  }

  function resumeBatchGeneration() {
    return batchRunner.resumeBatchGeneration();
  }

  function stopBatchGeneration() {
    return batchRunner.stopBatchGeneration();
  }

  function destroy() {
    clearWorkspaceSyncTimer();

    if (isWindowAlive()) {
      jimengImageWindow.removeListener('resize', handleWindowLayoutChange);
      jimengImageWindow.removeListener('maximize', handleWindowLayoutChange);
      jimengImageWindow.removeListener('unmaximize', handleWindowLayoutChange);
      jimengImageWindow.removeListener('restore', handleWindowLayoutChange);
      jimengImageWindow.removeListener('show', handleWindowLayoutChange);
      jimengImageWindow.removeListener('enter-full-screen', handleWindowLayoutChange);
      jimengImageWindow.removeListener('leave-full-screen', handleWindowLayoutChange);
    }

    if (networkTracker && typeof networkTracker.destroy === 'function') {
      networkTracker.destroy();
    }

    destroyView();
  }

  return {
    updateWorkspace,
    reloadBrowser,
    navigateHome,
    openCurrentUrlExternal,
    getBatchState,
    pauseBatchGeneration,
    resumeBatchGeneration,
    startBatchGeneration,
    stopBatchGeneration,
    requestRendererWorkspaceSync,
    destroy
  };
}

module.exports = {
  JIMENG_HOME_URL,
  createJimengImageWindowController
};
