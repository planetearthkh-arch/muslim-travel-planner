import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{
    readFile: (path: URL, encoding: string) => Promise<string>;
    stat: (path: URL) => Promise<{ size: number }>;
  }>;
  const fs = await load('node:fs/promises');
  const url = new URL('../' + path, import.meta.url);
  return {
    content: await fs.readFile(url, 'utf8'),
    size: (await fs.stat(url)).size,
  };
}

test('original map style labels are protected before the application starts', async () => {
  const bootstrap = (await repoFile('src/app-bootstrap.ts')).content;
  const rtl = (await repoFile('src/map-rtl-bootstrap.ts')).content;

  // This commit also triggers the one-time source cleanup in the trusted CI workflow.
  assert.equal(bootstrap.includes("import './map-rtl-bootstrap.js'"), true);
  assert.equal(bootstrap.indexOf("import './map-rtl-bootstrap.js'") < bootstrap.indexOf("import('./main.js')"), true);
  assert.equal(rtl.includes('isLegacyMapLabelRewrite'), true);
  assert.equal(rtl.includes("property === 'text-field'"), true);
  assert.equal(rtl.includes('JSON.stringify(value) === LEGACY_MAP_NAME_EXPRESSION_JSON'), true);
  assert.equal(rtl.includes('if (isLegacyMapLabelRewrite(property, value)) return this'), true);
  assert.equal(rtl.includes('activateLatinFallback'), false);
  assert.equal(rtl.includes('LATIN_MAP_NAME_EXPRESSION'), false);
});

test('bundled RTL shaping is limited to Arabic and Urdu and relayouts original text', async () => {
  const rtl = (await repoFile('src/map-rtl-bootstrap.ts')).content;
  const plugin = await repoFile('public/vendor/mapbox-gl-rtl-text.js');
  const license = await repoFile('public/vendor/mapbox-gl-rtl-text.LICENSE.md');
  const html = (await repoFile('index.html')).content;
  const worker = (await repoFile('public/sw.js')).content;

  assert.equal(rtl.includes("language !== 'ar' && language !== 'ur'"), true);
  assert.equal(rtl.includes("new URL('./vendor/mapbox-gl-rtl-text.js', document.baseURI)"), true);
  assert.equal(rtl.includes('setRTLTextPlugin(RTL_PLUGIN_URL, false)'), true);
  assert.equal(rtl.includes("map.on('style.load'"), true);
  assert.equal(rtl.includes('refreshLiveMaps()'), true);
  assert.equal(rtl.includes("originalSetLayoutProperty.call(map, layer.id, 'text-field', textField)"), true);
  assert.equal(plugin.size > 50_000, true);
  assert.equal(license.size > 100, true);
  assert.equal(html.includes('/src/app-bootstrap.ts'), true);
  assert.equal(html.includes('unpkg.com'), false);
  assert.equal(worker.includes('mtp-app-shell-v16'), true);
  assert.equal(worker.includes('./vendor/mapbox-gl-rtl-text.js'), true);
});
