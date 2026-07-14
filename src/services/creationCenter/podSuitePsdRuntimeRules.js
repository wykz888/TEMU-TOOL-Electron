const path = require('node:path');

const PSD_ENGINE_SINGLE_MODE = 1;
const DEFAULT_PSD_ENGINE_CONCURRENCY = 2;
const MAX_PSD_ACTIVE_ENGINE_COUNT = 24;

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeAbsolutePath(value) {
  const text = normalizeText(value);
  return text ? path.resolve(text) : '';
}

function sanitizeFileNameSegment(value) {
  const text = normalizeText(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return text || 'image';
}

function getPathFileName(filePath) {
  return path.basename(normalizeText(filePath));
}

function normalizePsdSliceOptions(value) {
  const source = value && typeof value === 'object' ? value : {};
  const mode = normalizeText(source.mode || source.sliceMode || 'original');
  const normalizedMode = ['original', 'guides', 'slices'].includes(mode) ? mode : 'original';

  return {
    mode: normalizedMode
  };
}

function isPsdSliceEnabled(options) {
  return options && ['guides', 'slices'].includes(options.mode);
}

function normalizePsdOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(format) ? format : 'png';
}

function normalizePsdImageQuality(value) {
  const quality = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, quality));
}

function normalizePsdReplacementMode(value) {
  const mode = normalizeText(value);
  return ['cover-canvas', 'contain-canvas', 'layer-bounds-transform'].includes(mode)
    ? mode
    : 'cover-canvas';
}

function normalizePsdSourceRotation(value) {
  const mode = normalizeText(value);
  return ['left', 'right'].includes(mode) ? mode : 'none';
}

function normalizePsdEngineConcurrency(value) {
  const count = Math.round(Number(value) || DEFAULT_PSD_ENGINE_CONCURRENCY);
  return Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, count));
}

function getPsdEngineWorkerMultiplier(engineConcurrency) {
  const normalizedConcurrency = normalizePsdEngineConcurrency(engineConcurrency);
  return normalizedConcurrency <= PSD_ENGINE_SINGLE_MODE ? 0 : normalizedConcurrency - 1;
}

function getPsdEngineConcurrencyLabel(engineConcurrency) {
  const multiplier = getPsdEngineWorkerMultiplier(engineConcurrency);
  return multiplier > 0
    ? `\u6837\u673a\u6570\u5e76\u53d1\u00d7${multiplier}`
    : '\u5355\u7ebf\u7a0b\u987a\u5e8f\u6267\u884c';
}

function buildPsdSmartObjectOutputPath({ outputDirectoryPath, sourceFile, outputFormat }) {
  const sourceDirectory = path.dirname(sourceFile.relativePath || '');
  const sourceBaseName = sanitizeFileNameSegment(
    path.basename(sourceFile.fileName || sourceFile.relativePath || 'image', path.extname(sourceFile.fileName || ''))
  );
  const relativeOutputDirectory = sourceDirectory && sourceDirectory !== '.'
    ? path.join(outputDirectoryPath, sourceDirectory)
    : outputDirectoryPath;

  return path.join(relativeOutputDirectory, `${sourceBaseName}.${normalizePsdOutputFormat(outputFormat)}`);
}

function buildPsdSmartObjectSliceOutputPath({ outputDirectoryPath, sourceFile, outputFormat }) {
  const sourceDirectory = path.dirname(sourceFile.relativePath || '');
  const sourceBaseName = sanitizeFileNameSegment(
    path.basename(sourceFile.fileName || sourceFile.relativePath || 'image', path.extname(sourceFile.fileName || ''))
  );
  const relativeOutputDirectory = sourceDirectory && sourceDirectory !== '.'
    ? path.join(outputDirectoryPath, sourceDirectory)
    : outputDirectoryPath;

  return path.join(relativeOutputDirectory, sourceBaseName, `${sourceBaseName}.${normalizePsdOutputFormat(outputFormat)}`);
}

function normalizeOutputIdentity(targetPath) {
  const text = normalizeAbsolutePath(targetPath);
  return process.platform === 'win32' ? text.toLowerCase() : text;
}

function buildPsdOutputIdentity({ outputPath, outputFormat, sliceEnabled }) {
  const normalizedOutputPath = normalizeAbsolutePath(outputPath);
  if (!sliceEnabled) {
    return `file:${normalizeOutputIdentity(normalizedOutputPath)}`;
  }

  const normalizedFormat = normalizePsdOutputFormat(outputFormat);
  const baseName = path.basename(normalizedOutputPath, path.extname(normalizedOutputPath));
  return `slice:${normalizeOutputIdentity(path.dirname(normalizedOutputPath))}:${baseName.toLowerCase()}:${normalizedFormat}`;
}

function getPsdMockupOutputDirectoryPath(mockup, fallbackOutputDirectoryPath) {
  const source = mockup && typeof mockup === 'object' ? mockup : {};
  return normalizeAbsolutePath(source.outputDirectoryPath || fallbackOutputDirectoryPath);
}

function getPsdMockupOutputFormat(mockup, fallbackOutputFormat) {
  const source = mockup && typeof mockup === 'object' ? mockup : {};
  return normalizePsdOutputFormat(source.outputFormat || fallbackOutputFormat);
}

