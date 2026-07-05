import assert from 'node:assert/strict';
import test from 'node:test';
import { isAlAqsaCompoundSubstructure, normalizePrayerPlace, type OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 31.778, longitude: 35.235 };

function place(id: number, name: string, lat: number, lon: number): OverpassElement {
  return {
    type: 'node',
    id,
    lat,
    lon,
    tags: {
      amenity: 'place_of_worship',
      religion: 'muslim',
      name,
      'name:en': name,
    },
  };
}

test('dome-named substructures inside the compound are excluded', () => {
  const dome = place(1, 'Dome of the Chain', 31.7782, 35.2351);
  assert.equal(isAlAqsaCompoundSubstructure(dome.tags ?? {}, dome.lat ?? 0, dome.lon ?? 0), true);
  assert.equal(normalizePrayerPlace(dome, origin), undefined);
});

test('transliterated dome names inside the compound are excluded', () => {
  const dome = place(2, 'Qubbat al-Silsila', 31.7783, 35.2350);
  assert.equal(normalizePrayerPlace(dome, origin), undefined);
});

test('the main mosque remains in the prayer-place list', () => {
  const mainMosque = place(3, 'Al-Aqsa Mosque', 31.7769, 35.2353);
  const normalized = normalizePrayerPlace(mainMosque, origin);
  assert.equal(normalized?.name, 'Al-Aqsa Mosque');
  assert.equal(normalized?.type, 'mosque');
});

test('dome-named mosques outside the compound are not globally hidden', () => {
  const elsewhere = place(4, 'Dome Mosque', 31.90, 35.30);
  assert.equal(isAlAqsaCompoundSubstructure(elsewhere.tags ?? {}, elsewhere.lat ?? 0, elsewhere.lon ?? 0), false);
  assert.equal(normalizePrayerPlace(elsewhere, origin)?.name, 'Dome Mosque');
});
