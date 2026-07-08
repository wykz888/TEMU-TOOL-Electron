<template>
  <div class="shop-mgmt-app-shell">
    <a-card class="shop-mgmt-card" :bordered="false">
      <header class="shop-mgmt-toolbar">
        <div class="shop-mgmt-head">
          <div>
            <h3>&#x5e97;&#x94fa;&#x5217;&#x8868;</h3>
          </div>
          <div class="shop-mgmt-head-actions">
            <a-tag class="shop-mgmt-count-tag" bordered>{{ shopCountText }}</a-tag>
            <a-button :loading="syncing" @click="syncCloudState">
              <template #icon>
                <icon-refresh />
              </template>
              &#x5237;&#x65b0;&#x5e97;&#x94fa;
            </a-button>
            <a-button @click="openGroupModal">
              <template #icon>
                <icon-folder-add />
              </template>
              &#x5206;&#x7ec4;&#x7ba1;&#x7406;
            </a-button>
            <a-button type="primary" @click="openCreateShopModal">
              <template #icon>
                <icon-plus />
              </template>
              &#x65b0;&#x589e;&#x5e97;&#x94fa;
            </a-button>
          </div>
        </div>
      </header>

      <a-alert
        v-if="pageStatus.message"
        class="shop-mgmt-status"
        :type="pageStatus.type"
        show-icon
      >
        {{ pageStatus.message }}
      </a-alert>

      <div v-if="loading" class="shop-mgmt-loading">
        <a-spin size="large" />
      </div>

      <a-empty v-else-if="!shops.length" description="&#x6682;&#x65e0;&#x5e97;&#x94fa;&#x6570;&#x636e;" />

      <div v-else class="shop-mgmt-table-shell">
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
                @change="(value) => handleShopVisibilityChange(record, value)"
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
            <a-button class="shop-mgmt-edit-button" size="mini" @click="openEditShopModal(record)">
              &#x7f16;&#x8f91;
            </a-button>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal
      :visible="groupModalVisible"
      :footer="false"
      :mask-closable="false"
      width="940px"
      unmount-on-close
      @cancel="closeGroupModal"
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
            <form class="shop-mgmt-group-create-form" @submit.prevent="submitNewGroup">
              <a-input
                v-model="newGroupName"
                :max-length="32"
                allow-clear
                placeholder="&#x8f93;&#x5165;&#x65b0;&#x5206;&#x7ec4;&#x540d;&#x79f0;"
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
                  v-model="groupDrafts[group.id]"
                  :max-length="32"
                  size="small"
                  allow-clear
                  placeholder="&#x5206;&#x7ec4;&#x540d;&#x79f0;"
                />
                <span class="shop-mgmt-group-row-count">
                  {{ getGroupShopCount(group.id) }} &#x5bb6;&#x5e97;&#x94fa;
                </span>
              </div>
              <div class="shop-mgmt-group-row-actions">
                <a-button
                  size="small"
                  :loading="groupSavingIds.has(group.id)"
                  @click="saveGroup(group)"
                >
                  &#x4fdd;&#x5b58;
                </a-button>
                <a-popconfirm
                  content="&#x5220;&#x9664;&#x540e;&#xff0c;&#x8be5;&#x5206;&#x7ec4;&#x4e0b;&#x7684;&#x5e97;&#x94fa;&#x4f1a;&#x79fb;&#x5230;&#x672a;&#x5206;&#x7ec4;&#x3002;"
                  @ok="deleteGroup(group)"
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
            <a-button @click="closeGroupModal">
              &#x5173;&#x95ed;
            </a-button>
          </div>
        </section>
      </div>
    </a-modal>

    <a-modal
      :visible="shopModalVisible"
      :footer="false"
      width="1120px"
      unmount-on-close
      @cancel="closeShopModal"
    >
      <template #title>
        {{ shopModalMode === 'edit' ? '\u7f16\u8f91\u5e97\u94fa' : '\u65b0\u589e\u5e97\u94fa' }}
      </template>

      <a-alert
        v-if="shopStatus.message"
        class="shop-mgmt-inline-status"
        :type="shopStatus.type"
        show-icon
      >
        {{ shopStatus.message }}
      </a-alert>

      <form class="shop-mgmt-form-layout" @submit.prevent="submitShopForm">
        <a-card class="shop-mgmt-form-card" :bordered="false">
          <template #title>
            &#x57fa;&#x7840;&#x4fe1;&#x606f;
          </template>

          <a-form layout="vertical" class="shop-mgmt-form-grid">
            <a-form-item label="&#x624b;&#x673a;&#x53f7;/&#x90ae;&#x7bb1;&#x8d26;&#x53f7;">
              <a-input
                v-model="shopForm.accountValue"
                :max-length="64"
                allow-clear
                placeholder="&#x8bf7;&#x8f93;&#x5165;&#x624b;&#x673a;&#x53f7;&#x6216;&#x90ae;&#x7bb1;"
              />
            </a-form-item>

            <a-form-item label="&#x5e97;&#x94fa;&#x540d;&#x79f0;">
              <a-input
                v-model="shopForm.shopName"
                :max-length="80"
                allow-clear
                placeholder="&#x8bf7;&#x8f93;&#x5165;&#x5e97;&#x94fa;&#x540d;&#x79f0;"
              />
            </a-form-item>

            <a-form-item label="&#x5e73;&#x53f0;&#x5e97;&#x94fa;ID">
              <a-input
                v-model="shopForm.platformShopId"
                readonly
                placeholder="&#x767b;&#x5f55;&#x540e;&#x81ea;&#x52a8;&#x5173;&#x8054;"
              />
            </a-form-item>

            <a-form-item label="&#x767b;&#x5f55;&#x5bc6;&#x7801;">
              <a-input-password
                v-model="shopForm.loginPassword"
                :max-length="128"
                placeholder="&#x8bf7;&#x8f93;&#x5165;&#x767b;&#x5f55;&#x5bc6;&#x7801;"
              />
            </a-form-item>

            <a-form-item label="&#x5e97;&#x94fa;&#x5206;&#x7ec4;">
              <a-select
                v-model="shopForm.groupId"
                :options="groupOptions"
                allow-clear
                placeholder="&#x8bf7;&#x9009;&#x62e9;&#x5206;&#x7ec4;"
              />
            </a-form-item>

            <a-form-item class="shop-mgmt-span-2" label="&#x5e97;&#x94fa;&#x5907;&#x6ce8;">
              <a-textarea
                v-model="shopForm.note"
                :max-length="200"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder="&#x8bf7;&#x8f93;&#x5165;&#x5e97;&#x94fa;&#x5907;&#x6ce8;"
              />
            </a-form-item>
          </a-form>

          <div class="shop-mgmt-toggle-row">
            <div class="shop-mgmt-toggle-card">
              <div>
                <strong>&#x5173;&#x95ed;&#x5e97;&#x94fa;</strong>
                <p>&#x5173;&#x95ed;&#x540e;&#xff0c;&#x8be5;&#x5e97;&#x94fa;&#x4e0d;&#x518d;&#x53c2;&#x4e0e;&#x5404;&#x7c7b;&#x4efb;&#x52a1;&#x3002;</p>
              </div>
              <a-switch v-model="shopForm.isVisible" />
            </div>

            <div class="shop-mgmt-toggle-card">
              <div>
                <strong>&#x6d4f;&#x89c8;&#x5668;&#x5b58;&#x50a8;&#x81ea;&#x52a8;&#x540c;&#x6b65;</strong>
                <p>&#x9996;&#x6b21;&#x8fdb;&#x5165;&#x5de5;&#x4f5c;&#x533a;&#x65f6;&#x4f1a;&#x6062;&#x590d;&#x4e91;&#x7aef;&#x5feb;&#x7167;&#x3002;</p>
              </div>
              <a-switch v-model="shopForm.browserStorageAutoSyncEnabled" />
            </div>
          </div>
        </a-card>

        <a-card class="shop-mgmt-form-card" :bordered="false">
          <template #title>
            &#x4ee3;&#x7406;&#x8bbe;&#x7f6e;
          </template>

          <a-form layout="vertical" class="shop-mgmt-form-grid">
            <a-form-item label="&#x4ee3;&#x7406; IP &#x914d;&#x7f6e;">
              <a-select
                v-model="shopForm.proxyType"
                :options="proxyTypeOptions"
                @change="handleProxyTypeChange"
              />
            </a-form-item>

            <template v-if="shopForm.proxyType !== 'local'">
              <a-form-item label="IP &#x5730;&#x5740;">
                <a-input v-model="shopForm.proxyHost" :max-length="128" allow-clear />
              </a-form-item>

              <a-form-item label="&#x7aef;&#x53e3;">
                <a-input v-model="shopForm.proxyPort" :max-length="8" allow-clear />
              </a-form-item>

              <a-form-item label="&#x7528;&#x6237;&#x8d26;&#x53f7;">
                <a-input v-model="shopForm.proxyUsername" :max-length="64" allow-clear />
              </a-form-item>

              <a-form-item label="&#x7528;&#x6237;&#x5bc6;&#x7801;">
                <a-input-password v-model="shopForm.proxyPassword" :max-length="128" />
              </a-form-item>

              <a-form-item class="shop-mgmt-span-2" label="&#x4ee3;&#x7406;&#x76f4;&#x8fde;&#x89c4;&#x5219;">
                <a-textarea
                  v-model="shopForm.proxyBypassRules"
                  :auto-size="{ minRows: 3, maxRows: 5 }"
                  placeholder=".temu.com&#10;seller.temu.com&#10;192.168.0.0/16"
                />
              </a-form-item>

              <a-form-item class="shop-mgmt-span-2" label="&#x9759;&#x6001;&#x8d44;&#x6e90;&#x672c;&#x5730;&#x76f4;&#x8fde;">
                <div class="shop-mgmt-checkbox-row">
                  <a-checkbox v-model="directResourceTypes.script">JS</a-checkbox>
                  <a-checkbox v-model="directResourceTypes.style">CSS</a-checkbox>
                  <a-checkbox v-model="directResourceTypes.font">&#x5b57;&#x4f53;</a-checkbox>
                  <a-checkbox v-model="directResourceTypes.image">&#x56fe;&#x7247;</a-checkbox>
                  <a-checkbox v-model="directResourceTypes.video">&#x89c6;&#x9891;</a-checkbox>
                </div>
              </a-form-item>
            </template>
          </a-form>
        </a-card>

        <div class="shop-mgmt-fingerprint-hint">
          <span class="shop-mgmt-fingerprint-hint-icon">&#x1f512;</span>
          <span>每个店铺将自动生成独立的浏览器指纹，确保多店铺操作时身份互不关联，降低平台风控风险，无需手动配置。</span>
        </div>

        <div class="shop-mgmt-modal-actions">
          <a-button @click="closeShopModal">
            &#x53d6;&#x6d88;
          </a-button>
          <a-button
            html-type="submit"
            type="primary"
            :loading="shopSubmitting || shopDetailLoading"
          >
            {{ shopModalMode === 'edit' ? '\u4fdd\u5b58\u4fee\u6539' : '\u4fdd\u5b58\u5e97\u94fa' }}
          </a-button>
        </div>
      </form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import {
  IconFolderAdd,
  IconPlus,
  IconRefresh
} from '@arco-design/web-vue/es/icon';
import { getShopManagementBridge } from './bridge';
import { FALLBACK_GROUP_NAME, PROXY_TYPE_OPTIONS } from './constants';
import {
  applyShopDetail,
  buildEditableFallbackFromRow,
  createEmptyState,
  createEmptyDirectResourceTypes,
  createInitialShopForm,
  createShopPayload,
  ensureDirectResourceTypes,
  formatProxySummary,
  normalizeText,
  resetShopForm
} from './helpers';

