import test from 'node:test';
import assert from 'node:assert/strict';
import { cities } from './data.js';
import { labels, languageDirection, languages, nextLanguage, regionLabels } from './i18n.js';
import { generateItinerary } from './planner.js';
import { calculateQiblaBearing } from './qibla.js';
import { classifyPrayerPlace, distanceKm, ensureLatinDisplayName, getEnglishPlaceName, normalizePrayerPlace } from './prayer-spaces.js';
import {
  cacheKeyForRate,
  convertAmount,
  destinationCurrency,
  fallbackCurrencies,
  formatCurrencyAmount,
  historyStats,
  normalizeCurrencies,
  parseAmountInput,
  readJsonCache,
  searchCurrencies,
  validateRateResponse,
  writeJsonCache,
} from './money.js';
import {
  classifyHalalStatus,
  cuisineOptions,
  dedupeRestaurants,
  filterRestaurants,
  normalizeHalalRestaurant,
  openingState,
  sortRestaurants,
  type HalalRestaurant,
  type RestaurantFilters,
} from './halal-restaurants.js';
import type { PlannerPreferences } from './models.js';

const prefs: PlannerPreferences = { city: 'Tokyo', startDate: '2026-07-01', endDate: '2026-07-01', startHour: '09:00', endHour: '18:00', interests: ['history'], groupSize: 2, children: false, walkingAbility: 'medium', transportation: 'public transport', budget: 'mid', prayerMethod: 'Muslim World League', prayerPreference: 'mosque', womenPrayerRequired: true, wuduRequired: true, accessibilityNeeds: 'step-free', halalPreference: 'strictly labelled' };

test('contains all required sample cities', () => {
  assert.deepEqual(cities.map((c) => c.city), [
    'Jerusalem',
    'London',
    'Istanbul',
    'Paris',
    'Tokyo',
    'New York',
    'Dubai',
    'Abu Dhabi',
    'Doha',
    'Riyadh',
    'Jeddah',
    'Makkah',
    'Madinah',
    'Cairo',
    'Amman',
    'Marrakech',
    'Kuala Lumpur',
    'Singapore',
    'Jakarta',
    'Bangkok',
    'Seoul',
    'Toronto',
    'Los Angeles',
    'Chicago',
    'Barcelona',
    'Rome',
    'Cape Town',
    'Sydney',
    'Sarajevo',
    'Tashkent',
  ]);
  assert.equal(new Set(cities.map((c) => c.city)).size, 30);
});

test('each city has the required planner content', () => {
  for (const city of cities) {
    assert.equal(city.places.filter((place) => place.type === 'attraction').length >= 2, true);
    assert.equal(city.places.some((place) => place.type === 'mosque'), true);
    assert.equal(city.places.some((place) => place.type === 'restaurant'), true);
    assert.equal(Object.keys(city.prayerWindows).length, 5);
    assert.equal(city.transportEstimates.walking > 0, true);
    assert.equal(city.transportEstimates.publicTransport > 0, true);
    assert.equal(city.transportEstimates.taxi > 0, true);

    const prayerPlaces = city.places.filter((place) => place.type === 'mosque' || place.type === 'prayer-space');
    assert.equal(prayerPlaces.every((place) => place.facility?.womenPrayerSpace), true);
    assert.equal(prayerPlaces.every((place) => place.facility?.wudu), true);
    assert.equal(prayerPlaces.every((place) => place.facility?.accessibility), true);

    const restaurant = city.places.find((place) => place.type === 'restaurant');
    assert.equal(restaurant?.verification, 'Unverified');
    assert.equal(/Unverified sample listing/.test(restaurant?.halalSupport ?? ''), true);
  }
});

test('newly added city information is only Sample or Unverified', () => {
  const existing = new Set(['Jerusalem', 'London', 'Istanbul', 'Paris', 'Tokyo', 'New York']);
  for (const city of cities.filter((candidate) => !existing.has(candidate.city))) {
    assert.equal(city.places.every((place) => place.verification === 'Sample' || place.verification === 'Unverified'), true);
    assert.equal(city.places.every((place) => !place.facility || Object.values(place.facility).every((value) => value !== 'Verified')), true);
  }
});

