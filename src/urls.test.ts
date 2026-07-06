import assert from 'node:assert/strict';
import test from 'node:test';
import { safeExternalUrl } from './urls.js';

// Permanent release guard: external navigation must stay HTTPS-only, including typed HTTP links.
test('safeExternalUrl normalizes plain hosts to HTTPS and rejects unsafe schemes', () => {
  assert.equal(safeExternalUrl('example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl(' https://example.com/path '), 'https://example.com/path');

  assert.equal(safeExternalUrl('http://example.com/path'), '');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('mailto:test@example.com'), '');
  assert.equal(safeExternalUrl(''), '');
  assert.equal(safeExternalUrl(undefined), '');
});
