<template>
  <div
    class="pm-new-table-shell pm-new-detail-table-shell"
    :class="{ 'is-empty': tableRows.length <= 0 }"
  >
    <a-table
      class="pm-new-goods-table pm-new-detail-table"
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
          :title="detailColumnPromotion"
          data-index="productName"
          :width="promotionColumnWidth"
        >
          <template #cell="{ record }">
            <div class="pm-new-detail-product-cell">
              <a-image
                v-if="record.productImageUrl"
                class="pm-new-detail-thumb-image"
                :src="getThumbnailUrl(record.productImageUrl)"
                :preview-props="getPreviewProps(record.productImageUrl)"
                :alt="record.productName"
                :width="detailThumbSize"
                :height="detailThumbSize"
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
              <div class="pm-new-detail-product-main">
                <strong :title="record.productName">{{ record.productName || emptyCellText }}</strong>
                <div class="pm-new-goods-id-grid">
                  <span class="pm-new-goods-id-chip">{{ goodsIdLabel }} {{ record.goodsId || emptyCellText }}</span>
                  <span class="pm-new-goods-id-chip">{{ adIdLabel }} {{ record.adId || emptyCellText }}</span>
                  <span class="pm-new-goods-id-chip">{{ spuIdLabel }} {{ record.spuId || emptyCellText }}</span>
                </div>
                <div class="pm-new-goods-inline-meta">
                  <span class="pm-new-goods-meta-chip is-shop">{{ record.shopName || emptyCellText }}</span>
                  <span class="pm-new-goods-meta-chip is-region">{{ record.regionLabel || emptyCellText }}</span>
                  <span
                    class="pm-new-goods-meta-chip"
                    :title="record.siteText"
                  >
                    {{ siteLabel }} {{ record.siteText || emptyCellText }}
                  </span>
                </div>
                <div class="pm-new-goods-inline-meta pm-new-goods-inline-meta--taxonomy">
                  <span
                    class="pm-new-goods-meta-chip"
                    :title="record.categoryText"
                  >
                    {{ categoryLabel }} {{ record.categoryText || emptyCellText }}
                  </span>
                  <span class="pm-new-goods-meta-chip">{{ createdAtLabel }} {{ record.createdAtText || emptyCellText }}</span>
                </div>
              </div>
            </div>
          </template>
        </a-table-column>

        <a-table-column
          :title="detailColumnStatus"
          data-index="statusLabel"
          :width="statusColumnWidth"
          align="center"
        >
          <template #cell="{ record }">
            <div class="pm-new-detail-status-cell">
              <a-tag
                class="pm-new-detail-status-tag"
                :class="getStatusClass(record)"
                size="small"
                bordered
              >
                {{ record.statusLabel || emptyCellText }}
              </a-tag>
              <span>{{ fastStartLabel }} {{ record.fastStartText || emptyCellText }}</span>
              <span>{{ roasTypeLabel }} {{ record.roasTypeText || emptyCellText }}</span>
            </div>
          </template>
        </a-table-column>

        <a-table-column
          :title="detailColumnMetrics"
          data-index="metrics"
          :width="metricsColumnWidth"
        >
          <template #cell="{ record }">
            <div class="pm-new-detail-metrics-grid">
              <span>
                <em>{{ spendLabel }}</em>
                <strong>{{ record.spendText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ netSpendLabel }}</em>
                <strong>{{ record.netSpendText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ salesAmountLabel }}</em>
                <strong>{{ record.salesAmountText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ roasLabel }}</em>
                <strong>{{ record.roasText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ costPerOrderLabel }}</em>
                <strong>{{ record.costPerOrderText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ orderCountLabel }}</em>
                <strong>{{ record.orderCountText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ exposureLabel }}</em>
                <strong>{{ record.impressionText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ clickLabel }}</em>
                <strong>{{ record.clickText || emptyCellText }}</strong>
              </span>
            </div>
          </template>
        </a-table-column>

        <a-table-column
          :title="detailColumnSettings"
          data-index="settings"
          :width="settingsColumnWidth"
        >
          <template #cell="{ record }">
            <div class="pm-new-detail-setting-cell">
              <span>
                <em>{{ dailyBudgetLabel }}</em>
                <strong>{{ record.dailyBudgetText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ targetRoasLabel }}</em>
                <strong>{{ record.targetRoasText || emptyCellText }}</strong>
              </span>
              <span>
                <em>{{ updatedAtLabel }}</em>
                <strong>{{ record.updatedAtText || emptyCellText }}</strong>
              </span>
            </div>
          </template>
        </a-table-column>

        <a-table-column
          :title="detailColumnAction"
          data-index="actionStatus"
          :width="actionColumnWidth"
          align="center"
        >
          <template #cell="{ record }">
            <div class="pm-new-create-status-cell pm-new-detail-action-status-cell">
              <a-tag
                class="pm-new-create-status-tag"
                :class="getActionStatusClass(record)"
                size="small"
                bordered
              >
                {{ getActionStatusRecord(record).label || pendingActionLabel }}
              </a-tag>
              <span
                v-if="getActionStatusRecord(record).message"
                :title="getActionStatusRecord(record).message"
              >
                {{ getActionStatusRecord(record).message }}
              </span>
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
  DETAIL_STATUS_DELETED,
  DETAIL_STATUS_ENDED,
  DETAIL_STATUS_GOODS_OFFLINE,
  DETAIL_STATUS_PAUSED,
  DETAIL_STATUS_RUNNING
} from '../view-models/promotionDetailRows.js';
import {
  getDetailActionStatusRecord
} from '../view-models/promotionDetailActionStatus.js';
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
  emptyText: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  rowActionStatuses: {
    type: Object,
    default: () => ({})
  }
});

