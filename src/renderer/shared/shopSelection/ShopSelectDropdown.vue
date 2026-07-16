<template>
  <div
    ref="rootRef"
    class="shared-shop-select"
  >
    <button
      class="shared-shop-select-trigger"
      :class="{ 'is-open': panelOpen }"
      type="button"
      :disabled="disabled"
      @click="togglePanel"
    >
      <span class="shared-shop-select-trigger-copy">
        <span class="shared-shop-select-trigger-value">{{ summaryText }}</span>
        <span class="shared-shop-select-trigger-meta">{{ metaText }}</span>
      </span>
      <span class="shared-shop-select-trigger-arrow" aria-hidden="true">&#9662;</span>
    </button>

    <div
      v-if="panelOpen"
      class="shared-shop-select-panel"
    >
      <div class="shared-shop-select-search-shell">
        <a-input
          v-model="keyword"
          allow-clear
          size="small"
          :placeholder="searchPlaceholder"
        />
      </div>

      <div class="shared-shop-select-toolbar">
        <a-button
          size="mini"
          type="text"
          :disabled="loading || visibleShopCount <= 0"
          @click="toggleVisibleSelection"
        >
          {{ visibleToggleText }}
        </a-button>
        <a-button
          size="mini"
          type="text"
          :disabled="loading || lastSelectionIds.length <= 0"
          @click="restoreLastSelection"
        >
          {{ restoreLastText }}
        </a-button>
        <a-button
          size="mini"
          type="text"
          :disabled="loading || selectedIds.length <= 0"
          @click="clearSelection"
        >
          {{ clearText }}
        </a-button>
        <span>{{ visibleMetaText }}</span>
      </div>

      <div class="shared-shop-select-section-list">
        <section
          v-for="section in visibleSections"
          :key="section.id"
          class="shared-shop-select-section"
        >
          <div class="shared-shop-select-section-head">
            <div class="shared-shop-select-section-copy">
              <strong>{{ section.label }}</strong>
              <span>{{ section.visibleShops.length }} {{ shopUnitText }}</span>
            </div>
            <button
              class="shared-shop-select-section-action"
              type="button"
              @click="toggleSectionSelection(section)"
            >
              {{ isSectionSelected(section) ? sectionClearText : sectionSelectText }}
            </button>
          </div>

          <div class="shared-shop-select-shop-list">
            <label
              v-for="shop in section.visibleShops"
              :key="shop.id"
              class="shared-shop-select-shop-item"
            >
              <input
                type="checkbox"
                :checked="selectedIdSet.has(shop.id)"
                @change="handleShopToggle(shop.id, $event.target.checked)"
              />
              <span class="shared-shop-select-shop-copy">
                <span
                  class="shared-shop-select-shop-name"
                  :title="shop.shopName"
                >
                  {{ shop.shopName }}
                </span>
                <span class="shared-shop-select-shop-details">
                  <span
                    v-if="shop.groupName"
                    class="shared-shop-select-shop-group"
                    :title="shop.groupName"
                  >
                    {{ shop.groupName }}
                  </span>
                  <span
                    v-if="shop.accountValue"
                    class="shared-shop-select-shop-account"
                    :title="shop.accountValue"
                  >
                    {{ shop.accountValue }}
                  </span>
                </span>
                <span
                  v-if="shop.note"
                  class="shared-shop-select-shop-note"
                  :title="shop.note"
                >
                  {{ shop.note }}
                </span>
              </span>
            </label>
          </div>
        </section>

        <div
          v-if="visibleSections.length <= 0"
          class="shared-shop-select-empty"
        >
          {{ emptyText }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  buildEmptyShopCatalog,
  loadShopCatalog,
  normalizeShopIds,
  normalizeText
} from './shopCatalog.js';

const props = defineProps({
  modelValue: {
    type: [Array, String],
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '\u5e97\u94fa\u9009\u62e9'
  },
  storageKey: {
    type: String,
    default: 'shared-shop-select:last-selection'
  }
});

