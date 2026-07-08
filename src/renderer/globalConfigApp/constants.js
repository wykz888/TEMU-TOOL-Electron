export const DEFAULT_ROOT_PREFIX = 'TEMU_Resources_Data';
export const DEFAULT_AI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const DEFAULT_AI_MODEL = 'doubao-seed-2-0-mini-260428';
export const DEFAULT_PRIMARY_COLOR = '#3b82f6';
export const DEFAULT_GENERAL_THEME = 'light';
export const DEFAULT_ACCENT_THEME = 'ocean-blue';
export const DEFAULT_UPDATE_CHANNEL = 'latest';

export const AI_BASE_URL_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'https://ark.cn-beijing.volces.com/api/v3',
    label: '\u706b\u5c71\u5f15\u64ce - \u5317\u4eac'
  })
]);

export const AI_MODEL_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'doubao-seed-2-0-mini-260428',
    label: 'doubao-seed-2-0-mini-260428'
  })
]);

export const GLOBAL_CONFIG_TABS = Object.freeze([
  Object.freeze({
    key: 'appearance',
    title: '\u901a\u7528\u8bbe\u7f6e',
    subtitle: '\u901a\u7528',
    icon: 'settings'
  }),
  Object.freeze({
    key: 'storage',
    title: '\u5b58\u50a8\u7d20\u6750',
    subtitle: '\u5b58\u50a8\u4e0e\u7d20\u6750',
    icon: 'storage'
  }),
  Object.freeze({
    key: 'ai',
    title: 'AI \u914d\u7f6e',
    subtitle: 'AI',
    icon: 'robot'
  }),
  Object.freeze({
    key: 'update',
    title: '\u66f4\u65b0\u8bbe\u7f6e',
    subtitle: '\u66f4\u65b0',
    icon: 'sync'
  })
]);

export const APPEARANCE_PRESET_COLORS = Object.freeze([
  Object.freeze({
    key: 'temu-orange',
    label: 'TEMU \u6D3B\u529B\u6A59',
    value: '#ff7a00'
  }),
  Object.freeze({
    key: 'temu-coral',
    label: 'TEMU \u73CA\u745A\u7EA2',
    value: '#ff5c4a'
  }),
  Object.freeze({
    key: 'amber-gold',
    label: '\u7425\u73C0\u91D1',
    value: '#d4a038'
  }),
  Object.freeze({
    key: 'coral-orange',
    label: '\u73CA\u745A\u6A59',
    value: '#e8744a'
  }),
  Object.freeze({
    key: 'ocean-blue',
    label: '\u6DF1\u6D77\u84DD',
    value: '#3b82f6'
  }),
  Object.freeze({
    key: 'indigo',
    label: '\u975B\u84DD',
    value: '#6366f1'
  }),
  Object.freeze({
    key: 'emerald',
    label: '\u7FE0\u7EFF',
    value: '#10b981'
  }),
  Object.freeze({
    key: 'teal',
    label: '\u9752\u78A7',
    value: '#14b8a6'
  }),
  Object.freeze({
    key: 'violet',
    label: '\u7D2B\u7F57\u5170',
    value: '#8b5cf6'
  }),
  Object.freeze({
    key: 'slate',
    label: '\u5CA9\u7070',
    value: '#64748b'
  })
]);

export const APPEARANCE_PRESET_OPTIONS = APPEARANCE_PRESET_COLORS.map(p => ({
  value: p.key,
  label: p.label
}));



export const GENERAL_THEME_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'light',
    label: '\u6D45\u8272\u6A21\u5F0F'
  }),
  Object.freeze({
    value: 'dark',
    label: '\u6DF1\u8272\u6A21\u5F0F'
  })
]);

export const UPDATE_CHANNEL_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'latest',
    label: '\u6B63\u5F0F\u7248'
  }),
  Object.freeze({
    value: 'beta',
    label: '\u6D4B\u8BD5\u7248'
  })
]);
