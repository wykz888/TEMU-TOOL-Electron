const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function findFirstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

function findWindowsExecutable(appOutDir, productFilename) {
  const expectedPath = path.join(appOutDir, `${productFilename}.exe`);
  if (fs.existsSync(expectedPath)) {
    return expectedPath;
  }

  const executable = fs
    .readdirSync(appOutDir)
    .find((entry) => entry.toLowerCase().endsWith('.exe') && !entry.includes('__uninstaller'));

  return executable ? path.join(appOutDir, executable) : null;
}

async function afterPackSetWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const projectDir = context.packager.projectDir;
  const rceditPath = findFirstExisting([
    path.join(projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'),
    path.join(projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit.exe'),
    path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'),
  ]);

  if (!rceditPath) {
    throw new Error('Unable to find rcedit.exe for Windows icon patching.');
  }

  const iconPath = path.join(projectDir, 'src', 'assets', 'icons', 'app-icon.ico');
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Windows app icon does not exist: ${iconPath}`);
  }

  const exePath = findWindowsExecutable(context.appOutDir, context.packager.appInfo.productFilename);
  if (!exePath) {
    throw new Error(`Unable to find Windows executable in ${context.appOutDir}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temu-icon-'));
  const tempExePath = path.join(tempDir, 'app.exe');
  const tempIconPath = path.join(tempDir, 'app.ico');

  try {
    fs.copyFileSync(exePath, tempExePath);
    fs.copyFileSync(iconPath, tempIconPath);
    execFileSync(rceditPath, [tempExePath, '--set-icon', tempIconPath], { stdio: 'inherit' });
    fs.copyFileSync(tempExePath, exePath);
    console.log(`[afterPackSetWindowsIcon] Patched icon: ${exePath}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = afterPackSetWindowsIcon;
module.exports.default = afterPackSetWindowsIcon;
