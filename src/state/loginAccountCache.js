const fs = require('node:fs');
const path = require('node:path');
const { getAppDataRoot } = require('../utils/persistenceRoots');

function createLoginAccountCache({ app, safeStorage }) {
  function getCacheFilePath() {
    return path.join(
      getAppDataRoot(app),
      'local_state',
      'auth',
      'login-account.json'
    );
  }

  async function readCacheFile() {
    const cacheFilePath = getCacheFilePath();

    try {
      const rawText = await fs.promises.readFile(cacheFilePath, 'utf8');
      return JSON.parse(rawText);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }

      return null;
    }
  }

  async function writeCacheFile(payload) {
    const cacheFilePath = getCacheFilePath();

    await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.promises.writeFile(cacheFilePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  async function removeCacheFile() {
    const cacheFilePath = getCacheFilePath();

    try {
      await fs.promises.unlink(cacheFilePath);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async function removeInvalidCacheFile() {
    try {
      await removeCacheFile();
    } catch (_error) {}
  }

  function canUseSafeStorage() {
    return Boolean(
      safeStorage &&
        typeof safeStorage.isEncryptionAvailable === 'function' &&
        typeof safeStorage.encryptString === 'function' &&
        typeof safeStorage.decryptString === 'function' &&
        safeStorage.isEncryptionAvailable()
    );
  }

  function encodeSecret(value) {
    const normalizedValue = typeof value === 'string' ? value : '';

    if (canUseSafeStorage()) {
      return {
        mode: 'safeStorage',
        value: safeStorage.encryptString(normalizedValue).toString('base64')
      };
    }

    return {
      mode: 'plain',
      value: normalizedValue
    };
  }

  function decodeSecret(record) {
    if (!record || typeof record !== 'object') {
      return {
        value: '',
        invalid: false
      };
    }

    if (record.mode === 'safeStorage') {
      if (typeof record.value !== 'string' || !record.value || !canUseSafeStorage()) {
        return {
          value: '',
          invalid: true
        };
      }

      try {
        return {
          value: safeStorage.decryptString(Buffer.from(record.value, 'base64')),
          invalid: false
        };
      } catch (_error) {
        return {
          value: '',
          invalid: true
        };
      }
    }

    if (typeof record.value === 'string') {
      return {
        value: record.value,
        invalid: false
      };
    }

    return {
      value: '',
      invalid: false
    };
  }

  return {
    async getCachedAccount() {
      const cache = await readCacheFile();

      if (!cache) {
        return null;
      }

      if (cache.rememberLogin === true) {
        const usernameRecord = decodeSecret(cache.username);
        const passwordRecord = decodeSecret(cache.password);

        if (usernameRecord.invalid || passwordRecord.invalid || !usernameRecord.value.trim()) {
          await removeInvalidCacheFile();
          return null;
        }

        return {
          rememberLogin: true,
          username: usernameRecord.value.trim(),
          password: passwordRecord.value,
          updatedAt: cache.updatedAt || null
        };
      }

      if (typeof cache.username !== 'string' || !cache.username.trim()) {
        return null;
      }

      return {
        rememberLogin: false,
        username: cache.username.trim(),
        password: '',
        updatedAt: cache.updatedAt || null
      };
    },
    async setCachedAccount({ username, password, rememberLogin }) {
      if (!rememberLogin) {
        await removeCacheFile();
        return;
      }

      if (typeof username !== 'string' || !username.trim()) {
        await removeCacheFile();
        return;
      }

      await writeCacheFile({
        version: 2,
        rememberLogin: true,
        username: encodeSecret(username.trim()),
        password: encodeSecret(typeof password === 'string' ? password : ''),
        updatedAt: new Date().toISOString()
      });
    },
    async clearCachedAccount() {
      await removeCacheFile();
    }
  };
}

module.exports = {
  createLoginAccountCache
};
