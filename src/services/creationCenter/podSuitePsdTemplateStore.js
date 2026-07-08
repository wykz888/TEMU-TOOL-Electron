const fs = require('node:fs');
const path = require('node:path');
const { cosService, COS_SCOPES } = require('../cos');
const {
  buildOwnerDescriptor,
  createEntityId
} = require('../shopManagement/common');

const ENTRY_ID = 'pod-suite-tool';
const PROFILE_FILE_NAME = 'psd-smart-object-templates.json';
const MAX_TEMPLATE_COUNT = 60;

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function getIsoTimestamp() {
  return new Date().toISOString();
}

function normalizeReplacementMode(value) {
  const mode = normalizeText(value);
  return ['cover-canvas', 'contain-canvas', 'layer-bounds-transform'].includes(mode)
    ? mode
    : 'cover-canvas';
}

function normalizeSourceRotation(value) {
  const mode = normalizeText(value);
  return ['left', 'right'].includes(mode) ? mode : 'none';
}

function normalizeExportMode(value) {
  const mode = normalizeText(value);
  return ['original', 'guides', 'slices'].includes(mode) ? mode : 'original';
}

function normalizeOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(format) ? format : 'png';
}

function normalizeImageQuality(value) {
  const quality = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, quality));
}

function normalizeEngineConcurrency(value) {
  const count = Math.round(Number(value) || 2);
  return Math.max(1, Math.min(6, count));
}

function normalizeMockupConfig(value, index = 0, defaults = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const hasOutputDirectoryPath = Object.prototype.hasOwnProperty.call(source, 'outputDirectoryPath');
  const hasExportMode = Object.prototype.hasOwnProperty.call(source, 'exportMode') || Object.prototype.hasOwnProperty.call(source, 'sliceMode');
  const hasOutputFormat = Object.prototype.hasOwnProperty.call(source, 'outputFormat');
  const hasImageQuality = Object.prototype.hasOwnProperty.call(source, 'imageQuality');

  return {
    id: normalizeText(source.id) || createEntityId('psd_mockup'),
    psdPath: normalizeText(source.psdPath),
    smartObjectName: normalizeText(source.smartObjectName) || '\u63d2\u56fe#',
    sourceRotation: normalizeSourceRotation(source.sourceRotation),
    replacementMode: normalizeReplacementMode(source.replacementMode),
    outputSubdirName: normalizeText(source.outputSubdirName) || `PSD\u5957\u56fe${index > 0 ? index + 1 : ''}`,
    outputDirectoryPath: hasOutputDirectoryPath
      ? normalizeText(source.outputDirectoryPath)
      : normalizeText(fallback.outputDirectoryPath),
    exportMode: hasExportMode
      ? normalizeExportMode(source.exportMode || source.sliceMode)
      : normalizeExportMode(fallback.exportMode || fallback.sliceMode),
    outputFormat: hasOutputFormat
      ? normalizeOutputFormat(source.outputFormat)
      : normalizeOutputFormat(fallback.outputFormat),
    imageQuality: hasImageQuality
      ? normalizeImageQuality(source.imageQuality)
      : normalizeImageQuality(fallback.imageQuality)
  };
}

function normalizeMockups(value, defaults = {}) {
  const sourceList = Array.isArray(value) ? value : [];
  const normalizedList = sourceList
    .map((item, index) => normalizeMockupConfig(item, index, defaults))
    .filter((item) => item.psdPath || item.smartObjectName || item.outputSubdirName || item.outputDirectoryPath);

  return normalizedList.length ? normalizedList : [normalizeMockupConfig({}, 0, defaults)];
}

