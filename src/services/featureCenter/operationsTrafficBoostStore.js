const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'operations-traffic-boost';
const LEGACY_STORAGE_KEYS = Object.freeze([
  'feature_center/operations_management/traffic_boost'
]);
const CONFIG_FILE_NAMES = Object.freeze({
  customLevelFilterSettings: 'custom-level-filter-settings.json'
});

function createOperationsTrafficBoostStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '\u6d41\u91cf\u52a0\u901f\u6a21\u5757\u672a\u6ce8\u518c'
  });

  function resolveConfigFileName(configKey) {
    const fileName = CONFIG_FILE_NAMES[configKey];

    if (!fileName) {
      throw new Error('\u4e0d\u652f\u6301\u7684\u6d41\u91cf\u52a0\u901f\u914d\u7f6e\u952e');
    }

    return fileName;
  }

  function getLocalConfigFilePathForEntry(featureEntry, owner, configKey) {
    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'config',
      resolveConfigFileName(configKey)
    );
  }

  function getCloudConfigKeyForEntry(featureEntry, owner, configKey) {
    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${resolveConfigFileName(configKey)}`;
  }

  function getLocalConfigFilePath(owner, configKey) {
    return getLocalConfigFilePathForEntry(base.getFeatureEntry(), owner, configKey);
  }

  function getCloudConfigKey(owner, configKey) {
    return getCloudConfigKeyForEntry(base.getFeatureEntry(), owner, configKey);
  }

  async function readLocalConfig(owner, configKey) {
    const storageEntries = base.getStorageEntries(LEGACY_STORAGE_KEYS);

    for (const storageEntry of storageEntries) {
      const localConfig = await base.readJsonFile(
        getLocalConfigFilePathForEntry(storageEntry, owner, configKey)
      );

      if (localConfig) {
        return localConfig;
      }
    }

    return null;
  }

  async function readCloudConfig(owner, configKey) {
    const storageEntries = base.getStorageEntries(LEGACY_STORAGE_KEYS);

    for (const storageEntry of storageEntries) {
      const cloudKey = getCloudConfigKeyForEntry(storageEntry, owner, configKey);

      try {
        const exists = await cosService.existsObject({
          scope: COS_SCOPES.ROOT,
          key: cloudKey
        });

        if (exists) {
          const response = await cosService.getObjectJson({
            scope: COS_SCOPES.ROOT,
            key: cloudKey
          });
          const cloudConfig = response && response.data ? response.data : null;

          if (cloudConfig) {
            return cloudConfig;
          }
        }
      } catch (_error) {
        continue;
      }
    }

    return null;
  }

  async function readUserConfig(configKey) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        owner: null,
        localConfig: null,
        cloudConfig: null
      };
    }

    const localConfig = await readLocalConfig(owner, configKey);
    const cloudConfig = await readCloudConfig(owner, configKey);

    return {
      owner,
      localConfig,
      cloudConfig
    };
  }

  async function writeUserConfig(configKey, payload, metadata = {}) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        localSaved: false,
        cloudSynced: false,
        warning: '\u5f53\u524d\u672a\u767b\u5f55'
      };
    }

    await base.writeJsonFile(getLocalConfigFilePath(owner, configKey), payload);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudConfigKey(owner, configKey),
        data: payload,
        metadata: {
          record_type: `operations-traffic-boost-${configKey}`,
          owner_user_key: owner.userKey,
          owner_username: owner.username,
          updated_at: normalizeText(payload && payload.updatedAt),
          ...metadata
        }
      });

      return {
        localSaved: true,
        cloudSynced: true,
        warning: ''
      };
    } catch (error) {
      return {
        localSaved: true,
        cloudSynced: false,
        warning: normalizeText(error && error.message) || '\u4e91\u7aef\u914d\u7f6e\u540c\u6b65\u5931\u8d25'
      };
    }
  }

  return {
    getOwner: base.getOwner,
    readUserConfig,
    writeUserConfig
  };
}

module.exports = {
  createOperationsTrafficBoostStore
};
