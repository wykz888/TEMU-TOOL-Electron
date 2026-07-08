const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'operations-management';
const PROFILE_FILE_NAME = 'shop-selection-templates.json';

function createOperationsShopSelectionStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '运营管理功能未注册，无法读写店铺选择配置。'
  });

  function getLocalProfileFilePath(owner) {
    const featureEntry = base.getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'config',
      PROFILE_FILE_NAME
    );
  }

  function getCloudProfileKey(owner) {
    const featureEntry = base.getFeatureEntry();

    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${PROFILE_FILE_NAME}`;
  }

  async function readProfile() {
    const owner = base.getOwner();

    if (!owner) {
      return {
        owner: null,
        localProfile: null,
        cloudProfile: null
      };
    }

    const localProfile = await base.readJsonFile(getLocalProfileFilePath(owner));
    const cloudKey = getCloudProfileKey(owner);
    let cloudProfile = null;

    if (!localProfile) {
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
          cloudProfile = response && response.data ? response.data : null;
        }
      } catch (_error) {
        cloudProfile = null;
      }
    }

    return {
      owner,
      localProfile,
      cloudProfile
    };
  }

  async function writeProfile(payload, metadata = {}) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        cloudSynced: false,
        warning: '当前未登录，无法保存店铺选择配置。'
      };
    }

    await base.writeJsonFile(getLocalProfileFilePath(owner), payload);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudProfileKey(owner),
        data: payload,
        metadata: {
          record_type: 'operations-shop-selection-templates',
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
        warning: normalizeText(error && error.message) || '云端写入失败'
      };
    }
  }

  return {
    getOwner: base.getOwner,
    readProfile,
    writeProfile
  };
}

module.exports = {
  createOperationsShopSelectionStore
};
