import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAmountInput } from './money.js';
import { validateTravelDetailInput } from './travel-details.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('money parsing respects locale decimal separators', () => {
  assert.equal(parseAmountInput('0.125', 'en').value, 0.125);
  assert.equal(parseAmountInput('0,125', 'tr').value, 0.125);
  assert.equal(parseAmountInput('1,250', 'en').value, 1250);
  assert.equal(parseAmountInput('1.250', 'tr').value, 1250);
  assert.equal(parseAmountInput('١٬٢٥٠', 'ar').value, 1250);
  assert.equal(parseAmountInput('١٫٢٥٠', 'ar').value, 1.25);
  assert.equal(parseAmountInput('USD 12', 'en').value, 12);
});

test('travel detail validation rejects impossible or nonexistent local dates', () => {
  const impossible = validateTravelDetailInput({ type: 'reservation', title: 'Tour', startDateTime: '2026-02-30T10:00', timeZone: 'UTC' });
  assert.equal(impossible.ok, false);
  if (!impossible.ok) assert.equal(impossible.error, 'date');

  const nonexistent = validateTravelDetailInput({ type: 'reservation', title: 'Tour', startDateTime: '2026-03-29T01:30', timeZone: 'Europe/London' });
  assert.equal(nonexistent.ok, false);
  if (!nonexistent.ok) assert.equal(nonexistent.error, 'date');

  const valid = validateTravelDetailInput({ type: 'reservation', title: 'Tour', startDateTime: '2026-03-29T02:30', timeZone: 'Europe/London' });
  assert.equal(valid.ok, true);

  const reversed = validateTravelDetailInput({ type: 'accommodation', propertyName: 'Hotel', checkInDateTime: '2026-07-04T12:00', checkOutDateTime: '2026-07-04T11:00', timeZone: 'UTC' });
  assert.equal(reversed.ok, false);
  if (!reversed.ok) assert.equal(reversed.error, 'range');
});

test('external map fields are escaped before insertion', async () => {
  const main = await repoFile('src/main.ts');
  for (const expression of ['esc(place.address)', 'esc(toilet.address)', 'esc(office.address)', 'esc(stop.address)', 'esc(item.address)', 'esc(attraction.address)']) {
    assert.equal(main.includes(expression), true);
  }
});

test('service worker deletes only SafarOne caches', async () => {
  const worker = await repoFile('public/sw.js');
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(worker, /mtp-app-shell-v13/);
  assert.match(worker, /await cache\.put\(request, copy\)/);
});

test('a restrictive content security policy is present', async () => {
  const html = await repoFile('index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /worker-src 'self' blob:/);
  assert.equal(html.includes('https://overpass-api.de'), true);
  assert.equal(html.includes('https://overpass.private.coffee'), true);
  assert.equal(html.includes('https://overpass.kumi.systems'), true);
});

test('prayer notification fallbacks use bundled assets and exact-alarm state', async () => {
  const source = await repoFile('src/athan.ts');
  assert.match(source, /icon: '\.\/icons\/icon\.svg'/);
  assert.match(source, /schedule: \{ at: new Date\(Date\.now\(\) \+ 1000\), allowWhileIdle: exactAlarmAllowed \}/);
});
