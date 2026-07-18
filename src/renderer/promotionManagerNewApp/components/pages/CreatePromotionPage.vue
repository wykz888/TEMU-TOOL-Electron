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
          v-model:custom-budget="batchCustomBudget"
          v-model:custom-roas="batchCustomRoas"
          v-model:filter-values="goodsFilterDraft"
          :region-options="regionOptions"
          :shop-options="shopFilterOptions"
          :category-options="categoryFilterOptions"
          :site-options="siteFilterOptions"
          :query-loading="queryLoading"
          :apply-all-disabled="batchApplyAllDisabled"
          :apply-selected-disabled="batchApplySelectedDisabled"
          :reset-disabled="batchResetDisabled"
          :submit-all-disabled="submitAllDisabled"
          :submit-selected-disabled="submitSelectedDisabled"
          :submit-loading="submitLoading"
          :submit-stopping="submitStopping"
          :submit-scope="submitScope"
          @query="handleShopQuery"
          @stop-query="handleStopShopQuery"
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

        <div
          v-if="submitStatusText"
          class="pm-new-query-message"
          :class="submitStatusClass"
        >
          <span>{{ submitStatusText }}</span>
          <span
            v-for="message in submitMessages"
            :key="message.key"
          >
            {{ message.text }}
          </span>
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
        :row-draft-version="goodsRowDraftVersion"
        :row-create-statuses="goodsCreateStatusMap"
        :empty-text="goodsEmptyText"
        :loading="queryLoading"
        @selection-change="handleGoodsSelectionChange"
        @update-row-draft="handleUpdateGoodsRowDraft"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from 'vue';
