import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Urdu is registered before the main app and uses RTL layout', async () => {
  const index = await repoFile('index.html');
  const runtime = await repoFile('src/urdu-runtime.ts');

  assert.equal(index.includes('/src/urdu-runtime.ts'), true);
  assert.equal(index.indexOf('/src/urdu-runtime.ts') < index.indexOf('/src/main.ts'), true);
  assert.equal(runtime.includes("{ code: 'ur', label: 'اردو' }"), true);
  assert.equal(runtime.includes("document.documentElement.dir = 'rtl'"), true);
});

test('Urdu covers core Muslim and travel tools', async () => {
  const core = await repoFile('src/urdu-labels.ts');
  const flight = await repoFile('src/urdu-labels-flight.ts');
  const transportA = await repoFile('src/urdu-labels-transport-a.ts');
  const transportB = await repoFile('src/urdu-labels-transport-b.ts');
  const transportC = await repoFile('src/urdu-labels-transport-c.ts');
  const toilets = await repoFile('src/urdu-labels-extra-c.ts');

  assert.equal(core.includes('subtitle: "مسلمان سفری منصوبہ ساز"'), true);
  assert.equal(core.includes('qiblaRequestMotion: "براہِ راست قطب نما شروع کریں"'), true);
  assert.equal(core.includes('prayerSpacesTitle: "مساجد اور نماز کی جگہیں"'), true);
  assert.equal(core.includes('halalRestaurantsTitle: "حلال ریسٹورنٹس"'), true);
  assert.equal(core.includes('weatherTitle: "موسم"'), true);
  assert.equal(flight.includes('flightModeTitle: "پرواز میں نماز اور قبلہ"'), true);
  assert.equal(transportA.includes('carRentalTitle: "کار کرایہ"'), true);
  assert.equal(transportB.includes('publicTransportTitle: "عوامی ٹرانسپورٹ"'), true);
  assert.equal(transportC.includes('taxiTitle: "ٹیکسی خدمات"'), true);
  assert.equal(toilets.includes('toiletsTitle: "عوامی بیت الخلا"'), true);
});

test('Urdu copy is wired into Qibla, prayer notifications, itineraries and saved trips', async () => {
  const qibla = await repoFile('src/qibla-copy-bootstrap.ts');
  const athan = await repoFile('src/athan.ts');
  const planner = await repoFile('src/planner.ts');
  const savedTrips = await repoFile('src/saved-trips.ts');

  assert.equal(qibla.includes("ur: { liveCompass: 'براہِ راست قطب نما شروع کریں', fixedBearing: 'مقررہ سمت' }"), true);
  assert.equal(athan.includes("ur: { prayer: { Fajr: 'فجر'"), true);
  assert.equal(planner.includes('ur: {'), true);
  assert.equal(planner.includes("ur: { Fajr: 'فجر', Dhuhr: 'ظہر'"), true);
  assert.equal(savedTrips.includes("'ur'"), true);
  assert.equal(savedTrips.includes("ur: 'نقل'"), true);
});
