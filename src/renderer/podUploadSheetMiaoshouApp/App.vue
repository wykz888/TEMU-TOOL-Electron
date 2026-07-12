<template>
  <div class="pod-miaoshou-app-shell" data-ui-version="20260711-pod-opt-2">
    <header class="pod-miaoshou-app-header">
      <div class="pod-miaoshou-app-header__copy">
        <span class="pod-miaoshou-app-header__eyebrow">MIAOSHOU TEMU</span>
        <div class="pod-miaoshou-app-header__title-row">
          <h1>POD&#x4E0A;&#x8D27;&#x8868;&#x683C;</h1>
          <a-tag class="pod-miaoshou-theme-tag" bordered size="small">&#x5999;&#x624B; TEMU &#x7248;</a-tag>
        </div>
      </div>
    </header>

    <main class="pod-workbench">
      <TemplateWorkspacePanel
        v-model:selected-template-id="selectedTemplateId"
        v-model:template-name="templateName"
        :products-count="products.length"
        :loading-templates="loadingTemplates"
        :form-template-options="formTemplateOptions"
        :saving-template="savingTemplate"
        :deleting-template="deletingTemplate"
        :loading-categories="loadingCategories"
        :category-select-options="categorySelectOptions"
        :global-form="globalForm"
        :sync-global-to-products="syncGlobalToProducts"
        :apply-selected-template="applySelectedTemplate"
        :save-current-template="saveCurrentTemplate"
        :delete-selected-template="deleteSelectedTemplate"
      />

      <SkuSettingsPanel
        :global-form="globalForm"
        :sku-rows="skuRows"
        :sku-table-scroll="skuTableScroll"
        :sku-config-map="skuConfigMap"
        :sku-image-options="skuImageOptions"
        :custom-options="customOptions"
        :sync-global-to-products="syncGlobalToProducts"
        :sync-sku-config-to-products="syncSkuConfigToProducts"
        :handle-sku-spec-change="handleSkuSpecChange"
      />

      <ProductDataTable
        :products="products"
        :table-style="productTableStyle"
        :table-scroll="productTableScroll"
        :importing-products="importingProducts"
        :uploading-images="uploadingImages"
        :exporting-table="exportingTable"
        :saving-template="savingTemplate"
        :generating-ai-titles="generatingAiTitles"
        :ai-title-eligible-count="aiTitleEligibleCount"
        :upload-progress="uploadProgress"
        :upload-progress-text="uploadProgressText"
        :ai-title-progress-text="aiTitleProgressText"
        :ai-progress="aiProgress"
        :import-products="importProducts"
        :open-carousel-preset="openCarouselPreset"
        :open-random-carousel-preset="openRandomCarouselPreset"
        :open-description-preset="openDescriptionPreset"
        :open-image-upload-dialog="openImageUploadDialog"
        :open-batch-ai-title-dialog="openBatchAiTitleDialog"
        :export-table="exportTable"
        :save-current-template="saveCurrentTemplate"
        :clear-products="clearProducts"
        :get-product-row-class="getProductRowClass"
        :select-product="selectProduct"
        :handle-product-title-change="handleProductTitleChange"
        :retry-failed-image-upload="retryFailedImageUpload"
        :retry-failed-ai-title-generation="retryFailedAiTitleGeneration"
        :stop-image-upload-task="stopImageUploadTask"
        :stop-batch-ai-title-generation-task="stopBatchAiTitleGenerationTask"
      />
    </main>

    <MaterialPresetModals
      v-model:random-carousel-only-first="randomCarouselOnlyFirst"
      :carousel-preset-visible="carouselPresetVisible"
      :carousel-preset-candidates="carouselPresetCandidates"
      :carousel-preset-selected="carouselPresetSelected"
      :random-carousel-visible="randomCarouselVisible"
      :random-carousel-candidates="randomCarouselCandidates"
      :random-carousel-selected="randomCarouselSelected"
      :description-preset-visible="descriptionPresetVisible"
      :description-preset-candidates="descriptionPresetCandidates"
      :description-preset-selected="descriptionPresetSelected"
      :close-carousel-preset="closeCarouselPreset"
      :clear-carousel-preset-items="clearCarouselPresetItems"
      :select-all-carousel-preset-items="selectAllCarouselPresetItems"
      :is-carousel-preset-selected="isCarouselPresetSelected"
      :toggle-carousel-preset-item="toggleCarouselPresetItem"
      :get-carousel-preset-file-tip="getCarouselPresetFileTip"
      :get-carousel-preset-display-name="getCarouselPresetDisplayName"
      :move-carousel-preset-item="moveCarouselPresetItem"
      :apply-carousel-preset="applyCarouselPreset"
      :close-random-carousel-preset="closeRandomCarouselPreset"
      :select-all-random-carousel-items="selectAllRandomCarouselItems"
      :clear-random-carousel-items="clearRandomCarouselItems"
      :is-random-carousel-selected="isRandomCarouselSelected"
      :toggle-random-carousel-item="toggleRandomCarouselItem"
      :get-random-carousel-candidate="getRandomCarouselCandidate"
      :get-random-carousel-item-tip="getRandomCarouselItemTip"
      :apply-random-carousel-preset="applyRandomCarouselPreset"
      :close-description-preset="closeDescriptionPreset"
      :clear-description-preset-items="clearDescriptionPresetItems"
      :select-all-description-preset-items="selectAllDescriptionPresetItems"
      :is-description-preset-selected="isDescriptionPresetSelected"
      :toggle-description-preset-item="toggleDescriptionPresetItem"
      :move-description-preset-item="moveDescriptionPresetItem"
      :apply-description-preset="applyDescriptionPreset"
    />

    <AiTitleConfigModal
      :visible="aiTitleConfigVisible"
      :saving="aiTitleConfigSaving"
      :busy="aiTitleConfigBusy"
      :form="aiTitleConfigForm"
      :status="aiTitleConfigStatus"
      :model-options="aiTitleConfigModelOptions"
      :api-base-options="aiTitleConfigApiBaseOptions"
      :min-concurrency="aiTitleConfigMinConcurrency"
      :max-concurrency="aiTitleConfigMaxConcurrency"
      :resolve-status-type="resolveAiStatusType"
      @cancel="closeAiTitleConfigDialog"
      @save="saveAiTitleConfigDialog"
    />

    <BatchAiTitleModal
      :visible="batchAiTitleVisible"
      :starting="batchAiTitleStarting"
      :busy="batchAiTitleBusy"
      :form="batchAiTitleForm"
      :summary="batchAiTitleSummary"
      :status="batchAiTitleStatus"
      :show-output-language="true"
      :ai-platform-options="batchAiTitleAiPlatformOptions"
      :storage-provider-options="batchAiTitleStorageProviderOptions"
      :image-compression-options="batchAiTitleImageCompressionOptions"
      :output-language-options="batchAiTitleOutputLanguageOptions"
      :min-concurrency="batchAiTitleMinConcurrency"
      :max-concurrency="batchAiTitleMaxConcurrency"
      :min-target-length="batchAiTitleMinTargetLength"
      :max-target-length="batchAiTitleMaxTargetLength"
      :min-image-quality="batchAiTitleMinImageQuality"
      :max-image-quality="batchAiTitleMaxImageQuality"
      :resolve-status-type="resolveAiStatusType"
      @cancel="closeBatchAiTitleDialog"
      @start="startBatchAiTitleDialogGeneration"
    />

    <ImageUploadConfigModal
      :visible="imageUploadVisible"
      :starting="imageUploadStarting"
      :busy="imageUploadBusy"
      :form="imageUploadForm"
      :summary="imageUploadSummary"
      :status="imageUploadStatus"
      :storage-provider-options="imageUploadStorageProviderOptions"
      :image-upload-mode-options="imageUploadModeOptions"
      :min-concurrency="imageUploadMinConcurrency"
      :max-concurrency="imageUploadMaxConcurrency"
      :min-image-quality="imageUploadMinImageQuality"
      :max-image-quality="imageUploadMaxImageQuality"
      :handle-storage-provider-change="handleImageUploadStorageProviderChange"
      :resolve-status-type="resolveAiStatusType"
      @cancel="closeImageUploadDialog"
      @start="startImageUploadFromDialog"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import {
  customOptions
} from './constants/podUploadSheetMiaoshou.js';
import {
  normalizeText,
  resolveAiStatusType,
  splitLines
} from './utils/podUploadSheetMiaoshouData.js';
import {
  pickPreferenceFields,
  rememberPreferenceFields
} from './utils/dialogPreferenceCache.js';
import { useAiTitleConfigDialog } from './useAiTitleConfigDialog.js';
import { useBatchAiTitleDialog } from './useBatchAiTitleDialog.js';
import AiTitleConfigModal from './components/AiTitleConfigModal.vue';
import BatchAiTitleModal from '../shared/batchAiTitle/BatchAiTitleModal.vue';
import ImageUploadConfigModal from '../shared/imageUpload/ImageUploadConfigModal.vue';
import MaterialPresetModals from '../shared/materialPreset/MaterialPresetModals.vue';
import ProductDataTable from './components/ProductDataTable.vue';
import SkuSettingsPanel from './components/SkuSettingsPanel.vue';
import TemplateWorkspacePanel from './components/TemplateWorkspacePanel.vue';
import { useMaterialPresetDialogs } from '../shared/materialPreset/useMaterialPresetDialogs.js';
import { useImageUploadDialog } from '../shared/imageUpload/useImageUploadDialog.js';
import { useProductWorkflowTasks } from './useProductWorkflowTasks.js';
import { useSkuSettings } from './useSkuSettings.js';
import { useTemplateWorkspace } from './useTemplateWorkspace.js';

