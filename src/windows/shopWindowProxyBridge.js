const http = require('node:http');
const net = require('node:net');
const { normalizeText } = require('../services/shopManagement/common');
const {
  getSocksReplyMessage
} = require('../utils/socks5Client');

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_CONNECT_TIMEOUT_MS = 15000;
const bridgeEntriesByKey = new Map();

function createBridgeError(message, code = 'SOCKS_BRIDGE_ERROR') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toBridgeError(error, fallbackMessage) {
  if (error && typeof error.message === 'string' && /[\u4e00-\u9fff]/u.test(error.message)) {
    return error;
  }

  if (!error) {
    return createBridgeError(fallbackMessage);
  }

  if (error.code === 'ECONNREFUSED') {
    return createBridgeError('代理服务器拒绝连接。', error.code);
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'SOCKS_BRIDGE_TIMEOUT') {
    return createBridgeError('代理连接超时。', error.code);
  }

  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
    return createBridgeError('代理地址无法解析。', error.code);
  }

  if (error.code === 'ECONNRESET') {
    return createBridgeError('代理服务器强制断开了连接。', error.code);
  }

  return createBridgeError(fallbackMessage, error.code || 'SOCKS_BRIDGE_ERROR');
}

function normalizeProxyConfig(proxyConfig) {
  return {
    type: normalizeText(proxyConfig && proxyConfig.type).toLowerCase(),
    host: normalizeText(proxyConfig && proxyConfig.host),
    port: normalizeText(proxyConfig && proxyConfig.port),
    username: normalizeText(proxyConfig && proxyConfig.username),
    password: normalizeText(proxyConfig && proxyConfig.password)
  };
}

function normalizePortNumber(value, fallbackPort = null) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue && Number.isInteger(fallbackPort)) {
    return fallbackPort;
  }

  const port = Number.parseInt(normalizedValue, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw createBridgeError('代理端口格式不正确。', 'SOCKS_BRIDGE_INVALID_PORT');
  }

  return port;
}

function buildBridgeKey(proxyConfig) {
  const normalizedProxyConfig = normalizeProxyConfig(proxyConfig);

  return [
    normalizedProxyConfig.type,
    normalizedProxyConfig.host,
    normalizedProxyConfig.port,
    normalizedProxyConfig.username,
    normalizedProxyConfig.password
  ].join('|');
}

function connectNetSocket(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = net.createConnection({
      host,
      port
    });

    function cleanup() {
      socket.removeListener('connect', handleConnect);
      socket.removeListener('timeout', handleTimeout);
      socket.removeListener('error', handleError);
    }

    function settleWithFailure(error) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    }

    function handleConnect() {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(socket);
    }

    function handleTimeout() {
      settleWithFailure(createBridgeError('代理连接超时。', 'SOCKS_BRIDGE_TIMEOUT'));
    }

    function handleError(error) {
      settleWithFailure(toBridgeError(error, '代理连接失败。'));
    }

    socket.setTimeout(timeoutMs);
    socket.once('connect', handleConnect);
    socket.once('timeout', handleTimeout);
    socket.once('error', handleError);
  });
}

