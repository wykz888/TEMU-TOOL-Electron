const { operationsActivityManagementModule } = require('./activityManagementModule');

const operationsActivityManagementFeature = Object.freeze({
  kind: 'feature',
  id: 'operations-activity-workbench',
  tag: '\u8425\u9500',
  title: '\u8425\u9500\u6d3b\u52a8',
  description: '\u67E5\u8BE2\u5404\u5E97\u94FA\u53EF\u62A5\u540D\u6D3B\u52A8\uFF0C\u652F\u6301\u6298\u6263\u7B5B\u9009\u3001\u6279\u91CF\u63D0\u4EA4\u53CA\u8FD0\u884C\u65E5\u5FD7\u8DDF\u8E2A\u3002',
  storageKey: 'feature_center/operations_activity_management',
  codeCategory: 'feature_center.operations_activity_management',
  codeDirectory: 'src/features/featureCenter/operationsActivityManagement/index.js',
  windowAction: 'open-operations-activity-management',
  modules: [
    operationsActivityManagementModule
  ]
});

module.exports = {
  operationsActivityManagementFeature
};


