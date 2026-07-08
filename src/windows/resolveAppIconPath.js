const fs = require('node:fs');
const path = require('node:path');

function resolveAppIconPath() {
  const iconDir = path.join(__dirname, '..', 'assets', 'icons');
  const candidates = process.platform === 'win32'
    ? ['app-icon.ico', 'app-icon.png']
    : ['app-icon.png', 'app-icon.ico'];

  for (const fileName of candidates) {
    const iconPath = path.join(iconDir, fileName);

    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  return undefined;
}

module.exports = {
  resolveAppIconPath
};
