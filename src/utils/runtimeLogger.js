const fs = require('node:fs');
const path = require('node:path');
const { getAppDataRoot } = require('./persistenceRoots');
const {
  ensureDatedLogDirectory,
  cleanupExpiredDatedLogDirectories
} = require('./datedLogDirectory');

const LOG_DIRECTORY_NAME = 'runtime_logs';
const LOG_FILE_NAME = 'electron-runtime.log';
const LOG_RETENTION_DAY_COUNT = 15;

function createRuntimeLogger({ app }) {
  const MAX_ENTRY_CACHE = 500;
  const MAX_READ_LIMIT = 5000;
  const DEFAULT_READ_LIMIT = 60;
  const FLUSH_DEBOUNCE_MS = 240;
  const MAX_BUFFERED_LINE_COUNT = 24;

  let pendingLines = [];
  let flushTimer = 0;
  let flushPromise = Promise.resolve();
  let hydrated = false;
  let hydrating = false;
  let hydratePromise = null;
  let recentEntries = [];
  let totalCount = 0;
  let lastUpdatedAt = '';
  let memoryEntrySequence = 0;
  let cacheDayKey = '';
  let persistedDayKey = '';
  let preparedDirectoryDayKey = '';
  let prepareDirectoryPromise = null;

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function buildDayKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function resolveCurrentDayKey() {
    return buildDayKey(new Date());
  }

  function parseLogLine(line) {
    try {
      return JSON.parse(line);
    } catch (_error) {
      return null;
    }
  }

  function resolveLogLineDayKey(line) {
    const parsed = parseLogLine(line);

    if (!parsed || typeof parsed !== 'object') {
      return '';
    }

    return buildDayKey(normalizeText(parsed.time));
  }

  function filterLogLinesByDay(lines, dayKey = resolveCurrentDayKey()) {
    const targetDayKey = normalizeText(dayKey);

    if (!Array.isArray(lines) || !targetDayKey) {
      return [];
    }

    return lines.filter((line) => resolveLogLineDayKey(line) === targetDayKey);
  }

  function clearHydratedCacheForDay(dayKey = resolveCurrentDayKey()) {
    cacheDayKey = normalizeText(dayKey);
    recentEntries = [];
    totalCount = 0;
    lastUpdatedAt = '';
  }

  async function rewriteLogFile(logFilePath, lines) {
    const nextLines = Array.isArray(lines) ? lines.filter(Boolean) : [];

    await fs.promises.mkdir(path.dirname(logFilePath), { recursive: true });
    await fs.promises.writeFile(
      logFilePath,
      nextLines.length > 0 ? `${nextLines.join('\n')}\n` : '',
      'utf8'
    );
  }

  function getLogRootDirectoryPath() {
    return path.join(
      getAppDataRoot(app),
      'local_state',
      LOG_DIRECTORY_NAME
    );
  }

  function getLogFilePath(dayKey = resolveCurrentDayKey()) {
    const normalizedDayKey = normalizeText(dayKey) || resolveCurrentDayKey();

    return path.join(
      getLogRootDirectoryPath(),
      normalizedDayKey,
      LOG_FILE_NAME
    );
  }

  async function ensureLogDirectoryReady(dayKey = resolveCurrentDayKey()) {
    const normalizedDayKey = normalizeText(dayKey) || resolveCurrentDayKey();

    while (preparedDirectoryDayKey !== normalizedDayKey) {
      if (!prepareDirectoryPromise) {
        prepareDirectoryPromise = (async () => {
          const rootDirectoryPath = getLogRootDirectoryPath();

          await cleanupExpiredDatedLogDirectories(
            rootDirectoryPath,
            LOG_RETENTION_DAY_COUNT
          );

          const preparedDirectory = await ensureDatedLogDirectory(
            rootDirectoryPath,
            normalizedDayKey
          );

          preparedDirectoryDayKey = normalizeText(preparedDirectory.dayKey);
          return preparedDirectory;
        })().finally(() => {
          prepareDirectoryPromise = null;
        });
      }

      await prepareDirectoryPromise;
    }
  }

  function normalizeError(error) {
    if (!error) {
      return null;
    }

    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || ''
    };
  }

  function truncateText(value, maxLength = 320) {
    const text = normalizeText(value);

    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
  }

  function buildEventSourceLabel(eventName) {
    const normalizedEventName = normalizeText(eventName);

    if (!normalizedEventName) {
      return '\u901a\u7528\u65e5\u5fd7';
    }

    if (
      normalizedEventName === 'promotion_monitor_action_executed'
      || normalizedEventName === 'promotion_monitor_action_failed'
    ) {
      return '\u63a8\u5e7f\u4fee\u6539';
    }

    const sourceRules = [
      { pattern: /^(promotion_monitor_|promotion_master_)/, label: '\u63a8\u5e7f\u76d1\u63a7' },
      { pattern: /^(shop_product_promotion_|shop_background_browser_|shop_browser_|shop_window_)/, label: '\u5e97\u94fa\u6d4f\u89c8\u5668' },
      { pattern: /^shop_scoped_session_/, label: '\u5e97\u94fa\u4f1a\u8bdd' },
      { pattern: /^(login_|logout$|auth_)/, label: '\u767b\u5f55\u4f1a\u8bdd' },
      { pattern: /^(main_window_|app_|before_quit$|will_quit$|window_all_closed$|uncaught_exception$|unhandled_rejection$)/, label: '\u5e94\u7528\u8fd0\u884c' }
    ];

    const matchedRule = sourceRules.find((rule) => rule.pattern.test(normalizedEventName));

    if (matchedRule) {
      return matchedRule.label;
    }

    const segments = normalizedEventName.split('_').filter(Boolean);

    if (segments.length === 0) {
      return '\u901a\u7528\u65e5\u5fd7';
    }

    return truncateText(segments.slice(0, 2).join('/'), 32) || '\u901a\u7528\u65e5\u5fd7';
  }

  function buildEventLabel(eventName) {
    const normalizedEventName = normalizeText(eventName);
    const eventLabelMap = {
      promotion_monitor_stage_changed: '\u76d1\u63a7\u9636\u6bb5',
      promotion_monitor_shop_synced: '\u5e97\u94fa\u540c\u6b65\u5b8c\u6210',
      promotion_monitor_shop_sync_failed: '\u5e97\u94fa\u540c\u6b65\u5931\u8d25',
      promotion_monitor_action_executed: '\u5546\u54c1\u4fee\u6539\u6210\u529f',
      promotion_monitor_action_failed: '\u5546\u54c1\u4fee\u6539\u5931\u8d25',
      promotion_monitor_shop_toggle: '\u5e97\u94fa\u76d1\u63a7\u5f00\u5173',
      promotion_monitor_batch_toggle: '\u6279\u91cf\u76d1\u63a7\u5f00\u5173',
      promotion_monitor_relogin_trigger_failed: '\u91cd\u767b\u89e6\u53d1\u5931\u8d25',
      promotion_master_region_cookies_refreshed: 'Cookies \u533a\u57df\u5237\u65b0',
      promotion_master_cookie_cache_cloud_read_failed: '\u8bfb\u53d6\u4e91\u7aef Cookies \u5931\u8d25',
      promotion_master_cookie_cache_cloud_write_failed: '\u5199\u5165\u4e91\u7aef Cookies \u5931\u8d25',
      promotion_master_cookie_cache_local_read_failed: '\u8bfb\u53d6\u672c\u5730 Cookies \u5931\u8d25',
      promotion_master_cookie_cache_local_write_failed: '\u5199\u5165\u672c\u5730 Cookies \u5931\u8d25',
      promotion_master_partition_reconciled: '\u4f1a\u8bdd\u5206\u533a\u4fee\u6b63',
      promotion_master_proxy_auth_supplied: '\u4ee3\u7406\u9274\u6743\u5df2\u63d0\u4f9b',
      promotion_master_proxy_auth_missing: '\u4ee3\u7406\u9274\u6743\u7f3a\u5931',
      promotion_master_session_proxy_resolved: '\u4f1a\u8bdd\u4ee3\u7406\u89e3\u6790',
      promotion_master_session_proxy_resolve_failed: '\u4f1a\u8bdd\u4ee3\u7406\u89e3\u6790\u5931\u8d25',
      shop_scoped_session_default_session_blocked: '\u5df2\u963b\u6b62 defaultSession \u56de\u9000',
      login_success: '\u767b\u5f55\u6210\u529f',
      logout: '\u9000\u51fa\u767b\u5f55',
      app_ready: '\u5e94\u7528\u5c31\u7eea'
    };

    if (eventLabelMap[normalizedEventName]) {
      return eventLabelMap[normalizedEventName];
    }

    if (/^promotion_monitor_/.test(normalizedEventName)) {
      return '\u63a8\u5e7f\u76d1\u63a7';
    }

    if (/^promotion_master_/.test(normalizedEventName)) {
      return 'Cookies \u4e0e\u4f1a\u8bdd';
    }

    return normalizedEventName || 'runtime_log';
  }

  function buildRegionLabel(regionId) {
    const regionLabelMap = {
      us: '\u7f8e\u533a',
      eu: '\u6b27\u533a',
      global: '\u5168\u7403'
    };

    return regionLabelMap[normalizeText(regionId)] || normalizeText(regionId);
  }

  function buildActionLabel(actionType) {
    const actionLabelMap = {
      pause_plan: '\u6682\u505c\u8ba1\u5212',
      pause_then_resume: '\u6682\u505c\u540e\u6062\u590d',
      resume_plan: '\u6062\u590d\u8ba1\u5212',
      delete_plan: '\u5220\u9664\u8ba1\u5212',
      update_roas: '\u4fee\u6539 ROAS',
      increase_roas: '\u589e\u52a0 ROAS'
    };

    return actionLabelMap[normalizeText(actionType)] || normalizeText(actionType);
  }

  function buildShopSourceLabel(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return '';
    }

    const shopId = normalizeText(payload.shopId);
    const shopName = normalizeText(payload.shopName || payload.storeName || payload.shopLabel);

    if (shopName && shopId) {
      return truncateText(`${shopName} (${shopId})`, 96);
    }

    return truncateText(shopName || shopId, 96);
  }

  function buildProductLabel(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return '';
    }

    const goodsId = normalizeText(payload.goodsId);
    const productName = normalizeText(
      payload.productName || payload.goodsName || payload.productTitle || payload.title
    );

    if (productName && goodsId) {
      return truncateText(`${productName} (${goodsId})`, 128);
    }

    return truncateText(productName || goodsId, 128);
  }

  function buildPayloadPreview(eventName, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return '';
    }

    const normalizedEventName = normalizeText(eventName);
    const entries = Object.entries(payload);

    if (entries.length === 0) {
      return '';
    }

    if (normalizeText(payload.message)) {
      return truncateText(payload.message, 360);
    }

    const shopSource = buildShopSourceLabel(payload);
    const regionLabel = buildRegionLabel(payload.regionId);
    const productLabel = buildProductLabel(payload);
    const actionLabel = buildActionLabel(payload.executedActionType || payload.actionType);

    if (
      normalizedEventName === 'promotion_monitor_action_executed'
      || normalizedEventName === 'promotion_monitor_action_failed'
    ) {
      return truncateText(
        [
          shopSource ? `\u5e97\u94fa ${shopSource}` : '',
          regionLabel,
          actionLabel,
          productLabel ? `\u5546\u54c1 ${productLabel}` : ''
        ].filter(Boolean).join('\uff0c'),
        360
      );
    }

    if (normalizedEventName === 'promotion_monitor_shop_synced') {
      return truncateText(
        shopSource ? `\u5e97\u94fa ${shopSource} \u5df2\u5b8c\u6210\u540c\u6b65` : '\u5e97\u94fa\u5df2\u5b8c\u6210\u540c\u6b65',
        360
      );
    }

    if (normalizedEventName === 'promotion_monitor_shop_sync_failed') {
      return truncateText(
        shopSource ? `\u5e97\u94fa ${shopSource} \u540c\u6b65\u5931\u8d25` : '\u5e97\u94fa\u540c\u6b65\u5931\u8d25',
        360
      );
    }

    try {
      return truncateText(JSON.stringify(payload), 360);
    } catch (_error) {
      return truncateText(
        entries
          .map(([key, value]) => `${key}=${normalizeText(
            typeof value === 'string' ? value : JSON.stringify(value)
          )}`)
          .join(', '),
        360
      );
    }
  }

  function buildErrorPreview(error) {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const name = normalizeText(error.name);
    const message = normalizeText(error.message);
    const stack = normalizeText(error.stack).split(/\r?\n/).filter(Boolean)[0] || '';
    const parts = [name, message, stack].filter(Boolean);

    return truncateText(parts.join(' | '), 260);
  }

  function pickPayloadText(payload, fieldNames) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return '';
    }

    for (const fieldName of fieldNames) {
      const value = normalizeText(payload[fieldName]);

      if (value) {
        return value;
      }
    }

    return '';
  }

  function resolveReadLimit(value) {
    return Math.max(1, Math.min(MAX_READ_LIMIT, Number.parseInt(value, 10) || DEFAULT_READ_LIMIT));
  }

  function resolveReadOffset(value) {
    return Math.max(0, Number.parseInt(value, 10) || 0);
  }

  function normalizeReadEventPrefixes(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(new Set(
      value
        .map((item) => normalizeText(item))
        .filter(Boolean)
    ));
  }

  function matchesEventPrefixes(eventName, eventPrefixes) {
    const normalizedEventName = normalizeText(eventName);

    if (!Array.isArray(eventPrefixes) || eventPrefixes.length === 0) {
      return true;
    }

    if (!normalizedEventName) {
      return false;
    }

    return eventPrefixes.some((prefix) => normalizedEventName.startsWith(prefix));
  }

  function buildEntryFromLogLine(line, entryId) {
    try {
      const parsed = JSON.parse(line);
      const payload = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => !['time', 'event', 'error'].includes(key))
      );
      const errorPayload = parsed && parsed.error && typeof parsed.error === 'object'
        ? parsed.error
        : null;
      const time = normalizeText(parsed && parsed.time);
      const eventName = normalizeText(parsed && parsed.event);

      return {
        id: `${time}:${eventName}:${entryId}`,
        time,
        eventName,
        event: buildEventLabel(eventName),
        source: buildEventSourceLabel(eventName),
        summary: buildPayloadPreview(eventName, payload),
        errorMessage: buildErrorPreview(errorPayload),
        level: errorPayload ? 'error' : 'info',
        shopId: pickPayloadText(payload, ['shopId']),
        shopName: pickPayloadText(payload, ['shopName', 'storeName', 'shopLabel']),
        regionId: pickPayloadText(payload, ['regionId']),
        goodsId: pickPayloadText(payload, ['goodsId']),
        productName: pickPayloadText(payload, ['productName', 'goodsName', 'productTitle', 'title']),
        actionType: pickPayloadText(payload, ['executedActionType', 'actionType'])
      };
    } catch (_error) {
      return {
        id: `raw:${entryId}`,
        time: '',
        eventName: '',
        event: 'runtime_log_parse_failed',
        source: '\u65e5\u5fd7\u89e3\u6790',
        summary: truncateText(line, 360),
        errorMessage: '\u8fd9\u6761\u65e5\u5fd7\u4e0d\u662f\u5408\u6cd5 JSON \u8bb0\u5f55',
        level: 'error',
        shopId: '',
        shopName: '',
        regionId: '',
        goodsId: '',
        productName: '',
        actionType: ''
      };
    }
  }

  function clearFlushTimer() {
    if (!flushTimer) {
      return;
    }

    clearTimeout(flushTimer);
    flushTimer = 0;
  }

  async function flushPendingLines() {
    clearFlushTimer();

    if (pendingLines.length === 0) {
      return flushPromise;
    }

    const linesToWrite = pendingLines.slice();
    pendingLines = [];
    const logFilePath = getLogFilePath();
    const currentDayKey = resolveCurrentDayKey();
    const filteredLinesToWrite = filterLogLinesByDay(linesToWrite, currentDayKey);

    flushPromise = flushPromise
      .catch(() => {})
      .then(async () => {
        await ensureLogDirectoryReady(currentDayKey);

        if (persistedDayKey !== currentDayKey) {
          let existingLines = [];

          try {
            const rawText = await fs.promises.readFile(logFilePath, 'utf8');

            existingLines = filterLogLinesByDay(
              rawText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
              currentDayKey
            );
          } catch (error) {
            if (!(error && error.code === 'ENOENT')) {
              throw error;
            }
          }

          await rewriteLogFile(logFilePath, [
            ...existingLines,
            ...filteredLinesToWrite
          ]);
          persistedDayKey = currentDayKey;
          return;
        }

        if (filteredLinesToWrite.length === 0) {
          return;
        }

        await fs.promises.mkdir(path.dirname(logFilePath), { recursive: true });
        await fs.promises.appendFile(logFilePath, `${filteredLinesToWrite.join('\n')}\n`, 'utf8');
      })
      .catch(() => {});

    return flushPromise;
  }

  function scheduleFlush() {
    if (pendingLines.length >= MAX_BUFFERED_LINE_COUNT) {
      void flushPendingLines();
      return;
    }

    if (flushTimer) {
      return;
    }

    flushTimer = setTimeout(() => {
      flushTimer = 0;
      void flushPendingLines();
    }, FLUSH_DEBOUNCE_MS);
  }

  function updateHydratedCache(line) {
    if (!hydrated) {
      return;
    }

    const currentDayKey = resolveCurrentDayKey();
    const lineDayKey = resolveLogLineDayKey(line);

    if (cacheDayKey !== currentDayKey) {
      clearHydratedCacheForDay(currentDayKey);
    }

    if (!lineDayKey || lineDayKey !== currentDayKey) {
      return;
    }

    const entry = buildEntryFromLogLine(line, `mem-${memoryEntrySequence}`);

    memoryEntrySequence += 1;
    recentEntries.unshift(entry);

    if (recentEntries.length > MAX_ENTRY_CACHE) {
      recentEntries.length = MAX_ENTRY_CACHE;
    }

    totalCount += 1;
    lastUpdatedAt = entry.time || new Date().toISOString();
  }

  async function readCurrentDayLines(logFilePath, currentDayKey) {
    let rawText = '';

    await flushPendingLines();
    await ensureLogDirectoryReady(currentDayKey);

    try {
      rawText = await fs.promises.readFile(logFilePath, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        persistedDayKey = currentDayKey;
        return [];
      }

      throw error;
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const currentDayLines = filterLogLinesByDay(lines, currentDayKey);

    if (currentDayLines.length !== lines.length) {
      await rewriteLogFile(logFilePath, currentDayLines);
    }

    persistedDayKey = currentDayKey;
    return currentDayLines;
  }

  async function ensureHydrated() {
    if (hydrated) {
      return;
    }

    if (hydratePromise) {
      return hydratePromise;
    }

    hydratePromise = (async () => {
      hydrating = true;

      const logFilePath = getLogFilePath();
      const currentDayKey = resolveCurrentDayKey();
      const currentDayLines = await readCurrentDayLines(logFilePath, currentDayKey);

      clearHydratedCacheForDay(currentDayKey);
      totalCount = currentDayLines.length;

      for (
        let index = currentDayLines.length - 1;
        index >= 0 && recentEntries.length < MAX_ENTRY_CACHE;
        index -= 1
      ) {
        recentEntries.push(buildEntryFromLogLine(currentDayLines[index], index));
      }

      const pendingLinesDuringHydration = pendingLines.slice();

      lastUpdatedAt = recentEntries.length > 0
        ? normalizeText(recentEntries[0] && recentEntries[0].time)
        : '';
      hydrated = true;
      pendingLinesDuringHydration.forEach((line) => updateHydratedCache(line));
    })()
      .finally(() => {
        hydrating = false;
        hydratePromise = null;

        if (pendingLines.length > 0) {
          scheduleFlush();
        }
      });

    return hydratePromise;
  }

  function readFilteredEntriesFromLines(lines, limit, offset, eventPrefixes) {
    const entries = [];
    let filteredCount = 0;
    let filteredUpdatedAt = '';
    let matchedOffset = 0;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const entry = buildEntryFromLogLine(lines[index], index);

      if (!matchesEventPrefixes(entry && entry.eventName, eventPrefixes)) {
        continue;
      }

      filteredCount += 1;

      if (!filteredUpdatedAt) {
        filteredUpdatedAt = normalizeText(entry && entry.time);
      }

      if (matchedOffset < offset) {
        matchedOffset += 1;
        continue;
      }

      if (entries.length < limit) {
        entries.push(entry);
      }
    }

    return {
      updatedAt: filteredUpdatedAt,
      totalCount: filteredCount,
      offset,
      hasMore: filteredCount > offset + entries.length,
      entries
    };
  }

  async function readEntries(options = {}) {
    const logFilePath = getLogFilePath();
    const limit = resolveReadLimit(options.limit);
    const offset = resolveReadOffset(options.offset);
    const eventPrefixes = normalizeReadEventPrefixes(options.eventPrefixes);
    const currentDayKey = resolveCurrentDayKey();

    await ensureHydrated();

    if (cacheDayKey !== currentDayKey) {
      clearHydratedCacheForDay(currentDayKey);
    }

    if (eventPrefixes.length > 0 || offset > 0) {
      const lines = await readCurrentDayLines(logFilePath, currentDayKey);
      const filteredResult = readFilteredEntriesFromLines(
        lines,
        limit,
        offset,
        eventPrefixes
      );

      return {
        updatedAt: filteredResult.updatedAt,
        filePath: logFilePath,
        limit,
        offset,
        totalCount: filteredResult.totalCount,
        hasMore: filteredResult.hasMore,
        entries: filteredResult.entries.map((entry) => ({ ...entry }))
      };
    }

    return {
      updatedAt: lastUpdatedAt,
      filePath: logFilePath,
      limit,
      offset: 0,
      totalCount,
      hasMore: totalCount > limit,
      entries: recentEntries.slice(0, limit).map((entry) => ({ ...entry }))
    };
  }

  function appendLine(line) {
    pendingLines.push(line);
    updateHydratedCache(line);

    if (hydrating !== true) {
      scheduleFlush();
    }
  }

  return {
    log(eventName, payload = {}) {
      appendLine(
        JSON.stringify({
          time: new Date().toISOString(),
          event: eventName,
          ...payload
        })
      );
    },
    logError(eventName, error, payload = {}) {
      appendLine(
        JSON.stringify({
          time: new Date().toISOString(),
          event: eventName,
          ...payload,
          error: normalizeError(error)
        })
      );
    },
    getLogFilePath,
    readEntries,
    flush() {
      return flushPendingLines();
    }
  };
}

module.exports = {
  createRuntimeLogger
};
