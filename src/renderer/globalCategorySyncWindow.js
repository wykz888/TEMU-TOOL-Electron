(function initGlobalCategorySyncWindow() {
  function mount() {
    const root = document.getElementById('globalCategorySyncRoot');

    if (!(root instanceof HTMLElement)) {
      return;
    }

    // 如果 Vue 已经挂载（root 已经有子元素），不重复挂载旧版
    if (root.children.length > 0) {
      return;
    }

    if (
      window.operationsGlobalCategorySyncView
      && typeof window.operationsGlobalCategorySyncView.mount === 'function'
    ) {
      window.operationsGlobalCategorySyncView.mount(root);
    }
  }

  // 稍后执行，确保 Vue 先尝试挂载
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mount, 200);
  });
})();
