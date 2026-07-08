export function normalizeCatalogEntries(entries) {
  return Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry === 'object')
    : [];
}

export function getCatalogModules(entry) {
  return Array.isArray(entry && entry.modules)
    ? entry.modules.filter((item) => item && typeof item === 'object')
    : [];
}

export function getCatalogModuleCount(entry) {
  return getCatalogModules(entry).length;
}

export function getCatalogReadyCount(entries) {
  return normalizeCatalogEntries(entries).filter((entry) => {
    return typeof (entry && entry.windowAction) === 'string' && entry.windowAction.trim();
  }).length;
}

export function getCatalogModuleTotal(entries) {
  return normalizeCatalogEntries(entries).reduce((total, entry) => {
    return total + getCatalogModuleCount(entry);
  }, 0);
}

export function getCatalogSummary(entry) {
  const modules = getCatalogModules(entry);

  if (!modules.length) {
    return '';
  }

  return modules
    .map((moduleEntry) => String(moduleEntry.title || '').trim())
    .filter(Boolean)
    .join(' / ');
}