import CreatePromotionGoodsTable from '../CreatePromotionGoodsTable.vue';
import CreatePromotionToolbar from '../CreatePromotionToolbar.vue';
import {
  BUDGET_MODE_CUSTOM,
  BUDGET_MODE_UNLIMITED,
  FAST_START_MODE_OFF,
  FAST_START_MODE_ON,
  GOODS_QUERY_PAGE_SIZE,
  ROAS_MODE_CUSTOM,
  ROAS_MODE_STRONG,
  applyGoodsRowDraftPatchToRows,
  buildGoodsCategoryFilterOptions,
  buildGoodsRowDraft,
  buildGoodsShopFilterOptions,
  buildGoodsSiteFilterOptions,
  createEmptyGoodsFilterState,
  filterGoodsRows,
  getGoodsRowKey,
  isGoodsFilterActive,
  normalizeGoodsFilterState,
  pruneGoodsFilterStateOptions
} from '../../view-models/createPromotionGoodsRows.js';
import {
  buildCreateAdsSubmitRows,
  hasValidCreateAdsRows
} from '../../view-models/createPromotionSubmitRows.js';
import {
  CREATE_STATUS_CREATING,
  CREATE_STATUS_FAILED,
  CREATE_STATUS_SKIPPED,
  applyCreateResultToStatusMap,
  patchCreateStatusForRows
} from '../../view-models/createPromotionSubmitStatus.js';
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
const goodsRows = shallowRef([]);
const selectedGoodsRowKeys = ref([]);
const goodsRowDrafts = shallowRef({});
const goodsRowDraftVersion = ref(0);
const goodsCreateStatusMap = shallowRef({});
const goodsFilterDraft = ref(createEmptyGoodsFilterState());
const appliedGoodsFilters = ref(createEmptyGoodsFilterState());
const batchBudgetMode = ref(BUDGET_MODE_UNLIMITED);
const batchRoasMode = ref(ROAS_MODE_STRONG);
const batchFastStartMode = ref(FAST_START_MODE_OFF);
const batchCustomBudget = ref(null);
const batchCustomRoas = ref(null);
const queryError = ref('');
const queryLoading = ref(false);
const activeQueryTaskId = ref('');
const submitError = ref('');
const submitLoading = ref(false);
const submitStopping = ref(false);
const submitScope = ref('');
const activeSubmitTaskId = ref('');
const settingsLoaded = ref(false);
let saveSettingsTimer = null;
let restoringSettings = false;
let activeQueryToken = 0;
const queryResult = shallowRef({
  taskId: '',
  canceled: false,
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
const submitResult = shallowRef(createEmptySubmitResult());

const goodsListTitle = '\u5546\u54c1\u5217\u8868';
const goodsEmptyDefaultText = '\u8bf7\u9009\u62e9\u5e97\u94fa\u548c\u5730\u533a\u540e\u67e5\u8be2';
const goodsEmptySearchText = '\u6ca1\u6709\u5339\u914d\u7684\u5546\u54c1';
const goodsEmptyResultText = '\u6682\u65e0\u5546\u54c1\u6570\u636e';
const queryNoBridgeText = '\u63a8\u5e7f\u5546\u54c1\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
const submitNoBridgeText = '\u521b\u5efa\u5e7f\u544a\u63a5\u53e3\u672a\u52a0\u8f7d';
const submitLoadingText = '\u6b63\u5728\u521b\u5efa\u5e7f\u544a...';
const submitFinishedLabel = '\u521b\u5efa\u5e7f\u544a\u5b8c\u6210';
const submitSuccessCountLabel = '\u6210\u529f';
const submitFailedCountLabel = '\u5931\u8d25';
const submitSkippedCountLabel = '\u8df3\u8fc7';
const submitNoRowsText = '\u8bf7\u5148\u9009\u62e9\u9700\u8981\u521b\u5efa\u5e7f\u544a\u7684\u5546\u54c1';
const submitNoValidRowsText = '\u6ca1\u6709\u53ef\u521b\u5efa\u5e7f\u544a\u7684\u5546\u54c1';
const submitStoppingText = '\u6b63\u5728\u505c\u6b62\u521b\u5efa\u5e7f\u544a...';
const submitStoppedLabel = '\u5df2\u505c\u6b62\u521b\u5efa\u5e7f\u544a';
const submitCanceledCountLabel = '\u505c\u6b62';
const submitInvalidRowText = '\u914d\u7f6e\u65e0\u6548\uff0c\u5df2\u8df3\u8fc7';
const submitCreateFailedText = '\u521b\u5efa\u5931\u8d25';
const submitScopeAll = 'all';
const submitScopeSelected = 'selected';
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

const shopFilterOptions = computed(() => buildGoodsShopFilterOptions(goodsRows.value));

const categoryFilterOptions = computed(() => buildGoodsCategoryFilterOptions(goodsRows.value));

const siteFilterOptions = computed(() => buildGoodsSiteFilterOptions(goodsRows.value));

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

const batchApplyAllDisabled = computed(() => filteredGoodsRows.value.length <= 0);

const batchApplySelectedDisabled = computed(() => selectedGoodsRowKeys.value.length <= 0);

const batchResetDisabled = computed(() => goodsRows.value.length <= 0);

const submitAllDisabled = computed(() => (
  queryLoading.value
  || submitLoading.value
  || filteredGoodsRows.value.length <= 0
));

const submitSelectedDisabled = computed(() => (
  queryLoading.value
  || submitLoading.value
  || selectedGoodsRowKeys.value.length <= 0
));

const submitMessages = computed(() => buildUniqueQueryMessages([
  ...submitResult.value.errors,
  ...submitResult.value.warnings
]));

const submitStatusText = computed(() => {
  if (submitLoading.value) {
    return submitStopping.value ? submitStoppingText : submitLoadingText;
  }

  if (submitError.value) {
    return submitError.value;
  }

  if (!submitResult.value.updatedAt) {
    return '';
  }

  const finishedLabel = submitResult.value.canceled === true
    ? submitStoppedLabel
    : submitFinishedLabel;

  return [
    finishedLabel,
    `${submitSuccessCountLabel} ${Number(submitResult.value.successCount) || 0}`,
    `${submitFailedCountLabel} ${Number(submitResult.value.failedCount) || 0}`,
    `${submitSkippedCountLabel} ${Number(submitResult.value.skippedCount) || 0}`,
    `${submitCanceledCountLabel} ${Number(submitResult.value.canceledCount) || 0}`
  ].join(' / ');
});

const submitStatusClass = computed(() => {
  if (submitLoading.value) {
    return 'is-info';
  }

  if (
    submitError.value
    || Number(submitResult.value.failedCount) > 0
    || submitResult.value.errors.length > 0
  ) {
    return 'is-error';
  }

  if (Number(submitResult.value.skippedCount) > 0 || submitMessages.value.length > 0) {
    return 'is-warning';
  }

  return 'is-success';
});

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
    taskId: activeQueryTaskId.value,
    shopIds,
    regionIds,
    pageNumber: 1,
    pageSize: GOODS_QUERY_PAGE_SIZE,
    listId: '',
    isGray: false,
    selectedRoasType: 1
  };
}

