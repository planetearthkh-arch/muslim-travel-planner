import { calculateQiblaBearing } from './qibla.js';
import type { CityData, ItineraryItem, PlannerPreferences } from './models.js';
import type { Language } from './i18n.js';
import { duplicateTravelDetails, emptyTravelDetails, validateTravelDetailsSnapshot, type TravelDetailsSnapshot } from './travel-details.js';

export const SAVED_TRIP_SCHEMA_VERSION = 1;
export const SAVED_TRIPS_STORAGE_KEY = 'mtp-saved-trips-v1';
const MAX_TRIP_NAME_LENGTH = 80;

export type SavedTrip = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  language: Language;
  preferences: PlannerPreferences;
  destination: {
    city: string;
    country: string;
    timezone: string;
    coordinates: { lat: number; lng: number };
  };
  itinerary: ItineraryItem[];
  travelDetails: TravelDetailsSnapshot;
  dateRange: { startDate: string; endDate: string };
  essentials: {
    localCurrencies: Array<{ code: string; symbol: string; name: string }>;
    qiblaBearingFromCityCenter: number;
    preferenceSummary: {
      groupSize: number;
      budget: PlannerPreferences['budget'];
      transportation: PlannerPreferences['transportation'];
      prayerMethod: PlannerPreferences['prayerMethod'];
      halalPreference: PlannerPreferences['halalPreference'];
    };
  };
  savedAt: string;
  sourceReferences?: string[];
};

type StoredCollection = {
  schemaVersion: number;
  trips: SavedTrip[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isString = (value: unknown): value is string => typeof value === 'string';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function sanitizeTripName(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TRIP_NAME_LENGTH);
}

export function defaultTripName(city: CityData, startDate: string, endDate: string) {
  const range = startDate === endDate ? startDate : `${startDate}–${endDate}`;
  return `${city.city} · ${range}`;
}

export function createSavedTripId(now = Date.now(), random = Math.random()) {
  return `trip-${now.toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableItinerarySnapshot(items: ItineraryItem[]) {
  return cloneJson(items).map((item) => {
    const snapshot = { ...item };
    return snapshot;
  });
}

export function createSavedTrip(input: {
  id?: string;
  name?: string;
  language: Language;
  preferences: PlannerPreferences;
  city: CityData;
  itinerary: ItineraryItem[];
  travelDetails?: TravelDetailsSnapshot;
  now?: string;
}): SavedTrip {
  const now = input.now ?? new Date().toISOString();
  const cleanName = sanitizeTripName(input.name ?? '') || defaultTripName(input.city, input.preferences.startDate, input.preferences.endDate);
  return {
    id: input.id ?? createSavedTripId(),
    name: cleanName,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SAVED_TRIP_SCHEMA_VERSION,
    language: input.language,
    preferences: cloneJson(input.preferences),
    destination: {
      city: input.city.city,
      country: input.city.country,
      timezone: input.city.timezone,
      coordinates: { ...input.city.coordinates },
    },
    itinerary: stableItinerarySnapshot(input.itinerary),
    travelDetails: validateTravelDetailsSnapshot(input.travelDetails ?? emptyTravelDetails()),
    dateRange: { startDate: input.preferences.startDate, endDate: input.preferences.endDate },
    essentials: {
      localCurrencies: input.city.money.localCurrencies.map((currency) => ({ code: currency.code, symbol: currency.symbol, name: currency.name })),
      qiblaBearingFromCityCenter: Number(calculateQiblaBearing(input.city.coordinates.lat, input.city.coordinates.lng).toFixed(2)),
      preferenceSummary: {
        groupSize: input.preferences.groupSize,
        budget: input.preferences.budget,
        transportation: input.preferences.transportation,
        prayerMethod: input.preferences.prayerMethod,
        halalPreference: input.preferences.halalPreference,
      },
    },
    savedAt: now,
  };
}

export function validateSavedTrip(value: unknown): SavedTrip | null {
  if (!isRecord(value) || value.schemaVersion !== SAVED_TRIP_SCHEMA_VERSION) return null;
  if (!isString(value.id) || !isString(value.name) || !isString(value.createdAt) || !isString(value.updatedAt) || !isString(value.savedAt)) return null;
  if (!['en', 'ar', 'id'].includes(String(value.language))) return null;
  if (!isRecord(value.preferences) || !isRecord(value.destination) || !Array.isArray(value.itinerary) || !isRecord(value.dateRange) || !isRecord(value.essentials)) return null;
  const destination = value.destination;
  if (!isString(destination.city) || !isString(destination.country) || !isString(destination.timezone) || !isRecord(destination.coordinates)) return null;
  if (!isFiniteNumber(destination.coordinates.lat) || !isFiniteNumber(destination.coordinates.lng)) return null;
  if (!isString(value.dateRange.startDate) || !isString(value.dateRange.endDate)) return null;
  if (!Array.isArray(value.essentials.localCurrencies) || !isFiniteNumber(value.essentials.qiblaBearingFromCityCenter)) return null;
  return { ...(value as SavedTrip), travelDetails: validateTravelDetailsSnapshot(value.travelDetails) };
}

export function parseSavedTrips(raw: string | null) {
  if (!raw) return { trips: [] as SavedTrip[], corrupted: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== SAVED_TRIP_SCHEMA_VERSION || !Array.isArray(parsed.trips)) return { trips: [] as SavedTrip[], corrupted: true };
    return { trips: parsed.trips.map(validateSavedTrip).filter((trip): trip is SavedTrip => Boolean(trip)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), corrupted: false };
  } catch {
    return { trips: [] as SavedTrip[], corrupted: true };
  }
}

function collection(trips: SavedTrip[]): StoredCollection {
  return { schemaVersion: SAVED_TRIP_SCHEMA_VERSION, trips: trips.map((trip) => cloneJson(trip)) };
}

export class SavedTripRepository {
  constructor(private readonly storage: Storage, private readonly key = SAVED_TRIPS_STORAGE_KEY) {}

  read() {
    return parseSavedTrips(this.storage.getItem(this.key));
  }

  replaceAll(trips: SavedTrip[]) {
    const next = collection(trips);
    if (!Array.isArray(next.trips) || next.trips.some((trip) => !validateSavedTrip(trip))) throw new Error('Invalid saved trips');
    this.storage.setItem(this.key, JSON.stringify(next));
    return next.trips.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  upsert(trip: SavedTrip) {
    const existing = this.read().trips;
    const index = existing.findIndex((candidate) => candidate.id === trip.id);
    const next = index >= 0 ? existing.map((candidate) => candidate.id === trip.id ? trip : candidate) : [trip, ...existing];
    return this.replaceAll(next);
  }

  delete(id: string) {
    return this.replaceAll(this.read().trips.filter((trip) => trip.id !== id));
  }
}

export function duplicateSavedTrip(trip: SavedTrip, now = new Date().toISOString()) {
  return { ...cloneJson(trip), id: createSavedTripId(), name: sanitizeTripName(`${trip.name} copy`), travelDetails: duplicateTravelDetails(validateTravelDetailsSnapshot(trip.travelDetails), now), createdAt: now, updatedAt: now, savedAt: now };
}
