const { cosService, COS_SCOPES } = require('../cos');
const {
  CACHE_FILE_NAME,
  DEFAULT_ENTRY_ID,
  createPodUploadSheetMiaoshouCategoryCacheStore
} = require('./podUploadSheetMiaoshouCategoryCacheStore');
const {
  normalizeText,
  normalizeCategories,
  parseCategoryListText
} = require('./podUploadSheetMiaoshouCategoryParser');

const SERVICE_VERSION = 1;
const CATEGORY_LIST_KEY = 'TEMU_POD_CAT_LIST_PUT.json';
const CATEGORY_LIST_URL = 'https://item-1251234463.cos.ap-guangzhou.myqcloud.com/TEMU_Data_Electron/TEMU_POD_CAT_LIST_PUT.json';

function createPodUploadSheetMiaoshouCategoryService({
  runtimeLogger,
  featureCenterProfileService,
  entryId = DEFAULT_ENTRY_ID,
  categoryListKey = CATEGORY_LIST_KEY
} = {}) {
  let cachedSnapshot = null;
  let loadPromise = null;
  let syncPromise = null;
  const cacheStore = createPodUploadSheetMiaoshouCategoryCacheStore({
    featureCenterProfileService,
    entryId,
    cacheFileName: CACHE_FILE_NAME
  });

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function getCacheFilePathSafe() {
    try {
      return cacheStore.getCacheFilePath();
    } catch (error) {
      logError('pod_upload_sheet_category_cache_path_failed', error, {
        sourceKey: categoryListKey
      });
      return '';
    }
  }

  function buildSnapshot(overrides = {}) {
    const categories = normalizeCategories(overrides.categories);

    return {
      version: SERVICE_VERSION,
      updatedAt: normalizeText(overrides.updatedAt),
      syncedAt: normalizeText(overrides.syncedAt),
      source: normalizeText(overrides.source) || 'local',
      sourceKey: normalizeText(overrides.sourceKey) || categoryListKey,
      sourceScopedKey: normalizeText(overrides.sourceScopedKey)
        || cosService.resolveKey(categoryListKey, COS_SCOPES.ROOT),
      sourceUrl: CATEGORY_LIST_URL,
      cacheFilePath: normalizeText(overrides.cacheFilePath),
      categoryCount: categories.length,
      categories,
      errorMessage: normalizeText(overrides.errorMessage)
    };
  }

  function normalizeCachedPayload(payload) {
    const snapshot = buildSnapshot({
      ...payload,
      source: normalizeText(payload && payload.source) || 'local'
    });

    return snapshot.categories.length > 0 ? snapshot : null;
  }

  async function readLocalSnapshot() {
    const payload = await cacheStore.read();
    const snapshot = normalizeCachedPayload(payload);

    if (!snapshot) {
      return null;
    }

    return {
      ...snapshot,
      source: 'local',
      cacheFilePath: payload.cacheFilePath
    };
  }

  async function writeLocalSnapshot(snapshot) {
    const payload = buildSnapshot({
      ...snapshot,
      source: 'local'
    });
    const localPayload = await cacheStore.write(payload);

    return {
      ...localPayload,
      categories: normalizeCategories(localPayload.categories)
    };
  }

  async function fetchCategoryListText() {
    const response = await cosService.getObjectText({
      scope: COS_SCOPES.ROOT,
      key: categoryListKey
    });

    return {
      text: response.text,
      sourceKey: response.key || categoryListKey,
      sourceScopedKey: response.scopedKey || cosService.resolveKey(categoryListKey, COS_SCOPES.ROOT)
    };
  }

  async function syncSnapshotFromCloud() {
    const categoryListFile = await fetchCategoryListText();
    const categories = parseCategoryListText(categoryListFile.text);

    if (!categories.length) {
      throw new Error('POD \u7c7b\u76ee\u5217\u8868\u4e3a\u7a7a\u3002');
    }

    const currentTimestamp = new Date().toISOString();
    const cloudSnapshot = buildSnapshot({
      updatedAt: currentTimestamp,
      syncedAt: currentTimestamp,
      source: 'cloud',
      sourceKey: categoryListFile.sourceKey,
      sourceScopedKey: categoryListFile.sourceScopedKey,
      categories
    });
    const localSnapshot = await writeLocalSnapshot(cloudSnapshot).catch((error) => {
      logError('pod_upload_sheet_category_cache_write_failed', error, {
        sourceKey: categoryListKey,
        categoryCount: categories.length
      });

      return null;
    });

    cachedSnapshot = localSnapshot
      ? {
        ...localSnapshot,
        source: 'cloud'
      }
      : cloudSnapshot;

    return cachedSnapshot;
  }

  async function syncNow() {
    if (syncPromise) {
      return syncPromise;
    }

    const currentPromise = syncSnapshotFromCloud()
      .catch((error) => {
        logError('pod_upload_sheet_category_list_sync_failed', error, {
          sourceKey: categoryListKey
        });
        throw error;
      })
      .finally(() => {
        if (syncPromise === currentPromise) {
          syncPromise = null;
        }
      });

    syncPromise = currentPromise;

    return syncPromise;
  }

  async function loadSnapshot() {
    const localSnapshot = await readLocalSnapshot().catch((error) => {
      logError('pod_upload_sheet_category_cache_read_failed', error, {
        sourceKey: categoryListKey
      });
      return null;
    });

    if (localSnapshot) {
      cachedSnapshot = localSnapshot;
      return cachedSnapshot;
    }

    cachedSnapshot = buildSnapshot({
      source: 'local',
      cacheFilePath: getCacheFilePathSafe(),
      errorMessage: '\u7c7b\u76ee\u672c\u5730\u7f13\u5b58\u672a\u540c\u6b65\uff0c\u8bf7\u70b9\u51fb\u540c\u6b65\u7c7b\u76ee\u3002'
    });

    return cachedSnapshot;
  }

  async function getSnapshot() {
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    if (!loadPromise) {
      loadPromise = loadSnapshot()
        .catch((error) => {
          logError('pod_upload_sheet_category_list_load_failed', error, {
            sourceKey: categoryListKey
          });
          throw error;
        })
        .finally(() => {
          loadPromise = null;
        });
    }

    return loadPromise;
  }

  return {
    getSnapshot,
    syncNow
  };
}

module.exports = {
  CACHE_FILE_NAME,
  CATEGORY_LIST_KEY,
  CATEGORY_LIST_URL,
  createPodUploadSheetMiaoshouCategoryService
};