function createQueryTaskId() {
  return [
    'query_goods',
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 10)
  ].join('_');
}

function createEmptySubmitResult() {
  return {
    taskId: '',
    canceled: false,
    updatedAt: '',
    request: {},
    groups: [],
    rowResults: [],
    errors: [],
    warnings: [],
    totalCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    canceledCount: 0
  };
}

function resetSubmitState() {
  submitError.value = '';
  submitResult.value = createEmptySubmitResult();
  submitStopping.value = false;
  submitScope.value = '';
  activeSubmitTaskId.value = '';
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

function setGoodsRowDraftMap(nextDraftMap) {
  goodsRowDrafts.value = nextDraftMap && typeof nextDraftMap === 'object' ? nextDraftMap : {};
  goodsRowDraftVersion.value += 1;
}

function resetGoodsRowDrafts() {
  setGoodsRowDraftMap({});
}

function resetGoodsRowState(rows) {
  selectedGoodsRowKeys.value = [];
  resetGoodsRowDrafts();
  goodsCreateStatusMap.value = {};
}

function pruneGoodsFiltersForRows(rows) {
  const optionValues = {
    shopValues: buildGoodsShopFilterOptions(rows).map((option) => option.value),
    categoryValues: buildGoodsCategoryFilterOptions(rows).map((option) => option.value),
    siteValues: buildGoodsSiteFilterOptions(rows).map((option) => option.value)
  };

  goodsFilterDraft.value = pruneGoodsFilterStateOptions(goodsFilterDraft.value, optionValues);
  appliedGoodsFilters.value = pruneGoodsFilterStateOptions(appliedGoodsFilters.value, optionValues);
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

  goodsRowDrafts.value[rowKey] = {
    ...currentDraft,
    ...(patch && typeof patch === 'object' ? patch : {})
  };
  goodsRowDraftVersion.value += 1;
  triggerRef(goodsRowDrafts);
}

function buildBatchDraftPatch() {
  const patch = {
    budgetMode: batchBudgetMode.value,
    roasMode: batchRoasMode.value,
    fastStartEnabled: batchFastStartMode.value === FAST_START_MODE_ON
  };

  const customBudget = normalizeOptionalNumber(batchCustomBudget.value);
  const customRoas = normalizeOptionalNumber(batchCustomRoas.value);

  if (batchBudgetMode.value === BUDGET_MODE_CUSTOM && customBudget !== null) {
    patch.customBudget = customBudget;
  }

  if (batchRoasMode.value === ROAS_MODE_CUSTOM && customRoas !== null) {
    patch.customRoas = customRoas;
  }

  return patch;
}

function applyBatchDraftToRows(rows) {
  const targetRows = Array.isArray(rows) ? rows : [];

  if (targetRows.length <= 0) {
    return;
  }

  setGoodsRowDraftMap(applyGoodsRowDraftPatchToRows(
    goodsRowDrafts.value,
    targetRows,
    buildBatchDraftPatch()
  ));
}

function getSelectedGoodsRows() {
  const selectedKeySet = new Set(selectedGoodsRowKeys.value.map(normalizeText).filter(Boolean));

  if (selectedKeySet.size <= 0) {
    return [];
  }

  return goodsRows.value.filter((row) => selectedKeySet.has(getGoodsRowKey(row)));
}

function handleApplyBatchToAll() {
  applyBatchDraftToRows(filteredGoodsRows.value);
}

function handleApplyBatchToSelected() {
  applyBatchDraftToRows(getSelectedGoodsRows());
}

function handleResetBatchDrafts() {
  resetGoodsRowDrafts();
}

function buildCreateAdsPayload(rows) {
  const submitRows = buildCreateAdsSubmitRows(rows, goodsRowDrafts.value);
  const regionIds = queriedRegionCodes.value.length > 0
    ? queriedRegionCodes.value
    : selectedRegionCodes.value;

  return {
    taskId: activeSubmitTaskId.value,
    rows: submitRows.rows,
    invalidRows: submitRows.invalidRows,
    regionIds
  };
}

function createSubmitTaskId(scope) {
  return [
    'create_ads',
    normalizeText(scope) || 'task',
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 10)
  ].join('_');
}

