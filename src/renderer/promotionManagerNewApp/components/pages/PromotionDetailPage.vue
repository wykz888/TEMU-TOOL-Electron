<template>
  <section class="pm-new-feature-page pm-new-feature-page--detail">
    <section class="pm-new-page-panel pm-new-detail-panel">
      <div class="pm-new-product-query-shell">
        <PromotionDetailToolbar
          v-model:selected-shop-ids="selectedShopIds"
          v-model:selected-region-codes="selectedRegionCodes"
          v-model:query-date-range="queryDateRange"
          v-model:filter-values="detailFilterDraft"
          v-model:action-type="batchActionType"
          v-model:target-roas="batchTargetRoas"
          :region-options="regionOptions"
          :shop-options="shopFilterOptions"
          :status-options="statusOptions"
          :site-options="siteFilterOptions"
          :query-loading="queryLoading"
          :apply-all-disabled="batchApplyAllDisabled"
          :apply-selected-disabled="batchApplySelectedDisabled"
          :reset-disabled="batchResetDisabled"
          :execute-all-disabled="executeAllDisabled"
          :execute-selected-disabled="executeSelectedDisabled"
          @query="handleDetailQuery"
          @stop-query="handleStopDetailQuery"
          @search-filters="handleApplyDetailFilters"
          @reset-filters="handleResetDetailFilters"
          @apply-all="handleApplyBatchToAll"
          @apply-selected="handleApplyBatchToSelected"
          @execute-all="handleExecuteAll"
          @execute-selected="handleExecuteSelected"
          @reset="handleResetBatchDraft"
        />

        <div
          v-if="queryError"
          class="pm-new-query-message is-error"
        >
          {{ queryError }}
        </div>

        <div
          v-if="actionMessage"
          class="pm-new-query-message"
          :class="actionMessageClass"
        >
          {{ actionMessage }}
        </div>
      </div>

      <div class="pm-new-section-title">
        <strong>{{ detailListTitle }}</strong>
        <a-tag
          size="small"
          bordered
        >
          {{ detailCountText }}
        </a-tag>
      </div>

      <div
        v-if="querySummaryText"
        class="pm-new-goods-toolbar"
      >
        <span>{{ querySummaryText }}</span>
      </div>

      <PromotionDetailTable
        :rows="filteredDetailRows"
        :selected-row-keys="selectedDetailRowKeys"
        :empty-text="detailEmptyText"
        :loading="queryLoading"
        @selection-change="handleDetailSelectionChange"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import PromotionDetailTable from '../PromotionDetailTable.vue';
import PromotionDetailToolbar from '../PromotionDetailToolbar.vue';
import {
  DETAIL_ACTION_PAUSE,
  DETAIL_QUERY_PAGE_SIZE,
  DETAIL_STATUS_OPTIONS,
  buildPromotionDetailShopFilterOptions,
  buildPromotionDetailSiteFilterOptions,
  createEmptyPromotionDetailFilterState,
  filterPromotionDetailRows,
  getPromotionDetailRowKey,
  isPromotionDetailFilterActive,
  normalizePromotionDetailFilterState,
  normalizeText,
  normalizeTextList,
  prunePromotionDetailFilterStateOptions
} from '../../view-models/promotionDetailRows.js';
import {
  normalizeRegionIdList
} from '../../services/createPromotionSettings.js';

const selectedShopIds = ref([]);
const selectedRegionCodes = ref([]);
const queryDateRange = ref([]);
const queriedShopIds = ref([]);
const queriedRegionCodes = ref([]);
const detailRows = shallowRef([]);
const selectedDetailRowKeys = ref([]);
const detailFilterDraft = ref(createEmptyPromotionDetailFilterState());
const appliedDetailFilters = ref(createEmptyPromotionDetailFilterState());
const batchActionType = ref(DETAIL_ACTION_PAUSE);
const batchTargetRoas = ref(null);
const queryLoading = ref(false);
const queryError = ref('');
const queryResult = shallowRef(createEmptyDetailQueryResult());
const actionMessage = ref('');
const actionMessageClass = ref('is-info');
let activeQueryTimer = 0;
let activeQueryToken = 0;

