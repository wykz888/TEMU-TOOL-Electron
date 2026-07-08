(() => {
  const DEFAULT_SCOPE_KEY = 'operations-shared';

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeScopeKey(value) {
    const normalizedValue = normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalizedValue || DEFAULT_SCOPE_KEY;
  }

  function normalizeSelectedShopIds(selectedShopIds) {
    return Array.from(new Set(
      (Array.isArray(selectedShopIds) ? selectedShopIds : [])
        .map((shopId) => normalizeText(shopId))
        .filter(Boolean)
    ));
  }

  function getFeatureCenterApi() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter === 'object'
    ) {
      return window.temuApp.featureCenter;
    }

    return null;
  }

  function normalizeTemplate(template) {
    const id = normalizeText(template && template.id);
    const selectedShopIds = normalizeSelectedShopIds(template && template.selectedShopIds);

    if (!id || selectedShopIds.length <= 0) {
      return null;
    }

    return {
      id,
      name: normalizeText(template && template.name) || '\u5e97\u94fa\u6a21\u677f',
      selectedShopIds,
      createdAt: normalizeText(template && template.createdAt),
      updatedAt: normalizeText(template && template.updatedAt)
    };
  }

  function normalizeTemplateList(templates) {
    return (Array.isArray(templates) ? templates : [])
      .map(normalizeTemplate)
      .filter(Boolean);
  }

  function normalizeLastSelection(lastSelection, scopeKey) {
    const selectedShopIds = normalizeSelectedShopIds(lastSelection && lastSelection.selectedShopIds);

    return {
      scopeKey: normalizeScopeKey(lastSelection && lastSelection.scopeKey || scopeKey),
      selectedShopIds,
      updatedAt: normalizeText(lastSelection && lastSelection.updatedAt)
    };
  }

  function createState(scopeKey) {
    const normalizedScopeKey = normalizeScopeKey(scopeKey);

    return {
      scopeKey: normalizedScopeKey,
      templates: [],
      lastSelection: normalizeLastSelection(null, normalizedScopeKey),
      templateName: '',
      loading: false,
      saving: false,
      loaded: false,
      error: '',
      promise: null
    };
  }

  function applySnapshotResponse(state, response) {
    const snapshot = response && response.snapshot && typeof response.snapshot === 'object'
      ? response.snapshot
      : {};
    const scopeKey = normalizeScopeKey(snapshot.scopeKey || state.scopeKey);

    state.scopeKey = scopeKey;
    state.templates = normalizeTemplateList(snapshot.templates);
    state.lastSelection = normalizeLastSelection(snapshot.lastSelection, scopeKey);
    state.loaded = true;
    state.error = response && response.warning
      ? '\u4e91\u7aef\u540c\u6b65\u5931\u8d25'
      : '';

    return state;
  }

  function notify(options) {
    if (options && typeof options.onChange === 'function') {
      options.onChange();
    }
  }

  async function loadSnapshot(state, options = {}) {
    const targetState = state && typeof state === 'object'
      ? state
      : createState(DEFAULT_SCOPE_KEY);
    const featureCenterApi = getFeatureCenterApi();

    if (targetState.loading === true && targetState.promise) {
      return targetState.promise;
    }

    if (options.force !== true && targetState.loaded === true) {
      return targetState;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.getOperationsShopSelectionSnapshot !== 'function'
    ) {
      targetState.loaded = true;
      return targetState;
    }

    targetState.loading = true;
    targetState.error = '';
    notify(options);

    targetState.promise = featureCenterApi.getOperationsShopSelectionSnapshot({
      scopeKey: targetState.scopeKey
    })
      .then((response) => applySnapshotResponse(targetState, response))
      .catch(() => {
        targetState.loaded = true;
        targetState.error = '\u5e97\u94fa\u6a21\u677f\u52a0\u8f7d\u5931\u8d25';
        return targetState;
      })
      .finally(() => {
        targetState.loading = false;
        targetState.promise = null;
        notify(options);
      });

    return targetState.promise;
  }

  async function saveLastSelection(state, selectedShopIds, options = {}) {
    const targetState = state && typeof state === 'object'
      ? state
      : createState(DEFAULT_SCOPE_KEY);
    const normalizedSelectedShopIds = normalizeSelectedShopIds(selectedShopIds);
    const featureCenterApi = getFeatureCenterApi();

    if (normalizedSelectedShopIds.length <= 0 && options.allowEmpty !== true) {
      return null;
    }

    targetState.lastSelection = {
      scopeKey: targetState.scopeKey,
      selectedShopIds: normalizedSelectedShopIds,
      updatedAt: new Date().toISOString()
    };

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsShopSelectionLast !== 'function'
    ) {
      return targetState;
    }

    try {
      const response = await featureCenterApi.saveOperationsShopSelectionLast({
        scopeKey: targetState.scopeKey,
        selectedShopIds: normalizedSelectedShopIds
      });

      return applySnapshotResponse(targetState, response);
    } catch (_error) {
      targetState.error = '\u4e91\u7aef\u540c\u6b65\u5931\u8d25';
      return targetState;
    }
  }

  async function saveTemplate(state, selectedShopIds, options = {}) {
    const targetState = state && typeof state === 'object'
      ? state
      : createState(DEFAULT_SCOPE_KEY);
    const normalizedSelectedShopIds = normalizeSelectedShopIds(selectedShopIds);
    const featureCenterApi = getFeatureCenterApi();

    if (normalizedSelectedShopIds.length <= 0) {
      targetState.error = '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa';
      notify(options);
      return targetState;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.saveOperationsShopSelectionTemplate !== 'function'
    ) {
      targetState.error = '\u5e97\u94fa\u6a21\u677f\u670d\u52a1\u672a\u52a0\u8f7d';
      notify(options);
      return targetState;
    }

    targetState.saving = true;
    targetState.error = '';
    notify(options);

    try {
      const response = await featureCenterApi.saveOperationsShopSelectionTemplate({
        scopeKey: targetState.scopeKey,
        name: targetState.templateName,
        selectedShopIds: normalizedSelectedShopIds
      });

      applySnapshotResponse(targetState, response);
      targetState.templateName = '';
      return targetState;
    } catch (_error) {
      targetState.error = '\u5e97\u94fa\u6a21\u677f\u4fdd\u5b58\u5931\u8d25';
      return targetState;
    } finally {
      targetState.saving = false;
      notify(options);
    }
  }

  async function deleteTemplate(state, templateId, options = {}) {
    const targetState = state && typeof state === 'object'
      ? state
      : createState(DEFAULT_SCOPE_KEY);
    const normalizedTemplateId = normalizeText(templateId);
    const featureCenterApi = getFeatureCenterApi();

    if (!normalizedTemplateId) {
      return targetState;
    }

    if (
      !featureCenterApi
      || typeof featureCenterApi.deleteOperationsShopSelectionTemplate !== 'function'
    ) {
      targetState.error = '\u5e97\u94fa\u6a21\u677f\u670d\u52a1\u672a\u52a0\u8f7d';
      notify(options);
      return targetState;
    }

    targetState.saving = true;
    targetState.error = '';
    notify(options);

    try {
      const response = await featureCenterApi.deleteOperationsShopSelectionTemplate({
        scopeKey: targetState.scopeKey,
        templateId: normalizedTemplateId
      });

      return applySnapshotResponse(targetState, response);
    } catch (_error) {
      targetState.error = '\u5e97\u94fa\u6a21\u677f\u5220\u9664\u5931\u8d25';
      return targetState;
    } finally {
      targetState.saving = false;
      notify(options);
    }
  }

  function buildControlConfig(state) {
    const targetState = state && typeof state === 'object'
      ? state
      : createState(DEFAULT_SCOPE_KEY);

    return {
      enabled: true,
      templateName: normalizeText(targetState.templateName),
      templates: normalizeTemplateList(targetState.templates),
      lastSelection: normalizeLastSelection(targetState.lastSelection, targetState.scopeKey),
      loading: targetState.loading === true,
      saving: targetState.saving === true,
      error: normalizeText(targetState.error)
    };
  }

  function findTemplateSelection(state, templateId) {
    const normalizedTemplateId = normalizeText(templateId);
    const template = normalizeTemplateList(state && state.templates)
      .find((item) => item.id === normalizedTemplateId);

    return template ? template.selectedShopIds.slice() : [];
  }

  function getLastSelectionIds(state) {
    return normalizeSelectedShopIds(state && state.lastSelection && state.lastSelection.selectedShopIds);
  }

  window.operationsShopSelectionTemplates = {
    buildControlConfig,
    createState,
    deleteTemplate,
    findTemplateSelection,
    getLastSelectionIds,
    loadSnapshot,
    normalizeSelectedShopIds,
    saveLastSelection,
    saveTemplate
  };
})();
