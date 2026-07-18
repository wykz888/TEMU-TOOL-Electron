<template>
  <div class="pm-new-table-scroll pm-new-goods-table-scroll">
    <table>
      <colgroup>
        <col class="pm-new-goods-select-col" />
        <col class="pm-new-goods-product-col" />
        <col class="pm-new-goods-budget-col" />
        <col class="pm-new-goods-roas-col" />
      </colgroup>
      <thead>
        <tr>
          <th class="pm-new-goods-select-column">
            <a-checkbox
              :model-value="allVisibleRowsSelected"
              :indeterminate="someVisibleRowsSelected"
              @change="$emit('toggle-all-visible', $event)"
            />
          </th>
          <th>{{ goodsColumnProduct }}</th>
          <th>{{ goodsColumnDailyBudget }}</th>
          <th>{{ goodsColumnTargetRoas }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="getGoodsRowKey(row)"
          class="pm-new-goods-row"
        >
          <td class="pm-new-goods-select-column">
            <a-checkbox
              :model-value="isRowSelected(row)"
              @change="$emit('toggle-row', row, $event)"
            />
          </td>
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
              <div class="pm-new-goods-main-info">
                <strong :title="row.goodsName">{{ row.goodsName || emptyCellText }}</strong>
                <div class="pm-new-goods-id-grid">
                  <span>{{ goodsIdLabel }} {{ row.goodsId || emptyCellText }}</span>
                  <span>{{ spuIdLabel }} {{ row.spuId || emptyCellText }}</span>
                  <span>{{ skuLabel }} {{ row.skuEncode || emptyCellText }}</span>
                </div>
                <div class="pm-new-goods-inline-meta">
                  <span>{{ row.shopName || emptyCellText }}</span>
                  <span>{{ row.regionLabel || emptyCellText }}</span>
                  <span>{{ mallIdLabel }} {{ row.mallId || emptyCellText }}</span>
                  <span>{{ createdAtLabel }} {{ row.createdAtText || emptyCellText }}</span>
                </div>
                <div class="pm-new-goods-inline-meta">
                  <span :title="row.categoryText">{{ categoryLabel }} {{ row.categoryText || emptyCellText }}</span>
                  <span :title="row.siteText">{{ siteLabel }} {{ row.siteText || emptyCellText }}</span>
                </div>
                <div class="pm-new-goods-inline-meta">
                  <span>{{ priceLabel }} {{ row.priceText || emptyCellText }}</span>
                  <span>{{ stockLabel }} {{ row.skuTotalQuantity || emptyCellText }}</span>
                  <span>{{ salesLabel }} {{ row.sales || emptyCellText }}</span>
                  <span :title="row.promotionText">{{ promotionLabel }} {{ row.promotionText || emptyCellText }}</span>
                </div>
              </div>
            </div>
          </td>
          <td>
            <div class="pm-new-goods-control-cell">
              <a-radio-group
                :model-value="getRowDraft(row).budgetMode"
                type="button"
                size="small"
                @change="(value) => $emit('update-row-draft', row, { budgetMode: value })"
              >
                <a-radio
                  v-for="option in budgetModeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </a-radio>
              </a-radio-group>
              <div
                v-if="getRowDraft(row).budgetMode === budgetModeCustom"
                class="pm-new-control-inline"
              >
                <a-input-number
                  :model-value="getRowDraft(row).customBudget"
                  :min="getDailyBudgetMin(row)"
                  :max="getDailyBudgetMax(row)"
                  :precision="0"
                  size="small"
                  mode="button"
                  @change="(value) => $emit('update-row-draft', row, { customBudget: value })"
                />
              </div>
              <span
                v-if="buildDailyBudgetHint(row)"
                class="pm-new-goods-field-hint"
              >
                {{ dailyBudgetRangeLabel }} {{ buildDailyBudgetHint(row) }}
              </span>
            </div>
          </td>
          <td>
            <div class="pm-new-goods-roas-cell">
              <label class="pm-new-fast-start-control">
                <span>{{ fastStartLabel }}</span>
                <a-switch
                  :model-value="getRowDraft(row).fastStartEnabled"
                  size="small"
                  @change="(value) => $emit('update-row-draft', row, { fastStartEnabled: value })"
                />
              </label>

              <a-radio-group
                :model-value="getRowDraft(row).roasMode"
                class="pm-new-roas-radio-group"
                @change="(value) => $emit('update-row-draft', row, { roasMode: value })"
              >
                <a-radio
                  v-for="option in getRoasOptions(row)"
                  :key="option.value"
                  :value="option.value"
                  :disabled="option.disabled"
                >
                  <span
                    class="pm-new-roas-option"
                    :title="option.title"
                  >
                    <strong>{{ option.label }}</strong>
                    <em v-if="option.roasText">ROAS {{ option.roasText }}</em>
                  </span>
                </a-radio>
                <a-radio :value="roasModeCustom">
                  <span class="pm-new-roas-option">
                    <strong>{{ customLabel }}</strong>
                  </span>
                </a-radio>
              </a-radio-group>

              <div
                v-if="getRowDraft(row).roasMode === roasModeCustom"
                class="pm-new-control-inline"
              >
                <a-input-number
                  :model-value="getRowDraft(row).customRoas"
                  :min="getCustomRoasMin(row)"
                  :max="getCustomRoasMax(row)"
                  :precision="2"
                  :step="0.01"
                  size="small"
                  mode="button"
                  @change="(value) => $emit('update-row-draft', row, { customRoas: value })"
                />
              </div>
              <span
                v-if="buildCustomRoasHint(row)"
                class="pm-new-goods-field-hint"
              >
                {{ customRoasRangeLabel }} {{ buildCustomRoasHint(row) }}
              </span>
            </div>
          </td>
        </tr>
        <tr v-if="rows.length <= 0">
          <td colspan="4">
            <div class="pm-new-goods-empty">
              {{ emptyText }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  BUDGET_MODE_OPTIONS,
  BUDGET_MODE_CUSTOM,
  ROAS_MODE_CUSTOM,
  buildCustomRoasHint,
  buildDailyBudgetHint,
  buildRoasPredictionOptions,
  getCustomRoasBounds,
  getDailyBudgetBounds,
  getGoodsRowKey
} from '../view-models/createPromotionGoodsRows.js';

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  selectedRowKeys: {
    type: Array,
    default: () => []
  },
  rowDrafts: {
    type: Object,
    default: () => ({})
  },
  emptyText: {
    type: String,
    default: ''
  }
});

