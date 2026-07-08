<template>
  <main class="promotion-shell">
    <!-- 模块切换 Tab -->
    <section class="promotion-switch-panel" aria-label="Promotion Modules">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="promotion-switch-button"
        :class="{ 'is-active': activeTab === tab.key }"
        type="button"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </section>

    <!-- 内容面板 -->
    <section class="promotion-content-panel">
      <!-- 新建推广 -->
      <div v-if="activeTab === 'create'" class="promotion-module-panel">
        <CreatePanel />
      </div>

      <!-- 推广明细 -->
      <div v-else-if="activeTab === 'detail'" class="promotion-module-panel">
        <DetailPanel />
      </div>

      <!-- 推广监控 -->
      <div v-else-if="activeTab === 'monitor'" class="promotion-module-panel">
        <MonitorPanel
          :snapshot="monitorSnapshot"
          :config="monitorConfig"
          :selected-column-ids="selectedMonitorColumnIds"
          :active-filter="activeMonitorFilter"
          :visible-shops="visibleShops"
          :loading="monitorSnapshotLoading"
          @filter-change="handleFilterChange"
          @toggle-shop="handleToggleShop"
          @open-shop-config="openMonitorShopConfigModal"
          @toggle-batch="handleToggleBatch"
          @open-customize="openCustomizeModal"
          @config-change="handleConfigFieldChange"
          @region-change="handleRegionChange"
          @action-change="handleActionChange"
        />
      </div>

      <!-- 日志记录 -->
      <div v-else-if="activeTab === 'logs'" class="promotion-module-panel">
        <LogsPanel
          :entries="logEntries"
          :has-more="logHasMore"
          :loading="logLoading"
          @load-more="loadMoreLogs"
        />
      </div>
    </section>

    <!-- 通知 -->
    <transition name="notice-fade">
      <div
        v-if="noticeText"
        class="promotion-window-notice"
        role="status"
        aria-live="polite"
      >
        {{ noticeText }}
      </div>
    </transition>

    <!-- 自定义数据项 Modal -->
    <CustomizeModal
      v-model:visible="customizeModalVisible"
      :selected-column-ids="selectedMonitorColumnIds"
      @apply="handleCustomizeApply"
    />

    <!-- 店铺监控配置 Modal -->
    <ShopConfigModal
      v-model:visible="shopConfigModalVisible"
      :shop-config="shopConfigCurrentKey ? monitorSnapshot.shops[shopConfigCurrentKey]?.config : null"
      @save="handleShopConfigSave"
    />
  </main>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import {
  PROMOTION_MASTER_RUNTIME_LOG_EVENT_PREFIXES,
  ACTIVE_MONITOR_POLL_INTERVAL_MS,
  ACTIVE_RUNTIME_LOG_POLL_INTERVAL_MS,
  RUNTIME_LOG_PAGE_SIZE,
  DEFAULT_MONITOR_COLUMN_IDS
} from './constants.js';
import {
  loadPromotionManagerSettings, savePromotionManagerSettings,
  getPromotionMonitorSnapshot, setPromotionMonitorShopEnabled,
  setPromotionMonitorBatchActive, getRuntimeLogEntries
} from './bridge.js';

import CreatePanel from './panels/CreatePanel.vue';
import DetailPanel from './panels/DetailPanel.vue';
import MonitorPanel from './panels/MonitorPanel.vue';
import LogsPanel from './panels/LogsPanel.vue';
import CustomizeModal from './components/CustomizeModal.vue';
import ShopConfigModal from './components/ShopConfigModal.vue';

// ==================== Tab 状态 ====================
const tabs = [
  { key: 'create', label: '新建推广' },
  { key: 'detail', label: '推广明细' },
  { key: 'monitor', label: '推广监控' },
  { key: 'logs', label: '日志记录' }
];
const activeTab = ref('monitor');

// ==================== 监控数据 ====================
const visibleShops = ref([]);
const monitorSnapshot = reactive({
  updatedAt: '',
  batchMonitoringActive: false,
  enabledShopIds: [],
  shops: {}
});
const monitorSnapshotLoading = ref(false);
let monitorSnapshotPollTimer = 0;

// ==================== 监控配置 ====================
const monitorConfig = reactive({
  monitorIntervalSeconds: '60',
  dailyOperationLimit: '',
  totalOperationLimit: '',
  autoPauseSpendThreshold: '',
  autoPauseRoasThreshold: '',
  conditionMaxRoas: '',
  minOrderCount: '1',
  regionIds: ['us', 'eu', 'global'],
  actionType: 'pause_plan',
  resumeIntervalMinutes: '',
  targetRoas: ''
});

const activeMonitorFilter = ref('all');
const selectedMonitorColumnIds = ref([...DEFAULT_MONITOR_COLUMN_IDS]);

