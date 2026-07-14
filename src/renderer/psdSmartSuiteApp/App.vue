<template>
  <div class="psd-smart-suite-shell">
    <section class="psd-smart-suite-main">
      <a-card class="psd-smart-suite-section-card psd-smart-suite-section-card--primary" :bordered="false">
        <div class="psd-smart-suite-panel-head psd-smart-suite-panel-head--hero">
          <div class="psd-smart-suite-panel-title">
            <div class="psd-smart-suite-panel-mark">
              <icon-file-image />
            </div>
            <div class="psd-smart-suite-panel-copy">
              <p class="psd-smart-suite-panel-eyebrow">PSD SMART SUITE</p>
              <h1>PSD&#x667A;&#x80FD;&#x5957;&#x56FE;</h1>
              <p>&#x7EDF;&#x4E00;&#x7BA1;&#x7406;&#x7D20;&#x6750;&#x76EE;&#x5F55;&#x3001;PSD&#x6837;&#x673A;&#x548C;&#x5BFC;&#x51FA;&#x89C4;&#x5219;&#xFF0C;&#x6309;&#x5F53;&#x524D;&#x5F15;&#x64CE;&#x914D;&#x7F6E;&#x6279;&#x91CF;&#x6267;&#x884C;&#x5957;&#x56FE;&#x3002;</p>
            </div>
          </div>
        </div>

        <div class="psd-smart-suite-panel-divider"></div>

        <div class="psd-smart-suite-toolbar-grid">
          <div class="psd-smart-suite-toolbar-block psd-smart-suite-toolbar-block--template">
            <div class="psd-smart-suite-inline-head psd-smart-suite-inline-head--template">
              <strong>&#x6A21;&#x677F;&#x7BA1;&#x7406;</strong>
              <span>&#x590D;&#x7528;&#x5DF2;&#x4FDD;&#x5B58;&#x7684;&#x5957;&#x56FE;&#x914D;&#x7F6E;&#x3002;</span>
            </div>

            <div class="psd-smart-suite-template-toolbar">
              <a-select
                v-model="selectedTemplateId"
                class="psd-smart-suite-flex-input psd-smart-suite-template-select"
                placeholder="&#x9009;&#x62E9;&#x5DF2;&#x4FDD;&#x5B58;&#x6A21;&#x677F;"
                allow-clear
              >
                <a-option value="">&#x65B0;&#x5EFA;&#x6A21;&#x677F;</a-option>
                <a-option
                  v-for="tpl in psdTemplates"
                  :key="tpl.id"
                  :value="tpl.id"
                >
                  {{ tpl.name || '\u672A\u547D\u540D\u6A21\u677F' }}
                </a-option>
              </a-select>
              <a-button :disabled="!selectedTemplateId" @click="loadSelectedTemplate">
                &#x5957;&#x7528;&#x6A21;&#x677F;
              </a-button>
              <a-button :loading="busy" @click="syncCloudTemplates">
                &#x540C;&#x6B65;&#x4E91;&#x7AEF;
              </a-button>
              <a-input
                v-model="templateName"
                class="psd-smart-suite-flex-input psd-smart-suite-template-name"
                placeholder="&#x8F93;&#x5165;&#x6A21;&#x677F;&#x540D;&#x79F0;"
                allow-clear
              />
              <a-button type="primary" :disabled="!templateName.trim() || busy" @click="saveTemplate">
                &#x4FDD;&#x5B58;&#x6A21;&#x677F;
              </a-button>
              <a-button
                status="danger"
                :disabled="!selectedTemplateId || busy"
                @click="handleDeleteTemplate"
              >
                {{ deleteTemplateConfirmId === selectedTemplateId ? '\u786E\u8BA4\u5220\u9664' : '\u5220\u9664\u6A21\u677F' }}
              </a-button>
            </div>
          </div>

          <div class="psd-smart-suite-toolbar-block">
            <div class="psd-smart-suite-inline-head">
              <strong>&#x7D20;&#x6750;&#x8BBE;&#x7F6E;</strong>
              <span>&#x652F;&#x6301; PNG&#x3001;JPG&#x3001;WEBP &#x7D20;&#x6750;&#x548C;&#x5143;&#x6570;&#x636E;&#x56FE;&#x6E90;&#x3002;</span>
            </div>

            <div class="psd-smart-suite-form-grid">
              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--wide">
                <div class="psd-smart-suite-label-row">
                  <label>&#x7D20;&#x6750;&#x76EE;&#x5F55;</label>
                  <a-tooltip content="&#x653E;&#x7F6E;&#x9700;&#x8981;&#x5957;&#x56FE;&#x7684; PNG&#x3001;JPG&#x3001;WEBP &#x7D20;&#x6750;&#x56FE;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <div class="psd-smart-suite-path-row">
                  <a-input
                    :model-value="config.psdImageDirectoryPath"
                    readonly
                    placeholder="&#x672A;&#x9009;&#x62E9;&#x7D20;&#x6750;&#x76EE;&#x5F55;"
                  />
                  <a-button :loading="busy" @click="selectImageDirectory">&#x9009;&#x62E9;</a-button>
                </div>
              </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--wide">
                <div class="psd-smart-suite-label-row">
                  <label>&#x5143;&#x6570;&#x636E;&#x6765;&#x6E90;</label>
                  <a-tooltip content="&#x53EF;&#x9009;&#x5355;&#x56FE;&#x6216;&#x539F;&#x56FE;&#x76EE;&#x5F55;&#xFF0C;&#x7528;&#x4E8E;&#x53D6;&#x56FE;&#x6216;&#x8BC6;&#x522B;&#x4FE1;&#x606F;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <div class="psd-smart-suite-path-row psd-smart-suite-path-row--multi">
                  <a-input
                    :model-value="metadataSourceDisplay"
                    readonly
                    placeholder="&#x672A;&#x9009;&#x62E9;&#x5143;&#x6570;&#x636E;&#x6765;&#x6E90;"
                  />
                  <a-button :loading="busy" @click="selectMetadataFile">&#x9009;&#x56FE;</a-button>
                  <a-button :loading="busy" @click="selectMetadataDirectory">&#x9009;&#x76EE;&#x5F55;</a-button>
                  <a-button
                    :disabled="!config.psdMetadataSourcePath && !config.psdMetadataSourceDirectoryPath"
                    @click="clearMetadataSource"
                  >
                    &#x6E05;&#x7A7A;
                  </a-button>
                </div>
              </div>
            </div>

            <div class="psd-smart-suite-summary-strip">
              <span>&#x7D20;&#x6750;&#x6570;&#x91CF; {{ psdImageFiles.length }}</span>
              <span>&#x5143;&#x6570;&#x636E; {{ metadataSourceSummary }}</span>
              <span>&#x6A21;&#x677F; {{ psdTemplates.length }}</span>
            </div>
          </div>
        </div>

        <div class="psd-smart-suite-section-divider"></div>

        <div class="psd-smart-suite-section-head psd-smart-suite-section-head--mockups">
          <div>
            <h2>&#x6837;&#x673A;&#x914D;&#x7F6E;</h2>
            <p>&#x6BCF;&#x4E2A; PSD &#x6837;&#x673A;&#x5355;&#x72EC;&#x8BBE;&#x7F6E;&#x7D20;&#x6750;&#x653E;&#x7F6E;&#x3001;&#x65CB;&#x8F6C;&#x548C;&#x5BFC;&#x51FA;&#x89C4;&#x5219;&#x3002;</p>
          </div>
          <a-button type="primary" @click="addMockup" :disabled="busy">
            <template #icon>
              <icon-plus />
            </template>
            &#x6DFB;&#x52A0;&#x6837;&#x673A;
          </a-button>
        </div>

        <div class="psd-smart-suite-mockup-list">
          <a-card
            v-for="(mockup, index) in mockups"
            :key="mockup.id"
            class="psd-smart-suite-mockup-card"
            :bordered="false"
          >
            <template #title>
              <div class="psd-smart-suite-mockup-head">
                <div class="psd-smart-suite-mockup-title">
                  <div class="psd-smart-suite-mockup-title-copy">
                    <span class="psd-smart-suite-mockup-index">PSD&#x6837;&#x673A; {{ index + 1 }}</span>
                    <span class="psd-smart-suite-mockup-note">
                      {{ mockup.smartObjectName || '\u667A\u80FD\u5BF9\u8C61\u672A\u586B\u5199' }}
                    </span>
                  </div>
                  <a-tag :color="mockup.psdPath ? 'green' : 'gray'" bordered>
                    {{ mockup.psdPath ? '\u5DF2\u9009\u62E9 PSD' : '\u5F85\u914D\u7F6E' }}
                  </a-tag>
                </div>

                <a-button
                  status="danger"
                  :disabled="mockups.length <= 1 || busy"
                  @click="removeMockup(mockup.id)"
                >
                  &#x5220;&#x9664;
                </a-button>
              </div>
            </template>

              <div class="psd-smart-suite-mockup-grid">
                <div class="psd-smart-suite-field-block psd-smart-suite-field-block--span-2">
                  <div class="psd-smart-suite-label-row">
                    <label>PSD&#x6837;&#x673A;&#x6587;&#x4EF6;</label>
                    <a-tooltip content="&#x9009;&#x62E9;&#x5305;&#x542B;&#x667A;&#x80FD;&#x5BF9;&#x8C61;&#x7684; PSD &#x6837;&#x673A;&#x6587;&#x4EF6;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <div class="psd-smart-suite-path-row">
                  <a-input :model-value="mockup.psdPath" readonly placeholder="&#x672A;&#x9009;&#x62E9; PSD &#x6837;&#x673A;" />
                  <a-button :loading="busy" @click="selectMockupPsd(mockup.id)">&#x9009;&#x62E9;</a-button>
                  </div>
                </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--smart-object">
                <div class="psd-smart-suite-label-row">
                  <label>&#x667A;&#x80FD;&#x5BF9;&#x8C61;&#x540D;&#x79F0;</label>
                  <a-tooltip content="&#x9700;&#x8981;&#x66FF;&#x6362;&#x7684;&#x667A;&#x80FD;&#x5BF9;&#x8C61;&#x56FE;&#x5C42;&#x540D;&#x79F0;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-input
                  :model-value="mockup.smartObjectName"
                  placeholder="&#x63D2;&#x753B;#"
                  :disabled="busy"
                  @input="(value) => updateMockupField(mockup.id, 'smartObjectName', value)"
                />
              </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--rotation">
                <div class="psd-smart-suite-label-row">
                  <label>&#x7D20;&#x6750;&#x65CB;&#x8F6C;</label>
                  <a-tooltip content="&#x5148;&#x5C06;&#x7D20;&#x6750;&#x5411;&#x5DE6;&#x6216;&#x5411;&#x53F3;&#x65CB;&#x8F6C; 90 &#x5EA6;&#xFF0C;&#x518D;&#x6309;&#x7D20;&#x6750;&#x653E;&#x7F6E;&#x65B9;&#x5F0F;&#x8FDB;&#x884C;&#x5957;&#x56FE;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-select
                  :model-value="mockup.sourceRotation"
                  :disabled="busy"
                  @change="(value) => updateMockupField(mockup.id, 'sourceRotation', value)"
                >
                  <a-option value="none">&#x4E0D;&#x65CB;&#x8F6C;</a-option>
                  <a-option value="left">&#x5411;&#x5DE6;&#x65CB;&#x8F6C; 90&#x5EA6;</a-option>
                  <a-option value="right">&#x5411;&#x53F3;&#x65CB;&#x8F6C; 90&#x5EA6;</a-option>
                  </a-select>
                </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--replacement psd-smart-suite-field-block--span-2">
                <div class="psd-smart-suite-label-row">
                  <label>&#x7D20;&#x6750;&#x653E;&#x7F6E;&#x65B9;&#x5F0F;</label>
                  <a-tooltip content="&#x94FA;&#x6EE1;&#x753B;&#x5E03;&#x9002;&#x5408;&#x9700;&#x8981;&#x88C1;&#x8FB9;&#x7684;&#x6548;&#x679C;&#xFF0C;&#x5339;&#x914D;&#x753B;&#x5E03;&#x9002;&#x5408;&#x4FDD;&#x6301;&#x6BD4;&#x4F8B;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-select
                  :model-value="mockup.replacementMode"
                  :disabled="busy"
                  @change="(value) => updateMockupField(mockup.id, 'replacementMode', value)"
                >
                  <a-option value="cover-canvas">&#x94FA;&#x6EE1;&#x753B;&#x5E03;&#xFF08;&#x7B49;&#x6BD4;&#x88C1;&#x8FB9;&#xFF09;</a-option>
                  <a-option value="contain-canvas">&#x5339;&#x914D;&#x753B;&#x5E03;&#x5C3A;&#x5BF8;</a-option>
                  <a-option value="layer-bounds-transform">&#x6309;&#x539F;&#x56FE;&#x5C42;&#x8FB9;&#x754C;&#xFF08;&#x62C9;&#x4F38;&#xFF09;</a-option>
                </a-select>
              </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--span-2">
                <div class="psd-smart-suite-label-row">
                  <label>&#x5BFC;&#x51FA;&#x4E3B;&#x76EE;&#x5F55;</label>
                  <a-tooltip content="&#x5F53;&#x524D; PSD &#x6837;&#x673A;&#x4F1A;&#x5BFC;&#x51FA;&#x5230;&#x8BE5;&#x76EE;&#x5F55;&#x4E0B;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <div class="psd-smart-suite-path-row psd-smart-suite-path-row--dual-action">
                  <a-input
                    :model-value="mockup.outputDirectoryPath"
                    readonly
                    placeholder="&#x672A;&#x9009;&#x62E9;&#x5BFC;&#x51FA;&#x4E3B;&#x76EE;&#x5F55;"
                  />
                  <a-button :loading="busy" @click="selectMockupOutputDirectory(mockup.id)">&#x9009;&#x62E9;</a-button>
                  <a-button
                    :disabled="!mockup.outputDirectoryPath"
                    @click="openMockupOutputDirectory(mockup.id)"
                  >
                    &#x6253;&#x5F00;
                  </a-button>
                </div>
              </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--subdir">
                <div class="psd-smart-suite-label-row">
                  <label>&#x5B50;&#x76EE;&#x5F55;&#x540D;&#x79F0;</label>
                  <a-tooltip content="&#x5BFC;&#x51FA;&#x7ED3;&#x679C;&#x4F1A;&#x5B58;&#x5230;&#x4E3B;&#x76EE;&#x5F55;&#x4E0B;&#x7684;&#x8BE5;&#x5B50;&#x76EE;&#x5F55;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-input
                  :model-value="mockup.outputSubdirName"
                  :disabled="busy"
                  placeholder="&#x7559;&#x7A7A;&#x65F6;&#x6309;&#x9ED8;&#x8BA4;&#x89C4;&#x5219;&#x751F;&#x6210;"
                  @input="(value) => updateMockupField(mockup.id, 'outputSubdirName', value)"
                />
              </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--export-mode">
                <div class="psd-smart-suite-label-row">
                  <label>&#x5BFC;&#x51FA;&#x65B9;&#x5F0F;</label>
                  <a-tooltip content="&#x6574;&#x56FE;&#x5BFC;&#x51FA;&#x8F93;&#x51FA;&#x5B8C;&#x6574;&#x6837;&#x673A;&#xFF0C;&#x5207;&#x7247;&#x6A21;&#x5F0F;&#x53EA;&#x4FDD;&#x7559;&#x5207;&#x7247;&#x7ED3;&#x679C;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-select
                  :model-value="mockup.exportMode"
                  :disabled="busy"
                  @change="(value) => updateMockupField(mockup.id, 'exportMode', value)"
                >
                  <a-option value="original">&#x6574;&#x56FE;&#x5BFC;&#x51FA;</a-option>
                  <a-option value="guides">&#x6309;&#x53C2;&#x8003;&#x7EBF;&#x5207;&#x7247;</a-option>
                  <a-option value="slices">&#x6309; PSD &#x5207;&#x7247;&#x6807;&#x8BB0;</a-option>
                  </a-select>
                </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--output-format">
                <div class="psd-smart-suite-label-row">
                  <label>&#x5BFC;&#x51FA;&#x683C;&#x5F0F;</label>
                  <a-tooltip content="PNG &#x65E0;&#x635F;&#x4F53;&#x79EF;&#x66F4;&#x5927;&#xFF0C;JPG &#x548C; WEBP &#x53EF;&#x7ED3;&#x5408;&#x8D28;&#x91CF;&#x63A7;&#x5236;&#x6587;&#x4EF6;&#x5927;&#x5C0F;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-select
                  :model-value="mockup.outputFormat"
                  :disabled="busy"
                  @change="(value) => updateMockupField(mockup.id, 'outputFormat', value)"
                >
                  <a-option value="png">PNG</a-option>
                  <a-option value="jpg">JPG</a-option>
                  <a-option value="webp">WEBP</a-option>
                  </a-select>
                </div>

              <div class="psd-smart-suite-field-block psd-smart-suite-field-block--quality">
                <div class="psd-smart-suite-label-row">
                  <label>&#x56FE;&#x7247;&#x8D28;&#x91CF;</label>
                  <a-tooltip content="&#x6574;&#x56FE;&#x5BFC;&#x51FA;&#x65F6;&#x7528;&#x4E8E;&#x6700;&#x7EC8;&#x56FE;&#xFF0C;&#x5207;&#x7247;&#x65F6;&#x4E2D;&#x95F4;&#x957F;&#x56FE;&#x4FDD;&#x6301;&#x65E0;&#x635F;&#xFF0C;&#x8FD9;&#x91CC;&#x53EA;&#x5F71;&#x54CD;&#x6700;&#x7EC8;&#x5207;&#x7247;&#x6587;&#x4EF6;&#x3002;">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-input-number
                  :model-value="mockup.imageQuality"
                  :min="60"
                  :max="100"
                  :step="1"
                  :disabled="busy"
                  mode="button"
                  :hide-button="false"
                  @change="(value) => updateMockupField(mockup.id, 'imageQuality', Number(value))"
                />
              </div>
            </div>

            <div class="psd-smart-suite-mockup-foot">
              <span class="psd-smart-suite-mockup-meta">
                {{ exportModeLabelMap[mockup.exportMode] }} / {{ replacementModeLabelMap[mockup.replacementMode] }}
              </span>
              <span class="psd-smart-suite-mockup-meta">
                {{ rotationLabelMap[mockup.sourceRotation] }} / {{ String(mockup.outputFormat || '').toUpperCase() }} {{ mockup.imageQuality }}
              </span>
            </div>
          </a-card>
        </div>

        <div class="psd-smart-suite-run-strip">
          <div class="psd-smart-suite-run-overview">
            <div class="psd-smart-suite-metric-card">
              <span class="psd-smart-suite-metric-label">&#x5F53;&#x524D;&#x72B6;&#x6001;</span>
              <strong>{{ currentProgressLabel }}</strong>
            </div>
            <div class="psd-smart-suite-metric-card">
              <span class="psd-smart-suite-metric-label">&#x5C31;&#x7EEA;&#x6837;&#x673A;</span>
              <strong>{{ readyMockupCount }}/{{ mockups.length }}</strong>
            </div>
            <div class="psd-smart-suite-metric-card">
              <span class="psd-smart-suite-metric-label">&#x7D20;&#x6750;&#x6570;&#x91CF;</span>
              <strong>{{ psdImageFiles.length }}</strong>
            </div>
            <div class="psd-smart-suite-metric-card">
              <span class="psd-smart-suite-metric-label">&#x5F15;&#x64CE;&#x5E76;&#x53D1;</span>
              <strong>{{ config.psdEngineConcurrency }}</strong>
            </div>
          </div>

          <div class="psd-smart-suite-run-toolbar">
            <div class="psd-smart-suite-run-control">
              <div class="psd-smart-suite-run-control-head">
                <label>&#x5F15;&#x64CE;&#x7A97;&#x53E3;</label>
                <a-tooltip content="&#x663E;&#x793A;&#x7A97;&#x53E3;&#x65B9;&#x4FBF;&#x89C2;&#x5BDF;&#x5F15;&#x64CE;&#x52A0;&#x8F7D;&#x548C;&#x66FF;&#x6362;&#x6D41;&#x7A0B;&#xFF0C;&#x5207;&#x6362;&#x65F6;&#x4F1A;&#x5B9E;&#x65F6;&#x540C;&#x6B65;&#x3002;">
                  <icon-question-circle class="psd-smart-suite-help-icon" />
                </a-tooltip>
              </div>
              <a-select v-model="config.psdEngineWindowMode">
                <a-option value="hidden">&#x9690;&#x85CF;&#x7A97;&#x53E3;</a-option>
                <a-option value="visible">&#x663E;&#x793A;&#x7A97;&#x53E3;</a-option>
              </a-select>
            </div>

            <div class="psd-smart-suite-run-control">
              <div class="psd-smart-suite-run-control-head">
                <label>&#x5F15;&#x64CE;&#x5E76;&#x53D1;</label>
                <a-tooltip content="&#x53EA;&#x6709;&#x5728;&#x4F60;&#x4E3B;&#x52A8;&#x9009;&#x62E9;&#x66F4;&#x9AD8;&#x5E76;&#x53D1;&#x65F6;&#xFF0C;&#x624D;&#x4F1A;&#x542F;&#x7528;&#x66F4;&#x591A;&#x5F15;&#x64CE;&#x5E76;&#x884C;&#x5904;&#x7406;&#x3002;">
                  <icon-question-circle class="psd-smart-suite-help-icon" />
                </a-tooltip>
              </div>
              <a-select v-model="config.psdEngineConcurrency">
                <a-option
                  v-for="opt in concurrencyOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </a-option>
              </a-select>
            </div>

            <div class="psd-smart-suite-run-control psd-smart-suite-run-control--switch">
              <div class="psd-smart-suite-run-control-head">
                <label>&#x5DF2;&#x5B58;&#x5728;&#x8DF3;&#x8FC7;</label>
              </div>
              <label class="psd-smart-suite-switch-row">
                <span>{{ config.psdSkipExistingOutputs ? '\u5DF2\u542F\u7528' : '\u672A\u542F\u7528' }}</span>
                <a-switch v-model="config.psdSkipExistingOutputs" :disabled="busy" />
              </label>
            </div>

            <div class="psd-smart-suite-run-action">
              <a-button
                type="primary"
                size="large"
                class="psd-smart-suite-run-button"
                :status="psdRunning ? 'danger' : undefined"
                :disabled="busy && !psdRunning"
                @click="psdRunning ? cancelRun() : startRun()"
              >
                <template #icon>
                  <icon-stop v-if="psdRunning" />
                  <icon-play-arrow v-else />
                </template>
                {{ psdRunning ? '\u53D6\u6D88\u5957\u56FE' : '\u5F00\u59CB PSD \u5957\u56FE' }}
              </a-button>
            </div>
          </div>

          <div class="psd-smart-suite-run-progress">
            <div class="psd-smart-suite-run-progress-head">
              <span>&#x4EFB;&#x52A1;&#x8FDB;&#x5EA6;</span>
              <strong>{{ progressPercentLabel }}</strong>
            </div>
            <div class="psd-smart-suite-run-progress-summary">
              {{ psdProgressSummary || currentProgressLabel }}
            </div>
            <div class="psd-smart-suite-run-progress-track">
              <span :style="{ width: `${progressPercent}%` }"></span>
            </div>
          </div>
        </div>
      </a-card>

      <a-card class="psd-smart-suite-log-card" :bordered="false">
        <template #title>
          <div class="psd-smart-suite-log-head">
            <div class="psd-smart-suite-log-head-copy">
              <h2>&#x8FD0;&#x884C;&#x65E5;&#x5FD7;</h2>
              <span>{{ currentProgressLabel }}</span>
            </div>
            <div class="psd-smart-suite-log-head-actions">
              <span class="psd-smart-suite-log-meta">&#x65E5;&#x5FD7; {{ logs.length }}</span>
              <span class="psd-smart-suite-log-meta">&#x6210;&#x529F; {{ successLogCount }}</span>
              <span class="psd-smart-suite-log-meta is-danger">&#x5931;&#x8D25; {{ errorLogCount }}</span>
              <a-button @click="clearLog">&#x6E05;&#x7A7A;</a-button>
            </div>
          </div>
        </template>

        <div ref="logContainer" class="psd-smart-suite-log">
          <div v-if="logs.length === 0" class="psd-smart-suite-empty">
            &#x6682;&#x65E0;&#x65E5;&#x5FD7;&#xFF0C;&#x9009;&#x62E9;&#x7D20;&#x6750;&#x548C; PSD &#x6837;&#x673A;&#x540E;&#x70B9;&#x51FB;&#x201C;&#x5F00;&#x59CB; PSD &#x5957;&#x56FE;&#x201D;&#x3002;
          </div>
          <div
            v-for="(entry, idx) in logs"
            :key="idx"
            class="psd-smart-suite-log-entry"
            :class="{
              'is-error': entry.tone === 'error',
              'is-success': entry.tone === 'success'
            }"
          >
            <div class="psd-smart-suite-log-entry-head">
              <span class="psd-smart-suite-log-entry-time">{{ entry.time }}</span>
              <span class="psd-smart-suite-log-entry-badge">
                {{ getLogToneLabel(entry.tone) }}
              </span>
            </div>
            <div class="psd-smart-suite-log-entry-text">{{ entry.text }}</div>
          </div>
        </div>
      </a-card>
    </section>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import {
  IconFileImage,
  IconPlayArrow,
  IconPlus,
  IconQuestionCircle,
  IconStop
} from '@arco-design/web-vue/es/icon';
import bridge from './bridge.js';
import {
  ENGINE_CONCURRENCY_OPTIONS,
  PSD_EXPORT_MODE_LABELS,
  PSD_REPLACEMENT_MODE_LABELS,
  PSD_SOURCE_ROTATION_LABELS
} from './constants.js';
import {
  readPsdSmartSuiteSettings,
  writePsdSmartSuiteSettings
} from './utils/psdSmartSuiteSettings.js';
import { usePsdSmartSuiteLogs } from './utils/psdSmartSuiteLogs.js';
import { usePsdSmartSuiteMockupFileActions } from './utils/psdSmartSuiteMockupFileActions.js';
import { usePsdSmartSuiteMockups } from './utils/psdSmartSuiteMockups.js';
import { usePsdSmartSuiteRuntime } from './utils/psdSmartSuiteRuntime.js';
import { usePsdSmartSuiteSources } from './utils/psdSmartSuiteSources.js';
import { usePsdSmartSuiteTemplateWorkspace } from './utils/psdSmartSuiteTemplateWorkspace.js';

