const {
  operationsNewProductLifecycleModule
} = require('./newProductLifecycleModule');

const operationsNewProductLifecycleFeature = Object.freeze({
  kind: 'feature',
  id: 'operations-new-product-lifecycle-workbench',
  tag: '\u4e0a\u65b0',
  title: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406',
  description: '\u67E5\u8BE2\u4E0A\u65B0\u5546\u54C1\u72B6\u6001\u4E0ESKU\u660E\u7EC6\uFF0C\u7ED3\u5408\u6D41\u91CF\u6210\u672C\u89C4\u5219\u8F85\u52A9\u5224\u65AD\uFF0C\u652F\u6301\u6279\u91CF\u8C03\u4EF7\u3002',
  storageKey: 'feature_center/operations_new_product_lifecycle',
  codeCategory: 'feature_center.operations_new_product_lifecycle',
  codeDirectory: 'src/features/featureCenter/operationsNewProductLifecycle/index.js',
  windowAction: 'open-operations-new-product-lifecycle',
  modules: [
    operationsNewProductLifecycleModule
  ]
});

module.exports = {
  operationsNewProductLifecycleFeature
};


