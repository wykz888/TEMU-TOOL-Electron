<template>
  <div class="pm-monitor-config-card">
    <div class="pm-config-toggle-bar">
      <button
        class="pm-config-toggle-btn"
        :class="{ 'is-open': configOpen }"
        @click="configOpen = !configOpen"
      >
        <span>监控配置</span>
        <svg class="pm-config-toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </div>

    <div v-show="configOpen" class="pm-config-body">
      <div class="pm-config-grid">
        <div class="pm-config-item">
          <label class="pm-config-label">监控间隔（秒，最小 {{ minInterval }}）</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.monitorIntervalSeconds"
            :min="minInterval"
            @change="handleConfigFieldChange('monitorIntervalSeconds', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">每日操作上限</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.dailyOperationLimit || ''"
            :min="0"
            placeholder="留空不限"
            @change="handleConfigFieldChange('dailyOperationLimit', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">总操作上限</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.totalOperationLimit || ''"
            :min="0"
            placeholder="留空不限"
            @change="handleConfigFieldChange('totalOperationLimit', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">花费暂停阈值</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.autoPauseSpendThreshold || ''"
            :min="0"
            placeholder="留空不限"
            @change="handleConfigFieldChange('autoPauseSpendThreshold', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">ROAS 暂停阈值</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.autoPauseRoasThreshold || ''"
            :min="0"
            placeholder="留空不限"
            @change="handleConfigFieldChange('autoPauseRoasThreshold', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">最小订单数</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.minOrderCount || '1'"
            :min="0"
            @change="handleConfigFieldChange('minOrderCount', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">条件最大ROAS</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.conditionMaxRoas || ''"
            :min="0"
            placeholder="留空不限"
            @change="handleConfigFieldChange('conditionMaxRoas', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">恢复间隔（分钟）</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.resumeIntervalMinutes || ''"
            :min="0"
            placeholder="留空默认"
            @change="handleConfigFieldChange('resumeIntervalMinutes', $event.target.value)"
          />
        </div>

        <div class="pm-config-item">
          <label class="pm-config-label">目标 ROAS</label>
          <input
            type="number"
            class="pm-config-input"
            :value="config.targetRoas || ''"
            :min="0"
            placeholder="修改/增加时需"
            @change="handleConfigFieldChange('targetRoas', $event.target.value)"
          />
        </div>
      </div>

      <!-- 区域选择 -->
      <div class="pm-config-subcard is-guard">
        <span class="pm-config-subcard-title">监控区域</span>
        <div class="pm-config-choice-list">
          <label v-for="site in siteVariants" :key="site.id" class="pm-config-choice">
            <input
              type="checkbox"
              :checked="config.regionIds?.includes(site.id)"
              @change="(e) => $emit('region-change', site.id, e.target.checked)"
            />
            {{ site.label }}
          </label>
        </div>
      </div>

      <!-- 操作类型 -->
      <div class="pm-config-subcard is-action">
        <span class="pm-config-subcard-title">操作类型</span>
        <div class="pm-config-choice-list">
          <label v-for="act in actionOptions" :key="act.id" class="pm-config-choice">
            <input
              type="radio"
              name="monitorActionType"
              :value="act.id"
              :checked="config.actionType === act.id"
              @change="() => $emit('action-change', act.id)"
            />
            {{ act.label }}
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { MONITOR_SITE_VARIANTS, MONITOR_CONFIG_ACTIONS, MIN_MONITOR_INTERVAL_SECONDS } from '../constants.js';

defineProps({
  config: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['config-change', 'region-change', 'action-change']);

const configOpen = ref(false);
const siteVariants = MONITOR_SITE_VARIANTS;
const actionOptions = MONITOR_CONFIG_ACTIONS;
const minInterval = MIN_MONITOR_INTERVAL_SECONDS;

function handleConfigFieldChange(field, value) {
  emit('config-change', field, value);
}
</script>

<style scoped>
.pm-monitor-config-card {
  display: grid;
  gap: 0;
  border-radius: 14px;
  border: 1px solid rgba(19, 34, 56, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(243, 247, 252, 0.94)),
    rgba(255, 255, 255, 0.92);
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(18, 34, 57, 0.06);
}

.pm-config-toggle-bar {
  display: flex;
  justify-content: flex-start;
  padding: 0;
}

.pm-config-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  background: transparent;
  border: none;
  color: #132238;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 120ms ease;
}

.pm-config-toggle-btn:hover {
  background: rgba(59, 130, 246, 0.04);
}

.pm-config-toggle-arrow {
  width: 18px;
  height: 18px;
  color: #64748b;
  transition: transform 200ms ease;
}

.pm-config-toggle-btn.is-open .pm-config-toggle-arrow {
  transform: rotate(180deg);
}

.pm-config-body {
  padding: 4px 22px 22px;
  display: grid;
  gap: 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.pm-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.pm-config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pm-config-label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.02em;
}

.pm-config-input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(39, 61, 89, 0.14);
  border-radius: 8px;
  background: rgba(244, 247, 251, 0.96);
  color: #18304a;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.pm-config-input:focus {
  border-color: rgba(33, 96, 173, 0.46);
  box-shadow: 0 0 0 3px rgba(33, 96, 173, 0.12);
  background: rgba(255, 255, 255, 0.98);
}

.pm-config-subcard {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.1);
  align-items: start;
}

.pm-config-subcard.is-action {
  background: rgba(201, 138, 50, 0.05);
  border-color: rgba(201, 138, 50, 0.18);
}

.pm-config-subcard-title {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.02em;
  padding-top: 6px;
}

.pm-config-choice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}

.pm-config-choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.16);
  font-size: 13px;
  color: #1e293b;
  cursor: pointer;
  user-select: none;
  transition: border-color 120ms ease, background 120ms ease;
}

.pm-config-choice:hover {
  border-color: rgba(33, 96, 173, 0.3);
  background: rgba(255, 255, 255, 1);
}

.pm-config-choice input[type="checkbox"],
.pm-config-choice input[type="radio"] {
  margin: 0;
  width: 14px;
  height: 14px;
  accent-color: #2563eb;
}

body.dark-theme .pm-monitor-config-card {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(20, 30, 48, 0.94)),
    rgba(15, 23, 42, 0.92);
  border-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .pm-config-toggle-btn {
  color: #e5eefc;
}

body.dark-theme .pm-config-toggle-btn:hover {
  background: rgba(59, 130, 246, 0.08);
}

body.dark-theme .pm-config-body {
  border-top-color: rgba(148, 163, 184, 0.14);
}

body.dark-theme .pm-config-label {
  color: #94a3b8;
}

body.dark-theme .pm-config-input {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(148, 163, 184, 0.18);
  color: #e5eefc;
}

body.dark-theme .pm-config-input:focus {
  background: rgba(15, 23, 42, 0.8);
  border-color: rgba(96, 165, 250, 0.4);
}

body.dark-theme .pm-config-subcard {
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(148, 163, 184, 0.12);
}

body.dark-theme .pm-config-subcard.is-action {
  background: rgba(201, 138, 50, 0.06);
  border-color: rgba(201, 138, 50, 0.18);
}

body.dark-theme .pm-config-subcard-title {
  color: #94a3b8;
}

body.dark-theme .pm-config-choice {
  background: rgba(15, 23, 42, 0.7);
  border-color: rgba(148, 163, 184, 0.16);
  color: #e5eefc;
}

body.dark-theme .pm-config-choice:hover {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(96, 165, 250, 0.3);
}
</style>
