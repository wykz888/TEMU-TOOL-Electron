function fb_success() { return { success: true }; }
function fb_empty() { return []; }
function fb_cancel() { return { canceled: false }; }

function fb_canceled(payload) {
  return {
    canceled: false,
    runId: String(payload && payload.runId || '').trim()
  };
}

function fb_progressSnapshot() {
  return { progress: null, source: 'unavailable', updatedAt: '' };
}

function fb_runtimeLog() {
  return { updatedAt: '', filePath: '', entries: [] };
}

module.exports = {
  fb_cancel,
  fb_canceled,
  fb_empty,
  fb_progressSnapshot,
  fb_runtimeLog,
  fb_success
};
