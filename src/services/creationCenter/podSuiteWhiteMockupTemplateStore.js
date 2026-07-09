const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { TABLECLOTH_FLAT_TEMPLATE, normalizeWhiteMockupTemplate } = require('./whiteMockupTemplateRenderer');
const {
  buildOwnerDescriptor
} = require('../shopManagement/common');

const ENTRY_ID = 'pod-suite-tool';
const TEMPLATE_FILE_NAME = 'white-mockup-templates.json';

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function getIsoTimestamp() {
  return new Date().toISOString();
}

function createTemplateKey(mockupPath) {
  const normalizedPath = path.resolve(normalizeText(mockupPath)).toLowerCase();
  return crypto
    .createHash('sha1')
    .update(normalizedPath)
    .digest('hex');
}

function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template));
}

function createDefaultTemplate(mockupPath) {
  const now = getIsoTimestamp();
  const template = cloneTemplate(TABLECLOTH_FLAT_TEMPLATE);

  return {
    ...template,
    key: createTemplateKey(mockupPath),
    mockupPath: path.resolve(normalizeText(mockupPath)),
    createdAt: now,
    updatedAt: now
  };
}

function createPodSuiteWhiteMockupTemplateStore({
  sessionStore,
  creationCenterProfileService
} = {}) {
  function getOwner() {
    if (!sessionStore || typeof sessionStore.getSession !== 'function') {
      return null;
    }

    try {
      return buildOwnerDescriptor(sessionStore.getSession());
    } catch (_error) {
      return null;
    }
  }

  function resolveOwnerKey(owner) {
    return owner && owner.userKey ? owner.userKey : 'local';
  }

  function getTemplateFilePath(owner) {
    const entry = creationCenterProfileService
      && typeof creationCenterProfileService.getEntryById === 'function'
      ? creationCenterProfileService.getEntryById(ENTRY_ID)
      : null;
    const localRootDir = entry && entry.storageProfile && entry.storageProfile.localRootDir;

    if (!localRootDir) {
      throw new Error('\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
    }

    return path.join(
      localRootDir,
      'users',
      resolveOwnerKey(owner),
      'state',
      TEMPLATE_FILE_NAME
    );
  }

  function getLegacyTemplateFilePath() {
    const entry = creationCenterProfileService
      && typeof creationCenterProfileService.getEntryById === 'function'
      ? creationCenterProfileService.getEntryById(ENTRY_ID)
      : null;
    const stateDir = entry && entry.storageProfile && entry.storageProfile.localStateDir;

    if (!stateDir) {
      throw new Error('\u767d\u819c\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
    }

    return path.join(stateDir, TEMPLATE_FILE_NAME);
  }

  async function ensureLocalTemplateFilePathMigrated(owner) {
    const nextFilePath = getTemplateFilePath(owner);
    const legacyFilePath = getLegacyTemplateFilePath();

    try {
      await fs.promises.access(nextFilePath, fs.constants.F_OK);
      return nextFilePath;
    } catch (_error) {
      // continue with legacy migration check
    }

    try {
      await fs.promises.access(legacyFilePath, fs.constants.F_OK);
    } catch (_error) {
      return nextFilePath;
    }

    const legacyText = await fs.promises.readFile(legacyFilePath, 'utf8').catch(() => '');

    if (legacyText.trim()) {
      await fs.promises.mkdir(path.dirname(nextFilePath), {
        recursive: true
      });
      await fs.promises.writeFile(nextFilePath, legacyText, 'utf8');
    }

    return nextFilePath;
  }

  async function readStore(owner) {
    const filePath = await ensureLocalTemplateFilePathMigrated(owner);
    const text = await fs.promises.readFile(filePath, 'utf8').catch((error) => {
      if (error && error.code === 'ENOENT') {
        return '';
      }

      throw error;
    });

    if (!text.trim()) {
      return {
        version: 1,
        templates: {}
      };
    }

    const parsed = JSON.parse(text);

    return {
      version: 1,
      templates: parsed && parsed.templates && typeof parsed.templates === 'object'
        ? parsed.templates
        : {}
    };
  }

  async function writeStore(owner, store) {
    const filePath = getTemplateFilePath(owner);
    await fs.promises.mkdir(path.dirname(filePath), {
      recursive: true
    });
    await fs.promises.writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }

  async function getTemplate(payload = {}) {
    const owner = getOwner();
    const mockupPath = normalizeText(payload.mockupPath);

    if (!mockupPath) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u767d\u819c\u56fe\u7247\u3002');
    }

    const key = createTemplateKey(mockupPath);
    const store = await readStore(owner);
    const savedTemplate = store.templates[key];
    const template = savedTemplate
      ? normalizeWhiteMockupTemplate(savedTemplate)
      : createDefaultTemplate(mockupPath);

    return {
      success: true,
      updatedAt: getIsoTimestamp(),
      template: {
        ...template,
        key,
        mockupPath: path.resolve(mockupPath)
      },
      isDefault: !savedTemplate
    };
  }

  async function saveTemplate(payload = {}) {
    const owner = getOwner();
    const mockupPath = normalizeText(payload.mockupPath);

    if (!mockupPath) {
      throw new Error('\u8bf7\u5148\u9009\u62e9\u767d\u819c\u56fe\u7247\u3002');
    }

    const key = createTemplateKey(mockupPath);
    const store = await readStore(owner);
    const previous = store.templates[key] || {};
    const now = getIsoTimestamp();
    const template = normalizeWhiteMockupTemplate({
      ...previous,
      ...(payload.template && typeof payload.template === 'object' ? payload.template : {}),
      key,
      mockupPath: path.resolve(mockupPath),
      createdAt: previous.createdAt || now,
      updatedAt: now
    });

    store.templates[key] = template;
    await writeStore(owner, store);

    return {
      success: true,
      updatedAt: now,
      template
    };
  }

  return {
    getTemplate,
    saveTemplate
  };
}

module.exports = {
  createPodSuiteWhiteMockupTemplateStore
};
