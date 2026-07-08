const {
  createEntityId,
  normalizeText,
  nowIso
} = require('../shopManagement/common');
const {
  createOperationsShopSelectionStore
} = require('./operationsShopSelectionStore');

const PROFILE_VERSION = 1;
const DEFAULT_SCOPE_KEY = 'operations-shared';
const MAX_TEMPLATE_COUNT = 50;

function createOperationsShopSelectionService({
  sessionStore,
  featureCenterProfileService,
  runtimeLogger
}) {
  const store = createOperationsShopSelectionStore({
    sessionStore,
    featureCenterProfileService
  });

  function logError(eventName, error, payload) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error, payload);
    }
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

  function normalizeOwner(owner) {
    return owner ? {
      userId: normalizeText(owner.userId),
      username: normalizeText(owner.username),
      userKey: normalizeText(owner.userKey)
    } : null;
  }

  function buildDefaultProfile(owner) {
    return {
      version: PROFILE_VERSION,
      owner: normalizeOwner(owner),
      updatedAt: '',
      templates: [],
      lastSelections: {}
    };
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(
      payload && typeof payload === 'object' && payload.updatedAt
        ? payload.updatedAt
        : ''
    );

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? { source: 'cloud', payload: cloudPayload }
        : { source: 'local', payload: localPayload };
    }

    if (cloudPayload) {
      return { source: 'cloud', payload: cloudPayload };
    }

    if (localPayload) {
      return { source: 'local', payload: localPayload };
    }

    return { source: 'default', payload: null };
  }

  function normalizeTemplateName(value, selectedShopIds) {
    const normalizedValue = normalizeText(value).slice(0, 40);

    if (normalizedValue) {
      return normalizedValue;
    }

    const selectedCount = normalizeSelectedShopIds(selectedShopIds).length;

    return selectedCount > 0
      ? `\u5e97\u94fa\u6a21\u677f ${selectedCount}\u5bb6`
      : '\u5e97\u94fa\u6a21\u677f';
  }

  function normalizeTemplate(template) {
    const selectedShopIds = normalizeSelectedShopIds(template && template.selectedShopIds);
    const id = normalizeText(template && template.id);

    if (!id || selectedShopIds.length <= 0) {
      return null;
    }

    const createdAt = normalizeText(template && template.createdAt);
    const updatedAt = normalizeText(template && template.updatedAt) || createdAt;

    return {
      id,
      name: normalizeTemplateName(template && template.name, selectedShopIds),
      selectedShopIds,
      createdAt,
      updatedAt
    };
  }

  function compareTemplates(left, right) {
    const rightTime = Date.parse(right && right.updatedAt || right && right.createdAt || '') || 0;
    const leftTime = Date.parse(left && left.updatedAt || left && left.createdAt || '') || 0;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return normalizeText(left && left.name).localeCompare(normalizeText(right && right.name), 'zh-CN');
  }

  function normalizeLastSelections(lastSelections) {
    const source = lastSelections && typeof lastSelections === 'object' && !Array.isArray(lastSelections)
      ? lastSelections
      : {};
    const result = {};

    Object.keys(source).forEach((scopeKey) => {
      const normalizedScopeKey = normalizeScopeKey(scopeKey);
      const sourceEntry = source[scopeKey];
      const selectedShopIds = normalizeSelectedShopIds(sourceEntry && sourceEntry.selectedShopIds);

      if (selectedShopIds.length <= 0) {
        return;
      }

      result[normalizedScopeKey] = {
        scopeKey: normalizedScopeKey,
        selectedShopIds,
        updatedAt: normalizeText(sourceEntry && sourceEntry.updatedAt)
      };
    });

    return result;
  }

  function normalizeProfile(profile, owner) {
    const baseProfile = buildDefaultProfile(owner);
    const input = profile && typeof profile === 'object' && !Array.isArray(profile)
      ? profile
      : {};
    const templateMap = new Map();

    (Array.isArray(input.templates) ? input.templates : [])
      .map(normalizeTemplate)
      .filter(Boolean)
      .forEach((template) => {
        templateMap.set(template.id, template);
      });

    return {
      ...baseProfile,
      updatedAt: normalizeText(input.updatedAt),
      templates: Array.from(templateMap.values())
        .sort(compareTemplates)
        .slice(0, MAX_TEMPLATE_COUNT),
      lastSelections: normalizeLastSelections(input.lastSelections)
    };
  }

  function buildSnapshot(profile, scopeKey, source, cloudSynced, warning) {
    const normalizedScopeKey = normalizeScopeKey(scopeKey);
    const lastSelection = profile.lastSelections[normalizedScopeKey] || {
      scopeKey: normalizedScopeKey,
      selectedShopIds: [],
      updatedAt: ''
    };

    return {
      snapshot: {
        version: PROFILE_VERSION,
        owner: profile.owner,
        updatedAt: normalizeText(profile.updatedAt),
        scopeKey: normalizedScopeKey,
        templates: profile.templates,
        lastSelection
      },
      source,
      cloudSynced: cloudSynced === true,
      warning: normalizeText(warning)
    };
  }

  async function readCurrentProfile(scopeKey) {
    const readResult = await store.readProfile();
    const owner = readResult.owner || store.getOwner();
    const newerPayload = pickNewerPayload(readResult.localProfile, readResult.cloudProfile);
    const profile = normalizeProfile(newerPayload.payload, owner);

    return {
      owner,
      scopeKey: normalizeScopeKey(scopeKey),
      profile,
      source: newerPayload.source
    };
  }

  async function persistProfile(profile, metadata = {}) {
    const persistResult = await store.writeProfile(profile, metadata);

    return {
      cloudSynced: persistResult.cloudSynced === true,
      warning: normalizeText(persistResult.warning)
    };
  }

  async function getSnapshot(payload = {}) {
    const current = await readCurrentProfile(payload && payload.scopeKey);

    return buildSnapshot(current.profile, current.scopeKey, current.source, true, '');
  }

  async function saveLastSelection(payload = {}) {
    const current = await readCurrentProfile(payload && payload.scopeKey);
    const selectedShopIds = normalizeSelectedShopIds(payload && payload.selectedShopIds);
    const updatedAt = nowIso();
    const nextProfile = normalizeProfile({
      ...current.profile,
      updatedAt,
      lastSelections: {
        ...current.profile.lastSelections,
        [current.scopeKey]: {
          scopeKey: current.scopeKey,
          selectedShopIds,
          updatedAt
        }
      }
    }, current.owner);
    const persistResult = await persistProfile(nextProfile, {
      record_action: 'save-last-selection',
      scope_key: current.scopeKey
    });

    return buildSnapshot(
      nextProfile,
      current.scopeKey,
      'local',
      persistResult.cloudSynced,
      persistResult.warning
    );
  }

  async function saveTemplate(payload = {}) {
    const current = await readCurrentProfile(payload && payload.scopeKey);
    const selectedShopIds = normalizeSelectedShopIds(payload && payload.selectedShopIds);

    if (selectedShopIds.length <= 0) {
      return buildSnapshot(
        current.profile,
        current.scopeKey,
        current.source,
        false,
        '\u8bf7\u5148\u9009\u62e9\u5e97\u94fa'
      );
    }

    const updatedAt = nowIso();
    const requestedTemplateId = normalizeText(payload && payload.templateId);
    const requestedName = normalizeTemplateName(payload && payload.name, selectedShopIds);
    const existingTemplate = current.profile.templates.find((template) => (
      normalizeText(template.id) === requestedTemplateId
      || normalizeText(template.name) === requestedName
    ));
    const nextTemplate = normalizeTemplate({
      id: existingTemplate ? existingTemplate.id : (requestedTemplateId || createEntityId('shop_selection_template')),
      name: requestedName,
      selectedShopIds,
      createdAt: existingTemplate ? existingTemplate.createdAt : updatedAt,
      updatedAt
    });
    const nextTemplateMap = new Map(
      current.profile.templates.map((template) => [normalizeText(template.id), template])
    );

    if (nextTemplate) {
      nextTemplateMap.set(nextTemplate.id, nextTemplate);
    }

    const nextProfile = normalizeProfile({
      ...current.profile,
      updatedAt,
      templates: Array.from(nextTemplateMap.values())
    }, current.owner);
    const persistResult = await persistProfile(nextProfile, {
      record_action: 'save-template',
      scope_key: current.scopeKey,
      template_id: nextTemplate ? nextTemplate.id : ''
    });

    return buildSnapshot(
      nextProfile,
      current.scopeKey,
      'local',
      persistResult.cloudSynced,
      persistResult.warning
    );
  }

  async function deleteTemplate(payload = {}) {
    const current = await readCurrentProfile(payload && payload.scopeKey);
    const templateId = normalizeText(payload && payload.templateId);
    const updatedAt = nowIso();
    const nextProfile = normalizeProfile({
      ...current.profile,
      updatedAt,
      templates: current.profile.templates.filter((template) => normalizeText(template.id) !== templateId)
    }, current.owner);
    const persistResult = await persistProfile(nextProfile, {
      record_action: 'delete-template',
      scope_key: current.scopeKey,
      template_id: templateId
    });

    return buildSnapshot(
      nextProfile,
      current.scopeKey,
      'local',
      persistResult.cloudSynced,
      persistResult.warning
    );
  }

  return {
    async getSnapshot(payload = {}) {
      try {
        return await getSnapshot(payload);
      } catch (error) {
        logError('operations_shop_selection_get_snapshot_failed', error, {
          scopeKey: normalizeScopeKey(payload && payload.scopeKey)
        });
        throw error;
      }
    },

    async saveLastSelection(payload = {}) {
      try {
        return await saveLastSelection(payload);
      } catch (error) {
        logError('operations_shop_selection_save_last_failed', error, {
          scopeKey: normalizeScopeKey(payload && payload.scopeKey)
        });
        throw error;
      }
    },

    async saveTemplate(payload = {}) {
      try {
        return await saveTemplate(payload);
      } catch (error) {
        logError('operations_shop_selection_save_template_failed', error, {
          scopeKey: normalizeScopeKey(payload && payload.scopeKey)
        });
        throw error;
      }
    },

    async deleteTemplate(payload = {}) {
      try {
        return await deleteTemplate(payload);
      } catch (error) {
        logError('operations_shop_selection_delete_template_failed', error, {
          scopeKey: normalizeScopeKey(payload && payload.scopeKey),
          templateId: normalizeText(payload && payload.templateId)
        });
        throw error;
      }
    }
  };
}

module.exports = {
  createOperationsShopSelectionService
};
