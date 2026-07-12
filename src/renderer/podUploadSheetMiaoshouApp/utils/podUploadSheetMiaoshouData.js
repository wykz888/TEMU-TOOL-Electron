import { cloneSkuMap } from './skuConfig.js';

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((item) => normalizeText(item))
    .filter(Boolean);
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

function normalizeMaterialName(file, context = {}) {
  const name = normalizeText(file && file.name);
  const base = getFileBaseName(name);
  const productKey = normalizeText(context.productKey);

  if (productKey && base.toLowerCase().startsWith(productKey.toLowerCase())) {
    return normalizeText(base.slice(productKey.length).replace(/^[\s._-]+/, '')) || name;
  }

  return name;
}

function createEmptyPathMap() {
  return { carousel: {}, assets: {}, preview: {} };
}

function createEmptyImportOrderMap() {
  return { carousel: [], assets: [], preview: [] };
}

function createImportOrderMap(materials = {}, source = {}) {
  return ['carousel', 'assets', 'preview'].reduce((result, sectionId) => {
    const items = source && Array.isArray(source[sectionId]) ? source[sectionId] : materials[sectionId];
    result[sectionId] = Array.isArray(items) ? items.map((item) => normalizeText(item)).filter(Boolean) : [];
    return result;
  }, createEmptyImportOrderMap());
}

function getMaterialImportOrderItems(product, sectionId) {
  const source = product && product.materialImportOrderMap && Array.isArray(product.materialImportOrderMap[sectionId])
    ? product.materialImportOrderMap[sectionId]
    : null;

  if (source) return source;
  return product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
}

function getSectionPathMap(product, sectionId) {
  return product && product.materialPathMap && product.materialPathMap[sectionId] && typeof product.materialPathMap[sectionId] === 'object'
    ? product.materialPathMap[sectionId]
    : {};
}

function getMaterialPathByName(product, sectionId, item, index = -1) {
  const pathMap = getSectionPathMap(product, sectionId);
  const key = getMaterialNameKey(item);

  if (key && pathMap[key]) {
    return pathMap[key];
  }

  const importOrderItems = getMaterialImportOrderItems(product, sectionId);
  const importedName = index >= 0 && index < importOrderItems.length ? importOrderItems[index] : '';
  const importedKey = getMaterialNameKey(importedName);

  return importedKey && pathMap[importedKey] ? pathMap[importedKey] : '';
}

function createPodUploadSheetMiaoshouProduct(overrides = {}, options = {}) {
  const defaultFields = options && typeof options.defaultFields === 'object' ? options.defaultFields : {};
  const materials = overrides.materials && typeof overrides.materials === 'object' ? overrides.materials : {};
  const materialImportOrderMap = createImportOrderMap(materials, overrides.materialImportOrderMap);

  return {
    id: normalizeText(overrides.id) || createId('pod-product'),
    ...defaultFields,
    ...overrides,
    materials: {
      carousel: Array.isArray(materials.carousel) ? materials.carousel.slice() : [],
      assets: Array.isArray(materials.assets) ? materials.assets.slice() : [],
      preview: Array.isArray(materials.preview) ? materials.preview.slice() : []
    },
    materialPathMap: {
      ...createEmptyPathMap(),
      ...(overrides.materialPathMap && typeof overrides.materialPathMap === 'object' ? overrides.materialPathMap : {})
    },
    materialImportOrderMap,
    skuConfigMap: cloneSkuMap(overrides.skuConfigMap),
    aiTitleStatus: normalizeText(overrides.aiTitleStatus),
    aiTitleError: normalizeText(overrides.aiTitleError),
    aiTitlePatternSummary: normalizeText(overrides.aiTitlePatternSummary),
    aiTitleUpdatedAt: normalizeText(overrides.aiTitleUpdatedAt)
  };
}

function getImportedProductGroup(file) {
  const segments = normalizeText(file && file.webkitRelativePath).split('/').filter(Boolean);

  if (segments.length >= 3) return { productKey: segments[1], sourceFolder: `${segments[0]}/${segments[1]}` };
  if (segments.length === 2) return { productKey: segments[0], sourceFolder: segments[0] };
  return { productKey: '\u6839\u76ee\u5f55\u5546\u54c1', sourceFolder: '' };
}

function classifySection(fileName, relativePath) {
  const text = `${fileName} ${relativePath || ''}`.toLowerCase();

  if (/(preview|mockup)/.test(text)) return 'preview';
  if (/(detail|asset|size)/.test(text)) return 'assets';
  return 'carousel';
}

function getPreviewItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 3);
}

function getExtraItemCount(items) {
  const count = Array.isArray(items) ? items.length : 0;
  return count > 3 ? count - 3 : 0;
}

function getMaterialDisplayName(product, sectionId, item) {
  const name = normalizeText(item);
  return getFileNameWithExtension(getMaterialPathByName(product, sectionId, name) || name);
}

function getDescriptionImageItems(product) {
  const carouselItems = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
  return splitLines(String(product && product.descriptionImageOrders || '').replace(/[,\uff0c]/g, '\n'))
    .map((orderText) => Number.parseInt(orderText, 10))
    .filter((orderNumber) => orderNumber > 0 && carouselItems[orderNumber - 1])
    .map((orderNumber) => carouselItems[orderNumber - 1]);
}

function getDescriptionImageTitle(product) {
  return getDescriptionImageItems(product).map((item) => getMaterialDisplayName(product, 'carousel', item)).join('\n');
}

function getPrimaryProductImage(product) {
  const items = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
  const item = items[0];

  if (!item) return null;

  const path = getMaterialPathByName(product, 'carousel', item, 0);

  return path ? { name: item, path } : null;
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

function resolveAiStatusType(tone) {
  if (tone === 'danger') return 'error';
  if (tone === 'warning') return 'warning';
  return 'info';
}

export {
  classifySection,
  createEmptyImportOrderMap,
  createEmptyPathMap,
  createId,
  createImportOrderMap,
  createPodUploadSheetMiaoshouProduct,
  getAiStatusColor,
  getAiStatusText,
  getDescriptionImageItems,
  getDescriptionImageTitle,
  getExtraItemCount,
  getFileBaseName,
  getFileNameWithExtension,
  getImportedProductGroup,
  getMaterialDisplayName,
  getMaterialImportOrderItems,
  getMaterialNameKey,
  getMaterialPathByName,
  getPreviewItems,
  getPrimaryProductImage,
  getTextLength,
  normalizeMaterialName,
  normalizeText,
  resolveAiStatusType,
  splitLines
};
