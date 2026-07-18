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
  </header>
</template>

<script setup>
import {
  IconFile,
  IconNotification,
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
  }
});

defineEmits(['change']);

const iconMap = Object.freeze({
  file: IconFile,
  notification: IconNotification,
  send: IconSend
});

function resolveIcon(iconName) {
  return iconMap[iconName] || IconTool;
}
</script>
