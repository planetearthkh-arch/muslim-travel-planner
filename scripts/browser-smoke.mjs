import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const host = '127.0.0.1';
const port = 4173;
const appUrl = `http://${host}:${port}/muslim-travel-planner/`;
const viteBinary = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const chromeCandidates = [
  process.env.CHROME_BIN,
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
].filter(Boolean);

function commandExists(command) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  return probe.status === 0;
}

function requestStatus(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.setTimeout(2_000, () => request.destroy(new Error('HTTP readiness probe timed out.')));
    request.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const status = await requestStatus(url);
      if (status >= 200 && status < 400) return;
      lastError = new Error(`HTTP ${status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Vite preview did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

const chromeBinary = chromeCandidates.find(commandExists);
if (!chromeBinary) {
  throw new Error('No supported Chrome or Chromium executable was found. Set CHROME_BIN to run the browser smoke test.');
}

let previewOutput = '';
const preview = spawn(viteBinary, ['preview', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
preview.stdout.on('data', (chunk) => { previewOutput += chunk.toString(); });
preview.stderr.on('data', (chunk) => { previewOutput += chunk.toString(); });

const profileDirectory = await mkdtemp(path.join(tmpdir(), 'safarone-browser-smoke-'));
try {
  await waitForServer(appUrl);
  const result = spawnSync(chromeBinary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=10000',
    `--user-data-dir=${profileDirectory}`,
    '--dump-dom',
    appUrl,
  ], {
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Headless browser exited with status ${result.status}.\n${result.stderr}`);
  }

  const dom = result.stdout;
  const root = dom.match(/<div id="root"[^>]*>([\s\S]*?)<\/div>/i);
  if (!dom.includes('<title>SafarOne — Muslim Travel Planner</title>')) {
    throw new Error('The built page title was not rendered.');
  }
  if (!root || !root[1].trim()) {
    throw new Error('The app root remained empty after JavaScript execution.');
  }
  if (/\b(?:Uncaught|SyntaxError|ERR_MODULE_NOT_FOUND)\b/i.test(result.stderr)) {
    throw new Error(`A fatal browser error was reported.\n${result.stderr}`);
  }

  console.log(`Browser smoke test passed in ${chromeBinary}: ${appUrl}`);
} catch (error) {
  throw new Error(`${error instanceof Error ? error.message : String(error)}\nVite preview output:\n${previewOutput}`);
} finally {
  preview.kill('SIGTERM');
  await rm(profileDirectory, { recursive: true, force: true });
}
