const fs = require('node:fs');
const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  normalizeText,
  isShopParticipating
} = require('../shopManagement/common');
const {
  ADS_DETAIL_PAUSED_PAGE_SIZE,
  ADS_DETAIL_SORT_BY_PAUSED_STATUS,
  buildAdsDetailPayload: buildAdsDetailRequestPayload
} = require('./promotionAdsDetailUtils');
const {
  ADS_DETAIL_PAUSED_STATUS_CODE,
  extractIntegerByAliases,
  fetchAdsDetailItemsForRegion,
  resolveAdsDetailProductCount
} = require('./promotionMonitorAdsDetailItems');
const {
  createPromotionMonitorRuntimeLogStore
} = require('./promotionMonitorRuntimeLogStore');
const {
  isPlainObject,
  parseMetricNumber,
  normalizeRoasRawValue,
  formatMetricNumber,
  mapSummaryToMetrics,
  resolvePromotionOrderCountFromSummary,
  resolveSummaryGoodsCount
} = require('./promotionMonitorMetricUtils');
const {
  buildOperationDateKey,
  buildDefaultOperationStat,
  buildEmptyOperationSummary,
  normalizeOperationStats,
  buildOperationStatKey,
  buildDefaultConfig,
  buildEmptyRegionState,
  buildDefaultShopState,
  buildDefaultState,
  normalizeRegionState,
  normalizeConfig,
  buildPersistableConfig,
  normalizeState,
  buildSharedCloudState,
  compactStateOperationStats,
  mergeSharedCloudStateInto,
  buildPersistableState
} = require('./promotionMonitorStateModel');
const {
  SPEND_SORT_CHECK_INTERVAL_MS,
  EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MS,
  isSpendSortCheckDue,
  isEmptyPromotionRegionRecheckDue,
  resolveMonitorAutoPauseDecision,
  hasAutoPauseSpendThreshold,
  hasPrimaryMonitorAction,
  shouldUseAdListSummaryMonitorFlow,
  hasExecutableMonitorAction
} = require('./promotionMonitorOperationRules');
const {
  PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES,
  resolveStoredPausedState,
  resolveEffectivePausedState,
  resolveResumeIntervalMs,
  isPauseSequenceActionType,
  isResumeSequenceActionType,
  resolvePauseSequenceExecution,
  resolvePauseThenResumeNextRunAt,
  getDuePauseThenResumeRegionIds
} = require('./promotionMonitorPauseSequenceRules');
const {
  buildModifyAdsPayload
} = require('./promotionMonitorModifyPayloads');
const {
  DEFAULT_MONITOR_INTERVAL_MS,
  REGION_ENTRIES,
  MONITOR_OPERATION_REASON_TYPES,
  hasOwnField,
  normalizeMonitorConfig,
  normalizeMonitorConfigBundle,
  normalizeMonitorIntervalSecondsValue,
  normalizeNullableBoolean,
  resolveRequestedRegionEntries,
  resolveShopMonitorConfig
} = require('./promotionMonitorConfigModel');

const MODULE_ID = 'promotion-master-new-campaign-monitor';
const CONFIG_FILE_NAME = 'monitor-config.json';
const STATE_FILE_NAME = 'monitor-state.json';
const LOOP_INTERVAL_MS = 4000;
const RETRY_BASE_DELAY_MS = 20000;
const RETRY_MAX_DELAY_MS = 180000;
const ADS_MODIFY_URL = 'https://ads.temu.com/api/v1/coconut/ad/modify_ads';
const MONITOR_SETTINGS_REFRESH_MS = 5000;
const SHARED_STATE_CLOUD_PERSIST_DELAY_MS = 30000;
const EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MINUTES = Math.max(
  1,
  Math.round(EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MS / 60000)
);
const MONITOR_LOG_JOINED_WAITING = '\u5df2\u52a0\u5165\u6279\u91cf\u76d1\u63a7\u540d\u5355\uff0c\u7b49\u5f85\u5f00\u59cb';
const MONITOR_LOG_NOT_JOINED = '\u672a\u52a0\u5165\u6279\u91cf\u76d1\u63a7';
const MONITOR_LOG_ENABLED_WAIT_SYNC = '\u5df2\u5f00\u542f\u76d1\u63a7\uff0c\u7b49\u5f85\u4e0b\u4e00\u8f6e\u540c\u6b65';
const MONITOR_LOG_ENABLED_PREPARING = '\u5df2\u5f00\u542f\u76d1\u63a7\uff0c\u6b63\u5728\u51c6\u5907\u540c\u6b65';
const MONITOR_LOG_BATCH_STARTED_WAIT_SYNC = '\u6279\u91cf\u76d1\u63a7\u5df2\u542f\u52a8\uff0c\u7b49\u5f85\u4e0b\u4e00\u8f6e\u540c\u6b65';
const MONITOR_LOG_BATCH_STARTED_WAIT_RUN = '\u6279\u91cf\u76d1\u63a7\u5df2\u542f\u52a8\uff0c\u7b49\u5f85\u6267\u884c';

