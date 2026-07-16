<template>
  <main class="pm-new-shell">
    <header class="pm-new-header">
      <div class="pm-new-title-block">
        <a-tag class="pm-new-eyebrow" bordered>{{ copy.eyebrow }}</a-tag>
        <h1>{{ copy.title }}</h1>
        <p>{{ copy.subtitle }}</p>
      </div>

      <div class="pm-new-header-actions">
        <a-tag color="green" bordered>{{ activeModule.label }}</a-tag>
        <a-button type="outline">
          <template #icon><icon-refresh /></template>
          {{ copy.secondaryAction }}
        </a-button>
        <a-button
          type="primary"
          @click="handleModuleChange('create')"
        >
          <template #icon><icon-send /></template>
          {{ copy.primaryAction }}
        </a-button>
      </div>
    </header>

    <section class="pm-new-layout">
      <ModuleRail
        :modules="modules"
        :active-module-id="activeModuleId"
        @change="handleModuleChange"
      />

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
  IconRefresh,
  IconSend
} from '@arco-design/web-vue/es/icon';
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
import ModuleRail from './components/ModuleRail.vue';
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
