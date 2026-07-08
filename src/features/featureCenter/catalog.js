const { globalCategorySyncFeature } = require('./globalCategorySync');
const { marketingToolsFeature } = require('./marketingTools');
const {
  operationsActivityManagementFeature
} = require('./operationsActivityManagement');
const {
  operationsNewProductLifecycleFeature
} = require('./operationsNewProductLifecycle');
const {
  operationsPriceDeclarationFeature
} = require('./operationsPriceDeclaration');
const {
  operationsTrafficBoostFeature
} = require('./operationsTrafficBoost');
const { promotionMasterFeature } = require('./promotionMaster');
const { podUploadSheetMiaoshouFeature } = require('./podUploadSheetMiaoshou');
const {
  podUploadSheetMiaoshouUniversalFeature
} = require('./podUploadSheetMiaoshouUniversal');

const FEATURE_CENTER_CATALOG = Object.freeze([
  globalCategorySyncFeature,
  operationsActivityManagementFeature,
  operationsTrafficBoostFeature,
  operationsPriceDeclarationFeature,
  operationsNewProductLifecycleFeature,
  marketingToolsFeature,
  promotionMasterFeature,
  podUploadSheetMiaoshouFeature,
  podUploadSheetMiaoshouUniversalFeature
]);

function getFeatureCenterFeatureById(featureId) {
  return FEATURE_CENTER_CATALOG.find((feature) => feature.id === featureId) || null;
}

module.exports = {
  FEATURE_CENTER_CATALOG,
  getFeatureCenterFeatureById
};
