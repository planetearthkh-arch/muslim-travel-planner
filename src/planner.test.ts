import test from 'node:test';
import assert from 'node:assert/strict';
import { cities } from './data.js';
import { labels, languageDirection, languages, nextLanguage, regionLabels } from './i18n.js';
import { generateItinerary } from './planner.js';
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