function markCreateRowsAsRunning(targetRows, invalidRows) {
  const invalidRowKeySet = new Set(
    (Array.isArray(invalidRows) ? invalidRows : [])
      .map((row) => normalizeText(row && row.rowKey))
      .filter(Boolean)
  );
  const validRows = targetRows.filter((row) => !invalidRowKeySet.has(getGoodsRowKey(row)));

  goodsCreateStatusMap.value = patchCreateStatusForRows(
    patchCreateStatusForRows(goodsCreateStatusMap.value, validRows, CREATE_STATUS_CREATING),
    invalidRows,
    CREATE_STATUS_SKIPPED,
    submitInvalidRowText
  );
}

function markCreateRowsAsFailed(rows, message) {
  goodsCreateStatusMap.value = patchCreateStatusForRows(
    goodsCreateStatusMap.value,
    rows,
    CREATE_STATUS_FAILED,
    message || submitCreateFailedText
  );
}

function applyCreateAdsResult(result) {
  goodsCreateStatusMap.value = applyCreateResultToStatusMap(goodsCreateStatusMap.value, result);
}

async function cancelCreateAdsTask() {
  if (!submitLoading.value || !activeSubmitTaskId.value || submitStopping.value) {
    return;
  }

  submitStopping.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('cancelPromotionManagerNewAdsCreate');

    if (typeof bridge !== 'function') {
      throw new Error('\u505c\u6b62\u521b\u5efa\u5e7f\u544a\u63a5\u53e3\u672a\u52a0\u8f7d');
    }

    await bridge({
      taskId: activeSubmitTaskId.value
    });
  } catch (error) {
    submitStopping.value = false;
    submitError.value = normalizeText(error && error.message) || '\u505c\u6b62\u521b\u5efa\u5e7f\u544a\u5931\u8d25';
  }
}

