const {
  registerFeatureCenterOperationsActivityIpc
} = require('./registerFeatureCenterOperationsActivityIpc');
const {
  registerFeatureCenterOperationsNewProductLifecycleIpc
} = require('./registerFeatureCenterOperationsNewProductLifecycleIpc');
const {
  registerFeatureCenterOperationsPriceDeclarationIpc
} = require('./registerFeatureCenterOperationsPriceDeclarationIpc');
const {
  registerFeatureCenterOperationsSharedIpc
} = require('./registerFeatureCenterOperationsSharedIpc');
const {
  registerFeatureCenterOperationsTrafficBoostIpc
} = require('./registerFeatureCenterOperationsTrafficBoostIpc');

function registerFeatureCenterOperationsIpc(options = {}) {
  registerFeatureCenterOperationsSharedIpc(options);
  registerFeatureCenterOperationsActivityIpc(options);
  registerFeatureCenterOperationsTrafficBoostIpc(options);
  registerFeatureCenterOperationsNewProductLifecycleIpc(options);
  registerFeatureCenterOperationsPriceDeclarationIpc(options);
}

module.exports = {
  registerFeatureCenterOperationsIpc
};