// ==================== 自定义数据项 Modal ====================
const customizeModalVisible = ref(false);
function openCustomizeModal() {
  customizeModalVisible.value = true;
}
function handleCustomizeApply(newIds) {
  selectedMonitorColumnIds.value = [...newIds];
  showNotice('数据项已更新并同步到云端。');
  persistSettings();
}

// ==================== 店铺配置 Modal ====================
const shopConfigModalVisible = ref(false);
const shopConfigCurrentKey = ref('');

function openMonitorShopConfigModal(shopId) {
  shopConfigCurrentKey.value = shopId;
  shopConfigModalVisible.value = true;
}

async function handleShopConfigSave() {
  showNotice('店铺监控配置已保存。');
  await persistSettings();
}

// ==================== 日志 ====================
const logEntries = ref([]);
const logHasMore = ref(true);
const logLoading = ref(false);
let logOffset = 0;
let runtimeLogPollTimer = 0;

async function loadRuntimeLogs(reset = false) {
  if (logLoading.value) return;
  logLoading.value = true;

  if (reset) {
    logOffset = 0;
    logEntries.value = [];
    logHasMore.value = true;
  }

  try {
    const result = await getRuntimeLogEntries({
      eventPrefixes: PROMOTION_MASTER_RUNTIME_LOG_EVENT_PREFIXES,
      offset: logOffset,
      limit: RUNTIME_LOG_PAGE_SIZE
    });

    if (result && result.entries) {
      if (reset) {
        logEntries.value = result.entries;
      } else {
        logEntries.value = [...logEntries.value, ...result.entries];
      }
      logOffset = logEntries.value.length;
      logHasMore.value = result.hasMore !== false && result.entries.length >= RUNTIME_LOG_PAGE_SIZE;
    }
  } catch (e) {
    // 静默处理
  } finally {
    logLoading.value = false;
  }
}

function loadMoreLogs() {
  loadRuntimeLogs(false);
}

// ==================== 监控数据加载 ====================
async function loadMonitorSnapshot() {
  if (monitorSnapshotLoading.value) return;
  monitorSnapshotLoading.value = true;
  try {
    const snapshot = await getPromotionMonitorSnapshot();
    if (snapshot) {
      Object.assign(monitorSnapshot, {
        updatedAt: snapshot.updatedAt || '',
        batchMonitoringActive: snapshot.batchMonitoringActive || false,
        enabledShopIds: snapshot.enabledShopIds || [],
        shops: snapshot.shops || {}
      });
    }
  } catch (e) {
    // 静默处理
  } finally {
    monitorSnapshotLoading.value = false;
  }
}

// ==================== 设置管理 ====================
let settingsLoaded = false;

async function loadSettings() {
  try {
    const settings = await loadPromotionManagerSettings();
    if (settings) {
      if (settings.monitorView && settings.monitorView.columnIds) {
        selectedMonitorColumnIds.value = settings.monitorView.columnIds;
      }
      if (settings.monitorConfig) {
        Object.assign(monitorConfig, settings.monitorConfig);
      }
    }
    settingsLoaded = true;
  } catch (e) {
    settingsLoaded = true;
  }
}

async function persistSettings() {
  if (!settingsLoaded) return;
  try {
    await savePromotionManagerSettings({
      monitorView: { columnIds: selectedMonitorColumnIds.value },
      monitorConfig: { ...monitorConfig }
    });
  } catch (e) {
    showNotice('设置同步失败：' + (e.message || ''));
  }
}

// ==================== 事件处理 ====================
function handleFilterChange(filterId) {
  activeMonitorFilter.value = filterId;
}

async function handleToggleShop(shopId) {
  const shop = monitorSnapshot.shops[shopId];
  if (!shop) return;
  try {
    await setPromotionMonitorShopEnabled(shopId, !shop.enabled);
    await loadMonitorSnapshot();
  } catch (e) {
    showNotice('操作失败：' + (e.message || ''));
  }
}

async function handleToggleBatch() {
  try {
    await setPromotionMonitorBatchActive(!monitorSnapshot.batchMonitoringActive);
    await loadMonitorSnapshot();
  } catch (e) {
    showNotice('操作失败：' + (e.message || ''));
  }
}

function handleConfigFieldChange(field, value) {
  if (field in monitorConfig) {
    monitorConfig[field] = value;
    persistSettings();
  }
}

function handleRegionChange(regionId, checked) {
  if (checked) {
    if (!monitorConfig.regionIds.includes(regionId)) {
      monitorConfig.regionIds = [...monitorConfig.regionIds, regionId];
    }
  } else {
    monitorConfig.regionIds = monitorConfig.regionIds.filter(id => id !== regionId);
  }
  persistSettings();
}

function handleActionChange(actionType) {
  monitorConfig.actionType = actionType;
  persistSettings();
}