function getPsdMockupImageQuality(mockup, fallbackImageQuality) {
  const source = mockup && typeof mockup === 'object' ? mockup : {};
  return normalizePsdImageQuality(
    Object.prototype.hasOwnProperty.call(source, 'imageQuality')
      ? source.imageQuality
      : fallbackImageQuality
  );
}

function getPsdMockupSliceOptions(mockup, fallbackSliceOptions) {
  const source = mockup && typeof mockup === 'object' ? mockup : {};
  if (source.sliceOptions && typeof source.sliceOptions === 'object') {
    return normalizePsdSliceOptions(source.sliceOptions);
  }

  if (source.exportMode || source.sliceMode) {
    return normalizePsdSliceOptions({
      mode: source.exportMode || source.sliceMode
    });
  }

  return normalizePsdSliceOptions(fallbackSliceOptions);
}

function decoratePsdSourceFiles(sourceFiles) {
  const files = Array.isArray(sourceFiles) ? sourceFiles : [];
  return files.map((sourceFile, index) => ({
    ...(sourceFile && typeof sourceFile === 'object' ? sourceFile : {}),
    sourceIndex: index + 1,
    sourceCount: files.length
  }));
}

function splitPsdSourceFiles(sourceFiles, requestedWorkerCount) {
  const files = Array.isArray(sourceFiles) ? sourceFiles : [];
  const workerCount = Math.max(1, Math.min(files.length || 1, Math.round(Number(requestedWorkerCount) || 1)));
  const chunks = [];
  let startIndex = 0;

  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    const remainingFiles = files.length - startIndex;
    const remainingWorkers = workerCount - workerIndex;
    const chunkSize = Math.ceil(remainingFiles / remainingWorkers);
    const chunk = files.slice(startIndex, startIndex + chunkSize);
    startIndex += chunkSize;

    if (chunk.length) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function buildPsdMockupWorkUnits(mockups, sourceFiles, engineConcurrency) {
  const mockupList = Array.isArray(mockups) ? mockups : [];
  const sourceList = decoratePsdSourceFiles(sourceFiles);
  const multiplier = getPsdEngineWorkerMultiplier(engineConcurrency);
  const workersPerMockup = multiplier > 0 ? multiplier : 1;
  const workUnits = [];

  mockupList.forEach((mockup, mockupIndex) => {
    const outputIdentitySet = new Set();
    splitPsdSourceFiles(sourceList, workersPerMockup).forEach((sourceChunk, workerIndex, chunks) => {
      workUnits.push({
        mockup,
        mockupIndex,
        workerIndex,
        workerCount: chunks.length,
        sourceFiles: sourceChunk,
        outputIdentitySet
      });
    });
  });

  return {
    workUnits,
    sourceFiles: sourceList,
    workerMultiplier: multiplier,
    workersPerMockup,
    maxConcurrentEngines: multiplier > 0
      ? Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, mockupList.length * multiplier))
      : 1
  };
}

function getPsdSourceProgressIndex(sourceFile, fallbackIndex) {
  const sourceIndex = Math.round(Number(sourceFile && sourceFile.sourceIndex) || 0);
  return sourceIndex > 0 ? sourceIndex : fallbackIndex + 1;
}

function getPsdSourceProgressCount(sourceFile, fallbackSourceFiles) {
  const sourceCount = Math.round(Number(sourceFile && sourceFile.sourceCount) || 0);
  return sourceCount > 0 ? sourceCount : Array.isArray(fallbackSourceFiles) ? fallbackSourceFiles.length : 0;
}

function getPsdSourceProgressName(sourceFile) {
  return sourceFile && sourceFile.fileName
    ? sourceFile.fileName
    : getPathFileName(sourceFile && sourceFile.filePath);
}

function getPsdSourceRetryKey(sourceFile) {
  return normalizeOutputIdentity(sourceFile && sourceFile.filePath ? sourceFile.filePath : '');
}

module.exports = {
  DEFAULT_PSD_ENGINE_CONCURRENCY,
  MAX_PSD_ACTIVE_ENGINE_COUNT,
  PSD_ENGINE_SINGLE_MODE,
  buildPsdMockupWorkUnits,
  buildPsdOutputIdentity,
  buildPsdSmartObjectOutputPath,
  buildPsdSmartObjectSliceOutputPath,
  decoratePsdSourceFiles,
  getPathFileName,
  getPsdEngineConcurrencyLabel,
  getPsdEngineWorkerMultiplier,
  getPsdMockupImageQuality,
  getPsdMockupOutputDirectoryPath,
  getPsdMockupOutputFormat,
  getPsdMockupSliceOptions,
  getPsdSourceProgressCount,
  getPsdSourceProgressIndex,
  getPsdSourceProgressName,
  getPsdSourceRetryKey,
  isPsdSliceEnabled,
  normalizeAbsolutePath,
  normalizeOutputIdentity,
  normalizePsdEngineConcurrency,
  normalizePsdImageQuality,
  normalizePsdOutputFormat,
  normalizePsdReplacementMode,
  normalizePsdSliceOptions,
  normalizePsdSourceRotation,
  normalizeText,
  sanitizeFileNameSegment,
  splitPsdSourceFiles
};