const emit = defineEmits(['update:modelValue', 'change', 'loaded', 'error']);

const allText = '\u5168\u9009';
const cancelCurrentText = '\u53d6\u6d88\u5f53\u524d';
const clearText = '\u6e05\u7a7a';
const emptyDefaultText = '\u6682\u65e0\u53ef\u9009\u5e97\u94fa';
const emptySearchText = '\u6ca1\u6709\u627e\u5230\u5339\u914d\u5e97\u94fa';
const loadingText = '\u6b63\u5728\u52a0\u8f7d\u5e97\u94fa';
const loadingShortText = '\u52a0\u8f7d\u4e2d';
const restoreLastText = '\u4e0a\u6b21\u52fe\u9009';
const searchPlaceholder = '\u641c\u7d22\u5e97\u94fa\u540d / \u8d26\u53f7 / \u5907\u6ce8';
const sectionClearText = '\u53d6\u6d88';
const sectionSelectText = '\u5168\u9009';
const shopUnitText = '\u5bb6';
const totalPrefixText = '\u5171';
const visiblePrefixText = '\u663e\u793a';
const selectedPrefixText = '\u5df2\u9009';

const catalog = ref(buildEmptyShopCatalog());
const keyword = ref('');
const lastSelectionIds = ref(readStoredSelection());
const loaded = ref(false);
const loading = ref(false);
const panelOpen = ref(false);
const rootRef = ref(null);

const selectedIds = computed(() => normalizeShopIds(props.modelValue));
const selectedIdSet = computed(() => new Set(selectedIds.value));
const totalShopCount = computed(() => catalog.value.shops.length);

const visibleSections = computed(() => {
  const normalizedKeyword = normalizeText(keyword.value).toLowerCase();

  return catalog.value.sections
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
});

const visibleShopIds = computed(() => (
  visibleSections.value.flatMap((section) => (
    section.visibleShops.map((shop) => shop.id)
  ))
));

const visibleShopCount = computed(() => visibleShopIds.value.length);
const allVisibleSelected = computed(() => (
  visibleShopIds.value.length > 0
  && visibleShopIds.value.every((shopId) => selectedIdSet.value.has(shopId))
));

const visibleToggleText = computed(() => (
  allVisibleSelected.value ? cancelCurrentText : allText
));

const summaryText = computed(() => {
  if (loading.value) {
    return loadingText;
  }

  if (selectedIds.value.length <= 0) {
    return props.placeholder;
  }

  const selectedNames = selectedIds.value
    .map((shopId) => catalog.value.shopMap[shopId])
    .filter(Boolean)
    .map((shop) => shop.shopName);

  if (selectedNames.length <= 0) {
    return `${selectedPrefixText} ${selectedIds.value.length} ${shopUnitText}`;
  }

  if (selectedNames.length === 1) {
    return selectedNames[0];
  }

  if (selectedNames.length === 2) {
    return `${selectedNames[0]} / ${selectedNames[1]}`;
  }

  return `${selectedNames[0]} / ${selectedNames[1]} +${selectedNames.length - 2}`;
});

const metaText = computed(() => {
  if (loading.value) {
    return loadingShortText;
  }

  if (selectedIds.value.length > 0) {
    return `${selectedPrefixText} ${selectedIds.value.length} ${shopUnitText}`;
  }

  return `${totalPrefixText} ${totalShopCount.value} ${shopUnitText}`;
});

const visibleMetaText = computed(() => (
  `${visiblePrefixText} ${visibleShopCount.value} / ${totalShopCount.value}`
));

const emptyText = computed(() => (
  loading.value
    ? loadingText
    : keyword.value
      ? emptySearchText
      : emptyDefaultText
));

function normalizeKnownShopIds(shopIds) {
  const normalizedIds = normalizeShopIds(shopIds);

  if (totalShopCount.value <= 0) {
    return normalizedIds;
  }

  return normalizedIds.filter((shopId) => Boolean(catalog.value.shopMap[shopId]));
}

