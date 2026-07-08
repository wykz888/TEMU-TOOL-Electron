const GLOBAL_CONFIG_CHANNELS = Object.freeze({
  GET_GENERAL_SETTINGS: 'global-config:get-general-settings',
  SAVE_GENERAL_SETTINGS: 'global-config:save-general-settings',
  GET_STORAGE_SELECTION: 'global-config:get-storage-selection',
  SAVE_STORAGE_SELECTION: 'global-config:save-storage-selection',
  LIST_TENCENT_COS_BUCKETS: 'global-config:list-tencent-cos-buckets',
  LIST_TENCENT_COS_OBJECTS: 'global-config:list-tencent-cos-objects',
  DELETE_TENCENT_COS_OBJECTS: 'global-config:delete-tencent-cos-objects',
  LIST_CLOUDFLARE_R2_BUCKETS: 'global-config:list-cloudflare-r2-buckets',
  LIST_CLOUDFLARE_R2_PUBLIC_DOMAINS: 'global-config:list-cloudflare-r2-public-domains',
  LIST_CLOUDFLARE_R2_OBJECTS: 'global-config:list-cloudflare-r2-objects',
  DELETE_CLOUDFLARE_R2_OBJECTS: 'global-config:delete-cloudflare-r2-objects',
  GET_UPDATE_SETTINGS: 'global-config:get-update-settings',
  SAVE_UPDATE_SETTINGS: 'global-config:save-update-settings',
  GET_AI_CONFIG: 'global-config:get-ai-config',
  SAVE_AI_CONFIG: 'global-config:save-ai-config',
  TEST_AI_API_KEY: 'global-config:test-ai-api-key'
});

module.exports = {
  GLOBAL_CONFIG_CHANNELS
};
