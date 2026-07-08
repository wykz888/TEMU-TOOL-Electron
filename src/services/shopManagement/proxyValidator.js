const net = require('node:net');
const tls = require('node:tls');
const { normalizeText } = require('./common');
const { performSocks5Handshake, performSocks5Connect } = require('../../utils/socks5Client');

const PROXY_CHECK_TIMEOUT = 7000;
const PROXY_TARGET = Object.freeze({
  host: 'www.qq.com',
  port: 443
});

function createTimeoutError() {
  const error = new Error('\u4EE3\u7406\u8FDE\u63A5\u8D85\u65F6\u3002');
  error.code = 'PROXY_TIMEOUT';
  return error;
}

function toSocketError(error, fallbackMessage) {
  if (error && typeof error.message === 'string' && /[\u4e00-\u9fff]/u.test(error.message)) {
    return error;
  }

  if (!error) {
    return new Error(fallbackMessage);
  }

  if (error.code === 'ECONNREFUSED') {
    return new Error('\u4EE3\u7406\u670D\u52A1\u5668\u62D2\u7EDD\u8FDE\u63A5\u3002');
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'PROXY_TIMEOUT') {
    return new Error('\u4EE3\u7406\u8FDE\u63A5\u8D85\u65F6\u3002');
  }

  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
    return new Error('\u4EE3\u7406 IP \u5730\u5740\u65E0\u6CD5\u89E3\u6790\u3002');
  }

  if (error.code === 'ECONNRESET') {
    return new Error('\u4EE3\u7406\u670D\u52A1\u5668\u5F3A\u5236\u65AD\u5F00\u4E86\u8FDE\u63A5\u3002');
  }

  return new Error(fallbackMessage);
}

function normalizePortNumber(value) {
  const normalized = Number.parseInt(String(value || '').trim(), 10);

  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 65535) {
    throw new Error('\u4EE3\u7406\u7AEF\u53E3\u683C\u5F0F\u4E0D\u6B63\u786E\u3002');
  }

  return normalized;
}

function connectNetSocket(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = net.createConnection({
      host,
      port
    });

    function cleanup() {
      socket.removeAllListeners('connect');
      socket.removeAllListeners('timeout');
      socket.removeAllListeners('error');
    }

    function fail(error) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    }

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(socket);
    });
    socket.once('timeout', () => fail(createTimeoutError()));
    socket.once('error', fail);
  });
}

function connectTlsSocket(host, port, timeoutMs) {
  console.warn(
    '[ProxyValidator] TLS certificate verification disabled for proxy connectivity check. '
    + 'This is intentional — only tests TCP/TLS reachability, not certificate validity.'
  );
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = tls.connect({
      host,
      port,
      servername: host,
      rejectUnauthorized: false
    });

    function cleanup() {
      socket.removeAllListeners('secureConnect');
      socket.removeAllListeners('timeout');
      socket.removeAllListeners('error');
    }

    function fail(error) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    }

    socket.setTimeout(timeoutMs);
    socket.once('secureConnect', () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(socket);
    });
    socket.once('timeout', () => fail(createTimeoutError()));
    socket.once('error', fail);
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

    if (pending.kind === 'atLeast' && buffered.length >= pending.length) {
      resolvePending(pending.length);
      return;
    }

    if (pending.kind === 'until') {
      const index = buffered.indexOf(pending.token);

      if (index !== -1) {
        resolvePending(index + pending.token.length);
        return;
      }
    }

    if (closed) {
      rejectPending(new Error('\u4EE3\u7406\u670D\u52A1\u5668\u63D0\u524D\u65AD\u5F00\u8FDE\u63A5\u3002'));
    }
  }

  socket.on('data', (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    flush();
  });

  socket.on('end', () => {
    closed = true;
    flush();
  });

  socket.on('close', () => {
    closed = true;
    flush();
  });

  socket.on('error', (error) => {
    closed = true;
    rejectPending(error);
  });

  function readAtLeast(length, timeoutMs = PROXY_CHECK_TIMEOUT) {
    return new Promise((resolve, reject) => {
      pending = {
        kind: 'atLeast',
        length,
        resolve,
        reject,
        timer: setTimeout(() => {
          rejectPending(createTimeoutError());
        }, timeoutMs)
      };

      flush();
    });
  }

  function readUntil(token, timeoutMs = PROXY_CHECK_TIMEOUT) {
    return new Promise((resolve, reject) => {
      pending = {
        kind: 'until',
        token: Buffer.isBuffer(token) ? token : Buffer.from(token),
        resolve,
        reject,
        timer: setTimeout(() => {
          rejectPending(createTimeoutError());
        }, timeoutMs)
      };

      flush();
    });
  }

  return {
    readAtLeast,
    readUntil
  };
}

