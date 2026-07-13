(function initGlobalConfigView(global) {
  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u5168\u5c40\u914d\u7f6e\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u5168\u5c40\u914d\u7f6e\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    mountExportName: 'mountGlobalConfigApp',
    mountTarget: '#globalConfigApp',
    stylesheetErrorMessage: '\u5168\u5c40\u914d\u7f6e\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './globalConfigApp/dist/global-config-app.css',
    stylesheetSelector: 'link[data-global-config-app-style="true"]'
  });
  let controller = null;

  global.globalConfigView = {
    init() {
      const mountNode = document.getElementById('globalConfigApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u5168\u5c40\u914d\u7f6e\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
      }

      return bundleView.ensureMount().then((activeController) => {
        controller = activeController;
        return controller;
      });
    },
    refresh() {
      if (controller && typeof controller.refresh === 'function') {
        return controller.refresh();
      }

      return bundleView.ensureMount().then((activeController) => {
        controller = activeController;

        if (controller && typeof controller.refresh === 'function') {
          return controller.refresh();
        }

        return null;
      });
    }
  };
})(window);
