import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{
    readFile: (path: URL, encoding: string) => Promise<string>;
    stat: (path: URL) => Promise<{ size: number }>;
  }>;
  const fs = await load('node:fs/promises');
  const url = new URL('../' + path, import.meta.url);
  return { content: await fs.readFile(url, 'utf8'), size: (await fs.stat(url)).size };
}

test('every map uses one deterministic localized style without global label mutation', async () => {
  const main = (await repoFile('src/main.ts')).content;
  const style = (await repoFile('src/map-style.ts')).content;
  const rtl = (await repoFile('src/map-rtl-bootstrap.ts')).content;

  assert.equal(main.includes("import { mapStyleForLanguage } from './map-style.js'"), true);
  assert.equal(main.includes('const style = await mapStyleForLanguage(requestedLanguage)'), true);
  assert.equal((main.match(/const mapStyle = await prepareMapLanguage\(\);/g) ?? []).length, 8);
  assert.equal((main.match(/style: mapStyle/g) ?? []).length, 8);
  assert.equal(main.includes('englishMapNameExpression'), false);
  assert.equal(main.includes('applyEnglishMapLabels'), false);
  assert.equal(main.includes("setLayoutProperty(layer.id, 'text-field'"), false);
  assert.equal(rtl.includes('Map.prototype.setStyle'), false);
  assert.equal(rtl.includes('Map.prototype.setLayoutProperty'), false);

  assert.equal(style.includes("['get', `name:${language}`]"), true);
  assert.equal(style.includes("['get', 'name:nonlatin']"), true);
  assert.equal(style.includes('if (!hasNameField(textField)) continue'), true);
  assert.equal(style.includes('return localizeStyle(style, language, rtlReady)'), true);
});

test('native-safe RTL loading uses bundled source through a worker-compatible blob and has a Latin fallback', async () => {
  const rtl = (await repoFile('src/map-rtl-bootstrap.ts')).content;
  const style = (await repoFile('src/map-style.ts')).content;
  const plugin = await repoFile('public/vendor/mapbox-gl-rtl-text.js');
  const bundledStyle = await repoFile('public/vendor/openfreemap-bright.json');
  const worker = (await repoFile('public/sw.js')).content;

  assert.equal(rtl.includes("new URL('./vendor/mapbox-gl-rtl-text.js', document.baseURI)"), true);
  assert.equal(rtl.includes('URL.createObjectURL(new Blob([source]'), true);
  assert.equal(rtl.includes('setRTLTextPlugin(pluginUrl, false)'), true);
  assert.equal(rtl.includes("const RTL_LANGUAGES = new Set(['ar', 'ur'])"), true);
  assert.equal(style.includes('RTL_LANGUAGES.has(language) && rtlReady'), true);
  assert.equal(style.includes(': latinNameExpression(language)'), true);
  assert.equal(plugin.size > 50_000, true);
  assert.equal(bundledStyle.size > 20_000, true);
  assert.equal(worker.includes('mtp-app-shell-v17'), true);
  assert.equal(worker.includes('./vendor/mapbox-gl-rtl-text.js'), true);
  assert.equal(worker.includes('./vendor/openfreemap-bright.json'), true);
});
