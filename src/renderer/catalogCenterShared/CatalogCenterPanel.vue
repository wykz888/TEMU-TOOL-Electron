<template>
  <div class="catalog-center-app">
    <a-alert
      v-if="status.message"
      class="catalog-center-status"
      :type="status.type"
      show-icon
    >
      {{ status.message }}
    </a-alert>

    <div v-if="loading" class="catalog-center-loading">
      <a-spin size="large" />
    </div>

    <a-empty
      v-else-if="!entries.length"
      class="catalog-center-empty"
      :description="ui.emptyDescription"
    >
      <template #image>
        <icon-apps v-if="centerType !== 'creation'" />
        <icon-robot v-else />
      </template>
      <template #default>
        <div class="catalog-center-empty-title">{{ ui.emptyTitle }}</div>
      </template>
    </a-empty>

    <div v-else :class="centerType === 'creation' ? 'catalog-center-grid catalog-center-grid--fixed' : 'catalog-center-grid'">
      <a-card
        v-for="entry in entries"
        :key="entry.id"
        class="catalog-center-card"
        :class="{ 'is-disabled': !canOpenEntry(entry) }"
        :bordered="false"
      >
        <div class="catalog-center-card-content">
          <div class="catalog-center-card-icon">
            <component :is="getEntryIcon(entry)" />
          </div>

          <div class="catalog-center-card-copy">
            <div class="catalog-center-card-title-row">
              <h3>{{ entry.title || '-' }}</h3>
              <a-tag class="catalog-center-card-tag" bordered>
                {{ entry.tag || fallbackTag }}
              </a-tag>
            </div>
            <p>{{ entry.description || emptyDescription }}</p>
          </div>
        </div>

        <div class="catalog-center-card-footer">
          <a-button
            v-if="canOpenEntry(entry)"
            type="primary"
            size="small"
            class="catalog-center-action-button"
            :loading="openingEntryId === entry.id"
            @click="handleEntryAction(entry)"
          >
            <template #icon>
              <icon-launch />
            </template>
            {{ openingEntryId === entry.id ? ui.pendingLabel : resolveActionLabel(entry) }}
          </a-button>

          <a-button
            v-else
            size="small"
            class="catalog-center-action-button is-disabled"
            disabled
          >
            <template #icon>
              <icon-tool />
            </template>
            {{ ui.disabledLabel }}
          </a-button>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import {
  IconApps,
  IconBarChart,
  IconCalendar,
  IconCloud,
  IconCommand,
  IconCustomerService,
  IconFile,
  IconFileImage,
  IconGift,
  IconImage,
  IconLaunch,
  IconNotification,
  IconRobot,
  IconSend,
  IconStorage,
  IconTag,
  IconThunderbolt,
  IconTool
} from '@arco-design/web-vue/es/icon';
import { runCatalogAction } from './catalogCenterActions';
import { getCatalogCenterBridge } from './catalogCenterBridge';
import { getCatalogCenterConfig } from './catalogCenterConfig';
import {
  getCatalogReadyCount,
  normalizeCatalogEntries
} from './catalogCenterUtils';

const props = defineProps({
  centerType: {
    type: String,
    default: 'feature'
  }
});

const ui = getCatalogCenterConfig(props.centerType);
const entries = ref([]);
const loading = ref(true);
const openingEntryId = ref('');
const status = reactive({
  type: 'info',
  message: ''
});

const fallbackTag = computed(() => (
  props.centerType === 'creation'
    ? '\u521b\u4f5c'
    : '\u529f\u80fd'
));

const emptyDescription = computed(() => (
  props.centerType === 'creation'
    ? '\u521b\u4f5c\u80fd\u529b\u51c6\u5907\u4e2d'
    : '\u529f\u80fd\u80fd\u529b\u51c6\u5907\u4e2d'
));

const readyTotal = computed(() => getCatalogReadyCount(entries.value));

function setStatus(message, type = 'info') {
  status.message = String(message || '').trim();
  status.type = type;
}

function clearStatus() {
  setStatus('', 'info');
}

