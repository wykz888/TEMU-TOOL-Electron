<template>
  <section class="pm-new-feature-page pm-new-feature-page--shop-data">
    <section class="pm-new-page-panel pm-new-shop-data-panel">
      <div class="pm-new-product-query-shell">
        <ShopDataToolbar
          v-model:selected-shop-ids="selectedShopIds"
          v-model:selected-region-ids="selectedRegionIds"
          :region-options="regionOptions"
          :query-loading="queryLoading"
          :query-disabled="queryDisabled"
          @query="handleShopDataQuery"
        />

        <div
          v-if="queryError"
          class="pm-new-query-message is-error"
        >
          {{ queryError }}
        </div>

        <div
          v-if="querySummaryText"
          class="pm-new-goods-toolbar"
        >
          <span>{{ querySummaryText }}</span>
        </div>

        <div
          v-if="queryMessages.length > 0"
          class="pm-new-query-message is-warning"
        >
          <span
            v-for="message in queryMessages"
            :key="message.key"
          >
            {{ message.text }}
          </span>
        </div>
      </div>

      <div class="pm-new-section-title">
        <strong>{{ shopListTitle }}</strong>
        <div class="pm-new-section-title-badges">
          <a-tag size="small" bordered>{{ shopCountText }}</a-tag>
          <a-tag size="small" bordered>{{ regionCountText }}</a-tag>
        </div>
      </div>

      <ShopDataTable
        :rows="shopRows"
        :visible-columns="visibleColumns"
        :loading="queryLoading"
        :empty-text="tableEmptyText"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import ShopDataTable from '../ShopDataTable.vue';
import ShopDataToolbar from '../ShopDataToolbar.vue';
import { DEFAULT_MONITOR_COLUMN_IDS, resolveVisibleMonitorColumns, normalizeText } from '../../view-models/promotionMonitorColumns.js';
import {
  buildPromotionShopDataRows,
  normalizePromotionShopDataResult
} from '../../view-models/promotionShopDataRows.js';
import {
  queryPromotionShopData
} from '../../services/promotionShopData.js';

const REGION_OPTIONS = Object.freeze([
  { value: 'us', label: '\u7f8e\u56fd' },
  { value: 'eu', label: '\u6b27\u533a' },
  { value: 'global', label: '\u5168\u7403' }
]);

const selectedShopIds = ref([]);
const selectedRegionIds = ref(['us', 'eu', 'global']);
const queryLoading = ref(false);
const queryError = ref('');
const queryResult = ref(normalizePromotionShopDataResult());
const queriedRegionIds = ref(['us', 'eu', 'global']);

const shopListTitle = '\u5e97\u94fa\u5217\u8868';
const queryLoadingText = '\u6b63\u5728\u67e5\u8be2\u5e97\u94fa\u6570\u636e';
const queryNoBridgeText = '\u5e97\u94fa\u6570\u636e\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
const queryNoSelectionText = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa\u548c\u67e5\u8be2\u5730\u533a';
const tableEmptyBeforeQueryText = '\u8bf7\u9009\u62e9\u5e97\u94fa\u548c\u5730\u533a\u540e\u67e5\u8be2';
const tableEmptyResultText = '\u6682\u65e0\u5e97\u94fa\u6570\u636e';

const visibleColumns = computed(() => resolveVisibleMonitorColumns(DEFAULT_MONITOR_COLUMN_IDS, 'all'));
const shopRows = computed(() => buildPromotionShopDataRows(
  queryResult.value.rows,
  queriedRegionIds.value
));
const shopCountText = computed(() => {
  return `\u5df2\u9009 ${selectedShopIds.value.length} \u5bb6`;
});
const regionCountText = computed(() => {
  const regionCount = Array.isArray(selectedRegionIds.value) ? selectedRegionIds.value.length : 0;

  return `\u5df2\u9009 ${regionCount} \u4e2a\u5730\u533a`;
});
const querySummaryText = computed(() => {
  if (queryLoading.value) {
    return queryLoadingText;
  }

  if (!queryResult.value.updatedAt) {
    return '';
  }

  return [
    `\u5171 ${queryResult.value.totalCount} \u5bb6`,
    `\u5730\u533a\u6210\u529f ${queryResult.value.successCount}`,
    `\u5730\u533a\u5931\u8d25 ${queryResult.value.failedCount}`
  ].join(' / ');
});
const queryMessages = computed(() => buildUniqueQueryMessages([
  ...queryResult.value.errors,
  ...queryResult.value.warnings
]));
const tableEmptyText = computed(() => {
  if (queryLoading.value) {
    return queryLoadingText;
  }

  return queryResult.value.updatedAt ? tableEmptyResultText : tableEmptyBeforeQueryText;
});
const queryDisabled = computed(() => (
  queryLoading.value
  || selectedShopIds.value.length <= 0
  || selectedRegionIds.value.length <= 0
));

function buildQueryMessageText(entry) {
  return [
    normalizeText(entry && entry.shopName),
    normalizeText(entry && entry.regionLabel),
    normalizeText(entry && entry.message)
  ].filter(Boolean).join(' / ');
}

function buildUniqueQueryMessages(entries) {
  const seenMessages = new Set();
  const messages = [];

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const text = buildQueryMessageText(entry);

    if (!text || seenMessages.has(text)) {
      return;
    }

    seenMessages.add(text);
    messages.push({
      key: text,
      text
    });
  });

  return messages;
}

async function handleShopDataQuery() {
  if (queryLoading.value) {
    return;
  }

  if (selectedShopIds.value.length <= 0 || selectedRegionIds.value.length <= 0) {
    queryError.value = queryNoSelectionText;
    return;
  }

  queryLoading.value = true;
  queryError.value = '';
  queriedRegionIds.value = selectedRegionIds.value.slice();
  queryResult.value = normalizePromotionShopDataResult();

  try {
    const result = await queryPromotionShopData({
      shopIds: selectedShopIds.value,
      regionIds: selectedRegionIds.value
    });
    const normalizedResult = normalizePromotionShopDataResult(result);

    queryResult.value = normalizedResult;
    queriedRegionIds.value = Array.isArray(normalizedResult.request.regionIds) && normalizedResult.request.regionIds.length > 0
      ? normalizedResult.request.regionIds.slice()
      : selectedRegionIds.value.slice();
  } catch (error) {
    queryError.value = normalizeText(error && error.message) || queryNoBridgeText;
  } finally {
    queryLoading.value = false;
  }
}
</script>
