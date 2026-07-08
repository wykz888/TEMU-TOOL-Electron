function fb_categorySnapshot() {
  return {
    updatedAt: '', syncedAt: '', shopId: '', sourceOrigin: '',
    categories: [], source: 'unavailable', cloudSynced: false, warning: ''
  };
}

function fb_globalCategorySyncSnapshot() {
  return {
    updatedAt: '', syncedAt: '', shopId: '', shopName: '', sourceOrigin: '',
    source: 'unavailable', cloudSynced: false, rootCount: 0, totalCount: 0,
    leafCount: 0, nonLeafCount: 0, maxLevel: 0, requestCount: 0, warning: ''
  };
}

function fb_childCategories() {
  return {
    shopId: '', parentCatId: '', sourceOrigin: '', categories: [], fetchedAt: ''
  };
}

function fb_searchResults() {
  return {
    keyword: '', total: 0, limit: 0, results: [],
    sourceOrigin: '', fetchedAt: '', source: 'unavailable'
  };
}

function fb_shopSelectionSnapshot(payload) {
  const scopeKey = String(payload && payload.scopeKey || '').trim();
  return {
    snapshot: {
      version: 1, owner: null, updatedAt: '', scopeKey,
      templates: [],
      lastSelection: { scopeKey, selectedShopIds: [], updatedAt: '' }
    },
    source: 'unavailable', cloudSynced: false, warning: ''
  };
}

function fb_sharedCostSnapshot() {
  return {
    updatedAt: '', source: 'unavailable', shopIds: [], entryCount: 0, entries: []
  };
}

function fb_sharedCostSaved() {
  return {
    updatedAt: '', updatedEntryCount: 0, updatedShopCount: 0,
    cloudSynced: false, warning: ''
  };
}

module.exports = {
  fb_categorySnapshot,
  fb_childCategories,
  fb_globalCategorySyncSnapshot,
  fb_searchResults,
  fb_sharedCostSaved,
  fb_sharedCostSnapshot,
  fb_shopSelectionSnapshot
};
