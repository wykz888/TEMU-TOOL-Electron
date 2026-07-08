const crypto = require('node:crypto');
const path = require('node:path');
const {
  buildClickGenerateScript,
  buildEnsureHelperScript,
  buildHelperReadyCheckScript,
  buildGetResultStateScript,
  buildPageSnapshotScript,
  buildPrepareUploadInputScript,
  buildSetModeScript,
  buildSetPromptScript
} = require('./pageScripts');
const {
  saveDownloadedImage,
  sanitizeFileNameSegment
} = require('./fileStore');

const DEFAULT_EXPECTED_IMAGE_COUNT = 4;
const DEFAULT_QUEUE_TASK_LIMIT = 1;
const MAX_QUEUE_TASK_LIMIT = 10;
const DEFAULT_START_TASK_OFFSET = 0;
const DEFAULT_RESULT_TIMEOUT_MS = 120000;
const SUBMISSION_SIGNAL_TIMEOUT_MS = 6000;
const SUBMISSION_SIGNAL_POLL_MS = 600;
const RESULT_POLL_INTERVAL_MS = 1200;
const CONTROL_TICK_MS = 200;
const QUEUE_SUBMIT_GAP_MS = 900;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeHash(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeQueueTaskLimit(value) {
  const numericValue = Math.round(Number(value) || DEFAULT_QUEUE_TASK_LIMIT);

  return Math.min(MAX_QUEUE_TASK_LIMIT, Math.max(DEFAULT_QUEUE_TASK_LIMIT, numericValue));
}

function normalizeStartTaskOffset(value) {
  return Math.max(DEFAULT_START_TASK_OFFSET, Math.round(Number(value) || DEFAULT_START_TASK_OFFSET));
}

function createIdSet(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => normalizeText(item))
      .filter(Boolean)
  );
}

function appendUniqueValues(targetSet, values) {
  (Array.isArray(values) ? values : []).forEach((item) => {
    const normalized = normalizeText(item);

    if (normalized) {
      targetSet.add(normalized);
    }
  });
}

function dedupeImageRecords(imageRecords, expectedImageCount) {
  const result = [];
  const seenKeys = new Set();
  const limit = Math.max(1, Number(expectedImageCount) || DEFAULT_EXPECTED_IMAGE_COUNT);

  (Array.isArray(imageRecords) ? imageRecords : []).forEach((item) => {
    const recordKey = normalizeText(item && item.key) || normalizeText(item && item.url);

    if (!recordKey || seenKeys.has(recordKey)) {
      return;
    }

    seenKeys.add(recordKey);
    result.push({
      ...item,
      key: recordKey
    });
  });

  return result.slice(0, limit);
}

function buildBufferHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function delay(timeoutMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(timeoutMs) || 0));
  });
}

function summarizeNetworkEvent(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }

  const parts = [];
  const taskIds = Array.isArray(event.taskIds) ? event.taskIds.filter(Boolean) : [];
  const submitIds = Array.isArray(event.submitIds) ? event.submitIds.filter(Boolean) : [];
  const generateIds = Array.isArray(event.generateIds) ? event.generateIds.filter(Boolean) : [];
  const imageRecords = Array.isArray(event.imageRecords) ? event.imageRecords : [];

  if (taskIds.length > 0) {
    parts.push(`task=${taskIds[0]}`);
  }

  if (submitIds.length > 0) {
    parts.push(`submit=${submitIds[0]}`);
  }

  if (generateIds.length > 0) {
    parts.push(`generate=${generateIds[0]}`);
  }

  if (Math.max(0, Number(event.finishedImageCount) || 0) > 0 || Math.max(0, Number(event.totalImageCount) || 0) > 0) {
    parts.push(`images=${Math.max(0, Number(event.finishedImageCount) || 0)}/${Math.max(0, Number(event.totalImageCount) || 0)}`);
  }

  if (imageRecords.length > 0) {
    parts.push(`urls=${imageRecords.length}`);
  }

  return parts.join(' | ');
}

