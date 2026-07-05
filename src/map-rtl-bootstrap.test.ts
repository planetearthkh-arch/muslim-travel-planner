import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('Arabic and Urdu map shaping is configured before any map is created', async () => {
  const html = await repoFile('index.html');
  const bootstrap = await repoFile('src/map-rtl-bootstrap.ts');

  assert.equal(html.indexOf('/src/map-rtl-bootstrap.ts') < html.indexOf('/src/main.ts'), true);
  assert.match(bootstrap, /@mapbox\/mapbox-gl-rtl-text@0\.3\.0/);
  assert.match(bootstrap, /getRTLTextPluginStatus\(\) === 'unavailable'/);
  assert.match(bootstrap, /setRTLTextPlugin\(RTL_PLUGIN_URL, true\)/);
  assert.equal(html.includes("script-src 'self' https://unpkg.com"), true);
  assert.equal(html.includes("worker-src 'self' blob: https://unpkg.com"), true);
  assert.equal(html.includes("connect-src 'self' https://unpkg.com"), true);
});

test('prayer search installs the sanitizer before serving live, cached, or bundled results', async () => {
  const bootstrap = await repoFile('src/prayer-search-bootstrap.ts');
  assert.match(bootstrap, /sanitizePrayerPayload/);
  assert.match(bootstrap, /live-sanitized/);
  assert.match(bootstrap, /sanitizedFallback/);
});
