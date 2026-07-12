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

function parseHexColor(value) {
  const normalized = normalizeHexColor(value);

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixColor(fromColor, toColor, weight) {
  const ratio = Math.max(0, Math.min(1, Number(weight) || 0));

  return {
    r: clampChannel(fromColor.r + (toColor.r - fromColor.r) * ratio),
    g: clampChannel(fromColor.g + (toColor.g - fromColor.g) * ratio),
    b: clampChannel(fromColor.b + (toColor.b - fromColor.b) * ratio)
  };
}

function toHexColor(color) {
  return `#${[color.r, color.g, color.b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function toRgbValue(color) {
  return `${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}`;
}

function getRelativeLuminance(color) {
  function channelToLinear(value) {
    const srgb = clampChannel(value) / 255;

    return srgb <= 0.03928
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  }

  return (
    (0.2126 * channelToLinear(color.r))
    + (0.7152 * channelToLinear(color.g))
    + (0.0722 * channelToLinear(color.b))
  );
}

function getContrastTextColor(color) {
  return getRelativeLuminance(color) >= 0.56 ? '#172233' : '#ffffff';
}

function applyFallbackTheme(theme, appearance) {
  const resolvedTheme = normalizeTheme(theme);
  const resolvedAppearance = normalizeAppearance(appearance);
  const primaryColor = parseHexColor(resolvedAppearance.primaryColor);
  const primarySoft = mixColor(primaryColor, { r: 255, g: 255, b: 255 }, 0.92);
  const primaryBorder = mixColor(primaryColor, { r: 255, g: 255, b: 255 }, 0.72);
  const primaryDeep = mixColor(primaryColor, { r: 0, g: 0, b: 0 }, 0.1);
  const primaryInk = mixColor(primaryColor, { r: 0, g: 0, b: 0 }, 0.22);
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
    target.style.setProperty('--theme-primary-color-deep', toHexColor(primaryDeep));
    target.style.setProperty('--theme-primary-rgb', toRgbValue(primaryColor));
    target.style.setProperty('--theme-primary-contrast', getContrastTextColor(primaryColor));
    target.style.setProperty('--theme-primary-ink', toHexColor(primaryInk));
    target.style.setProperty('--theme-primary-soft-surface', toHexColor(primarySoft));
    target.style.setProperty('--theme-primary-soft-border', toHexColor(primaryBorder));
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
