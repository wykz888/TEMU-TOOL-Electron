const fs = require('node:fs');
const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  createEntityId,
  normalizeText,
  nowIso,
  toTimestamp
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const DEFAULT_ENTRY_ID = 'pod-upload-sheet-miaoshou-table';
const STATE_FILE_NAME = 'form-templates.json';
const FORM_TEMPLATE_FIELD_NAMES = Object.freeze([
  'templateId',
  'category',
  'delivery',
  'origin',
  'isCustom',
  'sourceLink',
  'description',
  'specNameOne',
  'specValueOne',
  'specNameTwo',
  'specValueTwo',
  'packingList',
  'packingCount',
  'codeType',
  'codeValue',
  'mainVideo',
  'manual',
  'aiTitlePrefix',
  'aiTitleSuffix',
  'aiTitleExtraPrompt',
  'aiTitleMaxLength'
]);
const SKU_CONFIG_FIELD_NAMES = Object.freeze([
  'declaredPrice',
  'price',
  'length',
  'width',
  'height',
  'weight',
  'stock',
  'skuImage',
  'platformSku',
  'skuCategoryType',
  'skuCategoryCount',
  'skuCategoryUnit',
  'independentPackaging'
]);

function createPodUploadSheetMiaoshouFormTemplateService({
  sessionStore,
  featureCenterProfileService,
  entryId = DEFAULT_ENTRY_ID,
  missingEntryMessage = '\u5999\u624b\u8868\u683c\u586b\u5199\u6a21\u677f\u6a21\u5757\u672a\u6ce8\u518c\uff0c\u65e0\u6cd5\u8bfb\u53d6\u6a21\u677f\u914d\u7f6e\u3002',
  cloudRecordType = 'pod-upload-sheet-miaoshou-form-templates',
  formTemplateFieldNames = FORM_TEMPLATE_FIELD_NAMES,
  skuConfigFieldNames = SKU_CONFIG_FIELD_NAMES
}) {
  const normalizedEntryId = normalizeText(entryId) || DEFAULT_ENTRY_ID;
  const normalizedFormTemplateFieldNames = Object.freeze(
    (Array.isArray(formTemplateFieldNames) && formTemplateFieldNames.length
      ? formTemplateFieldNames
      : FORM_TEMPLATE_FIELD_NAMES
    ).map((fieldName) => normalizeText(fieldName)).filter((fieldName, index, items) => (
      fieldName && items.indexOf(fieldName) === index
    ))
  );
  const normalizedSkuConfigFieldNames = Object.freeze(
    (Array.isArray(skuConfigFieldNames) && skuConfigFieldNames.length
      ? skuConfigFieldNames
      : SKU_CONFIG_FIELD_NAMES
    ).map((fieldName) => normalizeText(fieldName)).filter((fieldName, index, items) => (
      fieldName && items.indexOf(fieldName) === index
    ))
  );
  let cachedOwnerKey = '';
  let cachedSnapshot = null;

  function getOwner() {
    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function getFeatureEntry() {
    const featureEntry =
      featureCenterProfileService
      && typeof featureCenterProfileService.getEntryById === 'function'
        ? featureCenterProfileService.getEntryById(normalizedEntryId)
        : null;

    if (!featureEntry) {
      throw new Error(missingEntryMessage);
    }

    return featureEntry;
  }

  function getLocalStateFilePath(owner) {
    const featureEntry = getFeatureEntry();

    return path.join(
      featureEntry.storageProfile.localRootDir,
      'users',
      owner.userKey,
      'config',
      STATE_FILE_NAME
    );
  }

  function getCloudStateKey(owner) {
    const featureEntry = getFeatureEntry();

    return `${featureEntry.storageKey}/users/${owner.userKey}/config/${STATE_FILE_NAME}`;
  }

  function buildDefaultState(owner) {
    return {
      version: SERVICE_VERSION,
      owner: owner ? {
        userId: owner.userId,
        username: owner.username,
        userKey: owner.userKey
      } : null,
      updatedAt: '',
      templates: []
    };
  }

  async function readJsonFile(filePath) {
    try {
      const rawText = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, filePath);
  }

  function normalizeSkuMultilineValue(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('\n');
  }

  function normalizePositiveIntegerString(value) {
    const text = normalizeText(value);

    if (!text || !/^\d+$/.test(text)) {
      return '';
    }

    const numericValue = Number.parseInt(text, 10);

    return numericValue > 0 ? String(numericValue) : '';
  }

  function normalizeSkuConfigFieldValue(fieldName, value) {
    return fieldName === 'skuImage'
      ? normalizePositiveIntegerString(value)
      : normalizeText(value);
  }

  function createSkuConfigEntry(overrides = {}) {
    return normalizedSkuConfigFieldNames.reduce((entry, fieldName) => {
      entry[fieldName] = normalizeSkuConfigFieldValue(fieldName, overrides[fieldName]);
      return entry;
    }, {});
  }

  function normalizeSkuConfigMap(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return {};
    }

    return Object.entries(source).reduce((result, [key, value]) => {
      const normalizedKey = normalizeText(key);

      if (!normalizedKey) {
        return result;
      }

      result[normalizedKey] = createSkuConfigEntry(value);
      return result;
    }, {});
  }

  function normalizeTemplateFields(source) {
    const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};

    return normalizedFormTemplateFieldNames.reduce((result, fieldName) => {
      result[fieldName] = ['specValueOne', 'specValueTwo'].includes(fieldName)
        ? normalizeSkuMultilineValue(input[fieldName])
        : normalizeText(input[fieldName]);
      return result;
    }, {});
  }

  function normalizeCarouselPresetMode(value) {
    return normalizeText(value) === 'random-first' ? 'random-first' : 'selected';
  }

  function normalizeSequenceSelection(value) {
    const values = String(value || '')
      .replace(/\r\n/g, '\n')
      .split(/[\n,;\uFF0C\u3001\uFF1B\s]+/)
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return Array.from(new Set(values)).join(',');
  }

  function normalizeTextArray(value) {
    return (Array.isArray(value) ? value : [])
      .map((item) => normalizeText(item))
      .filter((item, index, items) => item && items.indexOf(item) === index);
  }

  function normalizeTemplateBatchPreset(source) {
    const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};

    return {
      carouselPresetMode: normalizeCarouselPresetMode(input.carouselPresetMode || input.cachedCarouselPresetMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(input.carouselPresetRandomOrders || input.cachedCarouselPresetRandomOrders),
      carouselPresetSelection: normalizeTextArray(input.carouselPresetSelection || input.cachedCarouselPresetSelection),
      descriptionPresetSelection: normalizeTextArray(input.descriptionPresetSelection || input.cachedDescriptionPresetSelection)
    };
  }

  function normalizeTemplateRecord(record) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
    const name = normalizeText(source.name);
    const hasBatchPreset = Object.prototype.hasOwnProperty.call(source, 'batchPreset');

    if (!name) {
      return null;
    }

    const createdAt = toTimestamp(source.createdAt, nowIso());

    return {
      id: normalizeText(source.id) || createEntityId('pod_form_template'),
      name,
      createdAt,
      updatedAt: toTimestamp(source.updatedAt, createdAt),
      fields: normalizeTemplateFields(source.fields),
      skuConfigMap: normalizeSkuConfigMap(source.skuConfigMap),
      batchPreset: hasBatchPreset ? normalizeTemplateBatchPreset(source.batchPreset) : null
    };
  }

  function normalizeTemplates(values) {
    const templateMap = new Map();

    (Array.isArray(values) ? values : []).forEach((item) => {
      const normalizedRecord = normalizeTemplateRecord(item);

      if (!normalizedRecord) {
        return;
      }

      templateMap.set(normalizedRecord.id, normalizedRecord);
    });

    return Array.from(templateMap.values()).sort((left, right) => {
      return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
    });
  }

  function normalizeStatePayload(payload, owner) {
    const baseState = buildDefaultState(owner);

    return {
      ...baseState,
      updatedAt: normalizeText(payload && payload.updatedAt),
      templates: normalizeTemplates(payload && payload.templates)
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

  async function readCloudState(owner) {
    const key = getCloudStateKey(owner);
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key
    });

    return result.data;
  }

  async function writeCloudState(owner, payload) {
    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key: getCloudStateKey(owner),
      data: payload,
      metadata: {
        record_type: cloudRecordType,
        owner_user_key: owner.userKey,
        owner_username: owner.username
      }
    });
  }

  function updateCachedSnapshot(owner, snapshot) {
    cachedOwnerKey = owner && owner.userKey ? owner.userKey : '';
    cachedSnapshot = snapshot
      ? {
        ...snapshot,
        templates: normalizeTemplates(snapshot.templates)
      }
      : null;

    return cachedSnapshot;
  }

  async function getTemplates() {
    const owner = getOwner();

    if (!owner) {
      return updateCachedSnapshot(owner, {
        ...buildDefaultState(owner),
        source: 'default'
      });
    }

    const localFilePath = getLocalStateFilePath(owner);
    const localPayload = await readJsonFile(localFilePath).catch(() => null);
    let cloudPayload = null;
    let cloudReadFailed = false;

    try {
      cloudPayload = await readCloudState(owner);
    } catch (_error) {
      cloudReadFailed = true;
    }

    const preferred = pickNewerPayload(localPayload, cloudPayload);

    if (!preferred.payload) {
      return updateCachedSnapshot(owner, {
        ...buildDefaultState(owner),
        source: 'default'
      });
    }

    const normalizedState = normalizeStatePayload(preferred.payload, owner);

    if (
      preferred.source === 'cloud'
      && getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
    ) {
      await writeJsonFile(localFilePath, normalizedState).catch(() => null);
    }

    if (
      preferred.source === 'local'
      && getPayloadTimestamp(localPayload) > getPayloadTimestamp(cloudPayload)
    ) {
      void writeCloudState(owner, normalizedState).catch(() => null);
    }

    return updateCachedSnapshot(owner, {
      ...normalizedState,
      source: preferred.source === 'local' && cloudReadFailed ? 'local-fallback' : preferred.source
    });
  }

  async function getCachedTemplates() {
    const owner = getOwner();
    const ownerKey = owner && owner.userKey ? owner.userKey : '';

    if (cachedSnapshot && cachedOwnerKey === ownerKey) {
      return cachedSnapshot;
    }

    return getTemplates();
  }

  function buildSavedTemplate(payload, existingTemplate = null) {
    const templateName = normalizeText(payload && (payload.templateName || payload.name));

    if (!templateName) {
      throw new Error('请先填写模板名称。');
    }

    const currentTimestamp = nowIso();

    return normalizeTemplateRecord({
      id: existingTemplate ? existingTemplate.id : normalizeText(payload && payload.templateId),
      name: templateName,
      createdAt: existingTemplate ? existingTemplate.createdAt : currentTimestamp,
      updatedAt: currentTimestamp,
      fields: payload && payload.fields,
      skuConfigMap: payload && payload.skuConfigMap,
      batchPreset: payload && payload.batchPreset
    });
  }

  async function saveTemplate(payload) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedSnapshot(owner, {
        ...buildDefaultState(owner),
        source: 'default',
        cloudSynced: false
      });
    }

    const currentState = await getTemplates();
    const templateId = normalizeText(payload && payload.templateId);
    const templateNameKey = normalizeText(payload && (payload.templateName || payload.name)).toLowerCase();
    const templates = Array.isArray(currentState && currentState.templates)
      ? currentState.templates.slice()
      : [];
    const existingIndex = templates.findIndex((item) => {
      if (templateId && item.id === templateId) {
        return true;
      }

      return !templateId && normalizeText(item.name).toLowerCase() === templateNameKey;
    });
    const existingTemplate = existingIndex >= 0 ? templates[existingIndex] : null;
    const savedTemplate = buildSavedTemplate(payload, existingTemplate);
    const nextTemplates = templates.filter((item) => item.id !== (existingTemplate && existingTemplate.id));
    const nextState = normalizeStatePayload({
      updatedAt: nowIso(),
      templates: nextTemplates.concat(savedTemplate)
    }, owner);
    const localFilePath = getLocalStateFilePath(owner);

    await writeJsonFile(localFilePath, nextState);

    try {
      await writeCloudState(owner, nextState);

      return updateCachedSnapshot(owner, {
        ...nextState,
        source: 'cloud',
        cloudSynced: true,
        templateId: savedTemplate.id
      });
    } catch (error) {
      return updateCachedSnapshot(owner, {
        ...nextState,
        source: 'local',
        cloudSynced: false,
        templateId: savedTemplate.id,
        warning: error && error.message ? error.message : '云端同步失败'
      });
    }
  }

  async function deleteTemplate(payload) {
    const owner = getOwner();

    if (!owner) {
      return updateCachedSnapshot(owner, {
        ...buildDefaultState(owner),
        source: 'default',
        cloudSynced: false
      });
    }

    const templateId = normalizeText(payload && payload.templateId);

    if (!templateId) {
      throw new Error('缺少要删除的模板标识。');
    }

    const currentState = await getTemplates();
    const currentTemplates = Array.isArray(currentState && currentState.templates)
      ? currentState.templates
      : [];

    if (!currentTemplates.some((item) => item.id === templateId)) {
      throw new Error('未找到要删除的模板。');
    }

    const nextState = normalizeStatePayload({
      updatedAt: nowIso(),
      templates: currentTemplates.filter((item) => item.id !== templateId)
    }, owner);
    const localFilePath = getLocalStateFilePath(owner);

    await writeJsonFile(localFilePath, nextState);

    try {
      await writeCloudState(owner, nextState);

      return updateCachedSnapshot(owner, {
        ...nextState,
        source: 'cloud',
        cloudSynced: true,
        deletedTemplateId: templateId
      });
    } catch (error) {
      return updateCachedSnapshot(owner, {
        ...nextState,
        source: 'local',
        cloudSynced: false,
        deletedTemplateId: templateId,
        warning: error && error.message ? error.message : '云端同步失败'
      });
    }
  }

  return {
    getTemplates,
    getCachedTemplates,
    saveTemplate,
    deleteTemplate
  };
}

module.exports = {
  FORM_TEMPLATE_FIELD_NAMES,
  SKU_CONFIG_FIELD_NAMES,
  createPodUploadSheetMiaoshouFormTemplateService
};
