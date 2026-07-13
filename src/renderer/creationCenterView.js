(function initCreationCenterView(global) {
  let assetVersion = String(Date.now());

  function bumpAssetVersion() {
    assetVersion = String(Date.now());
  }

  function versionAssetPath(assetPath) {
    return `${assetPath}?v=${assetVersion}`;
  }

  const bundleView = global.createVueBundleViewLoader({
    fallbackMessage: '\u521b\u4f5c\u4e2d\u5fc3\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: '\u521b\u4f5c\u4e2d\u5fc3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002',
    moduleHref: () => versionAssetPath('./creationCenterApp/dist/creation-center-app.js'),
    mountExportName: 'mountCreationCenterApp',
    mountTarget: '#creationCenterApp',
    onBeforeReset({ moduleRef }) {
      if (moduleRef && typeof moduleRef.unmountCreationCenterApp === 'function') {
        moduleRef.unmountCreationCenterApp();
      }
    },
    replaceStylesheet: true,
    stylesheetErrorMessage: '\u521b\u4f5c\u4e2d\u5fc3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: () => versionAssetPath('./creationCenterApp/dist/creation-center-app.css'),
    stylesheetSelector: 'link[data-creation-center-app-style="true"]'
  });

  global.creationCenterView = {
    init() {
      const mountNode = document.getElementById('creationCenterApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u521b\u4f5c\u4e2d\u5fc3\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
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
