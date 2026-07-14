const {
  ECHO_ERROR
} = require('./photopeaSmartObjectScripts');

function encodeScriptForExecute(script) {
  return JSON.stringify(script);
}

function bufferFromMessage(message) {
  if (!message) {
    return Buffer.alloc(0);
  }

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

function getPhotopeaErrorMessage(message) {
  return String(message && message.value || '').slice(ECHO_ERROR.length).trim();
}

function isIgnorablePhotopeaConsoleError(record) {
  const message = String(record && record.message || '');
  return /Cannot read properties of null \(reading ['"][A-Za-z_$][\w$]{0,3}['"]\)/.test(message);
}

function appendPhotopeaConsoleError(consoleErrors, payload, maxEntries = 20) {
  if (!Array.isArray(consoleErrors)) {
    return null;
  }

  const nextRecord = {
    time: Date.now(),
    level: Number(payload && payload.level) || 0,
    message: String(payload && payload.message || ''),
    line: Number(payload && payload.line) || 0,
    sourceId: String(payload && payload.sourceId || '')
  };

  consoleErrors.push(nextRecord);
  if (consoleErrors.length > maxEntries) {
    consoleErrors.splice(0, consoleErrors.length - maxEntries);
  }

  return nextRecord;
}

function findPhotopeaConsoleErrorSince(consoleErrors, startedAt) {
  const threshold = Number.isFinite(startedAt) && startedAt > 0 ? startedAt : 0;
  return Array.isArray(consoleErrors)
    ? consoleErrors.find((record) => (
      record
      && record.time >= threshold
      && !isIgnorablePhotopeaConsoleError(record)
    )) || null
    : null;
}

module.exports = {
  appendPhotopeaConsoleError,
  bufferFromMessage,
  encodeScriptForExecute,
  findPhotopeaConsoleErrorSince,
  getPhotopeaErrorMessage,
  isDoneMessage,
  isEchoMessage,
  isErrorMessage,
  isIgnorablePhotopeaConsoleError
};
