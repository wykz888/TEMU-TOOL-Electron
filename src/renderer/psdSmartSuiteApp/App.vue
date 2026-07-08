<template>
  <div class="psd-smart-suite-shell">
    <header class="psd-smart-suite-header">
      <div class="psd-smart-suite-heading">
        <p class="psd-smart-suite-eyebrow">PSD</p>
        <h1>PSD智能套图</h1>
      </div>
      <div class="psd-smart-suite-header-side">
        <span class="psd-smart-suite-status" aria-live="polite">{{ statusLabel }}</span>
      </div>
    </header>

    <section class="psd-smart-suite-main">
      <section class="psd-smart-suite-panel">
        <!-- 面板头部：模板管理 -->
        <div class="psd-smart-suite-panel-head">
          <h2>
            <span class="psd-smart-suite-title-row">
              PSD智能套图
              <span class="psd-smart-suite-help" title="选择 PSD 样机和素材目录，批量替换智能对象后导出。">?</span>
            </span>
          </h2>
          <div class="psd-smart-suite-toolbar">
            <div class="psd-smart-suite-template-group">
              <select v-model="selectedTemplateId" class="psd-smart-suite-native-select">
                <option value="">新建模板</option>
                <option v-for="tpl in psdTemplates" :key="tpl.id" :value="tpl.id">
                  {{ tpl.name || '未命名模板' }}
                </option>
              </select>
              <button
                class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                type="button"
                :disabled="!selectedTemplateId"
                title="读取已选模板的路径和导出设置。"
                @click="loadSelectedTemplate"
              >
                套用模板
              </button>
              <button
                class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                type="button"
                title="从云端重新拉取已保存的 PSD 模板。"
                @click="syncCloudTemplates"
              >
                同步云端
              </button>
              <span class="psd-smart-suite-help" title="云端同步用于在不同设备之间共用 PSD 模板。">?</span>
            </div>
            <div class="psd-smart-suite-template-group psd-smart-suite-template-save">
              <input
                v-model="templateName"
                type="text"
                class="psd-smart-suite-native-input"
                placeholder="模板名称"
                title="填写当前 PSD 配置要保存的模板名称。"
              />
              <button
                class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                type="button"
                :disabled="!templateName.trim() || busy"
                title="把当前 PSD 路径、智能对象名称和导出设置保存成模板。"
                @click="saveTemplate"
              >
                保存模板
              </button>
              <button
                class="psd-smart-suite-btn psd-smart-suite-btn-secondary psd-smart-suite-btn-danger"
                type="button"
                :disabled="!selectedTemplateId"
                title="删除当前选中的 PSD 模板，需要连续点击两次确认。"
                @click="handleDeleteTemplate"
              >
                {{ deleteTemplateConfirmId === selectedTemplateId ? '确认删除' : '删除模板' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 素材配置区 -->
        <div class="psd-smart-suite-config">
          <!-- 素材目录 -->
          <label class="psd-smart-suite-field psd-smart-suite-field-wide">
            <span class="psd-smart-suite-field-label">
              素材目录
              <span class="psd-smart-suite-help" title="放需要套图的 PNG/JPG/WEBP 素材图。">?</span>
            </span>
            <div class="psd-smart-suite-picker-row">
              <input type="text" readonly class="psd-smart-suite-native-input" :value="config.psdImageDirectoryPath" placeholder="未选择" />
              <button class="psd-smart-suite-btn psd-smart-suite-btn-secondary" type="button" :disabled="busy" @click="selectImageDirectory">选择</button>
            </div>
          </label>

          <!-- 元数据来源 -->
          <label class="psd-smart-suite-field psd-smart-suite-field-wide">
            <span class="psd-smart-suite-field-label">
              元数据来源
              <span class="psd-smart-suite-help" title="可选单张真实原图，也可选一个真实原图目录。选目录时，每张导出图会随机复用目录里一张真实照片的 EXIF/ICC/XMP 等元数据。">?</span>
            </span>
            <div class="psd-smart-suite-picker-row">
              <input type="text" readonly class="psd-smart-suite-native-input" :value="config.psdMetadataSourcePath" placeholder="未选择" />
              <button class="psd-smart-suite-btn psd-smart-suite-btn-secondary" type="button" :disabled="busy" @click="selectMetadataFile">选图</button>
              <button class="psd-smart-suite-btn psd-smart-suite-btn-secondary" type="button" :disabled="busy" @click="selectMetadataDirectory">选目录</button>
              <button
                class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                type="button"
                :disabled="!config.psdMetadataSourcePath && !config.psdMetadataSourceDirectoryPath"
                @click="clearMetadataSource"
              >
                清空
              </button>
            </div>
          </label>

          <!-- Mockup 卡片列表 -->
          <div class="psd-smart-suite-mockup-list">
            <section
              v-for="(mockup, index) in mockups"
              :key="mockup.id"
              class="psd-smart-suite-mockup-card"
            >
              <div class="psd-smart-suite-mockup-card-head">
                <strong>PSD样机 {{ index + 1 }}</strong>
                <div class="psd-smart-suite-mockup-actions">
                  <button
                    class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                    type="button"
                    :disabled="busy"
                    @click="addMockup"
                  >
                    添加样机
                  </button>
                  <button
                    class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                    type="button"
                    :disabled="mockups.length <= 1 || busy"
                    @click="removeMockup(mockup.id)"
                  >
                    删除
                  </button>
                </div>
              </div>

              <div class="psd-smart-suite-mockup-fields">
                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    PSD选择
                    <span class="psd-smart-suite-help" title="选择包含智能对象的 PSD 样机文件。">?</span>
                  </span>
                  <div class="psd-smart-suite-picker-row">
                    <input type="text" readonly class="psd-smart-suite-native-input" :value="mockup.psdPath" placeholder="未选择PSD" />
                    <button
                      class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                      type="button"
                      :disabled="busy"
                      @click="selectMockupPsd(mockup.id)"
                    >
                      选择
                    </button>
                  </div>
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    智能对象名称
                    <span class="psd-smart-suite-help" title="需要替换的智能对象图层名，例如：插画#。">?</span>
                  </span>
                  <input
                    type="text"
                    class="psd-smart-suite-native-input"
                    :value="mockup.smartObjectName"
                    placeholder="插画#"
                    :disabled="busy"
                    @input="(e) => updateMockupField(mockup.id, 'smartObjectName', e.target.value)"
                  />
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    素材旋转
                    <span class="psd-smart-suite-help" title="先把素材图片向左或向右旋转90°，再按下方的素材放置方式进行套图。">?</span>
                  </span>
                  <select
                    class="psd-smart-suite-native-select"
                    :value="mockup.sourceRotation"
                    title="旋转会在素材放置方式之前生效。"
                    :disabled="busy"
                    @change="(e) => updateMockupField(mockup.id, 'sourceRotation', e.target.value)"
                  >
                    <option value="none">不旋转</option>
                    <option value="left">向左旋转90°</option>
                    <option value="right">向右旋转90°</option>
                  </select>
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    素材放置方式
                    <span class="psd-smart-suite-help" title="铺满画布(等比裁边)：保持比例铺满智能对象画布，超出的边会被裁掉。匹配画布尺寸：先把素材重采样到智能对象原画布宽高，适合比例一致的模板。按原图层边界(拉伸)：按智能对象内原可见图层边界拉伸素材。">?</span>
                  </span>
                  <select
                    class="psd-smart-suite-native-select"
                    :value="mockup.replacementMode"
                    title="铺满适合需要裁边的效果；匹配画布适合智能对象原尺寸替换；按原图层边界适合原图层不是满画布的 PSD。"
                    :disabled="busy"
                    @change="(e) => updateMockupField(mockup.id, 'replacementMode', e.target.value)"
                  >
                    <option value="cover-canvas">铺满画布(等比裁边)</option>
                    <option value="contain-canvas">匹配画布尺寸</option>
                    <option value="layer-bounds-transform">按原图层边界(拉伸)</option>
                  </select>
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    导出方式
                    <span class="psd-smart-suite-help" title="整图导出：每张素材输出一张完整样机；按参考线切片：按 PSD 水平参考线分图；按 PSD 切片标记：按 PSD 内切片矩形分图。切片模式只保留切片文件。">?</span>
                  </span>
                  <select
                    class="psd-smart-suite-native-select"
                    :value="mockup.exportMode"
                    title="整图导出的选项只保留完整样机；两种切片模式会按素材名新建文件夹，只保留切片图。"
                    :disabled="busy"
                    @change="(e) => updateMockupField(mockup.id, 'exportMode', e.target.value)"
                  >
                    <option value="original">整图导出</option>
                    <option value="guides">按参考线切片</option>
                    <option value="slices">按PSD切片标记</option>
                  </select>
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    导出主目录
                    <span class="psd-smart-suite-help" title="这个 PSD 样机会导出到此目录下的子目录中。">?</span>
                  </span>
                  <div class="psd-smart-suite-picker-row">
                    <input type="text" readonly class="psd-smart-suite-native-input" :value="mockup.outputDirectoryPath" placeholder="未选择" />
                    <button
                      class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                      type="button"
                      :disabled="busy"
                      @click="selectMockupOutputDirectory(mockup.id)"
                    >
                      选择
                    </button>
                    <button
                      class="psd-smart-suite-btn psd-smart-suite-btn-secondary"
                      type="button"
                      :disabled="!mockup.outputDirectoryPath"
                      @click="openMockupOutputDirectory(mockup.id)"
                    >
                      打开
                    </button>
                  </div>
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    子目录名称
                    <span class="psd-smart-suite-help" title="这个 PSD 样机的结果会导出到主目录下的这个文件夹。">?</span>
                  </span>
                  <input
                    type="text"
                    class="psd-smart-suite-native-input"
                    :value="mockup.outputSubdirName"
                    :disabled="busy"
                    @input="(e) => updateMockupField(mockup.id, 'outputSubdirName', e.target.value)"
                  />
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    导出格式
                    <span class="psd-smart-suite-help" title="这个 PSD 样机生成图片的文件格式。">?</span>
                  </span>
                  <select
                    class="psd-smart-suite-native-select"
                    :value="mockup.outputFormat"
                    :disabled="busy"
                    @change="(e) => updateMockupField(mockup.id, 'outputFormat', e.target.value)"
                  >
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    <option value="webp">WEBP</option>
                  </select>
                </label>

                <label class="psd-smart-suite-field">
                  <span class="psd-smart-suite-field-label">
                    图片质量
                    <span class="psd-smart-suite-help" title="整图导出时用于最终图；切片时中间长图保持无损，这里只影响切片文件。">?</span>
                  </span>
                  <input
                    type="number"
                    min="60"
                    max="100"
                    step="1"
                    class="psd-smart-suite-native-input psd-smart-suite-input-narrow"
                    :value="mockup.imageQuality"
                    :disabled="busy"
                    @input="(e) => updateMockupField(mockup.id, 'imageQuality', Number(e.target.value))"
                  />
                </label>
              </div>
            </section>
          </div>

          <!-- 操作栏 -->
          <div class="psd-smart-suite-actions">
            <button
              class="psd-smart-suite-btn psd-smart-suite-btn-primary"
              type="button"
              :disabled="busy && !psdRunning"
              @click="psdRunning ? cancelRun() : startRun()"
            >
              {{ psdRunning ? '取消套图' : '开始PSD套图' }}
            </button>
            <label class="psd-smart-suite-check-option" title="开启后，每张素材在替换智能对象前会先检查导出结果是否已存在，已存在就直接跳过。">
              <input type="checkbox" v-model="config.psdSkipExistingOutputs" :disabled="busy" />
              <span>已存在跳过</span>
            </label>
            <label class="psd-smart-suite-engine-mode">
              <span>引擎窗口</span>
              <select
                class="psd-smart-suite-native-select"
                v-model="config.psdEngineWindowMode"
                title="隐藏窗口会在后台执行；显示窗口便于观察引擎加载和替换流程。"
              >
                <option value="hidden">隐藏窗口</option>
                <option value="visible">显示窗口</option>
              </select>
            </label>
            <label class="psd-smart-suite-engine-mode">
              <span>引擎并发</span>
              <select
                class="psd-smart-suite-native-select"
                v-model.number="config.psdEngineConcurrency"
                title="单线程会按样机顺序执行；样机数并发倍数会把同一样机的素材分段多引擎执行，更快但更吃内存。"
              >
                <option v-for="opt in concurrencyOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </label>
            <span v-if="psdProgressSummary" class="psd-smart-suite-compact-summary" aria-live="polite">
              {{ psdProgressSummary }}
            </span>
          </div>
        </div>
      </section>

      <!-- 执行日志 -->
      <section class="psd-smart-suite-panel psd-smart-suite-log-panel">
        <div class="psd-smart-suite-panel-head">
          <h2>PSD执行日志</h2>
          <button class="psd-smart-suite-btn psd-smart-suite-btn-secondary" type="button" style="font-size:11px;padding:2px 10px;" @click="clearLog">清空</button>
        </div>
        <div ref="logContainer" class="psd-smart-suite-log">
          <div v-if="logs.length === 0" class="psd-smart-suite-empty">暂无日志，选择素材和PSD样机后点击"开始PSD套图"。</div>
          <div
            v-for="(entry, idx) in logs"
            :key="idx"
            :class="['psd-smart-suite-log-entry', entry.tone || '']"
          >
            {{ entry.text }}
          </div>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import bridge from './bridge.js';
import {
  ENGINE_CONCURRENCY_OPTIONS,
  MAX_PSD_ACTIVE_ENGINE_COUNT
} from './constants.js';

// ── 状态 ──
const busy = ref(false);
const psdRunning = ref(false);
const psdCanceling = ref(false);
const psdProgressSummary = ref('');
const selectedTemplateId = ref('');
const templateName = ref('');
const deleteTemplateConfirmId = ref('');
const deleteTemplateConfirmTimer = ref(0);
const psdTemplates = ref([]);
const config = reactive({
  psdImageDirectoryPath: '',
  psdMetadataSourcePath: '',
  psdMetadataSourceDirectoryPath: '',
  psdEngineWindowMode: 'hidden',
  psdEngineConcurrency: 2,
  psdSkipExistingOutputs: true
});
const mockups = ref([]);
const logs = ref([]);
const logContainer = ref(null);
let unsubscribeProgress = null;

const concurrencyOptions = ENGINE_CONCURRENCY_OPTIONS;

const psdImageFiles = ref([]);
const psdMetadataSourceFiles = ref([]);

const statusLabel = computed(() => {
  if (psdRunning.value) return 'PSD套图中...';
  return 'PSD智能套图';
});

// ── 工具函数 ──
function createEntityId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function clampConcurrency(val) {
  const n = Math.round(Number(val) || 2);
  return Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, n));
}

