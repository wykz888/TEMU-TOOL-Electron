async function emitPhotopeaDebug(runtimeLogger, message, details = {}) {
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

module.exports = {
  emitPhotopeaDebug
};