function createBufferedSocket(socket) {
  let buffered = Buffer.alloc(0);
  let pending = null;
  let closed = false;

  function clearPending() {
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pending = null;
  }

  function rejectPending(error) {
    if (!pending) {
      return;
    }

    const currentPending = pending;
    clearPending();
    currentPending.reject(error);
  }

  function resolvePending(length) {
    if (!pending) {
      return;
    }

    const currentPending = pending;
    const chunk = buffered.subarray(0, length);
    buffered = buffered.subarray(length);
    clearPending();
    currentPending.resolve(chunk);
  }

  function flush() {
    if (!pending) {
      return;
    }

    if (buffered.length >= pending.length) {
      resolvePending(pending.length);
      return;
    }

    if (closed) {
      rejectPending(createBridgeError('代理服务器提前断开连接。', 'SOCKS_BRIDGE_SOCKET_CLOSED'));
    }
  }

  function handleData(chunk) {
    buffered = Buffer.concat([buffered, chunk]);
    flush();
  }

  function handleClosed() {
    closed = true;
    flush();
  }

  function handleError(error) {
    rejectPending(error);
  }

  socket.on('data', handleData);
  socket.on('end', handleClosed);
  socket.on('close', handleClosed);
  socket.on('error', handleError);

  function readAtLeast(length, timeoutMs = BRIDGE_CONNECT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      pending = {
        length,
        resolve,
        reject,
        timer: setTimeout(() => {
          rejectPending(createBridgeError('代理连接超时。', 'SOCKS_BRIDGE_TIMEOUT'));
        }, timeoutMs)
      };

      flush();
    });
  }

  function release() {
    clearPending();
    socket.removeListener('data', handleData);
    socket.removeListener('end', handleClosed);
    socket.removeListener('close', handleClosed);
    socket.removeListener('error', handleError);

    if (buffered.length > 0 && typeof socket.unshift === 'function') {
      socket.unshift(buffered);
      buffered = Buffer.alloc(0);
    }
  }

  return {
    readAtLeast,
    release
  };
}

function buildSocksAddressBuffer(destinationHost, destinationPort) {
  const normalizedHost = normalizeText(destinationHost);

  if (net.isIP(normalizedHost) || (Buffer.from(normalizedHost, 'utf8').length > 0 && Buffer.from(normalizedHost, 'utf8').length <= 255)) {
    return require('../utils/socks5Client').buildSocksAddressBuffer(destinationHost, destinationPort);
  }

  throw createBridgeError('代理目标域名格式不正确。', 'SOCKS_BRIDGE_INVALID_HOST');
}

async function connectThroughSocks5Proxy(proxyConfig, destinationHost, destinationPort) {
  const normalizedProxyConfig = normalizeProxyConfig(proxyConfig);
  const upstreamSocket = await connectNetSocket(
    normalizedProxyConfig.host,
    normalizePortNumber(normalizedProxyConfig.port),
    BRIDGE_CONNECT_TIMEOUT_MS
  );
  const reader = createBufferedSocket(upstreamSocket);
  const usernameBuffer = Buffer.from(normalizedProxyConfig.username, 'utf8');
  const passwordBuffer = Buffer.from(normalizedProxyConfig.password, 'utf8');
  const methods = usernameBuffer.length > 0 || passwordBuffer.length > 0 ? [0x00, 0x02] : [0x00];

  try {
    upstreamSocket.write(Buffer.from([0x05, methods.length, ...methods]));

    const methodResponse = await reader.readAtLeast(2);

    if (methodResponse[0] !== 0x05) {
      throw createBridgeError('SOCKS5 握手响应无效。', 'SOCKS_BRIDGE_PROTOCOL');
    }

    if (methodResponse[1] === 0xff) {
      throw createBridgeError('SOCKS5 代理不支持当前认证方式。', 'SOCKS_BRIDGE_AUTH_UNSUPPORTED');
    }

    if (methodResponse[1] === 0x02) {
      if (usernameBuffer.length > 255 || passwordBuffer.length > 255) {
        throw createBridgeError('SOCKS5 用户名或密码长度超出限制。', 'SOCKS_BRIDGE_AUTH_LENGTH');
      }

      upstreamSocket.write(
        Buffer.concat([
          Buffer.from([0x01, usernameBuffer.length]),
          usernameBuffer,
          Buffer.from([passwordBuffer.length]),
          passwordBuffer
        ])
      );

      const authResponse = await reader.readAtLeast(2);

      if (authResponse[1] !== 0x00) {
        throw createBridgeError('SOCKS5 用户名或密码错误。', 'SOCKS_BRIDGE_AUTH_FAILED');
      }
    }

    upstreamSocket.write(
      Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00]),
        buildSocksAddressBuffer(destinationHost, destinationPort)
      ])
    );

    const responseHead = await reader.readAtLeast(4);

    if (responseHead[0] !== 0x05) {
      throw createBridgeError('SOCKS5 连接响应无效。', 'SOCKS_BRIDGE_PROTOCOL');
    }

    if (responseHead[1] !== 0x00) {
      throw createBridgeError(
        getSocksReplyMessage(responseHead[1]),
        'SOCKS_BRIDGE_CONNECT_FAILED'
      );
    }

    if (responseHead[3] === 0x01) {
      await reader.readAtLeast(6);
    } else if (responseHead[3] === 0x04) {
      await reader.readAtLeast(18);
    } else if (responseHead[3] === 0x03) {
      const domainLengthBuffer = await reader.readAtLeast(1);
      await reader.readAtLeast(domainLengthBuffer[0] + 2);
    } else {
      throw createBridgeError('SOCKS5 返回了未知地址类型。', 'SOCKS_BRIDGE_PROTOCOL');
    }

    reader.release();
    return upstreamSocket;
  } catch (error) {
    reader.release();
    upstreamSocket.destroy();
    throw error;
  }
}