function normalizeText(v) {
  return String(v == null ? '' : v).trim();
}

function normalizePsdExportMode(v) {
  const m = normalizeText(v);
  return ['original', 'guides', 'slices'].includes(m) ? m : 'original';
}

function normalizePsdOutputFormat(v) {
  const f = normalizeText(v).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(f) ? f : 'png';
}

function normalizePsdImageQuality(v) {
  const q = Math.round(Number(v) || 100);
  return Math.max(60, Math.min(100, q));
}

function normalizeMockup(mockup, index) {
  return {
    id: mockup.id || createEntityId('psd_mockup'),
    psdPath: mockup.psdPath || '',
    smartObjectName: mockup.smartObjectName || '插画#',
    sourceRotation: ['left', 'right'].includes(mockup.sourceRotation) ? mockup.sourceRotation : 'none',
    replacementMode: ['cover-canvas', 'contain-canvas', 'layer-bounds-transform'].includes(mockup.replacementMode)
      ? mockup.replacementMode : 'cover-canvas',
    exportMode: normalizePsdExportMode(mockup.exportMode),
    outputDirectoryPath: mockup.outputDirectoryPath || '',
    outputSubdirName: normalizeText(mockup.outputSubdirName),
    outputFormat: normalizePsdOutputFormat(mockup.outputFormat),
    imageQuality: normalizePsdImageQuality(mockup.imageQuality)
  };
}

