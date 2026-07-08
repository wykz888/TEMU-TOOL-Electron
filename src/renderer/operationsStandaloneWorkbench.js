(function initOperationsStandaloneWorkbench() {
  const VIEW_NAME_BY_MODULE_ID = Object.freeze({
    activity: 'operationsActivityManagementView',
    traffic: 'operationsTrafficBoostView',
    'price-declaration': 'operationsPriceDeclarationView',
    'new-product-lifecycle': 'operationsNewProductLifecycleView'
  });

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function resolveModuleId() {
    const bodyModuleId = normalizeText(document.body && document.body.dataset
      ? document.body.dataset.operationsStandaloneModule
      : '');

    if (bodyModuleId) {
      return bodyModuleId;
    }

    return normalizeText(window.location && window.location.hash).replace(/^#/, '');
  }

  function resolveViewName(moduleId) {
    const bodyViewName = normalizeText(document.body && document.body.dataset
      ? document.body.dataset.operationsStandaloneView
      : '');

    return bodyViewName || VIEW_NAME_BY_MODULE_ID[moduleId] || '';
  }

  function renderError(container, message) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    container.innerHTML = `
      <div class="operations-module-workspace">
        <div style="padding:24px;font-size:14px;color:#9f1d1d;">${message}</div>
      </div>
    `;
  }

  function mountStandaloneModule() {
    const moduleId = resolveModuleId();
    const viewName = resolveViewName(moduleId);
    const container = document.querySelector('[data-operations-standalone-panel]')
      || document.querySelector(`[data-operations-panel="${moduleId}"]`);

    if (!(container instanceof HTMLElement)) {
      return;
    }

    const moduleView = viewName && window[viewName] && typeof window[viewName] === 'object'
      ? window[viewName]
      : null;

    if (!moduleView || typeof moduleView.mount !== 'function') {
      renderError(container, 'Module view is not available.');
      return;
    }

    const controller = moduleView.mount(container);

    if (controller && typeof controller.activate === 'function') {
      controller.activate({
        firstActivation: true,
        resume: false,
        previousModuleId: ''
      });
    }
  }

  document.addEventListener('DOMContentLoaded', mountStandaloneModule);
})();