test('generates prayer, attraction, travel, and halal-conscious meal items', () => {
  const items = generateItinerary(prefs);
  assert.equal(items.some((i) => i.kind === 'prayer'), true);
  assert.equal(items.some((i) => i.kind === 'attraction'), true);
  assert.equal(items.some((i) => i.kind === 'travel'), true);
  assert.equal(items.some((i) => i.kind === 'meal' && i.details.includes('Unverified')), true);
});

test('supports switching among English, Arabic, and Bahasa Indonesia', () => {
  assert.deepEqual(languages.map((language) => language.code), ['en', 'ar', 'id']);
  assert.equal(nextLanguage('en'), 'ar');
  assert.equal(nextLanguage('ar'), 'id');
  assert.equal(nextLanguage('id'), 'en');
  assert.equal(languageDirection('en'), 'ltr');
  assert.equal(languageDirection('id'), 'ltr');
  assert.equal(languageDirection('ar'), 'rtl');
});

test('provides natural Indonesian interface labels without translating place names', () => {
  assert.equal(labels.id.title, 'Perencana Perjalanan Muslim');
  assert.equal(labels.id.plan, 'Buat Rencana Perjalanan');
  assert.equal(labels.id.replan, 'Rencanakan Ulang dari Sini');
  assert.equal(regionLabels.id['Middle East'], 'Timur Tengah');

  const items = generateItinerary(prefs, 0, 'id');
  assert.equal(items.some((item) => item.title.includes('Tokyo Camii')), true);
  assert.equal(items.some((item) => item.title.includes('Rentang salat Zuhur')), true);
  assert.equal(items.some((item) => item.details.includes('Daftar contoh belum diverifikasi')), true);
});


test('exposes Sample, Unverified, and Verified labels in prototype data', () => {
  const statuses = new Set(cities.flatMap((city) => city.places.map((place) => place.verification)));
  assert.equal(statuses.has('Sample'), true);
  assert.equal(statuses.has('Unverified'), true);
  assert.equal(statuses.has('Verified'), true);
});

test('performs standard, reverse, and same-currency conversion locally', () => {
  const standard = convertAmount(100, 0.8642);
  assert.equal(standard.converted, 86.42);
  assert.equal(Math.round(standard.reverseRate * 10000) / 10000, 1.1571);
  assert.equal(convertAmount(50, 1).converted, 50);
});

test('supports currency swap calculations without sending amounts to the API', () => {
  const usdToEur = convertAmount(100, 0.8);
  const eurToUsd = convertAmount(usdToEur.converted, 1 / 0.8);
  assert.equal(eurToUsd.converted, 100);
});

test('formats two-decimal, zero-decimal, and three-decimal currencies with Intl', () => {
  assert.match(formatCurrencyAmount(12.3, 'USD', 'en'), /12\.30/);
  assert.doesNotMatch(formatCurrencyAmount(1234, 'JPY', 'en'), /\.00/);
  assert.match(formatCurrencyAmount(1.234, 'BHD', 'en'), /1\.234/);
});

test('parses decimal comma, decimal point, pasted formatting, and zero', () => {
  assert.equal(parseAmountInput('1.234,56').value, 1234.56);
  assert.equal(parseAmountInput('1,234.56 USD').value, 1234.56);
  assert.equal(parseAmountInput('0').value, 0);
});

test('rejects invalid, negative, and extremely large input', () => {
  assert.equal(parseAmountInput('abc').error, 'invalid');
  assert.equal(parseAmountInput('-10').error, 'negative');
  assert.equal(parseAmountInput('100000000000000000000').error, 'tooLarge');
});

test('validates Frankfurter currency and rate responses', () => {
  const currencies = normalizeCurrencies([{ iso_code: 'USD', name: 'US Dollar' }, { iso_code: 'EUR', name: 'Euro' }]);
  assert.deepEqual(currencies.map((currency) => currency.code), ['EUR', 'USD']);
  const rate = validateRateResponse({ base: 'USD', quote: 'EUR', date: '2026-06-29', rate: 0.86 }, 'USD', 'EUR', '2026-06-29T10:00:00.000Z');
  assert.equal(rate.rate, 0.86);
  assert.throws(() => validateRateResponse({ base: 'USD', date: '2026-06-29', rates: {} }, 'USD', 'EUR'), /Unsupported currency|Missing rate data/);
  assert.throws(() => normalizeCurrencies(null), /Malformed/);
});

