const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const preloadDir = path.join(rootDir, 'src', 'preload');
const preloadText = fs.readdirSync(preloadDir)
  .filter((fileName) => fileName.endsWith('.js'))
  .map((fileName) => fs.readFileSync(path.join(preloadDir, fileName), 'utf8'))
  .join('\n');
const mainText = readSource('src/main.js');
const openIpcText = readSource('src/ipc/registerFeatureCenterOpenIpc.js');
const channelsText = readSource('src/ipc/featureChannels.js');
const featureCatalogText = readSource('src/features/featureCenter/catalog.js');

const { FEATURE_CHANNELS } = require('../src/ipc/featureChannels');
const {
  operationsActivityManagementFeature
} = require('../src/features/featureCenter/operationsActivityManagement');
const {
  operationsTrafficBoostFeature
} = require('../src/features/featureCenter/operationsTrafficBoost');
const {
  operationsNewProductLifecycleFeature
} = require('../src/features/featureCenter/operationsNewProductLifecycle');

function assertIncludes(source, needle, label) {
  assert.ok(source.includes(needle), `${label} missing: ${needle}`);
}

function assertMethod(source, methodName, label) {
  const pattern = new RegExp(`\\b${methodName}\\s*(?:\\(|:)`);
  assert.ok(pattern.test(source), `${label} missing method: ${methodName}`);
}

function assertServiceMethod(source, methodName, label) {
  const pattern = new RegExp(`\\basync\\s+${methodName}\\s*\\(`);
  assert.ok(pattern.test(source), `${label} missing service method: ${methodName}`);
}

function assertChannel(channelKey) {
  assert.equal(typeof FEATURE_CHANNELS[channelKey], 'string', `channel missing: ${channelKey}`);
  assertIncludes(channelsText, `${channelKey}:`, 'feature channel source');
}

function assertPreloadInvoke(methodName, channelKey) {
  assertMethod(preloadText, methodName, 'operations preload');
  assertIncludes(preloadText, `FEATURE_CHANNELS.${channelKey}`, `preload ${methodName}`);
}

function assertPreloadSubscribe(methodName, channelKey) {
  assertMethod(preloadText, methodName, 'operations preload');
  assertIncludes(preloadText, `FEATURE_CHANNELS.${channelKey}`, `preload event ${methodName}`);
}

function assertMainOption(methodName) {
  const pattern = new RegExp(`\\b${methodName}\\s*:`);
  assert.ok(pattern.test(mainText), `main option missing: ${methodName}`);
}

function assertMainServiceCall(serviceName, serviceMethod) {
  assertIncludes(mainText, `${serviceName}.${serviceMethod}`, `main service call ${serviceName}`);
}

function assertRendererCall(rendererText, methodName) {
  assertMethod(rendererText, methodName, 'renderer feature API call');
}

function validateOpenChain(chain) {
  assert.equal(chain.feature.windowAction, chain.windowAction, `${chain.id} windowAction mismatch`);
  assert.equal(chain.feature.title, chain.title, `${chain.id} title mismatch`);
  assertIncludes(featureCatalogText, chain.catalogExport, `${chain.id} catalog export`);
  assertChannel(chain.openChannel);
  assertPreloadInvoke(chain.openMethod, chain.openChannel);
  assertIncludes(openIpcText, chain.openOption, `${chain.id} open ipc option`);
  assertIncludes(openIpcText, `FEATURE_CHANNELS.${chain.openChannel}`, `${chain.id} open ipc channel`);
  assertMainOption(chain.openOption);
}

function validateInvokeChain(chain, api) {
  assertChannel(api.channel);
  assertPreloadInvoke(api.method, api.channel);
  assertIncludes(chain.registerText, api.method, `${chain.id} ipc option`);
  assertIncludes(chain.registerText, `FEATURE_CHANNELS.${api.channel}`, `${chain.id} ipc channel`);
  assertMainOption(api.method);
  if (api.mainService && api.serviceMethod) {
    assertMainServiceCall(api.mainService, api.serviceMethod);
  }
  if (api.serviceText && api.serviceMethod) {
    assertServiceMethod(api.serviceText, api.serviceMethod, `${chain.id} service`);
  }
  if (api.rendererRequired !== false) {
    assertRendererCall(chain.rendererText, api.method);
  }
}

