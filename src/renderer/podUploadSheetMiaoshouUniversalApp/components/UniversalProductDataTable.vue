<template>
  <section class="pod-panel pod-list-panel" :style="tableStyle">
    <div class="pod-list-head">
      <div class="pod-list-title-inline">
        <h2 class="pod-panel-title">&#x5546;&#x54C1;&#x6570;&#x636E;&#x5217;&#x8868;</h2>
        <span class="pod-panel-tag">&#x672C;&#x5730;&#x5546;&#x54C1;</span>
      </div>
      <div class="pod-actions">
        <a-button class="pod-red-button" :loading="importingProducts" @click="importProducts">
          <icon-upload class="pod-action-icon" />
          &#x5BFC;&#x5165;&#x672C;&#x5730;&#x5546;&#x54C1;
        </a-button>
        <a-button class="pod-blue-button" :disabled="!products.length" @click="openCarouselPreset">
          <icon-image class="pod-action-icon" />
          &#x6279;&#x91CF;&#x9884;&#x8BBE;&#x4E3B;&#x56FE;
        </a-button>
        <a-button class="pod-blue-button" :disabled="products.length < 1" @click="openRandomCarouselPreset">
          <icon-loop class="pod-action-icon" />
          &#x6279;&#x91CF;&#x968F;&#x673A;&#x4E3B;&#x56FE;
        </a-button>
        <a-button class="pod-blue-button" :disabled="!products.length" @click="openDescriptionPreset">
          <icon-image class="pod-action-icon" />
          &#x6279;&#x91CF;&#x9884;&#x8BBE;&#x8BE6;&#x60C5;&#x56FE;
        </a-button>
        <a-button
          :class="uploadingImages ? 'pod-stop-button' : 'pod-theme-button'"
          :disabled="!products.length && !uploadingImages"
          @click="handleImageUploadAction"
        >
          <icon-stop v-if="uploadingImages" class="pod-action-icon" />
          <icon-upload v-else class="pod-action-icon" />
          {{ uploadingImages ? '\u505c\u6b62\u4e0a\u4f20\u56fe\u7247' : '\u6279\u91cf\u4e0a\u4f20\u56fe\u7247' }}
        </a-button>
        <a-button
          :class="generatingAiTitles ? 'pod-stop-button' : 'pod-theme-button'"
          :disabled="!aiTitleEligibleCount && !generatingAiTitles"
          @click="handleAiTitleAction"
        >
          <icon-stop v-if="generatingAiTitles" class="pod-action-icon" />
          <icon-play-circle v-else class="pod-action-icon" />
          {{ generatingAiTitles ? '\u505c\u6b62AI\u751f\u6210\u6807\u9898' : '\u6279\u91cfAI\u751f\u6210\u6807\u9898' }}
        </a-button>
        <a-button class="pod-theme-button" :loading="exportingTable" :disabled="!products.length" @click="exportTable">
          <icon-download class="pod-action-icon" />
          &#x5BFC;&#x51FA;&#x8868;&#x683C;
        </a-button>
        <a-button class="pod-theme-button" type="primary" :loading="savingTemplate" @click="saveCurrentTemplate">
          <icon-save class="pod-action-icon" />
          &#x4FDD;&#x5B58;&#x6A21;&#x677F;
        </a-button>
        <a-button class="pod-danger-button" :disabled="!products.length" @click="clearProducts">
          <icon-delete class="pod-action-icon" />
          &#x6E05;&#x7A7A;&#x5217;&#x8868;
        </a-button>
      </div>
    </div>
    <div v-if="hasUploadProgress || hasAiTitleProgress || uploadProgressText || aiTitleProgressText" class="pod-progress-stack">
      <div v-if="hasUploadProgress" class="pod-progress-card pod-upload-progress-card">
        <div class="pod-progress-card-head">
          <div class="pod-progress-card-title">
            <strong>&#x56FE;&#x7247;&#x4E0A;&#x4F20;</strong>
            <span>{{ uploadProgressStateText }} {{ uploadProgress.completed }} / {{ uploadProgress.total }}</span>
          </div>
          <a-button
            v-if="uploadFailedCount"
            class="pod-progress-retry-button"
            :disabled="uploadingImages"
            @click.stop="retryFailedImageUpload"
          >
            <icon-refresh class="pod-action-icon" />
            &#x91CD;&#x8BD5;&#x5931;&#x8D25;
          </a-button>
        </div>
        <a-progress class="pod-progress-bar" size="small" :percent="uploadProgressPercent" :color="progressBarColor" :track-color="progressTrackColor" :show-text="false" />
        <div class="pod-progress-card-meta">
          <span>{{ uploadProgressText }}</span>
        </div>
      </div>
      <div v-if="hasAiTitleProgress" class="pod-progress-card pod-ai-progress-card">
        <div class="pod-progress-card-head">
          <div class="pod-progress-card-title">
            <strong>AI&#x6807;&#x9898;</strong>
            <span>{{ aiTitleProgressStateText }} {{ aiProgress.completed }} / {{ aiProgress.total }}</span>
          </div>
          <a-button
            v-if="aiTitleFailedCount"
            class="pod-progress-retry-button"
            :disabled="generatingAiTitles"
            @click.stop="retryFailedAiTitleGeneration"
          >
            <icon-refresh class="pod-action-icon" />
            &#x91CD;&#x8BD5;&#x5931;&#x8D25;
          </a-button>
        </div>
        <a-progress class="pod-progress-bar" size="small" :percent="aiTitleProgressPercent" :color="progressBarColor" :track-color="progressTrackColor" :show-text="false" />
        <div class="pod-progress-card-meta">
          <span>{{ aiTitleProgressText }}</span>
        </div>
      </div>
      <div v-if="aiTitleProgressText && !hasAiTitleProgress" class="pod-progress-line">
        <span>{{ aiTitleProgressText }}</span>
      </div>
      <div v-else-if="uploadProgressText && !hasUploadProgress" class="pod-progress-line">
        <span>{{ uploadProgressText }}</span>
      </div>
    </div>
    <a-table
      class="pod-product-table"
      row-key="id"
      :data="products"
      :pagination="false"
      :scroll="tableScroll"
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
        <a-table-column title="&#x4EA7;&#x54C1;&#x540D;&#x79F0;" :width="320">
          <template #cell="{ record }">
            <div class="pod-title-cell">
              <a-textarea v-model="record.title" :max-length="TITLE_MAX_LENGTH" :auto-size="{ minRows: 2, maxRows: 4 }" @change="handleProductTitleChange(record, 'title')" />
              <span class="pod-title-length" :class="{ 'is-over': getTextLength(record.title) > TITLE_MAX_LENGTH }">{{ getTextLength(record.title) }} / {{ TITLE_MAX_LENGTH }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="&#x4E3B;&#x56FE;" :width="230">
          <template #cell="{ record }">
            <div class="pod-chip-list" :title="getMaterialTitle(record, 'carousel')">
              <a-tag v-for="item in getPreviewItems(record.materials.carousel)" :key="item" class="pod-material-chip" bordered>{{ getMaterialDisplayName(record, 'carousel', item) }}</a-tag>
              <a-tag v-if="getExtraItemCount(record.materials.carousel)" class="pod-material-chip pod-material-chip-more" bordered>+{{ getExtraItemCount(record.materials.carousel) }}</a-tag>
              <span v-if="!record.materials.carousel.length" class="pod-muted">&#x6682;&#x65E0;</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="&#x8BE6;&#x60C5;&#x56FE;" :width="230">
          <template #cell="{ record }">
            <div class="pod-chip-list" :title="getDescriptionImageTitle(record)">
              <a-tag v-for="item in getPreviewItems(getDescriptionImageItems(record))" :key="item" class="pod-material-chip" bordered>{{ getMaterialDisplayName(record, 'carousel', item) }}</a-tag>
              <a-tag v-if="getExtraItemCount(getDescriptionImageItems(record))" class="pod-material-chip pod-material-chip-more" bordered>+{{ getExtraItemCount(getDescriptionImageItems(record)) }}</a-tag>
              <span v-if="!getDescriptionImageItems(record).length" class="pod-muted">&#x6682;&#x65E0;</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column :width="130">
          <template #cell="{ record }">
            <a-tag :color="getAiStatusColor(record.aiTitleStatus)" bordered>{{ getAiStatusText(record.aiTitleStatus) }}</a-tag>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  IconDelete,
  IconDownload,
  IconImage,
  IconLoop,
  IconPlayCircle,
  IconRefresh,
  IconSave,
  IconStop,
  IconUpload
} from '@arco-design/web-vue/es/icon';
import {
  getAiStatusColor,
  getAiStatusText,
  getDescriptionImageItems,
  getDescriptionImageTitle,
  getExtraItemCount,
  getMaterialDisplayName,
  getPreviewItems,
  getTextLength
} from '../../shared/podUploadSheet/podUploadSheetDisplayData.js';

