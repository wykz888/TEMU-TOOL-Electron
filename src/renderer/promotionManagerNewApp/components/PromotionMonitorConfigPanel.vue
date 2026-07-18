<template>
  <section class="pm-new-page-panel pm-new-monitor-config-panel">
    <div class="pm-new-section-title">
      <strong>{{ panelTitle }}</strong>
      <a-tag size="small" bordered>{{ selectedRegionCountText }}</a-tag>
    </div>

    <div class="pm-new-monitor-config-body">
      <div class="pm-new-monitor-config-grid">
        <section class="pm-new-monitor-config-group">
          <span class="pm-new-monitor-config-group-title">{{ baseGroupTitle }}</span>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <span class="pm-new-monitor-config-label">{{ intervalLabel }}</span>
              <div class="pm-new-monitor-control-row">
                <a-input-number
                  :model-value="normalizedConfig.monitorIntervalSeconds"
                  class="pm-new-monitor-number"
                  size="small"
                  mode="button"
                  model-event="input"
                  :min="minIntervalSeconds"
                  :max="maxIntervalSeconds"
                  :precision="0"
                  @update:model-value="(value) => patchConfig({ monitorIntervalSeconds: value })"
                />
                <span class="pm-new-monitor-control-unit">{{ secondUnitLabel }}</span>
              </div>
            </div>

            <div class="pm-new-monitor-config-field" role="group">
              <span class="pm-new-monitor-config-label">{{ regionLabel }}</span>
              <a-select
                :model-value="normalizedConfig.regionIds"
                class="pm-new-monitor-select"
                multiple
                allow-clear
                popup-container="body"
                size="small"
                :max-tag-count="1"
                :placeholder="regionPlaceholder"
                :trigger-props="stableSelectTriggerProps"
                @update:model-value="updateRegionIds"
              >
                <a-option
                  v-for="option in regionOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </a-option>
              </a-select>
            </div>
          </div>
        </section>

        <section class="pm-new-monitor-config-group">
          <span class="pm-new-monitor-config-group-title">{{ autoPauseGroupTitle }}</span>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <span class="pm-new-monitor-config-label">{{ spendThresholdLabel }}</span>
              <a-input-number
                :model-value="normalizedConfig.autoPauseSpendThreshold"
                class="pm-new-monitor-number"
                size="small"
                model-event="input"
                allow-clear
                :min="0"
                :precision="2"
                :placeholder="amountPlaceholder"
                @update:model-value="(value) => patchConfig({ autoPauseSpendThreshold: value })"
              />
            </div>

            <div class="pm-new-monitor-config-field" role="group">
              <span class="pm-new-monitor-config-label">{{ dealRoasThresholdLabel }}</span>
              <a-input-number
                :model-value="normalizedConfig.autoPauseRoasThreshold"
                class="pm-new-monitor-number"
                size="small"
                model-event="input"
                allow-clear
                :min="0"
                :precision="2"
                :step="0.01"
                :placeholder="roasPlaceholder"
                @update:model-value="(value) => patchConfig({ autoPauseRoasThreshold: value })"
              />
            </div>
          </div>
        </section>

        <section class="pm-new-monitor-config-group">
          <span class="pm-new-monitor-config-group-title">{{ statusGroupTitle }}</span>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <span class="pm-new-monitor-config-label">{{ targetRoasConditionLabel }}</span>
              <a-input-number
                :model-value="normalizedConfig.conditionMaxRoas"
                class="pm-new-monitor-number"
                size="small"
                model-event="input"
                allow-clear
                :min="0"
                :precision="2"
                :step="0.01"
                :placeholder="targetRoasPlaceholder"
                @update:model-value="(value) => patchConfig({ conditionMaxRoas: value })"
              />
            </div>

            <div class="pm-new-monitor-config-field" role="group">
              <span class="pm-new-monitor-config-label">{{ orderCountConditionLabel }}</span>
              <a-input-number
                :model-value="normalizedConfig.minOrderCount"
                class="pm-new-monitor-number"
                size="small"
                mode="button"
                model-event="input"
                :min="0"
                :precision="0"
                :placeholder="orderCountPlaceholder"
                @update:model-value="(value) => patchConfig({ minOrderCount: value })"
              />
            </div>
          </div>
        </section>

        <section class="pm-new-monitor-config-group">
          <span class="pm-new-monitor-config-group-title">{{ actionGroupTitle }}</span>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field pm-new-monitor-config-field--wide" role="group">
              <span class="pm-new-monitor-config-label">{{ modifyActionLabel }}</span>
              <a-select
                :model-value="normalizedConfig.actionType"
                class="pm-new-monitor-select"
                popup-container="body"
                size="small"
                :trigger-props="stableSelectTriggerProps"
                @update:model-value="updateActionType"
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
          </div>
        </section>
      </div>

      <a-alert
        class="pm-new-monitor-config-tip"
        type="info"
        show-icon
        :content="hintText"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  MAX_MONITOR_INTERVAL_SECONDS,
  MIN_MONITOR_INTERVAL_SECONDS,
  MONITOR_ACTION_OPTIONS,
  MONITOR_REGION_OPTIONS,
  normalizeMonitorActionType,
  normalizeMonitorRegionIds,
  normalizePromotionMonitorConfig,
  patchPromotionMonitorConfig
} from '../view-models/promotionMonitorConfig.js';

