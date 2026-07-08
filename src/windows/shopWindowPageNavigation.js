const { normalizeText } = require('../services/shopManagement/common');

function buildPageLocationNavigationScript(payload) {
  const runtimePayload = JSON.stringify({
    targetUrl: normalizeText(payload && payload.targetUrl),
    mode: normalizeText(payload && payload.mode) || 'assign'
  });

  return `
    (() => {
      const navigationPayload = ${runtimePayload};

      function normalizeText(value) {
        return String(value || '').trim();
      }

      try {
        const targetUrl = normalizeText(navigationPayload.targetUrl);
        const mode = normalizeText(navigationPayload.mode).toLowerCase() === 'replace'
          ? 'replace'
          : 'assign';
        const currentUrl = normalizeText(window.location && window.location.href);

        if (!targetUrl) {
          return {
            status: 'missing-target',
            currentUrl
          };
        }

        if (currentUrl === targetUrl) {
          return {
            status: 'same-url',
            mode,
            currentUrl,
            targetUrl
          };
        }

        if (mode === 'replace' && window.location && typeof window.location.replace === 'function') {
          window.location.replace(targetUrl);
        } else if (window.location && typeof window.location.assign === 'function') {
          window.location.assign(targetUrl);
        } else {
          window.location.href = targetUrl;
        }

        return {
          status: 'navigating',
          mode,
          currentUrl,
          targetUrl,
          documentReferrer: normalizeText(document && document.referrer)
        };
      } catch (error) {
        return {
          status: 'error',
          message: normalizeText(error && error.message)
        };
      }
    })();
  `;
}

module.exports = {
  buildPageLocationNavigationScript
};
