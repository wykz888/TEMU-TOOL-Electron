(function initMainWindowShellView(global) {
  let controller = null;
  const assetVersion = String(Date.now());

  function versionAssetPath(assetPath) {
    return `${assetPath}?v=${assetVersion}`;
  }

  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u4e3b\u7a97\u53e3\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u4e3b\u7a97\u53e3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: () => versionAssetPath('./mainWindowApp/dist/main-window-app.js'),
    mountExportName: 'mountMainWindowApp',
    mountTarget: '#mainWindowShell',
    replaceStylesheet: true,
    stylesheetErrorMessage: '\u4e3b\u7a97\u53e3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: () => versionAssetPath('./mainWindowApp/dist/main-window-app.css'),
    stylesheetSelector: 'link[data-main-window-app-style="true"]'
  });

  function ensureMount() {
    return bundleView.ensureMount().then((activeController) => {
      controller = activeController;
      return controller;
    });
  }

  global.mainWindowShell = {
    init() {
      const mountNode = document.getElementById('mainWindowShell');

      if (!mountNode) {
        return Promise.reject(new Error('\u4e3b\u7a97\u53e3\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
      }

      return ensureMount();
    },
    setSection(sectionId) {
      if (controller && typeof controller.setSection === 'function') {
        controller.setSection(sectionId);
      }
    },
    setSession(session) {
      if (controller && typeof controller.setSession === 'function') {
        controller.setSession(session);
      }
    },
    refreshSession() {
      if (controller && typeof controller.refreshSession === 'function') {
        return controller.refreshSession();
      }

      return Promise.resolve(null);
    },
    setRuntimeStatus(payload) {
      if (controller && typeof controller.setRuntimeStatus === 'function') {
        controller.setRuntimeStatus(payload);
      }
    },
    clearRuntimeStatus() {
      if (controller && typeof controller.clearRuntimeStatus === 'function') {
        controller.clearRuntimeStatus();
      }
    },
    syncThemeFromBridge() {
      if (controller && typeof controller.syncThemeFromBridge === 'function') {
        return controller.syncThemeFromBridge();
      }

      return Promise.resolve();
    }
  };
})(window);
