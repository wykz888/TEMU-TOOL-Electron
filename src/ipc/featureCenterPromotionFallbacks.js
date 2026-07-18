function fb_promotionSettings() {
  return { settings: null, source: 'unavailable' };
}

function fb_promotionManagerNewCreateSettings() {
  return {
    settings: {
      version: 1,
      owner: null,
      updatedAt: '',
      createPromotion: {
        selectedShopIds: [],
        selectedRegionIds: []
      }
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

module.exports = {
  fb_promotionManagerNewCreateSettings,
  fb_promotionMonitor,
  fb_promotionSettings
};
