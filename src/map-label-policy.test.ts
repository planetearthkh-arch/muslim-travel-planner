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

test('app starts bundled RTL shaping before map code without blocking render', async () => {
  const bootstrap = (await repoFile('src/app-bootstrap.ts')).content;
  const rtl = (await repoFile('src/map-rtl-bootstrap.ts')).content;

  assert.equal(bootstrap.includes('void ensureRtlMapSupport().then'), true);
  assert.equal(bootstrap.includes('await ensureRtlMapSupport()'), false);
  assert.equal(bootstrap.indexOf('ensureRtlMapSupport()') < bootstrap.indexOf("import('./main.js')"), true);
  assert.equal(rtl.includes("new URL('./vendor/mapbox-gl-rtl-text.js', document.baseURI)"), true);
  assert.equal(rtl.includes('setRTLTextPlugin(RTL_PLUGIN_URL, false)'), true);
  assert.equal(rtl.includes('LATIN_MAP_NAME_EXPRESSION'), false);
  assert.equal(rtl.includes('activateLatinFallback'), false);
  assert.equal(rtl.includes('setLayoutProperty'), false);
});

test('Arabic shaping plugin is local, licensed, and cached', async () => {
  const plugin = await repoFile('public/vendor/mapbox-gl-rtl-text.js');
  const license = await repoFile('public/vendor/mapbox-gl-rtl-text.LICENSE.md');
  const html = (await repoFile('index.html')).content;
  const worker = (await repoFile('public/sw.js')).content;

  assert.equal(plugin.size > 50_000, true);
  assert.equal(license.size > 100, true);
  assert.equal(html.includes('/src/app-bootstrap.ts'), true);
  assert.equal(html.includes('unpkg.com'), false);
  assert.equal(worker.includes('mtp-app-shell-v16'), true);
  assert.equal(worker.includes('./vendor/mapbox-gl-rtl-text.js'), true);
});