async function submitCreateAdsForRows(rows, scope) {
  if (submitLoading.value) {
    return cancelCreateAdsTask();
  }

  const targetRows = Array.isArray(rows) ? rows : [];

  resetSubmitState();

  if (targetRows.length <= 0) {
    submitError.value = submitNoRowsText;
    return;
  }

  activeSubmitTaskId.value = createSubmitTaskId(scope);
  submitScope.value = normalizeText(scope);
  const payload = buildCreateAdsPayload(targetRows);
  markCreateRowsAsRunning(targetRows, payload.invalidRows);

  if (!hasValidCreateAdsRows(payload.rows)) {
    const firstInvalidMessage = payload.invalidRows.length > 0
      ? buildQueryErrorText(payload.invalidRows[0])
      : '';

    submitError.value = firstInvalidMessage || submitNoValidRowsText;
    submitScope.value = '';
    activeSubmitTaskId.value = '';
    return;
  }

  submitLoading.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('createPromotionManagerNewAds');

    if (typeof bridge !== 'function') {
      throw new Error(submitNoBridgeText);
    }

    const result = await bridge(payload);
    const normalizedResult = result && typeof result === 'object'
      ? result
      : {};

    submitResult.value = {
      taskId: normalizeText(normalizedResult.taskId),
      canceled: normalizedResult.canceled === true,
      updatedAt: normalizeText(normalizedResult.updatedAt),
      request: normalizedResult.request || {},
      groups: Array.isArray(normalizedResult.groups) ? normalizedResult.groups : [],
      rowResults: Array.isArray(normalizedResult.rowResults) ? normalizedResult.rowResults : [],
      errors: Array.isArray(normalizedResult.errors) ? normalizedResult.errors : [],
      warnings: Array.isArray(normalizedResult.warnings) ? normalizedResult.warnings : [],
      totalCount: Number(normalizedResult.totalCount) || 0,
      successCount: Number(normalizedResult.successCount) || 0,
      failedCount: Number(normalizedResult.failedCount) || 0,
      skippedCount: Number(normalizedResult.skippedCount) || 0,
      canceledCount: Number(normalizedResult.canceledCount) || 0
    };
    applyCreateAdsResult(submitResult.value);
  } catch (error) {
    const message = normalizeText(error && error.message) || '\u521b\u5efa\u5e7f\u544a\u5931\u8d25';

    submitError.value = message;
    markCreateRowsAsFailed(targetRows, message);
  } finally {
    submitLoading.value = false;
    submitStopping.value = false;
    submitScope.value = '';
    activeSubmitTaskId.value = '';
  }
}

function handleSubmitAllCampaigns() {
  return submitCreateAdsForRows(filteredGoodsRows.value, submitScopeAll);
}

function handleSubmitSelectedCampaigns() {
  return submitCreateAdsForRows(getSelectedGoodsRows(), submitScopeSelected);
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

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

async function handleStopShopQuery() {
  if (!queryLoading.value) {
    return;
  }

  const taskId = activeQueryTaskId.value;

  activeQueryToken += 1;
  queryLoading.value = false;
  activeQueryTaskId.value = '';

  if (!taskId) {
    return;
  }

  try {
    const bridge = getFeatureCenterBridgeMethod('cancelPromotionManagerNewGoodsQuery');

    if (typeof bridge === 'function') {
      await bridge({ taskId });
    }
  } catch (error) {
    console.warn('\u5546\u54c1\u67e5\u8be2\u505c\u6b62\u5931\u8d25', error);
  }
}

async function handleShopQuery() {
  const queryToken = activeQueryToken + 1;

  activeQueryToken = queryToken;
  activeQueryTaskId.value = createQueryTaskId();
  queryError.value = '';
  resetSubmitState();
  queryLoading.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('queryPromotionManagerNewGoods');

    if (typeof bridge !== 'function') {
      throw new Error(queryNoBridgeText);
    }

    const result = await bridge(buildGoodsQueryPayload());

    if (queryToken !== activeQueryToken) {
      return;
    }

    const normalizedResult = result && typeof result === 'object'
      ? result
      : {};

    queryResult.value = {
      taskId: normalizeText(normalizedResult.taskId),
      canceled: normalizedResult.canceled === true,
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
    pruneGoodsFiltersForRows(queryResult.value.rows);
    resetGoodsRowState(queryResult.value.rows);
  } catch (error) {
    if (queryToken !== activeQueryToken) {
      return;
    }

    queryError.value = normalizeText(error && error.message) || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25';
  } finally {
    if (queryToken === activeQueryToken) {
      queryLoading.value = false;
      activeQueryTaskId.value = '';
    }
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
