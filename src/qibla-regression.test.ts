import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQiblaBearing,
  formatCoordinate,
  hasValidCoordinates,
  normalizeDegrees,
} from './qibla.js';

function nearlyEqual(actual: number, expected: number, tolerance = 0.2) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance}° of ${expected}`,
  );
}

test('calculateQiblaBearing returns stable true bearings for major cities', () => {
  nearlyEqual(calculateQiblaBearing(51.5074, -0.1278), 118.99); // London
  nearlyEqual(calculateQiblaBearing(40.7128, -74.0060), 58.48); // New York
  nearlyEqual(calculateQiblaBearing(-6.2088, 106.8456), 295.15); // Jakarta
  nearlyEqual(calculateQiblaBearing(41.0082, 28.9784), 151.91); // Istanbul
});

test('normalizeDegrees keeps compass CSS rotations finite and wrapped', () => {
  assert.equal(normalizeDegrees(0), 0);
  assert.equal(normalizeDegrees(360), 0);
  assert.equal(normalizeDegrees(725), 5);
  assert.equal(normalizeDegrees(-10), 350);
  assert.equal(normalizeDegrees(Number.NaN), 0);
  assert.equal(normalizeDegrees(Number.POSITIVE_INFINITY), 0);
});

test('invalid Qibla coordinates never produce NaN or Infinity bearings', () => {
  const invalidInputs: Array<[number, number]> = [
    [Number.NaN, 0],
    [0, Number.NaN],
    [91, 0],
    [-91, 0],
    [0, 181],
    [0, -181],
    [Number.POSITIVE_INFINITY, 0],
  ];

  invalidInputs.forEach(([latitude, longitude]) => {
    assert.equal(hasValidCoordinates(latitude, longitude), false);
    assert.equal(calculateQiblaBearing(latitude, longitude), 0);
  });
});

test('formatCoordinate does not show NaN or Infinity to the user', () => {
  assert.equal(formatCoordinate(31.7683, 'N', 'S'), '31.7683° N');
  assert.equal(formatCoordinate(-35.2809, 'N', 'S'), '35.2809° S');
  assert.equal(formatCoordinate(Number.NaN, 'N', 'S'), '--°');
  assert.equal(formatCoordinate(Number.POSITIVE_INFINITY, 'E', 'W'), '--°');
});
