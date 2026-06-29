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
import {
  buildToiletOverpassQuery,
  changingTable,
  classifyToiletAccess,
  dedupeToilets,
  filterToilets,
  normalizePublicToilet,
  sortToilets,
  toiletFee,
  wheelchairAccess,
  type PublicToilet,
  type ToiletFilters,
} from './public-toilets.js';
import {
  buildCarRentalOverpassQuery,
  classifyCarRentalLocation,
  dedupeCarRentalOffices,
  filterCarRentalOffices,
  isCarRentalOffice,
  normalizeCarRentalOffice,
  safeRentalUrl,
  sortCarRentalOffices,
  type CarRentalFilters,
  type CarRentalOffice,
} from './car-rental.js';
import {
  buildWeatherUrl,
  convertPrecipitationFromMm,
  convertWindFromKmh,
  formatPrecipitation,
  formatTemperature,
  formatWind,
  hourlyForDay,
  matchPrayerWeather,
  selectHourlyForecast,
  travelWeatherIndicators,
  validateWeatherResponse,
  weatherCodeInfo,
  type WeatherUnits,
} from './weather.js';
import {
  acceptableCommonsLicense,
  attractionName,
  buildAttractionOverpassQuery,
  canAttachExternalSource,
  categoryExplanation,
  classifyAttraction,
  dedupeAttractions,
  enrichAttraction,
  filterAttractions,
  isMappedAttraction,
  normalizeAttraction,
  normalizeCommonsImage,
  sortAttractions,
  summarizeWikipediaExtract,
  type Attraction,
  type AttractionFilters,
} from './attractions.js';
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

test('classifies public toilet access from structured OpenStreetMap tags', () => {
  assert.equal(classifyToiletAccess({ amenity: 'toilets' }), 'public');
  assert.equal(classifyToiletAccess({ building: 'toilets' }), 'public');
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'yes' }), 'unknown');
  assert.equal(classifyToiletAccess({ amenity: 'cafe' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'yes' }), 'public');
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'customers' }), 'customers');
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'private' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'no' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'yes', 'toilets:access': 'yes' }), 'public');
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'yes', 'toilets:access': 'customers' }), 'customers');
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'no' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'key' }), 'restricted');
});

test('interprets public toilet fees, wheelchair access, and baby-changing tags', () => {
  assert.deepEqual(toiletFee({ fee: 'no' }), { fee: 'free', amount: '' });
  assert.deepEqual(toiletFee({ fee: 'yes' }), { fee: 'paid', amount: '' });
  assert.deepEqual(toiletFee({}), { fee: 'unknown', amount: '' });
  assert.deepEqual(toiletFee({ fee: '€1' }), { fee: 'paid', amount: '€1' });
  assert.equal(wheelchairAccess({ wheelchair: 'yes' }), 'yes');
  assert.equal(wheelchairAccess({ wheelchair: 'limited' }), 'limited');
  assert.equal(wheelchairAccess({ wheelchair: 'no' }), 'no');
  assert.equal(wheelchairAccess({ wheelchair: 'no', 'toilets:wheelchair': 'yes' }), 'yes');
  assert.equal(changingTable({ changing_table: 'yes' }), 'yes');
  assert.equal(changingTable({ changing_table: 'limited' }), 'limited');
  assert.equal(changingTable({ changing_table: 'no' }), 'no');
});

