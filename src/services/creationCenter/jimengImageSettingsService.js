const fs = require('node:fs');
const path = require('node:path');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const FEATURE_ID = 'jimeng-image';
const SETTINGS_FILE_NAME = 'workspace-settings.json';
const DEFAULT_QUEUE_TASK_LIMIT = 1;
const MAX_QUEUE_TASK_LIMIT = 10;
const DEFAULT_START_TASK_OFFSET = 0;

function normalizeQueueTaskLimit(value) {
  const numericValue = Math.round(Number(value) || DEFAULT_QUEUE_TASK_LIMIT);

  return Math.min(MAX_QUEUE_TASK_LIMIT, Math.max(DEFAULT_QUEUE_TASK_LIMIT, numericValue));
}

function normalizeStartTaskOffset(value) {
  return Math.max(DEFAULT_START_TASK_OFFSET, Math.round(Number(value) || DEFAULT_START_TASK_OFFSET));
}

function createJimengImageSettingsService({
  sessionStore,
  creationCenterProfileService
}) {
  let cachedOwnerKey = '';
  let cachedSettingsResult = null;

  function getOwner() {
    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      creationCenterProfileService
      && typeof creationCenterProfileService.getFeatureById === 'function'
        ? creationCenterProfileService.getFeatureById(FEATURE_ID)
        : null;

    if (!featureEntry) {
      throw new Error('\u5373\u68A6\u751F\u56FE\u914D\u7F6E\u6A21\u5757\u672A\u6CE8\u518C\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u5DE5\u4F5C\u53F0\u8BBE\u7F6E\u3002');
    }

    return featureEntry;
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

  function buildDefaultSettings(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      promptPrefix: '',
      promptSuffix: '',
      saveDirectoryPath: '',
      createDateSubdirectory: false,
      filterDuplicateTasks: false,
      queueTaskLimit: DEFAULT_QUEUE_TASK_LIMIT,
      startTaskOffset: DEFAULT_START_TASK_OFFSET
    };
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

  function normalizeSettingsPayload(payload, owner) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const baseSettings = buildDefaultSettings(owner);

    return {
      version: SERVICE_VERSION,
      owner: baseSettings.owner,
      updatedAt: normalizeText(source.updatedAt),
      promptPrefix: normalizeText(source.promptPrefix),
      promptSuffix: normalizeText(source.promptSuffix),
      saveDirectoryPath: normalizeText(source.saveDirectoryPath),
      createDateSubdirectory: source.createDateSubdirectory === true,
      filterDuplicateTasks: source.filterDuplicateTasks === true,
      queueTaskLimit: normalizeQueueTaskLimit(source.queueTaskLimit),
      startTaskOffset: normalizeStartTaskOffset(source.startTaskOffset)
    };
  }

  function updateCachedSettings(owner, result) {
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
    const owner = getOwner();

    if (!owner) {
      return updateCachedSettings(owner, {
        settings: buildDefaultSettings(null),
        source: 'unavailable'
      });
    }

    if (cachedSettingsResult && cachedOwnerKey === owner.userKey) {
      return cachedSettingsResult;
    }

    const localSettings = await readJsonFile(getLocalSettingsFilePath(owner)).catch(() => null);

    if (!localSettings) {
      return updateCachedSettings(owner, {
        settings: buildDefaultSettings(owner),
        source: 'default'
      });
    }

    return updateCachedSettings(owner, {
      settings: normalizeSettingsPayload(localSettings, owner),
      source: 'local_config'
    });
  }

  async function saveSettings(payload) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedSettings(owner, {
        settings: buildDefaultSettings(null),
        source: 'unavailable'
      });
    }

    const currentResult = await getSettings();
    const currentSettings = currentResult && currentResult.settings ? currentResult.settings : buildDefaultSettings(owner);
    const nextSettings = normalizeSettingsPayload({
      ...currentSettings,
      ...(payload && typeof payload === 'object' ? payload : {}),
      updatedAt: nowIso()
    }, owner);

    await writeJsonFile(getLocalSettingsFilePath(owner), nextSettings);

    return updateCachedSettings(owner, {
      settings: nextSettings,
      source: 'local_config'
    });
  }

  return {
    getSettings,
    saveSettings
  };
}

module.exports = {
  createJimengImageSettingsService
};
