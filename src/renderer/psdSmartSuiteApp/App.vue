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
          <div class="psd-smart-suite-panel-tags">
            <a-tag :color="statusTagColor" bordered>
              {{ statusLabel }}
            </a-tag>
            <a-tag color="arcoblue" bordered>
              &#x6837;&#x673A; {{ mockups.length }}
            </a-tag>
            <a-tag color="gold" bordered>
              &#x7D20;&#x6750; {{ psdImageFiles.length }}
            </a-tag>
            <a-tag v-if="psdProgressSummary" color="green" bordered>
              {{ psdProgressSummary }}
            </a-tag>
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
              <a-tag color="gold" bordered>
                {{ exportModeLabelMap[mockup.exportMode] }}
              </a-tag>
              <a-tag color="arcoblue" bordered>
                {{ rotationLabelMap[mockup.sourceRotation] }}
              </a-tag>
              <a-tag color="purple" bordered>
                {{ replacementModeLabelMap[mockup.replacementMode] }}
              </a-tag>
              <a-tag color="green" bordered>
                {{ String(mockup.outputFormat || '').toUpperCase() }} / {{ mockup.imageQuality }}
              </a-tag>
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

            <div class="psd-smart-suite-run-tip">
              <span class="psd-smart-suite-run-tip-label">&#x603B;&#x8FDB;&#x5EA6;</span>
              <strong>{{ psdProgressSummary || currentProgressLabel }}</strong>
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
          </div>

          <div class="psd-smart-suite-run-progress">
            <div class="psd-smart-suite-run-progress-head">
              <span>&#x4EFB;&#x52A1;&#x8FDB;&#x5EA6;</span>
              <strong>{{ progressPercentLabel }}</strong>
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
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
  MAX_PSD_ACTIVE_ENGINE_COUNT,
  PSD_EXPORT_MODE_LABELS,
  PSD_PROGRESS_PHASE_LABELS,
  PSD_REPLACEMENT_MODE_LABELS,
  PSD_SOURCE_ROTATION_LABELS,
  SETTINGS_STORAGE_KEY
} from './constants.js';

const busy = ref(false);
const psdRunning = ref(false);
const psdCanceling = ref(false);
const psdProgressSummary = ref('');
const selectedTemplateId = ref('');
const templateName = ref('');
const deleteTemplateConfirmId = ref('');
const deleteTemplateConfirmTimer = ref(0);
const psdTemplates = ref([]);
const mockups = ref([]);
const logs = ref([]);
const logContainer = ref(null);
const psdImageFiles = ref([]);
const psdMetadataSourceFiles = ref([]);
const currentProgressLabel = ref('待命');
const progressCurrent = ref(0);
const progressTotal = ref(0);
let unsubscribeProgress = null;

const config = reactive({
  psdImageDirectoryPath: '',
  psdMetadataSourcePath: '',
  psdMetadataSourceDirectoryPath: '',
  psdEngineWindowMode: 'hidden',
  psdEngineConcurrency: 2,
  psdSkipExistingOutputs: true
});

const concurrencyOptions = ENGINE_CONCURRENCY_OPTIONS;
const exportModeLabelMap = PSD_EXPORT_MODE_LABELS;
const replacementModeLabelMap = PSD_REPLACEMENT_MODE_LABELS;
const rotationLabelMap = PSD_SOURCE_ROTATION_LABELS;
const readyMockupCount = computed(() => (
  mockups.value.filter((item) => item.psdPath && item.outputDirectoryPath).length
));
const successLogCount = computed(() => (
  logs.value.filter((entry) => entry.tone === 'success').length
));
const errorLogCount = computed(() => (
  logs.value.filter((entry) => entry.tone === 'error').length
));
const progressPercent = computed(() => {
  if (progressTotal.value > 0) {
    return Math.max(0, Math.min(100, Math.round((progressCurrent.value / progressTotal.value) * 100)));
  }

  if (!psdRunning.value && currentProgressLabel.value === '\u4EFB\u52A1\u5B8C\u6210') {
    return 100;
  }

  return 0;
});
const progressPercentLabel = computed(() => `${progressPercent.value}%`);

const metadataSourceDisplay = computed(() => (
  config.psdMetadataSourcePath || config.psdMetadataSourceDirectoryPath || ''
));

const metadataSourceSummary = computed(() => {
  if (config.psdMetadataSourcePath) {
    return '单图';
  }

  if (config.psdMetadataSourceDirectoryPath) {
    return `目录 ${psdMetadataSourceFiles.value.length} 张`;
  }

  return '未设置';
});

const statusLabel = computed(() => {
  if (psdCanceling.value) {
    return '正在取消';
  }

  if (psdRunning.value) {
    return psdProgressSummary.value || '套图执行中';
  }

  return '待执行';
});

const statusTagColor = computed(() => {
  if (psdCanceling.value) {
    return 'orangered';
  }

  if (psdRunning.value) {
    return 'arcoblue';
  }

  return 'gray';
});

function createEntityId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function padTimeSegment(value) {
  return String(value).padStart(2, '0');
}

function formatLogTime(value = new Date()) {
  const nextValue = value instanceof Date ? value : new Date(value);
  return [
    padTimeSegment(nextValue.getHours()),
    padTimeSegment(nextValue.getMinutes()),
    padTimeSegment(nextValue.getSeconds())
  ].join(':');
}

