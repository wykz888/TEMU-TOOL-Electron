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

function getMaterialImportOrderItems(product, sectionId) {
  const source = product && product.materialImportOrderMap && Array.isArray(product.materialImportOrderMap[sectionId])
    ? product.materialImportOrderMap[sectionId]
    : null;

  if (source) return source;
  return product && product.materials && Array.isArray(product.materials[sectionId]) ? product.materials[sectionId] : [];
}

function getMaterialDisplayName(product, sectionId, item) {
  const name = normalizeText(item);
  const key = getMaterialNameKey(name);
  const pathMap = product && product.materialPathMap && product.materialPathMap[sectionId] && typeof product.materialPathMap[sectionId] === 'object'
    ? product.materialPathMap[sectionId]
    : {};
  return getFileNameWithExtension((key && pathMap[key]) || name);
}

function getDescriptionImageItems(product) {
  const carouselItems = product && product.materials && Array.isArray(product.materials.carousel) ? product.materials.carousel : [];
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
  getAiStatusColor,
  getAiStatusText,
  getDescriptionImageItems,
  getDescriptionImageTitle,
  getExtraItemCount,
  getFileBaseName,
  getFileNameWithExtension,
  getMaterialDisplayName,
  getMaterialImportOrderItems,
  getMaterialNameKey,
  getPreviewItems,
  getTextLength,
  normalizeText,
  splitLines
};