const busy = ref(false);
const {
  addLog,
  clearLog,
  errorLogCount,
  getPsdSmartSuiteLogToneLabel: getLogToneLabel,
  logContainer,
  logs,
  successLogCount
} = usePsdSmartSuiteLogs();
const {
  addMockup,
  ensureMockups,
  mockups,
  readyMockupCount,
  removeMockup,
  setMockups,
  updateMockupField
} = usePsdSmartSuiteMockups();

const config = reactive({
  psdImageDirectoryPath: '',
  psdMetadataSourcePath: '',
  psdMetadataSourceDirectoryPath: '',
  psdEngineWindowMode: 'hidden',
  psdEngineConcurrency: 2,
  psdSkipExistingOutputs: true
});
const {
  clearMetadataSource,
  collectDirectoryFiles,
  metadataSourceDisplay,
  metadataSourceSummary,
  psdImageFiles,
  psdMetadataSourceFiles,
  refreshSourceFiles,
  selectImageDirectory,
  selectMetadataDirectory,
  selectMetadataFile
} = usePsdSmartSuiteSources({
  addLog,
  bridge,
  busy,
  config,
  messageApi: Message
});
const {
  attachProgressListener,
  cancelRun,
  currentProgressLabel,
  detachProgressListener,
  progressPercent,
  progressPercentLabel,
  psdProgressSummary,
  psdRunning,
  startRun,
  syncEngineWindowMode
} = usePsdSmartSuiteRuntime({
  addLog,
  bridge,
  busy,
  clearLog,
  config,
  ensureMockups,
  messageApi: Message,
  mockups,
  psdImageFiles
});
const {
  deleteTemplateConfirmId,
  handleDeleteTemplate,
  loadSelectedTemplate,
  loadTemplates,
  psdTemplates,
  saveTemplate,
  selectedTemplateId,
  syncCloudTemplates,
  templateName
} = usePsdSmartSuiteTemplateWorkspace({
  addLog,
  bridge,
  busy,
  collectDirectoryFiles,
  config,
  ensureMockups,
  messageApi: Message,
  mockups,
  psdImageFiles,
  psdMetadataSourceFiles,
  setMockups
});

