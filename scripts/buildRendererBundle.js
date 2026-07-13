const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const WINDOWS_ASCII_FALLBACK_DRIVES = Object.freeze(['X', 'Y', 'Z', 'W', 'V']);

const TARGETS = Object.freeze({
  'global-config': {
    config: 'vite.global-config.config.mjs',
    sourceDirs: ['src/renderer/globalConfigApp'],
    outputFiles: [
      'src/renderer/globalConfigApp/dist/global-config-app.js',
      'src/renderer/globalConfigApp/dist/global-config-app.css'
    ]
  },
  'confirm-dialog': {
    config: 'vite.confirm-dialog.config.mjs',
    sourceDirs: ['src/renderer/confirmDialogApp'],
    outputFiles: [
      'src/renderer/confirmDialogApp/dist/confirm-dialog-app.js',
      'src/renderer/confirmDialogApp/dist/confirm-dialog-app.css'
    ]
  },
  'exit-progress': {
    config: 'vite.exit-progress.config.mjs',
    sourceDirs: ['src/renderer/exitProgressApp'],
    outputFiles: [
      'src/renderer/exitProgressApp/dist/exit-progress-app.js',
      'src/renderer/exitProgressApp/dist/exit-progress-app.css'
    ]
  },
  'shop-management': {
    config: 'vite.shop-management.config.mjs',
    sourceDirs: ['src/renderer/shopManagementApp'],
    outputFiles: [
      'src/renderer/shopManagementApp/dist/shop-management-app.js',
      'src/renderer/shopManagementApp/dist/shop-management-app.css'
    ]
  },
  'main-window': {
    config: 'vite.main-window.config.mjs',
    sourceDirs: ['src/renderer/mainWindowApp'],
    outputFiles: [
      'src/renderer/mainWindowApp/dist/main-window-app.js',
      'src/renderer/mainWindowApp/dist/main-window-app.css'
    ]
  },
  'feature-center': {
    config: 'vite.feature-center.config.mjs',
    sourceDirs: [
      'src/renderer/featureCenterApp',
      'src/renderer/catalogCenterShared'
    ],
    outputFiles: [
      'src/renderer/featureCenterApp/dist/feature-center-app.js',
      'src/renderer/featureCenterApp/dist/feature-center-app.css'
    ]
  },
  'creation-center': {
    config: 'vite.creation-center.config.mjs',
    sourceDirs: [
      'src/renderer/creationCenterApp',
      'src/renderer/catalogCenterShared'
    ],
    outputFiles: [
      'src/renderer/creationCenterApp/dist/creation-center-app.js',
      'src/renderer/creationCenterApp/dist/creation-center-app.css'
    ]
  },
  'shop-window': {
    config: 'vite.shop-window.config.mjs',
    sourceDirs: ['src/renderer/shopWindowApp'],
    outputFiles: [
      'src/renderer/shopWindowApp/dist/shop-window-app.js',
      'src/renderer/shopWindowApp/dist/shop-window-app.css'
    ]
  },
  'promotion-manager': {
    config: 'vite.promotion-manager.config.mjs',
    sourceDirs: ['src/renderer/promotionManagerApp'],
    outputFiles: [
      'src/renderer/promotionManagerApp/dist/promotion-manager-app.js',
      'src/renderer/promotionManagerApp/dist/promotion-manager-app.css'
    ]
  },
  'psd-smart-suite': {
    config: 'vite.psd-smart-suite.config.mjs',
    sourceDirs: ['src/renderer/psdSmartSuiteApp'],
    outputFiles: [
      'src/renderer/psdSmartSuiteApp/dist/psd-smart-suite-app.js',
      'src/renderer/psdSmartSuiteApp/dist/psd-smart-suite-app.css'
    ]
  },
  'pod-upload-sheet-miaoshou': {
    config: 'vite.pod-upload-sheet-miaoshou.config.mjs',
    sourceDirs: ['src/renderer/podUploadSheetMiaoshouApp'],
    outputFiles: [
      'src/renderer/podUploadSheetMiaoshouApp/dist/pod-upload-sheet-miaoshou-app.js',
      'src/renderer/podUploadSheetMiaoshouApp/dist/pod-upload-sheet-miaoshou-app.css'
    ]
  },
  'pod-upload-sheet-miaoshou-universal': {
    config: 'vite.pod-upload-sheet-miaoshou-universal.config.mjs',
    sourceDirs: ['src/renderer/podUploadSheetMiaoshouUniversalApp'],
    outputFiles: [
      'src/renderer/podUploadSheetMiaoshouUniversalApp/dist/pod-upload-sheet-miaoshou-universal-app.js',
      'src/renderer/podUploadSheetMiaoshouUniversalApp/dist/pod-upload-sheet-miaoshou-universal-app.css'
    ]
  },
  'global-category-sync': {
    config: 'vite.global-category-sync.config.mjs',
    sourceDirs: ['src/renderer/globalCategorySyncApp'],
    outputFiles: [
      'src/renderer/globalCategorySyncApp/dist/global-category-sync-app.js',
      'src/renderer/globalCategorySyncApp/dist/global-category-sync-app.css'
    ]
  }
});

