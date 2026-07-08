const fs = require('node:fs');
const path = require('node:path');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 3;
const DEFAULT_ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const STATE_FILE_NAME = 'workspace-state.json';
const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze(['original', 'jpg', 'webp']);

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
        imageUploadMode: 'original',
        carouselPresetMode: 'selected',
        carouselPresetRandomOrders: '',
        carouselPresetSelection: [],
        descriptionPresetSelection: []
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

    return {
      lastImportDirectoryPath: normalizeText(
        workspaceSource.lastImportDirectoryPath
        || workspaceSource.lastImportPath
        || workspaceSource.importDirectoryPath
      ),
      imageUploadMode: normalizeImageUploadMode(
        workspaceSource.imageUploadMode
        || workspaceSource.uploadImageMode
      ),
      carouselPresetMode: normalizeCarouselPresetMode(
        workspaceSource.carouselPresetMode
        || workspaceSource.cachedCarouselPresetMode
      ),
      carouselPresetRandomOrders: normalizeSequenceSelection(
        workspaceSource.carouselPresetRandomOrders
        || workspaceSource.cachedCarouselPresetRandomOrders
      ),
      carouselPresetSelection: normalizeTextArray(
        workspaceSource.carouselPresetSelection
        || workspaceSource.cachedCarouselPresetSelection
      ),
      descriptionPresetSelection: normalizeTextArray(
        workspaceSource.descriptionPresetSelection
        || workspaceSource.cachedDescriptionPresetSelection
      )
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

    const stateFilePath = getLocalStateFilePath(owner);
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

      await writeJsonFile(getLocalStateFilePath(owner), nextSnapshot);
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
