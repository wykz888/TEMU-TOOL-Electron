const fs = require('node:fs');
const path = require('node:path');

const APP_DATA_ROOT_SEGMENT = 'TEMU_Data_Electron';
const LEGACY_SCOPED_DATA_ROOT_SEGMENT = 'TEMU_Data';
const SCOPED_DATA_ROOT_SEGMENT = '';
const migratedScopedRootPaths = new Set();

function shouldReplaceFile(sourceFilePath, targetFilePath) {
  if (!fs.existsSync(targetFilePath)) {
    return true;
  }

  try {
    const sourceStat = fs.statSync(sourceFilePath);
    const targetStat = fs.statSync(targetFilePath);

    return sourceStat.mtimeMs > targetStat.mtimeMs;
  } catch (_error) {
    return false;
  }
}

function mergeLegacyDirectoryContents(sourceDirectoryPath, targetDirectoryPath) {
  if (
    !fs.existsSync(sourceDirectoryPath)
    || !fs.statSync(sourceDirectoryPath).isDirectory()
  ) {
    return;
  }

  fs.mkdirSync(targetDirectoryPath, { recursive: true });

  for (const entry of fs.readdirSync(sourceDirectoryPath, { withFileTypes: true })) {
    const sourceEntryPath = path.join(sourceDirectoryPath, entry.name);
    const targetEntryPath = path.join(targetDirectoryPath, entry.name);

    if (path.resolve(sourceEntryPath) === path.resolve(targetEntryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!fs.existsSync(targetEntryPath)) {
        fs.renameSync(sourceEntryPath, targetEntryPath);
        continue;
      }

      if (!fs.statSync(targetEntryPath).isDirectory()) {
        continue;
      }

      mergeLegacyDirectoryContents(sourceEntryPath, targetEntryPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (
      fs.existsSync(targetEntryPath)
      && fs.statSync(targetEntryPath).isDirectory()
    ) {
      continue;
    }

    if (shouldReplaceFile(sourceEntryPath, targetEntryPath)) {
      fs.copyFileSync(sourceEntryPath, targetEntryPath);
    }
  }
}

function ensureScopedDataRootMigrated(app) {
  const userDataPath = app.getPath('userData');

  if (migratedScopedRootPaths.has(userDataPath)) {
    return;
  }

  const nextScopedRootPath = getAppDataRoot(app);
  const legacyScopedRootPaths = [
    path.join(userDataPath, LEGACY_SCOPED_DATA_ROOT_SEGMENT),
    path.join(nextScopedRootPath, LEGACY_SCOPED_DATA_ROOT_SEGMENT)
  ];

  try {
    fs.mkdirSync(nextScopedRootPath, { recursive: true });

    for (const legacyScopedRootPath of legacyScopedRootPaths) {
      if (path.resolve(legacyScopedRootPath) === path.resolve(nextScopedRootPath)) {
        continue;
      }

      mergeLegacyDirectoryContents(legacyScopedRootPath, nextScopedRootPath);
    }
  } catch (_error) {
    // Ignore migration failures and keep using the unified target path.
  }

  migratedScopedRootPaths.add(userDataPath);
}

function getAppDataRoot(app) {
  return path.join(
    app.getPath('userData'),
    APP_DATA_ROOT_SEGMENT
  );
}

function getScopedDataRoot(app) {
  ensureScopedDataRootMigrated(app);

  return getAppDataRoot(app);
}

module.exports = {
  APP_DATA_ROOT_SEGMENT,
  LEGACY_SCOPED_DATA_ROOT_SEGMENT,
  SCOPED_DATA_ROOT_SEGMENT,
  getAppDataRoot,
  getScopedDataRoot,
  mergeLegacyDirectoryContents
};
