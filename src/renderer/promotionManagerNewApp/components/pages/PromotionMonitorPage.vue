<template>
  <section class="pm-new-feature-page pm-new-feature-page--monitor">
    <section class="pm-new-page-panel pm-new-monitor-workspace">
      <div class="pm-new-monitor-toolbar">
        <div class="pm-new-monitor-toolbar-main">
          <strong>{{ shopListTitle }}</strong>
          <div class="pm-new-monitor-toolbar-tags">
            <a-tag size="small" bordered>{{ shopCountText }}</a-tag>
            <a-tag size="small" bordered>{{ metricCountText }}</a-tag>
            <a-tag size="small" bordered>{{ selectedRegionText }}</a-tag>
          </div>
        </div>

        <div class="pm-new-monitor-toolbar-actions">
          <label class="pm-new-monitor-batch-toggle">
            <span>{{ batchMonitorLabel }}</span>
            <a-switch
              size="small"
              :model-value="batchMonitoringActive"
              :loading="batchActiveSaving"
              :disabled="loading"
              @change="handleBatchActiveChange"
            />
          </label>

          <a-radio-group
            class="pm-new-monitor-filter-group"
            type="button"
            size="small"
            :model-value="activeFilter"
            @change="handleFilterChange"
          >
            <a-radio
              v-for="option in filterOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-radio>
          </a-radio-group>

          <a-button
            type="outline"
            size="small"
            @click="openGlobalConfigModal"
          >
            <template #icon>
              <IconSettings />
            </template>
            {{ configButtonLabel }}
          </a-button>

          <a-button
            type="outline"
            size="small"
            @click="openCustomizeModal"
          >
            <template #icon>
              <IconApps />
            </template>
            {{ customizeButtonLabel }}
          </a-button>

          <a-button
            type="outline"
            size="small"
            @click="openRuntimeLogDrawer"
          >
            <template #icon>
              <IconClockCircle />
            </template>
            {{ runtimeLogButtonLabel }}
          </a-button>

          <a-button
            type="outline"
            size="small"
            :loading="loading"
            @click="loadWorkspaceData"
          >
            <template #icon>
              <IconRefresh />
            </template>
            {{ refreshButtonLabel }}
          </a-button>
        </div>
      </div>

      <a-alert
        v-if="errorText"
        type="error"
        :content="errorText"
        show-icon
      />

      <PromotionMonitorDataTable
        :rows="monitorRows"
        :visible-columns="visibleColumns"
        :loading="loading"
        :toggling-shop-ids="togglingShopIds"
        :sort-state="monitorSortState"
        @toggle-shop="handleToggleShop"
        @open-shop-config="openShopConfigModal"
        @sorter-change="handleMonitorSorterChange"
      />
    </section>

    <PromotionMonitorCustomizeModal
      v-model:visible="customizeModalVisible"
      :selected-column-ids="selectedColumnIds"
      @apply="handleApplyColumns"
    />

    <PromotionMonitorRuntimeLogDrawer
      :visible="runtimeLogDrawerVisible"
      :entries="runtimeLogEntries"
      :total-count="runtimeLogTotalCount"
      :loading="runtimeLogLoading"
      @close="closeRuntimeLogDrawer"
      @refresh="loadRuntimeLogs"
      @clear="handleClearRuntimeLogs"
    />

    <a-modal
      :visible="configModalVisible"
      :mask-closable="false"
      :esc-to-close="true"
      :closable="!savingConfig"
      :footer="false"
      :width="960"
      modal-class="pm-new-monitor-config-modal"
      unmount-on-close
      @cancel="closeConfigModal"
    >
      <template #title>
        <div class="pm-new-monitor-modal-title">
          <strong>{{ configModalTitle }}</strong>
        </div>
      </template>

      <PromotionMonitorConfigPanel
        embedded
        :show-title="false"
        :config="configDraft"
        @update:config="handleConfigDraftUpdate"
      />

      <div class="pm-new-monitor-modal-footer">
        <a-button
          v-if="canClearShopConfig"
          status="danger"
          :loading="savingConfig"
          @click="handleClearShopConfig"
        >
          {{ clearShopConfigLabel }}
        </a-button>
        <span class="pm-new-monitor-modal-spacer"></span>
        <a-button
          :disabled="savingConfig"
          @click="closeConfigModal"
        >
          {{ cancelLabel }}
        </a-button>
        <a-button
          type="primary"
          :loading="savingConfig"
          @click="handleSaveConfig"
        >
          {{ saveLabel }}
        </a-button>
      </div>
    </a-modal>
  </section>