defineEmits(['selection-change']);

const detailColumnPromotion = '\u63a8\u5e7f\u5546\u54c1';
const detailColumnStatus = '\u63a8\u5e7f\u72b6\u6001';
const detailColumnMetrics = '\u63a8\u5e7f\u6570\u636e';
const detailColumnSettings = '\u6295\u653e\u8bbe\u7f6e';
const detailColumnAction = '\u64cd\u4f5c\u72b6\u6001';
const goodsIdLabel = 'Goods';
const adIdLabel = 'Ad';
const spuIdLabel = 'SPU';
const siteLabel = '\u7ad9\u70b9';
const categoryLabel = '\u7c7b\u76ee';
const createdAtLabel = '\u521b\u5efa';
const fastStartLabel = '\u6781\u901f\u8d77\u91cf';
const roasTypeLabel = '\u63a8\u5e7f\u7c7b\u578b';
const spendLabel = '\u603b\u82b1\u8d39';
const netSpendLabel = '\u51c0\u603b\u82b1\u8d39';
const salesAmountLabel = '\u7533\u62a5\u9500\u552e\u989d';
const roasLabel = '\u6210\u4ea4ROAS';
const costPerOrderLabel = '\u6bcf\u7b14\u6210\u4ea4\u82b1\u8d39';
const orderCountLabel = '\u5b50\u8ba2\u5355';
const exposureLabel = '\u66dd\u5149';
const clickLabel = '\u70b9\u51fb';
const dailyBudgetLabel = '\u65e5\u9884\u7b97';
const targetRoasLabel = '\u76ee\u6807ROAS';
const updatedAtLabel = '\u66f4\u65b0';
const noImageText = '\u65e0\u56fe';
const emptyCellText = '-';
const pendingActionLabel = '\u5f85\u5904\u7406';
const promotionColumnWidth = 420;
const statusColumnWidth = 136;
const metricsColumnWidth = 300;
const settingsColumnWidth = 200;
const actionColumnWidth = 164;
const detailThumbSize = 72;
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
  estimatedSize: 134,
  buffer: 14
});

const tableRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));

const tableScroll = computed(() => dataTableScroll);

const tableVirtualListProps = computed(() => (
  tableRows.value.length >= virtualListThreshold ? virtualListProps : undefined
));

function getRowClass() {
  return 'pm-new-detail-row';
}

function getStatusClass(record) {
  const statusValue = record && record.statusValue;

  if (statusValue === DETAIL_STATUS_RUNNING) {
    return 'is-success';
  }

  if (statusValue === DETAIL_STATUS_PAUSED) {
    return 'is-warning';
  }

  if (statusValue === DETAIL_STATUS_GOODS_OFFLINE) {
    return 'is-error';
  }

  if (statusValue === DETAIL_STATUS_DELETED) {
    return 'is-error';
  }

  if (statusValue === DETAIL_STATUS_ENDED) {
    return 'is-info';
  }

  return 'is-pending';
}

function getActionStatusClass(record) {
  const statusValue = getActionStatusRecord(record).status;

  if (statusValue === 'success') {
    return 'is-success';
  }

  if (statusValue === 'failed') {
    return 'is-error';
  }

  if (statusValue === 'warning' || statusValue === 'skipped' || statusValue === 'canceled') {
    return 'is-warning';
  }

  if (statusValue === 'running' || statusValue === 'configured') {
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

function getActionStatusRecord(record) {
  return getDetailActionStatusRecord(props.rowActionStatuses, record);
}
</script>
