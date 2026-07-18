<template>
  <header class="pm-new-switch-bar">
    <a-tabs
      class="pm-new-switch-tabs"
      :active-key="activeModuleId"
      type="rounded"
      size="small"
      hide-content
      @change="(moduleId) => $emit('change', moduleId)"
    >
      <a-tab-pane
        v-for="moduleItem in modules"
        :key="moduleItem.id"
        :title="moduleItem.label"
      >
        <template #title>
          <span class="pm-new-switch-tab-title">
            <component :is="resolveIcon(moduleItem.icon)" />
            <span>{{ moduleItem.label }}</span>
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <div class="pm-new-switch-actions">
      <a-button type="outline" size="small">
        <template #icon><icon-refresh /></template>
        {{ secondaryAction }}
      </a-button>
      <a-button
        type="primary"
        size="small"
        @click="$emit('change', 'create')"
      >
        <template #icon><icon-send /></template>
        {{ primaryAction }}
      </a-button>
    </div>
  </header>
</template>

<script setup>
import {
  IconBarChart,
  IconFile,
  IconNotification,
  IconRefresh,
  IconSend,
  IconTool
} from '@arco-design/web-vue/es/icon';

defineProps({
  modules: {
    type: Array,
    default: () => []
  },
  activeModuleId: {
    type: String,
    default: ''
  },
  secondaryAction: {
    type: String,
    default: ''
  },
  primaryAction: {
    type: String,
    default: ''
  }
});

defineEmits(['change']);

const iconMap = Object.freeze({
  chart: IconBarChart,
  file: IconFile,
  notification: IconNotification,
  send: IconSend
});

function resolveIcon(iconName) {
  return iconMap[iconName] || IconTool;
}
</script>
