const path = require('node:path');
const {
  FEATURE_CENTER_CATALOG,
  getFeatureCenterFeatureById
} = require('../../features/featureCenter/catalog');
const { getScopedDataRoot } = require('../../utils/persistenceRoots');

const INTERNAL_FEATURE_CENTER_ENTRIES = Object.freeze([
  Object.freeze({
    kind: 'internal',
    id: 'operations-management',
    tag: '\u8fd0\u8425',
    title: '\u8fd0\u8425\u5171\u4eab\u5b58\u50a8',
    description: '',
    storageKey: 'feature_center/operations_management',
    codeCategory: 'feature_center.operations_management',
    codeDirectory: 'src/services/featureCenter/operationsSharedCostStore.js',
    modules: []
  })
]);

function createFeatureCenterProfileService({ app }) {
  function findCatalogEntryById(entries, entryId) {
    const normalizedEntryId = String(entryId || '').trim();

    if (!normalizedEntryId) {
      return null;
    }

    for (const entry of Array.isArray(entries) ? entries : []) {
      if (entry && entry.id === normalizedEntryId) {
        return entry;
      }

      const nestedEntry = findCatalogEntryById(entry && entry.modules, normalizedEntryId);

      if (nestedEntry) {
        return nestedEntry;
      }
    }

    return null;
  }

  function buildStorageProfile(storageKey) {
    const segments = String(storageKey || '').split('/').filter(Boolean);
    const localRootDir = path.join(getScopedDataRoot(app), ...segments);
    const localConfigDir = path.join(localRootDir, 'config');
    const localCacheDir = path.join(localRootDir, 'cache');
    const localStateDir = path.join(localRootDir, 'state');

    return {
      localRootDir,
      localConfigDir,
      localConfigFilePath: path.join(localConfigDir, 'settings.json'),
      localCacheDir,
      localStateDir,
      cloudScope: 'root',
      cloudPrefix: storageKey,
      cloudConfigKey: `${storageKey}/config/settings.json`,
      cloudCachePrefix: `${storageKey}/cache/`,
      cloudStatePrefix: `${storageKey}/state/`
    };
  }

  function decorateEntry(entry) {
    return {
      ...entry,
      storageProfile: buildStorageProfile(entry.storageKey),
      modules: Array.isArray(entry.modules) ? entry.modules.map((moduleEntry) => decorateEntry(moduleEntry)) : []
    };
  }

  return {
    getCatalog() {
      return FEATURE_CENTER_CATALOG.map((entry) => decorateEntry(entry));
    },
    getEntryById(entryId) {
      const entry = findCatalogEntryById(FEATURE_CENTER_CATALOG, entryId)
        || findCatalogEntryById(INTERNAL_FEATURE_CENTER_ENTRIES, entryId);

      return entry ? decorateEntry(entry) : null;
    },
    getStorageProfile(storageKey) {
      return buildStorageProfile(storageKey);
    },
    getFeatureById(featureId) {
      const entry = getFeatureCenterFeatureById(featureId);

      return entry ? decorateEntry(entry) : null;
    }
  };
}

module.exports = {
  createFeatureCenterProfileService
};
