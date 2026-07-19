<template>
  <div class="pm-new-create-toolbar pm-new-detail-toolbar">
    <section class="pm-new-toolbar-group pm-new-toolbar-query-group">
      <span class="pm-new-toolbar-group-title">{{ queryGroupTitle }}</span>
      <div class="pm-new-toolbar-query-fields pm-new-detail-query-fields">
        <div
          class="pm-new-toolbar-field pm-new-toolbar-shop-field"
          role="group"
        >
          <span class="pm-new-toolbar-field-label">{{ shopSelectLabel }}</span>
          <ShopSelectDropdown
            class="pm-new-toolbar-shop-select"
            :model-value="selectedShopIds"
            :placeholder="shopSelectPlaceholder"
            storage-key="promotion-manager-new:detail-shop-selection"
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

        <div
          class="pm-new-toolbar-field pm-new-toolbar-date-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ dateRangeLabel }}</span>
          <a-range-picker
            :model-value="queryDateRange"
            class="pm-new-toolbar-date-range"
            popup-container="body"
            size="small"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :placeholder="dateRangePlaceholder"
            :shortcuts="dateShortcuts"
            shortcuts-position="bottom"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitQueryDateRange"
          />
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
          :model-value="asOptionValueList(filterValues.statusValues)"
          class="pm-new-toolbar-filter-select"
          multiple
          allow-clear
          popup-container="body"
          size="small"
          :max-tag-count="1"
          :placeholder="statusPlaceholder"
          :trigger-props="stableSelectTriggerProps"
          @update:model-value="emitStatusValues"
        >
          <a-option
            v-for="option in statusOptions"
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
          <span class="pm-new-toolbar-inline-label">{{ spendRangeLabel }}</span>
          <a-input-number
            :model-value="filterValues.spendMin"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="minNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ spendMin: value })"
          />
          <span class="pm-new-toolbar-range-separator">~</span>
          <a-input-number
            :model-value="filterValues.spendMax"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="maxNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ spendMax: value })"
          />
        </div>

        <div
          class="pm-new-toolbar-field pm-new-toolbar-range-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ roasRangeLabel }}</span>
          <a-input-number
            :model-value="filterValues.roasMin"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="minNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ roasMin: value })"
          />
          <span class="pm-new-toolbar-range-separator">~</span>
          <a-input-number
            :model-value="filterValues.roasMax"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="maxNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ roasMax: value })"
          />
        </div>

        <div
          class="pm-new-toolbar-field pm-new-toolbar-range-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ targetRoasRangeLabel }}</span>
          <a-input-number
            :model-value="filterValues.targetRoasMin"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="minNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ targetRoasMin: value })"
          />
          <span class="pm-new-toolbar-range-separator">~</span>
          <a-input-number
            :model-value="filterValues.targetRoasMax"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="2"
            :placeholder="maxNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ targetRoasMax: value })"
          />
        </div>

        <div
          class="pm-new-toolbar-field pm-new-toolbar-range-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ orderRangeLabel }}</span>
          <a-input-number
            :model-value="filterValues.orderMin"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="0"
            :placeholder="minNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ orderMin: value })"
          />
          <span class="pm-new-toolbar-range-separator">~</span>
          <a-input-number
            :model-value="filterValues.orderMax"
            class="pm-new-toolbar-number-input"
            size="small"
            :precision="0"
            :placeholder="maxNumberPlaceholder"
            model-event="input"
            @update:model-value="(value) => patchFilterValues({ orderMax: value })"
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
          <span class="pm-new-toolbar-inline-label">{{ actionTypeLabel }}</span>
          <a-select
            :model-value="actionType"
            class="pm-new-toolbar-action-select pm-new-detail-action-select"
            popup-container="body"
            size="small"
            :trigger-props="stableSelectTriggerProps"
            @update:model-value="emitActionType"
          >
            <a-option
              v-for="option in actionOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-option>
          </a-select>
        </div>

        <div
          v-if="actionNeedsRoasMode"
          class="pm-new-toolbar-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ roasModeLabel }}</span>
          <a-select
            :model-value="roasMode"
            class="pm-new-toolbar-action-select pm-new-detail-roas-mode-select"
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
        </div>

        <div
          v-if="actionNeedsTargetRoasInput"
          class="pm-new-toolbar-field"
          role="group"
        >
          <span class="pm-new-toolbar-inline-label">{{ targetRoasLabel }}</span>
          <a-input-number
            :model-value="targetRoas"
            class="pm-new-toolbar-custom-number"
            size="small"
            :min="0"
            :precision="2"
            :step="0.01"
            :placeholder="targetRoasPlaceholder"
            model-event="input"
            @update:model-value="emitTargetRoas"
          />
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
          :status="getExecuteButtonStatus(executeScopeAll)"
          :loading="isExecuteButtonLoading(executeScopeAll)"
          :disabled="isExecuteButtonDisabled(executeScopeAll, executeAllDisabled)"
          @click="$emit('execute-all')"
        >
          {{ getExecuteAllButtonLabel() }}
        </a-button>
        <a-button
          class="pm-new-toolbar-submit-button"
          type="outline"
          :status="getExecuteButtonStatus(executeScopeSelected)"
          :loading="isExecuteButtonLoading(executeScopeSelected)"
          :disabled="isExecuteButtonDisabled(executeScopeSelected, executeSelectedDisabled)"
          @click="$emit('execute-selected')"
        >
          {{ getExecuteSelectedButtonLabel() }}
        </a-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ShopSelectDropdown from '../../shared/shopSelection/ShopSelectDropdown.vue';
