function registerFeatureCenterOperationsPriceDeclarationIpc(options = {}) {
  const {
    FEATURE_CHANNELS,
    handle,
    log,
    logError,
    queryOperationsPriceDeclarationRows,
    cancelOperationsPriceDeclarationQuery,
    getOperationsPriceDeclarationQuerySettings,
    saveOperationsPriceDeclarationQuerySettings,
    getOperationsPriceDeclarationQuickCostPresetSnapshot,
    saveOperationsPriceDeclarationQuickCostPresetBatch,
    getOperationsPriceDeclarationReviewRules,
    saveOperationsPriceDeclarationReviewRules,
    batchRejectOperationsPriceDeclarationRows,
    getOperationsPriceDeclarationProgressSnapshot
  } = options;
  const {
    fb_canceled,
    fb_priceBatchReject,
    fb_priceQueryResult,
    fb_priceQuickCost,
    fb_priceQuickCostSaved,
    fb_priceSettings,
    fb_priceSettingsSaved,
    fb_progressSnapshot,
    fb_reviewRules,
    fb_reviewRulesSaved
  } = options.fallbacks || {};

  handle(FEATURE_CHANNELS.QUERY_OPERATIONS_PRICE_DECLARATION_ROWS, async (event, payload) => {
    log('operations_price_declaration_query_ipc_invoked', {
      runId: String(payload && payload.runId || '').trim(),
      shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
      senderId: event && event.sender ? event.sender.id : 0
    });

    if (typeof queryOperationsPriceDeclarationRows !== 'function') return fb_priceQueryResult(payload);

    try {
      return await queryOperationsPriceDeclarationRows(payload, {
        event
      });
    } catch (error) {
      logError('operations_price_declaration_query_ipc_failed', error, {
        runId: String(payload && payload.runId || '').trim(),
        shopCount: Array.isArray(payload && payload.shopIds) ? payload.shopIds.length : 0,
        senderId: event && event.sender ? event.sender.id : 0
      });
      throw error;
    }
  });

  handle(FEATURE_CHANNELS.CANCEL_OPERATIONS_PRICE_DECLARATION_QUERY, async (event, payload) => {
    if (typeof cancelOperationsPriceDeclarationQuery !== 'function') return fb_canceled(payload);
    return cancelOperationsPriceDeclarationQuery(payload, {
      event
    });
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_QUERY_SETTINGS, async () => {
    if (typeof getOperationsPriceDeclarationQuerySettings !== 'function') return fb_priceSettings();
    return getOperationsPriceDeclarationQuerySettings();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_PRICE_DECLARATION_QUERY_SETTINGS, async (_event, payload) => {
    if (typeof saveOperationsPriceDeclarationQuerySettings !== 'function') return fb_priceSettingsSaved();
    return saveOperationsPriceDeclarationQuerySettings(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_QUICK_COST_PRESET_SNAPSHOT, async (_event, payload) => {
    if (typeof getOperationsPriceDeclarationQuickCostPresetSnapshot !== 'function') return fb_priceQuickCost();
    return getOperationsPriceDeclarationQuickCostPresetSnapshot(payload);
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_PRICE_DECLARATION_QUICK_COST_PRESET_BATCH, async (_event, payload) => {
    if (typeof saveOperationsPriceDeclarationQuickCostPresetBatch !== 'function') return fb_priceQuickCostSaved();
    return saveOperationsPriceDeclarationQuickCostPresetBatch(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_REVIEW_RULES, async () => {
    if (typeof getOperationsPriceDeclarationReviewRules !== 'function') return fb_reviewRules();
    return getOperationsPriceDeclarationReviewRules();
  });

  handle(FEATURE_CHANNELS.SAVE_OPERATIONS_PRICE_DECLARATION_REVIEW_RULES, async (_event, payload) => {
    if (typeof saveOperationsPriceDeclarationReviewRules !== 'function') return fb_reviewRulesSaved();
    return saveOperationsPriceDeclarationReviewRules(payload);
  });

  handle(FEATURE_CHANNELS.BATCH_REJECT_OPERATIONS_PRICE_DECLARATION_ROWS, async (_event, payload) => {
    if (typeof batchRejectOperationsPriceDeclarationRows !== 'function') return fb_priceBatchReject();
    return batchRejectOperationsPriceDeclarationRows(payload);
  });

  handle(FEATURE_CHANNELS.GET_OPERATIONS_PRICE_DECLARATION_PROGRESS_SNAPSHOT, async (_event, payload) => {
    if (typeof getOperationsPriceDeclarationProgressSnapshot !== 'function') return fb_progressSnapshot();
    return getOperationsPriceDeclarationProgressSnapshot(payload);
  });
}

module.exports = {
  registerFeatureCenterOperationsPriceDeclarationIpc
};
