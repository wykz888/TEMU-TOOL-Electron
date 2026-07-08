const fs = require('node:fs');
const path = require('node:path');
const { getAppDataRoot } = require('../../utils/persistenceRoots');

const DEFAULT_THEME = 'light';
const DEFAULT_PRIMARY_COLOR = '#d4a038';
const FILE_NAME = 'theme-preference.json';

function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : DEFAULT_THEME;
}

function normalizeHexColor(value) {
  const text = String(value || '').trim();

  if (/^#?[0-9a-fA-F]{3}$/.test(text)) {
    const normalized = text.startsWith('#') ? text.slice(1) : text;
    return `#${normalized.split('').map((item) => `${item}${item}`).join('').toLowerCase()}`;
  }

  if (/^#?[0-9a-fA-F]{6}$/.test(text)) {
    const normalized = text.startsWith('#') ? text.slice(1) : text;
    return `#${normalized.toLowerCase()}`;
  }

  return DEFAULT_PRIMARY_COLOR;
}

function normalizeThemeAppearance(appearance) {
  const source = appearance && typeof appearance === 'object' ? appearance : {};

  return {
    primaryColor: normalizeHexColor(source.primaryColor)
  };
}

function createThemePreferenceService({ app }) {
  function getFilePath() {
    return path.join(
      getAppDataRoot(app),
      'local_state',
      'theme',
      FILE_NAME
    );
  }

  function readPayload() {
    try {
      const filePath = getFilePath();

      if (!fs.existsSync(filePath)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
      return null;
    }
  }

  function writePayload(payload) {
    const filePath = getFilePath();
    const directoryPath = path.dirname(filePath);

    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  return {
    getTheme() {
      const payload = readPayload();
      return normalizeTheme(payload && payload.theme);
    },
    getThemeAppearance() {
      const payload = readPayload();
      return {
        ...normalizeThemeAppearance(payload && payload.appearance),
        updatedAt: typeof (payload && payload.updatedAt) === 'string' ? payload.updatedAt : ''
      };
    },
    setTheme(theme) {
      const normalizedTheme = normalizeTheme(theme);
      const payload = readPayload();
      const normalizedAppearance = normalizeThemeAppearance(payload && payload.appearance);

      writePayload({
        theme: normalizedTheme,
        appearance: normalizedAppearance,
        updatedAt: new Date().toISOString()
      });

      return normalizedTheme;
    },
    setThemeAppearance(appearance) {
      const payload = readPayload();
      const normalizedTheme = normalizeTheme(payload && payload.theme);
      const normalizedAppearance = normalizeThemeAppearance(appearance);
      const updatedAt = new Date().toISOString();

      writePayload({
        theme: normalizedTheme,
        appearance: normalizedAppearance,
        updatedAt
      });

      return {
        ...normalizedAppearance,
        updatedAt
      };
    }
  };
}

module.exports = {
  createThemePreferenceService,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_THEME,
  normalizeHexColor,
  normalizeTheme,
  normalizeThemeAppearance
};

