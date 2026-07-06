import { validateFlightPlan, type PreparedFlightPlan } from './flight-mode.js';

export const FLIGHT_MODE_STORAGE_KEY = 'safarone-flight-mode-v1';

export type StoredFlightMode = {
  schemaVersion: 1;
  plan: PreparedFlightPlan | null;
};

function storedFlightMode(plan: PreparedFlightPlan | null): StoredFlightMode {
  return { schemaVersion: 1, plan };
}

export function parseStoredFlightPlan(raw: string | null) {
  if (!raw) return { plan: null as PreparedFlightPlan | null, corrupted: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { plan: null, corrupted: true };
    const record = parsed as Record<string, unknown>;
    if (record.schemaVersion !== 1) return { plan: null, corrupted: true };
    const plan = validateFlightPlan(record.plan);
    return { plan, corrupted: Boolean(record.plan && !plan) };
  } catch {
    return { plan: null, corrupted: true };
  }
}

export class FlightPlanRepository {
  constructor(private readonly storage: Storage, private readonly key = FLIGHT_MODE_STORAGE_KEY) {}

  read() {
    const result = parseStoredFlightPlan(this.storage.getItem(this.key));
    if (result.corrupted) {
      try {
        this.storage.setItem(this.key, JSON.stringify(storedFlightMode(result.plan)));
      } catch {
        // Keep returning the recovered in-memory result even if storage is unavailable.
      }
    }
    return result;
  }

  save(plan: PreparedFlightPlan) {
    const valid = validateFlightPlan(plan);
    if (!valid) throw new Error('Invalid flight plan');
    const next = storedFlightMode(valid);
    this.storage.setItem(this.key, JSON.stringify(next));
    return valid;
  }

  clear() {
    this.storage.removeItem(this.key);
  }
}
