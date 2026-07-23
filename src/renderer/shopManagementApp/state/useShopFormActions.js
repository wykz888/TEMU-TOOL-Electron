import { Message } from '@arco-design/web-vue';
import {
  applyShopDetail,
  buildEditableFallbackFromRow,
  createEmptyDirectResourceTypes,
  createShopPayload,
  ensureDirectResourceTypes,
  resetShopForm
} from '../helpers';
import { setStatus } from './statusUtils';

export function useShopFormActions({
  bridge,
  shopForm,
  shopModalVisible,
  shopModalMode,
  editingShopId,
  shopSubmitting,
  shopDetailLoading,
  shopStatus,
  applyState
}) {
  function setShopStatus(message, type = 'info') {
    setStatus(shopStatus, message, type);
  }

  function updateShopFormField({ field, value }) {
    if (!field || !Object.prototype.hasOwnProperty.call(shopForm, field)) {
      return;
    }

    shopForm[field] = value;
  }

  function updateDirectResourceType({ key, value }) {
    const directTypes = ensureDirectResourceTypes(shopForm);

    if (!Object.prototype.hasOwnProperty.call(directTypes, key)) {
      return;
    }

    directTypes[key] = value === true;
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

  return {
    closeShopModal,
    openCreateShopModal,
    handleProxyTypeChange,
    openEditShopModal,
    submitShopForm,
    updateShopFormField,
    updateDirectResourceType
  };
}
