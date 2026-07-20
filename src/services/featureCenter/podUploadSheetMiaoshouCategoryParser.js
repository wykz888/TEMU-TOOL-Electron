function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCategoryLabel(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean).join('>');
  }

  return normalizeText(value);
}

function addCategoryItem(categoryMap, id, label) {
  const normalizedId = normalizeText(id);
  const normalizedLabel = normalizeCategoryLabel(label);

  if (!/^\d+$/.test(normalizedId) || !normalizedLabel) {
    return;
  }

  categoryMap.set(normalizedId, {
    id: normalizedId,
    label: normalizedLabel
  });
}

function parseLineCategory(line) {
  const normalizedLine = normalizeText(line);

  if (!normalizedLine) {
    return null;
  }

  const separatorIndex = normalizedLine.indexOf('#');

  if (separatorIndex > 0) {
    return {
      id: normalizedLine.slice(0, separatorIndex),
      label: normalizedLine.slice(separatorIndex + 1)
    };
  }

  const leadingIdMatch = normalizedLine.match(/^(\d{2,})\s+(.+)$/);

  if (leadingIdMatch) {
    return {
      id: leadingIdMatch[1],
      label: leadingIdMatch[2]
    };
  }

  return null;
}

function normalizeCategoryRecord(record, fallbackId) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const id = normalizeText(
    record.id
    || record.catId
    || record.categoryId
    || record.cateId
    || record.leafCategoryId
    || record.value
    || fallbackId
  );
  const label = normalizeCategoryLabel(
    record.label
    || record.name
    || record.catName
    || record.categoryName
    || record.leafCategoryName
    || record.fullCategoryName
    || record.categoryPath
    || record.path
    || record.title
  );

  return id && label ? { id, label } : null;
}

function collectJsonCategoryItems(value, categoryMap, depth = 0, fallbackId = '') {
  if (depth > 10 || value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const lineCategory = parseLineCategory(value);
    if (lineCategory) {
      addCategoryItem(categoryMap, lineCategory.id, lineCategory.label);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonCategoryItems(item, categoryMap, depth + 1));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const record = normalizeCategoryRecord(value, fallbackId);

  if (record) {
    addCategoryItem(categoryMap, record.id, record.label);
  }

  Object.entries(value).forEach(([key, childValue]) => {
    if (/^\d+$/.test(key) && (typeof childValue === 'string' || (childValue && typeof childValue === 'object'))) {
      if (typeof childValue === 'string' || Array.isArray(childValue)) {
        addCategoryItem(categoryMap, key, childValue);
        return;
      }

      collectJsonCategoryItems(childValue, categoryMap, depth + 1, key);
      return;
    }

    collectJsonCategoryItems(childValue, categoryMap, depth + 1);
  });
}

function parseJsonCategoryList(text) {
  try {
    const parsedData = JSON.parse(text);
    const categoryMap = new Map();
    collectJsonCategoryItems(parsedData, categoryMap);
    return Array.from(categoryMap.values());
  } catch (_error) {
    return [];
  }
}

function parseTextCategoryList(text) {
  const categoryMap = new Map();

  String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .forEach((line) => {
      const category = parseLineCategory(line);

      if (category) {
        addCategoryItem(categoryMap, category.id, category.label);
      }
    });

  return Array.from(categoryMap.values());
}

function parseCategoryListText(text) {
  const normalizedText = String(text || '').replace(/^\uFEFF/, '');
  const jsonCategories = parseJsonCategoryList(normalizedText);

  return jsonCategories.length > 0 ? jsonCategories : parseTextCategoryList(normalizedText);
}

function normalizeCategories(categories) {
  const categoryMap = new Map();

  (Array.isArray(categories) ? categories : []).forEach((item) => {
    const record = normalizeCategoryRecord(item);

    if (record) {
      addCategoryItem(categoryMap, record.id, record.label);
    }
  });

  return Array.from(categoryMap.values());
}

module.exports = {
  normalizeText,
  normalizeCategories,
  parseCategoryListText
};