function resolveWorkspacePath(relativePath) {
  return path.resolve(ROOT_DIR, relativePath);
}

function getEntryMtimeMs(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);

  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  let latestMtimeMs = stat.mtimeMs;
  const children = fs.readdirSync(targetPath, { withFileTypes: true });

  for (const child of children) {
    if (child.name === 'dist') {
      continue;
    }

    const childPath = path.join(targetPath, child.name);
    const childMtimeMs = getEntryMtimeMs(childPath);

    if (childMtimeMs > latestMtimeMs) {
      latestMtimeMs = childMtimeMs;
    }
  }

  return latestMtimeMs;
}

function getLatestSourceMtimeMs(sourceDirs) {
  return sourceDirs.reduce((latestMtimeMs, sourceDir) => {
    const sourcePath = resolveWorkspacePath(sourceDir);
    const sourceMtimeMs = getEntryMtimeMs(sourcePath);

    return sourceMtimeMs > latestMtimeMs ? sourceMtimeMs : latestMtimeMs;
  }, 0);
}

function getOldestOutputMtimeMs(outputFiles) {
  let oldestMtimeMs = Number.POSITIVE_INFINITY;

  for (const outputFile of outputFiles) {
    const outputPath = resolveWorkspacePath(outputFile);

    if (!fs.existsSync(outputPath)) {
      return 0;
    }

    const outputMtimeMs = fs.statSync(outputPath).mtimeMs;

    if (outputMtimeMs < oldestMtimeMs) {
      oldestMtimeMs = outputMtimeMs;
    }
  }

  return Number.isFinite(oldestMtimeMs) ? oldestMtimeMs : 0;
}

function runViteBuild(buildRoot, configFile) {
  const viteExecutable = process.execPath;
  return spawnSync(
    viteExecutable,
    [path.resolve(buildRoot, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.resolve(buildRoot, configFile)],
    {
      cwd: buildRoot,
      stdio: 'inherit',
      windowsHide: true
    }
  );
}

function hasNonAsciiPath(targetPath) {
  return /[^\u0000-\u007f]/.test(String(targetPath || ''));
}

function pickFallbackDriveLetter() {
  for (const driveLetter of WINDOWS_ASCII_FALLBACK_DRIVES) {
    if (!fs.existsSync(`${driveLetter}:\\`)) {
      return driveLetter;
    }
  }

  return null;
}

function tryWindowsAsciiPathFallback(target) {
  if (process.platform !== 'win32' || !hasNonAsciiPath(ROOT_DIR)) {
    return null;
  }

  const driveLetter = pickFallbackDriveLetter();

  if (!driveLetter) {
    return null;
  }

  const mappedRoot = `${driveLetter}:\\`;
  const substCreateResult = spawnSync('subst', [`${driveLetter}:`, ROOT_DIR], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    windowsHide: true
  });

  if (substCreateResult.status !== 0) {
    return null;
  }

  try {
    return runViteBuild(mappedRoot, target.config);
  } finally {
    spawnSync('subst', [`${driveLetter}:`, '/d'], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      windowsHide: true
    });
  }
}

function runBuild(targetName) {
  const target = TARGETS[targetName];

  if (!target) {
    throw new Error(`Unknown renderer bundle target: ${targetName}`);
  }

  const latestSourceMtimeMs = getLatestSourceMtimeMs(target.sourceDirs);
  let result = runViteBuild(ROOT_DIR, target.config);

  if (
    result.status !== 0
    && process.platform === 'win32'
    && hasNonAsciiPath(ROOT_DIR)
  ) {
    console.warn(
      `[buildRendererBundle] vite exited with code ${result.status} in the current workspace path. Retrying through a temporary ASCII drive mapping...`
    );
    result = tryWindowsAsciiPathFallback(target) || result;
  }

  if (result.status === 0) {
    return 0;
  }

  const oldestOutputMtimeMs = getOldestOutputMtimeMs(target.outputFiles);

  if (oldestOutputMtimeMs >= latestSourceMtimeMs && latestSourceMtimeMs > 0) {
    console.warn(
      `[buildRendererBundle] vite exited with code ${result.status}, but ${targetName} bundle files are already up to date. Continuing.`
    );
    return 0;
  }

  return typeof result.status === 'number' ? result.status : 1;
}

function main() {
  const targetName = process.argv[2];

  if (!targetName) {
    console.error('Usage: node scripts/buildRendererBundle.js <target>');
    process.exit(1);
  }

  try {
    process.exit(runBuild(targetName));
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
}

main();
