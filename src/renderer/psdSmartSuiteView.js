(function initPsdSmartSuiteView(global) {
  'use strict';

  var controller = null;

  function getErrorDetail(error) {
    return error && error.message ? String(error.message) : '';
  }

  var bundleView = global.createVueBundleViewLoader({
    fallbackMessage: 'PSD\u667a\u80fd\u5957\u56fe\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: 'PSD\u667a\u80fd\u5957\u56fe\u6a21\u5757\u7f3a\u5c11 mountPsdSmartSuiteApp \u5bfc\u51fa\u3002',
    moduleHref: './psdSmartSuiteApp/dist/psd-smart-suite-app.js',
    mountExportName: 'mountPsdSmartSuiteApp',
    mountTarget: '#psd-smart-suite-root',
    renderFallback: function (payload) {
      payload.renderFallbackCard(
        'PSD\u667a\u80fd\u5957\u56fe\u52a0\u8f7d\u5931\u8d25',
        getErrorDetail(payload.error)
      );
    },
    stylesheetErrorMessage: 'PSD\u667a\u80fd\u5957\u56fe\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './psdSmartSuiteApp/dist/psd-smart-suite-app.css',
    stylesheetSelector: 'link[data-psd-smart-suite-app-style="true"]'
  });

  function ensureMount() {
    return bundleView.ensureMount()
      .then(function (activeController) {
        controller = activeController;
        return controller;
      })
      .catch(function (error) {
        console.error('[PSD\u667a\u80fd\u5957\u56fe] \u521d\u59cb\u5316\u5931\u8d25:', error);
        throw error;
      });
  }

  global.psdSmartSuiteView = {
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
