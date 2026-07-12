(function initConfirmDialogView(global) {
  'use strict';

  let mountPromise = null;
  let stylesheetPromise = null;

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

    stylesheetPromise = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './confirmDialogApp/dist/confirm-dialog-app.css';
      link.onload = function () {
        resolve(link);
      };
      link.onerror = function () {
        reject(new Error('\u786e\u8ba4\u5f39\u7a97\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002'));
      };
      document.head.appendChild(link);
    });

    return stylesheetPromise;
  }

  function renderFallback(error) {
    var mountTarget = document.getElementById('confirmDialogApp');

    if (!mountTarget) {
      return;
    }

    function escapeHtml(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    mountTarget.innerHTML = '<div style="height:100%;display:grid;place-items:center;padding:18px;">'
      + '<div style="width:100%;max-width:420px;border:1px solid rgba(225,29,72,.22);border-radius:16px;background:#fff;padding:22px;color:#172033;font-family:Microsoft YaHei UI, sans-serif;">'
      + '<strong style="color:#e11d48;">&#x786E;&#x8BA4;&#x5F39;&#x7A97;&#x52A0;&#x8F7D;&#x5931;&#x8D25;</strong>'
      + '<p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.7;">'
      + escapeHtml(error && error.message || '')
      + '</p></div></div>';
  }

  function ensureMount() {
    if (mountPromise) {
      return mountPromise;
    }

    ensureVueProcessShim();

    mountPromise = ensureStylesheet()
      .then(function () {
        return import('./confirmDialogApp/dist/confirm-dialog-app.js');
      })
      .then(function (module) {
        if (!module || typeof module.mountConfirmDialogApp !== 'function') {
          throw new Error('\u786e\u8ba4\u5f39\u7a97\u6a21\u5757\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002');
        }

        return module.mountConfirmDialogApp('#confirmDialogApp');
      })
      .catch(function (error) {
        renderFallback(error);
        throw error;
      });

    return mountPromise;
  }

  global.confirmDialogView = {
    init: ensureMount
  };

  ensureMount();
})(window);
