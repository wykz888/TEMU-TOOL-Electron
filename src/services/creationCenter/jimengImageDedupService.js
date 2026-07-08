const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const FEATURE_ID = 'jimeng-image';
const HISTORY_FILE_NAME = 'batch-dedup-history.json';
const HASH_ALGORITHM = 'md5';
const MAX_RECORD_COUNT = 20000;

function createJimengImageDedupService({
  sessionStore,
  creationCenterProfileService
}) {
  let cachedOwnerKey = '';
  let cachedHistoryResult = null;

  function getOwner() {
    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      creationCenterProfileService
      && typeof creationCenterProfileService.getFeatureById === 'function'
        ? creationCenterProfileService.getFeatureById(FEATURE_ID)
        : null;

    if (!featureEntry) {
      throw new Error('\u5373\u68A6\u751F\u56FE\u53BB\u91CD\u6A21\u5757\u672A\u6CE8\u518C\u3002');
    }

    return featureEntry;
  }

  function getHistoryFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'state',
      HISTORY_FILE_NAME
    );
  }

  function buildDefaultHistory(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      hashAlgorithm: HASH_ALGORITHM,
      taskRecords: []
    };
  }

  function normalizeHash(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizePromptText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .trim();
  }

  function createMd5(value) {
    return crypto.createHash(HASH_ALGORITHM).update(value).digest('hex');
  }

  async function readJsonFile(filePath) {
    try {
      const rawText = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, filePath);
  }

  function normalizeTaskRecord(record) {
    const hash = normalizeHash(record && record.hash);

    if (!hash) {
      return null;
    }

    const createdAt = normalizeText(record && record.createdAt) || nowIso();
    const updatedAt = normalizeText(record && record.updatedAt) || createdAt;

    return {
      hash,
      mode: normalizeText(record && record.mode),
      promptHash: normalizeHash(record && record.promptHash),
      imageHash: normalizeHash(record && record.imageHash),
      createdAt,
      updatedAt,
      hitCount: Math.max(1, Number(record && record.hitCount) || 1)
    };
  }

  function compareRecordByUpdatedAtDesc(left, right) {
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  }

  function normalizeHistoryPayload(payload, owner) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const baseHistory = buildDefaultHistory(owner);
    const recordMap = new Map();

    (Array.isArray(source.taskRecords) ? source.taskRecords : []).forEach((item) => {
      const normalizedRecord = normalizeTaskRecord(item);

      if (!normalizedRecord) {
        return;
      }

      const existingRecord = recordMap.get(normalizedRecord.hash);

      if (!existingRecord) {
        recordMap.set(normalizedRecord.hash, normalizedRecord);
        return;
      }

      recordMap.set(
        normalizedRecord.hash,
        new Date(normalizedRecord.updatedAt || 0).getTime() > new Date(existingRecord.updatedAt || 0).getTime()
          ? normalizedRecord
          : existingRecord
      );
    });

    const taskRecords = Array.from(recordMap.values())
      .sort(compareRecordByUpdatedAtDesc)
      .slice(0, MAX_RECORD_COUNT);

    return {
      version: SERVICE_VERSION,
      owner: baseHistory.owner,
      updatedAt: normalizeText(source.updatedAt),
      hashAlgorithm: HASH_ALGORITHM,
      taskRecords
    };
  }

  function updateCachedHistory(owner, result) {
    cachedOwnerKey = owner && owner.userKey ? owner.userKey : '';
    cachedHistoryResult = result
      ? {
        ...result,
        history: normalizeHistoryPayload(result.history, owner)
      }
      : null;

    return cachedHistoryResult;
  }

  async function getHistory() {
    const owner = getOwner();

    if (!owner) {
      return updateCachedHistory(owner, {
        history: buildDefaultHistory(null),
        source: 'unavailable'
      });
    }

    if (cachedHistoryResult && cachedOwnerKey === owner.userKey) {
      return cachedHistoryResult;
    }

    const localHistory = await readJsonFile(getHistoryFilePath(owner)).catch(() => null);

    if (!localHistory) {
      return updateCachedHistory(owner, {
        history: buildDefaultHistory(owner),
        source: 'default'
      });
    }

    return updateCachedHistory(owner, {
      history: normalizeHistoryPayload(localHistory, owner),
      source: 'local_state'
    });
  }

  function buildTextTaskIdentity(promptText) {
    const normalizedPrompt = normalizePromptText(promptText);
    const promptHash = normalizedPrompt ? createMd5(normalizedPrompt) : '';

    return {
      hash: promptHash
        ? createMd5(JSON.stringify({
          mode: 'text-to-image',
          promptHash
        }))
        : '',
      mode: 'text-to-image',
      promptHash,
      imageHash: ''
    };
  }

  async function buildImageTaskIdentity({
    imagePath,
    promptText
  }) {
    const normalizedImagePath = normalizeText(imagePath);

    if (!normalizedImagePath) {
      throw new Error('\u53C2\u8003\u56FE\u7247\u8DEF\u5F84\u65E0\u6548\u3002');
    }

    let fileBuffer = null;

    try {
      fileBuffer = await fs.promises.readFile(normalizedImagePath);
    } catch (error) {
      const wrappedError = new Error('\u53C2\u8003\u56FE\u7247\u8BFB\u53D6\u5931\u8D25\u3002');

      wrappedError.code = 'jimeng-image-read-failed';
      wrappedError.filePath = normalizedImagePath;
      wrappedError.cause = error;
      throw wrappedError;
    }

    const normalizedPrompt = normalizePromptText(promptText);
    const promptHash = normalizedPrompt ? createMd5(normalizedPrompt) : '';
    const imageHash = createMd5(fileBuffer);

    return {
      hash: createMd5(JSON.stringify({
        mode: 'image-to-image',
        imageHash,
        promptHash
      })),
      mode: 'image-to-image',
      promptHash,
      imageHash
    };
  }

  async function filterNewTaskEntries(entries) {
    const historyResult = await getHistory();
    const history = historyResult && historyResult.history ? historyResult.history : buildDefaultHistory(getOwner());
    const existingHashes = new Set(
      (Array.isArray(history.taskRecords) ? history.taskRecords : [])
        .map((item) => normalizeHash(item && item.hash))
        .filter(Boolean)
    );
    const batchHashes = new Set();
    const freshEntries = [];
    const duplicateHistoryEntries = [];
    const duplicateBatchEntries = [];

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const entryHash = normalizeHash(entry && entry.hash);

      if (!entryHash) {
        return;
      }

      if (existingHashes.has(entryHash)) {
        duplicateHistoryEntries.push(entry);
        return;
      }

      if (batchHashes.has(entryHash)) {
        duplicateBatchEntries.push(entry);
        return;
      }

      batchHashes.add(entryHash);
      freshEntries.push(entry);
    });

    return {
      freshEntries,
      duplicateHistoryEntries,
      duplicateBatchEntries,
      existingRecordCount: existingHashes.size
    };
  }

  async function markTaskEntriesUsed(entries) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedHistory(owner, {
        history: buildDefaultHistory(null),
        source: 'unavailable'
      });
    }

    const currentResult = await getHistory();
    const currentHistory = currentResult && currentResult.history
      ? currentResult.history
      : buildDefaultHistory(owner);
    const recordMap = new Map(
      (Array.isArray(currentHistory.taskRecords) ? currentHistory.taskRecords : [])
        .map((item) => normalizeTaskRecord(item))
        .filter(Boolean)
        .map((item) => [item.hash, item])
    );
    const updatedAt = nowIso();
    let changed = false;

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const entryHash = normalizeHash(entry && entry.hash);

      if (!entryHash) {
        return;
      }

      const existingRecord = recordMap.get(entryHash);

      if (existingRecord) {
        recordMap.set(entryHash, {
          ...existingRecord,
          mode: normalizeText(entry && entry.mode) || existingRecord.mode,
          promptHash: normalizeHash(entry && entry.promptHash) || existingRecord.promptHash,
          imageHash: normalizeHash(entry && entry.imageHash) || existingRecord.imageHash,
          updatedAt,
          hitCount: Math.max(1, Number(existingRecord.hitCount) || 1) + 1
        });
      } else {
        recordMap.set(entryHash, {
          hash: entryHash,
          mode: normalizeText(entry && entry.mode),
          promptHash: normalizeHash(entry && entry.promptHash),
          imageHash: normalizeHash(entry && entry.imageHash),
          createdAt: updatedAt,
          updatedAt,
          hitCount: 1
        });
      }

      changed = true;
    });

    if (!changed) {
      return currentResult;
    }

    const nextHistory = normalizeHistoryPayload({
      ...currentHistory,
      updatedAt,
      taskRecords: Array.from(recordMap.values())
    }, owner);

    await writeJsonFile(getHistoryFilePath(owner), nextHistory);

    return updateCachedHistory(owner, {
      history: nextHistory,
      source: 'local_state'
    });
  }

  return {
    buildTextTaskIdentity,
    buildImageTaskIdentity,
    filterNewTaskEntries,
    getHistory,
    markTaskEntriesUsed
  };
}

module.exports = {
  createJimengImageDedupService
};
