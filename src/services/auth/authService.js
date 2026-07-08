const crypto = require('node:crypto');
const { loginUserCosStore } = require('../cos');

const PASSWORD_SETTINGS = Object.freeze({
  iterations: 120000,
  keyLength: 32,
  digest: 'sha256'
});

function normalizeUsername(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function normalizeDisplayUsername(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function validateUsername(username) {
  const normalizedUsername = normalizeDisplayUsername(username);

  if (!normalizedUsername) {
    throw new Error('\u8bf7\u8f93\u5165\u7528\u6237\u540d\u3002');
  }

  if (normalizedUsername.length < 3 || normalizedUsername.length > 64) {
    throw new Error('\u7528\u6237\u540d\u957f\u5ea6\u9700\u8981\u5728 3 \u5230 64 \u4e2a\u5b57\u7b26\u4e4b\u95f4\u3002');
  }

  return normalizedUsername;
}

function validatePassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new Error('\u8bf7\u8f93\u5165\u5bc6\u7801\u3002');
  }

  if (password.length < 6 || password.length > 128) {
    throw new Error('\u5bc6\u7801\u957f\u5ea6\u9700\u8981\u5728 6 \u5230 128 \u4e2a\u5b57\u7b26\u4e4b\u95f4\u3002');
  }

  return password;
}

function buildUserStorageKey(username) {
  const normalizedUsername = normalizeUsername(username);
  const userHash = crypto.createHash('sha256').update(normalizedUsername).digest('hex');

  return `users/${userHash}.json`;
}

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, PASSWORD_SETTINGS.iterations, PASSWORD_SETTINGS.keyLength, PASSWORD_SETTINGS.digest)
    .toString('hex');
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');

  return {
    salt,
    hash: hashPassword(password, salt),
    iterations: PASSWORD_SETTINGS.iterations,
    keyLength: PASSWORD_SETTINGS.keyLength,
    digest: PASSWORD_SETTINGS.digest
  };
}

function verifyPassword(password, passwordRecord) {
  const expectedHash = Buffer.from(passwordRecord.hash, 'hex');
  const actualHash = Buffer.from(hashPassword(password, passwordRecord.salt), 'hex');

  return expectedHash.length === actualHash.length && crypto.timingSafeEqual(expectedHash, actualHash);
}

function toPublicUser(userRecord) {
  return {
    userId: userRecord.userId,
    username: userRecord.username,
    createdAt: userRecord.createdAt
  };
}

function toSession(userRecord) {
  return {
    userId: userRecord.userId,
    username: userRecord.username,
    loggedInAt: new Date().toISOString()
  };
}

async function getUserRecordByUsername(username) {
  const storageKey = buildUserStorageKey(username);
  const result = await loginUserCosStore.readJson(storageKey);

  return {
    storageKey,
    userRecord: result.data
  };
}

async function registerUser({ username, password, confirmPassword }) {
  const safeUsername = validateUsername(username);
  const safePassword = validatePassword(password);

  if (safePassword !== confirmPassword) {
    throw new Error('\u4e24\u6b21\u8f93\u5165\u7684\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002');
  }

  const storageKey = buildUserStorageKey(safeUsername);
  const exists = await loginUserCosStore.exists(storageKey);

  if (exists) {
    throw new Error('\u8be5\u7528\u6237\u540d\u5df2\u5b58\u5728\u3002');
  }

  const normalizedUsername = normalizeUsername(safeUsername);
  const timestamp = new Date().toISOString();
  const userRecord = {
    version: 1,
    userId: crypto.createHash('sha256').update(normalizedUsername).digest('hex'),
    username: safeUsername,
    normalizedUsername,
    password: createPasswordRecord(safePassword),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await loginUserCosStore.saveJson(storageKey, userRecord);

  return toPublicUser(userRecord);
}

async function loginUser({ username, password }) {
  const safeUsername = validateUsername(username);
  const safePassword = validatePassword(password);

  let userRecord;

  try {
    ({ userRecord } = await getUserRecordByUsername(safeUsername));
  } catch (_error) {
    throw new Error('\u8d26\u53f7\u6216\u5bc6\u7801\u9519\u8bef\u3002');
  }

  if (!userRecord || !userRecord.password || !verifyPassword(safePassword, userRecord.password)) {
    throw new Error('\u8d26\u53f7\u6216\u5bc6\u7801\u9519\u8bef\u3002');
  }

  return toSession(userRecord);
}

const authService = {
  registerUser,
  loginUser,
  buildUserStorageKey
};

module.exports = {
  authService
};

