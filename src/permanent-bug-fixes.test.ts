import assert from 'node:assert/strict';
import test from 'node:test';
import { cities } from './data.js';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan } from './flight-mode.js';
import type { PlannerPreferences } from './models.js';
import { generateItinerary } from './planner.js';
import { createSavedTrip, validateSavedTrip } from './saved-trips.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

const prefs: PlannerPreferences = {
  city: 'Tokyo',
  startDate: '2026-07-01',
  endDate: '2026-07-01',
  startHour: '09:00',
  endHour: '18:00',
  interests: ['history'],
  groupSize: 2,
  children: false,
  walkingAbility: 'medium',
  transportation: 'public transport',
  budget: 'mid',
  prayerMethod: 'Muslim World League',
  prayerPreference: 'mosque',
  womenPrayerRequired: true,
  wuduRequired: true,
  accessibilityNeeds: '',
  halalPreference: 'strictly labelled',
};

test('iOS notification permission state is checked instead of assumed', async () => {
  const athan = await repoFile('src/athan.ts');
  assert.equal(athan.includes('LocalNotifications.checkPermissions()'), true);
  assert.equal(athan.includes("permissions.display === 'granted'"), true);
});

test('invalid and far-future GPS timestamps fall back to route estimates', () => {
  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  if (!departure || !arrival) throw new Error('Required test airports are unavailable');
  const now = Date.now();
  const plan = createPreparedFlightPlan({
    departure,
    arrival,
    scheduledDepartureUtc: new Date(now - 60 * 60 * 1000).toISOString(),
    durationMinutes: 420,
    prayerMethod: 'Muslim World League',
  });
  if (!plan) throw new Error('Could not create the test flight plan');
  const invalid = chooseFlightProgress(plan, { nowMs: now, gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: Number.NaN, source: 'gps' } });
  assert.equal(invalid.source, 'route-estimate');
  assert.equal(invalid.stale, true);
  const future = chooseFlightProgress(plan, { nowMs: now, gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: now + 60_000, source: 'gps' } });
  assert.equal(future.source, 'route-estimate');
  assert.equal(future.stale, true);
});

test('saved trips reject invalid timestamps, impossible dates, and impossible times', () => {
  const city = cities.find((candidate) => candidate.city === 'Tokyo') ?? cities[0];
  const trip = createSavedTrip({ language: 'en', preferences: prefs, city, itinerary: generateItinerary(prefs), now: '2026-07-01T10:00:00.000Z' });
  assert.equal(validateSavedTrip({ ...trip, savedAt: 'not-a-date' }), null);
  assert.equal(validateSavedTrip({ ...trip, preferences: { ...trip.preferences, startDate: '2026-02-31' }, dateRange: { ...trip.dateRange, startDate: '2026-02-31' } }), null);
  assert.equal(validateSavedTrip({ ...trip, preferences: { ...trip.preferences, startHour: '29:88' } }), null);
});

test('itinerary generation remains usable when a city has no prayer place', () => {
  const city = cities.find((candidate) => candidate.city === 'Tokyo') ?? cities[0];
  const originalPlaces = [...city.places];
  city.places.splice(0, city.places.length, ...originalPlaces.filter((place) => place.type !== 'mosque' && place.type !== 'prayer-space'));
  try {
    const items = generateItinerary({ ...prefs, city: city.city });
    assert.equal(items.some((item) => item.kind === 'prayer'), false);
    assert.equal(items.length > 0, true);
  } finally {
    city.places.splice(0, city.places.length, ...originalPlaces);
  }
});
