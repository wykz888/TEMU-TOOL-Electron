const DESIGN_LAYER_NAME = '__POD_SUITE_DESIGN_LAYER__';
const ECHO_MAIN_READY = '__POD_SUITE_MAIN_READY__';
const ECHO_MAIN_ACTIVATED = '__POD_SUITE_MAIN_ACTIVATED__';
const ECHO_SMART_OPEN_REQUESTED = '__POD_SUITE_SMART_OPEN_REQUESTED__';
const ECHO_SMART_SELECTED = '__POD_SUITE_SMART_SELECTED__';
const ECHO_SMART_DUPLICATED = '__POD_SUITE_SMART_DUPLICATED__';
const ECHO_SOURCE_CLOSE_REQUESTED = '__POD_SUITE_SOURCE_CLOSE_REQUESTED__';
const ECHO_SMART_LAYER_READY = '__POD_SUITE_SMART_LAYER_READY__';
const ECHO_SMART_LAYER_FIT = '__POD_SUITE_SMART_LAYER_FIT__';
const ECHO_SMART_LAYER_CLEANED = '__POD_SUITE_SMART_LAYER_CLEANED__';
const ECHO_SMART_SAVED = '__POD_SUITE_SMART_SAVED__';
const ECHO_SMART_CLOSE_REQUESTED = '__POD_SUITE_SMART_CLOSE_REQUESTED__';
const ECHO_ACTIVE_DOCUMENT = '__POD_SUITE_ACTIVE_DOCUMENT__';
const ECHO_ACTIVE_DOCUMENT_INFO = '__POD_SUITE_ACTIVE_DOCUMENT_INFO__';
const ECHO_ACTIVE_LAYER = '__POD_SUITE_ACTIVE_LAYER__';
const ECHO_MEMORY_PURGED = '__POD_SUITE_MEMORY_PURGED__';
const ECHO_ERROR = '__POD_SUITE_ERROR__';
const MAIN_READY_WAIT_TIMEOUT = '__POD_SUITE_MAIN_READY_WAIT_TIMEOUT__';

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function decodeDocumentName(value) {
  const text = String(value == null ? '' : value);
  try {
    return decodeURIComponent(text);
  } catch (_error) {
    return text;
  }
}

function normalizeDocumentName(value) {
  return decodeDocumentName(value).trim();
}

function documentNamesEqual(left, right) {
  return normalizeDocumentName(left) === normalizeDocumentName(right);
}

function wrapPhotopeaScript(script) {
  return `
try {
${script}
} catch (__podSuiteError) {
  var __podSuiteErrorMessage = __podSuiteError && __podSuiteError.message
    ? __podSuiteError.message
    : String(__podSuiteError);
  app.echoToOE(${JSON.stringify(ECHO_ERROR)} + __podSuiteErrorMessage);
}
`;
}

function buildDocumentScriptPrelude() {
  return `
function __podDecodeName(value) {
  var text = String(value == null ? '' : value);
  try {
    return decodeURIComponent(text);
  } catch (_decodeError) {
    return text;
  }
}
function __podNormalizeName(value) {
  return __podDecodeName(value).replace(/^\\s+|\\s+$/g, '');
}
function __podNamesEqual(left, right) {
  return __podNormalizeName(left) === __podNormalizeName(right);
}
function __podFindDocumentByName(name) {
  var exactName = String(name == null ? '' : name);
  for (var exactIndex = 0; exactIndex < app.documents.length; exactIndex += 1) {
    var exactDoc = app.documents[exactIndex];
    if (exactDoc && String(exactDoc.name || '') === exactName) return exactDoc;
  }
  for (var index = 0; index < app.documents.length; index += 1) {
    var doc = app.documents[index];
    if (doc && __podNamesEqual(doc.name, name)) return doc;
  }
  return null;
}
function __podGetActiveDocument() {
  try {
    return app.activeDocument || null;
  } catch (_activeError) {
    return null;
  }
}
function __podActivateDocumentByName(name) {
  var activeDoc = __podGetActiveDocument();
  if (activeDoc && __podNamesEqual(activeDoc.name, name)) return activeDoc;
  var doc = __podFindDocumentByName(name);
  if (!doc) throw new Error('Document not found: ' + name);
  app.activeDocument = doc;
  return doc;
}
`;
}

function buildValueScriptPrelude() {
  return `
function __podValueToPx(value) {
  var direct = Number(value);
  if (!isNaN(direct)) return direct;
  if (value && value.value !== undefined) {
    var unitValue = Number(value.value);
    if (!isNaN(unitValue)) return unitValue;
  }
  var parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}
`;
}

