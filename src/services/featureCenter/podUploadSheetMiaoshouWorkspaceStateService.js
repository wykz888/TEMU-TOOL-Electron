const fs = require('node:fs');
const path = require('node:path');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 4;
const DEFAULT_ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const STATE_FILE_NAME = 'workspace-state.json';
const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze(['original', 'png', 'jpg', 'webp']);

function createPodUploadSheetMiaoshouWorkspaceStateService({
  sessionStore,
  featureCenterProfileService,
  entryId = DEFAULT_ENTRY_ID,
  missingEntryMessage = '\u5999\u624b\u8868\u683c\u672c\u5730\u5de5\u4f5c\u533a\u7f13\u5b58\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u672c\u5730\u7f13\u5b58\u3002'
}) {
  const normalizedEntryId = normalizeText(entryId) || DEFAULT_ENTRY_ID;
  let cachedOwnerKey = '';
  let cachedSnapshot = null;

  function getOwner() {
    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getEntryById === 'function'
        ? featureCenterProfileService.getEntryById(normalizedEntryId)
        : null;

    if (!featureEntry) {
      throw new Error(missingEntryMessage);
    }

    return featureEntry;
  }

  function getLocalStateFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'state',
      STATE_FILE_NAME
    );
  }

  function getLegacyLocalStateFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localStateDir,
      'users',
      owner.userKey,
      STATE_FILE_NAME
    );
  }

  function buildDefaultSnapshot(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      workspace: {
        lastImportDirectoryPath: '',
        lastExportDirectoryPath: '',
        selectedTemplateId: '',
        templateName: '',
        imageUploadMode: 'original',
        imageUploadConfig: {
          storageProvider: 'tencent-cos',
          imageUploadMode: 'original',
          concurrency: 8,
          imageQuality: 90
        },
        carouselPresetMode: 'selected',
        carouselPresetRandomOrders: '',
        randomCarouselOnlyFirst: false,
        carouselPresetSelection: [],
        descriptionPresetSelection: [],
        batchAiTitleConfig: {
          aiProvider: 'volcengine',
          apiBaseUrl: '',
          model: '',
          storageProvider: 'tencent-cos',
          imageCompression: 'jpg',
          concurrency: 20,
          targetLength: 250,
          imageQuality: 84,
          prefixText: '',
          suffixText: '',
          outputLanguage: 'en',
          useCache: true,
          extraPrompt: ''
        }
      }
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

  async function ensureLocalStatePathMigrated(owner) {
    const nextFilePath = getLocalStateFilePath(owner);
    const legacyFilePath = getLegacyLocalStateFilePath(owner);

    if (nextFilePath === legacyFilePath) {
      return nextFilePath;
    }

    try {
      await fs.promises.access(nextFilePath, fs.constants.F_OK);
      return nextFilePath;
    } catch (_error) {
      // continue with legacy migration check
    }

    try {
      await fs.promises.access(legacyFilePath, fs.constants.F_OK);
    } catch (_error) {
      return nextFilePath;
    }

    const legacyPayload = await readJsonFile(legacyFilePath);

    if (legacyPayload) {
      await writeJsonFile(nextFilePath, legacyPayload);
    }

    return nextFilePath;
  }

  function cloneJsonValue(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeImageUploadMode(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return IMAGE_UPLOAD_MODE_OPTIONS.includes(normalizedValue) ? normalizedValue : 'original';
  }

  function normalizeStorageProvider(value) {
    return normalizeText(value) === 'cloudflare-r2' ? 'cloudflare-r2' : 'tencent-cos';
  }

  function normalizeAiProvider(value) {
    return normalizeText(value) || 'volcengine';
  }

  function normalizeImageCompression(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue || normalizedValue === 'smart-jpeg' || normalizedValue === 'high-quality' || normalizedValue === 'jpeg') {
      return 'jpg';
    }

    if (normalizedValue === 'original' || normalizedValue === 'png' || normalizedValue === 'jpg' || normalizedValue === 'webp') {
      return normalizedValue;
    }

    return 'jpg';
  }

  function normalizeOutputLanguage(value) {
    return normalizeText(value) === 'zh' ? 'zh' : 'en';
  }

  function normalizeBoolean(value, fallback = false) {
    if (value === true || value === false) {
      return value;
    }

    return fallback;
  }

  function normalizeInteger(value, fallback, minValue, maxValue) {
    const parsed = Number.parseInt(value, 10);
    const initialValue = Number.isFinite(parsed) ? parsed : fallback;

    return Math.max(minValue, Math.min(maxValue, initialValue));
  }

  function normalizeTextArray(value) {
    return (Array.isArray(value) ? value : [])
      .map((item) => normalizeText(item))
      .filter((item, index, items) => item && items.indexOf(item) === index);
  }

  function normalizeCarouselPresetMode(value) {
    return normalizeText(value) === 'random-first' ? 'random-first' : 'selected';
  }

  function normalizeSequenceSelection(value) {
    const values = String(value || '')
      .replace(/\r\n/g, '\n')
      .split(/[\n,;\uFF0C\u3001\uFF1B\s]+/)
      .map((item) => normalizeText(item).replace(/\D+/g, ''))
      .filter(Boolean);

    return Array.from(new Set(values)).join(',');
  }

  function normalizeWorkspacePayload(payload) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const workspaceSource =
      source.workspace && typeof source.workspace === 'object' && !Array.isArray(source.workspace)
        ? source.workspace
        : source;
    const imageUploadConfigSource =
      workspaceSource.imageUploadConfig && typeof workspaceSource.imageUploadConfig === 'object'
        ? workspaceSource.imageUploadConfig
        : workspaceSource;
    const batchAiTitleConfigSource =
      workspaceSource.batchAiTitleConfig && typeof workspaceSource.batchAiTitleConfig === 'object'
        ? workspaceSource.batchAiTitleConfig
        : workspaceSource;
    const randomCarouselOnlyFirst = normalizeBoolean(
      workspaceSource.randomCarouselOnlyFirst,
      normalizeCarouselPresetMode(
        workspaceSource.carouselPresetMode
        || workspaceSource.cachedCarouselPresetMode
      ) === 'random-first'
    );
    const imageUploadConfig = {
      storageProvider: normalizeStorageProvider(
        imageUploadConfigSource.storageProvider
        || workspaceSource.imageUploadStorageProvider
        || source.imageUploadStorageProvider
      ),
      imageUploadMode: normalizeImageUploadMode(
        imageUploadConfigSource.imageUploadMode
        || workspaceSource.imageUploadMode
        || workspaceSource.uploadImageMode
        || source.imageUploadMode
        || source.uploadImageMode
      ),
      concurrency: normalizeInteger(
        imageUploadConfigSource.concurrency
        || workspaceSource.imageUploadConcurrency
        || source.imageUploadConcurrency,
        8,
        1,
        50
      ),
      imageQuality: normalizeInteger(
        imageUploadConfigSource.imageQuality
        || workspaceSource.imageUploadQuality
        || source.imageUploadQuality,
        90,
        48,
        100
      )
    };
    const batchAiTitleConfig = {
      aiProvider: normalizeAiProvider(
        batchAiTitleConfigSource.aiProvider
        || workspaceSource.aiProvider
        || source.aiProvider
      ),
      apiBaseUrl: normalizeText(
        batchAiTitleConfigSource.apiBaseUrl
        || workspaceSource.apiBaseUrl
        || source.apiBaseUrl
      ),
      model: normalizeText(
        batchAiTitleConfigSource.model
        || workspaceSource.model
        || source.model
      ),
      storageProvider: normalizeStorageProvider(
        batchAiTitleConfigSource.storageProvider
        || workspaceSource.storageProvider
        || source.storageProvider
      ),
      imageCompression: normalizeImageCompression(
        batchAiTitleConfigSource.imageCompression
        || workspaceSource.imageCompression
        || source.imageCompression
      ),
      concurrency: normalizeInteger(
        batchAiTitleConfigSource.concurrency
        || workspaceSource.aiConcurrency
        || source.aiConcurrency,
        20,
        1,
        50
      ),
      targetLength: normalizeInteger(
        batchAiTitleConfigSource.targetLength
        || workspaceSource.targetLength
        || source.targetLength,
        250,
        30,
        300
      ),
      imageQuality: normalizeInteger(
        batchAiTitleConfigSource.imageQuality
        || workspaceSource.aiImageQuality
        || source.aiImageQuality,
        84,
        48,
        95
      ),
      prefixText: normalizeText(
        batchAiTitleConfigSource.prefixText
        || workspaceSource.prefixText
        || source.prefixText
      ),
      suffixText: normalizeText(
        batchAiTitleConfigSource.suffixText
        || workspaceSource.suffixText
        || source.suffixText
      ),
      outputLanguage: normalizeOutputLanguage(
        batchAiTitleConfigSource.outputLanguage
        || workspaceSource.outputLanguage
        || source.outputLanguage
      ),
      useCache: normalizeBoolean(
        batchAiTitleConfigSource.useCache,
        true
      ),
      extraPrompt: normalizeText(
        batchAiTitleConfigSource.extraPrompt
        || workspaceSource.extraPrompt
        || source.extraPrompt
      )
    };

    return {
      lastImportDirectoryPath: normalizeText(
        workspaceSource.lastImportDirectoryPath
        || workspaceSource.lastImportPath
        || workspaceSource.importDirectoryPath
      ),
      lastExportDirectoryPath: normalizeText(
        workspaceSource.lastExportDirectoryPath
        || workspaceSource.exportDirectoryPath
      ),
      selectedTemplateId: normalizeText(
        workspaceSource.selectedTemplateId
        || workspaceSource.templateId
      ),
      templateName: normalizeText(
        workspaceSource.templateName
        || workspaceSource.selectedTemplateName
      ),
      imageUploadMode: imageUploadConfig.imageUploadMode,
      imageUploadConfig,
      carouselPresetMode: randomCarouselOnlyFirst
        ? 'random-first'
        : normalizeCarouselPresetMode(workspaceSource.carouselPresetMode || workspaceSource.cachedCarouselPresetMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(
        workspaceSource.carouselPresetRandomOrders
        || workspaceSource.cachedCarouselPresetRandomOrders
      ),
      randomCarouselOnlyFirst,
      carouselPresetSelection: normalizeTextArray(
        workspaceSource.carouselPresetSelection
        || workspaceSource.cachedCarouselPresetSelection
      ),
      descriptionPresetSelection: normalizeTextArray(
        workspaceSource.descriptionPresetSelection
        || workspaceSource.cachedDescriptionPresetSelection
      ),
      batchAiTitleConfig
    };
  }

  function hasLegacyWorkspaceContent(record) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
    const workspaceSource =
      source.workspace && typeof source.workspace === 'object' && !Array.isArray(source.workspace)
        ? source.workspace
        : source;

    return (
      Array.isArray(workspaceSource.products)
      || (
        workspaceSource.globalProductSettings
        && typeof workspaceSource.globalProductSettings === 'object'
        && !Array.isArray(workspaceSource.globalProductSettings)
      )
      || normalizeText(workspaceSource.activeProductId)
    );
  }

  function normalizeSnapshot(record, owner) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};

    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: normalizeText(source.updatedAt),
      workspace: normalizeWorkspacePayload(source)
    };
  }

  async function loadSnapshot(owner) {
    if (!owner) {
      return buildDefaultSnapshot(null);
    }

    if (cachedSnapshot && cachedOwnerKey === owner.userKey) {
      return cachedSnapshot;
    }

    const stateFilePath = await ensureLocalStatePathMigrated(owner);
    const statePayload = await readJsonFile(stateFilePath);

    cachedOwnerKey = owner.userKey;
    cachedSnapshot = normalizeSnapshot(statePayload, owner);

    if (statePayload && hasLegacyWorkspaceContent(statePayload)) {
      await writeJsonFile(stateFilePath, cachedSnapshot);
    }

    return cachedSnapshot;
  }

  return {
    async getWorkspaceState() {
      const owner = getOwner();
      const snapshot = await loadSnapshot(owner);

      return {
        updatedAt: snapshot.updatedAt,
        workspace: cloneJsonValue(snapshot.workspace, buildDefaultSnapshot(owner).workspace),
        source: owner ? 'local_state' : 'unavailable'
      };
    },
    async saveWorkspaceState(payload) {
      const owner = getOwner();

      if (!owner) {
        return {
          updatedAt: '',
          workspace: buildDefaultSnapshot(null).workspace,
          source: 'unavailable'
        };
      }

      const nextSnapshot = {
        version: SERVICE_VERSION,
        owner: {
          userId: owner.userId,
          username: owner.username,
          userKey: owner.userKey
        },
        updatedAt: nowIso(),
        workspace: normalizeWorkspacePayload(payload)
      };

      const stateFilePath = await ensureLocalStatePathMigrated(owner);

      await writeJsonFile(stateFilePath, nextSnapshot);
      cachedOwnerKey = owner.userKey;
      cachedSnapshot = nextSnapshot;

      return {
        updatedAt: nextSnapshot.updatedAt,
        workspace: cloneJsonValue(nextSnapshot.workspace, buildDefaultSnapshot(owner).workspace),
        source: 'local_state'
      };
    }
  };
}

module.exports = {
  createPodUploadSheetMiaoshouWorkspaceStateService
};
