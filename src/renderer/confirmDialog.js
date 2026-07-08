(function initConfirmDialogWindow() {
  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeTone(value) {
    const normalizedValue = normalizeText(value).toLowerCase();

    if (normalizedValue === 'danger' || normalizedValue === 'warning') {
      return normalizedValue;
    }

    return 'primary';
  }

  function normalizeTheme(value) {
    return normalizeText(value).toLowerCase() === 'dark' ? 'dark' : 'light';
  }

  function getBridge() {
    if (
      window.temuConfirmDialog
      && typeof window.temuConfirmDialog.getPayload === 'function'
      && typeof window.temuConfirmDialog.resolve === 'function'
    ) {
      return window.temuConfirmDialog;
    }

    throw new Error('Confirm dialog bridge is unavailable.');
  }

  function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`Missing dialog element: ${id}`);
    }

    return element;
  }

  let settled = false;

  function resolveDialog(confirmed) {
    if (settled) {
      return;
    }

    settled = true;
    getBridge().resolve({
      confirmed: confirmed === true
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const payload = getBridge().getPayload() || {};
    const title = normalizeText(payload.title) || '\u64cd\u4f5c\u786e\u8ba4';
    const message = normalizeText(payload.message) || '\u8bf7\u786e\u8ba4\u662f\u5426\u7ee7\u7eed\u3002';
    const detail = normalizeText(payload.detail);
    const confirmText = normalizeText(payload.confirmText) || '\u786e\u8ba4';
    const cancelText = normalizeText(payload.cancelText) || '\u53d6\u6d88';
    const badgeText = normalizeText(payload.badgeText) || '\u64cd\u4f5c\u786e\u8ba4';
    const theme = normalizeTheme(payload.theme);
    const tone = normalizeTone(payload.tone);

    const badgeElement = getElement('confirmDialogBadge');
    const cardElement = getElement('confirmDialogCard');
    const titleElement = getElement('confirmDialogTitle');
    const messageElement = getElement('confirmDialogMessage');
    const detailElement = getElement('confirmDialogDetail');
    const closeButton = getElement('confirmDialogCloseButton');
    const cancelButton = getElement('confirmDialogCancelButton');
    const confirmButton = getElement('confirmDialogConfirmButton');

    document.body.dataset.theme = theme;
    document.body.dataset.tone = tone;
    badgeElement.textContent = badgeText;
    titleElement.textContent = title;
    messageElement.textContent = message;
    confirmButton.textContent = confirmText;
    cancelButton.textContent = cancelText;

    if (detail) {
      detailElement.hidden = false;
      detailElement.textContent = detail;
    } else {
      detailElement.hidden = true;
      detailElement.textContent = '';
    }

    closeButton.addEventListener('click', () => {
      resolveDialog(false);
    });

    cancelButton.addEventListener('click', () => {
      resolveDialog(false);
    });

    confirmButton.addEventListener('click', () => {
      resolveDialog(true);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveDialog(false);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        resolveDialog(true);
      }
    });

    requestAnimationFrame(() => {
      cardElement.focus();
    });
  });
})();
