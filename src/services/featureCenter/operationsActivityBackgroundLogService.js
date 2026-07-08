const fs = require('node:fs');
const path = require('node:path');
const {
  buildDayKey,
  ensureDatedLogDirectory,
  cleanupExpiredDatedLogDirectories
} = require('../../utils/datedLogDirectory');

const LOG_DIRECTORY_NAME = 'activity_background_submit_logs';
const LOG_RETENTION_DAY_COUNT = 30;
const CSV_HEADER_COLUMNS = Object.freeze([
  '\u65f6\u95f4',
  '\u9636\u6bb5',
  '\u5e97\u94fa',
  '\u5e97\u94faID',
  '\u7ad9\u70b9',
  '\u7ad9\u70b9ID',
  '\u6d3b\u52a8',
  '\u6d3b\u52a8Key',
  '\u5546\u54c1',
  '\u5546\u54c1ID',
  '\u72b6\u6001',
  '\u7ea7\u522b',
  '\u8bf4\u660e'
]);

function createOperationsActivityBackgroundLogService({ app, runtimeLogger }) {
  const sessionMap = new Map();
  let preparedDirectoryDayKey = '';
  let prepareDirectoryPromise = null;

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizePositiveInteger(value, fallback = 0) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return Math.max(0, Number(fallback) || 0);
    }

    return Math.max(0, Math.round(numericValue));
  }

  function formatFileTimestamp(value) {
    const date = value instanceof Date ? value : new Date(value);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return 'unknown-time';
    }

    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hour}${minute}${second}`;
  }

  function csvEscape(value) {
    const text = String(value == null ? '' : value).replace(/\r\n/g, '\n');

    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  function buildCsvLine(columns) {
    return (Array.isArray(columns) ? columns : []).map(csvEscape).join(',');
  }

  function resolveRuntimeDirectoryPath() {
    const portableDirectoryPath = normalizeText(process.env.PORTABLE_EXECUTABLE_DIR);

    if (portableDirectoryPath) {
      return portableDirectoryPath;
    }

    if (app && app.isPackaged === true) {
      return path.dirname(process.execPath);
    }

    return process.cwd();
  }

  function resolveLogRootDirectoryPath() {
    return path.join(resolveRuntimeDirectoryPath(), LOG_DIRECTORY_NAME);
  }

  function resolveLogDirectoryPath(dayKey = buildDayKey()) {
    const normalizedDayKey = normalizeText(dayKey) || buildDayKey();
    return path.join(resolveLogRootDirectoryPath(), normalizedDayKey);
  }

  async function ensureLogDirectory(dayKey = buildDayKey()) {
    const normalizedDayKey = normalizeText(dayKey) || buildDayKey();

    while (preparedDirectoryDayKey !== normalizedDayKey) {
      if (!prepareDirectoryPromise) {
        prepareDirectoryPromise = (async () => {
          const rootDirectoryPath = resolveLogRootDirectoryPath();

          await cleanupExpiredDatedLogDirectories(
            rootDirectoryPath,
            LOG_RETENTION_DAY_COUNT
          );

          const preparedDirectory = await ensureDatedLogDirectory(
            rootDirectoryPath,
            normalizedDayKey
          );

          preparedDirectoryDayKey = normalizeText(preparedDirectory.dayKey);
          return preparedDirectory.directoryPath;
        })().finally(() => {
          prepareDirectoryPromise = null;
        });
      }

      await prepareDirectoryPromise;
    }

    return resolveLogDirectoryPath(normalizedDayKey);
  }

  async function resolveUniqueLogFilePath(directoryPath, fileName) {
    const normalizedDirectoryPath = normalizeText(directoryPath);
    const normalizedFileName = normalizeText(fileName) || 'activity-background-submit.csv';
    const extension = path.extname(normalizedFileName);
    const baseName = extension
      ? normalizedFileName.slice(0, -extension.length)
      : normalizedFileName;
    let attemptIndex = 0;

    while (true) {
      const candidateFileName = attemptIndex <= 0
        ? normalizedFileName
        : `${baseName}-${attemptIndex + 1}${extension}`;
      const candidatePath = path.join(normalizedDirectoryPath, candidateFileName);

      try {
        await fs.promises.access(candidatePath, fs.constants.F_OK);
        attemptIndex += 1;
      } catch (_error) {
        return {
          fileName: candidateFileName,
          filePath: candidatePath
        };
      }
    }
  }

  function buildSessionFileName(startedAt, runId) {
    const timestamp = formatFileTimestamp(startedAt);
    const normalizedRunId = normalizePositiveInteger(runId, 0);

    if (normalizedRunId > 0) {
      return `activity-background-submit-${timestamp}-run${normalizedRunId}.csv`;
    }

    return `activity-background-submit-${timestamp}.csv`;
  }

  function normalizeLogRow(record) {
    const source = record && typeof record === 'object' ? record : {};

    return {
      createdAt: normalizeText(source.createdAt) || nowIso(),
      phase: normalizeText(source.phase),
      shopName: normalizeText(source.shopName),
      shopId: normalizeText(source.shopId),
      siteName: normalizeText(source.siteName),
      siteId: normalizeText(source.siteId),
      activityName: normalizeText(source.activityName),
      activityKey: normalizeText(source.activityKey),
      productName: normalizeText(source.productName),
      productId: normalizeText(source.productId),
      statusText: normalizeText(source.statusText),
      level: normalizeText(source.level) || 'info',
      message: normalizeText(source.message)
    };
  }

  function buildCsvRow(record) {
    const row = normalizeLogRow(record);

    return buildCsvLine([
      row.createdAt,
      row.phase,
      row.shopName,
      row.shopId,
      row.siteName,
      row.siteId,
      row.activityName,
      row.activityKey,
      row.productName,
      row.productId,
      row.statusText,
      row.level,
      row.message
    ]);
  }

  function getSessionRecord(sessionId) {
    const normalizedSessionId = normalizeText(sessionId);

    if (!normalizedSessionId) {
      return null;
    }

    return sessionMap.get(normalizedSessionId) || null;
  }

  async function queueSessionWrite(sessionId, writeTask) {
    const sessionRecord = getSessionRecord(sessionId);

    if (!sessionRecord) {
      throw new Error('\u65e5\u5fd7\u4f1a\u8bdd\u4e0d\u5b58\u5728');
    }

    const previousPromise = Promise.resolve(sessionRecord.writePromise).catch(() => {});

    sessionRecord.writePromise = previousPromise.then(async () => {
      if (sessionRecord.closed === true) {
        throw new Error('\u65e5\u5fd7\u4f1a\u8bdd\u5df2\u7ed3\u675f');
      }

      await writeTask(sessionRecord);
    });

    return sessionRecord.writePromise;
  }

  async function startSession(payload = {}) {
    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
    const sessionId = normalizeText(normalizedPayload.sessionId)
      || `activity_background_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = normalizeText(normalizedPayload.startedAt) || nowIso();
    const runId = normalizePositiveInteger(normalizedPayload.runId, 0);
    const startedDayKey = buildDayKey(startedAt) || buildDayKey();
    const directoryPath = await ensureLogDirectory(startedDayKey);
    const resolvedPath = await resolveUniqueLogFilePath(
      directoryPath,
      buildSessionFileName(startedAt, runId)
    );

    await fs.promises.writeFile(
      resolvedPath.filePath,
      `\uFEFF${buildCsvLine(CSV_HEADER_COLUMNS)}\r\n`,
      'utf8'
    );

    sessionMap.set(sessionId, {
      sessionId,
      startedAt,
      updatedAt: startedAt,
      finishedAt: '',
      runId,
      directoryPath,
      fileName: resolvedPath.fileName,
      filePath: resolvedPath.filePath,
      rowCount: 0,
      writePromise: Promise.resolve(),
      closed: false
    });

    log('operations_activity_background_log_session_started', {
      sessionId,
      runId,
      filePath: resolvedPath.filePath
    });

    return {
      success: true,
      sessionId,
      runId,
      startedAt,
      directoryPath,
      fileName: resolvedPath.fileName,
      filePath: resolvedPath.filePath,
      rowCount: 0
    };
  }

  async function appendRows(payload = {}) {
    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
    const sessionId = normalizeText(normalizedPayload.sessionId);
    const rows = (Array.isArray(normalizedPayload.rows) ? normalizedPayload.rows : [])
      .map(normalizeLogRow)
      .filter((row) => Boolean(
        row.createdAt
        || row.phase
        || row.shopName
        || row.siteName
        || row.activityName
        || row.productName
        || row.statusText
        || row.message
      ));

    if (!sessionId) {
      return {
        success: false,
        sessionId: '',
        appendedCount: 0,
        rowCount: 0,
        warning: '\u65e5\u5fd7\u4f1a\u8bddID\u7f3a\u5931'
      };
    }

    if (rows.length <= 0) {
      const currentSession = getSessionRecord(sessionId);
      return {
        success: true,
        sessionId,
        appendedCount: 0,
        rowCount: currentSession ? currentSession.rowCount : 0,
        updatedAt: currentSession ? currentSession.updatedAt : nowIso(),
        filePath: currentSession ? currentSession.filePath : '',
        warning: ''
      };
    }

    const sessionRecord = getSessionRecord(sessionId);

    if (!sessionRecord) {
      return {
        success: false,
        sessionId,
        appendedCount: 0,
        rowCount: 0,
        warning: '\u65e5\u5fd7\u4f1a\u8bdd\u4e0d\u5b58\u5728'
      };
    }

    await queueSessionWrite(sessionId, async (currentSession) => {
      await fs.promises.appendFile(
        currentSession.filePath,
        `${rows.map(buildCsvRow).join('\r\n')}\r\n`,
        'utf8'
      );
      currentSession.rowCount += rows.length;
      currentSession.updatedAt = nowIso();
    });

    return {
      success: true,
      sessionId,
      appendedCount: rows.length,
      rowCount: sessionRecord.rowCount,
      updatedAt: sessionRecord.updatedAt,
      filePath: sessionRecord.filePath,
      warning: ''
    };
  }

  async function finishSession(payload = {}) {
    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
    const sessionId = normalizeText(normalizedPayload.sessionId);
    const sessionRecord = getSessionRecord(sessionId);

    if (!sessionRecord) {
      return {
        success: false,
        sessionId,
        rowCount: 0,
        finishedAt: normalizeText(normalizedPayload.finishedAt) || nowIso(),
        warning: '\u65e5\u5fd7\u4f1a\u8bdd\u4e0d\u5b58\u5728'
      };
    }

    await Promise.resolve(sessionRecord.writePromise).catch((error) => {
      logError('operations_activity_background_log_session_flush_failed', error, {
        sessionId,
        filePath: sessionRecord.filePath
      });
      throw error;
    });

    sessionRecord.finishedAt = normalizeText(normalizedPayload.finishedAt) || nowIso();
    sessionRecord.updatedAt = sessionRecord.finishedAt;
    sessionRecord.closed = true;
    sessionMap.delete(sessionId);

    log('operations_activity_background_log_session_finished', {
      sessionId,
      rowCount: sessionRecord.rowCount,
      filePath: sessionRecord.filePath
    });

    return {
      success: true,
      sessionId,
      rowCount: sessionRecord.rowCount,
      startedAt: sessionRecord.startedAt,
      finishedAt: sessionRecord.finishedAt,
      directoryPath: sessionRecord.directoryPath,
      fileName: sessionRecord.fileName,
      filePath: sessionRecord.filePath,
      warning: ''
    };
  }

  return {
    async startSession(payload = {}) {
      try {
        return await startSession(payload);
      } catch (error) {
        logError('operations_activity_background_log_session_start_failed', error, {
          runId: normalizePositiveInteger(payload && payload.runId, 0)
        });
        throw error;
      }
    },
    async appendRows(payload = {}) {
      try {
        return await appendRows(payload);
      } catch (error) {
        logError('operations_activity_background_log_session_append_failed', error, {
          sessionId: normalizeText(payload && payload.sessionId),
          rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0
        });
        throw error;
      }
    },
    async finishSession(payload = {}) {
      try {
        return await finishSession(payload);
      } catch (error) {
        logError('operations_activity_background_log_session_finish_failed', error, {
          sessionId: normalizeText(payload && payload.sessionId)
        });
        throw error;
      }
    }
  };
}

module.exports = {
  createOperationsActivityBackgroundLogService
};
