<template>
  <a-table
    class="pm-new-goods-table"
    row-key="rowKey"
    :data="tableRows"
    :pagination="false"
    :bordered="false"
    :hoverable="true"
    :stripe="false"
    :table-layout-fixed="true"
    :scroll="tableScroll"
    :row-selection="rowSelection"
    :selected-keys="selectedRowKeys"
    :row-class="getRowClass"
    size="small"
    @selection-change="$emit('selection-change', $event)"
  >
    <template #columns>
      <a-table-column
        :title="goodsColumnProduct"
        data-index="goodsName"
        :width="goodsColumnProductWidth"
      >
        <template #cell="{ record }">
          <div class="pm-new-goods-product-cell">
            <img
              v-if="record.thumbUrl"
              :src="record.thumbUrl"
              :alt="record.goodsName"
            />
            <span
              v-else
              class="pm-new-goods-thumb-empty"
            >
              {{ noImageText }}
            </span>
            <div class="pm-new-goods-main-info">
              <strong :title="record.goodsName">{{ record.goodsName || emptyCellText }}</strong>
              <div class="pm-new-goods-id-grid">
                <span>{{ goodsIdLabel }} {{ record.goodsId || emptyCellText }}</span>
                <span>{{ spuIdLabel }} {{ record.spuId || emptyCellText }}</span>
                <span>{{ skuLabel }} {{ record.skuEncode || emptyCellText }}</span>
              </div>
              <div class="pm-new-goods-inline-meta">
                <span>{{ record.shopName || emptyCellText }}</span>
                <span>{{ record.regionLabel || emptyCellText }}</span>
                <span>{{ mallIdLabel }} {{ record.mallId || emptyCellText }}</span>
                <span>{{ createdAtLabel }} {{ record.createdAtText || emptyCellText }}</span>
              </div>
              <div class="pm-new-goods-inline-meta">
                <span :title="record.categoryText">{{ categoryLabel }} {{ record.categoryText || emptyCellText }}</span>
                <span :title="record.siteText">{{ siteLabel }} {{ record.siteText || emptyCellText }}</span>
              </div>
              <div class="pm-new-goods-inline-meta">
                <span>{{ priceLabel }} {{ record.priceText || emptyCellText }}</span>
                <span>{{ stockLabel }} {{ record.skuTotalQuantity || emptyCellText }}</span>
                <span>{{ salesLabel }} {{ record.sales || emptyCellText }}</span>
                <span :title="record.promotionText">{{ promotionLabel }} {{ record.promotionText || emptyCellText }}</span>
              </div>
            </div>
          </div>
        </template>
      </a-table-column>
      <a-table-column
        :title="goodsColumnDailyBudget"
        data-index="dailyBudget"
        :width="goodsColumnDailyBudgetWidth"
      >
        <template #cell="{ record }">
          <div class="pm-new-goods-control-cell">
            <a-radio-group
              class="pm-new-budget-radio-group"
              :model-value="getRowDraft(record).budgetMode"
              type="button"
              size="small"
              @change="(value) => $emit('update-row-draft', record, { budgetMode: value })"
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
              v-if="getRowDraft(record).budgetMode === budgetModeCustom"
              class="pm-new-control-inline"
            >
              <a-input-number
                :model-value="getRowDraft(record).customBudget"
                :min="getDailyBudgetMin(record)"
                :max="getDailyBudgetMax(record)"
                :precision="0"
                size="small"
                mode="button"
                model-event="input"
                @update:model-value="(value) => $emit('update-row-draft', record, { customBudget: value })"
              />
            </div>
            <span
              v-if="isBudgetCustom(record) && buildDailyBudgetHint(record)"
              class="pm-new-goods-field-hint"
            >
              {{ dailyBudgetRangeLabel }} {{ buildDailyBudgetHint(record) }}
            </span>
          </div>
        </template>
      </a-table-column>
      <a-table-column
        :title="goodsColumnTargetRoas"
        data-index="targetRoas"
        :width="goodsColumnTargetRoasWidth"
      >
        <template #cell="{ record }">
          <div class="pm-new-goods-roas-cell">
            <label class="pm-new-fast-start-control">
              <span>{{ fastStartLabel }}</span>
              <a-switch
                :model-value="getRowDraft(record).fastStartEnabled"
                size="small"
                @change="(value) => $emit('update-row-draft', record, { fastStartEnabled: value })"
              />
            </label>

            <a-radio-group
              :model-value="getRowDraft(record).roasMode"
              class="pm-new-roas-radio-group"
              @change="(value) => $emit('update-row-draft', record, { roasMode: value })"
            >
              <a-radio
                v-for="option in getRoasOptions(record)"
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
              v-if="getRowDraft(record).roasMode === roasModeCustom"
              class="pm-new-control-inline"
            >
              <a-input-number
                :model-value="getRowDraft(record).customRoas"
                :min="getCustomRoasMin(record)"
                :max="getCustomRoasMax(record)"
                :precision="2"
                :step="0.01"
                size="small"
                mode="button"
                model-event="input"
                @update:model-value="(value) => $emit('update-row-draft', record, { customRoas: value })"
              />
            </div>
            <span
              v-if="isRoasCustom(record) && buildCustomRoasHint(record)"
              class="pm-new-goods-field-hint"
            >
              {{ customRoasRangeLabel }} {{ buildCustomRoasHint(record) }}
            </span>
          </div>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <div class="pm-new-goods-empty">
        {{ emptyText }}
      </div>
    </template>
  </a-table>
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
  'selection-change',
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
const goodsColumnProductWidth = 640;
const goodsColumnDailyBudgetWidth = 250;
const goodsColumnTargetRoasWidth = 420;

const rowSelection = Object.freeze({
  type: 'checkbox',
  showCheckedAll: true,
  width: 46,
  fixed: true
});

const tableScroll = Object.freeze({
  x: 1360,
  y: '100%'
});

const tableRows = computed(() => props.rows.map((row) => ({
  ...row,
  rowKey: getGoodsRowKey(row)
})));

function getRowClass() {
  return 'pm-new-goods-row';
}

function getRowDraft(row) {
  return props.rowDrafts[getGoodsRowKey(row)] || {};
}

function isBudgetCustom(row) {
  return getRowDraft(row).budgetMode === budgetModeCustom;
}

function isRoasCustom(row) {
  return getRowDraft(row).roasMode === roasModeCustom;
}

function getRoasOptions(row) {
  return buildRoasPredictionOptions(row);
}

function getDailyBudgetMin(row) {
  const bounds = getDailyBudgetBounds(row);

  return bounds.min === null ? undefined : bounds.min;
}

function getDailyBudgetMax(row) {
  const bounds = getDailyBudgetBounds(row);

  return bounds.max === null ? undefined : bounds.max;
}

function getCustomRoasMin(row) {
  const bounds = getCustomRoasBounds(row);

  return bounds.min === null ? undefined : bounds.min;
}

function getCustomRoasMax(row) {
  const bounds = getCustomRoasBounds(row);

  return bounds.max === null ? undefined : bounds.max;
}
</script>
