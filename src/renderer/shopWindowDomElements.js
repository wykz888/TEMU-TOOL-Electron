(() => {
  function getRequiredElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`\u7f3a\u5c11\u754c\u9762\u8282\u70b9\uff1a${id}`);
    }

    return element;
  }

  window.collectShopWindowElements = function collectShopWindowElements() {
    const browserHosts = Object.fromEntries(
      Array.from(document.querySelectorAll('[data-shop-browser-host]')).map((host) => [
        host.dataset.shopBrowserHost,
        host
      ])
    );
    const browserTabLists = Object.fromEntries(
      Array.from(document.querySelectorAll('[data-browser-tab-list]')).map((host) => [
        host.dataset.browserTabList,
        host
      ])
    );

    return {
      sectionPanel: getRequiredElement('shop-window'),
      mainPanel: document.querySelector('.shop-window-main'),
      workspaceRoot: document.querySelector('.shop-window-workspace'),
      list: getRequiredElement('shopWindowList'),
      groupFilterSelect: getRequiredElement('shopWindowGroupFilter'),
      currentShopName: getRequiredElement('shopWindowCurrentShopName'),
      currentShopMeta: getRequiredElement('shopWindowCurrentShopMeta'),
      statusRow: getRequiredElement('shopWindowStatusRow'),
      storageSyncShell: getRequiredElement('shopWindowStorageSyncShell'),
      storageSyncBadge: getRequiredElement('shopWindowStorageSyncBadge'),
      storageSyncHint: getRequiredElement('shopWindowStorageSyncHint'),
      storageSyncSummary: getRequiredElement('shopWindowStorageSyncSummary'),
      autoLoginCheckbox: getRequiredElement('shopWindowAutoLoginCheckbox'),
      tabStatus: getRequiredElement('shopWindowTabStatus'),
      urlModal: getRequiredElement('shopWindowUrlModal'),
      urlForm: getRequiredElement('shopWindowUrlForm'),
      urlModalStatus: getRequiredElement('shopWindowUrlModalStatus'),
      urlInput: getRequiredElement('shopWindowUrlInput'),
      urlSubmitButton: getRequiredElement('shopWindowUrlSubmitButton'),
      workspaceButtons: Array.from(document.querySelectorAll('[data-workspace-tab-target]')),
      panels: Array.from(document.querySelectorAll('[data-workspace-panel]')),
      browserHosts,
      browserTabLists
    };
  };
})();
