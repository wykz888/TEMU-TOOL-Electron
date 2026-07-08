export function getGlobalConfigBridge() {
  if (window.temuApp && window.temuApp.globalConfig) {
    return window.temuApp.globalConfig;
  }

  throw new Error('\u5168\u5c40\u914d\u7f6e\u901a\u4fe1\u672a\u5c31\u7eea\u3002');
}

export function getThemeBridge() {
  if (window.temuApp && window.temuApp.theme) {
    return window.temuApp.theme;
  }

  throw new Error('\u4e3b\u9898\u914d\u8272\u901a\u4fe1\u672a\u5c31\u7eea\u3002');
}
