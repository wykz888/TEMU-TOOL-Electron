<template>
  <section class="pod-panel pod-sku-panel pod-universal-sku-panel">
    <div class="pod-panel-head">
      <div>
        <p class="pod-panel-tag">SKU</p>
        <h2 class="pod-panel-title">SKU&#x89C4;&#x683C;&#x4E0E;&#x57FA;&#x7840;&#x6570;&#x636E;</h2>
      </div>
      <a-tag class="pod-miaoshou-theme-tag" bordered>{{ skuRows.length }} SKU</a-tag>
    </div>
    <div class="pod-sku-layout">
      <label class="pod-field">
        <span class="pod-field-label">
          SKU&#x89C4;&#x683C;1
          <a-tooltip content="&#x591A;&#x4E2A;&#x89C4;&#x683C;&#x503C;&#x53EF;&#x6362;&#x884C;&#x586B;&#x5199;&#xFF0C;&#x7528;&#x4E8E;&#x751F;&#x6210; SKU &#x884C;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-textarea v-model="globalForm.specValueOne" :auto-size="{ minRows: 2, maxRows: 3 }" @change="handleSkuSpecChange" />
      </label>
      <label class="pod-field">
        <span class="pod-field-label">
          SKU&#x89C4;&#x683C;2
          <a-tooltip content="&#x7B2C;&#x4E8C;&#x7EC4; SKU &#x89C4;&#x683C;&#xFF0C;&#x6CA1;&#x6709;&#x53EF;&#x7559;&#x7A7A;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-textarea v-model="globalForm.specValueTwo" :auto-size="{ minRows: 2, maxRows: 3 }" @change="handleSkuSpecChange" />
      </label>
    </div>
    <a-table class="pod-sku-table" row-key="key" :data="skuRows" :pagination="false" :scroll="skuTableScroll">
      <template #columns>
        <a-table-column data-index="specValueOne" :width="128">
          <template #title>
            <span class="pod-table-title">&#x89C4;&#x683C;&#x503C;1<a-tooltip content="&#x7531;&#x4E0A;&#x65B9; SKU &#x89C4;&#x683C;1 &#x81EA;&#x52A8;&#x751F;&#x6210;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
        </a-table-column>
        <a-table-column data-index="specValueTwo" :width="128">
          <template #title>
            <span class="pod-table-title">&#x89C4;&#x683C;&#x503C;2<a-tooltip content="&#x7531;&#x4E0A;&#x65B9; SKU &#x89C4;&#x683C;2 &#x81EA;&#x52A8;&#x751F;&#x6210;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
        </a-table-column>
        <a-table-column :width="132">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">SKU&#x552E;&#x4EF7;<a-tooltip content="&#x8BE5; SKU &#x7684;&#x552E;&#x4EF7;&#xFF0C;&#x5BFC;&#x51FA;&#x5230;&#x901A;&#x7528;&#x8868;&#x683C;&#x7684; SKU &#x552E;&#x4EF7;&#x5B57;&#x6BB5;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(CNY)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].declaredPrice" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="150">
          <template #title>
            <span class="pod-table-title">SKU&#x56FE;&#x7247;<a-tooltip content="&#x6309;&#x539F;&#x5BFC;&#x5165;&#x987A;&#x5E8F;&#x9009;&#x62E9;&#x56FE;&#x7247;&#xFF0C;&#x968F;&#x673A;&#x4E3B;&#x56FE;&#x4E0D;&#x4F1A;&#x6539;&#x53D8;&#x8FD9;&#x4E2A;&#x5E8F;&#x53F7;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-select v-model="skuConfigMap[record.key].skuImage" allow-clear popup-container="body" :options="skuImageOptions" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="150">
          <template #title>
            <span class="pod-table-title">&#x5E73;&#x53F0;SKU<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x5E73;&#x53F0; SKU &#x7F16;&#x7801;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].platformSku" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="116">
          <template #title>
            <span class="pod-table-title">SKU&#x5E93;&#x5B58;<a-tooltip content="&#x8BE5; SKU &#x7684;&#x5E93;&#x5B58;&#x6570;&#x91CF;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].stock" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="144">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">SKU&#x91CD;&#x91CF;<a-tooltip content="&#x8BE5; SKU &#x7684;&#x91CD;&#x91CF;&#xFF0C;&#x901A;&#x7528;&#x8868;&#x683C;&#x4F7F;&#x7528; KG&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(KG)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuWeightKg" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="156">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">SKU&#x5C3A;&#x5BF8;<a-tooltip content="&#x8BE5; SKU &#x7684;&#x5C3A;&#x5BF8;&#xFF0C;&#x53EF;&#x586B; 20X10X3 &#x8FD9;&#x7C7B;&#x683C;&#x5F0F;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(CM)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuSize" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
      </template>
    </a-table>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';

const props = defineProps({
  globalForm: {
    type: Object,
    required: true
  },
  skuRows: {
    type: Array,
    default: () => []
  },
  skuConfigMap: {
    type: Object,
    required: true
  },
  skuImageOptions: {
    type: Array,
    default: () => []
  },
  syncSkuConfigToProducts: {
    type: Function,
    required: true
  },
  handleSkuSpecChange: {
    type: Function,
    required: true
  }
});

const skuTableScroll = computed(() => {
  const rowCount = props.skuRows.length;
  const scroll = { x: 1104 };

  if (rowCount > 8) {
    scroll.y = 8 * 48;
  }

  return scroll;
});
</script>
