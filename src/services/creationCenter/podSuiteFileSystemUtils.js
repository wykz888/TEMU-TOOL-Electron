const fs = require('node:fs');
const path = require('node:path');
const {
  IMAGE_EXTENSIONS,
  IMAGE_EXTENSION_SET
} = require('./podSuiteImageExtensions');
const {
  normalizeText
} = require('./podSuitePsdRuntimeRules');

async function assertDirectory(directoryPath, message) {
  const stat = await fs.promises.stat(directoryPath).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(message);
  }
}

async function assertFile(filePath, message) {
  const stat = await fs.promises.stat(filePath).catch(() => null);

  if (!stat || !stat.isFile()) {
    throw new Error(message);
  }
}

function sortImageFiles(files) {
  return files.sort((left, right) => {
    return String(left.relativePath || '').localeCompare(String(right.relativePath || ''), 'zh-CN', {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

async function collectImageFileEntries(directoryPath, currentPath, result) {
  const entries = await fs.promises.readdir(currentPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await collectImageFileEntries(directoryPath, absolutePath, result);
      continue;
    }

    if (!entry.isFile() || !IMAGE_EXTENSION_SET.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const relativePath = path.relative(directoryPath, absolutePath).split(path.sep).join('/');
    result.push({
      filePath: absolutePath,
      relativePath,
      fileName: entry.name
    });
  }

  return result;
}

async function collectImageFiles(directoryPath) {
  const result = [];
  await collectImageFileEntries(directoryPath, directoryPath, result);

  return sortImageFiles(result);
}

async function pathExists(targetPath) {
  if (!normalizeText(targetPath)) {
    return false;
  }

  return Boolean(await fs.promises.stat(targetPath).catch(() => null));
}

module.exports = {
  IMAGE_EXTENSIONS,
  assertDirectory,
  assertFile,
  collectImageFiles,
  pathExists
};
