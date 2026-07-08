(() => {
  window.createShopWindowStorageSyncViewController = function createShopWindowStorageSyncViewController(options) {
    const getElements = options.getElements;
    const getSelectedShop = options.getSelectedShop;
    const getCurrentBrowserStorageSyncState = options.getCurrentBrowserStorageSyncState;
    const getBrowserStorageAutoSyncRuntime = options.getBrowserStorageAutoSyncRuntime;
    const createEmptyBrowserStorageAutoSyncRuntime = options.createEmptyBrowserStorageAutoSyncRuntime;
    const isBrowserStorageAutoSyncEnabled = options.isBrowserStorageAutoSyncEnabled;
    const getBrowserStorageBusyActionForShop = options.getBrowserStorageBusyActionForShop;
    const isBrowserStorageSyncStateLoading = options.isBrowserStorageSyncStateLoading;
    const formatTimestamp = options.formatTimestamp;
    const scheduleDeferredWorkspaceSync = options.scheduleDeferredWorkspaceSync;
    const storageTypeLabels = options.storageTypeLabels;

    function normalizeText(value) {
      return value == null ? '' : String(value).trim();
    }

    function setTextIfChanged(element, text) {
      if (element.textContent !== text) {
        element.textContent = text;
        return true;
      }

      return false;
    }

    function setClassNameIfChanged(element, className) {
      if (element.className !== className) {
        element.className = className;
        return true;
      }

      return false;
    }

    function setTitleIfChanged(element, title) {
      if (element.title !== title) {
        element.title = title;
        return true;
      }

      return false;
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
      const selectedShop = getSelectedShop();
      const browserStorageSyncState = getCurrentBrowserStorageSyncState();
      const localSummary = browserStorageSyncState.localSummary;
      const cloudSummary = browserStorageSyncState.cloudSummary;
      const effectiveSummary = cloudSummary || localSummary;
      const runtime = selectedShop
        ? getBrowserStorageAutoSyncRuntime(selectedShop.id)
        : createEmptyBrowserStorageAutoSyncRuntime();
      const autoSyncEnabled = isBrowserStorageAutoSyncEnabled(selectedShop);
      const busyAction = selectedShop
        ? getBrowserStorageBusyActionForShop(selectedShop.id)
        : '';
      const typeSummaryTexts = effectiveSummary
        ? Object.keys(storageTypeLabels)
          .map((typeId) => buildBrowserStorageSyncTypeSummary(typeId, effectiveSummary))
          .filter(Boolean)
        : [];
      let shellClassName = 'shop-window-storage-sync-shell';
      let badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5173';
      let hintText = '\u5E97\u94FA\u8BBE\u7F6E';
      let summaryText =
        '\u5F53\u524D\u5E97\u94FA\u5728\u9996\u6B21\u6253\u5F00\u5DE5\u4F5C\u533A\u524D\uFF0C\u4F1A\u5148\u68C0\u67E5\u5F53\u524D\u5206\u533A\u7684\u767B\u5F55 Cookies\u3002\u5982\u679C\u672C\u5730\u767B\u5F55\u6001\u4E0D\u5B8C\u6574\uFF0C\u4F1A\u81EA\u52A8\u6062\u590D\u4E91\u7AEF Cookies \u4E0E\u5176\u4ED6\u6D4F\u89C8\u5668\u5B58\u50A8\u3002';

      if (!selectedShop) {
        badgeText = '\u8BF7\u9009\u62E9\u5E97\u94FA';
        hintText = '\u6682\u672A\u542F\u7528';
        summaryText = '\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u540E\u518D\u4F7F\u7528\u81EA\u52A8\u540C\u6B65\u3002';
      } else if (!autoSyncEnabled) {
        shellClassName += ' is-disabled';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5173';
        hintText = '\u5F53\u524D\u5E97\u94FA';
        summaryText =
          '\u5F53\u524D\u5E97\u94FA\u5DF2\u5173\u95ED\u6D4F\u89C8\u5668\u5B58\u50A8\u81EA\u52A8\u540C\u6B65\uFF0C\u53EF\u5728\u5E97\u94FA\u8BBE\u7F6E\u4E2D\u91CD\u65B0\u5F00\u542F\u3002';
      } else if (busyAction === 'auto-restore' || busyAction === 'restore') {
        shellClassName += ' is-busy';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u4E2D';
        hintText = '\u6B63\u5728\u6062\u590D';
        summaryText =
          '\u6B63\u5728\u4E3A\u5F53\u524D\u5E97\u94FA\u81EA\u52A8\u6062\u590D\u4E91\u7AEF\u6D4F\u89C8\u5668\u5B58\u50A8\uFF0C\u8BF7\u7A0D\u5019\u518D\u5F00\u59CB\u4F7F\u7528\u5DE5\u4F5C\u533A\u3002';
      } else if (busyAction === 'auto-upload' || busyAction === 'upload') {
        shellClassName += ' is-busy';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u4E2D';
        hintText = '\u6B63\u5728\u4E0A\u4F20';
        summaryText =
          '\u6B63\u5728\u5C06\u5F53\u524D\u5E97\u94FA\u7684 Cookies \u81EA\u52A8\u5907\u4EFD\u5230\u4E91\u7AEF\u3002';
      } else if (runtime.lastAutoError) {
        shellClassName += ' is-error';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u5F02\u5E38';
        hintText = runtime.lastAutoErrorAt
          ? formatTimestamp(runtime.lastAutoErrorAt)
          : '\u7A0D\u540E\u91CD\u8BD5';
        summaryText = `\u6700\u8FD1\u4E00\u6B21\u81EA\u52A8\u540C\u6B65\u672A\u6210\u529F\uFF1A${runtime.lastAutoError}`;
      } else if (cloudSummary && cloudSummary.updatedAt) {
        shellClassName += ' is-enabled';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
        hintText = `\u4E91\u7AEF ${formatTimestamp(cloudSummary.updatedAt)}`;
        summaryText =
          `\u4E91\u7AEF\u6700\u8FD1\u540C\u6B65 ${formatTimestamp(cloudSummary.updatedAt)}`
          + `${typeSummaryTexts.length > 0 ? ` | ${typeSummaryTexts.join(' | ')}` : ''}`;
      } else if (localSummary && localSummary.updatedAt) {
        shellClassName += ' is-enabled';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
        hintText = `\u672C\u673A ${formatTimestamp(localSummary.updatedAt)}`;
        summaryText =
          `\u672C\u673A\u5DF2\u51C6\u5907\u6700\u65B0\u6D4F\u89C8\u5668\u5B58\u50A8 ${formatTimestamp(localSummary.updatedAt)}`
          + `${typeSummaryTexts.length > 0 ? ` | ${typeSummaryTexts.join(' | ')}` : ''}`;
      } else if (selectedShop && isBrowserStorageSyncStateLoading(selectedShop.id)) {
        shellClassName += ' is-busy';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
        hintText = '\u52A0\u8F7D\u4E2D';
        summaryText = '\u6B63\u5728\u52A0\u8F7D\u4E91\u7AEF\u540C\u6B65\u6982\u89C8...';
      } else {
        shellClassName += ' is-enabled';
        badgeText = '\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00';
        hintText = runtime.lastUploadAt
          ? `\u672C\u673A ${formatTimestamp(runtime.lastUploadAt)}`
          : '\u7B49\u5F85\u9996\u6B21\u540C\u6B65';
        summaryText =
          '\u9996\u6B21\u8FDB\u5165\u5F53\u524D\u5E97\u94FA\u65F6\uFF0C\u4F1A\u5148\u68C0\u67E5\u5F53\u524D\u5206\u533A\u7684\u767B\u5F55\u72B6\u6001\u3002'
          + '\u5982\u679C\u672C\u5730\u8FD8\u6CA1\u6709\u53EF\u7528\u767B\u5F55 Cookies\uFF0C\u624D\u4F1A\u6062\u590D\u4E91\u7AEF Cookies\uFF0C\u540C\u65F6\u4E00\u8D77\u8865\u56DE Local Storage \u548C IndexedDB\u3002';
      }

      return {
        browserStorageSyncState,
        shellClassName,
        badgeText,
        hintText,
        summaryText
      };
    }

    function render() {
      const elements = getElements();
      const statusModel = buildStatusModel();
      const summaryTitle =
        statusModel.browserStorageSyncState.origins
        && statusModel.browserStorageSyncState.origins.length > 0
          ? statusModel.browserStorageSyncState.origins.join('\n')
          : statusModel.summaryText;
      const changed = [
        setClassNameIfChanged(elements.storageSyncShell, statusModel.shellClassName),
        setTextIfChanged(elements.storageSyncBadge, statusModel.badgeText),
        setTextIfChanged(elements.storageSyncHint, statusModel.hintText),
        setTextIfChanged(elements.storageSyncSummary, statusModel.summaryText),
        setTitleIfChanged(elements.storageSyncSummary, summaryTitle)
      ].some(Boolean);

      if (changed) {
        scheduleDeferredWorkspaceSync(40);
      }
    }

    return {
      render
    };
  };
})();
