function fb_promotionSettings() {
  return { settings: null, source: 'unavailable' };
}

function fb_promotionMonitor() {
  return {
    updatedAt: '', batchMonitoringActive: false, enabledShopIds: [], shops: {}
  };
}

module.exports = {
  fb_promotionMonitor,
  fb_promotionSettings
};
