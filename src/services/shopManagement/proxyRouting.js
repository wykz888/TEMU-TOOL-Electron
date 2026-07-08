const DIRECT_RESOURCE_TYPES = Object.freeze({
  script: 'script',
  style: 'style',
  font: 'font',
  image: 'image',
  video: 'video'
});

const DIRECT_RESOURCE_TYPE_KEYS = Object.freeze(Object.values(DIRECT_RESOURCE_TYPES));
const DEFAULT_PROXY_BYPASS_RULES = Object.freeze(['<local>', 'localhost', '127.0.0.1']);

function normalizeText(value) {
  return String(value || '').trim();
}

function uniqueItems(values) {
  const nextValues = [];
  const seen = new Set();

  values.forEach((value) => {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return;
    }

    const dedupeKey = normalizedValue.toLowerCase();

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    nextValues.push(normalizedValue);
  });

  return nextValues;
}

function splitProxyBypassRules(value) {
  if (Array.isArray(value)) {
    return uniqueItems(value);
  }

  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return [];
  }

  return uniqueItems(normalizedValue.split(/[\r\n,;，；]+/u));
}

function normalizeProxyBypassRules(value) {
  return splitProxyBypassRules(value).join(',');
}

function mergeProxyBypassRules(...values) {
  return uniqueItems(values.flatMap((value) => splitProxyBypassRules(value)));
}

function normalizeBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (['1', 'true', 'on', 'enable', 'enabled', 'yes'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'off', 'disable', 'disabled', 'no'].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

function normalizeProxyDirectResourceTypes(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    script: normalizeBooleanFlag(source.script, false),
    style: normalizeBooleanFlag(source.style, false),
    font: normalizeBooleanFlag(source.font, false),
    image: normalizeBooleanFlag(source.image, false),
    video: normalizeBooleanFlag(source.video, false)
  };
}

function hasEnabledProxyDirectResourceTypes(value) {
  const normalizedValue = normalizeProxyDirectResourceTypes(value);
  return DIRECT_RESOURCE_TYPE_KEYS.some((key) => normalizedValue[key] === true);
}

module.exports = {
  DIRECT_RESOURCE_TYPES,
  DIRECT_RESOURCE_TYPE_KEYS,
  DEFAULT_PROXY_BYPASS_RULES,
  splitProxyBypassRules,
  normalizeProxyBypassRules,
  mergeProxyBypassRules,
  normalizeProxyDirectResourceTypes,
  hasEnabledProxyDirectResourceTypes
};
