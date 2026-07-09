(function initPodUploadSheetMiaoshouView(global) {
  'use strict';

  function ensureStylesheet() {
    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './podUploadSheetMiaoshouApp/dist/pod-upload-sheet-miaoshou-app.css';
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
        return import('./podUploadSheetMiaoshouApp/dist/pod-upload-sheet-miaoshou-app.js');
      })
      .then(function (module) {
        if (typeof module.mountPodUploadSheetMiaoshouApp === 'function') {
          controller = module.mountPodUploadSheetMiaoshouApp();
        } else {
          throw new Error('POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u6a21\u5757\u7f3a\u5c11 mountPodUploadSheetMiaoshouApp \u5bfc\u51fa');
        }

        return controller;
      })
      .catch(function (error) {
        console.error('[POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)] \u521d\u59cb\u5316\u5931\u8d25', error);
        var mountTarget = document.getElementById('pod-upload-sheet-miaoshou-root');

        if (mountTarget) {
          mountTarget.innerHTML = '<div style="padding:24px;color:#e11d48;font-size:14px;">'
            + '<strong>POD&#x4E0A;&#x8D27;&#x8868;&#x683C;(&#x5999;&#x624B;TEMU&#x7248;)&#x52A0;&#x8F7D;&#x5931;&#x8D25;</strong>'
            + '<p style="margin:8px 0 0;color:#64748b;font-size:12px;">' + (error.message || '') + '</p>'
            + '</div>';
        }

        throw error;
      });

    return mountPromise;
  }

  global.podUploadSheetMiaoshouView = {
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

  ensureMount();
})(window);
