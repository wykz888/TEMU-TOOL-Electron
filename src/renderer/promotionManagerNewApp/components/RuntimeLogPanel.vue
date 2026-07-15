<template>
  <section class="pm-new-log-panel" aria-label="Runtime logs">
    <div class="pm-new-log-head">
      <strong>{{ title }}</strong>
      <a-tag size="small" bordered>{{ subtitle }}</a-tag>
    </div>
    <div class="pm-new-log-list">
      <div
        v-for="log in logs"
        :key="`${log.time}-${log.text}`"
        class="pm-new-log-row"
      >
        <span>{{ log.time }}</span>
        <a-tag size="small" bordered>{{ log.level }}</a-tag>
        <p>{{ log.text }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  logs: {
    type: Array,
    default: () => []
  }
});

const title = '\u8fd0\u884c\u65e5\u5fd7';
const subtitle = '\u5e95\u90e8\u56fa\u5b9a';
</script>
