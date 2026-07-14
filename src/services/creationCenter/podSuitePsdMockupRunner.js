const fs = require('node:fs');
const path = require('node:path');
const {
  parsePsdGuideMetadata
} = require('./psdGuideParser');
const {
  hasCompleteSliceOutputs,
  writeImageSlices
} = require('./psdSliceExporter');
const {
  assertDirectory,
  assertFile,
  pathExists
} = require('./podSuiteFileSystemUtils');
const {
  emitPsdProgress,
  getIsoTimestamp
} = require('./podSuitePsdProgressUtils');
const {
  createMetadataSourcePathPicker
} = require('./podSuitePsdSourceResolver');
const {
  PSD_MOCKUP_ITEM_RETRY_MAX_ATTEMPTS,
  PSD_MOCKUP_OPEN_MAX_ATTEMPTS,
  isRecoverablePsdMockupOpenError,
  throwIfPsdTaskCanceled
} = require('./podSuitePsdTaskRuntime');
const {
  buildPsdOutputIdentity,
  buildPsdSmartObjectOutputPath,
  buildPsdSmartObjectSliceOutputPath,
  getPathFileName,
  getPsdMockupImageQuality,
  getPsdMockupOutputFormat,
  getPsdMockupSliceOptions,
  getPsdSourceProgressCount,
  getPsdSourceProgressIndex,
  getPsdSourceProgressName,
  getPsdSourceRetryKey,
  isPsdSliceEnabled,
  normalizeAbsolutePath,
  normalizePsdReplacementMode,
  normalizePsdSourceRotation,
  normalizeText,
  sanitizeFileNameSegment
} = require('./podSuitePsdRuntimeRules');

