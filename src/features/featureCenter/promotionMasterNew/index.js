const {
  promotionMasterNewCampaignCreateModule
} = require('./campaignCreate');
const {
  promotionMasterNewCampaignDetailModule
} = require('./campaignDetail');
const {
  promotionMasterNewCampaignMonitorModule
} = require('./campaignMonitor');

const promotionMasterNewFeature = Object.freeze({
  kind: 'feature',
  id: 'promotion-master-new',
  tag: '\u63a8\u5e7f',
  title: '\u63a8\u5e7f\u5927\u5e08-\u65b0',
  description: '\u53c2\u8003\u63a8\u5e7f\u5927\u5e08\u7684\u6838\u5fc3\u6d41\u7a0b\uff0c\u63d0\u4f9b\u66f4\u7d27\u51d1\u7684\u63a8\u5e7f\u521b\u5efa\u3001\u660e\u7ec6\u548c\u76d1\u63a7\u5de5\u4f5c\u53f0\u5e03\u5c40\u3002',
  storageKey: 'feature_center/promotion_master_new',
  codeCategory: 'feature_center.promotion_master_new',
  codeDirectory: 'src/features/featureCenter/promotionMasterNew/index.js',
  windowAction: 'open-promotion-manager-new',
  modules: [
    promotionMasterNewCampaignCreateModule,
    promotionMasterNewCampaignDetailModule,
    promotionMasterNewCampaignMonitorModule
  ]
});

module.exports = {
  promotionMasterNewFeature
};
