const fs = require('node:fs');
const path = require('node:path');
const {
  getAppDataRoot,
  mergeLegacyDirectoryContents
} = require('../../utils/persistenceRoots');

const STORE_ROOT_SEGMENT = 'shop_management';
const LEGACY_STORE_ROOT_SEGMENTS = Object.freeze(['local_state', STORE_ROOT_SEGMENT]);

function createShopLocalStore({ app }) {
  let migrationChecked = false;

  function getNextRootDir() {
    return path.join(
      getAppDataRoot(app),
      STORE_ROOT_SEGMENT,
      'users'
    );
  }

  function getLegacyRootDir() {
    return path.join(
      getAppDataRoot(app),
      ...LEGACY_STORE_ROOT_SEGMENTS,
      'users'
    );
  }

  function ensureRootMigrated() {
    if (migrationChecked) {
      return;
    }

    migrationChecked = true;

    try {
      mergeLegacyDirectoryContents(getLegacyRootDir(), getNextRootDir());
    } catch (_error) {
      // Keep reading and writing the new cloud-aligned local path.
    }
  }

  function getRootDir() {
    ensureRootMigrated();

    return getNextRootDir();
  }

  function getOwnerDir(owner) {
    return path.join(getRootDir(), owner.userKey);
  }

  function getIndexFilePath(owner) {
    return path.join(getOwnerDir(owner), 'index.json');
  }

  function resolveRecordPath(owner, recordKey) {
    return path.join(getOwnerDir(owner), ...String(recordKey || '').split('/'));
  }

  async function readJsonFile(filePath) {
    try {
      const rawText = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, filePath);
  }

  return {
    readIndex(owner) {
      return readJsonFile(getIndexFilePath(owner));
    },
    readShopRecord(owner, recordKey) {
      return readJsonFile(resolveRecordPath(owner, recordKey));
    },
    saveIndex(owner, payload) {
      return writeJsonFile(getIndexFilePath(owner), payload);
    },
    saveShopRecord(owner, recordKey, payload) {
      return writeJsonFile(resolveRecordPath(owner, recordKey), payload);
    }
  };
}

module.exports = {
  createShopLocalStore
};
