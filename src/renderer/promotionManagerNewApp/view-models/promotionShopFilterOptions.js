function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function firstPresentText(...values) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

export function buildShopFilterOptionsWithCounts(rows) {
  const optionMap = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = firstPresentText(row && row.shopId, row && row.shopName);
    const label = firstPresentText(row && row.shopName, row && row.shopId);

    if (!value) {
      return;
    }

    const entry = optionMap.get(value) || {
      label,
      count: 0
    };

    entry.label = entry.label || label;
    entry.count += 1;
    optionMap.set(value, entry);
  });

  return Array.from(optionMap.entries())
    .sort((left, right) => left[1].label.localeCompare(right[1].label, 'zh-CN', {
      numeric: true,
      sensitivity: 'base'
    }))
    .map(([value, entry]) => ({
      value,
      label: `${entry.label} (${entry.count})`,
      count: entry.count
    }));
}