function buildFitScriptPrelude() {
  return `
${buildDocumentScriptPrelude()}
${buildValueScriptPrelude()}
function __podGetLayerBounds(layer) {
  var bounds = layer.bounds;
  return {
    left: __podValueToPx(bounds[0]),
    top: __podValueToPx(bounds[1]),
    right: __podValueToPx(bounds[2]),
    bottom: __podValueToPx(bounds[3])
  };
}
function __podFitLayerToCanvas(documentRef, layer) {
  var docWidth = __podValueToPx(documentRef.width);
  var docHeight = __podValueToPx(documentRef.height);
  var bounds = __podGetLayerBounds(layer);
  var layerWidth = Math.max(1, bounds.right - bounds.left);
  var layerHeight = Math.max(1, bounds.bottom - bounds.top);
  var scale = Math.max(docWidth / layerWidth, docHeight / layerHeight) * 100;
  layer.resize(scale, scale);
  bounds = __podGetLayerBounds(layer);
  var dx = (docWidth / 2) - ((bounds.left + bounds.right) / 2);
  var dy = (docHeight / 2) - ((bounds.top + bounds.bottom) / 2);
  layer.translate(dx, dy);
}
function __podFitLayerContainCanvas(documentRef, layer) {
  var docWidth = __podValueToPx(documentRef.width);
  var docHeight = __podValueToPx(documentRef.height);
  var bounds = __podGetLayerBounds(layer);
  var layerWidth = Math.max(1, bounds.right - bounds.left);
  var layerHeight = Math.max(1, bounds.bottom - bounds.top);
  var scale = Math.min(docWidth / layerWidth, docHeight / layerHeight) * 100;
  layer.resize(scale, scale);
  bounds = __podGetLayerBounds(layer);
  var dx = (docWidth / 2) - ((bounds.left + bounds.right) / 2);
  var dy = (docHeight / 2) - ((bounds.top + bounds.bottom) / 2);
  layer.translate(dx, dy);
}
function __podStretchLayerToBounds(layer, targetBounds) {
  var bounds = __podGetLayerBounds(layer);
  var layerWidth = Math.max(1, bounds.right - bounds.left);
  var layerHeight = Math.max(1, bounds.bottom - bounds.top);
  var targetWidth = Math.max(1, targetBounds.right - targetBounds.left);
  var targetHeight = Math.max(1, targetBounds.bottom - targetBounds.top);
  layer.resize((targetWidth / layerWidth) * 100, (targetHeight / layerHeight) * 100);
  bounds = __podGetLayerBounds(layer);
  layer.translate(targetBounds.left - bounds.left, targetBounds.top - bounds.top);
}
function __podFindReplacementTargetBounds(documentRef, keepLayer) {
  for (var index = 0; index < documentRef.layers.length; index += 1) {
    var layer = documentRef.layers[index];
    if (!layer || layer === keepLayer || layer.name === ${JSON.stringify(DESIGN_LAYER_NAME)}) continue;
    try {
      if (layer.visible === false) continue;
    } catch (_visibleError) {}
    try {
      var bounds = __podGetLayerBounds(layer);
      if (bounds.right > bounds.left && bounds.bottom > bounds.top) {
        return bounds;
      }
    } catch (_boundsError) {}
  }
  return {
    left: 0,
    top: 0,
    right: __podValueToPx(documentRef.width),
    bottom: __podValueToPx(documentRef.height)
  };
}
`;
}

function buildActiveDocumentEchoScript(prefix) {
  return `
var __podActiveName = '';
try {
  __podActiveName = app.activeDocument ? app.activeDocument.name : '';
} catch (_activeError) {
  __podActiveName = '';
}
app.echoToOE(${JSON.stringify(prefix)} + __podActiveName);
`;
}

function buildActiveLayerStateScript() {
  return `
var __podLayerState = {
  documentName: '',
  layerName: '',
  layerId: 0,
  itemIndex: 0
};
try {
  var __podDocument = app.activeDocument || null;
  __podLayerState.documentName = __podDocument ? String(__podDocument.name || '') : '';
  var __podLayer = __podDocument && __podDocument.activeLayer ? __podDocument.activeLayer : null;
  __podLayerState.layerName = __podLayer ? String(__podLayer.name || '') : '';
  __podLayerState.layerId = __podLayer && __podLayer.id ? Number(__podLayer.id) : 0;
  __podLayerState.itemIndex = __podLayer && __podLayer.itemIndex ? Number(__podLayer.itemIndex) : 0;
} catch (__podLayerStateError) {
  __podLayerState.error = __podLayerStateError && __podLayerStateError.message
    ? __podLayerStateError.message
    : String(__podLayerStateError);
}
app.echoToOE(${JSON.stringify(ECHO_ACTIVE_LAYER)} + JSON.stringify(__podLayerState));
`;
}

