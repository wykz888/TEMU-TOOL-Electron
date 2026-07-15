const fs = require('node:fs');
const path = require('node:path');
const COS = require('cos-nodejs-sdk-v5');
const { cosClient } = require('../cos/client');
const { cosConfig } = require('../cos/config');
const {
  buildOwnerDescriptor,
  createHash,
  createSlug,
  normalizeText,
  nowIso
} = require('../shopManagement/common');
const {
  createAsyncLimiter,
  mapWithConcurrency,
  normalizeBoundedInteger
} = require('./podUploadSheetMiaoshouConcurrencyUtils');

const SERVICE_VERSION = 2;
const DEFAULT_ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const CACHE_FILE_NAME = 'cos-image-upload-cache.json';
const TARGET_BUCKET = 'chunagtao-1251234463';
const DEFAULT_OBJECT_ROOT_PREFIX = 'TEMU_Resources_Data';
const DEFAULT_BUCKET_REGION = 'ap-guangzhou';
const MATERIAL_SECTION_IDS = Object.freeze(['carousel', 'assets', 'preview']);
const FIELD_FILE_SECTION_ID = 'field-file';
const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze(['original', 'png', 'jpg', 'webp']);
const CONVERTIBLE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff']);
const MIN_IMAGE_SIDE_PX = 800;
const MAX_IMAGE_SIDE_PX = 2400;
const JPG_QUALITY = 90;
const WEBP_QUALITY = 88;
const DEFAULT_IMAGE_QUALITY = 90;
const MIN_IMAGE_QUALITY = 1;
const MAX_IMAGE_QUALITY = 100;
const PNG_MAX_COMPRESSION_LEVEL = 9;
const JPG_FLATTEN_BACKGROUND = Object.freeze({
  r: 255,
  g: 255,
  b: 255
});
const PREPARED_UPLOAD_CACHE_DIR_NAME = 'prep';
const MAX_UPLOAD_CONCURRENCY = 50;
const IMAGE_PREPARATION_CONCURRENCY = 2;
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
  globalConfigService = null,
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
  const limitImagePreparation = createAsyncLimiter(IMAGE_PREPARATION_CONCURRENCY);
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

  async function loadStorageSelection() {
    if (!globalConfigService || typeof globalConfigService.getStorageSelection !== 'function') {
      return null;
    }

    try {
      return await globalConfigService.getStorageSelection();
    } catch (error) {
      logError('pod_upload_sheet_storage_selection_load_failed', error, {
        entryId: normalizedEntryId
      });
      return null;
    }
  }

  function getStorageProviders(storageSelection) {
    return storageSelection
      && storageSelection.providers
      && typeof storageSelection.providers === 'object'
      && !Array.isArray(storageSelection.providers)
        ? storageSelection.providers
        : {};
  }

  function isTencentCosConfigUsable(config) {
    return Boolean(
      config
      && config.enabled !== false
      && normalizeText(config.secretId)
      && normalizeText(config.secretKey)
      && normalizeText(config.bucket)
      && normalizeText(config.region)
    );
  }

  function isCloudflareR2ConfigUsable(config) {
    return Boolean(
      config
      && config.enabled !== false
      && normalizeText(config.accountId)
      && normalizeText(config.accessKeyId)
      && normalizeText(config.secretAccessKey)
      && normalizeText(config.bucket)
      && normalizeText(config.publicBaseUrl)
    );
  }

  function createTencentCosClient(config) {
    return new COS({
      SecretId: normalizeText(config.secretId),
      SecretKey: normalizeText(config.secretKey),
      Protocol: normalizeText(config.protocol) || 'https:',
      Timeout: 30000,
      KeepAlive: true
    });
  }

  function createTencentCosStorageContext(config) {
    return {
      storageProvider: 'tencent-cos',
      bucket: normalizeText(config.bucket),
      region: normalizeText(config.region),
      rootPrefix: normalizeObjectPrefix(config.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
      publicBaseUrl: normalizeText(config.publicBaseUrl),
      client: createTencentCosClient(config),
      usesFallbackClient: false
    };
  }

  function createFallbackTencentCosStorageContext() {
    return {
      storageProvider: 'tencent-cos',
      bucket: TARGET_BUCKET,
      region: DEFAULT_BUCKET_REGION,
      rootPrefix: normalizeObjectPrefix(DEFAULT_OBJECT_ROOT_PREFIX, DEFAULT_OBJECT_ROOT_PREFIX),
      publicBaseUrl: '',
      client: cosClient,
      usesFallbackClient: true
    };
  }

  function createCloudflareR2StorageContext(config) {
    const accountId = normalizeText(config.accountId);

    return {
      storageProvider: 'cloudflare-r2',
      bucket: normalizeText(config.bucket),
      region: 'auto',
      rootPrefix: normalizeObjectPrefix(config.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
      publicBaseUrl: normalizeRemoteUrl(config.publicBaseUrl, { allowBareDomain: true }),
      endpoint: normalizeText(config.endpoint) || `https://${accountId}.r2.cloudflarestorage.com`,
      accountId,
      accessKeyId: normalizeText(config.accessKeyId),
      secretAccessKey: normalizeText(config.secretAccessKey),
      client: null,
      usesFallbackClient: false
    };
  }

  async function resolveStorageContext(payload) {
    const uploadSettings = normalizeUploadSettings(payload);
    const storageSelection = await loadStorageSelection();
    const providers = getStorageProviders(storageSelection);
    const requestedProvider = normalizeStorageProvider(
      (payload && payload.storageProvider) || (storageSelection && storageSelection.activeProvider)
    );

    if (requestedProvider === 'cloudflare-r2') {
      const r2Config = providers.cloudflareR2 && typeof providers.cloudflareR2 === 'object'
        ? providers.cloudflareR2
        : {};

      if (!isCloudflareR2ConfigUsable(r2Config)) {
        throw new Error('\u0043\u006c\u006f\u0075\u0064\u0066\u006c\u0061\u0072\u0065\u0020\u0052\u0032 \u5b58\u50a8\u6e20\u9053\u672a\u914d\u7f6e\u5b8c\u6574\uff0c\u8bf7\u5148\u5728\u5168\u5c40\u914d\u7f6e\u4e2d\u586b\u5199\u6876\u3001\u5bc6\u94a5\u548c\u516c\u5171\u8bbf\u95ee\u57df\u540d\u3002');
      }

      return {
        ...createCloudflareR2StorageContext(r2Config),
        uploadSettings
      };
    }

    const cosProviderConfig = providers.tencentCos && typeof providers.tencentCos === 'object'
      ? providers.tencentCos
      : {};

    return {
      ...(isTencentCosConfigUsable(cosProviderConfig)
        ? createTencentCosStorageContext(cosProviderConfig)
        : createFallbackTencentCosStorageContext()),
      uploadSettings
    };
  }

  function getCacheFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'cache',
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

  function normalizeStorageProvider(value) {
    return normalizeText(value) === 'cloudflare-r2' ? 'cloudflare-r2' : 'tencent-cos';
  }

  function normalizeInteger(value, fallback, minValue, maxValue) {
    const parsed = Number.parseInt(value, 10);
    const initialValue = Number.isFinite(parsed) ? parsed : fallback;

    return Math.max(minValue, Math.min(maxValue, initialValue));
  }

  function normalizeUploadConcurrency(value) {
    return normalizeBoundedInteger(value, DEFAULT_SETTINGS.concurrency, 1, MAX_UPLOAD_CONCURRENCY);
  }

  function normalizeUploadRetryLimit(value) {
    return normalizeInteger(value, DEFAULT_SETTINGS.retryLimit, 0, 3);
  }

  function getDefaultImageQuality(imageUploadMode) {
    const normalizedMode = normalizeImageUploadMode(imageUploadMode);

    if (normalizedMode === 'webp') return WEBP_QUALITY;
    if (normalizedMode === 'jpg') return JPG_QUALITY;
    return DEFAULT_IMAGE_QUALITY;
  }

  function normalizeImageQuality(value, imageUploadMode) {
    return normalizeInteger(
      value,
      getDefaultImageQuality(imageUploadMode),
      MIN_IMAGE_QUALITY,
      MAX_IMAGE_QUALITY
    );
  }

  function shouldCompareImageQuality(imageUploadMode) {
    const normalizedMode = normalizeImageUploadMode(imageUploadMode);
    return normalizedMode === 'jpg' || normalizedMode === 'webp';
  }

  function getImageQualityCacheToken(imageUploadMode, imageQuality) {
    const normalizedMode = normalizeImageUploadMode(imageUploadMode);

    return shouldCompareImageQuality(normalizedMode)
      ? String(normalizeImageQuality(imageQuality, normalizedMode))
      : 'lossless';
  }

  function normalizeUploadSettings(payload) {
    const imageUploadMode = normalizeImageUploadMode(payload && payload.imageUploadMode);

    return {
      storageProvider: normalizeStorageProvider(payload && payload.storageProvider),
      imageUploadMode,
      imageQuality: normalizeImageQuality(payload && payload.imageQuality, imageUploadMode),
      concurrency: normalizeUploadConcurrency(payload && payload.concurrency),
      retryLimit: normalizeUploadRetryLimit(payload && payload.retryLimit),
      sliceSize: DEFAULT_SETTINGS.sliceSize
    };
  }

  function normalizeObjectPrefix(value, fallback) {
    const text = normalizeText(value) || normalizeText(fallback);

    return text.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '').replace(/\\/g, '/');
  }

  function normalizeRemoteUrl(value, options = {}) {
    const text = normalizeText(value).replace(/[\\/]+$/, '');

    if (!text) {
      return '';
    }

    if (/^https?:\/\//i.test(text)) {
      return text;
    }

    if (/^\/\//.test(text)) {
      return `https:${text}`;
    }

    if (/^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || /[\s\\]/.test(text)) {
      return '';
    }

    const domainPattern = options && options.allowBareDomain === true
      ? /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d{1,5})?(?:[/?#]|$)/i
      : /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d{1,5})?[/?#]/i;

    if (!domainPattern.test(text)) {
      return '';
    }

    return `https://${text.replace(/^\/+/, '')}`;
  }

  function joinObjectKeySegments(...segments) {
    return segments
      .map((segment) => normalizeObjectPrefix(segment, ''))
      .filter(Boolean)
      .join('/');
  }

  function getOwnerObjectPathSegment(owner) {
    return createSlug(owner && owner.userKey, 'anonymous').slice(0, 96) || 'anonymous';
  }

  function buildOwnerObjectKeyPrefix(storageContext, owner) {
    return joinObjectKeySegments(
      normalizeObjectPrefix(storageContext && storageContext.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
      normalizedEntryId,
      'users',
      getOwnerObjectPathSegment(owner)
    );
  }

  function isCacheEntryInOwnerObjectScope(cacheEntry, storageContext, owner) {
    const key = normalizeObjectPrefix(cacheEntry && cacheEntry.key, '');
    const prefix = buildOwnerObjectKeyPrefix(storageContext, owner);

    return Boolean(key && prefix && (key === prefix || key.startsWith(`${prefix}/`)));
  }

  function encodeObjectKey(objectKey) {
    return String(objectKey || '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
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
      featureEntry.storageProfile.localRootDir,
      'users',
      ownerKey,
      'cache',
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
      const url = normalizeRemoteUrl(entry.url) || normalizeText(entry.url);
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
        storageProvider: normalizeStorageProvider(entry.storageProvider || source.storageProvider),
        bucket: normalizeText(entry.bucket) || normalizeText(source.bucket) || TARGET_BUCKET,
        region: normalizeText(entry.region) || normalizeText(source.region) || DEFAULT_BUCKET_REGION,
        rootPrefix: normalizeObjectPrefix(entry.rootPrefix || source.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
        imageUploadMode: getCacheEntryImageUploadMode(entry),
        imageQuality: normalizeImageQuality(entry.imageQuality, getCacheEntryImageUploadMode(entry))
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
      bucket: normalizeText(source.bucket) || TARGET_BUCKET,
      region: normalizeText(source.region) || DEFAULT_BUCKET_REGION,
      storageProvider: normalizeStorageProvider(source.storageProvider || 'tencent-cos'),
      rootPrefix: normalizeObjectPrefix(source.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
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

    const cacheFilePath = getCacheFilePath(owner);
    const cacheSnapshot = normalizeCacheSnapshot(
      await readJsonFile(cacheFilePath),
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
      bucket: normalizeText(snapshot.bucket) || TARGET_BUCKET,
      storageProvider: normalizeStorageProvider(snapshot.storageProvider || 'tencent-cos'),
      rootPrefix: normalizeObjectPrefix(snapshot.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
      updatedAt: nowIso()
    };

    const cacheFilePath = getCacheFilePath(owner);

    await writeJsonFile(cacheFilePath, nextSnapshot);
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
      storageProvider: normalizeStorageProvider(overrides.storageProvider),
      bucket: normalizeText(overrides.bucket),
      region: normalizeText(overrides.region),
      rootPrefix: normalizeObjectPrefix(overrides.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
      imageUploadMode: normalizeImageUploadMode(overrides.imageUploadMode),
      imageQuality: normalizeImageQuality(overrides.imageQuality, overrides.imageUploadMode),
      concurrency: normalizeUploadConcurrency(overrides.concurrency)
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
      activeTaskClients: new Map(),
      activeAbortControllers: new Set(),
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

    if (job.activeTaskIds && typeof job.activeTaskIds.clear === 'function') {
      job.activeTaskIds.clear();
    }

    if (job.activeTaskClients && typeof job.activeTaskClients.clear === 'function') {
      job.activeTaskClients.clear();
    }

    if (job.activeAbortControllers && typeof job.activeAbortControllers.clear === 'function') {
      job.activeAbortControllers.clear();
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

  function buildPreparedUploadCacheKey(localPath, fileStat, imageUploadMode, imageQuality) {
    return [
      normalizeLocalFilePath(localPath),
      Number(fileStat && fileStat.size) || 0,
      Math.trunc(Number(fileStat && fileStat.mtimeMs) || 0),
      normalizeImageUploadMode(imageUploadMode),
      getImageQualityCacheToken(imageUploadMode, imageQuality)
    ].join('|');
  }

  async function prepareImageUploadFile(owner, filePath, fileStat, imageUploadMode, imageQuality) {
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

    const cacheKey = buildPreparedUploadCacheKey(filePath, fileStat, effectiveImageUploadMode, imageQuality);
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
    const outputExtension = effectiveImageUploadMode === 'webp'
      ? '.webp'
      : effectiveImageUploadMode === 'png'
        ? '.png'
        : '.jpg';
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
          quality: normalizeImageQuality(imageQuality, effectiveImageUploadMode)
        });
      }

      if (effectiveImageUploadMode === 'png') {
        return pipeline.png({
          compressionLevel: PNG_MAX_COMPRESSION_LEVEL,
          adaptiveFiltering: true,
          force: true
        });
      }

      pipeline = pipeline.flatten({
        background: JPG_FLATTEN_BACKGROUND
      });
      return pipeline.jpeg({
        quality: normalizeImageQuality(imageQuality, effectiveImageUploadMode),
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
    const remoteUrl = normalizeRemoteUrl(text);

    if (!text || remoteUrl) {
      return {
        value: remoteUrl || text,
        resolved: Boolean(remoteUrl && remoteUrl !== text)
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
    return Boolean(normalizeRemoteUrl(value));
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

  function normalizeStringList(value) {
    if (value instanceof Set) {
      return Array.from(value).map((item) => normalizeText(item)).filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeText(item)).filter(Boolean);
    }

    const text = normalizeText(value);
    return text ? [text] : [];
  }

  function normalizeIncomingUploadCandidates(candidates) {
    const candidateMap = new Map();

    (Array.isArray(candidates) ? candidates : []).forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return;
      }

      const localPath = normalizeText(item.localPath || item.filePath || item.path || item.normalizedPath);
      const normalizedPath = normalizeLocalFilePath(localPath || item.normalizedPath);

      if (!normalizedPath) {
        return;
      }

      if (!candidateMap.has(normalizedPath)) {
        candidateMap.set(normalizedPath, {
          id: normalizeText(item.id) || createHash(normalizedPath, 20),
          localPath: localPath || normalizedPath,
          normalizedPath,
          fileName: normalizeText(item.fileName || item.name) || path.basename(localPath || normalizedPath),
          localName: normalizeText(item.localName),
          sourceFolder: normalizeText(item.sourceFolder),
          mainNumber: normalizeText(item.mainNumber),
          productIds: new Set(),
          sectionIds: new Set()
        });
      }

      const candidate = candidateMap.get(normalizedPath);
      normalizeStringList(item.productIds || item.productId).forEach((productId) => {
        candidate.productIds.add(productId);
      });
      normalizeStringList(item.sectionIds || item.sectionId).forEach((sectionId) => {
        candidate.sectionIds.add(sectionId);
      });
    });

    return Array.from(candidateMap.values()).map((candidate) => ({
      ...candidate,
      productIds: Array.from(candidate.productIds),
      sectionIds: Array.from(candidate.sectionIds)
    }));
  }

  function filterRetryUploadCandidates(candidates, payload) {
    if (!payload || payload.retryFailedOnly !== true) {
      return Array.isArray(candidates) ? candidates : [];
    }

    const retryPathSet = new Set(
      (Array.isArray(payload.retryFilePaths) ? payload.retryFilePaths : [])
        .map((filePath) => normalizeLocalFilePath(filePath))
        .filter(Boolean)
    );

    if (!retryPathSet.size) {
      return [];
    }

    return (Array.isArray(candidates) ? candidates : []).filter((candidate) => {
      return retryPathSet.has(normalizeLocalFilePath(candidate && candidate.localPath))
        || retryPathSet.has(normalizeText(candidate && candidate.normalizedPath));
    });
  }

  function getCacheUrlForLocalPath(cacheSnapshot, filePath) {
    const normalizedPath = normalizeLocalFilePath(filePath);
    const cacheEntry = normalizedPath ? cacheSnapshot.items[normalizedPath] : null;

    return normalizeRemoteUrl(cacheEntry && cacheEntry.url) || normalizeText(cacheEntry && cacheEntry.url);
  }

  function isReusableCacheEntry(cacheEntry, fileStat, storageContext, owner, imageUploadMode, imageQuality) {
    const expectedMode = normalizeImageUploadMode(imageUploadMode);
    const expectedQuality = getImageQualityCacheToken(imageUploadMode, imageQuality);

    return Boolean(
      cacheEntry
      && normalizeText(cacheEntry.url)
      && normalizeText(cacheEntry.key)
      && normalizeStorageProvider(cacheEntry.storageProvider || 'tencent-cos') === normalizeStorageProvider(storageContext && storageContext.storageProvider)
      && normalizeText(cacheEntry.bucket) === normalizeText(storageContext && storageContext.bucket)
      && normalizeText(cacheEntry.rootPrefix) === normalizeObjectPrefix(storageContext && storageContext.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX)
      && isCacheEntryInOwnerObjectScope(cacheEntry, storageContext, owner)
      && getCacheEntryImageUploadMode(cacheEntry) === expectedMode
      && getImageQualityCacheToken(getCacheEntryImageUploadMode(cacheEntry), cacheEntry.imageQuality) === expectedQuality
      && Number(cacheEntry.size) === Number(fileStat && fileStat.size)
      && Math.trunc(Number(cacheEntry.mtimeMs)) === Math.trunc(Number(fileStat && fileStat.mtimeMs))
    );
  }

  function isReusableCacheEntryWithoutFile(cacheEntry, storageContext, owner, imageUploadMode, imageQuality) {
    const expectedMode = normalizeImageUploadMode(imageUploadMode);
    const expectedQuality = getImageQualityCacheToken(imageUploadMode, imageQuality);

    return Boolean(
      cacheEntry
      && normalizeText(cacheEntry.url)
      && normalizeText(cacheEntry.key)
      && normalizeStorageProvider(cacheEntry.storageProvider || 'tencent-cos') === normalizeStorageProvider(storageContext && storageContext.storageProvider)
      && normalizeText(cacheEntry.bucket) === normalizeText(storageContext && storageContext.bucket)
      && normalizeText(cacheEntry.rootPrefix) === normalizeObjectPrefix(storageContext && storageContext.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX)
      && isCacheEntryInOwnerObjectScope(cacheEntry, storageContext, owner)
      && getCacheEntryImageUploadMode(cacheEntry) === expectedMode
      && getImageQualityCacheToken(getCacheEntryImageUploadMode(cacheEntry), cacheEntry.imageQuality) === expectedQuality
    );
  }

  function buildObjectKey(candidate, fileStat, storageContext, owner, imageUploadMode, imageQuality) {
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
      [
        candidate.normalizedPath,
        Number(fileStat && fileStat.size),
        Number(fileStat && fileStat.mtimeMs),
        normalizeStorageProvider(storageContext && storageContext.storageProvider),
        normalizeText(storageContext && storageContext.bucket),
        normalizeObjectPrefix(storageContext && storageContext.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
        getOwnerObjectPathSegment(owner),
        normalizeImageUploadMode(imageUploadMode),
        getImageQualityCacheToken(imageUploadMode, imageQuality)
      ].join('|'),
      16
    );

    return joinObjectKeySegments(
      buildOwnerObjectKeyPrefix(storageContext, owner),
      dateFolder,
      productFolder,
      `${fileSlug}-${uniqueHash}${extension}`
    );
  }

  function buildSuccessResult(candidate, cacheEntry, source, attemptCount = 1) {
    return {
      id: candidate.id,
      status: 'success',
      source,
      fileName: candidate.fileName,
      filePath: candidate.localPath,
      url: normalizeRemoteUrl(cacheEntry && cacheEntry.url) || normalizeText(cacheEntry && cacheEntry.url),
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

  function cancelCosTask(client, taskId) {
    const normalizedTaskId = normalizeText(taskId);
    const uploadClient = client && typeof client.cancelTask === 'function'
      ? client
      : cosClient;

    if (!normalizedTaskId) {
      return;
    }

    try {
      uploadClient.cancelTask(normalizedTaskId);
    } catch (_error) {}
  }

  function uploadCosFileWithTimeout(params, context = {}) {
    const rawParams = params && typeof params === 'object' ? params : {};
    const { client: _client, ...uploadParams } = rawParams;
    const job = context.job || null;
    const candidate = context.candidate || null;
    const timeoutMs = getUploadItemTimeoutMs(context.fileSize);
    const uploadClient = rawParams.client && typeof rawParams.client.uploadFile === 'function'
      ? rawParams.client
      : cosClient;
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
        if (job.activeTaskClients && typeof job.activeTaskClients.delete === 'function') {
          job.activeTaskClients.delete(taskId);
        }
      }
    }

    const wrappedParams = {
      ...uploadParams,
      onTaskReady(nextTaskId) {
        taskId = normalizeText(nextTaskId);

        if (completed) {
          cancelCosTask(uploadClient, taskId);
          return;
        }

        if (job && taskId) {
          job.activeTaskIds.add(taskId);
          if (job.activeTaskClients && typeof job.activeTaskClients.set === 'function') {
            job.activeTaskClients.set(taskId, uploadClient);
          }

          if (job.canceled) {
            cancelCosTask(uploadClient, taskId);
          }
        }

        if (typeof uploadParams.onTaskReady === 'function') {
          uploadParams.onTaskReady(nextTaskId);
        }
      }
    };

    return new Promise((resolve, reject) => {
      function rejectIfPending(error) {
        if (completed) {
          return;
        }

        if (taskId) {
          cancelCosTask(uploadClient, taskId);
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
        uploadPromise = uploadClient.uploadFile(wrappedParams);
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

  function sha256Hex(value) {
    return require('node:crypto').createHash('sha256').update(value).digest('hex');
  }

  function hmacSha256(key, value) {
    return require('node:crypto').createHmac('sha256', key).update(value).digest();
  }

  function buildR2ObjectUrl(storageContext, objectKey) {
    const baseUrl = normalizeRemoteUrl(storageContext && storageContext.publicBaseUrl, { allowBareDomain: true });

    if (!baseUrl) {
      return '';
    }

    return `${baseUrl.replace(/[\\/]+$/, '')}/${encodeObjectKey(objectKey)}`;
  }

  function buildR2CanonicalUri(bucket, objectKey) {
    return `/${encodeObjectKey(bucket)}/${encodeObjectKey(objectKey)}`;
  }

  function buildR2AuthHeaders(storageContext, bucket, objectKey, bodyBuffer, contentType, cacheControl) {
    const accountId = normalizeText(storageContext && storageContext.accountId);
    const accessKeyId = normalizeText(storageContext && storageContext.accessKeyId);
    const secretAccessKey = normalizeText(storageContext && storageContext.secretAccessKey);
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(bodyBuffer);
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`
    ].join('\n') + '\n';
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      buildR2CanonicalUri(bucket, objectKey),
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');
    const signingKey = hmacSha256(
      hmacSha256(
        hmacSha256(
          hmacSha256(`AWS4${secretAccessKey}`, dateStamp),
          'auto'
        ),
        's3'
      ),
      'aws4_request'
    );
    const signature = hmacSha256(signingKey, stringToSign).toString('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      url: `https://${host}${buildR2CanonicalUri(bucket, objectKey)}`,
      headers: {
        Authorization: authorization,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Content-Type': contentType || 'application/octet-stream',
        ...(cacheControl ? { 'Cache-Control': cacheControl } : {})
      }
    };
  }

  function uploadR2FileWithTimeout(params, context = {}) {
    const rawParams = params && typeof params === 'object' ? params : {};
    const job = context.job || null;
    const candidate = context.candidate || null;
    const timeoutMs = getUploadItemTimeoutMs(context.fileSize);
    const storageContext = context.storageContext || null;
    const bodyFilePath = normalizeText(rawParams.FilePath) || normalizeText(rawParams.filePath);
    let timeoutTimer = null;
    let completed = false;
    let removeCancelHandler = () => {};
    let controller = null;

    function cleanup() {
      completed = true;

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }

      removeCancelHandler();
      removeCancelHandler = () => {};

      if (job && controller) {
        job.activeAbortControllers.delete(controller);
      }
    }

    return new Promise(async (resolve, reject) => {
      function rejectIfPending(error) {
        if (completed) {
          return;
        }

        if (controller) {
          try {
            controller.abort();
          } catch (_error) {}
        }

        cleanup();
        reject(error);
      }

      try {
        controller = new AbortController();

        if (job) {
          job.activeAbortControllers.add(controller);
        }

        removeCancelHandler = addJobCancelHandler(job, () => {
          const error = new Error('\u4efb\u52a1\u5df2\u505c\u6b62\u3002');
          error.code = 'POD_R2_UPLOAD_CANCELED';
          rejectIfPending(error);
        });

        if (completed) {
          return;
        }

        timeoutTimer = setTimeout(() => {
          const error = createUploadTimeoutError(candidate, timeoutMs);
          error.code = 'POD_R2_UPLOAD_TIMEOUT';
          rejectIfPending(error);
        }, timeoutMs);

        const bodyBuffer = await fs.promises.readFile(bodyFilePath);
        const objectKey = normalizeText(rawParams.Key || rawParams.key);
        const bucket = normalizeText(rawParams.Bucket || rawParams.bucket) || normalizeText(storageContext && storageContext.bucket);
        const contentType = normalizeText(rawParams.ContentType || rawParams.contentType) || getContentType(bodyFilePath);
        const cacheControl = normalizeText(rawParams.CacheControl || rawParams.cacheControl);
        const { url, headers } = buildR2AuthHeaders(storageContext, bucket, objectKey, bodyBuffer, contentType, cacheControl);
        const response = await fetch(url, {
          method: 'PUT',
          headers,
          body: bodyBuffer,
          signal: controller.signal
        });

        if (completed) {
          return;
        }

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          const message = responseText
            ? `R2 \u4e0a\u4f20\u5931\u8d25\uff1a${response.status} ${response.statusText} ${responseText.slice(0, 180)}`
            : `R2 \u4e0a\u4f20\u5931\u8d25\uff1a${response.status} ${response.statusText}`;
          throw new Error(message);
        }

        const etag = normalizeText(response.headers.get('etag'));

        cleanup();
        resolve({
          Location: buildR2ObjectUrl(storageContext, objectKey),
          ETag: etag,
          url: buildR2ObjectUrl(storageContext, objectKey)
        });
      } catch (error) {
        rejectIfPending(error);
      }
    });
  }

  function uploadStorageFileWithTimeout(params, context = {}) {
    const storageContext = context.storageContext || null;

    if (storageContext && storageContext.storageProvider === 'cloudflare-r2') {
      return uploadR2FileWithTimeout(params, context);
    }

    const uploadParams = {
      ...(params && typeof params === 'object' ? params : {}),
      client: storageContext && storageContext.client ? storageContext.client : cosClient
    };
    return uploadCosFileWithTimeout(uploadParams, context);
  }

  async function uploadSingleCandidate(candidate, context) {
    const {
      cacheSnapshot,
      job,
      owner,
      imageUploadMode,
      imageQuality,
      storageContext,
      uploadSettings
    } = context;
    const effectiveImageUploadMode = resolveEffectiveImageUploadMode(
      candidate && candidate.localPath,
      imageUploadMode
    );
    const effectiveImageQuality = normalizeImageQuality(imageQuality, effectiveImageUploadMode);
    const effectiveStorageContext = storageContext || createFallbackTencentCosStorageContext();
    const uploadRegion = normalizeText(effectiveStorageContext.region) || DEFAULT_BUCKET_REGION;

    if (job && job.canceled) {
      return buildCanceledResult(candidate);
    }

    let fileStat = null;

    try {
      fileStat = await fs.promises.stat(candidate.localPath);
    } catch (error) {
      const existingCacheEntry = cacheSnapshot.items[candidate.normalizedPath];

      if (isReusableCacheEntryWithoutFile(existingCacheEntry, effectiveStorageContext, owner, effectiveImageUploadMode, effectiveImageQuality)) {
        log('pod_upload_sheet_cos_image_upload_item_reused', buildCandidateLogPayload(candidate, {
          source: 'cached',
          imageUploadMode: effectiveImageUploadMode,
          imageQuality: effectiveImageQuality,
          storageProvider: effectiveStorageContext.storageProvider,
          fileExists: false
        }));
        return buildSuccessResult(candidate, existingCacheEntry, 'cached');
      }

      throw new Error(`图片文件不存在：${candidate.fileName || candidate.localPath}`);
    }

    const existingCacheEntry = cacheSnapshot.items[candidate.normalizedPath];

    if (isReusableCacheEntry(existingCacheEntry, fileStat, effectiveStorageContext, owner, effectiveImageUploadMode, effectiveImageQuality)) {
      log('pod_upload_sheet_cos_image_upload_item_reused', buildCandidateLogPayload(candidate, {
        source: 'cached',
        imageUploadMode: effectiveImageUploadMode,
        imageQuality: effectiveImageQuality,
        storageProvider: effectiveStorageContext.storageProvider,
        fileExists: true,
        size: Number(fileStat.size) || 0
      }));
      return buildSuccessResult(candidate, existingCacheEntry, 'cached');
    }

    const preparedUpload = await limitImagePreparation(
      () => prepareImageUploadFile(
        owner,
        candidate.localPath,
        fileStat,
        effectiveImageUploadMode,
        effectiveImageQuality
      ),
      {
        shouldRun: () => !job || !job.canceled
      }
    );
    const uploadFilePath = preparedUpload.uploadFilePath;
    const uploadFileStat = uploadFilePath === candidate.localPath
      ? fileStat
      : await fs.promises.stat(uploadFilePath);
    const objectKey = buildObjectKey({
      ...candidate,
      localPath: uploadFilePath,
      fileName: path.basename(uploadFilePath) || candidate.fileName
    }, uploadFileStat, effectiveStorageContext, owner, effectiveImageUploadMode, effectiveImageQuality);

    try {
      log('pod_upload_sheet_cos_image_upload_item_started', buildCandidateLogPayload(candidate, {
        uploadFilePath,
        imageUploadMode: effectiveImageUploadMode,
        imageQuality: effectiveImageQuality,
        preparedImageUploadMode: normalizeImageUploadMode(preparedUpload.imageUploadMode),
        size: Number(uploadFileStat.size) || 0,
        storageProvider: effectiveStorageContext.storageProvider,
        region: uploadRegion,
        bucket: effectiveStorageContext.bucket,
        objectKey
      }));

      const uploadResult = await uploadStorageFileWithTimeout({
        Bucket: effectiveStorageContext.bucket,
        Region: uploadRegion,
        Key: objectKey,
        FilePath: uploadFilePath,
        SliceSize: uploadSettings.sliceSize,
        ACL: effectiveStorageContext.storageProvider === 'tencent-cos' ? 'public-read' : undefined,
        CacheControl: 'public, max-age=31536000, immutable',
        ContentType: getContentType(uploadFilePath)
      }, {
        candidate,
        fileSize: Number(uploadFileStat.size) || 0,
        job,
        storageContext: effectiveStorageContext
      });

      if (job && job.canceled) {
        return buildCanceledResult(candidate);
      }

      const rawUploadedUrl = normalizeText(uploadResult && (uploadResult.url || uploadResult.Location))
        || buildR2ObjectUrl(effectiveStorageContext, objectKey)
        || getPublicUrlForKey(uploadRegion, objectKey);
      const cacheEntry = {
        filePath: candidate.localPath,
        url: normalizeRemoteUrl(rawUploadedUrl) || rawUploadedUrl,
        key: objectKey,
        etag: normalizeText(uploadResult && (uploadResult.ETag || uploadResult.etag)),
        size: Number(fileStat.size) || 0,
        mtimeMs: Number(fileStat.mtimeMs) || 0,
        uploadedAt: nowIso(),
        storageProvider: effectiveStorageContext.storageProvider,
        bucket: effectiveStorageContext.bucket,
        region: uploadRegion,
        rootPrefix: normalizeObjectPrefix(effectiveStorageContext.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
        imageUploadMode: normalizeImageUploadMode(preparedUpload.imageUploadMode),
        imageQuality: effectiveImageQuality
      };

      cacheSnapshot.items[candidate.normalizedPath] = cacheEntry;
      log('pod_upload_sheet_cos_image_upload_item_completed', buildCandidateLogPayload(candidate, {
        source: 'uploaded',
        imageUploadMode: cacheEntry.imageUploadMode,
        imageQuality: cacheEntry.imageQuality,
        storageProvider: cacheEntry.storageProvider,
        region: uploadRegion,
        bucket: effectiveStorageContext.bucket,
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
    const maxAttemptCount = Math.max(1, (context && context.uploadSettings ? context.uploadSettings.retryLimit : DEFAULT_SETTINGS.retryLimit) + 1);
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
    return buildFailedResult(candidate, lastError, Math.max(1, (context && context.uploadSettings ? context.uploadSettings.retryLimit : DEFAULT_SETTINGS.retryLimit) + 1));
  }

  async function uploadCandidates(candidates, owner, payload) {
    const targetCandidates = Array.isArray(candidates) ? candidates : [];
    const uploadSettings = normalizeUploadSettings(payload);
    const imageUploadMode = uploadSettings.imageUploadMode;
    const storageContext = await resolveStorageContext(payload);

    if (!targetCandidates.length) {
      return {
        updatedAt: nowIso(),
        bucket: normalizeText(storageContext.bucket) || TARGET_BUCKET,
        region: normalizeText(storageContext.region) || await resolveTargetRegion(),
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
    const region = normalizeText(storageContext.region) || cacheSnapshot.region || await resolveTargetRegion();
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
        storageProvider: storageContext.storageProvider,
        bucket: storageContext.bucket,
        region,
        rootPrefix: storageContext.rootPrefix,
        imageUploadMode,
        imageQuality: uploadSettings.imageQuality,
        concurrency: uploadSettings.concurrency
      });

      log('pod_upload_sheet_cos_image_upload_started', buildJobLogPayload(owner, payload, {
        storageProvider: storageContext.storageProvider,
        bucket: storageContext.bucket,
        region,
        candidateCount: targetCandidates.length,
        imageUploadMode,
        imageQuality: uploadSettings.imageQuality,
        concurrency: uploadSettings.concurrency,
        retryLimit: uploadSettings.retryLimit,
        sliceSize: uploadSettings.sliceSize
      }));

      const rawItems = await mapWithConcurrency(
        targetCandidates,
        uploadSettings.concurrency,
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
            imageUploadMode,
            imageQuality: uploadSettings.imageQuality,
            storageContext,
            uploadSettings
          });
          applyJobProgressResult(job, candidate, item);
          return item;
        },
        { job }
      );
      const items = targetCandidates.map((candidate, index) => rawItems[index] || buildCanceledResult(candidate));
      const uploadedCount = items.filter((item) => item && item.status === 'success' && item.source === 'uploaded').length;
      const cachedCount = items.filter((item) => item && item.status === 'success' && item.source === 'cached').length;
      const failedCount = items.filter((item) => item && item.status === 'failed').length;
      const canceledCount = items.filter((item) => item && item.status === 'canceled').length;
      const nextSnapshot = await persistCacheSnapshot(owner, {
        ...cacheSnapshot,
        storageProvider: storageContext.storageProvider,
        bucket: storageContext.bucket,
        region,
        rootPrefix: storageContext.rootPrefix
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
        storageProvider: storageContext.storageProvider,
        bucket: storageContext.bucket,
        region,
        rootPrefix: storageContext.rootPrefix,
        imageUploadMode,
        imageQuality: uploadSettings.imageQuality,
        concurrency: uploadSettings.concurrency
      });

      log('pod_upload_sheet_cos_image_upload_completed', buildJobLogPayload(owner, payload, {
        storageProvider: storageContext.storageProvider,
        bucket: storageContext.bucket,
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
        storageProvider: storageContext.storageProvider,
        bucket: storageContext.bucket,
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

      if (!owner) {
        throw new Error('\u5f53\u524d\u672a\u767b\u5f55\uff0c\u65e0\u6cd5\u4e0a\u4f20\u56fe\u7247\u3002');
      }

      const explicitCandidates = normalizeIncomingUploadCandidates(payload && payload.candidates);
      const products = explicitCandidates.length ? [] : normalizeIncomingProducts(payload && payload.products);
      const productCandidates = explicitCandidates.length ? [] : collectUploadCandidates(products);
      const candidates = filterRetryUploadCandidates(
        explicitCandidates.length ? explicitCandidates : productCandidates,
        payload
      );

      return uploadCandidates(candidates, owner, payload);
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
        const taskClient = job.activeTaskClients && typeof job.activeTaskClients.get === 'function'
          ? job.activeTaskClients.get(taskId)
          : null;
        cancelCosTask(taskClient, taskId);
      });
      job.activeTaskIds.clear();
      if (job.activeTaskClients && typeof job.activeTaskClients.clear === 'function') {
        job.activeTaskClients.clear();
      }
      Array.from(job.activeAbortControllers || []).forEach((controller) => {
        try {
          controller.abort();
        } catch (_error) {}
      });
      if (job.activeAbortControllers && typeof job.activeAbortControllers.clear === 'function') {
        job.activeAbortControllers.clear();
      }
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
