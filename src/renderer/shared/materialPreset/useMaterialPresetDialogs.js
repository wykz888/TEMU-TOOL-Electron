import { computed, ref } from 'vue';
import {
  getDescriptionImageItems,
  getFileNameWithExtension,
  getMaterialDisplayName,
  getMaterialImportOrderItems,
  getMaterialNameKey,
  normalizeText,
  splitLines
} from '../podUploadSheet/podUploadSheetDisplayData.js';

function resolveValue(source) {
  if (!source || typeof source !== 'object') {
    return source;
  }

  return 'value' in source ? source.value : source;
}

function getProductsList(products) {
  const list = resolveValue(products);
  return Array.isArray(list) ? list : [];
}

function getCarouselItems(product) {
  return product && product.materials && Array.isArray(product.materials.carousel)
    ? product.materials.carousel
    : [];
}

function getProductMaterialPathMap(product, sectionId) {
  const pathMap = product && product.materialPathMap && product.materialPathMap[sectionId];
  return pathMap && typeof pathMap === 'object' ? pathMap : {};
}

function showMessage(messageApi, method, content) {
  if (messageApi && typeof messageApi[method] === 'function') {
    messageApi[method](content);
  }
}

function shuffleItems(items) {
  const nextItems = Array.isArray(items) ? items.slice() : [];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    const current = nextItems[index];
    nextItems[index] = nextItems[targetIndex];
    nextItems[targetIndex] = current;
  }

  return nextItems;
}

function sortByImportOrder(candidates, items) {
  const selectedSet = new Set(splitLines(items).filter(Boolean));
  return candidates.map((item) => item.name).filter((name) => selectedSet.has(name));
}

