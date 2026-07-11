<template>
  <section class="pod-panel pod-list-panel" :style="tableStyle">
    <div class="pod-list-head">
      <div class="pod-list-title-inline">
        <h2 class="pod-panel-title">&#x5546;&#x54C1;&#x6570;&#x636E;&#x5217;&#x8868;</h2>
        <span class="pod-panel-tag">&#x672C;&#x5730;&#x5546;&#x54C1;</span>
      </div>
      <div class="pod-actions">
        <a-button class="pod-red-button" :loading="importingProducts" @click="importProducts">&#x5BFC;&#x5165;&#x672C;&#x5730;&#x5546;&#x54C1;</a-button>
        <a-button class="pod-blue-button" :disabled="!products.length" @click="openCarouselPreset">&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x8F6E;&#x64AD;&#x56FE;</a-button>
        <a-button class="pod-blue-button" :disabled="products.length < 1" @click="openRandomCarouselPreset">&#x6279;&#x91CF;&#x968F;&#x673A;&#x8F6E;&#x64AD;&#x56FE;</a-button>
        <a-button class="pod-blue-button" :disabled="!products.length" @click="openDescriptionPreset">&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x63CF;&#x8FF0;&#x56FE;</a-button>
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
      :scroll="tableScroll"
      :row-class="getProductRowClass"
      @row-click="selectProduct"
    >
      <template #columns>
        <a-table-column title="&#x672C;&#x5730;&#x5546;&#x54C1;" data-index="localName" :width="210">
          <template #cell="{ record }">
            <div class="pod-product-name">
              <strong>{{ record.localName || '\u672a\u547d\u540d\u5546\u54c1' }}</strong>
              <span>{{ record.sourceFolder || '\u6839\u76ee\u5f55' }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="&#x4EA7;&#x54C1;&#x6807;&#x9898;" :width="270">
          <template #cell="{ record }">
            <div class="pod-title-cell">
              <a-textarea v-model="record.title" :max-length="TITLE_MAX_LENGTH" :auto-size="{ minRows: 2, maxRows: 4 }" @change="handleProductTitleChange(record, 'title')" />
              <span class="pod-title-length" :class="{ 'is-over': getTextLength(record.title) > TITLE_MAX_LENGTH }">{{ getTextLength(record.title) }} / {{ TITLE_MAX_LENGTH }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="&#x82F1;&#x6587;&#x6807;&#x9898;" :width="270">
          <template #cell="{ record }">
            <div class="pod-title-cell">
              <a-textarea v-model="record.englishTitle" :max-length="TITLE_MAX_LENGTH" :auto-size="{ minRows: 2, maxRows: 4 }" @change="handleProductTitleChange(record, 'englishTitle')" />
              <span class="pod-title-length" :class="{ 'is-over': getTextLength(record.englishTitle) > TITLE_MAX_LENGTH }">{{ getTextLength(record.englishTitle) }} / {{ TITLE_MAX_LENGTH }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="&#x8F6E;&#x64AD;&#x56FE;" :width="220">
          <template #cell="{ record }">
            <div class="pod-chip-list" :title="getMaterialTitle(record, 'carousel')">
              <a-tag v-for="item in getPreviewItems(record.materials.carousel)" :key="item" class="pod-material-chip" bordered>{{ getMaterialDisplayName(record, 'carousel', item) }}</a-tag>
              <a-tag v-if="getExtraItemCount(record.materials.carousel)" class="pod-material-chip pod-material-chip-more" bordered>+{{ getExtraItemCount(record.materials.carousel) }}</a-tag>
              <span v-if="!record.materials.carousel.length" class="pod-muted">&#x6682;&#x65E0;</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="&#x63CF;&#x8FF0;&#x56FE;" :width="220">
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
import { TITLE_MAX_LENGTH } from '../constants/podUploadSheetMiaoshou.js';
import {
  getAiStatusColor,
  getAiStatusText,
  getDescriptionImageItems,
  getDescriptionImageTitle,
  getExtraItemCount,
  getMaterialDisplayName,
  getPreviewItems,
  getTextLength
} from '../utils/podUploadSheetMiaoshouData.js';

defineProps({
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
  generatingAiTitles: Boolean,
  aiTitleEligibleCount: {
    type: Number,
    default: 0
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
  uploadImages: {
    type: Function,
    required: true
  },
  openBatchAiTitleDialog: {
    type: Function,
    required: true
  },
  exportTable: {
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
  }
});

function getMaterialTitle(product, sectionId) {
  const items = product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
  return items.map((item) => getMaterialDisplayName(product, sectionId, item)).join('\n');
}
</script>
