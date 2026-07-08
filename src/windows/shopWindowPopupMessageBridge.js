const { normalizeText } = require('../services/shopManagement/common');

function buildPopupMessageCaptureOpenerBridgeScript(payload) {
  const runtimePayload = JSON.stringify({
    hashKey: normalizeText(payload && payload.hashKey)
  });

  return `
    (() => {
      const runtimePayload = ${runtimePayload};

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function captureMessage(message) {
        const hashKey = normalizeText(runtimePayload.hashKey);

        if (!hashKey) {
          return {
            status: 'missing-hash-key'
          };
        }

        let encodedPayload = '';

        try {
          encodedPayload = encodeURIComponent(JSON.stringify(message || {}));
        } catch (_error) {
          return {
            status: 'serialize-failed'
          };
        }

        const nextUrl = new URL(window.location.href);

        nextUrl.hash = '';
        nextUrl.hash = \`\${hashKey}=\${encodedPayload}\`;
        window.location.replace(nextUrl.toString());

        return {
          status: 'captured',
          targetUrl: nextUrl.toString()
        };
      }

      const fakeOpener = {
        closed: false,
        postMessage(message) {
          return captureMessage(message);
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

      window.__TEMU_TOOLBOX_POPUP_MESSAGE_BRIDGE__ = {
        installedAt: Date.now(),
        hashKey: normalizeText(runtimePayload.hashKey)
      };

      return {
        status: 'installed',
        hashKey: normalizeText(runtimePayload.hashKey)
      };
    })();
  `;
}

function buildPopupMessageDispatchScript(payload) {
  const runtimePayload = JSON.stringify({
    message:
      payload && payload.message && typeof payload.message === 'object'
        ? payload.message
        : null
  });

  return `
    (() => {
      const runtimePayload = ${runtimePayload};
      const message = runtimePayload.message;

      if (!message || typeof message !== 'object') {
        return {
          status: 'missing-message'
        };
      }

      try {
        window.postMessage(message, '*');

        return {
          status: 'posted',
          currentUrl: String(window.location.href || ''),
          message
        };
      } catch (_error) {
        try {
          const event = new MessageEvent('message', {
            data: message,
            origin: String(window.location.origin || '')
          });

          window.dispatchEvent(event);

          return {
            status: 'dispatched',
            currentUrl: String(window.location.href || ''),
            message
          };
        } catch (__error) {
          return {
            status: 'dispatch-failed'
          };
        }
      }
    })();
  `;
}

module.exports = {
  buildPopupMessageCaptureOpenerBridgeScript,
  buildPopupMessageDispatchScript
};
