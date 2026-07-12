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

  <section class="pod-panel pod-template-panel pod-universal-template-panel">
    <div class="pod-panel-head">
      <div>
        <p class="pod-panel-tag">&#x57FA;&#x7840;</p>
        <h2 class="pod-panel-title">&#x901A;&#x7528;&#x8868;&#x683C;&#x5B57;&#x6BB5;</h2>
      </div>
      <a-tag class="pod-miaoshou-theme-tag" bordered>{{ productsCount }} &#x4E2A;&#x5546;&#x54C1;</a-tag>
    </div>
    <div class="pod-universal-main-row">
      <label class="pod-field">
        <span class="pod-field-label">
          &#x8D27;&#x6E90;&#x7C7B;&#x76EE;
          <a-tooltip content="&#x5BFC;&#x51FA;&#x8868;&#x683C;&#x65F6;&#x5199;&#x5165;&#x8D27;&#x6E90;&#x7C7B;&#x76EE;&#x5B57;&#x6BB5;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.sourceCategory" allow-clear @change="syncGlobalToProducts" />
      </label>
      <label class="pod-field">
        <span class="pod-field-label">
          &#x81EA;&#x5B9A;&#x4E49;&#x5C5E;&#x6027;
          <a-tooltip content="&#x586B;&#x5199;&#x5E73;&#x53F0;&#x8868;&#x683C;&#x8981;&#x6C42;&#x7684;&#x81EA;&#x5B9A;&#x4E49;&#x5C5E;&#x6027;&#x5185;&#x5BB9;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.customAttributes" allow-clear @change="syncGlobalToProducts" />
      </label>
    </div>
    <div class="pod-universal-media-row">
      <label class="pod-field">
        <span class="pod-field-label">
          &#x4EA7;&#x54C1;&#x89C6;&#x9891;
          <a-tooltip content="&#x53EF;&#x586B;&#x5199;&#x4EA7;&#x54C1;&#x89C6;&#x9891;&#x6587;&#x4EF6;&#x6216;&#x94FE;&#x63A5;&#x4FE1;&#x606F;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.mainVideo" allow-clear @change="syncGlobalToProducts" />
      </label>
      <label class="pod-field">
        <span class="pod-field-label">
          &#x4EA7;&#x54C1;&#x8BC1;&#x4E66;
          <a-tooltip content="&#x53EF;&#x586B;&#x5199;&#x8BC1;&#x4E66;&#x6587;&#x4EF6;&#x6216;&#x8868;&#x683C;&#x9700;&#x8981;&#x7684;&#x8BC1;&#x4E66;&#x4FE1;&#x606F;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.certificate" allow-clear @change="syncGlobalToProducts" />
      </label>
      <label class="pod-field">
        <span class="pod-field-label">
          &#x5C3A;&#x5BF8;&#x56FE;&#x8868;
          <a-tooltip content="&#x53EF;&#x586B;&#x5199;&#x5C3A;&#x5BF8;&#x56FE;&#x8868;&#x76F8;&#x5173;&#x4FE1;&#x606F;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.sizeChart" allow-clear @change="syncGlobalToProducts" />
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
