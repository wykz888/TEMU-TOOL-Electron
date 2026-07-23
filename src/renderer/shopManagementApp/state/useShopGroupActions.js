import { Message } from '@arco-design/web-vue';
import { normalizeText } from '../helpers';
import { setStatus } from './statusUtils';

export function useShopGroupActions({
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
}) {
  function setGroupStatus(message, type = 'info') {
    setStatus(groupStatus, message, type);
  }

  function updateNewGroupName(value) {
    newGroupName.value = value || '';
  }

  function updateGroupDraft({ groupId, value }) {
    const normalizedGroupId = normalizeText(groupId);

    if (!normalizedGroupId) {
      return;
    }

    groupDrafts[normalizedGroupId] = value || '';
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

  function getGroupShopCount(groupId) {
    return shops.value.filter((shop) => (
      normalizeText(shop.groupId) === normalizeText(groupId)
    )).length;
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

  return {
    updateNewGroupName,
    updateGroupDraft,
    syncGroupDrafts,
    getGroupShopCount,
    openGroupModal,
    closeGroupModal,
    submitNewGroup,
    saveGroup,
    deleteGroup
  };
}
