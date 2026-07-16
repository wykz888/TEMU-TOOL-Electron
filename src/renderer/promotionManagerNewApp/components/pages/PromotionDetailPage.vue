<template>
  <section class="pm-new-feature-page pm-new-feature-page--detail">
    <div class="pm-new-feature-head">
      <div>
        <a-tag bordered>{{ module.label }}</a-tag>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
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
      <div class="pm-new-table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="column in columns" :key="column">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<script setup>
defineProps({
  module: {
    type: Object,
    default: () => ({})
  },
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
const description = '\u6309\u5e97\u94fa\u3001\u6d3b\u52a8\u548c\u5546\u54c1\u7ef4\u5ea6\u67e5\u770b\u63a8\u5e7f\u6570\u636e\u3002';
const exportButtonLabel = '\u5bfc\u51fa\u660e\u7ec6';
const syncButtonLabel = '\u540c\u6b65\u6570\u636e';
const tableTitle = '\u63a8\u5e7f\u660e\u7ec6\u8868';
const tableStatus = '\u6570\u636e\u5217\u8868';
const shopPlaceholder = '\u5e97\u94fa';
const campaignPlaceholder = '\u63a8\u5e7f\u6d3b\u52a8';
const productPlaceholder = '\u5546\u54c1';
const queryButtonLabel = '\u67e5\u8be2';
</script>