const bridge = getShopManagementBridge();

const loading = ref(true);
const syncing = ref(false);
const groupModalVisible = ref(false);
const shopModalVisible = ref(false);
const shopModalMode = ref('create');
const editingShopId = ref('');
const groupSubmitting = ref(false);
const shopSubmitting = ref(false);
const shopDetailLoading = ref(false);
const groups = ref([]);
const shops = ref([]);
const newGroupName = ref('');
const groupDrafts = reactive({});
const visibilityBusyIds = reactive(new Set());
const groupSavingIds = reactive(new Set());
const groupDeletingIds = reactive(new Set());
const pageStatus = reactive({
  type: 'info',
  message: ''
});
const groupStatus = reactive({
  type: 'info',
  message: ''
});
const shopStatus = reactive({
  type: 'info',
  message: ''
});
const shopForm = reactive(createInitialShopForm());

const fallbackGroupName = FALLBACK_GROUP_NAME;
const proxyTypeOptions = PROXY_TYPE_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label
}));
const columns = Object.freeze([
  {
    title: '\u624b\u673a\u53f7/\u90ae\u7bb1\u8d26\u53f7',
    slotName: 'account',
    width: 190
  },
  {
    title: '\u5e97\u94fa\u540d\u79f0',
    slotName: 'shopName',
    width: 180
  },
  {
    title: '\u5e73\u53f0\u5e97\u94faID',
    slotName: 'platformShopId',
    width: 150
  },
  {
    title: '\u5e97\u94fa\u5206\u7ec4',
    slotName: 'groupName',
    width: 140
  },
  {
    title: '\u4ee3\u7406\u8bbe\u7f6e',
    slotName: 'proxy',
    width: 250
  },
  {
    title: '\u5e97\u94fa\u72b6\u6001',
    slotName: 'visibility',
    width: 120
  },
  {
    title: '\u5e97\u94fa\u5907\u6ce8',
    slotName: 'note',
    ellipsis: true
  },
  {
    title: '\u64cd\u4f5c',
    slotName: 'actions',
    width: 96,
    fixed: 'right'
  }
]);

