'use strict';

/**
 * \u5171\u4EAB\u9519\u8BEF\u6D88\u606F\u5F52\u4E00\u5316\u5DE5\u5177
 * - \u542B\u4E2D\u6587\u7684\u6D88\u606F\u76F4\u63A5\u653E\u884C
 * - JS \u8FD0\u884C\u65F6\u9519\u8BEF\u7FFB\u8BD1\u4E3A\u53CB\u597D\u63D0\u793A
 * - \u5176\u4ED6\u6280\u672F\u6027\u9519\u8BEF\u8F6C\u4E3A fallback \u63D0\u793A
 * - \u4FDD\u62A4\u7528\u6237\u4E0D\u770B\u5230 IPC\u3001session\u3001partition \u7B49\u5185\u90E8\u672F\u8BED
 */

/** @type {Array<[RegExp, string]>} */
const TECHNICAL_ERROR_PATTERNS = [
  [/Cannot read properties of undefined/i, '\u754C\u9762\u6A21\u5757\u52A0\u8F7D\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u5173\u95ED\u8F6F\u4EF6\u540E\u91CD\u65B0\u6253\u5F00\u3002'],
  [/is not defined/i, '\u754C\u9762\u6A21\u5757\u52A0\u8F7D\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u5173\u95ED\u8F6F\u4EF6\u540E\u91CD\u65B0\u6253\u5F00\u3002'],
  [/Unexpected token/i, '\u754C\u9762\u811A\u672C\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5173\u95ED\u8F6F\u4EF6\u540E\u91CD\u65B0\u6253\u5F00\u3002'],
  [/Unexpected identifier/i, '\u754C\u9762\u811A\u672C\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5173\u95ED\u8F6F\u4EF6\u540E\u91CD\u65B0\u6253\u5F00\u3002'],
  [/session/i, '\u8BF7\u6C42\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/partition/i, '\u8BF7\u6C42\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/IPC/i, '\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/ERR_CONNECTION/i, '\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002'],
  [/ECONNREFUSED/i, '\u7F51\u7EDC\u8FDE\u63A5\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002'],
  [/ETIMEDOUT/i, '\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/ENOTFOUND/i, '\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002'],
  [/protocol/i, '\u8BF7\u6C42\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/electron/i, '\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/preload/i, '\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/contextBridge/i, '\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'],
  [/__POD_SUITE_ERROR__/i, false]
];

/**
 * \u4ECE Error \u5BF9\u8C61\u6216\u5B57\u7B26\u4E32\u4E2D\u63D0\u53D6\u539F\u59CB\u6D88\u606F
 * @param {Error|string} error
 * @returns {string}
 */
function extractErrorMessage(error) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return '';
}

/**
 * \u68C0\u6D4B\u6D88\u606F\u662F\u5426\u5305\u542B\u4E2D\u6587\u5B57\u7B26
 * @param {string} message
 * @returns {boolean}
 */
function containsChinese(message) {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3000-\u303F]/u.test(message);
}

/**
 * \u68C0\u6D4B\u6D88\u606F\u662F\u5426\u5305\u542B\u6280\u672F\u6027\u5185\u5BB9
 * \u5982\u679C\u5305\u542B\u4E2D\u6587\u5C31\u8BA4\u4E3A\u662F\u5DF2\u7ECF\u7FFB\u8BD1\u597D\u7684\u53CB\u597D\u63D0\u793A\uFF0C\u4E0D\u8FC7\u6EE4
 * @param {string} message
 * @returns {string|null} \u5982\u679C\u5305\u542B\u6280\u672F\u6027\u5185\u5BB9\u8FD4\u56DE\u53CB\u597D\u63D0\u793A\uFF0C\u5426\u5219\u8FD4\u56DE null
 */
function detectTechnicalError(message) {
  if (!message || containsChinese(message)) {
    return null;
  }

  for (const [pattern, replacement] of TECHNICAL_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      if (replacement === false) {
        return null;
      }
      return replacement;
    }
  }

  return null;
}

/**
 * \u5F52\u4E00\u5316\u9519\u8BEF\u6D88\u606F\uFF0C\u7528\u4E8E\u5411\u7528\u6237\u5C55\u793A
 * - \u542B\u4E2D\u6587\u7684\u6D88\u606F\u76F4\u63A5\u653E\u884C\uFF08\u8BA4\u4E3A\u540E\u7AEF\u5DF2\u8FD4\u56DE\u53CB\u597D\u63D0\u793A\uFF09
 * - JS \u8FD0\u884C\u65F6\u9519\u8BEF \u2192 \u7FFB\u8BD1\u4E3A\u53CB\u597D\u63D0\u793A
 * - \u5176\u4ED6\u6280\u672F\u6027\u9519\u8BEF \u2192 \u8F6C\u4E3A fallback
 * - \u7A7A\u6D88\u606F \u2192 \u8FD4\u56DE fallback
 *
 * @param {Error|string} error - \u9519\u8BEF\u5BF9\u8C61\u6216\u5B57\u7B26\u4E32
 * @param {string} fallbackMessage - \u9ED8\u8BA4\u63D0\u793A\u6D88\u606F
 * @returns {string} \u53CB\u597D\u7684\u9519\u8BEF\u63D0\u793A\u6D88\u606F
 */
function normalizeErrorMessage(error, fallbackMessage) {
  const raw = extractErrorMessage(error);

  if (!raw) {
    return fallbackMessage;
  }

  if (containsChinese(raw)) {
    return raw;
  }

  const technicalFallback = detectTechnicalError(raw);
  if (technicalFallback) {
    return technicalFallback;
  }

  return fallbackMessage;
}

/**
 * \u7B80\u5355\u7248\u672C\uFF1A\u4EC5\u63D0\u53D6\u6D88\u606F\u6216\u8FD4\u56DE fallback
 * \u9002\u7528\u4E8E\u5DF2\u786E\u4FDD\u540E\u7AEF\u8FD4\u56DE\u53CB\u597D\u63D0\u793A\u7684\u573A\u666F
 * @param {Error|string} error
 * @param {string} fallback
 * @returns {string}
 */
function getErrorMessage(error, fallback) {
  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

module.exports = {
  extractErrorMessage,
  containsChinese,
  detectTechnicalError,
  normalizeErrorMessage,
  getErrorMessage
};
