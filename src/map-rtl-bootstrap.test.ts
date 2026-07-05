import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('English map labels do not depend on the RTL plugin', async () => {
  const html = await repoFile('index.html');
  const bootstrap = await repoFile('src/map-rtl-bootstrap.ts');

  assert.equal(html.indexOf('/src/map-rtl-bootstrap.ts') < html.indexOf('/src/main.ts'), true);
  assert.match(bootstrap, /language !== 'ar' && language !== 'ur'/);
  assert.match(bootstrap, /localStorage\.getItem\('mtp-language'\)/);
  assert.match(bootstrap, /if \(!pluginUrl\) return false/);
  assert.match(bootstrap, /\.catch|catch \{/);
});

test('Arabic and Urdu shaping is downloaded first and registered only after success', async () => {
  const html = await repoFile('index.html');
  const bootstrap = await repoFile('src/map-rtl-bootstrap.ts');

  assert.match(bootstrap, /@mapbox\/mapbox-gl-rtl-text@0\.3\.0/);
  assert.match(bootstrap, /RTL_FETCH_TIMEOUT_MS = 5000/);
  assert.match(bootstrap, /await fetch\(RTL_PLUGIN_URL/);
  assert.match(bootstrap, /URL\.createObjectURL\(new Blob/);
  assert.match(bootstrap, /setRTLTextPlugin\(pluginUrl, false\)/);
  assert.match(bootstrap, /MutationObserver/);
  assert.equal(html.includes("script-src 'self' https://unpkg.com"), true);
  assert.equal(html.includes("worker-src 'self' blob: https://unpkg.com"), true);
  assert.equal(html.includes("connect-src 'self' https://unpkg.com"), true);
});

test('prayer search sanitizes live, cached, and bundled results', async () => {
  const bootstrap = await repoFile('src/prayer-search-bootstrap.ts');
  assert.match(bootstrap, /sanitizePrayerPayload/);
  assert.match(bootstrap, /live-sanitized/);
  assert.match(bootstrap, /sanitizedFallback/);
});
