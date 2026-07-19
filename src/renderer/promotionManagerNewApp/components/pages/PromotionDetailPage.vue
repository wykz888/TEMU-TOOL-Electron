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
          v-model:roas-mode="batchRoasMode"
          v-model:target-roas="batchTargetRoas"
          :region-options="regionOptions"
          :shop-options="shopFilterOptions"
          :status-options="statusOptions"
          :site-options="siteFilterOptions"
          :date-shortcuts="dateShortcuts"
          :query-loading="queryLoading"
          :apply-all-disabled="batchApplyAllDisabled"
          :apply-selected-disabled="batchApplySelectedDisabled"
          :reset-disabled="batchResetDisabled"
          :execute-all-disabled="executeAllDisabled"
          :execute-selected-disabled="executeSelectedDisabled"
          :execute-loading="actionLoading"
          :execute-stopping="actionStopping"
          :execute-scope="actionScope"
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
          v-if="visibleActionStatusText"
          class="pm-new-query-message pm-new-query-message--closable"
          :class="actionStatusClass"
        >
          <div class="pm-new-query-message-content">
            <span>{{ actionStatusText }}</span>
            <span
              v-for="message in actionMessages"
              :key="message.key"
            >
              {{ message.text }}
            </span>
          </div>
          <a-button
            v-if="actionStatusClosable"
            class="pm-new-query-message-close"
            type="text"
            size="mini"
            shape="circle"
            :title="closeStatusLabel"
            :aria-label="closeStatusLabel"
            @click="handleCloseActionStatus"
          >
            <template #icon>
              <IconClose />
            </template>
          </a-button>
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

      <PromotionDetailTable
        :rows="filteredDetailRows"
        :selected-row-keys="selectedDetailRowKeys"
        :row-action-statuses="detailActionStatusMap"
        :empty-text="detailEmptyText"
        :loading="queryLoading"
        @selection-change="handleDetailSelectionChange"
      />
    </section>
  </section>
</template>

<script setup>
import { IconClose } from '@arco-design/web-vue/es/icon';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import PromotionDetailTable from '../PromotionDetailTable.vue';
import PromotionDetailToolbar from '../PromotionDetailToolbar.vue';
import {
  DETAIL_ACTION_PAUSE,
  DETAIL_ACTION_TARGET_ROAS_TYPES,
  DETAIL_ACTION_UPDATE_ROAS,
  DETAIL_QUERY_PAGE_SIZE,
  DETAIL_ROAS_MODE_CUSTOM,
  DETAIL_ROAS_MODE_STRONG,
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
  buildCloneableDetailActionPayload,
  buildDetailActionSubmitRows,
  hasDetailActionRows
} from '../../view-models/promotionDetailActionRows.js';
import {
  DETAIL_ACTION_STATUS_FAILED,
  DETAIL_ACTION_STATUS_RUNNING,
  applyDetailActionResultToStatusMap,
  clearPreviewDetailActionStatuses,
  patchDetailActionPreviewStatusForPayload,
  patchDetailActionStatusForRows
} from '../../view-models/promotionDetailActionStatus.js';
import {
  resolveFeatureCenterBridge,
  normalizeRegionIdList
} from '../../services/createPromotionSettings.js';
import {
  loadPromotionDetailSettings,
  normalizePromotionDetailDateRange,
  savePromotionDetailSettings
} from '../../services/promotionDetailSettings.js';
import {
  createDefaultDateShortcuts,
  createTodayDateRange
} from '../../view-models/promotionDateRanges.js';

