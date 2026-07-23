import { reactive } from 'vue';

export function createStorageSyncStatusView() {
  const state = reactive({
    shellClassName: '',
    badgeText: '\u540C\u6B65\u5DF2\u5173',
    hintText: '\u8BBE\u7F6E',
    summaryText: '\u767B\u5F55\u72B6\u6001\u4F1A\u81EA\u52A8\u4FDD\u6301\u3002',
    summaryTitle: ''
  });
  const runtime = {
    createEmptyBrowserStorageAutoSyncRuntime: () => ({
      lastAutoError: '',
      lastAutoErrorAt: '',
      lastUploadAt: ''
    }),
    formatTimestamp(value) {
      return String(value || '');
    },
    getBrowserStorageAutoSyncRuntime() {
      return runtime.createEmptyBrowserStorageAutoSyncRuntime();
    },
    getBrowserStorageBusyActionForShop() {
      return '';
    },
    getCurrentBrowserStorageSyncState() {
      return {
        cloudSummary: null,
        localSummary: null,
        origins: []
      };
    },
    getSelectedShop() {
      return null;
    },
    isBrowserStorageAutoSyncEnabled() {
      return false;
    },
    isBrowserStorageSyncStateLoading() {
      return false;
    },
    scheduleDeferredWorkspaceSync() {}
  };
  const storageTypeLabels = {};

  function normalizeText(value) {
    return value == null ? '' : String(value).trim();
  }

  function getStorageTypeLabel(typeId) {
    return storageTypeLabels[normalizeText(typeId)] || normalizeText(typeId);
  }

  function buildBrowserStorageSyncTypeSummary(typeId, summary) {
    if (!summary || !summary.types || !summary.types[typeId]) {
      return '';
    }

    const typeSummary = summary.types[typeId];

    if (typeId === 'cookies' || typeId === 'localStorage') {
      return `${getStorageTypeLabel(typeId)} ${typeSummary.originCount || 0} \u4E2A\u6765\u6E90`;
    }

    return `${getStorageTypeLabel(typeId)} ${typeSummary.originCount || 0} \u4E2A\u6765\u6E90 / ${typeSummary.databaseCount || 0} \u4E2A\u5E93`;
  }

  function buildStorageDetailTitle(summaryText, summary, typeSummaryTexts, origins) {
    const lines = [summaryText].filter(Boolean);
    const updatedAt = normalizeText(summary && summary.updatedAt);
    const originTexts = Array.isArray(origins)
      ? origins.map((origin) => normalizeText(origin)).filter(Boolean)
      : [];

    if (updatedAt) {
      lines.push(`\u66F4\u65B0\u65F6\u95F4\uFF1A${runtime.formatTimestamp(updatedAt)}`);
    }

    if (typeSummaryTexts.length > 0) {
      lines.push(...typeSummaryTexts);
    }

    if (originTexts.length > 0) {
      lines.push('', ...originTexts);
    }

    return lines.join('\n');
  }

  function buildStatusModel() {
    const selectedShop = runtime.getSelectedShop();
    const browserStorageSyncState = runtime.getCurrentBrowserStorageSyncState();
    const localSummary = browserStorageSyncState.localSummary;
    const cloudSummary = browserStorageSyncState.cloudSummary;
    const effectiveSummary = cloudSummary || localSummary;
    const runtimeState = selectedShop
      ? runtime.getBrowserStorageAutoSyncRuntime(selectedShop.id)
      : runtime.createEmptyBrowserStorageAutoSyncRuntime();
    const autoSyncEnabled = runtime.isBrowserStorageAutoSyncEnabled(selectedShop);
    const busyAction = selectedShop
      ? runtime.getBrowserStorageBusyActionForShop(selectedShop.id)
      : '';
    const typeSummaryTexts = effectiveSummary
      ? Object.keys(storageTypeLabels)
        .map((typeId) => buildBrowserStorageSyncTypeSummary(typeId, effectiveSummary))
        .filter(Boolean)
      : [];
    let shellClassName = '';
    let badgeText = '\u540C\u6B65\u5DF2\u5173';
    let hintText = '\u8BBE\u7F6E';
    let summaryText =
      '\u767B\u5F55\u72B6\u6001\u4F1A\u81EA\u52A8\u4FDD\u6301\u3002';

    if (!selectedShop) {
      badgeText = '\u8BF7\u9009\u5E97';
      hintText = '\u672A\u542F\u7528';
      summaryText = '\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u3002';
    } else if (!autoSyncEnabled) {
      shellClassName += 'is-disabled';
      badgeText = '\u540C\u6B65\u5DF2\u5173';
      hintText = '\u5E97\u94FA\u8BBE\u7F6E';
      summaryText = '\u5F53\u524D\u5E97\u94FA\u672A\u5F00\u542F\u767B\u5F55\u72B6\u6001\u540C\u6B65\u3002';
    } else if (busyAction === 'auto-restore' || busyAction === 'restore') {
      shellClassName += 'is-busy';
      badgeText = '\u6B63\u5728\u51C6\u5907';
      hintText = '\u7A0D\u5019';
      summaryText = '\u6B63\u5728\u51C6\u5907\u5DE5\u4F5C\u533A\u3002';
    } else if (busyAction === 'auto-upload' || busyAction === 'upload') {
      shellClassName += 'is-busy';
      badgeText = '\u6B63\u5728\u5907\u4EFD';
      hintText = '\u540E\u53F0';
      summaryText = '\u6B63\u5728\u5907\u4EFD\u767B\u5F55\u72B6\u6001\u3002';
    } else if (runtimeState.lastAutoError) {
      shellClassName += 'is-error';
      badgeText = '\u540C\u6B65\u5F02\u5E38';
      hintText = runtimeState.lastAutoErrorAt
        ? '\u7A0D\u540E\u91CD\u8BD5'
        : '\u7A0D\u540E\u91CD\u8BD5';
      summaryText = `\u540C\u6B65\u672A\u6210\u529F\uFF1A${runtimeState.lastAutoError}`;
    } else if (cloudSummary && cloudSummary.updatedAt) {
      shellClassName += 'is-enabled';
      badgeText = '\u767B\u5F55\u5DF2\u51C6\u5907';
      hintText = '\u4E91\u7AEF';
      summaryText = '\u4E91\u7AEF\u767B\u5F55\u72B6\u6001\u5DF2\u51C6\u5907\u3002';
    } else if (localSummary && localSummary.updatedAt) {
      shellClassName += 'is-enabled';
      badgeText = '\u767B\u5F55\u5DF2\u51C6\u5907';
      hintText = '\u672C\u673A';
      summaryText = '\u672C\u673A\u767B\u5F55\u72B6\u6001\u5DF2\u51C6\u5907\u3002';
    } else if (selectedShop && runtime.isBrowserStorageSyncStateLoading(selectedShop.id)) {
      shellClassName += 'is-busy';
      badgeText = '\u6B63\u5728\u8BFB\u53D6';
      hintText = '\u72B6\u6001';
      summaryText = '\u6B63\u5728\u68C0\u67E5\u767B\u5F55\u72B6\u6001\u3002';
    } else {
      shellClassName += 'is-enabled';
      badgeText = '\u81EA\u52A8\u540C\u6B65';
      hintText = runtimeState.lastUploadAt
        ? '\u5DF2\u51C6\u5907'
        : '\u7B49\u5F85\u540C\u6B65';
      summaryText = runtimeState.lastUploadAt
        ? '\u767B\u5F55\u72B6\u6001\u5DF2\u51C6\u5907\u3002'
        : '\u7B49\u5F85\u9996\u6B21\u540C\u6B65\u3002';
    }

    const summaryTitle = buildStorageDetailTitle(
      summaryText,
      effectiveSummary,
      typeSummaryTexts,
      browserStorageSyncState.origins
    );

    return {
      badgeText,
      hintText,
      shellClassName,
      summaryText,
      summaryTitle
    };
  }

  function applyStatusModel(statusModel) {
    const nextShellClassName = normalizeText(statusModel.shellClassName);
    const nextBadgeText = normalizeText(statusModel.badgeText);
    const nextHintText = normalizeText(statusModel.hintText);
    const nextSummaryText = normalizeText(statusModel.summaryText);
    const nextSummaryTitle = normalizeText(statusModel.summaryTitle);
    let changed = false;

    if (state.shellClassName !== nextShellClassName) {
      state.shellClassName = nextShellClassName;
      changed = true;
    }

    if (state.badgeText !== nextBadgeText) {
      state.badgeText = nextBadgeText;
      changed = true;
    }

    if (state.hintText !== nextHintText) {
      state.hintText = nextHintText;
      changed = true;
    }

    if (state.summaryText !== nextSummaryText) {
      state.summaryText = nextSummaryText;
      changed = true;
    }

    if (state.summaryTitle !== nextSummaryTitle) {
      state.summaryTitle = nextSummaryTitle;
      changed = true;
    }

    return changed;
  }

  function configure(options = {}) {
    runtime.createEmptyBrowserStorageAutoSyncRuntime =
      typeof options.createEmptyBrowserStorageAutoSyncRuntime === 'function'
        ? options.createEmptyBrowserStorageAutoSyncRuntime
        : runtime.createEmptyBrowserStorageAutoSyncRuntime;
    runtime.formatTimestamp =
      typeof options.formatTimestamp === 'function'
        ? options.formatTimestamp
        : runtime.formatTimestamp;
    runtime.getBrowserStorageAutoSyncRuntime =
      typeof options.getBrowserStorageAutoSyncRuntime === 'function'
        ? options.getBrowserStorageAutoSyncRuntime
        : runtime.getBrowserStorageAutoSyncRuntime;
    runtime.getBrowserStorageBusyActionForShop =
      typeof options.getBrowserStorageBusyActionForShop === 'function'
        ? options.getBrowserStorageBusyActionForShop
        : runtime.getBrowserStorageBusyActionForShop;
    runtime.getCurrentBrowserStorageSyncState =
      typeof options.getCurrentBrowserStorageSyncState === 'function'
        ? options.getCurrentBrowserStorageSyncState
        : runtime.getCurrentBrowserStorageSyncState;
    runtime.getSelectedShop =
      typeof options.getSelectedShop === 'function'
        ? options.getSelectedShop
        : runtime.getSelectedShop;
    runtime.isBrowserStorageAutoSyncEnabled =
      typeof options.isBrowserStorageAutoSyncEnabled === 'function'
        ? options.isBrowserStorageAutoSyncEnabled
        : runtime.isBrowserStorageAutoSyncEnabled;
    runtime.isBrowserStorageSyncStateLoading =
      typeof options.isBrowserStorageSyncStateLoading === 'function'
        ? options.isBrowserStorageSyncStateLoading
        : runtime.isBrowserStorageSyncStateLoading;
    runtime.scheduleDeferredWorkspaceSync =
      typeof options.scheduleDeferredWorkspaceSync === 'function'
        ? options.scheduleDeferredWorkspaceSync
        : runtime.scheduleDeferredWorkspaceSync;

    if (options.storageTypeLabels && typeof options.storageTypeLabels === 'object') {
      Object.keys(storageTypeLabels).forEach((key) => {
        delete storageTypeLabels[key];
      });
      Object.entries(options.storageTypeLabels).forEach(([key, value]) => {
        storageTypeLabels[key] = value;
      });
    }
  }

  function render() {
    const changed = applyStatusModel(buildStatusModel());

    if (changed) {
      runtime.scheduleDeferredWorkspaceSync(40);
    }

    return changed;
  }

  return {
    configure,
    render,
    state
  };
}
