const {
  parsePsdLayerMetadata
} = require('./psdLayerMetadataParser');
const {
  createWhiteMockupRegionFromMask,
  generateWhiteMockupImages,
  renderWhiteMockupPreview
} = require('./whiteMockupTemplateRenderer');
const {
  getProvidedPsdSourceFiles,
  getPsdMockupPayloads,
  normalizePsdEngineWindowVisible,
  normalizePsdTaskRunId
} = require('./podSuitePsdPayloadUtils');
const {
  buildPsdMockupWorkUnits,
  getPathFileName,
  getPsdEngineConcurrencyLabel,
  getPsdMockupImageQuality,
  getPsdMockupOutputDirectoryPath,
  getPsdMockupOutputFormat,
  getPsdMockupSliceOptions,
  normalizeAbsolutePath,
  normalizeOutputIdentity,
  normalizePsdEngineConcurrency,
  normalizePsdImageQuality,
  normalizePsdOutputFormat,
  normalizePsdSliceOptions,
  sanitizeFileNameSegment
} = require('./podSuitePsdRuntimeRules');
const {
  createFailedPsdMockupResult,
  mergePsdMockupResults
} = require('./podSuitePsdResultFactory');
const {
  createAsyncSlotLimiter,
  createPsdTaskSignal,
  runLimitedTasks,
  throwIfPsdTaskCanceled
} = require('./podSuitePsdTaskRuntime');
const {
  IMAGE_EXTENSIONS,
  assertDirectory,
  collectImageFiles
} = require('./podSuiteFileSystemUtils');
const {
  collectPsdSourceFiles,
  resolvePsdMetadataSourceConfig
} = require('./podSuitePsdSourceResolver');
const {
  emitPsdProgress,
  getIsoTimestamp
} = require('./podSuitePsdProgressUtils');
const {
  runSinglePsdSmartObjectMockup
} = require('./podSuitePsdMockupRunner');

function hasTemplatePayload(template) {
  return Boolean(template && typeof template === 'object' && Array.isArray(template.regions));
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
        const runId = normalizePsdTaskRunId(sourcePayload) || `psd_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
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
        const mockups = getPsdMockupPayloads(sourcePayload);
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
        const showEngineWindow = normalizePsdEngineWindowVisible(sourcePayload);
        const skipExistingOutputs = sourcePayload.skipExistingOutputs === true || sourcePayload.psdSkipExistingOutputs === true;
        const photopeaTempRootDir = normalizeAbsolutePath(tempRootDir);
        emitProgress({
          phase: 'collect-sources',
          mockupCount: normalizedMockups.length,
          engineConcurrency
        });
        const collectedSourceFiles = await collectPsdSourceFiles({
          imageDirectoryPath,
          sourceFiles: getProvidedPsdSourceFiles(sourcePayload)
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
        const runId = normalizePsdTaskRunId(payload);
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
        const runId = normalizePsdTaskRunId(payload);
        const visible = normalizePsdEngineWindowVisible(payload);
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
