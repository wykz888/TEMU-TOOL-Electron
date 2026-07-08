const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, session } = require('electron');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');
const { getScopedDataRoot } = require('../../utils/persistenceRoots');
const {
  buildLocalStorageExportScript,
  buildLocalStorageImportScript,
  buildIndexedDbExportScript,
  buildIndexedDbImportScript
} = require('../../windows/browserStorageSyncScripts');

const STORAGE_TYPES = Object.freeze({
  cookies: 'cookies',
  localStorage: 'localStorage',
  indexedDb: 'indexedDb'
});

const STORAGE_TYPE_ORDER = Object.freeze([
  STORAGE_TYPES.cookies,
  STORAGE_TYPES.localStorage,
  STORAGE_TYPES.indexedDb
]);

const TYPE_DIRECTORY_NAMES = Object.freeze({
  [STORAGE_TYPES.cookies]: 'cookies',
  [STORAGE_TYPES.localStorage]: 'local_storage',
  [STORAGE_TYPES.indexedDb]: 'indexed_db'
});

const DEFAULT_MANAGED_ORIGINS = Object.freeze([
  'https://seller.kuajingmaihuo.com',
  'https://agentseller.temu.com',
  'https://ads.temu.com',
  'https://seller.temu.com'
]);

const STORAGE_SYNC_ROOT_KEY = 'shop_window/browser_storage_sync';
const SNAPSHOT_VERSION = 1;
const STORAGE_PAGE_LOAD_TIMEOUT_MS = 30000;