const shopCountText = computed(() => `${shops.value.length} \u5bb6\u5e97\u94fa`);

const groupOptions = computed(() => {
  return [
    {
      value: '',
      label: FALLBACK_GROUP_NAME
    },
    ...groups.value.map((group) => ({
      value: group.id,
      label: group.name
    }))
  ];
});

const directResourceTypes = computed(() => ensureDirectResourceTypes(shopForm));

function setPageStatus(message, type = 'info') {
  pageStatus.message = normalizeText(message);
  pageStatus.type = type;
}

function setGroupStatus(message, type = 'info') {
  groupStatus.message = normalizeText(message);
  groupStatus.type = type;
}

function setShopStatus(message, type = 'info') {
  shopStatus.message = normalizeText(message);
  shopStatus.type = type;
}

function syncGroupDrafts() {
  const nextIds = new Set(groups.value.map((group) => group.id));

  Object.keys(groupDrafts).forEach((groupId) => {
    if (!nextIds.has(groupId)) {
      delete groupDrafts[groupId];
    }
  });

  groups.value.forEach((group) => {
    groupDrafts[group.id] = group.name || '';
  });
}

function dispatchStateChanged(state) {
  window.dispatchEvent(
    new CustomEvent('shop-management:state-changed', {
      detail: state
    })
  );
}

