import assert from 'node:assert/strict';
import test from 'node:test';
import { JERUSALEM_PRAYER_SNAPSHOT } from './generated/jerusalem-prayer-snapshot.js';
import { isAllowedPrayerElement, sanitizePrayerElement, sanitizePrayerPayload } from './prayer-payload-sanitizer.js';
import type { OverpassElement } from './prayer-spaces.js';

const mosque: OverpassElement = {
  type: 'node',
  id: 1,
  lat: 31.78,
  lon: 35.23,
  tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Example Mosque' },
};

const clinic: OverpassElement = {
  type: 'node',
  id: 2,
  lat: 31.778,
  lon: 35.2354,
  tags: { amenity: 'clinic', name: 'Al-Aqsa Clinic', 'name:en': 'Al-Aqsa Clinic' },
};

const hospital: OverpassElement = {
  type: 'node',
  id: 3,
  lat: 31.778,
  lon: 35.2354,
  tags: { amenity: 'hospital', name: 'Al-Aqsa Hospital' },
};

const parent: OverpassElement = {
  type: 'relation',
  id: 4,
  center: { lat: 31.7776643, lon: 35.235806 },
  tags: { name: 'הר הבית', 'name:ar': 'الحرم الشريف', 'name:en': 'Al-Aqsa Compound' },
};

const outsideParent: OverpassElement = {
  type: 'node',
  id: 5,
  lat: 31.9,
  lon: 35.3,
  tags: { name: 'Al-Aqsa Compound' },
};

const hospitalPrayerRoom: OverpassElement = {
  type: 'node',
  id: 6,
  lat: 31.8,
  lon: 35.2,
  tags: { amenity: 'prayer_room', name: 'Hospital Prayer Room' },
};

test('only explicit prayer places and the real Al-Aqsa compound parent are allowed', () => {
  assert.equal(isAllowedPrayerElement(mosque), true);
  assert.equal(isAllowedPrayerElement(parent), true);
  assert.equal(isAllowedPrayerElement(hospitalPrayerRoom), true);
  assert.equal(isAllowedPrayerElement(clinic), false);
  assert.equal(isAllowedPrayerElement(hospital), false);
  assert.equal(isAllowedPrayerElement(outsideParent), false);
});

test('the Al-Aqsa compound parent becomes a proper Al-Aqsa Mosque result', () => {
  const sanitized = sanitizePrayerElement(parent);
  assert.equal(sanitized?.tags?.name, 'Al-Aqsa Mosque');
  assert.equal(sanitized?.tags?.['name:en'], 'Al-Aqsa Mosque');
  assert.equal(sanitized?.tags?.['name:ar'], 'المسجد الأقصى');
  assert.equal(sanitized?.tags?.amenity, 'place_of_worship');
  assert.equal(sanitized?.tags?.religion, 'muslim');
});

test('Al-Aqsa clinics and other non-prayer records are removed from every payload', () => {
  const sanitized = sanitizePrayerPayload({ elements: [mosque, clinic, hospital, parent, outsideParent, hospitalPrayerRoom] });
  assert.deepEqual(sanitized?.elements.map((element) => element.id), [1, 4, 6]);
  assert.equal(sanitized?.elements.find((element) => element.id === 4)?.tags?.name, 'Al-Aqsa Mosque');
});

test('the committed Jerusalem snapshot contains Al-Aqsa and excludes the clinic after sanitizing', () => {
  const sanitized = sanitizePrayerPayload(JERUSALEM_PRAYER_SNAPSHOT);
  const names = sanitized?.elements.flatMap((element) => [element.tags?.name, element.tags?.['name:en']].filter(Boolean)) ?? [];
  assert.equal(names.includes('Al-Aqsa Mosque'), true);
  assert.equal(names.includes('Al-Aqsa Clinic'), false);
});

test('invalid payloads are rejected instead of entering the prayer cache', () => {
  assert.equal(sanitizePrayerPayload(null), undefined);
  assert.equal(sanitizePrayerPayload({}), undefined);
  assert.equal(sanitizePrayerPayload({ elements: 'wrong' }), undefined);
});
