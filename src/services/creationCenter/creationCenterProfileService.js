const path = require('node:path');
const {
  CREATION_CENTER_CATALOG,
  getCreationCenterFeatureById
} = require('../../features/creationCenter/catalog');
const { getScopedDataRoot } = require('../../utils/persistenceRoots');

function createCreationCenterProfileService({ app }) {
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
      return CREATION_CENTER_CATALOG.map((entry) => decorateEntry(entry));
    },
    getEntryById(entryId) {
      const entry = findCatalogEntryById(CREATION_CENTER_CATALOG, entryId);

      return entry ? decorateEntry(entry) : null;
    },
    getFeatureById(featureId) {
      const entry = getCreationCenterFeatureById(featureId);

      return entry ? decorateEntry(entry) : null;
    }
  };
}

module.exports = {
  createCreationCenterProfileService
};