function applyState(state) {
  const nextState = state || createEmptyState();

  groups.value = Array.isArray(nextState.groups) ? nextState.groups.slice() : [];
  shops.value = Array.isArray(nextState.shops) ? nextState.shops.slice() : [];
  syncGroupDrafts();
  dispatchStateChanged(nextState);
}

async function refresh() {
  loading.value = true;

  try {
    const state = await bridge.getState();
    applyState(state);
    return state;
  } finally {
    loading.value = false;
  }
}

async function syncCloudState() {
  if (syncing.value) {
    return;
  }

  syncing.value = true;
  setPageStatus('\u6b63\u5728\u4ece\u4e91\u7aef\u540c\u6b65\u5e97\u94fa\u5217\u8868...');

  try {
    const result = await bridge.syncCloudState();
    const nextState = result && result.state ? result.state : createEmptyState();

    applyState(nextState);

    if (result && result.usedCloud) {
      const syncedShopCount = Number(result.syncedShopCount || 0);
      const failedShopCount = Number(result.failedShopCount || 0);

      setPageStatus(
        failedShopCount > 0
          ? `\u5df2\u4ece\u4e91\u7aef\u540c\u6b65 ${syncedShopCount} \u5bb6\u5e97\u94fa\uff0c${failedShopCount} \u6761\u660e\u7ec6\u672a\u80fd\u62c9\u53d6\u3002`
          : `\u5df2\u4ece\u4e91\u7aef\u540c\u6b65 ${syncedShopCount} \u5bb6\u5e97\u94fa\u3002`,
        failedShopCount > 0 ? 'warning' : 'success'
      );
    } else {
      setPageStatus(
        '\u672a\u627e\u5230\u4e91\u7aef\u5e97\u94fa\u6570\u636e\uff0c\u5df2\u4f7f\u7528\u5f53\u524d\u672c\u5730\u5217\u8868\u3002',
        'info'
      );
    }
  } catch (error) {
    setPageStatus(
      error && error.message
        ? error.message
        : '\u4e91\u7aef\u5e97\u94fa\u540c\u6b65\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'error'
    );
  } finally {
    syncing.value = false;
  }
}

function getGroupShopCount(groupId) {
  return shops.value.filter((shop) => normalizeText(shop.groupId) === normalizeText(groupId)).length;
}

