const installedWebContents = new WeakSet();

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveWebContents(target) {
  if (!target || typeof target !== 'object') {
    return null;
  }

  if (target.webContents && typeof target.webContents.on === 'function') {
    return target.webContents;
  }

  if (typeof target.on === 'function' && typeof target.reload === 'function') {
    return target;
  }

  return null;
}

function openDevTools(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  try {
    webContents.openDevTools({
      mode: 'detach',
      activate: true
    });
  } catch (_error) {
    // Ignore DevTools open failures.
  }
}

function reloadContents(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  try {
    webContents.reload();
  } catch (_error) {
    // Ignore reload failures.
  }
}

function installWebContentsDebugShortcuts(target, options = {}) {
  const webContents = resolveWebContents(target);

  if (!webContents || installedWebContents.has(webContents)) {
    return;
  }

  const onReload =
    typeof options.onReload === 'function'
      ? options.onReload
      : reloadContents;
  const onOpenDevTools =
    typeof options.onOpenDevTools === 'function'
      ? options.onOpenDevTools
      : openDevTools;

  webContents.on('before-input-event', (event, input) => {
    const inputType = normalizeText(input && input.type);
    const key = normalizeText(input && input.key);
    const code = normalizeText(input && input.code);

    if (inputType !== 'keydown') {
      return;
    }

    if (key === 'f5' || code === 'f5') {
      event.preventDefault();
      onReload(webContents, input);
      return;
    }

    if (key === 'f12' || code === 'f12') {
      event.preventDefault();
      onOpenDevTools(webContents, input);
    }
  });

  installedWebContents.add(webContents);

  webContents.once('destroyed', () => {
    installedWebContents.delete(webContents);
  });
}

module.exports = {
  installWebContentsDebugShortcuts,
  openDevTools,
  reloadContents
};
