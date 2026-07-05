import assert from 'node:assert/strict';
import test from 'node:test';
import { RequestError } from './http.js';
import {
  NOMINATIM_SEARCH_ENDPOINT,
  OPEN_METEO_GEOCODING_ENDPOINT,
  geocodeDestinationWithFailover,
} from './destination-geocoding.js';

test('Nominatim result is used when available', async () => {
  const calls: string[] = [];
  const result = await geocodeDestinationWithFailover('Jerusalem', async (url, timeoutMilliseconds) => {
    calls.push(`${url}|${timeoutMilliseconds}`);
    return [{
      lat: '31.778',
      lon: '35.235',
      display_name: 'Jerusalem',
      address: { city: 'Jerusalem', country: 'Israel' },
    }];
  });

  assert.equal(result?.city, 'Jerusalem');
  assert.equal(result?.latitude, 31.778);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].startsWith(NOMINATIM_SEARCH_ENDPOINT), true);
});

test('Open-Meteo is used when the first geocoder is unavailable', async () => {
  const calls: string[] = [];
  const result = await geocodeDestinationWithFailover('Paris', async (url) => {
    calls.push(url);
    if (url.startsWith(NOMINATIM_SEARCH_ENDPOINT)) throw new RequestError('timeout', 'Request timed out');
    return {
      results: [{
        name: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        country: 'France',
        admin1: 'Île-de-France',
        timezone: 'Europe/Paris',
      }],
    };
  });

  assert.equal(result?.label, 'Paris, Île-de-France, France');
  assert.equal(result?.timezone, 'Europe/Paris');
  assert.deepEqual(calls.map((url) => url.split('?')[0]), [
    NOMINATIM_SEARCH_ENDPOINT,
    OPEN_METEO_GEOCODING_ENDPOINT,
  ]);
});

test('Open-Meteo is tried when Nominatim returns no match', async () => {
  const result = await geocodeDestinationWithFailover('Smallville', async (url) => {
    if (url.startsWith(NOMINATIM_SEARCH_ENDPOINT)) return [];
    return { results: [{ name: 'Smallville', latitude: 10, longitude: 20, country: 'Example' }] };
  });
  assert.equal(result?.city, 'Smallville');
});

test('offline and cancellation errors stop immediately', async () => {
  for (const kind of ['offline', 'aborted'] as const) {
    const calls: string[] = [];
    await assert.rejects(
      geocodeDestinationWithFailover('London', async (url) => {
        calls.push(url);
        throw new RequestError(kind, kind);
      }),
      (error: unknown) => error instanceof RequestError && error.kind === kind,
    );
    assert.equal(calls.length, 1);
  }
});

test('empty query does not call a provider', async () => {
  let called = false;
  const result = await geocodeDestinationWithFailover('   ', async () => {
    called = true;
    return [];
  });
  assert.equal(result, undefined);
  assert.equal(called, false);
});
