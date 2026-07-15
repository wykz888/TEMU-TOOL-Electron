<template>
  <section class="pm-new-summary" aria-label="Promotion summary">
    <div
      v-for="metric in metrics"
      :key="metric.id"
      class="pm-new-metric"
      :class="`tone-${metric.tone}`"
    >
      <span>{{ metric.label }}</span>
      <strong>{{ metric.value }}</strong>
    </div>
  </section>
</template>

<script setup>
defineProps({
  metrics: {
    type: Array,
    default: () => []
  }
});
</script>
