const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'operations-price-declaration';
const LEGACY_STORAGE_KEYS = Object.freeze([
  'feature_center/operations_management/price_declaration'
]);
const CONFIG_FILE_NAMES = Object.freeze({
  querySettings: 'query-settings.json',
  quickCostPresets: 'quick-cost-presets.json',
  reviewRules: 'review-rules.json'
});

function createOperationsPriceDeclarationStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u5199\u914d\u7f6e\u3002'
  });

  function resolveConfigFileName(configKey) {
    const fileName = CONFIG_FILE_NAMES[configKey];

    if (!fileName) {
      throw new Error('\u4e0d\u652f\u6301\u7684\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u914d\u7f6e\u7c7b\u578b\u3002');
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
    let cloudConfig = null;

    if (!localConfig) {
      cloudConfig = await readCloudConfig(owner, configKey);
    }

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
        cloudSynced: false,
        warning: '\u5f53\u524d\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4fdd\u5b58\u5546\u54c1\u4ef7\u683c\u7533\u62a5\u914d\u7f6e\u3002'
      };
    }

    await base.writeJsonFile(getLocalConfigFilePath(owner, configKey), payload);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudConfigKey(owner, configKey),
        data: payload,
        metadata: {
          record_type: `operations-price-declaration-${configKey}`,
          owner_user_key: owner.userKey,
          owner_username: owner.username,
          updated_at: normalizeText(payload && payload.updatedAt),
          ...metadata
        }
      });

      return {
        cloudSynced: true,
        warning: ''
      };
    } catch (error) {
      return {
        cloudSynced: false,
        warning: normalizeText(error && error.message) || '\u4e91\u7aef\u5199\u5165\u5931\u8d25'
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
  createOperationsPriceDeclarationStore
};
