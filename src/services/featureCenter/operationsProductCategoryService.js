const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  normalizeText,
  isShopParticipating
} = require('../shopManagement/common');
const {
  createShopScopedSessionPolicy
} = require('../shopManagement/shopScopedSessionPolicy');

const GLOBAL_SYNC_FEATURE_ID = 'global-category-sync';
const ROOT_CATEGORY_CACHE_FILE_NAME = 'root-categories.json';
const GLOBAL_CATEGORY_TREE_FILE_NAME = 'global-categories-tree.json';
const ROOT_CATEGORY_VERSION = 1;
const GLOBAL_CATEGORY_TREE_VERSION = 1;
const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const CATEGORY_CHILDREN_PATH = '/anniston-agent-seller/category/children/list';
const DEFAULT_GLOBAL_CATEGORY_SYNC_CONCURRENCY = 4;
const DEFAULT_GLOBAL_CATEGORY_SYNC_RETRY_TIMES = 3;
const CATEGORY_REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_CATEGORY_SEARCH_LIMIT = 12;

function createOperationsProductCategoryService({
  sessionStore,
  featureCenterProfileService,
  shopManagementService,
  getShopWindowBrowserController,
  runtimeLogger
}) {
  let cachedOwnerKey = '';
  let cachedRootSnapshotResult = null;
  let cachedGlobalCategoryTree = null;

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

  const shopScopedSessionPolicy = createShopScopedSessionPolicy({
    runtimeLogger,
    scope: 'operations-product-category'
  });

  function nowIso() {
    return new Date().toISOString();
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

  function getGlobalSyncFeatureEntry() {
    const syncFeatureEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getEntryById === 'function'
        ? featureCenterProfileService.getEntryById(GLOBAL_SYNC_FEATURE_ID)
        : null;

    if (!syncFeatureEntry) {
      throw new Error('\u5168\u91cf\u540c\u6b65\u7c7b\u76ee\u529f\u80fd\u672a\u6ce8\u518c\u3002');
    }

    return syncFeatureEntry;
  }

  function getRootSnapshotStoragePaths(owner) {
    const featureEntry = getGlobalSyncFeatureEntry();

    return {
      localCacheFilePath: path.join(
        featureEntry.storageProfile.localRootDir,
        'users',
        owner.userKey,
        'cache',
        ROOT_CATEGORY_CACHE_FILE_NAME
      ),
      cloudCacheKey: `${featureEntry.storageKey}/users/${owner.userKey}/cache/${ROOT_CATEGORY_CACHE_FILE_NAME}`
    };
  }

  function getGlobalCategoryTreeStoragePaths() {
    const featureEntry = getGlobalSyncFeatureEntry();

    return {
      primaryLocalCacheFilePath: path.join(
        featureEntry.storageProfile.localCacheDir,
        GLOBAL_CATEGORY_TREE_FILE_NAME
      ),
      primaryCloudCacheKey: `${featureEntry.storageKey}/cache/${GLOBAL_CATEGORY_TREE_FILE_NAME}`,
      legacyLocalCacheFilePath: '',
      legacyCloudCacheKey: ''
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

  function normalizeBooleanValue(value, fallback = false) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 1 || value === '1' || value === 'true') {
      return true;
    }

    if (value === 0 || value === '0' || value === 'false') {
      return false;
    }

    return fallback;
  }

  function normalizeIntegerValue(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function normalizeCategoryRecord(category) {
    const normalizedId = normalizeText(
      category && (
        category.catId
        || category.id
      )
    );

    if (!normalizedId) {
      return null;
    }

    return {
      catId: normalizedId,
      catName: normalizeText(
        category && (
          category.catName
          || category.label
        )
      ),
      catEnName: normalizeText(category && category.catEnName),
      catLevel: normalizeIntegerValue(
        category && (
          category.catLevel
          || category.level
        ),
        0
      ),
      catType: normalizeIntegerValue(category && category.catType, 0),
      parentCatId: normalizeText(
        category && (
          category.parentCatId
          || category.parentId
        )
      ),
      isLeaf: normalizeBooleanValue(category && category.isLeaf, false),
      isHidden: normalizeBooleanValue(category && category.isHidden, false),
      hiddenType: normalizeIntegerValue(category && category.hiddenType, 0),
      isSemiManagedHidden: normalizeBooleanValue(category && category.isSemiManagedHidden, false),
      semiManagedHiddenType: normalizeIntegerValue(category && category.semiManagedHiddenType, 0)
    };
  }

  function normalizeCategoryList(payload) {
    const categoryList =
      Array.isArray(payload && payload.result && payload.result.categoryNodeVOS)
        ? payload.result.categoryNodeVOS
        : Array.isArray(payload && payload.categories)
          ? payload.categories
          : [];

    return categoryList
      .map(normalizeCategoryRecord)
      .filter((category) => category && category.catId && category.catName);
  }

  function normalizeCategoryArray(categories) {
    return (Array.isArray(categories) ? categories : [])
      .map(normalizeCategoryRecord)
      .filter((category) => category && category.catId && category.catName);
  }

  function buildDefaultRootSnapshot(owner) {
    return {
      version: ROOT_CATEGORY_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      syncedAt: '',
      shopId: '',
      sourceOrigin: DEFAULT_SELLER_ORIGIN,
      categories: []
    };
  }

  function buildDefaultGlobalCategoryTree() {
    return {
      version: GLOBAL_CATEGORY_TREE_VERSION,
      updatedAt: '',
      syncedAt: '',
      shopId: '',
      shopName: '',
      sourceOrigin: DEFAULT_SELLER_ORIGIN,
      rootCategories: [],
      categoriesByParent: {},
      stats: {
        requestCount: 0,
        rootCount: 0,
        totalCount: 0,
        leafCount: 0,
        nonLeafCount: 0,
        maxLevel: 0
      }
    };
  }

  function normalizeRootSnapshot(payload, owner) {
    const baseSnapshot = buildDefaultRootSnapshot(owner);
    const source = payload && typeof payload === 'object' ? payload : {};
    const updatedAt = normalizeText(source.updatedAt) || normalizeText(source.syncedAt) || baseSnapshot.updatedAt;
    const syncedAt = normalizeText(source.syncedAt) || updatedAt;

    return {
      ...baseSnapshot,
      ...source,
      owner: baseSnapshot.owner,
      updatedAt,
      syncedAt,
      shopId: normalizeText(source.shopId),
      sourceOrigin: normalizeText(source.sourceOrigin) || DEFAULT_SELLER_ORIGIN,
      categories: normalizeCategoryList(source)
    };
  }

  function normalizeCategoriesByParent(source) {
    const rawMap =
      source
      && typeof source === 'object'
      && source.categoriesByParent
      && typeof source.categoriesByParent === 'object'
        ? source.categoriesByParent
        : {};

    return Object.fromEntries(
      Object.entries(rawMap)
        .map(([parentCatId, categories]) => {
          const normalizedParentCatId = normalizeText(parentCatId);

          return [
            normalizedParentCatId,
            normalizeCategoryArray(categories)
          ];
        })
    );
  }

  function buildGlobalCategoryStats(rootCategories, categoriesByParent, stats) {
    const categoryMap = new Map();

    Object.values(categoriesByParent || {}).forEach((categories) => {
      normalizeCategoryArray(categories).forEach((category) => {
        categoryMap.set(category.catId, category);
      });
    });

    const allCategories = Array.from(categoryMap.values());
    const leafCount = allCategories.filter((category) => category.isLeaf === true).length;
    const totalCount = allCategories.length;
    const rootCount = normalizeCategoryArray(rootCategories).length;
    const maxLevel = allCategories.reduce((result, category) => {
      return Math.max(result, normalizeIntegerValue(category && category.catLevel, 0));
    }, 0);

    return {
      requestCount: normalizeIntegerValue(stats && stats.requestCount, 0),
      rootCount,
      totalCount,
      leafCount,
      nonLeafCount: totalCount - leafCount,
      maxLevel
    };
  }

  function normalizeGlobalCategoryTree(payload) {
    const baseTree = buildDefaultGlobalCategoryTree();
    const source = payload && typeof payload === 'object' ? payload : {};
    const categoriesByParent = normalizeCategoriesByParent(source);
    const rootCategories = normalizeCategoryArray(
      Array.isArray(source.rootCategories)
        ? source.rootCategories
        : categoriesByParent['']
    );

    if (!Object.prototype.hasOwnProperty.call(categoriesByParent, '')) {
      categoriesByParent[''] = rootCategories;
    }

    return {
      ...baseTree,
      ...source,
      updatedAt: normalizeText(source.updatedAt) || normalizeText(source.syncedAt),
      syncedAt: normalizeText(source.syncedAt) || normalizeText(source.updatedAt),
      shopId: normalizeText(source.shopId),
      shopName: normalizeText(source.shopName),
      sourceOrigin: normalizeText(source.sourceOrigin) || DEFAULT_SELLER_ORIGIN,
      rootCategories,
      categoriesByParent,
      stats: buildGlobalCategoryStats(rootCategories, categoriesByParent, source.stats)
    };
  }

  function buildRootSnapshotResult(snapshot, meta = {}) {
    const normalizedSnapshot = normalizeRootSnapshot(snapshot, getOwner());

    return {
      updatedAt: normalizeText(normalizedSnapshot.updatedAt),
      syncedAt: normalizeText(normalizedSnapshot.syncedAt),
      shopId: normalizeText(normalizedSnapshot.shopId),
      sourceOrigin: normalizeText(normalizedSnapshot.sourceOrigin) || DEFAULT_SELLER_ORIGIN,
      categories: normalizedSnapshot.categories.slice(),
      source: normalizeText(meta.source) || 'default',
      cloudSynced: meta.cloudSynced === true,
      warning: normalizeText(meta.warning)
    };
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(
      payload && typeof payload === 'object' && payload.updatedAt
        ? payload.updatedAt
        : (
          payload
          && typeof payload === 'object'
          && payload.syncedAt
            ? payload.syncedAt
            : ''
        )
    );

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? {
          source: 'cloud',
          payload: cloudPayload
        }
        : {
          source: 'local',
          payload: localPayload
        };
    }

    if (cloudPayload) {
      return {
        source: 'cloud',
        payload: cloudPayload
      };
    }

    if (localPayload) {
      return {
        source: 'local',
        payload: localPayload
      };
    }

    return {
      source: 'default',
      payload: null
    };
  }

  function pickNewestPayloadEntry(entries) {
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && entry.payload)
      .sort((left, right) => {
        return getPayloadTimestamp(right.payload) - getPayloadTimestamp(left.payload);
      })[0] || null;
  }

  async function readCloudJsonIfExists(cloudCacheKey) {
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key: cloudCacheKey
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key: cloudCacheKey
    });

    return result.data;
  }

  async function readCloudRootSnapshot(owner) {
    const { cloudCacheKey } = getRootSnapshotStoragePaths(owner);

    return readCloudJsonIfExists(cloudCacheKey);
  }

  async function writeCloudRootSnapshot(owner, payload) {
    const { cloudCacheKey } = getRootSnapshotStoragePaths(owner);

    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key: cloudCacheKey,
      data: payload,
      metadata: {
        record_type: 'operations-product-root-categories',
        owner_user_key: owner.userKey,
        owner_username: owner.username,
        shop_id: normalizeText(payload && payload.shopId)
      }
    });
  }

  async function writeCloudGlobalCategoryTree(payload) {
    const { primaryCloudCacheKey } = getGlobalCategoryTreeStoragePaths();
    const normalizedTree = normalizeGlobalCategoryTree(payload);

    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key: primaryCloudCacheKey,
      data: normalizedTree,
      metadata: {
        record_type: 'operations-product-global-categories',
        shop_id: normalizeText(normalizedTree.shopId),
        shop_name: normalizeText(normalizedTree.shopName),
        category_total_count: normalizedTree.stats.totalCount,
        category_root_count: normalizedTree.stats.rootCount,
        synced_at: normalizeText(normalizedTree.syncedAt)
      }
    });
  }

  function updateCachedRootSnapshot(owner, result) {
    cachedOwnerKey = owner && owner.userKey ? owner.userKey : '';
    cachedRootSnapshotResult = buildRootSnapshotResult(
      result && result.snapshot ? result.snapshot : buildDefaultRootSnapshot(owner),
      result || {}
    );

    return cachedRootSnapshotResult;
  }

  async function loadGlobalCategoryTreeCloudPayloadEntries(storagePaths) {
    const payloadEntries = [];
    let primaryCloudTree = null;

    try {
      primaryCloudTree = await readCloudJsonIfExists(storagePaths.primaryCloudCacheKey);
    } catch (error) {
      logError('operations_product_global_category_cloud_read_failed', error, {
        storage: 'primary-cloud'
      });
    }

    if (primaryCloudTree) {
      payloadEntries.push({
        label: 'primary-cloud',
        payload: primaryCloudTree
      });
    }

    if (storagePaths.legacyCloudCacheKey) {
      try {
        const legacyCloudTree = await readCloudJsonIfExists(storagePaths.legacyCloudCacheKey);

        if (legacyCloudTree) {
          payloadEntries.push({
            label: 'legacy-cloud',
            payload: legacyCloudTree
          });
        }
      } catch (error) {
        logError('operations_product_global_category_cloud_read_failed', error, {
          storage: 'legacy-cloud'
        });
      }
    }

    return {
      primaryCloudTree,
      payloadEntries
    };
  }

  function scheduleGlobalCategoryTreeCloudBootstrap(storagePaths, localTree) {
    const normalizedLocalTree = normalizeGlobalCategoryTree(localTree);
    const localTimestamp = getPayloadTimestamp(normalizedLocalTree);

    void (async () => {
      const {
        primaryCloudTree,
        payloadEntries
      } = await loadGlobalCategoryTreeCloudPayloadEntries(storagePaths);
      const preferredCloudEntry = pickNewestPayloadEntry(payloadEntries);

      if (
        preferredCloudEntry
        && preferredCloudEntry.payload
        && getPayloadTimestamp(preferredCloudEntry.payload) > localTimestamp
      ) {
        cachedGlobalCategoryTree = normalizeGlobalCategoryTree(preferredCloudEntry.payload);

        await writeJsonFile(storagePaths.primaryLocalCacheFilePath, cachedGlobalCategoryTree).catch((error) => {
          logError('operations_product_global_category_local_write_failed', error, {
            reason: 'background-cloud-bootstrap'
          });
        });

        return;
      }

      if (localTimestamp > getPayloadTimestamp(primaryCloudTree)) {
        await writeCloudGlobalCategoryTree(normalizedLocalTree).catch((error) => {
          logError('operations_product_global_category_cloud_write_failed', error, {
            reason: 'background-cloud-bootstrap'
          });
        });
      }
    })().catch((error) => {
      logError('operations_product_global_category_cloud_bootstrap_failed', error, {});
    });
  }

  async function getGlobalCategoryTree() {
    if (cachedGlobalCategoryTree) {
      return cachedGlobalCategoryTree;
    }

    const {
      primaryLocalCacheFilePath,
      primaryCloudCacheKey,
      legacyLocalCacheFilePath,
      legacyCloudCacheKey
    } = getGlobalCategoryTreeStoragePaths();
    const payloadEntries = [];
    const primaryLocalTree = await readJsonFile(primaryLocalCacheFilePath).catch((error) => {
      logError('operations_product_global_category_local_read_failed', error, {
        storage: 'primary-local'
      });
      return null;
    });

    if (primaryLocalTree) {
      cachedGlobalCategoryTree = normalizeGlobalCategoryTree(primaryLocalTree);
      scheduleGlobalCategoryTreeCloudBootstrap({
        primaryLocalCacheFilePath,
        primaryCloudCacheKey,
        legacyCloudCacheKey
      }, cachedGlobalCategoryTree);
      return cachedGlobalCategoryTree;
    }

    if (legacyLocalCacheFilePath) {
      const legacyLocalTree = await readJsonFile(legacyLocalCacheFilePath).catch((error) => {
        logError('operations_product_global_category_local_read_failed', error, {
          storage: 'legacy-local'
        });
        return null;
      });

      if (legacyLocalTree) {
        cachedGlobalCategoryTree = normalizeGlobalCategoryTree(legacyLocalTree);

        await writeJsonFile(primaryLocalCacheFilePath, cachedGlobalCategoryTree).catch((error) => {
          logError('operations_product_global_category_local_write_failed', error, {
            reason: 'legacy-local-bootstrap'
          });
        });

        scheduleGlobalCategoryTreeCloudBootstrap({
          primaryLocalCacheFilePath,
          primaryCloudCacheKey,
          legacyCloudCacheKey
        }, cachedGlobalCategoryTree);
        return cachedGlobalCategoryTree;
      }
    }

    const {
      primaryCloudTree,
      payloadEntries: cloudPayloadEntries
    } = await loadGlobalCategoryTreeCloudPayloadEntries({
      primaryCloudCacheKey,
      legacyCloudCacheKey
    });

    payloadEntries.push(...cloudPayloadEntries);

    const preferredEntry = pickNewestPayloadEntry(payloadEntries);

    if (!preferredEntry || !preferredEntry.payload) {
      return null;
    }

    cachedGlobalCategoryTree = normalizeGlobalCategoryTree(preferredEntry.payload);

    if (preferredEntry.label !== 'primary-local') {
      await writeJsonFile(primaryLocalCacheFilePath, cachedGlobalCategoryTree).catch((error) => {
        logError('operations_product_global_category_local_write_failed', error, {});
      });
    }

    if (getPayloadTimestamp(cachedGlobalCategoryTree) > getPayloadTimestamp(primaryCloudTree)) {
      void writeCloudGlobalCategoryTree(cachedGlobalCategoryTree).catch((error) => {
        logError('operations_product_global_category_cloud_write_failed', error, {
          reason: 'bootstrap-primary-cloud'
        });
      });
    }

    return cachedGlobalCategoryTree;
  }

  function buildRootSnapshotFromGlobalTree(owner, globalTree) {
    return normalizeRootSnapshot({
      updatedAt: normalizeText(globalTree && globalTree.updatedAt),
      syncedAt: normalizeText(globalTree && globalTree.syncedAt),
      sourceOrigin: normalizeText(globalTree && globalTree.sourceOrigin),
      categories: Array.isArray(globalTree && globalTree.rootCategories)
        ? globalTree.rootCategories
        : []
    }, owner);
  }

  function buildDefaultGlobalCategorySyncSnapshot() {
    return {
      updatedAt: '',
      syncedAt: '',
      shopId: '',
      shopName: '',
      sourceOrigin: DEFAULT_SELLER_ORIGIN,
      source: 'default',
      cloudSynced: false,
      rootCount: 0,
      totalCount: 0,
      leafCount: 0,
      nonLeafCount: 0,
      maxLevel: 0,
      requestCount: 0,
      warning: ''
    };
  }

  function buildGlobalCategorySyncSnapshot(globalTree, meta = {}) {
    if (!globalTree) {
      return {
        ...buildDefaultGlobalCategorySyncSnapshot(),
        source: normalizeText(meta.source) || 'default',
        cloudSynced: meta.cloudSynced === true,
        warning: normalizeText(meta.warning)
      };
    }

    const normalizedTree = normalizeGlobalCategoryTree(globalTree);
    const stats = normalizedTree.stats || buildDefaultGlobalCategoryTree().stats;

    return {
      updatedAt: normalizeText(normalizedTree.updatedAt),
      syncedAt: normalizeText(normalizedTree.syncedAt),
      shopId: normalizeText(normalizedTree.shopId),
      shopName: normalizeText(normalizedTree.shopName),
      sourceOrigin: normalizeText(normalizedTree.sourceOrigin) || DEFAULT_SELLER_ORIGIN,
      source: normalizeText(meta.source) || 'local',
      cloudSynced: meta.cloudSynced === true,
      rootCount: normalizeIntegerValue(stats.rootCount, 0),
      totalCount: normalizeIntegerValue(stats.totalCount, 0),
      leafCount: normalizeIntegerValue(stats.leafCount, 0),
      nonLeafCount: normalizeIntegerValue(stats.nonLeafCount, 0),
      maxLevel: normalizeIntegerValue(stats.maxLevel, 0),
      requestCount: normalizeIntegerValue(stats.requestCount, 0),
      warning: normalizeText(meta.warning)
    };
  }

  function getGlobalCategoriesByParentId(globalTree, parentCatId) {
    const normalizedTree = normalizeGlobalCategoryTree(globalTree);
    const normalizedParentCatId = normalizeText(parentCatId);
    const categoriesByParent = normalizedTree.categoriesByParent || {};

    if (Object.prototype.hasOwnProperty.call(categoriesByParent, normalizedParentCatId)) {
      return {
        found: true,
        categories: normalizeCategoryArray(categoriesByParent[normalizedParentCatId])
      };
    }

    return {
      found: false,
      categories: []
    };
  }

  function buildGlobalCategoryMap(globalTree) {
    const normalizedTree = normalizeGlobalCategoryTree(globalTree);
    const categoryMap = new Map();

    Object.values(normalizedTree.categoriesByParent || {}).forEach((categories) => {
      normalizeCategoryArray(categories).forEach((category) => {
        categoryMap.set(category.catId, category);
      });
    });

    return categoryMap;
  }

  function buildGlobalCategoryPath(categoryMap, category) {
    const normalizedCategory = normalizeCategoryRecord(category);

    if (!normalizedCategory) {
      return [];
    }

    const path = [];
    const visitedCategoryIds = new Set();
    let currentCategory = normalizedCategory;

    while (currentCategory && currentCategory.catId && !visitedCategoryIds.has(currentCategory.catId)) {
      visitedCategoryIds.add(currentCategory.catId);
      path.push(currentCategory);

      if (!normalizeText(currentCategory.parentCatId)) {
        break;
      }

      currentCategory = categoryMap.get(normalizeText(currentCategory.parentCatId)) || null;
    }

    return path.reverse();
  }

  function buildCategorySearchSortMeta(category, keyword, pathText) {
    const normalizedKeyword = normalizeText(keyword).toLowerCase();
    const categoryName = normalizeText(category && category.catName);
    const categoryNameLower = categoryName.toLowerCase();
    const normalizedPathText = normalizeText(pathText).toLowerCase();
    const exactMatch = categoryNameLower === normalizedKeyword ? 1 : 0;
    const prefixMatch = !exactMatch && categoryNameLower.startsWith(normalizedKeyword) ? 1 : 0;
    const nameIndex = categoryNameLower.indexOf(normalizedKeyword);
    const pathIndex = normalizedPathText.indexOf(normalizedKeyword);

    return {
      exactMatch,
      prefixMatch,
      nameIndex: nameIndex >= 0 ? nameIndex : Number.MAX_SAFE_INTEGER,
      pathIndex: pathIndex >= 0 ? pathIndex : Number.MAX_SAFE_INTEGER
    };
  }

  function searchGlobalCategories(globalTree, payload = {}) {
    const normalizedTree = normalizeGlobalCategoryTree(globalTree);
    const keyword = normalizeText(payload && payload.keyword);
    const limit = Math.max(
      1,
      Math.min(50, normalizeIntegerValue(payload && payload.limit, DEFAULT_CATEGORY_SEARCH_LIMIT))
    );

    if (!keyword) {
      return {
        keyword: '',
        total: 0,
        limit,
        results: []
      };
    }

    const normalizedKeyword = keyword.toLowerCase();
    const categoryMap = buildGlobalCategoryMap(normalizedTree);
    const matches = [];

    categoryMap.forEach((category) => {
      const categoryName = normalizeText(category && category.catName);
      const categoryEnName = normalizeText(category && category.catEnName);
      const path = buildGlobalCategoryPath(categoryMap, category);
      const pathLabels = path.map((item) => normalizeText(item && item.catName)).filter(Boolean);
      const pathIds = path.map((item) => normalizeText(item && item.catId)).filter(Boolean);
      const pathText = pathLabels.join(' / ');
      const searchText = [
        categoryName,
        categoryEnName,
        pathText
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchText.includes(normalizedKeyword)) {
        return;
      }

      const sortMeta = buildCategorySearchSortMeta(category, keyword, pathText);

      matches.push({
        catId: normalizeText(category && category.catId),
        catName: categoryName,
        catLevel: normalizeIntegerValue(category && category.catLevel, 0),
        parentCatId: normalizeText(category && category.parentCatId),
        isLeaf: normalizeBooleanValue(category && category.isLeaf, false),
        path,
        pathIds,
        pathLabels,
        pathText,
        sortMeta
      });
    });

    matches.sort((left, right) => {
      if (right.sortMeta.exactMatch !== left.sortMeta.exactMatch) {
        return right.sortMeta.exactMatch - left.sortMeta.exactMatch;
      }

      if (right.sortMeta.prefixMatch !== left.sortMeta.prefixMatch) {
        return right.sortMeta.prefixMatch - left.sortMeta.prefixMatch;
      }

      if (left.sortMeta.nameIndex !== right.sortMeta.nameIndex) {
        return left.sortMeta.nameIndex - right.sortMeta.nameIndex;
      }

      if (left.sortMeta.pathIndex !== right.sortMeta.pathIndex) {
        return left.sortMeta.pathIndex - right.sortMeta.pathIndex;
      }

      if (left.catLevel !== right.catLevel) {
        return left.catLevel - right.catLevel;
      }

      if (left.pathLabels.length !== right.pathLabels.length) {
        return left.pathLabels.length - right.pathLabels.length;
      }

      return left.pathText.localeCompare(right.pathText, 'zh-CN');
    });

    return {
      keyword,
      total: matches.length,
      limit,
      results: matches
        .slice(0, limit)
        .map(({ sortMeta, ...result }) => result)
    };
  }

  function getController() {
    return typeof getShopWindowBrowserController === 'function'
      ? getShopWindowBrowserController()
      : null;
  }

  function normalizePartitionSegment(value) {
    return normalizeText(value).toLowerCase();
  }

  function buildPartitionIdentity(payload) {
    const phoneNumber = normalizePartitionSegment(payload && payload.phoneNumber);
    const shopId = normalizePartitionSegment(payload && payload.shopId);

    return phoneNumber || shopId || 'default-shop';
  }

  function buildShopPartition(payload) {
    const partitionHash = crypto
      .createHash('sha256')
      .update(buildPartitionIdentity(payload))
      .digest('hex')
      .slice(0, 16);

    return `persist:temu-toolbox-shop-${partitionHash}`;
  }

  async function resolveSyncShopId(preferredShopId) {
    const normalizedPreferredShopId = normalizeText(preferredShopId);

    if (normalizedPreferredShopId) {
      return normalizedPreferredShopId;
    }

    if (!shopManagementService) {
      throw new Error('\u5E97\u94FA\u5217\u8868\u672A\u52A0\u8F7D\uFF0C\u65E0\u6CD5\u540C\u6B65\u7C7B\u76EE\u3002');
    }

    let shopState = null;

    if (typeof shopManagementService.getLocalState === 'function') {
      shopState = await shopManagementService.getLocalState().catch(() => null);
    }

    if (
      (!shopState || shopState.localStateAvailable !== true)
      && typeof shopManagementService.getState === 'function'
    ) {
      shopState = await shopManagementService.getState();
    }

    const visibleShop = Array.isArray(shopState && shopState.shops)
      ? shopState.shops.find((shop) => isShopParticipating(shop) && normalizeText(shop && shop.id))
      : null;

    if (!visibleShop) {
      throw new Error('\u8BF7\u5148\u6DFB\u52A0\u5E76\u9009\u62E9\u5DF2\u5F00\u542F\u5E97\u94FA\u540E\u518D\u540C\u6B65\u7C7B\u76EE\u3002');
    }

    return normalizeText(visibleShop.id);
  }

  async function resolveShopSessionContext(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      throw new Error('\u8BF7\u5148\u9009\u62E9\u5E97\u94FA\u3002');
    }

    const controller = getController();

    if (controller && typeof controller.resolveShopSessionContext === 'function') {
      const sessionContext = await controller.resolveShopSessionContext({
        shopId: normalizedShopId
      });

      if (sessionContext && normalizeText(sessionContext.partition)) {
        return sessionContext;
      }
    }

    if (!shopManagementService || typeof shopManagementService.getShopRuntimeProfile !== 'function') {
      throw new Error('\u5E97\u94FA\u4F1A\u8BDD\u73AF\u5883\u672A\u5C31\u7EEA\u3002');
    }

    const runtimeProfile = await shopManagementService.getShopRuntimeProfile({
      shopId: normalizedShopId
    });

    return {
      shopId: normalizeText(runtimeProfile && runtimeProfile.shopId) || normalizedShopId,
      partition: buildShopPartition(runtimeProfile),
      sellerSession: {
        origin: DEFAULT_SELLER_ORIGIN,
        hostname: 'agentseller.temu.com',
        status: ''
      }
    };
  }

  function resolveSellerOrigin(sessionContext) {
    const origin = normalizeText(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.origin
    );

    return /^https?:\/\/[^/]+$/i.test(origin)
      ? origin.replace(/\/+$/, '')
      : DEFAULT_SELLER_ORIGIN;
  }

  function resolveSessionPolicyDetails(sessionContext, requestUrl, message) {
    return {
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      partition: normalizeText(sessionContext && sessionContext.partition),
      origin: resolveSellerOrigin(sessionContext),
      requestUrl: normalizeText(requestUrl),
      message
    };
  }

  function resolveShopScopedFetchSession(sessionContext, requestUrl, message) {
    return shopScopedSessionPolicy.resolveSessionForFetch(
      normalizeText(sessionContext && sessionContext.partition),
      resolveSessionPolicyDetails(sessionContext, requestUrl, message)
    );
  }

  function resolveShopScopedCookieSession(sessionContext, requestUrl, message) {
    return shopScopedSessionPolicy.resolveSessionForCookies(
      normalizeText(sessionContext && sessionContext.partition),
      resolveSessionPolicyDetails(sessionContext, requestUrl, message)
    );
  }

  function resolveSellerMallId(sessionContext) {
    return normalizeText(
      sessionContext
      && sessionContext.sellerSession
      && sessionContext.sellerSession.mallId
    );
  }

  async function resolveSellerMallIdFromSessionCookie(sessionContext) {
    const origin = resolveSellerOrigin(sessionContext);
    const targetSession = resolveShopScopedCookieSession(
      sessionContext,
      `${origin}/`,
      '\u5546\u54c1\u7c7b\u76ee Cookies \u8bfb\u53d6\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );

    try {
      const cookies = await targetSession.cookies.get({
        url: `${origin}/`
      });
      const matchedCookie = (Array.isArray(cookies) ? cookies : []).find((cookie) => {
        return normalizeText(cookie && cookie.name).toLowerCase() === 'mallid';
      });

      return normalizeText(matchedCookie && matchedCookie.value);
    } catch (error) {
      logError('operations_product_category_cookie_mallid_read_failed', error, {
        shopId: normalizeText(sessionContext && sessionContext.shopId),
        partition: normalizeText(sessionContext && sessionContext.partition),
        sourceOrigin: origin
      });
      return '';
    }
  }

  async function ensureCategoryRequestMallId(sessionContext) {
    const directMallId = resolveSellerMallId(sessionContext);

    if (directMallId) {
      return directMallId;
    }

    const cookieMallId = await resolveSellerMallIdFromSessionCookie(sessionContext);

    if (cookieMallId) {
      if (sessionContext && sessionContext.sellerSession && typeof sessionContext.sellerSession === 'object') {
        sessionContext.sellerSession.mallId = cookieMallId;
      }

      log('operations_product_category_cookie_mallid_resolved', {
        shopId: normalizeText(sessionContext && sessionContext.shopId),
        mallId: cookieMallId,
        sourceOrigin: resolveSellerOrigin(sessionContext)
      });

      return cookieMallId;
    }

    const error = new Error(
      '\u672A\u80FD\u786E\u5B9A\u5F53\u524D\u5E97\u94FA\u5BF9\u5E94\u7684 Mallid\uFF0C\u6682\u65F6\u65E0\u6CD5\u62C9\u53D6\u5546\u54C1\u7C7B\u76EE\u3002\u8BF7\u5148\u5728\u6D4F\u89C8\u7A97\u53E3\u786E\u8BA4\u5DF2\u8FDB\u5165\u76EE\u6807\u5E97\u94FA\u7684\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\uFF0C\u7136\u540E\u518D\u91CD\u8BD5\u3002'
    );

    error.authRequired = true;
    error.loginPending = true;
    error.httpStatus = 0;
    error.shopId = normalizeText(sessionContext && sessionContext.shopId);
    error.sourceOrigin = resolveSellerOrigin(sessionContext);

    throw error;
  }

  async function executeCategoryFetchWithTimeout(targetSession, requestUrl, requestInit, options = {}) {
    const timeoutMs = Math.max(
      1000,
      Number(options && options.timeoutMs) || CATEGORY_REQUEST_TIMEOUT_MS
    );
    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    let timeoutId = 0;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (controller) {
          try {
            controller.abort();
          } catch (_error) {
            // Ignore abort failures.
          }
        }

        const timeoutError = new Error(
          '\u5546\u54c1\u7c7b\u76ee\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );

        timeoutError.timeout = true;
        timeoutError.retryable = true;
        reject(timeoutError);
      }, timeoutMs);
    });

    const fetchPromise = (async () => {
      try {
        return targetSession && typeof targetSession.fetch === 'function'
          ? await targetSession.fetch(requestUrl, {
            ...requestInit,
            ...(controller ? { signal: controller.signal } : {})
          })
          : null;
      } catch (error) {
        if (
          (controller && controller.signal && controller.signal.aborted)
          || normalizeText(error && error.name) === 'AbortError'
        ) {
          const timeoutError = new Error(
            '\u5546\u54c1\u7c7b\u76ee\u63a5\u53e3\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
          );

          timeoutError.timeout = true;
          timeoutError.retryable = true;
          throw timeoutError;
        }

        throw error;
      }
    })();

    try {
      return await Promise.race([
        fetchPromise,
        timeoutPromise
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  function toCategoryRequestParentIdValue(parentCatId) {
    const normalizedParentCatId = normalizeText(parentCatId);

    if (!normalizedParentCatId) {
      return null;
    }

    const parsedValue = Number.parseInt(normalizedParentCatId, 10);

    return Number.isSafeInteger(parsedValue)
      ? parsedValue
      : normalizedParentCatId;
  }

  function parseCategoryApiResponse(response, responseText) {
    const httpStatus = Number(response && response.status) || 0;
    const normalizedResponseText = typeof responseText === 'string' ? responseText : '';
    const previewText = normalizeText(normalizedResponseText).slice(0, 180);
    const lowerPreviewText = previewText.toLowerCase();
    let payload = null;

    try {
      payload = normalizedResponseText ? JSON.parse(normalizedResponseText) : null;
    } catch (_error) {
      payload = null;
    }

    if (!payload || typeof payload !== 'object') {
      const authRequired =
        httpStatus === 401
        || httpStatus === 403
        || lowerPreviewText.includes('login')
        || lowerPreviewText.includes('unauthorized')
        || lowerPreviewText.includes('forbidden')
        || lowerPreviewText.includes('\u767B\u5F55')
        || lowerPreviewText.includes('\u9A8C\u8BC1\u7801')
        || lowerPreviewText.startsWith('<!doctype')
        || lowerPreviewText.startsWith('<html');

      return {
        ok: false,
        authRequired,
        httpStatus,
        payload: null,
        message: authRequired
          ? '\u5546\u54C1\u7C7B\u76EE\u767B\u5F55\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u5148\u5728\u6D4F\u89C8\u7A97\u53E3\u8FDB\u5165\u5E97\u94FA\u5BF9\u5E94\u7684\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\u3002'
          : '\u5546\u54C1\u7C7B\u76EE\u63A5\u53E3\u8FD4\u56DE\u5F02\u5E38\u3002'
      };
    }

    const message = normalizeText(
      payload.errorMsg
      || payload.message
      || payload.msg
    );
    const lowerMessage = message.toLowerCase();
    const authRequired =
      httpStatus === 401
      || httpStatus === 403
      || lowerMessage.includes('login')
      || lowerMessage.includes('unauthorized')
      || lowerMessage.includes('forbidden')
      || lowerMessage.includes('\u767B\u5F55')
      || lowerMessage.includes('\u9A8C\u8BC1\u7801');
    const success =
      payload.success === true
      && (
        !Object.prototype.hasOwnProperty.call(payload, 'errorCode')
        || Number(payload.errorCode) === 1000000
      );

    if (!success) {
      return {
        ok: false,
        authRequired,
        httpStatus,
        payload,
        message: message || (
          authRequired
            ? '\u5546\u54C1\u7C7B\u76EE\u767B\u5F55\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u5148\u786E\u8BA4\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\u5DF2\u5B8C\u6210\u767B\u5F55\u3002'
            : '\u5546\u54C1\u7C7B\u76EE\u52A0\u8F7D\u5931\u8D25\u3002'
        )
      };
    }

    return {
      ok: true,
      authRequired: false,
      httpStatus,
      payload,
      categories: normalizeCategoryList(payload),
      message
    };
  }

  async function executeCategoryRequestWithSessionContext(sessionContext, parentCatId) {
    const normalizedShopId = normalizeText(sessionContext && sessionContext.shopId);
    const origin = resolveSellerOrigin(sessionContext);
    const mallId = await ensureCategoryRequestMallId(sessionContext);
    const requestUrl = new URL(CATEGORY_CHILDREN_PATH, origin).toString();
    const targetSession = resolveShopScopedFetchSession(
      sessionContext,
      requestUrl,
      '\u5546\u54c1\u7c7b\u76ee\u63a5\u53e3\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002'
    );
    const requestBody = {};
    const parentCatIdValue = toCategoryRequestParentIdValue(parentCatId);

    if (parentCatIdValue !== null) {
      requestBody.parentCatId = parentCatIdValue;
    }

    const requestInit = {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json;charset=UTF-8',
        ...(mallId ? { Mallid: mallId } : {}),
        origin,
        pragma: 'no-cache',
        referer: `${origin}/newon/product-select`,
        'x-requested-with': 'XMLHttpRequest'
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
      credentials: 'include'
    };
    const response = await executeCategoryFetchWithTimeout(targetSession, requestUrl, requestInit);
    const responseText = await response.text();
    const parsedResult = parseCategoryApiResponse(response, responseText);

    if (!parsedResult.ok) {
      const error = new Error(parsedResult.message || '\u5546\u54C1\u7C7B\u76EE\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\u3002');

      error.authRequired = parsedResult.authRequired === true;
      error.loginPending = parsedResult.authRequired === true;
      error.httpStatus = parsedResult.httpStatus;
      error.shopId = normalizedShopId;
      error.parentCatId = normalizeText(parentCatId);
      error.sourceOrigin = origin;
      throw error;
    }

    log('operations_product_category_request_succeeded', {
      shopId: normalizedShopId,
      parentCatId: normalizeText(parentCatId),
      partition,
      mallId,
      sourceOrigin: origin,
      categoryCount: parsedResult.categories.length
    });

    return {
      shopId: normalizedShopId,
      parentCatId: normalizeText(parentCatId),
      sourceOrigin: origin,
      mallId,
      categories: parsedResult.categories,
      fetchedAt: nowIso()
    };
  }

  async function executeCategoryRequest(shopId, parentCatId) {
    const normalizedShopId = normalizeText(shopId);
    const sessionContext = await resolveShopSessionContext(normalizedShopId);

    return executeCategoryRequestWithSessionContext(sessionContext, parentCatId);
  }

  async function fetchWithRetry(requestFactory, retryTimes) {
    let attempt = 0;
    let lastError = null;

    while (attempt < retryTimes) {
      try {
        return await requestFactory();
      } catch (error) {
        lastError = error;
        attempt += 1;

        if (attempt >= retryTimes) {
          break;
        }

        const delayMs = Math.min(5000, 400 * (2 ** (attempt - 1)));

        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }
    }

    throw lastError;
  }

  async function resolveOnlineSyncSessionContexts(payload = {}) {
    const preferredShopId = normalizeText(payload && payload.shopId);
    const controller = getController();
    const contexts = [];

    if (controller && typeof controller.listOnlineSellerSessionContexts === 'function') {
      const sessionContexts = await controller.listOnlineSellerSessionContexts({
        shopId: preferredShopId,
        includePending: true
      });

      if (Array.isArray(sessionContexts) && sessionContexts.length > 0) {
        return sessionContexts
          .filter((sessionContext) => {
            return normalizeText(sessionContext && sessionContext.partition)
              && normalizeText(sessionContext && sessionContext.shopId);
          });
      }
    }

    if (controller && typeof controller.findOnlineSellerSessionContext === 'function') {
      const sessionContext = await controller.findOnlineSellerSessionContext({
        shopId: preferredShopId
      });

      if (sessionContext && normalizeText(sessionContext.partition) && normalizeText(sessionContext.shopId)) {
        contexts.push(sessionContext);
      }
    }

    if (contexts.length > 0) {
      return contexts;
    }

    if (preferredShopId) {
      throw new Error('\u6307\u5B9A\u5E97\u94FA\u5F53\u524D\u672A\u5B8C\u6210\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\u767B\u5F55\uFF0C\u8BF7\u5148\u5728\u6D4F\u89C8\u7A97\u53E3\u6253\u5F00\u5BF9\u5E94\u5E97\u94FA\u5E76\u8FDB\u5165\u300C\u5168\u7403\u300D\u3002');
    }

    throw new Error('\u672A\u627E\u5230\u53EF\u7528\u7684\u5728\u7EBF\u5E97\u94FA\u4F1A\u8BDD\uFF0C\u8BF7\u5148\u5728\u6D4F\u89C8\u7A97\u53E3\u6253\u5F00\u4EFB\u610F\u4E00\u4E2A\u5E97\u94FA\u7684\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\u5DE5\u4F5C\u53F0\uFF0C\u5B8C\u6210\u767B\u5F55\u540E\u518D\u540C\u6B65\u3002');
  }

  function isCategoryAuthRetryableError(error) {
    return Boolean(
      error
      && (
        error.authRequired === true
        || error.loginPending === true
        || error.timeout === true
        || error.retryable === true
        || Number(error.httpStatus) === 401
        || Number(error.httpStatus) === 403
      )
    );
  }

  async function warmupGlobalCategorySyncSessionContext(sessionContext, payload = {}) {
    const normalizedSessionContext = {
      ...sessionContext,
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName),
      partition: normalizeText(sessionContext && sessionContext.partition)
    };
    const controller = getController();

    if (
      !controller
      || typeof controller.ensureBackgroundSellerCenterGlobalSession !== 'function'
      || !normalizedSessionContext.shopId
    ) {
      return normalizedSessionContext;
    }

    const warmupResult = await controller.ensureBackgroundSellerCenterGlobalSession({
      shopId: normalizedSessionContext.shopId,
      timeoutMs: payload && payload.timeoutMs
    });
    const warmedSessionContext =
      warmupResult && warmupResult.sessionContext && typeof warmupResult.sessionContext === 'object'
        ? warmupResult.sessionContext
        : normalizedSessionContext;

    return {
      ...normalizedSessionContext,
      ...warmedSessionContext,
      shopId: normalizeText(warmedSessionContext && warmedSessionContext.shopId) || normalizedSessionContext.shopId,
      shopName: normalizeText(warmedSessionContext && warmedSessionContext.shopName) || normalizedSessionContext.shopName,
      partition: normalizeText(warmedSessionContext && warmedSessionContext.partition) || normalizedSessionContext.partition,
      sellerSession:
        warmedSessionContext && warmedSessionContext.sellerSession && typeof warmedSessionContext.sellerSession === 'object'
          ? {
            ...(normalizedSessionContext.sellerSession || {}),
            ...warmedSessionContext.sellerSession
          }
          : (normalizedSessionContext.sellerSession || {})
    };
  }

  async function crawlGlobalCategoryTree(sessionContext, options = {}) {
    const normalizedSessionContext = {
      ...sessionContext,
      shopId: normalizeText(sessionContext && sessionContext.shopId),
      shopName: normalizeText(sessionContext && sessionContext.shopName)
    };
    const concurrency = Math.max(
      1,
      normalizeIntegerValue(options && options.concurrency, DEFAULT_GLOBAL_CATEGORY_SYNC_CONCURRENCY)
    );
    const retryTimes = Math.max(
      1,
      normalizeIntegerValue(options && options.retryTimes, DEFAULT_GLOBAL_CATEGORY_SYNC_RETRY_TIMES)
    );
    const visitedParentIds = new Set();
    const queuedParentIds = new Set();
    const queue = [];
    const categoriesByParent = Object.create(null);
    const categoryMap = new Map();
    let requestCount = 0;

    function registerChildren(parentCatId, categories) {
      const normalizedParentCatId = normalizeText(parentCatId);
      const normalizedCategories = normalizeCategoryArray(categories);

      categoriesByParent[normalizedParentCatId] = normalizedCategories;

      normalizedCategories.forEach((category) => {
        categoryMap.set(category.catId, category);

        if (category.isLeaf === true) {
          return;
        }

        if (visitedParentIds.has(category.catId) || queuedParentIds.has(category.catId)) {
          return;
        }

        queuedParentIds.add(category.catId);
        queue.push(category.catId);
      });
    }

    const rootResponse = await fetchWithRetry(() => {
      return executeCategoryRequestWithSessionContext(normalizedSessionContext, '');
    }, retryTimes);

    requestCount += 1;
    registerChildren('', rootResponse.categories);

    async function worker() {
      while (queue.length > 0) {
        const parentCatId = queue.shift();

        if (!parentCatId) {
          continue;
        }

        queuedParentIds.delete(parentCatId);

        if (visitedParentIds.has(parentCatId)) {
          continue;
        }

        visitedParentIds.add(parentCatId);
        const childResponse = await fetchWithRetry(() => {
          return executeCategoryRequestWithSessionContext(normalizedSessionContext, parentCatId);
        }, retryTimes);

        requestCount += 1;
        registerChildren(parentCatId, childResponse.categories);
      }
    }

    await Promise.all(
      Array.from({ length: concurrency }, () => worker())
    );

    const syncedAt = nowIso();
    const nextTree = normalizeGlobalCategoryTree({
      version: GLOBAL_CATEGORY_TREE_VERSION,
      updatedAt: syncedAt,
      syncedAt,
      shopId: normalizedSessionContext.shopId,
      shopName: normalizedSessionContext.shopName,
      sourceOrigin: resolveSellerOrigin(normalizedSessionContext),
      rootCategories: normalizeCategoryArray(categoriesByParent['']),
      categoriesByParent,
      stats: {
        requestCount
      }
    });

    return nextTree;
  }

  async function getGlobalCategorySyncSnapshot() {
    try {
      const globalTree = await getGlobalCategoryTree();

      if (!globalTree) {
        return buildDefaultGlobalCategorySyncSnapshot();
      }

      return buildGlobalCategorySyncSnapshot(globalTree, {
        source: 'cache'
      });
    } catch (error) {
      logError('operations_product_global_category_snapshot_failed', error, {});

      return buildGlobalCategorySyncSnapshot(null, {
        source: 'error',
        warning: error && error.message ? error.message : ''
      });
    }
  }

  async function syncGlobalCategoryTreeFromOnlineShop(payload = {}) {
    const sessionContexts = await resolveOnlineSyncSessionContexts(payload);
    const { primaryLocalCacheFilePath } = getGlobalCategoryTreeStoragePaths();
    let sessionContext = null;
    let nextTree = null;
    let lastError = null;

    for (const candidateContext of sessionContexts) {
      const candidateShopId = normalizeText(candidateContext && candidateContext.shopId);

      try {
        const warmedSessionContext = await warmupGlobalCategorySyncSessionContext(candidateContext, payload);

        nextTree = await crawlGlobalCategoryTree(warmedSessionContext, payload);
        sessionContext = warmedSessionContext;
        break;
      } catch (error) {
        lastError = error;
        logError('operations_product_global_category_sync_candidate_failed', error, {
          shopId: candidateShopId,
          shopName: normalizeText(candidateContext && candidateContext.shopName),
          mallId: resolveSellerMallId(candidateContext)
        });

        if (!isCategoryAuthRetryableError(error)) {
          throw error;
        }
      }
    }

    if (!nextTree || !sessionContext) {
      const fallbackMessage = '\u8BF7\u5148\u5728\u6D4F\u89C8\u7A97\u53E3\u6253\u5F00\u4EFB\u610F\u4E00\u4E2A\u53EF\u7528\u5E97\u94FA\u7684\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\u5DE5\u4F5C\u53F0\uFF0C\u786E\u8BA4\u5DF2\u8FDB\u5165\u300C\u5168\u7403\u300D\u5E76\u5B8C\u6210\u767B\u5F55\u540E\u518D\u91CD\u8BD5\u3002';
      const error = lastError instanceof Error ? lastError : new Error(fallbackMessage);

      if (!normalizeText(error.message)) {
        error.message = fallbackMessage;
      } else if (isCategoryAuthRetryableError(lastError)) {
        error.message = fallbackMessage;
      }

      throw error;
    }

    cachedGlobalCategoryTree = nextTree;
    await writeJsonFile(primaryLocalCacheFilePath, nextTree);

    try {
      await writeCloudGlobalCategoryTree(nextTree);

      return buildGlobalCategorySyncSnapshot(nextTree, {
        source: 'live-shop',
        cloudSynced: true
      });
    } catch (error) {
      logError('operations_product_global_category_cloud_write_failed', error, {
        shopId: normalizeText(sessionContext && sessionContext.shopId),
        shopName: normalizeText(sessionContext && sessionContext.shopName)
      });

      return buildGlobalCategorySyncSnapshot(nextTree, {
        source: 'live-shop',
        cloudSynced: false,
        warning: error && error.message ? error.message : '\u4E91\u7AEF\u540C\u6B65\u5931\u8D25'
      });
    }
  }

  async function getRootCategorySnapshot() {
    const owner = getOwner();
    let globalTree = null;

    try {
      globalTree = await getGlobalCategoryTree();
    } catch (error) {
      logError('operations_product_global_category_read_failed', error, {});
    }

    if (!owner) {
      if (globalTree && Array.isArray(globalTree.rootCategories) && globalTree.rootCategories.length > 0) {
        return updateCachedRootSnapshot(owner, {
          snapshot: buildRootSnapshotFromGlobalTree(owner, globalTree),
          source: 'global-cache'
        });
      }

      return updateCachedRootSnapshot(owner, {
        snapshot: buildDefaultRootSnapshot(owner),
        source: 'default'
      });
    }

    const ownerKey = owner.userKey;

    if (
      cachedRootSnapshotResult
      && cachedOwnerKey === ownerKey
      && normalizeText(cachedRootSnapshotResult.source) !== 'default'
    ) {
      return cachedRootSnapshotResult;
    }

    const { localCacheFilePath } = getRootSnapshotStoragePaths(owner);
    const localSnapshot = await readJsonFile(localCacheFilePath).catch((error) => {
      logError('operations_product_root_category_local_read_failed', error, {
        userKey: owner.userKey
      });
      return null;
    });

    let cloudSnapshot = null;
    let cloudReadFailed = false;

    try {
      cloudSnapshot = await readCloudRootSnapshot(owner);
    } catch (error) {
      cloudReadFailed = true;
      logError('operations_product_root_category_cloud_read_failed', error, {
        userKey: owner.userKey
      });
    }

    const preferred = pickNewerPayload(localSnapshot, cloudSnapshot);

    if (preferred.payload) {
      const normalizedSnapshot = normalizeRootSnapshot(preferred.payload, owner);
      const globalSnapshot =
        globalTree && Array.isArray(globalTree.rootCategories) && globalTree.rootCategories.length > 0
          ? buildRootSnapshotFromGlobalTree(owner, globalTree)
          : null;
      const shouldPreferGlobalSnapshot =
        globalSnapshot
        && (
          normalizedSnapshot.categories.length <= 0
          || getPayloadTimestamp(globalSnapshot) >= getPayloadTimestamp(normalizedSnapshot)
        );

      if (!shouldPreferGlobalSnapshot) {
        if (
          preferred.source === 'cloud'
          && getPayloadTimestamp(cloudSnapshot) > getPayloadTimestamp(localSnapshot)
        ) {
          await writeJsonFile(localCacheFilePath, normalizedSnapshot).catch((error) => {
            logError('operations_product_root_category_local_write_failed', error, {
              userKey: owner.userKey
            });
          });
        }

        if (
          preferred.source === 'local'
          && getPayloadTimestamp(localSnapshot) > getPayloadTimestamp(cloudSnapshot)
        ) {
          void writeCloudRootSnapshot(owner, normalizedSnapshot).catch((error) => {
            logError('operations_product_root_category_bootstrap_cloud_sync_failed', error, {
              userKey: owner.userKey
            });
          });
        }

        return updateCachedRootSnapshot(owner, {
          snapshot: normalizedSnapshot,
          source: preferred.source === 'local' && cloudReadFailed === true
            ? 'local-fallback'
            : preferred.source
        });
      }

      return updateCachedRootSnapshot(owner, {
        snapshot: globalSnapshot,
        source: 'global-cache'
      });
    }

    if (globalTree && Array.isArray(globalTree.rootCategories) && globalTree.rootCategories.length > 0) {
      return updateCachedRootSnapshot(owner, {
        snapshot: buildRootSnapshotFromGlobalTree(owner, globalTree),
        source: 'global-cache'
      });
    }

    return updateCachedRootSnapshot(owner, {
      snapshot: buildDefaultRootSnapshot(owner),
      source: 'default'
    });
  }

  async function syncRootCategories(payload = {}) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedRootSnapshot(owner, {
        snapshot: buildDefaultRootSnapshot(owner),
        source: 'default'
      });
    }

    const shopId = await resolveSyncShopId(payload && payload.shopId);
    const fetchResult = await executeCategoryRequest(shopId, '');
    const nextSnapshot = normalizeRootSnapshot({
      version: ROOT_CATEGORY_VERSION,
      owner: {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      },
      updatedAt: fetchResult.fetchedAt,
      syncedAt: fetchResult.fetchedAt,
      shopId: fetchResult.shopId,
      sourceOrigin: fetchResult.sourceOrigin,
      categories: fetchResult.categories
    }, owner);
    const { localCacheFilePath } = getRootSnapshotStoragePaths(owner);

    await writeJsonFile(localCacheFilePath, nextSnapshot);

    try {
      await writeCloudRootSnapshot(owner, nextSnapshot);

      return updateCachedRootSnapshot(owner, {
        snapshot: nextSnapshot,
        source: 'cloud',
        cloudSynced: true
      });
    } catch (error) {
      logError('operations_product_root_category_cloud_write_failed', error, {
        userKey: owner.userKey,
        shopId
      });

      return updateCachedRootSnapshot(owner, {
        snapshot: nextSnapshot,
        source: 'local',
        cloudSynced: false,
        warning: error && error.message ? error.message : '\u4E91\u7AEF\u540C\u6B65\u5931\u8D25'
      });
    }
  }

  async function getChildCategories(payload = {}) {
    const parentCatId = normalizeText(payload && payload.parentCatId);

    if (!parentCatId) {
      throw new Error('\u8BF7\u5148\u9009\u62E9\u4E0A\u4E00\u7EA7\u7C7B\u76EE\u3002');
    }

    try {
      const globalTree = await getGlobalCategoryTree();
      if (!globalTree) {
        throw new Error('\u5168\u91CF\u7C7B\u76EE\u6682\u672A\u51C6\u5907\u597D\uFF0C\u8BF7\u5148\u5B8C\u6210\u5168\u91CF\u540C\u6B65\u7C7B\u76EE\u3002');
      }

      const globalResult = getGlobalCategoriesByParentId(globalTree, parentCatId);

      return {
        shopId: '',
        parentCatId,
        sourceOrigin: normalizeText(globalTree && globalTree.sourceOrigin) || DEFAULT_SELLER_ORIGIN,
        categories: globalResult.categories,
        fetchedAt: normalizeText(globalTree && (globalTree.syncedAt || globalTree.updatedAt)) || nowIso(),
        source: 'global-cache'
      };
    } catch (error) {
      logError('operations_product_global_child_category_read_failed', error, {
        parentCatId
      });
      throw error;
    }
  }

  async function searchCategories(payload = {}) {
    const keyword = normalizeText(payload && payload.keyword);
    const limit = Math.max(
      1,
      Math.min(50, normalizeIntegerValue(payload && payload.limit, DEFAULT_CATEGORY_SEARCH_LIMIT))
    );

    if (!keyword) {
      return {
        keyword: '',
        total: 0,
        limit,
        results: [],
        sourceOrigin: DEFAULT_SELLER_ORIGIN,
        fetchedAt: nowIso(),
        source: 'global-cache'
      };
    }

    try {
      const globalTree = await getGlobalCategoryTree();

      if (!globalTree) {
        throw new Error('\u5168\u91CF\u7C7B\u76EE\u6682\u672A\u51C6\u5907\u597D\uFF0C\u8BF7\u5148\u5B8C\u6210\u5168\u91CF\u540C\u6B65\u7C7B\u76EE\u3002');
      }

      const searchResult = searchGlobalCategories(globalTree, {
        keyword,
        limit
      });

      return {
        keyword: searchResult.keyword,
        total: searchResult.total,
        limit: searchResult.limit,
        results: searchResult.results,
        sourceOrigin: normalizeText(globalTree && globalTree.sourceOrigin) || DEFAULT_SELLER_ORIGIN,
        fetchedAt: normalizeText(globalTree && (globalTree.syncedAt || globalTree.updatedAt)) || nowIso(),
        source: 'global-cache'
      };
    } catch (error) {
      logError('operations_product_global_category_search_failed', error, {
        keyword,
        limit
      });
      throw error;
    }
  }

  return {
    async getRootCategorySnapshot() {
      return getRootCategorySnapshot();
    },

    async getGlobalCategorySyncSnapshot() {
      return getGlobalCategorySyncSnapshot();
    },

    async syncRootCategories(payload = {}) {
      return syncRootCategories(payload);
    },

    async syncGlobalCategoryTreeFromOnlineShop(payload = {}) {
      return syncGlobalCategoryTreeFromOnlineShop(payload);
    },

    async getChildCategories(payload = {}) {
      return getChildCategories(payload);
    },

    async searchCategories(payload = {}) {
      return searchCategories(payload);
    }
  };
}

module.exports = {
  createOperationsProductCategoryService
};
