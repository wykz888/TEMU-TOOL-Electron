const { randomUUID } = require('node:crypto');
const path = require('node:path');
const COS = require('cos-nodejs-sdk-v5');
const { cosService, COS_SCOPES } = require('../cos');
const {
  normalizeGeneralSettingsPayload,
  normalizeUpdateSettingsPayload
} = require('./globalConfigDesktopSettings');
const {
  buildOwnerDescriptor,
  normalizeText,
  nowIso
} = require('../shopManagement/common');

const SERVICE_VERSION = 1;
const STORAGE_KEY = 'global_config';
const STORAGE_CONFIG_FILE_NAME = 'storage-selection.json';
const AI_CONFIG_FILE_NAME = 'ai-config.json';
const GENERAL_SETTINGS_FILE_NAME = 'general-settings.json';
const UPDATE_SETTINGS_FILE_NAME = 'update-settings.json';
const DEFAULT_ROOT_PREFIX = 'TEMU_Resources_Data';
const DEFAULT_AI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_VOLCENGINE_MODEL = 'doubao-seed-2-0-mini-260428';
const DEFAULT_AI_CONCURRENCY = 20;
const MIN_AI_CONCURRENCY = 1;
const MAX_AI_CONCURRENCY = 100;

function createGlobalConfigService({
  sessionStore,
  featureCenterProfileService
}) {
  function getOwner() {
    return buildOwnerDescriptor(sessionStore.getSession());
  }

  function getStorageProfile() {
    return featureCenterProfileService.getStorageProfile(STORAGE_KEY);
  }

  function getLocalConfigFilePath(owner, fileName) {
    // Global config is still scoped by software account; "global" here means
    // cross-feature inside one login, not shared by every login.
    return path.join(getStorageProfile().localRootDir, 'users', owner.userKey, 'config', fileName);
  }

  function getCloudConfigKey(owner, fileName) {
    return `${STORAGE_KEY}/users/${owner.userKey}/config/${fileName}`;
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function normalizeBoolean(value, fallback) {
    return value === undefined ? fallback : value === true;
  }

  function normalizeProvider(value) {
    return value === 'cloudflare-r2' ? 'cloudflare-r2' : 'tencent-cos';
  }

  function normalizeAiProvider() {
    return 'volcengine';
  }

  function buildDefaultGeneralSettings(owner) {
    return {
      version: SERVICE_VERSION,
      owner: buildOwnerSnapshot(owner),
      ...normalizeGeneralSettingsPayload({})
    };
  }

  function normalizeGeneralSettings(value, owner) {
    return {
      version: SERVICE_VERSION,
      owner: buildOwnerSnapshot(owner),
      ...normalizeGeneralSettingsPayload(value)
    };
  }

  function buildDefaultUpdateSettings(owner) {
    return {
      version: SERVICE_VERSION,
      owner: buildOwnerSnapshot(owner),
      ...normalizeUpdateSettingsPayload({})
    };
  }

  function normalizeUpdateSettings(value, owner) {
    return {
      version: SERVICE_VERSION,
      owner: buildOwnerSnapshot(owner),
      ...normalizeUpdateSettingsPayload(value)
    };
  }

  function normalizeConcurrency(value) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return DEFAULT_AI_CONCURRENCY;
    }

    return Math.max(MIN_AI_CONCURRENCY, Math.min(MAX_AI_CONCURRENCY, parsed));
  }

  function normalizeTestStatus(value) {
    return value === 'success' || value === 'error' ? value : 'untested';
  }

  function normalizeTencentCosConfig(value) {
    const record = isRecord(value) ? value : {};

    return {
      enabled: normalizeBoolean(record.enabled, true),
      secretId: normalizeText(record.secretId),
      secretKey: normalizeText(record.secretKey),
      bucket: normalizeText(record.bucket),
      region: normalizeText(record.region),
      rootPrefix: normalizeText(record.rootPrefix) || DEFAULT_ROOT_PREFIX,
      protocol: normalizeText(record.protocol) || 'https:'
    };
  }

  function normalizeCloudflareAccountId(value) {
    const text = normalizeText(value);
    const hostSuffix = '.r2.cloudflarestorage.com';

    if (!text) {
      return '';
    }

    const host = text.replace(/^https?:\/\//i, '').split('/')[0].trim();
    const lowerHost = host.toLowerCase();

    return lowerHost.endsWith(hostSuffix) ? host.slice(0, host.length - hostSuffix.length) : text;
  }

  function getCloudflareEndpoint(accountId) {
    const normalizedAccountId = normalizeCloudflareAccountId(accountId);

    return normalizedAccountId ? `https://${normalizedAccountId}.r2.cloudflarestorage.com` : '';
  }

  function normalizeCloudflareR2Config(value) {
    const record = isRecord(value) ? value : {};
    const accountId = normalizeCloudflareAccountId(record.accountId);

    return {
      enabled: normalizeBoolean(record.enabled, false),
      accountId,
      accessKeyId: normalizeText(record.accessKeyId),
      secretAccessKey: normalizeText(record.secretAccessKey),
      apiToken: normalizeText(record.apiToken),
      bucket: normalizeText(record.bucket),
      endpoint: getCloudflareEndpoint(accountId),
      publicBaseUrl: normalizeText(record.publicBaseUrl),
      rootPrefix: normalizeText(record.rootPrefix) || DEFAULT_ROOT_PREFIX
    };
  }

  function buildDefaultStorageConfig(owner) {
    return {
      version: SERVICE_VERSION,
      owner: buildOwnerSnapshot(owner),
      activeProvider: 'tencent-cos',
      updatedAt: '',
      providers: {
        tencentCos: normalizeTencentCosConfig({}),
        cloudflareR2: normalizeCloudflareR2Config({})
      }
    };
  }

  function normalizeStorageConfig(value, owner) {
    const record = isRecord(value) ? value : {};
    const providers = isRecord(record.providers) ? record.providers : {};

    return {
      ...buildDefaultStorageConfig(owner),
      activeProvider: normalizeProvider(record.activeProvider),
      updatedAt: normalizeText(record.updatedAt),
      providers: {
        tencentCos: normalizeTencentCosConfig(providers.tencentCos),
        cloudflareR2: normalizeCloudflareR2Config(providers.cloudflareR2)
      }
    };
  }

  function normalizeApiKeyConfig(value, index) {
    const record = isRecord(value) ? value : {};

    return {
      id: normalizeText(record.id) || randomUUID(),
      name: normalizeText(record.name) || `APIKEY ${index + 1}`,
      apiKey: normalizeText(record.apiKey),
      enabled: normalizeBoolean(record.enabled, true),
      lastTestedAt: normalizeText(record.lastTestedAt),
      lastTestStatus: normalizeTestStatus(record.lastTestStatus),
      lastTestMessage: normalizeText(record.lastTestMessage)
    };
  }

  function normalizeVolcengineConfig(value) {
    const record = isRecord(value) ? value : {};
    const apiKeys = Array.isArray(record.apiKeys) ? record.apiKeys : [];

    return {
      enabled: normalizeBoolean(record.enabled, true),
      apiBaseUrl: normalizeText(record.apiBaseUrl) || DEFAULT_AI_BASE_URL,
      model: normalizeText(record.model) || DEFAULT_VOLCENGINE_MODEL,
      concurrency: normalizeConcurrency(record.concurrency),
      apiKeys: apiKeys.map((item, index) => normalizeApiKeyConfig(item, index))
    };
  }

  function buildDefaultAiConfig(owner) {
    return {
      version: SERVICE_VERSION,
      owner: buildOwnerSnapshot(owner),
      activeProvider: 'volcengine',
      updatedAt: '',
      providers: {
        volcengine: normalizeVolcengineConfig({})
      }
    };
  }

  function normalizeAiConfig(value, owner) {
    const record = isRecord(value) ? value : {};
    const providers = isRecord(record.providers) ? record.providers : {};

    return {
      ...buildDefaultAiConfig(owner),
      activeProvider: normalizeAiProvider(record.activeProvider),
      updatedAt: normalizeText(record.updatedAt),
      providers: {
        volcengine: normalizeVolcengineConfig(providers.volcengine)
      }
    };
  }

  function buildOwnerSnapshot(owner) {
    return owner ? {
      userId: owner.userId,
      username: owner.username,
      userKey: owner.userKey
    } : null;
  }

  function getPayloadTimestamp(payload) {
    const timestamp = Date.parse(normalizeText(payload && payload.updatedAt));

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickNewerPayload(localPayload, cloudPayload) {
    if (localPayload && cloudPayload) {
      return getPayloadTimestamp(cloudPayload) > getPayloadTimestamp(localPayload)
        ? cloudPayload
        : localPayload;
    }

    return cloudPayload || localPayload || null;
  }

  async function readJsonFile(filePath) {
    try {
      const text = await require('node:fs/promises').readFile(filePath, 'utf8');

      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  }

  async function writeJsonFile(filePath, payload) {
    const fsPromises = require('node:fs/promises');
    const tempPath = `${filePath}.tmp`;

    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    await fsPromises.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    await fsPromises.rename(tempPath, filePath);
  }

  async function readCloudConfig(owner, fileName) {
    const key = getCloudConfigKey(owner, fileName);
    const exists = await cosService.existsObject({
      scope: COS_SCOPES.ROOT,
      key
    });

    if (!exists) {
      return null;
    }

    const result = await cosService.getObjectJson({
      scope: COS_SCOPES.ROOT,
      key
    });

    return result.data;
  }

  async function writeCloudConfig(owner, fileName, data, recordType) {
    return cosService.putJson({
      scope: COS_SCOPES.ROOT,
      key: getCloudConfigKey(owner, fileName),
      data,
      metadata: {
        record_type: recordType,
        owner_user_key: owner.userKey,
        owner_username: owner.username
      }
    });
  }

  async function loadConfig(fileName, normalizeConfig, buildDefault) {
    const owner = getOwner();
    const localFilePath = getLocalConfigFilePath(owner, fileName);
    const localPayload = await readJsonFile(localFilePath);
    let cloudPayload = null;

    try {
      cloudPayload = await readCloudConfig(owner, fileName);
    } catch (_error) {
      cloudPayload = null;
    }

    const pickedPayload = pickNewerPayload(localPayload, cloudPayload);
    const normalizedConfig = pickedPayload
      ? normalizeConfig(pickedPayload, owner)
      : buildDefault(owner);

    if (pickedPayload === cloudPayload && cloudPayload) {
      await writeJsonFile(localFilePath, normalizedConfig).catch(() => undefined);
    }

    return normalizedConfig;
  }

  async function saveConfig(fileName, payload, normalizeConfig, recordType) {
    const owner = getOwner();
    const currentConfig = await loadConfig(
      fileName,
      normalizeConfig,
      fileName === AI_CONFIG_FILE_NAME
        ? buildDefaultAiConfig
        : fileName === GENERAL_SETTINGS_FILE_NAME
          ? buildDefaultGeneralSettings
          : fileName === UPDATE_SETTINGS_FILE_NAME
            ? buildDefaultUpdateSettings
            : buildDefaultStorageConfig
    );
    const payloadProviders = isRecord(payload.providers) ? payload.providers : {};
    const currentProviders = isRecord(currentConfig.providers) ? currentConfig.providers : {};
    const nextPayloadBase = {
      ...currentConfig,
      ...payload,
      updatedAt: nowIso()
    };

    if (fileName === STORAGE_CONFIG_FILE_NAME) {
      nextPayloadBase.activeProvider =
        payload.activeProvider === undefined ? currentConfig.activeProvider : payload.activeProvider;
      nextPayloadBase.providers = {
        ...currentProviders,
        tencentCos: {
          ...currentProviders.tencentCos,
          ...(isRecord(payloadProviders.tencentCos) ? payloadProviders.tencentCos : {})
        },
        cloudflareR2: {
          ...currentProviders.cloudflareR2,
          ...(isRecord(payloadProviders.cloudflareR2) ? payloadProviders.cloudflareR2 : {})
        }
      };
    } else if (fileName === AI_CONFIG_FILE_NAME) {
      nextPayloadBase.activeProvider =
        payload.activeProvider === undefined ? currentConfig.activeProvider : payload.activeProvider;
      nextPayloadBase.providers = {
        ...currentProviders,
        volcengine: {
          ...currentProviders.volcengine,
          ...(isRecord(payloadProviders.volcengine) ? payloadProviders.volcengine : {})
        }
      };
    }

    const nextConfig = normalizeConfig(nextPayloadBase, owner);

    await writeJsonFile(getLocalConfigFilePath(owner, fileName), nextConfig);

    try {
      await writeCloudConfig(owner, fileName, nextConfig, recordType);
      return {
        ...nextConfig,
        cloudSynced: true
      };
    } catch (error) {
      return {
        ...nextConfig,
        cloudSynced: false,
        warning: error && error.message ? error.message : '\u4e91\u7aef\u540c\u6b65\u5931\u8d25'
      };
    }
  }

  function requireSecretText(value, fieldName) {
    const text = normalizeText(value);

    if (!text) {
      throw new Error(`${fieldName}\u4e0d\u80fd\u4e3a\u7a7a\u3002`);
    }

    return text;
  }

  function resolveVolcengineChatUrl(apiBaseUrl) {
    const baseUrl = normalizeText(apiBaseUrl) || DEFAULT_AI_BASE_URL;

    return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  function getFriendlyApiError(status, bodyText) {
    if (status === 401) {
      return 'APIKEY \u6821\u9a8c\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u5bc6\u94a5\u662f\u5426\u6b63\u786e\u3002';
    }

    if (status === 403) {
      return '\u8d26\u53f7\u6743\u9650\u4e0d\u8db3\u6216\u6a21\u578b\u672a\u5f00\u901a\u3002';
    }

    if (status === 404) {
      return '\u6a21\u578b\u4e0d\u5b58\u5728\u6216\u5f53\u524d\u8d26\u53f7\u4e0d\u53ef\u7528\u3002';
    }

    if (status === 429) {
      return '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\u6216\u989d\u5ea6\u4e0d\u8db3\u3002';
    }

    const trimmed = normalizeText(bodyText);

    return trimmed
      ? `\u6d4b\u8bd5\u5931\u8d25\uff1a${trimmed.slice(0, 160)}`
      : '\u6d4b\u8bd5\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002';
  }

  function getFriendlyFetchError(error) {
    if (error && error.name === 'AbortError') {
      return '\u6d4b\u8bd5\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216 APIKEY\u3002';
    }

    if (error && error.message) {
      return error.message;
    }

    return '\u6d4b\u8bd5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216 APIKEY\u3002';
  }

  function getFriendlyCloudflareApiError(status, bodyText) {
    if (status === 401) {
      return 'API Token \u6821\u9a8c\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5 Token \u662f\u5426\u6b63\u786e\u3002';
    }

    if (status === 403) {
      return '\u8d26\u53f7\u6743\u9650\u4e0d\u8db3\uff0c\u8bf7\u68c0\u67e5 API Token \u6743\u9650\u3002';
    }

    if (status === 404) {
      return '\u8d26\u53f7\u6216\u5b58\u50a8\u6876\u4e0d\u5b58\u5728\u3002';
    }

    if (status === 429) {
      return '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\u6216\u989d\u5ea6\u4e0d\u8db3\u3002';
    }

    const trimmed = normalizeText(bodyText);

    return trimmed
      ? `\u83b7\u53d6\u5931\u8d25\uff1a${trimmed.slice(0, 160)}`
      : '\u83b7\u53d6\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002';
  }

  function parseCloudflareApiJson(text) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  }

  function buildCloudflareApiUrl(accountId, path) {
    const normalizedAccountId = normalizeCloudflareAccountId(accountId);

    return `https://api.cloudflare.com/client/v4/accounts/${normalizedAccountId}${path}`;
  }

  function hmacSha256Hex(key, data) {
    return require('node:crypto').createHmac('sha256', key).update(data, 'utf8').digest();
  }

  function sha256Hex(data) {
    return require('node:crypto').createHash('sha256').update(data, 'utf8').digest('hex');
  }

  function r2S3Sign(accountId, accessKeyId, secretAccessKey, method, bucket, options) {
    const region = 'auto';
    const service = 's3';
    const host = `${accountId}.r2.cloudflarestorage.com`;

    const prefix = String(options && options.prefix || '');
    const delimiter = String(options && options.delimiter || '/');
    const body = String(options && options.body || '');
    const extraQuery = (options && options.query) || {};

    const queryParams = Object.assign({}, extraQuery);

    if (options && options.listType === 2) {
      queryParams['list-type'] = '2';
      queryParams.delimiter = delimiter;
      if (prefix) queryParams.prefix = prefix;
    }

    const sortedKeys = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedKeys
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalUri = '/' + encodeURI(bucket);
    const payloadHash = sha256Hex(body);
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\n`;
    const signedHeaders = 'host;x-amz-content-sha256';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');

    const kDate = hmacSha256Hex('AWS4' + secretAccessKey, dateStamp);
    const kRegion = hmacSha256Hex(kDate, region);
    const kService = hmacSha256Hex(kRegion, service);
    const signingKey = hmacSha256Hex(kService, 'aws4_request');
    const signature = hmacSha256Hex(signingKey, stringToSign).toString('hex');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = canonicalQueryString
      ? `https://${host}${canonicalUri}?${canonicalQueryString}`
      : `https://${host}${canonicalUri}`;

    const requestHeaders = {
      'Host': host,
      'Authorization': authorizationHeader,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    };

    if (body) {
      requestHeaders['Content-Type'] = 'application/xml';
    }

    return { url, headers: requestHeaders, body };
  }

  function parseR2S3ListXml(xmlText, prefix) {
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
    const parsed = parser.parse(xmlText);
    const result = parsed && parsed.ListBucketResult ? parsed.ListBucketResult : {};

    const rawCommonPrefixes = result.CommonPrefixes;

    const commonPrefixList = Array.isArray(rawCommonPrefixes)
      ? rawCommonPrefixes
      : (rawCommonPrefixes ? [rawCommonPrefixes] : []);

    const folders = commonPrefixList
      .filter((item) => item && item.Prefix)
      .map((item) => ({
        name: String(item.Prefix).slice((prefix || '').length).replace(/\/$/, ''),
        prefix: String(item.Prefix),
        type: 'folder'
      }));

    const rawContents = result.Contents;
    const contentList = Array.isArray(rawContents)
      ? rawContents
      : (rawContents ? [rawContents] : []);

    const files = contentList
      .filter((item) => item && item.Key && item.Key !== prefix)
      .map((item) => {
        const relativeKey = String(item.Key).slice((prefix || '').length);

        return {
          name: relativeKey,
          key: String(item.Key),
          type: 'file',
          size: Number(item.Size) || 0,
          lastModified: String(item.LastModified || '')
        };
      })
      .filter((file) => file.name);

    return { folders, files };
  }

  return {
    getStorageSelection() {
      return loadConfig(STORAGE_CONFIG_FILE_NAME, normalizeStorageConfig, buildDefaultStorageConfig);
    },
    saveStorageSelection(payload) {
      return saveConfig(
        STORAGE_CONFIG_FILE_NAME,
        payload || {},
        normalizeStorageConfig,
        'global-config-storage-selection'
      );
    },
    async listTencentCosBuckets(payload) {
      const secretId = requireSecretText(payload && payload.secretId, 'SecretId');
      const secretKey = requireSecretText(payload && payload.secretKey, 'SecretKey');
      const cosClient = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
        Protocol: 'https:'
      });

      try {
        const result = await cosClient.getService({ MaxKeys: 2000 });

        return {
          buckets: (result.Buckets || [])
            .filter((bucket) => bucket.Name && bucket.Location)
            .map((bucket) => ({
              name: bucket.Name,
              region: bucket.Location,
              createdAt: bucket.CreationDate || ''
            }))
        };
        } catch (_error) {
        throw new Error('\u83b7\u53d6\u5b58\u50a8\u6876\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5 ID/KEY \u6216\u8d26\u53f7\u6743\u9650\u3002');
      }
    },
    async listTencentCosObjects(payload) {
      const secretId = requireSecretText(payload && payload.secretId, 'SecretId');
      const secretKey = requireSecretText(payload && payload.secretKey, 'SecretKey');
      const region = requireSecretText(payload && payload.region, '\u5730\u57df');
      const bucket = requireSecretText(payload && payload.bucket, '\u5b58\u50a8\u6876');
      const prefix = normalizeText(payload && payload.prefix) || '';
      const delimiter = (payload && payload.delimiter) || '/';
      const marker = normalizeText(payload && payload.marker) || '';

      const cosClient = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
        Protocol: 'https:'
      });

      try {
        const result = await cosClient.getBucket({
          Bucket: bucket,
          Region: region,
          Prefix: prefix,
          Delimiter: delimiter,
          Marker: marker,
          MaxKeys: 1000
        });

        const folders = Array.isArray(result.CommonPrefixes)
          ? result.CommonPrefixes
            .filter((item) => item && item.Prefix)
            .map((item) => ({
              name: item.Prefix.slice(prefix.length).replace(/\/$/, ''),
              prefix: item.Prefix,
              type: 'folder'
            }))
          : [];

        const files = Array.isArray(result.Contents)
          ? result.Contents
            .filter((item) => item && item.Key && item.Key !== prefix)
            .map((item) => {
              const relativeKey = item.Key.slice(prefix.length);

              return {
                name: relativeKey,
                key: item.Key,
                type: 'file',
                size: Number(item.Size) || 0,
                lastModified: String(item.LastModified || '')
              };
            })
          : [];

        return {
          objects: [...folders, ...files],
          isTruncated: result.IsTruncated === 'true',
          nextMarker: String(result.NextMarker || ''),
          prefix
        };
      } catch (error) {
        throw new Error(
          error && error.message
            ? `\u83b7\u53d6\u5bf9\u8c61\u5931\u8d25\uff1a${String(error.message).slice(0, 200)}`
            : '\u83b7\u53d6\u5bf9\u8c61\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u51ed\u8bc1\u6216\u7f51\u7edc\u3002'
        );
      }
    },
    async deleteTencentCosObjects(payload) {
      const secretId = requireSecretText(payload && payload.secretId, 'SecretId');
      const secretKey = requireSecretText(payload && payload.secretKey, 'SecretKey');
      const region = requireSecretText(payload && payload.region, '\u5730\u57df');
      const bucket = requireSecretText(payload && payload.bucket, '\u5b58\u50a8\u6876');
      const objects = Array.isArray(payload && payload.objects) ? payload.objects : [];

      if (!objects.length) {
        throw new Error('\u8bf7\u9009\u62e9\u8981\u5220\u9664\u7684\u5bf9\u8c61\u3002');
      }

      const cosClient = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
        Protocol: 'https:'
      });

      try {
        const result = await cosClient.deleteMultipleObject({
          Bucket: bucket,
          Region: region,
          Objects: objects.map((item) => {
            const key = typeof item === 'string' ? item : (item && item.key || item && item.Key || '');

            return { Key: key };
          }),
          Quiet: true
        });

        const deleted = Array.isArray(result && result.Deleted) ? result.Deleted : [];
        const errors = Array.isArray(result && result.Error) ? result.Error : [];

        return {
          deletedCount: deleted.length,
          errorCount: errors.length,
          errors: errors.slice(0, 10).map((err) => ({
            key: String(err.Key || ''),
            message: String(err.Message || '')
          }))
        };
      } catch (error) {
        throw new Error(
          error && error.message
            ? `\u6279\u91cf\u5220\u9664\u5931\u8d25\uff1a${String(error.message).slice(0, 200)}`
            : '\u6279\u91cf\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u51ed\u8bc1\u6216\u7f51\u7edc\u3002'
        );
      }
    },
    async listCloudflareR2Buckets(payload) {
      const accountId = normalizeCloudflareAccountId(payload && payload.accountId);
      const apiToken = requireSecretText(payload && payload.apiToken, 'API Token');

      if (!accountId) {
        throw new Error('Account ID \u4e0d\u80fd\u4e3a\u7a7a\u3002');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(buildCloudflareApiUrl(accountId, '/r2/buckets'), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        const bodyText = await response.text();

        if (!response.ok) {
          throw new Error(getFriendlyCloudflareApiError(response.status, bodyText));
        }

        const body = parseCloudflareApiJson(bodyText);
        const buckets = Array.isArray(body && body.result && body.result.buckets)
          ? body.result.buckets
          : [];

        return {
          buckets: buckets.map((bucket) => ({
            name: String(bucket.name || bucket.Name || ''),
            createdAt: String(bucket.creation_date || bucket.CreationDate || '')
          })).filter((bucket) => bucket.name)
        };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('\u83b7\u53d6\u5b58\u50a8\u6876\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216 API Token\u3002');
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    async listCloudflareR2PublicDomains(payload) {
      const accountId = normalizeCloudflareAccountId(payload && payload.accountId);
      const apiToken = requireSecretText(payload && payload.apiToken, 'API Token');
      const bucket = requireSecretText(payload && payload.bucket, '\u5b58\u50a8\u6876');

      if (!accountId) {
        throw new Error('Account ID \u4e0d\u80fd\u4e3a\u7a7a\u3002');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      function normalizeDomain(domain) {
        if (typeof domain === 'string') {
          return { value: domain, label: domain };
        }

        const value = String(domain.domain || domain.name || domain.url || '');

        return {
          value,
          label: String(domain.name || domain.domain || value)
        };
      }

      function extractDomains(result) {
        if (!result) {
          return [];
        }

        if (Array.isArray(result.domains)) {
          return result.domains.map(normalizeDomain).filter((item) => item.value);
        }

        if (Array.isArray(result)) {
          return result.map(normalizeDomain).filter((item) => item.value);
        }

        if (result.enabled !== false && (result.domain || result.name || result.url)) {
          return [normalizeDomain(result)].filter((item) => item.value);
        }

        return [];
      }

      try {
        const [customResult, r2DevResult] = await Promise.allSettled([
          fetch(buildCloudflareApiUrl(accountId, `/r2/buckets/${bucket}/domains/custom`), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          }),
          fetch(buildCloudflareApiUrl(accountId, `/r2/buckets/${bucket}/domains/r2`), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
        ]);

        const domains = [];
        let firstError = null;

        if (customResult.status === 'fulfilled') {
          const response = customResult.value;
          const bodyText = await response.text();

          if (response.ok) {
            const body = parseCloudflareApiJson(bodyText);
            domains.push(...extractDomains(body && body.result));
          } else if (!firstError) {
            firstError = new Error(getFriendlyCloudflareApiError(response.status, bodyText));
          }
        } else if (!firstError) {
          firstError = customResult.reason;
        }

        if (r2DevResult.status === 'fulfilled') {
          const response = r2DevResult.value;
          const bodyText = await response.text();

          if (response.ok) {
            const body = parseCloudflareApiJson(bodyText);
            const result = body && body.result;

            if (result && result.enabled !== false && result.domain) {
              domains.push({
                value: String(result.domain),
                label: `${String(result.domain)} (r2.dev)`
              });
            }
          } else if (!firstError) {
            firstError = new Error(getFriendlyCloudflareApiError(response.status, bodyText));
          }
        } else if (!firstError) {
          firstError = r2DevResult.reason;
        }

        if (domains.length === 0 && firstError) {
          throw firstError;
        }

        return { domains };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('\u83b7\u53d6\u516c\u5171\u57df\u540d\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216 API Token\u3002');
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    async listCloudflareR2Objects(payload) {
      const accessKeyId = requireSecretText(payload && payload.accessKeyId, 'Access Key ID');
      const secretAccessKey = requireSecretText(payload && payload.secretAccessKey, 'Secret Access Key');
      const accountId = normalizeCloudflareAccountId(payload && payload.accountId);

      if (!accountId) {
        throw new Error('Account ID \u4e0d\u80fd\u4e3a\u7a7a\u3002');
      }

      const bucket = requireSecretText(payload && payload.bucket, '\u5b58\u50a8\u6876');
      const prefix = normalizeText(payload && payload.prefix) || '';
      const delimiter = (payload && payload.delimiter) || '/';

      const { url, headers } = r2S3Sign(accountId, accessKeyId, secretAccessKey, 'GET', bucket, {
        listType: 2,
        prefix,
        delimiter
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        const bodyText = await response.text();

        if (!response.ok) {
          throw new Error(getFriendlyCloudflareApiError(response.status, bodyText));
        }

        const { folders, files } = parseR2S3ListXml(bodyText, prefix);

        return {
          objects: [...folders, ...files],
          prefix
        };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('\u83b7\u53d6\u5bf9\u8c61\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216\u51ed\u8bc1\u3002');
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    async deleteCloudflareR2Objects(payload) {
      const accessKeyId = requireSecretText(payload && payload.accessKeyId, 'Access Key ID');
      const secretAccessKey = requireSecretText(payload && payload.secretAccessKey, 'Secret Access Key');
      const accountId = normalizeCloudflareAccountId(payload && payload.accountId);

      if (!accountId) {
        throw new Error('Account ID \u4e0d\u80fd\u4e3a\u7a7a\u3002');
      }

      const bucket = requireSecretText(payload && payload.bucket, '\u5b58\u50a8\u6876');
      const objects = Array.isArray(payload && payload.objects) ? payload.objects : [];

      if (!objects.length) {
        throw new Error('\u8bf7\u9009\u62e9\u8981\u5220\u9664\u7684\u5bf9\u8c61\u3002');
      }

      const deleteXml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Delete>',
        '<Quiet>true</Quiet>',
        ...objects.map((item) => {
          const key = typeof item === 'string' ? item : (item && item.key || '');
          const escaped = String(key).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          return `<Object><Key>${escaped}</Key></Object>`;
        }),
        '</Delete>'
      ].join('\n');

      const { url, headers, body } = r2S3Sign(accountId, accessKeyId, secretAccessKey, 'POST', bucket, {
        query: { delete: '' },
        body: deleteXml
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal
        });
        const bodyText = await response.text();

        if (!response.ok) {
          throw new Error(getFriendlyCloudflareApiError(response.status, bodyText));
        }

        const { XMLParser } = require('fast-xml-parser');
        const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
        const parsed = parser.parse(bodyText);
        const deleteResult = parsed && parsed.DeleteResult ? parsed.DeleteResult : {};

        const deleted = Array.isArray(deleteResult.Deleted)
          ? deleteResult.Deleted
          : (deleteResult.Deleted ? [deleteResult.Deleted] : []);

        const errors = Array.isArray(deleteResult.Error)
          ? deleteResult.Error
          : (deleteResult.Error ? [deleteResult.Error] : []);

        return {
          deletedCount: deleted.length,
          errorCount: errors.length,
          errors: errors.slice(0, 10).map((err) => ({
            key: String(err.Key || ''),
            message: String(err.Message || '')
          }))
        };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('\u6279\u91cf\u5220\u9664\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216\u51ed\u8bc1\u3002');
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    getAiConfig() {
      return loadConfig(AI_CONFIG_FILE_NAME, normalizeAiConfig, buildDefaultAiConfig);
    },
    getGeneralSettings() {
      return loadConfig(
        GENERAL_SETTINGS_FILE_NAME,
        normalizeGeneralSettings,
        buildDefaultGeneralSettings
      );
    },
    saveGeneralSettings(payload) {
      return saveConfig(
        GENERAL_SETTINGS_FILE_NAME,
        payload || {},
        normalizeGeneralSettings,
        'global-config-general-settings'
      );
    },
    getUpdateSettings() {
      return loadConfig(
        UPDATE_SETTINGS_FILE_NAME,
        normalizeUpdateSettings,
        buildDefaultUpdateSettings
      );
    },
    saveUpdateSettings(payload) {
      return saveConfig(
        UPDATE_SETTINGS_FILE_NAME,
        payload || {},
        normalizeUpdateSettings,
        'global-config-update-settings'
      );
    },
    saveAiConfig(payload) {
      return saveConfig(
        AI_CONFIG_FILE_NAME,
        payload || {},
        normalizeAiConfig,
        'global-config-ai-config'
      );
    },
    async testAiApiKey(payload) {
      const provider = normalizeAiProvider(payload && payload.provider);
      const model = normalizeText(payload && payload.model) || DEFAULT_VOLCENGINE_MODEL;
      const apiKey = requireSecretText(payload && payload.apiKey, 'APIKEY');
      const apiBaseUrl = normalizeText(payload && payload.apiBaseUrl) || DEFAULT_AI_BASE_URL;

      if (provider !== 'volcengine') {
        throw new Error('\u5f53\u524d\u4ec5\u652f\u6301\u706b\u5c71\u5f15\u64ce\u3002');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(resolveVolcengineChatUrl(apiBaseUrl), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: 'ping'
              }
            ],
            max_tokens: 8,
            temperature: 0
          }),
          signal: controller.signal
        });
        const bodyText = await response.text();

        if (!response.ok) {
          throw new Error(getFriendlyApiError(response.status, bodyText));
        }

        return {
          ok: true,
          message: '\u6d4b\u8bd5\u901a\u8fc7\u3002',
          testedAt: nowIso()
        };
      } catch (error) {
        throw new Error(getFriendlyFetchError(error));
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

module.exports = {
  DEFAULT_GLOBAL_AI_CONFIG: Object.freeze({
    apiBaseUrl: DEFAULT_AI_BASE_URL,
    model: DEFAULT_VOLCENGINE_MODEL,
    concurrency: DEFAULT_AI_CONCURRENCY,
    apiKeys: Object.freeze([])
  }),
  createGlobalConfigService
};
