const { podPromptWorkbenchModule } = require('./promptWorkbench');
const { podImageSelectionModule } = require('./imageSelection');

const podImageFeature = Object.freeze({
  kind: 'feature',
  id: 'pod-image',
  tag: 'POD',
  title: 'POD\u751f\u56fe',
  description: '\u7528\u4e8e\u627f\u8f7d POD \u751f\u56fe\u3001\u63d0\u793a\u8bcd\u7ba1\u7406\u3001\u51fa\u56fe\u7b5b\u9009\u4e0e\u540e\u7eed\u4e0a\u8d27\u8854\u63a5\u80fd\u529b\u3002',
  storageKey: 'creation_center/pod_image',
  codeCategory: 'creation_center.pod_image',
  codeDirectory: 'src/features/creationCenter/podImage/index.js',
  modules: [
    podPromptWorkbenchModule,
    podImageSelectionModule
  ]
});

module.exports = {
  podImageFeature
};
