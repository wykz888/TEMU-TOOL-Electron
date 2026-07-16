<template>
  <section class="pm-new-feature-page pm-new-feature-page--logs">
    <div class="pm-new-feature-head">
      <div>
        <h2>{{ title }}</h2>
      </div>
      <div class="pm-new-feature-actions">
        <a-button type="outline">{{ clearButtonLabel }}</a-button>
        <a-button type="primary">{{ exportButtonLabel }}</a-button>
      </div>
    </div>

    <section class="pm-new-page-panel pm-new-logs-page-panel">
      <div class="pm-new-section-title">
        <strong>{{ listTitle }}</strong>
        <a-tag size="small" bordered>{{ listStatus }}</a-tag>
      </div>
      <div class="pm-new-filter-row">
        <a-input :placeholder="keywordPlaceholder" />
        <a-input :placeholder="shopPlaceholder" />
        <a-button type="outline">{{ queryButtonLabel }}</a-button>
      </div>
      <div class="pm-new-log-table">
        <article
          v-for="log in logs"
          :key="`${log.time}-${log.text}`"
          class="pm-new-log-row"
        >
          <span>{{ log.time }}</span>
          <a-tag size="small" bordered>{{ log.level }}</a-tag>
          <p>{{ log.text }}</p>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup>
defineProps({
  logs: {
    type: Array,
    default: () => []
  }
});

const title = '\u8fd0\u884c\u65e5\u5fd7';
const clearButtonLabel = '\u6e05\u7406\u65e5\u5fd7';
const exportButtonLabel = '\u5bfc\u51fa\u65e5\u5fd7';
const listTitle = '\u65e5\u5fd7\u5217\u8868';
const listStatus = '\u6267\u884c\u8bb0\u5f55';
const keywordPlaceholder = '\u5173\u952e\u8bcd';
const shopPlaceholder = '\u5e97\u94fa';
const queryButtonLabel = '\u67e5\u8be2';
</script>