function buildDocumentInfoScript(documentName) {
  return `
${buildDocumentScriptPrelude()}
${buildValueScriptPrelude()}
var __podInfoDocument = __podActivateDocumentByName(${JSON.stringify(documentName)});
var __podDocumentInfo = {
  documentName: __podInfoDocument ? String(__podInfoDocument.name || '') : '',
  width: __podInfoDocument ? Math.max(1, Math.round(__podValueToPx(__podInfoDocument.width))) : 0,
  height: __podInfoDocument ? Math.max(1, Math.round(__podValueToPx(__podInfoDocument.height))) : 0
};
app.echoToOE(${JSON.stringify(ECHO_ACTIVE_DOCUMENT_INFO)} + JSON.stringify(__podDocumentInfo));
`;
}

function parseJsonEchoValue(message, prefix) {
  const rawText = String(message && message.value || '').slice(String(prefix || '').length);

  try {
    const parsed = JSON.parse(rawText);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function buildLayerIndexCandidates(layerIndex, layerCount) {
  const candidates = [];
  const localIndex = Number(layerIndex);
  const totalCount = Number(layerCount);

  function addCandidate(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }
    const normalizedValue = Math.floor(numericValue);
    if (!candidates.includes(normalizedValue)) {
      candidates.push(normalizedValue);
    }
  }

  if (Number.isFinite(localIndex) && localIndex >= 0) {
    if (Number.isFinite(totalCount) && totalCount > 0) {
      addCandidate(totalCount - localIndex);
    }
    addCandidate(localIndex + 1);
  }

  return candidates;
}

function sortSelectionAttemptsByPreferredMode(selectionAttempts, preferredMode) {
  const normalizedMode = normalizeText(preferredMode);
  if (!normalizedMode || !Array.isArray(selectionAttempts) || selectionAttempts.length < 2) {
    return selectionAttempts;
  }

  const preferredIndex = selectionAttempts.findIndex((attempt) => attempt && attempt.mode === normalizedMode);
  if (preferredIndex <= 0) {
    return selectionAttempts;
  }

  return [
    selectionAttempts[preferredIndex],
    ...selectionAttempts.slice(0, preferredIndex),
    ...selectionAttempts.slice(preferredIndex + 1)
  ];
}

function buildSelectSmartObjectLayerByDomScript(smartObjectName) {
  return `
var __podSmartLayer = app.activeDocument.layers.getByName(${JSON.stringify(smartObjectName)});
if (!__podSmartLayer) throw new Error('Smart object layer not found: ' + ${JSON.stringify(smartObjectName)});
app.activeDocument.activeLayer = __podSmartLayer;
app.echoToOE(${JSON.stringify(ECHO_SMART_SELECTED)} + 'dom-name');
`;
}

function buildSelectSmartObjectLayerByActionNameScript(smartObjectName) {
  return `
var __podSelectRef = new ActionReference();
var __podSelectDesc = new ActionDescriptor();
__podSelectRef.putName(charIDToTypeID('Lyr '), ${JSON.stringify(smartObjectName)});
__podSelectDesc.putReference(charIDToTypeID('null'), __podSelectRef);
executeAction(charIDToTypeID('slct'), __podSelectDesc);
app.echoToOE(${JSON.stringify(ECHO_SMART_SELECTED)} + 'action-name');
`;
}

function buildSelectSmartObjectLayerByActionIndexScript(layerIndex) {
  const normalizedLayerIndex = Number(layerIndex);
  const safeLayerIndex = Number.isFinite(normalizedLayerIndex) && normalizedLayerIndex > 0
    ? Math.floor(normalizedLayerIndex)
    : 0;

  return `
var __podSelectRef = new ActionReference();
var __podSelectDesc = new ActionDescriptor();
__podSelectRef.putIndex(charIDToTypeID('Lyr '), ${safeLayerIndex});
__podSelectDesc.putReference(charIDToTypeID('null'), __podSelectRef);
executeAction(charIDToTypeID('slct'), __podSelectDesc);
app.echoToOE(${JSON.stringify(ECHO_SMART_SELECTED)} + 'action-index:${safeLayerIndex}');
`;
}

function buildOpenSelectedSmartObjectScript() {
  return `
executeAction(stringIDToTypeID('placedLayerEditContents'));
app.echoToOE(${JSON.stringify(ECHO_SMART_OPEN_REQUESTED)});
`;
}

function buildActiveDocumentStateScript() {
  return `
var __podActiveName = '';
try {
  __podActiveName = app.activeDocument ? app.activeDocument.name : '';
} catch (_activeError) {
  __podActiveName = '';
}
app.echoToOE(${JSON.stringify(ECHO_ACTIVE_DOCUMENT)} + __podActiveName);
`;
}

function buildDuplicateImageLayerIntoSmartDocumentScript(smartDocumentName) {
  return `
var smartName = ${JSON.stringify(smartDocumentName)};
var imageDoc = app.activeDocument;
if (!imageDoc) throw new Error('Source image document is not active.');
var sourceLayer = imageDoc.activeLayer;
if (!sourceLayer) throw new Error('Source image layer is missing.');
var found = null;
for (var i = 0; i < app.documents.length; i += 1) {
  var d = app.documents[i];
  if (d && d.name === smartName) found = d;
}
if (!found) throw new Error('Smart object document not found: ' + smartName);
sourceLayer.duplicate(found);
app.activeDocument = found;
app.echoToOE(${JSON.stringify(ECHO_SMART_DUPLICATED)});
`;
}

function buildCloseSourceImageDocumentScript(imageDocumentName, smartDocumentName) {
  return `
${buildDocumentScriptPrelude()}
var __podImageDocument = __podFindDocumentByName(${JSON.stringify(imageDocumentName)});
if (__podImageDocument) {
  app.activeDocument = __podImageDocument;
  app.echoToOE(${JSON.stringify(ECHO_SOURCE_CLOSE_REQUESTED)});
  __podImageDocument.close(0);
}
__podActivateDocumentByName(${JSON.stringify(smartDocumentName)});
`;
}

function buildPrepareSmartDesignLayerScript(smartDocumentName) {
  return `
${buildDocumentScriptPrelude()}
var __podSmartDocument = __podActivateDocumentByName(${JSON.stringify(smartDocumentName)});
var __podNewLayer = __podSmartDocument.layers.length
  ? __podSmartDocument.layers[0]
  : __podSmartDocument.activeLayer;
if (!__podNewLayer) throw new Error('Source image could not be duplicated into smart object.');
__podNewLayer.name = ${JSON.stringify(DESIGN_LAYER_NAME)};
__podSmartDocument.activeLayer = __podNewLayer;
app.echoToOE(${JSON.stringify(ECHO_SMART_LAYER_READY)});
`;
}

function buildFitSmartDesignLayerScript(smartDocumentName, replacementMode) {
  const normalizedMode = ['cover-canvas', 'contain-canvas', 'layer-bounds-transform', 'native-canvas'].includes(normalizeText(replacementMode))
    ? normalizeText(replacementMode)
    : 'cover-canvas';
  return `
${buildFitScriptPrelude()}
var __podSmartDocument = __podActivateDocumentByName(${JSON.stringify(smartDocumentName)});
var __podNewLayer = __podSmartDocument.layers.length
  ? __podSmartDocument.layers[0]
  : __podSmartDocument.activeLayer;
if (!__podNewLayer) throw new Error('Source image layer is missing in smart object.');
__podNewLayer.name = ${JSON.stringify(DESIGN_LAYER_NAME)};
__podSmartDocument.activeLayer = __podNewLayer;
var __podReplacementMode = ${JSON.stringify(normalizedMode)};
if (__podReplacementMode === 'native-canvas') {
  // The source image was pre-rendered to the smart-object canvas size.
} else if (__podReplacementMode === 'contain-canvas') {
  __podFitLayerContainCanvas(__podSmartDocument, __podNewLayer);
} else if (__podReplacementMode === 'layer-bounds-transform') {
  __podStretchLayerToBounds(__podNewLayer, __podFindReplacementTargetBounds(__podSmartDocument, __podNewLayer));
} else {
  __podFitLayerToCanvas(__podSmartDocument, __podNewLayer);
}
app.echoToOE(${JSON.stringify(ECHO_SMART_LAYER_FIT)});
`;
}

function buildCleanSmartDesignLayersScript(smartDocumentName) {
  return `
${buildDocumentScriptPrelude()}
var __podSmartDocument = __podActivateDocumentByName(${JSON.stringify(smartDocumentName)});
var __podKeepLayer = __podSmartDocument.layers.length
  ? __podSmartDocument.layers[0]
  : __podSmartDocument.activeLayer;
if (!__podKeepLayer) throw new Error('Source image layer is missing in smart object.');
__podKeepLayer.name = ${JSON.stringify(DESIGN_LAYER_NAME)};
__podSmartDocument.activeLayer = __podKeepLayer;
for (var __podLayerIndex = __podSmartDocument.layers.length - 1; __podLayerIndex >= 1; __podLayerIndex -= 1) {
  var __podLayer = __podSmartDocument.layers[__podLayerIndex];
  if (!__podLayer) continue;
  try {
    __podLayer.remove();
  } catch (_removeError) {
    try {
      __podLayer.visible = false;
    } catch (_hideError) {}
  }
}
app.echoToOE(${JSON.stringify(ECHO_SMART_LAYER_CLEANED)});
`;
}

function buildSaveSmartDocumentScript(smartDocumentName) {
  return `
${buildDocumentScriptPrelude()}
var __podSmartDocument = __podActivateDocumentByName(${JSON.stringify(smartDocumentName)});
__podSmartDocument.save();
app.echoToOE(${JSON.stringify(ECHO_SMART_SAVED)});
`;
}

function buildCloseSmartDocumentScript(smartDocumentName) {
  return `
${buildDocumentScriptPrelude()}
var __podSmartDocument = __podActivateDocumentByName(${JSON.stringify(smartDocumentName)});
app.echoToOE(${JSON.stringify(ECHO_SMART_CLOSE_REQUESTED)});
__podSmartDocument.close();
`;
}

function buildActivateMainScript(mainDocumentName) {
  return `
${buildDocumentScriptPrelude()}
__podActivateDocumentByName(${JSON.stringify(mainDocumentName)});
app.echoToOE(${JSON.stringify(ECHO_MAIN_ACTIVATED)});
`;
}

function buildPurgeMemoryScript(mainDocumentName) {
  return `
${buildDocumentScriptPrelude()}
try {
  __podActivateDocumentByName(${JSON.stringify(mainDocumentName)});
} catch (_activateError) {}
try {
  if (typeof app.purge === 'function' && typeof PurgeTarget !== 'undefined') {
    app.purge(PurgeTarget.ALLCACHES);
  }
} catch (_purgeError) {}
app.echoToOE(${JSON.stringify(ECHO_MEMORY_PURGED)});
`;
}

function buildExportDocumentScript(mainDocumentName, format) {
  const normalizedFormat = normalizeText(format) || 'png';
  return `
${buildDocumentScriptPrelude()}
var __podDocument = __podActivateDocumentByName(${JSON.stringify(mainDocumentName)});
if (!__podDocument) throw new Error('Export document is not active.');
__podDocument.saveToOE(${JSON.stringify(normalizedFormat)});
`;
}

module.exports = {
  ECHO_ACTIVE_DOCUMENT,
  ECHO_ACTIVE_DOCUMENT_INFO,
  ECHO_ACTIVE_LAYER,
  ECHO_ERROR,
  ECHO_MAIN_ACTIVATED,
  ECHO_MAIN_READY,
  ECHO_MEMORY_PURGED,
  ECHO_SMART_CLOSE_REQUESTED,
  ECHO_SMART_DUPLICATED,
  ECHO_SMART_LAYER_CLEANED,
  ECHO_SMART_LAYER_FIT,
  ECHO_SMART_LAYER_READY,
  ECHO_SMART_OPEN_REQUESTED,
  ECHO_SMART_SAVED,
  ECHO_SMART_SELECTED,
  MAIN_READY_WAIT_TIMEOUT,
  buildActivateMainScript,
  buildActiveDocumentEchoScript,
  buildActiveDocumentStateScript,
  buildActiveLayerStateScript,
  buildCleanSmartDesignLayersScript,
  buildCloseSmartDocumentScript,
  buildCloseSourceImageDocumentScript,
  buildDocumentInfoScript,
  buildDuplicateImageLayerIntoSmartDocumentScript,
  buildExportDocumentScript,
  buildFitSmartDesignLayerScript,
  buildLayerIndexCandidates,
  buildOpenSelectedSmartObjectScript,
  buildPrepareSmartDesignLayerScript,
  buildPurgeMemoryScript,
  buildSaveSmartDocumentScript,
  buildSelectSmartObjectLayerByActionIndexScript,
  buildSelectSmartObjectLayerByActionNameScript,
  buildSelectSmartObjectLayerByDomScript,
  documentNamesEqual,
  parseJsonEchoValue,
  sortSelectionAttemptsByPreferredMode,
  wrapPhotopeaScript
};
