const fs = require('node:fs');
const path = require('node:path');
const {
  parsePsdLayerMetadata
} = require('./psdLayerMetadataParser');
const {
  createWhiteMockupRegionFromMask,
  generateWhiteMockupImages,
  renderWhiteMockupPreview
} = require('./whiteMockupTemplateRenderer');
const {
  parsePsdGuideMetadata
} = require('./psdGuideParser');
const {
  hasCompleteSliceOutputs,
  writeImageSlices
} = require('./psdSliceExporter');

const IMAGE_EXTENSIONS = Object.freeze([
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

const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);
const PSD_ENGINE_SINGLE_MODE = 1;
const DEFAULT_PSD_ENGINE_CONCURRENCY = 2;
const MAX_PSD_ACTIVE_ENGINE_COUNT = 24;
const PSD_MOCKUP_OPEN_MAX_ATTEMPTS = 2;
const PSD_MOCKUP_ITEM_RETRY_MAX_ATTEMPTS = 3;
const PSD_MOCKUP_OPEN_TIMEOUT_PATTERN = /PSD\u6837\u673a\u6253\u5f00\u8d85\u65f6/;

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeAbsolutePath(value) {
  const text = normalizeText(value);
  return text ? path.resolve(text) : '';
}

function getIsoTimestamp() {
  return new Date().toISOString();
}

async function assertDirectory(directoryPath, message) {
  const stat = await fs.promises.stat(directoryPath).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(message);
  }
}

async function assertFile(filePath, message) {
  const stat = await fs.promises.stat(filePath).catch(() => null);

  if (!stat || !stat.isFile()) {
    throw new Error(message);
  }
}

