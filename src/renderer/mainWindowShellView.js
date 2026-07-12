(function initMainWindowShellView(global) {
  let controller = null;
  let mountPromise = null;
  let stylesheetPromise = null;
  const assetVersion = String(Date.now());

  function versionAssetPath(assetPath) {
    return `${assetPath}?v=${assetVersion}`;
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
    const mountNode = document.getElementById('mainWindowShell');

    if (!mountNode) {
      return;
    }

    mountNode.textContent = message || '\u4e3b\u7a97\u53e3\u52a0\u8f7d\u5931\u8d25\u3002';
  }

  function ensureStylesheet() {
    if (stylesheetPromise) {
      return stylesheetPromise;
    }

    stylesheetPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('link[data-main-window-app-style="true"]');
      const href = versionAssetPath('./mainWindowApp/dist/main-window-app.css');

      if (existing) {
        existing.remove();
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.mainWindowAppStyle = 'true';
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error('\u4e3b\u7a97\u53e3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002'));
      document.head.appendChild(link);
    });

    return stylesheetPromise;
  }

  function ensureMount() {
    if (!mountPromise) {
      ensureVueProcessShim();

      mountPromise = ensureStylesheet()
        .then(() => import(versionAssetPath('./mainWindowApp/dist/main-window-app.js')))
        .then((module) => {
          if (!module || typeof module.mountMainWindowApp !== 'function') {
            throw new Error('\u4e3b\u7a97\u53e3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002');
          }

          controller = module.mountMainWindowApp('#mainWindowShell');
          return controller;
        })
        .catch((error) => {
          renderFallbackMessage(normalizeFallbackError(error, '\u4e3b\u7a97\u53e3\u52a0\u8f7d\u5931\u8d25\u3002'));
          throw error;
        });
    }

    return mountPromise;
  }

  global.mainWindowShell = {
    init() {
      const mountNode = document.getElementById('mainWindowShell');

      if (!mountNode) {
        return Promise.reject(new Error('\u4e3b\u7a97\u53e3\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
      }

      return ensureMount();
    },
    setSection(sectionId) {
      if (controller && typeof controller.setSection === 'function') {
        controller.setSection(sectionId);
      }
    },
    setSession(session) {
      if (controller && typeof controller.setSession === 'function') {
        controller.setSession(session);
      }
    },
    refreshSession() {
      if (controller && typeof controller.refreshSession === 'function') {
        return controller.refreshSession();
      }

      return Promise.resolve(null);
    },
    setRuntimeStatus(payload) {
      if (controller && typeof controller.setRuntimeStatus === 'function') {
        controller.setRuntimeStatus(payload);
      }
    },
    clearRuntimeStatus() {
      if (controller && typeof controller.clearRuntimeStatus === 'function') {
        controller.clearRuntimeStatus();
      }
    },
    syncThemeFromBridge() {
      if (controller && typeof controller.syncThemeFromBridge === 'function') {
        return controller.syncThemeFromBridge();
      }

      return Promise.resolve();
    }
  };
})(window);
