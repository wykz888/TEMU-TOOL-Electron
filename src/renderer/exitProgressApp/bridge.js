export function getExitProgressBridge() {
  if (
    window.temuExitProgress
    && typeof window.temuExitProgress.getPayload === 'function'
    && typeof window.temuExitProgress.onUpdate === 'function'
  ) {
    return window.temuExitProgress;
  }

  throw new Error('\u9000\u51fa\u4fdd\u5b58\u901a\u4fe1\u521d\u59cb\u5316\u5931\u8d25\u3002');
}
