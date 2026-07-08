function extractErrorMessage(error) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return '';
}

function normalizeErrorMessage(error, fallbackMessage) {
  const message = extractErrorMessage(error);

  if (!message) {
    return fallbackMessage;
  }

  if (/[\u4e00-\u9fff]/u.test(message)) {
    return message;
  }

  if (/Cannot read properties of undefined/i.test(message) || /is not defined/i.test(message)) {
    return '\u754c\u9762\u6a21\u5757\u52a0\u8f7d\u4e0d\u5b8c\u6574\uff0c\u8bf7\u5173\u95ed\u8f6f\u4ef6\u540e\u91cd\u65b0\u6253\u5f00\u3002';
  }

  if (/Unexpected token/i.test(message) || /Unexpected identifier/i.test(message)) {
    return '\u754c\u9762\u811a\u672c\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5173\u95ed\u8f6f\u4ef6\u540e\u91cd\u65b0\u6253\u5f00\u3002';
  }

  if (/session/i.test(message) || /partition/i.test(message) || /IPC/i.test(message) || /electron/i.test(message) || /preload/i.test(message) || /contextBridge/i.test(message)) {
    return fallbackMessage;
  }

  if (/ERR_CONNECTION/i.test(message) || /ECONNREFUSED/i.test(message) || /ETIMEDOUT/i.test(message) || /ENOTFOUND/i.test(message)) {
    return '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002';
  }

  if (/protocol/i.test(message)) {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function renderBootstrapFallback(title, message) {
  const shellHost = document.getElementById('mainWindowShell');

  if (!shellHost) {
    return;
  }

  shellHost.textContent = `${title}\uff1a${message}`;
}

function getMainWindowShell() {
  if (window.mainWindowShell && typeof window.mainWindowShell.init === 'function') {
    return window.mainWindowShell;
  }

  throw new Error('\u4e3b\u7a97\u53e3\u58f3\u5c42\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u542f\u52a8\u8f6f\u4ef6\u3002');
}

function assertViewModule(moduleRef, fallbackMessage) {
  if (!moduleRef || typeof moduleRef.init !== 'function') {
    throw new Error(fallbackMessage);
  }
}

function getViewModuleDefinitions() {
  return [
    {
      key: 'shop-management',
      title: '\u5e97\u94fa\u7ba1\u7406',
      moduleRef: window.shopManagementView,
      fallbackMessage: '\u5e97\u94fa\u7ba1\u7406\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002'
    },
    {
      key: 'shop-window',
      title: '\u5e97\u94fa\u7a97\u53e3',
      moduleRef: window.shopWindowView,
      fallbackMessage: '\u5e97\u94fa\u7a97\u53e3\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002'
    },
    {
      key: 'global-config',
      title: '\u5168\u5c40\u914d\u7f6e',
      moduleRef: window.globalConfigView,
      fallbackMessage: '\u5168\u5c40\u914d\u7f6e\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002'
    },
    {
      key: 'feature-center',
      title: '\u529f\u80fd\u4e2d\u5fc3',
      moduleRef: window.featureCenterView,
      fallbackMessage: '\u529f\u80fd\u4e2d\u5fc3\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002'
    },
    {
      key: 'creation-center',
      title: '\u521b\u4f5c\u4e2d\u5fc3',
      moduleRef: window.creationCenterView,
      fallbackMessage: '\u521b\u4f5c\u4e2d\u5fc3\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002'
    }
  ];
}

async function initViewModule(definition) {
  assertViewModule(definition.moduleRef, definition.fallbackMessage);

  try {
    await definition.moduleRef.init();
    return {
      ok: true,
      ...definition
    };
  } catch (error) {
    console.error(`[renderer-bootstrap] ${definition.key} init failed`, error);
    return {
      ok: false,
      error,
      ...definition
    };
  }
}

async function initViewModules() {
  const definitions = getViewModuleDefinitions();
  const results = [];

  for (const definition of definitions) {
    results.push(await initViewModule(definition));
  }

  return results;
}

function showRuntimeError(title, message, badgeText = '\u5f02\u5e38') {
  if (window.mainWindowShell) {
    if (typeof window.mainWindowShell.setSection === 'function') {
      window.mainWindowShell.setSection('shop-management');
    }

    if (typeof window.mainWindowShell.setRuntimeStatus === 'function') {
      window.mainWindowShell.setRuntimeStatus({
        title,
        message,
        badgeText
      });
      return;
    }
  }

  renderBootstrapFallback(title, message);
}

document.addEventListener('DOMContentLoaded', () => {
  Promise.resolve()
    .then(() => getMainWindowShell().init())
    .then(() => {
      if (typeof window.mainWindowShell.clearRuntimeStatus === 'function') {
        window.mainWindowShell.clearRuntimeStatus();
      }

      return initViewModules();
    })
    .then((results) => {
      if (!Array.isArray(results)) {
        return;
      }

      const failedResults = results.filter((item) => item && item.ok === false);

      if (failedResults.length === 0) {
        return;
      }

      const failedTitles = failedResults.map((item) => item.title).join('\u3001');
      const firstFailure = failedResults[0];
      const message = failedResults.length === 1
        ? normalizeErrorMessage(
          firstFailure.error,
          `${firstFailure.title}\u6a21\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002`
        )
        : `${failedTitles}\u6a21\u5757\u672a\u80fd\u5b8c\u6574\u52a0\u8f7d\uff0c\u8bf7\u5148\u68c0\u67e5\u5bf9\u5e94\u533a\u57df\u663e\u793a\u3002`;

      showRuntimeError(
        '\u90e8\u5206\u6a21\u5757\u52a0\u8f7d\u5931\u8d25',
        message,
        '\u6a21\u5757\u5f02\u5e38'
      );
    })
    .catch((error) => {
      console.error('[renderer-bootstrap] init failed', error);
      showRuntimeError(
        '\u521d\u59cb\u5316\u5931\u8d25',
        normalizeErrorMessage(error, '\u4e3b\u754c\u9762\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u542f\u52a8\u8f6f\u4ef6\u3002'),
        '\u521d\u59cb\u5316\u5931\u8d25'
      );
    });
});

window.addEventListener('error', (event) => {
  console.error('[renderer-runtime] error', event.error || event.message || event);
  showRuntimeError(
    '\u754c\u9762\u53d1\u751f\u9519\u8bef',
    normalizeErrorMessage(event.error, '\u754c\u9762\u6267\u884c\u5f02\u5e38\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002')
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer-runtime] unhandled rejection', event.reason || event);
  showRuntimeError(
    '\u8bf7\u6c42\u5904\u7406\u5931\u8d25',
    normalizeErrorMessage(event.reason, '\u8bf7\u6c42\u672a\u5b8c\u6210\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002')
  );
});
