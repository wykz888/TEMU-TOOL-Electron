<template>
  <a-modal
    :visible="visible"
    :mask-closable="false"
    :esc-to-close="true"
    :closable="true"
    :footer="false"
    :width="900"
    modal-class="pm-new-monitor-customize-modal"
    unmount-on-close
    @cancel="close"
  >
    <template #title>
      <div class="pm-new-monitor-modal-title">
        <strong>{{ modalTitle }}</strong>
      </div>
    </template>

    <div class="pm-new-monitor-customize-body">
      <section class="pm-new-monitor-customize-panel">
        <div class="pm-new-monitor-customize-head">
          <strong>{{ availableTitle }}</strong>
          <span>{{ availableDescription }}</span>
        </div>

        <a-checkbox
          class="pm-new-monitor-master-check"
          :model-value="isAllColumnsSelected"
          :indeterminate="isColumnSelectionIndeterminate"
          @change="toggleAllColumns"
        >
          {{ selectAllLabel }}
        </a-checkbox>

        <a-radio-group
          :model-value="quickFilter"
          class="pm-new-monitor-quick-filter"
          type="button"
          size="small"
          @change="updateQuickFilter"
        >
          <a-radio
            v-for="option in quickFilterOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </a-radio>
        </a-radio-group>

        <div class="pm-new-monitor-column-groups">
          <section
            v-for="group in filteredColumnGroups"
            :key="group.id"
            class="pm-new-monitor-column-group"
          >
            <a-checkbox
              :model-value="isGroupFullySelected(group)"
              :indeterminate="isGroupPartiallySelected(group)"
              @change="() => toggleGroup(group)"
            >
              <strong>{{ group.label }}</strong>
            </a-checkbox>
            <div class="pm-new-monitor-column-list">
              <a-checkbox
                v-for="column in group.columns"
                :key="column.id"
                :model-value="draftColumnIds.includes(column.id)"
                @change="() => toggleColumn(column.id)"
              >
                {{ column.fullLabel || column.shortLabel }}
              </a-checkbox>
            </div>
          </section>
        </div>
      </section>

      <section class="pm-new-monitor-customize-panel is-selected">
        <div class="pm-new-monitor-customize-head">
          <strong>{{ selectedTitle }}</strong>
          <span>{{ selectedDescription }}</span>
        </div>

        <div class="pm-new-monitor-selected-actions">
          <a-button type="text" size="small" @click="clearColumns">{{ clearLabel }}</a-button>
          <a-button type="text" size="small" @click="resetColumns">{{ resetLabel }}</a-button>
        </div>

        <div
          class="pm-new-monitor-selected-list"
          @dragover.prevent="handleSelectedListDragOver"
          @drop.prevent="handleSelectedListDrop"
        >
          <div
            v-for="columnId in draftColumnIds"
            :key="columnId"
            class="pm-new-monitor-selected-item"
            :class="{
              'is-dragging': draggingColumnId === columnId,
              'is-drop-before': dragOverColumnId === columnId && dragOverPlacement === 'before',
              'is-drop-after': dragOverColumnId === columnId && dragOverPlacement === 'after'
            }"
            @dragover.prevent="(event) => handleSelectedItemDragOver(event, columnId)"
            @dragleave="(event) => handleSelectedItemDragLeave(event, columnId)"
            @drop.stop.prevent="(event) => handleSelectedItemDrop(event, columnId)"
          >
            <a-tooltip :content="dragSortTipText" mini>
              <span
                class="pm-new-monitor-drag-handle"
                draggable="true"
                @dragstart="(event) => handleSelectedItemDragStart(event, columnId)"
                @dragend="handleSelectedItemDragEnd"
              >
                <IconDragDotVertical />
              </span>
            </a-tooltip>
            <span class="pm-new-monitor-selected-label">{{ getColumnLabel(columnId) }}</span>
            <a-button
              type="text"
              size="mini"
              @click="toggleColumn(columnId)"
            >
              {{ removeLabel }}
            </a-button>
          </div>
          <div
            v-if="draftColumnIds.length <= 0"
            class="pm-new-monitor-selected-empty"
          >
            {{ selectedEmptyText }}
          </div>
        </div>
      </section>
    </div>

    <div class="pm-new-monitor-modal-footer">
      <a-button @click="close">{{ cancelLabel }}</a-button>
      <a-button type="primary" @click="apply">{{ applyLabel }}</a-button>
    </div>
  </a-modal>
