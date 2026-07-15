const fs = require('node:fs');
const path = require('node:path');
const { nativeImage } = require('electron');
const sharp = require('sharp');
const { cosClient } = require('../cos/client');
const {
  buildOwnerDescriptor,
  createHash,
  createSlug,
  normalizeText,
  nowIso
} = require('../shopManagement/common');
const {
  DEFAULT_AI_TITLE_CONFIG
} = require('./podUploadSheetMiaoshouAiTitleConfigService');
const {
  createPodUploadSheetMiaoshouAiTitleResultCacheStore
} = require('./podUploadSheetMiaoshouAiTitleResultCacheStore');
const {
  createAsyncLimiter,
  mapWithConcurrency,
  normalizeBoundedInteger
} = require('./podUploadSheetMiaoshouConcurrencyUtils');

const SERVICE_VERSION = 1;
const ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const UNIVERSAL_ENTRY_ID = 'pod-upload-sheet-miaoshou-universal-table';
const SETTINGS_FILE_NAME = 'ai-title-settings.json';
const REQUEST_TIMEOUT_MS = 90000;
const TITLE_MAX_LENGTH = 255;
const DEFAULT_TARGET_TITLE_LENGTH = 250;
const DEFAULT_OUTPUT_LANGUAGE = 'en';
const MAX_AI_TITLE_CONCURRENCY = 50;
const AI_IMAGE_PROCESSING_CONCURRENCY = 2;
const AI_INPUT_IMAGE_BUCKET = 'chunagtao-1251234463';
const AI_INPUT_IMAGE_REGION = 'ap-guangzhou';
const AI_INPUT_IMAGE_ROOT = '\u5999\u624bAI\u8bc6\u56fe';
const AI_INPUT_IMAGE_FORMATS = Object.freeze(['original', 'png', 'jpg', 'webp']);
const AI_INPUT_IMAGE_SOURCE_EXTENSIONS = Object.freeze({
  '.jpg': { extension: '.jpg', mimeType: 'image/jpeg' },
  '.jpeg': { extension: '.jpg', mimeType: 'image/jpeg' },
  '.png': { extension: '.png', mimeType: 'image/png' },
  '.webp': { extension: '.webp', mimeType: 'image/webp' }
});
const DEFAULT_SETTINGS = Object.freeze({
  apiBaseUrl: DEFAULT_AI_TITLE_CONFIG.apiBaseUrl,
  apiKey: '',
  apiKeys: DEFAULT_AI_TITLE_CONFIG.apiKeys.slice(),
  model: DEFAULT_AI_TITLE_CONFIG.model,
  temperature: 0.2,
  maxTokens: 260,
  concurrency: 20,
  retryLimit: 2,
  minImageBytes: 300 * 1024,
  maxImageBytes: 800 * 1024
});
const MODEL_ALIASES = Object.freeze({
  'doubao-seed-1-6-251015': 'doubao-seed-2-0-mini-260428',
  'doubao-seed-1-6-lite-251015': 'doubao-seed-2-0-mini-260428',
  'doubao-seed-1-6-lite': 'doubao-seed-2-0-mini-260428'
});
const IMAGE_MAX_DIMENSIONS = Object.freeze([1680, 1440, 1280, 1120, 960, 840, 760, 680, 620, 560]);
const IMAGE_JPEG_QUALITIES = Object.freeze([84, 78, 72, 66, 60, 54, 48, 42]);
const PRODUCT_TYPE_HINTS = Object.freeze({
  '11804': '其他卫浴毛巾',
  '11805': '大浴巾',
  '11809': '沙滩毛巾'
});

