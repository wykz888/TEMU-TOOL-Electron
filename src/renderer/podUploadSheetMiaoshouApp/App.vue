<template>
  <div class="pod-miaoshou-app-shell">
    <header class="pod-miaoshou-app-header">
      <div class="pod-miaoshou-app-header__copy">
        <span class="pod-miaoshou-app-header__eyebrow">MIAOSHOU TEMU</span>
        <div class="pod-miaoshou-app-header__title-row">
          <h1>POD&#x4E0A;&#x8D27;&#x8868;&#x683C;</h1>
          <a-tag class="pod-miaoshou-theme-tag" bordered size="small">
            &#x5999;&#x624B; TEMU &#x7248;
          </a-tag>
        </div>
        <p>
          &#x5148;&#x628A;&#x6570;&#x636E;&#x3001;&#x7D20;&#x6750;&#x3001;SKU &#x914D;&#x7F6E;&#x6536;&#x5728;&#x4E00;&#x4E2A;&#x5DE5;&#x4F5C;&#x9762;&#x91CC;&#x3002;
        </p>
      </div>
      <div class="pod-miaoshou-app-header__meta">
        <span class="pod-miaoshou-app-header__meta-pill">
          &#x4E0A;&#x8D27;&#x5DE5;&#x4F5C;&#x53F0;
        </span>
        <span class="pod-miaoshou-app-header__meta-pill">
          &#x4E3B;&#x9898;&#x8054;&#x52A8;
        </span>
      </div>
    </header>

    <section class="pod-miaoshou-app-surface">
      <div
        v-if="attachError"
        class="pod-miaoshou-app-error"
      >
        <strong>
          &#x754C;&#x9762;&#x6A21;&#x5757;&#x52A0;&#x8F7D;&#x4E0D;&#x5B8C;&#x6574;
        </strong>
        <p>{{ attachError }}</p>
      </div>
      <div
        v-else
        ref="legacyHostRef"
        class="pod-miaoshou-app-legacy-host"
      />
    </section>

    <a-modal
      :visible="aiTitleConfigDialog.visible"
      :mask-closable="false"
      :esc-to-close="!aiTitleConfigDialog.saving"
      :closable="!aiTitleConfigDialog.saving"
      :footer="false"
      modal-class="pod-miaoshou-ai-config-modal"
      unmount-on-close
      @cancel="aiTitleConfigDialog.closeDialog"
    >
      <template #title>
        <div class="pod-miaoshou-ai-config-modal__title">
          <div class="pod-miaoshou-ai-config-modal__title-copy">
            <span class="pod-miaoshou-ai-config-modal__eyebrow">AI CONFIG</span>
            <strong>AI&#x914D;&#x7F6E;</strong>
          </div>
          <a-tag class="pod-miaoshou-theme-tag" bordered size="small">
            &#x4E91;&#x7AEF;&#x540C;&#x6B65;
          </a-tag>
        </div>
      </template>

      <div class="pod-miaoshou-ai-config-modal__body">
        <div class="pod-miaoshou-ai-config-modal__intro">
          <p>
            &#x4E24;&#x4E2A; POD &#x4E0A;&#x8D27;&#x8868;&#x683C;&#x5171;&#x7528;&#x540C;&#x4E00;&#x5957; AI &#x914D;&#x7F6E;&#x3002;
          </p>
          <span>
            &#x4FDD;&#x5B58;&#x540E;&#x4F1A;&#x540C;&#x6B65;&#x5230;&#x4E91;&#x7AEF;&#xFF0C;&#x767B;&#x5F55;&#x540C;&#x8D26;&#x53F7;&#x53EF;&#x76F4;&#x63A5;&#x590D;&#x7528;&#x3002;
          </span>
        </div>

        <div class="pod-miaoshou-ai-config-modal__grid">
          <label class="pod-miaoshou-ai-config-field">
            <span class="pod-miaoshou-ai-config-field__label">&#x6A21;&#x578B;&#x540D;&#x79F0;</span>
            <a-select
              v-model="aiTitleConfigDialog.form.model"
              allow-create
              allow-search
              :disabled="aiTitleConfigDialog.busy"
              :options="aiTitleConfigDialog.modelOptions"
              placeholder="&#x9009;&#x62E9;&#x6216;&#x8F93;&#x5165;&#x6A21;&#x578B;"
            />
          </label>

          <label class="pod-miaoshou-ai-config-field">
            <span class="pod-miaoshou-ai-config-field__label">API Base URL</span>
            <a-select
              v-model="aiTitleConfigDialog.form.apiBaseUrl"
              allow-create
              allow-search
              :disabled="aiTitleConfigDialog.busy"
              :options="aiTitleConfigDialog.apiBaseOptions"
              placeholder="&#x9009;&#x62E9;&#x6216;&#x8F93;&#x5165; API Base URL"
            />
          </label>

          <label class="pod-miaoshou-ai-config-field pod-miaoshou-ai-config-field--compact">
            <span class="pod-miaoshou-ai-config-field__label">&#x7EBF;&#x7A0B;&#x5E76;&#x53D1;&#x6570;</span>
            <a-input-number
              v-model="aiTitleConfigDialog.form.concurrency"
              :disabled="aiTitleConfigDialog.busy"
              :min="aiTitleConfigDialog.minConcurrency"
              :max="aiTitleConfigDialog.maxConcurrency"
              mode="button"
            />
          </label>
        </div>

        <label class="pod-miaoshou-ai-config-field pod-miaoshou-ai-config-field--textarea">
          <span class="pod-miaoshou-ai-config-field__label">API KEY</span>
          <a-textarea
            v-model="aiTitleConfigDialog.form.apiKeysText"
            :disabled="aiTitleConfigDialog.busy"
            :auto-size="{ minRows: 8, maxRows: 12 }"
            placeholder="&#x4E00;&#x884C;&#x4E00;&#x4E2A; KEY"
          />
          <span class="pod-miaoshou-ai-config-field__hint">
            KEY &#x4F1A;&#x6309;&#x987A;&#x5E8F;&#x5FAA;&#x73AF;&#x4F7F;&#x7528;&#xFF0C;&#x5EFA;&#x8BAE;&#x4E00;&#x884C;&#x4E00;&#x4E2A;&#x3002;
          </span>
        </label>

        <a-alert
          v-if="aiTitleConfigDialog.status.message"
          :type="resolveAiStatusType(aiTitleConfigDialog.status.tone)"
          :show-icon="true"
          class="pod-miaoshou-ai-config-modal__status"
        >
          {{ aiTitleConfigDialog.status.message }}
        </a-alert>
      </div>

      <div class="pod-miaoshou-ai-config-modal__footer">
        <a-button :disabled="aiTitleConfigDialog.saving" @click="aiTitleConfigDialog.closeDialog">
          &#x53D6;&#x6D88;
        </a-button>
        <a-button
          class="pod-miaoshou-ai-config-save"
          type="primary"
          :loading="aiTitleConfigDialog.saving"
          @click="aiTitleConfigDialog.saveDialog"
        >
          {{ getAiSaveButtonLabel() }}
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAiTitleConfigDialog } from './useAiTitleConfigDialog.js';

