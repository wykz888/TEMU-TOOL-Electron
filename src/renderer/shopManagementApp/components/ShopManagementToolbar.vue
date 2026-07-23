<template>
  <header class="shop-mgmt-toolbar">
    <div class="shop-mgmt-head">
      <div>
        <h3>&#x5e97;&#x94fa;&#x5217;&#x8868;</h3>
      </div>
      <div class="shop-mgmt-head-actions">
        <a-tag class="shop-mgmt-count-tag" bordered>{{ shopCountText }}</a-tag>
        <a-button :loading="syncing" @click="emit('sync')">
          <template #icon>
            <icon-refresh />
          </template>
          &#x5237;&#x65b0;&#x5e97;&#x94fa;
        </a-button>
        <a-button @click="emit('open-groups')">
          <template #icon>
            <icon-folder-add />
          </template>
          &#x5206;&#x7ec4;&#x7ba1;&#x7406;
        </a-button>
        <a-button type="primary" @click="emit('create-shop')">
          <template #icon>
            <icon-plus />
          </template>
          &#x65b0;&#x589e;&#x5e97;&#x94fa;
        </a-button>
      </div>
    </div>
  </header>
</template>

<script setup>
import {
  IconFolderAdd,
  IconPlus,
  IconRefresh
} from '@arco-design/web-vue/es/icon';

defineProps({
  shopCountText: {
    type: String,
    default: ''
  },
  syncing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['sync', 'open-groups', 'create-shop']);
</script>
