import { validateFlightPlan, type PreparedFlightPlan } from './flight-mode.js';

export const FLIGHT_MODE_STORAGE_KEY = 'safarone-flight-mode-v1';

export type StoredFlightMode = {
  schemaVersion: 1;
  plan: PreparedFlightPlan | null;
};

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
    return parseStoredFlightPlan(this.storage.getItem(this.key));
  }

  save(plan: PreparedFlightPlan) {
    const valid = validateFlightPlan(plan);
    if (!valid) throw new Error('Invalid flight plan');
    const next: StoredFlightMode = { schemaVersion: 1, plan: valid };
    this.storage.setItem(this.key, JSON.stringify(next));
    return valid;
  }

  clear() {
    this.storage.removeItem(this.key);
  }
}

