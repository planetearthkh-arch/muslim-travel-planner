import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePrayerPlace, type OverpassElement, type OsmTags } from './prayer-spaces.js';

const origin = { latitude: 51.5074, longitude: -0.1278 };

function place(id: number, tags: OsmTags, lat = 51.5074, lon = -0.1278, type = 'node'): OverpassElement {
  return {
    type,
    id,
    lat,
    lon,
    tags: {
      amenity: 'place_of_worship',
      religion: 'muslim',
      ...tags,
    },
  };
}

test('broken Latin names are removed globally instead of being displayed', () => {
  for (const [index, name] of ['lshyj Mosque', 'lhstf~ Mosque', 'vkhvd', 'tvbh'].entries()) {
    const normalized = normalizePrayerPlace(place(index + 1, { name, 'name:en': name }), origin);
    assert.equal(normalized, undefined);
  }
});

test('generic facility-only names are removed globally', () => {
  const normalized = normalizePrayerPlace(place(10, { name: 'Masjid', 'name:en': 'Masjid' }), origin);
  assert.equal(normalized, undefined);
});

test('obvious non-Muslim places are excluded in every city', () => {
  const church = normalizePrayerPlace(place(20, { name: 'Saint Mark Church', 'name:en': 'Saint Mark Church' }, 40.7128, -74.0060), origin);
  const synagogue = normalizePrayerPlace(place(21, { name: 'Central Synagogue', 'name:en': 'Central Synagogue' }, 48.8566, 2.3522), origin);
  assert.equal(church, undefined);
  assert.equal(synagogue, undefined);
});

test('Arabic names are preferred and converted into readable English names', () => {
  const normalized = normalizePrayerPlace(place(30, { name: 'مسجد النور', 'name:ar': 'مسجد النور' }), origin);
  assert.equal(normalized?.name, 'Al-Noor Mosque');
});

test('common facility words are standardized globally', () => {
  const normalized = normalizePrayerPlace(place(40, { name: 'Masjid Al Noor', 'name:en': 'Masjid Al Noor' }), origin);
  assert.equal(normalized?.name, 'Al-Noor Mosque');
});

test('nearby node and building records for the same mosque share one identity worldwide', () => {
  const node = normalizePrayerPlace(place(50, { name: 'Masjid Al Noor', 'name:en': 'Masjid Al Noor' }, 51.50010, -0.10010, 'node'), origin);
  const way = normalizePrayerPlace(place(51, { name: 'Al-Noor Mosque', 'name:en': 'Al-Noor Mosque' }, 51.50020, -0.10020, 'way'), origin);
  if (!node || !way) throw new Error('Expected both duplicate records to normalize');
  assert.equal(node.id, way.id);
});

test('same-named mosques far apart retain different identities', () => {
  const first = normalizePrayerPlace(place(60, { name: 'Central Mosque', 'name:en': 'Central Mosque' }, 51.5000, -0.1000), origin);
  const second = normalizePrayerPlace(place(61, { name: 'Central Mosque', 'name:en': 'Central Mosque' }, 51.5200, -0.1200), origin);
  if (!first || !second) throw new Error('Expected both distant records to normalize');
  assert.equal(first.id === second.id, false);
});

test('unnamed facilities keep source-specific identities to avoid false merging', () => {
  const first = normalizePrayerPlace(place(70, {}, 51.50010, -0.10010, 'node'), origin);
  const second = normalizePrayerPlace(place(71, {}, 51.50011, -0.10011, 'way'), origin);
  if (!first || !second) throw new Error('Expected unnamed facilities to normalize');
  assert.equal(first.id === second.id, false);
});

test('non-prayer feature names keep their original capitalization', () => {
  const normalized = normalizePrayerPlace(place(80, { name: 'RentCo Mosque', 'name:en': 'RentCo Mosque' }), origin);
  assert.equal(normalized?.name, 'RentCo Mosque');
});