test('normalizes public toilets from node, way, and relation coordinates', () => {
  const origin = { latitude: 51.5, longitude: -0.1 };
  const node = normalizePublicToilet({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { amenity: 'toilets', name: 'Station WC', fee: 'no', opening_hours: '24/7', male: 'yes', female: 'yes', unisex: 'yes', handwashing: 'yes', shower: 'yes', drinking_water: 'yes', 'toilets:position:seated': 'yes' } }, origin);
  const way = normalizePublicToilet({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { building: 'toilets', wheelchair: 'limited', changing_table: 'yes', 'toilets:position:squat': 'yes' } }, origin);
  const relation = normalizePublicToilet({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { amenity: 'cafe', name: 'Museum Cafe', toilets: 'yes', 'toilets:access': 'customers', fee: 'yes' } }, origin);
  assert.equal(node?.latitude, 51.501);
  assert.equal(way?.longitude, -0.102);
  assert.equal(relation?.inside, 'Museum Cafe');
  assert.equal(relation?.access, 'customers');
  assert.equal(node?.fee, 'free');
  assert.equal(way?.wheelchair, 'limited');
  assert.equal(way?.changingTable, 'yes');
  assert.equal(node?.male, true);
  assert.equal(node?.female, true);
  assert.equal(node?.unisex, true);
  assert.equal(node?.handwashing, true);
  assert.equal(node?.shower, true);
  assert.equal(node?.drinkingWater, true);
  assert.equal(node?.seated, true);
  assert.equal(way?.squat, true);
  assert.equal(openingState(node?.openingHours ?? ''), 'open');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('deduplicates, filters, and sorts public toilets', () => {
  const origin = { latitude: 0, longitude: 0 };
  const toilets = [
    normalizePublicToilet({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { amenity: 'toilets', name: 'Far WC', fee: 'yes', wheelchair: 'yes', opening_hours: '24/7' } }, origin),
    normalizePublicToilet({ type: 'way', id: 2, center: { lat: 0.01, lon: 0 }, tags: { amenity: 'toilets', name: 'Near WC', fee: 'no', wheelchair: 'limited' } }, origin),
    normalizePublicToilet({ type: 'relation', id: 3, center: { lat: 0.010004, lon: 0.000004 }, tags: { amenity: 'toilets', name: 'Near WC', access: 'customers' } }, origin),
  ].filter((toilet): toilet is PublicToilet => Boolean(toilet));
  const deduped = dedupeToilets(toilets);
  assert.equal(deduped.length, 2);
  assert.equal(sortToilets(deduped, 'distance')[0]?.name, 'Near WC');
  assert.equal(sortToilets(deduped, 'free')[0]?.fee, 'free');
  assert.equal(sortToilets(deduped, 'accessible')[0]?.wheelchair, 'yes');

  const filters: ToiletFilters = { access: 'public', free: true, paid: false, openNow: false, open24: false, wheelchair: false, limitedWheelchair: true, changing: false, female: false, male: false, unisex: false, handwashing: false, shower: false, drinkingWater: false, seated: false, squat: false };
  const filtered = filterToilets(deduped, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Near WC');
});

test('uses safe public toilet fallbacks and Latin-readable names', () => {
  const origin = { latitude: 0, longitude: 0 };
  const fallback = normalizePublicToilet({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'toilets' } }, origin);
  const accessible = normalizePublicToilet({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'toilets', wheelchair: 'yes' } }, origin);
  const venue = normalizePublicToilet({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'library', name: 'Central Library', toilets: 'yes' } }, origin);
  const transliterated = normalizePublicToilet({ type: 'node', id: 4, lat: 0, lon: 0, tags: { amenity: 'toilets', name: 'دورات مياه' } }, origin);
  assert.equal(fallback?.name, 'Public Toilets');
  assert.equal(accessible?.name, 'Accessible Public Toilets');
  assert.equal(venue?.name, 'Central Library Toilets');
  assert.equal(latinOnly(transliterated?.name ?? ''), true);
});

