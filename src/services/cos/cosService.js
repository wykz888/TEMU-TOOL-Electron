const fs = require('node:fs');
const path = require('node:path');
const { cosClient, withBucket } = require('./client');
const { cosConfig, COS_SCOPES } = require('./config');
const { buildScopedKey, stripScopePrefix } = require('./keyBuilder');

function removeUndefinedFields(target) {
  return Object.fromEntries(Object.entries(target).filter(([, value]) => value !== undefined));
}

function normalizeMetaHeaderValue(value) {
  const normalizedValue = String(value == null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  if (!normalizedValue) {
    return '';
  }

  if (/^[\u0020-\u007e\u00a0-\u00ff]*$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return encodeURIComponent(normalizedValue);
}

function toMetaHeaders(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        const normalizedKey = key.startsWith('x-cos-meta-') ? key : `x-cos-meta-${key.replace(/_/g, '-')}`;
        return [normalizedKey, normalizeMetaHeaderValue(value)];
      })
  );
}

function toAbsoluteUrl(location) {
  return `https://${location}`;
}

function isNotFoundError(error) {
  return Boolean(
    error &&
      (error.statusCode === 404 ||
        error.code === 'NoSuchKey' ||
        error.Code === 'NoSuchKey' ||
        (error.error && error.error.Code === 'NoSuchKey'))
  );
}

function mapListedObject(scope, object) {
  return {
    ...object,
    scopedKey: object.Key,
    key: stripScopePrefix(object.Key, scope)
  };
}

function mapListedPrefix(scope, prefix) {
  return {
    scopedKey: prefix,
    key: stripScopePrefix(prefix, scope)
  };
}

async function ping() {
  return cosClient.getBucket(
    withBucket({
      Prefix: buildScopedKey('', COS_SCOPES.ROOT),
      MaxKeys: 1
    })
  );
}

async function listObjects({
  scope = COS_SCOPES.ROOT,
  prefix = '',
  maxKeys = 1000,
  marker,
  recursive = true
} = {}) {
  const scopedPrefix = buildScopedKey(prefix, scope);
  const result = await cosClient.getBucket(
    removeUndefinedFields(
      withBucket({
        Prefix: scopedPrefix,
        MaxKeys: maxKeys,
        Marker: marker,
        Delimiter: recursive ? undefined : '/'
      })
    )
  );

  return {
    ...result,
    scope,
    scopedPrefix,
    prefix: stripScopePrefix(scopedPrefix, scope),
    items: (result.Contents || []).map((item) => mapListedObject(scope, item)),
    directories: (result.CommonPrefixes || []).map((item) => mapListedPrefix(scope, item.Prefix))
  };
}

async function listAllObjects({ scope = COS_SCOPES.ROOT, prefix = '', recursive = true } = {}) {
  const items = [];
  const directories = [];
  let marker;
  let hasMore = true;

  while (hasMore) {
    const page = await listObjects({
      scope,
      prefix,
      recursive,
      marker
    });

    items.push(...page.items);
    directories.push(...page.directories);

    hasMore = page.IsTruncated === 'true';
    marker = page.NextMarker || (page.items.length > 0 ? page.items[page.items.length - 1].scopedKey : undefined);
  }

  return {
    scope,
    scopedPrefix: buildScopedKey(prefix, scope),
    prefix,
    items,
    directories
  };
}

async function headObject({ scope = COS_SCOPES.ROOT, key }) {
  const scopedKey = buildScopedKey(key, scope);
  const result = await cosClient.headObject(withBucket({ Key: scopedKey }));

  return {
    ...result,
    scope,
    scopedKey,
    key: stripScopePrefix(scopedKey, scope)
  };
}

