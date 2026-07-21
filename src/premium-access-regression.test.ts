import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('free iOS users receive only a useful itinerary and discovery preview', async () => {
  const source = await repoFile('src/premium-bootstrap.ts');
  assert.equal(source.includes('const FREE_DISCOVERY_PREVIEW_LIMIT = 2;'), true);
  assert.equal(source.includes('const FREE_PLAN_PREVIEW_LIMIT = 2;'), true);
  assert.equal(source.includes('gatePlannerPreview()'), true);
  assert.equal(source.includes("gateDiscoveryPreview('#back-from-prayer'"), true);
  assert.equal(source.includes("gateDiscoveryPreview('#back-from-halal'"), true);
  assert.equal(source.includes("gateDiscoveryPreview('#back-from-attractions'"), true);
  assert.equal(source.includes("removeElements(app, '.segmented, .prayer-filters"), true);
  assert.equal(source.includes('cards.slice(FREE_DISCOVERY_PREVIEW_LIMIT)'), true);
  assert.equal(source.includes('firstDayCards.slice(FREE_PLAN_PREVIEW_LIMIT)'), true);
});

test('premium purchase state rerenders the app and preview cards explain the customer value', async () => {
  const source = await repoFile('src/premium-bootstrap.ts');
  const copy = await repoFile('src/premium-copy.ts');
  assert.equal(source.includes("'#saved-trips'"), true);
  assert.equal(copy.includes('Complete personalized day-by-day itinerary'), true);
  assert.equal(copy.includes('Your complete Muslim-friendly trip is ready'), true);
  assert.equal(source.includes("new CustomEvent('safarmate-premium-state'"), true);
  assert.equal(source.includes('data-premium-preview="${reason}"'), true);
  assert.equal(source.includes('focus({ preventScroll: true })'), true);
  assert.equal(source.includes("window.dispatchEvent(new Event('hashchange'))"), true);
});

test('premium paywall and preview respect mobile safe areas', async () => {
  const css = await repoFile('src/premium.css');
  assert.equal(css.includes('.premium-preview-card'), true);
  assert.equal(css.includes('env(safe-area-inset-top)'), true);
  assert.equal(css.includes('max-height: calc(100dvh'), true);
});
