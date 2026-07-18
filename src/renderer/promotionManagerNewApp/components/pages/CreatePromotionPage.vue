<template>
  <section class="pm-new-feature-page pm-new-feature-page--create">
    <section class="pm-new-page-panel pm-new-product-panel">
      <div class="pm-new-product-query-shell">
        <CreatePromotionToolbar
          v-model:selected-shop-ids="selectedShopIds"
          v-model:selected-region-codes="selectedRegionCodes"
          v-model:budget-mode="batchBudgetMode"
          v-model:roas-mode="batchRoasMode"
          v-model:fast-start-mode="batchFastStartMode"
          v-model:filter-values="goodsFilterDraft"
          :region-options="regionOptions"
          :query-loading="queryLoading"
          :apply-all-disabled="batchApplyAllDisabled"
          :apply-selected-disabled="batchApplySelectedDisabled"
          :reset-disabled="batchResetDisabled"
          :submit-all-disabled="submitAllDisabled"
          :submit-selected-disabled="submitSelectedDisabled"
          @query="handleShopQuery"
          @search-filters="handleApplyGoodsFilters"
          @reset-filters="handleResetGoodsFilters"
          @apply-all="handleApplyBatchToAll"
          @apply-selected="handleApplyBatchToSelected"
          @submit-all="handleSubmitAllCampaigns"
          @submit-selected="handleSubmitSelectedCampaigns"
          @reset="handleResetBatchDrafts"
        />

        <div
          v-if="queryError"
          class="pm-new-query-message is-error"
        >
          {{ queryError }}
        </div>
      </div>

      <div class="pm-new-section-title">
        <strong>{{ goodsListTitle }}</strong>
        <a-tag size="small" bordered>{{ goodsCountText }}</a-tag>
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

      <CreatePromotionGoodsTable
        :rows="filteredGoodsRows"
        :selected-row-keys="selectedGoodsRowKeys"
        :row-drafts="goodsRowDrafts"
        :empty-text="goodsEmptyText"
        @selection-change="handleGoodsSelectionChange"
        @update-row-draft="handleUpdateGoodsRowDraft"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CreatePromotionGoodsTable from '../CreatePromotionGoodsTable.vue';
import CreatePromotionToolbar from '../CreatePromotionToolbar.vue';
import {
  BUDGET_MODE_UNLIMITED,
  FAST_START_MODE_OFF,
  FAST_START_MODE_ON,
  GOODS_QUERY_PAGE_SIZE,
  ROAS_MODE_STRONG,
  applyGoodsRowDraftPatchToRows,
  buildGoodsRowDraft,
  buildGoodsRowDraftMap,
  createEmptyGoodsFilterState,
  filterGoodsRows,
  getGoodsRowKey,
  isGoodsFilterActive,
  normalizeGoodsFilterState
} from '../../view-models/createPromotionGoodsRows.js';
import {
  loadCreatePromotionSelection,
  normalizeRegionIdList,
  normalizeText,
  normalizeTextList,
  resolveFeatureCenterBridge,
  saveCreatePromotionSelection
} from '../../services/createPromotionSettings.js';

const selectedShopIds = ref([]);
const queriedShopIds = ref([]);
const selectedRegionCodes = ref([]);
const queriedRegionCodes = ref([]);
const goodsRows = ref([]);
const selectedGoodsRowKeys = ref([]);
const goodsRowDrafts = ref({});
const goodsFilterDraft = ref(createEmptyGoodsFilterState());
const appliedGoodsFilters = ref(createEmptyGoodsFilterState());
const batchBudgetMode = ref(BUDGET_MODE_UNLIMITED);
const batchRoasMode = ref(ROAS_MODE_STRONG);
const batchFastStartMode = ref(FAST_START_MODE_OFF);
const queryError = ref('');
const queryLoading = ref(false);
const settingsLoaded = ref(false);
let saveSettingsTimer = null;
let restoringSettings = false;
const queryResult = ref({
  updatedAt: '',
  request: {},
  rows: [],
  regions: [],
  errors: [],
  warnings: [],
  totalCount: 0,
  successCount: 0,
  failedCount: 0
});

