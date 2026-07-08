export const PROXY_TYPE_OPTIONS = Object.freeze([
  { value: 'local', label: '\u672c\u5730\u7f51\u7edc' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' }
]);

export const DIRECT_RESOURCE_OPTIONS = Object.freeze([
  { key: 'script', label: 'JS' },
  { key: 'style', label: 'CSS' },
  { key: 'font', label: '\u5b57\u4f53' },
  { key: 'image', label: '\u56fe\u7247' },
  { key: 'video', label: '\u89c6\u9891' }
]);

export const FALLBACK_GROUP_NAME = '\u672a\u5206\u7ec4';