function normalizeTemplate(value) {
  const source = value && typeof value === 'object' ? value : {};
  const now = getIsoTimestamp();
  const outputDirectoryPath = normalizeText(source.outputDirectoryPath);
  const exportMode = normalizeExportMode(source.exportMode);
  const outputFormat = normalizeOutputFormat(source.outputFormat);
  const imageQuality = normalizeImageQuality(source.imageQuality);

  return {
    id: normalizeText(source.id) || createEntityId('psd_template'),
    name: normalizeText(source.name) || 'PSD\u667a\u80fd\u5957\u56fe\u6a21\u677f',
    imageDirectoryPath: normalizeText(source.imageDirectoryPath),
    outputDirectoryPath,
    exportMode,
    outputFormat,
    imageQuality,
    engineConcurrency: normalizeEngineConcurrency(source.engineConcurrency || source.psdEngineConcurrency),
    skipExistingOutputs: source.skipExistingOutputs === true || source.psdSkipExistingOutputs === true,
    metadataSourcePath: normalizeText(source.metadataSourcePath),
    metadataSourceDirectoryPath: normalizeText(source.metadataSourceDirectoryPath),
    mockups: normalizeMockups(source.mockups, {
      outputDirectoryPath,
      exportMode,
      outputFormat,
      imageQuality
    }),
    createdAt: normalizeText(source.createdAt) || now,
    updatedAt: normalizeText(source.updatedAt) || now
  };
}

function normalizeProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  const templates = Array.isArray(source.templates)
    ? source.templates.map((template) => normalizeTemplate(template))
    : [];

  return {
    version: 1,
    updatedAt: normalizeText(source.updatedAt),
    templates: templates
      .sort((left, right) => {
        const leftCreatedAt = normalizeText(left.createdAt) || normalizeText(left.updatedAt);
        const rightCreatedAt = normalizeText(right.createdAt) || normalizeText(right.updatedAt);
        const createdCompare = String(leftCreatedAt).localeCompare(String(rightCreatedAt));
        if (createdCompare !== 0) {
          return createdCompare;
        }

        return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN', {
          numeric: true,
          sensitivity: 'base'
        });
      })
      .slice(0, MAX_TEMPLATE_COUNT)
  };
}

