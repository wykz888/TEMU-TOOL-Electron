const { aiBatchTitleGeneratorModule } = require('./batchTitleGenerator');
const { aiTitleTemplateModule } = require('./titleTemplate');

const aiTitleFeature = Object.freeze({
  kind: 'feature',
  id: 'ai-title',
  tag: 'AI',
  title: 'AI\u6807\u9898',
  description: 'AI\u6807\u9898\u80fd\u529b\u7B79\u5907\u4E2D\uFF0C\u5F53\u524D\u8FD8\u672A\u5F00\u53D1\u5DE5\u4F5C\u53F0\u529F\u80FD\uFF0C\u6682\u4E0D\u5F00\u653E\u4F7F\u7528\u3002',
  storageKey: 'creation_center/ai_title',
  codeCategory: 'creation_center.ai_title',
  codeDirectory: 'src/features/creationCenter/aiTitle/index.js',
  modules: [
    aiBatchTitleGeneratorModule,
    aiTitleTemplateModule
  ]
});

module.exports = {
  aiTitleFeature
};
