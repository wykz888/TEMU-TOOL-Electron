<template>
  <a-table
    class="pm-new-monitor-data-table"
    :class="{ 'is-empty': tableRows.length <= 0 }"
    row-key="id"
    :data="tableRows"
    :pagination="false"
    :bordered="false"
    :hoverable="true"
    :stripe="false"
    :table-layout-fixed="true"
    :scroll="tableScroll"
    :virtual-list-props="tableVirtualListProps"
    :loading="loading"
    size="small"
  >
    <template #columns>
      <a-table-column
        :title="statusColumnLabel"
        data-index="status"
        :width="statusColumnWidth"
        :sortable="statusColumnSortable"
        align="center"
        fixed="left"
      >
        <template #cell="{ record }">
          <div class="pm-new-monitor-status-cell">
            <div class="pm-new-monitor-status-main">
              <a-switch
                size="small"
                :model-value="record.monitorEnabled"
                :loading="isShopToggling(record)"
                :disabled="loading"
                @change="(checked) => $emit('toggle-shop', record, checked)"
              />
              <a-tag
                class="pm-new-monitor-status-tag"
                :color="record.statusTone"
                size="small"
                bordered
              >
                {{ record.statusLabel }}
              </a-tag>
            </div>
            <a-button
              class="pm-new-monitor-shop-config-button"
              :class="{ 'is-active': record.hasIndependentConfig }"
              type="text"
              size="mini"
              :disabled="loading"
              @click="$emit('open-shop-config', record)"
            >
              {{ independentConfigLabel }}
            </a-button>
          </div>
        </template>
      </a-table-column>

      <a-table-column
        :title="logColumnLabel"
        data-index="logText"
        :width="logColumnWidth"
        :sortable="logColumnSortable"
      >
        <template #cell="{ record }">
          <div class="pm-new-monitor-log-cell">
            <strong :title="record.logText">{{ record.logText || emptyText }}</strong>
            <span :title="record.regionSummaryTitle">{{ record.regionSummaryText || emptyText }}</span>
          </div>
        </template>
      </a-table-column>

      <a-table-column
        :title="shopInfoColumnLabel"
        data-index="shopName"
        :width="shopColumnWidth"
        :sortable="shopColumnSortable"
      >
        <template #cell="{ record }">
          <div class="pm-new-monitor-shop-cell">
            <div class="pm-new-monitor-shop-name-row">
              <span class="pm-new-monitor-shop-mark"></span>
              <strong :title="record.shopName">{{ record.shopName || emptyText }}</strong>
            </div>
            <div class="pm-new-monitor-shop-meta">
              <span
                class="pm-new-monitor-shop-meta-item is-group"
                :title="record.groupName"
              >
                <b>{{ groupInlineLabel }}</b>
                {{ record.groupName || emptyText }}
              </span>
              <span
                class="pm-new-monitor-shop-meta-item is-note"
                :title="record.note"
              >
                <b>{{ noteInlineLabel }}</b>
                {{ record.note || emptyText }}
              </span>
            </div>
          </div>
        </template>
      </a-table-column>

      <a-table-column
        v-for="column in visibleColumns"
        :key="column.id"
        :title="column.shortLabel || column.fullLabel"
        :data-index="column.id"
        :width="metricColumnWidth"
        :sortable="getMetricColumnSortable(column.id)"
        align="center"
      >
        <template #title>
          <div
            class="pm-new-monitor-column-head"
            :title="getColumnSummary(column.id).title"
          >
            <span class="pm-new-monitor-column-title">
              {{ column.shortLabel || column.fullLabel }}
            </span>
            <span class="pm-new-monitor-column-summary">
              {{ getColumnSummary(column.id).text }}
            </span>
          </div>
        </template>
        <template #cell="{ record }">
          <div
            class="pm-new-monitor-metric-cell"
            :class="`theme-${column.theme || 'slate'}`"
            :title="getMetricCell(record, column.id).title"
          >
            <div
              v-for="regionRow in getMetricRows(record, column.id)"
              :key="regionRow.regionId"
              class="pm-new-monitor-metric-row"
              :class="{
                'is-empty': regionRow.empty,
                'is-inactive': regionRow.active === false
              }"
            >
              <span class="pm-new-monitor-metric-region">
                {{ regionRow.regionLabel }}
              </span>
              <span class="pm-new-monitor-metric-value">
                {{ regionRow.text || emptyText }}
              </span>
            </div>
          </div>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <div class="pm-new-monitor-empty">
        {{ emptyStateText }}
      </div>
    </template>
  </a-table>