test('builds bounded toilet Overpass queries and includes toilet language states', () => {
  const query = buildToiletOverpassQuery(51.5, -0.1, 50);
  assert.equal(query.includes('around:25000,51.5,-0.1'), true);
  assert.equal(query.includes('["amenity"="toilets"]'), true);
  assert.equal(query.includes('["toilets:access"]'), true);
  assert.equal(labels.en.toiletsLocationDenied.includes('denied'), true);
  assert.equal(labels.en.toiletsTimedOut.includes('timed out'), true);
  assert.equal(labels.en.toiletsCached.includes('cached'), true);
  assert.equal(labels.en.toiletsNoResults, 'No mapped public toilets were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.toiletsTitle.length > 0, true);
  assert.equal(labels.id.toiletsTitle.length > 0, true);
});

test('classifies structured car-rental office tags and excludes other vehicle services', () => {
  assert.equal(isCarRentalOffice({ amenity: 'car_rental' }), true);
  assert.equal(isCarRentalOffice({ shop: 'car_rental' }), true);
  assert.equal(isCarRentalOffice({ rental: 'car' }), true);
  assert.equal(isCarRentalOffice({ 'vehicle:rental': 'motorcar' }), true);
  assert.equal(isCarRentalOffice({ amenity: 'car_sharing' }), false);
  assert.equal(isCarRentalOffice({ amenity: 'bicycle_rental' }), false);
  assert.equal(isCarRentalOffice({ amenity: 'taxi' }), false);
  assert.equal(isCarRentalOffice({ shop: 'car' }), false);
});

test('normalizes car-rental offices from node, area centre, and multipolygon centre coordinates', () => {
  const origin = { latitude: 51.5, longitude: -0.1, label: 'London Heathrow Airport' };
  const node = normalizeCarRentalOffice({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { amenity: 'car_rental', name: 'Airport Cars', opening_hours: '24/7', website: 'https://example.com', phone: '+44123', wheelchair: 'yes' } }, origin);
  const way = normalizeCarRentalOffice({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { amenity: 'car_rental', brand: 'Brand Rent', operator: 'Local Operator', opening_hours: 'not real hours' } }, origin);
  const relation = normalizeCarRentalOffice({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { type: 'multipolygon', amenity: 'car_rental', 'operator:en': 'Rail Rent', railway: 'station' } }, { latitude: 51.5, longitude: -0.1, label: 'Central Station' });
  assert.equal(node?.latitude, 51.501);
  assert.equal(way?.longitude, -0.102);
  assert.equal(relation?.locationType, 'railway');
  assert.equal(node?.locationType, 'airport');
  assert.equal(node?.website, 'https://example.com/');
  assert.equal(node?.phone, '+44123');
  assert.equal(node?.wheelchair, 'yes');
  assert.equal(way?.brand, 'Brand Rent');
  assert.equal(way?.operator, 'Local Operator');
  assert.equal(openingState(way?.openingHours ?? ''), 'unknown');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('uses safe car-rental names, brand/operator fallbacks, and missing-name fallback', () => {
  const origin = { latitude: 0, longitude: 0, label: 'City Centre' };
  const fallback = normalizeCarRentalOffice({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'car_rental' } }, origin);
  const brand = normalizeCarRentalOffice({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'car_rental', brand: 'RentCo' } }, origin);
  const operator = normalizeCarRentalOffice({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'car_rental', operator: 'Operator Cars' } }, origin);
  const transliterated = normalizeCarRentalOffice({ type: 'node', id: 4, lat: 0, lon: 0, tags: { amenity: 'car_rental', name: 'تأجير سيارات' } }, origin);
  assert.equal(fallback?.name, 'City Car Rental Office');
  assert.equal(brand?.name, 'RentCo');
  assert.equal(operator?.name, 'Operator Cars');
  assert.equal(latinOnly(transliterated?.name ?? ''), true);
});

test('classifies car-rental office context without broad assumptions', () => {
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental' }, 'Queen Alia Airport'), 'airport');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental', railway: 'station' }), 'railway');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental', bus: 'yes' }), 'bus');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental', tourism: 'hotel' }), 'hotel');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental' }, 'Downtown'), 'city');
});

