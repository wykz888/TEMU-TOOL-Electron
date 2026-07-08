(function initShopManagementView(global) {
  let controller = null;
  let mountPromise = null;
  let stylesheetPromise = null;

  function renderFallbackMessage(message) {
    const mountNode = document.getElementById('shopManagementApp');

    if (!mountNode) {
      return;
    }

    mountNode.textContent = message || '\u5e97\u94fa\u7ba1\u7406\u52a0\u8f7d\u5931\u8d25\u3002';
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
      const existing = document.querySelector('link[data-shop-management-app-style="true"]');

      if (existing) {
        resolve(existing);
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './shopManagementApp/dist/shop-management-app.css';
      link.dataset.shopManagementAppStyle = 'true';
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error('\u5e97\u94fa\u7ba1\u7406\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002'));
      document.head.appendChild(link);
    });

    return stylesheetPromise;
  }

  function ensureMount() {
    if (!mountPromise) {
      ensureVueProcessShim();

      mountPromise = ensureStylesheet()
        .then(() => import('./shopManagementApp/dist/shop-management-app.js'))
        .then((module) => {
          if (!module || typeof module.mountShopManagementApp !== 'function') {
            throw new Error('\u5e97\u94fa\u7ba1\u7406\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002');
          }

          controller = module.mountShopManagementApp('#shopManagementApp');
          return controller;
        })
        .catch((error) => {
          renderFallbackMessage(
            error && error.message
              ? error.message
              : '\u5e97\u94fa\u7ba1\u7406\u52a0\u8f7d\u5931\u8d25\u3002'
          );
          throw error;
        });
    }

    return mountPromise;
  }

  global.shopManagementView = {
    init() {
      const mountNode = document.getElementById('shopManagementApp');

      if (!mountNode) {
        return Promise.reject(new Error('\u5e97\u94fa\u7ba1\u7406\u754c\u9762\u6302\u8f7d\u70b9\u4e0d\u5b58\u5728\u3002'));
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
