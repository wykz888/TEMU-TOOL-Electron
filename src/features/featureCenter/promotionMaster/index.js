const { promotionCampaignCreateModule } = require('./campaignCreate');
const { promotionCampaignDetailModule } = require('./campaignDetail');
const { promotionCampaignMonitorModule } = require('./campaignMonitor');

const promotionMasterFeature = Object.freeze({
  kind: 'feature',
  id: 'promotion-master',
  tag: '\u63A8\u5E7F',
  title: '\u63A8\u5E7F\u5927\u5E08',
  description: '\u7528\u4E8E\u63A8\u5E7F\u8BA1\u5212\u521B\u5EFA\u3001\u6D3B\u52A8\u8BE6\u60C5\u67E5\u770B\u53CA\u6548\u679C\u76D1\u63A7\uFF0C\u652F\u6301\u5E97\u94FA\u4F1A\u8BDD\u590D\u7528\u8DDF\u8E2A\u3002',
  storageKey: 'feature_center/promotion_master',
  codeCategory: 'feature_center.promotion_master',
  codeDirectory: 'src/features/featureCenter/promotionMaster/index.js',
  windowAction: 'open-promotion-manager',
  modules: [
    promotionCampaignCreateModule,
    promotionCampaignDetailModule,
    promotionCampaignMonitorModule
  ]
});

module.exports = {
  promotionMasterFeature
};


