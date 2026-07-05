import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRAYER_OVERPASS_ENDPOINTS,
  RequestError,
  isPrayerOverpassRequest,
  normalizePrayerOverpassBody,
  prayerOverpassEndpoints,
  requestJson,
} from './http.js';

const prayerQuery = `[out:json][timeout:25];(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:10000,31.778,35.235);
  node["amenity"="prayer_room"](around:10000,31.778,35.235);
  node["name"~"Masjid[ -]?(?:al[- ]?)?Aqsa",i](around:10000,31.778,35.235);
  relation["name:en"~"Masjid[ -]?(?:al[- ]?)?Aqsa",i](around:10000,31.778,35.235);
);out center tags;`;

function responseJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function withMockFetch<T>(mock: typeof fetch, operation: () => Promise<T>) {
  const previous = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await operation();
  } finally {
    globalThis.fetch = previous;
  }
}

async function expectRequestError(promise: Promise<unknown>, expectedStatus: number) {
  let received: unknown;
  try {
    await promise;
  } catch (error) {
    received = error;
  }
  assert.equal(received instanceof RequestError, true);
  if (received instanceof RequestError) assert.equal(received.status, expectedStatus);
}

test('Al-Aqsa prayer query is converted to portable Overpass syntax everywhere', () => {
  const normalized = normalizePrayerOverpassBody(prayerQuery);
  assert.equal(normalized.includes('(?:'), false);
  assert.equal(normalized.split('Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa').length - 1, 2);
});

test('unknown unsupported Overpass regular expressions fail before any request', async () => {
  let calls = 0;
  await withMockFetch((async () => {
    calls += 1;
    return responseJson({ elements: [] });
  }) as typeof fetch, async () => {
    const invalid = prayerQuery.replaceAll('Masjid[ -]?(?:al[- ]?)?Aqsa', 'Name(?:One|Two)');
    await expectRequestError(
      requestJson('https://overpass-api.de/api/interpreter', { method: 'POST', body: invalid }, 1000),
      400,
    );
  });
  assert.equal(calls, 0);
});

test('prayer request detection does not intercept unrelated Overpass requests', () => {
  assert.equal(isPrayerOverpassRequest('https://overpass-api.de/api/interpreter', { method: 'POST', body: prayerQuery }), true);
  assert.equal(isPrayerOverpassRequest('https://overpass-api.de/api/interpreter', { method: 'POST', body: '[out:json];node["amenity"="toilets"];out;' }), false);
  assert.equal(isPrayerOverpassRequest('https://example.com/search', { method: 'POST', body: prayerQuery }), false);
});

test('prayer endpoint list removes duplicates and rejects unsafe custom endpoints', () => {
  assert.deepEqual(prayerOverpassEndpoints(PRAYER_OVERPASS_ENDPOINTS[0]), [...PRAYER_OVERPASS_ENDPOINTS]);
  assert.deepEqual(prayerOverpassEndpoints('http://unsafe.example/interpreter'), [...PRAYER_OVERPASS_ENDPOINTS]);
});

test('prayer search form-encodes the fixed query and fails over after provider outage', async () => {
  const calls: Array<{ url: string; body: string; contentType: string | null }> = [];
  await withMockFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: requestUrl(input),
      body: typeof init?.body === 'string' ? init.body : '',
      contentType: headers.get('Content-Type'),
    });
    if (calls.length === 1) return responseJson({ error: 'busy' }, 503);
    return responseJson({ elements: [{ type: 'node', id: 1, lat: 31.778, lon: 35.235, tags: {} }] });
  }) as typeof fetch, async () => {
    const result = await requestJson<{ elements: Array<{ id: number }> }>(
      PRAYER_OVERPASS_ENDPOINTS[0],
      { method: 'POST', body: prayerQuery },
      1000,
    );
    assert.equal(result.elements[0]?.id, 1);
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, PRAYER_OVERPASS_ENDPOINTS[0]);
  assert.equal(calls[1]?.url, PRAYER_OVERPASS_ENDPOINTS[1]);
  assert.equal(calls[0]?.contentType, 'application/x-www-form-urlencoded;charset=UTF-8');
  const submittedQuery = new URLSearchParams(calls[0]?.body).get('data') ?? '';
  assert.equal(submittedQuery.includes('(?:'), false);
  assert.equal(submittedQuery.includes('Masjid[ -]?Al[- ]?Aqsa'), true);
});

test('HTTP 400 stops prayer failover so invalid app queries are not hidden', async () => {
  let calls = 0;
  await withMockFetch((async () => {
    calls += 1;
    return new Response('Bad request', { status: 400 });
  }) as typeof fetch, async () => {
    await expectRequestError(
      requestJson(PRAYER_OVERPASS_ENDPOINTS[0], { method: 'POST', body: prayerQuery }, 1000),
      400,
    );
  });
  assert.equal(calls, 1);
});

test('manual destination search falls back when Nominatim is unavailable', async () => {
  const calls: string[] = [];
  await withMockFetch((async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    calls.push(url);
    if (url.includes('nominatim.openstreetmap.org')) return responseJson({ error: 'busy' }, 503);
    return responseJson({
      results: [{
        name: 'Paris',
        admin1: 'Île-de-France',
        country: 'France',
        latitude: 48.8566,
        longitude: 2.3522,
      }],
    });
  }) as typeof fetch, async () => {
    const result = await requestJson<Array<{ lat: string; lon: string; display_name: string; address: { city: string; country: string } }>>(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=en&q=Paris',
      { headers: { Accept: 'application/json' } },
      1000,
    );
    assert.equal(result[0]?.lat, '48.8566');
    assert.equal(result[0]?.lon, '2.3522');
    assert.equal(result[0]?.display_name, 'Paris, Île-de-France, France');
    assert.equal(result[0]?.address.city, 'Paris');
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.startsWith('https://geocoding-api.open-meteo.com/v1/search'), true);
});

test('an empty primary geocoding response also uses the fallback provider', async () => {
  let calls = 0;
  await withMockFetch((async () => {
    calls += 1;
    return calls === 1 ? responseJson([]) : responseJson({ results: [] });
  }) as typeof fetch, async () => {
    const result = await requestJson<unknown[]>(
      'https://nominatim.openstreetmap.org/search?format=json&q=Unknown',
      {},
      1000,
    );
    assert.deepEqual(result, []);
  });
  assert.equal(calls, 2);
});

test('ordinary JSON requests keep the original single-provider behavior', async () => {
  let calls = 0;
  await withMockFetch((async () => {
    calls += 1;
    return responseJson({ ok: true });
  }) as typeof fetch, async () => {
    const result = await requestJson<{ ok: boolean }>('https://example.com/data.json');
    assert.equal(result.ok, true);
  });
  assert.equal(calls, 1);
});
