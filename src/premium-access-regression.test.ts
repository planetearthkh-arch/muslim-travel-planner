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

test('final paywall sells the complete trip with an exact Free versus Premium comparison', async () => {
  const source = await repoFile('src/premium-bootstrap.ts');
  const copy = await repoFile('src/premium-copy.ts');

  assert.equal(copy.includes('Unlock your full Muslim-friendly trip'), true);
  assert.equal(copy.includes('Pay once. No subscription. Keep Premium forever on your Apple Account.'), true);
  assert.equal(copy.includes("purchase: 'Unlock Full Trip'"), true);
  assert.equal(copy.includes("freeLabel: 'Free Preview'"), true);
  assert.equal(copy.includes("premiumLabel: 'Lifetime Premium'"), true);
  assert.equal(copy.includes('2 preview results in each place category'), true);
  assert.equal(copy.includes('First 2 stops from Day 1'), true);
  assert.equal(copy.includes('Complete personalized day-by-day itinerary'), true);
  assert.equal(copy.includes('Every mosque, halal place, landmark and attraction'), true);
  assert.equal(copy.includes('In-flight tools, offline access, saving, sharing and export'), true);
  assert.equal(source.includes('function comparisonMarkup()'), true);
  assert.equal(source.includes('premium-tier-free'), true);
  assert.equal(source.includes('premium-tier-paid'), true);
});

test('trip and place paywalls use real preview totals to create a personalized upgrade moment', async () => {
  const source = await repoFile('src/premium-bootstrap.ts');
  const copy = await repoFile('src/premium-copy.ts');

  assert.equal(copy.includes('Your {days}-day Muslim-friendly trip is ready'), true);
  assert.equal(copy.includes('Unlock all {total} {kind}'), true);
  assert.equal(source.includes('let paywallContext: PaywallContext = {};'), true);
  assert.equal(source.includes('function contextFromTrigger'), true);
  assert.equal(source.includes("data-premium-preview=\"${reason}\""), true);
  assert.equal(source.includes('dataAttributes(context)'), true);
  assert.equal(source.includes('paywallContext = contextFromTrigger(trigger);'), true);
});

test('premium purchase state rerenders the app after a successful unlock', async () => {
  const source = await repoFile('src/premium-bootstrap.ts');
  assert.equal(source.includes("'#saved-trips'"), true);
  assert.equal(source.includes("new CustomEvent('safarmate-premium-state'"), true);
  assert.equal(source.includes('focus({ preventScroll: true })'), true);
  assert.equal(source.includes("window.dispatchEvent(new Event('hashchange'))"), true);
});

test('premium paywall stays polished on mobile with safe areas and a visible sticky purchase action', async () => {
  const baseCss = await repoFile('src/premium.css');
  const conversionCss = await repoFile('src/premium-conversion.css');
  const html = await repoFile('index.html');

  assert.equal(baseCss.includes('.premium-preview-card'), true);
  assert.equal(conversionCss.includes('env(safe-area-inset-top)'), true);
  assert.equal(conversionCss.includes('position: sticky'), true);
  assert.equal(conversionCss.includes('.premium-comparison'), true);
  assert.equal(conversionCss.includes('.premium-tier-paid'), true);
  assert.equal(html.includes('/src/premium-conversion.css'), true);
});
