const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const appPreloadText = fs.readFileSync(
  path.join(rootDir, 'src', 'preload', 'appPreload.js'),
  'utf8'
);
const preloadDir = path.join(rootDir, 'src', 'preload');
const preloadSurfaceText = fs.readdirSync(preloadDir)
  .filter((fileName) => fileName.endsWith('.js'))
  .map((fileName) => fs.readFileSync(path.join(preloadDir, fileName), 'utf8'))
  .join('\n');
const ipcDir = path.join(rootDir, 'src', 'ipc');
const featureRegisterText = fs.readdirSync(ipcDir)
  .filter((fileName) => /^registerFeatureCenter.*\.js$/.test(fileName))
  .map((fileName) => fs.readFileSync(path.join(ipcDir, fileName), 'utf8'))
  .join('\n');
const creationRegisterText = fs.readFileSync(
  path.join(rootDir, 'src', 'ipc', 'registerCreationCenterIpc.js'),
  'utf8'
);
const podSuiteToolRegisterText = fs.readFileSync(
  path.join(rootDir, 'src', 'ipc', 'registerPodSuiteToolIpc.js'),
  'utf8'
);
const shopManagementRegisterText = fs.readFileSync(
  path.join(rootDir, 'src', 'ipc', 'registerShopManagementIpc.js'),
  'utf8'
);
const globalConfigRegisterText = fs.readFileSync(
  path.join(rootDir, 'src', 'ipc', 'registerGlobalConfigIpc.js'),
  'utf8'
);
const updaterRegisterText = fs.readFileSync(
  path.join(rootDir, 'src', 'ipc', 'registerUpdaterIpc.js'),
  'utf8'
);
const { FEATURE_CHANNELS } = require('../src/ipc/featureChannels');
const { CREATION_CHANNELS } = require('../src/ipc/creationCenterChannels');
const { POD_SUITE_TOOL_CHANNELS } = require('../src/ipc/podSuiteToolChannels');
const { SHOP_CHANNELS } = require('../src/ipc/shopChannels');
const { GLOBAL_CONFIG_CHANNELS } = require('../src/ipc/globalConfigChannels');
const { UPDATE_CHANNELS } = require('../src/ipc/updateChannels');

const EXPECTED_FEATURE_INVOKES = Object.freeze([
  ['getFeatureCatalog', 'GET_FEATURE_CATALOG'],
  ['openOperationsActivityManagement', 'OPEN_OPERATIONS_ACTIVITY_MANAGEMENT'],
  ['openOperationsTrafficBoost', 'OPEN_OPERATIONS_TRAFFIC_BOOST'],
  ['openOperationsPriceDeclaration', 'OPEN_OPERATIONS_PRICE_DECLARATION'],
  ['openOperationsNewProductLifecycle', 'OPEN_OPERATIONS_NEW_PRODUCT_LIFECYCLE'],
  ['submitOperationsTrafficBoostProducts', 'SUBMIT_OPERATIONS_TRAFFIC_BOOST_PRODUCTS'],
  ['cancelOperationsTrafficBoostQuery', 'CANCEL_OPERATIONS_TRAFFIC_BOOST_QUERY'],
  ['cancelOperationsTrafficBoostSubmit', 'CANCEL_OPERATIONS_TRAFFIC_BOOST_SUBMIT'],
  ['previewOperationsNewProductLifecycleBatchAdjust', 'PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST'],
  ['submitOperationsNewProductLifecycleBatchAdjust', 'SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST'],
  ['cancelOperationsNewProductLifecycleBatchAdjust', 'CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST'],
  ['previewOperationsNewProductLifecycleBatchPriceDecl', 'PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL'],
  ['submitOperationsNewProductLifecycleBatchPriceDecl', 'SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL'],
  ['cancelOperationsNewProductLifecycleBatchPriceDecl', 'CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL'],
  ['queryOperationsPriceDeclarationRows', 'QUERY_OPERATIONS_PRICE_DECLARATION_ROWS'],
  ['cancelOperationsPriceDeclarationQuery', 'CANCEL_OPERATIONS_PRICE_DECLARATION_QUERY'],
  ['batchRejectOperationsPriceDeclarationRows', 'BATCH_REJECT_OPERATIONS_PRICE_DECLARATION_ROWS'],
  ['getPromotionManagerNewCreateSettings', 'GET_PROMOTION_MANAGER_NEW_CREATE_SETTINGS'],
  ['savePromotionManagerNewCreateSettings', 'SAVE_PROMOTION_MANAGER_NEW_CREATE_SETTINGS'],
  ['queryPromotionManagerNewGoods', 'QUERY_PROMOTION_MANAGER_NEW_GOODS'],
  ['cancelPromotionManagerNewGoodsQuery', 'CANCEL_PROMOTION_MANAGER_NEW_GOODS_QUERY'],
  ['createPromotionManagerNewAds', 'CREATE_PROMOTION_MANAGER_NEW_ADS'],
  ['cancelPromotionManagerNewAdsCreate', 'CANCEL_PROMOTION_MANAGER_NEW_ADS_CREATE'],
  ['queryPromotionManagerNewShopData', 'QUERY_PROMOTION_MANAGER_NEW_SHOP_DATA'],
  ['getPodUploadSheetMiaoshouAiTitleConfig', 'GET_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_CONFIG'],
  ['savePodUploadSheetMiaoshouAiTitleConfig', 'SAVE_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_CONFIG']
]);

