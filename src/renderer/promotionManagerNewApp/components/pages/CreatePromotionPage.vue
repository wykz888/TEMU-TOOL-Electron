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

    <div class="pm-new-create-grid">
      <section class="pm-new-page-panel pm-new-product-panel">
        <div class="pm-new-shop-query-row">
          <ShopSelectDropdown
            v-model="selectedShopIds"
            :placeholder="shopSelectPlaceholder"
            storage-key="promotion-manager-new:create-shop-selection"
          />
          <label class="pm-new-query-region">
            <span>{{ regionSelectLabel }}</span>
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
            @click="handleShopQuery"
          >
            {{ queryButtonLabel }}
          </a-button>
        </div>
        <div class="pm-new-section-title">
          <strong>{{ productTitle }}</strong>
          <a-tag size="small" bordered>{{ productCountText }}</a-tag>
        </div>
        <div class="pm-new-filter-row">
          <a-input :placeholder="productPlaceholder" />
          <a-button type="outline">{{ filterButtonLabel }}</a-button>
        </div>
        <div class="pm-new-table-scroll">
          <table>
            <thead>
              <tr>
                <th v-for="column in columns" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="pm-new-page-panel pm-new-strategy-panel">
        <div class="pm-new-section-title">
          <strong>{{ strategyTitle }}</strong>
          <a-tag size="small" bordered>{{ strategyTag }}</a-tag>
        </div>
        <div class="pm-new-form-stack">
          <label>
            <span>{{ budgetLabel }}</span>
            <a-input :placeholder="budgetPlaceholder" />
          </label>
          <label>
            <span>{{ roasLabel }}</span>
            <a-input :placeholder="roasPlaceholder" />
          </label>
          <label>
            <span>{{ scheduleLabel }}</span>
            <a-select :placeholder="schedulePlaceholder" />
          </label>
        </div>
      </aside>
    </div>

  </section>
</template>

<script setup>
import { ref } from 'vue';
import ShopSelectDropdown from '../../../shared/shopSelection/ShopSelectDropdown.vue';

defineProps({
  columns: {
    type: Array,
    default: () => []
  },
  rows: {
    type: Array,
    default: () => []
  }
});

const selectedShopIds = ref([]);
const queriedShopIds = ref([]);
const selectedRegionCodes = ref([]);
const queriedRegionCodes = ref([]);

const title = '\u65b0\u5efa\u63a8\u5e7f';
const draftButtonLabel = '\u4fdd\u5b58\u8349\u7a3f';
const submitButtonLabel = '\u63d0\u4ea4\u4efb\u52a1';
const productTitle = '\u5e97\u94fa\u4e0e\u5546\u54c1';
const productCountText = '\u5546\u54c1\u6c60';
const shopSelectPlaceholder = '\u5e97\u94fa\u9009\u62e9';
const regionSelectLabel = '\u67e5\u8be2\u5730\u533a';
const regionSelectPlaceholder = '\u9009\u62e9\u5730\u533a';
const queryButtonLabel = '\u67e5\u8be2';
const productPlaceholder = '\u641c\u7d22\u5546\u54c1';
const filterButtonLabel = '\u7b5b\u9009';
const strategyTitle = '\u63a8\u5e7f\u7b56\u7565';
const strategyTag = '\u6279\u91cf\u914d\u7f6e';
const budgetLabel = '\u65e5\u9884\u7b97';
const budgetPlaceholder = '\u8f93\u5165\u9884\u7b97';
const roasLabel = '\u76ee\u6807 ROAS';
const roasPlaceholder = '\u8f93\u5165 ROAS';
const scheduleLabel = '\u6267\u884c\u8282\u594f';
const schedulePlaceholder = '\u9009\u62e9\u8282\u594f';
const regionOptions = [
  { value: 'us', label: '\u7f8e\u56fd' },
  { value: 'eu', label: '\u6b27\u533a' },
  { value: 'global', label: '\u5168\u7403' }
];

function handleShopQuery() {
  queriedShopIds.value = selectedShopIds.value.slice();
  queriedRegionCodes.value = selectedRegionCodes.value.slice();
}
</script>
