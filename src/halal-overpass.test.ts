import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestError } from './http.js';
import {
  HALAL_OVERPASS_ENDPOINTS,
  halalEndpointTimeout,
  halalOverpassEndpoints,
  requestHalalWithFailover,
} from './halal-overpass.js';

test('halal Overpass endpoints include a global fallback without duplicates', () => {
  assert.deepEqual(
    halalOverpassEndpoints(),
    [...HALAL_OVERPASS_ENDPOINTS],
  );

  assert.deepEqual(
    halalOverpassEndpoints(HALAL_OVERPASS_ENDPOINTS[0]),
    [...HALAL_OVERPASS_ENDPOINTS],
  );

  assert.deepEqual(
    halalOverpassEndpoints('https://custom.example/api/interpreter'),
    [
      'https://custom.example/api/interpreter',
      ...HALAL_OVERPASS_ENDPOINTS,
    ],
  );
});

test('halal endpoints receive enough time to return on mobile networks', () => {
  assert.equal(halalEndpointTimeout(30_000, 2), 15_000);
  assert.equal(halalEndpointTimeout(30_000, 3), 15_000);
});

test('halal request moves to the next service after a timeout', async () => {
  const calls: string[] = [];

  const result = await requestHalalWithFailover(
    'https://custom.example/api/interpreter',
    30_000,
    async (endpoint, timeoutMilliseconds) => {
      calls.push(`${endpoint}|${timeoutMilliseconds}`);

      if (endpoint.includes('custom.example')) {
        throw new RequestError('timeout', 'Request timed out');
      }

      return endpoint;
    },
  );

  assert.equal(result, HALAL_OVERPASS_ENDPOINTS[0]);
  assert.deepEqual(calls, [
    'https://custom.example/api/interpreter|15000',
    `${HALAL_OVERPASS_ENDPOINTS[0]}|15000`,
  ]);
});
