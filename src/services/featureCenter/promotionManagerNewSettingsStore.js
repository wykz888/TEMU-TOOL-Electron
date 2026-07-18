const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'promotion-master-new-campaign-create';
const CONFIG_FILE_NAME = 'create-promotion-settings.json';

function createPromotionManagerNewSettingsStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '\u63a8\u5e7f\u5927\u5e08-\u65b0\u5efa\u63a8\u5e7f\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u5199\u914d\u7f6e\u3002'
  });

  function getLocalConfigFilePath(owner) {
    const featureEntry = base.getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'config',
      CONFIG_FILE_NAME
    );
  }

  function getCloudConfigKey(owner) {
    const featureEntry = base.getFeatureEntry();

    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${CONFIG_FILE_NAME}`;
  }

  async function readCloudConfig(owner) {
    const cloudKey = getCloudConfigKey(owner);
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key: cloudKey
    });

    if (!exists) {
      return null;
    }

    const response = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key: cloudKey
    });

    return response && response.data ? response.data : null;
  }

  async function readUserConfig() {
    const owner = base.getOwner();

    if (!owner) {
      return {
        owner: null,
        localConfig: null,
        cloudConfig: null,
        cloudReadFailed: false
      };
    }

    const localConfig = await base.readJsonFile(getLocalConfigFilePath(owner)).catch(() => null);
    let cloudConfig = null;
    let cloudReadFailed = false;

    try {
      cloudConfig = await readCloudConfig(owner);
    } catch (_error) {
      cloudReadFailed = true;
    }

    return {
      owner,
      localConfig,
      cloudConfig,
      cloudReadFailed
    };
  }

  async function writeUserConfig(payload, metadata = {}) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        localSaved: false,
        cloudSynced: false,
        warning: '\u5f53\u524d\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4fdd\u5b58\u65b0\u5efa\u63a8\u5e7f\u914d\u7f6e\u3002'
      };
    }

    await base.writeJsonFile(getLocalConfigFilePath(owner), payload);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudConfigKey(owner),
        data: payload,
        metadata: {
          record_type: 'promotion-manager-new-create-settings',
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
    writeLocalConfig(owner, payload) {
      return base.writeJsonFile(getLocalConfigFilePath(owner), payload);
    },
    writeUserConfig
  };
}

module.exports = {
  CONFIG_FILE_NAME,
  createPromotionManagerNewSettingsStore
};
