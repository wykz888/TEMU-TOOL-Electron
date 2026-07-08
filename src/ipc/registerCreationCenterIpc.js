const { ipcMain } = require('electron');
const { CREATION_CHANNELS } = require('./creationCenterChannels');
const { registerInvokeHandlers } = require('./ipcRegistration');

function registerCreationCenterIpc({
  getCreationCatalog,
  onOpenJimengImage,
  onOpenPodUploadSheetMiaoshou,
  onOpenPodSuiteTool
}) {
  registerInvokeHandlers(ipcMain, {
    [CREATION_CHANNELS.GET_CREATION_CATALOG]: async () => {
      if (typeof getCreationCatalog !== 'function') {
        return [];
      }

      return getCreationCatalog();
    },
    [CREATION_CHANNELS.OPEN_JIMENG_IMAGE]: async (_event, payload) => {
      if (typeof onOpenJimengImage === 'function') {
        await onOpenJimengImage(payload);
      }

      return {
        success: true
      };
    },
    [CREATION_CHANNELS.OPEN_POD_UPLOAD_SHEET_MIAOSHOU]: async (event, payload) => {
      if (typeof onOpenPodUploadSheetMiaoshou === 'function') {
        await onOpenPodUploadSheetMiaoshou(payload, {
          event
        });
      }

      return {
        success: true
      };
    },
    [CREATION_CHANNELS.OPEN_POD_SUITE_TOOL]: async (event, payload) => {
      if (typeof onOpenPodSuiteTool === 'function') {
        await onOpenPodSuiteTool(payload, {
          event
        });
      }

      return {
        success: true
      };
    }
  });

  return CREATION_CHANNELS;
}

module.exports = {
  CREATION_CHANNELS,
  registerCreationCenterIpc
};
