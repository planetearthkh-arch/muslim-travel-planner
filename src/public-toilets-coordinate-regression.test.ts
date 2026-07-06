import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePublicToilet } from './public-toilets.js';
import type { OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

function publicToiletElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 789,
    lat: 51.5,
    lon: -0.12,
    tags: {
      amenity: 'toilets',
      name: 'Test Public Toilets',
      fee: 'no',
      wheelchair: 'yes',
    },
    ...overrides,
  };
}

test('normalizePublicToilet rejects malformed result coordinates', () => {
  assert.equal(normalizePublicToilet(publicToiletElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizePublicToilet(publicToiletElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizePublicToilet(publicToiletElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizePublicToilet(publicToiletElement({ lon: 190 }), origin), undefined);
});

test('normalizePublicToilet rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizePublicToilet(publicToiletElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizePublicToilet(publicToiletElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('normalizePublicToilet keeps valid public toilet results usable', () => {
  const toilet = normalizePublicToilet(publicToiletElement(), origin);
  assert.equal(toilet?.kind, 'accessible');
  assert.equal(toilet?.access, 'public');
  assert.equal(toilet?.name, 'Test Public Toilets');
  assert.equal(toilet?.fee, 'free');
  assert.equal(toilet?.wheelchair, 'yes');
  assert.equal(Number.isFinite(toilet?.distanceKm), true);
});
