(() => {
  const MAX_CATEGORY_LEVEL = 4;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeInputValue(value) {
    return String(value == null ? '' : value);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    const id = normalizeText(
      category && (
        category.catId
        || category.id
      )
    );

    if (!id) {
      return null;
    }

    return {
      id,
      label: normalizeText(
        category && (
          category.catName
          || category.label
        )
      ),
      level: normalizeIntegerValue(
        category && (
          category.catLevel
          || category.level
        ),
        0
      ),
      parentId: normalizeText(
        category && (
          category.parentCatId
          || category.parentId
        )
      ),
      isLeaf: normalizeBooleanValue(category && category.isLeaf, false)
    };
  }

  function normalizeCategoryList(list) {
    return (Array.isArray(list) ? list : [])
      .map(normalizeCategoryRecord)
      .filter((category) => category && category.id && category.label);
  }

  function normalizePath(path) {
    return normalizeCategoryList(path).slice(0, MAX_CATEGORY_LEVEL);
  }

  function buildPathKey(path) {
    return normalizePath(path)
      .map((item) => item.id)
      .filter(Boolean)
      .join('/');
  }

  function normalizePathCollection(paths) {
    const pathMap = new Map();

    (Array.isArray(paths) ? paths : []).forEach((path) => {
      const normalizedPath = normalizePath(path);
      const pathKey = buildPathKey(normalizedPath);

      if (!pathKey || pathMap.has(pathKey)) {
        return;
      }

      pathMap.set(pathKey, normalizedPath);
    });

    return Array.from(pathMap.values());
  }

  function normalizeSearchResultRecord(result) {
    const primaryPath = normalizePath(result && result.path);
    const fallbackPath = normalizePath([result]);
    const resolvedPath = primaryPath.length > 0 ? primaryPath : fallbackPath;
    const lastCategory = resolvedPath[resolvedPath.length - 1] || null;
    const id = normalizeText(
      result && (
        result.catId
        || result.id
      )
    ) || normalizeText(lastCategory && lastCategory.id);

    if (!id) {
      return null;
    }

    const pathLabels = resolvedPath.map((item) => item.label).filter(Boolean);
    const pathIds = resolvedPath.map((item) => item.id).filter(Boolean);

    return {
      id,
      label: normalizeText(
        result && (
          result.catName
          || result.label
        )
      ) || normalizeText(lastCategory && lastCategory.label),
      level: normalizeIntegerValue(
        result && (
          result.catLevel
          || result.level
        ),
        normalizeIntegerValue(lastCategory && lastCategory.level, 0)
      ),
      parentId: normalizeText(
        result && (
          result.parentCatId
          || result.parentId
        )
      ) || normalizeText(lastCategory && lastCategory.parentId),
      isLeaf: normalizeBooleanValue(
        result && result.isLeaf,
        normalizeBooleanValue(lastCategory && lastCategory.isLeaf, false)
      ),
      path: resolvedPath,
      pathLabels,
      pathIds,
      pathKey: buildPathKey(resolvedPath),
      pathText: normalizeText(result && result.pathText) || pathLabels.join(' / ')
    };
  }

  function normalizeSearchResultList(results) {
    return (Array.isArray(results) ? results : [])
      .map(normalizeSearchResultRecord)
      .filter((result) => result && result.id && result.label);
  }

  function buildEmptySnapshot() {
    return {
      updatedAt: '',
      syncedAt: '',
      shopId: '',
      sourceOrigin: '',
      categories: [],
      source: 'default',
      cloudSynced: false,
      warning: ''
    };
  }

  function normalizeSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object'
      ? snapshot
      : {};

    return {
      ...buildEmptySnapshot(),
      ...source,
      updatedAt: normalizeText(source.updatedAt),
      syncedAt: normalizeText(source.syncedAt),
      shopId: normalizeText(source.shopId),
      sourceOrigin: normalizeText(source.sourceOrigin),
      categories: normalizeCategoryList(source.categories),
      source: normalizeText(source.source) || 'default',
      cloudSynced: source.cloudSynced === true,
      warning: normalizeText(source.warning)
    };
  }

  function getLevelTitle(level) {
    if (level === 1) {
      return '\u4E00\u7EA7\u7C7B\u76EE';
    }

    if (level === 2) {
      return '\u4E8C\u7EA7\u7C7B\u76EE';
    }

    if (level === 3) {
      return '\u4E09\u7EA7\u7C7B\u76EE';
    }

    if (level === 4) {
      return '\u56DB\u7EA7\u7C7B\u76EE';
    }

    return `\u7B2C${Math.max(1, normalizeIntegerValue(level, 1))}\u7EA7\u7C7B\u76EE`;
  }

  function buildSelectedSummary(snapshot, selectedPath, checkedPaths, config = {}) {
    const normalizedCheckedPaths = normalizePathCollection(checkedPaths);

    if (config.loadingRoots === true && normalizedCheckedPaths.length <= 0) {
      return '\u6B63\u5728\u52A0\u8F7D\u7C7B\u76EE';
    }

    if (normalizedCheckedPaths.length > 0) {
      return `\u5DF2\u9009 ${normalizedCheckedPaths.length} \u4E2A\u7C7B\u76EE`;
    }

    if (normalizePath(selectedPath).length > 0 && config.showBrowseSummary === true) {
      return normalizePath(selectedPath).map((item) => item.label).join(' / ');
    }

    return normalizeText(config.placeholder) || '\u8BF7\u9009\u62E9\u7C7B\u76EE';
  }

  function buildMetaText(snapshot, selectedPath, checkedPaths, config = {}) {
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    const normalizedCheckedPaths = normalizePathCollection(checkedPaths);
    const normalizedPath = normalizePath(selectedPath);

    if (config.syncingRoots === true) {
      return '\u6B63\u5728\u540C\u6B65\u4E3B\u7C7B\u76EE';
    }

    if (config.loadingRoots === true) {
      return '\u6B63\u5728\u8BFB\u53D6\u4E3B\u7C7B\u76EE';
    }

    if (normalizedCheckedPaths.length > 0) {
      return `\u5DF2\u9009 ${normalizedCheckedPaths.length} \u4E2A`;
    }

    if (normalizedPath.length > 0) {
      return `\u5DF2\u5B9A\u4F4D ${normalizedPath.length} \u7EA7`;
    }

    if (normalizedSnapshot.categories.length > 0) {
      return `\u4E3B\u7C7B\u76EE ${normalizedSnapshot.categories.length} \u4E2A`;
    }

    return '\u6682\u65E0\u4E3B\u7C7B\u76EE';
  }

  function renderSelectedTags(checkedPaths, config = {}) {
    const normalizedCheckedPaths = normalizePathCollection(checkedPaths);
    const visibleCount = Math.max(1, normalizeIntegerValue(config.maxVisibleTags, 3));
    const triggerSelectionMode = normalizeText(config.triggerSelectionMode).toLowerCase();

    if (normalizedCheckedPaths.length <= 0) {
      return `
        <span class="category-cascade-trigger-value">
          ${escapeHtml(normalizeText(config.placeholder) || '\u8BF7\u9009\u62E9\u7C7B\u76EE')}
        </span>
      `;
    }

    if (triggerSelectionMode === 'count') {
      return `
        <span class="category-cascade-trigger-value">
          ${escapeHtml(`\u5DF2\u9009 ${normalizedCheckedPaths.length} \u4E2A\u7C7B\u76EE`)}
        </span>
      `;
    }

    return `
      <span class="category-cascade-trigger-tags">
        ${normalizedCheckedPaths.slice(0, visibleCount).map((path) => {
          const pathText = path.map((item) => item.label).join(' / ');

          return `
            <span class="category-cascade-trigger-tag" title="${escapeHtml(pathText)}">
              ${escapeHtml(pathText)}
            </span>
          `;
        }).join('')}
        ${normalizedCheckedPaths.length > visibleCount ? `
          <span class="category-cascade-trigger-tag is-muted">
            +${normalizedCheckedPaths.length - visibleCount}
          </span>
        ` : ''}
      </span>
    `;
  }

  function renderSearchResults(config = {}) {
    const showSearch = config.showSearch === true;
    const searchKeyword = normalizeInputValue(config.searchKeyword);
    const normalizedKeyword = normalizeText(searchKeyword);
    const searchResults = normalizeSearchResultList(config.searchResults);
    const checkedPathKeys = config.checkedPathKeys instanceof Set
      ? config.checkedPathKeys
      : new Set();
    const hasRenderableState = (
      config.searchLoading === true
      || normalizeText(config.searchErrorText)
      || searchResults.length > 0
      || normalizedKeyword
    );

    if (!showSearch || !hasRenderableState) {
      return '';
    }

    return `
      <div class="category-cascade-search-panel">
        <div class="category-cascade-search-head">
          <span class="category-cascade-search-title">\u641C\u7D22\u7ED3\u679C</span>
          ${normalizeIntegerValue(config.searchTotal, 0) > 0 ? `
            <span class="category-cascade-search-meta">
              ${escapeHtml(String(config.searchTotal))}
            </span>
          ` : ''}
        </div>
        <div class="category-cascade-search-body">
          ${config.searchLoading === true ? `
            <div class="category-cascade-empty">
              \u6B63\u5728\u641C\u7D22\u7C7B\u76EE...
            </div>
          ` : normalizeText(config.searchErrorText) ? `
            <div class="category-cascade-empty is-error">
              ${escapeHtml(normalizeText(config.searchErrorText))}
            </div>
          ` : searchResults.length > 0 ? searchResults.map((result) => `
            <button
              class="category-cascade-search-item${checkedPathKeys.has(result.pathKey) ? ' is-checked' : ''}"
              type="button"
              data-category-cascade-search-result="true"
              data-category-id="${escapeHtml(result.id)}"
            >
              <span class="category-cascade-search-item-head">
                <span class="category-cascade-search-item-title">${escapeHtml(result.label)}</span>
                <span class="category-cascade-search-item-meta">
                  ${checkedPathKeys.has(result.pathKey) ? '\u5DF2\u9009' : `L${Math.max(1, result.level)}`}
                </span>
              </span>
              <span class="category-cascade-search-item-path">${escapeHtml(result.pathText)}</span>
            </button>
          `).join('') : `
            <div class="category-cascade-empty">
              \u672A\u627E\u5230\u76F8\u5173\u7C7B\u76EE
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderColumn(column, config = {}) {
    const items = normalizeCategoryList(column && column.items);
    const level = Math.max(1, normalizeIntegerValue(column && column.level, 1));
    const selectedId = normalizeText(column && column.selectedId);
    const loading = column && column.loading === true;
    const errorText = normalizeText(column && column.error);
    const emptyText = normalizeText(column && column.emptyText)
      || `\u6682\u65E0\u7B2C${level}\u7EA7\u7C7B\u76EE`;
    const titleText = normalizeText(column && column.title)
      || getLevelTitle(level);
    const pathPrefix = normalizePath(column && column.pathPrefix);
    const checkedPathKeys = config.checkedPathKeys instanceof Set
      ? config.checkedPathKeys
      : new Set();
    const multipleSelection = config.multipleSelection === true;
    const selectedCount = multipleSelection
      ? items.reduce((result, item) => {
        const itemPath = normalizePath(pathPrefix.concat(item));
        const pathKey = buildPathKey(itemPath);

        return result + (checkedPathKeys.has(pathKey) ? 1 : 0);
      }, 0)
      : 0;

    return `
      <section class="category-cascade-column" data-category-cascade-column="${level}">
        <header class="category-cascade-column-head">
          <span class="category-cascade-column-head-copy">
            <strong class="category-cascade-column-title">${escapeHtml(titleText)}</strong>
            <span class="category-cascade-column-meta">
              ${multipleSelection ? `${escapeHtml(String(selectedCount))} / ${escapeHtml(String(items.length))}` : escapeHtml(String(items.length))}
            </span>
          </span>
          ${multipleSelection ? `
            <span class="category-cascade-column-head-actions">
              <button
                class="category-cascade-column-action"
                type="button"
                data-category-cascade-column-action="select-all"
                data-category-cascade-level="${level}"
                ${items.length <= 0 ? 'disabled' : ''}
              >
                \u5168\u9009\u672C\u5217
              </button>
              <button
                class="category-cascade-column-action is-secondary"
                type="button"
                data-category-cascade-column-action="clear"
                data-category-cascade-level="${level}"
                ${selectedCount <= 0 ? 'disabled' : ''}
              >
                \u6E05\u7A7A\u672C\u5217
              </button>
            </span>
          ` : ''}
        </header>
        <div class="category-cascade-column-body">
          ${loading === true ? `
            <div class="category-cascade-empty">
              \u6B63\u5728\u52A0\u8F7D...
            </div>
          ` : errorText ? `
            <div class="category-cascade-empty is-error">
              ${escapeHtml(errorText)}
            </div>
          ` : items.length > 0 ? items.map((item) => {
            const itemPath = normalizePath(pathPrefix.concat(item));
            const pathKey = buildPathKey(itemPath);
            const checked = checkedPathKeys.has(pathKey);

            return `
              <div class="category-cascade-item${item.id === selectedId ? ' is-active' : ''}${checked ? ' is-checked' : ''}">
                ${multipleSelection ? `
                  <label class="category-cascade-item-check">
                    <input
                      class="category-cascade-item-checkbox"
                      type="checkbox"
                      data-category-cascade-check="true"
                      data-category-cascade-level="${level}"
                      data-category-id="${escapeHtml(item.id)}"
                      ${checked ? 'checked' : ''}
                    />
                  </label>
                ` : ''}
                <button
                  class="category-cascade-item-button"
                  type="button"
                  data-category-cascade-item="true"
                  data-category-cascade-level="${level}"
                  data-category-id="${escapeHtml(item.id)}"
                >
                  <span class="category-cascade-item-label">${escapeHtml(item.label)}</span>
                  <span class="category-cascade-item-meta">
                    ${item.isLeaf === true || level >= MAX_CATEGORY_LEVEL ? '\u672B\u7EA7' : '&#8250;'}
                  </span>
                </button>
              </div>
            `;
          }).join('') : `
            <div class="category-cascade-empty">
              ${escapeHtml(emptyText)}
            </div>
          `}
        </div>
      </section>
    `;
  }

  function render(config = {}) {
    const snapshot = normalizeSnapshot(config.snapshot);
    const selectedPath = normalizePath(config.selectedPath);
    const checkedPaths = normalizePathCollection(config.checkedPaths);
    const checkedPathKeys = new Set(
      checkedPaths
        .map((path) => buildPathKey(path))
        .filter(Boolean)
    );
    const columns = Array.isArray(config.columns) ? config.columns : [];
    const summaryText = buildSelectedSummary(snapshot, selectedPath, checkedPaths, config);
    const metaText = buildMetaText(snapshot, selectedPath, checkedPaths, config);
    const showTriggerMeta = config.hideTriggerMeta !== true;
    const showSyncRootAction = config.showSyncRootAction !== false;
    const showSearch = config.showSearch === true;
    const showClearAction = config.showClearAction !== false;
    const showToolbarMeta = config.showToolbarMeta !== false;
    const showHelperText = config.showHelperText !== false;
    const showErrorText = config.showErrorText !== false;
    const disabled =
      config.disabled === true
      || (config.loadingRoots !== true && snapshot.categories.length <= 0 && config.allowEmptyOpen !== true);
    const helperText = normalizeText(config.helperText);
    const errorText = normalizeText(config.errorText) || normalizeText(snapshot.warning);
    const visibleHelperText = showHelperText ? helperText : '';
    const visibleErrorText = showErrorText ? errorText : '';
    const shouldRenderToolbar = (
      showSyncRootAction
      || showSearch
      || showToolbarMeta
      || (showClearAction && checkedPaths.length > 0)
    );
    const shouldRenderNotes = Boolean(visibleHelperText || visibleErrorText);

    return `
      <div class="category-cascade" data-category-cascade>
        <button
          class="category-cascade-trigger${config.open === true ? ' is-open' : ''}${config.compact === true ? ' is-compact' : ''}"
          type="button"
          data-category-cascade-toggle="true"
          aria-expanded="${config.open === true ? 'true' : 'false'}"
          aria-label="${escapeHtml(summaryText)}"
          ${disabled ? 'disabled' : ''}
        >
          <span class="category-cascade-trigger-copy${config.compact === true ? ' is-compact' : ''}">
            ${renderSelectedTags(checkedPaths, config)}
            ${showTriggerMeta ? `
              <span class="category-cascade-trigger-meta">${escapeHtml(metaText)}</span>
            ` : ''}
          </span>
          <span class="category-cascade-trigger-arrow" aria-hidden="true">&#9662;</span>
        </button>
        ${config.open === true ? `
          <div class="category-cascade-panel" data-category-cascade-panel>
            ${shouldRenderToolbar ? `
              <div class="category-cascade-toolbar">
                ${showSyncRootAction ? `
                  <button
                    class="category-cascade-toolbar-button"
                    type="button"
                    data-category-cascade-action="sync-root"
                    ${config.syncingRoots === true ? 'disabled' : ''}
                  >
                    ${config.syncingRoots === true ? '\u540C\u6B65\u4E2D...' : '\u540C\u6B65\u4E3B\u7C7B\u76EE'}
                  </button>
                ` : ''}
                ${showSearch ? `
                  <label class="category-cascade-search">
                    <input
                      class="category-cascade-search-input"
                      type="search"
                      placeholder="${escapeHtml(normalizeText(config.searchPlaceholder) || '\u641C\u7D22\u7C7B\u76EE')}"
                      value="${escapeHtml(normalizeInputValue(config.searchKeyword))}"
                      data-category-cascade-search="true"
                    />
                  </label>
                ` : ''}
                ${showClearAction ? `
                  <button
                    class="category-cascade-toolbar-button is-secondary"
                    type="button"
                    data-category-cascade-action="clear"
                    ${checkedPaths.length <= 0 ? 'disabled' : ''}
                  >
                    \u6E05\u7A7A
                  </button>
                ` : ''}
                ${showToolbarMeta ? `
                  <span class="category-cascade-toolbar-meta">
                    ${snapshot.source === 'cloud' ? '\u4E91\u7AEF' : snapshot.source === 'local' || snapshot.source === 'local-fallback' ? '\u672C\u5730' : '\u672A\u540C\u6B65'}
                  </span>
                ` : ''}
              </div>
            ` : ''}
            ${renderSearchResults({
              showSearch,
              searchKeyword: config.searchKeyword,
              searchResults: config.searchResults,
              searchLoading: config.searchLoading,
              searchErrorText: config.searchErrorText,
              searchTotal: config.searchTotal,
              checkedPathKeys
            })}
            ${shouldRenderNotes ? `
              <div class="category-cascade-notes">
                ${visibleHelperText ? `
                  <div class="category-cascade-note">
                    ${escapeHtml(visibleHelperText)}
                  </div>
                ` : ''}
                ${visibleErrorText ? `
                  <div class="category-cascade-note is-error">
                    ${escapeHtml(visibleErrorText)}
                  </div>
                ` : ''}
              </div>
            ` : ''}
            <div class="category-cascade-columns">
              ${columns.map((column) => renderColumn(column, {
                checkedPathKeys,
                multipleSelection: config.multipleSelection === true
              })).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  window.categoryCascadeControl = {
    MAX_CATEGORY_LEVEL,
    buildEmptySnapshot,
    normalizeCategoryRecord,
    normalizeCategoryList,
    normalizePath,
    normalizeSnapshot,
    normalizeSearchResultList,
    normalizePathCollection,
    buildPathKey,
    render
  };
})();
