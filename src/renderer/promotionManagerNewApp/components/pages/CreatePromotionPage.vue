<template>
  <section class="pm-new-feature-page pm-new-feature-page--create">
    <div class="pm-new-feature-head">
      <div>
        <h2>{{ title }}</h2>
      </div>
    </div>

    <section class="pm-new-page-panel pm-new-product-panel">
      <div class="pm-new-product-query-shell">
        <div class="pm-new-shop-query-row">
          <ShopSelectDropdown
            v-model="selectedShopIds"
            :placeholder="shopSelectPlaceholder"
            storage-key="promotion-manager-new:create-shop-selection"
          />
          <label class="pm-new-query-region">
            <span class="pm-new-query-region-label">{{ regionSelectLabel }}</span>
            <a-select
              v-model="selectedRegionCodes"
              class="pm-new-query-region-control"
              multiple
              allow-clear
              size="small"
              :max-tag-count="1"
              :placeholder="regionSelectPlaceholder"
            >
              <a-option
                v-for="region in regionOptions"
                :key="region.value"
                :value="region.value"
              >
                {{ region.label }}
              </a-option>
            </a-select>
          </label>
          <a-button
            type="primary"
            :loading="queryLoading"
            @click="handleShopQuery"
          >
            {{ queryButtonLabel }}
          </a-button>
          <a-button
            type="outline"
            @click="openFilterModal"
          >
            {{ filterButtonLabel }}
          </a-button>
        </div>

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

      <div class="pm-new-goods-toolbar">
        <a-input
          v-model="goodsKeyword"
          allow-clear
          size="small"
          :placeholder="goodsSearchPlaceholder"
        />
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
        @toggle-all-visible="handleToggleAllVisibleRows"
        @toggle-row="handleToggleGoodsRow"
        @update-row-draft="handleUpdateGoodsRowDraft"
      />
    </section>

    <a-modal
      v-model:visible="filterModalVisible"
      :title="filterModalTitle"
      :mask-closable="false"
      :footer="false"
      width="760px"
    >
      <section class="pm-new-filter-modal-body"></section>
    </a-modal>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CreatePromotionGoodsTable from '../CreatePromotionGoodsTable.vue';
import ShopSelectDropdown from '../../../shared/shopSelection/ShopSelectDropdown.vue';
import {
  GOODS_QUERY_PAGE_SIZE,
  buildGoodsRowDraft,
  buildGoodsRowDraftMap,
  buildGoodsSearchText,
  getGoodsRowKey
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
const goodsKeyword = ref('');
const goodsRows = ref([]);
const selectedGoodsRowKeys = ref([]);
const goodsRowDrafts = ref({});
const queryError = ref('');
const queryLoading = ref(false);
const filterModalVisible = ref(false);
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

const title = '\u65b0\u5efa\u63a8\u5e7f';
const shopSelectPlaceholder = '\u5e97\u94fa\u9009\u62e9';
const regionSelectLabel = '\u67e5\u8be2\u5730\u533a';
const regionSelectPlaceholder = '\u9009\u62e9\u5730\u533a';
const queryButtonLabel = '\u2460\u67e5\u8be2\u5546\u54c1';
const filterButtonLabel = '\u2461\u7b5b\u9009\u63a8\u5e7f\u5546\u54c1';
const filterModalTitle = '\u7b5b\u9009\u63a8\u5e7f\u5546\u54c1';
const goodsListTitle = '\u5546\u54c1\u5217\u8868';
const goodsSearchPlaceholder = '\u641c\u7d22\u5546\u54c1\u540d / ID / SPU / \u5e97\u94fa';
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

const filteredGoodsRows = computed(() => {
  const keyword = String(goodsKeyword.value || '').trim().toLowerCase();

  if (!keyword) {
    return goodsRows.value;
  }

  return goodsRows.value.filter((row) => [
    buildGoodsSearchText(row)
  ].some((value) => String(value || '').toLowerCase().includes(keyword)));
});

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

const goodsEmptyText = computed(() => {
  if (queryLoading.value) {
    return queryLoadingGoodsText;
  }

  if (goodsKeyword.value && goodsRows.value.length > 0) {
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

function resetGoodsRowState(rows) {
  selectedGoodsRowKeys.value = [];
  goodsRowDrafts.value = buildGoodsRowDraftMap(rows);
}

function handleToggleGoodsRow(row, checked) {
  const rowKey = getGoodsRowKey(row);

  if (!rowKey) {
    return;
  }

  const selectedSet = new Set(selectedGoodsRowKeys.value);

  if (checked) {
    selectedSet.add(rowKey);
  } else {
    selectedSet.delete(rowKey);
  }

  selectedGoodsRowKeys.value = Array.from(selectedSet);
}

function handleToggleAllVisibleRows(checked) {
  const selectedSet = new Set(selectedGoodsRowKeys.value);

  filteredGoodsRows.value.forEach((row) => {
    const rowKey = getGoodsRowKey(row);

    if (!rowKey) {
      return;
    }

    if (checked) {
      selectedSet.add(rowKey);
    } else {
      selectedSet.delete(rowKey);
    }
  });

  selectedGoodsRowKeys.value = Array.from(selectedSet);
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

function openFilterModal() {
  filterModalVisible.value = true;
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