</template>

<script setup>
import {
  IconApps,
  IconClockCircle,
  IconRefresh,
  IconSettings
} from '@arco-design/web-vue/es/icon';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import PromotionMonitorConfigPanel from '../PromotionMonitorConfigPanel.vue';
import PromotionMonitorCustomizeModal from '../PromotionMonitorCustomizeModal.vue';
import PromotionMonitorDataTable from '../PromotionMonitorDataTable.vue';
import PromotionMonitorRuntimeLogDrawer from '../PromotionMonitorRuntimeLogDrawer.vue';
import {
  DEFAULT_MONITOR_COLUMN_IDS,
  MONITOR_FILTER_OPTIONS,
  normalizeMonitorColumnIds,
  normalizeMonitorFilter,
  resolveVisibleMonitorColumns,
  normalizeText
} from '../../view-models/promotionMonitorColumns.js';
import {
  MONITOR_REGION_OPTIONS,
  createDefaultPromotionMonitorConfig,
  normalizePromotionMonitorConfig
} from '../../view-models/promotionMonitorConfig.js';
import {
  buildPromotionMonitorRows,
  createDefaultPromotionMonitorSnapshot
} from '../../view-models/promotionMonitorRows.js';
import {
  applyPromotionMonitorLockedRowOrder,
  buildPromotionMonitorSortedRowIds,
  normalizeMonitorSortState
} from '../../view-models/promotionMonitorSorters.js';
import {
  clearPromotionMonitorShopConfigSettings,
  clearPromotionMonitorRuntimeLogs,
  loadPromotionMonitorWorkspaceData,
  loadPromotionMonitorRuntimeLogs,
  savePromotionMonitorConfigSettings,
  savePromotionMonitorShopConfigSettings,
  savePromotionMonitorViewSettings,
  loadPromotionMonitorSnapshot,
  setPromotionMonitorBatchActive,
  setPromotionMonitorShopEnabled
} from '../../services/promotionMonitorWorkspace.js';

const SNAPSHOT_REFRESH_INTERVAL_MS = 5000;
const RUNTIME_LOG_REFRESH_INTERVAL_MS = 3000;

const monitorConfig = ref(createDefaultPromotionMonitorConfig());
const monitorShopConfigs = shallowRef({});
const selectedColumnIds = ref([...DEFAULT_MONITOR_COLUMN_IDS]);
const activeFilter = ref('all');
const monitorSortState = ref(normalizeMonitorSortState());
const lockedMonitorRowIds = ref([]);
const snapshot = shallowRef(createDefaultPromotionMonitorSnapshot());
const shopState = shallowRef({ shops: [] });
const loading = ref(false);
const errorText = ref('');
const customizeModalVisible = ref(false);
const configModalVisible = ref(false);
const configModalMode = ref('global');
const configDraft = ref(createDefaultPromotionMonitorConfig());
const activeShopForConfig = ref(null);
const savingConfig = ref(false);
const batchActiveSaving = ref(false);
const togglingShopIds = ref([]);
const runtimeLogDrawerVisible = ref(false);
const runtimeLogLoading = ref(false);
const runtimeLogEntries = shallowRef([]);
const runtimeLogTotalCount = ref(0);
let snapshotRefreshTimer = 0;
let snapshotRefreshRunning = false;
let runtimeLogRefreshTimer = 0;

