<template>
  <div class="shop-mgmt-app-shell">
    <a-card class="shop-mgmt-card" :bordered="false">
      <ShopManagementToolbar
        :shop-count-text="shopCountText"
        :syncing="syncing"
        @sync="syncCloudState"
        @open-groups="openGroupModal"
        @create-shop="openCreateShopModal"
      />

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

      <ShopTable
        v-else
        :columns="columns"
        :shops="shops"
        :fallback-group-name="fallbackGroupName"
        :visibility-busy-ids="visibilityBusyIds"
        @edit-shop="openEditShopModal"
        @visibility-change="handleShopVisibilityChange"
      />
    </a-card>

    <GroupManageModal
      :visible="groupModalVisible"
      :groups="groups"
      :new-group-name="newGroupName"
      :group-drafts="groupDrafts"
      :group-status="groupStatus"
      :group-submitting="groupSubmitting"
      :group-saving-ids="groupSavingIds"
      :group-deleting-ids="groupDeletingIds"
      :get-group-shop-count="getGroupShopCount"
      @close="closeGroupModal"
      @submit-new-group="submitNewGroup"
      @save-group="saveGroup"
      @delete-group="deleteGroup"
      @update-new-group-name="updateNewGroupName"
      @update-group-draft="updateGroupDraft"
    />

    <ShopFormModal
      :visible="shopModalVisible"
      :mode="shopModalMode"
      :shop-form="shopForm"
      :group-options="groupOptions"
      :proxy-type-options="proxyTypeOptions"
      :direct-resource-types="directResourceTypes"
      :shop-status="shopStatus"
      :shop-submitting="shopSubmitting"
      :shop-detail-loading="shopDetailLoading"
      @close="closeShopModal"
      @submit="submitShopForm"
      @proxy-type-change="handleProxyTypeChange"
      @update-shop-field="updateShopFormField"
      @update-direct-resource-type="updateDirectResourceType"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import GroupManageModal from './components/GroupManageModal.vue';
import ShopFormModal from './components/ShopFormModal.vue';
import ShopManagementToolbar from './components/ShopManagementToolbar.vue';
import ShopTable from './components/ShopTable.vue';
import { useShopManagementState } from './state/useShopManagementState';

const {
  loading,
  syncing,
  groupModalVisible,
  shopModalVisible,
  shopModalMode,
  groupSubmitting,
  shopSubmitting,
  shopDetailLoading,
  groups,
  shops,
  newGroupName,
  groupDrafts,
  visibilityBusyIds,
  groupSavingIds,
  groupDeletingIds,
  pageStatus,
  groupStatus,
  shopStatus,
  shopForm,
  proxyTypeOptions,
  columns,
  fallbackGroupName,
  shopCountText,
  groupOptions,
  directResourceTypes,
  initialize,
  refresh,
  syncCloudState,
  getGroupShopCount,
  openGroupModal,
  closeGroupModal,
  submitNewGroup,
  saveGroup,
  deleteGroup,
  openCreateShopModal,
  closeShopModal,
  handleProxyTypeChange,
  openEditShopModal,
  submitShopForm,
  handleShopVisibilityChange,
  updateNewGroupName,
  updateGroupDraft,
  updateShopFormField,
  updateDirectResourceType
} = useShopManagementState();

onMounted(initialize);

defineExpose({
  refresh
});
</script>
