const ENABLED_STATUS_LABEL = '\u5f00\u542f';
const UNGROUPED_LABEL = '\u672a\u5206\u7ec4';

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeVisibleFlag(value) {
  return value !== false;
}

function normalizeShopRow(shop) {
  const shopId = normalizeText(shop && shop.id);
  const shopName = normalizeText(shop && shop.shopName);

  if (!shopId || !shopName || !normalizeVisibleFlag(shop && shop.isVisible)) {
    return null;
  }

  return {
    id: shopId,
    shopName,
    groupName: normalizeText(shop && shop.groupName) || UNGROUPED_LABEL,
    note: normalizeText(shop && shop.note),
    statusLabel: ENABLED_STATUS_LABEL,
    updatedAt: normalizeText(shop && shop.updatedAt)
  };
}

export function buildPromotionMonitorShopRows(state) {
  return (Array.isArray(state && state.shops) ? state.shops : [])
    .map(normalizeShopRow)
    .filter(Boolean)
    .sort((left, right) => (
      left.groupName.localeCompare(right.groupName, 'zh-CN')
      || left.shopName.localeCompare(right.shopName, 'zh-CN')
    ));
}
