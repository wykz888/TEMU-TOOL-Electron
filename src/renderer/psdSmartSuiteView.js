(function initPsdSmartSuiteView(global) {
  'use strict';

  function ensureStylesheet() {
    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './psdSmartSuiteApp/dist/psd-smart-suite-app.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  var mountPromise = null;
  var controller = null;

  function ensureMount() {
    if (mountPromise) {
      return mountPromise;
    }

    mountPromise = ensureStylesheet()
      .then(function () {
        return import('./psdSmartSuiteApp/dist/psd-smart-suite-app.js');
      })
      .then(function (module) {
        if (typeof module.mountPsdSmartSuiteApp === 'function') {
          controller = module.mountPsdSmartSuiteApp();
        } else {
          throw new Error('PSD智能套图模块缺少 mountPsdSmartSuiteApp 导出');
        }
        return controller;
      })
      .catch(function (error) {
        console.error('[PSD智能套图] 初始化失败:', error);
        var mountTarget = document.getElementById('psd-smart-suite-root');
        if (mountTarget) {
          mountTarget.innerHTML = '<div style="padding:24px;color:#e11d48;font-size:14px;">'
            + '<strong>PSD智能套图加载失败</strong>'
            + '<p style="margin:8px 0 0;color:#64748b;font-size:12px;">' + (error.message || '') + '</p>'
            + '</div>';
        }
        throw error;
      });

    return mountPromise;
  }

  global.psdSmartSuiteView = {
    init: function () {
      return ensureMount();
    },
    refresh: function () {
      if (controller && typeof controller.refresh === 'function') {
        return controller.refresh();
      }
      return Promise.resolve(null);
    }
  };

  // 自动初始化
  ensureMount();
})(window);
