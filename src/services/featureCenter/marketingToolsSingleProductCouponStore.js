const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'marketing-tools-single-product-coupon';
const CONFIG_FILE_NAMES = Object.freeze({
  batchCouponSettings: 'batch-coupon-settings.json'
});

function createMarketingToolsSingleProductCouponStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '\u5355\u54c1\u4f18\u60e0\u5238\u6a21\u5757\u672a\u6ce8\u518c'
  });

  function resolveConfigFileName(configKey) {
    const fileName = CONFIG_FILE_NAMES[configKey];

    if (!fileName) {
      throw new Error('\u4e0d\u652f\u6301\u7684\u5355\u54c1\u4f18\u60e0\u5238\u914d\u7f6e\u952e');
    }

    return fileName;
  }

  function getLocalConfigFilePath(owner, configKey) {
    const featureEntry = base.getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'config',
      resolveConfigFileName(configKey)
    );
  }

  function getCloudConfigKey(owner, configKey) {
    const featureEntry = base.getFeatureEntry();

    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${resolveConfigFileName(configKey)}`;
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

    const localConfig = await base.readJsonFile(getLocalConfigFilePath(owner, configKey));
    const cloudKey = getCloudConfigKey(owner, configKey);
    let cloudConfig = null;

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
        cloudConfig = response && response.data ? response.data : null;
      }
    } catch (_error) {
      cloudConfig = null;
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
          record_type: `marketing-tools-single-product-coupon-${configKey}`,
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
  createMarketingToolsSingleProductCouponStore
};
