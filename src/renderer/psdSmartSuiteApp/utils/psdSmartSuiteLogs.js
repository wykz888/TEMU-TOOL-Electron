import { computed, nextTick, ref } from 'vue';

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
  const successLogCount = computed(() => (
    logs.value.filter((entry) => entry.tone === 'success').length
  ));
  const errorLogCount = computed(() => (
    logs.value.filter((entry) => entry.tone === 'error').length
  ));

  function addLog(text, tone = '') {
    logs.value.push({
      text: String(text || ''),
      tone,
      time: formatLogTime()
    });

    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }

  function clearLog() {
    logs.value = [];
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
