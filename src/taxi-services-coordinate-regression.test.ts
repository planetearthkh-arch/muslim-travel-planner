import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTaxiService } from './taxi-services.js';
import type { OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

function taxiServiceElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 321,
    lat: 51.5,
    lon: -0.12,
    tags: {
      amenity: 'taxi',
      name: 'Test Taxi Rank',
      operator: 'Test Taxi Operator',
      phone: '+44 20 1234 5678',
      website: 'https://example.com',
      wheelchair: 'yes',
      shelter: 'yes',
      lit: 'yes',
      capacity: '5',
    },
    ...overrides,
  };
}

test('normalizeTaxiService rejects malformed result coordinates', () => {
  assert.equal(normalizeTaxiService(taxiServiceElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizeTaxiService(taxiServiceElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizeTaxiService(taxiServiceElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizeTaxiService(taxiServiceElement({ lon: 190 }), origin), undefined);
});

test('normalizeTaxiService rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizeTaxiService(taxiServiceElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizeTaxiService(taxiServiceElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('normalizeTaxiService keeps valid taxi service results usable', () => {
  const taxi = normalizeTaxiService(taxiServiceElement(), origin);
  assert.equal(taxi?.type, 'rank');
  assert.equal(taxi?.name, 'Test Taxi Rank');
  assert.equal(taxi?.operator, 'Test Taxi Operator');
  assert.equal(taxi?.callHref, 'tel:+442012345678');
  assert.equal(taxi?.website, 'https://example.com/');
  assert.equal(taxi?.wheelchair, 'yes');
  assert.equal(taxi?.shelter, 'yes');
  assert.equal(taxi?.lit, 'yes');
  assert.equal(Number.isFinite(taxi?.distanceKm), true);
});
