import { reactive } from 'vue';

const WORKSPACE_TABS = Object.freeze([
  {
    browserTabListId: 'sellerCenterBrowserTabList',
    label: '\u5356\u5BB6\u4E2D\u5FC3',
    pageType: 'seller-center'
  },
  {
    browserTabListId: 'productPromotionBrowserTabList',
    label: '\u5546\u54C1\u63A8\u5E7F',
    pageType: 'product-promotion'
  }
]);

const DEFAULT_TAB_LABELS = Object.freeze({
  'product-promotion': '\u5546\u54C1\u63A8\u5E7F',
  'seller-center': '\u5356\u5BB6\u4E2D\u5FC3'
});

function createEmptyBrowserHostState() {
  return {
    badgeText: '',
    bodyText: '',
    canOpen: false,
    isProgress: false,
    isStandby: false,
    titleText: ''
  };
}

function createFallbackBrowserTab(pageType) {
  return {
    closable: false,
    id: 'default',
    title: `${DEFAULT_TAB_LABELS[pageType] || '\u6D4F\u89C8\u5668'} 1`,
    url: ''
  };
}

function createFallbackPageState(pageType) {
  const defaultTab = createFallbackBrowserTab(pageType);

  return {
    activeBrowserTabId: defaultTab.id,
    opened: false,
    tabs: [defaultTab]
  };
}

