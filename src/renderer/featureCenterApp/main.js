import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';

let appInstance = null;
let controllerRef = null;

export function mountFeatureCenterApp(target = '#featureCenterApp') {
  if (appInstance) {
    return controllerRef;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('\u529f\u80fd\u4e2d\u5fc3\u754c\u9762\u6302\u8f7d\u70b9\u672a\u627e\u5230\u3002');
  }

  const app = createApp(App);
  app.use(ArcoVue);
  controllerRef = app.mount(mountTarget);
  appInstance = app;
  return controllerRef;
}
