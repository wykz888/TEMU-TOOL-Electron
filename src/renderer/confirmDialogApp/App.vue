<template>
  <main class="confirm-dialog-shell" :data-tone="dialogPayload.tone">
    <section
      ref="cardRef"
      class="confirm-dialog-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmDialogTitle"
      aria-describedby="confirmDialogMessage"
      tabindex="-1"
    >
      <div class="confirm-dialog-accent"></div>
      <header class="confirm-dialog-header">
        <div class="confirm-dialog-icon" :class="toneIconClass">
          <component :is="toneIcon" />
        </div>

        <div class="confirm-dialog-head-copy">
          <span class="confirm-dialog-badge">{{ dialogPayload.badgeText }}</span>
          <h1 id="confirmDialogTitle" class="confirm-dialog-title">{{ dialogPayload.title }}</h1>
        </div>

        <a-button
          class="confirm-dialog-close"
          type="text"
          shape="circle"
          :aria-label="closeLabel"
          @click="finish(false)"
        >
          <template #icon>
            <icon-close />
          </template>
        </a-button>
      </header>

      <div class="confirm-dialog-body">
        <p id="confirmDialogMessage" class="confirm-dialog-message">{{ dialogPayload.message }}</p>
        <div v-if="dialogPayload.detail" class="confirm-dialog-detail">{{ dialogPayload.detail }}</div>
      </div>

      <footer class="confirm-dialog-footer">
        <a-button class="confirm-dialog-button is-secondary" @click="finish(false)">
          {{ dialogPayload.cancelText }}
        </a-button>
        <a-button class="confirm-dialog-button is-primary" type="primary" @click="finish(true)">
          {{ dialogPayload.confirmText }}
        </a-button>
      </footer>
    </section>
  </main>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  IconCheckCircleFill,
  IconClose,
  IconExclamationCircleFill,
  IconInfoCircleFill
} from '@arco-design/web-vue/es/icon';
import { readConfirmDialogPayload, resolveConfirmDialog } from './runtime/confirmDialogBridge';
import { applyDialogTheme } from './runtime/themeRuntime';

export default {
  name: 'ConfirmDialogApp',
  components: {
    IconClose
  },
  setup() {
    const cardRef = ref(null);
    const settled = ref(false);
    const dialogPayload = readConfirmDialogPayload();
    const closeLabel = '\u5173\u95ed';

    const toneIcon = computed(() => {
      if (dialogPayload.tone === 'danger') {
        return IconExclamationCircleFill;
      }

      if (dialogPayload.tone === 'warning') {
        return IconInfoCircleFill;
      }

      return IconCheckCircleFill;
    });

    const toneIconClass = computed(() => `is-${dialogPayload.tone}`);

    function finish(confirmed) {
      if (settled.value) {
        return;
      }

      settled.value = true;
      resolveConfirmDialog(confirmed === true);
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      }
    }

    onMounted(() => {
      applyDialogTheme(dialogPayload.theme, dialogPayload.appearance);
      window.addEventListener('keydown', handleKeydown);
      requestAnimationFrame(() => {
        if (cardRef.value && typeof cardRef.value.focus === 'function') {
          cardRef.value.focus();
        }
      });
    });

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeydown);
    });

    return {
      cardRef,
      closeLabel,
      dialogPayload,
      finish,
      toneIcon,
      toneIconClass
    };
  }
};
</script>