const TITLE_MAX_LENGTH = 255;

const props = defineProps({
  products: {
    type: Array,
    default: () => []
  },
  tableStyle: {
    type: Object,
    default: () => ({})
  },
  tableScroll: {
    type: Object,
    default: () => ({})
  },
  importingProducts: Boolean,
  uploadingImages: Boolean,
  exportingTable: Boolean,
  savingTemplate: Boolean,
  generatingAiTitles: Boolean,
  aiTitleEligibleCount: {
    type: Number,
    default: 0
  },
  uploadProgress: {
    type: Object,
    default: () => ({})
  },
  aiProgress: {
    type: Object,
    default: () => ({})
  },
  uploadProgressText: {
    type: String,
    default: ''
  },
  aiTitleProgressText: {
    type: String,
    default: ''
  },
  importProducts: {
    type: Function,
    required: true
  },
  openCarouselPreset: {
    type: Function,
    required: true
  },
  openRandomCarouselPreset: {
    type: Function,
    required: true
  },
  openDescriptionPreset: {
    type: Function,
    required: true
  },
  openImageUploadDialog: {
    type: Function,
    required: true
  },
  stopImageUploadTask: {
    type: Function,
    default: () => undefined
  },
  openBatchAiTitleDialog: {
    type: Function,
    required: true
  },
  stopBatchAiTitleGenerationTask: {
    type: Function,
    default: () => undefined
  },
  exportTable: {
    type: Function,
    required: true
  },
  saveCurrentTemplate: {
    type: Function,
    required: true
  },
  clearProducts: {
    type: Function,
    required: true
  },
  getProductRowClass: {
    type: Function,
    required: true
  },
  selectProduct: {
    type: Function,
    required: true
  },
  handleProductTitleChange: {
    type: Function,
    required: true
  },
  retryFailedImageUpload: {
    type: Function,
    default: () => undefined
  },
  retryFailedAiTitleGeneration: {
    type: Function,
    default: () => undefined
  }
});