function createShopWindowBrowserStorageSyncService({
  app,
  sessionStore,
  shopManagementService,
  getShopWindowBrowserController,
  runtimeLogger
}) {
  function log(eventName, payload) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function getCurrentOwner() {
    return buildOwnerDescriptor(sessionStore.getSession());
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  function normalizeTypeList(typeList) {
    const normalizedTypes = Array.isArray(typeList) ? typeList : [];
    const selectedTypes = normalizedTypes
      .map((typeId) => normalizeText(typeId))
      .filter((typeId) => STORAGE_TYPE_ORDER.includes(typeId));

    if (selectedTypes.length > 0) {
      return Array.from(new Set(selectedTypes));
    }

    return STORAGE_TYPE_ORDER.slice();
  }

  function normalizeOrigin(value) {
    const rawValue = normalizeText(value);

    if (!rawValue) {
      return '';
    }

    try {
      return new URL(rawValue).origin;
    } catch (_error) {
      return '';
    }
  }

  function buildManagedOrigins(payloadOrigins, sessionContext) {
    const requestedOrigins = Array.isArray(payloadOrigins)
      ? payloadOrigins.map((origin) => normalizeOrigin(origin)).filter(Boolean)
      : [];
    const defaultOrigins = DEFAULT_MANAGED_ORIGINS
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean);
    const sessionOrigin = normalizeOrigin(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.origin
    );

    if (sessionOrigin) {
      defaultOrigins.push(sessionOrigin);
    }

    return Array.from(new Set(
      (requestedOrigins.length > 0 ? requestedOrigins : defaultOrigins)
        .filter(Boolean)
    )).sort((left, right) => left.localeCompare(right));
  }

  function hashText(value) {
    return crypto
      .createHash('sha256')
      .update(normalizeText(value))
      .digest('hex');
  }

  function buildOriginFileStem(origin) {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!normalizedOrigin) {
      return `origin_${hashText('origin').slice(0, 12)}`;
    }

    let hostname = '';

    try {
      hostname = new URL(normalizedOrigin).hostname;
    } catch (_error) {
      hostname = '';
    }

    const safeHostname = hostname
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'origin';

    return `${safeHostname}_${hashText(normalizedOrigin).slice(0, 12)}`;
  }

  function getLocalRootDir(owner, shopId) {
    return path.join(
      getScopedDataRoot(app),
      'shop_window',
      'browser_storage_sync',
      'users',
      owner.userKey,
      'state',
      'shops',
      normalizeText(shopId)
    );
  }

  function getSummaryPaths(owner, shopId) {
    const normalizedShopId = normalizeText(shopId);

    return {
      localFilePath: path.join(getLocalRootDir(owner, normalizedShopId), 'summary.json'),
      cloudKey: `${STORAGE_SYNC_ROOT_KEY}/users/${owner.userKey}/state/shops/${normalizedShopId}/summary.json`
    };
  }

  function getSnapshotPaths(owner, shopId, typeId, origin) {
    const normalizedShopId = normalizeText(shopId);
    const normalizedTypeId = normalizeText(typeId);
    const normalizedOrigin = normalizeOrigin(origin);
    const directoryName = TYPE_DIRECTORY_NAMES[normalizedTypeId];

    if (!directoryName) {
      throw new Error('unsupported-storage-type');
    }

    const fileName = `${buildOriginFileStem(normalizedOrigin)}.json`;

    return {
      localFilePath: path.join(getLocalRootDir(owner, normalizedShopId), directoryName, fileName),
      cloudKey: `${STORAGE_SYNC_ROOT_KEY}/users/${owner.userKey}/state/shops/${normalizedShopId}/${directoryName}/${fileName}`
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

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, filePath);
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

  function writeCloudJson(key, payload, metadata = {}) {
    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key,
      data: payload,
      metadata
    });
  }

  function createEmptySummary(shopId = '') {
    return {
      version: SNAPSHOT_VERSION,
      shopId: normalizeText(shopId),
      updatedAt: '',
      origins: [],
      types: STORAGE_TYPE_ORDER.reduce((result, typeId) => {
        result[typeId] = {
          updatedAt: '',
          origins: {}
        };
        return result;
      }, {})
    };
  }

  function normalizeSummary(shopId, payload) {
    const normalizedShopId = normalizeText(shopId);
    const source = payload && typeof payload === 'object' ? payload : {};
    const normalizedSummary = createEmptySummary(normalizedShopId);
    const normalizedOrigins = Array.isArray(source.origins)
      ? source.origins.map((origin) => normalizeOrigin(origin)).filter(Boolean)
      : [];

    normalizedSummary.updatedAt = normalizeText(source.updatedAt);
    normalizedSummary.origins = Array.from(new Set(normalizedOrigins)).sort((left, right) => left.localeCompare(right));

    STORAGE_TYPE_ORDER.forEach((typeId) => {
      const typeSource = source.types && source.types[typeId] && typeof source.types[typeId] === 'object'
        ? source.types[typeId]
        : {};
      const normalizedTypeOrigins = {};

      Object.entries(typeSource.origins || {}).forEach(([origin, value]) => {
        const normalizedOrigin = normalizeOrigin(origin);

        if (!normalizedOrigin) {
          return;
        }

        const entrySource = value && typeof value === 'object' ? value : {};

        normalizedTypeOrigins[normalizedOrigin] = {
          updatedAt: normalizeText(entrySource.updatedAt),
          cloudKey: normalizeText(entrySource.cloudKey),
          itemCount: Math.max(0, Number(entrySource.itemCount) || 0),
          databaseCount: Math.max(0, Number(entrySource.databaseCount) || 0),
          objectStoreCount: Math.max(0, Number(entrySource.objectStoreCount) || 0),
          recordCount: Math.max(0, Number(entrySource.recordCount) || 0)
        };
      });

      normalizedSummary.types[typeId] = {
        updatedAt: normalizeText(typeSource.updatedAt),
        origins: normalizedTypeOrigins
      };
    });

    return normalizedSummary;
  }

  function buildSummaryEntry(typeId, updatedAt, cloudKey, snapshot) {
    if (typeId === STORAGE_TYPES.cookies) {
      return {
        updatedAt,
        cloudKey,
        itemCount: Math.max(0, Number(snapshot && snapshot.cookieCount) || 0),
        databaseCount: 0,
        objectStoreCount: 0,
        recordCount: 0
      };
    }

    if (typeId === STORAGE_TYPES.localStorage) {
      return {
        updatedAt,
        cloudKey,
        itemCount: Math.max(0, Number(snapshot && snapshot.itemCount) || 0),
        databaseCount: 0,
        objectStoreCount: 0,
        recordCount: 0
      };
    }

    return {
      updatedAt,
      cloudKey,
      itemCount: 0,
      databaseCount: Math.max(0, Number(snapshot && snapshot.databaseCount) || 0),
      objectStoreCount: Math.max(0, Number(snapshot && snapshot.objectStoreCount) || 0),
      recordCount: Math.max(0, Number(snapshot && snapshot.recordCount) || 0)
    };
  }

  function applySummaryEntry(summary, typeId, origin, snapshot, cloudKey, updatedAt) {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!normalizedOrigin) {
      return;
    }

    summary.updatedAt = updatedAt;
    summary.types[typeId].updatedAt = updatedAt;
    summary.types[typeId].origins[normalizedOrigin] = buildSummaryEntry(
      typeId,
      updatedAt,
      cloudKey,
      snapshot
    );
    summary.origins = Array.from(new Set([
      ...summary.origins,
      normalizedOrigin
    ])).sort((left, right) => left.localeCompare(right));
  }

  function buildPublicSummary(summary) {
    if (!summary) {
      return null;
    }

    const normalizedSummary = normalizeSummary(summary.shopId, summary);
    const types = {};

    STORAGE_TYPE_ORDER.forEach((typeId) => {
      const originEntries = normalizedSummary.types[typeId].origins;
      const entries = Object.values(originEntries);

      types[typeId] = {
        updatedAt: normalizedSummary.types[typeId].updatedAt,
        originCount: Object.keys(originEntries).length,
        itemCount: entries.reduce((count, entry) => count + Math.max(0, Number(entry.itemCount) || 0), 0),
        databaseCount: entries.reduce((count, entry) => count + Math.max(0, Number(entry.databaseCount) || 0), 0),
        objectStoreCount: entries.reduce((count, entry) => count + Math.max(0, Number(entry.objectStoreCount) || 0), 0),
        recordCount: entries.reduce((count, entry) => count + Math.max(0, Number(entry.recordCount) || 0), 0)
      };
    });

    return {
      shopId: normalizedSummary.shopId,
      updatedAt: normalizedSummary.updatedAt,
      originCount: normalizedSummary.origins.length,
      origins: normalizedSummary.origins.slice(),
      types
    };
  }

  function normalizeCookieSnapshot(shopId, origin, payload, updatedAt) {
    const normalizedOrigin = normalizeOrigin(origin);
    const cookies = Array.isArray(payload && payload.cookies)
      ? payload.cookies
        .map((cookie) => ({
          name: normalizeText(cookie && cookie.name),
          value: cookie && cookie.value != null ? String(cookie.value) : '',
          domain: normalizeText(cookie && cookie.domain),
          path: normalizeText(cookie && cookie.path) || '/',
          secure: cookie && cookie.secure === true,
          httpOnly: cookie && cookie.httpOnly === true,
          session: cookie && cookie.session === true,
          expirationDate: Number(cookie && cookie.expirationDate) || 0,
          sameSite: normalizeText(cookie && cookie.sameSite),
          hostOnly: cookie && cookie.hostOnly === true
        }))
        .filter((cookie) => cookie.name)
        .sort((left, right) => (
          `${left.domain}|${left.path}|${left.name}`.localeCompare(`${right.domain}|${right.path}|${right.name}`)
        ))
      : [];

    return {
      version: SNAPSHOT_VERSION,
      type: STORAGE_TYPES.cookies,
      shopId: normalizeText(shopId),
      origin: normalizedOrigin,
      updatedAt,
      cookieCount: cookies.length,
      cookies
    };
  }

  function normalizeLocalStorageSnapshot(shopId, origin, payload, updatedAt) {
    const normalizedOrigin = normalizeOrigin(origin);
    const items = Array.isArray(payload && payload.items)
      ? payload.items
        .map((item) => ({
          key: normalizeText(item && item.key),
          value: item && item.value != null ? String(item.value) : ''
        }))
        .filter((item) => item.key)
        .sort((left, right) => left.key.localeCompare(right.key))
      : [];

    return {
      version: SNAPSHOT_VERSION,
      type: STORAGE_TYPES.localStorage,
      shopId: normalizeText(shopId),
      origin: normalizedOrigin,
      updatedAt,
      itemCount: items.length,
      items
    };
  }

  function normalizeIndexedDbSnapshot(shopId, origin, payload, updatedAt) {
    const normalizedOrigin = normalizeOrigin(origin);
    const databases = Array.isArray(payload && payload.databases)
      ? payload.databases
        .map((database) => {
          const stores = Array.isArray(database && database.stores)
            ? database.stores
              .map((store) => {
                const records = Array.isArray(store && store.records) ? store.records.slice() : [];
                const indexes = Array.isArray(store && store.indexes)
                  ? store.indexes.map((index) => ({
                    name: normalizeText(index && index.name),
                    keyPath: index && Object.prototype.hasOwnProperty.call(index, 'keyPath') ? index.keyPath : null,
                    unique: index && index.unique === true,
                    multiEntry: index && index.multiEntry === true
                  })).filter((index) => index.name)
                  : [];

                return {
                  name: normalizeText(store && store.name),
                  keyPath: store && Object.prototype.hasOwnProperty.call(store, 'keyPath') ? store.keyPath : null,
                  autoIncrement: store && store.autoIncrement === true,
                  indexes,
                  recordCount: records.length,
                  records
                };
              })
              .filter((store) => store.name)
              .sort((left, right) => left.name.localeCompare(right.name))
            : [];

          return {
            name: normalizeText(database && database.name),
            version: Math.max(1, Number(database && database.version) || 1),
            stores
          };
        })
        .filter((database) => database.name)
        .sort((left, right) => left.name.localeCompare(right.name))
      : [];

    return {
      version: SNAPSHOT_VERSION,
      type: STORAGE_TYPES.indexedDb,
      shopId: normalizeText(shopId),
      origin: normalizedOrigin,
      updatedAt,
      supported: payload && payload.supported !== false,
      databaseCount: databases.length,
      objectStoreCount: databases.reduce((count, database) => count + database.stores.length, 0),
      recordCount: databases.reduce((count, database) => (
        count + database.stores.reduce((storeCount, store) => storeCount + store.records.length, 0)
      ), 0),
      databases
    };
  }

  function buildSnapshotMetadata(owner, shopId, typeId, origin) {
    return {
      record_type: 'shop-browser-storage-sync',
      owner_user_key: owner.userKey,
      owner_username: owner.username,
      shop_id: normalizeText(shopId),
      storage_type: normalizeText(typeId),
      origin: normalizeOrigin(origin)
    };
  }

  async function readSummaryPair(owner, shopId, options = {}) {
    const { localFilePath, cloudKey } = getSummaryPaths(owner, shopId);
    const localSummary = await readJsonFile(localFilePath).catch(() => null);
    let cloudSummary = null;

    if (!localSummary || (options && options.forceCloud === true)) {
      cloudSummary = await readCloudJson(cloudKey).catch((error) => {
        logError('shop_browser_storage_sync_summary_cloud_read_failed', error, {
          shopId: normalizeText(shopId),
          cloudKey
        });
        return null;
      });
    }

    return {
      localSummary: localSummary ? normalizeSummary(shopId, localSummary) : null,
      cloudSummary: cloudSummary ? normalizeSummary(shopId, cloudSummary) : null
    };
  }

  async function writeSummaryPair(owner, shopId, summary) {
    const normalizedSummary = normalizeSummary(shopId, summary);
    const { localFilePath, cloudKey } = getSummaryPaths(owner, shopId);

    await writeJsonFile(localFilePath, normalizedSummary);
    await writeCloudJson(
      cloudKey,
      normalizedSummary,
      buildSnapshotMetadata(owner, shopId, 'summary', '')
    );

    return normalizedSummary;
  }

  async function resolveSyncContext(payload = {}) {
    const owner = getCurrentOwner();
    const shopId = normalizeText(payload && payload.shopId);
    const controller = getController();

    if (!shopId) {
      throw new Error('\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u3002');
    }

    if (!controller || typeof controller.resolveShopSessionContext !== 'function') {
      throw new Error('\u5E97\u94FA\u6D4F\u89C8\u5668\u4E0A\u4E0B\u6587\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002');
    }

    const sessionContext = await controller.resolveShopSessionContext({
      shopId,
      forceRefreshRuntimeProfile: true
    });
    const partition = normalizeText(sessionContext && sessionContext.partition);

    if (!partition) {
      throw new Error('\u672A\u80FD\u83B7\u53D6\u5F53\u524D\u5E97\u94FA\u7684\u6D4F\u89C8\u5668\u5206\u533A\u3002');
    }

    return {
      owner,
      shopId,
      sessionContext,
      partition,
      controller
    };
  }

  async function resolveRuntimeProfile(shopId) {
    if (!shopManagementService || typeof shopManagementService.getShopRuntimeProfile !== 'function') {
      return null;
    }

    try {
      return await shopManagementService.getShopRuntimeProfile({
        shopId
      });
    } catch (error) {
      logError('shop_browser_storage_sync_runtime_profile_load_failed', error, {
        shopId: normalizeText(shopId)
      });
      return null;
    }
  }

  function attachProxyAuthHandler(targetWindow, proxyConfig) {
    if (!targetWindow || !targetWindow.webContents || !proxyConfig) {
      return;
    }

    targetWindow.webContents.on('login', (event, _request, authInfo, callback) => {
      if (!authInfo || authInfo.isProxy !== true) {
        return;
      }

      const username = normalizeText(proxyConfig && proxyConfig.username);
      const password = normalizeText(proxyConfig && proxyConfig.password);

      if (!username && !password) {
        return;
      }

      event.preventDefault();
      callback(username, password);
    });
  }

  function buildOriginCandidateUrls(origin) {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!normalizedOrigin) {
      return [];
    }

    return [
      `${normalizedOrigin}/robots.txt?__temu_toolbox_storage_sync__=${Date.now().toString(36)}`,
      `${normalizedOrigin}/`
    ];
  }

  async function loadUrlWithTimeout(targetWindow, targetUrl, timeoutMs = STORAGE_PAGE_LOAD_TIMEOUT_MS) {
    let timer = 0;

    try {
      await Promise.race([
        targetWindow.loadURL(targetUrl),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error('storage-page-load-timeout'));
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async function ensureOriginLoaded(targetWindow, origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    const candidateUrls = buildOriginCandidateUrls(normalizedOrigin);
    let lastError = null;

    for (const candidateUrl of candidateUrls) {
      try {
        await loadUrlWithTimeout(targetWindow, candidateUrl);
        const currentOrigin = normalizeOrigin(targetWindow.webContents.getURL());

        if (currentOrigin === normalizedOrigin) {
          return {
            requestedOrigin: normalizedOrigin,
            currentUrl: normalizeText(targetWindow.webContents.getURL())
          };
        }

        lastError = new Error('storage-origin-mismatch');
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('storage-origin-load-failed');
  }

  async function withHiddenStorageWindow(partition, proxyConfig, task) {
    const hiddenWindow = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      frame: false,
      skipTaskbar: true,
      paintWhenInitiallyHidden: false,
      webPreferences: {
        partition,
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    attachProxyAuthHandler(hiddenWindow, proxyConfig);

    try {
      return await task(hiddenWindow);
    } finally {
      try {
        await hiddenWindow.loadURL('about:blank');
      } catch (_error) {
        // Ignore cleanup load failures.
      }

      if (!hiddenWindow.isDestroyed()) {
        hiddenWindow.destroy();
      }
    }
  }

  async function captureCookieSnapshot(partition, shopId, origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    const targetSession = session.fromPartition(partition);
    const cookies = await targetSession.cookies.get({
      url: normalizedOrigin
    });

    return normalizeCookieSnapshot(shopId, normalizedOrigin, {
      cookies
    }, nowIso());
  }

  function buildCookieUrl(cookie, fallbackOrigin) {
    const normalizedOrigin = normalizeOrigin(fallbackOrigin);

    try {
      const fallbackUrl = new URL(normalizedOrigin);
      const protocol = cookie && cookie.secure === true ? 'https:' : 'http:';
      const hostname = normalizeText(cookie && cookie.domain).replace(/^\./, '') || fallbackUrl.hostname;
      const pathName = normalizeText(cookie && cookie.path) || '/';

      return `${protocol}//${hostname}${pathName.startsWith('/') ? pathName : `/${pathName}`}`;
    } catch (_error) {
      return normalizedOrigin;
    }
  }

  async function applyCookieSnapshot(partition, origin, snapshot) {
    const normalizedOrigin = normalizeOrigin(origin);
    const targetSession = session.fromPartition(partition);
    const existingCookies = await targetSession.cookies.get({
      url: normalizedOrigin
    });

    for (const cookie of existingCookies) {
      const cookieUrl = buildCookieUrl(cookie, normalizedOrigin);

      try {
        await targetSession.cookies.remove(cookieUrl, cookie.name);
      } catch (_error) {
        // Ignore per-cookie remove failures and continue with restore.
      }
    }

    const cookies = Array.isArray(snapshot && snapshot.cookies) ? snapshot.cookies : [];

    for (const cookie of cookies) {
      const url = buildCookieUrl(cookie, normalizedOrigin);
      const details = {
        url,
        name: normalizeText(cookie && cookie.name),
        value: cookie && cookie.value != null ? String(cookie.value) : '',
        path: normalizeText(cookie && cookie.path) || '/',
        secure: cookie && cookie.secure === true,
        httpOnly: cookie && cookie.httpOnly === true
      };

      if (!details.name) {
        continue;
      }

      if (normalizeText(cookie && cookie.domain)) {
        details.domain = normalizeText(cookie && cookie.domain);
      }

      if (Number(cookie && cookie.expirationDate) > 0) {
        details.expirationDate = Number(cookie && cookie.expirationDate);
      }

      if (normalizeText(cookie && cookie.sameSite)) {
        details.sameSite = normalizeText(cookie && cookie.sameSite);
      }

      await targetSession.cookies.set(details);
    }

    return {
      origin: normalizedOrigin,
      itemCount: cookies.length
    };
  }

  async function captureOriginStorageSnapshots(partition, proxyConfig, shopId, origins, selectedTypes) {
    const failures = [];
    const snapshotsByType = {
      [STORAGE_TYPES.localStorage]: new Map(),
      [STORAGE_TYPES.indexedDb]: new Map()
    };
    const needsWindow = (
      selectedTypes.includes(STORAGE_TYPES.localStorage)
      || selectedTypes.includes(STORAGE_TYPES.indexedDb)
    );

    if (!needsWindow) {
      return {
        failures,
        snapshotsByType
      };
    }

    await withHiddenStorageWindow(partition, proxyConfig, async (hiddenWindow) => {
      for (const origin of origins) {
        try {
          await ensureOriginLoaded(hiddenWindow, origin);
        } catch (error) {
          selectedTypes
            .filter((typeId) => typeId !== STORAGE_TYPES.cookies)
            .forEach((typeId) => {
              failures.push({
                type: typeId,
                origin,
                message: normalizeText(error && error.message) || 'origin-load-failed'
              });
            });
          continue;
        }

        if (selectedTypes.includes(STORAGE_TYPES.localStorage)) {
          try {
            const payload = await hiddenWindow.webContents.executeJavaScript(
              buildLocalStorageExportScript(),
              true
            );

            snapshotsByType[STORAGE_TYPES.localStorage].set(
              origin,
              normalizeLocalStorageSnapshot(shopId, origin, payload, nowIso())
            );
          } catch (error) {
            failures.push({
              type: STORAGE_TYPES.localStorage,
              origin,
              message: normalizeText(error && error.message) || 'local-storage-export-failed'
            });
          }
        }

        if (selectedTypes.includes(STORAGE_TYPES.indexedDb)) {
          try {
            const payload = await hiddenWindow.webContents.executeJavaScript(
              buildIndexedDbExportScript(),
              true
            );

            snapshotsByType[STORAGE_TYPES.indexedDb].set(
              origin,
              normalizeIndexedDbSnapshot(shopId, origin, payload, nowIso())
            );
          } catch (error) {
            failures.push({
              type: STORAGE_TYPES.indexedDb,
              origin,
              message: normalizeText(error && error.message) || 'indexeddb-export-failed'
            });
          }
        }
      }
    });

    return {
      failures,
      snapshotsByType
    };
  }

  async function applyOriginStorageSnapshots(partition, proxyConfig, origins, selectedTypes, snapshotsByType) {
    const failures = [];
    const resultsByType = {
      [STORAGE_TYPES.localStorage]: new Map(),
      [STORAGE_TYPES.indexedDb]: new Map()
    };
    const needsWindow = (
      selectedTypes.includes(STORAGE_TYPES.localStorage)
      || selectedTypes.includes(STORAGE_TYPES.indexedDb)
    );
    const hasSnapshotPayloads = origins.some((origin) => (
      snapshotsByType[STORAGE_TYPES.localStorage].has(origin)
      || snapshotsByType[STORAGE_TYPES.indexedDb].has(origin)
    ));

    if (!needsWindow || !hasSnapshotPayloads) {
      return {
        failures,
        resultsByType
      };
    }

    await withHiddenStorageWindow(partition, proxyConfig, async (hiddenWindow) => {
      for (const origin of origins) {
        const hasLocalStorageSnapshot = snapshotsByType[STORAGE_TYPES.localStorage].has(origin);
        const hasIndexedDbSnapshot = snapshotsByType[STORAGE_TYPES.indexedDb].has(origin);

        if (!hasLocalStorageSnapshot && !hasIndexedDbSnapshot) {
          continue;
        }

        try {
          await ensureOriginLoaded(hiddenWindow, origin);
        } catch (error) {
          if (hasLocalStorageSnapshot) {
            failures.push({
              type: STORAGE_TYPES.localStorage,
              origin,
              message: normalizeText(error && error.message) || 'origin-load-failed'
            });
          }

          if (hasIndexedDbSnapshot) {
            failures.push({
              type: STORAGE_TYPES.indexedDb,
              origin,
              message: normalizeText(error && error.message) || 'origin-load-failed'
            });
          }
          continue;
        }

        if (hasLocalStorageSnapshot) {
          try {
            const snapshot = snapshotsByType[STORAGE_TYPES.localStorage].get(origin);
            const payload = await hiddenWindow.webContents.executeJavaScript(
              buildLocalStorageImportScript(snapshot),
              true
            );

            resultsByType[STORAGE_TYPES.localStorage].set(origin, {
              origin,
              itemCount: Math.max(0, Number(payload && payload.itemCount) || 0)
            });
          } catch (error) {
            failures.push({
              type: STORAGE_TYPES.localStorage,
              origin,
              message: normalizeText(error && error.message) || 'local-storage-import-failed'
            });
          }
        }

        if (hasIndexedDbSnapshot) {
          try {
            const snapshot = snapshotsByType[STORAGE_TYPES.indexedDb].get(origin);
            const payload = await hiddenWindow.webContents.executeJavaScript(
              buildIndexedDbImportScript(snapshot),
              true
            );

            resultsByType[STORAGE_TYPES.indexedDb].set(origin, {
              origin,
              databaseCount: Math.max(0, Number(payload && payload.databaseCount) || 0),
              objectStoreCount: Math.max(0, Number(payload && payload.objectStoreCount) || 0),
              recordCount: Math.max(0, Number(payload && payload.recordCount) || 0)
            });
          } catch (error) {
            failures.push({
              type: STORAGE_TYPES.indexedDb,
              origin,
              message: normalizeText(error && error.message) || 'indexeddb-import-failed'
            });
          }
        }
      }
    });

    return {
      failures,
      resultsByType
    };
  }

  async function reloadActiveShopView(controller, shopId, options = {}) {
    if (!(options && options.enabled === true)) {
      return false;
    }

    if (!controller || typeof controller.getActiveDescriptor !== 'function') {
      return false;
    }

    const activeDescriptor = controller.getActiveDescriptor();

    if (!activeDescriptor || normalizeText(activeDescriptor.shopId) !== normalizeText(shopId)) {
      return false;
    }

    if (typeof controller.reloadActiveContents !== 'function') {
      return false;
    }

    return controller.reloadActiveContents() === true;
  }

  function isSellerSessionOnline(sessionContext) {
    const sellerSession = sessionContext && sessionContext.sellerSession;
    const status = normalizeText(sellerSession && sellerSession.status).toLowerCase();
    const mallId = normalizeText(sellerSession && sellerSession.mallId);
    const mallName = normalizeText(sellerSession && sellerSession.mallName);
    const mallNames = Array.isArray(sellerSession && sellerSession.mallNames)
      ? sellerSession.mallNames.map((item) => normalizeText(item)).filter(Boolean)
      : [];

    return status === 'online' && Boolean(mallId || mallName || mallNames.length > 0);
  }

  function hasLikelyAuthCookiesForOrigin(cookies) {
    const normalizedNames = new Set(
      (Array.isArray(cookies) ? cookies : [])
        .map((cookie) => normalizeText(cookie && cookie.name).toLowerCase())
        .filter(Boolean)
    );

    if (!normalizedNames.size) {
      return false;
    }

    if (
      normalizedNames.has('mallid')
      || normalizedNames.has('seller_temp')
      || normalizedNames.has('api_uid')
      || normalizedNames.has('api_ticket')
    ) {
      return true;
    }

    return normalizedNames.has('_nano_fp') && normalizedNames.size >= 3;
  }

  async function hasLiveAuthCookies(partition, origins = []) {
    const normalizedPartition = normalizeText(partition);
    const targetOrigins = Array.isArray(origins)
      ? origins.map((origin) => normalizeOrigin(origin)).filter(Boolean)
      : [];

    if (!normalizedPartition || targetOrigins.length <= 0) {
      return {
        online: false,
        matchedOrigin: '',
        cookieCount: 0
      };
    }

    const targetSession = session.fromPartition(normalizedPartition);

    for (const origin of targetOrigins) {
      try {
        const cookies = await targetSession.cookies.get({
          url: origin
        });

        if (hasLikelyAuthCookiesForOrigin(cookies)) {
          return {
            online: true,
            matchedOrigin: origin,
            cookieCount: Array.isArray(cookies) ? cookies.length : 0
          };
        }
      } catch (error) {
        logError('shop_browser_storage_sync_live_cookie_probe_failed', error, {
          partition: normalizedPartition,
          origin
        });
      }
    }

    return {
      online: false,
      matchedOrigin: '',
      cookieCount: 0
    };
  }

  async function hasLiveSellerSession(controller, shopId) {
    if (
      !controller
      || typeof controller.findOnlineSellerSessionContext !== 'function'
      || !normalizeText(shopId)
    ) {
      return {
        online: false,
        sessionContext: null
      };
    }

    try {
      const sessionContext = await controller.findOnlineSellerSessionContext({
        shopId
      });

      return {
        online: Boolean(
          sessionContext
          && normalizeText(sessionContext.partition)
          && isSellerSessionOnline(sessionContext)
        ),
        sessionContext
      };
    } catch (error) {
      logError('shop_browser_storage_sync_live_session_probe_failed', error, {
        shopId: normalizeText(shopId)
      });
      return {
        online: false,
        sessionContext: null
      };
    }
  }

  function createOperationResult(direction, shopId, origins, selectedTypes, summary, failures = [], extra = {}) {
    return {
      success: failures.length === 0,
      direction,
      shopId: normalizeText(shopId),
      origins: origins.slice(),
      selectedTypes: selectedTypes.slice(),
      failures,
      summary: buildPublicSummary(summary),
      ...extra
    };
  }

  return {
    getStorageTypes() {
      return STORAGE_TYPE_ORDER.slice();
    },

    async getSyncState(payload = {}) {
      const owner = getCurrentOwner();
      const shopId = normalizeText(payload && payload.shopId);

      if (!shopId) {
        return {
          shopId: '',
          origins: buildManagedOrigins(payload && payload.origins, null),
          storageTypes: STORAGE_TYPE_ORDER.slice(),
          localSummary: null,
          cloudSummary: null
        };
      }

      const { localSummary, cloudSummary } = await readSummaryPair(owner, shopId);

      return {
        shopId,
        origins: buildManagedOrigins(payload && payload.origins, null),
        storageTypes: STORAGE_TYPE_ORDER.slice(),
        localSummary: buildPublicSummary(localSummary),
        cloudSummary: buildPublicSummary(cloudSummary)
      };
    },

    async syncToCloud(payload = {}) {
      const { owner, shopId, sessionContext, partition } = await resolveSyncContext(payload);
      const selectedTypes = normalizeTypeList(payload && payload.types);
      const origins = buildManagedOrigins(payload && payload.origins, sessionContext);
      const runtimeProfile = await resolveRuntimeProfile(shopId);
      const proxyConfig = runtimeProfile && runtimeProfile.proxyConfig ? runtimeProfile.proxyConfig : null;
      const updatedAt = nowIso();
      const summaryPair = await readSummaryPair(owner, shopId);
      const nextSummary = normalizeSummary(shopId, summaryPair.cloudSummary || summaryPair.localSummary || null);
      const failures = [];

      if (selectedTypes.includes(STORAGE_TYPES.cookies)) {
        for (const origin of origins) {
          try {
            const snapshot = await captureCookieSnapshot(partition, shopId, origin);
            const { localFilePath, cloudKey } = getSnapshotPaths(owner, shopId, STORAGE_TYPES.cookies, origin);

            await writeJsonFile(localFilePath, snapshot);
            await writeCloudJson(
              cloudKey,
              snapshot,
              buildSnapshotMetadata(owner, shopId, STORAGE_TYPES.cookies, origin)
            );
            applySummaryEntry(nextSummary, STORAGE_TYPES.cookies, origin, snapshot, cloudKey, updatedAt);
          } catch (error) {
            failures.push({
              type: STORAGE_TYPES.cookies,
              origin,
              message: normalizeText(error && error.message) || 'cookies-sync-failed'
            });
          }
        }
      }

      const originStorageResult = await captureOriginStorageSnapshots(
        partition,
        proxyConfig,
        shopId,
        origins,
        selectedTypes
      );

      failures.push(...originStorageResult.failures);

      for (const typeId of [STORAGE_TYPES.localStorage, STORAGE_TYPES.indexedDb]) {
        if (!selectedTypes.includes(typeId)) {
          continue;
        }

        for (const [origin, snapshot] of originStorageResult.snapshotsByType[typeId].entries()) {
          try {
            const { localFilePath, cloudKey } = getSnapshotPaths(owner, shopId, typeId, origin);

            await writeJsonFile(localFilePath, snapshot);
            await writeCloudJson(
              cloudKey,
              snapshot,
              buildSnapshotMetadata(owner, shopId, typeId, origin)
            );
            applySummaryEntry(nextSummary, typeId, origin, snapshot, cloudKey, updatedAt);
          } catch (error) {
            failures.push({
              type: typeId,
              origin,
              message: normalizeText(error && error.message) || 'storage-sync-failed'
            });
          }
        }
      }

      const savedSummary = await writeSummaryPair(owner, shopId, nextSummary);

      log('shop_browser_storage_sync_uploaded', {
        shopId,
        selectedTypes,
        origins,
        failureCount: failures.length
      });

      return createOperationResult('upload', shopId, origins, selectedTypes, savedSummary, failures);
    },

    async restoreFromCloud(payload = {}) {
      const { owner, shopId, sessionContext, partition, controller } = await resolveSyncContext(payload);
      const selectedTypes = normalizeTypeList(payload && payload.types);
      const reloadActiveView = payload && payload.reloadActiveView === true;
      const restoreReason = normalizeText(payload && payload.reason);
      const skipRestoreWhenLocalSessionReady = payload && payload.skipRestoreWhenLocalSessionReady !== false;
      const skipCookieRestoreWhenSessionOnline = payload && payload.skipCookieRestoreWhenSessionOnline !== false;
      const runtimeProfile = await resolveRuntimeProfile(shopId);
      const proxyConfig = runtimeProfile && runtimeProfile.proxyConfig ? runtimeProfile.proxyConfig : null;
      const summaryPair = await readSummaryPair(owner, shopId, {
        forceCloud: true
      });
      const baseSummary = normalizeSummary(shopId, summaryPair.cloudSummary || summaryPair.localSummary || null);

      if (!baseSummary.updatedAt) {
        throw new Error('\u4E91\u7AEF\u8FD8\u6CA1\u6709\u53EF\u6062\u590D\u7684\u6D4F\u89C8\u5668\u5B58\u50A8\u6570\u636E\u3002');
      }

      const summaryOrigins = Array.from(new Set(
        selectedTypes.flatMap((typeId) => Object.keys(baseSummary.types[typeId].origins || {}))
      )).sort((left, right) => left.localeCompare(right));
      const origins = buildManagedOrigins(
        Array.isArray(payload && payload.origins) && payload.origins.length > 0
          ? payload.origins
          : summaryOrigins,
        sessionContext
      );
      const failures = [];
      const snapshotsByType = {
        [STORAGE_TYPES.localStorage]: new Map(),
        [STORAGE_TYPES.indexedDb]: new Map()
      };
      const localSellerSessionOnline = isSellerSessionOnline(sessionContext);
      const liveSellerSession = await hasLiveSellerSession(controller, shopId);
      const liveCookieProbe = selectedTypes.includes(STORAGE_TYPES.cookies)
        ? await hasLiveAuthCookies(partition, origins)
        : {
          online: false,
          matchedOrigin: '',
          cookieCount: 0
        };
      const shouldSkipRestoreBecauseSessionReady = (
        skipRestoreWhenLocalSessionReady
        && liveSellerSession.online === true
      );
      const shouldSkipCookieRestore = (
        skipCookieRestoreWhenSessionOnline
        && liveCookieProbe.online === true
        && selectedTypes.includes(STORAGE_TYPES.cookies)
      );

      if (shouldSkipRestoreBecauseSessionReady) {
        const localSummary = normalizeSummary(shopId, baseSummary);
        const { localFilePath } = getSummaryPaths(owner, shopId);

        await writeJsonFile(localFilePath, localSummary);

        log('shop_browser_storage_sync_skip_full_restore_live_session_ready', {
          shopId,
          restoreReason,
          selectedTypes,
          origins,
          localSellerSessionOnline,
          liveCookieSessionOnline: liveCookieProbe.online,
          liveSellerSessionOnline: true
        });

        return createOperationResult(
          'restore',
          shopId,
          origins,
          selectedTypes,
          localSummary,
          [],
          {
            reloadedActiveView: false,
            skippedCookieRestore: true,
            skippedFullRestore: true,
            skippedRestoreBecauseSessionReady: true,
            localSellerSessionOnline,
            liveCookieSessionOnline: liveCookieProbe.online,
            liveSellerSessionOnline: true
          }
        );
      }

      if (shouldSkipCookieRestore) {
        log('shop_browser_storage_sync_skip_cookie_restore_online_session', {
          shopId,
          restoreReason,
          selectedTypes,
          origins,
          localSellerSessionOnline,
          liveCookieSessionOnline: true,
          liveSellerSessionOnline: liveSellerSession.online === true,
          matchedOrigin: liveCookieProbe.matchedOrigin,
          cookieCount: liveCookieProbe.cookieCount
        });
      }

      if (selectedTypes.includes(STORAGE_TYPES.cookies) && !shouldSkipCookieRestore) {
        for (const origin of origins) {
          const { cloudKey } = getSnapshotPaths(owner, shopId, STORAGE_TYPES.cookies, origin);

          try {
            const snapshot = await readCloudJson(cloudKey);

            if (!snapshot) {
              continue;
            }

            await applyCookieSnapshot(partition, origin, normalizeCookieSnapshot(shopId, origin, snapshot, normalizeText(snapshot && snapshot.updatedAt) || nowIso()));
          } catch (error) {
            failures.push({
              type: STORAGE_TYPES.cookies,
              origin,
              message: normalizeText(error && error.message) || 'cookies-restore-failed'
            });
          }
        }
      }

      for (const typeId of [STORAGE_TYPES.localStorage, STORAGE_TYPES.indexedDb]) {
        if (!selectedTypes.includes(typeId)) {
          continue;
        }

        for (const origin of origins) {
          const { cloudKey } = getSnapshotPaths(owner, shopId, typeId, origin);

          try {
            const snapshot = await readCloudJson(cloudKey);

            if (!snapshot) {
              continue;
            }

            if (typeId === STORAGE_TYPES.localStorage) {
              snapshotsByType[typeId].set(
                origin,
                normalizeLocalStorageSnapshot(shopId, origin, snapshot, normalizeText(snapshot && snapshot.updatedAt) || nowIso())
              );
              continue;
            }

            snapshotsByType[typeId].set(
              origin,
              normalizeIndexedDbSnapshot(shopId, origin, snapshot, normalizeText(snapshot && snapshot.updatedAt) || nowIso())
            );
          } catch (error) {
            failures.push({
              type: typeId,
              origin,
              message: normalizeText(error && error.message) || 'storage-restore-read-failed'
            });
          }
        }
      }

      const applyResult = await applyOriginStorageSnapshots(
        partition,
        proxyConfig,
        origins,
        selectedTypes,
        snapshotsByType
      );

      failures.push(...applyResult.failures);

      const reloadedActiveView = await reloadActiveShopView(controller, shopId, {
        enabled: reloadActiveView
      });
      const localSummary = normalizeSummary(shopId, baseSummary);
      const { localFilePath } = getSummaryPaths(owner, shopId);

      await writeJsonFile(localFilePath, localSummary);

      log('shop_browser_storage_sync_restored', {
        shopId,
        selectedTypes,
        origins,
        failureCount: failures.length,
        reloadActiveView,
        reloadedActiveView,
        restoreReason,
        skippedCookieRestore: shouldSkipCookieRestore,
        localSellerSessionOnline,
        liveCookieSessionOnline: liveCookieProbe.online,
        liveSellerSessionOnline: liveSellerSession.online === true,
        liveCookieMatchedOrigin: liveCookieProbe.matchedOrigin,
        liveCookieCount: liveCookieProbe.cookieCount
      });

      return createOperationResult(
        'restore',
        shopId,
        origins,
        selectedTypes,
        localSummary,
        failures,
        {
          reloadedActiveView,
          skippedCookieRestore: shouldSkipCookieRestore,
          localSellerSessionOnline,
          liveCookieSessionOnline: liveCookieProbe.online,
          liveSellerSessionOnline: liveSellerSession.online === true
        }
      );
    }
  };
}

module.exports = {
  STORAGE_TYPES,
  createShopWindowBrowserStorageSyncService
};
