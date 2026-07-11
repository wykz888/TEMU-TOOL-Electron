import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import './styles/pod-miaoshou-app.css';
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

export function mountPodUploadSheetMiaoshouApp(target = '#pod-upload-sheet-miaoshou-root') {
  if (controllerInstance) {
    return controllerInstance;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('POD\u4e0a\u8d27\u8868\u683c(\u5999\u624bTEMU\u7248)\u6302\u8f7d\u70b9\u672a\u627e\u5230\u3002');
  }

  const app = createApp(App);
  app.use(ArcoVue);

  const vm = app.mount(mountTarget);
  controllerInstance = createController(app, vm);

  return controllerInstance;
}
