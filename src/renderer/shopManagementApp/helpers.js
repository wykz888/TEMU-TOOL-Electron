import { DIRECT_RESOURCE_OPTIONS, FALLBACK_GROUP_NAME } from './constants';

const DIRECT_RESOURCE_LABELS = Object.freeze(
  DIRECT_RESOURCE_OPTIONS.reduce((result, option) => {
    result[option.key] = option.label;
    return result;
  }, {})
);

const PROXY_LABELS = Object.freeze({
  local: '\u672c\u5730\u7f51\u7edc',
  socks5: 'SOCKS5',
  http: 'HTTP',
  https: 'HTTPS'
});

export function normalizeText(value) {
  return String(value || '').trim();
}

export function createEmptyState() {
  return {
    groups: [],
    shops: []
  };
}

export function createInitialShopForm() {
  return {
    accountValue: '',
    shopName: '',
    platformShopId: '',
    loginPassword: '',
    note: '',
    groupId: '',
    isVisible: true,
    browserStorageAutoSyncEnabled: true,
    proxyType: 'local',
    proxyHost: '',
    proxyPort: '',
    proxyUsername: '',
    proxyPassword: '',
    proxyBypassRules: '',
    directResourceTypes: createEmptyDirectResourceTypes(),
    fingerprintSeed: ''
  };
}

export function createEmptyDirectResourceTypes() {
  return {
    script: false,
    style: false,
    font: false,
    image: false,
    video: false
  };
}

export function ensureDirectResourceTypes(target) {
  if (!target || typeof target !== 'object') {
    return createEmptyDirectResourceTypes();
  }

  if (!target.directResourceTypes || typeof target.directResourceTypes !== 'object') {
    target.directResourceTypes = createEmptyDirectResourceTypes();
    return target.directResourceTypes;
  }

  const nextValue = target.directResourceTypes;

  nextValue.script = nextValue.script === true;
  nextValue.style = nextValue.style === true;
  nextValue.font = nextValue.font === true;
  nextValue.image = nextValue.image === true;
  nextValue.video = nextValue.video === true;

  return nextValue;
}

export function resetShopForm(target) {
  Object.assign(target, createInitialShopForm());
}

