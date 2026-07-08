import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  resolve: {
    alias: {
      vue: path.resolve(__dirname, 'node_modules/vue/dist/vue.runtime.esm-browser.prod.js')
    }
  },
  plugins: [vue()],
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, 'src/renderer/shopWindowApp/dist'),
    cssCodeSplit: false,
    minify: false,
    reportCompressedSize: false,
    codeSplitting: false,
    lib: {
      entry: path.resolve(__dirname, 'src/renderer/shopWindowApp/main.js'),
      formats: ['es'],
      fileName: () => 'shop-window-app.js',
      cssFileName: 'shop-window-app'
    }
  }
});
