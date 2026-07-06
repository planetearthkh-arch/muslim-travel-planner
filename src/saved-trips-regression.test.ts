import assert from 'node:assert/strict';
import test from 'node:test';
import type { CityData, ItineraryItem, PlannerPreferences } from './models.js';
import {
  SAVED_TRIPS_STORAGE_KEY,
  SavedTripRepository,
  createSavedTrip,
  parseSavedTrips,
  type SavedTrip,
} from './saved-trips.js';
import { emptyTravelDetails } from './travel-details.js';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(String(key)) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(String(key)); }
  setItem(key: string, value: string) { this.values.set(String(key), String(value)); }
}

class FailingWriteStorage extends MemoryStorage {
  setItem(_key: string, _value: string) {
    throw new Error('Storage write failed');
  }

  seed(key: string, value: string) {
    super.setItem(key, value);
  }
}

const preferences: PlannerPreferences = {
  city: 'London',
  startDate: '2026-07-06',
  endDate: '2026-07-07',
  startHour: '09:00',
  endHour: '18:00',
  interests: ['history', 'family'],
  groupSize: 4,
  children: true,
  walkingAbility: 'medium',
  transportation: 'public transport',
  budget: 'mid',
  prayerMethod: 'Muslim World League',
  prayerPreference: 'mosque',
  womenPrayerRequired: true,
  wuduRequired: true,
  accessibilityNeeds: '',
  halalPreference: 'strictly labelled',
};

const city = {
  city: 'London',
  country: 'United Kingdom',
  timezone: 'Europe/London',
  coordinates: { lat: 51.5074, lng: -0.1278 },
  money: { localCurrencies: [{ code: 'GBP', symbol: '£', name: 'British Pound' }] },
} as unknown as CityData;

const itinerary: ItineraryItem[] = [
  {
    id: 'item-1',
    date: '2026-07-06',
    time: '09:00',
    title: 'Start trip',
    kind: 'free-time',
    durationMinutes: 60,
    details: 'Begin the day.',
    status: 'Verified',
  },
];

function validTrip(name = 'London trip'): SavedTrip {
  return createSavedTrip({
    name,
    language: 'en',
    preferences,
    city,
    itinerary,
    travelDetails: emptyTravelDetails(),
    now: '2026-07-06T10:00:00.000Z',
  });
}

test('parseSavedTrips recovers valid trips while flagging corrupted entries', () => {
  const trip = validTrip();
  const result = parseSavedTrips(JSON.stringify({ schemaVersion: 1, trips: [trip, { id: 'broken' }] }));

  assert.equal(result.corrupted, true);
  assert.equal(result.trips.length, 1);
  assert.equal(result.trips[0].id, trip.id);
});

test('SavedTripRepository.read self-heals recovered storage', () => {
  const storage = new MemoryStorage();
  const trip = validTrip();
  storage.setItem(SAVED_TRIPS_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, trips: [trip, { id: 'broken' }] }));

  const repository = new SavedTripRepository(storage);
  const recovered = repository.read();

  assert.equal(recovered.corrupted, true);
  assert.equal(recovered.trips.length, 1);

  const stored = JSON.parse(storage.getItem(SAVED_TRIPS_STORAGE_KEY) ?? '{}') as { trips?: SavedTrip[] };
  assert.equal(stored.trips?.length, 1);
  assert.equal(stored.trips?.[0]?.id, trip.id);

  const secondRead = repository.read();
  assert.equal(secondRead.corrupted, false);
  assert.equal(secondRead.trips.length, 1);
});

test('SavedTripRepository.read still returns recovered trips if self-heal write fails', () => {
  const storage = new FailingWriteStorage();
  const trip = validTrip();
  storage.seed(SAVED_TRIPS_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, trips: [trip, { id: 'broken' }] }));

  const repository = new SavedTripRepository(storage);
  const recovered = repository.read();

  assert.equal(recovered.corrupted, true);
  assert.equal(recovered.trips.length, 1);
  assert.equal(recovered.trips[0].id, trip.id);
});
