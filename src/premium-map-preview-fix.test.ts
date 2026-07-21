import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('free mosque, halal and attraction discovery retain maps, filters and view choices', async () => {
  const source = await repoFile('src/premium-map-preview-fix.ts');
  const css = await repoFile('src/premium-map-preview-fix.css');
  const bootstrap = await repoFile('src/app-bootstrap.ts');
  const premiumBootstrap = await repoFile('src/premium-bootstrap.ts');
  const html = await repoFile('index.html');

  assert.equal(source.includes("const protectedMapSelector = '#prayer-map, #halal-map, #attractions-map';"), true);
  assert.equal(source.includes("const protectedDiscoveryControlsSelector = '.segmented, .prayer-filters';"), true);
  assert.equal(source.includes("const protectedRadiusSelector = '#prayer-radius, #halal-radius, #attraction-radius';"), true);
  assert.equal(source.includes('function isProtectedDiscoveryControl'), true);
  assert.equal(source.includes("element.matches('label') && Boolean(element.querySelector(protectedRadiusSelector))"), true);
  assert.equal(source.includes("return map.matches('#attractions-map') ? 2 : 3;"), true);
  assert.equal(source.includes("'.attraction-card .map-link[href*=\"openstreetmap.org\"]'"), true);
  assert.equal(source.includes("'.attraction-card .map-link[href*=\"maps.apple.com\"]'"), true);
  assert.equal(source.includes("nextView === 'photos' && document.querySelector('#attractions-map')"), true);
  assert.equal(source.includes('[data-attraction-view=\"map\"]'), true);
  assert.equal(source.includes('event.stopImmediatePropagation()'), true);
  assert.equal(source.includes('Element.prototype.remove = guardedRemove'), true);
  assert.equal(premiumBootstrap.includes("removeElements(app, '.segmented, .prayer-filters"), true);
  assert.equal(css.includes('pointer-events: none'), true);
  assert.equal(css.includes('.premium-map-preview-fix-overlay'), true);
  assert.equal(bootstrap.indexOf("premium-map-preview-fix.js") < bootstrap.indexOf("premium-bootstrap.js"), true);
  assert.equal(html.includes('/src/premium-map-preview-fix.css'), true);
});