export function splitBypassRules(value) {
  return normalizeText(value)
    .split(/[\r\n,;\uFF0C\uFF1B]+/u)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export function getEnabledDirectResourceLabels(directResourceTypes) {
  const source = directResourceTypes && typeof directResourceTypes === 'object'
    ? directResourceTypes
    : {};

  return Object.entries(DIRECT_RESOURCE_LABELS)
    .filter(([key]) => source[key] === true)
    .map(([, label]) => label);
}

export function formatProxySummary(proxyConfig) {
  const normalizedType = normalizeText(proxyConfig && proxyConfig.type) || 'local';
  const label = PROXY_LABELS[normalizedType] || PROXY_LABELS.local;

  if (normalizedType === 'local') {
    return {
      title: label,
      note: '\u4f7f\u7528\u672c\u5730\u7f51\u7edc'
    };
  }

  const host = normalizeText(proxyConfig && proxyConfig.host) || '-';
  const port = normalizeText(proxyConfig && proxyConfig.port) || '-';
  const username = normalizeText(proxyConfig && proxyConfig.username) || '-';
  const noteParts = [`\u8d26\u53f7\uff1a${username}`];
  const bypassRuleCount = splitBypassRules(proxyConfig && proxyConfig.bypassRules).length;
  const directResourceLabels = getEnabledDirectResourceLabels(
    proxyConfig && proxyConfig.directResourceTypes
  );

  if (bypassRuleCount > 0) {
    noteParts.push(`\u76f4\u8fde\u89c4\u5219\uff1a${bypassRuleCount} \u6761`);
  }

  if (directResourceLabels.length > 0) {
    noteParts.push(`\u8d44\u6e90\u76f4\u8fde\uff1a${directResourceLabels.join('/')}`);
  }

  return {
    title: `${label} ${host}:${port}`,
    note: noteParts.join(' · ')
  };
}

export function buildGeneratedFingerprintSeed({ shopId = '', accountValue = '', shopName = '' }) {
  const stableSegment = [shopId, accountValue, shopName]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const randomSegment = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  return `${stableSegment || 'shop'}-${randomSegment}`.slice(0, 128);
}

export function ensureFingerprintSeed(formState, context = {}) {
  const currentSeed = normalizeText(formState && formState.fingerprintSeed);

  if (currentSeed) {
    return currentSeed;
  }

  const nextSeed = buildGeneratedFingerprintSeed({
    shopId: context.shopId,
    accountValue: formState && formState.accountValue,
    shopName: formState && formState.shopName
  });

  formState.fingerprintSeed = nextSeed;
  return nextSeed;
}

export function createProxyPayload(formState) {
  const directResourceTypes = ensureDirectResourceTypes(formState);

  return {
    proxyType: normalizeText(formState.proxyType) || 'local',
    proxyHost: normalizeText(formState.proxyHost),
    proxyPort: normalizeText(formState.proxyPort),
    proxyUsername: normalizeText(formState.proxyUsername),
    proxyPassword: normalizeText(formState.proxyPassword),
    proxyBypassRules: normalizeText(formState.proxyBypassRules),
    proxyDirectScriptEnabled: directResourceTypes.script === true,
    proxyDirectStyleEnabled: directResourceTypes.style === true,
    proxyDirectFontEnabled: directResourceTypes.font === true,
    proxyDirectImageEnabled: directResourceTypes.image === true,
    proxyDirectVideoEnabled: directResourceTypes.video === true
  };
}

export function createShopPayload(formState, context = {}) {
  return {
    accountValue: normalizeText(formState.accountValue),
    phoneNumber: normalizeText(formState.accountValue),
    platformShopId: normalizeText(formState.platformShopId),
    shopName: normalizeText(formState.shopName),
    loginPassword: normalizeText(formState.loginPassword),
    note: normalizeText(formState.note),
    groupId: normalizeText(formState.groupId),
    isVisible: formState.isVisible === true,
    browserStorageAutoSyncEnabled: formState.browserStorageAutoSyncEnabled === true,
    fingerprintMode: 'custom',
    fingerprintSeed: ensureFingerprintSeed(formState, context),
    ...createProxyPayload(formState)
  };
}

export function applyShopDetail(target, detail) {
  const nextDetail = detail || {};
  const proxyConfig = nextDetail.proxyConfig || {};
  const directResourceTypes = proxyConfig.directResourceTypes || {};
  const fingerprintConfig = nextDetail.fingerprintConfig || {};

  target.accountValue = nextDetail.accountValue || nextDetail.phoneNumber || nextDetail.email || '';
  target.shopName = nextDetail.shopName || '';
  target.platformShopId = nextDetail.platformShopId || '';
  target.loginPassword = nextDetail.loginPassword || '';
  target.note = nextDetail.note || '';
  target.groupId = nextDetail.groupId || '';
  target.isVisible = nextDetail.isVisible !== false;
  target.browserStorageAutoSyncEnabled =
    nextDetail.browserStorageAutoSyncEnabled !== false;
  target.proxyType = proxyConfig.type || 'local';
  target.proxyHost = proxyConfig.host || '';
  target.proxyPort = proxyConfig.port || '';
  target.proxyUsername = proxyConfig.username || '';
  target.proxyPassword = proxyConfig.password || '';
  target.proxyBypassRules = proxyConfig.bypassRules || '';
  target.directResourceTypes = {
    script: directResourceTypes.script === true,
    style: directResourceTypes.style === true,
    font: directResourceTypes.font === true,
    image: directResourceTypes.image === true,
    video: directResourceTypes.video === true
  };
  target.fingerprintSeed = normalizeText(fingerprintConfig.fingerprintSeed)
    || normalizeText(fingerprintConfig.profileKey)
    || '';
}

export function buildEditableFallbackFromRow(row) {
  return {
    id: row.id,
    platformShopId: row.platformShopId,
    phoneNumber: row.accountValue,
    email: row.email,
    accountValue: row.accountValue,
    shopName: row.shopName,
    loginPassword: '',
    note: row.note,
    groupId: row.groupId,
    groupName: row.groupName || FALLBACK_GROUP_NAME,
    proxyConfig: row.proxyConfig || {},
    fingerprintConfig: row.fingerprintConfig || {},
    isVisible: row.isVisible !== false,
    browserStorageAutoSyncEnabled: row.browserStorageAutoSyncEnabled !== false
  };
}
