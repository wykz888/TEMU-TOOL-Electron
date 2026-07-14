const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { BrowserWindow } = require('electron');
const { parsePsdLayerMetadata } = require('./psdLayerMetadataParser');
const {
  PhotopeaLocalFileServer,
  makePhotopeaWrapperHtml
} = require('./photopeaLocalFileServer');
const {
  emitPhotopeaDebug: emitDebug
} = require('./photopeaRuntimeLogger');
const {
  appendPhotopeaConsoleError,
  bufferFromMessage,
  encodeScriptForExecute,
  findPhotopeaConsoleErrorSince,
  getPhotopeaErrorMessage,
  isDoneMessage,
  isEchoMessage,
  isErrorMessage
} = require('./photopeaMessageRuntime');
const {
  convertExportBuffer,
  getPhotopeaSourceExportFormat,
  normalizeOutputFormat,
  normalizeSourceRotation,
  preparePhotopeaInputImage,
  resolvePhotopeaTempRootDir
} = require('./photopeaImagePipeline');
const {
  ECHO_ACTIVE_DOCUMENT,
  ECHO_ACTIVE_DOCUMENT_INFO,
  ECHO_ACTIVE_LAYER,
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
} = require('./photopeaSmartObjectScripts');
const sharp = require('sharp');

sharp.cache({
  memory: 64,
  files: 20,
  items: 100
});

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
const RECOVERABLE_ITEM_TIMEOUT_PATTERN = /(?:\u5728\u7ebfPSD\u5f15\u64ce(?:\u6267\u884c|\u542f\u52a8|\u6e05\u7406\u5185\u5b58)?\u8d85\u65f6|\u7d20\u6750\u56fe\u6253\u5f00\u8d85\u65f6|\u6837\u673a\u5bfc\u51fa\u8d85\u65f6|\u6587\u4ef6\u6253\u5f00\u8d85\u65f6|\u672a\u56de\u5230PSD\u4e3b\u6587\u6863|\u672a\u56de\u5230\u667a\u80fd\u5bf9\u8c61\u6587\u6863|\u672a\u80fd\u786e\u8ba4\u5f53\u524d\u6587\u6863)/;

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

function isRecoverablePhotopeaItemError(error) {
  const message = String(error && error.message || error || '');
  return RECOVERABLE_ITEM_TIMEOUT_PATTERN.test(message);
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
        appendPhotopeaConsoleError(this.consoleErrors, {
          level,
          message,
          line,
          sourceId
        });
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

  async waitForMessage(predicate, timeoutMs, timeoutMessage, { rejectConsoleErrorsSince = 0 } = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      this.throwIfCanceled();
      if (rejectConsoleErrorsSince) {
        const consoleError = findPhotopeaConsoleErrorSince(this.consoleErrors, rejectConsoleErrorsSince);
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
          throw new Error(getPhotopeaErrorMessage(message) || '\u5728\u7ebfPSD\u5f15\u64ce\u6267\u884c\u5931\u8d25\u3002');
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
