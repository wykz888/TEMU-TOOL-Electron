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
            <select id="shopWindowGroupFilter" class="shop-window-group-filter">
              <option value="">&#x5168;&#x90E8;&#x5206;&#x7EC4;</option>
            </select>
          </label>
        </div>

        <div id="shopWindowList" class="shop-window-list">
          <div class="shop-window-empty">
            <p class="shop-window-empty-title">&#x6682;&#x65E0;&#x5E97;&#x94FA;</p>
            <p class="shop-window-empty-text">
              &#x8BF7;&#x5148;&#x5728;&#x5E97;&#x94FA;&#x7BA1;&#x7406;&#x91CC;&#x65B0;&#x589E;&#x5E97;&#x94FA;&#x3002;
            </p>
          </div>
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
              class="workspace-tab-button is-active"
              type="button"
              data-workspace-tab-target="seller-center"
            >
              &#x5356;&#x5BB6;&#x4E2D;&#x5FC3;
            </button>
            <button
              class="workspace-tab-button"
              type="button"
              data-workspace-tab-target="product-promotion"
            >
              &#x5546;&#x54C1;&#x63A8;&#x5E7F;
            </button>
          </div>
        </div>

        <div class="shop-window-workspace">
          <div class="shop-window-workspace-header">
            <div class="shop-window-workspace-details">
              <h3 id="shopWindowCurrentShopName" class="shop-window-workspace-title">
                &#x8BF7;&#x9009;&#x62E9;&#x5E97;&#x94FA;
              </h3>
              <p id="shopWindowCurrentShopMeta" class="shop-window-workspace-text">
                &#x5DE6;&#x4FA7;&#x9009;&#x62E9;&#x5E97;&#x94FA;&#x540E;&#xFF0C;&#x5728;&#x8FD9;&#x91CC;&#x5207;&#x6362;&#x5DE5;&#x4F5C;&#x533A;&#x3002;
              </p>
            </div>
            <div class="shop-window-workspace-actions">
              <div
                id="shopWindowStorageSyncShell"
                class="shop-window-storage-sync-shell"
              >
                <span
                  id="shopWindowStorageSyncBadge"
                  class="shop-window-storage-sync-badge"
                >
                  &#x81EA;&#x52A8;&#x540C;&#x6B65;&#x5DF2;&#x5173;
                </span>
                <span
                  id="shopWindowStorageSyncHint"
                  class="shop-window-storage-sync-hint"
                >
                  &#x5E97;&#x94FA;&#x8BBE;&#x7F6E;
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
                />
                <span class="shop-window-auto-login-text">
                  &#x81EA;&#x52A8;&#x767B;&#x5F55;
                </span>
              </label>
            </div>
          </div>

          <div id="shopWindowStatusRow" class="shop-window-status-row">
            <p id="shopWindowStorageSyncSummary" class="shop-window-storage-sync-summary">
              &#x5F53;&#x524D;&#x5E97;&#x94FA;&#x53EF;&#x5728;&#x9996;&#x6B21;&#x8FDB;&#x5165;&#x65F6;&#x81EA;&#x52A8;&#x6062;&#x590D;&#x4E91;&#x7AEF;&#x5B58;&#x50A8;&#xFF0C;&#x5E76;&#x5728;&#x4F7F;&#x7528;&#x8FC7;&#x7A0B;&#x4E2D;&#x81EA;&#x52A8;&#x4E0A;&#x4F20;&#x6700;&#x65B0;&#x6D4F;&#x89C8;&#x5668;&#x6570;&#x636E;&#x3002;
            </p>
            <p
              id="shopWindowTabStatus"
              class="shop-window-tab-status is-empty"
              aria-hidden="true"
            ></p>
          </div>

          <section
            class="workspace-panel is-active"
            data-workspace-panel="seller-center"
          >
            <div class="browser-tab-strip">
              <div
                id="sellerCenterBrowserTabList"
                class="browser-tab-list"
                data-browser-tab-list="seller-center"
              ></div>
            </div>
            <div class="workspace-browser-shell">
              <div
                class="workspace-browser-host"
                data-shop-browser-host="seller-center"
              ></div>
            </div>
          </section>

          <section
            class="workspace-panel"
            data-workspace-panel="product-promotion"
            hidden
          >
            <div class="browser-tab-strip">
              <div
                id="productPromotionBrowserTabList"
                class="browser-tab-list"
                data-browser-tab-list="product-promotion"
              ></div>
            </div>
            <div class="workspace-browser-shell">
              <div
                class="workspace-browser-host"
                data-shop-browser-host="product-promotion"
              ></div>
            </div>
          </section>
        </div>
      </section>
    </div>

    <div id="shopWindowUrlModal" class="modal-shell" hidden>
      <div class="modal-backdrop" data-close-shop-window-modal="url"></div>
      <section
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopWindowUrlModalTitle"
      >
        <header class="modal-header">
          <div>
            <p class="panel-label">&#x6D4F;&#x89C8;&#x5668;&#x7F51;&#x5740;</p>
            <h3 id="shopWindowUrlModalTitle" class="modal-title">&#x65B0;&#x5EFA;&#x7F51;&#x5740;</h3>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="&#x5173;&#x95ED;"
            data-close-shop-window-modal="url"
          >
            &#x2715;
          </button>
        </header>

        <p id="shopWindowUrlModalStatus" class="modal-status" hidden></p>

        <form id="shopWindowUrlForm" class="modal-form">
          <div class="modal-grid modal-grid-single">
            <label class="field-shell" for="shopWindowUrlInput">
              <span class="field-label">&#x8F93;&#x5165;&#x7F51;&#x5740;</span>
              <input
                id="shopWindowUrlInput"
                class="field-input"
                type="text"
                inputmode="url"
                autocomplete="off"
                placeholder="https://ads.temu.com/"
              />
            </label>
          </div>
          <p class="shop-window-url-modal-tip">&#x6309; F7 &#x53EF;&#x5FEB;&#x901F;&#x6253;&#x5F00;&#x8FD9;&#x91CC;&#xFF0C;&#x652F;&#x6301; `https://`&#xFF0C;&#x63D0;&#x4EA4;&#x540E;&#x4F1A;&#x65B0;&#x5EFA;&#x6807;&#x7B7E;&#x5E76;&#x81EA;&#x52A8;&#x8DF3;&#x8F6C;&#x3002;</p>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-close-shop-window-modal="url">
              &#x53D6;&#x6D88;
            </button>
            <button id="shopWindowUrlSubmitButton" class="primary-inline-button" type="submit">
              &#x65B0;&#x5EFA;&#x8DF3;&#x8F6C;
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style>
.shop-window-vue-root {
  display: contents;
}
</style>
