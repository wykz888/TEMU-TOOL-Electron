<template>
  <div class="pm-panel">
    <div class="pm-panel-head">
      <div class="pm-panel-copy">
        <p class="pm-panel-eyebrow">推广大师</p>
        <h1 class="pm-panel-title">日志记录</h1>
        <p class="pm-panel-text">查看推广大师相关运行时日志，每页 {{ pageSize }} 条。</p>
      </div>
    </div>

    <div v-if="entries.length === 0 && !loading" class="pm-logs-empty">
      <svg class="pm-icon-empty" viewBox="0 0 48 48" fill="none" stroke="#94a3b8" stroke-width="1.5">
        <rect x="12" y="8" width="24" height="32" rx="3"/>
        <line x1="16" y1="16" x2="32" y2="16"/>
        <line x1="16" y1="22" x2="28" y2="22"/>
        <line x1="16" y1="28" x2="24" y2="28"/>
      </svg>
      <p>暂无日志记录</p>
    </div>

    <div v-else class="pm-logs-list" ref="logsListRef" @scroll="handleScroll">
      <div
        v-for="(entry, idx) in entries"
        :key="idx"
        class="pm-log-entry"
      >
        <div class="pm-log-entry-time">{{ formatTime(entry.timestamp) }}</div>
        <div class="pm-log-entry-event">{{ entry.event || entry.prefix }}{{ entry.suffix ? '_' + entry.suffix : '' }}</div>
        <div class="pm-log-entry-message">{{ entry.message || entry.detail || '-' }}</div>
      </div>

      <div v-if="loading" class="pm-logs-loading">
        <span class="pm-spinner"></span>
        <span>加载中...</span>
      </div>

      <div v-if="!hasMore && entries.length > 0" class="pm-logs-end">
        已加载全部日志
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { RUNTIME_LOG_PAGE_SIZE } from '../constants.js';

const props = defineProps({
  entries: { type: Array, default: () => [] },
  hasMore: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['load-more']);

const pageSize = RUNTIME_LOG_PAGE_SIZE;
const logsListRef = ref(null);

function formatTime(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return String(ts);
  }
}

function handleScroll() {
  const el = logsListRef.value;
  if (!el || !props.hasMore || props.loading) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) {
    emit('load-more');
  }
}
</script>

<style scoped>
.pm-logs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: #94a3b8;
  font-size: 13px;
}

.pm-icon-empty {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.pm-logs-list {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  scroll-behavior: smooth;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255,255,255,0.92);
}

.pm-log-entry {
  display: grid;
  grid-template-columns: 140px 200px 1fr;
  gap: 12px;
  padding: 10px 14px;
  font-size: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
}

.pm-log-entry:hover {
  background: rgba(59, 130, 246, 0.03);
}

.pm-log-entry-time {
  color: #94a3b8;
  white-space: nowrap;
}

.pm-log-entry-event {
  color: #3b82f6;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pm-log-entry-message {
  color: #475569;
  word-break: break-word;
}

.pm-logs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #94a3b8;
  font-size: 12px;
}

.pm-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(59,130,246,0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: pm-spin 0.6s linear infinite;
}

@keyframes pm-spin {
  to { transform: rotate(360deg); }
}

.pm-logs-end {
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 12px;
}

body.dark-theme .pm-logs-list {
  background: rgba(15,23,42,0.88);
  border-color: rgba(148,163,184,0.1);
}

body.dark-theme .pm-log-entry:hover {
  background: rgba(59, 130, 246, 0.06);
}

body.dark-theme .pm-log-entry-time {
  color: #64748b;
}

body.dark-theme .pm-log-entry-event {
  color: #60a5fa;
}

body.dark-theme .pm-log-entry-message {
  color: #94a3b8;
}
</style>
