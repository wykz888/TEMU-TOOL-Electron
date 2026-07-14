import { nextTick, ref } from 'vue';

const MAX_LOG_ENTRIES = 500;

function padTimeSegment(value) {
  return String(value).padStart(2, '0');
}

function formatLogTime(value = new Date()) {
  const nextValue = value instanceof Date ? value : new Date(value);
  return [
    padTimeSegment(nextValue.getHours()),
    padTimeSegment(nextValue.getMinutes()),
    padTimeSegment(nextValue.getSeconds())
  ].join(':');
}

export function getPsdSmartSuiteLogToneLabel(tone) {
  if (tone === 'success') {
    return '\u6210\u529F';
  }

  if (tone === 'error') {
    return '\u5931\u8D25';
  }

  return '\u8FD0\u884C';
}

export function usePsdSmartSuiteLogs() {
  const logs = ref([]);
  const logContainer = ref(null);
  const successLogCount = ref(0);
  const errorLogCount = ref(0);
  let pendingScroll = false;

  function scheduleScrollToBottom() {
    if (pendingScroll) {
      return;
    }

    pendingScroll = true;
    nextTick(() => {
      pendingScroll = false;
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }

  function trimLogs() {
    const overflowCount = logs.value.length - MAX_LOG_ENTRIES;

    if (overflowCount > 0) {
      logs.value.splice(0, overflowCount);
    }
  }

  function addLog(text, tone = '') {
    if (tone === 'success') {
      successLogCount.value += 1;
    } else if (tone === 'error') {
      errorLogCount.value += 1;
    }

    logs.value.push({
      text: String(text || ''),
      tone,
      time: formatLogTime()
    });
    trimLogs();
    scheduleScrollToBottom();
  }

  function clearLog() {
    logs.value = [];
    successLogCount.value = 0;
    errorLogCount.value = 0;
  }

  return {
    clearLog,
    errorLogCount,
    getPsdSmartSuiteLogToneLabel,
    logContainer,
    logs,
    successLogCount,
    addLog
  };
}
