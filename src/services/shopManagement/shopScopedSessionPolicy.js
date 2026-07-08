const { session } = require('electron');
const { normalizeText } = require('./common');

const SHOP_SCOPED_SESSION_POLICY_ERROR_CODE = 'SHOP_SCOPED_SESSION_PARTITION_REQUIRED';
const DEFAULT_POLICY_MESSAGE = '\u5f53\u524d\u8bf7\u6c42\u7f3a\u5c11\u5e97\u94fa\u4f1a\u8bdd\u5206\u533a\uff0c\u5df2\u963b\u6b62\u56de\u9000\u5230 defaultSession\u3002\u8bf7\u5148\u6253\u5f00\u5bf9\u5e94\u5e97\u94fa\u5e76\u786e\u8ba4\u5df2\u767b\u5f55\u540e\u91cd\u8bd5\u3002';

function createShopScopedSessionPolicy({ runtimeLogger, scope } = {}) {
  const normalizedScope = normalizeText(scope) || 'shop-scoped-session';

  function recordViolation(reason, details = {}) {
    if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
      return;
    }

    runtimeLogger.log('shop_scoped_session_default_session_blocked', {
      scope: normalizedScope,
      reason: normalizeText(reason),
      shopId: normalizeText(details.shopId),
      shopName: normalizeText(details.shopName),
      partition: normalizeText(details.partition),
      origin: normalizeText(details.origin),
      requestUrl: normalizeText(details.requestUrl),
      message: normalizeText(details.message) || DEFAULT_POLICY_MESSAGE
    });
  }

  function createPolicyError(reason, details = {}) {
    const error = new Error(
      normalizeText(details.message) || DEFAULT_POLICY_MESSAGE
    );

    error.code = SHOP_SCOPED_SESSION_POLICY_ERROR_CODE;
    error.shopScopedSessionRequired = true;
    error.policyScope = normalizedScope;
    error.policyReason = normalizeText(reason);
    error.shopId = normalizeText(details.shopId);
    error.shopName = normalizeText(details.shopName);
    error.partition = normalizeText(details.partition);
    error.origin = normalizeText(details.origin);
    error.requestUrl = normalizeText(details.requestUrl);
    return error;
  }

  function fail(reason, details = {}) {
    const normalizedDetails = {
      ...details,
      partition: normalizeText(details.partition)
    };

    recordViolation(reason, normalizedDetails);
    throw createPolicyError(reason, normalizedDetails);
  }

  function resolveSession(partition, details = {}) {
    const normalizedPartition = normalizeText(partition);

    if (!normalizedPartition) {
      return fail('missing-partition', {
        ...details,
        partition: normalizedPartition
      });
    }

    return session.fromPartition(normalizedPartition);
  }

  function resolveSessionForFetch(partition, details = {}) {
    const targetSession = resolveSession(partition, details);

    if (!targetSession || typeof targetSession.fetch !== 'function') {
      return fail('missing-session-fetch', {
        ...details,
        partition: normalizeText(partition)
      });
    }

    return targetSession;
  }

  function resolveSessionForCookies(partition, details = {}) {
    const targetSession = resolveSession(partition, details);

    if (
      !targetSession
      || !targetSession.cookies
      || typeof targetSession.cookies.get !== 'function'
    ) {
      return fail('missing-session-cookies', {
        ...details,
        partition: normalizeText(partition)
      });
    }

    return targetSession;
  }

  return {
    resolveSession,
    resolveSessionForFetch,
    resolveSessionForCookies
  };
}

module.exports = {
  SHOP_SCOPED_SESSION_POLICY_ERROR_CODE,
  createShopScopedSessionPolicy
};
