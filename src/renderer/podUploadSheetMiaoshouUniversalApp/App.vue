<template>
  <div class="pod-miaoshou-app-shell" data-ui-version="20260712-universal-align-1">
    <header class="pod-miaoshou-app-header">
      <div class="pod-miaoshou-app-header__copy">
        <span class="pod-miaoshou-app-header__eyebrow">MIAOSHOU UNIVERSAL</span>
        <div class="pod-miaoshou-app-header__title-row">
          <h1>POD&#x4E0A;&#x8D27;&#x8868;&#x683C;</h1>
          <a-tag class="pod-miaoshou-theme-tag" bordered size="small">&#x5999;&#x624B;&#x901A;&#x7528;&#x7248;</a-tag>
        </div>
      </div>
    </header>

    <main class="pod-workbench">
      <UniversalTemplateWorkspacePanel
        v-model:selected-template-id="selectedTemplateId"
        v-model:template-name="templateName"
        :products-count="products.length"
        :loading-templates="loadingTemplates"
        :form-template-options="formTemplateOptions"
        :saving-template="savingTemplate"
        :deleting-template="deletingTemplate"
        :global-form="globalForm"
        :sync-global-to-products="syncGlobalToProducts"
        :apply-selected-template="applySelectedTemplate"
        :save-current-template="saveCurrentTemplate"
        :delete-selected-template="deleteSelectedTemplate"
      />

      <UniversalSkuSettingsPanel
        :global-form="globalForm"
        :sku-rows="skuRows"
        :sku-config-map="skuConfigMap"
        :sku-image-options="skuImageOptions"
        :sync-sku-config-to-products="syncSkuConfigToProducts"
        :handle-sku-spec-change="handleSkuSpecChange"
      />

      <UniversalProductDataTable
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

    <BatchAiTitleModal
      :visible="batchAiTitleVisible"
      :starting="batchAiTitleStarting"
      :busy="batchAiTitleBusy"
      :form="batchAiTitleForm"
      :summary="batchAiTitleSummary"
      :status="batchAiTitleStatus"
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
import BatchAiTitleModal from '../shared/batchAiTitle/BatchAiTitleModal.vue';
import ImageUploadConfigModal from '../shared/imageUpload/ImageUploadConfigModal.vue';
import MaterialPresetModals from '../shared/materialPreset/MaterialPresetModals.vue';
import { useImageUploadDialog } from '../shared/imageUpload/useImageUploadDialog.js';
import { useMaterialPresetDialogs } from '../shared/materialPreset/useMaterialPresetDialogs.js';
import { useBatchAiTitleDialog } from './useBatchAiTitleDialog.js';
import UniversalProductDataTable from './components/UniversalProductDataTable.vue';
import UniversalSkuSettingsPanel from './components/UniversalSkuSettingsPanel.vue';
import UniversalTemplateWorkspacePanel from './components/UniversalTemplateWorkspacePanel.vue';

const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
const UNIVERSAL_TEMPLATE_ID = 'universal';
const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';
const MATERIAL_SECTIONS = Object.freeze(['carousel', 'assets', 'preview']);

const DEFAULT_PRODUCT_FIELDS = Object.freeze({
  localName: '',
  mainNumber: '',
  sourceFolder: '',
  sourceCategory: '',
  customAttributes: '',
  mainVideo: '',
  certificate: '',
  sizeChart: '',
  description: '',
  descriptionImageOrders: '',
  title: '',
  specValueOne: '',
  specValueTwo: '',
  aiTitleZh: '',
  aiTitleEn: '',
  aiTitleStatus: '',
  aiTitleError: '',
  aiTitlePatternSummary: '',
  aiTitleUpdatedAt: ''
});

const products = ref([]);
const activeProductId = ref('');
const formTemplates = ref([]);
const selectedTemplateId = ref('');
const templateName = ref('');
const imageUploadMode = ref('original');
const lastImportDirectoryPath = ref('');
const viewportHeight = ref(typeof window === 'undefined' ? 760 : window.innerHeight);
const importingProducts = ref(false);
const loadingTemplates = ref(false);
const savingTemplate = ref(false);
const deletingTemplate = ref(false);
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
const globalForm = reactive({
  sourceCategory: '',
  customAttributes: '',
  mainVideo: '',
  certificate: '',
  sizeChart: '',
  description: '',
  specValueOne: '',
  specValueTwo: ''
});
const skuConfigMap = reactive({});

let saveTimer = 0;
let cleanupBatchAiTitleBridge = null;
let cleanupImageUploadBridge = null;
let removeAiTitleProgressListener = null;
let uploadProgressPollTimer = 0;

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
const closeBatchAiTitleDialog = batchAiTitleDialog.closeDialog;
function startBatchAiTitleDialogGeneration(retryFailedOnly = false) {
  scheduleStateSave();
  return batchAiTitleDialog.startGeneration(retryFailedOnly);
}

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
const closeImageUploadDialog = imageUploadDialog.closeDialog;
const handleImageUploadStorageProviderChange = imageUploadDialog.handleStorageProviderChange;

function collectImageUploadPreferences() {
  return imageUploadDialog.collectPayload(false);
}

function applyImageUploadPreferences(snapshot) {
  return imageUploadDialog.applyPreferences(snapshot);
}

function collectBatchAiTitlePreferences() {
  return batchAiTitleDialog.collectPayload(false);
}

function applyBatchAiTitlePreferences(snapshot) {
  return batchAiTitleDialog.applyPreferences(snapshot);
}

function startImageUploadFromDialog(retryFailedOnly = false) {
  scheduleStateSave();
  return imageUploadDialog.startUploadFromDialog(retryFailedOnly);
}