const EXPECTED_FEATURE_EVENTS = Object.freeze([
  ['onOperationsTrafficBoostProgress', 'OPERATIONS_TRAFFIC_BOOST_PROGRESS'],
  ['onOperationsNewProductLifecycleProgress', 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_PROGRESS'],
  ['onOperationsNewProductLifecycleBatchAdjustProgress', 'OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PROGRESS'],
  ['onOperationsPriceDeclarationProgress', 'OPERATIONS_PRICE_DECLARATION_PROGRESS']
]);

const EXPECTED_CREATION_INVOKES = Object.freeze([
  ['getCreationCatalog', 'GET_CREATION_CATALOG'],
  ['openPodUploadSheetMiaoshou', 'OPEN_POD_UPLOAD_SHEET_MIAOSHOU'],
  ['openPodSuiteTool', 'OPEN_POD_SUITE_TOOL']
]);

const EXPECTED_POD_SUITE_TOOL_INVOKES = Object.freeze([
  ['selectWhiteMockupFile', 'SELECT_WHITE_MOCKUP_FILE'],
  ['selectMaskImageFile', 'SELECT_MASK_IMAGE_FILE'],
  ['selectTextureImageFile', 'SELECT_TEXTURE_IMAGE_FILE'],
  ['selectPreviewDesignFile', 'SELECT_PREVIEW_DESIGN_FILE'],
  ['selectImageDirectory', 'SELECT_IMAGE_DIRECTORY'],
  ['selectOutputDirectory', 'SELECT_OUTPUT_DIRECTORY'],
  ['collectImageFiles', 'COLLECT_IMAGE_FILES'],
  ['selectPsdMockupFile', 'SELECT_PSD_MOCKUP_FILE'],
  ['selectPsdImageDirectory', 'SELECT_PSD_IMAGE_DIRECTORY'],
  ['selectPsdOutputDirectory', 'SELECT_PSD_OUTPUT_DIRECTORY'],
  ['selectPsdMetadataSourceFile', 'SELECT_PSD_METADATA_SOURCE_FILE'],
  ['selectPsdMetadataSourceDirectory', 'SELECT_PSD_METADATA_SOURCE_DIRECTORY'],
  ['openDirectory', 'OPEN_DIRECTORY'],
  ['generateWhiteMockups', 'GENERATE_WHITE_MOCKUPS'],
  ['generatePsdSmartObjectMockups', 'GENERATE_PSD_SMART_OBJECT_MOCKUPS'],
  ['cancelPsdSmartObjectMockups', 'CANCEL_PSD_SMART_OBJECT_MOCKUPS'],
  ['getPsdSmartObjectTemplates', 'GET_PSD_SMART_OBJECT_TEMPLATES'],
  ['savePsdSmartObjectTemplate', 'SAVE_PSD_SMART_OBJECT_TEMPLATE'],
  ['deletePsdSmartObjectTemplate', 'DELETE_PSD_SMART_OBJECT_TEMPLATE'],
  ['renderWhiteMockupPreview', 'RENDER_WHITE_MOCKUP_PREVIEW'],
  ['getWhiteMockupTemplate', 'GET_WHITE_MOCKUP_TEMPLATE'],
  ['saveWhiteMockupTemplate', 'SAVE_WHITE_MOCKUP_TEMPLATE'],
  ['createWhiteMockupRegionFromMask', 'CREATE_WHITE_MOCKUP_REGION_FROM_MASK']
]);

const EXPECTED_POD_SUITE_TOOL_EVENTS = Object.freeze([
  ['onPsdSmartObjectProgress', 'PSD_SMART_OBJECT_PROGRESS']
]);

const EXPECTED_SHOP_MANAGEMENT_INVOKES = Object.freeze([
  ['getState', 'GET_STATE'],
  ['syncCloudState', 'SYNC_CLOUD_STATE'],
  ['getShopDetail', 'GET_SHOP_DETAIL'],
  ['setShopVisibility', 'SET_SHOP_VISIBILITY'],
  ['addGroup', 'ADD_GROUP'],
  ['updateGroup', 'UPDATE_GROUP'],
  ['deleteGroup', 'DELETE_GROUP'],
  ['addShop', 'ADD_SHOP'],
  ['updateShop', 'UPDATE_SHOP']
]);

const EXPECTED_GLOBAL_CONFIG_INVOKES = Object.freeze([
  ['getStorageSelection', 'GET_STORAGE_SELECTION'],
  ['saveStorageSelection', 'SAVE_STORAGE_SELECTION'],
  ['listTencentCosBuckets', 'LIST_TENCENT_COS_BUCKETS'],
  ['listTencentCosObjects', 'LIST_TENCENT_COS_OBJECTS'],
  ['deleteTencentCosObjects', 'DELETE_TENCENT_COS_OBJECTS'],
  ['listCloudflareR2Buckets', 'LIST_CLOUDFLARE_R2_BUCKETS'],
  ['listCloudflareR2PublicDomains', 'LIST_CLOUDFLARE_R2_PUBLIC_DOMAINS'],
  ['listCloudflareR2Objects', 'LIST_CLOUDFLARE_R2_OBJECTS'],
  ['deleteCloudflareR2Objects', 'DELETE_CLOUDFLARE_R2_OBJECTS'],
  ['getAiConfig', 'GET_AI_CONFIG'],
  ['getUpdateSettings', 'GET_UPDATE_SETTINGS'],
  ['saveUpdateSettings', 'SAVE_UPDATE_SETTINGS'],
  ['saveAiConfig', 'SAVE_AI_CONFIG'],
  ['testAiApiKey', 'TEST_AI_API_KEY']
]);

const EXPECTED_UPDATER_INVOKES = Object.freeze([
  ['getStatus', 'GET_STATUS'],
  ['check', 'CHECK'],
  ['download', 'DOWNLOAD'],
  ['install', 'INSTALL'],
  ['skip', 'SKIP']
]);

const EXPECTED_UPDATER_EVENTS = Object.freeze([
  ['onStatus', 'STATUS']
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertMethodInPreload(methodName) {
  const methodPattern = new RegExp(`\\b${methodName}\\s*(?:\\(|:)`);
  assert(methodPattern.test(preloadSurfaceText), `preload method missing: ${methodName}`);
}

function assertChannelUsage(channelNamespace, channelMap, channelKey, registerText, requireRegister) {
  assert(typeof channelMap[channelKey] === 'string' && channelMap[channelKey], `channel constant missing: ${channelKey}`);
  assert(
    preloadSurfaceText.includes(`${channelNamespace}.${channelKey}`),
    `preload does not reference ${channelNamespace}.${channelKey}`
  );

  if (requireRegister) {
    assert(
      registerText.includes(`${channelNamespace}.${channelKey}`),
      `IPC register does not reference ${channelNamespace}.${channelKey}`
    );
  }
}

function validatePairs(pairs, options) {
  pairs.forEach(([methodName, channelKey]) => {
    assertMethodInPreload(methodName);
    assertChannelUsage(
      options.channelNamespace,
      options.channelMap,
      channelKey,
      options.registerText,
      options.requireRegister
    );
  });
}

function main() {
  assert(
    appPreloadText.includes('createFeatureCenterPreloadApi'),
    'appPreload does not compose featureCenterPreloadApi'
  );
  assert(
    preloadSurfaceText.includes('createFeatureCenterOperationsPreloadApi'),
    'featureCenterPreloadApi does not compose featureCenterOperationsPreloadApi'
  );

  validatePairs(EXPECTED_FEATURE_INVOKES, {
    channelNamespace: 'FEATURE_CHANNELS',
    channelMap: FEATURE_CHANNELS,
    registerText: featureRegisterText,
    requireRegister: true
  });
  validatePairs(EXPECTED_FEATURE_EVENTS, {
    channelNamespace: 'FEATURE_CHANNELS',
    channelMap: FEATURE_CHANNELS,
    registerText: featureRegisterText,
    requireRegister: false
  });
  validatePairs(EXPECTED_CREATION_INVOKES, {
    channelNamespace: 'CREATION_CHANNELS',
    channelMap: CREATION_CHANNELS,
    registerText: creationRegisterText,
    requireRegister: true
  });
  validatePairs(EXPECTED_POD_SUITE_TOOL_INVOKES, {
    channelNamespace: 'POD_SUITE_TOOL_CHANNELS',
    channelMap: POD_SUITE_TOOL_CHANNELS,
    registerText: podSuiteToolRegisterText,
    requireRegister: true
  });
  validatePairs(EXPECTED_POD_SUITE_TOOL_EVENTS, {
    channelNamespace: 'POD_SUITE_TOOL_CHANNELS',
    channelMap: POD_SUITE_TOOL_CHANNELS,
    registerText: podSuiteToolRegisterText,
    requireRegister: false
  });
  validatePairs(EXPECTED_SHOP_MANAGEMENT_INVOKES, {
    channelNamespace: 'SHOP_CHANNELS',
    channelMap: SHOP_CHANNELS,
    registerText: shopManagementRegisterText,
    requireRegister: true
  });
  validatePairs(EXPECTED_GLOBAL_CONFIG_INVOKES, {
    channelNamespace: 'GLOBAL_CONFIG_CHANNELS',
    channelMap: GLOBAL_CONFIG_CHANNELS,
    registerText: globalConfigRegisterText,
    requireRegister: true
  });
  validatePairs(EXPECTED_UPDATER_INVOKES, {
    channelNamespace: 'UPDATE_CHANNELS',
    channelMap: UPDATE_CHANNELS,
    registerText: updaterRegisterText,
    requireRegister: true
  });
  validatePairs(EXPECTED_UPDATER_EVENTS, {
    channelNamespace: 'UPDATE_CHANNELS',
    channelMap: UPDATE_CHANNELS,
    registerText: updaterRegisterText,
    requireRegister: false
  });

  console.log('preload IPC surface validation passed');
}

main();
