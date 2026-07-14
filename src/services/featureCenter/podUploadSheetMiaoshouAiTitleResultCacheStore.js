const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const CACHE_DIRECTORY_NAME = 'ai-title-results';
const MAX_CACHE_ENTRIES = 300;

function cloneJsonValue(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return fallback;
  }
}

function normalizeEntryId(value, fallbackEntryId) {
  return normalizeText(value) || normalizeText(fallbackEntryId) || 'default';
}

function normalizeCacheFileName(entryId) {
  return `${normalizeEntryId(entryId).replace(/[^A-Za-z0-9._-]+/g, '_')}.json`;
}

function getOwnerKey(owner) {
  return normalizeText(owner && owner.userKey);
}

function getMemoryKey(owner, entryId, fallbackEntryId) {
  return [
    getOwnerKey(owner),
    normalizeEntryId(entryId, fallbackEntryId)
  ].join('|');
}

function getCacheEntries(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const map = new Map();
  const entries = Array.isArray(source.entries)
    ? source.entries
    : Object.entries(source.items && typeof source.items === 'object' ? source.items : {})
      .map(([key, value]) => ({ key, value }));

  entries.forEach((entry) => {
    const key = normalizeText(entry && entry.key);
    const value = entry && entry.value && typeof entry.value === 'object' && !Array.isArray(entry.value)
      ? entry.value
      : null;

    if (key && value) {
      map.set(key, cloneJsonValue(value, value));
    }
  });

  return map;
}

function buildEmptySnapshot(owner, entryId, fallbackEntryId) {
  const resolvedEntryId = normalizeEntryId(entryId, fallbackEntryId);

  return {
    version: SERVICE_VERSION,
    owner: owner ? {
      userId: owner.userId,
      username: owner.username,
      userKey: owner.userKey
    } : null,
    entryId: resolvedEntryId,
    updatedAt: '',
    entries: new Map()
  };
}

function serializeSnapshot(snapshot) {
  return {
    version: SERVICE_VERSION,
    owner: snapshot.owner || null,
    entryId: normalizeEntryId(snapshot.entryId),
    updatedAt: nowIso(),
    entries: Array.from(snapshot.entries.entries()).map(([key, value]) => ({
      key,
      value
    }))
  };
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

function createPodUploadSheetMiaoshouAiTitleResultCacheStore({
  featureCenterProfileService,
  fallbackEntryId,
  runtimeLogger
} = {}) {
  const memorySnapshots = new Map();

  function logError(eventName, error, payload = {}) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function getFeatureEntry(entryId) {
    const resolvedEntryId = normalizeEntryId(entryId, fallbackEntryId);
    const fallbackId = normalizeEntryId(fallbackEntryId, resolvedEntryId);

    if (!featureCenterProfileService || typeof featureCenterProfileService.getEntryById !== 'function') {
      return null;
    }

    return featureCenterProfileService.getEntryById(resolvedEntryId)
      || featureCenterProfileService.getEntryById(fallbackId)
      || null;
  }

  function getCacheFilePath(owner, entryId) {
    const ownerKey = getOwnerKey(owner);
    const featureEntry = getFeatureEntry(entryId);

    if (!ownerKey || !featureEntry || !featureEntry.storageProfile) {
      return '';
    }

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      ownerKey,
      'cache',
      CACHE_DIRECTORY_NAME,
      normalizeCacheFileName(entryId)
    );
  }

  async function loadSnapshot(owner, entryId) {
    const memoryKey = getMemoryKey(owner, entryId, fallbackEntryId);
    const cachedSnapshot = memorySnapshots.get(memoryKey);

    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const filePath = getCacheFilePath(owner, entryId);
    const emptySnapshot = buildEmptySnapshot(owner, entryId, fallbackEntryId);

    if (!filePath) {
      memorySnapshots.set(memoryKey, emptySnapshot);
      return emptySnapshot;
    }

    try {
      const payload = await readJsonFile(filePath);
      const snapshot = {
        ...emptySnapshot,
        updatedAt: normalizeText(payload && payload.updatedAt),
        entries: getCacheEntries(payload)
      };

      memorySnapshots.set(memoryKey, snapshot);
      return snapshot;
    } catch (error) {
      logError('pod_upload_sheet_ai_title_result_cache_read_failed', error, {
        entryId: normalizeEntryId(entryId, fallbackEntryId),
        filePath
      });
      memorySnapshots.set(memoryKey, emptySnapshot);
      return emptySnapshot;
    }
  }

  async function saveSnapshot(owner, entryId, snapshot) {
    const filePath = getCacheFilePath(owner, entryId);

    if (!filePath) {
      return false;
    }

    try {
      await writeJsonFile(filePath, serializeSnapshot(snapshot));
      return true;
    } catch (error) {
      logError('pod_upload_sheet_ai_title_result_cache_write_failed', error, {
        entryId: normalizeEntryId(entryId, fallbackEntryId),
        filePath
      });
      return false;
    }
  }

  function pruneSnapshot(snapshot) {
    while (snapshot.entries.size > MAX_CACHE_ENTRIES) {
      const oldestKey = snapshot.entries.keys().next().value;

      if (!oldestKey) {
        return;
      }

      snapshot.entries.delete(oldestKey);
    }
  }

  async function getCachedResult(owner, entryId, cacheKey) {
    const key = normalizeText(cacheKey);

    if (!getOwnerKey(owner) || !key) {
      return null;
    }

    const snapshot = await loadSnapshot(owner, entryId);
    const value = snapshot.entries.get(key);

    if (!value) {
      return null;
    }

    return cloneJsonValue(value, value);
  }

  async function setCachedResult(owner, entryId, cacheKey, value) {
    const key = normalizeText(cacheKey);
    const nextValue = value && typeof value === 'object' && !Array.isArray(value)
      ? cloneJsonValue(value, null)
      : null;

    if (!getOwnerKey(owner) || !key || !nextValue) {
      return false;
    }

    const snapshot = await loadSnapshot(owner, entryId);

    snapshot.entries.delete(key);
    snapshot.entries.set(key, {
      ...nextValue,
      cachedAt: nowIso()
    });
    snapshot.updatedAt = nowIso();
    pruneSnapshot(snapshot);

    return saveSnapshot(owner, entryId, snapshot);
  }

  return {
    getCachedResult,
    setCachedResult
  };
}

module.exports = {
  createPodUploadSheetMiaoshouAiTitleResultCacheStore
};