const goodsListTitle = '\u5546\u54c1\u5217\u8868';
const goodsEmptyDefaultText = '\u8bf7\u9009\u62e9\u5e97\u94fa\u548c\u5730\u533a\u540e\u67e5\u8be2';
const goodsEmptySearchText = '\u6ca1\u6709\u5339\u914d\u7684\u5546\u54c1';
const goodsEmptyResultText = '\u6682\u65e0\u5546\u54c1\u6570\u636e';
const queryNoBridgeText = '\u63a8\u5e7f\u5546\u54c1\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
const settingsLoadFailedText = '\u65b0\u5efa\u63a8\u5e7f\u914d\u7f6e\u52a0\u8f7d\u5931\u8d25';
const queryLoadingText = '\u6b63\u5728\u67e5\u8be2...';
const queryLoadingGoodsText = '\u6b63\u5728\u67e5\u8be2\u5546\u54c1\u6570\u636e';
const queryShopCountLabel = '\u5e97\u94fa';
const queryRegionCountLabel = '\u5730\u533a';
const querySuccessCountLabel = '\u6210\u529f';
const queryFailedCountLabel = '\u5931\u8d25';
const regionOptions = [
  { value: 'us', label: '\u7f8e\u56fd' },
  { value: 'eu', label: '\u6b27\u533a' },
  { value: 'global', label: '\u5168\u7403' }
];

const filtersActive = computed(() => isGoodsFilterActive(appliedGoodsFilters.value));

const filteredGoodsRows = computed(() => filterGoodsRows(goodsRows.value, appliedGoodsFilters.value));

const goodsCountText = computed(() => (
  `${filteredGoodsRows.value.length} / ${goodsRows.value.length}`
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
    `${querySuccessCountLabel} ${queryResult.value.successCount}`,
    `${queryFailedCountLabel} ${queryResult.value.failedCount}`
  ].join(' / ');
});

const queryMessages = computed(() => buildUniqueQueryMessages([
  ...queryResult.value.errors,
  ...queryResult.value.warnings
]));

const batchApplyAllDisabled = computed(() => goodsRows.value.length <= 0);

const batchApplySelectedDisabled = computed(() => selectedGoodsRowKeys.value.length <= 0);

const batchResetDisabled = computed(() => goodsRows.value.length <= 0);

const submitAllDisabled = computed(() => goodsRows.value.length <= 0);

const submitSelectedDisabled = computed(() => selectedGoodsRowKeys.value.length <= 0);

const goodsEmptyText = computed(() => {
  if (queryLoading.value) {
    return queryLoadingGoodsText;
  }

  if (filtersActive.value && goodsRows.value.length > 0) {
    return goodsEmptySearchText;
  }

  if (queryResult.value.updatedAt) {
    return goodsEmptyResultText;
  }

  return goodsEmptyDefaultText;
});

function buildGoodsQueryPayload() {
  const shopIds = normalizeTextList(selectedShopIds.value);
  const regionIds = normalizeRegionIdList(selectedRegionCodes.value);

  queriedShopIds.value = shopIds.slice();
  queriedRegionCodes.value = regionIds.slice();

  return {
    shopIds,
    regionIds,
    pageNumber: 1,
    pageSize: GOODS_QUERY_PAGE_SIZE,
    listId: '',
    isGray: false,
    selectedRoasType: 1
  };
}

function getFeatureCenterBridgeMethod(methodName) {
  const featureCenterBridge = resolveFeatureCenterBridge();

  return featureCenterBridge && featureCenterBridge[methodName];
}

async function loadCreateSettings() {
  restoringSettings = true;
  try {
    const settings = await loadCreatePromotionSelection();

    if (settings) {
      selectedShopIds.value = settings.selectedShopIds;
      selectedRegionCodes.value = settings.selectedRegionIds;
    }
  } catch (error) {
    console.warn(settingsLoadFailedText, error);
  } finally {
    await nextTick();
    restoringSettings = false;
    settingsLoaded.value = true;
  }
}

function clearSaveSettingsTimer() {
  if (saveSettingsTimer) {
    window.clearTimeout(saveSettingsTimer);
    saveSettingsTimer = null;
  }
}

async function persistCreateSettings() {
  await saveCreatePromotionSelection({
    selectedShopIds: selectedShopIds.value,
    selectedRegionIds: selectedRegionCodes.value
  });
}

function scheduleSaveCreateSettings() {
  if (!settingsLoaded.value || restoringSettings) {
    return;
  }

  clearSaveSettingsTimer();
  saveSettingsTimer = window.setTimeout(async () => {
    saveSettingsTimer = null;

    try {
      await persistCreateSettings();
    } catch (error) {
      console.warn('\u65b0\u5efa\u63a8\u5e7f\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25', error);
    }
  }, 400);
}

function buildQueryErrorText(error) {
  return [
    normalizeText(error && error.shopName),
    normalizeText(error && error.regionLabel),
    normalizeText(error && error.message)
  ].filter(Boolean).join(' / ');
}

