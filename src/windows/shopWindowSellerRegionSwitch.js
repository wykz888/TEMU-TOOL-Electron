const { normalizeText } = require('../services/shopManagement/common');

function buildSellerRegionContextRequestScript(payload) {
  const runtimePayload = JSON.stringify({
    requestPath: normalizeText(payload && payload.requestPath),
    method: normalizeText(payload && payload.method),
    referrer: normalizeText(payload && payload.referrer),
    headers:
      payload && payload.headers && typeof payload.headers === 'object'
        ? { ...payload.headers }
        : {},
    body:
      payload && Object.prototype.hasOwnProperty.call(payload, 'body')
        ? payload.body
        : null
  });

  return `
    (() => {
      const runtimePayload = ${runtimePayload};

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function buildResponse(status, extra) {
        return {
          status,
          currentUrl: normalizeText(window.location && window.location.href),
          origin: normalizeText(window.location && window.location.origin),
          ...(extra && typeof extra === 'object' ? extra : {})
        };
      }

      const requestPath = normalizeText(runtimePayload.requestPath);
      const requestMethod = normalizeText(runtimePayload.method).toUpperCase() || 'POST';
      const requestUrl = requestPath
        ? new URL(requestPath, window.location.origin).toString()
        : '';
      const requestHeaders =
        runtimePayload.headers && typeof runtimePayload.headers === 'object'
          ? { ...runtimePayload.headers }
          : {};
      const requestInit = {
        method: requestMethod,
        credentials: 'include',
        cache: 'no-store',
        headers: requestHeaders
      };

      if (normalizeText(runtimePayload.referrer)) {
        requestInit.referrer = normalizeText(runtimePayload.referrer);
      }

      if (runtimePayload.body !== null && runtimePayload.body !== undefined) {
        requestInit.body = JSON.stringify(runtimePayload.body);
      }

      if (!requestUrl) {
        return buildResponse('missing-request-url', {
          ok: false,
          requestUrl: ''
        });
      }

      return window.fetch(requestUrl, requestInit)
        .then(async (response) => {
          const responseText = await response.text();
          let data = null;

          try {
            data = responseText ? JSON.parse(responseText) : null;
          } catch (_error) {
            data = null;
          }

          const success = data && Object.prototype.hasOwnProperty.call(data, 'success')
            ? Boolean(data.success)
            : null;
          const responseCode = data && Object.prototype.hasOwnProperty.call(data, 'errorCode')
            ? Number(data.errorCode)
            : null;
          const responseMessage = normalizeText(
            data && (
              data.message
              || data.msg
              || data.errorMsg
              || data.errorMessage
            )
          );

          return buildResponse('completed', {
            ok: Boolean(response.ok) && success !== false,
            httpStatus: Number(response.status) || 0,
            finalUrl: normalizeText(response.url) || requestUrl,
            requestUrl,
            success,
            errorCode: Number.isFinite(responseCode) ? responseCode : null,
            message: responseMessage,
            responseTextPreview: normalizeText(responseText).slice(0, 280),
            data
          });
        })
        .catch((error) => buildResponse('error', {
          ok: false,
          requestUrl,
          message: normalizeText(error && error.message),
          errorMessage: normalizeText(error && error.message),
          responseTextPreview: ''
        }));
    })();
  `;
}

module.exports = {
  buildSellerRegionContextRequestScript
};
