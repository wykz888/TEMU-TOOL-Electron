/**
 * Attach a cleanup callback to a BrowserWindow's `closed` event.
 * The callback receives the window instance and runs after the window is destroyed.
 */
function bindWindowCleanup(window, onClosed) {
  if (window && !window.isDestroyed()) {
    window.on('closed', () => {
      if (typeof onClosed === 'function') onClosed(window);
    });
  }

  return window;
}

module.exports = {
  bindWindowCleanup
};
