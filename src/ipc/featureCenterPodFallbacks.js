function fb_templates() {
  return { updatedAt: '', templates: [] };
}

function fb_categories() {
  return { updatedAt: '', sourceUrl: '', categories: [] };
}

function fb_formTemplates() {
  return { updatedAt: '', templates: [], source: 'unavailable' };
}

function fb_saveFormTemplate() {
  return { updatedAt: '', templates: [], source: 'unavailable', cloudSynced: false };
}

function fb_workspaceState() {
  return {
    updatedAt: '',
    workspace: { globalProductSettings: {}, products: [], activeProductId: '' },
    source: 'unavailable'
  };
}

function fb_universalWorkspaceState() {
  return {
    updatedAt: '',
    workspace: { lastImportDirectoryPath: '' },
    source: 'unavailable'
  };
}

function fb_importDirectory() {
  return { canceled: true, directoryPath: '', files: [] };
}

function fb_exportTable() {
  return {
    canceled: true, filePath: '', filePaths: [],
    rowCount: 0, productCount: 0, exports: []
  };
}

function fb_cosUpload() {
  return {
    updatedAt: '', bucket: '', region: '', canceled: false,
    totalCount: 0, successCount: 0, uploadedCount: 0, cachedCount: 0,
    failedCount: 0, canceledCount: 0, items: []
  };
}

function fb_aiTitles() {
  return {
    updatedAt: '', requestedModel: '', resolvedModel: '', canceled: false,
    totalCount: 0, successCount: 0, failedCount: 0, canceledCount: 0, items: []
  };
}

module.exports = {
  fb_aiTitles,
  fb_categories,
  fb_cosUpload,
  fb_exportTable,
  fb_formTemplates,
  fb_importDirectory,
  fb_saveFormTemplate,
  fb_templates,
  fb_universalWorkspaceState,
  fb_workspaceState
};
