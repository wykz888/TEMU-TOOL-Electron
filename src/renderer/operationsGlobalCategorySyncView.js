(function initOperationsGlobalCategorySyncView() {
  function getFeatureCenterBridge() {
    if (window.temuApp && window.temuApp.featureCenter) {
      return window.temuApp.featureCenter;
    }

    throw new Error('\u529F\u80FD\u4E2D\u5FC3\u901A\u4FE1\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8F6F\u4EF6\u3002');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function toUserFacingErrorMessage(error, fallbackMessage) {
    let message = normalizeText(error && error.message);

    if (!message) {
      return normalizeText(fallbackMessage);
    }

    message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '');
    message = message.replace(/^Error:\s*/i, '');
    message = normalizeText(message);

    return message || normalizeText(fallbackMessage);
  }

  function normalizeIntegerValue(value, fallback = 0) {
    const parsedValue = Number.parseInt(value, 10);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function buildEmptySnapshot() {
    return {
      updatedAt: '',
      syncedAt: '',
      shopId: '',
      shopName: '',
      sourceOrigin: '',
      source: 'default',
      cloudSynced: false,
      rootCount: 0,
      totalCount: 0,
      leafCount: 0,
      nonLeafCount: 0,
      maxLevel: 0,
      requestCount: 0,
      warning: ''
    };
  }

  function normalizeSnapshot(snapshot) {
    const source = normalizeText(snapshot && snapshot.source) || 'default';

    return {
      updatedAt: normalizeText(snapshot && snapshot.updatedAt),
      syncedAt: normalizeText(snapshot && snapshot.syncedAt),
      shopId: normalizeText(snapshot && snapshot.shopId),
      shopName: normalizeText(snapshot && snapshot.shopName),
      sourceOrigin: normalizeText(snapshot && snapshot.sourceOrigin),
      source,
      cloudSynced: snapshot && snapshot.cloudSynced === true,
      rootCount: normalizeIntegerValue(snapshot && snapshot.rootCount, 0),
      totalCount: normalizeIntegerValue(snapshot && snapshot.totalCount, 0),
      leafCount: normalizeIntegerValue(snapshot && snapshot.leafCount, 0),
      nonLeafCount: normalizeIntegerValue(snapshot && snapshot.nonLeafCount, 0),
      maxLevel: normalizeIntegerValue(snapshot && snapshot.maxLevel, 0),
      requestCount: normalizeIntegerValue(snapshot && snapshot.requestCount, 0),
      warning: normalizeText(snapshot && snapshot.warning)
    };
  }

  function createState() {
    return {
      snapshot: buildEmptySnapshot(),
      loading: false,
      syncing: false,
      loaded: false,
      noticeText: '',
      noticeTone: 'info',
      noticeTimer: 0,
      loadPromise: null,
      syncPromise: null
    };
  }

  function getState(container) {
    if (!container.__operationsGlobalCategorySyncState) {
      container.__operationsGlobalCategorySyncState = createState();
    }

    return container.__operationsGlobalCategorySyncState;
  }

  function clearNoticeTimer(state) {
    if (state.noticeTimer) {
      clearTimeout(state.noticeTimer);
      state.noticeTimer = 0;
    }
  }

  function showNotice(container, text, tone = 'info') {
    const state = getState(container);

    clearNoticeTimer(state);
    state.noticeText = normalizeText(text);
    state.noticeTone = normalizeText(tone) || 'info';

    if (state.noticeText) {
      state.noticeTimer = setTimeout(() => {
        state.noticeTimer = 0;
        state.noticeText = '';
        render(container);
      }, 4200);
    }

    render(container);
  }

  function formatTimestamp(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '\u6682\u65E0';
    }

    const timestamp = Date.parse(normalizedValue);

    if (!Number.isFinite(timestamp)) {
      return normalizedValue;
    }

    return new Date(timestamp).toLocaleString('zh-CN', {
      hour12: false
    });
  }

  function getSourceLabel(source) {
    const normalizedSource = normalizeText(source);

    if (normalizedSource === 'live-shop') {
      return '\u5728\u7EBF\u5E97\u94FA';
    }

    if (normalizedSource === 'cache') {
      return '\u5DF2\u6709\u7F13\u5B58';
    }

    if (normalizedSource === 'error') {
      return '\u8BFB\u53D6\u5931\u8D25';
    }

    return '\u5F85\u540C\u6B65';
  }

  function getSyncStatusLabel(snapshot) {
    if (snapshot.totalCount > 0) {
      return '\u5DF2\u51C6\u5907';
    }

    return '\u5F85\u540C\u6B65';
  }

  function getCloudStatusLabel(snapshot) {
    if (snapshot.syncedAt && snapshot.cloudSynced === true) {
      return '\u5DF2\u5199\u5165\u4E91\u7AEF';
    }

    if (snapshot.syncedAt && snapshot.warning) {
      return '\u4EC5\u672C\u5730\u6210\u529F';
    }

    if (snapshot.syncedAt) {
      return '\u5F85\u786E\u8BA4';
    }

    return '\u5F85\u540C\u6B65';
  }

  function renderMetricCard(label, value, accentClass) {
    return `
      <article class="ops-gcs-metric-card ${accentClass}">
        <p class="ops-gcs-metric-label">${escapeHtml(label)}</p>
        <p class="ops-gcs-metric-value">${escapeHtml(value)}</p>
      </article>
    `;
  }

  function renderDetailRow(label, value) {
    return `
      <div class="ops-gcs-detail-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `;
  }

  function render(container) {
    const state = getState(container);
    const snapshot = normalizeSnapshot(state.snapshot);
    const loadingText = state.syncing
      ? '\u6B63\u5728\u4F7F\u7528\u5728\u7EBF\u5E97\u94FA\u5168\u91CF\u540C\u6B65\u7C7B\u76EE\uFF0C\u8BF7\u7A0D\u5019... \u7C7B\u76EE\u8F83\u591A\u65F6\u53EF\u80FD\u9700\u8981 1-3 \u5206\u949F\uFF0C\u5982\u679C\u63A5\u53E3\u5361\u4F4F\u4F1A\u81EA\u52A8\u8D85\u65F6\u3002'
      : (state.loading ? '\u6B63\u5728\u5237\u65B0\u6700\u65B0\u540C\u6B65\u72B6\u6001...' : '');
    const shopDisplayName = snapshot.shopName || snapshot.shopId || '\u6682\u672A\u8BB0\u5F55';
    const canStartSync = state.syncing !== true;

    container.innerHTML = `
      <section class="ops-gcs-view operations-module-workspace">
        <div class="ops-gcs-hero-card">
          <div class="ops-gcs-hero-copy">
            <p class="ops-gcs-eyebrow">\u8FD0\u8425\u5DE5\u5177</p>
            <h2 class="ops-gcs-title">\u5168\u91CF\u540C\u6B65\u7C7B\u76EE</h2>
            <p class="ops-gcs-hint">
              \u540C\u6B65\u524D\u8BF7\u786E\u8BA4\u6D4F\u89C8\u7A97\u53E3\u91CC\u7684\u5E97\u94FA\u5DF2\u8FDB\u5165\u5356\u5BB6\u4E2D\u5FC3\u5168\u7403\u540E\u53F0\u5DE5\u4F5C\u53F0\uFF1B\u5982\u679C\u767B\u5F55\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u9A8C\u8BC1\u7801\u3001\u6388\u6743\u6216\u534F\u8BAE\u786E\u8BA4\uFF0C\u8BF7\u5148\u5728\u6D4F\u89C8\u7A97\u53E3\u624B\u52A8\u5B8C\u6210\u540E\u518D\u91CD\u8BD5\u3002
            </p>
          </div>

          <div class="ops-gcs-hero-actions">
            <button
              class="ops-gcs-button is-light"
              type="button"
              data-global-category-sync-action="refresh"
              ${state.loading || state.syncing ? ' disabled' : ''}
            >
              \u5237\u65B0\u72B6\u6001
            </button>
            <button
              class="ops-gcs-button is-primary"
              type="button"
              data-global-category-sync-action="sync"
              ${canStartSync ? '' : ' disabled'}
            >
              ${state.syncing ? '\u540C\u6B65\u4E2D...' : '\u4F7F\u7528\u5728\u7EBF\u5E97\u94FA\u4E00\u952E\u540C\u6B65'}
            </button>
          </div>
        </div>

        ${loadingText ? `<div class="ops-gcs-banner is-info">${escapeHtml(loadingText)}</div>` : ''}
        ${state.noticeText ? `<div class="ops-gcs-banner is-${escapeHtml(state.noticeTone)}">${escapeHtml(state.noticeText)}</div>` : ''}
        ${snapshot.warning ? `<div class="ops-gcs-banner is-warn">${escapeHtml(snapshot.warning)}</div>` : ''}

        <div class="ops-gcs-metric-grid">
          ${renderMetricCard('\u7F13\u5B58\u72B6\u6001', getSyncStatusLabel(snapshot), 'is-blue')}
          ${renderMetricCard('\u4E91\u7AEF\u5199\u5165', getCloudStatusLabel(snapshot), 'is-gold')}
          ${renderMetricCard('\u6839\u7C7B\u76EE', String(snapshot.rootCount), 'is-slate')}
          ${renderMetricCard('\u603B\u7C7B\u76EE', String(snapshot.totalCount), 'is-green')}
        </div>

        <div class="ops-gcs-detail-grid">
          <article class="ops-gcs-detail-card">
            <h3>\u540C\u6B65\u7ED3\u679C</h3>
            <dl class="ops-gcs-detail-list">
              ${renderDetailRow('\u540C\u6B65\u6765\u6E90', getSourceLabel(snapshot.source))}
              ${renderDetailRow('\u4F7F\u7528\u5E97\u94FA', shopDisplayName)}
              ${renderDetailRow('Shop ID', snapshot.shopId || '\u6682\u65E0')}
              ${renderDetailRow('\u7AD9\u70B9\u57DF\u540D', snapshot.sourceOrigin || '\u6682\u65E0')}
              ${renderDetailRow('\u6700\u8FD1\u540C\u6B65', formatTimestamp(snapshot.syncedAt))}
              ${renderDetailRow('\u66F4\u65B0\u65F6\u95F4', formatTimestamp(snapshot.updatedAt))}
            </dl>
          </article>

          <article class="ops-gcs-detail-card">
            <h3>\u7C7B\u76EE\u7EDF\u8BA1</h3>
            <dl class="ops-gcs-detail-list">
              ${renderDetailRow('\u603B\u8BF7\u6C42\u6B21\u6570', String(snapshot.requestCount))}
              ${renderDetailRow('\u53F6\u5B50\u7C7B\u76EE', String(snapshot.leafCount))}
              ${renderDetailRow('\u975E\u53F6\u5B50\u7C7B\u76EE', String(snapshot.nonLeafCount))}
              ${renderDetailRow('\u6700\u5927\u5C42\u7EA7', String(snapshot.maxLevel))}
            </dl>
          </article>
        </div>
      </section>
    `;
  }

  async function loadSnapshot(container, options = {}) {
    const state = getState(container);

    if (state.loading === true && state.loadPromise) {
      return state.loadPromise;
    }

    if (options.force !== true && state.loaded === true) {
      return state.snapshot;
    }

    state.loading = true;
    render(container);

    state.loadPromise = getFeatureCenterBridge().getOperationsProductGlobalCategorySyncSnapshot()
      .then((snapshot) => {
        state.snapshot = normalizeSnapshot(snapshot);
        state.loaded = true;
        return state.snapshot;
      })
      .catch((error) => {
        const errorMessage = toUserFacingErrorMessage(
          error,
          '\u8BFB\u53D6\u7C7B\u76EE\u540C\u6B65\u72B6\u6001\u5931\u8D25\u3002'
        );

        showNotice(container, errorMessage, 'error');
        return state.snapshot;
      })
      .finally(() => {
        state.loading = false;
        state.loadPromise = null;
        render(container);
      });

    return state.loadPromise;
  }

  async function syncNow(container) {
    const state = getState(container);

    if (state.syncing === true && state.syncPromise) {
      return state.syncPromise;
    }

    state.syncing = true;
    render(container);

    state.syncPromise = getFeatureCenterBridge().syncOperationsProductGlobalCategoryTreeFromOnlineShop({})
      .then((snapshot) => {
        state.snapshot = normalizeSnapshot(snapshot);
        state.loaded = true;
        const shopDisplayName = state.snapshot.shopName || state.snapshot.shopId || '\u5E97\u94FA';
        const resultMessage = state.snapshot.cloudSynced === true
          ? `\u5DF2\u4F7F\u7528\u300C${shopDisplayName}\u300D\u540C\u6B65\u5168\u91CF\u7C7B\u76EE\uFF0C\u5171 ${state.snapshot.totalCount} \u4E2A\u7C7B\u76EE\u3002`
          : `\u5DF2\u4F7F\u7528\u300C${shopDisplayName}\u300D\u5B8C\u6210\u672C\u5730\u540C\u6B65\uFF0C\u4F46\u4E91\u7AEF\u5199\u5165\u5931\u8D25\u3002`;

        showNotice(
          container,
          resultMessage,
          state.snapshot.cloudSynced === true ? 'success' : 'warn'
        );
        return state.snapshot;
      })
      .catch((error) => {
        const errorMessage = toUserFacingErrorMessage(
          error,
          '\u5168\u91CF\u7C7B\u76EE\u540C\u6B65\u5931\u8D25\u3002'
        );

        showNotice(container, errorMessage, 'error');
        return state.snapshot;
      })
      .finally(() => {
        state.syncing = false;
        state.syncPromise = null;
        render(container);
      });

    return state.syncPromise;
  }

  function handleClick(container, event) {
    const target = event.target instanceof Element ? event.target.closest('[data-global-category-sync-action]') : null;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const actionId = normalizeText(target.getAttribute('data-global-category-sync-action'));

    if (actionId === 'refresh') {
      void loadSnapshot(container, {
        force: true
      });
      return;
    }

    if (actionId === 'sync') {
      void syncNow(container);
    }
  }

  function mount(container) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    if (container.dataset.operationsGlobalCategorySyncMounted !== 'true') {
      container.dataset.operationsGlobalCategorySyncMounted = 'true';
      container.addEventListener('click', (event) => {
        handleClick(container, event);
      });

      render(container);
      void loadSnapshot(container);
    }

    if (!container.__operationsGlobalCategorySyncController) {
      container.__operationsGlobalCategorySyncController = {
        panel: container,
        activate() {
          void loadSnapshot(container, {
            force: true
          });
        },
        deactivate() {}
      };
    }

    return container.__operationsGlobalCategorySyncController;
  }

  window.operationsGlobalCategorySyncView = {
    mount
  };
})();
