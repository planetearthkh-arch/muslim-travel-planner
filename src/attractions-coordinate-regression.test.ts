import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAttractionOverpassBatches, buildAttractionOverpassQuery, normalizeAttraction } from './attractions.js';
import type { OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

function attractionElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 246,
    lat: 51.5,
    lon: -0.12,
    tags: {
      tourism: 'museum',
      name: 'Test Museum',
      website: 'https://example.com',
      wheelchair: 'yes',
      fee: 'no',
      opening_hours: 'Mo-Su 09:00-17:00',
      wikipedia: 'en:Test_Museum',
      wikidata: 'Q12345',
    },
    ...overrides,
  };
}

test('normalizeAttraction rejects malformed result coordinates', () => {
  assert.equal(normalizeAttraction(attractionElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizeAttraction(attractionElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizeAttraction(attractionElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizeAttraction(attractionElement({ lon: 190 }), origin), undefined);
});

test('normalizeAttraction rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizeAttraction(attractionElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizeAttraction(attractionElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('attraction Overpass query builders reject malformed search coordinates', () => {
  assert.throws(() => buildAttractionOverpassBatches(Number.NaN, -0.1278, 5), /Invalid attraction coordinates/);
  assert.throws(() => buildAttractionOverpassBatches(51.5074, Number.POSITIVE_INFINITY, 5), /Invalid attraction coordinates/);
  assert.throws(() => buildAttractionOverpassQuery(95, -0.1278, 5), /Invalid attraction coordinates/);
  assert.throws(() => buildAttractionOverpassQuery(51.5074, 190, 5), /Invalid attraction coordinates/);
});

test('attraction coordinate hardening keeps valid attractions usable', () => {
  const attraction = normalizeAttraction(attractionElement(), origin);
  assert.equal(attraction?.category, 'museum');
  assert.equal(attraction?.name, 'Test Museum');
  assert.equal(attraction?.website, 'https://example.com/');
  assert.equal(attraction?.wheelchair, 'yes');
  assert.equal(attraction?.fee, 'free');
  assert.equal(attraction?.wikipedia, 'Test Museum');
  assert.equal(attraction?.wikidata, 'Q12345');
  assert.equal(Number.isFinite(attraction?.distanceKm), true);

  const query = buildAttractionOverpassQuery(51.5074, -0.1278, 5);
  assert.match(query, /out center tags/);
  assert.doesNotMatch(query, /NaN|Infinity/);
});