async function collectImageFiles(directoryPath, currentPath = directoryPath, result = []) {
  const entries = await fs.promises.readdir(currentPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await collectImageFiles(directoryPath, absolutePath, result);
      continue;
    }

    if (!entry.isFile() || !IMAGE_EXTENSION_SET.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const relativePath = path.relative(directoryPath, absolutePath).split(path.sep).join('/');
    result.push({
      filePath: absolutePath,
      relativePath,
      fileName: entry.name
    });
  }

  return result.sort((left, right) => {
    return String(left.relativePath || '').localeCompare(String(right.relativePath || ''), 'zh-CN', {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

function hasTemplatePayload(template) {
  return Boolean(template && typeof template === 'object' && Array.isArray(template.regions));
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

function emitPsdProgress(emitProgress, payload) {
  if (typeof emitProgress !== 'function') {
    return;
  }

  try {
    emitProgress({
      ...(payload && typeof payload === 'object' ? payload : {}),
      updatedAt: getIsoTimestamp()
    });
  } catch (_error) {}
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

async function pathExists(targetPath) {
  if (!normalizeText(targetPath)) {
    return false;
  }

  return Boolean(await fs.promises.stat(targetPath).catch(() => null));
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

function createPsdTaskSignal(options = {}) {
  return {
    aborted: false,
    reason: '',
    session: null,
    engineWindowVisible: options.showEngineWindow === true,
    abort(reason) {
      this.aborted = true;
      this.reason = normalizeText(reason) || 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002';
      if (this.session && typeof this.session.destroy === 'function') {
        void this.session.destroy();
      }
    },
    setSession(session) {
      this.session = session || null;
      if (this.aborted && this.session && typeof this.session.destroy === 'function') {
        void this.session.destroy();
      }
    },
    setEngineWindowVisible(visible) {
      this.engineWindowVisible = visible === true;
      if (this.session && typeof this.session.setEngineWindowVisible === 'function') {
        return this.session.setEngineWindowVisible(this.engineWindowVisible);
      }

      return false;
    }
  };
}

async function collectPsdSourceFiles({
  imageDirectoryPath
}) {
  await assertDirectory(imageDirectoryPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684PSD\u7d20\u6750\u56fe\u7247\u6587\u4ef6\u5939\u3002');

  const sourceFiles = await collectImageFiles(imageDirectoryPath);
  if (!sourceFiles.length) {
    throw new Error('\u7d20\u6750\u6587\u4ef6\u5939\u4e2d\u6ca1\u6709\u53ef\u7528\u56fe\u7247\u3002');
  }

  return sourceFiles;
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

async function runLimitedTasks(items, limit, worker) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedLimit = Math.max(1, Math.min(sourceItems.length || 1, Math.round(Number(limit) || 1)));
  const results = new Array(sourceItems.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < sourceItems.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await worker(sourceItems[itemIndex], itemIndex);
    }
  }

  await Promise.all(Array.from({
    length: normalizedLimit
  }, runWorker));

  return results;
}

function createAsyncSlotLimiter(limit) {
  const normalizedLimit = Math.max(1, Math.round(Number(limit) || 1));
  const waiters = [];
  let activeCount = 0;

  function release() {
    const nextWaiter = waiters.shift();
    if (nextWaiter) {
      nextWaiter(release);
      return;
    }

    activeCount = Math.max(0, activeCount - 1);
  }

  return {
    acquire() {
      if (activeCount < normalizedLimit) {
        activeCount += 1;
        return Promise.resolve(release);
      }

      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    }
  };
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
  const sourceList = decoratePsdSourceFiles(sourceFiles);
  const multiplier = getPsdEngineWorkerMultiplier(engineConcurrency);
  const workersPerMockup = multiplier > 0 ? multiplier : 1;
  const workUnits = [];

  (Array.isArray(mockups) ? mockups : []).forEach((mockup, mockupIndex) => {
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
      ? Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, mockups.length * multiplier))
      : 1
  };
}

function throwIfPsdTaskCanceled(taskSignal) {
  if (taskSignal && taskSignal.aborted) {
    throw new Error(normalizeText(taskSignal.reason) || 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002');
  }
}

function isRecoverablePsdMockupOpenError(error) {
  const message = String(error && error.message || error || '');
  return PSD_MOCKUP_OPEN_TIMEOUT_PATTERN.test(message);
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

function createPodSuiteToolService({
  runtimeLogger,
  whiteMockupTemplateStore,
  psdTemplateStore,
  tempRootDir
} = {}) {
  const activePsdTaskGroups = new Map();

  async function withErrorBoundary(eventName, work) {
    try {
      return await work();
    } catch (error) {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError(eventName, error);
      }

      return {
        success: false,
        updatedAt: getIsoTimestamp(),
        message: String(error && error.message || error || '').trim()
      };
    }
  }

  return {
    generateWhiteMockups(payload) {
      return withErrorBoundary('pod_suite_tool_white_mockup_generate_failed', async () => {
        let nextPayload = payload && typeof payload === 'object' ? { ...payload } : {};

        if (!hasTemplatePayload(nextPayload.template)
          && whiteMockupTemplateStore
          && typeof whiteMockupTemplateStore.getTemplate === 'function') {
          const templateResult = await whiteMockupTemplateStore.getTemplate({
            mockupPath: nextPayload.mockupPath
          });

          if (templateResult && templateResult.template) {
            nextPayload = {
              ...nextPayload,
              template: templateResult.template
            };
          }
        }

        return generateWhiteMockupImages(
          nextPayload,
          collectImageFiles
        );
      });
    },
    generatePsdSmartObjectMockups(payload, context = {}) {
      return withErrorBoundary('pod_suite_tool_psd_smart_object_generate_failed', async () => {
        const sourcePayload = payload && typeof payload === 'object' ? payload : {};
        const runId = normalizeText(sourcePayload.runId) || `psd_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
        const emitProgress = (progressPayload) => {
          emitPsdProgress(context && context.emitProgress, {
            runId,
            ...(progressPayload && typeof progressPayload === 'object' ? progressPayload : {})
          });
        };
        if (activePsdTaskGroups.has(runId)) {
          throw new Error('\u8fd9\u4e2a\u7a97\u53e3\u5df2\u6709PSD\u5957\u56fe\u4efb\u52a1\u5728\u8fdb\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u5f53\u524d\u4efb\u52a1\u3002');
        }

        emitProgress({
          phase: 'start'
        });
        const mockups = Array.isArray(sourcePayload.psdMockups) && sourcePayload.psdMockups.length
          ? sourcePayload.psdMockups
          : [sourcePayload];
        const imageDirectoryPath = normalizeAbsolutePath(sourcePayload.imageDirectoryPath);
        const outputRootDirectoryPath = normalizeAbsolutePath(sourcePayload.outputDirectoryPath);
        const outputFormat = normalizePsdOutputFormat(sourcePayload.outputFormat);
        const imageQuality = normalizePsdImageQuality(sourcePayload.imageQuality);
        const normalizedMockups = mockups.map((mockup) => {
          const outputDirectoryPath = getPsdMockupOutputDirectoryPath(mockup, outputRootDirectoryPath);
          return {
            ...(mockup && typeof mockup === 'object' ? mockup : {}),
            outputDirectoryPath,
            outputFormat: getPsdMockupOutputFormat(mockup, outputFormat),
            imageQuality: getPsdMockupImageQuality(mockup, imageQuality),
            sliceOptions: getPsdMockupSliceOptions(mockup, sourcePayload.sliceOptions)
          };
        });
        const {
          metadataSourcePath,
          metadataSourceDirectoryPath,
          metadataSourceFiles
        } = await resolvePsdMetadataSourceConfig(sourcePayload);
        const sliceOptions = normalizePsdSliceOptions(sourcePayload.sliceOptions);
        const engineConcurrency = normalizePsdEngineConcurrency(sourcePayload.engineConcurrency || sourcePayload.psdEngineConcurrency);
        const showEngineWindow = sourcePayload.showEngineWindow === true;
        const skipExistingOutputs = sourcePayload.skipExistingOutputs === true || sourcePayload.psdSkipExistingOutputs === true;
        const photopeaTempRootDir = normalizeAbsolutePath(tempRootDir);
        emitProgress({
          phase: 'collect-sources',
          mockupCount: normalizedMockups.length,
          engineConcurrency
        });
        const collectedSourceFiles = await collectPsdSourceFiles({
          imageDirectoryPath
        });
        await Promise.all(normalizedMockups.map((mockup) => {
          return assertDirectory(mockup.outputDirectoryPath, '\u8bf7\u5148\u9009\u62e9\u6bcf\u4e2aPSD\u6837\u673a\u7684\u5bfc\u51fa\u4e3b\u76ee\u5f55\u3002');
        }));
        const {
          workUnits,
          sourceFiles,
          workerMultiplier,
          maxConcurrentEngines
        } = buildPsdMockupWorkUnits(normalizedMockups, collectedSourceFiles, engineConcurrency);
        const actualEngineConcurrency = Math.max(1, Math.min(workUnits.length || 1, maxConcurrentEngines));
        const engineConcurrencyLabel = getPsdEngineConcurrencyLabel(engineConcurrency);
        const engineStartupLimiter = createAsyncSlotLimiter(1);
        const postProcessLimiter = createAsyncSlotLimiter(actualEngineConcurrency);
        const psdLayerMetadataByPath = new Map();
        const uniquePsdPathByKey = new Map();
        normalizedMockups
          .map((mockup) => normalizeAbsolutePath(mockup && mockup.psdPath))
          .filter(Boolean)
          .forEach((psdPath) => {
            const cacheKey = normalizeOutputIdentity(psdPath);
            if (!uniquePsdPathByKey.has(cacheKey)) {
              uniquePsdPathByKey.set(cacheKey, psdPath);
            }
          });
        await Promise.all(Array.from(uniquePsdPathByKey.entries()).map(async ([cacheKey, psdPath]) => {
          const layers = await parsePsdLayerMetadata(psdPath).catch((error) => {
            if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
              runtimeLogger.logError('pod_suite_tool_psd_layers_parse_failed', error);
            }

            return null;
          });
          if (Array.isArray(layers)) {
            psdLayerMetadataByPath.set(cacheKey, layers);
          }
        }));
        emitProgress({
          phase: 'sources-ready',
          mockupCount: normalizedMockups.length,
          totalInputCount: sourceFiles.length,
          engineConcurrency,
          engineConcurrencyLabel,
          engineWorkerMultiplier: workerMultiplier,
          actualEngineConcurrency
        });

        const taskSignals = workUnits.map(() => createPsdTaskSignal({
          showEngineWindow
        }));
        activePsdTaskGroups.set(runId, taskSignals);

        try {
          const workResults = await runLimitedTasks(workUnits, actualEngineConcurrency, async (workUnit, workIndex) => {
            const mockup = workUnit.mockup;
            const index = workUnit.mockupIndex;
            try {
              throwIfPsdTaskCanceled(taskSignals[workIndex]);
              emitProgress({
                phase: 'mockup-start',
                mockupIndex: index + 1,
                mockupCount: normalizedMockups.length,
                mockupName: sanitizeFileNameSegment(mockup && mockup.outputSubdirName || `PSD\u5957\u56fe${index > 0 ? index + 1 : ''}`),
                psdPath: normalizeAbsolutePath(mockup && mockup.psdPath),
                psdName: getPathFileName(mockup && mockup.psdPath),
                totalInputCount: sourceFiles.length,
                engineConcurrency,
                engineConcurrencyLabel,
                actualEngineConcurrency,
                workerIndex: workUnit.workerIndex + 1,
                workerCount: workUnit.workerCount
              });
              const mockupResult = await runSinglePsdSmartObjectMockup({
                payload: mockup,
                index,
                imageDirectoryPath,
                outputRootDirectoryPath: normalizeAbsolutePath(mockup && mockup.outputDirectoryPath),
                outputFormat: getPsdMockupOutputFormat(mockup, outputFormat),
                imageQuality: getPsdMockupImageQuality(mockup, imageQuality),
                metadataSourcePath,
                metadataSourceDirectoryPath,
                metadataSourceFiles,
                sliceOptions: getPsdMockupSliceOptions(mockup, sliceOptions),
                showEngineWindow: taskSignals[workIndex] && typeof taskSignals[workIndex].engineWindowVisible === 'boolean'
                  ? taskSignals[workIndex].engineWindowVisible
                  : showEngineWindow,
                skipExistingOutputs,
                sourceFiles: workUnit.sourceFiles,
                taskSignal: taskSignals[workIndex],
                emitProgress: (progressPayload) => {
                  emitProgress({
                    mockupCount: normalizedMockups.length,
                    totalInputCount: sourceFiles.length,
                    engineConcurrency,
                    engineConcurrencyLabel,
                    actualEngineConcurrency,
                    workerIndex: workUnit.workerIndex + 1,
                    workerCount: workUnit.workerCount,
                    ...(progressPayload && typeof progressPayload === 'object' ? progressPayload : {})
                  });
                },
                runtimeLogger,
                tempRootDir: photopeaTempRootDir,
                engineStartupLimiter,
                postProcessLimiter,
                postProcessConcurrency: actualEngineConcurrency,
                seenOutputIdentities: workUnit.outputIdentitySet,
                psdLayerMetadata: psdLayerMetadataByPath.get(normalizeOutputIdentity(normalizeAbsolutePath(mockup && mockup.psdPath))) || null
              });

              return {
                mockupIndex: index,
                result: mockupResult
              };
            } catch (error) {
              const message = String(error && error.message || error || '').trim();
              emitProgress({
                phase: 'mockup-failed',
                mockupIndex: index + 1,
                mockupCount: normalizedMockups.length,
                mockupName: sanitizeFileNameSegment(mockup && mockup.outputSubdirName || `PSD\u5957\u56fe${index > 0 ? index + 1 : ''}`),
                psdPath: normalizeAbsolutePath(mockup && mockup.psdPath),
                psdName: getPathFileName(mockup && mockup.psdPath),
                message,
                totalInputCount: sourceFiles.length,
                engineConcurrency,
                engineConcurrencyLabel,
                actualEngineConcurrency,
                workerIndex: workUnit.workerIndex + 1,
                workerCount: workUnit.workerCount
              });
              if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
                runtimeLogger.logError('pod_suite_tool_psd_mockup_failed', error);
              }

              return {
                mockupIndex: index,
                result: createFailedPsdMockupResult({
                  mockup,
                  index,
                  outputFormat: getPsdMockupOutputFormat(mockup, outputFormat),
                  imageQuality: getPsdMockupImageQuality(mockup, imageQuality),
                  metadataSourcePath,
                  metadataSourceDirectoryPath,
                  metadataSourceFiles,
                  engineConcurrency,
                  sliceOptions: getPsdMockupSliceOptions(mockup, sliceOptions),
                  totalInputCount: sourceFiles.length,
                  message
                })
              };
            }
          });
          const partialsByMockup = new Map();
          workResults.forEach((workResult) => {
            if (!workResult || !workResult.result) {
              return;
            }

            const mockupIndex = Number(workResult.mockupIndex) || 0;
            const partials = partialsByMockup.get(mockupIndex) || [];
            partials.push(workResult.result);
            partialsByMockup.set(mockupIndex, partials);
          });
          const mockupResults = normalizedMockups.map((mockup, index) => {
            const mockupResult = mergePsdMockupResults({
              mockup,
              index,
              partialResults: partialsByMockup.get(index) || [],
              outputFormat: getPsdMockupOutputFormat(mockup, outputFormat),
              imageQuality: getPsdMockupImageQuality(mockup, imageQuality),
              metadataSourcePath,
              metadataSourceDirectoryPath,
              metadataSourceFiles,
              engineConcurrency,
              sliceOptions: getPsdMockupSliceOptions(mockup, sliceOptions),
              totalInputCount: sourceFiles.length
            });
            emitProgress({
              phase: 'mockup-done',
              mockupIndex: index + 1,
              mockupCount: normalizedMockups.length,
              mockupName: mockupResult.outputSubdirName,
              psdPath: mockupResult.psdPath,
              psdName: getPathFileName(mockupResult.psdPath),
              totalInputCount: sourceFiles.length,
              generatedCount: mockupResult.generatedCount,
              sliceGeneratedCount: mockupResult.sliceGeneratedCount,
              skippedCount: mockupResult.skippedCount,
              failedCount: mockupResult.failedCount,
              engineConcurrency,
              engineConcurrencyLabel,
              actualEngineConcurrency
            });

            return mockupResult;
          });
          const failures = mockupResults.flatMap((result) => Array.isArray(result.failures) ? result.failures : []);
          const generatedCount = mockupResults.reduce((count, result) => count + (Number(result.generatedCount) || 0), 0);
          const sliceGeneratedCount = mockupResults.reduce((count, result) => count + (Number(result.sliceGeneratedCount) || 0), 0);
          const skippedCount = mockupResults.reduce((count, result) => count + (Number(result.skippedCount) || 0), 0);

          const result = {
            success: true,
            updatedAt: getIsoTimestamp(),
            mode: 'psd-smart-object',
            imageDirectoryPath,
            outputRootDirectoryPath,
            outputFormat,
            metadataSourcePath,
            metadataSourceDirectoryPath,
            metadataSourcePoolCount: metadataSourceFiles.length,
            engineConcurrency,
            engineConcurrencyLabel,
            engineWorkerMultiplier: workerMultiplier,
            actualEngineConcurrency,
            skipExistingOutputs,
            sliceOptions,
            mockupCount: mockupResults.length,
            totalInputCount: sourceFiles.length,
            generatedCount,
            sliceGeneratedCount,
            skippedCount,
            failedCount: failures.length,
            mockups: mockupResults,
            items: mockupResults.flatMap((result) => Array.isArray(result.items) ? result.items : []),
            failures
          };
          emitProgress({
            phase: 'complete',
            mockupCount: mockupResults.length,
            totalInputCount: sourceFiles.length,
            generatedCount,
            sliceGeneratedCount,
            skippedCount,
            failedCount: failures.length,
            engineConcurrency,
            engineConcurrencyLabel,
            engineWorkerMultiplier: workerMultiplier,
            actualEngineConcurrency
          });

          return result;
        } finally {
          activePsdTaskGroups.delete(runId);
        }
      });
    },
    cancelPsdSmartObjectMockups(payload) {
      return withErrorBoundary('pod_suite_tool_psd_smart_object_cancel_failed', async () => {
        const runId = normalizeText(payload && payload.runId);
        if (!runId) {
          return {
            success: true,
            updatedAt: getIsoTimestamp(),
            canceled: false,
            message: '\u672a\u627e\u5230\u8981\u505c\u6b62\u7684PSD\u5957\u56fe\u4efb\u52a1\u3002'
          };
        }

        const taskGroups = [activePsdTaskGroups.get(runId)].filter(Boolean);

        if (!taskGroups.length) {
          return {
            success: true,
            updatedAt: getIsoTimestamp(),
            canceled: false,
            message: '\u5f53\u524d\u6ca1\u6709\u6b63\u5728\u8fdb\u884c\u7684PSD\u5957\u56fe\u4efb\u52a1\u3002'
          };
        }

        taskGroups.flat().forEach((taskSignal) => {
          if (taskSignal && typeof taskSignal.abort === 'function') {
            taskSignal.abort('PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002');
          }
        });

        return {
          success: true,
          updatedAt: getIsoTimestamp(),
          canceled: true,
          message: 'PSD\u5957\u56fe\u5df2\u505c\u6b62\u3002'
        };
      });
    },
    setPsdEngineWindowVisible(payload) {
      return withErrorBoundary('pod_suite_tool_psd_engine_window_mode_failed', async () => {
        const runId = normalizeText(payload && payload.runId);
        const visible = normalizeText(payload && payload.mode) === 'visible' || payload && payload.visible === true;
        const taskGroups = runId
          ? [activePsdTaskGroups.get(runId)].filter(Boolean)
          : [];
        let updatedCount = 0;

        taskGroups.flat().forEach((taskSignal) => {
          if (taskSignal && typeof taskSignal.setEngineWindowVisible === 'function' && taskSignal.setEngineWindowVisible(visible)) {
            updatedCount += 1;
          }
        });

        return {
          success: true,
          updatedAt: getIsoTimestamp(),
          visible,
          updatedCount
        };
      });
    },
    getPsdSmartObjectTemplates(payload) {
      return withErrorBoundary('pod_suite_tool_psd_template_get_failed', async () => {
        if (!psdTemplateStore || typeof psdTemplateStore.getTemplates !== 'function') {
          throw new Error('PSD\u5957\u56fe\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
        }

        return psdTemplateStore.getTemplates(payload);
      });
    },
    savePsdSmartObjectTemplate(payload) {
      return withErrorBoundary('pod_suite_tool_psd_template_save_failed', async () => {
        if (!psdTemplateStore || typeof psdTemplateStore.saveTemplate !== 'function') {
          throw new Error('PSD\u5957\u56fe\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
        }

        return psdTemplateStore.saveTemplate(payload);
      });
    },
    deletePsdSmartObjectTemplate(payload) {
      return withErrorBoundary('pod_suite_tool_psd_template_delete_failed', async () => {
        if (!psdTemplateStore || typeof psdTemplateStore.deleteTemplate !== 'function') {
          throw new Error('PSD\u5957\u56fe\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
        }

        return psdTemplateStore.deleteTemplate(payload);
      });
    },
    renderWhiteMockupPreview(payload) {
      return withErrorBoundary('pod_suite_tool_white_mockup_preview_failed', async () => {
        return renderWhiteMockupPreview(payload);
      });
    },
    getWhiteMockupTemplate(payload) {
      return withErrorBoundary('pod_suite_tool_white_mockup_template_get_failed', async () => {
        if (!whiteMockupTemplateStore || typeof whiteMockupTemplateStore.getTemplate !== 'function') {
          throw new Error('\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
        }

        return whiteMockupTemplateStore.getTemplate(payload);
      });
    },
    saveWhiteMockupTemplate(payload) {
      return withErrorBoundary('pod_suite_tool_white_mockup_template_save_failed', async () => {
        if (!whiteMockupTemplateStore || typeof whiteMockupTemplateStore.saveTemplate !== 'function') {
          throw new Error('\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
        }

        return whiteMockupTemplateStore.saveTemplate(payload);
      });
    },
    createWhiteMockupRegionFromMask(payload) {
      return withErrorBoundary('pod_suite_tool_white_mockup_mask_region_failed', async () => {
        return createWhiteMockupRegionFromMask(payload);
      });
    },
    collectImageFiles(payload) {
      return withErrorBoundary('pod_suite_tool_collect_images_failed', async () => {
        const directoryPath = normalizeAbsolutePath(payload && payload.directoryPath);
        await assertDirectory(directoryPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u56fe\u7247\u6587\u4ef6\u5939\u3002');
        const files = await collectImageFiles(directoryPath);

        return {
          success: true,
          updatedAt: getIsoTimestamp(),
          directoryPath,
          files
        };
      });
    }
  };
}

module.exports = {
  IMAGE_EXTENSIONS,
  collectImageFiles,
  createPodSuiteToolService
};
