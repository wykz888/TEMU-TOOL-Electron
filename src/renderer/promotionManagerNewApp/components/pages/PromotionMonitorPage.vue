<template>
  <section class="pm-new-feature-page pm-new-feature-page--monitor">
    <section class="pm-new-page-panel pm-new-monitor-shop-panel">
      <div class="pm-new-section-title">
        <strong>{{ shopListTitle }}</strong>
        <div class="pm-new-monitor-shop-actions">
          <a-tag size="small" bordered>{{ shopCountText }}</a-tag>
          <a-button
            type="outline"
            size="small"
            :loading="loading"
            @click="loadShopRows"
          >
            <template #icon>
              <IconRefresh />
            </template>
            {{ refreshButtonLabel }}
          </a-button>
        </div>
      </div>

      <div class="pm-new-monitor-shop-body">
        <a-alert
          v-if="errorText"
          type="error"
          :content="errorText"
          show-icon
        />

        <a-table
          class="pm-new-monitor-shop-table"
          row-key="id"
          :columns="shopColumns"
          :data="shopRows"
          :pagination="false"
          :bordered="false"
          :loading="loading"
          size="small"
        >
          <template #status="{ record }">
            <a-tag color="green" size="small" bordered>{{ record.statusLabel }}</a-tag>
          </template>
          <template #note="{ record }">
            <span class="pm-new-monitor-shop-note">{{ record.note || emptyText }}</span>
          </template>
        </a-table>
      </div>
    </section>
  </section>
</template>

<script setup>
import { IconRefresh } from '@arco-design/web-vue/es/icon';
import { computed, onMounted, ref } from 'vue';
import { loadPromotionMonitorShopRows } from '../../services/promotionMonitorShops.js';
import { normalizeText } from '../../view-models/promotionMonitorShopRows.js';

const shopRows = ref([]);
const loading = ref(false);
const errorText = ref('');

const shopListTitle = '\u5e97\u94fa\u5217\u8868';
const refreshButtonLabel = '\u5237\u65b0';
const shopNameColumnLabel = '\u5e97\u94fa\u540d\u79f0';
const groupColumnLabel = '\u5206\u7ec4';
const noteColumnLabel = '\u5907\u6ce8';
const statusColumnLabel = '\u5e97\u94fa\u72b6\u6001';
const shopCountLabel = '\u5bb6\u5e97\u94fa';
const emptyText = '-';
const loadFailedText = '\u5e97\u94fa\u5217\u8868\u52a0\u8f7d\u5931\u8d25';

const shopColumns = Object.freeze([
  {
    title: shopNameColumnLabel,
    dataIndex: 'shopName',
    ellipsis: true,
    tooltip: true,
    minWidth: 180
  },
  {
    title: groupColumnLabel,
    dataIndex: 'groupName',
    ellipsis: true,
    tooltip: true,
    width: 160
  },
  {
    title: noteColumnLabel,
    dataIndex: 'note',
    slotName: 'note',
    ellipsis: true,
    tooltip: true,
    minWidth: 220
  },
  {
    title: statusColumnLabel,
    dataIndex: 'statusLabel',
    slotName: 'status',
    width: 120
  }
]);

const shopCountText = computed(() => `${shopRows.value.length} ${shopCountLabel}`);

async function loadShopRows() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  errorText.value = '';

  try {
    shopRows.value = await loadPromotionMonitorShopRows();
  } catch (error) {
    shopRows.value = [];
    errorText.value = normalizeText(error && error.message) || loadFailedText;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadShopRows();
});
</script>