test('derives history stats from Frankfurter v2 EUR-based rows', () => {
  const stats = historyStats([
    { date: '2026-06-28', base: 'EUR', quote: 'USD', rate: 1.2 },
    { date: '2026-06-28', base: 'EUR', quote: 'GBP', rate: 0.8 },
    { date: '2026-06-29', base: 'EUR', quote: 'USD', rate: 1.25 },
    { date: '2026-06-29', base: 'EUR', quote: 'GBP', rate: 0.75 },
  ], 'GBP', 'USD');
  assert.equal(Number(stats.start.toFixed(4)), 0.6667);
  assert.equal(stats.latest, 0.6);
});

test('supports cached-rate fallback helpers and offline cache misses', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  const key = cacheKeyForRate('USD', 'EUR');
  writeJsonCache(storage, key, { base: 'USD', quote: 'EUR', rate: 0.9, date: '2026-06-29', refreshedAt: '2026-06-29T10:00:00.000Z', cached: false });
  assert.equal(readJsonCache<{ rate: number }>(storage, key, 1000)?.rate, 0.9);
  assert.equal(readJsonCache(storage, 'missing', 1000), null);
});

test('searches currencies by code, English, Arabic, Indonesian, and country', () => {
  assert.equal(searchCurrencies(fallbackCurrencies, 'USD')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'US Dollar')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'دولار أمريكي')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'Dolar AS')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'United Kingdom')[0].code, 'GBP');
});

test('uses destination default currency from city money data', () => {
  assert.equal(destinationCurrency(cities.find((city) => city.city === 'London') ?? cities[0]), 'GBP');
  assert.equal(destinationCurrency(cities.find((city) => city.city === 'Jerusalem') ?? cities[0]), 'ILS');
});

test('formats amounts for English, Arabic, and Indonesian modes', () => {
  assert.match(formatCurrencyAmount(1234.5, 'USD', 'en'), /\$/);
  assert.match(formatCurrencyAmount(1234.5, 'USD', 'ar'), /US\$/);
  assert.match(formatCurrencyAmount(1234.5, 'IDR', 'id'), /Rp/);
});

test('calculates Qibla bearings for major cities', () => {
  const cases = [
    ['London', 51.5074, -0.1278, 118.99],
    ['New York', 40.7128, -74.0060, 58.48],
    ['Jerusalem', 31.7683, 35.2137, 157.19],
    ['Jakarta', -6.2088, 106.8456, 295.15],
    ['Sydney', -33.8688, 151.2093, 277.50],
  ] as const;

  for (const [name, latitude, longitude, expected] of cases) {
    assert.deepEqual({ name, bearing: Number(calculateQiblaBearing(latitude, longitude).toFixed(2)) }, { name, bearing: expected });
  }
});


test('calculates distance between nearby coordinates', () => {
  const distance = distanceKm(51.5074, -0.1278, 51.5033, -0.1195);
  assert.equal(Number(distance.toFixed(2)), 0.73);
});

test('classifies OpenStreetMap prayer place results', () => {
  assert.equal(classifyPrayerPlace({ amenity: 'place_of_worship', religion: 'muslim' }), 'mosque');
  assert.equal(classifyPrayerPlace({ amenity: 'prayer_room' }), 'prayer-room');
  assert.equal(classifyPrayerPlace({ name: 'Airport quiet prayer room' }), 'quiet-space');
  assert.equal(classifyPrayerPlace({ amenity: 'place_of_worship', religion: 'christian' }), undefined);
});

test('marks incomplete prayer place information as unverified', () => {
  const place = normalizePrayerPlace({
    type: 'node',
    id: 1,
    lat: 51.5,
    lon: -0.1,
    tags: { amenity: 'prayer_room', name: 'Station prayer room' },
  }, { latitude: 51.5074, longitude: -0.1278 });

  assert.equal(place?.verification, 'Verified');
  assert.equal(place?.womenPrayerArea, 'Unverified');
  assert.equal(place?.wudu, 'Unverified');
  assert.equal(place?.wheelchair, 'Unverified');
  assert.equal(place?.address, '');
});

