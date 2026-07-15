const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');
const { createStoreBase } = require('./storeFactory');

const SERVICE_VERSION = 1;
const STORAGE_KEY = 'feature_center/pod_upload_sheet_miaoshou/ai_title_shared';
const SETTINGS_FILE_NAME = 'ai-title-config.json';
const DEFAULT_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seed-2-0-mini-260428';
const DEFAULT_CONCURRENCY = 20;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 50;

function createPodUploadSheetMiaoshouAiTitleConfigService({
  sessionStore,
  featureCenterProfileService
}) {
  const storeBase = createStoreBase({
    sessionStore,
    featureCenterProfileService,
    entryId: 'pod-upload-sheet-miaoshou-table',
    entryNotRegisteredMessage: '\u5999\u624b\u8868\u683c AI \u914d\u7f6e\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u914d\u7f6e\u3002'
  });
  let cachedOwnerKey = '';
  let cachedResult = null;

  function getOwner() {
    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getStorageProfile() {
    return featureCenterProfileService.getStorageProfile(STORAGE_KEY);
  }

  function getLocalSettingsFilePath(owner) {
    return path.join(
      getStorageProfile().localRootDir,
      'users',
      owner.userKey,
      'config',
      SETTINGS_FILE_NAME
    );
  }

  function getCloudSettingsKey(owner) {
    return `${STORAGE_KEY}/users/${owner.userKey}/config/${SETTINGS_FILE_NAME}`;
  }

  function normalizeApiKeys(value) {
    const sourceValues = Array.isArray(value)
      ? value
      : String(value || '').replace(/\r\n/g, '\n').split('\n');
    const seenKeys = new Set();

    return sourceValues.reduce((result, item) => {
      const normalizedKey = normalizeText(item);

      if (!normalizedKey || seenKeys.has(normalizedKey)) {
        return result;
      }

      seenKeys.add(normalizedKey);
      result.push(normalizedKey);
      return result;
    }, []);
  }

  function normalizeConcurrency(value) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return DEFAULT_CONCURRENCY;
    }

    return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, parsed));
  }

  function buildDefaultSettings(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: nowIso(),
      apiBaseUrl: DEFAULT_API_BASE_URL,
      model: DEFAULT_MODEL,
      concurrency: DEFAULT_CONCURRENCY,
      apiKeys: []
    };
  }

  function normalizeSettingsPayload(payload, owner) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const defaultSettings = buildDefaultSettings(owner);
    const normalizedKeys = normalizeApiKeys(source.apiKeys || source.apiKey);

    return {
      ...defaultSettings,
      updatedAt: normalizeText(source.updatedAt) || defaultSettings.updatedAt,
      apiBaseUrl: normalizeText(source.apiBaseUrl) || DEFAULT_API_BASE_URL,
      model: normalizeText(source.model) || DEFAULT_MODEL,
      concurrency: normalizeConcurrency(source.concurrency),
      apiKeys: normalizedKeys.length ? normalizedKeys : []
    };
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(
      payload && typeof payload === 'object' && payload.updatedAt
        ? payload.updatedAt
        : ''
    );

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? { source: 'cloud', payload: cloudPayload }
        : { source: 'local', payload: localPayload };
    }

    if (cloudPayload) {
      return { source: 'cloud', payload: cloudPayload };
    }

    if (localPayload) {
      return { source: 'local', payload: localPayload };
    }

    return { source: 'default', payload: null };
  }

  async function readCloudSettings(owner) {
    const key = getCloudSettingsKey(owner);
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key
    });

    return result.data;
  }

  async function writeCloudSettings(owner, payload) {
    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key: getCloudSettingsKey(owner),
      data: payload,
      metadata: {
        record_type: 'pod-upload-sheet-miaoshou-ai-title-config',
        owner_user_key: owner.userKey,
        owner_username: owner.username
      }
    });
  }

  function updateCachedResult(owner, result) {
    cachedOwnerKey = owner && owner.userKey ? owner.userKey : '';
    cachedResult = result
      ? {
        ...result,
        settings: normalizeSettingsPayload(result.settings, owner)
      }
      : null;

    return cachedResult;
  }

  async function getConfig() {
    const owner = getOwner();

    if (!owner) {
      return updateCachedResult(owner, {
        settings: buildDefaultSettings(owner),
        source: 'default'
      });
    }

    const localFilePath = getLocalSettingsFilePath(owner);
    const localPayload = await storeBase.readJsonFile(localFilePath).catch(() => null);
    let cloudPayload = null;
    let cloudReadFailed = false;

    try {
      cloudPayload = await readCloudSettings(owner);
    } catch (_error) {
      cloudReadFailed = true;
    }

    const preferred = pickNewerPayload(localPayload, cloudPayload);
    const normalizedSettings = preferred.payload
      ? normalizeSettingsPayload(preferred.payload, owner)
      : buildDefaultSettings(owner);

    if (
      preferred.source === 'cloud'
      && getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
    ) {
      await storeBase.writeJsonFile(localFilePath, normalizedSettings).catch(() => null);
    }

    if (
      preferred.source === 'local'
      && getPayloadTimestamp(localPayload) > getPayloadTimestamp(cloudPayload)
    ) {
      void writeCloudSettings(owner, normalizedSettings).catch(() => null);
    }

    return updateCachedResult(owner, {
      settings: normalizedSettings,
      source: preferred.source === 'local' && cloudReadFailed ? 'local-fallback' : preferred.source
    });
  }

  async function getCachedConfig() {
    const owner = getOwner();
    const ownerKey = owner && owner.userKey ? owner.userKey : '';

    if (cachedResult && cachedOwnerKey === ownerKey) {
      return cachedResult;
    }

    if (!owner) {
      return updateCachedResult(owner, {
        settings: buildDefaultSettings(owner),
        source: 'default'
      });
    }

    const localPayload = await storeBase.readJsonFile(getLocalSettingsFilePath(owner)).catch(() => null);

    if (localPayload) {
      return updateCachedResult(owner, {
        settings: normalizeSettingsPayload(localPayload, owner),
        source: 'local-cache'
      });
    }

    return getConfig();
  }

  async function saveConfig(payload) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedResult(owner, {
        settings: buildDefaultSettings(owner),
        source: 'default',
        cloudSynced: false
      });
    }

    const settings = normalizeSettingsPayload({
      ...(payload && typeof payload === 'object' ? payload : {}),
      updatedAt: nowIso()
    }, owner);
    const localFilePath = getLocalSettingsFilePath(owner);

    await storeBase.writeJsonFile(localFilePath, settings);

    try {
      await writeCloudSettings(owner, settings);

      return updateCachedResult(owner, {
        settings,
        source: 'cloud',
        cloudSynced: true
      });
    } catch (error) {
      return updateCachedResult(owner, {
        settings,
        source: 'local',
        cloudSynced: false,
        warning: error && error.message ? error.message : '\u4e91\u7aef\u540c\u6b65\u5931\u8d25'
      });
    }
  }

  return {
    getConfig,
    getCachedConfig,
    saveConfig
  };
}

module.exports = {
  DEFAULT_AI_TITLE_CONFIG: Object.freeze({
    apiBaseUrl: DEFAULT_API_BASE_URL,
    model: DEFAULT_MODEL,
    concurrency: DEFAULT_CONCURRENCY,
    apiKeys: Object.freeze([])
  }),
  createPodUploadSheetMiaoshouAiTitleConfigService
};
