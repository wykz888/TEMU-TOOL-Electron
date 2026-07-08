function registerFeatureCenterOperationsNewProductLifecycleIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    log,
    logError,
    queryOperationsNewProductLifecycleRows,
    cancelOperationsNewProductLifecycleQuery,
    getOperationsNewProductLifecycleQuerySettings,
    saveOperationsNewProductLifecycleQuerySettings,
    getOperationsNewProductLifecycleBatchAdjustPresetSnapshot,
    saveOperationsNewProductLifecycleBatchAdjustPresetBatch,
    previewOperationsNewProductLifecycleBatchAdjust,
    submitOperationsNewProductLifecycleBatchAdjust,
    cancelOperationsNewProductLifecycleBatchAdjust,
    previewOperationsNewProductLifecycleBatchPriceDecl,
    submitOperationsNewProductLifecycleBatchPriceDecl,
    cancelOperationsNewProductLifecycleBatchPriceDecl,
    getOperationsNewProductLifecyclePriceDeclSettings,
    saveOperationsNewProductLifecyclePriceDeclSettings
  } = options;
  const {
    fb_canceled,
    fb_nplcBatchPreview,
    fb_nplcBatchSubmit,
    fb_nplcPresetSavedWithSettings,
    fb_nplcPresetWithSettings,
    fb_nplcQueryResult,
    fb_nplcSettings,
    fb_nplcSettingsSaved
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.QUERY_OPERATIONS_NEW_PRODUCT_LIFECYCLE_ROWS, async (event, payload) => {
    log('operations_new_product_lifecycle_query_ipc_invoked', {
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryOperationsNewProductLifecycleRows !== 'function') return fb_nplcQueryResult();

    try {
      return await queryOperationsNewProductLifecycleRows(payload, {
        event
      });
    } catch (error) {
      logError('operations_new_product_lifecycle_query_ipc_failed', error, {
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY, async (_event, payload) => {
    if (typeof cancelOperationsNewProductLifecycleQuery !== 'function') return fb_canceled(payload);
    return cancelOperationsNewProductLifecycleQuery(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_SETTINGS, async () => {
    if (typeof getOperationsNewProductLifecycleQuerySettings !== 'function') return fb_nplcSettings();
    return getOperationsNewProductLifecycleQuerySettings();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_QUERY_SETTINGS, async (_event, payload) => {
    if (typeof saveOperationsNewProductLifecycleQuerySettings !== 'function') return fb_nplcSettingsSaved();
    return saveOperationsNewProductLifecycleQuerySettings(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PRESET_SNAPSHOT, async (_event, payload) => {
    if (typeof getOperationsNewProductLifecycleBatchAdjustPresetSnapshot !== 'function') return fb_nplcPresetWithSettings();
    return getOperationsNewProductLifecycleBatchAdjustPresetSnapshot(payload);
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST_PRESET_BATCH, async (_event, payload) => {
    if (typeof saveOperationsNewProductLifecycleBatchAdjustPresetBatch !== 'function') return fb_nplcPresetSavedWithSettings();
    return saveOperationsNewProductLifecycleBatchAdjustPresetBatch(payload);
  });

  handle(FEATURE_CHANNELS.PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST, async (event, payload) => {
    log('operations_new_product_lifecycle_batch_adjust_preview_ipc_invoked', {
      rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof previewOperationsNewProductLifecycleBatchAdjust !== 'function') {
      return fb_nplcBatchPreview(payload);
    }

    try {
      const result = await previewOperationsNewProductLifecycleBatchAdjust(payload, {
        event
      });
      log('operations_new_product_lifecycle_batch_adjust_preview_ipc_completed', {
        rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
        previewItemCount: Array.isArray(result && result.previewItems) ? result.previewItems.length : 0,
        groupedRequestCount: Array.isArray(result && result.groupedRequests) ? result.groupedRequests.length : 0,
        success: Boolean(result && result.success),
        canceled: Boolean(result && result.canceled),
        senderId: event && event.sender ? event.sender.id : 0
      });
      return result;
    } catch (error) {
      logError('operations_new_product_lifecycle_batch_adjust_preview_ipc_failed', error, {
        rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST, async (event, payload) => {
    log('operations_new_product_lifecycle_batch_adjust_submit_ipc_invoked', {
      runId: String(payload && payload.runId || '').trim(),
      rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof submitOperationsNewProductLifecycleBatchAdjust !== 'function') return fb_nplcBatchSubmit(payload);

    try {
      return await submitOperationsNewProductLifecycleBatchAdjust(payload, {
        event
      });
    } catch (error) {
      logError('operations_new_product_lifecycle_batch_adjust_submit_ipc_failed', error, {
        runId: String(payload && payload.runId || '').trim(),
        rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_ADJUST, async (_event, payload) => {
    if (typeof cancelOperationsNewProductLifecycleBatchAdjust !== 'function') return fb_canceled(payload);
    return cancelOperationsNewProductLifecycleBatchAdjust(payload);
  });

  handle(FEATURE_CHANNELS.PREVIEW_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL, async (event, payload) => {
    log('operations_new_product_lifecycle_batch_price_decl_preview_ipc_invoked', {
      rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof previewOperationsNewProductLifecycleBatchPriceDecl !== 'function') {
      return { success: false, message: '\u6838\u4ef7\u9884\u89c8\u529f\u80fd\u4e0d\u53ef\u7528', previewItems: [], groupedRequests: [], summary: { total: 0, approve: 0, redeclare: 0, void: 0, skip: 0 }, resultsByShop: [] };
    }

    try {
      return await previewOperationsNewProductLifecycleBatchPriceDecl(payload);
    } catch (error) {
      logError('operations_new_product_lifecycle_batch_price_decl_preview_ipc_failed', error, {
        rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.SUBMIT_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL, async (event, payload) => {
    log('operations_new_product_lifecycle_batch_price_decl_submit_ipc_invoked', {
      rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof submitOperationsNewProductLifecycleBatchPriceDecl !== 'function') {
      return { success: false, message: '\u6838\u4ef7\u63d0\u4ea4\u529f\u80fd\u4e0d\u53ef\u7528', results: [] };
    }

    try {
      return await submitOperationsNewProductLifecycleBatchPriceDecl(payload, {
        event
      });
    } catch (error) {
      logError('operations_new_product_lifecycle_batch_price_decl_submit_ipc_failed', error, {
        rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_NEW_PRODUCT_LIFECYCLE_BATCH_PRICE_DECL, async (_event, payload) => {
    if (typeof cancelOperationsNewProductLifecycleBatchPriceDecl !== 'function') {
      return { canceled: false };
    }
    return cancelOperationsNewProductLifecycleBatchPriceDecl(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_NEW_PRODUCT_LIFECYCLE_PRICE_DECL_SETTINGS, async () => {
    if (typeof getOperationsNewProductLifecyclePriceDeclSettings !== 'function') {
      return { settings: {}, source: 'default' };
    }
    return getOperationsNewProductLifecyclePriceDeclSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_NEW_PRODUCT_LIFECYCLE_PRICE_DECL_SETTINGS, async (_event, payload) => {
    if (typeof saveOperationsNewProductLifecyclePriceDeclSettings !== 'function') {
      return { settings: {}, source: 'default' };
    }
    return saveOperationsNewProductLifecyclePriceDeclSettings(payload);
  });
}

module.exports = {
  registerFeatureCenterOperationsNewProductLifecycleIpc
};
