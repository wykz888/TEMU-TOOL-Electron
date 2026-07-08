(function initCreationCenterView(global) {
  let controller = null;
  let mountPromise = null;
  let stylesheetPromise = null;

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
    const mountNode = document.getElementById('creationCenterApp');

    if (!mountNode) {
      return;
    }

    mountNode.textContent = message || '\u521b\u4f5c\u4e2d\u5fc3\u52a0\u8f7d\u5931\u8d25\u3002';
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
      const existing = document.querySelector('link[data-creation-center-app-style="true"]');

      if (existing) {
        resolve(existing);
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './creationCenterApp/dist/creation-center-app.css';
      link.dataset.creationCenterAppStyle = 'true';
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error('\u521b\u4f5c\u4e2d\u5fc3\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002'));
      document.head.appendChild(link);
    });

    return stylesheetPromise;
  }

  function ensureMount() {
    if (!mountPromise) {
      ensureVueProcessShim();

      mountPromise = ensureStylesheet()
        .then(() => import('./creationCenterApp/dist/creation-center-app.js'))
        .then((module) => {
          if (!module || typeof module.mountCreationCenterApp !== 'function') {
            throw new Error('\u521b\u4f5c\u4e2d\u5fc3\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002');
          }

          controller = module.mountCreationCenterApp('#creationCenterApp');
          return controller;
        })
        .catch((error) => {
          renderFallbackMessage(normalizeFallbackError(error, '\u521b\u4f5c\u4e2d\u5fc3\u52a0\u8f7d\u5931\u8d25\u3002'));
          throw error;
        });
    }

    return mountPromise;
  }

  global.creationCenterView = {
    init() {
      const mountNode = document.getElementById('creationCenterApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u521b\u4f5c\u4e2d\u5fc3\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
      }

      return ensureMount();
    },
    refresh() {
      if (controller && typeof controller.refresh === 'function') {
        return controller.refresh();
      }

      return ensureMount().then((activeController) => {
        if (activeController && typeof activeController.refresh === 'function') {
          return activeController.refresh();
        }

        return null;
      });
    }
  };
})(window);
