const {
  createHash,
  normalizeText
} = require('../shopManagement/common');
const {
  getPodMiaoshouStorageFingerprint
} = require('./podUploadSheetMiaoshouStorageProviderContext');

const AI_TITLE_COMPRESSED_CACHE_KEY_VERSION = 'compressed-v2-material-root';
const AI_TITLE_SOURCE_CACHE_KEY_VERSION = 'source-stat-v2-material-root';

function getAiTitleProductIdentityFields(product) {
  return [
    normalizeText(product && product.id),
    normalizeText(product && product.localName),
    normalizeText(product && product.sourceFolder),
    normalizeText(product && product.mainNumber),
    normalizeText(product && product.categoryId),
    normalizeText(product && product.categoryLabel),
    normalizeText(product && product.imageName),
    normalizeText(product && product.imagePath)
  ];
}

function getAiTitlePromptIdentityFields(promptOptions = {}) {
  return [
    normalizeText(promptOptions.prefixText),
    normalizeText(promptOptions.suffixText),
    normalizeText(promptOptions.extraPrompt),
    normalizeText(promptOptions.targetLength),
    normalizeText(promptOptions.outputLanguage)
  ];
}

function getAiTitleSettingsIdentityFields(settings) {
  return [
    normalizeText(settings && settings.apiBaseUrl),
    normalizeText(settings && settings.model),
    normalizeText(settings && settings.imageCompression),
    Number(settings && settings.imageQuality) || 0
  ];
}

function buildAiTitleCompressedResultCacheKey({
  entryId,
  owner,
  product,
  settings,
  compressedImage,
  storageContext,
  promptOptions
} = {}) {
  return createHash([
    AI_TITLE_COMPRESSED_CACHE_KEY_VERSION,
    normalizeText(entryId),
    normalizeText(owner && owner.userKey),
    getPodMiaoshouStorageFingerprint(storageContext),
    ...getAiTitleProductIdentityFields(product),
    Number(compressedImage && compressedImage.fileStat && compressedImage.fileStat.size) || 0,
    Number(compressedImage && compressedImage.fileStat && compressedImage.fileStat.mtimeMs) || 0,
    Number(compressedImage && compressedImage.byteLength) || 0,
    Number(compressedImage && compressedImage.maxDimension) || 0,
    Number(compressedImage && compressedImage.quality) || 0,
    normalizeText(compressedImage && compressedImage.imageCompression),
    normalizeText(compressedImage && compressedImage.extension),
    ...getAiTitleSettingsIdentityFields(settings),
    ...getAiTitlePromptIdentityFields(promptOptions)
  ].join('|'), 32);
}

function buildAiTitleSourceResultCacheKey({
  entryId,
  owner,
  product,
  settings,
  fileStat,
  storageContext,
  promptOptions
} = {}) {
  if (!fileStat) {
    return '';
  }

  return createHash([
    AI_TITLE_SOURCE_CACHE_KEY_VERSION,
    normalizeText(entryId),
    normalizeText(owner && owner.userKey),
    getPodMiaoshouStorageFingerprint(storageContext),
    ...getAiTitleProductIdentityFields(product),
    Number(fileStat && fileStat.size) || 0,
    Number(fileStat && fileStat.mtimeMs) || 0,
    ...getAiTitleSettingsIdentityFields(settings),
    ...getAiTitlePromptIdentityFields(promptOptions)
  ].join('|'), 32);
}

function getUniqueAiTitleCacheKeys(cacheKeys) {
  const seenKeys = new Set();

  return (Array.isArray(cacheKeys) ? cacheKeys : [])
    .map((cacheKey) => normalizeText(cacheKey))
    .filter((cacheKey) => {
      if (!cacheKey || seenKeys.has(cacheKey)) {
        return false;
      }

      seenKeys.add(cacheKey);
      return true;
    });
}

module.exports = {
  AI_TITLE_COMPRESSED_CACHE_KEY_VERSION,
  AI_TITLE_SOURCE_CACHE_KEY_VERSION,
  buildAiTitleCompressedResultCacheKey,
  buildAiTitleSourceResultCacheKey,
  getUniqueAiTitleCacheKeys
};