function createPodSuitePsdTemplateStore({
  sessionStore,
  creationCenterProfileService,
  runtimeLogger
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

  function getFeatureEntry() {
    const entry = creationCenterProfileService
      && typeof creationCenterProfileService.getEntryById === 'function'
      ? creationCenterProfileService.getEntryById(ENTRY_ID)
      : null;

    if (!entry || !entry.storageProfile) {
      throw new Error('PSD\u5957\u56fe\u6a21\u677f\u5b58\u50a8\u672a\u5c31\u7eea\u3002');
    }

    return entry;
  }

  function getLocalProfileFilePath(owner) {
    const entry = getFeatureEntry();
    const ownerKey = owner && owner.userKey ? owner.userKey : 'local';

    return path.join(entry.storageProfile.localConfigDir, 'users', ownerKey, PROFILE_FILE_NAME);
  }

  function getCloudProfileKey(owner) {
    const entry = getFeatureEntry();

    return `${entry.storageKey}/users/${owner.userKey}/config/${PROFILE_FILE_NAME}`;
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
    await fs.promises.mkdir(path.dirname(filePath), {
      recursive: true
    });
    await fs.promises.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  function logError(eventName, error) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError(eventName, error);
    }
  }

  async function readCloudProfile(owner) {
    if (!owner) {
      return null;
    }

    const cloudKey = getCloudProfileKey(owner);
    try {
      const exists = await cosService.existsObject({
        scope: COS_SCOPES.ROOT,
        key: cloudKey
      });

      if (!exists) {
        return null;
      }

      const result = await cosService.getObjectJson({
        scope: COS_SCOPES.ROOT,
        key: cloudKey
      });

      return normalizeProfile(result && result.data);
    } catch (error) {
      logError('pod_suite_tool_psd_template_cloud_read_failed', error);
      return null;
    }
  }

  async function writeCloudProfile(owner, profile) {
    if (!owner) {
      return {
        cloudSynced: false,
        warning: '\u5f53\u524d\u672a\u767b\u5f55\uff0c\u6a21\u677f\u5df2\u4fdd\u5b58\u672c\u5730\u3002'
      };
    }

    try {
      await cosService.putJson({
        scope: COS_SCOPES.ROOT,
        key: getCloudProfileKey(owner),
        data: profile,
        metadata: {
          record_type: 'pod-suite-psd-templates',
          owner_user_key: owner.userKey,
          owner_username: owner.username,
          updated_at: normalizeText(profile && profile.updatedAt)
        }
      });

      return {
        cloudSynced: true,
        warning: ''
      };
    } catch (error) {
      logError('pod_suite_tool_psd_template_cloud_write_failed', error);

      return {
        cloudSynced: false,
        warning: normalizeText(error && error.message) || '\u4e91\u7aef\u540c\u6b65\u5931\u8d25'
      };
    }
  }

  async function getTemplates(payload = {}) {
    const owner = getOwner();
    const localFilePath = getLocalProfileFilePath(owner);
    let localProfile = normalizeProfile(await readJsonFile(localFilePath));
    let source = localProfile.templates.length ? 'local' : 'empty';

    if (payload && payload.preferCloud && owner) {
      const cloudProfile = await readCloudProfile(owner);
      if (cloudProfile && cloudProfile.templates.length) {
        localProfile = cloudProfile;
        await writeJsonFile(localFilePath, localProfile);
        source = 'cloud';
      }
    }

    return {
      success: true,
      updatedAt: getIsoTimestamp(),
      templates: localProfile.templates,
      source,
      cloudSynced: source === 'cloud',
      warning: owner ? '' : '\u5f53\u524d\u672a\u767b\u5f55\uff0c\u53ea\u8bfb\u5199\u672c\u5730\u6a21\u677f\u3002'
    };
  }

  async function saveTemplate(payload = {}) {
    const owner = getOwner();
    const localFilePath = getLocalProfileFilePath(owner);
    const profile = normalizeProfile(await readJsonFile(localFilePath));
    const now = getIsoTimestamp();
    const template = normalizeTemplate({
      ...(payload.template && typeof payload.template === 'object' ? payload.template : {}),
      updatedAt: now
    });
    const previous = profile.templates.find((item) => item.id === template.id);
    const nextTemplate = {
      ...template,
      createdAt: previous && previous.createdAt ? previous.createdAt : template.createdAt,
      updatedAt: now
    };
    const nextProfile = normalizeProfile({
      version: 1,
      updatedAt: now,
      templates: [
        nextTemplate,
        ...profile.templates.filter((item) => item.id !== nextTemplate.id)
      ]
    });
    const cloudResult = await writeCloudProfile(owner, nextProfile);

    await writeJsonFile(localFilePath, nextProfile);

    return {
      success: true,
      updatedAt: now,
      template: nextTemplate,
      templates: nextProfile.templates,
      ...cloudResult
    };
  }

  async function deleteTemplate(payload = {}) {
    const owner = getOwner();
    const templateId = normalizeText(payload && payload.templateId);
    const localFilePath = getLocalProfileFilePath(owner);
    const profile = normalizeProfile(await readJsonFile(localFilePath));
    const now = getIsoTimestamp();
    const nextProfile = normalizeProfile({
      version: 1,
      updatedAt: now,
      templates: profile.templates.filter((template) => template.id !== templateId)
    });
    const cloudResult = await writeCloudProfile(owner, nextProfile);

    await writeJsonFile(localFilePath, nextProfile);

    return {
      success: true,
      updatedAt: now,
      templates: nextProfile.templates,
      ...cloudResult
    };
  }

  return {
    getTemplates,
    saveTemplate,
    deleteTemplate
  };
}

module.exports = {
  createPodSuitePsdTemplateStore,
  normalizeTemplate
};
