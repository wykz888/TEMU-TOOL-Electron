function registerFeatureCenterOperationsActivityIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    log,
    logError,
    queryOperationsActivityManagementActivities,
    queryOperationsActivityManagementMatchProducts,
    getOperationsActivityManagementMatchProductsPage,
    queryOperationsActivityManagementMatchProductsBatch,
    cancelOperationsActivityManagementMatchProductsBatchQuery,
    cancelOperationsActivityManagementMatchProductsBatchSubmit,
    getOperationsActivityManagementMatchProductsBatchPage,
    submitOperationsActivityManagementMatchProductsBatch,
    startOperationsActivityManagementBackgroundLogSession,
    appendOperationsActivityManagementBackgroundLogRows,
    finishOperationsActivityManagementBackgroundLogSession,
    getOperationsActivityManagementFilterSettings,
    saveOperationsActivityManagementFilterSettings,
    getOperationsActivityManagementProductFilterSettings,
    saveOperationsActivityManagementProductFilterSettings
  } = options;
  const {
    fb_activityBackgroundLogSession,
    fb_activityBatchQueryCanceled,
    fb_activityBatchSignupCanceled,
    fb_activityBatchSignupSubmitResult,
    fb_activityFilterSettings,
    fb_activityFilterSettingsSaved,
    fb_activityMatchProductsBatchResult,
    fb_activityMatchProductsResult,
    fb_activityProductFilterSettings,
    fb_activityProductFilterSettingsSaved,
    fb_activityQueryResult
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_ACTIVITIES, async (event, payload) => {
    log('operations_activity_management_query_ipc_invoked', {
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryOperationsActivityManagementActivities !== 'function') return fb_activityQueryResult();

    try {
      return await queryOperationsActivityManagementActivities(payload, {
        event
      });
    } catch (error) {
      logError('operations_activity_management_query_ipc_failed', error, {
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS, async (event, payload) => {
    log('operations_activity_management_match_products_ipc_invoked', {
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      activityKey: String(payload && payload.activityKey || '').trim(),
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryOperationsActivityManagementMatchProducts !== 'function') {
      return fb_activityMatchProductsResult();
    }

    try {
      return await queryOperationsActivityManagementMatchProducts(payload, {
        event
      });
    } catch (error) {
      logError('operations_activity_management_match_products_ipc_failed', error, {
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        activityKey: String(payload && payload.activityKey || '').trim(),
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_PAGE, async (event, payload) => {
    log('operations_activity_management_match_products_page_ipc_invoked', {
      cacheKey: String(payload && payload.cacheKey || '').trim(),
      activityKey: String(payload && payload.activityKey || '').trim(),
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof getOperationsActivityManagementMatchProductsPage !== 'function') {
      return fb_activityMatchProductsResult();
    }

    try {
      return await getOperationsActivityManagementMatchProductsPage(payload, {
        event
      });
    } catch (error) {
      logError('operations_activity_management_match_products_page_ipc_failed', error, {
        cacheKey: String(payload && payload.cacheKey || '').trim(),
        activityKey: String(payload && payload.activityKey || '').trim(),
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.QUERY_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH, async (event, payload) => {
    log('operations_activity_management_match_products_batch_ipc_invoked', {
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      activityCount: Array.isArray(payload && payload.activities) ? payload.activities.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryOperationsActivityManagementMatchProductsBatch !== 'function') {
      return fb_activityMatchProductsBatchResult();
    }

    try {
      const emitProgress = (progressPayload) => {
        if (!event || !event.sender || event.sender.isDestroyed()) {
          return;
        }

        event.sender.send(FEATURE_CHANNELS.OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_PROGRESS, progressPayload);
      };

      return await queryOperationsActivityManagementMatchProductsBatch(payload, {
        event,
        emitProgress
      });
    } catch (error) {
      logError('operations_activity_management_match_products_batch_ipc_failed', error, {
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        activityCount: Array.isArray(payload && payload.activities) ? payload.activities.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_QUERY, async (_event, payload) => {
    if (typeof cancelOperationsActivityManagementMatchProductsBatchQuery !== 'function') {
      return fb_activityBatchQueryCanceled(payload);
    }
    return cancelOperationsActivityManagementMatchProductsBatchQuery(payload);
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_SUBMIT, async (_event, payload) => {
    if (typeof cancelOperationsActivityManagementMatchProductsBatchSubmit !== 'function') {
      return fb_activityBatchSignupCanceled(payload);
    }
    return cancelOperationsActivityManagementMatchProductsBatchSubmit(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH_PAGE, async (event, payload) => {
    log('operations_activity_management_match_products_batch_page_ipc_invoked', {
      cacheKey: String(payload && payload.cacheKey || '').trim(),
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof getOperationsActivityManagementMatchProductsBatchPage !== 'function') {
      return fb_activityMatchProductsBatchResult();
    }

    try {
      return await getOperationsActivityManagementMatchProductsBatchPage(payload, {
        event
      });
    } catch (error) {
      logError('operations_activity_management_match_products_batch_page_ipc_failed', error, {
        cacheKey: String(payload && payload.cacheKey || '').trim(),
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.SUBMIT_OPERATIONS_ACTIVITY_MANAGEMENT_MATCH_PRODUCTS_BATCH, async (event, payload) => {
    log('operations_activity_management_batch_signup_submit_ipc_invoked', {
      rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
      batchSize: Number(payload && payload.batchSize) || 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof submitOperationsActivityManagementMatchProductsBatch !== 'function') {
      return fb_activityBatchSignupSubmitResult(payload);
    }

    try {
      const emitProgress = (progressPayload) => {
        if (!event || !event.sender || event.sender.isDestroyed()) {
          return;
        }

        event.sender.send(FEATURE_CHANNELS.OPERATIONS_ACTIVITY_MANAGEMENT_BATCH_PROGRESS, progressPayload);
      };

      return await submitOperationsActivityManagementMatchProductsBatch(payload, {
        event,
        emitProgress
      });
    } catch (error) {
      logError('operations_activity_management_batch_signup_submit_ipc_failed', error, {
        rowCount: Array.isArray(payload && payload.rows) ? payload.rows.length : 0,
        batchSize: Number(payload && payload.batchSize) || 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.START_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_SESSION, async (_event, payload) => {
    if (typeof startOperationsActivityManagementBackgroundLogSession !== 'function') {
      return fb_activityBackgroundLogSession(payload);
    }

    return startOperationsActivityManagementBackgroundLogSession(payload);
  });

  handle(FEATURE_CHANNELS.APPEND_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_ROWS, async (_event, payload) => {
    if (typeof appendOperationsActivityManagementBackgroundLogRows !== 'function') {
      return fb_activityBackgroundLogSession(payload);
    }

    return appendOperationsActivityManagementBackgroundLogRows(payload);
  });

  handle(FEATURE_CHANNELS.FINISH_OPERATIONS_ACTIVITY_MANAGEMENT_BACKGROUND_LOG_SESSION, async (_event, payload) => {
    if (typeof finishOperationsActivityManagementBackgroundLogSession !== 'function') {
      return fb_activityBackgroundLogSession(payload);
    }

    return finishOperationsActivityManagementBackgroundLogSession(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_FILTER_SETTINGS, async () => {
    if (typeof getOperationsActivityManagementFilterSettings !== 'function') return fb_activityFilterSettings();
    return getOperationsActivityManagementFilterSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_ACTIVITY_MANAGEMENT_FILTER_SETTINGS, async (_event, payload) => {
    if (typeof saveOperationsActivityManagementFilterSettings !== 'function') return fb_activityFilterSettingsSaved();
    return saveOperationsActivityManagementFilterSettings(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_ACTIVITY_MANAGEMENT_PRODUCT_FILTER_SETTINGS, async () => {
    if (typeof getOperationsActivityManagementProductFilterSettings !== 'function') return fb_activityProductFilterSettings();
    return getOperationsActivityManagementProductFilterSettings();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_ACTIVITY_MANAGEMENT_PRODUCT_FILTER_SETTINGS, async (_event, payload) => {
    if (typeof saveOperationsActivityManagementProductFilterSettings !== 'function') return fb_activityProductFilterSettingsSaved();
    return saveOperationsActivityManagementProductFilterSettings(payload);
  });
}

module.exports = {
  registerFeatureCenterOperationsActivityIpc
};
