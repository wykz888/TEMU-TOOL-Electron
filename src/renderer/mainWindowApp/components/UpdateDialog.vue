<template>
  <section class="main-update-dialog">
    <div class="main-update-version-row">
      <div class="main-update-version-card">
        <span>{{ currentVersionLabel }}</span>
        <strong>{{ status.currentVersion || '-' }}</strong>
      </div>
      <div class="main-update-version-card">
        <span>{{ availableVersionLabel }}</span>
        <strong>{{ status.availableVersion || '-' }}</strong>
      </div>
    </div>

    <section class="main-update-state" :class="`is-${status.phase || 'idle'}`">
      <div class="main-update-state-icon">
        <icon-sync v-if="status.phase === 'checking' || status.phase === 'downloading'" />
        <icon-check-circle v-else-if="status.phase === 'downloaded' || status.phase === 'not-available'" />
        <icon-exclamation-circle v-else-if="status.phase === 'error'" />
        <icon-info-circle v-else />
      </div>
      <div>
        <strong>{{ title }}</strong>
        <span>{{ description }}</span>
      </div>
    </section>

    <section v-if="status.phase === 'downloading'" class="main-update-progress">
      <a-progress
        :percent="progressPercent"
        :color="progressBarColor"
        :track-color="progressTrackColor"
        :show-text="false"
      />
      <div class="main-update-progress-meta">
        <span>{{ progressPercentText }}</span>
        <span>{{ progressText }}</span>
        <span>{{ speedText }}</span>
      </div>
    </section>

    <section v-if="showReleaseNotes" class="main-update-notes-panel">
      <div class="main-update-section-head">
        <strong>{{ releaseNotesTitle }}</strong>
      </div>
      <pre class="main-update-notes">{{ releaseNotes }}</pre>
    </section>

    <section v-if="releaseHistory.length" class="main-update-history-panel">
      <div class="main-update-section-head">
        <strong>{{ releaseHistoryTitle }}</strong>
        <span>{{ releaseHistoryDescription }}</span>
      </div>
      <div class="main-update-history-list">
        <article
          v-for="item in releaseHistory"
          :key="item.version"
          class="main-update-history-item"
        >
          <div class="main-update-history-head">
            <strong>{{ versionText(item.version) }}</strong>
            <span>{{ item.releaseDate || '-' }}</span>
          </div>
          <p v-if="item.title">{{ item.title }}</p>
          <ul v-if="item.notes && item.notes.length">
            <li v-for="note in item.notes" :key="note">{{ note }}</li>
          </ul>
        </article>
      </div>
    </section>

    <div class="main-update-actions">
      <a-button v-if="status.phase === 'available'" @click="$emit('skip')">
        {{ skipLabel }}
      </a-button>
      <a-button v-if="canClose" @click="$emit('close')">
        {{ closeLabel }}
      </a-button>
      <a-button v-if="canRetry" @click="$emit('check')">
        {{ retryLabel }}
      </a-button>
      <a-button
        v-if="status.phase === 'available'"
        type="primary"
        @click="$emit('download')"
      >
        {{ downloadLabel }}
      </a-button>
      <a-button
        v-if="status.phase === 'downloaded'"
        type="primary"
        @click="$emit('install')"
      >
        {{ installLabel }}
      </a-button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  IconCheckCircle,
  IconExclamationCircle,
  IconInfoCircle,
  IconSync
} from '@arco-design/web-vue/es/icon';

const props = defineProps({
  status: {
    type: Object,
    required: true
  }
});

defineEmits([
  'close',
  'check',
  'skip',
  'download',
  'install'
]);

