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

function getFileBaseName(value) {
  return normalizeText(value).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
}

function getMaterialNameKey(value) {
  const base = getFileBaseName(value);
  const segments = base.split(/[\s._-]+/).filter(Boolean);
  const suffix = segments.length > 1 ? segments[segments.length - 1] : '';

  return (/^\d{1,3}$/.test(suffix) ? suffix : base).toLowerCase();
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

function getMaterialPathMap(product, sectionId) {
  const pathMap = product && product.materialPathMap && product.materialPathMap[sectionId];
  return pathMap && typeof pathMap === 'object' && !Array.isArray(pathMap) ? pathMap : {};
}

function getMaterialItemsByPathMapOrder(product, sectionId) {
  const pathMap = getMaterialPathMap(product, sectionId);
  const pathKeys = Object.keys(pathMap).map((key) => normalizeText(key).toLowerCase()).filter(Boolean);

  if (!pathKeys.length) {
    return [];
  }

  const sourceItems = [
    ...getMaterialImportOrderItems(product, sectionId),
    ...getMaterialItems(product, sectionId)
  ];
  const usedIndexes = new Set();

  return pathKeys.reduce((result, pathKey) => {
    const sourceIndex = sourceItems.findIndex((item, index) => {
      return !usedIndexes.has(index) && getMaterialNameKey(item) === pathKey;
    });

    if (sourceIndex < 0) {
      return result;
    }

    usedIndexes.add(sourceIndex);
    result.push(sourceItems[sourceIndex]);
    return result;
  }, []);
}

function getMaterialOriginalOrderItems(product, sectionId) {
  if (!MATERIAL_SECTION_IDS.includes(sectionId)) {
    return [];
  }

  const source = product && product.materialOriginalOrderMap && Array.isArray(product.materialOriginalOrderMap[sectionId])
    ? normalizeTextArray(product.materialOriginalOrderMap[sectionId])
    : [];

  if (source.length) {
    return source;
  }

  const pathOrderItems = getMaterialItemsByPathMapOrder(product, sectionId);

  return pathOrderItems.length ? pathOrderItems : getMaterialImportOrderItems(product, sectionId);
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

  const selectedKey = getMaterialNameKey(selectedName);
  const keyedItem = selectedKey
    ? currentItems.find((item) => getMaterialNameKey(item) === selectedKey)
    : '';

  if (keyedItem) {
    return keyedItem;
  }

  const importOrderItems = getMaterialImportOrderItems(product, sectionId);
  const importOrderIndex = importOrderItems.findIndex((item) => normalizeText(item) === selectedName);

  return importOrderIndex >= 0 ? currentItems[importOrderIndex] || '' : '';
}

function getMaterialItemByOriginalOrder(product, sectionId, value) {
  const originalOrderItems = getMaterialOriginalOrderItems(product, sectionId);
  const selectedOrder = normalizePositiveInteger(value);
  const selectedName = selectedOrder > 0 ? originalOrderItems[selectedOrder - 1] : '';
  const selectedItem = selectedName ? resolveMaterialItemByName(product, sectionId, selectedName) : '';

  if (selectedItem) {
    return selectedItem;
  }

  const firstOriginalItem = originalOrderItems.length
    ? resolveMaterialItemByName(product, sectionId, originalOrderItems[0])
    : '';

  return firstOriginalItem || getMaterialItems(product, sectionId)[0] || '';
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
  getMaterialItemByOriginalOrder,
  getMaterialImportOrderItems,
  getMaterialItems,
  getMaterialOriginalOrderItems,
  getSelectedDescriptionImageItems,
  getSelectedMaterialItemsByOrders,
  parseSequenceNumbers
};
