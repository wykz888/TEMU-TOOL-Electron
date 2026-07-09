<template>
  <div class="pod-miaoshou-app-shell">
    <header class="pod-miaoshou-app-header">
      <div class="pod-miaoshou-app-header__copy">
        <span class="pod-miaoshou-app-header__eyebrow">MIAOSHOU UNIVERSAL</span>
        <div class="pod-miaoshou-app-header__title-row">
          <h1>POD&#x4E0A;&#x8D27;&#x8868;&#x683C;</h1>
          <a-tag class="pod-miaoshou-theme-tag" bordered size="small">&#x5999;&#x624B;&#x901A;&#x7528;&#x7248;</a-tag>
        </div>
      </div>
      <div class="pod-miaoshou-app-header__meta">
        <a-button class="pod-theme-button" type="primary" :loading="savingTemplate" @click="saveCurrentTemplate">
          &#x4FDD;&#x5B58;&#x6A21;&#x677F;
        </a-button>
        <a-button class="pod-danger-button" :disabled="!selectedTemplateId" :loading="deletingTemplate" @click="deleteSelectedTemplate">
          &#x5220;&#x9664;&#x6A21;&#x677F;
        </a-button>
      </div>
    </header>

    <main class="pod-workbench">
      <section class="pod-panel pod-template-panel pod-universal-template-panel">
        <div class="pod-panel-head">
          <div>
            <p class="pod-panel-tag">&#x6A21;&#x677F;</p>
            <h2 class="pod-panel-title">&#x901A;&#x7528;&#x8868;&#x683C;&#x5B57;&#x6BB5;</h2>
          </div>
          <a-tag class="pod-miaoshou-theme-tag" bordered>{{ products.length }} &#x4E2A;&#x5546;&#x54C1;</a-tag>
        </div>
        <div class="pod-template-save-row">
          <label class="pod-field">
            <span class="pod-field-label">&#x5DF2;&#x4FDD;&#x5B58;&#x6A21;&#x677F;</span>
            <a-select v-model="selectedTemplateId" allow-clear :loading="loadingTemplates" :options="formTemplateOptions" @change="applySelectedTemplate" />
          </label>
          <label class="pod-field">
            <span class="pod-field-label">&#x6A21;&#x677F;&#x540D;&#x79F0;</span>
            <a-input v-model="templateName" allow-clear />
          </label>
        </div>
        <div class="pod-universal-main-row">
          <label class="pod-field">
            <span class="pod-field-label">&#x8D27;&#x6E90;&#x7C7B;&#x76EE;</span>
            <a-input v-model="globalForm.sourceCategory" allow-clear @change="syncGlobalToProducts" />
          </label>
          <label class="pod-field">
            <span class="pod-field-label">&#x81EA;&#x5B9A;&#x4E49;&#x5C5E;&#x6027;</span>
            <a-input v-model="globalForm.customAttributes" allow-clear @change="syncGlobalToProducts" />
          </label>
        </div>
        <div class="pod-universal-media-row">
          <label class="pod-field">
            <span class="pod-field-label">&#x4EA7;&#x54C1;&#x89C6;&#x9891;</span>
            <a-input v-model="globalForm.mainVideo" allow-clear @change="syncGlobalToProducts" />
          </label>
          <label class="pod-field">
            <span class="pod-field-label">&#x4EA7;&#x54C1;&#x8BC1;&#x4E66;</span>
            <a-input v-model="globalForm.certificate" allow-clear @change="syncGlobalToProducts" />
          </label>
          <label class="pod-field">
            <span class="pod-field-label">&#x5C3A;&#x5BF8;&#x56FE;&#x8868;</span>
            <a-input v-model="globalForm.sizeChart" allow-clear @change="syncGlobalToProducts" />
          </label>
        </div>
        <div class="pod-universal-description-row">
          <label class="pod-field">
            <span class="pod-field-label">&#x8BE6;&#x60C5;&#x63CF;&#x8FF0;</span>
            <a-textarea v-model="globalForm.description" :auto-size="{ minRows: 2, maxRows: 4 }" @change="syncGlobalToProducts" />
          </label>
        </div>
      </section>

      <section class="pod-panel pod-sku-panel pod-universal-sku-panel">
        <div class="pod-panel-head">
          <div>
            <p class="pod-panel-tag">SKU</p>
            <h2 class="pod-panel-title">SKU&#x89C4;&#x683C;&#x4E0E;&#x57FA;&#x7840;&#x6570;&#x636E;</h2>
          </div>
          <a-tag class="pod-miaoshou-theme-tag" bordered>{{ skuRows.length }} SKU</a-tag>
        </div>
        <div class="pod-sku-layout">
          <label class="pod-field">
            <span class="pod-field-label">SKU&#x89C4;&#x683C;1</span>
            <a-textarea v-model="globalForm.specValueOne" :auto-size="{ minRows: 2, maxRows: 3 }" @change="handleSkuSpecChange" />
          </label>
          <label class="pod-field">
            <span class="pod-field-label">SKU&#x89C4;&#x683C;2</span>
            <a-textarea v-model="globalForm.specValueTwo" :auto-size="{ minRows: 2, maxRows: 3 }" @change="handleSkuSpecChange" />
          </label>
        </div>
        <a-table class="pod-sku-table" row-key="key" :data="skuRows" :pagination="false" :scroll="{ x: 980, y: 220 }">
          <template #columns>
            <a-table-column title="&#x89C4;&#x683C;&#x503C;1" data-index="specValueOne" :width="130" />
            <a-table-column title="&#x89C4;&#x683C;&#x503C;2" data-index="specValueTwo" :width="130" />
            <a-table-column title="SKU&#x552E;&#x4EF7;" :width="130">
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].declaredPrice" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column title="SKU&#x56FE;&#x7247;" :width="150">
              <template #cell="{ record }"><a-select v-model="skuConfigMap[record.key].skuImage" allow-clear :options="skuImageOptions" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column title="&#x5E73;&#x53F0;SKU" :width="150">
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].platformSku" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column title="SKU&#x5E93;&#x5B58;" :width="120">
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].stock" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column title="SKU&#x91CD;&#x91CF;(KG)" :width="140">
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuWeightKg" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column title="SKU&#x5C3A;&#x5BF8;(CM)" :width="150">
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuSize" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
          </template>
        </a-table>
      </section>

      <section class="pod-panel pod-list-panel">
        <div class="pod-list-head">
          <div>
            <p class="pod-panel-tag">&#x672C;&#x5730;&#x5546;&#x54C1;</p>
            <h2 class="pod-panel-title">&#x901A;&#x7528;&#x7248;&#x5546;&#x54C1;&#x5217;&#x8868;</h2>
          </div>
          <div class="pod-actions">
            <a-button class="pod-blue-button" :loading="importingProducts" @click="importProducts">&#x5BFC;&#x5165;&#x672C;&#x5730;&#x5546;&#x54C1;</a-button>
            <a-button class="pod-blue-button" :disabled="!products.length" @click="openCarouselPreset">&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x4E3B;&#x56FE;</a-button>
            <a-button class="pod-blue-button" :disabled="products.length < 1" @click="randomizeCarousel">&#x6279;&#x91CF;&#x968F;&#x673A;&#x4E3B;&#x56FE;</a-button>
            <a-button class="pod-blue-button" :disabled="!products.length" @click="openDescriptionPreset">&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x8BE6;&#x60C5;&#x56FE;</a-button>
            <a-select v-model="imageUploadMode" class="pod-upload-mode" :options="imageUploadOptions" @change="scheduleStateSave" />
            <a-button class="pod-red-button" :loading="uploadingImages" :disabled="!products.length" @click="uploadImages">
              {{ uploadingImages ? '\u4e0a\u4f20\u4e2d' : '\u6279\u91cf\u4e0a\u4f20\u56fe\u7247' }}
            </a-button>
            <a-button class="pod-red-button" :loading="generatingAiTitles" :disabled="!aiTitleEligibleCount" @click="openBatchAiTitleDialog">
              {{ generatingAiTitles ? '\u751f\u6210\u4e2d' : '\u6279\u91cfAI\u751f\u6210\u6807\u9898' }}
            </a-button>
            <a-button class="pod-theme-button" :loading="exportingTable" :disabled="!products.length" @click="exportTable">&#x5BFC;&#x51FA;&#x8868;&#x683C;</a-button>
            <a-button class="pod-danger-button" :disabled="!products.length" @click="clearProducts">&#x6E05;&#x7A7A;&#x5217;&#x8868;</a-button>
          </div>
        </div>
        <div v-if="uploadProgressText || aiTitleProgressText" class="pod-progress-line">
          <span v-if="uploadProgressText">{{ uploadProgressText }}</span>
          <span v-if="aiTitleProgressText">{{ aiTitleProgressText }}</span>
        </div>
        <a-table
          class="pod-product-table"
          row-key="id"
          :data="products"
          :pagination="false"
          :scroll="productTableScroll"
          :row-class="getProductRowClass"
          @row-click="selectProduct"
        >
          <template #columns>
            <a-table-column title="&#x672C;&#x5730;&#x5546;&#x54C1;" data-index="localName" :width="220">
              <template #cell="{ record }">
                <div class="pod-product-name">
                  <strong>{{ record.localName || '\u672a\u547d\u540d\u5546\u54c1' }}</strong>
                  <span>{{ record.sourceFolder || '\u6839\u76ee\u5f55' }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="&#x4EA7;&#x54C1;&#x540D;&#x79F0;" :width="300">
              <template #cell="{ record }">
                <a-textarea v-model="record.title" :auto-size="{ minRows: 2, maxRows: 4 }" @change="scheduleStateSave" />
              </template>
            </a-table-column>
            <a-table-column title="&#x4E3B;&#x56FE;" :width="230">
              <template #cell="{ record }">
                <div class="pod-chip-list" :title="getMaterialTitle(record, 'carousel')">
                  <a-tag v-for="item in getPreviewItems(record.materials.carousel)" :key="item" bordered>{{ item }}</a-tag>
                  <span v-if="!record.materials.carousel.length" class="pod-muted">&#x6682;&#x65E0;</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="&#x8BE6;&#x60C5;&#x56FE;" :width="210">
              <template #cell="{ record }">
                <a-input v-model="record.descriptionImageOrders" placeholder="1,2,3" @change="scheduleStateSave" />
              </template>
            </a-table-column>
            <a-table-column title="AI" :width="130">
              <template #cell="{ record }">
                <a-tag :color="getAiStatusColor(record.aiTitleStatus)" bordered>{{ getAiStatusText(record.aiTitleStatus) }}</a-tag>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </section>
    </main>

    <a-modal v-model:visible="carouselPresetVisible" :mask-closable="false" modal-class="pod-miaoshou-operation-modal" @ok="applyCarouselPreset">
      <template #title>&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x4E3B;&#x56FE;</template>
      <a-textarea v-model="carouselPresetText" :auto-size="{ minRows: 8, maxRows: 12 }" placeholder="&#x4E00;&#x884C;&#x4E00;&#x4E2A;&#x56FE;&#x7247;&#x540D;&#xFF0C;&#x4FDD;&#x5B58;&#x540E;&#x6279;&#x91CF;&#x653E;&#x5230;&#x4E3B;&#x56FE;&#x524D;&#x9762;" />
    </a-modal>

    <a-modal v-model:visible="descriptionPresetVisible" :mask-closable="false" modal-class="pod-miaoshou-operation-modal" @ok="applyDescriptionPreset">
      <template #title>&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x8BE6;&#x60C5;&#x56FE;</template>
      <a-textarea v-model="descriptionPresetText" :auto-size="{ minRows: 8, maxRows: 12 }" placeholder="&#x586B;&#x5199;&#x4E3B;&#x56FE;&#x5E8F;&#x53F7;&#xFF0C;&#x5982; 1,2,3" />
    </a-modal>

    <a-modal
      :visible="batchAiTitleVisible"
      :mask-closable="false"
      :esc-to-close="!batchAiTitleStarting"
      :closable="!batchAiTitleStarting"
      :footer="false"
      modal-class="pod-miaoshou-batch-ai-title-modal"
      unmount-on-close
      @cancel="closeBatchAiTitleDialog"
    >
      <template #title>
        <div class="pod-modal-title">
          <span>AI TITLE</span>
          <strong>&#x6279;&#x91CF;AI&#x751F;&#x6210;&#x6807;&#x9898;</strong>
        </div>
      </template>
      <div class="pod-modal-body">
        <div class="pod-summary-pills">
          <span>{{ batchAiTitleSummary.aiName || '\u706b\u5c71\u5f15\u64ce' }}</span>
          <span>{{ batchAiTitleSummary.storageName || '\u817e\u8baf COS' }}</span>
          <span>{{ batchAiTitleSummary.totalCount }} &#x4E2A;&#x5546;&#x54C1;</span>
        </div>
        <div class="pod-modal-grid">
          <label class="pod-field"><span class="pod-field-label">AI &#x5E73;&#x53F0;</span><a-select v-model="batchAiTitleForm.aiProvider" :disabled="batchAiTitleBusy" :options="batchAiTitleAiPlatformOptions" /></label>
          <label class="pod-field"><span class="pod-field-label">&#x5B58;&#x50A8;&#x7D20;&#x6750;</span><a-select v-model="batchAiTitleForm.storageProvider" :disabled="batchAiTitleBusy" :options="batchAiTitleStorageProviderOptions" /></label>
          <label class="pod-field"><span class="pod-field-label">&#x56FE;&#x7247;&#x538B;&#x7F29;</span><a-select v-model="batchAiTitleForm.imageCompression" :disabled="batchAiTitleBusy" :options="batchAiTitleImageCompressionOptions" /></label>
          <label class="pod-field"><span class="pod-field-label">&#x7EBF;&#x7A0B;&#x5E76;&#x53D1;</span><a-input-number v-model="batchAiTitleForm.concurrency" :disabled="batchAiTitleBusy" :min="batchAiTitleMinConcurrency" :max="batchAiTitleMaxConcurrency" mode="button" /></label>
          <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x957F;&#x5EA6;</span><a-input-number v-model="batchAiTitleForm.targetLength" :disabled="batchAiTitleBusy" :min="batchAiTitleMinTargetLength" :max="batchAiTitleMaxTargetLength" mode="button" /></label>
          <label class="pod-field"><span class="pod-field-label">&#x8F93;&#x51FA;&#x8BED;&#x8A00;</span><a-select v-model="batchAiTitleForm.outputLanguage" :disabled="batchAiTitleBusy" :options="batchAiTitleOutputLanguageOptions" /></label>
        </div>
        <div class="pod-quality-row">
          <span>&#x56FE;&#x7247;&#x8D28;&#x91CF;</span>
          <a-slider v-model="batchAiTitleForm.imageQuality" :disabled="batchAiTitleBusy" :min="batchAiTitleMinImageQuality" :max="batchAiTitleMaxImageQuality" />
          <strong>{{ batchAiTitleForm.imageQuality }}</strong>
        </div>
        <div class="pod-modal-grid">
          <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x524D;&#x7F00;</span><a-input v-model="batchAiTitleForm.prefixText" allow-clear /></label>
          <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x540E;&#x7F00;</span><a-input v-model="batchAiTitleForm.suffixText" allow-clear /></label>
        </div>
        <label class="pod-field"><span class="pod-field-label">&#x9644;&#x52A0;&#x63D0;&#x793A;&#x8BCD;</span><a-textarea v-model="batchAiTitleForm.extraPrompt" :auto-size="{ minRows: 4, maxRows: 7 }" /></label>
        <a-checkbox v-model="batchAiTitleForm.useCache">&#x4F7F;&#x7528;&#x7F13;&#x5B58;</a-checkbox>
        <a-alert v-if="batchAiTitleStatus.message || batchAiTitleSummary.warning" :type="resolveAiStatusType(batchAiTitleStatus.tone || (batchAiTitleSummary.warning ? 'warning' : ''))" show-icon>{{ batchAiTitleStatus.message || batchAiTitleSummary.warning }}</a-alert>
      </div>
      <div class="pod-modal-footer">
        <a-button :disabled="batchAiTitleStarting" @click="closeBatchAiTitleDialog">&#x53D6;&#x6D88;</a-button>
        <a-button class="pod-danger-button" :disabled="batchAiTitleBusy || !batchAiTitleSummary.retryCount" @click="startBatchAiTitleDialogGeneration(true)">&#x91CD;&#x8BD5;&#x5931;&#x8D25;</a-button>
        <a-button class="pod-theme-button" type="primary" :loading="batchAiTitleStarting" @click="startBatchAiTitleDialogGeneration(false)">&#x6279;&#x91CF;&#x5F00;&#x59CB;&#x6807;&#x9898;&#x751F;&#x6210;</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { useBatchAiTitleDialog } from './useBatchAiTitleDialog.js';

const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
const UNIVERSAL_TEMPLATE_ID = 'universal';
const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';
const MATERIAL_SECTIONS = Object.freeze(['carousel', 'assets', 'preview']);
const IMAGE_UPLOAD_OPTIONS = Object.freeze([
  { value: 'original', label: '\u539f\u6587\u4ef6' },
  { value: 'jpg', label: '\u8f6c JPG' },
  { value: 'webp', label: '\u8f6c WebP' }
]);

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
const carouselPresetVisible = ref(false);
const carouselPresetText = ref('');
const descriptionPresetVisible = ref(false);
const descriptionPresetText = ref('');
const uploadProgress = reactive({ total: 0, success: 0, uploaded: 0, cached: 0, failed: 0, canceled: 0 });
const aiProgress = reactive({ total: 0, completed: 0, success: 0, failed: 0, canceled: 0 });
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
let removeAiTitleProgressListener = null;

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
const startBatchAiTitleDialogGeneration = batchAiTitleDialog.startGeneration;

const featureBridge = computed(() => window.temuApp && window.temuApp.featureCenter ? window.temuApp.featureCenter : null);
const imageUploadOptions = computed(() => IMAGE_UPLOAD_OPTIONS);
const formTemplateOptions = computed(() => formTemplates.value.map((item) => ({ value: item.id, label: item.name })));
const activeProduct = computed(() => products.value.find((item) => item.id === activeProductId.value) || products.value[0] || null);
const skuRows = computed(() => buildSkuRows());
const skuImageOptions = computed(() => {
  const product = activeProduct.value;
  const items = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
  return items.map((item, index) => ({ value: String(index + 1), label: `\u7b2c${index + 1}\u5f20 ${normalizeText(item)}` }));
});
const aiTitleEligibleCount = computed(() => products.value.filter((item) => getPrimaryProductImage(item)).length);
const aiTitleRetryCount = computed(() => products.value.filter((item) => item.aiTitleStatus === 'failed' && getPrimaryProductImage(item)).length);
const productTableScroll = computed(() => ({ x: 1280, y: Math.max(300, viewportHeight.value - 360) }));
const uploadProgressText = computed(() => {
  if (!uploadProgress.total) return '';
  return `\u56fe\u7247\u4e0a\u4f20\uff1a${uploadProgress.success}/${uploadProgress.total}\uff0c\u65b0\u4f20 ${uploadProgress.uploaded}\uff0c\u7f13\u5b58 ${uploadProgress.cached}\uff0c\u5931\u8d25 ${uploadProgress.failed}`;
});
const aiTitleProgressText = computed(() => {
  if (!generatingAiTitles.value || !aiProgress.total) return '';
  return `AI\u6807\u9898\uff1a${aiProgress.completed}/${aiProgress.total}\uff0c\u6210\u529f ${aiProgress.success}\uff0c\u5931\u8d25 ${aiProgress.failed}`;
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
      scheduleStateSave();
    }
  });
}

