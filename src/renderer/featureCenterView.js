(function initFeatureCenterView(global) {
  let assetVersion = String(Date.now());

  function bumpAssetVersion() {
    assetVersion = String(Date.now());
  }

  function versionAssetPath(assetPath) {
    return `${assetPath}?v=${assetVersion}`;
  }

  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u529f\u80fd\u4e2d\u5fc3\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u529f\u80fd\u4e2d\u5fc3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    mountExportName: 'mountFeatureCenterApp',
    mountTarget: '#featureCenterApp',
    onBeforeReset({ moduleRef }) {
      if (moduleRef && typeof moduleRef.unmountFeatureCenterApp === 'function') {
        moduleRef.unmountFeatureCenterApp();
      }
    },
    replaceStylesheet: true,
    stylesheetErrorMessage: '\u529f\u80fd\u4e2d\u5fc3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: () => versionAssetPath('./featureCenterApp/dist/feature-center-app.css'),
    stylesheetSelector: 'link[data-feature-center-app-style="true"]',
    moduleHref: () => versionAssetPath('./featureCenterApp/dist/feature-center-app.js')
  });

  global.featureCenterView = {
    init() {
      const mountNode = document.getElementById('featureCenterApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u529f\u80fd\u4e2d\u5fc3\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
      }

      return bundleView.ensureMount();
    },
    refresh() {
      bundleView.resetMount();
      bumpAssetVersion();
      return bundleView.ensureMount();
    }
  };
})(window);