import {
  DETAIL_ACTION_ROAS_MODE_OPTIONS,
  DETAIL_ACTION_OPTIONS,
  DETAIL_ACTION_TARGET_ROAS_TYPES,
  DETAIL_ACTION_UPDATE_ROAS,
  DETAIL_ROAS_MODE_CUSTOM,
  DETAIL_STATUS_OPTIONS,
  createEmptyPromotionDetailFilterState
} from '../view-models/promotionDetailRows.js';

const props = defineProps({
  selectedShopIds: {
    type: Array,
    default: () => []
  },
  selectedRegionCodes: {
    type: Array,
    default: () => []
  },
  queryDateRange: {
    type: Array,
    default: () => []
  },
  dateShortcuts: {
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
  statusOptions: {
    type: Array,
    default: () => DETAIL_STATUS_OPTIONS
  },
  siteOptions: {
    type: Array,
    default: () => []
  },
  queryLoading: {
    type: Boolean,
    default: false
  },
  actionType: {
    type: String,
    default: ''
  },
  roasMode: {
    type: String,
    default: ''
  },
  targetRoas: {
    type: [Number, String],
    default: null
  },
  filterValues: {
    type: Object,
    default: createEmptyPromotionDetailFilterState
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
  executeAllDisabled: {
    type: Boolean,
    default: false
  },
  executeSelectedDisabled: {
    type: Boolean,
    default: false
  },
  executeLoading: {
    type: Boolean,
    default: false
  },
  executeStopping: {
    type: Boolean,
    default: false
  },
  executeScope: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'update:selectedShopIds',
  'update:selectedRegionCodes',
  'update:queryDateRange',
  'update:actionType',
  'update:roasMode',
  'update:targetRoas',
  'update:filterValues',
  'query',
  'stop-query',
  'search-filters',
  'reset-filters',
  'apply-all',
  'apply-selected',
  'execute-all',
  'execute-selected',
  'reset'
]);

const queryGroupTitle = '\u6570\u636e\u67e5\u8be2';
const filterGroupTitle = '\u63a8\u5e7f\u7b5b\u9009';
const actionGroupTitle = '\u6279\u91cf\u8bbe\u7f6e';
const submitGroupTitle = '\u63a8\u5e7f\u64cd\u4f5c';
const shopSelectLabel = '\u5e97\u94fa\u9009\u62e9\uff1a';
const shopSelectPlaceholder = '\u5e97\u94fa\u9009\u62e9';
const regionSelectLabel = '\u67e5\u8be2\u5730\u533a\uff1a';
const regionSelectPlaceholder = '\u9009\u62e9\u5730\u533a';
const dateRangeLabel = '\u6570\u636e\u65f6\u95f4\uff1a';
const dateRangePlaceholder = Object.freeze([
  '\u5f00\u59cb\u65e5\u671f',
  '\u7ed3\u675f\u65e5\u671f'
]);
const queryButtonLabel = '\u67e5\u8be2\u660e\u7ec6';
const stopQueryButtonLabel = '\u505c\u6b62\u67e5\u8be2';
const shopFilterPlaceholder = '\u9009\u62e9\u5e97\u94fa';
const identityPlaceholder = '\u8f93\u5165\u5546\u54c1ID/\u8ba1\u5212ID/SPUID';
const statusPlaceholder = '\u9009\u62e9\u72b6\u6001';
const sitePlaceholder = '\u9009\u62e9\u7ad9\u70b9';
const spendRangeLabel = '\u82b1\u8d39\uff1a';
const roasRangeLabel = '\u6210\u4ea4ROAS\uff1a';
const targetRoasRangeLabel = '\u76ee\u6807ROAS\uff1a';
const orderRangeLabel = '\u5b50\u8ba2\u5355\uff1a';
const minNumberPlaceholder = '\u6700\u4f4e';
const maxNumberPlaceholder = '\u6700\u9ad8';
const filterSearchLabel = '\u641c\u7d22';
const filterResetLabel = '\u91cd\u7f6e';
const actionTypeLabel = '\u64cd\u4f5c\u7c7b\u578b\uff1a';
const roasModeLabel = 'ROAS\u6863\u4f4d\uff1a';
const targetRoasLabel = '\u76ee\u6807ROAS\uff1a';
const targetRoasPlaceholder = '\u8f93\u5165ROAS';
const applyAllLabel = '\u4e00\u952e\u8bbe\u7f6e\u5168\u90e8';
const applySelectedLabel = '\u4e00\u952e\u8bbe\u7f6e\u5df2\u9009';
const resetLabel = '\u91cd\u7f6e';
const executeAllLabel = '\u6267\u884c\u5168\u90e8\u63a8\u5e7f';
const executeSelectedLabel = '\u6267\u884c\u52fe\u9009\u63a8\u5e7f';
const stopExecuteAllLabel = '\u505c\u6b62\u6267\u884c\u5168\u90e8\u63a8\u5e7f';
const stopExecuteSelectedLabel = '\u505c\u6b62\u6267\u884c\u52fe\u9009\u63a8\u5e7f';
const executeScopeAll = 'all';
const executeScopeSelected = 'selected';
const actionOptions = DETAIL_ACTION_OPTIONS;
const roasModeOptions = DETAIL_ACTION_ROAS_MODE_OPTIONS;
const stableSelectTriggerProps = Object.freeze({
  autoFitPopupMinWidth: true,
  updateAtScroll: true
});

const actionNeedsRoasMode = computed(() => props.actionType === DETAIL_ACTION_UPDATE_ROAS);

const actionNeedsTargetRoasInput = computed(() => {
  if (props.actionType === DETAIL_ACTION_UPDATE_ROAS) {
    return props.roasMode === DETAIL_ROAS_MODE_CUSTOM;
  }

  return DETAIL_ACTION_TARGET_ROAS_TYPES.has(props.actionType);
});

function isOptionValue(options, value) {
  return (Array.isArray(options) ? options : []).some((option) => option && option.value === value);
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

function emitSelectedShopIds(value) {
  emit('update:selectedShopIds', Array.isArray(value) ? value : []);
}

function emitSelectedRegionCodes(value) {
  emit('update:selectedRegionCodes', normalizeSelectedOptionValues(value, props.regionOptions));
}

function emitQueryDateRange(value) {
  emit('update:queryDateRange', Array.isArray(value) ? value.slice(0, 2) : []);
}

function emitShopValues(value) {
  patchFilterValues({
    shopValues: normalizeSelectedOptionValues(value, props.shopOptions)
  });
}

function emitStatusValues(value) {
  patchFilterValues({
    statusValues: normalizeSelectedOptionValues(value, props.statusOptions)
  });
}

function emitSiteValues(value) {
  patchFilterValues({
    siteValues: normalizeSelectedOptionValues(value, props.siteOptions)
  });
}

function emitActionType(value) {
  if (isOptionValue(actionOptions, value)) {
    emit('update:actionType', value);
  }
}

function emitRoasMode(value) {
  if (isOptionValue(roasModeOptions, value)) {
    emit('update:roasMode', value);
  }
}

function emitTargetRoas(value) {
  emit('update:targetRoas', value);
}

function patchFilterValues(patch) {
  emit('update:filterValues', {
    ...createEmptyPromotionDetailFilterState(),
    ...(props.filterValues && typeof props.filterValues === 'object' ? props.filterValues : {}),
    ...(patch && typeof patch === 'object' ? patch : {})
  });
}

function isActiveExecuteButton(scope) {
  return props.executeLoading === true && props.executeScope === scope;
}

function getExecuteButtonStatus(scope) {
  return isActiveExecuteButton(scope) ? 'danger' : undefined;
}

function isExecuteButtonLoading(scope) {
  return isActiveExecuteButton(scope) && props.executeStopping === true;
}

function isExecuteButtonDisabled(scope, baseDisabled) {
  if (props.executeLoading !== true) {
    return baseDisabled;
  }

  return props.executeScope !== scope || props.executeStopping === true;
}

function getExecuteAllButtonLabel() {
  return isActiveExecuteButton(executeScopeAll) ? stopExecuteAllLabel : executeAllLabel;
}

function getExecuteSelectedButtonLabel() {
  return isActiveExecuteButton(executeScopeSelected) ? stopExecuteSelectedLabel : executeSelectedLabel;
}
</script>
