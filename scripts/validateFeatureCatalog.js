const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const {
  FEATURE_CENTER_CATALOG
} = require('../src/features/featureCenter/catalog');
const {
  CREATION_CENTER_CATALOG
} = require('../src/features/creationCenter/catalog');

const REQUIRED_FIELDS = Object.freeze([
  'id',
  'title',
  'storageKey',
  'codeCategory',
  'codeDirectory'
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function collectEntries(catalog, centerName) {
  const entries = [];

  (Array.isArray(catalog) ? catalog : []).forEach((feature) => {
    entries.push({
      centerName,
      entryKind: 'feature',
      entry: feature
    });

    (Array.isArray(feature && feature.modules) ? feature.modules : []).forEach((moduleEntry) => {
      entries.push({
        centerName,
        entryKind: 'module',
        parentId: normalizeText(feature && feature.id),
        entry: moduleEntry
      });
    });
  });

  return entries;
}

function validateEntryShape(record) {
  const entry = record.entry || {};
  const label = `${record.centerName}:${record.entryKind}:${normalizeText(entry.id) || '<missing-id>'}`;

  REQUIRED_FIELDS.forEach((fieldName) => {
    assert(normalizeText(entry[fieldName]), `${label} missing ${fieldName}`);
  });

  const codePath = path.resolve(rootDir, entry.codeDirectory);
  assert(fs.existsSync(codePath), `${label} codeDirectory does not exist: ${entry.codeDirectory}`);

  if (record.entryKind === 'module') {
    assert(
      normalizeText(entry.storageKey) !== normalizeText(record.entry && record.parentStorageKey),
      `${label} module must not reuse parent storageKey`
    );
  }
}

function assertUnique(entries, fieldName) {
  const seen = new Map();

  entries.forEach((record) => {
    const value = normalizeText(record.entry && record.entry[fieldName]);
    if (!value) {
      return;
    }

    const currentLabel = `${record.centerName}:${record.entryKind}:${normalizeText(record.entry && record.entry.id)}`;
    const previousLabel = seen.get(value);
    assert(!previousLabel, `duplicate ${fieldName} "${value}" in ${previousLabel} and ${currentLabel}`);
    seen.set(value, currentLabel);
  });
}

function attachParentStorageKeys(entries) {
  const storageKeyById = new Map();

  entries.forEach((record) => {
    if (record.entryKind === 'feature') {
      storageKeyById.set(
        `${record.centerName}:${normalizeText(record.entry && record.entry.id)}`,
        normalizeText(record.entry && record.entry.storageKey)
      );
    }
  });

  return entries.map((record) => {
    if (record.entryKind !== 'module') {
      return record;
    }

    return {
      ...record,
      entry: {
        ...(record.entry || {}),
        parentStorageKey: storageKeyById.get(`${record.centerName}:${normalizeText(record.parentId)}`) || ''
      }
    };
  });
}

function validateOperationsCatalogBoundaries(entries) {
  const visibleEntries = entries.filter((record) => record.centerName === 'featureCenter');
  const oldVisibleIds = new Set([
    'operations-management',
    'operations-product-management'
  ]);

  visibleEntries.forEach((record) => {
    const entry = record.entry || {};
    const id = normalizeText(entry.id);
    const storageKey = normalizeText(entry.storageKey);

    assert(!oldVisibleIds.has(id), `removed operations card is still visible: ${id}`);

    if (id.startsWith('operations-')) {
      assert(
        !storageKey.startsWith('feature_center/operations_management/'),
        `${id} still writes to old operations_management module storage`
      );
    }
  });
}

function main() {
  const entries = attachParentStorageKeys([
    ...collectEntries(FEATURE_CENTER_CATALOG, 'featureCenter'),
    ...collectEntries(CREATION_CENTER_CATALOG, 'creationCenter')
  ]);

  assert(entries.length > 0, 'catalog entries are empty');
  entries.forEach(validateEntryShape);
  assertUnique(entries, 'id');
  assertUnique(entries, 'storageKey');
  validateOperationsCatalogBoundaries(entries);

  console.log(`feature catalog validation passed: ${entries.length} entries`);
}

main();
