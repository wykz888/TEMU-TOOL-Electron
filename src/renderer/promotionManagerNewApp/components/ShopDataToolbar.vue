<template>
  <div class="pm-new-create-toolbar pm-new-shop-data-toolbar">
    <section class="pm-new-toolbar-group pm-new-toolbar-query-group">
      <span class="pm-new-toolbar-group-title">{{ queryGroupTitle }}</span>
      <div class="pm-new-toolbar-query-fields pm-new-shop-data-query-fields">
        <div
          class="pm-new-toolbar-field pm-new-toolbar-shop-field"
          role="group"
        >
          <span class="pm-new-toolbar-field-label">{{ shopSelectLabel }}</span>
          <ShopSelectDropdown
            class="pm-new-toolbar-shop-select"
            :model-value="props.selectedShopIds"
            :placeholder="shopSelectPlaceholder"
            storage-key="promotion-manager-new:shop-data-selection"
            @update:model-value="emitSelectedShopIds"
          />
        </div>
        <div
          class="pm-new-toolbar-field pm-new-toolbar-region-field"
          role="group"
        >
          <span class="pm-new-toolbar-field-label">{{ regionSelectLabel }}</span>
          <a-select
            :model-value="props.selectedRegionIds"
            class="pm-new-toolbar-select pm-new-toolbar-region-select"
            multiple
            allow-clear
            popup-container="body"
            size="small"
            :max-tag-count="1"
            tag-nowrap
            :placeholder="regionSelectPlaceholder"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitSelectedRegionIds"
          >
            <a-option
              v-for="region in props.regionOptions"
              :key="region.value"
              :value="region.value"
              :label="region.label"
            >
              {{ region.label }}
            </a-option>
          </a-select>
        </div>
        <div
          class="pm-new-toolbar-field pm-new-toolbar-date-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ dateRangeLabel }}</span>
          <a-range-picker
            :model-value="props.queryDateRange"
            class="pm-new-toolbar-date-range"
            popup-container="body"
            size="small"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :placeholder="dateRangePlaceholder"
            :shortcuts="props.dateShortcuts"
            shortcuts-position="bottom"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitQueryDateRange"
          />
        </div>
        <div class="pm-new-toolbar-query-buttons pm-new-shop-data-query-buttons">
          <a-button
            class="pm-new-toolbar-query-button"
            type="primary"
            :loading="props.queryLoading"
            :disabled="props.queryDisabled"
            @click="emit('query')"
          >
            <template #icon>
              <IconSearch />
            </template>
            {{ queryButtonLabel }}
          </a-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { IconSearch } from '@arco-design/web-vue/es/icon';
import ShopSelectDropdown from '../../shared/shopSelection/ShopSelectDropdown.vue';

const props = defineProps({
  selectedShopIds: {
    type: Array,
    default: () => []
  },
  selectedRegionIds: {
    type: Array,
    default: () => []
  },
  regionOptions: {
    type: Array,
    default: () => []
  },
  queryLoading: {
    type: Boolean,
    default: false
  },
  queryDisabled: {
    type: Boolean,
    default: false
  },
  queryDateRange: {
    type: Array,
    default: () => []
  },
  dateShortcuts: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'update:selectedShopIds',
  'update:selectedRegionIds',
  'update:queryDateRange',
  'query'
]);

const queryGroupTitle = '\u67e5\u8be2\u6761\u4ef6';
const shopSelectLabel = '\u5e97\u94fa\u9009\u62e9\uff1a';
const shopSelectPlaceholder = '\u5e97\u94fa\u9009\u62e9';
const regionSelectLabel = '\u67e5\u8be2\u5730\u533a\uff1a';
const regionSelectPlaceholder = '\u9009\u62e9\u5730\u533a';
const dateRangeLabel = '\u6570\u636e\u65f6\u95f4\uff1a';
const dateRangePlaceholder = Object.freeze([
  '\u5f00\u59cb\u65e5\u671f',
  '\u7ed3\u675f\u65e5\u671f'
]);
const queryButtonLabel = '\u67e5\u8be2\u6570\u636e';
const stableSelectTriggerProps = Object.freeze({
  autoFitPopupMinWidth: true,
  updateAtScroll: true
});

function emitSelectedShopIds(value) {
  emit('update:selectedShopIds', Array.isArray(value) ? value : []);
}

function emitSelectedRegionIds(value) {
  const validRegionValues = new Set(
    (Array.isArray(props.regionOptions) ? props.regionOptions : []).map((option) => option && option.value)
  );
  const nextValues = (Array.isArray(value) ? value : [])
    .filter((entry) => validRegionValues.has(entry));

  emit('update:selectedRegionIds', nextValues);
}

function emitQueryDateRange(value) {
  emit('update:queryDateRange', Array.isArray(value) ? value.slice(0, 2) : []);
}
</script>