function readStoredSelection() {
  try {
    const rawValue = window.localStorage.getItem(props.storageKey);

    if (!rawValue) {
      return [];
    }

    return normalizeShopIds(JSON.parse(rawValue));
  } catch (_error) {
    return [];
  }
}

function writeStoredSelection(nextIds) {
  const normalizedIds = normalizeShopIds(nextIds);

  if (normalizedIds.length <= 0) {
    return;
  }

  try {
    window.localStorage.setItem(props.storageKey, JSON.stringify(normalizedIds));
    lastSelectionIds.value = normalizedIds;
  } catch (_error) {
    lastSelectionIds.value = normalizedIds;
  }
}

function commitSelection(nextIds) {
  const normalizedIds = normalizeKnownShopIds(nextIds);

  emit('update:modelValue', normalizedIds);
  emit('change', normalizedIds);
  writeStoredSelection(normalizedIds);
}

function togglePanel() {
  if (props.disabled) {
    return;
  }

  panelOpen.value = !panelOpen.value;

  if (panelOpen.value && loaded.value !== true && loading.value !== true) {
    void refreshShops();
  }
}

function closePanel() {
  panelOpen.value = false;
}

function handleDocumentPointerDown(event) {
  if (!rootRef.value || rootRef.value.contains(event.target)) {
    return;
  }

  closePanel();
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closePanel();
  }
}

function handleShopToggle(shopId, checked) {
  const nextIds = new Set(selectedIds.value);

  if (checked) {
    nextIds.add(shopId);
  } else {
    nextIds.delete(shopId);
  }

  commitSelection(Array.from(nextIds));
}

function isSectionSelected(section) {
  return (
    section.visibleShops.length > 0
    && section.visibleShops.every((shop) => selectedIdSet.value.has(shop.id))
  );
}

function toggleSectionSelection(section) {
  const nextIds = new Set(selectedIds.value);
  const sectionSelected = isSectionSelected(section);

  section.visibleShops.forEach((shop) => {
    if (sectionSelected) {
      nextIds.delete(shop.id);
    } else {
      nextIds.add(shop.id);
    }
  });

  commitSelection(Array.from(nextIds));
}

function toggleVisibleSelection() {
  const nextIds = new Set(selectedIds.value);

  visibleShopIds.value.forEach((shopId) => {
    if (allVisibleSelected.value) {
      nextIds.delete(shopId);
    } else {
      nextIds.add(shopId);
    }
  });

  commitSelection(Array.from(nextIds));
}

function clearSelection() {
  emit('update:modelValue', []);
  emit('change', []);
}

function restoreLastSelection() {
  commitSelection(lastSelectionIds.value);
}

async function refreshShops() {
  loading.value = true;

  try {
    catalog.value = await loadShopCatalog();
    loaded.value = true;
    lastSelectionIds.value = normalizeKnownShopIds(readStoredSelection());

    const filteredSelectedIds = normalizeKnownShopIds(selectedIds.value);

    if (filteredSelectedIds.length !== selectedIds.value.length) {
      emit('update:modelValue', filteredSelectedIds);
      emit('change', filteredSelectedIds);
    }

    emit('loaded', catalog.value);
  } catch (error) {
    loaded.value = false;
    emit('error', error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  void refreshShops();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
  document.removeEventListener('keydown', handleDocumentKeydown);
});

defineExpose({
  refresh: refreshShops
});
</script>

<style>
.shared-shop-select {
  position: relative;
  width: 100%;
}

.shared-shop-select-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 34px;
  padding: 5px 10px;
  border: 1px solid rgba(49, 66, 89, 0.14);
  border-radius: 7px;
  background: #ffffff;
  color: #253650;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.shared-shop-select-trigger:hover,
.shared-shop-select-trigger.is-open {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.72);
  box-shadow: 0 0 0 2px rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
}

