<template>
  <div
    class="pm-new-table-shell pm-new-create-table-shell"
    :class="{ 'is-empty': tableRows.length <= 0 }"
  >
    <a-table
      class="pm-new-goods-table"
      :class="{ 'is-empty': tableRows.length <= 0 }"
      row-key="id"
      :data="tableRows"
      :pagination="false"
      :bordered="false"
      :hoverable="true"
      :stripe="false"
      :table-layout-fixed="true"
      :scroll="tableScroll"
      :virtual-list-props="tableVirtualListProps"
      :row-selection="rowSelection"
      :selected-keys="selectedRowKeys"
      :row-class="getRowClass"
      :loading="loading"
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
              <a-image
                v-if="record.thumbUrl"
                class="pm-new-goods-thumb-image"
                :src="getThumbnailUrl(record.thumbUrl)"
                :preview-props="getPreviewProps(record.thumbUrl)"
                :alt="record.goodsName"
                :width="goodsThumbSize"
                :height="goodsThumbSize"
                fit="cover"
                loading="lazy"
                decoding="async"
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
                  <span class="pm-new-goods-id-chip">{{ goodsIdLabel }} {{ record.goodsId || emptyCellText }}</span>
                  <span class="pm-new-goods-id-chip">{{ spuIdLabel }} {{ record.spuId || emptyCellText }}</span>
                  <span class="pm-new-goods-id-chip">{{ skuLabel }} {{ record.skuEncode || emptyCellText }}</span>
                </div>
                <div class="pm-new-goods-inline-meta pm-new-goods-inline-meta--channel">
                  <span class="pm-new-goods-meta-chip is-shop">{{ record.shopName || emptyCellText }}</span>
                  <span class="pm-new-goods-meta-chip is-region">{{ record.regionLabel || emptyCellText }}</span>
                  <span class="pm-new-goods-meta-chip">{{ mallIdLabel }} {{ record.mallId || emptyCellText }}</span>
                  <span class="pm-new-goods-meta-chip">{{ createdAtLabel }} {{ record.createdAtText || emptyCellText }}</span>
                </div>
                <div class="pm-new-goods-inline-meta pm-new-goods-inline-meta--taxonomy">
                  <span
                    class="pm-new-goods-meta-chip"
                    :title="record.categoryText"
                  >
                    {{ categoryLabel }} {{ record.categoryText || emptyCellText }}
                  </span>
                  <span
                    class="pm-new-goods-meta-chip"
                    :title="record.siteText"
                  >
                    {{ siteLabel }} {{ record.siteText || emptyCellText }}
                  </span>
                </div>
                <div class="pm-new-goods-inline-meta pm-new-goods-inline-meta--stats">
                  <span class="pm-new-goods-stat-chip">{{ priceLabel }} {{ record.priceText || emptyCellText }}</span>
                  <span class="pm-new-goods-stat-chip">{{ stockLabel }} {{ record.skuTotalQuantity || emptyCellText }}</span>
                  <span class="pm-new-goods-stat-chip">{{ salesLabel }} {{ record.sales || emptyCellText }}</span>
                  <span
                    class="pm-new-goods-stat-chip"
                    :title="record.promotionText"
                  >
                    {{ promotionLabel }} {{ record.promotionText || emptyCellText }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </a-table-column>
        <a-table-column
          :title="goodsColumnCreateStatus"
          data-index="createStatus"
          :width="goodsColumnCreateStatusWidth"
          align="center"
        >
          <template #cell="{ record }">
            <div class="pm-new-create-status-cell">
              <a-tag
                class="pm-new-create-status-tag"
                :class="getCreateStatusClass(record)"
                size="small"
                bordered
              >
                {{ getCreateStatus(record).label }}
              </a-tag>
              <span
                v-if="getCreateStatus(record).message"
                :title="getCreateStatus(record).message"
              >
                {{ getCreateStatus(record).message }}
              </span>
            </div>
          </template>
        </a-table-column>
        <a-table-column
          :title="goodsColumnDailyBudget"
          data-index="dailyBudget"
          :width="goodsColumnDailyBudgetWidth"
          align="center"
        >
          <template #cell="{ record }">
            <div class="pm-new-goods-control-cell">
              <div class="pm-new-budget-control-row">
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
                    hide-button
                    model-event="input"
                    @update:model-value="(value) => $emit('update-row-draft', record, { customBudget: value })"
                  />
                </div>
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
          align="center"
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
                    <span
                      v-if="option.estimatedRoasText || option.estimatedChargeText || option.estimatedChargeRatioText"
                      class="pm-new-roas-option-meta"
                    >
                      <em v-if="option.estimatedRoasText">{{ option.estimatedRoasText }}</em>
                      <em v-if="option.estimatedChargeText">{{ option.estimatedChargeText }}</em>
                      <em v-if="option.estimatedChargeRatioText">{{ option.estimatedChargeRatioText }}</em>
                    </span>
                  </span>
                </a-radio>
                <a-radio :value="roasModeCustom">
                  <span class="pm-new-roas-option pm-new-roas-option--custom">
                    <strong>{{ customLabel }}</strong>
                    <span
                      v-if="getRowDraft(record).roasMode === roasModeCustom"
                      class="pm-new-roas-custom-inline"
                    >
                      <a-input-number
                        :model-value="getRowDraft(record).customRoas"
                        :min="getCustomRoasMin(record)"
                        :max="getCustomRoasMax(record)"
                        :precision="2"
                        :step="0.01"
                        size="mini"
                        hide-button
                        model-event="input"
                        @click.stop
                        @update:model-value="(value) => $emit('update-row-draft', record, { customRoas: value })"
                      />
                    </span>
                    <span
                      v-if="isRoasCustom(record) && buildCustomRoasHint(record)"
                      class="pm-new-roas-custom-range"
                      :title="`${customRoasRangeLabel} ${buildCustomRoasHint(record)}`"
                    >
                      {{ customRoasRangeLabel }} {{ buildCustomRoasHint(record) }}
                    </span>
                    <em
                      v-for="text in getCustomRoasEstimateTexts(record)"
                      :key="text"
                      class="pm-new-roas-custom-estimate"
                    >
                      {{ text }}
                    </em>
                  </span>
                </a-radio>
              </a-radio-group>
            </div>
          </template>
        </a-table-column>
      </template>
      <template #empty>
        <span class="pm-new-table-native-empty"></span>
      </template>
    </a-table>

    <div
      v-if="tableRows.length <= 0"
      class="pm-new-table-empty-overlay pm-new-goods-empty"
    >
      {{ emptyText }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  BUDGET_MODE_OPTIONS,
  BUDGET_MODE_CUSTOM,
  ROAS_MODE_CUSTOM,
  buildGoodsRowDraft,
  buildCustomRoasHint,
  buildDailyBudgetHint,
  buildRoasEstimateTextList,
  buildRoasPredictionOptions,
  getCustomRoasBounds,
  getDailyBudgetBounds,
  getGoodsRowKey
} from '../view-models/createPromotionGoodsRows.js';
import {
  CREATE_STATUS_CANCELED,
  CREATE_STATUS_CREATING,
  CREATE_STATUS_FAILED,
  CREATE_STATUS_SKIPPED,
  CREATE_STATUS_SUCCESS,
  getCreateStatusRecord
} from '../view-models/createPromotionSubmitStatus.js';
import {
  buildPromotionImagePreviewProps,
  buildPromotionThumbnailUrl
} from '../utils/promotionImageUrls.js';

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
  rowDraftVersion: {
    type: Number,
    default: 0
  },
  rowCreateStatuses: {
    type: Object,
    default: () => ({})
  },
  emptyText: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  'selection-change',
  'update-row-draft'
]);