function createPromotionMonitorService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  getShopWindowBrowserController = null,
  promotionManagerSettingsService,
  promotionMasterSessionService,
  runtimeLogger
}) {
  let loadedOwnerKey = '';
  let currentOwner = null;
  let configCache = buildDefaultConfig(null);
  let stateCache = buildDefaultState(null);
  let monitorConfigCache = null;
  let monitorConfigLoadedAt = 0;
  let schedulerTimer = 0;
  let schedulerRunning = false;
  let persistStateTimer = 0;
  let persistSharedStateTimer = 0;
  let sharedStateLoadedAt = 0;
  let sharedStateDirty = false;
  let sharedStateRevision = 0;
  let sharedStatePersistedRevision = 0;
  const runtimeLogStore = createPromotionMonitorRuntimeLogStore();
  const runtimeLogShopMetaById = new Map();

  function log(eventName, payload) {
    appendRuntimeLog(eventName, payload);

    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    appendRuntimeLog(eventName, payload, {
      level: 'error',
      error
    });

    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function appendRuntimeLog(eventName, payload, options = {}) {
    const normalizedEventName = normalizeText(eventName);

    if (!normalizedEventName || !normalizedEventName.startsWith('promotion_monitor_')) {
      return;
    }

    const sourcePayload = payload && typeof payload === 'object' ? payload : {};
    const shopId = normalizeText(sourcePayload.shopId);
    const cachedShopMeta = shopId ? runtimeLogShopMetaById.get(shopId) : null;
    const nextPayload = {
      ...sourcePayload,
      shopId,
      shopName: normalizeText(sourcePayload.shopName)
        || normalizeText(cachedShopMeta && cachedShopMeta.shopName)
    };

    if (shopId && nextPayload.shopName) {
      runtimeLogShopMetaById.set(shopId, {
        shopId,
        shopName: nextPayload.shopName
      });
    }

    runtimeLogStore.append(normalizedEventName, nextPayload, options);
  }

  function updateShopStageLog(shopId, shopState, message, options = {}) {
    if (!shopState) {
      return;
    }

    const normalizedMessage = normalizeText(message);

    if (!normalizedMessage) {
      return;
    }

    shopState.log = normalizedMessage;
    stateCache.updatedAt = nowIso();
    scheduleStatePersist(0);

    if (options.writeRuntimeLog === true) {
      log('promotion_monitor_stage_changed', {
        shopId: normalizeText(shopId),
        stage: normalizeText(options.stage) || 'stage',
        regionId: normalizeText(options.regionId),
        message: normalizedMessage
      });
    }
  }

  function getOwner() {
    if (!sessionStore || typeof sessionStore.getSession !== 'function') {
      return null;
    }

    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getModuleEntry() {
    const moduleEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getEntryById === 'function'
        ? featureCenterProfileService.getEntryById(MODULE_ID)
        : null;

    if (!moduleEntry) {
      throw new Error('推广监控模块未注册，无法加载监控配置。');
    }

    return moduleEntry;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(
      payload && typeof payload === 'object' && payload.updatedAt
        ? payload.updatedAt
        : ''
    );

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? cloudPayload
        : localPayload;
    }

    return cloudPayload || localPayload || null;
  }

  function buildRegionLabelPreview(labels, limit = 2) {
    const normalizedLabels = Array.isArray(labels)
      ? labels.map((label) => normalizeText(label)).filter(Boolean)
      : [];

    if (normalizedLabels.length === 0) {
      return '';
    }

    if (normalizedLabels.length <= limit) {
      return normalizedLabels.join(' / ');
    }

    return `${normalizedLabels.slice(0, limit).join(' / ')} 等 ${normalizedLabels.length} 区`;
  }

  function buildRegionMonitorDataSummary(regionStates, regionIds) {
    const states = regionStates && typeof regionStates === 'object'
      ? regionStates
      : {};
    const targetRegions = resolveRequestedRegionEntries(regionIds);

    if (targetRegions.length === 0) {
      return '\u672a\u9009\u62e9\u76d1\u63a7\u5730\u533a';
    }

    const syncedLabels = [];

    targetRegions.forEach((region) => {
      const regionState = states[region.id] && typeof states[region.id] === 'object'
        ? states[region.id]
        : {};
      const summarySource = normalizeText(regionState.summarySource);
      const summary = regionState.summary && typeof regionState.summary === 'object'
        ? regionState.summary
        : {};
      const fetchedAt = normalizeText(regionState.fetchedAt);
      const detailFetched = regionState.detailFetched === true || summarySource === 'ads-detail';
      const detailMessage = normalizeText(regionState.detailMessage);
      const productCount = Math.max(
        0,
        Number.parseInt(regionState.productCount, 10)
        || Math.round(parseMetricNumber(summary.goods_num_label) || 0)
      );
      const orderCountLabel = normalizeText(summary.order_pay_count_label);
      let label = region.label;

      if (!summarySource && !fetchedAt && detailFetched !== true) {
        return;
      }

      if (productCount > 0) {
        label = `${region.label} ${productCount} \u5546\u54c1`;
      } else if (detailMessage) {
        label = `${region.label} \u6682\u65e0\u63a8\u5e7f`;
      } else if (orderCountLabel && orderCountLabel !== '--') {
        label = `${region.label} ${orderCountLabel} \u5355`;
      }

      syncedLabels.push(label);
    });

    if (syncedLabels.length === 0) {
      return '\u672a\u540c\u6b65';
    }

    return `\u5df2\u540c\u6b65 ${buildRegionLabelPreview(syncedLabels)}`;
  }

  function getStoredRegionState(shopState, regionId) {
    return (
      shopState
      && shopState.regions
      && typeof shopState.regions === 'object'
      && shopState.regions[regionId]
      && typeof shopState.regions[regionId] === 'object'
    )
      ? shopState.regions[regionId]
      : null;
  }

  function copyRegionRuntimeTimingFields(targetRegionState, sourceRegionState) {
    const targetState = targetRegionState && typeof targetRegionState === 'object'
      ? targetRegionState
      : {};
    const sourceState = sourceRegionState && typeof sourceRegionState === 'object'
      ? sourceRegionState
      : {};
    const lastSpendSortCheckedAt =
      normalizeText(targetState.lastSpendSortCheckedAt)
      || normalizeText(sourceState.lastSpendSortCheckedAt);

    return {
      ...targetState,
      lastSpendSortCheckedAt
    };
  }

  function buildNoPromotionRecheckMessage() {
    return `\u6682\u65e0\u63a8\u5e7f\uff0c\u6309 ${EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MINUTES} \u5206\u949f\u9891\u7387\u5ef6\u540e\u590d\u67e5`;
  }

  function buildAllRegionsNoPromotionRecheckMessage() {
    return `\u9009\u4e2d\u5730\u533a\u6682\u65e0\u63a8\u5e7f\uff0c\u6309 ${EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MINUTES} \u5206\u949f\u9891\u7387\u5ef6\u540e\u590d\u67e5`;
  }

  function buildAdListRegionDetailMessage(options = {}) {
    if (options.shouldFetchDetail === true && options.detailCheckEnabled === true) {
      return options.promotionOrderCount > 0 || options.hasPromotionOrderIncrease === true
        ? '\u5df2\u547d\u4e2d\u5b50\u8ba2\u5355(\u63a8\u5e7f)\uff0c\u5f85\u68c0\u67e5 ads_detail'
        : '\u5df2\u5f00\u542f\u8d85\u82b1\u8d39(\u5b50\u8ba2\u5355(\u63a8\u5e7f)=0)\u68c0\u67e5\uff0c\u5f85\u68c0\u67e5 ads_detail';
    }

    if (options.shouldFetchDetail === true) {
      return options.promotionOrderCount > 0 || options.hasPromotionOrderIncrease === true
        ? '\u5df2\u547d\u4e2d\u5b50\u8ba2\u5355(\u63a8\u5e7f)'
        : '\u5df2\u5f00\u542f\u8d85\u82b1\u8d39(\u5b50\u8ba2\u5355(\u63a8\u5e7f)=0)\u68c0\u67e5';
    }

    const responseMessage = normalizeText(options.responseMessage);

    if (responseMessage) {
      return responseMessage;
    }

    return options.hasPromotionActivity === true
      ? '\u5b50\u8ba2\u5355(\u63a8\u5e7f) \u4e3a 0\uff0c\u8df3\u8fc7 ads_detail'
      : buildNoPromotionRecheckMessage();
  }

  function buildAdsDetailRegionDetailMessage(responseMessage, productCount) {
    const normalizedResponseMessage = normalizeText(responseMessage);

    if (normalizedResponseMessage) {
      return normalizedResponseMessage;
    }

    return Math.max(0, Number.parseInt(productCount, 10) || 0) > 0
      ? '\u5df2\u68c0\u67e5 ads_detail'
      : buildNoPromotionRecheckMessage();
  }

  function buildSkippedEmptyPromotionRegionState(regionId, previousRegionState) {
    const normalizedRegionState = normalizeRegionState(regionId, previousRegionState);

    return copyRegionRuntimeTimingFields(
      {
        ...normalizedRegionState,
        regionId,
        productCount: 0,
        detailMessage: buildNoPromotionRecheckMessage(),
        summarySource: normalizeText(normalizedRegionState.summarySource) || 'skipped-empty',
        detailFetched: false
      },
      normalizedRegionState
    );
  }

  function buildPromotionRegionQueryPlan(shopState, regionIds, nowMs = Date.now()) {
    const queryRegionIds = [];
    const skippedRegionIds = [];

    (Array.isArray(regionIds) ? regionIds : []).forEach((regionId) => {
      const normalizedRegionId = normalizeText(regionId);

      if (!normalizedRegionId) {
        return;
      }

      const previousRegionState = getStoredRegionState(shopState, normalizedRegionId);

      if (
        isEmptyPromotionRegionRecheckDue(
          previousRegionState,
          nowMs,
          EMPTY_PROMOTION_REGION_RECHECK_INTERVAL_MS
        )
      ) {
        queryRegionIds.push(normalizedRegionId);
      } else {
        skippedRegionIds.push(normalizedRegionId);
      }
    });

    return {
      queryRegionIds,
      skippedRegionIds
    };
  }

  function markRegionSpendSortCheckedAt(shopState, regionId, checkedAt = nowIso()) {
    const normalizedRegionId = normalizeText(regionId);

    if (!shopState || !normalizedRegionId) {
      return;
    }

    if (!shopState.regions || typeof shopState.regions !== 'object') {
      shopState.regions = {};
    }

    if (!shopState.regions[normalizedRegionId]) {
      shopState.regions[normalizedRegionId] = buildEmptyRegionState(normalizedRegionId);
    }

    shopState.regions[normalizedRegionId].lastSpendSortCheckedAt = normalizeText(checkedAt);
  }

  function shouldFetchSpendSortedAdsDetail(shopState, regionId, spendThreshold, options = {}) {
    if (options && options.pausedOnly === true) {
      return false;
    }

    if (!Number.isFinite(Number(spendThreshold))) {
      return false;
    }

    const previousRegionState = getStoredRegionState(shopState, regionId);

    return isSpendSortCheckDue(
      previousRegionState && previousRegionState.lastSpendSortCheckedAt,
      Date.now(),
      SPEND_SORT_CHECK_INTERVAL_MS
    );
  }

  function getStoragePaths(owner) {
    const moduleEntry = getModuleEntry();

    // Promotion monitor config and runtime state are account-scoped because
    // shop enablement, limits, and task state must not bleed across logins.
    return {
      configFilePath: path.join(
        moduleEntry.storageProfile.localRootDir,
        'users',
        owner.userKey,
        'config',
        CONFIG_FILE_NAME
      ),
      stateFilePath: path.join(
        moduleEntry.storageProfile.localRootDir,
        'users',
        owner.userKey,
        'state',
        STATE_FILE_NAME
      ),
      cloudConfigKey: `${moduleEntry.storageKey}/users/${owner.userKey}/config/${CONFIG_FILE_NAME}`,
      cloudStateKey: `${moduleEntry.storageKey}/users/${owner.userKey}/state/${STATE_FILE_NAME}`
    };
  }

  async function readJsonFile(filePath) {
    try {
      const rawText = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;
    const serializedPayload = JSON.stringify(payload, null, 2);

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, serializedPayload, 'utf8');

    const renameRetryDelays = [0, 40, 120];
    let lastRenameError = null;

    for (const delayMs of renameRetryDelays) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        await fs.promises.rename(tempFilePath, filePath);
        return;
      } catch (error) {
        lastRenameError = error;
        const errorCode = normalizeText(error && error.code).toUpperCase();

        if (!['EPERM', 'EBUSY', 'EACCES'].includes(errorCode)) {
          break;
        }
      }
    }

    try {
      await fs.promises.writeFile(filePath, serializedPayload, 'utf8');
      await fs.promises.unlink(tempFilePath).catch(() => {});
      return;
    } catch (writeError) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
      throw lastRenameError || writeError;
    }
  }

  async function readCloudJson(key) {
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key
    });

    return result.data;
  }

  async function writeCloudJson(key, payload, metadata = {}) {
    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key,
      data: payload,
      metadata
    });
  }

  async function ensureLoaded() {
    const owner = getOwner();

    if (!owner) {
      loadedOwnerKey = '';
      currentOwner = null;
      configCache = buildDefaultConfig(null);
      stateCache = buildDefaultState(null);
      sharedStateDirty = false;
      sharedStateLoadedAt = 0;
      sharedStateRevision = 0;
      sharedStatePersistedRevision = 0;
      return null;
    }

    if (loadedOwnerKey === owner.userKey) {
      return owner;
    }

    const {
      configFilePath,
      stateFilePath,
      cloudConfigKey,
      cloudStateKey
    } = getStoragePaths(owner);
    const localConfig = await readJsonFile(configFilePath).catch(() => null);
    let cloudConfig = null;

    try {
      cloudConfig = await readCloudJson(cloudConfigKey);
    } catch (error) {
      logError('promotion_monitor_config_cloud_read_failed', error, {
        ownerUserKey: owner.userKey
      });
    }

    const persistedConfig = pickNewerPayload(localConfig, cloudConfig);
    const normalizedConfig = normalizeConfig(persistedConfig, owner);
    const persistedState = await readJsonFile(stateFilePath).catch(() => null);
    const normalizedState = normalizeState(
      persistedState,
      owner,
      normalizedConfig.enabledShopIds,
      normalizedConfig.batchMonitoringActive
    );

    currentOwner = owner;
    loadedOwnerKey = owner.userKey;
    try {
      const cloudState = await readCloudJson(cloudStateKey);

      if (cloudState) {
        mergeSharedCloudStateInto(normalizedState, cloudState, owner, normalizedConfig.enabledShopIds);
      }
    } catch (error) {
      logError('promotion_monitor_state_cloud_read_failed', error, {
        ownerUserKey: owner.userKey
      });
    }

    configCache = normalizedConfig;
    stateCache = normalizedState;
    const stateCompacted = compactStateOperationStats(stateCache);
    sharedStateDirty = false;
    sharedStateLoadedAt = Date.now();
    sharedStateRevision = 0;
    sharedStatePersistedRevision = 0;

    void persistConfig().catch((error) => {
      logError('promotion_monitor_config_bootstrap_sync_failed', error, {
        ownerUserKey: owner.userKey
      });
    });

    if (
      stateCompacted === true
      ||
      Object.values(stateCache.shops).some((shopState) => (
        Object.keys(normalizeOperationStats(shopState && shopState.operationStats)).length > 0
      ))
    ) {
      sharedStateDirty = true;
      sharedStateRevision += 1;
      scheduleSharedStatePersist(SHARED_STATE_CLOUD_PERSIST_DELAY_MS);
    }

    return owner;
  }

  function getShopRuntimeState(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return null;
    }

    if (!stateCache.shops[normalizedShopId]) {
      stateCache.shops[normalizedShopId] = buildDefaultShopState(
        normalizedShopId,
        configCache.enabledShopIds.includes(normalizedShopId)
      );
    }

    return stateCache.shops[normalizedShopId];
  }

  async function persistConfig() {
    if (!currentOwner) {
      return;
    }

    const normalizedConfig = {
      ...normalizeConfig(configCache, currentOwner),
      batchMonitoringActive: configCache.batchMonitoringActive === true
    };
    const persistableConfig = buildPersistableConfig(normalizedConfig, currentOwner);
    const { configFilePath, cloudConfigKey } = getStoragePaths(currentOwner);

    configCache = normalizedConfig;
    await writeJsonFile(configFilePath, persistableConfig);

    try {
      await writeCloudJson(
        cloudConfigKey,
        persistableConfig,
        {
          record_type: 'promotion-monitor-config',
          owner_user_key: currentOwner.userKey,
          owner_username: currentOwner.username
        }
      );
    } catch (error) {
      logError('promotion_monitor_config_cloud_write_failed', error, {
        ownerUserKey: currentOwner.userKey
      });
    }
  }

  async function persistState() {
    if (!currentOwner) {
      return;
    }

    const { stateFilePath } = getStoragePaths(currentOwner);
    compactStateOperationStats(stateCache);
    const persistableState = buildPersistableState(stateCache, currentOwner);

    await writeJsonFile(stateFilePath, persistableState);
  }

  async function persistSharedState() {
    if (!currentOwner) {
      sharedStateDirty = false;
      sharedStatePersistedRevision = sharedStateRevision;
      return;
    }

    if (sharedStateDirty !== true) {
      return;
    }

    const { cloudStateKey } = getStoragePaths(currentOwner);
    const sharedStatePayload = buildSharedCloudState(stateCache, currentOwner);
    const targetRevision = sharedStateRevision;

    await writeCloudJson(
      cloudStateKey,
      sharedStatePayload,
      {
        record_type: 'promotion-monitor-state',
        owner_user_key: currentOwner.userKey,
        owner_username: currentOwner.username
      }
    );

    sharedStatePersistedRevision = Math.max(sharedStatePersistedRevision, targetRevision);
    sharedStateDirty = sharedStatePersistedRevision < sharedStateRevision;
    sharedStateLoadedAt = Date.now();

    if (sharedStateDirty === true) {
      scheduleSharedStatePersist(SHARED_STATE_CLOUD_PERSIST_DELAY_MS);
    }
  }

  function scheduleStatePersist(delayMs = 0) {
    if (persistStateTimer) {
      clearTimeout(persistStateTimer);
      persistStateTimer = 0;
    }

    persistStateTimer = setTimeout(() => {
      persistStateTimer = 0;
      persistState().catch((error) => {
        logError('promotion_monitor_state_persist_failed', error);
      });
    }, Math.max(0, Number(delayMs) || 0));
  }

  function scheduleSharedStatePersist(delayMs = 0) {
    if (persistSharedStateTimer) {
      clearTimeout(persistSharedStateTimer);
      persistSharedStateTimer = 0;
    }

    persistSharedStateTimer = setTimeout(() => {
      persistSharedStateTimer = 0;
      persistSharedState().catch((error) => {
        logError('promotion_monitor_shared_state_persist_failed', error);

        if (sharedStateDirty === true) {
          scheduleSharedStatePersist(30000);
        }
      });
    }, Math.max(0, Number(delayMs) || 0));
  }

  function scheduleScheduler(delayMs = LOOP_INTERVAL_MS) {
    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = 0;
    }

    schedulerTimer = setTimeout(() => {
      schedulerTimer = 0;
      void runScheduler();
    }, Math.max(0, Number(delayMs) || 0));
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  async function readLocalShopManagementState() {
    if (
      !shopManagementService
      || typeof shopManagementService.getLocalState !== 'function'
    ) {
      return null;
    }

    const state = await shopManagementService.getLocalState();

    return state && state.localStateAvailable === true ? state : null;
  }

  async function buildShopControllerPayload(shopId) {
    const payload = {
      shopId: normalizeText(shopId)
    };

    try {
      const state = await readLocalShopManagementState();
      const matchedShop = Array.isArray(state && state.shops)
        ? state.shops.find((shop) => normalizeText(shop && shop.id) === payload.shopId)
        : null;

      if (matchedShop) {
        payload.shopUpdatedAt = normalizeText(matchedShop.updatedAt);
      }
    } catch (_error) {
      // Ignore state lookup failures and fall back to shop id only.
    }

    return payload;
  }

  async function resolveShopLogMeta(shopId) {
    const normalizedShopId = normalizeText(shopId);
    const payload = {
      shopId: normalizedShopId,
      shopName: ''
    };

    if (
      !normalizedShopId
    ) {
      return payload;
    }

    try {
      const state = await readLocalShopManagementState();
      const matchedShop = Array.isArray(state && state.shops)
        ? state.shops.find((shop) => normalizeText(shop && shop.id) === normalizedShopId)
        : null;

      if (matchedShop) {
        payload.shopName = normalizeText(
          matchedShop.shopName
          || matchedShop.name
          || matchedShop.storeName
          || matchedShop.label
        );
      }
    } catch (_error) {
      // Ignore shop label lookup failures and fall back to shop id only.
    }

    if (payload.shopName) {
      runtimeLogShopMetaById.set(normalizedShopId, {
        shopId: normalizedShopId,
        shopName: payload.shopName
      });
    }

    return payload;
  }

  async function loadManagedShopDirectory() {
    if (
      !shopManagementService
      || typeof shopManagementService.getLocalState !== 'function'
    ) {
      return {
        loaded: false,
        shops: [],
        shopMap: new Map()
      };
    }

    try {
      const state = await readLocalShopManagementState();

      if (!state) {
        return {
          loaded: false,
          shops: [],
          shopMap: new Map()
        };
      }

      const shops = Array.isArray(state && state.shops) ? state.shops : [];
      const shopMap = new Map(
        shops
          .map((shop) => [normalizeText(shop && shop.id), shop])
          .filter(([shopId]) => Boolean(shopId))
      );

      return {
        loaded: true,
        shops,
        shopMap
      };
    } catch (_error) {
      return {
        loaded: false,
        shops: [],
        shopMap: new Map()
      };
    }
  }

  function applyUnavailableMonitorShopState(shopState, reasonLog = '') {
    if (!shopState) {
      return false;
    }

    const resolvedReasonLog =
      normalizeText(reasonLog)
      || '\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u4E0D\u518D\u53C2\u4E0E\u63A8\u5E7F\u76D1\u63A7';
    let changed = false;

    if (shopState.enabled !== false) {
      shopState.enabled = false;
      changed = true;
    }

    if (shopState.taskRunning !== false) {
      shopState.taskRunning = false;
      changed = true;
    }

    if (shopState.retryCount !== 0) {
      shopState.retryCount = 0;
      changed = true;
    }

    if (shopState.pauseResumeFallbackRetryCount !== 0) {
      shopState.pauseResumeFallbackRetryCount = 0;
      changed = true;
    }

    if (normalizeText(shopState.status) !== 'disabled') {
      shopState.status = 'disabled';
      changed = true;
    }

    if (normalizeText(shopState.log) !== resolvedReasonLog) {
      shopState.log = resolvedReasonLog;
      changed = true;
    }

    if (normalizeText(shopState.lastError)) {
      shopState.lastError = '';
      changed = true;
    }

    if (Math.max(0, Number(shopState.nextRunAt) || 0) !== Number.MAX_SAFE_INTEGER) {
      shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
      changed = true;
    }

    if (Math.max(0, Number(shopState.pauseResumeFallbackNextRunAt) || 0) !== Number.MAX_SAFE_INTEGER) {
      shopState.pauseResumeFallbackNextRunAt = Number.MAX_SAFE_INTEGER;
      changed = true;
    }

    if (
      shopState.cookieHeaderByRegion
      && Object.keys(shopState.cookieHeaderByRegion).length > 0
    ) {
      shopState.cookieHeaderByRegion = {};
      changed = true;
    }

    if (changed) {
      shopState.lastUpdatedAt = nowIso();
    }

    return changed;
  }

  async function reconcileManagedShopAvailability() {
    const directory = await loadManagedShopDirectory();

    if (directory.loaded !== true) {
      return directory;
    }

    let configChanged = false;
    let stateChanged = false;
    const nextEnabledShopIds = [];

    configCache.enabledShopIds.forEach((shopId) => {
      const normalizedShopId = normalizeText(shopId);

      if (!normalizedShopId) {
        configChanged = true;
        return;
      }

      const matchedShop = directory.shopMap.get(normalizedShopId);

      if (matchedShop && isShopParticipating(matchedShop)) {
        nextEnabledShopIds.push(normalizedShopId);
        return;
      }

      configChanged = true;
      stateChanged = applyUnavailableMonitorShopState(
        getShopRuntimeState(normalizedShopId),
        matchedShop
          ? '\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u4E0D\u518D\u53C2\u4E0E\u63A8\u5E7F\u76D1\u63A7'
          : '\u5E97\u94FA\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u4E0D\u518D\u53C2\u4E0E\u63A8\u5E7F\u76D1\u63A7'
      ) || stateChanged;

      if (
        promotionMasterSessionService
        && typeof promotionMasterSessionService.invalidateShopCache === 'function'
      ) {
        promotionMasterSessionService.invalidateShopCache(normalizedShopId);
      }
    });

    if (configChanged) {
      configCache.enabledShopIds = nextEnabledShopIds;
      configCache.updatedAt = nowIso();
      await persistConfig();
    }

    if (stateChanged) {
      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
    }

    return {
      ...directory,
      configChanged,
      stateChanged
    };
  }

  function buildAdsDetailPayload(options = {}) {
    return buildAdsDetailRequestPayload(options);
  }

  async function loadMonitorConfig(options = {}) {
    const now = Date.now();

    if (
      options.force !== true
      && monitorConfigCache
      && now - monitorConfigLoadedAt < MONITOR_SETTINGS_REFRESH_MS
    ) {
      return monitorConfigCache;
    }

    let settingsGetter = null;

    if (
      promotionManagerSettingsService
      && typeof promotionManagerSettingsService.getCachedSettings === 'function'
    ) {
      settingsGetter = promotionManagerSettingsService.getCachedSettings.bind(promotionManagerSettingsService);
    } else if (
      promotionManagerSettingsService
      && typeof promotionManagerSettingsService.getSettings === 'function'
    ) {
      settingsGetter = promotionManagerSettingsService.getSettings.bind(promotionManagerSettingsService);
    }

    let settingsResult = null;

    if (settingsGetter) {
      settingsResult = await settingsGetter().catch(() => null);
    }

    monitorConfigCache = normalizeMonitorConfigBundle(
      settingsResult && settingsResult.settings ? settingsResult.settings : null
    );
    monitorConfigLoadedAt = now;

    return monitorConfigCache;
  }

  function getShopOperationStat(shopState, regionId, goodsId, adId, options = {}) {
    if (!shopState.operationStats || typeof shopState.operationStats !== 'object') {
      shopState.operationStats = {};
    }

    const statKey = buildOperationStatKey(regionId, goodsId, adId);

    if (!shopState.operationStats[statKey]) {
      if (options.create !== true) {
        return null;
      }

      shopState.operationStats[statKey] = buildDefaultOperationStat();
    }

    const stat = shopState.operationStats[statKey];
    const dailyBucket = buildOperationDateKey();

    if (stat.dailyBucket !== dailyBucket) {
      stat.dailyBucket = dailyBucket;
      stat.dailyCount = 0;
    }

    return stat;
  }

  function removeShopOperationStat(shopState, regionId, goodsId, adId) {
    if (!shopState || !shopState.operationStats || typeof shopState.operationStats !== 'object') {
      return false;
    }

    const statKey = buildOperationStatKey(regionId, goodsId, adId);

    if (!Object.prototype.hasOwnProperty.call(shopState.operationStats, statKey)) {
      return false;
    }

    delete shopState.operationStats[statKey];
    sharedStateDirty = true;
    sharedStateRevision += 1;
    return true;
  }

  function setOperationPausedState(stat, isPaused, options = {}) {
    if (!stat || typeof stat !== 'object' || typeof isPaused !== 'boolean') {
      return false;
    }

    const nextPausedAt = isPaused
      ? (
        hasOwnField(options, 'pausedAt')
          ? normalizeText(options.pausedAt)
          : normalizeText(stat.pausedAt)
      )
      : '';
    const nextUpdatedAt = normalizeText(options.eventAt) || nowIso();
    const currentPausedState = normalizeNullableBoolean(stat.knownPausedState);
    const currentUpdatedAt = normalizeText(stat.pauseStateUpdatedAt);
    const currentPausedAt = normalizeText(stat.pausedAt);

    if (
      currentPausedState === isPaused
      && currentUpdatedAt === nextUpdatedAt
      && currentPausedAt === nextPausedAt
    ) {
      return false;
    }

    stat.knownPausedState = isPaused;
    stat.pauseStateUpdatedAt = nextUpdatedAt;
    stat.pausedAt = nextPausedAt;
    sharedStateDirty = true;
    sharedStateRevision += 1;
    return true;
  }

  function syncOperationPausedStateFromItem(stat, itemPaused) {
    if (typeof itemPaused !== 'boolean' || !stat || typeof stat !== 'object') {
      return false;
    }

    const currentPausedState = resolveStoredPausedState(stat);
    const currentPausedAt = normalizeText(stat.pausedAt);

    if (itemPaused === true && currentPausedState === true) {
      return false;
    }

    if (itemPaused === false && currentPausedState === false && !currentPausedAt) {
      return false;
    }

    return setOperationPausedState(stat, itemPaused, {
      eventAt: nowIso(),
      pausedAt: itemPaused ? currentPausedAt : ''
    });
  }

  function getPauseThenResumeFallbackNextRunAt(shopState) {
    return Math.max(0, Number(shopState && shopState.pauseResumeFallbackNextRunAt) || 0);
  }

  function getPauseThenResumeFallbackRetryCount(shopState) {
    return Math.max(0, Number(shopState && shopState.pauseResumeFallbackRetryCount) || 0);
  }

  function setPauseThenResumeFallbackSchedule(shopState, nextRunAt, retryCount = 0) {
    if (!shopState || typeof shopState !== 'object') {
      return false;
    }

    const normalizedNextRunAt = Math.max(0, Number(nextRunAt) || 0);
    const normalizedRetryCount = Math.max(0, Number(retryCount) || 0);

    if (
      getPauseThenResumeFallbackNextRunAt(shopState) === normalizedNextRunAt
      && getPauseThenResumeFallbackRetryCount(shopState) === normalizedRetryCount
    ) {
      return false;
    }

    shopState.pauseResumeFallbackNextRunAt = normalizedNextRunAt;
    shopState.pauseResumeFallbackRetryCount = normalizedRetryCount;
    return true;
  }

  function resolvePauseThenResumeFallbackDueAt(shopState, monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (
      !shopState
      || shopState.enabled !== true
      || !isResumeSequenceActionType(config.actionType)
      || config.resumeIntervalMinutes === null
    ) {
      return Number.MAX_SAFE_INTEGER;
    }

    const nextDueAt = resolvePauseThenResumeNextRunAt(shopState, config);

    if (nextDueAt >= Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (
      config.resumeIntervalMinutes === PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES
      && getPauseThenResumeFallbackRetryCount(shopState) === 0
    ) {
      return nextDueAt;
    }

    return Math.max(nextDueAt, getPauseThenResumeFallbackNextRunAt(shopState));
  }

  function resolvePauseThenResumeFallbackSuccessNextRunAt(shopState, monitorConfig) {
    const config = normalizeMonitorConfig(monitorConfig);

    if (
      !isResumeSequenceActionType(config.actionType)
      || config.resumeIntervalMinutes === null
    ) {
      return 0;
    }

    if (config.resumeIntervalMinutes === PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES) {
      const nextDueAt = resolvePauseThenResumeNextRunAt(shopState, config);
      return nextDueAt >= Number.MAX_SAFE_INTEGER ? 0 : nextDueAt;
    }

    const resumeIntervalMs = resolveResumeIntervalMs(config) || 0;
    return resumeIntervalMs > 0 ? Date.now() + resumeIntervalMs : 0;
  }

  function recordMonitorOperationStat(stat, item, actionType, payload, resultMessage, options = {}) {
    const dailyBucket = buildOperationDateKey();
    const normalizedActionType = normalizeText(actionType);
    const executedAt = nowIso();
    const normalizedReasonType = normalizeText(options.reasonType);

    if (stat.dailyBucket !== dailyBucket) {
      stat.dailyBucket = dailyBucket;
      stat.dailyCount = 0;
    }

    stat.dailyCount += 1;
    stat.totalCount += 1;
    stat.lastActionType = normalizedActionType;
    stat.lastRegionId = normalizeText(item && item.regionId);
    stat.lastGoodsId = normalizeText(item && item.goodsId);
    stat.lastAdId = normalizeText(item && item.adId);
    stat.lastTargetRoas = extractIntegerByAliases(payload, ['roas']) || 0;
    stat.lastExecutedAt = executedAt;
    stat.lastResultMessage = normalizeText(resultMessage);
    stat.lastTriggerReason = MONITOR_OPERATION_REASON_TYPES.includes(normalizedReasonType)
      ? normalizedReasonType
      : '';
    stat.lastTriggerMessage = normalizeText(options.reasonMessage);
    stat.lastObservedAdSpend =
      item && typeof item.adSpend === 'number' && Number.isFinite(item.adSpend)
        ? item.adSpend
        : null;
    stat.lastObservedOrderCount = Math.max(0, Number.parseInt(item && item.orderCount, 10) || 0);
    stat.lastObservedCurrentRoas = normalizeRoasRawValue(item && item.currentRoasRaw);
    stat.lastObservedTargetRoas = normalizeRoasRawValue(item && item.targetRoasRaw);

    if (normalizedActionType === 'pause_plan') {
      stat.knownPausedState = true;
      stat.pauseStateUpdatedAt = executedAt;
      stat.pausedAt = executedAt;
    } else if (normalizedActionType === 'resume_plan') {
      stat.knownPausedState = false;
      stat.pauseStateUpdatedAt = executedAt;
      stat.pausedAt = '';
    }

    sharedStateDirty = true;
    sharedStateRevision += 1;
  }

  function buildMonitorActionLabel(actionType) {
    const normalizedActionType = normalizeText(actionType);
    const actionLabelMap = {
      pause_plan: '\u6682\u505c\u8ba1\u5212',
      pause_then_resume: '\u6682\u505c\u540e\u6062\u590d',
      pause_then_modify: '\u6682\u505c\u540e\u4fee\u6539',
      pause_then_modify_resume: '\u6682\u505c\u540e\u4fee\u6539\u6062\u590d',
      resume_plan: '\u6062\u590d\u8ba1\u5212',
      delete_plan: '\u5220\u9664\u8ba1\u5212',
      update_roas: '\u4fee\u6539ROAS',
      increase_roas: '\u589e\u52a0ROAS'
    };

    return actionLabelMap[normalizedActionType] || normalizedActionType || '\u76d1\u63a7\u4fee\u6539';
  }

  function buildMonitorActionExecutionLabel(actionType) {
    const normalizedActionType = normalizeText(actionType);
    const actionLabelMap = {
      pause_plan: '\u672c\u8f6e\u6682\u505c',
      pause_then_resume: '\u672c\u8f6e\u6682\u505c\u540e\u6062\u590d',
      pause_then_modify: '\u672c\u8f6e\u6682\u505c\u540e\u4fee\u6539',
      pause_then_modify_resume: '\u672c\u8f6e\u6682\u505c\u540e\u4fee\u6539\u6062\u590d',
      resume_plan: '\u672c\u8f6e\u6062\u590d',
      delete_plan: '\u672c\u8f6e\u5220\u9664',
      update_roas: '\u672c\u8f6e\u4fee\u6539ROAS',
      increase_roas: '\u672c\u8f6e\u589e\u52a0ROAS'
    };

    return actionLabelMap[normalizedActionType] || buildMonitorActionLabel(normalizedActionType);
  }

  function resolveOperationReasonType(executionActionType, options = {}) {
    const normalizedExecutionActionType = normalizeText(executionActionType);
    const normalizedSourceActionType = normalizeText(options.sourceActionType);

    if (normalizedExecutionActionType === 'pause_plan') {
      if (options.autoPauseBySpend === true) {
        return 'auto_pause_spend';
      }

      if (options.autoPauseByRoas === true) {
        return 'auto_pause_roas';
      }

      if (isPauseSequenceActionType(normalizedSourceActionType)) {
        return 'pause_then_resume_pause';
      }
    }

    if (
      normalizedExecutionActionType === 'resume_plan'
      && isResumeSequenceActionType(normalizedSourceActionType)
    ) {
      return 'pause_then_resume_resume';
    }

    return normalizedExecutionActionType ? 'primary_action' : '';
  }

  function buildOperationReasonLabel(executionActionType, reasonType) {
    const normalizedReasonType = normalizeText(reasonType);

    if (normalizedReasonType === 'auto_pause_spend') {
      return '\u8d85\u82b1\u8d39\u8fbe\u9608\u503c\u6682\u505c';
    }

    if (normalizedReasonType === 'auto_pause_roas') {
      return '\u6210\u4ea4ROAS\u8fbe\u9608\u503c\u6682\u505c';
    }

    if (normalizedReasonType === 'pause_then_resume_pause') {
      return '\u6682\u505c\u540e\u5904\u7406-\u6682\u505c';
    }

    if (normalizedReasonType === 'pause_then_resume_resume') {
      return '\u6682\u505c\u540e\u6062\u590d-\u6062\u590d';
    }

    return buildMonitorActionLabel(executionActionType);
  }

  function formatOperationNumber(value, options = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '--';
    }

    return formatMetricNumber(value, {
      minimumFractionDigits: Math.max(0, Number(options.minimumFractionDigits) || 0),
      maximumFractionDigits: Math.max(0, Number(options.maximumFractionDigits) || 0)
    });
  }

  function formatOperationRoas(rawValue) {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue <= 0) {
      return '--';
    }

    return formatOperationNumber(rawValue / 10000, {
      maximumFractionDigits: 2
    });
  }

  function buildOperationReasonMetricsText(reasonType, item) {
    const normalizedReasonType = normalizeText(reasonType);
    const normalizedItem = item && typeof item === 'object' ? item : {};
    const adSpend = typeof normalizedItem.adSpend === 'number' && Number.isFinite(normalizedItem.adSpend)
      ? normalizedItem.adSpend
      : null;
    const orderCount = Math.max(0, Number.parseInt(normalizedItem.orderCount, 10) || 0);

    if (normalizedReasonType === 'auto_pause_spend') {
      return [
        `\u82b1\u8d39 ${formatOperationNumber(adSpend, { maximumFractionDigits: 2 })}`,
        `\u5b50\u8ba2\u5355(\u63a8\u5e7f) ${orderCount}`
      ].join(' / ');
    }

    if (normalizedReasonType === 'auto_pause_roas') {
      return [
        `\u82b1\u8d39 ${formatOperationNumber(adSpend, { maximumFractionDigits: 2 })}`,
        `\u5b50\u8ba2\u5355(\u63a8\u5e7f) ${orderCount}`,
        `\u6210\u4ea4ROAS ${formatOperationRoas(normalizedItem.currentRoasRaw)}`
      ].join(' / ');
    }

    return '';
  }

  function truncateOperationText(value, maxLength = 18) {
    const text = normalizeText(value);

    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  function buildOperationPreviewItemLabel(item) {
    const goodsId = normalizeText(item && item.goodsId);
    const productName = truncateOperationText(item && item.productName, 14);

    if (goodsId) {
      return `SPUID ${goodsId}`;
    }

    return productName || '\u672a\u547d\u540d\u5546\u54c1';
  }

  function appendOperationSummaryItem(targetList, item, regionId, errorMessage = '') {
    if (!Array.isArray(targetList) || targetList.length >= 3) {
      return;
    }

    const regionEntry = REGION_ENTRIES.find((region) => region.id === normalizeText(regionId));

    targetList.push({
      regionId: normalizeText(regionId),
      regionLabel: regionEntry ? regionEntry.label : normalizeText(regionId),
      goodsId: normalizeText(item && item.goodsId),
      productName: normalizeText(item && item.productName),
      errorMessage: normalizeText(errorMessage)
    });
  }

  function buildOperationRuntimeMessage(executionActionType, item, regionId, options = {}) {
    const regionEntry = REGION_ENTRIES.find((region) => region.id === normalizeText(regionId));
    const regionLabel = regionEntry ? regionEntry.label : normalizeText(regionId);
    const itemLabel = buildOperationPreviewItemLabel(item);
    const reasonType =
      normalizeText(options.reasonType)
      || resolveOperationReasonType(executionActionType, options);
    const metricsText = buildOperationReasonMetricsText(reasonType, item);
    let actionLabel = buildOperationReasonLabel(executionActionType, reasonType);

    if (options.failed === true) {
      actionLabel = `${actionLabel}\u5931\u8d25`;
    }

    return [regionLabel, actionLabel, itemLabel, metricsText].filter(Boolean).join(' ');
  }

  function buildOperationPreviewText(items, totalCount) {
    const previewItems = Array.isArray(items) ? items.filter(Boolean) : [];

    if (previewItems.length === 0 || totalCount <= 0) {
      return '';
    }

    const previewText = previewItems
      .map((item) => {
        const label = buildOperationPreviewItemLabel(item);
        const regionLabel = normalizeText(item && item.regionLabel);

        return regionLabel ? `${regionLabel} ${label}` : label;
      })
      .join(' / ');
    const suffix = totalCount > previewItems.length ? ` 等 ${totalCount} 个` : '';

    return `${previewText}${suffix}`;
  }

  function buildExecutedActionSummaryText(summary) {
    const autoPauseSpendCount = Math.max(0, Number(summary && summary.autoPausedBySpendCount) || 0);
    const autoPauseRoasCount = Math.max(0, Number(summary && summary.autoPausedByRoasCount) || 0);
    const actionCounts = summary && summary.successfulActionCounts && typeof summary.successfulActionCounts === 'object'
      ? summary.successfulActionCounts
      : {};
    const summaryParts = [];

    if (autoPauseSpendCount > 0) {
      summaryParts.push(`\u8d85\u82b1\u8d39\u6682\u505c ${autoPauseSpendCount}`);
    }

    if (autoPauseRoasCount > 0) {
      summaryParts.push(`\u6210\u4ea4ROAS\u8fbe\u9608\u503c\u6682\u505c ${autoPauseRoasCount}`);
    }

    const countEntries = Object.entries(actionCounts)
      .map(([actionType, count]) => {
        let normalizedCount = Math.max(0, Number(count) || 0);

        if (normalizeText(actionType) === 'pause_plan') {
          normalizedCount = Math.max(0, normalizedCount - autoPauseSpendCount - autoPauseRoasCount);
        }

        return [actionType, normalizedCount];
      })
      .filter(([, count]) => count > 0);

    if (countEntries.length === 0 && summaryParts.length === 0) {
      const fallbackLabel = buildMonitorActionLabel(summary && summary.actionType);
      return fallbackLabel;
    }

    summaryParts.push(
      ...countEntries.map(
        ([actionType, count]) => `${buildMonitorActionExecutionLabel(actionType)} ${Math.max(0, Number(count) || 0)}`
      )
    );

    return summaryParts.join(' / ');
  }

  async function executeMonitorActions(shopId, shopState, monitorConfig, fetchResult, options = {}) {
    const shopLogMeta = await resolveShopLogMeta(shopId);

    const config = normalizeMonitorConfig(monitorConfig);
    const scopedRegionIds = Array.isArray(options.regionIds)
      ? options.regionIds.map((regionId) => normalizeText(regionId)).filter(Boolean)
      : [];
    const pausedOnly = options.pausedOnly === true;
    const selectedRegionIds = new Set(scopedRegionIds.length > 0 ? scopedRegionIds : config.regionIds);
    const primaryActionEnabled = hasPrimaryMonitorAction(config);
    const autoPauseSpendThreshold = config.autoPauseSpendThreshold;
    const autoPauseRoasThresholdRaw = normalizeRoasRawValue(config.autoPauseRoasThreshold);
    const operationSummary = buildEmptyOperationSummary();
    operationSummary.actionType = config.actionType;

    if (!hasExecutableMonitorAction(config)) {
      return operationSummary;
    }

    updateShopStageLog(shopId, shopState, '正在按监控条件筛选商品并准备执行操作', {
      stage: 'evaluate-actions',
      writeRuntimeLog: true
    });

    for (const region of REGION_ENTRIES) {
      if (!selectedRegionIds.has(region.id)) {
        continue;
      }

      const regionResult = fetchResult && fetchResult.regions ? fetchResult.regions[region.id] : null;
      const response = regionResult && regionResult.response ? regionResult.response : null;
      const requestPayload = regionResult && isPlainObject(regionResult.requestPayload)
        ? regionResult.requestPayload
        : {};

      if (!response || response.ok !== true || response.success === false) {
        continue;
      }

      const shouldFetchSpendSort = shouldFetchSpendSortedAdsDetail(
        shopState,
        region.id,
        autoPauseSpendThreshold,
        { pausedOnly }
      );
      let items = [];

      try {
        items = await fetchAdsDetailItemsForRegion(shopId, region.id, response, {
          pausedOnly,
          spendThreshold: shouldFetchSpendSort ? autoPauseSpendThreshold : null,
          requestPayload,
          postWithRegionCookie:
            promotionMasterSessionService
            && typeof promotionMasterSessionService.postWithRegionCookie === 'function'
              ? promotionMasterSessionService.postWithRegionCookie.bind(promotionMasterSessionService)
              : null
        });
      } finally {
        if (shouldFetchSpendSort) {
          markRegionSpendSortCheckedAt(shopState, region.id);
        }
      }

      for (const item of items) {
        let operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId);
        let currentDailyCount = operationStat ? Math.max(0, Number(operationStat.dailyCount) || 0) : 0;
        let currentTotalCount = operationStat ? Math.max(0, Number(operationStat.totalCount) || 0) : 0;
        const conditionMaxRoasRaw = normalizeRoasRawValue(config.conditionMaxRoas);
        let executionActionType = primaryActionEnabled ? config.actionType : '';
        let shouldEvaluateConditions = true;
        let autoPauseBySpendMatched = false;
        let autoPauseByRoasMatched = false;

        if (operationStat || isPauseSequenceActionType(config.actionType)) {
          if (!operationStat && item.isPaused === true) {
            operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId, {
              create: true
            });
          }

          if (operationStat) {
            syncOperationPausedStateFromItem(operationStat, item.isPaused);
          }
        }

        const effectivePausedState = resolveEffectivePausedState(item, operationStat);
        const autoPauseDecision = resolveMonitorAutoPauseDecision(item, {
          pausedOnly,
          spendThreshold: autoPauseSpendThreshold,
          roasThresholdRaw: autoPauseRoasThresholdRaw
        });

        if (autoPauseDecision.reason === 'spend') {
          executionActionType = 'pause_plan';
          shouldEvaluateConditions = false;
          autoPauseBySpendMatched = true;
        }

        if (autoPauseDecision.reason === 'roas') {
          executionActionType = 'pause_plan';
          shouldEvaluateConditions = false;
          autoPauseByRoasMatched = true;
        }

        if (!autoPauseBySpendMatched && !autoPauseByRoasMatched && isPauseSequenceActionType(config.actionType)) {
          const pauseSequenceDecision = resolvePauseSequenceExecution(operationStat, item, config);

          if (!pauseSequenceDecision.executionActionType) {
            operationSummary.skippedCount += 1;

            if (pauseSequenceDecision.skipReason === 'resume_waiting') {
              operationSummary.skippedByResumeWaiting += 1;
            } else {
              operationSummary.skippedByActionPayload += 1;
            }
            continue;
          }

          executionActionType = pauseSequenceDecision.executionActionType;
          shouldEvaluateConditions = pauseSequenceDecision.shouldEvaluateConditions !== false;
          currentDailyCount = Math.max(0, Number(operationStat && operationStat.dailyCount) || 0);
          currentTotalCount = Math.max(0, Number(operationStat && operationStat.totalCount) || 0);
        }

        if (shouldEvaluateConditions) {
          if (
            conditionMaxRoasRaw !== null
            && (item.targetRoasRaw === null || item.targetRoasRaw > conditionMaxRoasRaw)
          ) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByRoas += 1;
            continue;
          }

          if (config.minOrderCount !== null && item.orderCount < config.minOrderCount) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByOrderCount += 1;
            continue;
          }

          if (config.dailyOperationLimit !== null && currentDailyCount >= config.dailyOperationLimit) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByDailyLimit += 1;
            continue;
          }

          if (config.totalOperationLimit !== null && currentTotalCount >= config.totalOperationLimit) {
            operationSummary.skippedCount += 1;
            operationSummary.skippedByTotalLimit += 1;
            continue;
          }
        }

        if (executionActionType === 'pause_plan' && effectivePausedState === true) {
          operationSummary.skippedCount += 1;
          operationSummary.skippedByAlreadyPaused += 1;
          continue;
        }

        const payload = buildModifyAdsPayload(executionActionType, item, config);

        if (!payload) {
          operationSummary.skippedCount += 1;
          operationSummary.skippedByActionPayload += 1;
          continue;
        }

        if (!operationStat) {
          operationStat = getShopOperationStat(shopState, region.id, item.goodsId, item.adId, {
            create: true
          });
        }

        operationSummary.attemptedCount += 1;

        try {
          const modifyResult =
            promotionMasterSessionService
            && typeof promotionMasterSessionService.postWithRegionCookie === 'function'
              ? await promotionMasterSessionService.postWithRegionCookie(
                shopId,
                region.id,
                ADS_MODIFY_URL,
                payload,
                {
                  reason: `${region.id}-${executionActionType}-modify-ads`
                }
              )
              : null;
          const responsePayload = modifyResult && modifyResult.response ? modifyResult.response : null;
          const responseData = responsePayload && responsePayload.data && typeof responsePayload.data === 'object'
            ? responsePayload.data
            : {};
          const resultData = responseData && responseData.result && typeof responseData.result === 'object'
            ? responseData.result
            : {};
          const successCount = Math.max(0, Number(resultData.success_modify_product_num) || 0);

          if (!responsePayload || responsePayload.ok !== true || responsePayload.success === false || successCount <= 0) {
            throw new Error(
              normalizeText(responsePayload && responsePayload.message)
              || normalizeText(responseData && responseData.error_msg)
              || `${executionActionType} failed`
            );
          }

          const operationReasonType = resolveOperationReasonType(
            executionActionType,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType
            }
          );
          const runtimeActionMessage = buildOperationRuntimeMessage(
            executionActionType,
            item,
            region.id,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType,
              reasonType: operationReasonType
            }
          );

          recordMonitorOperationStat(
            operationStat,
            item,
            executionActionType,
            payload,
            normalizeText(responsePayload.message) || 'success',
            {
              reasonType: operationReasonType,
              reasonMessage: runtimeActionMessage
            }
          );

          if (executionActionType === 'resume_plan' || executionActionType === 'delete_plan') {
            removeShopOperationStat(shopState, region.id, item.goodsId, item.adId);
          }

          operationSummary.successCount += 1;

          if (!operationSummary.successfulActionCounts[executionActionType]) {
            operationSummary.successfulActionCounts[executionActionType] = 0;
          }

          operationSummary.successfulActionCounts[executionActionType] += 1;

          if (autoPauseBySpendMatched === true && executionActionType === 'pause_plan') {
            operationSummary.autoPausedBySpendCount += 1;
          }

          if (autoPauseByRoasMatched === true && executionActionType === 'pause_plan') {
            operationSummary.autoPausedByRoasCount += 1;
          }

          appendOperationSummaryItem(operationSummary.executedItems, item, region.id);

          log('promotion_monitor_action_executed', {
            ...shopLogMeta,
            regionId: region.id,
            goodsId: item.goodsId,
            adId: item.adId,
            productName: normalizeText(item.productName),
            adSpend: typeof item.adSpend === 'number' && Number.isFinite(item.adSpend) ? item.adSpend : null,
            orderCount: item.orderCount,
            currentRoasRaw: item.currentRoasRaw,
            targetRoasRaw: item.targetRoasRaw,
            triggerReason: operationReasonType,
            message: runtimeActionMessage,
            actionType: config.actionType,
            executedActionType: executionActionType
          });
        } catch (error) {
          if (error && error.authRequired === true) {
            throw error;
          }

          operationSummary.failedCount += 1;
          operationStat.lastResultMessage = normalizeText(error && error.message);
          appendOperationSummaryItem(
            operationSummary.failedItems,
            item,
            region.id,
            normalizeText(error && error.message)
          );
          const operationReasonType = resolveOperationReasonType(
            executionActionType,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType
            }
          );
          const runtimeFailureMessage = buildOperationRuntimeMessage(
            executionActionType,
            item,
            region.id,
            {
              autoPauseBySpend: autoPauseBySpendMatched === true,
              autoPauseByRoas: autoPauseByRoasMatched === true,
              sourceActionType: config.actionType,
              reasonType: operationReasonType,
              failed: true
            }
          );

          logError('promotion_monitor_action_failed', error, {
            ...shopLogMeta,
            regionId: region.id,
            goodsId: item.goodsId,
            adId: item.adId,
            productName: normalizeText(item.productName),
            adSpend: typeof item.adSpend === 'number' && Number.isFinite(item.adSpend) ? item.adSpend : null,
            orderCount: item.orderCount,
            currentRoasRaw: item.currentRoasRaw,
            targetRoasRaw: item.targetRoasRaw,
            triggerReason: operationReasonType,
            message: runtimeFailureMessage,
            actionType: config.actionType,
            executedActionType: executionActionType
          });
        }
      }
    }

    if (sharedStateDirty === true) {
      scheduleSharedStatePersist(SHARED_STATE_CLOUD_PERSIST_DELAY_MS);
    }

    return operationSummary;
  }

  function buildShopSyncLogV2(cookieSyncMode, operationSummary, regionStates, regionIds) {
    const summary = operationSummary && typeof operationSummary === 'object'
      ? {
        ...buildEmptyOperationSummary(),
        ...operationSummary
      }
      : buildEmptyOperationSummary();
    const modificationPreview = buildOperationPreviewText(summary.executedItems, summary.successCount);
    const failurePreview = buildOperationPreviewText(summary.failedItems, summary.failedCount);
    const actionSummaryText = buildExecutedActionSummaryText(summary);
    const conditionParts = [];

    if (summary.skippedByRoas > 0) {
      conditionParts.push(`ROAS\u672a\u8fbe ${summary.skippedByRoas}`);
    }

    if (summary.skippedByOrderCount > 0) {
      conditionParts.push(`\u8ba2\u5355\u672a\u8fbe ${summary.skippedByOrderCount}`);
    }

    if (summary.skippedByDailyLimit > 0) {
      conditionParts.push(`\u65e5\u4e0a\u9650 ${summary.skippedByDailyLimit}`);
    }

    if (summary.skippedByTotalLimit > 0) {
      conditionParts.push(`\u603b\u4e0a\u9650 ${summary.skippedByTotalLimit}`);
    }

    if (summary.skippedByAlreadyPaused > 0) {
      conditionParts.push(`\u8df3\u8fc7\u5df2\u6682\u505c ${summary.skippedByAlreadyPaused}`);
    }

    if (summary.skippedByResumeWaiting > 0) {
      conditionParts.push(`\u5f85\u6062\u590d ${summary.skippedByResumeWaiting}`);
    }

    if (summary.skippedByActionPayload > 0) {
      conditionParts.push(`\u4e0d\u53ef\u6267\u884c ${summary.skippedByActionPayload}`);
    }

    const logParts = [
      `\u6570\u636e: ${buildRegionMonitorDataSummary(regionStates, regionIds)}`
    ];

    if (summary.successCount > 0) {
      logParts.push(
        `\u64cd\u4f5c: ${actionSummaryText}`
        + (modificationPreview ? `\uff08${modificationPreview}\uff09` : '')
      );
    }

    if (summary.failedCount > 0) {
      logParts.push(
        `\u5931\u8d25: ${summary.failedCount}`
        + (failurePreview ? `\uff08${failurePreview}\uff09` : '')
      );
    }

    if (conditionParts.length > 0) {
      logParts.push(`\u8df3\u8fc7: ${conditionParts.join(' / ')}`);
    }

    return logParts.join(' | ');
  }

  function computeRetryDelay(retryCount, options = {}) {
    const nextRetryCount = Math.max(0, Number(retryCount) || 0);
    const baseDelay = options.authRequired === true
      ? RETRY_BASE_DELAY_MS
      : Math.floor(RETRY_BASE_DELAY_MS * 1.5);
    const scaledDelay = baseDelay * Math.max(1, Math.min(6, nextRetryCount + 1));

    return Math.min(RETRY_MAX_DELAY_MS, scaledDelay);
  }

  function resolveMonitorIntervalMs(monitorConfig) {
    if (!monitorConfig || typeof monitorConfig !== 'object') {
      return DEFAULT_MONITOR_INTERVAL_MS;
    }

    return normalizeMonitorIntervalSecondsValue(
      monitorConfig.monitorIntervalSeconds
    ) * 1000;
  }

  function shouldUseRetrySchedule(shopState) {
    const status = normalizeText(shopState && shopState.status);

    return (
      Math.max(0, Number(shopState && shopState.retryCount) || 0) > 0
      || status === 'retrying'
      || status === 'relogin'
    );
  }

  function resolveIntervalDrivenNextRunAt(shopState, monitorConfig) {
    const lastSuccessAt = Date.parse(normalizeText(shopState && shopState.lastSuccessAt));

    if (!Number.isFinite(lastSuccessAt) || lastSuccessAt <= 0) {
      return Math.max(0, Number(shopState && shopState.nextRunAt) || 0);
    }

    return lastSuccessAt + resolveMonitorIntervalMs(monitorConfig);
  }

  function resolveSchedulerDueAt(shopState, monitorConfig) {
    if (!shopState || shopState.enabled !== true) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (shouldUseRetrySchedule(shopState)) {
      return Math.max(0, Number(shopState.nextRunAt) || 0);
    }

    return resolveIntervalDrivenNextRunAt(shopState, monitorConfig);
  }

  async function collectShopMetricsViaAdListSummary(
    shopId,
    shopState,
    monitorConfig,
    selectedRegionIds
  ) {
    const regionQueryPlan = buildPromotionRegionQueryPlan(shopState, selectedRegionIds);
    const queryRegionIds = regionQueryPlan.queryRegionIds;
    const skippedRegionIdSet = new Set(regionQueryPlan.skippedRegionIds);
    let summaryFetchResult = null;

    if (queryRegionIds.length > 0) {
      updateShopStageLog(shopId, shopState, '\u6b63\u5728\u51c6\u5907 Cookies \u5e76\u540c\u6b65\u63a8\u5e7f\u6c47\u603b\u6570\u636e', {
        stage: 'prepare-sync',
        writeRuntimeLog: true
      });

      summaryFetchResult = await promotionMasterSessionService.fetchAdListSummaries(shopId, {
        regionIds: queryRegionIds,
        onRegionStatus: ({ regionId, regionLabel, stage, summary }) => {
          if (stage === 'start') {
            updateShopStageLog(
              shopId,
              shopState,
              `\u6b63\u5728\u540c\u6b65 ${regionLabel} \u63a8\u5e7f\u6c47\u603b`,
              {
                stage: 'region-sync-start',
                regionId,
                writeRuntimeLog: true
              }
            );
            return;
          }

          if (stage === 'done') {
            const promotionOrderCount = resolvePromotionOrderCountFromSummary({
              summary: summary && typeof summary === 'object' ? summary : {}
            });
            const hitPromotionOrder = promotionOrderCount > 0;

            updateShopStageLog(
              shopId,
              shopState,
              hitPromotionOrder
                ? `${regionLabel} \u6c47\u603b\u540c\u6b65\u5b8c\u6210\uff0c\u5df2\u547d\u4e2d\u63a8\u5e7f\u5b50\u8ba2\u5355`
                : `${regionLabel} \u6c47\u603b\u540c\u6b65\u5b8c\u6210`,
              {
                stage: 'region-sync-done',
                regionId,
                writeRuntimeLog: true
              }
            );
          }
        }
      });
    } else {
      updateShopStageLog(
        shopId,
        shopState,
        buildAllRegionsNoPromotionRecheckMessage(),
        {
          stage: 'skip-empty-promotion-regions',
          writeRuntimeLog: true
        }
      );
    }
    const nextRegions = {};
    const regionProductCounts = {};
    const detailRegionIds = [];
    let detailFetchResult = null;
    let operationSummary = buildEmptyOperationSummary();
    const detailCheckEnabled = hasExecutableMonitorAction(monitorConfig);
    const spendThresholdCheckEnabled = hasAutoPauseSpendThreshold(monitorConfig);

    shopState.cookieHeaderByRegion = Object.fromEntries(
      selectedRegionIds.map((regionId) => {
        const nextCookieHeader = normalizeText(
          summaryFetchResult
          && summaryFetchResult.cookieSnapshot
          && summaryFetchResult.cookieSnapshot.byRegion
          && summaryFetchResult.cookieSnapshot.byRegion[regionId]
          && summaryFetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
        );
        const previousCookieHeader = normalizeText(
          shopState.cookieHeaderByRegion
          && shopState.cookieHeaderByRegion[regionId]
        );

        return [regionId, nextCookieHeader || previousCookieHeader];
      })
    );

    for (const region of REGION_ENTRIES) {
      if (!selectedRegionIds.includes(region.id)) {
        nextRegions[region.id] = buildEmptyRegionState(region.id);
        continue;
      }

      const previousRegionState = getStoredRegionState(shopState, region.id);

      if (skippedRegionIdSet.has(region.id)) {
        nextRegions[region.id] = buildSkippedEmptyPromotionRegionState(
          region.id,
          previousRegionState
        );
        continue;
      }

      const regionResult = summaryFetchResult && summaryFetchResult.regions
        ? summaryFetchResult.regions[region.id]
        : null;
      const response = regionResult && regionResult.response ? regionResult.response : null;
      const summaryPayload = regionResult && regionResult.summary && typeof regionResult.summary === 'object'
        ? regionResult.summary
        : {};
      const productCount = resolveSummaryGoodsCount(summaryPayload);
      const promotionOrderCount = resolvePromotionOrderCountFromSummary(summaryPayload);
      const previousPromotionOrderCount = Math.max(
        0,
        Number(
          shopState
          && shopState.regions
          && shopState.regions[region.id]
          && shopState.regions[region.id].promotionOrderCount
        ) || 0
      );
      const hasPromotionOrderIncrease = promotionOrderCount > previousPromotionOrderCount;
      const hasPromotionActivity =
        productCount > 0
        || promotionOrderCount > 0
        || hasPromotionOrderIncrease;
      const shouldFetchDetail =
        hasPromotionActivity
        && (
          spendThresholdCheckEnabled === true
          || promotionOrderCount > 0
          || hasPromotionOrderIncrease
        );

      regionProductCounts[region.id] = productCount;

      if (shouldFetchDetail) {
        detailRegionIds.push(region.id);
      }

      nextRegions[region.id] = copyRegionRuntimeTimingFields(
        {
          regionId: region.id,
          productCount,
          summary: mapSummaryToMetrics(summaryPayload),
          fetchedAt: normalizeText(regionResult && regionResult.fetchedAt) || nowIso(),
          switchMessage: summaryFetchResult && summaryFetchResult.refreshedCookies === true ? 'cookies-refreshed' : 'cookies-cached',
          detailMessage: buildAdListRegionDetailMessage({
            shouldFetchDetail,
            detailCheckEnabled,
            promotionOrderCount,
            hasPromotionOrderIncrease,
            hasPromotionActivity,
            responseMessage: response && response.message
          }),
          summarySource: 'ad-list',
          promotionOrderCount,
          previousPromotionOrderCount,
          hasPromotionOrderIncrease,
          detailFetched: false
        },
        previousRegionState
      );
    }

    if (
      detailCheckEnabled
      && detailRegionIds.length > 0
      && typeof promotionMasterSessionService.fetchAdsDetailSummaries === 'function'
    ) {
      updateShopStageLog(
        shopId,
        shopState,
        spendThresholdCheckEnabled === true
          ? '\u6b63\u5728\u6309\u5b50\u8ba2\u5355/\u603b\u82b1\u8d39\u68c0\u67e5\u5546\u54c1\u5217\u8868'
          : '\u6b63\u5728\u6309\u5b50\u8ba2\u5355(\u63a8\u5e7f) \u68c0\u67e5\u5546\u54c1\u5217\u8868',
        {
          stage: 'detail-sync',
          writeRuntimeLog: true
        }
      );

      detailFetchResult = await promotionMasterSessionService.fetchAdsDetailSummaries(shopId, {
        regionIds: detailRegionIds,
        buildPayload: () => buildAdsDetailPayload(),
        onRegionStatus: ({ regionId, regionLabel, stage, response }) => {
          if (stage === 'start') {
            updateShopStageLog(
              shopId,
              shopState,
              `\u6b63\u5728\u68c0\u67e5 ${regionLabel} ads_detail \u5546\u54c1\u5217\u8868`,
              {
                stage: 'detail-region-start',
                regionId,
                writeRuntimeLog: true
              }
            );
            return;
          }

          if (stage === 'done') {
            const responseData = response && response.data && typeof response.data === 'object'
              ? response.data
              : {};
            const productCount = resolveAdsDetailProductCount(responseData, regionId);

            updateShopStageLog(
              shopId,
              shopState,
              `${regionLabel} ads_detail \u68c0\u67e5\u5b8c\u6210\uff0c\u5546\u54c1 ${productCount} \u4e2a`,
              {
                stage: 'detail-region-done',
                regionId,
                writeRuntimeLog: true
              }
            );
          }
        }
      });
      operationSummary = await executeMonitorActions(
        shopId,
        shopState,
        monitorConfig,
        detailFetchResult,
        {
          regionIds: detailRegionIds
        }
      );

      if (
        detailFetchResult
        && detailFetchResult.cookieSnapshot
        && detailFetchResult.cookieSnapshot.byRegion
      ) {
        detailRegionIds.forEach((regionId) => {
          shopState.cookieHeaderByRegion[regionId] = normalizeText(
            detailFetchResult.cookieSnapshot.byRegion[regionId]
            && detailFetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
          );
        });
      }

      detailRegionIds.forEach((regionId) => {
        const regionResult = detailFetchResult && detailFetchResult.regions
          ? detailFetchResult.regions[regionId]
          : null;
        const response = regionResult && regionResult.response ? regionResult.response : null;
        const responseData = response && response.data && typeof response.data === 'object'
          ? response.data
          : {};
        const detailProductCount = resolveAdsDetailProductCount(responseData, regionId);

        if (nextRegions[regionId]) {
          regionProductCounts[regionId] = detailProductCount;
          nextRegions[regionId].productCount = detailProductCount;
        }

        nextRegions[regionId].detailMessage =
          normalizeText(response && response.message) || '\u5df2\u68c0\u67e5 ads_detail';
        nextRegions[regionId].detailFetched = true;
        nextRegions[regionId] = copyRegionRuntimeTimingFields(
          nextRegions[regionId],
          getStoredRegionState(shopState, regionId)
        );
      });
    }

    shopState.log = buildShopSyncLogV2(
      (detailFetchResult && detailFetchResult.cookieSyncMode)
      || (summaryFetchResult && summaryFetchResult.cookieSyncMode),
      operationSummary,
      nextRegions,
      selectedRegionIds
    );

    return {
      monitorConfig,
      selectedRegionIds,
      regions: nextRegions,
      operationSummary
    };
  }

  async function collectShopMetrics(shopId, shopState) {
    const monitorConfigBundle = await loadMonitorConfig();
    const monitorConfig = resolveShopMonitorConfig(shopId, monitorConfigBundle);
    const selectedRegionEntries = resolveRequestedRegionEntries(monitorConfig.regionIds, {
      useSwitchOrder: true
    });
    const selectedRegionIds = selectedRegionEntries.map((region) => region.id);

    if (selectedRegionEntries.length === 0) {
      shopState.cookieHeaderByRegion = {};
      shopState.log = '\u672a\u9009\u62e9\u76d1\u63a7\u5730\u533a\uff0c\u672c\u8f6e\u8df3\u8fc7\u6570\u636e\u540c\u6b65';

      return {
        monitorConfig,
        selectedRegionIds,
        regions: REGION_ENTRIES.reduce((result, region) => {
          result[region.id] = buildEmptyRegionState(region.id);
          return result;
        }, {}),
        operationSummary: buildEmptyOperationSummary()
      };
    }

    if (
      shouldUseAdListSummaryMonitorFlow(monitorConfig)
      && promotionMasterSessionService
      && typeof promotionMasterSessionService.fetchAdListSummaries === 'function'
    ) {
      // delete_plan needs queryReports summaries because deleted plans may no longer appear in ads_detail.
      return collectShopMetricsViaAdListSummary(
        shopId,
        shopState,
        monitorConfig,
        selectedRegionIds
      );
    }

    if (
      promotionMasterSessionService
      && typeof promotionMasterSessionService.fetchAdsDetailSummaries === 'function'
    ) {
      const regionQueryPlan = buildPromotionRegionQueryPlan(shopState, selectedRegionIds);
      const queryRegionIds = regionQueryPlan.queryRegionIds;
      const skippedRegionIdSet = new Set(regionQueryPlan.skippedRegionIds);
      let fetchResult = null;

      if (queryRegionIds.length > 0) {
        updateShopStageLog(shopId, shopState, '\u6b63\u5728\u51c6\u5907 Cookies \u5e76\u540c\u6b65\u63a8\u5e7f\u6570\u636e', {
          stage: 'prepare-sync',
          writeRuntimeLog: true
        });

        fetchResult = await promotionMasterSessionService.fetchAdsDetailSummaries(shopId, {
          regionIds: queryRegionIds,
          buildPayload: () => buildAdsDetailPayload(),
          onRegionStatus: ({ regionId, regionLabel, stage, response }) => {
            if (stage === 'start') {
              updateShopStageLog(shopId, shopState, `\u6b63\u5728\u540c\u6b65 ${regionLabel} \u63a8\u5e7f\u6570\u636e`, {
                stage: 'region-sync-start',
                regionId,
                writeRuntimeLog: true
              });
              return;
            }

            if (stage === 'done') {
              const responseData = response && response.data && typeof response.data === 'object'
                ? response.data
                : {};
              const productCount = resolveAdsDetailProductCount(responseData, regionId);

              updateShopStageLog(
                shopId,
                shopState,
                `${regionLabel} \u63a8\u5e7f\u6570\u636e\u540c\u6b65\u5b8c\u6210\uff0c\u83b7\u53d6 ${productCount} \u4e2a\u5546\u54c1`,
                {
                  stage: 'region-sync-done',
                  regionId,
                  writeRuntimeLog: true
                }
              );
            }
          }
        });
      } else {
        updateShopStageLog(
          shopId,
          shopState,
          buildAllRegionsNoPromotionRecheckMessage(),
          {
            stage: 'skip-empty-promotion-regions',
            writeRuntimeLog: true
          }
        );
      }
      const nextRegions = {};
      const regionProductCounts = {};
      const operationSummary = hasExecutableMonitorAction(monitorConfig) && fetchResult
        ? await executeMonitorActions(
          shopId,
          shopState,
          monitorConfig,
          fetchResult,
          {
            regionIds: queryRegionIds
          }
        )
        : buildEmptyOperationSummary();

      shopState.cookieHeaderByRegion = Object.fromEntries(
        selectedRegionIds.map((regionId) => {
          const nextCookieHeader = normalizeText(
            fetchResult
            && fetchResult.cookieSnapshot
            && fetchResult.cookieSnapshot.byRegion
            && fetchResult.cookieSnapshot.byRegion[regionId]
            && fetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
          );
          const previousCookieHeader = normalizeText(
            shopState.cookieHeaderByRegion
            && shopState.cookieHeaderByRegion[regionId]
          );

          return [regionId, nextCookieHeader || previousCookieHeader];
        })
      );

      for (const region of REGION_ENTRIES) {
        if (!selectedRegionIds.includes(region.id)) {
          nextRegions[region.id] = buildEmptyRegionState(region.id);
          continue;
        }

        const previousRegionState = getStoredRegionState(shopState, region.id);

        if (skippedRegionIdSet.has(region.id)) {
          nextRegions[region.id] = buildSkippedEmptyPromotionRegionState(
            region.id,
            previousRegionState
          );
          continue;
        }

        const regionResult = fetchResult && fetchResult.regions ? fetchResult.regions[region.id] : null;
        const response = regionResult && regionResult.response ? regionResult.response : null;
        const responseData = response && response.data && typeof response.data === 'object'
          ? response.data
          : {};
        const productCount = resolveAdsDetailProductCount(responseData, region.id);
        const summaryPayload = regionResult && regionResult.summary && typeof regionResult.summary === 'object'
          ? regionResult.summary
          : {};
        const promotionOrderCount = resolvePromotionOrderCountFromSummary(summaryPayload);
        const previousPromotionOrderCount = Math.max(
          0,
          Number(
            shopState
            && shopState.regions
            && shopState.regions[region.id]
            && shopState.regions[region.id].promotionOrderCount
          ) || 0
        );

        regionProductCounts[region.id] = productCount;

        nextRegions[region.id] = copyRegionRuntimeTimingFields({
          regionId: region.id,
          productCount,
          summary: mapSummaryToMetrics(summaryPayload),
          fetchedAt: normalizeText(regionResult && regionResult.fetchedAt) || nowIso(),
          switchMessage: fetchResult && fetchResult.refreshedCookies === true ? 'cookies-refreshed' : 'cookies-cached',
          detailMessage: buildAdsDetailRegionDetailMessage(
            response && response.message,
            productCount
          ),
          summarySource: 'ads-detail',
          promotionOrderCount,
          previousPromotionOrderCount,
          hasPromotionOrderIncrease: promotionOrderCount > previousPromotionOrderCount,
          detailFetched: true
        }, previousRegionState);
      }

      shopState.log = buildShopSyncLogV2(
        fetchResult && fetchResult.cookieSyncMode,
        operationSummary,
        nextRegions,
        selectedRegionIds
      );

      return {
        monitorConfig,
        selectedRegionIds,
        regions: nextRegions,
        operationSummary
      };
    }

    throw new Error('\u63a8\u5e7f\u76d1\u63a7\u4e3b\u4f1a\u8bdd\u670d\u52a1\u4e0d\u53ef\u7528\uff0c\u5c06\u5728\u4e0b\u4e00\u8f6e\u91cd\u8bd5\u3002');

  }

  async function triggerMonitorReloginIfNeeded(shopId, error) {
    if (!(error && error.authRequired === true)) {
      return;
    }

    const controller = getController();

    if (
      !controller
      || typeof controller.beginBackgroundProductPromotionMonitorRelogin !== 'function'
    ) {
      return;
    }

    try {
      const controllerPayload = await buildShopControllerPayload(shopId);
      await controller.beginBackgroundProductPromotionMonitorRelogin({
        ...controllerPayload,
        reason: error && error.loginPending === true
          ? 'monitor-login-pending'
          : 'monitor-auth-expired'
      });
    } catch (reloginError) {
      logError('promotion_monitor_relogin_trigger_failed', reloginError, {
        shopId: normalizeText(shopId)
      });
    }
  }

  async function runPauseThenResumeFallbackCycle(shopId, monitorConfigOverride = null, options = {}) {
    const normalizedShopId = normalizeText(shopId);
    const shopState = getShopRuntimeState(normalizedShopId);

    if (
      !shopState
      || configCache.batchMonitoringActive !== true
      || shopState.enabled !== true
      || shopState.taskRunning === true
    ) {
      return;
    }

    let resolvedMonitorConfig = monitorConfigOverride;

    if (!resolvedMonitorConfig) {
      const monitorConfigBundle = await loadMonitorConfig();
      resolvedMonitorConfig = resolveShopMonitorConfig(normalizedShopId, monitorConfigBundle);
    }

    const monitorConfig = normalizeMonitorConfig(resolvedMonitorConfig);
    const shopLogMeta = await resolveShopLogMeta(normalizedShopId);

    if (
      !isResumeSequenceActionType(monitorConfig.actionType)
      || monitorConfig.resumeIntervalMinutes === null
    ) {
      return;
    }

    const forcedRegionIds = resolveRequestedRegionEntries(options.forceRegionIds, {
      useSwitchOrder: true
    }).map((region) => region.id);
    const dueRegionIds = resolveRequestedRegionEntries(
      getDuePauseThenResumeRegionIds(shopState, monitorConfig),
      { useSwitchOrder: true }
    ).map((region) => region.id);
    const targetRegionIds = forcedRegionIds.length > 0 ? forcedRegionIds : dueRegionIds;

    if (targetRegionIds.length === 0) {
      if (setPauseThenResumeFallbackSchedule(shopState, 0, 0)) {
        stateCache.updatedAt = nowIso();
        scheduleStatePersist(0);
      }
      return;
    }

    if (
      !promotionMasterSessionService
      || typeof promotionMasterSessionService.fetchAdsDetailSummaries !== 'function'
    ) {
      return;
    }

    shopState.taskRunning = true;
    updateShopStageLog(
      normalizedShopId,
      shopState,
      '\u6b63\u5728\u6309\u6062\u590d\u8bbe\u7f6e\u68c0\u67e5\u6682\u505c\u8ba1\u5212',
      {
        stage: 'pause-resume-fallback-start',
        writeRuntimeLog: true
      }
    );

    try {
      const fetchResult = await promotionMasterSessionService.fetchAdsDetailSummaries(normalizedShopId, {
        regionIds: targetRegionIds,
        buildPayload: () => buildAdsDetailPayload({
          sortBy: ADS_DETAIL_SORT_BY_PAUSED_STATUS,
          adStatus: [ADS_DETAIL_PAUSED_STATUS_CODE],
          pageSize: ADS_DETAIL_PAUSED_PAGE_SIZE
        }),
        onRegionStatus: ({ regionId, regionLabel, stage, response }) => {
          if (stage === 'start') {
            updateShopStageLog(
              normalizedShopId,
              shopState,
              `\u6b63\u5728\u68c0\u67e5 ${regionLabel} \u6682\u505c\u8ba1\u5212`,
              {
                stage: 'pause-resume-fallback-region-start',
                regionId,
                writeRuntimeLog: true
              }
            );
            return;
          }

          if (stage === 'done') {
            const responseData = response && response.data && typeof response.data === 'object'
              ? response.data
              : {};
            const productCount = resolveAdsDetailProductCount(responseData, regionId);

            updateShopStageLog(
              normalizedShopId,
              shopState,
              `${regionLabel} \u6682\u505c\u8ba1\u5212\u68c0\u67e5\u5b8c\u6210\uff0c\u83b7\u53d6 ${productCount} \u4e2a\u5546\u54c1`,
              {
                stage: 'pause-resume-fallback-region-done',
                regionId,
                writeRuntimeLog: true
              }
            );
          }
        }
      });
      const operationSummary = await executeMonitorActions(
        normalizedShopId,
        shopState,
        monitorConfig,
        fetchResult,
        {
          regionIds: targetRegionIds,
          pausedOnly: true
        }
      );
      const nextFallbackRunAt = resolvePauseThenResumeFallbackSuccessNextRunAt(
        shopState,
        monitorConfig
      );

      if (
        fetchResult
        && fetchResult.cookieSnapshot
        && fetchResult.cookieSnapshot.byRegion
      ) {
        if (!shopState.cookieHeaderByRegion || typeof shopState.cookieHeaderByRegion !== 'object') {
          shopState.cookieHeaderByRegion = {};
        }

        targetRegionIds.forEach((regionId) => {
          const cookieHeader = normalizeText(
            fetchResult.cookieSnapshot.byRegion[regionId]
            && fetchResult.cookieSnapshot.byRegion[regionId].cookieHeader
          );

          if (cookieHeader) {
            shopState.cookieHeaderByRegion[regionId] = cookieHeader;
          }
        });
      }

      setPauseThenResumeFallbackSchedule(
        shopState,
        nextFallbackRunAt,
        0
      );
      shopState.lastUpdatedAt = nowIso();
      shopState.log = buildShopSyncLogV2(
        fetchResult && fetchResult.cookieSyncMode,
        operationSummary,
        shopState.regions,
        monitorConfig.regionIds
      );

      log('promotion_monitor_pause_resume_fallback_synced', {
        ...shopLogMeta,
        regionIds: targetRegionIds,
        nextRunAt: getPauseThenResumeFallbackNextRunAt(shopState),
        operationSummary
      });
    } catch (error) {
      const retryCount = getPauseThenResumeFallbackRetryCount(shopState);
      const retryDelay = computeRetryDelay(retryCount, {
        authRequired: error && error.authRequired === true
      });

      setPauseThenResumeFallbackSchedule(
        shopState,
        Date.now() + retryDelay,
        retryCount + 1
      );
      shopState.lastUpdatedAt = nowIso();
      shopState.log =
        normalizeText(error && error.message)
        || '\u6682\u505c\u6062\u590d\u68c0\u67e5\u5931\u8d25\uff0c\u5c06\u5728\u7a0d\u540e\u91cd\u8bd5';
      await triggerMonitorReloginIfNeeded(normalizedShopId, error);

      logError('promotion_monitor_pause_resume_fallback_failed', error, {
        ...shopLogMeta,
        regionIds: targetRegionIds,
        nextRunAt: getPauseThenResumeFallbackNextRunAt(shopState),
        authRequired: Boolean(error && error.authRequired)
      });
    } finally {
      shopState.taskRunning = false;
      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
    }
  }

  async function runShopCycle(shopId) {
    const normalizedShopId = normalizeText(shopId);
    const shopState = getShopRuntimeState(normalizedShopId);
    let immediatePauseResumeSweepRegionIds = [];
    let immediatePauseResumeSweepMonitorConfig = null;

    if (
      !shopState
      || configCache.batchMonitoringActive !== true
      || shopState.enabled !== true
      || shopState.taskRunning === true
    ) {
      return;
    }

    const shopLogMeta = await resolveShopLogMeta(normalizedShopId);
    shopState.taskRunning = true;
    shopState.status = 'running';
    shopState.log = '正在检查商品推广在线状态';
    stateCache.updatedAt = nowIso();
    scheduleStatePersist(0);
    appendRuntimeLog('promotion_monitor_shop_cycle_started', shopLogMeta);

    try {
      const collectResult = await collectShopMetrics(normalizedShopId, shopState);
      const nextRegions = collectResult && collectResult.regions ? collectResult.regions : {};
      const operationSummary = collectResult && collectResult.operationSummary ? collectResult.operationSummary : null;
      const monitorConfig = collectResult && collectResult.monitorConfig ? collectResult.monitorConfig : null;
      const selectedRegionIds = collectResult && Array.isArray(collectResult.selectedRegionIds)
        ? collectResult.selectedRegionIds
        : [];
      const successLog = normalizeText(shopState.log);

      shopState.regions = REGION_ENTRIES.reduce((result, region) => {
        result[region.id] = normalizeRegionState(region.id, nextRegions[region.id]);
        return result;
      }, {});
      shopState.status = 'online';
      shopState.log = selectedRegionIds.length > 0
        ? `商品推广在线，已完成 ${selectedRegionIds.length} 个监控地区数据同步`
        : '未选择监控地区，本轮未查询数据';
      shopState.lastUpdatedAt = nowIso();
      shopState.log = successLog || normalizeText(shopState.log);
      shopState.lastSuccessAt = shopState.lastUpdatedAt;
      shopState.lastError = '';
      shopState.retryCount = 0;
      shopState.nextRunAt = Date.now() + resolveMonitorIntervalMs(monitorConfig);

      if (
        shopState.startupPauseResumeSweepPending === true
        && monitorConfig
        && isResumeSequenceActionType(monitorConfig.actionType)
        && monitorConfig.resumeIntervalMinutes !== null
        && selectedRegionIds.length > 0
      ) {
        shopState.startupPauseResumeSweepPending = false;
        immediatePauseResumeSweepRegionIds = selectedRegionIds.slice();
        immediatePauseResumeSweepMonitorConfig = monitorConfig;
      }

      log('promotion_monitor_shop_synced', {
        ...shopLogMeta,
        nextRunAt: shopState.nextRunAt,
        monitorIntervalSeconds: normalizeMonitorIntervalSecondsValue(
          monitorConfig && monitorConfig.monitorIntervalSeconds
        ),
        operationSummary
      });
    } catch (error) {
      const retryDelay = computeRetryDelay(shopState.retryCount, {
        authRequired: error && error.authRequired === true
      });

      shopState.status = error && error.authRequired === true ? 'relogin' : 'retrying';
      shopState.log = normalizeText(error && error.message) || '同步失败，稍后自动重试。';
      shopState.lastError = shopState.log;
      shopState.retryCount += 1;
      shopState.nextRunAt = Date.now() + retryDelay;

      await triggerMonitorReloginIfNeeded(normalizedShopId, error);

      logError('promotion_monitor_shop_sync_failed', error, {
        ...shopLogMeta,
        nextRunAt: shopState.nextRunAt,
        authRequired: Boolean(error && error.authRequired)
      });
    } finally {
      shopState.taskRunning = false;
      stateCache.updatedAt = nowIso();
      scheduleStatePersist(0);
    }

    if (
      immediatePauseResumeSweepRegionIds.length > 0
      && immediatePauseResumeSweepMonitorConfig
    ) {
      await runPauseThenResumeFallbackCycle(
        normalizedShopId,
        immediatePauseResumeSweepMonitorConfig,
        {
          forceRegionIds: immediatePauseResumeSweepRegionIds
        }
      );
    }
  }

  async function runScheduler() {
    if (schedulerRunning) {
      scheduleScheduler(LOOP_INTERVAL_MS);
      return;
    }

    schedulerRunning = true;

    try {
      const owner = await ensureLoaded();
      const monitorConfigBundle = await loadMonitorConfig();
      await reconcileManagedShopAvailability();

      if (!owner) {
        return;
      }

      if (configCache.batchMonitoringActive !== true) {
        return;
      }

      const now = Date.now();
      let hasNextRunAtUpdate = false;
      const dueShopIdSet = new Set();
      const duePauseFallbackShopIds = [];
      const monitorConfigByShopId = new Map();

      Object.values(stateCache.shops)
        .filter((shopState) => (
          shopState
          && shopState.enabled === true
          && shopState.taskRunning !== true
        ))
        .forEach((shopState) => {
          const monitorConfig = resolveShopMonitorConfig(shopState.shopId, monitorConfigBundle);
          const resolvedDueAt = resolveSchedulerDueAt(shopState, monitorConfig);

          monitorConfigByShopId.set(shopState.shopId, monitorConfig);

          if (!shouldUseRetrySchedule(shopState)) {
            const normalizedCurrentNextRunAt = Math.max(0, Number(shopState.nextRunAt) || 0);

            if (normalizedCurrentNextRunAt !== resolvedDueAt) {
              shopState.nextRunAt = resolvedDueAt;
              hasNextRunAtUpdate = true;
            }
          }

          if (now >= resolvedDueAt) {
            dueShopIdSet.add(shopState.shopId);
            return;
          }

          const pauseThenResumeDueAt = resolvePauseThenResumeFallbackDueAt(shopState, monitorConfig);

          if (now >= pauseThenResumeDueAt) {
            duePauseFallbackShopIds.push(shopState.shopId);
          }
        });
      const dueShopIds = Array.from(dueShopIdSet);

      if (hasNextRunAtUpdate) {
        stateCache.updatedAt = nowIso();
        scheduleStatePersist(0);
      }

      await Promise.all([
        ...dueShopIds.map((shopId) => runShopCycle(shopId)),
        ...duePauseFallbackShopIds
          .filter((shopId) => !dueShopIdSet.has(shopId))
          .map((shopId) => runPauseThenResumeFallbackCycle(
            shopId,
            monitorConfigByShopId.get(shopId) || null
          ))
      ]);
    } catch (error) {
      logError('promotion_monitor_scheduler_failed', error);
    } finally {
      schedulerRunning = false;
      scheduleScheduler(LOOP_INTERVAL_MS);
    }
  }

  function serializeShopStateForRenderer(shopState) {
    return {
      shopId: normalizeText(shopState && shopState.shopId),
      enabled: shopState && shopState.enabled === true,
      status: normalizeText(shopState && shopState.status),
      log: normalizeText(shopState && shopState.log),
      lastUpdatedAt: normalizeText(shopState && shopState.lastUpdatedAt),
      lastSuccessAt: normalizeText(shopState && shopState.lastSuccessAt),
      lastError: normalizeText(shopState && shopState.lastError),
      nextRunAt: Math.max(0, Number(shopState && shopState.nextRunAt) || 0),
      regions: REGION_ENTRIES.reduce((result, region) => {
        result[region.id] = normalizeRegionState(
          region.id,
          shopState && shopState.regions && shopState.regions[region.id]
        );
        return result;
      }, {})
    };
  }

  return {
    async init() {
      await ensureLoaded().catch(() => null);
      await reconcileManagedShopAvailability().catch(() => null);
      scheduleScheduler(500);
    },

    async getSnapshot() {
      await ensureLoaded();
      await reconcileManagedShopAvailability();

      return {
        updatedAt: normalizeText(stateCache.updatedAt),
        batchMonitoringActive: configCache.batchMonitoringActive === true,
        enabledShopIds: configCache.enabledShopIds.slice(),
        shops: Object.fromEntries(
          Object.entries(stateCache.shops).map(([shopId, shopState]) => [
            shopId,
            serializeShopStateForRenderer(shopState)
          ])
        )
      };
    },

    async setShopEnabled(payload) {
      const owner = await ensureLoaded();
      const shopId = normalizeText(payload && payload.shopId);
      const enabled = payload && payload.enabled === true;
      const changedAt = nowIso();
      let matchedShop = null;

      if (!owner) {
        throw new Error('当前未登录，无法更新推广监控状态。');
      }

      if (!shopId) {
        throw new Error('缺少店铺标识，无法更新推广监控状态。');
      }

      if (shopManagementService) {
        let state = null;

        if (typeof shopManagementService.getLocalState === 'function') {
          state = await shopManagementService.getLocalState().catch(() => null);
        }

        if (
          (!state || state.localStateAvailable !== true)
          && typeof shopManagementService.getState === 'function'
        ) {
          state = await shopManagementService.getState().catch(() => null);
        }

        matchedShop = Array.isArray(state && state.shops)
          ? state.shops.find((shop) => normalizeText(shop && shop.id) === shopId)
          : null;
        const shopExists = Boolean(matchedShop);

        if (!shopExists) {
          throw new Error('当前店铺不存在或已被删除。');
        }

        if (enabled && isShopParticipating(matchedShop) !== true) {
          throw new Error('\u5F53\u524D\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u4E2D\u5F00\u542F\u540E\u518D\u52A0\u5165\u63A8\u5E7F\u76D1\u63A7\u3002');
        }
      }

      const nextEnabledShopIds = new Set(configCache.enabledShopIds);

      if (enabled) {
        nextEnabledShopIds.add(shopId);
      } else {
        nextEnabledShopIds.delete(shopId);
      }

      configCache.enabledShopIds = Array.from(nextEnabledShopIds);
      configCache.updatedAt = changedAt;

      const shopState = getShopRuntimeState(shopId);

      if (shopState) {
        shopState.enabled = enabled;
        shopState.taskRunning = false;
        shopState.retryCount = 0;
        shopState.startupPauseResumeSweepPending = true;
        shopState.lastUpdatedAt = changedAt;

        if (enabled) {
          if (configCache.batchMonitoringActive === true) {
            shopState.status = shopState.lastSuccessAt ? 'online' : 'idle';
            shopState.log = shopState.lastSuccessAt
              ? (normalizeText(shopState.log) || MONITOR_LOG_ENABLED_WAIT_SYNC)
              : MONITOR_LOG_ENABLED_PREPARING;
            shopState.nextRunAt = 0;
          } else {
            shopState.status = 'idle';
            shopState.log = MONITOR_LOG_JOINED_WAITING;
            shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
          }
        } else {
          shopState.status = 'disabled';
          shopState.log = MONITOR_LOG_NOT_JOINED;
          shopState.lastError = '';
          shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
          shopState.cookieHeaderByRegion = {};

          if (
            promotionMasterSessionService
            && typeof promotionMasterSessionService.invalidateShopCache === 'function'
          ) {
            promotionMasterSessionService.invalidateShopCache(shopId);
          }
        }
      }

      stateCache.updatedAt = changedAt;
      await persistConfig();
      scheduleStatePersist(0);
      scheduleScheduler(configCache.batchMonitoringActive === true && enabled ? 200 : 500);

      log('promotion_monitor_shop_toggle', {
        shopId,
        shopName: normalizeText(
          matchedShop
          && (
            matchedShop.shopName
            || matchedShop.name
            || matchedShop.storeName
            || matchedShop.label
          )
        ),
        enabled
      });

      return this.getSnapshot();
    },

    async setBatchMonitoringActive(payload) {
      const owner = await ensureLoaded();
      const enabled = payload && payload.enabled === true;
      const changedAt = nowIso();

      if (!owner) {
        throw new Error('当前未登录，无法更新批量监控状态。');
      }

      configCache.batchMonitoringActive = enabled;

      Object.values(stateCache.shops).forEach((shopState) => {
        if (!shopState) {
          return;
        }

        shopState.taskRunning = false;
        shopState.retryCount = 0;
        shopState.startupPauseResumeSweepPending = true;
        shopState.lastUpdatedAt = changedAt;

        if (shopState.enabled !== true) {
          shopState.status = 'disabled';
          shopState.log = MONITOR_LOG_NOT_JOINED;
          shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
          return;
        }

        if (enabled) {
          shopState.status = shopState.lastSuccessAt ? 'online' : 'idle';
          shopState.log = shopState.lastSuccessAt
            ? (normalizeText(shopState.log) || MONITOR_LOG_BATCH_STARTED_WAIT_SYNC)
            : MONITOR_LOG_BATCH_STARTED_WAIT_RUN;
          shopState.nextRunAt = 0;
          return;
        }

        shopState.status = 'idle';
        shopState.log = MONITOR_LOG_JOINED_WAITING;
        shopState.lastError = '';
        shopState.nextRunAt = Number.MAX_SAFE_INTEGER;
      });

      stateCache.updatedAt = changedAt;
      scheduleStatePersist(0);
      scheduleScheduler(enabled ? 80 : 500);

      log('promotion_monitor_batch_toggle', {
        enabled,
        enabledShopCount: configCache.enabledShopIds.length
      });

      return this.getSnapshot();
    },

    async getRuntimeLogs(payload) {
      await ensureLoaded().catch(() => null);
      return runtimeLogStore.read(payload);
    },

    async clearRuntimeLogs() {
      return runtimeLogStore.clear();
    },

    shutdown() {
      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = 0;
      }

      if (persistStateTimer) {
        clearTimeout(persistStateTimer);
        persistStateTimer = 0;
      }

      if (persistSharedStateTimer) {
        clearTimeout(persistSharedStateTimer);
        persistSharedStateTimer = 0;
      }
    }
  };
}

module.exports = {
  createPromotionMonitorService
};


