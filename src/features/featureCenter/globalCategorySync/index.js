const { globalCategorySyncWorkbenchModule } = require('./syncWorkbench');

const globalCategorySyncFeature = Object.freeze({
  kind: 'feature',
  id: 'global-category-sync',
  tag: '\u7C7B\u76EE',
  title: '\u5168\u91CF\u540C\u6B65\u7C7B\u76EE',
  description: '\u4ECE\u5DF2\u767B\u5F55\u5E97\u94FA\u540C\u6B65 TEMU \u5168\u91CF\u7C7B\u76EE\u6811\uFF0C\u652F\u6301\u8FD0\u8425\u67E5\u8BE2\u3001\u5546\u54C1\u7B5B\u9009\u53CA\u7C7B\u76EE\u68C0\u7D22\u3002',
  storageKey: 'feature_center/global_category_sync',
  codeCategory: 'feature_center.global_category_sync',
  codeDirectory: 'src/features/featureCenter/globalCategorySync/index.js',
  windowAction: 'open-global-category-sync',
  modules: [
    globalCategorySyncWorkbenchModule
  ]
});

module.exports = {
  globalCategorySyncFeature
};


