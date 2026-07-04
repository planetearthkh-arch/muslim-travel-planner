import { calculateQiblaBearing } from './qibla.js';
import type { CityData, ItineraryItem, Place, PlannerPreferences, VerificationStatus } from './models.js';
import type { Language } from './app-language.js';
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

const verificationStatuses = new Set<VerificationStatus>(['Sample', 'Unverified', 'Verified']);
const prayerMethods = new Set(['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return verificationStatuses.has(value as VerificationStatus);
}

function isPlace(value: unknown): value is Place {
  if (!isRecord(value)) return false;
  if (!isString(value.id) || !isString(value.name) || !isString(value.area) || !isString(value.description)) return false;
  if (!['attraction', 'mosque', 'prayer-space', 'restaurant'].includes(String(value.type))) return false;
  if (!isFiniteNumber(value.estimatedMinutes) || value.estimatedMinutes < 0 || !isStringArray(value.interests)) return false;
  if (typeof value.familyFriendly !== 'boolean' || typeof value.indoor !== 'boolean' || !isVerificationStatus(value.verification)) return false;
  if (value.budgetLevel !== undefined && !['low', 'mid', 'high'].includes(String(value.budgetLevel))) return false;
  if (value.facility !== undefined) {
    if (!isRecord(value.facility)) return false;
    if (!isVerificationStatus(value.facility.womenPrayerSpace) || !isVerificationStatus(value.facility.wudu) || !isVerificationStatus(value.facility.accessibility) || !isString(value.facility.notes)) return false;
  }
  return [value.halalSupport, value.evidence].every((entry) => entry === undefined || isString(entry));
}

function isPlannerPreferences(value: unknown): value is PlannerPreferences {
  if (!isRecord(value)) return false;
  return isString(value.city)
    && isString(value.startDate) && datePattern.test(value.startDate)
    && isString(value.endDate) && datePattern.test(value.endDate)
    && isString(value.startHour) && timePattern.test(value.startHour)
    && isString(value.endHour) && timePattern.test(value.endHour)
    && isStringArray(value.interests)
    && isFiniteNumber(value.groupSize) && value.groupSize >= 1
    && typeof value.children === 'boolean'
    && ['low', 'medium', 'high'].includes(String(value.walkingAbility))
    && ['walking', 'public transport', 'taxi'].includes(String(value.transportation))
    && ['low', 'mid', 'high'].includes(String(value.budget))
    && prayerMethods.has(String(value.prayerMethod))
    && ['mosque', 'quiet prayer space', 'flexible'].includes(String(value.prayerPreference))
    && typeof value.womenPrayerRequired === 'boolean'
    && typeof value.wuduRequired === 'boolean'
    && isString(value.accessibilityNeeds)
    && ['strictly labelled', 'vegetarian/seafood options', 'flexible'].includes(String(value.halalPreference));
}

function isItineraryItem(value: unknown): value is ItineraryItem {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.date) && datePattern.test(value.date)
    && isString(value.time) && /^(?:\d{1,2}:\d{2}|\d{1,2}:\d{2}\s*(?:AM|PM))$/i.test(value.time)
    && isString(value.title)
    && ['travel', 'attraction', 'prayer', 'meal', 'free-time'].includes(String(value.kind))
    && isFiniteNumber(value.durationMinutes) && value.durationMinutes >= 0
    && isString(value.details)
    && isVerificationStatus(value.status)
    && (value.place === undefined || isPlace(value.place));
}

function isLocalCurrency(value: unknown) {
  return isRecord(value) && isString(value.code) && isString(value.symbol) && isString(value.name);
}

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
  const language = ['en', 'ar', 'ur', 'id', 'ms', 'tr', 'fr'].includes(String(value.language)) ? value.language as Language : 'en';
  if (!isPlannerPreferences(value.preferences) || !isRecord(value.destination) || !Array.isArray(value.itinerary) || !value.itinerary.every(isItineraryItem) || !isRecord(value.dateRange) || !isRecord(value.essentials)) return null;
  const destination = value.destination;
  if (!isString(destination.city) || !isString(destination.country) || !isString(destination.timezone) || !isRecord(destination.coordinates)) return null;
  if (!isFiniteNumber(destination.coordinates.lat) || destination.coordinates.lat < -90 || destination.coordinates.lat > 90 || !isFiniteNumber(destination.coordinates.lng) || destination.coordinates.lng < -180 || destination.coordinates.lng > 180) return null;
  if (!isString(value.dateRange.startDate) || !datePattern.test(value.dateRange.startDate) || !isString(value.dateRange.endDate) || !datePattern.test(value.dateRange.endDate)) return null;
  if (value.dateRange.startDate !== value.preferences.startDate || value.dateRange.endDate !== value.preferences.endDate) return null;
  if (!Array.isArray(value.essentials.localCurrencies) || !value.essentials.localCurrencies.every(isLocalCurrency) || !isFiniteNumber(value.essentials.qiblaBearingFromCityCenter)) return null;
  if (!isRecord(value.essentials.preferenceSummary)) return null;
  const summary = value.essentials.preferenceSummary;
  if (!isFiniteNumber(summary.groupSize) || !['low', 'mid', 'high'].includes(String(summary.budget)) || !['walking', 'public transport', 'taxi'].includes(String(summary.transportation)) || !prayerMethods.has(String(summary.prayerMethod)) || !['strictly labelled', 'vegetarian/seafood options', 'flexible'].includes(String(summary.halalPreference))) return null;
  return {
    ...(value as SavedTrip),
    name: sanitizeTripName(value.name) || 'Saved trip',
    language,
    preferences: value.preferences,
    itinerary: value.itinerary,
    travelDetails: validateTravelDetailsSnapshot(value.travelDetails),
  };
}

export function parseSavedTrips(raw: string | null) {
  if (!raw) return { trips: [] as SavedTrip[], corrupted: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== SAVED_TRIP_SCHEMA_VERSION || !Array.isArray(parsed.trips)) return { trips: [] as SavedTrip[], corrupted: true };
    const validated = parsed.trips.map(validateSavedTrip);
    const trips = validated.filter((trip): trip is SavedTrip => Boolean(trip)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { trips, corrupted: trips.length !== parsed.trips.length };
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
  const suffix: Record<string, string> = { en: 'copy', ar: 'نسخة', ur: 'نقل', id: 'salinan', ms: 'salinan', tr: 'kopya', fr: 'copie' };
  const language = String(trip.language);
  return { ...cloneJson(trip), id: createSavedTripId(), name: sanitizeTripName(`${trip.name} ${suffix[language] ?? suffix.en}`), travelDetails: duplicateTravelDetails(validateTravelDetailsSnapshot(trip.travelDetails), now), createdAt: now, updatedAt: now, savedAt: now };
}
