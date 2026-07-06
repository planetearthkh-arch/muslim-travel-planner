import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCarRentalOffice } from './car-rental.js';
import type { OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278, label: 'London', timezone: 'Europe/London' };

function carRentalElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 987,
    lat: 51.5,
    lon: -0.12,
    tags: {
      amenity: 'car_rental',
      name: 'Test Car Rental',
      brand: 'TestRent',
      website: 'https://example.com',
      wheelchair: 'yes',
    },
    ...overrides,
  };
}

test('normalizeCarRentalOffice rejects malformed result coordinates', () => {
  assert.equal(normalizeCarRentalOffice(carRentalElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizeCarRentalOffice(carRentalElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizeCarRentalOffice(carRentalElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizeCarRentalOffice(carRentalElement({ lon: 190 }), origin), undefined);
});

test('normalizeCarRentalOffice rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizeCarRentalOffice(carRentalElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizeCarRentalOffice(carRentalElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('normalizeCarRentalOffice keeps valid car rental results usable', () => {
  const office = normalizeCarRentalOffice(carRentalElement(), origin);
  assert.equal(office?.locationType, 'independent');
  assert.equal(office?.name, 'TestRent');
  assert.equal(office?.brand, 'TestRent');
  assert.equal(office?.website, 'https://example.com/');
  assert.equal(office?.wheelchair, 'yes');
  assert.equal(Number.isFinite(office?.distanceKm), true);
});
