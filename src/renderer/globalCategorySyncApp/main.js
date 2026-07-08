import { createApp } from 'vue';
import App from './App.vue';

const root = document.getElementById('globalCategorySyncRoot');
if (root instanceof HTMLElement) {
  createApp(App).mount(root);
}
