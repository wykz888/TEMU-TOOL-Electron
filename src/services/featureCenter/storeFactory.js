const fs = require('node:fs');
const path = require('node:path');
const { buildOwnerDescriptor } = require('../shopManagement/common');

/**
 * Creates the base shared functions for feature center stores.
 * Eliminates the getOwner / getFeatureEntry / readJsonFile / writeJsonFile
 * duplication that was identical across all feature center *Store.js files.
 */
function createStoreBase({
  sessionStore,
  featureCenterProfileService,
  entryId,
  entryNotRegisteredMessage
}) {
  function getOwner() {
    if (!sessionStore || typeof sessionStore.getSession !== 'function') {
      return null;
    }

    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getEntryById === 'function'
        ? featureCenterProfileService.getEntryById(entryId)
        : null;

    if (!featureEntry) {
      throw new Error(entryNotRegisteredMessage);
    }

    return featureEntry;
  }

  function getStorageEntryForKey(currentEntry, storageKey) {
    const normalizedStorageKey = String(storageKey || '').trim();

    if (!normalizedStorageKey) {
      return null;
    }

    if (currentEntry && currentEntry.storageKey === normalizedStorageKey) {
      return currentEntry;
    }

    const storageProfile =
      featureCenterProfileService
      && typeof featureCenterProfileService.getStorageProfile === 'function'
        ? featureCenterProfileService.getStorageProfile(normalizedStorageKey)
        : null;

    if (!storageProfile) {
      return null;
    }

    return {
      ...(currentEntry || {}),
      storageKey: normalizedStorageKey,
      storageProfile,
      isLegacyStorage: true
    };
  }

  function getStorageEntries(legacyStorageKeys = []) {
    const currentEntry = getFeatureEntry();
    const entries = [currentEntry];
    const seenStorageKeys = new Set([currentEntry.storageKey]);

    (Array.isArray(legacyStorageKeys) ? legacyStorageKeys : []).forEach((storageKey) => {
      const storageEntry = getStorageEntryForKey(currentEntry, storageKey);

      if (!storageEntry || seenStorageKeys.has(storageEntry.storageKey)) {
        return;
      }

      seenStorageKeys.add(storageEntry.storageKey);
      entries.push(storageEntry);
    });

    return entries;
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

  return {
    getOwner,
    getFeatureEntry,
    getStorageEntries,
    readJsonFile,
    writeJsonFile
  };
}

module.exports = {
  createStoreBase
};
