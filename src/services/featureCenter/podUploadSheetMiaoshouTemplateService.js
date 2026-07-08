const fs = require('node:fs');
const path = require('node:path');

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
  let syncPromise = null;

  function normalizeText(value) {
    return String(value || '').trim();
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

  function getTemplateCacheDirectoryPath() {
    const featureEntry = getFeatureEntry();

    return path.join(featureEntry.storageProfile.localCacheDir, TEMPLATE_CACHE_DIRECTORY);
  }

  function getStateFilePath() {
    const featureEntry = getFeatureEntry();

    return path.join(featureEntry.storageProfile.localStateDir, STATE_FILE_NAME);
  }

  function getTemplateDefinitionById(templateId) {
    return normalizedTemplateDefinitions.find((entry) => entry.id === normalizeText(templateId)) || null;
  }

  function getTemplateLocalFilePath(templateId) {
    const templateEntry = getTemplateDefinitionById(templateId);

    if (!templateEntry) {
      return '';
    }

    return path.join(
      getTemplateCacheDirectoryPath(),
      `${templateEntry.id}${path.extname(templateEntry.fileName) || '.xlsx'}`
    );
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

  async function buildSnapshot(statePayload = null) {
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
        const localFilePath = getTemplateLocalFilePath(templateEntry.id);
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
    const statePayload = await readJsonFile(getStateFilePath()).catch(() => null);
    cachedSnapshot = await buildSnapshot(statePayload);
    return cachedSnapshot;
  }

  async function syncTemplates() {
    const stateFilePath = getStateFilePath();
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
      const localFilePath = getTemplateLocalFilePath(templateEntry.id);
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
    cachedSnapshot = await buildSnapshot(nextStatePayload);
    return cachedSnapshot;
  }

  function runSync() {
    if (syncPromise) {
      return syncPromise;
    }

    syncPromise = syncTemplates().finally(() => {
      syncPromise = null;
    });

    return syncPromise;
  }

  return {
    async init() {
      await hydrateSnapshotFromDisk().catch(() => {});
      return runSync();
    },
    async syncNow() {
      await hydrateSnapshotFromDisk().catch(() => {});
      return runSync();
    },
    async getSnapshot() {
      if (!cachedSnapshot || !Array.isArray(cachedSnapshot.templates)) {
        await hydrateSnapshotFromDisk();
      }

      return cachedSnapshot;
    },
    getTemplateLocalFilePath,
    getTemplateDefinitions() {
      return normalizedTemplateDefinitions.slice();
    }
  };
}

module.exports = {
  DEFAULT_TEMPLATE_DEFINITIONS,
  createPodUploadSheetMiaoshouTemplateService
};
