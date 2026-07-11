import { computed, reactive, ref } from 'vue';
import { DEFAULT_PRODUCT_FIELDS, TITLE_MAX_LENGTH } from './constants/podUploadSheetMiaoshou.js';
import {
  classifySection,
  createEmptyImportOrderMap,
  createEmptyPathMap,
  createId,
  createPodUploadSheetMiaoshouProduct,
  getImportedProductGroup,
  getMaterialNameKey,
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
  const uploadProgress = reactive({ total: 0, success: 0, uploaded: 0, cached: 0, failed: 0, canceled: 0 });
  const aiProgress = reactive({ total: 0, completed: 0, success: 0, failed: 0, canceled: 0 });

  const aiTitleEligibleCount = computed(() => products.value.filter((item) => getPrimaryProductImage(item)).length);
  const aiTitleRetryCount = computed(() => products.value.filter((item) => {
    return item.aiTitleStatus === 'failed' && getPrimaryProductImage(item);
  }).length);
  const uploadProgressText = computed(() => {
    if (!uploadProgress.total) return '';
    return `\u56fe\u7247\u4e0a\u4f20\uff1a${uploadProgress.success}/${uploadProgress.total}\uff0c\u65b0\u4f20 ${uploadProgress.uploaded}\uff0c\u7f13\u5b58 ${uploadProgress.cached}\uff0c\u5931\u8d25 ${uploadProgress.failed}`;
  });
  const aiTitleProgressText = computed(() => {
    if (!generatingAiTitles.value || !aiProgress.total) return '';
    return `AI\u6807\u9898\uff1a${aiProgress.completed}/${aiProgress.total}\uff0c\u6210\u529f ${aiProgress.success}\uff0c\u5931\u8d25 ${aiProgress.failed}`;
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
          materialImportOrderMap: createEmptyImportOrderMap()
        });
      }

      const group = groups.get(groupKey);
      const section = classifySection(file.name, file.webkitRelativePath);
      const name = normalizeMaterialName(file, groupInfo) || file.name;
      const key = getMaterialNameKey(name);

      group.materials[section].push(name);
      group.materialImportOrderMap[section].push(name);

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
        scheduleStateSave();
      }
    });
  }

  async function uploadImages() {
    const bridge = getBridge(featureBridge);

    if (!bridge || uploadingImages.value) return;

    uploadingImages.value = true;
    Object.assign(uploadProgress, { total: 0, success: 0, uploaded: 0, cached: 0, failed: 0, canceled: 0 });

    try {
      const result = await bridge.uploadPodUploadSheetMiaoshouCosImages({
        runId: createId('pod-cos'),
        products: products.value,
        imageUploadMode: 'original'
      });
      const items = Array.isArray(result && result.items) ? result.items : [];
      const urlByPath = new Map(items.filter((item) => {
        return item && item.status === 'success' && item.url;
      }).map((item) => [normalizeText(item.filePath), normalizeText(item.url)]));

      products.value = products.value.map((product) => {
        const nextProduct = createPodUploadSheetMiaoshouProduct(product, {
          defaultFields: DEFAULT_PRODUCT_FIELDS
        });

        ['carousel', 'assets', 'preview'].forEach((sectionId) => {
          nextProduct.materials[sectionId] = nextProduct.materials[sectionId].map((name) => {
            const key = getMaterialNameKey(name);
            const path = nextProduct.materialPathMap[sectionId][key];
            return urlByPath.get(path) || name;
          });
        });

        return nextProduct;
      });
      Object.assign(uploadProgress, {
        total: Number(result && result.totalCount) || items.length,
        success: Number(result && result.successCount) || 0,
        uploaded: Number(result && result.uploadedCount) || 0,
        cached: Number(result && result.cachedCount) || 0,
        failed: Number(result && result.failedCount) || 0,
        canceled: Number(result && result.canceledCount) || 0
      });
      showMessage(messageApi, 'success', '\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210');
      scheduleStateSave();
    } catch (error) {
      showMessage(
        messageApi,
        'error',
        '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5')
      );
    } finally {
      uploadingImages.value = false;
    }
  }

  function getBatchAiTitleSnapshot() {
    return {
      totalCount: aiTitleEligibleCount.value,
      retryCount: aiTitleRetryCount.value,
      prefixText: '',
      suffixText: '',
      extraPrompt: '',
      targetLength: '250',
      outputLanguage: 'en'
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
          title: normalizeText(item.zhTitle),
          englishTitle: normalizeText(item.enTitle),
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

    try {
      const runId = createId('pod-ai-title');
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
      showMessage(messageApi, 'success', '\u6279\u91cf AI \u6807\u9898\u751f\u6210\u5b8c\u6210');
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
      generatingAiTitles.value = false;
    }
  }

  async function exportTable() {
    const bridge = getBridge(featureBridge);

    if (!bridge || exportingTable.value || !products.value.length) return;

    exportingTable.value = true;

    try {
      buildSkuRows();

      const exportProducts = products.value.map((product) => ({
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

  return {
    importingProducts,
    uploadingImages,
    exportingTable,
    generatingAiTitles,
    uploadProgress,
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
    uploadImages,
    getBatchAiTitleSnapshot,
    openBatchAiTitleDialog,
    executeBatchAiTitleGeneration,
    exportTable
  };
}
