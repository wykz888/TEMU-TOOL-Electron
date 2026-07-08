'use strict';

/**
 * Feature Center IPC handler \u5171\u7528\u5DE5\u5177\u51FD\u6570
 * \u7528\u4E8E\u6D88\u9664 main.js \u4E2D emitProgress \u548C requesterKey \u7684\u91CD\u590D\u6A21\u677F
 */

/**
 * \u521B\u5EFA emitProgress \u56DE\u8C03\u5DE5\u5382
 * @param {Object} context - IPC context \u5BF9\u8C61
 * @param {string} progressChannel - \u53D1\u9001\u8FDB\u5EA6\u7684 IPC \u901A\u9053\u540D
 * @param {Object} [runtimeLogger] - \u53EF\u9009\u7684\u65E5\u5FD7\u8BB0\u5F55\u5668
 * @returns {Function} emitProgress(progressPayload) \u56DE\u8C03\u51FD\u6570
 */
function createProgressEmitter(context, progressChannel, runtimeLogger) {
  return function emitProgress(progressPayload) {
    const event = context && context.event;
    const sender = event && event.sender;

    if (!sender || sender.isDestroyed()) {
      return;
    }

    try {
      sender.send(progressChannel, progressPayload);
    } catch (error) {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError(
          String(progressChannel).replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '_send_failed',
          error
        );
      }
    }
  };
}

/**
 * \u4ECE IPC context \u4E2D\u63D0\u53D6 requesterKey
 * @param {Object} context - IPC context \u5BF9\u8C61
 * @returns {string}
 */
function extractRequesterKey(context) {
  return String(
    context
    && context.event
    && context.event.sender
    && context.event.sender.id
    || ''
  ).trim();
}

module.exports = {
  createProgressEmitter,
  extractRequesterKey
};
