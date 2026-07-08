const { normalizeText } = require('../shopManagement/common');

const RATE_LIMIT_MESSAGE_PATTERN = /too\s+many\s+visitors|too\s+many\s+requests|rate\s*limit|visit\s+too\s+frequent|access\s+too\s+frequent|\u8bbf\u95ee\u8fc7\u4e8e\u9891\u7e41|\u62a5\u540d\u5546\u54c1\u91cf\u8fc7\u4e8e\u706b\u7206|\u8fc7\u4e8e\u706b\u7206|\u8bf7\u7a0d\u540e(?:\u518d\u8bd5|\u91cd\u8bd5)/i;
const HOT_SUBMIT_RATE_LIMIT_MESSAGE_PATTERN = /\u62a5\u540d\u5546\u54c1\u91cf\u8fc7\u4e8e\u706b\u7206|\u8fc7\u4e8e\u706b\u7206/i;
const AUTH_REQUIRED_MESSAGE_PATTERN = /authorization|login|logout|expired|offline|unauthorized|forbidden|signin|sign in|relogin|auth|\u767b\u5f55|\u672a\u767b\u5f55|\u8bf7\u5148\u767b\u5f55|\u91cd\u65b0\u767b\u5f55|\u4f1a\u8bdd\u5df2\u5931\u6548|\u6388\u6743/i;
const PRODUCT_LIST_SIZE_MESSAGE_PATTERN = /product\s+list\s+size\s+must\s+in\s*\[\s*1\s*,\s*30\s*\]/i;

function isRateLimitErrorMessage(message) {
  return RATE_LIMIT_MESSAGE_PATTERN.test(normalizeText(message));
}

function isHotSubmitRateLimitErrorMessage(message) {
  return HOT_SUBMIT_RATE_LIMIT_MESSAGE_PATTERN.test(normalizeText(message));
}

function shouldSplitFlowPriceSubmitErrorMessage(message) {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    return true;
  }

  if (AUTH_REQUIRED_MESSAGE_PATTERN.test(normalizedMessage)) {
    return false;
  }

  if (PRODUCT_LIST_SIZE_MESSAGE_PATTERN.test(normalizedMessage)) {
    return false;
  }

  return true;
}

module.exports = {
  AUTH_REQUIRED_MESSAGE_PATTERN,
  isHotSubmitRateLimitErrorMessage,
  isRateLimitErrorMessage,
  shouldSplitFlowPriceSubmitErrorMessage
};
