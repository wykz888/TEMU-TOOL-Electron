const { normalizeText } = require('../shopManagement/common');
const {
  createPromotionManagerNewSettingsStore
} = require('./promotionManagerNewSettingsStore');

const SETTINGS_VERSION = 1;
const REGION_IDS = Object.freeze(['us', 'eu', 'global']);

function normalizeUniqueTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function normalizeRegionIds(values) {
  return normalizeUniqueTextList(values)
    .filter((regionId) => REGION_IDS.includes(regionId));
}

function getPayloadTimestamp(payload) {
  const timestamp = Date.parse(
    payload && typeof payload === 'object' && payload.updatedAt
      ? payload.updatedAt
      : ''
  );

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function pickPreferredConfig(localConfig, cloudConfig) {
  if (localConfig && cloudConfig) {
    return getPayloadTimestamp(cloudConfig) > getPayloadTimestamp(localConfig)
      ? { source: 'cloud', config: cloudConfig }
      : { source: 'local', config: localConfig };
  }

  if (cloudConfig) {
    return { source: 'cloud', config: cloudConfig };
  }

  if (localConfig) {
    return { source: 'local', config: localConfig };
  }

  return { source: 'default', config: null };
}

function buildDefaultSettings(owner) {
  return {
    version: SETTINGS_VERSION,
    owner: owner ? {
      userId: owner.userId,
      username: owner.username,
      userKey: owner.userKey
    } : null,
    updatedAt: new Date().toISOString(),
    createPromotion: {
      selectedShopIds: [],
      selectedRegionIds: []
    }
  };
}

function normalizeCreatePromotionSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};

  return {
    ...source,
    selectedShopIds: normalizeUniqueTextList(source.selectedShopIds || source.shopIds),
    selectedRegionIds: normalizeRegionIds(source.selectedRegionIds || source.regionIds)
  };
}

function normalizeSettingsPayload(payload, owner) {
  const defaults = buildDefaultSettings(owner);
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};

  return {
    ...defaults,
    ...source,
    version: SETTINGS_VERSION,
    owner: defaults.owner,
    updatedAt: normalizeText(source.updatedAt) || defaults.updatedAt,
    createPromotion: normalizeCreatePromotionSettings(source.createPromotion)
  };
}

function createPromotionManagerNewSettingsService({
  sessionStore,
  featureCenterProfileService
} = {}) {
  const store = createPromotionManagerNewSettingsStore({
    sessionStore,
    featureCenterProfileService
  });
  let cachedOwnerKey = '';
  let cachedSettingsResult = null;

  function updateCache(owner, result) {
    cachedOwnerKey = owner && owner.userKey ? owner.userKey : '';
    cachedSettingsResult = result
      ? {
        ...result,
        settings: normalizeSettingsPayload(result.settings, owner)
      }
      : null;

    return cachedSettingsResult;
  }

  async function getSettings() {
    const {
      owner,
      localConfig,
      cloudConfig,
      cloudReadFailed
    } = await store.readUserConfig();
    const preferred = pickPreferredConfig(localConfig, cloudConfig);
    const settings = normalizeSettingsPayload(preferred.config, owner);
    const localTimestamp = getPayloadTimestamp(localConfig);
    const cloudTimestamp = getPayloadTimestamp(cloudConfig);

    if (owner && preferred.source === 'cloud' && cloudTimestamp > localTimestamp) {
      void store.writeLocalConfig(owner, settings).catch(() => null);
    }

    if (
      owner
      && preferred.source === 'local'
      && cloudReadFailed !== true
      && localTimestamp > cloudTimestamp
    ) {
      void store.writeUserConfig(settings, {
        settings_version: String(SETTINGS_VERSION),
        sync_reason: 'sync-local-to-cloud'
      }).catch(() => null);
    }

    return updateCache(owner, {
      settings,
      source: preferred.source === 'local' && cloudReadFailed === true
        ? 'local-fallback'
        : preferred.source,
      cloudSynced: preferred.source === 'cloud',
      warning: ''
    });
  }

  async function getCachedSettings() {
    const owner = store.getOwner();
    const ownerKey = owner && owner.userKey ? owner.userKey : '';

    if (cachedSettingsResult && cachedOwnerKey === ownerKey) {
      return cachedSettingsResult;
    }

    return getSettings();
  }

  async function saveSettings(payload = {}) {
    const owner = store.getOwner();
    const currentResult = await getCachedSettings();
    const currentSettings = currentResult && currentResult.settings
      ? currentResult.settings
      : buildDefaultSettings(owner);
    const nextSettings = normalizeSettingsPayload({
      ...currentSettings,
      ...(payload && typeof payload === 'object' ? payload : {}),
      updatedAt: new Date().toISOString(),
      createPromotion: {
        ...((currentSettings && currentSettings.createPromotion) || {}),
        ...((payload && payload.createPromotion) || {})
      }
    }, owner);
    const writeResult = await store.writeUserConfig(nextSettings, {
      settings_version: String(SETTINGS_VERSION)
    });

    return updateCache(owner, {
      settings: nextSettings,
      source: writeResult.cloudSynced === true ? 'cloud' : 'local',
      localSaved: writeResult.localSaved === true,
      cloudSynced: writeResult.cloudSynced === true,
      warning: writeResult.warning || ''
    });
  }

  return {
    getSettings,
    getCachedSettings,
    saveSettings
  };
}

module.exports = {
  REGION_IDS,
  SETTINGS_VERSION,
  buildDefaultSettings,
  normalizeSettingsPayload,
  createPromotionManagerNewSettingsService
};
