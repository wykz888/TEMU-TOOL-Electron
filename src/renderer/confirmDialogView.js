(function initConfirmDialogView(global) {
  'use strict';

  function getErrorDetail(error) {
    return error && error.message ? String(error.message) : '';
  }

  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u786e\u8ba4\u5f39\u7a97\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u786e\u8ba4\u5f39\u7a97\u6a21\u5757\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: './confirmDialogApp/dist/confirm-dialog-app.js',
    mountExportName: 'mountConfirmDialogApp',
    mountTarget: '#confirmDialogApp',
    renderFallback(payload) {
      payload.renderFallbackCard(
        '\u786e\u8ba4\u5f39\u7a97\u52a0\u8f7d\u5931\u8d25',
        getErrorDetail(payload.error)
      );
    },
    stylesheetErrorMessage: '\u786e\u8ba4\u5f39\u7a97\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './confirmDialogApp/dist/confirm-dialog-app.css',
    stylesheetSelector: 'link[data-confirm-dialog-app-style="true"]'
  });

  global.confirmDialogView = {
    init() {
      return bundleView.ensureMount();
    }
  };

  bundleView.ensureMount();
})(window);
