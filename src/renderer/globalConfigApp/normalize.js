import {
  DEFAULT_ACCENT_THEME,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_GENERAL_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ROOT_PREFIX,
  DEFAULT_UPDATE_CHANNEL
} from './constants';

export function createClientId() {
  return window.crypto && typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeStorageConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const providers = source.providers && typeof source.providers === 'object' ? source.providers : {};

  return {
    version: 1,
    activeProvider: source.activeProvider === 'cloudflare-r2' ? 'cloudflare-r2' : 'tencent-cos',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    providers: {
      tencentCos: {
        enabled: !(providers.tencentCos && providers.tencentCos.enabled === false),
        secretId: String((providers.tencentCos && providers.tencentCos.secretId) || ''),
        secretKey: String((providers.tencentCos && providers.tencentCos.secretKey) || ''),
        bucket: String((providers.tencentCos && providers.tencentCos.bucket) || ''),
        region: String((providers.tencentCos && providers.tencentCos.region) || ''),
        rootPrefix: String((providers.tencentCos && providers.tencentCos.rootPrefix) || DEFAULT_ROOT_PREFIX),
        protocol: String((providers.tencentCos && providers.tencentCos.protocol) || 'https:')
      },
      cloudflareR2: {
        enabled: Boolean(providers.cloudflareR2 && providers.cloudflareR2.enabled),
        accountId: String((providers.cloudflareR2 && providers.cloudflareR2.accountId) || ''),
        accessKeyId: String((providers.cloudflareR2 && providers.cloudflareR2.accessKeyId) || ''),
        secretAccessKey: String((providers.cloudflareR2 && providers.cloudflareR2.secretAccessKey) || ''),
        apiToken: String((providers.cloudflareR2 && providers.cloudflareR2.apiToken) || ''),
        bucket: String((providers.cloudflareR2 && providers.cloudflareR2.bucket) || ''),
        endpoint: String((providers.cloudflareR2 && providers.cloudflareR2.endpoint) || ''),
        publicBaseUrl: String((providers.cloudflareR2 && providers.cloudflareR2.publicBaseUrl) || ''),
        rootPrefix: String((providers.cloudflareR2 && providers.cloudflareR2.rootPrefix) || DEFAULT_ROOT_PREFIX)
      }
    }
  };
}

export function normalizeAiConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const providers = source.providers && typeof source.providers === 'object' ? source.providers : {};
  const volcengine = providers.volcengine && typeof providers.volcengine === 'object' ? providers.volcengine : {};

  return {
    version: 1,
    activeProvider: 'volcengine',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    providers: {
      volcengine: {
        enabled: volcengine.enabled !== false,
        apiBaseUrl: String(volcengine.apiBaseUrl || DEFAULT_AI_BASE_URL),
        model: String(volcengine.model || DEFAULT_AI_MODEL),
        apiKeys: Array.isArray(volcengine.apiKeys)
          ? volcengine.apiKeys.map((item, index) => ({
            id: String((item && item.id) || createClientId()),
            name: String((item && item.name) || `APIKEY ${index + 1}`),
            apiKey: String((item && item.apiKey) || ''),
            enabled: !(item && item.enabled === false),
            lastTestedAt: String((item && item.lastTestedAt) || ''),
            lastTestStatus: item && (item.lastTestStatus === 'success' || item.lastTestStatus === 'error')
              ? item.lastTestStatus
              : 'untested',
            lastTestMessage: String((item && item.lastTestMessage) || '')
          }))
          : []
      }
    }
  };
}

export function normalizeHexColor(value) {
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

export function normalizeThemeAppearance(config) {
  const source = config && typeof config === 'object' ? config : {};

  return {
    primaryColor: normalizeHexColor(source.primaryColor),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : ''
  };
}

export function normalizeGeneralSettings(config) {
  const source = config && typeof config === 'object' ? config : {};

  return {
    theme: source.theme === 'dark' ? 'dark' : DEFAULT_GENERAL_THEME,
    accentTheme: typeof source.accentTheme === 'string' && source.accentTheme.trim()
      ? source.accentTheme.trim()
      : DEFAULT_ACCENT_THEME,
    restoreWindow: source.restoreWindow !== false,
    autoSync: source.autoSync !== false,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : ''
  };
}

export function normalizeUpdateSettings(config) {
  const source = config && typeof config === 'object' ? config : {};

  return {
    autoCheck: source.autoCheck !== false,
    channel: source.channel === 'beta' ? 'beta' : DEFAULT_UPDATE_CHANNEL,
    differential: source.differential !== false,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : ''
  };
}

export function formatUpdatedAt(value) {
  if (!value) {
    return '\u672a\u4fdd\u5b58';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '\u672a\u4fdd\u5b58';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function getErrorMessage(error, fallback) {
  const raw = (error && typeof error.message === 'string' && error.message.trim())
    ? error.message.trim()
    : '';

  if (!raw) {
    return fallback;
  }

  if (/[\u4e00-\u9fff]/u.test(raw)) {
    return raw;
  }

  if (/session/i.test(raw) || /partition/i.test(raw) || /IPC/i.test(raw) || /electron/i.test(raw) || /preload/i.test(raw)) {
    return fallback;
  }

  if (/ERR_CONNECTION/i.test(raw) || /ECONNREFUSED/i.test(raw) || /ETIMEDOUT/i.test(raw) || /ENOTFOUND/i.test(raw)) {
    return '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002';
  }

  return raw;
}

export function buildMaskedApiKey(value) {
  const text = String(value || '');

  if (!text) {
    return '';
  }

  return '\u2022'.repeat(Math.max(12, text.length));
}
