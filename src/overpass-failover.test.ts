import assert from 'node:assert/strict';
import test from 'node:test';
import { RequestError } from './http.js';
import { resetServiceHealthForTests } from './provider-health.js';
import {
  OVERPASS_ENDPOINTS,
  overpassEndpointTimeout,
  overpassEndpoints,
  overpassFormBody,
  overpassRequestHeaders,
  requestOverpassWithFailover,
} from './overpass-failover.js';

test.beforeEach(() => resetServiceHealthForTests());

test('Overpass endpoint list is unique and supports a custom primary', () => {
  assert.deepEqual(overpassEndpoints(), [...OVERPASS_ENDPOINTS]);
  assert.deepEqual(overpassEndpoints(OVERPASS_ENDPOINTS[0]), [...OVERPASS_ENDPOINTS]);
  assert.deepEqual(overpassEndpoints('https://custom.example/api/interpreter'), [
    'https://custom.example/api/interpreter',
    ...OVERPASS_ENDPOINTS,
  ]);
});

test('Overpass requests receive enough time on mobile networks', () => {
  assert.equal(overpassEndpointTimeout(30_000, 2), 15_000);
  assert.equal(overpassEndpointTimeout(30_000, 3), 15_000);
  assert.equal(overpassEndpointTimeout(60_000, 3), 20_000);
});

test('Overpass query is sent as a standards-compatible form request', () => {
  const query = '[out:json];node["amenity"="place_of_worship"];out;';
  assert.equal(overpassFormBody(query), `data=${encodeURIComponent(query)}`);
  assert.deepEqual(overpassRequestHeaders(), {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
  });
});

test('Overpass request moves to another provider after a timeout', async () => {
  const calls: string[] = [];
  const result = await requestOverpassWithFailover(
    'https://custom.example/api/interpreter',
    30_000,
    async (endpoint, timeoutMilliseconds) => {
      calls.push(`${endpoint}|${timeoutMilliseconds}`);
      if (endpoint.includes('custom.example')) throw new RequestError('timeout', 'Request timed out');
      return endpoint;
    },
  );

  assert.equal(result, OVERPASS_ENDPOINTS[0]);
  assert.deepEqual(calls, [
    'https://custom.example/api/interpreter|15000',
    `${OVERPASS_ENDPOINTS[0]}|15000`,
  ]);
});

test('invalid-query HTTP errors stop immediately instead of hiding a coding bug', async () => {
  const calls: string[] = [];
  await assert.rejects(
    requestOverpassWithFailover(
      undefined,
      30_000,
      async (endpoint) => {
        calls.push(endpoint);
        throw new RequestError('http', 'HTTP 400', 400);
      },
    ),
    (error: unknown) => error instanceof RequestError && error.status === 400,
  );
  assert.deepEqual(calls, [OVERPASS_ENDPOINTS[0]]);
});

test('cancellation stops immediately', async () => {
  const calls: string[] = [];
  await assert.rejects(
    requestOverpassWithFailover(
      undefined,
      30_000,
      async (endpoint) => {
        calls.push(endpoint);
        throw new RequestError('aborted', 'Request cancelled');
      },
    ),
    (error: unknown) => error instanceof RequestError && error.kind === 'aborted',
  );
  assert.deepEqual(calls, [OVERPASS_ENDPOINTS[0]]);
});
