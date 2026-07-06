import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distanceKm,
  isValidPrayerCoordinate,
  normalizePrayerPlace,
  type OverpassElement,
} from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278 };

function mosqueElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 123,
    lat: 51.5,
    lon: -0.12,
    tags: {
      amenity: 'place_of_worship',
      religion: 'muslim',
      name: 'London Central Mosque',
    },
    ...overrides,
  };
}

test('isValidPrayerCoordinate validates finite latitude and longitude ranges', () => {
  assert.equal(isValidPrayerCoordinate(51.5, -0.12), true);
  assert.equal(isValidPrayerCoordinate(Number.NaN, -0.12), false);
  assert.equal(isValidPrayerCoordinate(51.5, Number.POSITIVE_INFINITY), false);
  assert.equal(isValidPrayerCoordinate(91, -0.12), false);
  assert.equal(isValidPrayerCoordinate(51.5, 181), false);
});

test('distanceKm never returns a finite distance for invalid coordinates', () => {
  assert.equal(Number.isFinite(distanceKm(51.5, -0.12, 51.6, -0.13)), true);
  assert.equal(Number.isNaN(distanceKm(Number.NaN, -0.12, 51.6, -0.13)), true);
  assert.equal(Number.isNaN(distanceKm(51.5, -0.12, 91, -0.13)), true);
});

test('normalizePrayerPlace rejects malformed Overpass coordinates', () => {
  assert.equal(normalizePrayerPlace(mosqueElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizePrayerPlace(mosqueElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizePrayerPlace(mosqueElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizePrayerPlace(mosqueElement({ lon: 190 }), origin), undefined);
});

test('normalizePrayerPlace rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizePrayerPlace(mosqueElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizePrayerPlace(mosqueElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('normalizePrayerPlace keeps valid mosque results usable', () => {
  const place = normalizePrayerPlace(mosqueElement(), origin);
  assert.equal(place?.type, 'mosque');
  assert.equal(place?.name, 'London Central Mosque');
  assert.equal(Number.isFinite(place?.distanceKm), true);
});
