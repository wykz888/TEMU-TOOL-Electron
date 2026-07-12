<template>
  <a-modal
    :visible="visible"
    :mask-closable="false"
    :esc-to-close="!starting"
    :closable="!starting"
    :footer="false"
    modal-class="pod-task-modal pod-image-upload-modal"
    unmount-on-close
    @cancel="$emit('cancel')"
  >
    <template #title>
      <div class="pod-modal-title">
        <strong>&#x6279;&#x91CF;&#x4E0A;&#x4F20;&#x56FE;&#x7247;</strong>
      </div>
    </template>

    <div class="pod-modal-body pod-task-modal-body">
      <div class="pod-modal-form-grid">
        <div class="pod-field">
          <span class="pod-field-label">
            &#x5B58;&#x50A8;&#x7D20;&#x6750;
            <a-tooltip content="&#x9009;&#x62E9;&#x4E0A;&#x4F20;&#x56FE;&#x7247;&#x7684;&#x4FDD;&#x5B58;&#x7A7A;&#x95F4;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select
            v-model="form.storageProvider"
            popup-container="body"
            :disabled="busy"
            :options="storageProviderOptions"
            @change="handleStorageProviderChange"
          />
        </div>
        <div class="pod-field">
          <span class="pod-field-label">
            &#x56FE;&#x7247;&#x538B;&#x7F29;
            <a-tooltip content="&#x9009;&#x62E9;&#x56FE;&#x7247;&#x4FDD;&#x5B58;&#x683C;&#x5F0F;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="form.imageUploadMode" popup-container="body" :disabled="busy" :options="imageUploadModeOptions" />
        </div>
        <div class="pod-field">
          <span class="pod-field-label">
            &#x7EBF;&#x7A0B;&#x5E76;&#x53D1;
            <a-tooltip content="&#x540C;&#x65F6;&#x4E0A;&#x4F20;&#x7684;&#x56FE;&#x7247;&#x6570;&#x91CF;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-input-number
            v-model="form.concurrency"
            :disabled="busy"
            :min="minConcurrency"
            :max="maxConcurrency"
            mode="button"
          />
        </div>
      </div>

      <div class="pod-quality-row pod-quality-row-modern">
        <span class="pod-field-label">&#x56FE;&#x7247;&#x8D28;&#x91CF;</span>
        <a-slider v-model="form.imageQuality" :disabled="busy" :min="minImageQuality" :max="maxImageQuality" />
        <a-input-number
          v-model="form.imageQuality"
          class="pod-quality-number"
          :disabled="busy"
          :min="minImageQuality"
          :max="maxImageQuality"
        />
      </div>

      <a-alert
        v-if="status.message || summary.warning"
        class="pod-modal-alert"
        :type="resolveStatusType(status.tone || (summary.warning ? 'warning' : ''))"
        show-icon
      >
        {{ status.message || summary.warning }}
      </a-alert>

      <div v-else class="pod-task-note">
        <strong>{{ summary.retryCount ? '\u5931\u8D25\u56FE\u7247\u53EF\u91CD\u8BD5' : '\u6279\u91CF\u4E0A\u4F20' }}</strong>
        <span>
          {{ summary.retryCount ? '\u5DF2\u8BB0\u5F55' : '\u5C06\u5904\u7406' }}
          {{ summary.retryCount || summary.totalCount }}
          {{ summary.retryCount ? '\u5F20\u5931\u8D25\u56FE\u7247\uFF0C\u91CD\u8BD5\u65F6\u53EA\u5904\u7406\u8FD9\u4E9B\u6587\u4EF6\u3002' : '\u5F20\u56FE\u7247\uFF0C\u4E0A\u4F20\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u590D\u7528\u94FE\u63A5\u3002' }}
        </span>
      </div>
    </div>

    <div class="pod-modal-footer">
      <a-button class="pod-neutral-button" :disabled="starting" @click="$emit('cancel')">
        <icon-close class="pod-action-icon" />
        &#x53D6;&#x6D88;
      </a-button>
      <a-button class="pod-neutral-button" :disabled="busy || !summary.retryCount" @click="$emit('start', true)">
        <icon-refresh class="pod-action-icon" />
        &#x5931;&#x8D25;&#x91CD;&#x8BD5;
      </a-button>
      <a-button class="pod-hot-button" type="primary" :loading="starting" @click="$emit('start', false)">
        <icon-upload class="pod-action-icon" />
        &#x5F00;&#x59CB;&#x6279;&#x91CF;&#x4E0A;&#x4F20;
      </a-button>
    </div>
  </a-modal>
</template>

<script setup>
import {
  IconClose,
  IconQuestionCircle,
  IconRefresh,
  IconUpload
} from '@arco-design/web-vue/es/icon';
import '../taskModal/taskModal.css';

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
  storageProviderOptions: {
    type: Array,
    default: () => []
  },
  imageUploadModeOptions: {
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
  minImageQuality: {
    type: Number,
    required: true
  },
  maxImageQuality: {
    type: Number,
    required: true
  },
  handleStorageProviderChange: {
    type: Function,
    required: true
  },
  resolveStatusType: {
    type: Function,
    required: true
  }
});

defineEmits(['cancel', 'start']);
</script>
