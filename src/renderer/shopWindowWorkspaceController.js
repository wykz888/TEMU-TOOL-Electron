(() => {
  window.createShopWindowWorkspaceController = function createShopWindowWorkspaceController(options) {
    const getElements = options.getElements;
    const getViewState = options.getViewState;
    const getSelectedShop = options.getSelectedShop;
    const getBridge = options.getBridge;
    const escapeHtml = options.escapeHtml;
    const ensureActiveBrowserTab = options.ensureActiveBrowserTab;
    const ensurePageBrowserState = options.ensurePageBrowserState;
    const isPageBrowserOpened = options.isPageBrowserOpened;
    const createDefaultBrowserTab = options.createDefaultBrowserTab;
    const updateClosableState = options.updateClosableState;
    const getBrowserStorageBusyActionForShop = options.getBrowserStorageBusyActionForShop;
    const openWorkspaceAfterStorageRestore = options.openWorkspaceAfterStorageRestore;
    const scheduleAutoBrowserStorageUpload = options.scheduleAutoBrowserStorageUpload;
    const onWorkspaceTabChanged =
      typeof options.onWorkspaceTabChanged === 'function'
        ? options.onWorkspaceTabChanged
        : () => {};
    const showTabStatus = options.showTabStatus;
    const hideTabStatus = options.hideTabStatus;
    const render = options.render;
    const tabLabels = options.tabLabels;
    const defaultBrowserTabId = options.defaultBrowserTabId;
    const maxBrowserTabs = options.maxBrowserTabs;
    const browserTabListCacheByPageType = Object.create(null);
    const browserHostCacheByPageType = Object.create(null);

    function getHtmlCache(cacheByPageType, pageType) {
      const normalizedPageType = String(pageType || '').trim() || 'seller-center';

      if (!cacheByPageType[normalizedPageType]) {
        cacheByPageType[normalizedPageType] = {
          element: null,
          html: '',
          signature: ''
        };
      }

      return cacheByPageType[normalizedPageType];
    }

    function setInnerHtmlIfChanged(element, html, cache) {
      if (cache.element !== element || cache.html !== html) {
        element.innerHTML = html;
        cache.element = element;
        cache.html = html;
      }
    }

    function setClassIfChanged(element, className, enabled) {
      if (element.classList.contains(className) !== enabled) {
        element.classList.toggle(className, enabled);
      }
    }

    function buildBrowserTabListSignature(pageState) {
      return [
        pageState.activeBrowserTabId,
        ...pageState.tabs.map((tab) => [
          tab && tab.id,
          tab && tab.title,
          tab && tab.url,
          tab && tab.closable === true ? '1' : '0'
        ].map((value) => String(value || '').trim()).join('\u0002'))
      ].join('\u0001');
    }

    function buildBrowserHostSignature(pageType, selectedShop) {
      if (!selectedShop) {
        return 'empty';
      }

      if (isPageBrowserOpened(selectedShop.id, pageType)) {
        return `opened\u0001${selectedShop.id}`;
      }

      return [
        'standby',
        pageType,
        selectedShop.id,
        selectedShop.shopName || '',
        getBrowserStorageBusyActionForShop(selectedShop.id)
      ].join('\u0001');
    }

    function renderWorkspaceTabs() {
      const elements = getElements();
      const viewState = getViewState();

      elements.workspaceButtons.forEach((button) => {
        const isActive = button.dataset.workspaceTabTarget === viewState.activeWorkspaceTab;
        setClassIfChanged(button, 'is-active', isActive);
      });

      elements.panels.forEach((panel) => {
        const isActive = panel.dataset.workspacePanel === viewState.activeWorkspaceTab;
        setClassIfChanged(panel, 'is-active', isActive);

        if (panel.hidden !== !isActive) {
          panel.hidden = !isActive;
        }
      });
    }

    function buildBrowserTabHtml(pageType, tab, isActive) {
      return `
        <div class="browser-tab-item ${isActive ? 'is-active' : ''}">
          <button
            class="browser-tab-button"
            type="button"
            data-browser-tab-button="${escapeHtml(tab.id)}"
            data-browser-tab-page-type="${escapeHtml(pageType)}"
            title="${escapeHtml(tab.title || '')}"
          >
            <span class="browser-tab-label">${escapeHtml(tab.title || '\u65B0\u6807\u7B7E')}</span>
          </button>
          ${tab.closable ? `
            <button
              class="browser-tab-close"
              type="button"
              data-browser-tab-close="${escapeHtml(tab.id)}"
              data-browser-tab-page-type="${escapeHtml(pageType)}"
              aria-label="Close"
              title="${escapeHtml('\u5173\u95ED\u6807\u7B7E')}"
            >
              &#x2715;
            </button>
          ` : ''}
        </div>
      `;
    }

    function renderBrowserTabs() {
      const elements = getElements();
      const selectedShop = getSelectedShop();

      Object.entries(elements.browserTabLists).forEach(([pageType, tabList]) => {
        const cache = getHtmlCache(browserTabListCacheByPageType, pageType);

        if (!selectedShop) {
          cache.signature = 'empty';
          setInnerHtmlIfChanged(tabList, '', cache);
          return;
        }

        const pageState = ensureActiveBrowserTab(selectedShop.id, pageType);
        const signature = buildBrowserTabListSignature(pageState);

        if (cache.element === tabList && cache.signature === signature) {
          return;
        }

        const nextHtml = pageState.tabs
          .map((tab) => buildBrowserTabHtml(pageType, tab, tab.id === pageState.activeBrowserTabId))
          .join('');

        cache.signature = signature;
        setInnerHtmlIfChanged(tabList, nextHtml, cache);
      });
    }

    function buildBrowserStandbyHtml(pageType, selectedShop) {
      const workspaceLabel = tabLabels[pageType] || '\u6D4F\u89C8\u5E97\u94FA';
      const shopName = selectedShop && selectedShop.shopName ? selectedShop.shopName : '\u5F53\u524D\u5E97\u94FA';
      const busyAction = selectedShop
        ? getBrowserStorageBusyActionForShop(selectedShop.id)
        : '';
      const isRestoring = busyAction === 'auto-restore' || busyAction === 'restore';

      if (isRestoring) {
        return `
          <div class="workspace-browser-standby is-progress" aria-live="polite">
            <span class="workspace-browser-standby-badge is-progress">\u6B63\u5728\u6062\u590D</span>
            <strong class="workspace-browser-standby-title">\u6B63\u5728\u4E3A ${escapeHtml(shopName)} \u51C6\u5907${escapeHtml(workspaceLabel)}</strong>
            <span class="workspace-browser-standby-text">\u6B65\u9AA4 1/2 \u68C0\u67E5\u5F53\u524D\u767B\u5F55\u72B6\u6001\uFF0C\u6B65\u9AA4 2/2 \u6309\u9700\u6062\u590D Cookies\u3001Local Storage \u548C IndexedDB\u3002\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u6253\u5F00\u5DE5\u4F5C\u533A\u3002</span>
          </div>
        `;
      }

      return `
        <button
          class="workspace-browser-standby"
          type="button"
          data-open-browser-page-type="${escapeHtml(pageType)}"
        >
          <span class="workspace-browser-standby-badge">\u672A\u6253\u5F00</span>
          <strong class="workspace-browser-standby-title">\u70B9\u51FB\u6253\u5F00${escapeHtml(workspaceLabel)}</strong>
          <span class="workspace-browser-standby-text">${escapeHtml(shopName)} \u6D4F\u89C8\u7A97\u53E3\u9ED8\u8BA4\u4E0D\u81EA\u52A8\u6253\u5F00\uFF0C\u70B9\u51FB\u540E\u518D\u8FDB\u5165\u6D4F\u89C8\u3002</span>
        </button>
      `;
    }

    function renderBrowserHosts() {
      const elements = getElements();
      const selectedShop = getSelectedShop();

      Object.entries(elements.browserHosts).forEach(([pageType, host]) => {
        const cache = getHtmlCache(browserHostCacheByPageType, pageType);
        const signature = buildBrowserHostSignature(pageType, selectedShop);

        if (cache.element === host && cache.signature === signature) {
          return;
        }

        if (!selectedShop) {
          cache.signature = signature;
          setInnerHtmlIfChanged(host, '', cache);
          setClassIfChanged(host, 'is-standby', false);
          return;
        }

        if (isPageBrowserOpened(selectedShop.id, pageType)) {
          cache.signature = signature;
          setInnerHtmlIfChanged(host, '', cache);
          setClassIfChanged(host, 'is-standby', false);
          return;
        }

        cache.signature = signature;
        setInnerHtmlIfChanged(host, buildBrowserStandbyHtml(pageType, selectedShop), cache);
        setClassIfChanged(host, 'is-standby', true);
      });
    }

    function handleWorkspaceButtonClick(button) {
      const viewState = getViewState();

      viewState.activeWorkspaceTab = button.dataset.workspaceTabTarget || 'seller-center';
      hideTabStatus();
      render();
    }

    async function handleWorkspaceButtonDoubleClick(button) {
      const viewState = getViewState();
      const pageType = button.dataset.workspaceTabTarget || 'seller-center';

      if (pageType !== 'seller-center' && pageType !== 'product-promotion') {
        return;
      }

      const selectedShop = getSelectedShop();

      if (!selectedShop) {
        showTabStatus({
          message: '\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u540E\u518D\u91CD\u65B0\u767B\u5F55\u3002',
          durationMs: 3200
        });
        return;
      }

      viewState.activeWorkspaceTab = pageType;
      const opened = await openWorkspaceAfterStorageRestore(selectedShop.id, pageType, {
        restoreReason: 'restart-login-open',
        syncReason: 'restart-login-opened'
      });

      if (!opened) {
        return;
      }

      const pageState = ensureActiveBrowserTab(selectedShop.id, pageType);

      showTabStatus({
        message: '\u6B63\u5728\u91CD\u65B0\u6253\u5F00\u767B\u5F55\u9875\u3002',
        durationMs: 2400
      });

      try {
        const result = await getBridge().restartLoginFlow({
          shopId: selectedShop.id,
          shopName: selectedShop.shopName || '',
          phoneNumber: selectedShop.phoneNumber || selectedShop.accountValue || selectedShop.email || '',
          accountValue: selectedShop.accountValue || selectedShop.phoneNumber || selectedShop.email || '',
          email: selectedShop.email || '',
          accountType: selectedShop.accountType || '',
          shopUpdatedAt: selectedShop.updatedAt || '',
          proxyConfig: selectedShop.proxyConfig || {},
          fingerprintConfig: selectedShop.fingerprintConfig || {},
          pageType,
          browserTabId: pageState.activeBrowserTabId
        });

        if (result && result.message) {
          showTabStatus({
            message: result.message,
            durationMs: 3200
          });
        }
      } catch (error) {
        showTabStatus({
          message: error && error.message
            ? error.message
            : '\u91CD\u65B0\u6253\u5F00\u767B\u5F55\u9875\u5931\u8D25\u3002',
          persistent: true
        });
      }
    }

    function closeBrowserTab(pageType, browserTabId) {
      const selectedShop = getSelectedShop();

      if (!selectedShop || !browserTabId) {
        return;
      }

      const pageState = ensureActiveBrowserTab(selectedShop.id, pageType);
      const tabIndex = pageState.tabs.findIndex((tab) => tab.id === browserTabId);

      if (tabIndex < 0 || pageState.tabs.length <= 1) {
        return;
      }

      const wasActive = pageState.activeBrowserTabId === browserTabId;
      pageState.tabs.splice(tabIndex, 1);

      if (pageState.tabs.length === 0) {
        const defaultTab = createDefaultBrowserTab(pageType);
        pageState.tabs = [defaultTab];
        pageState.activeBrowserTabId = defaultTab.id;
      } else if (wasActive) {
        const fallbackTab = pageState.tabs[Math.max(0, tabIndex - 1)] || pageState.tabs[0];
        pageState.activeBrowserTabId = fallbackTab.id;
      }

      updateClosableState(pageState);
      render();
      getBridge().closeBrowserTab({
        shopId: selectedShop.id,
        pageType,
        browserTabId
      });
    }

    async function handleBrowserTabListClick(event) {
      const closeButton = event.target.closest('[data-browser-tab-close]');

      if (closeButton) {
        closeBrowserTab(
          closeButton.dataset.browserTabPageType || 'seller-center',
          closeButton.dataset.browserTabClose || ''
        );
        return;
      }

      const tabButton = event.target.closest('[data-browser-tab-button]');

      if (!tabButton) {
        return;
      }

      const selectedShop = getSelectedShop();
      const pageType = tabButton.dataset.browserTabPageType || 'seller-center';

      if (!selectedShop) {
        return;
      }

      await openWorkspaceAfterStorageRestore(selectedShop.id, pageType, {
        browserTabId: tabButton.dataset.browserTabButton || defaultBrowserTabId,
        restoreReason: 'browser-tab-selected',
        syncReason: 'browser-tab-selected'
      });
    }

    async function handleBrowserHostClick(event) {
      const openButton = event.target.closest('[data-open-browser-page-type]');

      if (!openButton) {
        return;
      }

      const selectedShop = getSelectedShop();
      const pageType = openButton.dataset.openBrowserPageType || '';

      if (!selectedShop || !pageType) {
        return;
      }

      await openWorkspaceAfterStorageRestore(selectedShop.id, pageType, {
        restoreReason: 'workspace-open-intent',
        syncReason: 'workspace-opened'
      });
    }

    function upsertBrowserTab(shopId, pageType, browserTab) {
      if (!shopId || !pageType || !browserTab || !browserTab.id) {
        return null;
      }

      const pageState = ensurePageBrowserState(shopId, pageType);
      const existedTab = pageState.tabs.find((tab) => tab.id === browserTab.id) || null;

      if (existedTab) {
        existedTab.title = String(browserTab.title || existedTab.title || '').trim() || existedTab.title;
        existedTab.url = String(browserTab.url || existedTab.url || '').trim();
        updateClosableState(pageState);
        return pageState;
      }

      if (pageState.tabs.length >= maxBrowserTabs) {
        return pageState;
      }

      pageState.tabs.push({
        id: browserTab.id,
        title:
          String(browserTab.title || '').trim() ||
          `${tabLabels[pageType] || '\u65B0\u6807\u7B7E'} ${pageState.tabs.length + 1}`,
        url: String(browserTab.url || '').trim(),
        closable: true
      });
      pageState.activeBrowserTabId = browserTab.id;
      updateClosableState(pageState);
      return pageState;
    }

    function handleBrowserTabCreated(payload) {
      const shopId = String(payload && payload.shopId || '').trim();
      const pageType = String(payload && payload.pageType || '').trim();
      const pageState = upsertBrowserTab(shopId, pageType, payload && payload.tab);

      if (!pageState) {
        return;
      }

      pageState.activeBrowserTabId = payload && payload.tab && payload.tab.id
        ? payload.tab.id
        : pageState.activeBrowserTabId;
      render();

      if (shopId === String(getViewState().selectedShopId || '').trim()) {
        scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-created');
      }
    }

    function handleBrowserTabClosed(payload) {
      const shopId = String(payload && payload.shopId || '').trim();
      const pageType = String(payload && payload.pageType || '').trim();
      const browserTabId = String(payload && payload.browserTabId || '').trim();
      const activateBrowserTabId = String(payload && payload.activateBrowserTabId || '').trim();

      if (!shopId || !pageType || !browserTabId) {
        return;
      }

      const pageState = ensurePageBrowserState(shopId, pageType);
      const tabIndex = pageState.tabs.findIndex((tab) => tab.id === browserTabId);

      if (tabIndex < 0) {
        return;
      }

      const wasActive = pageState.activeBrowserTabId === browserTabId;

      pageState.tabs.splice(tabIndex, 1);

      if (pageState.tabs.length === 0) {
        const defaultTab = createDefaultBrowserTab(pageType);

        pageState.tabs = [defaultTab];
        pageState.activeBrowserTabId = defaultTab.id;
      } else if (activateBrowserTabId && pageState.tabs.some((tab) => tab.id === activateBrowserTabId)) {
        pageState.activeBrowserTabId = activateBrowserTabId;
      } else if (wasActive) {
        const fallbackTab = pageState.tabs[Math.max(0, tabIndex - 1)] || pageState.tabs[0];

        pageState.activeBrowserTabId = fallbackTab.id;
      }

      updateClosableState(pageState);
      render();

      if (shopId === String(getViewState().selectedShopId || '').trim()) {
        scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-closed');
      }
    }

    function handleBrowserTabUpdated(payload) {
      const shopId = String(payload && payload.shopId || '').trim();
      const pageType = String(payload && payload.pageType || '').trim();
      const browserTab = payload && payload.tab;

      if (!shopId || !pageType || !browserTab || !browserTab.id) {
        return;
      }

      const pageState = ensurePageBrowserState(shopId, pageType);
      const tab = pageState.tabs.find((item) => item.id === browserTab.id) || null;

      if (!tab) {
        return;
      }

      tab.title = String(browserTab.title || tab.title || '').trim() || tab.title;
      tab.url = String(browserTab.url || tab.url || '').trim();
      render({
        syncWorkspace: false
      });

      if (shopId === String(getViewState().selectedShopId || '').trim()) {
        scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-updated');
      }
    }

    function handleBrowserTabReset(payload) {
      const shopId = String(payload && payload.shopId || '').trim();
      const pageTypes = Array.isArray(payload && payload.pageTypes)
        ? payload.pageTypes.map((pageType) => String(pageType || '').trim()).filter(Boolean)
        : [];

      if (!shopId || pageTypes.length === 0) {
        return;
      }

      const viewState = getViewState();

      if (!viewState.browserTabsByShopId[shopId]) {
        viewState.browserTabsByShopId[shopId] = {};
      }

      pageTypes.forEach((pageType) => {
        const previousPageState = viewState.browserTabsByShopId[shopId][pageType];
        const nextPageState = ensurePageBrowserState('', pageType);

        if (previousPageState && previousPageState.opened === true) {
          nextPageState.opened = true;
        }

        viewState.browserTabsByShopId[shopId][pageType] = nextPageState;
      });

      render({
        syncWorkspace: false
      });

      if (shopId === String(getViewState().selectedShopId || '').trim()) {
        scheduleAutoBrowserStorageUpload(shopId, 'browser-tab-reset');
      }
    }

    function bindWorkspaceButtons() {
      const elements = getElements();

      elements.workspaceButtons.forEach((button) => {
        button.addEventListener('click', () => {
          void handleWorkspaceButtonClick(button);
          onWorkspaceTabChanged();
        });
        button.addEventListener('dblclick', () => {
          void handleWorkspaceButtonDoubleClick(button);
        });
      });
    }

    return {
      handleWorkspaceButtonClick,
      handleWorkspaceButtonDoubleClick,
      bindWorkspaceButtons,
      renderWorkspaceTabs,
      renderBrowserTabs,
      renderBrowserHosts,
      handleBrowserTabListClick,
      handleBrowserHostClick,
      handleBrowserTabCreated,
      handleBrowserTabClosed,
      handleBrowserTabUpdated,
      handleBrowserTabReset
    };
  };
})();
