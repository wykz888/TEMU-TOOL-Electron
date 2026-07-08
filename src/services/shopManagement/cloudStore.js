const { cosService, COS_SCOPES } = require('../cos');

const ROOT_SCOPE = COS_SCOPES.ROOT;

function createShopCloudStore() {
  function getOwnerBaseKey(owner) {
    return `shop_management/users/${owner.userKey}`;
  }

  function getIndexKey(owner) {
    return `${getOwnerBaseKey(owner)}/index.json`;
  }

  function getRecordKey(owner, recordKey) {
    return `${getOwnerBaseKey(owner)}/${String(recordKey || '').replace(/^\/+/, '')}`;
  }

  return {
    async readIndex(owner) {
      const key = getIndexKey(owner);
      const exists = await cosService.existsObject({
        scope: ROOT_SCOPE,
        key
      });

      if (!exists) {
        return null;
      }

      const result = await cosService.getObjectJson({
        scope: ROOT_SCOPE,
        key
      });

      return result.data;
    },
    async readShopRecord(owner, recordKey) {
      const key = getRecordKey(owner, recordKey);
      const exists = await cosService.existsObject({
        scope: ROOT_SCOPE,
        key
      });

      if (!exists) {
        return null;
      }

      const result = await cosService.getObjectJson({
        scope: ROOT_SCOPE,
        key
      });

      return result.data;
    },
    saveIndex(owner, payload) {
      return cosService.putJson({
        scope: ROOT_SCOPE,
        key: getIndexKey(owner),
        data: payload,
        metadata: {
          record_type: 'shop-index',
          owner_user_key: owner.userKey,
          owner_username: owner.username
        }
      });
    },
    saveShopRecord(owner, recordKey, payload, shopSummary) {
      return cosService.putJson({
        scope: ROOT_SCOPE,
        key: getRecordKey(owner, recordKey),
        data: payload,
        metadata: {
          record_type: 'shop-detail',
          owner_user_key: owner.userKey,
          owner_username: owner.username,
          shop_id: shopSummary.id,
          shop_name: shopSummary.shopName
        }
      });
    }
  };
}

module.exports = {
  createShopCloudStore
};