const shopListTitle = '\u5e97\u94fa\u5217\u8868';
const batchMonitorLabel = '\u6279\u91cf\u76d1\u63a7';
const configButtonLabel = '\u76d1\u63a7\u914d\u7f6e';
const customizeButtonLabel = '\u81ea\u5b9a\u4e49\u6570\u636e\u9879';
const runtimeLogButtonLabel = '\u8fd0\u884c\u65e5\u5fd7';
const refreshButtonLabel = '\u5237\u65b0';
const shopCountUnitLabel = '\u5bb6\u5e97\u94fa';
const metricCountUnitLabel = '\u4e2a\u6570\u636e\u9879';
const allRegionsLabel = '\u5168\u90e8\u5730\u533a';
const noRegionLabel = '\u672a\u9009\u62e9\u5730\u533a';
const globalConfigTitle = '\u76d1\u63a7\u914d\u7f6e';
const independentConfigTitle = '\u72ec\u7acb\u914d\u7f6e';
const clearShopConfigLabel = '\u6e05\u7a7a\u72ec\u7acb\u914d\u7f6e';
const cancelLabel = '\u53d6\u6d88';
const saveLabel = '\u4fdd\u5b58';
const loadFailedText = '\u63a8\u5e7f\u76d1\u63a7\u6570\u636e\u52a0\u8f7d\u5931\u8d25';
const saveFailedText = '\u76d1\u63a7\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25';
const toggleShopFailedText = '\u5e97\u94fa\u76d1\u63a7\u72b6\u6001\u66f4\u65b0\u5931\u8d25';
const batchActiveFailedText = '\u6279\u91cf\u76d1\u63a7\u72b6\u6001\u66f4\u65b0\u5931\u8d25';
const viewSaveFailedText = '\u6570\u636e\u9879\u8bbe\u7f6e\u4fdd\u5b58\u5931\u8d25';
const runtimeLogLoadFailedText = '\u63a8\u5e7f\u76d1\u63a7\u8fd0\u884c\u65e5\u5fd7\u52a0\u8f7d\u5931\u8d25';
const runtimeLogClearFailedText = '\u63a8\u5e7f\u76d1\u63a7\u8fd0\u884c\u65e5\u5fd7\u6e05\u7a7a\u5931\u8d25';
const filterOptions = MONITOR_FILTER_OPTIONS;
const regionOptions = MONITOR_REGION_OPTIONS;

const rawMonitorRows = computed(() => buildPromotionMonitorRows({
  snapshot: snapshot.value,
  shopRows: shopState.value && Array.isArray(shopState.value.shops) ? shopState.value.shops : [],
  selectedRegionIds: monitorConfig.value.regionIds,
  monitorShopConfigs: monitorShopConfigs.value
}));
const monitorRows = computed(() => applyPromotionMonitorLockedRowOrder(
  rawMonitorRows.value,
  lockedMonitorRowIds.value,
  monitorSortState.value
));

const visibleColumns = computed(() => resolveVisibleMonitorColumns(
  selectedColumnIds.value,
  activeFilter.value
));

const batchMonitoringActive = computed(() => (
  snapshot.value && snapshot.value.batchMonitoringActive === true
));

const shopCountText = computed(() => `${monitorRows.value.length} ${shopCountUnitLabel}`);
const metricCountText = computed(() => `${visibleColumns.value.length} ${metricCountUnitLabel}`);
const selectedRegionText = computed(() => buildRegionSummaryText(monitorConfig.value.regionIds));
const configModalTitle = computed(() => {
  if (configModalMode.value !== 'shop') {
    return globalConfigTitle;
  }

  const shopName = normalizeText(activeShopForConfig.value && activeShopForConfig.value.shopName);

  return `${shopName || independentConfigTitle} ${independentConfigTitle}`;
});
const canClearShopConfig = computed(() => {
  const shopId = normalizeText(activeShopForConfig.value && activeShopForConfig.value.shopId);

  return (
    configModalMode.value === 'shop'
    && Boolean(shopId)
    && Boolean(monitorShopConfigs.value && monitorShopConfigs.value[shopId])
  );
});

function buildRegionSummaryText(regionIds) {
  const normalizedRegionIds = Array.isArray(regionIds) ? regionIds : [];

  if (normalizedRegionIds.length <= 0) {
    return noRegionLabel;
  }

  if (normalizedRegionIds.length >= regionOptions.length) {
    return allRegionsLabel;
  }

  const labelByValue = new Map(regionOptions.map((option) => [option.value, option.label]));

  return normalizedRegionIds
    .map((regionId) => labelByValue.get(regionId) || regionId)
    .join(' / ');
}

function buildErrorText(error, fallbackText) {
  return normalizeText(error && error.message) || fallbackText;
}

function applySettingsResult(settingsResult) {
  if (!settingsResult || typeof settingsResult !== 'object') {
    return;
  }

  if (settingsResult.monitorConfig) {
    monitorConfig.value = normalizePromotionMonitorConfig(settingsResult.monitorConfig);
  }

  if (settingsResult.monitorShopConfigs && typeof settingsResult.monitorShopConfigs === 'object') {
    monitorShopConfigs.value = { ...settingsResult.monitorShopConfigs };
  }

  if (settingsResult.monitorView && typeof settingsResult.monitorView === 'object') {
    activeFilter.value = normalizeMonitorFilter(settingsResult.monitorView.activeFilter);
    selectedColumnIds.value = normalizeMonitorColumnIds(settingsResult.monitorView.selectedColumnIds);
  }
}