const progressBarColor = {
  '0%': 'var(--theme-primary-color, #f4bf22)',
  '100%': 'var(--theme-primary-color-deep, var(--theme-primary-color, #f4bf22))'
};
const progressTrackColor = 'rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12)';

const hasUploadProgress = computed(() => {
  return Math.max(0, Number(props.uploadProgress && props.uploadProgress.total) || 0) > 0;
});

const hasAiTitleProgress = computed(() => {
  return Math.max(0, Number(props.aiProgress && props.aiProgress.total) || 0) > 0;
});

const uploadFailedCount = computed(() => {
  return Math.max(0, Number(props.uploadProgress && props.uploadProgress.failed) || 0);
});

const aiTitleFailedCount = computed(() => {
  return Math.max(0, Number(props.aiProgress && props.aiProgress.failed) || 0);
});

const uploadProgressPercent = computed(() => {
  const total = Math.max(0, Number(props.uploadProgress && props.uploadProgress.total) || 0);
  const completed = Math.max(0, Number(props.uploadProgress && props.uploadProgress.completed) || 0);

  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(1, completed / total));
});

const aiTitleProgressPercent = computed(() => {
  const total = Math.max(0, Number(props.aiProgress && props.aiProgress.total) || 0);
  const completed = Math.max(0, Number(props.aiProgress && props.aiProgress.completed) || 0);

  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(1, completed / total));
});

const uploadProgressStateText = computed(() => {
  const state = String(props.uploadProgress && props.uploadProgress.runState || '');

  if (state === 'completed') return '\u5df2\u5b8c\u6210';
  if (state === 'canceled') return '\u5df2\u53d6\u6d88';
  if (state === 'stopping') return '\u505c\u6b62\u4e2d';
  if (state === 'failed') return '\u5931\u8d25';
  if (state === 'starting' || state === 'pending') return '\u542f\u52a8\u4e2d';
  return '\u4e0a\u4f20\u4e2d';
});

const aiTitleProgressStateText = computed(() => {
  const total = Math.max(0, Number(props.aiProgress && props.aiProgress.total) || 0);
  const completed = Math.max(0, Number(props.aiProgress && props.aiProgress.completed) || 0);
  const canceled = Math.max(0, Number(props.aiProgress && props.aiProgress.canceled) || 0);

  if (props.generatingAiTitles) return '\u751f\u6210\u4e2d';
  if (canceled > 0 && completed >= total) return '\u5df2\u53d6\u6d88';
  if (total > 0 && completed >= total) return '\u5df2\u5b8c\u6210';
  return '\u5f85\u5904\u7406';
});

function getMaterialTitle(product, sectionId) {
  const items = product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
  return items.map((item) => getMaterialDisplayName(product, sectionId, item)).join('\n');
}

function handleImageUploadAction() {
  if (props.uploadingImages) {
    return props.stopImageUploadTask();
  }

  return props.openImageUploadDialog();
}

function handleAiTitleAction() {
  if (props.generatingAiTitles) {
    return props.stopBatchAiTitleGenerationTask();
  }

  return props.openBatchAiTitleDialog();
}
</script>
