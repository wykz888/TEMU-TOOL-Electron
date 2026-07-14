const path = require('node:path');

const PSD_IMAGE_EXTENSIONS = Object.freeze([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.heic',
  '.heif'
]);

const PSD_IMAGE_EXTENSION_SET = new Set(PSD_IMAGE_EXTENSIONS);

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeAbsolutePath(value) {
  const text = normalizeText(value);
  return text ? path.resolve(text) : '';
}

function normalizePsdTaskRunId(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return normalizeText(source.runId || source.windowRunId);
}

function normalizePsdEngineWindowVisible(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return source.showEngineWindow === true
    || source.visible === true
    || normalizeText(source.engineWindowMode) === 'visible'
    || normalizeText(source.mode) === 'visible';
}

function getPsdMockupPayloads(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  if (Array.isArray(source.psdMockups) && source.psdMockups.length) {
    return source.psdMockups;
  }

  if (Array.isArray(source.mockups) && source.mockups.length) {
    return source.mockups;
  }

  return [source];
}

function getProvidedPsdSourceFiles(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  if (Array.isArray(source.sourceFiles)) {
    return source.sourceFiles;
  }

  if (Array.isArray(source.psdSourceFiles)) {
    return source.psdSourceFiles;
  }

  return [];
}

function isPathInsideDirectory(directoryPath, filePath) {
  const directory = normalizeAbsolutePath(directoryPath);
  const targetPath = normalizeAbsolutePath(filePath);

  if (!directory || !targetPath) {
    return false;
  }

  const relativePath = path.relative(directory, targetPath);
  return Boolean(
    relativePath
    && relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

function normalizeProvidedPsdSourceFiles(imageDirectoryPath, sourceFiles) {
  const rootDirectoryPath = normalizeAbsolutePath(imageDirectoryPath);
  const seenPaths = new Set();

  if (!rootDirectoryPath || !Array.isArray(sourceFiles) || !sourceFiles.length) {
    return [];
  }

  return sourceFiles.reduce((result, item) => {
    const source = item && typeof item === 'object' ? item : {};
    const filePath = normalizeAbsolutePath(source.filePath || source.path || source.sourcePath || source.absolutePath);
    const extension = path.extname(filePath).toLowerCase();

    if (!filePath || !PSD_IMAGE_EXTENSION_SET.has(extension) || !isPathInsideDirectory(rootDirectoryPath, filePath)) {
      return result;
    }

    const identity = process.platform === 'win32' ? filePath.toLowerCase() : filePath;

    if (seenPaths.has(identity)) {
      return result;
    }

    seenPaths.add(identity);
    result.push({
      filePath,
      relativePath: normalizeText(source.relativePath) || path.relative(rootDirectoryPath, filePath).split(path.sep).join('/'),
      fileName: normalizeText(source.fileName) || path.basename(filePath)
    });
    return result;
  }, []);
}

module.exports = {
  getProvidedPsdSourceFiles,
  getPsdMockupPayloads,
  normalizeProvidedPsdSourceFiles,
  normalizePsdEngineWindowVisible,
  normalizePsdTaskRunId
};
