const DEFAULT_GENERAL_THEME = 'light';
const DEFAULT_ACCENT_THEME = 'ocean-blue';
const DEFAULT_UPDATE_CHANNEL = 'latest';

const ACCENT_THEME_KEYS = Object.freeze([
  'amber-gold',
  'coral-orange',
  'ocean-blue',
  'indigo',
  'emerald',
  'teal',
  'violet',
  'slate'
]);

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value, fallback) {
  return value === undefined ? fallback : value === true;
}

function normalizeGeneralTheme(value) {
  return value === 'dark' ? 'dark' : DEFAULT_GENERAL_THEME;
}

function normalizeAccentTheme(value) {
  const text = normalizeText(value);

  return ACCENT_THEME_KEYS.includes(text) ? text : DEFAULT_ACCENT_THEME;
}

function normalizeUpdateChannel(value) {
  return value === 'beta' ? 'beta' : DEFAULT_UPDATE_CHANNEL;
}

function normalizeGeneralSettingsPayload(value) {
  const record = isRecord(value) ? value : {};

  return {
    theme: normalizeGeneralTheme(record.theme),
    accentTheme: normalizeAccentTheme(record.accentTheme),
    restoreWindow: normalizeBoolean(record.restoreWindow, true),
    autoSync: normalizeBoolean(record.autoSync, true),
    updatedAt: normalizeText(record.updatedAt)
  };
}

function normalizeUpdateSettingsPayload(value) {
  const record = isRecord(value) ? value : {};

  return {
    autoCheck: normalizeBoolean(record.autoCheck, true),
    channel: normalizeUpdateChannel(record.channel),
    differential: normalizeBoolean(record.differential, true),
    updatedAt: normalizeText(record.updatedAt)
  };
}

module.exports = {
  DEFAULT_ACCENT_THEME,
  DEFAULT_GENERAL_THEME,
  DEFAULT_UPDATE_CHANNEL,
  normalizeGeneralSettingsPayload,
  normalizeUpdateSettingsPayload
};
