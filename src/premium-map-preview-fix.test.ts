import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('free mosque and halal discovery retain a clean in-app preview map', async () => {
  const source = await repoFile('src/premium-map-preview-fix.ts');
  const css = await repoFile('src/premium-map-preview-fix.css');
  const bootstrap = await repoFile('src/app-bootstrap.ts');
  const html = await repoFile('index.html');

  assert.equal(source.includes("const protectedMapSelector = '#prayer-map, #halal-map';"), true);
  assert.equal(source.includes('marker.hidden = index >= 3'), true);
  assert.equal(source.includes('openstreetmap.org'), true);
  assert.equal(source.includes('maps.apple.com'), true);
  assert.equal(source.includes('openPremiumFrom(card)'), true);
  assert.equal(source.includes('event.stopImmediatePropagation()'), true);
  assert.equal(source.includes('Element.prototype.remove = guardedRemove'), true);
  assert.equal(css.includes('pointer-events: none'), true);
  assert.equal(css.includes('.premium-map-preview-fix-overlay'), true);
  assert.equal(bootstrap.indexOf("premium-map-preview-fix.js") < bootstrap.indexOf("premium-bootstrap.js"), true);
  assert.equal(html.includes('/src/premium-map-preview-fix.css'), true);
});
