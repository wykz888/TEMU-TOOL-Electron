<template>
  <main class="pm-new-shell">
    <FunctionSwitchBar
      :title="copy.title"
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
  TABLE_ROWS,
  WORKFLOW_STEPS
} from './constants.js';
import FunctionSwitchBar from './components/FunctionSwitchBar.vue';
import CreatePromotionPage from './components/pages/CreatePromotionPage.vue';
import PromotionDetailPage from './components/pages/PromotionDetailPage.vue';
import PromotionMonitorPage from './components/pages/PromotionMonitorPage.vue';
import RuntimeLogsPage from './components/pages/RuntimeLogsPage.vue';

const copy = APP_COPY;
const modules = MODULES;
const summaryMetrics = SUMMARY_METRICS;
const workflowSteps = WORKFLOW_STEPS;
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

const activeModule = computed(() => (
  modules.find((moduleItem) => moduleItem.id === activeModuleId.value)
  || modules[0]
));

const activePageComponent = computed(() => (
  pageComponentMap[activeModuleId.value] || CreatePromotionPage
));

const activePageProps = computed(() => {
  const commonProps = {
    module: activeModule.value
  };

  if (activeModuleId.value === 'detail') {
    return {
      ...commonProps,
      metrics: summaryMetrics,
      columns: tableColumns,
      rows: tableRows
    };
  }

  if (activeModuleId.value === 'monitor') {
    return {
      ...commonProps,
      metrics: summaryMetrics,
      policyGroups
    };
  }

  if (activeModuleId.value === 'logs') {
    return {
      ...commonProps,
      logs: logRows
    };
  }

  return {
    ...commonProps,
    steps: workflowSteps,
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
