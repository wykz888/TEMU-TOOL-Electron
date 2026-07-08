const fs = require('node:fs');
const path = require('node:path');
const { getAppDataRoot } = require('../../utils/persistenceRoots');

function createShopLocalStore({ app }) {
  function getRootDir() {
    return path.join(
      getAppDataRoot(app),
      'local_state',
      'shop_management',
      'users'
    );
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