</template>

<script setup>
import { IconDragDotVertical } from '@arco-design/web-vue/es/icon';
import { computed, ref, watch } from 'vue';
import {
  DEFAULT_MONITOR_COLUMN_IDS,
  MONITOR_COLUMN_GROUPS,
  MONITOR_FILTER_OPTIONS,
  getMonitorColumnLabel,
  normalizeMonitorColumnIds,
  normalizeMonitorFilter
} from '../view-models/promotionMonitorColumns.js';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  selectedColumnIds: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'apply']);

const modalTitle = '\u81ea\u5b9a\u4e49\u6570\u636e\u9879';
const availableTitle = '\u53ef\u9009\u6570\u636e\u9879';
const availableDescription = '\u6309\u6307\u6807\u5206\u7ec4\u6216\u53e3\u5f84\u5feb\u901f\u7b5b\u9009';
const selectedTitle = '\u5df2\u9009\u6570\u636e\u9879';
const selectedDescription = '\u6309\u9009\u62e9\u987a\u5e8f\u663e\u793a\u5230\u5e97\u94fa\u5217\u8868';
const selectAllLabel = '\u5168\u9009';
const clearLabel = '\u5168\u90e8\u79fb\u9664';
const resetLabel = '\u91cd\u7f6e';
const removeLabel = '\u79fb\u9664';
const cancelLabel = '\u53d6\u6d88';
const applyLabel = '\u5e94\u7528';
const selectedEmptyText = '\u6682\u672a\u9009\u62e9\u6570\u636e\u9879';
const dragSortTipText = '\u62d6\u52a8\u8c03\u6574\u663e\u793a\u987a\u5e8f';

const draftColumnIds = ref([...DEFAULT_MONITOR_COLUMN_IDS]);
const quickFilter = ref('all');
const draggingColumnId = ref('');
const dragOverColumnId = ref('');
const dragOverPlacement = ref('');
const quickFilterOptions = MONITOR_FILTER_OPTIONS;

const filteredColumnGroups = computed(() => {
  const normalizedFilter = normalizeMonitorFilter(quickFilter.value);

  if (normalizedFilter === 'all') {
    return MONITOR_COLUMN_GROUPS;
  }

  return MONITOR_COLUMN_GROUPS
    .map((group) => ({
      ...group,
      columns: group.columns.filter((column) => column.tags.includes(normalizedFilter))
    }))
    .filter((group) => group.columns.length > 0);
});

const allFilteredColumnIds = computed(() => (
  filteredColumnGroups.value.flatMap((group) => group.columns.map((column) => column.id))
));
const isAllColumnsSelected = computed(() => (
  allFilteredColumnIds.value.length > 0
  && allFilteredColumnIds.value.every((columnId) => draftColumnIds.value.includes(columnId))
));
const isColumnSelectionIndeterminate = computed(() => (
  allFilteredColumnIds.value.some((columnId) => draftColumnIds.value.includes(columnId))
  && !isAllColumnsSelected.value
));

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      draftColumnIds.value = normalizeMonitorColumnIds(props.selectedColumnIds);
      quickFilter.value = 'all';
      resetDragState();
    }
  }
);

function updateQuickFilter(value) {
  quickFilter.value = normalizeMonitorFilter(value);
}

function setDraftColumnIds(columnIds) {
  draftColumnIds.value = Array.from(new Set(columnIds));
}

function resetDragState() {
  draggingColumnId.value = '';
  dragOverColumnId.value = '';
  dragOverPlacement.value = '';
}

function toggleAllColumns(checked) {
  if (checked === true) {
    setDraftColumnIds([...draftColumnIds.value, ...allFilteredColumnIds.value]);
    return;
  }

  const filteredIdSet = new Set(allFilteredColumnIds.value);
  setDraftColumnIds(draftColumnIds.value.filter((columnId) => !filteredIdSet.has(columnId)));
}

function isGroupFullySelected(group) {
  return group.columns.every((column) => draftColumnIds.value.includes(column.id));
}

