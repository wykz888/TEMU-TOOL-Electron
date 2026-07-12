import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import './styles/confirm-dialog-app.css';
import App from './App.vue';

let controllerInstance = null;

function createController(app, vm) {
  return {
    app,
    vm
  };
}

export function mountConfirmDialogApp(target = '#confirmDialogApp') {
  if (controllerInstance) {
    return controllerInstance;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('\u786e\u8ba4\u5f39\u7a97\u6302\u8f7d\u70b9\u672a\u627e\u5230\u3002');
  }

  const app = createApp(App);
  app.use(ArcoVue);

  const vm = app.mount(mountTarget);
  controllerInstance = createController(app, vm);

  return controllerInstance;
}
