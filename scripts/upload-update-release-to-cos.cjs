const fs = require('node:fs');
const path = require('node:path');
const COS = require('cos-nodejs-sdk-v5');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const { cosConfig } = require(path.join(rootDir, 'src', 'services', 'cos', 'config.js'));

const releaseHistorySource = path.join(rootDir, 'resources', 'release-history.json');
const releaseHistoryFileName = 'release-history.json';
const releaseDir = path.resolve(rootDir, process.env.TEMU_RELEASE_DIR || 'release');
const config = {
  secretId: process.env.TEMU_COS_SECRET_ID || process.env.COS_SECRET_ID || cosConfig.secretId,
  secretKey: process.env.TEMU_COS_SECRET_KEY || process.env.COS_SECRET_KEY || cosConfig.secretKey,
  region: process.env.TEMU_COS_REGION || cosConfig.region || 'ap-guangzhou',
  bucket: process.env.TEMU_COS_BUCKET || cosConfig.bucket || 'item-1251234463',
  baseUrl: process.env.TEMU_UPDATE_BASE_URL || `https://${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com`,
  prefix: normalizePrefix(process.env.TEMU_UPDATE_PREFIX || 'TEMU_Data_Electron/App_Update/win')
};

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  assertConfig();

  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Release directory does not exist: ${releaseDir}`);
  }

  const currentRelease = prepareReleaseHistory();
  writeLatestYmlReleaseNotes(currentRelease);

  const files = getReleaseFiles();
  if (!files.some((fileName) => fileName.toLowerCase() === 'latest.yml')) {
    throw new Error('latest.yml was not found in release directory');
  }

  const client = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey
  });
  const orderedFiles = files
    .filter((fileName) => fileName.toLowerCase() !== 'latest.yml')
    .concat('latest.yml');

  for (const fileName of orderedFiles) {
    await uploadFile(client, fileName);
  }

  console.log(`[release] ${packageJson.name}@${packageJson.version} uploaded`);
  console.log(`[release] feed: ${config.baseUrl}/${encodeCosKey(joinKey(config.prefix, 'latest.yml'))}`);
}

function getReleaseFiles() {
  return fs.readdirSync(releaseDir)
    .filter((fileName) => {
      const filePath = path.join(releaseDir, fileName);

      if (!fs.statSync(filePath).isFile()) {
        return false;
      }

      const lower = fileName.toLowerCase();

      return (
        lower === 'latest.yml'
        || lower === releaseHistoryFileName
        || lower.endsWith('.exe')
        || lower.endsWith('.blockmap')
      );
    })
    .sort((left, right) => {
      if (left.toLowerCase() === 'latest.yml') {
        return 1;
      }

      if (right.toLowerCase() === 'latest.yml') {
        return -1;
      }

      return left.localeCompare(right);
    });
}

async function uploadFile(client, fileName) {
  const filePath = path.join(releaseDir, fileName);
  const key = joinKey(config.prefix, fileName);

  await client.uploadFile({
    Bucket: config.bucket,
    Region: config.region,
    Key: key,
    FilePath: filePath,
    SliceSize: 1024 * 1024 * 8,
    ACL: 'public-read',
    ContentType: contentTypeFor(fileName)
  });

  console.log(`[release] uploaded ${fileName} -> ${config.baseUrl}/${encodeCosKey(key)}`);
}

function contentTypeFor(fileName) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.yml')) {
    return 'text/yaml; charset=utf-8';
  }

  if (lower.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }

  if (lower.endsWith('.exe')) {
    return 'application/vnd.microsoft.portable-executable';
  }

  return 'application/octet-stream';
}

function prepareReleaseHistory() {
  if (!fs.existsSync(releaseHistorySource)) {
    throw new Error(`Release history file does not exist: ${releaseHistorySource}`);
  }

  const payload = JSON.parse(fs.readFileSync(releaseHistorySource, 'utf8'));
  const items = Array.isArray(payload.items) ? payload.items : [];
  const currentRelease = items.find((item) => String(item && item.version || '').trim() === packageJson.version);

  if (!currentRelease) {
    throw new Error(`release-history.json does not contain current version ${packageJson.version}`);
  }

  fs.copyFileSync(releaseHistorySource, path.join(releaseDir, releaseHistoryFileName));
  return normalizeReleaseItem(currentRelease);
}

function writeLatestYmlReleaseNotes(currentRelease) {
  const latestYmlPath = path.join(releaseDir, 'latest.yml');

  if (!fs.existsSync(latestYmlPath)) {
    return;
  }

  const source = fs.readFileSync(latestYmlPath, 'utf8');
  const stripped = stripYamlFields(source, ['releaseName', 'releaseNotes']).trimEnd();
  const notes = currentRelease.notes.length ? currentRelease.notes : [currentRelease.title].filter(Boolean);
  const nextContent = [
    stripped,
    `releaseName: ${JSON.stringify(currentRelease.title || currentRelease.version)}`,
    'releaseNotes: |-',
    ...notes.map((note) => `  ${'\u2022'} ${note}`)
  ].join('\n') + '\n';

  fs.writeFileSync(latestYmlPath, nextContent, 'utf8');
}

function stripYamlFields(source, fieldNames) {
  const lines = source.split(/\r?\n/);
  const result = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fieldName = fieldNames.find((name) => line.startsWith(`${name}:`));

    if (!fieldName) {
      result.push(line);
      continue;
    }

    if (line.includes('|')) {
      while (index + 1 < lines.length && (lines[index + 1].startsWith(' ') || lines[index + 1].trim() === '')) {
        index += 1;
      }
    }
  }

  return result.join('\n');
}

function normalizeReleaseItem(item) {
  const notes = Array.isArray(item.notes)
    ? item.notes.map((note) => String(note || '').trim()).filter(Boolean)
    : [];

  return {
    version: String(item.version || '').trim(),
    title: String(item.title || '').trim(),
    notes
  };
}

function assertConfig() {
  if (!config.secretId || !config.secretKey) {
    throw new Error('COS credentials were not found');
  }
}

function normalizePrefix(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function joinKey(...segments) {
  return segments
    .map((segment) => normalizePrefix(segment))
    .filter(Boolean)
    .join('/');
}

function encodeCosKey(key) {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}
