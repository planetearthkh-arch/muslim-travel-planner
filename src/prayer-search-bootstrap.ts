import { JERUSALEM_PRAYER_SNAPSHOT } from './generated/jerusalem-prayer-snapshot.js';
import {
  isFinalPrayerProvider,
  isPrayerOverpassQuery,
  isRetryablePrayerFailure,
  prayerFallbackPayload,
  prayerJsonResponse,
  prayerQueryFromBody,
  validPrayerPayload,
  writePrayerSearchCache,
} from './prayer-search-fallback.js';
import { getSafeStorage } from './safe-storage.js';

const globalState = globalThis as typeof globalThis & { __safarOnePrayerFetchInstalled?: boolean };

if (!globalState.__safarOnePrayerFetchInstalled) {
  globalState.__safarOnePrayerFetchInstalled = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const storage = getSafeStorage();

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const query = prayerQueryFromBody(init?.body);
    if (!isPrayerOverpassQuery(query)) return originalFetch(input, init);

    const fallback = () => {
      const payload = prayerFallbackPayload(storage, query, JERUSALEM_PRAYER_SNAPSHOT);
      return payload ? prayerJsonResponse(payload) : undefined;
    };

    try {
      const response = await originalFetch(input, init);
      if (response.ok) {
        void response.clone().json().then((payload: unknown) => {
          if (validPrayerPayload(payload)) writePrayerSearchCache(storage, query, payload);
        }).catch(() => undefined);
        return response;
      }

      if (isFinalPrayerProvider(url) && isRetryablePrayerFailure(response.status)) return fallback() ?? response;
      return response;
    } catch (error) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (offline || isFinalPrayerProvider(url)) {
        const cached = fallback();
        if (cached) return cached;
      }
      throw error;
    }
  };
}
