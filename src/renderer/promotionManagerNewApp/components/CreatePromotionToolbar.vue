<template>
  <div class="pm-new-create-toolbar">
    <section class="pm-new-toolbar-group pm-new-toolbar-query-group">
      <span class="pm-new-toolbar-group-title">{{ queryGroupTitle }}</span>
      <div class="pm-new-toolbar-query-fields">
        <div
          class="pm-new-toolbar-field pm-new-toolbar-shop-field"
          role="group"
        >
          <span class="pm-new-toolbar-field-label">{{ shopSelectLabel }}</span>
          <ShopSelectDropdown
            class="pm-new-toolbar-shop-select"
            :model-value="selectedShopIds"
            :placeholder="shopSelectPlaceholder"
            storage-key="promotion-manager-new:create-shop-selection"
            @update:model-value="emitSelectedShopIds"
          />
        </div>
        <div
          class="pm-new-toolbar-field pm-new-toolbar-region-field"
          role="group"
        >
          <span class="pm-new-toolbar-field-label">{{ regionSelectLabel }}</span>
          <a-select
            :model-value="selectedRegionCodes"
            class="pm-new-toolbar-select"
            multiple
            allow-clear
            popup-container="body"
            size="small"
            :max-tag-count="1"
            :placeholder="regionSelectPlaceholder"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitSelectedRegionCodes"
          >
            <a-option
              v-for="region in regionOptions"
              :key="region.value"
              :value="region.value"
            >
              {{ region.label }}
            </a-option>
          </a-select>
        </div>
        <div class="pm-new-toolbar-query-buttons">
          <a-button
            class="pm-new-toolbar-query-button"
            type="primary"
            :loading="queryLoading"
            @click="$emit('query')"
          >
            {{ queryButtonLabel }}
          </a-button>
          <a-button
            class="pm-new-toolbar-stop-button"
            status="danger"
            :disabled="!queryLoading"
            @click="$emit('stop-query')"
          >
            {{ stopQueryButtonLabel }}
          </a-button>
        </div>
      </div>
    </section>

    <section class="pm-new-toolbar-group pm-new-toolbar-filter-group">
      <span class="pm-new-toolbar-group-title">{{ filterGroupTitle }}</span>
      <div class="pm-new-toolbar-filter-fields">
        <a-select
          :model-value="asOptionValueList(filterValues.shopValues)"
          class="pm-new-toolbar-filter-select"
          multiple
          allow-clear
          allow-search
          popup-container="body"
          size="small"
          :max-tag-count="1"
          :placeholder="shopFilterPlaceholder"
          :trigger-props="stableSelectTriggerProps"
          @update:model-value="emitShopValues"
        >
          <a-option
            v-for="option in shopOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </a-option>
        </a-select>
        <a-input
          :model-value="filterValues.identityText"
          class="pm-new-toolbar-filter-input pm-new-toolbar-filter-input--wide"
          allow-clear
          size="small"
          :placeholder="identityPlaceholder"
          @update:model-value="(value) => patchFilterValues({ identityText: value })"
        />
        <a-select
          :model-value="asOptionValueList(filterValues.categoryValues)"
          class="pm-new-toolbar-filter-select pm-new-toolbar-filter-select--wide"
          multiple
          allow-clear
          allow-search
          popup-container="body"
          size="small"
          :max-tag-count="1"
          :placeholder="categoryPlaceholder"
          :trigger-props="stableSelectTriggerProps"
          @update:model-value="emitCategoryValues"
        >
          <a-option
            v-for="option in categoryOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </a-option>
        </a-select>
        <a-select
          :model-value="asOptionValueList(filterValues.siteValues)"
          class="pm-new-toolbar-filter-select"
          multiple
          allow-clear
          allow-search
          popup-container="body"
          size="small"
          :max-tag-count="1"
          :placeholder="sitePlaceholder"
          :trigger-props="stableSelectTriggerProps"
          @update:model-value="emitSiteValues"
        >
          <a-option
            v-for="option in siteOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </a-option>
        </a-select>
        <div
          class="pm-new-toolbar-field pm-new-toolbar-range-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ priceRangeLabel }}</span>
          <a-input-number
            :model-value="filterValues.priceMin"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="minNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ priceMin: value })"
          />
          <span class="pm-new-toolbar-range-separator">~</span>
          <a-input-number
            :model-value="filterValues.priceMax"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="maxNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ priceMax: value })"
          />
        </div>
        <div
          class="pm-new-toolbar-field pm-new-toolbar-range-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ salesRangeLabel }}</span>
          <a-input-number
            :model-value="filterValues.salesMin"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="0"
            :placeholder="minNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ salesMin: value })"
          />
          <span class="pm-new-toolbar-range-separator">~</span>
          <a-input-number
            :model-value="filterValues.salesMax"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="0"
            :placeholder="maxNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ salesMax: value })"
          />
        </div>
        <div
          class="pm-new-toolbar-field pm-new-toolbar-date-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ createdRangeLabel }}</span>
          <a-range-picker
            :model-value="filterValues.createdRange"
            class="pm-new-toolbar-date-range"
            popup-container="body"
            size="small"
            :placeholder="dateRangePlaceholder"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="(value) => patchFilterValues({ createdRange: value })"
          />
        </div>
        <div class="pm-new-toolbar-filter-buttons">
          <a-button
            type="primary"
            @click="$emit('search-filters')"
          >
            {{ filterSearchLabel }}
          </a-button>
          <a-button @click="$emit('reset-filters')">
            {{ filterResetLabel }}
          </a-button>
        </div>
      </div>
    </section>

    <section class="pm-new-toolbar-group pm-new-toolbar-action-group">
      <span class="pm-new-toolbar-group-title">{{ actionGroupTitle }}</span>
      <div class="pm-new-toolbar-action-fields">
        <div
          class="pm-new-toolbar-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ dailyBudgetLabel }}</span>
          <a-select
            :model-value="budgetMode"
            class="pm-new-toolbar-action-select"
            popup-container="body"
            size="small"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitBudgetMode"
          >
            <a-option
              v-for="option in budgetModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-option>
          </a-select>
          <a-input-number
            v-if="budgetMode === budgetModeCustom"
            :model-value="customBudget"
            class="pm-new-toolbar-custom-number"
            size="small"
            :min="0"
            :precision="0"
            :placeholder="budgetPlaceholder"
            model-event="input"
            @update:model-value="emitCustomBudget"
          />
        </div>
        <div
          class="pm-new-toolbar-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ roasLabel }}</span>
          <a-select
            :model-value="roasMode"
            class="pm-new-toolbar-action-select"
            popup-container="body"
            size="small"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitRoasMode"
          >
            <a-option
              v-for="option in roasModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-option>
          </a-select>
          <a-input-number
            v-if="roasMode === roasModeCustom"
            :model-value="customRoas"
            class="pm-new-toolbar-custom-number"
            size="small"
            :min="0"
            :precision="2"
            :step="0.01"
            :placeholder="roasPlaceholder"
            model-event="input"
            @update:model-value="emitCustomRoas"
          />
        </div>
        <div
          class="pm-new-toolbar-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ fastStartLabel }}</span>
          <a-select
            :model-value="fastStartMode"
            class="pm-new-toolbar-action-select pm-new-toolbar-fast-start-select"
            popup-container="body"
            size="small"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitFastStartMode"
          >
            <a-option
              v-for="option in fastStartModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-option>
          </a-select>
        </div>
        <div class="pm-new-toolbar-action-buttons">
          <a-button
            type="primary"
            :disabled="applyAllDisabled"
            @click="$emit('apply-all')"
          >
            {{ applyAllLabel }}
          </a-button>
          <a-button
            type="outline"
            :disabled="applySelectedDisabled"
            @click="$emit('apply-selected')"
          >
            {{ applySelectedLabel }}
          </a-button>
          <a-button
            :disabled="resetDisabled"
            @click="$emit('reset')"
          >
            {{ resetLabel }}
          </a-button>
        </div>
      </div>
    </section>

    <section class="pm-new-toolbar-group pm-new-toolbar-submit-group">
      <span class="pm-new-toolbar-group-title">{{ submitGroupTitle }}</span>
      <div class="pm-new-toolbar-submit-fields">
        <a-button
          class="pm-new-toolbar-submit-button"
          type="primary"
          :disabled="submitAllDisabled"
          @click="$emit('submit-all')"
        >
          {{ submitAllLabel }}
        </a-button>
        <a-button
          class="pm-new-toolbar-submit-button"
          type="outline"
          :disabled="submitSelectedDisabled"
          @click="$emit('submit-selected')"
        >
          {{ submitSelectedLabel }}
        </a-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import ShopSelectDropdown from '../../shared/shopSelection/ShopSelectDropdown.vue';
