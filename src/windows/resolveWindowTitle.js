const { app } = require('electron');

function resolveWindowTitle(baseTitle = '') {
  const normalizedTitle = String(baseTitle || '').trim();

  if (app && app.isPackaged === true) {
    return normalizedTitle;
  }

  return normalizedTitle
    ? `${normalizedTitle} [DEV]`
    : '[DEV]';
}

module.exports = {
  resolveWindowTitle
};
