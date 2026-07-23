const VIEW_LOAD_ERROR_PAGE_HASH = '#temu-toolbox-browser-load-error';

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isBrowserLoadErrorPageUrl(url) {
  return normalizeText(url).includes(VIEW_LOAD_ERROR_PAGE_HASH);
}

function describeViewLoadFailure(errorCode, errorDescription) {
  const normalizedDescription = normalizeText(errorDescription);
  const errorCodeLabel = Number.isFinite(Number(errorCode)) && Number(errorCode) !== 0
    ? ` (code ${Number(errorCode)})`
    : '';
  const errorCodeMap = {
    [-2]: '\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u540e\u91cd\u8bd5',
    [-3]: '\u8bf7\u6c42\u5df2\u88ab\u53d6\u6d88',
    [-6]: '\u7f51\u9875\u52a0\u8f7d\u5931\u8d25',
    [-7]: '\u5f53\u524d\u7f51\u7edc\u4e0d\u53ef\u7528',
    [-21]: '\u7f51\u9875\u88ab\u62d2\u7edd\u8bbf\u95ee',
    [-100]: '\u7f51\u7edc\u8fde\u63a5\u5df2\u4e2d\u65ad',
    [-101]: '\u7f51\u7edc\u8fde\u63a5\u5df2\u91cd\u7f6e',
    [-102]: '\u7f51\u7edc\u8fde\u63a5\u88ab\u62d2\u7edd',
    [-105]: 'DNS \u89e3\u6790\u5931\u8d25',
    [-106]: '\u7f51\u7edc\u5df2\u65ad\u5f00',
    [-109]: '\u76ee\u6807\u5730\u5740\u4e0d\u53ef\u8fbe',
    [-111]: '\u4ee3\u7406\u96a7\u9053\u5efa\u7acb\u5931\u8d25',
    [-118]: '\u8fde\u63a5\u8d85\u65f6',
    [-130]: '\u4ee3\u7406\u8fde\u63a5\u5931\u8d25'
  };
  const baseText = errorCodeMap[Number(errorCode)] || normalizedDescription || '\u9875\u9762\u52a0\u8f7d\u5931\u8d25';

  if (!normalizedDescription || normalizedDescription === baseText) {
    return `${baseText}${errorCodeLabel}`;
  }

  return `${baseText}${errorCodeLabel}\uff1a${normalizedDescription}`;
}

function buildViewLoadErrorPageDataUrl(payload = {}) {
  const title = escapeHtml(payload.title || '\u9875\u9762\u6682\u65f6\u6253\u4e0d\u5f00');
  const message = escapeHtml(payload.message || '\u5f53\u524d\u9875\u9762\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002');
  const targetUrl = escapeHtml(payload.targetUrl || '');
  const proxySummary = escapeHtml(payload.proxySummary || '');
  const detailText = escapeHtml(payload.detailText || '');
  const actionText = escapeHtml(payload.actionText || '\u53ef\u6309 F5 \u91cd\u8bd5\uff0c\u6216\u68c0\u67e5\u5f53\u524d\u5e97\u94fa\u4ee3\u7406\u7ebf\u8def\u3002');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --card: #ffffff;
      --line: #d7ddea;
      --text: #10203a;
      --muted: #5d6b82;
      --accent: #0f6fff;
      --accent-soft: rgba(15, 111, 255, 0.08);
      --danger: #d33b32;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px;
      background:
        radial-gradient(circle at top left, rgba(15, 111, 255, 0.10), transparent 34%),
        linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%);
      font-family: "Microsoft YaHei UI", "PingFang SC", sans-serif;
      color: var(--text);
    }
    .panel {
      width: min(760px, 100%);
      padding: 28px 30px;
      border-radius: 18px;
      background: var(--card);
      border: 1px solid var(--line);
      box-shadow: 0 18px 48px rgba(16, 32, 58, 0.10);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    h1 {
      margin: 14px 0 10px;
      font-size: 26px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      line-height: 1.7;
      color: var(--muted);
      font-size: 14px;
    }
    .message {
      margin-top: 10px;
      color: var(--text);
      font-size: 16px;
      font-weight: 600;
    }
    .meta {
      margin-top: 18px;
      display: grid;
      gap: 10px;
    }
    .meta-item {
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: #f9fbff;
    }
    .meta-label {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 12px;
    }
    .meta-value {
      color: var(--text);
      font-size: 14px;
      word-break: break-all;
    }
    .tips {
      margin-top: 20px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(211, 59, 50, 0.06);
      color: var(--danger);
      font-size: 13px;
      line-height: 1.7;
    }
  </style>
</head>
<body>
  <section class="panel">
    <span class="badge">\u6d4f\u89c8\u5668\u52a0\u8f7d\u63d0\u793a</span>
    <h1>${title}</h1>
    <p class="message">${message}</p>
    <div class="meta">
      ${targetUrl ? `
        <div class="meta-item">
          <span class="meta-label">\u76ee\u6807\u7f51\u5740</span>
          <span class="meta-value">${targetUrl}</span>
        </div>
      ` : ''}
      ${proxySummary ? `
        <div class="meta-item">
          <span class="meta-label">\u5f53\u524d\u4ee3\u7406</span>
          <span class="meta-value">${proxySummary}</span>
        </div>
      ` : ''}
      ${detailText ? `
        <div class="meta-item">
          <span class="meta-label">\u5931\u8d25\u8bf4\u660e</span>
          <span class="meta-value">${detailText}</span>
        </div>
      ` : ''}
    </div>
    <div class="tips">${actionText}</div>
  </section>
</body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}${VIEW_LOAD_ERROR_PAGE_HASH}`;
}

module.exports = {
  VIEW_LOAD_ERROR_PAGE_HASH,
  buildViewLoadErrorPageDataUrl,
  describeViewLoadFailure,
  escapeHtml,
  isBrowserLoadErrorPageUrl
};
