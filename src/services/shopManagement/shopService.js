const {
  PROXY_TYPES,
  DEFAULT_STATUS,
  FALLBACK_GROUP_NAME,
  normalizeText,
  normalizeVisibleFlag,
  isShopParticipating,
  normalizeBrowserStorageAutoSyncEnabled,
  normalizeProxyType,
  createEntityId,
  nowIso,
  buildOwnerDescriptor,
  buildShopRecordKey,
  buildEmptyIndex,
  normalizeIndexRecord,
  toRendererState,
  invalidateFingerprintConfigCache,
  resolveAccountIdentity
} = require('./common');
const {
  normalizeProxyBypassRules,
  normalizeProxyDirectResourceTypes
} = require('./proxyRouting');
const { createShopLocalStore } = require('./localStore');
const { createShopCloudStore } = require('./cloudStore');
const { validateProxyAvailability } = require('./proxyValidator');
const { buildFingerprintConfig, normalizeFingerprintConfig } = require('./fingerprintProfile');
const { getRuntimeFingerprintContext } = require('./runtimeFingerprintContext');
const {
  buildFingerprintProxyContext,
  resolveShopDetailProxyConfig
} = require('./shopDetailProxyConfig');

const REMOTE_INDEX_CACHE_TTL_MS = 60000;