function applyWorkspaceData(workspaceData) {
  const data = workspaceData && typeof workspaceData === 'object' ? workspaceData : {};
  const settings = data.settings || {};

  applySettingsResult(settings);
  snapshot.value = data.snapshot && typeof data.snapshot === 'object'
    ? data.snapshot
    : createDefaultPromotionMonitorSnapshot();
  shopState.value = data.shopState && typeof data.shopState === 'object'
    ? data.shopState
    : { shops: [] };
  errorText.value = Array.isArray(data.errors) && data.errors.length > 0
    ? data.errors.join('\n')
    : '';
}

async function loadWorkspaceData() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  errorText.value = '';

  try {
    applyWorkspaceData(await loadPromotionMonitorWorkspaceData());
  } catch (error) {
    errorText.value = buildErrorText(error, loadFailedText);
  } finally {
    loading.value = false;
  }
}

async function refreshMonitorSnapshot() {
  if (snapshotRefreshRunning || loading.value) {
    return;
  }

  snapshotRefreshRunning = true;

  try {
    snapshot.value = await loadPromotionMonitorSnapshot();
  } catch (error) {
    if (!errorText.value) {
      errorText.value = buildErrorText(error, loadFailedText);
    }
  } finally {
    snapshotRefreshRunning = false;
  }
}

function startSnapshotRefresh() {
  if (snapshotRefreshTimer) {
    return;
  }

  snapshotRefreshTimer = window.setInterval(() => {
    void refreshMonitorSnapshot();
  }, SNAPSHOT_REFRESH_INTERVAL_MS);
}

function stopSnapshotRefresh() {
  if (!snapshotRefreshTimer) {
    return;
  }

  window.clearInterval(snapshotRefreshTimer);
  snapshotRefreshTimer = 0;
}

function applyRuntimeLogsResult(result) {
  const source = result && typeof result === 'object' ? result : {};

  runtimeLogEntries.value = Array.isArray(source.entries) ? source.entries : [];
  runtimeLogTotalCount.value = Math.max(0, Number(source.totalCount) || 0);
}

async function loadRuntimeLogs() {
  if (runtimeLogLoading.value) {
    return;
  }

  runtimeLogLoading.value = true;

  try {
    applyRuntimeLogsResult(await loadPromotionMonitorRuntimeLogs({ limit: 180 }));
  } catch (error) {
    errorText.value = buildErrorText(error, runtimeLogLoadFailedText);
  } finally {
    runtimeLogLoading.value = false;
  }
}

function startRuntimeLogRefresh() {
  if (runtimeLogRefreshTimer) {
    return;
  }

  runtimeLogRefreshTimer = window.setInterval(() => {
    if (runtimeLogDrawerVisible.value) {
      void loadRuntimeLogs();
    }
  }, RUNTIME_LOG_REFRESH_INTERVAL_MS);
}

function stopRuntimeLogRefresh() {
  if (!runtimeLogRefreshTimer) {
    return;
  }

  window.clearInterval(runtimeLogRefreshTimer);
  runtimeLogRefreshTimer = 0;
}

function openRuntimeLogDrawer() {
  runtimeLogDrawerVisible.value = true;
  void loadRuntimeLogs();
  startRuntimeLogRefresh();
}

function closeRuntimeLogDrawer() {
  runtimeLogDrawerVisible.value = false;
  stopRuntimeLogRefresh();
}

async function handleClearRuntimeLogs() {
  if (runtimeLogLoading.value) {
    return;
  }

  runtimeLogLoading.value = true;

  try {
    applyRuntimeLogsResult(await clearPromotionMonitorRuntimeLogs());
  } catch (error) {
    errorText.value = buildErrorText(error, runtimeLogClearFailedText);
  } finally {
    runtimeLogLoading.value = false;
  }
}

async function persistViewSettings() {
  try {
    applySettingsResult(await savePromotionMonitorViewSettings({
      selectedColumnIds: selectedColumnIds.value,
      activeFilter: activeFilter.value
    }));
  } catch (error) {
    errorText.value = buildErrorText(error, viewSaveFailedText);
  }
}

function handleFilterChange(value) {
  activeFilter.value = normalizeMonitorFilter(value);
  void persistViewSettings();
}

