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
    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="customizeModalVisible" class="pm-modal-overlay" @click.self="cancelCustomize">
          <div class="pm-modal" style="width: 960px;">
            <div class="pm-modal-header">
              <h2 class="pm-modal-title">自定义数据项</h2>
              <button class="pm-modal-close" @click="cancelCustomize">&times;</button>
            </div>

            <div class="customize-modal-body">
              <!-- 左侧：可选数据项 -->
              <div class="customize-panel is-available">
                <div class="customize-panel-head">
                  <h3>可选数据项</h3>
                  <p>支持按组、按口径快速选择</p>
                </div>

                <label class="customize-check-row is-master">
                  <input
                    type="checkbox"
                    :checked="isAllColumnsSelected"
                    :indeterminate.prop="isCustomizeIndeterminate"
                    @change="toggleSelectAllColumns($event.target.checked)"
                  />
                  <span>全选</span>
                </label>

                <div class="customize-quick-filters">
                  <p class="customize-quick-title">快速筛选</p>
                  <div class="customize-quick-list">
                    <button
                      v-for="qf in quickFilters"
                      :key="qf.id"
                      class="pm-tag-btn"
                      :class="{ 'is-active': customizeQuickFilter === qf.id }"
                      @click="customizeQuickFilter = (customizeQuickFilter === qf.id ? '' : qf.id)"
                    >
                      {{ qf.label }}
                    </button>
                  </div>
                </div>

                <div class="customize-group-list">
                  <template v-for="group in filteredColumnGroups" :key="group.id">
                    <label class="customize-check-row">
                      <input
                        type="checkbox"
                        :checked="isGroupFullyChecked(group)"
                        :indeterminate.prop="isGroupPartiallyChecked(group)"
                        @change="toggleGroupColumns(group)"
                      />
                      <span>{{ group.label }}</span>
                    </label>
                    <template v-if="isGroupExpanded(group)">
                      <label
                        v-for="col in getGroupColumns(group)"
                        :key="col.id"
                        class="customize-check-row is-child"
                      >
                        <input
                          type="checkbox"
                          :checked="customizeDraftColumnIds.includes(col.id)"
                          @change="toggleColumn(col.id)"
                        />
                        <span>{{ col.fullLabel || col.shortLabel }}</span>
                      </label>
                    </template>
                  </template>
                </div>
              </div>

              <!-- 右侧：已选数据项 -->
              <div class="customize-panel is-selected">
                <div class="customize-panel-head">
                  <div>
                    <h3>已选择 {{ customizeDraftColumnIds.length }} 项</h3>
                    <p>当前将应用的分组与子列组合</p>
                  </div>
                  <div class="customize-link-actions">
                    <button class="pm-text-btn" @click="clearAllCustomColumns">全部移除</button>
                    <button class="pm-text-btn" @click="resetCustomColumns">重置</button>
                  </div>
                </div>

                <div class="customize-selected-list">
                  <div
                    v-for="colId in customizeDraftColumnIds"
                    :key="colId"
                    class="customize-selected-item"
                  >
                    <span>{{ getColumnLabel(colId) }}</span>
                    <button class="pm-close-btn" @click="toggleColumn(colId)">&times;</button>
                  </div>
                  <div v-if="customizeDraftColumnIds.length === 0" class="customize-empty">
                    <p>暂未选择数据项</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="pm-modal-footer">
              <button class="pm-btn pm-btn-secondary" @click="cancelCustomize">取消</button>
              <button class="pm-btn pm-btn-primary" @click="applyCustomizeColumns">应用</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- 店铺监控配置 Modal -->
    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="shopConfigModalVisible" class="pm-modal-overlay" @click.self="cancelShopConfig">
          <div class="pm-modal" style="width: 580px;">
            <div class="pm-modal-header">
              <h2 class="pm-modal-title">店铺监控配置</h2>
              <button class="pm-modal-close" @click="cancelShopConfig">&times;</button>
            </div>

            <div class="shop-config-body">
              <div v-if="shopConfigFollowsGlobal" class="pm-alert-info">
                当前店铺默认跟随全局监控配置。
              </div>

              <div class="shop-config-form">
                <div class="config-field">
                  <label>监控间隔（秒）</label>
                  <input
                    type="number"
                    class="pm-config-input-full"
                    v-model.number="shopConfigDraft.monitorIntervalSeconds"
                    :min="5"
                  />
                </div>
                <div class="config-field">
                  <label>每日操作上限</label>
                  <input
                    type="number"
                    class="pm-config-input-full"
                    v-model.number="shopConfigDraft.dailyOperationLimit"
                    :min="0"
                    placeholder="留空不限制"
                  />
                </div>
                <div class="config-field">
                  <label>总操作上限</label>
                  <input
                    type="number"
                    class="pm-config-input-full"
                    v-model.number="shopConfigDraft.totalOperationLimit"
                    :min="0"
                    placeholder="留空不限制"
                  />
                </div>
                <div class="config-field">
                  <label>花费暂停阈值</label>
                  <input
                    type="number"
                    class="pm-config-input-full"
                    v-model.number="shopConfigDraft.autoPauseSpendThreshold"
                    :min="0"
                    placeholder="留空不限制"
                  />
                </div>
                <div class="config-field">
                  <label>ROAS 暂停阈值</label>
                  <input
                    type="number"
                    class="pm-config-input-full"
                    v-model.number="shopConfigDraft.autoPauseRoasThreshold"
                    :min="0"
                    placeholder="留空不限制"
                  />
                </div>
              </div>
            </div>

            <div class="pm-modal-footer">
              <button class="pm-btn pm-btn-text" @click="resetShopConfig">恢复全局</button>
              <button class="pm-btn pm-btn-secondary" @click="cancelShopConfig">取消</button>
              <button class="pm-btn pm-btn-primary" @click="saveShopConfig">保存店铺配置</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </main>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  MONITOR_FILTERS, CUSTOMIZE_QUICK_FILTERS, MONITOR_COLUMN_GROUPS,
  DEFAULT_MONITOR_COLUMN_IDS,
  PROMOTION_MASTER_RUNTIME_LOG_EVENT_PREFIXES,
  ACTIVE_MONITOR_POLL_INTERVAL_MS, ACTIVE_RUNTIME_LOG_POLL_INTERVAL_MS,
  RUNTIME_LOG_PAGE_SIZE, DEFAULT_MONITOR_INTERVAL_SECONDS
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
const loadError = ref('');
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
  monitorIntervalSeconds: String(DEFAULT_MONITOR_INTERVAL_SECONDS),
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
const customizeDraftColumnIds = ref([...DEFAULT_MONITOR_COLUMN_IDS]);
const customizeQuickFilter = ref('');
const quickFilters = CUSTOMIZE_QUICK_FILTERS;