const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';
const IMAGE_UPLOAD_PREFERENCE_KEYS = Object.freeze([
  'storageProvider',
  'imageUploadMode',
  'concurrency',
  'imageQuality'
]);
const BATCH_AI_TITLE_PREFERENCE_KEYS = Object.freeze([
  'aiProvider',
  'apiBaseUrl',
  'model',
  'storageProvider',
  'imageCompression',
  'concurrency',
  'targetLength',
  'imageQuality',
  'prefixText',
  'suffixText',
  'outputLanguage',
  'useCache',
  'extraPrompt'
]);
const BATCH_AI_TITLE_EMPTY_TEXT_KEYS = Object.freeze([
  'prefixText',
  'suffixText',
  'extraPrompt',
  'outputLanguage'
]);
const products = ref([]);
const activeProductId = ref('');
const lastImportDirectoryPath = ref('');
const viewportHeight = ref(typeof window === 'undefined' ? 920 : window.innerHeight);
const imageUploadPreferenceCache = ref({});
const batchAiTitlePreferenceCache = ref({});
let cleanupAiTitleConfigBridge = null;
let cleanupBatchAiTitleBridge = null;
let cleanupImageUploadBridge = null;
let removeAiTitleProgressListener = null;

const globalForm = reactive({
  templateId: 'non-fashion',
  category: '',
  delivery: '2',
  origin: '\u4e2d\u56fd',
  isCustom: '\u5426',
  sourceLink: '',
  specNameOne: '',
  specValueOne: '',
  specNameTwo: '',
  specValueTwo: '',
  description: ''
});

