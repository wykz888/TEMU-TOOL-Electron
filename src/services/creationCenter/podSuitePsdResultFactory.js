const {
  normalizeAbsolutePath,
  normalizePsdSourceRotation,
  normalizeText,
  sanitizeFileNameSegment
} = require('./podSuitePsdRuntimeRules');

function getIsoTimestamp() {
  return new Date().toISOString();
}

function createFailedPsdMockupResult({
  mockup,
  index,
  outputFormat,
  metadataSourcePath,
  metadataSourceDirectoryPath,
  metadataSourceFiles,
  engineConcurrency,
  sliceOptions,
  totalInputCount,
  message
}) {
  return {
    success: false,
    updatedAt: getIsoTimestamp(),
    psdPath: normalizeAbsolutePath(mockup && mockup.psdPath),
    smartObjectName: normalizeText(mockup && mockup.smartObjectName),
    sourceRotation: normalizePsdSourceRotation(mockup && mockup.sourceRotation),
    outputSubdirName: sanitizeFileNameSegment(mockup && mockup.outputSubdirName || `PSD\u5957\u56fe${index > 0 ? index + 1 : ''}`),
    outputFormat,
    metadataSourcePath,
    metadataSourceDirectoryPath,
    metadataSourcePoolCount: Array.isArray(metadataSourceFiles) ? metadataSourceFiles.length : 0,
    engineConcurrency,
    sliceOptions,
    totalInputCount,
    generatedCount: 0,
    sliceGeneratedCount: 0,
    skippedCount: 0,
    failedCount: 1,
    items: [],
    failures: [{
      sourcePath: normalizeAbsolutePath(mockup && mockup.psdPath),
      message
    }]
  };
}

function mergePsdMockupResults({
  mockup,
  index,
  partialResults,
  outputFormat,
  metadataSourcePath,
  metadataSourceDirectoryPath,
  metadataSourceFiles,
  engineConcurrency,
  sliceOptions,
  totalInputCount
}) {
  const results = (Array.isArray(partialResults) ? partialResults : [])
    .filter((result) => result && typeof result === 'object');

  if (!results.length) {
    return createFailedPsdMockupResult({
      mockup,
      index,
      outputFormat,
      metadataSourcePath,
      metadataSourceDirectoryPath,
      metadataSourceFiles,
      engineConcurrency,
      sliceOptions,
      totalInputCount,
      message: '\u6837\u673a\u672a\u751f\u6210\u4efb\u4f55\u7ed3\u679c\u3002'
    });
  }

  const baseResult = results.find((result) => result.success !== false) || results[0];
  const items = results.flatMap((result) => Array.isArray(result.items) ? result.items : []);
  const failures = results.flatMap((result) => Array.isArray(result.failures) ? result.failures : []);

  return {
    ...baseResult,
    success: failures.length === 0 || items.length > 0,
    updatedAt: getIsoTimestamp(),
    totalInputCount,
    generatedCount: results.reduce((count, result) => count + (Number(result.generatedCount) || 0), 0),
    sliceGeneratedCount: results.reduce((count, result) => count + (Number(result.sliceGeneratedCount) || 0), 0),
    skippedCount: results.reduce((count, result) => count + (Number(result.skippedCount) || 0), 0),
    failedCount: failures.length,
    items,
    failures
  };
}

module.exports = {
  createFailedPsdMockupResult,
  mergePsdMockupResults
};
