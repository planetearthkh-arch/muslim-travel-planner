import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverpassQuery, classifyPrayerPlace, isAlAqsaCompoundSubstructure, normalizePrayerPlace, type OverpassElement } from './prayer-spaces.js';

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

test('Al-Aqsa parent objects without normal mosque tags are still accepted', () => {
  const parent: OverpassElement = {
    type: 'relation',
    id: 21,
    center: { lat: 31.7780, lon: 35.2354 },
    tags: { name: 'Al-Aqsa Mosque', 'name:ar': 'المسجد الأقصى' },
  };
  assert.equal(classifyPrayerPlace(parent.tags ?? {}), 'mosque');
  assert.equal(normalizePrayerPlace(parent, origin)?.name, 'Al-Aqsa Mosque');
});

test('Al-Aqsa multilingual name selectors are added only for nearby searches', () => {
  const jerusalemQuery = buildOverpassQuery(origin.latitude, origin.longitude, 5);
  const londonQuery = buildOverpassQuery(51.5074, -0.1278, 5);
  assert.equal(jerusalemQuery.includes('["name:ar"~'), true);
  assert.equal(jerusalemQuery.includes('Aqsa'), true);
  assert.equal(londonQuery.includes('["name:ar"~'), false);
});

test('similarly named places outside the compound are not globally hidden', () => {
  const elsewhere = place(22, 'Dome Mosque', 31.90, 35.30);
  assert.equal(isAlAqsaCompoundSubstructure(elsewhere.tags ?? {}, elsewhere.lat ?? 0, elsewhere.lon ?? 0), false);
  assert.equal(normalizePrayerPlace(elsewhere, origin)?.name, 'Dome Mosque');
});

test('broken and generic Jerusalem names become neutral labels instead of disappearing', () => {
  for (const [index, name] of ['lshyj Mosque', 'lhstf~ Mosque', 'vkhvd', 'tvbh', 'Masjid'].entries()) {
    assert.equal(normalizePrayerPlace(place(30 + index, name, 31.79, 35.22), origin)?.name, 'Unnamed Mosque');
  }
});

test('obvious non-Muslim places are rejected even when source tags are wrong', () => {
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
  if (!first || !second) throw new Error('Expected both duplicate records to normalize');
  assert.equal(first.id, second.id);
});