const aiTitleConfigDialog = useAiTitleConfigDialog();
const aiTitleConfigVisible = aiTitleConfigDialog.visible;
const aiTitleConfigSaving = aiTitleConfigDialog.saving;
const aiTitleConfigBusy = aiTitleConfigDialog.busy;
const aiTitleConfigForm = aiTitleConfigDialog.form;
const aiTitleConfigStatus = aiTitleConfigDialog.status;
const aiTitleConfigModelOptions = aiTitleConfigDialog.modelOptions;
const aiTitleConfigApiBaseOptions = aiTitleConfigDialog.apiBaseOptions;
const aiTitleConfigMinConcurrency = aiTitleConfigDialog.minConcurrency;
const aiTitleConfigMaxConcurrency = aiTitleConfigDialog.maxConcurrency;
const closeAiTitleConfigDialog = aiTitleConfigDialog.closeDialog;
const saveAiTitleConfigDialog = aiTitleConfigDialog.saveDialog;

const batchAiTitleDialog = useBatchAiTitleDialog();
const batchAiTitleVisible = batchAiTitleDialog.visible;
const batchAiTitleStarting = batchAiTitleDialog.starting;
const batchAiTitleBusy = batchAiTitleDialog.busy;
const batchAiTitleForm = batchAiTitleDialog.form;
const batchAiTitleSummary = batchAiTitleDialog.summary;
const batchAiTitleStatus = batchAiTitleDialog.status;
const batchAiTitleAiPlatformOptions = batchAiTitleDialog.aiPlatformOptions;
const batchAiTitleStorageProviderOptions = batchAiTitleDialog.storageProviderOptions;
const batchAiTitleImageCompressionOptions = batchAiTitleDialog.imageCompressionOptions;
const batchAiTitleOutputLanguageOptions = batchAiTitleDialog.outputLanguageOptions;
const batchAiTitleMinConcurrency = batchAiTitleDialog.minConcurrency;
const batchAiTitleMaxConcurrency = batchAiTitleDialog.maxConcurrency;
const batchAiTitleMinTargetLength = batchAiTitleDialog.minTargetLength;
const batchAiTitleMaxTargetLength = batchAiTitleDialog.maxTargetLength;
const batchAiTitleMinImageQuality = batchAiTitleDialog.minImageQuality;
const batchAiTitleMaxImageQuality = batchAiTitleDialog.maxImageQuality;
function closeBatchAiTitleDialog() {
  collectBatchAiTitlePreferences();
  return batchAiTitleDialog.closeDialog();
}
function startBatchAiTitleDialogGenerationFromDialog(retryFailedOnly = false) {
  return batchAiTitleDialog.startGeneration(retryFailedOnly);
}