function createPodUploadSheetMiaoshouAiTitleService({
  sessionStore,
  featureCenterProfileService,
  aiTitleConfigService,
  runtimeLogger,
  emitProgress
}) {
  let cachedOwnerKey = '';
  let cachedSettings = null;
  const activeGenerationJobs = new Map();
  const uploadedAiInputImageCache = new Map();
  const limitImageProcessing = createAsyncLimiter(AI_IMAGE_PROCESSING_CONCURRENCY);
  const aiTitleResultCacheStore = createPodUploadSheetMiaoshouAiTitleResultCacheStore({
    featureCenterProfileService,
    fallbackEntryId: ENTRY_ID,
    runtimeLogger
  });

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
        ? featureCenterProfileService.getEntryById(ENTRY_ID)
        : null;

    if (!featureEntry) {
      throw new Error('妙手表格 AI 标题服务未注册，无法读取本地配置。');
    }

    return featureEntry;
  }

  function getResolvedEntryId(value) {
    const normalizedEntryId = normalizeText(value);

    if (
      normalizedEntryId === ENTRY_ID
      || normalizedEntryId === UNIVERSAL_ENTRY_ID
    ) {
      return normalizedEntryId;
    }

    return ENTRY_ID;
  }

  function getLengthControlLanguage(_entryId, outputLanguage) {
    return normalizeOutputLanguage(outputLanguage, DEFAULT_OUTPUT_LANGUAGE);
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

  function getPublicUrlForAiInputKey(objectKey) {
    const encodedKey = String(objectKey || '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `https://${AI_INPUT_IMAGE_BUCKET}.cos.${AI_INPUT_IMAGE_REGION}.myqcloud.com/${encodedKey}`;
  }

  function getJobKey(owner, payload) {
    return normalizeText(payload && payload.runId) || (owner && owner.userKey ? owner.userKey : '');
  }

  function createCanceledError(message = 'AI 标题任务已停止。') {
    const error = new Error(message);
    error.code = 'AI_TITLE_JOB_CANCELED';
    return error;
  }

  function isCanceledError(error) {
    return Boolean(
      error
      && (
        error.code === 'AI_TITLE_JOB_CANCELED'
        || error.name === 'AbortError'
      )
    );
  }

  function createGenerationJob(owner, payload) {
    const jobKey = getJobKey(owner, payload);
    const nextJob = {
      key: jobKey,
      canceled: false,
      apiKeyCursor: 0,
      activeControllers: new Set()
    };

    if (jobKey) {
      activeGenerationJobs.set(jobKey, nextJob);
    }

    return nextJob;
  }

  function getGenerationJob(owner, payload) {
    const jobKey = getJobKey(owner, payload);
    return jobKey ? activeGenerationJobs.get(jobKey) || null : null;
  }

  function clearGenerationJob(job) {
    if (!job || !job.key) {
      return;
    }

    if (activeGenerationJobs.get(job.key) === job) {
      activeGenerationJobs.delete(job.key);
    }
  }

  function dispatchProgress(payload, localEmitProgress) {
    const progressEmitter = typeof localEmitProgress === 'function' ? localEmitProgress : emitProgress;

    if (typeof progressEmitter !== 'function' || !payload || typeof payload !== 'object') {
      return;
    }

    try {
      progressEmitter(payload);
    } catch (error) {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError('pod_upload_sheet_ai_title_progress_emit_failed', error);
      }
    }
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

  function normalizeInteger(value, fallback, minValue = 0, maxValue = Number.MAX_SAFE_INTEGER) {
    return normalizeBoundedInteger(value, fallback, minValue, maxValue);
  }

  function normalizeDecimal(value, fallback, minValue = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= minValue ? parsed : fallback;
  }

  function normalizeModelSetting(model) {
    const normalizedModel = normalizeText(model);

    return normalizedModel ? MODEL_ALIASES[normalizedModel] || normalizedModel : '';
  }

  function normalizeApiKeys(value, fallbackKey = '') {
    const sourceValues = Array.isArray(value)
      ? value
      : String(value || '').replace(/\r\n/g, '\n').split('\n');
    const seenKeys = new Set();
    const normalizedKeys = sourceValues.reduce((result, item) => {
      const normalizedKey = normalizeText(item);

      if (!normalizedKey || seenKeys.has(normalizedKey)) {
        return result;
      }

      seenKeys.add(normalizedKey);
      result.push(normalizedKey);
      return result;
    }, []);
    const normalizedFallbackKey = normalizeText(fallbackKey);

    if (!normalizedKeys.length && normalizedFallbackKey) {
      return [normalizedFallbackKey];
    }

    return normalizedKeys;
  }

  function normalizeSettingsRecord(record, owner) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};

    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: normalizeText(source.updatedAt),
      apiBaseUrl: normalizeText(source.apiBaseUrl) || DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: normalizeText(source.apiKey),
      apiKeys: normalizeApiKeys(source.apiKeys, normalizeText(source.apiKey)),
      model: normalizeModelSetting(source.model),
      temperature: normalizeDecimal(source.temperature, DEFAULT_SETTINGS.temperature, 0),
      maxTokens: normalizeInteger(source.maxTokens, DEFAULT_SETTINGS.maxTokens, 64),
      concurrency: normalizeInteger(source.concurrency, DEFAULT_SETTINGS.concurrency, 1, MAX_AI_TITLE_CONCURRENCY),
      retryLimit: normalizeInteger(source.retryLimit, DEFAULT_SETTINGS.retryLimit, 0),
      minImageBytes: normalizeInteger(source.minImageBytes, DEFAULT_SETTINGS.minImageBytes, 64 * 1024),
      maxImageBytes: normalizeInteger(source.maxImageBytes, DEFAULT_SETTINGS.maxImageBytes, 128 * 1024)
    };
  }

  function buildDefaultSettings(owner) {
    return normalizeSettingsRecord({
      updatedAt: nowIso()
    }, owner);
  }

  async function loadSettings(owner) {
    if (!owner) {
      return buildDefaultSettings(null);
    }

    if (cachedOwnerKey && cachedOwnerKey !== owner.userKey) {
      uploadedAiInputImageCache.clear();
    }

    if (cachedSettings && cachedOwnerKey === owner.userKey) {
      return cachedSettings;
    }

    const settingsFilePath = getLocalSettingsFilePath(owner);
    const storedSettings = await readJsonFile(settingsFilePath);
    let normalizedSettings = normalizeSettingsRecord(storedSettings, owner);
    let shouldPersist = false;

    if (!storedSettings) {
      normalizedSettings = buildDefaultSettings(owner);
      shouldPersist = true;
    } else if (JSON.stringify(storedSettings) !== JSON.stringify(normalizedSettings)) {
      normalizedSettings = {
        ...normalizedSettings,
        updatedAt: nowIso()
      };
      shouldPersist = true;
    }

    if (shouldPersist) {
      await writeJsonFile(settingsFilePath, normalizedSettings);
    }

    cachedOwnerKey = owner.userKey;
    cachedSettings = normalizedSettings;
    return normalizedSettings;
  }

  async function loadRuntimeSettings(owner) {
    const localSettings = await loadSettings(owner);
    let sharedSettings = null;

    if (aiTitleConfigService && typeof aiTitleConfigService.getConfig === 'function') {
      try {
        const result = await aiTitleConfigService.getConfig();
        sharedSettings = result && result.settings ? result.settings : null;
      } catch (error) {
        if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
          runtimeLogger.logError('pod_upload_sheet_ai_title_config_load_failed', error);
        }
      }
    }

    const configuredApiKeys = normalizeApiKeys(
      sharedSettings && sharedSettings.apiKeys,
      sharedSettings && sharedSettings.apiKey
    );

    return {
      ...localSettings,
      apiBaseUrl: normalizeText(sharedSettings && sharedSettings.apiBaseUrl),
      apiKey: configuredApiKeys[0] || '',
      apiKeys: configuredApiKeys,
      model: normalizeModelSetting(sharedSettings && sharedSettings.model),
      concurrency: normalizeInteger(
        sharedSettings && sharedSettings.concurrency,
        localSettings.concurrency,
        1,
        MAX_AI_TITLE_CONCURRENCY
      )
    };
  }

  function normalizeRuntimeBoolean(value, fallback) {
    return value === undefined ? fallback : value === true;
  }

  function normalizeImageQuality(value) {
    return Math.max(48, Math.min(95, normalizeInteger(value, 84, 1)));
  }

  function normalizeImageCompression(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (!normalizedValue || normalizedValue === 'smart-jpeg' || normalizedValue === 'high-quality' || normalizedValue === 'jpeg') {
      return 'jpg';
    }

    return AI_INPUT_IMAGE_FORMATS.includes(normalizedValue) ? normalizedValue : 'jpg';
  }

  function applyPayloadRuntimeSettings(settings, payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const hasImageQuality = Object.prototype.hasOwnProperty.call(source, 'imageQuality');

    return {
      ...settings,
      concurrency: normalizeInteger(source.concurrency, settings.concurrency, 1, MAX_AI_TITLE_CONCURRENCY),
      ...(hasImageQuality ? { imageQuality: normalizeImageQuality(source.imageQuality) } : {}),
      imageCompression: normalizeImageCompression(source.imageCompression),
      storageProvider: normalizeText(source.storageProvider),
      useCache: normalizeRuntimeBoolean(source.useCache, true)
    };
  }

  function normalizeIncomingProductRecord(record) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
    const id = normalizeText(source.id);
    const imagePath = normalizeText(source.imagePath);

    if (!id || !imagePath) {
      return null;
    }

    return {
      id,
      localName: normalizeText(source.localName),
      sourceFolder: normalizeText(source.sourceFolder),
      mainNumber: normalizeText(source.mainNumber),
      categoryId: normalizeText(source.categoryId),
      categoryLabel: normalizeText(source.categoryLabel),
      imageName: normalizeText(source.imageName),
      imagePath
    };
  }

  function normalizeIncomingProducts(records) {
    const seenIds = new Set();

    return (Array.isArray(records) ? records : []).reduce((result, item) => {
      const normalizedRecord = normalizeIncomingProductRecord(item);

      if (!normalizedRecord || seenIds.has(normalizedRecord.id)) {
        return result;
      }

      seenIds.add(normalizedRecord.id);
      result.push(normalizedRecord);
      return result;
    }, []);
  }

  function resolveModelName(model) {
    const requestedModel = normalizeText(model);
    return {
      requestedModel,
      resolvedModel: normalizeModelSetting(requestedModel)
    };
  }

  function resizeImageToContain(image, maxDimension) {
    const size = image.getSize();
    const width = Number(size && size.width) || 0;
    const height = Number(size && size.height) || 0;

    if (width <= 0 || height <= 0) {
      return image;
    }

    const longestEdge = Math.max(width, height);

    if (longestEdge <= maxDimension) {
      return image;
    }

    const scale = maxDimension / longestEdge;

    return image.resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      quality: 'best'
    });
  }

  function getImageJpegQualities(settings) {
    const requestedQuality = normalizeImageQuality(settings && settings.imageQuality);

    if (!settings || !settings.imageQuality) {
      return IMAGE_JPEG_QUALITIES;
    }

    return [
      requestedQuality,
      requestedQuality - 6,
      requestedQuality - 12,
      requestedQuality - 18,
      requestedQuality - 24,
      requestedQuality - 30
    ]
      .map((quality) => Math.max(42, Math.min(95, quality)))
      .filter((quality, index, values) => values.indexOf(quality) === index);
  }

  function selectCompressedImageCandidate(image, settings) {
    const minBytes = Math.min(settings.minImageBytes, settings.maxImageBytes);
    const maxBytes = Math.max(settings.maxImageBytes, settings.minImageBytes);
    const qualityOptions = getImageJpegQualities(settings);
    let largestUnderRange = null;
    let smallestOverRange = null;

    for (const dimension of IMAGE_MAX_DIMENSIONS) {
      const resizedImage = resizeImageToContain(image, dimension);

      for (const quality of qualityOptions) {
        const buffer = Buffer.from(resizedImage.toJPEG(quality));
        const candidate = {
          buffer,
          mimeType: 'image/jpeg',
          byteLength: buffer.length,
          quality,
          maxDimension: dimension,
          imageCompression: 'jpg',
          extension: '.jpg'
        };

        if (candidate.byteLength >= minBytes && candidate.byteLength <= maxBytes) {
          return candidate;
        }

        if (candidate.byteLength < minBytes) {
          if (!largestUnderRange || candidate.byteLength > largestUnderRange.byteLength) {
            largestUnderRange = candidate;
          }
          continue;
        }

        if (!smallestOverRange || candidate.byteLength < smallestOverRange.byteLength) {
          smallestOverRange = candidate;
        }
      }
    }

    return largestUnderRange || smallestOverRange;
  }

  function getSharpResizeOptions(metadata, maxDimension) {
    const width = Number(metadata && metadata.width) || 0;
    const height = Number(metadata && metadata.height) || 0;
    const longestEdge = Math.max(width, height);

    if (width <= 0 || height <= 0 || longestEdge <= maxDimension) {
      return null;
    }

    const scale = maxDimension / longestEdge;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      fit: 'inside',
      withoutEnlargement: true
    };
  }

  async function selectCompressedImageCandidateWithSharp(imagePath, settings) {
    const minBytes = Math.min(settings.minImageBytes, settings.maxImageBytes);
    const maxBytes = Math.max(settings.maxImageBytes, settings.minImageBytes);
    const qualityOptions = getImageJpegQualities(settings);
    const metadata = await sharp(imagePath, {
      failOnError: false,
      animated: false,
      limitInputPixels: false
    }).metadata();
    let largestUnderRange = null;
    let smallestOverRange = null;

    for (const dimension of IMAGE_MAX_DIMENSIONS) {
      const resizeOptions = getSharpResizeOptions(metadata, dimension);

      for (const quality of qualityOptions) {
        let pipeline = sharp(imagePath, {
          failOnError: false,
          animated: false,
          limitInputPixels: false
        }).rotate();

        if (resizeOptions) {
          pipeline = pipeline.resize(resizeOptions);
        }

        const buffer = await pipeline
          .flatten({
            background: '#ffffff'
          })
          .jpeg({
            quality,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer();
        const candidate = {
          buffer,
          mimeType: 'image/jpeg',
          byteLength: buffer.length,
          quality,
          maxDimension: dimension,
          imageCompression: 'jpg',
          extension: '.jpg'
        };

        if (candidate.byteLength >= minBytes && candidate.byteLength <= maxBytes) {
          return candidate;
        }

        if (candidate.byteLength < minBytes) {
          if (!largestUnderRange || candidate.byteLength > largestUnderRange.byteLength) {
            largestUnderRange = candidate;
          }
          continue;
        }

        if (!smallestOverRange || candidate.byteLength < smallestOverRange.byteLength) {
          smallestOverRange = candidate;
        }
      }
    }

    return largestUnderRange || smallestOverRange;
  }

  function getAiInputImageFormatInfo(imagePath, imageCompression) {
    const normalizedCompression = normalizeImageCompression(imageCompression);

    if (normalizedCompression === 'png') {
      return {
        extension: '.png',
        mimeType: 'image/png',
        imageCompression: 'png'
      };
    }

    if (normalizedCompression === 'webp') {
      return {
        extension: '.webp',
        mimeType: 'image/webp',
        imageCompression: 'webp'
      };
    }

    if (normalizedCompression === 'jpg') {
      return {
        extension: '.jpg',
        mimeType: 'image/jpeg',
        imageCompression: 'jpg'
      };
    }

    const sourceExtension = normalizeText(path.extname(imagePath)).toLowerCase();
    const sourceFormat = AI_INPUT_IMAGE_SOURCE_EXTENSIONS[sourceExtension];

    return sourceFormat
      ? {
        extension: sourceFormat.extension,
        mimeType: sourceFormat.mimeType,
        imageCompression: 'original'
      }
      : {
        extension: '.jpg',
        mimeType: 'image/jpeg',
        imageCompression: 'jpg'
      };
  }

  async function readOriginalImageCandidate(imagePath, fileStat) {
    const formatInfo = getAiInputImageFormatInfo(imagePath, 'original');

    if (formatInfo.imageCompression !== 'original') {
      return null;
    }

    const buffer = await fs.promises.readFile(imagePath);

    return {
      buffer,
      mimeType: formatInfo.mimeType,
      byteLength: buffer.length,
      quality: 0,
      maxDimension: 0,
      imageCompression: 'original',
      extension: formatInfo.extension,
      fileStat: {
        size: Number(fileStat && fileStat.size) || 0,
        mtimeMs: Number(fileStat && fileStat.mtimeMs) || 0
      }
    };
  }

  async function selectFormattedImageCandidateWithSharp(imagePath, settings, imageCompression) {
    const formatInfo = getAiInputImageFormatInfo(imagePath, imageCompression);
    const normalizedCompression = formatInfo.imageCompression;
    const minBytes = Math.min(settings.minImageBytes, settings.maxImageBytes);
    const maxBytes = Math.max(settings.maxImageBytes, settings.minImageBytes);
    const qualityOptions = normalizedCompression === 'png'
      ? [null]
      : getImageJpegQualities(settings);
    const metadata = await sharp(imagePath, {
      failOnError: false,
      animated: false,
      limitInputPixels: false
    }).metadata();
    let largestUnderRange = null;
    let smallestOverRange = null;

    for (const dimension of IMAGE_MAX_DIMENSIONS) {
      const resizeOptions = getSharpResizeOptions(metadata, dimension);

      for (const quality of qualityOptions) {
        let pipeline = sharp(imagePath, {
          failOnError: false,
          animated: false,
          limitInputPixels: false
        }).rotate();

        if (resizeOptions) {
          pipeline = pipeline.resize(resizeOptions);
        }

        if (normalizedCompression === 'png') {
          const buffer = await pipeline
            .png({
              compressionLevel: 9,
              adaptiveFiltering: true,
              force: true
            })
            .toBuffer();
          const candidate = {
            buffer,
            mimeType: 'image/png',
            byteLength: buffer.length,
            quality: 0,
            maxDimension: dimension,
            imageCompression: 'png',
            extension: '.png'
          };

          if (candidate.byteLength >= minBytes && candidate.byteLength <= maxBytes) {
            return candidate;
          }

          if (candidate.byteLength < minBytes) {
            if (!largestUnderRange || candidate.byteLength > largestUnderRange.byteLength) {
              largestUnderRange = candidate;
            }
            continue;
          }

          if (!smallestOverRange || candidate.byteLength < smallestOverRange.byteLength) {
            smallestOverRange = candidate;
          }
          continue;
        }

        const normalizedQuality = Math.max(42, Math.min(95, Number(quality) || 84));
        const buffer = await pipeline
          .flatten({
            background: '#ffffff'
          })
          .webp({
            quality: normalizedQuality,
            effort: 4
          })
          .toBuffer();
        const candidate = {
          buffer,
          mimeType: normalizedCompression === 'webp' ? 'image/webp' : 'image/jpeg',
          byteLength: buffer.length,
          quality: normalizedQuality,
          maxDimension: dimension,
          imageCompression: normalizedCompression,
          extension: normalizedCompression === 'webp' ? '.webp' : '.jpg'
        };

        if (candidate.byteLength >= minBytes && candidate.byteLength <= maxBytes) {
          return candidate;
        }

        if (candidate.byteLength < minBytes) {
          if (!largestUnderRange || candidate.byteLength > largestUnderRange.byteLength) {
            largestUnderRange = candidate;
          }
          continue;
        }

        if (!smallestOverRange || candidate.byteLength < smallestOverRange.byteLength) {
          smallestOverRange = candidate;
        }
      }
    }

    return largestUnderRange || smallestOverRange;
  }

  async function compressImageForArk(imagePath, settings) {
    try {
      await fs.promises.access(imagePath, fs.constants.R_OK);
    } catch (_error) {
      throw new Error('默认图片不存在或无法读取。');
    }

    const fileStat = await fs.promises.stat(imagePath);
    let candidate = null;
    let sourceImage = null;
    const imageCompression = normalizeImageCompression(settings && settings.imageCompression);
    const selectJpegCandidate = async () => {
      try {
        sourceImage = nativeImage.createFromPath(imagePath);
      } catch (_error) {
        sourceImage = null;
      }

      if (sourceImage && !sourceImage.isEmpty()) {
        return selectCompressedImageCandidate(sourceImage, settings);
      }

      try {
        return await selectCompressedImageCandidateWithSharp(imagePath, settings);
      } catch (_error) {
        return null;
      }
    };

    if (imageCompression === 'original') {
      try {
        candidate = await readOriginalImageCandidate(imagePath, fileStat);
      } catch (_error) {
        candidate = null;
      }
    } else if (imageCompression === 'png' || imageCompression === 'webp') {
      try {
        candidate = await selectFormattedImageCandidateWithSharp(imagePath, settings, imageCompression);
      } catch (_error) {
        candidate = null;
      }
    } else {
      candidate = await selectJpegCandidate();
    }

    if (!candidate && imageCompression !== 'jpg') {
      candidate = await selectJpegCandidate();
    }

    if (!candidate || !candidate.buffer || !candidate.buffer.length) {
      throw new Error('默认图片压缩失败。');
    }

    return {
      ...candidate,
      fileStat: {
        size: Number(fileStat && fileStat.size) || 0,
        mtimeMs: Number(fileStat && fileStat.mtimeMs) || 0
      }
    };
  }

  function getNextRequestApiKey(settings, job) {
    const apiKeys = normalizeApiKeys(settings && settings.apiKeys, settings && settings.apiKey);

    if (!apiKeys.length) {
      return '';
    }

    if (!job) {
      return apiKeys[0];
    }

    const currentIndex = Math.max(0, Number(job.apiKeyCursor) || 0) % apiKeys.length;
    job.apiKeyCursor = currentIndex + 1;
    return apiKeys[currentIndex];
  }

  function buildAiInputImageObjectKey(owner, entryId, product, compressedImage) {
    const normalizedEntryId = getResolvedEntryId(entryId);
    const dateFolder = formatDateFolder();
    const appFolder = createSlug(normalizedEntryId, 'pod-ai-title');
    const ownerFolder = createSlug(owner && owner.userKey, 'user');
    const productFolder = createSlug(
      product && (product.sourceFolder || product.localName || product.mainNumber),
      'product'
    ).slice(0, 72);
    const fileSlug = createSlug(
      path.basename(product && (product.imageName || product.imagePath), path.extname(product && (product.imageName || product.imagePath) || '')),
      'image'
    ).slice(0, 72);
    const uniqueHash = createHash([
      normalizedEntryId,
      normalizeText(product && product.imagePath),
      Number(compressedImage && compressedImage.fileStat && compressedImage.fileStat.size) || 0,
      Number(compressedImage && compressedImage.fileStat && compressedImage.fileStat.mtimeMs) || 0,
      Number(compressedImage && compressedImage.byteLength) || 0,
      Number(compressedImage && compressedImage.maxDimension) || 0,
      Number(compressedImage && compressedImage.quality) || 0,
      normalizeText(compressedImage && compressedImage.imageCompression),
      normalizeText(compressedImage && compressedImage.extension)
    ].join('|'), 16);

    return `${AI_INPUT_IMAGE_ROOT}/${appFolder}/${ownerFolder}/${dateFolder}/${productFolder}/${fileSlug}-${uniqueHash}${normalizeText(compressedImage && compressedImage.extension) || '.jpg'}`;
  }

  function buildAiTitleResultCacheKey(owner, entryId, product, settings, compressedImage, promptOptions = {}) {
    return createHash([
      getResolvedEntryId(entryId),
      normalizeText(owner && owner.userKey),
      normalizeText(product && product.id),
      normalizeText(product && product.localName),
      normalizeText(product && product.sourceFolder),
      normalizeText(product && product.mainNumber),
      normalizeText(product && product.categoryId),
      normalizeText(product && product.categoryLabel),
      normalizeText(product && product.imageName),
      normalizeText(product && product.imagePath),
      Number(compressedImage && compressedImage.fileStat && compressedImage.fileStat.size) || 0,
      Number(compressedImage && compressedImage.fileStat && compressedImage.fileStat.mtimeMs) || 0,
      Number(compressedImage && compressedImage.byteLength) || 0,
      Number(compressedImage && compressedImage.maxDimension) || 0,
      Number(compressedImage && compressedImage.quality) || 0,
      normalizeText(compressedImage && compressedImage.imageCompression),
      normalizeText(compressedImage && compressedImage.extension),
      normalizeText(settings && settings.apiBaseUrl),
      normalizeText(settings && settings.model),
      normalizeText(settings && settings.imageCompression),
      Number(settings && settings.imageQuality) || 0,
      normalizeText(promptOptions.prefixText),
      normalizeText(promptOptions.suffixText),
      normalizeText(promptOptions.extraPrompt),
      normalizeText(promptOptions.targetLength),
      normalizeText(promptOptions.outputLanguage)
    ].join('|'), 32);
  }

  async function uploadCompressedImageForAi(owner, entryId, product, compressedImage, settings, job) {
    throwIfJobCanceled(job);

    const objectKey = buildAiInputImageObjectKey(owner, entryId, product, compressedImage);
    const cacheKey = [
      normalizeText(owner && owner.userKey),
      normalizeText(objectKey)
    ].join('|');
    const cachedAsset = uploadedAiInputImageCache.get(cacheKey);

    if (settings && settings.useCache === false) {
      uploadedAiInputImageCache.delete(cacheKey);
    }

    if (settings && settings.useCache !== false && cachedAsset && normalizeText(cachedAsset.url) && normalizeText(cachedAsset.key)) {
      return cachedAsset;
    }

    const uploadResult = await cosClient.putObject({
      Bucket: AI_INPUT_IMAGE_BUCKET,
      Region: AI_INPUT_IMAGE_REGION,
      Key: objectKey,
      Body: compressedImage.buffer,
      ContentLength: Number(compressedImage && compressedImage.byteLength) || compressedImage.buffer.length,
      ContentType: normalizeText(compressedImage && compressedImage.mimeType) || 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable'
    });
    const uploadedAsset = {
      key: objectKey,
      url: normalizeText(uploadResult && uploadResult.Location)
        ? `https://${normalizeText(uploadResult.Location)}`
        : getPublicUrlForAiInputKey(objectKey),
      byteLength: Number(compressedImage && compressedImage.byteLength) || 0
    };

    if (!settings || settings.useCache !== false) {
      uploadedAiInputImageCache.set(cacheKey, uploadedAsset);
    }

    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log('pod_upload_sheet_ai_title_input_image_uploaded', {
        entryId: getResolvedEntryId(entryId),
        productId: normalizeText(product && product.id),
        sourceFolder: normalizeText(product && product.sourceFolder),
        imageName: normalizeText(product && product.imageName),
        key: uploadedAsset.key,
        url: uploadedAsset.url,
        byteLength: uploadedAsset.byteLength
      });
    }

    return uploadedAsset;
  }

  function throwIfJobCanceled(job) {
    if (job && job.canceled) {
      throw createCanceledError();
    }
  }

  function escapePromptValue(value) {
    return normalizeText(value).replace(/\s+/g, ' ').slice(0, 240);
  }

  function normalizeOutputLanguage(value, fallback = DEFAULT_OUTPUT_LANGUAGE) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (normalizedValue === 'zh' || normalizedValue === 'en') {
      return normalizedValue;
    }

    return fallback;
  }

  function normalizeRequestedTitleLength(value) {
    const parsedValue = Number.parseInt(normalizeText(value), 10);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return DEFAULT_TARGET_TITLE_LENGTH;
    }

    return Math.min(TITLE_MAX_LENGTH, parsedValue);
  }

  function getProductTypeHint(product) {
    const categoryId = normalizeText(product && product.categoryId);
    const exactHint = PRODUCT_TYPE_HINTS[categoryId];

    if (exactHint) {
      return exactHint;
    }

    return escapePromptValue(product && product.categoryLabel);
  }

  function buildPrompt(product, prefixText, suffixText) {
    return [
      '你是跨境电商商品标题助手，请基于输入图片生成 1 组中文标题和英文标题。',
      '核心要求：只识别商品本体上的图案、花型、印花、主题元素；不要描述背景、摆拍道具、房间、手、折叠方式、水滴、阴影、文字贴图、边框或包装。',
      '商品类型优先参考我给出的类目提示和本地商品名，图片只负责识别图案主题。',
      '不要编造品牌、IP、材质、尺寸、数量、夸张营销词、运输词、年份、节日标签。',
      '如果图案看不清，请使用更稳妥的通用词，例如 patterned / printed / decorative，不要瞎猜具体风格。',
      '如果“前段标题提示”或“后段标题提示”不为空，请把它们自然融入标题，不要生硬逐字拼接；英文标题需要自然英文表达。',
      '中文标题长度控制在 12 到 32 个汉字左右；英文标题控制在 5 到 14 个单词左右，采用正常标题式大小写。',
      '中文标题和英文标题各自最终长度都不能超过 255 个字符。',
      '只返回 JSON，不要输出 Markdown，不要解释。',
      'JSON 格式必须是：{"zhTitle":"","enTitle":"","patternSummary":"","confidence":"high|medium|low"}。',
      `本地商品名：${escapePromptValue(product && product.localName) || '未提供'}`,
      `来源目录：${escapePromptValue(product && product.sourceFolder) || '未提供'}`,
      `类目提示：${getProductTypeHint(product) || '未提供'}`,
      `前段标题提示：${escapePromptValue(prefixText) || '无'}`,
      `后段标题提示：${escapePromptValue(suffixText) || '无'}`,
      `默认第一张图片文件名：${escapePromptValue(product && product.imageName) || '未提供'}`
    ].join('\n');
  }

  function normalizeTitlePart(value) {
    return normalizeText(value).replace(/\s+/g, ' ');
  }

  function getTitleCharacterCount(value) {
    return Array.from(normalizeTitlePart(value)).length;
  }

  function removeTitleTrailingSeparators(value) {
    return normalizeTitlePart(value)
      .replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '')
      .trim();
  }

  function removeDanglingTitleTail(value) {
    let result = removeTitleTrailingSeparators(value);

    if (!result) {
      return '';
    }

    const lastTokenMatch = result.match(/([A-Za-z]{1,2})$/u);
    const previousCharacter = lastTokenMatch
      ? result.slice(0, -lastTokenMatch[1].length).slice(-1)
      : '';

    if (lastTokenMatch && /[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]/u.test(previousCharacter)) {
      result = result.slice(0, -lastTokenMatch[1].length)
        .replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '')
        .trim();
    }

    return result;
  }

  function trimTitleLength(value, maxLength = TITLE_MAX_LENGTH) {
    const normalizedValue = normalizeTitlePart(value);
    const safeMaxLength = Math.max(0, Math.min(Number(maxLength) || 0, TITLE_MAX_LENGTH));

    if (!normalizedValue || safeMaxLength <= 0) {
      return '';
    }

    const characters = Array.from(normalizedValue);

    if (characters.length <= safeMaxLength) {
      return removeTitleTrailingSeparators(normalizedValue);
    }

    return removeDanglingTitleTail(characters.slice(0, safeMaxLength).join(''));
  }

  function splitLocalizedTitleHint(value) {
    const normalizedValue = normalizeTitlePart(value);

    if (!normalizedValue) {
      return {
        zhText: '',
        enText: ''
      };
    }

    const parts = normalizedValue
      .split(/\s*(?:\/|｜|\|)\s*/u)
      .map((item) => normalizeTitlePart(item))
      .filter(Boolean);

    if (parts.length >= 2) {
      return {
        zhText: parts[0],
        enText: parts.slice(1).join(' / ')
      };
    }

    return {
      zhText: normalizedValue,
      enText: /[A-Za-z]/.test(normalizedValue) && !/[\u3400-\u9fff]/u.test(normalizedValue)
        ? normalizedValue
        : ''
    };
  }

  function stripLeadingOverlap(sourceText, fixedText) {
    const source = normalizeTitlePart(sourceText);
    const fixed = normalizeTitlePart(fixedText);

    if (!source || !fixed) {
      return source;
    }

    if (source.startsWith(fixed)) {
      return normalizeTitlePart(source.slice(fixed.length));
    }

    for (let length = Math.min(source.length, fixed.length); length >= 2; length -= 1) {
      const fixedPrefix = fixed.slice(0, length);
      const fixedSuffix = fixed.slice(-length);

      if (source.startsWith(fixedPrefix) || source.startsWith(fixedSuffix)) {
        return normalizeTitlePart(source.slice(length));
      }
    }

    return source;
  }

  function stripTrailingOverlap(sourceText, fixedText) {
    const source = normalizeTitlePart(sourceText);
    const fixed = normalizeTitlePart(fixedText);

    if (!source || !fixed) {
      return source;
    }

    if (source.endsWith(fixed)) {
      return normalizeTitlePart(source.slice(0, source.length - fixed.length));
    }

    for (let length = Math.min(source.length, fixed.length); length >= 2; length -= 1) {
      const fixedPrefix = fixed.slice(0, length);
      const fixedSuffix = fixed.slice(-length);

      if (source.endsWith(fixedPrefix) || source.endsWith(fixedSuffix)) {
        return normalizeTitlePart(source.slice(0, source.length - length));
      }
    }

    return source;
  }

  function normalizeMiddleTitlePart(value, prefixText, suffixText) {
    let result = normalizeTitlePart(value);

    result = stripLeadingOverlap(result, prefixText);
    result = stripTrailingOverlap(result, suffixText);

    return result;
  }

  function shouldInsertSpaceBetweenTitleParts(leftPart, rightPart) {
    return Boolean(
      leftPart
      && rightPart
      && (
        /[A-Za-z0-9]$/u.test(leftPart)
        || /^[A-Za-z0-9]/u.test(rightPart)
      )
    );
  }

  function joinTitleParts(parts, { preferSpace = false, maxLength = TITLE_MAX_LENGTH } = {}) {
    let result = '';

    (Array.isArray(parts) ? parts : []).forEach((part) => {
      const normalizedPart = normalizeTitlePart(part);

      if (!normalizedPart) {
        return;
      }

      if (!result) {
        result = normalizedPart;
        return;
      }

      result += (preferSpace || shouldInsertSpaceBetweenTitleParts(result, normalizedPart) ? ' ' : '') + normalizedPart;
    });

    return trimTitleLength(result, maxLength);
  }

  function hasTitleFragment(sourceText, fragmentText) {
    const normalizedSource = normalizeTitlePart(sourceText).toLowerCase();
    const normalizedFragment = normalizeTitlePart(fragmentText).toLowerCase();

    if (!normalizedSource || !normalizedFragment) {
      return false;
    }

    return normalizedSource.includes(normalizedFragment);
  }

  function buildUsageScenarioTitleFragment(values) {
    const normalizedItems = (Array.isArray(values) ? values : [])
      .map((item) => normalizeTitlePart(item))
      .filter((item, index, items) => item && items.indexOf(item) === index);

    if (!normalizedItems.length) {
      return '';
    }

    return `for ${normalizedItems.join(' ')}`;
  }

  function buildLengthOptimizedEnglishMiddleText(titleResult, prefixText, suffixText, maxLength) {
    const baseMiddleText =
      normalizeMiddleTitlePart(titleResult && titleResult.enTitle, prefixText, suffixText)
      || normalizeTitlePart(titleResult && titleResult.enTitle);
    const candidateFragments = [
      normalizeTitlePart(titleResult && titleResult.patternSummary),
      buildUsageScenarioTitleFragment(titleResult && titleResult.usageScenarios)
    ].filter(Boolean);
    let expandedText = baseMiddleText;

    candidateFragments.forEach((fragment) => {
      if (!fragment || hasTitleFragment(expandedText, fragment)) {
        return;
      }

      expandedText = joinTitleParts(
        [expandedText, fragment].filter(Boolean),
        {
          preferSpace: true,
          maxLength
        }
      );
    });

    return expandedText;
  }

  function fitTitlePartsToLength(prefixText, middleText, suffixText, { preferSpace = false, maxLength = TITLE_MAX_LENGTH } = {}) {
    const normalizedPrefix = normalizeTitlePart(prefixText);
    const normalizedMiddle = normalizeTitlePart(middleText);
    const normalizedSuffix = normalizeTitlePart(suffixText);
    const safeMaxLength = Math.max(1, Math.min(Number(maxLength) || TITLE_MAX_LENGTH, TITLE_MAX_LENGTH));
    const buildCandidate = (middleValue) => {
      return joinTitleParts(
        [normalizedPrefix, normalizeTitlePart(middleValue), normalizedSuffix].filter(Boolean),
        { preferSpace, maxLength: TITLE_MAX_LENGTH }
      );
    };
    const fullCandidate = buildCandidate(normalizedMiddle);

    if (getTitleCharacterCount(fullCandidate) <= safeMaxLength) {
      return fullCandidate;
    }

    if (normalizedMiddle) {
      const middleCharacters = Array.from(normalizedMiddle);
      let low = 0;
      let high = middleCharacters.length;
      let bestCandidate = '';

      while (low <= high) {
        const currentLength = Math.floor((low + high) / 2);
        const candidate = buildCandidate(middleCharacters.slice(0, currentLength).join(''));

        if (getTitleCharacterCount(candidate) <= safeMaxLength) {
          bestCandidate = candidate;
          low = currentLength + 1;
          continue;
        }

        high = currentLength - 1;
      }

      if (bestCandidate) {
        return bestCandidate;
      }
    }

    const fixedCandidate = joinTitleParts(
      [normalizedPrefix, normalizedSuffix].filter(Boolean),
      { preferSpace, maxLength: TITLE_MAX_LENGTH }
    );

    if (fixedCandidate) {
      return trimTitleLength(fixedCandidate, safeMaxLength);
    }

    return trimTitleLength(normalizedMiddle, safeMaxLength);
  }
  function buildStructuredPrompt(entryId, product, prefixText, suffixText, extraPrompt, targetLength, outputLanguage) {
    const prefixHint = splitLocalizedTitleHint(prefixText);
    const suffixHint = splitLocalizedTitleHint(suffixText);
    const resolvedOutputLanguage = getLengthControlLanguage(entryId, outputLanguage);
    const lengthTarget = normalizeRequestedTitleLength(targetLength);
    const secondaryTitleMaxLength = lengthTarget;
    const selectedTitleField = resolvedOutputLanguage === 'zh' ? 'zhTitle' : 'enTitle';
    const selectedLanguageLabel = resolvedOutputLanguage === 'zh' ? 'Chinese' : 'English';
    const strictLengthRules = resolvedOutputLanguage === 'zh'
      ? [
        'zhTitle composition rules:',
        '- zhTitle must be written in natural Simplified Chinese only.',
        '- zhTitle must stay fully in Chinese; do not let it drift into English or mixed language.',
        '- The "Front title hint" below MUST appear at the beginning of zhTitle.',
        '- The "End title hint" below MUST appear at the end of zhTitle.',
        '- Build the rest of zhTitle around these two fixed parts.',
        `- zhTitle MUST NOT exceed ${lengthTarget} characters.`,
        `- Count every visible character in zhTitle, including Chinese characters, English letters, spaces, punctuation, slashes, hyphens, symbols, and digits.`,
        `- Make zhTitle as close as possible to ${lengthTarget} characters without exceeding it.`,
        `- enTitle must be a faithful natural English translation of zhTitle, same product meaning, and MUST NOT exceed ${secondaryTitleMaxLength} characters.`
      ]
      : [
        'enTitle composition rules:',
        '- enTitle must be written in natural English only.',
        '- enTitle must stay fully in English; do not let it drift into Chinese or mixed language.',
        '- The "Front title English hint" below MUST appear at the beginning of enTitle.',
        '- The "End title English hint" below MUST appear at the end of enTitle.',
        '- Build the rest of enTitle around these two fixed parts.',
        `- enTitle MUST NOT exceed ${lengthTarget} characters.`,
        `- Count every visible character in enTitle, including letters, spaces, punctuation, slashes, hyphens, symbols, and digits.`,
        `- Make enTitle as close as possible to ${lengthTarget} characters without exceeding it.`,
        '- Use enough truthful pattern, style, and usage keywords to get close to the target length. Do not stop too short if accurate keywords are still available.',
        `- zhTitle must be a faithful natural Chinese translation of enTitle, same product meaning, and MUST NOT exceed ${secondaryTitleMaxLength} characters.`
      ];

    const parts = [
      'You are an expert e-commerce listing copywriter for TEMU, Amazon, and Mercado Libre.',
      'Look at the product image and create matching Chinese (zhTitle) and English (enTitle) product titles. Both MUST describe the exact same product content — same pattern, colors, style, features, and usage — just in different languages.',
      '',
      'CRITICAL: zhTitle must be Chinese only. enTitle must be English only. Never swap the two fields or mix languages inside them.',
      '',
      `Selected primary title field for strict length control: ${selectedTitleField} (${selectedLanguageLabel}).`,
      ...strictLengthRules,
      '- Include: pattern details, product type, colors, style, usage scenarios, relevant keywords.',
      '',
      'Constraints (do not fabricate):',
      '- No fake brand names, IP characters, materials, dimensions, or shipping terms.',
      '- Describe only what is on the product itself (pattern, print, theme, design).',
      '- Ignore background, props, folds, shadows, borders, or packaging.',
      '',
      'Return ONLY valid JSON with this exact schema:',
      '{"zhTitle":"","enTitle":"","usageScenarios":[],"patternSummary":"","confidence":"high|medium|low"}',
      '',
      'Example (front hint="Custom Printed", end hint="Bath Towel"):',
      '{"zhTitle":"\u5b9a\u5236\u5370\u82b1\u73ab\u7470\u8702\u9e1f\u8774\u87763D\u56fe\u6848 - \u4f18\u96c5\u81ea\u7136\u82b1\u5349\u88c5\u9970\u98ce\u683c\u8d85\u7ec6\u7ea4\u7ef4\u901f\u5e72\u6d74\u5dfe\uff0c\u9002\u7528\u4e8e\u6d74\u5ba4\u3001\u5065\u8eab\u623f\u3001\u6c99\u6ee9\u3001\u6e38\u6cf3\u3001SPA\u3001\u793c\u54c1\u7b49\u573a\u666f","enTitle":"Custom Printed Roses Hummingbirds Butterflies 3D Pattern - Elegant Nature Floral Design Microfiber Quick Dry Bath Towel for Bathroom Gym Beach Swimming SPA Gift","usageScenarios":["bathroom","gym","beach","swimming","spa","gift"],"patternSummary":"roses, hummingbirds and butterflies floral pattern","confidence":"high"}',
      '',
      `Local product name: ${escapePromptValue(product && product.localName) || 'none'}`,
      `Source folder: ${escapePromptValue(product && product.sourceFolder) || 'none'}`,
      `Category hint: ${getProductTypeHint(product) || 'none'}`,
      `Front title hint: ${escapePromptValue(prefixText) || 'none'}`,
      `End title hint: ${escapePromptValue(suffixText) || 'none'}`,
      `Front title English hint: ${escapePromptValue(prefixHint.enText) || 'none'}`,
      `End title English hint: ${escapePromptValue(suffixHint.enText) || 'none'}`,
      `First image file name: ${escapePromptValue(product && product.imageName) || 'none'}`
    ];

    if (extraPrompt) {
      parts.push('', `Additional instructions: ${extraPrompt}`);
    }

    return parts.join('\n');
  }

  function normalizeStructuredAiTitleResponse(payload) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const zhTitle = normalizeTitlePart(source.zhTitle);
    const enTitle = normalizeTitlePart(source.enTitle);

    if (!zhTitle || !enTitle) {
      throw new Error('AI returned incomplete titles.');
    }

    const confidence = normalizeText(source.confidence).toLowerCase();

    return {
      zhTitle,
      enTitle,
      usageScenarios: Array.isArray(source.usageScenarios)
        ? source.usageScenarios.map((item) => normalizeTitlePart(item)).filter(Boolean)
        : [],
      patternSummary: normalizeTitlePart(source.patternSummary),
      confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium'
    };
  }

  function composeAiTitles(entryId, titleResult, prefixText, suffixText, outputLanguage, targetLength) {
    const prefixHint = splitLocalizedTitleHint(prefixText);
    const suffixHint = splitLocalizedTitleHint(suffixText);
    const resolvedOutputLanguage = getLengthControlLanguage(entryId, outputLanguage);
    const resolvedTargetLength = normalizeRequestedTitleLength(targetLength);
    const secondaryTitleMaxLength = resolvedTargetLength;
    const enMiddleText = resolvedOutputLanguage === 'en'
      ? buildLengthOptimizedEnglishMiddleText(
        titleResult,
        prefixHint.enText,
        suffixHint.enText,
        resolvedTargetLength
      )
      : (
        normalizeMiddleTitlePart(titleResult.enTitle, prefixHint.enText, suffixHint.enText)
        || titleResult.enTitle
      );
    const zhTitle = fitTitlePartsToLength(
      prefixHint.zhText,
      normalizeMiddleTitlePart(titleResult.zhTitle, prefixHint.zhText, suffixHint.zhText) || titleResult.zhTitle,
      suffixHint.zhText,
      {
        maxLength: resolvedOutputLanguage === 'zh' ? resolvedTargetLength : secondaryTitleMaxLength
      }
    ) || trimTitleLength(titleResult.zhTitle, resolvedOutputLanguage === 'zh' ? resolvedTargetLength : secondaryTitleMaxLength);
    const enTitle = fitTitlePartsToLength(
      prefixHint.enText,
      enMiddleText,
      suffixHint.enText,
      {
        preferSpace: true,
        maxLength: resolvedOutputLanguage === 'en' ? resolvedTargetLength : secondaryTitleMaxLength
      }
    ) || trimTitleLength(titleResult.enTitle, resolvedOutputLanguage === 'en' ? resolvedTargetLength : secondaryTitleMaxLength);

    if (!zhTitle || !enTitle) {
      throw new Error('AI returned incomplete titles.');
    }

    return {
      zhTitle,
      enTitle,
      usageScenarios: Array.isArray(titleResult.usageScenarios)
        ? titleResult.usageScenarios.slice()
        : [],
      patternSummary: normalizeTitlePart(titleResult.patternSummary),
      confidence: titleResult.confidence,
      outputLanguage: resolvedOutputLanguage
    };
  }

  function extractMessageText(content) {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }

          if (typeof item.text === 'string') {
            return item.text;
          }

          return '';
        })
        .filter(Boolean)
        .join('\n');
    }

    return '';
  }

  function extractJsonObject(text) {
    const sourceText = String(text || '').trim();

    if (!sourceText) {
      throw new Error('AI 未返回标题内容。');
    }

    const fenceMatch = sourceText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidateText = fenceMatch ? fenceMatch[1].trim() : sourceText;
    const startIndex = candidateText.indexOf('{');
    const endIndex = candidateText.lastIndexOf('}');

    if (startIndex < 0 || endIndex < startIndex) {
      throw new Error('AI 返回内容不是合法 JSON。');
    }

    return JSON.parse(candidateText.slice(startIndex, endIndex + 1));
  }

  function normalizeAiTitleResponse(payload) {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const zhTitle = normalizeText(source.zhTitle);
    const enTitle = normalizeText(source.enTitle);

    if (!zhTitle || !enTitle) {
      throw new Error('AI 返回的标题不完整。');
    }

    const confidence = normalizeText(source.confidence).toLowerCase();

    return {
      zhTitle,
      enTitle,
      patternSummary: normalizeText(source.patternSummary),
      confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium'
    };
  }

  function trimApiErrorMessage(value) {
    return normalizeText(value).replace(/\s+/g, ' ').slice(0, 200);
  }

  async function requestAiTitles(settings, modelName, prompt, imageUrl, job) {
    throwIfJobCanceled(job);
    const requestApiKey = getNextRequestApiKey(settings, job);

    if (!requestApiKey) {
      throw new Error('AI Key \u672a\u914d\u7f6e\u3002');
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    if (job) {
      job.activeControllers.add(controller);
    }

    try {
      const response = await fetch(`${settings.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${requestApiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          messages: [
            {
              role: 'system',
              content: 'You are an expert e-commerce listing title writer. Return only valid JSON.'
            },
            {
              role: 'system',
              content: 'Follow the user prompt schema exactly and reply with JSON only.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });

      const rawResponseText = await response.text();

      if (!response.ok) {
        throw new Error(trimApiErrorMessage(rawResponseText) || `AI 接口返回 ${response.status}`);
      }

      let parsedResponse = null;

      try {
        parsedResponse = JSON.parse(rawResponseText);
      } catch (_error) {
        throw new Error('AI 接口返回了无法解析的 JSON。');
      }

      const msgContent = extractMessageText(
        parsedResponse
        && parsedResponse.choices
        && parsedResponse.choices[0]
        && parsedResponse.choices[0].message
          ? parsedResponse.choices[0].message.content
          : ''
      );

      return normalizeStructuredAiTitleResponse(extractJsonObject(msgContent));
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw job && job.canceled ? createCanceledError() : new Error('AI 请求超时。');
      }

      throw error;
    } finally {
      if (job) {
        job.activeControllers.delete(controller);
      }
      clearTimeout(timeoutHandle);
    }
  }

  async function generateSingleProductTitles(
    owner,
    entryId,
    product,
    settings,
    modelName,
    prefixText,
    suffixText,
    extraPrompt,
    targetLength,
    outputLanguage,
    job
  ) {
    throwIfJobCanceled(job);
    const compressedImage = await limitImageProcessing(
      () => compressImageForArk(product.imagePath, settings),
      {
        shouldRun: () => !job || !job.canceled,
        createCanceledError
      }
    );
    throwIfJobCanceled(job);
    const cacheKey = buildAiTitleResultCacheKey(owner, entryId, product, settings, compressedImage, {
      prefixText,
      suffixText,
      extraPrompt,
      targetLength,
      outputLanguage
    });

    if (settings && settings.useCache !== false) {
      const cachedTitleResult = await aiTitleResultCacheStore.getCachedResult(owner, entryId, cacheKey);

      if (cachedTitleResult) {
        return {
          ...cachedTitleResult,
          cacheHit: true,
          cacheKey,
          imageByteLength: Number(cachedTitleResult.imageByteLength) || 0
        };
      }
    }

    throwIfJobCanceled(job);
    const uploadedImage = await uploadCompressedImageForAi(owner, entryId, product, compressedImage, settings, job);
    throwIfJobCanceled(job);
    const prompt = buildStructuredPrompt(
      entryId,
      product,
      prefixText,
      suffixText,
      extraPrompt,
      targetLength,
      outputLanguage
    );
    const titleResult = await requestAiTitles(settings, modelName, prompt, uploadedImage.url, job);

    const successResult = {
      ...composeAiTitles(entryId, titleResult, prefixText, suffixText, outputLanguage, targetLength),
      imageByteLength: compressedImage.byteLength,
      aiImageUrl: uploadedImage.url,
      aiImageKey: uploadedImage.key,
      cacheHit: false,
      cacheKey
    };

    if (!settings || settings.useCache !== false) {
      void aiTitleResultCacheStore.setCachedResult(owner, entryId, cacheKey, successResult).catch((error) => {
        if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
          runtimeLogger.logError('pod_upload_sheet_ai_title_result_cache_write_failed', error);
        }
      });
    }

    return successResult;
  }

  function buildCanceledResult(product, attemptCount = 0) {
    return {
      id: product.id,
      status: 'canceled',
      zhTitle: '',
      enTitle: '',
      patternSummary: '',
      confidence: 'low',
      error: '任务已停止。',
      imageName: product.imageName,
      attemptCount,
      imageByteLength: 0
    };
  }

  function summarizeError(error) {
    return trimApiErrorMessage(error && error.message) || '标题生成失败。';
  }

  return {
    async generateTitles(payload) {
      const owner = getOwner();

      if (!owner) {
        throw new Error('当前未登录，无法调用 AI 标题生成。');
      }

      const settings = applyPayloadRuntimeSettings(await loadRuntimeSettings(owner), payload);
      const { requestedModel, resolvedModel } = resolveModelName(settings.model);
      const products = normalizeIncomingProducts(payload && payload.products);
      const entryId = getResolvedEntryId(payload && payload.entryId);
      const prefixText = normalizeText(payload && payload.prefixText);
      const suffixText = normalizeText(payload && payload.suffixText);
      const extraPrompt = normalizeText(payload && payload.extraPrompt);
      const targetLength = normalizeText(payload && payload.targetLength);
      const outputLanguage = normalizeOutputLanguage(payload && payload.outputLanguage, DEFAULT_OUTPUT_LANGUAGE);
      const runId = normalizeText(payload && payload.runId);
      const localEmitProgress = payload && typeof payload.emitProgress === 'function'
        ? payload.emitProgress
        : null;

      if (!normalizeText(settings.apiBaseUrl)) {
        throw new Error('AI \u63a5\u53e3\u5730\u5740\u672a\u914d\u7f6e\u3002');
      }

      if (!normalizeText(settings.model)) {
        throw new Error('AI \u6a21\u578b\u540d\u79f0\u672a\u914d\u7f6e\u3002');
      }

      if (!normalizeApiKeys(settings.apiKeys, settings.apiKey).length) {
        throw new Error('AI Key \u672a\u914d\u7f6e\u3002');
      }

      if (!products.length) {
        return {
          updatedAt: nowIso(),
          runId,
          entryId,
          requestedModel,
          resolvedModel,
          outputLanguage,
          canceled: false,
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          canceledCount: 0,
          items: []
        };
      }

      const existingJob = getGenerationJob(owner, payload);

      if (existingJob && !existingJob.canceled) {
        throw new Error('已有进行中的 AI 标题任务，请先停止当前任务。');
      }

      const job = createGenerationJob(owner, payload);

      try {
        const progressSnapshot = {
          totalCount: products.length,
          completedCount: 0,
          successCount: 0,
          failedCount: 0,
          canceledCount: 0
        };
        const startedAt = nowIso();
        const emitItemProgress = (product, item) => {
          progressSnapshot.completedCount += 1;

          if (item && item.status === 'success') {
            progressSnapshot.successCount += 1;
          } else if (item && item.status === 'failed') {
            progressSnapshot.failedCount += 1;
          } else {
            progressSnapshot.canceledCount += 1;
          }

          dispatchProgress({
            runId,
            runState: 'progress',
            updatedAt: nowIso(),
            totalCount: progressSnapshot.totalCount,
            completedCount: progressSnapshot.completedCount,
            successCount: progressSnapshot.successCount,
            failedCount: progressSnapshot.failedCount,
            canceledCount: progressSnapshot.canceledCount,
            productId: normalizeText(product && product.id),
            localName: normalizeText(product && product.localName),
            imageName: normalizeText(product && product.imageName),
            item
          }, localEmitProgress);
        };

        dispatchProgress({
          runId,
          runState: 'started',
          updatedAt: startedAt,
          totalCount: progressSnapshot.totalCount,
          completedCount: 0,
          successCount: 0,
          failedCount: 0,
          canceledCount: 0
        }, localEmitProgress);

        const rawItems = await mapWithConcurrency(
          products,
          settings.concurrency,
          async (product) => {
            const maxAttemptCount = Math.max(1, settings.retryLimit + 1);
            let lastError = null;

            for (let attempt = 1; attempt <= maxAttemptCount; attempt += 1) {
              if (job.canceled) {
                const canceledItem = buildCanceledResult(product, attempt - 1);
                emitItemProgress(product, canceledItem);
                return canceledItem;
              }

              try {
                const titleResult = await generateSingleProductTitles(
                  owner,
                  entryId,
                  product,
                  settings,
                  resolvedModel,
                  prefixText,
                  suffixText,
                  extraPrompt,
                  targetLength,
                  outputLanguage,
                  job
                );

                const successItem = {
                  id: product.id,
                  status: 'success',
                  zhTitle: titleResult.zhTitle,
                  enTitle: titleResult.enTitle,
                  usageScenarios: titleResult.usageScenarios,
                  patternSummary: titleResult.patternSummary,
                  confidence: titleResult.confidence,
                  error: '',
                  imageName: product.imageName,
                  attemptCount: attempt,
                  imageByteLength: titleResult.imageByteLength,
                  aiImageUrl: titleResult.aiImageUrl,
                  aiImageKey: titleResult.aiImageKey,
                  cacheHit: titleResult.cacheHit === true,
                  cacheKey: normalizeText(titleResult.cacheKey)
                };
                emitItemProgress(product, successItem);
                return successItem;
              } catch (error) {
                if (isCanceledError(error) || job.canceled) {
                  const canceledItem = buildCanceledResult(product, attempt - 1);
                  emitItemProgress(product, canceledItem);
                  return canceledItem;
                }

                lastError = error;

                if (attempt < maxAttemptCount) {
                  continue;
                }
              }
            }

            if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
              runtimeLogger.logError('pod_upload_sheet_ai_title_generate_failed', lastError);
            }

            const failedItem = {
              id: product.id,
              status: 'failed',
              zhTitle: '',
              enTitle: '',
              patternSummary: '',
              confidence: 'low',
              error: summarizeError(lastError),
              imageName: product.imageName,
              attemptCount: Math.max(1, settings.retryLimit + 1),
              imageByteLength: 0
            };
            emitItemProgress(product, failedItem);
            return failedItem;
          },
          { job }
        );

        const items = products.map((product, index) => rawItems[index] || buildCanceledResult(product));
        const successCount = items.filter((item) => item && item.status === 'success').length;
        const failedCount = items.filter((item) => item && item.status === 'failed').length;
        const canceledCount = items.filter((item) => item && item.status === 'canceled').length;
        const updatedAt = nowIso();

        dispatchProgress({
          runId,
          runState: job.canceled ? 'canceled' : 'completed',
          updatedAt,
          totalCount: items.length,
          completedCount: items.length,
          successCount,
          failedCount,
          canceledCount
        }, localEmitProgress);

        return {
          updatedAt,
          runId,
          entryId,
          requestedModel,
          resolvedModel,
          outputLanguage,
          canceled: job.canceled,
          totalCount: items.length,
          successCount,
          failedCount,
          canceledCount,
          items
        };
      } finally {
        clearGenerationJob(job);
      }
    },
    async cancelGeneration(payload) {
      const owner = getOwner();
      const job = getGenerationJob(owner, payload);

      if (!job) {
        return {
          canceled: false
        };
      }

      job.canceled = true;
      Array.from(job.activeControllers).forEach((controller) => {
        try {
          controller.abort();
        } catch (_error) {}
      });

      return {
        canceled: true,
        runId: normalizeText(payload && payload.runId)
      };
    }
  };
}

module.exports = {
  createPodUploadSheetMiaoshouAiTitleService
};