const currentVersionLabel = '\u5f53\u524d\u7248\u672c';
const availableVersionLabel = '\u65b0\u7248\u672c';
const skipLabel = '\u8df3\u8fc7\u672c\u6b21';
const retryLabel = '\u91cd\u65b0\u68c0\u67e5';
const downloadLabel = '\u5f00\u59cb\u66f4\u65b0';
const installLabel = '\u7acb\u5373\u91cd\u542f\u5b89\u88c5';
const releaseNotesTitle = '\u672c\u6b21\u66f4\u65b0';
const releaseHistoryTitle = '\u66f4\u65b0\u8bb0\u5f55';
const releaseHistoryDescription = '\u4fdd\u7559\u6700\u8fd1\u7248\u672c\u5185\u5bb9';
const progressBarColor = {
  '0%': 'var(--theme-primary-color, #d4a038)',
  '100%': 'var(--theme-primary-color-deep, var(--theme-primary-color, #d4a038))'
};
const progressTrackColor = 'rgba(var(--theme-primary-rgb, 212, 160, 56), 0.12)';

const title = computed(() => {
  if (props.status.phase === 'checking') {
    return '\u6b63\u5728\u68c0\u67e5\u66f4\u65b0';
  }

  if (props.status.phase === 'available') {
    return '\u53d1\u73b0\u65b0\u7248\u672c';
  }

  if (props.status.phase === 'downloading') {
    return '\u6b63\u5728\u4e0b\u8f7d\u66f4\u65b0';
  }

  if (props.status.phase === 'downloaded') {
    return '\u66f4\u65b0\u5df2\u51c6\u5907\u5b8c\u6210';
  }

  if (props.status.phase === 'error') {
    return '\u68c0\u67e5\u66f4\u65b0\u5931\u8d25';
  }

  return '\u5df2\u662f\u6700\u65b0\u7248\u672c';
});

const description = computed(() => {
  if (props.status.message) {
    return props.status.message;
  }

  if (props.status.phase === 'available') {
    return '\u53ef\u5148\u8df3\u8fc7\u672c\u6b21\uff0c\u4e5f\u53ef\u7acb\u5373\u4e0b\u8f7d\u5b89\u88c5';
  }

  if (props.status.phase === 'downloaded') {
    return '\u70b9\u51fb\u5b89\u88c5\u540e\u8f6f\u4ef6\u4f1a\u81ea\u52a8\u91cd\u542f';
  }

  if (props.status.phase === 'downloading') {
    return '\u4e0b\u8f7d\u8fc7\u7a0b\u53ef\u653e\u5230\u540e\u53f0';
  }

  return '\u6ca1\u6709\u53d1\u73b0\u9700\u8981\u5b89\u88c5\u7684\u65b0\u7248\u672c';
});

const releaseNotes = computed(() => String(props.status.releaseNotes || '').trim());
const releaseHistory = computed(() => Array.isArray(props.status.releaseHistory) ? props.status.releaseHistory : []);
const showReleaseNotes = computed(() => Boolean(releaseNotes.value) && [
  'available',
  'downloading',
  'downloaded'
].includes(props.status.phase));
const canRetry = computed(() => props.status.phase === 'error' || props.status.phase === 'not-available');
const canClose = computed(() => props.status.phase !== 'checking' && props.status.phase !== 'available');
const closeLabel = computed(() => (props.status.phase === 'downloading' ? '\u540e\u53f0\u4e0b\u8f7d' : '\u5173\u95ed'));
const progressPercent = computed(() => {
  const percent = Number(props.status.progress && props.status.progress.percent);

  if (!Number.isFinite(percent) || percent <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, percent / 100));
});
const progressPercentText = computed(() => `${Math.round(progressPercent.value * 100)}%`);
const progressText = computed(() => {
  const progress = props.status.progress || {};
  const total = Number(progress.total) || 0;
  const transferred = Number(progress.transferred) || 0;

  if (total <= 0) {
    return '\u6b63\u5728\u8ba1\u7b97\u6587\u4ef6\u5927\u5c0f';
  }

  return `${formatSize(transferred)} / ${formatSize(total)}`;
});
const speedText = computed(() => {
  const speed = Number(props.status.progress && props.status.progress.bytesPerSecond) || 0;

  return speed > 0 ? `${formatSize(speed)}/s` : '';
});

