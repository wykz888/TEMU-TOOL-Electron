function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function splitLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/[\n,;\uFF0C\u3001\uFF1B]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

const MATERIAL_SECTION_IDS = Object.freeze(['carousel', 'assets', 'preview']);

function normalizeTextArray(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function createEmptyImportOrderMap() {
  return MATERIAL_SECTION_IDS.reduce((result, sectionId) => {
    result[sectionId] = [];
    return result;
  }, {});
}

function createImportOrderMap(materials = {}, source = {}) {
  return MATERIAL_SECTION_IDS.reduce((result, sectionId) => {
    const sourceItems = source && Array.isArray(source[sectionId])
      ? source[sectionId]
      : materials && materials[sectionId];
    result[sectionId] = normalizeTextArray(sourceItems);
    return result;
  }, createEmptyImportOrderMap());
}

function getFileBaseName(fileName) {
  return normalizeText(fileName).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
}

function getFileNameWithExtension(fileName) {
  return normalizeText(fileName).replace(/^.*[\\/]/, '');
}

function getMaterialNameKey(value) {
  const base = getFileBaseName(value);
  const segments = base.split(/[\s._-]+/).filter(Boolean);
  const suffix = segments.length > 1 ? segments[segments.length - 1] : '';

  return (/^\d{1,3}$/.test(suffix) ? suffix : base).toLowerCase();
}

function getMaterialItems(product, sectionId) {
  return product && product.materials && Array.isArray(product.materials[sectionId])
    ? normalizeTextArray(product.materials[sectionId])
    : [];
}

function getMaterialImportOrderItems(product, sectionId) {
  const source = product && product.materialImportOrderMap && Array.isArray(product.materialImportOrderMap[sectionId])
    ? product.materialImportOrderMap[sectionId]
    : null;

  if (source && source.length) return normalizeTextArray(source);
  return getMaterialItems(product, sectionId);
}

function getMaterialDisplayName(product, sectionId, item) {
  const name = normalizeText(item);
  const key = getMaterialNameKey(name);
  const pathMap = product && product.materialPathMap && product.materialPathMap[sectionId] && typeof product.materialPathMap[sectionId] === 'object'
    ? product.materialPathMap[sectionId]
    : {};
  return getFileNameWithExtension((key && pathMap[key]) || name);
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

function getDescriptionImageItems(product) {
  const selectedNames = splitLines(product && product.descriptionImageNames);

  if (selectedNames.length) {
    return selectedNames
      .map((item) => resolveMaterialItemByName(product, 'carousel', item))
      .filter(Boolean);
  }

  const carouselItems = getMaterialItems(product, 'carousel');
  return splitLines(product && product.descriptionImageOrders)
    .map((orderText) => Number.parseInt(orderText, 10))
    .filter((orderNumber) => orderNumber > 0 && carouselItems[orderNumber - 1])
    .map((orderNumber) => carouselItems[orderNumber - 1]);
}

function getDescriptionImageTitle(product) {
  return getDescriptionImageItems(product).map((item) => getMaterialDisplayName(product, 'carousel', item)).join('\n');
}

function getPreviewItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 3);
}

function getExtraItemCount(items) {
  const count = Array.isArray(items) ? items.length : 0;
  return count > 3 ? count - 3 : 0;
}

function getTextLength(value) {
  return String(value === undefined || value === null ? '' : value).length;
}

function getAiStatusText(status) {
  if (status === 'success') return '\u6210\u529f';
  if (status === 'failed') return '\u5931\u8d25';
  if (status === 'processing') return '\u5904\u7406\u4e2d';
  if (status === 'canceled') return '\u5df2\u505c\u6b62';
  return '\u672a\u751f\u6210';
}

function getAiStatusColor(status) {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'processing') return 'arcoblue';
  return 'gray';
}

export {
  createEmptyImportOrderMap,
  createImportOrderMap,
  getAiStatusColor,
  getAiStatusText,
  getDescriptionImageItems,
  getDescriptionImageTitle,
  getExtraItemCount,
  getFileBaseName,
  getFileNameWithExtension,
  getMaterialDisplayName,
  getMaterialItems,
  getMaterialImportOrderItems,
  getMaterialNameKey,
  getPreviewItems,
  getTextLength,
  normalizeText,
  splitLines
};
