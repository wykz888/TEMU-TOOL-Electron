const fs = require('node:fs');
const path = require('node:path');
const { cosClient } = require('../cos/client');
const {
  buildOwnerDescriptor,
  createHash,
  createSlug,
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 2;
const DEFAULT_ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const CACHE_FILE_NAME = 'cos-image-upload-cache.json';
const TARGET_BUCKET = 'chunagtao-1251234463';
const TARGET_BUCKET_ROOT = '妙手存图';
const DEFAULT_BUCKET_REGION = 'ap-guangzhou';
const MATERIAL_SECTION_IDS = Object.freeze(['carousel', 'assets', 'preview']);
const FIELD_FILE_SECTION_ID = 'field-file';
const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze(['original', 'jpg', 'webp']);
const CONVERTIBLE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff']);
const MIN_IMAGE_SIDE_PX = 800;
const MAX_IMAGE_SIDE_PX = 2400;
const JPG_QUALITY = 90;
const WEBP_QUALITY = 88;
const JPG_FLATTEN_BACKGROUND = Object.freeze({
  r: 255,
  g: 255,
  b: 255
});
const PREPARED_UPLOAD_CACHE_DIR_NAME = 'prep';
const DEFAULT_SETTINGS = Object.freeze({
  concurrency: 8,
  retryLimit: 1,
  sliceSize: 8 * 1024 * 1024
});
const MIN_UPLOAD_ITEM_TIMEOUT_MS = 90 * 1000;
const BASE_UPLOAD_ITEM_TIMEOUT_MS = 120 * 1000;
const MAX_UPLOAD_ITEM_TIMEOUT_MS = 10 * 60 * 1000;
const UPLOAD_TIMEOUT_BYTES_PER_SECOND = 128 * 1024;

function createPodUploadSheetMiaoshouCosUploadService({
  sessionStore,
  featureCenterProfileService,
  runtimeLogger,
  entryId = DEFAULT_ENTRY_ID,
  missingEntryMessage = '\u5999\u624b\u8868\u683c\u56fe\u7247\u4e0a\u4f20\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u672c\u5730\u7f13\u5b58\u3002',
  resolveDescriptionReferences = true
}) {
  const normalizedEntryId = normalizeText(entryId) || DEFAULT_ENTRY_ID;
  let cachedOwnerKey = '';
  let cachedCacheSnapshot = null;
  const activeUploadJobs = new Map();
  const preparedFileCache = new Map();
  let sharpModule = null;
  let sharpLoadError = null;
  let sharpLoadAttempted = false;

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

  function tryGetSharpModule() {
    if (!sharpLoadAttempted) {
      sharpLoadAttempted = true;

      try {
        sharpModule = require('sharp');
      } catch (error) {
        sharpLoadError = error;
        logError('pod_upload_sheet_sharp_load_failed', error, {
          entryId: normalizedEntryId
        });
      }
    }

    return sharpModule;
  }

  function getSharpModuleForMode(imageUploadMode) {
    const sharpFactory = tryGetSharpModule();

    if (sharpFactory) {
      return sharpFactory;
    }

    const normalizedMode = normalizeImageUploadMode(imageUploadMode);
    const error = new Error(
      normalizedMode === 'original'
        ? '\u5f53\u524d\u73af\u5883\u65e0\u6cd5\u52a0\u8f7d\u56fe\u7247\u5904\u7406\u7ec4\u4ef6 sharp\uff0c\u8bf7\u5b8c\u6574\u91cd\u542f\u5e94\u7528\u540e\u91cd\u8bd5\u3002'
        : '\u5f53\u524d\u73af\u5883\u65e0\u6cd5\u52a0\u8f7d\u56fe\u7247\u5904\u7406\u7ec4\u4ef6 sharp\uff0c\u6682\u65f6\u4e0d\u80fd\u4f7f\u7528 JPG/WEBP \u8f6c\u6362\u4e0a\u4f20\uff0c\u8bf7\u5148\u5207\u6362\u4e3a\u539f\u56fe\u6a21\u5f0f\u3002'
    );

    if (sharpLoadError) {
      error.cause = sharpLoadError;
    }

    throw error;
  }

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

  function getCacheFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localCacheDir,
      'users',
      owner.userKey,
      CACHE_FILE_NAME
    );
  }

  function buildDefaultCacheSnapshot(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      bucket: TARGET_BUCKET,
      region: DEFAULT_BUCKET_REGION,
      items: {}
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

  function normalizeLocalFilePath(filePath) {
    const text = normalizeText(filePath);

    if (!text) {
      return '';
    }

    let resolvedPath = text;

    try {
      resolvedPath = path.resolve(text);
    } catch (_error) {}

    return process.platform === 'win32'
      ? resolvedPath.replace(/\//g, '\\').toLowerCase()
      : resolvedPath;
  }

  function normalizeImageUploadMode(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return IMAGE_UPLOAD_MODE_OPTIONS.includes(normalizedValue) ? normalizedValue : 'original';
  }

  function isConvertibleImagePath(filePath) {
    const extension = path.extname(normalizeText(filePath)).toLowerCase();
    return CONVERTIBLE_IMAGE_EXTENSIONS.has(extension);
  }

  function resolveEffectiveImageUploadMode(filePath, imageUploadMode) {
    const normalizedMode = normalizeImageUploadMode(imageUploadMode);
    return normalizedMode === 'original' || !isConvertibleImagePath(filePath)
      ? 'original'
      : normalizedMode;
  }

  function getCacheEntryImageUploadMode(cacheEntry) {
    return normalizeImageUploadMode(
      cacheEntry && (cacheEntry.imageUploadMode || cacheEntry.uploadMode)
    );
  }

  function canInspectImageDimensions(filePath) {
    return getContentType(filePath).startsWith('image/');
  }

  async function readImageMetadata(sharpFactory, filePath) {
    try {
      return await sharpFactory(filePath, { failOnError: false, animated: false }).metadata();
    } catch (_error) {
      return null;
    }
  }

  function assertMinimumImageDimensions(filePath, width, height) {
    if (
      Number(width) >= MIN_IMAGE_SIDE_PX
      && Number(height) >= MIN_IMAGE_SIDE_PX
    ) {
      return;
    }

    const displayName =
      normalizeText(path.basename(filePath))
      || normalizeText(filePath)
      || '\u56fe\u7247';

    throw new Error(
      `\u56fe\u7247\u5c3a\u5bf8\u4e0d\u80fd\u5c0f\u4e8e ${MIN_IMAGE_SIDE_PX}x${MIN_IMAGE_SIDE_PX}\uff1a${displayName}\uff08\u5f53\u524d ${Number(width) || 0}x${Number(height) || 0}\uff09`
    );
  }

  function getPreparedCacheRoot(owner) {
    const featureEntry = getFeatureEntry();
    const ownerKey = owner && owner.userKey ? owner.userKey : 'anonymous';

    return path.join(
      featureEntry.storageProfile.localCacheDir,
      'users',
      ownerKey,
      PREPARED_UPLOAD_CACHE_DIR_NAME
    );
  }

  async function ensureDirectory(directoryPath) {
    await fs.promises.mkdir(directoryPath, { recursive: true });
  }

  async function ensureWritableDirectoryForFile(filePath) {
    const directoryPath = path.dirname(filePath);
    await ensureDirectory(directoryPath);

    const directoryStat = await fs.promises.stat(directoryPath);

    if (!directoryStat.isDirectory()) {
      throw new Error(`Prepared upload cache path is not a directory: ${directoryPath}`);
    }

    await fs.promises.access(directoryPath, fs.constants.W_OK);
  }

  function isPreparedFileWriteMissingPathError(error) {
    const errorCode = normalizeText(error && error.code).toUpperCase();
    const errorMessage = normalizeText(error && error.message);

    if (errorCode === 'ENOENT') {
      return true;
    }

    return /no such file or directory/i.test(errorMessage);
  }

  async function safeUnlink(filePath) {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  function normalizeCacheSnapshot(record, owner) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
    const itemSource = source.items && typeof source.items === 'object' && !Array.isArray(source.items)
      ? source.items
      : {};
    const items = Object.entries(itemSource).reduce((result, [rawPath, rawEntry]) => {
      const entry = rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry) ? rawEntry : {};
      const normalizedPath = normalizeLocalFilePath(rawPath || entry.filePath);
      const url = normalizeText(entry.url);
      const key = normalizeText(entry.key);

      if (!normalizedPath || !url || !key) {
        return result;
      }

      result[normalizedPath] = {
        filePath: normalizeText(entry.filePath) || normalizedPath,
        url,
        key,
        etag: normalizeText(entry.etag),
        size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : 0,
        mtimeMs: Number.isFinite(Number(entry.mtimeMs)) ? Number(entry.mtimeMs) : 0,
        uploadedAt: normalizeText(entry.uploadedAt),
        imageUploadMode: getCacheEntryImageUploadMode(entry)
      };
      return result;
    }, {});

    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: normalizeText(source.updatedAt),
      bucket: TARGET_BUCKET,
      region: normalizeText(source.region) || DEFAULT_BUCKET_REGION,
      items
    };
  }

  async function loadCacheSnapshot(owner) {
    if (!owner) {
      return buildDefaultCacheSnapshot(null);
    }

    if (cachedCacheSnapshot && cachedOwnerKey === owner.userKey) {
      return cachedCacheSnapshot;
    }

    const cacheSnapshot = normalizeCacheSnapshot(
      await readJsonFile(getCacheFilePath(owner)),
      owner
    );

    cachedOwnerKey = owner.userKey;
    cachedCacheSnapshot = cacheSnapshot;
    return cachedCacheSnapshot;
  }

  async function persistCacheSnapshot(owner, snapshot) {
    if (!owner) {
      return buildDefaultCacheSnapshot(null);
    }

    const nextSnapshot = {
      ...snapshot,
      version: SERVICE_VERSION,
      bucket: TARGET_BUCKET,
      updatedAt: nowIso()
    };

    await writeJsonFile(getCacheFilePath(owner), nextSnapshot);
    cachedOwnerKey = owner.userKey;
    cachedCacheSnapshot = nextSnapshot;
    return nextSnapshot;
  }

  async function resolveTargetRegion() {
    return DEFAULT_BUCKET_REGION;
  }

  function getJobKey(owner, payload) {
    const runId = normalizeText(payload && payload.runId);
    return runId || (owner && owner.userKey) || '';
  }

  function buildJobLogPayload(owner, payload, extra = null) {
    const basePayload = {
      entryId: normalizedEntryId,
      userKey: owner && owner.userKey ? owner.userKey : '',
      runId: normalizeText(payload && payload.runId),
      jobKey: getJobKey(owner, payload)
    };

    if (!extra || typeof extra !== 'object') {
      return basePayload;
    }

    return {
      ...basePayload,
      ...extra
    };
  }

  function buildCandidateLogPayload(candidate, extra = null) {
    const basePayload = {
      fileName: normalizeText(candidate && candidate.fileName),
      localPath: normalizeText(candidate && candidate.localPath),
      normalizedPath: normalizeText(candidate && candidate.normalizedPath),
      productIds: Array.isArray(candidate && candidate.productIds)
        ? candidate.productIds.slice(0, 10)
        : [],
      sectionIds: Array.isArray(candidate && candidate.sectionIds)
        ? candidate.sectionIds.slice(0, 10)
        : []
    };

    if (!extra || typeof extra !== 'object') {
      return basePayload;
    }

    return {
      ...basePayload,
      ...extra
    };
  }

  function createUploadProgressSnapshot(overrides = {}) {
    return {
      runState: normalizeText(overrides.runState) || 'idle',
      runId: normalizeText(overrides.runId),
      updatedAt: normalizeText(overrides.updatedAt) || nowIso(),
      totalCount: Math.max(0, Number(overrides.totalCount) || 0),
      completedCount: Math.max(0, Number(overrides.completedCount) || 0),
      successCount: Math.max(0, Number(overrides.successCount) || 0),
      uploadedCount: Math.max(0, Number(overrides.uploadedCount) || 0),
      cachedCount: Math.max(0, Number(overrides.cachedCount) || 0),
      failedCount: Math.max(0, Number(overrides.failedCount) || 0),
      canceledCount: Math.max(0, Number(overrides.canceledCount) || 0),
      label: normalizeText(overrides.label),
      bucket: normalizeText(overrides.bucket),
      region: normalizeText(overrides.region),
      imageUploadMode: normalizeImageUploadMode(overrides.imageUploadMode)
    };
  }

  function updateJobProgress(job, overrides = null) {
    if (!job) {
      return null;
    }

    const nextProgress = createUploadProgressSnapshot({
      ...(job.progress && typeof job.progress === 'object' ? job.progress : {}),
      ...(overrides && typeof overrides === 'object' ? overrides : {}),
      updatedAt: nowIso()
    });

    job.progress = nextProgress;
    return nextProgress;
  }

  function applyJobProgressResult(job, candidate, item) {
    if (!job) {
      return null;
    }

    const currentProgress = createUploadProgressSnapshot(job.progress || {});
    const itemStatus = normalizeText(item && item.status);
    const itemSource = normalizeText(item && item.source);

    return updateJobProgress(job, {
      runState: currentProgress.runState === 'stopping' ? 'stopping' : 'running',
      completedCount: currentProgress.completedCount + 1,
      successCount: currentProgress.successCount + (itemStatus === 'success' ? 1 : 0),
      uploadedCount: currentProgress.uploadedCount + (itemStatus === 'success' && itemSource === 'uploaded' ? 1 : 0),
      cachedCount: currentProgress.cachedCount + (itemStatus === 'success' && itemSource === 'cached' ? 1 : 0),
      failedCount: currentProgress.failedCount + (itemStatus === 'failed' ? 1 : 0),
      canceledCount: currentProgress.canceledCount + (itemStatus === 'canceled' ? 1 : 0),
      label: normalizeText(item && item.fileName) || normalizeText(candidate && candidate.fileName)
    });
  }

  function createUploadJob(owner, payload) {
    const jobKey = getJobKey(owner, payload);
    const job = {
      key: jobKey,
      canceled: false,
      activeTaskIds: new Set(),
      cancelHandlers: new Set(),
      progress: createUploadProgressSnapshot({
        runState: 'pending',
        runId: normalizeText(payload && payload.runId)
      })
    };

    if (jobKey) {
      activeUploadJobs.set(jobKey, job);
    }

    log('pod_upload_sheet_cos_image_upload_job_created', buildJobLogPayload(owner, payload));

    return job;
  }

  function getUploadJob(owner, payload) {
    const jobKey = getJobKey(owner, payload);
    return jobKey ? activeUploadJobs.get(jobKey) || null : null;
  }

  function getUploadProgressSnapshot(owner, payload) {
    const job = getUploadJob(owner, payload);

    if (!job || !job.progress) {
      return {
        progress: null,
        source: 'idle',
        updatedAt: ''
      };
    }

    return {
      progress: cloneJsonValue(job.progress, null),
      source: 'memory',
      updatedAt: normalizeText(job.progress.updatedAt)
    };
  }

  function clearUploadJob(job) {
    if (!job || !job.key) {
      return;
    }

    if (activeUploadJobs.get(job.key) === job) {
      activeUploadJobs.delete(job.key);
    }

    if (job.cancelHandlers && typeof job.cancelHandlers.clear === 'function') {
      job.cancelHandlers.clear();
    }

    log('pod_upload_sheet_cos_image_upload_job_cleared', {
      entryId: normalizedEntryId,
      jobKey: job.key
    });
  }

  function formatDateFolder(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date).reduce((result, item) => {
      result[item.type] = item.value;
      return result;
    }, {});

    return `${parts.year || '1970'}-${parts.month || '01'}-${parts.day || '01'}`;
  }

  function getPublicUrlForKey(region, objectKey) {
    const encodedKey = String(objectKey || '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `https://${TARGET_BUCKET}.cos.${region}.myqcloud.com/${encodedKey}`;
  }

  function getContentType(filePath) {
    const extension = path.extname(normalizeText(filePath)).toLowerCase();

    if (extension === '.jpg' || extension === '.jpeg') {
      return 'image/jpeg';
    }

    if (extension === '.png') {
      return 'image/png';
    }

    if (extension === '.webp') {
      return 'image/webp';
    }

    if (extension === '.gif') {
      return 'image/gif';
    }

    if (extension === '.bmp') {
      return 'image/bmp';
    }

    if (extension === '.svg') {
      return 'image/svg+xml';
    }

    if (extension === '.tif' || extension === '.tiff') {
      return 'image/tiff';
    }

    if (extension === '.mp4') {
      return 'video/mp4';
    }

    if (extension === '.mov') {
      return 'video/quicktime';
    }

    if (extension === '.webm') {
      return 'video/webm';
    }

    if (extension === '.avi') {
      return 'video/x-msvideo';
    }

    if (extension === '.mkv') {
      return 'video/x-matroska';
    }

    if (extension === '.pdf') {
      return 'application/pdf';
    }

    if (extension === '.doc') {
      return 'application/msword';
    }

    if (extension === '.docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    if (extension === '.xls') {
      return 'application/vnd.ms-excel';
    }

    if (extension === '.xlsx') {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return 'application/octet-stream';
  }

  function buildPreparedUploadCacheKey(localPath, fileStat, imageUploadMode) {
    return [
      normalizeLocalFilePath(localPath),
      Number(fileStat && fileStat.size) || 0,
      Math.trunc(Number(fileStat && fileStat.mtimeMs) || 0),
      normalizeImageUploadMode(imageUploadMode)
    ].join('|');
  }

  async function prepareImageUploadFile(owner, filePath, fileStat, imageUploadMode) {
    const effectiveImageUploadMode = resolveEffectiveImageUploadMode(filePath, imageUploadMode);
    const sharpFactory = effectiveImageUploadMode === 'original'
      ? tryGetSharpModule()
      : getSharpModuleForMode(effectiveImageUploadMode);
    let width = 0;
    let height = 0;

    if (canInspectImageDimensions(filePath) && sharpFactory) {
      const metadata = await readImageMetadata(sharpFactory, filePath);
      width = Number(metadata && metadata.width) || 0;
      height = Number(metadata && metadata.height) || 0;

      if (!width || !height) {
        const displayName =
          normalizeText(path.basename(filePath))
          || normalizeText(filePath)
          || '\u56fe\u7247';

        throw new Error(`\u65e0\u6cd5\u8bfb\u53d6\u56fe\u7247\u5c3a\u5bf8\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u662f\u5426\u5b8c\u6574\uff1a${displayName}`);
      }

      assertMinimumImageDimensions(filePath, width, height);
    }

    if (effectiveImageUploadMode === 'original') {
      return {
        uploadFilePath: filePath,
        imageUploadMode: 'original'
      };
    }

    const cacheKey = buildPreparedUploadCacheKey(filePath, fileStat, effectiveImageUploadMode);
    const cachedPrepared = preparedFileCache.get(cacheKey);

    if (cachedPrepared) {
      try {
        const cachedStat = await fs.promises.stat(cachedPrepared);

        if (cachedStat && cachedStat.size > 0) {
          return {
            uploadFilePath: cachedPrepared,
            imageUploadMode: effectiveImageUploadMode
          };
        }
      } catch (_error) {}
    }

    const longestSide = Math.max(width, height);
    const targetLongestSide = longestSide > MAX_IMAGE_SIDE_PX ? MAX_IMAGE_SIDE_PX : longestSide;
    const outputExtension = effectiveImageUploadMode === 'webp' ? '.webp' : '.jpg';
    const createPreparedPipeline = () => {
      let pipeline = sharpFactory(filePath, { failOnError: false, animated: false }).rotate();

      if (targetLongestSide > 0 && targetLongestSide < longestSide) {
        pipeline = pipeline.resize({
          width: width >= height ? targetLongestSide : null,
          height: height > width ? targetLongestSide : null,
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      pipeline = pipeline.withMetadata();

      if (effectiveImageUploadMode === 'webp') {
        return pipeline.webp({
          quality: WEBP_QUALITY
        });
      }

      pipeline = pipeline.flatten({
        background: JPG_FLATTEN_BACKGROUND
      });
      return pipeline.jpeg({
        quality: JPG_QUALITY,
        mozjpeg: true
      });
    };

    const preparedRoot = getPreparedCacheRoot(owner);
    const preparedName = `${createHash(cacheKey, 24)}${outputExtension}`;
    const preparedFilePath = path.join(preparedRoot, preparedName);
    const tempPreparedFilePath = `${preparedFilePath}.${createHash(
      `${process.pid}|${Date.now()}|${Math.random()}`,
      6
    )}.tmp`;
    let pipeline = createPreparedPipeline();

    await ensureWritableDirectoryForFile(tempPreparedFilePath);
    await safeUnlink(tempPreparedFilePath).catch(() => {});
    try {
      await pipeline.toFile(tempPreparedFilePath);
    } catch (error) {
      if (!isPreparedFileWriteMissingPathError(error)) {
        throw error;
      }

      log('pod_upload_sheet_cos_image_upload_prepare_retry', {
        entryId: normalizedEntryId,
        userKey: owner && owner.userKey ? owner.userKey : '',
        filePath: normalizeText(filePath),
        preparedFilePath,
        tempPreparedFilePath,
        preparedPathLength: preparedFilePath.length,
        tempPreparedPathLength: tempPreparedFilePath.length
      });

      await ensureWritableDirectoryForFile(tempPreparedFilePath);
      await safeUnlink(tempPreparedFilePath).catch(() => {});
      pipeline = createPreparedPipeline();
      await pipeline.toFile(tempPreparedFilePath);
    }

    await ensureWritableDirectoryForFile(preparedFilePath);
    await safeUnlink(preparedFilePath).catch(() => {});
    await fs.promises.rename(tempPreparedFilePath, preparedFilePath);

    preparedFileCache.set(cacheKey, preparedFilePath);
    return {
      uploadFilePath: preparedFilePath,
      imageUploadMode: effectiveImageUploadMode
    };
  }

  function normalizeMaterialPathMap(source) {
    const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};

    return MATERIAL_SECTION_IDS.reduce((result, sectionId) => {
      const sectionSource =
        input[sectionId] && typeof input[sectionId] === 'object' && !Array.isArray(input[sectionId])
          ? input[sectionId]
          : {};

      result[sectionId] = Object.entries(sectionSource).reduce((map, [rawKey, rawValue]) => {
        const normalizedKey = normalizeText(rawKey);
        const normalizedValue = normalizeText(rawValue);

        if (normalizedKey && normalizedValue) {
          map[normalizedKey] = normalizedValue;
        }

        return map;
      }, {});
      return result;
    }, {});
  }

  function getMaterialItems(product, sectionId) {
    return product && product.materials && Array.isArray(product.materials[sectionId])
      ? product.materials[sectionId].map((item) => normalizeText(item)).filter(Boolean)
      : [];
  }

  function getSequenceSuffix(baseName) {
    const segments = normalizeText(baseName)
      .split(/[\s._-]+/)
      .map((item) => normalizeText(item))
      .filter(Boolean);

    if (segments.length < 2) {
      return '';
    }

    const suffix = segments[segments.length - 1];
    return /^\d{1,3}$/.test(suffix) ? suffix : '';
  }

  function getMaterialNameKey(itemName) {
    const baseName = normalizeText(itemName)
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .pop() || '';
    const baseWithoutExtension = baseName.replace(/\.[^.\\/]+$/, '');
    const sequenceSuffix = getSequenceSuffix(baseWithoutExtension);

    return normalizeText(sequenceSuffix || baseWithoutExtension).toLowerCase();
  }

  function getMaterialPathByName(product, sectionId, itemName) {
    const materialPathMap = normalizeMaterialPathMap(product && product.materialPathMap);
    const normalizedSectionId = normalizeText(sectionId);
    const itemKey = getMaterialNameKey(itemName);

    if (!itemKey) {
      return '';
    }

    const directPath = normalizeText(
      materialPathMap[normalizedSectionId] && materialPathMap[normalizedSectionId][itemKey]
    );

    if (directPath) {
      return directPath;
    }

    for (const sectionIdItem of MATERIAL_SECTION_IDS) {
      const fallbackPath = normalizeText(
        materialPathMap[sectionIdItem] && materialPathMap[sectionIdItem][itemKey]
      );

      if (fallbackPath) {
        return fallbackPath;
      }
    }

    return '';
  }

  function looksLikeLocalFilePath(value) {
    const text = normalizeText(value);

    if (!text) {
      return false;
    }

    if (/^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text)) {
      return true;
    }

    return /[\\/]/.test(text) && /[.][a-z0-9]{1,10}$/i.test(text);
  }

  function buildMaterialSectionSearchOrder(preferredSectionIds) {
    const preferredSections = Array.isArray(preferredSectionIds) ? preferredSectionIds : [];
    const orderedSectionIds = [];

    preferredSections.forEach((sectionId) => {
      const normalizedSectionId = normalizeText(sectionId);

      if (MATERIAL_SECTION_IDS.includes(normalizedSectionId) && !orderedSectionIds.includes(normalizedSectionId)) {
        orderedSectionIds.push(normalizedSectionId);
      }
    });

    MATERIAL_SECTION_IDS.forEach((sectionId) => {
      if (!orderedSectionIds.includes(sectionId)) {
        orderedSectionIds.push(sectionId);
      }
    });

    return orderedSectionIds;
  }

  function getMaterialPathCandidatesByReference(product, referenceText, preferredSectionIds) {
    const normalizedReference = normalizeText(referenceText);
    const candidateMap = new Map();

    if (!normalizedReference) {
      return [];
    }

    if (looksLikeLocalFilePath(normalizedReference)) {
      const normalizedPath = normalizeLocalFilePath(normalizedReference);

      if (normalizedPath) {
        candidateMap.set(normalizedPath, {
          normalizedPath,
          localPath: normalizedReference
        });
      }
    }

    const referenceKey = getMaterialNameKey(path.basename(normalizedReference) || normalizedReference);
    const materialPathMap = normalizeMaterialPathMap(product && product.materialPathMap);

    buildMaterialSectionSearchOrder(preferredSectionIds).forEach((sectionId) => {
      const localPath = normalizeText(materialPathMap[sectionId] && materialPathMap[sectionId][referenceKey]);
      const normalizedPath = normalizeLocalFilePath(localPath);

      if (!normalizedPath || candidateMap.has(normalizedPath)) {
        return;
      }

      candidateMap.set(normalizedPath, {
        normalizedPath,
        localPath
      });
    });

    return Array.from(candidateMap.values());
  }

  function resolveUploadedReferenceValue(
    product,
    referenceText,
    cacheSnapshot,
    missingFilePathSet,
    preferredSectionIds
  ) {
    const text = normalizeText(referenceText);

    if (!text || isHttpUrl(text)) {
      return {
        value: text,
        resolved: false
      };
    }

    const pathCandidates = getMaterialPathCandidatesByReference(product, text, preferredSectionIds);

    for (const candidate of pathCandidates) {
      const cacheEntry = cacheSnapshot.items[candidate.normalizedPath];

      if (cacheEntry && normalizeText(cacheEntry.url)) {
        return {
          value: cacheEntry.url,
          resolved: true
        };
      }
    }

    pathCandidates.forEach((candidate) => {
      if (candidate && candidate.normalizedPath) {
        missingFilePathSet.add(candidate.normalizedPath);
      }
    });

    return {
      value: text,
      resolved: false
    };
  }

  function resolveUploadedMultilineTextValue(
    product,
    value,
    cacheSnapshot,
    missingFilePathSet,
    preferredSectionIds
  ) {
    const sourceText = String(value || '').replace(/\r\n/g, '\n');

    if (!normalizeText(sourceText)) {
      return {
        value: '',
        resolvedCount: 0
      };
    }

    let resolvedCount = 0;
    const lines = sourceText.split('\n').map((line) => {
      const resolvedLine = resolveUploadedReferenceValue(
        product,
        line,
        cacheSnapshot,
        missingFilePathSet,
        preferredSectionIds
      );

      if (resolvedLine.resolved) {
        resolvedCount += 1;
      }

      return resolvedLine.value;
    });

    return {
      value: lines.join('\n').trim(),
      resolvedCount
    };
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(normalizeText(value));
  }

  function normalizeIncomingProducts(products) {
    return (Array.isArray(products) ? products : []).reduce((result, item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return result;
      }

      result.push({
        ...item,
        id: normalizeText(item.id),
        localName: normalizeText(item.localName),
        sourceFolder: normalizeText(item.sourceFolder),
        mainNumber: normalizeText(item.mainNumber),
        materials: MATERIAL_SECTION_IDS.reduce((materials, sectionId) => {
          materials[sectionId] = getMaterialItems(item, sectionId);
          return materials;
        }, {}),
        materialPathMap: normalizeMaterialPathMap(item.materialPathMap)
      });
      return result;
    }, []);
  }

  function appendUploadCandidate(candidateMap, product, filePath, fileName, sectionId) {
    const normalizedPath = normalizeLocalFilePath(filePath);

    if (!normalizedPath) {
      return;
    }

    if (!candidateMap.has(normalizedPath)) {
      candidateMap.set(normalizedPath, {
        id: createHash(normalizedPath, 20),
        localPath: normalizeText(filePath) || normalizedPath,
        normalizedPath,
        fileName: normalizeText(fileName) || path.basename(filePath),
        localName: normalizeText(product && product.localName),
        sourceFolder: normalizeText(product && product.sourceFolder),
        mainNumber: normalizeText(product && product.mainNumber),
        productIds: new Set(),
        sectionIds: new Set()
      });
    }

    const candidate = candidateMap.get(normalizedPath);

    if (normalizeText(product && product.id)) {
      candidate.productIds.add(normalizeText(product.id));
    }

    if (normalizeText(sectionId)) {
      candidate.sectionIds.add(normalizeText(sectionId));
    }
  }

  function collectUploadCandidates(products) {
    const candidateMap = new Map();

    products.forEach((product) => {
      MATERIAL_SECTION_IDS.forEach((sectionId) => {
        getMaterialItems(product, sectionId).forEach((itemName) => {
          if (isHttpUrl(itemName)) {
            return;
          }

          appendUploadCandidate(
            candidateMap,
            product,
            getMaterialPathByName(product, sectionId, itemName),
            itemName,
            sectionId
          );
        });
      });

      if (resolveDescriptionReferences) {
        String(product && product.description || '')
          .replace(/\r\n/g, '\n')
          .split('\n')
          .forEach((line) => {
            if (isHttpUrl(line)) {
              return;
            }

            getMaterialPathCandidatesByReference(product, line).forEach((candidate) => {
              appendUploadCandidate(
                candidateMap,
                product,
                candidate.localPath,
                path.basename(candidate.localPath || '') || line,
                'description'
              );
            });
          });
      }
    });

    return Array.from(candidateMap.values()).map((candidate) => ({
      ...candidate,
      productIds: Array.from(candidate.productIds),
      sectionIds: Array.from(candidate.sectionIds)
    }));
  }

  function normalizeFieldFilePath(value) {
    const text = normalizeText(value);

    if (!text) {
      return '';
    }

    if (
      (text.startsWith('"') && text.endsWith('"'))
      || (text.startsWith("'") && text.endsWith("'"))
    ) {
      return normalizeText(text.slice(1, -1));
    }

    return text;
  }

  function getFieldFileItems(product, fieldNames) {
    return (Array.isArray(fieldNames) ? fieldNames : []).reduce((result, fieldName) => {
      const normalizedFieldName = normalizeText(fieldName);
      const filePath = normalizeFieldFilePath(product && product[normalizedFieldName]);

      if (!normalizedFieldName || !filePath || isHttpUrl(filePath) || !looksLikeLocalFilePath(filePath)) {
        return result;
      }

      result.push({
        fieldName: normalizedFieldName,
        filePath
      });
      return result;
    }, []);
  }

  function collectFieldFileUploadCandidates(products, fieldNames) {
    const candidateMap = new Map();

    products.forEach((product) => {
      getFieldFileItems(product, fieldNames).forEach((fieldFile) => {
        appendUploadCandidate(
          candidateMap,
          product,
          fieldFile.filePath,
          path.basename(fieldFile.filePath) || fieldFile.fieldName,
          FIELD_FILE_SECTION_ID
        );
      });
    });

    return Array.from(candidateMap.values()).map((candidate) => ({
      ...candidate,
      productIds: Array.from(candidate.productIds),
      sectionIds: Array.from(candidate.sectionIds)
    }));
  }

  function getCacheUrlForLocalPath(cacheSnapshot, filePath) {
    const normalizedPath = normalizeLocalFilePath(filePath);
    const cacheEntry = normalizedPath ? cacheSnapshot.items[normalizedPath] : null;

    return normalizeText(cacheEntry && cacheEntry.url);
  }

  function isReusableCacheEntry(cacheEntry, fileStat, imageUploadMode) {
    const expectedMode = normalizeImageUploadMode(imageUploadMode);

    return Boolean(
      cacheEntry
      && normalizeText(cacheEntry.url)
      && normalizeText(cacheEntry.key)
      && getCacheEntryImageUploadMode(cacheEntry) === expectedMode
      && Number(cacheEntry.size) === Number(fileStat && fileStat.size)
      && Math.trunc(Number(cacheEntry.mtimeMs)) === Math.trunc(Number(fileStat && fileStat.mtimeMs))
    );
  }

  function isReusableCacheEntryWithoutFile(cacheEntry, imageUploadMode) {
    return Boolean(
      cacheEntry
      && normalizeText(cacheEntry.url)
      && normalizeText(cacheEntry.key)
      && getCacheEntryImageUploadMode(cacheEntry) === normalizeImageUploadMode(imageUploadMode)
    );
  }

  function buildObjectKey(candidate, fileStat) {
    const extensionFromPath = path.extname(candidate.localPath).toLowerCase();
    const extensionFromName = path.extname(candidate.fileName).toLowerCase();
    const rawExtension = extensionFromPath || extensionFromName;
    const extension = /^[.][a-z0-9]{1,10}$/.test(rawExtension)
      ? rawExtension
      : '.jpg';
    const baseName = path.basename(candidate.fileName || candidate.localPath, extension);
    const dateFolder = formatDateFolder();
    const productFolder = createSlug(
      candidate.sourceFolder || candidate.localName || candidate.mainNumber,
      'product'
    ).slice(0, 72);
    const sectionIds = Array.isArray(candidate && candidate.sectionIds)
      ? candidate.sectionIds
      : Array.from(candidate && candidate.sectionIds instanceof Set ? candidate.sectionIds : []);
    const fallbackSlug = sectionIds.includes(FIELD_FILE_SECTION_ID)
      ? 'file'
      : 'image';
    const fileSlug = createSlug(baseName, fallbackSlug).slice(0, 72);
    const uniqueHash = createHash(
      `${candidate.normalizedPath}|${Number(fileStat && fileStat.size)}|${Number(fileStat && fileStat.mtimeMs)}`,
      16
    );

    return `${TARGET_BUCKET_ROOT}/${dateFolder}/${productFolder}/${fileSlug}-${uniqueHash}${extension}`;
  }

  function buildSuccessResult(candidate, cacheEntry, source, attemptCount = 1) {
    return {
      id: candidate.id,
      status: 'success',
      source,
      fileName: candidate.fileName,
      filePath: candidate.localPath,
      url: normalizeText(cacheEntry && cacheEntry.url),
      key: normalizeText(cacheEntry && cacheEntry.key),
      error: '',
      attemptCount,
      productIds: candidate.productIds.slice(),
      sectionIds: candidate.sectionIds.slice()
    };
  }

  function buildFailedResult(candidate, error, attemptCount = 1) {
    return {
      id: candidate.id,
      status: 'failed',
      source: 'failed',
      fileName: candidate.fileName,
      filePath: candidate.localPath,
      url: '',
      key: '',
      error: normalizeText(error && error.message) || '图片上传失败。',
      attemptCount,
      productIds: candidate.productIds.slice(),
      sectionIds: candidate.sectionIds.slice()
    };
  }

  function buildCanceledResult(candidate, attemptCount = 0) {
    return {
      id: candidate.id,
      status: 'canceled',
      source: 'canceled',
      fileName: candidate.fileName,
      filePath: candidate.localPath,
      url: '',
      key: '',
      error: '任务已停止。',
      attemptCount,
      productIds: candidate.productIds.slice(),
      sectionIds: candidate.sectionIds.slice()
    };
  }

  function createUploadTimeoutError(candidate, timeoutMs) {
    const displayName =
      normalizeText(candidate && candidate.fileName)
      || normalizeText(candidate && candidate.localPath)
      || '\u56fe\u7247';
    const error = new Error(
      `\u56fe\u7247\u4e0a\u4f20\u8d85\u65f6\uff1a${displayName}\uff08\u5df2\u7b49\u5f85 ${Math.round(timeoutMs / 1000)} \u79d2\uff09`
    );
    error.code = 'POD_COS_UPLOAD_TIMEOUT';
    return error;
  }

  function getUploadItemTimeoutMs(fileSize) {
    const size = Math.max(0, Number(fileSize) || 0);
    const sizeTimeoutMs = size > 0
      ? Math.ceil(size / UPLOAD_TIMEOUT_BYTES_PER_SECOND) * 1000
      : 0;

    return Math.max(
      MIN_UPLOAD_ITEM_TIMEOUT_MS,
      Math.min(MAX_UPLOAD_ITEM_TIMEOUT_MS, BASE_UPLOAD_ITEM_TIMEOUT_MS + sizeTimeoutMs)
    );
  }

  function addJobCancelHandler(job, handler) {
    if (!job || typeof handler !== 'function') {
      return () => {};
    }

    if (job.canceled) {
      handler();
      return () => {};
    }

    if (!job.cancelHandlers || typeof job.cancelHandlers.add !== 'function') {
      job.cancelHandlers = new Set();
    }

    job.cancelHandlers.add(handler);
    return () => {
      if (job.cancelHandlers && typeof job.cancelHandlers.delete === 'function') {
        job.cancelHandlers.delete(handler);
      }
    };
  }

  function notifyJobCanceled(job) {
    if (!job || !job.cancelHandlers || typeof job.cancelHandlers.forEach !== 'function') {
      return;
    }

    Array.from(job.cancelHandlers).forEach((handler) => {
      try {
        handler();
      } catch (_error) {}
    });
  }

  function cancelCosTask(taskId) {
    const normalizedTaskId = normalizeText(taskId);

    if (!normalizedTaskId) {
      return;
    }

    try {
      cosClient.cancelTask(normalizedTaskId);
    } catch (_error) {}
  }

  function uploadCosFileWithTimeout(params, context = {}) {
    const job = context.job || null;
    const candidate = context.candidate || null;
    const timeoutMs = getUploadItemTimeoutMs(context.fileSize);
    let taskId = '';
    let completed = false;
    let timeoutTimer = null;
    let removeCancelHandler = () => {};
    let uploadPromise = null;

    function cleanup() {
      completed = true;

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }

      removeCancelHandler();
      removeCancelHandler = () => {};

      if (job && taskId) {
        job.activeTaskIds.delete(taskId);
      }
    }

    const wrappedParams = {
      ...params,
      onTaskReady(nextTaskId) {
        taskId = normalizeText(nextTaskId);

        if (completed) {
          cancelCosTask(taskId);
          return;
        }

        if (job && taskId) {
          job.activeTaskIds.add(taskId);

          if (job.canceled) {
            cancelCosTask(taskId);
          }
        }

        if (typeof params.onTaskReady === 'function') {
          params.onTaskReady(nextTaskId);
        }
      }
    };

    return new Promise((resolve, reject) => {
      function rejectIfPending(error) {
        if (completed) {
          return;
        }

        if (taskId) {
          cancelCosTask(taskId);
        }

        cleanup();
        reject(error);
      }

      removeCancelHandler = addJobCancelHandler(job, () => {
        const error = new Error('\u4efb\u52a1\u5df2\u505c\u6b62\u3002');
        error.code = 'POD_COS_UPLOAD_CANCELED';
        rejectIfPending(error);
      });

      if (completed) {
        return;
      }

      timeoutTimer = setTimeout(() => {
        rejectIfPending(createUploadTimeoutError(candidate, timeoutMs));
      }, timeoutMs);

      try {
        uploadPromise = cosClient.uploadFile(wrappedParams);
      } catch (error) {
        rejectIfPending(error);
        return;
      }

      Promise.resolve(uploadPromise)
        .then((result) => {
          if (completed) {
            return;
          }

          cleanup();
          resolve(result);
        })
        .catch((error) => {
          if (completed) {
            return;
          }

          cleanup();
          reject(error);
        });
    });
  }

  async function mapWithConcurrency(items, concurrency, worker, job) {
    const targetItems = Array.isArray(items) ? items : [];
    const results = new Array(targetItems.length);
    let cursor = 0;

    async function consume() {
      while (true) {
        if (job && job.canceled) {
          return;
        }

        const currentIndex = cursor;

        if (currentIndex >= targetItems.length) {
          return;
        }

        cursor += 1;
        results[currentIndex] = await worker(targetItems[currentIndex], currentIndex);
      }
    }

    const workerCount = Math.max(1, Math.min(concurrency, targetItems.length || 1));
    await Promise.all(Array.from({ length: workerCount }, () => consume()));
    return results;
  }

  async function uploadSingleCandidate(candidate, context) {
    const { cacheSnapshot, region, job, owner, imageUploadMode } = context;
    const effectiveImageUploadMode = resolveEffectiveImageUploadMode(
      candidate && candidate.localPath,
      imageUploadMode
    );

    if (job && job.canceled) {
      return buildCanceledResult(candidate);
    }

    let fileStat = null;

    try {
      fileStat = await fs.promises.stat(candidate.localPath);
    } catch (error) {
      const existingCacheEntry = cacheSnapshot.items[candidate.normalizedPath];

      if (isReusableCacheEntryWithoutFile(existingCacheEntry, effectiveImageUploadMode)) {
        log('pod_upload_sheet_cos_image_upload_item_reused', buildCandidateLogPayload(candidate, {
          source: 'cached',
          imageUploadMode: effectiveImageUploadMode,
          fileExists: false
        }));
        return buildSuccessResult(candidate, existingCacheEntry, 'cached');
      }

      throw new Error(`图片文件不存在：${candidate.fileName || candidate.localPath}`);
    }

    const existingCacheEntry = cacheSnapshot.items[candidate.normalizedPath];

    if (isReusableCacheEntry(existingCacheEntry, fileStat, effectiveImageUploadMode)) {
      log('pod_upload_sheet_cos_image_upload_item_reused', buildCandidateLogPayload(candidate, {
        source: 'cached',
        imageUploadMode: effectiveImageUploadMode,
        fileExists: true,
        size: Number(fileStat.size) || 0
      }));
      return buildSuccessResult(candidate, existingCacheEntry, 'cached');
    }

    const preparedUpload = await prepareImageUploadFile(
      owner,
      candidate.localPath,
      fileStat,
      effectiveImageUploadMode
    );
    const uploadFilePath = preparedUpload.uploadFilePath;
    const uploadFileStat = uploadFilePath === candidate.localPath
      ? fileStat
      : await fs.promises.stat(uploadFilePath);
    const objectKey = buildObjectKey({
      ...candidate,
      localPath: uploadFilePath,
      fileName: path.basename(uploadFilePath) || candidate.fileName
    }, uploadFileStat);

    try {
      log('pod_upload_sheet_cos_image_upload_item_started', buildCandidateLogPayload(candidate, {
        uploadFilePath,
        imageUploadMode: effectiveImageUploadMode,
        preparedImageUploadMode: normalizeImageUploadMode(preparedUpload.imageUploadMode),
        size: Number(uploadFileStat.size) || 0,
        region,
        bucket: TARGET_BUCKET,
        objectKey
      }));

      const uploadResult = await uploadCosFileWithTimeout({
        Bucket: TARGET_BUCKET,
        Region: region,
        Key: objectKey,
        FilePath: uploadFilePath,
        SliceSize: DEFAULT_SETTINGS.sliceSize,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
        ContentType: getContentType(uploadFilePath)
      }, {
        candidate,
        fileSize: Number(uploadFileStat.size) || 0,
        job
      });

      if (job && job.canceled) {
        return buildCanceledResult(candidate);
      }

      const cacheEntry = {
        filePath: candidate.localPath,
        url: normalizeText(uploadResult && uploadResult.Location)
          ? `https://${normalizeText(uploadResult.Location)}`
          : getPublicUrlForKey(region, objectKey),
        key: objectKey,
        etag: normalizeText(uploadResult && uploadResult.ETag),
        size: Number(fileStat.size) || 0,
        mtimeMs: Number(fileStat.mtimeMs) || 0,
        uploadedAt: nowIso(),
        imageUploadMode: normalizeImageUploadMode(preparedUpload.imageUploadMode)
      };

      cacheSnapshot.items[candidate.normalizedPath] = cacheEntry;
      log('pod_upload_sheet_cos_image_upload_item_completed', buildCandidateLogPayload(candidate, {
        source: 'uploaded',
        imageUploadMode: cacheEntry.imageUploadMode,
        region,
        bucket: TARGET_BUCKET,
        objectKey,
        url: cacheEntry.url,
        etag: cacheEntry.etag,
        size: cacheEntry.size
      }));
      return buildSuccessResult(candidate, cacheEntry, 'uploaded');
    } catch (error) {
      if (job && job.canceled) {
        return buildCanceledResult(candidate);
      }

      throw error;
    }
  }

  async function uploadCandidateWithRetry(candidate, context) {
    const maxAttemptCount = Math.max(1, DEFAULT_SETTINGS.retryLimit + 1);
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttemptCount; attempt += 1) {
      if (context.job && context.job.canceled) {
        return buildCanceledResult(candidate, attempt - 1);
      }

      try {
        log('pod_upload_sheet_cos_image_upload_item_attempt_started', buildCandidateLogPayload(candidate, {
          attempt,
          maxAttemptCount
        }));
        const result = await uploadSingleCandidate(candidate, context);

        if (result.status === 'success') {
          return {
            ...result,
            attemptCount: attempt
          };
        }

        return result;
      } catch (error) {
        if (context.job && context.job.canceled) {
          return buildCanceledResult(candidate, attempt - 1);
        }

        lastError = error;
        logError('pod_upload_sheet_cos_image_upload_item_attempt_failed', error, buildCandidateLogPayload(candidate, {
          attempt,
          maxAttemptCount
        }));

        if (attempt < maxAttemptCount) {
          continue;
        }
      }
    }

    logError('pod_upload_sheet_cos_image_upload_failed', lastError, {
      filePath: candidate.localPath,
      fileName: candidate.fileName
    });
    return buildFailedResult(candidate, lastError, Math.max(1, DEFAULT_SETTINGS.retryLimit + 1));
  }

  async function uploadCandidates(candidates, owner, payload) {
    const targetCandidates = Array.isArray(candidates) ? candidates : [];
    const imageUploadMode = normalizeImageUploadMode(payload && payload.imageUploadMode);

    if (!targetCandidates.length) {
      return {
        updatedAt: nowIso(),
        bucket: TARGET_BUCKET,
        region: await resolveTargetRegion(),
        canceled: false,
        totalCount: 0,
        successCount: 0,
        uploadedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        canceledCount: 0,
        items: []
      };
    }

    const existingJob = getUploadJob(owner, payload);

    if (existingJob && !existingJob.canceled) {
      throw new Error('\u5f53\u524d\u5df2\u6709\u4e0a\u4f20\u4efb\u52a1\u6b63\u5728\u6267\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u5f53\u524d\u4efb\u52a1\u3002');
    }

    const cacheSnapshot = await loadCacheSnapshot(owner);
    const region = cacheSnapshot.region || await resolveTargetRegion();
    const job = createUploadJob(owner, payload);

    try {
      updateJobProgress(job, {
        runState: 'running',
        runId: normalizeText(payload && payload.runId),
        totalCount: targetCandidates.length,
        completedCount: 0,
        successCount: 0,
        uploadedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        canceledCount: 0,
        label: '',
        bucket: TARGET_BUCKET,
        region,
        imageUploadMode
      });

      log('pod_upload_sheet_cos_image_upload_started', buildJobLogPayload(owner, payload, {
        bucket: TARGET_BUCKET,
        region,
        candidateCount: targetCandidates.length,
        imageUploadMode,
        concurrency: DEFAULT_SETTINGS.concurrency,
        retryLimit: DEFAULT_SETTINGS.retryLimit,
        sliceSize: DEFAULT_SETTINGS.sliceSize
      }));

      const rawItems = await mapWithConcurrency(
        targetCandidates,
        DEFAULT_SETTINGS.concurrency,
        async (candidate) => {
          updateJobProgress(job, {
            runState: job.canceled ? 'stopping' : 'running',
            label: normalizeText(candidate && candidate.fileName)
          });
          const item = await uploadCandidateWithRetry(candidate, {
            cacheSnapshot,
            region,
            job,
            owner,
            imageUploadMode
          });
          applyJobProgressResult(job, candidate, item);
          return item;
        },
        job
      );
      const items = targetCandidates.map((candidate, index) => rawItems[index] || buildCanceledResult(candidate));
      const uploadedCount = items.filter((item) => item && item.status === 'success' && item.source === 'uploaded').length;
      const cachedCount = items.filter((item) => item && item.status === 'success' && item.source === 'cached').length;
      const failedCount = items.filter((item) => item && item.status === 'failed').length;
      const canceledCount = items.filter((item) => item && item.status === 'canceled').length;
      const nextSnapshot = await persistCacheSnapshot(owner, {
        ...cacheSnapshot,
        region
      });

      updateJobProgress(job, {
        runState: job.canceled ? 'canceled' : 'completed',
        totalCount: items.length,
        completedCount: items.length,
        successCount: uploadedCount + cachedCount,
        uploadedCount,
        cachedCount,
        failedCount,
        canceledCount,
        bucket: TARGET_BUCKET,
        region,
        imageUploadMode
      });

      log('pod_upload_sheet_cos_image_upload_completed', buildJobLogPayload(owner, payload, {
        bucket: TARGET_BUCKET,
        region,
        totalCount: items.length,
        uploadedCount,
        cachedCount,
        failedCount,
        canceledCount,
        canceled: job.canceled
      }));

      return {
        updatedAt: nextSnapshot.updatedAt,
        bucket: TARGET_BUCKET,
        region,
        canceled: job.canceled,
        totalCount: items.length,
        successCount: uploadedCount + cachedCount,
        uploadedCount,
        cachedCount,
        failedCount,
        canceledCount,
        items
      };
    } finally {
      clearUploadJob(job);
    }
  }

  return {
    async uploadImages(payload) {
      const owner = getOwner();
      const imageUploadMode = normalizeImageUploadMode(payload && payload.imageUploadMode);

      if (!owner) {
        throw new Error('当前未登录，无法上传图片到 COS。');
      }

      const products = normalizeIncomingProducts(payload && payload.products);
      const candidates = collectUploadCandidates(products);

      if (!candidates.length) {
        return {
          updatedAt: nowIso(),
          bucket: TARGET_BUCKET,
          region: await resolveTargetRegion(),
          canceled: false,
          totalCount: 0,
          successCount: 0,
          uploadedCount: 0,
          cachedCount: 0,
          failedCount: 0,
          canceledCount: 0,
          items: []
        };
      }

      const existingJob = getUploadJob(owner, payload);

      if (existingJob && !existingJob.canceled) {
        throw new Error('当前已有图片上传任务正在执行，请先停止当前任务。');
      }

      const cacheSnapshot = await loadCacheSnapshot(owner);
      const region = cacheSnapshot.region || await resolveTargetRegion();
      const job = createUploadJob(owner, payload);

      try {
        updateJobProgress(job, {
          runState: 'running',
          runId: normalizeText(payload && payload.runId),
          totalCount: candidates.length,
          completedCount: 0,
          successCount: 0,
          uploadedCount: 0,
          cachedCount: 0,
          failedCount: 0,
          canceledCount: 0,
          label: '',
          bucket: TARGET_BUCKET,
          region,
          imageUploadMode
        });

        log('pod_upload_sheet_cos_image_upload_started', buildJobLogPayload(owner, payload, {
          bucket: TARGET_BUCKET,
          region,
          candidateCount: candidates.length,
          imageUploadMode,
          concurrency: DEFAULT_SETTINGS.concurrency,
          retryLimit: DEFAULT_SETTINGS.retryLimit,
          sliceSize: DEFAULT_SETTINGS.sliceSize
        }));

        const rawItems = await mapWithConcurrency(
          candidates,
          DEFAULT_SETTINGS.concurrency,
          async (candidate) => {
            updateJobProgress(job, {
              runState: job.canceled ? 'stopping' : 'running',
              label: normalizeText(candidate && candidate.fileName)
            });
            const item = await uploadCandidateWithRetry(candidate, {
              cacheSnapshot,
              region,
              job,
              owner,
              imageUploadMode
            });
            applyJobProgressResult(job, candidate, item);
            return item;
          },
          job
        );
        const items = candidates.map((candidate, index) => rawItems[index] || buildCanceledResult(candidate));
        const uploadedCount = items.filter((item) => item && item.status === 'success' && item.source === 'uploaded').length;
        const cachedCount = items.filter((item) => item && item.status === 'success' && item.source === 'cached').length;
        const failedCount = items.filter((item) => item && item.status === 'failed').length;
        const canceledCount = items.filter((item) => item && item.status === 'canceled').length;
        const nextSnapshot = await persistCacheSnapshot(owner, {
          ...cacheSnapshot,
          region
        });

        updateJobProgress(job, {
          runState: job.canceled ? 'canceled' : 'completed',
          totalCount: items.length,
          completedCount: items.length,
          successCount: uploadedCount + cachedCount,
          uploadedCount,
          cachedCount,
          failedCount,
          canceledCount,
          bucket: TARGET_BUCKET,
          region,
          imageUploadMode
        });

        log('pod_upload_sheet_cos_image_upload_completed', buildJobLogPayload(owner, payload, {
          bucket: TARGET_BUCKET,
          region,
          totalCount: items.length,
          uploadedCount,
          cachedCount,
          failedCount,
          canceledCount,
          canceled: job.canceled
        }));

        return {
          updatedAt: nextSnapshot.updatedAt,
          bucket: TARGET_BUCKET,
          region,
          canceled: job.canceled,
          totalCount: items.length,
          successCount: uploadedCount + cachedCount,
          uploadedCount,
          cachedCount,
          failedCount,
          canceledCount,
          items
        };
      } finally {
        clearUploadJob(job);
      }
    },
    async cancelUpload(payload) {
      const owner = getOwner();
      const job = getUploadJob(owner, payload);

      if (!job) {
        return {
          canceled: false
        };
      }

      job.canceled = true;
      notifyJobCanceled(job);
      Array.from(job.activeTaskIds).forEach((taskId) => {
        cancelCosTask(taskId);
      });
      job.activeTaskIds.clear();
      updateJobProgress(job, {
        runState: 'stopping'
      });

      log('pod_upload_sheet_cos_image_upload_canceled', buildJobLogPayload(owner, payload));

      return {
        canceled: true
      };
    },
    async getUploadProgressSnapshot(payload) {
      const owner = getOwner();

      if (!owner) {
        return {
          progress: null,
          source: 'anonymous',
          updatedAt: ''
        };
      }

      return getUploadProgressSnapshot(owner, payload);
    },
    async resolveUploadedProducts(payload) {
      const owner = getOwner();
      const products = normalizeIncomingProducts(payload && payload.products);

      if (!products.length) {
        return {
          bucket: TARGET_BUCKET,
          region: '',
          missingFilePaths: [],
          resolvedCount: 0,
          products: []
        };
      }

      if (!owner) {
        throw new Error('当前未登录，无法读取 COS 图片缓存。');
      }

      const cacheSnapshot = await loadCacheSnapshot(owner);
      const missingFilePathSet = new Set();
      let resolvedCount = 0;

      const mappedProducts = products.map((product) => {
        const nextMaterials = MATERIAL_SECTION_IDS.reduce((result, sectionId) => {
          result[sectionId] = getMaterialItems(product, sectionId).map((itemName) => {
            const resolvedItem = resolveUploadedReferenceValue(
              product,
              itemName,
              cacheSnapshot,
              missingFilePathSet,
              [sectionId]
            );

            if (resolvedItem.resolved) {
              resolvedCount += 1;
              return resolvedItem.value;
            }

            return resolvedItem.value;
          });
          return result;
        }, {});
        const resolvedDescription = resolveDescriptionReferences
          ? resolveUploadedMultilineTextValue(
            product,
            product && product.description,
            cacheSnapshot,
            missingFilePathSet
          )
          : {
            value: normalizeText(product && product.description),
            resolvedCount: 0
          };

        resolvedCount += resolvedDescription.resolvedCount;

        return {
          ...cloneJsonValue(product, product),
          materials: nextMaterials,
          description: resolvedDescription.value
        };
      });

      return {
        bucket: TARGET_BUCKET,
        region: cacheSnapshot.region,
        missingFilePaths: Array.from(missingFilePathSet),
        resolvedCount,
        products: mappedProducts
      };
    },
    async resolveFieldFileLinks(payload) {
      const owner = getOwner();
      const products = normalizeIncomingProducts(payload && payload.products);
      const fieldNames = (Array.isArray(payload && payload.fieldNames) ? payload.fieldNames : [])
        .map((fieldName) => normalizeText(fieldName))
        .filter(Boolean);

      if (!products.length || !fieldNames.length) {
        return {
          bucket: TARGET_BUCKET,
          region: '',
          missingFilePaths: [],
          resolvedCount: 0,
          uploadedCount: 0,
          cachedCount: 0,
          failedCount: 0,
          products
        };
      }

      if (!owner) {
        throw new Error('\u5f53\u524d\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4e0a\u4f20\u6587\u4ef6\u5230 COS\u3002');
      }

      const candidates = collectFieldFileUploadCandidates(products, fieldNames);
      const uploadResult = await uploadCandidates(candidates, owner, payload);
      const failedCount = Number(uploadResult && uploadResult.failedCount) || 0;
      const canceledCount = Number(uploadResult && uploadResult.canceledCount) || 0;

      if (uploadResult && uploadResult.canceled) {
        throw new Error('\u6587\u4ef6\u4e0a\u4f20\u5df2\u505c\u6b62\uff0c\u8bf7\u91cd\u65b0\u5bfc\u51fa\u3002');
      }

      if (failedCount > 0 || canceledCount > 0) {
        throw new Error(`\u6587\u4ef6\u4e0a\u4f20\u5931\u8d25 ${failedCount} \u4e2a\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u8def\u5f84\u540e\u91cd\u8bd5\u3002`);
      }

      const cacheSnapshot = await loadCacheSnapshot(owner);
      const missingFilePathSet = new Set();
      let resolvedCount = 0;

      const mappedProducts = products.map((product) => {
        const nextProduct = cloneJsonValue(product, product);

        getFieldFileItems(product, fieldNames).forEach((fieldFile) => {
          const resolvedUrl = getCacheUrlForLocalPath(cacheSnapshot, fieldFile.filePath);

          if (resolvedUrl) {
            nextProduct[fieldFile.fieldName] = resolvedUrl;
            resolvedCount += 1;
            return;
          }

          const normalizedPath = normalizeLocalFilePath(fieldFile.filePath);

          if (normalizedPath) {
            missingFilePathSet.add(normalizedPath);
          }
        });

        return nextProduct;
      });

      return {
        bucket: TARGET_BUCKET,
        region: cacheSnapshot.region || normalizeText(uploadResult && uploadResult.region),
        missingFilePaths: Array.from(missingFilePathSet),
        resolvedCount,
        uploadedCount: Number(uploadResult && uploadResult.uploadedCount) || 0,
        cachedCount: Number(uploadResult && uploadResult.cachedCount) || 0,
        failedCount,
        products: mappedProducts
      };
    }
  };
}

module.exports = {
  createPodUploadSheetMiaoshouCosUploadService
};
