(function initExitProgressView(global) {
  'use strict';

  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u9000\u51fa\u4fdd\u5b58\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u9000\u51fa\u4fdd\u5b58\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: './exitProgressApp/dist/exit-progress-app.js',
    mountExportName: 'mountExitProgressApp',
    mountTarget: '#exitProgressApp',
    stylesheetErrorMessage: '\u9000\u51fa\u4fdd\u5b58\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './exitProgressApp/dist/exit-progress-app.css',
    stylesheetSelector: 'link[data-exit-progress-app-style="true"]'
  });

  global.exitProgressView = {
    init() {
      return bundleView.ensureMount();
    }
  };

  bundleView.ensureMount();
})(window);