function collectBatchAiTitlePreferences(options = {}) {
  const payload = batchAiTitleDialog.collectPayload(false);

  if (options.remember !== false) {
    rememberPreferenceFields(
      batchAiTitlePreferenceCache,
      payload,
      BATCH_AI_TITLE_PREFERENCE_KEYS,
      BATCH_AI_TITLE_EMPTY_TEXT_KEYS
    );
  }

  return payload;
}

function applyBatchAiTitlePreferences(snapshot) {
  const preferences = rememberPreferenceFields(
    batchAiTitlePreferenceCache,
    snapshot,
    BATCH_AI_TITLE_PREFERENCE_KEYS,
    BATCH_AI_TITLE_EMPTY_TEXT_KEYS
  );

  return batchAiTitleDialog.applyPreferences({
    ...preferences,
    ...pickPreferenceFields(snapshot, BATCH_AI_TITLE_PREFERENCE_KEYS, BATCH_AI_TITLE_EMPTY_TEXT_KEYS)
  });
}

const featureBridge = computed(() => window.temuApp && window.temuApp.featureCenter ? window.temuApp.featureCenter : null);
const activeProduct = computed(() => products.value.find((item) => item.id === activeProductId.value) || products.value[0] || null);
const {
  skuDefaults,
  skuConfigMap,
  skuRows,
  skuTableScroll,
  skuImageOptions,
  buildSkuRows,
  getSkuConfigMapSnapshot,
  getSkuTemplateConfigMap,
  syncGlobalToProducts,
  syncSkuConfigToProducts,
  handleSkuSpecChange,
  applySkuTemplateConfig
} = useSkuSettings({
  products,
  activeProduct,
  globalForm,
  scheduleStateSave
});
const {
  carouselPresetVisible,
  carouselPresetText,
  carouselPresetSelected,
  randomCarouselVisible,
  randomCarouselOnlyFirst,
  randomCarouselSelected,
  descriptionPresetVisible,
  descriptionPresetText,
  descriptionPresetSelected,
  carouselPresetCandidates,
  descriptionPresetCandidates,
  randomCarouselCandidates,
  openCarouselPreset,
  closeCarouselPreset,
  getCarouselPresetDisplayName,
  getCarouselPresetFileTip,
  isCarouselPresetSelected,
  toggleCarouselPresetItem,
  selectAllCarouselPresetItems,
  clearCarouselPresetItems,
  moveCarouselPresetItem,
  applyCarouselPreset,
  openRandomCarouselPreset,
  closeRandomCarouselPreset,
  isRandomCarouselSelected,
  toggleRandomCarouselItem,
  selectAllRandomCarouselItems,
  clearRandomCarouselItems,
  getRandomCarouselCandidate,
  getRandomCarouselItemTip,
  applyRandomCarouselPreset,
  openDescriptionPreset,
  closeDescriptionPreset,
  isDescriptionPresetSelected,
  toggleDescriptionPresetItem,
  selectAllDescriptionPresetItems,
  clearDescriptionPresetItems,
  moveDescriptionPresetItem,
  applyDescriptionPreset
} = useMaterialPresetDialogs({
  products,
  activeProduct,
  scheduleStateSave,
  messageApi: Message
});
const {
  selectedTemplateId,
  templateName,
  loadingCategories,
  loadingTemplates,
  savingTemplate,
  deletingTemplate,
  categorySelectOptions,
  formTemplateOptions,
  loadInitialData,
  saveCurrentTemplate,
  applySelectedTemplate,
  deleteSelectedTemplate
} = useTemplateWorkspace({
  featureBridge,
  lastImportDirectoryPath,
  globalForm,
  carouselPresetText,
  randomCarouselOnlyFirst,
  randomCarouselSelected,
  descriptionPresetText,
  getSkuTemplateConfigMap,
  applySkuTemplateConfig,
  getImageUploadPreferences: collectImageUploadPreferences,
  applyImageUploadPreferences,
  getBatchAiTitlePreferences: collectBatchAiTitlePreferences,
  applyBatchAiTitlePreferences,
  scheduleStateSave,
  syncGlobalToProducts,
  messageApi: Message
});
  const {
    importingProducts,
    uploadingImages,
    exportingTable,
    generatingAiTitles,
    aiTitleRunId,
    uploadProgress,
    uploadFailedFilePaths,
    aiProgress,
    aiTitleEligibleCount,
    uploadProgressText,
    aiTitleProgressText,
  selectProduct,
  getProductRowClass,
  handleProductTitleChange,
  importProducts,
    clearProducts,
    getImageUploadSnapshot: getImageUploadProgressSnapshot,
    executeImageUpload,
    stopImageUpload: stopImageUploadTask,
    getBatchAiTitleSnapshot: getBatchAiTitleProgressSnapshot,
    executeBatchAiTitleGeneration,
    stopBatchAiTitleGeneration: stopBatchAiTitleGenerationTask,
    exportTable
} = useProductWorkflowTasks({
  products,
  activeProductId,
  lastImportDirectoryPath,
  globalForm,
  skuDefaults,
  featureBridge,
  batchAiTitleDialog,
  buildSkuRows,
  getSkuConfigMapSnapshot,
  scheduleStateSave,
  messageApi: Message,
  modalApi: Modal
});
const imageUploadDialog = useImageUploadDialog({
  startUpload: executeImageUpload
});
const imageUploadVisible = imageUploadDialog.visible;
const imageUploadStarting = imageUploadDialog.starting;
const imageUploadBusy = imageUploadDialog.busy;
const imageUploadForm = imageUploadDialog.form;
const imageUploadSummary = imageUploadDialog.summary;
const imageUploadStatus = imageUploadDialog.status;
const imageUploadStorageProviderOptions = imageUploadDialog.storageProviderOptions;
const imageUploadModeOptions = imageUploadDialog.imageUploadModeOptions;
const imageUploadMinConcurrency = imageUploadDialog.minConcurrency;
const imageUploadMaxConcurrency = imageUploadDialog.maxConcurrency;
const imageUploadMinImageQuality = imageUploadDialog.minImageQuality;
const imageUploadMaxImageQuality = imageUploadDialog.maxImageQuality;
function closeImageUploadDialog() {
  collectImageUploadPreferences();
  return imageUploadDialog.closeDialog();
}
function startImageUploadFromDialogFromDialog(retryFailedOnly = false) {
  return imageUploadDialog.startUploadFromDialog(retryFailedOnly);
}

