(function initShopManagementView(global) {
  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u5e97\u94fa\u7ba1\u7406\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u5e97\u94fa\u7ba1\u7406\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: './shopManagementApp/dist/shop-management-app.js',
    mountExportName: 'mountShopManagementApp',
    mountTarget: '#shopManagementApp',
    stylesheetErrorMessage: '\u5e97\u94fa\u7ba1\u7406\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './shopManagementApp/dist/shop-management-app.css',
    stylesheetSelector: 'link[data-shop-management-app-style="true"]'
  });
  let controller = null;

  global.shopManagementView = {
    init() {
      const mountNode = document.getElementById('shopManagementApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u5e97\u94fa\u7ba1\u7406\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
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
