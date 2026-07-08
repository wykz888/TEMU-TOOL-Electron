<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="pm-modal-overlay" @click.self="cancel">
        <div class="pm-modal" style="width: 960px;">
          <div class="pm-modal-header">
            <h2 class="pm-modal-title">自定义数据项</h2>
            <button class="pm-modal-close" @click="cancel">&times;</button>
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
            <button class="pm-btn pm-btn-secondary" @click="cancel">取消</button>
            <button class="pm-btn pm-btn-primary" @click="apply">应用</button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { CUSTOMIZE_QUICK_FILTERS, MONITOR_COLUMN_GROUPS, DEFAULT_MONITOR_COLUMN_IDS } from '../constants.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectedColumnIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:visible', 'apply']);

const customizeDraftColumnIds = ref([...DEFAULT_MONITOR_COLUMN_IDS]);
const customizeQuickFilter = ref('');
const quickFilters = CUSTOMIZE_QUICK_FILTERS;

watch(
  () => props.visible,
  (v) => {
    if (v) {
      customizeDraftColumnIds.value = [...props.selectedColumnIds];
      customizeQuickFilter.value = '';
    }
  }
);

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

function clearAllCustomColumns() {
  customizeDraftColumnIds.value = [];
}

function resetCustomColumns() {
  customizeDraftColumnIds.value = [...DEFAULT_MONITOR_COLUMN_IDS];
}

function cancel() {
  emit('update:visible', false);
}

function apply() {
  emit('apply', [...customizeDraftColumnIds.value]);
  emit('update:visible', false);
}
</script>

<style>
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

.customize-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 13px;
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
</style>
