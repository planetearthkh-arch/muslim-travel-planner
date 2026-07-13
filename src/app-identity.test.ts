import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('user-facing app identity stays SafarMate — Muslim Travel Planner', async () => {
  const html = await repoFile('index.html');
  const manifest = await repoFile('public/manifest.webmanifest');
  const plist = await repoFile('ios/App/App/Info.plist');

  assert.equal(html.includes('SafarMate'), true);
  assert.equal(html.includes('Muslim Travel Planner'), true);
  assert.equal(manifest.includes('SafarMate'), true);
  assert.equal(plist.includes('SafarMate'), true);

  for (const source of [html, manifest, plist]) {
    assert.equal(source.includes('SafarOne'), false);
    assert.equal(source.includes('SafarOnMate'), false);
    assert.equal(source.includes('SafarOneMate'), false);
    assert.equal(source.includes('Muslim Trip Planner'), false);
  }
});
