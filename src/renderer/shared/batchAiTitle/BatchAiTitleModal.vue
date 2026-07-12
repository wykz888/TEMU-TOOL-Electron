<template>
  <a-modal
    :visible="visible"
    :mask-closable="false"
    :esc-to-close="!starting"
    :closable="!starting"
    :width="920"
    :footer="false"
    modal-class="pod-task-modal pod-batch-ai-title-modal"
    unmount-on-close
    @cancel="$emit('cancel')"
  >
    <template #title>
      <div class="pod-modal-title">
        <strong>&#x6279;&#x91CF;AI&#x751F;&#x6210;&#x6807;&#x9898;</strong>
      </div>
    </template>

    <div class="pod-modal-body pod-task-modal-body">
      <div class="pod-modal-form-grid">
        <div class="pod-field">
          <span class="pod-field-label">
            AI &#x5E73;&#x53F0;&#x9009;&#x62E9;
            <a-tooltip content="&#x9009;&#x62E9;&#x6279;&#x91CF;&#x751F;&#x6210;&#x6807;&#x9898;&#x4F7F;&#x7528;&#x7684; AI &#x914D;&#x7F6E;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="form.aiProvider" popup-container="body" :disabled="busy" :options="aiPlatformOptions" />
        </div>

        <div class="pod-field">
          <span class="pod-field-label">
            &#x5B58;&#x50A8;&#x7D20;&#x6750;
            <a-tooltip content="&#x9009;&#x62E9;&#x63D0;&#x4EA4;&#x7ED9; AI &#x8BC6;&#x56FE;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x7D20;&#x6750;&#x5B58;&#x50A8;&#x65B9;&#x5F0F;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="form.storageProvider" popup-container="body" :disabled="busy" :options="storageProviderOptions" />
        </div>
      </div>

      <div class="pod-modal-form-grid">
        <div class="pod-field">
          <span class="pod-field-label">
            &#x56FE;&#x7247;&#x538B;&#x7F29;
            <a-tooltip content="&#x4E0E;&#x4E0A;&#x4F20;&#x56FE;&#x7247;&#x76F8;&#x540C;&#x7684;&#x683C;&#x5F0F;&#x9009;&#x9879;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="form.imageCompression" popup-container="body" :disabled="busy" :options="imageCompressionOptions" />
        </div>

        <div class="pod-field">
          <span class="pod-field-label">
            &#x7EBF;&#x7A0B;&#x5E76;&#x53D1;
            <a-tooltip content="&#x540C;&#x65F6;&#x751F;&#x6210;&#x6807;&#x9898;&#x7684;&#x4EFB;&#x52A1;&#x6570;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-input-number v-model="form.concurrency" :disabled="busy" :min="minConcurrency" :max="maxConcurrency" mode="button" />
        </div>
      </div>

      <div class="pod-modal-form-grid">
        <div class="pod-field">
          <span class="pod-field-label">
            &#x6807;&#x9898;&#x957F;&#x5EA6;
            <a-tooltip content="&#x4EE5;&#x82F1;&#x6587;&#x6807;&#x9898;&#x957F;&#x5EA6;&#x4E3A;&#x57FA;&#x51C6;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-input-number v-model="form.targetLength" :disabled="busy" :min="minTargetLength" :max="maxTargetLength" mode="button" />
        </div>

        <div v-if="showOutputLanguage" class="pod-field">
          <span class="pod-field-label">
            &#x8F93;&#x51FA;&#x8BED;&#x8A00;
            <a-tooltip content="&#x9009;&#x62E9;&#x6807;&#x9898;&#x6700;&#x7EC8;&#x8F93;&#x51FA;&#x7684;&#x8BED;&#x8A00;&#x3002;">
              <icon-question-circle class="pod-help-icon" />
            </a-tooltip>
          </span>
          <a-select v-model="form.outputLanguage" popup-container="body" :disabled="busy" :options="outputLanguageOptions" />
        </div>
        <div v-else class="pod-field pod-batch-ai-title-quality-field">
          <span class="pod-field-label">&#x56FE;&#x7247;&#x8D28;&#x91CF;</span>
          <div class="pod-batch-ai-title-quality-control">
            <a-slider v-model="form.imageQuality" :disabled="busy" :min="minImageQuality" :max="maxImageQuality" />
            <a-input-number
              v-model="form.imageQuality"
              class="pod-quality-number"
              :disabled="busy"
              :min="minImageQuality"
              :max="maxImageQuality"
            />
          </div>
        </div>
      </div>

      <div v-if="showOutputLanguage" class="pod-quality-row pod-quality-row-modern pod-batch-ai-title-quality-row">
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

      <div class="pod-modal-form-grid">
        <div class="pod-field">
          <span class="pod-field-label">&#x6807;&#x9898;&#x524D;&#x7F00;</span>
          <a-input v-model="form.prefixText" allow-clear />
        </div>

        <div class="pod-field">
          <span class="pod-field-label">&#x6807;&#x9898;&#x540E;&#x7F00;</span>
          <a-input v-model="form.suffixText" allow-clear />
        </div>
      </div>

      <div class="pod-modal-form-grid pod-modal-form-grid--two">
        <div class="pod-cache-card">
          <span class="pod-field-label">&#x7F13;&#x5B58;&#x8BBE;&#x7F6E;</span>
          <a-checkbox v-model="form.useCache" class="pod-cache-checkbox">&#x4F7F;&#x7528;&#x7F13;&#x5B58;</a-checkbox>
        </div>
      </div>

      <label class="pod-field pod-field-full">
        <span class="pod-field-label">
          &#x9644;&#x52A0;&#x63D0;&#x793A;&#x8BCD;
          <a-tooltip content="&#x53EF;&#x4EE5;&#x8865;&#x5145;&#x6700;&#x540E;&#x7684;&#x751F;&#x6210;&#x63D0;&#x793A;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-textarea v-model="form.extraPrompt" :disabled="busy" :auto-size="{ minRows: 4, maxRows: 7 }" />
      </label>

      <a-alert
        v-if="status.message || summary.warning"
        class="pod-modal-alert"
        :type="resolveStatusType(status.tone || (summary.warning ? 'warning' : ''))"
        show-icon
      >
        {{ status.message || summary.warning }}
      </a-alert>

      <div v-else class="pod-task-note">
        <strong>
          {{ summary.retryCount ? '\u91CD\u8BD5\u5931\u8D25\u5546\u54C1' : '\u5C06\u751F\u6210\u4E2D\u82F1\u53CC\u6807\u9898' }}
        </strong>
        <span>
          {{ summary.retryCount ? '\u5DF2\u8BB0\u5F55 ' + summary.retryCount + ' \u4E2A\u5931\u8D25\u9879' : '\u5C06\u5904\u7406 ' + summary.totalCount + ' \u4E2A\u5546\u54C1' }}
          {{ summary.retryCount ? '\uFF0C\u53EA\u91CD\u8BD5\u5931\u8D25\u9879\u3002' : '\uFF0C\u9ED8\u8BA4\u540C\u6B65\u751F\u6210\u4E2D\u82F1\u53CC\u6807\u9898\uFF0C\u82F1\u6587\u957F\u5EA6\u4E3A\u51C6\u3002' }}
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
        &#x91CD;&#x8BD5;&#x5931;&#x8D25;
      </a-button>
      <a-button class="pod-hot-button" type="primary" :loading="starting" @click="$emit('start', false)">
        <icon-bulb class="pod-action-icon" />
        &#x5F00;&#x59CB;&#x751F;&#x6210;
      </a-button>
    </div>
  </a-modal>
</template>

<script setup>
import {
  IconBulb,
  IconClose,
  IconQuestionCircle,
  IconRefresh
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
  showOutputLanguage: {
    type: Boolean,
    default: true
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
