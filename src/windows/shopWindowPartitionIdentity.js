const crypto = require('node:crypto');
const path = require('node:path');
const { app } = require('electron');
const { resolveAccountIdentity } = require('../services/shopManagement/common');

function normalizePartitionSegment(value) {
  return String(value || '').trim().toLowerCase();
}

function buildPartitionIdentity(payload) {
  const accountIdentity = resolveAccountIdentity({
    phoneNumber: payload && payload.phoneNumber,
    email: payload && payload.email
  });
  const accountValue = normalizePartitionSegment(accountIdentity.accountValue);
  const shopId = normalizePartitionSegment(payload && payload.shopId);

  return accountValue || shopId || 'default-shop';
}

function hashPartitionIdentity(payload) {
  return crypto.createHash('sha256').update(buildPartitionIdentity(payload)).digest('hex').slice(0, 16);
}

function hashLegacyShopIdentity(shopId) {
  return crypto.createHash('sha256').update(String(shopId || '')).digest('hex').slice(0, 16);
}

function getPartition(payload) {
  return `persist:temu-toolbox-shop-${hashPartitionIdentity(payload)}`;
}

function getLegacyPartition(payload) {
  return `persist:temu-toolbox-shop-${hashLegacyShopIdentity(payload && payload.shopId)}`;
}

function getPartitionDirectory(partition) {
  return path.join(
    app.getPath('userData'),
    'Partitions',
    String(partition || '').replace(/^persist:/, '')
  );
}

module.exports = {
  buildPartitionIdentity,
  getLegacyPartition,
  getPartition,
  getPartitionDirectory,
  hashLegacyShopIdentity,
  hashPartitionIdentity,
  normalizePartitionSegment
};
