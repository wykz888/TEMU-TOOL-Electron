const { Menu, clipboard, shell } = require('electron');

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(normalizeText(value));
}

function isNonEmptyUrl(value) {
  return normalizeText(value).length > 0;
}

function writeClipboardText(value) {
  const normalizedValue = normalizeText(value);

  if (normalizedValue) {
    clipboard.writeText(normalizedValue);
  }
}

function createSeparator() {
  return {
    type: 'separator'
  };
}

function compactMenuTemplate(template) {
  const result = [];
  let lastWasSeparator = true;

  template.forEach((item) => {
    if (!item) {
      return;
    }

    if (item.type === 'separator') {
      if (!lastWasSeparator) {
        result.push(item);
        lastWasSeparator = true;
      }
      return;
    }

    result.push(item);
    lastWasSeparator = false;
  });

  while (result.length > 0 && result[result.length - 1].type === 'separator') {
    result.pop();
  }

  return result;
}

function runAsyncAction(action, onError) {
  Promise.resolve()
    .then(action)
    .catch((error) => {
      if (typeof onError === 'function') {
        onError(error);
      }
    });
}

function openUrlInNewTab(url, context, options) {
  if (!isHttpUrl(url) || !options || typeof options.openUrlInNewTab !== 'function') {
    return;
  }

  runAsyncAction(
    () => options.openUrlInNewTab({
      shopId: normalizeText(context && context.shopId),
      pageType: normalizeText(context && context.pageType),
      browserTabId: normalizeText(context && context.browserTabId),
      url: normalizeText(url)
    }),
    options.onError
  );
}

function openUrlExternal(url, options) {
  if (!isHttpUrl(url)) {
    return;
  }

  runAsyncAction(
    () => shell.openExternal(normalizeText(url)),
    options && options.onError
  );
}

function buildEditMenuItems(webContents, params) {
  const editFlags = params && params.editFlags ? params.editFlags : {};

  if (!params || params.isEditable !== true) {
    if (!normalizeText(params && params.selectionText)) {
      return [];
    }

    return [
      {
        label: '\u590d\u5236',
        enabled: editFlags.canCopy !== false,
        click: () => webContents.copy()
      }
    ];
  }

  return [
    {
      label: '\u64a4\u9500',
      enabled: editFlags.canUndo === true,
      click: () => webContents.undo()
    },
    {
      label: '\u91cd\u505a',
      enabled: editFlags.canRedo === true,
      click: () => webContents.redo()
    },
    createSeparator(),
    {
      label: '\u526a\u5207',
      enabled: editFlags.canCut === true,
      click: () => webContents.cut()
    },
    {
      label: '\u590d\u5236',
      enabled: editFlags.canCopy === true,
      click: () => webContents.copy()
    },
    {
      label: '\u7c98\u8d34',
      enabled: editFlags.canPaste === true,
      click: () => webContents.paste()
    },
    {
      label: '\u5220\u9664',
      enabled: editFlags.canDelete === true,
      click: () => webContents.delete()
    },
    createSeparator(),
    {
      label: '\u5168\u9009',
      enabled: editFlags.canSelectAll !== false,
      click: () => webContents.selectAll()
    }
  ];
}

function buildLinkMenuItems(context, webContents, params, options) {
  const linkUrl = normalizeText(params && params.linkURL);

  if (!linkUrl) {
    return [];
  }

  return [
    {
      label: '\u5728\u65b0\u6807\u7b7e\u4e2d\u6253\u5f00\u94fe\u63a5',
      enabled: isHttpUrl(linkUrl),
      click: () => openUrlInNewTab(linkUrl, context, options)
    },
    {
      label: '\u5728\u7cfb\u7edf\u6d4f\u89c8\u5668\u6253\u5f00\u94fe\u63a5',
      enabled: isHttpUrl(linkUrl),
      click: () => openUrlExternal(linkUrl, options)
    },
    {
      label: '\u590d\u5236\u94fe\u63a5\u5730\u5740',
      click: () => writeClipboardText(linkUrl)
    }
  ];
}

function buildImageMenuItems(context, webContents, params, options) {
  const imageUrl = normalizeText(params && params.srcURL);

  if (!imageUrl || normalizeText(params && params.mediaType) !== 'image') {
    return [];
  }

  return [
    {
      label: '\u5728\u65b0\u6807\u7b7e\u4e2d\u6253\u5f00\u56fe\u7247',
      enabled: isHttpUrl(imageUrl),
      click: () => openUrlInNewTab(imageUrl, context, options)
    },
    {
      label: '\u590d\u5236\u56fe\u7247\u5730\u5740',
      click: () => writeClipboardText(imageUrl)
    },
    {
      label: '\u56fe\u7247\u53e6\u5b58\u4e3a...',
      enabled: isNonEmptyUrl(imageUrl) && typeof webContents.downloadURL === 'function',
      click: () => {
        try {
          webContents.downloadURL(imageUrl);
        } catch (error) {
          if (options && typeof options.onError === 'function') {
            options.onError(error);
          }
        }
      }
    }
  ];
}

function buildPageMenuItems(webContents, params, options) {
  const pageUrl = normalizeText((params && params.pageURL) || webContents.getURL());

  return [
    {
      label: '\u8fd4\u56de',
      enabled: webContents.canGoBack(),
      click: () => webContents.goBack()
    },
    {
      label: '\u524d\u8fdb',
      enabled: webContents.canGoForward(),
      click: () => webContents.goForward()
    },
    {
      label: '\u5237\u65b0',
      click: () => webContents.reload()
    },
    {
      label: '\u5f3a\u5236\u5237\u65b0',
      click: () => webContents.reloadIgnoringCache()
    },
    createSeparator(),
    {
      label: '\u590d\u5236\u5f53\u524d\u9875\u9762\u5730\u5740',
      enabled: Boolean(pageUrl),
      click: () => writeClipboardText(pageUrl)
    },
    {
      label: '\u5728\u7cfb\u7edf\u6d4f\u89c8\u5668\u6253\u5f00\u5f53\u524d\u9875',
      enabled: isHttpUrl(pageUrl),
      click: () => openUrlExternal(pageUrl, options)
    }
  ];
}

function buildDeveloperMenuItems(webContents, params) {
  return [
    {
      label: '\u68c0\u67e5\u5143\u7d20',
      click: () => webContents.inspectElement(params.x, params.y)
    }
  ];
}

function buildShopWindowContextMenuTemplate(context, webContents, params, options = {}) {
  return compactMenuTemplate([
    ...buildLinkMenuItems(context, webContents, params, options),
    createSeparator(),
    ...buildImageMenuItems(context, webContents, params, options),
    createSeparator(),
    ...buildEditMenuItems(webContents, params),
    createSeparator(),
    ...buildPageMenuItems(webContents, params, options),
    createSeparator(),
    ...buildDeveloperMenuItems(webContents, params)
  ]);
}

function attachShopWindowContextMenu(view, context, options = {}) {
  if (!view || !view.webContents) {
    return;
  }

  view.webContents.on('context-menu', (event, params) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    const menuTemplate = buildShopWindowContextMenuTemplate(
      context,
      view.webContents,
      params || {},
      options
    );

    if (menuTemplate.length === 0) {
      return;
    }

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup({
      window: options.window || undefined
    });
  });
}

module.exports = {
  attachShopWindowContextMenu,
  buildShopWindowContextMenuTemplate
};
