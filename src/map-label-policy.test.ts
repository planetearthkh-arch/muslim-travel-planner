import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('all maps install eager RTL shaping with a safe Latin fallback', async () => {
  const source = await repoFile('src/map-rtl-bootstrap.ts');

  assert.equal(source.includes('@mapbox/mapbox-gl-rtl-text@0.3.0'), true);
  assert.equal(source.includes('setRTLTextPlugin(RTL_PLUGIN_URL, false)'), true);
  assert.equal(source.includes('setRTLTextPlugin(RTL_PLUGIN_URL, true)'), false);
  assert.equal(source.includes("map.on('style.load'"), true);
  assert.equal(source.includes('relayoutRtlText(map)'), true);
  assert.equal(source.includes('refreshLiveMapsAfterPluginLoad()'), true);
  assert.equal(source.includes('waitForExistingPluginLoad()'), true);
  assert.equal(source.includes('activateLatinFallback()'), true);
  assert.equal(source.includes("language !== 'ar'"), false);

  for (const field of ['name:en', 'name_en', 'name:latin', 'int_name', 'official_name:en', 'short_name:en', 'ref']) {
    assert.equal(source.includes(field), true);
  }
  for (const rtlField of ['name:ar', 'name_ar', 'name:fa', 'name:he', 'name:ur']) {
    assert.equal(source.includes(rtlField), true);
  }
});

test('map text policy loads before the application and permits the pinned plugin', async () => {
  const html = await repoFile('index.html');
  assert.equal(html.indexOf('/src/map-rtl-bootstrap.ts') < html.indexOf('/src/main.ts'), true);
  assert.equal(html.includes("script-src 'self' https://unpkg.com"), true);
  assert.equal(html.includes("worker-src 'self' blob: https://unpkg.com"), true);
  assert.equal(html.includes("connect-src 'self' https://unpkg.com"), true);
});
