const DEFAULT_TITLE = '\u64cd\u4f5c\u786e\u8ba4';
const DEFAULT_BADGE_TEXT = '\u64cd\u4f5c\u786e\u8ba4';
const DEFAULT_MESSAGE = '\u8bf7\u786e\u8ba4\u662f\u5426\u7ee7\u7eed\u3002';
const DEFAULT_CONFIRM_TEXT = '\u786e\u8ba4';
const DEFAULT_CANCEL_TEXT = '\u53d6\u6d88';

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

  throw new Error('\u786e\u8ba4\u5f39\u7a97\u6865\u63a5\u672a\u5c31\u7eea\u3002');
}

export function readConfirmDialogPayload() {
  const payload = getBridge().getPayload() || {};
  const tone = normalizeTone(payload.tone);

  return {
    requestId: normalizeText(payload.requestId),
    title: normalizeText(payload.title) || DEFAULT_TITLE,
    badgeText: normalizeText(payload.badgeText) || DEFAULT_BADGE_TEXT,
    message: normalizeText(payload.message) || DEFAULT_MESSAGE,
    detail: normalizeText(payload.detail),
    confirmText: normalizeText(payload.confirmText) || DEFAULT_CONFIRM_TEXT,
    cancelText: normalizeText(payload.cancelText) || DEFAULT_CANCEL_TEXT,
    tone,
    theme: normalizeTheme(payload.theme),
    appearance: payload.appearance && typeof payload.appearance === 'object'
      ? payload.appearance
      : null
  };
}

export function resolveConfirmDialog(confirmed) {
  getBridge().resolve({
    confirmed: confirmed === true
  });
}
