<template>
  <section class="ops-gcs-view operations-module-workspace">
    <div class="ops-gcs-hero-card">
      <div class="ops-gcs-hero-copy">
        <p class="ops-gcs-eyebrow">运营工具</p>
        <h2 class="ops-gcs-title">全量同步类目</h2>
        <p class="ops-gcs-hint">
          同步前请确认浏览窗口里的店铺已进入卖家中心全球后台工作台；如果登录过程中出现验证码、授权或协议确认，请先在浏览窗口手动完成后再重试。
        </p>
      </div>

      <div class="ops-gcs-hero-actions">
        <button
          class="ops-gcs-button is-light"
          type="button"
          :disabled="loading || syncing"
          @click="handleRefresh"
        >
          刷新状态
        </button>
        <button
          class="ops-gcs-button is-primary"
          type="button"
          :disabled="syncing"
          @click="handleSync"
        >
          {{ syncing ? '同步中...' : '使用在线店铺一键同步' }}
        </button>
      </div>
    </div>

    <div v-if="loadingText" class="ops-gcs-banner is-info">{{ loadingText }}</div>
    <div v-if="noticeText" :class="['ops-gcs-banner', `is-${noticeTone}`]">{{ noticeText }}</div>
    <div v-if="snapshot.warning" class="ops-gcs-banner is-warn">{{ snapshot.warning }}</div>

    <div class="ops-gcs-metric-grid">
      <article class="ops-gcs-metric-card is-blue">
        <p class="ops-gcs-metric-label">缓存状态</p>
        <p class="ops-gcs-metric-value">{{ getSyncStatusLabel(snapshot) }}</p>
      </article>
      <article class="ops-gcs-metric-card is-gold">
        <p class="ops-gcs-metric-label">云端写入</p>
        <p class="ops-gcs-metric-value">{{ getCloudStatusLabel(snapshot) }}</p>
      </article>
      <article class="ops-gcs-metric-card is-slate">
        <p class="ops-gcs-metric-label">根类目</p>
        <p class="ops-gcs-metric-value">{{ snapshot.rootCount }}</p>
      </article>
      <article class="ops-gcs-metric-card is-green">
        <p class="ops-gcs-metric-label">总类目</p>
        <p class="ops-gcs-metric-value">{{ snapshot.totalCount }}</p>
      </article>
    </div>

    <div class="ops-gcs-detail-grid">
      <article class="ops-gcs-detail-card">
        <h3>同步结果</h3>
        <dl class="ops-gcs-detail-list">
          <div class="ops-gcs-detail-row">
            <dt>同步来源</dt>
            <dd>{{ getSourceLabel(snapshot.source) }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>使用店铺</dt>
            <dd>{{ shopDisplayName }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>Shop ID</dt>
            <dd>{{ snapshot.shopId || '暂无' }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>站点域名</dt>
            <dd>{{ snapshot.sourceOrigin || '暂无' }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>最近同步</dt>
            <dd>{{ formatTimestamp(snapshot.syncedAt) }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>更新时间</dt>
            <dd>{{ formatTimestamp(snapshot.updatedAt) }}</dd>
          </div>
        </dl>
      </article>

      <article class="ops-gcs-detail-card">
        <h3>类目统计</h3>
        <dl class="ops-gcs-detail-list">
          <div class="ops-gcs-detail-row">
            <dt>总请求次数</dt>
            <dd>{{ snapshot.requestCount }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>叶子类目</dt>
            <dd>{{ snapshot.leafCount }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>非叶子类目</dt>
            <dd>{{ snapshot.nonLeafCount }}</dd>
          </div>
          <div class="ops-gcs-detail-row">
            <dt>最大层级</dt>
            <dd>{{ snapshot.maxLevel }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import bridge from './bridge.js';

// ── 辅助函数（与原 View 保持完全一致） ──
function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function toUserFacingErrorMessage(error, fallbackMessage) {
  let message = normalizeText(error && error.message);

  if (!message) {
    return normalizeText(fallbackMessage);
  }

  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '');
  message = message.replace(/^Error:\s*/i, '');
  message = normalizeText(message);

  return message || normalizeText(fallbackMessage);
}

function normalizeIntegerValue(value, fallback = 0) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function buildEmptySnapshot() {
  return {
    updatedAt: '',
    syncedAt: '',
    shopId: '',
    shopName: '',
    sourceOrigin: '',
    source: 'default',
    cloudSynced: false,
    rootCount: 0,
    totalCount: 0,
    leafCount: 0,
    nonLeafCount: 0,
    maxLevel: 0,
    requestCount: 0,
    warning: ''
  };
}

function normalizeSnapshot(snapshot) {
  const source = normalizeText(snapshot && snapshot.source) || 'default';

  return {
    updatedAt: normalizeText(snapshot && snapshot.updatedAt),
    syncedAt: normalizeText(snapshot && snapshot.syncedAt),
    shopId: normalizeText(snapshot && snapshot.shopId),
    shopName: normalizeText(snapshot && snapshot.shopName),
    sourceOrigin: normalizeText(snapshot && snapshot.sourceOrigin),
    source,
    cloudSynced: snapshot && snapshot.cloudSynced === true,
    rootCount: normalizeIntegerValue(snapshot && snapshot.rootCount, 0),
    totalCount: normalizeIntegerValue(snapshot && snapshot.totalCount, 0),
    leafCount: normalizeIntegerValue(snapshot && snapshot.leafCount, 0),
    nonLeafCount: normalizeIntegerValue(snapshot && snapshot.nonLeafCount, 0),
    maxLevel: normalizeIntegerValue(snapshot && snapshot.maxLevel, 0),
    requestCount: normalizeIntegerValue(snapshot && snapshot.requestCount, 0),
    warning: normalizeText(snapshot && snapshot.warning)
  };
}

function formatTimestamp(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '暂无';
  }

  const timestamp = Date.parse(normalizedValue);

  if (!Number.isFinite(timestamp)) {
    return normalizedValue;
  }

  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function getSourceLabel(source) {
  const normalizedSource = normalizeText(source);
  if (normalizedSource === 'live-shop') return '在线店铺';
  if (normalizedSource === 'cache') return '已有缓存';
  if (normalizedSource === 'error') return '读取失败';
  return '待同步';
}

function getSyncStatusLabel(snap) {
  if (snap.totalCount > 0) return '已准备';
  return '待同步';
}

function getCloudStatusLabel(snap) {
  if (snap.syncedAt && snap.cloudSynced === true) return '已写入云端';
  if (snap.syncedAt && snap.warning) return '仅本地成功';
  if (snap.syncedAt) return '待确认';
  return '待同步';
}

// ── 响应式状态 ──
const snapshot = ref(buildEmptySnapshot());
const loading = ref(false);
const syncing = ref(false);
const loaded = ref(false);
const noticeText = ref('');
const noticeTone = ref('info');
let noticeTimer = 0;
let loadPromise = null;
let syncPromise = null;

const shopDisplayName = computed(() => {
  return snapshot.value.shopName || snapshot.value.shopId || '暂未记录';
});

const loadingText = computed(() => {
  if (syncing.value) {
    return '正在使用在线店铺全量同步类目，请稍候... 类目较多时可能需要 1-3 分钟，如果接口卡住会自动超时。';
  }
  if (loading.value) {
    return '正在刷新最新同步状态...';
  }
  return '';
});

function clearNoticeTimer() {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = 0;
  }
}

function showNotice(text, tone = 'info') {
  clearNoticeTimer();
  noticeText.value = normalizeText(text);
  noticeTone.value = normalizeText(tone) || 'info';

  if (noticeText.value) {
    noticeTimer = setTimeout(() => {
      noticeTimer = 0;
      noticeText.value = '';
    }, 4200);
  }
}

async function loadSnapshot(options = {}) {
  if (loading.value === true && loadPromise) {
    return loadPromise;
  }

  if (options.force !== true && loaded.value === true) {
    return snapshot.value;
  }

  loading.value = true;

  loadPromise = bridge.getSnapshot()
    .then((data) => {
      snapshot.value = normalizeSnapshot(data);
      loaded.value = true;
      return snapshot.value;
    })
    .catch((error) => {
      const errorMessage = toUserFacingErrorMessage(error, '读取类目同步状态失败。');
      showNotice(errorMessage, 'error');
      return snapshot.value;
    })
    .finally(() => {
      loading.value = false;
      loadPromise = null;
    });

  return loadPromise;
}

async function syncNow() {
  if (syncing.value === true && syncPromise) {
    return syncPromise;
  }

  syncing.value = true;

  syncPromise = bridge.syncFromOnlineShop({})
    .then((data) => {
      snapshot.value = normalizeSnapshot(data);
      loaded.value = true;
      const shop = snapshot.value.shopName || snapshot.value.shopId || '店铺';
      const resultMessage = snapshot.value.cloudSynced === true
        ? `已使用「${shop}」同步全量类目，共 ${snapshot.value.totalCount} 个类目。`
        : `已使用「${shop}」完成本地同步，但云端写入失败。`;
      showNotice(
        resultMessage,
        snapshot.value.cloudSynced === true ? 'success' : 'warn'
      );
      return snapshot.value;
    })
    .catch((error) => {
      const errorMessage = toUserFacingErrorMessage(error, '全量类目同步失败。');
      showNotice(errorMessage, 'error');
      return snapshot.value;
    })
    .finally(() => {
      syncing.value = false;
      syncPromise = null;
    });

  return syncPromise;
}

function handleRefresh() {
  loadSnapshot({ force: true });
}

function handleSync() {
  syncNow();
}

onMounted(() => {
  // 临时标记：用于确认新版 Vue 渲染是否生效
  // eslint-disable-next-line no-console
  console.log('[Vue3] 全量同步类目 已挂载', new Date().toISOString());
  loadSnapshot();
});

onUnmounted(() => {
  clearNoticeTimer();
});
</script>

<style scoped>
/* 样式由外部 operationsGlobalCategorySync.css 提供，组件中不重复定义 */
.ops-gcs-view {
  display: contents;
}
</style>
