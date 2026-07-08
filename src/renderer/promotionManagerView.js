(function initPromotionManagerView(global) {
  'use strict';

  function ensureVueProcessShim() {
    if (typeof process === 'undefined') {
      global.process = { env: { NODE_ENV: 'production' } };
    }
  }

  function ensureStylesheet() {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './promotionManagerApp/dist/promotion-manager-app.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  let mountPromise = null;
  let controller = null;

  function ensureMount() {
    if (mountPromise) {
      return mountPromise;
    }

    mountPromise = ensureStylesheet()
      .then(() => import('./promotionManagerApp/dist/promotion-manager-app.js'))
      .then((module) => {
        controller = module.mountPromotionManagerApp('#promotionManagerApp');
        return controller;
      })
      .catch((error) => {
        console.error('[推广大师] 初始化失败:', error);
        const mountTarget = document.getElementById('promotionManagerApp');
        if (mountTarget) {
          mountTarget.innerHTML = '<div style="padding:24px;color:#e11d48;font-size:14px;">'
            + '<strong>推广大师加载失败</strong>'
            + '<p style="margin:8px 0 0;color:#64748b;font-size:12px;">' + (error.message || '') + '</p>'
            + '</div>';
        }
        throw error;
      });

    return mountPromise;
  }

  ensureVueProcessShim();

  global.promotionManagerView = {
    init() {
      return ensureMount();
    },
    refresh() {
      if (controller && typeof controller.refresh === 'function') {
        return controller.refresh();
      }
      return Promise.resolve(null);
    }
  };

  // 自动初始化
  ensureMount();
})(window);