const LEGACY_ROOT_ID = 'pod-upload-sheet-miaoshou-legacy-root';
const BODY_READY_CLASS = 'pod-miaoshou-vue-mounted';

const legacyHostRef = ref(null);
const attachError = ref('');
const aiTitleConfigDialog = useAiTitleConfigDialog();
let cleanupAiTitleConfigBridge = null;

function attachLegacyRoot() {
  if (!legacyHostRef.value) {
    return false;
  }

  const legacyRoot = document.getElementById(LEGACY_ROOT_ID);

  if (!legacyRoot) {
    attachError.value = '\u672a\u627e\u5230\u65e7\u754c\u9762\u5185\u5bb9\u5bb9\u5668\u3002';
    return false;
  }

  if (legacyRoot.parentElement !== legacyHostRef.value) {
    legacyHostRef.value.appendChild(legacyRoot);
  }

  legacyRoot.hidden = false;
  document.body.classList.add(BODY_READY_CLASS);
  attachError.value = '';
  return true;
}

function resolveAiStatusType(tone) {
  if (tone === 'danger') {
    return 'error';
  }

  if (tone === 'warning') {
    return 'warning';
  }

  return 'info';
}

function getAiSaveButtonLabel() {
  return aiTitleConfigDialog.saving ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58';
}