export function useMaterialPresetDialogs(options = {}) {
  const products = options.products;
  const activeProduct = options.activeProduct;
  const scheduleStateSave = typeof options.scheduleStateSave === 'function' ? options.scheduleStateSave : () => undefined;
  const messageApi = options.messageApi || null;

  const carouselPresetVisible = ref(false);
  const carouselPresetText = ref('');
  const carouselPresetSelected = ref([]);
  const randomCarouselVisible = ref(false);
  const randomCarouselOnlyFirst = ref(false);
  const randomCarouselSelected = ref([]);
  const descriptionPresetVisible = ref(false);
  const descriptionPresetText = ref('');
  const descriptionPresetSelected = ref([]);

  const carouselPresetCandidates = computed(() => {
    const itemMap = new Map();

    getProductsList(products).forEach((product) => {
      getCarouselItems(product).forEach((item) => {
        const name = normalizeText(item);

        if (!name) {
          return;
        }

        const existing = itemMap.get(name);

        if (existing) {
          existing.count += 1;
          return;
        }

        itemMap.set(name, { name, count: 1 });
      });
    });

    return Array.from(itemMap.values());
  });

  const descriptionPresetCandidates = computed(() => {
    const itemMap = new Map();

    getProductsList(products).forEach((product) => {
      getMaterialImportOrderItems(product, 'carousel').forEach((item) => {
        const name = normalizeText(item);

        if (!name) {
          return;
        }

        const existing = itemMap.get(name);

        if (existing) {
          existing.count += 1;
          return;
        }

        itemMap.set(name, { name, count: 1 });
      });
    });

    return Array.from(itemMap.values());
  });

  const randomCarouselCandidates = computed(() => {
    const productList = getProductsList(products);
    const maxCount = productList.reduce((count, product) => {
      return Math.max(count, getCarouselItems(product).length);
    }, 0);

    return Array.from({ length: maxCount }, (_, index) => {
      const order = index + 1;
      const names = [];
      let count = 0;

      productList.forEach((product) => {
        const carousel = getCarouselItems(product);
        const item = carousel[index];

        if (!item) {
          return;
        }

        count += 1;

        const displayName = getMaterialDisplayName(product, 'carousel', item);

        if (displayName && !names.includes(displayName)) {
          names.push(displayName);
        }
      });

      return {
        order,
        count,
        displayName: names[0] || `#${order}`,
        names
      };
    }).filter((item) => item.count > 0);
  });

  function openCarouselPreset() {
    const candidateNames = carouselPresetCandidates.value.map((item) => item.name);
    const savedSelection = splitLines(carouselPresetText.value).filter((item) => candidateNames.includes(item));
    const firstProduct = getProductsList(products)[0];
    const firstProductSelection = getCarouselItems(firstProduct).map((item) => normalizeText(item)).filter(Boolean);

    carouselPresetSelected.value = savedSelection.length
      ? savedSelection
      : firstProductSelection.filter((item) => candidateNames.includes(item));
    carouselPresetVisible.value = true;
  }

  function closeCarouselPreset() {
    carouselPresetVisible.value = false;
  }

  function getCarouselPresetFileNames(name) {
    const selectedName = normalizeText(name);
    const selectedKey = getMaterialNameKey(selectedName);
    const fileNames = [];

    getProductsList(products).forEach((product) => {
      const carousel = getCarouselItems(product);

      if (!carousel.includes(selectedName)) {
        return;
      }

      const pathMap = getProductMaterialPathMap(product, 'carousel');
      const filePath = selectedKey ? normalizeText(pathMap[selectedKey]) : '';
      const fileName = getFileNameWithExtension(filePath || selectedName);

      if (fileName && !fileNames.includes(fileName)) {
        fileNames.push(fileName);
      }
    });

    return fileNames;
  }

  function getCarouselPresetDisplayName(name) {
    const fileNames = getCarouselPresetFileNames(name);
    const firstName = fileNames[0] || normalizeText(name);

    if (fileNames.length > 1) {
      return `${firstName} +${fileNames.length - 1}`;
    }

    return firstName;
  }

  function getCarouselPresetFileTip(name) {
    const fileNames = getCarouselPresetFileNames(name);

    if (!fileNames.length) {
      return normalizeText(name);
    }

    return fileNames.join('\n');
  }

  function isCarouselPresetSelected(name) {
    return carouselPresetSelected.value.includes(normalizeText(name));
  }

  function toggleCarouselPresetItem(name, checked) {
    const nextName = normalizeText(name);

    if (!nextName) {
      return;
    }

    const nextItems = carouselPresetSelected.value.filter((item) => item !== nextName);
    carouselPresetSelected.value = checked ? [...nextItems, nextName] : nextItems;
  }

  function selectAllCarouselPresetItems() {
    carouselPresetSelected.value = carouselPresetCandidates.value.map((item) => item.name);
  }

  function clearCarouselPresetItems() {
    carouselPresetSelected.value = [];
  }

  function moveCarouselPresetItem(index, offset) {
    const targetIndex = index + offset;

    if (targetIndex < 0 || targetIndex >= carouselPresetSelected.value.length) {
      return;
    }

    const nextItems = carouselPresetSelected.value.slice();
    const current = nextItems[index];
    nextItems[index] = nextItems[targetIndex];
    nextItems[targetIndex] = current;
    carouselPresetSelected.value = nextItems;
  }

  function applyCarouselPreset() {
    const values = carouselPresetSelected.value.map((item) => normalizeText(item)).filter(Boolean);

    if (!values.length) {
      showMessage(messageApi, 'warning', '\u8bf7\u5148\u9009\u62e9\u8f6e\u64ad\u56fe');
      return;
    }

    products.value = getProductsList(products).map((product) => {
      const carousel = getCarouselItems(product);
      const nextCarousel = [
        ...values.filter((item) => carousel.includes(item)),
        ...carousel.filter((item) => !values.includes(item))
      ];

      return {
        ...product,
        materials: {
          ...product.materials,
          carousel: nextCarousel
        }
      };
    });

    carouselPresetText.value = values.join('\n');
    carouselPresetVisible.value = false;
    scheduleStateSave();
    showMessage(messageApi, 'success', '\u5df2\u5e94\u7528\u8f6e\u64ad\u56fe\u9884\u8bbe');
  }

  function openRandomCarouselPreset() {
    const candidateOrders = randomCarouselCandidates.value.map((item) => item.order);
    const savedOrders = randomCarouselSelected.value
      .map((item) => Number(item))
      .filter((item, index, items) => candidateOrders.includes(item) && items.indexOf(item) === index);

    randomCarouselSelected.value = savedOrders.length ? savedOrders : candidateOrders;
    randomCarouselVisible.value = true;
  }

  function closeRandomCarouselPreset() {
    randomCarouselVisible.value = false;
  }

  function isRandomCarouselSelected(order) {
    return randomCarouselSelected.value.includes(Number(order));
  }

  function toggleRandomCarouselItem(order, checked) {
    const nextOrder = Number(order);

    if (!Number.isFinite(nextOrder) || nextOrder < 1) {
      return;
    }

    const nextItems = randomCarouselSelected.value.filter((item) => item !== nextOrder);
    randomCarouselSelected.value = checked
      ? [...nextItems, nextOrder].sort((left, right) => left - right)
      : nextItems;
  }

  function selectAllRandomCarouselItems() {
    randomCarouselSelected.value = randomCarouselCandidates.value.map((item) => item.order);
  }

  function clearRandomCarouselItems() {
    randomCarouselSelected.value = [];
  }

  function getRandomCarouselCandidate(order) {
    const nextOrder = Number(order);

    return randomCarouselCandidates.value.find((item) => item.order === nextOrder) || null;
  }

  function getRandomCarouselItemTip(item) {
    const names = item && Array.isArray(item.names) ? item.names : [];
    return names.length ? names.join('\n') : normalizeText(item && item.displayName);
  }

  function applyRandomCarouselPreset() {
    const selectedOrders = randomCarouselSelected.value.map((item) => Number(item)).filter((item) => item > 0);

    if (!selectedOrders.length) {
      showMessage(messageApi, 'warning', '\u8bf7\u5148\u9009\u62e9\u9700\u8981\u968f\u673a\u7684\u56fe\u7247');
      return;
    }

    products.value = getProductsList(products).map((product) => {
      const carousel = getCarouselItems(product);
      const availableOrders = selectedOrders.filter((order) => carousel[order - 1]);

      if (!availableOrders.length) {
        return product;
      }

      const nextCarousel = carousel.slice();

      if (randomCarouselOnlyFirst.value) {
        const targetOrder = availableOrders[Math.floor(Math.random() * availableOrders.length)];
        const targetIndex = targetOrder - 1;
        const currentFirst = nextCarousel[0];
        nextCarousel[0] = nextCarousel[targetIndex];
        nextCarousel[targetIndex] = currentFirst;
      } else {
        const shuffledItems = shuffleItems(availableOrders.map((order) => nextCarousel[order - 1]));
        availableOrders.forEach((order, index) => {
          nextCarousel[order - 1] = shuffledItems[index];
        });
      }

      return {
        ...product,
        materials: {
          ...product.materials,
          carousel: nextCarousel
        }
      };
    });

    randomCarouselVisible.value = false;
    scheduleStateSave();
    showMessage(messageApi, 'success', '\u5df2\u6279\u91cf\u968f\u673a\u8c03\u6574\u8f6e\u64ad\u56fe');
  }

  function openDescriptionPreset() {
    const candidateNames = descriptionPresetCandidates.value.map((item) => item.name);
    const savedSelection = splitLines(descriptionPresetText.value).filter((item) => candidateNames.includes(item));
    const currentProduct = resolveValue(activeProduct);
    const activeSelection = currentProduct
      ? getDescriptionImageItems(currentProduct).map((item) => normalizeText(item)).filter(Boolean)
      : [];

    descriptionPresetSelected.value = sortByImportOrder(
      descriptionPresetCandidates.value,
      savedSelection.length ? savedSelection : activeSelection.filter((item) => candidateNames.includes(item))
    );
    descriptionPresetVisible.value = true;
  }

  function closeDescriptionPreset() {
    descriptionPresetVisible.value = false;
  }

  function isDescriptionPresetSelected(name) {
    return descriptionPresetSelected.value.includes(normalizeText(name));
  }

  function toggleDescriptionPresetItem(name, checked) {
    const nextName = normalizeText(name);

    if (!nextName) {
      return;
    }

    const nextItems = descriptionPresetSelected.value.filter((item) => item !== nextName);
    descriptionPresetSelected.value = sortByImportOrder(
      descriptionPresetCandidates.value,
      checked ? [...nextItems, nextName] : nextItems
    );
  }

  function selectAllDescriptionPresetItems() {
    descriptionPresetSelected.value = descriptionPresetCandidates.value.map((item) => item.name);
  }

  function clearDescriptionPresetItems() {
    descriptionPresetSelected.value = [];
  }

  function moveDescriptionPresetItem(index, offset) {
    const targetIndex = index + offset;

    if (targetIndex < 0 || targetIndex >= descriptionPresetSelected.value.length) {
      return;
    }

    const nextItems = descriptionPresetSelected.value.slice();
    const current = nextItems[index];
    nextItems[index] = nextItems[targetIndex];
    nextItems[targetIndex] = current;
    descriptionPresetSelected.value = nextItems;
  }

  function applyDescriptionPreset() {
    const values = descriptionPresetSelected.value.map((item) => normalizeText(item)).filter(Boolean);

    if (!values.length) {
      showMessage(messageApi, 'warning', '\u8bf7\u5148\u9009\u62e9\u63cf\u8ff0\u56fe');
      return;
    }

    products.value = getProductsList(products).map((product) => {
      const carousel = getCarouselItems(product);
      const orders = values
        .map((item) => carousel.indexOf(item))
        .filter((index) => index >= 0)
        .map((index) => String(index + 1));

      return {
        ...product,
        descriptionImageOrders: orders.join(',')
      };
    });

    descriptionPresetText.value = values.join('\n');
    descriptionPresetVisible.value = false;
    scheduleStateSave();
    showMessage(messageApi, 'success', '\u5df2\u5e94\u7528\u63cf\u8ff0\u56fe\u9884\u8bbe');
  }

  return {
    carouselPresetVisible,
    carouselPresetText,
    carouselPresetSelected,
    randomCarouselVisible,
    randomCarouselOnlyFirst,
    randomCarouselSelected,
    descriptionPresetVisible,
    descriptionPresetText,
    descriptionPresetSelected,
    carouselPresetCandidates,
    descriptionPresetCandidates,
    randomCarouselCandidates,
    openCarouselPreset,
    closeCarouselPreset,
    getCarouselPresetFileNames,
    getCarouselPresetDisplayName,
    getCarouselPresetFileTip,
    isCarouselPresetSelected,
    toggleCarouselPresetItem,
    selectAllCarouselPresetItems,
    clearCarouselPresetItems,
    moveCarouselPresetItem,
    applyCarouselPreset,
    openRandomCarouselPreset,
    closeRandomCarouselPreset,
    isRandomCarouselSelected,
    toggleRandomCarouselItem,
    selectAllRandomCarouselItems,
    clearRandomCarouselItems,
    getRandomCarouselCandidate,
    getRandomCarouselItemTip,
    applyRandomCarouselPreset,
    openDescriptionPreset,
    closeDescriptionPreset,
    isDescriptionPresetSelected,
    toggleDescriptionPresetItem,
    selectAllDescriptionPresetItems,
    clearDescriptionPresetItems,
    moveDescriptionPresetItem,
    applyDescriptionPreset
  };
}
