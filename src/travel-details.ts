import { safeExternalUrl } from './urls.js';

export const TRAVEL_DETAILS_VERSION = 1;
const MAX_TEXT = 180;
const MAX_NOTE = 1000;
const DEFAULT_RESERVATION_DURATION_MINUTES = 60;

export type TravelDetailType = 'flight' | 'accommodation' | 'reservation' | 'contact';

type BaseTravelDetail = {
  id: string;
  type: TravelDetailType;
  createdAt: string;
  updatedAt: string;
};

export type FlightDetail = BaseTravelDetail & {
  type: 'flight';
  airline?: string;
  flightNumber?: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDateTime: string;
  arrivalDateTime: string;
  departureTimeZone?: string;
  arrivalTimeZone?: string;
  bookingReference?: string;
  notes?: string;
};

export type AccommodationDetail = BaseTravelDetail & {
  type: 'accommodation';
  propertyName: string;
  address?: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  timeZone?: string;
  phone?: string;
  bookingReference?: string;
  notes?: string;
};

export type ReservationDetail = BaseTravelDetail & {
  type: 'reservation';
  title: string;
  provider?: string;
  startDateTime: string;
  endDateTime?: string;
  timeZone?: string;
  meetingPoint?: string;
  phone?: string;
  bookingReference?: string;
  notes?: string;
};

export type ProviderContactDetail = BaseTravelDetail & {
  type: 'contact';
  name: string;
  role?: string;
  phone?: string;
  website?: string;
  notes?: string;
};

export type TravelDetailEntry = FlightDetail | AccommodationDetail | ReservationDetail | ProviderContactDetail;

export type TravelDetailsSnapshot = {
  version: number;
  entries: TravelDetailEntry[];
};

export type TravelDetailInput = Partial<Record<string, string>> & { type: TravelDetailType; id?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isString = (value: unknown): value is string => typeof value === 'string';

export function createTravelDetailId(now = Date.now(), random = Math.random()) {
  return `detail-${now.toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`;
}

export function normalizeTravelText(value: unknown, max = MAX_TEXT) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function isValidTimeZone(value = '') {
  if (!value) return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date('2026-01-01T00:00:00Z'));
    return true;
  } catch {
    return false;
  }
}

function validDateTime(value = '') {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
}

function ordered(start: string, end?: string) {
  if (!end) return true;
  if (!validDateTime(start) || !validDateTime(end)) return false;
  return new Date(end).getTime() > new Date(start).getTime();
}

function base(input: TravelDetailInput, now: string) {
  const cleanId = normalizeTravelText(input.id, 80);
  return {
    id: cleanId || createTravelDetailId(),
    createdAt: normalizeTravelText(input.createdAt) || now,
    updatedAt: now,
  };
}

export function validateTravelDetailInput(input: TravelDetailInput, defaultTimeZone = 'UTC', now = new Date().toISOString()): { ok: true; entry: TravelDetailEntry } | { ok: false; error: 'required' | 'date' | 'range' | 'timezone' | 'website' } {
  const timeZone = (value?: string) => normalizeTravelText(value || defaultTimeZone, 80);
  const note = (value?: string) => normalizeTravelText(value, MAX_NOTE);
  if (input.type === 'flight') {
    const departureAirport = normalizeTravelText(input.departureAirport);
    const arrivalAirport = normalizeTravelText(input.arrivalAirport);
    const departureDateTime = normalizeTravelText(input.departureDateTime, 32);
    const arrivalDateTime = normalizeTravelText(input.arrivalDateTime, 32);
    const departureTimeZone = timeZone(input.departureTimeZone);
    const arrivalTimeZone = timeZone(input.arrivalTimeZone);
    if (!departureAirport || !arrivalAirport) return { ok: false, error: 'required' };
    if (!validDateTime(departureDateTime) || !validDateTime(arrivalDateTime)) return { ok: false, error: 'date' };
    if (!ordered(departureDateTime, arrivalDateTime)) return { ok: false, error: 'range' };
    if (!isValidTimeZone(departureTimeZone) || !isValidTimeZone(arrivalTimeZone)) return { ok: false, error: 'timezone' };
    return { ok: true, entry: { ...base(input, now), type: 'flight', airline: normalizeTravelText(input.airline), flightNumber: normalizeTravelText(input.flightNumber), departureAirport, arrivalAirport, departureDateTime, arrivalDateTime, departureTimeZone, arrivalTimeZone, bookingReference: normalizeTravelText(input.bookingReference), notes: note(input.notes) } };
  }
  if (input.type === 'accommodation') {
    const propertyName = normalizeTravelText(input.propertyName);
    const checkInDateTime = normalizeTravelText(input.checkInDateTime, 32);
    const checkOutDateTime = normalizeTravelText(input.checkOutDateTime, 32);
    const tz = timeZone(input.timeZone);
    if (!propertyName) return { ok: false, error: 'required' };
    if (!validDateTime(checkInDateTime) || !validDateTime(checkOutDateTime)) return { ok: false, error: 'date' };
    if (!ordered(checkInDateTime, checkOutDateTime)) return { ok: false, error: 'range' };
    if (!isValidTimeZone(tz)) return { ok: false, error: 'timezone' };
    return { ok: true, entry: { ...base(input, now), type: 'accommodation', propertyName, address: normalizeTravelText(input.address), checkInDateTime, checkOutDateTime, timeZone: tz, phone: normalizeTravelText(input.phone), bookingReference: normalizeTravelText(input.bookingReference), notes: note(input.notes) } };
  }
  if (input.type === 'reservation') {
    const title = normalizeTravelText(input.title);
    const startDateTime = normalizeTravelText(input.startDateTime, 32);
    const endDateTime = normalizeTravelText(input.endDateTime, 32);
    const tz = timeZone(input.timeZone);
    if (!title) return { ok: false, error: 'required' };
    if (!validDateTime(startDateTime) || endDateTime && !validDateTime(endDateTime)) return { ok: false, error: 'date' };
    if (!ordered(startDateTime, endDateTime || undefined)) return { ok: false, error: 'range' };
    if (!isValidTimeZone(tz)) return { ok: false, error: 'timezone' };
    return { ok: true, entry: { ...base(input, now), type: 'reservation', title, provider: normalizeTravelText(input.provider), startDateTime, endDateTime, timeZone: tz, meetingPoint: normalizeTravelText(input.meetingPoint), phone: normalizeTravelText(input.phone), bookingReference: normalizeTravelText(input.bookingReference), notes: note(input.notes) } };
  }
  const name = normalizeTravelText(input.name);
  const website = normalizeTravelText(input.website, 240);
  const safeWebsite = website ? safeExternalUrl(website) : '';
  if (!name) return { ok: false, error: 'required' };
  if (website && !safeWebsite) return { ok: false, error: 'website' };
  return { ok: true, entry: { ...base(input, now), type: 'contact', name, role: normalizeTravelText(input.role), phone: normalizeTravelText(input.phone), website: safeWebsite, notes: note(input.notes) } };
}

