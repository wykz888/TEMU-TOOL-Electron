const fs = require('node:fs');
const path = require('node:path');
const { cosService, COS_SCOPES } = require('../src/services/cos');

const DEFAULT_SELLER_ORIGIN = 'https://agentseller.temu.com';
const CATEGORY_CHILDREN_PATH = '/anniston-agent-seller/category/children/list';
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RETRY_TIMES = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_OUTPUT_FILE_PATH = path.join(__dirname, 'output', 'global-categories-tree.json');
const DEFAULT_CLOUD_CACHE_KEY = 'feature_center/operations_management/product_management/cache/global-categories-tree.json';
const GLOBAL_CATEGORY_TREE_VERSION = 1;

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeIntegerValue(value, fallback = 0) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeBooleanValue(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }

  return fallback;
}

function normalizeCategoryRecord(category) {
  const catId = normalizeText(
    category && (
      category.catId
      || category.id
    )
  );

  if (!catId) {
    return null;
  }

  return {
    catId,
    catName: normalizeText(
      category && (
        category.catName
        || category.label
      )
    ),
    catEnName: normalizeText(category && category.catEnName),
    catLevel: normalizeIntegerValue(
      category && (
        category.catLevel
        || category.level
      ),
      0
    ),
    catType: normalizeIntegerValue(category && category.catType, 0),
    parentCatId: normalizeText(
      category && (
        category.parentCatId
        || category.parentId
      )
    ),
    isLeaf: normalizeBooleanValue(category && category.isLeaf, false),
    isHidden: normalizeBooleanValue(category && category.isHidden, false),
    hiddenType: normalizeIntegerValue(category && category.hiddenType, 0),
    isSemiManagedHidden: normalizeBooleanValue(category && category.isSemiManagedHidden, false),
    semiManagedHiddenType: normalizeIntegerValue(category && category.semiManagedHiddenType, 0)
  };
}

function normalizeCategoryArray(categories) {
  return (Array.isArray(categories) ? categories : [])
    .map(normalizeCategoryRecord)
    .filter((category) => category && category.catId && category.catName);
}

function parseArguments(argv) {
  const options = {
    origin: DEFAULT_SELLER_ORIGIN,
    concurrency: DEFAULT_CONCURRENCY,
    retryTimes: DEFAULT_RETRY_TIMES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    outputFilePath: DEFAULT_OUTPUT_FILE_PATH,
    cloudCacheKey: DEFAULT_CLOUD_CACHE_KEY,
    skipCloud: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = normalizeText(argv[index]);
    const nextValue = argv[index + 1];

    if (!token) {
      continue;
    }

    if (token === '--cookie' && nextValue) {
      options.cookie = String(nextValue);
      index += 1;
      continue;
    }

    if (token === '--cookie-file' && nextValue) {
      options.cookieFilePath = String(nextValue);
      index += 1;
      continue;
    }

    if (token === '--origin' && nextValue) {
      options.origin = normalizeText(nextValue) || DEFAULT_SELLER_ORIGIN;
      index += 1;
      continue;
    }

    if (token === '--output' && nextValue) {
      options.outputFilePath = path.resolve(String(nextValue));
      index += 1;
      continue;
    }

    if (token === '--cloud-key' && nextValue) {
      options.cloudCacheKey = normalizeText(nextValue) || DEFAULT_CLOUD_CACHE_KEY;
      index += 1;
      continue;
    }

    if (token === '--concurrency' && nextValue) {
      options.concurrency = Math.max(1, normalizeIntegerValue(nextValue, DEFAULT_CONCURRENCY));
      index += 1;
      continue;
    }

    if (token === '--retry' && nextValue) {
      options.retryTimes = Math.max(1, normalizeIntegerValue(nextValue, DEFAULT_RETRY_TIMES));
      index += 1;
      continue;
    }

    if (token === '--timeout' && nextValue) {
      options.timeoutMs = Math.max(1000, normalizeIntegerValue(nextValue, DEFAULT_TIMEOUT_MS));
      index += 1;
      continue;
    }

    if (token === '--skip-cloud') {
      options.skipCloud = true;
    }
  }

  return options;
}

