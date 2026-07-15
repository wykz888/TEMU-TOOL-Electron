<template>
  <main class="pm-new-shell">
    <header class="pm-new-header">
      <div class="pm-new-title-block">
        <a-tag class="pm-new-eyebrow" bordered>{{ copy.eyebrow }}</a-tag>
        <h1>{{ copy.title }}</h1>
        <p>{{ copy.subtitle }}</p>
      </div>

      <div class="pm-new-header-actions">
        <a-tag color="green" bordered>{{ copy.statusLabel }}</a-tag>
        <a-button type="outline">
          <template #icon><icon-refresh /></template>
          {{ copy.secondaryAction }}
        </a-button>
        <a-button type="primary">
          <template #icon><icon-send /></template>
          {{ copy.primaryAction }}
        </a-button>
      </div>
    </header>

    <SummaryStrip :metrics="summaryMetrics" />

    <section class="pm-new-workspace">
      <ModuleRail
        :modules="modules"
        :active-module-id="activeModuleId"
        @change="handleModuleChange"
      />
      <WorkflowPanel
        :module="activeModule"
        :steps="workflowSteps"
        :columns="tableColumns"
        :rows="tableRows"
      />
      <SideInsightPanel :policy-groups="policyGroups" />
    </section>

    <RuntimeLogPanel :logs="logRows" />
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
import RuntimeLogPanel from './components/RuntimeLogPanel.vue';
import SideInsightPanel from './components/SideInsightPanel.vue';
import SummaryStrip from './components/SummaryStrip.vue';
import WorkflowPanel from './components/WorkflowPanel.vue';

const copy = APP_COPY;
const modules = MODULES;
const summaryMetrics = SUMMARY_METRICS;
const workflowSteps = WORKFLOW_STEPS;
const tableColumns = TABLE_COLUMNS;
const tableRows = TABLE_ROWS;
const policyGroups = POLICY_GROUPS;
const logRows = LOG_ROWS;
const activeModuleId = ref('monitor');

const activeModule = computed(() => (
  modules.find((moduleItem) => moduleItem.id === activeModuleId.value)
  || modules[0]
));

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
