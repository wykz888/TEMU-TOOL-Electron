const fs = require('node:fs');
const path = require('node:path');

const APP_DATA_ROOT_SEGMENT = 'TEMU_Data_Electron';
const SCOPED_DATA_ROOT_SEGMENT = 'TEMU_Data';
const migratedScopedRootPaths = new Set();

function ensureScopedDataRootMigrated(app) {
  const userDataPath = app.getPath('userData');

  if (migratedScopedRootPaths.has(userDataPath)) {
    return;
  }

  const legacyScopedRootPath = path.join(userDataPath, SCOPED_DATA_ROOT_SEGMENT);
  const nextScopedRootPath = path.join(
    userDataPath,
    APP_DATA_ROOT_SEGMENT,
    SCOPED_DATA_ROOT_SEGMENT
  );

  try {
    if (
      fs.existsSync(legacyScopedRootPath)
      && !fs.existsSync(nextScopedRootPath)
    ) {
      fs.mkdirSync(path.dirname(nextScopedRootPath), { recursive: true });
      fs.renameSync(legacyScopedRootPath, nextScopedRootPath);
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

  return path.join(
    getAppDataRoot(app),
    SCOPED_DATA_ROOT_SEGMENT
  );
}

module.exports = {
  APP_DATA_ROOT_SEGMENT,
  SCOPED_DATA_ROOT_SEGMENT,
  getAppDataRoot,
  getScopedDataRoot
};
