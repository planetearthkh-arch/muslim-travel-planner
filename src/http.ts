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

const badAqsaPattern = 'Masjid[ -]?(?:al[- ]?)?Aqsa';
const goodAqsaPattern = 'Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa';

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

function bodyText(body: BodyInit | null | undefined) {
  return typeof body === 'string' ? body : '';
}

export function isPrayerOverpassRequest(url: string, options: RequestInit = {}) {
  if ((options.method ?? 'GET').toUpperCase() !== 'POST') return false;
  const body = bodyText(options.body);
  if (!body.includes('place_of_worship') || !body.includes('prayer_room')) return false;
  try {
    return /(?:\/api)?\/interpreter\/?$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function normalizePrayerOverpassBody(body: string) {
  const normalized = body.split(badAqsaPattern).join(goodAqsaPattern);
  if (normalized.includes('(?:')) throw new RequestError('http', 'Unsupported Overpass regular expression', 400);
  return normalized;
}

export function prayerOverpassEndpoints(primary: string) {
  const endpoints: string[] = [];
  for (const value of [primary, ...PRAYER_OVERPASS_ENDPOINTS]) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') continue;
      const normalized = url.toString();
      if (!endpoints.includes(normalized)) endpoints.push(normalized);
    } catch {
      // Ignore invalid custom endpoints.
    }
  }
  return endpoints;
}

function prayerOptions(options: RequestInit) {
  const query = normalizePrayerOverpassBody(bodyText(options.body));
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
  return { ...options, body: `data=${encodeURIComponent(query)}`, headers } satisfies RequestInit;
}

async function requestPrayerJson<T>(url: string, options: RequestInit, milliseconds: number): Promise<T> {
  const endpoints = prayerOverpassEndpoints(url);
  const timeout = Math.max(10_000, Math.ceil(milliseconds / Math.max(1, endpoints.length)));
  let lastError: RequestError | undefined;
  for (const endpoint of endpoints) {
    try {
      return await requestJsonOnce<T>(endpoint, prayerOptions(options), timeout);
    } catch (error) {
      const classified = classifyRequestError(error);
      if (classified.kind === 'aborted' || classified.kind === 'offline') throw classified;
      if (classified.kind === 'http' && classified.status && classified.status < 500 && classified.status !== 429) throw classified;
      lastError = classified;
    }
  }
  throw lastError ?? new RequestError('temporary', 'Map data services are unavailable');
}

function isDestinationSearch(url: string, options: RequestInit) {
  if ((options.method ?? 'GET').toUpperCase() !== 'GET') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'nominatim.openstreetmap.org' && parsed.pathname.replace(/\/+$/, '') === '/search';
  } catch {
    return false;
  }
}

function destinationFallbackUrl(primaryUrl: string) {
  const query = new URL(primaryUrl).searchParams.get('q')?.trim();
  if (!query) return '';
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  return url.toString();
}

function destinationFallbackResult(payload: unknown) {
  if (!payload || typeof payload !== 'object') return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results) || !results.length || !results[0] || typeof results[0] !== 'object') return [];
  const item = results[0] as Record<string, unknown>;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const city = typeof item.name === 'string' ? item.name : '';
  const state = typeof item.admin1 === 'string' ? item.admin1 : '';
  const country = typeof item.country === 'string' ? item.country : '';
  const displayName = [city, state, country].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
  return [{ lat: String(latitude), lon: String(longitude), display_name: displayName || `${latitude}, ${longitude}`, address: { city, state, country } }];
}

async function requestDestinationJson<T>(url: string, options: RequestInit, milliseconds: number): Promise<T> {
  let primary: unknown = [];
  let primaryError: RequestError | undefined;
  try {
    primary = await requestJsonOnce<unknown>(url, options, milliseconds);
    if (!Array.isArray(primary)) throw new RequestError('malformed', 'Received invalid geocoding data');
    if (primary.length) return primary as T;
  } catch (error) {
    const classified = classifyRequestError(error);
    if (classified.kind === 'aborted' || classified.kind === 'offline') throw classified;
    primaryError = classified;
  }

  const fallbackUrl = destinationFallbackUrl(url);
  if (!fallbackUrl) {
    if (primaryError) throw primaryError;
    return primary as T;
  }

  try {
    const fallback = await requestJsonOnce<unknown>(fallbackUrl, { headers: { Accept: 'application/json' }, signal: options.signal }, milliseconds);
    const normalized = destinationFallbackResult(fallback);
    if (normalized.length || primaryError) return normalized as T;
    return primary as T;
  } catch {
    if (primaryError) throw primaryError;
    return primary as T;
  }
}

export async function requestJson<T>(url: string, options: RequestInit = {}, milliseconds = 14_000): Promise<T> {
  if (isPrayerOverpassRequest(url, options)) return requestPrayerJson<T>(url, options, milliseconds);
  if (isDestinationSearch(url, options)) return requestDestinationJson<T>(url, options, milliseconds);
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
