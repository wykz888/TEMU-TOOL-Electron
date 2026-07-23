<template>
  <div class="shop-mgmt-table-shell">
    <a-table
      :columns="columns"
      :data="shops"
      :pagination="false"
      :bordered="false"
      row-key="id"
      size="small"
    >
      <template #account="{ record }">
        <div class="shop-mgmt-cell-title">{{ record.accountValue || '-' }}</div>
      </template>

      <template #shopName="{ record }">
        <div class="shop-mgmt-cell-title">{{ record.shopName || '-' }}</div>
      </template>

      <template #platformShopId="{ record }">
        <div class="shop-mgmt-cell-title shop-mgmt-cell-mono">
          {{ record.platformShopId || '--' }}
        </div>
      </template>

      <template #groupName="{ record }">
        <div class="shop-mgmt-cell-title">{{ record.groupName || fallbackGroupName }}</div>
      </template>

      <template #proxy="{ record }">
        <div class="shop-mgmt-proxy-cell">
          <div class="shop-mgmt-cell-title">{{ formatProxySummary(record.proxyConfig).title }}</div>
          <div class="shop-mgmt-cell-note">{{ formatProxySummary(record.proxyConfig).note }}</div>
        </div>
      </template>

      <template #visibility="{ record }">
        <div class="shop-mgmt-visibility-cell">
          <a-switch
            :model-value="record.isVisible !== false"
            size="small"
            :loading="visibilityBusyIds.has(record.id)"
            @change="(value) => emit('visibility-change', { record, value })"
          />
          <span
            class="shop-mgmt-visibility-text"
            :class="record.isVisible !== false ? 'is-active' : 'is-muted'"
          >
            {{ record.isVisible !== false ? '\u5f00\u542f' : '\u5173\u95ed' }}
          </span>
        </div>
      </template>

      <template #note="{ record }">
        <div class="shop-mgmt-cell-note">{{ record.note || '-' }}</div>
      </template>

      <template #actions="{ record }">
        <a-button class="shop-mgmt-edit-button" size="mini" @click="emit('edit-shop', record)">
          &#x7f16;&#x8f91;
        </a-button>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { formatProxySummary } from '../helpers';

defineProps({
  columns: {
    type: Array,
    default: () => []
  },
  shops: {
    type: Array,
    default: () => []
  },
  fallbackGroupName: {
    type: String,
    default: ''
  },
  visibilityBusyIds: {
    type: Object,
    default: () => new Set()
  }
});

const emit = defineEmits(['edit-shop', 'visibility-change']);
</script>
