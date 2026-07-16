<template>
  <header class="pm-new-switch-bar">
    <nav class="pm-new-switch-tabs" aria-label="Promotion function switch">
      <button
        v-for="moduleItem in modules"
        :key="moduleItem.id"
        class="pm-new-switch-tab"
        :class="{ 'is-active': moduleItem.id === activeModuleId }"
        type="button"
        @click="$emit('change', moduleItem.id)"
      >
        <component :is="resolveIcon(moduleItem.icon)" />
        <span>{{ moduleItem.label }}</span>
      </button>
    </nav>

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
