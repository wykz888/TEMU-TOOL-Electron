const { ipcMain } = require('electron');
const { registerInvokeHandlers } = require('./ipcRegistration');
const { POD_SUITE_TOOL_CHANNELS } = require('./podSuiteToolChannels');

function registerPodSuiteToolIpc({
  selectWhiteMockupFile,
  selectMaskImageFile,
  selectTextureImageFile,
  selectPreviewDesignFile,
  selectImageDirectory,
  selectOutputDirectory,
  collectImageFiles,
  selectPsdMockupFile,
  selectPsdImageDirectory,
  selectPsdOutputDirectory,
  selectPsdMetadataSourceFile,
  selectPsdMetadataSourceDirectory,
  openDirectory,
  generateWhiteMockups,
  generatePsdSmartObjectMockups,
  cancelPsdSmartObjectMockups,
  setPsdEngineWindowVisible,
  getPsdSmartObjectTemplates,
  savePsdSmartObjectTemplate,
  deletePsdSmartObjectTemplate,
  renderWhiteMockupPreview,
  getWhiteMockupTemplate,
  saveWhiteMockupTemplate,
  createWhiteMockupRegionFromMask
}) {
  registerInvokeHandlers(ipcMain, {
    [POD_SUITE_TOOL_CHANNELS.SELECT_WHITE_MOCKUP_FILE]: async (event, payload) => {
      if (typeof selectWhiteMockupFile !== 'function') {
        return {
          canceled: true,
          filePath: ''
        };
      }

      return selectWhiteMockupFile(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_MASK_IMAGE_FILE]: async (event, payload) => {
      if (typeof selectMaskImageFile !== 'function') {
        return {
          canceled: true,
          filePath: ''
        };
      }

      return selectMaskImageFile(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_TEXTURE_IMAGE_FILE]: async (event, payload) => {
      if (typeof selectTextureImageFile !== 'function') {
        return {
          canceled: true,
          filePath: ''
        };
      }

      return selectTextureImageFile(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_PREVIEW_DESIGN_FILE]: async (event, payload) => {
      if (typeof selectPreviewDesignFile !== 'function') {
        return {
          canceled: true,
          filePath: ''
        };
      }

      return selectPreviewDesignFile(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_IMAGE_DIRECTORY]: async (event, payload) => {
      if (typeof selectImageDirectory !== 'function') {
        return {
          canceled: true,
          directoryPath: '',
          files: []
        };
      }

      return selectImageDirectory(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_OUTPUT_DIRECTORY]: async (event, payload) => {
      if (typeof selectOutputDirectory !== 'function') {
        return {
          canceled: true,
          directoryPath: ''
        };
      }

      return selectOutputDirectory(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.COLLECT_IMAGE_FILES]: async (_event, payload) => {
      if (typeof collectImageFiles !== 'function') {
        return {
          success: false,
          updatedAt: '',
          directoryPath: '',
          files: []
        };
      }

      return collectImageFiles(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_PSD_MOCKUP_FILE]: async (event, payload) => {
      if (typeof selectPsdMockupFile !== 'function') {
        return {
          canceled: true,
          filePath: ''
        };
      }

      return selectPsdMockupFile(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_PSD_IMAGE_DIRECTORY]: async (event, payload) => {
      if (typeof selectPsdImageDirectory !== 'function') {
        return {
          canceled: true,
          directoryPath: '',
          files: []
        };
      }

      return selectPsdImageDirectory(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_PSD_OUTPUT_DIRECTORY]: async (event, payload) => {
      if (typeof selectPsdOutputDirectory !== 'function') {
        return {
          canceled: true,
          directoryPath: ''
        };
      }

      return selectPsdOutputDirectory(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_PSD_METADATA_SOURCE_FILE]: async (event, payload) => {
      if (typeof selectPsdMetadataSourceFile !== 'function') {
        return {
          canceled: true,
          filePath: ''
        };
      }

      return selectPsdMetadataSourceFile(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.SELECT_PSD_METADATA_SOURCE_DIRECTORY]: async (event, payload) => {
      if (typeof selectPsdMetadataSourceDirectory !== 'function') {
        return {
          canceled: true,
          directoryPath: '',
          files: []
        };
      }

      return selectPsdMetadataSourceDirectory(payload, {
        event
      });
    },
    [POD_SUITE_TOOL_CHANNELS.OPEN_DIRECTORY]: async (_event, payload) => {
      if (typeof openDirectory !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: '\u6253\u5f00\u76ee\u5f55\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        };
      }

      return openDirectory(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.GENERATE_WHITE_MOCKUPS]: async (_event, payload) => {
      if (typeof generateWhiteMockups !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: '\u5957\u56fe\u5de5\u5177\u672a\u5c31\u7eea\u3002'
        };
      }

      return generateWhiteMockups(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.GENERATE_PSD_SMART_OBJECT_MOCKUPS]: async (event, payload) => {
      if (typeof generatePsdSmartObjectMockups !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: 'PSD\u667a\u80fd\u5957\u56fe\u672a\u5c31\u7eea\u3002'
        };
      }

      return generatePsdSmartObjectMockups(payload, {
        event,
        emitProgress(progressPayload) {
          if (!event || !event.sender || event.sender.isDestroyed()) {
            return;
          }

          event.sender.send(POD_SUITE_TOOL_CHANNELS.PSD_SMART_OBJECT_PROGRESS, progressPayload);
        }
      });
    },
    [POD_SUITE_TOOL_CHANNELS.CANCEL_PSD_SMART_OBJECT_MOCKUPS]: async (_event, payload) => {
      if (typeof cancelPsdSmartObjectMockups !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: 'PSD\u667a\u80fd\u5957\u56fe\u505c\u6b62\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        };
      }

      return cancelPsdSmartObjectMockups(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.SET_PSD_ENGINE_WINDOW_VISIBLE]: async (_event, payload) => {
      if (typeof setPsdEngineWindowVisible !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: 'PSD\u5f15\u64ce\u7a97\u53e3\u5207\u6362\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        };
      }

      return setPsdEngineWindowVisible(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.GET_PSD_SMART_OBJECT_TEMPLATES]: async (_event, payload) => {
      if (typeof getPsdSmartObjectTemplates !== 'function') {
        return {
          success: false,
          updatedAt: '',
          templates: [],
          message: 'PSD\u5957\u56fe\u6a21\u677f\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        };
      }

      return getPsdSmartObjectTemplates(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.SAVE_PSD_SMART_OBJECT_TEMPLATE]: async (_event, payload) => {
      if (typeof savePsdSmartObjectTemplate !== 'function') {
        return {
          success: false,
          updatedAt: '',
          templates: [],
          message: 'PSD\u5957\u56fe\u6a21\u677f\u4fdd\u5b58\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        };
      }

      return savePsdSmartObjectTemplate(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.DELETE_PSD_SMART_OBJECT_TEMPLATE]: async (_event, payload) => {
      if (typeof deletePsdSmartObjectTemplate !== 'function') {
        return {
          success: false,
          updatedAt: '',
          templates: [],
          message: 'PSD\u5957\u56fe\u6a21\u677f\u5220\u9664\u529f\u80fd\u672a\u5c31\u7eea\u3002'
        };
      }

      return deletePsdSmartObjectTemplate(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.RENDER_WHITE_MOCKUP_PREVIEW]: async (_event, payload) => {
      if (typeof renderWhiteMockupPreview !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: '\u9884\u89c8\u751f\u6210\u672a\u5c31\u7eea\u3002'
        };
      }

      return renderWhiteMockupPreview(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.GET_WHITE_MOCKUP_TEMPLATE]: async (_event, payload) => {
      if (typeof getWhiteMockupTemplate !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: '\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002'
        };
      }

      return getWhiteMockupTemplate(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.SAVE_WHITE_MOCKUP_TEMPLATE]: async (_event, payload) => {
      if (typeof saveWhiteMockupTemplate !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: '\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002'
        };
      }

      return saveWhiteMockupTemplate(payload);
    },
    [POD_SUITE_TOOL_CHANNELS.CREATE_WHITE_MOCKUP_REGION_FROM_MASK]: async (_event, payload) => {
      if (typeof createWhiteMockupRegionFromMask !== 'function') {
        return {
          success: false,
          updatedAt: '',
          message: '\u5370\u82b1\u8499\u7248\u533a\u57df\u8bc6\u522b\u672a\u5c31\u7eea\u3002'
        };
      }

      return createWhiteMockupRegionFromMask(payload);
    }
  });

  return POD_SUITE_TOOL_CHANNELS;
}

module.exports = {
  POD_SUITE_TOOL_CHANNELS,
  registerPodSuiteToolIpc
};
