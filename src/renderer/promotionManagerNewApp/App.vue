<template>
  <main class="pm-new-shell">
    <FunctionSwitchBar
      :modules="modules"
      :active-module-id="activeModuleId"
      :secondary-action="copy.secondaryAction"
      :primary-action="copy.primaryAction"
      @change="handleModuleChange"
    />

    <section class="pm-new-layout">
      <section class="pm-new-page-frame">
        <KeepAlive>
          <component
            :is="activePageComponent"
            v-bind="activePageProps"
          />
        </KeepAlive>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  APP_COPY,
  LOG_ROWS,
  MODULES,
  POLICY_GROUPS,
  SUMMARY_METRICS,
  TABLE_COLUMNS,
  TABLE_ROWS
} from './constants.js';
import FunctionSwitchBar from './components/FunctionSwitchBar.vue';
import CreatePromotionPage from './components/pages/CreatePromotionPage.vue';
import PromotionDetailPage from './components/pages/PromotionDetailPage.vue';
import PromotionMonitorPage from './components/pages/PromotionMonitorPage.vue';
import RuntimeLogsPage from './components/pages/RuntimeLogsPage.vue';

const copy = APP_COPY;
const modules = MODULES;
const summaryMetrics = SUMMARY_METRICS;
const tableColumns = TABLE_COLUMNS;
const tableRows = TABLE_ROWS;
const policyGroups = POLICY_GROUPS;
const logRows = LOG_ROWS;
const activeModuleId = ref('create');

const pageComponentMap = Object.freeze({
  create: CreatePromotionPage,
  detail: PromotionDetailPage,
  monitor: PromotionMonitorPage,
  logs: RuntimeLogsPage
});

const activePageComponent = computed(() => (
  pageComponentMap[activeModuleId.value] || CreatePromotionPage
));

const activePageProps = computed(() => {
  if (activeModuleId.value === 'detail') {
    return {
      metrics: summaryMetrics,
      columns: tableColumns,
      rows: tableRows
    };
  }

  if (activeModuleId.value === 'monitor') {
    return {
      metrics: summaryMetrics,
      policyGroups
    };
  }

  if (activeModuleId.value === 'logs') {
    return {
      logs: logRows
    };
  }

  return {
    columns: tableColumns,
    rows: tableRows
  };
});

function handleModuleChange(moduleId) {
  activeModuleId.value = moduleId;
}

function refresh() {
  return Promise.resolve(null);
}

defineExpose({
  refresh
});
</script>