function formatSize(bytes) {
  const value = Number(bytes) || 0;

  if (value <= 0) {
    return '0 MB';
  }

  const mb = value / 1024 / 1024;

  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${(value / 1024).toFixed(0)} KB`;
}

function versionText(version) {
  const text = String(version || '').trim();

  return text.startsWith('v') ? text : `v${text}`;
}
</script>

<style scoped>
.main-update-dialog {
  display: grid;
  gap: 14px;
}

.main-update-version-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.main-update-version-card {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  background: #f8fafc;
}

.main-update-version-card span {
  color: #64748b;
  font-size: 12px;
}

.main-update-version-card strong {
  color: #132238;
  font-size: 18px;
  font-weight: 800;
}

.main-update-state {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 14px;
  border: 1px solid rgba(var(--theme-primary-rgb, 212, 160, 56), 0.18);
  border-radius: 14px;
  background: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.06);
}

.main-update-state.is-error {
  border-color: rgba(244, 63, 94, 0.2);
  background: rgba(244, 63, 94, 0.06);
}

.main-update-state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--theme-primary-ink, #7f5f20);
  background: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.12);
  font-size: 18px;
}

.main-update-state.is-error .main-update-state-icon {
  color: #be123c;
  background: rgba(244, 63, 94, 0.12);
}

.main-update-state strong,
.main-update-state span {
  display: block;
}

.main-update-state strong {
  color: #132238;
  font-size: 15px;
  font-weight: 800;
}

.main-update-state span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.main-update-progress {
  display: grid;
  gap: 8px;
}

.main-update-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
}

.main-update-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.main-update-section-head strong {
  color: #132238;
  font-size: 14px;
  font-weight: 800;
}

.main-update-section-head span {
  color: #64748b;
  font-size: 12px;
}

.main-update-notes-panel,
.main-update-history-panel {
  display: grid;
  gap: 8px;
}

.main-update-notes {
  max-height: 150px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  color: #334155;
  background: #f8fafc;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.main-update-history-list {
  display: grid;
  max-height: 220px;
  gap: 10px;
  overflow: auto;
}

.main-update-history-item {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  background: #f8fafc;
}

.main-update-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.main-update-history-head strong {
  color: #132238;
  font-size: 14px;
}

.main-update-history-head span,
.main-update-history-item p,
.main-update-history-item ul {
  margin: 0;
}

.main-update-history-head span {
  color: #64748b;
  font-size: 12px;
}

.main-update-history-item p {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.main-update-history-item ul {
  display: grid;
  gap: 4px;
  padding-left: 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.main-update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.main-update-actions :deep(.arco-btn) {
  border-radius: 10px;
  font-weight: 700;
}

.main-update-actions :deep(.arco-btn-primary) {
  border-color: rgba(var(--theme-primary-rgb, 212, 160, 56), 0.72);
  background: linear-gradient(180deg, var(--theme-primary-color, #d4a038), var(--theme-primary-color-deep, #a8771f));
  color: var(--theme-primary-contrast, #172233);
  box-shadow: 0 10px 20px rgba(var(--theme-primary-rgb, 212, 160, 56), 0.16);
}

body.dark-theme .main-update-version-card,
body.dark-theme .main-update-notes,
body.dark-theme .main-update-history-item {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.78);
}

body.dark-theme .main-update-version-card strong,
body.dark-theme .main-update-state strong,
body.dark-theme .main-update-section-head strong,
body.dark-theme .main-update-history-head strong {
  color: #e5eefc;
}

body.dark-theme .main-update-version-card span,
body.dark-theme .main-update-state span,
body.dark-theme .main-update-section-head span,
body.dark-theme .main-update-history-head span,
body.dark-theme .main-update-history-item ul {
  color: #94a3b8;
}

body.dark-theme .main-update-notes,
body.dark-theme .main-update-history-item p {
  color: #dbe7f5;
}
</style>
