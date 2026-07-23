import { computed, reactive, ref } from 'vue';
import { getShopManagementBridge } from '../bridge';
import {
  FALLBACK_GROUP_NAME,
  PROXY_TYPE_OPTIONS,
  SHOP_MANAGEMENT_TABLE_COLUMNS
} from '../constants';
import {
  createEmptyState,
  createInitialShopForm,
  ensureDirectResourceTypes,
  normalizeText
} from '../helpers';
import { createStatusState, setStatus } from './statusUtils';
import { useShopFormActions } from './useShopFormActions';
import { useShopGroupActions } from './useShopGroupActions';

export function useShopManagementState() {
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
  const pageStatus = createStatusState();
  const groupStatus = createStatusState();
  const shopStatus = createStatusState();
  const shopForm = reactive(createInitialShopForm());

  const proxyTypeOptions = PROXY_TYPE_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label
  }));
  const columns = SHOP_MANAGEMENT_TABLE_COLUMNS;
  const fallbackGroupName = FALLBACK_GROUP_NAME;

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
    setStatus(pageStatus, message, type);
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
    groupActions.syncGroupDrafts();
    dispatchStateChanged(nextState);
  }

  const groupActions = useShopGroupActions({
    bridge,
    groups,
    shops,
    newGroupName,
    groupDrafts,
    groupModalVisible,
    groupSubmitting,
    groupSavingIds,
    groupDeletingIds,
    groupStatus,
    applyState
  });

  const shopFormActions = useShopFormActions({
    bridge,
    shopForm,
    shopModalVisible,
    shopModalMode,
    editingShopId,
    shopSubmitting,
    shopDetailLoading,
    shopStatus,
    applyState
  });

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

  async function initialize() {
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

  async function handleShopVisibilityChange({ record, value }) {
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

  return {
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
    getGroupShopCount: groupActions.getGroupShopCount,
    openGroupModal: groupActions.openGroupModal,
    closeGroupModal: groupActions.closeGroupModal,
    submitNewGroup: groupActions.submitNewGroup,
    saveGroup: groupActions.saveGroup,
    deleteGroup: groupActions.deleteGroup,
    openCreateShopModal: shopFormActions.openCreateShopModal,
    closeShopModal: shopFormActions.closeShopModal,
    handleProxyTypeChange: shopFormActions.handleProxyTypeChange,
    openEditShopModal: shopFormActions.openEditShopModal,
    submitShopForm: shopFormActions.submitShopForm,
    handleShopVisibilityChange,
    updateNewGroupName: groupActions.updateNewGroupName,
    updateGroupDraft: groupActions.updateGroupDraft,
    updateShopFormField: shopFormActions.updateShopFormField,
    updateDirectResourceType: shopFormActions.updateDirectResourceType
  };
}
