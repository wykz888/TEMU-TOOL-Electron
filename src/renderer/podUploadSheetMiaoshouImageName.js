(function initPodUploadSheetMiaoshouImageName(root, factory) {
  const api = factory();

  if (root && typeof root === 'object') {
    root.podUploadSheetMiaoshouImageName = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function buildPodUploadSheetMiaoshouImageNameApi() {
  function normalizeText(value) {
    return value == null ? '' : String(value).trim();
  }

  function splitPath(value) {
    return normalizeText(value)
      .replace(/\\/g, '/')
      .split('/')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function getLeafName(value) {
    const segments = splitPath(value);

    if (!segments.length) {
      return normalizeText(value);
    }

    return segments[segments.length - 1];
  }

  function stripExtension(fileName) {
    return getLeafName(fileName).replace(/\.[^.\\/]+$/, '');
  }

  function escapeRegExp(value) {
    return normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getContextPrefixes(context) {
    const prefixes = [];
    const addPrefix = (value) => {
      const text = normalizeText(value);

      if (text && prefixes.indexOf(text) < 0) {
        prefixes.push(text);
      }
    };

    addPrefix(context && context.productKey);

    const sourceFolderSegments = splitPath(context && context.sourceFolder);
    addPrefix(sourceFolderSegments[sourceFolderSegments.length - 1]);

    const relativePathSegments = splitPath(context && context.relativePath);
    if (relativePathSegments.length > 1) {
      addPrefix(relativePathSegments[relativePathSegments.length - 2]);
    }

    return prefixes;
  }

  function stripKnownPrefix(baseName, prefix) {
    const text = normalizeText(baseName);
    const prefixText = normalizeText(prefix);

    if (!text || !prefixText || text.length < prefixText.length) {
      return '';
    }

    const matched = text.match(new RegExp(`^${escapeRegExp(prefixText)}[\\s._-]+(.+)$`, 'i'));

    if (!matched) {
      return '';
    }

    return normalizeText(matched[1]).replace(/^[\s._-]+/, '').replace(/[\s._-]+$/, '');
  }

  function getSequenceSuffix(baseName) {
    const segments = normalizeText(baseName)
      .split(/[\s._-]+/)
      .map((item) => normalizeText(item))
      .filter(Boolean);

    if (segments.length < 2) {
      return '';
    }

    const suffix = segments[segments.length - 1];
    return /^\d{1,3}$/.test(suffix) ? suffix : '';
  }

  function normalizeMaterialNameKey(value) {
    const baseName = stripExtension(value);

    if (!baseName) {
      return '';
    }

    const sequenceSuffix = getSequenceSuffix(baseName);
    return normalizeText(sequenceSuffix || baseName).toLowerCase();
  }

  function normalizeMaterialDisplayName(fileName, context = {}) {
    const leafName = getLeafName(fileName);

    if (!leafName) {
      return '';
    }

    const baseName = stripExtension(leafName);

    if (!baseName) {
      return leafName;
    }

    const prefixes = getContextPrefixes(context);

    for (const prefix of prefixes) {
      const strippedName = stripKnownPrefix(baseName, prefix);

      if (strippedName) {
        return strippedName;
      }
    }

    return leafName;
  }

  return {
    normalizeMaterialDisplayName,
    normalizeMaterialNameKey
  };
});