const concurrencyOptions = ENGINE_CONCURRENCY_OPTIONS;
const exportModeLabelMap = PSD_EXPORT_MODE_LABELS;
const replacementModeLabelMap = PSD_REPLACEMENT_MODE_LABELS;
const rotationLabelMap = PSD_SOURCE_ROTATION_LABELS;
const {
  openMockupOutputDirectory,
  selectMockupOutputDirectory,
  selectMockupPsd
} = usePsdSmartSuiteMockupFileActions({
  addLog,
  bridge,
  busy,
  messageApi: Message,
  mockups,
  updateMockupField
});

function restoreLocalSettings() {
  const settings = readPsdSmartSuiteSettings(localStorage);

  if (!settings) {
    return;
  }

  if (settings.psdEngineConcurrency != null) {
    config.psdEngineConcurrency = settings.psdEngineConcurrency;
  }

  if (settings.psdEngineWindowMode) {
    config.psdEngineWindowMode = settings.psdEngineWindowMode;
  }

  if (settings.psdSkipExistingOutputs != null) {
    config.psdSkipExistingOutputs = settings.psdSkipExistingOutputs;
  }
}

function persistLocalSettings() {
  writePsdSmartSuiteSettings(localStorage, {
    psdEngineConcurrency: config.psdEngineConcurrency,
    psdEngineWindowMode: config.psdEngineWindowMode,
    psdSkipExistingOutputs: config.psdSkipExistingOutputs
  });
}

async function refresh() {
  ensureMockups();
  await loadTemplates();
  await refreshSourceFiles();

  return {
    refreshedAt: new Date().toISOString()
  };
}

onMounted(() => {
  ensureMockups();
  restoreLocalSettings();
  void loadTemplates();
  void syncEngineWindowMode();
  attachProgressListener();
});

onUnmounted(() => {
  detachProgressListener();

  persistLocalSettings();
});

defineExpose({
  refresh
});
</script>