function retryFailedImageUpload() {
  const payload = collectImageUploadPreferences();

  if (!uploadFailedFilePaths.value.length) {
    return undefined;
  }

  return executeImageUpload({
    ...payload,
    retryFailedOnly: true,
    retryFilePaths: uploadFailedFilePaths.value.slice()
  });
}

function retryFailedAiTitleGeneration() {
  const payload = collectBatchAiTitlePreferences();

  if (!aiProgress.failed) {
    return undefined;
  }

  return executeBatchAiTitleGeneration({
    ...payload,
    retryFailedOnly: true
  });
}

const featureBridge = computed(() => window.temuApp && window.temuApp.featureCenter ? window.temuApp.featureCenter : null);
const formTemplateOptions = computed(() => formTemplates.value.map((item) => ({ value: item.id, label: item.name })));
const activeProduct = computed(() => products.value.find((item) => item.id === activeProductId.value) || products.value[0] || null);
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
const skuRows = computed(() => buildSkuRows());
const skuImageOptions = computed(() => {
  const product = activeProduct.value;
  const items = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
  return items.map((item, index) => ({ value: String(index + 1), label: `\u7b2c${index + 1}\u5f20 ${normalizeText(item)}` }));
});
const aiTitleEligibleCount = computed(() => products.value.filter((item) => getPrimaryProductImage(item)).length);
const aiTitleRetryCount = computed(() => products.value.filter((item) => item.aiTitleStatus === 'failed' && getPrimaryProductImage(item)).length);
const productTableBodyHeight = computed(() => Math.max(380, Math.min(560, viewportHeight.value - 460)));
const productTableScroll = computed(() => ({ x: 1280, y: productTableBodyHeight.value }));
const productTableStyle = computed(() => ({
  '--pod-product-table-body-height': `${productTableBodyHeight.value}px`
}));
const hasUploadProgress = computed(() => Math.max(0, Number(uploadProgress.total) || 0) > 0);
const uploadProgressPercent = computed(() => {
  const total = Math.max(0, Number(uploadProgress.total) || 0);
  const completed = Math.max(0, Number(uploadProgress.completed) || 0);
  return total ? Math.max(0, Math.min(1, completed / total)) : 0;
});
const uploadProgressStateText = computed(() => {
  if (uploadProgress.runState === 'completed') return '\u5df2\u5b8c\u6210';
  if (uploadProgress.runState === 'failed') return '\u5931\u8d25';
  if (uploadProgress.runState === 'canceled') return '\u5df2\u53d6\u6d88';
  if (uploadProgress.runState === 'stopping') return '\u505c\u6b62\u4e2d';
  return '\u4e0a\u4f20\u4e2d';
});
const uploadProgressText = computed(() => {
  if (!uploadProgress.total) return '';
  return `\u65b0\u4f20 ${uploadProgress.uploaded}\uff0c\u7f13\u5b58 ${uploadProgress.cached}\uff0c\u5931\u8d25 ${uploadProgress.failed}`;
});
const aiTitleProgressText = computed(() => {
  if (!aiProgress.total) return '';
  return `\u6210\u529f ${aiProgress.success}\uff0c\u5931\u8d25 ${aiProgress.failed}`;
});

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitLines(value) {
  return String(value || '').replace(/\r\n/g, '\n').split(/[\n,;\uFF0C\u3001\uFF1B]+/).map((item) => normalizeText(item)).filter(Boolean);
}

function toSequenceText(value) {
  const values = (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item).replace(/\D+/g, ''))
    .filter(Boolean);

  return Array.from(new Set(values)).join(',');
}

function parseSequenceNumbers(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/[\n,;\uFF0C\u3001\uFF1B\s]+/)
    .map((item) => Number.parseInt(item, 10))
    .filter((item, index, items) => Number.isFinite(item) && item > 0 && items.indexOf(item) === index);
}

function getFilePath(file) {
  if (!file) return '';
  if (typeof file.path === 'string') return normalizeText(file.path);
  if (window.temuApp && window.temuApp.files && typeof window.temuApp.files.getPathForFile === 'function') {
    try {
      return normalizeText(window.temuApp.files.getPathForFile(file));
    } catch (_error) {
      return '';
    }
  }
  return '';
}

function getLeafName(value) {
  const text = normalizeText(value).replace(/\\/g, '/');
  const parts = text.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : text;
}

function stripExtension(value) {
  return getLeafName(value).replace(/\.[^.]+$/, '');
}

function getMaterialNameKey(value) {
  const base = stripExtension(value);
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const suffix = parts.length > 1 ? parts[parts.length - 1] : '';
  return normalizeText(/^\d{1,3}$/.test(suffix) ? suffix : base).toLowerCase();
}

