<template>
  <a-table
    class="pm-new-monitor-data-table pm-new-shop-data-table"
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
    :loading="props.loading"
    size="small"
  >
    <template #columns>
      <a-table-column
        :title="statusColumnLabel"
        data-index="status"
        :width="statusColumnWidth"
        align="center"
        fixed="left"
      >
        <template #cell="{ record }">
          <div class="pm-new-monitor-status-cell pm-new-shop-data-status-cell">
            <a-tag
              class="pm-new-shop-data-status-tag"
              :color="record.statusTone"
              size="small"
              bordered
            >
              {{ record.statusLabel }}
            </a-tag>
            <span :title="record.queriedAt">
              {{ formatQueryTime(record.queriedAt) }}
            </span>
          </div>
        </template>
      </a-table-column>

      <a-table-column
        :title="shopInfoColumnLabel"
        data-index="shopName"
        :width="shopColumnWidth"
        :sortable="shopColumnSortable"
        fixed="left"
      >
        <template #cell="{ record }">
          <div class="pm-new-monitor-shop-cell pm-new-shop-data-shop-cell">
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
              <span
                v-if="record.accountValue"
                class="pm-new-monitor-shop-meta-item is-note"
                :title="record.accountValue"
              >
                <b>{{ accountInlineLabel }}</b>
                {{ record.accountValue }}
              </span>
            </div>
          </div>
        </template>
      </a-table-column>

      <a-table-column
        :title="summaryColumnLabel"
        data-index="querySummaryText"
        :width="summaryColumnWidth"
      >
        <template #cell="{ record }">
          <div
            class="pm-new-monitor-log-cell pm-new-shop-data-summary-cell"
            :title="record.regionSummaryTitle"
          >
            <strong :title="record.querySummaryText">
              {{ record.querySummaryText || emptyText }}
            </strong>
            <span :title="record.regionSummaryText">
              {{ record.regionSummaryText || emptyText }}
            </span>
          </div>
        </template>
      </a-table-column>

      <a-table-column
        v-for="column in props.visibleColumns"
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
            class="pm-new-monitor-metric-cell pm-new-shop-data-metric-cell"
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
        {{ props.emptyText || emptyStateText }}
      </div>
    </template>
  </a-table>
</template>

<script setup>
import { computed } from 'vue';
import { buildMonitorColumnSummaries, normalizeText } from '../view-models/promotionMonitorColumns.js';
import { createMonitorMetricColumnSortable, monitorShopColumnSortable } from '../view-models/promotionMonitorSorters.js';

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
  emptyText: {
    type: String,
    default: ''
  }
});

const statusColumnLabel = '\u67e5\u8be2\u72b6\u6001';
const shopInfoColumnLabel = '\u5e97\u94fa\u4fe1\u606f';
const summaryColumnLabel = '\u67e5\u8be2\u6982\u51b5';
const groupInlineLabel = '\u5206\u7ec4';
const noteInlineLabel = '\u5907\u6ce8';
const accountInlineLabel = '\u8d26\u53f7';
const emptyText = '-';
const emptyStateText = '\u6682\u65e0\u5e97\u94fa\u6570\u636e';
const statusColumnWidth = 128;
const shopColumnWidth = 248;
const summaryColumnWidth = 180;
const metricColumnWidth = 128;
const baseTableWidth = statusColumnWidth + shopColumnWidth + summaryColumnWidth;
const virtualListThreshold = 120;
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
  text: '\u6c47\u603b -',
  title: '',
  rows: []
});

const tableRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));
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

function formatQueryTime(value) {
  const timestamp = Date.parse(normalizeText(value));

  if (!Number.isFinite(timestamp)) {
    return emptyText;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return emptyText;
  }

  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join(':');
}
</script>
