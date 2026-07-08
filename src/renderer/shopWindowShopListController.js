(() => {
  window.createShopWindowShopListController = function createShopWindowShopListController(options) {
    const getElements = options.getElements;
    const getViewState = options.getViewState;
    const getVisibleShops = options.getVisibleShops;
    const normalizeText = options.normalizeText;
    const escapeHtml = options.escapeHtml;
    const ensurePageBrowserState = options.ensurePageBrowserState;
    const ensureActiveBrowserTab = options.ensureActiveBrowserTab;
    const getBrowserTabById = options.getBrowserTabById;
    const isAutoLoginEnabled = options.isAutoLoginEnabled;
    const clearBrowserStorageAutoSyncUploadTimer = options.clearBrowserStorageAutoSyncUploadTimer;
    const clearBrowserStorageAutoSyncRetryTimer = options.clearBrowserStorageAutoSyncRetryTimer;
    const clearBrowserStorageAutoSyncDeferredRestoreTimer =
      options.clearBrowserStorageAutoSyncDeferredRestoreTimer;
    const hideTabStatus = options.hideTabStatus;
    const render = options.render;
    const refreshBrowserStorageSyncState = options.refreshBrowserStorageSyncState;
    const kickOffAutoBrowserStorageSync = options.kickOffAutoBrowserStorageSync;
    const emptyStateHtml = options.emptyStateHtml;
    const ungroupedFilterValue = options.ungroupedFilterValue;
    const tabLabels = options.tabLabels;

    const groupFilterCache = {
      element: null,
      html: '',
      signature: ''
    };
    const shopListCache = {
      element: null,
      html: '',
      signature: ''
    };

    function setInnerHtmlIfChanged(element, html, cache) {
      if (cache.element !== element || cache.html !== html) {
        element.innerHTML = html;
        cache.element = element;
        cache.html = html;
      }
    }

    function setTextIfChanged(element, text) {
      if (element.textContent !== text) {
        element.textContent = text;
      }
    }

    function setCheckedIfChanged(element, checked) {
      if (element.checked !== checked) {
        element.checked = checked;
      }
    }

    function setDisabledIfChanged(element, disabled) {
      if (element.disabled !== disabled) {
        element.disabled = disabled;
      }
    }

    function buildGroupOptionsSignature(options) {
      return options
        .map((option) => `${option.value}\u0001${option.label}`)
        .join('\u0002');
    }

    function buildShopListSignature(visibleShops) {
      const viewState = getViewState();

      if (viewState.shops.length === 0) {
        return [
          'empty',
          viewState.allShops.length,
          visibleShops.length,
          viewState.selectedGroupFilterId
        ].join('\u0001');
      }

      return [
        'items',
        viewState.selectedShopId,
        ...viewState.shops.map((shop) => [
          shop && shop.id,
          shop && shop.shopName,
          shop && shop.groupId,
          shop && shop.groupName,
          shop && shop.note
        ].map(normalizeText).join('\u0002'))
      ].join('\u0001');
    }

    function getSelectedShop() {
      const viewState = getViewState();

      return viewState.shops.find((shop) => shop.id === viewState.selectedShopId) || null;
    }

    function getShopGroupName(shop) {
      return normalizeText(shop && shop.groupName) || '\u672A\u5206\u7EC4';
    }

    function getShopNoteText(shop) {
      return normalizeText(shop && shop.note) || '-';
    }

    function matchesSelectedGroupFilter(shop) {
      const viewState = getViewState();

      if (!viewState.selectedGroupFilterId) {
        return true;
      }

      const groupId = normalizeText(shop && shop.groupId);

      if (viewState.selectedGroupFilterId === ungroupedFilterValue) {
        return !groupId;
      }

      return groupId === viewState.selectedGroupFilterId;
    }

    function buildGroupFilterOptions() {
      const viewState = getViewState();
      const options = [
        {
          value: '',
          label: '\u5168\u90E8\u5206\u7EC4'
        }
      ];
      const ungroupedExists = getVisibleShops().some((shop) => !normalizeText(shop && shop.groupId));

      viewState.groups.forEach((group) => {
        const groupId = normalizeText(group && group.id);
        const groupName = normalizeText(group && group.name);

        if (!groupId || !groupName) {
          return;
        }

        options.push({
          value: groupId,
          label: groupName
        });
      });

      if (ungroupedExists) {
        options.push({
          value: ungroupedFilterValue,
          label: '\u672A\u5206\u7EC4'
        });
      }

      return options;
    }

    function isSelectedGroupFilterValid(options = buildGroupFilterOptions()) {
      const viewState = getViewState();

      if (!viewState.selectedGroupFilterId) {
        return true;
      }

      return options.some((option) => option.value === viewState.selectedGroupFilterId);
    }

    function syncFilteredShops() {
      const viewState = getViewState();
      const options = buildGroupFilterOptions();

      if (!isSelectedGroupFilterValid(options)) {
        viewState.selectedGroupFilterId = '';
      }

      viewState.shops = getVisibleShops().filter((shop) => matchesSelectedGroupFilter(shop));
    }

    function syncSelectedShop() {
      const viewState = getViewState();

      if (viewState.shops.length === 0) {
        viewState.selectedShopId = '';
        return;
      }

      const hasSelected = viewState.shops.some((shop) => shop.id === viewState.selectedShopId);

      if (!hasSelected) {
        viewState.selectedShopId = viewState.shops[0].id;
      }

      ensurePageBrowserState(viewState.selectedShopId, 'seller-center');
      ensurePageBrowserState(viewState.selectedShopId, 'product-promotion');
      ensureActiveBrowserTab(viewState.selectedShopId, viewState.activeWorkspaceTab);
    }

    function renderGroupFilterOptions() {
      const elements = getElements();
      const viewState = getViewState();
      const options = buildGroupFilterOptions();
      const signature = buildGroupOptionsSignature(options);
      let nextHtml = groupFilterCache.html;

      if (!isSelectedGroupFilterValid(options)) {
        viewState.selectedGroupFilterId = '';
      }

      if (groupFilterCache.signature !== signature) {
        nextHtml = options
          .map(
            (option) => `
              <option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>
            `
          )
          .join('');
      }

      setInnerHtmlIfChanged(elements.groupFilterSelect, nextHtml, groupFilterCache);
      groupFilterCache.signature = signature;

      if (elements.groupFilterSelect.value !== viewState.selectedGroupFilterId) {
        elements.groupFilterSelect.value = viewState.selectedGroupFilterId;
      }

      setDisabledIfChanged(elements.groupFilterSelect, options.length <= 1);
    }

    function renderShopList() {
      const elements = getElements();
      const viewState = getViewState();
      const visibleShops = viewState.shops.length === 0 ? getVisibleShops() : [];
      const signature = buildShopListSignature(visibleShops);
      let nextHtml = '';

      if (shopListCache.element === elements.list && shopListCache.signature === signature) {
        return;
      }

      if (viewState.shops.length === 0) {
        if (visibleShops.length === 0) {
          nextHtml = viewState.allShops.length > 0
            ? `
            <div class="shop-window-empty">
              <p class="shop-window-empty-title">\u6682\u65E0\u53EF\u663E\u793A\u5E97\u94FA</p>
              <p class="shop-window-empty-text">
                \u5F53\u524D\u5E97\u94FA\u90FD\u5DF2\u8BBE\u4E3A\u9690\u85CF\uFF0C\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u91CC\u52FE\u9009\u663E\u793A\u3002
              </p>
            </div>
          `
            : emptyStateHtml;
          shopListCache.signature = signature;
          setInnerHtmlIfChanged(elements.list, nextHtml, shopListCache);
          return;
        }

        nextHtml = viewState.selectedGroupFilterId
          ? `
            <div class="shop-window-empty">
              <p class="shop-window-empty-title">\u5F53\u524D\u5206\u7EC4\u6682\u65E0\u5E97\u94FA</p>
              <p class="shop-window-empty-text">
                \u8BF7\u5207\u6362\u5176\u4ED6\u5206\u7EC4\u7B5B\u9009\uFF0C\u6216\u8005\u5148\u8C03\u6574\u5E97\u94FA\u5206\u7EC4\u3002
              </p>
            </div>
          `
          : emptyStateHtml;
        shopListCache.signature = signature;
        setInnerHtmlIfChanged(elements.list, nextHtml, shopListCache);
        return;
      }

      nextHtml = viewState.shops
        .map((shop) => {
          const isActive = shop.id === viewState.selectedShopId;
          const groupText = getShopGroupName(shop);
          const noteText = getShopNoteText(shop);

          return `
            <button
              class="shop-window-item ${isActive ? 'is-active' : ''}"
              type="button"
              data-shop-window-item="${escapeHtml(shop.id)}"
            >
              <p class="shop-window-item-name">${escapeHtml(shop.shopName || '-')}</p>
              <p class="shop-window-item-meta">\u5206\u7EC4\uFF1A${escapeHtml(groupText)}</p>
              <p class="shop-window-item-note">\u5907\u6CE8\uFF1A${escapeHtml(noteText)}</p>
            </button>
          `;
        })
        .join('');

      shopListCache.signature = signature;
      setInnerHtmlIfChanged(elements.list, nextHtml, shopListCache);
    }

    function renderCurrentShop() {
      const elements = getElements();
      const viewState = getViewState();
      const selectedShop = getSelectedShop();
      const workspaceLabel = tabLabels[viewState.activeWorkspaceTab] || tabLabels['seller-center'];

      if (!selectedShop) {
        setTextIfChanged(elements.currentShopName, '\u8BF7\u9009\u62E9\u5E97\u94FA');
        setTextIfChanged(
          elements.currentShopMeta,
          '\u5DE6\u4FA7\u9009\u62E9\u5E97\u94FA\u540E\uFF0C\u5728\u8FD9\u91CC\u5207\u6362\u5DE5\u4F5C\u533A\u3002'
        );
        setCheckedIfChanged(elements.autoLoginCheckbox, true);
        setDisabledIfChanged(elements.autoLoginCheckbox, true);
        return;
      }

      const pageState = ensureActiveBrowserTab(selectedShop.id, viewState.activeWorkspaceTab);
      const activeBrowserTab = getBrowserTabById(pageState, pageState.activeBrowserTabId);
      const tabTitle = activeBrowserTab ? activeBrowserTab.title : `${workspaceLabel} 1`;
      const currentShopName = selectedShop.shopName || '\u672A\u547D\u540D\u5E97\u94FA';
      const currentShopMeta =
        `${workspaceLabel} | ${tabTitle} | ${selectedShop.groupName || '\u672A\u5206\u7EC4'}`;

      setTextIfChanged(elements.currentShopName, currentShopName);
      setTextIfChanged(elements.currentShopMeta, currentShopMeta);
      setCheckedIfChanged(
        elements.autoLoginCheckbox,
        isAutoLoginEnabled(selectedShop.id, viewState.activeWorkspaceTab)
      );
      setDisabledIfChanged(elements.autoLoginCheckbox, false);
    }

    function handleShopListClick(event) {
      const itemButton = event.target.closest('[data-shop-window-item]');

      if (!itemButton) {
        return;
      }

      const viewState = getViewState();
      const previousShopId = normalizeText(viewState.selectedShopId);

      viewState.selectedShopId = itemButton.dataset.shopWindowItem || '';
      clearBrowserStorageAutoSyncUploadTimer(previousShopId);
      clearBrowserStorageAutoSyncRetryTimer(previousShopId);
      clearBrowserStorageAutoSyncDeferredRestoreTimer(previousShopId);
      hideTabStatus();
      render();
      void refreshBrowserStorageSyncState(viewState.selectedShopId);
      void kickOffAutoBrowserStorageSync('shop-selected');
    }

    function handleGroupFilterChange() {
      const elements = getElements();
      const viewState = getViewState();
      const previousShopId = normalizeText(viewState.selectedShopId);

      viewState.selectedGroupFilterId = normalizeText(elements.groupFilterSelect.value);
      clearBrowserStorageAutoSyncUploadTimer(previousShopId);
      clearBrowserStorageAutoSyncRetryTimer(previousShopId);
      clearBrowserStorageAutoSyncDeferredRestoreTimer(previousShopId);
      hideTabStatus();
      syncFilteredShops();
      render();
      void kickOffAutoBrowserStorageSync('group-filter-changed');
    }

    return {
      getSelectedShop,
      getShopGroupName,
      getShopNoteText,
      matchesSelectedGroupFilter,
      buildGroupFilterOptions,
      isSelectedGroupFilterValid,
      syncFilteredShops,
      syncSelectedShop,
      renderGroupFilterOptions,
      renderShopList,
      renderCurrentShop,
      handleShopListClick,
      handleGroupFilterChange
    };
  };
})();
