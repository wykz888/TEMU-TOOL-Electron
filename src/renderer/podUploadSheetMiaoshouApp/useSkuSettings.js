import { computed, reactive } from 'vue';
import { POD_SKU_TABLE_SCROLL_X } from './constants/skuTable.js';
import { buildSkuKey, cloneSkuMap, createSkuEntry } from './utils/skuConfig.js';
import { normalizeText, splitLines } from './utils/podUploadSheetMiaoshouData.js';

function getCarouselItems(product) {
  return product && product.materials && Array.isArray(product.materials.carousel)
    ? product.materials.carousel
    : [];
}

export function useSkuSettings(options = {}) {
  const products = options.products;
  const activeProduct = options.activeProduct;
  const globalForm = options.globalForm;
  const scheduleStateSave = typeof options.scheduleStateSave === 'function' ? options.scheduleStateSave : () => undefined;

  const skuDefaults = reactive({
    declaredPrice: '',
    price: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    stock: '',
    platformSku: ''
  });
  const skuConfigMap = reactive({});

  const skuRows = computed(() => buildSkuRows());
  const skuTableScroll = computed(() => {
    const rowCount = skuRows.value.length;
    const scroll = { x: POD_SKU_TABLE_SCROLL_X };

    if (rowCount > 8) {
      scroll.y = 8 * 48;
    }

    return scroll;
  });
  const skuImageOptions = computed(() => {
    const product = activeProduct && activeProduct.value ? activeProduct.value : null;
    const items = getCarouselItems(product);

    return items.map((item, index) => ({
      value: String(index + 1),
      label: `\u7b2c${index + 1}\u5f20 ${normalizeText(item)}`
    }));
  });

  function mergeSkuDefaults(entry) {
    const result = createSkuEntry(entry);

    Object.entries(skuDefaults).forEach(([fieldName, value]) => {
      if (!normalizeText(result[fieldName])) {
        result[fieldName] = normalizeText(value);
      }
    });

    return result;
  }

  function buildSkuRows() {
    const leftItems = splitLines(globalForm.specValueOne);
    const rightItems = splitLines(globalForm.specValueTwo);
    const left = leftItems.length ? leftItems : [''];
    const right = rightItems.length ? rightItems : [''];
    const rows = [];

    left.forEach((leftValue) => {
      right.forEach((rightValue) => {
        const key = buildSkuKey(leftValue, rightValue);

        if (!skuConfigMap[key]) {
          skuConfigMap[key] = mergeSkuDefaults();
        }

        rows.push({
          key,
          specValueOne: leftValue,
          specValueTwo: rightValue,
          ...skuConfigMap[key]
        });
      });
    });

    return rows;
  }

  function pruneSkuConfigMap() {
    const validKeys = new Set(buildSkuRows().map((row) => row.key));

    Object.keys(skuConfigMap).forEach((key) => {
      if (!validKeys.has(key)) {
        delete skuConfigMap[key];
      }
    });
  }

  function getSkuConfigMapSnapshot() {
    return cloneSkuMap(skuConfigMap);
  }

  function getSkuTemplateConfigMap() {
    return {
      defaults: createSkuEntry(skuDefaults),
      ...getSkuConfigMapSnapshot()
    };
  }

  function syncGlobalToProducts() {
    products.value = products.value.map((product) => ({
      ...product,
      ...globalForm,
      skuConfigMap: getSkuConfigMapSnapshot()
    }));
    scheduleStateSave();
  }

  function syncSkuConfigToProducts() {
    products.value = products.value.map((product) => ({
      ...product,
      skuConfigMap: getSkuConfigMapSnapshot()
    }));
    scheduleStateSave();
  }

  function handleSkuSpecChange() {
    pruneSkuConfigMap();
    syncGlobalToProducts();
  }

  function applySkuTemplateConfig(source) {
    const skuConfig = source && typeof source === 'object' ? source : {};

    if (skuConfig.defaults) {
      Object.assign(skuDefaults, skuConfig.defaults);
    }

    Object.keys(skuConfigMap).forEach((key) => {
      delete skuConfigMap[key];
    });
    Object.assign(skuConfigMap, cloneSkuMap(skuConfig));
    pruneSkuConfigMap();
  }

  return {
    skuDefaults,
    skuConfigMap,
    skuRows,
    skuTableScroll,
    skuImageOptions,
    buildSkuRows,
    pruneSkuConfigMap,
    getSkuConfigMapSnapshot,
    getSkuTemplateConfigMap,
    syncGlobalToProducts,
    syncSkuConfigToProducts,
    handleSkuSpecChange,
    applySkuTemplateConfig
  };
}
