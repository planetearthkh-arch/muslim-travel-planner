import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedPrayerElement, sanitizePrayerPayload } from './prayer-payload-sanitizer.js';
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
  center: { lat: 31.778, lon: 35.2354 },
  tags: { name: 'Al-Aqsa Mosque', 'name:ar': 'المسجد الأقصى' },
};

const outsideParent: OverpassElement = {
  type: 'node',
  id: 5,
  lat: 31.9,
  lon: 35.3,
  tags: { name: 'Al-Aqsa Mosque' },
};

const hospitalPrayerRoom: OverpassElement = {
  type: 'node',
  id: 6,
  lat: 31.8,
  lon: 35.2,
  tags: { amenity: 'prayer_room', name: 'Hospital Prayer Room' },
};

test('only explicit prayer places and the exact Al-Aqsa parent are allowed', () => {
  assert.equal(isAllowedPrayerElement(mosque), true);
  assert.equal(isAllowedPrayerElement(parent), true);
  assert.equal(isAllowedPrayerElement(hospitalPrayerRoom), true);
  assert.equal(isAllowedPrayerElement(clinic), false);
  assert.equal(isAllowedPrayerElement(hospital), false);
  assert.equal(isAllowedPrayerElement(outsideParent), false);
});

test('Al-Aqsa clinics and other non-prayer records are removed from every payload', () => {
  const sanitized = sanitizePrayerPayload({ elements: [mosque, clinic, hospital, parent, outsideParent, hospitalPrayerRoom] });
  assert.deepEqual(sanitized?.elements.map((element) => element.id), [1, 4, 6]);
});

test('invalid payloads are rejected instead of entering the prayer cache', () => {
  assert.equal(sanitizePrayerPayload(null), undefined);
  assert.equal(sanitizePrayerPayload({}), undefined);
  assert.equal(sanitizePrayerPayload({ elements: 'wrong' }), undefined);
});