function parseConnectTarget(rawTarget) {
  try {
    const parsedUrl = new URL(`http://${String(rawTarget || '')}`);

    return {
      host: parsedUrl.hostname,
      port: normalizePortNumber(parsedUrl.port, 443)
    };
  } catch (_error) {
    return null;
  }
}

function parsePlainHttpTarget(clientRequest) {
  const rawUrl = String(clientRequest && clientRequest.url || '').trim();
  const hostHeader = normalizeText(clientRequest && clientRequest.headers && clientRequest.headers.host);
  let parsedUrl = null;

  try {
    parsedUrl = new URL(rawUrl);
  } catch (_error) {
    if (!hostHeader) {
      return null;
    }

    try {
      parsedUrl = new URL(rawUrl || '/', `http://${hostHeader}`);
    } catch (_innerError) {
      return null;
    }
  }

  if (normalizeText(parsedUrl.protocol).toLowerCase() !== 'http:') {
    return null;
  }

  return {
    host: parsedUrl.hostname,
    port: normalizePortNumber(parsedUrl.port, 80),
    path: `${parsedUrl.pathname || '/'}${parsedUrl.search || ''}`,
    hostHeader: parsedUrl.host
  };
}

function sanitizeHttpProxyHeaders(headers, hostHeader) {
  const nextHeaders = {};

  Object.entries(headers || {}).forEach(([headerName, headerValue]) => {
    const normalizedHeaderName = String(headerName || '').toLowerCase();

    if (
      normalizedHeaderName === 'proxy-connection'
      || normalizedHeaderName === 'proxy-authorization'
    ) {
      return;
    }

    nextHeaders[headerName] = headerValue;
  });

  if (!Object.keys(nextHeaders).some((headerName) => String(headerName).toLowerCase() === 'host')) {
    nextHeaders.Host = hostHeader;
  }

  return nextHeaders;
}

function respondWithSocketError(socket, statusCode, message) {
  if (!socket || socket.destroyed) {
    return;
  }

  socket.end(
    [
      `HTTP/1.1 ${statusCode} ${statusCode === 400 ? 'Bad Request' : 'Bad Gateway'}`,
      'Connection: close',
      'Content-Type: text/plain; charset=utf-8',
      `Content-Length: ${Buffer.byteLength(message || '', 'utf8')}`,
      '',
      message || ''
    ].join('\r\n')
  );
}

function respondWithHttpError(response, statusCode, message) {
  if (!response || response.writableEnded) {
    return;
  }

  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  response.end(message || '');
}

