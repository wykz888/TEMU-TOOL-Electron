const fs = require('node:fs');
const { contextBridge } = require('electron');

(function initPhotopeaWrapperBridge() {
  let messages = [];

  function toArrayBuffer(buffer) {
    if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
      return buffer.buffer;
    }

    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  function getPhotopeaWindow() {
    const iframe = document.getElementById('photopea');

    if (!iframe || !iframe.contentWindow) {
      throw new Error('Photopea frame is not ready.');
    }

    return iframe.contentWindow;
  }

  window.addEventListener('message', (event) => {
    const data = event.data;

    if (data instanceof ArrayBuffer) {
      messages.push({
        kind: 'arrayBuffer',
        bytes: new Uint8Array(data)
      });
      return;
    }

    if (data && data.buffer instanceof ArrayBuffer && data.byteLength !== undefined) {
      messages.push({
        kind: 'arrayBuffer',
        bytes: new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength)
      });
      return;
    }

    messages.push({
      kind: 'string',
      value: String(data == null ? '' : data)
    });
  });

  contextBridge.exposeInMainWorld('__photopeaBridge', {
    takeMessages() {
      const taken = messages;
      messages = [];
      return taken;
    },
    postString(value) {
      getPhotopeaWindow().postMessage(String(value), '*');
    },
    async postFile(filePath) {
      const buffer = await fs.promises.readFile(String(filePath || ''));
      const arrayBuffer = toArrayBuffer(buffer);
      getPhotopeaWindow().postMessage(arrayBuffer, '*', [arrayBuffer]);
    }
  });
})();
