<template>
  <span class="pm-new-monitor-field-label">
    <span :class="labelClass">{{ label }}</span>
    <a-tooltip
      v-if="help"
      :content="help"
      mini
      position="top"
    >
      <IconQuestionCircle class="pm-new-monitor-help-icon" />
    </a-tooltip>
  </span>
</template>

<script setup>
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';

defineProps({
  label: {
    type: String,
    required: true
  },
  help: {
    type: String,
    default: ''
  },
  labelClass: {
    type: String,
    default: 'pm-new-monitor-config-label'
  }
});
</script>
