import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const openApiUrl = 'http://127.0.0.1:8000/openapi.json';
const outputFile = path.join('src', 'api', 'types.ts');
const cliPath = path.join(frontendRoot, 'node_modules', 'openapi-typescript', 'bin', 'cli.js');

try {
  const response = await fetch(openApiUrl);
  if (!response.ok) {
    console.warn('Warning: Backend not running, skipping type generation');
    process.exit(0);
  }
} catch {
  console.warn('Warning: Backend not running, skipping type generation');
  process.exit(0);
}

const result = spawnSync(process.execPath, [cliPath, openApiUrl, '-o', outputFile], {
  cwd: frontendRoot,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 0);