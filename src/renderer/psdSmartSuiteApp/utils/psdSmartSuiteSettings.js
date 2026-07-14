import { SETTINGS_STORAGE_KEY } from '../constants.js';
import { clampConcurrency } from './psdSmartSuiteModels.js';

function normalizeSettingsStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

export function readPsdSmartSuiteSettings(storage) {
  const nextStorage = normalizeSettingsStorage(storage);

  if (!nextStorage) {
    return null;
  }

  try {
    const raw = nextStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const settings = {};

    if (parsed.psdEngineConcurrency != null) {
      settings.psdEngineConcurrency = clampConcurrency(parsed.psdEngineConcurrency);
    }

    if (parsed.psdEngineWindowMode) {
      settings.psdEngineWindowMode = parsed.psdEngineWindowMode === 'visible'
        ? 'visible'
        : 'hidden';
    }

    if (parsed.psdSkipExistingOutputs != null) {
      settings.psdSkipExistingOutputs = !!parsed.psdSkipExistingOutputs;
    }

    return settings;
  } catch (_) {
    return null;
  }
}

export function writePsdSmartSuiteSettings(storage, settings) {
  const nextStorage = normalizeSettingsStorage(storage);

  if (!nextStorage || !settings || typeof settings !== 'object') {
    return false;
  }

  try {
    nextStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      psdEngineConcurrency: settings.psdEngineConcurrency,
      psdEngineWindowMode: settings.psdEngineWindowMode,
      psdSkipExistingOutputs: settings.psdSkipExistingOutputs
    }));
    return true;
  } catch (_) {
    return false;
  }
}
