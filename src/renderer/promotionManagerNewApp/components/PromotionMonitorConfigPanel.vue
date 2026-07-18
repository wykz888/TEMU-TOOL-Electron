<template>
  <section
    class="pm-new-monitor-config-panel"
    :class="{ 'pm-new-page-panel': !embedded, 'is-embedded': embedded }"
  >
    <div v-if="showTitle" class="pm-new-section-title">
      <strong>{{ panelTitle }}</strong>
      <a-tag size="small" bordered>{{ selectedRegionCountText }}</a-tag>
    </div>

    <div class="pm-new-monitor-config-body">
      <div class="pm-new-monitor-config-layout">
        <section class="pm-new-monitor-config-group is-base">
          <div class="pm-new-monitor-config-group-head">
            <PromotionMonitorFieldLabel
              :label="baseGroupTitle"
              :help="baseGroupHelpText"
              label-class="pm-new-monitor-config-group-title"
            />
          </div>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <PromotionMonitorFieldLabel
                :label="intervalLabel"
                :help="intervalHelpText"
              />
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
              <PromotionMonitorFieldLabel
                :label="regionLabel"
                :help="regionHelpText"
              />
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

        <section class="pm-new-monitor-config-group is-action">
          <div class="pm-new-monitor-config-group-head">
            <PromotionMonitorFieldLabel
              :label="actionGroupTitle"
              :help="actionGroupHelpText"
              label-class="pm-new-monitor-config-group-title"
            />
          </div>
          <div class="pm-new-monitor-action-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <PromotionMonitorFieldLabel
                :label="modifyActionLabel"
                :help="actionTypeHelpText"
              />
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

            <div
              v-if="actionNeedsTargetRoas"
              class="pm-new-monitor-config-field"
              role="group"
            >
              <PromotionMonitorFieldLabel
                :label="actionTargetRoasLabel"
                :help="actionTargetRoasHelpText"
              />
              <a-input-number
                :model-value="normalizedConfig.targetRoas"
                class="pm-new-monitor-number"
                size="small"
                model-event="input"
                allow-clear
                :min="0"
                :precision="2"
                :step="0.01"
                :placeholder="actionTargetRoasPlaceholder"
                @update:model-value="(value) => patchConfig({ targetRoas: value })"
              />
            </div>

            <div
              v-if="actionNeedsResumeInterval"
              class="pm-new-monitor-config-field"
              role="group"
            >
              <PromotionMonitorFieldLabel
                :label="resumeIntervalLabel"
                :help="resumeIntervalHelpText"
              />
              <div class="pm-new-monitor-control-row">
                <a-input-number
                  :model-value="normalizedConfig.resumeIntervalMinutes"
                  class="pm-new-monitor-number"
                  size="small"
                  mode="button"
                  model-event="input"
                  allow-clear
                  :min="minResumeIntervalMinutes"
                  :max="maxResumeIntervalMinutes"
                  :precision="0"
                  :placeholder="resumeIntervalPlaceholder"
                  @update:model-value="(value) => patchConfig({ resumeIntervalMinutes: value })"
                />
                <span class="pm-new-monitor-control-unit">{{ minuteUnitLabel }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="pm-new-monitor-config-group is-auto-pause">
          <div class="pm-new-monitor-config-group-head">
            <PromotionMonitorFieldLabel
              :label="autoPauseGroupTitle"
              :help="autoPauseGroupHelpText"
              label-class="pm-new-monitor-config-group-title"
            />
          </div>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <PromotionMonitorFieldLabel
                :label="spendThresholdLabel"
                :help="spendThresholdHelpText"
              />
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
              <PromotionMonitorFieldLabel
                :label="dealRoasThresholdLabel"
                :help="dealRoasThresholdHelpText"
              />
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

        <section class="pm-new-monitor-config-group is-filter">
          <div class="pm-new-monitor-config-group-head">
            <PromotionMonitorFieldLabel
              :label="statusGroupTitle"
              :help="statusGroupHelpText"
              label-class="pm-new-monitor-config-group-title"
            />
          </div>
          <div class="pm-new-monitor-config-fields">
            <div class="pm-new-monitor-config-field" role="group">
              <PromotionMonitorFieldLabel
                :label="targetRoasConditionLabel"
                :help="targetRoasConditionHelpText"
              />
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
              <PromotionMonitorFieldLabel
                :label="orderCountConditionLabel"
                :help="orderCountConditionHelpText"
              />
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
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import PromotionMonitorFieldLabel from './PromotionMonitorFieldLabel.vue';
import {
  MAX_MONITOR_INTERVAL_SECONDS,
  MAX_RESUME_INTERVAL_MINUTES,
  MIN_MONITOR_INTERVAL_SECONDS,
  MIN_RESUME_INTERVAL_MINUTES,
  MONITOR_ACTION_OPTIONS,
  MONITOR_REGION_OPTIONS,
  NEXT_DAY_RESUME_INTERVAL_MINUTES,
  doesMonitorActionRequireResumeInterval,
  doesMonitorActionRequireTargetRoas,
  normalizeMonitorActionType,
  normalizeMonitorRegionIds,
  normalizePromotionMonitorConfig,
  patchPromotionMonitorConfig
} from '../view-models/promotionMonitorConfig.js';

const props = defineProps({
  config: {
    type: Object,
    default: () => ({})
  },
  embedded: {
    type: Boolean,
    default: false
  },
  showTitle: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:config']);

const panelTitle = '\u76d1\u63a7\u914d\u7f6e';
const baseGroupTitle = '\u57fa\u7840\u8bbe\u7f6e';
const autoPauseGroupTitle = '\u81ea\u52a8\u6682\u505c';
const statusGroupTitle = '\u76d1\u63a7\u72b6\u6001';
const actionGroupTitle = '\u6267\u884c\u52a8\u4f5c';
const intervalLabel = '\u76d1\u63a7\u95f4\u9694';
const regionLabel = '\u76d1\u63a7\u5730\u533a';
const spendThresholdLabel = '\u82b1\u8d39\u8d85\u8fc7(\u5143)';
const dealRoasThresholdLabel = '\u6210\u4ea4ROAS \u2264';
const targetRoasConditionLabel = '\u76ee\u6807ROAS \u2264';
const orderCountConditionLabel = '\u8ba2\u5355\u91cf \u2265';
const modifyActionLabel = '\u64cd\u4f5c\u7c7b\u578b';
const actionTargetRoasLabel = '\u8bbe\u7f6eROAS';
const secondUnitLabel = '\u79d2';
const minuteUnitLabel = '\u5206\u949f';
const regionPlaceholder = '\u9009\u62e9\u76d1\u63a7\u5730\u533a';
const amountPlaceholder = '\u7559\u7a7a\u4e0d\u9650';
const roasPlaceholder = '\u7559\u7a7a\u4e0d\u9650';
const targetRoasPlaceholder = '\u7559\u7a7a\u4e0d\u9650';
const actionTargetRoasPlaceholder = '\u8f93\u5165ROAS';
const resumeIntervalLabel = '\u6062\u590d\u65f6\u95f4';
const resumeIntervalPlaceholder = '\u8f93\u5165\u5206\u949f';
const orderCountPlaceholder = '\u8f93\u5165\u8ba2\u5355\u91cf';
const selectedRegionUnitLabel = '\u4e2a\u5730\u533a';
const noRegionSelectedText = '\u672a\u9009\u62e9\u5730\u533a';
const baseGroupHelpText = '\u8bbe\u7f6e\u76d1\u63a7\u9891\u7387\u548c\u9700\u8981\u8bfb\u53d6\u7684\u5730\u533a\uff0c\u72ec\u7acb\u914d\u7f6e\u4f1a\u8986\u76d6\u5168\u5c40\u914d\u7f6e\u3002';
const intervalHelpText = '\u540e\u53f0\u6309\u8fd9\u4e2a\u79d2\u6570\u5faa\u73af\u68c0\u67e5\uff0c\u6700\u5c0f 5 \u79d2\uff1b\u591a\u5e97\u94fa\u65f6\u5efa\u8bae\u7559\u51fa\u63a5\u53e3\u54cd\u5e94\u65f6\u95f4\u3002';
const regionHelpText = '\u9009\u62e9\u9700\u8981\u76d1\u63a7\u7684\u5730\u533a\uff1b\u5e97\u94fa\u5217\u8868\u4ecd\u4f1a\u6309\u7f8e\u56fd\u3001\u6b27\u533a\u3001\u5168\u7403\u4e09\u884c\u5c55\u793a\u6570\u636e\u3002\u67d0\u5730\u533a\u63a8\u5e7f\u6570\u91cf\u4e3a 0 \u65f6\uff0c\u4f1a\u6309 10 \u5206\u949f\u9891\u7387\u590d\u67e5\uff0c\u4e0d\u6bcf\u8f6e\u91cd\u590d\u8bf7\u6c42\u3002';
const actionGroupHelpText = '\u547d\u4e2d\u7b5b\u9009\u548c\u81ea\u52a8\u6682\u505c\u6761\u4ef6\u540e\u6267\u884c\u7684\u52a8\u4f5c\u3002';
const actionTypeHelpText = '\u6682\u505c\u8ba1\u5212\u53ea\u505c\u6b62\u63a8\u5e7f\uff1b\u5220\u9664\u8ba1\u5212\u4f1a\u79fb\u9664\u8ba1\u5212\uff1b\u4fee\u6539\u6216\u6062\u590d\u7c7b\u52a8\u4f5c\u4f1a\u6309\u4e0b\u65b9\u53c2\u6570\u7ee7\u7eed\u5904\u7406\u3002';
const actionTargetRoasHelpText = '\u6682\u505c\u540e\u4fee\u6539\u65f6\u5199\u5165\u7684\u65b0 ROAS \u503c\u3002';
const resumeIntervalHelpText = `\u6682\u505c\u540e\u6062\u590d\u7b49\u5f85\u7684\u5206\u949f\u6570\uff1b${NEXT_DAY_RESUME_INTERVAL_MINUTES} \u8868\u793a\u9694\u5929\u51cc\u6668\u6062\u590d\u3002`;
const autoPauseGroupHelpText = '\u82b1\u8d39\u4fdd\u62a4\u53ea\u5904\u7406\u82b1\u8d39\u8d85\u8fc7\u4e14\u5b50\u8ba2\u5355(\u63a8\u5e7f)=0\u7684\u8ba1\u5212\uff1b\u6210\u4ea4 ROAS \u4fdd\u62a4\u53ea\u5904\u7406\u5df2\u7ecf\u6709\u5b50\u8ba2\u5355\u4e14 ROAS \u4f4e\u4e8e\u9608\u503c\u7684\u8ba1\u5212\u3002\u82b1\u8d39\u6392\u5e8f\u4e3a\u6162\u901f\u68c0\u67e5\uff0c\u6bcf 10 \u5206\u949f\u6700\u591a\u67e5\u4e00\u6b21\u3002\u7a7a\u503c\u4e0d\u53c2\u4e0e\u5224\u65ad\u3002';
const spendThresholdHelpText = '\u4ec5\u5f53\u82b1\u8d39\u8d85\u8fc7\u8be5\u91d1\u989d\u4e14\u5b50\u8ba2\u5355(\u63a8\u5e7f)=0\u65f6\u81ea\u52a8\u6682\u505c\uff0c\u7559\u7a7a\u4e0d\u9650\u5236\u3002\u82b1\u8d39\u6392\u5e8f\u68c0\u67e5\u4e0d\u8ddf\u968f\u6bcf\u8f6e\u76d1\u63a7\u91cd\u590d\u6267\u884c\uff0c\u4ee5\u964d\u4f4e\u63a5\u53e3\u548c CPU \u538b\u529b\u3002';
const dealRoasThresholdHelpText = '\u4ec5\u5f53\u5b50\u8ba2\u5355(\u63a8\u5e7f)>0\u4e14\u6210\u4ea4 ROAS \u5c0f\u4e8e\u7b49\u4e8e\u8be5\u503c\u65f6\u81ea\u52a8\u6682\u505c\uff1b\u6ca1\u51fa\u5355\u4e0d\u53c2\u4e0e\u8fd9\u4e2a\u5224\u65ad\u3002';
const statusGroupHelpText = '\u7528\u76ee\u6807 ROAS \u548c\u8ba2\u5355\u91cf\u7f29\u5c0f\u9700\u8981\u5904\u7406\u7684\u8ba1\u5212\u8303\u56f4\u3002';
const targetRoasConditionHelpText = '\u53ea\u5904\u7406\u76ee\u6807 ROAS \u5c0f\u4e8e\u7b49\u4e8e\u8be5\u503c\u7684\u8ba1\u5212\uff0c\u7559\u7a7a\u4e0d\u9650\u5236\u3002';
const orderCountConditionHelpText = '\u53ea\u5904\u7406\u8ba2\u5355\u91cf\u8fbe\u5230\u8be5\u503c\u7684\u8ba1\u5212\uff1b0 \u8868\u793a\u4e0d\u9650\u5236\u8ba2\u5355\u91cf\u3002';
const regionOptions = MONITOR_REGION_OPTIONS;
const actionOptions = MONITOR_ACTION_OPTIONS;
const minIntervalSeconds = MIN_MONITOR_INTERVAL_SECONDS;
const maxIntervalSeconds = MAX_MONITOR_INTERVAL_SECONDS;
const minResumeIntervalMinutes = MIN_RESUME_INTERVAL_MINUTES;
const maxResumeIntervalMinutes = MAX_RESUME_INTERVAL_MINUTES;
const stableSelectTriggerProps = Object.freeze({
  autoFitPopupMinWidth: true,
  updateAtScroll: true
});

const normalizedConfig = computed(() => normalizePromotionMonitorConfig(props.config));
const selectedRegionCountText = computed(() => {
  const selectedCount = normalizedConfig.value.regionIds.length;

  return selectedCount > 0 ? `${selectedCount} ${selectedRegionUnitLabel}` : noRegionSelectedText;
});
const actionNeedsTargetRoas = computed(() => (
  doesMonitorActionRequireTargetRoas(normalizedConfig.value.actionType)
));
const actionNeedsResumeInterval = computed(() => (
  doesMonitorActionRequireResumeInterval(normalizedConfig.value.actionType)
));

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
