import { createApp } from 'vue';
import App from './App.vue';

let appInstance = null;
let controllerRef = null;

export function mountShopWindowApp(target = '#shopWindowApp') {
  if (appInstance) {
    return controllerRef;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('\u5e97\u94fa\u7a97\u53e3\u754c\u9762\u6302\u8f7d\u70b9\u672a\u627e\u5230\u3002');
  }

  const app = createApp(App);
  controllerRef = app.mount(mountTarget);
  appInstance = app;
  return controllerRef;
}
