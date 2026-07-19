const {
  buildDefaultSettings: buildDefaultCreateSettings
} = require('../services/featureCenter/promotionManagerCreateSettingsModel');
const {
  buildDefaultSettings: buildDefaultDetailSettings
} = require('../services/featureCenter/promotionManagerDetailSettingsModel');

function fb_promotionManagerNewCreateSettings() {
  return {
    settings: buildDefaultCreateSettings(null),
    source: 'unavailable',
    cloudSynced: false,
    warning: ''
  };
}

function fb_promotionManagerNewDetailSettings() {
  return {
    settings: buildDefaultDetailSettings(null),
    source: 'unavailable',
    cloudSynced: false,
    warning: ''
  };
}

function fb_promotionManagerNewMonitorSettings() {
  return {
    settings: {
      version: 9,
      owner: null,
      updatedAt: '',
      monitorView: {
        activeFilter: 'all',
        selectedColumnIds: null,
        baseColumnWidths: null
      },
      monitorConfig: {
        monitorIntervalSeconds: 60,
        dailyOperationLimit: null,
        totalOperationLimit: null,
        autoPauseSpendThreshold: null,
        autoPauseRoasThreshold: null,
        conditionMaxRoas: null,
        minOrderCount: 1,
        regionIds: ['us', 'eu', 'global'],
        actionType: 'pause_plan',
        resumeIntervalMinutes: null,
        targetRoas: null
      },
      monitorShopConfigs: {}
    },
    source: 'unavailable',
    cloudSynced: false,
    warning: ''
  };
}

function fb_promotionMonitor() {
  return {
    updatedAt: '', batchMonitoringActive: false, enabledShopIds: [], shops: {}
  };
}

function fb_promotionMonitorRuntimeLogs() {
  return {
    updatedAt: '',
    totalCount: 0,
    entries: []
  };
}

module.exports = {
  fb_promotionManagerNewCreateSettings,
  fb_promotionManagerNewDetailSettings,
  fb_promotionManagerNewMonitorSettings,
  fb_promotionMonitor,
  fb_promotionMonitorRuntimeLogs
};