function normalizeImportedMaterialName(fileName, context = {}) {
  const leafName = getLeafName(fileName);
  const baseName = stripExtension(leafName);
  const prefixes = [context.productKey, getLeafName(context.sourceFolder)]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  for (const prefix of prefixes) {
    const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s._-]+(.+)$`, 'i');
    const matched = baseName.match(pattern);
    if (matched && normalizeText(matched[1])) return normalizeText(matched[1]);
  }

  return leafName;
}

function createEmptyPathMap() {
  return { carousel: {}, assets: {}, preview: {} };
}

function clonePathMap(source) {
  const input = source && typeof source === 'object' ? source : {};
  return MATERIAL_SECTIONS.reduce((result, sectionId) => {
    result[sectionId] = { ...(input[sectionId] && typeof input[sectionId] === 'object' ? input[sectionId] : {}) };
    return result;
  }, createEmptyPathMap());
}

function createSkuEntry(source = {}) {
  return {
    declaredPrice: normalizeText(source.declaredPrice),
    skuImage: normalizeText(source.skuImage),
    platformSku: normalizeText(source.platformSku),
    stock: normalizeText(source.stock),
    skuWeightKg: normalizeText(source.skuWeightKg),
    skuSize: normalizeText(source.skuSize)
  };
}

function cloneSkuMap(source = {}) {
  return Object.entries(source && typeof source === 'object' ? source : {}).reduce((result, [key, value]) => {
    const normalizedKey = normalizeText(key);
    if (normalizedKey) result[normalizedKey] = createSkuEntry(value || {});
    return result;
  }, {});
}

function createProduct(overrides = {}) {
  const materials = overrides.materials && typeof overrides.materials === 'object' ? overrides.materials : {};
  return {
    id: normalizeText(overrides.id) || createId('pod-universal-product'),
    ...DEFAULT_PRODUCT_FIELDS,
    ...overrides,
    title: normalizeText(overrides.title),
    mainNumber: normalizeText(overrides.mainNumber),
    materials: {
      carousel: Array.isArray(materials.carousel) ? materials.carousel.slice() : [],
      assets: Array.isArray(materials.assets) ? materials.assets.slice() : [],
      preview: Array.isArray(materials.preview) ? materials.preview.slice() : []
    },
    materialPathMap: clonePathMap(overrides.materialPathMap),
    skuConfigMap: cloneSkuMap(overrides.skuConfigMap)
  };
}

function getImportedProductGroup(file) {
  const segments = normalizeText(file && file.webkitRelativePath).replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length >= 3) return { productKey: segments[segments.length - 2], sourceFolder: segments.slice(0, -1).join('/') };
  if (segments.length === 2) return { productKey: segments[0], sourceFolder: segments[0] };
  return { productKey: '\u6839\u76ee\u5f55\u5546\u54c1', sourceFolder: '' };
}

function classifySection(fileName, relativePath) {
  const text = `${fileName || ''} ${relativePath || ''}`.toLowerCase();
  if (/(preview|size|chart|\u5c3a\u5bf8)/i.test(text)) return 'preview';
  if (/(detail|asset|desc|\u8be6\u60c5)/i.test(text)) return 'assets';
  return 'carousel';
}

function buildFolderMainNumber(sourceFolder, fallbackName) {
  const parts = normalizeText(sourceFolder).replace(/\\/g, '/').split('/').map((item) => normalizeText(item)).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join('-');
  if (parts.length === 1) return parts[0];
  return normalizeText(fallbackName);
}

function applyGlobalFields(product) {
  return {
    ...product,
    ...globalForm,
    skuConfigMap: cloneSkuMap(skuConfigMap)
  };
}

function buildProductsFromFiles(files) {
  const groups = new Map();
  (Array.isArray(files) ? files : []).filter(Boolean).forEach((file) => {
    const groupInfo = getImportedProductGroup(file);
    const groupKey = `${groupInfo.sourceFolder}__${groupInfo.productKey}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        localName: groupInfo.productKey,
        sourceFolder: groupInfo.sourceFolder,
        materials: { carousel: [], assets: [], preview: [] },
        materialPathMap: createEmptyPathMap()
      });
    }

    const group = groups.get(groupKey);
    const sectionId = classifySection(file.name, file.webkitRelativePath);
    const itemName = normalizeImportedMaterialName(file.name, groupInfo) || normalizeText(file.name) || '\u672a\u547d\u540d\u56fe\u7247';
    const itemKey = getMaterialNameKey(itemName);
    const filePath = getFilePath(file);
    group.materials[sectionId].push(itemName);
    if (itemKey && filePath) group.materialPathMap[sectionId][itemKey] = filePath;
  });

  return Array.from(groups.values()).map((group) => {
    const mainNumber = buildFolderMainNumber(group.sourceFolder, group.localName);
    return createProduct(applyGlobalFields({
      ...group,
      mainNumber,
      title: mainNumber || group.localName
    }));
  });
}

function getSkuValues(value) {
  return splitLines(value);
}

function buildSkuKey(left, right) {
  return `${normalizeText(left)}${SKU_ROW_KEY_SEPARATOR}${normalizeText(right)}`;
}

function buildSkuRows() {
  const leftItems = getSkuValues(globalForm.specValueOne);
  const rightItems = getSkuValues(globalForm.specValueTwo);
  const left = leftItems.length ? leftItems : [''];
  const right = rightItems.length ? rightItems : [''];
  const rows = [];
  left.forEach((leftValue) => {
    right.forEach((rightValue) => {
      const key = buildSkuKey(leftValue, rightValue);
      if (!skuConfigMap[key]) skuConfigMap[key] = createSkuEntry();
      rows.push({ key, specValueOne: leftValue, specValueTwo: rightValue, ...skuConfigMap[key] });
    });
  });
  return rows;
}

function pruneSkuConfigMap() {
  const validKeys = new Set(buildSkuRows().map((row) => row.key));
  Object.keys(skuConfigMap).forEach((key) => {
    if (!validKeys.has(key)) delete skuConfigMap[key];
  });
}

function syncGlobalToProducts() {
  products.value = products.value.map((product) => applyGlobalFields(product));
  scheduleStateSave();
}

function handleSkuSpecChange() {
  pruneSkuConfigMap();
  syncGlobalToProducts();
}

