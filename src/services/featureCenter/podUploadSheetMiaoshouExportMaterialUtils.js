const MATERIAL_SECTION_IDS = Object.freeze(['carousel', 'assets', 'preview']);

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeTextArray(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function splitSelection(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/[\n,;\uFF0C\u3001\uFF1B\s]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizePositiveInteger(value) {
  const text = normalizeText(value);

  if (!text || !/^\d+$/.test(text)) {
    return 0;
  }

  return Number.parseInt(text, 10) || 0;
}

function parseSequenceNumbers(value) {
  const values = splitSelection(value)
    .map((item) => normalizePositiveInteger(item))
    .filter((item) => item > 0);

  return Array.from(new Set(values));
}

function getMaterialItems(product, sectionId) {
  if (!MATERIAL_SECTION_IDS.includes(sectionId)) {
    return [];
  }

  return product && product.materials && Array.isArray(product.materials[sectionId])
    ? normalizeTextArray(product.materials[sectionId])
    : [];
}

function getMaterialImportOrderItems(product, sectionId) {
  if (!MATERIAL_SECTION_IDS.includes(sectionId)) {
    return [];
  }

  const source = product && product.materialImportOrderMap && Array.isArray(product.materialImportOrderMap[sectionId])
    ? normalizeTextArray(product.materialImportOrderMap[sectionId])
    : [];

  return source.length ? source : getMaterialItems(product, sectionId);
}

function resolveMaterialItemByName(product, sectionId, itemName) {
  const selectedName = normalizeText(itemName);
  const currentItems = getMaterialItems(product, sectionId);

  if (!selectedName) {
    return '';
  }

  const directItem = currentItems.find((item) => normalizeText(item) === selectedName);

  if (directItem) {
    return directItem;
  }

  const importOrderItems = getMaterialImportOrderItems(product, sectionId);
  const importOrderIndex = importOrderItems.findIndex((item) => normalizeText(item) === selectedName);

  return importOrderIndex >= 0 ? currentItems[importOrderIndex] || '' : '';
}

function getSelectedMaterialItemsByOrders(product, sectionId, value) {
  const currentItems = getMaterialItems(product, sectionId);

  return parseSequenceNumbers(value).reduce((result, orderNumber) => {
    const item = currentItems[orderNumber - 1];

    if (item) {
      result.push(item);
    }

    return result;
  }, []);
}

function getSelectedDescriptionImageItems(product) {
  const selectedNames = splitSelection(product && product.descriptionImageNames);

  if (selectedNames.length) {
    return selectedNames
      .map((item) => resolveMaterialItemByName(product, 'carousel', item))
      .filter(Boolean);
  }

  return getSelectedMaterialItemsByOrders(product, 'carousel', product && product.descriptionImageOrders);
}

module.exports = {
  getMaterialImportOrderItems,
  getMaterialItems,
  getSelectedDescriptionImageItems,
  getSelectedMaterialItemsByOrders,
  parseSequenceNumbers
};
