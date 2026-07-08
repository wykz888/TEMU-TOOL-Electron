const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'operations-new-product-lifecycle';
const LEGACY_STORAGE_KEYS = Object.freeze([
  'feature_center/operations_management/new_product_lifecycle'
]);
const CONFIG_FILE_NAMES = Object.freeze({
  querySettings: 'query-settings.json',
  priceDeclSettings: 'price-decl-settings.json',
  batchAdjustPresets: 'batch-adjust-presets.json'
});
const STATE_FILE_NAMES = Object.freeze({
  batchAdjustSubmitHistory: 'batch-adjust-submit-history.json'
});

function createOperationsNewProductLifecycleStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '\u4e0a\u65b0\u751f\u547d\u5468\u671f\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u5199\u672c\u5730\u914d\u7f6e\u3002'
  });

  function resolveConfigFileName(configKey) {
    const fileName = CONFIG_FILE_NAMES[configKey];

    if (!fileName) {
      throw new Error('\u4e0d\u652f\u6301\u7684\u4e0a\u65b0\u751f\u547d\u5468\u671f\u914d\u7f6e\u7c7b\u578b\u3002');
    }

    return fileName;
  }

  function resolveStateFileName(stateKey) {
    const fileName = STATE_FILE_NAMES[stateKey];

    if (!fileName) {
      throw new Error('\u4e0d\u652f\u6301\u7684\u4e0a\u65b0\u751f\u547d\u5468\u671f\u72b6\u6001\u7c7b\u578b\u3002');
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

  function getLocalStateFilePathForEntry(featureEntry, owner, stateKey) {
    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'state',
      resolveStateFileName(stateKey)
    );
  }

  function getCloudConfigKeyForEntry(featureEntry, owner, configKey) {
    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${resolveConfigFileName(configKey)}`;
  }

  function getCloudStateKeyForEntry(featureEntry, owner, stateKey) {
    return `${featureEntry.storageKey}/users/${owner.userKey}/state/${resolveStateFileName(stateKey)}`;
  }

  function getLocalConfigFilePath(owner, configKey) {
    return getLocalConfigFilePathForEntry(base.getFeatureEntry(), owner, configKey);
  }

  function getLocalStateFilePath(owner, stateKey) {
    return getLocalStateFilePathForEntry(base.getFeatureEntry(), owner, stateKey);
  }

  function getCloudConfigKey(owner, configKey) {
    return getCloudConfigKeyForEntry(base.getFeatureEntry(), owner, configKey);
  }

  function getCloudStateKey(owner, stateKey) {
    return getCloudStateKeyForEntry(base.getFeatureEntry(), owner, stateKey);
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

  async function readLocalState(owner, stateKey) {
    const storageEntries = base.getStorageEntries(LEGACY_STORAGE_KEYS);

    for (const storageEntry of storageEntries) {
      const localState = await base.readJsonFile(
        getLocalStateFilePathForEntry(storageEntry, owner, stateKey)
      );

      if (localState) {
        return localState;
      }
    }

    return null;
  }

  async function readCloudState(owner, stateKey) {
    const storageEntries = base.getStorageEntries(LEGACY_STORAGE_KEYS);

    for (const storageEntry of storageEntries) {
      const cloudKey = getCloudStateKeyForEntry(storageEntry, owner, stateKey);

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
          const cloudState = response && response.data ? response.data : null;

          if (cloudState) {
            return cloudState;
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
        warning: '\u5f53\u524d\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4fdd\u5b58\u4e0a\u65b0\u751f\u547d\u5468\u671f\u914d\u7f6e\u3002'
      };
    }

    await base.writeJsonFile(getLocalConfigFilePath(owner, configKey), payload);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudConfigKey(owner, configKey),
        data: payload,
        metadata: {
          record_type: `operations-new-product-lifecycle-${configKey}`,
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
        warning: normalizeText(error && error.message) || '\u4e91\u7aef\u5199\u5165\u5931\u8d25'
      };
    }
  }

  async function readUserState(stateKey) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        owner: null,
        localState: null,
        cloudState: null
      };
    }

    const localState = await readLocalState(owner, stateKey);
    let cloudState = null;

    if (!localState) {
      cloudState = await readCloudState(owner, stateKey);
    }

    return {
      owner,
      localState,
      cloudState
    };
  }

  async function writeUserState(stateKey, payload, metadata = {}) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        localSaved: false,
        cloudSynced: false,
        warning: '\u5f53\u524d\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4fdd\u5b58\u4e0a\u65b0\u751f\u547d\u5468\u671f\u72b6\u6001\u3002'
      };
    }

    await base.writeJsonFile(getLocalStateFilePath(owner, stateKey), payload);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudStateKey(owner, stateKey),
        data: payload,
        metadata: {
          record_type: `operations-new-product-lifecycle-${stateKey}`,
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
        warning: normalizeText(error && error.message) || '\u4e91\u7aef\u5199\u5165\u5931\u8d25'
      };
    }
  }

  return {
    getOwner: base.getOwner,
    readUserConfig,
    writeUserConfig,
    readUserState,
    writeUserState
  };
}

module.exports = {
  createOperationsNewProductLifecycleStore
};
