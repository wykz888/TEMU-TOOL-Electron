const { aiCreativeCopyModule } = require('./creativeCopy');
const { aiIdeaBoardModule } = require('./ideaBoard');

const aiCreationFeature = Object.freeze({
  kind: 'feature',
  id: 'ai-creation',
  tag: 'AI',
  title: 'AI\u521b\u4f5c',
  description: '\u7528\u4e8e\u96c6\u4e2d\u627f\u8f7d AI \u6587\u6848\u3001\u521b\u610f\u8349\u7a3f\u3001\u5370\u82b1\u63d0\u793a\u8bcd\u4e0e\u5185\u5bb9\u6784\u601d\u7b49\u521b\u4f5c\u6d41\u7a0b\u3002',
  storageKey: 'creation_center/ai_creation',
  codeCategory: 'creation_center.ai_creation',
  codeDirectory: 'src/features/creationCenter/aiCreation/index.js',
  modules: [
    aiCreativeCopyModule,
    aiIdeaBoardModule
  ]
});

module.exports = {
  aiCreationFeature
};
