import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('map label policy keeps Latin fields and blocks the raw name getter', async () => {
  const source = await repoFile('src/map-rtl-bootstrap.ts');
  for (const field of ['name:en', 'name_en', 'name:latin', 'int_name', 'official_name:en', 'short_name:en', 'ref']) {
    assert.equal(source.includes(field), true);
  }
  assert.equal(source.includes("value[0] === 'get' && value[1] === 'name'"), true);
  assert.equal(source.includes('setRTLTextPlugin'), false);
  assert.equal(source.includes('fetch('), false);
});

test('map label policy is installed before the application entry point', async () => {
  const html = await repoFile('index.html');
  assert.equal(html.indexOf('/src/map-rtl-bootstrap.ts') < html.indexOf('/src/main.ts'), true);
});
