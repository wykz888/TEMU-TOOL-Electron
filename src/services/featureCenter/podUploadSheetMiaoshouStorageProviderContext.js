const COS = require('cos-nodejs-sdk-v5');
const {
  normalizeText
} = require('../shopManagement/common');

const DEFAULT_STORAGE_PROVIDER = 'tencent-cos';
const CLOUDFLARE_R2_STORAGE_PROVIDER = 'cloudflare-r2';
const DEFAULT_OBJECT_ROOT_PREFIX = 'TEMU_Resources_Data';

function normalizePodMiaoshouStorageProvider(value) {
  return normalizeText(value) === CLOUDFLARE_R2_STORAGE_PROVIDER
    ? CLOUDFLARE_R2_STORAGE_PROVIDER
    : DEFAULT_STORAGE_PROVIDER;
}

function normalizePodMiaoshouObjectPrefix(value, fallback = '') {
  const text = normalizeText(value) || normalizeText(fallback);

  return text.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '').replace(/\\/g, '/');
}

function normalizeRemoteUrl(value, options = {}) {
  const text = normalizeText(value).replace(/[\\/]+$/, '');

  if (!text) {
    return '';
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^\/\//.test(text)) {
    return `https:${text}`;
  }

  if (/^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || /[\s\\]/.test(text)) {
    return '';
  }

  const domainPattern = options && options.allowBareDomain === true
    ? /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d{1,5})?(?:[/?#]|$)/i
    : /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d{1,5})?[/?#]/i;

  return domainPattern.test(text) ? `https://${text.replace(/^\/+/, '')}` : '';
}

function joinPodMiaoshouObjectKeySegments(...segments) {
  return segments
    .map((segment) => normalizePodMiaoshouObjectPrefix(segment, ''))
    .filter(Boolean)
    .join('/');
}

function encodeObjectKey(objectKey) {
  return String(objectKey || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getStorageProviders(storageSelection) {
  return storageSelection
    && storageSelection.providers
    && typeof storageSelection.providers === 'object'
    && !Array.isArray(storageSelection.providers)
      ? storageSelection.providers
      : {};
}

function isTencentCosConfigUsable(config) {
  return Boolean(
    config
    && config.enabled !== false
    && normalizeText(config.secretId)
    && normalizeText(config.secretKey)
    && normalizeText(config.bucket)
    && normalizeText(config.region)
  );
}

function isCloudflareR2ConfigUsable(config) {
  return Boolean(
    config
    && config.enabled !== false
    && normalizeText(config.accountId)
    && normalizeText(config.accessKeyId)
    && normalizeText(config.secretAccessKey)
    && normalizeText(config.bucket)
    && normalizeText(config.publicBaseUrl)
  );
}

function createTencentCosConfigError() {
  return new Error('\u817e\u8baf COS \u5b58\u50a8\u6e20\u9053\u672a\u914d\u7f6e\u5b8c\u6574\uff0c\u8bf7\u5148\u5728\u5168\u5c40\u914d\u7f6e\u4e2d\u586b\u5199 SecretId\u3001SecretKey\u3001\u5b58\u50a8\u6876\u548c\u5730\u57df\u3002');
}

function createTencentCosClient(config) {
  return new COS({
    SecretId: normalizeText(config.secretId),
    SecretKey: normalizeText(config.secretKey),
    Protocol: normalizeText(config.protocol) || 'https:',
    Timeout: 30000,
    KeepAlive: true
  });
}

function createTencentCosStorageContext(config) {
  return {
    storageProvider: DEFAULT_STORAGE_PROVIDER,
    bucket: normalizeText(config.bucket),
    region: normalizeText(config.region),
    rootPrefix: normalizePodMiaoshouObjectPrefix(config.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
    publicBaseUrl: normalizeRemoteUrl(config.publicBaseUrl, { allowBareDomain: true }),
    client: createTencentCosClient(config),
    usesFallbackClient: false
  };
}

function createCloudflareR2StorageContext(config) {
  const accountId = normalizeText(config.accountId);

  return {
    storageProvider: CLOUDFLARE_R2_STORAGE_PROVIDER,
    bucket: normalizeText(config.bucket),
    region: 'auto',
    rootPrefix: normalizePodMiaoshouObjectPrefix(config.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
    publicBaseUrl: normalizeRemoteUrl(config.publicBaseUrl, { allowBareDomain: true }),
    endpoint: normalizeText(config.endpoint) || `https://${accountId}.r2.cloudflarestorage.com`,
    accountId,
    accessKeyId: normalizeText(config.accessKeyId),
    secretAccessKey: normalizeText(config.secretAccessKey),
    client: null,
    usesFallbackClient: false
  };
}

async function loadStorageSelection(globalConfigService, runtimeLogger, logPayload = {}) {
  if (!globalConfigService || typeof globalConfigService.getStorageSelection !== 'function') {
    return null;
  }

  try {
    return await globalConfigService.getStorageSelection();
  } catch (error) {
    if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
      runtimeLogger.logError('pod_upload_sheet_storage_selection_load_failed', error, logPayload);
    }
    return null;
  }
}

async function resolvePodMiaoshouStorageContext({
  globalConfigService = null,
  runtimeLogger = null,
  requestedProvider = '',
  logPayload = {}
} = {}) {
  const storageSelection = await loadStorageSelection(globalConfigService, runtimeLogger, logPayload);
  const providers = getStorageProviders(storageSelection);
  const storageProvider = normalizePodMiaoshouStorageProvider(
    requestedProvider || (storageSelection && storageSelection.activeProvider)
  );

  if (storageProvider === CLOUDFLARE_R2_STORAGE_PROVIDER) {
    const r2Config = providers.cloudflareR2 && typeof providers.cloudflareR2 === 'object'
      ? providers.cloudflareR2
      : {};

    if (!isCloudflareR2ConfigUsable(r2Config)) {
      throw new Error('\u0043\u006c\u006f\u0075\u0064\u0066\u006c\u0061\u0072\u0065\u0020\u0052\u0032 \u5b58\u50a8\u6e20\u9053\u672a\u914d\u7f6e\u5b8c\u6574\uff0c\u8bf7\u5148\u5728\u5168\u5c40\u914d\u7f6e\u4e2d\u586b\u5199\u6876\u3001\u5bc6\u94a5\u548c\u516c\u5171\u8bbf\u95ee\u57df\u540d\u3002');
    }

    return createCloudflareR2StorageContext(r2Config);
  }

  const cosProviderConfig = providers.tencentCos && typeof providers.tencentCos === 'object'
    ? providers.tencentCos
    : {};

  if (!isTencentCosConfigUsable(cosProviderConfig)) {
    throw createTencentCosConfigError();
  }

  return createTencentCosStorageContext(cosProviderConfig);
}

function buildPodMiaoshouStoragePublicUrl(storageContext, objectKey) {
  const context = storageContext && typeof storageContext === 'object' ? storageContext : {};
  const baseUrl = normalizeRemoteUrl(context.publicBaseUrl, { allowBareDomain: true });

  if (baseUrl) {
    return `${baseUrl.replace(/[\\/]+$/, '')}/${encodeObjectKey(objectKey)}`;
  }

  if (context.storageProvider === CLOUDFLARE_R2_STORAGE_PROVIDER) {
    return '';
  }

  const bucket = normalizeText(context.bucket);
  const region = normalizeText(context.region);
  return bucket && region
    ? `https://${bucket}.cos.${region}.myqcloud.com/${encodeObjectKey(objectKey)}`
    : '';
}

function getPodMiaoshouStorageFingerprint(storageContext) {
  const context = storageContext && typeof storageContext === 'object' ? storageContext : {};

  return [
    normalizePodMiaoshouStorageProvider(context.storageProvider),
    normalizeText(context.bucket),
    normalizeText(context.region),
    normalizePodMiaoshouObjectPrefix(context.rootPrefix, DEFAULT_OBJECT_ROOT_PREFIX),
    normalizeRemoteUrl(context.publicBaseUrl, { allowBareDomain: true })
  ].join('|');
}

function sha256Hex(value) {
  return require('node:crypto').createHash('sha256').update(value).digest('hex');
}

function hmacSha256(key, value) {
  return require('node:crypto').createHmac('sha256', key).update(value).digest();
}

function buildR2CanonicalUri(bucket, objectKey) {
  return `/${encodeObjectKey(bucket)}/${encodeObjectKey(objectKey)}`;
}

function buildR2AuthHeaders(storageContext, bucket, objectKey, bodyBuffer, contentType, cacheControl) {
  const accountId = normalizeText(storageContext && storageContext.accountId);
  const accessKeyId = normalizeText(storageContext && storageContext.accessKeyId);
  const secretAccessKey = normalizeText(storageContext && storageContext.secretAccessKey);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(bodyBuffer);
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    buildR2CanonicalUri(bucket, objectKey),
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');
  const signingKey = hmacSha256(
    hmacSha256(
      hmacSha256(
        hmacSha256(`AWS4${secretAccessKey}`, dateStamp),
        'auto'
      ),
      's3'
    ),
    'aws4_request'
  );
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${buildR2CanonicalUri(bucket, objectKey)}`,
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Content-Type': contentType || 'application/octet-stream',
      ...(cacheControl ? { 'Cache-Control': cacheControl } : {})
    }
  };
}

async function uploadR2Buffer({
  storageContext,
  key,
  buffer,
  contentType,
  cacheControl,
  signal
}) {
  const bodyBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const bucket = normalizeText(storageContext && storageContext.bucket);
  const objectKey = normalizeText(key);
  const { url, headers } = buildR2AuthHeaders(storageContext, bucket, objectKey, bodyBuffer, contentType, cacheControl);
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: bodyBuffer,
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    const message = responseText
      ? `R2 \u4e0a\u4f20\u5931\u8d25\uff1a${response.status} ${response.statusText} ${responseText.slice(0, 180)}`
      : `R2 \u4e0a\u4f20\u5931\u8d25\uff1a${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return {
    Location: buildPodMiaoshouStoragePublicUrl(storageContext, objectKey),
    ETag: normalizeText(response.headers.get('etag')),
    url: buildPodMiaoshouStoragePublicUrl(storageContext, objectKey)
  };
}

async function uploadTencentCosBuffer({
  storageContext,
  key,
  buffer,
  contentLength,
  contentType,
  cacheControl,
  acl
}) {
  const context = storageContext && typeof storageContext === 'object' ? storageContext : {};
  const uploadClient = context.client && typeof context.client.putObject === 'function'
    ? context.client
    : null;
  const objectKey = normalizeText(key);

  if (!uploadClient || !normalizeText(context.bucket) || !normalizeText(context.region)) {
    throw createTencentCosConfigError();
  }

  const uploadResult = await uploadClient.putObject({
    Bucket: normalizeText(context.bucket),
    Region: normalizeText(context.region),
    Key: objectKey,
    Body: buffer,
    ContentLength: Number(contentLength) || (Buffer.isBuffer(buffer) ? buffer.length : 0),
    ContentType: normalizeText(contentType) || 'application/octet-stream',
    ACL: acl || 'public-read',
    ...(cacheControl ? { CacheControl: cacheControl } : {})
  });
  const location = normalizeText(uploadResult && uploadResult.Location);
  const fallbackUrl = buildPodMiaoshouStoragePublicUrl(context, objectKey);

  return {
    ...uploadResult,
    Location: location ? `https://${location.replace(/^https?:\/\//i, '')}` : fallbackUrl,
    url: fallbackUrl || (location ? `https://${location.replace(/^https?:\/\//i, '')}` : '')
  };
}

function uploadPodMiaoshouStorageBuffer(params = {}) {
  const storageContext = params.storageContext && typeof params.storageContext === 'object'
    ? params.storageContext
    : null;

  if (!storageContext) {
    throw createTencentCosConfigError();
  }

  if (storageContext.storageProvider === CLOUDFLARE_R2_STORAGE_PROVIDER) {
    return uploadR2Buffer(params);
  }

  return uploadTencentCosBuffer(params);
}

module.exports = {
  DEFAULT_OBJECT_ROOT_PREFIX,
  buildPodMiaoshouStoragePublicUrl,
  getPodMiaoshouStorageFingerprint,
  joinPodMiaoshouObjectKeySegments,
  normalizePodMiaoshouObjectPrefix,
  normalizePodMiaoshouStorageProvider,
  resolvePodMiaoshouStorageContext,
  uploadPodMiaoshouStorageBuffer
};