function ensureMockups() {
  if (!mockups.value || mockups.value.length === 0) {
    mockups.value = [normalizeMockup({})];
  }
  mockups.value = mockups.value.map((m, i) => normalizeMockup(m, i));
}

// ── 日志 ──
function addLog(text, tone = '') {
  logs.value.push({ text: String(text || ''), tone });
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

function clearLog() {
  logs.value = [];
}

// ── 模板操作 ──
async function loadTemplates() {
  try {
    const result = await bridge.getPsdSmartObjectTemplates({});
    if (result && Array.isArray(result.templates)) {
      psdTemplates.value = result.templates;
    }
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  }
}

function handleTemplateSelect() {
  templateName.value = '';
  deleteTemplateConfirmId.value = '';
}

async function loadSelectedTemplate() {
  if (!selectedTemplateId.value || busy.value) return;

  const template = psdTemplates.value.find((t) => t.id === selectedTemplateId.value);
  if (!template) return;

  busy.value = true;
  try {
    config.psdImageDirectoryPath = template.imageDirectoryPath || '';
    config.psdEngineConcurrency = clampConcurrency(template.engineConcurrency);
    config.psdEngineWindowMode = (template.engineWindowMode === 'visible') ? 'visible' : 'hidden';
    config.psdSkipExistingOutputs = template.skipExistingOutputs !== false;
    config.psdMetadataSourcePath = template.metadataSourcePath || '';
    config.psdMetadataSourceDirectoryPath = template.metadataSourceDirectoryPath || '';
    templateName.value = template.name || '';

    if (Array.isArray(template.mockups) && template.mockups.length) {
      mockups.value = template.mockups.map((m) => normalizeMockup(m));
    }

    if (config.psdImageDirectoryPath) {
      try {
        const result = await bridge.collectImageFiles({ directoryPath: config.psdImageDirectoryPath });
        if (result && Array.isArray(result.files)) {
          psdImageFiles.value = result.files;
        }
      } catch (_) {
        // ignore
      }
    }

    addLog(`已套用模板"${template.name || '未命名模板'}"。`);
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function saveTemplate() {
  if (!templateName.value.trim() || busy.value) return;

  busy.value = true;
  try {
    ensureMockups();
    const result = await bridge.savePsdSmartObjectTemplate({
      id: selectedTemplateId.value || undefined,
      name: templateName.value.trim(),
      imageDirectoryPath: config.psdImageDirectoryPath,
      engineConcurrency: config.psdEngineConcurrency,
      engineWindowMode: config.psdEngineWindowMode,
      skipExistingOutputs: config.psdSkipExistingOutputs,
      metadataSourcePath: config.psdMetadataSourcePath,
      metadataSourceDirectoryPath: config.psdMetadataSourceDirectoryPath,
      mockups: mockups.value.map((m) => normalizeMockup(m))
    });

    if (result && Array.isArray(result.templates)) {
      psdTemplates.value = result.templates;
      if (result.template && result.template.id) {
        selectedTemplateId.value = result.template.id;
        templateName.value = result.template.name || '';
      }
    }
    addLog('模板已保存。', 'success');
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function syncCloudTemplates() {
  if (busy.value) return;
  busy.value = true;
  try {
    await loadTemplates();
    addLog('模板已从云端同步。', 'success');
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function handleDeleteTemplate() {
  if (!selectedTemplateId.value || busy.value) return;

  if (deleteTemplateConfirmId.value !== selectedTemplateId.value) {
    deleteTemplateConfirmId.value = selectedTemplateId.value;
    if (deleteTemplateConfirmTimer.value) clearTimeout(deleteTemplateConfirmTimer.value);
    deleteTemplateConfirmTimer.value = setTimeout(() => {
      deleteTemplateConfirmId.value = '';
    }, 5000);
    return;
  }

  busy.value = true;
  try {
    const result = await bridge.deletePsdSmartObjectTemplate({ id: selectedTemplateId.value });
    if (result && Array.isArray(result.templates)) {
      psdTemplates.value = result.templates;
    }
    selectedTemplateId.value = '';
    templateName.value = '';
    deleteTemplateConfirmId.value = '';
    addLog('模板已删除。', 'success');
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

// ── 目录/文件选择 ──
async function selectImageDirectory() {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await bridge.selectPsdImageDirectory({
      defaultPath: config.psdImageDirectoryPath
    });
    if (!result || result.canceled) return;
    config.psdImageDirectoryPath = result.directoryPath || '';
    if (Array.isArray(result.files)) {
      psdImageFiles.value = result.files;
    }
    addLog(`已选择素材目录，共识别 ${psdImageFiles.value.length} 张图片。`);
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function selectMetadataFile() {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await bridge.selectPsdMetadataSourceFile({
      defaultPath: config.psdMetadataSourcePath
    });
    if (!result || result.canceled) return;
    config.psdMetadataSourcePath = result.filePath || '';
    config.psdMetadataSourceDirectoryPath = '';
    psdMetadataSourceFiles.value = [];
    addLog(`已选择元数据来源图片: ${config.psdMetadataSourcePath}`);
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function selectMetadataDirectory() {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await bridge.selectPsdMetadataSourceDirectory({
      defaultPath: config.psdMetadataSourceDirectoryPath
    });
    if (!result || result.canceled) return;
    config.psdMetadataSourceDirectoryPath = result.directoryPath || '';
    config.psdMetadataSourcePath = '';
    if (Array.isArray(result.files)) {
      psdMetadataSourceFiles.value = result.files;
    }
    addLog(`已选择元数据来源目录，共 ${psdMetadataSourceFiles.value.length} 张图片。`);
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

function clearMetadataSource() {
  config.psdMetadataSourcePath = '';
  config.psdMetadataSourceDirectoryPath = '';
  psdMetadataSourceFiles.value = [];
}

// ── Mockup 操作 ──
function addMockup() {
  mockups.value.push(normalizeMockup({}));
}

function removeMockup(id) {
  if (mockups.value.length <= 1) return;
  mockups.value = mockups.value.filter((m) => m.id !== id);
  ensureMockups();
}

function updateMockupField(id, field, value) {
  mockups.value = mockups.value.map((m) => {
    if (m.id !== id) return m;
    const updated = { ...m };
    if (typeof value === 'object' && value !== null && 'target' in value) {
      updated[field] = value.target.value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      updated[field] = value;
    } else {
      updated[field] = value;
    }
    return updated;
  });
}

async function selectMockupPsd(id) {
  if (busy.value) return;
  busy.value = true;
  try {
    const mockup = mockups.value.find((m) => m.id === id);
    const result = await bridge.selectPsdMockupFile({
      defaultPath: mockup ? mockup.psdPath : ''
    });
    if (!result || result.canceled) return;
    updateMockupField(id, 'psdPath', result.filePath || '');
    addLog(`已选择PSD样机: ${result.filePath}`);
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function selectMockupOutputDirectory(id) {
  if (busy.value) return;
  busy.value = true;
  try {
    const mockup = mockups.value.find((m) => m.id === id);
    const result = await bridge.selectPsdOutputDirectory({
      defaultPath: mockup ? mockup.outputDirectoryPath : ''
    });
    if (!result || result.canceled) return;
    updateMockupField(id, 'outputDirectoryPath', result.directoryPath || '');
    addLog(`已选择导出目录: ${result.directoryPath}`);
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    busy.value = false;
  }
}

async function openMockupOutputDirectory(id) {
  const mockup = mockups.value.find((m) => m.id === id);
  if (!mockup || !mockup.outputDirectoryPath) return;
  try {
    await bridge.openDirectory({ directoryPath: mockup.outputDirectoryPath });
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  }
}

// ── 执行套图 ──
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
    mockups: mockups.value.map((m) => normalizeMockup(m))
  };
}

async function startRun() {
  if (busy.value || psdRunning.value) return;
  ensureMockups();

  const hasValidMockup = mockups.value.some((m) => m.psdPath);
  if (!config.psdImageDirectoryPath || !hasValidMockup) {
    addLog('请先选择素材目录和至少一个 PSD 样机文件。', 'error');
    return;
  }

  if (!mockups.value.every((m) => m.outputDirectoryPath)) {
    addLog('请为每个样机设置导出目录。', 'error');
    return;
  }

  psdRunning.value = true;
  psdCanceling.value = false;
  psdProgressSummary.value = '';
  busy.value = true;
  clearLog();

  try {
    await bridge.setPsdEngineWindowVisible({
      visible: config.psdEngineWindowMode === 'visible'
    });

    const payload = buildRunPayload();
    addLog('任务已启动，等待引擎处理...');

    const result = await bridge.generatePsdSmartObjectMockups(payload);
    if (result && result.success !== false) {
      psdProgressSummary.value = `完成: 输入 ${result.totalInputCount || 0} 张, 导出 ${result.generatedCount || 0} 张, 失败 ${result.failedCount || 0} 张`;
      addLog(psdProgressSummary.value, result.failedCount ? '' : 'success');
    }
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    psdRunning.value = false;
    busy.value = false;
  }
}

async function cancelRun() {
  if (!psdRunning.value || psdCanceling.value) return;
  psdCanceling.value = true;
  try {
    await bridge.cancelPsdSmartObjectMockups({
      windowRunId: bridge.getWindowRunId()
    });
    addLog('已发送取消请求...');
  } catch (err) {
    addLog(String(err && err.message || err), 'error');
  } finally {
    psdCanceling.value = false;
  }
}

// ── 进度监听 ──
function handlePsdProgress(progress) {
  if (!progress) return;

  const phaseKeys = {
    start: '任务启动', 'collect-sources': '正在读取素材目录', 'sources-ready': '素材已读取',
    'mockup-start': '样机开始处理', 'mockup-prepare': '正在准备样机', 'mockup-local-parse': '正在识别PSD图层',
    'engine-start-wait': '等待引擎启动', 'engine-start': '引擎开始启动', 'mockup-loading': '正在打开PSD',
    'mockup-retry': '正在重新打开PSD', 'mockup-ready': 'PSD已载入', 'item-start': '素材开始处理',
    'smart-open': '正在打开智能对象', replace: '正在替换素材', export: '正在导出样机',
    'post-process-wait': '等待后处理队列', 'post-process': '正在处理导出图', 'post-process-drain': '正在等待切片保存完成',
    slice: '正在切片', 'write-output': '正在写入文件', 'item-skipped': '已存在，跳过',
    cleanup: '正在清理引擎缓存', 'item-retry': '素材超时重试', 'item-done': '素材已完成',
    'item-failed': '素材失败', 'mockup-done': '样机已完成', 'mockup-failed': '样机失败', complete: '任务完成'
  };

  const phaseLabel = phaseKeys[progress.phase] || progress.phase || '未知阶段';
  let msg = `[${phaseLabel}]`;

  if (progress.mockupIndex != null) {
    msg += ` 样机${progress.mockupIndex + 1}`;
  }
  if (progress.itemIndex != null && progress.totalItems != null) {
    msg += ` 素材${progress.itemIndex + 1}/${progress.totalItems}`;
  }
  if (progress.smartObjectName) {
    msg += ` (${progress.smartObjectName})`;
  }
  if (progress.message) {
    msg += ` ${progress.message}`;
  }

  const tone = ['item-failed', 'mockup-failed'].includes(progress.phase) ? 'error' : '';
  addLog(msg, tone);

  if (progress.phase === 'complete' && progress.summary) {
    psdProgressSummary.value = progress.summary;
  }
}

// ── 生命周期 ──
onMounted(() => {
  ensureMockups();
  loadTemplates();

  // 恢复上次保存的设置
  try {
    const saved = localStorage.getItem('psd-smart-suite-settings-v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.psdEngineConcurrency) config.psdEngineConcurrency = clampConcurrency(parsed.psdEngineConcurrency);
      if (parsed.psdEngineWindowMode) config.psdEngineWindowMode = parsed.psdEngineWindowMode === 'visible' ? 'visible' : 'hidden';
      if (parsed.psdSkipExistingOutputs !== undefined) config.psdSkipExistingOutputs = !!parsed.psdSkipExistingOutputs;
    }
  } catch (_) {
    // ignore
  }

  unsubscribeProgress = bridge.onPsdSmartObjectProgress(handlePsdProgress);
});

onUnmounted(() => {
  if (typeof unsubscribeProgress === 'function') {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }

  // 保存设置
  try {
    localStorage.setItem('psd-smart-suite-settings-v1', JSON.stringify({
      psdEngineConcurrency: config.psdEngineConcurrency,
      psdEngineWindowMode: config.psdEngineWindowMode,
      psdSkipExistingOutputs: config.psdSkipExistingOutputs
    }));
  } catch (_) {
    // ignore
  }
});
</script>

<style>
/* ── 从旧版 podSuiteTool.css 完整移植的样式，仅改类名前缀 ── */
:root {
  color-scheme: light;
  font-family: "Bahnschrift", "Aptos", "Microsoft YaHei UI", sans-serif;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  min-height: 100%;
  background: linear-gradient(180deg, #f6f8fb 0%, #e8eef5 100%);
}

body {
  min-height: 100vh;
  overflow: auto;
}

button, input, select {
  font: inherit;
}

/* ── Shell ── */
.psd-smart-suite-shell {
  display: grid;
  gap: 16px;
  min-height: 100vh;
  padding: 18px;
}

.psd-smart-suite-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 86px;
  padding: 18px 22px;
  border: 1px solid rgba(24, 40, 58, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 46px rgba(22, 37, 55, 0.08);
}

.psd-smart-suite-header-side {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  min-width: 0;
}

.psd-smart-suite-heading {
  display: grid;
  gap: 4px;
}

.psd-smart-suite-eyebrow {
  margin: 0;
  color: #8b5e24;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.psd-smart-suite-heading h1 {
  margin: 0;
  color: #16283b;
  font-size: 24px;
  line-height: 1.2;
}

.psd-smart-suite-status {
  min-height: 34px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(33, 79, 132, 0.09);
  color: #315a8d;
  font-size: 13px;
  font-weight: 800;
}

/* ── Main ── */
.psd-smart-suite-main {
  display: grid;
  gap: 16px;
}

/* ── Panel ── */
.psd-smart-suite-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid rgba(24, 40, 58, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 46px rgba(22, 37, 55, 0.08);
}

.psd-smart-suite-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.psd-smart-suite-panel-head h2 {
  margin: 0;
  color: #1a2a3d;
  font-size: 16px;
}

.psd-smart-suite-title-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.psd-smart-suite-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(36, 84, 133, 0.2);
  border-radius: 999px;
  background: #eff5fb;
  color: #39648f;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  cursor: help;
  user-select: none;
}

/* ── Field ── */
.psd-smart-suite-field {
  display: grid;
  gap: 7px;
}

.psd-smart-suite-field > span {
  color: #5e6e80;
  font-size: 12px;
  font-weight: 800;
}

.psd-smart-suite-field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #5e6e80;
  font-size: 12px;
  font-weight: 800;
}

.psd-smart-suite-picker-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.psd-smart-suite-field-wide {
  grid-column: 1 / -1;
}

/* ── Native Input / Select ── */
.psd-smart-suite-native-input {
  width: 100%;
  min-height: 38px;
  border: 1px solid rgba(35, 62, 92, 0.16);
  border-radius: 8px;
  padding: 0 10px;
  background: #f8fbfd;
  color: #1c2f44;
  font-size: 13px;
}

.psd-smart-suite-native-input[readonly] {
  color: #596b7f;
}

.psd-smart-suite-native-select {
  width: 100%;
  min-height: 38px;
  border: 1px solid rgba(35, 62, 92, 0.16);
  border-radius: 8px;
  padding: 0 10px;
  background: #f8fbfd;
  color: #1c2f44;
  font-size: 13px;
}

.psd-smart-suite-input-narrow {
  text-align: center;
}

/* ── Buttons ── */
.psd-smart-suite-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  border-radius: 8px;
  padding: 0 14px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  transition: background-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.psd-smart-suite-btn-primary {
  min-height: 44px;
  background: #b97427;
  color: #ffffff;
  box-shadow: 0 12px 26px rgba(165, 99, 28, 0.22);
}

.psd-smart-suite-btn-secondary {
  background: #edf4fb;
  color: #245485;
  border-color: rgba(36, 84, 133, 0.16);
}

.psd-smart-suite-btn-danger {
  background: #fef0ed;
  color: #b34336;
  border-color: rgba(201, 72, 52, 0.2);
}

.psd-smart-suite-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(19, 35, 54, 0.12);
}

.psd-smart-suite-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
  transform: none;
  box-shadow: none;
}

/* ── Toolbar ── */
.psd-smart-suite-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  justify-content: flex-end;
  min-width: 0;
}

.psd-smart-suite-template-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.psd-smart-suite-template-save {
  border-left: 1px solid rgba(35, 62, 92, 0.14);
  padding-left: 14px;
}

/* ── Config ── */
.psd-smart-suite-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

/* ── Mockup Cards ── */
.psd-smart-suite-mockup-list {
  display: grid;
  gap: 10px;
}

.psd-smart-suite-mockup-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(32, 61, 93, 0.12);
  border-radius: 8px;
  background: #f9fbfd;
}

.psd-smart-suite-mockup-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.psd-smart-suite-mockup-card-head strong {
  color: #1b3147;
  font-size: 13px;
}

.psd-smart-suite-mockup-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
}

.psd-smart-suite-mockup-fields {
  display: grid;
  grid-template-columns: minmax(250px, 1.35fr) minmax(150px, 0.75fr) minmax(190px, 0.95fr) minmax(116px, 0.52fr) minmax(96px, 0.42fr);
  gap: 10px;
  align-items: end;
}

/* ── Actions ── */
.psd-smart-suite-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
}

.psd-smart-suite-actions .psd-smart-suite-btn-primary {
  width: auto;
  min-width: 180px;
}

.psd-smart-suite-check-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  color: #43566b;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.psd-smart-suite-check-option input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
}

.psd-smart-suite-engine-mode {
  display: flex;
  align-items: center;
  gap: 8px;
}

.psd-smart-suite-engine-mode > span {
  color: #63788d;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.psd-smart-suite-engine-mode .psd-smart-suite-native-select {
  min-width: 128px;
}

.psd-smart-suite-compact-summary {
  color: #63788d;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

/* ── Log ── */
.psd-smart-suite-log-panel {
  min-height: 280px;
}

.psd-smart-suite-log {
  display: grid;
  align-content: start;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
}

.psd-smart-suite-empty {
  display: grid;
  place-items: center;
  min-height: 140px;
  border: 1px dashed rgba(48, 73, 99, 0.2);
  border-radius: 8px;
  color: #708295;
  font-size: 13px;
}

.psd-smart-suite-log-entry {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7fafc;
  color: #40566d;
  font-size: 13px;
  line-height: 1.5;
}

.psd-smart-suite-log-entry.error {
  background: #fff1ee;
  color: #9b3c2f;
}

.psd-smart-suite-log-entry.success {
  background: #eef8f2;
  color: #286b4d;
}

/* ── Responsive ── */
@media (max-width: 980px) {
  .psd-smart-suite-config,
  .psd-smart-suite-mockup-fields {
    grid-template-columns: 1fr;
  }

  .psd-smart-suite-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .psd-smart-suite-header-side {
    width: 100%;
    align-items: stretch;
    flex-direction: column;
  }

  .psd-smart-suite-toolbar {
    justify-content: flex-start;
  }

  .psd-smart-suite-template-group {
    width: 100%;
  }

  .psd-smart-suite-template-save {
    border-left: 0;
    padding-left: 0;
  }
}
</style>
