import { createApp } from 'vue';
import './styles/exit-progress-app.css';
import App from './App.vue';

let controllerInstance = null;

function createController(app, vm, root) {
  return {
    app,
    root,
    vm
  };
}

export function mountExitProgressApp(target = '#exitProgressApp') {
  if (controllerInstance) {
    return controllerInstance;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('\u9000\u51fa\u4fdd\u5b58\u6302\u8f7d\u70b9\u672a\u627e\u5230\u3002');
  }

  const app = createApp(App);
  const vm = app.mount(mountTarget);
  controllerInstance = createController(app, vm, mountTarget);

  return controllerInstance;
}
