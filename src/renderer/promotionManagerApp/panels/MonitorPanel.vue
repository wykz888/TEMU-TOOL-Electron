<template>
  <div class="pm-monitor">
    <!-- Header -->
    <div class="pm-panel-head">
      <div class="pm-panel-copy">
        <p class="pm-panel-eyebrow">推广大师</p>
        <h1 class="pm-panel-title">推广监控</h1>
        <p class="pm-panel-text">实时查看多店铺推广数据，配置自动操作策略。</p>
      </div>
      <div class="pm-panel-badge">
        {{ snapshot.enabledShopIds?.length || 0 }} 个店铺监控中
      </div>
      <div class="pm-primary-actions">
        <button
          class="pm-primary-action-button"
          :class="snapshot.batchMonitoringActive ? 'is-solid is-danger' : 'is-soft'"
          @click="$emit('toggle-batch')"
        >
          {{ snapshot.batchMonitoringActive ? '批量已开启' : '批量监控' }}
        </button>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="pm-filter-bar">
      <button
        v-for="f in filterOptions"
        :key="f.id"
        class="pm-filter-button"
        :class="{ 'is-active': activeFilter === f.id }"
        @click="$emit('filter-change', f.id)"
      >
        {{ f.label }}
      </button>
      <div class="pm-toolbar-actions">
        <button class="pm-icon-button" title="自定义数据项" @click="$emit('open-customize')">
          <svg class="pm-icon-button-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="pm-list-shell is-monitor">
      <div v-if="loading" class="pm-table-loading">
        <span class="pm-spinner"></span>
        <span>加载监控数据...</span>
      </div>

      <table v-if="tableData.length > 0" class="pm-monitor-table">
        <thead>
          <tr>
            <th v-for="bc in MONITOR_BASE_COLUMNS" :key="bc.id" :style="{ minWidth: bc.width + 'px', width: bc.width + 'px' }">
              {{ bc.label }}
            </th>
            <th
              v-for="col in allVisibleColumns"
              :key="col.id"
              :style="{ minWidth: '120px', width: '120px' }"
              :class="'theme-' + (col.theme || 'slate')"
            >
              {{ col.shortLabel || col.fullLabel }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.shopId">
            <!-- 监控状态 -->
            <td :style="{ minWidth: '140px', width: '140px' }">
              <div class="pm-status-cell">
                <label class="pm-switch">
                  <input
                    type="checkbox"
                    :checked="row.enabled"
                    @change="() => $emit('toggle-shop', row.shopId)"
                  />
                  <span class="pm-switch-slider"></span>
                </label>
                <span v-if="row.enabled" class="pm-status-tag" :class="{ 'is-running': row.status === 'running' }">
                  {{ row.statusText || '运行中' }}
                </span>
                <span v-else class="pm-status-tag is-disabled">已停用</span>
              </div>
            </td>
            <!-- 日志 -->
            <td :style="{ minWidth: '220px', width: '220px' }">
              <div class="pm-log-cell">
                <span class="pm-log-text">{{ row.lastLog || '-' }}</span>
                <button
                  v-if="row.shopId"
                  class="pm-icon-btn-small"
                  title="店铺配置"
                  @click="$emit('open-shop-config', row.shopId)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            </td>
            <!-- 店铺名称 -->
            <td :style="{ minWidth: '190px', width: '190px' }" :title="row.shopName || row.shopId">
              {{ row.shopName || row.shopId || '-' }}
            </td>
            <!-- 分组 -->
            <td :style="{ minWidth: '140px', width: '140px' }" :title="row.shopGroup">
              {{ row.shopGroup || '-' }}
            </td>
            <!-- 备注 -->
            <td :style="{ minWidth: '160px', width: '160px' }" :title="row.shopNote">
              {{ row.shopNote || '-' }}
            </td>
            <!-- 动态数据列 -->
            <td
              v-for="col in allVisibleColumns"
              :key="col.id"
              :style="{ minWidth: '120px', width: '120px' }"
              :class="'pm-data-cell theme-' + (col.theme || 'slate')"
            >
              {{ formatCellValue(row.metrics?.[col.id]) }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else-if="!loading" class="pm-table-empty">
        <svg class="pm-icon-empty" viewBox="0 0 48 48" fill="none" stroke="#94a3b8" stroke-width="1.5">
          <rect x="12" y="8" width="24" height="32" rx="3"/>
          <line x1="16" y1="16" x2="32" y2="16"/>
          <line x1="16" y1="22" x2="28" y2="22"/>
          <line x1="16" y1="28" x2="24" y2="28"/>
        </svg>
        <p>暂无监控数据，请确认已有店铺启用监控。</p>
      </div>
    </div>

    <!-- 监控配置面板 -->
    <MonitorConfigCard
      :config="config"
      @config-change="(field, value) => $emit('config-change', field, value)"
      @region-change="(regionId, checked) => $emit('region-change', regionId, checked)"
      @action-change="(actionType) => $emit('action-change', actionType)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  MONITOR_FILTERS, MONITOR_COLUMN_GROUPS, MONITOR_BASE_COLUMNS
} from '../constants.js';
import MonitorConfigCard from '../components/MonitorConfigCard.vue';

const props = defineProps({
  snapshot: { type: Object, default: () => ({ updatedAt: '', batchMonitoringActive: false, enabledShopIds: [], shops: {} }) },
  config: { type: Object, default: () => ({}) },
  selectedColumnIds: { type: Array, default: () => [] },
  activeFilter: { type: String, default: 'all' },
  visibleShops: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits([
  'filter-change', 'toggle-shop', 'open-shop-config', 'toggle-batch',
  'open-customize', 'config-change', 'region-change', 'action-change'
]);

const filterOptions = MONITOR_FILTERS;

// 所有可见的列（带分组theme信息）
const allVisibleColumns = computed(() => {
  const cols = [];
  for (const group of MONITOR_COLUMN_GROUPS) {
    for (const col of group.columns) {
      if (
        props.selectedColumnIds.includes(col.id) &&
        (props.activeFilter === 'all' || col.tags.includes(props.activeFilter))
      ) {
        cols.push({ ...col, theme: group.theme });
      }
    }
  }
  return cols;
});

// 表格数据
const tableData = computed(() => {
  const shops = props.snapshot.shops || {};
  return Object.entries(shops).map(([shopId, shop]) => ({
    shopId,
    enabled: shop.enabled || false,
    status: shop.status || 'idle',
    statusText: getStatusText(shop),
    lastLog: getLastLog(shop),
    shopName: shop.shopName || shopId,
    shopGroup: shop.shopGroup || '',
    shopNote: shop.shopNote || '',
    metrics: shop.metrics || {}
  }));
});

function getStatusText(shop) {
  const statusMap = { running: '运行中', idle: '空闲', stopped: '已停止', error: '异常' };
  return statusMap[shop.status] || shop.status || '空闲';
}

function getLastLog(shop) {
  if (!shop.lastOperation) return '-';
  const op = shop.lastOperation;
  if (op.actionText) return `${op.timestamp ? new Date(op.timestamp).toLocaleTimeString() : ''} ${op.actionText}`;
  return '-';
}

function formatCellValue(val) {
  if (val === null || val === undefined || val === '') return '-';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString();
    return val.toFixed(2);
  }
  return String(val);
}
</script>

<style scoped>
/* ===== Header & Badge ===== */
.pm-panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 116px;
  padding: 11px 16px;
  border-radius: 999px;
  background: rgba(201, 138, 50, 0.12);
  color: #7a4d14;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.pm-primary-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.pm-primary-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 128px;
  border-radius: 14px;
  padding: 10px 16px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.pm-primary-action-button:hover {
  transform: translateY(-1px);
}

.pm-primary-action-button.is-soft {
  border-color: rgba(32, 77, 134, 0.14);
  background: rgba(235, 242, 250, 0.92);
  color: #1f4f88;
}

.pm-primary-action-button.is-solid {
  background: linear-gradient(135deg, #204d86, #17365d);
  color: #ffffff;
  box-shadow: 0 14px 28px rgba(23, 54, 93, 0.22);
}

.pm-primary-action-button.is-danger {
  background: linear-gradient(135deg, #c85f3a, #9a341f);
  box-shadow: 0 14px 28px rgba(154, 52, 31, 0.24);
}

/* ===== Filter Bar ===== */
.pm-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.pm-filter-button {
  border: 1px solid rgba(36, 60, 92, 0.12);
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(240, 244, 250, 0.88);
  color: #38506b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}

.pm-filter-button:hover {
  border-color: rgba(145, 91, 22, 0.26);
  box-shadow: 0 10px 24px rgba(18, 34, 57, 0.08);
}

.pm-filter-button.is-active {
  border-color: rgba(150, 96, 30, 0.28);
  background: rgba(201, 138, 50, 0.14);
  color: #8a5718;
}

.pm-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.pm-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(36, 60, 92, 0.16);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: #425c77;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(18, 34, 57, 0.08);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, color 120ms ease;
}

.pm-icon-button:hover {
  transform: translateY(-1px);
  border-color: rgba(83, 104, 255, 0.42);
  color: #425cff;
  box-shadow: 0 14px 30px rgba(66, 92, 255, 0.14);
}

.pm-icon-button-glyph {
  width: 22px;
  height: 22px;
}

/* ===== Table ===== */
.pm-list-shell {
  margin-top: 14px;
  border-radius: 24px;
  border: 1px solid rgba(24, 41, 67, 0.08);
  background: rgba(255, 255, 255, 0.92);
  overflow: hidden;
}

.pm-list-shell.is-monitor {
  display: flex;
  flex-direction: column;
  min-height: 300px;
  max-height: 480px;
  overflow: auto;
}

.pm-table-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: #64748b;
  font-size: 13px;
}

.pm-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: pm-spin 0.6s linear infinite;
}

@keyframes pm-spin {
  to { transform: rotate(360deg); }
}

.pm-monitor-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.pm-monitor-table thead {
  position: sticky;
  top: 0;
  z-index: 6;
}

.pm-monitor-table th {
  text-align: left;
  padding: 14px 12px;
  background: linear-gradient(180deg, #f0f4f8, #e3eaf2);
  color: #49617d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(24, 41, 67, 0.1);
  white-space: nowrap;
}

.pm-monitor-table td {
  padding: 14px 12px;
  color: #1e3149;
  border-bottom: 1px solid rgba(24, 41, 67, 0.06);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pm-monitor-table tbody tr:hover td {
  background: rgba(240, 245, 251, 0.94);
}

.pm-table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #94a3b8;
  font-size: 13px;
}

.pm-icon-empty {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

/* ===== Switch ===== */
.pm-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.pm-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.pm-switch-slider {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #cbd5e1;
  transition: background 0.2s;
  position: relative;
}

.pm-switch-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.pm-switch input:checked + .pm-switch-slider {
  background: #10b981;
}

.pm-switch input:checked + .pm-switch-slider::after {
  transform: translateX(16px);
}

/* ===== Status Tag ===== */
.pm-status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pm-status-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.12);
  color: #0d9488;
}

.pm-status-tag.is-running {
  background: rgba(16, 185, 129, 0.14);
  color: #059669;
}

.pm-status-tag.is-disabled {
  background: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
}

.pm-log-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pm-log-text {
  font-size: 11px;
  color: #64748b;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pm-icon-btn-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(36, 60, 92, 0.12);
  border-radius: 8px;
  background: rgba(255,255,255,0.92);
  color: #64748b;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.pm-icon-btn-small:hover {
  border-color: rgba(83, 104, 255, 0.32);
  color: #425cff;
}

/* ===== Data Cell Themes ===== */
.pm-data-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.pm-data-cell.theme-amber, .pm-monitor-table th.theme-amber { color: #d97706; }
.pm-data-cell.theme-blue, .pm-monitor-table th.theme-blue { color: #3b82f6; }
.pm-data-cell.theme-green, .pm-monitor-table th.theme-green { color: #10b981; }
.pm-data-cell.theme-rose, .pm-monitor-table th.theme-rose { color: #e11d48; }
.pm-data-cell.theme-violet, .pm-monitor-table th.theme-violet { color: #8b5cf6; }
.pm-data-cell.theme-slate, .pm-monitor-table th.theme-slate { color: #475569; }
.pm-data-cell.theme-indigo, .pm-monitor-table th.theme-indigo { color: #6366f1; }
.pm-data-cell.theme-cyan, .pm-monitor-table th.theme-cyan { color: #0891b2; }

/* ===== Config Card ===== */
.pm-monitor-config-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 14px 12px;
  border-radius: 18px;
  border: 1px solid rgba(28, 50, 79, 0.09);
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.98), rgba(242, 247, 252, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.pm-config-toggle-bar {
  display: flex;
  align-items: center;
}

.pm-config-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgba(36, 60, 92, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  color: #425c77;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.pm-config-toggle-btn:hover {
  border-color: rgba(83, 104, 255, 0.28);
  color: #425cff;
}

.pm-config-toggle-arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
}

.pm-config-toggle-btn.is-open .pm-config-toggle-arrow {
  transform: rotate(180deg);
}

.pm-config-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pm-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.pm-config-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 4px 10px 4px 12px;
  border: 1px solid rgba(28, 50, 79, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.pm-config-label {
  color: #4c6178;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  flex-shrink: 0;
}

.pm-config-input {
  width: 80px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid rgba(39, 61, 89, 0.12);
  border-radius: 8px;
  background: rgba(244, 247, 251, 0.96);
  color: #18304a;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.pm-config-input:focus {
  border-color: rgba(33, 96, 173, 0.46);
  box-shadow: 0 0 0 3px rgba(33, 96, 173, 0.12);
  background: rgba(255, 255, 255, 0.98);
}

.pm-config-subcard {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(28, 50, 79, 0.08);
}

.pm-config-subcard.is-guard {
  border-left: 3px solid rgba(201, 138, 50, 0.3);
}

.pm-config-subcard.is-action {
  border-left: 3px solid rgba(31, 79, 136, 0.3);
}

.pm-config-subcard-title {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  white-space: nowrap;
  background: rgba(66, 92, 125, 0.08);
  color: #566c84;
}

.pm-config-subcard.is-guard .pm-config-subcard-title {
  background: rgba(201, 138, 50, 0.12);
  color: #8a5718;
}

.pm-config-subcard.is-action .pm-config-subcard-title {
  background: rgba(31, 79, 136, 0.1);
  color: #1f4f88;
}

.pm-config-choice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pm-config-choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 9px;
  border: 1px solid rgba(37, 58, 87, 0.1);
  background: rgba(244, 247, 251, 0.96);
  color: #304861;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s;
}

.pm-config-choice:hover {
  background: rgba(235, 242, 250, 0.96);
}

.pm-config-choice input {
  margin: 0;
  accent-color: #3b82f6;
}

/* ===== Dark Theme ===== */
body.dark-theme .pm-panel-badge {
  background: rgba(201, 138, 50, 0.18);
  color: #d4a24c;
}

body.dark-theme .pm-primary-action-button.is-soft {
  border-color: rgba(96, 165, 250, 0.18);
  background: rgba(30, 41, 59, 0.88);
  color: #93c5fd;
}

body.dark-theme .pm-primary-action-button.is-solid {
  background: linear-gradient(135deg, #1e3a5f, #0f2744);
}

body.dark-theme .pm-primary-action-button.is-danger {
  background: linear-gradient(135deg, #b91c1c, #7f1d1d);
}

body.dark-theme .pm-filter-button {
  background: rgba(30, 41, 59, 0.88);
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .pm-filter-button.is-active {
  background: rgba(201, 138, 50, 0.18);
  color: #d4a24c;
  border-color: rgba(201, 138, 50, 0.28);
}

body.dark-theme .pm-list-shell {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.1);
}

body.dark-theme .pm-monitor-table th {
  background: linear-gradient(180deg, #1e293b, #172535);
  color: #94a3b8;
  border-bottom-color: rgba(148, 163, 184, 0.1);
}

body.dark-theme .pm-monitor-table td {
  color: #e5eefc;
  border-bottom-color: rgba(148, 163, 184, 0.06);
}

body.dark-theme .pm-monitor-table tbody tr:hover td {
  background: rgba(59, 130, 246, 0.06);
}

body.dark-theme .pm-monitor-config-card {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(20, 30, 48, 0.94));
  border-color: rgba(148, 163, 184, 0.1);
}

body.dark-theme .pm-config-item {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .pm-config-label {
  color: #94a3b8;
}

body.dark-theme .pm-config-input {
  background: rgba(30, 41, 59, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
  color: #e5eefc;
}

body.dark-theme .pm-config-choice {
  background: rgba(30, 41, 59, 0.88);
  border-color: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
}

body.dark-theme .pm-config-subcard {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.08);
}

body.dark-theme .pm-data-cell.theme-slate { color: #94a3b8; }
body.dark-theme .pm-data-cell.theme-amber { color: #fbbf24; }
body.dark-theme .pm-data-cell.theme-cyan { color: #22d3ee; }
body.dark-theme .pm-data-cell.theme-blue { color: #60a5fa; }
body.dark-theme .pm-data-cell.theme-green { color: #34d399; }
body.dark-theme .pm-data-cell.theme-rose { color: #fb7185; }
body.dark-theme .pm-data-cell.theme-violet { color: #a78bfa; }
body.dark-theme .pm-data-cell.theme-indigo { color: #818cf8; }
</style>
