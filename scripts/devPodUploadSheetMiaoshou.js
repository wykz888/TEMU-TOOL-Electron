const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const DEFAULT_PORT = 5178;
const WINDOWS_ASCII_FALLBACK_DRIVES = Object.freeze(['X', 'Y', 'Z', 'W', 'V']);

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

function createAsciiRootFallback() {
  if (process.platform !== 'win32' || !hasNonAsciiPath(ROOT_DIR)) {
    return null;
  }

  const driveLetter = pickFallbackDriveLetter();

  if (!driveLetter) {
    return null;
  }

  const result = spawnSync('subst', [`${driveLetter}:`, ROOT_DIR], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.status !== 0) {
    return null;
  }

  return {
    rootDir: `${driveLetter}:\\`,
    cleanup() {
      spawnSync('subst', [`${driveLetter}:`, '/d'], {
        cwd: ROOT_DIR,
        stdio: 'ignore',
        windowsHide: true
      });
    }
  };
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, HOST);
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found from ${startPort} to ${startPort + 19}.`);
}

function requestUrl(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });

    request.on('error', () => {
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await requestUrl(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Vite dev server: ${url}`);
}

function spawnVite(rootDir, port) {
  const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const configPath = path.join(rootDir, 'vite.pod-upload-sheet-miaoshou.config.mjs');

  return spawn(
    process.execPath,
    [
      viteBin,
      '--config',
      configPath,
      '--host',
      HOST,
      '--port',
      String(port),
      '--strictPort'
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      },
      stdio: 'inherit',
      windowsHide: true
    }
  );
}

function startElectron(devPageUrl) {
  const startScriptPath = path.join(ROOT_DIR, 'scripts', 'start.ps1');

  return spawn(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      startScriptPath
    ],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        TEMU_POD_UPLOAD_SHEET_MIAOSHOU_DEV_SERVER_URL: devPageUrl
      },
      stdio: 'inherit',
      windowsHide: true
    }
  );
}

async function main() {
  const requestedPort = Number.parseInt(process.env.TEMU_POD_UPLOAD_SHEET_MIAOSHOU_DEV_SERVER_PORT || '', 10);
  const port = await findAvailablePort(Number.isFinite(requestedPort) ? requestedPort : DEFAULT_PORT);
  const fallback = createAsciiRootFallback();
  const viteRootDir = fallback ? fallback.rootDir : ROOT_DIR;
  const devPageUrl = `http://${HOST}:${port}/src/renderer/podUploadSheetMiaoshouApp/index.html`;
  const viteProcess = spawnVite(viteRootDir, port);
  let shuttingDown = false;

  function cleanup(exitCode) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    if (viteProcess && !viteProcess.killed) {
      viteProcess.kill();
    }

    if (fallback) {
      fallback.cleanup();
    }

    process.exit(typeof exitCode === 'number' ? exitCode : 0);
  }

  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));

  viteProcess.on('exit', (code) => {
    if (shuttingDown) {
      return;
    }

    if (fallback) {
      fallback.cleanup();
    }

    process.exit(typeof code === 'number' ? code : 1);
  });

  await waitForServer(devPageUrl, 30000);
  console.log(`[pod-upload-sheet-miaoshou] Vite dev page: ${devPageUrl}`);

  const electronStartProcess = startElectron(devPageUrl);
  electronStartProcess.on('exit', (code) => {
    if (code && code !== 0) {
      cleanup(code);
    }
  });
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