function getLogToneLabel(tone) {
  if (tone === 'success') {
    return '\u6210\u529F';
  }

  if (tone === 'error') {
    return '\u5931\u8D25';
  }

  return '\u8FD0\u884C';
}

function clampConcurrency(value) {
  const nextValue = Math.round(Number(value) || 2);
  return Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, nextValue));
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizePsdExportMode(value) {
  const nextValue = normalizeText(value);
  return ['original', 'guides', 'slices'].includes(nextValue) ? nextValue : 'original';
}

function normalizePsdOutputFormat(value) {
  const nextValue = normalizeText(value).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(nextValue) ? nextValue : 'png';
}

function normalizePsdImageQuality(value) {
  const nextValue = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, nextValue));
}

function normalizeMockup(mockup) {
  return {
    id: mockup && mockup.id ? mockup.id : createEntityId('psd_mockup'),
    psdPath: mockup && mockup.psdPath ? String(mockup.psdPath) : '',
    smartObjectName: mockup && mockup.smartObjectName ? String(mockup.smartObjectName) : '插画#',
    sourceRotation: ['left', 'right'].includes(mockup && mockup.sourceRotation)
      ? mockup.sourceRotation
      : 'none',
    replacementMode: ['cover-canvas', 'contain-canvas', 'layer-bounds-transform'].includes(mockup && mockup.replacementMode)
      ? mockup.replacementMode
      : 'cover-canvas',
    exportMode: normalizePsdExportMode(mockup && mockup.exportMode),
    outputDirectoryPath: mockup && mockup.outputDirectoryPath ? String(mockup.outputDirectoryPath) : '',
    outputSubdirName: normalizeText(mockup && mockup.outputSubdirName),
    outputFormat: normalizePsdOutputFormat(mockup && mockup.outputFormat),
    imageQuality: normalizePsdImageQuality(mockup && mockup.imageQuality)
  };
}

function ensureMockups() {
  if (!Array.isArray(mockups.value) || mockups.value.length === 0) {
    mockups.value = [normalizeMockup({})];
    return;
  }

  mockups.value = mockups.value.map((item) => normalizeMockup(item));
}

