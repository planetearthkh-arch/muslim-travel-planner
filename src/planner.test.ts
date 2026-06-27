import test from 'node:test';
import assert from 'node:assert/strict';
import { cities } from './data.js';
import { generateItinerary } from './planner.js';
import type { PlannerPreferences } from './models.js';

const prefs: PlannerPreferences = { city: 'Tokyo', startDate: '2026-07-01', endDate: '2026-07-01', startHour: '09:00', endHour: '18:00', interests: ['history'], groupSize: 2, children: false, walkingAbility: 'medium', transportation: 'public transport', budget: 'mid', prayerMethod: 'Muslim World League', prayerPreference: 'mosque', womenPrayerRequired: true, wuduRequired: true, accessibilityNeeds: 'step-free', halalPreference: 'strictly labelled' };

test('contains all required sample cities', () => {
  assert.deepEqual(cities.map((c) => c.city), ['Jerusalem', 'London', 'Istanbul', 'Paris', 'Tokyo', 'New York']);
});

test('generates prayer, attraction, travel, and halal-conscious meal items', () => {
  const items = generateItinerary(prefs);
  assert.equal(items.some((i) => i.kind === 'prayer'), true);
  assert.equal(items.some((i) => i.kind === 'attraction'), true);
  assert.equal(items.some((i) => i.kind === 'travel'), true);
  assert.equal(items.some((i) => i.kind === 'meal' && i.details.includes('Unverified')), true);
});


test('exposes Sample, Unverified, and Verified labels in prototype data', () => {
  const statuses = new Set(cities.flatMap((city) => city.places.map((place) => place.verification)));
  assert.equal(statuses.has('Sample'), true);
  assert.equal(statuses.has('Unverified'), true);
  assert.equal(statuses.has('Verified'), true);
});
