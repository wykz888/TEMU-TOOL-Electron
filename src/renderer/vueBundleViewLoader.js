(function initVueBundleViewLoader(global) {
  function ensureVueProcessShim() {
    if (!global.process || typeof global.process !== 'object') {
      global.process = {};
    }

    if (!global.process.env || typeof global.process.env !== 'object') {
      global.process.env = {};
    }

    if (typeof global.process.env.NODE_ENV !== 'string') {
      global.process.env.NODE_ENV = 'production';
    }
  }

  function normalizeFallbackError(error, fallbackMessage) {
    if (!error || !error.message || !String(error.message).trim()) {
      return fallbackMessage;
    }

    const raw = String(error.message).trim();

    if (/[\u4e00-\u9fff]/u.test(raw)) {
      return raw;
    }

    if (
      /session/i.test(raw)
      || /partition/i.test(raw)
      || /IPC/i.test(raw)
      || /electron/i.test(raw)
      || /preload/i.test(raw)
      || /contextBridge/i.test(raw)
    ) {
      return fallbackMessage;
    }

    return fallbackMessage;
  }

  function resolveValue(value) {
    return typeof value === 'function' ? value() : value;
  }

  function getMountNode(mountTarget) {
    if (!mountTarget) {
      return null;
    }

    if (typeof mountTarget === 'string') {
      return document.querySelector(mountTarget);
    }

    return mountTarget;
  }

  function renderFallbackMessage(mountTarget, message, fallbackMessage) {
    const mountNode = getMountNode(mountTarget);

    if (!mountNode) {
      return;
    }

    mountNode.textContent = message || fallbackMessage || '\u52A0\u8F7D\u5931\u8D25\u3002';
  }

  function renderFallbackCardNode(mountTarget, title, detail) {
    const mountNode = getMountNode(mountTarget);

    if (!mountNode) {
      return;
    }

    mountNode.textContent = '';

    const shell = document.createElement('div');
    shell.style.cssText = [
      'box-sizing:border-box',
      'min-height:100vh',
      'display:grid',
      'place-items:center',
      'padding:18px'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'box-sizing:border-box',
      'width:100%',
      'max-width:420px',
      'border:1px solid rgba(225,29,72,.22)',
      'border-radius:8px',
      'background:#fff',
      'padding:22px',
      'color:#172033',
      'font-family:Microsoft YaHei UI, sans-serif'
    ].join(';');

    const heading = document.createElement('strong');
    heading.style.cssText = 'color:#e11d48;';
    heading.textContent = title || '\u52A0\u8F7D\u5931\u8D25';
    card.appendChild(heading);

    if (detail) {
      const paragraph = document.createElement('p');
      paragraph.style.cssText = 'margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.7;';
      paragraph.textContent = String(detail);
      card.appendChild(paragraph);
    }

    shell.appendChild(card);
    mountNode.appendChild(shell);
  }

  function createVueBundleViewLoader(options = {}) {
    const mountTarget = options.mountTarget;
    const mountExportName = String(options.mountExportName || '').trim();
    const fallbackMessage = String(options.fallbackMessage || '').trim() || '\u52A0\u8F7D\u5931\u8D25\u3002';
    const stylesheetErrorMessage =
      String(options.stylesheetErrorMessage || '').trim()
      || '\u6837\u5f0f\u52a0\u8f7d\u5931\u8d25\u3002';
    const missingExportMessage =
      String(options.missingExportMessage || '').trim()
      || '\u754c\u9762\u52a0\u8f7d\u4e0d\u5b8c\u6574\u3002';
    const getModuleHref = typeof options.moduleHref === 'function'
      ? options.moduleHref
      : () => options.moduleHref;
    const getStylesheetHref = typeof options.stylesheetHref === 'function'
      ? options.stylesheetHref
      : () => options.stylesheetHref;
    const normalizeError = typeof options.normalizeError === 'function'
      ? options.normalizeError
      : normalizeFallbackError;
    const replaceStylesheet = options.replaceStylesheet === true;
    const stylesheetSelector = String(options.stylesheetSelector || '').trim();
    const onModuleLoaded = typeof options.onModuleLoaded === 'function'
      ? options.onModuleLoaded
      : null;
    const onBeforeReset = typeof options.onBeforeReset === 'function'
      ? options.onBeforeReset
      : null;
    const renderFallback = typeof options.renderFallback === 'function'
      ? options.renderFallback
      : null;
    let controller = null;
    let moduleRef = null;
    let mountPromise = null;
    let stylesheetPromise = null;

    function ensureStylesheet() {
      if (stylesheetPromise) {
        return stylesheetPromise;
      }

      stylesheetPromise = new Promise((resolve, reject) => {
        const href = resolveValue(getStylesheetHref);
        const existing = stylesheetSelector
          ? document.querySelector(stylesheetSelector)
          : null;

        if (existing) {
          if (!replaceStylesheet) {
            resolve(existing);
            return;
          }

          existing.remove();
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;

        if (stylesheetSelector && stylesheetSelector.startsWith('link[')) {
          const attrMatch = stylesheetSelector.match(/\[([^\]=]+)=/);

          if (attrMatch && attrMatch[1]) {
            link.setAttribute(attrMatch[1], 'true');
          }
        }

        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(stylesheetErrorMessage));
        document.head.appendChild(link);
      });

      return stylesheetPromise;
    }

    function ensureMount() {
      if (!mountPromise) {
        ensureVueProcessShim();

        mountPromise = ensureStylesheet()
          .then(() => import(resolveValue(getModuleHref)))
          .then((module) => {
            if (!module || typeof module[mountExportName] !== 'function') {
              throw new Error(missingExportMessage);
            }

            moduleRef = module;

            if (onModuleLoaded) {
              onModuleLoaded(module);
            }

            controller = module[mountExportName](mountTarget);
            return controller;
          })
          .catch((error) => {
            const message = normalizeError(error, fallbackMessage);

            if (renderFallback) {
              try {
                renderFallback({
                  error,
                  fallbackMessage,
                  message,
                  mountNode: getMountNode(mountTarget),
                  mountTarget,
                  renderFallbackCard(title, detail) {
                    renderFallbackCardNode(mountTarget, title, detail);
                  }
                });
              } catch (fallbackError) {
                renderFallbackMessage(mountTarget, message, fallbackMessage);
              }
            } else {
              renderFallbackMessage(mountTarget, message, fallbackMessage);
            }

            throw error;
          });
      }

      return mountPromise;
    }

    function resetMount() {
      if (onBeforeReset) {
        onBeforeReset({
          controller,
          moduleRef
        });
      }

      const mountNode = getMountNode(mountTarget);

      if (mountNode) {
        mountNode.textContent = '';
      }

      controller = null;
      moduleRef = null;
      mountPromise = null;
      stylesheetPromise = null;
    }

    return {
      ensureMount,
      getController() {
        return controller;
      },
      getModuleRef() {
        return moduleRef;
      },
      normalizeFallbackError,
      renderFallbackMessage(message) {
        renderFallbackMessage(mountTarget, message, fallbackMessage);
      },
      resetMount
    };
  }

  global.createVueBundleViewLoader = createVueBundleViewLoader;
})(window);
