import type { OverpassElement } from './prayer-spaces.js';

export type PrayerSearchSnapshot = {
  generatedAt: string;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  elements: OverpassElement[];
};

export type PrayerSearchPayload = { elements: OverpassElement[] };

type StoredPrayerSearch = {
  version: 2;
  savedAt: string;
  payload: PrayerSearchPayload;
};

const CACHE_PREFIX = 'mtp-prayer-search-v2:';
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

const toRadians = (value: number) => value * Math.PI / 180;

function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function prayerQueryFromBody(body: BodyInit | null | undefined) {
  if (typeof body !== 'string') return '';
  if (!body.startsWith('data=')) return body;
  return new URLSearchParams(body).get('data') ?? '';
}

export function isPrayerOverpassQuery(query: string) {
  return query.includes('place_of_worship') && query.includes('prayer_room') && query.includes('[out:json]');
}

export function prayerSearchCacheKey(query: string) {
  return `${CACHE_PREFIX}${hashText(query.replace(/\s+/g, ' ').trim())}`;
}

function validElement(value: unknown): value is OverpassElement {
  if (!value || typeof value !== 'object') return false;
  const element = value as Partial<OverpassElement>;
  return typeof element.type === 'string' && typeof element.id === 'number';
}

export function validPrayerPayload(value: unknown): value is PrayerSearchPayload {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as PrayerSearchPayload).elements) && (value as PrayerSearchPayload).elements.every(validElement));
}

export function readPrayerSearchCache(storage: Storage, query: string): PrayerSearchPayload | undefined {
  try {
    const raw = storage.getItem(prayerSearchCacheKey(query));
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Partial<StoredPrayerSearch>;
    if (stored.version !== 2 || !validPrayerPayload(stored.payload)) return undefined;
    return stored.payload;
  } catch {
    return undefined;
  }
}

export function writePrayerSearchCache(storage: Storage, query: string, payload: PrayerSearchPayload, now = new Date()) {
  if (!validPrayerPayload(payload) || !payload.elements.length) return false;
  try {
    const stored: StoredPrayerSearch = { version: 2, savedAt: now.toISOString(), payload };
    storage.setItem(prayerSearchCacheKey(query), JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

function queryArea(query: string) {
  const match = query.match(/\(around:(\d+),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
  if (!match) return undefined;
  const radiusKm = Number(match[1]) / 1000;
  const latitude = Number(match[2]);
  const longitude = Number(match[3]);
  if (![radiusKm, latitude, longitude].every(Number.isFinite)) return undefined;
  return { radiusKm, latitude, longitude };
}

function elementCoordinates(element: OverpassElement) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : undefined;
}

export function snapshotPayloadForQuery(snapshot: PrayerSearchSnapshot, query: string): PrayerSearchPayload | undefined {
  if (!snapshot.elements.length) return undefined;
  const area = queryArea(query);
  if (!area) return undefined;
  const reachesSnapshot = distanceKm(area.latitude, area.longitude, snapshot.center.latitude, snapshot.center.longitude) <= area.radiusKm + snapshot.radiusKm;
  if (!reachesSnapshot) return undefined;
  const elements = snapshot.elements.filter((element) => {
    const coordinates = elementCoordinates(element);
    return coordinates && distanceKm(area.latitude, area.longitude, coordinates.latitude, coordinates.longitude) <= area.radiusKm + 0.25;
  });
  return elements.length ? { elements } : undefined;
}

export function prayerFallbackPayload(storage: Storage, query: string, snapshot: PrayerSearchSnapshot) {
  return readPrayerSearchCache(storage, query) ?? snapshotPayloadForQuery(snapshot, query);
}

export function isRetryablePrayerFailure(status: number) {
  return retryableStatuses.has(status);
}

export function isFinalPrayerProvider(url: string) {
  try {
    return new URL(url).hostname === 'maps.mail.ru';
  } catch {
    return false;
  }
}

export function prayerJsonResponse(payload: PrayerSearchPayload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-SafarOne-Prayer-Source': 'persistent-fallback',
    },
  });
}