const handleImageUploadStorageProviderChange = imageUploadDialog.handleStorageProviderChange;
function collectImageUploadPreferences(options = {}) {
  const payload = imageUploadDialog.collectPayload(false);

  if (options.remember !== false) {
    rememberPreferenceFields(imageUploadPreferenceCache, payload, IMAGE_UPLOAD_PREFERENCE_KEYS);
  }

  return payload;
}

function applyImageUploadPreferences(snapshot) {
  const preferences = rememberPreferenceFields(imageUploadPreferenceCache, snapshot, IMAGE_UPLOAD_PREFERENCE_KEYS);

  return imageUploadDialog.applyPreferences({
    ...preferences,
    ...pickPreferenceFields(snapshot, IMAGE_UPLOAD_PREFERENCE_KEYS)
  });
}
const productTableBodyHeight = computed(() => Math.max(580, Math.min(820, Math.round((viewportHeight.value - 500) * 1.55))));
const productTableScroll = computed(() => ({ x: 1280, y: productTableBodyHeight.value }));
const productTableStyle = computed(() => ({
  '--pod-product-table-body-height': `${productTableBodyHeight.value}px`
}));

function getImageUploadPreferencesSnapshot() {
  const progressSnapshot = getImageUploadProgressSnapshot();
  const preferences = collectImageUploadPreferences({ remember: false });

  return {
    ...progressSnapshot,
    ...preferences,
    ...imageUploadPreferenceCache.value,
    totalCount: progressSnapshot.totalCount,
    retryCount: progressSnapshot.retryCount,
    retryFilePaths: progressSnapshot.retryFilePaths
  };
}