function isGroupPartiallySelected(group) {
  return (
    group.columns.some((column) => draftColumnIds.value.includes(column.id))
    && !isGroupFullySelected(group)
  );
}

function toggleGroup(group) {
  const groupColumnIds = group.columns.map((column) => column.id);
  const allSelected = groupColumnIds.every((columnId) => draftColumnIds.value.includes(columnId));

  if (allSelected) {
    const groupColumnIdSet = new Set(groupColumnIds);
    setDraftColumnIds(draftColumnIds.value.filter((columnId) => !groupColumnIdSet.has(columnId)));
    return;
  }

  setDraftColumnIds([...draftColumnIds.value, ...groupColumnIds]);
}

function toggleColumn(columnId) {
  if (draftColumnIds.value.includes(columnId)) {
    setDraftColumnIds(draftColumnIds.value.filter((entry) => entry !== columnId));
    return;
  }

  setDraftColumnIds([...draftColumnIds.value, columnId]);
}

function clearColumns() {
  draftColumnIds.value = [];
}

function resetColumns() {
  draftColumnIds.value = [...DEFAULT_MONITOR_COLUMN_IDS];
}

function resolveDropPlacement(event) {
  const target = event && event.currentTarget;

  if (!target || typeof target.getBoundingClientRect !== 'function') {
    return 'before';
  }

  const rect = target.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;

  return event.clientY > middleY ? 'after' : 'before';
}

function moveColumnToPosition(sourceColumnId, targetColumnId, placement) {
  if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId) {
    return;
  }

  const currentColumnIds = draftColumnIds.value.slice();
  const sourceIndex = currentColumnIds.indexOf(sourceColumnId);
  const targetIndex = currentColumnIds.indexOf(targetColumnId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  currentColumnIds.splice(sourceIndex, 1);

  const nextTargetIndex = currentColumnIds.indexOf(targetColumnId);
  const insertIndex = placement === 'after' ? nextTargetIndex + 1 : nextTargetIndex;

  currentColumnIds.splice(insertIndex, 0, sourceColumnId);
  draftColumnIds.value = currentColumnIds;
}

function handleSelectedItemDragStart(event, columnId) {
  draggingColumnId.value = columnId;
  dragOverColumnId.value = columnId;
  dragOverPlacement.value = 'before';

  if (event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', columnId);
  }
}

function handleSelectedItemDragOver(event, columnId) {
  if (!draggingColumnId.value || draggingColumnId.value === columnId) {
    dragOverColumnId.value = columnId;
    dragOverPlacement.value = '';
    return;
  }

  dragOverColumnId.value = columnId;
  dragOverPlacement.value = resolveDropPlacement(event);

  if (event && event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleSelectedItemDragLeave(event, columnId) {
  const relatedTarget = event && event.relatedTarget;
  const currentTarget = event && event.currentTarget;

  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }

  if (dragOverColumnId.value === columnId) {
    dragOverColumnId.value = '';
    dragOverPlacement.value = '';
  }
}

function handleSelectedListDragOver(event) {
  if (!draggingColumnId.value || event.target !== event.currentTarget) {
    return;
  }

  dragOverColumnId.value = '';
  dragOverPlacement.value = 'after';

  if (event && event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleSelectedItemDrop(event, columnId) {
  const sourceColumnId = draggingColumnId.value
    || (event && event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
  const placement = resolveDropPlacement(event);

  moveColumnToPosition(sourceColumnId, columnId, placement);
  resetDragState();
}

function handleSelectedListDrop(event) {
  if (event.target !== event.currentTarget) {
    return;
  }

  const sourceColumnId = draggingColumnId.value
    || (event && event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');

  if (!sourceColumnId) {
    resetDragState();
    return;
  }

  const currentColumnIds = draftColumnIds.value.filter((columnId) => columnId !== sourceColumnId);

  currentColumnIds.push(sourceColumnId);
  draftColumnIds.value = currentColumnIds;
  resetDragState();
}

function handleSelectedItemDragEnd() {
  resetDragState();
}

function getColumnLabel(columnId) {
  return getMonitorColumnLabel(columnId);
}

function close() {
  emit('update:visible', false);
}

function apply() {
  emit('apply', normalizeMonitorColumnIds(draftColumnIds.value));
  close();
}
</script>
