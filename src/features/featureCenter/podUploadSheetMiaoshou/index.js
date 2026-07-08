const { podUploadSheetMiaoshouTableModule } = require('./miaoshouTable');

const podUploadSheetMiaoshouFeature = Object.freeze({
  kind: 'feature',
  id: 'pod-upload-sheet-miaoshou',
  tag: 'POD',
  title: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)',
  description: '\u9762\u5411\u5999\u624B TEMU \u7248\u6A21\u677F\u751F\u6210\u4E0A\u8D27\u8868\u683C\uFF0C\u652F\u6301\u56FE\u7247\u4E0A\u4F20\u3001\u5B57\u6BB5\u586B\u5199\u3001AI\u6807\u9898\u5BFC\u51FA\u3002',
  storageKey: 'feature_center/pod_upload_sheet_miaoshou',
  codeCategory: 'feature_center.pod_upload_sheet_miaoshou',
  codeDirectory: 'src/features/featureCenter/podUploadSheetMiaoshou/index.js',
  windowAction: 'open-pod-upload-sheet-miaoshou',
  modules: [
    podUploadSheetMiaoshouTableModule
  ]
});

module.exports = {
  podUploadSheetMiaoshouFeature
};


