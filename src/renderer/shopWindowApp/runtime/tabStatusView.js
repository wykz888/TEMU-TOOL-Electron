import { reactive } from 'vue';

export function createTabStatusView() {
  const state = reactive({
    ariaHidden: 'true',
    isEmpty: true,
    message: '',
    title: ''
  });
  const runtime = {
    messageDedupMs: 1200,
    scheduleDeferredWorkspaceSync() {}
  };
  let statusTimer = 0;
  let lastMessage = '';
  let lastPersistent = false;
  let lastShownAt = 0;

  function clearStatusTimer() {
    if (!statusTimer) {
      return;
    }

    window.clearTimeout(statusTimer);
    statusTimer = 0;
  }

  function resetLastStatus() {
    lastMessage = '';
    lastPersistent = false;
    lastShownAt = 0;
  }

  function configure(options = {}) {
    runtime.messageDedupMs = Math.max(
      0,
      Number(options.messageDedupMs) || runtime.messageDedupMs
    );
    runtime.scheduleDeferredWorkspaceSync =
      typeof options.scheduleDeferredWorkspaceSync === 'function'
        ? options.scheduleDeferredWorkspaceSync
        : runtime.scheduleDeferredWorkspaceSync;
  }

  function hide() {
    clearStatusTimer();

    if (state.isEmpty && state.ariaHidden === 'true' && !state.message) {
      resetLastStatus();
      return;
    }

    state.message = '';
    state.title = '';
    state.isEmpty = true;
    state.ariaHidden = 'true';
    resetLastStatus();
    runtime.scheduleDeferredWorkspaceSync(40);
  }

  function show(payload) {
    const options =
      payload && typeof payload === 'object'
        ? payload
        : {
          message: payload
        };
    const normalizedMessage = String(options && options.message || '').trim();
    const persistent = Boolean(options && options.persistent);
    const durationMs = Math.max(1200, Number(options && options.durationMs) || 3600);
    const now = Date.now();

    if (!normalizedMessage) {
      hide();
      return;
    }

    const isVisible = state.ariaHidden !== 'true';
    const isSameStatus = (
      isVisible
      && lastMessage === normalizedMessage
      && lastPersistent === persistent
      && state.message === normalizedMessage
    );

    clearStatusTimer();

    if (!isSameStatus || now - lastShownAt >= runtime.messageDedupMs) {
      state.message = normalizedMessage;
      state.title = normalizedMessage;
      state.isEmpty = false;
      state.ariaHidden = 'false';
      runtime.scheduleDeferredWorkspaceSync(40);
    }

    lastMessage = normalizedMessage;
    lastPersistent = persistent;
    lastShownAt = now;

    if (!persistent) {
      statusTimer = window.setTimeout(() => {
        hide();
      }, durationMs);
    }
  }

  return {
    configure,
    hide,
    show,
    state
  };
}
