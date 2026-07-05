export type RequestFailureKind = 'timeout' | 'offline' | 'rate-limited' | 'temporary' | 'malformed' | 'aborted' | 'http' | 'unknown';

export class RequestError extends Error {
  kind: RequestFailureKind;
  status?: number;
  retryAfterMs?: number;

  constructor(kind: RequestFailureKind, message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export const PRAYER_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

const NOMINATIM_HOST = 'nominatim.openstreetmap.org';
const OPEN_METEO_GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

export function classifyHttpStatus(status: number): RequestFailureKind {
  if (status === 429) return 'rate-limited';
  if ([500, 502, 503, 504].includes(status)) return 'temporary';
  return 'http';
}

export function retryAfterMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 30) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const delay = date - Date.now();
    if (delay >= 0 && delay <= 30_000) return delay;
  }
  return undefined;
}

export function classifyRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new RequestError('aborted', 'Request was cancelled');
  if (error instanceof SyntaxError) return new RequestError('malformed', 'Received invalid service data');
  if (error instanceof TypeError) {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : undefined;
    return new RequestError(online === false ? 'offline' : 'unknown', 'Network request failed');
  }
  if (error instanceof Error && /timed out/i.test(error.message)) return new RequestError('timeout', error.message);
  return new RequestError('unknown', error instanceof Error ? error.message : 'Request failed');
}

function timeoutSignal(milliseconds: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(new RequestError('timeout', 'Request timed out')), milliseconds);
  const abort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    },
  };
}

async function requestJsonOnce<T>(url: string, options: RequestInit, milliseconds: number): Promise<T> {
  const { signal, cleanup } = timeoutSignal(milliseconds, options.signal ?? undefined);
  try {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) {
      const kind = classifyHttpStatus(response.status);
      throw new RequestError(kind, kind === 'rate-limited' ? 'Too many requests' : `HTTP ${response.status}`, response.status, retryAfterMs(response.headers.get('Retry-After')));
    }
    try {
      return await response.json() as T;
    } catch (error) {
      const classified = classifyRequestError(error);
      throw classified.kind === 'aborted' ? classified : new RequestError('malformed', 'Received invalid service data');
    }
  } catch (error) {
    const classified = classifyRequestError(error);
    if (classified.kind === 'aborted' && signal.reason instanceof RequestError && signal.reason.kind === 'timeout') throw signal.reason;
    throw classified;
  } finally {
    cleanup();
  }
}

function requestBodyText(body: BodyInit | null | undefined) {
  return typeof body === 'string' ? body : '';
}

export function isPrayerOverpassRequest(url: string, options: RequestInit = {}) {
  if ((options.method ?? 'GET').toUpperCase() !== 'POST') return false;
  const body = requestBodyText(options.body);
  if (!body.includes('place_of_worship') || !body.includes('prayer_room')) return false;
  try {
    const parsed = new URL(url);
    return /(?:\/api)?\/interpreter\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function normalizePrayerOverpassBody(body: string) {
  return body.replace(
    'Masjid[ -]?(?:al[- ]?)?Aqsa',
    'Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa',
  );
}

export function prayerOverpassEndpoints(primary: string) {
  const values = [primary, ...PRAYER_OVERPASS_ENDPOINTS];
  const result: string[] = [];
  for (const value of values) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) continue;
      const normalized = parsed.toString();
      if (!result.includes(normalized)) result.push(normalized);
    } catch {
      // Ignore invalid custom endpoints and keep the trusted fallbacks.
    }
  }
  return result;
}

function prayerOverpassOptions(options: RequestInit) {
  const query = normalizePrayerOverpassBody(requestBodyText(options.body));
  return {
    ...options,
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...options.headers,
    },
  } satisfies RequestInit;
}

async function requestPrayerOverpass<T>(url: string, options: RequestInit, milliseconds: number): Promise<T> {
  const endpoints = prayerOverpassEndpoints(url);
  const endpointTimeout = Math.max(15_000, Math.ceil(milliseconds / Math.max(1, endpoints.length)));
  let lastError: RequestError | undefined;

  for (const endpoint of endpoints) {
    try {
      return await requestJsonOnce<T>(endpoint, prayerOverpassOptions(options), endpointTimeout);
    } catch (error) {
      const classified = classifyRequestError(error);
      if (classified.kind === 'aborted' || classified.kind === 'offline') throw classified;
      if (classified.kind === 'http' && classified.status && classified.status < 500 && classified.status !== 429) throw classified;
      lastError = classified;
    }
  }

  throw lastError ?? new RequestError('temporary', 'Map data services are unavailable');
}

