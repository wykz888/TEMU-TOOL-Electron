const { operationsTrafficBoostModule } = require('./trafficBoostModule');

const operationsTrafficBoostFeature = Object.freeze({
  kind: 'feature',
  id: 'operations-traffic-boost-workbench',
  tag: '\u6d41\u91cf',
  title: '\u6d41\u91cf\u52a0\u901f',
  description: '\u67E5\u8BE2\u5E97\u94FA\u6D41\u91CF\u52A0\u901F\u5546\u54C1\uFF0C\u81EA\u52A8\u62C9\u53D6SKU\u4EF7\u683C\u660E\u7EC6\uFF0C\u652F\u6301\u81EA\u5B9A\u4E49\u76EE\u6807\u4EF7\u63D0\u4EA4\u3002',
  storageKey: 'feature_center/operations_traffic_boost',
  codeCategory: 'feature_center.operations_traffic_boost',
  codeDirectory: 'src/features/featureCenter/operationsTrafficBoost/index.js',
  windowAction: 'open-operations-traffic-boost',
  modules: [
    operationsTrafficBoostModule
  ]
});

module.exports = {
  operationsTrafficBoostFeature
};


