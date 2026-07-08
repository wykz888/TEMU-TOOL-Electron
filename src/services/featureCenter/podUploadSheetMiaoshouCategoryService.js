const CATEGORY_LIST_URL = 'https://chunagtao-1251234463.cos.ap-guangzhou.myqcloud.com/Deploy_Data/TEMU_POD_CAT_LIST_PUT.json';

function createPodUploadSheetMiaoshouCategoryService({
  runtimeLogger,
  categoryListUrl = CATEGORY_LIST_URL
} = {}) {
  let cachedSnapshot = null;
  let loadPromise = null;

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
  }

  function parseCategoryListText(text) {
    const categoryMap = new Map();

    String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .forEach((line) => {
        const separatorIndex = line.indexOf('#');

        if (separatorIndex <= 0) {
          return;
        }

        const id = normalizeText(line.slice(0, separatorIndex));
        const label = normalizeText(line.slice(separatorIndex + 1));

        if (!/^\d+$/.test(id) || !label) {
          return;
        }

        categoryMap.set(id, {
          id,
          label
        });
      });

    return Array.from(categoryMap.values());
  }

  async function fetchCategoryListText() {
    const response = await fetch(categoryListUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`POD \u7c7b\u76ee\u5217\u8868\u8bfb\u53d6\u5931\u8d25\uff0cHTTP ${response.status}`);
    }

    return response.text();
  }

  async function loadSnapshot() {
    const rawText = await fetchCategoryListText();
    const categories = parseCategoryListText(rawText);

    if (!categories.length) {
      throw new Error('POD \u7c7b\u76ee\u5217\u8868\u4e3a\u7a7a\u3002');
    }

    cachedSnapshot = {
      updatedAt: new Date().toISOString(),
      sourceUrl: categoryListUrl,
      categories
    };

    return cachedSnapshot;
  }

  async function getSnapshot() {
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    if (!loadPromise) {
      loadPromise = loadSnapshot()
        .catch((error) => {
          logError('pod_upload_sheet_category_list_load_failed', error, {
            sourceUrl: categoryListUrl
          });
          throw error;
        })
        .finally(() => {
          loadPromise = null;
        });
    }

    return loadPromise;
  }

  return {
    getSnapshot
  };
}

module.exports = {
  CATEGORY_LIST_URL,
  createPodUploadSheetMiaoshouCategoryService
};