const selectedShopIds = ref([]);
const selectedRegionCodes = ref([]);
const queryDateRange = ref(createTodayDateRange());
const queriedShopIds = ref([]);
const queriedRegionCodes = ref([]);
const detailRows = shallowRef([]);
const selectedDetailRowKeys = ref([]);
const detailFilterDraft = ref(createEmptyPromotionDetailFilterState());
const appliedDetailFilters = ref(createEmptyPromotionDetailFilterState());
const batchActionType = ref(DETAIL_ACTION_PAUSE);
const batchRoasMode = ref(DETAIL_ROAS_MODE_STRONG);
const batchTargetRoas = ref(null);
const queryLoading = ref(false);
const queryError = ref('');
const activeQueryTaskId = ref('');
const queryResult = shallowRef(createEmptyDetailQueryResult());
const actionError = ref('');
const actionLoading = ref(false);
const actionStopping = ref(false);
const actionScope = ref('');
const actionReadyMessage = ref('');
const actionStatusDismissed = ref(false);
const activeActionTaskId = ref('');
const settingsLoaded = ref(false);
const actionResult = shallowRef(createEmptyActionResult());
const detailActionStatusMap = ref({});
let activeQueryToken = 0;
let saveSettingsTimer = null;
let restoringSettings = false;

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
const queryNoBridgeText = '\u63a8\u5e7f\u660e\u7ec6\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
const actionNoBridgeText = '\u63a8\u5e7f\u64cd\u4f5c\u63a5\u53e3\u672a\u52a0\u8f7d';
const actionLoadingText = '\u6b63\u5728\u6267\u884c\u63a8\u5e7f\u64cd\u4f5c...';
const actionStoppingText = '\u6b63\u5728\u505c\u6b62\u63a8\u5e7f\u64cd\u4f5c...';
const actionFinishedLabel = '\u63a8\u5e7f\u64cd\u4f5c\u5b8c\u6210';
const actionStoppedLabel = '\u5df2\u505c\u6b62\u63a8\u5e7f\u64cd\u4f5c';
const actionSuccessCountLabel = '\u6210\u529f';
const actionFailedCountLabel = '\u5931\u8d25';
const actionSkippedCountLabel = '\u8df3\u8fc7';
const actionCanceledCountLabel = '\u505c\u6b62';
const actionNoValidRowsText = '\u6ca1\u6709\u53ef\u6267\u884c\u64cd\u4f5c\u7684\u63a8\u5e7f';
const actionTargetRoasRequiredText = '\u8bf7\u5148\u8f93\u5165\u76ee\u6807ROAS';
const actionFailedText = '\u63a8\u5e7f\u64cd\u4f5c\u5931\u8d25';
const settingsLoadFailedText = '\u63a8\u5e7f\u660e\u7ec6\u914d\u7f6e\u8bfb\u53d6\u5931\u8d25';
const settingsSaveFailedText = '\u63a8\u5e7f\u660e\u7ec6\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25';
const actionScopeAll = 'all';
const actionScopeSelected = 'selected';
const closeStatusLabel = '\u5173\u95ed';
const regionOptions = [
  { value: 'us', label: '\u7f8e\u56fd' },
  { value: 'eu', label: '\u6b27\u533a' },
  { value: 'global', label: '\u5168\u7403' }
];
const statusOptions = DETAIL_STATUS_OPTIONS;
const dateShortcuts = createDefaultDateShortcuts();

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
    `${queryPromotionCountLabel} ${queryResult.value.totalCount}`,
    `${selectedCountLabel} ${selectedDetailRowKeys.value.length}`
  ].join(' / ');
});

const queryMessages = computed(() => buildUniqueQueryMessages([
  ...queryResult.value.errors,
  ...queryResult.value.warnings
]));

const actionMessages = computed(() => buildUniqueQueryMessages([
  ...actionResult.value.errors,
  ...actionResult.value.warnings
]));

const actionStatusText = computed(() => {
  if (actionLoading.value) {
    return actionStopping.value ? actionStoppingText : actionLoadingText;
  }

  if (actionReadyMessage.value) {
    return actionReadyMessage.value;
  }

  if (actionError.value) {
    return actionError.value;
  }

  if (!actionResult.value.updatedAt) {
    return '';
  }

  const finishedLabel = actionResult.value.canceled === true
    ? actionStoppedLabel
    : actionFinishedLabel;

  return [
    finishedLabel,
    `${actionSuccessCountLabel} ${Number(actionResult.value.successCount) || 0}`,
    `${actionFailedCountLabel} ${Number(actionResult.value.failedCount) || 0}`,
    `${actionSkippedCountLabel} ${Number(actionResult.value.skippedCount) || 0}`,
    `${actionCanceledCountLabel} ${Number(actionResult.value.canceledCount) || 0}`
  ].join(' / ');
});

const actionStatusClass = computed(() => {
  if (actionLoading.value) {
    return 'is-info';
  }

  if (actionReadyMessage.value) {
    return 'is-info';
  }

  if (
    actionError.value
    || Number(actionResult.value.failedCount) > 0
    || actionResult.value.errors.length > 0
  ) {
    return 'is-error';
  }

  if (
    Number(actionResult.value.skippedCount) > 0
    || Number(actionResult.value.canceledCount) > 0
    || Number(actionResult.value.warningCount) > 0
    || actionMessages.value.length > 0
  ) {
    return 'is-warning';
  }

  return 'is-success';
});

const actionStatusClosable = computed(() => !actionLoading.value && Boolean(actionStatusText.value));