function normalizeUserError(error, fallbackMessage) {
  if (!error || !error.message || !String(error.message).trim()) {
    return fallbackMessage;
  }

  const raw = String(error.message).trim();

  if (/[\u4e00-\u9fff]/u.test(raw)) {
    return raw;
  }

  if (/session/i.test(raw) || /partition/i.test(raw) || /IPC/i.test(raw) || /electron/i.test(raw) || /preload/i.test(raw)) {
    return fallbackMessage;
  }

  if (/ERR_CONNECTION/i.test(raw) || /ECONNREFUSED/i.test(raw) || /ETIMEDOUT/i.test(raw) || /ENOTFOUND/i.test(raw)) {
    return '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002';
  }

  return fallbackMessage;
}

function getBridge() {
  return getCatalogCenterBridge(props.centerType);
}

function resolveActionLabel(entry) {
  return entry && entry.actionLabel
    ? String(entry.actionLabel)
    : ui.actionLabel;
}

function canOpenEntry(entry) {
  return Boolean(entry && entry.windowAction);
}

function getEntryIcon(entry) {
  const title = String(entry && entry.title || '').toLowerCase();
  const tag = String(entry && entry.tag || '').toLowerCase();
  const source = `${tag} ${title}`;

  if (source.includes('pod') && source.includes('套图')) {
    return IconImage;
  }
  if (source.includes('pod') && source.includes('表格')) {
    return IconFile;
  }
  if (source.includes('即梦') || source.includes('生图')) {
    return IconImage;
  }
  if (source.includes('标题') || source.includes('文案')) {
    return IconCommand;
  }
  if (source.includes('类目')) {
    return IconStorage;
  }
  if (source.includes('活动')) {
    return IconCalendar;
  }
  if (source.includes('流量')) {
    return IconThunderbolt;
  }
  if (source.includes('价格')) {
    return IconTag;
  }
  if (source.includes('上新')) {
    return IconSend;
  }
  if (source.includes('营销')) {
    return IconGift;
  }
  if (source.includes('推广')) {
    return IconNotification;
  }
  if (source.includes('数据')) {
    return IconBarChart;
  }
  if (source.includes('客服') || source.includes('消息')) {
    return IconCustomerService;
  }
  if (source.includes('创作') || source.includes('ai')) {
    return IconRobot;
  }
  if (source.includes('图片')) {
    return IconFileImage;
  }
  if (source.includes('类目') || source.includes('同步')) {
    return IconCloud;
  }

  return props.centerType === 'creation'
    ? IconRobot
    : IconApps;
}

async function refresh() {
  loading.value = true;
  clearStatus();

  try {
    const catalog = await getBridge()[
      props.centerType === 'creation'
        ? 'getCreationCatalog'
        : 'getFeatureCatalog'
    ]();

    entries.value = normalizeCatalogEntries(catalog);

    if (entries.value.length && readyTotal.value === 0) {
      setStatus('\u5f53\u524d\u6682\u65e0\u53ef\u6253\u5f00\u7684\u5165\u53e3\u3002', 'info');
    }
  } catch (error) {
    entries.value = [];
    const msg = normalizeUserError(error, '\u76ee\u5f55\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002');
    setStatus(msg, 'error');
    Message.error(msg);
  } finally {
    loading.value = false;
  }
}

async function handleEntryAction(entry) {
  if (!entry || !entry.windowAction || openingEntryId.value) {
    return;
  }

  openingEntryId.value = entry.id || entry.windowAction;
  clearStatus();

  try {
    await runCatalogAction(
      props.centerType,
      getBridge(),
      entry.windowAction
    );
  } catch (error) {
    const msg = normalizeUserError(error, '\u6253\u5f00\u5de5\u4f5c\u53f0\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002');
    setStatus(msg, 'error');
    Message.error(msg);
  } finally {
    openingEntryId.value = '';
  }
}

onMounted(() => {
  void refresh();
});

defineExpose({
  refresh
});
</script>

<style>
.catalog-center-app {
  display: grid;
  gap: 12px;
  min-height: 0;
  align-content: start;
}

