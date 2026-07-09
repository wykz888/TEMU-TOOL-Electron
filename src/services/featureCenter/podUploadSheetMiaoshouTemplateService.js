const fs = require('node:fs');
const path = require('node:path');
const {
  buildOwnerDescriptor
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const STATE_FILE_NAME = 'template-sync-state.json';
const TEMPLATE_CACHE_DIRECTORY = 'templates';

const DEFAULT_FEATURE_ID = 'pod-upload-sheet-miaoshou';
const DEFAULT_TEMPLATE_DEFINITIONS = Object.freeze([
  {
    id: 'fashion',
    title: '服饰类模板',
    fileName: '妙手Temu导入模板-服饰类模板.xlsx',
    url: 'https://chunagtao-1251234463.cos.ap-guangzhou.myqcloud.com/POD%E8%A1%A8%E6%A0%BC%E4%B8%8A%E8%B4%A7%E6%A8%A1%E6%9D%BF/%E5%A6%99%E6%89%8BTemu%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF-%E6%9C%8D%E9%A5%B0%E7%B1%BB%E6%A8%A1%E6%9D%BF.xlsx'
  },
  {
    id: 'non-fashion',
    title: '非服饰类模板',
    fileName: '妙手Temu导入模板-非服饰类模板.xlsx',
    url: 'https://chunagtao-1251234463.cos.ap-guangzhou.myqcloud.com/POD%E8%A1%A8%E6%A0%BC%E4%B8%8A%E8%B4%A7%E6%A8%A1%E6%9D%BF/%E5%A6%99%E6%89%8BTemu%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF-%E9%9D%9E%E6%9C%8D%E9%A5%B0%E7%B1%BB%E6%A8%A1%E6%9D%BF.xlsx'
  }
]);

function createPodUploadSheetMiaoshouTemplateService({
  sessionStore,
  featureCenterProfileService,
  runtimeLogger,
  featureId = DEFAULT_FEATURE_ID,
  templateDefinitions = DEFAULT_TEMPLATE_DEFINITIONS,
  missingFeatureMessage = 'POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248) \u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u540c\u6b65\u6a21\u677f\u3002'
}) {
  const normalizedFeatureId = normalizeText(featureId) || DEFAULT_FEATURE_ID;
  const normalizedTemplateDefinitions = Object.freeze(
    (Array.isArray(templateDefinitions) && templateDefinitions.length
      ? templateDefinitions
      : DEFAULT_TEMPLATE_DEFINITIONS
    ).map((entry) => ({
      id: normalizeText(entry && entry.id),
      title: normalizeText(entry && entry.title),
      fileName: normalizeText(entry && entry.fileName),
      url: normalizeText(entry && entry.url)
    })).filter((entry) => entry.id && entry.fileName && entry.url)
  );
  let cachedSnapshot = {
    updatedAt: '',
    templates: normalizedTemplateDefinitions.map((entry) => ({
      id: entry.id,
      title: entry.title,
      fileName: entry.fileName,
      url: entry.url,
      localFilePath: '',
      exists: false,
      syncedAt: '',
      etag: '',
      lastModified: '',
      contentLength: 0,
      errorMessage: ''
    }))
  };
  let cachedOwnerKey = '';
  let syncPromise = null;
  let syncPromiseOwnerKey = '';

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function getOwner() {
    try {
      return sessionStore && typeof sessionStore.getSession === 'function'
        ? buildOwnerDescriptor(sessionStore.getSession())
        : null;
    } catch (_error) {
      return null;
    }
  }

  function resolveOwnerKey(owner) {
    return owner && owner.userKey ? owner.userKey : 'local';
  }

  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getFeatureById === 'function'
        ? featureCenterProfileService.getFeatureById(normalizedFeatureId)
        : null;

    if (!featureEntry) {
      throw new Error(missingFeatureMessage);
    }

    return featureEntry;
  }

  function getTemplateCacheDirectoryPath(owner) {
    const featureEntry = getFeatureEntry();
    const ownerKey = resolveOwnerKey(owner);

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      ownerKey,
      'cache',
      TEMPLATE_CACHE_DIRECTORY
    );
  }

  function getLegacyTemplateCacheDirectoryPath() {
    const featureEntry = getFeatureEntry();

    return path.join(featureEntry.storageProfile.localCacheDir, TEMPLATE_CACHE_DIRECTORY);
  }

  function getStateFilePath(owner) {
    const featureEntry = getFeatureEntry();
    const ownerKey = resolveOwnerKey(owner);

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      ownerKey,
      'state',
      STATE_FILE_NAME
    );
  }

  function getLegacyStateFilePath() {
    const featureEntry = getFeatureEntry();

    return path.join(featureEntry.storageProfile.localStateDir, STATE_FILE_NAME);
  }

  function getTemplateDefinitionById(templateId) {
    return normalizedTemplateDefinitions.find((entry) => entry.id === normalizeText(templateId)) || null;
  }

  function getTemplateLocalFilePathForOwner(owner, templateId) {
    const templateEntry = getTemplateDefinitionById(templateId);

    if (!templateEntry) {
      return '';
    }

    return path.join(
      getTemplateCacheDirectoryPath(owner),
      `${templateEntry.id}${path.extname(templateEntry.fileName) || '.xlsx'}`
    );
  }

  async function pathExists(filePath) {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (_error) {
      return false;
    }
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

  async function writeBufferFile(filePath, buffer) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, buffer);
    await fs.promises.rename(tempFilePath, filePath);
  }

  async function migrateLegacyTemplateFiles(owner) {
    const legacyDirectoryPath = getLegacyTemplateCacheDirectoryPath();
    const nextDirectoryPath = getTemplateCacheDirectoryPath(owner);

    if (legacyDirectoryPath === nextDirectoryPath) {
      return;
    }

    if (!(await pathExists(legacyDirectoryPath))) {
      return;
    }

    await fs.promises.mkdir(nextDirectoryPath, { recursive: true });

    for (const templateEntry of normalizedTemplateDefinitions) {
      const fileName = `${templateEntry.id}${path.extname(templateEntry.fileName) || '.xlsx'}`;
      const legacyFilePath = path.join(legacyDirectoryPath, fileName);
      const nextFilePath = path.join(nextDirectoryPath, fileName);

      if (!(await pathExists(legacyFilePath)) || (await pathExists(nextFilePath))) {
        continue;
      }

      await fs.promises.copyFile(legacyFilePath, nextFilePath).catch(() => {});
    }
  }

  async function ensureLocalStoragePathMigrated(owner) {
    const nextStateFilePath = getStateFilePath(owner);
    const legacyStateFilePath = getLegacyStateFilePath();

    if (!(await pathExists(nextStateFilePath)) && (await pathExists(legacyStateFilePath))) {
      const legacyPayload = await readJsonFile(legacyStateFilePath);

      if (legacyPayload) {
        await writeJsonFile(nextStateFilePath, legacyPayload);
      }
    }

    await migrateLegacyTemplateFiles(owner);
    return nextStateFilePath;
  }

  async function fileExists(filePath) {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function downloadTemplateBuffer(url) {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`模板下载失败，HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      headers: {
        etag: normalizeText(response.headers.get('etag')),
        lastModified: normalizeText(response.headers.get('last-modified')),
        contentLength: Number.parseInt(response.headers.get('content-length'), 10) || 0,
        contentType: normalizeText(response.headers.get('content-type'))
      }
    };
  }

  async function buildSnapshot(statePayload = null, owner = null) {
    const normalizedStatePayload =
      statePayload && typeof statePayload === 'object' && !Array.isArray(statePayload)
        ? statePayload
        : {};
    const stateTemplates =
      normalizedStatePayload.templates
      && typeof normalizedStatePayload.templates === 'object'
      && !Array.isArray(normalizedStatePayload.templates)
        ? normalizedStatePayload.templates
        : {};

    const templates = await Promise.all(
      normalizedTemplateDefinitions.map(async (templateEntry) => {
        const localFilePath = getTemplateLocalFilePathForOwner(owner, templateEntry.id);
        const stateEntry =
          stateTemplates[templateEntry.id]
          && typeof stateTemplates[templateEntry.id] === 'object'
            ? stateTemplates[templateEntry.id]
            : {};

        return {
          id: templateEntry.id,
          title: templateEntry.title,
          fileName: templateEntry.fileName,
          url: templateEntry.url,
          localFilePath,
          exists: await fileExists(localFilePath),
          syncedAt: normalizeText(stateEntry.syncedAt),
          etag: normalizeText(stateEntry.etag),
          lastModified: normalizeText(stateEntry.lastModified),
          contentLength: Number.parseInt(stateEntry.contentLength, 10) || 0,
          errorMessage: normalizeText(stateEntry.errorMessage)
        };
      })
    );

    return {
      updatedAt: normalizeText(normalizedStatePayload.updatedAt),
      templates
    };
  }

  async function hydrateSnapshotFromDisk() {
    const owner = getOwner();
    const ownerKey = resolveOwnerKey(owner);
    const stateFilePath = await ensureLocalStoragePathMigrated(owner);
    const statePayload = await readJsonFile(stateFilePath).catch(() => null);

    cachedOwnerKey = ownerKey;
    cachedSnapshot = await buildSnapshot(statePayload, owner);
    return cachedSnapshot;
  }

  async function syncTemplates(owner = null) {
    const resolvedOwner = owner || getOwner();
    const stateFilePath = await ensureLocalStoragePathMigrated(resolvedOwner);
    const previousStatePayload = await readJsonFile(stateFilePath).catch(() => null);
    const previousTemplates =
      previousStatePayload
      && previousStatePayload.templates
      && typeof previousStatePayload.templates === 'object'
      && !Array.isArray(previousStatePayload.templates)
        ? previousStatePayload.templates
        : {};
    const nextStatePayload = {
      version: SERVICE_VERSION,
      updatedAt: new Date().toISOString(),
      templates: {}
    };

    log('pod_upload_sheet_template_sync_started', {
      templateCount: normalizedTemplateDefinitions.length
    });

    for (const templateEntry of normalizedTemplateDefinitions) {
      const localFilePath = getTemplateLocalFilePathForOwner(resolvedOwner, templateEntry.id);
      const previousEntry =
        previousTemplates[templateEntry.id]
        && typeof previousTemplates[templateEntry.id] === 'object'
          ? previousTemplates[templateEntry.id]
          : {};

      try {
        const downloadResult = await downloadTemplateBuffer(templateEntry.url);

        await writeBufferFile(localFilePath, downloadResult.buffer);

        nextStatePayload.templates[templateEntry.id] = {
          id: templateEntry.id,
          title: templateEntry.title,
          fileName: templateEntry.fileName,
          syncedAt: new Date().toISOString(),
          etag: normalizeText(downloadResult.headers.etag),
          lastModified: normalizeText(downloadResult.headers.lastModified),
          contentLength: Number.parseInt(downloadResult.headers.contentLength, 10) || downloadResult.buffer.length,
          contentType: normalizeText(downloadResult.headers.contentType),
          errorMessage: ''
        };

        log('pod_upload_sheet_template_synced', {
          templateId: templateEntry.id,
          title: templateEntry.title,
          fileName: templateEntry.fileName,
          localFilePath,
          contentLength: nextStatePayload.templates[templateEntry.id].contentLength
        });
      } catch (error) {
        nextStatePayload.templates[templateEntry.id] = {
          ...previousEntry,
          id: templateEntry.id,
          title: templateEntry.title,
          fileName: templateEntry.fileName,
          errorMessage: normalizeText(error && error.message) || '模板同步失败'
        };

        logError('pod_upload_sheet_template_sync_failed', error, {
          templateId: templateEntry.id,
          title: templateEntry.title,
          fileName: templateEntry.fileName,
          localFilePath
        });
      }
    }

    await writeJsonFile(stateFilePath, nextStatePayload);
    cachedOwnerKey = resolveOwnerKey(resolvedOwner);
    cachedSnapshot = await buildSnapshot(nextStatePayload, resolvedOwner);
    return cachedSnapshot;
  }

  function runSync(owner = null) {
    const resolvedOwner = owner || getOwner();
    const ownerKey = resolveOwnerKey(resolvedOwner);

    if (syncPromise && syncPromiseOwnerKey === ownerKey) {
      return syncPromise;
    }

    const currentPromise = syncTemplates(resolvedOwner).finally(() => {
      if (syncPromise === currentPromise) {
        syncPromise = null;
        syncPromiseOwnerKey = '';
      }
    });

    syncPromise = currentPromise;
    syncPromiseOwnerKey = ownerKey;

    return syncPromise;
  }

  return {
    async init() {
      await hydrateSnapshotFromDisk().catch(() => {});
      return runSync(getOwner());
    },
    async syncNow() {
      await hydrateSnapshotFromDisk().catch(() => {});
      return runSync(getOwner());
    },
    async getSnapshot() {
      const ownerKey = resolveOwnerKey(getOwner());

      if (
        !cachedSnapshot
        || !Array.isArray(cachedSnapshot.templates)
        || cachedOwnerKey !== ownerKey
      ) {
        await hydrateSnapshotFromDisk();
      }

      return cachedSnapshot;
    },
    getTemplateLocalFilePath(templateId) {
      return getTemplateLocalFilePathForOwner(getOwner(), templateId);
    },
    getTemplateDefinitions() {
      return normalizedTemplateDefinitions.slice();
    }
  };
}

module.exports = {
  DEFAULT_TEMPLATE_DEFINITIONS,
  createPodUploadSheetMiaoshouTemplateService
};
