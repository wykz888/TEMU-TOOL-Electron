function getTemuApp() {
  if (window.temuApp && typeof window.temuApp === 'object') {
    return window.temuApp;
  }

  throw new Error('\u7a0b\u5e8f\u901a\u4fe1\u521d\u59cb\u5316\u5931\u8d25\u3002');
}

export function getAuthBridge() {
  const temuApp = getTemuApp();

  if (temuApp.auth && typeof temuApp.auth === 'object') {
    return temuApp.auth;
  }

  throw new Error('\u767b\u5f55\u4f1a\u8bdd\u901a\u4fe1\u4e0d\u53ef\u7528\u3002');
}

export function getThemeBridge() {
  const temuApp = getTemuApp();

  if (temuApp.theme && typeof temuApp.theme === 'object') {
    return temuApp.theme;
  }

  return null;
}
