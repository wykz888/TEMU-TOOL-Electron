(function initFeatureCenterView(global) {
  let controller = null;
  let mountPromise = null;
  let stylesheetPromise = null;
  let moduleRef = null;
  let assetVersion = String(Date.now());

  function bumpAssetVersion() {
    assetVersion = String(Date.now());
  }

  function versionAssetPath(assetPath) {
    return `${assetPath}?v=${assetVersion}`;
  }

  function normalizeFallbackError(error, fallbackMessage) {
    if (!error || !error.message || !String(error.message).trim()) {
      return fallbackMessage;
    }

    const raw = String(error.message).trim();

    if (/[\u4e00-\u9fff]/u.test(raw)) {
      return raw;
    }

    if (/session/i.test(raw) || /partition/i.test(raw) || /IPC/i.test(raw) || /electron/i.test(raw) || /preload/i.test(raw) || /contextBridge/i.test(raw)) {
      return fallbackMessage;
    }

    return fallbackMessage;
  }

  function renderFallbackMessage(message) {
    const mountNode = document.getElementById('featureCenterApp');

    if (!mountNode) {
      return;
    }

    mountNode.textContent = message || '\u529f\u80fd\u4e2d\u5fc3\u52a0\u8f7d\u5931\u8d25\u3002';
  }

  function ensureVueProcessShim() {
    if (!global.process || typeof global.process !== 'object') {
      global.process = {};
    }

    if (!global.process.env || typeof global.process.env !== 'object') {
      global.process.env = {};
    }

    if (typeof global.process.env.NODE_ENV !== 'string') {
      global.process.env.NODE_ENV = 'production';
    }
  }

  function ensureStylesheet() {
    if (stylesheetPromise) {
      return stylesheetPromise;
    }

    stylesheetPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('link[data-feature-center-app-style="true"]');
      const href = versionAssetPath('./featureCenterApp/dist/feature-center-app.css');

      if (existing) {
        existing.remove();
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.featureCenterAppStyle = 'true';
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error('\u529f\u80fd\u4e2d\u5fc3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002'));
      document.head.appendChild(link);
    });

    return stylesheetPromise;
  }

  function ensureMount() {
    if (!mountPromise) {
      ensureVueProcessShim();

      mountPromise = ensureStylesheet()
        .then(() => import(versionAssetPath('./featureCenterApp/dist/feature-center-app.js')))
        .then((module) => {
          if (!module || typeof module.mountFeatureCenterApp !== 'function') {
            throw new Error('\u529f\u80fd\u4e2d\u5fc3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002');
          }

          moduleRef = module;
          controller = module.mountFeatureCenterApp('#featureCenterApp');
          return controller;
        })
        .catch((error) => {
          renderFallbackMessage(normalizeFallbackError(error, '\u529f\u80fd\u4e2d\u5fc3\u52a0\u8f7d\u5931\u8d25\u3002'));
          throw error;
        });
    }

    return mountPromise;
  }

  function resetMount() {
    if (moduleRef && typeof moduleRef.unmountFeatureCenterApp === 'function') {
      moduleRef.unmountFeatureCenterApp();
    }

    const mountNode = document.getElementById('featureCenterApp');

    if (mountNode) {
      mountNode.textContent = '';
    }

    controller = null;
    mountPromise = null;
    stylesheetPromise = null;
    moduleRef = null;
  }

  function reloadMount() {
    resetMount();
    bumpAssetVersion();
    return ensureMount();
  }

  global.featureCenterView = {
    init() {
      const mountNode = document.getElementById('featureCenterApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u529f\u80fd\u4e2d\u5fc3\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
      }

      return ensureMount();
    },
    refresh() {
      return reloadMount();
    }
  };
})(window);
