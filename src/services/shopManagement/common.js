const crypto = require('node:crypto');
const { normalizeFingerprintConfig } = require('./fingerprintProfile');
const {
  normalizeProxyBypassRules,
  normalizeProxyDirectResourceTypes
} = require('./proxyRouting');
const {
  resolveAccountIdentity,
  withNormalizedAccountIdentity
} = require('./accountIdentity');

const PROXY_TYPES = Object.freeze({
  local: 'local',
  socks5: 'socks5',
  http: 'http',
  https: 'https'
});

const DEFAULT_STATUS = '\u672A\u542F\u7528';
const FALLBACK_GROUP_NAME = '\u672A\u5206\u7EC4';
const INDEX_VERSION = 1;
const FINGERPRINT_CONFIG_CACHE = new Map();
const FINGERPRINT_CONFIG_CACHE_MAX = 64;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUsername(value) {
  return normalizeText(value).toLowerCase();
}

function createHash(value, length = 12) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

function createSlug(value, fallback = 'item') {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function createEntityId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeProxyType(value) {
  const normalized = normalizeText(value).toLowerCase();

  if (Object.values(PROXY_TYPES).includes(normalized)) {
    return normalized;
  }

  return PROXY_TYPES.local;
}

function normalizeVisibleFlag(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if ([
    '0',
    'false',
    'hidden',
    'hide',
    'close',
    'closed',
    'disable',
    'disabled',
    '\u9690\u85CF',
    '\u5173\u95ED'
  ].includes(normalized)) {
    return false;
  }

  if ([
    '1',
    'true',
    'visible',
    'show',
    'open',
    'opened',
    'enable',
    'enabled',
    '\u663E\u793A',
    '\u5F00\u542F',
    '\u542F\u7528'
  ].includes(normalized)) {
    return true;
  }

  return fallback;
}

function isShopParticipating(shop, fallback = true) {
  if (!shop || typeof shop !== 'object') {
    return false;
  }

  return normalizeVisibleFlag(shop.isVisible, fallback) !== false;
}

function isShopClosed(shop, fallback = false) {
  return isShopParticipating(shop, !fallback) !== true;
}

function normalizeBrowserStorageAutoSyncEnabled(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if ([
    '0',
    'false',
    'off',
    'disable',
    'disabled',
    '\u5173\u95ED'
  ].includes(normalized)) {
    return false;
  }

  if ([
    '1',
    'true',
    'on',
    'enable',
    'enabled',
    'auto',
    '\u5F00\u542F'
  ].includes(normalized)) {
    return true;
  }

  return fallback;
}

function toTimestamp(value, fallback = '') {
  const normalized = normalizeText(value);

  if (!normalized) {
    return fallback || nowIso();
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? (fallback || nowIso()) : date.toISOString();
}

function compareByCreatedAtAsc(left, right) {
  return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
}

function compareByCreatedAtDesc(left, right) {
  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
}

function buildOwnerDescriptor(session) {
  const username = normalizeText(session && session.username);

  if (!username) {
    throw new Error('\u5F53\u524D\u672A\u767B\u5F55\uFF0C\u8BF7\u5148\u5B8C\u6210\u767B\u5F55\u3002');
  }

  const normalizedUsername = normalizeUsername(username);

  return {
    userId: normalizeText(session && session.userId) || createHash(normalizedUsername, 32),
    username,
    normalizedUsername,
    userKey: `${createSlug(normalizedUsername, 'user')}_${createHash(normalizedUsername, 16)}`
  };
}

function buildShopRecordKey(shop) {
  const accountIdentity = resolveAccountIdentity(shop);
  const nameSegment = createSlug(shop.shopName || accountIdentity.accountValue || shop.id, 'shop');
  return `shops/${nameSegment}_${shop.id}.json`;
}

function normalizeGroupRecord(group) {
  const createdAt = toTimestamp(group && group.createdAt);

  return {
    id: normalizeText(group && group.id),
    name: normalizeText(group && group.name),
    createdAt,
    updatedAt: toTimestamp(group && group.updatedAt, createdAt)
  };
}

function buildFingerprintCacheKey(item) {
  const shopId = normalizeText(item && item.id);
  const accountIdentity = resolveAccountIdentity(item);
  const shopName = normalizeText(item && item.shopName);
  const proxyType = normalizeText(item && (item.proxyType || (item.proxyConfig && item.proxyConfig.type)));
  const proxyHost = normalizeText(item && (item.proxyHost || (item.proxyConfig && item.proxyConfig.host)));

  return `${shopId}|${accountIdentity.accountValue}|${shopName}|${proxyType}|${proxyHost}`;
}

function resolveCachedFingerprintConfig(item) {
  const cacheKey = buildFingerprintCacheKey(item);

  if (FINGERPRINT_CONFIG_CACHE.has(cacheKey)) {
    return FINGERPRINT_CONFIG_CACHE.get(cacheKey);
  }

  const config = normalizeFingerprintConfig(item && item.fingerprintConfig, {
    shopId: item && item.id,
    phoneNumber: resolveAccountIdentity(item).accountValue,
    shopName: item && item.shopName
  }, {
    proxyConfig: {
      type: item && (item.proxyType || (item.proxyConfig && item.proxyConfig.type)),
      host: item && (item.proxyHost || (item.proxyConfig && item.proxyConfig.host)),
      username: item && (item.proxyUsername || (item.proxyConfig && item.proxyConfig.username))
    }
  });

  if (FINGERPRINT_CONFIG_CACHE.size >= FINGERPRINT_CONFIG_CACHE_MAX) {
    const firstKey = FINGERPRINT_CONFIG_CACHE.keys().next().value;
    FINGERPRINT_CONFIG_CACHE.delete(firstKey);
  }

  FINGERPRINT_CONFIG_CACHE.set(cacheKey, config);
  return config;
}

function invalidateFingerprintConfigCache(item) {
  FINGERPRINT_CONFIG_CACHE.delete(buildFingerprintCacheKey(item));
}

function normalizeShopSummary(item) {
  const accountIdentity = resolveAccountIdentity(item);
  const proxyType = normalizeProxyType(item && (item.proxyType || (item.proxyConfig && item.proxyConfig.type)));
  const createdAt = toTimestamp(item && item.createdAt);
  const fingerprintConfig = resolveCachedFingerprintConfig(item);

  return {
    id: normalizeText(item && item.id),
    platformShopId: normalizeText(
      item && (
        item.platformShopId
        || item.mallId
        || item.shopPlatformId
      )
    ),
    platformShopUniqueId: normalizeText(
      item && (
        item.platformShopUniqueId
        || item.mallUniqueId
        || item.shopPlatformUniqueId
        || item.uniqueId
      )
    ),
    recordKey: normalizeText(item && item.recordKey),
    phoneNumber: accountIdentity.phoneNumber,
    email: accountIdentity.email,
    accountValue: accountIdentity.accountValue,
    accountType: accountIdentity.accountType,
    shopName: normalizeText(item && item.shopName),
    note: normalizeText(item && item.note),
    groupId: normalizeText(item && item.groupId),
    groupName: normalizeText(item && item.groupName) || FALLBACK_GROUP_NAME,
    proxyType,
    proxyEnabled: proxyType !== PROXY_TYPES.local,
    proxyHost: normalizeText(item && (item.proxyHost || (item.proxyConfig && item.proxyConfig.host))),
    proxyPort: normalizeText(item && (item.proxyPort || (item.proxyConfig && item.proxyConfig.port))),
    proxyUsername: normalizeText(item && (item.proxyUsername || (item.proxyConfig && item.proxyConfig.username))),
    proxyBypassRules: normalizeProxyBypassRules(
      item && (item.proxyBypassRules || (item.proxyConfig && item.proxyConfig.bypassRules))
    ),
    proxyDirectResourceTypes: normalizeProxyDirectResourceTypes(
      item && (item.proxyDirectResourceTypes || (item.proxyConfig && item.proxyConfig.directResourceTypes))
    ),
    fingerprintConfig,
    isVisible: normalizeVisibleFlag(item && item.isVisible, true),
    browserStorageAutoSyncEnabled: normalizeBrowserStorageAutoSyncEnabled(
      item && item.browserStorageAutoSyncEnabled,
      true
    ),
    status: normalizeText(item && item.status) || DEFAULT_STATUS,
    proxyVerifiedAt: normalizeText(item && item.proxyVerifiedAt),
    createdAt,
    updatedAt: toTimestamp(item && item.updatedAt, createdAt)
  };
}

function buildEmptyIndex(owner) {
  return {
    version: INDEX_VERSION,
    owner: { ...owner },
    groups: [],
    shops: [],
    updatedAt: nowIso()
  };
}

function normalizeIndexRecord(indexRecord, owner) {
  const groups = Array.isArray(indexRecord && indexRecord.groups)
    ? indexRecord.groups.map(normalizeGroupRecord).filter((group) => group.id && group.name)
    : [];

  const shops = Array.isArray(indexRecord && indexRecord.shops)
    ? indexRecord.shops
      .map(normalizeShopSummary)
      .filter((shop) => shop.id && shop.accountValue && shop.shopName && shop.recordKey)
    : [];

  return {
    version: INDEX_VERSION,
    owner: { ...owner },
    groups: groups.sort(compareByCreatedAtAsc),
    shops: shops.sort(compareByCreatedAtDesc),
    updatedAt: toTimestamp(indexRecord && indexRecord.updatedAt)
  };
}

function buildProxyLabel(shop) {
  if (shop.proxyType === PROXY_TYPES.local) {
    return '\u672C\u5730\u7F51\u7EDC';
  }

  return `${shop.proxyType.toUpperCase()} ${shop.proxyHost || '-'}:${shop.proxyPort || '-'}`;
}

function toRendererState(indexRecord) {
  return {
    updatedAt: normalizeText(indexRecord && indexRecord.updatedAt),
    groups: (indexRecord && indexRecord.groups ? indexRecord.groups : []).map((group) => ({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    })),
    shops: (indexRecord && indexRecord.shops ? indexRecord.shops : []).map((shop) => ({
      id: shop.id,
      platformShopId: shop.platformShopId,
      platformShopUniqueId: shop.platformShopUniqueId,
      phoneNumber: shop.accountValue || shop.phoneNumber || shop.email,
      email: shop.email,
      accountValue: shop.accountValue || shop.phoneNumber || shop.email,
      accountType: shop.accountType || (shop.email ? 'email' : 'phone'),
      shopName: shop.shopName,
      note: shop.note,
      groupId: shop.groupId,
      groupName: shop.groupName,
      proxyEnabled: shop.proxyEnabled,
      proxyLabel: buildProxyLabel(shop),
      proxyConfig: {
        type: shop.proxyType,
        host: shop.proxyHost,
        port: shop.proxyPort,
        username: shop.proxyUsername,
        password: '',
        bypassRules: shop.proxyBypassRules,
        directResourceTypes: {
          ...shop.proxyDirectResourceTypes
        }
      },
      fingerprintConfig: {
        mode: shop.fingerprintConfig.mode,
        fingerprintSeed: shop.fingerprintConfig.fingerprintSeed,
        profileKey: shop.fingerprintConfig.profileKey,
        userAgent: shop.fingerprintConfig.userAgent,
        platform: shop.fingerprintConfig.platform,
        language: shop.fingerprintConfig.language,
        languages: shop.fingerprintConfig.languages.slice(),
        timezone: shop.fingerprintConfig.timezone,
        screen: {
          width: shop.fingerprintConfig.screen.width,
          height: shop.fingerprintConfig.screen.height,
          availWidth: shop.fingerprintConfig.screen.availWidth,
          availHeight: shop.fingerprintConfig.screen.availHeight,
          colorDepth: shop.fingerprintConfig.screen.colorDepth,
          pixelDepth: shop.fingerprintConfig.screen.pixelDepth
        },
        hardwareConcurrency: shop.fingerprintConfig.hardwareConcurrency,
        deviceMemory: shop.fingerprintConfig.deviceMemory,
        devicePixelRatio: shop.fingerprintConfig.devicePixelRatio,
        vendor: shop.fingerprintConfig.vendor,
        productSub: shop.fingerprintConfig.productSub,
        doNotTrack: shop.fingerprintConfig.doNotTrack,
        maxTouchPoints: shop.fingerprintConfig.maxTouchPoints,
        webglVendor: shop.fingerprintConfig.webglVendor,
        webglRenderer: shop.fingerprintConfig.webglRenderer
      },
      isVisible: isShopParticipating(shop),
      browserStorageAutoSyncEnabled: shop.browserStorageAutoSyncEnabled !== false,
      status: shop.status,
      proxyVerifiedAt: shop.proxyVerifiedAt,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt
    }))
  };
}

module.exports = {
  PROXY_TYPES,
  DEFAULT_STATUS,
  FALLBACK_GROUP_NAME,
  INDEX_VERSION,
  normalizeText,
  normalizeUsername,
  normalizeProxyType,
  normalizeVisibleFlag,
  isShopParticipating,
  isShopClosed,
  normalizeBrowserStorageAutoSyncEnabled,
  createEntityId,
  createSlug,
  createHash,
  nowIso,
  toTimestamp,
  buildOwnerDescriptor,
  buildShopRecordKey,
  normalizeGroupRecord,
  normalizeShopSummary,
  resolveAccountIdentity,
  withNormalizedAccountIdentity,
  invalidateFingerprintConfigCache,
  buildEmptyIndex,
  normalizeIndexRecord,
  toRendererState
};
