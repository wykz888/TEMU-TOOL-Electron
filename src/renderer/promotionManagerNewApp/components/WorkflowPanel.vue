<template>
  <section class="pm-new-main-panel">
    <div class="pm-new-panel-head">
      <div>
        <a-tag bordered>{{ module.label }}</a-tag>
        <h2>{{ module.description }}</h2>
      </div>
      <a-button type="outline" size="small">
        <template #icon><icon-launch /></template>
        {{ previewLabel }}
      </a-button>
    </div>

    <div class="pm-new-step-grid">
      <article
        v-for="step in steps"
        :key="step.id"
        class="pm-new-step-card"
      >
        <div class="pm-new-step-index">{{ step.id }}</div>
        <h3>{{ step.title }}</h3>
        <p>{{ step.description }}</p>
        <a-tag size="small" bordered>{{ step.status }}</a-tag>
      </article>
    </div>

    <div class="pm-new-table-card">
      <div class="pm-new-table-title">
        <strong>{{ tableTitle }}</strong>
        <span>{{ tableHint }}</span>
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
    </div>
  </section>
</template>

<script setup>
import { IconLaunch } from '@arco-design/web-vue/es/icon';

defineProps({
  module: {
    type: Object,
    default: () => ({})
  },
  steps: {
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

const previewLabel = '\u9884\u89c8\u6d41\u7a0b';
const tableTitle = '\u4efb\u52a1\u961f\u5217';
const tableHint = '\u793a\u4f8b\u5e03\u5c40\uff0c\u5f85\u63a5\u5165\u771f\u5b9e\u6570\u636e';
</script>
