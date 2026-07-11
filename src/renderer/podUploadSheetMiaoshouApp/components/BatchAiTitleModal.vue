<template>
  <a-modal
    :visible="visible"
    :mask-closable="false"
    :esc-to-close="!starting"
    :closable="!starting"
    :footer="false"
    modal-class="pod-miaoshou-batch-ai-title-modal"
    unmount-on-close
    @cancel="$emit('cancel')"
  >
    <template #title>
      <div class="pod-modal-title">
        <span>AI TITLE</span>
        <strong>&#x6279;&#x91CF;AI&#x751F;&#x6210;&#x6807;&#x9898;</strong>
      </div>
    </template>
    <div class="pod-modal-body">
      <div class="pod-summary-pills">
        <span>{{ summary.aiName || '\u706b\u5c71\u5f15\u64ce' }}</span>
        <span>{{ summary.storageName || '\u817e\u8baf COS' }}</span>
        <span>{{ summary.totalCount }} &#x4E2A;&#x5546;&#x54C1;</span>
      </div>
      <div class="pod-modal-grid">
        <div class="pod-field"><span class="pod-field-label">AI &#x5E73;&#x53F0;<a-tooltip content="&#x9009;&#x62E9;&#x6279;&#x91CF;&#x751F;&#x6210;&#x6807;&#x9898;&#x4F7F;&#x7528;&#x7684; AI &#x914D;&#x7F6E;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="form.aiProvider" popup-container="body" :disabled="busy" :options="aiPlatformOptions" /></div>
        <div class="pod-field"><span class="pod-field-label">&#x5B58;&#x50A8;&#x7D20;&#x6750;<a-tooltip content="&#x9009;&#x62E9;&#x63D0;&#x4EA4;&#x7ED9; AI &#x8BC6;&#x56FE;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x7D20;&#x6750;&#x5B58;&#x50A8;&#x65B9;&#x5F0F;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="form.storageProvider" popup-container="body" :disabled="busy" :options="storageProviderOptions" /></div>
        <div class="pod-field"><span class="pod-field-label">&#x56FE;&#x7247;&#x538B;&#x7F29;<a-tooltip content="&#x63D0;&#x4EA4;&#x7ED9; AI &#x524D;&#x7684;&#x56FE;&#x7247;&#x5904;&#x7406;&#x65B9;&#x5F0F;&#xFF0C;&#x7528;&#x4E8E;&#x63A7;&#x5236;&#x4E0A;&#x4F20;&#x4F53;&#x79EF;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="form.imageCompression" popup-container="body" :disabled="busy" :options="imageCompressionOptions" /></div>
        <label class="pod-field"><span class="pod-field-label">&#x7EBF;&#x7A0B;&#x5E76;&#x53D1;<a-tooltip content="&#x540C;&#x65F6;&#x751F;&#x6210;&#x6807;&#x9898;&#x7684;&#x4EFB;&#x52A1;&#x6570;&#xFF0C;&#x8FC7;&#x9AD8;&#x53EF;&#x80FD;&#x89E6;&#x53D1;&#x9650;&#x6D41;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-input-number v-model="form.concurrency" :disabled="busy" :min="minConcurrency" :max="maxConcurrency" mode="button" /></label>
        <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x957F;&#x5EA6;<a-tooltip content="AI &#x751F;&#x6210;&#x6807;&#x9898;&#x65F6;&#x5C3D;&#x91CF;&#x63A5;&#x8FD1;&#x7684;&#x76EE;&#x6807;&#x5B57;&#x6570;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-input-number v-model="form.targetLength" :disabled="busy" :min="minTargetLength" :max="maxTargetLength" mode="button" /></label>
        <div class="pod-field"><span class="pod-field-label">&#x8F93;&#x51FA;&#x8BED;&#x8A00;<a-tooltip content="&#x9009;&#x62E9;&#x6807;&#x9898;&#x6700;&#x7EC8;&#x8F93;&#x51FA;&#x7684;&#x8BED;&#x8A00;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="form.outputLanguage" popup-container="body" :disabled="busy" :options="outputLanguageOptions" /></div>
      </div>
      <div class="pod-quality-row">
        <span>&#x56FE;&#x7247;&#x8D28;&#x91CF;</span>
        <a-slider v-model="form.imageQuality" :disabled="busy" :min="minImageQuality" :max="maxImageQuality" />
        <strong>{{ form.imageQuality }}</strong>
      </div>
      <div class="pod-modal-grid">
        <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x524D;&#x7F00;</span><a-input v-model="form.prefixText" allow-clear /></label>
        <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x540E;&#x7F00;</span><a-input v-model="form.suffixText" allow-clear /></label>
      </div>
      <label class="pod-field"><span class="pod-field-label">&#x9644;&#x52A0;&#x63D0;&#x793A;&#x8BCD;</span><a-textarea v-model="form.extraPrompt" :auto-size="{ minRows: 4, maxRows: 7 }" /></label>
      <a-checkbox v-model="form.useCache">&#x4F7F;&#x7528;&#x7F13;&#x5B58;</a-checkbox>
      <a-alert v-if="status.message || summary.warning" :type="resolveStatusType(status.tone || (summary.warning ? 'warning' : ''))" show-icon>{{ status.message || summary.warning }}</a-alert>
    </div>
    <div class="pod-modal-footer">
      <a-button :disabled="starting" @click="$emit('cancel')">&#x53D6;&#x6D88;</a-button>
      <a-button class="pod-danger-button" :disabled="busy || !summary.retryCount" @click="$emit('start', true)">&#x91CD;&#x8BD5;&#x5931;&#x8D25;</a-button>
      <a-button class="pod-theme-button" type="primary" :loading="starting" @click="$emit('start', false)">&#x6279;&#x91CF;&#x5F00;&#x59CB;&#x6807;&#x9898;&#x751F;&#x6210;</a-button>
    </div>
  </a-modal>
</template>

<script setup>
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';

defineProps({
  visible: Boolean,
  starting: Boolean,
  busy: Boolean,
  form: {
    type: Object,
    required: true
  },
  summary: {
    type: Object,
    required: true
  },
  status: {
    type: Object,
    required: true
  },
  aiPlatformOptions: {
    type: Array,
    default: () => []
  },
  storageProviderOptions: {
    type: Array,
    default: () => []
  },
  imageCompressionOptions: {
    type: Array,
    default: () => []
  },
  outputLanguageOptions: {
    type: Array,
    default: () => []
  },
  minConcurrency: {
    type: Number,
    required: true
  },
  maxConcurrency: {
    type: Number,
    required: true
  },
  minTargetLength: {
    type: Number,
    required: true
  },
  maxTargetLength: {
    type: Number,
    required: true
  },
  minImageQuality: {
    type: Number,
    required: true
  },
  maxImageQuality: {
    type: Number,
    required: true
  },
  resolveStatusType: {
    type: Function,
    required: true
  }
});

defineEmits(['cancel', 'start']);
</script>
