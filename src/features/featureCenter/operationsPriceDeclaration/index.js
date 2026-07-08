const {
  operationsPriceDeclarationModule
} = require('./priceDeclarationModule');

const operationsPriceDeclarationFeature = Object.freeze({
  kind: 'feature',
  id: 'operations-price-declaration-workbench',
  tag: '\u4ef7\u683c',
  title: '\u5546\u54c1\u4ef7\u683c\u7533\u62a5',
  description: '\u6279\u91CF\u67E5\u8BE2\u5546\u54C1\u4EF7\u683C\u7533\u62A5\u8BB0\u5F55\uFF0C\u7ED3\u5408\u6210\u672C\u5229\u6DA6\u89C4\u5219\u8F85\u52A9\u5224\u65AD\uFF0C\u652F\u6301\u6279\u91CF\u5904\u7406\u3002',
  storageKey: 'feature_center/operations_price_declaration',
  codeCategory: 'feature_center.operations_price_declaration',
  codeDirectory: 'src/features/featureCenter/operationsPriceDeclaration/index.js',
  windowAction: 'open-operations-price-declaration',
  modules: [
    operationsPriceDeclarationModule
  ]
});

module.exports = {
  operationsPriceDeclarationFeature
};


