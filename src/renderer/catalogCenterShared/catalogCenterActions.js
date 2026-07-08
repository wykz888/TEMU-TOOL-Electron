const FEATURE_ACTION_HANDLERS = Object.freeze({
  'open-operations-activity-management': (bridge) => (
    bridge.openOperationsActivityManagement({
      promptForNewWindow: true
    })
  ),
  'open-operations-traffic-boost': (bridge) => (
    bridge.openOperationsTrafficBoost({
      promptForNewWindow: true
    })
  ),
  'open-operations-price-declaration': (bridge) => (
    bridge.openOperationsPriceDeclaration({
      promptForNewWindow: true
    })
  ),
  'open-operations-new-product-lifecycle': (bridge) => (
    bridge.openOperationsNewProductLifecycle({
      promptForNewWindow: true
    })
  ),
  'open-marketing-tools': (bridge) => bridge.openMarketingTools({
    promptForNewWindow: true
  }),
  'open-global-category-sync': (bridge) => bridge.openGlobalCategorySync(),
  'open-promotion-manager': (bridge) => bridge.openPromotionManager(),
  'open-pod-upload-sheet-miaoshou': (bridge) => bridge.openPodUploadSheetMiaoshou({
    promptForNewWindow: true
  }),
  'open-pod-upload-sheet-miaoshou-universal': (bridge) => bridge.openPodUploadSheetMiaoshouUniversal({
    promptForNewWindow: true
  })
});

const CREATION_ACTION_HANDLERS = Object.freeze({
  'open-jimeng-image': (bridge) => bridge.openJimengImage(),
  'open-pod-upload-sheet-miaoshou': (bridge) => bridge.openPodUploadSheetMiaoshou({
    promptForNewWindow: true
  }),
  'open-pod-suite-tool': (bridge) => bridge.openPodSuiteTool({
    promptForNewWindow: true
  })
});

export function hasCatalogAction(centerType, actionName) {
  const handlerMap = centerType === 'creation'
    ? CREATION_ACTION_HANDLERS
    : FEATURE_ACTION_HANDLERS;

  return typeof handlerMap[actionName] === 'function';
}

export function runCatalogAction(centerType, bridge, actionName) {
  const handlerMap = centerType === 'creation'
    ? CREATION_ACTION_HANDLERS
    : FEATURE_ACTION_HANDLERS;
  const handler = handlerMap[actionName];

  if (typeof handler !== 'function') {
    return Promise.resolve(null);
  }

  return Promise.resolve(handler(bridge));
}
