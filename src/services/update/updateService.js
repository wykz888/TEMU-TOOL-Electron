const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const { UPDATE_CHANNELS } = require('../../ipc/updateChannels');
const { getAppDataRoot } = require('../../utils/persistenceRoots');
const {
  APP_UPDATE_FEED_URL,
  APP_UPDATE_RELEASE_HISTORY_URL
} = require('./updateConfig');

const UPDATE_PREFS_FILE_NAME = 'update-preferences.json';
const RELEASE_HISTORY_CACHE_MS = 5 * 60 * 1000;

function createAppUpdateService({
  app,
  getUpdateSettings,
  runtimeLogger
}) {
  let initialized = false;
  let checking = false;
  let latestStatus = createStatus('idle');
  let lastCheckWasManual = false;
  let startupCheckScheduled = false;
  let releaseHistoryCache = null;

  function log(eventName, payload = {}) {
    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log(eventName, payload);
    }
  }

  function logError(eventName, error) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error);
      return;
    }

    log(eventName, {
      message: error && error.message ? error.message : String(error || '')
    });
  }

  function initialize() {
    if (initialized) {
      return;
    }

    initialized = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: APP_UPDATE_FEED_URL
    });

    autoUpdater.on('checking-for-update', () => {
      updateStatus(createStatus('checking', {
        manual: lastCheckWasManual,
        message: '\u6b63\u5728\u68c0\u67e5\u66f4\u65b0'
      }));
    });

    autoUpdater.on('update-available', (info) => {
      const availableVersion = normalizeText(info && info.version);

      if (
        !lastCheckWasManual
        && availableVersion
        && readUpdatePreferences().skippedVersion === availableVersion
      ) {
        updateStatus(createStatus('idle'));
        return;
      }

      updateStatus(createStatus('available', {
        availableVersion,
        releaseDate: normalizeText(info && info.releaseDate),
        releaseName: normalizeText(info && info.releaseName),
        releaseHistory: latestStatus.releaseHistory,
        releaseNotes: releaseNotesToText(info && info.releaseNotes),
        manual: lastCheckWasManual,
        message: '\u53d1\u73b0\u65b0\u7248\u672c'
      }));
      void enrichStatusWithReleaseHistory(availableVersion);
    });

    autoUpdater.on('update-not-available', () => {
      updateStatus(createStatus('not-available', {
        releaseHistory: latestStatus.releaseHistory,
        manual: lastCheckWasManual,
        message: '\u5df2\u662f\u6700\u65b0\u7248\u672c'
      }));
      void enrichStatusWithReleaseHistory();
    });

    autoUpdater.on('download-progress', (progress) => {
      updateStatus({
        ...latestStatus,
        phase: 'downloading',
        progress: normalizeProgress(progress),
        message: '\u6b63\u5728\u4e0b\u8f7d\u66f4\u65b0'
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      updateStatus(createStatus('downloaded', {
        availableVersion: normalizeText(info && info.version) || latestStatus.availableVersion || '',
        releaseDate: normalizeText(info && info.releaseDate) || latestStatus.releaseDate,
        releaseName: normalizeText(info && info.releaseName) || latestStatus.releaseName,
        releaseHistory: latestStatus.releaseHistory,
        releaseNotes: releaseNotesToText(info && info.releaseNotes) || latestStatus.releaseNotes,
        manual: latestStatus.manual,
        message: '\u66f4\u65b0\u5df2\u4e0b\u8f7d'
      }));
    });

    autoUpdater.on('error', (error) => {
      logError('app_update_error', error);
      updateStatus(createStatus('error', {
        manual: lastCheckWasManual || latestStatus.manual,
        message: toUserUpdateError(error)
      }));
    });
  }

  function scheduleStartupUpdateCheck() {
    if (startupCheckScheduled || !app.isPackaged) {
      return;
    }

    startupCheckScheduled = true;
    setTimeout(async () => {
      try {
        const settings = await readUpdateSettings();

        if (!settings.autoCheck) {
          return;
        }

        await checkForUpdates({
          manual: false
        });
      } catch (error) {
        startupCheckScheduled = false;
        logError('app_update_startup_check_skipped', error);
      }
    }, 1800);
  }

  async function checkForUpdates(payload = {}) {
    initialize();
    lastCheckWasManual = payload && payload.manual === true;
    await applyUpdateSettings();

    if (!app.isPackaged) {
      latestStatus = createStatus('not-available', {
        manual: lastCheckWasManual,
        message: '\u5f53\u524d\u4e3a\u5f00\u53d1\u7248\uff0c\u6253\u5305\u540e\u53ef\u4f7f\u7528\u5728\u7ebf\u66f4\u65b0'
      });
      broadcastStatus();
      return latestStatus;
    }

    if (checking || latestStatus.phase === 'downloading') {
      return latestStatus;
    }

    checking = true;

    try {
      await autoUpdater.checkForUpdates();
    } finally {
      checking = false;
    }

    return latestStatus;
  }

  async function downloadUpdate() {
    initialize();
    await applyUpdateSettings();

    if (!app.isPackaged) {
      latestStatus = createStatus('error', {
        manual: true,
        message: '\u5f00\u53d1\u7248\u4e0d\u652f\u6301\u4e0b\u8f7d\u66f4\u65b0'
      });
      broadcastStatus();
      return latestStatus;
    }

    if (latestStatus.phase !== 'available') {
      return latestStatus;
    }

    updateStatus({
      ...latestStatus,
      phase: 'downloading',
      progress: normalizeProgress(),
      message: '\u6b63\u5728\u4e0b\u8f7d\u66f4\u65b0'
    });

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logError('app_update_download_failed', error);
      updateStatus(createStatus('error', {
        manual: latestStatus.manual,
        message: toUserUpdateError(error)
      }));
    }

    return latestStatus;
  }

  function installUpdate() {
    initialize();

    if (latestStatus.phase !== 'downloaded') {
      return latestStatus;
    }

    autoUpdater.quitAndInstall(false, true);
    return latestStatus;
  }

  function skipUpdate(payload = {}) {
    const version = normalizeText(payload && payload.version) || latestStatus.availableVersion || '';

    if (version) {
      writeUpdatePreferences({
        skippedVersion: version
      });
    }

    latestStatus = createStatus('idle');
    broadcastStatus();
    return latestStatus;
  }

  function getStatus() {
    return latestStatus;
  }

  async function applyUpdateSettings() {
    const settings = await readUpdateSettings();

    autoUpdater.channel = settings.channel === 'beta' ? 'beta' : null;
    autoUpdater.allowDowngrade = false;
    autoUpdater.disableDifferentialDownload = !settings.differential;
  }

  async function readUpdateSettings() {
    const fallback = {
      autoCheck: true,
      channel: 'latest',
      differential: true
    };

    if (typeof getUpdateSettings !== 'function') {
      return fallback;
    }

    try {
      const settings = await getUpdateSettings();

      return {
        autoCheck: settings && settings.autoCheck !== false,
        channel: settings && settings.channel === 'beta' ? 'beta' : 'latest',
        differential: !(settings && settings.differential === false)
      };
    } catch (error) {
      if (lastCheckWasManual) {
        throw error;
      }

      return fallback;
    }
  }

  function createStatus(phase, patch = {}) {
    return {
      phase,
      currentVersion: app.getVersion(),
      ...patch
    };
  }

  function updateStatus(status) {
    latestStatus = status;
    broadcastStatus();
  }

  function broadcastStatus() {
    BrowserWindow.getAllWindows().forEach((windowItem) => {
      if (windowItem && windowItem.webContents && !windowItem.webContents.isDestroyed()) {
        windowItem.webContents.send(UPDATE_CHANNELS.STATUS, latestStatus);
      }
    });
  }

  async function enrichStatusWithReleaseHistory(targetVersion) {
    const releaseHistory = await fetchReleaseHistory();

    if (!releaseHistory.length) {
      return;
    }

    if (targetVersion && latestStatus.availableVersion && latestStatus.availableVersion !== targetVersion) {
      return;
    }

    const version = targetVersion || latestStatus.availableVersion || latestStatus.currentVersion;

    updateStatus({
      ...latestStatus,
      releaseHistory,
      releaseNotes: latestStatus.releaseNotes || releaseNotesForVersion(releaseHistory, version)
    });
  }

  async function fetchReleaseHistory() {
    if (releaseHistoryCache && Date.now() - releaseHistoryCache.loadedAt < RELEASE_HISTORY_CACHE_MS) {
      return releaseHistoryCache.items;
    }

    try {
      const response = await fetch(APP_UPDATE_RELEASE_HISTORY_URL, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      const items = normalizeReleaseHistory(await response.json());
      releaseHistoryCache = {
        items,
        loadedAt: Date.now()
      };
      return items;
    } catch (error) {
      logError('app_update_release_history_failed', error);
      return releaseHistoryCache ? releaseHistoryCache.items : [];
    }
  }

  function getUpdatePreferencesPath() {
    return path.join(
      getAppDataRoot(app),
      'local_state',
      'update',
      UPDATE_PREFS_FILE_NAME
    );
  }

  function readUpdatePreferences() {
    const filePath = getUpdatePreferencesPath();

    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
      return {};
    }
  }

  function writeUpdatePreferences(preferences) {
    try {
      const filePath = getUpdatePreferencesPath();
      fs.mkdirSync(path.dirname(filePath), {
        recursive: true
      });
      fs.writeFileSync(filePath, JSON.stringify(preferences, null, 2), 'utf8');
    } catch (error) {
      logError('app_update_preferences_write_failed', error);
    }
  }

  return {
    initialize,
    scheduleStartupUpdateCheck,
    getStatus,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    skipUpdate
  };
}