function validateEventChain(chain, eventApi) {
  assertChannel(eventApi.channel);
  assertPreloadSubscribe(eventApi.method, eventApi.channel);
  assertRendererCall(chain.rendererText, eventApi.method);
}

const activityServiceText = readSource('src/services/featureCenter/operationsActivityManagementService.js');
const activityLogServiceText = readSource('src/services/featureCenter/operationsActivityBackgroundLogService.js');
const trafficServiceText = readSource('src/services/featureCenter/operationsTrafficBoostService.js');
const lifecycleServiceText = readSource('src/services/featureCenter/operationsNewProductLifecycleService.js');

const chains = [
  {
    id: 'operations activity management',
    feature: operationsActivityManagementFeature,
    title: '\u8425\u9500\u6d3b\u52a8',
    windowAction: 'open-operations-activity-management',
    openMethod: 'openOperationsActivityManagement',
    openChannel: 'OPEN_OPERATIONS_ACTIVITY_MANAGEMENT',
    openOption: 'onOpenOperationsActivityManagement',
    catalogExport: 'operationsActivityManagementFeature',
    rendererText: readSource('src/renderer/operationsActivityManagementView.js'),
    registerText: readSource('src/ipc/registerFeatureCenterOperationsActivityIpc.js'),
    apis: [
      ['queryOperationsActivityManagementActivities', 'QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_ACTIVITIES', 'operationsActivityManagementService', 'queryActivityListByShops', activityServiceText],
      ['queryOperationsActivityManagementMatchProducts', 'QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS', 'operationsActivityManagementService', 'queryActivityMatchProducts', activityServiceText],
      ['getOperationsActivityManagementMatchProductsPage', 'GET_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_PAGE', 'operationsActivityManagementService', 'getActivityMatchProductsPage', activityServiceText],
      ['queryOperationsActivityManagementMatchProductsBatch', 'QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH', 'operationsActivityManagementService', 'queryActivityMatchProductsBatch', activityServiceText],
      ['cancelOperationsActivityManagementMatchProductsBatchQuery', 'CANCEL_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_QUERY', 'operationsActivityManagementService', 'cancelActivityMatchProductsBatchQuery', activityServiceText],
      ['cancelOperationsActivityManagementMatchProductsBatchSubmit', 'CANCEL_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_SUBMIT', 'operationsActivityManagementService', 'cancelActivityMatchProductsBatchSubmit', activityServiceText],
      ['getOperationsActivityManagementMatchProductsBatchPage', 'GET_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_PAGE', 'operationsActivityManagementService', 'getActivityMatchProductsBatchPage', activityServiceText],
      ['submitOperationsActivityManagementMatchProductsBatch', 'SUBMIT_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH', 'operationsActivityManagementService', 'submitActivityMatchProductsBatch', activityServiceText],
      ['startOperationsActivityManagementBackgroundLogSession', 'START_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_SESSION', 'operationsActivityBackgroundLogService', 'startSession', activityLogServiceText],
      ['appendOperationsActivityManagementBackgroundLogRows', 'APPEND_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_ROWS', 'operationsActivityBackgroundLogService', 'appendRows', activityLogServiceText],
      ['finishOperationsActivityManagementBackgroundLogSession', 'FINISH_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_SESSION', 'operationsActivityBackgroundLogService', 'finishSession', activityLogServiceText],
      ['getOperationsActivityManagementFilterSettings', 'GET_OPERATIONS_ACTIVITY_MANAGEMENT_FILTER_SETTINGS', 'operationsActivityManagementService', 'getFilterSettings', activityServiceText],
      ['saveOperationsActivityManagementFilterSettings', 'SAVE_OPERATIONS_ACTIVITY_MANAGEMENT_FILTER_SETTINGS', 'operationsActivityManagementService', 'saveFilterSettings', activityServiceText],
      ['getOperationsActivityManagementProductFilterSettings', 'GET_OPERATIONS_ACTIVITY_MANAGEMENT_PRODUCT_FILTER_SETTINGS', 'operationsActivityManagementService', 'getProductFilterSettings', activityServiceText],
      ['saveOperationsActivityManagementProductFilterSettings', 'SAVE_OPERATIONS_ACTIVITY_MANAGEMENT_PRODUCT_FILTER_SETTINGS', 'operationsActivityManagementService', 'saveProductFilterSettings', activityServiceText]
    ],
    events: [
      ['onOperationsActivityManagementBatchProgress', 'OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_PROGRESS']
    ]
  },
  {
    id: 'operations traffic boost',
    feature: operationsTrafficBoostFeature,
    title: '\u6d41\u91cf\u52a0\u901f',
    windowAction: 'open-operations-traffic-boost',
    openMethod: 'openOperationsTrafficBoost',
    openChannel: 'OPEN_OPERATIONS_TRAFFIC_BOOST',
    openOption: 'onOpenOperationsTrafficBoost',
    catalogExport: 'operationsTrafficBoostFeature',
    rendererText: readSource('src/renderer/operationsTrafficBoostView.js'),
    registerText: readSource('src/ipc/registerFeatureCenterOperationsTrafficBoostIpc.js'),
    apis: [
      ['queryOperationsTrafficBoostRows', 'QUERY_OPERATIONS_TRAFFIC_BOOST_ROWS', 'operationsTrafficBoostService', 'queryRows', trafficServiceText],
      ['submitOperationsTrafficBoostProducts', 'SUBMIT_OPERATIONS_TRAFFIC_BOOST_PRODUCTS', 'operationsTrafficBoostService', 'submitEnableBatch', trafficServiceText],
      ['cancelOperationsTrafficBoostQuery', 'CANCEL_OPERATIONS_TRAFFIC_BOOST_QUERY', 'operationsTrafficBoostService', 'cancelQueryJob', trafficServiceText],
      ['cancelOperationsTrafficBoostSubmit', 'CANCEL_OPERATIONS_TRAFFIC_BOOST_SUBMIT', 'operationsTrafficBoostService', 'cancelSubmitJob', trafficServiceText],
      ['getOperationsTrafficBoostProgressSnapshot', 'GET_OPERATIONS_TRAFFIC_BOOST_PROGRESS_SNAPSHOT', 'operationsTrafficBoostService', 'getQueryProgressSnapshot', trafficServiceText],
      ['getOperationsTrafficBoostCustomLevelFilterSettings', 'GET_OPERATIONS_TRAFFIC_BOOST_CUSTOM_LEVEL_FILTER_SETTINGS', 'operationsTrafficBoostService', 'getCustomLevelFilterSettings', trafficServiceText],
      ['saveOperationsTrafficBoostCustomLevelFilterSettings', 'SAVE_OPERATIONS_TRAFFIC_BOOST_CUSTOM_LEVEL_FILTER_SETTINGS', 'operationsTrafficBoostService', 'saveCustomLevelFilterSettings', trafficServiceText]
    ],
    events: [
      ['onOperationsTrafficBoostProgress', 'OPERATIONS_TRAFFIC_BOOST_PROGRESS']
    ]
  },
  {
    id: 'operations new product lifecycle',
    feature: operationsNewProductLifecycleFeature,
    title: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u7ba1\u7406',
    windowAction: 'open-operations-new-product-lifecycle',
    openMethod: 'openOperationsNewProductLifecycle',
    openChannel: 'OPEN_OPERATIONS_NEW_PRODUCT_LIFECYCLE',
    openOption: 'onOpenOperationsNewProductLifecycle',
    catalogExport: 'operationsNewProductLifecycleFeature',
    rendererText: readSource('src/renderer/operationsNewProductLifecycleView.js'),
    registerText: readSource('src/ipc/registerFeatureCenterOperationsNewProductLifecycleIpc.js'),
    apis: [
      ['queryOperationsNewProductLifecycleRows', 'QUERY_OPERATIONS_NEW_PRODUCT_LIFECYCLE_ROWS', 'operationsNewProductLifecycleService', 'queryRows', lifecycleServiceText],
      ['cancelOperationsNewProductLifecycleQuery', 'CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY', 'operationsNewProductLifecycleService', 'cancelQueryJob', lifecycleServiceText],
      ['getOperationsNewProductLifecycleQuerySettings', 'GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_SETTINGS', 'operationsNewProductLifecycleService', 'getQuerySettings', lifecycleServiceText],
      ['saveOperationsNewProductLifecycleQuerySettings', 'SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_SETTINGS', 'operationsNewProductLifecycleService', 'saveQuerySettings', lifecycleServiceText],
      ['getOperationsNewProductLifecycleBatchAdjustPresetSnapshot', 'GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PRESET_SNAPSHOT', 'operationsNewProductLifecycleService', 'getBatchAdjustPresetSnapshot', lifecycleServiceText],
      ['saveOperationsNewProductLifecycleBatchAdjustPresetBatch', 'SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PRESET_BATCH', 'operationsNewProductLifecycleService', 'saveBatchAdjustPresetBatch', lifecycleServiceText, false],
      ['previewOperationsNewProductLifecycleBatchAdjust', 'PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST', 'operationsNewProductLifecycleService', 'previewBatchAdjust', lifecycleServiceText],
      ['submitOperationsNewProductLifecycleBatchAdjust', 'SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST', 'operationsNewProductLifecycleService', 'submitBatchAdjust', lifecycleServiceText],
      ['cancelOperationsNewProductLifecycleBatchAdjust', 'CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST', 'operationsNewProductLifecycleService', 'cancelBatchAdjust', lifecycleServiceText],
      ['previewOperationsNewProductLifecycleBatchPriceDecl', 'PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL', 'operationsNewProductLifecycleService', 'previewBatchPriceDeclaration', lifecycleServiceText],
      ['submitOperationsNewProductLifecycleBatchPriceDecl', 'SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL', 'operationsNewProductLifecycleService', 'submitBatchPriceDeclaration', lifecycleServiceText],
      ['cancelOperationsNewProductLifecycleBatchPriceDecl', 'CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL', 'operationsNewProductLifecycleService', 'cancelBatchPriceDeclaration', lifecycleServiceText],
      ['getOperationsNewProductLifecyclePriceDeclSettings', 'GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_PRICE_DECL_SETTINGS', 'operationsNewProductLifecycleService', 'getPriceDeclSettings', lifecycleServiceText],
      ['saveOperationsNewProductLifecyclePriceDeclSettings', 'SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_PRICE_DECL_SETTINGS', 'operationsNewProductLifecycleService', 'savePriceDeclSettings', lifecycleServiceText]
    ],
    events: [
      ['onOperationsNewProductLifecycleProgress', 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_PROGRESS'],
      ['onOperationsNewProductLifecycleBatchAdjustProgress', 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PROGRESS']
    ]
  }
];

function main() {
  chains.forEach((chain) => {
    validateOpenChain(chain);
    chain.apis.forEach(([
      method,
      channel,
      mainService,
      serviceMethod,
      serviceText,
      rendererRequired
    ]) => validateInvokeChain(chain, {
      method,
      channel,
      mainService,
      serviceMethod,
      serviceText,
      rendererRequired
    }));
    chain.events.forEach(([method, channel]) => validateEventChain(chain, { method, channel }));
  });

  console.log('operations feature chain validation passed');
}

main();