const props = defineProps({
  config: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:config']);

const panelTitle = '\u76d1\u63a7\u914d\u7f6e';
const baseGroupTitle = '\u57fa\u7840\u8bbe\u7f6e';
const autoPauseGroupTitle = '\u81ea\u52a8\u6682\u505c';
const statusGroupTitle = '\u76d1\u63a7\u72b6\u6001';
const actionGroupTitle = '\u4fee\u6539\u64cd\u4f5c';
const intervalLabel = '\u76d1\u63a7\u95f4\u9694';
const regionLabel = '\u76d1\u63a7\u5730\u533a';
const spendThresholdLabel = '\u82b1\u8d39\u8d85\u8fc7(\u5143)';
const dealRoasThresholdLabel = '\u6210\u4ea4ROAS \u2264';
const targetRoasConditionLabel = '\u76ee\u6807ROAS \u2264';
const orderCountConditionLabel = '\u8ba2\u5355\u91cf \u2265';
const modifyActionLabel = '\u64cd\u4f5c\u7c7b\u578b';
const secondUnitLabel = '\u79d2';
const regionPlaceholder = '\u9009\u62e9\u76d1\u63a7\u5730\u533a';
const amountPlaceholder = '\u7559\u7a7a\u4e0d\u9650';
const roasPlaceholder = '\u7559\u7a7a\u4e0d\u9650';
const targetRoasPlaceholder = '\u7559\u7a7a\u4e0d\u9650';
const orderCountPlaceholder = '\u8f93\u5165\u8ba2\u5355\u91cf';
const selectedRegionUnitLabel = '\u4e2a\u5730\u533a';
const noRegionSelectedText = '\u672a\u9009\u62e9\u5730\u533a';
const hintText = '\u7a7a\u503c\u4e0d\u53c2\u4e0e\u5224\u65ad\uff1b\u82b1\u8d39\u8d85\u8fc7\u6216\u6210\u4ea4ROAS\u8fbe\u9608\u503c\u65f6\u4f1a\u5148\u6682\u505c\uff0c\u8ba2\u5355\u91cf\u548c\u76ee\u6807ROAS\u7528\u6765\u8fc7\u6ee4\u9700\u8981\u5904\u7406\u7684\u8ba1\u5212\u3002';
const regionOptions = MONITOR_REGION_OPTIONS;
const actionOptions = MONITOR_ACTION_OPTIONS;
const minIntervalSeconds = MIN_MONITOR_INTERVAL_SECONDS;
const maxIntervalSeconds = MAX_MONITOR_INTERVAL_SECONDS;
const stableSelectTriggerProps = Object.freeze({
  autoFitPopupMinWidth: true,
  updateAtScroll: true
});

const normalizedConfig = computed(() => normalizePromotionMonitorConfig(props.config));
const selectedRegionCountText = computed(() => {
  const selectedCount = normalizedConfig.value.regionIds.length;

  return selectedCount > 0 ? `${selectedCount} ${selectedRegionUnitLabel}` : noRegionSelectedText;
});

function patchConfig(patch) {
  emit('update:config', patchPromotionMonitorConfig(normalizedConfig.value, patch));
}

function updateRegionIds(value) {
  patchConfig({
    regionIds: normalizeMonitorRegionIds(value, { useDefault: false })
  });
}

function updateActionType(value) {
  patchConfig({
    actionType: normalizeMonitorActionType(value)
  });
}
</script>