function addLog(text, tone = '') {
  logs.value.push({
    text: String(text || ''),
    tone,
    time: formatLogTime()
  });

  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

function clearLog() {
  logs.value = [];
}

async function collectDirectoryFiles(directoryPath) {
  if (!directoryPath) {
    return [];
  }

  const result = await bridge.collectImageFiles({ directoryPath });
  return result && Array.isArray(result.files) ? result.files : [];
}

async function loadTemplates(options = {}) {
  try {
    const result = await bridge.getPsdSmartObjectTemplates({
      preferCloud: options.preferCloud === true
    });
    psdTemplates.value = result && Array.isArray(result.templates)
      ? result.templates
      : [];

    return result || null;
  } catch (error) {
    addLog(String(error && error.message ? error.message : error), 'error');
    return null;
  }
}

async function loadSelectedTemplate() {
  if (!selectedTemplateId.value || busy.value) {
    return;
  }

  const template = psdTemplates.value.find((item) => item.id === selectedTemplateId.value);

  if (!template) {
    return;
  }

  busy.value = true;

  try {
    config.psdImageDirectoryPath = template.imageDirectoryPath || '';
    config.psdMetadataSourcePath = template.metadataSourcePath || '';
    config.psdMetadataSourceDirectoryPath = template.metadataSourceDirectoryPath || '';
    config.psdEngineWindowMode = template.engineWindowMode === 'visible' ? 'visible' : 'hidden';
    config.psdEngineConcurrency = clampConcurrency(template.engineConcurrency);
    config.psdSkipExistingOutputs = template.skipExistingOutputs !== false;
    templateName.value = template.name || '';

    mockups.value = Array.isArray(template.mockups) && template.mockups.length
      ? template.mockups.map((item) => normalizeMockup(item))
      : [normalizeMockup({})];

    psdImageFiles.value = await collectDirectoryFiles(config.psdImageDirectoryPath);
    psdMetadataSourceFiles.value = config.psdMetadataSourceDirectoryPath
      ? await collectDirectoryFiles(config.psdMetadataSourceDirectoryPath)
      : [];

    addLog(`已套用模板“${template.name || '未命名模板'}”。`, 'success');
  } catch (error) {
    addLog(String(error && error.message ? error.message : error), 'error');
  } finally {
    busy.value = false;
  }
}

async function saveTemplate() {
  if (!templateName.value.trim() || busy.value) {
    return;
  }

  busy.value = true;

  try {
    ensureMockups();

    const result = await bridge.savePsdSmartObjectTemplate({
      id: selectedTemplateId.value || undefined,
      name: templateName.value.trim(),
      imageDirectoryPath: config.psdImageDirectoryPath,
      metadataSourcePath: config.psdMetadataSourcePath,
      metadataSourceDirectoryPath: config.psdMetadataSourceDirectoryPath,
      engineConcurrency: clampConcurrency(config.psdEngineConcurrency),
      engineWindowMode: config.psdEngineWindowMode,
      skipExistingOutputs: config.psdSkipExistingOutputs,
      mockups: mockups.value.map((item) => normalizeMockup(item))
    });

    if (result && Array.isArray(result.templates)) {
      psdTemplates.value = result.templates;
    }

    if (result && result.template && result.template.id) {
      selectedTemplateId.value = result.template.id;
      templateName.value = result.template.name || '';
    }

    addLog('模板已保存。', 'success');
    Message.success('模板已保存');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function syncCloudTemplates() {
  if (busy.value) {
    return;
  }

  busy.value = true;

  try {
    const result = await loadTemplates({
      preferCloud: true
    });
    const templateCount = result && Array.isArray(result.templates)
      ? result.templates.length
      : 0;
    const source = result && result.source ? result.source : '';
    const successMessage = source === 'cloud'
      ? `已从云端同步 ${templateCount} 个模板。`
      : templateCount > 0
        ? `云端没有返回新模板，当前显示 ${templateCount} 个本地模板。`
        : '云端和本地都没有模板数据。';

    addLog(successMessage, source === 'cloud' ? 'success' : '');
    Message.success(successMessage);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function handleDeleteTemplate() {
  if (!selectedTemplateId.value || busy.value) {
    return;
  }

  if (deleteTemplateConfirmId.value !== selectedTemplateId.value) {
    deleteTemplateConfirmId.value = selectedTemplateId.value;

    if (deleteTemplateConfirmTimer.value) {
      clearTimeout(deleteTemplateConfirmTimer.value);
    }

    deleteTemplateConfirmTimer.value = setTimeout(() => {
      deleteTemplateConfirmId.value = '';
    }, 5000);

    return;
  }

  busy.value = true;

  try {
    const result = await bridge.deletePsdSmartObjectTemplate({
      id: selectedTemplateId.value
    });

    psdTemplates.value = result && Array.isArray(result.templates)
      ? result.templates
      : [];
    selectedTemplateId.value = '';
    templateName.value = '';
    deleteTemplateConfirmId.value = '';

    addLog('模板已删除。', 'success');
    Message.success('模板已删除');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function selectImageDirectory() {
  if (busy.value) {
    return;
  }

  busy.value = true;

  try {
    const result = await bridge.selectPsdImageDirectory({
      defaultPath: config.psdImageDirectoryPath
    });

    if (!result || result.canceled) {
      return;
    }

    config.psdImageDirectoryPath = result.directoryPath || '';
    psdImageFiles.value = Array.isArray(result.files) ? result.files : [];
    addLog(`已选择素材目录，共识别 ${psdImageFiles.value.length} 张图片。`, 'success');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function selectMetadataFile() {
  if (busy.value) {
    return;
  }

  busy.value = true;

  try {
    const result = await bridge.selectPsdMetadataSourceFile({
      defaultPath: config.psdMetadataSourcePath
    });

    if (!result || result.canceled) {
      return;
    }

    config.psdMetadataSourcePath = result.filePath || '';
    config.psdMetadataSourceDirectoryPath = '';
    psdMetadataSourceFiles.value = [];
    addLog(`已选择元数据来源图片：${config.psdMetadataSourcePath}`, 'success');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function selectMetadataDirectory() {
  if (busy.value) {
    return;
  }

  busy.value = true;

  try {
    const result = await bridge.selectPsdMetadataSourceDirectory({
      defaultPath: config.psdMetadataSourceDirectoryPath
    });

    if (!result || result.canceled) {
      return;
    }

    config.psdMetadataSourceDirectoryPath = result.directoryPath || '';
    config.psdMetadataSourcePath = '';
    psdMetadataSourceFiles.value = Array.isArray(result.files) ? result.files : [];
    addLog(`已选择元数据来源目录，共 ${psdMetadataSourceFiles.value.length} 张图片。`, 'success');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

function clearMetadataSource() {
  config.psdMetadataSourcePath = '';
  config.psdMetadataSourceDirectoryPath = '';
  psdMetadataSourceFiles.value = [];
}

function addMockup() {
  mockups.value.push(normalizeMockup({}));
}

function removeMockup(mockupId) {
  if (mockups.value.length <= 1) {
    return;
  }

  mockups.value = mockups.value.filter((item) => item.id !== mockupId);
  ensureMockups();
}

function updateMockupField(mockupId, field, value) {
  mockups.value = mockups.value.map((item) => {
    if (item.id !== mockupId) {
      return item;
    }

    const nextItem = {
      ...item,
      [field]: value
    };

    if (field === 'imageQuality') {
      nextItem.imageQuality = normalizePsdImageQuality(value);
    }

    if (field === 'exportMode') {
      nextItem.exportMode = normalizePsdExportMode(value);
    }

    if (field === 'outputFormat') {
      nextItem.outputFormat = normalizePsdOutputFormat(value);
    }

    return nextItem;
  });
}

async function selectMockupPsd(mockupId) {
  if (busy.value) {
    return;
  }

  busy.value = true;

  try {
    const currentMockup = mockups.value.find((item) => item.id === mockupId);
    const result = await bridge.selectPsdMockupFile({
      defaultPath: currentMockup ? currentMockup.psdPath : ''
    });

    if (!result || result.canceled) {
      return;
    }

    updateMockupField(mockupId, 'psdPath', result.filePath || '');
    addLog(`已选择 PSD 样机：${result.filePath}`, 'success');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function selectMockupOutputDirectory(mockupId) {
  if (busy.value) {
    return;
  }

  busy.value = true;

  try {
    const currentMockup = mockups.value.find((item) => item.id === mockupId);
    const result = await bridge.selectPsdOutputDirectory({
      defaultPath: currentMockup ? currentMockup.outputDirectoryPath : ''
    });

    if (!result || result.canceled) {
      return;
    }

    updateMockupField(mockupId, 'outputDirectoryPath', result.directoryPath || '');
    addLog(`已选择导出目录：${result.directoryPath}`, 'success');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    busy.value = false;
  }
}

async function openMockupOutputDirectory(mockupId) {
  const currentMockup = mockups.value.find((item) => item.id === mockupId);

  if (!currentMockup || !currentMockup.outputDirectoryPath) {
    return;
  }

  try {
    await bridge.openDirectory({
      directoryPath: currentMockup.outputDirectoryPath
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  }
}

function buildRunPayload() {
  ensureMockups();

  return {
    windowRunId: bridge.getWindowRunId(),
    imageDirectoryPath: config.psdImageDirectoryPath,
    metadataSourcePath: config.psdMetadataSourcePath,
    metadataSourceDirectoryPath: config.psdMetadataSourceDirectoryPath,
    engineWindowMode: config.psdEngineWindowMode,
    engineConcurrency: clampConcurrency(config.psdEngineConcurrency),
    skipExistingOutputs: config.psdSkipExistingOutputs,
    mockups: mockups.value.map((item) => normalizeMockup(item))
  };
}

async function startRun() {
  if (busy.value || psdRunning.value) {
    return;
  }

  ensureMockups();

  const hasValidMockup = mockups.value.some((item) => item.psdPath);

  if (!config.psdImageDirectoryPath || !hasValidMockup) {
    const message = '请先选择素材目录和至少一个 PSD 样机文件。';
    addLog(message, 'error');
    Message.error(message);
    return;
  }

  if (!mockups.value.every((item) => item.outputDirectoryPath)) {
    const message = '请为每个样机设置导出目录。';
    addLog(message, 'error');
    Message.error(message);
    return;
  }

  psdRunning.value = true;
  psdCanceling.value = false;
  psdProgressSummary.value = '';
  currentProgressLabel.value = '任务启动';
  progressCurrent.value = 0;
  progressTotal.value = 0;
  busy.value = true;
  clearLog();

  try {
    await bridge.setPsdEngineWindowVisible({
      visible: config.psdEngineWindowMode === 'visible'
    });

    addLog('任务已启动，等待引擎处理...');

    const result = await bridge.generatePsdSmartObjectMockups(buildRunPayload());

    if (result && result.success !== false) {
      progressTotal.value = Number(result.totalInputCount || 0);
      progressCurrent.value = progressTotal.value;
      psdProgressSummary.value = `完成: 输入 ${result.totalInputCount || 0} 张, 导出 ${result.generatedCount || 0} 张, 失败 ${result.failedCount || 0} 张`;
      currentProgressLabel.value = '任务完成';
      addLog(psdProgressSummary.value, result.failedCount ? '' : 'success');
      Message.success('PSD 套图已完成');
    }
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    currentProgressLabel.value = '执行失败';
    Message.error(message);
  } finally {
    psdRunning.value = false;
    psdCanceling.value = false;
    busy.value = false;
  }
}

async function cancelRun() {
  if (!psdRunning.value || psdCanceling.value) {
    return;
  }

  psdCanceling.value = true;

  try {
    await bridge.cancelPsdSmartObjectMockups({
      windowRunId: bridge.getWindowRunId()
    });
    currentProgressLabel.value = '正在取消';
    addLog('已发送取消请求...');
    Message.info('已发送取消请求');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    addLog(message, 'error');
    Message.error(message);
  } finally {
    psdCanceling.value = false;
  }
}

function handlePsdProgress(progress) {
  if (!progress) {
    return;
  }

  const phaseLabel = PSD_PROGRESS_PHASE_LABELS[progress.phase] || progress.phase || '未知阶段';
  currentProgressLabel.value = phaseLabel;

  let message = `[${phaseLabel}]`;

  if (progress.mockupIndex != null) {
    message += ` 样机${progress.mockupIndex + 1}`;
  }

  if (progress.itemIndex != null && progress.totalItems != null) {
    message += ` 素材${progress.itemIndex + 1}/${progress.totalItems}`;
  }

  if (progress.smartObjectName) {
    message += ` (${progress.smartObjectName})`;
  }

  if (progress.message) {
    message += ` ${progress.message}`;
  }

  if (progress.totalItems != null) {
    progressTotal.value = Number(progress.totalItems) || 0;
    progressCurrent.value = Math.min(progress.itemIndex != null ? progress.itemIndex + 1 : 0, progressTotal.value);
    psdProgressSummary.value = `总进度 ${Math.min(progress.itemIndex != null ? progress.itemIndex + 1 : 0, progress.totalItems)}/${progress.totalItems}`;
  }

  const tone = ['item-failed', 'mockup-failed'].includes(progress.phase)
    ? 'error'
    : (progress.phase === 'complete' ? 'success' : '');
  addLog(message, tone);

  if (progress.phase === 'complete' && progress.summary) {
    progressCurrent.value = progressTotal.value;
    psdProgressSummary.value = progress.summary;
  }
}

async function syncEngineWindowMode() {
  try {
    await bridge.setPsdEngineWindowVisible({
      visible: config.psdEngineWindowMode === 'visible'
    });
  } catch (_) {
    // ignore runtime toggle failure in renderer
  }
}

function restoreLocalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);

    if (parsed && parsed.psdEngineConcurrency) {
      config.psdEngineConcurrency = clampConcurrency(parsed.psdEngineConcurrency);
    }

    if (parsed && parsed.psdEngineWindowMode) {
      config.psdEngineWindowMode = parsed.psdEngineWindowMode === 'visible'
        ? 'visible'
        : 'hidden';
    }

    if (parsed && parsed.psdSkipExistingOutputs !== undefined) {
      config.psdSkipExistingOutputs = !!parsed.psdSkipExistingOutputs;
    }
  } catch (_) {
    // ignore invalid local settings
  }
}

function persistLocalSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      psdEngineConcurrency: config.psdEngineConcurrency,
      psdEngineWindowMode: config.psdEngineWindowMode,
      psdSkipExistingOutputs: config.psdSkipExistingOutputs
    }));
  } catch (_) {
    // ignore local persistence failure
  }
}

async function refresh() {
  ensureMockups();
  await loadTemplates();

  if (config.psdImageDirectoryPath) {
    try {
      psdImageFiles.value = await collectDirectoryFiles(config.psdImageDirectoryPath);
    } catch (_) {
      psdImageFiles.value = [];
    }
  }

  if (config.psdMetadataSourceDirectoryPath) {
    try {
      psdMetadataSourceFiles.value = await collectDirectoryFiles(config.psdMetadataSourceDirectoryPath);
    } catch (_) {
      psdMetadataSourceFiles.value = [];
    }
  }

  return {
    refreshedAt: new Date().toISOString()
  };
}

watch(selectedTemplateId, () => {
  templateName.value = '';
  deleteTemplateConfirmId.value = '';
});

watch(() => config.psdEngineWindowMode, () => {
  void syncEngineWindowMode();
});

onMounted(() => {
  ensureMockups();
  restoreLocalSettings();
  void loadTemplates();
  void syncEngineWindowMode();
  unsubscribeProgress = bridge.onPsdSmartObjectProgress(handlePsdProgress);
});

onUnmounted(() => {
  if (typeof unsubscribeProgress === 'function') {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }

  if (deleteTemplateConfirmTimer.value) {
    clearTimeout(deleteTemplateConfirmTimer.value);
  }

  persistLocalSettings();
});

defineExpose({
  refresh
});
</script>

<style>
:root {
  color-scheme: light;
  font-family: "Bahnschrift", "Aptos", "Microsoft YaHei UI", sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  min-height: 100%;
  background: #ffffff;
  overflow-y: auto;
}

body {
  min-height: 100vh;
  overflow-y: auto;
}

#psd-smart-suite-root {
  min-height: 100vh;
  overflow: visible;
}

.psd-smart-suite-shell {
  min-height: 100vh;
  padding: 14px;
  --psd-surface: rgba(255, 255, 255, 0.98);
  --psd-surface-soft: rgba(255, 255, 255, 0.98);
  --psd-surface-muted: rgba(248, 250, 252, 0.96);
  --psd-surface-warm: rgba(255, 255, 255, 0.98);
  --psd-border: rgba(148, 163, 184, 0.18);
  --psd-border-soft: rgba(148, 163, 184, 0.12);
  --psd-border-strong: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.22);
  --psd-border-stronger: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.34);
  --psd-ink-strong: #132238;
  --psd-ink: #334155;
  --psd-ink-soft: #64748b;
  --psd-shadow-card: 0 18px 36px rgba(15, 23, 42, 0.06);
  --psd-shadow-soft: 0 10px 22px rgba(15, 23, 42, 0.05);
  --psd-shadow-warm: 0 12px 28px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.12);
  --psd-primary: var(--theme-primary-color, #c89a35);
  --psd-primary-deep: var(--theme-primary-color-deep, #8f6d24);
}

.psd-smart-suite-section-card,
.psd-smart-suite-log-card {
  border-radius: 14px;
  background: var(--psd-surface-soft);
  border: 1px solid var(--psd-border);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  overflow: visible;
}

.psd-smart-suite-section-card--primary {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.18);
}

.psd-smart-suite-section-card :deep(.arco-card-header),
.psd-smart-suite-log-card :deep(.arco-card-header) {
  overflow: visible;
  padding: 16px 18px 12px;
  min-height: 0;
}

.psd-smart-suite-section-card :deep(.arco-card-header-title),
.psd-smart-suite-log-card :deep(.arco-card-header-title) {
  overflow: visible;
  white-space: normal;
  line-height: 1.2;
}

.psd-smart-suite-section-card :deep(.arco-card-body),
.psd-smart-suite-log-card :deep(.arco-card-body) {
  padding: 15px;
}

.psd-smart-suite-main {
  display: grid;
  gap: 14px;
  min-height: 0;
  align-content: start;
}

.psd-smart-suite-panel-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
}

.psd-smart-suite-panel-head--hero {
  padding: 2px 2px 0;
}

.psd-smart-suite-panel-divider {
  height: 1px;
  margin: 14px 0 16px;
  background: linear-gradient(90deg, rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16), rgba(148, 163, 184, 0.14) 36%, rgba(148, 163, 184, 0.08));
}

.psd-smart-suite-panel-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.psd-smart-suite-panel-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  color: var(--theme-primary-ink, #445468);
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16);
}

.psd-smart-suite-panel-copy {
  min-width: 0;
  padding-top: 2px;
}

.psd-smart-suite-panel-eyebrow {
  margin: 0 0 4px;
  color: var(--theme-primary-ink, #445468);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.2;
}

.psd-smart-suite-panel-copy h1 {
  margin: 0;
  color: var(--psd-ink-strong);
  font-size: 20px;
  line-height: 1.18;
}

.psd-smart-suite-panel-copy p {
  margin: 6px 0 0;
  color: var(--psd-ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.psd-smart-suite-panel-tags {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 420px;
  justify-self: end;
}

.psd-smart-suite-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.psd-smart-suite-section-head h2 {
  margin: 0;
  color: var(--psd-ink-strong);
  font-size: 18px;
}

.psd-smart-suite-section-head p {
  margin: 6px 0 0;
  color: var(--psd-ink-soft);
  font-size: 12px;
  line-height: 1.6;
}

.psd-smart-suite-section-head--mockups {
  margin-bottom: 4px;
}

.psd-smart-suite-section-divider {
  height: 1px;
  margin: 16px 0;
  background: linear-gradient(90deg, rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16), rgba(148, 163, 184, 0.14) 36%, rgba(148, 163, 184, 0.08));
}

.psd-smart-suite-toolbar-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.psd-smart-suite-toolbar-block {
  display: grid;
  gap: 12px;
  align-content: start;
  min-height: 100%;
  padding: 14px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.72);
  border: 1px solid var(--psd-border);
}

.psd-smart-suite-toolbar-block--template {
  gap: 10px;
  padding: 12px 14px;
}

.psd-smart-suite-inline-head {
  display: grid;
  gap: 4px;
}

.psd-smart-suite-inline-head--template {
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: 8px 12px;
}

.psd-smart-suite-inline-head strong {
  color: var(--psd-ink-strong);
  font-size: 14px;
}

.psd-smart-suite-inline-head span {
  color: var(--psd-ink-soft);
  font-size: 12px;
  line-height: 1.6;
}

.psd-smart-suite-inline-head--template span {
  line-height: 1.4;
}

.psd-smart-suite-template-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.psd-smart-suite-template-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1.15fr) auto auto minmax(180px, 0.95fr) auto auto;
  gap: 10px;
  align-items: center;
}

.psd-smart-suite-template-select,
.psd-smart-suite-template-name {
  min-width: 0;
}

.psd-smart-suite-flex-input {
  flex: 1 1 260px;
  min-width: 220px;
}

.psd-smart-suite-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.psd-smart-suite-field-block {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.psd-smart-suite-field-block--wide,
.psd-smart-suite-field-block--span-2 {
  grid-column: 1 / -1;
}

.psd-smart-suite-label-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.psd-smart-suite-label-row label {
  color: var(--psd-ink);
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-help-icon {
  color: #9aa8ba;
  font-size: 14px;
}

.psd-smart-suite-path-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.psd-smart-suite-path-row--multi {
  grid-template-columns: minmax(0, 1fr) auto auto auto;
}

.psd-smart-suite-path-row--dual-action {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.psd-smart-suite-path-row--dual-action :deep(.arco-btn) {
  min-width: 66px;
  padding: 0 12px;
}

.psd-smart-suite-summary-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 2px 2px 0;
}

.psd-smart-suite-summary-strip span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid var(--psd-border-soft);
  color: var(--psd-ink-soft);
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-mockup-list {
  display: grid;
  gap: 12px;
}

.psd-smart-suite-mockup-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid var(--psd-border);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.035);
}

.psd-smart-suite-mockup-card :deep(.arco-card-header) {
  border-bottom: 1px solid var(--psd-border-soft);
  padding-bottom: 12px;
  background: rgba(248, 250, 252, 0.42);
}

.psd-smart-suite-mockup-card :deep(.arco-card-body) {
  padding: 12px;
}

.psd-smart-suite-mockup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.psd-smart-suite-mockup-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.psd-smart-suite-mockup-title-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.psd-smart-suite-mockup-index {
  color: var(--psd-ink-strong);
  font-size: 15px;
  font-weight: 800;
}

.psd-smart-suite-mockup-note {
  color: var(--psd-ink-soft);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.psd-smart-suite-mockup-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.psd-smart-suite-mockup-grid .psd-smart-suite-field-block {
  padding: 10px 10px 11px;
  border-radius: 12px;
  background: transparent;
  border: 0;
  padding-left: 0;
  padding-right: 0;
  padding-bottom: 8px;
}

.psd-smart-suite-field-block--smart-object {
  grid-column: span 5;
}

.psd-smart-suite-field-block--rotation {
  grid-column: span 3;
}

.psd-smart-suite-field-block--replacement {
  grid-column: span 4;
}

.psd-smart-suite-field-block--subdir {
  grid-column: span 3;
}

.psd-smart-suite-field-block--export-mode {
  grid-column: span 3;
}

.psd-smart-suite-field-block--output-format {
  grid-column: span 3;
}

.psd-smart-suite-field-block--quality {
  grid-column: span 3;
}

.psd-smart-suite-field-block--quality :deep(.arco-input-number) {
  width: 100%;
}

.psd-smart-suite-field-block--quality :deep(.arco-input-number-mode-button) {
  width: 100%;
}

.psd-smart-suite-mockup-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed rgba(var(--theme-primary-rgb, 247, 181, 0), 0.18);
}

.psd-smart-suite-run-strip {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.68);
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.psd-smart-suite-run-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.psd-smart-suite-metric-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  min-height: 56px;
  padding: 7px 12px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid var(--psd-border);
  box-shadow: none;
  min-width: 0;
}

.psd-smart-suite-metric-card strong {
  color: var(--psd-ink-strong);
  font-size: 15px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.psd-smart-suite-metric-label {
  color: var(--psd-ink-soft);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.psd-smart-suite-run-toolbar {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr) minmax(180px, 220px) minmax(180px, 220px) minmax(180px, 220px);
  gap: 10px;
  align-items: end;
}

.psd-smart-suite-run-action {
  display: grid;
  align-items: center;
}

.psd-smart-suite-run-toolbar > .psd-smart-suite-run-tip,
.psd-smart-suite-run-toolbar > .psd-smart-suite-run-control {
  min-width: 0;
}

.psd-smart-suite-run-control {
  display: grid;
  gap: 6px;
  min-height: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  align-content: start;
}

.psd-smart-suite-run-control--switch {
  grid-template-rows: auto 1fr;
}

.psd-smart-suite-run-control-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.psd-smart-suite-run-control-head label {
  color: var(--psd-ink);
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-run-button {
  min-height: 44px;
  border-radius: 12px !important;
  font-weight: 800;
  font-size: 14px;
  min-width: 220px;
  width: auto;
  padding: 0 22px !important;
  background: linear-gradient(180deg, var(--psd-primary), var(--psd-primary-deep)) !important;
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.72) !important;
  color: var(--theme-primary-contrast, #ffffff) !important;
  box-shadow: 0 10px 20px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.14);
}

.psd-smart-suite-run-button.arco-btn-status-danger {
  background: linear-gradient(180deg, #ef4444, #dc2626) !important;
  border-color: rgba(239, 68, 68, 0.32) !important;
  box-shadow: 0 14px 28px rgba(239, 68, 68, 0.2);
}

.psd-smart-suite-run-button:deep(.arco-icon) {
  font-size: 16px;
}

.psd-smart-suite-switch-row {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid var(--psd-border-soft);
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.psd-smart-suite-run-tip {
  display: grid;
  gap: 4px;
  min-height: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid var(--psd-border-soft);
}

.psd-smart-suite-run-tip-label,
.psd-smart-suite-run-tip span {
  color: var(--psd-ink-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.psd-smart-suite-run-tip strong {
  color: var(--psd-ink-strong);
  font-size: 14px;
  line-height: 1.4;
}

.psd-smart-suite-run-progress {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid var(--psd-border-soft);
}

.psd-smart-suite-run-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.psd-smart-suite-run-progress-head span {
  color: var(--psd-ink-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.psd-smart-suite-run-progress-head strong {
  color: var(--psd-ink-strong);
  font-size: 13px;
  font-weight: 800;
}

.psd-smart-suite-run-progress-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.14);
}

.psd-smart-suite-run-progress-track span {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--theme-primary-color), var(--theme-primary-color-deep));
  transition: width 0.2s ease;
}

.psd-smart-suite-run-control :deep(.arco-select-view) {
  background: rgba(248, 250, 252, 0.92);
  min-height: 40px;
}

.psd-smart-suite-run-control :deep(.arco-select-view-single) {
  height: 40px;
  line-height: 40px;
}

.psd-smart-suite-run-control :deep(.arco-select-view-value),
.psd-smart-suite-run-control :deep(.arco-select-view-input) {
  line-height: 40px;
}

.psd-smart-suite-log-card {
  display: grid;
  align-content: start;
  min-height: 0;
}

.psd-smart-suite-log-card :deep(.arco-card-body) {
  display: grid;
  min-height: 0;
}

.psd-smart-suite-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.psd-smart-suite-log-head-copy {
  display: grid;
  gap: 4px;
}

.psd-smart-suite-log-head-copy h2 {
  margin: 0;
  color: var(--psd-ink-strong);
  font-size: 17px;
}

.psd-smart-suite-log-head-copy span {
  color: var(--psd-ink-soft);
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-log-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.psd-smart-suite-log-meta {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid var(--psd-border-soft);
  color: var(--psd-ink-soft);
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-log-meta.is-danger {
  color: #b42318;
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.14);
}

.psd-smart-suite-log {
  display: grid;
  align-content: start;
  gap: 0;
  min-height: 240px;
  max-height: 380px;
  overflow: auto;
  border: 1px solid var(--psd-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.psd-smart-suite-empty {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 20px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.52);
  color: var(--psd-ink-soft);
  font-size: 13px;
  text-align: center;
}

.psd-smart-suite-log-entry {
  display: grid;
  gap: 4px;
  padding: 9px 12px 10px;
  background: #ffffff;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
}

.psd-smart-suite-log-entry:last-child {
  border-bottom: 0;
}

.psd-smart-suite-log-entry.is-error {
  background: rgba(255, 241, 242, 0.72);
  color: #be123c;
}

.psd-smart-suite-log-entry.is-success {
  background: rgba(238, 251, 243, 0.76);
  color: #166534;
}

.psd-smart-suite-log-entry-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}

.psd-smart-suite-log-entry-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  color: var(--theme-primary-ink, #445468);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.psd-smart-suite-log-entry.is-error .psd-smart-suite-log-entry-badge {
  background: rgba(244, 63, 94, 0.12);
  color: #be123c;
}

.psd-smart-suite-log-entry.is-success .psd-smart-suite-log-entry-badge {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.psd-smart-suite-log-entry-time {
  color: var(--psd-ink-soft);
  font-size: 11px;
  font-weight: 700;
  min-width: 64px;
}

.psd-smart-suite-log-entry-text {
  color: inherit;
  word-break: break-word;
  padding-left: 2px;
}

.psd-smart-suite-shell :deep(.arco-input-wrapper),
.psd-smart-suite-shell :deep(.arco-select-view),
.psd-smart-suite-shell :deep(.arco-input-number) {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  border-color: var(--psd-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.psd-smart-suite-shell :deep(.arco-btn) {
  border-radius: 12px;
  font-weight: 700;
}

.psd-smart-suite-shell :deep(.arco-btn-secondary) {
  border-color: var(--psd-border);
  background: rgba(255, 255, 255, 0.9);
  color: var(--psd-ink);
}

.psd-smart-suite-shell :deep(.arco-btn-secondary:hover) {
  border-color: var(--psd-border-strong);
  background: #ffffff;
  color: var(--psd-ink-strong);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.psd-smart-suite-shell :deep(.arco-btn-primary) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.72);
  background: linear-gradient(180deg, var(--psd-primary), var(--psd-primary-deep));
  color: var(--theme-primary-contrast, #ffffff);
  box-shadow: 0 10px 22px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.16);
}

.psd-smart-suite-shell :deep(.arco-btn-primary:hover) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.82);
  background: linear-gradient(180deg, var(--psd-primary), var(--psd-primary-deep));
  color: var(--theme-primary-contrast, #ffffff);
}

.psd-smart-suite-shell :deep(.arco-btn-status-danger.arco-btn-secondary),
.psd-smart-suite-shell :deep(.arco-btn-status-danger.arco-btn-outline) {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.18);
  color: #b42318;
}

.psd-smart-suite-shell :deep(.arco-tag) {
  border-radius: 999px;
  font-weight: 700;
}

.psd-smart-suite-shell :deep(.arco-input-wrapper:hover),
.psd-smart-suite-shell :deep(.arco-select-view:hover),
.psd-smart-suite-shell :deep(.arco-input-number:hover) {
  border-color: var(--psd-border-strong);
}

.psd-smart-suite-shell :deep(.arco-input-wrapper-focus),
.psd-smart-suite-shell :deep(.arco-select-view.arco-select-view-focus),
.psd-smart-suite-shell :deep(.arco-input-number:focus-within) {
  border-color: var(--psd-border-stronger);
  box-shadow: 0 0 0 3px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
}

@media (max-width: 1260px) {
  .psd-smart-suite-run-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .psd-smart-suite-run-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 960px) {
  .psd-smart-suite-form-grid,
  .psd-smart-suite-mockup-grid {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-field-block--smart-object,
  .psd-smart-suite-field-block--rotation,
  .psd-smart-suite-field-block--replacement,
  .psd-smart-suite-field-block--subdir,
  .psd-smart-suite-field-block--export-mode,
  .psd-smart-suite-field-block--output-format,
  .psd-smart-suite-field-block--quality {
    grid-column: 1 / -1;
  }

  .psd-smart-suite-run-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .psd-smart-suite-run-toolbar {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-path-row,
  .psd-smart-suite-path-row--multi,
  .psd-smart-suite-path-row--dual-action,
  .psd-smart-suite-template-row,
  .psd-smart-suite-template-toolbar {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-template-row,
  .psd-smart-suite-template-toolbar {
    display: grid;
  }

  .psd-smart-suite-inline-head--template {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .psd-smart-suite-mockup-note {
    max-width: none;
  }

  .psd-smart-suite-flex-input {
    min-width: 0;
  }

  .psd-smart-suite-run-button {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 720px) {
  .psd-smart-suite-shell {
    padding: 12px;
  }

  .psd-smart-suite-section-card :deep(.arco-card-header),
  .psd-smart-suite-log-card :deep(.arco-card-header) {
    padding: 14px 14px 10px;
  }

  .psd-smart-suite-panel-head {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .psd-smart-suite-panel-head--hero {
    padding: 0;
  }

  .psd-smart-suite-panel-title {
    align-items: flex-start;
  }

  .psd-smart-suite-panel-tags {
    justify-content: flex-start;
    justify-self: start;
    max-width: none;
  }

  .psd-smart-suite-run-overview {
    grid-template-columns: 1fr;
  }
}
</style>