function openCustomizeModal() {
  customizeModalVisible.value = true;
}

function handleApplyColumns(columnIds) {
  selectedColumnIds.value = normalizeMonitorColumnIds(columnIds);
  void persistViewSettings();
}

function handleMonitorSorterChange(payload) {
  const nextSortState = normalizeMonitorSortState(payload);

  monitorSortState.value = nextSortState;
  lockedMonitorRowIds.value = nextSortState.field && nextSortState.direction
    ? buildPromotionMonitorSortedRowIds(rawMonitorRows.value, nextSortState)
    : [];
}

function openGlobalConfigModal() {
  configModalMode.value = 'global';
  activeShopForConfig.value = null;
  configDraft.value = normalizePromotionMonitorConfig(monitorConfig.value);
  configModalVisible.value = true;
}

function openShopConfigModal(row) {
  const shopId = normalizeText(row && row.shopId);
  const shopConfig = shopId && monitorShopConfigs.value ? monitorShopConfigs.value[shopId] : null;

  configModalMode.value = 'shop';
  activeShopForConfig.value = row || null;
  configDraft.value = normalizePromotionMonitorConfig(shopConfig || monitorConfig.value);
  configModalVisible.value = true;
}

function closeConfigModal() {
  if (savingConfig.value) {
    return;
  }

  configModalVisible.value = false;
}

function handleConfigDraftUpdate(nextConfig) {
  configDraft.value = normalizePromotionMonitorConfig(nextConfig);
}

async function handleSaveConfig() {
  if (savingConfig.value) {
    return;
  }

  savingConfig.value = true;
  errorText.value = '';

  try {
    if (configModalMode.value === 'shop') {
      const shopId = normalizeText(activeShopForConfig.value && activeShopForConfig.value.shopId);

      applySettingsResult(await savePromotionMonitorShopConfigSettings({
        shopId,
        config: configDraft.value,
        currentShopConfigs: monitorShopConfigs.value
      }));
    } else {
      applySettingsResult(await savePromotionMonitorConfigSettings(configDraft.value));
    }

    configModalVisible.value = false;
  } catch (error) {
    errorText.value = buildErrorText(error, saveFailedText);
  } finally {
    savingConfig.value = false;
  }
}

async function handleClearShopConfig() {
  if (savingConfig.value || configModalMode.value !== 'shop') {
    return;
  }

  const shopId = normalizeText(activeShopForConfig.value && activeShopForConfig.value.shopId);

  if (!shopId) {
    return;
  }

  savingConfig.value = true;
  errorText.value = '';

  try {
    applySettingsResult(await clearPromotionMonitorShopConfigSettings({
      shopId,
      currentShopConfigs: monitorShopConfigs.value
    }));
    configModalVisible.value = false;
  } catch (error) {
    errorText.value = buildErrorText(error, saveFailedText);
  } finally {
    savingConfig.value = false;
  }
}

function setShopToggling(shopId, toggling) {
  const normalizedShopId = normalizeText(shopId);

  if (!normalizedShopId) {
    return;
  }

  const nextShopIds = new Set(togglingShopIds.value);

  if (toggling === true) {
    nextShopIds.add(normalizedShopId);
  } else {
    nextShopIds.delete(normalizedShopId);
  }

  togglingShopIds.value = Array.from(nextShopIds);
}

async function handleToggleShop(row, checked) {
  const shopId = normalizeText(row && row.shopId);

  if (!shopId || togglingShopIds.value.includes(shopId)) {
    return;
  }

  setShopToggling(shopId, true);
  errorText.value = '';

  try {
    snapshot.value = await setPromotionMonitorShopEnabled({
      shopId,
      enabled: checked === true
    });
  } catch (error) {
    errorText.value = buildErrorText(error, toggleShopFailedText);
  } finally {
    setShopToggling(shopId, false);
  }
}

async function handleBatchActiveChange(checked) {
  if (batchActiveSaving.value) {
    return;
  }

  batchActiveSaving.value = true;
  errorText.value = '';

  try {
    snapshot.value = await setPromotionMonitorBatchActive(checked === true);
  } catch (error) {
    errorText.value = buildErrorText(error, batchActiveFailedText);
  } finally {
    batchActiveSaving.value = false;
  }
}

onMounted(() => {
  void loadWorkspaceData();
  startSnapshotRefresh();
});

onBeforeUnmount(() => {
  stopSnapshotRefresh();
  stopRuntimeLogRefresh();
});
</script>
