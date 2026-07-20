const path = require('node:path');
const { createStoreBase } = require('./storeFactory');

const DEFAULT_ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const CACHE_FILE_NAME = 'temu-pod-category-list-cache.json';

function createPodUploadSheetMiaoshouCategoryCacheStore({
  featureCenterProfileService,
  entryId = DEFAULT_ENTRY_ID,
  cacheFileName = CACHE_FILE_NAME
} = {}) {
  const storeBase = createStoreBase({
    featureCenterProfileService,
    entryId,
    entryNotRegisteredMessage: 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248) \u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u7f13\u5b58\u7c7b\u76ee\u6570\u636e\u3002'
  });

  function getCacheFilePath() {
    const featureEntry = storeBase.getFeatureEntry();

    // This TEMU category list is a shared platform dictionary, so it is cached once per feature.
    return path.join(featureEntry.storageProfile.localCacheDir, cacheFileName);
  }

  async function read() {
    const cacheFilePath = getCacheFilePath();
    const payload = await storeBase.readJsonFile(cacheFilePath);

    return payload
      ? {
        ...payload,
        cacheFilePath
      }
      : null;
  }

  async function write(payload) {
    const cacheFilePath = getCacheFilePath();

    await storeBase.writeJsonFile(cacheFilePath, payload);

    return {
      ...payload,
      cacheFilePath
    };
  }

  return {
    getCacheFilePath,
    read,
    write
  };
}

module.exports = {
  CACHE_FILE_NAME,
  DEFAULT_ENTRY_ID,
  createPodUploadSheetMiaoshouCategoryCacheStore
};
