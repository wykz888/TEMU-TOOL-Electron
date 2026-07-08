const {
  createOperationsModuleWorkbenchWindow
} = require('./createOperationsModuleWorkbenchWindow');
const {
  operationsTrafficBoostFeature
} = require('../features/featureCenter/operationsTrafficBoost');

function createOperationsTrafficBoostWindow(options = {}) {
  return createOperationsModuleWorkbenchWindow({
    ...options,
    title: options && options.title ? options.title : operationsTrafficBoostFeature.title,
    mode: 'traffic-boost',
    moduleId: 'traffic',
    rendererFileName: 'operationsTrafficBoost.html'
  });
}

module.exports = {
  createOperationsTrafficBoostWindow
};
