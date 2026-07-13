<template>
  <main class="exit-shell">
    <section
      ref="cardRef"
      class="exit-card"
      role="status"
      aria-live="polite"
      tabindex="-1"
    >
      <div class="exit-card-topline">
        <span class="exit-badge">{{ viewState.badgeText }}</span>
        <span class="exit-percent">{{ viewState.percentText }}</span>
      </div>
      <h1 class="exit-title">{{ viewState.title }}</h1>
      <p class="exit-message">{{ viewState.message }}</p>
      <div class="exit-progress-track" aria-hidden="true">
        <div
          class="exit-progress-bar"
          :style="{ width: `${viewState.percent}%` }"
        ></div>
      </div>
      <div class="exit-meta">
        <span class="exit-detail">{{ viewState.detail }}</span>
      </div>
      <p class="exit-hint">{{ viewState.hint }}</p>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { getExitProgressBridge } from './bridge.js';
import { buildExitProgressViewState } from './viewState.js';

const bridge = getExitProgressBridge();
const initialPayload = bridge.getPayload() || {};
const payload = ref(initialPayload);
const cardRef = ref(null);
const viewState = computed(() => buildExitProgressViewState(payload.value));
let disposeUpdate = null;

watchEffect(() => {
  document.body.dataset.status = viewState.value.status;
  document.body.dataset.theme = viewState.value.theme;
});

onMounted(() => {
  disposeUpdate = bridge.onUpdate((nextPayload) => {
    payload.value = nextPayload || initialPayload;
  });

  requestAnimationFrame(() => {
    if (cardRef.value && typeof cardRef.value.focus === 'function') {
      cardRef.value.focus();
    }
  });
});

onUnmounted(() => {
  if (disposeUpdate) {
    disposeUpdate();
    disposeUpdate = null;
  }
});
</script>