function getBatchAiTitlePreferencesSnapshot() {
  const progressSnapshot = getBatchAiTitleProgressSnapshot();
  const preferences = collectBatchAiTitlePreferences({ remember: false });

  return {
    ...progressSnapshot,
    ...preferences,
    ...batchAiTitlePreferenceCache.value,
    totalCount: progressSnapshot.totalCount,
    retryCount: progressSnapshot.retryCount
  };
}

function openImageUploadDialog() {
  return imageUploadDialog.openDialog(getImageUploadPreferencesSnapshot());
}

function openBatchAiTitleDialog() {
  return batchAiTitleDialog.openDialog(getBatchAiTitlePreferencesSnapshot());
}

function startImageUploadFromDialog(retryFailedOnly = false) {
  collectImageUploadPreferences();
  scheduleStateSave();
  return startImageUploadFromDialogFromDialog(retryFailedOnly);
}

function startBatchAiTitleDialogGeneration(retryFailedOnly = false) {
  collectBatchAiTitlePreferences();
  scheduleStateSave();
  return startBatchAiTitleDialogGenerationFromDialog(retryFailedOnly);
}

function retryFailedImageUpload() {
  if (!uploadFailedFilePaths.value.length) {
    return undefined;
  }

  return executeImageUpload({
    ...collectImageUploadPreferences(),
    retryFailedOnly: true,
    retryFilePaths: uploadFailedFilePaths.value.slice()
  });
}

function retryFailedAiTitleGeneration() {
  if (!aiProgress.failed) {
    return undefined;
  }

  return executeBatchAiTitleGeneration({
    ...collectBatchAiTitlePreferences(),
    retryFailedOnly: true
  });
}

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight || viewportHeight.value;
}

let saveTimer = 0;
function scheduleStateSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    if (!featureBridge.value || typeof featureBridge.value.savePodUploadSheetMiaoshouWorkspaceState !== 'function') return;
    const imageUploadPreferences = collectImageUploadPreferences();
    const batchAiTitlePreferences = collectBatchAiTitlePreferences();
    void featureBridge.value.savePodUploadSheetMiaoshouWorkspaceState({
      lastImportDirectoryPath: lastImportDirectoryPath.value,
      selectedTemplateId: selectedTemplateId.value,
      templateName: templateName.value,
      imageUploadMode: imageUploadPreferences.imageUploadMode,
      imageUploadConfig: {
        storageProvider: imageUploadPreferences.storageProvider,
        imageUploadMode: imageUploadPreferences.imageUploadMode,
        concurrency: imageUploadPreferences.concurrency,
        imageQuality: imageUploadPreferences.imageQuality
      },
      carouselPresetMode: randomCarouselOnlyFirst.value ? 'random-first' : 'selected',
      carouselPresetRandomOrders: randomCarouselSelected.value.join(','),
      carouselPresetSelection: splitLines(carouselPresetText.value),
      randomCarouselOnlyFirst: randomCarouselOnlyFirst.value === true,
      descriptionPresetSelection: splitLines(descriptionPresetText.value),
      batchAiTitleConfig: {
        aiProvider: batchAiTitlePreferences.aiProvider,
        apiBaseUrl: batchAiTitlePreferences.apiBaseUrl,
        model: batchAiTitlePreferences.model,
        storageProvider: batchAiTitlePreferences.storageProvider,
        imageCompression: batchAiTitlePreferences.imageCompression,
        concurrency: batchAiTitlePreferences.concurrency,
        targetLength: batchAiTitlePreferences.targetLength,
        imageQuality: batchAiTitlePreferences.imageQuality,
        prefixText: batchAiTitlePreferences.prefixText,
        suffixText: batchAiTitlePreferences.suffixText,
        outputLanguage: batchAiTitlePreferences.outputLanguage,
        useCache: batchAiTitlePreferences.useCache,
        extraPrompt: batchAiTitlePreferences.extraPrompt
      }
    }).catch(() => undefined);
  }, 400);
}

