import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { DEFAULT_PRODUCT_FIELDS, TITLE_MAX_LENGTH } from './constants/podUploadSheetMiaoshou.js';
import {
  classifySection,
  createEmptyImportOrderMap,
  createEmptyPathMap,
  createId,
  createPodUploadSheetMiaoshouProduct,
  getImportedProductGroup,
  getMaterialNameKey,
  getMaterialPathByName,
  getPrimaryProductImage,
  normalizeMaterialName,
  normalizeText
} from './utils/podUploadSheetMiaoshouData.js';

function getBridge(featureBridge) {
  return featureBridge && typeof featureBridge === 'object' && 'value' in featureBridge
    ? featureBridge.value
    : featureBridge;
}

function showMessage(messageApi, method, content) {
  if (messageApi && typeof messageApi[method] === 'function') {
    messageApi[method](content);
  }
}

function clonePlainValue(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return fallback;
  }
}

export function useProductWorkflowTasks(options = {}) {
  const products = options.products;
  const activeProductId = options.activeProductId;
  const lastImportDirectoryPath = options.lastImportDirectoryPath;
  const globalForm = options.globalForm;
  const skuDefaults = options.skuDefaults;
  const featureBridge = options.featureBridge;
  const batchAiTitleDialog = options.batchAiTitleDialog;
  const buildSkuRows = typeof options.buildSkuRows === 'function' ? options.buildSkuRows : () => [];
  const getSkuConfigMapSnapshot = typeof options.getSkuConfigMapSnapshot === 'function'
    ? options.getSkuConfigMapSnapshot
    : () => ({});
  const scheduleStateSave = typeof options.scheduleStateSave === 'function' ? options.scheduleStateSave : () => undefined;
  const messageApi = options.messageApi || null;
  const modalApi = options.modalApi || null;

  const importingProducts = ref(false);
  const uploadingImages = ref(false);
  const exportingTable = ref(false);
  const generatingAiTitles = ref(false);
  const uploadProgress = reactive({
    total: 0,
    completed: 0,
    success: 0,
    uploaded: 0,
    cached: 0,
    failed: 0,
    canceled: 0,
    label: '',
    runState: 'idle',
    storageProvider: '',
    imageUploadMode: 'original',
    concurrency: 0,
    imageQuality: 0
  });
  const uploadFailedFilePaths = ref([]);
  const aiProgress = reactive({ total: 0, completed: 0, success: 0, failed: 0, canceled: 0 });
  const uploadRunId = ref('');
  const aiTitleRunId = ref('');
  let uploadProgressPollTimer = 0;

  const aiTitleEligibleCount = computed(() => products.value.filter((item) => getPrimaryProductImage(item)).length);
  const aiTitleRetryCount = computed(() => products.value.filter((item) => {
    return item.aiTitleStatus === 'failed' && getPrimaryProductImage(item);
  }).length);
  const uploadProgressText = computed(() => {
    if (!uploadProgress.total) return '';
    return `\u65b0\u4f20 ${uploadProgress.uploaded}\uff0c\u7f13\u5b58 ${uploadProgress.cached}\uff0c\u5931\u8d25 ${uploadProgress.failed}`;
  });
  const aiTitleProgressText = computed(() => {
    if (!aiProgress.total) return '';
    return `\u6210\u529f ${aiProgress.success}\uff0c\u5931\u8d25 ${aiProgress.failed}`;
  });

  function buildProductsFromFiles(files) {
    const groups = new Map();

    (Array.isArray(files) ? files : []).forEach((file) => {
      const groupInfo = getImportedProductGroup(file);
      const groupKey = `${groupInfo.sourceFolder}__${groupInfo.productKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          localName: groupInfo.productKey,
          sourceFolder: groupInfo.sourceFolder,
          materials: { carousel: [], assets: [], preview: [] },
          materialPathMap: createEmptyPathMap(),
          materialImportOrderMap: createEmptyImportOrderMap(),
          materialOriginalOrderMap: createEmptyImportOrderMap()
        });
      }

      const group = groups.get(groupKey);
      const section = classifySection(file.name, file.webkitRelativePath);
      const name = normalizeMaterialName(file, groupInfo) || file.name;
      const key = getMaterialNameKey(name);

      group.materials[section].push(name);
      group.materialImportOrderMap[section].push(name);
      group.materialOriginalOrderMap[section].push(name);

      if (key && file.path) {
        group.materialPathMap[section][key] = file.path;
      }
    });

    return Array.from(groups.values()).map((group) => createPodUploadSheetMiaoshouProduct({
      ...group,
      ...globalForm,
      ...skuDefaults,
      skuConfigMap: getSkuConfigMapSnapshot()
    }, {
      defaultFields: DEFAULT_PRODUCT_FIELDS
    }));
  }

  function selectProduct(record) {
    activeProductId.value = record && record.id ? record.id : '';
  }

  function getProductRowClass(record) {
    return record && activeProductId.value === record.id ? 'is-active' : '';
  }

  function handleProductTitleChange(record, fieldName) {
    if (!record || !fieldName) return;

    const value = String(record[fieldName] === undefined || record[fieldName] === null ? '' : record[fieldName]);

    if (value.length > TITLE_MAX_LENGTH) {
      record[fieldName] = value.slice(0, TITLE_MAX_LENGTH);
    }

    scheduleStateSave();
  }

  function resetUploadProgress() {
    uploadRunId.value = '';
    Object.assign(uploadProgress, {
      total: 0,
      completed: 0,
      success: 0,
      uploaded: 0,
      cached: 0,
      failed: 0,
      canceled: 0,
      label: '',
      runState: 'idle',
      storageProvider: '',
      imageUploadMode: 'original',
      concurrency: 0,
      imageQuality: 0
    });
  }

  function resetAiProgress() {
    aiTitleRunId.value = '';
    Object.assign(aiProgress, {
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      canceled: 0
    });
  }

  function stopUploadProgressPolling() {
    if (uploadProgressPollTimer) {
      window.clearInterval(uploadProgressPollTimer);
      uploadProgressPollTimer = 0;
    }
  }

  function applyUploadProgressSnapshot(snapshot) {
    const source = snapshot && snapshot.progress && typeof snapshot.progress === 'object'
      ? snapshot.progress
      : snapshot && typeof snapshot === 'object'
        ? snapshot
        : null;

    if (!source) {
      return;
    }

    function toCount(value, fallback) {
      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : fallback;
    }

    Object.assign(uploadProgress, {
      total: Math.max(0, toCount(source.totalCount, uploadProgress.total)),
      completed: Math.max(0, toCount(source.completedCount, uploadProgress.completed)),
      success: Math.max(0, toCount(source.successCount, uploadProgress.success)),
      uploaded: Math.max(0, toCount(source.uploadedCount, uploadProgress.uploaded)),
      cached: Math.max(0, toCount(source.cachedCount, uploadProgress.cached)),
      failed: Math.max(0, toCount(source.failedCount, uploadProgress.failed)),
      canceled: Math.max(0, toCount(source.canceledCount, uploadProgress.canceled)),
      label: normalizeText(source.label) || uploadProgress.label,
      runState: normalizeText(source.runState) || uploadProgress.runState,
      storageProvider: normalizeText(source.storageProvider) || uploadProgress.storageProvider,
      imageUploadMode: normalizeText(source.imageUploadMode) || uploadProgress.imageUploadMode,
      concurrency: Math.max(0, toCount(source.concurrency, uploadProgress.concurrency)),
      imageQuality: Math.max(0, toCount(source.imageQuality, uploadProgress.imageQuality))
    });
  }

  async function refreshUploadProgress(runId) {
    const bridge = getBridge(featureBridge);

    if (!bridge || typeof bridge.getPodUploadSheetMiaoshouCosUploadProgressSnapshot !== 'function' || !runId) {
      return;
    }

    try {
      const snapshot = await bridge.getPodUploadSheetMiaoshouCosUploadProgressSnapshot({
        runId
      });
      applyUploadProgressSnapshot(snapshot);
    } catch (_error) {}
  }

  function startUploadProgressPolling(runId) {
    stopUploadProgressPolling();

    if (!runId) {
      return;
    }

    void refreshUploadProgress(runId);
    uploadProgressPollTimer = window.setInterval(() => {
      void refreshUploadProgress(runId);
    }, 600);
  }

  async function importProducts() {
    const bridge = getBridge(featureBridge);

    if (!bridge || typeof bridge.selectPodUploadSheetMiaoshouImportDirectory !== 'function') return;

    importingProducts.value = true;

    try {
      const result = await bridge.selectPodUploadSheetMiaoshouImportDirectory({
        defaultPath: lastImportDirectoryPath.value
      });

      if (!result || result.canceled) return;

      const nextProducts = buildProductsFromFiles(result.files || []);

      if (!nextProducts.length) {
        showMessage(messageApi, 'warning', '\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u5bfc\u5165\u7684\u672c\u5730\u5546\u54c1\u56fe\u7247');
        return;
      }

      products.value.push(...nextProducts);
      activeProductId.value = nextProducts[0].id;
      lastImportDirectoryPath.value = normalizeText(result.directoryPath) || lastImportDirectoryPath.value;
      uploadFailedFilePaths.value = [];
      showMessage(messageApi, 'success', `\u5df2\u5bfc\u5165 ${nextProducts.length} \u4e2a\u5546\u54c1`);
      scheduleStateSave();
    } catch (error) {
      showMessage(
        messageApi,
        'error',
        '\u5bfc\u5165\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5')
      );
    } finally {
      importingProducts.value = false;
    }
  }

  function clearProducts() {
    if (!modalApi || typeof modalApi.warning !== 'function') {
      products.value = [];
      activeProductId.value = '';
      uploadFailedFilePaths.value = [];
      resetUploadProgress();
      resetAiProgress();
      scheduleStateSave();
      return;
    }

    modalApi.warning({
      title: '\u6e05\u7a7a\u5546\u54c1\u5217\u8868',
      content: '\u786e\u8ba4\u6e05\u7a7a\u5f53\u524d\u5546\u54c1\u6570\u636e\uff1f',
      hideCancel: false,
      onOk() {
        products.value = [];
        activeProductId.value = '';
        uploadFailedFilePaths.value = [];
        resetUploadProgress();
        resetAiProgress();
        scheduleStateSave();
      }
    });
  }

  function getImageUploadSnapshot() {
    return {
      totalCount: uploadProgress.total || products.value.length,
      retryCount: uploadFailedFilePaths.value.length,
      retryFilePaths: uploadFailedFilePaths.value.slice(),
      imageUploadMode: uploadProgress.imageUploadMode || 'original',
      concurrency: uploadProgress.concurrency || 8,
      imageQuality: uploadProgress.imageQuality || 90
    };
  }

  function applyUploadResult(result) {
    const items = Array.isArray(result && result.items) ? result.items : [];
    const failedFilePaths = items
      .filter((item) => item && item.status === 'failed' && normalizeText(item.filePath))
      .map((item) => normalizeText(item.filePath));

    products.value = products.value.map((product) => {
      const nextProduct = createPodUploadSheetMiaoshouProduct(product, {
        defaultFields: DEFAULT_PRODUCT_FIELDS
      });

      ['carousel', 'assets', 'preview'].forEach((sectionId) => {
        nextProduct.materials[sectionId] = nextProduct.materials[sectionId].map((name) => name);
      });

      return nextProduct;
    });

    uploadFailedFilePaths.value = failedFilePaths;
    Object.assign(uploadProgress, {
      total: Number(result && result.totalCount) || items.length,
      completed: Number(result && result.completedCount) || items.length,
      success: Number(result && result.successCount) || 0,
      uploaded: Number(result && result.uploadedCount) || 0,
      cached: Number(result && result.cachedCount) || 0,
      failed: Number(result && result.failedCount) || 0,
      canceled: Number(result && result.canceledCount) || 0,
      runState: result && result.canceled ? 'canceled' : 'completed'
    });
  }

  async function executeImageUpload(options = {}) {
    const bridge = getBridge(featureBridge);

    if (!bridge || uploadingImages.value) return;

    uploadingImages.value = true;
    resetUploadProgress();
    const runId = createId('pod-cos');
    uploadRunId.value = runId;
    Object.assign(uploadProgress, {
      runState: 'starting',
      storageProvider: normalizeText(options && options.storageProvider) || 'tencent-cos',
      imageUploadMode: normalizeText(options && options.imageUploadMode) || 'original',
      concurrency: Math.max(1, Number(options && options.concurrency) || 8),
      imageQuality: Math.max(1, Number(options && options.imageQuality) || 90)
    });

    try {
      startUploadProgressPolling(runId);
      const uploadProducts = clonePlainValue(products.value, []);

      const result = await bridge.uploadPodUploadSheetMiaoshouCosImages({
        runId,
        storageProvider: normalizeText(options && options.storageProvider) || 'tencent-cos',
        imageUploadMode: normalizeText(options && options.imageUploadMode) || 'original',
        concurrency: Math.max(1, Number(options && options.concurrency) || 8),
        imageQuality: Math.max(1, Number(options && options.imageQuality) || 90),
        retryFailedOnly: options && options.retryFailedOnly === true,
        retryFilePaths: Array.isArray(options && options.retryFilePaths) ? options.retryFilePaths.slice() : [],
        products: uploadProducts,
      });
      applyUploadResult(result);
      showMessage(messageApi, result && result.canceled ? 'warning' : 'success', result && result.canceled ? '\u5df2\u505c\u6b62\u56fe\u7247\u4e0a\u4f20' : '\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210');
      scheduleStateSave();
    } catch (error) {
      showMessage(
        messageApi,
        'error',
        '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5')
      );
    } finally {
      stopUploadProgressPolling();
      if (normalizeText(uploadRunId.value) === runId) {
        uploadRunId.value = '';
      }
      uploadingImages.value = false;
    }
  }

  async function stopImageUpload() {
    const bridge = getBridge(featureBridge);
    const runId = normalizeText(uploadRunId.value);

    if (!bridge || typeof bridge.cancelPodUploadSheetMiaoshouCosImages !== 'function' || !runId) {
      return { canceled: false };
    }

    return bridge.cancelPodUploadSheetMiaoshouCosImages({ runId });
  }

  function getBatchAiTitleSnapshot() {
    const preferences = batchAiTitleDialog.collectPayload(false);

    return {
      ...preferences,
      totalCount: aiTitleEligibleCount.value,
      retryCount: aiTitleRetryCount.value,
      prefixText: preferences.prefixText,
      suffixText: preferences.suffixText,
      extraPrompt: preferences.extraPrompt,
      targetLength: preferences.targetLength || '250'
    };
  }

  function openBatchAiTitleDialog() {
    return batchAiTitleDialog.openDialog(getBatchAiTitleSnapshot());
  }

  function applyAiTitleResults(result) {
    const items = Array.isArray(result && result.items) ? result.items : [];
    const itemMap = new Map(items.map((item) => [normalizeText(item && item.id), item]));

    products.value = products.value.map((product) => {
      const item = itemMap.get(product.id);

      if (!item) {
        return product.aiTitleStatus === 'processing' ? { ...product, aiTitleStatus: 'failed' } : product;
      }

      if (item.status === 'success') {
        return {
          ...product,
          title: normalizeText(item.zhTitle) || product.title,
          englishTitle: normalizeText(item.enTitle) || product.englishTitle,
          aiTitleStatus: 'success',
          aiTitleError: '',
          aiTitlePatternSummary: normalizeText(item.patternSummary),
          aiTitleUpdatedAt: normalizeText(result && result.updatedAt)
        };
      }

      return {
        ...product,
        aiTitleStatus: item.status === 'canceled' ? 'canceled' : 'failed',
        aiTitleError: normalizeText(item.error),
        aiTitleUpdatedAt: normalizeText(result && result.updatedAt)
      };
    });
    Object.assign(aiProgress, {
      total: Number(result && result.totalCount) || items.length,
      completed: Number(result && result.totalCount) || items.length,
      success: Number(result && result.successCount) || 0,
      failed: Number(result && result.failedCount) || 0,
      canceled: Number(result && result.canceledCount) || 0
    });
  }

  async function executeBatchAiTitleGeneration(options = {}) {
    const bridge = getBridge(featureBridge);

    if (!bridge || generatingAiTitles.value) return;

    const retryFailedOnly = options && options.retryFailedOnly === true;
    const targetProducts = products.value.filter((product) => {
      if (retryFailedOnly && product.aiTitleStatus !== 'failed') return false;
      return Boolean(getPrimaryProductImage(product));
    });

    if (!targetProducts.length) {
      showMessage(messageApi, 'warning', '\u6ca1\u6709\u53ef\u751f\u6210\u6807\u9898\u7684\u5546\u54c1');
      return;
    }

    generatingAiTitles.value = true;
    Object.assign(aiProgress, { total: targetProducts.length, completed: 0, success: 0, failed: 0, canceled: 0 });
    products.value.forEach((product) => {
      if (targetProducts.some((item) => item.id === product.id)) product.aiTitleStatus = 'processing';
    });

    const runId = createId('pod-ai-title');
    aiTitleRunId.value = runId;

    try {
      const result = await bridge.generatePodUploadSheetMiaoshouAiTitles({
        ...options,
        runId,
        entryId: 'pod-upload-sheet-miaoshou-table',
        products: targetProducts.map((product) => {
          const primaryImage = getPrimaryProductImage(product);
          return {
            id: product.id,
            localName: product.localName,
            sourceFolder: product.sourceFolder,
            mainNumber: product.mainNumber,
            categoryId: product.category,
            categoryLabel: product.category,
            imageName: primaryImage.name,
            imagePath: primaryImage.path
          };
        })
      });

      applyAiTitleResults(result);
      showMessage(messageApi, result && result.canceled ? 'warning' : 'success', result && result.canceled ? '\u5df2\u505c\u6b62 AI \u6807\u9898\u751f\u6210' : '\u6279\u91cf AI \u6807\u9898\u751f\u6210\u5b8c\u6210');
      scheduleStateSave();
    } catch (error) {
      products.value = products.value.map((product) => {
        return product.aiTitleStatus === 'processing'
          ? { ...product, aiTitleStatus: 'failed', aiTitleError: normalizeText(error && error.message) }
          : product;
      });
      showMessage(
        messageApi,
        'error',
        'AI \u6807\u9898\u751f\u6210\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5')
      );
    } finally {
      if (normalizeText(aiTitleRunId.value) === runId) {
        aiTitleRunId.value = '';
      }
      generatingAiTitles.value = false;
    }
  }

  async function stopBatchAiTitleGeneration() {
    const bridge = getBridge(featureBridge);
    const runId = normalizeText(aiTitleRunId.value);

    if (!bridge || typeof bridge.cancelPodUploadSheetMiaoshouAiTitles !== 'function' || !runId) {
      return { canceled: false };
    }

    return bridge.cancelPodUploadSheetMiaoshouAiTitles({ runId });
  }

  async function exportTable() {
    const bridge = getBridge(featureBridge);

    if (!bridge || exportingTable.value || !products.value.length) return;

    exportingTable.value = true;

    try {
      buildSkuRows();

      const exportProducts = clonePlainValue(products.value, []).map((product) => ({
        ...product,
        ...globalForm,
        skuConfigMap: getSkuConfigMapSnapshot()
      }));
      const result = await bridge.exportPodUploadSheetMiaoshouTable({
        templateId: globalForm.templateId,
        products: exportProducts
      });

      if (result && result.canceled) {
        showMessage(messageApi, 'warning', '\u5df2\u53d6\u6d88\u5bfc\u51fa');
        return;
      }

      showMessage(messageApi, 'success', `\u5df2\u5bfc\u51fa ${Number(result && result.rowCount) || 0} \u884c`);
    } catch (error) {
      showMessage(
        messageApi,
        'error',
        '\u5bfc\u51fa\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5')
      );
    } finally {
      exportingTable.value = false;
    }
  }

  onBeforeUnmount(() => {
    stopUploadProgressPolling();
  });

  return {
    importingProducts,
    uploadingImages,
    exportingTable,
    generatingAiTitles,
    aiTitleRunId,
    uploadProgress,
    uploadFailedFilePaths,
    aiProgress,
    aiTitleEligibleCount,
    aiTitleRetryCount,
    uploadProgressText,
    aiTitleProgressText,
    selectProduct,
    getProductRowClass,
    handleProductTitleChange,
    importProducts,
    clearProducts,
    getImageUploadSnapshot,
    executeImageUpload,
    stopImageUpload,
    getBatchAiTitleSnapshot,
    openBatchAiTitleDialog,
    executeBatchAiTitleGeneration,
    stopBatchAiTitleGeneration,
    exportTable
  };
}
