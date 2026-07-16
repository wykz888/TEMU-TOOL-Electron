<template>
  <section class="pm-new-switch-page">
    <div class="pm-new-switch-head">
      <div>
        <a-tag bordered>{{ eyebrow }}</a-tag>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
    </div>

    <div class="pm-new-switch-grid">
      <button
        v-for="moduleItem in modules"
        :key="moduleItem.id"
        class="pm-new-switch-card"
        type="button"
        @click="$emit('open', moduleItem.id)"
      >
        <span class="pm-new-switch-icon">
          <component :is="resolveIcon(moduleItem.icon)" />
        </span>
        <span class="pm-new-switch-copy">
          <strong>{{ moduleItem.label }}</strong>
          <small>{{ moduleItem.description }}</small>
        </span>
        <span class="pm-new-switch-action">
          {{ actionLabel }}
          <icon-launch />
        </span>
      </button>
    </div>

    <div class="pm-new-switch-bottom">
      <div
        v-for="metric in metrics"
        :key="metric.id"
        class="pm-new-switch-metric"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup>
import {
  IconBarChart,
  IconFile,
  IconLaunch,
  IconNotification,
  IconSend,
  IconTool
} from '@arco-design/web-vue/es/icon';

defineProps({
  modules: {
    type: Array,
    default: () => []
  },
  metrics: {
    type: Array,
    default: () => []
  }
});

defineEmits(['open']);

const eyebrow = '\u529f\u80fd\u5207\u6362';
const title = '\u9009\u62e9\u8981\u8fdb\u5165\u7684\u63a8\u5e7f\u529f\u80fd';
const description = '\u5148\u5728\u8fd9\u91cc\u9009\u62e9\u65b0\u5efa\u63a8\u5e7f\u3001\u63a8\u5e7f\u660e\u7ec6\u3001\u63a8\u5e7f\u76d1\u63a7\u6216\u8fd0\u884c\u65e5\u5fd7\uff0c\u518d\u8fdb\u5165\u5bf9\u5e94\u5de5\u4f5c\u53f0\u3002';
const actionLabel = '\u8fdb\u5165';

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
