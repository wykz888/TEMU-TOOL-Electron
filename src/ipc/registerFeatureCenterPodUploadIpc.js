function registerFeatureCenterPodUploadIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    getPodUploadSheetMiaoshouCategories,
    syncPodUploadSheetMiaoshouCategories,
    getPodUploadSheetMiaoshouTemplateSnapshot,
    syncPodUploadSheetMiaoshouTemplates,
    getPodUploadSheetMiaoshouFormTemplates,
    savePodUploadSheetMiaoshouFormTemplate,
    deletePodUploadSheetMiaoshouFormTemplate,
    getPodUploadSheetMiaoshouWorkspaceState,
    savePodUploadSheetMiaoshouWorkspaceState,
    selectPodUploadSheetMiaoshouImportDirectory,
    exportPodUploadSheetMiaoshouTable,
    uploadPodUploadSheetMiaoshouCosImages,
    cancelPodUploadSheetMiaoshouCosImages,
    getPodUploadSheetMiaoshouCosUploadProgressSnapshot,
    getPodUploadSheetMiaoshouAiTitleConfig,
    savePodUploadSheetMiaoshouAiTitleConfig,
    generatePodUploadSheetMiaoshouAiTitles,
    cancelPodUploadSheetMiaoshouAiTitles,
    getPodUploadSheetMiaoshouUniversalTemplateSnapshot,
    syncPodUploadSheetMiaoshouUniversalTemplates,
    getPodUploadSheetMiaoshouUniversalFormTemplates,
    savePodUploadSheetMiaoshouUniversalFormTemplate,
    deletePodUploadSheetMiaoshouUniversalFormTemplate,
    getPodUploadSheetMiaoshouUniversalWorkspaceState,
    savePodUploadSheetMiaoshouUniversalWorkspaceState,
    selectPodUploadSheetMiaoshouUniversalImportDirectory,
    exportPodUploadSheetMiaoshouUniversalTable,
    uploadPodUploadSheetMiaoshouUniversalCosImages,
    cancelPodUploadSheetMiaoshouUniversalCosImages,
    getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot
  } = options;
  const {
    fb_aiTitles,
    fb_categories,
    fb_cancel,
    fb_cosUpload,
    fb_exportTable,
    fb_formTemplates,
    fb_importDirectory,
    fb_progressSnapshot,
    fb_saveFormTemplate,
    fb_templates,
    fb_universalWorkspaceState,
    fb_workspaceState
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_CATEGORIES, async () => {
    if (typeof getPodUploadSheetMiaoshouCategories !== 'function') return fb_categories();
    return getPodUploadSheetMiaoshouCategories();
  });

  handle(FEATURE_CHANNELS.SYNC_POD_UPLOAD_SHEET_MIAOSHOU_CATEGORIES, async () => {
    if (typeof syncPodUploadSheetMiaoshouCategories !== 'function') return fb_categories();
    return syncPodUploadSheetMiaoshouCategories();
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_TEMPLATE_SNAPSHOT, async () => {
    if (typeof getPodUploadSheetMiaoshouTemplateSnapshot !== 'function') return fb_templates();
    return getPodUploadSheetMiaoshouTemplateSnapshot();
  });

  handle(FEATURE_CHANNELS.SYNC_POD_UPLOAD_SHEET_MIAOSHOU_TEMPLATES, async () => {
    if (typeof syncPodUploadSheetMiaoshouTemplates !== 'function') return fb_templates();
    return syncPodUploadSheetMiaoshouTemplates();
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_FORM_TEMPLATES, async () => {
    if (typeof getPodUploadSheetMiaoshouFormTemplates !== 'function') return fb_formTemplates();
    return getPodUploadSheetMiaoshouFormTemplates();
  });

  handle(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_FORM_TEMPLATE, async (_event, payload) => {
    if (typeof savePodUploadSheetMiaoshouFormTemplate !== 'function') return fb_saveFormTemplate();
    return savePodUploadSheetMiaoshouFormTemplate(payload);
  });

  handle(FEATURE_CHANNELS.DELETE_POD_UPLOAD_SHEET_MIAOSHOU_FORM_TEMPLATE, async (_event, payload) => {
    if (typeof deletePodUploadSheetMiaoshouFormTemplate !== 'function') return fb_saveFormTemplate();
    return deletePodUploadSheetMiaoshouFormTemplate(payload);
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_WORKSPACE_STATE, async () => {
    if (typeof getPodUploadSheetMiaoshouWorkspaceState !== 'function') return fb_workspaceState();
    return getPodUploadSheetMiaoshouWorkspaceState();
  });

  handle(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_WORKSPACE_STATE, async (_event, payload) => {
    if (typeof savePodUploadSheetMiaoshouWorkspaceState !== 'function') return fb_workspaceState();
    return savePodUploadSheetMiaoshouWorkspaceState(payload);
  });

  handle(FEATURE_CHANNELS.SELECT_POD_UPLOAD_SHEET_MIAOSHOU_IMPORT_DIRECTORY, async (event, payload) => {
    if (typeof selectPodUploadSheetMiaoshouImportDirectory !== 'function') return fb_importDirectory();
    return selectPodUploadSheetMiaoshouImportDirectory(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.EXPORT_POD_UPLOAD_SHEET_MIAOSHOU_TABLE, async (event, payload) => {
    if (typeof exportPodUploadSheetMiaoshouTable !== 'function') return fb_exportTable();
    return exportPodUploadSheetMiaoshouTable(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.UPLOAD_POD_UPLOAD_SHEET_MIAOSHOU_COS_IMAGES, async (_event, payload) => {
    if (typeof uploadPodUploadSheetMiaoshouCosImages !== 'function') return fb_cosUpload();
    return uploadPodUploadSheetMiaoshouCosImages(payload);
  });

  handle(FEATURE_CHANNELS.CANCEL_POD_UPLOAD_SHEET_MIAOSHOU_COS_IMAGES, async (_event, payload) => {
    if (typeof cancelPodUploadSheetMiaoshouCosImages !== 'function') return fb_cancel();
    return cancelPodUploadSheetMiaoshouCosImages(payload);
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_COS_UPLOAD_PROGRESS_SNAPSHOT, async (_event, payload) => {
    if (typeof getPodUploadSheetMiaoshouCosUploadProgressSnapshot !== 'function') return fb_progressSnapshot();
    return getPodUploadSheetMiaoshouCosUploadProgressSnapshot(payload);
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_CONFIG, async () => {
    if (typeof getPodUploadSheetMiaoshouAiTitleConfig !== 'function') {
      return {
        settings: {
          apiBaseUrl: '',
          model: '',
          apiKeys: []
        },
        source: 'unavailable'
      };
    }
    return getPodUploadSheetMiaoshouAiTitleConfig();
  });

  handle(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLE_CONFIG, async (_event, payload) => {
    if (typeof savePodUploadSheetMiaoshouAiTitleConfig !== 'function') {
      return {
        settings: {
          apiBaseUrl: '',
          model: '',
          apiKeys: []
        },
        source: 'unavailable',
        cloudSynced: false
      };
    }
    return savePodUploadSheetMiaoshouAiTitleConfig(payload);
  });

  handle(FEATURE_CHANNELS.GENERATE_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLES, async (event, payload) => {
    if (typeof generatePodUploadSheetMiaoshouAiTitles !== 'function') return fb_aiTitles();
    return generatePodUploadSheetMiaoshouAiTitles(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.CANCEL_POD_UPLOAD_SHEET_MIAOSHOU_AI_TITLES, async (_event, payload) => {
    if (typeof cancelPodUploadSheetMiaoshouAiTitles !== 'function') return fb_cancel();
    return cancelPodUploadSheetMiaoshouAiTitles(payload);
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_TEMPLATE_SNAPSHOT, async () => {
    if (typeof getPodUploadSheetMiaoshouUniversalTemplateSnapshot !== 'function') return fb_templates();
    return getPodUploadSheetMiaoshouUniversalTemplateSnapshot();
  });

  handle(FEATURE_CHANNELS.SYNC_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_TEMPLATES, async () => {
    if (typeof syncPodUploadSheetMiaoshouUniversalTemplates !== 'function') return fb_templates();
    return syncPodUploadSheetMiaoshouUniversalTemplates();
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_FORM_TEMPLATES, async () => {
    if (typeof getPodUploadSheetMiaoshouUniversalFormTemplates !== 'function') return fb_formTemplates();
    return getPodUploadSheetMiaoshouUniversalFormTemplates();
  });

  handle(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_FORM_TEMPLATE, async (_event, payload) => {
    if (typeof savePodUploadSheetMiaoshouUniversalFormTemplate !== 'function') return fb_saveFormTemplate();
    return savePodUploadSheetMiaoshouUniversalFormTemplate(payload);
  });

  handle(FEATURE_CHANNELS.DELETE_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_FORM_TEMPLATE, async (_event, payload) => {
    if (typeof deletePodUploadSheetMiaoshouUniversalFormTemplate !== 'function') return fb_saveFormTemplate();
    return deletePodUploadSheetMiaoshouUniversalFormTemplate(payload);
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_WORKSPACE_STATE, async () => {
    if (typeof getPodUploadSheetMiaoshouUniversalWorkspaceState !== 'function') return fb_universalWorkspaceState();
    return getPodUploadSheetMiaoshouUniversalWorkspaceState();
  });

  handle(FEATURE_CHANNELS.SAVE_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_WORKSPACE_STATE, async (_event, payload) => {
    if (typeof savePodUploadSheetMiaoshouUniversalWorkspaceState !== 'function') return fb_universalWorkspaceState();
    return savePodUploadSheetMiaoshouUniversalWorkspaceState(payload);
  });

  handle(FEATURE_CHANNELS.SELECT_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_IMPORT_DIRECTORY, async (event, payload) => {
    if (typeof selectPodUploadSheetMiaoshouUniversalImportDirectory !== 'function') return fb_importDirectory();
    return selectPodUploadSheetMiaoshouUniversalImportDirectory(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.EXPORT_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_TABLE, async (event, payload) => {
    if (typeof exportPodUploadSheetMiaoshouUniversalTable !== 'function') return fb_exportTable();
    return exportPodUploadSheetMiaoshouUniversalTable(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.UPLOAD_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_COS_IMAGES, async (_event, payload) => {
    if (typeof uploadPodUploadSheetMiaoshouUniversalCosImages !== 'function') return fb_cosUpload();
    return uploadPodUploadSheetMiaoshouUniversalCosImages(payload);
  });

  handle(FEATURE_CHANNELS.CANCEL_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_COS_IMAGES, async (_event, payload) => {
    if (typeof cancelPodUploadSheetMiaoshouUniversalCosImages !== 'function') return fb_cancel();
    return cancelPodUploadSheetMiaoshouUniversalCosImages(payload);
  });

  handle(FEATURE_CHANNELS.GET_POD_UPLOAD_SHEET_MIAOSHOU_UNIVERSAL_COS_UPLOAD_PROGRESS_SNAPSHOT, async (_event, payload) => {
    if (typeof getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot !== 'function') return fb_progressSnapshot();
    return getPodUploadSheetMiaoshouUniversalCosUploadProgressSnapshot(payload);
  });
}

module.exports = {
  registerFeatureCenterPodUploadIpc
};