function openGroupModal() {
  newGroupName.value = '';
  setGroupStatus('');
  groupModalVisible.value = true;
}

function closeGroupModal() {
  groupModalVisible.value = false;
  newGroupName.value = '';
  setGroupStatus('');
}

async function submitNewGroup() {
  if (groupSubmitting.value) {
    return;
  }

  groupSubmitting.value = true;
  setGroupStatus('\u6b63\u5728\u4fdd\u5b58\u5206\u7ec4...');

  try {
    const result = await bridge.addGroup({
      name: newGroupName.value
    });

    applyState(result.state);
    newGroupName.value = '';
    setGroupStatus('\u5206\u7ec4\u5df2\u65b0\u589e\u3002', 'success');
    Message.success('\u5206\u7ec4\u5df2\u65b0\u589e');
  } catch (error) {
    setGroupStatus(
      error && error.message
        ? error.message
        : '\u5206\u7ec4\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'error'
    );
  } finally {
    groupSubmitting.value = false;
  }
}

async function saveGroup(group) {
  if (!group || groupSavingIds.has(group.id)) {
    return;
  }

  groupSavingIds.add(group.id);
  setGroupStatus('\u6b63\u5728\u4fdd\u5b58\u5206\u7ec4...');

  try {
    const result = await bridge.updateGroup({
      groupId: group.id,
      name: groupDrafts[group.id]
    });

    applyState(result.state);
    setGroupStatus('\u5206\u7ec4\u5df2\u4fdd\u5b58\u3002', 'success');
    Message.success('\u5206\u7ec4\u5df2\u4fdd\u5b58');
  } catch (error) {
    setGroupStatus(
      error && error.message
        ? error.message
        : '\u5206\u7ec4\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'error'
    );
  } finally {
    groupSavingIds.delete(group.id);
  }
}

async function deleteGroup(group) {
  if (!group || groupDeletingIds.has(group.id)) {
    return;
  }

  groupDeletingIds.add(group.id);
  setGroupStatus('\u6b63\u5728\u5220\u9664\u5206\u7ec4...');

  try {
    const result = await bridge.deleteGroup({
      groupId: group.id
    });

    applyState(result.state);
    setGroupStatus(
      '\u5206\u7ec4\u5df2\u5220\u9664\uff0c\u539f\u5206\u7ec4\u5e97\u94fa\u5df2\u79fb\u5230\u672a\u5206\u7ec4\u3002',
      'success'
    );
    Message.success('\u5206\u7ec4\u5df2\u5220\u9664');
  } catch (error) {
    setGroupStatus(
      error && error.message
        ? error.message
        : '\u5206\u7ec4\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'error'
    );
  } finally {
    groupDeletingIds.delete(group.id);
  }
}

function closeShopModal() {
  shopModalVisible.value = false;
  shopModalMode.value = 'create';
  editingShopId.value = '';
  resetShopForm(shopForm);
  setShopStatus('');
}

function openCreateShopModal() {
  closeShopModal();
  resetShopForm(shopForm);
  shopModalMode.value = 'create';
  shopModalVisible.value = true;
}

function handleProxyTypeChange(value) {
  if (value !== 'local') {
    return;
  }

  shopForm.proxyHost = '';
  shopForm.proxyPort = '';
  shopForm.proxyUsername = '';
  shopForm.proxyPassword = '';
  shopForm.proxyBypassRules = '';
  shopForm.directResourceTypes = createEmptyDirectResourceTypes();
}

async function openEditShopModal(row) {
  if (!row) {
    return;
  }

  closeShopModal();
  shopModalMode.value = 'edit';
  editingShopId.value = row.id;
  shopModalVisible.value = true;
  applyShopDetail(shopForm, buildEditableFallbackFromRow(row));
  setShopStatus('\u6b63\u5728\u52a0\u8f7d\u5e97\u94fa\u8be6\u60c5...');
  shopDetailLoading.value = true;

  try {
    const detail = await bridge.getShopDetail({
      shopId: row.id
    });

    applyShopDetail(shopForm, detail);
    setShopStatus('');
  } catch (error) {
    setShopStatus(
      error && error.message
        ? error.message
        : '\u5e97\u94fa\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u8868\u5355\u540e\u518d\u4fdd\u5b58\u3002',
      'warning'
    );
  } finally {
    shopDetailLoading.value = false;
  }
}

