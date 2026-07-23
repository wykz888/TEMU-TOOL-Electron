const assert = require('node:assert/strict');
const {
  resolveShopDetailProxyConfig
} = require('../src/services/shopManagement/shopDetailProxyConfig');

function validateLocalProxyDoesNotFallbackToOldSummary() {
  const proxyConfig = resolveShopDetailProxyConfig(
    {
      type: 'local',
      host: '',
      port: '',
      username: '',
      password: '',
      bypassRules: '',
      directResourceTypes: {}
    },
    {
      type: 'http',
      host: '10.0.0.1',
      port: '8080',
      username: 'old-user',
      password: '',
      bypassRules: '<local>',
      directResourceTypes: {
        image: true
      }
    }
  );

  assert.deepEqual(proxyConfig, {
    type: 'local',
    host: '',
    port: '',
    username: '',
    password: '',
    bypassRules: '',
    directResourceTypes: {
      script: false,
      style: false,
      font: false,
      image: false,
      video: false
    }
  });
}

function validateMissingDetailStillUsesSummaryFallback() {
  const proxyConfig = resolveShopDetailProxyConfig(
    {},
    {
      type: 'socks5',
      host: '127.0.0.1',
      port: '7001',
      username: 'proxy-user',
      password: '',
      bypassRules: '<local>',
      directResourceTypes: {
        script: true
      }
    }
  );

  assert.equal(proxyConfig.type, 'socks5');
  assert.equal(proxyConfig.host, '127.0.0.1');
  assert.equal(proxyConfig.port, '7001');
  assert.equal(proxyConfig.username, 'proxy-user');
  assert.equal(proxyConfig.directResourceTypes.script, true);
}

function main() {
  validateLocalProxyDoesNotFallbackToOldSummary();
  validateMissingDetailStillUsesSummaryFallback();
  console.log('shop runtime proxy rule validation passed');
}

main();
