<template>
  <section class="pm-new-feature-page pm-new-feature-page--detail">
    <div class="pm-new-feature-head">
      <div>
        <h2>{{ title }}</h2>
      </div>
      <div class="pm-new-feature-actions">
        <a-button type="outline">{{ exportButtonLabel }}</a-button>
        <a-button type="primary">{{ syncButtonLabel }}</a-button>
      </div>
    </div>

    <div class="pm-new-metric-row">
      <article
        v-for="metric in metrics"
        :key="metric.id"
        class="pm-new-metric"
        :class="`tone-${metric.tone}`"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </article>
    </div>

    <section class="pm-new-page-panel pm-new-detail-panel">
      <div class="pm-new-section-title">
        <strong>{{ tableTitle }}</strong>
        <a-tag size="small" bordered>{{ tableStatus }}</a-tag>
      </div>
      <div class="pm-new-filter-row">
        <a-input :placeholder="shopPlaceholder" />
        <a-input :placeholder="campaignPlaceholder" />
        <a-input :placeholder="productPlaceholder" />
        <a-button type="outline">{{ queryButtonLabel }}</a-button>
      </div>
      <a-table
        class="pm-new-detail-table"
        row-key="key"
        :columns="tableColumns"
        :data="tableRows"
        :pagination="false"
        :bordered="false"
        :scroll="detailTableScroll"
        size="small"
      />
    </section>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  metrics: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    default: () => []
  },
  rows: {
    type: Array,
    default: () => []
  }
});

const title = '\u63a8\u5e7f\u660e\u7ec6';
const exportButtonLabel = '\u5bfc\u51fa\u660e\u7ec6';
const syncButtonLabel = '\u540c\u6b65\u6570\u636e';
const tableTitle = '\u63a8\u5e7f\u660e\u7ec6\u8868';
const tableStatus = '\u6570\u636e\u5217\u8868';
const shopPlaceholder = '\u5e97\u94fa';
const campaignPlaceholder = '\u63a8\u5e7f\u6d3b\u52a8';
const productPlaceholder = '\u5546\u54c1';
const queryButtonLabel = '\u67e5\u8be2';
const detailTableScroll = Object.freeze({
  x: 760
});

const tableColumns = computed(() => props.columns.map((column, index) => ({
  title: column,
  dataIndex: `column${index}`,
  ellipsis: true,
  tooltip: true,
  width: index === props.columns.length - 1 ? 110 : 130
})));

const tableRows = computed(() => props.rows.map((row, rowIndex) => {
  const record = {
    key: String(rowIndex)
  };

  props.columns.forEach((_column, columnIndex) => {
    record[`column${columnIndex}`] = Array.isArray(row) ? row[columnIndex] : '';
  });

  return record;
}));
</script>
