<template>
  <a-modal
    :visible="visible"
    :footer="false"
    :mask-closable="false"
    width="940px"
    unmount-on-close
    @cancel="emit('close')"
  >
    <template #title>
      &#x5206;&#x7ec4;&#x7ba1;&#x7406;
    </template>

    <div class="shop-mgmt-group-layout">
      <section class="shop-mgmt-group-panel">
        <a-alert
          v-if="groupStatus.message"
          class="shop-mgmt-inline-status"
          :type="groupStatus.type"
          show-icon
        >
          {{ groupStatus.message }}
        </a-alert>

        <div class="shop-mgmt-group-create-bar">
          <div class="shop-mgmt-group-create-copy">
            <strong>&#x65b0;&#x589e;&#x5206;&#x7ec4;</strong>
            <span>&#x5efa;&#x597d;&#x540e;&#x53ef;&#x5728;&#x5e97;&#x94fa;&#x7f16;&#x8f91;&#x4e2d;&#x9009;&#x62e9;&#x5206;&#x7ec4;&#x3002;</span>
          </div>
          <form class="shop-mgmt-group-create-form" @submit.prevent="emit('submit-new-group')">
            <a-input
              :model-value="newGroupName"
              :max-length="32"
              allow-clear
              placeholder="&#x8f93;&#x5165;&#x65b0;&#x5206;&#x7ec4;&#x540d;&#x79f0;"
              @update:model-value="(value) => emit('update-new-group-name', value)"
            />
            <a-button html-type="submit" type="primary" :loading="groupSubmitting">
              <template #icon>
                <icon-plus />
              </template>
              &#x65b0;&#x589e;
            </a-button>
          </form>
        </div>

        <div class="shop-mgmt-group-list-head">
          <div>
            <strong>&#x5df2;&#x6709;&#x5206;&#x7ec4;</strong>
            <span>&#x53ef;&#x76f4;&#x63a5;&#x4fee;&#x6539;&#x540d;&#x79f0;&#x6216;&#x5220;&#x9664;&#x4e0d;&#x518d;&#x4f7f;&#x7528;&#x7684;&#x5206;&#x7ec4;</span>
          </div>
          <a-tag bordered size="small">{{ groups.length }} &#x4e2a;&#x5206;&#x7ec4;</a-tag>
        </div>

        <a-empty v-if="!groups.length" description="&#x6682;&#x65e0;&#x5206;&#x7ec4;" />

        <div v-else class="shop-mgmt-group-list-body">
          <div
            v-for="group in groups"
            :key="group.id"
            class="shop-mgmt-group-row"
          >
            <div class="shop-mgmt-group-row-badge">
              <span class="shop-mgmt-group-row-badge-num">{{ getGroupShopCount(group.id) }}</span>
              <span class="shop-mgmt-group-row-badge-unit">&#x5bb6;</span>
            </div>
            <div class="shop-mgmt-group-row-main">
              <a-input
                :model-value="groupDrafts[group.id]"
                :max-length="32"
                size="small"
                allow-clear
                placeholder="&#x5206;&#x7ec4;&#x540d;&#x79f0;"
                @update:model-value="(value) => emit('update-group-draft', { groupId: group.id, value })"
              />
              <span class="shop-mgmt-group-row-count">
                {{ getGroupShopCount(group.id) }} &#x5bb6;&#x5e97;&#x94fa;
              </span>
            </div>
            <div class="shop-mgmt-group-row-actions">
              <a-button
                size="small"
                :loading="groupSavingIds.has(group.id)"
                @click="emit('save-group', group)"
              >
                &#x4fdd;&#x5b58;
              </a-button>
              <a-popconfirm
                content="&#x5220;&#x9664;&#x540e;&#xff0c;&#x8be5;&#x5206;&#x7ec4;&#x4e0b;&#x7684;&#x5e97;&#x94fa;&#x4f1a;&#x79fb;&#x5230;&#x672a;&#x5206;&#x7ec4;&#x3002;"
                @ok="emit('delete-group', group)"
              >
                <a-button
                  size="small"
                  status="danger"
                  :loading="groupDeletingIds.has(group.id)"
                >
                  &#x5220;&#x9664;
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>

        <div class="shop-mgmt-group-footer">
          <a-button @click="emit('close')">
            &#x5173;&#x95ed;
          </a-button>
        </div>
      </section>
    </div>
  </a-modal>
</template>

<script setup>
import { IconPlus } from '@arco-design/web-vue/es/icon';

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  groups: {
    type: Array,
    default: () => []
  },
  newGroupName: {
    type: String,
    default: ''
  },
  groupDrafts: {
    type: Object,
    default: () => ({})
  },
  groupStatus: {
    type: Object,
    default: () => ({ type: 'info', message: '' })
  },
  groupSubmitting: {
    type: Boolean,
    default: false
  },
  groupSavingIds: {
    type: Object,
    default: () => new Set()
  },
  groupDeletingIds: {
    type: Object,
    default: () => new Set()
  },
  getGroupShopCount: {
    type: Function,
    default: () => 0
  }
});

const emit = defineEmits([
  'close',
  'submit-new-group',
  'save-group',
  'delete-group',
  'update-new-group-name',
  'update-group-draft'
]);
</script>