async function createBridgeServer(proxyConfig) {
  const normalizedProxyConfig = normalizeProxyConfig(proxyConfig);
  const server = http.createServer();

  server.on('connect', (request, clientSocket, head) => {
    void (async () => {
      const target = parseConnectTarget(request && request.url);

      if (!target) {
        respondWithSocketError(clientSocket, 400, 'CONNECT 目标地址格式不正确。');
        return;
      }

      let upstreamSocket = null;

      try {
        upstreamSocket = await connectThroughSocks5Proxy(
          normalizedProxyConfig,
          target.host,
          target.port
        );
      } catch (error) {
        respondWithSocketError(
          clientSocket,
          502,
          normalizeText(error && error.message) || 'SOCKS5 代理连接失败。'
        );
        return;
      }

      clientSocket.write(
        'HTTP/1.1 200 Connection Established\r\nProxy-Agent: TEMU-Toolbox\r\n\r\n'
      );

      if (head && head.length > 0) {
        upstreamSocket.write(head);
      }

      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);

      upstreamSocket.on('error', () => {
        clientSocket.destroy();
      });
      clientSocket.on('error', () => {
        upstreamSocket.destroy();
      });
    })();
  });

  server.on('request', (request, response) => {
    void (async () => {
      const target = parsePlainHttpTarget(request);

      if (!target) {
        respondWithHttpError(response, 400, '当前代理仅支持 HTTP 明文请求和 HTTPS CONNECT。');
        return;
      }

      let upstreamSocket = null;

      try {
        upstreamSocket = await connectThroughSocks5Proxy(
          normalizedProxyConfig,
          target.host,
          target.port
        );
      } catch (error) {
        respondWithHttpError(
          response,
          502,
          normalizeText(error && error.message) || 'SOCKS5 代理连接失败。'
        );
        return;
      }

      const proxyRequest = http.request({
        host: target.host,
        port: target.port,
        method: request.method,
        path: target.path,
        headers: sanitizeHttpProxyHeaders(request.headers, target.hostHeader),
        createConnection: () => upstreamSocket,
        agent: false,
        setHost: false
      }, (proxyResponse) => {
        response.writeHead(
          Number(proxyResponse.statusCode) || 502,
          proxyResponse.statusMessage || '',
          proxyResponse.headers
        );
        proxyResponse.pipe(response);
      });

      proxyRequest.on('error', (error) => {
        respondWithHttpError(
          response,
          502,
          normalizeText(error && error.message) || 'HTTP 代理请求失败。'
        );
      });

      request.on('aborted', () => {
        proxyRequest.destroy();
      });
      response.on('close', () => {
        proxyRequest.destroy();
      });

      request.pipe(proxyRequest);
    })();
  });

  server.on('clientError', (_error, socket) => {
    respondWithSocketError(socket, 400, '代理请求格式不正确。');
  });

  const address = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, BRIDGE_HOST, () => {
      server.removeListener('error', reject);
      resolve(server.address());
    });
  });

  if (!address || typeof address !== 'object' || !('port' in address)) {
    server.close();
    throw createBridgeError('本地代理桥接启动失败。', 'SOCKS_BRIDGE_START_FAILED');
  }

  return {
    server,
    port: address.port
  };
}

async function ensureSocks5ProxyBridge(proxyConfig) {
  const normalizedProxyConfig = normalizeProxyConfig(proxyConfig);

  if (
    normalizedProxyConfig.type !== 'socks5'
    || (!normalizedProxyConfig.username && !normalizedProxyConfig.password)
  ) {
    return '';
  }

  const bridgeKey = buildBridgeKey(normalizedProxyConfig);
  const existedEntry = bridgeEntriesByKey.get(bridgeKey);

  if (existedEntry && existedEntry.readyPromise) {
    const readyEntry = await existedEntry.readyPromise;
    return `http://${BRIDGE_HOST}:${readyEntry.port}`;
  }

  const nextEntry = {};
  nextEntry.readyPromise = createBridgeServer(normalizedProxyConfig)
    .then((serverEntry) => {
      nextEntry.server = serverEntry.server;
      nextEntry.port = serverEntry.port;
      return nextEntry;
    })
    .catch((error) => {
      bridgeEntriesByKey.delete(bridgeKey);
      throw error;
    });

  bridgeEntriesByKey.set(bridgeKey, nextEntry);

  const readyEntry = await nextEntry.readyPromise;
  return `http://${BRIDGE_HOST}:${readyEntry.port}`;
}

module.exports = {
  ensureSocks5ProxyBridge
};
