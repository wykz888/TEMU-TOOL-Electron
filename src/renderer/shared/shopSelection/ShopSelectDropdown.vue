<template>
  <a-select
    class="shared-shop-select"
    :model-value="modelValue"
    :allow-clear="true"
    :allow-search="true"
    :disabled="disabled || loading"
    :filter-option="filterShopOption"
    :loading="loading"
    :placeholder="placeholder"
    popup-container="body"
    @change="handleChange"
    @dropdown-visible-change="handleDropdownVisibleChange"
  >
    <a-option
      v-for="shop in shops"
      :key="shop.id"
      :label="shop.shopName"
      :value="shop.id"
    >
      <div class="shared-shop-select-option">
        <strong>{{ shop.shopName }}</strong>
        <span>{{ buildShopMeta(shop) }}</span>
      </div>
    </a-option>
  </a-select>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  buildEmptyShopCatalog,
  loadShopCatalog,
  normalizeText
} from './shopCatalog.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '\u5e97\u94fa\u9009\u62e9'
  }
});

const emit = defineEmits(['update:modelValue', 'loaded', 'error']);

const catalog = ref(buildEmptyShopCatalog());
const loading = ref(false);
const loaded = ref(false);

const shops = computed(() => catalog.value.shops);

function buildShopMeta(shop) {
  return [
    normalizeText(shop && shop.groupName),
    normalizeText(shop && shop.accountValue),
    normalizeText(shop && shop.note)
  ].filter(Boolean).join(' / ');
}

function filterShopOption(inputValue, option) {
  const keyword = normalizeText(inputValue).toLowerCase();
  const optionValue = normalizeText(
    option && (option.value || (option.data && option.data.value) || (option.props && option.props.value))
  );

  if (!keyword) {
    return true;
  }

  const shop = optionValue && catalog.value.shopMap
    ? catalog.value.shopMap[optionValue]
    : null;

  return shop ? shop.searchText.includes(keyword) : false;
}

function handleChange(nextValue) {
  emit('update:modelValue', normalizeText(nextValue));
}

async function refreshShops() {
  loading.value = true;

  try {
    catalog.value = await loadShopCatalog();
    loaded.value = true;
    if (props.modelValue && !catalog.value.shopMap[props.modelValue]) {
      emit('update:modelValue', '');
    }
    emit('loaded', catalog.value);
  } catch (error) {
    loaded.value = false;
    emit('error', error);
  } finally {
    loading.value = false;
  }
}

function handleDropdownVisibleChange(visible) {
  if (visible && loaded.value !== true && loading.value !== true) {
    void refreshShops();
  }
}

onMounted(() => {
  void refreshShops();
});

defineExpose({
  refresh: refreshShops
});
</script>
