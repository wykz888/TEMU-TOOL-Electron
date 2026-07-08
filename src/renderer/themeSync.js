(function initThemeSync() {
  const DEFAULT_PRIMARY_COLOR = '#d4a038';

  function normalizeTheme(theme) {
    return theme === 'dark' ? 'dark' : 'light';
  }

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

    const r = channelToLinear(color.r);
    const g = channelToLinear(color.g);
    const b = channelToLinear(color.b);

    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  }

  function getContrastTextColor(color) {
    return getRelativeLuminance(color) >= 0.56 ? '#172233' : '#ffffff';
  }

  function createPrimaryPalette(primaryColor) {
    const base = parseHexColor(primaryColor);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const mixSteps = Object.freeze({
      1: mixColor(base, white, 0.92),
      2: mixColor(base, white, 0.84),
      3: mixColor(base, white, 0.72),
      4: mixColor(base, white, 0.56),
      5: mixColor(base, white, 0.28),
      6: base,
      7: mixColor(base, black, 0.1),
      8: mixColor(base, black, 0.22),
      9: mixColor(base, black, 0.36),
      10: mixColor(base, black, 0.5)
    });

    return Array.from({ length: 10 }, (_item, index) => {
      const level = index + 1;
      const color = mixSteps[level];

      return {
        level,
        hex: toHexColor(color),
        rgb: toRgbValue(color)
      };
    });
  }

  function applyTheme(theme, appearance) {
    const resolvedTheme = normalizeTheme(theme);
    const resolvedAppearance = normalizeAppearance(appearance);
    const palette = createPrimaryPalette(resolvedAppearance.primaryColor);
    const primaryBase = parseHexColor(palette[5].hex);
    const primaryDeep = parseHexColor(palette[7].hex);
    const contrastTextColor = getContrastTextColor(primaryBase);
    const contrastDeepTextColor = getContrastTextColor(primaryDeep);

    function updateDom() {
      if (!document.body || !document.documentElement) {
        return false;
      }

      const styleTargets = [document.documentElement, document.body];

      document.body.classList.toggle('light-frame-theme', resolvedTheme === 'light');
      document.body.classList.toggle('dark-theme', resolvedTheme === 'dark');
      if (resolvedTheme === 'dark') {
        document.body.setAttribute('arco-theme', 'dark');
      } else {
        document.body.removeAttribute('arco-theme');
      }
      document.documentElement.style.colorScheme = resolvedTheme;

      styleTargets.forEach((target) => {
        palette.forEach((item) => {
          target.style.setProperty(`--arcoblue-${item.level}`, item.rgb);
          target.style.setProperty(`--primary-${item.level}`, item.rgb);
          target.style.setProperty(`--link-${item.level}`, item.rgb);
          target.style.setProperty(`--theme-primary-${item.level}`, item.hex);
          target.style.setProperty(`--theme-primary-rgb-${item.level}`, item.rgb);
        });

        target.style.setProperty('--theme-primary-color', palette[5].hex);
        target.style.setProperty('--theme-primary-color-deep', palette[7].hex);
        target.style.setProperty('--theme-primary-rgb', palette[5].rgb);
        target.style.setProperty('--accent-gold', palette[5].hex);
        target.style.setProperty('--accent-gold-deep', palette[7].hex);
        target.style.setProperty('--theme-primary-contrast', contrastTextColor);
        target.style.setProperty('--theme-primary-contrast-deep', contrastDeepTextColor);
        target.style.setProperty('--theme-primary-ink', palette[8].hex);
        target.style.setProperty('--theme-primary-soft-surface', palette[1].hex);
        target.style.setProperty('--theme-primary-soft-border', palette[3].hex);
      });
      return true;
    }

    if (!updateDom()) {
      document.addEventListener('DOMContentLoaded', updateDom, { once: true });
    }
  }

  window.temuTheme = {
    applyTheme,
    getCurrentTheme() {
      if (document.body && document.body.classList.contains('dark-theme')) {
        return 'dark';
      }

      return 'light';
    },
    getCurrentAppearance() {
      return {
        primaryColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--theme-primary-color')
          .trim() || DEFAULT_PRIMARY_COLOR
      };
    }
  };

  const themeBridge =
    window.temuApp
    && window.temuApp.theme
    && typeof window.temuApp.theme.getTheme === 'function'
      ? window.temuApp.theme
      : null;

  if (!themeBridge) {
    applyTheme('light', {
      primaryColor: DEFAULT_PRIMARY_COLOR
    });
    return;
  }

  Promise.all([
    themeBridge.getTheme(),
    typeof themeBridge.getThemeAppearance === 'function'
      ? themeBridge.getThemeAppearance()
      : Promise.resolve({
        primaryColor: DEFAULT_PRIMARY_COLOR
      })
  ])
    .then(([theme, appearance]) => {
      applyTheme(theme, appearance);
    })
    .catch(() => {
      applyTheme('light', {
        primaryColor: DEFAULT_PRIMARY_COLOR
      });
    });

  if (typeof themeBridge.onThemeChanged === 'function') {
    themeBridge.onThemeChanged((payload) => {
      applyTheme(
        payload && payload.theme,
        payload && payload.appearance
      );
    });
  }
})();

