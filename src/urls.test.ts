import assert from 'node:assert/strict';
import test from 'node:test';
import { safeExternalUrl } from './urls.js';

test('safeExternalUrl normalizes plain hosts to HTTPS and rejects unsafe schemes', () => {
  assert.equal(safeExternalUrl('example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl(' https://example.com/path '), 'https://example.com/path');

  assert.equal(safeExternalUrl('http://example.com/path'), '');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('mailto:test@example.com'), '');
  assert.equal(safeExternalUrl(''), '');
  assert.equal(safeExternalUrl(undefined), '');
});
