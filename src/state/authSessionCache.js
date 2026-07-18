const fs = require('node:fs');
const path = require('node:path');
const { getAppDataRoot } = require('../utils/persistenceRoots');

const SESSION_CACHE_VERSION = 1;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSession(source) {
  const record = source && typeof source === 'object' ? source : {};
  const username = normalizeText(record.username);

  if (!username) {
    return null;
  }

  return {
    userId: normalizeText(record.userId),
    username,
    loggedInAt: normalizeText(record.loggedInAt) || new Date().toISOString()
  };
}

function createAuthSessionCache({ app }) {
  function getCacheFilePath() {
    return path.join(
      getAppDataRoot(app),
      'local_state',
      'auth',
      'session.json'
    );
  }

  async function readCacheFile() {
    try {
      const rawText = await fs.promises.readFile(getCacheFilePath(), 'utf8');
      return JSON.parse(rawText);
    } catch (_error) {
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
    try {
      await fs.promises.unlink(getCacheFilePath());
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return {
    async getCachedSession() {
      const cache = await readCacheFile();

      if (!cache || cache.rememberLogin !== true) {
        return null;
      }

      return normalizeSession(cache.session);
    },
    async setCachedSession(session, options = {}) {
      if (!options || options.rememberLogin !== true) {
        await removeCacheFile();
        return;
      }

      const normalizedSession = normalizeSession(session);

      if (!normalizedSession) {
        await removeCacheFile();
        return;
      }

      await writeCacheFile({
        version: SESSION_CACHE_VERSION,
        rememberLogin: true,
        session: normalizedSession,
        updatedAt: new Date().toISOString()
      });
    },
    async clearCachedSession() {
      await removeCacheFile();
    }
  };
}

module.exports = {
  createAuthSessionCache
};
