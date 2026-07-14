import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { buildPsdSmartSuiteRunPayload } from './psdSmartSuiteModels.js';
import { resolvePsdProgressState } from './psdSmartSuiteProgress.js';

function noop() {
  return undefined;
}

function showMessage(messageApi, method, content) {
  if (messageApi && typeof messageApi[method] === 'function') {
    messageApi[method](content);
  }
}

function getErrorMessage(error) {
  return String(error && error.message ? error.message : error);
}

function buildCompletionSummary(result) {
  return `\u5B8C\u6210: \u8F93\u5165 ${result.totalInputCount || 0} \u5F20, \u5BFC\u51FA ${result.generatedCount || 0} \u5F20, \u5931\u8D25 ${result.failedCount || 0} \u5F20`;
}

export function usePsdSmartSuiteRuntime(options = {}) {
  const bridge = options.bridge;
  const busy = options.busy;
  const config = options.config;
  const mockups = options.mockups;
  const psdImageFiles = options.psdImageFiles;
  const addLog = typeof options.addLog === 'function' ? options.addLog : noop;
  const clearLog = typeof options.clearLog === 'function' ? options.clearLog : noop;
  const ensureMockups = typeof options.ensureMockups === 'function' ? options.ensureMockups : noop;
  const messageApi = options.messageApi || null;

  const psdRunning = ref(false);
  const psdCanceling = ref(false);
  const psdProgressSummary = ref('');
  const currentProgressLabel = ref('\u5F85\u547D');
  const progressCurrent = ref(0);
  const progressTotal = ref(0);
  let unsubscribeProgress = null;

  const progressPercent = computed(() => {
    if (progressTotal.value > 0) {
      return Math.max(0, Math.min(100, Math.round((progressCurrent.value / progressTotal.value) * 100)));
    }

    if (!psdRunning.value && currentProgressLabel.value === '\u4EFB\u52A1\u5B8C\u6210') {
      return 100;
    }

    return 0;
  });
  const progressPercentLabel = computed(() => `${progressPercent.value}%`);

  function buildRunPayload() {
    ensureMockups();

    return buildPsdSmartSuiteRunPayload({
      runId: bridge.getWindowRunId(),
      config,
      mockups: mockups.value,
      sourceFiles: psdImageFiles.value
    });
  }

  async function syncEngineWindowMode() {
    try {
      await bridge.setPsdEngineWindowVisible({
        runId: bridge.getWindowRunId(),
        visible: config.psdEngineWindowMode === 'visible'
      });
    } catch (_) {
      // ignore runtime toggle failure in renderer
    }
  }

  function handlePsdProgress(progress) {
    const progressState = resolvePsdProgressState(progress);

    if (!progressState) {
      return;
    }

    currentProgressLabel.value = progressState.phaseLabel;

    if (progressState.total != null) {
      progressTotal.value = progressState.total;
    }

    if (progressState.current != null) {
      progressCurrent.value = progressState.current;
    }

    if (progressState.summary) {
      psdProgressSummary.value = progressState.summary;
    }

    addLog(progressState.message, progressState.tone);

    if (progressState.complete && progressState.summary) {
      progressCurrent.value = progressTotal.value;
      psdProgressSummary.value = progressState.summary;
    }
  }

  async function startRun() {
    if (busy.value || psdRunning.value) {
      return;
    }

    ensureMockups();

    const hasValidMockup = mockups.value.some((item) => item.psdPath);

    if (!config.psdImageDirectoryPath || !hasValidMockup) {
      const message = '\u8BF7\u5148\u9009\u62E9\u7D20\u6750\u76EE\u5F55\u548C\u81F3\u5C11\u4E00\u4E2A PSD \u6837\u673A\u6587\u4EF6\u3002';
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
      return;
    }

    if (!mockups.value.every((item) => item.outputDirectoryPath)) {
      const message = '\u8BF7\u4E3A\u6BCF\u4E2A\u6837\u673A\u8BBE\u7F6E\u5BFC\u51FA\u76EE\u5F55\u3002';
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
      return;
    }

    psdRunning.value = true;
    psdCanceling.value = false;
    psdProgressSummary.value = '';
    currentProgressLabel.value = '\u4EFB\u52A1\u542F\u52A8';
    progressCurrent.value = 0;
    progressTotal.value = 0;
    busy.value = true;
    clearLog();

    try {
      await bridge.setPsdEngineWindowVisible({
        runId: bridge.getWindowRunId(),
        visible: config.psdEngineWindowMode === 'visible'
      });

      addLog('\u4EFB\u52A1\u5DF2\u542F\u52A8\uFF0C\u7B49\u5F85\u5F15\u64CE\u5904\u7406...');

      const result = await bridge.generatePsdSmartObjectMockups(buildRunPayload());

      if (result && result.success !== false) {
        progressTotal.value = Number(result.totalInputCount || 0);
        progressCurrent.value = progressTotal.value;
        psdProgressSummary.value = buildCompletionSummary(result);
        currentProgressLabel.value = '\u4EFB\u52A1\u5B8C\u6210';
        addLog(psdProgressSummary.value, result.failedCount ? '' : 'success');
        showMessage(messageApi, 'success', 'PSD \u5957\u56FE\u5DF2\u5B8C\u6210');
      }
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      currentProgressLabel.value = '\u6267\u884C\u5931\u8D25';
      showMessage(messageApi, 'error', message);
    } finally {
      psdRunning.value = false;
      psdCanceling.value = false;
      busy.value = false;
    }
  }

  async function cancelRun() {
    if (!psdRunning.value || psdCanceling.value) {
      return;
    }

    psdCanceling.value = true;

    try {
      await bridge.cancelPsdSmartObjectMockups({
        runId: bridge.getWindowRunId()
      });
      currentProgressLabel.value = '\u6B63\u5728\u53D6\u6D88';
      addLog('\u5DF2\u53D1\u9001\u53D6\u6D88\u8BF7\u6C42...');
      showMessage(messageApi, 'info', '\u5DF2\u53D1\u9001\u53D6\u6D88\u8BF7\u6C42');
    } catch (error) {
      const message = getErrorMessage(error);
      addLog(message, 'error');
      showMessage(messageApi, 'error', message);
    } finally {
      psdCanceling.value = false;
    }
  }

  function attachProgressListener() {
    if (typeof unsubscribeProgress === 'function') {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }

    unsubscribeProgress = bridge.onPsdSmartObjectProgress(handlePsdProgress);
  }

  function detachProgressListener() {
    if (typeof unsubscribeProgress === 'function') {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }
  }

  watch(() => config.psdEngineWindowMode, () => {
    void syncEngineWindowMode();
  });

  onBeforeUnmount(detachProgressListener);

  return {
    attachProgressListener,
    cancelRun,
    currentProgressLabel,
    detachProgressListener,
    progressCurrent,
    progressPercent,
    progressPercentLabel,
    progressTotal,
    psdCanceling,
    psdProgressSummary,
    psdRunning,
    startRun,
    syncEngineWindowMode
  };
}
