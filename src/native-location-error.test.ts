import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePositionError } from './native-location.js';

test('Capacitor permission errors map to browser-compatible denied code', () => {
  assert.equal(normalizePositionError({ code: 'OS-PLUG-GLOC-0003' }).code, 1);
  assert.equal(normalizePositionError({ code: 'OS-PLUG-GLOC-0008' }).code, 1);
});

test('Capacitor timeout and browser numeric codes remain distinguishable', () => {
  assert.equal(normalizePositionError({ code: 'OS-PLUG-GLOC-0010' }).code, 3);
  assert.equal(normalizePositionError({ code: 1 }).code, 1);
  assert.equal(normalizePositionError({ code: 2 }).code, 2);
});

test('native plugin error messages are preserved', () => {
  const error = normalizePositionError({ code: 'OS-PLUG-GLOC-0003', message: 'Location permission request was denied.' });
  assert.equal(error.PERMISSION_DENIED, 1);
  assert.equal(error.message, 'Location permission request was denied.');
});
