(function initPromotionManagerNewView(global) {
  'use strict';

  var controller = null;

  function getErrorDetail(error) {
    return error && error.message ? String(error.message) : '';
  }

  var bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u63a8\u5e7f\u5927\u5e08-\u65b0\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u63a8\u5e7f\u5927\u5e08-\u65b0\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: './promotionManagerNewApp/dist/promotion-manager-new-app.js',
    mountExportName: 'mountPromotionManagerNewApp',
    mountTarget: '#promotionManagerNewApp',
    renderFallback: function (payload) {
      payload.renderFallbackCard(
        '\u63a8\u5e7f\u5927\u5e08-\u65b0\u52a0\u8f7d\u5931\u8d25',
        getErrorDetail(payload.error)
      );
    },
    stylesheetErrorMessage: '\u63a8\u5e7f\u5927\u5e08-\u65b0\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './promotionManagerNewApp/dist/promotion-manager-new-app.css',
    stylesheetSelector: 'link[data-promotion-manager-new-app-style="true"]'
  });

  function ensureMount() {
    return bundleView.ensureMount()
      .then(function (activeController) {
        controller = activeController;
        return controller;
      })
      .catch(function (error) {
        console.error('[\u63a8\u5e7f\u5927\u5e08-\u65b0] \u521d\u59cb\u5316\u5931\u8d25:', error);
        throw error;
      });
  }

  global.promotionManagerNewView = {
    init: function () {
      return ensureMount();
    },
    refresh: function () {
      if (controller && typeof controller.refresh === 'function') {
        return controller.refresh();
      }

      return Promise.resolve(null);
    }
  };

  ensureMount();
})(window);
