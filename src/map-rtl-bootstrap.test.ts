import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{
    readFile: (path: URL, encoding: string) => Promise<string>;
    stat: (path: URL) => Promise<{ size: number }>;
  }>;
  return load('node:fs/promises').then(async (fs) => ({
    content: await fs.readFile(new URL('../' + path, import.meta.url), 'utf8'),
    size: (await fs.stat(new URL('../' + path, import.meta.url))).size,
  }));
}

test('app registers bundled RTL shaping before any map can be created', async () => {
  const html = (await repoFile('index.html')).content;
  const appBootstrap = (await repoFile('src/app-bootstrap.ts')).content;
  const rtlBootstrap = (await repoFile('src/map-rtl-bootstrap.ts')).content;

  assert.equal(html.includes('/src/app-bootstrap.ts'), true);
  assert.equal(html.includes('/src/main.ts'), false);
  assert.equal(appBootstrap.indexOf('registerRtlMapSupport()') < appBootstrap.indexOf("import('./main.js')"), true);
  assert.equal(appBootstrap.indexOf("import './prayer-search-bootstrap.js'") < appBootstrap.indexOf("import('./main.js')"), true);
  assert.match(rtlBootstrap, /new URL\('\.\/mapbox-gl-rtl-text\.js', document\.baseURI\)/);
  assert.match(rtlBootstrap, /setRTLTextPlugin\(RTL_PLUGIN_URL, true\)/);
  assert.equal(rtlBootstrap.includes('unpkg.com'), false);
  assert.equal(rtlBootstrap.includes("language !== 'ar'"), false);
});

test('RTL shaping plugin is committed locally and available offline', async () => {
  const plugin = await repoFile('public/mapbox-gl-rtl-text.js');
  const license = await repoFile('public/mapbox-gl-rtl-text.LICENSE.txt');
  const worker = (await repoFile('public/sw.js')).content;
  const html = (await repoFile('index.html')).content;

  assert.equal(plugin.size > 50_000, true);
  assert.equal(license.size > 100, true);
  assert.match(worker, /mtp-app-shell-v16/);
  assert.match(worker, /mapbox-gl-rtl-text\.js/);
  assert.equal(html.includes('unpkg.com'), false);
});

test('prayer search sanitizes live, cached, and bundled results', async () => {
  const bootstrap = (await repoFile('src/prayer-search-bootstrap.ts')).content;
  assert.match(bootstrap, /sanitizePrayerPayload/);
  assert.match(bootstrap, /live-sanitized/);
  assert.match(bootstrap, /sanitizedFallback/);
});
