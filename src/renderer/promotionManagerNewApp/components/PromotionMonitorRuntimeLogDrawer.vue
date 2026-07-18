<template>
  <a-drawer
    :visible="visible"
    :width="drawerWidth"
    :footer="false"
    :mask-closable="false"
    :esc-to-close="true"
    unmount-on-close
    class="pm-new-monitor-log-drawer"
    @cancel="$emit('close')"
  >
    <template #title>
      <div class="pm-new-monitor-log-drawer-title">
        <strong>{{ titleLabel }}</strong>
        <a-tag size="small" bordered>{{ totalCountText }}</a-tag>
      </div>
    </template>

    <section class="pm-new-monitor-runtime-log">
      <div class="pm-new-monitor-runtime-log-toolbar">
        <span>{{ transientHintLabel }}</span>
        <div class="pm-new-monitor-runtime-log-actions">
          <a-button
            type="outline"
            size="small"
            :loading="loading"
            @click="$emit('refresh')"
          >
            <template #icon>
              <IconRefresh />
            </template>
            {{ refreshLabel }}
          </a-button>
          <a-button
            type="outline"
            status="danger"
            size="small"
            :disabled="loading || entries.length <= 0"
            @click="$emit('clear')"
          >
            <template #icon>
              <IconDelete />
            </template>
            {{ clearLabel }}
          </a-button>
        </div>
      </div>

      <a-spin :loading="loading" class="pm-new-monitor-runtime-log-spin">
        <div
          v-if="entries.length > 0"
          class="pm-new-monitor-runtime-log-list"
        >
          <article
            v-for="entry in entries"
            :key="entry.id"
            class="pm-new-monitor-runtime-log-item"
            :class="`is-${entry.level || 'info'}`"
          >
            <div class="pm-new-monitor-runtime-log-item-head">
              <span class="pm-new-monitor-runtime-log-time">
                {{ formatLogTime(entry.time) }}
              </span>
              <a-tag
                class="pm-new-monitor-runtime-log-event"
                size="small"
                :color="resolveLevelColor(entry.level)"
                bordered
              >
                {{ entry.event || emptyText }}
              </a-tag>
            </div>
            <div
              class="pm-new-monitor-runtime-log-summary"
              :title="entry.summary"
            >
              {{ entry.summary || emptyText }}
            </div>
            <div
              v-if="buildMetaText(entry)"
              class="pm-new-monitor-runtime-log-meta"
              :title="buildMetaText(entry)"
            >
              {{ buildMetaText(entry) }}
            </div>
            <div
              v-if="entry.errorMessage"
              class="pm-new-monitor-runtime-log-error"
              :title="entry.errorMessage"
            >
              {{ entry.errorMessage }}
            </div>
          </article>
        </div>

        <div
          v-else
          class="pm-new-monitor-runtime-log-empty"
        >
          <a-empty :description="emptyLabel" />
        </div>
      </a-spin>
    </section>
  </a-drawer>
</template>

<script setup>
import {
  IconDelete,
  IconRefresh
} from '@arco-design/web-vue/es/icon';
import { computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  entries: {
    type: Array,
    default: () => []
  },
  totalCount: {
    type: Number,
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close', 'refresh', 'clear']);

const drawerWidth = 560;
const titleLabel = '\u8fd0\u884c\u65e5\u5fd7';
const transientHintLabel = '\u4ec5\u663e\u793a\u672c\u6b21\u8f6f\u4ef6\u8fd0\u884c\u4e2d\u7684\u76d1\u63a7\u65e5\u5fd7';
const refreshLabel = '\u5237\u65b0';
const clearLabel = '\u6e05\u7a7a';
const emptyLabel = '\u6682\u65e0\u8fd0\u884c\u65e5\u5fd7';
const countUnitLabel = '\u6761';
const emptyText = '-';

const totalCountText = computed(() => `${Math.max(0, Number(props.totalCount) || 0)} ${countUnitLabel}`);

function formatLogTime(value) {
  const timestamp = Date.parse(String(value || '').trim());

  if (!Number.isFinite(timestamp)) {
    return emptyText;
  }

  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function resolveLevelColor(level) {
  if (level === 'error') {
    return 'red';
  }

  if (level === 'warning') {
    return 'orange';
  }

  return 'blue';
}

function buildMetaText(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};

  return [
    source.shopName || source.shopId,
    source.regionLabel,
    source.actionLabel,
    source.goodsId ? `ID ${source.goodsId}` : ''
  ].filter(Boolean).join(' / ');
}
</script>