onMounted(async () => {
  await nextTick();
  attachLegacyRoot();
  cleanupAiTitleConfigBridge = aiTitleConfigDialog.installGlobalBridge();
});

onBeforeUnmount(() => {
  if (typeof cleanupAiTitleConfigBridge === 'function') {
    cleanupAiTitleConfigBridge();
    cleanupAiTitleConfigBridge = null;
  }
});

defineExpose({
  refresh() {
    attachLegacyRoot();
    return Promise.resolve(null);
  }
});
</script>

<style>
.pod-miaoshou-app-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 100vh;
  padding: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(var(--theme-primary-rgb-1, 252, 244, 214), 0.42));
  color: #162030;
}

body.dark-theme .pod-miaoshou-app-shell {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(19, 28, 47, 0.98));
  color: #e5eefc;
}

.pod-miaoshou-app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(var(--theme-primary-rgb-1, 252, 244, 214), 0.38));
  box-shadow:
    0 14px 28px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

body.dark-theme .pod-miaoshou-app-header {
  border-color: rgba(71, 85, 105, 0.42);
  background:
    linear-gradient(180deg, rgba(22, 31, 47, 0.96), rgba(15, 23, 42, 0.92));
  box-shadow:
    0 18px 42px rgba(2, 6, 23, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.pod-miaoshou-app-header__copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.pod-miaoshou-app-header__eyebrow {
  color: var(--theme-primary-ink, #8f5a0e);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.pod-miaoshou-app-header__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pod-miaoshou-app-header__title-row h1 {
  margin: 0;
  color: #162030;
  font-size: 22px;
  line-height: 1.12;
}

body.dark-theme .pod-miaoshou-app-header__title-row h1 {
  color: #f8fafc;
}

.pod-miaoshou-app-header__copy p {
  margin: 0;
  color: #5b6b80;
  font-size: 12px;
  line-height: 1.55;
}

body.dark-theme .pod-miaoshou-app-header__copy p {
  color: #9fb0c8;
}

.pod-miaoshou-app-header__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pod-miaoshou-theme-tag.arco-tag {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.24);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
  color: var(--theme-primary-ink, #7a4a00);
}

body.dark-theme .pod-miaoshou-theme-tag.arco-tag {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.32);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16);
  color: #fff0c7;
}

.pod-miaoshou-app-header__meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(var(--theme-primary-rgb, 212, 160, 56), 0.22);
  background: linear-gradient(
    180deg,
    rgba(var(--theme-primary-rgb, 212, 160, 56), 0.16),
    rgba(var(--theme-primary-rgb, 212, 160, 56), 0.1)
  );
  color: var(--theme-primary-ink, #7a4a00);
  font-size: 12px;
  font-weight: 700;
}

body.dark-theme .pod-miaoshou-app-header__meta-pill {
  border-color: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.3);
  background: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.16);
  color: #ffe3a6;
}

