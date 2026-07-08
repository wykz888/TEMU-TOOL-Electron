const {
  app,
  BrowserWindow
} = require('electron');
const {
  CATEGORY_CHILDREN_PATH,
  DEFAULT_SELLER_ORIGIN,
  parseArguments,
  parseCookieString,
  resolveCookie,
  writeOutputFile,
  uploadCloudSnapshot
} = require('./syncGlobalProductCategories');

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

function buildCrawlerScript(options) {
  const serializedOptions = JSON.stringify(options);

  return `
    (async () => {
      const options = ${serializedOptions};

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
        const catId = normalizeText(category && (category.catId || category.id));

        if (!catId) {
          return null;
        }

        return {
          catId,
          catName: normalizeText(category && (category.catName || category.label)),
          catEnName: normalizeText(category && category.catEnName),
          catLevel: normalizeIntegerValue(category && (category.catLevel || category.level), 0),
          catType: normalizeIntegerValue(category && category.catType, 0),
          parentCatId: normalizeText(category && (category.parentCatId || category.parentId)),
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

      async function postChildren(parentCatId) {
        const requestUrl = new URL(options.categoryChildrenPath, options.origin).toString();
        const response = await window.fetch(requestUrl, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json;charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          },
          body: JSON.stringify(buildRequestBody(parentCatId))
        });
        const responseText = await response.text();
        let payload = null;

        try {
          payload = responseText ? JSON.parse(responseText) : null;
        } catch (_error) {
          payload = null;
        }

        if (!payload || typeof payload !== 'object') {
          throw new Error(\`Invalid response for parent \${normalizeText(parentCatId) || '<root>'}: \${normalizeText(responseText).slice(0, 180)}\`);
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
            \`Category request failed for parent \${normalizeText(parentCatId) || '<root>'}: \${errorMessage || \`HTTP \${response.status}\`}\`
          );
        }

        return normalizeCategoryArray(payload && payload.result && payload.result.categoryNodeVOS);
      }

      async function fetchWithRetry(parentCatId) {
        let attempt = 0;
        let lastError = null;

        while (attempt < options.retryTimes) {
          try {
            return await postChildren(parentCatId);
          } catch (error) {
            lastError = error;
            attempt += 1;

            if (attempt >= options.retryTimes) {
              break;
            }

            const delayMs = Math.min(5000, 400 * (2 ** (attempt - 1)));
            await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          }
        }

        throw lastError;
      }

      const visitedParentIds = new Set();
      const queuedParentIds = new Set();
      const queue = [];
      const categoriesByParent = Object.create(null);
      const categoryMap = new Map();
      let requestCount = 0;

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

      const rootCategories = await fetchWithRetry('');
      requestCount += 1;
      registerChildren('', rootCategories);
      console.log(\`Root categories: \${rootCategories.length}\`);

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
          const children = await fetchWithRetry(parentCatId);
          requestCount += 1;
          registerChildren(parentCatId, children);

          if (visitedParentIds.size % 25 === 0) {
            console.log(\`Processed parent nodes: \${visitedParentIds.size}, total categories: \${categoryMap.size}, pending: \${queue.length}\`);
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
      const syncedAt = new Date().toISOString();

      return {
        version: options.version,
        updatedAt: syncedAt,
        syncedAt,
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
    })();
  `;
}

async function applyCookies(targetSession, origin, rawCookieText) {
  const parsedCookies = parseCookieString(rawCookieText);

  for (const cookie of parsedCookies) {
    await targetSession.cookies.set({
      url: origin,
      name: cookie.name,
      value: cookie.value,
      path: '/',
      secure: origin.startsWith('https://'),
      sameSite: 'no_restriction'
    });
  }
}

async function waitForPageLoad(windowInstance, timeoutMs = 20000) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out after ${timeoutMs}ms while waiting for page load.`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      windowInstance.webContents.removeListener('did-finish-load', handleFinishLoad);
      windowInstance.webContents.removeListener('did-fail-load', handleFailLoad);
    }

    function handleFinishLoad() {
      cleanup();
      resolve();
    }

    function handleFailLoad(_event, errorCode, errorDescription, validatedUrl, isMainFrame) {
      if (isMainFrame === false) {
        return;
      }

      if (Number(errorCode) === -3) {
        return;
      }

      cleanup();
      reject(new Error(`Failed to load ${validatedUrl || '<unknown>'}: ${errorDescription || errorCode}`));
    }

    windowInstance.webContents.once('did-finish-load', handleFinishLoad);
    windowInstance.webContents.on('did-fail-load', handleFailLoad);
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  options.cookie = await resolveCookie(options);
  options.origin = normalizeText(options.origin) || DEFAULT_SELLER_ORIGIN;

  await app.whenReady();

  const partition = `temu-category-sync-${Date.now().toString(36)}`;
  const windowInstance = new BrowserWindow({
    show: false,
    webPreferences: {
      partition,
      contextIsolation: true,
      sandbox: false
    }
  });

  windowInstance.webContents.setUserAgent(BROWSER_USER_AGENT);
  windowInstance.webContents.on('console-message', (_event, _level, message) => {
    if (message) {
      console.log(message);
    }
  });

  try {
    const targetSession = windowInstance.webContents.session;

    await applyCookies(targetSession, options.origin, options.cookie);
    try {
      await windowInstance.loadURL(`${options.origin}/`);
    } catch (error) {
      if (!/ERR_ABORTED/i.test(String(error && error.message))) {
        throw error;
      }
    }
    await waitForPageLoad(windowInstance);

    console.log(`Starting browser-context category crawl from ${options.origin}`);
    const payload = await windowInstance.webContents.executeJavaScript(
      buildCrawlerScript({
        origin: options.origin,
        categoryChildrenPath: CATEGORY_CHILDREN_PATH,
        concurrency: options.concurrency,
        retryTimes: options.retryTimes,
        version: 1
      }),
      true
    );

    await writeOutputFile(options.outputFilePath, payload);
    console.log(`Local snapshot written to ${options.outputFilePath}`);

    if (options.skipCloud !== true) {
      const uploadResult = await uploadCloudSnapshot(options.cloudCacheKey, payload);
      console.log(`Cloud snapshot uploaded to ${options.cloudCacheKey}`);
      console.log(`Cloud URL: ${uploadResult.url}`);
    }

    console.log(
      `Completed. roots=${payload.stats.rootCount}, total=${payload.stats.totalCount}, leaves=${payload.stats.leafCount}, maxLevel=${payload.stats.maxLevel}, requests=${payload.stats.requestCount}`
    );
  } finally {
    windowInstance.destroy();
    app.quit();
  }
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