async function submitShopForm() {
  if (shopSubmitting.value || shopDetailLoading.value) {
    return;
  }

  const currentMode = shopModalMode.value;

  shopSubmitting.value = true;
  setShopStatus(
    currentMode === 'edit'
      ? '\u6b63\u5728\u4fdd\u5b58\u4fee\u6539...'
      : '\u6b63\u5728\u4fdd\u5b58\u5e97\u94fa...'
  );

  try {
    const payload = createShopPayload(shopForm, {
      shopId: editingShopId.value
    });
    const result = currentMode === 'edit'
      ? await bridge.updateShop({
        shopId: editingShopId.value,
        ...payload
      })
      : await bridge.addShop(payload);

    applyState(result.state);
    closeShopModal();
    Message.success(
      currentMode === 'edit'
        ? '\u5e97\u94fa\u4fee\u6539\u5df2\u4fdd\u5b58'
        : '\u5e97\u94fa\u5df2\u65b0\u589e'
    );
  } catch (error) {
    setShopStatus(
      error && error.message
        ? error.message
        : (
          currentMode === 'edit'
            ? '\u5e97\u94fa\u4fee\u6539\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
            : '\u5e97\u94fa\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        ),
      'error'
    );
  } finally {
    shopSubmitting.value = false;
  }
}

async function handleShopVisibilityChange(record, value) {
  if (!record || visibilityBusyIds.has(record.id)) {
    return;
  }

  visibilityBusyIds.add(record.id);
  setPageStatus(
    value === true
      ? '\u6b63\u5728\u5f00\u542f\u5e97\u94fa...'
      : '\u6b63\u5728\u5173\u95ed\u5e97\u94fa...'
  );

  try {
    const result = await bridge.setShopVisibility({
      shopId: record.id,
      isVisible: value === true
    });

    applyState(result.state);
    setPageStatus(
      value === true
        ? '\u5e97\u94fa\u5df2\u5f00\u542f\uff0c\u53ef\u7ee7\u7eed\u53c2\u4e0e\u76f8\u5173\u4efb\u52a1\u3002'
        : '\u5e97\u94fa\u5df2\u5173\u95ed\uff0c\u5404\u529f\u80fd\u5c06\u4e0d\u518d\u6267\u884c\u8be5\u5e97\u94fa\u4efb\u52a1\u3002',
      'success'
    );
  } catch (error) {
    setPageStatus(
      error && error.message
        ? error.message
        : '\u5e97\u94fa\u5f00\u5173\u72b6\u6001\u4fee\u6539\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'error'
    );
  } finally {
    visibilityBusyIds.delete(record.id);
  }
}

onMounted(async () => {
  try {
    await refresh();
  } catch (error) {
    setPageStatus(
      error && error.message
        ? error.message
        : '\u5e97\u94fa\u5217\u8868\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'error'
    );
  }
});

defineExpose({
  refresh
});
</script>

<style>
.shop-mgmt-app-shell {
  display: grid;
  min-height: 100%;
  height: auto;
}

.shop-mgmt-card {
  display: block;
  min-height: 0;
  border-radius: 16px;
  overflow: visible;
}

.shop-mgmt-card :deep(.arco-card-body) {
  padding: 20px;
}

.shop-mgmt-card :deep(.arco-btn) {
  border-radius: 12px;
  font-weight: 600;
}

.shop-mgmt-card :deep(.arco-btn-secondary) {
  border-color: rgba(148, 163, 184, 0.18);
  background: #f8fafc;
  color: #334155;
}

.shop-mgmt-card :deep(.arco-btn-primary) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.72);
  background: linear-gradient(180deg, var(--theme-primary-color), var(--theme-primary-color-deep));
  color: var(--theme-primary-contrast, #ffffff);
  box-shadow: 0 8px 16px rgba(var(--theme-primary-rgb-8, 193, 141, 0), 0.14);
}

.shop-mgmt-card :deep(.arco-btn-primary:hover) {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.82);
  background: linear-gradient(180deg, var(--theme-primary-color), var(--theme-primary-color-deep));
  color: var(--theme-primary-contrast, #ffffff);
}

.shop-mgmt-card :deep(.arco-btn-status-danger.arco-btn-outline),
.shop-mgmt-card :deep(.arco-btn-status-danger.arco-btn-secondary) {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.18);
  color: #b42318;
}

.shop-mgmt-card :deep(.arco-alert) {
  border-radius: 12px;
}