// ==================== 通知 ====================
const noticeText = ref('');
let noticeTimer = 0;

function showNotice(text, durationMs = 3000) {
  noticeText.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    noticeText.value = '';
  }, durationMs);
}

// ==================== 轮询 ====================
function startPolling() {
  stopPolling();

  if (activeTab.value === 'monitor') {
    loadMonitorSnapshot();
    monitorSnapshotPollTimer = window.setInterval(() => {
      if (activeTab.value === 'monitor') {
        loadMonitorSnapshot();
      }
    }, ACTIVE_MONITOR_POLL_INTERVAL_MS);
  }

  if (activeTab.value === 'logs') {
    loadRuntimeLogs(true);
    runtimeLogPollTimer = window.setInterval(() => {
      if (activeTab.value === 'logs') {
        loadRuntimeLogs(true);
      }
    }, ACTIVE_RUNTIME_LOG_POLL_INTERVAL_MS);
  }
}

function stopPolling() {
  if (monitorSnapshotPollTimer) {
    clearInterval(monitorSnapshotPollTimer);
    monitorSnapshotPollTimer = 0;
  }
  if (runtimeLogPollTimer) {
    clearInterval(runtimeLogPollTimer);
    runtimeLogPollTimer = 0;
  }
}

watch(activeTab, () => {
  startPolling();
});

// ==================== 生命周期 ====================
onMounted(async () => {
  await loadSettings();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style>
/* ==================== Shell ==================== */
.promotion-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: start;
  justify-items: stretch;
  height: 100vh;
  min-height: 100vh;
  padding: 18px;
  gap: 18px;
  font-family: "Bahnschrift", "Aptos", "Microsoft YaHei UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(58, 96, 148, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(201, 145, 59, 0.12), transparent 24%),
    linear-gradient(180deg, #f4f7fb 0%, #e7edf6 100%);
  color: #132238;
}

* { box-sizing: border-box; }

/* ==================== Switch Panel ==================== */
.promotion-switch-panel {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  width: 100%;
  padding: 16px;
  border-radius: 28px;
  border: 1px solid rgba(19, 34, 56, 0.1);
  background: rgba(248, 251, 255, 0.88);
  box-shadow: 0 22px 56px rgba(18, 34, 57, 0.1);
}

.promotion-switch-button {
  flex: 0 0 auto;
  min-width: 148px;
  border: 1px solid rgba(30, 53, 84, 0.12);
  border-radius: 18px;
  padding: 18px 24px;
  background: rgba(255, 255, 255, 0.92);
  color: #30465f;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}

.promotion-switch-button:hover {
  transform: translateY(-1px);
  border-color: rgba(174, 113, 43, 0.36);
  box-shadow: 0 14px 30px rgba(18, 34, 57, 0.1);
}

.promotion-switch-button.is-active {
  border-color: rgba(150, 96, 30, 0.34);
  background: linear-gradient(135deg, #c98a32, #915b16);
  color: #ffffff;
  box-shadow: 0 18px 36px rgba(145, 91, 22, 0.24);
}

/* ==================== Content Panel ==================== */
.promotion-content-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 24px;
  border-radius: 30px;
  border: 1px solid rgba(19, 34, 56, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(243, 247, 252, 0.98)),
    rgba(255, 255, 255, 0.92);
  box-shadow: 0 22px 56px rgba(18, 34, 57, 0.1);
}

.promotion-module-panel {
  display: grid;
  grid-template-rows: auto auto auto;
  align-content: start;
  gap: 18px;
  min-height: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
}

/* ==================== Panel Shared Styles ==================== */
.pm-panel {
  display: grid;
  gap: 18px;
}

.pm-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.pm-panel-copy {
  display: grid;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.pm-panel-eyebrow {
  margin: 0;
  color: #8c6124;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.pm-panel-title {
  margin: 0;
  color: #132238;
  font-size: clamp(28px, 3vw, 36px);
  line-height: 1.08;
}

.pm-panel-text {
  margin: 0;
  max-width: 760px;
  color: #51657d;
  font-size: 15px;
  line-height: 1.7;
}

/* ==================== Static Table ==================== */
.pm-static-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  overflow: hidden;
}

.pm-static-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  white-space: nowrap;
}

.pm-static-table td {
  padding: 11px 16px;
  font-size: 13px;
  color: #132238;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  white-space: nowrap;
}

.pm-static-table tr:last-child td {
  border-bottom: none;
}

.pm-static-table tr:hover td {
  background: rgba(59, 130, 246, 0.03);
}

/* ==================== Footer Note ==================== */
.pm-module-footer-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.04);
  border-radius: 8px;
  font-size: 12px;
  color: #64748b;
}

.pm-icon-inline {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ==================== Modal Overlay ==================== */
.pm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(4px);
}

.pm-modal {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 56px rgba(18, 34, 57, 0.22);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pm-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.pm-modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #132238;
}

