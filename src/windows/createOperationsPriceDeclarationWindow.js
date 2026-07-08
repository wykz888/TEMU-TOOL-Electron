const {
  createOperationsModuleWorkbenchWindow
} = require('./createOperationsModuleWorkbenchWindow');
const {
  operationsPriceDeclarationFeature
} = require('../features/featureCenter/operationsPriceDeclaration');

function createOperationsPriceDeclarationWindow(options = {}) {
  return createOperationsModuleWorkbenchWindow({
    ...options,
    title: options && options.title ? options.title : operationsPriceDeclarationFeature.title,
    mode: 'price-declaration',
    moduleId: 'price-declaration',
    rendererFileName: 'operationsPriceDeclaration.html'
  });
}

module.exports = {
  createOperationsPriceDeclarationWindow
};
