(function initOperationsModuleKeepAlive() {
  function createKeepAliveController(config = {}) {
    let activated = false;

    return {
      panel: config.panel || null,
      activate(options = {}) {
        const firstActivation = activated !== true;
        const context = {
          ...options,
          firstActivation,
          resume: firstActivation ? false : true
        };

        activated = true;

        if (typeof config.onActivate === 'function') {
          return config.onActivate(context);
        }

        if (firstActivation) {
          if (typeof config.onFirstActivate === 'function') {
            return config.onFirstActivate(context);
          }
        } else if (typeof config.onResume === 'function') {
          return config.onResume(context);
        }

        if (typeof config.onEveryActivate === 'function') {
          return config.onEveryActivate(context);
        }

        return undefined;
      },
      deactivate(options = {}) {
        if (typeof config.onDeactivate === 'function') {
          return config.onDeactivate(options);
        }

        return undefined;
      },
      dispose(options = {}) {
        activated = false;

        if (typeof config.onDispose === 'function') {
          return config.onDispose(options);
        }

        return undefined;
      },
      hasActivated() {
        return activated;
      }
    };
  }

  const keepAliveApi = {
    createKeepAliveController
  };

  window.moduleKeepAlive = keepAliveApi;
  window.operationsModuleKeepAlive = keepAliveApi;
})();
