import { computed, ref } from 'vue';
import { normalizeText, splitLines } from './utils/podUploadSheetMiaoshouData.js';

const NEW_FORM_TEMPLATE_OPTION_VALUE = '__new_form_template__';

function getBridge(featureBridge) {
  return featureBridge && typeof featureBridge === 'object' && 'value' in featureBridge
    ? featureBridge.value
    : featureBridge;
}

function showMessage(messageApi, method, content) {
  if (messageApi && typeof messageApi[method] === 'function') {
    messageApi[method](content);
  }
}

function getValue(source) {
  return source && typeof source === 'object' && 'value' in source ? source.value : source;
}

function toTextArray(value) {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [];
}

function toSequenceText(value) {
  return toTextArray(value).map((item) => item.replace(/\D+/g, '')).filter(Boolean).join(',');
}

export function useTemplateWorkspace(options = {}) {
  const featureBridge = options.featureBridge;
  const lastImportDirectoryPath = options.lastImportDirectoryPath;
  const globalForm = options.globalForm;
  const carouselPresetText = options.carouselPresetText;
  const randomCarouselOnlyFirst = options.randomCarouselOnlyFirst;
  const randomCarouselSelected = options.randomCarouselSelected;
  const descriptionPresetText = options.descriptionPresetText;
  const getSkuTemplateConfigMap = typeof options.getSkuTemplateConfigMap === 'function'
    ? options.getSkuTemplateConfigMap
    : () => ({});
  const applySkuTemplateConfig = typeof options.applySkuTemplateConfig === 'function'
    ? options.applySkuTemplateConfig
    : () => undefined;
  const getImageUploadPreferences = typeof options.getImageUploadPreferences === 'function'
    ? options.getImageUploadPreferences
    : () => ({});
  const applyImageUploadPreferences = typeof options.applyImageUploadPreferences === 'function'
    ? options.applyImageUploadPreferences
    : () => undefined;
  const getBatchAiTitlePreferences = typeof options.getBatchAiTitlePreferences === 'function'
    ? options.getBatchAiTitlePreferences
    : () => ({});
  const applyBatchAiTitlePreferences = typeof options.applyBatchAiTitlePreferences === 'function'
    ? options.applyBatchAiTitlePreferences
    : () => undefined;
  const scheduleStateSave = typeof options.scheduleStateSave === 'function'
    ? options.scheduleStateSave
    : () => undefined;
  const syncGlobalToProducts = typeof options.syncGlobalToProducts === 'function'
    ? options.syncGlobalToProducts
    : () => undefined;
  const messageApi = options.messageApi || null;

  const categories = ref([]);
  const formTemplates = ref([]);
  const selectedTemplateId = ref('');
  const templateName = ref('');
  const loadingCategories = ref(false);
  const loadingTemplates = ref(false);
  const savingTemplate = ref(false);
  const deletingTemplate = ref(false);

  const categorySelectOptions = computed(() => {
    return categories.value.map((item) => ({
      value: item.id,
      label: item.label ? `${item.id} - ${item.label}` : item.id
    }));
  });
  const formTemplateOptions = computed(() => [
    {
      value: NEW_FORM_TEMPLATE_OPTION_VALUE,
      label: '\u65b0\u589e\u6a21\u677f'
    },
    ...formTemplates.value.map((item) => ({
      value: item.id,
      label: item.name
    }))
  ]);

  async function loadInitialData() {
    await Promise.allSettled([loadCategories(), loadWorkspaceState()]);
    await loadFormTemplates();
  }

  async function loadCategories() {
    const bridge = getBridge(featureBridge);

    if (!bridge) return;

    loadingCategories.value = true;

    try {
      const result = await bridge.getPodUploadSheetMiaoshouCategories();
      categories.value = Array.isArray(result && result.categories) ? result.categories : [];
    } finally {
      loadingCategories.value = false;
    }
  }

  async function loadFormTemplates() {
    const bridge = getBridge(featureBridge);

    if (!bridge) return;

    loadingTemplates.value = true;

    try {
      const result = await bridge.getPodUploadSheetMiaoshouFormTemplates();
      formTemplates.value = Array.isArray(result && result.templates) ? result.templates : [];

      const selectedTemplate = selectedTemplateId.value
        ? formTemplates.value.find((item) => item.id === selectedTemplateId.value)
        : null;

      if (selectedTemplate) {
        applySelectedTemplate(selectedTemplate.id);
        return;
      }

      if (formTemplates.value.length > 0) {
        selectedTemplateId.value = formTemplates.value[0].id;
        applySelectedTemplate(selectedTemplateId.value);
      }
    } finally {
      loadingTemplates.value = false;
    }
  }

  async function loadWorkspaceState() {
    const bridge = getBridge(featureBridge);

    if (!bridge) return;

    const result = await bridge.getPodUploadSheetMiaoshouWorkspaceState().catch(() => null);
    const workspace = result && result.workspace ? result.workspace : {};
    lastImportDirectoryPath.value = normalizeText(workspace.lastImportDirectoryPath);
    selectedTemplateId.value = normalizeText(workspace.selectedTemplateId || workspace.templateId);
    templateName.value = normalizeText(workspace.templateName || workspace.selectedTemplateName);
    carouselPresetText.value = Array.isArray(workspace.carouselPresetSelection)
      ? workspace.carouselPresetSelection.join('\n')
      : '';
    descriptionPresetText.value = Array.isArray(workspace.descriptionPresetSelection)
      ? workspace.descriptionPresetSelection.join('\n')
      : '';
    randomCarouselOnlyFirst.value = workspace.randomCarouselOnlyFirst === true
      || normalizeText(workspace.carouselPresetMode) === 'random-first';
    randomCarouselSelected.value = String(workspace.carouselPresetRandomOrders || '')
      .split(',')
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isFinite(item) && item > 0);

    applyImageUploadPreferences(workspace.imageUploadConfig || workspace);
    applyBatchAiTitlePreferences(workspace.batchAiTitleConfig || workspace);
  }

  function buildTemplatePayload() {
    const imageUploadConfig = getValue(getImageUploadPreferences()) || {};
    const batchAiTitleConfig = getValue(getBatchAiTitlePreferences()) || {};

    return {
      templateId: selectedTemplateId.value,
      templateName: templateName.value,
      fields: {
        ...globalForm,
        aiTitlePrefix: normalizeText(batchAiTitleConfig.prefixText),
        aiTitleSuffix: normalizeText(batchAiTitleConfig.suffixText),
        aiTitleExtraPrompt: normalizeText(batchAiTitleConfig.extraPrompt),
        aiTitleMaxLength: normalizeText(batchAiTitleConfig.targetLength || '250')
      },
      skuConfigMap: getSkuTemplateConfigMap(),
      batchPreset: {
        carouselPresetMode: randomCarouselOnlyFirst && randomCarouselOnlyFirst.value ? 'random-first' : 'selected',
        carouselPresetRandomOrders: toSequenceText(randomCarouselSelected && randomCarouselSelected.value),
        carouselPresetSelection: splitLines(carouselPresetText.value),
        randomCarouselOnlyFirst: !!(randomCarouselOnlyFirst && randomCarouselOnlyFirst.value),
        descriptionPresetSelection: splitLines(descriptionPresetText.value)
      },
      imageUploadConfig: {
        storageProvider: normalizeText(imageUploadConfig.storageProvider),
        imageUploadMode: normalizeText(imageUploadConfig.imageUploadMode),
        concurrency: normalizeText(imageUploadConfig.concurrency),
        imageQuality: normalizeText(imageUploadConfig.imageQuality)
      },
      batchAiTitleConfig: {
        aiProvider: normalizeText(batchAiTitleConfig.aiProvider),
        apiBaseUrl: normalizeText(batchAiTitleConfig.apiBaseUrl),
        model: normalizeText(batchAiTitleConfig.model),
        storageProvider: normalizeText(batchAiTitleConfig.storageProvider),
        imageCompression: normalizeText(batchAiTitleConfig.imageCompression),
        concurrency: normalizeText(batchAiTitleConfig.concurrency),
        targetLength: normalizeText(batchAiTitleConfig.targetLength),
        imageQuality: normalizeText(batchAiTitleConfig.imageQuality),
        prefixText: normalizeText(batchAiTitleConfig.prefixText),
        suffixText: normalizeText(batchAiTitleConfig.suffixText),
        outputLanguage: normalizeText(batchAiTitleConfig.outputLanguage),
        useCache: batchAiTitleConfig.useCache === false ? false : true,
        extraPrompt: normalizeText(batchAiTitleConfig.extraPrompt)
      }
    };
  }

  async function saveCurrentTemplate() {
    const bridge = getBridge(featureBridge);

    if (!bridge) return;

    if (!normalizeText(templateName.value)) {
      showMessage(messageApi, 'warning', '\u8bf7\u5148\u586b\u5199\u6a21\u677f\u540d\u79f0');
      return;
    }

    savingTemplate.value = true;

    try {
      const result = await bridge.savePodUploadSheetMiaoshouFormTemplate(buildTemplatePayload());
      formTemplates.value = Array.isArray(result && result.templates) ? result.templates : formTemplates.value;
      selectedTemplateId.value = normalizeText(result && result.templateId) || selectedTemplateId.value;
      scheduleStateSave();
      showMessage(messageApi, 'success', '\u6a21\u677f\u5df2\u4fdd\u5b58');
    } catch (error) {
      showMessage(
        messageApi,
        'error',
        '\u4fdd\u5b58\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u91cd\u8bd5')
      );
    } finally {
      savingTemplate.value = false;
    }
  }

  function applySelectedTemplate(value) {
    if (value === NEW_FORM_TEMPLATE_OPTION_VALUE) {
      selectedTemplateId.value = '';
      templateName.value = '';
      scheduleStateSave();
      return;
    }

    const template = formTemplates.value.find((item) => item.id === value);

    if (!template) return;

    selectedTemplateId.value = template.id;
    templateName.value = template.name;
    Object.assign(globalForm, template.fields || {});
    applySkuTemplateConfig(template.skuConfigMap);
    if (template.batchPreset) {
      carouselPresetText.value = Array.isArray(template.batchPreset.carouselPresetSelection)
        ? template.batchPreset.carouselPresetSelection.join('\n')
        : '';
      descriptionPresetText.value = Array.isArray(template.batchPreset.descriptionPresetSelection)
        ? template.batchPreset.descriptionPresetSelection.join('\n')
        : '';
      randomCarouselOnlyFirst.value = template.batchPreset.randomCarouselOnlyFirst === true
        || normalizeText(template.batchPreset.carouselPresetMode) === 'random-first';
      randomCarouselSelected.value = String(template.batchPreset.carouselPresetRandomOrders || '')
        .split(',')
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item) && item > 0);
    }
    applyImageUploadPreferences(template.imageUploadConfig || {});
    applyBatchAiTitlePreferences(template.batchAiTitleConfig || {});
    syncGlobalToProducts();
    scheduleStateSave();
  }

  async function deleteSelectedTemplate() {
    const bridge = getBridge(featureBridge);

    if (!bridge || !selectedTemplateId.value) return;

    deletingTemplate.value = true;

    try {
      const result = await bridge.deletePodUploadSheetMiaoshouFormTemplate({
        templateId: selectedTemplateId.value
      });
      formTemplates.value = Array.isArray(result && result.templates)
        ? result.templates
        : formTemplates.value.filter((item) => item.id !== selectedTemplateId.value);
      selectedTemplateId.value = '';
      scheduleStateSave();
      showMessage(messageApi, 'success', '\u6a21\u677f\u5df2\u5220\u9664');
    } finally {
      deletingTemplate.value = false;
    }
  }

  return {
    categories,
    formTemplates,
    selectedTemplateId,
    templateName,
    loadingCategories,
    loadingTemplates,
    savingTemplate,
    deletingTemplate,
    categorySelectOptions,
    formTemplateOptions,
    loadInitialData,
    loadCategories,
    loadFormTemplates,
    loadWorkspaceState,
    buildTemplatePayload,
    saveCurrentTemplate,
    applySelectedTemplate,
    deleteSelectedTemplate
  };
}
