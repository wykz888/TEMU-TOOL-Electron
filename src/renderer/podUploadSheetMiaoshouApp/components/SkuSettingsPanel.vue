<template>
  <section class="pod-panel pod-sku-panel">
    <div class="pod-panel-head">
      <div>
        <p class="pod-panel-tag">SKU</p>
        <h2 class="pod-panel-title">&#x89C4;&#x683C;&#x4E0E;&#x4EF7;&#x683C;</h2>
      </div>
      <a-tag class="pod-miaoshou-theme-tag" bordered>{{ skuRows.length }} SKU</a-tag>
    </div>
    <div class="pod-sku-name-row">
      <label class="pod-field">
        <span class="pod-field-label">
          &#x89C4;&#x683C;&#x540D;&#x79F0;1
          <a-tooltip content="&#x7B2C;&#x4E00;&#x7EC4; SKU &#x89C4;&#x683C;&#x540D;&#x79F0;&#xFF0C;&#x5982;&#x989C;&#x8272;&#x3001;&#x5C3A;&#x7801;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.specNameOne" @change="syncGlobalToProducts" />
      </label>
      <label class="pod-field">
        <span class="pod-field-label">
          &#x89C4;&#x683C;&#x540D;&#x79F0;2
          <a-tooltip content="&#x7B2C;&#x4E8C;&#x7EC4; SKU &#x89C4;&#x683C;&#x540D;&#x79F0;&#xFF0C;&#x6CA1;&#x6709;&#x53EF;&#x7559;&#x7A7A;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-input v-model="globalForm.specNameTwo" @change="syncGlobalToProducts" />
      </label>
    </div>
    <div class="pod-sku-value-row">
      <label class="pod-field">
        <span class="pod-field-label">
          &#x89C4;&#x683C;&#x503C;1
          <a-tooltip content="&#x591A;&#x4E2A;&#x89C4;&#x683C;&#x503C;&#x53EF;&#x6362;&#x884C;&#x586B;&#x5199;&#xFF0C;&#x7528;&#x4E8E;&#x751F;&#x6210; SKU &#x6570;&#x636E;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-textarea v-model="globalForm.specValueOne" :auto-size="{ minRows: 2, maxRows: 3 }" @change="handleSkuSpecChange" />
      </label>
      <label class="pod-field">
        <span class="pod-field-label">
          &#x89C4;&#x683C;&#x503C;2
          <a-tooltip content="&#x591A;&#x4E2A;&#x89C4;&#x683C;&#x503C;&#x53EF;&#x6362;&#x884C;&#x586B;&#x5199;&#xFF0C;&#x6CA1;&#x6709;&#x53EF;&#x7559;&#x7A7A;&#x3002;">
            <icon-question-circle class="pod-help-icon" />
          </a-tooltip>
        </span>
        <a-textarea v-model="globalForm.specValueTwo" :auto-size="{ minRows: 2, maxRows: 3 }" @change="handleSkuSpecChange" />
      </label>
    </div>
    <a-table class="pod-sku-table" row-key="key" :data="skuRows" :pagination="false" :scroll="skuTableScroll">
      <template #columns>
        <a-table-column data-index="specValueOne" :width="POD_SKU_COLUMN_WIDTHS.specValue">
          <template #title>
            <span class="pod-table-title">&#x89C4;&#x683C;&#x503C;1<a-tooltip content="&#x7531;&#x4E0A;&#x65B9;&#x89C4;&#x683C;&#x503C;1&#x81EA;&#x52A8;&#x751F;&#x6210;&#xFF0C;&#x6BCF;&#x4E00;&#x884C;&#x5BF9;&#x5E94;&#x4E00;&#x4E2A; SKU &#x7EC4;&#x5408;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
        </a-table-column>
        <a-table-column data-index="specValueTwo" :width="POD_SKU_COLUMN_WIDTHS.specValue">
          <template #title>
            <span class="pod-table-title">&#x89C4;&#x683C;&#x503C;2<a-tooltip content="&#x7531;&#x4E0A;&#x65B9;&#x89C4;&#x683C;&#x503C;2&#x81EA;&#x52A8;&#x751F;&#x6210;&#xFF0C;&#x6CA1;&#x6709;&#x7B2C;&#x4E8C;&#x89C4;&#x683C;&#x65F6;&#x53EF;&#x4E3A;&#x7A7A;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.previewImage">
          <template #title>
            <span class="pod-table-title">&#x9884;&#x89C8;&#x56FE;<a-tooltip content="&#x9009;&#x62E9;&#x8BE5; SKU &#x5BF9;&#x5E94;&#x7684;&#x8F6E;&#x64AD;&#x56FE;&#x5E8F;&#x53F7;&#xFF0C;&#x5BFC;&#x51FA;&#x5230;&#x9884;&#x89C8;&#x56FE;&#x6216;&#x989C;&#x8272;&#x56FE;&#x5B57;&#x6BB5;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-select v-model="skuConfigMap[record.key].skuImage" allow-clear popup-container="body" :options="skuImageOptions" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.price">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x7533;&#x62A5;&#x4EF7;<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x7533;&#x62A5;&#x4EF7;&#xFF0C;&#x5355;&#x4F4D; CNY&#xFF0C;&#x4F1A;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(CNY)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].declaredPrice" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.price">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x5EFA;&#x8BAE;&#x552E;&#x4EF7;<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x5EFA;&#x8BAE;&#x552E;&#x4EF7;&#xFF0C;&#x5355;&#x4F4D; CNY&#xFF0C;&#x4F1A;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(CNY)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].price" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.dimension">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x957F;<a-tooltip content="&#x8BE5; SKU &#x5305;&#x88C5;&#x957F;&#x5EA6;&#xFF0C;&#x5355;&#x4F4D; cm&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(cm)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].length" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.dimension">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x5BBD;<a-tooltip content="&#x8BE5; SKU &#x5305;&#x88C5;&#x5BBD;&#x5EA6;&#xFF0C;&#x5355;&#x4F4D; cm&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(cm)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].width" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.dimension">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x9AD8;<a-tooltip content="&#x8BE5; SKU &#x5305;&#x88C5;&#x9AD8;&#x5EA6;&#xFF0C;&#x5355;&#x4F4D; cm&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(cm)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].height" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.weight">
          <template #title>
            <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x91CD;&#x91CF;<a-tooltip content="&#x8BE5; SKU &#x91CD;&#x91CF;&#xFF0C;&#x5355;&#x4F4D; g&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(g)</span></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].weight" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.stock">
          <template #title>
            <span class="pod-table-title">&#x5E93;&#x5B58;<a-tooltip content="&#x8BE5; SKU &#x5E93;&#x5B58;&#x6570;&#x91CF;&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].stock" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.platformSku">
          <template #title>
            <span class="pod-table-title">&#x5E73;&#x53F0;SKU<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x5E73;&#x53F0; SKU &#x7F16;&#x7801;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].platformSku" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.skuCategory">
          <template #title>
            <span class="pod-table-title">SKU&#x5206;&#x7C7B;&#x7C7B;&#x578B;<a-tooltip content="&#x9700;&#x8981;&#x6309; SKU &#x5355;&#x72EC;&#x586B;&#x5199;&#x7684;&#x5206;&#x7C7B;&#x7C7B;&#x578B;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuCategoryType" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.skuCategory">
          <template #title>
            <span class="pod-table-title">SKU&#x5206;&#x7C7B;&#x6570;&#x91CF;<a-tooltip content="&#x9700;&#x8981;&#x6309; SKU &#x5355;&#x72EC;&#x586B;&#x5199;&#x7684;&#x5206;&#x7C7B;&#x6570;&#x91CF;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuCategoryCount" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.skuCategory">
          <template #title>
            <span class="pod-table-title">SKU&#x5206;&#x7C7B;&#x5355;&#x4F4D;<a-tooltip content="&#x9700;&#x8981;&#x6309; SKU &#x5355;&#x72EC;&#x586B;&#x5199;&#x7684;&#x5206;&#x7C7B;&#x5355;&#x4F4D;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuCategoryUnit" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
        <a-table-column :width="POD_SKU_COLUMN_WIDTHS.independentPackaging">
          <template #title>
            <span class="pod-table-title">&#x72EC;&#x7ACB;&#x5305;&#x88C5;<a-tooltip content="&#x8BE5; SKU &#x662F;&#x5426;&#x72EC;&#x7ACB;&#x5305;&#x88C5;&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          </template>
          <template #cell="{ record }"><a-select v-model="skuConfigMap[record.key].independentPackaging" allow-clear popup-container="body" :options="customOptions" @change="syncSkuConfigToProducts" /></template>
        </a-table-column>
      </template>
    </a-table>
  </section>
</template>

<script setup>
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';
import { POD_SKU_COLUMN_WIDTHS } from '../constants/skuTable.js';

defineProps({
  globalForm: {
    type: Object,
    required: true
  },
  skuRows: {
    type: Array,
    default: () => []
  },
  skuTableScroll: {
    type: Object,
    default: () => ({})
  },
  skuConfigMap: {
    type: Object,
    required: true
  },
  skuImageOptions: {
    type: Array,
    default: () => []
  },
  customOptions: {
    type: Array,
    default: () => []
  },
  syncGlobalToProducts: {
    type: Function,
    required: true
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
</script>
