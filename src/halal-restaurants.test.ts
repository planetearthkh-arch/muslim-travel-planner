import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHalalOverpassQuery,
  classifyHalalStatus,
  filterRestaurants,
  hasReliableHalalStatus,
  normalizeHalalRestaurant,
  restaurantDisplayName,
  type HalalRestaurant,
  type RestaurantFilters,
} from './halal-restaurants.js';

const defaultFilters: RestaurantFilters = {
  status: 'reliable',
  type: 'all',
  cuisine: '',
  openNow: false,
  takeaway: false,
  delivery: false,
  wheelchair: false,
};

test('halal classification accepts trimmed and common affirmative mapped values', () => {
  assert.equal(classifyHalalStatus({ 'diet:halal': ' ONLY ' }), 'halal-only');
  for (const value of ['yes', ' designated ', 'AVAILABLE', 'true', '1']) {
    assert.equal(classifyHalalStatus({ 'diet:halal': value }), 'halal-options');
    assert.equal(classifyHalalStatus({ halal: value }), 'legacy-halal');
  }
});

test('halal classification rejects explicit negatives even when padded or mixed case', () => {
  for (const value of [' no ', 'NONE', ' False ', '0']) {
    assert.equal(classifyHalalStatus({ 'diet:halal': value, halal: 'yes' }), undefined);
    assert.equal(classifyHalalStatus({ halal: value, 'diet:halal': 'yes' }), undefined);
  }
});

test('default restaurant results show explicit legacy halal tags but not text-only possibilities', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const legacy = normalizeHalalRestaurant({
    type: 'node',
    id: 1,
    lat: 0,
    lon: 0,
    tags: { amenity: 'restaurant', halal: 'yes', name: 'Legacy Grill' },
  }, origin, true);
  const possible = normalizeHalalRestaurant({
    type: 'node',
    id: 2,
    lat: 0.01,
    lon: 0,
    tags: { amenity: 'restaurant', description: 'Halal food may be available', name: 'Possible Grill' },
  }, origin, true);
  const restaurants = [legacy, possible].filter((item): item is HalalRestaurant => Boolean(item));

  assert.deepEqual(filterRestaurants(restaurants, defaultFilters).map((item) => item.name), ['Legacy Grill']);
  assert.equal(hasReliableHalalStatus('legacy-halal'), false);
  assert.equal(filterRestaurants(restaurants, { ...defaultFilters, status: 'possible-unverified' }).length, 1);
});

test('restaurant display names never leak prayer-space fallback text', () => {
  assert.equal(restaurantDisplayName({}, 'restaurant'), 'Unnamed Halal Restaurant');
  assert.equal(restaurantDisplayName({}, 'cafe'), 'Unnamed Halal Cafe');
  assert.equal(restaurantDisplayName({ name: 'مطعم النور' }, 'restaurant').includes('Prayer Space'), false);
});

test('halal Overpass query keeps wider searches lightweight', () => {
  const wideQuery = buildHalalOverpassQuery(51.5, -0.1, 5);
  assert.equal(wideQuery.includes('nwr["amenity"'), true);
  assert.equal(wideQuery.includes('node["amenity"'), false);
  assert.equal(wideQuery.includes('way["amenity"'), false);
  assert.equal(wideQuery.includes('relation["amenity"'), false);
  assert.equal(wideQuery.includes('["diet:halal"]["diet:halal"~"^(yes|only|designated|available|true|1)$",i]'), true);
  assert.equal(wideQuery.includes('["halal"]["halal"~"^(yes|only|designated|available|true|1)$",i]'), true);
  assert.equal(wideQuery.includes('["halal:certification"]["halal:certification"~".+"]'), true);
  assert.equal(wideQuery.includes('["description"~"halal",i]'), false);
  assert.equal(wideQuery.includes('(around:5000,51.5,-0.1)'), true);
  assert.equal((wideQuery.match(/nwr/g) ?? []).length, 5);

  const nearbyQuery = buildHalalOverpassQuery(51.5, -0.1, 1);
  assert.equal(nearbyQuery.includes('["description"~"halal",i]'), true);
  assert.equal(nearbyQuery.includes('["description:en"~"halal",i]'), true);
  assert.equal(nearbyQuery.includes('["note"~"halal",i]'), true);
  assert.equal((nearbyQuery.match(/nwr/g) ?? []).length, 8);

  assert.equal(buildHalalOverpassQuery(0, 0, 0).includes('(around:1000,0,0)'), true);
  assert.equal(buildHalalOverpassQuery(0, 0, 500).includes('(around:50000,0,0)'), true);
  assert.equal(buildHalalOverpassQuery(0, 0, Number.NaN).includes('(around:5000,0,0)'), true);
});

test('cuisine filters are case-insensitive', () => {
  const restaurant = normalizeHalalRestaurant({
    type: 'node',
    id: 3,
    lat: 0,
    lon: 0,
    tags: { amenity: 'restaurant', 'diet:halal': 'yes', name: 'Pizza Place', cuisine: 'Pizza;Burgers' },
  }, { latitude: 0, longitude: 0, timezone: 'UTC' });
  assert.equal(filterRestaurants([restaurant].filter((item): item is HalalRestaurant => Boolean(item)), { ...defaultFilters, cuisine: 'pizza' }).length, 1);
});
