const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  emitPhotopeaDebug
} = require('./photopeaRuntimeLogger');

const PHOTOPEA_URL = 'https://www.photopea.com';

function createPhotopeaConfig(overrides = {}) {
  return {
    environment: {
      intro: false,
      ...(overrides.environment && typeof overrides.environment === 'object' ? overrides.environment : {})
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== 'environment')
    )
  };
}

function makePhotopeaWrapperHtml(configOverrides = {}) {
  const config = createPhotopeaConfig(configOverrides);
  const iframeUrl = `${PHOTOPEA_URL}#${encodeURIComponent(JSON.stringify(config))}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body, iframe {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      overflow: hidden;
      background: #111;
    }
  </style>
</head>
<body>
  <iframe id="photopea" src="${iframeUrl}"></iframe>
</body>
</html>`;
}

function getContentTypeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.psb': 'application/octet-stream',
    '.psd': 'image/vnd.adobe.photoshop',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp'
  };

  return contentTypes[extension] || 'application/octet-stream';
}

function applyCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Access-Control-Request-Private-Network');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
}

class PhotopeaLocalFileServer {
  constructor({ runtimeLogger } = {}) {
    this.runtimeLogger = runtimeLogger || null;
    this.server = null;
    this.port = 0;
    this.files = new Map();
    this.wrapperHtml = '';
  }

  async ensureStarted() {
    if (this.server && this.port) {
      return;
    }

    const server = http.createServer((request, response) => {
      this.handleRequest(request, response);
    });
    this.server = server;

    try {
      await new Promise((resolve, reject) => {
        const handleError = (error) => {
          server.removeListener('listening', handleListening);
          reject(error);
        };
        const handleListening = () => {
          server.removeListener('error', handleError);
          const address = server.address();
          this.port = address && typeof address === 'object' ? Number(address.port) : 0;
          resolve();
        };

        server.once('error', handleError);
        server.once('listening', handleListening);
        server.listen(0, '127.0.0.1');
      });
    } catch (error) {
      this.server = null;
      this.port = 0;
      this.files.clear();
      await emitPhotopeaDebug(this.runtimeLogger, 'local-file-server-start-failed', {
        message: String(error && error.message || error || '')
      });
      throw error;
    }

    await emitPhotopeaDebug(this.runtimeLogger, 'local-file-server-started', {
      port: this.port
    });
  }

  async addFile(filePath) {
    await this.ensureStarted();

    const absolutePath = path.resolve(String(filePath || ''));
    const stat = await fs.promises.stat(absolutePath);
    const token = crypto.randomBytes(16).toString('hex');
    const fileName = path.basename(absolutePath);

    this.files.set(token, {
      filePath: absolutePath,
      size: stat.size,
      contentType: getContentTypeForFile(absolutePath)
    });

    return `http://127.0.0.1:${this.port}/files/${token}/${encodeURIComponent(fileName)}`;
  }

  async setWrapperHtml(html) {
    await this.ensureStarted();
    this.wrapperHtml = String(html || '');

    return `http://127.0.0.1:${this.port}/wrapper`;
  }

  handleRequest(request, response) {
    applyCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405);
      response.end();
      return;
    }

    let parsedUrl = null;
    try {
      parsedUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    } catch (_error) {
      parsedUrl = null;
    }

    if (parsedUrl && parsedUrl.pathname === '/wrapper') {
      const body = this.wrapperHtml || '<!doctype html><html><body></body></html>';
      const buffer = Buffer.from(body, 'utf8');

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': buffer.length,
        'Content-Type': 'text/html; charset=utf-8'
      });

      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      response.end(buffer);
      return;
    }

    const parts = parsedUrl ? parsedUrl.pathname.split('/').filter(Boolean) : [];
    const token = parts[0] === 'files' ? parts[1] : '';
    const record = token ? this.files.get(token) : null;
    if (!record) {
      response.writeHead(404);
      response.end();
      return;
    }

    const headers = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Type': record.contentType
    };
    const rangeHeader = String(request.headers.range || '');
    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    let start = 0;
    let end = Math.max(0, record.size - 1);
    let statusCode = 200;

    if (rangeMatch) {
      const requestedStart = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
      const requestedEnd = rangeMatch[2] ? Number(rangeMatch[2]) : end;

      if (
        Number.isFinite(requestedStart)
        && Number.isFinite(requestedEnd)
        && requestedStart >= 0
        && requestedStart <= requestedEnd
        && requestedStart < record.size
      ) {
        start = requestedStart;
        end = Math.min(requestedEnd, record.size - 1);
        statusCode = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${record.size}`;
      }
    }

    headers['Content-Length'] = Math.max(0, end - start + 1);
    response.writeHead(statusCode, headers);

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = fs.createReadStream(record.filePath, {
      start,
      end
    });

    stream.on('error', (error) => {
      if (this.runtimeLogger && typeof this.runtimeLogger.logError === 'function') {
        this.runtimeLogger.logError('pod_suite_tool_photopea_file_server_failed', error);
      }
      response.destroy(error);
    });
    stream.pipe(response);
  }

  async close() {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;
    this.port = 0;
    this.files.clear();
    this.wrapperHtml = '';

    await new Promise((resolve) => {
      server.close((error) => {
        if (error && this.runtimeLogger && typeof this.runtimeLogger.logError === 'function') {
          this.runtimeLogger.logError('pod_suite_tool_photopea_file_server_close_failed', error);
        }
        resolve();
      });
    });
  }
}

module.exports = {
  PhotopeaLocalFileServer,
  makePhotopeaWrapperHtml
};