export function emptyTravelDetails(): TravelDetailsSnapshot {
  return { version: TRAVEL_DETAILS_VERSION, entries: [] };
}

export function validateTravelDetailsSnapshot(value: unknown): TravelDetailsSnapshot {
  if (!isRecord(value) || value.version !== TRAVEL_DETAILS_VERSION || !Array.isArray(value.entries)) return emptyTravelDetails();
  const entries = value.entries
    .map((entry) => {
      if (!isRecord(entry) || !isString(entry.type)) return null;
      const result = validateTravelDetailInput(entry as TravelDetailInput, 'UTC', isString(entry.updatedAt) ? entry.updatedAt : undefined);
      return result.ok ? result.entry : null;
    })
    .filter((entry): entry is TravelDetailEntry => Boolean(entry));
  return { version: TRAVEL_DETAILS_VERSION, entries: sortTravelDetails(entries) };
}

function startValue(entry: TravelDetailEntry) {
  if (entry.type === 'flight') return entry.departureDateTime;
  if (entry.type === 'accommodation') return entry.checkInDateTime;
  if (entry.type === 'reservation') return entry.startDateTime;
  return '9999-12-31T23:59';
}

export function sortTravelDetails(entries: TravelDetailEntry[]) {
  return [...entries].sort((a, b) => startValue(a).localeCompare(startValue(b)) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

export function duplicateTravelDetails(snapshot: TravelDetailsSnapshot, now = new Date().toISOString()): TravelDetailsSnapshot {
  return { version: TRAVEL_DETAILS_VERSION, entries: sortTravelDetails(snapshot.entries.map((entry) => ({ ...entry, id: createTravelDetailId(), createdAt: now, updatedAt: now }))) };
}

export function upsertTravelDetail(snapshot: TravelDetailsSnapshot, entry: TravelDetailEntry) {
  const entries = snapshot.entries.some((candidate) => candidate.id === entry.id) ? snapshot.entries.map((candidate) => candidate.id === entry.id ? entry : candidate) : [...snapshot.entries, entry];
  return { version: TRAVEL_DETAILS_VERSION, entries: sortTravelDetails(entries) };
}

export function deleteTravelDetail(snapshot: TravelDetailsSnapshot, id: string) {
  return { version: TRAVEL_DETAILS_VERSION, entries: snapshot.entries.filter((entry) => entry.id !== id) };
}

export function travelDetailPrimaryDate(entry: TravelDetailEntry) {
  return startValue(entry);
}

export function travelDetailEndDate(entry: TravelDetailEntry) {
  if (entry.type === 'flight') return entry.arrivalDateTime;
  if (entry.type === 'accommodation') return entry.checkOutDateTime;
  if (entry.type === 'reservation') return entry.endDateTime || addMinutesToLocal(entry.startDateTime, DEFAULT_RESERVATION_DURATION_MINUTES);
  return '';
}

export function travelDetailTimeZone(entry: TravelDetailEntry, fallback: string) {
  if (entry.type === 'flight') return entry.departureTimeZone || fallback;
  if (entry.type === 'accommodation') return entry.timeZone || fallback;
  if (entry.type === 'reservation') return entry.timeZone || fallback;
  return fallback;
}

export function addMinutesToLocal(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