import {
  BUDGET_MODE_OPTIONS,
  BUDGET_MODE_CUSTOM,
  FAST_START_MODE_OPTIONS,
  ROAS_MODE_OPTIONS,
  ROAS_MODE_CUSTOM,
  createEmptyGoodsFilterState
} from '../view-models/createPromotionGoodsRows.js';

const props = defineProps({
  selectedShopIds: {
    type: Array,
    default: () => []
  },
  selectedRegionCodes: {
    type: Array,
    default: () => []
  },
  regionOptions: {
    type: Array,
    default: () => []
  },
  shopOptions: {
    type: Array,
    default: () => []
  },
  categoryOptions: {
    type: Array,
    default: () => []
  },
  siteOptions: {
    type: Array,
    default: () => []
  },
  queryLoading: {
    type: Boolean,
    default: false
  },
  budgetMode: {
    type: String,
    default: ''
  },
  roasMode: {
    type: String,
    default: ''
  },
  fastStartMode: {
    type: String,
    default: ''
  },
  customBudget: {
    type: [Number, String],
    default: null
  },
  customRoas: {
    type: [Number, String],
    default: null
  },
  filterValues: {
    type: Object,
    default: createEmptyGoodsFilterState
  },
  applyAllDisabled: {
    type: Boolean,
    default: false
  },
  applySelectedDisabled: {
    type: Boolean,
    default: false
  },
  resetDisabled: {
    type: Boolean,
    default: false
  },
  submitAllDisabled: {
    type: Boolean,
    default: false
  },
  submitSelectedDisabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:selectedShopIds',
  'update:selectedRegionCodes',
  'update:budgetMode',
  'update:roasMode',
  'update:fastStartMode',
  'update:customBudget',
  'update:customRoas',
  'update:filterValues',
  'query',
  'stop-query',
  'search-filters',
  'reset-filters',
  'apply-all',
  'apply-selected',
  'submit-all',
  'submit-selected',
  'reset'
]);