async function existsObject({ scope = COS_SCOPES.ROOT, key }) {
  try {
    await headObject({ scope, key });
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

async function putObject({ scope = COS_SCOPES.ROOT, key, body, contentType, metadata = {} }) {
  if (body === undefined || body === null) {
    throw new TypeError('body is required.');
  }

  const scopedKey = buildScopedKey(key, scope);
  const normalizedBody = Buffer.isBuffer(body) ? body : typeof body === 'string' ? Buffer.from(body) : body;

  const result = await cosClient.putObject(
    removeUndefinedFields(
      withBucket({
        Key: scopedKey,
        Body: normalizedBody,
        ContentLength: Buffer.isBuffer(normalizedBody) ? normalizedBody.length : undefined,
        ContentType: contentType,
        ...toMetaHeaders(metadata)
      })
    )
  );

  return {
    ...result,
    scope,
    scopedKey,
    key: stripScopePrefix(scopedKey, scope),
    url: toAbsoluteUrl(result.Location)
  };
}

async function putText({ scope = COS_SCOPES.ROOT, key, text, contentType = 'text/plain; charset=utf-8', metadata }) {
  return putObject({
    scope,
    key,
    body: text,
    contentType,
    metadata
  });
}

async function putJson({ scope = COS_SCOPES.ROOT, key, data, space = 2, metadata = {} }) {
  const jsonText = JSON.stringify(data, null, space);

  return putObject({
    scope,
    key,
    body: jsonText,
    contentType: 'application/json; charset=utf-8',
    metadata
  });
}

async function getObjectBuffer({ scope = COS_SCOPES.ROOT, key }) {
  const scopedKey = buildScopedKey(key, scope);
  const result = await cosClient.getObject(withBucket({ Key: scopedKey }));

  return {
    ...result,
    scope,
    scopedKey,
    key: stripScopePrefix(scopedKey, scope),
    body: result.Body
  };
}

async function getObjectText({ scope = COS_SCOPES.ROOT, key, encoding = 'utf8' }) {
  const result = await getObjectBuffer({ scope, key });

  return {
    ...result,
    text: result.body.toString(encoding)
  };
}

async function getObjectJson({ scope = COS_SCOPES.ROOT, key, encoding = 'utf8' }) {
  const result = await getObjectText({ scope, key, encoding });

  return {
    ...result,
    data: JSON.parse(result.text)
  };
}

async function deleteObject({ scope = COS_SCOPES.ROOT, key }) {
  const scopedKey = buildScopedKey(key, scope);
  const result = await cosClient.deleteObject(withBucket({ Key: scopedKey }));

  return {
    ...result,
    scope,
    scopedKey,
    key: stripScopePrefix(scopedKey, scope)
  };
}

async function uploadFile({ scope = COS_SCOPES.ROOT, key, filePath, sliceSize, metadata = {} }) {
  const scopedKey = buildScopedKey(key, scope);
  const result = await cosClient.uploadFile(
    removeUndefinedFields(
      withBucket({
        Key: scopedKey,
        FilePath: filePath,
        SliceSize: sliceSize,
        ...toMetaHeaders(metadata)
      })
    )
  );

  return {
    ...result,
    scope,
    scopedKey,
    key: stripScopePrefix(scopedKey, scope),
    url: toAbsoluteUrl(result.Location)
  };
}

async function downloadFile({ scope = COS_SCOPES.ROOT, key, filePath, chunkSize, parallelLimit, retryTimes }) {
  const scopedKey = buildScopedKey(key, scope);

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

  const result = await cosClient.downloadFile(
    removeUndefinedFields(
      withBucket({
        Key: scopedKey,
        FilePath: filePath,
        ChunkSize: chunkSize,
        ParallelLimit: parallelLimit,
        RetryTimes: retryTimes
      })
    )
  );

  return {
    ...result,
    scope,
    scopedKey,
    key: stripScopePrefix(scopedKey, scope),
    filePath
  };
}

function getSignedUrl({ scope = COS_SCOPES.ROOT, key, method = 'GET', expires = 900, query, queryString }) {
  const scopedKey = buildScopedKey(key, scope);

  return cosClient.getObjectUrl(
    removeUndefinedFields(
      withBucket({
        Key: scopedKey,
        Sign: true,
        Method: method,
        Expires: expires,
        Query: query,
        QueryString: queryString
      })
    )
  );
}

const cosService = {
  config: cosConfig,
  scopes: COS_SCOPES,
  ping,
  listObjects,
  listAllObjects,
  headObject,
  existsObject,
  putObject,
  putText,
  putJson,
  getObjectBuffer,
  getObjectText,
  getObjectJson,
  deleteObject,
  uploadFile,
  downloadFile,
  getSignedUrl,
  resolveKey(key, scope = COS_SCOPES.ROOT) {
    return buildScopedKey(key, scope);
  }
};

module.exports = {
  cosService
};