function isNominatimSearch(url: string, options: RequestInit) {
  if ((options.method ?? 'GET').toUpperCase() !== 'GET') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === NOMINATIM_HOST && parsed.pathname.replace(/\/+$/, '') === '/search';
  } catch {
    return false;
  }
}

function openMeteoGeocodingUrl(nominatimUrl: string) {
  const parsed = new URL(nominatimUrl);
  const query = parsed.searchParams.get('q')?.trim() ?? '';
  if (!query) return '';
  const fallback = new URL(OPEN_METEO_GEOCODING_ENDPOINT);
  fallback.searchParams.set('name', query);
  fallback.searchParams.set('count', '1');
  fallback.searchParams.set('language', 'en');
  fallback.searchParams.set('format', 'json');
  return fallback.toString();
}

function nominatimShapeFromOpenMeteo(payload: unknown) {
  if (!payload || typeof payload !== 'object') return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results) || !results.length) return [];
  const first = results[0];
  if (!first || typeof first !== 'object') return [];
  const item = first as Record<string, unknown>;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const city = typeof item.name === 'string' ? item.name : '';
  const state = typeof item.admin1 === 'string' ? item.admin1 : '';
  const country = typeof item.country === 'string' ? item.country : '';
  const displayName = [city, state, country].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
  return [{
    lat: String(latitude),
    lon: String(longitude),
    display_name: displayName || `${latitude}, ${longitude}`,
    address: { city, state, country },
  }];
}

async function requestNominatimWithFallback<T>(url: string, options: RequestInit, milliseconds: number): Promise<T> {
  let primaryError: RequestError | undefined;
  try {
    const primary = await requestJsonOnce<unknown>(url, options, milliseconds);
    if (Array.isArray(primary) && primary.length) return primary as T;
    const fallbackUrl = openMeteoGeocodingUrl(url);
    if (!fallbackUrl) return primary as T;
    try {
      const fallback = await requestJsonOnce<unknown>(fallbackUrl, { headers: { Accept: 'application/json' }, signal: options.signal }, milliseconds);
      return nominatimShapeFromOpenMeteo(fallback) as T;
    } catch {
      return primary as T;
    }
  } catch (error) {
    const classified = classifyRequestError(error);
    if (classified.kind === 'aborted' || classified.kind === 'offline') throw classified;
    primaryError = classified;
  }

  const fallbackUrl = openMeteoGeocodingUrl(url);
  if (!fallbackUrl) throw primaryError;
  try {
    const fallback = await requestJsonOnce<unknown>(fallbackUrl, { headers: { Accept: 'application/json' }, signal: options.signal }, milliseconds);
    return nominatimShapeFromOpenMeteo(fallback) as T;
  } catch (error) {
    throw classifyRequestError(error) ?? primaryError;
  }
}

export async function requestJson<T>(url: string, options: RequestInit = {}, milliseconds = 14_000): Promise<T> {
  if (isPrayerOverpassRequest(url, options)) return requestPrayerOverpass<T>(url, options, milliseconds);
  if (isNominatimSearch(url, options)) return requestNominatimWithFallback<T>(url, options, milliseconds);
  return requestJsonOnce<T>(url, options, milliseconds);
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  if (!milliseconds) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(classifyRequestError(signal.reason ?? new DOMException('cancelled', 'AbortError')));
  return new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      reject(classifyRequestError(signal?.reason ?? new DOMException('cancelled', 'AbortError')));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function retryOnceForTemporary<T>(operation: () => Promise<T>, signal?: AbortSignal) {
  try {
    return await operation();
  } catch (error) {
    const classified = classifyRequestError(error);
    if (!['temporary', 'rate-limited'].includes(classified.kind)) throw classified;
    await abortableDelay(classified.retryAfterMs ?? 0, signal);
    if (signal?.aborted) throw classifyRequestError(signal.reason ?? new DOMException('cancelled', 'AbortError'));
    return operation();
  }
}