function syncSkuConfigToProducts() {
  products.value = products.value.map((product) => ({ ...product, skuConfigMap: cloneSkuMap(skuConfigMap) }));
  scheduleStateSave();
}

function getMaterialPathByName(product, sectionId, itemName) {
  const key = getMaterialNameKey(itemName);
  const maps = clonePathMap(product && product.materialPathMap);
  if (maps[sectionId] && maps[sectionId][key]) return maps[sectionId][key];
  for (const fallbackSection of MATERIAL_SECTIONS) {
    if (maps[fallbackSection] && maps[fallbackSection][key]) return maps[fallbackSection][key];
  }
  return '';
}

function getPrimaryProductImage(product) {
  for (const sectionId of MATERIAL_SECTIONS) {
    const items = product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
    for (let index = 0; index < items.length; index += 1) {
      const name = normalizeText(items[index]);
      const path = getMaterialPathByName(product, sectionId, name);
      if (name && path) return { sectionId, name, path, order: index + 1 };
    }
  }
  return null;
}

function getMaterialTitle(product, sectionId) {
  return product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId].join('\n') : '';
}

function getPreviewItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 3);
}

function selectProduct(record) {
  activeProductId.value = record && record.id ? record.id : '';
}

function getProductRowClass(record) {
  return record && activeProductId.value === record.id ? 'is-active' : '';
}

function getAiStatusText(status) {
  if (status === 'success') return '\u6210\u529f';
  if (status === 'failed') return '\u5931\u8d25';
  if (status === 'processing') return '\u5904\u7406\u4e2d';
  if (status === 'canceled') return '\u5df2\u505c\u6b62';
  return '\u672a\u751f\u6210';
}

function getAiStatusColor(status) {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'processing') return 'arcoblue';
  return 'gray';
}

function resolveAiStatusType(tone) {
  if (tone === 'danger') return 'error';
  if (tone === 'warning') return 'warning';
  return 'info';
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(normalizeText(value));
}

