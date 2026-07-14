(function initPodUploadSheetMiaoshouView(global) {
  'use strict';

  var ASSET_VERSION = '20260714-select-popup-shell-1';
  var controller = null;

  function withVersion(assetPath) {
    return assetPath + '?v=' + encodeURIComponent(ASSET_VERSION);
  }

  function getErrorDetail(error) {
    return error && error.message ? String(error.message) : '';
  }

  var bundleView = global.createVueBundleViewLoader({
    fallbackMessage: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u52a0\u8f7d\u5931\u8d25\u3002',
    missingExportMessage: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u6a21\u5757\u7f3a\u5c11 mountPodUploadSheetMiaoshouApp \u5bfc\u51fa\u3002',
    moduleHref: function () {
      return withVersion('./podUploadSheetMiaoshouApp/dist/pod-upload-sheet-miaoshou-app.js');
    },
    mountExportName: 'mountPodUploadSheetMiaoshouApp',
    mountTarget: '#pod-upload-sheet-miaoshou-root',
    renderFallback: function (payload) {
      payload.renderFallbackCard(
        'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u52a0\u8f7d\u5931\u8d25',
        getErrorDetail(payload.error)
      );
    },
    stylesheetErrorMessage: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002',
    stylesheetHref: function () {
      return withVersion('./podUploadSheetMiaoshouApp/dist/pod-upload-sheet-miaoshou-app.css');
    },
    stylesheetSelector: 'link[data-pod-upload-sheet-miaoshou-app-style="true"]'
  });

  function ensureMount() {
    return bundleView.ensureMount()
      .then(function (activeController) {
        controller = activeController;
        return controller;
      })
      .catch(function (error) {
        console.error('[POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)] \u521d\u59cb\u5316\u5931\u8d25', error);
        throw error;
      });
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
