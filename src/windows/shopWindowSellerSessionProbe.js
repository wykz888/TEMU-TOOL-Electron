function buildSellerSessionStatusProbeScript() {
  return `
    (() => {
      const runningKey = '__TEMU_TOOLBOX_SELLER_SESSION_PROBE__';
      const sellerCenterEndpointResolvers = [
        {
          pattern: /(^|\\.)seller\\.kuajingmaihuo\\.com$/i,
          requestPath: '/bg/quiet/api/mms/userInfo',
          responseType: 'mms-user-info'
        },
        {
          pattern: /(^|\\.)agentseller(?:-[a-z]+)?\\.temu\\.com$/i,
          requestPath: '/api/seller/auth/userInfo',
          responseType: 'seller-auth-user-info'
        }
      ];

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function normalizeNumericValue(value) {
        if (value === null || value === undefined || value === '') {
          return '';
        }

        return String(value).trim();
      }

      function normalizeMallRecord(mall) {
        return {
          mallId: normalizeNumericValue(
            mall && (
              mall.mallId
              || mall.mallID
              || mall.id
              || mall.shopId
              || mall.shopID
            )
          ),
          mallName: normalizeText(
            mall && (
              mall.mallName
              || mall.shopName
              || mall.name
              || mall.mallTitle
            )
          ),
          uniqueId: normalizeText(
            mall && (
              mall.uniqueId
              || mall.uniqueID
              || mall.mallUniqueId
              || mall.mallUniqueID
            )
          )
        };
      }

      function collectSellerAuthMalls(payload) {
        const mallList = Array.isArray(payload && payload.result && payload.result.mallList)
          ? payload.result.mallList
          : [];

        return mallList
          .map((mall) => normalizeMallRecord(mall))
          .filter((mall) => mall.mallName)
          .slice(0, 20);
      }

      function getMmsResult(payload) {
        if (payload && payload.result && typeof payload.result === 'object') {
          return payload.result;
        }

        if (payload && payload.res && typeof payload.res === 'object') {
          return payload.res;
        }

        return null;
      }

      function collectMmsMalls(payload) {
        const result = getMmsResult(payload);
        const companyList = Array.isArray(result && result.companyList)
          ? result.companyList
          : [];
        const malls = [];

        companyList.forEach((company) => {
          const mallList = Array.isArray(company && company.malInfoList)
            ? company.malInfoList
            : [];

          mallList.forEach((mall) => {
            const normalizedMall = normalizeMallRecord(mall);

            if (normalizedMall.mallName) {
              malls.push(normalizedMall);
            }
          });
        });

        return malls.slice(0, 20);
      }

      function getMmsCompanyCount(payload) {
        const result = getMmsResult(payload);
        const companyList = Array.isArray(result && result.companyList)
          ? result.companyList
          : [];

        return companyList.length;
      }

      function hasMmsSessionContext(payload) {
        const result = getMmsResult(payload);

        if (!result || typeof result !== 'object') {
          return false;
        }

        return Boolean(
          normalizeText(result.userId)
          || normalizeText(result.accountType)
          || normalizeText(result.accountStatus)
          || normalizeText(result.tokenType)
          || normalizeText(result.maskMobile)
        );
      }

      function resolveEndpointConfig(hostname) {
        return sellerCenterEndpointResolvers.find((item) => item.pattern.test(hostname))
          || {
            pattern: null,
            requestPath: '/api/seller/auth/userInfo',
            responseType: 'seller-auth-user-info'
          };
      }

      function isSellerAuthOnline(response, payload, malls) {
        const hasExpectedErrorCode =
          !payload
          || !Object.prototype.hasOwnProperty.call(payload, 'errorCode')
          || Number(payload.errorCode) === 1000000;

        return (
          response.ok
          && payload
          && payload.success === true
          && hasExpectedErrorCode
          && malls.length > 0
        );
      }

      function isMmsOnline(response, payload, malls) {
        const statusCode = Number(
          payload && (
            payload.code
            || payload.status
            || payload.errorCode
          )
        );
        const normalizedMessage = normalizeText(
          payload && (
            payload.msg
            || payload.message
            || payload.errorMsg
          )
        ).toLowerCase();
        const companyCount = getMmsCompanyCount(payload);
        const hasSessionContext = hasMmsSessionContext(payload);

        if (!response.ok) {
          return false;
        }

        if (!payload || typeof payload !== 'object') {
          return false;
        }

        if (payload.success === false) {
          return false;
        }

        if (Number.isFinite(statusCode) && statusCode !== 0 && statusCode !== 200 && statusCode !== 1000000) {
          return false;
        }

        if (normalizedMessage && /unauthorized|forbidden|login|expired|offline/.test(normalizedMessage)) {
          return false;
        }

        return hasSessionContext || companyCount > 0 || malls.length > 0;
      }

      function finish(result) {
        window[runningKey] = false;
        return result;
      }

      if (window[runningKey]) {
        return Promise.resolve({
          status: 'busy'
        });
      }

      window[runningKey] = true;

      let origin = '';
      let hostname = '';

      try {
        origin = normalizeText(window.location && window.location.origin);
        hostname = normalizeText(window.location && window.location.hostname).toLowerCase();
      } catch (_error) {
        origin = '';
        hostname = '';
      }

      const endpointConfig = resolveEndpointConfig(hostname);
      const requestUrl = origin
        ? \`\${origin}\${endpointConfig.requestPath}\`
        : endpointConfig.requestPath;

      return window.fetch(requestUrl, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json;charset=UTF-8'
        },
        body: '{}'
      })
        .then(async (response) => {
          const responseText = await response.text();
          let payload = null;

          try {
            payload = responseText ? JSON.parse(responseText) : null;
          } catch (_error) {
            return finish({
              status: response.status === 401 || response.status === 403 ? 'offline' : 'invalid-response',
              origin,
              hostname,
              requestUrl,
              responseType: endpointConfig.responseType,
              httpStatus: response.status,
              responseTextPreview: normalizeText(responseText).slice(0, 160)
            });
          }

          const malls = endpointConfig.responseType === 'mms-user-info'
            ? collectMmsMalls(payload)
            : collectSellerAuthMalls(payload);
          const companyCount = endpointConfig.responseType === 'mms-user-info'
            ? getMmsCompanyCount(payload)
            : 0;
          const hasSessionContext = endpointConfig.responseType === 'mms-user-info'
            ? hasMmsSessionContext(payload)
            : false;
          const mallNames = malls.map((mall) => mall.mallName);
          const isOnline = endpointConfig.responseType === 'mms-user-info'
            ? isMmsOnline(response, payload, malls)
            : isSellerAuthOnline(response, payload, malls);

          return finish({
            status: isOnline ? 'online' : 'offline',
            origin,
            hostname,
            requestUrl,
            responseType: endpointConfig.responseType,
            httpStatus: response.status,
            success: Boolean(payload && payload.success),
            errorCode: payload && Object.prototype.hasOwnProperty.call(payload, 'errorCode')
              ? Number(payload.errorCode)
              : null,
            errorMsg: normalizeText(payload && payload.errorMsg),
            message: normalizeText(
              payload && (
                payload.msg
                || payload.message
                || payload.errorMsg
              )
            ),
            accountId: normalizeText(
              payload && (
                (payload.result && payload.result.accountId)
                || (payload.result && payload.result.userId)
                || (payload.res && payload.res.accountId)
                || (payload.res && payload.res.userId)
              )
            ),
            accountType: normalizeText(
              payload && (
                (payload.result && payload.result.accountType)
                || (payload.res && payload.res.accountType)
              )
            ),
            accountStatus: normalizeText(
              (payload && payload.result && payload.result.accountStatus)
                || (payload.res && payload.res.accountStatus)
            ),
            tokenType: normalizeText(
              (payload && payload.result && payload.result.tokenType)
              || (payload.res && payload.res.tokenType)
            ),
            companyCount,
            hasSessionContext,
            mallCount: mallNames.length,
            mallNames,
            malls
          });
        })
        .catch((error) => finish({
          status: 'error',
          origin,
          hostname,
          requestUrl,
          responseType: endpointConfig.responseType,
          errorMessage: normalizeText(error && error.message)
        }));
    })();
  `;
}

module.exports = {
  buildSellerSessionStatusProbeScript
};
