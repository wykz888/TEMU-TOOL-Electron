(() => {
  const UNGROUPED_SECTION_ID = '__ungrouped__';

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildEmptyCatalog() {
    return {
      updatedAt: '',
      shops: [],
      sections: [],
      shopMap: Object.create(null)
    };
  }

  function normalizeGroupRecord(group) {
    return {
      id: normalizeText(group && group.id),
      name: normalizeText(group && group.name)
    };
  }

  function normalizeShopRecord(shop) {
    const groupId = normalizeText(shop && shop.groupId);
    const groupName = normalizeText(shop && shop.groupName) || '\u672A\u5206\u7EC4';
    const accountValue = normalizeText(
      shop && (shop.accountValue || shop.email || shop.phoneNumber)
    );
    const shopName = normalizeText(shop && shop.shopName);
    const note = normalizeText(shop && shop.note);

    return {
      id: normalizeText(shop && shop.id),
      shopName,
      accountValue,
      note,
      groupId,
      groupName,
      isVisible: !(shop && shop.isVisible === false),
      searchText: [shopName, accountValue, groupName, note].filter(Boolean).join(' ').toLowerCase()
    };
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    return Array.from(
      new Set(
        (Array.isArray(selectedShopIds) ? selectedShopIds : [])
          .map((shopId) => normalizeText(shopId))
          .filter(Boolean)
      )
    );
  }

  function getShopManagementStore() {
    if (
      window.shopManagementStore
      && typeof window.shopManagementStore.getState === 'function'
    ) {
      return window.shopManagementStore;
    }

    if (
      window.temuApp
      && window.temuApp.shopManagement
      && typeof window.temuApp.shopManagement.getState === 'function'
    ) {
      return window.temuApp.shopManagement;
    }

    return null;
  }

  function buildCatalogFromShopState(rawState) {
    const baseCatalog = buildEmptyCatalog();
    const normalizedGroups = Array.isArray(rawState && rawState.groups)
      ? rawState.groups
        .map(normalizeGroupRecord)
        .filter((group) => group.id && group.name)
      : [];
    const normalizedShops = Array.isArray(rawState && rawState.shops)
      ? rawState.shops
        .map(normalizeShopRecord)
        .filter((shop) => shop.id && shop.shopName && shop.isVisible !== false)
      : [];
    const orderedSections = normalizedGroups.map((group) => ({
      id: group.id,
      label: group.name,
      shops: []
    }));
    const sectionMap = new Map(orderedSections.map((section) => [section.id, section]));
    const ungroupedSection = {
      id: UNGROUPED_SECTION_ID,
      label: '\u672A\u5206\u7EC4',
      shops: []
    };

    normalizedShops
      .sort((left, right) => (
        normalizeText(left.shopName).localeCompare(normalizeText(right.shopName), 'zh-CN')
      ))
      .forEach((shop) => {
        const section = sectionMap.get(shop.groupId) || ungroupedSection;
        section.shops.push(shop);
        baseCatalog.shopMap[shop.id] = shop;
      });

    baseCatalog.updatedAt = normalizeText(rawState && rawState.updatedAt);
    baseCatalog.shops = normalizedShops;
    baseCatalog.sections = orderedSections.filter((section) => section.shops.length > 0);

    if (ungroupedSection.shops.length > 0) {
      baseCatalog.sections.push(ungroupedSection);
    }

    return baseCatalog;
  }

  async function loadShopCatalog() {
    const store = getShopManagementStore();

    if (!store) {
      throw new Error('\u5E97\u94FA\u6570\u636E\u6A21\u5757\u672A\u52A0\u8F7D');
    }

    const state = await store.getState();
    return buildCatalogFromShopState(state);
  }

  function buildVisibleSections(catalog, keyword = '') {
    const normalizedKeyword = normalizeText(keyword).toLowerCase();
    const normalizedCatalog = catalog && typeof catalog === 'object'
      ? catalog
      : buildEmptyCatalog();

    return (Array.isArray(normalizedCatalog.sections) ? normalizedCatalog.sections : [])
      .map((section) => {
        const visibleShops = normalizedKeyword
          ? section.shops.filter((shop) => shop.searchText.includes(normalizedKeyword))
          : section.shops.slice();

        return {
          ...section,
          visibleShops
        };
      })
      .filter((section) => section.visibleShops.length > 0);
  }

  function buildSelectedSummary(catalog, selectedShopIds, options = {}) {
    const normalizedIds = normalizeSelectedShopIds(selectedShopIds);
    const normalizedCatalog = catalog && typeof catalog === 'object'
      ? catalog
      : buildEmptyCatalog();

    if (options.loading === true) {
      return '\u6B63\u5728\u52A0\u8F7D\u5E97\u94FA';
    }

    if (normalizedIds.length === 0) {
      return '\u5168\u90E8\u5E97\u94FA';
    }

    const names = normalizedIds
      .map((shopId) => normalizedCatalog.shopMap && normalizedCatalog.shopMap[shopId])
      .filter(Boolean)
      .map((shop) => shop.shopName);

    if (names.length === 0) {
      return '\u5DF2\u9009\u5E97\u94FA';
    }

    if (names.length === 1) {
      return names[0];
    }

    if (names.length === 2) {
      return `${names[0]} / ${names[1]}`;
    }

    return `${names[0]} / ${names[1]} +${names.length - 2}`;
  }

  function buildMetaText(catalog, selectedShopIds, options = {}) {
    const normalizedCatalog = catalog && typeof catalog === 'object'
      ? catalog
      : buildEmptyCatalog();
    const selectedCount = normalizeSelectedShopIds(selectedShopIds).length;
    const totalCount = Array.isArray(normalizedCatalog.shops) ? normalizedCatalog.shops.length : 0;

    if (options.loading === true) {
      return '\u52A0\u8F7D\u4E2D';
    }

    if (options.error) {
      return '\u52A0\u8F7D\u5F02\u5E38';
    }

    if (selectedCount > 0) {
      return `\u5DF2\u9009 ${selectedCount} \u5BB6`;
    }

    if (totalCount > 0) {
      return `\u5171 ${totalCount} \u5BB6`;
    }

    return '\u6682\u65E0\u5E97\u94FA';
  }

  function setAllVisibleSelection(catalog, selectedShopIds, keyword, checked) {
    const nextSelection = new Set(normalizeSelectedShopIds(selectedShopIds));

    buildVisibleSections(catalog, keyword).forEach((section) => {
      section.visibleShops.forEach((shop) => {
        if (checked) {
          nextSelection.add(shop.id);
        } else {
          nextSelection.delete(shop.id);
        }
      });
    });

    return Array.from(nextSelection);
  }

  function setGroupSelection(catalog, selectedShopIds, sectionId, keyword, checked) {
    const nextSelection = new Set(normalizeSelectedShopIds(selectedShopIds));
    const targetSection = buildVisibleSections(catalog, keyword)
      .find((section) => normalizeText(section.id) === normalizeText(sectionId));

    if (!targetSection) {
      return Array.from(nextSelection);
    }

    targetSection.visibleShops.forEach((shop) => {
      if (checked) {
        nextSelection.add(shop.id);
      } else {
        nextSelection.delete(shop.id);
      }
    });

    return Array.from(nextSelection);
  }

  function toggleShopSelection(selectedShopIds, shopId, checked) {
    const nextSelection = new Set(normalizeSelectedShopIds(selectedShopIds));
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return Array.from(nextSelection);
    }

    if (checked) {
      nextSelection.add(normalizedShopId);
    } else {
      nextSelection.delete(normalizedShopId);
    }

    return Array.from(nextSelection);
  }

  function normalizeTemplateRecords(templates) {
    return (Array.isArray(templates) ? templates : [])
      .map((template) => {
        const id = normalizeText(template && template.id);
        const selectedShopIds = normalizeSelectedShopIds(template && template.selectedShopIds);

        if (!id || selectedShopIds.length <= 0) {
          return null;
        }

        return {
          id,
          name: normalizeText(template && template.name) || '\u5E97\u94FA\u6A21\u677F',
          selectedShopIds,
          updatedAt: normalizeText(template && template.updatedAt)
        };
      })
      .filter(Boolean);
  }

  function normalizeLastSelection(lastSelection) {
    return {
      selectedShopIds: normalizeSelectedShopIds(lastSelection && lastSelection.selectedShopIds),
      updatedAt: normalizeText(lastSelection && lastSelection.updatedAt)
    };
  }

  function renderSelectionTemplatePanel(presets, selectedShopIds) {
    if (!presets || presets.enabled !== true) {
      return '';
    }

    const templates = normalizeTemplateRecords(presets.templates);
    const lastSelection = normalizeLastSelection(presets.lastSelection);
    const templateName = normalizeText(presets.templateName);
    const errorText = normalizeText(presets.error);
    const loading = presets.loading === true;
    const saving = presets.saving === true;
    const selectedCount = normalizeSelectedShopIds(selectedShopIds).length;
    const templateItems = loading
      ? `
        <span class="shop-multi-select-template-empty">\u540C\u6B65\u4E2D...</span>
      `
      : templates.length > 0
        ? templates.map((template) => `
          <span class="shop-multi-select-template-chip">
            <button
              class="shop-multi-select-template-apply"
              type="button"
              data-shop-multi-select-template-apply="${escapeHtml(template.id)}"
              title="${escapeHtml(template.name)}"
            >
              <span>${escapeHtml(template.name)}</span>
              <em>${template.selectedShopIds.length}\u5BB6</em>
            </button>
            <button
              class="shop-multi-select-template-delete"
              type="button"
              data-shop-multi-select-template-delete="${escapeHtml(template.id)}"
              aria-label="\u5220\u9664\u6A21\u677F"
              title="\u5220\u9664"
              ${saving ? 'disabled' : ''}
            >
              &times;
            </button>
          </span>
        `).join('')
        : `
          <span class="shop-multi-select-template-empty">\u6682\u65E0\u6A21\u677F</span>
        `;

    return `
      <div class="shop-multi-select-template-panel">
        <div class="shop-multi-select-template-save-row">
          <input
            class="shop-multi-select-template-name"
            type="text"
            maxlength="40"
            value="${escapeHtml(templateName)}"
            placeholder="\u6A21\u677F\u540D\u79F0"
            data-shop-multi-select-template-name="true"
          />
          <button
            class="shop-multi-select-template-button"
            type="button"
            data-shop-multi-select-template-save="true"
            ${selectedCount <= 0 || saving ? 'disabled' : ''}
          >
            ${saving ? '\u4FDD\u5B58\u4E2D' : '\u4FDD\u5B58\u6A21\u677F'}
          </button>
          <button
            class="shop-multi-select-template-button"
            type="button"
            data-shop-multi-select-restore-last="true"
            ${lastSelection.selectedShopIds.length <= 0 || saving ? 'disabled' : ''}
          >
            \u4E0A\u6B21\u52FE\u9009
          </button>
        </div>
        <div class="shop-multi-select-template-list">
          ${templateItems}
        </div>
        ${errorText ? `
          <div class="shop-multi-select-template-error">${escapeHtml(errorText)}</div>
        ` : ''}
      </div>
    `;
  }

  function render(config = {}) {
    const catalog = config.catalog && typeof config.catalog === 'object'
      ? config.catalog
      : buildEmptyCatalog();
    const selectedShopIds = normalizeSelectedShopIds(config.selectedShopIds);
    const selectedIdSet = new Set(selectedShopIds);
    const keyword = normalizeText(config.keyword);
    const visibleSections = buildVisibleSections(catalog, keyword);
    const visibleCount = visibleSections.reduce((total, section) => total + section.visibleShops.length, 0);
    const totalCount = Array.isArray(catalog.shops) ? catalog.shops.length : 0;
    const disabled = config.disabled === true || (config.loading !== true && totalCount === 0);
    const allVisibleSelected = visibleCount > 0 && visibleSections.every((section) => (
      section.visibleShops.every((shop) => selectedIdSet.has(shop.id))
    ));
    const summaryText = buildSelectedSummary(catalog, selectedShopIds, config);
    const metaText = buildMetaText(catalog, selectedShopIds, config);
    const emptyText = config.error
      ? normalizeText(config.error)
      : config.loading === true
        ? '\u6B63\u5728\u540C\u6B65\u5E97\u94FA\u5217\u8868...'
        : totalCount <= 0
          ? '\u6682\u65E0\u53EF\u9009\u5E97\u94FA'
          : '\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u5E97\u94FA';

    return `
      <div class="shop-multi-select" data-shop-multi-select>
        <button
          class="shop-multi-select-trigger${config.open === true ? ' is-open' : ''}${config.compact === true ? ' is-compact' : ''}"
          type="button"
          data-shop-multi-select-toggle="true"
          aria-expanded="${config.open === true ? 'true' : 'false'}"
          ${disabled ? 'disabled' : ''}
        >
          <span class="shop-multi-select-trigger-copy${config.compact === true ? ' is-compact' : ''}">
            <span class="shop-multi-select-trigger-value">${escapeHtml(summaryText)}</span>
            <span class="shop-multi-select-trigger-meta">${escapeHtml(metaText)}</span>
          </span>
          <span class="shop-multi-select-trigger-arrow" aria-hidden="true">&#9662;</span>
        </button>
        ${config.open === true ? `
          <div class="shop-multi-select-panel" data-shop-multi-select-panel>
            ${renderSelectionTemplatePanel(config.shopSelectionPresets, selectedShopIds)}
            <div class="shop-multi-select-search-shell">
              <input
                class="shop-multi-select-search"
                type="text"
                value="${escapeHtml(keyword)}"
                placeholder="\u641C\u7D22\u5E97\u94FA\u540D / \u8D26\u53F7 / \u5907\u6CE8"
                data-shop-multi-select-search="true"
              />
            </div>
            <div class="shop-multi-select-toolbar">
              <button
                class="shop-multi-select-toolbar-button"
                type="button"
                data-shop-multi-select-action="select-visible"
                ${visibleCount <= 0 || allVisibleSelected ? 'disabled' : ''}
              >
                \u5168\u9009\u5F53\u524D
              </button>
              <button
                class="shop-multi-select-toolbar-button"
                type="button"
                data-shop-multi-select-action="clear"
                ${selectedShopIds.length <= 0 ? 'disabled' : ''}
              >
                \u6E05\u7A7A
              </button>
              <span class="shop-multi-select-toolbar-meta">
                \u663E\u793A ${visibleCount} / ${totalCount}
              </span>
            </div>
            <div class="shop-multi-select-section-list">
              ${visibleSections.length > 0 ? visibleSections.map((section) => {
                const sectionAllSelected =
                  section.visibleShops.length > 0
                  && section.visibleShops.every((shop) => selectedIdSet.has(shop.id));

                return `
                  <section class="shop-multi-select-section">
                    <div class="shop-multi-select-section-head">
                      <div class="shop-multi-select-section-copy">
                        <strong class="shop-multi-select-section-title">${escapeHtml(section.label)}</strong>
                        <span class="shop-multi-select-section-meta">${section.visibleShops.length} \u5BB6</span>
                      </div>
                      <button
                        class="shop-multi-select-section-action"
                        type="button"
                        data-shop-multi-select-section="${escapeHtml(section.id)}"
                        data-shop-multi-select-section-mode="${sectionAllSelected ? 'clear' : 'select'}"
                      >
                        ${sectionAllSelected ? '\u53D6\u6D88' : '\u5168\u9009'}
                      </button>
                    </div>
                    <div class="shop-multi-select-shop-list">
                      ${section.visibleShops.map((shop) => `
                        <label class="shop-multi-select-shop-item">
                          <input
                            type="checkbox"
                            data-shop-multi-select-shop="${escapeHtml(shop.id)}"
                            ${selectedIdSet.has(shop.id) ? 'checked' : ''}
                          />
                          <span class="shop-multi-select-shop-copy">
                            <span class="shop-multi-select-shop-name">${escapeHtml(shop.shopName)}</span>
                            <span class="shop-multi-select-shop-meta">
                              ${escapeHtml(shop.groupName)}${shop.accountValue ? ` / ${escapeHtml(shop.accountValue)}` : ''}
                            </span>
                            ${shop.note ? `
                              <span class="shop-multi-select-shop-note" title="${escapeHtml(shop.note)}">
                                \u5907\u6CE8: ${escapeHtml(shop.note)}
                              </span>
                            ` : ''}
                          </span>
                        </label>
                      `).join('')}
                    </div>
                  </section>
                `;
              }).join('') : `
                <div class="shop-multi-select-empty">
                  ${escapeHtml(emptyText)}
                </div>
              `}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  window.shopMultiSelectControl = {
    UNGROUPED_SECTION_ID,
    buildEmptyCatalog,
    buildCatalogFromShopState,
    buildSelectedSummary,
    buildVisibleSections,
    loadShopCatalog,
    normalizeSelectedShopIds,
    render,
    setAllVisibleSelection,
    setGroupSelection,
    toggleShopSelection
  };
})();