.pod-miaoshou-app-surface {
  min-height: 0;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 16px 34px rgba(15, 23, 42, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
  overflow: hidden;
}

body.dark-theme .pod-miaoshou-app-surface {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(15, 23, 42, 0.82);
  box-shadow:
    0 22px 46px rgba(2, 6, 23, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.pod-miaoshou-app-error {
  padding: 24px;
  color: #b42318;
  font-size: 14px;
}

.pod-miaoshou-app-error p {
  margin: 10px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.pod-miaoshou-app-legacy-host {
  min-height: calc(100vh - 156px);
}

.pod-miaoshou-app-legacy-host > #pod-upload-sheet-miaoshou-legacy-root {
  display: block;
}

.pod-miaoshou-ai-config-modal .arco-modal {
  width: min(720px, calc(100vw - 32px));
  border-radius: 20px;
  overflow: hidden;
}

.pod-miaoshou-ai-config-modal .arco-modal-header {
  padding: 18px 20px 0;
  border-bottom: 0;
}

.pod-miaoshou-ai-config-modal .arco-modal-body {
  padding: 14px 20px 20px;
}

.pod-miaoshou-ai-config-modal__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.pod-miaoshou-ai-config-modal__title-copy {
  display: grid;
  gap: 4px;
}

.pod-miaoshou-ai-config-modal__title-copy strong {
  color: #162030;
  font-size: 18px;
  line-height: 1.2;
}

body.dark-theme .pod-miaoshou-ai-config-modal__title-copy strong {
  color: #f8fafc;
}

.pod-miaoshou-ai-config-modal__eyebrow {
  color: var(--theme-primary-ink, #8f5a0e);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.pod-miaoshou-ai-config-modal__body {
  display: grid;
  gap: 14px;
}

.pod-miaoshou-ai-config-modal__intro {
  display: grid;
  gap: 4px;
  padding: 14px 15px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(var(--theme-primary-rgb-1, 252, 244, 214), 0.6), rgba(255, 255, 255, 0.98));
}

.pod-miaoshou-ai-config-modal__intro p,
.pod-miaoshou-ai-config-modal__intro span {
  margin: 0;
  color: #5b6b80;
  font-size: 12px;
  line-height: 1.6;
}

.pod-miaoshou-ai-config-modal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.pod-miaoshou-ai-config-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.pod-miaoshou-ai-config-field--compact {
  max-width: 220px;
}

.pod-miaoshou-ai-config-field--textarea {
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  background: rgba(250, 251, 252, 0.86);
}

.pod-miaoshou-ai-config-field__label {
  color: #5f6f83;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.pod-miaoshou-ai-config-field__hint {
  color: #7a8899;
  font-size: 11px;
  line-height: 1.5;
}

.pod-miaoshou-ai-config-modal__status {
  border-radius: 14px;
}

.pod-miaoshou-ai-config-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.pod-miaoshou-ai-config-save.arco-btn-primary {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.72);
  background: linear-gradient(180deg, var(--theme-primary-color, #d4a038), var(--theme-primary-color-deep, #b97d11));
  color: var(--theme-primary-contrast, #ffffff);
  box-shadow: 0 10px 22px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.18);
}

.pod-miaoshou-ai-config-save.arco-btn-primary:hover,
.pod-miaoshou-ai-config-save.arco-btn-primary:focus {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.82);
  background: linear-gradient(180deg, var(--theme-primary-color, #d4a038), var(--theme-primary-color-deep, #b97d11));
  color: var(--theme-primary-contrast, #ffffff);
  box-shadow: 0 14px 26px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.22);
}

.pod-miaoshou-ai-config-modal .arco-input-wrapper,
.pod-miaoshou-ai-config-modal .arco-select-view,
.pod-miaoshou-ai-config-modal .arco-textarea-wrapper,
.pod-miaoshou-ai-config-modal .arco-input-number {
  border-radius: 12px;
}

body.dark-theme .pod-miaoshou-ai-config-modal .arco-modal {
  background: #101826;
}

body.dark-theme .pod-miaoshou-ai-config-modal .arco-modal-header {
  background: transparent;
}

body.dark-theme .pod-miaoshou-ai-config-modal__intro {
  border-color: rgba(71, 85, 105, 0.42);
  background: linear-gradient(180deg, rgba(21, 31, 47, 0.96), rgba(16, 24, 38, 0.98));
}

body.dark-theme .pod-miaoshou-ai-config-modal__intro p,
body.dark-theme .pod-miaoshou-ai-config-modal__intro span,
body.dark-theme .pod-miaoshou-ai-config-field__label {
  color: #a8b6ca;
}

body.dark-theme .pod-miaoshou-ai-config-field--textarea {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(18, 26, 42, 0.88);
}

body.dark-theme .pod-miaoshou-ai-config-field__hint {
  color: #8fa2b9;
}

body.pod-miaoshou-vue-mounted {
  background: #ffffff;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-root {
  min-height: 100vh;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root {
  display: block;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-shell {
  min-height: auto;
  max-width: 1760px;
  margin: 0 auto;
  padding: 14px;
  gap: 12px;
  background: transparent;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-template-strip {
  border-radius: 16px;
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95));
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.045),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-form-template-panel,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-list-panel {
  gap: 10px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-editor-main {
  gap: 10px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel-head {
  align-items: center;
  gap: 12px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel-tag {
  color: var(--theme-primary-ink, #8f5a0e);
  font-size: 10px;
  letter-spacing: 0.12em;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel-title {
  color: #152235;
  font-size: 17px;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel-title {
  color: #f8fafc;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel-description,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-hint,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-empty-text {
  color: #6a798c;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-panel,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-template-strip {
  border-color: rgba(71, 85, 105, 0.42);
  background:
    linear-gradient(180deg, rgba(20, 29, 45, 0.94), rgba(15, 23, 42, 0.92));
  box-shadow:
    0 16px 36px rgba(2, 6, 23, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-primary-button {
  border-color: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.28);
  background: linear-gradient(
    135deg,
    var(--theme-primary-color, #d4a038),
    var(--theme-primary-color-deep, #b97d11)
  );
  color: var(--theme-primary-contrast, #ffffff);
  box-shadow: 0 12px 24px rgba(var(--theme-primary-rgb, 212, 160, 56), 0.22);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-secondary-button,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-material-action,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-control {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.98);
  color: #243244;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-secondary-button,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-material-action,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-control {
  border-color: rgba(71, 85, 105, 0.5);
  background: rgba(15, 23, 42, 0.9);
  color: #e5eefc;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-secondary-button:hover,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-material-action:hover {
  border-color: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.26);
  background: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.08);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-secondary-button,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-primary-button,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-material-action {
  min-height: 36px;
  border-radius: 10px;
  padding: 0 13px;
  font-size: 12px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-compact-panel {
  padding: 12px 14px;
  border-radius: 16px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-compact-panel .pod-panel-title {
  font-size: 16px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-compact-panel .pod-field-label {
  font-size: 11px;
  color: #627286;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-compact-panel .pod-field-label {
  color: #93a4bb;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-form-template-toolbar {
  grid-template-columns: minmax(240px, 1fr) minmax(180px, 0.72fr) auto;
  gap: 10px 12px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-list-toolbar-actions {
  display: grid;
  grid-template-columns: max-content max-content minmax(0, 1fr);
  grid-template-areas:
    "actions upload tail"
    "ai ai ai";
  align-items: start;
  gap: 8px 10px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block {
  position: relative;
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-actions,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail {
  padding: 10px 10px 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  background: rgba(250, 251, 252, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload {
  grid-area: upload;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail {
  grid-area: tail;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  justify-self: end;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-actions,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(18, 26, 42, 0.84);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail {
  min-width: max-content;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-actions::before,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload::before,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail::before,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-toolbar::before {
  display: block;
  color: var(--theme-primary-ink, #8f5a0e);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  flex-basis: 100%;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-actions::before {
  content: "\6279\91cf\64cd\4f5c";
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload::before {
  content: "\56fe\7247\4e0a\4f20";
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail::before {
  content: "\5bfc\51fa\7ba1\7406";
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 8px 10px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload .pod-ai-title-progress {
  min-height: 24px;
  padding: 0;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-upload-action-group {
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-upload-action-group {
  background: transparent;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-toolbar {
  position: relative;
  display: grid;
  grid-area: ai;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(var(--theme-primary-rgb-1, 252, 244, 214), 0.52), rgba(250, 250, 251, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-toolbar::before {
  content: "AI \6807\9898";
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-toolbar {
  border-color: rgba(71, 85, 105, 0.42);
  background:
    linear-gradient(180deg, rgba(22, 31, 47, 0.94), rgba(18, 26, 42, 0.92));
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-fields {
  display: grid;
  grid-template-columns: minmax(120px, 0.52fr) minmax(120px, 0.52fr) minmax(180px, 0.86fr) minmax(96px, 0.28fr);
  gap: 10px 12px;
  min-width: 0;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-field {
  min-width: 0;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-actions {
  min-width: fit-content;
  align-self: end;
  justify-content: flex-end;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-list-panel {
  gap: 12px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-list-panel-head {
  gap: 12px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-shell {
  margin-top: 2px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-dialog {
  width: min(700px, calc(100vw - 28px));
  gap: 14px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-dialog .pod-modal-head {
  align-items: stretch;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-form {
  display: grid;
  gap: 12px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-grid > :last-child {
  grid-column: 1 / span 1;
  max-width: 220px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-keys-block {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  background: rgba(250, 251, 252, 0.82);
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-keys-block {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(18, 26, 42, 0.82);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-keys-block .pod-field-hint {
  margin-top: -2px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-keys {
  min-height: 180px;
  border-radius: 12px;
  line-height: 1.6;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-status {
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.96);
  color: #516274;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-status[data-tone="warning"] {
  border-color: rgba(234, 179, 8, 0.24);
  background: rgba(255, 247, 214, 0.9);
  color: #9a6700;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-status[data-tone="danger"] {
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(255, 241, 240, 0.94);
  color: #b42318;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-footer {
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-dialog .pod-modal-head,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-footer {
  border-color: rgba(71, 85, 105, 0.42);
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-status {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(15, 23, 42, 0.86);
  color: #9fb0c8;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-status[data-tone="warning"] {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(66, 47, 14, 0.9);
  color: #ffd98d;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-status[data-tone="danger"] {
  border-color: rgba(239, 68, 68, 0.26);
  background: rgba(69, 18, 22, 0.9);
  color: #ffb4ab;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-sku-table-shell {
  border-radius: 12px;
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(252, 252, 253, 0.98);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-sku-table-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background:
    linear-gradient(180deg, rgba(var(--theme-primary-rgb-1, 252, 244, 214), 0.56), rgba(246, 248, 251, 0.98));
  color: #627286;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-sku-table-shell {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(15, 23, 42, 0.88);
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-sku-table-head {
  background:
    linear-gradient(180deg, rgba(24, 34, 52, 0.98), rgba(18, 26, 42, 0.98));
  color: #9fb0c8;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-shell {
  min-height: 500px;
  max-height: 640px;
  border-radius: 16px;
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.94);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background:
    linear-gradient(180deg, rgba(var(--theme-primary-rgb-1, 252, 244, 214), 0.56), rgba(248, 250, 252, 0.98));
  color: #5e6d82;
  font-size: 11px;
  letter-spacing: 0.04em;
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-head {
  background:
    linear-gradient(180deg, rgba(24, 34, 52, 0.98), rgba(18, 26, 42, 0.98));
  color: #9fb0c8;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-row {
  min-height: 70px;
  border-top-color: rgba(148, 163, 184, 0.12);
  transition: background-color 120ms ease, border-color 120ms ease;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-row:hover {
  background: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.055);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-table-row.is-active {
  background: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.1);
  box-shadow: inset 2px 0 0 var(--theme-primary-color, #d4a038);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-status,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-product-count,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-summary-pill {
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-modal-dialog {
  border-radius: 18px;
  border-color: rgba(148, 163, 184, 0.2);
  padding: 16px;
  box-shadow: 0 22px 46px rgba(15, 23, 42, 0.18);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-description-preset-dialog {
  padding: 12px;
  border-radius: 18px;
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-description-preset-panel,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-material-card,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-group {
  border-radius: 14px;
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(250, 251, 252, 0.96);
}

body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-description-preset-panel,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-material-card,
body.dark-theme.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-group {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(18, 26, 42, 0.92);
}

body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-control:focus,
body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-field-control:focus-visible {
  outline: none;
  border-color: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.58);
  box-shadow: 0 0 0 4px rgba(var(--theme-primary-rgb, 212, 160, 56), 0.14);
}

@media (max-width: 960px) {
  .pod-miaoshou-app-shell {
    padding: 12px;
  }

  .pod-miaoshou-app-header {
    flex-direction: column;
    align-items: stretch;
  }

  .pod-miaoshou-app-header__meta {
    justify-content: flex-start;
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-shell {
    padding: 12px;
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-form-template-toolbar,
  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-toolbar {
    grid-template-columns: 1fr;
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-upload {
    grid-template-columns: 1fr;
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-list-toolbar-actions,
  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-fields,
  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-grid {
    grid-template-columns: 1fr;
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-list-toolbar-actions {
    grid-template-areas:
      "actions"
      "upload"
      "tail"
      "ai";
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-toolbar-block-tail {
    justify-self: stretch;
    justify-content: flex-start;
    min-width: 0;
  }

  .pod-miaoshou-ai-config-modal__grid {
    grid-template-columns: 1fr;
  }

  .pod-miaoshou-ai-config-field--compact {
    max-width: none;
  }

  body.pod-miaoshou-vue-mounted #pod-upload-sheet-miaoshou-legacy-root .pod-ai-title-config-grid > :last-child {
    max-width: none;
  }
}
</style>