.catalog-center-status {
  border-radius: 8px;
}

.catalog-center-loading,
.catalog-center-empty {
  min-height: 260px;
  display: grid;
  place-items: center;
}

.catalog-center-empty-title {
  margin-top: 10px;
  color: #132238;
  font-size: 16px;
  font-weight: 700;
}

.catalog-center-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(308px, 1fr));
  gap: 14px;
  align-items: stretch;
}

.catalog-center-grid--fixed {
  grid-template-columns: repeat(auto-fill, 308px);
}

.catalog-center-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 256px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.24);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.catalog-center-card:hover {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.42);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
  transform: translateY(-1px);
}

.catalog-center-card.is-disabled {
  opacity: 0.92;
}

.catalog-center-card :deep(.arco-card-body) {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  flex: 1;
  height: 100%;
  min-height: 256px;
  padding: 20px 18px 18px;
}

.catalog-center-card-content {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding-top: 6px;
}

.catalog-center-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 0;
}

.catalog-center-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 11px;
  color: var(--theme-primary-color-deep);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
}

.catalog-center-card-icon :deep(svg) {
  font-size: 20px;
}

.catalog-center-card-tag {
  margin-left: auto;
  padding: 0 10px;
  min-height: 26px;
  color: var(--theme-primary-color-deep);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.08);
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.22);
  border-radius: 999px;
  font-weight: 700;
}

.catalog-center-card-copy {
  display: grid;
  gap: 10px;
  align-content: start;
  min-width: 0;
  padding-top: 2px;
}

.catalog-center-card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.catalog-center-card-copy h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: #132238;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.38;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.catalog-center-card-copy p {
  margin: 0;
  color: #5f6f84;
  font-size: 13px;
  line-height: 1.65;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.catalog-center-action-button {
  width: auto;
  min-width: 112px;
  justify-content: center;
  min-height: 32px;
  padding: 0 14px;
  margin-left: 0;
  border-radius: 7px;
  font-weight: 700;
  font-size: 12px;
  color: #ffffff !important;
  background: linear-gradient(135deg, var(--theme-primary-color), var(--theme-primary-color-deep)) !important;
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.35) !important;
  box-shadow: 0 8px 18px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.catalog-center-action-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
  box-shadow: 0 6px 16px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.catalog-center-action-button:active {
  transform: translateY(0);
  filter: brightness(0.96);
  box-shadow: 0 1px 4px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.catalog-center-action-button :deep(.arco-btn-icon) {
  margin-right: 6px;
}

.catalog-center-action-button.is-disabled {
  color: #94a3b8;
  background: #f8fafc !important;
  border-color: rgba(226, 232, 240, 0.9) !important;
  box-shadow: none;
  transform: none;
  cursor: not-allowed;
}

body.dark-theme .catalog-center-card {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9));
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 14px 30px rgba(2, 6, 23, 0.22);
}

body.dark-theme .catalog-center-empty-title,
body.dark-theme .catalog-center-card-copy h3 {
  color: #e5eefc;
}

body.dark-theme .catalog-center-card-copy p {
  color: #94a3b8;
}

body.dark-theme .catalog-center-card-icon {
  color: #ffd18a;
  background: linear-gradient(180deg, rgba(255, 157, 60, 0.2), rgba(255, 157, 60, 0.1));
}

body.dark-theme .catalog-center-card-tag {
  background: rgba(30, 41, 59, 0.76);
  border-color: rgba(71, 85, 105, 0.52);
  color: #d8e1ee;
}

body.dark-theme .catalog-center-action-button.is-disabled {
  background: rgba(30, 41, 59, 0.82) !important;
  border-color: rgba(71, 85, 105, 0.42) !important;
  color: #8ea1b8;
}

@media (max-width: 780px) {
  .catalog-center-grid,
  .catalog-center-grid--fixed {
    grid-template-columns: 1fr;
  }

  .catalog-center-card-footer {
    justify-content: flex-end;
  }

  .catalog-center-action-button {
    width: auto;
    margin-left: 0;
  }
}
</style>
