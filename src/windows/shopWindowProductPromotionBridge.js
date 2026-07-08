const { normalizeText } = require('../services/shopManagement/common');

function buildProductPromotionActivityLoginOpenerBridgeScript(payload) {
  const runtimePayload = JSON.stringify({
    bridgeHashKey: normalizeText(payload && payload.bridgeHashKey),
    adsLoginUrl: normalizeText(payload && payload.adsLoginUrl)
  });

  return `
    (() => {
      const bridgePayload = ${runtimePayload};

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function resolveActivitySourceUrl() {
        try {
          const currentUrl = new URL(window.location.href);
          const rawSource = normalizeText(currentUrl.searchParams.get('source'));

          if (!rawSource) {
            return '';
          }

          const parsedSource = new URL(rawSource);

          if (!/^https?:$/i.test(parsedSource.protocol)) {
            return '';
          }

          parsedSource.hash = '';
          return parsedSource.toString();
        } catch (_error) {
          return '';
        }
      }

      function buildAnonymousLoginUrl(message) {
        const targetUrl = resolveActivitySourceUrl() || normalizeText(bridgePayload.adsLoginUrl);

        if (!targetUrl) {
          return '';
        }

        const nextUrl = new URL(targetUrl);
        const ticket = normalizeText(message && message.code);
        const mallId = normalizeText(message && message.mallId);

        if (!ticket || !mallId) {
          return '';
        }

        nextUrl.hash = '';
        nextUrl.searchParams.set('ticket', ticket);
        nextUrl.searchParams.set('mallId', mallId);
        nextUrl.searchParams.set('mallType', '2');
        nextUrl.searchParams.set('userType', '1');
        nextUrl.searchParams.set('seller_source', '50');
        nextUrl.searchParams.set('adAreaOverride', '2');

        return nextUrl.toString();
      }

      function handleBridgeMessage(message) {
        const action = Number(message && message.action) || 0;
        const targetUrl = action === 1
          ? buildAnonymousLoginUrl(message)
          : (resolveActivitySourceUrl() || normalizeText(bridgePayload.adsLoginUrl));

        if (!targetUrl) {
          return false;
        }

        window.location.replace(targetUrl);
        return true;
      }

      const fakeOpener = {
        closed: false,
        postMessage(message) {
          return handleBridgeMessage(message);
        }
      };

      try {
        Object.defineProperty(window, 'opener', {
          configurable: true,
          enumerable: false,
          get() {
            return fakeOpener;
          },
          set() {}
        });
      } catch (_error) {
        try {
          window.opener = fakeOpener;
        } catch (__error) {
          return {
            status: 'install-failed'
          };
        }
      }

      window.__TEMU_TOOLBOX_ACTIVITY_LOGIN_BRIDGE__ = {
        installedAt: Date.now(),
        adsLoginUrl: normalizeText(bridgePayload.adsLoginUrl),
        sourceUrl: resolveActivitySourceUrl()
      };

      return {
        status: 'installed',
        adsLoginUrl: normalizeText(bridgePayload.adsLoginUrl),
        sourceUrl: resolveActivitySourceUrl()
      };
    })();
  `;
}

function buildProductPromotionBridgeLoginScript(payload) {
  const runtimePayload = JSON.stringify({
    bridgeHashKey: normalizeText(payload && payload.bridgeHashKey)
  });

  return `
    (() => {
      const bridgePayload = ${runtimePayload};

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function parseBridgeMessage() {
        const rawHash = normalizeText(window.location && window.location.hash).replace(/^#/, '');

        if (!rawHash) {
          return null;
        }

        const hashParams = new URLSearchParams(rawHash);
        const encodedPayload = normalizeText(hashParams.get(bridgePayload.bridgeHashKey));

        if (!encodedPayload) {
          return null;
        }

        try {
          return JSON.parse(encodedPayload);
        } catch (_error) {
          return null;
        }
      }

      function buildAnonymousLoginUrl(message) {
        const ticket = normalizeText(message && message.code);
        const mallId = normalizeText(message && message.mallId);

        if (!ticket || !mallId) {
          return '';
        }

        const nextUrl = new URL(window.location.href);

        nextUrl.hash = '';
        nextUrl.searchParams.set('ticket', ticket);
        nextUrl.searchParams.set('mallId', mallId);
        nextUrl.searchParams.set('mallType', '2');
        nextUrl.searchParams.set('userType', '1');
        nextUrl.searchParams.set('seller_source', '50');
        nextUrl.searchParams.set('adAreaOverride', '2');

        return nextUrl.toString();
      }

      return (() => {
        const message = parseBridgeMessage();

        if (!message) {
          return {
            status: 'missing-bridge-payload'
          };
        }

        const ticket = normalizeText(message.code);
        const mallId = normalizeText(message.mallId);
        const payloadKey = [ticket, mallId].filter(Boolean).join('|');

        if (!ticket || !mallId) {
          return {
            status: 'invalid-bridge-payload',
            message
          };
        }

        const targetUrl = buildAnonymousLoginUrl(message);

        if (!targetUrl) {
          return {
            status: 'invalid-target-url',
            payloadKey,
            message
          };
        }

        window.location.replace(targetUrl);

        return {
          status: 'navigating',
          payloadKey,
          targetUrl
        };
      })();
    })();
  `;
}

module.exports = {
  buildProductPromotionActivityLoginOpenerBridgeScript,
  buildProductPromotionBridgeLoginScript
};
