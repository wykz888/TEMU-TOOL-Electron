const {
  createOperationsModuleWorkbenchWindow
} = require('./createOperationsModuleWorkbenchWindow');
const {
  operationsActivityManagementFeature
} = require('../features/featureCenter/operationsActivityManagement');

function createOperationsActivityManagementWindow(options = {}) {
  return createOperationsModuleWorkbenchWindow({
    ...options,
    title: options && options.title ? options.title : operationsActivityManagementFeature.title,
    mode: 'activity-management',
    moduleId: 'activity',
    rendererFileName: 'operationsActivityManagement.html',
    width: 1560,
    height: 940
  });
}

module.exports = {
  createOperationsActivityManagementWindow
};