function createShopManagementService({ app, sessionStore, getShopWindowBrowserController }) {
  const localStore = createShopLocalStore({ app });
  const cloudStore = createShopCloudStore();
  let runtimeFingerprintContextPromise = null;
  let remoteIndexCache = {
    ownerKey: '',
    loadedAt: 0,
    hasValue: false,
    indexRecord: null,
    loadPromise: null
  };

  function getCurrentOwner() {
    return buildOwnerDescriptor(sessionStore.getSession());
  }

  function getShopWindowBrowserControllerSafe() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  function normalizeShopAccountSource(payload, fallback = {}) {
    return resolveAccountIdentity({
      phoneNumber: normalizeText(
        payload && Object.prototype.hasOwnProperty.call(payload, 'accountValue')
          ? payload.accountValue
          : (
            payload && Object.prototype.hasOwnProperty.call(payload, 'account')
              ? payload.account
              : payload && payload.phoneNumber
          )
      ),
      email: normalizeText(
        payload && Object.prototype.hasOwnProperty.call(payload, 'email')
          ? payload.email
          : fallback && fallback.email
      )
    });
  }

  function normalizeStoredShopDetail(shopDetail, fallback = {}) {
    const source = shopDetail && typeof shopDetail === 'object' ? shopDetail : {};
    const identity = normalizeShopAccountSource(source, fallback);

    return {
      ...source,
      platformShopId: normalizeText(
        source.platformShopId
        || source.mallId
        || source.shopPlatformId
        || fallback.platformShopId
      ),
      platformShopUniqueId: normalizeText(
        source.platformShopUniqueId
        || source.mallUniqueId
        || source.shopPlatformUniqueId
        || source.uniqueId
        || fallback.platformShopUniqueId
      ),
      phoneNumber: identity.phoneNumber,
      email: identity.email,
      accountValue: identity.accountValue,
      accountType: identity.accountType
    };
  }

  function extractPlatformShopIdFromSessionContext(sessionContext) {
    return normalizeText(
      sessionContext && (
        sessionContext.platformShopId
        || sessionContext.mallId
        || (sessionContext.sellerSession && sessionContext.sellerSession.mallId)
      )
    );
  }

  function extractPlatformShopUniqueIdFromSessionContext(sessionContext) {
    return normalizeText(
      sessionContext && (
        sessionContext.platformShopUniqueId
        || sessionContext.mallUniqueId
        || (sessionContext.sellerSession && sessionContext.sellerSession.mallUniqueId)
      )
    );
  }

  function buildPersistenceError(error, fallbackMessage) {
    if (error && typeof error.message === 'string' && /[\u4e00-\u9fff]/u.test(error.message)) {
      return error;
    }

    if (error && (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN')) {
      return new Error('\u4E91\u7AEF\u5730\u5740\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216 COS \u914D\u7F6E\u3002');
    }

    if (error && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET')) {
      return new Error('\u4E91\u7AEF\u540C\u6B65\u8D85\u65F6\u6216\u4E2D\u65AD\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002');
    }

    if (error && (error.statusCode === 403 || error.statusCode === 401)) {
      return new Error('\u4E91\u7AEF\u5B58\u50A8\u9274\u6743\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 COS \u5BC6\u94A5\u3002');
    }

    return new Error(fallbackMessage);
  }

  async function resolveRuntimeFingerprintContextSafe() {
    if (!runtimeFingerprintContextPromise) {
      runtimeFingerprintContextPromise = getRuntimeFingerprintContext(app).catch((error) => {
        runtimeFingerprintContextPromise = null;
        console.error('Failed to resolve runtime fingerprint context:', error);
        return {};
      });
    }

    return runtimeFingerprintContextPromise;
  }

  async function persistLocalIndex(owner, indexRecord) {
    try {
      await localStore.saveIndex(owner, indexRecord);
    } catch (error) {
      console.error('Failed to save local shop index:', error);
    }
  }

  async function persistLocalShopRecord(owner, recordKey, payload) {
    try {
      await localStore.saveShopRecord(owner, recordKey, payload);
    } catch (error) {
      console.error('Failed to save local shop record:', error);
    }
  }

  function getOwnerCacheKey(owner) {
    return normalizeText(owner && owner.userKey);
  }

  function readCachedRemoteIndex(owner) {
    const ownerKey = getOwnerCacheKey(owner);

    if (
      !ownerKey
      || remoteIndexCache.ownerKey !== ownerKey
      || remoteIndexCache.hasValue !== true
      || remoteIndexCache.loadedAt <= 0
      || Date.now() - remoteIndexCache.loadedAt >= REMOTE_INDEX_CACHE_TTL_MS
    ) {
      return {
        hit: false,
        indexRecord: null
      };
    }

    return {
      hit: true,
      indexRecord: remoteIndexCache.indexRecord
    };
  }

  function writeRemoteIndexCache(owner, indexRecord) {
    const ownerKey = getOwnerCacheKey(owner);

    remoteIndexCache = {
      ownerKey,
      loadedAt: Date.now(),
      hasValue: Boolean(ownerKey),
      indexRecord: indexRecord || null,
      loadPromise: null
    };
  }

  function hasLegacyEmailAccount(record) {
    const source = record && typeof record === 'object' ? record : {};
    const identity = resolveAccountIdentity(source);

    return Boolean(
      identity.accountType === 'email'
      && !normalizeText(source.email)
      && normalizeText(source.phoneNumber)
    );
  }

  function hasLegacyEmailAccountInIndex(indexRecord) {
    return Array.isArray(indexRecord && indexRecord.shops)
      && indexRecord.shops.some((shop) => hasLegacyEmailAccount(shop));
  }

  function normalizeShopRecordEnvelope(owner, recordKey, shopRecordEnvelope) {
    const normalizedRecordKey = normalizeText(recordKey);
    const rawEnvelope = shopRecordEnvelope && typeof shopRecordEnvelope === 'object'
      ? shopRecordEnvelope
      : {};
    const rawShopDetail = rawEnvelope.shop && typeof rawEnvelope.shop === 'object'
      ? rawEnvelope.shop
      : {};
    const normalizedShopDetail = normalizeStoredShopDetail(rawShopDetail);

    return {
      version: Number(rawEnvelope.version) || 1,
      owner,
      shop: {
        ...normalizedShopDetail,
        recordKey: normalizeText(rawShopDetail.recordKey || normalizedRecordKey)
      },
      updatedAt: normalizeText(rawEnvelope.updatedAt) || normalizeText(normalizedShopDetail.updatedAt) || nowIso()
    };
  }

  async function migrateLegacyRemoteShops(owner, remoteIndex) {
    const remoteShops = Array.isArray(remoteIndex && remoteIndex.shops)
      ? remoteIndex.shops
      : [];

    for (const remoteShop of remoteShops) {
      if (!hasLegacyEmailAccount(remoteShop)) {
        continue;
      }

      const recordKey = normalizeText(remoteShop && remoteShop.recordKey);

      if (!recordKey) {
        continue;
      }

      try {
        const remoteRecord = await cloudStore.readShopRecord(owner, recordKey);
        const normalizedRecord = normalizeShopRecordEnvelope(
          owner,
          recordKey,
          remoteRecord || {
            version: 1,
            owner,
            shop: remoteShop,
            updatedAt: normalizeText(remoteShop && remoteShop.updatedAt) || nowIso()
          }
        );
        const normalizedSummary = buildShopSummary(normalizedRecord.shop, recordKey);

        await persistLocalShopRecord(owner, recordKey, normalizedRecord);
        await persistCloudShopRecord(owner, recordKey, normalizedRecord, normalizedSummary);
      } catch (_error) {
        // Ignore per-shop migration failures and keep loading remaining shops.
      }
    }
  }

  async function loadRemoteIndex(owner, options = {}) {
    const force = options && options.force === true;
    const ownerKey = getOwnerCacheKey(owner);

    if (!force) {
      const cached = readCachedRemoteIndex(owner);

      if (cached.hit) {
        return cached.indexRecord;
      }

      if (
        ownerKey
        && remoteIndexCache.ownerKey === ownerKey
        && remoteIndexCache.loadPromise
      ) {
        return remoteIndexCache.loadPromise;
      }
    }

    const loadPromise = (async () => {
      const remoteIndex = await cloudStore.readIndex(owner);

      if (!remoteIndex) {
        writeRemoteIndexCache(owner, null);
        return null;
      }

      if (hasLegacyEmailAccountInIndex(remoteIndex)) {
        await migrateLegacyRemoteShops(owner, remoteIndex);
      }

      const normalizedIndex = normalizeIndexRecord(remoteIndex, owner);
      await persistLocalIndex(owner, normalizedIndex);
      if (hasLegacyEmailAccountInIndex(remoteIndex)) {
        await persistCloudIndex(owner, normalizedIndex);
      }
      writeRemoteIndexCache(owner, normalizedIndex);
      return normalizedIndex;
    })();

    if (!force && ownerKey) {
      remoteIndexCache = {
        ...remoteIndexCache,
        ownerKey,
        loadPromise
      };
    }

    try {
      return await loadPromise;
    } finally {
      if (
        !force
        && ownerKey
        && remoteIndexCache.ownerKey === ownerKey
        && remoteIndexCache.loadPromise === loadPromise
      ) {
        remoteIndexCache = {
          ...remoteIndexCache,
          loadPromise: null
        };
      }
    }
  }

  async function loadLocalIndex(owner) {
    const localIndex = await localStore.readIndex(owner);

    if (!localIndex) {
      return null;
    }

    const normalizedIndex = normalizeIndexRecord(localIndex, owner);

    if (hasLegacyEmailAccountInIndex(localIndex)) {
      await persistLocalIndex(owner, normalizedIndex);
      await persistCloudIndex(owner, normalizedIndex).catch(() => {});
    }

    return normalizedIndex;
  }

  async function getIndexForRead(owner) {
    try {
      const remoteIndex = await loadRemoteIndex(owner);

      if (remoteIndex) {
        return remoteIndex;
      }
    } catch (_error) {
      // Ignore cloud read failures for list display and use local cache.
    }

    const localIndex = await loadLocalIndex(owner);
    return localIndex || buildEmptyIndex(owner);
  }

  async function getIndexForWrite(owner) {
    let remoteError = null;

    try {
      const remoteIndex = await loadRemoteIndex(owner, {
        force: true
      });

      if (remoteIndex) {
        return remoteIndex;
      }
    } catch (error) {
      remoteError = error;
    }

    const localIndex = await loadLocalIndex(owner);

    if (localIndex) {
      return localIndex;
    }

    if (remoteError) {
      throw buildPersistenceError(
        remoteError,
        '\u4E91\u7AEF\u5E97\u94FA\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u6682\u65F6\u65E0\u6CD5\u4FDD\u5B58\u3002'
      );
    }

    return buildEmptyIndex(owner);
  }

  async function enrichIndexRecordWithRuntimePlatformShopIds(indexRecord) {
    const controller = getShopWindowBrowserControllerSafe();

    if (
      !controller
      || typeof controller.getCachedShopSessionContext !== 'function'
      || !Array.isArray(indexRecord && indexRecord.shops)
      || indexRecord.shops.length <= 0
    ) {
      return indexRecord;
    }

    const nextShops = await Promise.all(
      indexRecord.shops.map(async (shopSummary) => {
        if (
          normalizeText(shopSummary && shopSummary.platformShopId)
          && normalizeText(shopSummary && shopSummary.platformShopUniqueId)
        ) {
          return shopSummary;
        }

        try {
          const sessionContext = await controller.getCachedShopSessionContext({
            shopId: normalizeText(shopSummary && shopSummary.id)
          });
          const resolvedPlatformShopId = extractPlatformShopIdFromSessionContext(sessionContext);
          const resolvedPlatformShopUniqueId = extractPlatformShopUniqueIdFromSessionContext(sessionContext);

          if (!resolvedPlatformShopId && !resolvedPlatformShopUniqueId) {
            return shopSummary;
          }

          return {
            ...shopSummary,
            platformShopId: resolvedPlatformShopId || normalizeText(shopSummary && shopSummary.platformShopId),
            platformShopUniqueId: resolvedPlatformShopUniqueId || normalizeText(shopSummary && shopSummary.platformShopUniqueId)
          };
        } catch (_error) {
          return shopSummary;
        }
      })
    );

    return {
      ...indexRecord,
      shops: nextShops
    };
  }

  function buildProxyConfig(payload) {
    const type = normalizeProxyType(payload && payload.proxyType);
    const bypassRules = normalizeProxyBypassRules(payload && payload.proxyBypassRules);
    const directResourceTypes = normalizeProxyDirectResourceTypes({
      script: payload && payload.proxyDirectScriptEnabled,
      style: payload && payload.proxyDirectStyleEnabled,
      font: payload && payload.proxyDirectFontEnabled,
      image: payload && payload.proxyDirectImageEnabled,
      video: payload && payload.proxyDirectVideoEnabled
    });

    if (type === PROXY_TYPES.local) {
      return {
        type,
        host: '',
        port: '',
        username: '',
        password: '',
        bypassRules: '',
        directResourceTypes
      };
    }

    const host = normalizeText(payload && payload.proxyHost);
    const port = normalizeText(payload && payload.proxyPort);
    const username = normalizeText(payload && payload.proxyUsername);
    const password = normalizeText(payload && payload.proxyPassword);

    if (!host) {
      throw new Error('\u8BF7\u586B\u5199\u4EE3\u7406 IP \u5730\u5740\u3002');
    }

    if (!port) {
      throw new Error('\u8BF7\u586B\u5199\u4EE3\u7406\u7AEF\u53E3\u3002');
    }

    if (!/^\d{1,5}$/.test(port)) {
      throw new Error('\u4EE3\u7406\u7AEF\u53E3\u683C\u5F0F\u4E0D\u6B63\u786E\u3002');
    }

    if (!username) {
      throw new Error('\u8BF7\u586B\u5199\u4EE3\u7406\u7528\u6237\u8D26\u53F7\u3002');
    }

    if (!password) {
      throw new Error('\u8BF7\u586B\u5199\u4EE3\u7406\u7528\u6237\u5BC6\u7801\u3002');
    }

    return {
      type,
      host,
      port,
      username,
      password,
      bypassRules,
      directResourceTypes
    };
  }

  function assertGroupName(groups, name, excludedGroupId = '') {
    if (!name) {
      throw new Error('\u8BF7\u586B\u5199\u5206\u7EC4\u540D\u79F0\u3002');
    }

    const normalizedExcludedGroupId = normalizeText(excludedGroupId);
    const existedGroup = groups.find(
      (group) =>
        normalizeText(group && group.id) !== normalizedExcludedGroupId
        && normalizeText(group && group.name).toLowerCase() === name.toLowerCase()
    );

    if (existedGroup) {
      throw new Error('\u8BE5\u5206\u7EC4\u540D\u79F0\u5DF2\u5B58\u5728\u3002');
    }
  }

  function ensureUniqueShop(shops, accountValue, shopName, excludedShopId = '') {
    const normalizedAccountValue = normalizeText(accountValue);
    const normalizedShopName = normalizeText(shopName).toLowerCase();
    const normalizedExcludedShopId = normalizeText(excludedShopId);

    const existedShop = shops.find(
      (shop) =>
        normalizeText(shop.id) !== normalizedExcludedShopId
        && (
          normalizeText(shop.accountValue || shop.email || shop.phoneNumber) === normalizedAccountValue
          || normalizeText(shop.shopName).toLowerCase() === normalizedShopName
        )
    );

    if (existedShop) {
      throw new Error('\u5DF2\u5B58\u5728\u76F8\u540C\u624B\u673A\u53F7/\u90AE\u7BB1\u6216\u5E97\u94FA\u540D\u79F0\u7684\u5E97\u94FA\u8BB0\u5F55\u3002');
    }
  }

  function ensureUniquePlatformShopId(shops, platformShopId, excludedShopId = '') {
    const normalizedPlatformShopId = normalizeText(platformShopId);
    const normalizedExcludedShopId = normalizeText(excludedShopId);

    if (!normalizedPlatformShopId) {
      return;
    }

    const existedShop = shops.find(
      (shop) =>
        normalizeText(shop.id) !== normalizedExcludedShopId
        && normalizeText(shop.platformShopId) === normalizedPlatformShopId
    );

    if (existedShop) {
      throw new Error('\u5DF2\u5B58\u5728\u76F8\u540C\u5E73\u53F0\u5E97\u94FAID\u7684\u5E97\u94FA\u8BB0\u5F55\u3002');
    }
  }

  function findSelectedGroup(groups, groupId) {
    if (!groupId) {
      return null;
    }

    return groups.find((group) => group.id === groupId) || null;
  }

  function assertShopPayload(accountValue, shopName, loginPassword, groupId, selectedGroup) {
    if (!accountValue) {
      throw new Error('\u8BF7\u586B\u5199\u624B\u673A\u53F7\u6216\u90AE\u7BB1\u3002');
    }

    if (!shopName) {
      throw new Error('\u8BF7\u586B\u5199\u5E97\u94FA\u540D\u79F0\u3002');
    }

    if (!loginPassword) {
      throw new Error('\u8BF7\u586B\u5199\u767B\u5F55\u5BC6\u7801\u3002');
    }

    if (groupId && !selectedGroup) {
      throw new Error('\u9009\u62E9\u7684\u5E97\u94FA\u5206\u7EC4\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002');
    }
  }

  function buildShopFingerprintPayload(payload, currentFingerprintConfig = {}) {
    return {
      ...currentFingerprintConfig,
      ...(payload || {}),
      fingerprintMode:
        payload && payload.fingerprintMode !== undefined
          ? payload.fingerprintMode
          : currentFingerprintConfig.mode,
      fingerprintSeed:
        payload && payload.fingerprintSeed !== undefined
          ? payload.fingerprintSeed
          : currentFingerprintConfig.fingerprintSeed
    };
  }

  function buildShopSummary(shopDetail, recordKey) {
    const normalizedDetail = normalizeStoredShopDetail(shopDetail);
    const proxyConfig = normalizedDetail.proxyConfig || {};
    return {
      id: normalizedDetail.id,
      platformShopId: normalizedDetail.platformShopId,
      platformShopUniqueId: normalizedDetail.platformShopUniqueId,
      recordKey,
      phoneNumber: normalizedDetail.phoneNumber,
      email: normalizedDetail.email,
      accountValue: normalizedDetail.accountValue,
      accountType: normalizedDetail.accountType,
      shopName: normalizedDetail.shopName,
      note: normalizedDetail.note,
      groupId: normalizedDetail.groupId,
      groupName: normalizedDetail.groupName,
      proxyType: proxyConfig.type || PROXY_TYPES.local,
      proxyEnabled: (proxyConfig.type || PROXY_TYPES.local) !== PROXY_TYPES.local,
      proxyHost: proxyConfig.host || '',
      proxyPort: proxyConfig.port || '',
      proxyUsername: proxyConfig.username || '',
      proxyBypassRules: proxyConfig.bypassRules || '',
      proxyDirectResourceTypes: {
        ...(proxyConfig.directResourceTypes || {})
      },
      fingerprintConfig: normalizedDetail.fingerprintConfig,
      isVisible: isShopParticipating(normalizedDetail),
      browserStorageAutoSyncEnabled: normalizedDetail.browserStorageAutoSyncEnabled !== false,
      status: normalizedDetail.status,
      proxyVerifiedAt: normalizedDetail.proxyVerifiedAt,
      createdAt: normalizedDetail.createdAt,
      updatedAt: normalizedDetail.updatedAt
    };
  }

  function buildShopRecordEnvelope(owner, shopDetail, recordKey, updatedAt) {
    return {
      version: 1,
      owner,
      shop: {
        ...shopDetail,
        recordKey
      },
      updatedAt
    };
  }

  function buildFallbackShopDetail(shopSummary) {
    const accountIdentity = resolveAccountIdentity(shopSummary);
    return {
      id: normalizeText(shopSummary && shopSummary.id),
      platformShopId: normalizeText(shopSummary && shopSummary.platformShopId),
      platformShopUniqueId: normalizeText(shopSummary && shopSummary.platformShopUniqueId),
      phoneNumber: accountIdentity.phoneNumber,
      email: accountIdentity.email,
      accountValue: accountIdentity.accountValue,
      accountType: accountIdentity.accountType,
      shopName: normalizeText(shopSummary && shopSummary.shopName),
      loginPassword: '',
      note: normalizeText(shopSummary && shopSummary.note),
      groupId: normalizeText(shopSummary && shopSummary.groupId),
      groupName: normalizeText(shopSummary && shopSummary.groupName) || FALLBACK_GROUP_NAME,
      proxyConfig: {
        type: normalizeProxyType(shopSummary && shopSummary.proxyType),
        host: normalizeText(shopSummary && shopSummary.proxyHost),
        port: normalizeText(shopSummary && shopSummary.proxyPort),
        username: normalizeText(shopSummary && shopSummary.proxyUsername),
        password: '',
        bypassRules: normalizeProxyBypassRules(
          shopSummary && (shopSummary.proxyBypassRules || (shopSummary.proxyConfig && shopSummary.proxyConfig.bypassRules))
        ),
        directResourceTypes: normalizeProxyDirectResourceTypes(
          shopSummary && (
            shopSummary.proxyDirectResourceTypes
            || (shopSummary.proxyConfig && shopSummary.proxyConfig.directResourceTypes)
          )
        )
      },
      fingerprintConfig: shopSummary && shopSummary.fingerprintConfig ? { ...shopSummary.fingerprintConfig } : {},
      isVisible: isShopParticipating(shopSummary),
      browserStorageAutoSyncEnabled: normalizeBrowserStorageAutoSyncEnabled(
        shopSummary && shopSummary.browserStorageAutoSyncEnabled,
        true
      ),
      status: normalizeText(shopSummary && shopSummary.status) || DEFAULT_STATUS,
      proxyVerifiedAt: normalizeText(shopSummary && shopSummary.proxyVerifiedAt),
      createdAt: normalizeText(shopSummary && shopSummary.createdAt),
      updatedAt: normalizeText(shopSummary && shopSummary.updatedAt),
      recordKey: normalizeText(shopSummary && shopSummary.recordKey)
    };
  }

  function toEditableShopDetail(shopSummary, shopRecordEnvelope, runtimeFingerprintContext = {}) {
    const fallbackShopDetail = buildFallbackShopDetail(shopSummary);
    const rawShopDetail = shopRecordEnvelope && shopRecordEnvelope.shop ? shopRecordEnvelope.shop : {};
    const normalizedRawShopDetail = normalizeStoredShopDetail(rawShopDetail, fallbackShopDetail);
    const phoneNumber = normalizeText(normalizedRawShopDetail.phoneNumber || fallbackShopDetail.phoneNumber);
    const email = normalizeText(normalizedRawShopDetail.email || fallbackShopDetail.email);
    const accountValue = normalizeText(
      normalizedRawShopDetail.accountValue
      || phoneNumber
      || email
    );
    const accountType = normalizeText(normalizedRawShopDetail.accountType)
      || (email ? 'email' : (phoneNumber ? 'phone' : ''));
    const shopName = normalizeText(normalizedRawShopDetail.shopName || fallbackShopDetail.shopName);
    const fingerprintIdentity = {
      shopId: normalizeText(shopSummary && shopSummary.id),
      phoneNumber: accountValue,
      shopName
    };
    const resolvedProxyConfig = resolveShopDetailProxyConfig(
      normalizedRawShopDetail.proxyConfig,
      fallbackShopDetail.proxyConfig
    );

    return {
      id: normalizeText(shopSummary && shopSummary.id),
      platformShopId: normalizeText(normalizedRawShopDetail.platformShopId || fallbackShopDetail.platformShopId),
      platformShopUniqueId: normalizeText(
        normalizedRawShopDetail.platformShopUniqueId
        || fallbackShopDetail.platformShopUniqueId
      ),
      recordKey: normalizeText(normalizedRawShopDetail.recordKey || fallbackShopDetail.recordKey),
      phoneNumber,
      email,
      accountValue,
      accountType,
      shopName,
      loginPassword: normalizeText(normalizedRawShopDetail.loginPassword),
      note: normalizeText(normalizedRawShopDetail.note || fallbackShopDetail.note),
      groupId: normalizeText(normalizedRawShopDetail.groupId || fallbackShopDetail.groupId),
      groupName: normalizeText(normalizedRawShopDetail.groupName || fallbackShopDetail.groupName) || FALLBACK_GROUP_NAME,
      proxyConfig: resolvedProxyConfig,
      fingerprintConfig: normalizeFingerprintConfig(
        normalizedRawShopDetail.fingerprintConfig || fallbackShopDetail.fingerprintConfig,
        fingerprintIdentity,
        {
          ...runtimeFingerprintContext,
          proxyConfig: buildFingerprintProxyContext(resolvedProxyConfig)
        }
      ),
      isVisible: isShopParticipating(
        {
          isVisible:
            normalizedRawShopDetail.isVisible !== undefined
              ? normalizedRawShopDetail.isVisible
              : fallbackShopDetail.isVisible
        },
        true
      ),
      browserStorageAutoSyncEnabled: normalizeBrowserStorageAutoSyncEnabled(
        normalizedRawShopDetail.browserStorageAutoSyncEnabled !== undefined
          ? normalizedRawShopDetail.browserStorageAutoSyncEnabled
          : fallbackShopDetail.browserStorageAutoSyncEnabled,
        true
      ),
      status: normalizeText(normalizedRawShopDetail.status || fallbackShopDetail.status) || DEFAULT_STATUS,
      proxyVerifiedAt: normalizeText(normalizedRawShopDetail.proxyVerifiedAt || fallbackShopDetail.proxyVerifiedAt),
      createdAt: normalizeText(normalizedRawShopDetail.createdAt || fallbackShopDetail.createdAt),
      updatedAt: normalizeText(normalizedRawShopDetail.updatedAt || fallbackShopDetail.updatedAt)
    };
  }

  function buildNextIndex(owner, groups, shops) {
    return normalizeIndexRecord(
      {
        version: 1,
        owner,
        groups,
        shops,
        updatedAt: nowIso()
      },
      owner
    );
  }

  async function persistResolvedPlatformShopId(owner, currentIndex, shopSummary, payload = {}) {
    const normalizedPayload =
      payload && typeof payload === 'object'
        ? payload
        : {
          platformShopId: payload
        };
    const normalizedPlatformShopId = normalizeText(
      normalizedPayload && normalizedPayload.platformShopId
    );
    const normalizedPlatformShopUniqueId = normalizeText(
      normalizedPayload && (
        normalizedPayload.platformShopUniqueId
        || normalizedPayload.mallUniqueId
        || normalizedPayload.uniqueId
      )
    );
    const normalizedShopId = normalizeText(shopSummary && shopSummary.id);

    if (
      !normalizedShopId
      || (!normalizedPlatformShopId && !normalizedPlatformShopUniqueId)
    ) {
      return {
        updated: false,
        indexRecord: currentIndex
      };
    }

    if (
      (!normalizedPlatformShopId || normalizeText(shopSummary && shopSummary.platformShopId) === normalizedPlatformShopId)
      && (!normalizedPlatformShopUniqueId || normalizeText(shopSummary && shopSummary.platformShopUniqueId) === normalizedPlatformShopUniqueId)
    ) {
      return {
        updated: false,
        indexRecord: currentIndex
      };
    }

    const duplicateShop = currentIndex.shops.find(
      (currentShop) =>
        normalizeText(currentShop && currentShop.id) !== normalizedShopId
        && normalizeText(currentShop && currentShop.platformShopId) === normalizedPlatformShopId
    );

    if (duplicateShop) {
      return {
        updated: false,
        indexRecord: currentIndex,
        skippedReason: 'duplicate-platform-shop-id'
      };
    }

    const currentShopRecordEnvelope = await loadShopRecordEnvelope(owner, shopSummary);
    const currentShopDetail = toEditableShopDetail(
      shopSummary,
      currentShopRecordEnvelope,
      await resolveRuntimeFingerprintContextSafe()
    );
    const timestamp = nowIso();
    const recordKey =
      normalizeText(shopSummary.recordKey)
      || normalizeText(currentShopDetail.recordKey)
      || buildShopRecordKey({
        id: normalizedShopId,
        phoneNumber: currentShopDetail.accountValue,
        shopName: currentShopDetail.shopName
      });
    const nextShopDetail = {
      ...currentShopDetail,
      platformShopId: normalizedPlatformShopId || normalizeText(currentShopDetail && currentShopDetail.platformShopId),
      platformShopUniqueId: normalizedPlatformShopUniqueId || normalizeText(currentShopDetail && currentShopDetail.platformShopUniqueId),
      updatedAt: timestamp
    };
    const nextShopSummary = buildShopSummary(nextShopDetail, recordKey);
    const nextShopRecordEnvelope = buildShopRecordEnvelope(owner, nextShopDetail, recordKey, timestamp);
    const nextIndex = buildNextIndex(
      owner,
      currentIndex.groups,
      currentIndex.shops.map((shop) => (
        normalizeText(shop && shop.id) === normalizedShopId ? nextShopSummary : shop
      ))
    );

    await persistCloudShopRecord(owner, recordKey, nextShopRecordEnvelope, nextShopSummary);
    await persistCloudIndex(owner, nextIndex);
    await persistLocalShopRecord(owner, recordKey, nextShopRecordEnvelope);
    await persistLocalIndex(owner, nextIndex);

    return {
      updated: true,
      indexRecord: nextIndex,
      shopSummary: nextShopSummary
    };
  }

  async function persistCloudIndex(owner, indexRecord) {
    try {
      await cloudStore.saveIndex(owner, indexRecord);
      writeRemoteIndexCache(owner, normalizeIndexRecord(indexRecord, owner));
    } catch (error) {
      throw buildPersistenceError(error, '\u5E97\u94FA\u5217\u8868\u540C\u6B65\u4E91\u7AEF\u5931\u8D25\u3002');
    }
  }

  async function persistCloudShopRecord(owner, recordKey, payload, shopSummary) {
    try {
      await cloudStore.saveShopRecord(owner, recordKey, payload, shopSummary);
    } catch (error) {
      throw buildPersistenceError(error, '\u5E97\u94FA\u660E\u7EC6\u540C\u6B65\u4E91\u7AEF\u5931\u8D25\u3002');
    }
  }

  async function loadRemoteShopRecord(owner, recordKey) {
    const remoteRecord = await cloudStore.readShopRecord(owner, recordKey);

    if (!remoteRecord) {
      return null;
    }

    const normalizedRecord = normalizeShopRecordEnvelope(owner, recordKey, remoteRecord);

    await persistLocalShopRecord(owner, recordKey, normalizedRecord);

    if (hasLegacyEmailAccount(remoteRecord && remoteRecord.shop)) {
      const normalizedSummary = buildShopSummary(
        normalizedRecord.shop,
        normalizeText(normalizedRecord.shop && normalizedRecord.shop.recordKey) || normalizeText(recordKey)
      );
      await persistCloudShopRecord(
        owner,
        normalizeText(recordKey),
        normalizedRecord,
        normalizedSummary
      );
    }

    return normalizedRecord;
  }

  async function loadLocalShopRecord(owner, recordKey) {
    return localStore.readShopRecord(owner, recordKey);
  }

  async function loadShopRecordEnvelope(owner, shopSummary) {
    const recordKey = normalizeText(shopSummary && shopSummary.recordKey);
    const fallbackEnvelope = {
      version: 1,
      owner,
      shop: buildFallbackShopDetail(shopSummary),
      updatedAt: normalizeText(shopSummary && shopSummary.updatedAt) || nowIso()
    };

    if (!recordKey) {
      return fallbackEnvelope;
    }

    try {
      const remoteRecord = await loadRemoteShopRecord(owner, recordKey);

      if (remoteRecord) {
        return remoteRecord;
      }
    } catch (_error) {
      // Ignore cloud read failures for edit form preload and use local/fallback data.
    }

    try {
      const localRecord = await loadLocalShopRecord(owner, recordKey);

      if (localRecord) {
        const normalizedLocalRecord = normalizeShopRecordEnvelope(owner, recordKey, localRecord);

        if (hasLegacyEmailAccount(localRecord && localRecord.shop)) {
          const normalizedSummary = buildShopSummary(normalizedLocalRecord.shop, recordKey);
          await persistLocalShopRecord(owner, recordKey, normalizedLocalRecord);
          await persistCloudShopRecord(owner, recordKey, normalizedLocalRecord, normalizedSummary).catch(() => {});
        }

        return normalizedLocalRecord;
      }
    } catch (_error) {
      // Ignore local read failures and fall back to index data.
    }

    return fallbackEnvelope;
  }

  async function getShopSummary(owner, shopId, emptySelectionMessage) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      throw new Error(emptySelectionMessage);
    }

    const indexRecord = await getIndexForRead(owner);
    const shopSummary = indexRecord.shops.find((shop) => shop.id === normalizedShopId);

    if (!shopSummary) {
      throw new Error('\u5F53\u524D\u5E97\u94FA\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002');
    }

    return shopSummary;
  }

  function findShopSummaryInIndex(indexRecord, shopId) {
    const normalizedShopId = normalizeText(shopId);
    const shops = Array.isArray(indexRecord && indexRecord.shops) ? indexRecord.shops : [];

    if (!normalizedShopId) {
      return null;
    }

    return shops.find((shop) => normalizeText(shop && shop.id) === normalizedShopId) || null;
  }

  async function getShopSummaryPreferLocal(owner, shopId, emptySelectionMessage) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      throw new Error(emptySelectionMessage);
    }

    try {
      const localIndex = await loadLocalIndex(owner);
      const localShopSummary = findShopSummaryInIndex(localIndex, normalizedShopId);

      if (localShopSummary) {
        return localShopSummary;
      }
    } catch (_error) {
      // Ignore local cache read failures and continue with the default read path.
    }

    return getShopSummary(owner, normalizedShopId, emptySelectionMessage);
  }

  async function loadShopRuntimeEnvelope(owner, shopSummary) {
    const recordKey = normalizeText(shopSummary && shopSummary.recordKey);
    const fallbackEnvelope = {
      version: 1,
      owner,
      shop: buildFallbackShopDetail(shopSummary),
      updatedAt: normalizeText(shopSummary && shopSummary.updatedAt) || nowIso()
    };

    if (!recordKey) {
      return fallbackEnvelope;
    }

    try {
      const localRecord = await loadLocalShopRecord(owner, recordKey);

      if (localRecord) {
        return localRecord;
      }
    } catch (_error) {
      // Ignore local cache read failures and continue with remote/fallback data.
    }

    try {
      const remoteRecord = await loadRemoteShopRecord(owner, recordKey);

      if (remoteRecord) {
        return remoteRecord;
      }
    } catch (_error) {
      // Ignore cloud read failures and use fallback data for runtime autofill.
    }

    return fallbackEnvelope;
  }

  async function refreshShopWindowRuntimeEnvironment(payload = {}) {
    const controller = getShopWindowBrowserControllerSafe();

    if (!controller || typeof controller.refreshShopRuntimeEnvironment !== 'function') {
      return null;
    }

    try {
      return await controller.refreshShopRuntimeEnvironment(payload);
    } catch (error) {
      console.error('Failed to refresh shop browser runtime environment:', error);
      return null;
    }
  }

  return {
    async getLocalState() {
      const owner = getCurrentOwner();
      const localIndex = await loadLocalIndex(owner);
      const indexRecord = localIndex || buildEmptyIndex(owner);
      return {
        ...toRendererState(await enrichIndexRecordWithRuntimePlatformShopIds(indexRecord)),
        localStateAvailable: Boolean(localIndex)
      };
    },

    async getState() {
      const owner = getCurrentOwner();
      const indexRecord = await getIndexForRead(owner);
      return toRendererState(await enrichIndexRecordWithRuntimePlatformShopIds(indexRecord));
    },

    async syncCloudState() {
      const owner = getCurrentOwner();
      let remoteIndex = null;

      try {
        remoteIndex = await loadRemoteIndex(owner, {
          force: true
        });
      } catch (error) {
        throw buildPersistenceError(error, '\u4E91\u7AEF\u5E97\u94FA\u5217\u8868\u540C\u6B65\u5931\u8D25\u3002');
      }

      if (!remoteIndex) {
        const localIndex = await loadLocalIndex(owner);
        const fallbackIndex = localIndex || buildEmptyIndex(owner);

        return {
          state: toRendererState(await enrichIndexRecordWithRuntimePlatformShopIds(fallbackIndex)),
          syncedShopCount: 0,
          failedShopCount: 0,
          usedCloud: false
        };
      }

      let syncedShopCount = 0;
      let failedShopCount = 0;

      for (const shopSummary of remoteIndex.shops) {
        const recordKey = normalizeText(shopSummary && shopSummary.recordKey);

        if (!recordKey) {
          failedShopCount += 1;
          continue;
        }

        try {
          const remoteRecord = await loadRemoteShopRecord(owner, recordKey);

          if (remoteRecord) {
            syncedShopCount += 1;
          } else {
            failedShopCount += 1;
          }
        } catch (_error) {
          failedShopCount += 1;
        }
      }

      return {
        state: toRendererState(await enrichIndexRecordWithRuntimePlatformShopIds(remoteIndex)),
        syncedShopCount,
        failedShopCount,
        usedCloud: true
      };
    },

    async getShopDetail(payload) {
      const owner = getCurrentOwner();
      let shopSummary = await getShopSummary(
        owner,
        payload && payload.shopId,
        '\u8BF7\u5148\u9009\u62E9\u8981\u7F16\u8F91\u7684\u5E97\u94FA\u3002'
      );
      const controller = getShopWindowBrowserControllerSafe();
      const existingPlatformShopId = normalizeText(shopSummary && shopSummary.platformShopId);

      if (!existingPlatformShopId && controller && typeof controller.resolveShopSessionContext === 'function') {
        try {
          const sessionContext = await controller.resolveShopSessionContext({
            shopId: normalizeText(shopSummary && shopSummary.id)
          });
          const resolvedPlatformShopId = extractPlatformShopIdFromSessionContext(sessionContext);
          const resolvedPlatformShopUniqueId = extractPlatformShopUniqueIdFromSessionContext(sessionContext);

          if (resolvedPlatformShopId || resolvedPlatformShopUniqueId) {
            shopSummary = {
              ...shopSummary,
              platformShopId: resolvedPlatformShopId || normalizeText(shopSummary && shopSummary.platformShopId),
              platformShopUniqueId: resolvedPlatformShopUniqueId || normalizeText(shopSummary && shopSummary.platformShopUniqueId)
            };
          }
        } catch (_error) {
          // Ignore runtime resolution failures for edit form preload and fall back to stored data.
        }
      }

      const shopRecordEnvelope = await loadShopRecordEnvelope(owner, shopSummary);
      return toEditableShopDetail(
        shopSummary,
        shopRecordEnvelope,
        await resolveRuntimeFingerprintContextSafe()
      );
    },

    async getShopRuntimeProfile(payload) {
      const owner = getCurrentOwner();
      const shopSummary = await getShopSummaryPreferLocal(
        owner,
        payload && payload.shopId,
        '\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u3002'
      );

      if (isShopParticipating(shopSummary) !== true) {
        throw new Error('\u5F53\u524D\u5E97\u94FA\u5DF2\u5173\u95ED\uFF0C\u8BF7\u5148\u5728\u5E97\u94FA\u7BA1\u7406\u4E2D\u5F00\u542F\u540E\u518D\u7EE7\u7EED\u3002');
      }

      const shopRecordEnvelope = await loadShopRuntimeEnvelope(owner, shopSummary);
      const shopDetail = toEditableShopDetail(
        shopSummary,
        shopRecordEnvelope,
        await resolveRuntimeFingerprintContextSafe()
      );

      return {
        shopId: shopDetail.id,
        platformShopId: shopDetail.platformShopId,
        platformShopUniqueId: shopDetail.platformShopUniqueId,
        phoneNumber: shopDetail.phoneNumber,
        email: shopDetail.email,
        accountValue: shopDetail.accountValue,
        accountType: shopDetail.accountType,
        shopName: shopDetail.shopName,
        loginPassword: shopDetail.loginPassword,
        proxyConfig: {
          ...shopDetail.proxyConfig
        },
        fingerprintConfig: {
          ...shopDetail.fingerprintConfig
        },
        browserStorageAutoSyncEnabled: shopDetail.browserStorageAutoSyncEnabled !== false,
        updatedAt: shopDetail.updatedAt
      };
    },

    async updateResolvedPlatformShopId(payload) {
      const owner = getCurrentOwner();
      const shopId = normalizeText(payload && payload.shopId);
      const platformShopId = normalizeText(payload && payload.platformShopId);
      const platformShopUniqueId = normalizeText(
        payload && (
          payload.platformShopUniqueId
          || payload.mallUniqueId
          || payload.uniqueId
        )
      );

      if (!shopId || (!platformShopId && !platformShopUniqueId)) {
        return {
          updated: false,
          shopId,
          platformShopId,
          platformShopUniqueId
        };
      }

      const currentIndex = await getIndexForWrite(owner);
      const shopSummary = currentIndex.shops.find((shop) => normalizeText(shop && shop.id) === shopId);

      if (!shopSummary) {
        return {
          updated: false,
          shopId,
          platformShopId,
          platformShopUniqueId,
          skippedReason: 'shop-not-found'
        };
      }

      const persisted = await persistResolvedPlatformShopId(
        owner,
        currentIndex,
        shopSummary,
        {
          platformShopId,
          platformShopUniqueId
        }
      );

      return {
        updated: persisted.updated === true,
        shopId,
        platformShopId,
        platformShopUniqueId,
        skippedReason: persisted && persisted.skippedReason ? persisted.skippedReason : ''
      };
    },

    async addGroup(payload) {
      const owner = getCurrentOwner();
      const currentIndex = await getIndexForWrite(owner);
      const groupName = normalizeText(payload && payload.name);

      assertGroupName(currentIndex.groups, groupName);

      const timestamp = nowIso();
      const nextGroup = {
        id: createEntityId('group'),
        name: groupName,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const nextIndex = buildNextIndex(owner, [...currentIndex.groups, nextGroup], currentIndex.shops);

      await persistCloudIndex(owner, nextIndex);
      await persistLocalIndex(owner, nextIndex);

      return {
        group: {
          id: nextGroup.id,
          name: nextGroup.name,
          createdAt: nextGroup.createdAt,
          updatedAt: nextGroup.updatedAt
        },
        state: toRendererState(nextIndex)
      };
    },

    async updateGroup(payload) {
      const owner = getCurrentOwner();
      const currentIndex = await getIndexForWrite(owner);
      const groupId = normalizeText(payload && payload.groupId);
      const groupName = normalizeText(payload && payload.name);
      const currentGroup = currentIndex.groups.find((group) => group.id === groupId);

      if (!groupId) {
        throw new Error('\u8BF7\u5148\u9009\u62E9\u8981\u4FEE\u6539\u7684\u5206\u7EC4\u3002');
      }

      if (!currentGroup) {
        throw new Error('\u5F53\u524D\u5206\u7EC4\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002');
      }

      assertGroupName(currentIndex.groups, groupName, groupId);

      const timestamp = nowIso();
      const nextGroups = currentIndex.groups.map((group) => (
        group.id === groupId
          ? {
            ...group,
            name: groupName,
            updatedAt: timestamp
          }
          : group
      ));
      const nextShopSummaries = [];
      const runtimeFingerprintContext = await resolveRuntimeFingerprintContextSafe();

      for (const shopSummary of currentIndex.shops) {
        if (normalizeText(shopSummary && shopSummary.groupId) !== groupId) {
          nextShopSummaries.push(shopSummary);
          continue;
        }

        const currentShopRecordEnvelope = await loadShopRecordEnvelope(owner, shopSummary);
        const currentShopDetail = toEditableShopDetail(
          shopSummary,
          currentShopRecordEnvelope,
          runtimeFingerprintContext
        );
        const recordKey =
          normalizeText(shopSummary.recordKey)
          || normalizeText(currentShopDetail.recordKey)
          || buildShopRecordKey({
            id: shopSummary.id,
            phoneNumber: shopSummary.accountValue || shopSummary.email || shopSummary.phoneNumber,
            shopName: shopSummary.shopName
          });
        const nextShopDetail = {
          ...currentShopDetail,
          groupId,
          groupName,
          updatedAt: timestamp
        };
        const nextShopSummary = buildShopSummary(nextShopDetail, recordKey);
        const nextShopRecordEnvelope = buildShopRecordEnvelope(owner, nextShopDetail, recordKey, timestamp);

        await persistCloudShopRecord(owner, recordKey, nextShopRecordEnvelope, nextShopSummary);
        await persistLocalShopRecord(owner, recordKey, nextShopRecordEnvelope);
        nextShopSummaries.push(nextShopSummary);
      }

      const nextIndex = buildNextIndex(owner, nextGroups, nextShopSummaries);

      await persistCloudIndex(owner, nextIndex);
      await persistLocalIndex(owner, nextIndex);

      return {
        group: {
          id: groupId,
          name: groupName,
          createdAt: currentGroup.createdAt,
          updatedAt: timestamp
        },
        state: toRendererState(nextIndex)
      };
    },

    async deleteGroup(payload) {
      const owner = getCurrentOwner();
      const currentIndex = await getIndexForWrite(owner);
      const groupId = normalizeText(payload && payload.groupId);
      const currentGroup = currentIndex.groups.find((group) => group.id === groupId);

      if (!groupId) {
        throw new Error('\u8BF7\u5148\u9009\u62E9\u8981\u5220\u9664\u7684\u5206\u7EC4\u3002');
      }

      if (!currentGroup) {
        throw new Error('\u5F53\u524D\u5206\u7EC4\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002');
      }

      const timestamp = nowIso();
      const nextGroups = currentIndex.groups.filter((group) => group.id !== groupId);
      const nextShopSummaries = [];
      const runtimeFingerprintContext = await resolveRuntimeFingerprintContextSafe();

      for (const shopSummary of currentIndex.shops) {
        if (normalizeText(shopSummary && shopSummary.groupId) !== groupId) {
          nextShopSummaries.push(shopSummary);
          continue;
        }

        const currentShopRecordEnvelope = await loadShopRecordEnvelope(owner, shopSummary);
        const currentShopDetail = toEditableShopDetail(
          shopSummary,
          currentShopRecordEnvelope,
          runtimeFingerprintContext
        );
        const recordKey =
          normalizeText(shopSummary.recordKey)
          || normalizeText(currentShopDetail.recordKey)
          || buildShopRecordKey({
            id: shopSummary.id,
            phoneNumber: shopSummary.accountValue || shopSummary.email || shopSummary.phoneNumber,
            shopName: shopSummary.shopName
          });
        const nextShopDetail = {
          ...currentShopDetail,
          groupId: '',
          groupName: FALLBACK_GROUP_NAME,
          updatedAt: timestamp
        };
        const nextShopSummary = buildShopSummary(nextShopDetail, recordKey);
        const nextShopRecordEnvelope = buildShopRecordEnvelope(owner, nextShopDetail, recordKey, timestamp);

        await persistCloudShopRecord(owner, recordKey, nextShopRecordEnvelope, nextShopSummary);
        await persistLocalShopRecord(owner, recordKey, nextShopRecordEnvelope);
        nextShopSummaries.push(nextShopSummary);
      }

      const nextIndex = buildNextIndex(owner, nextGroups, nextShopSummaries);

      await persistCloudIndex(owner, nextIndex);
      await persistLocalIndex(owner, nextIndex);

      return {
        groupId,
        state: toRendererState(nextIndex)
      };
    },

    async setShopVisibility(payload) {
      const owner = getCurrentOwner();
      const currentIndex = await getIndexForWrite(owner);
      const shopId = normalizeText(payload && payload.shopId);
      const currentShopSummary = currentIndex.shops.find((shop) => shop.id === shopId);

      if (!shopId) {
        throw new Error('\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u3002');
      }

      if (!currentShopSummary) {
        throw new Error('\u5F53\u524D\u5E97\u94FA\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002');
      }

      invalidateFingerprintConfigCache(currentShopSummary);

      const currentShopRecordEnvelope = await loadShopRecordEnvelope(owner, currentShopSummary);
      const currentShopDetail = toEditableShopDetail(currentShopSummary, currentShopRecordEnvelope);
      const timestamp = nowIso();
      const isVisible = normalizeVisibleFlag(payload && payload.isVisible, true);
      const recordKey =
        normalizeText(currentShopSummary.recordKey)
        || normalizeText(currentShopDetail.recordKey)
        || buildShopRecordKey({
          id: shopId,
          phoneNumber: currentShopSummary.accountValue || currentShopSummary.email || currentShopSummary.phoneNumber,
          shopName: currentShopSummary.shopName
        });
      const nextShopDetail = {
        ...currentShopDetail,
        isVisible,
        updatedAt: timestamp
      };
      const nextShopSummary = buildShopSummary(nextShopDetail, recordKey);
      const nextShopRecordEnvelope = buildShopRecordEnvelope(owner, nextShopDetail, recordKey, timestamp);
      const nextIndex = buildNextIndex(
        owner,
        currentIndex.groups,
        currentIndex.shops.map((shop) => (shop.id === shopId ? nextShopSummary : shop))
      );

      await persistCloudShopRecord(owner, recordKey, nextShopRecordEnvelope, nextShopSummary);
      await persistCloudIndex(owner, nextIndex);
      await persistLocalShopRecord(owner, recordKey, nextShopRecordEnvelope);
      await persistLocalIndex(owner, nextIndex);
      await refreshShopWindowRuntimeEnvironment({
        shopId,
        shopUpdatedAt: timestamp,
        reason: 'shop-updated'
      });

      return {
        shop: toRendererState({
          groups: [],
          shops: [nextShopSummary]
        }).shops[0],
        state: toRendererState(nextIndex),
        isVisible
      };
    },

    async addShop(payload) {
      const owner = getCurrentOwner();
      const currentIndex = await getIndexForWrite(owner);
      const runtimeFingerprintContext = await resolveRuntimeFingerprintContextSafe();
      const accountIdentity = normalizeShopAccountSource(payload);
      const phoneNumber = accountIdentity.phoneNumber;
      const email = accountIdentity.email;
      const accountValue = accountIdentity.accountValue;
      const platformShopId = payload && Object.prototype.hasOwnProperty.call(payload, 'platformShopId')
        ? normalizeText(payload && payload.platformShopId)
        : '';
      const platformShopUniqueId = payload && Object.prototype.hasOwnProperty.call(payload, 'platformShopUniqueId')
        ? normalizeText(payload && payload.platformShopUniqueId)
        : '';
      const shopName = normalizeText(payload && payload.shopName);
      const loginPassword = normalizeText(payload && payload.loginPassword);
      const note = normalizeText(payload && payload.note);
      const groupId = normalizeText(payload && payload.groupId);
      const isVisible = normalizeVisibleFlag(payload && payload.isVisible, true);
      const browserStorageAutoSyncEnabled = normalizeBrowserStorageAutoSyncEnabled(
        payload && payload.browserStorageAutoSyncEnabled,
        true
      );
      const proxyConfig = buildProxyConfig(payload);
      const fingerprintConfig = buildFingerprintConfig(buildShopFingerprintPayload(payload), {
        phoneNumber: accountValue,
        shopName
      }, runtimeFingerprintContext);
      const selectedGroup = findSelectedGroup(currentIndex.groups, groupId);

      assertShopPayload(accountValue, shopName, loginPassword, groupId, selectedGroup);

      ensureUniqueShop(currentIndex.shops, accountValue, shopName);
      ensureUniquePlatformShopId(currentIndex.shops, platformShopId);

      const proxyCheck = await validateProxyAvailability(proxyConfig);
      const timestamp = nowIso();
      const shopId = createEntityId('shop');
      const groupName = selectedGroup ? selectedGroup.name : FALLBACK_GROUP_NAME;
      const shopDetail = {
        id: shopId,
        platformShopId,
        platformShopUniqueId,
        phoneNumber,
        email,
        accountValue,
        accountType: accountIdentity.accountType,
        shopName,
        loginPassword,
        note,
        groupId: selectedGroup ? selectedGroup.id : '',
        groupName,
        proxyConfig,
        fingerprintConfig,
        isVisible,
        browserStorageAutoSyncEnabled,
        status: DEFAULT_STATUS,
        proxyVerifiedAt: proxyCheck.checkedAt,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const recordKey = buildShopRecordKey(shopDetail);
      const shopSummary = buildShopSummary(shopDetail, recordKey);
      const recordEnvelope = buildShopRecordEnvelope(owner, shopDetail, recordKey, timestamp);
      const nextIndex = buildNextIndex(owner, currentIndex.groups, [...currentIndex.shops, shopSummary]);

      await persistCloudShopRecord(owner, recordKey, recordEnvelope, shopSummary);
      await persistCloudIndex(owner, nextIndex);
      await persistLocalShopRecord(owner, recordKey, recordEnvelope);
      await persistLocalIndex(owner, nextIndex);

      return {
        shop: toRendererState({
          groups: [],
          shops: [shopSummary]
        }).shops[0],
        state: toRendererState(nextIndex),
        proxyCheck
      };
    },

    async updateShop(payload) {
      const owner = getCurrentOwner();
      const currentIndex = await getIndexForWrite(owner);
      const runtimeFingerprintContext = await resolveRuntimeFingerprintContextSafe();
      const shopId = normalizeText(payload && payload.shopId);
      const currentShopSummary = currentIndex.shops.find((shop) => shop.id === shopId);

      if (!shopId) {
        throw new Error('\u8BF7\u5148\u9009\u62E9\u8981\u7F16\u8F91\u7684\u5E97\u94FA\u3002');
      }

      if (!currentShopSummary) {
        throw new Error('\u5F53\u524D\u5E97\u94FA\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002');
      }

      invalidateFingerprintConfigCache(currentShopSummary);

      const currentShopRecordEnvelope = await loadShopRecordEnvelope(owner, currentShopSummary);
      const currentShopDetail = toEditableShopDetail(
        currentShopSummary,
        currentShopRecordEnvelope,
        runtimeFingerprintContext
      );
      const currentAccountIdentity = resolveAccountIdentity(currentShopDetail);
      const accountIdentity = normalizeShopAccountSource(payload, currentShopDetail);
      const phoneNumber = accountIdentity.phoneNumber;
      const email = accountIdentity.email;
      const accountValue = accountIdentity.accountValue || currentAccountIdentity.accountValue;
      const platformShopId = payload && Object.prototype.hasOwnProperty.call(payload, 'platformShopId')
        ? normalizeText(payload && payload.platformShopId)
        : normalizeText(currentShopDetail && currentShopDetail.platformShopId);
      const platformShopUniqueId = payload && Object.prototype.hasOwnProperty.call(payload, 'platformShopUniqueId')
        ? normalizeText(payload && payload.platformShopUniqueId)
        : normalizeText(currentShopDetail && currentShopDetail.platformShopUniqueId);
      const shopName = normalizeText(payload && payload.shopName);
      const loginPassword = normalizeText(payload && payload.loginPassword);
      const note = normalizeText(payload && payload.note);
      const groupId = normalizeText(payload && payload.groupId);
      const isVisible = normalizeVisibleFlag(
        payload && payload.isVisible,
        isShopParticipating(currentShopDetail)
      );
      const browserStorageAutoSyncEnabled = normalizeBrowserStorageAutoSyncEnabled(
        payload && payload.browserStorageAutoSyncEnabled,
        currentShopDetail.browserStorageAutoSyncEnabled !== false
      );
      const selectedGroup = findSelectedGroup(currentIndex.groups, groupId);
      const proxyConfig = buildProxyConfig(payload);
      const fingerprintConfig = buildFingerprintConfig(
        buildShopFingerprintPayload(payload, currentShopDetail.fingerprintConfig),
        {
          shopId,
          phoneNumber: accountValue,
          shopName
        },
        runtimeFingerprintContext
      );

      assertShopPayload(accountValue, shopName, loginPassword, groupId, selectedGroup);
      ensureUniqueShop(currentIndex.shops, accountValue, shopName, shopId);
      ensureUniquePlatformShopId(currentIndex.shops, platformShopId, shopId);

      const proxyCheck = await validateProxyAvailability(proxyConfig);
      const timestamp = nowIso();
      const groupName = selectedGroup ? selectedGroup.name : FALLBACK_GROUP_NAME;
      const recordKey =
        normalizeText(currentShopSummary.recordKey)
        || normalizeText(currentShopDetail.recordKey)
        || buildShopRecordKey({
          id: shopId,
          phoneNumber: currentShopSummary.accountValue || currentShopSummary.email || currentShopSummary.phoneNumber,
          shopName: currentShopSummary.shopName
        });
      const nextShopDetail = {
        id: shopId,
        platformShopId,
        platformShopUniqueId,
        phoneNumber,
        email,
        accountValue,
        accountType: accountIdentity.accountType || currentShopDetail.accountType || currentShopSummary.accountType || '',
        shopName,
        loginPassword,
        note,
        groupId: selectedGroup ? selectedGroup.id : '',
        groupName,
        proxyConfig,
        fingerprintConfig,
        isVisible,
        browserStorageAutoSyncEnabled,
        status: currentShopDetail.status || currentShopSummary.status || DEFAULT_STATUS,
        proxyVerifiedAt: proxyCheck.checkedAt,
        createdAt: currentShopDetail.createdAt || currentShopSummary.createdAt || timestamp,
        updatedAt: timestamp
      };
      const nextShopSummary = buildShopSummary(nextShopDetail, recordKey);
      const nextShopRecordEnvelope = buildShopRecordEnvelope(owner, nextShopDetail, recordKey, timestamp);
      const nextIndex = buildNextIndex(
        owner,
        currentIndex.groups,
        currentIndex.shops.map((shop) => (shop.id === shopId ? nextShopSummary : shop))
      );

      await persistCloudShopRecord(owner, recordKey, nextShopRecordEnvelope, nextShopSummary);
      await persistCloudIndex(owner, nextIndex);
      await persistLocalShopRecord(owner, recordKey, nextShopRecordEnvelope);
      await persistLocalIndex(owner, nextIndex);

      return {
        shop: toRendererState({
          groups: [],
          shops: [nextShopSummary]
        }).shops[0],
        state: toRendererState(nextIndex),
        proxyCheck
      };
    }
  };
}

module.exports = {
  createShopManagementService
};