test('deduplicates, filters, and sorts car-rental offices', () => {
  const origin = { latitude: 0, longitude: 0, label: 'Airport' };
  const offices = [
    normalizeCarRentalOffice({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { amenity: 'car_rental', name: 'Far Airport', website: 'https://rent.example', opening_hours: '24/7' } }, origin),
    normalizeCarRentalOffice({ type: 'way', id: 2, center: { lat: 0.01, lon: 0 }, tags: { amenity: 'car_rental', name: 'Near City', phone: '+1', wheelchair: 'yes' } }, { ...origin, label: 'City Centre' }),
    normalizeCarRentalOffice({ type: 'relation', id: 3, center: { lat: 0.010004, lon: 0.000004 }, tags: { amenity: 'car_rental', name: 'Near City', website: 'https://near.example' } }, { ...origin, label: 'City Centre' }),
  ].filter((office): office is CarRentalOffice => Boolean(office));
  const deduped = dedupeCarRentalOffices(offices);
  assert.equal(deduped.length, 2);
  assert.equal(sortCarRentalOffices(deduped, 'distance')[0]?.name, 'Near City');
  assert.equal(sortCarRentalOffices(deduped, 'airport')[0]?.locationType, 'airport');
  assert.equal(sortCarRentalOffices(deduped, 'website')[0]?.website.length > 0, true);

  const filters: CarRentalFilters = { type: 'airport', openNow: true, open24: true, website: true, phone: false, wheelchair: false, atAirport: true };
  const filtered = filterCarRentalOffices(deduped, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Far Airport');
});

test('validates car-rental official website URLs safely', () => {
  assert.equal(safeRentalUrl('example.com'), 'https://example.com/');
  assert.equal(safeRentalUrl('https://example.com/booking'), 'https://example.com/booking');
  assert.equal(safeRentalUrl('javascript:alert(1)'), '');
  assert.equal(safeRentalUrl('ftp://example.com'), '');
});

test('builds bounded car-rental Overpass queries and includes language states', () => {
  const query = buildCarRentalOverpassQuery(51.5, -0.1, 250);
  assert.equal(query.includes('around:100000,51.5,-0.1'), true);
  assert.equal(query.includes('["amenity"="car_rental"]'), true);
  assert.equal(query.includes('["vehicle:rental"~"^(car|motorcar)$"]'), true);
  assert.equal(labels.en.carRentalLocationDenied.includes('denied'), true);
  assert.equal(labels.en.carRentalTimedOut.includes('timed out'), true);
  assert.equal(labels.en.carRentalCached.includes('cached'), true);
  assert.equal(labels.en.carRentalNoResults, 'No mapped car-rental offices were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.carRentalTitle.length > 0, true);
  assert.equal(labels.id.carRentalTitle.length > 0, true);
});

const sampleWeatherResponse = () => {
  const hourlyTimes = Array.from({ length: 72 }, (_, index) => `2026-07-${String(1 + Math.floor(index / 24)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00`);
  const days = Array.from({ length: 7 }, (_, index) => `2026-07-${String(index + 1).padStart(2, '0')}`);
  return {
    latitude: 51.5,
    longitude: -0.1,
    timezone: 'Europe/London',
    current: { time: '2026-07-01T10:00', temperature_2m: 22, apparent_temperature: 23, relative_humidity_2m: 62, precipitation: 0, rain: 0, showers: 0, snowfall: 0, weather_code: 61, cloud_cover: 70, wind_speed_10m: 20, wind_direction_10m: 230, wind_gusts_10m: 55, is_day: 1 },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map((_, index) => 20 + index % 5),
      apparent_temperature: hourlyTimes.map((_, index) => 21 + index % 5),
      relative_humidity_2m: hourlyTimes.map(() => 60),
      precipitation_probability: hourlyTimes.map((_, index) => index === 12 ? 70 : 20),
      precipitation: hourlyTimes.map(() => 0),
      rain: hourlyTimes.map((_, index) => index === 12 ? 2 : 0),
      showers: hourlyTimes.map(() => 0),
      snowfall: hourlyTimes.map(() => 0),
      weather_code: hourlyTimes.map((_, index) => index === 20 ? 95 : 1),
      cloud_cover: hourlyTimes.map(() => 40),
      visibility: hourlyTimes.map((_, index) => index === 5 ? 2500 : 10000),
      wind_speed_10m: hourlyTimes.map(() => 20),
      wind_direction_10m: hourlyTimes.map(() => 180),
      wind_gusts_10m: hourlyTimes.map((_, index) => index === 2 ? 55 : 25),
      uv_index: hourlyTimes.map((_, index) => index === 13 ? 7 : 1),
      is_day: hourlyTimes.map((_, index) => index % 24 > 5 && index % 24 < 21 ? 1 : 0),
    },
    daily: {
      time: days,
      weather_code: [0, 61, 71, 95, 2, 3, 45],
      temperature_2m_max: [30, 22, 8, 25, 26, 27, 28],
      temperature_2m_min: [18, 15, 1, 17, 18, 19, 20],
      apparent_temperature_max: [31, 23, 7, 26, 27, 28, 29],
      apparent_temperature_min: [17, 14, 0, 16, 17, 18, 19],
      sunrise: days.map((day) => `${day}T05:00`),
      sunset: days.map((day) => `${day}T21:00`),
      daylight_duration: days.map(() => 57600),
      sunshine_duration: days.map(() => 28800),
      uv_index_max: [7, 4, 2, 5, 6, 7, 3],
      precipitation_sum: [1, 4, 2, 3, 0, 0, 0],
      rain_sum: [1, 4, 0, 3, 0, 0, 0],
      showers_sum: [0, 0, 0, 0, 0, 0, 0],
      snowfall_sum: [0, 0, 2, 0, 0, 0, 0],
      precipitation_probability_max: [70, 80, 30, 50, 10, 10, 10],
      wind_speed_10m_max: [24, 20, 18, 30, 20, 20, 20],
      wind_gusts_10m_max: [55, 30, 25, 40, 20, 20, 20],
      wind_direction_10m_dominant: [220, 180, 90, 270, 0, 45, 135],
    },
  };
};

test('validates current, hourly, and daily Open-Meteo weather responses', () => {
  const forecast = validateWeatherResponse(sampleWeatherResponse(), '2026-07-01T10:05:00.000Z');
  assert.equal(forecast.current.temperature, 22);
  assert.equal(forecast.current.isDay, true);
  assert.equal(forecast.hourly.length, 72);
  assert.equal(forecast.daily.length, 7);
  assert.equal(forecast.timezone, 'Europe/London');
  assert.equal(forecast.daily[0].sunrise, '2026-07-01T05:00');
  assert.equal(forecast.daily[0].sunset, '2026-07-01T21:00');
});

test('rejects missing or malformed weather API data', () => {
  assert.throws(() => validateWeatherResponse(null), /Malformed/);
  assert.throws(() => validateWeatherResponse({ hourly: {}, daily: {} }), /Missing current/);
  assert.throws(() => validateWeatherResponse({ current: {}, daily: {} }), /Missing hourly/);
  assert.throws(() => validateWeatherResponse({ current: {}, hourly: {} }), /Missing daily/);
});

test('interprets WMO weather codes without exposing raw codes', () => {
  assert.equal(weatherCodeInfo(0, labels.en).label, labels.en.weatherClear);
  assert.equal(weatherCodeInfo(61, labels.en).label, labels.en.weatherRain);
  assert.equal(weatherCodeInfo(71, labels.en).label, labels.en.weatherSnow);
  assert.equal(weatherCodeInfo(95, labels.en).label, labels.en.weatherThunderstorm);
});

test('formats weather units and builds configurable Open-Meteo URLs', () => {
  const units: WeatherUnits = { temperature: 'fahrenheit', wind: 'mph', precipitation: 'inch' };
  const url = buildWeatherUrl(1, 2, units, 'https://weather.example/forecast');
  assert.equal(url.includes('temperature_unit=fahrenheit'), true);
  assert.equal(url.includes('wind_speed_unit=mph'), true);
  assert.equal(url.includes('precipitation_unit=inch'), true);
  assert.equal(formatTemperature(72, units), '72°F');
  assert.equal(formatWind(10, units), '10 mph');
  assert.equal(Number(convertWindFromKmh(36, 'ms').toFixed(1)), 10);
  assert.equal(Number(convertWindFromKmh(10, 'knots').toFixed(2)), 5.4);
  assert.equal(Number(convertPrecipitationFromMm(25.4, 'inch').toFixed(2)), 1);
  assert.equal(formatPrecipitation(1, units), '1.00 in');
});

test('selects hourly, daily, travel-indicator, cached, and prayer weather data', () => {
  const forecast = validateWeatherResponse(sampleWeatherResponse());
  assert.equal(selectHourlyForecast(forecast.hourly, '2026-07-01T10:00', 24).length, 24);
  assert.equal(hourlyForDay(forecast.hourly, '2026-07-02').length, 24);
  const indicators = travelWeatherIndicators(forecast, labels.en);
  assert.equal(indicators.includes(labels.en.weatherIndicatorUv), true);
  assert.equal(indicators.includes(labels.en.weatherIndicatorWind), true);
  assert.equal(indicators.includes(labels.en.weatherIndicatorRain), true);
  const matched = matchPrayerWeather({ Fajr: '05:10', Dhuhr: '13:05' }, forecast.hourly);
  assert.equal(matched.length, 2);
  assert.equal(matched[0].forecast?.time.includes('05:00'), true);
});

test('includes weather state and language labels', () => {
  assert.equal(labels.en.weatherLocationDenied.includes('denied'), true);
  assert.equal(labels.en.weatherTimedOut.includes('timed out'), true);
  assert.equal(labels.en.weatherCached.includes('Cached'), true);
  assert.equal(labels.en.weatherNoCached.includes('No cached'), true);
  assert.equal(labels.ar.weatherTitle.length > 0, true);
  assert.equal(labels.id.weatherTitle.length > 0, true);
});

test('discovers structured OpenStreetMap attractions and excludes ordinary places', () => {
  assert.equal(isMappedAttraction({ tourism: 'attraction' }), true);
  assert.equal(isMappedAttraction({ tourism: 'museum' }), true);
  assert.equal(isMappedAttraction({ tourism: 'viewpoint' }), true);
  assert.equal(isMappedAttraction({ natural: 'waterfall', tourism: 'attraction' }), true);
  assert.equal(isMappedAttraction({ building: 'yes', name: 'Office' }), false);
  assert.equal(isMappedAttraction({ leisure: 'park' }), false);
});

test('classifies attraction categories from structured tags', () => {
  assert.equal(classifyAttraction({ historic: 'castle' }), 'castle');
  assert.equal(classifyAttraction({ historic: 'archaeological_site' }), 'archaeological');
  assert.equal(classifyAttraction({ historic: 'mosque' }), 'religious');
  assert.equal(classifyAttraction({ tourism: 'gallery' }), 'gallery');
  assert.equal(classifyAttraction({ leisure: 'nature_reserve' }), 'natural');
});

test('normalizes attraction coordinates, names, fallbacks, and distance', () => {
  const origin = { latitude: 51.5, longitude: -0.1 };
  const node = normalizeAttraction({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { tourism: 'museum', 'name:en': 'Test Museum', fee: 'no', wheelchair: 'yes' } }, origin);
  const way = normalizeAttraction({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { historic: 'monument', name: 'نصب تذكاري' } }, origin);
  const relation = normalizeAttraction({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { tourism: 'viewpoint' } }, origin);
  assert.equal(node?.name, 'Test Museum');
  assert.equal(node?.fee, 'free');
  assert.equal(node?.wheelchair, 'yes');
  assert.equal(way?.category, 'monument');
  assert.equal(latinOnly(way?.name ?? ''), true);
  assert.equal(relation?.name, 'Scenic Viewpoint');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('prioritizes English attraction names from source tags', () => {
  assert.equal(attractionName({ name: 'متحف', 'name:en': 'English Museum' }, 'museum'), 'English Museum');
  assert.equal(attractionName({ wikipedia: 'en:British_Museum' }, 'museum'), 'British Museum');
  assert.equal(attractionName({}, 'natural'), 'Natural Attraction');
});

test('matches exact attraction sources and rejects ambiguous matches', () => {
  const attraction = normalizeAttraction({ type: 'node', id: 1, lat: 0, lon: 0, tags: { tourism: 'museum', 'name:en': 'Exact Museum', wikidata: 'Q1', wikipedia: 'en:Exact_Museum', wikimedia_commons: 'Category:Exact Museum' } }, { latitude: 0, longitude: 0 }) as Attraction;
  assert.equal(canAttachExternalSource(attraction, { wikidata: 'Q1' }), true);
  assert.equal(canAttachExternalSource(attraction, { wikipedia: 'Exact Museum' }), true);
  assert.equal(canAttachExternalSource(attraction, { commons: 'Category:Exact Museum' }), true);
  assert.equal(canAttachExternalSource(attraction, { name: 'Exact Museum', category: 'museum', distanceKm: 0.1 }), true);
  assert.equal(canAttachExternalSource(attraction, { name: 'Exact Museum', category: 'gallery', distanceKm: 0.1 }), false);
  assert.equal(canAttachExternalSource(attraction, { name: 'Similar Museum', category: 'museum', distanceKm: 0.1 }), false);
});

test('handles Wikimedia Commons metadata, licences, and placeholders', () => {
  const raw = { query: { pages: { 1: { title: 'File:Test.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/test.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test.jpg', extmetadata: { Artist: { value: 'Photographer' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' }, Credit: { value: 'Credit line' } } }] } } } };
  const photo = normalizeCommonsImage(raw);
  assert.equal(photo?.creator, 'Photographer');
  assert.equal(photo?.license, 'CC BY-SA 4.0');
  assert.equal(acceptableCommonsLicense({ thumbnailUrl: 'x', sourceUrl: 'y', license: 'All rights reserved' }), false);
  assert.equal(categoryExplanation('viewpoint'), 'This is a mapped scenic viewpoint overlooking the surrounding area.');
});

test('creates English summaries from Wikipedia, Wikidata, and OSM descriptions', () => {
  const attraction = normalizeAttraction({ type: 'node', id: 1, lat: 0, lon: 0, tags: { tourism: 'museum', 'description:en': 'OSM English description.' } }, { latitude: 0, longitude: 0 }) as Attraction;
  assert.equal(summarizeWikipediaExtract('Sentence one. Sentence two. Sentence three. Sentence four.').split('.').length <= 4, true);
  assert.equal(enrichAttraction(attraction, { wikipediaExtract: 'A museum. It has exhibitions.' }).historySource, 'Wikipedia');
  assert.equal(enrichAttraction(attraction, { wikidataDescription: 'Wikidata description' }).history, 'Wikidata description');
  assert.equal(enrichAttraction(attraction, { osmDescription: 'OSM description' }).history, 'OSM description');
  assert.equal(enrichAttraction({ ...attraction, osmDescription: '' }).history, 'This is a mapped museum or visitor exhibition site.');
});

test('deduplicates, filters, sorts, and queries attractions', () => {
  const origin = { latitude: 0, longitude: 0 };
  const attractions = [
    enrichAttraction(normalizeAttraction({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { tourism: 'museum', 'name:en': 'Far Museum', opening_hours: '24/7' } }, origin) as Attraction, { wikipediaExtract: 'A museum.' }),
    normalizeAttraction({ type: 'way', id: 2, center: { lat: 0.01, lon: 0 }, tags: { tourism: 'viewpoint', 'name:en': 'Near View', fee: 'no', wheelchair: 'yes' } }, origin),
    normalizeAttraction({ type: 'relation', id: 3, center: { lat: 0.010004, lon: 0.000004 }, tags: { tourism: 'viewpoint', 'name:en': 'Near View' } }, origin),
  ].filter((attraction): attraction is Attraction => Boolean(attraction));
  const deduped = dedupeAttractions(attractions);
  assert.equal(deduped.length, 2);
  const filters: AttractionFilters = { category: 'viewpoint', photo: false, history: false, openNow: false, free: true, wheelchair: true };
  assert.equal(filterAttractions(deduped, filters)[0]?.name, 'Near View');
  assert.equal(sortAttractions(deduped, 'distance')[0]?.name, 'Near View');
  assert.equal(sortAttractions(deduped, 'history')[0]?.name, 'Far Museum');
  const query = buildAttractionOverpassQuery(51.5, -0.1, 99);
  assert.equal(query.includes('around:50000,51.5,-0.1'), true);
  assert.equal(query.includes('nwr["tourism"~'), true);
  assert.equal(query.includes('nwr["historic"~'), true);
  assert.equal(query.includes('["wikidata"]'), true);
});

test('includes attraction state and language labels while keeping content English', () => {
  assert.equal(labels.en.attractionsLocationDenied.includes('denied'), true);
  assert.equal(labels.en.attractionsTimedOut.includes('timed out'), true);
  assert.equal(labels.en.attractionsCached.includes('cached'), true);
  assert.equal(labels.en.attractionsNoResults, 'No mapped attractions were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.attractionsTitle.length > 0, true);
  assert.equal(labels.id.attractionsTitle.length > 0, true);
  const englishSummary = categoryExplanation('natural');
  assert.equal(/[A-Za-z]/.test(englishSummary), true);
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
