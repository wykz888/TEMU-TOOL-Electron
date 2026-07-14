const {
  assertDirectory,
  assertFile,
  collectImageFiles
} = require('./podSuiteFileSystemUtils');
const {
  normalizeProvidedPsdSourceFiles
} = require('./podSuitePsdPayloadUtils');
const {
  normalizeAbsolutePath
} = require('./podSuitePsdRuntimeRules');

async function collectPsdSourceFiles({
  imageDirectoryPath,
  sourceFiles
}) {
  await assertDirectory(imageDirectoryPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684PSD\u7d20\u6750\u56fe\u7247\u6587\u4ef6\u5939\u3002');

  const providedSourceFiles = normalizeProvidedPsdSourceFiles(imageDirectoryPath, sourceFiles);
  if (providedSourceFiles.length) {
    return providedSourceFiles;
  }

  const collectedSourceFiles = await collectImageFiles(imageDirectoryPath);
  if (!collectedSourceFiles.length) {
    throw new Error('\u7d20\u6750\u6587\u4ef6\u5939\u4e2d\u6ca1\u6709\u53ef\u7528\u56fe\u7247\u3002');
  }

  return collectedSourceFiles;
}

async function resolvePsdMetadataSourceConfig(sourcePayload) {
  const metadataSourcePath = normalizeAbsolutePath(sourcePayload && sourcePayload.metadataSourcePath);
  const metadataSourceDirectoryPath = normalizeAbsolutePath(sourcePayload && sourcePayload.metadataSourceDirectoryPath);
  let metadataSourceFiles = [];

  if (metadataSourceDirectoryPath) {
    await assertDirectory(metadataSourceDirectoryPath, '\u5143\u6570\u636e\u539f\u56fe\u76ee\u5f55\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002');
    metadataSourceFiles = await collectImageFiles(metadataSourceDirectoryPath);
    if (!metadataSourceFiles.length) {
      throw new Error('\u5143\u6570\u636e\u539f\u56fe\u76ee\u5f55\u4e2d\u6ca1\u6709\u53ef\u7528\u56fe\u7247\u3002');
    }
  } else if (metadataSourcePath) {
    await assertFile(metadataSourcePath, '\u5143\u6570\u636e\u6765\u6e90\u56fe\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002');
  }

  return {
    metadataSourcePath,
    metadataSourceDirectoryPath,
    metadataSourceFiles
  };
}

function createMetadataSourcePathPicker(metadataSourcePath, metadataSourceFiles) {
  const pool = Array.isArray(metadataSourceFiles)
    ? metadataSourceFiles
      .map((item) => normalizeAbsolutePath(item && item.filePath))
      .filter(Boolean)
    : [];

  return function pickMetadataSourcePath() {
    if (!pool.length) {
      return metadataSourcePath;
    }

    return pool[Math.floor(Math.random() * pool.length)] || metadataSourcePath;
  };
}

module.exports = {
  collectPsdSourceFiles,
  createMetadataSourcePathPicker,
  resolvePsdMetadataSourceConfig
};
