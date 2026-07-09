import { createApp, h } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';

let controllerInstance = null;

function createController(app, vm) {
  return {
    app,
    vm,
    refresh() {
      if (vm && typeof vm.refresh === 'function') {
        return vm.refresh();
      }
      return Promise.resolve(null);
    }
  };
}

export function mountPsdSmartSuiteApp(target = '#psd-smart-suite-root') {
  if (controllerInstance) {
    return controllerInstance;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('PSD智能套图挂载点 #psd-smart-suite-root 未找到。');
  }

  const app = createApp({
    render() {
      return h(App);
    }
  });

  app.use(ArcoVue);

  const vm = app.mount(mountTarget);
  controllerInstance = createController(app, vm);

  return controllerInstance;
}
