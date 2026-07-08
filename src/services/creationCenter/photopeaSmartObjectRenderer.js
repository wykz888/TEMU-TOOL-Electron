const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { BrowserWindow } = require('electron');
const { parsePsdLayerMetadata } = require('./psdLayerMetadataParser');
const {
  encodeSharpWithOptionalMetadata
} = require('./imageMetadataSource');
const sharp = require('sharp');

sharp.cache({
  memory: 64,
  files: 20,
  items: 100
});

const PHOTOPEA_URL = 'https://www.photopea.com';
const PHOTOPEA_TEMP_INPUT_PREFIX = 'pod-suite-photopea-input-';
const READY_TIMEOUT_MS = 120000;
const OPEN_TIMEOUT_MS = 300000;
const SCRIPT_TIMEOUT_MS = 120000;
const PURGE_TIMEOUT_MS = 15000;
const EXPORT_TIMEOUT_MS = 180000;
const SMART_OBJECT_ACTION_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 120;
const DOCUMENT_READY_RETRY_MS = 30000;
const MAIN_DOCUMENT_SETTLE_MS = 10000;
const DEFAULT_POST_PROCESS_CONCURRENCY = 1;
const PHOTOPEA_PURGE_EVERY_ITEMS = 5;
const PHOTOPEA_PURGE_MIN_INTERVAL_MS = 45000;
const SHARP_CACHE_RESET_MIN_INTERVAL_MS = 45000;
const PHOTOPEA_SESSION_PARTITION_PREFIX = 'pod-suite-photopea';
const DIRECT_PHOTOPEA_INPUT_EXTENSIONS = new Set([
  '.png',
  '.webp'
]);
const JPEG_PHOTOPEA_INPUT_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg'
]);
const DESIGN_LAYER_NAME = '__POD_SUITE_DESIGN_LAYER__';
const RECOVERABLE_ITEM_TIMEOUT_PATTERN = /(?:\u5728\u7ebfPSD\u5f15\u64ce(?:\u6267\u884c|\u542f\u52a8|\u6e05\u7406\u5185\u5b58)?\u8d85\u65f6|\u7d20\u6750\u56fe\u6253\u5f00\u8d85\u65f6|\u6837\u673a\u5bfc\u51fa\u8d85\u65f6|\u6587\u4ef6\u6253\u5f00\u8d85\u65f6|\u672a\u56de\u5230PSD\u4e3b\u6587\u6863|\u672a\u56de\u5230\u667a\u80fd\u5bf9\u8c61\u6587\u6863|\u672a\u80fd\u786e\u8ba4\u5f53\u524d\u6587\u6863)/;
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function throwIfTaskCanceled(taskSignal) {
  if (taskSignal && taskSignal.aborted) {
    throw new Error(String(taskSignal.reason || 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002'));
  }
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function clearSharpMemoryCache() {
  sharp.cache(false);
  sharp.cache({
    memory: 64,
    files: 20,
    items: 100
  });
}

let lastSharpMemoryCacheResetAt = 0;

function clearSharpMemoryCacheSoon(force = false) {
  const now = Date.now();
  if (!force && now - lastSharpMemoryCacheResetAt < SHARP_CACHE_RESET_MIN_INTERVAL_MS) {
    return;
  }

  clearSharpMemoryCache();
  lastSharpMemoryCacheResetAt = now;
}

function emitRenderProgress(onProgress, payload) {
  if (typeof onProgress !== 'function') {
    return;
  }

  try {
    onProgress({
      ...(payload && typeof payload === 'object' ? payload : {}),
      updatedAt: new Date().toISOString()
    });
  } catch (_error) {}
}

function resolvePhotopeaTempRootDir(tempRootDir) {
  const normalizedPath = normalizeText(tempRootDir);
  return normalizedPath ? path.resolve(normalizedPath) : os.tmpdir();
}

async function createPhotopeaTempDirectory(tempRootDir, prefix) {
  const rootDir = resolvePhotopeaTempRootDir(tempRootDir);
  await fs.promises.mkdir(rootDir, {
    recursive: true
  });

  return fs.promises.mkdtemp(path.join(rootDir, prefix));
}

function createAsyncSlotLimiter(limit) {
  const normalizedLimit = Math.max(1, Math.round(Number(limit) || 1));
  const waiters = [];
  let activeCount = 0;

  function release() {
    const nextWaiter = waiters.shift();
    if (nextWaiter) {
      nextWaiter(release);
      return;
    }

    activeCount = Math.max(0, activeCount - 1);
  }

  return {
    acquire() {
      if (activeCount < normalizedLimit) {
        activeCount += 1;
        return Promise.resolve(release);
      }

      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    }
  };
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

function isIgnorablePhotopeaConsoleError(record) {
  const message = String(record && record.message || '');

  return /Cannot read properties of null \(reading ['"][A-Za-z_$][\w$]{0,3}['"]\)/.test(message);
}

function createPhotopeaConfig(overrides = {}) {
  return {
    environment: {
      intro: false,
      ...(overrides.environment && typeof overrides.environment === 'object' ? overrides.environment : {})
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== 'environment')
    )
  };
}

function makePhotopeaWrapperHtml(configOverrides = {}) {
  const config = createPhotopeaConfig(configOverrides);
  const iframeUrl = `${PHOTOPEA_URL}#${encodeURIComponent(JSON.stringify(config))}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body, iframe {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      overflow: hidden;
      background: #111;
    }
  </style>
</head>
<body>
  <iframe id="photopea" src="${iframeUrl}"></iframe>
</body>
</html>`;
}

function getContentTypeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.psb': 'application/octet-stream',
    '.psd': 'image/vnd.adobe.photoshop',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp'
  };

  return contentTypes[extension] || 'application/octet-stream';
}

function applyCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Access-Control-Request-Private-Network');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
}

class PhotopeaLocalFileServer {
  constructor({ runtimeLogger } = {}) {
    this.runtimeLogger = runtimeLogger || null;
    this.server = null;
    this.port = 0;
    this.files = new Map();
    this.wrapperHtml = '';
  }

  async ensureStarted() {
    if (this.server && this.port) {
      return;
    }

    this.server = http.createServer((request, response) => {
      this.handleRequest(request, response);
    });

    await new Promise((resolve, reject) => {
      const handleError = (error) => {
        this.server.removeListener('listening', handleListening);
        reject(error);
      };
      const handleListening = () => {
        this.server.removeListener('error', handleError);
        const address = this.server.address();
        this.port = address && typeof address === 'object' ? Number(address.port) : 0;
        resolve();
      };

      this.server.once('error', handleError);
      this.server.once('listening', handleListening);
      this.server.listen(0, '127.0.0.1');
    });

    await emitDebug(this.runtimeLogger, 'local-file-server-started', {
      port: this.port
    });
  }

  async addFile(filePath) {
    await this.ensureStarted();

    const absolutePath = path.resolve(String(filePath || ''));
    const stat = await fs.promises.stat(absolutePath);
    const token = crypto.randomBytes(16).toString('hex');
    const fileName = path.basename(absolutePath);

    this.files.set(token, {
      filePath: absolutePath,
      size: stat.size,
      contentType: getContentTypeForFile(absolutePath)
    });

    return `http://127.0.0.1:${this.port}/files/${token}/${encodeURIComponent(fileName)}`;
  }

  async setWrapperHtml(html) {
    await this.ensureStarted();
    this.wrapperHtml = String(html || '');

    return `http://127.0.0.1:${this.port}/wrapper`;
  }

  handleRequest(request, response) {
    applyCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405);
      response.end();
      return;
    }

    let parsedUrl = null;
    try {
      parsedUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    } catch (_error) {
      parsedUrl = null;
    }

    if (parsedUrl && parsedUrl.pathname === '/wrapper') {
      const body = this.wrapperHtml || '<!doctype html><html><body></body></html>';
      const buffer = Buffer.from(body, 'utf8');

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': buffer.length,
        'Content-Type': 'text/html; charset=utf-8'
      });

      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      response.end(buffer);
      return;
    }

    const parts = parsedUrl ? parsedUrl.pathname.split('/').filter(Boolean) : [];
    const token = parts[0] === 'files' ? parts[1] : '';
    const record = token ? this.files.get(token) : null;
    if (!record) {
      response.writeHead(404);
      response.end();
      return;
    }

    const headers = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Type': record.contentType
    };
    const rangeHeader = String(request.headers.range || '');
    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    let start = 0;
    let end = Math.max(0, record.size - 1);
    let statusCode = 200;

    if (rangeMatch) {
      const requestedStart = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
      const requestedEnd = rangeMatch[2] ? Number(rangeMatch[2]) : end;

      if (
        Number.isFinite(requestedStart)
        && Number.isFinite(requestedEnd)
        && requestedStart >= 0
        && requestedStart <= requestedEnd
        && requestedStart < record.size
      ) {
        start = requestedStart;
        end = Math.min(requestedEnd, record.size - 1);
        statusCode = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${record.size}`;
      }
    }

    headers['Content-Length'] = Math.max(0, end - start + 1);
    response.writeHead(statusCode, headers);

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = fs.createReadStream(record.filePath, {
      start,
      end
    });

    stream.on('error', (error) => {
      if (this.runtimeLogger && typeof this.runtimeLogger.logError === 'function') {
        this.runtimeLogger.logError('pod_suite_tool_photopea_file_server_failed', error);
      }
      response.destroy(error);
    });
    stream.pipe(response);
  }

  async close() {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;
    this.port = 0;
    this.files.clear();

    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }
}

async function captureDebugWindow(windowInstance, label, runtimeLogger) {
  if (process.env.POD_SUITE_PHOTOPEA_DEBUG_CAPTURE !== '1' || !windowInstance || windowInstance.isDestroyed()) {
    return;
  }

  try {
    const image = await windowInstance.webContents.capturePage();
    const filePath = path.join(os.tmpdir(), `pod-suite-photopea-${label}-${Date.now()}.png`);
    await fs.promises.writeFile(filePath, image.toPNG());
    await emitDebug(runtimeLogger, 'capture', {
      filePath,
      label
    });
  } catch (error) {
    await emitDebug(runtimeLogger, 'capture-failed', {
      label,
      message: String(error && error.message || error || '')
    });
  }
}

function encodeScriptForExecute(script) {
  return JSON.stringify(script);
}

function bufferFromMessage(message) {
  if (message && message.bytes instanceof Uint8Array) {
    return Buffer.from(message.bytes);
  }

  if (message && message.bytes && Array.isArray(message.bytes)) {
    return Buffer.from(message.bytes);
  }

  return Buffer.from(String(message.base64 || ''), 'base64');
}

function isDoneMessage(message) {
  return message && message.kind === 'string' && message.value === 'done';
}

function isEchoMessage(message, prefix) {
  return message && message.kind === 'string' && String(message.value || '').startsWith(prefix);
}

function isErrorMessage(message) {
  return isEchoMessage(message, ECHO_ERROR);
}

function getSourceProgressIndex(sourceFile, fallbackIndex) {
  const sourceIndex = Math.round(Number(sourceFile && sourceFile.sourceIndex) || 0);
  return sourceIndex > 0 ? sourceIndex : fallbackIndex + 1;
}

function getSourceProgressCount(sourceFile, sourceFiles) {
  const sourceCount = Math.round(Number(sourceFile && sourceFile.sourceCount) || 0);
  return sourceCount > 0 ? sourceCount : Array.isArray(sourceFiles) ? sourceFiles.length : 0;
}

function getSourceProgressName(sourceFile) {
  return sourceFile && sourceFile.fileName ? sourceFile.fileName : path.basename(sourceFile && sourceFile.filePath || '');
}

function getErrorMessage(message) {
  return String(message && message.value || '').slice(ECHO_ERROR.length).trim();
}

function isRecoverablePhotopeaItemError(error) {
  const message = String(error && error.message || error || '');
  return RECOVERABLE_ITEM_TIMEOUT_PATTERN.test(message);
}

async function emitDebug(runtimeLogger, message, details = {}) {
  if (!runtimeLogger) {
    return;
  }

  try {
    const payload = {
      message,
      ...details
    };

    if (typeof runtimeLogger.log === 'function') {
      runtimeLogger.log('pod_suite_tool_photopea_debug', payload);
      return;
    }

    if (typeof runtimeLogger.logInfo === 'function') {
      runtimeLogger.logInfo('pod_suite_tool_photopea_debug', payload);
    }
  } catch (_error) {
    // Debug logging must never affect rendering.
  }
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

function normalizeOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(format) ? format : 'png';
}

function normalizeImageQuality(value) {
  const quality = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, quality));
}

function getPhotopeaSourceExportFormat(outputFormat) {
  return normalizeOutputFormat(outputFormat) === 'jpg' ? 'jpg' : 'png';
}

async function convertExportBuffer(sourceBuffer, outputFormat, options = {}) {
  const normalizedFormat = normalizeOutputFormat(outputFormat);
  const sourceFormat = normalizeOutputFormat(options.sourceFormat || normalizedFormat);

  if (!normalizeText(options.metadataSourcePath)
    && sourceFormat === normalizedFormat
    && normalizedFormat === 'png') {
    return sourceBuffer;
  }

  return encodeSharpWithOptionalMetadata({
    createPipeline() {
      return sharp(sourceBuffer, {
        failOnError: false,
        limitInputPixels: false
      });
    },
    outputFormat: normalizedFormat,
    metadataSourcePath: options.metadataSourcePath,
    jpegQuality: normalizeImageQuality(options.imageQuality)
  });
}

function normalizeTargetImageSize(value) {
  const source = value && typeof value === 'object' ? value : {};
  const width = Math.max(0, Math.round(Number(source.width) || 0));
  const height = Math.max(0, Math.round(Number(source.height) || 0));

  return width > 0 && height > 0
    ? { width, height }
    : null;
}

function normalizeSourceRotation(value) {
  const mode = normalizeText(value);
  return ['left', 'right'].includes(mode) ? mode : 'none';
}

function getSourceRotationAngle(value) {
  const mode = normalizeSourceRotation(value);
  if (mode === 'left') {
    return -90;
  }
  if (mode === 'right') {
    return 90;
  }

  return 0;
}

async function preparePhotopeaInputImage(imagePath, runtimeLogger, options = {}) {
  const sourcePath = path.resolve(String(imagePath || ''));
  const targetSize = normalizeTargetImageSize(options.targetSize);
  const sourceRotation = normalizeSourceRotation(options.sourceRotation);
  const sourceRotationAngle = getSourceRotationAngle(sourceRotation);
  const sourceExtension = path.extname(sourcePath).toLowerCase();
  const hasSourceRotation = sourceRotationAngle !== 0;
  let canUseDirectInput = !targetSize && !hasSourceRotation && DIRECT_PHOTOPEA_INPUT_EXTENSIONS.has(sourceExtension);

  if (!targetSize && !hasSourceRotation && JPEG_PHOTOPEA_INPUT_EXTENSIONS.has(sourceExtension)) {
    const metadata = await sharp(sourcePath, {
      failOnError: false,
      limitInputPixels: false
    }).metadata().catch(() => null);
    canUseDirectInput = !metadata || !metadata.orientation || metadata.orientation === 1;
  }

  if (canUseDirectInput) {
    await emitDebug(runtimeLogger, 'input-image-direct', {
      sourcePath
    });

    return {
      filePath: sourcePath,
      targetSizeApplied: false,
      async cleanup() {}
    };
  }

  const tempDirectoryPath = await createPhotopeaTempDirectory(options.tempRootDir, PHOTOPEA_TEMP_INPUT_PREFIX);
  const tempFilePath = path.join(tempDirectoryPath, `source-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.png`);

  try {
    let imagePipeline = sharp(sourcePath, {
      failOnError: false,
      limitInputPixels: false
    })
      .rotate();

    if (hasSourceRotation) {
      imagePipeline = imagePipeline.rotate(sourceRotationAngle);
    }

    if (targetSize) {
      imagePipeline = imagePipeline.resize({
        width: targetSize.width,
        height: targetSize.height,
        fit: 'fill'
      });
    }

    await imagePipeline
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true
      })
      .toFile(tempFilePath);

    await emitDebug(runtimeLogger, 'input-image-prepared', {
      sourcePath,
      tempFilePath,
      targetSize,
      sourceRotation
    });

    return {
      filePath: tempFilePath,
      targetSizeApplied: Boolean(targetSize),
      async cleanup() {
        await fs.promises.rm(tempDirectoryPath, {
          recursive: true,
          force: true
        }).catch(() => {});
      }
    };
  } catch (error) {
    await fs.promises.rm(tempDirectoryPath, {
      recursive: true,
      force: true
    }).catch(() => {});
    await emitDebug(runtimeLogger, 'input-image-prepare-failed', {
      sourcePath,
      message: String(error && error.message || error || '')
    });

    return {
      filePath: sourcePath,
      targetSizeApplied: false,
      async cleanup() {}
    };
  }
}

class PhotopeaSmartObjectSession {
  constructor({ runtimeLogger, taskSignal, showEngineWindow, tempRootDir } = {}) {
    this.runtimeLogger = runtimeLogger || null;
    this.taskSignal = taskSignal || null;
    this.showEngineWindow = showEngineWindow === true;
    this.tempRootDir = resolvePhotopeaTempRootDir(tempRootDir);
    this.partition = `${PHOTOPEA_SESSION_PARTITION_PREFIX}-${crypto.randomBytes(8).toString('hex')}`;
    this.fileServer = new PhotopeaLocalFileServer({
      runtimeLogger: this.runtimeLogger
    });
    this.window = null;
    this.mainDocumentName = '';
    this.smartDocumentName = '';
    this.smartObjectLayerId = 0;
    this.smartObjectLayerIndex = -1;
    this.smartObjectLayerCount = 0;
    this.smartObjectSelectionMode = '';
    this.destroyPromise = null;
    this.pendingMessages = [];
    this.hasStartupMainReadyScript = false;
    this.consoleErrors = [];
  }

  setEngineWindowVisible(visible) {
    this.showEngineWindow = visible === true;
    const shouldShow = this.showEngineWindow || process.env.POD_SUITE_PHOTOPEA_DEBUG_SHOW === '1';
    if (!this.window || this.window.isDestroyed()) {
      return false;
    }

    this.window.setSkipTaskbar(!shouldShow);
    if (shouldShow) {
      this.window.show();
      this.window.focus();
    } else {
      this.window.hide();
    }

    return true;
  }

  async prepareLocalFileUrl(filePath) {
    this.throwIfCanceled();
    return this.fileServer.addFile(filePath);
  }

  async init(configOverrides = {}) {
    this.throwIfCanceled();
    this.hasStartupMainReadyScript = String(configOverrides && configOverrides.script || '').includes(ECHO_MAIN_READY);
    const showEngineWindow = this.showEngineWindow || process.env.POD_SUITE_PHOTOPEA_DEBUG_SHOW === '1';

    await emitDebug(this.runtimeLogger, 'photopea-window-mode', {
      show: showEngineWindow
    });

    this.window = new BrowserWindow({
      show: showEngineWindow,
      width: 1280,
      height: 900,
      title: 'PSD\u667a\u80fd\u5957\u56fe\u5f15\u64ce',
      frame: showEngineWindow,
      skipTaskbar: !showEngineWindow,
      paintWhenInitiallyHidden: true,
      webPreferences: {
        partition: this.partition,
        preload: path.join(__dirname, 'photopeaWrapperPreload.js'),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    if (showEngineWindow) {
      this.window.once('ready-to-show', () => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.show();
          this.window.focus();
        }
      });
      this.window.show();
      this.window.focus();
    }

    this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      void emitDebug(this.runtimeLogger, 'did-fail-load', {
        errorCode,
        errorDescription,
        validatedUrl,
        isMainFrame
      });
    });
    this.window.webContents.on('did-finish-load', () => {
      void emitDebug(this.runtimeLogger, 'did-finish-load', {
        url: this.window && !this.window.isDestroyed() ? this.window.webContents.getURL() : ''
      });
    });
    this.window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 3 || /^Uncaught\b/.test(String(message || ''))) {
        this.consoleErrors.push({
          time: Date.now(),
          level,
          message: String(message || ''),
          line,
          sourceId: String(sourceId || '')
        });
        if (this.consoleErrors.length > 20) {
          this.consoleErrors.splice(0, this.consoleErrors.length - 20);
        }
      }
      void emitDebug(this.runtimeLogger, 'console-message', {
        level,
        message,
        line,
        sourceId
      });
    });

    const wrapperUrl = await this.fileServer.setWrapperHtml(makePhotopeaWrapperHtml(configOverrides));
    await this.window.loadURL(wrapperUrl);
    await emitDebug(this.runtimeLogger, 'wrapper-loaded');
    await delay(3000);
    await captureDebugWindow(this.window, 'after-load', this.runtimeLogger);
    await this.waitForMessage((message) => isDoneMessage(message), READY_TIMEOUT_MS, '\u5728\u7ebfPSD\u5f15\u64ce\u542f\u52a8\u8d85\u65f6\u3002');
    await emitDebug(this.runtimeLogger, 'photopea-ready');
  }

  async destroy() {
    if (this.destroyPromise) {
      return this.destroyPromise;
    }

    this.destroyPromise = this.destroyNow();

    return this.destroyPromise;
  }

  async destroyNow() {
    if (!this.window || this.window.isDestroyed()) {
      await this.fileServer.close();
      clearSharpMemoryCacheSoon(true);
      return;
    }

    try {
      await this.window.loadURL('about:blank');
    } catch (_error) {
      // Ignore cleanup load failures.
    }

    if (!this.window.isDestroyed()) {
      this.window.destroy();
    }

    await this.fileServer.close();
    clearSharpMemoryCacheSoon(true);
  }

  throwIfCanceled() {
    throwIfTaskCanceled(this.taskSignal);
  }

  async executeJavaScript(script) {
    this.throwIfCanceled();
    if (!this.window || this.window.isDestroyed()) {
      throw new Error('Photopea window is closed.');
    }

    return this.window.webContents.executeJavaScript(script, true);
  }

  async takeMessages() {
    if (!this.window || this.window.isDestroyed()) {
      return [];
    }

    const freshMessages = await this.executeJavaScript('window.__photopeaBridge ? window.__photopeaBridge.takeMessages() : []');
    if (!this.pendingMessages.length) {
      return Array.isArray(freshMessages) ? freshMessages : [];
    }

    const messages = this.pendingMessages.concat(Array.isArray(freshMessages) ? freshMessages : []);
    this.pendingMessages = [];
    return messages;
  }

  async drainMessages() {
    this.pendingMessages = [];
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    await this.executeJavaScript('window.__photopeaBridge ? window.__photopeaBridge.takeMessages() : []');
  }

  async purgeMemory() {
    if (!this.mainDocumentName || !this.window || this.window.isDestroyed()) {
      return;
    }

    try {
      await this.drainMessages();
      await this.executeJavaScript(`window.__photopeaBridge.postString(${encodeScriptForExecute(wrapPhotopeaScript(buildPurgeMemoryScript(this.mainDocumentName)))})`);
      await this.waitForMessage(
        (message) => isEchoMessage(message, ECHO_MEMORY_PURGED) || isDoneMessage(message),
        PURGE_TIMEOUT_MS,
        '\u5728\u7ebfPSD\u5f15\u64ce\u6e05\u7406\u5185\u5b58\u8d85\u65f6\u3002'
      );
    } catch (error) {
      await emitDebug(this.runtimeLogger, 'purge-memory-skipped', {
        message: String(error && error.message || error || '')
      });
    } finally {
      await this.drainMessages().catch(() => {});
    }
  }

  getConsoleErrorSince(startedAt) {
    const threshold = Number.isFinite(startedAt) && startedAt > 0 ? startedAt : 0;
    return this.consoleErrors.find((record) => (
      record
      && record.time >= threshold
      && !isIgnorablePhotopeaConsoleError(record)
    )) || null;
  }

  async waitForMessage(predicate, timeoutMs, timeoutMessage, { rejectConsoleErrorsSince = 0 } = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      this.throwIfCanceled();
      if (rejectConsoleErrorsSince) {
        const consoleError = this.getConsoleErrorSince(rejectConsoleErrorsSince);
        if (consoleError) {
          throw new Error(consoleError.message || '\u5728\u7ebfPSD\u5f15\u64ce\u6267\u884c\u5931\u8d25\u3002');
        }
      }
      const messages = await this.takeMessages();
      const unmatchedMessages = [];

      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (isErrorMessage(message)) {
          this.pendingMessages = unmatchedMessages.concat(messages.slice(index + 1), this.pendingMessages);
          throw new Error(getErrorMessage(message) || '\u5728\u7ebfPSD\u5f15\u64ce\u6267\u884c\u5931\u8d25\u3002');
        }

        if (predicate(message)) {
          this.pendingMessages = unmatchedMessages.concat(messages.slice(index + 1), this.pendingMessages);
          return message;
        }

        unmatchedMessages.push(message);
      }

      if (unmatchedMessages.length) {
        this.pendingMessages = unmatchedMessages.concat(this.pendingMessages);
      }

      await delay(POLL_INTERVAL_MS);
    }

    throw new Error(timeoutMessage);
  }

  async postScript(script, { timeoutMs = SCRIPT_TIMEOUT_MS, echoPrefix = '', waitForDone = true, drain = true, rejectOnConsoleError = false } = {}) {
    this.throwIfCanceled();
    if (drain) {
      await this.drainMessages();
    }
    const startedAt = Date.now();
    await this.executeJavaScript(`window.__photopeaBridge.postString(${encodeScriptForExecute(wrapPhotopeaScript(script))})`);
    const waitOptions = rejectOnConsoleError
      ? { rejectConsoleErrorsSince: startedAt }
      : {};
    let echoMessage = null;

    if (echoPrefix) {
      echoMessage = await this.waitForMessage(
        (message) => isEchoMessage(message, echoPrefix),
        timeoutMs,
        '\u5728\u7ebfPSD\u5f15\u64ce\u6267\u884c\u8d85\u65f6\u3002',
        waitOptions
      );
    }

    if (waitForDone) {
      await this.waitForMessage(
        (message) => isDoneMessage(message),
        timeoutMs,
        '\u5728\u7ebfPSD\u5f15\u64ce\u6267\u884c\u8d85\u65f6\u3002',
        waitOptions
      );
    }

    return echoMessage;
  }

  async postFile(filePath, timeoutMs = OPEN_TIMEOUT_MS) {
    this.throwIfCanceled();
    await this.drainMessages();
    await this.executeJavaScript(`window.__photopeaBridge.postFile(${JSON.stringify(filePath)})`);
    await this.waitForMessage(
      (message) => isDoneMessage(message),
      timeoutMs,
      '\u6587\u4ef6\u6253\u5f00\u8d85\u65f6\u3002'
    );
  }

  async readActiveDocumentName({ timeoutMs = DOCUMENT_READY_RETRY_MS, drain = false } = {}) {
    const stateMessage = await this.postScript(buildActiveDocumentStateScript(), {
      timeoutMs,
      echoPrefix: ECHO_ACTIVE_DOCUMENT,
      waitForDone: false,
      drain
    });

    return String(stateMessage && stateMessage.value || '').slice(ECHO_ACTIVE_DOCUMENT.length);
  }

  async readDocumentInfo(documentName, { timeoutMs = DOCUMENT_READY_RETRY_MS, drain = false } = {}) {
    const stateMessage = await this.postScript(buildDocumentInfoScript(documentName), {
      timeoutMs,
      echoPrefix: ECHO_ACTIVE_DOCUMENT_INFO,
      waitForDone: false,
      drain
    });

    return parseJsonEchoValue(stateMessage, ECHO_ACTIVE_DOCUMENT_INFO);
  }

  async waitForActiveDocumentName(targetName, timeoutMs, timeoutMessage) {
    const startedAt = Date.now();
    let lastActiveName = '';

    while (Date.now() - startedAt < timeoutMs) {
      this.throwIfCanceled();

      try {
        const activeName = await this.readActiveDocumentName({
          timeoutMs: DOCUMENT_READY_RETRY_MS,
          drain: false
        });

        if (activeName) {
          lastActiveName = activeName;
        }

        if (activeName && documentNamesEqual(activeName, targetName)) {
          return activeName;
        }
      } catch (error) {
        await emitDebug(this.runtimeLogger, 'active-document-waiting', {
          targetName,
          elapsedMs: Date.now() - startedAt,
          reason: String(error && error.message || error || '')
        });
      }

      await delay(500);
    }

    throw new Error(timeoutMessage + (lastActiveName ? ` ${lastActiveName}` : ''));
  }

  async readActiveLayerState({ timeoutMs = DOCUMENT_READY_RETRY_MS, drain = false } = {}) {
    const stateMessage = await this.postScript(buildActiveLayerStateScript(), {
      timeoutMs,
      echoPrefix: ECHO_ACTIVE_LAYER,
      waitForDone: false,
      drain
    });

    return parseJsonEchoValue(stateMessage, ECHO_ACTIVE_LAYER);
  }

  async startScript(script) {
    this.throwIfCanceled();
    await this.drainMessages();
    await this.executeJavaScript(`window.__photopeaBridge.postString(${encodeScriptForExecute(wrapPhotopeaScript(script))})`);
  }

  async waitForMainDocument(startedAt) {
    const normalizedStartedAt = Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now();
    let lastProbeAt = 0;

    while (Date.now() - normalizedStartedAt < OPEN_TIMEOUT_MS) {
      this.throwIfCanceled();
      try {
        await emitDebug(this.runtimeLogger, 'open-psd-probe', {
          elapsedMs: Date.now() - normalizedStartedAt
        });
        let mainDocumentMessage = null;
        const elapsedMs = Date.now() - normalizedStartedAt;
        const shouldSendProbe = !this.hasStartupMainReadyScript
          || (elapsedMs > 45000 && Date.now() - lastProbeAt > 15000);

        if (shouldSendProbe) {
          lastProbeAt = Date.now();
          mainDocumentMessage = await this.postScript(buildActiveDocumentEchoScript(ECHO_MAIN_READY), {
            timeoutMs: DOCUMENT_READY_RETRY_MS,
            echoPrefix: ECHO_MAIN_READY,
            waitForDone: false,
            drain: false
          });
        } else {
          mainDocumentMessage = await this.waitForMessage(
            (message) => isEchoMessage(message, ECHO_MAIN_READY),
            5000,
            MAIN_READY_WAIT_TIMEOUT
          );
        }

        this.mainDocumentName = String(mainDocumentMessage && mainDocumentMessage.value || '').slice(ECHO_MAIN_READY.length);

        if (this.mainDocumentName) {
          await emitDebug(this.runtimeLogger, 'open-psd-done', {
            mainDocumentName: this.mainDocumentName
          });
          await emitDebug(this.runtimeLogger, 'open-psd-settle-start', {
            waitMs: MAIN_DOCUMENT_SETTLE_MS
          });
          await delay(MAIN_DOCUMENT_SETTLE_MS);
          await emitDebug(this.runtimeLogger, 'open-psd-settle-done');
          return;
        }
      } catch (_error) {
        const reason = String(_error && _error.message || _error || '');
        if (reason !== MAIN_READY_WAIT_TIMEOUT) {
          await emitDebug(this.runtimeLogger, 'open-psd-probe-waiting', {
            elapsedMs: Date.now() - normalizedStartedAt,
            reason
          });
        }
      }

      await delay(1000);
    }

    throw new Error('PSD\u6837\u673a\u6253\u5f00\u8d85\u65f6\uff0c\u8bf7\u5728\u5f39\u51fa\u7684PSD\u5f15\u64ce\u7a97\u53e3\u786e\u8ba4\u6587\u4ef6\u662f\u5426\u80fd\u6b63\u5e38\u6253\u5f00\u3002');
  }

  async openPsd(psdPath) {
    this.throwIfCanceled();
    const stat = await fs.promises.stat(psdPath);
    await emitDebug(this.runtimeLogger, 'open-psd-start', {
      psdPath,
      size: stat.size
    });
    const psdUrl = await this.fileServer.addFile(psdPath);
    await emitDebug(this.runtimeLogger, 'open-psd-url-ready', {
      size: stat.size
    });
    await this.startScript(`app.open(${JSON.stringify(psdUrl)});`);
    await this.waitForMainDocument(Date.now());
  }

  async openSmartObject(smartObjectName) {
    this.throwIfCanceled();
    if (!this.mainDocumentName) {
      throw new Error('PSD\u4e3b\u6587\u6863\u672a\u6253\u5f00\u3002');
    }

    await emitDebug(this.runtimeLogger, 'open-smart-start', {
      smartObjectName,
      mainDocumentName: this.mainDocumentName,
      smartObjectLayerId: this.smartObjectLayerId,
      smartObjectLayerIndex: this.smartObjectLayerIndex,
      smartObjectLayerCount: this.smartObjectLayerCount
    });
    let lastOpenError = null;
    const layerIndexCandidates = buildLayerIndexCandidates(
      this.smartObjectLayerIndex,
      this.smartObjectLayerCount
    );
    const selectionAttempts = sortSelectionAttemptsByPreferredMode([
      {
        mode: 'dom-name',
        script: buildSelectSmartObjectLayerByDomScript(smartObjectName)
      },
      {
        mode: 'action-name',
        script: buildSelectSmartObjectLayerByActionNameScript(smartObjectName)
      },
      ...layerIndexCandidates.map((layerIndex) => ({
        mode: `action-index:${layerIndex}`,
        script: buildSelectSmartObjectLayerByActionIndexScript(layerIndex)
      }))
    ], this.smartObjectSelectionMode);

    for (let index = 0; index < selectionAttempts.length; index += 1) {
      const attempt = selectionAttempts[index];
      try {
        const selectedMessage = await this.postScript(attempt.script, {
          timeoutMs: SMART_OBJECT_ACTION_TIMEOUT_MS,
          echoPrefix: ECHO_SMART_SELECTED,
          waitForDone: true,
          drain: false,
          rejectOnConsoleError: true
        });
        const selectedMode = String(selectedMessage && selectedMessage.value || '').slice(ECHO_SMART_SELECTED.length);
        await emitDebug(this.runtimeLogger, 'open-smart-selected', {
          smartObjectName,
          smartObjectLayerId: this.smartObjectLayerId,
          smartObjectLayerIndex: this.smartObjectLayerIndex,
          smartObjectLayerCount: this.smartObjectLayerCount,
          mode: selectedMode || attempt.mode
        });
        this.smartObjectSelectionMode = attempt.mode || selectedMode;
        await this.postScript(buildOpenSelectedSmartObjectScript(), {
          timeoutMs: SMART_OBJECT_ACTION_TIMEOUT_MS,
          echoPrefix: ECHO_SMART_OPEN_REQUESTED,
          waitForDone: true,
          drain: false,
          rejectOnConsoleError: true
        });
        await emitDebug(this.runtimeLogger, 'open-smart-requested', {
          smartObjectName,
          mode: selectedMode || attempt.mode
        });
        lastOpenError = null;
        break;
      } catch (error) {
        lastOpenError = error;
        if (this.smartObjectSelectionMode === attempt.mode) {
          this.smartObjectSelectionMode = '';
        }
        await emitDebug(this.runtimeLogger, 'open-smart-candidate-failed', {
          smartObjectName,
          mode: attempt.mode,
          reason: String(error && error.message || error || '')
        });
      }
    }

    if (lastOpenError) {
      throw lastOpenError;
    }

    const startedAt = Date.now();
    let lastActiveName = '';

    while (Date.now() - startedAt < OPEN_TIMEOUT_MS) {
      this.throwIfCanceled();
      try {
        const activeName = await this.readActiveDocumentName({
          timeoutMs: DOCUMENT_READY_RETRY_MS,
          drain: false
        });

        if (activeName) {
          lastActiveName = activeName;
        }

        if (activeName && !documentNamesEqual(activeName, this.mainDocumentName)) {
          this.smartDocumentName = activeName;
          await emitDebug(this.runtimeLogger, 'open-smart-done', {
            smartDocumentName: this.smartDocumentName
          });
          return;
        }
      } catch (error) {
        await emitDebug(this.runtimeLogger, 'open-smart-probe-waiting', {
          elapsedMs: Date.now() - startedAt,
          reason: String(error && error.message || error || '')
        });
      }

      await delay(500);
    }

    throw new Error('\u667a\u80fd\u5bf9\u8c61\u6ca1\u6709\u6210\u529f\u6253\u5f00\uff0c\u8bf7\u68c0\u67e5\u667a\u80fd\u5bf9\u8c61\u540d\u79f0\u3002' + (lastActiveName ? ` ${lastActiveName}` : ''));
  }

  async replaceSmartObjectWithImage(imagePath, replacementMode, options = {}) {
    this.throwIfCanceled();
    if (!this.smartDocumentName) {
      throw new Error('\u667a\u80fd\u5bf9\u8c61\u6e90\u6587\u6863\u672a\u6253\u5f00\u3002');
    }

    const normalizedReplacementMode = normalizeText(replacementMode);
    const smartDocumentInfo = normalizedReplacementMode === 'contain-canvas'
      ? await this.readDocumentInfo(this.smartDocumentName, {
        drain: false
      })
      : null;
    const smartDocumentSize = smartDocumentInfo && normalizedReplacementMode === 'contain-canvas'
      ? {
        width: Number(smartDocumentInfo.width) || 0,
        height: Number(smartDocumentInfo.height) || 0
      }
      : null;
    const stat = await fs.promises.stat(imagePath);
    const preparedImage = await preparePhotopeaInputImage(imagePath, this.runtimeLogger, {
      targetSize: smartDocumentSize,
      sourceRotation: options.sourceRotation,
      tempRootDir: this.tempRootDir
    });
    const fitReplacementMode = preparedImage.targetSizeApplied ? 'native-canvas' : replacementMode;
    await emitDebug(this.runtimeLogger, 'open-image-start', {
      imagePath,
      preparedImagePath: preparedImage.filePath,
      smartDocumentSize,
      sourceRotation: normalizeSourceRotation(options.sourceRotation),
      replacementMode,
      fitReplacementMode,
      size: stat.size
    });

    try {
      const imageUrl = await this.fileServer.addFile(preparedImage.filePath);
      await this.startScript(`app.open(${JSON.stringify(imageUrl)});`);
      const startedAt = Date.now();
      let imageReady = false;
      let lastActiveName = '';

      while (Date.now() - startedAt < OPEN_TIMEOUT_MS) {
        this.throwIfCanceled();
        try {
          const activeName = await this.readActiveDocumentName({
            timeoutMs: DOCUMENT_READY_RETRY_MS,
            drain: false
          });

          if (activeName) {
            lastActiveName = activeName;
          }

          if (activeName
            && !documentNamesEqual(activeName, this.smartDocumentName)
            && !documentNamesEqual(activeName, this.mainDocumentName)) {
            imageReady = true;
            break;
          }
        } catch (_error) {
          await emitDebug(this.runtimeLogger, 'open-image-probe-waiting', {
            elapsedMs: Date.now() - startedAt,
            reason: String(_error && _error.message || _error || '')
          });
        }

        await delay(500);
      }
      if (!imageReady) {
        throw new Error('\u7d20\u6750\u56fe\u6253\u5f00\u8d85\u65f6\u3002' + (lastActiveName ? ` ${lastActiveName}` : ''));
      }
      const imageDocumentName = lastActiveName;
      await emitDebug(this.runtimeLogger, 'open-image-done', {
        imagePath,
        preparedImagePath: preparedImage.filePath,
        imageDocumentName
      });
      const smartDocumentName = this.smartDocumentName;
      await emitDebug(this.runtimeLogger, 'duplicate-layer-start', {
        smartDocumentName,
        imageDocumentName
      });
      await this.postScript(buildDuplicateImageLayerIntoSmartDocumentScript(smartDocumentName), {
        timeoutMs: SCRIPT_TIMEOUT_MS,
        echoPrefix: ECHO_SMART_DUPLICATED,
        waitForDone: false,
        drain: false,
        rejectOnConsoleError: true
      });
      await this.waitForActiveDocumentName(
        smartDocumentName,
        DOCUMENT_READY_RETRY_MS,
        '\u7d20\u6750\u56fe\u5c42\u590d\u5236\u540e\u672a\u80fd\u56de\u5230\u667a\u80fd\u5bf9\u8c61\u6587\u6863\u3002'
      );
      await emitDebug(this.runtimeLogger, 'duplicate-layer-done', {
        smartDocumentName,
        imageDocumentName
      });
      await emitDebug(this.runtimeLogger, 'source-close-start', {
        smartDocumentName,
        imageDocumentName
      });
      await this.startScript(buildCloseSourceImageDocumentScript(imageDocumentName, smartDocumentName));
      await this.waitForActiveDocumentName(
        smartDocumentName,
        DOCUMENT_READY_RETRY_MS,
        '\u7d20\u6750\u56fe\u5df2\u8bf7\u6c42\u5173\u95ed\uff0c\u4f46\u672a\u56de\u5230\u667a\u80fd\u5bf9\u8c61\u6587\u6863\u3002'
      );
      await emitDebug(this.runtimeLogger, 'source-close-done', {
        smartDocumentName,
        imageDocumentName
      });
      await emitDebug(this.runtimeLogger, 'smart-layer-prepare-start', {
        smartDocumentName
      });
      await this.postScript(buildPrepareSmartDesignLayerScript(smartDocumentName), {
        timeoutMs: SCRIPT_TIMEOUT_MS,
        echoPrefix: ECHO_SMART_LAYER_READY,
        waitForDone: false,
        drain: false,
        rejectOnConsoleError: true
      });
      await emitDebug(this.runtimeLogger, 'smart-layer-prepare-done', {
        smartDocumentName
      });
      await emitDebug(this.runtimeLogger, 'smart-layer-fit-start', {
        smartDocumentName,
        replacementMode,
        fitReplacementMode
      });
      await this.postScript(buildFitSmartDesignLayerScript(smartDocumentName, fitReplacementMode), {
        timeoutMs: SCRIPT_TIMEOUT_MS,
        echoPrefix: ECHO_SMART_LAYER_FIT,
        waitForDone: false,
        drain: false,
        rejectOnConsoleError: true
      });
      await emitDebug(this.runtimeLogger, 'smart-layer-fit-done', {
        smartDocumentName,
        replacementMode,
        fitReplacementMode
      });
      await emitDebug(this.runtimeLogger, 'smart-layer-clean-start', {
        smartDocumentName
      });
      await this.postScript(buildCleanSmartDesignLayersScript(smartDocumentName), {
        timeoutMs: SCRIPT_TIMEOUT_MS,
        echoPrefix: ECHO_SMART_LAYER_CLEANED,
        waitForDone: false,
        drain: false,
        rejectOnConsoleError: true
      });
      await emitDebug(this.runtimeLogger, 'smart-layer-clean-done', {
        smartDocumentName
      });
      await emitDebug(this.runtimeLogger, 'smart-save-start', {
        smartDocumentName
      });
      await this.postScript(buildSaveSmartDocumentScript(smartDocumentName), {
        timeoutMs: SCRIPT_TIMEOUT_MS,
        echoPrefix: ECHO_SMART_SAVED,
        waitForDone: false,
        drain: false,
        rejectOnConsoleError: true
      });
      await this.waitForActiveDocumentName(
        smartDocumentName,
        DOCUMENT_READY_RETRY_MS,
        '\u667a\u80fd\u5bf9\u8c61\u4fdd\u5b58\u540e\u672a\u80fd\u786e\u8ba4\u5f53\u524d\u6587\u6863\u3002'
      );
      await emitDebug(this.runtimeLogger, 'smart-save-done', {
        smartDocumentName
      });
      await emitDebug(this.runtimeLogger, 'smart-close-start', {
        smartDocumentName,
        mainDocumentName: this.mainDocumentName
      });
      await this.postScript(buildCloseSmartDocumentScript(smartDocumentName), {
        timeoutMs: SMART_OBJECT_ACTION_TIMEOUT_MS,
        echoPrefix: ECHO_SMART_CLOSE_REQUESTED,
        waitForDone: false,
        drain: false,
        rejectOnConsoleError: true
      });
      await this.waitForActiveDocumentName(
        this.mainDocumentName,
        OPEN_TIMEOUT_MS,
        '\u667a\u80fd\u5bf9\u8c61\u5df2\u8bf7\u6c42\u5173\u95ed\uff0c\u4f46\u672a\u56de\u5230PSD\u4e3b\u6587\u6863\u3002'
      );
      await emitDebug(this.runtimeLogger, 'smart-close-done', {
        smartDocumentName,
        mainDocumentName: this.mainDocumentName
      });
      this.smartDocumentName = '';
      await emitDebug(this.runtimeLogger, 'replace-smart-done', {
        imagePath
      });
    } finally {
      await preparedImage.cleanup();
    }
  }

  async exportImage(outputFormat, options = {}) {
    const normalizedFormat = normalizeOutputFormat(outputFormat);
    const sourceExportFormat = getPhotopeaSourceExportFormat(normalizedFormat);
    this.throwIfCanceled();
    await emitDebug(this.runtimeLogger, 'export-start', {
      format: normalizedFormat,
      sourceFormat: sourceExportFormat
    });
    await this.drainMessages();
    await this.executeJavaScript(`window.__photopeaBridge.postString(${encodeScriptForExecute(wrapPhotopeaScript(buildExportDocumentScript(this.mainDocumentName, sourceExportFormat)))})`);
    const bufferMessage = await this.waitForMessage(
      (message) => message && message.kind === 'arrayBuffer',
      EXPORT_TIMEOUT_MS,
      '\u6837\u673a\u5bfc\u51fa\u8d85\u65f6\u3002'
    );
    await this.waitForMessage(
      (message) => isDoneMessage(message),
      EXPORT_TIMEOUT_MS,
      '\u6837\u673a\u5bfc\u51fa\u8d85\u65f6\u3002'
    );

    const sourceBuffer = bufferFromMessage(bufferMessage);
    const buffer = await convertExportBuffer(sourceBuffer, normalizedFormat, {
      metadataSourcePath: options.metadataSourcePath,
      sourceFormat: sourceExportFormat,
      imageQuality: options.imageQuality
    });
    await emitDebug(this.runtimeLogger, 'export-done', {
      sourceFormat: sourceExportFormat,
      outputFormat: normalizedFormat,
      sourceSize: sourceBuffer.length,
      size: buffer.length
    });

    return buffer;
  }

  async resetToMainDocument() {
    this.throwIfCanceled();
    if (!this.mainDocumentName) {
      throw new Error('PSD\u4e3b\u6587\u6863\u672a\u6253\u5f00\u3002');
    }

    await emitDebug(this.runtimeLogger, 'activate-main-start', {
      mainDocumentName: this.mainDocumentName
    });
    await this.postScript(buildActivateMainScript(this.mainDocumentName), {
      timeoutMs: SCRIPT_TIMEOUT_MS,
      echoPrefix: ECHO_MAIN_ACTIVATED,
      waitForDone: false,
      drain: false
    });
    await emitDebug(this.runtimeLogger, 'activate-main-done', {
      mainDocumentName: this.mainDocumentName
    });
  }
}

async function withPhotopeaSession(options, task) {
  const session = new PhotopeaSmartObjectSession(options);

  try {
    if (options && options.taskSignal && typeof options.taskSignal.setSession === 'function') {
      options.taskSignal.setSession(session);
    }
    const initConfig = options && typeof options.buildInitConfig === 'function'
      ? await options.buildInitConfig(session)
      : {};

    await session.init(initConfig);
    return await task(session);
  } finally {
    if (options && options.taskSignal && typeof options.taskSignal.setSession === 'function') {
      options.taskSignal.setSession(null);
    }
    await session.destroy();
  }
}

async function renderPsdSmartObjectMockups({
  psdPath,
  smartObjectName,
  sourceRotation,
  replacementMode,
  sourceFiles,
  outputPathForSource,
  shouldSkipSource,
  processOutputForSource,
  outputFormat,
  metadataSourcePath,
  metadataSourcePathForSource,
  imageQuality,
  onProgress,
  showEngineWindow,
  runtimeLogger,
  taskSignal,
  tempRootDir,
  engineStartupLimiter,
  postProcessLimiter,
  postProcessConcurrency,
  psdLayerMetadata,
  stopOnRecoverableItemError
}) {
  const normalizedSmartObjectName = normalizeText(smartObjectName);
  const items = [];
  const failures = [];
  emitRenderProgress(onProgress, {
    phase: 'mockup-local-parse'
  });
  const psdLayers = Array.isArray(psdLayerMetadata)
    ? psdLayerMetadata
    : await parsePsdLayerMetadata(psdPath);
  const smartObjectLayer = psdLayers.find((layer) => {
    return normalizeText(layer && layer.unicodeName) === normalizedSmartObjectName
      || normalizeText(layer && layer.name) === normalizedSmartObjectName;
  }) || null;

  if (!smartObjectLayer || !smartObjectLayer.id) {
    throw new Error('\u672c\u5730PSD\u56fe\u5c42\u8868\u4e2d\u6ca1\u6709\u627e\u5230\u667a\u80fd\u5bf9\u8c61\u540d\u79f0\uff0c\u8bf7\u786e\u8ba4PSD\u4e2d\u7684\u56fe\u5c42\u540d\u79f0\u3002');
  }

  await emitDebug(runtimeLogger, 'smart-layer-local-found', {
    smartObjectName: normalizedSmartObjectName,
    layerId: smartObjectLayer.id,
    layerIndex: smartObjectLayer.index,
    layerCount: psdLayers.length,
    isSmartObject: smartObjectLayer.isSmartObject,
    bounds: smartObjectLayer.bounds
  });

  let releaseEngineStartupSlot = null;
  let sessionResult = null;
  try {
    if (engineStartupLimiter && typeof engineStartupLimiter.acquire === 'function') {
      emitRenderProgress(onProgress, {
        phase: 'engine-start-wait'
      });
      releaseEngineStartupSlot = await engineStartupLimiter.acquire();
      throwIfTaskCanceled(taskSignal);
      emitRenderProgress(onProgress, {
        phase: 'engine-start'
      });
    }

    sessionResult = await withPhotopeaSession({
      runtimeLogger,
      showEngineWindow: showEngineWindow === true,
      taskSignal,
      tempRootDir,
      async buildInitConfig(session) {
        throwIfTaskCanceled(taskSignal);
        const stat = await fs.promises.stat(psdPath);
        emitRenderProgress(onProgress, {
          phase: 'mockup-loading',
          psdSize: stat.size
        });
        await emitDebug(runtimeLogger, 'open-psd-start', {
          psdPath,
          size: stat.size
        });
        const psdUrl = await session.prepareLocalFileUrl(psdPath);
        await emitDebug(runtimeLogger, 'open-psd-url-ready', {
          size: stat.size,
          mode: 'startup-files'
        });

        return {
          files: [psdUrl],
          script: wrapPhotopeaScript(buildActiveDocumentEchoScript(ECHO_MAIN_READY))
        };
      }
    }, async (session) => {
    throwIfTaskCanceled(taskSignal);
    session.smartObjectLayerId = smartObjectLayer.id;
    session.smartObjectLayerIndex = smartObjectLayer.index;
    session.smartObjectLayerCount = psdLayers.length;
      await session.waitForMainDocument(Date.now());
      emitRenderProgress(onProgress, {
        phase: 'mockup-ready'
      });
      if (releaseEngineStartupSlot) {
        releaseEngineStartupSlot();
        releaseEngineStartupSlot = null;
      }

      const resolvedPostProcessLimiter = postProcessLimiter && typeof postProcessLimiter.acquire === 'function'
        ? postProcessLimiter
        : createAsyncSlotLimiter(postProcessConcurrency || DEFAULT_POST_PROCESS_CONCURRENCY);
      const postProcessTasks = [];
      let recoverableStop = null;
      let itemsSinceLastPurge = 0;
      let lastPurgeAt = Date.now();
      for (let sourceIndex = 0; sourceIndex < sourceFiles.length; sourceIndex += 1) {
      const sourceFile = sourceFiles[sourceIndex];
      const progressSourceIndex = getSourceProgressIndex(sourceFile, sourceIndex);
      const progressSourceCount = getSourceProgressCount(sourceFile, sourceFiles);
      const progressSourceName = getSourceProgressName(sourceFile);
      throwIfTaskCanceled(taskSignal);
      const item = {
        sourcePath: sourceFile.filePath,
        relativePath: sourceFile.relativePath,
        outputs: [],
        error: ''
      };

      try {
        emitRenderProgress(onProgress, {
          phase: 'item-start',
          sourceIndex: progressSourceIndex,
          sourceCount: progressSourceCount,
          sourcePath: sourceFile.filePath,
          sourceName: progressSourceName
        });
        await emitDebug(runtimeLogger, 'item-start', {
          sourcePath: sourceFile.filePath,
          relativePath: sourceFile.relativePath
        });
        const outputPath = outputPathForSource(sourceFile);
        const outputRecord = {
          filePath: outputPath
        };
        const skipResult = typeof shouldSkipSource === 'function'
          ? await shouldSkipSource({
            sourceFile,
            item,
            outputPath
          })
          : null;
        if (skipResult && skipResult.skip === true) {
          item.skipped = true;
          item.skipReason = normalizeText(skipResult.reason) || '\u5bfc\u51fa\u7ed3\u679c\u5df2\u5b58\u5728\uff0c\u5df2\u8df3\u8fc7\u3002';
          emitRenderProgress(onProgress, {
            phase: 'item-skipped',
            sourceIndex: progressSourceIndex,
            sourceCount: progressSourceCount,
            sourcePath: sourceFile.filePath,
            sourceName: progressSourceName,
            message: item.skipReason
          });
          items.push(item);
          continue;
        }
        emitRenderProgress(onProgress, {
          phase: 'smart-open',
          sourceIndex: progressSourceIndex,
          sourceCount: progressSourceCount,
          sourcePath: sourceFile.filePath,
          sourceName: progressSourceName
        });
        await session.openSmartObject(normalizedSmartObjectName);
        emitRenderProgress(onProgress, {
          phase: 'replace',
          sourceIndex: progressSourceIndex,
          sourceCount: progressSourceCount,
          sourcePath: sourceFile.filePath,
          sourceName: progressSourceName
        });
        await session.replaceSmartObjectWithImage(sourceFile.filePath, replacementMode, {
          sourceRotation
        });
        const itemMetadataSourcePath = typeof metadataSourcePathForSource === 'function'
          ? normalizeText(metadataSourcePathForSource(sourceFile))
          : metadataSourcePath;
        const hasPostProcessor = typeof processOutputForSource === 'function';
        const postProcessExportFormat = hasPostProcessor ? 'png' : outputFormat;
        emitRenderProgress(onProgress, {
          phase: 'export',
          sourceIndex: progressSourceIndex,
          sourceCount: progressSourceCount,
          sourcePath: sourceFile.filePath,
          sourceName: progressSourceName,
          outputFormat
        });
        let outputBuffer = await session.exportImage(postProcessExportFormat, {
          metadataSourcePath: hasPostProcessor ? '' : itemMetadataSourcePath,
          imageQuality
        });
        if (hasPostProcessor) {
          const postProcessBuffer = outputBuffer;
          outputBuffer = null;
          clearSharpMemoryCacheSoon();
          emitRenderProgress(onProgress, {
            phase: 'post-process-wait',
            sourceIndex: progressSourceIndex,
            sourceCount: progressSourceCount,
            sourcePath: sourceFile.filePath,
            sourceName: progressSourceName
          });
          const releasePostProcessSlot = await resolvedPostProcessLimiter.acquire();
          const postProcessTask = (async () => {
            try {
              emitRenderProgress(onProgress, {
                phase: 'post-process',
                sourceIndex: progressSourceIndex,
                sourceCount: progressSourceCount,
                sourcePath: sourceFile.filePath,
                sourceName: progressSourceName
              });
              const processResult = await processOutputForSource({
                sourceFile,
                item,
                output: outputRecord,
                inputPath: '',
                outputPath,
                outputBuffer: postProcessBuffer,
                metadataSourcePath: itemMetadataSourcePath
              });

              if (processResult && Array.isArray(processResult.outputs)) {
                item.outputs = processResult.outputs;
              }
              if (processResult && Array.isArray(processResult.failures) && processResult.failures.length) {
                failures.push(...processResult.failures);
              }
              if (processResult && processResult.error) {
                item.error = String(processResult.error || '').trim();
              }

              emitRenderProgress(onProgress, {
                phase: item.error ? 'item-failed' : 'item-done',
                sourceIndex: progressSourceIndex,
                sourceCount: progressSourceCount,
                sourcePath: sourceFile.filePath,
                sourceName: progressSourceName,
                outputCount: item.outputs.length,
                message: item.error
              });
            } catch (error) {
              item.error = String(error && error.message || error || '').trim();
              emitRenderProgress(onProgress, {
                phase: 'item-failed',
                sourceIndex: progressSourceIndex,
                sourceCount: progressSourceCount,
                sourcePath: sourceFile.filePath,
                sourceName: progressSourceName,
                message: item.error
              });
              failures.push({
                sourcePath: sourceFile.filePath,
                message: item.error
              });

              if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
                runtimeLogger.logError('pod_suite_tool_photopea_post_process_failed', error);
              }
            } finally {
              clearSharpMemoryCacheSoon();
              releasePostProcessSlot();
            }
          })();

          postProcessTasks.push(postProcessTask);
        } else {
          emitRenderProgress(onProgress, {
            phase: 'write-output',
            sourceIndex: progressSourceIndex,
            sourceCount: progressSourceCount,
            sourcePath: sourceFile.filePath,
            sourceName: progressSourceName
          });
          await fs.promises.mkdir(path.dirname(outputPath), {
            recursive: true
          });
          await fs.promises.writeFile(outputPath, outputBuffer);
          item.outputs.push(outputRecord);
          emitRenderProgress(onProgress, {
            phase: 'item-done',
            sourceIndex: progressSourceIndex,
            sourceCount: progressSourceCount,
            sourcePath: sourceFile.filePath,
            sourceName: progressSourceName,
            outputCount: item.outputs.length
          });
        }
      } catch (error) {
        if (taskSignal && taskSignal.aborted) {
          throw error;
        }

        item.error = String(error && error.message || error || '').trim();
        if (stopOnRecoverableItemError === true && isRecoverablePhotopeaItemError(error)) {
          recoverableStop = {
            sourceFile,
            sourceIndex,
            sourcePath: sourceFile.filePath,
            sourceName: progressSourceName,
            message: item.error
          };
          emitRenderProgress(onProgress, {
            phase: 'item-retry',
            sourceIndex: progressSourceIndex,
            sourceCount: progressSourceCount,
            sourcePath: sourceFile.filePath,
            sourceName: progressSourceName,
            message: item.error
          });
          if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
            runtimeLogger.logError('pod_suite_tool_photopea_item_retry', error);
          }
        } else {
        emitRenderProgress(onProgress, {
          phase: 'item-failed',
          sourceIndex: progressSourceIndex,
          sourceCount: progressSourceCount,
          sourcePath: sourceFile.filePath,
          sourceName: progressSourceName,
          message: item.error
        });
        failures.push({
          sourcePath: sourceFile.filePath,
          message: item.error
        });

        if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
          runtimeLogger.logError('pod_suite_tool_photopea_item_failed', error);
        }
        }
        if (!recoverableStop) {
          await session.resetToMainDocument().catch(() => {});
        }
      } finally {
        emitRenderProgress(onProgress, {
          phase: 'cleanup',
          sourceIndex: progressSourceIndex,
          sourceCount: progressSourceCount,
          sourcePath: sourceFile.filePath,
          sourceName: progressSourceName
        });
        clearSharpMemoryCacheSoon();
        itemsSinceLastPurge += 1;
        if (!recoverableStop && (
          itemsSinceLastPurge >= PHOTOPEA_PURGE_EVERY_ITEMS
          || Date.now() - lastPurgeAt >= PHOTOPEA_PURGE_MIN_INTERVAL_MS
        )) {
          await session.purgeMemory();
          clearSharpMemoryCacheSoon(true);
          itemsSinceLastPurge = 0;
          lastPurgeAt = Date.now();
        }
      }

      if (recoverableStop) {
        break;
      }

      items.push(item);
    }

    if (postProcessTasks.length) {
      const drainSourceCount = sourceFiles.reduce((count, sourceFile) => {
        return Math.max(count, getSourceProgressCount(sourceFile, sourceFiles));
      }, 0);
      emitRenderProgress(onProgress, {
        phase: 'post-process-drain',
        sourceCount: drainSourceCount || sourceFiles.length
      });
        await Promise.all(postProcessTasks);
      }

      if (recoverableStop) {
        return {
          items,
          failures,
          retrySourceFile: recoverableStop.sourceFile,
          retrySourceMessage: recoverableStop.message,
          remainingSourceFiles: sourceFiles.slice(recoverableStop.sourceIndex + 1)
        };
      }

      if (itemsSinceLastPurge > 0) {
        await session.purgeMemory();
      }

      return {
        items,
        failures
      };
    });
  } finally {
    if (releaseEngineStartupSlot) {
      releaseEngineStartupSlot();
    }
  }

  if (sessionResult && typeof sessionResult === 'object') {
    return sessionResult;
  }

  return {
    items,
    failures
  };
}

module.exports = {
  PhotopeaSmartObjectSession,
  renderPsdSmartObjectMockups
};
