import assert from 'node:assert/strict';
import test from 'node:test';
import { historyStats } from './money.js';

test('historyStats accepts direct non-EUR pair history', () => {
  const stats = historyStats([
    { date: '2026-01-01', base: 'USD', quote: 'GBP', rate: 0.79 },
    { date: '2026-01-02', base: 'USD', quote: 'GBP', rate: 0.80 },
    { date: '2026-01-03', base: 'USD', quote: 'GBP', rate: 0.78 },
  ], 'GBP', 'USD');

  assert.equal(stats.points.length, 3);
  assert.equal(stats.start, 0.79);
  assert.equal(stats.latest, 0.78);
  assert.equal(stats.high, 0.80);
  assert.equal(stats.low, 0.78);
});

test('historyStats can invert direct pair history', () => {
  const stats = historyStats([
    { date: '2026-01-01', base: 'GBP', quote: 'USD', rate: 1.25 },
  ], 'GBP', 'USD');

  assert.equal(stats.points.length, 1);
  assert.equal(stats.latest, 0.8);
});

test('historyStats still supports EUR cross-rate maps', () => {
  const stats = historyStats({
    '2026-01-01': { USD: 1.10, GBP: 0.88 },
    '2026-01-02': { USD: 1.20, GBP: 0.90 },
  }, 'GBP', 'USD');

  assert.equal(stats.points.length, 2);
  assert.equal(stats.start, 0.8);
  assert.equal(stats.latest, 0.75);
});