function installVueBridge() {
  const existingBridge = window[VIEW_BRIDGE_KEY] && typeof window[VIEW_BRIDGE_KEY] === 'object' ? window[VIEW_BRIDGE_KEY] : {};
  const bridge = {
    ...existingBridge,
    getImageUploadSnapshot: getImageUploadPreferencesSnapshot,
    startImageUpload: executeImageUpload,
    getBatchAiTitleSnapshot: getBatchAiTitlePreferencesSnapshot,
    startBatchAiTitleGeneration: executeBatchAiTitleGeneration
  };
  window[VIEW_BRIDGE_KEY] = bridge;
  return () => {
    if (window[VIEW_BRIDGE_KEY] === bridge) delete window[VIEW_BRIDGE_KEY];
  };
}

onMounted(() => {
  console.info('[pod-upload-sheet-miaoshou] ui-version 20260711-pod-opt-2');
  document.documentElement.classList.add('pod-miaoshou-vue-mounted');
  document.body.classList.add('pod-miaoshou-vue-mounted');
  updateViewportHeight();
  window.addEventListener('resize', updateViewportHeight);
  cleanupAiTitleConfigBridge = aiTitleConfigDialog.installGlobalBridge();
  cleanupBatchAiTitleBridge = batchAiTitleDialog.installGlobalBridge();
  cleanupImageUploadBridge = imageUploadDialog.installGlobalBridge();
  const cleanupVueBridge = installVueBridge();
  cleanupBatchAiTitleBridge = ((previousCleanup) => () => {
    cleanupVueBridge();
    if (typeof previousCleanup === 'function') previousCleanup();
  })(cleanupBatchAiTitleBridge);
  if (featureBridge.value && typeof featureBridge.value.onPodUploadSheetMiaoshouAiTitleProgress === 'function') {
    removeAiTitleProgressListener = featureBridge.value.onPodUploadSheetMiaoshouAiTitleProgress((payload) => {
      const payloadRunId = normalizeText(payload && payload.runId);
      const activeRunId = normalizeText(aiTitleRunId.value);

      if (payloadRunId && payloadRunId !== activeRunId) {
        return;
      }

      Object.assign(aiProgress, {
        total: Number(payload && payload.totalCount) || aiProgress.total,
        completed: Number(payload && payload.completedCount) || aiProgress.completed,
        success: Number(payload && payload.successCount) || aiProgress.success,
        failed: Number(payload && payload.failedCount) || aiProgress.failed,
        canceled: Number(payload && payload.canceledCount) || aiProgress.canceled
      });
    });
  }
  void loadInitialData();
});

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer);
  document.documentElement.classList.remove('pod-miaoshou-vue-mounted');
  document.body.classList.remove('pod-miaoshou-vue-mounted');
  window.removeEventListener('resize', updateViewportHeight);
  if (typeof cleanupBatchAiTitleBridge === 'function') cleanupBatchAiTitleBridge();
  if (typeof cleanupImageUploadBridge === 'function') cleanupImageUploadBridge();
  if (typeof cleanupAiTitleConfigBridge === 'function') cleanupAiTitleConfigBridge();
  if (typeof removeAiTitleProgressListener === 'function') removeAiTitleProgressListener();
});

defineExpose({
  refresh() {
    return loadInitialData();
  }
});
</script>