async function runSinglePsdSmartObjectMockup({
  payload,
  index,
  imageDirectoryPath,
  outputRootDirectoryPath,
  outputFormat,
  imageQuality,
  metadataSourcePath,
  metadataSourceDirectoryPath,
  metadataSourceFiles,
  sliceOptions,
  showEngineWindow,
  skipExistingOutputs,
  sourceFiles,
  taskSignal,
  emitProgress,
  runtimeLogger,
  tempRootDir,
  engineStartupLimiter,
  postProcessLimiter,
  postProcessConcurrency,
  seenOutputIdentities,
  psdLayerMetadata
}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const psdPath = normalizeAbsolutePath(source.psdPath);
  const smartObjectName = normalizeText(source.smartObjectName);
  const sourceRotation = normalizePsdSourceRotation(source.sourceRotation);
  const replacementMode = normalizePsdReplacementMode(source.replacementMode);
  const mockupOutputFormat = getPsdMockupOutputFormat(source, outputFormat);
  const mockupImageQuality = getPsdMockupImageQuality(source, imageQuality);
  const mockupSliceOptions = getPsdMockupSliceOptions(source, sliceOptions);
  const outputSubdirName = sanitizeFileNameSegment(source.outputSubdirName || `PSD\u5957\u56fe${index > 0 ? index + 1 : ''}`);
  const outputDirectoryPath = path.join(outputRootDirectoryPath, outputSubdirName);
  const totalSourceCount = Math.round(Number(sourceFiles[0] && sourceFiles[0].sourceCount) || sourceFiles.length || 0);
  const mockupProgressBase = {
    mockupIndex: index + 1,
    mockupName: outputSubdirName,
    psdPath,
    psdName: getPathFileName(psdPath),
    sourceCount: totalSourceCount
  };

  emitPsdProgress(emitProgress, {
    ...mockupProgressBase,
    phase: 'mockup-prepare'
  });
  await assertFile(psdPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684PSD\u6837\u673a\u6587\u4ef6\u3002');
  await assertDirectory(outputRootDirectoryPath, '\u8bf7\u5148\u9009\u62e9\u8fd9\u4e2aPSD\u6837\u673a\u7684\u5bfc\u51fa\u4e3b\u76ee\u5f55\u3002');
  if (!smartObjectName) {
    throw new Error('\u8bf7\u8f93\u5165\u9700\u8981\u66ff\u6362\u7684\u667a\u80fd\u5bf9\u8c61\u540d\u79f0\u3002');
  }

  await fs.promises.mkdir(outputDirectoryPath, {
    recursive: true
  });

  const guideMetadata = isPsdSliceEnabled(mockupSliceOptions)
    ? await parsePsdGuideMetadata(psdPath).catch((error) => {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError('pod_suite_tool_psd_guides_parse_failed', error);
      }

      return null;
    })
    : null;

  const {
    renderPsdSmartObjectMockups
  } = require('./photopeaSmartObjectRenderer');
  const sliceEnabled = isPsdSliceEnabled(mockupSliceOptions);
  const metadataSourcePathForSource = createMetadataSourcePathPicker(metadataSourcePath, metadataSourceFiles);
  const outputIdentitySet = seenOutputIdentities && typeof seenOutputIdentities.has === 'function'
    ? seenOutputIdentities
    : new Set();
  const collectedItems = [];
  const collectedFailures = [];
  let currentSourceFiles = sourceFiles;
  let lastRenderResult = null;
  const retryAttemptBySourceKey = new Map();

  function removeRetryOutputIdentity(sourceFile) {
    if (!outputIdentitySet || typeof outputIdentitySet.delete !== 'function') {
      return;
    }

    const retryOutputPath = sliceEnabled
      ? buildPsdSmartObjectSliceOutputPath({
        outputDirectoryPath,
        sourceFile,
        outputFormat: mockupOutputFormat
      })
      : buildPsdSmartObjectOutputPath({
        outputDirectoryPath,
        sourceFile,
        outputFormat: mockupOutputFormat
      });
    outputIdentitySet.delete(buildPsdOutputIdentity({
      outputPath: retryOutputPath,
      outputFormat: mockupOutputFormat,
      sliceEnabled
    }));
  }

  while (currentSourceFiles.length) {
    const currentSourceFile = currentSourceFiles[0];
    const currentSourceKey = getPsdSourceRetryKey(currentSourceFile);
    const currentSourceAttempt = (retryAttemptBySourceKey.get(currentSourceKey) || 0) + 1;
    for (let openAttempt = 1; openAttempt <= PSD_MOCKUP_OPEN_MAX_ATTEMPTS; openAttempt += 1) {
      try {
        lastRenderResult = await renderPsdSmartObjectMockups({
          psdPath,
          smartObjectName,
          sourceRotation,
          replacementMode,
          sourceFiles: currentSourceFiles,
          outputPathForSource(sourceFile) {
            return buildPsdSmartObjectOutputPath({
              outputDirectoryPath,
              sourceFile,
              outputFormat: mockupOutputFormat
            });
          },
          async shouldSkipSource({ sourceFile, outputPath }) {
            if (skipExistingOutputs !== true) {
              return null;
            }

            const targetOutputPath = sliceEnabled
              ? buildPsdSmartObjectSliceOutputPath({
                outputDirectoryPath,
                sourceFile,
                outputFormat: mockupOutputFormat
              })
              : outputPath;
            const outputIdentity = buildPsdOutputIdentity({
              outputPath: targetOutputPath,
              outputFormat: mockupOutputFormat,
              sliceEnabled
            });
            if (outputIdentitySet.has(outputIdentity)) {
              return {
                skip: true,
                reason: '\u4fdd\u5b58\u8def\u5f84\u91cd\u590d\uff0c\u5df2\u8df3\u8fc7\u3002'
              };
            }

            outputIdentitySet.add(outputIdentity);
            const exists = sliceEnabled
              ? await hasCompleteSliceOutputs({
                outputPath: targetOutputPath,
                options: mockupSliceOptions,
                guideMetadata,
                outputFormat: mockupOutputFormat
              })
              : await pathExists(targetOutputPath);
            if (!exists) {
              return null;
            }

            return {
              skip: true,
              reason: '\u5bfc\u51fa\u7ed3\u679c\u5df2\u5b58\u5728\uff0c\u5df2\u8df3\u8fc7\u3002'
            };
          },
          processOutputForSource: sliceEnabled
            ? async ({ sourceFile, output, inputPath, outputBuffer, metadataSourcePath: itemMetadataSourcePath }) => {
              const inputFilePath = normalizeAbsolutePath(inputPath || output && output.filePath);
              const hasOutputBuffer = Buffer.isBuffer(outputBuffer);
              const sliceBaseOutputPath = buildPsdSmartObjectSliceOutputPath({
                outputDirectoryPath,
                sourceFile,
                outputFormat: mockupOutputFormat
              });

              try {
                emitPsdProgress(emitProgress, {
                  ...mockupProgressBase,
                  phase: 'slice',
                  sourcePath: sourceFile && sourceFile.filePath ? sourceFile.filePath : '',
                  sourceName: sourceFile && sourceFile.fileName ? sourceFile.fileName : getPathFileName(sourceFile && sourceFile.filePath)
                });
                const sliceOutputs = await writeImageSlices({
                  inputPath: hasOutputBuffer ? '' : inputFilePath,
                  inputBuffer: hasOutputBuffer ? outputBuffer : null,
                  outputPath: sliceBaseOutputPath,
                  options: mockupSliceOptions,
                  guideMetadata,
                  outputFormat: mockupOutputFormat,
                  imageQuality: mockupImageQuality,
                  metadataSourcePath: itemMetadataSourcePath,
                  concurrency: Math.max(1, Math.min(3, Math.round(Number(postProcessConcurrency) || 1))),
                  metadataSourcePathForSlice: metadataSourceFiles.length
                    ? metadataSourcePathForSource
                    : null
                });

                return {
                  outputs: sliceOutputs.map((sliceOutput) => ({
                    ...sliceOutput,
                    type: 'slice'
                  })),
                  failures: []
                };
              } catch (error) {
                const message = String(error && error.message || error || '').trim();
                if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
                  runtimeLogger.logError('pod_suite_tool_psd_slice_failed', error);
                }

                return {
                  outputs: [],
                  error: message,
                  failures: [{
                    sourcePath: sourceFile && sourceFile.filePath ? sourceFile.filePath : inputFilePath,
                    message
                  }]
                };
              } finally {
                if (inputFilePath && inputPath && !hasOutputBuffer) {
                  await fs.promises.rm(inputFilePath, {
                    force: true
                  }).catch(() => {});
                }
              }
            }
            : null,
          outputFormat: mockupOutputFormat,
          imageQuality: mockupImageQuality,
          metadataSourcePath,
          metadataSourcePathForSource,
          onProgress(progressPayload) {
            emitPsdProgress(emitProgress, {
              ...mockupProgressBase,
              openAttempt,
              itemRetryAttempt: currentSourceAttempt,
              maxOpenAttempts: PSD_MOCKUP_OPEN_MAX_ATTEMPTS,
              ...(progressPayload && typeof progressPayload === 'object' ? progressPayload : {})
            });
          },
          showEngineWindow,
          runtimeLogger,
          taskSignal,
          tempRootDir,
          engineStartupLimiter,
          postProcessLimiter,
          postProcessConcurrency,
          psdLayerMetadata,
          stopOnRecoverableItemError: true
        });
        break;
      } catch (error) {
        throwIfPsdTaskCanceled(taskSignal);
        if (!isRecoverablePsdMockupOpenError(error) || openAttempt >= PSD_MOCKUP_OPEN_MAX_ATTEMPTS) {
          throw error;
        }

        emitPsdProgress(emitProgress, {
          ...mockupProgressBase,
          phase: 'mockup-retry',
          openAttempt: openAttempt + 1,
          maxOpenAttempts: PSD_MOCKUP_OPEN_MAX_ATTEMPTS,
          message: 'PSD\u6253\u5f00\u8d85\u65f6\uff0c\u5df2\u5173\u95ed\u5f53\u524d\u5f15\u64ce\u7a97\u53e3\uff0c\u6b63\u5728\u91cd\u65b0\u6253\u5f00\u3002'
        });
        if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
          runtimeLogger.logError('pod_suite_tool_psd_mockup_open_retry', error);
        }
      }
    }

    if (Array.isArray(lastRenderResult.items) && lastRenderResult.items.length) {
      collectedItems.push(...lastRenderResult.items);
    }
    if (Array.isArray(lastRenderResult.failures) && lastRenderResult.failures.length) {
      collectedFailures.push(...lastRenderResult.failures);
    }

    if (!lastRenderResult || !lastRenderResult.retrySourceFile) {
      break;
    }

    const retrySourceFile = lastRenderResult.retrySourceFile;
    const retrySourceKey = getPsdSourceRetryKey(retrySourceFile);
    const retrySourceAttempt = (retryAttemptBySourceKey.get(retrySourceKey) || 0) + 1;
    retryAttemptBySourceKey.set(retrySourceKey, retrySourceAttempt);
    const retrySourceMessage = normalizeText(lastRenderResult.retrySourceMessage) || 'PSD\u5f15\u64ce\u6267\u884c\u8d85\u65f6\uff0c\u6b63\u5728\u91cd\u8bd5\u3002';
    emitPsdProgress(emitProgress, {
      ...mockupProgressBase,
      phase: 'item-retry',
      sourceIndex: getPsdSourceProgressIndex(retrySourceFile, 0),
      sourceCount: getPsdSourceProgressCount(retrySourceFile, currentSourceFiles),
      sourcePath: normalizeAbsolutePath(retrySourceFile && retrySourceFile.filePath),
      sourceName: getPsdSourceProgressName(retrySourceFile),
      itemRetryAttempt: retrySourceAttempt,
      maxItemRetryAttempts: PSD_MOCKUP_ITEM_RETRY_MAX_ATTEMPTS,
      message: retrySourceMessage
    });
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(
        'pod_suite_tool_psd_item_retry',
        new Error(retrySourceMessage)
      );
    }
    removeRetryOutputIdentity(retrySourceFile);

    if (retrySourceAttempt >= PSD_MOCKUP_ITEM_RETRY_MAX_ATTEMPTS) {
      collectedFailures.push({
        sourcePath: normalizeAbsolutePath(retrySourceFile && retrySourceFile.filePath),
        message: retrySourceMessage
      });
      currentSourceFiles = Array.isArray(lastRenderResult.remainingSourceFiles)
        ? lastRenderResult.remainingSourceFiles
        : [];
      continue;
    }

    currentSourceFiles = [retrySourceFile].concat(
      Array.isArray(lastRenderResult.remainingSourceFiles)
        ? lastRenderResult.remainingSourceFiles
        : []
    );
  }

  if (!lastRenderResult && !collectedItems.length && !collectedFailures.length) {
    throw new Error('PSD\u6837\u673a\u672a\u751f\u6210\u4efb\u4f55\u7ed3\u679c\u3002');
  }
  const items = collectedItems;
  const failures = collectedFailures;
  const generatedCount = items.reduce((count, item) => {
    const outputs = Array.isArray(item.outputs) ? item.outputs : [];
    return count + outputs.filter((output) => !output || output.type !== 'slice').length;
  }, 0);
  const sliceGeneratedCount = items.reduce((count, item) => {
    const outputs = Array.isArray(item.outputs) ? item.outputs : [];
    return count + outputs.filter((output) => output && output.type === 'slice').length;
  }, 0);
  const skippedCount = items.reduce((count, item) => count + (item && item.skipped ? 1 : 0), 0);

  return {
    success: true,
    updatedAt: getIsoTimestamp(),
    psdPath,
    smartObjectName,
    sourceRotation,
    replacementMode,
    imageDirectoryPath,
    outputRootDirectoryPath,
    outputDirectoryPath,
    outputSubdirName,
    outputFormat: mockupOutputFormat,
    metadataSourcePath,
    metadataSourceDirectoryPath,
    metadataSourcePoolCount: Array.isArray(metadataSourceFiles) ? metadataSourceFiles.length : 0,
    sliceOptions: mockupSliceOptions,
    totalInputCount: totalSourceCount,
    generatedCount,
    sliceGeneratedCount,
    skippedCount,
    failedCount: failures.length,
    items,
    failures
  };
}

module.exports = {
  runSinglePsdSmartObjectMockup
};
