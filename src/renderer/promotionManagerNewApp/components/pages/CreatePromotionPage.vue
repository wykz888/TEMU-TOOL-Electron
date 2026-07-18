<template>
  <section class="pm-new-feature-page pm-new-feature-page--create">
    <div class="pm-new-feature-head">
      <div>
        <h2>{{ title }}</h2>
      </div>
      <div class="pm-new-feature-actions">
        <a-button type="outline">{{ draftButtonLabel }}</a-button>
        <a-button type="primary">{{ submitButtonLabel }}</a-button>
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
        v-if="queryResult.errors.length > 0"
        class="pm-new-query-message is-warning"
      >
        <span
          v-for="error in queryResult.errors"
          :key="`${error.shopId}:${error.regionId}`"
        >
          {{ buildQueryErrorText(error) }}
        </span>
      </div>

      <div class="pm-new-table-scroll pm-new-goods-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ goodsColumnProduct }}</th>
              <th>{{ goodsColumnIds }}</th>
              <th>{{ goodsColumnShopRegion }}</th>
              <th>{{ goodsColumnCategorySite }}</th>
              <th>{{ goodsColumnPrice }}</th>
              <th>{{ goodsColumnStockSales }}</th>
              <th>{{ goodsColumnCreatedAt }}</th>
              <th>{{ goodsColumnPromotion }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredGoodsRows"
              :key="row.id"
            >
              <td>
                <div class="pm-new-goods-product-cell">
                  <img
                    v-if="row.thumbUrl"
                    :src="row.thumbUrl"
                    :alt="row.goodsName"
                  />
                  <span
                    v-else
                    class="pm-new-goods-thumb-empty"
                  >
                    {{ noImageText }}
                  </span>
                  <strong :title="row.goodsName">{{ row.goodsName || emptyCellText }}</strong>
                </div>
              </td>
              <td>
                <div class="pm-new-goods-meta-cell">
                  <span>{{ goodsIdLabel }} {{ row.goodsId || emptyCellText }}</span>
                  <span>{{ spuIdLabel }} {{ row.spuId || emptyCellText }}</span>
                  <span>{{ skuLabel }} {{ row.skuEncode || emptyCellText }}</span>
                </div>
              </td>
              <td>
                <div class="pm-new-goods-meta-cell">
                  <strong>{{ row.shopName || emptyCellText }}</strong>
                  <span>{{ row.regionLabel || emptyCellText }}</span>
                  <span>{{ mallIdLabel }} {{ row.mallId || emptyCellText }}</span>
                </div>
              </td>
              <td>
                <div class="pm-new-goods-meta-cell">
                  <span :title="row.categoryText">{{ row.categoryText || emptyCellText }}</span>
                  <span :title="row.siteText">{{ row.siteText || emptyCellText }}</span>
                </div>
              </td>
              <td>
                <div class="pm-new-goods-meta-cell">
                  <strong>{{ row.priceText || emptyCellText }}</strong>
                  <span :title="row.sitePriceText">{{ row.sitePriceText || emptyCellText }}</span>
                </div>
              </td>
              <td>
                <div class="pm-new-goods-meta-cell">
                  <span>{{ stockLabel }} {{ row.skuTotalQuantity || emptyCellText }}</span>
                  <span>{{ salesLabel }} {{ row.sales || emptyCellText }}</span>
                </div>
              </td>
              <td>{{ row.createdAtText || emptyCellText }}</td>
              <td>
                <span :title="row.promotionText">{{ row.promotionText || emptyCellText }}</span>
              </td>
            </tr>
            <tr v-if="filteredGoodsRows.length <= 0">
              <td colspan="8">
                <div class="pm-new-goods-empty">
                  {{ goodsEmptyText }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import ShopSelectDropdown from '../../../shared/shopSelection/ShopSelectDropdown.vue';

const selectedShopIds = ref([]);
const queriedShopIds = ref([]);
const selectedRegionCodes = ref([]);
const queriedRegionCodes = ref([]);
const goodsKeyword = ref('');
const goodsRows = ref([]);
const queryError = ref('');
const queryLoading = ref(false);
const queryResult = ref({
  updatedAt: '',
  request: {},
  rows: [],
  regions: [],
  errors: [],
  totalCount: 0,
  successCount: 0,
  failedCount: 0
});

const title = '\u65b0\u5efa\u63a8\u5e7f';
const draftButtonLabel = '\u4fdd\u5b58\u8349\u7a3f';
const submitButtonLabel = '\u63d0\u4ea4\u4efb\u52a1';
const shopSelectPlaceholder = '\u5e97\u94fa\u9009\u62e9';
const regionSelectLabel = '\u67e5\u8be2\u5730\u533a';
const regionSelectPlaceholder = '\u9009\u62e9\u5730\u533a';
const queryButtonLabel = '\u67e5\u8be2';
const goodsListTitle = '\u5546\u54c1\u5217\u8868';
const goodsSearchPlaceholder = '\u641c\u7d22\u5546\u54c1\u540d / ID / SPU / \u5e97\u94fa';
const goodsColumnProduct = '\u5546\u54c1';
const goodsColumnIds = 'ID / SPU / SKU';
const goodsColumnShopRegion = '\u5e97\u94fa / \u5730\u533a';
const goodsColumnCategorySite = '\u7c7b\u76ee / \u7ad9\u70b9';
const goodsColumnPrice = '\u4f9b\u8d27\u4ef7';
const goodsColumnStockSales = '\u5e93\u5b58 / \u9500\u91cf';
const goodsColumnCreatedAt = '\u521b\u5efa\u65f6\u95f4';
const goodsColumnPromotion = '\u63a8\u5e7f\u4fe1\u606f';
const goodsIdLabel = 'Goods';
const spuIdLabel = 'SPU';
const skuLabel = 'SKU';
const mallIdLabel = 'Mall';
const stockLabel = '\u5e93\u5b58';
const salesLabel = '\u9500\u91cf';
const emptyCellText = '-';
const noImageText = '\u65e0\u56fe';
const goodsEmptyDefaultText = '\u8bf7\u9009\u62e9\u5e97\u94fa\u548c\u5730\u533a\u540e\u67e5\u8be2';
const goodsEmptySearchText = '\u6ca1\u6709\u5339\u914d\u7684\u5546\u54c1';
const goodsEmptyResultText = '\u6682\u65e0\u5546\u54c1\u6570\u636e';
const queryNoBridgeText = '\u63a8\u5e7f\u5546\u54c1\u67e5\u8be2\u63a5\u53e3\u672a\u52a0\u8f7d';
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
    row.goodsName,
    row.goodsId,
    row.spuId,
    row.skuEncode,
    row.shopName,
    row.regionLabel,
    row.categoryText,
    row.siteText
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

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeTextList(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(sourceItems.map(normalizeText).filter(Boolean)));
}

function buildGoodsQueryPayload() {
  const shopIds = normalizeTextList(selectedShopIds.value);
  const regionIds = normalizeTextList(selectedRegionCodes.value);

  queriedShopIds.value = shopIds.slice();
  queriedRegionCodes.value = regionIds.slice();

  return {
    shopIds,
    regionIds,
    pageNumber: 1,
    pageSize: 100,
    listId: '',
    isGray: false,
    selectedRoasType: 1
  };
}

function buildQueryErrorText(error) {
  return [
    normalizeText(error && error.shopName),
    normalizeText(error && error.regionLabel),
    normalizeText(error && error.message)
  ].filter(Boolean).join(' / ');
}

async function handleShopQuery() {
  queryError.value = '';
  queryLoading.value = true;

  try {
    const bridge = window.temuApp
      && window.temuApp.featureCenter
      && window.temuApp.featureCenter.queryPromotionManagerNewGoods;

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
      totalCount: Number(normalizedResult.totalCount) || 0,
      successCount: Number(normalizedResult.successCount) || 0,
      failedCount: Number(normalizedResult.failedCount) || 0
    };
    goodsRows.value = queryResult.value.rows;
  } catch (error) {
    queryError.value = normalizeText(error && error.message) || '\u5546\u54c1\u5217\u8868\u67e5\u8be2\u5931\u8d25';
  } finally {
    queryLoading.value = false;
  }
}
</script>
