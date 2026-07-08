const fs = require('node:fs');
const path = require('node:path');

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function buildDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function resolveRetentionCutoffDayKey(keepDayCount) {
  const normalizedKeepDayCount = Math.max(1, Number.parseInt(keepDayCount, 10) || 1);
  const cutoffDate = new Date();

  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - normalizedKeepDayCount + 1);

  return buildDayKey(cutoffDate);
}

async function ensureDatedLogDirectory(rootDirectoryPath, dayKey = buildDayKey()) {
  const normalizedRootDirectoryPath = normalizeText(rootDirectoryPath);
  const normalizedDayKey = normalizeText(dayKey) || buildDayKey();
  const directoryPath = normalizedDayKey
    ? path.join(normalizedRootDirectoryPath, normalizedDayKey)
    : normalizedRootDirectoryPath;

  await fs.promises.mkdir(directoryPath, { recursive: true });

  return {
    dayKey: normalizedDayKey,
    directoryPath
  };
}

async function cleanupExpiredDatedLogDirectories(rootDirectoryPath, keepDayCount) {
  const normalizedRootDirectoryPath = normalizeText(rootDirectoryPath);
  const normalizedKeepDayCount = Math.max(1, Number.parseInt(keepDayCount, 10) || 1);
  const cutoffDayKey = resolveRetentionCutoffDayKey(normalizedKeepDayCount);
  const removedDirectoryPaths = [];

  await fs.promises.mkdir(normalizedRootDirectoryPath, { recursive: true });

  const entries = await fs.promises.readdir(normalizedRootDirectoryPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (!entry || entry.isDirectory() !== true || !DAY_KEY_PATTERN.test(entry.name)) {
      continue;
    }

    if (entry.name >= cutoffDayKey) {
      continue;
    }

    const directoryPath = path.join(normalizedRootDirectoryPath, entry.name);
    await fs.promises.rm(directoryPath, {
      recursive: true,
      force: true
    });
    removedDirectoryPaths.push(directoryPath);
  }

  return removedDirectoryPaths;
}

module.exports = {
  buildDayKey,
  ensureDatedLogDirectory,
  cleanupExpiredDatedLogDirectories
};
