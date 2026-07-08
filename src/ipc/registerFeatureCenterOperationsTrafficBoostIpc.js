function registerFeatureCenterOperationsTrafficBoostIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    log,
    logError,
    queryOperationsTrafficBoostRows,
    submitOperationsTrafficBoostProducts,
    cancelOperationsTrafficBoostSubmit,
    cancelOperationsTrafficBoostQuery,
    getOperationsTrafficBoostProgressSnapshot,
    getOperationsTrafficBoostCustomLevelFilterSettings,
    saveOperationsTrafficBoostCustomLevelFilterSettings
  } = options;
  const {
    fb_canceled,
    fb_progressSnapshot,
    fb_trafficBoostCustomLevelFilterSettings,
    fb_trafficBoostCustomLevelFilterSettingsSaved,
    fb_trafficBoostQueryResult,
    fb_trafficBoostSubmitCanceled,
    fb_trafficBoostSubmitResult
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.QUERY_OPERATIONS_TRAFFIC_BOOST_ROWS, async (event, payload) => {
    log('operations_traffic_boost_query_ipc_invoked', {
      runId: String(payload && payload.runId || '').trim(),
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryOperationsTrafficBoostRows !== 'function') return fb_trafficBoostQueryResult(payload);

    try {
      return await queryOperationsTrafficBoostRows(payload, {
        event
      });
    } catch (error) {
      logError('operations_traffic_boost_query_ipc_failed', error, {
        runId: String(payload && payload.runId || '').trim(),
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.SUBMIT_OPERATIONS_TRAFFIC_BOOST_PRODUCTS, async (event, payload) => {
    log('operations_traffic_boost_submit_ipc_invoked', {
      requestId: String(payload && payload.requestId || '').trim(),
      productCount: Array.isArray(payload && payload.products) ? payload.products.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof submitOperationsTrafficBoostProducts !== 'function') {
      return fb_trafficBoostSubmitResult(payload);
    }

    try {
      return await submitOperationsTrafficBoostProducts(payload, {
        event
      });
    } catch (error) {
      logError('operations_traffic_boost_submit_ipc_failed', error, {
        requestId: String(payload && payload.requestId || '').trim(),
        productCount: Array.isArray(payload && payload.products) ? payload.products.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_TRAFFIC_BOOST_QUERY, async (event, payload) => {
    if (typeof cancelOperationsTrafficBoostQuery !== 'function') return fb_canceled(payload);
    return cancelOperationsTrafficBoostQuery(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_TRAFFIC_BOOST_SUBMIT, async (event, payload) => {
    if (typeof cancelOperationsTrafficBoostSubmit !== 'function') return fb_trafficBoostSubmitCanceled(payload);
    return cancelOperationsTrafficBoostSubmit(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_TRAFFIC_BOOST_PROGRESS_SNAPSHOT, async (_event, payload) => {
    if (typeof getOperationsTrafficBoostProgressSnapshot !== 'function') return fb_progressSnapshot();
    return getOperationsTrafficBoostProgressSnapshot(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_TRAFFIC_BOOST_CUSTOM_LEVEL_FILTER_SETTINGS, async () => {
    if (typeof getOperationsTrafficBoostCustomLevelFilterSettings !== 'function') {
      return fb_trafficBoostCustomLevelFilterSettings();
    }
    return getOperationsTrafficBoostCustomLevelFilterSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_TRAFFIC_BOOST_CUSTOM_LEVEL_FILTER_SETTINGS, async (_event, payload) => {
    if (typeof saveOperationsTrafficBoostCustomLevelFilterSettings !== 'function') {
      return fb_trafficBoostCustomLevelFilterSettingsSaved();
    }
    return saveOperationsTrafficBoostCustomLevelFilterSettings(payload);
  });
}

module.exports = {
  registerFeatureCenterOperationsTrafficBoostIpc
};
