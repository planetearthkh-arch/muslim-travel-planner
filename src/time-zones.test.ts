import assert from 'node:assert/strict';
import test from 'node:test';
import { addMinutesToLocalDateTime, dateTimeForZone, formatUtcForIcs, zonedDateTimeToUtc } from './time-zones.js';

test('converts local times using their named time zones', () => {
  assert.equal(zonedDateTimeToUtc('2026-07-04T12:00', 'Europe/London')?.toISOString(), '2026-07-04T11:00:00.000Z');
  assert.equal(zonedDateTimeToUtc('2026-07-04T12:00', 'Asia/Jerusalem')?.toISOString(), '2026-07-04T09:00:00.000Z');
});

test('rejects nonexistent DST local times', () => {
  assert.equal(zonedDateTimeToUtc('2026-03-29T01:30', 'Europe/London'), null);
});

test('keeps absolute timestamps absolute and formats ICS UTC', () => {
  const date = dateTimeForZone('2026-07-04T09:00:00Z', 'Asia/Jerusalem');
  assert.equal(date?.toISOString(), '2026-07-04T09:00:00.000Z');
  assert.equal(date ? formatUtcForIcs(date) : '', '20260704T090000Z');
});

test('adds minutes without using the device time zone', () => {
  assert.equal(addMinutesToLocalDateTime('2026-12-31T23:30', 90), '2027-01-01T01:00');
});