const detailListTitle = '\u63a8\u5e7f\u5217\u8868';
const detailEmptyDefaultText = '\u8bf7\u9009\u62e9\u5e97\u94fa\u548c\u5730\u533a\u540e\u67e5\u8be2';
const detailEmptySearchText = '\u6ca1\u6709\u5339\u914d\u7684\u63a8\u5e7f';
const detailEmptyResultText = '\u6682\u65e0\u63a8\u5e7f\u660e\u7ec6\u6570\u636e';
const queryLoadingText = '\u6b63\u5728\u67e5\u8be2\u63a8\u5e7f\u660e\u7ec6...';
const queryNeedShopText = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa';
const queryNeedRegionText = '\u8bf7\u5148\u9009\u62e9\u67e5\u8be2\u5730\u533a';
const queryShopCountLabel = '\u5e97\u94fa';
const queryRegionCountLabel = '\u5730\u533a';
const queryPromotionCountLabel = '\u63a8\u5e7f';
const selectedCountLabel = '\u52fe\u9009';
const batchReadyLabel = '\u5df2\u51c6\u5907';
const batchAllScopeLabel = '\u5168\u90e8\u63a8\u5e7f';
const batchSelectedScopeLabel = '\u52fe\u9009\u63a8\u5e7f';
const executeNoRowsText = '\u8bf7\u5148\u52fe\u9009\u9700\u8981\u64cd\u4f5c\u7684\u63a8\u5e7f';
const regionOptions = [
  { value: 'us', label: '\u7f8e\u56fd' },
  { value: 'eu', label: '\u6b27\u533a' },
  { value: 'global', label: '\u5168\u7403' }
];
const statusOptions = DETAIL_STATUS_OPTIONS;

const filtersActive = computed(() => isPromotionDetailFilterActive(appliedDetailFilters.value));

const filteredDetailRows = computed(() => filterPromotionDetailRows(detailRows.value, appliedDetailFilters.value));

const shopFilterOptions = computed(() => buildPromotionDetailShopFilterOptions(detailRows.value));

const siteFilterOptions = computed(() => buildPromotionDetailSiteFilterOptions(detailRows.value));

const detailCountText = computed(() => (
  `${filteredDetailRows.value.length} / ${detailRows.value.length}`
));

const querySummaryText = computed(() => {
  if (queryLoading.value) {
    return queryLoadingText;
  }

  if (!queryResult.value.updatedAt) {
    return '';
  }

  return [
    `${queryShopCountLabel} ${queriedShopIds.value.length}`,
    `${queryRegionCountLabel} ${queriedRegionCodes.value.length}`,
    `${queryPromotionCountLabel} ${detailRows.value.length}`,
    `${selectedCountLabel} ${selectedDetailRowKeys.value.length}`
  ].join(' / ');
});

const detailEmptyText = computed(() => {
  if (queryLoading.value) {
    return queryLoadingText;
  }

  if (filtersActive.value && detailRows.value.length > 0) {
    return detailEmptySearchText;
  }

  if (queryResult.value.updatedAt) {
    return detailEmptyResultText;
  }

  return detailEmptyDefaultText;
});

const batchApplyAllDisabled = computed(() => filteredDetailRows.value.length <= 0);

const batchApplySelectedDisabled = computed(() => selectedDetailRowKeys.value.length <= 0);

const batchResetDisabled = computed(() => detailRows.value.length <= 0);

const executeAllDisabled = computed(() => filteredDetailRows.value.length <= 0);

const executeSelectedDisabled = computed(() => selectedDetailRowKeys.value.length <= 0);

function createEmptyDetailQueryResult() {
  return {
    taskId: '',
    updatedAt: '',
    request: {},
    rows: [],
    totalCount: 0
  };
}

function createQueryTaskId() {
  return [
    'detail_query',
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 10)
  ].join('_');
}

function clearActiveQueryTimer() {
  if (activeQueryTimer) {
    window.clearTimeout(activeQueryTimer);
    activeQueryTimer = 0;
  }
}

function buildDetailQueryPayload(taskId) {
  const shopIds = normalizeTextList(selectedShopIds.value);
  const regionIds = normalizeRegionIdList(selectedRegionCodes.value);

  queriedShopIds.value = shopIds.slice();
  queriedRegionCodes.value = regionIds.slice();

  return {
    taskId,
    shopIds,
    regionIds,
    dateRange: Array.isArray(queryDateRange.value) ? queryDateRange.value.slice(0, 2) : [],
    pageNumber: 1,
    pageSize: DETAIL_QUERY_PAGE_SIZE,
    selectedRoasType: 1
  };
}

function validateQueryPayload(payload) {
  if (!payload.shopIds || payload.shopIds.length <= 0) {
    return queryNeedShopText;
  }

  if (!payload.regionIds || payload.regionIds.length <= 0) {
    return queryNeedRegionText;
  }

  return '';
}

