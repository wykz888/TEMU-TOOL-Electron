(function initGlobalCategorySyncWindow() {
  function mount() {
    const root = document.getElementById('globalCategorySyncRoot');

    if (!(root instanceof HTMLElement)) {
      return;
    }

    if (
      window.operationsGlobalCategorySyncView
      && typeof window.operationsGlobalCategorySyncView.mount === 'function'
    ) {
      window.operationsGlobalCategorySyncView.mount(root);
    }
  }

  document.addEventListener('DOMContentLoaded', mount);
})();
