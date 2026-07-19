<template>
  <main class="pm-new-shell">
    <FunctionSwitchBar
      :modules="modules"
      :active-module-id="activeModuleId"
      @change="handleModuleChange"
    />

    <section class="pm-new-layout">
      <section class="pm-new-page-frame">
        <KeepAlive>
          <component
            :is="activePageComponent"
          />
        </KeepAlive>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue';
import { MODULES } from './constants.js';
import FunctionSwitchBar from './components/FunctionSwitchBar.vue';
import CreatePromotionPage from './components/pages/CreatePromotionPage.vue';
import PromotionDetailPage from './components/pages/PromotionDetailPage.vue';
import PromotionMonitorPage from './components/pages/PromotionMonitorPage.vue';
import PromotionShopDataPage from './components/pages/PromotionShopDataPage.vue';

const modules = MODULES;
const activeModuleId = ref('create');

const pageComponentMap = Object.freeze({
  create: CreatePromotionPage,
  shopData: PromotionShopDataPage,
  detail: PromotionDetailPage,
  monitor: PromotionMonitorPage
});

const activePageComponent = computed(() => (
  pageComponentMap[activeModuleId.value] || CreatePromotionPage
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
