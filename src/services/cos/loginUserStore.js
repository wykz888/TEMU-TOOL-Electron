const { COS_SCOPES } = require('./config');
const { cosService } = require('./cosService');

const LOGIN_USER_SCOPE = COS_SCOPES.LOGIN_USER;

const loginUserCosStore = {
  scope: LOGIN_USER_SCOPE,
  list(options = {}) {
    return cosService.listObjects({
      ...options,
      scope: LOGIN_USER_SCOPE
    });
  },
  listAll(options = {}) {
    return cosService.listAllObjects({
      ...options,
      scope: LOGIN_USER_SCOPE
    });
  },
  exists(key) {
    return cosService.existsObject({
      scope: LOGIN_USER_SCOPE,
      key
    });
  },
  head(key) {
    return cosService.headObject({
      scope: LOGIN_USER_SCOPE,
      key
    });
  },
  saveJson(key, data, options = {}) {
    return cosService.putJson({
      ...options,
      scope: LOGIN_USER_SCOPE,
      key,
      data
    });
  },
  saveText(key, text, options = {}) {
    return cosService.putText({
      ...options,
      scope: LOGIN_USER_SCOPE,
      key,
      text
    });
  },
  readJson(key) {
    return cosService.getObjectJson({
      scope: LOGIN_USER_SCOPE,
      key
    });
  },
  readText(key) {
    return cosService.getObjectText({
      scope: LOGIN_USER_SCOPE,
      key
    });
  },
  remove(key) {
    return cosService.deleteObject({
      scope: LOGIN_USER_SCOPE,
      key
    });
  },
  uploadFile(key, filePath, options = {}) {
    return cosService.uploadFile({
      ...options,
      scope: LOGIN_USER_SCOPE,
      key,
      filePath
    });
  },
  downloadFile(key, filePath, options = {}) {
    return cosService.downloadFile({
      ...options,
      scope: LOGIN_USER_SCOPE,
      key,
      filePath
    });
  },
  getSignedUrl(key, options = {}) {
    return cosService.getSignedUrl({
      ...options,
      scope: LOGIN_USER_SCOPE,
      key
    });
  },
  resolveKey(key) {
    return cosService.resolveKey(key, LOGIN_USER_SCOPE);
  }
};

module.exports = {
  loginUserCosStore
};

