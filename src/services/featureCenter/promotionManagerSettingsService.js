const fs = require('node:fs');
const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const { buildOwnerDescriptor } = require('../shopManagement/common');

const SETTINGS_VERSION = 9;
const FEATURE_ID = 'promotion-master';
const SETTINGS_FILE_NAME = 'promotion-manager-view.json';
const MONITOR_BASE_COLUMN_IDS = Object.freeze([
  'monitor',
  'log',
  'shop',
  'group',
  'note'
]);
const MONITOR_REGION_IDS = Object.freeze([
  'us',
  'eu',
  'global'
]);
const MONITOR_ACTION_IDS = Object.freeze([
  'pause_plan',
  'pause_then_resume',
  'delete_plan',
  'update_roas',
  'increase_roas'
]);
const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
const MIN_MONITOR_INTERVAL_SECONDS = 5;

function createPromotionManagerSettingsService({ sessionStore, featureCenterProfileService }) {
  let cachedOwnerKey = '';
  let cachedSettingsResult = null;

  function hasOwnField(container, fieldName) {
    return Boolean(
      container
      && typeof container === 'object'
      && Object.prototype.hasOwnProperty.call(container, fieldName)
    );
  }

  function getOwner() {
    return buildOwnerDescriptor(sessionStore.getSession());
  }

  function getFeatureEntry() {
    const featureEntry = featureCenterProfileService.getFeatureById(FEATURE_ID);

    if (!featureEntry) {
      throw new Error('推广大师配置未注册，无法读取自定义列设置。');
    }

    return featureEntry;
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
      monitorView: {
        activeFilter: 'all',
        selectedColumnIds: null,
        baseColumnWidths: null
      },
      monitorConfig: {
        monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
        dailyOperationLimit: null,
        totalOperationLimit: null,
        autoPauseSpendThreshold: null,
        autoPauseRoasThreshold: null,
        conditionMaxRoas: null,
        minOrderCount: 1,
        regionIds: MONITOR_REGION_IDS.slice(),
        actionType: 'pause_plan',
        resumeIntervalMinutes: null,
        targetRoas: null
      },
      monitorShopConfigs: {}
    };
  }

  function getLocalSettingsFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'config',
      SETTINGS_FILE_NAME
    );
  }

  function getCloudSettingsKey(owner) {
    const featureEntry = getFeatureEntry();

    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${SETTINGS_FILE_NAME}`;
  }

  async function readJsonFile(filePath) {
    try {
      const rawText = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, filePath);
  }

  function normalizeColumnIds(values) {
    if (!Array.isArray(values)) {
      return null;
    }

    return Array.from(
      new Set(
        values
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
  }

  function normalizeBaseColumnWidths(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return null;
    }

    const entries = MONITOR_BASE_COLUMN_IDS
      .map((columnId) => {
        const width = Number.parseInt(values[columnId], 10);

        if (!Number.isFinite(width) || width <= 0) {
          return null;
        }

        return [columnId, width];
      })
      .filter(Boolean);

    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }

  function normalizeIntegerValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return null;
    }

    return parsedValue;
  }

  function normalizeMinOrderCountValue(value) {
    if (value === '' || value === null || value === undefined) {
      return 1;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return 1;
    }

    return parsedValue;
  }

  function normalizeMonitorIntervalSecondsValue(value) {
    if (value === '' || value === null || value === undefined) {
      return DEFAULT_MONITOR_INTERVAL_SECONDS;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue)) {
      return DEFAULT_MONITOR_INTERVAL_SECONDS;
    }

    if (parsedValue < MIN_MONITOR_INTERVAL_SECONDS) {
      return MIN_MONITOR_INTERVAL_SECONDS;
    }

    return parsedValue;
  }

  function normalizeResumeIntervalMinutesValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return null;
    }

    return parsedValue;
  }

  function normalizeDecimalValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsedValue = Number.parseFloat(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return null;
    }

    return parsedValue;
  }

  function normalizeRegionIds(values) {
    if (!Array.isArray(values)) {
      return MONITOR_REGION_IDS.slice();
    }

    return Array.from(
      new Set(
        values
          .map((value) => String(value || '').trim())
          .filter((value) => MONITOR_REGION_IDS.includes(value))
      )
    );
  }

  function normalizeActionType(value) {
    const normalizedValue = String(value || '').trim();

    return MONITOR_ACTION_IDS.includes(normalizedValue) ? normalizedValue : 'pause_plan';
  }

  function normalizeMonitorShopConfigPatch(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const normalizedPatch = {};

    if (hasOwnField(source, 'monitorIntervalSeconds')) {
      normalizedPatch.monitorIntervalSeconds = normalizeMonitorIntervalSecondsValue(source.monitorIntervalSeconds);
    }

    if (hasOwnField(source, 'dailyOperationLimit')) {
      normalizedPatch.dailyOperationLimit = normalizeIntegerValue(source.dailyOperationLimit);
    }

    if (hasOwnField(source, 'totalOperationLimit')) {
      normalizedPatch.totalOperationLimit = normalizeIntegerValue(source.totalOperationLimit);
    }

    if (hasOwnField(source, 'autoPauseSpendThreshold')) {
      normalizedPatch.autoPauseSpendThreshold = normalizeDecimalValue(source.autoPauseSpendThreshold);
    }

    if (hasOwnField(source, 'autoPauseRoasThreshold')) {
      normalizedPatch.autoPauseRoasThreshold = normalizeDecimalValue(source.autoPauseRoasThreshold);
    }

    if (hasOwnField(source, 'conditionMaxRoas')) {
      normalizedPatch.conditionMaxRoas = normalizeDecimalValue(source.conditionMaxRoas);
    }

    if (hasOwnField(source, 'minOrderCount')) {
      normalizedPatch.minOrderCount = normalizeMinOrderCountValue(source.minOrderCount);
    }

    if (hasOwnField(source, 'regionIds')) {
      normalizedPatch.regionIds = normalizeRegionIds(source.regionIds);
    }

    if (hasOwnField(source, 'actionType')) {
      normalizedPatch.actionType = normalizeActionType(source.actionType);
    }

    if (hasOwnField(source, 'resumeIntervalMinutes')) {
      normalizedPatch.resumeIntervalMinutes = normalizeResumeIntervalMinutesValue(source.resumeIntervalMinutes);
    }

    if (hasOwnField(source, 'targetRoas')) {
      normalizedPatch.targetRoas = normalizeDecimalValue(source.targetRoas);
    }

    return normalizedPatch;
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
        ? {
          source: 'cloud',
          payload: cloudPayload
        }
        : {
          source: 'local',
          payload: localPayload
        };
    }

    if (cloudPayload) {
      return {
        source: 'cloud',
        payload: cloudPayload
      };
    }

    if (localPayload) {
      return {
        source: 'local',
        payload: localPayload
      };
    }

    return {
      source: 'default',
      payload: null
    };
  }

  function normalizeSettingsPayload(payload, owner) {
    const baseSettings = buildDefaultSettings(owner);
    const monitorView = payload && payload.monitorView ? payload.monitorView : {};
    const monitorConfig = payload && payload.monitorConfig ? payload.monitorConfig : {};
    const monitorShopConfigs =
      payload && payload.monitorShopConfigs && typeof payload.monitorShopConfigs === 'object'
        ? payload.monitorShopConfigs
        : {};

    return {
      ...baseSettings,
      ...payload,
      owner: baseSettings.owner,
      updatedAt: String(payload && payload.updatedAt || '').trim() || baseSettings.updatedAt,
      monitorView: {
        activeFilter: String(monitorView.activeFilter || 'all').trim() || 'all',
        selectedColumnIds: normalizeColumnIds(monitorView.selectedColumnIds),
        baseColumnWidths: normalizeBaseColumnWidths(monitorView.baseColumnWidths)
      },
      monitorConfig: {
        monitorIntervalSeconds: normalizeMonitorIntervalSecondsValue(monitorConfig.monitorIntervalSeconds),
        dailyOperationLimit: normalizeIntegerValue(monitorConfig.dailyOperationLimit),
        totalOperationLimit: normalizeIntegerValue(monitorConfig.totalOperationLimit),
        autoPauseSpendThreshold: normalizeDecimalValue(monitorConfig.autoPauseSpendThreshold),
        autoPauseRoasThreshold: normalizeDecimalValue(monitorConfig.autoPauseRoasThreshold),
        conditionMaxRoas: normalizeDecimalValue(monitorConfig.conditionMaxRoas),
        minOrderCount: normalizeMinOrderCountValue(monitorConfig.minOrderCount),
        regionIds: normalizeRegionIds(monitorConfig.regionIds),
        actionType: normalizeActionType(monitorConfig.actionType),
        resumeIntervalMinutes: normalizeResumeIntervalMinutesValue(monitorConfig.resumeIntervalMinutes),
        targetRoas: normalizeDecimalValue(monitorConfig.targetRoas)
      },
      monitorShopConfigs: Object.fromEntries(
        Object.entries(monitorShopConfigs)
          .map(([shopId, shopConfig]) => {
            const normalizedShopId = String(shopId || '').trim();

            if (!normalizedShopId) {
              return null;
            }

            return [normalizedShopId, normalizeMonitorShopConfigPatch(shopConfig)];
          })
          .filter(Boolean)
      )
    };
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
        record_type: 'promotion-manager-view-settings',
        owner_user_key: owner.userKey,
        owner_username: owner.username
      }
    });
  }

  function updateCachedSettings(owner, result) {
    cachedOwnerKey = owner && owner.userKey ? owner.userKey : '';
    cachedSettingsResult = result
      ? {
        ...result,
        settings: normalizeSettingsPayload(
          result && result.settings ? result.settings : buildDefaultSettings(owner),
          owner
        )
      }
      : null;

    return cachedSettingsResult;
  }

  async function getSettings() {
    const owner = getOwner();
    const defaultSettings = buildDefaultSettings(owner);
    
    if (!owner) {
      return updateCachedSettings(owner, {
        settings: defaultSettings,
        source: 'default'
      });
    }

    const localFilePath = getLocalSettingsFilePath(owner);
    const localSettings = await readJsonFile(localFilePath).catch(() => null);
    let cloudSettings = null;
    let cloudReadFailed = false;

    try {
      cloudSettings = await readCloudSettings(owner);
    } catch (_error) {
      cloudReadFailed = true;
    }

    const preferred = pickNewerPayload(localSettings, cloudSettings);

    if (preferred.payload) {
      const normalizedSettings = normalizeSettingsPayload(preferred.payload, owner);

      if (
        preferred.source === 'cloud'
        && getPayloadTimestamp(cloudSettings) > getPayloadTimestamp(localSettings)
      ) {
        await writeJsonFile(localFilePath, normalizedSettings).catch(() => null);
      }

      if (
        preferred.source === 'local'
        && getPayloadTimestamp(localSettings) > getPayloadTimestamp(cloudSettings)
      ) {
        void writeCloudSettings(owner, normalizedSettings).catch(() => null);
      }

      return updateCachedSettings(owner, {
        settings: normalizedSettings,
        source: preferred.source === 'local' && cloudReadFailed === true ? 'local-fallback' : preferred.source
      });
    }

    return updateCachedSettings(owner, {
      settings: defaultSettings,
      source: 'default'
    });
  }

  async function getCachedSettings() {
    const owner = getOwner();
    const ownerKey = owner && owner.userKey ? owner.userKey : '';

    if (cachedSettingsResult && cachedOwnerKey === ownerKey) {
      return cachedSettingsResult;
    }

    if (!owner) {
      return updateCachedSettings(owner, {
        settings: buildDefaultSettings(owner),
        source: 'default'
      });
    }

    const localFilePath = getLocalSettingsFilePath(owner);
    const localSettings = await readJsonFile(localFilePath).catch(() => null);

    if (localSettings) {
      return updateCachedSettings(owner, {
        settings: normalizeSettingsPayload(localSettings, owner),
        source: 'local-cache'
      });
    }

    return updateCachedSettings(owner, {
      settings: buildDefaultSettings(owner),
      source: 'default'
    });
  }

  async function getSettingsForSave(owner, localFilePath) {
    const ownerKey = owner && owner.userKey ? owner.userKey : '';

    if (cachedSettingsResult && cachedOwnerKey === ownerKey) {
      return cachedSettingsResult;
    }

    const localSettings = await readJsonFile(localFilePath).catch(() => null);

    if (localSettings) {
      return updateCachedSettings(owner, {
        settings: normalizeSettingsPayload(localSettings, owner),
        source: 'local-cache'
      });
    }

    return getSettings();
  }

  async function saveSettings(payload) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedSettings(owner, {
        settings: buildDefaultSettings(owner),
        source: 'default',
        cloudSynced: false
      });
    }

    const localFilePath = getLocalSettingsFilePath(owner);
    const currentSettingsResult = await getSettingsForSave(owner, localFilePath);
    const mergedSettings = normalizeSettingsPayload({
      ...(currentSettingsResult && currentSettingsResult.settings ? currentSettingsResult.settings : {}),
      ...(payload || {}),
      updatedAt: new Date().toISOString(),
      monitorView: {
        ...((currentSettingsResult && currentSettingsResult.settings && currentSettingsResult.settings.monitorView) || {}),
        ...((payload && payload.monitorView) || {})
      },
      monitorConfig: {
        ...((currentSettingsResult && currentSettingsResult.settings && currentSettingsResult.settings.monitorConfig) || {}),
        ...((payload && payload.monitorConfig) || {})
      }
    }, owner);

    await writeJsonFile(localFilePath, mergedSettings);

    try {
      await writeCloudSettings(owner, mergedSettings);

      return updateCachedSettings(owner, {
        settings: mergedSettings,
        source: 'cloud',
        cloudSynced: true
      });
    } catch (error) {
      return updateCachedSettings(owner, {
        settings: mergedSettings,
        source: 'local',
        cloudSynced: false,
        warning: error && error.message ? error.message : '云端同步失败'
      });
    }
  }

  return {
    getSettings,
    getCachedSettings,
    saveSettings
  };
}

module.exports = {
  createPromotionManagerSettingsService
};
