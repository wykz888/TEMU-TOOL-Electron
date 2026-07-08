const COS_SCOPES = Object.freeze({
  ROOT: 'root',
  LOGIN_USER: 'loginUser'
});

const SCOPE_PREFIXES = Object.freeze({
  [COS_SCOPES.ROOT]: 'TEMU_Data_Electron',
  [COS_SCOPES.LOGIN_USER]: 'TEMU_Data_Electron/login_user'
});

const cosConfig = Object.freeze({
  // Embedded by request. Replace with short-lived credentials before external distribution.
  secretId: 'AKIDTmlBIHDV07iNej9lUJdFdOgQeRtyK4UK',
  secretKey: 'ovuuLK41bnINtvX7tCJzOFHk7nNZJJzV',
  bucket: 'item-1251234463',
  region: 'ap-guangzhou',
  protocol: 'https:',
  timeout: 30000,
  scopePrefixes: SCOPE_PREFIXES
});

module.exports = {
  cosConfig,
  COS_SCOPES,
  SCOPE_PREFIXES
};

