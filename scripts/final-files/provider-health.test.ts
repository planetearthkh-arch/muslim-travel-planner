import assert from 'node:assert/strict';
import test from 'node:test';
import { availableServiceEndpoints, normalizeServiceEndpoint, recordServiceFailure, recordServiceSuccess, resetServiceHealthForTests } from './provider-health.js';

test('service endpoints require safe HTTPS URLs without credentials', () => {
  assert.equal(normalizeServiceEndpoint('http://example.com/api'), '');
  assert.equal(normalizeServiceEndpoint('https://user:pass@example.com/api'), '');
  assert.equal(normalizeServiceEndpoint('not a url'), '');
  assert.equal(normalizeServiceEndpoint('https://example.com/api'), 'https://example.com/api');
});

test('provider health temporarily skips repeatedly failing services and recovers after success', () => {
  resetServiceHealthForTests();
  const first = 'https://first.example/api';
  const second = 'https://second.example/api';
  recordServiceFailure(first, 'timeout', 0, 1_000);
  assert.deepEqual(availableServiceEndpoints([first, second], 1_001), [second, first]);
  recordServiceFailure(first, 'timeout', 0, 2_000);
  assert.deepEqual(availableServiceEndpoints([first, second], 2_001), [second]);
  recordServiceSuccess(first);
  assert.deepEqual(availableServiceEndpoints([first, second], 2_002), [first, second]);
});

test('rate limits respect provider retry delays immediately', () => {
  resetServiceHealthForTests();
  const first = 'https://first.example/api';
  const second = 'https://second.example/api';
  recordServiceFailure(first, 'rate-limited', 60_000, 10_000);
  assert.deepEqual(availableServiceEndpoints([first, second], 10_001), [second]);
  assert.deepEqual(availableServiceEndpoints([first, second], 70_001), [second, first]);
});
