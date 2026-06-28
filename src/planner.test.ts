import test from 'node:test';
import assert from 'node:assert/strict';
import { cities } from './data.js';
import { labels, languageDirection, languages, nextLanguage, regionLabels } from './i18n.js';
import { generateItinerary } from './planner.js';
import { calculateQiblaBearing } from './qibla.js';
import { classifyPrayerPlace, distanceKm, normalizePrayerPlace } from './prayer-spaces.js';
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


test('uses name:en before local OpenStreetMap names', () => {
  const place = normalizePrayerPlace({ type: 'node', id: 20, lat: 1, lon: 1, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'مسجد الاختبار', 'name:en': 'Test Mosque' } }, { latitude: 1, longitude: 1 });
  assert.equal(place?.name, 'Test Mosque');
  assert.equal(place?.originalName, 'مسجد الاختبار');
  assert.equal(place?.type, 'mosque');
});

test('renders Arabic mosque names as English-readable names', () => {
  const place = normalizePrayerPlace({ type: 'node', id: 21, lat: 1, lon: 1, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'مسجد الأقصى' } }, { latitude: 1, longitude: 1 });
  assert.equal(place?.name, 'Al-Aqsa Mosque');
  assert.equal(place?.originalName, 'مسجد الأقصى');
  assert.equal(place?.type, 'mosque');
});

test('transliterates non-Arabic non-Latin names', () => {
  const place = normalizePrayerPlace({ type: 'node', id: 22, lat: 1, lon: 1, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Мечеть Нур' } }, { latitude: 1, longitude: 1 });
  assert.equal(place?.name, 'Mechet Nur');
  assert.equal(place?.originalName, 'Мечеть Нур');
  assert.equal(place?.type, 'mosque');
});

test('uses int_name before local names', () => {
  const place = normalizePrayerPlace({ type: 'node', id: 23, lat: 1, lon: 1, tags: { amenity: 'prayer_room', name: 'غرفة صلاة', int_name: 'Airport Prayer Room' } }, { latitude: 1, longitude: 1 });
  assert.equal(place?.name, 'Airport Prayer Room');
  assert.equal(place?.originalName, 'غرفة صلاة');
  assert.equal(place?.type, 'prayer-room');
});

test('uses unnamed fallbacks only when no name exists', () => {
  const mosque = normalizePrayerPlace({ type: 'node', id: 24, lat: 1, lon: 1, tags: { amenity: 'place_of_worship', religion: 'muslim' } }, { latitude: 1, longitude: 1 });
  const room = normalizePrayerPlace({ type: 'node', id: 25, lat: 1, lon: 1, tags: { amenity: 'prayer_room' } }, { latitude: 1, longitude: 1 });
  assert.equal(mosque?.name, 'Unnamed Mosque');
  assert.equal(room?.name, 'Unnamed Prayer Space');
});
