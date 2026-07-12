import { JERUSALEM_PRAYER_SNAPSHOT } from './generated/jerusalem-prayer-snapshot.js';
import {
  isFinalPrayerProvider,
  isPrayerOverpassQuery,
  isRetryablePrayerFailure,
  prayerFallbackPayload,
  prayerJsonResponse,
  prayerQueryFromBody,
  writePrayerSearchCache,
} from './prayer-search-fallback.js';
import { sanitizePrayerPayload } from './prayer-payload-sanitizer.js';
import { getSafeStorage } from './safe-storage.js';

const globalState = globalThis as typeof globalThis & { __safarOnePrayerFetchInstalled?: boolean };

function livePrayerJsonResponse(payload: { elements: unknown[] }, response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-SafarMate-Prayer-Source', 'live-sanitized');
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

if (!globalState.__safarOnePrayerFetchInstalled) {
  globalState.__safarOnePrayerFetchInstalled = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const storage = getSafeStorage();

  const sanitizeLiveResponse = async (query: string, response: Response) => {
    if (!response.ok) return response;
    try {
      const payload = sanitizePrayerPayload(await response.clone().json());
      if (!payload) return response;
      if (payload.elements.length) writePrayerSearchCache(storage, query, payload);
      return livePrayerJsonResponse(payload, response);
    } catch {
      return response;
    }
  };

  const sanitizedFallback = (query: string) => {
    return sanitizePrayerPayload(prayerFallbackPayload(storage, query, JERUSALEM_PRAYER_SNAPSHOT));
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const query = prayerQueryFromBody(init?.body);
    if (!isPrayerOverpassQuery(query)) return originalFetch(input, init);

    const fallbackPayload = sanitizedFallback(query);
    if (fallbackPayload?.elements.length) {
      void originalFetch(input, init).then((response) => sanitizeLiveResponse(query, response)).catch(() => undefined);
      return prayerJsonResponse(fallbackPayload);
    }

    try {
      const response = await originalFetch(input, init);
      if (response.ok) return sanitizeLiveResponse(query, response);

      if (isFinalPrayerProvider(url) && isRetryablePrayerFailure(response.status)) {
        const payload = sanitizedFallback(query);
        return payload?.elements.length ? prayerJsonResponse(payload) : response;
      }
      return response;
    } catch (error) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (offline || isFinalPrayerProvider(url)) {
        const payload = sanitizedFallback(query);
        if (payload?.elements.length) return prayerJsonResponse(payload);
      }
      throw error;
    }
  };
}