function formatCurrentDateFolderName() {
  const currentDate = new Date();
  const year = String(currentDate.getFullYear());
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildStoppedError() {
  const error = new Error('batch-stopped');

  error.code = 'jimeng-batch-stopped';
  return error;
}

function isControlActiveStatus(status) {
  return (
    status === 'running'
    || status === 'pause-requested'
    || status === 'paused'
    || status === 'stopping'
  );
}

function createJimengImageBatchRunner({
  getBrowserView,
  emitTaskEvent,
  log,
  logError,
  networkTracker,
  dedupService
}) {
  let activeRun = null;
  const helperStateByView = new WeakMap();

  function getAutomationHelperState(browserView) {
    if (!browserView) {
      return {
        ready: false,
        url: '',
        installPromise: null,
        listenersBound: false
      };
    }

    if (!helperStateByView.has(browserView)) {
      helperStateByView.set(browserView, {
        ready: false,
        url: '',
        installPromise: null,
        listenersBound: false
      });
    }

    return helperStateByView.get(browserView);
  }

  function bindAutomationHelperLifecycle(browserView) {
    if (!browserView || !browserView.webContents) {
      return;
    }

    const helperState = getAutomationHelperState(browserView);

    if (helperState.listenersBound === true) {
      return;
    }

    helperState.listenersBound = true;

    browserView.webContents.on('did-start-loading', () => {
      const nextState = getAutomationHelperState(browserView);

      nextState.ready = false;
      nextState.url = '';
      nextState.installPromise = null;
    });

    browserView.webContents.on('render-process-gone', () => {
      const nextState = getAutomationHelperState(browserView);

      nextState.ready = false;
      nextState.url = '';
      nextState.installPromise = null;
    });
  }

  function emitLog(level, message, extra = {}) {
    if (typeof emitTaskEvent === 'function') {
      emitTaskEvent({
        kind: 'log',
        level,
        message,
        ...extra
      });
    }
  }

  function buildIdleStatePayload() {
    return {
      runId: '',
      status: 'idle',
      mode: '',
      taskCount: 0,
      currentTaskIndex: 0,
      currentTaskLabel: '',
      completedTaskCount: 0,
      submittedTaskCount: 0,
      pendingTaskCount: 0,
      activeTaskCount: 0,
      savedCount: 0,
      saveDirectoryPath: '',
      effectiveSaveDirectoryPath: '',
      createDateSubdirectory: false,
      queueTaskLimit: DEFAULT_QUEUE_TASK_LIMIT,
      startedAt: '',
      endedAt: '',
      canStart: true,
      canPause: false,
      canResume: false,
      canStop: false
    };
  }

  function buildBatchStatePayload() {
    if (!activeRun) {
      return buildIdleStatePayload();
    }

    const status = normalizeText(activeRun.status) || 'idle';

    return {
      runId: normalizeText(activeRun.runId),
      status,
      mode: normalizeText(activeRun.mode),
      taskCount: Math.max(0, Number(activeRun.taskCount) || 0),
      currentTaskIndex: Math.max(0, Number(activeRun.currentTaskIndex) || 0),
      currentTaskLabel: normalizeText(activeRun.currentTaskLabel),
      completedTaskCount: Math.max(0, Number(activeRun.completedTaskCount) || 0),
      submittedTaskCount: Math.max(0, Number(activeRun.submittedTaskCount) || 0),
      pendingTaskCount: Math.max(0, Number(activeRun.pendingTaskCount) || 0),
      activeTaskCount: Math.max(0, Number(activeRun.activeTaskCount) || 0),
      savedCount: Math.max(0, Number(activeRun.savedCount) || 0),
      saveDirectoryPath: normalizeText(activeRun.saveDirectoryPath),
      effectiveSaveDirectoryPath: normalizeText(activeRun.effectiveSaveDirectoryPath),
      createDateSubdirectory: activeRun.createDateSubdirectory === true,
      queueTaskLimit: normalizeQueueTaskLimit(activeRun.queueTaskLimit),
      startedAt: normalizeText(activeRun.startedAt),
      endedAt: normalizeText(activeRun.endedAt),
      canStart: isControlActiveStatus(status) !== true,
      canPause: status === 'running',
      canResume: status === 'paused' || status === 'pause-requested',
      canStop: isControlActiveStatus(status)
    };
  }

  function emitState() {
    if (typeof emitTaskEvent !== 'function') {
      return buildBatchStatePayload();
    }

    const state = buildBatchStatePayload();

    emitTaskEvent({
      kind: 'state',
      state
    });

    return state;
  }

  function flushResumeWaiters(runEntry) {
    if (!runEntry || !Array.isArray(runEntry.resumeWaiters) || runEntry.resumeWaiters.length === 0) {
      return;
    }

    const waiters = runEntry.resumeWaiters.splice(0, runEntry.resumeWaiters.length);

    waiters.forEach((resolve) => {
      if (typeof resolve === 'function') {
        resolve();
      }
    });
  }

  function ensureActiveRun(runId) {
    if (!activeRun || normalizeText(activeRun.runId) !== normalizeText(runId)) {
      throw buildStoppedError();
    }

    return activeRun;
  }

  async function waitForControl(runId) {
    const runEntry = ensureActiveRun(runId);

    if (runEntry.stopRequested === true) {
      throw buildStoppedError();
    }

    if (runEntry.pauseRequested === true) {
      if (runEntry.status !== 'paused') {
        runEntry.status = 'paused';
        emitLog('warning', '\u6279\u91CF\u4EFB\u52A1\u5DF2\u6682\u505C\u3002');
        emitState();
      }

      await new Promise((resolve) => {
        runEntry.resumeWaiters.push(resolve);
      });

      return waitForControl(runId);
    }

    return runEntry;
  }

  async function waitWithControl(runId, timeoutMs) {
    const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);

    while (Date.now() < deadline) {
      await waitForControl(runId);
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        break;
      }

      await delay(Math.min(CONTROL_TICK_MS, remaining));
    }
  }

  function ensureBrowserView() {
    const browserView = typeof getBrowserView === 'function' ? getBrowserView() : null;

    if (
      !browserView
      || !browserView.webContents
      || typeof browserView.webContents.isDestroyed !== 'function'
      || browserView.webContents.isDestroyed() === true
    ) {
      throw new Error('jimeng-browser-unavailable');
    }

    return browserView;
  }

  async function executeInPage(browserView, script) {
    return browserView.webContents.executeJavaScript(script, true);
  }

  async function waitForPageReady(browserView) {
    if (browserView.webContents.isLoading() !== true) {
      return;
    }

    await new Promise((resolve) => {
      let settled = false;

      function finish() {
        if (settled) {
          return;
        }

        settled = true;
        browserView.webContents.removeListener('did-stop-loading', finish);
        browserView.webContents.removeListener('did-fail-load', finish);
        resolve();
      }

      browserView.webContents.once('did-stop-loading', finish);
      browserView.webContents.once('did-fail-load', finish);

      setTimeout(finish, 30000);
    });
  }

  async function ensureAutomationHelper(browserView) {
    bindAutomationHelperLifecycle(browserView);
    await waitForPageReady(browserView);

    const helperState = getAutomationHelperState(browserView);
    const currentUrl = normalizeText(browserView && browserView.webContents && browserView.webContents.getURL());

    if (helperState.ready === true && helperState.url === currentUrl) {
      return;
    }

    if (helperState.installPromise && helperState.url === currentUrl) {
      await helperState.installPromise;
      return;
    }

    let installPromise = null;

    installPromise = (async () => {
      if (helperState.ready !== true || helperState.url !== currentUrl) {
        const helperReady = await executeInPage(browserView, buildHelperReadyCheckScript()).catch(() => false);

        if (helperReady !== true) {
          await executeInPage(browserView, buildEnsureHelperScript());
        }
      }

      helperState.ready = true;
      helperState.url = normalizeText(browserView && browserView.webContents && browserView.webContents.getURL()) || currentUrl;

      if (networkTracker && typeof networkTracker.ensureAttached === 'function') {
        await networkTracker.ensureAttached();
      }
    })().finally(() => {
      if (helperState.installPromise === installPromise) {
        helperState.installPromise = null;
      }
    });

    helperState.url = currentUrl;
    helperState.installPromise = installPromise;
    await installPromise;
  }

  async function executeHelperScript(browserView, script) {
    await ensureAutomationHelper(browserView);

    let result = await executeInPage(browserView, script);

    if (result && result.reason === 'helper-missing') {
      const helperState = getAutomationHelperState(browserView);

      helperState.ready = false;
      helperState.url = '';
      await ensureAutomationHelper(browserView);
      result = await executeInPage(browserView, script);
    }

    return result;
  }

  async function getPageSnapshot(browserView) {
    try {
      const result = await executeHelperScript(browserView, buildPageSnapshotScript());

      if (result && result.reason === 'helper-missing') {
        return null;
      }

      return result;
    } catch (_error) {
      return null;
    }
  }

  async function setMode(browserView, mode) {
    const result = await executeHelperScript(browserView, buildSetModeScript(mode));

    if (!result || result.success !== true) {
      const snapshot = result && result.snapshot ? result.snapshot : await getPageSnapshot(browserView);
      const error = new Error(result && result.reason ? String(result.reason) : 'mode-switch-failed');

      error.snapshot = snapshot;
      throw error;
    }

    return result;
  }

  async function setPrompt(browserView, prompt) {
    const result = await executeHelperScript(browserView, buildSetPromptScript(prompt));

    if (!result || result.success !== true || result.matched === false) {
      const snapshot = result && result.snapshot ? result.snapshot : await getPageSnapshot(browserView);
      const error = new Error(result && result.reason ? String(result.reason) : 'prompt-set-failed');

      error.snapshot = snapshot;
      throw error;
    }

    return result;
  }

  async function setFileInputFiles(browserView, selector, filePaths) {
    const debuggerInstance = browserView.webContents.debugger;
    const attachedBefore = debuggerInstance.isAttached();
    let searchId = '';

    if (!attachedBefore) {
      debuggerInstance.attach('1.3');
    }

    try {
      await debuggerInstance.sendCommand('DOM.enable');
      const searchResult = await debuggerInstance.sendCommand('DOM.performSearch', {
        query: selector,
        includeUserAgentShadowDOM: true
      });
      searchId = String(searchResult && searchResult.searchId ? searchResult.searchId : '');
      const resultCount = Number(searchResult && searchResult.resultCount) || 0;

      if (!searchId || resultCount <= 0) {
        throw new Error('upload-input-node-not-found');
      }

      const searchResults = await debuggerInstance.sendCommand('DOM.getSearchResults', {
        searchId,
        fromIndex: 0,
        toIndex: 1
      });
      const nodeId = Array.isArray(searchResults && searchResults.nodeIds)
        ? Number(searchResults.nodeIds[0]) || 0
        : 0;

      if (!nodeId) {
        throw new Error('upload-input-node-missing');
      }

      await debuggerInstance.sendCommand('DOM.setFileInputFiles', {
        nodeId,
        files: filePaths
      });
    } finally {
      if (searchId) {
        try {
          await debuggerInstance.sendCommand('DOM.discardSearchResults', {
            searchId
          });
        } catch (_error) {}
      }

      if (!attachedBefore && debuggerInstance.isAttached()) {
        try {
          debuggerInstance.detach();
        } catch (_error) {}
      }
    }
  }

  async function prepareUploadInput(browserView, filePath) {
    const result = await executeHelperScript(browserView, buildPrepareUploadInputScript());

    if (!result || result.success !== true) {
      const snapshot = result && result.snapshot ? result.snapshot : await getPageSnapshot(browserView);
      const error = new Error(result && result.reason ? String(result.reason) : 'upload-input-prepare-failed');

      error.snapshot = snapshot;
      throw error;
    }

    await setFileInputFiles(browserView, String(result.selector || ''), [filePath]);
  }

  async function clickGenerate(browserView) {
    const result = await executeHelperScript(browserView, buildClickGenerateScript());

    if (!result || result.success !== true) {
      const snapshot = result && result.snapshot ? result.snapshot : await getPageSnapshot(browserView);
      const error = new Error(result && result.reason ? String(result.reason) : 'generate-click-failed');

      error.snapshot = snapshot;
      throw error;
    }

    const label = normalizeText(result && result.label);

    if (
      label.includes('\u518d\u6b21\u751f\u6210')
      || label.includes('\u91cd\u65b0\u7f16\u8f91')
      || label.includes('regenerate')
      || label.includes('edit')
    ) {
      const error = new Error('generate-target-suspicious');

      error.snapshot = await getPageSnapshot(browserView);
      throw error;
    }

    return result;
  }

  async function probeResultState(browserView) {
    const result = await executeHelperScript(browserView, buildGetResultStateScript());

    return {
      success: result && result.success === true,
      busy: result && result.busy === true,
      queueStatus: result && result.queueStatus && typeof result.queueStatus === 'object'
        ? result.queueStatus
        : {
          found: false,
          active: false,
          current: 0,
          total: 0,
          label: '',
          signature: ''
        }
    };
  }

  function getLatestNetworkEventId() {
    if (!networkTracker || typeof networkTracker.getLatestEventId !== 'function') {
      return 0;
    }

    return Math.max(0, Number(networkTracker.getLatestEventId()) || 0);
  }

  function getNetworkSignalsAfter(afterEventId, kinds = []) {
    if (!networkTracker || typeof networkTracker.getSignalsAfter !== 'function') {
      return [];
    }

    return networkTracker.getSignalsAfter(afterEventId, kinds);
  }

  function getNetworkTaskGroupsAfter(afterEventId) {
    if (!networkTracker || typeof networkTracker.getTaskGroupsAfter !== 'function') {
      return [];
    }

    return networkTracker.getTaskGroupsAfter(afterEventId);
  }

  function createTrackedNetworkTask(seed = null) {
    return {
      groupId: normalizeText(seed && seed.groupId),
      taskIds: createIdSet(seed && seed.taskIds),
      submitIds: createIdSet(seed && seed.submitIds),
      generateIds: createIdSet(seed && seed.generateIds),
      lastProgressKey: ''
    };
  }

  function appendTrackedTaskIdentity(trackedTask, source) {
    if (!trackedTask || !source) {
      return trackedTask;
    }

    if (normalizeText(source.groupId)) {
      trackedTask.groupId = normalizeText(source.groupId);
    }

    appendUniqueValues(trackedTask.taskIds, source.taskIds);
    appendUniqueValues(trackedTask.submitIds, source.submitIds);
    appendUniqueValues(trackedTask.generateIds, source.generateIds);

    return trackedTask;
  }

  function hasTrackedTaskIdentity(trackedTask) {
    return Boolean(
      trackedTask
      && (
        trackedTask.taskIds.size > 0
        || trackedTask.submitIds.size > 0
        || trackedTask.generateIds.size > 0
      )
    );
  }

  function hasTrackedTaskReference(trackedTask) {
    return Boolean(
      trackedTask
      && (
        normalizeText(trackedTask.groupId)
        || hasTrackedTaskIdentity(trackedTask)
      )
    );
  }

  function hasSharedIdentity(trackedTask, source) {
    if (!trackedTask || !source) {
      return false;
    }

    const sourceTaskIds = createIdSet(source.taskIds);
    const sourceSubmitIds = createIdSet(source.submitIds);
    const sourceGenerateIds = createIdSet(source.generateIds);

    return (
      Array.from(trackedTask.taskIds).some((item) => sourceTaskIds.has(item))
      || Array.from(trackedTask.submitIds).some((item) => sourceSubmitIds.has(item))
      || Array.from(trackedTask.generateIds).some((item) => sourceGenerateIds.has(item))
    );
  }

  function selectTrackedTaskGroup(afterEventId, trackedTask) {
    const taskGroups = getNetworkTaskGroupsAfter(afterEventId);

    if (taskGroups.length === 0) {
      return null;
    }

    if (trackedTask && normalizeText(trackedTask.groupId)) {
      const matchedByGroupId = taskGroups.find((group) => normalizeText(group && group.groupId) === trackedTask.groupId);

      if (matchedByGroupId) {
        appendTrackedTaskIdentity(trackedTask, matchedByGroupId);
        return matchedByGroupId;
      }
    }

    if (hasTrackedTaskIdentity(trackedTask)) {
      const matchedByIdentity = taskGroups.find((group) => hasSharedIdentity(trackedTask, group));

      if (matchedByIdentity) {
        appendTrackedTaskIdentity(trackedTask, matchedByIdentity);
        return matchedByIdentity;
      }
    }

    return null;
  }

  function getPreferredTaskIdentity(source) {
    const taskId = (Array.isArray(source && source.taskIds) ? source.taskIds : [])
      .map((item) => normalizeText(item))
      .find(Boolean) || '';
    const submitId = (Array.isArray(source && source.submitIds) ? source.submitIds : [])
      .map((item) => normalizeText(item))
      .find(Boolean) || '';
    const generateId = (Array.isArray(source && source.generateIds) ? source.generateIds : [])
      .map((item) => normalizeText(item))
      .find(Boolean) || '';

    return {
      taskId,
      submitId,
      generateId
    };
  }

  function getTargetImageCount(totalImageCount, expectedImageCount) {
    const normalizedExpected = Math.max(1, Number(expectedImageCount) || DEFAULT_EXPECTED_IMAGE_COUNT);
    const normalizedTotal = Math.max(0, Number(totalImageCount) || 0);

    if (normalizedTotal > 0) {
      return Math.min(normalizedExpected, normalizedTotal);
    }

    return normalizedExpected;
  }

  function isTaskGroupComplete(taskGroup, expectedImageCount) {
    if (!taskGroup || typeof taskGroup !== 'object') {
      return false;
    }

    const targetImageCount = getTargetImageCount(taskGroup.totalImageCount, expectedImageCount);
    const currentImageCount = Array.isArray(taskGroup.imageRecords) ? taskGroup.imageRecords.length : 0;
    const finishedImageCount = Math.max(0, Number(taskGroup.finishedImageCount) || 0);

    if (currentImageCount < targetImageCount) {
      return false;
    }

    if (Math.max(0, Number(taskGroup.totalImageCount) || 0) > 0) {
      return finishedImageCount >= targetImageCount;
    }

    return currentImageCount >= targetImageCount;
  }

  function buildTaskGroupProgressKey(taskGroup, expectedImageCount) {
    if (!taskGroup || typeof taskGroup !== 'object') {
      return '';
    }

    const targetImageCount = getTargetImageCount(taskGroup.totalImageCount, expectedImageCount);

    return [
      normalizeText(taskGroup.groupId),
      getPreferredTaskIdentity(taskGroup).taskId,
      String(Math.max(0, Number(taskGroup.finishedImageCount) || 0)),
      String(targetImageCount),
      String(Array.isArray(taskGroup.imageRecords) ? taskGroup.imageRecords.length : 0)
    ].join('|');
  }

  function emitTrackedTaskProgress(trackedTask, trackedTaskGroup) {
    if (!trackedTask || !trackedTaskGroup) {
      return;
    }

    const progressKey = buildTaskGroupProgressKey(trackedTaskGroup, trackedTask.expectedImageCount);

    if (progressKey && trackedTask.lastProgressKey !== progressKey) {
      trackedTask.lastProgressKey = progressKey;
      emitLog(
        'info',
        `\u540E\u53F0\u4EFB\u52A1\u8FDB\u5EA6\uFF1A${summarizeNetworkEvent(trackedTaskGroup)}`
      );
    }
  }

  function tryGetTrackedTaskCompletion(submittedTask) {
    if (!submittedTask || hasTrackedTaskReference(submittedTask.trackedTask) !== true) {
      return null;
    }

    const trackedTaskGroup = selectTrackedTaskGroup(
      submittedTask.baselineNetworkEventId,
      submittedTask.trackedTask
    );

    if (!trackedTaskGroup) {
      return null;
    }

    emitTrackedTaskProgress(submittedTask.trackedTask, trackedTaskGroup);

    if (isTaskGroupComplete(trackedTaskGroup, submittedTask.expectedImageCount) !== true) {
      return null;
    }

    return {
      success: true,
      status: 'network-result',
      attempts: 0,
      busy: false,
      networkEvent: trackedTaskGroup,
      networkTaskGroup: trackedTaskGroup
    };
  }

  function isTrackedTaskTimedOut(submittedTask, nowMs = Date.now()) {
    return (
      submittedTask
      && Math.max(0, Number(submittedTask.resultDeadlineAt) || 0) > 0
      && nowMs >= Math.max(0, Number(submittedTask.resultDeadlineAt) || 0)
    );
  }

  async function waitForAnyTrackedTaskCompletion(runId, inflightTasks) {
    while (true) {
      await waitForControl(runId);

      const completedEntries = [];
      const nowMs = Date.now();

      for (let index = 0; index < inflightTasks.length; index += 1) {
        const submittedTask = inflightTasks[index];
        const result = tryGetTrackedTaskCompletion(submittedTask);

        if (result && result.success === true) {
          completedEntries.push({
            submittedTask,
            result
          });
          continue;
        }

        if (isTrackedTaskTimedOut(submittedTask, nowMs) === true) {
          completedEntries.push({
            submittedTask,
            result: {
              success: false,
              skipped: true,
              status: 'skipped-timeout'
            }
          });
        }
      }

      if (completedEntries.length > 0) {
        return completedEntries;
      }

      await waitWithControl(runId, RESULT_POLL_INTERVAL_MS);
    }
  }

  async function waitForSubmissionSignal(browserView, baselineNetworkEventId, baselineQueueSignature, runId, trackedTask) {
    const deadline = Date.now() + SUBMISSION_SIGNAL_TIMEOUT_MS;
    let attempts = 0;
    let observedProcessing = false;

    while (Date.now() < deadline) {
      await waitForControl(runId);

      const trackedTaskGroup = selectTrackedTaskGroup(baselineNetworkEventId, trackedTask);

      if (trackedTaskGroup) {
        return {
          accepted: true,
          signal: 'network-task-group',
          attempts,
          networkTaskGroup: trackedTaskGroup
        };
      }

      const networkSignals = getNetworkSignalsAfter(baselineNetworkEventId, ['submission']).reverse();

      if (networkSignals.length > 0) {
        observedProcessing = true;

        for (let index = 0; index < networkSignals.length; index += 1) {
          const acceptedSignal = networkSignals[index];

          appendTrackedTaskIdentity(trackedTask, acceptedSignal);

          if (hasTrackedTaskReference(trackedTask) === true) {
            return {
              accepted: true,
              signal: `network-${acceptedSignal.kind}`,
              attempts,
              networkEvent: acceptedSignal
            };
          }
        }
      }

      const result = await probeResultState(browserView);

      attempts += 1;

      if (
        result.queueStatus
        && result.queueStatus.active === true
        && normalizeText(result.queueStatus.signature) !== normalizeText(baselineQueueSignature)
      ) {
        observedProcessing = true;
      }

      if (result.busy === true) {
        observedProcessing = true;
      }

      await waitWithControl(runId, SUBMISSION_SIGNAL_POLL_MS);
    }

    return {
      accepted: false,
      signal: observedProcessing === true ? 'task-identity-missing' : '',
      reason: observedProcessing === true ? 'task-identity-missing' : 'generate-not-accepted',
      attempts
    };
  }

  async function downloadNetworkImage(browserView, imageRecord) {
    const imageUrl = normalizeText(imageRecord && imageRecord.url);

    if (!imageUrl) {
      throw new Error('empty-network-image-url');
    }

    const response = await browserView.webContents.session.fetch(imageUrl, {
      method: 'GET'
    });

    if (!response || response.ok !== true) {
      throw new Error(`network-image-download-failed:${response ? response.status : 0}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || '',
      width: Math.max(0, Number(imageRecord && imageRecord.width) || 0),
      height: Math.max(0, Number(imageRecord && imageRecord.height) || 0),
      imageUrl
    };
  }

  function buildTaskPrompt(payload, task) {
    const prefix = normalizeText(payload.promptPrefix);
    const suffix = normalizeText(payload.promptSuffix);
    const corePrompt = normalizeText(task && task.prompt);

    return [
      prefix,
      corePrompt,
      suffix
    ].filter(Boolean).join('\n');
  }

  function buildTaskDedupPrompt(task) {
    return normalizeText(task && task.prompt);
  }

  function buildTaskLabel(payload, task, taskIndex) {
    if (payload.mode === 'image-to-image') {
      const imagePath = normalizeText(task && task.path);
      return sanitizeFileNameSegment(path.basename(imagePath || `image_${taskIndex}`), `image_${taskIndex}`);
    }

    return sanitizeFileNameSegment(task && task.prompt, `prompt_${taskIndex}`);
  }

  function buildTasks(payload) {
    if (payload.mode === 'image-to-image') {
      return Array.isArray(payload.images)
        ? payload.images.filter((item) => normalizeText(item && item.path)).map((item) => ({
          path: normalizeText(item.path),
          name: normalizeText(item.name)
        }))
        : [];
    }

    return Array.isArray(payload.promptLines)
      ? payload.promptLines.map((item) => normalizeText(item)).filter(Boolean).map((prompt) => ({ prompt }))
      : [];
  }

  async function buildPreparedTaskEntry(payload, task, taskIndex) {
    const promptText = buildTaskPrompt(payload, task);
    const dedupPromptText = buildTaskDedupPrompt(task);
    const taskLabel = buildTaskLabel(payload, task, taskIndex);
    const preparedTask = {
      ...task,
      promptText,
      taskLabel,
      taskSequence: taskIndex,
      hash: '',
      promptHash: '',
      imageHash: ''
    };

    if (payload.filterDuplicateTasks !== true || !dedupService) {
      return preparedTask;
    }

    const identity = payload.mode === 'image-to-image'
      ? await dedupService.buildImageTaskIdentity({
        imagePath: task.path,
        promptText
      })
      : dedupService.buildTextTaskIdentity(dedupPromptText);

    return {
      ...preparedTask,
      hash: normalizeHash(identity && identity.hash),
      promptHash: normalizeHash(identity && identity.promptHash),
      imageHash: normalizeHash(identity && identity.imageHash)
    };
  }

  async function prepareTasksForRun(payload) {
    const sourceTasks = buildTasks(payload);
    const startTaskOffset = normalizeStartTaskOffset(payload && payload.startTaskOffset);
    const skippedLeadingTaskCount = Math.min(startTaskOffset, sourceTasks.length);
    const runnableTasks = skippedLeadingTaskCount > 0
      ? sourceTasks.slice(skippedLeadingTaskCount)
      : sourceTasks;
    const preparedTasks = [];

    for (let index = 0; index < runnableTasks.length; index += 1) {
      preparedTasks.push(await buildPreparedTaskEntry(payload, runnableTasks[index], index + 1));
    }

    if (
      payload.filterDuplicateTasks !== true
      || !dedupService
      || typeof dedupService.filterNewTaskEntries !== 'function'
    ) {
      return {
        tasks: preparedTasks,
        duplicateHistoryTasks: [],
        duplicateBatchTasks: [],
        skippedLeadingTaskCount,
        sourceTaskCount: sourceTasks.length
      };
    }

    const filterResult = await dedupService.filterNewTaskEntries(preparedTasks);

    return {
      tasks: Array.isArray(filterResult && filterResult.freshEntries) ? filterResult.freshEntries : [],
      duplicateHistoryTasks: Array.isArray(filterResult && filterResult.duplicateHistoryEntries)
        ? filterResult.duplicateHistoryEntries
        : [],
      duplicateBatchTasks: Array.isArray(filterResult && filterResult.duplicateBatchEntries)
        ? filterResult.duplicateBatchEntries
        : [],
      skippedLeadingTaskCount,
      sourceTaskCount: sourceTasks.length
    };
  }

  async function markTaskEntryUsed(payload, task) {
    if (
      payload.filterDuplicateTasks !== true
      || !dedupService
      || typeof dedupService.markTaskEntriesUsed !== 'function'
    ) {
      return;
    }

    const taskHash = normalizeHash(task && task.hash);

    if (!taskHash) {
      return;
    }

    await dedupService.markTaskEntriesUsed([
      {
        hash: taskHash,
        mode: normalizeText(payload && payload.mode) || 'text-to-image',
        promptHash: normalizeHash(task && task.promptHash),
        imageHash: normalizeHash(task && task.imageHash)
      }
    ]);
  }

  function updateRunProgress(patch = {}) {
    if (!activeRun) {
      return buildIdleStatePayload();
    }

    Object.assign(activeRun, patch);
    return emitState();
  }

  async function submitSingleTask(browserView, payload, task, taskIndex, taskTotal, runId) {
    const prompt = normalizeText(task && task.promptText) || buildTaskPrompt(payload, task);
    const taskLabel = normalizeText(task && task.taskLabel) || buildTaskLabel(payload, task, taskIndex);
    const expectedImageCount = Math.max(1, Number(payload.expectedImageCount) || DEFAULT_EXPECTED_IMAGE_COUNT);

    updateRunProgress({
      currentTaskIndex: taskIndex,
      currentTaskLabel: taskLabel
    });

    emitLog(
      'info',
      `\u5F00\u59CB\u63D0\u4EA4 ${taskIndex}/${taskTotal}\uFF1A${taskLabel}`
    );

    await waitForControl(runId);

    const modeResult = await setMode(browserView, payload.mode);

    if (modeResult && modeResult.skipped === true && modeResult.fallback) {
      emitLog(
        'info',
        `\u672A\u68C0\u6D4B\u5230\u6A21\u5F0F\u5207\u6362\u6309\u94AE\uFF0C\u5DF2\u6309\u5F53\u524D\u9875\u9762\u80FD\u529B\u7EE7\u7EED\u6267\u884C\uFF1A${normalizeText(modeResult.fallback)}`
      );
    }

    await waitForControl(runId);

    if (payload.mode === 'image-to-image') {
      await prepareUploadInput(browserView, task.path);
      emitLog(
        'info',
        `\u5DF2\u5BFC\u5165\u53C2\u8003\u56FE\u7247\uFF1A${path.basename(task.path)}`
      );
      await waitWithControl(runId, 1200);
    }

    await waitForControl(runId);
    await setPrompt(browserView, prompt);
    await waitWithControl(runId, 320);
    await waitForControl(runId);

    const baselineNetworkEventId = getLatestNetworkEventId();
    const baselineResultState = await probeResultState(browserView);
    const baselineQueueSignature = baselineResultState && baselineResultState.queueStatus
      ? normalizeText(baselineResultState.queueStatus.signature)
      : '';
    const trackedTask = createTrackedNetworkTask();
    trackedTask.expectedImageCount = expectedImageCount;

    let submissionAccepted = false;
    let submissionEvent = null;
    let submissionTaskGroup = null;
    let lastSubmissionSignal = null;

    for (let submitAttempt = 1; submitAttempt <= 2; submitAttempt += 1) {
      await waitForControl(runId);
      await clickGenerate(browserView);

      const submissionSignal = await waitForSubmissionSignal(
        browserView,
        baselineNetworkEventId,
        baselineQueueSignature,
        runId,
        trackedTask
      );
      lastSubmissionSignal = submissionSignal;

      if (submissionSignal.accepted === true) {
        emitLog(
          'info',
          `\u5DF2\u63D0\u4EA4 ${taskIndex}/${taskTotal}\uFF0C\u7B49\u5F85\u540E\u53F0\u751F\u6210\u3002`
        );
        if (submissionSignal.networkTaskGroup) {
          appendTrackedTaskIdentity(trackedTask, submissionSignal.networkTaskGroup);
          submissionTaskGroup = submissionSignal.networkTaskGroup;
        }

        if (submissionSignal.networkEvent) {
          appendTrackedTaskIdentity(trackedTask, submissionSignal.networkEvent);
          submissionEvent = submissionSignal.networkEvent;
        }

        const submissionSummarySource = submissionTaskGroup || submissionEvent;

        if (submissionSummarySource) {
          const submissionSummary = summarizeNetworkEvent(submissionSummarySource);

          if (submissionSummary) {
            emitLog(
              'info',
              `\u540E\u53F0\u5DF2\u63A5\u6536\u4EFB\u52A1\uFF1A${submissionSummary}`
            );
          }
        }
        submissionAccepted = true;
        break;
      }

      if (submitAttempt < 2) {
        emitLog(
          'warning',
          '\u672A\u68C0\u6D4B\u5230\u5373\u68A6\u5DF2\u5F00\u59CB\u5904\u7406\uFF0C\u6B63\u5728\u91CD\u8BD5\u63D0\u4EA4\u3002'
        );
        await waitWithControl(runId, 900);
      }
    }

    if (submissionAccepted !== true) {
      const error = new Error(normalizeText(lastSubmissionSignal && lastSubmissionSignal.reason) || 'generate-not-accepted');

      error.snapshot = await getPageSnapshot(browserView);
      throw error;
    }

    if (hasTrackedTaskReference(trackedTask) !== true) {
      const error = new Error('task-identity-missing');

      error.snapshot = await getPageSnapshot(browserView);
      throw error;
    }

    return {
      task,
      taskIndex,
      taskTotal,
      prompt,
      taskLabel,
      expectedImageCount,
      baselineNetworkEventId,
      trackedTask,
      resultDeadlineAt: Date.now() + DEFAULT_RESULT_TIMEOUT_MS,
      submissionEvent,
      submissionTaskGroup
    };
  }

  async function saveTaskResult(browserView, payload, submittedTask, result, runId) {
    const task = submittedTask && submittedTask.task ? submittedTask.task : {};
    const taskIndex = Math.max(1, Number(submittedTask && submittedTask.taskIndex) || 1);
    const taskTotal = Math.max(1, Number(submittedTask && submittedTask.taskTotal) || 1);
    const prompt = normalizeText(submittedTask && submittedTask.prompt) || buildTaskPrompt(payload, task);
    const taskLabel = normalizeText(submittedTask && submittedTask.taskLabel) || buildTaskLabel(payload, task, taskIndex);
    const expectedImageCount = Math.max(1, Number(submittedTask && submittedTask.expectedImageCount) || DEFAULT_EXPECTED_IMAGE_COUNT);

    if (
      !result
      || result.success !== true
    ) {
      const error = new Error(result && result.status ? String(result.status) : 'result-wait-failed');

      error.snapshot = result && result.snapshot ? result.snapshot : await getPageSnapshot(browserView);
      throw error;
    }

    const savedItems = [];
    const resolvedNetworkSource = (
      result.networkTaskGroup
      || result.networkEvent
      || (submittedTask && submittedTask.submissionTaskGroup)
      || (submittedTask && submittedTask.submissionEvent)
      || null
    );
    const resolvedTaskIdentity = getPreferredTaskIdentity(resolvedNetworkSource);
    const rawImageRecords = Array.isArray(resolvedNetworkSource && resolvedNetworkSource.imageRecords)
      ? resolvedNetworkSource.imageRecords
      : [];
    const imageRecords = dedupeImageRecords(rawImageRecords, expectedImageCount);

    if (rawImageRecords.length > imageRecords.length) {
      emitLog(
        'warning',
        `\u68C0\u6D4B\u5230\u91CD\u590D\u7ED3\u679C\u56FE\u7247 ${rawImageRecords.length - imageRecords.length} \u5F20\uFF0C\u5DF2\u5728\u4FDD\u5B58\u524D\u8FC7\u6EE4\u3002`
      );
    }

    if (Array.isArray(resolvedNetworkSource && resolvedNetworkSource.imageRecords)) {
      resolvedNetworkSource.imageRecords = imageRecords;
    }

    const savedRecordKeySet = new Set();
    const savedBinaryHashSet = new Set();

    const filteredImageRecords = Array.isArray(imageRecords)
      ? imageRecords
      : [];

    if (filteredImageRecords.length === 0) {
      const error = new Error('network-images-missing');

      error.snapshot = await getPageSnapshot(browserView);
      throw error;
    }

    const resultSummary = summarizeNetworkEvent(resolvedNetworkSource);

    if (resultSummary) {
      emitLog(
        'info',
        `\u540E\u53F0\u5DF2\u8FD4\u56DE\u751F\u6210\u7ED3\u679C\uFF1A${resultSummary}`
      );
    }

    for (let index = 0; index < filteredImageRecords.length; index += 1) {
      await waitForControl(runId);

      const imageRecord = filteredImageRecords[index];
      const recordKey = normalizeText(imageRecord && imageRecord.key) || normalizeText(imageRecord && imageRecord.url);

      if (recordKey && savedRecordKeySet.has(recordKey)) {
        emitLog(
          'warning',
          `\u68C0\u6D4B\u5230\u91CD\u590D\u56FE\u7247\u952E ${recordKey}\uFF0C\u5DF2\u8DF3\u8FC7\u91CD\u590D\u4FDD\u5B58\u3002`
        );
        continue;
      }

      const networkImage = await downloadNetworkImage(browserView, imageRecord);
      const contentHash = buildBufferHash(networkImage.buffer);

      if (savedBinaryHashSet.has(contentHash)) {
        emitLog(
          'warning',
          `\u68C0\u6D4B\u5230\u91CD\u590D\u56FE\u50CF\u5185\u5BB9\uFF0C\u5DF2\u8DF3\u8FC7\u91CD\u590D\u4FDD\u5B58\u3002`
        );
        continue;
      }

      if (recordKey) {
        savedRecordKeySet.add(recordKey);
      }

      savedBinaryHashSet.add(contentHash);
      const savedItem = await saveDownloadedImage({
        buffer: networkImage.buffer,
        rootDirectoryPath: payload.saveDirectoryPath,
        mode: payload.mode,
        taskId: resolvedTaskIdentity.taskId,
        submitId: resolvedTaskIdentity.submitId,
        generateId: resolvedTaskIdentity.generateId,
        taskIndex,
        imageIndex: index + 1,
        promptText: task.promptText || task.prompt || prompt,
        sourceName: task.name || path.basename(task.path || ''),
        width: networkImage.width,
        height: networkImage.height,
        imageUrl: networkImage.imageUrl,
        contentType: networkImage.contentType
      });

      savedItems.push(savedItem);
      updateRunProgress({
        savedCount: Math.max(0, Number(activeRun && activeRun.savedCount) || 0) + 1
      });
      emitLog(
        'success',
        `\u5DF2\u4FDD\u5B58\u56FE\u7247 ${savedItems.length}/${filteredImageRecords.length}\uFF1A${savedItem.ratioLabel}\\${savedItem.fileName}`
      );
    }

    try {
      await markTaskEntryUsed(payload, task);
    } catch (error) {
      emitLog(
        'warning',
        '\u672C\u6761\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF0C\u4F46\u53BB\u91CD\u8BB0\u5F55\u5199\u5165\u5931\u8D25\u3002'
      );

      if (typeof logError === 'function') {
        logError('jimeng_image_task_mark_used_failed', error, {
          mode: payload.mode,
          taskIndex,
          taskLabel,
          hash: normalizeHash(task && task.hash)
        });
      }
    }

    updateRunProgress({
      completedTaskCount: Math.max(0, Number(activeRun && activeRun.completedTaskCount) || 0) + 1
    });
    emitLog(
      'success',
      `\u4EFB\u52A1 ${taskIndex}/${taskTotal} \u5B8C\u6210\uFF0C\u5171\u4FDD\u5B58 ${savedItems.length} \u5F20\u56FE\u7247\u3002`
    );

    return savedItems;
  }

  async function flushCompletedTrackedTasks(browserView, payload, inflightTasks, results, runId, pendingTaskCount) {
    if (!Array.isArray(inflightTasks) || inflightTasks.length === 0) {
      return 0;
    }

    const completedEntries = await waitForAnyTrackedTaskCompletion(runId, inflightTasks);
    const completedTaskSet = new Set(completedEntries.map((entry) => entry.submittedTask));

    for (let index = inflightTasks.length - 1; index >= 0; index -= 1) {
      if (completedTaskSet.has(inflightTasks[index])) {
        inflightTasks.splice(index, 1);
      }
    }

    updateRunProgress({
      activeTaskCount: inflightTasks.length,
      pendingTaskCount: Math.max(0, Number(pendingTaskCount) || 0)
    });

    for (let index = 0; index < completedEntries.length; index += 1) {
      const completedEntry = completedEntries[index];
      if (completedEntry.result && completedEntry.result.success === true) {
        const savedItems = await saveTaskResult(
          browserView,
          payload,
          completedEntry.submittedTask,
          completedEntry.result,
          runId
        );

        results.push({
          taskIndex: completedEntry.submittedTask.taskIndex,
          savedItems
        });
        continue;
      }

      if (completedEntry.result && completedEntry.result.skipped === true) {
        const taskIndex = Math.max(1, Number(completedEntry.submittedTask && completedEntry.submittedTask.taskIndex) || 1);
        const taskTotal = Math.max(1, Number(completedEntry.submittedTask && completedEntry.submittedTask.taskTotal) || 1);
        const taskLabel = normalizeText(completedEntry.submittedTask && completedEntry.submittedTask.taskLabel) || `task_${taskIndex}`;

        updateRunProgress({
          completedTaskCount: Math.max(0, Number(activeRun && activeRun.completedTaskCount) || 0) + 1
        });
        emitLog(
          'warning',
          `\u4EFB\u52A1 ${taskIndex}/${taskTotal} \u7B49\u5F85\u8D85\u8FC7 2 \u5206\u949F\uFF0C\u5DF2\u8DF3\u8FC7\uFF1A${taskLabel}`
        );

        results.push({
          taskIndex,
          savedItems: [],
          skipped: true
        });
      }
    }

    return completedEntries.length;
  }

  function getBatchState() {
    return {
      success: true,
      state: buildBatchStatePayload()
    };
  }

  function pauseBatchGeneration() {
    if (!activeRun) {
      return {
        success: false,
        message: '\u5F53\u524D\u6CA1\u6709\u6B63\u5728\u6267\u884C\u7684\u6279\u91CF\u4EFB\u52A1\u3002',
        state: buildBatchStatePayload()
      };
    }

    if (activeRun.status === 'paused' || activeRun.status === 'pause-requested') {
      return {
        success: true,
        state: emitState()
      };
    }

    if (activeRun.status !== 'running') {
      return {
        success: false,
        message: '\u5F53\u524D\u4EFB\u52A1\u72B6\u6001\u4E0D\u652F\u6301\u6682\u505C\u3002',
        state: buildBatchStatePayload()
      };
    }

    activeRun.pauseRequested = true;
    activeRun.status = 'pause-requested';
    emitLog('warning', '\u5DF2\u8BF7\u6C42\u6682\u505C\uFF0C\u5F53\u524D\u6B65\u9AA4\u5B8C\u6210\u540E\u4F1A\u6682\u505C\u3002');

    return {
      success: true,
      state: emitState()
    };
  }

  function resumeBatchGeneration() {
    if (!activeRun) {
      return {
        success: false,
        message: '\u5F53\u524D\u6CA1\u6709\u53EF\u7EE7\u7EED\u7684\u6279\u91CF\u4EFB\u52A1\u3002',
        state: buildBatchStatePayload()
      };
    }

    if (activeRun.status === 'pause-requested') {
      activeRun.pauseRequested = false;
      activeRun.status = 'running';
      emitLog('info', '\u5DF2\u53D6\u6D88\u6682\u505C\u8BF7\u6C42\uFF0C\u4EFB\u52A1\u7EE7\u7EED\u6267\u884C\u3002');

      return {
        success: true,
        state: emitState()
      };
    }

    if (activeRun.status !== 'paused') {
      return {
        success: false,
        message: '\u5F53\u524D\u4EFB\u52A1\u4E0D\u5728\u6682\u505C\u72B6\u6001\u3002',
        state: buildBatchStatePayload()
      };
    }

    activeRun.pauseRequested = false;
    activeRun.status = 'running';
    emitLog('info', '\u6279\u91CF\u4EFB\u52A1\u5DF2\u7EE7\u7EED\u3002');
    flushResumeWaiters(activeRun);

    return {
      success: true,
      state: emitState()
    };
  }

  function stopBatchGeneration() {
    if (!activeRun) {
      return {
        success: false,
        message: '\u5F53\u524D\u6CA1\u6709\u6B63\u5728\u6267\u884C\u7684\u6279\u91CF\u4EFB\u52A1\u3002',
        state: buildBatchStatePayload()
      };
    }

    if (isControlActiveStatus(activeRun.status) !== true) {
      return {
        success: false,
        message: '\u5F53\u524D\u4EFB\u52A1\u5DF2\u4E0D\u5728\u53EF\u505C\u6B62\u72B6\u6001\u3002',
        state: buildBatchStatePayload()
      };
    }

    activeRun.stopRequested = true;
    activeRun.pauseRequested = false;
    activeRun.status = 'stopping';
    emitLog('warning', '\u5DF2\u8BF7\u6C42\u505C\u6B62\uFF0C\u5F53\u524D\u6B65\u9AA4\u7ED3\u675F\u540E\u505C\u6B62\u3002');
    flushResumeWaiters(activeRun);

    return {
      success: true,
      state: emitState()
    };
  }

  async function startBatchGeneration(payload) {
    if (activeRun && isControlActiveStatus(activeRun.status)) {
      return {
        success: false,
        message: '\u5F53\u524D\u5DF2\u6709\u6279\u91CF\u4EFB\u52A1\u5728\u8FD0\u884C\u3002',
        state: buildBatchStatePayload()
      };
    }

    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
    const saveDirectoryPath = normalizeText(normalizedPayload.saveDirectoryPath);
    const createDateSubdirectory = normalizedPayload.createDateSubdirectory === true;
    const queueTaskLimit = normalizeQueueTaskLimit(normalizedPayload.queueTaskLimit);
    const startTaskOffset = normalizeStartTaskOffset(normalizedPayload.startTaskOffset);
    const effectiveSaveDirectoryPath = createDateSubdirectory
      ? path.join(saveDirectoryPath, formatCurrentDateFolderName())
      : saveDirectoryPath;

    if (!saveDirectoryPath) {
      return {
        success: false,
        message: '\u8BF7\u5148\u8BBE\u7F6E\u4FDD\u5B58\u76EE\u5F55\u3002',
        state: buildBatchStatePayload()
      };
    }

    let preparedTaskResult = null;

    try {
      preparedTaskResult = await prepareTasksForRun(normalizedPayload);
    } catch (error) {
      if (typeof logError === 'function') {
        logError('jimeng_image_batch_prepare_failed', error, {
          mode: normalizeText(normalizedPayload.mode) || 'text-to-image'
        });
      }

      return {
        success: false,
        message: normalizeText(error && error.message) || '\u6279\u91CF\u4EFB\u52A1\u9884\u5904\u7406\u5931\u8D25\u3002',
        state: buildBatchStatePayload()
      };
    }

    const tasks = Array.isArray(preparedTaskResult && preparedTaskResult.tasks)
      ? preparedTaskResult.tasks
      : [];
    const duplicateHistoryTaskCount = Array.isArray(preparedTaskResult && preparedTaskResult.duplicateHistoryTasks)
      ? preparedTaskResult.duplicateHistoryTasks.length
      : 0;
    const duplicateBatchTaskCount = Array.isArray(preparedTaskResult && preparedTaskResult.duplicateBatchTasks)
      ? preparedTaskResult.duplicateBatchTasks.length
      : 0;
    const skippedLeadingTaskCount = Math.max(
      0,
      Number(preparedTaskResult && preparedTaskResult.skippedLeadingTaskCount) || 0
    );
    const sourceTaskCount = Math.max(
      0,
      Number(preparedTaskResult && preparedTaskResult.sourceTaskCount) || tasks.length
    );

    if (duplicateHistoryTaskCount > 0) {
      emitLog(
        'info',
        `\u5DF2\u8FC7\u6EE4\u5386\u53F2\u91CD\u590D\u4EFB\u52A1 ${duplicateHistoryTaskCount} \u6761\u3002`
      );
    }

    if (duplicateBatchTaskCount > 0) {
      emitLog(
        'info',
        `\u5DF2\u8FC7\u6EE4\u672C\u6B21\u6279\u6B21\u5185\u91CD\u590D\u4EFB\u52A1 ${duplicateBatchTaskCount} \u6761\u3002`
      );
    }

    if (tasks.length === 0) {
      const emptyMessage = skippedLeadingTaskCount >= sourceTaskCount && sourceTaskCount > 0
        ? '\u8D77\u59CB\u6570\u91CF\u5DF2\u8D85\u8FC7\u5F53\u524D\u4EFB\u52A1\u603B\u6570\u3002'
        : normalizedPayload.filterDuplicateTasks === true
          ? '\u53BB\u91CD\u540E\u6682\u65E0\u53EF\u6267\u884C\u7684\u6279\u91CF\u4EFB\u52A1\u3002'
        : normalizedPayload.mode === 'image-to-image'
          ? '\u672A\u68C0\u6D4B\u5230\u53EF\u6267\u884C\u7684\u56FE\u7247\u4EFB\u52A1\u3002'
          : '\u672A\u68C0\u6D4B\u5230\u53EF\u6267\u884C\u7684\u63D0\u793A\u8BCD\u4EFB\u52A1\u3002';

      if (normalizedPayload.filterDuplicateTasks === true) {
        emitLog('warning', emptyMessage);
      }

      return {
        success: false,
        skipped: normalizedPayload.filterDuplicateTasks === true,
        message: emptyMessage,
        state: buildBatchStatePayload()
      };
    }

    const browserView = ensureBrowserView();
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const results = [];
    const effectivePayload = {
      ...normalizedPayload,
      saveDirectoryPath: effectiveSaveDirectoryPath,
      queueTaskLimit,
      startTaskOffset
    };

    activeRun = {
      runId,
      status: 'running',
      mode: normalizeText(normalizedPayload.mode) || 'text-to-image',
      taskCount: tasks.length,
      currentTaskIndex: 0,
      currentTaskLabel: '',
      completedTaskCount: 0,
      submittedTaskCount: 0,
      pendingTaskCount: tasks.length,
      activeTaskCount: 0,
      savedCount: 0,
      saveDirectoryPath,
      effectiveSaveDirectoryPath,
      createDateSubdirectory,
      queueTaskLimit,
      startedAt: nowIso(),
      endedAt: '',
      pauseRequested: false,
      stopRequested: false,
      resumeWaiters: []
    };

    emitState();
    emitLog(
      'info',
      `\u6279\u91CF\u4EFB\u52A1\u5DF2\u542F\u52A8\uFF1A${tasks.length} \u6761\uFF0C\u961F\u5217\u4E0A\u9650 ${queueTaskLimit}\uFF0C\u4FDD\u5B58\u76EE\u5F55 ${effectiveSaveDirectoryPath}${skippedLeadingTaskCount > 0 ? ` | \u8DF3\u8FC7\u524D ${skippedLeadingTaskCount} \u6761` : ''}${normalizedPayload.filterDuplicateTasks === true ? ` | \u5DF2\u8FC7\u6EE4 ${duplicateHistoryTaskCount + duplicateBatchTaskCount} \u6761\u91CD\u590D\u4EFB\u52A1` : ''}`
    );

    if (typeof log === 'function') {
      log('jimeng_image_batch_started', {
        runId,
        mode: activeRun.mode,
        taskCount: tasks.length,
        queueTaskLimit,
        startTaskOffset,
        saveDirectoryPath,
        effectiveSaveDirectoryPath,
        createDateSubdirectory,
        filterDuplicateTasks: normalizedPayload.filterDuplicateTasks === true,
        skippedLeadingTaskCount,
        duplicateHistoryTaskCount,
        duplicateBatchTaskCount
      });
    }

    try {
      await ensureAutomationHelper(browserView);
      const inflightTasks = [];
      let nextTaskIndex = 0;
      let queueWaitLogged = false;

      while (nextTaskIndex < tasks.length || inflightTasks.length > 0) {
        await waitForControl(runId);

        while (nextTaskIndex < tasks.length && inflightTasks.length < queueTaskLimit) {
          const submittedTask = await submitSingleTask(
            browserView,
            effectivePayload,
            tasks[nextTaskIndex],
            nextTaskIndex + 1,
            tasks.length,
            runId
          );

          nextTaskIndex += 1;
          updateRunProgress({
            submittedTaskCount: nextTaskIndex,
            pendingTaskCount: Math.max(0, tasks.length - nextTaskIndex),
            currentTaskIndex: submittedTask.taskIndex,
            currentTaskLabel: submittedTask.taskLabel
          });

          inflightTasks.push(submittedTask);
          updateRunProgress({
            activeTaskCount: inflightTasks.length,
            pendingTaskCount: Math.max(0, tasks.length - nextTaskIndex)
          });

          queueWaitLogged = false;

          if (nextTaskIndex < tasks.length && inflightTasks.length < queueTaskLimit) {
            await waitWithControl(runId, QUEUE_SUBMIT_GAP_MS);
          }
        }

        if (inflightTasks.length === 0) {
          continue;
        }

        if (nextTaskIndex < tasks.length && inflightTasks.length >= queueTaskLimit && queueWaitLogged !== true) {
          emitLog(
            'info',
            `\u63D0\u793A\u8BCD\u961F\u5217\u5DF2\u6EE1 ${inflightTasks.length}/${queueTaskLimit}\uFF0C\u7B49\u5F85\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u5B8C\u6210\u540E\u7EE7\u7EED\u8865\u4F4D\u3002`
          );
          queueWaitLogged = true;
        }

        await flushCompletedTrackedTasks(
          browserView,
          effectivePayload,
          inflightTasks,
          results,
          runId,
          tasks.length - nextTaskIndex
        );

        queueWaitLogged = false;
      }

      activeRun.status = 'completed';
      activeRun.endedAt = nowIso();
      activeRun.currentTaskIndex = tasks.length;
      activeRun.currentTaskLabel = '';
      activeRun.activeTaskCount = 0;
      activeRun.pendingTaskCount = 0;

      const savedCount = results.reduce((total, item) => total + item.savedItems.length, 0);

      activeRun.savedCount = savedCount;
      emitLog(
        'success',
        `\u6279\u91CF\u4EFB\u52A1\u5B8C\u6210\uFF1A${tasks.length} \u6761\uFF0C\u5171\u4FDD\u5B58 ${savedCount} \u5F20\u56FE\u7247\u3002`
      );
      emitState();

      if (typeof log === 'function') {
        log('jimeng_image_batch_completed', {
          runId,
          taskCount: tasks.length,
          savedCount
        });
      }

      return {
        success: true,
        runId,
        taskCount: tasks.length,
        savedCount,
        effectiveSaveDirectoryPath,
        state: buildBatchStatePayload(),
        items: results
      };
    } catch (error) {
      if (error && error.code === 'jimeng-batch-stopped') {
        if (activeRun && normalizeText(activeRun.runId) === runId) {
          activeRun.status = 'stopped';
          activeRun.endedAt = nowIso();
          activeRun.currentTaskLabel = '';
          activeRun.activeTaskCount = 0;
          activeRun.pendingTaskCount = Math.max(0, Number(activeRun.taskCount) - Math.max(0, Number(activeRun.submittedTaskCount) || 0));
          activeRun.pauseRequested = false;
          activeRun.stopRequested = false;
          flushResumeWaiters(activeRun);
        }

        emitLog('warning', '\u6279\u91CF\u4EFB\u52A1\u5DF2\u505C\u6B62\u3002');
        emitState();

        if (typeof log === 'function') {
          log('jimeng_image_batch_stopped', {
            runId,
            completedTaskCount: activeRun ? activeRun.completedTaskCount : 0,
            savedCount: activeRun ? activeRun.savedCount : 0
          });
        }

        return {
          success: false,
          stopped: true,
          runId,
          message: '\u6279\u91CF\u4EFB\u52A1\u5DF2\u505C\u6B62\u3002',
          state: buildBatchStatePayload()
        };
      }

      const snapshot = error && error.snapshot ? error.snapshot : await getPageSnapshot(browserView);

      if (activeRun && normalizeText(activeRun.runId) === runId) {
        activeRun.status = 'failed';
        activeRun.endedAt = nowIso();
        activeRun.currentTaskLabel = '';
        activeRun.activeTaskCount = 0;
        activeRun.pendingTaskCount = Math.max(0, Number(activeRun.taskCount) - Math.max(0, Number(activeRun.submittedTaskCount) || 0));
        activeRun.pauseRequested = false;
        activeRun.stopRequested = false;
        flushResumeWaiters(activeRun);
      }

      emitLog(
        'error',
        `\u6279\u91CF\u4EFB\u52A1\u4E2D\u65AD\uFF1A${normalizeText(error && error.message) || '\u6267\u884C\u5931\u8D25'}`
      );
      emitState();

      if (typeof logError === 'function') {
        logError('jimeng_image_batch_failed', error, {
          runId,
          snapshot
        });
      }

      return {
        success: false,
        runId,
        message: normalizeText(error && error.message) || 'batch-failed',
        state: buildBatchStatePayload()
      };
    }
  }

  return {
    getBatchState,
    pauseBatchGeneration,
    resumeBatchGeneration,
    startBatchGeneration,
    stopBatchGeneration
  };
}

module.exports = {
  createJimengImageBatchRunner
};
