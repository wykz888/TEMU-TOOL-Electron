import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';

let controllerInstance = null;

function createController(app, vm) {
  return {
    app,
    vm,
    setSection(sectionId) {
      if (vm && typeof vm.setSection === 'function') {
        vm.setSection(sectionId);
      }
    },
    setSession(session) {
      if (vm && typeof vm.setSession === 'function') {
        vm.setSession(session);
      }
    },
    refreshSession() {
      if (vm && typeof vm.refreshSession === 'function') {
        return vm.refreshSession();
      }

      return Promise.resolve(null);
    },
    setRuntimeStatus(payload) {
      if (vm && typeof vm.setRuntimeStatus === 'function') {
        vm.setRuntimeStatus(payload);
      }
    },
    clearRuntimeStatus() {
      if (vm && typeof vm.clearRuntimeStatus === 'function') {
        vm.clearRuntimeStatus();
      }
    },
    syncThemeFromBridge() {
      if (vm && typeof vm.syncThemeFromBridge === 'function') {
        return vm.syncThemeFromBridge();
      }

      return Promise.resolve();
    }
  };
}

export function mountMainWindowApp(target = '#mainWindowShell') {
  if (controllerInstance) {
    return controllerInstance;
  }

  const mountTarget = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!mountTarget) {
    throw new Error('\u4e3b\u7a97\u53e3\u6302\u8f7d\u70b9\u672a\u627e\u5230\u3002');
  }

  const app = createApp(App);

  app.use(ArcoVue);

  const vm = app.mount(mountTarget);

  controllerInstance = createController(app, vm);
  return controllerInstance;
}
