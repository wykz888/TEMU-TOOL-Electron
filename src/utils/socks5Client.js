const net = require('node:net');
const { normalizeText } = require('../services/shopManagement/common');

function buildSocksAddressBuffer(destinationHost, destinationPort) {
  const normalizedHost = normalizeText(destinationHost);
  const ipVersion = net.isIP(normalizedHost);
  const portHigh = (destinationPort >> 8) & 0xff;
  const portLow = destinationPort & 0xff;

  if (ipVersion === 4) {
    return Buffer.from([
      0x01,
      ...normalizedHost.split('.').map((segment) => Number.parseInt(segment, 10)),
      portHigh,
      portLow
    ]);
  }

  if (ipVersion === 6) {
    const segments = normalizedHost.replace(/^\[|\]$/g, '').split(':');
    const expandedSegments = [];
    const missingGroupCount = 8 - segments.filter((segment) => segment !== '').length;

    segments.forEach((segment) => {
      if (segment === '') {
        if (expandedSegments.length === 0 || segments[segments.length - 1] === '') {
          for (let index = 0; index <= missingGroupCount; index += 1) {
            expandedSegments.push('0');
          }
        }
      } else {
        expandedSegments.push(segment);
      }
    });

    const ipv6Bytes = [];
    expandedSegments.slice(0, 8).forEach((segment) => {
      const value = Number.parseInt(segment || '0', 16) || 0;
      ipv6Bytes.push((value >> 8) & 0xff, value & 0xff);
    });

    return Buffer.from([0x04, ...ipv6Bytes, portHigh, portLow]);
  }

  const domainBuffer = Buffer.from(normalizedHost, 'utf8');
  return Buffer.concat([
    Buffer.from([0x03, domainBuffer.length]),
    domainBuffer,
    Buffer.from([portHigh, portLow])
  ]);
}

function getSocksReplyMessage(replyCode) {
  switch (replyCode) {
    case 0x01:
      return 'SOCKS5 代理通用失败。';
    case 0x02:
      return 'SOCKS5 代理规则不允许当前连接。';
    case 0x03:
      return 'SOCKS5 代理网络不可达。';
    case 0x04:
      return 'SOCKS5 代理主机不可达。';
    case 0x05:
      return 'SOCKS5 代理拒绝了当前连接。';
    case 0x06:
      return 'SOCKS5 代理连接已超时。';
    case 0x07:
      return 'SOCKS5 代理不支持当前命令。';
    case 0x08:
      return 'SOCKS5 代理不支持当前地址类型。';
    default:
      return `SOCKS5 代理返回了未知状态码：${replyCode}。`;
  }
}

async function performSocks5Handshake(socket, reader, username, password) {
  const usernameBuffer = Buffer.from(normalizeText(username), 'utf8');
  const passwordBuffer = Buffer.from(normalizeText(password), 'utf8');
  const methods = usernameBuffer.length > 0 || passwordBuffer.length > 0 ? [0x00, 0x02] : [0x00];

  socket.write(Buffer.from([0x05, methods.length, ...methods]));

  const methodResponse = await reader.readAtLeast(2);

  if (methodResponse[0] !== 0x05) {
    throw new Error('SOCKS5 协议响应无效。');
  }

  if (methodResponse[1] === 0xff) {
    throw new Error('SOCKS5 代理不支持当前认证方式。');
  }

  if (methodResponse[1] === 0x02) {
    if (usernameBuffer.length > 255 || passwordBuffer.length > 255) {
      throw new Error('SOCKS5 用户名或密码长度超出限制。');
    }

    socket.write(
      Buffer.concat([
        Buffer.from([0x01, usernameBuffer.length]),
        usernameBuffer,
        Buffer.from([passwordBuffer.length]),
        passwordBuffer
      ])
    );

    const authResponse = await reader.readAtLeast(2);

    if (authResponse[1] !== 0x00) {
      throw new Error('SOCKS5 用户名或密码错误。');
    }
  }
}

async function performSocks5Connect(socket, reader, destinationHost, destinationPort) {
  const addressBuffer = buildSocksAddressBuffer(destinationHost, destinationPort);

  socket.write(Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00]),
    addressBuffer
  ]));

  const responseHead = await reader.readAtLeast(4);

  if (responseHead[0] !== 0x05) {
    throw new Error('SOCKS5 连接响应无效。');
  }

  if (responseHead[1] !== 0x00) {
    throw new Error(getSocksReplyMessage(responseHead[1]));
  }

  if (responseHead[3] === 0x01) {
    await reader.readAtLeast(6);
  } else if (responseHead[3] === 0x04) {
    await reader.readAtLeast(18);
  } else if (responseHead[3] === 0x03) {
    const domainLengthBuffer = await reader.readAtLeast(1);
    await reader.readAtLeast(domainLengthBuffer[0] + 2);
  } else {
    throw new Error('SOCKS5 返回了未知地址类型。');
  }
}

module.exports = {
  buildSocksAddressBuffer,
  getSocksReplyMessage,
  performSocks5Handshake,
  performSocks5Connect
};
