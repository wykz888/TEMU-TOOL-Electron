<template>
  <a-modal
    :visible="visible"
    :mask-closable="false"
    :esc-to-close="!saving"
    :closable="!saving"
    :footer="false"
    modal-class="pod-miaoshou-ai-config-modal"
    unmount-on-close
    @cancel="$emit('cancel')"
  >
    <template #title>
      <div class="pod-modal-title">
        <span>AI CONFIG</span>
        <strong>AI&#x914D;&#x7F6E;</strong>
      </div>
    </template>
    <div class="pod-modal-body">
      <div class="pod-modal-grid">
        <div class="pod-field">
          <span class="pod-field-label">&#x6A21;&#x578B;&#x540D;&#x79F0;<a-tooltip content="&#x9009;&#x62E9;&#x6216;&#x8F93;&#x5165;&#x7528;&#x4E8E; AI &#x751F;&#x6210;&#x6807;&#x9898;&#x7684;&#x6A21;&#x578B;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          <a-select v-model="form.model" allow-create allow-search popup-container="body" :disabled="busy" :options="modelOptions" />
        </div>
        <div class="pod-field">
          <span class="pod-field-label">API Base URL<a-tooltip content="AI &#x63A5;&#x53E3;&#x5730;&#x5740;&#xFF0C;&#x9700;&#x4E0E;&#x6A21;&#x578B;&#x548C; API KEY &#x5339;&#x914D;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          <a-select v-model="form.apiBaseUrl" allow-create allow-search popup-container="body" :disabled="busy" :options="apiBaseOptions" />
        </div>
        <label class="pod-field">
          <span class="pod-field-label">&#x7EBF;&#x7A0B;&#x5E76;&#x53D1;&#x6570;<a-tooltip content="&#x540C;&#x65F6;&#x8BF7;&#x6C42; AI &#x7684;&#x6570;&#x91CF;&#xFF0C;&#x8FC7;&#x9AD8;&#x53EF;&#x80FD;&#x89E6;&#x53D1;&#x9650;&#x6D41;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          <a-input-number v-model="form.concurrency" :disabled="busy" :min="minConcurrency" :max="maxConcurrency" mode="button" />
        </label>
      </div>
      <label class="pod-field">
        <span class="pod-field-label">API KEY<a-tooltip content="&#x53EF;&#x4EE5;&#x4E00;&#x884C;&#x586B;&#x4E00;&#x4E2A; API KEY&#xFF0C;&#x751F;&#x6210;&#x65F6;&#x4F1A;&#x6309;&#x914D;&#x7F6E;&#x4F7F;&#x7528;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
        <a-textarea v-model="form.apiKeysText" :disabled="busy" :auto-size="{ minRows: 8, maxRows: 12 }" />
      </label>
      <a-alert v-if="status.message" :type="resolveStatusType(status.tone)" show-icon>{{ status.message }}</a-alert>
    </div>
    <div class="pod-modal-footer">
      <a-button :disabled="saving" @click="$emit('cancel')">&#x53D6;&#x6D88;</a-button>
      <a-button class="pod-theme-button" type="primary" :loading="saving" @click="$emit('save')">{{ saving ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58' }}</a-button>
    </div>
  </a-modal>
</template>

<script setup>
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';

defineProps({
  visible: Boolean,
  saving: Boolean,
  busy: Boolean,
  form: {
    type: Object,
    required: true
  },
  status: {
    type: Object,
    required: true
  },
  modelOptions: {
    type: Array,
    default: () => []
  },
  apiBaseOptions: {
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
  resolveStatusType: {
    type: Function,
    required: true
  }
});

defineEmits(['cancel', 'save']);
</script>
