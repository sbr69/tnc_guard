import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const isWindows = process.platform === 'win32';

const backendPython = isWindows
  ? path.normalize(path.join(backendRoot, '.venv', 'Scripts', 'python.exe'))
  : path.normalize(path.join(backendRoot, '.venv', 'bin', 'python'));

function startProcess(command, args, cwd, label) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${label} exited with ${signal}`);
    } else {
      console.log(`${label} exited with code ${code ?? 0}`);
    }
  });

  return child;
}

async function waitForBackend(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting until uvicorn is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Backend did not respond on ${url} within ${timeoutMs}ms.`);
}

async function main() {
  const basePath = backendRoot;
  const fullPath = path.normalize(backendPython);
  
  if (!fullPath.startsWith(basePath)) {
    throw new Error("Invalid path specified!");
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Backend Python executable not found at ${fullPath}.`);
  }

  const backend = startProcess(
    fullPath,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8001'],
    backendRoot,
    'backend',
  );

  const shutdown = () => {
    if (!backend.killed) {
      backend.kill();
    }
    if (frontend && !frontend.killed) {
      frontend.kill();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.on('exit', (code) => {
    if (code !== 0) {
      process.exitCode = code ?? 1;
    }
  });

  await waitForBackend('http://127.0.0.1:8001/health');

  const typecheck = isWindows
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run generate-types'], {
        cwd: frontendRoot,
        stdio: 'inherit',
        shell: false,
      })
    : spawnSync('npm', ['run', 'generate-types'], {
        cwd: frontendRoot,
        stdio: 'inherit',
        shell: false,
      });

  if (typecheck.status && typecheck.status !== 0) {
    console.warn('Type generation failed, continuing with the current API types.');
  }

  const frontend = isWindows
    ? startProcess(
        'cmd.exe',
        ['/d', '/s', '/c', 'npm run dev:frontend'],
        frontendRoot,
        'frontend',
      )
    : startProcess(
        'npm',
        ['run', 'dev:frontend'],
        frontendRoot,
        'frontend',
      );

  frontend.on('exit', (code) => {
    if (!backend.killed) {
      backend.kill();
    }
    process.exit(code ?? 0);
  });
}

let frontend;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});