function normalizeProgress(progress = {}) {
  return {
    percent: normalizeNumber(progress.percent),
    transferred: normalizeNumber(progress.transferred),
    total: normalizeNumber(progress.total),
    bytesPerSecond: normalizeNumber(progress.bytesPerSecond)
  };
}

function normalizeNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function releaseNotesToText(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }

      return typeof item.note === 'string' ? item.note.trim() : '';
    })
    .filter(Boolean)
    .join('\n');
}

function normalizeReleaseHistory(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const items = Array.isArray(payload.items) ? payload.items : [];

  return items
    .map((item) => normalizeReleaseHistoryItem(item))
    .filter(Boolean);
}

function normalizeReleaseHistoryItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const version = normalizeText(item.version);

  if (!version) {
    return null;
  }

  return {
    version,
    releaseDate: normalizeText(item.releaseDate),
    title: normalizeText(item.title),
    notes: normalizeNotes(item.notes)
  };
}

function normalizeNotes(value) {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function releaseNotesForVersion(history, version) {
  const item = history.find((candidate) => candidate.version === version);

  if (!item) {
    return '';
  }

  return [
    item.title,
    ...item.notes.map((note) => `\u2022 ${note}`)
  ]
    .filter(Boolean)
    .join('\n');
}

function toUserUpdateError(error) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/net::|ENOTFOUND|ECONN|ETIMEDOUT|timeout/i.test(message)) {
    return '\u66f4\u65b0\u670d\u52a1\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5';
  }

  if (/latest\.yml|404|NoSuchKey/i.test(message)) {
    return '\u6682\u672a\u627e\u5230\u53ef\u7528\u66f4\u65b0';
  }

  return '\u68c0\u67e5\u66f4\u65b0\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5';
}

module.exports = {
  createAppUpdateService
};
