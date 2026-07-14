function getIsoTimestamp() {
  return new Date().toISOString();
}

function toCloneSafeValue(value, depth = 0) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      message: String(value.message || ''),
      name: String(value.name || 'Error')
    };
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return {
      byteLength: value.length
    };
  }

  if (depth >= 6) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => toCloneSafeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, item]) => {
      if (typeof item !== 'function' && typeof item !== 'symbol') {
        result[key] = toCloneSafeValue(item, depth + 1);
      }
      return result;
    }, {});
  }

  return String(value);
}

function normalizePsdProgressPayload(payload) {
  const safePayload = toCloneSafeValue(payload);

  if (safePayload && typeof safePayload === 'object' && !Array.isArray(safePayload)) {
    return safePayload;
  }

  return {
    message: safePayload == null ? '' : String(safePayload)
  };
}

function emitPsdProgress(emitProgress, payload) {
  if (typeof emitProgress !== 'function') {
    return;
  }

  try {
    const safePayload = normalizePsdProgressPayload(payload);
    emitProgress({
      ...safePayload,
      updatedAt: getIsoTimestamp()
    });
  } catch (_error) {}
}

module.exports = {
  emitPsdProgress,
  getIsoTimestamp,
  normalizePsdProgressPayload
};
