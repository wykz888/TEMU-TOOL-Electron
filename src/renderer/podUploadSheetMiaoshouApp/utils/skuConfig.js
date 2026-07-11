const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
const SKU_CONFIG_FIELDS = Object.freeze([
  'declaredPrice',
  'price',
  'length',
  'width',
  'height',
  'weight',
  'stock',
  'skuImage',
  'platformSku',
  'skuCategoryType',
  'skuCategoryCount',
  'skuCategoryUnit',
  'independentPackaging'
]);

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function createSkuEntry(source = {}) {
  return SKU_CONFIG_FIELDS.reduce((entry, fieldName) => {
    entry[fieldName] = normalizeText(source[fieldName]);
    return entry;
  }, {});
}

function cloneSkuMap(source = {}) {
  return Object.entries(source && typeof source === 'object' ? source : {}).reduce((result, [key, value]) => {
    const normalizedKey = normalizeText(key);

    if (normalizedKey && normalizedKey !== 'defaults') {
      result[normalizedKey] = createSkuEntry(value || {});
    }

    return result;
  }, {});
}

function buildSkuKey(left, right) {
  return `${normalizeText(left)}${SKU_ROW_KEY_SEPARATOR}${normalizeText(right)}`;
}

export {
  SKU_CONFIG_FIELDS,
  SKU_ROW_KEY_SEPARATOR,
  buildSkuKey,
  cloneSkuMap,
  createSkuEntry
};
