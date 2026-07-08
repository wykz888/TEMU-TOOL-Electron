(function initJimengImageWindowModule() {
  const DEFAULT_QUEUE_TASK_LIMIT = 1;
  const MAX_QUEUE_TASK_LIMIT = 10;
  const DEFAULT_START_TASK_OFFSET = 0;
  const MAX_RUN_LOG_COUNT = 200;

  function normalizeUserError(error, fallbackMessage) {
    if (!error || !error.message || !String(error.message).trim()) {
      return fallbackMessage;
    }

    var raw = String(error.message).trim();

    if (/[\u4e00-\u9fff]/u.test(raw)) {
      return raw;
    }

    if (/session/i.test(raw) || /partition/i.test(raw) || /IPC/i.test(raw) || /electron/i.test(raw) || /preload/i.test(raw) || /contextBridge/i.test(raw)) {
      return fallbackMessage;
    }

    if (/ERR_CONNECTION/i.test(raw) || /ECONNREFUSED/i.test(raw) || /ETIMEDOUT/i.test(raw) || /ENOTFOUND/i.test(raw)) {
      return '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002';
    }

    return fallbackMessage;
  }
  const MAX_RUN_LOG_MESSAGE_LENGTH = 160;
  const state = {
    browserState: {
      homeUrl: '',
      currentUrl: '',
      title: '',
      loading: true,
      canGoBack: false,
      canGoForward: false,
      lastErrorMessage: ''
    },
    runLogs: [],
    importedImages: [],
    saveDirectoryPath: '',
    createDateSubdirectory: false,
    filterDuplicateTasks: false,
    queueTaskLimit: DEFAULT_QUEUE_TASK_LIMIT,
    startTaskOffset: DEFAULT_START_TASK_OFFSET,
    batchState: {
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
    }
  };

  let elements = null;
  let resizeObserver = null;
  let syncFrameId = 0;
  let bridgeDisposers = [];
  let scrollSettleTimer = 0;
  let settingsSaveTimer = 0;

  function getBridge() {
    if (window.temuApp && window.temuApp.jimengImage) {
      return window.temuApp.jimengImage;
    }

    throw new Error('\u5373\u68A6\u751F\u56FE\u901A\u4FE1\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\u3002');
  }

  function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`\u7F3A\u5C11\u754C\u9762\u8282\u70B9\uFF1A${id}`);
    }

    return element;
  }

  function collectElements() {
    return {
      browserHost: getElement('jimengBrowserHost'),
      browserStatusBadge: getElement('jimengBrowserStatusBadge'),
      reloadButton: getElement('jimengReloadButton'),
      goHomeButton: getElement('jimengGoHomeButton'),
      openExternalButton: getElement('jimengOpenExternalButton'),
      createDateSubdirectoryInput: getElement('jimengCreateDateSubdirectoryInput'),
      filterDuplicateTasksInput: getElement('jimengFilterDuplicateTasksInput'),
      queueTaskLimitInput: getElement('jimengQueueTaskLimitInput'),
      startTaskOffsetInput: getElement('jimengStartTaskOffsetInput'),
      selectSaveDirectoryButton: getElement('jimengSelectSaveDirectoryButton'),
      saveDirectoryValue: getElement('jimengSaveDirectoryValue'),
      batchStateBadge: getElement('jimengBatchStateBadge'),
      batchStateSummary: getElement('jimengBatchStateSummary'),
      batchGenerateButton: getElement('jimengBatchGenerateButton'),
      batchPauseButton: getElement('jimengBatchPauseButton'),
      batchResumeButton: getElement('jimengBatchResumeButton'),
      batchStopButton: getElement('jimengBatchStopButton'),
      clearLogButton: getElement('jimengClearLogButton'),
      runLogList: getElement('jimengRunLogList'),
      modeContentTag: getElement('jimengModeContentTag'),
      modeContentTitle: getElement('jimengModeContentTitle'),
      promptBatchSection: getElement('jimengPromptBatchSection'),
      imageImportSection: getElement('jimengImageImportSection'),
      promptInput: getElement('jimengPromptInput'),
      promptCountHint: getElement('jimengPromptCountHint'),
      promptCountSummary: getElement('jimengPromptCountSummary'),
      imageImportInput: getElement('jimengImageImportInput'),
      clearImportedImagesButton: getElement('jimengClearImportedImagesButton'),
      importedImageSummary: getElement('jimengImportedImageSummary'),
      importedImageList: getElement('jimengImportedImageList'),
      promptPrefixInput: getElement('jimengPromptPrefixInput'),
      promptSuffixInput: getElement('jimengPromptSuffixInput'),
      modeInputs: Array.from(document.querySelectorAll('input[name="jimengMode"]'))
    };
  }

  function getSelectedMode() {
    const checked = elements.modeInputs.find((input) => input.checked === true);

    return checked ? checked.value : 'text-to-image';
  }

  function updateButtonsBusyState(isBusy) {
    elements.reloadButton.disabled = isBusy;
    elements.goHomeButton.disabled = isBusy;
  }

  function renderBrowserState() {
    const browserState = state.browserState || {};
    const loading = browserState.loading === true;
    const lastErrorMessage = String(browserState.lastErrorMessage || '').trim();

    elements.browserStatusBadge.textContent = lastErrorMessage
      ? `\u5F02\u5E38 | ${lastErrorMessage}`
      : loading
        ? '\u52A0\u8F7D\u4E2D'
        : '\u5C31\u7EEA';

    updateButtonsBusyState(loading);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeQueueTaskLimit(value) {
    const numericValue = Math.round(Number(value) || DEFAULT_QUEUE_TASK_LIMIT);

    return Math.min(MAX_QUEUE_TASK_LIMIT, Math.max(DEFAULT_QUEUE_TASK_LIMIT, numericValue));
  }

  function normalizeStartTaskOffset(value) {
    return Math.max(DEFAULT_START_TASK_OFFSET, Math.round(Number(value) || DEFAULT_START_TASK_OFFSET));
  }

  function compactRunLogMessage(message) {
    let normalizedMessage = String(message || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedMessage) {
      return '';
    }

    const replacements = [
      [/^\u6279\u91CF\u4EFB\u52A1\u5DF2\u542F\u52A8\uFF1A/, '\u542F\u52A8\uFF1A'],
      [/^\u6279\u91CF\u4EFB\u52A1\u5B8C\u6210\uFF1A/, '\u5B8C\u6210\uFF1A'],
      [/^\u6279\u91CF\u4EFB\u52A1\u4E2D\u65AD\uFF1A/, '\u4E2D\u65AD\uFF1A'],
      [/^\u5F00\u59CB\u63D0\u4EA4 /, '\u63D0\u4EA4 '],
      [/^\u540E\u53F0\u4EFB\u52A1\u8FDB\u5EA6\uFF1A/, '\u8FDB\u5EA6\uFF1A'],
      [/^\u540E\u53F0\u5DF2\u63A5\u6536\u4EFB\u52A1\uFF1A/, '\u5DF2\u63A5\u6536\uFF1A'],
      [/^\u540E\u53F0\u5DF2\u8FD4\u56DE\u751F\u6210\u7ED3\u679C\uFF1A/, '\u7ED3\u679C\uFF1A'],
      [/^\u5DF2\u4FDD\u5B58\u56FE\u7247 /, '\u4FDD\u5B58 '],
      [/^\u5DF2\u51C6\u5907\u6587\u751F\u56FE\u6279\u91CF\u4EFB\u52A1\uFF1A/, '\u6587\u751F\u56FE\uFF1A'],
      [/^\u5DF2\u51C6\u5907\u56FE\u751F\u56FE\u6279\u91CF\u4EFB\u52A1\uFF1A/, '\u56FE\u751F\u56FE\uFF1A'],
      [/^\u5DF2\u5BFC\u5165 /, '\u5BFC\u5165 '],
      [/^\u5DF2\u8FC7\u6EE4\u5386\u53F2\u91CD\u590D\u4EFB\u52A1 /, '\u8FC7\u6EE4\u5386\u53F2\u91CD\u590D '],
      [/^\u5DF2\u8FC7\u6EE4\u672C\u6B21\u6279\u6B21\u5185\u91CD\u590D\u4EFB\u52A1 /, '\u8FC7\u6EE4\u6279\u6B21\u91CD\u590D '],
      [/\u7B49\u5F85\u540E\u53F0\u751F\u6210\u3002?$/, '\u7B49\u5F85\u751F\u6210'],
      [/\u5F53\u524D\u6B65\u9AA4\u5B8C\u6210\u540E\u4F1A\u6682\u505C\u3002?$/, '\u5F53\u524D\u6B65\u9AA4\u540E\u6682\u505C'],
      [/\u5F53\u524D\u6B65\u9AA4\u7ED3\u675F\u540E\u505C\u6B62\u3002?$/, '\u5F53\u524D\u6B65\u9AA4\u540E\u505C\u6B62'],
      [/\u6B63\u5728\u7B49\u5F85\u5DF2\u63D0\u4EA4\u7684\u63D0\u793A\u8BCD\u961F\u5217\u5148\u5B8C\u6210\uFF0C\u7136\u540E\u518D\u7EE7\u7EED\u5F53\u524D\u4E32\u884C\u4EFB\u52A1\u3002?$/, '\u7B49\u5F85\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u5B8C\u6210'],
      [/\u63D0\u793A\u8BCD\u961F\u5217\u5DF2\u6EE1 /, '\u961F\u5217\u5DF2\u6EE1 '],
      [/\uFF0C\u7B49\u5F85\u5DF2\u63D0\u4EA4\u4EFB\u52A1\u5B8C\u6210\u540E\u7EE7\u7EED\u8865\u4F4D\u3002?$/, '\uFF0C\u7B49\u5F85\u8865\u4F4D'],
      [/\u672A\u68C0\u6D4B\u5230\u6A21\u5F0F\u5207\u6362\u6309\u94AE\uFF0C\u5DF2\u6309\u5F53\u524D\u9875\u9762\u80FD\u529B\u7EE7\u7EED\u6267\u884C\uFF1A/, '\u6A21\u5F0F\u5207\u6362\u8DF3\u8FC7\uFF1A'],
      [/\u672C\u6761\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF0C\u4F46\u53BB\u91CD\u8BB0\u5F55\u5199\u5165\u5931\u8D25\u3002?$/, '\u4EFB\u52A1\u5B8C\u6210\uFF0C\u53BB\u91CD\u8BB0\u5F55\u5199\u5165\u5931\u8D25']
    ];

    replacements.forEach(([pattern, replacement]) => {
      normalizedMessage = normalizedMessage.replace(pattern, replacement);
    });

    normalizedMessage = normalizedMessage
      .replace(/\s*\|\s*/g, ' | ')
      .replace(/\u3002+$/g, '')
      .trim();

    if (normalizedMessage.length > MAX_RUN_LOG_MESSAGE_LENGTH) {
      normalizedMessage = `${normalizedMessage.slice(0, MAX_RUN_LOG_MESSAGE_LENGTH - 3)}...`;
    }

    return normalizedMessage;
  }

  function formatLogTime(date) {
    const targetDate = date instanceof Date ? date : new Date();

    return [
      String(targetDate.getHours()).padStart(2, '0'),
      String(targetDate.getMinutes()).padStart(2, '0'),
      String(targetDate.getSeconds()).padStart(2, '0')
    ].join(':');
  }

  function renderRunLogs() {
    if (!elements || !elements.runLogList) {
      return;
    }

    if (!Array.isArray(state.runLogs) || state.runLogs.length === 0) {
      elements.runLogList.innerHTML = `
        <div class="jimeng-run-log-empty">
          <p>\u6682\u65E0\u8FD0\u884C\u8BB0\u5F55</p>
          <span>\u70B9\u51FB\u300C\u6279\u91CF\u751F\u6210\u300D\u540E\uFF0C\u8FD9\u91CC\u4F1A\u8BB0\u5F55\u6BCF\u6B21\u6279\u91CF\u4EFB\u52A1\u7684\u6267\u884C\u60C5\u51B5\u3002</span>
        </div>
      `;
      return;
    }

    elements.runLogList.innerHTML = state.runLogs
      .map((item) => `
        <article class="jimeng-run-log-entry is-${escapeHtml(item.level)}">
          <div class="jimeng-run-log-meta">
            <span class="jimeng-run-log-level">${escapeHtml(item.label)}</span>
            <time class="jimeng-run-log-time">${escapeHtml(item.time)}</time>
          </div>
          <p class="jimeng-run-log-text">${escapeHtml(item.message)}${Number(item.repeatCount) > 1 ? ` x${escapeHtml(item.repeatCount)}` : ''}</p>
        </article>
      `)
      .join('');
  }

  function appendRunLog(level, message) {
    const levelMap = {
      warning: {
        key: 'warning',
        label: '\u63D0\u9192'
      },
      error: {
        key: 'error',
        label: '\u5F02\u5E38'
      },
      success: {
        key: 'success',
        label: '\u5B8C\u6210'
      },
      info: {
        key: 'info',
        label: '\u8FD0\u884C'
      }
    };
    const normalizedEntry = levelMap[level] || levelMap.info;
    const normalizedMessage = compactRunLogMessage(message);

    if (!normalizedMessage) {
      return;
    }

    if (
      Array.isArray(state.runLogs)
      && state.runLogs.length > 0
      && state.runLogs[0].level === normalizedEntry.key
      && state.runLogs[0].message === normalizedMessage
    ) {
      state.runLogs[0] = {
        ...state.runLogs[0],
        time: formatLogTime(new Date()),
        repeatCount: Math.max(1, Number(state.runLogs[0].repeatCount) || 1) + 1
      };
      renderRunLogs();
      return;
    }

    state.runLogs = [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        level: normalizedEntry.key,
        label: normalizedEntry.label,
        time: formatLogTime(new Date()),
        message: normalizedMessage,
        repeatCount: 1
      },
      ...state.runLogs
    ].slice(0, MAX_RUN_LOG_COUNT);

    renderRunLogs();
  }

  function clearRunLogs() {
    state.runLogs = [];
    renderRunLogs();
  }

  function renderSaveDirectory() {
    const directoryPath = String(state.saveDirectoryPath || '').trim();

    elements.saveDirectoryValue.textContent = directoryPath || '\u672A\u8BBE\u7F6E\u4FDD\u5B58\u76EE\u5F55';
    elements.saveDirectoryValue.title = directoryPath || '\u672A\u8BBE\u7F6E\u4FDD\u5B58\u76EE\u5F55';
    elements.saveDirectoryValue.classList.toggle('is-empty', !directoryPath);
  }

  function buildDefaultBatchState() {
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

  function normalizeBatchState(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const defaults = buildDefaultBatchState();

    return {
      ...defaults,
      ...source,
      runId: String(source.runId || defaults.runId).trim(),
      status: String(source.status || defaults.status).trim() || defaults.status,
      mode: String(source.mode || defaults.mode).trim(),
      currentTaskLabel: String(source.currentTaskLabel || defaults.currentTaskLabel).trim(),
      saveDirectoryPath: String(source.saveDirectoryPath || defaults.saveDirectoryPath).trim(),
      effectiveSaveDirectoryPath: String(source.effectiveSaveDirectoryPath || defaults.effectiveSaveDirectoryPath).trim(),
      startedAt: String(source.startedAt || defaults.startedAt).trim(),
      endedAt: String(source.endedAt || defaults.endedAt).trim(),
      taskCount: Math.max(0, Number(source.taskCount) || 0),
      currentTaskIndex: Math.max(0, Number(source.currentTaskIndex) || 0),
      completedTaskCount: Math.max(0, Number(source.completedTaskCount) || 0),
      submittedTaskCount: Math.max(0, Number(source.submittedTaskCount) || 0),
      pendingTaskCount: Math.max(0, Number(source.pendingTaskCount) || 0),
      activeTaskCount: Math.max(0, Number(source.activeTaskCount) || 0),
      savedCount: Math.max(0, Number(source.savedCount) || 0),
      createDateSubdirectory: source.createDateSubdirectory === true,
      queueTaskLimit: normalizeQueueTaskLimit(source.queueTaskLimit),
      canStart: source.canStart !== false,
      canPause: source.canPause === true,
      canResume: source.canResume === true,
      canStop: source.canStop === true
    };
  }

  function isActiveBatchStatus(status) {
    return [
      'running',
      'pause-requested',
      'paused',
      'stopping'
    ].includes(String(status || '').trim());
  }

  function getBatchStatusLabel(status) {
    const labelMap = {
      idle: '\u7A7A\u95F2',
      running: '\u8FD0\u884C\u4E2D',
      'pause-requested': '\u6682\u505C\u4E2D',
      paused: '\u5DF2\u6682\u505C',
      stopping: '\u505C\u6B62\u4E2D',
      stopped: '\u5DF2\u505C\u6B62',
      completed: '\u5DF2\u5B8C\u6210',
      failed: '\u5F02\u5E38'
    };

    return labelMap[String(status || '').trim()] || '\u7A7A\u95F2';
  }

  function getBatchStateSummary(batchState) {
    const source = normalizeBatchState(batchState);
    const progressText = source.taskCount > 0
      ? `${source.completedTaskCount}/${source.taskCount}`
      : '0/0';
    const submittedText = source.taskCount > 0
      ? `${source.submittedTaskCount}/${source.taskCount}`
      : '0/0';
    const activeText = `\u961F\u5217\u4E2D ${source.activeTaskCount}/${source.queueTaskLimit}`;
    const currentTaskText = source.currentTaskLabel
      ? ` | \u6700\u8FD1\u63D0\u4EA4 ${source.currentTaskIndex || source.submittedTaskCount || Math.min(source.completedTaskCount + 1, source.taskCount)}: ${source.currentTaskLabel}`
      : '';

    if (source.status === 'running') {
      return `\u5DF2\u63D0\u4EA4 ${submittedText}\uFF0C${activeText}\uFF0C\u5DF2\u5B8C\u6210 ${progressText}\uFF0C\u5DF2\u4FDD\u5B58 ${source.savedCount} \u5F20${currentTaskText}`;
    }

    if (source.status === 'pause-requested') {
      return `\u5DF2\u8BF7\u6C42\u6682\u505C\uFF0C${activeText}\uFF0C\u5F53\u524D\u6B65\u9AA4\u5B8C\u6210\u540E\u4F1A\u6682\u505C${currentTaskText}`;
    }

    if (source.status === 'paused') {
      return `\u4EFB\u52A1\u5DF2\u6682\u505C\uFF0C${activeText}\uFF0C\u5DF2\u5B8C\u6210 ${progressText}\uFF0C\u5DF2\u4FDD\u5B58 ${source.savedCount} \u5F20`;
    }

    if (source.status === 'stopping') {
      return `\u5DF2\u8BF7\u6C42\u505C\u6B62\uFF0C${activeText}\uFF0C\u5F53\u524D\u6B65\u9AA4\u7ED3\u675F\u540E\u505C\u6B62${currentTaskText}`;
    }

    if (source.status === 'stopped') {
      return `\u4EFB\u52A1\u5DF2\u505C\u6B62\uFF0C\u5DF2\u5B8C\u6210 ${progressText}\uFF0C\u5DF2\u4FDD\u5B58 ${source.savedCount} \u5F20`;
    }

    if (source.status === 'completed') {
      return `\u6279\u91CF\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF0C\u5171\u4FDD\u5B58 ${source.savedCount} \u5F20`;
    }

    if (source.status === 'failed') {
      return `\u4EFB\u52A1\u5F02\u5E38\u4E2D\u65AD\uFF0C\u5DF2\u5B8C\u6210 ${progressText}\uFF0C\u5DF2\u4FDD\u5B58 ${source.savedCount} \u5F20`;
    }

    return '\u6682\u65E0\u5728\u8FD0\u884C\u7684\u6279\u91CF\u4EFB\u52A1';
  }

  function applyBatchState(payload) {
    state.batchState = normalizeBatchState(payload);
    renderBatchActionState();
  }

  function renderBatchActionState() {
    const batchState = normalizeBatchState(state.batchState);
    const status = batchState.status;
    const isBusy = isActiveBatchStatus(status);

    elements.batchStateBadge.textContent = getBatchStatusLabel(status);
    elements.batchStateBadge.className = `jimeng-batch-state-badge is-${escapeHtml(status || 'idle')}`;
    elements.batchStateSummary.textContent = getBatchStateSummary(batchState);
    elements.queueTaskLimitInput.value = String(
      isBusy ? normalizeQueueTaskLimit(batchState.queueTaskLimit) : normalizeQueueTaskLimit(state.queueTaskLimit)
    );
    elements.startTaskOffsetInput.value = String(normalizeStartTaskOffset(state.startTaskOffset));

    elements.createDateSubdirectoryInput.disabled = isBusy;
    elements.filterDuplicateTasksInput.disabled = isBusy;
    elements.queueTaskLimitInput.disabled = isBusy;
    elements.startTaskOffsetInput.disabled = isBusy;
    elements.selectSaveDirectoryButton.disabled = isBusy;
    elements.batchGenerateButton.disabled = batchState.canStart !== true;
    elements.batchPauseButton.disabled = batchState.canPause !== true;
    elements.batchResumeButton.disabled = batchState.canResume !== true;
    elements.batchStopButton.disabled = batchState.canStop !== true;
    elements.batchGenerateButton.textContent = '\u6279\u91CF\u751F\u6210';
  }

  function applyPersistedSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};

    elements.promptPrefixInput.value = String(source.promptPrefix || '').trim();
    elements.promptSuffixInput.value = String(source.promptSuffix || '').trim();
    state.saveDirectoryPath = String(source.saveDirectoryPath || '').trim();
    state.createDateSubdirectory = source.createDateSubdirectory === true;
    state.filterDuplicateTasks = source.filterDuplicateTasks === true;
    state.queueTaskLimit = normalizeQueueTaskLimit(source.queueTaskLimit);
    state.startTaskOffset = normalizeStartTaskOffset(source.startTaskOffset);
    elements.createDateSubdirectoryInput.checked = state.createDateSubdirectory;
    elements.filterDuplicateTasksInput.checked = state.filterDuplicateTasks;
    elements.queueTaskLimitInput.value = String(state.queueTaskLimit);
    elements.startTaskOffsetInput.value = String(state.startTaskOffset);
    renderSaveDirectory();
    renderPromptCountSummary();
  }

  async function loadPersistedSettings() {
    const result = await getBridge().getSettings();

    if (result && result.settings) {
      applyPersistedSettings(result.settings);
    }
  }

  async function loadBatchState() {
    const result = await getBridge().getBatchState();

    if (result && result.state) {
      applyBatchState(result.state);
    }
  }

  async function savePersistedSettings() {
    const payload = {
      promptPrefix: String(elements.promptPrefixInput.value || '').trim(),
      promptSuffix: String(elements.promptSuffixInput.value || '').trim(),
      saveDirectoryPath: String(state.saveDirectoryPath || '').trim(),
      createDateSubdirectory: state.createDateSubdirectory === true,
      filterDuplicateTasks: state.filterDuplicateTasks === true,
      queueTaskLimit: normalizeQueueTaskLimit(state.queueTaskLimit),
      startTaskOffset: normalizeStartTaskOffset(state.startTaskOffset)
    };

    await getBridge().saveSettings(payload);
  }

  function schedulePersistedSettingsSave() {
    if (settingsSaveTimer) {
      window.clearTimeout(settingsSaveTimer);
    }

    settingsSaveTimer = window.setTimeout(() => {
      settingsSaveTimer = 0;
      void savePersistedSettings();
    }, 260);
  }

  function getBatchPromptLines() {
    return String(elements.promptInput.value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getBatchPromptStats() {
    const totalCount = getBatchPromptLines().length;
    const startTaskOffset = normalizeStartTaskOffset(state.startTaskOffset);
    const skippedCount = Math.min(startTaskOffset, totalCount);
    const runnableCount = Math.max(0, totalCount - skippedCount);

    return {
      totalCount,
      startTaskOffset,
      skippedCount,
      runnableCount
    };
  }

  function renderPromptCountSummary() {
    if (!elements || !elements.promptCountHint || !elements.promptCountSummary) {
      return;
    }

    const stats = getBatchPromptStats();

    elements.promptCountHint.textContent = `\u5171 ${stats.totalCount} \u6761`;

    if (stats.totalCount <= 0) {
      elements.promptCountSummary.textContent = '\u6309\u884C\u8BB0\u5F55\u63D0\u793A\u8BCD\uFF0C\u4E00\u884C\u4E00\u7EC4\u3002';
      return;
    }

    if (stats.skippedCount > 0) {
      if (stats.runnableCount <= 0) {
        elements.promptCountSummary.textContent = `\u5171 ${stats.totalCount} \u6761\uFF0C\u5DF2\u8BBE\u8D77\u59CB\u6570\u91CF ${stats.startTaskOffset}\uFF0C\u5F53\u524D\u5DF2\u65E0\u53EF\u6267\u884C\u5185\u5BB9\u3002`;
        return;
      }

      elements.promptCountSummary.textContent = `\u5171 ${stats.totalCount} \u6761\uFF0C\u8DF3\u8FC7\u524D ${stats.skippedCount} \u6761\u540E\uFF0C\u5F85\u6267\u884C ${stats.runnableCount} \u6761\u3002`;
      return;
    }

    elements.promptCountSummary.textContent = `\u5F53\u524D\u5F85\u6267\u884C ${stats.runnableCount} \u6761\u3002`;
  }

  function getPromptAffixSettings() {
    return {
      prefix: String(elements.promptPrefixInput.value || '').trim(),
      suffix: String(elements.promptSuffixInput.value || '').trim()
    };
  }

  function formatAffixSummary() {
    const settings = getPromptAffixSettings();
    const summaryItems = [];

    if (settings.prefix) {
      summaryItems.push('\u5DF2\u8BBE\u524D\u7F00');
    }

    if (settings.suffix) {
      summaryItems.push('\u5DF2\u8BBE\u540E\u7F00');
    }

    return summaryItems.join(' | ');
  }

  function buildBatchPayload() {
    return {
      mode: getSelectedMode(),
      promptPrefix: String(elements.promptPrefixInput.value || '').trim(),
      promptSuffix: String(elements.promptSuffixInput.value || '').trim(),
      promptLines: getBatchPromptLines(),
      images: state.importedImages.map((item) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        size: item.size
      })),
      saveDirectoryPath: String(state.saveDirectoryPath || '').trim(),
      createDateSubdirectory: state.createDateSubdirectory === true,
      filterDuplicateTasks: state.filterDuplicateTasks === true,
      queueTaskLimit: normalizeQueueTaskLimit(state.queueTaskLimit),
      startTaskOffset: normalizeStartTaskOffset(state.startTaskOffset),
      expectedImageCount: 4
    };
  }

  function formatFileSize(size) {
    const normalizedSize = Math.max(0, Number(size) || 0);

    if (normalizedSize >= 1024 * 1024) {
      return `${(normalizedSize / (1024 * 1024)).toFixed(2)} MB`;
    }

    if (normalizedSize >= 1024) {
      return `${(normalizedSize / 1024).toFixed(1)} KB`;
    }

    return `${normalizedSize} B`;
  }

  function renderImportedImages() {
    if (!elements || !elements.importedImageSummary || !elements.importedImageList) {
      return;
    }

    const imageCount = Array.isArray(state.importedImages) ? state.importedImages.length : 0;

    elements.importedImageSummary.textContent = imageCount > 0
      ? `\u5DF2\u5BFC\u5165 ${imageCount} \u5F20\u56FE\u7247`
      : '\u672A\u5BFC\u5165\u56FE\u7247';

    if (imageCount === 0) {
      elements.importedImageList.innerHTML = `
        <div class="jimeng-upload-empty">
          <p>\u8FD8\u6CA1\u6709\u9009\u62E9\u56FE\u7247</p>
          <span>\u9009\u62E9\u56FE\u751F\u56FE\u6240\u9700\u7684\u56FE\u7247\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u5BFC\u5165\u5217\u8868\u3002</span>
        </div>
      `;
      return;
    }

    elements.importedImageList.innerHTML = state.importedImages
      .map((item, index) => `
        <article class="jimeng-upload-item">
          <div class="jimeng-upload-item-head">
            <span class="jimeng-upload-item-index">${index + 1}</span>
            <p class="jimeng-upload-item-name">${escapeHtml(item.name || '\u672A\u547D\u540D\u56FE\u7247')}</p>
          </div>
          <div class="jimeng-upload-item-meta">
            <span>${escapeHtml(formatFileSize(item.size))}</span>
            <span>${escapeHtml(item.path || '')}</span>
          </div>
        </article>
      `)
      .join('');
  }

  function renderModeContent() {
    const imageMode = getSelectedMode() === 'image-to-image';

    elements.modeContentTag.textContent = imageMode ? '\u5BFC\u5165' : '\u6279\u91CF';
    elements.modeContentTitle.textContent = imageMode
      ? '\u5BFC\u5165\u56FE\u7247\u8BBE\u7F6E'
      : '\u63D0\u793A\u8BCD\u6574\u7406';

    elements.promptBatchSection.hidden = imageMode;
    elements.promptBatchSection.setAttribute('aria-hidden', imageMode ? 'true' : 'false');
    elements.promptBatchSection.style.display = imageMode ? 'none' : 'block';

    elements.imageImportSection.hidden = !imageMode;
    elements.imageImportSection.setAttribute('aria-hidden', imageMode ? 'false' : 'true');
    elements.imageImportSection.style.display = imageMode ? 'grid' : 'none';
    renderPromptCountSummary();
  }

  async function resolveFilePath(file) {
    if (!file || !window.temuApp || !window.temuApp.files || typeof window.temuApp.files.getPathForFile !== 'function') {
      return '';
    }

    try {
      return String(window.temuApp.files.getPathForFile(file) || '').trim();
    } catch (_error) {
      return '';
    }
  }

  async function handleImageImportChange() {
    const files = Array.from(elements.imageImportInput.files || []);

    if (files.length === 0) {
      state.importedImages = [];
      renderImportedImages();
      return;
    }

    state.importedImages = await Promise.all(
      files.map(async (file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: String(file.name || '').trim(),
        size: Number(file.size) || 0,
        path: await resolveFilePath(file)
      }))
    );

    renderImportedImages();
    appendRunLog('info', `\u5DF2\u5BFC\u5165 ${state.importedImages.length} \u5F20\u56FE\u7247\uFF0C\u53EF\u7528\u4E8E\u6279\u91CF\u56FE\u751F\u56FE\u6574\u7406\u3002`);
  }

  function clearImportedImages() {
    state.importedImages = [];
    elements.imageImportInput.value = '';
    renderImportedImages();
  }

  function getWorkspaceBounds() {
    const rect = elements.browserHost.getBoundingClientRect();

    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function canSyncWorkspace() {
    return document.hidden !== true;
  }

  async function syncWorkspace() {
    syncFrameId = 0;

    if (!canSyncWorkspace()) {
      await getBridge().updateWorkspace({
        visible: false
      });
      return;
    }

    const bounds = getWorkspaceBounds();

    if (bounds.width < 10 || bounds.height < 10) {
      await getBridge().updateWorkspace({
        visible: false
      });
      return;
    }

    await getBridge().updateWorkspace({
      visible: true,
      bounds
    });
  }

  function scheduleWorkspaceSync() {
    if (syncFrameId) {
      return;
    }

    syncFrameId = window.requestAnimationFrame(() => {
      void syncWorkspace();
    });
  }

  function scheduleScrollWorkspaceSync() {
    scheduleWorkspaceSync();

    if (scrollSettleTimer) {
      window.clearTimeout(scrollSettleTimer);
    }

    scrollSettleTimer = window.setTimeout(() => {
      scrollSettleTimer = 0;
      scheduleWorkspaceSync();
    }, 120);
  }

  function bindWorkspaceTracking() {
    resizeObserver = new ResizeObserver(() => {
      scheduleWorkspaceSync();
    });
    resizeObserver.observe(elements.browserHost);

    window.addEventListener('resize', scheduleWorkspaceSync);
    window.addEventListener('scroll', scheduleScrollWorkspaceSync, {
      capture: true,
      passive: true
    });
    document.addEventListener('scroll', scheduleScrollWorkspaceSync, {
      capture: true,
      passive: true
    });
    document.addEventListener('visibilitychange', () => {
      scheduleWorkspaceSync();
    });

    bridgeDisposers.push(
      getBridge().onWorkspaceSyncRequested(() => {
        scheduleWorkspaceSync();
      })
    );
  }

  function bindBridgeEvents() {
    bridgeDisposers.push(
      getBridge().onBrowserStateChanged((payload) => {
        state.browserState = {
          ...state.browserState,
          ...(payload && typeof payload === 'object' ? payload : {})
        };
        renderBrowserState();
      })
    );
    bridgeDisposers.push(
      getBridge().onTaskEvent((payload) => {
        if (!payload || typeof payload !== 'object') {
          return;
        }

        if (payload.kind === 'log') {
          appendRunLog(payload.level, payload.message);
          return;
        }

        if (payload.kind === 'state' && payload.state) {
          applyBatchState(payload.state);
        }
      })
    );
  }

  async function handleReloadClick() {
    await getBridge().reloadBrowser();
  }

  async function handleGoHomeClick() {
    await getBridge().navigateHome();
  }

  async function handleOpenExternalClick() {
    await getBridge().openCurrentUrlExternal();
  }

  async function handleSelectSaveDirectoryClick() {
    const result = await getBridge().selectSaveDirectory({
      defaultPath: String(state.saveDirectoryPath || '').trim()
    });

    if (!result || result.canceled === true) {
      return;
    }

    if (result.settings) {
      applyPersistedSettings(result.settings);
      return;
    }

    state.saveDirectoryPath = String(result.directoryPath || '').trim();
    renderSaveDirectory();
    await savePersistedSettings();
  }

  async function handleBatchGenerateClick() {
    const payload = buildBatchPayload();
    const affixSummary = formatAffixSummary();
    const duplicateFilterSummary = payload.filterDuplicateTasks === true
      ? ' | \u5DF2\u542F\u7528\u53BB\u91CD'
      : '';
    const queueTaskLimitSummary = ` | \u961F\u5217\u4E0A\u9650 ${payload.queueTaskLimit}`;
    const startTaskOffsetSummary = payload.startTaskOffset > 0
      ? ` | \u8DF3\u8FC7\u524D ${payload.startTaskOffset} \u6761`
      : '';

    if (!payload.saveDirectoryPath) {
      appendRunLog(
        'warning',
        '\u8BF7\u5148\u8BBE\u7F6E\u56FE\u7247\u4FDD\u5B58\u76EE\u5F55\u3002'
      );
      return;
    }

    if (payload.mode === 'text-to-image') {
      if (payload.promptLines.length === 0) {
        appendRunLog(
          'warning',
          '\u672A\u68C0\u6D4B\u5230\u6279\u91CF\u63D0\u793A\u8BCD\u3002\u8BF7\u5148\u5728\u300C\u63D0\u793A\u8BCD\u6574\u7406\u300D\u4E2D\u6309\u884C\u586B\u5199\u5185\u5BB9\u3002'
        );
        elements.promptInput.focus();
        return;
      }

      if (payload.startTaskOffset >= payload.promptLines.length) {
        appendRunLog(
          'warning',
          '\u8D77\u59CB\u6570\u91CF\u5DF2\u8D85\u8FC7\u5F53\u524D\u6279\u91CF\u63D0\u793A\u8BCD\u603B\u6570\u3002'
        );
        elements.startTaskOffsetInput.focus();
        return;
      }

      appendRunLog(
        'info',
        `\u5DF2\u51C6\u5907\u6587\u751F\u56FE\u6279\u91CF\u4EFB\u52A1\uFF1A${payload.promptLines.length} \u7EC4\u63D0\u793A\u8BCD${queueTaskLimitSummary}${startTaskOffsetSummary}${affixSummary ? ` | ${affixSummary}` : ''}${duplicateFilterSummary}`
      );
    } else {
      if (state.importedImages.length === 0) {
        appendRunLog(
          'warning',
          '\u672A\u68C0\u6D4B\u5230\u5DF2\u5BFC\u5165\u7684\u56FE\u7247\u3002\u8BF7\u5148\u5728\u300C\u5BFC\u5165\u56FE\u7247\u8BBE\u7F6E\u300D\u4E2D\u9009\u62E9\u56FE\u7247\u3002'
        );
        elements.imageImportInput.click();
        return;
      }

      if (payload.startTaskOffset >= state.importedImages.length) {
        appendRunLog(
          'warning',
          '\u8D77\u59CB\u6570\u91CF\u5DF2\u8D85\u8FC7\u5F53\u524D\u5BFC\u5165\u56FE\u7247\u603B\u6570\u3002'
        );
        elements.startTaskOffsetInput.focus();
        return;
      }

      appendRunLog(
        'info',
        `\u5DF2\u51C6\u5907\u56FE\u751F\u56FE\u6279\u91CF\u4EFB\u52A1\uFF1A${state.importedImages.length} \u5F20\u56FE\u7247${queueTaskLimitSummary}${startTaskOffsetSummary}${affixSummary ? ` | ${affixSummary}` : ''}${duplicateFilterSummary}`
      );
    }

    await savePersistedSettings();
    applyBatchState({
      ...state.batchState,
      status: 'running',
      queueTaskLimit: payload.queueTaskLimit,
      canStart: false,
      canPause: false,
      canResume: false,
      canStop: true
    });

    try {
      const result = await getBridge().startBatchGeneration(payload);

      if (result && result.state) {
        applyBatchState(result.state);
      }

      if (!result || result.success !== true) {
        if (result && result.stopped === true) {
          return;
        }

        if (result && result.skipped === true) {
          appendRunLog(
            'warning',
            result && result.message
              ? result.message
              : '\u53BB\u91CD\u540E\u6682\u65E0\u53EF\u6267\u884C\u7684\u6279\u91CF\u4EFB\u52A1\u3002'
          );
          return;
        }

        if (result && result.state && ['failed', 'stopped'].includes(String(result.state.status || '').trim())) {
          return;
        }

        appendRunLog(
          'error',
          result && result.message
            ? result.message
            : '\u6279\u91CF\u751F\u6210\u672A\u6210\u529F\u542F\u52A8\u3002'
        );
      }
    } catch (error) {
      appendRunLog(
        'error',
        normalizeUserError(error, '\u6279\u91CF\u751F\u6210\u6267\u884C\u5931\u8D25\u3002')
      );
    }
  }

  async function handleBatchPauseClick() {
    const result = await getBridge().pauseBatchGeneration();

    if (result && result.state) {
      applyBatchState(result.state);
    }

    if (result && result.success === false && result.message) {
      appendRunLog('warning', String(result.message));
    }
  }

  async function handleBatchResumeClick() {
    const result = await getBridge().resumeBatchGeneration();

    if (result && result.state) {
      applyBatchState(result.state);
    }

    if (result && result.success === false && result.message) {
      appendRunLog('warning', String(result.message));
    }
  }

  async function handleBatchStopClick() {
    const result = await getBridge().stopBatchGeneration();

    if (result && result.state) {
      applyBatchState(result.state);
    }

    if (result && result.success === false && result.message) {
      appendRunLog('warning', String(result.message));
    }
  }

  function bindUiEvents() {
    elements.reloadButton.addEventListener('click', () => {
      void handleReloadClick();
    });
    elements.goHomeButton.addEventListener('click', () => {
      void handleGoHomeClick();
    });
    elements.openExternalButton.addEventListener('click', () => {
      void handleOpenExternalClick();
    });
    elements.selectSaveDirectoryButton.addEventListener('click', () => {
      void handleSelectSaveDirectoryClick();
    });
    elements.createDateSubdirectoryInput.addEventListener('change', () => {
      state.createDateSubdirectory = elements.createDateSubdirectoryInput.checked === true;
      void savePersistedSettings();
    });
    elements.filterDuplicateTasksInput.addEventListener('change', () => {
      state.filterDuplicateTasks = elements.filterDuplicateTasksInput.checked === true;
      void savePersistedSettings();
    });
    elements.queueTaskLimitInput.addEventListener('input', () => {
      state.queueTaskLimit = normalizeQueueTaskLimit(elements.queueTaskLimitInput.value);
      elements.queueTaskLimitInput.value = String(state.queueTaskLimit);
      schedulePersistedSettingsSave();
    });
    elements.queueTaskLimitInput.addEventListener('change', () => {
      state.queueTaskLimit = normalizeQueueTaskLimit(elements.queueTaskLimitInput.value);
      elements.queueTaskLimitInput.value = String(state.queueTaskLimit);
      void savePersistedSettings();
    });
    elements.startTaskOffsetInput.addEventListener('input', () => {
      state.startTaskOffset = normalizeStartTaskOffset(elements.startTaskOffsetInput.value);
      elements.startTaskOffsetInput.value = String(state.startTaskOffset);
      renderPromptCountSummary();
      schedulePersistedSettingsSave();
    });
    elements.startTaskOffsetInput.addEventListener('change', () => {
      state.startTaskOffset = normalizeStartTaskOffset(elements.startTaskOffsetInput.value);
      elements.startTaskOffsetInput.value = String(state.startTaskOffset);
      renderPromptCountSummary();
      void savePersistedSettings();
    });
    elements.promptInput.addEventListener('input', () => {
      renderPromptCountSummary();
    });
    elements.promptInput.addEventListener('change', () => {
      renderPromptCountSummary();
    });
    elements.batchGenerateButton.addEventListener('click', () => {
      void handleBatchGenerateClick();
    });
    elements.batchPauseButton.addEventListener('click', () => {
      void handleBatchPauseClick();
    });
    elements.batchResumeButton.addEventListener('click', () => {
      void handleBatchResumeClick();
    });
    elements.batchStopButton.addEventListener('click', () => {
      void handleBatchStopClick();
    });
    elements.clearLogButton.addEventListener('click', () => {
      clearRunLogs();
    });
    elements.clearImportedImagesButton.addEventListener('click', () => {
      clearImportedImages();
    });
    elements.imageImportInput.addEventListener('change', () => {
      void handleImageImportChange();
    });
    elements.modeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        renderModeContent();
      });
    });
    [
      elements.promptPrefixInput,
      elements.promptSuffixInput
    ].forEach((element) => {
      element.addEventListener('input', () => {
        schedulePersistedSettingsSave();
      });
      element.addEventListener('change', () => {
        void savePersistedSettings();
      });
    });
  }

  async function init() {
    elements = collectElements();
    bindUiEvents();
    bindBridgeEvents();
    bindWorkspaceTracking();
    renderBrowserState();
    renderModeContent();
    renderImportedImages();
    renderRunLogs();
    renderSaveDirectory();
    renderPromptCountSummary();
    renderBatchActionState();
    await loadPersistedSettings();
    await loadBatchState();
    appendRunLog('info', '\u6279\u91CF\u5DE5\u4F5C\u53F0\u5C31\u7EEA\u3002');
    scheduleWorkspaceSync();
  }

  window.addEventListener('DOMContentLoaded', () => {
    void init();
  });

  window.addEventListener('beforeunload', () => {
    if (settingsSaveTimer) {
      window.clearTimeout(settingsSaveTimer);
      settingsSaveTimer = 0;
      void savePersistedSettings();
    }

    if (scrollSettleTimer) {
      window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = 0;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    bridgeDisposers.forEach((dispose) => {
      if (typeof dispose === 'function') {
        dispose();
      }
    });
    bridgeDisposers = [];
  });
})();
