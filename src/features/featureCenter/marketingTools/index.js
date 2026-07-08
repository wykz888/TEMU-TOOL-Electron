const {
  marketingToolsSingleProductCouponModule
} = require('./singleProductCoupon');
const {
  marketingToolsStoreFullReductionCouponModule
} = require('./storeFullReductionCoupon');
const { marketingToolsReviewRewardModule } = require('./reviewReward');
const {
  marketingToolsFreeShippingPromotionModule
} = require('./freeShippingPromotion');

const marketingToolsFeature = Object.freeze({
  kind: 'feature',
  id: 'marketing-tools',
  tag: '\u8425\u9500',
  title: '\u8425\u9500\u5de5\u5177',
  description: '\u96C6\u4E2D\u7BA1\u7406\u5E38\u7528 TEMU \u8425\u9500\u5DE5\u5177\uFF0C\u652F\u6301\u5355\u54C1\u5238\u3001\u6EE1\u51CF\u5238\u3001\u8BC4\u4EF7\u6709\u793C\u53CA\u5305\u90AE\u914D\u7F6E\u3002',
  storageKey: 'feature_center/marketing_tools',
  codeCategory: 'feature_center.marketing_tools',
  codeDirectory: 'src/features/featureCenter/marketingTools/index.js',
  windowAction: 'open-marketing-tools',
  modules: [
    marketingToolsSingleProductCouponModule,
    marketingToolsStoreFullReductionCouponModule,
    marketingToolsReviewRewardModule,
    marketingToolsFreeShippingPromotionModule
  ]
});

module.exports = {
  marketingToolsFeature
};


