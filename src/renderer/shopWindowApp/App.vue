<template>
  <div class="shop-window-vue-root">
    <div class="shop-window-layout">
      <aside class="shop-window-sidebar">
        <div class="shop-window-sidebar-header">
          <div class="shop-window-sidebar-title-group">
            <span class="shop-window-sidebar-mark">&#x5E97;</span>
            <div>
              <p class="shop-window-sidebar-eyebrow">&#x5E97;&#x94FA;&#x5DE5;&#x4F5C;&#x533A;</p>
              <h2 class="shop-window-sidebar-title">&#x5E97;&#x94FA;&#x5217;&#x8868;</h2>
            </div>
          </div>
          <label class="shop-window-group-filter-shell" for="shopWindowGroupFilter">
            <span class="shop-window-group-filter-label">&#x5206;&#x7EC4;&#x7B5B;&#x9009;</span>
            <select
              id="shopWindowGroupFilter"
              class="shop-window-group-filter"
              :disabled="shopList.state.groupFilterDisabled"
              :value="shopList.state.groupFilterValue"
              @change="handleGroupFilterChange($event.target.value)"
            >
              <option
                v-for="option in shopList.state.groupOptions"
                :key="option.value || 'all'"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div id="shopWindowList" class="shop-window-list">
          <div v-if="shopList.state.emptyMode !== 'none'" class="shop-window-empty">
            <p class="shop-window-empty-title">{{ shopList.state.emptyTitle }}</p>
            <p class="shop-window-empty-text">
              {{ shopList.state.emptyText }}
            </p>
          </div>
          <template v-else>
            <button
              v-for="shop in shopList.state.shops"
              :key="shop.id"
              class="shop-window-item"
              :class="{ 'is-active': shop.isActive }"
              type="button"
              :data-shop-window-item="shop.id"
              @click="handleShopListClick(shop.id)"
            >
              <p class="shop-window-item-name">{{ shop.name }}</p>
              <p class="shop-window-item-meta">&#x5206;&#x7EC4;&#xFF1A;{{ shop.groupText }}</p>
              <p class="shop-window-item-note">&#x5907;&#x6CE8;&#xFF1A;{{ shop.noteText }}</p>
            </button>
          </template>
        </div>
      </aside>

      <section class="shop-window-main">
        <div class="shop-window-toolbar">
          <div class="shop-window-toolbar-copy">
            <p class="shop-window-toolbar-label">&#x6D4F;&#x89C8;&#x5668;&#x5165;&#x53E3;</p>
            <strong>&#x5E97;&#x94FA;&#x7A97;&#x53E3;</strong>
          </div>
          <div class="shop-window-tab-group">
            <button
              v-for="tab in workspace.state.tabs"
              :key="tab.pageType"
              class="workspace-tab-button"
              :class="{ 'is-active': workspace.state.activeWorkspaceTab === tab.pageType }"
              type="button"
              :data-workspace-tab-target="tab.pageType"
              @click="handleWorkspaceTabClick(tab.pageType)"
              @dblclick="handleWorkspaceTabDoubleClick(tab.pageType)"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div class="shop-window-workspace">
          <div class="shop-window-workspace-header">
            <div class="shop-window-workspace-details">
              <h3 id="shopWindowCurrentShopName" class="shop-window-workspace-title">
                {{ shopList.state.currentShopName }}
              </h3>
              <p id="shopWindowCurrentShopMeta" class="shop-window-workspace-text">
                {{ shopList.state.currentShopMeta }}
              </p>
            </div>
            <div class="shop-window-workspace-actions">
              <div
                id="shopWindowStorageSyncShell"
                class="shop-window-storage-sync-shell"
                :class="storageSyncStatus.state.shellClassName"
              >
                <span
                  id="shopWindowStorageSyncBadge"
                  class="shop-window-storage-sync-badge"
                >
                  {{ storageSyncStatus.state.badgeText }}
                </span>
                <span
                  id="shopWindowStorageSyncHint"
                  class="shop-window-storage-sync-hint"
                >
                  {{ storageSyncStatus.state.hintText }}
                </span>
              </div>
              <label
                class="shop-window-auto-login-toggle"
                title="&#x4EC5;&#x5BF9;&#x5F53;&#x524D;&#x5E97;&#x94FA;&#x4E0E;&#x5F53;&#x524D;&#x5165;&#x53E3;&#x672C;&#x5730;&#x751F;&#x6548;"
              >
                <input
                  id="shopWindowAutoLoginCheckbox"
                  class="shop-window-auto-login-checkbox"
                  type="checkbox"
                  :checked="shopList.state.autoLoginChecked"
                  :disabled="shopList.state.autoLoginDisabled"
                  @change="handleAutoLoginToggleChange($event.target.checked)"
                />
                <span class="shop-window-auto-login-text">
                  &#x81EA;&#x52A8;&#x767B;&#x5F55;
                </span>
              </label>
            </div>
          </div>

          <div id="shopWindowStatusRow" class="shop-window-status-row">
            <p
              id="shopWindowStorageSyncSummary"
              class="shop-window-storage-sync-summary"
              :title="storageSyncStatus.state.summaryTitle"
            >
              {{ storageSyncStatus.state.summaryText }}
            </p>
            <p
              id="shopWindowTabStatus"
              class="shop-window-tab-status"
              :class="{ 'is-empty': tabStatus.state.isEmpty }"
              :aria-hidden="tabStatus.state.ariaHidden"
              :title="tabStatus.state.title"
            >
              {{ tabStatus.state.message }}
            </p>
          </div>

          <section
            class="workspace-panel"
            :class="{ 'is-active': workspace.state.activeWorkspaceTab === 'seller-center' }"
            data-workspace-panel="seller-center"
            :hidden="workspace.state.activeWorkspaceTab !== 'seller-center'"
          >
            <div class="browser-tab-strip">
              <div
                id="sellerCenterBrowserTabList"
                class="browser-tab-list"
                data-browser-tab-list="seller-center"
              >
                <div
                  v-for="browserTab in getBrowserTabs('seller-center')"
                  :key="browserTab.id"
                  class="browser-tab-item"
                  :class="{ 'is-active': browserTab.isActive }"
                >
                  <button
                    class="browser-tab-button"
                    type="button"
                    :title="browserTab.title"
                    @click="handleBrowserTabClick('seller-center', browserTab.id)"
                  >
                    <span class="browser-tab-label">{{ browserTab.label }}</span>
                  </button>
                  <button
                    v-if="browserTab.closable"
                    class="browser-tab-close"
                    type="button"
                    aria-label="Close"
                    title="&#x5173;&#x95ED;&#x6807;&#x7B7E;"
                    @click.stop="handleBrowserTabClose('seller-center', browserTab.id)"
                  >
                    &#x2715;
                  </button>
                </div>
              </div>
            </div>
            <div class="workspace-browser-shell">
              <div
                class="workspace-browser-host"
                :class="{ 'is-standby': getBrowserHostState('seller-center').isStandby }"
                data-shop-browser-host="seller-center"
              >
                <button
                  v-if="getBrowserHostState('seller-center').canOpen"
                  class="workspace-browser-standby"
                  type="button"
                  @click="handleBrowserHostOpen('seller-center')"
                >
                  <span class="workspace-browser-standby-badge">
                    {{ getBrowserHostState('seller-center').badgeText }}
                  </span>
                  <strong class="workspace-browser-standby-title">
                    {{ getBrowserHostState('seller-center').titleText }}
                  </strong>
                  <span class="workspace-browser-standby-text">
                    {{ getBrowserHostState('seller-center').bodyText }}
                  </span>
                </button>
                <div
                  v-else-if="getBrowserHostState('seller-center').isProgress"
                  class="workspace-browser-standby is-progress"
                  aria-live="polite"
                >
                  <span class="workspace-browser-standby-badge is-progress">
                    {{ getBrowserHostState('seller-center').badgeText }}
                  </span>
                  <strong class="workspace-browser-standby-title">
                    {{ getBrowserHostState('seller-center').titleText }}
                  </strong>
                  <span class="workspace-browser-standby-text">
                    {{ getBrowserHostState('seller-center').bodyText }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section
            class="workspace-panel"
            :class="{ 'is-active': workspace.state.activeWorkspaceTab === 'product-promotion' }"
            data-workspace-panel="product-promotion"
            :hidden="workspace.state.activeWorkspaceTab !== 'product-promotion'"
          >
            <div class="browser-tab-strip">
              <div
                id="productPromotionBrowserTabList"
                class="browser-tab-list"
                data-browser-tab-list="product-promotion"
              >
                <div
                  v-for="browserTab in getBrowserTabs('product-promotion')"
                  :key="browserTab.id"
                  class="browser-tab-item"
                  :class="{ 'is-active': browserTab.isActive }"
                >
                  <button
                    class="browser-tab-button"
                    type="button"
                    :title="browserTab.title"
                    @click="handleBrowserTabClick('product-promotion', browserTab.id)"
                  >
                    <span class="browser-tab-label">{{ browserTab.label }}</span>
                  </button>
                  <button
                    v-if="browserTab.closable"
                    class="browser-tab-close"
                    type="button"
                    aria-label="Close"
                    title="&#x5173;&#x95ED;&#x6807;&#x7B7E;"
                    @click.stop="handleBrowserTabClose('product-promotion', browserTab.id)"
                  >
                    &#x2715;
                  </button>
                </div>
              </div>
            </div>
            <div class="workspace-browser-shell">
              <div
                class="workspace-browser-host"
                :class="{ 'is-standby': getBrowserHostState('product-promotion').isStandby }"
                data-shop-browser-host="product-promotion"
              >
                <button
                  v-if="getBrowserHostState('product-promotion').canOpen"
                  class="workspace-browser-standby"
                  type="button"
                  @click="handleBrowserHostOpen('product-promotion')"
                >
                  <span class="workspace-browser-standby-badge">
                    {{ getBrowserHostState('product-promotion').badgeText }}
                  </span>
                  <strong class="workspace-browser-standby-title">
                    {{ getBrowserHostState('product-promotion').titleText }}
                  </strong>
                  <span class="workspace-browser-standby-text">
                    {{ getBrowserHostState('product-promotion').bodyText }}
                  </span>
                </button>
                <div
                  v-else-if="getBrowserHostState('product-promotion').isProgress"
                  class="workspace-browser-standby is-progress"
                  aria-live="polite"
                >
                  <span class="workspace-browser-standby-badge is-progress">
                    {{ getBrowserHostState('product-promotion').badgeText }}
                  </span>
                  <strong class="workspace-browser-standby-title">
                    {{ getBrowserHostState('product-promotion').titleText }}
                  </strong>
                  <span class="workspace-browser-standby-text">
                    {{ getBrowserHostState('product-promotion').bodyText }}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>

    <ShopWindowUrlModal ref="urlModalRef" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ShopWindowUrlModal from './components/ShopWindowUrlModal.vue';
import { createShopListView } from './runtime/shopListView.js';
import { createWorkspaceView } from './runtime/workspaceView.js';
import { createStorageSyncStatusView } from './runtime/storageSyncStatusView.js';
import { createTabStatusView } from './runtime/tabStatusView.js';

const shopList = createShopListView();
const workspace = createWorkspaceView();
const storageSyncStatus = createStorageSyncStatusView();
const tabStatus = createTabStatusView();
const urlModalRef = ref(null);

function configureWorkspace(options) {
  workspace.configure(options);
}

function configureShopList(options) {
  shopList.configure(options);
}

function configureTabStatus(options) {
  tabStatus.configure(options);
}

function configureStorageSyncStatus(options) {
  storageSyncStatus.configure(options);
}

function configureUrlModal(options) {
  if (urlModalRef.value && typeof urlModalRef.value.configure === 'function') {
    urlModalRef.value.configure(options);
  }
}

function renderStorageSyncStatus() {
  return storageSyncStatus.render();
}

function renderWorkspaceTabs() {
  return workspace.renderWorkspaceTabs();
}

function renderBrowserTabs() {
  return workspace.renderBrowserTabs();
}

function renderBrowserHosts() {
  return workspace.renderBrowserHosts();
}

function getBrowserTabs(pageType) {
  return workspace.getBrowserTabs(pageType);
}

function getBrowserHostState(pageType) {
  return workspace.getBrowserHostState(pageType);
}

function getSelectedShop() {
  return shopList.getSelectedShop();
}

function getShopGroupName(shop) {
  return shopList.getShopGroupName(shop);
}

function getShopNoteText(shop) {
  return shopList.getShopNoteText(shop);
}

function matchesSelectedGroupFilter(shop) {
  return shopList.matchesSelectedGroupFilter(shop);
}

function buildGroupFilterOptions() {
  return shopList.buildGroupFilterOptions();
}

function isSelectedGroupFilterValid(options) {
  return shopList.isSelectedGroupFilterValid(options);
}

function syncFilteredShops() {
  shopList.syncFilteredShops();
}

function syncSelectedShop() {
  shopList.syncSelectedShop();
}

function renderGroupFilterOptions() {
  shopList.renderGroupFilterOptions();
}

function renderShopList() {
  shopList.renderShopList();
}

function renderCurrentShop() {
  shopList.renderCurrentShop();
}

function handleShopListClick(shopId) {
  shopList.handleShopListClick(shopId);
}

function handleWorkspaceTabClick(pageType) {
  workspace.handleWorkspaceTabClick(pageType);
}

function handleWorkspaceTabDoubleClick(pageType) {
  return workspace.handleWorkspaceTabDoubleClick(pageType);
}

function handleBrowserTabClick(pageType, browserTabId) {
  return workspace.handleBrowserTabClick(pageType, browserTabId);
}

function handleBrowserTabClose(pageType, browserTabId) {
  workspace.handleBrowserTabClose(pageType, browserTabId);
}

function handleBrowserHostOpen(pageType) {
  return workspace.handleBrowserHostOpen(pageType);
}

function handleBrowserTabCreated(payload) {
  workspace.handleBrowserTabCreated(payload);
}

function handleBrowserTabClosed(payload) {
  workspace.handleBrowserTabClosed(payload);
}

function handleBrowserTabUpdated(payload) {
  workspace.handleBrowserTabUpdated(payload);
}

function handleBrowserTabReset(payload) {
  workspace.handleBrowserTabReset(payload);
}

function handleGroupFilterChange(value) {
  shopList.handleGroupFilterChange(value);
}

function handleAutoLoginToggleChange(checked) {
  shopList.handleAutoLoginToggleChange(checked);
}

function showTabStatus(payload) {
  tabStatus.show(payload);
}

function hideTabStatus() {
  tabStatus.hide();
}

function openBrowserUrlModal(payload) {
  if (urlModalRef.value && typeof urlModalRef.value.open === 'function') {
    return urlModalRef.value.open(payload);
  }

  return Promise.resolve();
}

function closeBrowserUrlModal() {
  if (urlModalRef.value && typeof urlModalRef.value.close === 'function') {
    urlModalRef.value.close();
  }
}

function isBrowserUrlModalOpen() {
  return Boolean(
    urlModalRef.value
    && typeof urlModalRef.value.isOpen === 'function'
    && urlModalRef.value.isOpen()
  );
}

defineExpose({
  buildGroupFilterOptions,
  closeBrowserUrlModal,
  configureWorkspace,
  configureShopList,
  configureStorageSyncStatus,
  configureTabStatus,
  configureUrlModal,
  getSelectedShop,
  getShopGroupName,
  getShopNoteText,
  handleAutoLoginToggleChange,
  handleBrowserTabClosed,
  handleBrowserTabCreated,
  handleBrowserTabReset,
  handleBrowserTabUpdated,
  handleGroupFilterChange,
  handleShopListClick,
  handleWorkspaceTabClick,
  handleWorkspaceTabDoubleClick,
  hideTabStatus,
  isBrowserUrlModalOpen,
  isSelectedGroupFilterValid,
  matchesSelectedGroupFilter,
  openBrowserUrlModal,
  renderCurrentShop,
  renderBrowserHosts,
  renderBrowserTabs,
  renderGroupFilterOptions,
  renderShopList,
  renderStorageSyncStatus,
  renderWorkspaceTabs,
  showTabStatus,
  syncFilteredShops,
  syncSelectedShop
});
</script>

<style>
.shop-window-vue-root {
  display: contents;
}
</style>
