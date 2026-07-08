function runCallback(callback) {
  if (typeof callback === 'function') {
    callback();
  }
}

export function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runCallback(callback), {
      once: true
    });
    return;
  }

  runCallback(callback);
}
