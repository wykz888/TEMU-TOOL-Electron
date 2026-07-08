const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { normalizeText } = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const ENTRY_ID = 'operations-management';
const COST_PROFILE_FILE_NAME = 'cost-profile.json';

function createOperationsSharedCostStore({
  sessionStore,
  featureCenterProfileService
}) {
  const base = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: ENTRY_ID,
    entryNotRegisteredMessage: '运营管理功能未注册，无法读写共享成本配置。'
  });

  function resolveShopId(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      throw new Error('缺少店铺标识，无法读写成本档案。');
    }

    return normalizedShopId;
  }

  function getLocalCostFilePath(owner, shopId) {
    const featureEntry = base.getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'state',
      'shops',
      resolveShopId(shopId),
      COST_PROFILE_FILE_NAME
    );
  }

  function getCloudCostKey(owner, shopId) {
    const featureEntry = base.getFeatureEntry();
    return `${featureEntry.storageKey}/users/${owner.userKey}/state/shops/${resolveShopId(shopId)}/${COST_PROFILE_FILE_NAME}`;
  }

  async function readShopCostProfile(shopId, options = {}) {
    const owner = base.getOwner();

    if (!owner) {
      return {
        owner: null,
        localProfile: null,
        cloudProfile: null
      };
    }

    const normalizedShopId = resolveShopId(shopId);
    const localProfile = await base.readJsonFile(getLocalCostFilePath(owner, normalizedShopId));
    const cloudKey = getCloudCostKey(owner, normalizedShopId);
    const shouldRefreshCloud = options && options.refreshCloud === true;
    let cloudProfile = null;

    if (shouldRefreshCloud || !localProfile) {
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

  async function writeShopCostProfile({ owner: providedOwner, shopId, profile, metadata = {} }) {
    const owner = providedOwner || base.getOwner();

    if (!owner) {
      return {
        cloudSynced: false,
        warning: '当前未登录，无法保存共享成本数据。'
      };
    }

    const normalizedShopId = resolveShopId(shopId);
    await base.writeJsonFile(getLocalCostFilePath(owner, normalizedShopId), profile);

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudCostKey(owner, normalizedShopId),
        data: profile,
        metadata: {
          record_type: 'operations-shared-cost-profile',
          owner_user_key: owner.userKey,
          owner_username: owner.username,
          shop_id: normalizedShopId,
          updated_at: normalizeText(profile && profile.updatedAt),
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
    readShopCostProfile,
    writeShopCostProfile
  };
}

module.exports = {
  createOperationsSharedCostStore
};