const visibleActionStatusText = computed(() => Boolean(actionStatusText.value) && !actionStatusDismissed.value);

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

const executeAllDisabled = computed(() => (
  queryLoading.value
  || actionLoading.value
  || filteredDetailRows.value.length <= 0
));

const executeSelectedDisabled = computed(() => (
  queryLoading.value
  || actionLoading.value
  || selectedDetailRowKeys.value.length <= 0
));

function createEmptyDetailQueryResult() {
  return {
    taskId: '',
    canceled: false,
    updatedAt: '',
    request: {},
    rows: [],
    regions: [],
    errors: [],
    warnings: [],
    successCount: 0,
    failedCount: 0,
    totalCount: 0
  };
}

function createEmptyActionResult() {
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
    canceledCount: 0,
    warningCount: 0
  };
}

function createQueryTaskId() {
  return [
    'detail_query',
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 10)
  ].join('_');
}

function createActionTaskId(scope) {
  return [
    'detail_action',
    normalizeText(scope) || 'task',
    Date.now().toString(36),
    Math.random().toString(16).slice(2, 10)
  ].join('_');
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
  resetActionState();
  detailActionStatusMap.value = {};
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

function getFeatureCenterBridgeMethod(methodName) {
  const featureCenterBridge = resolveFeatureCenterBridge();

  return featureCenterBridge && featureCenterBridge[methodName];
}

async function loadDetailSettings() {
  restoringSettings = true;

  try {
    const settings = await loadPromotionDetailSettings();

    if (settings) {
      const restoredDateRange = normalizePromotionDetailDateRange(settings.queryDateRange);

      selectedShopIds.value = settings.selectedShopIds;
      selectedRegionCodes.value = settings.selectedRegionIds;
      detailFilterDraft.value = normalizePromotionDetailFilterState(settings.detailFilterDraft);
      appliedDetailFilters.value = normalizePromotionDetailFilterState(settings.appliedDetailFilters);
      batchActionType.value = settings.batchActionType || DETAIL_ACTION_PAUSE;
      batchRoasMode.value = settings.batchRoasMode || DETAIL_ROAS_MODE_STRONG;
      batchTargetRoas.value = settings.batchTargetRoas;

      if (restoredDateRange.length > 0) {
        queryDateRange.value = restoredDateRange;
      }
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

async function persistDetailSettings() {
  await savePromotionDetailSettings({
    selectedShopIds: selectedShopIds.value,
    selectedRegionIds: selectedRegionCodes.value,
    queryDateRange: queryDateRange.value,
    detailFilterDraft: detailFilterDraft.value,
    appliedDetailFilters: appliedDetailFilters.value,
    batchActionType: batchActionType.value,
    batchRoasMode: batchRoasMode.value,
    batchTargetRoas: batchTargetRoas.value
  });
}

function scheduleSaveDetailSettings() {
  if (!settingsLoaded.value || restoringSettings) {
    return;
  }

  clearSaveSettingsTimer();
  saveSettingsTimer = window.setTimeout(async () => {
    saveSettingsTimer = null;

    try {
      await persistDetailSettings();
    } catch (error) {
      console.warn(settingsSaveFailedText, error);
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

function handleApplyDetailFilters() {
  const nextFilters = normalizePromotionDetailFilterState(detailFilterDraft.value);

  appliedDetailFilters.value = nextFilters;
  pruneSelectedDetailRows(filterPromotionDetailRows(detailRows.value, nextFilters));
}

function handleResetDetailFilters() {
  detailFilterDraft.value = createEmptyPromotionDetailFilterState();
  appliedDetailFilters.value = createEmptyPromotionDetailFilterState();
}

async function handleStopDetailQuery() {
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
    const bridge = getFeatureCenterBridgeMethod('cancelPromotionManagerNewDetailsQuery');

    if (typeof bridge === 'function') {
      await bridge({ taskId });
    }
  } catch (error) {
    console.warn('\u63a8\u5e7f\u660e\u7ec6\u505c\u6b62\u5931\u8d25', error);
  }
}

async function handleDetailQuery() {
  const queryToken = activeQueryToken + 1;
  const taskId = createQueryTaskId();
  const payload = buildDetailQueryPayload(taskId);
  const validationMessage = validateQueryPayload(payload);

  activeQueryToken = queryToken;
  activeQueryTaskId.value = taskId;
  queryError.value = '';
  actionError.value = '';
  actionReadyMessage.value = '';

  if (validationMessage) {
    queryError.value = validationMessage;
    activeQueryTaskId.value = '';
    return;
  }

  queryLoading.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('queryPromotionManagerNewDetails');

    if (typeof bridge !== 'function') {
      throw new Error(queryNoBridgeText);
    }

    const result = await bridge(payload);

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
      successCount: Number(normalizedResult.successCount) || 0,
      failedCount: Number(normalizedResult.failedCount) || 0,
      totalCount: Number(normalizedResult.totalCount) || 0
    };
    resetDetailRows(queryResult.value.rows);
  } catch (error) {
    if (queryToken !== activeQueryToken) {
      return;
    }

    queryError.value = normalizeText(error && error.message) || '\u63a8\u5e7f\u660e\u7ec6\u67e5\u8be2\u5931\u8d25';
    queryResult.value = createEmptyDetailQueryResult();
    resetDetailRows([]);
  } finally {
    if (queryToken === activeQueryToken) {
      queryLoading.value = false;
      activeQueryTaskId.value = '';
    }
  }
}

function getSelectedDetailRows() {
  const selectedKeySet = new Set(selectedDetailRowKeys.value.map(normalizeText).filter(Boolean));

  if (selectedKeySet.size <= 0) {
    return [];
  }

  return detailRows.value.filter((row) => selectedKeySet.has(getPromotionDetailRowKey(row)));
}

function showBatchReadyMessage(count, scopeLabel) {
  actionError.value = '';
  actionReadyMessage.value = `${batchReadyLabel} ${Math.max(0, Number(count) || 0)} ${scopeLabel}`;
  actionStatusDismissed.value = false;
  actionResult.value = createEmptyActionResult();
}

function handleApplyBatchToAll() {
  applyBatchDraftToRows(filteredDetailRows.value, batchAllScopeLabel);
}

function handleApplyBatchToSelected() {
  applyBatchDraftToRows(getSelectedDetailRows(), batchSelectedScopeLabel);
}

function handleResetBatchDraft() {
  batchActionType.value = DETAIL_ACTION_PAUSE;
  batchRoasMode.value = DETAIL_ROAS_MODE_STRONG;
  batchTargetRoas.value = null;
  resetActionState();
  detailActionStatusMap.value = clearPreviewDetailActionStatuses(detailActionStatusMap.value);
}

function handleExecuteAll() {
  return executeDetailActionsForRows(filteredDetailRows.value, actionScopeAll);
}

function handleExecuteSelected() {
  return executeDetailActionsForRows(getSelectedDetailRows(), actionScopeSelected);
}

function resetActionState() {
  actionError.value = '';
  actionReadyMessage.value = '';
  actionResult.value = createEmptyActionResult();
  actionStatusDismissed.value = false;
}

function handleCloseActionStatus() {
  if (actionLoading.value) {
    return;
  }

  actionStatusDismissed.value = true;
}

function buildDetailActionPayload(rows) {
  const submitRows = buildDetailActionSubmitRows(rows, {
    actionType: batchActionType.value,
    roasMode: batchRoasMode.value,
    targetRoas: batchTargetRoas.value
  });
  const regionIds = queriedRegionCodes.value.length > 0
    ? queriedRegionCodes.value
    : selectedRegionCodes.value;
  const targetRoas = batchActionType.value === DETAIL_ACTION_UPDATE_ROAS
    && batchRoasMode.value !== DETAIL_ROAS_MODE_CUSTOM
    ? null
    : batchTargetRoas.value;

  return buildCloneableDetailActionPayload({
    taskId: activeActionTaskId.value,
    actionType: batchActionType.value,
    roasMode: batchRoasMode.value,
    targetRoas,
    rows: submitRows,
    regionIds
  });
}

function validateActionPayload(payload) {
  if (!hasDetailActionRows(payload.rows)) {
    return actionNoValidRowsText;
  }

  if (payload.actionType === DETAIL_ACTION_UPDATE_ROAS) {
    if (payload.roasMode === DETAIL_ROAS_MODE_CUSTOM && !(Number(payload.targetRoas) > 0)) {
      return actionTargetRoasRequiredText;
    }

    return '';
  }

  if (DETAIL_ACTION_TARGET_ROAS_TYPES.has(payload.actionType) && !(Number(payload.targetRoas) > 0)) {
    return actionTargetRoasRequiredText;
  }

  return '';
}

function applyBatchDraftToRows(rows, scopeLabel) {
  const targetRows = Array.isArray(rows) ? rows : [];

  resetActionState();
  detailActionStatusMap.value = clearPreviewDetailActionStatuses(detailActionStatusMap.value);

  if (targetRows.length <= 0) {
    actionError.value = executeNoRowsText;
    actionStatusDismissed.value = false;
    return;
  }

  const payload = buildDetailActionPayload(targetRows);
  const validationMessage = validateActionPayload(payload);

  if (validationMessage) {
    actionError.value = validationMessage;
    actionStatusDismissed.value = false;
    return;
  }

  detailActionStatusMap.value = patchDetailActionPreviewStatusForPayload(
    detailActionStatusMap.value,
    payload
  );
  showBatchReadyMessage(payload.rows.length, scopeLabel);
}

function markActionRowsAsRunning(rows) {
  detailActionStatusMap.value = patchDetailActionStatusForRows(
    detailActionStatusMap.value,
    rows,
    DETAIL_ACTION_STATUS_RUNNING
  );
}

function markActionRowsAsFailed(rows, message) {
  detailActionStatusMap.value = patchDetailActionStatusForRows(
    detailActionStatusMap.value,
    rows,
    DETAIL_ACTION_STATUS_FAILED,
    message || actionFailedText
  );
}

function applyDetailActionResult(result) {
  detailActionStatusMap.value = applyDetailActionResultToStatusMap(detailActionStatusMap.value, result);
}

async function cancelDetailActionTask() {
  if (!actionLoading.value || !activeActionTaskId.value || actionStopping.value) {
    return;
  }

  actionStopping.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('cancelPromotionManagerNewDetailActions');

    if (typeof bridge !== 'function') {
      throw new Error('\u505c\u6b62\u63a8\u5e7f\u64cd\u4f5c\u63a5\u53e3\u672a\u52a0\u8f7d');
    }

    await bridge({
      taskId: activeActionTaskId.value
    });
  } catch (error) {
    actionStopping.value = false;
    actionError.value = normalizeText(error && error.message) || '\u505c\u6b62\u63a8\u5e7f\u64cd\u4f5c\u5931\u8d25';
  }
}

async function executeDetailActionsForRows(rows, scope) {
  if (actionLoading.value) {
    return cancelDetailActionTask();
  }

  const targetRows = Array.isArray(rows) ? rows : [];

  resetActionState();

  if (targetRows.length <= 0) {
    actionError.value = executeNoRowsText;
    return;
  }

  activeActionTaskId.value = createActionTaskId(scope);
  actionScope.value = normalizeText(scope);
  const payload = buildDetailActionPayload(targetRows);
  const validationMessage = validateActionPayload(payload);

  if (validationMessage) {
    actionError.value = validationMessage;
    actionScope.value = '';
    activeActionTaskId.value = '';
    return;
  }

  markActionRowsAsRunning(targetRows);
  actionLoading.value = true;

  try {
    const bridge = getFeatureCenterBridgeMethod('executePromotionManagerNewDetailActions');

    if (typeof bridge !== 'function') {
      throw new Error(actionNoBridgeText);
    }

    const result = await bridge(payload);
    const normalizedResult = result && typeof result === 'object'
      ? result
      : {};

    actionResult.value = {
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
      canceledCount: Number(normalizedResult.canceledCount) || 0,
      warningCount: Number(normalizedResult.warningCount) || 0
    };
    applyDetailActionResult(actionResult.value);
  } catch (error) {
    const message = normalizeText(error && error.message) || actionFailedText;

    actionError.value = message;
    markActionRowsAsFailed(targetRows, message);
  } finally {
    actionLoading.value = false;
    actionStopping.value = false;
    actionScope.value = '';
    activeActionTaskId.value = '';
  }
}

watch(
  [
    selectedShopIds,
    selectedRegionCodes,
    queryDateRange,
    detailFilterDraft,
    appliedDetailFilters,
    batchActionType,
    batchRoasMode,
    batchTargetRoas
  ],
  scheduleSaveDetailSettings,
  { deep: true }
);

onMounted(() => {
  void loadDetailSettings();
});

watch(
  detailRows,
  pruneSelectedDetailRows
);

onBeforeUnmount(() => {
  const hasPendingSave = Boolean(saveSettingsTimer);

  clearSaveSettingsTimer();

  if (hasPendingSave && settingsLoaded.value) {
    void persistDetailSettings().catch((error) => {
      console.warn(settingsSaveFailedText, error);
    });
  }

  if (queryLoading.value) {
    void handleStopDetailQuery();
  }

  if (actionLoading.value) {
    void cancelDetailActionTask();
  }
});
</script>
