const { jimengImageFeature } = require('./jimengImage');
const { podSuiteToolFeature } = require('./podSuiteTool');

const CREATION_CENTER_CATALOG = Object.freeze([
  jimengImageFeature,
  podSuiteToolFeature
]);

function getCreationCenterFeatureById(featureId) {
  return CREATION_CENTER_CATALOG.find((feature) => feature.id === featureId) || null;
}

module.exports = {
  CREATION_CENTER_CATALOG,
  getCreationCenterFeatureById
};
