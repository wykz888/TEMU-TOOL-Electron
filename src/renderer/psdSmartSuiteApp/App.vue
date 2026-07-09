<template>
  <div class="psd-smart-suite-shell">
    <a-card class="psd-smart-suite-hero" :bordered="false">
      <div class="psd-smart-suite-hero-main">
        <div class="psd-smart-suite-hero-copy">
          <div class="psd-smart-suite-hero-mark">
            <icon-file-image />
          </div>
          <div>
            <p class="psd-smart-suite-eyebrow">PSD SMART SUITE</p>
            <h1>PSD智能套图</h1>
            <p class="psd-smart-suite-hero-desc">
              统一管理素材目录、PSD样机和导出规则，按当前引擎配置批量执行套图。
            </p>
          </div>
        </div>

        <div class="psd-smart-suite-hero-side">
          <a-tag :color="statusTagColor" bordered>
            {{ statusLabel }}
          </a-tag>
          <a-tag color="arcoblue" bordered>
            样机 {{ mockups.length }}
          </a-tag>
          <a-tag color="gold" bordered>
            素材 {{ psdImageFiles.length }}
          </a-tag>
          <a-tag v-if="psdProgressSummary" color="green" bordered>
            {{ psdProgressSummary }}
          </a-tag>
        </div>
      </div>
    </a-card>

    <section class="psd-smart-suite-main">
      <div class="psd-smart-suite-workspace">
        <a-card class="psd-smart-suite-section-card" :bordered="false">
          <template #title>
            <div class="psd-smart-suite-section-head">
              <div>
                <h2>模板与素材</h2>
                <p>先准备模板，再配置素材目录和元数据来源。</p>
              </div>
            </div>
          </template>

          <div class="psd-smart-suite-toolbar-grid">
            <div class="psd-smart-suite-toolbar-block">
              <div class="psd-smart-suite-inline-head">
                <strong>模板管理</strong>
                <span>可复用当前样机、导出目录和导出设置。</span>
              </div>

              <div class="psd-smart-suite-template-row">
                <a-select
                  v-model="selectedTemplateId"
                  class="psd-smart-suite-flex-input"
                  placeholder="选择已保存模板"
                  allow-clear
                >
                  <a-option value="">新建模板</a-option>
                  <a-option
                    v-for="tpl in psdTemplates"
                    :key="tpl.id"
                    :value="tpl.id"
                  >
                    {{ tpl.name || '未命名模板' }}
                  </a-option>
                </a-select>
                <a-button :disabled="!selectedTemplateId" @click="loadSelectedTemplate">
                  套用模板
                </a-button>
                <a-button :loading="busy" @click="syncCloudTemplates">
                  同步云端
                </a-button>
              </div>

              <div class="psd-smart-suite-template-row">
                <a-input
                  v-model="templateName"
                  class="psd-smart-suite-flex-input"
                  placeholder="输入模板名称"
                  allow-clear
                />
                <a-button type="primary" :disabled="!templateName.trim() || busy" @click="saveTemplate">
                  保存模板
                </a-button>
                <a-button
                  status="danger"
                  :disabled="!selectedTemplateId || busy"
                  @click="handleDeleteTemplate"
                >
                  {{ deleteTemplateConfirmId === selectedTemplateId ? '确认删除' : '删除模板' }}
                </a-button>
              </div>
            </div>

            <div class="psd-smart-suite-toolbar-block">
              <div class="psd-smart-suite-inline-head">
                <strong>素材设置</strong>
                <span>素材目录支持 PNG、JPG、WEBP；元数据来源可选单图或目录。</span>
              </div>

              <div class="psd-smart-suite-form-grid">
                <div class="psd-smart-suite-field-block psd-smart-suite-field-block--wide">
                  <div class="psd-smart-suite-label-row">
                    <label>素材目录</label>
                    <a-tooltip content="放需要套图的 PNG、JPG、WEBP 素材图。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <div class="psd-smart-suite-path-row">
                    <a-input
                      :model-value="config.psdImageDirectoryPath"
                      readonly
                      placeholder="未选择素材目录"
                    />
                    <a-button :loading="busy" @click="selectImageDirectory">选择</a-button>
                  </div>
                </div>

                <div class="psd-smart-suite-field-block psd-smart-suite-field-block--wide">
                  <div class="psd-smart-suite-label-row">
                    <label>元数据来源</label>
                    <a-tooltip content="可选单张真实原图，也可选一个真实原图目录。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <div class="psd-smart-suite-path-row psd-smart-suite-path-row--multi">
                    <a-input
                      :model-value="metadataSourceDisplay"
                      readonly
                      placeholder="未选择元数据来源"
                    />
                    <a-button :loading="busy" @click="selectMetadataFile">选图</a-button>
                    <a-button :loading="busy" @click="selectMetadataDirectory">选目录</a-button>
                    <a-button
                      :disabled="!config.psdMetadataSourcePath && !config.psdMetadataSourceDirectoryPath"
                      @click="clearMetadataSource"
                    >
                      清空
                    </a-button>
                  </div>
                </div>
              </div>

              <div class="psd-smart-suite-summary-strip">
                <span>素材数量 {{ psdImageFiles.length }}</span>
                <span>元数据 {{ metadataSourceSummary }}</span>
                <span>模板 {{ psdTemplates.length }}</span>
              </div>
            </div>
          </div>
        </a-card>

        <a-card class="psd-smart-suite-section-card" :bordered="false">
          <template #title>
            <div class="psd-smart-suite-section-head">
              <div>
                <h2>样机配置</h2>
                <p>每个 PSD 样机独立设置旋转、放置方式和导出规则。</p>
              </div>
              <a-button type="primary" @click="addMockup" :disabled="busy">
                <template #icon>
                  <icon-plus />
                </template>
                添加样机
              </a-button>
            </div>
          </template>

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
                    <span class="psd-smart-suite-mockup-index">PSD样机 {{ index + 1 }}</span>
                    <a-tag :color="mockup.psdPath ? 'green' : 'gray'" bordered>
                      {{ mockup.psdPath ? '已选择PSD' : '待配置' }}
                    </a-tag>
                  </div>

                  <a-button
                    status="danger"
                    :disabled="mockups.length <= 1 || busy"
                    @click="removeMockup(mockup.id)"
                  >
                    删除
                  </a-button>
                </div>
              </template>

              <div class="psd-smart-suite-mockup-grid">
                <div class="psd-smart-suite-field-block psd-smart-suite-field-block--span-2">
                  <div class="psd-smart-suite-label-row">
                    <label>PSD样机文件</label>
                    <a-tooltip content="选择包含智能对象的 PSD 样机文件。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <div class="psd-smart-suite-path-row">
                    <a-input :model-value="mockup.psdPath" readonly placeholder="未选择 PSD 样机" />
                    <a-button :loading="busy" @click="selectMockupPsd(mockup.id)">选择</a-button>
                  </div>
                </div>

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>智能对象名称</label>
                    <a-tooltip content="需要替换的智能对象图层名，例如：插画#。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <a-input
                    :model-value="mockup.smartObjectName"
                    placeholder="插画#"
                    :disabled="busy"
                    @input="(value) => updateMockupField(mockup.id, 'smartObjectName', value)"
                  />
                </div>

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>素材旋转</label>
                    <a-tooltip content="先把素材图片向左或向右旋转 90°，再按素材放置方式进行套图。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <a-select
                    :model-value="mockup.sourceRotation"
                    :disabled="busy"
                    @change="(value) => updateMockupField(mockup.id, 'sourceRotation', value)"
                  >
                    <a-option value="none">不旋转</a-option>
                    <a-option value="left">向左旋转 90°</a-option>
                    <a-option value="right">向右旋转 90°</a-option>
                  </a-select>
                </div>

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>素材放置方式</label>
                    <a-tooltip content="铺满画布适合需要裁边的效果；匹配画布适合原始比例一致的模板；按原图层边界适合特殊版式。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <a-select
                    :model-value="mockup.replacementMode"
                    :disabled="busy"
                    @change="(value) => updateMockupField(mockup.id, 'replacementMode', value)"
                  >
                    <a-option value="cover-canvas">铺满画布(等比裁边)</a-option>
                    <a-option value="contain-canvas">匹配画布尺寸</a-option>
                    <a-option value="layer-bounds-transform">按原图层边界(拉伸)</a-option>
                  </a-select>
                </div>

                <div class="psd-smart-suite-field-block psd-smart-suite-field-block--span-2">
                  <div class="psd-smart-suite-label-row">
                    <label>导出主目录</label>
                    <a-tooltip content="当前 PSD 样机会导出到这个目录下。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <div class="psd-smart-suite-path-row">
                    <a-input
                      :model-value="mockup.outputDirectoryPath"
                      readonly
                      placeholder="未选择导出主目录"
                    />
                    <a-button :loading="busy" @click="selectMockupOutputDirectory(mockup.id)">选择</a-button>
                    <a-button
                      :disabled="!mockup.outputDirectoryPath"
                      @click="openMockupOutputDirectory(mockup.id)"
                    >
                      打开
                    </a-button>
                  </div>
                </div>

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>子目录名称</label>
                    <a-tooltip content="导出结果会存到导出主目录下的这个子目录。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <a-input
                    :model-value="mockup.outputSubdirName"
                    :disabled="busy"
                    placeholder="留空时按默认规则生成"
                    @input="(value) => updateMockupField(mockup.id, 'outputSubdirName', value)"
                  />
                </div>

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>导出方式</label>
                    <a-tooltip content="整图导出输出完整样机；两种切片模式只保留切片结果。">
                      <icon-question-circle class="psd-smart-suite-help-icon" />
                    </a-tooltip>
                  </div>
                  <a-select
                    :model-value="mockup.exportMode"
                    :disabled="busy"
                    @change="(value) => updateMockupField(mockup.id, 'exportMode', value)"
                  >
                    <a-option value="original">整图导出</a-option>
                    <a-option value="guides">按参考线切片</a-option>
                    <a-option value="slices">按PSD切片标记</a-option>
                  </a-select>
                </div>

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>导出格式</label>
                    <a-tooltip content="PNG 无损体积更大；JPG 和 WEBP 可配合质量控制文件大小。">
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

                <div class="psd-smart-suite-field-block">
                  <div class="psd-smart-suite-label-row">
                    <label>图片质量</label>
                    <a-tooltip content="整图导出时用于最终图；切片时中间长图保持无损，这里只影响最终切片文件。">
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
        </a-card>

        <a-card class="psd-smart-suite-section-card" :bordered="false">
          <template #title>
            <div class="psd-smart-suite-section-head">
              <div>
                <h2>运行控制</h2>
                <p>顶部只显示总进度，详细过程统一放到运行日志里。</p>
              </div>
            </div>
          </template>

          <div class="psd-smart-suite-run-grid">
            <div class="psd-smart-suite-run-main">
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
                {{ psdRunning ? '取消套图' : '开始PSD套图' }}
              </a-button>

              <label class="psd-smart-suite-switch-row">
                <span>已存在跳过</span>
                <a-switch v-model="config.psdSkipExistingOutputs" :disabled="busy" />
              </label>
            </div>

            <div class="psd-smart-suite-run-settings">
              <div class="psd-smart-suite-field-block">
                <div class="psd-smart-suite-label-row">
                  <label>引擎窗口</label>
                  <a-tooltip content="显示窗口便于观察引擎加载和替换流程，切换时会实时同步。">
                    <icon-question-circle class="psd-smart-suite-help-icon" />
                  </a-tooltip>
                </div>
                <a-select v-model="config.psdEngineWindowMode">
                  <a-option value="hidden">隐藏窗口</a-option>
                  <a-option value="visible">显示窗口</a-option>
                </a-select>
              </div>

              <div class="psd-smart-suite-field-block">
                <div class="psd-smart-suite-label-row">
                  <label>引擎并发</label>
                  <a-tooltip content="只有在你主动选择更高并发时，才会启用更多引擎并行处理。">
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
          </div>
        </a-card>
      </div>

      <a-card class="psd-smart-suite-log-card" :bordered="false">
        <template #title>
          <div class="psd-smart-suite-section-head">
            <div>
              <h2>运行日志</h2>
              <p>查看详细阶段、失败原因和完成统计。</p>
            </div>
            <a-button @click="clearLog">清空</a-button>
          </div>
        </template>

        <div class="psd-smart-suite-log-summary">
          <a-tag color="arcoblue" bordered>日志 {{ logs.length }}</a-tag>
          <a-tag color="green" bordered>当前 {{ currentProgressLabel }}</a-tag>
        </div>

        <div ref="logContainer" class="psd-smart-suite-log">
          <div v-if="logs.length === 0" class="psd-smart-suite-empty">
            暂无日志，选择素材和 PSD 样机后点击“开始PSD套图”。
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
            {{ entry.text }}
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
    tone
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
  busy.value = true;
  clearLog();

  try {
    await bridge.setPsdEngineWindowVisible({
      visible: config.psdEngineWindowMode === 'visible'
    });

    addLog('任务已启动，等待引擎处理...');

    const result = await bridge.generatePsdSmartObjectMockups(buildRunPayload());

    if (result && result.success !== false) {
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
    psdProgressSummary.value = `总进度 ${Math.min(progress.itemIndex != null ? progress.itemIndex + 1 : 0, progress.totalItems)}/${progress.totalItems}`;
  }

  const tone = ['item-failed', 'mockup-failed'].includes(progress.phase)
    ? 'error'
    : (progress.phase === 'complete' ? 'success' : '');
  addLog(message, tone);

  if (progress.phase === 'complete' && progress.summary) {
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
  min-height: 100%;
  background:
    radial-gradient(circle at top right, rgba(255, 214, 102, 0.18), transparent 32%),
    linear-gradient(180deg, #fffdf7 0%, #f7f9fc 36%, #eef2f7 100%);
}

body {
  min-height: 100vh;
}

#psd-smart-suite-root {
  min-height: 100vh;
}

.psd-smart-suite-shell {
  display: grid;
  gap: 16px;
  min-height: 100vh;
  padding: 18px;
}

.psd-smart-suite-hero,
.psd-smart-suite-section-card,
.psd-smart-suite-log-card {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06);
}