function openCarouselPreset() {
  carouselPresetText.value = activeProduct.value && activeProduct.value.materials ? activeProduct.value.materials.carousel.join('\n') : '';
  carouselPresetVisible.value = true;
}

function applyCarouselPreset() {
  const values = splitLines(carouselPresetText.value);
  if (!values.length) return;
  products.value = products.value.map((product) => ({
    ...product,
    materials: {
      ...product.materials,
      carousel: Array.from(new Set([...values, ...product.materials.carousel]))
    }
  }));
  scheduleStateSave();
}

function randomizeCarousel() {
  products.value = products.value.map((product) => {
    const next = product.materials.carousel.slice();
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return { ...product, materials: { ...product.materials, carousel: next } };
  });
  scheduleStateSave();
  Message.success('\u5df2\u6279\u91cf\u968f\u673a\u8c03\u6574\u4e3b\u56fe');
}

function openDescriptionPreset() {
  descriptionPresetText.value = activeProduct.value ? activeProduct.value.descriptionImageOrders : '';
  descriptionPresetVisible.value = true;
}

function applyDescriptionPreset() {
  const value = splitLines(descriptionPresetText.value).join(',');
  products.value = products.value.map((product) => ({ ...product, descriptionImageOrders: value }));
  scheduleStateSave();
}