const filteredColumnGroups = computed(() => {
  if (!customizeQuickFilter.value) return MONITOR_COLUMN_GROUPS;
  const qfId = customizeQuickFilter.value;
  return MONITOR_COLUMN_GROUPS.filter(g =>
    g.columns.some(c => c.tags.includes(qfId))
  );
});

const allFlatColumnIds = computed(() =>
  MONITOR_COLUMN_GROUPS.flatMap(g => g.columns.map(c => c.id))
);

const isAllColumnsSelected = computed(() =>
  customizeDraftColumnIds.value.length === allFlatColumnIds.value.length
);

const isCustomizeIndeterminate = computed(() =>
  customizeDraftColumnIds.value.length > 0 && !isAllColumnsSelected.value
);

function getGroupColumns(group) {
  return group.columns;
}

function isGroupExpanded(group) {
  return group.columns.some(c => customizeDraftColumnIds.value.includes(c.id)) || customizeQuickFilter.value;
}

function isGroupFullyChecked(group) {
  return group.columns.every(c => customizeDraftColumnIds.value.includes(c.id));
}

function isGroupPartiallyChecked(group) {
  const someChecked = group.columns.some(c => customizeDraftColumnIds.value.includes(c.id));
  return someChecked && !isGroupFullyChecked(group);
}

function toggleSelectAllColumns(checked) {
  if (checked) {
    customizeDraftColumnIds.value = [...allFlatColumnIds.value];
  } else {
    customizeDraftColumnIds.value = [];
  }
}

function toggleGroupColumns(group) {
  const groupColIds = group.columns.map(c => c.id);
  const allChecked = groupColIds.every(id => customizeDraftColumnIds.value.includes(id));
  if (allChecked) {
    customizeDraftColumnIds.value = customizeDraftColumnIds.value.filter(
      id => !groupColIds.includes(id)
    );
  } else {
    const newIds = groupColIds.filter(id => !customizeDraftColumnIds.value.includes(id));
    customizeDraftColumnIds.value = [...customizeDraftColumnIds.value, ...newIds];
  }
}

function toggleColumn(colId) {
  const idx = customizeDraftColumnIds.value.indexOf(colId);
  if (idx >= 0) {
    customizeDraftColumnIds.value = customizeDraftColumnIds.value.filter(id => id !== colId);
  } else {
    customizeDraftColumnIds.value = [...customizeDraftColumnIds.value, colId];
  }
}

function getColumnLabel(colId) {
  for (const group of MONITOR_COLUMN_GROUPS) {
    const col = group.columns.find(c => c.id === colId);
    if (col) return col.fullLabel || col.shortLabel;
  }
  return colId;
}

function openCustomizeModal() {
  customizeDraftColumnIds.value = [...selectedMonitorColumnIds.value];
  customizeQuickFilter.value = '';
  customizeModalVisible.value = true;
}

function applyCustomizeColumns() {
  selectedMonitorColumnIds.value = [...customizeDraftColumnIds.value];
  customizeModalVisible.value = false;
  showNotice('数据项已更新并同步到云端。');
  persistSettings();
}

function cancelCustomize() {
  customizeDraftColumnIds.value = [...selectedMonitorColumnIds.value];
  customizeModalVisible.value = false;
}