async function probeConnectProxy(proxyConfig) {
  const connect = proxyConfig.type === 'https' ? connectTlsSocket : connectNetSocket;
  const socket = await connect(proxyConfig.host, normalizePortNumber(proxyConfig.port), PROXY_CHECK_TIMEOUT);
  const reader = createBufferedSocket(socket);
  const headers = [
    `CONNECT ${PROXY_TARGET.host}:${PROXY_TARGET.port} HTTP/1.1`,
    `Host: ${PROXY_TARGET.host}:${PROXY_TARGET.port}`,
    'Proxy-Connection: Keep-Alive',
    'User-Agent: TEMU-Toolbox/1.0'
  ];

  if (normalizeText(proxyConfig.username) || normalizeText(proxyConfig.password)) {
    headers.push(
      `Proxy-Authorization: Basic ${Buffer.from(
        `${normalizeText(proxyConfig.username)}:${normalizeText(proxyConfig.password)}`
      ).toString('base64')}`
    );
  }

  socket.write(`${headers.join('\r\n')}\r\n\r\n`);

  try {
    const responseBuffer = await reader.readUntil('\r\n\r\n');
    const responseText = responseBuffer.toString('utf8');
    const statusLine = responseText.split('\r\n')[0] || '';
    const matchedStatus = statusLine.match(/HTTP\/\d\.\d\s+(\d{3})/);

    if (!matchedStatus) {
      throw new Error('\u4EE3\u7406\u670D\u52A1\u5668\u54CD\u5E94\u683C\u5F0F\u4E0D\u6B63\u786E\u3002');
    }

    const statusCode = Number(matchedStatus[1]);

    if (statusCode === 200) {
      return;
    }

    if (statusCode === 407) {
      throw new Error('\u4EE3\u7406\u7528\u6237\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF\u3002');
    }

    throw new Error(`\u4EE3\u7406\u9A8C\u8BC1\u5931\u8D25\uFF0C\u72B6\u6001\u7801\uFF1A${statusCode}\u3002`);
  } finally {
    socket.destroy();
  }
}

async function probeSocks5Proxy(proxyConfig) {
  const socket = await connectNetSocket(proxyConfig.host, normalizePortNumber(proxyConfig.port), PROXY_CHECK_TIMEOUT);
  const reader = createBufferedSocket(socket);

  try {
    await performSocks5Handshake(
      socket, reader,
      normalizeText(proxyConfig.username),
      normalizeText(proxyConfig.password)
    );
    await performSocks5Connect(socket, reader, PROXY_TARGET.host, PROXY_TARGET.port);
  } finally {
    socket.destroy();
  }
}

async function validateProxyAvailability(proxyConfig) {
  const startTime = Date.now();

  if (!proxyConfig || proxyConfig.type === 'local') {
    return {
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      target: `${PROXY_TARGET.host}:${PROXY_TARGET.port}`
    };
  }

  try {
    if (proxyConfig.type === 'socks5') {
      await probeSocks5Proxy(proxyConfig);
    } else {
      await probeConnectProxy(proxyConfig);
    }

    return {
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      target: `${PROXY_TARGET.host}:${PROXY_TARGET.port}`
    };
  } catch (error) {
    throw toSocketError(error, '\u4EE3\u7406\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u4EE3\u7406\u914D\u7F6E\u3002');
  }
}

module.exports = {
  validateProxyAvailability
};
