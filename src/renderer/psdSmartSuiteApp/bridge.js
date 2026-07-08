function createEntityId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function getBridge() {
  if (!window.temuApp || !window.temuApp.podSuiteTool) {
    throw new Error('POD Suite Tool API 未就绪。');
  }
  return window.temuApp.podSuiteTool;
}

const WINDOW_RUN_ID = createEntityId('psd_smart_suite_window');

const bridge = {
  getWindowRunId() {
    return WINDOW_RUN_ID;
  },

  async selectPsdMockupFile(payload) {
    return getBridge().selectPsdMockupFile(payload);
  },

  async selectPsdImageDirectory(payload) {
    return getBridge().selectPsdImageDirectory(payload);
  },

  async selectPsdOutputDirectory(payload) {
    return getBridge().selectPsdOutputDirectory(payload);
  },

  async selectPsdMetadataSourceFile(payload) {
    return getBridge().selectPsdMetadataSourceFile(payload);
  },

  async selectPsdMetadataSourceDirectory(payload) {
    return getBridge().selectPsdMetadataSourceDirectory(payload);
  },

  async collectImageFiles(payload) {
    return getBridge().collectImageFiles(payload);
  },

  async openDirectory(payload) {
    return getBridge().openDirectory(payload);
  },

  async generatePsdSmartObjectMockups(payload) {
    return getBridge().generatePsdSmartObjectMockups(payload);
  },

  async cancelPsdSmartObjectMockups(payload) {
    return getBridge().cancelPsdSmartObjectMockups(payload);
  },

  async setPsdEngineWindowVisible(payload) {
    return getBridge().setPsdEngineWindowVisible(payload);
  },

  async getPsdSmartObjectTemplates(payload) {
    return getBridge().getPsdSmartObjectTemplates(payload);
  },

  async savePsdSmartObjectTemplate(payload) {
    return getBridge().savePsdSmartObjectTemplate(payload);
  },

  async deletePsdSmartObjectTemplate(payload) {
    return getBridge().deletePsdSmartObjectTemplate(payload);
  },

  onPsdSmartObjectProgress(listener) {
    return getBridge().onPsdSmartObjectProgress(listener);
  }
};

export default bridge;