function parseCookieString(cookieText) {
  return String(cookieText || '')
    .split(';')
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf('=');

      if (separatorIndex <= 0) {
        return null;
      }

      return {
        name: item.slice(0, separatorIndex).trim(),
        value: item.slice(separatorIndex + 1).trim()
      };
    })
    .filter((entry) => entry && entry.name);
}

async function resolveCookie(options) {
  if (normalizeText(options.cookie)) {
    return String(options.cookie);
  }

  if (normalizeText(process.env.TEMU_CATEGORY_COOKIE)) {
    return String(process.env.TEMU_CATEGORY_COOKIE);
  }

  if (normalizeText(options.cookieFilePath)) {
    const rawCookieText = await fs.promises.readFile(path.resolve(options.cookieFilePath), 'utf8');
    return rawCookieText.trim();
  }

  throw new Error('Missing cookie. Use TEMU_CATEGORY_COOKIE, --cookie, or --cookie-file.');
}

function buildRequestBody(parentCatId) {
  const normalizedParentCatId = normalizeText(parentCatId);

  if (!normalizedParentCatId) {
    return {};
  }

  const parsedParentCatId = Number.parseInt(normalizedParentCatId, 10);

  return {
    parentCatId: Number.isSafeInteger(parsedParentCatId)
      ? parsedParentCatId
      : normalizedParentCatId
  };
}