test('includes translated prayer-space denied and empty states', () => {
  assert.equal(labels.en.prayerLocationDenied.includes('denied'), true);
  assert.equal(labels.ar.prayerNoResults.length > 0, true);
  assert.equal(labels.id.prayerNoResults.length > 0, true);
  assert.equal(labels.en.prayerNoResults, 'No places found nearby.');
});



const latinOnly = (value: string) => !/[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value);
const namedPlace = (tags: Record<string, string>, type: 'mosque' | 'prayer-room' | 'quiet-space' | 'islamic-centre' = 'mosque') => getEnglishPlaceName({ tags, type });

test('english place names prefer name:en', () => {
  assert.equal(namedPlace({ name: 'مسجد الاختبار', 'name:en': 'Test Mosque' }), 'Test Mosque');
});

test('english place names convert Arabic without name:en', () => {
  assert.equal(namedPlace({ name: 'مسجد التقوى' }), 'Al-Taqwa Mosque');
  assert.equal(namedPlace({ name: 'مسجد عمر بن الخطاب' }), 'Omar ibn Al-Khattab Mosque');
  assert.equal(namedPlace({ name: 'مصلى المطار' }, 'prayer-room'), 'Airport Prayer Room');
});

test('english place names transliterate Persian and Urdu names', () => {
  assert.equal(latinOnly(namedPlace({ name: 'مسجد نور' })), true);
  assert.equal(latinOnly(namedPlace({ name: 'مسجد جامع کراچی' })), true);
});

test('english place names transliterate Hebrew, Cyrillic, and Greek names', () => {
  assert.equal(latinOnly(namedPlace({ name: 'מסגד עומר' })), true);
  assert.equal(latinOnly(namedPlace({ name: 'Мечеть Нур' })), true);
  assert.equal(latinOnly(namedPlace({ name: 'Τζαμί Ομάρ' })), true);
});

test('english place names transliterate Chinese, Japanese, and Korean names', () => {
  assert.equal(latinOnly(namedPlace({ name: '东京清真寺' })), true);
  assert.equal(latinOnly(namedPlace({ name: '東京ジャーミイ' })), true);
  assert.equal(latinOnly(namedPlace({ name: '서울 중앙 모스크' })), true);
});

test('english place names handle mixed Arabic and English plus numbers', () => {
  assert.equal(latinOnly(namedPlace({ name: 'مسجد Omar 2' })), true);
  assert.equal(ensureLatinDisplayName('Prayer Room 24', 'prayer-room'), 'Prayer Room 24');
});

test('english place names use int_name and fallbacks', () => {
  assert.equal(namedPlace({ name: 'غرفة صلاة', int_name: 'Airport Prayer Room' }, 'prayer-room'), 'Airport Prayer Room');
  assert.equal(namedPlace({}, 'mosque'), 'Unnamed Mosque');
  assert.equal(namedPlace({}, 'prayer-room'), 'Unnamed Prayer Room');
});

test('normalization keeps original name internally but displays Latin only', () => {
  const place = normalizePrayerPlace({ type: 'node', id: 21, lat: 1, lon: 1, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'مسجد الأقصى' } }, { latitude: 1, longitude: 1 });
  assert.equal(place?.name, 'Al-Aqsa Mosque');
  assert.equal(place?.originalName, 'مسجد الأقصى');
  assert.equal(latinOnly(place?.name ?? ''), true);
});

test('classifies structured halal restaurant tags without unsafe assumptions', () => {
  assert.equal(classifyHalalStatus({ 'diet:halal': 'only' }), 'halal-only');
  assert.equal(classifyHalalStatus({ 'diet:halal': 'yes' }), 'halal-options');
  assert.equal(classifyHalalStatus({ 'halal:certification': 'Local council certificate' }), 'certification-listed');
  assert.equal(classifyHalalStatus({ halal: 'yes' }), 'legacy-halal');
  assert.equal(classifyHalalStatus({ 'diet:halal': 'no', halal: 'yes' }), undefined);
  assert.equal(classifyHalalStatus({ halal: 'no', 'diet:halal': 'yes' }), undefined);
  assert.equal(classifyHalalStatus({ amenity: 'restaurant', name: 'مطعم القدس' }), undefined);
  assert.equal(classifyHalalStatus({ cuisine: 'middle_eastern' }), undefined);
  assert.equal(classifyHalalStatus({ name: 'Halal Palace' }), undefined);
  assert.equal(classifyHalalStatus({ description: 'Halal food available' }, true), 'possible-unverified');
});

