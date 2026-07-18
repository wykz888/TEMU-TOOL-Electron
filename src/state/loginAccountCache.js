const fs = require('node:fs');
const path = require('node:path');
const { getAppDataRoot } = require('../utils/persistenceRoots');

const CACHE_VERSION = 3;
const SAFE_STORAGE_MODE = 'safeStorage';
const PLAIN_MODE = 'plain';

function normalizeText(value) {
  return String(value || '').trim();
}

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
    const tempFilePath = `${cacheFilePath}.${process.pid}.${Date.now().toString(36)}.tmp`;

    await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.promises.writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempFilePath, cacheFilePath);
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
        mode: SAFE_STORAGE_MODE,
        value: safeStorage.encryptString(normalizedValue).toString('base64')
      };
    }

    return {
      mode: PLAIN_MODE,
      value: normalizedValue
    };
  }

  function decodeSecret(record) {
    if (typeof record === 'string') {
      return {
        value: record,
        invalid: false,
        unavailable: false
      };
    }

    if (!record || typeof record !== 'object') {
      return {
        value: '',
        invalid: false,
        unavailable: false
      };
    }

    if (record.mode === SAFE_STORAGE_MODE) {
      if (typeof record.value !== 'string' || !record.value) {
        return {
          value: '',
          invalid: true,
          unavailable: false
        };
      }

      if (!canUseSafeStorage()) {
        return {
          value: '',
          invalid: false,
          unavailable: true
        };
      }

      try {
        return {
          value: safeStorage.decryptString(Buffer.from(record.value, 'base64')),
          invalid: false,
          unavailable: false
        };
      } catch (_error) {
        return {
          value: '',
          invalid: true,
          unavailable: false
        };
      }
    }

    if (typeof record.value === 'string') {
      return {
        value: record.value,
        invalid: false,
        unavailable: false
      };
    }

    return {
      value: '',
      invalid: false,
      unavailable: false
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
        const username = normalizeText(usernameRecord.value) || normalizeText(cache.displayUsername);
        const passwordUnavailable = passwordRecord.invalid || passwordRecord.unavailable;

        if (!username) {
          return null;
        }

        if (
          !usernameRecord.invalid
          && !usernameRecord.unavailable
          && !passwordRecord.invalid
          && !passwordRecord.unavailable
          && (cache.version !== CACHE_VERSION || normalizeText(cache.displayUsername) !== username)
        ) {
          await writeCacheFile({
            ...cache,
            version: CACHE_VERSION,
            displayUsername: username,
            updatedAt: cache.updatedAt || new Date().toISOString()
          }).catch(() => {});
        }

        return {
          rememberLogin: true,
          username,
          password: passwordUnavailable ? '' : passwordRecord.value,
          credentialUnavailable: Boolean(
            usernameRecord.invalid
            || usernameRecord.unavailable
            || passwordRecord.invalid
            || passwordRecord.unavailable
          ),
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
        version: CACHE_VERSION,
        rememberLogin: true,
        displayUsername: username.trim(),
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