.shop-mgmt-card :deep(.arco-table) {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: #ffffff;
}

.shop-mgmt-card :deep(.arco-table-th) {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.shop-mgmt-card :deep(.arco-table-td) {
  background: #ffffff;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.shop-mgmt-card :deep(.arco-table-tr:hover .arco-table-td) {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.025);
}

.shop-mgmt-card :deep(.arco-table-cell-fixed-right) {
  background: inherit;
}

.shop-mgmt-card :deep(.arco-empty) {
  padding: 24px 0;
}

.shop-mgmt-card :deep(.arco-spin) {
  color: var(--theme-primary-ink, #445468);
}

.shop-mgmt-toolbar {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.shop-mgmt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.shop-mgmt-head > div:first-child {
  min-width: 0;
}

.shop-mgmt-head h3 {
  margin: 0;
  color: #132238;
  font-family: "Microsoft YaHei UI", "PingFang SC", "Bahnschrift", sans-serif;
  font-size: 32px;
  line-height: 1.26;
}

.shop-mgmt-head p,
.shop-mgmt-card-copy {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.72;
}

.shop-mgmt-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
  align-self: flex-start;
}

.shop-mgmt-head-actions :deep(.arco-btn) {
  min-height: 36px;
  padding-inline: 14px;
  line-height: 1.35;
}

.shop-mgmt-count-tag {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding-inline: 12px;
  color: var(--theme-primary-ink, #445468);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.08);
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16);
  line-height: 1.2;
}

.shop-mgmt-status,
.shop-mgmt-inline-status {
  margin-bottom: 14px;
  border-radius: 14px;
}

.shop-mgmt-loading {
  display: grid;
  place-items: center;
  min-height: 260px;
}

.shop-mgmt-table-shell {
  min-height: 0;
  overflow-x: auto;
  overflow-y: visible;
}

.shop-mgmt-cell-title {
  color: #132238;
  font-weight: 700;
}

.shop-mgmt-cell-mono {
  font-family: "Consolas", "Bahnschrift", sans-serif;
}

.shop-mgmt-cell-note,
.shop-mgmt-proxy-cell {
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.shop-mgmt-visibility-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.shop-mgmt-visibility-text {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.shop-mgmt-visibility-text.is-active {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.shop-mgmt-visibility-text.is-muted {
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
}

.shop-mgmt-edit-button {
  min-width: 58px;
}

.shop-mgmt-group-layout {
  display: block;
}

.shop-mgmt-group-panel,
.shop-mgmt-form-card {
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.shop-mgmt-group-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96)),
    #ffffff;
}

.shop-mgmt-group-create-bar {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(360px, 1.2fr);
  gap: 16px;
  align-items: end;
  padding: 16px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.shop-mgmt-group-create-copy strong,
.shop-mgmt-group-list-head strong {
  display: block;
  color: #132238;
  font-size: 15px;
  line-height: 1.35;
}

.shop-mgmt-group-create-copy span,
.shop-mgmt-group-list-head span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.shop-mgmt-group-create-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.shop-mgmt-group-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 2px;
}

.shop-mgmt-group-list-body {
  display: grid;
  gap: 10px;
  max-height: 430px;
  overflow-y: auto;
  padding: 2px 4px 2px 2px;
}

.shop-mgmt-group-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.shop-mgmt-group-row:hover {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.34);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
  transform: translateY(-1px);
}

.shop-mgmt-group-row-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.12);
  border-radius: 8px;
  padding: 4px 10px;
  color: var(--theme-primary-ink, #445468);
  line-height: 1;
  white-space: nowrap;
}

.shop-mgmt-group-row-badge-num {
  font-size: 18px;
  font-weight: 800;
}

.shop-mgmt-group-row-badge-unit {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.75;
}

.shop-mgmt-group-row-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.shop-mgmt-group-row-main .arco-input-wrapper {
  flex: 1;
  max-width: 320px;
}

.shop-mgmt-group-row-count {
  color: #94a3b8;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.shop-mgmt-group-row-actions,
.shop-mgmt-modal-actions,
.shop-mgmt-checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.shop-mgmt-group-row-actions,
.shop-mgmt-modal-actions {
  justify-content: flex-end;
}

.shop-mgmt-group-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.shop-mgmt-form-layout {
  display: grid;
  gap: 14px;
}

.shop-mgmt-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.shop-mgmt-span-2 {
  grid-column: 1 / -1;
}

.shop-mgmt-toggle-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;
}

.shop-mgmt-toggle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.shop-mgmt-toggle-card strong {
  display: block;
  color: #132238;
  margin-bottom: 6px;
}

.shop-mgmt-toggle-card p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.shop-mgmt-fingerprint-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.06);
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.14);
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.shop-mgmt-fingerprint-hint-icon {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.6;
}

