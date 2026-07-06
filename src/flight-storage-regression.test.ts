import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLIGHT_MODE_STORAGE_KEY,
  FlightPlanRepository,
  parseStoredFlightPlan,
} from './flight-storage.js';
import {
  airports,
  createPreparedFlightPlan,
  type PreparedFlightPlan,
} from './flight-mode.js';

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

function validFlightPlan(): PreparedFlightPlan {
  const departure = airports.find((airport) => airport.iata === 'LHR');
  const arrival = airports.find((airport) => airport.iata === 'JFK');
  if (!departure || !arrival) throw new Error('Expected bundled LHR and JFK airports');
  const plan = createPreparedFlightPlan({
    departure,
    arrival,
    scheduledDepartureUtc: '2026-07-06T12:00:00.000Z',
    durationMinutes: 450,
    prayerMethod: 'Muslim World League',
    now: '2026-07-06T09:00:00.000Z',
  });
  if (!plan) throw new Error('Expected a valid flight plan fixture');
  return plan;
}

test('parseStoredFlightPlan accepts a valid stored flight plan', () => {
  const plan = validFlightPlan();
  const result = parseStoredFlightPlan(JSON.stringify({ schemaVersion: 1, plan }));
  assert.equal(result.corrupted, false);
  assert.equal(result.plan?.departure.iata, 'LHR');
  assert.equal(result.plan?.arrival.iata, 'JFK');
});

test('FlightPlanRepository.read self-heals corrupted saved flight data', () => {
  const storage = new MemoryStorage();
  storage.setItem(FLIGHT_MODE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, plan: { ...validFlightPlan(), durationMinutes: -1 } }));

  const result = new FlightPlanRepository(storage).read();

  assert.equal(result.corrupted, true);
  assert.equal(result.plan, null);
  assert.deepEqual(JSON.parse(storage.getItem(FLIGHT_MODE_STORAGE_KEY) ?? ''), { schemaVersion: 1, plan: null });
});

test('FlightPlanRepository.read still returns recovered result when self-heal write fails', () => {
  const storage = new FailingWriteStorage();
  storage.seed(FLIGHT_MODE_STORAGE_KEY, '{not valid json');

  const result = new FlightPlanRepository(storage).read();

  assert.equal(result.corrupted, true);
  assert.equal(result.plan, null);
});
