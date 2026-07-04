import assert from 'node:assert/strict';
import test from 'node:test';
import { availableServiceEndpoints, normalizeServiceEndpoint, recordServiceFailure, recordServiceSuccess, resetServiceHealthForTests, uniqueServiceEndpoints } from './provider-health.js';
test('normalizes and deduplicates safe HTTPS provider endpoints', () => {
  assert.equal(normalizeServiceEndpoint(' https://example.com/api '), 'https://example.com/api');
  assert.equal(normalizeServiceEndpoint('http://example.com'), '');
  assert.deepEqual(uniqueServiceEndpoints(['https://example.com/api', 'https://example.com/api', 'bad']), ['https://example.com/api']);
});
test('temporarily deprioritizes providers after repeated transient failures', () => {
  resetServiceHealthForTests(); const a = 'https://a.example/api'; const b = 'https://b.example/api';
  recordServiceFailure(a, 'timeout', 0, 1000); assert.deepEqual(availableServiceEndpoints([a, b], 1001), [b, a]);
  recordServiceFailure(a, 'timeout', 0, 1002); assert.deepEqual(availableServiceEndpoints([a, b], 1003), [b]);
  assert.deepEqual(availableServiceEndpoints([a, b], 31003), [b, a]);
});
test('rate limits block immediately and success resets health', () => {
  resetServiceHealthForTests(); const a = 'https://a.example/api'; const b = 'https://b.example/api';
  recordServiceFailure(a, 'rate-limited', 120000, 10000); assert.deepEqual(availableServiceEndpoints([a, b], 10001), [b]);
  recordServiceSuccess(a); assert.deepEqual(availableServiceEndpoints([a, b], 10002), [a, b]);
});
