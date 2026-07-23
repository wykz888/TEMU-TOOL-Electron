import { reactive } from 'vue';

export function createShopListView() {
  const state = reactive({
    autoLoginChecked: true,
    autoLoginDisabled: true,
    currentShopMeta: '\u8BF7\u5728\u5DE6\u4FA7\u9009\u62E9\u5E97\u94FA\u3002',
    currentShopName: '\u8BF7\u9009\u62E9\u5E97\u94FA',
    emptyMode: 'empty',
    emptyText: '\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u91CC\u65B0\u589E\u5E97\u94FA\u3002',
    emptyTitle: '\u6682\u65E0\u5E97\u94FA',
    groupFilterDisabled: true,
    groupFilterValue: '',
    groupOptions: [
      {
        label: '\u5168\u90E8\u5206\u7EC4',
        value: ''
      }
    ],
    searchKeyword: '',
    selectedShopId: '',
    shops: []
  });
  const runtime = {
    clearBrowserStorageAutoSyncDeferredRestoreTimer() {},
    clearBrowserStorageAutoSyncRetryTimer() {},
    clearBrowserStorageAutoSyncUploadTimer() {},
    createEmptyBrowserStorageAutoSyncRuntime() {
      return null;
    },
    ensureActiveBrowserTab() {
      return null;
    },
    ensurePageBrowserState() {
      return null;
    },
    getBrowserTabById() {
      return null;
    },
    getViewState() {
      return {
        activeWorkspaceTab: 'seller-center',
        allShops: [],
        groups: [],
        selectedGroupFilterId: '',
        shopSearchKeyword: '',
        selectedShopId: '',
        shops: []
      };
    },
    getVisibleShops() {
      return [];
    },
    hideTabStatus() {},
    isAutoLoginEnabled() {
      return false;
    },
    kickOffAutoBrowserStorageSync() {},
    normalizeText(value) {
      return value == null ? '' : String(value).trim();
    },
    refreshBrowserStorageSyncState() {},
    render() {},
    scheduleWorkspaceSync() {},
    setAutoLoginPreference() {
      return false;
    },
    showTabStatus() {},
    tabLabels: {
      'product-promotion': '\u5546\u54C1\u63A8\u5E7F',
      'seller-center': '\u5356\u5BB6\u4E2D\u5FC3'
    }
  };
  const ungroupedFilterValue = '__ungrouped__';

  function normalizeText(value) {
    return runtime.normalizeText(value);
  }

  function getViewState() {
    return runtime.getViewState();
  }

  function getVisibleShops() {
    const shops = runtime.getVisibleShops();

    return Array.isArray(shops) ? shops : [];
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

  function buildShopSearchText(shop) {
    return [
      shop && shop.shopName,
      shop && shop.note,
      shop && shop.groupName,
      shop && shop.accountValue,
      shop && shop.phoneNumber,
      shop && shop.email,
      shop && shop.accountType
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean)
      .join(' ');
  }

  function matchesShopSearch(shop) {
    const viewState = getViewState();
    const keyword = normalizeText(viewState.shopSearchKeyword).toLowerCase();

    if (!keyword) {
      return true;
    }

    return buildShopSearchText(shop).includes(keyword);
  }

  function buildGroupFilterOptions() {
    const viewState = getViewState();
    const options = [
      {
        label: '\u5168\u90E8\u5206\u7EC4',
        value: ''
      }
    ];
    const ungroupedExists = getVisibleShops().some((shop) => !normalizeText(shop && shop.groupId));

    (Array.isArray(viewState.groups) ? viewState.groups : []).forEach((group) => {
      const groupId = normalizeText(group && group.id);
      const groupName = normalizeText(group && group.name);

      if (!groupId || !groupName) {
        return;
      }

      options.push({
        label: groupName,
        value: groupId
      });
    });

    if (ungroupedExists) {
      options.push({
        label: '\u672A\u5206\u7EC4',
        value: ungroupedFilterValue
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

    viewState.shops = getVisibleShops()
      .filter((shop) => matchesSelectedGroupFilter(shop) && matchesShopSearch(shop));
    return viewState.shops;
  }

  function syncSelectedShop() {
    const viewState = getViewState();

    if (!Array.isArray(viewState.shops) || viewState.shops.length === 0) {
      viewState.selectedShopId = '';
      return null;
    }

    const hasSelected = viewState.shops.some((shop) => shop.id === viewState.selectedShopId);

    if (!hasSelected) {
      viewState.selectedShopId = viewState.shops[0].id;
    }

    runtime.ensurePageBrowserState(viewState.selectedShopId, 'seller-center');
    runtime.ensurePageBrowserState(viewState.selectedShopId, 'product-promotion');
    runtime.ensureActiveBrowserTab(viewState.selectedShopId, viewState.activeWorkspaceTab);
    return getSelectedShop();
  }

  function buildShopItems() {
    const viewState = getViewState();

    return (Array.isArray(viewState.shops) ? viewState.shops : []).map((shop) => ({
      groupText: getShopGroupName(shop),
      id: normalizeText(shop && shop.id),
      isActive: normalizeText(shop && shop.id) === normalizeText(viewState.selectedShopId),
      name: normalizeText(shop && shop.shopName) || '-',
      noteText: getShopNoteText(shop)
    }));
  }

  function applyEmptyState() {
    const viewState = getViewState();
    const visibleShops = viewState.shops.length === 0 ? getVisibleShops() : [];

    if (viewState.shops.length > 0) {
      state.emptyMode = 'none';
      state.emptyTitle = '';
      state.emptyText = '';
      return;
    }

    if (visibleShops.length === 0) {
      if (Array.isArray(viewState.allShops) && viewState.allShops.length > 0) {
        state.emptyMode = 'hidden';
        state.emptyTitle = '\u6682\u65E0\u53EF\u663E\u793A\u5E97\u94FA';
        state.emptyText =
          '\u5F53\u524D\u5E97\u94FA\u90FD\u5DF2\u8BBE\u4E3A\u9690\u85CF\uFF0C\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u91CC\u52FE\u9009\u663E\u793A\u3002';
      } else {
        state.emptyMode = 'empty';
        state.emptyTitle = '\u6682\u65E0\u5E97\u94FA';
        state.emptyText =
          '\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u91CC\u65B0\u589E\u5E97\u94FA\u3002';
      }

      return;
    }

    if (normalizeText(viewState.shopSearchKeyword)) {
      state.emptyMode = 'filtered';
      state.emptyTitle = '\u6682\u65E0\u5339\u914D\u5E97\u94FA';
      state.emptyText = '\u8BF7\u6362\u4E00\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u6E05\u7A7A\u641C\u7D22\u540E\u518D\u8BD5\u3002';
      return;
    }

    if (viewState.selectedGroupFilterId) {
      state.emptyMode = 'filtered';
      state.emptyTitle = '\u5F53\u524D\u5206\u7EC4\u6682\u65E0\u5E97\u94FA';
      state.emptyText =
        '\u8BF7\u5207\u6362\u5176\u4ED6\u5206\u7EC4\u7B5B\u9009\uFF0C\u6216\u8005\u5148\u8C03\u6574\u5E97\u94FA\u5206\u7EC4\u3002';
      return;
    }

    state.emptyMode = 'empty';
    state.emptyTitle = '\u6682\u65E0\u5E97\u94FA';
    state.emptyText =
      '\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u91CC\u65B0\u589E\u5E97\u94FA\u3002';
  }

  function renderGroupFilterOptions() {
    const viewState = getViewState();
    const options = buildGroupFilterOptions();

    if (!isSelectedGroupFilterValid(options)) {
      viewState.selectedGroupFilterId = '';
    }

    state.groupOptions = options;
    state.groupFilterValue = viewState.selectedGroupFilterId;
    state.groupFilterDisabled = options.length <= 1;
  }

  function renderShopList() {
    const viewState = getViewState();

    state.selectedShopId = normalizeText(viewState.selectedShopId);
    state.searchKeyword = normalizeText(viewState.shopSearchKeyword);
    state.shops = buildShopItems();
    applyEmptyState();
  }

  function renderCurrentShop() {
    const viewState = getViewState();
    const selectedShop = getSelectedShop();
    if (!selectedShop) {
      state.currentShopName = '\u8BF7\u9009\u62E9\u5E97\u94FA';
      state.currentShopMeta =
        '\u8BF7\u5728\u5DE6\u4FA7\u9009\u62E9\u5E97\u94FA\u3002';
      state.autoLoginChecked = true;
      state.autoLoginDisabled = true;
      return;
    }

    runtime.ensureActiveBrowserTab(selectedShop.id, viewState.activeWorkspaceTab);

    state.currentShopName = normalizeText(selectedShop.shopName) || '\u672A\u547D\u540D\u5E97\u94FA';
    const groupName = normalizeText(selectedShop.groupName) || '\u672A\u5206\u7EC4';
    const noteText = normalizeText(selectedShop.note);
    state.currentShopMeta = noteText
      ? `\u5206\u7EC4\uFF1A${groupName} | \u5907\u6CE8\uFF1A${noteText}`
      : `\u5206\u7EC4\uFF1A${groupName}`;
    state.autoLoginChecked = runtime.isAutoLoginEnabled(selectedShop.id, viewState.activeWorkspaceTab);
    state.autoLoginDisabled = false;
  }

  function clearTimersForShop(shopId) {
    runtime.clearBrowserStorageAutoSyncUploadTimer(shopId);
    runtime.clearBrowserStorageAutoSyncRetryTimer(shopId);
    runtime.clearBrowserStorageAutoSyncDeferredRestoreTimer(shopId);
  }

  function handleShopListClick(input) {
    const viewState = getViewState();
    const previousShopId = normalizeText(viewState.selectedShopId);
    let nextShopId = '';

    if (input && typeof input === 'object' && input.target && typeof input.target.closest === 'function') {
      const itemButton = input.target.closest('[data-shop-window-item]');
      if (itemButton) {
        nextShopId = itemButton.dataset.shopWindowItem || '';
      }
    } else {
      nextShopId = normalizeText(input);
    }

    if (!nextShopId) {
      return;
    }

    viewState.selectedShopId = nextShopId;
    clearTimersForShop(previousShopId);
    runtime.hideTabStatus();
    runtime.render();
    void runtime.refreshBrowserStorageSyncState(viewState.selectedShopId);
    void runtime.kickOffAutoBrowserStorageSync('shop-selected');
  }

  function handleGroupFilterChange(input) {
    const viewState = getViewState();
    const previousShopId = normalizeText(viewState.selectedShopId);
    const nextValue =
      input && typeof input === 'object' && input.target
        ? normalizeText(input.target.value)
        : normalizeText(input);

    viewState.selectedGroupFilterId = nextValue;
    clearTimersForShop(previousShopId);
    runtime.hideTabStatus();
    syncFilteredShops();
    runtime.render();
    void runtime.kickOffAutoBrowserStorageSync('group-filter-changed');
  }

  function handleShopSearchInput(input) {
    const viewState = getViewState();
    const previousShopId = normalizeText(viewState.selectedShopId);
    const nextKeyword =
      input && typeof input === 'object' && input.target
        ? normalizeText(input.target.value)
        : normalizeText(input);

    if (normalizeText(viewState.shopSearchKeyword) === nextKeyword) {
      return;
    }

    viewState.shopSearchKeyword = nextKeyword;
    runtime.hideTabStatus();
    syncFilteredShops();
    runtime.render();

    if (previousShopId !== normalizeText(viewState.selectedShopId)) {
      clearTimersForShop(previousShopId);
      void runtime.kickOffAutoBrowserStorageSync('shop-search-changed');
    }
  }

  function handleAutoLoginToggleChange(input) {
    const selectedShop = getSelectedShop();

    if (!selectedShop) {
      state.autoLoginChecked = true;
      state.autoLoginDisabled = true;
      return;
    }

    const checked =
      input && typeof input === 'object' && input.target
        ? input.target.checked === true
        : input === true;
    const enabled = runtime.setAutoLoginPreference(
      selectedShop.id,
      getViewState().activeWorkspaceTab,
      checked
    );

    state.autoLoginChecked = enabled === true;
    runtime.showTabStatus({
      message: enabled
        ? '\u5DF2\u5F00\u542F\u81EA\u52A8\u767B\u5F55\u3002'
        : '\u5DF2\u5173\u95ED\u81EA\u52A8\u767B\u5F55\u3002',
      durationMs: 2200
    });
    runtime.scheduleWorkspaceSync();
  }

  function configure(options = {}) {
    runtime.clearBrowserStorageAutoSyncDeferredRestoreTimer =
      typeof options.clearBrowserStorageAutoSyncDeferredRestoreTimer === 'function'
        ? options.clearBrowserStorageAutoSyncDeferredRestoreTimer
        : runtime.clearBrowserStorageAutoSyncDeferredRestoreTimer;
    runtime.clearBrowserStorageAutoSyncRetryTimer =
      typeof options.clearBrowserStorageAutoSyncRetryTimer === 'function'
        ? options.clearBrowserStorageAutoSyncRetryTimer
        : runtime.clearBrowserStorageAutoSyncRetryTimer;
    runtime.clearBrowserStorageAutoSyncUploadTimer =
      typeof options.clearBrowserStorageAutoSyncUploadTimer === 'function'
        ? options.clearBrowserStorageAutoSyncUploadTimer
        : runtime.clearBrowserStorageAutoSyncUploadTimer;
    runtime.createEmptyBrowserStorageAutoSyncRuntime =
      typeof options.createEmptyBrowserStorageAutoSyncRuntime === 'function'
        ? options.createEmptyBrowserStorageAutoSyncRuntime
        : runtime.createEmptyBrowserStorageAutoSyncRuntime;
    runtime.ensureActiveBrowserTab =
      typeof options.ensureActiveBrowserTab === 'function'
        ? options.ensureActiveBrowserTab
        : runtime.ensureActiveBrowserTab;
    runtime.ensurePageBrowserState =
      typeof options.ensurePageBrowserState === 'function'
        ? options.ensurePageBrowserState
        : runtime.ensurePageBrowserState;
    runtime.getBrowserTabById =
      typeof options.getBrowserTabById === 'function'
        ? options.getBrowserTabById
        : runtime.getBrowserTabById;
    runtime.getViewState =
      typeof options.getViewState === 'function'
        ? options.getViewState
        : runtime.getViewState;
    runtime.getVisibleShops =
      typeof options.getVisibleShops === 'function'
        ? options.getVisibleShops
        : runtime.getVisibleShops;
    runtime.hideTabStatus =
      typeof options.hideTabStatus === 'function'
        ? options.hideTabStatus
        : runtime.hideTabStatus;
    runtime.isAutoLoginEnabled =
      typeof options.isAutoLoginEnabled === 'function'
        ? options.isAutoLoginEnabled
        : runtime.isAutoLoginEnabled;
    runtime.kickOffAutoBrowserStorageSync =
      typeof options.kickOffAutoBrowserStorageSync === 'function'
        ? options.kickOffAutoBrowserStorageSync
        : runtime.kickOffAutoBrowserStorageSync;
    runtime.normalizeText =
      typeof options.normalizeText === 'function'
        ? options.normalizeText
        : runtime.normalizeText;
    runtime.refreshBrowserStorageSyncState =
      typeof options.refreshBrowserStorageSyncState === 'function'
        ? options.refreshBrowserStorageSyncState
        : runtime.refreshBrowserStorageSyncState;
    runtime.render =
      typeof options.render === 'function'
        ? options.render
        : runtime.render;
    runtime.scheduleWorkspaceSync =
      typeof options.scheduleWorkspaceSync === 'function'
        ? options.scheduleWorkspaceSync
        : runtime.scheduleWorkspaceSync;
    runtime.setAutoLoginPreference =
      typeof options.setAutoLoginPreference === 'function'
        ? options.setAutoLoginPreference
        : runtime.setAutoLoginPreference;
    runtime.showTabStatus =
      typeof options.showTabStatus === 'function'
        ? options.showTabStatus
        : runtime.showTabStatus;
    runtime.tabLabels =
      options.tabLabels && typeof options.tabLabels === 'object'
        ? options.tabLabels
        : runtime.tabLabels;
  }

  return {
    buildGroupFilterOptions,
    configure,
    getSelectedShop,
    getShopGroupName,
    getShopNoteText,
    handleAutoLoginToggleChange,
    handleGroupFilterChange,
    handleShopSearchInput,
    handleShopListClick,
    isSelectedGroupFilterValid,
    matchesSelectedGroupFilter,
    renderCurrentShop,
    renderGroupFilterOptions,
    renderShopList,
    state,
    syncFilteredShops,
    syncSelectedShop
  };
}
