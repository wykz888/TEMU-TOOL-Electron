(function initGlobalCategorySyncWindow(global) {
  'use strict';

  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u5168\u91cf\u540c\u6b65\u7c7b\u76ee\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u5168\u91cf\u540c\u6b65\u7c7b\u76ee\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: './globalCategorySyncApp/dist/global-category-sync-app.js',
    mountExportName: 'mountGlobalCategorySyncApp',
    mountTarget: '#globalCategorySyncRoot',
    stylesheetErrorMessage: '\u5168\u91cf\u540c\u6b65\u7c7b\u76ee\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: './globalCategorySyncApp/dist/global-category-sync-app.css',
    stylesheetSelector: 'link[data-global-category-sync-app-style="true"]'
  });

  global.globalCategorySyncWindow = {
    init() {
      return bundleView.ensureMount();
    }
  };

  bundleView.ensureMount();
})(window);