const queryGroupTitle = '\u6570\u636e\u67e5\u8be2';
const filterGroupTitle = '\u5546\u54c1\u7b5b\u9009';
const actionGroupTitle = '\u6279\u91cf\u8bbe\u7f6e';
const submitGroupTitle = '\u521b\u5efa\u5e7f\u544a';
const shopSelectLabel = '\u5e97\u94fa\u9009\u62e9\uff1a';
const shopSelectPlaceholder = '\u5e97\u94fa\u9009\u62e9';
const regionSelectLabel = '\u67e5\u8be2\u5730\u533a\uff1a';
const regionSelectPlaceholder = '\u9009\u62e9\u5730\u533a';
const queryButtonLabel = '\u67e5\u8be2\u5546\u54c1';
const stopQueryButtonLabel = '\u505c\u6b62\u67e5\u8be2';
const shopFilterPlaceholder = '\u9009\u62e9\u5e97\u94fa';
const identityPlaceholder = '\u8f93\u5165\u5546\u54c1ID/SPUID\uff0c\u591a\u4e2a\u8bf7\u7528\u9017\u53f7\u6216\u7a7a\u683c\u9694\u5f00';
const categoryPlaceholder = '\u9009\u62e9\u7c7b\u76ee';
const sitePlaceholder = '\u9009\u62e9\u7ad9\u70b9';
const priceRangeLabel = '\u4ef7\u683c\u533a\u95f4\uff1a';
const salesRangeLabel = '\u9500\u91cf\u533a\u95f4\uff1a';
const createdRangeLabel = '\u521b\u5efa\u65f6\u95f4\u8303\u56f4\uff1a';
const filterSearchLabel = '\u641c\u7d22';
const filterResetLabel = '\u91cd\u7f6e';
const minNumberPlaceholder = '\u6700\u4f4e';
const maxNumberPlaceholder = '\u6700\u9ad8';
const dateRangePlaceholder = Object.freeze([
  '\u5f00\u59cb\u65e5\u671f',
  '\u7ed3\u675f\u65e5\u671f'
]);
const dailyBudgetLabel = '\u5e7f\u544a\u65e5\u9884\u7b97\uff1a';
const roasLabel = 'ROAS\u503c\uff1a';
const fastStartLabel = '\u6781\u901f\u8d77\u91cf\uff1a';
const budgetPlaceholder = '\u8f93\u5165\u9884\u7b97';
const roasPlaceholder = '\u8f93\u5165ROAS';
const applyAllLabel = '\u4e00\u952e\u8bbe\u7f6e\u5168\u90e8';
const applySelectedLabel = '\u4e00\u952e\u8bbe\u7f6e\u5df2\u9009';
const resetLabel = '\u91cd\u7f6e';
const submitAllLabel = '\u65b0\u5efa\u5168\u90e8\u5546\u54c1\u5e7f\u544a';
const submitSelectedLabel = '\u65b0\u5efa\u5df2\u9009\u5546\u54c1\u5e7f\u544a';
const budgetModeOptions = BUDGET_MODE_OPTIONS;
const roasModeOptions = ROAS_MODE_OPTIONS;
const fastStartModeOptions = FAST_START_MODE_OPTIONS;
const budgetModeCustom = BUDGET_MODE_CUSTOM;
const roasModeCustom = ROAS_MODE_CUSTOM;
const stableSelectTriggerProps = Object.freeze({
  autoFitPopupMinWidth: true,
  updateAtScroll: true
});

