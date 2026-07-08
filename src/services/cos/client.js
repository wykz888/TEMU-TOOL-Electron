const COS = require('cos-nodejs-sdk-v5');
const { cosConfig } = require('./config');

const cosClient = new COS({
  SecretId: cosConfig.secretId,
  SecretKey: cosConfig.secretKey,
  Protocol: cosConfig.protocol,
  Timeout: cosConfig.timeout,
  KeepAlive: true
});

function withBucket(params = {}) {
  return {
    Bucket: cosConfig.bucket,
    Region: cosConfig.region,
    ...params
  };
}

module.exports = {
  cosClient,
  withBucket
};

