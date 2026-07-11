<template>
  <div class="pod-miaoshou-app-shell" data-ui-version="20260710-layout-2">
    <header class="pod-miaoshou-app-header">
      <div class="pod-miaoshou-app-header__copy">
        <span class="pod-miaoshou-app-header__eyebrow">MIAOSHOU TEMU</span>
        <div class="pod-miaoshou-app-header__title-row">
          <h1>POD&#x4E0A;&#x8D27;&#x8868;&#x683C;</h1>
          <a-tag class="pod-miaoshou-theme-tag" bordered size="small">&#x5999;&#x624B; TEMU &#x7248;</a-tag>
        </div>
      </div>
    </header>

    <main class="pod-workbench">
      <section class="pod-panel pod-template-manage-panel">
        <div class="pod-panel-head">
          <div>
            <p class="pod-panel-tag">&#x6A21;&#x677F;</p>
            <h2 class="pod-panel-title">&#x6A21;&#x677F;&#x7BA1;&#x7406;</h2>
          </div>
        </div>
        <div class="pod-template-save-row">
          <div class="pod-field pod-inline-field">
            <span class="pod-field-label">
              &#x5DF2;&#x4FDD;&#x5B58;&#x6A21;&#x677F;
              <a-tooltip content="&#x9009;&#x62E9;&#x5DF2;&#x4FDD;&#x5B58;&#x7684;&#x6A21;&#x677F;&#xFF0C;&#x4F1A;&#x540C;&#x6B65;&#x5230;&#x5F53;&#x524D;&#x8868;&#x5355;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-select
              v-model="selectedTemplateId"
              allow-clear
              popup-container="body"
              :loading="loadingTemplates"
              :options="formTemplateOptions"
              @change="applySelectedTemplate"
            />
          </div>
          <div class="pod-field pod-inline-field">
            <span class="pod-field-label">
              &#x6A21;&#x677F;&#x540D;&#x79F0;
              <a-tooltip content="&#x4FDD;&#x5B58;&#x5F53;&#x524D;&#x8868;&#x5355;&#x914D;&#x7F6E;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x540D;&#x79F0;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-input v-model="templateName" allow-clear />
          </div>
          <div class="pod-template-save-actions">
            <a-button class="pod-theme-button" type="primary" :loading="savingTemplate" @click="saveCurrentTemplate">
              &#x4FDD;&#x5B58;&#x6A21;&#x677F;
            </a-button>
            <a-button class="pod-danger-button" :disabled="!selectedTemplateId" :loading="deletingTemplate" @click="deleteSelectedTemplate">
              &#x5220;&#x9664;&#x6A21;&#x677F;
            </a-button>
          </div>
        </div>
      </section>

      <section class="pod-panel pod-template-panel">
        <div class="pod-panel-head">
          <div>
            <p class="pod-panel-tag">&#x57FA;&#x7840;</p>
            <h2 class="pod-panel-title">&#x57FA;&#x7840;&#x4FE1;&#x606F;&#x6A21;&#x677F;</h2>
          </div>
          <a-tag class="pod-miaoshou-theme-tag" bordered>{{ products.length }} &#x4E2A;&#x5546;&#x54C1;</a-tag>
        </div>
        <div class="pod-template-main-row">
          <div class="pod-field pod-template-select-field">
            <span class="pod-field-label">
              &#x8868;&#x683C;&#x6A21;&#x677F;
              <a-tooltip content="&#x9009;&#x62E9;&#x5BFC;&#x51FA;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x8868;&#x683C;&#x7C7B;&#x578B;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-select v-model="globalForm.templateId" popup-container="body" :options="templateTypeOptions" @change="syncGlobalToProducts" />
          </div>
          <div class="pod-field pod-category-field">
            <span class="pod-field-label">
              &#x56FA;&#x5B9A;&#x7C7B;&#x76EE;
              <a-tooltip content="&#x9009;&#x4E2D;&#x540E;&#x4F1A;&#x6279;&#x91CF;&#x540C;&#x6B65;&#x5230;&#x5F53;&#x524D;&#x5546;&#x54C1;&#x6570;&#x636E;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-select
              v-model="globalForm.category"
              allow-clear
              allow-search
              popup-container="body"
              :loading="loadingCategories"
              :options="categorySelectOptions"
              @change="syncGlobalToProducts"
            />
          </div>
        </div>
        <div class="pod-template-meta-row">
          <div class="pod-field">
            <span class="pod-field-label">
              &#x627F;&#x8BFA;&#x53D1;&#x8D27;&#x65F6;&#x6548;
              <a-tooltip content="&#x586B;&#x8868;&#x5BFC;&#x51FA;&#x65F6;&#x5199;&#x5165;&#x7684;&#x53D1;&#x8D27;&#x65F6;&#x6548;&#x503C;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-select v-model="globalForm.delivery" popup-container="body" :options="deliveryOptions" @change="syncGlobalToProducts" />
          </div>
          <label class="pod-field">
            <span class="pod-field-label">
              &#x4EA7;&#x5730;
              <a-tooltip content="&#x5BFC;&#x51FA;&#x8868;&#x683C;&#x65F6;&#x5199;&#x5165;&#x7684;&#x4EA7;&#x5730;&#x5185;&#x5BB9;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-input v-model="globalForm.origin" @change="syncGlobalToProducts" />
          </label>
          <div class="pod-field">
            <span class="pod-field-label">
              &#x5B9A;&#x5236;&#x54C1;
              <a-tooltip content="&#x6309;&#x5E73;&#x53F0;&#x8868;&#x683C;&#x8981;&#x6C42;&#x5199;&#x5165;&#x662F;&#x5426;&#x5B9A;&#x5236;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-select v-model="globalForm.isCustom" popup-container="body" :options="customOptions" @change="syncGlobalToProducts" />
          </div>
          <label class="pod-field pod-source-link-field">
            <span class="pod-field-label">
              &#x8D27;&#x6E90;&#x94FE;&#x63A5;
              <a-tooltip content="&#x53EF;&#x586B;&#x5199;&#x5546;&#x54C1;&#x6216;&#x7D20;&#x6750;&#x6765;&#x6E90;&#x94FE;&#x63A5;&#xFF0C;&#x4FBF;&#x4E8E;&#x8868;&#x683C;&#x8FFD;&#x6EAF;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-input v-model="globalForm.sourceLink" allow-clear @change="syncGlobalToProducts" />
          </label>
        </div>
        <div class="pod-template-description-row">
          <label class="pod-field">
            <span class="pod-field-label">
              &#x8BE6;&#x60C5;&#x63CF;&#x8FF0;
              <a-tooltip content="&#x6279;&#x91CF;&#x5199;&#x5165;&#x4EA7;&#x54C1;&#x8BE6;&#x60C5;&#x63CF;&#x8FF0;&#xFF0C;&#x4F1A;&#x540C;&#x6B65;&#x5230;&#x5546;&#x54C1;&#x6570;&#x636E;&#x3002;">
                <icon-question-circle class="pod-help-icon" />
              </a-tooltip>
            </span>
            <a-textarea v-model="globalForm.description" class="pod-description-textarea" :auto-size="{ minRows: 3, maxRows: 3 }" @change="syncGlobalToProducts" />
          </label>
        </div>
      </section>

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
            <a-table-column data-index="specValueOne" :width="120">
              <template #title>
                <span class="pod-table-title">&#x89C4;&#x683C;&#x503C;1<a-tooltip content="&#x7531;&#x4E0A;&#x65B9;&#x89C4;&#x683C;&#x503C;1&#x81EA;&#x52A8;&#x751F;&#x6210;&#xFF0C;&#x6BCF;&#x4E00;&#x884C;&#x5BF9;&#x5E94;&#x4E00;&#x4E2A; SKU &#x7EC4;&#x5408;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
            </a-table-column>
            <a-table-column data-index="specValueTwo" :width="120">
              <template #title>
                <span class="pod-table-title">&#x89C4;&#x683C;&#x503C;2<a-tooltip content="&#x7531;&#x4E0A;&#x65B9;&#x89C4;&#x683C;&#x503C;2&#x81EA;&#x52A8;&#x751F;&#x6210;&#xFF0C;&#x6CA1;&#x6709;&#x7B2C;&#x4E8C;&#x89C4;&#x683C;&#x65F6;&#x53EF;&#x4E3A;&#x7A7A;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
            </a-table-column>
            <a-table-column :width="170">
              <template #title>
                <span class="pod-table-title">&#x9884;&#x89C8;&#x56FE;<a-tooltip content="&#x9009;&#x62E9;&#x8BE5; SKU &#x5BF9;&#x5E94;&#x7684;&#x8F6E;&#x64AD;&#x56FE;&#x5E8F;&#x53F7;&#xFF0C;&#x5BFC;&#x51FA;&#x5230;&#x9884;&#x89C8;&#x56FE;&#x6216;&#x989C;&#x8272;&#x56FE;&#x5B57;&#x6BB5;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-select v-model="skuConfigMap[record.key].skuImage" allow-clear popup-container="body" :options="skuImageOptions" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="120">
              <template #title>
                <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x7533;&#x62A5;&#x4EF7;<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x7533;&#x62A5;&#x4EF7;&#xFF0C;&#x5355;&#x4F4D; CNY&#xFF0C;&#x4F1A;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(CNY)</span></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].declaredPrice" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="120">
              <template #title>
                <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x5EFA;&#x8BAE;&#x552E;&#x4EF7;<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x5EFA;&#x8BAE;&#x552E;&#x4EF7;&#xFF0C;&#x5355;&#x4F4D; CNY&#xFF0C;&#x4F1A;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(CNY)</span></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].price" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="90">
              <template #title>
                <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x957F;<a-tooltip content="&#x8BE5; SKU &#x5305;&#x88C5;&#x957F;&#x5EA6;&#xFF0C;&#x5355;&#x4F4D; cm&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(cm)</span></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].length" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="90">
              <template #title>
                <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x5BBD;<a-tooltip content="&#x8BE5; SKU &#x5305;&#x88C5;&#x5BBD;&#x5EA6;&#xFF0C;&#x5355;&#x4F4D; cm&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(cm)</span></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].width" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="90">
              <template #title>
                <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x9AD8;<a-tooltip content="&#x8BE5; SKU &#x5305;&#x88C5;&#x9AD8;&#x5EA6;&#xFF0C;&#x5355;&#x4F4D; cm&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(cm)</span></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].height" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="110">
              <template #title>
                <span class="pod-table-title pod-table-title--unit"><span class="pod-table-title-main">&#x91CD;&#x91CF;<a-tooltip content="&#x8BE5; SKU &#x91CD;&#x91CF;&#xFF0C;&#x5355;&#x4F4D; g&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><span class="pod-table-title-unit">(g)</span></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].weight" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="100">
              <template #title>
                <span class="pod-table-title">&#x5E93;&#x5B58;<a-tooltip content="&#x8BE5; SKU &#x5E93;&#x5B58;&#x6570;&#x91CF;&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].stock" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="150">
              <template #title>
                <span class="pod-table-title">&#x5E73;&#x53F0;SKU<a-tooltip content="&#x8BE5; SKU &#x5355;&#x72EC;&#x7684;&#x5E73;&#x53F0; SKU &#x7F16;&#x7801;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].platformSku" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="140">
              <template #title>
                <span class="pod-table-title">SKU&#x5206;&#x7C7B;&#x7C7B;&#x578B;<a-tooltip content="&#x9700;&#x8981;&#x6309; SKU &#x5355;&#x72EC;&#x586B;&#x5199;&#x7684;&#x5206;&#x7C7B;&#x7C7B;&#x578B;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuCategoryType" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="140">
              <template #title>
                <span class="pod-table-title">SKU&#x5206;&#x7C7B;&#x6570;&#x91CF;<a-tooltip content="&#x9700;&#x8981;&#x6309; SKU &#x5355;&#x72EC;&#x586B;&#x5199;&#x7684;&#x5206;&#x7C7B;&#x6570;&#x91CF;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuCategoryCount" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="140">
              <template #title>
                <span class="pod-table-title">SKU&#x5206;&#x7C7B;&#x5355;&#x4F4D;<a-tooltip content="&#x9700;&#x8981;&#x6309; SKU &#x5355;&#x72EC;&#x586B;&#x5199;&#x7684;&#x5206;&#x7C7B;&#x5355;&#x4F4D;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-input v-model="skuConfigMap[record.key].skuCategoryUnit" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
            <a-table-column :width="120">
              <template #title>
                <span class="pod-table-title">&#x72EC;&#x7ACB;&#x5305;&#x88C5;<a-tooltip content="&#x8BE5; SKU &#x662F;&#x5426;&#x72EC;&#x7ACB;&#x5305;&#x88C5;&#xFF0C;&#x6309;&#x884C;&#x5BFC;&#x51FA;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
              </template>
              <template #cell="{ record }"><a-select v-model="skuConfigMap[record.key].independentPackaging" allow-clear popup-container="body" :options="customOptions" @change="syncSkuConfigToProducts" /></template>
            </a-table-column>
          </template>
        </a-table>
      </section>

      <section ref="listPanelRef" class="pod-panel pod-list-panel">
        <div ref="listHeadRef" class="pod-list-head">
          <div>
            <p class="pod-panel-tag">&#x672C;&#x5730;&#x5546;&#x54C1;</p>
            <h2 class="pod-panel-title">&#x5546;&#x54C1;&#x6570;&#x636E;&#x5217;&#x8868;</h2>
          </div>
          <div class="pod-actions">
            <a-button class="pod-red-button" :loading="importingProducts" @click="importProducts">&#x5BFC;&#x5165;&#x672C;&#x5730;&#x5546;&#x54C1;</a-button>
            <a-button class="pod-blue-button" :disabled="!products.length" @click="openCarouselPreset">&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x8F6E;&#x64AD;&#x56FE;</a-button>
            <a-button class="pod-blue-button" :disabled="products.length < 1" @click="openRandomCarouselPreset">&#x6279;&#x91CF;&#x968F;&#x673A;&#x8F6E;&#x64AD;&#x56FE;</a-button>
            <a-button class="pod-blue-button" :disabled="!products.length" @click="openDescriptionPreset">&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x63CF;&#x8FF0;&#x56FE;</a-button>
            <a-button class="pod-red-button" :loading="uploadingImages" :disabled="!products.length" @click="uploadImages">
              {{ uploadingImages ? '\u4e0a\u4f20\u4e2d' : '\u6279\u91cf\u4e0a\u4f20\u56fe\u7247' }}
            </a-button>
            <a-button class="pod-red-button" :loading="generatingAiTitles" :disabled="!aiTitleEligibleCount" @click="openBatchAiTitleDialog">
              {{ generatingAiTitles ? '\u751f\u6210\u4e2d' : '\u6279\u91cfAI\u751f\u6210\u6807\u9898' }}
            </a-button>
            <a-button class="pod-theme-button" :loading="exportingTable" :disabled="!products.length" @click="exportTable">&#x5BFC;&#x51FA;&#x8868;&#x683C;</a-button>
            <a-button class="pod-danger-button" :disabled="!products.length" @click="clearProducts">&#x6E05;&#x7A7A;&#x5217;&#x8868;</a-button>
          </div>
        </div>
        <div v-if="uploadProgressText || aiTitleProgressText" ref="progressLineRef" class="pod-progress-line">
          <span v-if="uploadProgressText">{{ uploadProgressText }}</span>
          <span v-if="aiTitleProgressText">{{ aiTitleProgressText }}</span>
        </div>
        <a-table
          class="pod-product-table"
          row-key="id"
          :data="products"
          :pagination="false"
          :scroll="productTableScroll"
          :row-class="getProductRowClass"
          @row-click="selectProduct"
        >
          <template #columns>
            <a-table-column title="&#x672C;&#x5730;&#x5546;&#x54C1;" data-index="localName" :width="210">
              <template #cell="{ record }">
                <div class="pod-product-name">
                  <strong>{{ record.localName || '\u672a\u547d\u540d\u5546\u54c1' }}</strong>
                  <span>{{ record.sourceFolder || '\u6839\u76ee\u5f55' }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="&#x4EA7;&#x54C1;&#x6807;&#x9898;" :width="270">
              <template #cell="{ record }">
                <div class="pod-title-cell">
                  <a-textarea v-model="record.title" :max-length="TITLE_MAX_LENGTH" :auto-size="{ minRows: 2, maxRows: 4 }" @change="handleProductTitleChange(record, 'title')" />
                  <span class="pod-title-length" :class="{ 'is-over': getTextLength(record.title) > TITLE_MAX_LENGTH }">{{ getTextLength(record.title) }} / {{ TITLE_MAX_LENGTH }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="&#x82F1;&#x6587;&#x6807;&#x9898;" :width="270">
              <template #cell="{ record }">
                <div class="pod-title-cell">
                  <a-textarea v-model="record.englishTitle" :max-length="TITLE_MAX_LENGTH" :auto-size="{ minRows: 2, maxRows: 4 }" @change="handleProductTitleChange(record, 'englishTitle')" />
                  <span class="pod-title-length" :class="{ 'is-over': getTextLength(record.englishTitle) > TITLE_MAX_LENGTH }">{{ getTextLength(record.englishTitle) }} / {{ TITLE_MAX_LENGTH }}</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="&#x8F6E;&#x64AD;&#x56FE;" :width="220">
              <template #cell="{ record }">
                <div class="pod-chip-list" :title="getMaterialTitle(record, 'carousel')">
                  <a-tag v-for="item in getPreviewItems(record.materials.carousel)" :key="item" class="pod-material-chip" bordered>{{ getMaterialDisplayName(record, 'carousel', item) }}</a-tag>
                  <a-tag v-if="getExtraItemCount(record.materials.carousel)" class="pod-material-chip pod-material-chip-more" bordered>+{{ getExtraItemCount(record.materials.carousel) }}</a-tag>
                  <span v-if="!record.materials.carousel.length" class="pod-muted">&#x6682;&#x65E0;</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="&#x63CF;&#x8FF0;&#x56FE;" :width="220">
              <template #cell="{ record }">
                <div class="pod-chip-list" :title="getDescriptionImageTitle(record)">
                  <a-tag v-for="item in getPreviewItems(getDescriptionImageItems(record))" :key="item" class="pod-material-chip" bordered>{{ getMaterialDisplayName(record, 'carousel', item) }}</a-tag>
                  <a-tag v-if="getExtraItemCount(getDescriptionImageItems(record))" class="pod-material-chip pod-material-chip-more" bordered>+{{ getExtraItemCount(getDescriptionImageItems(record)) }}</a-tag>
                  <span v-if="!getDescriptionImageItems(record).length" class="pod-muted">&#x6682;&#x65E0;</span>
                </div>
              </template>
            </a-table-column>
            <a-table-column :width="130">
              <template #cell="{ record }">
                <a-tag :color="getAiStatusColor(record.aiTitleStatus)" bordered>{{ getAiStatusText(record.aiTitleStatus) }}</a-tag>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </section>
    </main>

    <a-modal
      :visible="carouselPresetVisible"
      :mask-closable="false"
      :footer="false"
      modal-class="pod-miaoshou-operation-modal pod-carousel-preset-modal"
      @cancel="closeCarouselPreset"
    >
      <template #title>&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x4E3B;&#x56FE;/&#x8F6E;&#x64AD;&#x56FE;</template>
      <div class="pod-carousel-preset-body">
        <section class="pod-carousel-preset-panel">
          <div class="pod-carousel-preset-head">
            <div>
              <strong>&#x56FE;&#x7247;&#x6587;&#x4EF6;&#x5217;&#x8868;</strong>
              <span>&#x4ECE;&#x5DF2;&#x5BFC;&#x5165;&#x5546;&#x54C1;&#x7684;&#x8F6E;&#x64AD;&#x56FE;&#x4E2D;&#x9009;&#x62E9;</span>
            </div>
            <a-tag class="pod-carousel-count-tag" bordered>{{ carouselPresetCandidates.length }} &#x5F20;</a-tag>
          </div>
          <div class="pod-carousel-preset-toolbar">
            <a-button size="small" @click="clearCarouselPresetItems">&#x53D6;&#x6D88;&#x5168;&#x9009;</a-button>
            <a-button size="small" @click="selectAllCarouselPresetItems">&#x5168;&#x90E8;&#x52FE;&#x9009;</a-button>
            <span>{{ carouselPresetSelected.length }} / {{ carouselPresetCandidates.length }}</span>
          </div>
          <div class="pod-carousel-candidate-list">
            <label
              v-for="item in carouselPresetCandidates"
              :key="item.name"
              class="pod-carousel-candidate-item"
              :class="{ 'is-selected': isCarouselPresetSelected(item.name) }"
            >
              <a-checkbox :model-value="isCarouselPresetSelected(item.name)" @change="(checked) => toggleCarouselPresetItem(item.name, checked)" />
              <span class="pod-carousel-file-name" :title="item.name">{{ item.name }}</span>
              <span class="pod-carousel-file-count">{{ item.count }} &#x4E2A;&#x5546;&#x54C1;</span>
            </label>
            <a-empty v-if="!carouselPresetCandidates.length" class="pod-carousel-empty" description="&#x6682;&#x65E0;&#x8F6E;&#x64AD;&#x56FE;" />
          </div>
        </section>
        <section class="pod-carousel-preset-panel">
          <div class="pod-carousel-preset-head">
            <div>
              <strong>&#x9009;&#x4E2D;&#x8F6E;&#x64AD;&#x987A;&#x5E8F;</strong>
              <span>&#x786E;&#x8BA4;&#x540E;&#x4F1A;&#x6309;&#x6B64;&#x987A;&#x5E8F;&#x6392;&#x5230;&#x524D;&#x9762;</span>
            </div>
            <a-tag class="pod-carousel-count-tag" bordered>{{ carouselPresetSelected.length }} &#x5F20;</a-tag>
          </div>
          <div class="pod-carousel-selected-list">
            <div v-for="(name, index) in carouselPresetSelected" :key="name" class="pod-carousel-selected-item">
              <span class="pod-carousel-order-index">{{ index + 1 }}</span>
              <div class="pod-carousel-assigned-file">
                <span>&#x7B2C; {{ index + 1 }} &#x5F20;&#x5206;&#x914D;&#x56FE;&#x7247;</span>
                <a-tooltip :content="getCarouselPresetFileTip(name)">
                  <strong>{{ getCarouselPresetDisplayName(name) }}</strong>
                </a-tooltip>
              </div>
              <div class="pod-carousel-order-actions">
                <a-button size="mini" :disabled="index === 0" @click="moveCarouselPresetItem(index, -1)">&#x4E0A;&#x79FB;</a-button>
                <a-button size="mini" :disabled="index === carouselPresetSelected.length - 1" @click="moveCarouselPresetItem(index, 1)">&#x4E0B;&#x79FB;</a-button>
              </div>
            </div>
            <a-empty v-if="!carouselPresetSelected.length" class="pod-carousel-empty" description="&#x8BF7;&#x5728;&#x5DE6;&#x4FA7;&#x52FE;&#x9009;&#x56FE;&#x7247;" />
          </div>
        </section>
      </div>
      <div class="pod-modal-footer pod-carousel-preset-footer">
        <a-button @click="closeCarouselPreset">&#x53D6;&#x6D88;</a-button>
        <a-button class="pod-theme-button" type="primary" :disabled="!carouselPresetSelected.length" @click="applyCarouselPreset">&#x5E94;&#x7528;&#x9884;&#x8BBE;</a-button>
      </div>
    </a-modal>

    <a-modal
      :visible="randomCarouselVisible"
      :mask-closable="false"
      :footer="false"
      modal-class="pod-miaoshou-operation-modal pod-random-carousel-modal"
      @cancel="closeRandomCarouselPreset"
    >
      <template #title>&#x6279;&#x91CF;&#x968F;&#x673A;&#x4E3B;&#x56FE;</template>
      <div class="pod-random-carousel-body">
        <label class="pod-random-carousel-only-first">
          <a-checkbox v-model="randomCarouselOnlyFirst" />
          <span>&#x53EA;&#x6539;&#x9996;&#x56FE;</span>
        </label>
        <section class="pod-random-carousel-panel">
          <div class="pod-random-carousel-toolbar">
            <a-button size="small" @click="selectAllRandomCarouselItems">&#x5168;&#x9009;</a-button>
            <span>{{ randomCarouselCandidates.length }}</span>
          </div>
          <div class="pod-random-carousel-list">
            <label
              v-for="item in randomCarouselCandidates"
              :key="item.order"
              class="pod-random-carousel-item"
              :class="{ 'is-selected': isRandomCarouselSelected(item.order) }"
            >
              <a-checkbox :model-value="isRandomCarouselSelected(item.order)" @change="(checked) => toggleRandomCarouselItem(item.order, checked)" />
              <span class="pod-random-carousel-index">{{ item.order }}</span>
              <a-tooltip :content="getRandomCarouselItemTip(item)">
                <strong>{{ item.displayName }}</strong>
              </a-tooltip>
              <span class="pod-carousel-file-count">{{ item.count }} &#x4E2A;&#x5546;&#x54C1;</span>
            </label>
            <a-empty v-if="!randomCarouselCandidates.length" class="pod-carousel-empty" description="&#x6682;&#x65E0;&#x8F6E;&#x64AD;&#x56FE;" />
          </div>
        </section>
      </div>
      <div class="pod-modal-footer pod-random-carousel-footer">
        <a-button @click="closeRandomCarouselPreset">&#x53D6;&#x6D88;</a-button>
        <a-button class="pod-red-button" type="primary" :disabled="!randomCarouselSelected.length" @click="applyRandomCarouselPreset">&#x5E94;&#x7528;&#x968F;&#x673A;</a-button>
      </div>
    </a-modal>

    <a-modal
      :visible="descriptionPresetVisible"
      :mask-closable="false"
      :footer="false"
      modal-class="pod-miaoshou-operation-modal pod-carousel-preset-modal"
      @cancel="closeDescriptionPreset"
    >
      <template #title>&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x63CF;&#x8FF0;&#x56FE;</template>
      <div class="pod-carousel-preset-body">
        <section class="pod-carousel-preset-panel">
          <div class="pod-carousel-preset-head">
            <div>
              <strong>&#x56FE;&#x7247;&#x6587;&#x4EF6;&#x5217;&#x8868;</strong>
              <span>&#x4ECE;&#x8F6E;&#x64AD;&#x56FE;&#x4E2D;&#x9009;&#x62E9;&#x8981;&#x4F5C;&#x4E3A;&#x63CF;&#x8FF0;&#x56FE;&#x7684;&#x56FE;&#x7247;</span>
            </div>
            <a-tag class="pod-carousel-count-tag" bordered>{{ descriptionPresetCandidates.length }} &#x5F20;</a-tag>
          </div>
          <div class="pod-carousel-preset-toolbar">
            <a-button size="small" @click="clearDescriptionPresetItems">&#x53D6;&#x6D88;&#x5168;&#x9009;</a-button>
            <a-button size="small" @click="selectAllDescriptionPresetItems">&#x5168;&#x90E8;&#x52FE;&#x9009;</a-button>
            <span>{{ descriptionPresetSelected.length }} / {{ descriptionPresetCandidates.length }}</span>
          </div>
          <div class="pod-carousel-candidate-list">
            <label
              v-for="item in descriptionPresetCandidates"
              :key="item.name"
              class="pod-carousel-candidate-item"
              :class="{ 'is-selected': isDescriptionPresetSelected(item.name) }"
            >
              <a-checkbox :model-value="isDescriptionPresetSelected(item.name)" @change="(checked) => toggleDescriptionPresetItem(item.name, checked)" />
              <span class="pod-carousel-file-name" :title="item.name">{{ item.name }}</span>
              <span class="pod-carousel-file-count">{{ item.count }} &#x4E2A;&#x5546;&#x54C1;</span>
            </label>
            <a-empty v-if="!descriptionPresetCandidates.length" class="pod-carousel-empty" description="&#x6682;&#x65E0;&#x8F6E;&#x64AD;&#x56FE;" />
          </div>
        </section>
        <section class="pod-carousel-preset-panel">
          <div class="pod-carousel-preset-head">
            <div>
              <strong>&#x9009;&#x4E2D;&#x63CF;&#x8FF0;&#x56FE;&#x987A;&#x5E8F;</strong>
              <span>&#x786E;&#x8BA4;&#x540E;&#x4F1A;&#x6309;&#x6B64;&#x987A;&#x5E8F;&#x5199;&#x5165;&#x63CF;&#x8FF0;&#x56FE;</span>
            </div>
            <a-tag class="pod-carousel-count-tag" bordered>{{ descriptionPresetSelected.length }} &#x5F20;</a-tag>
          </div>
          <div class="pod-carousel-selected-list">
            <div v-for="(name, index) in descriptionPresetSelected" :key="name" class="pod-carousel-selected-item">
              <span class="pod-carousel-order-index">{{ index + 1 }}</span>
              <div class="pod-carousel-assigned-file">
                <span>&#x7B2C; {{ index + 1 }} &#x5F20;&#x63CF;&#x8FF0;&#x56FE;</span>
                <a-tooltip :content="getCarouselPresetFileTip(name)">
                  <strong>{{ getCarouselPresetDisplayName(name) }}</strong>
                </a-tooltip>
              </div>
              <div class="pod-carousel-order-actions">
                <a-button size="mini" :disabled="index === 0" @click="moveDescriptionPresetItem(index, -1)">&#x4E0A;&#x79FB;</a-button>
                <a-button size="mini" :disabled="index === descriptionPresetSelected.length - 1" @click="moveDescriptionPresetItem(index, 1)">&#x4E0B;&#x79FB;</a-button>
              </div>
            </div>
            <a-empty v-if="!descriptionPresetSelected.length" class="pod-carousel-empty" description="&#x8BF7;&#x5728;&#x5DE6;&#x4FA7;&#x52FE;&#x9009;&#x56FE;&#x7247;" />
          </div>
        </section>
      </div>
      <div class="pod-modal-footer pod-carousel-preset-footer">
        <a-button @click="closeDescriptionPreset">&#x53D6;&#x6D88;</a-button>
        <a-button class="pod-theme-button" type="primary" :disabled="!descriptionPresetSelected.length" @click="applyDescriptionPreset">&#x5E94;&#x7528;&#x9884;&#x8BBE;</a-button>
      </div>
    </a-modal>

    <a-modal
      :visible="aiTitleConfigVisible"
      :mask-closable="false"
      :esc-to-close="!aiTitleConfigSaving"
      :closable="!aiTitleConfigSaving"
      :footer="false"
      modal-class="pod-miaoshou-ai-config-modal"
      unmount-on-close
      @cancel="closeAiTitleConfigDialog"
    >
      <template #title>
        <div class="pod-modal-title">
          <span>AI CONFIG</span>
          <strong>AI&#x914D;&#x7F6E;</strong>
        </div>
      </template>
      <div class="pod-modal-body">
        <div class="pod-modal-grid">
          <div class="pod-field">
            <span class="pod-field-label">&#x6A21;&#x578B;&#x540D;&#x79F0;<a-tooltip content="&#x9009;&#x62E9;&#x6216;&#x8F93;&#x5165;&#x7528;&#x4E8E; AI &#x751F;&#x6210;&#x6807;&#x9898;&#x7684;&#x6A21;&#x578B;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
            <a-select v-model="aiTitleConfigForm.model" allow-create allow-search popup-container="body" :disabled="aiTitleConfigBusy" :options="aiTitleConfigModelOptions" />
          </div>
          <div class="pod-field">
            <span class="pod-field-label">API Base URL<a-tooltip content="AI &#x63A5;&#x53E3;&#x5730;&#x5740;&#xFF0C;&#x9700;&#x4E0E;&#x6A21;&#x578B;&#x548C; API KEY &#x5339;&#x914D;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
            <a-select v-model="aiTitleConfigForm.apiBaseUrl" allow-create allow-search popup-container="body" :disabled="aiTitleConfigBusy" :options="aiTitleConfigApiBaseOptions" />
          </div>
          <label class="pod-field">
            <span class="pod-field-label">&#x7EBF;&#x7A0B;&#x5E76;&#x53D1;&#x6570;<a-tooltip content="&#x540C;&#x65F6;&#x8BF7;&#x6C42; AI &#x7684;&#x6570;&#x91CF;&#xFF0C;&#x8FC7;&#x9AD8;&#x53EF;&#x80FD;&#x89E6;&#x53D1;&#x9650;&#x6D41;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
            <a-input-number v-model="aiTitleConfigForm.concurrency" :disabled="aiTitleConfigBusy" :min="aiTitleConfigMinConcurrency" :max="aiTitleConfigMaxConcurrency" mode="button" />
          </label>
        </div>
        <label class="pod-field">
          <span class="pod-field-label">API KEY<a-tooltip content="&#x53EF;&#x4EE5;&#x4E00;&#x884C;&#x586B;&#x4E00;&#x4E2A; API KEY&#xFF0C;&#x751F;&#x6210;&#x65F6;&#x4F1A;&#x6309;&#x914D;&#x7F6E;&#x4F7F;&#x7528;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span>
          <a-textarea v-model="aiTitleConfigForm.apiKeysText" :disabled="aiTitleConfigBusy" :auto-size="{ minRows: 8, maxRows: 12 }" />
        </label>
        <a-alert v-if="aiTitleConfigStatus.message" :type="resolveAiStatusType(aiTitleConfigStatus.tone)" show-icon>{{ aiTitleConfigStatus.message }}</a-alert>
      </div>
      <div class="pod-modal-footer">
        <a-button :disabled="aiTitleConfigSaving" @click="closeAiTitleConfigDialog">&#x53D6;&#x6D88;</a-button>
        <a-button class="pod-theme-button" type="primary" :loading="aiTitleConfigSaving" @click="saveAiTitleConfigDialog">{{ aiTitleConfigSaving ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58' }}</a-button>
      </div>
    </a-modal>

    <a-modal
      :visible="batchAiTitleVisible"
      :mask-closable="false"
      :esc-to-close="!batchAiTitleStarting"
      :closable="!batchAiTitleStarting"
      :footer="false"
      modal-class="pod-miaoshou-batch-ai-title-modal"
      unmount-on-close
      @cancel="closeBatchAiTitleDialog"
    >
      <template #title>
        <div class="pod-modal-title">
          <span>AI TITLE</span>
          <strong>&#x6279;&#x91CF;AI&#x751F;&#x6210;&#x6807;&#x9898;</strong>
        </div>
      </template>
      <div class="pod-modal-body">
        <div class="pod-summary-pills">
          <span>{{ batchAiTitleSummary.aiName || '\u706b\u5c71\u5f15\u64ce' }}</span>
          <span>{{ batchAiTitleSummary.storageName || '\u817e\u8baf COS' }}</span>
          <span>{{ batchAiTitleSummary.totalCount }} &#x4E2A;&#x5546;&#x54C1;</span>
        </div>
        <div class="pod-modal-grid">
          <div class="pod-field"><span class="pod-field-label">AI &#x5E73;&#x53F0;<a-tooltip content="&#x9009;&#x62E9;&#x6279;&#x91CF;&#x751F;&#x6210;&#x6807;&#x9898;&#x4F7F;&#x7528;&#x7684; AI &#x914D;&#x7F6E;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="batchAiTitleForm.aiProvider" popup-container="body" :disabled="batchAiTitleBusy" :options="batchAiTitleAiPlatformOptions" /></div>
          <div class="pod-field"><span class="pod-field-label">&#x5B58;&#x50A8;&#x7D20;&#x6750;<a-tooltip content="&#x9009;&#x62E9;&#x63D0;&#x4EA4;&#x7ED9; AI &#x8BC6;&#x56FE;&#x65F6;&#x4F7F;&#x7528;&#x7684;&#x7D20;&#x6750;&#x5B58;&#x50A8;&#x65B9;&#x5F0F;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="batchAiTitleForm.storageProvider" popup-container="body" :disabled="batchAiTitleBusy" :options="batchAiTitleStorageProviderOptions" /></div>
          <div class="pod-field"><span class="pod-field-label">&#x56FE;&#x7247;&#x538B;&#x7F29;<a-tooltip content="&#x63D0;&#x4EA4;&#x7ED9; AI &#x524D;&#x7684;&#x56FE;&#x7247;&#x5904;&#x7406;&#x65B9;&#x5F0F;&#xFF0C;&#x7528;&#x4E8E;&#x63A7;&#x5236;&#x4E0A;&#x4F20;&#x4F53;&#x79EF;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="batchAiTitleForm.imageCompression" popup-container="body" :disabled="batchAiTitleBusy" :options="batchAiTitleImageCompressionOptions" /></div>
          <label class="pod-field"><span class="pod-field-label">&#x7EBF;&#x7A0B;&#x5E76;&#x53D1;<a-tooltip content="&#x540C;&#x65F6;&#x751F;&#x6210;&#x6807;&#x9898;&#x7684;&#x4EFB;&#x52A1;&#x6570;&#xFF0C;&#x8FC7;&#x9AD8;&#x53EF;&#x80FD;&#x89E6;&#x53D1;&#x9650;&#x6D41;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-input-number v-model="batchAiTitleForm.concurrency" :disabled="batchAiTitleBusy" :min="batchAiTitleMinConcurrency" :max="batchAiTitleMaxConcurrency" mode="button" /></label>
          <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x957F;&#x5EA6;<a-tooltip content="AI &#x751F;&#x6210;&#x6807;&#x9898;&#x65F6;&#x5C3D;&#x91CF;&#x63A5;&#x8FD1;&#x7684;&#x76EE;&#x6807;&#x5B57;&#x6570;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-input-number v-model="batchAiTitleForm.targetLength" :disabled="batchAiTitleBusy" :min="batchAiTitleMinTargetLength" :max="batchAiTitleMaxTargetLength" mode="button" /></label>
          <div class="pod-field"><span class="pod-field-label">&#x8F93;&#x51FA;&#x8BED;&#x8A00;<a-tooltip content="&#x9009;&#x62E9;&#x6807;&#x9898;&#x6700;&#x7EC8;&#x8F93;&#x51FA;&#x7684;&#x8BED;&#x8A00;&#x3002;"><icon-question-circle class="pod-help-icon" /></a-tooltip></span><a-select v-model="batchAiTitleForm.outputLanguage" popup-container="body" :disabled="batchAiTitleBusy" :options="batchAiTitleOutputLanguageOptions" /></div>
        </div>
        <div class="pod-quality-row">
          <span>&#x56FE;&#x7247;&#x8D28;&#x91CF;</span>
          <a-slider v-model="batchAiTitleForm.imageQuality" :disabled="batchAiTitleBusy" :min="batchAiTitleMinImageQuality" :max="batchAiTitleMaxImageQuality" />
          <strong>{{ batchAiTitleForm.imageQuality }}</strong>
        </div>
        <div class="pod-modal-grid">
          <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x524D;&#x7F00;</span><a-input v-model="batchAiTitleForm.prefixText" allow-clear /></label>
          <label class="pod-field"><span class="pod-field-label">&#x6807;&#x9898;&#x540E;&#x7F00;</span><a-input v-model="batchAiTitleForm.suffixText" allow-clear /></label>
        </div>
        <label class="pod-field"><span class="pod-field-label">&#x9644;&#x52A0;&#x63D0;&#x793A;&#x8BCD;</span><a-textarea v-model="batchAiTitleForm.extraPrompt" :auto-size="{ minRows: 4, maxRows: 7 }" /></label>
        <a-checkbox v-model="batchAiTitleForm.useCache">&#x4F7F;&#x7528;&#x7F13;&#x5B58;</a-checkbox>
        <a-alert v-if="batchAiTitleStatus.message || batchAiTitleSummary.warning" :type="resolveAiStatusType(batchAiTitleStatus.tone || (batchAiTitleSummary.warning ? 'warning' : ''))" show-icon>{{ batchAiTitleStatus.message || batchAiTitleSummary.warning }}</a-alert>
      </div>
      <div class="pod-modal-footer">
        <a-button :disabled="batchAiTitleStarting" @click="closeBatchAiTitleDialog">&#x53D6;&#x6D88;</a-button>
        <a-button class="pod-danger-button" :disabled="batchAiTitleBusy || !batchAiTitleSummary.retryCount" @click="startBatchAiTitleDialogGeneration(true)">&#x91CD;&#x8BD5;&#x5931;&#x8D25;</a-button>
        <a-button class="pod-theme-button" type="primary" :loading="batchAiTitleStarting" @click="startBatchAiTitleDialogGeneration(false)">&#x6279;&#x91CF;&#x5F00;&#x59CB;&#x6807;&#x9898;&#x751F;&#x6210;</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';
import { useAiTitleConfigDialog } from './useAiTitleConfigDialog.js';
import { useBatchAiTitleDialog } from './useBatchAiTitleDialog.js';

const DEFAULT_PRODUCT_FIELDS = Object.freeze({
  templateId: 'non-fashion',
  category: '',
  localName: '',
  mainNumber: '',
  delivery: '2',
  origin: '\u4e2d\u56fd',
  isCustom: '\u5426',
  sourceFolder: '',
  sourceLink: '',
  description: '',
  descriptionImageOrders: '',
  title: '',
  englishTitle: '',
  specNameOne: '',
  specValueOne: '',
  specNameTwo: '',
  specValueTwo: '',
  declaredPrice: '',
  price: '',
  stock: '',
  platformSku: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  packingList: '',
  packingCount: '',
  codeType: '',
  codeValue: '',
  codeValueDerivedFromSource: false,
  mainVideo: '',
  manual: ''
});

const templateTypeOptions = Object.freeze([
  { value: 'non-fashion', label: '\u975e\u670d\u9970\u7c7b\u6a21\u677f' },
  { value: 'fashion', label: '\u670d\u9970\u7c7b\u6a21\u677f' }
]);
const deliveryOptions = Object.freeze(['1', '2', '9'].map((value) => ({ value, label: value })));
const customOptions = Object.freeze(['\u662f', '\u5426'].map((value) => ({ value, label: value })));
const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
const TITLE_MAX_LENGTH = 255;
const SKU_CONFIG_FIELDS = Object.freeze([
  'declaredPrice',
  'price',
  'length',
  'width',
  'height',
  'weight',
  'stock',
  'skuImage',
  'platformSku',
  'skuCategoryType',
  'skuCategoryCount',
  'skuCategoryUnit',
  'independentPackaging'
]);

const VIEW_BRIDGE_KEY = 'podUploadSheetMiaoshouViewBridge';
const products = ref([]);
const activeProductId = ref('');
const categories = ref([]);
const formTemplates = ref([]);
const selectedTemplateId = ref('');
const templateName = ref('');
const lastImportDirectoryPath = ref('');
const viewportHeight = ref(typeof window === 'undefined' ? 760 : window.innerHeight);
const importingProducts = ref(false);
const loadingCategories = ref(false);
const loadingTemplates = ref(false);
const savingTemplate = ref(false);
const deletingTemplate = ref(false);
const uploadingImages = ref(false);
const exportingTable = ref(false);
const generatingAiTitles = ref(false);
const uploadProgress = reactive({ total: 0, success: 0, uploaded: 0, cached: 0, failed: 0, canceled: 0 });
const aiProgress = reactive({ total: 0, completed: 0, success: 0, failed: 0, canceled: 0 });
const carouselPresetVisible = ref(false);
const carouselPresetText = ref('');
const carouselPresetSelected = ref([]);
const randomCarouselVisible = ref(false);
const randomCarouselOnlyFirst = ref(false);
const randomCarouselSelected = ref([]);
const descriptionPresetVisible = ref(false);
const descriptionPresetText = ref('');
const descriptionPresetSelected = ref([]);
let cleanupAiTitleConfigBridge = null;
let cleanupBatchAiTitleBridge = null;
let removeAiTitleProgressListener = null;

const globalForm = reactive({
  templateId: 'non-fashion',
  category: '',
  delivery: '2',
  origin: '\u4e2d\u56fd',
  isCustom: '\u5426',
  sourceLink: '',
  specNameOne: '',
  specValueOne: '',
  specNameTwo: '',
  specValueTwo: '',
  description: ''
});
const skuDefaults = reactive({
  declaredPrice: '',
  price: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  stock: '',
  platformSku: ''
});
const skuConfigMap = reactive({});

const aiTitleConfigDialog = useAiTitleConfigDialog();
const aiTitleConfigVisible = aiTitleConfigDialog.visible;
const aiTitleConfigSaving = aiTitleConfigDialog.saving;
const aiTitleConfigBusy = aiTitleConfigDialog.busy;
const aiTitleConfigForm = aiTitleConfigDialog.form;
const aiTitleConfigStatus = aiTitleConfigDialog.status;
const aiTitleConfigModelOptions = aiTitleConfigDialog.modelOptions;
const aiTitleConfigApiBaseOptions = aiTitleConfigDialog.apiBaseOptions;
const aiTitleConfigMinConcurrency = aiTitleConfigDialog.minConcurrency;
const aiTitleConfigMaxConcurrency = aiTitleConfigDialog.maxConcurrency;
const closeAiTitleConfigDialog = aiTitleConfigDialog.closeDialog;
const saveAiTitleConfigDialog = aiTitleConfigDialog.saveDialog;

const batchAiTitleDialog = useBatchAiTitleDialog();
const batchAiTitleVisible = batchAiTitleDialog.visible;
const batchAiTitleStarting = batchAiTitleDialog.starting;
const batchAiTitleBusy = batchAiTitleDialog.busy;
const batchAiTitleForm = batchAiTitleDialog.form;
const batchAiTitleSummary = batchAiTitleDialog.summary;
const batchAiTitleStatus = batchAiTitleDialog.status;
const batchAiTitleAiPlatformOptions = batchAiTitleDialog.aiPlatformOptions;
const batchAiTitleStorageProviderOptions = batchAiTitleDialog.storageProviderOptions;
const batchAiTitleImageCompressionOptions = batchAiTitleDialog.imageCompressionOptions;
const batchAiTitleOutputLanguageOptions = batchAiTitleDialog.outputLanguageOptions;
const batchAiTitleMinConcurrency = batchAiTitleDialog.minConcurrency;
const batchAiTitleMaxConcurrency = batchAiTitleDialog.maxConcurrency;
const batchAiTitleMinTargetLength = batchAiTitleDialog.minTargetLength;
const batchAiTitleMaxTargetLength = batchAiTitleDialog.maxTargetLength;
const batchAiTitleMinImageQuality = batchAiTitleDialog.minImageQuality;
const batchAiTitleMaxImageQuality = batchAiTitleDialog.maxImageQuality;
const closeBatchAiTitleDialog = batchAiTitleDialog.closeDialog;
const startBatchAiTitleDialogGeneration = batchAiTitleDialog.startGeneration;

const featureBridge = computed(() => window.temuApp && window.temuApp.featureCenter ? window.temuApp.featureCenter : null);
const categorySelectOptions = computed(() => categories.value.map((item) => ({ value: item.id, label: item.label ? `${item.id} - ${item.label}` : item.id })));
const formTemplateOptions = computed(() => formTemplates.value.map((item) => ({ value: item.id, label: item.name })));
const activeProduct = computed(() => products.value.find((item) => item.id === activeProductId.value) || products.value[0] || null);
const skuRows = computed(() => buildSkuRows());
const carouselPresetCandidates = computed(() => {
  const itemMap = new Map();
  products.value.forEach((product) => {
    const carousel = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
    carousel.forEach((item) => {
      const name = normalizeText(item);
      if (!name) return;
      const existing = itemMap.get(name);
      if (existing) {
        existing.count += 1;
      } else {
        itemMap.set(name, { name, count: 1 });
      }
    });
  });
  return Array.from(itemMap.values());
});
const descriptionPresetCandidates = computed(() => {
  const itemMap = new Map();
  products.value.forEach((product) => {
    getMaterialImportOrderItems(product, 'carousel').forEach((item) => {
      const name = normalizeText(item);
      if (!name) return;
      const existing = itemMap.get(name);
      if (existing) {
        existing.count += 1;
      } else {
        itemMap.set(name, { name, count: 1 });
      }
    });
  });
  return Array.from(itemMap.values());
});
const randomCarouselCandidates = computed(() => {
  const maxCount = products.value.reduce((count, product) => {
    const carousel = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
    return Math.max(count, carousel.length);
  }, 0);
  return Array.from({ length: maxCount }, (_, index) => {
    const order = index + 1;
    const names = [];
    let count = 0;
    products.value.forEach((product) => {
      const carousel = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
      const item = carousel[index];
      if (!item) return;
      count += 1;
      const displayName = getMaterialDisplayName(product, 'carousel', item);
      if (displayName && !names.includes(displayName)) names.push(displayName);
    });
    return {
      order,
      count,
      displayName: names[0] || `#${order}`,
      names
    };
  }).filter((item) => item.count > 0);
});
const skuTableScroll = computed(() => {
  const rowCount = skuRows.value.length;
  const scroll = { x: 1680 };
  if (rowCount > 8) scroll.y = 8 * 48;
  return scroll;
});
const skuImageOptions = computed(() => {
  const product = activeProduct.value;
  const items = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
  return items.map((item, index) => ({ value: String(index + 1), label: `\u7b2c${index + 1}\u5f20 ${normalizeText(item)}` }));
});
const aiTitleEligibleCount = computed(() => products.value.filter((item) => getPrimaryProductImage(item)).length);
const aiTitleRetryCount = computed(() => products.value.filter((item) => item.aiTitleStatus === 'failed' && getPrimaryProductImage(item)).length);
const listPanelRef = ref(null);
const listHeadRef = ref(null);
const progressLineRef = ref(null);
const productTableBodyHeight = ref(220);
let productTableHeightRaf = 0;
let listPanelResizeObserver = null;
const productTableScroll = computed(() => ({ x: 1280, y: productTableBodyHeight.value }));
const uploadProgressText = computed(() => {
  if (!uploadProgress.total) return '';
  return `\u56fe\u7247\u4e0a\u4f20\uff1a${uploadProgress.success}/${uploadProgress.total}\uff0c\u65b0\u4f20 ${uploadProgress.uploaded}\uff0c\u7f13\u5b58 ${uploadProgress.cached}\uff0c\u5931\u8d25 ${uploadProgress.failed}`;
});
const aiTitleProgressText = computed(() => {
  if (!generatingAiTitles.value || !aiProgress.total) return '';
  return `AI\u6807\u9898\uff1a${aiProgress.completed}/${aiProgress.total}\uff0c\u6210\u529f ${aiProgress.success}\uff0c\u5931\u8d25 ${aiProgress.failed}`;
});

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitLines(value) {
  return String(value || '').replace(/\r\n/g, '\n').split('\n').map((item) => normalizeText(item)).filter(Boolean);
}

function getFileBaseName(fileName) {
  return normalizeText(fileName).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
}

function getFileNameWithExtension(fileName) {
  return normalizeText(fileName).replace(/^.*[\\/]/, '');
}

function getMaterialNameKey(value) {
  const base = getFileBaseName(value);
  const segments = base.split(/[\s._-]+/).filter(Boolean);
  const suffix = segments.length > 1 ? segments[segments.length - 1] : '';
  return (/^\d{1,3}$/.test(suffix) ? suffix : base).toLowerCase();
}

function normalizeMaterialName(file, context = {}) {
  const name = normalizeText(file && file.name);
  const base = getFileBaseName(name);
  const productKey = normalizeText(context.productKey);
  if (productKey && base.toLowerCase().startsWith(productKey.toLowerCase())) {
    return normalizeText(base.slice(productKey.length).replace(/^[\s._-]+/, '')) || name;
  }
  return name;
}

function createEmptyPathMap() {
  return { carousel: {}, assets: {}, preview: {} };
}

function createEmptyImportOrderMap() {
  return { carousel: [], assets: [], preview: [] };
}

function createImportOrderMap(materials = {}, source = {}) {
  return ['carousel', 'assets', 'preview'].reduce((result, sectionId) => {
    const items = source && Array.isArray(source[sectionId]) ? source[sectionId] : materials[sectionId];
    result[sectionId] = Array.isArray(items) ? items.map((item) => normalizeText(item)).filter(Boolean) : [];
    return result;
  }, createEmptyImportOrderMap());
}

function getMaterialImportOrderItems(product, sectionId) {
  const source = product && product.materialImportOrderMap && Array.isArray(product.materialImportOrderMap[sectionId]) ? product.materialImportOrderMap[sectionId] : null;
  if (source) return source;
  return product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
}

function createSkuEntry(source = {}) {
  return SKU_CONFIG_FIELDS.reduce((entry, fieldName) => {
    entry[fieldName] = normalizeText(source[fieldName]);
    return entry;
  }, {});
}

function cloneSkuMap(source = {}) {
  return Object.entries(source && typeof source === 'object' ? source : {}).reduce((result, [key, value]) => {
    const normalizedKey = normalizeText(key);
    if (normalizedKey && normalizedKey !== 'defaults') result[normalizedKey] = createSkuEntry(value || {});
    return result;
  }, {});
}

function getSkuValues(value) {
  return splitLines(value);
}

function buildSkuKey(left, right) {
  return `${normalizeText(left)}${SKU_ROW_KEY_SEPARATOR}${normalizeText(right)}`;
}

function mergeSkuDefaults(entry) {
  const result = createSkuEntry(entry);
  Object.entries(skuDefaults).forEach(([fieldName, value]) => {
    if (!normalizeText(result[fieldName])) result[fieldName] = normalizeText(value);
  });
  return result;
}

function buildSkuRows() {
  const leftItems = getSkuValues(globalForm.specValueOne);
  const rightItems = getSkuValues(globalForm.specValueTwo);
  const left = leftItems.length ? leftItems : [''];
  const right = rightItems.length ? rightItems : [''];
  const rows = [];

  left.forEach((leftValue) => {
    right.forEach((rightValue) => {
      const key = buildSkuKey(leftValue, rightValue);
      if (!skuConfigMap[key]) skuConfigMap[key] = mergeSkuDefaults();
      rows.push({ key, specValueOne: leftValue, specValueTwo: rightValue, ...skuConfigMap[key] });
    });
  });

  return rows;
}

function pruneSkuConfigMap() {
  const validKeys = new Set(buildSkuRows().map((row) => row.key));
  Object.keys(skuConfigMap).forEach((key) => {
    if (!validKeys.has(key)) delete skuConfigMap[key];
  });
}

function createProduct(overrides = {}) {
  const materials = overrides.materials && typeof overrides.materials === 'object' ? overrides.materials : {};
  const materialImportOrderMap = createImportOrderMap(materials, overrides.materialImportOrderMap);
  return {
    id: normalizeText(overrides.id) || createId('pod-product'),
    ...DEFAULT_PRODUCT_FIELDS,
    ...overrides,
    materials: {
      carousel: Array.isArray(materials.carousel) ? materials.carousel.slice() : [],
      assets: Array.isArray(materials.assets) ? materials.assets.slice() : [],
      preview: Array.isArray(materials.preview) ? materials.preview.slice() : []
    },
    materialPathMap: {
      ...createEmptyPathMap(),
      ...(overrides.materialPathMap && typeof overrides.materialPathMap === 'object' ? overrides.materialPathMap : {})
    },
    materialImportOrderMap,
    skuConfigMap: cloneSkuMap(overrides.skuConfigMap),
    aiTitleStatus: normalizeText(overrides.aiTitleStatus),
    aiTitleError: normalizeText(overrides.aiTitleError),
    aiTitlePatternSummary: normalizeText(overrides.aiTitlePatternSummary),
    aiTitleUpdatedAt: normalizeText(overrides.aiTitleUpdatedAt)
  };
}

function getImportedProductGroup(file) {
  const segments = normalizeText(file && file.webkitRelativePath).split('/').filter(Boolean);
  if (segments.length >= 3) return { productKey: segments[1], sourceFolder: `${segments[0]}/${segments[1]}` };
  if (segments.length === 2) return { productKey: segments[0], sourceFolder: segments[0] };
  return { productKey: '\u6839\u76ee\u5f55\u5546\u54c1', sourceFolder: '' };
}

function classifySection(fileName, relativePath) {
  const text = `${fileName} ${relativePath || ''}`.toLowerCase();
  if (/(preview|mockup)/.test(text)) return 'preview';
  if (/(detail|asset|size)/.test(text)) return 'assets';
  return 'carousel';
}

function buildProductsFromFiles(files) {
  const groups = new Map();
  (Array.isArray(files) ? files : []).forEach((file) => {
    const groupInfo = getImportedProductGroup(file);
    const groupKey = `${groupInfo.sourceFolder}__${groupInfo.productKey}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { localName: groupInfo.productKey, sourceFolder: groupInfo.sourceFolder, materials: { carousel: [], assets: [], preview: [] }, materialPathMap: createEmptyPathMap(), materialImportOrderMap: createEmptyImportOrderMap() });
    }
    const group = groups.get(groupKey);
    const section = classifySection(file.name, file.webkitRelativePath);
    const name = normalizeMaterialName(file, groupInfo) || file.name;
    const key = getMaterialNameKey(name);
    group.materials[section].push(name);
    group.materialImportOrderMap[section].push(name);
    if (key && file.path) group.materialPathMap[section][key] = file.path;
  });
  return Array.from(groups.values()).map((group) => createProduct({ ...group, ...globalForm, ...skuDefaults, skuConfigMap: cloneSkuMap(skuConfigMap) }));
}

function syncGlobalToProducts() {
  products.value = products.value.map((product) => ({
    ...product,
    ...globalForm,
    skuConfigMap: cloneSkuMap(skuConfigMap)
  }));
  scheduleStateSave();
}

function handleSkuSpecChange() {
  pruneSkuConfigMap();
  syncGlobalToProducts();
}

function handleSkuDefaultsChange() {
  buildSkuRows();
  Object.keys(skuConfigMap).forEach((key) => {
    skuConfigMap[key] = mergeSkuDefaults(skuConfigMap[key]);
  });
  syncSkuConfigToProducts();
}

function syncSkuConfigToProducts() {
  products.value = products.value.map((product) => ({
    ...product,
    skuConfigMap: cloneSkuMap(skuConfigMap)
  }));
  scheduleStateSave();
}

function getPrimaryProductImage(product) {
  const item = product && product.materials && product.materials.carousel && product.materials.carousel[0];
  if (!item) return null;
  const key = getMaterialNameKey(item);
  const path = product.materialPathMap && product.materialPathMap.carousel ? product.materialPathMap.carousel[key] : '';
  return { name: item, path };
}

function getMaterialTitle(product, sectionId) {
  const items = product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
  return items.map((item) => getMaterialDisplayName(product, sectionId, item)).join('\n');
}

function getPreviewItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 3);
}

function getExtraItemCount(items) {
  const count = Array.isArray(items) ? items.length : 0;
  return count > 3 ? count - 3 : 0;
}

function getMaterialDisplayName(product, sectionId, item) {
  const name = normalizeText(item);
  const key = getMaterialNameKey(name);
  const pathMap = product && product.materialPathMap && product.materialPathMap[sectionId] && typeof product.materialPathMap[sectionId] === 'object' ? product.materialPathMap[sectionId] : {};
  return getFileNameWithExtension((key && pathMap[key]) || name);
}

function getDescriptionImageItems(product) {
  const carouselItems = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
  return splitLines(String(product && product.descriptionImageOrders || '').replace(/[,\uff0c]/g, '\n'))
    .map((orderText) => Number.parseInt(orderText, 10))
    .filter((orderNumber) => orderNumber > 0 && carouselItems[orderNumber - 1])
    .map((orderNumber) => carouselItems[orderNumber - 1]);
}

function getDescriptionImageTitle(product) {
  return getDescriptionImageItems(product).map((item) => getMaterialDisplayName(product, 'carousel', item)).join('\n');
}

function selectProduct(record) {
  activeProductId.value = record && record.id ? record.id : '';
}

function getProductRowClass(record) {
  return record && activeProductId.value === record.id ? 'is-active' : '';
}

function getTextLength(value) {
  return String(value === undefined || value === null ? '' : value).length;
}

function handleProductTitleChange(record, fieldName) {
  if (!record || !fieldName) return;
  const value = String(record[fieldName] === undefined || record[fieldName] === null ? '' : record[fieldName]);
  if (value.length > TITLE_MAX_LENGTH) record[fieldName] = value.slice(0, TITLE_MAX_LENGTH);
  scheduleStateSave();
}

function getAiStatusText(status) {
  if (status === 'success') return '\u6210\u529f';
  if (status === 'failed') return '\u5931\u8d25';
  if (status === 'processing') return '\u5904\u7406\u4e2d';
  if (status === 'canceled') return '\u5df2\u505c\u6b62';
  return '\u672a\u751f\u6210';
}

function getAiStatusColor(status) {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'processing') return 'arcoblue';
  return 'gray';
}

function resolveAiStatusType(tone) {
  if (tone === 'danger') return 'error';
  if (tone === 'warning') return 'warning';
  return 'info';
}

async function importProducts() {
  if (!featureBridge.value || typeof featureBridge.value.selectPodUploadSheetMiaoshouImportDirectory !== 'function') return;
  importingProducts.value = true;
  try {
    const result = await featureBridge.value.selectPodUploadSheetMiaoshouImportDirectory({ defaultPath: lastImportDirectoryPath.value });
    if (!result || result.canceled) return;
    const nextProducts = buildProductsFromFiles(result.files || []);
    if (!nextProducts.length) {
      Message.warning('\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u5bfc\u5165\u7684\u672c\u5730\u5546\u54c1\u56fe\u7247');
      return;
    }
    products.value.push(...nextProducts);
    activeProductId.value = nextProducts[0].id;
    lastImportDirectoryPath.value = normalizeText(result.directoryPath) || lastImportDirectoryPath.value;
    Message.success(`\u5df2\u5bfc\u5165 ${nextProducts.length} \u4e2a\u5546\u54c1`);
    scheduleStateSave();
  } catch (error) {
    Message.error('\u5bfc\u5165\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    importingProducts.value = false;
  }
}

function clearProducts() {
  Modal.warning({
    title: '\u6e05\u7a7a\u5546\u54c1\u5217\u8868',
    content: '\u786e\u8ba4\u6e05\u7a7a\u5f53\u524d\u5546\u54c1\u6570\u636e\uff1f',
    hideCancel: false,
    onOk() {
      products.value = [];
      activeProductId.value = '';
      scheduleStateSave();
    }
  });
}

function openCarouselPreset() {
  const candidateNames = carouselPresetCandidates.value.map((item) => item.name);
  const savedSelection = splitLines(carouselPresetText.value).filter((item) => candidateNames.includes(item));
  const firstProductSelection = products.value[0] && products.value[0].materials ? products.value[0].materials.carousel.map((item) => normalizeText(item)).filter(Boolean) : [];
  carouselPresetSelected.value = savedSelection.length ? savedSelection : firstProductSelection.filter((item) => candidateNames.includes(item));
  carouselPresetVisible.value = true;
}

function closeCarouselPreset() {
  carouselPresetVisible.value = false;
}

function getCarouselPresetFileNames(name) {
  const selectedName = normalizeText(name);
  const selectedKey = getMaterialNameKey(selectedName);
  const fileNames = [];
  products.value.forEach((product) => {
    const carousel = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
    if (!carousel.includes(selectedName)) return;
    const pathMap = product.materialPathMap && product.materialPathMap.carousel && typeof product.materialPathMap.carousel === 'object' ? product.materialPathMap.carousel : {};
    const filePath = selectedKey ? normalizeText(pathMap[selectedKey]) : '';
    const fileName = getFileNameWithExtension(filePath || selectedName);
    if (fileName && !fileNames.includes(fileName)) fileNames.push(fileName);
  });
  return fileNames;
}

function getCarouselPresetDisplayName(name) {
  const fileNames = getCarouselPresetFileNames(name);
  const firstName = fileNames[0] || normalizeText(name);
  if (fileNames.length > 1) return `${firstName} +${fileNames.length - 1}`;
  return firstName;
}

function getCarouselPresetFileTip(name) {
  const fileNames = getCarouselPresetFileNames(name);
  if (!fileNames.length) return normalizeText(name);
  return fileNames.join('\n');
}

function isCarouselPresetSelected(name) {
  return carouselPresetSelected.value.includes(normalizeText(name));
}

function toggleCarouselPresetItem(name, checked) {
  const nextName = normalizeText(name);
  if (!nextName) return;
  const nextItems = carouselPresetSelected.value.filter((item) => item !== nextName);
  carouselPresetSelected.value = checked ? [...nextItems, nextName] : nextItems;
}

function selectAllCarouselPresetItems() {
  carouselPresetSelected.value = carouselPresetCandidates.value.map((item) => item.name);
}

function clearCarouselPresetItems() {
  carouselPresetSelected.value = [];
}

function moveCarouselPresetItem(index, offset) {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= carouselPresetSelected.value.length) return;
  const nextItems = carouselPresetSelected.value.slice();
  const current = nextItems[index];
  nextItems[index] = nextItems[targetIndex];
  nextItems[targetIndex] = current;
  carouselPresetSelected.value = nextItems;
}

function applyCarouselPreset() {
  const values = carouselPresetSelected.value.map((item) => normalizeText(item)).filter(Boolean);
  if (!values.length) {
    Message.warning('\u8bf7\u5148\u9009\u62e9\u8f6e\u64ad\u56fe');
    return;
  }
  products.value = products.value.map((product) => ({
    ...product,
    materials: {
      ...product.materials,
      carousel: [
        ...values.filter((item) => product.materials.carousel.includes(item)),
        ...product.materials.carousel.filter((item) => !values.includes(item))
      ]
    }
  }));
  carouselPresetText.value = values.join('\n');
  carouselPresetVisible.value = false;
  scheduleStateSave();
  Message.success('\u5df2\u5e94\u7528\u8f6e\u64ad\u56fe\u9884\u8bbe');
}

function openRandomCarouselPreset() {
  randomCarouselSelected.value = randomCarouselCandidates.value.map((item) => item.order);
  randomCarouselVisible.value = true;
}

function closeRandomCarouselPreset() {
  randomCarouselVisible.value = false;
}

function isRandomCarouselSelected(order) {
  return randomCarouselSelected.value.includes(Number(order));
}

function toggleRandomCarouselItem(order, checked) {
  const nextOrder = Number(order);
  if (!Number.isFinite(nextOrder) || nextOrder < 1) return;
  const nextItems = randomCarouselSelected.value.filter((item) => item !== nextOrder);
  randomCarouselSelected.value = checked ? [...nextItems, nextOrder].sort((left, right) => left - right) : nextItems;
}

function selectAllRandomCarouselItems() {
  randomCarouselSelected.value = randomCarouselCandidates.value.map((item) => item.order);
}

function getRandomCarouselItemTip(item) {
  const names = item && Array.isArray(item.names) ? item.names : [];
  return names.length ? names.join('\n') : normalizeText(item && item.displayName);
}

function shuffleItems(items) {
  const nextItems = items.slice();
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    const current = nextItems[index];
    nextItems[index] = nextItems[targetIndex];
    nextItems[targetIndex] = current;
  }
  return nextItems;
}

function applyRandomCarouselPreset() {
  const selectedOrders = randomCarouselSelected.value.map((item) => Number(item)).filter((item) => item > 0);
  if (!selectedOrders.length) {
    Message.warning('\u8bf7\u5148\u9009\u62e9\u9700\u8981\u968f\u673a\u7684\u56fe\u7247');
    return;
  }
  products.value = products.value.map((product) => {
    const carousel = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
    const availableOrders = selectedOrders.filter((order) => carousel[order - 1]);
    if (!availableOrders.length) return product;
    const nextCarousel = carousel.slice();
    if (randomCarouselOnlyFirst.value) {
      const targetOrder = availableOrders[Math.floor(Math.random() * availableOrders.length)];
      const targetIndex = targetOrder - 1;
      const currentFirst = nextCarousel[0];
      nextCarousel[0] = nextCarousel[targetIndex];
      nextCarousel[targetIndex] = currentFirst;
    } else {
      const shuffledItems = shuffleItems(availableOrders.map((order) => nextCarousel[order - 1]));
      availableOrders.forEach((order, index) => {
        nextCarousel[order - 1] = shuffledItems[index];
      });
    }
    return { ...product, materials: { ...product.materials, carousel: nextCarousel } };
  });
  randomCarouselVisible.value = false;
  scheduleStateSave();
  Message.success('\u5df2\u6279\u91cf\u968f\u673a\u8c03\u6574\u8f6e\u64ad\u56fe');
}

function openDescriptionPreset() {
  const candidateNames = descriptionPresetCandidates.value.map((item) => item.name);
  const savedSelection = splitLines(descriptionPresetText.value).filter((item) => candidateNames.includes(item));
  const activeSelection = activeProduct.value ? getDescriptionImageItems(activeProduct.value).map((item) => normalizeText(item)).filter(Boolean) : [];
  descriptionPresetSelected.value = sortDescriptionSelectionByImportOrder(savedSelection.length ? savedSelection : activeSelection.filter((item) => candidateNames.includes(item)));
  descriptionPresetVisible.value = true;
}

function closeDescriptionPreset() {
  descriptionPresetVisible.value = false;
}

function isDescriptionPresetSelected(name) {
  return descriptionPresetSelected.value.includes(normalizeText(name));
}

function toggleDescriptionPresetItem(name, checked) {
  const nextName = normalizeText(name);
  if (!nextName) return;
  const nextItems = descriptionPresetSelected.value.filter((item) => item !== nextName);
  descriptionPresetSelected.value = sortDescriptionSelectionByImportOrder(checked ? [...nextItems, nextName] : nextItems);
}

function selectAllDescriptionPresetItems() {
  descriptionPresetSelected.value = descriptionPresetCandidates.value.map((item) => item.name);
}

function clearDescriptionPresetItems() {
  descriptionPresetSelected.value = [];
}

function sortDescriptionSelectionByImportOrder(items) {
  const selectedSet = new Set((Array.isArray(items) ? items : []).map((item) => normalizeText(item)).filter(Boolean));
  return descriptionPresetCandidates.value.map((item) => item.name).filter((name) => selectedSet.has(name));
}

function moveDescriptionPresetItem(index, offset) {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= descriptionPresetSelected.value.length) return;
  const nextItems = descriptionPresetSelected.value.slice();
  const current = nextItems[index];
  nextItems[index] = nextItems[targetIndex];
  nextItems[targetIndex] = current;
  descriptionPresetSelected.value = nextItems;
}

function applyDescriptionPreset() {
  const values = descriptionPresetSelected.value.map((item) => normalizeText(item)).filter(Boolean);
  if (!values.length) {
    Message.warning('\u8bf7\u5148\u9009\u62e9\u63cf\u8ff0\u56fe');
    return;
  }
  products.value = products.value.map((product) => {
    const carousel = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
    const orders = values
      .map((item) => carousel.indexOf(item))
      .filter((index) => index >= 0)
      .map((index) => String(index + 1));
    return { ...product, descriptionImageOrders: orders.join(',') };
  });
  descriptionPresetText.value = values.join('\n');
  descriptionPresetVisible.value = false;
  scheduleStateSave();
  Message.success('\u5df2\u5e94\u7528\u63cf\u8ff0\u56fe\u9884\u8bbe');
}

async function uploadImages() {
  if (!featureBridge.value || uploadingImages.value) return;
  uploadingImages.value = true;
  Object.assign(uploadProgress, { total: 0, success: 0, uploaded: 0, cached: 0, failed: 0, canceled: 0 });
  try {
    const result = await featureBridge.value.uploadPodUploadSheetMiaoshouCosImages({
      runId: createId('pod-cos'),
      products: products.value,
      imageUploadMode: 'original'
    });
    const items = Array.isArray(result && result.items) ? result.items : [];
    const urlByPath = new Map(items.filter((item) => item && item.status === 'success' && item.url).map((item) => [normalizeText(item.filePath), normalizeText(item.url)]));
    products.value = products.value.map((product) => {
      const nextProduct = createProduct(product);
      ['carousel', 'assets', 'preview'].forEach((sectionId) => {
        nextProduct.materials[sectionId] = nextProduct.materials[sectionId].map((name) => {
          const key = getMaterialNameKey(name);
          const path = nextProduct.materialPathMap[sectionId][key];
          return urlByPath.get(path) || name;
        });
      });
      return nextProduct;
    });
    Object.assign(uploadProgress, {
      total: Number(result && result.totalCount) || items.length,
      success: Number(result && result.successCount) || 0,
      uploaded: Number(result && result.uploadedCount) || 0,
      cached: Number(result && result.cachedCount) || 0,
      failed: Number(result && result.failedCount) || 0,
      canceled: Number(result && result.canceledCount) || 0
    });
    Message.success('\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210');
    scheduleStateSave();
  } catch (error) {
    Message.error('\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    uploadingImages.value = false;
  }
}

function getBatchAiTitleSnapshot() {
  return {
    totalCount: aiTitleEligibleCount.value,
    retryCount: aiTitleRetryCount.value,
    prefixText: '',
    suffixText: '',
    extraPrompt: '',
    targetLength: '250',
    outputLanguage: 'en'
  };
}

function openBatchAiTitleDialog() {
  return batchAiTitleDialog.openDialog(getBatchAiTitleSnapshot());
}

async function executeBatchAiTitleGeneration(options = {}) {
  if (!featureBridge.value || generatingAiTitles.value) return;
  const retryFailedOnly = options && options.retryFailedOnly === true;
  const targetProducts = products.value.filter((product) => {
    if (retryFailedOnly && product.aiTitleStatus !== 'failed') return false;
    return Boolean(getPrimaryProductImage(product));
  });
  if (!targetProducts.length) {
    Message.warning('\u6ca1\u6709\u53ef\u751f\u6210\u6807\u9898\u7684\u5546\u54c1');
    return;
  }
  generatingAiTitles.value = true;
  Object.assign(aiProgress, { total: targetProducts.length, completed: 0, success: 0, failed: 0, canceled: 0 });
  products.value.forEach((product) => {
    if (targetProducts.some((item) => item.id === product.id)) product.aiTitleStatus = 'processing';
  });
  try {
    const runId = createId('pod-ai-title');
    const result = await featureBridge.value.generatePodUploadSheetMiaoshouAiTitles({
      ...options,
      runId,
      entryId: 'pod-upload-sheet-miaoshou-table',
      products: targetProducts.map((product) => {
        const primaryImage = getPrimaryProductImage(product);
        return {
          id: product.id,
          localName: product.localName,
          sourceFolder: product.sourceFolder,
          mainNumber: product.mainNumber,
          categoryId: product.category,
          categoryLabel: product.category,
          imageName: primaryImage.name,
          imagePath: primaryImage.path
        };
      })
    });
    applyAiTitleResults(result);
    Message.success('\u6279\u91cf AI \u6807\u9898\u751f\u6210\u5b8c\u6210');
    scheduleStateSave();
  } catch (error) {
    products.value = products.value.map((product) => product.aiTitleStatus === 'processing' ? { ...product, aiTitleStatus: 'failed', aiTitleError: normalizeText(error && error.message) } : product);
    Message.error('AI \u6807\u9898\u751f\u6210\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    generatingAiTitles.value = false;
  }
}

function applyAiTitleResults(result) {
  const items = Array.isArray(result && result.items) ? result.items : [];
  const itemMap = new Map(items.map((item) => [normalizeText(item && item.id), item]));
  products.value = products.value.map((product) => {
    const item = itemMap.get(product.id);
    if (!item) return product.aiTitleStatus === 'processing' ? { ...product, aiTitleStatus: 'failed' } : product;
    if (item.status === 'success') {
      return { ...product, title: normalizeText(item.zhTitle), englishTitle: normalizeText(item.enTitle), aiTitleStatus: 'success', aiTitleError: '', aiTitlePatternSummary: normalizeText(item.patternSummary), aiTitleUpdatedAt: normalizeText(result && result.updatedAt) };
    }
    return { ...product, aiTitleStatus: item.status === 'canceled' ? 'canceled' : 'failed', aiTitleError: normalizeText(item.error), aiTitleUpdatedAt: normalizeText(result && result.updatedAt) };
  });
  Object.assign(aiProgress, {
    total: Number(result && result.totalCount) || items.length,
    completed: Number(result && result.totalCount) || items.length,
    success: Number(result && result.successCount) || 0,
    failed: Number(result && result.failedCount) || 0,
    canceled: Number(result && result.canceledCount) || 0
  });
}

async function exportTable() {
  if (!featureBridge.value || exportingTable.value || !products.value.length) return;
  exportingTable.value = true;
  try {
    buildSkuRows();
    const exportProducts = products.value.map((product) => ({
      ...product,
      ...globalForm,
      skuConfigMap: cloneSkuMap(skuConfigMap)
    }));
    const result = await featureBridge.value.exportPodUploadSheetMiaoshouTable({
      templateId: globalForm.templateId,
      products: exportProducts
    });
    if (result && result.canceled) {
      Message.warning('\u5df2\u53d6\u6d88\u5bfc\u51fa');
      return;
    }
    Message.success(`\u5df2\u5bfc\u51fa ${Number(result && result.rowCount) || 0} \u884c`);
  } catch (error) {
    Message.error('\u5bfc\u51fa\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    exportingTable.value = false;
  }
}

async function loadInitialData() {
  await Promise.allSettled([loadCategories(), loadFormTemplates(), loadWorkspaceState()]);
}

async function loadCategories() {
  if (!featureBridge.value) return;
  loadingCategories.value = true;
  try {
    const result = await featureBridge.value.getPodUploadSheetMiaoshouCategories();
    categories.value = Array.isArray(result && result.categories) ? result.categories : [];
  } finally {
    loadingCategories.value = false;
  }
}

async function loadFormTemplates() {
  if (!featureBridge.value) return;
  loadingTemplates.value = true;
  try {
    const result = await featureBridge.value.getPodUploadSheetMiaoshouFormTemplates();
    formTemplates.value = Array.isArray(result && result.templates) ? result.templates : [];
    if (!selectedTemplateId.value && formTemplates.value.length > 0) {
      selectedTemplateId.value = formTemplates.value[0].id;
      applySelectedTemplate(selectedTemplateId.value);
    }
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadWorkspaceState() {
  if (!featureBridge.value) return;
  const result = await featureBridge.value.getPodUploadSheetMiaoshouWorkspaceState().catch(() => null);
  const workspace = result && result.workspace ? result.workspace : {};
  lastImportDirectoryPath.value = normalizeText(workspace.lastImportDirectoryPath);
}

function buildTemplatePayload() {
  return {
    templateId: selectedTemplateId.value,
    templateName: templateName.value,
    fields: {
      ...globalForm,
      aiTitlePrefix: '',
      aiTitleSuffix: '',
      aiTitleExtraPrompt: '',
      aiTitleMaxLength: '250'
    },
    skuConfigMap: {
      defaults: createSkuEntry(skuDefaults),
      ...cloneSkuMap(skuConfigMap)
    },
    batchPreset: {
      carouselPresetMode: 'selected',
      carouselPresetSelection: splitLines(carouselPresetText.value),
      descriptionPresetSelection: splitLines(descriptionPresetText.value)
    }
  };
}

async function saveCurrentTemplate() {
  if (!featureBridge.value) return;
  if (!normalizeText(templateName.value)) {
    Message.warning('\u8bf7\u5148\u586b\u5199\u6a21\u677f\u540d\u79f0');
    return;
  }
  savingTemplate.value = true;
  try {
    const result = await featureBridge.value.savePodUploadSheetMiaoshouFormTemplate(buildTemplatePayload());
    formTemplates.value = Array.isArray(result && result.templates) ? result.templates : formTemplates.value;
    Message.success('\u6a21\u677f\u5df2\u4fdd\u5b58');
  } catch (error) {
    Message.error('\u4fdd\u5b58\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5'));
  } finally {
    savingTemplate.value = false;
  }
}

function applySelectedTemplate(value) {
  const template = formTemplates.value.find((item) => item.id === value);
  if (!template) return;
  templateName.value = template.name;
  Object.assign(globalForm, template.fields || {});
  Object.assign(skuDefaults, template.skuConfigMap && template.skuConfigMap.defaults ? template.skuConfigMap.defaults : {});
  Object.keys(skuConfigMap).forEach((key) => delete skuConfigMap[key]);
  Object.assign(skuConfigMap, cloneSkuMap(template.skuConfigMap));
  pruneSkuConfigMap();
  syncGlobalToProducts();
}

async function deleteSelectedTemplate() {
  if (!featureBridge.value || !selectedTemplateId.value) return;
  deletingTemplate.value = true;
  try {
    const result = await featureBridge.value.deletePodUploadSheetMiaoshouFormTemplate({ templateId: selectedTemplateId.value });
    formTemplates.value = Array.isArray(result && result.templates) ? result.templates : formTemplates.value.filter((item) => item.id !== selectedTemplateId.value);
    selectedTemplateId.value = '';
    Message.success('\u6a21\u677f\u5df2\u5220\u9664');
  } finally {
    deletingTemplate.value = false;
  }
}

let saveTimer = 0;
function scheduleStateSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    if (!featureBridge.value || typeof featureBridge.value.savePodUploadSheetMiaoshouWorkspaceState !== 'function') return;
    void featureBridge.value.savePodUploadSheetMiaoshouWorkspaceState({
      lastImportDirectoryPath: lastImportDirectoryPath.value,
      carouselPresetSelection: splitLines(carouselPresetText.value),
      descriptionPresetSelection: splitLines(descriptionPresetText.value)
    }).catch(() => undefined);
  }, 400);
}

function installVueBridge() {
  const existingBridge = window[VIEW_BRIDGE_KEY] && typeof window[VIEW_BRIDGE_KEY] === 'object' ? window[VIEW_BRIDGE_KEY] : {};
  const bridge = {
    ...existingBridge,
    getBatchAiTitleSnapshot,
    startBatchAiTitleGeneration: executeBatchAiTitleGeneration
  };
  window[VIEW_BRIDGE_KEY] = bridge;
  return () => {
    if (window[VIEW_BRIDGE_KEY] === bridge) delete window[VIEW_BRIDGE_KEY];
  };
}

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight || viewportHeight.value;
  scheduleProductTableHeightUpdate();
}

function parseCssPixel(value) {
  const next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : 0;
}

function scheduleProductTableHeightUpdate() {
  if (productTableHeightRaf) window.cancelAnimationFrame(productTableHeightRaf);
  productTableHeightRaf = window.requestAnimationFrame(() => {
    productTableHeightRaf = 0;
    updateProductTableBodyHeight();
  });
}

function updateProductTableBodyHeight() {
  const panel = listPanelRef.value;
  if (!panel) {
    productTableBodyHeight.value = Math.max(140, viewportHeight.value - 680);
    return;
  }

  const panelStyle = window.getComputedStyle(panel);
  const panelPadding = parseCssPixel(panelStyle.paddingTop) + parseCssPixel(panelStyle.paddingBottom);
  const panelGap = parseCssPixel(panelStyle.rowGap || panelStyle.gap);
  const headHeight = listHeadRef.value ? listHeadRef.value.getBoundingClientRect().height : 0;
  const progressHeight = progressLineRef.value ? progressLineRef.value.getBoundingClientRect().height : 0;
  const gapCount = progressHeight > 0 ? 2 : 1;
  const tableChromeHeight = 44;
  const nextHeight = Math.max(220, Math.floor(panel.clientHeight - panelPadding - headHeight - progressHeight - panelGap * gapCount - tableChromeHeight));

  if (Number.isFinite(nextHeight) && Math.abs(nextHeight - productTableBodyHeight.value) > 4) {
    productTableBodyHeight.value = nextHeight;
  }
}

function setupProductTableResizeObserver() {
  if (listPanelResizeObserver) {
    listPanelResizeObserver.disconnect();
    listPanelResizeObserver = null;
  }

  if (typeof ResizeObserver === 'function') {
    listPanelResizeObserver = new ResizeObserver(scheduleProductTableHeightUpdate);
    [listPanelRef.value, listHeadRef.value].filter(Boolean).forEach((element) => listPanelResizeObserver.observe(element));
  }

  scheduleProductTableHeightUpdate();
}

onMounted(() => {
  console.info('[pod-upload-sheet-miaoshou] ui-version 20260710-layout-2');
  document.body.classList.add('pod-miaoshou-vue-mounted');
  updateViewportHeight();
  window.addEventListener('resize', updateViewportHeight);
  nextTick(setupProductTableResizeObserver);
  cleanupAiTitleConfigBridge = aiTitleConfigDialog.installGlobalBridge();
  cleanupBatchAiTitleBridge = batchAiTitleDialog.installGlobalBridge();
  const cleanupVueBridge = installVueBridge();
  cleanupBatchAiTitleBridge = ((previousCleanup) => () => {
    cleanupVueBridge();
    if (typeof previousCleanup === 'function') previousCleanup();
  })(cleanupBatchAiTitleBridge);
  if (featureBridge.value && typeof featureBridge.value.onPodUploadSheetMiaoshouAiTitleProgress === 'function') {
    removeAiTitleProgressListener = featureBridge.value.onPodUploadSheetMiaoshouAiTitleProgress((payload) => {
      Object.assign(aiProgress, {
        total: Number(payload && payload.totalCount) || aiProgress.total,
        completed: Number(payload && payload.completedCount) || aiProgress.completed,
        success: Number(payload && payload.successCount) || aiProgress.success,
        failed: Number(payload && payload.failedCount) || aiProgress.failed,
        canceled: Number(payload && payload.canceledCount) || aiProgress.canceled
      });
    });
  }
  void loadInitialData();
});

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer);
  document.body.classList.remove('pod-miaoshou-vue-mounted');
  window.removeEventListener('resize', updateViewportHeight);
  if (productTableHeightRaf) window.cancelAnimationFrame(productTableHeightRaf);
  if (listPanelResizeObserver) listPanelResizeObserver.disconnect();
  if (typeof cleanupBatchAiTitleBridge === 'function') cleanupBatchAiTitleBridge();
  if (typeof cleanupAiTitleConfigBridge === 'function') cleanupAiTitleConfigBridge();
  if (typeof removeAiTitleProgressListener === 'function') removeAiTitleProgressListener();
});

watch([uploadProgressText, aiTitleProgressText, () => products.value.length], () => {
  nextTick(scheduleProductTableHeightUpdate);
});

defineExpose({
  refresh() {
    return loadInitialData();
  }
});
</script>

<style>
body.pod-miaoshou-vue-mounted {
  overflow: auto;
}

.pod-miaoshou-app-shell {
  --pod-bg: #f6f8fb;
  --pod-surface: #ffffff;
  --pod-surface-soft: #fbfcfe;
  --pod-surface-muted: #f7f9fc;
  --pod-hover: #f3f6fb;
  --pod-border: #e5e8ef;
  --pod-border-soft: #eef1f5;
  --pod-border-strong: #cbd5e1;
  --pod-text: #1d2533;
  --pod-text-strong: #111827;
  --pod-text-muted: #667085;
  --pod-text-subtle: #86909c;
  --pod-shadow: rgba(29, 33, 41, 0.07);
  --pod-primary-soft: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
  --pod-primary-softer: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.055);
  min-height: 100vh;
  box-sizing: border-box;
  overflow: visible;
  padding: 14px;
  background: var(--pod-bg);
  color: var(--pod-text);
}

.pod-miaoshou-app-shell *,
.pod-miaoshou-app-shell *::before,
.pod-miaoshou-app-shell *::after {
  box-sizing: border-box;
}

body.dark-theme .pod-miaoshou-app-shell {
  --pod-bg: #101419;
  --pod-surface: #171c23;
  --pod-surface-soft: #1d2430;
  --pod-surface-muted: #141a22;
  --pod-hover: #222b38;
  --pod-border: #2c3542;
  --pod-border-soft: #25303d;
  --pod-border-strong: #3a4656;
  --pod-text: #d7dde8;
  --pod-text-strong: #f2f5fa;
  --pod-text-muted: #9aa6b6;
  --pod-text-subtle: #7f8b9d;
  --pod-shadow: rgba(0, 0, 0, 0.28);
  background: var(--pod-bg);
  color: var(--pod-text);
}

.pod-miaoshou-app-header,
.pod-panel {
  border: 1px solid var(--pod-border);
  border-radius: 6px;
  background: var(--pod-surface);
  box-shadow: 0 4px 14px rgba(29, 33, 41, 0.05);
}

body.dark-theme .pod-miaoshou-app-header,
body.dark-theme .pod-panel {
  border-color: var(--pod-border);
  background: var(--pod-surface);
  box-shadow: 0 10px 24px var(--pod-shadow);
}

.pod-miaoshou-app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 54px;
  padding: 8px 14px;
  margin: 0 0 10px;
}

.pod-miaoshou-app-header__copy,
.pod-modal-title {
  display: grid;
  gap: 4px;
}

.pod-miaoshou-app-header__eyebrow,
.pod-panel-tag,
.pod-modal-title span {
  margin: 0;
  color: var(--theme-primary-ink, var(--theme-primary-color, #b7791f));
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.pod-miaoshou-app-header__title-row,
.pod-miaoshou-app-header__meta,
.pod-panel-head,
.pod-list-head,
.pod-actions,
.pod-modal-footer,
.pod-summary-pills,
.pod-progress-line {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pod-list-head,
.pod-panel-head {
  justify-content: space-between;
}

.pod-list-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.pod-miaoshou-app-header h1,
.pod-panel-title,
.pod-modal-title strong {
  margin: 0;
  color: var(--pod-text-strong);
  font-size: 16px;
  line-height: 1.2;
}

body.dark-theme .pod-miaoshou-app-header h1,
body.dark-theme .pod-panel-title,
body.dark-theme .pod-modal-title strong {
  color: #f8fafc;
}

.pod-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto auto auto;
  grid-template-areas:
    "templateManage"
    "template"
    "sku"
    "list";
  gap: 14px;
  height: auto;
  min-height: 0;
  margin: 0;
  overflow: visible;
}

.pod-panel {
  display: grid;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  overflow: visible;
}

.pod-template-manage-panel {
  grid-area: templateManage;
}

.pod-template-panel {
  grid-area: template;
  align-content: start;
  overflow: visible;
}

.pod-sku-panel {
  grid-area: sku;
  grid-template-rows: auto auto auto auto;
  align-content: start;
  overflow: visible;
}

.pod-list-panel {
  grid-area: list;
  grid-template-rows: auto auto auto;
  min-height: 360px;
  overflow: visible;
}

.pod-template-grid,
.pod-template-save-row,
.pod-template-main-row,
.pod-template-meta-row,
.pod-template-description-row,
.pod-sku-layout,
.pod-sku-name-row,
.pod-sku-value-row,
.pod-sku-defaults,
.pod-modal-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.pod-template-panel .pod-template-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.pod-template-save-row {
  grid-template-columns: minmax(330px, 0.9fr) minmax(300px, 0.8fr) auto;
  align-items: center;
}

.pod-template-save-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 210px;
}

.pod-template-main-row {
  grid-template-columns: 220px minmax(520px, 1fr);
  align-items: end;
}

.pod-template-meta-row {
  grid-template-columns: 150px 160px 130px minmax(360px, 1fr);
  align-items: end;
}

.pod-template-description-row {
  grid-template-columns: minmax(0, 1fr);
  padding-top: 2px;
}

.pod-sku-layout {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pod-sku-name-row {
  grid-template-columns: repeat(2, minmax(220px, 1fr));
}

.pod-sku-value-row {
  grid-template-columns: repeat(2, minmax(320px, 1fr));
}

.pod-sku-defaults {
  grid-template-columns: repeat(8, minmax(90px, 1fr));
}

.pod-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.pod-inline-field {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.pod-inline-field .pod-field-label {
  white-space: nowrap;
}

.pod-field-wide {
  grid-column: span 2;
}

.pod-field-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--pod-text-muted);
  font-size: 11px;
  font-weight: 700;
}

.pod-help-icon {
  color: var(--theme-primary-color, #f4bf22);
  font-size: 13px;
  line-height: 1;
  cursor: help;
}

.pod-table-title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.pod-table-title--unit {
  display: grid;
  gap: 2px;
  justify-items: center;
  line-height: 1.15;
  white-space: nowrap;
}

.pod-table-title-main {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.pod-table-title-unit {
  display: block;
  color: var(--pod-text-muted);
  font-size: 11px;
  font-weight: 700;
}

body.dark-theme .pod-field-label {
  color: #a8b6ca;
}

.pod-list-head {
  align-items: flex-start;
  grid-template-columns: minmax(0, 1fr);
}

.pod-actions {
  justify-content: flex-start;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--pod-border);
  border-radius: 6px;
  background: var(--pod-surface);
  box-shadow: 0 1px 4px rgba(29, 33, 41, 0.04);
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
}

.pod-actions .arco-btn,
.pod-miaoshou-app-header__meta .arco-btn {
  height: 32px;
  padding: 0 11px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.pod-actions .arco-btn {
  min-width: 104px;
}

.pod-miaoshou-app-header__meta .arco-btn {
  height: 34px;
}

.pod-actions .arco-btn:hover,
.pod-miaoshou-app-header__meta .arco-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.1);
}

.pod-field :deep(.arco-input-wrapper),
.pod-field :deep(.arco-select-view-single),
.pod-field :deep(.arco-textarea-wrapper) {
  min-height: 32px;
  border-color: var(--pod-border-strong);
  border-radius: 6px;
  background: var(--pod-surface);
  box-shadow: none;
}

.pod-template-manage-panel .pod-field :deep(.arco-input-wrapper),
.pod-template-manage-panel .pod-field :deep(.arco-select-view-single) {
  min-height: 34px;
  border-color: var(--pod-border-strong);
  background: var(--pod-surface);
}

.pod-miaoshou-app-shell .arco-input-wrapper,
.pod-miaoshou-app-shell .arco-select-view-single,
.pod-miaoshou-app-shell .arco-select-view,
.pod-miaoshou-app-shell .arco-textarea-wrapper {
  border: 1px solid var(--pod-border-strong) !important;
  background: var(--pod-surface) !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.75) !important;
}

.pod-miaoshou-app-shell .arco-input-wrapper:hover,
.pod-miaoshou-app-shell .arco-select-view:hover,
.pod-miaoshou-app-shell .arco-textarea-wrapper:hover {
  border-color: var(--pod-border-strong) !important;
  background: var(--pod-surface-soft) !important;
}

.pod-miaoshou-app-shell .arco-input-wrapper:focus-within,
.pod-miaoshou-app-shell .arco-select-view-focus,
.pod-miaoshou-app-shell .arco-textarea-wrapper:focus-within {
  border-color: var(--theme-primary-color, #f4bf22) !important;
  box-shadow: 0 0 0 2px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.18) !important;
}

.pod-miaoshou-app-shell .arco-btn-disabled,
.pod-miaoshou-app-shell .arco-btn-disabled:hover {
  background: var(--pod-surface-muted) !important;
  color: var(--pod-text-subtle) !important;
}

.pod-field :deep(.arco-textarea-wrapper) {
  min-height: 54px;
}

.pod-template-panel .pod-description-textarea :deep(.arco-textarea-wrapper),
.pod-template-panel .pod-description-textarea :deep(textarea) {
  height: 76px !important;
  min-height: 76px !important;
  max-height: 76px !important;
}

.pod-field :deep(.arco-input-wrapper:hover),
.pod-field :deep(.arco-select-view-single:hover),
.pod-field :deep(.arco-textarea-wrapper:hover) {
  border-color: var(--pod-border-strong);
}

.pod-theme-button.arco-btn-primary,
.pod-theme-button.arco-btn {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.45);
  background: var(--theme-primary-color, #f4bf22);
  color: var(--theme-primary-contrast, #2f2400);
}

.pod-theme-button.arco-btn:hover,
.pod-theme-button.arco-btn:focus,
.pod-theme-button.arco-btn-primary:hover,
.pod-theme-button.arco-btn-primary:focus {
  border-color: var(--theme-primary-color, #f4bf22) !important;
  background: var(--theme-primary-color, #f4bf22) !important;
  color: var(--theme-primary-contrast, #2f2400) !important;
  filter: saturate(1.08) brightness(1.02);
}

.pod-blue-button.arco-btn {
  border-color: var(--pod-border-strong);
  background: var(--pod-surface);
  color: var(--pod-text-strong);
}

.pod-blue-button.arco-btn:hover,
.pod-blue-button.arco-btn:focus {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.42) !important;
  background: var(--pod-primary-softer) !important;
  color: var(--theme-primary-ink, var(--pod-text-strong)) !important;
  filter: none;
}

.pod-red-button.arco-btn {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.48);
  background: var(--theme-primary-color, #f4bf22);
  color: var(--theme-primary-contrast, #2f2400);
}

.pod-red-button.arco-btn:hover,
.pod-red-button.arco-btn:focus {
  border-color: var(--theme-primary-color, #f4bf22) !important;
  background: var(--theme-primary-color, #f4bf22) !important;
  color: var(--theme-primary-contrast, #2f2400) !important;
  filter: saturate(1.08) brightness(1.02);
}

.pod-danger-button.arco-btn {
  border-color: #dc2626;
  background: #dc2626;
  color: #ffffff;
}

.pod-danger-button.arco-btn:hover,
.pod-danger-button.arco-btn:focus {
  border-color: #dc2626 !important;
  background: #b91c1c !important;
  color: #ffffff !important;
  filter: none;
}

.pod-miaoshou-app-shell .arco-btn:not(.pod-theme-button):not(.pod-blue-button):not(.pod-red-button):not(.pod-danger-button):not(.arco-btn-disabled):hover {
  border-color: var(--pod-border-strong) !important;
  background: var(--pod-hover) !important;
  color: var(--pod-text-strong) !important;
}

.pod-miaoshou-app-shell .arco-btn-disabled,
.pod-miaoshou-app-shell .arco-btn-disabled:hover,
.pod-miaoshou-app-shell .arco-btn-disabled:focus {
  border-color: var(--pod-border) !important;
  background: var(--pod-surface-muted) !important;
  color: var(--pod-text-subtle) !important;
  filter: none !important;
  transform: none !important;
  box-shadow: none !important;
}

.pod-miaoshou-theme-tag.arco-tag,
.pod-summary-pills span,
.pod-progress-line span {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.24);
  background: var(--pod-primary-soft);
  color: var(--theme-primary-ink, #7a4a00);
}

.pod-product-table,
.pod-sku-table {
  min-height: 0;
  border: 1px solid var(--pod-border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.035);
}

.pod-sku-table :deep(.arco-table-body) {
  overflow-y: auto;
}

.pod-product-table :deep(.arco-table-th),
.pod-sku-table :deep(.arco-table-th) {
  background: var(--pod-surface-muted);
  color: var(--pod-text);
  font-size: 12px;
  font-weight: 800;
}

.pod-product-table :deep(.arco-table-td),
.pod-sku-table :deep(.arco-table-td) {
  padding: 7px 10px;
  color: var(--pod-text);
}

.pod-product-table :deep(.arco-table-tr:hover .arco-table-td),
.pod-sku-table :deep(.arco-table-tr:hover .arco-table-td) {
  background: var(--pod-hover);
}

.pod-product-name {
  display: grid;
  gap: 3px;
}

.pod-title-cell {
  display: grid;
  gap: 4px;
}

.pod-title-length {
  justify-self: end;
  color: var(--pod-text-subtle);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.pod-title-length.is-over {
  color: #dc2626;
}

.pod-product-name span,
.pod-muted {
  color: var(--pod-text-subtle);
  font-size: 11px;
}

.pod-chip-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  max-height: 52px;
  overflow: hidden;
}

.pod-chip-list .arco-tag {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pod-material-chip.arco-tag {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.24);
  background: var(--pod-primary-soft);
  color: var(--theme-primary-ink, #7a4a00);
  font-weight: 700;
}

.pod-material-chip-more.arco-tag {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.3);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.13);
  color: var(--theme-primary-ink, #7a4a00);
}

.pod-product-table :deep(.arco-table-tr.is-active) .arco-table-td {
  background: var(--pod-primary-soft);
}

.pod-modal-body {
  display: grid;
  gap: 12px;
}

.pod-modal-footer {
  justify-content: flex-end;
  margin-top: 18px;
}

.pod-carousel-preset-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr);
  align-items: stretch;
  gap: 14px;
}

.pod-carousel-preset-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  height: 552px;
  min-height: 420px;
  border: 1px solid var(--pod-border);
  border-radius: 8px;
  background: var(--pod-surface);
  overflow: hidden;
}

.pod-carousel-preset-panel:last-child {
  grid-template-rows: auto minmax(0, 1fr);
}

.pod-carousel-preset-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--pod-border-soft);
  background: var(--pod-surface-soft);
}

.pod-carousel-preset-head div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.pod-carousel-preset-head strong {
  color: var(--pod-text-strong);
  font-size: 14px;
  line-height: 1.2;
}

.pod-carousel-preset-head span {
  color: var(--pod-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

.pod-carousel-count-tag.arco-tag {
  flex: 0 0 auto;
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.28);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  color: var(--theme-primary-ink, #8f5a0e);
  font-weight: 700;
}

.pod-carousel-preset-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--pod-border-soft);
  background: var(--pod-surface);
}

.pod-carousel-preset-toolbar span {
  margin-left: auto;
  color: var(--pod-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.pod-carousel-preset-modal .arco-checkbox-checked .arco-checkbox-icon {
  border-color: var(--theme-primary-color, #f4bf22);
  background: var(--theme-primary-color, #f4bf22);
}

.pod-carousel-candidate-list,
.pod-carousel-selected-list {
  display: grid;
  align-content: start;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 10px;
  overflow: auto;
  background: var(--pod-surface-soft);
}

.pod-carousel-candidate-item,
.pod-carousel-selected-item {
  display: grid;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid var(--pod-border);
  border-radius: 8px;
  background: var(--pod-surface);
  color: var(--pod-text);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.pod-carousel-candidate-item {
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 8px 10px;
  cursor: pointer;
}

.pod-carousel-candidate-item:hover,
.pod-carousel-candidate-item.is-selected,
.pod-carousel-selected-item:hover {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.34);
  background: var(--pod-primary-softer);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.05);
}

.pod-carousel-selected-item {
  grid-template-columns: 32px minmax(180px, 1fr) auto;
  padding: 8px 10px;
}

.pod-carousel-file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--pod-text);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pod-carousel-assigned-file {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.pod-carousel-assigned-file span {
  color: var(--pod-text-subtle);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
}

.pod-carousel-assigned-file strong {
  min-width: 0;
  overflow: hidden;
  color: var(--pod-text-strong);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pod-carousel-file-count {
  border-radius: 999px;
  background: var(--pod-primary-soft);
  color: var(--theme-primary-ink, #7a4a00);
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  white-space: nowrap;
}

.pod-carousel-order-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--theme-primary-color, #f4bf22);
  color: var(--theme-primary-contrast, #2f2400);
  font-size: 12px;
  font-weight: 800;
}

.pod-carousel-order-actions {
  display: flex;
  gap: 4px;
}

.pod-carousel-order-actions .arco-btn {
  height: 24px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 11px;
}

.pod-carousel-empty {
  padding: 46px 0;
}

.pod-carousel-preset-footer {
  padding-top: 4px;
}

.pod-random-carousel-body {
  display: grid;
  gap: 14px;
}

.pod-random-carousel-only-first {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 8px;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--pod-border);
  border-radius: 999px;
  background: var(--pod-surface-soft);
  color: var(--pod-text-strong);
  font-size: 13px;
  font-weight: 800;
}

.pod-random-carousel-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 478px;
  min-height: 360px;
  border: 1px solid var(--pod-border);
  border-radius: 12px;
  background: var(--pod-surface);
  overflow: hidden;
}

.pod-random-carousel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--pod-border-soft);
  background: var(--pod-surface-soft);
}

.pod-random-carousel-toolbar .arco-btn {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.28);
  border-radius: 999px;
  background: var(--pod-surface);
  color: var(--theme-primary-ink, #7a4a00);
  font-weight: 800;
}

.pod-random-carousel-toolbar span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 24px;
  border-radius: 999px;
  background: var(--pod-surface);
  color: var(--theme-primary-ink, #7a4a00);
  font-size: 12px;
  font-weight: 900;
}

.pod-random-carousel-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  padding: 10px;
  overflow: auto;
  background: var(--pod-surface);
}

.pod-random-carousel-item {
  display: grid;
  grid-template-columns: auto 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid var(--pod-border);
  border-radius: 9px;
  background: var(--pod-surface);
  color: var(--pod-text);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.pod-random-carousel-item:hover,
.pod-random-carousel-item.is-selected {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.34);
  background: var(--pod-primary-softer);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.05);
}

.pod-random-carousel-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--pod-primary-soft);
  color: var(--theme-primary-ink, #7a4a00);
  font-size: 12px;
  font-weight: 900;
}

.pod-random-carousel-item strong {
  min-width: 0;
  overflow: hidden;
  color: var(--pod-text-strong);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pod-random-carousel-footer {
  padding-top: 2px;
}

.pod-quality-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 42px;
  align-items: center;
  gap: 12px;
}

.pod-miaoshou-ai-config-modal .arco-modal,
.pod-miaoshou-batch-ai-title-modal .arco-modal,
.pod-miaoshou-operation-modal .arco-modal {
  width: min(760px, calc(100vw - 32px));
  border-radius: 8px;
}

.pod-carousel-preset-modal .arco-modal {
  width: min(900px, calc(100vw - 32px));
}

.arco-modal.pod-carousel-preset-modal,
.pod-carousel-preset-modal {
  width: min(900px, calc(100vw - 32px));
}

.pod-random-carousel-modal .arco-modal,
.arco-modal.pod-random-carousel-modal,
.pod-random-carousel-modal {
  width: min(560px, calc(100vw - 32px));
}

@media (max-width: 1100px) {
  .pod-template-grid,
  .pod-template-main-row,
  .pod-template-meta-row,
  .pod-template-description-row,
  .pod-sku-defaults,
  .pod-modal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pod-workbench {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
      "templateManage"
      "template"
      "sku"
      "list";
    overflow: visible;
  }

  .pod-sku-layout,
  .pod-sku-defaults {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .pod-miaoshou-app-header,
  .pod-list-head {
    align-items: stretch;
    flex-direction: column;
  }

  .pod-template-grid,
  .pod-template-save-row,
  .pod-template-main-row,
  .pod-template-meta-row,
  .pod-template-description-row,
  .pod-sku-name-row,
  .pod-sku-value-row,
  .pod-sku-layout,
  .pod-sku-defaults,
  .pod-modal-grid {
    grid-template-columns: 1fr;
  }

  .pod-field-wide {
    grid-column: auto;
  }

  .pod-inline-field {
    grid-template-columns: 1fr;
  }

  .pod-carousel-preset-body {
    grid-template-columns: 1fr;
  }

  .pod-carousel-preset-panel {
    min-height: 300px;
  }

  .pod-carousel-candidate-list,
  .pod-carousel-selected-list {
    max-height: 300px;
  }
}
</style>