function isOptionValue(options, value) {
  return (Array.isArray(options) ? options : []).some((option) => option && option.value === value);
}

function emitSelectedShopIds(value) {
  emit('update:selectedShopIds', Array.isArray(value) ? value : []);
}

function emitSelectedRegionCodes(value) {
  const validRegionValues = new Set(
    (Array.isArray(props.regionOptions) ? props.regionOptions : []).map((option) => option && option.value)
  );
  const nextValues = (Array.isArray(value) ? value : [])
    .filter((entry) => validRegionValues.has(entry));

  emit('update:selectedRegionCodes', nextValues);
}

function normalizeSelectedOptionValues(value, options) {
  const validValues = new Set(
    (Array.isArray(options) ? options : []).map((option) => option && option.value)
  );

  return Array.from(new Set((Array.isArray(value) ? value : [])
    .filter((entry) => validValues.has(entry))));
}

function asOptionValueList(value) {
  return Array.isArray(value) ? value : [];
}

function emitShopValues(value) {
  patchFilterValues({
    shopValues: normalizeSelectedOptionValues(value, props.shopOptions)
  });
}

function emitCategoryValues(value) {
  patchFilterValues({
    categoryValues: normalizeSelectedOptionValues(value, props.categoryOptions)
  });
}

function emitSiteValues(value) {
  patchFilterValues({
    siteValues: normalizeSelectedOptionValues(value, props.siteOptions)
  });
}

function emitBudgetMode(value) {
  if (isOptionValue(budgetModeOptions, value)) {
    emit('update:budgetMode', value);
  }
}

function emitRoasMode(value) {
  if (isOptionValue(roasModeOptions, value)) {
    emit('update:roasMode', value);
  }
}

function emitFastStartMode(value) {
  if (isOptionValue(fastStartModeOptions, value)) {
    emit('update:fastStartMode', value);
  }
}

function emitCustomBudget(value) {
  emit('update:customBudget', value);
}

function emitCustomRoas(value) {
  emit('update:customRoas', value);
}

function patchFilterValues(patch) {
  emit('update:filterValues', {
    ...createEmptyGoodsFilterState(),
    ...(props.filterValues && typeof props.filterValues === 'object' ? props.filterValues : {}),
    ...(patch && typeof patch === 'object' ? patch : {})
  });
}
</script>
