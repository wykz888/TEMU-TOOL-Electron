(() => {
  function setModalStatus(element, message) {
    if (!element) {
      return;
    }

    element.textContent = message || '';
    element.hidden = !message;
  }

  function toggleModalBusy(button, isBusy, busyText) {
    if (!button) {
      return;
    }

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent.trim();
    }

    button.disabled = isBusy === true;
    button.textContent = isBusy === true ? busyText : button.dataset.defaultText;
  }

  function syncModalOpenState() {
    const hasOpenModal = document.querySelector('.modal-shell:not([hidden])') !== null;
    document.body.classList.toggle('modal-open', hasOpenModal);
  }

  function focusUrlInput(elements) {
    window.requestAnimationFrame(() => {
      if (!elements || !elements.urlInput || !elements.urlModal || elements.urlModal.hidden) {
        return;
      }

      elements.urlInput.focus();
      elements.urlInput.select();
    });
  }

  function normalizeModalContext(payload) {
    return {
      shopId: String(payload && payload.shopId || '').trim(),
      pageType: String(payload && payload.pageType || '').trim(),
      browserTabId: String(payload && payload.browserTabId || '').trim(),
      currentUrl: String(payload && payload.currentUrl || '').trim()
    };
  }

  window.createShopWindowUrlModalController = function createShopWindowUrlModalController(options) {
    const getElements =
      options && typeof options.getElements === 'function'
        ? options.getElements
        : () => null;
    const getBridge =
      options && typeof options.getBridge === 'function'
        ? options.getBridge
        : null;
    const scheduleWorkspaceSync =
      options && typeof options.scheduleWorkspaceSync === 'function'
        ? options.scheduleWorkspaceSync
        : () => {};
    const showTabStatus =
      options && typeof options.showTabStatus === 'function'
        ? options.showTabStatus
        : () => {};

    let pendingBrowserUrlContext = null;

    function open(payload) {
      const elements = getElements();

      pendingBrowserUrlContext = normalizeModalContext(payload);
      elements.urlInput.value = pendingBrowserUrlContext.currentUrl || 'https://';
      setModalStatus(elements.urlModalStatus, '');
      toggleModalBusy(elements.urlSubmitButton, false, '\u65b0\u5efa\u8df3\u8f6c');
      elements.urlModal.hidden = false;
      syncModalOpenState();
      scheduleWorkspaceSync();
      focusUrlInput(elements);
    }

    function close() {
      const elements = getElements();

      pendingBrowserUrlContext = null;
      elements.urlModal.hidden = true;
      setModalStatus(elements.urlModalStatus, '');
      toggleModalBusy(elements.urlSubmitButton, false, '\u65b0\u5efa\u8df3\u8f6c');
      syncModalOpenState();
      scheduleWorkspaceSync();
    }

    async function handleSubmit(event) {
      event.preventDefault();

      const elements = getElements();

      if (!pendingBrowserUrlContext) {
        setModalStatus(elements.urlModalStatus, '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u7684\u6d4f\u89c8\u5668\u6807\u7b7e\u3002');
        return;
      }

      const rawUrl = String(elements.urlInput.value || '').trim();

      if (!rawUrl) {
        setModalStatus(elements.urlModalStatus, '\u8bf7\u8f93\u5165\u8981\u8df3\u8f6c\u7684\u7f51\u5740\u3002');
        elements.urlInput.focus();
        return;
      }

      setModalStatus(elements.urlModalStatus, '');
      toggleModalBusy(elements.urlSubmitButton, true, '\u8df3\u8f6c\u4e2d...');

      try {
        const result = await getBridge().openBrowserUrlInNewTab({
          ...pendingBrowserUrlContext,
          url: rawUrl
        });

        close();
        showTabStatus({
          message:
            result && result.openedInCurrentTab === true
              ? '\u5df2\u8fbe\u5230\u6807\u7b7e\u4e0a\u9650\uff0c\u5df2\u5728\u5f53\u524d\u6807\u7b7e\u6253\u5f00\u65b0\u7f51\u5740\u3002'
              : '\u5df2\u65b0\u5efa\u6807\u7b7e\u5e76\u5f00\u59cb\u8df3\u8f6c\u7f51\u5740\u3002',
          durationMs: 2600
        });
      } catch (error) {
        toggleModalBusy(elements.urlSubmitButton, false, '\u65b0\u5efa\u8df3\u8f6c');
        setModalStatus(
          elements.urlModalStatus,
          error && error.message ? error.message : '\u7f51\u5740\u8df3\u8f6c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002'
        );
      }
    }

    function handleModalClick(event) {
      const closeButton = event.target.closest('[data-close-shop-window-modal="url"]');

      if (!closeButton) {
        return;
      }

      close();
    }

    function handleWindowKeydown(event) {
      const elements = getElements();

      if (event.key === 'Escape' && elements && elements.urlModal && !elements.urlModal.hidden) {
        event.preventDefault();
        close();
      }
    }

    return {
      open,
      close,
      handleSubmit,
      handleModalClick,
      handleWindowKeydown
    };
  };
})();
