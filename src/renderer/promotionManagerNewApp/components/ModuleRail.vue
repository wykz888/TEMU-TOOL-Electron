<template>
  <aside class="pm-new-rail" aria-label="Promotion modules">
    <button
      v-for="moduleItem in modules"
      :key="moduleItem.id"
      class="pm-new-rail-item"
      :class="{ 'is-active': moduleItem.id === activeModuleId }"
      type="button"
      @click="$emit('change', moduleItem.id)"
    >
      <span class="pm-new-rail-icon">
        <component :is="resolveIcon(moduleItem.icon)" />
      </span>
      <span class="pm-new-rail-copy">
        <strong>{{ moduleItem.label }}</strong>
        <small>{{ moduleItem.description }}</small>
      </span>
    </button>
  </aside>
</template>

<script setup>
import {
  IconBarChart,
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
  chart: IconBarChart,
  file: IconFile,
  notification: IconNotification,
  send: IconSend
});

function resolveIcon(iconName) {
  return iconMap[iconName] || IconTool;
}
</script>
