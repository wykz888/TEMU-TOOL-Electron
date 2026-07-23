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

export const SHOP_MANAGEMENT_TABLE_COLUMNS = Object.freeze([
  {
    title: '\u624b\u673a\u53f7/\u90ae\u7bb1\u8d26\u53f7',
    slotName: 'account',
    width: 190
  },
  {
    title: '\u5e97\u94fa\u540d\u79f0',
    slotName: 'shopName',
    width: 180
  },
  {
    title: '\u5e73\u53f0\u5e97\u94faID',
    slotName: 'platformShopId',
    width: 150
  },
  {
    title: '\u5e97\u94fa\u5206\u7ec4',
    slotName: 'groupName',
    width: 140
  },
  {
    title: '\u4ee3\u7406\u8bbe\u7f6e',
    slotName: 'proxy',
    width: 250
  },
  {
    title: '\u5e97\u94fa\u72b6\u6001',
    slotName: 'visibility',
    width: 120
  },
  {
    title: '\u5e97\u94fa\u5907\u6ce8',
    slotName: 'note',
    ellipsis: true
  },
  {
    title: '\u64cd\u4f5c',
    slotName: 'actions',
    width: 96,
    fixed: 'right'
  }
]);