.psd-smart-suite-hero :deep(.arco-card-body),
.psd-smart-suite-section-card :deep(.arco-card-body),
.psd-smart-suite-log-card :deep(.arco-card-body) {
  padding: 18px;
}

.psd-smart-suite-hero-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.psd-smart-suite-hero-copy {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.psd-smart-suite-hero-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(247, 181, 0, 0.16), rgba(255, 93, 58, 0.14));
  color: #a95510;
  font-size: 22px;
  flex-shrink: 0;
}

.psd-smart-suite-eyebrow {
  margin: 0 0 6px;
  color: #b26d09;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.psd-smart-suite-hero-copy h1 {
  margin: 0;
  color: #132238;
  font-size: 24px;
  line-height: 1.25;
}

.psd-smart-suite-hero-desc {
  margin: 8px 0 0;
  color: #5f6f84;
  font-size: 13px;
  line-height: 1.7;
}

.psd-smart-suite-hero-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.psd-smart-suite-main {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.78fr);
  gap: 16px;
  min-height: 0;
}

.psd-smart-suite-workspace {
  display: grid;
  gap: 16px;
  min-height: 0;
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
  color: #132238;
  font-size: 18px;
}

.psd-smart-suite-section-head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.psd-smart-suite-toolbar-grid {
  display: grid;
  gap: 14px;
}