defineEmits([
  'toggle-all-visible',
  'toggle-row',
  'update-row-draft'
]);

const goodsColumnProduct = '\u5546\u54c1';
const goodsColumnDailyBudget = '\u63a8\u5e7f\u65e5\u9884\u7b97';
const goodsColumnTargetRoas = '\u76ee\u6807\u5168\u57dfROAS';
const goodsIdLabel = 'Goods';
const spuIdLabel = 'SPU';
const skuLabel = 'SKU';
const mallIdLabel = 'Mall';
const createdAtLabel = '\u521b\u5efa';
const categoryLabel = '\u7c7b\u76ee';
const siteLabel = '\u7ad9\u70b9';
const priceLabel = '\u4f9b\u8d27\u4ef7';
const stockLabel = '\u5e93\u5b58';
const salesLabel = '\u9500\u91cf';
const promotionLabel = '\u63a8\u5e7f';
const fastStartLabel = '\u6781\u901f\u8d77\u91cf';
const customLabel = '\u81ea\u5b9a\u4e49';
const dailyBudgetRangeLabel = '\u53ef\u7528\u8303\u56f4';
const customRoasRangeLabel = '\u53c2\u8003\u8303\u56f4';
const emptyCellText = '-';
const noImageText = '\u65e0\u56fe';
const budgetModeOptions = BUDGET_MODE_OPTIONS;
const budgetModeCustom = BUDGET_MODE_CUSTOM;
const roasModeCustom = ROAS_MODE_CUSTOM;

const selectedRowKeySet = computed(() => new Set(props.selectedRowKeys));

const visibleRowKeys = computed(() => props.rows
  .map(getGoodsRowKey)
  .filter(Boolean));

const allVisibleRowsSelected = computed(() => (
  visibleRowKeys.value.length > 0
  && visibleRowKeys.value.every((rowKey) => selectedRowKeySet.value.has(rowKey))
));

const someVisibleRowsSelected = computed(() => (
  visibleRowKeys.value.some((rowKey) => selectedRowKeySet.value.has(rowKey))
  && !allVisibleRowsSelected.value
));

function isRowSelected(row) {
  return selectedRowKeySet.value.has(getGoodsRowKey(row));
}

function getRowDraft(row) {
  return props.rowDrafts[getGoodsRowKey(row)] || {};
}

function getRoasOptions(row) {
  return buildRoasPredictionOptions(row);
}

function getDailyBudgetMin(row) {
  const bounds = getDailyBudgetBounds(row);

  return bounds.min === null ? 0 : bounds.min;
}

function getDailyBudgetMax(row) {
  const bounds = getDailyBudgetBounds(row);

  return bounds.max === null ? undefined : bounds.max;
}

function getCustomRoasMin(row) {
  const bounds = getCustomRoasBounds(row);

  return bounds.min === null ? 0 : bounds.min;
}

function getCustomRoasMax(row) {
  const bounds = getCustomRoasBounds(row);

  return bounds.max === null ? undefined : bounds.max;
}
</script>
