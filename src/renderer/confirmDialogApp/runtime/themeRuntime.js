const DEFAULT_PRIMARY_COLOR = '#d4a038';

function normalizeHexColor(value) {
  const text = String(value || '').trim();

  if (/^#?[0-9a-fA-F]{3}$/.test(text)) {
    const normalized = text.startsWith('#') ? text.slice(1) : text;
    return `#${normalized.split('').map((item) => `${item}${item}`).join('').toLowerCase()}`;
  }

  if (/^#?[0-9a-fA-F]{6}$/.test(text)) {
    const normalized = text.startsWith('#') ? text.slice(1) : text;
    return `#${normalized.toLowerCase()}`;
  }

  return DEFAULT_PRIMARY_COLOR;
}

function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

function normalizeAppearance(appearance) {
  const source = appearance && typeof appearance === 'object' ? appearance : {};

  return {
    primaryColor: normalizeHexColor(source.primaryColor)
  };
}

function applyFallbackTheme(theme, appearance) {
  const resolvedTheme = normalizeTheme(theme);
  const resolvedAppearance = normalizeAppearance(appearance);
  const targets = [document.documentElement, document.body].filter(Boolean);

  if (document.body) {
    document.body.classList.toggle('light-frame-theme', resolvedTheme === 'light');
    document.body.classList.toggle('dark-theme', resolvedTheme === 'dark');
    if (resolvedTheme === 'dark') {
      document.body.setAttribute('arco-theme', 'dark');
    } else {
      document.body.removeAttribute('arco-theme');
    }
  }

  if (document.documentElement) {
    document.documentElement.style.colorScheme = resolvedTheme;
  }

  targets.forEach((target) => {
    target.style.setProperty('--theme-primary-color', resolvedAppearance.primaryColor);
    target.style.setProperty('--theme-primary-color-deep', resolvedAppearance.primaryColor);
    target.style.setProperty('--theme-primary-rgb', '212, 160, 56');
    target.style.setProperty('--theme-primary-contrast', '#172233');
    target.style.setProperty('--theme-primary-ink', '#7f5f20');
    target.style.setProperty('--theme-primary-soft-surface', '#fbf2dd');
    target.style.setProperty('--theme-primary-soft-border', '#ecd39d');
  });
}

export function applyDialogTheme(theme, appearance) {
  if (
    window.temuTheme
    && typeof window.temuTheme.applyTheme === 'function'
  ) {
    window.temuTheme.applyTheme(theme, appearance);
    return;
  }

  applyFallbackTheme(theme, appearance);
}
