const UNGROUPED_SECTION_ID = '__ungrouped__';

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function normalizeShopIds(shopIds) {
  const sourceItems = Array.isArray(shopIds)
    ? shopIds
    : [shopIds];

  return Array.from(
    new Set(
      sourceItems
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    )
  );
}

function normalizeGroupRecord(group) {
  return {
    id: normalizeText(group && group.id),
    name: normalizeText(group && group.name)
  };
}

function normalizeShopRecord(shop) {
  const groupId = normalizeText(shop && shop.groupId);
  const groupName = normalizeText(shop && shop.groupName) || '\u672a\u5206\u7ec4';
  const accountValue = normalizeText(
    shop && (shop.accountValue || shop.email || shop.phoneNumber)
  );
  const shopName = normalizeText(shop && shop.shopName);
  const note = normalizeText(shop && shop.note);

  return {
    id: normalizeText(shop && shop.id),
    shopName,
    accountValue,
    note,
    groupId,
    groupName,
    isVisible: !(shop && shop.isVisible === false),
    searchText: [shopName, accountValue, groupName, note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  };
}

export function buildEmptyShopCatalog() {
  return {
    updatedAt: '',
    shops: [],
    sections: [],
    shopMap: Object.create(null)
  };
}

export function buildShopCatalogFromState(rawState) {
  const catalog = buildEmptyShopCatalog();
  const groups = Array.isArray(rawState && rawState.groups)
    ? rawState.groups
      .map(normalizeGroupRecord)
      .filter((group) => group.id && group.name)
    : [];
  const shops = Array.isArray(rawState && rawState.shops)
    ? rawState.shops
      .map(normalizeShopRecord)
      .filter((shop) => shop.id && shop.shopName && shop.isVisible !== false)
    : [];
  const sections = groups.map((group) => ({
    id: group.id,
    label: group.name,
    shops: []
  }));
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const ungroupedSection = {
    id: UNGROUPED_SECTION_ID,
    label: '\u672a\u5206\u7ec4',
    shops: []
  };

  shops
    .sort((left, right) => (
      normalizeText(left.shopName).localeCompare(normalizeText(right.shopName), 'zh-CN')
    ))
    .forEach((shop) => {
      const section = sectionMap.get(shop.groupId) || ungroupedSection;

      section.shops.push(shop);
      catalog.shopMap[shop.id] = shop;
    });

  catalog.updatedAt = normalizeText(rawState && rawState.updatedAt);
  catalog.shops = shops;
  catalog.sections = sections.filter((section) => section.shops.length > 0);

  if (ungroupedSection.shops.length > 0) {
    catalog.sections.push(ungroupedSection);
  }

  return catalog;
}

function getShopManagementBridge() {
  if (
    window.temuApp
    && window.temuApp.shopManagement
    && typeof window.temuApp.shopManagement.getState === 'function'
  ) {
    return window.temuApp.shopManagement;
  }

  return null;
}

export async function loadShopCatalog() {
  const bridge = getShopManagementBridge();

  if (!bridge) {
    throw new Error('\u5e97\u94fa\u6570\u636e\u6a21\u5757\u672a\u52a0\u8f7d');
  }

  return buildShopCatalogFromState(await bridge.getState());
}