body.dark-theme .shop-mgmt-fingerprint-hint {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.08);
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16);
  color: #94a3b8;
}

body.dark-theme .shop-mgmt-head h3,
body.dark-theme .shop-mgmt-cell-title,
body.dark-theme .shop-mgmt-toggle-card strong,
body.dark-theme .shop-mgmt-group-create-copy strong,
body.dark-theme .shop-mgmt-group-list-head strong {
  color: #e5eefc;
}

body.dark-theme .shop-mgmt-head p,
body.dark-theme .shop-mgmt-card-copy,
body.dark-theme .shop-mgmt-cell-note,
body.dark-theme .shop-mgmt-proxy-cell,
body.dark-theme .shop-mgmt-toggle-card p,
body.dark-theme .shop-mgmt-group-create-copy span,
body.dark-theme .shop-mgmt-group-list-head span,
body.dark-theme .shop-mgmt-group-row-count {
  color: #94a3b8;
}

body.dark-theme .shop-mgmt-group-panel,
body.dark-theme .shop-mgmt-form-card,
body.dark-theme .shop-mgmt-group-create-bar,
body.dark-theme .shop-mgmt-group-row,
body.dark-theme .shop-mgmt-toggle-card {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(148, 163, 184, 0.12);
}

body.dark-theme .shop-mgmt-group-panel {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.86)),
    #0f172a;
}

body.dark-theme .shop-mgmt-group-row:hover {
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.18);
}

body.dark-theme .shop-mgmt-group-row-badge {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.16);
  color: #f8d673;
}

body.dark-theme .shop-mgmt-group-row-badge-unit {
  color: #f8d673;
}

body.dark-theme .shop-mgmt-card :deep(.arco-btn-secondary) {
  border-color: rgba(71, 85, 105, 0.3);
  background: rgba(15, 23, 42, 0.92);
  color: #dbe7f5;
}

body.dark-theme .shop-mgmt-toolbar {
  border-bottom-color: rgba(71, 85, 105, 0.26);
}

body.dark-theme .shop-mgmt-card :deep(.arco-table) {
  border-color: rgba(71, 85, 105, 0.28);
  background: rgba(15, 23, 42, 0.88);
}

body.dark-theme .shop-mgmt-card :deep(.arco-table-th) {
  background: rgba(15, 23, 42, 0.96);
  color: #94a3b8;
  border-bottom-color: rgba(71, 85, 105, 0.28);
}

body.dark-theme .shop-mgmt-card :deep(.arco-table-td) {
  background: rgba(15, 23, 42, 0.88);
  border-bottom-color: rgba(71, 85, 105, 0.18);
}

body.dark-theme .shop-mgmt-card :deep(.arco-table-tr:hover .arco-table-td) {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.06);
}

body.dark-theme .shop-mgmt-visibility-text.is-active {
  background: rgba(16, 185, 129, 0.18);
  color: #6ee7b7;
}

body.dark-theme .shop-mgmt-visibility-text.is-muted {
  background: rgba(71, 85, 105, 0.26);
  color: #cbd5e1;
}

@media (max-width: 980px) {
  .shop-mgmt-group-create-bar,
  .shop-mgmt-group-row,
  .shop-mgmt-toggle-row {
    grid-template-columns: 1fr;
  }

  .shop-mgmt-group-row-badge {
    flex-direction: row;
    width: auto;
    height: 36px;
    justify-self: start;
    padding: 0 12px;
  }

  .shop-mgmt-group-row-badge span {
    margin-top: 0;
    margin-left: 4px;
  }
}

@media (max-width: 780px) {
  .shop-mgmt-form-grid {
    grid-template-columns: 1fr;
  }

  .shop-mgmt-head-actions {
    justify-content: flex-start;
  }

  .shop-mgmt-group-create-form,
  .shop-mgmt-group-row-main {
    grid-template-columns: 1fr;
  }

  .shop-mgmt-group-row-actions,
  .shop-mgmt-modal-actions {
    justify-content: flex-start;
  }
}
</style>
