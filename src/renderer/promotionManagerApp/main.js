import { createApp, h } from 'vue';
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

export function mountPromotionManagerApp(target = '#promotionManagerApp') {
  if (controllerInstance) {
    return controllerInstance;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('推广大师界面挂载点未找到。');
  }

  const app = createApp({ render() { return h(App); } });
  const vm = app.mount(mountTarget);
  controllerInstance = createController(app, vm);

  return controllerInstance;
}
