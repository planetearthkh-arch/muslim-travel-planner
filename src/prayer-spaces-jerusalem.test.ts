import assert from 'node:assert/strict';
import test from 'node:test';
import { isAlAqsaCompoundSubstructure, normalizePrayerPlace, type OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 31.778, longitude: 35.235 };

function place(id: number, name: string, lat: number, lon: number, type = 'node'): OverpassElement {
  return {
    type,
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

test('all internal Al-Aqsa compound prayer structures are grouped under the main mosque', () => {
  const internalNames = [
    'Dome of the Chain',
    'Qubbat al-Silsila',
    'Al-Marwani Prayer Hall',
    'Throne of Solomon',
    'Al-Buraq Mosque',
  ];
  for (const [index, name] of internalNames.entries()) {
    const internal = place(index + 1, name, 31.7782, 35.2351);
    assert.equal(isAlAqsaCompoundSubstructure(internal.tags ?? {}, internal.lat ?? 0, internal.lon ?? 0), true);
    assert.equal(normalizePrayerPlace(internal, origin), undefined);
  }
});

test('Al-Aqsa Mosque itself remains in the prayer-place list', () => {
  const mainMosque = place(20, 'Al-Aqsa Mosque', 31.7769, 35.2353);
  const normalized = normalizePrayerPlace(mainMosque, origin);
  assert.equal(normalized?.name, 'Al-Aqsa Mosque');
  assert.equal(normalized?.type, 'mosque');
});

test('similarly named places outside the compound are not globally hidden', () => {
  const elsewhere = place(21, 'Dome Mosque', 31.90, 35.30);
  assert.equal(isAlAqsaCompoundSubstructure(elsewhere.tags ?? {}, elsewhere.lat ?? 0, elsewhere.lon ?? 0), false);
  assert.equal(normalizePrayerPlace(elsewhere, origin)?.name, 'Dome Mosque');
});

test('broken transliterations and generic-only names are excluded from Jerusalem results', () => {
  for (const [index, name] of ['lshyj Mosque', 'lhstf~ Mosque', 'vkhvd', 'tvbh', 'Masjid'].entries()) {
    assert.equal(normalizePrayerPlace(place(30 + index, name, 31.79, 35.22), origin), undefined);
  }
});

test('obvious non-Muslim places are rejected even when their source tags are wrong', () => {
  assert.equal(normalizePrayerPlace(place(40, 'Saint Mark Church', 31.79, 35.22), origin), undefined);
});

test('common Jerusalem mosque names are normalized consistently', () => {
  const examples: Array<[string, string]> = [
    ['Al Sheikh Sarah Mosque', 'Al-Sheikh Jarrah Mosque'],
    ["Said wa Su'ayd Masjid", "Said wa Su'ayd Mosque"],
    ['Al Farooq Masjid', 'Al-Farouq Mosque'],
    ['Al Abrar Mosque', 'Al-Abrar Mosque'],
    ['Salah Al Din Masjid', 'Salah al-Din Mosque'],
    ['Salah El Din Mosque', 'Salah al-Din Mosque'],
    ['Uthman ibn Affan Mosque', 'Othman ibn Affan Mosque'],
    ['Al Nhayyan Mosque', 'Al-Nahyan Mosque'],
  ];
  for (const [index, [input, expected]] of examples.entries()) {
    assert.equal(normalizePrayerPlace(place(50 + index, input, 31.79, 35.22), origin)?.name, expected);
  }
});

test('duplicate OSM records receive the same Jerusalem identity', () => {
  const first = normalizePrayerPlace(place(70, 'Al Farooq Masjid', 31.7901, 35.2201, 'node'), origin);
  const second = normalizePrayerPlace(place(71, 'Al-Farouq Mosque', 31.7904, 35.2204, 'way'), origin);
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.id, second.id);
});
