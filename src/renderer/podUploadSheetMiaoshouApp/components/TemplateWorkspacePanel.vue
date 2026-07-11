<template>
  <section class="pod-panel pod-template-manage-panel">
    <div class="pod-panel-head">
      <div>
        <p class="pod-panel-tag">&#x6A21;&#x677F;</p>
        <h2 class="pod-panel-title">&#x6A21;&#x677F;&#x7BA1;&#x7406;</h2>
      </div>
    </div>
    <div class="pod-template-save-row">
      <div class="pod-field pod-inline-field">
        <span class="pod-field-label">
          &#x5DF2;&#x4FDD;&#x5B58;&#x6A21;&#x677F;
          <a-tooltip content="&#x9009;&#x62E9;&#x5DF2;&#x4FDD;&#x5B58;&#x7684;&#x6A21;&#x677F;&#xFF0C;&#x4F1A;&#x540C;&#x6B65;&#x5230;&#x5F53;&#x524D;&#x8868;&#x5355;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-select
          v-model="selectedTemplateIdProxy"
          allow-clear
          popup-container="body"
          :loading="loadingTemplates"
          :options="formTemplateOptions"
          @change="applySelectedTemplate"
        />
      </div>
      <div class="pod-field pod-inline-field">
        <span class="pod-field-label">
          &#x6A21;&#x677F;&#x540D;&#x79F0;
          <a-tooltip content="&#x4FDD;&#x5B58;&#x5F53;&#x524D;&#x8868;&#x5355;&#x914D;&#x7F6E;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x540D;&#x79F0;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="templateNameProxy" allow-clear />
      </div>
      <div class="pod-template-save-actions">
        <a-button class="pod-theme-button" type="primary" :loading="savingTemplate" @click="saveCurrentTemplate">
          &#x4FDD;&#x5B58;&#x6A21;&#x677F;
        </a-button>
        <a-button class="pod-danger-button" :disabled="!selectedTemplateId" :loading="deletingTemplate" @click="deleteSelectedTemplate">
          &#x5220;&#x9664;&#x6A21;&#x677F;
        </a-button>
      </div>
    </div>
  </section>

  <section class="pod-panel pod-template-panel">
    <div class="pod-panel-head">
      <div>
        <p class="pod-panel-tag">&#x57FA;&#x7840;</p>
        <h2 class="pod-panel-title">&#x57FA;&#x7840;&#x4FE1;&#x606F;&#x6A21;&#x677F;</h2>
      </div>
      <a-tag class="pod-miaoshou-theme-tag" bordered>{{ productsCount }} &#x4E2A;&#x5546;&#x54C1;</a-tag>
    </div>
    <div class="pod-template-main-row">
      <div class="pod-field pod-template-select-field">
          <span class="pod-field-label">
            &#x8868;&#x683C;&#x6A21;&#x677F;
            <a-tooltip content="&#x9009;&#x62E9;&#x5BFC;&#x51FA;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x8868;&#x683C;&#x7C7B;&#x578B;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="globalForm.templateId" popup-container="body" :options="templateTypeOptions" @change="syncGlobalToProducts" />
        </div>
        <div class="pod-field pod-category-field">
          <span class="pod-field-label">
            &#x56FA;&#x5B9A;&#x7C7B;&#x76EE;
            <a-tooltip content="&#x9009;&#x4E2D;&#x540E;&#x4F1A;&#x6279;&#x91CF;&#x540C;&#x6B65;&#x5230;&#x5F53;&#x524D;&#x5546;&#x54C1;&#x6570;&#x636E;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select
            v-model="globalForm.category"
            allow-clear
            allow-search
            popup-container="body"
            :loading="loadingCategories"
            :options="categorySelectOptions"
            @change="syncGlobalToProducts"
          />
        </div>
      </div>
      <div class="pod-template-meta-row">
        <div class="pod-field">
          <span class="pod-field-label">
            &#x627F;&#x8BFA;&#x53D1;&#x8D27;&#x65F6;&#x6548;
            <a-tooltip content="&#x586B;&#x8868;&#x5BFC;&#x51FA;&#x65F6;&#x5199;&#x5165;&#x7684;&#x53D1;&#x8D27;&#x65F6;&#x6548;&#x503C;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="globalForm.delivery" popup-container="body" :options="deliveryOptions" @change="syncGlobalToProducts" />
        </div>
        <label class="pod-field">
          <span class="pod-field-label">
            &#x4EA7;&#x5730;
            <a-tooltip content="&#x5BFC;&#x51FA;&#x8868;&#x683C;&#x65F6;&#x5199;&#x5165;&#x7684;&#x4EA7;&#x5730;&#x5185;&#x5BB9;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-input v-model="globalForm.origin" @change="syncGlobalToProducts" />
        </label>
        <div class="pod-field">
          <span class="pod-field-label">
            &#x5B9A;&#x5236;&#x54C1;
            <a-tooltip content="&#x6309;&#x5E73;&#x53F0;&#x8868;&#x683C;&#x8981;&#x6C42;&#x5199;&#x5165;&#x662F;&#x5426;&#x5B9A;&#x5236;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="globalForm.isCustom" popup-container="body" :options="customOptions" @change="syncGlobalToProducts" />
        </div>
        <label class="pod-field pod-source-link-field">
          <span class="pod-field-label">
            &#x8D27;&#x6E90;&#x94FE;&#x63A5;
            <a-tooltip content="&#x53EF;&#x586B;&#x5199;&#x5546;&#x54C1;&#x6216;&#x7D20;&#x6750;&#x6765;&#x6E90;&#x94FE;&#x63A5;&#xFF0C;&#x4FBF;&#x4E8E;&#x8868;&#x683C;&#x8FFD;&#x6EAF;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-input v-model="globalForm.sourceLink" allow-clear @change="syncGlobalToProducts" />
        </label>
      </div>
      <div class="pod-template-description-row">
        <label class="pod-field">
          <span class="pod-field-label">
            &#x8BE6;&#x60C5;&#x63CF;&#x8FF0;
            <a-tooltip content="&#x6279;&#x91CF;&#x5199;&#x5165;&#x4EA7;&#x54C1;&#x8BE6;&#x60C5;&#x63CF;&#x8FF0;&#xFF0C;&#x4F1A;&#x540C;&#x6B65;&#x5230;&#x5546;&#x54C1;&#x6570;&#x636E;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-textarea v-model="globalForm.description" class="pod-description-textarea" :auto-size="{ minRows: 3, maxRows: 3 }" @change="syncGlobalToProducts" />
        </label>
      </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';
