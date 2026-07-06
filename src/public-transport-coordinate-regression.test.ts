import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePublicTransportStop } from './public-transport.js';
import type { OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

function publicTransportElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 654,
    lat: 51.5,
    lon: -0.12,
    tags: {
      highway: 'bus_stop',
      name: 'Test Bus Stop',
      wheelchair: 'yes',
      shelter: 'yes',
      bench: 'yes',
      toilets: 'yes',
      route_ref: '24',
    },
    ...overrides,
  };
}

test('normalizePublicTransportStop rejects malformed result coordinates', () => {
  assert.equal(normalizePublicTransportStop(publicTransportElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizePublicTransportStop(publicTransportElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizePublicTransportStop(publicTransportElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizePublicTransportStop(publicTransportElement({ lon: 190 }), origin), undefined);
});

test('normalizePublicTransportStop rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizePublicTransportStop(publicTransportElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizePublicTransportStop(publicTransportElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('normalizePublicTransportStop keeps valid public transport results usable', () => {
  const stop = normalizePublicTransportStop(publicTransportElement(), origin);
  assert.equal(stop?.type, 'bus-stop');
  assert.equal(stop?.name, 'Test Bus Stop');
  assert.equal(stop?.wheelchair, 'yes');
  assert.equal(stop?.shelter, 'yes');
  assert.equal(stop?.seating, 'yes');
  assert.equal(stop?.toilets, 'yes');
  assert.equal(stop?.routes, '24');
  assert.equal(Number.isFinite(stop?.distanceKm), true);
});
