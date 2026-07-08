const {
  createOperationsModuleWorkbenchWindow
} = require('./createOperationsModuleWorkbenchWindow');
const {
  operationsNewProductLifecycleFeature
} = require('../features/featureCenter/operationsNewProductLifecycle');

function createOperationsNewProductLifecycleWindow(options = {}) {
  return createOperationsModuleWorkbenchWindow({
    ...options,
    title: options && options.title ? options.title : operationsNewProductLifecycleFeature.title,
    mode: 'new-product-lifecycle',
    moduleId: 'new-product-lifecycle',
    rendererFileName: 'operationsNewProductLifecycle.html'
  });
}

module.exports = {
  createOperationsNewProductLifecycleWindow
};