const goodsColumnProduct = '\u5546\u54c1';
const goodsColumnCreateStatus = '\u521b\u5efa\u72b6\u6001';
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
const goodsColumnProductWidth = 480;
const goodsColumnCreateStatusWidth = 108;
const goodsColumnDailyBudgetWidth = 224;
const goodsColumnTargetRoasWidth = 360;
const goodsThumbSize = 76;
const virtualListThreshold = 120;
const thumbnailRequestSize = 160;

const rowSelection = Object.freeze({
  type: 'checkbox',
  showCheckedAll: true,
  width: 46,
  fixed: true
});

const dataTableScroll = Object.freeze({
  y: '100%'
});

const virtualListProps = Object.freeze({
  threshold: virtualListThreshold,
  estimatedSize: 156,
  buffer: 14
});

const tableRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));

const tableScroll = computed(() => (
  tableRows.value.length > 0 ? dataTableScroll : undefined
));

const tableVirtualListProps = computed(() => (
  tableRows.value.length >= virtualListThreshold ? virtualListProps : undefined
));

function getRowClass() {
  return 'pm-new-goods-row';
}

function getRowDraft(row) {
  props.rowDraftVersion;

  return props.rowDrafts[getGoodsRowKey(row)] || buildGoodsRowDraft(row);
}

function getCreateStatus(row) {
  return getCreateStatusRecord(props.rowCreateStatuses, row);
}

function getCreateStatusClass(row) {
  const status = getCreateStatus(row).status;

  if (status === CREATE_STATUS_SUCCESS) {
    return 'is-success';
  }

  if (status === CREATE_STATUS_FAILED) {
    return 'is-error';
  }

  if (status === CREATE_STATUS_SKIPPED || status === CREATE_STATUS_CANCELED) {
    return 'is-warning';
  }

  if (status === CREATE_STATUS_CREATING) {
    return 'is-info';
  }

  return 'is-pending';
}

function getThumbnailUrl(url) {
  return buildPromotionThumbnailUrl(url, thumbnailRequestSize);
}

function getPreviewProps(url) {
  return buildPromotionImagePreviewProps(url);
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

function getCustomRoasEstimateTexts(row) {
  if (!isRoasCustom(row)) {
    return [];
  }

  return buildRoasEstimateTextList(row, getRowDraft(row).customRoas);
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