.psd-smart-suite-toolbar-block {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.psd-smart-suite-inline-head {
  display: grid;
  gap: 4px;
}

.psd-smart-suite-inline-head strong {
  color: #132238;
  font-size: 14px;
}

.psd-smart-suite-inline-head span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.psd-smart-suite-template-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-help-icon {
  color: #94a3b8;
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

.psd-smart-suite-summary-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 2px 2px 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.psd-smart-suite-mockup-list {
  display: grid;
  gap: 14px;
}

.psd-smart-suite-mockup-card {
  border-radius: 16px;
  background: #fbfdff;
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.psd-smart-suite-mockup-card :deep(.arco-card-header) {
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  padding-bottom: 14px;
}

.psd-smart-suite-mockup-card :deep(.arco-card-body) {
  padding: 16px;
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

.psd-smart-suite-mockup-index {
  color: #132238;
  font-size: 15px;
  font-weight: 800;
}

.psd-smart-suite-mockup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.psd-smart-suite-mockup-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.psd-smart-suite-run-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.psd-smart-suite-run-main,
.psd-smart-suite-run-settings {
  display: grid;
  gap: 12px;
}

.psd-smart-suite-run-button {
  min-height: 48px;
  border-radius: 14px !important;
  font-weight: 700;
}

.psd-smart-suite-switch-row {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.92);
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.psd-smart-suite-log-card {
  display: grid;
  align-content: start;
  min-height: 0;
}

.psd-smart-suite-log-card :deep(.arco-card-body) {
  display: grid;
  gap: 12px;
  min-height: 0;
}

.psd-smart-suite-log-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.psd-smart-suite-log {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 480px;
  max-height: calc(100vh - 220px);
  overflow: auto;
  padding-right: 2px;
}

.psd-smart-suite-empty {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 20px;
  border-radius: 14px;
  border: 1px dashed rgba(148, 163, 184, 0.3);
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  text-align: center;
}

.psd-smart-suite-log-entry {
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.9);
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.psd-smart-suite-log-entry.is-error {
  background: #fff1f2;
  border-color: rgba(251, 113, 133, 0.18);
  color: #be123c;
}

.psd-smart-suite-log-entry.is-success {
  background: #eefbf3;
  border-color: rgba(34, 197, 94, 0.16);
  color: #166534;
}

.psd-smart-suite-shell :deep(.arco-input-wrapper),
.psd-smart-suite-shell :deep(.arco-select-view),
.psd-smart-suite-shell :deep(.arco-input-number) {
  border-radius: 12px;
}

.psd-smart-suite-shell :deep(.arco-btn) {
  border-radius: 12px;
  font-weight: 700;
}

@media (max-width: 1260px) {
  .psd-smart-suite-main {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-log {
    min-height: 300px;
    max-height: 420px;
  }
}

@media (max-width: 960px) {
  .psd-smart-suite-form-grid,
  .psd-smart-suite-mockup-grid,
  .psd-smart-suite-run-grid {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-path-row,
  .psd-smart-suite-path-row--multi {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-template-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-flex-input {
    min-width: 0;
  }
}

@media (max-width: 720px) {
  .psd-smart-suite-shell {
    padding: 12px;
  }

  .psd-smart-suite-hero-main,
  .psd-smart-suite-hero-copy {
    align-items: flex-start;
  }

  .psd-smart-suite-hero-side {
    justify-content: flex-start;
  }
}
</style>
