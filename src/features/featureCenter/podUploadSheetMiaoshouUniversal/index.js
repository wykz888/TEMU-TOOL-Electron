const {
  podUploadSheetMiaoshouUniversalTableModule
} = require('./miaoshouUniversalTable');

const podUploadSheetMiaoshouUniversalFeature = Object.freeze({
  kind: 'feature',
  id: 'pod-upload-sheet-miaoshou-universal',
  tag: 'POD',
  title: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624b\u901a\u7528\u7248)',
  description: '\u6309\u5999\u624B\u901A\u7528\u7248\u6A21\u677F\u751F\u6210\u4E0A\u8D27\u8868\u683C\uFF0C\u652F\u6301\u591A\u5E73\u53F0\u5B57\u6BB5\u3001\u56FE\u7247\u94FE\u63A5\u53CASKU\u4FE1\u606F\u6574\u7406\u3002',
  storageKey: 'feature_center/pod_upload_sheet_miaoshou_universal',
  codeCategory: 'feature_center.pod_upload_sheet_miaoshou_universal',
  codeDirectory: 'src/features/featureCenter/podUploadSheetMiaoshouUniversal/index.js',
  windowAction: 'open-pod-upload-sheet-miaoshou-universal',
  modules: [
    podUploadSheetMiaoshouUniversalTableModule
  ]
});

module.exports = {
  podUploadSheetMiaoshouUniversalFeature
};