function clearAllCustomColumns() {
  customizeDraftColumnIds.value = [];
}

function resetCustomColumns() {
  customizeDraftColumnIds.value = [...DEFAULT_MONITOR_COLUMN_IDS];
}

// ==================== 店铺配置 Modal ====================
const shopConfigModalVisible = ref(false);
const shopConfigCurrentKey = ref('');
const shopConfigFollowsGlobal = ref(true);
const shopConfigDraft = reactive({
  monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
  dailyOperationLimit: '',
  totalOperationLimit: '',
  autoPauseSpendThreshold: '',
  autoPauseRoasThreshold: ''
});

function openMonitorShopConfigModal(shopId) {
  shopConfigCurrentKey.value = shopId;
  const shopConfig = monitorSnapshot.shops[shopId]?.config;
  if (shopConfig) {
    shopConfigFollowsGlobal.value = false;
    Object.assign(shopConfigDraft, {
      monitorIntervalSeconds: shopConfig.monitorIntervalSeconds || DEFAULT_MONITOR_INTERVAL_SECONDS,
      dailyOperationLimit: shopConfig.dailyOperationLimit || '',
      totalOperationLimit: shopConfig.totalOperationLimit || '',
      autoPauseSpendThreshold: shopConfig.autoPauseSpendThreshold || '',
      autoPauseRoasThreshold: shopConfig.autoPauseRoasThreshold || ''
    });
  } else {
    shopConfigFollowsGlobal.value = true;
    Object.assign(shopConfigDraft, {
      monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
      dailyOperationLimit: '',
      totalOperationLimit: '',
      autoPauseSpendThreshold: '',
      autoPauseRoasThreshold: ''
    });
  }
  shopConfigModalVisible.value = true;
}

async function saveShopConfig() {
  shopConfigModalVisible.value = false;
  showNotice('店铺监控配置已保存。');
  await persistSettings();
}

function cancelShopConfig() {
  shopConfigModalVisible.value = false;
}

function resetShopConfig() {
  shopConfigFollowsGlobal.value = true;
  Object.assign(shopConfigDraft, {
    monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
    dailyOperationLimit: '',
    totalOperationLimit: '',
    autoPauseSpendThreshold: '',
    autoPauseRoasThreshold: ''
  });
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
    loadError.value = '监控数据加载失败：' + (e.message || '');
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

/* ==================== Customize Modal ==================== */
.customize-modal-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 420px;
  padding: 16px 24px;
  overflow-y: auto;
}

.customize-panel {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  overflow-y: auto;
  max-height: 460px;
}

.customize-panel.is-selected {
  background: #ffffff;
  border-color: rgba(59, 130, 246, 0.2);
}

.customize-panel-head h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  color: #132238;
}

.customize-panel-head p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 12px;
}

.customize-panel.is-selected .customize-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.customize-link-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.customize-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  user-select: none;
}

.customize-check-row:hover {
  background: rgba(59, 130, 246, 0.06);
}

.customize-check-row input[type="checkbox"] {
  margin: 0;
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.customize-check-row.is-master {
  font-weight: 600;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  padding-bottom: 10px;
  margin-bottom: 4px;
}

.customize-check-row.is-child {
  padding-left: 32px;
  font-size: 12px;
  color: #475569;
}

.customize-quick-filters {
  margin-bottom: 8px;
}

.customize-quick-title {
  font-size: 11px;
  color: #94a3b8;
  margin: 0 0 6px;
}

.customize-quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.customize-group-list {
  margin-top: 4px;
}

.customize-selected-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customize-selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(59, 130, 246, 0.06);
  border-radius: 6px;
  font-size: 13px;
  color: #132238;
}

.pm-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}

.pm-close-btn:hover {
  background: rgba(148, 163, 184, 0.16);
  color: #475569;
}

.customize-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 13px;
}

/* ==================== Shop Config Modal ==================== */
.shop-config-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
}

.pm-alert-info {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgba(59, 130, 246, 0.14);
}

.shop-config-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-field label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.pm-config-input-full {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(39, 61, 89, 0.14);
  border-radius: 8px;
  background: rgba(244, 247, 251, 0.96);
  color: #18304a;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.pm-config-input-full:focus {
  border-color: rgba(33, 96, 173, 0.46);
  box-shadow: 0 0 0 3px rgba(33, 96, 173, 0.12);
  background: rgba(255, 255, 255, 0.98);
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

body.dark-theme .customize-panel {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .customize-panel.is-selected {
  background: rgba(20, 30, 48, 0.94);
  border-color: rgba(59, 130, 246, 0.24);
}

body.dark-theme .customize-panel-head h3 {
  color: #e5eefc;
}

body.dark-theme .customize-selected-item {
  background: rgba(59, 130, 246, 0.08);
  color: #e5eefc;
}

body.dark-theme .customize-check-row.is-child {
  color: #94a3b8;
}

body.dark-theme .pm-alert-info {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.18);
}

body.dark-theme .pm-config-input-full {
  background: rgba(30, 41, 59, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
  color: #e5eefc;
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
