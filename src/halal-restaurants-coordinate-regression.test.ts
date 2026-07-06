import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeHalalRestaurant,
  type HalalRestaurant,
} from './halal-restaurants.js';
import type { OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };

function halalRestaurantElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 456,
    lat: 51.5,
    lon: -0.12,
    tags: {
      amenity: 'restaurant',
      'diet:halal': 'only',
      name: 'Test Halal Restaurant',
      cuisine: 'middle_eastern;turkish',
    },
    ...overrides,
  };
}

function expectRestaurant(value: HalalRestaurant | undefined): HalalRestaurant {
  assert.ok(value, 'Expected a halal restaurant result');
  return value;
}

test('normalizeHalalRestaurant rejects malformed result coordinates', () => {
  assert.equal(normalizeHalalRestaurant(halalRestaurantElement({ lat: Number.NaN }), origin), undefined);
  assert.equal(normalizeHalalRestaurant(halalRestaurantElement({ lon: Number.POSITIVE_INFINITY }), origin), undefined);
  assert.equal(normalizeHalalRestaurant(halalRestaurantElement({ lat: 95 }), origin), undefined);
  assert.equal(normalizeHalalRestaurant(halalRestaurantElement({ lon: 190 }), origin), undefined);
});

test('normalizeHalalRestaurant rejects invalid search origins before calculating distance', () => {
  assert.equal(normalizeHalalRestaurant(halalRestaurantElement(), { latitude: Number.NaN, longitude: -0.1278 }), undefined);
  assert.equal(normalizeHalalRestaurant(halalRestaurantElement(), { latitude: 51.5074, longitude: 181 }), undefined);
});

test('normalizeHalalRestaurant keeps valid halal restaurant results usable', () => {
  const restaurant = expectRestaurant(normalizeHalalRestaurant(halalRestaurantElement(), origin));
  assert.equal(restaurant.type, 'restaurant');
  assert.equal(restaurant.halalStatus, 'halal-only');
  assert.equal(restaurant.name, 'Test Halal Restaurant');
  assert.deepEqual(restaurant.cuisine, ['middle_eastern', 'turkish']);
  assert.equal(Number.isFinite(restaurant.distanceKm), true);
});