function buildUniqueQueryMessages(entries) {
  const seenMessages = new Set();
  const messages = [];

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const text = buildQueryErrorText(entry);

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

function pruneSelectedGoodsRows(rows) {
  const availableKeys = new Set(rows.map(getGoodsRowKey).filter(Boolean));

  selectedGoodsRowKeys.value = selectedGoodsRowKeys.value.filter((rowKey) => availableKeys.has(rowKey));
}

function resetGoodsRowDrafts(rows) {
  goodsRowDrafts.value = buildGoodsRowDraftMap(rows);
}

function resetGoodsRowState(rows) {
  selectedGoodsRowKeys.value = [];
  resetGoodsRowDrafts(rows);
}

function handleGoodsSelectionChange(rowKeys) {
  selectedGoodsRowKeys.value = Array.isArray(rowKeys) ? rowKeys.map(normalizeText).filter(Boolean) : [];
}

function handleUpdateGoodsRowDraft(row, patch) {
  const rowKey = getGoodsRowKey(row);

  if (!rowKey) {
    return;
  }

  const currentDraft = goodsRowDrafts.value[rowKey] || buildGoodsRowDraft(row);

  goodsRowDrafts.value = {
    ...goodsRowDrafts.value,
    [rowKey]: {
      ...currentDraft,
      ...(patch && typeof patch === 'object' ? patch : {})
    }
  };
}

function buildBatchDraftPatch() {
  return {
    budgetMode: batchBudgetMode.value,
    roasMode: batchRoasMode.value,
    fastStartEnabled: batchFastStartMode.value === FAST_START_MODE_ON
  };
}

function applyBatchDraftToRows(rows) {
  const targetRows = Array.isArray(rows) ? rows : [];

  if (targetRows.length <= 0) {
    return;
  }

  goodsRowDrafts.value = applyGoodsRowDraftPatchToRows(
    goodsRowDrafts.value,
    targetRows,
    buildBatchDraftPatch()
  );
}

function getSelectedGoodsRows() {
  const selectedKeySet = new Set(selectedGoodsRowKeys.value.map(normalizeText).filter(Boolean));

  if (selectedKeySet.size <= 0) {
    return [];
  }

  return goodsRows.value.filter((row) => selectedKeySet.has(getGoodsRowKey(row)));
}

function handleApplyBatchToAll() {
  applyBatchDraftToRows(goodsRows.value);
}

function handleApplyBatchToSelected() {
  applyBatchDraftToRows(getSelectedGoodsRows());
}

function handleResetBatchDrafts() {
  resetGoodsRowDrafts(goodsRows.value);
}

function handleSubmitAllCampaigns() {
  return goodsRows.value;
}

function handleSubmitSelectedCampaigns() {
  return getSelectedGoodsRows();
}

function handleApplyGoodsFilters() {
  const nextFilters = normalizeGoodsFilterState(goodsFilterDraft.value);

  appliedGoodsFilters.value = nextFilters;
  pruneSelectedGoodsRows(filterGoodsRows(goodsRows.value, nextFilters));
}

function handleResetGoodsFilters() {
  goodsFilterDraft.value = createEmptyGoodsFilterState();
  appliedGoodsFilters.value = createEmptyGoodsFilterState();
}

async function handleShopQuery() {
  queryError.value = '';
  queryLoading.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('queryPromotionManagerNewGoods');

    if (typeof bridge !== 'function') {
      throw new Error(queryNoBridgeText);
    }

    const result = await bridge(buildGoodsQueryPayload());

    const normalizedResult = result && typeof result === 'object'
      ? result
      : {};

    queryResult.value = {
      updatedAt: normalizeText(normalizedResult.updatedAt),
      request: normalizedResult.request || {},
      rows: Array.isArray(normalizedResult.rows) ? normalizedResult.rows : [],
      regions: Array.isArray(normalizedResult.regions) ? normalizedResult.regions : [],
      errors: Array.isArray(normalizedResult.errors) ? normalizedResult.errors : [],
      warnings: Array.isArray(normalizedResult.warnings) ? normalizedResult.warnings : [],
      totalCount: Number(normalizedResult.totalCount) || 0,
      successCount: Number(normalizedResult.successCount) || 0,
      failedCount: Number(normalizedResult.failedCount) || 0
    };
    goodsRows.value = queryResult.value.rows;
    resetGoodsRowState(queryResult.value.rows);
  } catch (error) {
    queryError.value = normalizeText(error && error.message) || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25';
  } finally {
    queryLoading.value = false;
  }
}

watch(
  [selectedShopIds, selectedRegionCodes],
  scheduleSaveCreateSettings,
  { deep: true }
);

onMounted(() => {
  void loadCreateSettings();
});

watch(
  goodsRows,
  pruneSelectedGoodsRows
);

onBeforeUnmount(() => {
  const hasPendingSave = Boolean(saveSettingsTimer);

  clearSaveSettingsTimer();

  if (hasPendingSave && settingsLoaded.value) {
    void persistCreateSettings().catch((error) => {
      console.warn('\u65b0\u5efa\u63a8\u5e7f\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25', error);
    });
  }
});
</script>