.pm-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
}

.pm-modal-close:hover {
  background: rgba(148, 163, 184, 0.08);
  color: #132238;
}

.pm-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

/* ==================== Buttons ==================== */
.pm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  outline: none;
}

.pm-btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.2);
}

.pm-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.28);
}

.pm-btn-secondary {
  background: rgba(148, 163, 184, 0.08);
  color: #475569;
  border-color: rgba(148, 163, 184, 0.16);
}

.pm-btn-secondary:hover {
  background: rgba(148, 163, 184, 0.14);
}

.pm-btn-text {
  background: transparent;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
}

.pm-btn-text:hover {
  background: rgba(59, 130, 246, 0.08);
}

.pm-text-btn {
  background: transparent;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
}

.pm-text-btn:hover {
  background: rgba(59, 130, 246, 0.08);
}

/* ==================== Tag Button ==================== */
.pm-tag-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.92);
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.pm-tag-btn:hover {
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.pm-tag-btn.is-active {
  border-color: rgba(59, 130, 246, 0.32);
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

/* ==================== Notice ==================== */
.promotion-window-notice {
  position: fixed;
  top: 20px;
  right: 24px;
  z-index: 9999;
  min-width: 240px;
  max-width: min(420px, calc(100vw - 32px));
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(22, 36, 58, 0.96);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  box-shadow: 0 18px 36px rgba(10, 22, 38, 0.22);
  pointer-events: none;
}

.notice-fade-enter-active,
.notice-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.notice-fade-enter-from,
.notice-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .pm-modal {
  animation: modal-slide-in 0.2s ease;
}

@keyframes modal-slide-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ==================== Dark Theme ==================== */
body.dark-theme .promotion-shell {
  background:
    radial-gradient(circle at top left, rgba(58, 96, 148, 0.12), transparent 28%),
    radial-gradient(circle at top right, rgba(201, 145, 59, 0.08), transparent 24%),
    linear-gradient(180deg, #0f172a 0%, #1a2332 100%);
  color: #e5eefc;
}

body.dark-theme .promotion-switch-panel {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.1);
}

body.dark-theme .promotion-switch-button {
  background: rgba(30, 41, 59, 0.92);
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .promotion-switch-button:hover {
  border-color: rgba(201, 138, 50, 0.3);
  color: #d4a24c;
}

body.dark-theme .promotion-switch-button.is-active {
  background: linear-gradient(135deg, #c98a32, #915b16);
  color: #ffffff;
}

body.dark-theme .promotion-content-panel {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(20, 30, 48, 0.94)),
    rgba(15, 23, 42, 0.92);
  border-color: rgba(148, 163, 184, 0.1);
}

body.dark-theme .pm-panel-eyebrow {
  color: #d4a24c;
}

body.dark-theme .pm-panel-title {
  color: #e5eefc;
}

body.dark-theme .pm-panel-text {
  color: #94a3b8;
}

body.dark-theme .pm-static-table {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .pm-static-table th {
  background: rgba(15, 23, 42, 0.4);
  color: #94a3b8;
}

body.dark-theme .pm-static-table td {
  color: #e5eefc;
}

body.dark-theme .pm-static-table tr:hover td {
  background: rgba(59, 130, 246, 0.06);
}

body.dark-theme .pm-module-footer-note {
  background: rgba(59, 130, 246, 0.06);
  color: #94a3b8;
}

body.dark-theme .pm-modal {
  background: #1e293b;
}

body.dark-theme .pm-modal-title {
  color: #e5eefc;
}

body.dark-theme .pm-modal-header {
  border-bottom-color: rgba(148, 163, 184, 0.12);
}

body.dark-theme .pm-modal-footer {
  border-top-color: rgba(148, 163, 184, 0.1);
}

body.dark-theme .pm-modal-close {
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .pm-modal-close:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #e5eefc;
}

body.dark-theme .pm-modal-overlay {
  background: rgba(5, 10, 20, 0.62);
}

body.dark-theme .pm-alert-info {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.18);
}

body.dark-theme .pm-btn-secondary {
  background: rgba(148, 163, 184, 0.08);
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.16);
}

body.dark-theme .pm-btn-secondary:hover {
  background: rgba(148, 163, 184, 0.16);
}

body.dark-theme .pm-tag-btn {
  background: rgba(30, 41, 59, 0.88);
  border-color: rgba(148, 163, 184, 0.16);
  color: #94a3b8;
}

body.dark-theme .pm-tag-btn:hover {
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

body.dark-theme .pm-tag-btn.is-active {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(59, 130, 246, 0.32);
  color: #60a5fa;
}

body.dark-theme .pm-btn-text {
  color: #60a5fa;
}

body.dark-theme .pm-btn-text:hover {
  background: rgba(59, 130, 246, 0.1);
}
</style>
