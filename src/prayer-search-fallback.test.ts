import assert from 'node:assert/strict';
import test from 'node:test';
import { JERUSALEM_PRAYER_SNAPSHOT } from './generated/jerusalem-prayer-snapshot.js';
import {
  isFinalPrayerProvider,
  isPrayerOverpassQuery,
  isRetryablePrayerFailure,
  prayerFallbackPayload,
  prayerQueryFromBody,
  readPrayerSearchCache,
  snapshotPayloadForQuery,
  writePrayerSearchCache,
  type PrayerSearchSnapshot,
} from './prayer-search-fallback.js';

class TestStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const jerusalemQuery = `[out:json][timeout:25];(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:10000,31.778,35.235);
  node["amenity"="prayer_room"](around:10000,31.778,35.235);
);out center tags;`;

const snapshot: PrayerSearchSnapshot = {
  generatedAt: '2026-07-05T00:00:00.000Z',
  center: { latitude: 31.7783, longitude: 35.2354 },
  radiusKm: 25,
  elements: [
    { type: 'node', id: 1, lat: 31.7769, lon: 35.2353, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Al-Aqsa Mosque' } },
    { type: 'node', id: 2, lat: 32.4, lon: 35.9, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Outside Search Radius Mosque' } },
  ],
};

test('committed Jerusalem snapshot is populated and includes Al-Aqsa', () => {
  assert.equal(JERUSALEM_PRAYER_SNAPSHOT.elements.length >= 5, true);
  const names = JERUSALEM_PRAYER_SNAPSHOT.elements.flatMap((element) => {
    const tags = element.tags ?? {};
    return [tags.name, tags['name:en'], tags['name:ar'], tags.official_name, tags['official_name:en'], tags['official_name:ar']].filter(Boolean);
  }).join(' ');
  assert.match(names, /Al-Aqsa|الأقصى|الاقصى/i);
});

test('form-encoded prayer queries are detected correctly', () => {
  const encoded = `data=${encodeURIComponent(jerusalemQuery)}`;
  assert.equal(prayerQueryFromBody(encoded), jerusalemQuery);
  assert.equal(isPrayerOverpassQuery(prayerQueryFromBody(encoded)), true);
  assert.equal(isPrayerOverpassQuery('[out:json];node["amenity"="toilets"];out;'), false);
});

test('successful prayer results persist and remain available without expiration', () => {
  const storage = new TestStorage();
  const payload = { elements: [snapshot.elements[0]] };
  assert.equal(writePrayerSearchCache(storage, jerusalemQuery, payload, new Date('2026-07-05T00:00:00Z')), true);
  assert.deepEqual(readPrayerSearchCache(storage, jerusalemQuery), payload);
  assert.deepEqual(prayerFallbackPayload(storage, jerusalemQuery, snapshot), payload);
});

test('Jerusalem snapshot supplies nearby records and filters distant records', () => {
  const payload = snapshotPayloadForQuery(snapshot, jerusalemQuery);
  assert.deepEqual(payload?.elements.map((element) => element.id), [1]);
});

test('Jerusalem snapshot is not used for unrelated cities', () => {
  const london = jerusalemQuery.replace('31.778,35.235', '51.5074,-0.1278');
  assert.equal(snapshotPayloadForQuery(snapshot, london), undefined);
});

test('fallback ignores malformed persistent data and uses the bundled snapshot', () => {
  const storage = new TestStorage();
  storage.setItem('mtp-prayer-search-v2:broken', '{bad json');
  assert.deepEqual(prayerFallbackPayload(storage, jerusalemQuery, snapshot)?.elements.map((element) => element.id), [1]);
});

test('only temporary failures at the last provider are replaced by fallback data', () => {
  assert.equal(isRetryablePrayerFailure(503), true);
  assert.equal(isRetryablePrayerFailure(400), false);
  assert.equal(isFinalPrayerProvider('https://maps.mail.ru/osm/tools/overpass/api/interpreter'), true);
  assert.equal(isFinalPrayerProvider('https://overpass-api.de/api/interpreter'), false);
});