test('normalizes halal restaurants from node, way, and relation coordinates', () => {
  const origin = { latitude: 51.5, longitude: -0.1 };
  const node = normalizeHalalRestaurant({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Halal Grill' } }, origin);
  const way = normalizeHalalRestaurant({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { amenity: 'fast_food', 'diet:halal': 'yes', name: 'Quick Bites' } }, origin);
  const relation = normalizeHalalRestaurant({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { amenity: 'cafe', 'halal:certification': 'listed', name: 'Cafe Noor' } }, origin);
  assert.equal(node?.latitude, 51.501);
  assert.equal(way?.longitude, -0.102);
  assert.equal(relation?.type, 'cafe');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('deduplicates node and way records for the same physical restaurant', () => {
  const origin = { latitude: 0, longitude: 0 };
  const first = normalizeHalalRestaurant({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'restaurant', halal: 'yes', name: 'Same Grill' } }, origin);
  const stronger = normalizeHalalRestaurant({ type: 'way', id: 2, center: { lat: 1.00001, lon: 1.00001 }, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Same Grill' } }, origin);
  const deduped = dedupeRestaurants([first, stronger].filter(Boolean) as NonNullable<typeof first>[]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].halalStatus, 'halal-only');
});

test('filters and sorts halal restaurants by cuisine, open-now, and nearest', () => {
  const origin = { latitude: 0, longitude: 0 };
  const restaurants = [
    normalizeHalalRestaurant({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Far Arabic', cuisine: 'arabic;burgers', opening_hours: '24/7' } }, origin),
    normalizeHalalRestaurant({ type: 'node', id: 2, lat: 0.01, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'yes', name: 'Near Pizza', cuisine: 'pizza', opening_hours: 'Mo-Su 00:00-24:00' } }, origin),
  ].filter((restaurant): restaurant is HalalRestaurant => Boolean(restaurant));
  const filters: RestaurantFilters = { status: 'reliable', type: 'all', cuisine: 'pizza', openNow: true, takeaway: false, delivery: false, wheelchair: false };
  const filtered = filterRestaurants(restaurants, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Near Pizza');
  assert.equal(sortRestaurants(restaurants, 'distance')[0]?.name, 'Near Pizza');
  assert.deepEqual(cuisineOptions(restaurants), ['arabic', 'burgers', 'pizza']);
});

test('handles invalid opening hours, missing address, fallback names, and transliteration', () => {
  const origin = { latitude: 0, longitude: 0 };
  assert.equal(openingState('not real hours'), 'unknown');
  assert.equal(openingState('24/7'), 'open');
  const fallback = normalizeHalalRestaurant({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'food_court', 'diet:halal': 'only' } }, origin);
  const transliterated = normalizeHalalRestaurant({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'مطعم النور' } }, origin);
  assert.equal(fallback?.address, '');
  assert.equal(fallback?.name, 'Unnamed Halal Food Court');
  assert.equal(latinOnly(transliterated?.name ?? ''), true);
});

test('includes halal restaurant timeout, cache, denial, empty, and language labels', () => {
  assert.equal(labels.en.halalTimedOut.includes('timed out'), true);
  assert.equal(labels.en.halalCached.includes('cached'), true);
  assert.equal(labels.en.halalLocationDenied.includes('denied'), true);
  assert.equal(labels.en.halalNoResults, 'No mapped halal restaurants were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.halalRestaurantsTitle.length > 0, true);
  assert.equal(labels.id.halalRestaurantsTitle.length > 0, true);
});

test('rendered prayer-place titles use the shared English-name safety function', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('tags.name'), false);
  assert.equal(source.includes('place.originalName ?'), false);
  assert.equal(source.includes('<h3>${esc(place.name)}</h3>'), false);
  assert.equal(source.includes('aria-label="${esc(place.name)}"'), false);
  assert.equal(source.includes('setText(place.name)'), false);
  assert.equal(source.includes('encodeURIComponent(place.name)'), false);
  assert.equal(source.includes('ensureLatinDisplayName(getEnglishPlaceName(place), place.type)'), true);
});
