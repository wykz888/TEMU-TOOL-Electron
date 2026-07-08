const {
  normalizeText,
  nowIso
} = require('../shopManagement/common');

function createGlobalAiTitleConfigAdapter({
  globalConfigService,
  legacyAiTitleConfigService
}) {
  function normalizeApiKeys(value) {
    const sourceValues = Array.isArray(value)
      ? value
      : String(value || '').replace(/\r\n/g, '\n').split('\n');
    const seenKeys = new Set();

    return sourceValues.reduce((result, item) => {
      const apiKey = typeof item === 'string'
        ? normalizeText(item)
        : normalizeText(item && item.apiKey);

      if (!apiKey || seenKeys.has(apiKey)) {
        return result;
      }

      seenKeys.add(apiKey);
      result.push(apiKey);
      return result;
    }, []);
  }

  function getVolcengineConfig(aiConfig) {
    return aiConfig
      && aiConfig.providers
      && aiConfig.providers.volcengine
      ? aiConfig.providers.volcengine
      : {};
  }

  function toSettings(aiConfig) {
    const volcengine = getVolcengineConfig(aiConfig);

    return {
      version: 1,
      owner: aiConfig && aiConfig.owner ? aiConfig.owner : null,
      updatedAt: normalizeText(aiConfig && aiConfig.updatedAt) || nowIso(),
      apiBaseUrl: normalizeText(volcengine.apiBaseUrl),
      model: normalizeText(volcengine.model),
      apiKeys: normalizeApiKeys(volcengine.apiKeys)
    };
  }

  function toGlobalApiKeyRecords(apiKeys, currentRecords) {
    const currentByKey = new Map(
      (Array.isArray(currentRecords) ? currentRecords : [])
        .map((record) => [normalizeText(record && record.apiKey), record])
        .filter(([apiKey]) => apiKey)
    );

    return normalizeApiKeys(apiKeys).map((apiKey, index) => {
      const previous = currentByKey.get(apiKey);

      return {
        id: normalizeText(previous && previous.id) || `${Date.now().toString(36)}-${index}`,
        name: normalizeText(previous && previous.name) || `APIKEY ${index + 1}`,
        apiKey,
        enabled: previous && previous.enabled === false ? false : true,
        lastTestedAt: normalizeText(previous && previous.lastTestedAt),
        lastTestStatus: previous && (previous.lastTestStatus === 'success' || previous.lastTestStatus === 'error')
          ? previous.lastTestStatus
          : 'untested',
        lastTestMessage: normalizeText(previous && previous.lastTestMessage)
      };
    });
  }

  async function getLegacySettings() {
    if (!legacyAiTitleConfigService || typeof legacyAiTitleConfigService.getConfig !== 'function') {
      return null;
    }

    try {
      const result = await legacyAiTitleConfigService.getConfig();

      return result && result.settings ? result.settings : null;
    } catch (_error) {
      return null;
    }
  }

  async function getConfig() {
    const aiConfig = await globalConfigService.getAiConfig();
    const settings = toSettings(aiConfig);

    if (settings.apiKeys.length > 0) {
      return {
        settings,
        source: 'global-config'
      };
    }

    const legacySettings = await getLegacySettings();
    const legacyApiKeys = normalizeApiKeys(legacySettings && legacySettings.apiKeys);

    if (legacyApiKeys.length > 0) {
      return saveConfig({
        ...legacySettings,
        apiKeys: legacyApiKeys
      });
    }

    return {
      settings,
      source: 'global-config'
    };
  }

  async function getCachedConfig() {
    return getConfig();
  }

  async function saveConfig(payload) {
    const currentConfig = await globalConfigService.getAiConfig();
    const currentVolcengine = getVolcengineConfig(currentConfig);
    const source = payload && typeof payload === 'object' ? payload : {};
    const nextConfig = await globalConfigService.saveAiConfig({
      activeProvider: 'volcengine',
      providers: {
        volcengine: {
          enabled: source.enabled === false ? false : currentVolcengine.enabled !== false,
          apiBaseUrl: normalizeText(source.apiBaseUrl) || normalizeText(currentVolcengine.apiBaseUrl),
          model: normalizeText(source.model) || normalizeText(currentVolcengine.model),
          apiKeys: toGlobalApiKeyRecords(source.apiKeys || source.apiKey, currentVolcengine.apiKeys)
        }
      }
    });

    return {
      settings: toSettings(nextConfig),
      source: 'global-config',
      cloudSynced: nextConfig && nextConfig.cloudSynced !== false,
      warning: nextConfig && nextConfig.warning ? nextConfig.warning : ''
    };
  }

  return {
    getConfig,
    getCachedConfig,
    saveConfig
  };
}

module.exports = {
  createGlobalAiTitleConfigAdapter
};
