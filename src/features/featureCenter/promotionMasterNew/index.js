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
  title: '\u63a8\u5e7f\u5927\u5e08',
  description: '\u7edf\u4e00\u7ba1\u7406\u63a8\u5e7f\u521b\u5efa\u3001\u63a8\u5e7f\u660e\u7ec6\u548c\u63a8\u5e7f\u76d1\u63a7\u3002',
  storageKey: 'feature_center/promotion_master_new',
  codeCategory: 'feature_center.promotion_master_new',
  codeDirectory: 'src/features/featureCenter/promotionMasterNew/index.js',
  windowAction: 'open-promotion-manager',
  modules: [
    promotionMasterNewCampaignCreateModule,
    promotionMasterNewCampaignDetailModule,
    promotionMasterNewCampaignMonitorModule
  ]
});

module.exports = {
  promotionMasterNewFeature
};