.shared-shop-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.shared-shop-select-trigger-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.shared-shop-select-trigger-value,
.shared-shop-select-trigger-meta,
.shared-shop-select-shop-name,
.shared-shop-select-shop-account,
.shared-shop-select-shop-group,
.shared-shop-select-shop-note,
.shared-shop-select-section-copy strong,
.shared-shop-select-section-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shared-shop-select-trigger-value {
  color: #203048;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
}

.shared-shop-select-trigger-meta,
.shared-shop-select-trigger-arrow {
  color: #75859b;
  font-size: 12px;
  line-height: 1.25;
}

.shared-shop-select-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 8px;
  width: min(460px, calc(100vw - 42px));
  max-height: 460px;
  padding: 10px;
  border: 1px solid rgba(49, 66, 89, 0.12);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(31, 45, 61, 0.16);
}

.shared-shop-select-search-shell {
  min-width: 0;
}

.shared-shop-select-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.shared-shop-select-toolbar > span {
  margin-left: auto;
  color: #718197;
  font-size: 12px;
}

.shared-shop-select-section-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.shared-shop-select-section {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(49, 66, 89, 0.08);
  border-radius: 8px;
  background: #f7fafc;
}

.shared-shop-select-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.shared-shop-select-section-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.shared-shop-select-section-copy strong {
  color: #203048;
  font-size: 13px;
  line-height: 1.25;
}

.shared-shop-select-section-copy span,
.shared-shop-select-shop-account,
.shared-shop-select-shop-note {
  color: #738298;
  font-size: 12px;
  line-height: 1.25;
}

.shared-shop-select-section-action {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--theme-primary-color-deep);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.shared-shop-select-shop-list {
  display: grid;
  gap: 5px;
}

.shared-shop-select-shop-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
}

.shared-shop-select-shop-item:hover {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.08);
}

.shared-shop-select-shop-item input {
  margin-top: 2px;
}

.shared-shop-select-shop-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.shared-shop-select-shop-name {
  color: #203048;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
}

.shared-shop-select-shop-details {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.shared-shop-select-shop-group {
  max-width: 128px;
  padding: 1px 6px;
  border: 1px solid rgba(var(--theme-primary-rgb, 247, 181, 0), 0.2);
  border-radius: 6px;
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
  color: var(--theme-primary-color-deep);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.shared-shop-select-shop-account,
.shared-shop-select-shop-note {
  min-width: 0;
}

.shared-shop-select-shop-note {
  max-width: 100%;
}

.shared-shop-select-empty {
  display: grid;
  place-items: center;
  min-height: 120px;
  color: #718197;
  font-size: 13px;
}

body.dark-theme .shared-shop-select-trigger,
body.dark-theme .shared-shop-select-panel {
  background: rgba(20, 29, 43, 0.98);
  border-color: rgba(148, 163, 184, 0.16);
}

body.dark-theme .shared-shop-select-trigger-value,
body.dark-theme .shared-shop-select-section-copy strong,
body.dark-theme .shared-shop-select-shop-name {
  color: #e4edf8;
}

body.dark-theme .shared-shop-select-trigger-meta,
body.dark-theme .shared-shop-select-trigger-arrow,
body.dark-theme .shared-shop-select-section-copy span,
body.dark-theme .shared-shop-select-shop-account,
body.dark-theme .shared-shop-select-shop-note,
body.dark-theme .shared-shop-select-toolbar > span,
body.dark-theme .shared-shop-select-empty {
  color: #9aa8ba;
}

body.dark-theme .shared-shop-select-shop-group {
  border-color: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.24);
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.14);
}

body.dark-theme .shared-shop-select-section {
  background: rgba(25, 36, 52, 0.92);
  border-color: rgba(148, 163, 184, 0.12);
}

body.dark-theme .shared-shop-select-shop-item:hover {
  background: rgba(var(--theme-primary-rgb, 247, 181, 0), 0.1);
}

@media (max-width: 820px) {
  .shared-shop-select-panel {
    width: min(360px, calc(100vw - 34px));
  }
}
</style>