async function uploadImages() {
  if (!featureBridge.value || uploadingImages.value) return;
  uploadingImages.value = true;
  Object.assign(uploadProgress, { total: 0, success: 0, uploaded: 0, cached: 0, failed: 0, canceled: 0 });
  try {
    const result = await featureBridge.value.uploadPodUploadSheetMiaoshouUniversalCosImages({
      runId: createId('pod-universal-cos'),
      products: products.value,
      imageUploadMode: imageUploadMode.value
    });
    const items = Array.isArray(result && result.items) ? result.items : [];
    const urlByPath = new Map(items.filter((item) => item && item.status === 'success' && item.url).map((item) => [normalizeText(item.filePath), normalizeText(item.url)]));
    products.value = products.value.map((product) => {
      const nextProduct = createProduct(product);
      MATERIAL_SECTIONS.forEach((sectionId) => {
        nextProduct.materials[sectionId] = nextProduct.materials[sectionId].map((name) => {
          const path = getMaterialPathByName(nextProduct, sectionId, name);
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
    Message.success('\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210');
    scheduleStateSave();
  } catch (error) {
    Message.error('\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
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
  try {
    const result = await featureBridge.value.generatePodUploadSheetMiaoshouAiTitles({
      ...options,
      runId: createId('pod-universal-ai-title'),
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
    Message.success('\u6279\u91cf AI \u6807\u9898\u751f\u6210\u5b8c\u6210');
    scheduleStateSave();
  } catch (error) {
    products.value = products.value.map((product) => product.aiTitleStatus === 'processing' ? { ...product, aiTitleStatus: 'failed', aiTitleError: normalizeText(error && error.message) } : product);
    Message.error('AI \u6807\u9898\u751f\u6210\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    generatingAiTitles.value = false;
  }
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
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadWorkspaceState() {
  if (!featureBridge.value) return;
  const result = await featureBridge.value.getPodUploadSheetMiaoshouUniversalWorkspaceState().catch(() => null);
  const workspace = result && result.workspace ? result.workspace : {};
  imageUploadMode.value = normalizeText(workspace.imageUploadMode) || 'original';
  lastImportDirectoryPath.value = normalizeText(workspace.lastImportDirectoryPath);
  carouselPresetText.value = Array.isArray(workspace.carouselPresetSelection) ? workspace.carouselPresetSelection.join('\n') : '';
  descriptionPresetText.value = Array.isArray(workspace.descriptionPresetSelection) ? workspace.descriptionPresetSelection.join(',') : '';
}

async function loadInitialData() {
  await Promise.allSettled([loadFormTemplates(), loadWorkspaceState()]);
}

function buildTemplatePayload() {
  return {
    templateId: selectedTemplateId.value,
    templateName: templateName.value,
    fields: {
      ...globalForm,
      aiTitleExtraPrompt: '',
      aiTitleMaxLength: '250'
    },
    skuConfigMap: cloneSkuMap(skuConfigMap),
    batchPreset: {
      carouselPresetMode: 'selected',
      carouselPresetSelection: splitLines(carouselPresetText.value),
      descriptionPresetSelection: splitLines(descriptionPresetText.value)
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
  syncGlobalToProducts();
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
    void featureBridge.value.savePodUploadSheetMiaoshouUniversalWorkspaceState({
      workspace: {
        lastImportDirectoryPath: lastImportDirectoryPath.value,
        imageUploadMode: imageUploadMode.value,
        carouselPresetSelection: splitLines(carouselPresetText.value),
        descriptionPresetSelection: splitLines(descriptionPresetText.value)
      }
    }).catch(() => undefined);
  }, 400);
}

function installVueBridge() {
  const existingBridge = window[VIEW_BRIDGE_KEY] && typeof window[VIEW_BRIDGE_KEY] === 'object' ? window[VIEW_BRIDGE_KEY] : {};
  const bridge = {
    ...existingBridge,
    getBatchAiTitleSnapshot,
    startBatchAiTitleGeneration: executeBatchAiTitleGeneration
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
  document.body.classList.add('pod-miaoshou-vue-mounted');
  updateViewportHeight();
  window.addEventListener('resize', updateViewportHeight);
  cleanupBatchAiTitleBridge = batchAiTitleDialog.installGlobalBridge();
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
  window.removeEventListener('resize', updateViewportHeight);
  if (typeof cleanupBatchAiTitleBridge === 'function') cleanupBatchAiTitleBridge();
  if (typeof removeAiTitleProgressListener === 'function') removeAiTitleProgressListener();
});

defineExpose({
  refresh() {
    return loadInitialData();
  }
});
</script>

<style>
.pod-miaoshou-app-shell {
  height: 100vh;
  overflow: hidden;
  padding: 12px;
  background: #f6f8fb;
  color: #172033;
}

body.dark-theme .pod-miaoshou-app-shell {
  background: #0f172a;
  color: #e5eefc;
}

.pod-miaoshou-app-header,
.pod-panel {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
}

body.dark-theme .pod-miaoshou-app-header,
body.dark-theme .pod-panel {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(15, 23, 42, 0.88);
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.28);
}

.pod-miaoshou-app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  padding: 8px 14px;
  margin-bottom: 10px;
}

.pod-miaoshou-app-header__copy,
.pod-modal-title {
  display: grid;
  gap: 4px;
}

.pod-miaoshou-app-header__eyebrow,
.pod-panel-tag,
.pod-modal-title span {
  margin: 0;
  color: var(--theme-primary-ink, #8f5a0e);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.pod-miaoshou-app-header__title-row,
.pod-miaoshou-app-header__meta,
.pod-panel-head,
.pod-list-head,
.pod-actions,
.pod-modal-footer,
.pod-summary-pills,
.pod-progress-line {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}

.pod-list-head,
.pod-panel-head {
  justify-content: space-between;
}

.pod-list-head {
  display: grid;
  grid-template-columns: minmax(180px, auto) minmax(0, 1fr);
  align-items: start;
}

.pod-miaoshou-app-header h1,
.pod-panel-title,
.pod-modal-title strong {
  margin: 0;
  color: #172033;
  font-size: 16px;
  line-height: 1.2;
}

body.dark-theme .pod-miaoshou-app-header h1,
body.dark-theme .pod-panel-title,
body.dark-theme .pod-modal-title strong {
  color: #f8fafc;
}

.pod-workbench,
.pod-panel,
.pod-modal-body {
  display: grid;
  gap: 10px;
}

.pod-workbench {
  grid-template-columns: minmax(520px, 1.02fr) minmax(500px, 0.98fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    "template sku"
    "list list";
  height: calc(100vh - 80px);
  min-height: 0;
}

.pod-panel {
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}

.pod-template-panel {
  grid-area: template;
  max-height: 248px;
  align-content: start;
  overflow: auto;
}

.pod-sku-panel {
  grid-area: sku;
  max-height: 248px;
  align-content: start;
  overflow: auto;
}

.pod-list-panel {
  grid-area: list;
  grid-template-rows: auto auto minmax(0, 1fr);
}

.pod-template-grid,
.pod-template-save-row,
.pod-universal-main-row,
.pod-universal-media-row,
.pod-universal-description-row,
.pod-sku-layout,
.pod-modal-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.pod-universal-template-panel .pod-template-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pod-template-save-row {
  grid-template-columns: minmax(180px, 0.9fr) minmax(180px, 1fr);
}

.pod-universal-main-row {
  grid-template-columns: minmax(220px, 0.8fr) minmax(360px, 1fr);
}

.pod-universal-media-row {
  grid-template-columns: repeat(3, minmax(180px, 1fr));
}

.pod-universal-description-row {
  grid-template-columns: minmax(0, 1fr);
}

.pod-sku-layout {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pod-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.pod-field-wide {
  grid-column: span 2;
}

.pod-field-label {
  color: #5f6f83;
  font-size: 11px;
  font-weight: 700;
}

body.dark-theme .pod-field-label {
  color: #a8b6ca;
}

.pod-list-head {
  align-items: flex-start;
}

.pod-actions {
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

.pod-upload-mode {
  width: 106px;
}

.pod-actions .arco-btn,
.pod-miaoshou-app-header__meta .arco-btn {
  height: 32px;
  padding: 0 11px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}

.pod-actions .arco-btn {
  min-width: 92px;
}

.pod-miaoshou-app-header__meta .arco-btn {
  height: 34px;
}

.pod-actions .arco-btn:hover,
.pod-miaoshou-app-header__meta .arco-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
}

.pod-field :deep(.arco-input-wrapper),
.pod-field :deep(.arco-select-view-single),
.pod-field :deep(.arco-textarea-wrapper),
.pod-upload-mode :deep(.arco-select-view-single) {
  min-height: 32px;
  border-color: #dbe3ee;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: none;
}

.pod-field :deep(.arco-textarea-wrapper) {
  min-height: 54px;
}

.pod-field :deep(.arco-input-wrapper:hover),
.pod-field :deep(.arco-select-view-single:hover),
.pod-field :deep(.arco-textarea-wrapper:hover) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.5);
}

.pod-theme-button.arco-btn-primary,
.pod-theme-button.arco-btn {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.45);
  background: var(--theme-primary-color, #f4bf22);
  color: var(--theme-primary-contrast, #2f2400);
}

.pod-blue-button.arco-btn {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #ffffff;
}

.pod-red-button.arco-btn,
.pod-danger-button.arco-btn {
  border-color: #dc2626;
  background: #dc2626;
  color: #ffffff;
}

.pod-miaoshou-theme-tag.arco-tag,
.pod-summary-pills span,
.pod-progress-line span {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.24);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
  color: var(--theme-primary-ink, #7a4a00);
}

.pod-product-table,
.pod-sku-table {
  min-height: 0;
  border: 1px solid #e5ebf3;
  border-radius: 8px;
  overflow: hidden;
}

.pod-product-table :deep(.arco-table-th),
.pod-sku-table :deep(.arco-table-th) {
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.pod-product-table :deep(.arco-table-td),
.pod-sku-table :deep(.arco-table-td) {
  padding: 7px 10px;
  color: #243247;
}

.pod-product-table :deep(.arco-table-tr:hover .arco-table-td),
.pod-sku-table :deep(.arco-table-tr:hover .arco-table-td) {
  background: #fffaf0;
}

.pod-product-name {
  display: grid;
  gap: 3px;
}

.pod-product-name span,
.pod-muted {
  color: #7a8899;
  font-size: 11px;
}

.pod-chip-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  max-height: 52px;
  overflow: hidden;
}

.pod-chip-list .arco-tag {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pod-product-table :deep(.arco-table-tr.is-active) .arco-table-td {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
}

.pod-modal-footer {
  justify-content: flex-end;
  margin-top: 18px;
}

.pod-quality-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 42px;
  align-items: center;
  gap: 12px;
}

.pod-miaoshou-batch-ai-title-modal .arco-modal,
.pod-miaoshou-operation-modal .arco-modal {
  width: min(760px, calc(100vw - 32px));
  border-radius: 8px;
}

@media (max-width: 1100px) {
  .pod-template-grid,
  .pod-template-save-row,
  .pod-universal-main-row,
  .pod-universal-media-row,
  .pod-universal-description-row,
  .pod-modal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pod-workbench {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      "template"
      "sku"
      "list";
    overflow: auto;
  }
}

@media (max-width: 720px) {
  .pod-miaoshou-app-header,
  .pod-list-head {
    align-items: stretch;
    flex-direction: column;
  }

  .pod-template-grid,
  .pod-template-save-row,
  .pod-universal-main-row,
  .pod-universal-media-row,
  .pod-universal-description-row,
  .pod-sku-layout,
  .pod-modal-grid {
    grid-template-columns: 1fr;
  }

  .pod-field-wide {
    grid-column: auto;
  }
}
</style>
