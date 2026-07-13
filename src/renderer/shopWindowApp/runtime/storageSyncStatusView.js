import { reactive } from 'vue';

export function createStorageSyncStatusView() {
  const state = reactive({
    shellClassName: '',
    badgeText: '\u81EA\u52A8\u540C\u6B65\u5DF2\u5173',
    hintText: '\u5E97\u94FA\u8BBE\u7F6E',
    summaryText:
      '\u5F53\u524D\u5E97\u94FA\u53EF\u5728\u9996\u6B21\u8FDB\u5165\u65F6\u81EA\u52A8\u6062\u590D\u4E91\u7AEF\u5B58\u50A8\uFF0C\u5E76\u5728\u4F7F\u7528\u8FC7\u7A0B\u4E2D\u81EA\u52A8\u4E0A\u4F20\u6700\u65B0\u6D4F\u89C8\u5668\u6570\u636E\u3002',
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
    let badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5173';
    let hintText = '\u5E97\u94FA\u8BBE\u7F6E';
    let summaryText =
      '\u5F53\u524D\u5E97\u94FA\u5728\u9996\u6B21\u6253\u5F00\u5DE5\u4F5C\u533A\u524D\uFF0C\u4F1A\u5148\u68C0\u67E5\u5F53\u524D\u5206\u533A\u7684\u767B\u5F55 Cookies\u3002\u5982\u679C\u672C\u5730\u767B\u5F55\u6001\u4E0D\u5B8C\u6574\uFF0C\u4F1A\u81EA\u52A8\u6062\u590D\u4E91\u7AEF Cookies \u4E0E\u5176\u4ED6\u6D4F\u89C8\u5668\u5B58\u50A8\u3002';

    if (!selectedShop) {
      badgeText = '\u8BF7\u9009\u62E9\u5E97\u94FA';
      hintText = '\u6682\u672A\u542F\u7528';
      summaryText = '\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u540E\u518D\u4F7F\u7528\u81EA\u52A8\u540C\u6B65\u3002';
    } else if (!autoSyncEnabled) {
      shellClassName += 'is-disabled';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5173';
      hintText = '\u5F53\u524D\u5E97\u94FA';
      summaryText =
        '\u5F53\u524D\u5E97\u94FA\u5DF2\u5173\u95ED\u6D4F\u89C8\u5668\u5B58\u50A8\u81EA\u52A8\u540C\u6B65\uFF0C\u53EF\u5728\u5E97\u94FA\u8BBE\u7F6E\u4E2D\u91CD\u65B0\u5F00\u542F\u3002';
    } else if (busyAction === 'auto-restore' || busyAction === 'restore') {
      shellClassName += 'is-busy';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u4E2D';
      hintText = '\u6B63\u5728\u6062\u590D';
      summaryText =
        '\u6B63\u5728\u4E3A\u5F53\u524D\u5E97\u94FA\u81EA\u52A8\u6062\u590D\u4E91\u7AEF\u6D4F\u89C8\u5668\u5B58\u50A8\uFF0C\u8BF7\u7A0D\u5019\u518D\u5F00\u59CB\u4F7F\u7528\u5DE5\u4F5C\u533A\u3002';
    } else if (busyAction === 'auto-upload' || busyAction === 'upload') {
      shellClassName += 'is-busy';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u4E2D';
      hintText = '\u6B63\u5728\u4E0A\u4F20';
      summaryText =
        '\u6B63\u5728\u5C06\u5F53\u524D\u5E97\u94FA\u7684 Cookies \u81EA\u52A8\u5907\u4EFD\u5230\u4E91\u7AEF\u3002';
    } else if (runtimeState.lastAutoError) {
      shellClassName += 'is-error';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u5F02\u5E38';
      hintText = runtimeState.lastAutoErrorAt
        ? runtime.formatTimestamp(runtimeState.lastAutoErrorAt)
        : '\u7A0D\u540E\u91CD\u8BD5';
      summaryText = `\u6700\u8FD1\u4E00\u6B21\u81EA\u52A8\u540C\u6B65\u672A\u6210\u529F\uFF1A${runtimeState.lastAutoError}`;
    } else if (cloudSummary && cloudSummary.updatedAt) {
      shellClassName += 'is-enabled';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
      hintText = `\u4E91\u7AEF ${runtime.formatTimestamp(cloudSummary.updatedAt)}`;
      summaryText =
        `\u4E91\u7AEF\u6700\u8FD1\u540C\u6B65 ${runtime.formatTimestamp(cloudSummary.updatedAt)}`
        + `${typeSummaryTexts.length > 0 ? ` | ${typeSummaryTexts.join(' | ')}` : ''}`;
    } else if (localSummary && localSummary.updatedAt) {
      shellClassName += 'is-enabled';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
      hintText = `\u672C\u673A ${runtime.formatTimestamp(localSummary.updatedAt)}`;
      summaryText =
        `\u672C\u673A\u5DF2\u51C6\u5907\u6700\u65B0\u6D4F\u89C8\u5668\u5B58\u50A8 ${runtime.formatTimestamp(localSummary.updatedAt)}`
        + `${typeSummaryTexts.length > 0 ? ` | ${typeSummaryTexts.join(' | ')}` : ''}`;
    } else if (selectedShop && runtime.isBrowserStorageSyncStateLoading(selectedShop.id)) {
      shellClassName += 'is-busy';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
      hintText = '\u52A0\u8F7D\u4E2D';
      summaryText = '\u6B63\u5728\u52A0\u8F7D\u4E91\u7AEF\u540C\u6B65\u6982\u89C8...';
    } else {
      shellClassName += 'is-enabled';
      badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
      hintText = runtimeState.lastUploadAt
        ? `\u672C\u673A ${runtime.formatTimestamp(runtimeState.lastUploadAt)}`
        : '\u7B49\u5F85\u9996\u6B21\u540C\u6B65';
      summaryText =
        '\u9996\u6B21\u8FDB\u5165\u5F53\u524D\u5E97\u94FA\u65F6\uFF0C\u4F1A\u5148\u68C0\u67E5\u5F53\u524D\u5206\u533A\u7684\u767B\u5F55\u72B6\u6001\u3002'
        + '\u5982\u679C\u672C\u5730\u8FD8\u6CA1\u6709\u53EF\u7528\u767B\u5F55 Cookies\uFF0C\u624D\u4F1A\u6062\u590D\u4E91\u7AEF Cookies\uFF0C\u540C\u65F6\u4E00\u8D77\u8865\u56DE Local Storage \u548C IndexedDB\u3002';
    }

    const summaryTitle =
      browserStorageSyncState.origins
      && browserStorageSyncState.origins.length > 0
        ? browserStorageSyncState.origins.join('\n')
        : summaryText;

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
