<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="pm-modal-overlay" @click.self="cancel">
        <div class="pm-modal" style="width: 580px;">
          <div class="pm-modal-header">
            <h2 class="pm-modal-title">店铺监控配置</h2>
            <button class="pm-modal-close" @click="cancel">&times;</button>
          </div>

          <div class="shop-config-body">
            <div v-if="followsGlobal" class="pm-alert-info">
              当前店铺默认跟随全局监控配置。
            </div>

            <div class="shop-config-form">
              <div class="config-field">
                <label>监控间隔（秒）</label>
                <input
                  type="number"
                  class="pm-config-input-full"
                  v-model.number="shopConfigDraft.monitorIntervalSeconds"
                  :min="5"
                />
              </div>
              <div class="config-field">
                <label>每日操作上限</label>
                <input
                  type="number"
                  class="pm-config-input-full"
                  v-model.number="shopConfigDraft.dailyOperationLimit"
                  :min="0"
                  placeholder="留空不限制"
                />
              </div>
              <div class="config-field">
                <label>总操作上限</label>
                <input
                  type="number"
                  class="pm-config-input-full"
                  v-model.number="shopConfigDraft.totalOperationLimit"
                  :min="0"
                  placeholder="留空不限制"
                />
              </div>
              <div class="config-field">
                <label>花费暂停阈值</label>
                <input
                  type="number"
                  class="pm-config-input-full"
                  v-model.number="shopConfigDraft.autoPauseSpendThreshold"
                  :min="0"
                  placeholder="留空不限制"
                />
              </div>
              <div class="config-field">
                <label>ROAS 暂停阈值</label>
                <input
                  type="number"
                  class="pm-config-input-full"
                  v-model.number="shopConfigDraft.autoPauseRoasThreshold"
                  :min="0"
                  placeholder="留空不限制"
                />
              </div>
            </div>
          </div>

          <div class="pm-modal-footer">
            <button class="pm-btn pm-btn-text" @click="resetToGlobal">恢复全局</button>
            <button class="pm-btn pm-btn-secondary" @click="cancel">取消</button>
            <button class="pm-btn pm-btn-primary" @click="save">保存店铺配置</button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { DEFAULT_MONITOR_INTERVAL_SECONDS } from '../constants.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  shopConfig: { type: Object, default: null }
});

const emit = defineEmits(['update:visible', 'save']);

const followsGlobal = ref(true);
const shopConfigDraft = reactive({
  monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
  dailyOperationLimit: '',
  totalOperationLimit: '',
  autoPauseSpendThreshold: '',
  autoPauseRoasThreshold: ''
});

watch(
  () => props.visible,
  (v) => {
    if (v) {
      if (props.shopConfig) {
        followsGlobal.value = false;
        Object.assign(shopConfigDraft, {
          monitorIntervalSeconds: props.shopConfig.monitorIntervalSeconds || DEFAULT_MONITOR_INTERVAL_SECONDS,
          dailyOperationLimit: props.shopConfig.dailyOperationLimit || '',
          totalOperationLimit: props.shopConfig.totalOperationLimit || '',
          autoPauseSpendThreshold: props.shopConfig.autoPauseSpendThreshold || '',
          autoPauseRoasThreshold: props.shopConfig.autoPauseRoasThreshold || ''
        });
      } else {
        followsGlobal.value = true;
        Object.assign(shopConfigDraft, {
          monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
          dailyOperationLimit: '',
          totalOperationLimit: '',
          autoPauseSpendThreshold: '',
          autoPauseRoasThreshold: ''
        });
      }
    }
  }
);

function cancel() {
  emit('update:visible', false);
}

function save() {
  emit('save', { ...shopConfigDraft });
  emit('update:visible', false);
}

function resetToGlobal() {
  followsGlobal.value = true;
  Object.assign(shopConfigDraft, {
    monitorIntervalSeconds: DEFAULT_MONITOR_INTERVAL_SECONDS,
    dailyOperationLimit: '',
    totalOperationLimit: '',
    autoPauseSpendThreshold: '',
    autoPauseRoasThreshold: ''
  });
}
</script>

<style>
/* ==================== Shop Config Modal ==================== */
.shop-config-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
}

.shop-config-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-field label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
</style>