import {
  customOptions,
  deliveryOptions,
  templateTypeOptions
} from '../constants/podUploadSheetMiaoshou.js';

const props = defineProps({
  productsCount: {
    type: Number,
    default: 0
  },
  selectedTemplateId: {
    type: String,
    default: ''
  },
  templateName: {
    type: String,
    default: ''
  },
  loadingTemplates: Boolean,
  formTemplateOptions: {
    type: Array,
    default: () => []
  },
  savingTemplate: Boolean,
  deletingTemplate: Boolean,
  loadingCategories: Boolean,
  categorySelectOptions: {
    type: Array,
    default: () => []
  },
  globalForm: {
    type: Object,
    required: true
  },
  syncGlobalToProducts: {
    type: Function,
    required: true
  },
  applySelectedTemplate: {
    type: Function,
    required: true
  },
  saveCurrentTemplate: {
    type: Function,
    required: true
  },
  deleteSelectedTemplate: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['update:selected-template-id', 'update:template-name']);

const selectedTemplateIdProxy = computed({
  get() {
    return props.selectedTemplateId;
  },
  set(value) {
    emit('update:selected-template-id', value);
  }
});

const templateNameProxy = computed({
  get() {
    return props.templateName;
  },
  set(value) {
    emit('update:template-name', value);
  }
});
</script>