function resetDetailRows(rows = []) {
  detailRows.value = Array.isArray(rows) ? rows : [];
  selectedDetailRowKeys.value = [];
  actionMessage.value = '';
  pruneDetailFiltersForRows(detailRows.value);
}

function pruneDetailFiltersForRows(rows) {
  const optionValues = {
    shopValues: buildPromotionDetailShopFilterOptions(rows).map((option) => option.value),
    siteValues: buildPromotionDetailSiteFilterOptions(rows).map((option) => option.value)
  };

  detailFilterDraft.value = prunePromotionDetailFilterStateOptions(detailFilterDraft.value, optionValues);
  appliedDetailFilters.value = prunePromotionDetailFilterStateOptions(appliedDetailFilters.value, optionValues);
}

function pruneSelectedDetailRows(rows) {
  const availableKeys = new Set(rows.map(getPromotionDetailRowKey).filter(Boolean));

  selectedDetailRowKeys.value = selectedDetailRowKeys.value.filter((rowKey) => availableKeys.has(rowKey));
}

function handleDetailSelectionChange(rowKeys) {
  selectedDetailRowKeys.value = Array.isArray(rowKeys) ? rowKeys.map(normalizeText).filter(Boolean) : [];
}

function handleApplyDetailFilters() {
  const nextFilters = normalizePromotionDetailFilterState(detailFilterDraft.value);

  appliedDetailFilters.value = nextFilters;
  pruneSelectedDetailRows(filterPromotionDetailRows(detailRows.value, nextFilters));
}

function handleResetDetailFilters() {
  detailFilterDraft.value = createEmptyPromotionDetailFilterState();
  appliedDetailFilters.value = createEmptyPromotionDetailFilterState();
}

function handleStopDetailQuery() {
  if (!queryLoading.value) {
    return;
  }

  activeQueryToken += 1;
  clearActiveQueryTimer();
  queryLoading.value = false;
}

function handleDetailQuery() {
  const queryToken = activeQueryToken + 1;
  const taskId = createQueryTaskId();
  const payload = buildDetailQueryPayload(taskId);
  const validationMessage = validateQueryPayload(payload);

  activeQueryToken = queryToken;
  clearActiveQueryTimer();
  queryError.value = '';
  actionMessage.value = '';

  if (validationMessage) {
    queryError.value = validationMessage;
    return;
  }

  queryLoading.value = true;
  activeQueryTimer = window.setTimeout(() => {
    if (queryToken !== activeQueryToken) {
      return;
    }

    queryResult.value = {
      taskId,
      updatedAt: new Date().toISOString(),
      request: payload,
      rows: [],
      totalCount: 0
    };
    resetDetailRows([]);
    queryLoading.value = false;
    activeQueryTimer = 0;
  }, 420);
}

function getSelectedDetailRows() {
  const selectedKeySet = new Set(selectedDetailRowKeys.value.map(normalizeText).filter(Boolean));

  if (selectedKeySet.size <= 0) {
    return [];
  }

  return detailRows.value.filter((row) => selectedKeySet.has(getPromotionDetailRowKey(row)));
}

function showBatchReadyMessage(count, scopeLabel) {
  actionMessageClass.value = 'is-info';
  actionMessage.value = `${batchReadyLabel} ${Math.max(0, Number(count) || 0)} ${scopeLabel}`;
}

function handleApplyBatchToAll() {
  showBatchReadyMessage(filteredDetailRows.value.length, batchAllScopeLabel);
}

function handleApplyBatchToSelected() {
  const selectedRows = getSelectedDetailRows();

  if (selectedRows.length <= 0) {
    actionMessageClass.value = 'is-warning';
    actionMessage.value = executeNoRowsText;
    return;
  }

  showBatchReadyMessage(selectedRows.length, batchSelectedScopeLabel);
}

function handleResetBatchDraft() {
  batchActionType.value = DETAIL_ACTION_PAUSE;
  batchTargetRoas.value = null;
  actionMessage.value = '';
}

function handleExecuteAll() {
  showBatchReadyMessage(filteredDetailRows.value.length, batchAllScopeLabel);
}

function handleExecuteSelected() {
  handleApplyBatchToSelected();
}

watch(
  detailRows,
  pruneSelectedDetailRows
);

onBeforeUnmount(() => {
  clearActiveQueryTimer();
});
</script>