function normalizeCandidatePath(value) {
  return normalizeText(value).replace(/\//g, '\\').toLowerCase();
}

function getImageUploadCandidateCount() {
  const candidatePathSet = new Set();

  products.value.forEach((product) => {
    MATERIAL_SECTIONS.forEach((sectionId) => {
      const items = product && product.materials && Array.isArray(product.materials[sectionId])
        ? product.materials[sectionId]
        : [];

      items.forEach((itemName) => {
        if (isHttpUrl(itemName)) {
          return;
        }

        const filePath = getMaterialPathByName(product, sectionId, itemName);
        const normalizedPath = normalizeCandidatePath(filePath);

        if (normalizedPath) {
          candidatePathSet.add(normalizedPath);
        }
      });
    });
  });

  return candidatePathSet.size;
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
    imageUploadMode: imageUploadMode.value || 'original',
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

function applyUploadProgressSnapshot(snapshot) {
  const progress = snapshot && snapshot.progress && typeof snapshot.progress === 'object'
    ? snapshot.progress
    : null;

  if (!progress) {
    return;
  }

  Object.assign(uploadProgress, {
    total: Number(progress.totalCount) || uploadProgress.total,
    completed: Number(progress.completedCount) || uploadProgress.completed,
    success: Number(progress.successCount) || uploadProgress.success,
    uploaded: Number(progress.uploadedCount) || uploadProgress.uploaded,
    cached: Number(progress.cachedCount) || uploadProgress.cached,
    failed: Number(progress.failedCount) || uploadProgress.failed,
    canceled: Number(progress.canceledCount) || uploadProgress.canceled,
    label: normalizeText(progress.label),
    runState: normalizeText(progress.runState) || uploadProgress.runState,
    storageProvider: normalizeText(progress.storageProvider) || uploadProgress.storageProvider,
    imageUploadMode: normalizeText(progress.imageUploadMode) || uploadProgress.imageUploadMode,
    concurrency: Number(progress.concurrency) || uploadProgress.concurrency,
    imageQuality: Number(progress.imageQuality) || uploadProgress.imageQuality
  });
}

function stopUploadProgressPolling() {
  if (uploadProgressPollTimer) {
    window.clearInterval(uploadProgressPollTimer);
    uploadProgressPollTimer = 0;
  }
}

function startUploadProgressPolling(runId) {
  stopUploadProgressPolling();

  uploadProgressPollTimer = window.setInterval(async () => {
    if (!featureBridge.value || typeof featureBridge.value.getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot !== 'function') {
      return;
    }

    try {
      applyUploadProgressSnapshot(await featureBridge.value.getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot({
        runId
      }));
    } catch (_error) {}
  }, 500);
}

function getImageUploadSnapshot() {
  const preferences = collectImageUploadPreferences();

  return {
    totalCount: getImageUploadCandidateCount(),
    retryCount: uploadFailedFilePaths.value.length,
    retryFilePaths: uploadFailedFilePaths.value.slice(),
    storageProvider: preferences.storageProvider || uploadProgress.storageProvider,
    imageUploadMode: preferences.imageUploadMode || imageUploadMode.value || uploadProgress.imageUploadMode || 'original',
    concurrency: preferences.concurrency || uploadProgress.concurrency || 8,
    imageQuality: preferences.imageQuality || uploadProgress.imageQuality || 90
  };
}

function openImageUploadDialog() {
  return imageUploadDialog.openDialog(getImageUploadSnapshot());
}

async function importProducts() {
  if (!featureBridge.value || typeof featureBridge.value.selectPodUploadSheetMiaoshouUniversalImportDirectory !== 'function') return;
  importingProducts.value = true;
  try {
    const result = await featureBridge.value.selectPodUploadSheetMiaoshouUniversalImportDirectory({ defaultPath: lastImportDirectoryPath.value });
    if (!result || result.canceled) return;
    const nextProducts = buildProductsFromFiles(result.files || []);
    if (!nextProducts.length) {
      Message.warning('\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u5bfc\u5165\u7684\u672c\u5730\u5546\u54c1\u56fe\u7247');
      return;
    }
    products.value.push(...nextProducts);
    activeProductId.value = nextProducts[0].id;
    lastImportDirectoryPath.value = normalizeText(result.directoryPath) || lastImportDirectoryPath.value;
    uploadFailedFilePaths.value = [];
    resetUploadProgress();
    Message.success(`\u5df2\u5bfc\u5165 ${nextProducts.length} \u4e2a\u5546\u54c1`);
    scheduleStateSave();
  } catch (error) {
    Message.error('\u5bfc\u5165\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    importingProducts.value = false;
  }
}

function clearProducts() {
  Modal.warning({
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

function handleProductTitleChange() {
  scheduleStateSave();
}

function applyImageUploadResult(result) {
  const items = Array.isArray(result && result.items) ? result.items : [];
  const urlByPath = new Map(items.filter((item) => {
    return item && item.status === 'success' && item.url;
  }).map((item) => [normalizeText(item.filePath), normalizeText(item.url)]));

  products.value = products.value.map((product) => {
    const nextProduct = createProduct(product);

    MATERIAL_SECTIONS.forEach((sectionId) => {
      nextProduct.materials[sectionId] = nextProduct.materials[sectionId].map((name) => {
        const filePath = getMaterialPathByName(nextProduct, sectionId, name);
        return urlByPath.get(filePath) || name;
      });
    });

    return nextProduct;
  });

  uploadFailedFilePaths.value = items
    .filter((item) => item && item.status === 'failed' && normalizeText(item.filePath))
    .map((item) => normalizeText(item.filePath));

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
  if (!featureBridge.value || uploadingImages.value) return;

  const nextImageUploadMode = normalizeText(options && options.imageUploadMode) || imageUploadMode.value || 'original';
  const nextStorageProvider = normalizeText(options && options.storageProvider) || 'tencent-cos';
  const nextConcurrency = Math.max(1, Number(options && options.concurrency) || 8);
  const nextImageQuality = Math.max(1, Number(options && options.imageQuality) || 90);

  imageUploadMode.value = nextImageUploadMode;
  uploadingImages.value = true;
  resetUploadProgress();
  const runId = createId('pod-universal-cos');
  uploadRunId.value = runId;
  Object.assign(uploadProgress, {
    runState: 'starting',
    storageProvider: nextStorageProvider,
    imageUploadMode: nextImageUploadMode,
    concurrency: nextConcurrency,
    imageQuality: nextImageQuality
  });

  try {
    startUploadProgressPolling(runId);

    const result = await featureBridge.value.uploadPodUploadSheetMiaoshouUniversalCosImages({
      runId,
      storageProvider: nextStorageProvider,
      imageUploadMode: nextImageUploadMode,
      concurrency: nextConcurrency,
      imageQuality: nextImageQuality,
      retryFailedOnly: options && options.retryFailedOnly === true,
      retryFilePaths: Array.isArray(options && options.retryFilePaths) ? options.retryFilePaths.slice() : [],
      products: products.value
    });

    applyImageUploadResult(result);
    if (result && result.canceled) {
      Message.warning('\u5df2\u505c\u6b62\u56fe\u7247\u4e0a\u4f20');
    } else {
      Message.success('\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210');
    }
    scheduleStateSave();
  } catch (error) {
    Object.assign(uploadProgress, {
      runState: 'failed'
    });
    Message.error('\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    stopUploadProgressPolling();
    if (normalizeText(uploadRunId.value) === runId) {
      uploadRunId.value = '';
    }
    uploadingImages.value = false;
  }
}

async function stopImageUploadTask() {
  if (!featureBridge.value || typeof featureBridge.value.cancelPodUploadSheetMiaoshouUniversalCosImages !== 'function') {
    return { canceled: false };
  }

  const runId = normalizeText(uploadRunId.value);

  if (!runId) {
    return { canceled: false };
  }

  return featureBridge.value.cancelPodUploadSheetMiaoshouUniversalCosImages({
    runId
  });
}

function getBatchAiTitleSnapshot() {
  const preferences = collectBatchAiTitlePreferences();

  return {
    totalCount: aiTitleEligibleCount.value,
    retryCount: aiTitleRetryCount.value,
    aiProvider: preferences.aiProvider,
    apiBaseUrl: preferences.apiBaseUrl,
    model: preferences.model,
    storageProvider: preferences.storageProvider,
    imageCompression: preferences.imageCompression,
    concurrency: preferences.concurrency,
    targetLength: preferences.targetLength || '250',
    imageQuality: preferences.imageQuality,
    prefixText: preferences.prefixText,
    suffixText: preferences.suffixText,
    outputLanguage: preferences.outputLanguage || 'en',
    useCache: preferences.useCache,
    extraPrompt: preferences.extraPrompt
  };
}

function openBatchAiTitleDialog() {
  return batchAiTitleDialog.openDialog(getBatchAiTitleSnapshot());
}

async function executeBatchAiTitleGeneration(options = {}) {
  if (!featureBridge.value || generatingAiTitles.value) return;
  const retryFailedOnly = options && options.retryFailedOnly === true;
  const targetProducts = products.value.filter((product) => {
    if (retryFailedOnly && product.aiTitleStatus !== 'failed') return false;
    return Boolean(getPrimaryProductImage(product));
  });
  if (!targetProducts.length) {
    Message.warning('\u6ca1\u6709\u53ef\u751f\u6210\u6807\u9898\u7684\u5546\u54c1');
    return;
  }
  generatingAiTitles.value = true;
  Object.assign(aiProgress, { total: targetProducts.length, completed: 0, success: 0, failed: 0, canceled: 0 });
  products.value = products.value.map((product) => targetProducts.some((item) => item.id === product.id) ? { ...product, aiTitleStatus: 'processing' } : product);
  const runId = createId('pod-universal-ai-title');
  aiTitleRunId.value = runId;
  try {
    const result = await featureBridge.value.generatePodUploadSheetMiaoshouAiTitles({
      ...options,
      runId,
      entryId: 'pod-upload-sheet-miaoshou-universal-table',
      products: targetProducts.map((product) => {
        const primaryImage = getPrimaryProductImage(product);
        return {
          id: product.id,
          localName: product.localName,
          sourceFolder: product.sourceFolder,
          mainNumber: product.mainNumber,
          categoryId: product.sourceCategory,
          categoryLabel: product.sourceCategory,
          imageName: primaryImage.name,
          imagePath: primaryImage.path
        };
      })
    });
    applyAiTitleResults(result);
    if (result && result.canceled) {
      Message.warning('\u5df2\u505c\u6b62 AI \u6807\u9898\u751f\u6210');
    } else {
      Message.success('\u6279\u91cf AI \u6807\u9898\u751f\u6210\u5b8c\u6210');
    }
    scheduleStateSave();
  } catch (error) {
    products.value = products.value.map((product) => product.aiTitleStatus === 'processing' ? { ...product, aiTitleStatus: 'failed', aiTitleError: normalizeText(error && error.message) } : product);
    Message.error('AI \u6807\u9898\u751f\u6210\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    if (normalizeText(aiTitleRunId.value) === runId) {
      aiTitleRunId.value = '';
    }
    generatingAiTitles.value = false;
  }
}

async function stopBatchAiTitleGenerationTask() {
  if (!featureBridge.value || typeof featureBridge.value.cancelPodUploadSheetMiaoshouAiTitles !== 'function') {
    return { canceled: false };
  }

  const runId = normalizeText(aiTitleRunId.value);

  if (!runId) {
    return { canceled: false };
  }

  return featureBridge.value.cancelPodUploadSheetMiaoshouAiTitles({
    runId
  });
}

function applyAiTitleResults(result) {
  const items = Array.isArray(result && result.items) ? result.items : [];
  const itemMap = new Map(items.map((item) => [normalizeText(item && item.id), item]));
  products.value = products.value.map((product) => {
    const item = itemMap.get(product.id);
    if (!item) return product.aiTitleStatus === 'processing' ? { ...product, aiTitleStatus: 'failed' } : product;
    if (item.status === 'success') {
      const title = normalizeText(item.enTitle || item.zhTitle);
      return { ...product, title: title || product.title, aiTitleZh: normalizeText(item.zhTitle), aiTitleEn: normalizeText(item.enTitle), aiTitleStatus: 'success', aiTitleError: '', aiTitlePatternSummary: normalizeText(item.patternSummary), aiTitleUpdatedAt: normalizeText(result && result.updatedAt) };
    }
    return { ...product, aiTitleStatus: item.status === 'canceled' ? 'canceled' : 'failed', aiTitleError: normalizeText(item.error), aiTitleUpdatedAt: normalizeText(result && result.updatedAt) };
  });
  Object.assign(aiProgress, {
    total: Number(result && result.totalCount) || items.length,
    completed: Number(result && result.totalCount) || items.length,
    success: Number(result && result.successCount) || 0,
    failed: Number(result && result.failedCount) || 0,
    canceled: Number(result && result.canceledCount) || 0
  });
}

async function exportTable() {
  if (!featureBridge.value || exportingTable.value || !products.value.length) return;
  exportingTable.value = true;
  try {
    const result = await featureBridge.value.exportPodUploadSheetMiaoshouUniversalTable({
      templateId: UNIVERSAL_TEMPLATE_ID,
      products: products.value.map((product) => applyGlobalFields(product))
    });
    if (result && result.canceled) {
      Message.warning('\u5df2\u53d6\u6d88\u5bfc\u51fa');
      return;
    }
    Message.success(`\u5df2\u5bfc\u51fa ${Number(result && result.rowCount) || 0} \u884c`);
  } catch (error) {
    Message.error('\u5bfc\u51fa\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    exportingTable.value = false;
  }
}

async function loadFormTemplates() {
  if (!featureBridge.value) return;
  loadingTemplates.value = true;
  try {
    const result = await featureBridge.value.getPodUploadSheetMiaoshouUniversalFormTemplates();
    formTemplates.value = Array.isArray(result && result.templates) ? result.templates : [];
    const selectedTemplate = selectedTemplateId.value
      ? formTemplates.value.find((item) => item.id === selectedTemplateId.value)
      : null;

    if (selectedTemplate) {
      applySelectedTemplate(selectedTemplate.id);
      return;
    }

    if (formTemplates.value.length > 0) {
      selectedTemplateId.value = formTemplates.value[0].id;
      applySelectedTemplate(selectedTemplateId.value);
    }
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadWorkspaceState() {
  if (!featureBridge.value) return;
  const result = await featureBridge.value.getPodUploadSheetMiaoshouUniversalWorkspaceState().catch(() => null);
  const workspace = result && result.workspace ? result.workspace : {};
  const workspaceImageUploadConfig = workspace.imageUploadConfig && typeof workspace.imageUploadConfig === 'object'
    ? workspace.imageUploadConfig
    : workspace;
  const workspaceBatchAiTitleConfig = workspace.batchAiTitleConfig && typeof workspace.batchAiTitleConfig === 'object'
    ? workspace.batchAiTitleConfig
    : workspace;

  selectedTemplateId.value = normalizeText(workspace.selectedTemplateId || workspace.templateId);
  templateName.value = normalizeText(workspace.templateName || workspace.selectedTemplateName);
  imageUploadMode.value = normalizeText(workspaceImageUploadConfig.imageUploadMode || workspace.imageUploadMode) || 'original';
  lastImportDirectoryPath.value = normalizeText(workspace.lastImportDirectoryPath);
  carouselPresetText.value = Array.isArray(workspace.carouselPresetSelection) ? workspace.carouselPresetSelection.join('\n') : '';
  descriptionPresetText.value = Array.isArray(workspace.descriptionPresetSelection) ? workspace.descriptionPresetSelection.join('\n') : '';
  randomCarouselOnlyFirst.value = workspace.randomCarouselOnlyFirst === true
    || normalizeText(workspace.carouselPresetMode) === 'random-first';
  randomCarouselSelected.value = parseSequenceNumbers(workspace.carouselPresetRandomOrders);
  applyImageUploadPreferences(workspaceImageUploadConfig);
  applyBatchAiTitlePreferences(workspaceBatchAiTitleConfig);
}

async function loadInitialData() {
  await loadWorkspaceState();
  await loadFormTemplates();
}

function buildTemplatePayload() {
  const imageUploadConfig = collectImageUploadPreferences();
  const batchAiTitleConfig = collectBatchAiTitlePreferences();

  return {
    templateId: selectedTemplateId.value,
    templateName: templateName.value,
    fields: {
      ...globalForm,
      aiTitlePrefix: normalizeText(batchAiTitleConfig.prefixText),
      aiTitleSuffix: normalizeText(batchAiTitleConfig.suffixText),
      aiTitleExtraPrompt: normalizeText(batchAiTitleConfig.extraPrompt),
      aiTitleMaxLength: normalizeText(batchAiTitleConfig.targetLength || '250')
    },
    skuConfigMap: cloneSkuMap(skuConfigMap),
    batchPreset: {
      carouselPresetMode: randomCarouselOnlyFirst.value ? 'random-first' : 'selected',
      carouselPresetRandomOrders: toSequenceText(randomCarouselSelected.value),
      carouselPresetSelection: splitLines(carouselPresetText.value),
      randomCarouselOnlyFirst: randomCarouselOnlyFirst.value === true,
      descriptionPresetSelection: splitLines(descriptionPresetText.value)
    },
    imageUploadConfig: {
      storageProvider: normalizeText(imageUploadConfig.storageProvider),
      imageUploadMode: normalizeText(imageUploadConfig.imageUploadMode),
      concurrency: normalizeText(imageUploadConfig.concurrency),
      imageQuality: normalizeText(imageUploadConfig.imageQuality)
    },
    batchAiTitleConfig: {
      aiProvider: normalizeText(batchAiTitleConfig.aiProvider),
      apiBaseUrl: normalizeText(batchAiTitleConfig.apiBaseUrl),
      model: normalizeText(batchAiTitleConfig.model),
      storageProvider: normalizeText(batchAiTitleConfig.storageProvider),
      imageCompression: normalizeText(batchAiTitleConfig.imageCompression),
      concurrency: normalizeText(batchAiTitleConfig.concurrency),
      targetLength: normalizeText(batchAiTitleConfig.targetLength),
      imageQuality: normalizeText(batchAiTitleConfig.imageQuality),
      prefixText: normalizeText(batchAiTitleConfig.prefixText),
      suffixText: normalizeText(batchAiTitleConfig.suffixText),
      outputLanguage: normalizeText(batchAiTitleConfig.outputLanguage),
      useCache: batchAiTitleConfig.useCache === false ? false : true,
      extraPrompt: normalizeText(batchAiTitleConfig.extraPrompt)
    }
  };
}

async function saveCurrentTemplate() {
  if (!featureBridge.value) return;
  if (!normalizeText(templateName.value)) {
    Message.warning('\u8bf7\u5148\u586b\u5199\u6a21\u677f\u540d\u79f0');
    return;
  }
  savingTemplate.value = true;
  try {
    const result = await featureBridge.value.savePodUploadSheetMiaoshouUniversalFormTemplate(buildTemplatePayload());
    formTemplates.value = Array.isArray(result && result.templates) ? result.templates : formTemplates.value;
    selectedTemplateId.value = normalizeText(result && result.templateId) || selectedTemplateId.value;
    scheduleStateSave();
    Message.success('\u6a21\u677f\u5df2\u4fdd\u5b58');
  } catch (error) {
    Message.error('\u4fdd\u5b58\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    savingTemplate.value = false;
  }
}

function applySelectedTemplate(value) {
  const template = formTemplates.value.find((item) => item.id === value);
  if (!template) return;
  selectedTemplateId.value = template.id;
  templateName.value = template.name;
  Object.assign(globalForm, {
    sourceCategory: '',
    customAttributes: '',
    mainVideo: '',
    certificate: '',
    sizeChart: '',
    description: '',
    specValueOne: '',
    specValueTwo: '',
    ...(template.fields || {})
  });
  Object.keys(skuConfigMap).forEach((key) => delete skuConfigMap[key]);
  Object.assign(skuConfigMap, cloneSkuMap(template.skuConfigMap));
  if (template.batchPreset) {
    carouselPresetText.value = Array.isArray(template.batchPreset.carouselPresetSelection)
      ? template.batchPreset.carouselPresetSelection.join('\n')
      : '';
    descriptionPresetText.value = Array.isArray(template.batchPreset.descriptionPresetSelection)
      ? template.batchPreset.descriptionPresetSelection.join('\n')
      : '';
    randomCarouselOnlyFirst.value = template.batchPreset.randomCarouselOnlyFirst === true
      || normalizeText(template.batchPreset.carouselPresetMode) === 'random-first';
    randomCarouselSelected.value = parseSequenceNumbers(template.batchPreset.carouselPresetRandomOrders);
  }
  imageUploadMode.value = normalizeText(template.imageUploadConfig && template.imageUploadConfig.imageUploadMode)
    || imageUploadMode.value
    || 'original';
  applyImageUploadPreferences(template.imageUploadConfig || {});
  applyBatchAiTitlePreferences(template.batchAiTitleConfig || {});
  syncGlobalToProducts();
  scheduleStateSave();
}

async function deleteSelectedTemplate() {
  if (!featureBridge.value || !selectedTemplateId.value) return;
  deletingTemplate.value = true;
  try {
    const result = await featureBridge.value.deletePodUploadSheetMiaoshouUniversalFormTemplate({ templateId: selectedTemplateId.value });
    formTemplates.value = Array.isArray(result && result.templates) ? result.templates : formTemplates.value.filter((item) => item.id !== selectedTemplateId.value);
    selectedTemplateId.value = '';
    Message.success('\u6a21\u677f\u5df2\u5220\u9664');
  } finally {
    deletingTemplate.value = false;
  }
}

function scheduleStateSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    if (!featureBridge.value || typeof featureBridge.value.savePodUploadSheetMiaoshouUniversalWorkspaceState !== 'function') return;
    const imageUploadPreferences = collectImageUploadPreferences();
    const batchAiTitlePreferences = collectBatchAiTitlePreferences();
    void featureBridge.value.savePodUploadSheetMiaoshouUniversalWorkspaceState({
      workspace: {
        lastImportDirectoryPath: lastImportDirectoryPath.value,
        imageUploadMode: imageUploadPreferences.imageUploadMode,
        selectedTemplateId: selectedTemplateId.value,
        templateName: templateName.value,
        imageUploadConfig: {
          storageProvider: imageUploadPreferences.storageProvider,
          imageUploadMode: imageUploadPreferences.imageUploadMode,
          concurrency: imageUploadPreferences.concurrency,
          imageQuality: imageUploadPreferences.imageQuality
        },
        carouselPresetMode: randomCarouselOnlyFirst.value ? 'random-first' : 'selected',
        carouselPresetRandomOrders: toSequenceText(randomCarouselSelected.value),
        randomCarouselOnlyFirst: randomCarouselOnlyFirst.value === true,
        carouselPresetSelection: splitLines(carouselPresetText.value),
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
      }
    }).catch(() => undefined);
  }, 400);
}

function installVueBridge() {
  const existingBridge = window[VIEW_BRIDGE_KEY] && typeof window[VIEW_BRIDGE_KEY] === 'object' ? window[VIEW_BRIDGE_KEY] : {};
  const bridge = {
    ...existingBridge,
    getImageUploadSnapshot,
    startImageUpload: executeImageUpload,
    stopImageUpload: stopImageUploadTask,
    getBatchAiTitleSnapshot,
    startBatchAiTitleGeneration: executeBatchAiTitleGeneration,
    stopBatchAiTitleGeneration: stopBatchAiTitleGenerationTask
  };
  window[VIEW_BRIDGE_KEY] = bridge;
  return () => {
    if (window[VIEW_BRIDGE_KEY] === bridge) delete window[VIEW_BRIDGE_KEY];
  };
}

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight || viewportHeight.value;
}

onMounted(() => {
  console.info('[pod-upload-sheet-miaoshou-universal] ui-version 20260712-universal-align-1');
  document.documentElement.classList.add('pod-miaoshou-vue-mounted');
  document.body.classList.add('pod-miaoshou-vue-mounted');
  updateViewportHeight();
  window.addEventListener('resize', updateViewportHeight);
  cleanupBatchAiTitleBridge = batchAiTitleDialog.installGlobalBridge();
  cleanupImageUploadBridge = imageUploadDialog.installGlobalBridge();
  const cleanupVueBridge = installVueBridge();
  cleanupBatchAiTitleBridge = ((previousCleanup) => () => {
    cleanupVueBridge();
    if (typeof previousCleanup === 'function') previousCleanup();
  })(cleanupBatchAiTitleBridge);
  if (featureBridge.value && typeof featureBridge.value.onPodUploadSheetMiaoshouAiTitleProgress === 'function') {
    removeAiTitleProgressListener = featureBridge.value.onPodUploadSheetMiaoshouAiTitleProgress((payload) => {
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
  stopUploadProgressPolling();
  document.documentElement.classList.remove('pod-miaoshou-vue-mounted');
  document.body.classList.remove('pod-miaoshou-vue-mounted');
  window.removeEventListener('resize', updateViewportHeight);
  if (typeof cleanupBatchAiTitleBridge === 'function') cleanupBatchAiTitleBridge();
  if (typeof cleanupImageUploadBridge === 'function') cleanupImageUploadBridge();
  if (typeof removeAiTitleProgressListener === 'function') removeAiTitleProgressListener();
});

defineExpose({
  refresh() {
    return loadInitialData();
  }
});
</script>