export function createWorkspaceView() {
  const state = reactive({
    activeWorkspaceTab: 'seller-center',
    browserHostsByPageType: {
      'product-promotion': createEmptyBrowserHostState(),
      'seller-center': createEmptyBrowserHostState()
    },
    browserTabsByPageType: {
      'product-promotion': [],
      'seller-center': []
    },
    tabs: WORKSPACE_TABS.map((tab) => ({ ...tab }))
  });
  const runtime = {
    createDefaultBrowserTab: createFallbackBrowserTab,
    defaultBrowserTabId: 'default',
    ensureActiveBrowserTab(shopId, pageType) {
      return createFallbackPageState(pageType);
    },
    ensurePageBrowserState(shopId, pageType) {
      return createFallbackPageState(pageType);
    },
    getBridge() {
      throw new Error('\u6D4F\u89C8\u5668\u5DE5\u4F5C\u533A\u901A\u4FE1\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\u3002');
    },
    getBrowserStorageBusyActionForShop() {
      return '';
    },
    getSelectedShop() {
      return null;
    },
    getViewState() {
      return {
        activeWorkspaceTab: 'seller-center',
        browserTabsByShopId: {},
        selectedShopId: ''
      };
    },
    hideTabStatus() {},
    isPageBrowserOpened() {
      return false;
    },
    kickOffAutoBrowserStorageSync() {},
    maxBrowserTabs: 10,
    normalizeText(value) {
      return value == null ? '' : String(value).trim();
    },
    openWorkspaceAfterStorageRestore() {
      return Promise.resolve(false);
    },
    render() {},
    scheduleAutoBrowserStorageUpload() {},
    showTabStatus() {},
    tabLabels: DEFAULT_TAB_LABELS,
    updateClosableState(pageState) {
      const canCloseTabs = pageState.tabs.length > 1;
      pageState.tabs = pageState.tabs.map((tab) => ({
        ...tab,
        closable: canCloseTabs
      }));
    }
  };
  const knownTabs = new Set(WORKSPACE_TABS.map((tab) => tab.pageType));

  function normalizeText(value) {
    return runtime.normalizeText(value);
  }

  function normalizePageType(pageType) {
    const normalizedPageType = normalizeText(pageType);

    return knownTabs.has(normalizedPageType) ? normalizedPageType : 'seller-center';
  }

  function getPageTypes() {
    return state.tabs.map((tab) => tab.pageType);
  }

  function getBrowserTabs(pageType) {
    return state.browserTabsByPageType[normalizePageType(pageType)] || [];
  }

  function getBrowserHostState(pageType) {
    return state.browserHostsByPageType[normalizePageType(pageType)] || createEmptyBrowserHostState();
  }

  function syncFromViewState() {
    const viewState = runtime.getViewState();
    const nextWorkspaceTab = normalizePageType(viewState && viewState.activeWorkspaceTab);

    state.activeWorkspaceTab = nextWorkspaceTab;

    if (viewState && viewState.activeWorkspaceTab !== nextWorkspaceTab) {
      viewState.activeWorkspaceTab = nextWorkspaceTab;
    }

    return nextWorkspaceTab;
  }

  function setActiveWorkspaceTab(pageType) {
    const nextWorkspaceTab = normalizePageType(pageType);
    const viewState = runtime.getViewState();

    if (viewState && viewState.activeWorkspaceTab !== nextWorkspaceTab) {
      viewState.activeWorkspaceTab = nextWorkspaceTab;
    }

    state.activeWorkspaceTab = nextWorkspaceTab;
    return nextWorkspaceTab;
  }

  function renderWorkspaceTabs() {
    return syncFromViewState();
  }

  function buildBrowserTabModel(tab, activeBrowserTabId) {
    const tabId = normalizeText(tab && tab.id);
    const tabTitle = normalizeText(tab && tab.title) || '\u65B0\u6807\u7B7E';

    return {
      closable: Boolean(tab && tab.closable),
      id: tabId,
      isActive: tabId === normalizeText(activeBrowserTabId),
      label: tabTitle,
      title: tabTitle
    };
  }

  function renderBrowserTabs() {
    const selectedShop = runtime.getSelectedShop();

    getPageTypes().forEach((pageType) => {
      if (!selectedShop) {
        state.browserTabsByPageType[pageType] = [];
        return;
      }

      const pageState =
        runtime.ensureActiveBrowserTab(selectedShop.id, pageType)
        || createFallbackPageState(pageType);
      const tabs = Array.isArray(pageState.tabs) ? pageState.tabs : [];

      state.browserTabsByPageType[pageType] = tabs
        .map((tab) => buildBrowserTabModel(tab, pageState.activeBrowserTabId))
        .filter((tab) => tab.id);
    });
  }

  function buildBrowserHostState(pageType, selectedShop) {
    if (!selectedShop) {
      return createEmptyBrowserHostState();
    }

    if (runtime.isPageBrowserOpened(selectedShop.id, pageType)) {
      return createEmptyBrowserHostState();
    }

    const workspaceLabel = runtime.tabLabels[pageType] || '\u6D4F\u89C8\u5E97\u94FA';
    const shopName = normalizeText(selectedShop.shopName) || '\u5F53\u524D\u5E97\u94FA';
    const busyAction = runtime.getBrowserStorageBusyActionForShop(selectedShop.id);
    const isProgress = busyAction === 'auto-restore' || busyAction === 'restore';

    if (isProgress) {
      return {
        badgeText: '\u6B63\u5728\u6062\u590D',
        bodyText:
          '\u6B65\u9AA4 1/2 \u68C0\u67E5\u5F53\u524D\u767B\u5F55\u72B6\u6001\uFF0C'
          + '\u6B65\u9AA4 2/2 \u6309\u9700\u6062\u590D Cookies\u3001Local Storage \u548C IndexedDB\u3002'
          + '\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u6253\u5F00\u5DE5\u4F5C\u533A\u3002',
        canOpen: false,
        isProgress: true,
        isStandby: true,
        titleText: `\u6B63\u5728\u4E3A ${shopName} \u51C6\u5907${workspaceLabel}`
      };
    }

    return {
      badgeText: '\u672A\u6253\u5F00',
      bodyText:
        `${shopName} \u6D4F\u89C8\u7A97\u53E3\u9ED8\u8BA4\u4E0D\u81EA\u52A8\u6253\u5F00\uFF0C`
        + '\u70B9\u51FB\u540E\u518D\u8FDB\u5165\u6D4F\u89C8\u3002',
      canOpen: true,
      isProgress: false,
      isStandby: true,
      titleText: `\u70B9\u51FB\u6253\u5F00${workspaceLabel}`
    };
  }

  function renderBrowserHosts() {
    const selectedShop = runtime.getSelectedShop();

    getPageTypes().forEach((pageType) => {
      state.browserHostsByPageType[pageType] = buildBrowserHostState(pageType, selectedShop);
    });
  }

  function handleWorkspaceTabClick(pageType) {
    setActiveWorkspaceTab(pageType);
    runtime.hideTabStatus();
    runtime.render();
    void runtime.kickOffAutoBrowserStorageSync('workspace-tab-changed');
  }

  async function handleWorkspaceTabDoubleClick(pageType) {
    const normalizedPageType = normalizePageType(pageType);
    const selectedShop = runtime.getSelectedShop();

    if (!selectedShop) {
      runtime.showTabStatus({
        message: '\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u540E\u518D\u91CD\u65B0\u767B\u5F55\u3002',
        durationMs: 3200
      });
      return;
    }

    setActiveWorkspaceTab(normalizedPageType);

    const opened = await runtime.openWorkspaceAfterStorageRestore(selectedShop.id, normalizedPageType, {
      restoreReason: 'restart-login-open',
      syncReason: 'restart-login-opened'
    });

    if (!opened) {
      return;
    }

    const pageState = runtime.ensureActiveBrowserTab(selectedShop.id, normalizedPageType) || {
      activeBrowserTabId: runtime.defaultBrowserTabId
    };

    runtime.showTabStatus({
      message: '\u6B63\u5728\u91CD\u65B0\u6253\u5F00\u767B\u5F55\u9875\u3002',
      durationMs: 2400
    });

    try {
      const result = await runtime.getBridge().restartLoginFlow({
        shopId: selectedShop.id,
        shopName: selectedShop.shopName || '',
        phoneNumber: selectedShop.phoneNumber || selectedShop.accountValue || selectedShop.email || '',
        accountValue: selectedShop.accountValue || selectedShop.phoneNumber || selectedShop.email || '',
        email: selectedShop.email || '',
        accountType: selectedShop.accountType || '',
        shopUpdatedAt: selectedShop.updatedAt || '',
        proxyConfig: selectedShop.proxyConfig || {},
        fingerprintConfig: selectedShop.fingerprintConfig || {},
        pageType: normalizedPageType,
        browserTabId: pageState.activeBrowserTabId
      });

      if (result && result.message) {
        runtime.showTabStatus({
          message: result.message,
          durationMs: 3200
        });
      }
    } catch (error) {
      runtime.showTabStatus({
        message: error && error.message
          ? error.message
          : '\u91CD\u65B0\u6253\u5F00\u767B\u5F55\u9875\u5931\u8D25\u3002',
        persistent: true
      });
    }
  }

  function closeBrowserTab(pageType, browserTabId) {
    const selectedShop = runtime.getSelectedShop();
    const normalizedPageType = normalizePageType(pageType);
    const normalizedBrowserTabId = normalizeText(browserTabId);

    if (!selectedShop || !normalizedBrowserTabId) {
      return;
    }

    const pageState = runtime.ensureActiveBrowserTab(selectedShop.id, normalizedPageType);
    const tabIndex = pageState.tabs.findIndex((tab) => tab.id === normalizedBrowserTabId);

    if (tabIndex < 0 || pageState.tabs.length <= 1) {
      return;
    }

    const wasActive = pageState.activeBrowserTabId === normalizedBrowserTabId;

    pageState.tabs.splice(tabIndex, 1);

    if (pageState.tabs.length === 0) {
      const defaultTab = runtime.createDefaultBrowserTab(normalizedPageType);

      pageState.tabs = [defaultTab];
      pageState.activeBrowserTabId = defaultTab.id;
    } else if (wasActive) {
      const fallbackTab = pageState.tabs[Math.max(0, tabIndex - 1)] || pageState.tabs[0];

      pageState.activeBrowserTabId = fallbackTab.id;
    }

    runtime.updateClosableState(pageState);
    runtime.render();
    runtime.getBridge().closeBrowserTab({
      browserTabId: normalizedBrowserTabId,
      pageType: normalizedPageType,
      shopId: selectedShop.id
    });
  }

  async function handleBrowserTabClick(pageType, browserTabId) {
    const selectedShop = runtime.getSelectedShop();
    const normalizedPageType = normalizePageType(pageType);

    if (!selectedShop) {
      return;
    }

    await runtime.openWorkspaceAfterStorageRestore(selectedShop.id, normalizedPageType, {
      browserTabId: normalizeText(browserTabId) || runtime.defaultBrowserTabId,
      restoreReason: 'browser-tab-selected',
      syncReason: 'browser-tab-selected'
    });
  }

  function handleBrowserTabClose(pageType, browserTabId) {
    closeBrowserTab(pageType, browserTabId);
  }

  async function handleBrowserHostOpen(pageType) {
    const selectedShop = runtime.getSelectedShop();
    const normalizedPageType = normalizePageType(pageType);

    if (!selectedShop || !normalizedPageType) {
      return;
    }

    await runtime.openWorkspaceAfterStorageRestore(selectedShop.id, normalizedPageType, {
      restoreReason: 'workspace-open-intent',
      syncReason: 'workspace-opened'
    });
  }

  function upsertBrowserTab(shopId, pageType, browserTab) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedPageType = normalizePageType(pageType);

    if (!normalizedShopId || !normalizedPageType || !browserTab || !browserTab.id) {
      return null;
    }

    const pageState = runtime.ensurePageBrowserState(normalizedShopId, normalizedPageType);
    const existedTab = pageState.tabs.find((tab) => tab.id === browserTab.id) || null;

    if (existedTab) {
      existedTab.title = normalizeText(browserTab.title || existedTab.title) || existedTab.title;
      existedTab.url = normalizeText(browserTab.url || existedTab.url);
      runtime.updateClosableState(pageState);
      return pageState;
    }

    if (pageState.tabs.length >= runtime.maxBrowserTabs) {
      return pageState;
    }

    pageState.tabs.push({
      closable: true,
      id: browserTab.id,
      title:
        normalizeText(browserTab.title)
        || `${runtime.tabLabels[normalizedPageType] || '\u65B0\u6807\u7B7E'} ${pageState.tabs.length + 1}`,
      url: normalizeText(browserTab.url)
    });
    pageState.activeBrowserTabId = browserTab.id;
    runtime.updateClosableState(pageState);
    return pageState;
  }

  function handleBrowserTabCreated(payload) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageType = normalizeText(payload && payload.pageType);
    const pageState = upsertBrowserTab(shopId, pageType, payload && payload.tab);

    if (!pageState) {
      return;
    }

    pageState.activeBrowserTabId = payload && payload.tab && payload.tab.id
      ? payload.tab.id
      : pageState.activeBrowserTabId;
    runtime.render();

    if (shopId === normalizeText(runtime.getViewState().selectedShopId)) {
      runtime.scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-created');
    }
  }

  function handleBrowserTabClosed(payload) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageType = normalizePageType(payload && payload.pageType);
    const browserTabId = normalizeText(payload && payload.browserTabId);
    const activateBrowserTabId = normalizeText(payload && payload.activateBrowserTabId);

    if (!shopId || !pageType || !browserTabId) {
      return;
    }

    const pageState = runtime.ensurePageBrowserState(shopId, pageType);
    const tabIndex = pageState.tabs.findIndex((tab) => tab.id === browserTabId);

    if (tabIndex < 0) {
      return;
    }

    const wasActive = pageState.activeBrowserTabId === browserTabId;

    pageState.tabs.splice(tabIndex, 1);

    if (pageState.tabs.length === 0) {
      const defaultTab = runtime.createDefaultBrowserTab(pageType);

      pageState.tabs = [defaultTab];
      pageState.activeBrowserTabId = defaultTab.id;
    } else if (activateBrowserTabId && pageState.tabs.some((tab) => tab.id === activateBrowserTabId)) {
      pageState.activeBrowserTabId = activateBrowserTabId;
    } else if (wasActive) {
      const fallbackTab = pageState.tabs[Math.max(0, tabIndex - 1)] || pageState.tabs[0];

      pageState.activeBrowserTabId = fallbackTab.id;
    }

    runtime.updateClosableState(pageState);
    runtime.render();

    if (shopId === normalizeText(runtime.getViewState().selectedShopId)) {
      runtime.scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-closed');
    }
  }

  function handleBrowserTabUpdated(payload) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageType = normalizePageType(payload && payload.pageType);
    const browserTab = payload && payload.tab;

    if (!shopId || !pageType || !browserTab || !browserTab.id) {
      return;
    }

    const pageState = runtime.ensurePageBrowserState(shopId, pageType);
    const tab = pageState.tabs.find((item) => item.id === browserTab.id) || null;

    if (!tab) {
      return;
    }

    tab.title = normalizeText(browserTab.title || tab.title) || tab.title;
    tab.url = normalizeText(browserTab.url || tab.url);
    runtime.render({
      syncWorkspace: false
    });

    if (shopId === normalizeText(runtime.getViewState().selectedShopId)) {
      runtime.scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-updated');
    }
  }

  function handleBrowserTabReset(payload) {
    const shopId = normalizeText(payload && payload.shopId);
    const pageTypes = Array.isArray(payload && payload.pageTypes)
      ? payload.pageTypes.map((pageType) => normalizeText(pageType)).filter(Boolean)
      : [];

    if (!shopId || pageTypes.length === 0) {
      return;
    }

    const viewState = runtime.getViewState();

    if (!viewState.browserTabsByShopId[shopId]) {
      viewState.browserTabsByShopId[shopId] = {};
    }

    pageTypes.forEach((pageType) => {
      const normalizedPageType = normalizePageType(pageType);
      const previousPageState = viewState.browserTabsByShopId[shopId][normalizedPageType];
      const nextPageState = runtime.ensurePageBrowserState('', normalizedPageType);

      if (previousPageState && previousPageState.opened === true) {
        nextPageState.opened = true;
      }

      viewState.browserTabsByShopId[shopId][normalizedPageType] = nextPageState;
    });

    runtime.render({
      syncWorkspace: false
    });

    if (shopId === normalizeText(runtime.getViewState().selectedShopId)) {
      runtime.scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-reset');
    }
  }

  function applyFunctionOption(options, name) {
    runtime[name] =
      typeof options[name] === 'function'
        ? options[name]
        : runtime[name];
  }

  function configure(options = {}) {
    [
      'createDefaultBrowserTab',
      'ensureActiveBrowserTab',
      'ensurePageBrowserState',
      'getBridge',
      'getBrowserStorageBusyActionForShop',
      'getSelectedShop',
      'getViewState',
      'hideTabStatus',
      'isPageBrowserOpened',
      'kickOffAutoBrowserStorageSync',
      'normalizeText',
      'openWorkspaceAfterStorageRestore',
      'render',
      'scheduleAutoBrowserStorageUpload',
      'showTabStatus',
      'updateClosableState'
    ].forEach((name) => {
      applyFunctionOption(options, name);
    });

    runtime.defaultBrowserTabId =
      normalizeText(options.defaultBrowserTabId)
      || runtime.defaultBrowserTabId;
    runtime.maxBrowserTabs = Math.max(
      1,
      Number(options.maxBrowserTabs) || runtime.maxBrowserTabs
    );
    runtime.tabLabels =
      options.tabLabels && typeof options.tabLabels === 'object'
        ? options.tabLabels
        : runtime.tabLabels;

    renderWorkspaceTabs();
    renderBrowserTabs();
    renderBrowserHosts();
  }

  return {
    configure,
    getBrowserHostState,
    getBrowserTabs,
    handleBrowserHostOpen,
    handleBrowserTabClick,
    handleBrowserTabClose,
    handleBrowserTabClosed,
    handleBrowserTabCreated,
    handleBrowserTabReset,
    handleBrowserTabUpdated,
    handleWorkspaceTabClick,
    handleWorkspaceTabDoubleClick,
    renderBrowserHosts,
    renderBrowserTabs,
    renderWorkspaceTabs,
    state
  };
}