async function postCategoryChildren({ origin, cookie, parentCatId, timeoutMs }) {
  const requestUrl = new URL(CATEGORY_CHILDREN_PATH, origin).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'content-type': 'application/json;charset=UTF-8',
        cookie,
        origin,
        pragma: 'no-cache',
        priority: 'u=1, i',
        referer: `${origin}/`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: JSON.stringify(buildRequestBody(parentCatId)),
      cache: 'no-store',
      signal: controller.signal
    });
    const responseText = await response.text();
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      payload = null;
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Invalid response for parent ${normalizeText(parentCatId) || '<root>'}: ${normalizeText(responseText).slice(0, 180)}`
      );
    }

    const success =
      response.ok
      && payload.success === true
      && (
        !Object.prototype.hasOwnProperty.call(payload, 'errorCode')
        || Number(payload.errorCode) === 1000000
      );

    if (!success) {
      const errorMessage = normalizeText(payload.errorMsg || payload.message || payload.msg);

      throw new Error(
        `Category request failed for parent ${normalizeText(parentCatId) || '<root>'}: ${errorMessage || `HTTP ${response.status}`}`
      );
    }

    return {
      payload,
      categories: normalizeCategoryArray(payload && payload.result && payload.result.categoryNodeVOS)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(requestFactory, retryTimes) {
  let attempt = 0;
  let lastError = null;

  while (attempt < retryTimes) {
    try {
      return await requestFactory();
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (attempt >= retryTimes) {
        break;
      }

      const delayMs = Math.min(5000, 400 * (2 ** (attempt - 1)));

      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  throw lastError;
}

async function crawlCategoryTree(options) {
  const visitedParentIds = new Set();
  const queuedParentIds = new Set();
  const queue = [];
  const categoriesByParent = Object.create(null);
  const categoryMap = new Map();
  let requestCount = 0;

  async function fetchChildren(parentCatId) {
    const response = await fetchWithRetry(() => {
      return postCategoryChildren({
        origin: options.origin,
        cookie: options.cookie,
        parentCatId,
        timeoutMs: options.timeoutMs
      });
    }, options.retryTimes);

    requestCount += 1;
    return response.categories;
  }

  function registerChildren(parentCatId, categories) {
    const normalizedParentCatId = normalizeText(parentCatId);
    const normalizedCategories = normalizeCategoryArray(categories);

    categoriesByParent[normalizedParentCatId] = normalizedCategories;

    normalizedCategories.forEach((category) => {
      categoryMap.set(category.catId, category);

      if (category.isLeaf === true) {
        return;
      }

      if (visitedParentIds.has(category.catId) || queuedParentIds.has(category.catId)) {
        return;
      }

      queuedParentIds.add(category.catId);
      queue.push(category.catId);
    });
  }

  const rootCategories = await fetchChildren('');
  registerChildren('', rootCategories);

  async function worker() {
    while (queue.length > 0) {
      const parentCatId = queue.shift();

      if (!parentCatId) {
        continue;
      }

      queuedParentIds.delete(parentCatId);

      if (visitedParentIds.has(parentCatId)) {
        continue;
      }

      visitedParentIds.add(parentCatId);
      const children = await fetchChildren(parentCatId);
      registerChildren(parentCatId, children);

      if (visitedParentIds.size % 25 === 0) {
        console.log(
          `Processed parent nodes: ${visitedParentIds.size}, total categories: ${categoryMap.size}, pending: ${queue.length}`
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, options.concurrency) }, () => worker())
  );

  const allCategories = Array.from(categoryMap.values()).sort((left, right) => {
    const levelDiff = normalizeIntegerValue(left.catLevel) - normalizeIntegerValue(right.catLevel);

    if (levelDiff !== 0) {
      return levelDiff;
    }

    return String(left.catName).localeCompare(String(right.catName), 'zh-CN');
  });
  const maxLevel = allCategories.reduce((result, category) => {
    return Math.max(result, normalizeIntegerValue(category && category.catLevel, 0));
  }, 0);
  const leafCount = allCategories.filter((category) => category.isLeaf === true).length;
  const nonLeafCount = allCategories.length - leafCount;

  return {
    version: GLOBAL_CATEGORY_TREE_VERSION,
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    sourceOrigin: options.origin,
    rootCategories: normalizeCategoryArray(categoriesByParent['']),
    categoriesByParent: Object.fromEntries(
      Object.entries(categoriesByParent).map(([parentCatId, categories]) => {
        return [parentCatId, normalizeCategoryArray(categories)];
      })
    ),
    allCategories,
    stats: {
      requestCount,
      rootCount: normalizeCategoryArray(categoriesByParent['']).length,
      totalCount: allCategories.length,
      leafCount,
      nonLeafCount,
      maxLevel
    }
  };
}

async function writeOutputFile(filePath, payload) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

async function uploadCloudSnapshot(cloudCacheKey, payload) {
  return cosService.putJson({
    scope: COS_SCOPES.ROOT,
    key: cloudCacheKey,
    data: payload,
    metadata: {
      record_type: 'operations-product-global-categories',
      category_total_count: payload && payload.stats ? payload.stats.totalCount : 0,
      category_root_count: payload && payload.stats ? payload.stats.rootCount : 0,
      synced_at: normalizeText(payload && payload.syncedAt)
    }
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  options.cookie = await resolveCookie(options);
  options.origin = normalizeText(options.origin) || DEFAULT_SELLER_ORIGIN;

  console.log(`Starting category crawl from ${options.origin}`);
  const startedAt = Date.now();
  const payload = await crawlCategoryTree(options);

  payload.syncedAt = new Date().toISOString();
  payload.updatedAt = payload.syncedAt;

  await writeOutputFile(options.outputFilePath, payload);
  console.log(`Local snapshot written to ${options.outputFilePath}`);

  if (options.skipCloud !== true) {
    const uploadResult = await uploadCloudSnapshot(options.cloudCacheKey, payload);
    console.log(`Cloud snapshot uploaded to ${options.cloudCacheKey}`);
    console.log(`Cloud URL: ${uploadResult.url}`);
  }

  const elapsedMs = Date.now() - startedAt;

  console.log(
    `Completed. roots=${payload.stats.rootCount}, total=${payload.stats.totalCount}, leaves=${payload.stats.leafCount}, maxLevel=${payload.stats.maxLevel}, requests=${payload.stats.requestCount}, elapsedMs=${elapsedMs}`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_SELLER_ORIGIN,
  CATEGORY_CHILDREN_PATH,
  DEFAULT_OUTPUT_FILE_PATH,
  DEFAULT_CLOUD_CACHE_KEY,
  GLOBAL_CATEGORY_TREE_VERSION,
  normalizeText,
  normalizeIntegerValue,
  normalizeBooleanValue,
  normalizeCategoryRecord,
  normalizeCategoryArray,
  parseArguments,
  parseCookieString,
  resolveCookie,
  writeOutputFile,
  uploadCloudSnapshot
};
