(function initExitProgressWindow() {
  function normalizeText(value) {
    return value == null ? '' : String(value).trim();
  }

  function normalizeTheme(value) {
    return normalizeText(value).toLowerCase() === 'dark' ? 'dark' : 'light';
  }

  function normalizeStatus(value) {
    const normalized = normalizeText(value).toLowerCase();

    if (normalized === 'success' || normalized === 'warning' || normalized === 'error') {
      return normalized;
    }

    return 'running';
  }

  function clampPercent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.max(0, Math.min(100, numericValue));
  }

  function getBridge() {
    if (
      window.temuExitProgress
      && typeof window.temuExitProgress.getPayload === 'function'
      && typeof window.temuExitProgress.onUpdate === 'function'
    ) {
      return window.temuExitProgress;
    }

    throw new Error('Exit progress bridge is unavailable.');
  }

  function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`Missing progress element: ${id}`);
    }

    return element;
  }

  function buildViewState(payload = {}) {
    const phase = normalizeText(payload.phase).toLowerCase();
    const shopName = normalizeText(payload.shopName);
    const shopIndex = Math.max(0, Number(payload.shopIndex) || 0);
    const shopTotal = Math.max(0, Number(payload.shopTotal) || 0);
    const failureCount = Math.max(0, Number(payload.failureCount) || 0);
    const progressValue = Number(payload.progressValue);
    const hasProgressValue = Number.isFinite(progressValue);
    let title = '\u9000\u51fa\u4fdd\u5b58';
    let badgeText = '\u4fdd\u5b58\u4e2d';
    let message = '\u6b63\u5728\u51c6\u5907\u9000\u51fa\u3002';
    let detail = shopTotal > 0 ? `\u5e97\u94fa ${Math.min(shopIndex, shopTotal)}/${shopTotal}` : '\u6b63\u5728\u51c6\u5907\u4fdd\u5b58\u3002';
    let hint = '\u4fdd\u5b58\u5b8c\u6210\u540e\u4f1a\u81ea\u52a8\u9000\u51fa\u8f6f\u4ef6\u3002';
    let status = 'running';
    let percent = hasProgressValue ? clampPercent(progressValue * 100) : 0;

    if (phase === 'persist-session') {
      message = '\u6b63\u5728\u4fdd\u5b58\u5e97\u94fa\u4f1a\u8bdd\u3002';
    } else if (phase === 'sync-browser-storage') {
      message = '\u6b63\u5728\u540c\u6b65\u6d4f\u89c8\u5668\u6570\u636e\u3002';
    } else if (phase === 'done') {
      title = '\u9000\u51fa\u5b8c\u6210';
      badgeText = failureCount > 0 ? '\u5b8c\u6210\u4f46\u6709\u8b66\u544a' : '\u5df2\u5b8c\u6210';
      message = failureCount > 0
        ? '\u4fdd\u5b58\u5df2\u5b8c\u6210\uff0c\u4f46\u6709\u90e8\u5206\u5931\u8d25\uff0c\u6b63\u5728\u9000\u51fa\u3002'
        : '\u4fdd\u5b58\u5df2\u5b8c\u6210\uff0c\u6b63\u5728\u9000\u51fa\u3002';
      detail = failureCount > 0
        ? `\u5df2\u5b8c\u6210 ${shopTotal}/${shopTotal}\uff0c\u5931\u8d25 ${failureCount} \u9879`
        : `\u5df2\u5b8c\u6210 ${shopTotal}/${shopTotal}`;
      hint = '\u8f6f\u4ef6\u5c06\u5728\u4fdd\u5b58\u7ed3\u675f\u540e\u81ea\u52a8\u5173\u95ed\u3002';
      status = failureCount > 0 ? 'warning' : 'success';
      percent = 100;
    } else if (phase === 'error') {
      title = '\u9000\u51fa\u5f02\u5e38';
      badgeText = '\u51fa\u73b0\u95ee\u9898';
      message = '\u4fdd\u5b58\u8fc7\u7a0b\u53d1\u751f\u95ee\u9898\uff0c\u6b63\u5728\u9000\u51fa\u3002';
      detail = normalizeText(payload.detail) || '\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002';
      hint = '\u8f6f\u4ef6\u5c06\u7ee7\u7eed\u9000\u51fa\u3002';
      status = 'error';
      percent = hasProgressValue ? clampPercent(progressValue * 100) : 100;
    } else if (shopTotal === 0) {
      message = '\u672a\u68c0\u6d4b\u5230\u9700\u8981\u4fdd\u5b58\u7684\u5e97\u94fa\uff0c\u6b63\u5728\u9000\u51fa\u3002';
      detail = '\u65e0\u9700\u4fdd\u5b58\u7684\u5e97\u94fa';
      percent = hasProgressValue ? clampPercent(progressValue * 100) : 100;
    } else if (shopName) {
      detail = `\u5e97\u94fa ${Math.min(shopIndex, shopTotal)}/${shopTotal}\uff1a${shopName}`;
    }

    return {
      badgeText,
      detail,
      hint,
      message,
      percent,
      percentText: `${Math.round(percent)}%`,
      status,
      title
    };
  }

  function renderState(elements, payload) {
    const state = buildViewState(payload);

    document.body.dataset.status = state.status;
    document.body.dataset.theme = normalizeTheme(payload && payload.theme);
    elements.badge.textContent = state.badgeText;
    elements.title.textContent = state.title;
    elements.message.textContent = state.message;
    elements.detail.textContent = state.detail;
    elements.hint.textContent = state.hint;
    elements.percent.textContent = state.percentText;
    elements.bar.style.width = `${state.percent}%`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bridge = getBridge();
    const elements = {
      badge: getElement('exitProgressBadge'),
      title: getElement('exitProgressTitle'),
      message: getElement('exitProgressMessage'),
      detail: getElement('exitProgressDetail'),
      hint: getElement('exitProgressHint'),
      percent: getElement('exitProgressPercent'),
      bar: getElement('exitProgressBar'),
      card: getElement('exitProgressCard')
    };
    const initialPayload = bridge.getPayload() || {};

    renderState(elements, initialPayload);
    bridge.onUpdate((nextPayload) => {
      renderState(elements, nextPayload || initialPayload);
    });

    requestAnimationFrame(() => {
      elements.card.focus();
    });
  });
})();
