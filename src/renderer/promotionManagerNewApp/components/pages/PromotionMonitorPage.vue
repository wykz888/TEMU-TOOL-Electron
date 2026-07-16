<template>
  <section class="pm-new-feature-page pm-new-feature-page--monitor">
    <div class="pm-new-feature-head">
      <div>
        <h2>{{ title }}</h2>
      </div>
      <div class="pm-new-feature-actions">
        <a-button type="outline">{{ pauseButtonLabel }}</a-button>
        <a-button type="primary">{{ saveButtonLabel }}</a-button>
      </div>
    </div>

    <div class="pm-new-monitor-grid">
      <section class="pm-new-page-panel pm-new-monitor-list">
        <div class="pm-new-section-title">
          <strong>{{ shopTitle }}</strong>
          <a-tag size="small" bordered>{{ shopStatus }}</a-tag>
        </div>
        <div class="pm-new-monitor-board">
          <article
            v-for="metric in metrics"
            :key="metric.id"
            class="pm-new-monitor-card"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <a-tag size="small" bordered>{{ runningLabel }}</a-tag>
          </article>
        </div>
      </section>

      <aside class="pm-new-page-panel pm-new-rule-panel">
        <div class="pm-new-section-title">
          <strong>{{ ruleTitle }}</strong>
          <a-tag size="small" bordered>{{ ruleTag }}</a-tag>
        </div>
        <div class="pm-new-policy-list">
          <article
            v-for="group in policyGroups"
            :key="group.id"
            class="pm-new-policy"
          >
            <h3>{{ group.title }}</h3>
            <ul>
              <li v-for="item in group.items" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
defineProps({
  metrics: {
    type: Array,
    default: () => []
  },
  policyGroups: {
    type: Array,
    default: () => []
  }
});

const title = '\u63a8\u5e7f\u76d1\u63a7';
const pauseButtonLabel = '\u6682\u505c\u5168\u90e8';
const saveButtonLabel = '\u4fdd\u5b58\u89c4\u5219';
const shopTitle = '\u5e97\u94fa\u76d1\u63a7';
const shopStatus = '\u5b9e\u65f6\u72b6\u6001';
const ruleTitle = '\u76d1\u63a7\u89c4\u5219';
const ruleTag = '\u81ea\u52a8\u52a8\u4f5c';
const runningLabel = '\u8fd0\u884c\u4e2d';
</script>