</template>

<script setup>
import { computed } from 'vue';
import { buildMonitorColumnSummaries } from '../view-models/promotionMonitorColumns.js';
import {
  createMonitorMetricColumnSortable,
  monitorLogColumnSortable,
  monitorShopColumnSortable,
  monitorStatusColumnSortable
} from '../view-models/promotionMonitorSorters.js';

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  visibleColumns: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  togglingShopIds: {
    type: Array,
    default: () => []
  }
});

defineEmits(['toggle-shop', 'open-shop-config']);

const statusColumnLabel = '\u76d1\u63a7\u72b6\u6001';
const logColumnLabel = '\u76d1\u63a7\u65e5\u5fd7';
const shopInfoColumnLabel = '\u5e97\u94fa\u4fe1\u606f';
const groupInlineLabel = '\u5206\u7ec4';
const noteInlineLabel = '\u5907\u6ce8';
const emptyText = '-';
const summaryEmptyText = '\u6c47\u603b -';
const emptyStateText = '\u6682\u65e0\u53ef\u76d1\u63a7\u5e97\u94fa';
const independentConfigLabel = '\u72ec\u7acb\u914d\u7f6e';
const statusColumnWidth = 128;
const logColumnWidth = 172;
const shopColumnWidth = 218;
const metricColumnWidth = 128;
const baseTableWidth = statusColumnWidth + logColumnWidth + shopColumnWidth;
const virtualListThreshold = 120;
const statusColumnSortable = monitorStatusColumnSortable;
const logColumnSortable = monitorLogColumnSortable;
const shopColumnSortable = monitorShopColumnSortable;
const defaultMetricRows = Object.freeze([
  {
    regionId: 'us',
    regionLabel: '\u7f8e\u56fd',
    shortLabel: '\u7f8e',
    text: emptyText,
    empty: true
  },
  {
    regionId: 'eu',
    regionLabel: '\u6b27\u533a',
    shortLabel: '\u6b27',
    text: emptyText,
    empty: true
  },
  {
    regionId: 'global',
    regionLabel: '\u5168\u7403',
    shortLabel: '\u5168',
    text: emptyText,
    empty: true
  }
]);
const defaultColumnSummary = Object.freeze({
  text: summaryEmptyText,
  title: '',
  rows: []
});

const tableRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));
const togglingShopIdSet = computed(() => new Set(props.togglingShopIds));
const columnSummaryById = computed(() => buildMonitorColumnSummaries(tableRows.value));
const metricColumnSortableById = computed(() => (
  new Map(
    props.visibleColumns.map((column) => [
      column.id,
      createMonitorMetricColumnSortable(column.id)
    ])
  )
));
const tableScroll = computed(() => ({
  x: baseTableWidth + props.visibleColumns.length * metricColumnWidth,
  y: '100%'
}));
const tableVirtualListProps = computed(() => (
  tableRows.value.length >= virtualListThreshold
    ? {
      threshold: virtualListThreshold,
      estimatedSize: 108,
      buffer: 16
    }
    : undefined
));

function getMetricCell(row, columnId) {
  const metricCell = row && row.metrics ? row.metrics[columnId] : null;

  return metricCell && typeof metricCell === 'object'
    ? metricCell
    : {
      text: emptyText,
      title: '',
      rows: defaultMetricRows
    };
}

function getMetricRows(row, columnId) {
  const metricCell = getMetricCell(row, columnId);

  return Array.isArray(metricCell.rows) && metricCell.rows.length > 0
    ? metricCell.rows
    : defaultMetricRows;
}

function getColumnSummary(columnId) {
  const columnSummary = columnSummaryById.value[columnId];

  return columnSummary && typeof columnSummary === 'object'
    ? columnSummary
    : defaultColumnSummary;
}

function getMetricColumnSortable(columnId) {
  return metricColumnSortableById.value.get(columnId);
}

function isShopToggling(row) {
  return togglingShopIdSet.value.has(row && row.shopId);
}
</script>
