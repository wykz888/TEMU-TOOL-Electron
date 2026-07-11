import { computed, ref } from 'vue';
import { normalizeText, splitLines } from './utils/podUploadSheetMiaoshouData.js';

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

export function useTemplateWorkspace(options = {}) {
  const featureBridge = options.featureBridge;
  const lastImportDirectoryPath = options.lastImportDirectoryPath;
  const globalForm = options.globalForm;
  const carouselPresetText = options.carouselPresetText;
  const descriptionPresetText = options.descriptionPresetText;
  const getSkuTemplateConfigMap = typeof options.getSkuTemplateConfigMap === 'function'
    ? options.getSkuTemplateConfigMap
    : () => ({});
  const applySkuTemplateConfig = typeof options.applySkuTemplateConfig === 'function'
    ? options.applySkuTemplateConfig
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
  const formTemplateOptions = computed(() => formTemplates.value.map((item) => ({
    value: item.id,
    label: item.name
  })));

  async function loadInitialData() {
    await Promise.allSettled([loadCategories(), loadFormTemplates(), loadWorkspaceState()]);
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

      if (!selectedTemplateId.value && formTemplates.value.length > 0) {
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
  }

  function buildTemplatePayload() {
    return {
      templateId: selectedTemplateId.value,
      templateName: templateName.value,
      fields: {
        ...globalForm,
        aiTitlePrefix: '',
        aiTitleSuffix: '',
        aiTitleExtraPrompt: '',
        aiTitleMaxLength: '250'
      },
      skuConfigMap: getSkuTemplateConfigMap(),
      batchPreset: {
        carouselPresetMode: 'selected',
        carouselPresetSelection: splitLines(carouselPresetText.value),
        descriptionPresetSelection: splitLines(descriptionPresetText.value)
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
    const template = formTemplates.value.find((item) => item.id === value);

    if (!template) return;

    templateName.value = template.name;
    Object.assign(globalForm, template.fields || {});
    applySkuTemplateConfig(template.skuConfigMap);
    syncGlobalToProducts();
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
