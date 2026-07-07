import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const host = '127.0.0.1';
const appPort = 4174;
const debugPort = 9224;
const appUrl = `http://${host}:${appPort}/muslim-travel-planner/`;
const viteBinary = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const chromeCandidates = [
  process.env.CHROME_BIN,
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
].filter(Boolean);

const routes = [
  '',
  '#qibla',
  '#flight-mode',
  '#prayer-spaces',
  '#halal-restaurants',
  '#money',
  '#weather',
  '#attractions',
];

function commandExists(command) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  return probe.status === 0;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(2_000, () => request.destroy(new Error('HTTP probe timed out.')));
    request.on('error', reject);
  });
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

async function waitForChromeDebugger(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const version = await requestJson(`http://${host}:${debugPort}/json/version`);
      if (typeof version.webSocketDebuggerUrl === 'string') return version.webSocketDebuggerUrl;
      lastError = new Error('Missing webSocketDebuggerUrl');
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Chrome debugger did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener('error', () => reject(new Error('Chrome DevTools websocket failed to open.')), { once: true });
  });
}

function createCdpClient(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result ?? {});
  });

  return function send(method, params = {}) {
    const requestId = ++id;
    socket.send(JSON.stringify({ id: requestId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
    });
  };
}

const chromeBinary = chromeCandidates.find(commandExists);
if (!chromeBinary) {
  throw new Error('No supported Chrome or Chromium executable was found. Set CHROME_BIN to run the mobile overflow smoke test.');
}
if (typeof WebSocket === 'undefined') {
  throw new Error('This test requires the Node.js WebSocket global available in Node 22.');
}

let previewOutput = '';
const preview = spawn(viteBinary, ['preview', '--host', host, '--port', String(appPort), '--strictPort'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
preview.stdout.on('data', (chunk) => { previewOutput += chunk.toString(); });
preview.stderr.on('data', (chunk) => { previewOutput += chunk.toString(); });

let chromeOutput = '';
const profileDirectory = await mkdtemp(path.join(tmpdir(), 'safarone-mobile-overflow-'));
const chrome = spawn(chromeBinary, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`,
  'about:blank',
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
chrome.stdout.on('data', (chunk) => { chromeOutput += chunk.toString(); });
chrome.stderr.on('data', (chunk) => { chromeOutput += chunk.toString(); });

try {
  await waitForServer(appUrl);
  const wsUrl = await waitForChromeDebugger();
  const socket = await openWebSocket(wsUrl);
  const send = createCdpClient(socket);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });

  for (const route of routes) {
    const targetUrl = `${appUrl}${route}`;
    await send('Page.navigate', { url: targetUrl });
    await delay(1_500);
    const result = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `new Promise((resolve) => {
        const deadline = Date.now() + 10000;
        const read = () => {
          const root = document.querySelector('#root');
          if (root && root.textContent.trim()) {
            requestAnimationFrame(() => resolve({
              url: location.href,
              viewportWidth: window.innerWidth,
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              bodyClientWidth: document.body.clientWidth,
              bodyScrollWidth: document.body.scrollWidth,
            }));
            return;
          }
          if (Date.now() > deadline) {
            resolve({ error: 'App root stayed empty.', url: location.href });
            return;
          }
          setTimeout(read, 100);
        };
        read();
      })`,
    });
    const value = result.result?.value;
    if (!value || value.error) throw new Error(`${route || '/'}: ${value?.error ?? 'No evaluation result.'}`);
    const allowed = value.viewportWidth + 1;
    const widest = Math.max(value.documentScrollWidth, value.bodyScrollWidth);
    if (widest > allowed) {
      throw new Error(`${route || '/'} overflows iPhone viewport: widest=${widest}, viewport=${value.viewportWidth}, url=${value.url}`);
    }
  }

  socket.close();
  console.log(`Mobile overflow smoke test passed in ${chromeBinary}: ${routes.length} iPhone-sized routes`);
} catch (error) {
  throw new Error(`${error instanceof Error ? error.message : String(error)}\nVite preview output:\n${previewOutput}\nChrome output:\n${chromeOutput}`);
} finally {
  preview.kill('SIGTERM');
  chrome.kill('SIGTERM');
  await rm(profileDirectory, { recursive: true, force: true });
}
